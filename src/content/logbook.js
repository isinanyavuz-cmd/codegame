// Kaptan günlüğü: geçilen görevlerin gün gün dökümü ve oyuna dönüşteki karşılama cümlesi.
// Saf mantık; DOM yok.
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const midnight = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "Bugün", "Dün" ya da "14 Kasım". */
export function dayLabel(t, now = Date.now()) {
  const days = Math.round((midnight(now) - midnight(t)) / 86400000);
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Kayıtları günlere böler; en yeni gün başta, gün içinde en yeni kayıt başta. */
export function groupLog(log, now = Date.now()) {
  const groups = [];
  for (const e of [...log].sort((a, b) => b.t - a.t)) {
    const key = dayKey(e.t), last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e); else groups.push({ key, label: dayLabel(e.t, now), entries: [e] });
  }
  return groups;
}

/**
 * Oyuna yeni bir günde dönülünce söylenecek özet: en son oynanan günde ne oldu, sırada ne var.
 * Bugün zaten oynandıysa ya da hiç kayıt yoksa null döner.
 */
export function welcome(log, { levelById, sectorName, next }, now = Date.now()) {
  const wins = log.filter((e) => e.kind === 'win');
  if (!wins.length) return null;
  const [latest] = groupLog(wins, now);
  if (latest.label === 'Bugün') return null;
  const levels = [...new Set(latest.entries.map((e) => e.id))].map(levelById).filter(Boolean);
  if (!levels.length) return null;
  const stars = latest.entries.reduce((a, e) => a + (e.gain || 0), 0);
  const sectors = [...new Set(levels.map((l) => l.sector))].map(sectorName);
  const where = sectors.length === 1 ? `${sectors[0]} sektöründe` : `${sectors.length} sektörde`;
  const count = levels.length === 1 ? `**${levels[0].title}** görevini geçtin` : `${levels.length} görev geçtin`;
  const when = latest.label === 'Dün' ? 'Dün' : `${latest.label} günü`;
  return {
    text: `${when} ${where} ${count}${stars ? ` ve ${stars} yıldız topladın` : ''}.`,
    next: next ? `Sırada **${next.title}** var${next.kind === 'final' ? ': sektör finali!' : '.'}` : 'Bütün görevleri geçtin; eksik yıldızları toplayabilirsin.',
  };
}
