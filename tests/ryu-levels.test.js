const test = require('node:test');
const assert = require('node:assert');

require('../js/ryu/world.js');
require('../js/ryu/blocks.js');
const CodeGame = require('../js/ryu/levels.js');
const { World, Blocks, LEVELS } = CodeGame.Ryu;

const TOOLS = Blocks.MOVES.concat('loop', 'combo');
const THEMES = ['day', 'sunset', 'night', 'cave', 'castle'];
const COMBO_MAX = 4;

function usedTypes(program, out = new Set()) {
  for (const b of program || []) {
    out.add(b.type);
    if (b.type === 'loop') usedTypes(b.body, out);
  }
  return out;
}

/** Kombo çağrılarını tanımla değiştirip blok sayar (kombosuz yazılsa kaç blok olurdu). */
function inlineCount(program, combo) {
  let n = 0;
  for (const b of program) {
    if (b.type === 'combo') n += Blocks.count(combo);
    else if (b.type === 'loop') n += 1 + inlineCount(b.body, combo);
    else n++;
  }
  return n;
}

test('bölüm listesi boş değil ve kimlikler benzersiz', () => {
  assert.ok(LEVELS.length >= 15);
  const ids = LEVELS.map((l) => l.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

for (const level of LEVELS) {
  test(`${level.id} – ${level.title}`, () => {
    const width = level.map[0].length;
    for (const row of level.map) assert.strictEqual(row.length, width, 'satırlar eşit uzunlukta olmalı');
    assert.ok(THEMES.includes(level.theme), 'tema ' + level.theme);
    for (const t of level.tools) assert.ok(TOOLS.includes(t), 'bilinmeyen araç ' + t);
    for (const t of usedTypes(level.solution)) assert.ok(level.tools.includes(t), 'çözüm paletde olmayan blok kullanıyor: ' + t);

    if (level.combo) {
      assert.ok(level.tools.includes('combo'), 'kombo tanımı var ama araç yok');
      assert.ok(Blocks.count(level.combo) <= COMBO_MAX, 'kombo en fazla 4 blok');
      assert.ok(!usedTypes(level.combo).has('combo'), 'kombo kendini çağıramaz');
      for (const t of usedTypes(level.combo)) assert.ok(level.tools.includes(t), 'kombo paletde olmayan blok kullanıyor: ' + t);
      assert.ok(inlineCount(level.solution, level.combo) > level.maxBlocks, 'kombosuz çözüm sınıra sığıyor');
    }

    const n = Blocks.count(level.solution) + Blocks.count(level.combo || []);
    assert.ok(n <= level.par, `çözüm ${n} blok, par ${level.par}`);
    assert.ok(level.par <= level.maxBlocks);

    const world = new World(level);
    for (const _ of Blocks.run(level.solution, world, { combo: level.combo })) { /* oynat */ }
    assert.ok(world.isWon(), 'çözüm bölümü kazanmalı');
  });
}
