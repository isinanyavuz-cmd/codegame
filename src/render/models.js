// 3B modeller: gemi, meteor, kristal. Hepsi kodla üretilir; dışarıdan dosya yüklenmez.
import * as THREE from '../../vendor/three.bundle.min.js';

const hull = new THREE.MeshStandardMaterial({ color: 0xdfe6f3, roughness: 0.38, metalness: 0.35 });
const accent = new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.45, metalness: 0.2 });
const dark = new THREE.MeshStandardMaterial({ color: 0x27324f, roughness: 0.5, metalness: 0.5 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0c2f55, roughness: 0.08, metalness: 0.6, emissive: 0x2fc8ff, emissiveIntensity: 0.55 });
const bright = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

let haloTexture = null;
const haloTex = () => (haloTexture ??= glowTexture());

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
  // Hangardaki biçim seçimi için: kanatlar, kanada bağlı parçalar ve alev malzemeleri (bkz. styleShip).
  const flames = [], wings = [], span = [], flameMats = [], halos = [];
  for (const mir of [false, true]) {
    const s = mir ? -1 : 1;
    for (const w of [slab(wingShape(WING, mir), 0.06, H), slab(wingShape(TIP, mir), 0.085, A)]) { g.add(w); wings.push(w); }
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.56, 20), D);
    eng.rotation.x = Math.PI / 2; eng.position.set(s * 0.25, 0.02, 0.52); g.add(eng);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.3, 0.36), A);
    fin.rotation.x = 0.5; fin.rotation.z = -s * 0.28; fin.position.set(s * 0.27, 0.2, 0.52); g.add(fin);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 10), D);
    gun.rotation.x = Math.PI / 2; gun.position.set(s * 0.52, 0, -0.22); g.add(gun); span.push({ o: gun, x: s * 0.52 });
    if (ghostMat) continue;
    const noz = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ color: bright(0x8ff0ff, 3) }));
    noz.position.set(s * 0.25, 0.02, 0.805); g.add(noz);
    const flame = new THREE.Group(); flame.position.set(s * 0.25, 0.02, 0.8);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.15, 16, 1, true), additive(bright(0x49c8ff, 1.6), 0.75));
    outer.rotation.x = Math.PI / 2; outer.position.z = 0.575; flame.add(outer); flameMats.push(outer.material);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.6, 12, 1, true), additive(bright(0xffffff, 2.5), 0.9));
    inner.rotation.x = Math.PI / 2; inner.position.z = 0.3; flame.add(inner);
    g.add(flame); flames.push(flame);
    // Parlama efekti kapalıyken (düşük kalite) alevin çevresine konan yumuşak ışık; açıkken gizlenir.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0x49c8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(s * 0.25, 0.02, 0.95); halo.scale.set(1.1, 1.1, 1); halo.visible = false; g.add(halo); halos.push(halo);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: bright(s > 0 ? 0x37e39a : 0xff4d6a, 3) }));
    tip.position.set(s * 0.98, 0.03, -0.56); g.add(tip); span.push({ o: tip, x: s * 0.98 });
  }
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), G);
  can.scale.set(0.115, 0.1, 0.3); can.position.set(0, 0.105, -0.28); g.add(can);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.5), A);
  stripe.position.set(0, 0.145, 0.25); g.add(stripe);
  Object.assign(g.userData, { flames, wings, span, flameMats, halos, fus });
  return g;
}

/**
 * Hangardaki görünümü gemiye uygular: gövde, şerit ve alev rengi; kanat açıklığı ve gövde boyu.
 * Gövde ve şerit malzemeleri ortaktır; hayalet gemi (tek renk) yalnızca biçimi alır.
 */
