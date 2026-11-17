// Tahmin turu: çocuk program yazmaz; hazır programı okur ve "program bitince gemi hangi
// karede olur?" sorusunu cevaplar. Her sektörde üç soru vardır ve o sektörün kavramını
// okutur. Programlar çıkışa varmaz: ya komutları biter ya enerjileri; gemi alanın içinde durur.
// Saf veri ve mantık; DOM yok.
import { F, L, R, rep, forever, ifelse, until, on, shield, setEnergy, addEnergy, define, call, CONTAINERS, uid } from '../engine/blocks.js';
import { parseField, simulate, hasMeteor } from '../engine/world.js';
import { rng } from '../engine/rng.js';

/** Alanı çizer. `things`: { M: [[şerit, sıra], …], B, K, P, E } */
function grid(lanes, rows, start, things = {}) {
  const board = Array.from({ length: rows }, () => Array(lanes).fill('.'));
  for (const [symbol, cells] of Object.entries(things)) for (const [lane, y] of cells) board[y][lane] = symbol;
  board[0][start] = 'S';
  return board.reverse().map((r) => r.join(''));
}
/** @param end  programın bittiği kare [şerit, sıra]; testler bunu doğrular */
const round = (lines, program, end) => ({ lines, program, end });

/** Sektör → üç soru. */
export const ROUNDS = {
  1: [
    round(grid(5, 7, 2, { M: [[1, 2], [4, 3], [0, 5]] }), () => [F(), F(), R(), F()], [3, 4]),
    round(grid(5, 7, 2, { M: [[1, 1], [2, 4], [0, 3]] }), () => [R(), R(), F(), L(), F()], [3, 5]),
    round(grid(5, 8, 2, { M: [[3, 2], [4, 5], [0, 5], [3, 6]] }), () => [L(), F(), L(), R(), R(), F()], [2, 6]),
  ],
  2: [
    round(grid(5, 6, 0, { M: [[0, 2], [4, 1], [2, 4]] }), () => [rep(3, R())], [3, 3]),
    round(grid(5, 7, 3, { M: [[4, 2], [0, 3], [3, 4]] }), () => [rep(2, F(), L()), F()], [1, 5]),
    round(grid(5, 8, 1, { M: [[1, 3], [4, 4], [0, 6]] }), () => [rep(2, R()), rep(3, F()), L()], [2, 6]),
  ],
  3: [
    round(grid(5, 7, 1, { M: [[1, 2], [2, 4], [4, 1]] }), () => [rep(4, ifelse('ahead', [R()], [F()]))], [3, 4]),
    round(grid(5, 7, 3, { M: [[3, 1], [2, 3], [0, 2]] }), () => [rep(5, ifelse('ahead', [L()], [F()]))], [1, 5]),
    round(grid(5, 7, 2, { M: [[2, 1], [3, 1], [1, 3], [4, 4]] }), () => [rep(4, ifelse('ahead', [ifelse('rightFree', [R()], [L()])], [F()]))], [2, 4]),
  ],
  4: [
    round(grid(5, 7, 1, { B: [[1, 3]], M: [[3, 2], [0, 5]] }), () => [until('atBeacon', F()), R(), F()], [2, 5]),
    round(grid(5, 7, 0, { B: [[2, 2]], M: [[4, 3], [0, 4]] }), () => [until('atBeacon', R()), F(), F()], [2, 4]),
    round(grid(5, 8, 3, { B: [[3, 2], [2, 5]], M: [[0, 3], [4, 4]] }), () => [until('atBeacon', F()), L(), until('atBeacon', F()), R()], [3, 6]),
  ],
  5: [
    round(grid(5, 7, 1, { B: [[1, 2]], M: [[3, 3], [0, 5]] }), () => [on('beacon', R()), rep(4, F())], [2, 5]),
    round(grid(5, 7, 3, { K: [[3, 1], [2, 3]], M: [[0, 2], [4, 5]] }), () => [on('crystal', L()), rep(3, F())], [1, 5]),
    round(grid(5, 7, 1, { P: [[1, 2]], B: [[1, 3]], M: [[4, 2], [0, 5]] }), () => [on('pirate', shield()), on('beacon', R()), rep(4, F())], [2, 5]),
  ],
  6: [
    round(grid(5, 8, 2, { E: [[0, 6]], M: [[4, 3], [1, 5]] }), () => [setEnergy(4), rep(6, F())], [2, 4]),
    round(grid(5, 8, 1, { E: [[1, 2]], M: [[3, 4], [0, 6]] }), () => [setEnergy(2), rep(2, F()), addEnergy(3), rep(4, F())], [1, 5]),
    round(grid(5, 8, 2, { E: [[2, 2]], M: [[0, 3], [4, 5]] }), () => [setEnergy(3), forever(ifelse('atEnergy', [addEnergy(2)], []), F())], [2, 5]),
  ],
  7: [
    round(grid(5, 7, 1, { M: [[3, 3], [0, 5]] }), () => [define('zigzag', R(), L()), rep(2, call('zigzag')), F()], [1, 5]),
    round(grid(5, 7, 1, { M: [[3, 2], [0, 4]] }), () => [define('straight', F(), F()), call('straight'), R(), call('straight')], [2, 5]),
    round(grid(5, 9, 0, { M: [[3, 3], [2, 6], [4, 7]] }), () => [define('zigzag', R(), L()), define('straight', F(), F()), call('zigzag'), call('straight'), call('zigzag'), R()], [1, 7]),
  ],
  8: [
    round(grid(5, 8, 2, { B: [[2, 2]], E: [[1, 5]], M: [[4, 3], [0, 6]] }), () => [setEnergy(8), on('beacon', L()), until('atEnergy', F()), R()], [2, 6]),
    round(grid(5, 7, 1, { M: [[1, 2], [2, 4], [4, 1]] }), () => [define('safe', ifelse('ahead', [R()], [F()])), rep(5, call('safe'))], [3, 5]),
    round(grid(5, 9, 3, { M: [[3, 2], [0, 5]], E: [[2, 4]] }), () => [setEnergy(5), on('energy', addEnergy(2)), forever(ifelse('ahead', [L()], [F()]))], [2, 7]),
  ],
};

