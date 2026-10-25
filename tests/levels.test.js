const test = require('node:test');
const assert = require('node:assert');

require('../js/interpreter.js');
require('../js/world.js');
const CodeGame = require('../js/levels.js');

test('bölüm listesi boş değil ve kimlikler benzersiz', () => {
  assert.ok(CodeGame.LEVELS.length > 0);
  const ids = CodeGame.LEVELS.map((l) => l.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

for (const level of CodeGame.LEVELS) {
  test(`${level.id} – ${level.title}: harita geçerli`, () => {
    const width = level.map[0].length;
    for (const row of level.map) assert.strictEqual(row.length, width, 'satırlar eşit uzunlukta olmalı');
    const all = level.map.join('');
    assert.strictEqual(all.split('S').length - 1, 1, 'tam bir S olmalı');
    assert.strictEqual(all.split('G').length - 1, 1, 'tam bir G olmalı');
    assert.ok(['N', 'E', 'S', 'W'].includes(level.startDir));
  });

  test(`${level.id} – ${level.title}: çözüm kazanıyor ve par içinde`, () => {
    const world = new CodeGame.World(level);
    const ast = CodeGame.Interpreter.parse(level.solution);
    for (const _ of CodeGame.Interpreter.run(ast, world)) { /* adımları tüket */ }
    assert.ok(world.isWon(), 'çözüm bölümü kazanmalı');
    assert.ok(!world.crashed);
    assert.ok(CodeGame.Interpreter.countLines(level.solution) <= level.par, 'çözüm par sınırını aşıyor');
  });

  test(`${level.id} – ${level.title}: başlangıç kodu ayrıştırılabiliyor`, () => {
    CodeGame.Interpreter.parse(level.starterCode);
  });
}