export function styleShip(ship, look) {
  const u = ship.userData;
  if (u.flameMats.length) { hull.color.set(look.hull.color); accent.color.set(look.accent.color); }
  for (const m of u.flameMats) m.color.copy(bright(look.flame.color, 1.6));
  for (const h of u.halos) h.material.color.set(look.flame.color);
  for (const w of u.wings) w.scale.x = look.shape.wing;
  for (const p of u.span) p.o.position.x = p.x * look.shape.wing;
  u.fus.scale.y = look.shape.nose;
}

const pirateHull = new THREE.MeshStandardMaterial({ color: 0x8a1c36, roughness: 0.4, metalness: 0.45, emissive: 0xff2244, emissiveIntensity: 0.3 });
const pirateDark = new THREE.MeshStandardMaterial({ color: 0x1c1226, roughness: 0.55, metalness: 0.5 });
const pirateGold = new THREE.MeshStandardMaterial({ color: 0xffc23a, roughness: 0.3, metalness: 0.8, emissive: 0xff9a1f, emissiveIntensity: 0.4 });
const pirateEye = new THREE.MeshBasicMaterial({ color: bright(0xff3b5c, 2.8) });
const CLAW = [[0.13, 0.08], [0.6, 0.6], [0.72, 1.0], [0.88, 0.48], [0.62, -0.5], [0.13, -0.44]];

/**
 * Korsan gemisi: öne uzanan iki pençe ve tek kırmızı göz. Burnu -z yönüne bakar.
 * Kaptanınki (Kızıl Kanca) altın süslüdür ve burnunda bir kanca taşır.
 */
export function buildPirate(captain = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 6), pirateHull);
  body.rotation.x = -Math.PI / 2; body.scale.set(1, 1, 0.5); g.add(body);
  for (const mir of [false, true]) g.add(slab(wingShape(CLAW, mir), 0.08, pirateDark));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pirateEye);
  eye.scale.set(0.1, 0.07, 0.17); eye.position.set(0, 0.12, -0.12); g.add(eye);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.5), pirateDark);
  fin.rotation.x = 0.35; fin.position.set(0, 0.2, 0.42); g.add(fin);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 12, 1, true), additive(bright(0xff4a2f, 1.7), 0.75));
  jet.rotation.x = Math.PI / 2; jet.position.set(0, 0, 1.1); jet.userData.own = true; g.add(jet);
  if (captain) {
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 1.0), pirateGold);
    spine.position.set(0, 0.17, 0.05); g.add(spine);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 18, Math.PI * 1.25), pirateGold);
    hook.rotation.set(Math.PI / 2, 0, -0.4); hook.position.set(0, -0.02, -0.86); g.add(hook);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 8), pirateGold);
      tip.rotation.x = -Math.PI / 2; tip.position.set(s * 0.72, 0, -1.08); g.add(tip);
    }
  }
  g.userData.captain = captain;
  return g;
}

const atlasHull = new THREE.MeshStandardMaterial({ color: 0x2c2654, roughness: 0.55, metalness: 0.6 });
const atlasTrim = new THREE.MeshStandardMaterial({ color: 0x7667b8, roughness: 0.4, metalness: 0.7 });

/**
 * Ana Gemi Atlas'ın hangar kapısı: çıkışın hemen ötesinde duran dev gövde. Ön yüzü +z'ye
 * (oyun alanına) bakar; `width` alanın genişliğidir. `userData.lights` kapı ve pencere
 * ışıklarının malzemeleridir: View bunları kısıp açar (gemi yaklaşınca Atlas uyanır).
 */
