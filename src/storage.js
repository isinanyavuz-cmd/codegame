// İlerleme kaydı: yıldızlar, çocuğun programları, ayarlar ve oyunun biriktirdiği her şey
// (denemeler, mürettebat, gemi görünümü, otopilot kitaplığı, günlük). Tarayıcıda saklanır.
const KEY = 'kodpilotu.v1';
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
});
let data = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...data, ...JSON.parse(raw) };
} catch (e) { /* kayıt okunamadı; temiz başla */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* kayıt kapalı olabilir */ } };

/** Yerel takvim günü: 'YYYY-AA-GG'. */
export const dayOf = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const store = {
  /** Adrese ?hepsi ya da #hepsi eklenirse bütün sahneler açılır (gözden geçirmek için). */
  unlockAll: typeof location !== 'undefined' && (new URLSearchParams(location.search).has('hepsi') || location.hash === '#hepsi'),
  stars: (id) => data.stars[id] || 0,
  setStars(id, n) { if (n > (data.stars[id] || 0)) { data.stars[id] = n; save(); } },
  total: () => Object.values(data.stars).reduce((a, b) => a + b, 0),
  program: (id) => data.programs[id] || null,
  setProgram(id, program) { data.programs[id] = program; save(); },
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
};
