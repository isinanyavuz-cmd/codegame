// 3B sahne: uzay, şerit ızgarası, gemi, meteorlar ve bütün animasyonlar.
// Oyun mantığını bilmez; yalnızca motorun ürettiği olayları oynatır.
import * as THREE from '../../vendor/three.bundle.min.js';
import { buildShip, styleShip, buildMeteor, buildCrystal, buildPirate, buildAtlasGate, glowTexture, streakTexture, beamTexture, paintBackground } from './models.js';
import { rng } from '../engine/rng.js';
import { themeOf } from './themes.js';

const C = 1.62;                 // bir karenin kenarı
const SHIP_Y = 0.42, SHIP_SCALE = 0.8;
const CAM_DIR = new THREE.Vector3(0, 21.5, 15.5).normalize();
const MOVE_MS = 430;
const RED = 0xff4d6a, GREEN = 0x37e39a, YELLOW = 0xffd53d, BLUE = 0x7f9cff;
const GATE_GAP = 2.4;           // çıkış çizgisi ile Atlas'ın kapısı arası
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
/** İki açı arasındaki en kısa fark (-π, π]. */
const turn = (a) => Math.atan2(Math.sin(a), Math.cos(a));
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
    this.theme = themeOf(0);
    this.hemi = new THREE.HemisphereLight(0xb9c8ff, 0x241446, 1.3);
    const key = new THREE.DirectionalLight(0xfff3e0, 2.6); key.position.set(-6, 12, 8);
    this.rim = new THREE.DirectionalLight(0x56e0ff, 1.6); this.rim.position.set(7, 4, -10);
    const mag = new THREE.DirectionalLight(0xff5fd0, 0.6); mag.position.set(-9, 2, -3);
    this.scene.add(this.hemi, key, this.rim, mag);

    this.level = new THREE.Group(); this.scene.add(this.level);
    this.ship = buildShip(); this.ship.scale.setScalar(SHIP_SCALE); this.ship.visible = false; this.scene.add(this.ship);
    // Kalkan: yumuşak bir küre ve çevresinde dönen altıgen ağ.
    this.shieldBubble = new THREE.Group();
    this.shieldBubble.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 28, 18), glow(0x4fd2ff, 0.16)));
    this.shieldBubble.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshBasicMaterial({ color: bright(0x8fe9ff, 1.5), transparent: true, opacity: 0.5, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.shieldBubble.visible = false; this.ship.add(this.shieldBubble);
    this.ghost = buildShip(glow(bright(0xffd84a, 1.5), 0.3)); this.ghost.scale.setScalar(SHIP_SCALE); this.ghost.visible = false; this.scene.add(this.ghost);
    // Bir adımda birden çok sensöre bakılabilir (iç içe "eğer"); her biri için ayrı işaret.
    const beamTex = beamTexture();
    this.senseMarks = []; this.beams = [];
    for (let i = 0; i < 4; i++) {
      const mk = makeMark(RED, 0.16); this.scene.add(mk); this.senseMarks.push(mk);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.rotation.x = -Math.PI / 2; beam.visible = false; this.scene.add(beam); this.beams.push(beam);
    }
    this.targetMark = makeMark(YELLOW, 0.07); this.scene.add(this.targetMark);
    this.gen = 0; this.carry = 0;

    this.glowTex = glowTexture(); this.streakTex = streakTexture();
    // Uzay tozu: ızgaranın altından akan noktalar; gemi uçarken hızlanıp hız hissi verir.
    {
      const N = 170, arr = new Float32Array(N * 3), r = rng(4242);
      for (let i = 0; i < N; i++) { arr[i * 3] = (r() - 0.5) * 38; arr[i * 3 + 1] = -0.7 - r() * 8; arr[i * 3 + 2] = -22 + r() * 40; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex, color: 0xcfe6ff, size: 0.2, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.dust.frustumCulled = false; this.scene.add(this.dust); this.flow = 0.12;
    }
    this.mats = { line: glow(0x4fd2ff, 0.34), edge: glow(0x7fe2ff, 0.7), floor: glow(0x2a6bff, 0.07), exit: glow(bright(GREEN, 2.2), 1) };
    this.tweens = new Set(); this.bursts = []; this.meteors = new Map(); this.crystals = new Map();
    this.pirates = new Map(); this.landmarks = new Map(); this.gate = null; this.progress = 0;
    // Kamera: 'ust' bütün alanı gösterir, 'pilot' geminin arkasından bakar ve onu izler.
    this.camMode = 'ust'; this.camPos = null; this.camLook = new THREE.Vector3();
    this.ambient = null; this.buildAmbient(); this.comet = null; this.cometAt = 6;
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
    this.paint();
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

  paint() {
    if (this.scene.background) this.scene.background.dispose();
    this.scene.background = paintBackground(this.W, this.H, rng(77123), this.theme, this.progress);
  }

  /**
   * Sektörün görünümünü uygular: gökyüzü, ızgara rengi ve ışıklar. 0 rota ekranıdır.
   * `progress` (0–1) sektörde ne kadar ilerlendiğidir: gezegen (son sektörde Atlas) yaklaşır.
   */
  setTheme(sector, progress = 0) {
    const t = themeOf(sector);
    if (t === this.theme && progress === this.progress) return;
    const same = t === this.theme;
    this.theme = t; this.progress = progress;
    if (same) { this.paint(); return; }
    this.buildAmbient();
    this.mats.line.color.set(t.grid[0]); this.mats.edge.color.set(t.grid[1]); this.mats.floor.color.set(t.grid[2]);
    this.hemi.color.set(t.light[0]); this.hemi.groundColor.set(t.light[1]); this.rim.color.set(t.light[2]);
    this.paint();
  }

  /** Alanın sığdırılacağı ekran bölgesi (CSS pikseli). */
  setRect(rect) { this.rect = rect; this.fit(); }

  /** Kamerayı seçer: 'ust' ya da 'pilot'. */
  setCamera(mode) { this.camMode = mode === 'pilot' ? 'pilot' : 'ust'; this.camPos = null; this.fit(); }

  /** Pilot kamerası: geminin arkasında ve biraz üstünde durur, ileriye bakar. */
  chase(snap = false) {
    const s = this.ship.position, half = this.field ? (this.field.lanes * C) / 2 : 4;
    // Yana kayışta kamera gemiyi biraz geriden izler; alanın dışına taşmaz.
    const x = Math.max(-half, Math.min(half, s.x)) * 0.8;
    const want = new THREE.Vector3(x, 4.6, s.z + 3.9), look = new THREE.Vector3(x * 1.1, 0, s.z - 4.2);
    if (snap || !this.camPos) { this.camPos = want; this.camLook.copy(look); }
    else { this.camPos.lerp(want, 0.09); this.camLook.lerp(look, 0.09); }
    this.cam.position.copy(this.camPos); this.cam.lookAt(this.camLook);
  }

  fit() {
    const f = this.field, cam = this.cam, W = this.W, H = this.H;
    cam.fov = this.camMode === 'pilot' && f ? 54 : 27; cam.zoom = 1;
    cam.clearViewOffset(); cam.updateProjectionMatrix();
    if (!f) return;
    const rect = this.rect || { x: 0, y: 0, w: W, h: H };
    if (this.camMode === 'pilot') {
      // Görüş merkezi sahne bölgesinin ortasına, biraz aşağısına gelir: gemi altta, yol önünde.
      this.offset = { x: W / 2 - (rect.x + rect.w / 2), y: H / 2 - (rect.y + rect.h * 0.5) };
      this.chase(true); this.applyOffset(0, 0);
      return;
    }
    const hw = (f.lanes * C) / 2, zb = this.gz(-0.5), zt = this.gz(f.rows - 0.5);
    // Atlas'ın kapısı çıkışın ötesinde durur; o da ekrana sığmalı.
    const far = this.gate ? GATE_GAP + 0.4 : 1.7, top = this.gate ? 3.2 : 1.1, side = this.gate ? 2.2 : 0;
    const pts = [[-hw - 0.15, 0, zb + 1.5], [hw + 0.15, 0, zb + 1.5], [-hw - 0.15 - side, 0, zt - far], [hw + 0.15 + side, 0, zt - far], [-hw - side, top, zt - (this.gate ? far : 0)], [hw + side, top, zt - (this.gate ? far : 0)]]
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
  /**
   * Alanı kurar.
   * @param o.rain  meteorlar yukarıdan yağarak yerlerine oturur (dalga değişimi)
   * @param o.boss  en uzaktaki korsan kaptandır (Kızıl Kanca): daha büyük, altın süslü
   * @param o.gate  çıkışın ötesinde Atlas'ın hangar kapısı durur; kazanınca gemi oraya yanaşır
   */
  setField(field, { rain = false, boss = false, gate = false } = {}) {
    this.cancel();
    for (const o of [...this.level.children]) {
      this.level.remove(o);
      o.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.userData.own && n.material) n.material.dispose(); });
    }
    this.meteors.clear(); this.crystals.clear(); this.pirates.clear(); this.landmarks.clear(); this.gate = null; this.trail = null;
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
    if (gate) {
      this.gate = buildAtlasGate(X1 - X0); this.gate.position.set(0, 0, Z1 - GATE_GAP); g.add(this.gate);
      // iniş ışıkları: çıkıştan kapıya uzanan iki sıra
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), glow(bright(0x9ff3ff, 2), 0.9));
        dot.userData.own = true; dot.rotation.x = -Math.PI / 2; dot.position.set(sx * (X1 - X0) * 0.3, 0.02, Z1 - 0.35 - i * 0.55); g.add(dot);
      }
      this.lightGate(0);
    } else {
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.exitTexture(), transparent: true, depthWrite: false }));
      label.scale.set(2.9, 0.725, 1); label.position.set(0, 0.1, Z1 - 1.25); g.add(label);
    }

    const rand = rng(lanes * 131 + rows * 17 + field.meteors.size * 7 + [...field.meteors].join('').length);
    for (const k of field.meteors) {
      const [lane, y] = k.split(',').map(Number);
      const mesh = buildMeteor(0.4 + rand() * 0.13, rand, this.theme.rocks);
      mesh.userData.own = true;
      mesh.position.set(this.gx(lane) + (rand() - 0.5) * 0.18, 0.45, this.gz(y) + (rand() - 0.5) * 0.18);
      g.add(mesh); this.meteors.set(k, mesh); mesh.userData.size = 1;
      const st = mesh.userData.streak = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.9), new THREE.MeshBasicMaterial({ map: this.streakTex, color: 0x9fc4ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
      st.userData.own = true; st.rotation.x = -Math.PI / 2; st.position.set(mesh.position.x, 0.2, mesh.position.z - 1.1); g.add(st);
    }
    for (const k of field.crystals) {
      const [lane, y] = k.split(',').map(Number);
      const c = buildCrystal(); c.position.set(this.gx(lane), 0.5, this.gz(y)); c.userData.phase = rand() * 6;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x4fe0ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(1.5); c.add(halo);
      g.add(c); this.crystals.set(k, c);
    }
    for (const [kind, cells, color] of [['beacon', field.beacons, 0xb786ff], ['energy', field.energyCells, 0x4cffa4]]) {
      for (const k of cells) {
        const [lane, y] = k.split(',').map(Number), marker = new THREE.Group();
        marker.position.copy(this.cellPos({ lane, y }, 0));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.055, 8, 32), glow(bright(color, 1.5), 0.9));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; ring.userData.own = true;
        const core = new THREE.Mesh(kind === 'beacon' ? new THREE.OctahedronGeometry(0.2) : new THREE.BoxGeometry(0.28, 0.38, 0.28), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.3 }));
        core.position.y = 0.44; core.userData.own = true;
        marker.add(ring, core); marker.userData.core = core; marker.userData.phase = rand() * 6;
        g.add(marker); this.landmarks.set(k, marker);
      }
    }
    const far = Math.max(-1, ...[...field.pirates].map((k) => Number(k.split(',')[1])));
    for (const k of field.pirates) {
      const [lane, y] = k.split(',').map(Number), captain = boss && y === far;
      const pirate = buildPirate(captain);
      pirate.userData.home = this.cellPos({ lane, y }, 0.48); pirate.userData.size = captain ? 0.8 : 0.6;
      pirate.userData.gone = false;
      pirate.scale.setScalar(pirate.userData.size); pirate.rotation.y = Math.PI;
      pirate.position.copy(pirate.userData.home);
      g.add(pirate); this.pirates.set(k, pirate);
    }
    this.fit();
    this.resetShip();
    if (rain) this.rain();
  }

  /**
   * Rekor uçuşun izi: zeminde soluk altın noktalar. `lanes[y]` o sırada geçilen şerittir.
   * Alanın parçasıdır; alan değişince onunla birlikte silinir.
   */
  setTrail(lanes) {
    if (this.trail) {
      this.level.remove(this.trail);
      this.trail.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
      this.trail = null;
    }
    if (!lanes || !this.field) return;
    const g = new THREE.Group(), dot = glow(bright(0xffd84a, 1.3), 0.55), line = glow(0xffd84a, 0.16), rows = this.field.rows;
    lanes.slice(0, rows).forEach((lane, y) => {
      if (y > 0) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), dot);
        m.rotation.x = -Math.PI / 2; m.position.set(this.gx(lane), 0.03, this.gz(y)); m.userData.own = true; g.add(m);
      }
      if (y + 1 < Math.min(lanes.length, rows)) strip(g, this.gx(lane), this.gz(y), this.gx(lanes[y + 1]), this.gz(y + 1), 0.04, line, 0.025).userData.own = true;
    });
    this.trail = g; this.level.add(g);
  }

  /** Dalga değişimi: meteorlar yukarıdan düşer, öteki nesneler belirir. Alanın değiştiği böylece gözle görülür. */
  rain() {
    const drops = [];
    for (const m of this.meteors.values()) { drops.push({ o: m, y: m.position.y, delay: Math.random() * 0.42, fall: true }); m.position.y += 9; }
    for (const group of [this.crystals, this.pirates, this.landmarks]) {
      for (const o of group.values()) { drops.push({ o, s: o.scale.x, delay: 0.28 + Math.random() * 0.22 }); o.scale.setScalar(0.001); }
    }
    this.drops = drops;
    const gen = this.gen;
    this.tween(880, (k) => {
      if (gen !== this.gen || this.drops !== drops) return;
      for (const d of drops) {
        const t = Math.max(0, Math.min(1, (k - d.delay) / 0.5)), e = 1 - Math.pow(1 - t, 3);
        if (d.fall) d.o.position.y = d.y + 9 * (1 - e); else d.o.scale.setScalar(Math.max(0.001, d.s * e));
      }
      if (k >= 1) this.drops = null;
    }, false);
  }
  /** Yarıda kalan yağışı bitirir: her şey yerine oturur. */
  settle() {
    if (!this.drops) return;
    for (const d of this.drops) { if (d.fall) d.o.position.y = d.y; else d.o.scale.setScalar(d.s); }
    this.drops = null;
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
    if (this.camMode === 'pilot') this.chase(true);
    this.setShield(false);
    for (const p of this.pirates.values()) {
      p.visible = true; p.userData.gone = false;
      p.position.copy(p.userData.home); p.rotation.set(0, Math.PI, 0); p.scale.setScalar(p.userData.size);
    }
    this.lightGate(0);
    for (const c of this.crystals.values()) { c.visible = true; c.scale.setScalar(1); }
    for (const m of this.meteors.values()) { m.material.emissiveIntensity = 0; this.restoreRock(m); }
  }

  /** Işınla parçalanmış kayayı yerine koyar (yeni uçuş ya da geri sarma). */
  restoreRock(m) { m.visible = true; m.scale.setScalar(1); if (m.userData.streak) m.userData.streak.visible = true; }

  setShield(visible) { this.shieldBubble.visible = !!visible; }

  /**
   * Geri sarma: gemiyi animasyonsuz bir kareye koyar. O ana kadar toplanan kristaller (`taken`)
   * ve savuşturulan korsanlar (`gone`) gizlenir, öteki her şey yerindedir.
   */
  pose(cell, { taken = [], gone = [], broken = [], shielded = false } = {}) {
    this.resetShip();
    this.ship.position.copy(this.cellPos(cell));
    for (const c of broken) { const m = this.meteors.get(`${c.lane},${c.y}`); if (m) { m.visible = false; m.userData.streak.visible = false; } }
    for (const c of taken) { const m = this.crystals.get(`${c.lane},${c.y}`); if (m) m.visible = false; }
    for (const c of gone) { const p = this.pirates.get(`${c.lane},${c.y}`); if (p) { p.visible = false; p.userData.gone = true; } }
    this.setShield(shielded);
  }

  /** Hangarda seçilen görünüm (renkler ve biçim). */
  setLook(look) { styleShip(this.ship, look); styleShip(this.ghost, look); }

  /** Atlas'ın ışıkları: 0 sönük (otopilotu bozuk), 1 tamamen açık. */
  lightGate(k) {
    if (!this.gate) return;
    for (const l of this.gate.userData.lights) l.mat.color.copy(l.base).multiplyScalar(0.1 + 1.5 * k);
  }

  /** En uzaktaki korsan kaptan mı? (Oyun, kaçışını duyurmak için sorar.) */
  isCaptain(cell) { return !!this.pirates.get(`${cell.lane},${cell.y}`)?.userData.captain; }

  /**
   * Kalkana çarpan korsan: ateş eder, atışı kalkan emer; korsan savrulup uzaklaşır.
   * Kaptan savrulmaz, ileri doğru kaçar (hikâyede geri dönecektir).
   */
  repel(cell) {
    const pirate = this.pirates.get(`${cell.lane},${cell.y}`);
    if (!pirate) return;
    const gen = this.gen, from = pirate.position.clone(), side = from.x >= this.ship.position.x ? 1 : -1, size = pirate.userData.size;
    pirate.userData.gone = true;
    this.zap(from, this.ship.position);
    this.tween(pirate.userData.captain ? 760 : 560, (k) => {
      if (gen !== this.gen) return;
      const e = k * k;
      if (pirate.userData.captain) {
        pirate.position.set(from.x + side * 1.2 * k, from.y + 1.1 * k, from.z - 15 * e);
        pirate.rotation.y = Math.PI * (1 - Math.min(1, k * 3)); pirate.rotation.z = -side * 0.5 * Math.sin(Math.PI * k);
      } else {
        pirate.position.set(from.x + side * 5 * e, from.y + 2.4 * k - 1.2 * e, from.z - 1.5 * k);
        pirate.rotation.y += 0.5; pirate.rotation.z += 0.34;
        pirate.scale.setScalar(size * (1 - 0.75 * e));
      }
      if (k >= 1) pirate.visible = false;
    }, false);
  }

  /** Kısa bir parlama: çarpışma ve sıçrama anlarını vurgular. */
  flash(strength = 1.8, ms = 420) {
    const el = this.renderer.domElement;
    if (el.animate) el.animate([{ filter: `brightness(${strength})` }, { filter: 'brightness(1)' }], { duration: ms, easing: 'ease-out' });
  }

  /** İki nokta arasında kısa ömürlü ışın (korsan atışı). */
  zap(from, to, color = 0xff3b5c) {
    const mat = glow(bright(color, 2.4), 1);
    const beam = strip(this.scene, from.x, from.z, to.x, to.z, 0.11, mat, 0.5);
    this.tween(260, (k) => { mat.opacity = 1 - k; if (k >= 1) { this.scene.remove(beam); beam.geometry.dispose(); mat.dispose(); } }, false);
  }

  /** Kalkış: motorlar bir an güçlenir, arkadan kıvılcım saçılır. */
  launch() {
    if (!this.field) return;
    const p = this.ship.position.clone(); p.z += 0.75;
    this.burst(p, { color: 0x6fdcff, n: 26, speed: 3.2, life: 0.5, size: 0.3, up: 0.2 });
  }

  /** Gemi alttan süzülerek başlangıç karesine girer. */
  enter() {
    if (!this.field) return Promise.resolve();
    const to = this.cellPos({ lane: this.field.start, y: 0 }), from = to.clone(); from.z += 3.2;
    this.ship.position.copy(from);
    const gen = this.gen;
    return this.tween(520, (k) => { if (gen !== this.gen) return; this.ship.position.lerpVectors(from, to, 1 - Math.pow(1 - k, 3)); this.thrust = 1 + (1 - k) * 0.9; }, false);
  }

  // ---------- zaman ----------
  tween(dur, fn, scaled = true) {
    // Biten animasyondan artan süre sıradakine eklenir; böylece art arda hareketler takılmadan akar.
    const t = scaled ? this.carry : 0; this.carry = 0;
    return new Promise((resolve) => { this.tweens.add({ t, dur, fn, scaled, resolve }); });
  }
  wait(ms) { return this.tween(ms, () => {}); }
  cancel() {
    this.settle();
    this.gen++; this.carry = 0;
    for (const tw of [...this.tweens]) { this.tweens.delete(tw); tw.resolve(); }
    for (const b of this.bursts) { this.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); }
    this.bursts.length = 0; this.shake = 0; this.thrust = 1;
    if (this.cam.zoom !== 1) { this.cam.zoom = 1; this.cam.updateProjectionMatrix(); }
    this.hideSense(); this.hideTarget();
  }

  // ---------- arka plan canlılığı ----------
  /**
   * Sektöre özgü hareketli katman (ızgaranın altında ve gerisinde): meteor yağmurunda süzülen
   * çizgiler, korsan bölgesinde yükselen korlar, kuşakta sürüklenen kayalar; ötekilerde göz kırpan yıldızlar.
   */
  buildAmbient() {
    if (this.ambient) { this.scene.remove(this.ambient.obj); this.ambient.obj.geometry.dispose(); this.ambient.obj.material.dispose(); }
    const kind = { streaks: 'streaks', embers: 'embers', belt: 'belt' }[this.theme.extra] || 'twinkle', r = rng(909 + kind.length);
    const N = kind === 'streaks' ? 22 : kind === 'twinkle' ? 46 : 60, lines = kind === 'streaks';
    const pos = new Float32Array(N * 3 * (lines ? 2 : 1)), seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ x: (r() - 0.5) * 46, y: -1.6 - r() * 8, z: -26 + r() * 44, k: 0.5 + r() });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = { streaks: 0xffb9a0, embers: 0xff8a4a, belt: 0xc09a70, twinkle: 0xd6e6ff }[kind];
    const obj = lines
      ? new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: bright(color, 1.4), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }))
      : new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex, color: bright(color, 1.5), size: kind === 'belt' ? 0.5 : kind === 'embers' ? 0.26 : 0.34, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    obj.frustumCulled = false; this.scene.add(obj);
    this.ambient = { kind, obj, seeds };
    this.driftAmbient(0);
  }

  driftAmbient(dt) {
    const { kind, obj, seeds } = this.ambient, p = obj.geometry.attributes.position, t = this.time || 0;
    seeds.forEach((s, i) => {
      if (kind === 'streaks') { s.x -= 5 * s.k * dt; s.z += 7 * s.k * dt; if (s.z > 18 || s.x < -24) { s.x = 6 + Math.random() * 20; s.z = -26; } }
      else if (kind === 'embers') { s.y += 0.5 * s.k * dt; s.x += Math.sin(t * 0.7 + i) * 0.25 * dt; if (s.y > -1.2) s.y = -9.5; }
      else if (kind === 'belt') { s.x += 0.55 * s.k * dt; if (s.x > 23) s.x = -23; }
      if (kind === 'streaks') { p.setXYZ(i * 2, s.x, s.y, s.z); p.setXYZ(i * 2 + 1, s.x + 0.75 * s.k, s.y, s.z - 1.05 * s.k); }
      else p.setXYZ(i, s.x, s.y, s.z);
    });
    p.needsUpdate = true;
    if (kind === 'twinkle') obj.material.opacity = 0.4 + 0.32 * Math.sin(t * 1.3);
  }

  /** Ara sıra uzaktan geçen kuyruklu yıldız. */
  driftComet(dt) {
    this.cometAt -= dt;
    if (!this.comet && this.cometAt <= 0) {
      const mat = glow(bright(0xcfeaff, 1.8), 0.9), dir = Math.random() < 0.5 ? 1 : -1;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.06), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = dir * 0.45; m.position.set(-dir * (16 + Math.random() * 6), -5 - Math.random() * 3, -24 + Math.random() * 20);
      this.scene.add(m); this.comet = { m, mat, dir, age: 0 };
    }
    if (!this.comet) return;
    const c = this.comet; c.age += dt;
    c.m.position.x += c.dir * 19 * dt; c.m.position.z += 8.5 * dt; c.mat.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, c.age / 1.5));
    if (c.age >= 1.5) { this.scene.remove(c.m); c.m.geometry.dispose(); c.mat.dispose(); this.comet = null; this.cometAt = 7 + Math.random() * 9; }
  }

  frame() {
    const now = performance.now(), raw = now - this.last, dt = Math.min(0.1, raw / 1000);
    this.last = now; this.time += dt;
    if (this.autoQuality && this.quality > 0 && raw < 500) {
      this.ema += (raw - this.ema) * 0.08;
      if (++this.samples > 40 && this.ema > 42) { this.quality--; this.samples = 0; this.ema = 16; this.resize(); }
    }
    this.carry = 0;
    for (const tw of [...this.tweens]) {
      tw.t += dt * 1000 * (tw.scaled ? this.speed : 1);
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1 && this.tweens.delete(tw)) { if (tw.scaled) this.carry = Math.min(tw.t - tw.dur, 60); tw.resolve(); }
    }
    const t = this.time;
    if (this.field) {
      for (const m of this.meteors.values()) { const s = m.userData.spin; m.rotation.x += s.x * dt; m.rotation.y += s.y * dt; m.rotation.z += s.z * dt; }
      for (const c of this.crystals.values()) { c.userData.gem.rotation.y = t * 1.4 + c.userData.phase; c.position.y = 0.5 + Math.sin(t * 2 + c.userData.phase) * 0.06; }
      for (const m of this.landmarks.values()) { m.userData.core.rotation.y = t; m.userData.core.position.y = 0.44 + Math.sin(t * 2 + m.userData.phase) * 0.08; }
      for (const p of this.pirates.values()) {
        if (p.userData.gone) continue;
        // Korsanlar gemiyi izler: burunları hep ona döner.
        const aim = Math.atan2(p.position.x - this.ship.position.x, p.position.z - this.ship.position.z);
        p.rotation.y += turn(aim - p.rotation.y) * Math.min(1, dt * 5);
        p.position.y = 0.48 + Math.sin(t * 2 + p.userData.home.z) * 0.04;
      }
      for (const f of this.ship.userData.flames) f.scale.set(1, 1, this.thrust * (0.9 + Math.sin(t * 40 + f.position.x * 9) * 0.1));
      if (this.shieldBubble.visible) { const w = this.shieldBubble.children[1]; w.rotation.y = t * 0.9; w.rotation.x = t * 0.5; this.shieldBubble.scale.setScalar(1 + Math.sin(t * 5) * 0.03); }
      if (!this.tweens.size) this.ship.position.y = SHIP_Y + Math.sin(t * 2.2) * 0.025;
      const pulse = 0.75 + Math.sin(t * 9) * 0.25;
      for (const mk of this.senseMarks) if (mk.visible) mk.userData.plane.opacity = mk.userData.fill * (0.7 + pulse * 0.6);
    }
    {
      // toz akışı: uçuş sırasında hızlı, beklerken ağır
      const target = this.field && this.thrust > 1.15 ? 1 : 0.1;
      this.flow += (target - this.flow) * Math.min(1, dt * 2.5);
      const p = this.dust.geometry.attributes.position, v = (0.9 + 15 * this.flow) * dt;
      for (let i = 0; i < p.count; i++) { let z = p.getZ(i) + v; if (z > 18) z -= 40; p.setZ(i, z); }
      p.needsUpdate = true;
      this.dust.material.opacity = 0.45 + this.flow * 0.4;
    }
    this.driftAmbient(dt); this.driftComet(dt);
    if (this.camMode === 'pilot' && this.field) this.chase();
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
  /**
   * Bu adımda bakılan sensörleri gösterir: her biri için kare işareti ve tarama ışını.
   * @param list [{ from, cell, tone }]; tone: 'bad' kırmızı (engel), 'ok' yeşil, 'info' mavi (tehlike bildirmez)
   */
  showSenses(list) {
    this.hideSense();
    list.slice(0, this.senseMarks.length).forEach((s, i) => {
      const color = { bad: RED, ok: GREEN, info: BLUE }[s.tone] ?? GREEN, mk = this.senseMarks[i], beam = this.beams[i];
      mk.userData.line.color.copy(bright(color, 1.6)); mk.userData.plane.color.set(color);
      mk.position.copy(this.cellPos(s.cell, 0)); mk.visible = true;
      const a = this.cellPos(s.from, 0.04), b = this.cellPos(s.cell, 0.04);
      a.z -= 0.55;
      beam.material.color.set(color);
      beam.scale.set(C - 0.5, Math.max(0.3, a.distanceTo(b) - 0.2), 1);
      beam.position.copy(a).lerp(b, 0.5);
      beam.rotation.z = Math.atan2(a.x - b.x, a.z - b.z);
      beam.visible = true;
      const meteor = this.meteors.get(`${s.cell.lane},${s.cell.y}`);
      if (meteor && s.tone === 'bad') { meteor.material.emissive.set(0xff2b4f); meteor.material.emissiveIntensity = 0.3; }
    });
  }
  hideSense() {
    for (const mk of this.senseMarks) mk.visible = false;
    for (const b of this.beams) b.visible = false;
    for (const m of this.meteors.values()) m.material.emissiveIntensity = 0;
  }
  /** Sarı silüet: geminin şimdi gitmekte olduğu (ya da sıradaki adımda gideceği) kare. */
  showTarget(cell) {
    this.targetMark.position.copy(this.cellPos(cell, 0)); this.targetMark.visible = true;
    this.ghost.position.copy(this.cellPos(cell)); this.ghost.visible = true;
  }
  hideTarget() { this.targetMark.visible = false; this.ghost.visible = false; }

  // ---------- olay animasyonları ----------
  /**
   * Gemi bir sonraki kareye uçar. İleri hız sabittir, yana kayma yumuşaktır;
   * art arda gelen hareketler durmadan birbirine bağlanır.
   */
  async move(ev) {
    const a = this.cellPos(ev.from), b = this.cellPos(ev.to), dl = ev.to.lane - ev.from.lane, gen = this.gen;
    let repelled = false;
    await this.tween(MOVE_MS, (k) => {
      if (gen !== this.gen) return;
      // Kalkanlı gemi korsana yaklaşınca korsan ateş eder ve savrulur.
      if (ev.blocked && !repelled && k > 0.3) { repelled = true; this.repel(ev.to); }
      this.ship.position.set(a.x + (b.x - a.x) * ease(k), SHIP_Y, a.z + (b.z - a.z) * k);
      const s = Math.sin(Math.PI * k);
      // Meteordan kaçış tam tur dönüşle (ev.roll), öteki yana kayışlar hafif yatışla yapılır.
      this.ship.rotation.z = ev.roll ? -dl * Math.PI * 2 * ease(k) : -dl * 0.55 * s; this.ship.rotation.y = -dl * 0.18 * s;
      this.thrust = 1.25 + s * 0.3;
    });
    if (gen !== this.gen) return;
    if (ev.collect) this.collect(ev.to);
    if (ev.blocked) {
      if (!repelled) this.repel(ev.to);
      this.burst(this.cellPos(ev.to), { color: 0x65dfff, n: 40, speed: 3.4, life: 0.65 });
      this.burst(this.cellPos(ev.to), { color: 0xff4d6a, n: 22, speed: 5, life: 0.5, size: 0.3 });
      this.flash(1.35, 260);
    }
    const mark = this.landmarks.get(`${ev.to.lane},${ev.to.y}`);
    if (mark) this.burst(this.cellPos(ev.to, 0.3), { color: mark.userData.core.material.color.getHex(), n: 22, speed: 2.6, life: 0.55, size: 0.3, up: 0.9 });
    this.setShield(ev.shielded);
  }

  /**
   * Işın silahı: iki kanadın ucundaki namlulardan kılıç boyunda kırmızı ışın mermileri düz ileri fırlar
   * (çaprazlamaz) ve şeritteki ilk kayaya çarpar; kaya parçalanır. Kaya yoksa mermiler alanın dışına uçar.
   */
  async fire(ev) {
    const gen = this.gen, rock = ev.hit ? this.meteors.get(`${ev.hit.lane},${ev.hit.y}`) : null;
    const from = this.cellPos(ev.from), wing = 0.52 * SHIP_SCALE, z0 = from.z - 0.3;
    // Kayanın ön yüzüne kadar ya da alanın sonunu geçene kadar.
    const zEnd = rock ? rock.position.z + 0.3 : this.gz(this.field.rows + 1);
    const LEN = 1.15, SPEED = 34, dist = Math.max(0.1, z0 - zEnd), ms = Math.max(70, (dist / SPEED) * 1000);
    const bolts = [];
    for (const s of [-1, 1]) {
      const x = from.x + s * wing, parts = [];
      // Parlak çekirdek ve çevresinde yumuşak hale
      for (const [w, color, op] of [[0.07, bright(0xffd0d8, 2.6), 1], [0.2, bright(0xff3b5c, 2.2), 0.55]]) {
        const geo = new THREE.PlaneGeometry(w, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0.5);
        const mat = glow(color, op), m = new THREE.Mesh(geo, mat);
        m.position.set(x, SHIP_Y, z0); m.scale.z = 0.001; this.scene.add(m); parts.push({ m, mat, op });
      }
      bolts.push(parts);
      this.burst(new THREE.Vector3(x, SHIP_Y, z0), { color: 0xff6b80, n: 8, speed: 1.4, life: 0.2, size: 0.22 });
    }
    const all = bolts.flat();
    const cleanup = () => { for (const p of all) { this.scene.remove(p.m); p.m.geometry.dispose(); p.mat.dispose(); } };
    // Mermiler namludan çıkıp ileri uçar; boyları kılıç uzunluğunu geçmez. Gemi hafifçe geri teper.
    await this.tween(ms, (k) => {
      const front = z0 - dist * k, tail = Math.min(z0, front + LEN);
      for (const p of all) { p.m.position.z = front; p.m.scale.z = Math.max(0.001, tail - front); }
      if (gen === this.gen) this.ship.position.z = from.z + Math.sin(Math.PI * Math.min(1, k * 2)) * 0.08;
    });
    if (gen !== this.gen) { cleanup(); return; }
    this.ship.position.z = from.z;
    if (!rock) {
      await this.tween(90, (k) => { for (const p of all) p.mat.opacity = p.op * (1 - k); });
      cleanup(); return;
    }
    cleanup();
    const p = rock.position.clone();
    this.flash(1.5, 220);
    this.burst(p, { color: 0xff8a3d, n: 46, speed: 4.6, life: 0.6, size: 0.42, up: 0.8 });
    this.burst(p, { color: 0xffe0b0, n: 18, speed: 2.4, life: 0.35, size: 0.6 });
    this.burst(p, { color: 0x9a8f86, n: 30, speed: 3.2, life: 0.8, size: 0.3, up: 0.6 });
    if (rock.userData.streak) rock.userData.streak.visible = false;
    this.shake = 5;
    await this.tween(150, (k) => {
      if (gen === this.gen) { rock.scale.setScalar(Math.max(0.001, 1 + 0.4 * k - 1.4 * k * k)); if (k >= 1) rock.visible = false; }
    });
    if (gen === this.gen) { rock.visible = false; this.shake = 0.001; }
  }

  /**
   * Güçlü lazer: beklemeden ateş eder. Burundan kesintisiz, kalın bir ışın alanın sonuna kadar
   * uzanır; ışının ucu geçtikçe şeritteki bütün kayalar sırayla parçalanır. Burunda mor bir
   * parlama ışın sürdükçe yanar. `onFire` ışın çıktığı anda çağrılır.
   */
  async beam(ev, { onFire } = {}) {
    const gen = this.gen, from = this.cellPos(ev.from), nose = from.clone(); nose.z -= 0.7;
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: bright(0xb38bff, 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: bright(0xffffff, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    orb.position.copy(nose); core.position.copy(nose); orb.scale.setScalar(2.2); core.scale.setScalar(0.8);
    this.scene.add(orb, core);
    const drop = (o) => { this.scene.remove(o); o.material.dispose(); };
    onFire?.();
    // Ateş: burundan alanın sonuna kadar kesintisiz ışın (beyaz çekirdek ve geniş mor hale).
    const zEnd = this.gz(this.field.rows + 1), len = nose.z - zEnd, parts = [];
    for (const [w, color, op] of [[0.16, bright(0xffffff, 2.6), 1], [0.42, bright(0xa16bff, 2.4), 0.75], [0.9, bright(0x6f4bff, 1.6), 0.3]]) {
      const geo = new THREE.PlaneGeometry(w, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -0.5);
      const mat = glow(color, op), m = new THREE.Mesh(geo, mat);
      m.position.set(nose.x, SHIP_Y, nose.z); m.scale.z = 0.001; this.scene.add(m); parts.push({ m, mat, op });
    }
    const rocks = ev.hits.map((h) => ({ m: this.meteors.get(`${h.lane},${h.y}`), done: false })).filter((r) => r.m);
    const blast = (r) => {
      r.done = true;
      const p = r.m.position.clone();
      this.burst(p, { color: 0xff8a3d, n: 34, speed: 4.4, life: 0.6, size: 0.4, up: 0.8 });
      this.burst(p, { color: 0xc9b3ff, n: 16, speed: 2.6, life: 0.4, size: 0.5 });
      this.burst(p, { color: 0x9a8f86, n: 20, speed: 3, life: 0.8, size: 0.28, up: 0.6 });
      if (r.m.userData.streak) r.m.userData.streak.visible = false;
      r.m.visible = false;
    };
    this.flash(1.7, 320); this.shake = 6;
    // Işının ucu hızla ilerler; geçtiği kayalar patlar.
    await this.tween(240, (k) => {
      if (gen !== this.gen) return;
      const front = nose.z - len * k;
      for (const p of parts) p.m.scale.z = Math.max(0.001, len * k);
      for (const r of rocks) if (!r.done && r.m.position.z >= front) blast(r);
      orb.scale.setScalar(2.2 + Math.sin(k * 30) * 0.15);
    });
    if (gen === this.gen) for (const r of rocks) if (!r.done) blast(r);
    // Işın bir an daha yanar, sonra incelerek söner.
    await this.tween(260, (k) => { if (gen === this.gen) for (const p of parts) p.mat.opacity = p.op * (0.85 + Math.sin(k * 50) * 0.15); });
    await this.tween(220, (k) => {
      for (const p of parts) { p.mat.opacity = p.op * (1 - k); p.m.scale.x = 1 - 0.7 * k; }
      orb.material.opacity = core.material.opacity = 1 - k;
    });
    for (const p of parts) { this.scene.remove(p.m); p.m.geometry.dispose(); p.mat.dispose(); }
    drop(orb); drop(core);
    if (gen === this.gen) { this.shake = 0.001; this.thrust = 1; }
  }

  collect(cell) {
    const c = this.crystals.get(`${cell.lane},${cell.y}`);
    if (!c) return;
    this.burst(c.position, { color: 0x58e6ff, n: 30, speed: 3, life: 0.6, size: 0.36, up: 1 });
    this.tween(260, (k) => { c.scale.setScalar(1 + k * 0.6 - k * k * 1.6); if (k >= 1) c.visible = false; }, false);
  }

  async crash(ev) {
    const a = this.cellPos(ev.from), b = this.cellPos(ev.to), dl = ev.to.lane - ev.from.lane, gen = this.gen;
    const stopAt = ev.reason === 'wall' ? 0.5 : 0.66;
    // Ağır çekim: gemi çarpışmaya yaklaşırken yavaşlar, kamera hafifçe yaklaşır. Neye çarptığı görülsün.
    await this.tween(MOVE_MS * stopAt * 2.1, (k) => {
      if (gen !== this.gen) return;
      const e = 1 - Math.pow(1 - k, 2.4);
      this.ship.position.lerpVectors(a, b, e * stopAt);
      this.ship.rotation.z = -dl * 0.5 * e; this.thrust = 1.25 + e * 0.4;
      this.cam.zoom = 1 + 0.08 * k; this.cam.updateProjectionMatrix();
    });
    if (gen !== this.gen) return;
    const p = this.ship.position.clone();
    this.ship.visible = false;
    if (ev.reason === 'pirate') this.zap(b, p);
    this.flash(2.1, 380);
    this.burst(p, { color: 0xff7a2f, n: 70, speed: 6.5, life: 0.9, size: 0.5 });
    this.burst(p, { color: 0xffffff, n: 26, speed: 3, life: 0.45, size: 0.7 });
    this.burst(p, { color: 0x49c8ff, n: 22, speed: 8, life: 0.7, size: 0.26 });
    const meteor = this.meteors.get(`${ev.to.lane},${ev.to.y}`);
    if (meteor) { meteor.material.emissive.set(0xff2b4f); meteor.material.emissiveIntensity = 0.6; }
    await this.tween(560, (k) => { if (gen === this.gen) { this.shake = (1 - k) * 16; this.cam.zoom = 1.08 - 0.08 * k; } }, false);
    if (gen === this.gen) { this.shake = 0.001; this.cam.zoom = 1; this.cam.updateProjectionMatrix(); }
  }

  /** Atlas'a yanaşma: ışıklar yanar, gemi hangar kapısından içeri süzülür. */
  async dock() {
    const a = this.ship.position.clone(), gen = this.gen, door = new THREE.Vector3(0, 0.72, this.gate.position.z + 0.2);
    this.hideTarget();
    await this.tween(700, (k) => { if (gen === this.gen) { this.lightGate(k); this.thrust = 1.2; } }, false);
    if (gen !== this.gen) return;
    this.flash(1.4, 500);
    await this.tween(1300, (k) => {
      if (gen !== this.gen) return;
      const e = ease(k);
      this.ship.position.lerpVectors(a, door, e);
      this.ship.scale.setScalar(SHIP_SCALE * (1 - 0.55 * e)); this.thrust = 1.3 + (1 - k) * 1.2;
    }, false);
    if (gen !== this.gen) return;
    this.ship.visible = false; this.thrust = 1;
    for (const sx of [-1, 0, 1]) this.burst(new THREE.Vector3(door.x + sx * 1.6, 0.8, door.z + 0.3), { color: 0x9ff3ff, n: 34, speed: 4, life: 1, size: 0.4, up: 0.9 });
    this.flash(1.9, 700);
    await this.tween(500, () => {}, false);
  }

  /** Gemi çıkış çizgisini geçtikten sonra hızlanıp uzaklaşır. `dock`: son dalgada Atlas'ın kapısına yanaşır. */
  async win(dock = false) {
    if (dock && this.gate) return this.dock();
    const a = this.ship.position.clone(), b = a.clone(), gen = this.gen; b.z -= 7;
    this.hideTarget();
    // Sıçrama: çıkış çizgisi boyunca kıvılcımlar, ileri fırlayan ışık çizgileri ve kısa bir parlama.
    const zExit = this.gz(this.field.rows - 0.5), half = (this.field.lanes * C) / 2;
    for (let l = 0; l < this.field.lanes; l++) this.burst(new THREE.Vector3(this.gx(l), 0.3, zExit), { color: l % 2 ? this.theme.grid[1] : GREEN, n: 20, speed: 4.5, life: 0.85, size: 0.36, up: 0.5 });
    const lines = [];
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() * 2 - 1) * (half + 2.5), len = 2.5 + Math.random() * 4, mat = glow(bright(0xbfefff, 1.8), 0.9);
      lines.push({ m: strip(this.scene, x, zExit + 1.5 + Math.random() * 4, x, zExit + 1.5 - len, 0.045, mat, 0.2 + Math.random() * 0.8), mat, v: 16 + Math.random() * 16 });
    }
    this.flash(1.7, 520);
    await this.tween(600, (k) => {
      if (gen !== this.gen) return;
      this.ship.position.lerpVectors(a, b, k * (0.45 + 0.55 * k));
      this.thrust = 1.25 + k * 2.6; this.ship.scale.setScalar(SHIP_SCALE * (1 - k * 0.55));
      for (const s of lines) { s.m.position.z -= s.v * 0.016 * (0.4 + k * 1.6); s.mat.opacity = 0.9 * (1 - k); }
    }, false);
    for (const s of lines) { this.scene.remove(s.m); s.m.geometry.dispose(); s.mat.dispose(); }
    if (gen !== this.gen) return;
    this.ship.visible = false; this.thrust = 1;
  }
}
