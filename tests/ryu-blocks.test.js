const test = require('node:test');
const assert = require('node:assert');

require('../js/ryu/world.js');
const CodeGame = require('../js/ryu/blocks.js');
const { World, Blocks, BlockError } = CodeGame.Ryu;

const F = { type: 'forward' };
const P = { type: 'punch' };
const loop = (count, ...body) => ({ type: 'loop', count, body });
const K = { type: 'combo' };

function runAll(program, level, combo) {
  const world = new World(level);
  const steps = [...Blocks.run(program, world, { combo })];
  return { world, steps };
}

test('her hareket bir kez verilir; path ve olay doğru', () => {
  const { world, steps } = runAll([P, loop(3, F)], { map: ['SB..F', '#####'] });
  assert.deepStrictEqual(steps.map((s) => s.action), ['punch', 'forward', 'forward', 'forward']);
  assert.deepStrictEqual(steps[0].path, [0]);
  assert.deepStrictEqual(steps[2].path, [1, 0]);
  assert.strictEqual(steps[0].event.fx[0].kind, 'punch');
  assert.strictEqual(steps[3].event.result, 'ok');
  assert.strictEqual(world.state, 'play'); // bayrak 4. karede, 3 adım yetmez
});

test('bayrağa varınca kalan bloklar çalışmaz', () => {
  const { world, steps } = runAll([loop(9, F), P], { map: ['S..F..', '######'] });
  assert.strictEqual(steps.length, 3);
  assert.ok(world.isWon());
});

test('düşünce ya da takılınca durur', () => {
  const fall = runAll([F, F, F], { map: ['S..F', '#.##'] });
  assert.strictEqual(fall.steps.length, 1);
  assert.strictEqual(fall.world.reason, 'fall');
  const wall = runAll([F, F], { map: ['S=.F', '####'] });
  assert.strictEqual(wall.steps.length, 1);
  assert.strictEqual(wall.world.reason, 'wall');
});

test('kombo çağrısı tanımı çalıştırır, yollar k ile başlar', () => {
  const combo = [P, F];
  const { world, steps } = runAll([loop(2, K)], { map: ['SBB.F', '#####'] }, combo);
  assert.deepStrictEqual(steps.map((s) => s.action), ['punch', 'forward', 'punch', 'forward']);
  assert.deepStrictEqual(steps[1].path, ['k', 1]);
  assert.deepStrictEqual(steps[1].calls, [[0, 0]]);
  assert.strictEqual(world.ryu.x, 2);
});

test('kombo tanımsızsa ya da kendini çağırırsa hata', () => {
  assert.throws(() => runAll([K], { map: ['S.F', '###'] }), (e) => e instanceof BlockError && e.path.join() === '0');
  assert.throws(() => runAll([K], { map: ['S.F', '###'] }, [K]), /kendini/);
});

test('bilinmeyen blok ve adım sınırı', () => {
  assert.throws(() => runAll([{ type: 'uç' }], { map: ['S.F', '###'] }), /Bilinmeyen/);
  const world = new World({ map: ['.SE..F', '######'] });
  const many = [loop(9, loop(9, loop(9, P)))];
  // patron düşmanı 3 vuruşta düşer, sonra boşa vuruşlar sürer
  assert.throws(() => [...Blocks.run(many, world, { maxSteps: 50 })], /Çok fazla adım/);
});

test('count ve usesCombo', () => {
  assert.strictEqual(Blocks.count([]), 0);
  assert.strictEqual(Blocks.count([F, loop(2, P, loop(3, F))]), 5);
  assert.strictEqual(Blocks.usesCombo([F, loop(2, K)]), true);
  assert.strictEqual(Blocks.usesCombo([F, loop(2, P)]), false);
});
