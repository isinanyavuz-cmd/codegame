const test = require('node:test');
const assert = require('node:assert');

const CodeGame = require('../js/world.js');
const { World } = CodeGame;

const level = {
  id: 't', title: 'T',
  map: [
    '######',
    '#S.*.#',
    '#.##G#',
    '######',
  ],
  startDir: 'E',
};

test('boyutlar, başlangıç ve elmaslar', () => {
  const w = new World(level);
  assert.strictEqual(w.width, 6);
  assert.strictEqual(w.height, 4);
  assert.deepStrictEqual(w.robot, { x: 1, y: 1, dir: 'E' });
  assert.ok(w.gems instanceof Set);
  assert.deepStrictEqual([...w.gems], ['3,1']);
  assert.strictEqual(w.totalGems, 1);
  assert.strictEqual(w.collected, 0);
  assert.strictEqual(w.crashed, false);
});

test('startDir verilmezse E', () => {
  const w = new World({ map: ['#SG#'] });
  assert.strictEqual(w.robot.dir, 'E');
});

test('cellAt: duvar, zemin, hedef, harita dışı', () => {
  const w = new World(level);
  assert.strictEqual(w.cellAt(0, 0), '#');
  assert.strictEqual(w.cellAt(1, 1), '.'); // S zemin
  assert.strictEqual(w.cellAt(3, 1), '.'); // * zemin
  assert.strictEqual(w.cellAt(4, 2), 'G');
  assert.strictEqual(w.cellAt(-1, 0), '#');
  assert.strictEqual(w.cellAt(0, -1), '#');
  assert.strictEqual(w.cellAt(6, 1), '#');
  assert.strictEqual(w.cellAt(1, 4), '#');
});

test('constructor seviye nesnesini değiştirmez', () => {
  const lv = JSON.parse(JSON.stringify(level));
  const snapshot = JSON.stringify(lv);
  const w = new World(lv);
  w.move(); w.move(); w.pick();
  assert.strictEqual(JSON.stringify(lv), snapshot);
  // iki dünya birbirinden bağımsız
  const w2 = new World(lv);
  assert.strictEqual(w2.gems.size, 1);
  assert.deepStrictEqual(w2.robot, { x: 1, y: 1, dir: 'E' });
});

test("S veya G yoksa hata fırlatır", () => {
  assert.throws(() => new World({ map: ['#.G#'], startDir: 'E' }));
  assert.throws(() => new World({ map: ['#S.#'], startDir: 'E' }));
  assert.throws(() => new World({ map: [] }));
});

test('dönüşler ve yönler (N = y-1)', () => {
  const w = new World(level);
  w.turnLeft(); assert.strictEqual(w.robot.dir, 'N');
  w.turnLeft(); assert.strictEqual(w.robot.dir, 'W');
  w.turnLeft(); assert.strictEqual(w.robot.dir, 'S');
  w.turnLeft(); assert.strictEqual(w.robot.dir, 'E');
  w.turnRight(); assert.strictEqual(w.robot.dir, 'S');
  w.move();
  assert.deepStrictEqual(w.robot, { x: 1, y: 2, dir: 'S' });
  w.turnRight(); w.turnRight(); // N
  w.move();
  assert.deepStrictEqual(w.robot, { x: 1, y: 1, dir: 'N' });
});

test('duvara çarpma: crashed ve hata, robot yerinde kalır', () => {
  const w = new World(level);
  w.turnLeft(); // N -> duvar
  assert.throws(() => w.move(), { message: 'Robot duvara çarptı!' });
  assert.strictEqual(w.crashed, true);
  assert.deepStrictEqual(w.robot, { x: 1, y: 1, dir: 'N' });
});

test('harita kenarında (duvarsız) dışarı çıkmak da çarpmadır', () => {
  const w = new World({ map: ['SG'], startDir: 'W' });
  assert.throws(() => w.move(), /duvara çarptı/);
  assert.strictEqual(w.crashed, true);
});

test('sensörler', () => {
  const w = new World(level);
  assert.strictEqual(w.isPathAhead(), true);
  assert.strictEqual(w.isPathLeft(), false);
  assert.strictEqual(w.isPathRight(), true);
  assert.strictEqual(w.atGoal(), false);
  assert.strictEqual(w.hasGem(), false);
  w.move(); w.move();
  assert.strictEqual(w.hasGem(), true);
  assert.strictEqual(w.isPathRight(), false);
});

test('pick: elmas toplar, yoksa hata', () => {
  const w = new World(level);
  assert.throws(() => w.pick(), { message: 'Burada toplanacak elmas yok!' });
  w.move(); w.move();
  w.pick();
  assert.strictEqual(w.collected, 1);
  assert.strictEqual(w.gems.size, 0);
  assert.strictEqual(w.hasGem(), false);
  assert.throws(() => w.pick(), /elmas yok/);
});

test('isWon: hedefte ve tüm elmaslar toplanmış', () => {
  const w = new World(level);
  w.move(); w.move(); w.move(); w.turnRight(); w.move();
  assert.strictEqual(w.atGoal(), true);
  assert.strictEqual(w.isWon(), false); // elmas kaldı

  const w2 = new World(level);
  w2.move(); w2.move(); w2.pick(); w2.move(); w2.turnRight(); w2.move();
  assert.strictEqual(w2.isWon(), true);
});
