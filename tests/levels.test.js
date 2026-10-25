const test = require('node:test');
const assert = require('node:assert');

require('../js/world.js');
require('../js/blocks.js');
const CodeGame = require('../js/levels.js');

const TOOLS = ['move', 'left', 'right', 'pick', 'loop'];

function usedTypes(program, out = new Set()) {
  for (const b of program) {
    out.add(b.type);
    if (b.type === 'loop') usedTypes(b.body, out);
  }
  return out;
}

test('bölüm listesi boş değil ve kimlikler benzersiz', () => {
  assert.ok(CodeGame.LEVELS.length > 0);
  const ids = CodeGame.LEVELS.map((l) => l.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

for (const level of CodeGame.LEVELS) {
  test(`${level.id} – ${level.title}`, () => {
    const width = level.map[0].length;
    for (const row of level.map) assert.strictEqual(row.length, width, 'satırlar eşit uzunlukta olmalı');
    for (const t of level.tools) assert.ok(TOOLS.includes(t), 'bilinmeyen araç ' + t);
    for (const t of usedTypes(level.solution)) assert.ok(level.tools.includes(t), 'çözüm paletde olmayan blok kullanıyor: ' + t);

    const n = CodeGame.Blocks.count(level.solution);
    assert.ok(n <= level.par, `çözüm ${n} blok, par ${level.par}`);
    assert.ok(level.par <= level.maxBlocks);

    const world = new CodeGame.World(level);
    for (const _ of CodeGame.Blocks.run(level.solution, world)) { /* tüket */ }
    assert.ok(world.isWon(), 'çözüm bölümü kazanmalı');
  });
}
