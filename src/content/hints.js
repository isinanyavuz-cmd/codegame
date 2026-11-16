// Kademeli ipucu: çocuk takılınca Bip cevabı vermez, basamak basamak yaklaştırır.
//   1. basamak  görevin kendi ipucu cümlesi (yön gösterir)
//   2. basamak  örnek çözümde olup çocuğun programında eksik kalan ilk şey (hangi blok?)
//   3. basamak  örnek çözümün iskeleti: yapı görünür, her ikinci komut soru işaretidir (nereye?)
// Saf mantık; DOM yok.
import { CONTAINERS, CONDS, EVENTS, FUNCTIONS, toolLabel, uid } from '../engine/blocks.js';

const MOVES = ['fwd', 'left', 'right'];
const walk = (program, fn) => { for (const b of program) { fn(b); for (const k of CONTAINERS[b.type] || []) walk(b[k], fn); } };
function census(program) {
  const c = { types: {}, conds: {}, events: {}, names: {}, plain: true };
  const bump = (bag, key) => { if (key) bag[key] = (bag[key] || 0) + 1; };
  walk(program, (b) => {
    bump(c.types, b.type); bump(c.conds, b.cond); if (b.type === 'on') bump(c.events, b.event);
    if (b.type === 'define' || b.type === 'call') bump(c.names, `${b.type}:${b.name}`);
    if (!MOVES.includes(b.type)) c.plain = false;
  });
  return c;
}

/** 2. basamak: çocuğun programında eksik kalan ilk şeyi söyleyen cümle (**kalın** işaretli). */
export function missing(level, program) {
  const want = census(level.solution()), have = census(program);
  let text = null;
  walk(level.solution(), (b) => {
    if (text) return;
    const few = (bag, key) => (have[bag][key] || 0) < (want[bag][key] || 0);
    if (!MOVES.includes(b.type) && !have.types[b.type]) text = `Programında **${toolLabel(b.type)}** bloğu yok. Onu eklemeyi dene.`;
    else if (b.cond && !have.conds[b.cond]) text = `Şu sensöre ihtiyacın var: **${CONDS[b.cond].label}**`;
    else if (b.type === 'on' && !have.events[b.event]) text = `Beklenen olay **${EVENTS[b.event].label}** olmalı.`;
    else if ((b.type === 'define' || b.type === 'call') && few('names', `${b.type}:${b.name}`)) text = `**${FUNCTIONS[b.name].label}** manevrasını ${b.type === 'define' ? 'tanımlamalısın' : 'çağırmalısın'}.`;
    else if (!MOVES.includes(b.type) && few('types', b.type)) text = `Bir **${toolLabel(b.type)}** bloğu daha gerekiyor.`;
  });
  if (text) return text;
  // Yalnızca hareketlerden oluşan görevlerde sayılar karşılaştırılır.
  if (want.plain) {
    const n = (bag, t) => bag.types[t] || 0;
    const few = MOVES.find((t) => n(have, t) < n(want, t)), extra = MOVES.find((t) => n(have, t) > n(want, t));
    if (few) return `Bir **${toolLabel(few)}** daha gerekiyor: çözümde ${n(want, few)} tane var.`;
    if (extra) return `**${toolLabel(extra)}** bloğundan fazla koymuşsun: ${n(want, extra)} tane yetiyor.`;
    return 'Blokların hepsi doğru sayıda. Sıralarını kontrol et: hangisi önce çalışmalı?';
  }
  const number = [];
  walk(level.solution(), (b) => { if (typeof b.value === 'number') number.push(toolLabel(b.type)); else if (b.type === 'repeat') number.push('tekrarla'); });
  if (number.length) return `Gereken bloklar programında var. **${number[0]}** bloğundaki sayıya ve blokların sırasına bak.`;
  return 'Gereken bloklar programında var. Sıralarına ve hangisinin hangisinin içinde durduğuna bak.';
}

/** 3. basamak: örnek çözümün iskeleti. Yapı korunur, yaprak blokların her ikincisi "?" olur. */
export function skeleton(solution) {
  let leaf = 0;
  const copy = (list) => list.map((b) => {
    const keys = CONTAINERS[b.type];
    if (!keys) return leaf++ % 2 ? { id: uid(), type: 'gizli' } : { ...b, id: uid() };
    const c = { ...b, id: uid() };
    for (const k of keys) c[k] = copy(b[k]);
    return c;
  });
  return copy(solution);
}

/** Bu görevde kaç ipucu basamağı var (ipucu cümlesi yoksa birinci basamak atlanır). */
export const hintSteps = (level) => (level.hint ? 3 : 2);
