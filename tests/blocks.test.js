const test = require('node:test');
const assert = require('node:assert');

require('../js/world.js');
const CodeGame = require('../js/blocks.js');

const corridor = { map: ['#######', '#S*..G#', '#######'], startDir: 'E' };

function runAll(program, level) {
  const world = new CodeGame.World(level);
  const steps = [...CodeGame.Blocks.run(program, world)];
  return { world, steps };
}

test('her eylem bir kez yield edilir, path doğru', () => {
  const { world, steps } = runAll([
    { type: 'move' },
    { type: 'pick' },
    { type: 'loop', count: 3, body: [{ type: 'move' }] },
  ], corridor);
  assert.deepStrictEqual(steps.map((s) => s.action), ['move', 'pick', 'move', 'move', 'move']);
  assert.deepStrictEqual(steps[0].path, [0]);
  assert.deepStrictEqual(steps[2].path, [2, 0]);
  assert.ok(world.isWon());
});

test('dönüşler ve iç içe döngü', () => {
  const level = { map: ['#####', '#S..#', '#...#', '#..G#', '#####'], startDir: 'E' };
  const { world, steps } = runAll([
    { type: 'loop', count: 2, body: [
      { type: 'move' }, { type: 'right' }, { type: 'move' }, { type: 'left' },
    ] },
  ], level);
  assert.strictEqual(steps.length, 8);
  assert.deepStrictEqual(steps[5].path, [0, 1]);
  assert.ok(world.atGoal());
});

test('duvara çarpınca BlockError ve path', () => {
  const world = new CodeGame.World(corridor);
  const gen = CodeGame.Blocks.run([{ type: 'left' }, { type: 'move' }], world);
  gen.next();
  assert.throws(() => gen.next(), (e) => e instanceof CodeGame.BlockError && e.path.join() === '1');
  assert.ok(world.crashed);
});

test('elmas yokken topla hata verir', () => {
  assert.throws(() => runAll([{ type: 'pick' }], corridor), (e) => e instanceof CodeGame.BlockError && e.path.join() === '0');
});

test('adım sınırı', () => {
  const level = { map: ['####', '#SG#', '####'], startDir: 'E' };
  const spin = [{ type: 'loop', count: 9, body: [{ type: 'loop', count: 9, body: [{ type: 'loop', count: 9, body: [{ type: 'left' }] }] }] }];
  assert.throws(() => runAll(spin, level), /Çok fazla adım/);
});

test('count döngüleri ve gövdeleri sayar', () => {
  assert.strictEqual(CodeGame.Blocks.count([]), 0);
  assert.strictEqual(CodeGame.Blocks.count([
    { type: 'move' },
    { type: 'loop', count: 2, body: [{ type: 'move' }, { type: 'loop', count: 2, body: [{ type: 'left' }] }] },
  ]), 5);
});
