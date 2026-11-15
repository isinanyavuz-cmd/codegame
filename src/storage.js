// İlerleme kaydı: yıldızlar, çocuğun son programları ve ayarlar. Tarayıcıda saklanır.
const KEY = 'kodpilotu.v1';
let data = { stars: {}, programs: {}, intros: {}, sound: true, speed: 1 };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...data, ...JSON.parse(raw) };
} catch (e) { /* kayıt okunamadı; temiz başla */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* kayıt kapalı olabilir */ } };

export const store = {
  /** Adrese ?hepsi eklenirse bütün sahneler açılır (gözden geçirmek için). */
  unlockAll: typeof location !== 'undefined' && new URLSearchParams(location.search).has('hepsi'),
  stars: (id) => data.stars[id] || 0,
  setStars(id, n) { if (n > (data.stars[id] || 0)) { data.stars[id] = n; save(); } },
  total: () => Object.values(data.stars).reduce((a, b) => a + b, 0),
  program: (id) => data.programs[id] || null,
  setProgram(id, program) { data.programs[id] = program; save(); },
  introSeen: (sector) => !!data.intros[sector],
  markIntro(sector) { data.intros[sector] = true; save(); },
  get sound() { return data.sound; },
  set sound(v) { data.sound = !!v; save(); },
  get speed() { return data.speed; },
  set speed(v) { data.speed = v; save(); },
  isUnlocked(level, levels) {
    return level.index === 0 || this.unlockAll || this.stars(levels[level.index - 1].id) > 0;
  },
};
