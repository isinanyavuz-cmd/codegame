import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, choicesFor, LETTERS } from '../src/content/predict.js';
import { SECTORS } from '../src/content/levels.js';
import { EXTRAS } from '../src/content/extras.js';
import { parseField, simulate, hasMeteor } from '../src/engine/world.js';

const all = Object.entries(ROUNDS).flatMap(([sector, rounds]) => rounds.map((r, i) => ({ ...r, name: `${sector}.${i + 1}`, i })));

test('tahmin turu: her sektörde üç soru ve bir tahmin görevi var', () => {
  for (const s of SECTORS) {
    assert.equal(ROUNDS[s.id]?.length, 3, `sektör ${s.id}`);
    const level = EXTRAS.find((x) => x.id === `${s.id}-t`);
    assert.ok(level?.tahmin && level.rounds === ROUNDS[s.id], `${s.id}-t`);
    assert.equal(level.waves.length, 3);
  }
});

test('tahmin turu: programlar çıkışa varmadan, alanın içinde ve beklenen karede biter', () => {
  for (const r of all) {
    const field = parseField(r.lines), res = simulate(field, r.program());
    assert.equal(res.outcome, 'fail', r.name);
    assert.ok(['ended', 'energy'].includes(res.reason), `${r.name}: ${res.reason}`);
    assert.deepEqual([res.ship.lane, res.ship.y], r.end, r.name);
    assert.ok(res.ship.y >= 1 && res.ship.y < field.rows, r.name);
  }
});

test('tahmin turu: üç ayrı seçenek var, biri doğru; hiçbiri meteorun ya da başlangıcın üstünde değil', () => {
  const spots = [0, 0, 0];
  for (const r of all) {
    const field = parseField(r.lines), { answer, choices, reason } = choicesFor(r.lines, r.program(), r.i);
    assert.equal(choices.length, LETTERS.length, r.name);
    assert.equal(new Set(choices.map((c) => `${c.lane},${c.y}`)).size, 3, r.name);
    assert.deepEqual([answer.lane, answer.y], r.end, r.name);
    assert.ok(['ended', 'energy'].includes(reason));
    for (const c of choices) {
      assert.ok(c.lane >= 0 && c.lane < field.lanes && c.y >= 1 && c.y < field.rows, r.name);
      assert.equal(hasMeteor(field, c.lane, c.y), false, r.name);
    }
    spots[choices.findIndex((c) => c.lane === answer.lane && c.y === answer.y)]++;
    // Aynı soru hep aynı sırayı verir (kimlikler değişse de).
    assert.deepEqual(choicesFor(r.lines, r.program(), r.i).choices, choices, r.name);
  }
  assert.ok(Math.min(...spots) >= 4, `doğru cevap hep aynı harfe düşmemeli: ${spots}`);
});

test('python bulmacası: doğru satır gemiyi çıkışa götürür, öteki iki satır götürmez', async () => {
  const { PY_ROUNDS, pythonChoices, fillHole } = await import('../src/content/predict.js');
  const { pythonLines } = await import('../src/engine/blocks.js');
  const level = EXTRAS.find((x) => x.id === '3-p');
  assert.ok(level?.tahmin && level.python && level.rounds === PY_ROUNDS);
  PY_ROUNDS.forEach((r, i) => {
    const program = r.program();
    assert.ok(pythonLines(program).some((l) => l.text.trim() === '____'), `${i}: boş satır`);
    const { choices, answer } = pythonChoices(r, i);
    assert.equal(new Set(choices.map((c) => c.text)).size, 3);
    choices.forEach((c, j) => {
      const res = simulate(parseField(r.lines), fillHole(program, c.block));
      assert.equal(res.outcome === 'win', j === answer, `${i}.${j} ${c.text}: ${res.outcome}`);
    });
    assert.deepEqual(pythonChoices(r, i).answer, answer);
  });
});
