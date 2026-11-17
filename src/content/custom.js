// Atölye: çocuğun kendi kurduğu görevler. Alan bir metin koduna çevrilir; kod bağlantının
// ucuna eklenince (#oyna=...) görev başkasıyla paylaşılır. Saf mantık; DOM yok.
import { parseField } from '../engine/world.js';
import { MOVES } from './advanced.js';

export const SIZE = { lanes: [3, 5], rows: [5, 12] };
/** Atölyede karelere konabilenler (sırayla): boş, meteor, kristal, mor halka, korsan, şarj istasyonu. */
export const PIECES = [
  { ch: '.', name: 'Sil' }, { ch: 'M', name: 'Meteor' }, { ch: 'K', name: 'Kristal' },
  { ch: 'B', name: 'Mor halka' }, { ch: 'P', name: 'Korsan' }, { ch: 'E', name: 'Şarj' },
];

/** Boş alan: gemi alt sıranın ortasında. */
export function blankField(lanes = 5, rows = 8) {
  const start = Math.floor(lanes / 2);
  return [...Array.from({ length: rows - 1 }, () => '.'.repeat(lanes)), '.'.repeat(start) + 'S' + '.'.repeat(lanes - start - 1)];
}

/** Alanı bağlantıya konabilecek kısa bir koda çevirir: satırlar "-" ile, çözümün blok sayısı "~" ile eklenir. */
export const encodeField = (lines, par) => `${lines.join('-')}~${par}`;

/** Kodu çözer; geçersizse null döner (elle bozulmuş ya da yarım kopyalanmış bağlantı). */
export function decodeField(code) {
  const m = /^([.MKBPES-]+)~(\d{1,2})$/.exec(String(code || ''));
  if (!m) return null;
  const lines = m[1].split('-'), par = Number(m[2]);
  try {
    const f = parseField(lines);
    if (f.lanes < SIZE.lanes[0] || f.lanes > SIZE.lanes[1] || f.rows < SIZE.rows[0] || f.rows > SIZE.rows[1] || par < 1) return null;
  } catch (e) { return null; }
  return { lines, par };
}

/** Meteorlara çarpmadan çıkışa varan bir yol var mı? (Korsan ve enerji hesaba katılmaz: onlar programla aşılır.) */
export function hasRoute(lines) {
  const f = parseField(lines);
  let lanes = new Set([f.start]);
  for (let y = 1; y < f.rows && lanes.size; y++) {
    const next = new Set();
    for (const lane of lanes) for (const d of [-1, 0, 1]) { const l = lane + d; if (l >= 0 && l < f.lanes && !f.meteors.has(`${l},${y}`)) next.add(l); }
    lanes = next;
  }
  return lanes.size > 0;
}

/**
 * Alandan oynanabilir görev kurar. Palet alanın içindekilere göre belirlenir.
 * @param o.par   üç yıldız için blok hedefi (kuranın çözümü); bilinmiyorsa blok yıldızı verilmez
 * @param o.own   çocuğun kendi görevi mi (atölyeden), yoksa bağlantıyla gelen mi
 * @param o.library  kitaplıktaki manevra adları: kendi yazdığı manevraları burada da çağırabilir
 */
export function customLevel(lines, { par = null, own = true, library = [] } = {}) {
  const f = parseField(lines);
  const tools = [...MOVES, 'repeat', 'forever', 'ifelse'], conds = ['ahead', 'rightFree', 'leftFree'], events = [];
  if (f.beacons.size) { tools.push('until'); conds.push('atBeacon'); }
  if (f.pirates.size || f.energyCells.size) tools.push('on');
  if (f.pirates.size) { tools.push('shield'); events.push('pirate'); }
  if (f.energyCells.size) { tools.push('setEnergy', 'addEnergy'); conds.push('atEnergy', 'energyLow'); events.push('energy'); }
  if (tools.includes('on')) { if (f.beacons.size) events.push('beacon'); if (f.crystals.size) events.push('crystal'); }
  const code = encodeField(lines, par ?? 0), id = own ? 'atolye' : `oyna-${code}`;
  return {
    id, saveKey: id, hash: own ? 'atolye' : `oyna=${code}`, extra: 'atolye', kind: 'atolye', free: true, own, library: true,
    // Görünüm: enerji varsa Enerji Krizi, korsan varsa Korsan Bölgesi, halka varsa Bulutsu, yoksa Meteor Yağmuru.
    sector: f.energyCells.size ? 6 : f.pirates.size ? 5 : f.beacons.size ? 4 : 3, chip: own ? 'Kendi görevin' : 'Paylaşılan görev',
    title: own ? 'Kendi Görevim' : 'Arkadaşının Görevi',
    brief: own ? 'Bu görevi sen kurdun. Önce kendin çöz: çözebildiğin görevi paylaşabilirsin.' : 'Bu görevi bir arkadaşın kurdu ve kendi programıyla çözdü. Sen de çözebilir misin?',
    hint: 'Yolu önce gözünle çiz. Meteorlar için sensörleri, korsanlar ve şarj için olayları kullanabilirsin.',
    waves: [lines], tools, conds, events, functions: library, maxBlocks: 30, par: par || 0, solution: null,
  };
}
