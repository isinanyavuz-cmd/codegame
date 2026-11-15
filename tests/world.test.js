import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseField, simulate, sense, stars } from '../src/engine/world.js';
import { F, L, R, rep, forever, ifelse, count, clone, find, remove, toPython } from '../src/engine/blocks.js';

const field = (lines) => parseField(lines);
const kinds = (res) => res.events.map((e) => e.t);

test('alan metinden okunur: ilk satır en uzak sıra', () => {
  const f = field(['.K.', '.M.', '..S']);
  assert.equal(f.lanes, 3); assert.equal(f.rows, 3); assert.equal(f.start, 2);
  assert.ok(f.meteors.has('1,1')); assert.ok(f.crystals.has('1,2'));
});

test('başlangıç karesi yoksa hata verir', () => {
  assert.throws(() => field(['...', '...']));
});

test('her komut gemiyi bir sıra ilerletir; son sırayı geçince kazanır', () => {
  const res = simulate(field(['...', '...', '.S.']), [F(), F(), F()]);
  assert.equal(res.outcome, 'win');
  assert.deepEqual(kinds(res), ['move', 'move', 'move', 'win']);
  assert.equal(res.ticks, 3);
});

test('kaçış blokları çapraz gider', () => {
  const res = simulate(field(['...', '.S.']), [L(), R()]);
  assert.deepEqual(res.events[0].to, { lane: 0, y: 1 });
  assert.equal(res.outcome, 'win');
});

test('meteora çarpınca durur ve sorumlu bloğu bildirir', () => {
  const bad = F();
  const res = simulate(field(['...', '.M.', '.S.']), [bad, F()]);
  assert.equal(res.outcome, 'crash'); assert.equal(res.reason, 'meteor');
  assert.equal(res.events.at(-1).id, bad.id);
});

test('şeridin dışına çıkmak çarpışmadır', () => {
  const res = simulate(field(['...', 'S..']), [L()]);
  assert.equal(res.outcome, 'crash'); assert.equal(res.reason, 'wall');
});

test('program erken biterse başarısız', () => {
  const res = simulate(field(['...', '...', '.S.']), [F()]);
  assert.equal(res.outcome, 'fail'); assert.equal(res.reason, 'ended');
  assert.equal(simulate(field(['...', '.S.']), []).reason, 'empty');
});

test('kristaller toplanır ve sayılır', () => {
  const res = simulate(field(['...', 'K..', '.K.', '.S.']), [F(), L(), F(), F()]);
  assert.equal(res.outcome, 'win'); assert.equal(res.collected, 2); assert.equal(res.total, 2);
  assert.equal(res.events[0].collect, true);
});

test('tekrarla gövdeyi sayı kadar çalıştırır', () => {
  const res = simulate(field(['...', '...', '...', '...', '.S.']), [rep(5, F())]);
  assert.equal(res.outcome, 'win'); assert.equal(res.ticks, 5);
});

test('sürekli döngü kazanınca durur', () => {
  const res = simulate(field(['...', '...', '...', '.S.']), [forever(F())]);
  assert.equal(res.outcome, 'win'); assert.equal(res.ticks, 4);
});

test('eğer/değilse sensöre göre dal seçer ve sense olayı üretir', () => {
  const res = simulate(field(['...', '.M.', '...', '.S.']), [forever(ifelse('ahead', [R()], [F()]))]);
  assert.equal(res.outcome, 'win');
  const senses = res.events.filter((e) => e.t === 'sense').map((e) => e.result);
  assert.deepEqual(senses, [false, true, false, false]);
  assert.deepEqual(res.events.filter((e) => e.t === 'move').map((e) => e.kind), ['fwd', 'right', 'fwd', 'fwd']);
});

test('hiç manevra yapmayan döngü "komut bekliyor" hatası verir', () => {
  const empty = simulate(field(['...', '.S.']), [forever()]);
  assert.equal(empty.reason, 'idle');
  const res = simulate(field(['...', '...', '.S.']), [forever(ifelse('ahead', [R()], []))]);
  assert.equal(res.outcome, 'fail'); assert.equal(res.reason, 'idle');
  assert.ok(res.events.length < 20, 'olay listesi şişmemeli');
});

test('koşulu olmayan eğer bloğu hata verir', () => {
  assert.equal(simulate(field(['...', '.S.']), [ifelse(null, [F()], [F()])]).reason, 'nocond');
});

test('yan sensörler duvarı dolu sayar', () => {
  const f = field(['M..', 'S..']);
  assert.equal(sense(f, 0, 0, 'leftFree').result, false);
  assert.equal(sense(f, 0, 0, 'rightFree').result, true);
  assert.equal(sense(f, 0, 0, 'ahead').result, true);
  assert.equal(sense(f, 1, 0, 'leftFree').result, false);
});

test('yıldızlar: geçmek 1, bütün kristaller +1, az blok +1', () => {
  const win = { outcome: 'win', collected: 2, total: 2 }, missed = { outcome: 'win', collected: 1, total: 2 };
  assert.equal(stars([win], 3, 3), 3);
  assert.equal(stars([win], 4, 3), 2);
  assert.equal(stars([missed], 3, 3), 2);
  assert.equal(stars([missed], 5, 3), 1);
  assert.equal(stars([win, { outcome: 'crash' }], 3, 3), 0);
});

test('blok ağacı işlemleri', () => {
  const inner = R();
  const prog = [F(), rep(2, L(), ifelse('ahead', [inner], [F()]))];
  assert.equal(count(prog), 6);
  assert.equal(find(prog, inner.id).block, inner);
  const copy = clone(prog);
  assert.equal(count(copy), 6); assert.notEqual(copy[0].id, prog[0].id);
  assert.equal(remove(prog, inner.id), inner); assert.equal(count(prog), 5);
});

test('Python görünümü', () => {
  const py = toPython([rep(3, F()), forever(ifelse('ahead', [R()], []))]);
  assert.equal(py, [
    'for i in range(3):', '    duz_uc()', 'while True:', '    if onumde_meteor_var():', '        saga_kac()', '    else:', '        pass',
  ].join('\n'));
});