export function buildAtlasGate(width) {
  const g = new THREE.Group(), lights = [];
  const light = (color, w, h, x, y, z = 0.02) => {
    const mat = new THREE.MeshBasicMaterial({ color });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.userData.own = true; g.add(m);
    lights.push({ mat, base: new THREE.Color(color) });
    return m;
  };
  const W = width + 6, D = 5;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(W, 3.6, D), atlasHull); hull.position.set(0, 0.7, -D / 2); g.add(hull);
  for (const s of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 2.4), atlasHull); tower.position.set(s * (W / 2 - 1.6), 3.3, -D / 2); g.add(tower);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.7, 0.2), atlasTrim); rail.position.set(s * (width * 0.3 + 0.2), 0.7, 0.05); g.add(rail);
    light(0xffd9a0, 0.9, 0.16, s * (W / 2 - 1.6), 3.7); light(0xffd9a0, 0.9, 0.16, s * (W / 2 - 1.6), 3.2);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6 + 0.7, 0.2, 0.2), atlasTrim); lintel.position.set(0, 1.75, 0.05); g.add(lintel);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 2.2, 8), atlasTrim); mast.position.set(0, 3.6, -D / 2); g.add(mast);
  // hangar kapısı: geminin gireceği parlak açıklık
  light(0x9ff3ff, width * 0.6, 1.9, 0, 0.72);
  // pencere sıraları
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    if ((r * 5 + c) % 4 === 3) continue;
    light(c % 3 ? 0xffe2ac : 0x9fe9ff, 0.32, 0.13, s * (width * 0.3 + 0.75 + c * 0.47), 1.9 - r * 0.55);
  }
  g.userData.lights = lights;
  return g;
}

const ROCKS = [0x9a857a, 0x857268, 0xa58e7c, 0x7d6c68];
/** Yontulmuş görünümlü meteor. `rand` 0–1 arası sayı üreten fonksiyondur; `rocks` renk seçenekleridir. */
export function buildMeteor(radius, rand, rocks = ROCKS) {
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
  const mat = new THREE.MeshStandardMaterial({ color: rocks[Math.floor(rand() * rocks.length)], roughness: 0.95, metalness: 0.05, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.set(rand() * 6, rand() * 6, rand() * 6);
  m.scale.set(1, 0.85 + rand() * 0.2, 0.9 + rand() * 0.25);
  m.userData.spin = new THREE.Vector3((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.4);
  return m;
}

/** Kristalli kaya: kayanın yüzeyinden camgöbeği kristal uçları çıkar; kırılınca içinden kristal kalır. */
export function addGeodeShards(rock, rand) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8ffcff, emissive: 0x2fd6ff, emissiveIntensity: 1.1, roughness: 0.2, flatShading: true });
  // Kaya döndüğü için uçlar her yöne dağılır; kamera yukarıdan baktığından çoğu üst yarıdadır.
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), mat);
    const dir = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize();
    s.position.copy(dir.clone().multiplyScalar(0.48)); s.scale.set(0.8, 1.9, 0.8);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rock.add(s);
  }
}

/** Demir asteroit: koyu, parlak metal; üstünde perçin gibi küçük çıkıntılar. Lazer onu kıramaz. */
export function makeIron(rock, rand) {
  rock.material = new THREE.MeshStandardMaterial({ color: 0x59616f, roughness: 0.32, metalness: 0.85, flatShading: true });
  const stud = new THREE.MeshStandardMaterial({ color: 0x9aa4b4, roughness: 0.25, metalness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), stud);
    s.position.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.42); rock.add(s);
  }
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

/**
 * Uzay arka planı: gökyüzü, bulutsu, yıldızlar ve sektöre özgü öğeler.
 * Görünüm `theme` ile belirlenir (bkz. themes.js).
 */