const SWAP = { left: 'right', right: 'left' };
/** Programın "yanlış okunmuş" halleri: bir kaçış ters çevrilmiş, bir sayı bir eksik/fazla, bir karar ters, bir komut atlanmış. */
function misreadings(program) {
  const out = [], ids = [];
  const walk = (list) => { for (const b of list) { ids.push(b.id); for (const k of CONTAINERS[b.type] || []) walk(b[k]); } };
  walk(program);
  const edit = (list, id, fn) => list.flatMap((b) => {
    if (b.id === id) return fn(b);
    const c = { ...b };
    for (const k of CONTAINERS[b.type] || []) c[k] = edit(b[k], id, fn);
    return [c];
  });
  const find = (list, id) => { for (const b of list) { if (b.id === id) return b; for (const k of CONTAINERS[b.type] || []) { const hit = find(b[k], id); if (hit) return hit; } } return null; };
  for (const id of ids) {
    const b = find(program, id);
    if (SWAP[b.type]) out.push(edit(program, id, (x) => [{ ...x, type: SWAP[x.type] }]));
    if (b.type === 'repeat') for (const d of [-1, 1]) if (b.count + d >= 1) out.push(edit(program, id, (x) => [{ ...x, count: x.count + d }]));
    if (b.type === 'ifelse') out.push(edit(program, id, (x) => [{ ...x, then: x.else, else: x.then }]));
    if (typeof b.value === 'number') for (const d of [-1, 1]) if (b.value + d >= 0 && b.value + d <= 9) out.push(edit(program, id, (x) => [{ ...x, value: x.value + d }]));
    if (['fwd', 'left', 'right'].includes(b.type)) out.push(edit(program, id, () => []));
    if (b.type === 'on') out.push(edit(program, id, () => []));
  }
  return out;
}

/**
 * Bir sorunun cevabı ve seçenekleri. Yanıltıcılar, programın yanlış okunmuş hallerinin
 * vardığı karelerdir; yetmezse doğru karenin komşuları eklenir.
 * @returns {{ answer: {lane, y}, choices: [{lane, y}], reason }}  choices karışık sıradadır (A, B, C)
 */
export function choicesFor(lines, program, seed = 0) {
  const field = parseField(lines), end = simulate(field, program), answer = end.ship;
  const same = (a, b) => a.lane === b.lane && a.y === b.y;
  const wrong = [];
  const add = (c) => {
    if (c.lane < 0 || c.lane >= field.lanes || c.y < 1 || c.y >= field.rows) return;
    if (same(c, answer) || wrong.some((w) => same(w, c)) || hasMeteor(field, c.lane, c.y)) return;
    wrong.push({ lane: c.lane, y: c.y });
  };
  for (const m of misreadings(program)) { const r = simulate(field, m); if (r.outcome !== 'win') add(r.ship); }
  for (const [dl, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) add({ lane: answer.lane + dl, y: answer.y + dy });
  // En yakın iki yanıltıcı seçilir: uzak kareler kolay elenir.
  wrong.sort((a, b) => (Math.abs(a.lane - answer.lane) + Math.abs(a.y - answer.y)) - (Math.abs(b.lane - answer.lane) + Math.abs(b.y - answer.y)));
  // Karıştırma alanın içeriğine bağlıdır: aynı soru hep aynı sırayı verir, sorular arasında sıra değişir.
  let hash = seed + 1;
  for (const ch of lines.join('|')) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  const choices = [answer, ...wrong.slice(0, 2)], next = rng(hash);
  for (let i = 0; i < 3; i++) next();
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { answer, choices, reason: end.reason };
}

export const LETTERS = ['A', 'B', 'C'];
/** Programa yeni kimlikler verilmiş bir kopya (aynı soru yeniden açılınca). */
export const fresh = (program) => program.map((b) => { const c = { ...b, id: uid() }; for (const k of CONTAINERS[b.type] || []) c[k] = fresh(b[k]); return c; });
