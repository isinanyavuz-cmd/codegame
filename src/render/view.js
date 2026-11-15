// 3B sahne: uzay, şerit ızgarası, gemi, meteorlar ve bütün animasyonlar.
// Oyun mantığını bilmez; yalnızca motorun ürettiği olayları oynatır.
import * as THREE from '../../vendor/three.bundle.min.js';
import { buildShip, buildMeteor, buildCrystal, glowTexture, streakTexture, beamTexture, paintBackground } from './models.js';
import { rng } from '../engine/rng.js';

const C = 1.62;                 // bir karenin kenarı
const SHIP_Y = 0.42, SHIP_SCALE = 0.8;
const CAM_DIR = new THREE.Vector3(0, 21.5, 15.5).normalize();
const MOVE_MS = 430, SENSE_MS = 520;
const RED = 0xff4d6a, GREEN = 0x37e39a, YELLOW = 0xffd53d;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const bright = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const glow = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function strip(group, x1, z1, x2, z2, w, mat, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(x2 - x1, z2 - z1), w), mat);
  m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  group.add(m);
  return m;
}

/** Köşeleri işaretli kare çerçevesi (sensörün baktığı ve geminin gideceği kare için). */
function makeMark(color, fill) {
  const g = new THREE.Group();
  const line = glow(bright(color, 1.6), 1), plane = glow(color, fill);
  const h = C / 2 - 0.07, L = 0.34, w = 0.07;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    strip(g, sx * h, sz * h, sx * (h - L), sz * h, w, line, 0.02);
    strip(g, sx * h, sz * h, sx * h, sz * (h - L), w, line, 0.02);
  }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(C - 0.14, C - 0.14), plane);
  f.rotation.x = -Math.PI / 2; f.position.y = 0.01; g.add(f);
  g.userData = { line, plane, fill };
  g.visible = false;
  return g;
}

