// İlerleme kaydı: yıldızlar, çocuğun programları, ayarlar ve oyunun biriktirdiği her şey
// (denemeler, mürettebat, gemi görünümü, otopilot kitaplığı, günlük). Tarayıcıda saklanır.
//
// Oyuncu profilleri: aynı cihazı kullanan her çocuğun kaydı ayrıdır. Profil listesi PROFILES
// anahtarında durur; ilk profilin kaydı eski anahtardadır (KEY), böylece eski kayıt ilk pilotun olur.
const KEY = 'kodpilotu.v1', PROFILES = 'kodpilotu.pilotlar';
const keyOf = (id) => (id === 'p1' ? KEY : `${KEY}.${id}`);
function readProfiles() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILES) || 'null');
    if (p && Array.isArray(p.list) && p.list.length && p.list.some((x) => x.id === p.active)) return p;
  } catch (e) { /* bozuk liste: tek profille başla */ }
  return { active: 'p1', list: [{ id: 'p1', name: '' }] };
}
let profiles = readProfiles();
const saveProfiles = () => { try { localStorage.setItem(PROFILES, JSON.stringify(profiles)); } catch (e) { /* kayıt kapalı olabilir */ } };

/**
 * Gizli inceleme modları (?hepsi, ?cozum). Bir görev açıkken adresin sonuna yazılınca
 * '#1-6?cozum' gibi bağlantı kısmına düşer; o da sayılır. Eski '#hepsi' (ve '#cozum') de geçerli.
 */
