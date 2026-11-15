// 3B modeller: gemi, meteor, kristal. Hepsi kodla üretilir; dışarıdan dosya yüklenmez.
import * as THREE from '../../vendor/three.bundle.min.js';

const hull = new THREE.MeshStandardMaterial({ color: 0xdfe6f3, roughness: 0.38, metalness: 0.35 });
const accent = new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.45, metalness: 0.2 });
const dark = new THREE.MeshStandardMaterial({ color: 0x27324f, roughness: 0.5, metalness: 0.5 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0c2f55, roughness: 0.08, metalness: 0.6, emissive: 0x2fc8ff, emissiveIntensity: 0.55 });
const bright = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

function wingShape(pts, mirror) {
  const s = new THREE.Shape();
  const p = mirror ? pts.map(([x, y]) => [-x, y]).reverse() : pts;
  s.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
  s.closePath();
  return s;
}
function slab(shape, depth, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  const m = new THREE.Mesh(g, mat);
  m.rotation.x = -Math.PI / 2; m.position.y = -depth / 2;
  return m;
}

/** Gemi; burnu -z yönüne (ekranda yukarı) bakar. `ghostMat` verilirse tek renkli hayalet üretir. */
export function buildShip(ghostMat = null) {
  const g = new THREE.Group();
  const H = ghostMat || hull, A = ghostMat || accent, D = ghostMat || dark, G = ghostMat || glass;
  const prof = [[0, 1.02], [0.055, 0.92], [0.125, 0.68], [0.185, 0.34], [0.21, -0.02], [0.2, -0.4], [0.165, -0.62], [0.12, -0.72], [0, -0.72]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), H);
  fus.rotation.x = -Math.PI / 2; fus.scale.set(1, 1, 0.72); g.add(fus);
  const WING = [[0.13, 0.3], [0.98, -0.46], [0.98, -0.66], [0.52, -0.6], [0.13, -0.56]];
  const TIP = [[0.64, -0.16], [0.98, -0.46], [0.98, -0.66], [0.74, -0.63]];
  const flames = [];
  for (const mir of [false, true]) {
    const s = mir ? -1 : 1;
    g.add(slab(wingShape(WING, mir), 0.06, H));
    g.add(slab(wingShape(TIP, mir), 0.085, A));
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.56, 20), D);
    eng.rotation.x = Math.PI / 2; eng.position.set(s * 0.25, 0.02, 0.52); g.add(eng);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.36), A);
    fin.rotation.x = 0.5; fin.rotation.z = -s * 0.28; fin.position.set(s * 0.27, 0.2, 0.52); g.add(fin);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 10), D);
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 0.52, 0, -0.22); g.add(gun);
    if (ghostMat) continue;
    const noz = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ color: bright(0x8ff0ff, 3) }));
    noz.position.set(s * 0.25, 0.02, 0.805); g.add(noz);
    const flame = new THREE.Group(); flame.position.set(s * 0.25, 0.02, 0.8);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.15, 16, 1, true), additive(bright(0x49c8ff, 1.6), 0.75));
    outer.rotation.x = Math.PI / 2; outer.position.z = 0.575; flame.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.6, 12, 1, true), additive(bright(0xffffff, 2.5), 0.9));
    inner.rotation.x = Math.PI / 2; inner.position.z = 0.3; flame.add(inner);
    g.add(flame); flames.push(flame);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: bright(s > 0 ? 0x37e39a : 0xff4d6a, 3) }));
    tip.position.set(s * 0.98, 0.03, -0.56); g.add(tip);
  }
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), G);
  can.scale.set(0.115, 0.1, 0.3); can.position.set(0, 0.105, -0.28); g.add(can);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.5), A);
  stripe.position.set(0, 0.145, 0.25); g.add(stripe);
  g.userData.flames = flames;
  return g;
}

const ROCKS = [0x9a857a, 0x857268, 0xa58e7c, 0x7d6c68];
/** Yontulmuş görünümlü meteor. `rand` 0–1 arası sayı üreten fonksiyondur. */
export function buildMeteor(radius, rand) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const p = geo.attributes.position, v = new THREE.Vector3();
  const a = rand() * 9, b = rand() * 9, c = rand() * 9, d = rand() * 9;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const k = 1 + 0.2 * Math.sin(3.3 * n.x + a) * Math.sin(2.9 * n.y + b) + 0.15 * Math.sin(4.7 * n.z + c)
      + 0.08 * Math.sin(8 * n.x + 6 * n.y + d) + 0.05 * Math.sin(13 * n.z + 9 * n.y + a);
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: ROCKS[Math.floor(rand() * ROCKS.length)], roughness: 0.95, metalness: 0.05, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.set(rand() * 6, rand() * 6, rand() * 6);
  m.scale.set(1, 0.85 + rand() * 0.2, 0.9 + rand() * 0.25);
  m.userData.spin = new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.4);
  return m;
}