export function paintBackground(W, H, rand, theme, progress = 0) {
  const S = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(W * S)); cv.height = Math.max(2, Math.round(H * S));
  const c = cv.getContext('2d'); c.scale(S, S);
  const g = c.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(0.5, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const blob = (x, y, r, rgb, a) => {
    const q = c.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, `rgba(${rgb},${a})`); q.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = q; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const u = Math.max(W, H) / 1440, n4 = theme.nebula;
  blob(W * 0.39, H * 0.42, 560 * u, n4[0], 0.3); blob(W * 0.6, H * 0.85, 380 * u, n4[1], 0.17);
  blob(W * 0.12, H * 0.22, 380 * u, n4[2], 0.17); blob(W * 0.36, H * 0.07, 300 * u, n4[3], 0.15);
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
  if (EXTRAS[theme.extra]) EXTRAS[theme.extra](c, W, H, rand, u, blob, progress);
  if (theme.planet) paintPlanet(c, H, theme.planet, progress);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sol kenardan görünen gezegen. Sektörde ilerledikçe (`progress` 0–1) yaklaşır: büyür ve içeri kayar. */
function paintPlanet(c, H, { hue, ring }, progress) {
  const R = H * (0.19 + 0.09 * progress), px = -R * (0.46 - 0.2 * progress), py = H * 0.58, hsl = (dh, s, l, a = 1) => `hsla(${hue + dh},${s}%,${l}%,${a})`;
  const halo = c.createRadialGradient(px, py, R * 0.8, px, py, R + 80);
  halo.addColorStop(0, hsl(0, 90, 65, 0.34)); halo.addColorStop(1, hsl(0, 90, 65, 0));
  c.fillStyle = halo; c.fillRect(px - R - 90, py - R - 90, (R + 90) * 2, (R + 90) * 2);
  const arc = (front) => {
    c.save(); c.translate(px, py); c.rotate(-0.3); c.scale(1, 0.26);
    c.strokeStyle = hsl(10, 85, 80, front ? 0.6 : 0.28); c.lineWidth = R * 0.11;
    c.beginPath(); c.arc(0, 0, R * 1.55, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); c.stroke();
    c.strokeStyle = hsl(-10, 80, 70, front ? 0.4 : 0.18); c.lineWidth = R * 0.05;
    c.beginPath(); c.arc(0, 0, R * 1.82, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); c.stroke();
    c.restore();
  };
  if (ring) arc(false);
  c.save(); c.beginPath(); c.arc(px, py, R, 0, 6.283); c.clip();
  const pg = c.createRadialGradient(px + R * 0.55, py - R * 0.5, R * 0.05, px + R * 0.1, py, R * 1.25);
  pg.addColorStop(0, hsl(-8, 95, 84)); pg.addColorStop(0.3, hsl(0, 78, 54)); pg.addColorStop(0.62, hsl(18, 72, 36)); pg.addColorStop(1, hsl(40, 70, 14));
  c.fillStyle = pg; c.fillRect(px - R, py - R, R * 2, R * 2);
  c.globalAlpha = 0.16; c.strokeStyle = '#fff';
  for (const [dy, w] of [[-0.56, 16], [-0.29, 30], [0.02, 12], [0.27, 26], [0.55, 14]]) {
    c.lineWidth = w * R / 215; c.beginPath(); c.ellipse(px, py + dy * R, R * 1.15, R * 0.12, -0.16, 0, 6.283); c.stroke();
  }
  c.globalAlpha = 1;
  const sh = c.createRadialGradient(px + R * 0.6, py - R * 0.55, R * 0.5, px + R * 0.3, py - R * 0.2, R * 1.5);
  sh.addColorStop(0, 'rgba(4,8,30,0)'); sh.addColorStop(1, 'rgba(4,8,30,0.82)');
  c.fillStyle = sh; c.fillRect(px - R, py - R, R * 2, R * 2);
  c.restore();
  c.strokeStyle = hsl(0, 90, 82, 0.55); c.lineWidth = 2; c.beginPath(); c.arc(px, py, R, -1.25, 0.55); c.stroke();
  if (ring) arc(true);
}

/** Sektöre özgü arka plan öğeleri. Hepsi geri planda, soluk çizilir; oyun alanını bastırmaz. */
const EXTRAS = {
  // Asteroit kuşağı: ekranı çaprazlama geçen kaya şeridi
  belt(c, W, H, rand, u) {
    for (let i = 0; i < 150; i++) {
      const t = rand(), off = (rand() - 0.5) * 2, x = t * W * 1.1 - W * 0.05, y = H * (0.92 - t * 0.78) + off * off * Math.sign(off) * H * 0.13;
      const r = (1.5 + Math.pow(rand(), 2.4) * 11) * u, a = 0.3 + rand() * 0.45;
      c.save(); c.translate(x, y); c.rotate(rand() * 3); c.scale(1, 0.62 + rand() * 0.3);
      c.fillStyle = `rgba(${95 + rand() * 50},${66 + rand() * 30},${48 + rand() * 20},${a})`;
      c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill();
      c.fillStyle = `rgba(255,205,150,${a * 0.38})`; c.beginPath(); c.arc(-r * 0.25, -r * 0.3, r * 0.52, 0, 6.283); c.fill();
      c.restore();
    }
  },
  // Meteor yağmuru: gökten süzülen ışık çizgileri
  streaks(c, W, H, rand, u) {
    c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = rand() * W * 1.2, y = rand() * H, len = (50 + rand() * 190) * u, a = 0.12 + rand() * 0.34;
      const q = c.createLinearGradient(x, y, x - len * 0.55, y + len);
      q.addColorStop(0, 'rgba(255,190,170,0)'); q.addColorStop(1, `rgba(255,${150 + rand() * 80},${130 + rand() * 60},${a})`);
      c.strokeStyle = q; c.lineWidth = (0.8 + rand() * 2.2) * u;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.55, y + len); c.stroke();
      c.fillStyle = `rgba(255,235,215,${a + 0.2})`; c.beginPath(); c.arc(x - len * 0.55, y + len, (1 + rand() * 1.6) * u, 0, 6.283); c.fill();
    }
  },
  // Karanlık bulutsu: yıldızları örten koyu bulutlar
  clouds(c, W, H, rand, u, blob) {
    for (let i = 0; i < 16; i++) blob(rand() * W, rand() * H, (150 + rand() * 260) * u, '4,3,16', 0.5 + rand() * 0.34);
    for (let i = 0; i < 5; i++) blob(rand() * W, rand() * H, (90 + rand() * 150) * u, '120,80,255', 0.09);
  },
  // Korsan bölgesi: savrulan kor parçaları ve enkaz
  embers(c, W, H, rand, u, blob) {
    for (let i = 0; i < 70; i++) {
      const x = rand() * W, y = rand() * H, r = (0.8 + Math.pow(rand(), 2) * 2.6) * u;
      blob(x, y, r * 7, '255,90,50', 0.2); c.fillStyle = `rgba(255,${150 + rand() * 80},90,${0.5 + rand() * 0.4})`;
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
    }
    for (let i = 0; i < 16; i++) {
      c.save(); c.translate(rand() * W, rand() * H); c.rotate(rand() * 6.283);
      const s = (7 + rand() * 20) * u; c.fillStyle = `rgba(42,22,28,${0.6 + rand() * 0.3})`; c.strokeStyle = 'rgba(255,120,90,0.3)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-s, -s * 0.3); c.lineTo(s * 0.6, -s * 0.5); c.lineTo(s, s * 0.2); c.lineTo(-s * 0.2, s * 0.5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  },
  // Enerji krizi: kutup ışığına benzeyen enerji şeritleri
  aurora(c, W, H, rand, u) {
    c.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const y0 = H * (0.12 + k * 0.22 + rand() * 0.08), amp = H * (0.04 + rand() * 0.06), ph = rand() * 6, w = (26 + rand() * 46) * u;
      const q = c.createLinearGradient(0, y0 - amp, W, y0 + amp);
      q.addColorStop(0, 'rgba(60,255,170,0)'); q.addColorStop(0.3 + rand() * 0.2, `rgba(${60 + rand() * 60},255,${170 + rand() * 60},0.2)`); q.addColorStop(1, 'rgba(40,200,255,0)');
      c.strokeStyle = q; c.lineWidth = w; c.beginPath();
      for (let x = -20; x <= W + 20; x += 24) { const y = y0 + Math.sin(x / W * 5.2 + ph) * amp + Math.sin(x / W * 13 + ph * 2) * amp * 0.3; if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
  },
  // Manevra okulu: uzakta dizili eğitim halkaları
  rings(c, W, H, rand, u) {
    for (let i = 0; i < 9; i++) {
      const x = W * (0.08 + rand() * 0.84), y = H * (0.06 + rand() * 0.88), r = (16 + rand() * 54) * u, a = 0.12 + rand() * 0.2;
      c.save(); c.translate(x, y); c.rotate(rand() * 1.2 - 0.6); c.scale(1, 0.34 + rand() * 0.4);
      c.strokeStyle = `rgba(255,${200 + rand() * 40},110,${a})`; c.lineWidth = (2 + rand() * 3) * u; c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke();
      c.strokeStyle = `rgba(255,240,190,${a * 0.6})`; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 1.25, 0, 6.283); c.stroke();
      c.restore();
    }
  },
  // Ana gemi: sol kenarda dev bir geminin gövdesi
  station(c, W, H, rand, u, blob, progress) {
    // Atlas her görevde biraz daha yakın görünür.
    const s = H * (0.2 + 0.13 * progress), x = H * 0.02 - s * (0.3 - 0.3 * progress), y = H * 0.56;
    blob(x, y, s * 1.5, '210,90,255', 0.24);
    c.save(); c.translate(x, y); c.rotate(-0.24);
    const body = c.createLinearGradient(-s * 0.5, 0, s * 0.62, 0);
    body.addColorStop(0, '#0d0a1e'); body.addColorStop(0.65, '#2b2350'); body.addColorStop(0.9, '#6a5aa8'); body.addColorStop(1, '#cdb8ff');
    c.fillStyle = body;
    c.beginPath(); c.moveTo(-s * 0.5, -s * 1.5); c.lineTo(s * 0.3, -s * 1.28); c.lineTo(s * 0.62, -s * 0.4); c.lineTo(s * 0.62, s * 0.5); c.lineTo(s * 0.28, s * 1.32); c.lineTo(-s * 0.5, s * 1.55); c.closePath(); c.fill();
    c.fillStyle = '#1a1536';
    c.beginPath(); c.moveTo(s * 0.62, -s * 0.16); c.lineTo(s * 1.02, -s * 0.07); c.lineTo(s * 1.02, s * 0.2); c.lineTo(s * 0.62, s * 0.3); c.closePath(); c.fill();
    blob(s * 1.05, s * 0.06, s * 0.3, '120,230,255', 0.55);
    c.fillStyle = 'rgba(160,240,255,0.95)'; c.fillRect(s * 1.0, -s * 0.04, s * 0.03, s * 0.2);
    for (let r = 0; r < 15; r++) for (let k = 0; k < 6; k++) {
      if (rand() < 0.36) continue;
      const wx = -s * 0.36 + k * s * 0.15, wy = -s * 1.12 + r * s * 0.16;
      c.fillStyle = rand() < 0.2 ? 'rgba(120,235,255,0.9)' : `rgba(255,${205 + rand() * 40},150,${0.45 + rand() * 0.5})`;
      c.fillRect(wx, wy, s * 0.07, s * 0.035);
    }
    c.strokeStyle = 'rgba(210,180,255,0.5)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(s * 0.3, -s * 1.28); c.lineTo(s * 0.62, -s * 0.4); c.lineTo(s * 0.62, s * 0.5); c.lineTo(s * 0.28, s * 1.32); c.stroke();
    c.restore();
    c.save(); c.translate(x + s * 0.2, y); c.rotate(-0.24); c.scale(1, 0.2);
    c.strokeStyle = 'rgba(240,170,255,0.5)'; c.lineWidth = s * 0.07; c.beginPath(); c.arc(0, 0, s * 1.5, -0.2, Math.PI + 0.2); c.stroke();
    c.restore();
  },
};