export function addressModes(search = '', hash = '') {
  const tail = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const words = new URLSearchParams(search), extra = new URLSearchParams(tail);
  const has = (k) => words.has(k) || extra.has(k) || hash === `#${k}`;
  const showSolutions = has('cozum');
  return { showSolutions, unlockAll: showSolutions || has('hepsi') };
}
const modes = typeof location === 'undefined' ? addressModes() : addressModes(location.search, location.hash);
const fresh = () => ({
  stars: {}, programs: {}, intros: {}, sound: true, music: true, speed: 1,
  voice: false,     // sesli okuma
  camera: 'ust',    // 'ust' ya da 'pilot'
  tries: {},        // görev başına deneme kaydı: { n, fails, streak, ms, reasons, first, last }
  skipped: {},      // sonraya bırakılan görevler
  crew: {},         // kurtarılan mürettebat
  seen: {},         // bir kez gösterilenler: hikâye kartları, rütbe törenleri, acil durumlar
  ship: {},         // hangarda seçilen görünüm
  lib: {},          // otopilot kitaplığı: çocuğun yazdığı fonksiyonlar
  best: {},         // görev başına rekor: { blocks, stars, paths }
  log: [],          // kaptan günlüğü
  daily: {},        // günün dalgası: { 'YYYY-AA-GG': yıldız }
  name: '',         // pilotun adı (sertifika için)
  workshop: null,   // atölyedeki tasarım: { lines, par, solved }
});
let data = fresh();
function load() {
  data = fresh();
  try {
    const raw = localStorage.getItem(keyOf(profiles.active));
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch (e) { /* kayıt okunamadı; temiz başla */ }
}
load();
const save = () => { try { localStorage.setItem(keyOf(profiles.active), JSON.stringify(data)); } catch (e) { /* kayıt kapalı olabilir */ } };
/** Profilin görünen adı: listedeki ad, yoksa kaydındaki pilot adı, yoksa "Pilot N". */
const nameOf = (p, i) => p.name || (p.id === profiles.active ? data.name : (() => { try { return JSON.parse(localStorage.getItem(keyOf(p.id)) || '{}').name || ''; } catch (e) { return ''; } })()) || `Pilot ${i + 1}`;

/** Yerel takvim günü: 'YYYY-AA-GG'. */
export const dayOf = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const store = {
  /** Gizli inceleme modları yalnızca adresten açılır; ilerleme kaydına yazılmaz. */
  showSolutions: modes.showSolutions,
  unlockAll: modes.unlockAll,
  stars: (id) => data.stars[id] || 0,
  setStars(id, n) { if (n > (data.stars[id] || 0)) { data.stars[id] = n; save(); } },
  total: () => Object.values(data.stars).reduce((a, b) => a + b, 0),
  program: (id) => data.programs[id] || null,
  setProgram(id, program) { if (!this.showSolutions) { data.programs[id] = program; save(); } },
  introSeen: (sector) => !!data.intros[sector],
  markIntro(sector) { data.intros[sector] = true; save(); },
  get sound() { return data.sound; },
  set sound(v) { data.sound = !!v; save(); },
  get music() { return data.music; },
  set music(v) { data.music = !!v; save(); },
  get speed() { return data.speed; },
  set speed(v) { data.speed = v; save(); },
  get voice() { return data.voice; },
  set voice(v) { data.voice = !!v; save(); },
  get camera() { return data.camera; },
  set camera(v) { data.camera = v; save(); },
  get name() { return data.name; },
  set name(v) { data.name = String(v).slice(0, 24); save(); },

  // ---------- görev kilidi ----------
  /** Görev geçilmiş sayılır mı: yıldız aldıysa, sonraya bırakıldıysa ya da yan yolundan geçildiyse. */
  passed(level) { return this.stars(level.id) > 0 || !!data.skipped[level.id] || (!!level.alt && this.stars(level.alt) > 0); },
  isUnlocked(level, levels) {
    if (this.unlockAll) return true;
    if (level.extra) return level.open(this, levels);
    return level.index === 0 || this.passed(levels[level.index - 1]);
  },
  isSkipped: (id) => !!data.skipped[id] && !(data.stars[id] > 0),
  skip(id) { data.skipped[id] = true; save(); },

  // ---------- denemeler (veli paneli ve "takıldı mı?" için) ----------
  /** Bir uçuşun sonucunu işler; görevin güncel deneme kaydını döndürür. */
  attempt(id, { won, reason = null, ms = 0 }) {
    const t = data.tries[id] || (data.tries[id] = { n: 0, fails: 0, streak: 0, ms: 0, reasons: {}, first: Date.now(), last: 0 });
    t.n++; t.ms += Math.max(0, Math.min(ms, 30 * 60000)); t.last = Date.now();
    if (won) t.streak = 0;
    else { t.fails++; t.streak++; if (reason) t.reasons[reason] = (t.reasons[reason] || 0) + 1; }
    save();
    return t;
  },
  tries: (id) => data.tries[id] || null,
  allTries: () => data.tries,

  // ---------- bir kez gösterilenler ----------
  seen: (key) => !!data.seen[key],
  markSeen(key) { if (!data.seen[key]) { data.seen[key] = true; save(); } },

  // ---------- mürettebat, gemi, kitaplık, rekor ----------
  hasCrew: (id) => !!data.crew[id],
  rescue(id) { if (data.crew[id]) return false; data.crew[id] = Date.now(); save(); return true; },
  crew: () => Object.keys(data.crew),
  get ship() { return data.ship; },
  setShip(part, value) { data.ship = { ...data.ship, [part]: value }; save(); },
  library: () => data.lib,
  /** Çocuğun yazdığı fonksiyonu kitaplığa koyar; aynı adlı eskisinin yerini alır. */
  keepFunction(name, body) { data.lib[name] = body; save(); },
  best: (id) => data.best[id] || null,
  setBest(id, record) { data.best[id] = record; save(); },

  // ---------- günlük ve günün dalgası ----------
  log: () => data.log,
  addLog(entry) { data.log.push({ t: Date.now(), ...entry }); if (data.log.length > 300) data.log = data.log.slice(-300); save(); },
  daily: (day) => data.daily[day] || 0,
  dailyDays: () => Object.keys(data.daily).length,
  setDaily(day, n) { if (n > (data.daily[day] || 0)) { data.daily[day] = n; save(); } },

  // ---------- atölye ----------
  get workshop() { return data.workshop; },
  set workshop(v) { data.workshop = v; save(); },
  /** Günün dalgası her gün yeni bir kimlik alır; eski günlerin program, deneme ve rekor kayıtları silinir. */
  prune(prefix, keep) {
    let changed = false;
    for (const bag of [data.programs, data.tries, data.best]) for (const k of Object.keys(bag)) if (k.startsWith(prefix) && k !== keep && !k.startsWith(`${keep}@`)) { delete bag[k]; changed = true; }
    if (changed) save();
  },

  // ---------- aktarma ----------
  /** İlerlemeyi başka cihaza taşımak için metin kodu. */
  exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  /** Kodu yükler; geçersizse false döner ve kayıt değişmez. */
  importCode(code) {
    try {
      const text = decodeURIComponent(escape(atob(String(code).trim().replace(/-/g, '+').replace(/_/g, '/'))));
      const next = JSON.parse(text);
      if (!next || typeof next !== 'object' || typeof next.stars !== 'object') return false;
      data = { ...fresh(), ...next }; save();
      return true;
    } catch (e) { return false; }
  },
  reset() { data = fresh(); save(); },

  // ---------- oyuncu profilleri ----------
  /** [{ id, name, active, stars }] */
  profiles() {
    return profiles.list.map((p, i) => {
      let stars = 0;
      try { const d = p.id === profiles.active ? data : JSON.parse(localStorage.getItem(keyOf(p.id)) || '{}'); stars = Object.values(d.stars || {}).reduce((a, b) => a + b, 0); } catch (e) { /* okunamadı */ }
      return { id: p.id, name: nameOf(p, i), active: p.id === profiles.active, stars };
    });
  },
  /** Yeni profil ekler ve ona geçer (en çok 6). Eklenemezse null döner. */
  addProfile(name) {
    const clean = String(name || '').trim().slice(0, 24);
    if (!clean || profiles.list.length >= 6) return null;
    let n = profiles.list.length + 1;
    while (profiles.list.some((p) => p.id === `p${n}`)) n++;
    const id = `p${n}`;
    profiles.list.push({ id, name: clean });
    this.switchProfile(id);
    data.name = clean; save();
    return id;
  },
  /** Başka profile geçer: o profilin kaydı yüklenir. */
  switchProfile(id) {
    if (!profiles.list.some((p) => p.id === id)) return false;
    profiles.active = id; saveProfiles(); load();
    return true;
  },
  get profileId() { return profiles.active; },
};