export class View {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(27, 1, 0.1, 400);
    this.scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x241446, 1.3));
    const key = new THREE.DirectionalLight(0xfff3e0, 2.6); key.position.set(-6, 12, 8);
    const rim = new THREE.DirectionalLight(0x56e0ff, 1.6); rim.position.set(7, 4, -10);
    const mag = new THREE.DirectionalLight(0xff5fd0, 0.6); mag.position.set(-9, 2, -3);
    this.scene.add(key, rim, mag);

    this.level = new THREE.Group(); this.scene.add(this.level);
    this.ship = buildShip(); this.ship.scale.setScalar(SHIP_SCALE); this.ship.visible = false; this.scene.add(this.ship);
    this.ghost = buildShip(glow(bright(0xffd84a, 1.5), 0.3)); this.ghost.scale.setScalar(SHIP_SCALE); this.ghost.visible = false; this.scene.add(this.ghost);
    this.senseMark = makeMark(RED, 0.16); this.scene.add(this.senseMark);
    this.targetMark = makeMark(YELLOW, 0.07); this.scene.add(this.targetMark);
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.rotation.x = -Math.PI / 2; this.beam.visible = false; this.scene.add(this.beam);

    this.glowTex = glowTexture(); this.streakTex = streakTexture();
    this.mats = { line: glow(0x4fd2ff, 0.34), edge: glow(0x7fe2ff, 0.7), floor: glow(0x2a6bff, 0.07), exit: glow(bright(GREEN, 2.2), 1) };
    this.tweens = new Set(); this.bursts = []; this.meteors = new Map(); this.crystals = new Map();
    this.speed = 1; this.time = 0; this.last = performance.now(); this.shake = 0; this.thrust = 1;
    this.field = null; this.rect = null; this.offset = { x: 0, y: 0 };
    // Kalite: 2 = keskin + parlama, 1 = parlama, 0 = sade. Adrese ?kalite=yuksek|orta|dusuk
    // yazılmadıkça cihaz yavaş kalırsa kendiliğinden düşürülür.
    const fixed = { yuksek: 2, orta: 1, dusuk: 0 }[new URLSearchParams(location.search).get('kalite')];
    this.quality = fixed ?? 2; this.autoQuality = fixed === undefined; this.ema = 16; this.samples = 0;
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- boyut ve kamera ----------
  resize() {
    const W = this.container.clientWidth || window.innerWidth, H = this.container.clientHeight || window.innerHeight;
    this.W = W; this.H = H;
    const dpr = this.quality === 2 ? Math.min(2, window.devicePixelRatio || 1) : 1;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(W, H);
    this.cam.aspect = W / H;
    if (this.scene.background) this.scene.background.dispose();
    this.scene.background = paintBackground(W, H, rng(77123));
    try {
      if (this.composer) this.composer.dispose();
      this.composer = null;
      if (this.quality === 0) throw new Error('sade');
      const rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr, { type: THREE.HalfFloatType, samples: this.quality === 2 ? 4 : 0 });
      this.composer = new THREE.EffectComposer(this.renderer, rt);
      this.composer.setPixelRatio(dpr); this.composer.setSize(W, H);
      this.composer.addPass(new THREE.RenderPass(this.scene, this.cam));
      this.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.55, 0.9));
      this.composer.addPass(new THREE.OutputPass());
    } catch (e) { this.composer = null; }
    this.fit();
  }

  /** Alanın sığdırılacağı ekran bölgesi (CSS pikseli). */
  setRect(rect) { this.rect = rect; this.fit(); }

  fit() {
    const f = this.field, cam = this.cam, W = this.W, H = this.H;
    cam.clearViewOffset(); cam.updateProjectionMatrix();
    if (!f) return;
    const rect = this.rect || { x: 0, y: 0, w: W, h: H };
    const hw = (f.lanes * C) / 2, zb = this.gz(-0.5), zt = this.gz(f.rows - 0.5);
    const pts = [[-hw - 0.15, 0, zb + 1.5], [hw + 0.15, 0, zb + 1.5], [-hw - 0.15, 0, zt - 1.7], [hw + 0.15, 0, zt - 1.7], [-hw, 1.1, zt], [hw, 1.1, zt]]
      .map((p) => new THREE.Vector3(...p));
    const target = new THREE.Vector3(0, 0, (zb + zt) / 2);
    const box = (d) => {
      cam.position.copy(target).addScaledVector(CAM_DIR, d); cam.lookAt(target); cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const q = p.clone().project(cam), x = (q.x * 0.5 + 0.5) * W, y = (-q.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { x0, x1, y0, y1 };
    };
    let lo = 22, hi = 220;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2, b = box(mid);
      if (b.x1 - b.x0 <= rect.w * 0.96 && b.y1 - b.y0 <= rect.h * 0.97) hi = mid; else lo = mid;
    }
    const b = box(hi);
    this.offset = { x: (b.x0 + b.x1) / 2 - (rect.x + rect.w / 2), y: (b.y0 + b.y1) / 2 - (rect.y + rect.h / 2) };
    this.applyOffset(0, 0);
  }

  applyOffset(jx, jy) {
    this.cam.setViewOffset(this.W, this.H, this.offset.x + jx, this.offset.y + jy, this.W, this.H);
  }

  gx(lane) { return (lane - (this.field.lanes - 1) / 2) * C; }
  gz(y) { return ((this.field.rows - 1) / 2 - y) * C; }
  cellPos(cell, h = SHIP_Y) { return new THREE.Vector3(this.gx(cell.lane), h, this.gz(cell.y)); }
  project(v) { const p = v.clone().project(this.cam); return { x: (p.x * 0.5 + 0.5) * this.W, y: (-p.y * 0.5 + 0.5) * this.H }; }
  /** Bir karenin ekrandaki kutusu (CSS pikseli). */
  cellBox(cell) {
    const a = this.project(new THREE.Vector3(this.gx(cell.lane) - C / 2, 0.05, this.gz(cell.y)));
    const b = this.project(new THREE.Vector3(this.gx(cell.lane) + C / 2, 0.05, this.gz(cell.y)));
    return { left: a.x, right: b.x, y: (a.y + b.y) / 2 };
  }

  // ---------- alan ----------
  setField(field) {
    this.cancel();
    for (const o of [...this.level.children]) {
      this.level.remove(o);
      o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.userData.own && n.material) n.material.dispose(); });
    }
    this.meteors.clear(); this.crystals.clear();
    this.field = field;
    this.ship.visible = !!field;
    if (!field) { this.fit(); return; }
    const g = this.level, { lanes, rows } = field, m = this.mats;
    const X0 = this.gx(-0.5), X1 = this.gx(lanes - 0.5), Z0 = this.gz(-0.5), Z1 = this.gz(rows - 0.5);
    for (let l = 0; l <= lanes; l++) { const e = l === 0 || l === lanes; strip(g, this.gx(l - 0.5), Z0, this.gx(l - 0.5), Z1, e ? 0.05 : 0.028, e ? m.edge : m.line); }
    for (let r = 0; r <= rows; r++) strip(g, X0, this.gz(r - 0.5), X1, this.gz(r - 0.5), 0.028, r === 0 ? m.edge : m.line);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z0 - Z1), m.floor);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.02, (Z0 + Z1) / 2); g.add(floor);
    // çıkış çizgisi
    strip(g, X0, Z1, X1, Z1, 0.09, m.exit, 0.01);
    for (let l = 0; l < lanes; l++) for (const k of [0, 1]) {
      const a = glow(GREEN, 0.75 - k * 0.35), z = Z1 - 0.35 - k * 0.3; a.userData = {};
      strip(g, this.gx(l) - 0.22, z + 0.16, this.gx(l), z, 0.05, a).userData.own = true;
      strip(g, this.gx(l), z, this.gx(l) + 0.22, z + 0.16, 0.05, a);
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.exitTexture(), transparent: true, depthWrite: false }));
    label.scale.set(2.9, 0.725, 1); label.position.set(0, 0.1, Z1 - 1.25); g.add(label);

    const rand = rng(lanes * 131 + rows * 17 + field.meteors.size * 7 + [...field.meteors].join('').length);
    for (const k of field.meteors) {
      const [lane, y] = k.split(',').map(Number);
      const mesh = buildMeteor(0.4 + rand() * 0.13, rand);
      mesh.userData.own = true;
      mesh.position.set(this.gx(lane) + (rand() - 0.5) * 0.18, 0.45, this.gz(y) + (rand() - 0.5) * 0.18);
      g.add(mesh); this.meteors.set(k, mesh);
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.9), new THREE.MeshBasicMaterial({ map: this.streakTex, color: 0x9fc4ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      st.userData.own = true; st.rotation.x = -Math.PI / 2; st.position.set(mesh.position.x, 0.2, mesh.position.z - 1.1); g.add(st);
    }
    for (const k of field.crystals) {
      const [lane, y] = k.split(',').map(Number);
      const c = buildCrystal(); c.position.set(this.gx(lane), 0.5, this.gz(y)); c.userData.phase = rand() * 6;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x4fe0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(1.5); c.add(halo);
      g.add(c); this.crystals.set(k, c);
    }
    this.fit();
    this.resetShip();
  }

  exitTexture() {
    if (this._exitTex) return this._exitTex;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.font = '800 58px "Exo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(55,227,154,0.9)'; c.shadowBlur = 18; c.fillStyle = '#9dffd2';
    const text = 'ÇIKIŞ', gap = 26; let w = 0;
    for (const ch of text) w += c.measureText(ch).width + gap;
    let x = 256 - (w - gap) / 2;
    for (const ch of text) { const cw = c.measureText(ch).width; c.fillText(ch, x + cw / 2, 68); x += cw + gap; }
    this._exitTex = new THREE.CanvasTexture(cv); this._exitTex.colorSpace = THREE.SRGBColorSpace;
    return this._exitTex;
  }

  /** Gemiyi başlangıca alır, kristalleri ve efektleri sıfırlar. */
  resetShip() {
    this.cancel();
    if (!this.field) return;
    this.ship.visible = true; this.ship.scale.setScalar(SHIP_SCALE);
    this.ship.position.copy(this.cellPos({ lane: this.field.start, y: 0 }));
    this.ship.rotation.set(0, 0, 0);
    for (const c of this.crystals.values()) { c.visible = true; c.scale.setScalar(1); }
    for (const m of this.meteors.values()) m.material.emissiveIntensity = 0;
  }

  /** Gemi alttan süzülerek başlangıç karesine girer. */
  enter() {
    if (!this.field) return Promise.resolve();
    const to = this.cellPos({ lane: this.field.start, y: 0 }), from = to.clone(); from.z += 3.2;
    this.ship.position.copy(from);
    return this.tween(520, (k) => { this.ship.position.lerpVectors(from, to, 1 - Math.pow(1 - k, 3)); this.thrust = 1 + (1 - k) * 0.9; }, false);
  }

  // ---------- zaman ----------
  tween(dur, fn, scaled = true) {
    return new Promise((resolve) => { this.tweens.add({ t: 0, dur, fn, scaled, resolve }); });
  }
  wait(ms) { return this.tween(ms, () => {}); }
  cancel() {
    for (const tw of [...this.tweens]) { this.tweens.delete(tw); tw.resolve(); }
    for (const b of this.bursts) { this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); }
    this.bursts.length = 0; this.shake = 0; this.thrust = 1;
    this.hideSense(); this.hideTarget();
  }

  frame() {
    const now = performance.now(), raw = now - this.last, dt = Math.min(0.1, raw / 1000);
    this.last = now; this.time += dt;
    if (this.autoQuality && this.quality > 0 && raw < 500) {
      this.ema += (raw - this.ema) * 0.08;
      if (++this.samples > 40 && this.ema > 42) { this.quality--; this.samples = 0; this.ema = 16; this.resize(); }
    }
    for (const tw of [...this.tweens]) {
      tw.t += dt * 1000 * (tw.scaled ? this.speed : 1);
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1 && this.tweens.delete(tw)) tw.resolve();
    }
    const t = this.time;
    if (this.field) {
      for (const m of this.meteors.values()) { const s = m.userData.spin; m.rotation.x += s.x * dt; m.rotation.y += s.y * dt; m.rotation.z += s.z * dt; }
      for (const c of this.crystals.values()) { c.userData.gem.rotation.y = t * 1.4 + c.userData.phase; c.position.y = 0.5 + Math.sin(t * 2 + c.userData.phase) * 0.06; }
      for (const f of this.ship.userData.flames) f.scale.set(1, 1, this.thrust * (0.9 + Math.sin(t * 40 + f.position.x * 9) * 0.1));
      if (!this.tweens.size) this.ship.position.y = SHIP_Y + Math.sin(t * 2.2) * 0.025;
      const pulse = 0.75 + Math.sin(t * 9) * 0.25;
      if (this.senseMark.visible) this.senseMark.userData.plane.opacity = this.senseMark.userData.fill * (0.7 + pulse * 0.6);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.age += dt;
      const p = b.pts.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        b.vel[j].multiplyScalar(1 - 2.2 * dt);
        p.setXYZ(j, p.getX(j) + b.vel[j].x * dt, p.getY(j) + b.vel[j].y * dt, p.getZ(j) + b.vel[j].z * dt);
      }
      p.needsUpdate = true; b.pts.material.opacity = Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) { this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); this.bursts.splice(i, 1); }
    }
    if (this.shake > 0.01) this.applyOffset((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    else if (this.shake !== 0) { this.shake = 0; this.applyOffset(0, 0); }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.cam);
  }

  burst(pos, { color = 0xffa040, n = 46, speed = 4, life = 0.75, size = 0.42, up = 0.6 } = {}) {
    const arr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
      const a = Math.random() * 6.283, s = speed * (0.25 + Math.random());
      vel.push(new THREE.Vector3(Math.cos(a) * s, (Math.random() - 0.2) * s * up, Math.sin(a) * s));
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex, color: bright(color, 2.2), size, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts); this.bursts.push({ pts, vel, age: 0, life });
  }

  // ---------- işaretler ----------
  /** Sensörün baktığı kareyi ve tarama ışınını gösterir. `danger`: kırmızı, değilse yeşil. */
  showSense(from, cell, danger) {
    const color = danger ? RED : GREEN, mk = this.senseMark;
    mk.userData.line.color.copy(bright(color, 1.6)); mk.userData.plane.color.set(color);
    mk.position.copy(this.cellPos(cell, 0)); mk.visible = true;
    const a = this.cellPos(from, 0.04), b = this.cellPos(cell, 0.04);
    a.z -= 0.55;
    const len = Math.max(0.3, a.distanceTo(b) - 0.2);
    this.beam.material.color.set(color);
    this.beam.scale.set(C - 0.5, len, 1);
    this.beam.position.copy(a).lerp(b, 0.5);
    this.beam.rotation.z = Math.atan2(a.x - b.x, a.z - b.z);
    this.beam.visible = true;
    const meteor = this.meteors.get(`${cell.lane},${cell.y}`);
    if (meteor && danger) { meteor.material.emissive.set(0xff2b4f); meteor.material.emissiveIntensity = 0.3; }
  }
  hideSense() {
    this.senseMark.visible = false; this.beam.visible = false;
    for (const m of this.meteors.values()) m.material.emissiveIntensity = 0;
  }
  showTarget(cell) {
    this.targetMark.position.copy(this.cellPos(cell, 0)); this.targetMark.visible = true;
    this.ghost.position.copy(this.cellPos(cell)); this.ghost.visible = true;
  }
  hideTarget() { this.targetMark.visible = false; this.ghost.visible = false; }

  // ---------- olay animasyonları ----------
  sense(ev) {
    const danger = ev.cond === 'ahead' ? ev.result : !ev.result;
    this.showSense({ lane: ev.lane, y: ev.y }, ev.cell, danger);
    return this.wait(SENSE_MS);
  }

  async move(ev) {
    const a = this.cellPos(ev.from), b = this.cellPos(ev.to), dl = ev.to.lane - ev.from.lane;
    this.hideSense();
    if (!ev.exit && dl) this.showTarget(ev.to);
    await this.tween(MOVE_MS, (k) => {
      this.ship.position.lerpVectors(a, b, ease(k));
      const s = Math.sin(Math.PI * k);
      this.ship.rotation.z = -dl * 0.55 * s; this.ship.rotation.y = -dl * 0.18 * s;
      this.thrust = 1 + s * 0.55;
    });
    this.hideTarget();
    if (ev.collect) this.collect(ev.to);
  }

  collect(cell) {
    const c = this.crystals.get(`${cell.lane},${cell.y}`);
    if (!c) return;
    this.burst(c.position, { color: 0x58e6ff, n: 30, speed: 3, life: 0.6, size: 0.36, up: 1 });
    this.tween(260, (k) => { c.scale.setScalar(1 + k * 0.6 - k * k * 1.6); if (k >= 1) c.visible = false; }, false);
  }

  async crash(ev) {
    const a = this.cellPos(ev.from), b = this.cellPos(ev.to), dl = ev.to.lane - ev.from.lane;
    this.hideSense();
    const stopAt = ev.reason === 'wall' ? 0.5 : 0.66;
    await this.tween(MOVE_MS * 0.62, (k) => {
      this.ship.position.lerpVectors(a, b, ease(k) * stopAt);
      this.ship.rotation.z = -dl * 0.5 * k; this.thrust = 1 + k * 0.5;
    });
    const p = this.ship.position.clone();
    this.ship.visible = false;
    this.burst(p, { color: 0xff7a2f, n: 70, speed: 6.5, life: 0.9, size: 0.5 });
    this.burst(p, { color: 0xffffff, n: 26, speed: 3, life: 0.45, size: 0.7 });
    this.burst(p, { color: 0x49c8ff, n: 22, speed: 8, life: 0.7, size: 0.26 });
    const meteor = this.meteors.get(`${ev.to.lane},${ev.to.y}`);
    if (meteor) { meteor.material.emissive.set(0xff2b4f); meteor.material.emissiveIntensity = 0.6; }
    await this.tween(560, (k) => { this.shake = (1 - k) * 16; }, false);
    this.shake = 0.001;
  }

  /** Gemi çıkış çizgisini geçtikten sonra hızlanıp uzaklaşır. */
  async win() {
    const a = this.ship.position.clone(), b = a.clone(); b.z -= 7;
    this.burst(new THREE.Vector3(a.x, 0.3, this.gz(this.field.rows - 0.5)), { color: GREEN, n: 44, speed: 5, life: 0.8, size: 0.4, up: 0.3 });
    await this.tween(560, (k) => {
      this.ship.position.lerpVectors(a, b, k * k);
      this.thrust = 1 + k * 2.4; this.ship.scale.setScalar(SHIP_SCALE * (1 - k * 0.55));
    }, false);
    this.ship.visible = false; this.thrust = 1;
  }
}
