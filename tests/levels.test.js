import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, SECTORS, KINDS, levelsOf } from '../src/content/levels.js';
import { parseField, simulate, stars } from '../src/engine/world.js';
import { count, CONTAINERS, F, forever } from '../src/engine/blocks.js';

const run = (level, program) => level.waves.map((w) => simulate(parseField(w), program));
const starsOf = (level, program) => stars(run(level, program), count(program), level.par);

function used(program, types = new Set(), conds = new Set()) {
  for (const b of program) {
    types.add(b.type);
    if (b.cond) conds.add(b.cond);
    for (const k of CONTAINERS[b.type] || []) used(b[k], types, conds);
  }
  return { types, conds };
}

test('oynanabilir her sektörde 8 sahne var ve sıra tanış → final', () => {
  const playable = SECTORS.filter((s) => !s.soon);
  assert.equal(LEVELS.length, playable.length * 8);
  for (const s of playable) {
    assert.deepEqual(levelsOf(s.id).map((l) => l.kind), ['tanis', 'dene', 'dene', 'pekistir', 'pekistir', 'pekistir', 'hata', 'final']);
    assert.ok(s.intro && s.intro.title && s.intro.text);
  }
  for (const l of LEVELS) assert.ok(KINDS[l.kind]);
});

for (const level of LEVELS) {
  test(`${level.id} ${level.title}: örnek çözüm bütün dalgaları 3 yıldızla geçer`, () => {
    const sol = level.solution();
    assert.equal(starsOf(level, sol), 3);
    assert.equal(count(sol), level.par, 'par, örnek çözümün blok sayısıdır');
    assert.ok(count(sol) <= level.maxBlocks);
  });

  test(`${level.id}: palet çözüm için yeterli`, () => {
    const { types, conds } = used(level.solution());
    for (const t of types) assert.ok(level.tools.includes(t), `palette ${t} yok`);
    for (const c of conds) assert.ok(level.conds.includes(c), `koşul ${c} yok`);
    if (level.initial) {
      const u = used(level.initial());
      for (const t of u.types) assert.ok(level.tools.includes(t));
      assert.ok(count(level.initial()) <= level.maxBlocks);
    }
  });

  test(`${level.id}: başlangıç programı işi çocuğa bırakır`, () => {
    if (level.watch) { assert.equal(starsOf(level, level.initial()), 3); return; }
    if (level.initial) assert.equal(starsOf(level, level.initial()), 0, 'hazır program zaten geçiyor');
    assert.equal(starsOf(level, []), 0);
  });

  test(`${level.id}: alanlar tutarlı`, () => {
    const fields = level.waves.map(parseField);
    for (const f of fields) {
      assert.equal(f.lanes, fields[0].lanes); assert.equal(f.rows, fields[0].rows); assert.equal(f.start, fields[0].start);
      assert.ok(f.lanes >= 3 && f.lanes <= 5); assert.ok(f.rows <= 12);
    }
    assert.ok(level.brief.length < 190, 'görev metni kısa olmalı');
  });
}

test('Sektör 2: döngüsüz çözüm blok sınırına sığmaz', () => {
  for (const level of levelsOf(2)) {
    const rows = parseField(level.waves[0]).rows;
    assert.ok(rows > level.maxBlocks, `${level.id}: ${rows} sıra, sınır ${level.maxBlocks}`);
  }
});

test('Sektör 3: üç farklı dalga var ve düz uçmak hiçbirini geçmez', () => {
  for (const level of levelsOf(3)) {
    assert.equal(level.waves.length, 3);
    assert.equal(new Set(level.waves.map((w) => w.join())).size, 3);
    for (const r of run(level, [forever(F())])) assert.notEqual(r.outcome, 'win');
  }
});

test('Sektör 3: tek dalganın ezber çözümü öteki dalgaları geçmez', () => {
  for (const level of levelsOf(3)) {
    const first = simulate(parseField(level.waves[0]), level.solution());
    const memo = first.events.filter((e) => e.t === 'move').map((e) => ({ id: 'x', type: e.kind }));
    const results = run(level, memo);
    assert.equal(results[0].outcome, 'win');
    assert.ok(results.slice(1).some((r) => r.outcome !== 'win'), `${level.id}: ezber işliyor`);
  }
});

test('Sektör 3: iki sensörlü sahnelerde tek yöne kaçmak yetmez', () => {
  for (const level of levelsOf(3).filter((l) => l.conds.includes('rightFree'))) {
    const one = (type) => [forever({ id: 'i', type: 'ifelse', cond: 'ahead', then: [{ id: 'a', type }], else: [F()] })];
    assert.equal(starsOf(level, one('right')), 0);
    assert.equal(starsOf(level, one('left')), 0);
  }
});