const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8ffcff, roughness: 0.12, metalness: 0.25, emissive: 0x2fd6ff, emissiveIntensity: 1.25, flatShading: true });
export function buildCrystal() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), crystalMat);
  gem.scale.set(0.82, 1.3, 0.82); g.add(gem);
  g.userData.gem = gem;
  return g;
}

/** Yumuşak yuvarlak parıltı dokusu (parçacıklar ve haleler için). */
export function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** Meteorların arkasındaki hareket izi. */
export function streakTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 256);
  const h = c.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(cv);
}

/** Sensör taramasının ışını: gemiden bakılan kareye doğru daralan şerit. */
export function beamTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.05)');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 0); c.lineTo(42, 256); c.lineTo(22, 256); c.closePath(); c.fill();
  return new THREE.CanvasTexture(cv);
}

/** Uzay arka planı: bulutsu, yıldızlar ve soldan görünen hedef gezegen. */
export function paintBackground(W, H, rand) {
  const S = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(W * S)); cv.height = Math.max(2, Math.round(H * S));
  const c = cv.getContext('2d'); c.scale(S, S);
  const g = c.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#0a1238'); g.addColorStop(0.5, '#080d2b'); g.addColorStop(1, '#130b33');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const blob = (x, y, r, rgb, a) => {
    const q = c.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, `rgba(${rgb},${a})`); q.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = q; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const u = Math.max(W, H) / 1440;
  blob(W * 0.39, H * 0.42, 560 * u, '70,70,210', 0.3); blob(W * 0.6, H * 0.85, 380 * u, '190,60,170', 0.16);
  blob(W * 0.12, H * 0.22, 380 * u, '20,130,210', 0.16); blob(W * 0.36, H * 0.07, 300 * u, '120,80,230', 0.14);
  const n = Math.round(620 * (W * H) / (1440 * 900));
  for (let i = 0; i < n; i++) {
    const x = rand() * W, y = rand() * H, r = 0.35 + Math.pow(rand(), 3.2) * 1.7, a = 0.25 + rand() * 0.75, t = rand();
    c.fillStyle = t < 0.7 ? `rgba(255,255,255,${a})` : t < 0.87 ? `rgba(160,205,255,${a})` : `rgba(255,214,170,${a})`;
    c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
  }
  for (const [fx, fy, s] of [[0.63, 0.28, 1], [0.08, 0.17, 0.8], [0.65, 0.68, 0.7], [0.21, 0.95, 0.6]]) {
    const x = fx * W, y = fy * H;
    blob(x, y, 26 * s, '190,220,255', 0.55);
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 13 * s, y); c.lineTo(x + 13 * s, y); c.moveTo(x, y - 13 * s); c.lineTo(x, y + 13 * s); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 2.2 * s, 0, 6.283); c.fill();
  }
  // hedef gezegen
  const R = H * 0.24, px = -R * 0.33, py = H * 0.58;
  blob(px, py, R + 70, '90,220,255', 0.3);
  c.save(); c.beginPath(); c.arc(px, py, R, 0, 6.283); c.clip();
  const pg = c.createRadialGradient(px + R * 0.55, py - R * 0.5, R * 0.05, px + R * 0.1, py, R * 1.25);
  pg.addColorStop(0, '#a8fff0'); pg.addColorStop(0.3, '#34c3d6'); pg.addColorStop(0.62, '#1b62ad'); pg.addColorStop(1, '#0a1848');
  c.fillStyle = pg; c.fillRect(px - R, py - R, R * 2, R * 2);
  c.globalAlpha = 0.16; c.strokeStyle = '#eaffff';
  for (const [dy, w] of [[-0.56, 16], [-0.29, 30], [0.02, 12], [0.27, 26], [0.55, 14]]) {
    c.lineWidth = w * R / 215; c.beginPath(); c.ellipse(px, py + dy * R, R * 1.15, R * 0.12, -0.16, 0, 6.283); c.stroke();
  }
  c.globalAlpha = 1;
  const sh = c.createRadialGradient(px + R * 0.6, py - R * 0.55, R * 0.5, px + R * 0.3, py - R * 0.2, R * 1.5);
  sh.addColorStop(0, 'rgba(4,8,30,0)'); sh.addColorStop(1, 'rgba(4,8,30,0.82)');
  c.fillStyle = sh; c.fillRect(px - R, py - R, R * 2, R * 2);
  c.restore();
  c.strokeStyle = 'rgba(160,240,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, R, -1.25, 0.55); c.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
