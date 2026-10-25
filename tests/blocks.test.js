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
    { type: 'right' },
    { type: 'pick' },
    { type: 'loop', count: 3, body: [{ type: 'right' }] },
  ], corridor);
  assert.deepStrictEqual(steps.map((s) => s.action), ['move', 'pick', 'move', 'move', 'move']);
  assert.deepStrictEqual(steps[0].path, [0]);
  assert.deepStrictEqual(steps[2].path, [2, 0]);
  assert.ok(world.isWon());
});

test('oklar robotun baktığı yönden bağımsız olarak ekrana göre çalışır', () => {
  const level = { map: ['#####', '#...#', '#.S.#', '#...#', '#G###'], startDir: 'N' };
  const world = new CodeGame.World(level);
  const moves = { up: [2, 1], down: [2, 2], left: [1, 2], right: [2, 2] };
  for (const [type, [x, y]] of Object.entries(moves)) {
    const gen = CodeGame.Blocks.run([{ type }], world);
    gen.next();
    assert.deepStrictEqual([world.robot.x, world.robot.y], [x, y], type);
  }
  assert.strictEqual(world.robot.dir, 'E');
});

test('merdiven döngüsü', () => {
  const level = { map: ['#####', '#S..#', '#...#', '#..G#', '#####'], startDir: 'E' };
  const { world, steps } = runAll([{ type: 'loop', count: 2, body: [{ type: 'right' }, { type: 'down' }] }], level);
  assert.strictEqual(steps.length, 4);
  assert.deepStrictEqual(steps[3].path, [0, 1]);
  assert.ok(world.atGoal());
});

test('suya düşünce BlockError ve path', () => {
  const world = new CodeGame.World(corridor);
  const gen = CodeGame.Blocks.run([{ type: 'right' }, { type: 'up' }], world);
  gen.next();
  assert.throws(() => gen.next(), (e) => e instanceof CodeGame.BlockError && e.path.join() === '1');
  assert.ok(world.crashed);
  assert.strictEqual(world.robot.dir, 'N');
});

test('elmas yokken topla hata verir', () => {
  assert.throws(() => runAll([{ type: 'pick' }], corridor), (e) => e instanceof CodeGame.BlockError && e.path.join() === '0');
});

test('adım sınırı', () => {
  const level = { map: ['#####', '#S.G#', '#####'], startDir: 'E' };
  const pace = [{ type: 'loop', count: 9, body: [{ type: 'loop', count: 9, body: [{ type: 'loop', count: 9, body: [{ type: 'right' }, { type: 'left' }] }] }] }];
  assert.throws(() => runAll(pace, level), /Çok fazla adım/);
});

test('count döngüleri ve gövdeleri sayar', () => {
  assert.strictEqual(CodeGame.Blocks.count([]), 0);
  assert.strictEqual(CodeGame.Blocks.count([
    { type: 'right' },
    { type: 'loop', count: 2, body: [{ type: 'down' }, { type: 'loop', count: 2, body: [{ type: 'left' }] }] },
  ]), 5);
});
