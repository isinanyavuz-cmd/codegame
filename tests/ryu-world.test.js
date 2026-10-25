const test = require('node:test');
const assert = require('node:assert');

const CodeGame = require('../js/ryu/world.js');
const { World } = CodeGame.Ryu;

const pos = (w) => [w.ryu.x, w.ryu.y];
const kinds = (ev) => ev.fx.map((f) => f.kind);

test('harita: başlangıç, bayrak, altınlar, düşmanlar', () => {
  const w = new World({
    map: [
      '..o.?...',
      '........',
      'S.e.B.EF',
      '########',
    ],
  });
  assert.strictEqual(w.width, 8);
  assert.strictEqual(w.height, 4);
  assert.deepStrictEqual(pos(w), [0, 2]);
  assert.deepStrictEqual(w.flag, { x: 7, y: 2 });
  assert.strictEqual(w.totalCoins, 2); // altın + ? kutusu
  assert.deepStrictEqual(w.enemies.map((e) => [e.type, e.hp]), [['thug', 1], ['brute', 3]]);
  assert.strictEqual(w.cellAt(4, 2), 'B');
  assert.strictEqual(w.cellAt(-1, 0), '=');
  assert.strictEqual(w.cellAt(0, 9), '.');
  assert.strictEqual(w.state, 'play');
});

test('S veya F yoksa hata', () => {
  assert.throws(() => new World({ map: ['..F', '###'] }));
  assert.throws(() => new World({ map: ['S..', '###'] }));
  assert.throws(() => new World({ map: [] }));
});

test('ileri ve geri, bayrağa değince biter', () => {
  const w = new World({ map: ['S..F', '####'] });
  w.act('forward');
  w.act('back');
  assert.deepStrictEqual(pos(w), [0, 0]);
  w.act('forward'); w.act('forward');
  const ev = w.act('forward');
  assert.strictEqual(ev.result, 'flag');
  assert.ok(w.isWon());
  assert.throws(() => w.act('forward'), /bitti/);
});

test('direğin üst kısmına değmek de sayılır', () => {
  const w = new World({ map: ['.....', '.....', 'S.F..', '#####'] });
  const ev = w.act('jump');
  assert.strictEqual(ev.result, 'flag');
  assert.deepStrictEqual(pos(w), [2, 0]);
});

test('duvara yürümek programı durdurur', () => {
  const w = new World({ map: ['S=.F', '####'] });
  const ev = w.act('forward');
  assert.strictEqual(ev.result, 'blocked');
  assert.strictEqual(w.reason, 'wall');
  assert.deepStrictEqual(pos(w), [0, 0]);
  const w2 = new World({ map: ['S..F', '####'] });
  assert.strictEqual(w2.act('back').result, 'blocked');
});

test('boşluğa yürüyünce düşer', () => {
  const w = new World({ map: ['S..F', '#.##'] });
  const ev = w.act('forward');
  assert.strictEqual(ev.result, 'dead');
  assert.strictEqual(w.reason, 'fall');
  assert.strictEqual(ev.steps[ev.steps.length - 1].kind, 'fall');
});

test('basamaktan inerken yere kadar düşer', () => {
  const w = new World({ map: ['S...', '#..F', '####'] });
  const ev = w.act('forward');
  assert.deepStrictEqual(pos(w), [1, 1]);
  assert.deepStrictEqual(ev.steps.map((s) => s.kind), ['walk', 'fall']);
});

test('zıpla: 1 karelik çukuru geçer, 2 yüksek basamağa çıkar', () => {
  const w = new World({ map: ['......', '......', 'S....F', '#.####'] });
  const ev = w.act('jump');
  assert.deepStrictEqual(pos(w), [2, 2]);
  assert.deepStrictEqual(ev.steps.map((s) => s.kind), ['jump', 'jump', 'jump', 'jump', 'fall', 'fall']);

  const s = new World({ map: ['.....', '..##F', 'S.###', '#####'] });
  s.act('forward');
  s.act('jump');
  assert.deepStrictEqual(pos(s), [3, 0]);
});

test('zıpla: 2 karelik çukurda düşer', () => {
  const w = new World({ map: ['.....', 'S...F', '#..##'] });
  const ev = w.act('jump');
  assert.strictEqual(ev.result, 'dead');
  assert.strictEqual(w.reason, 'fall');
});

test('zıpla: ? kutusuna kafa atınca altın çıkar', () => {
  const w = new World({ map: ['?....', '.....', 'S...F', '#####'] });
  const ev = w.act('jump');
  assert.ok(kinds(ev).includes('qcoin'));
  assert.strictEqual(w.collected, 1);
  assert.strictEqual(w.cellAt(0, 0), 'u');
  assert.deepStrictEqual(pos(w), [2, 2]);
});

test('zıpla: düşmanın üstüne düşünce ezer', () => {
  const w = new World({ map: ['.....', '.....', 'S.e.F', '#####'] });
  const ev = w.act('jump');
  assert.deepStrictEqual(pos(w), [2, 2]);
  assert.strictEqual(w.enemiesLeft(), 0);
  assert.strictEqual(ev.hits, 1);
  assert.strictEqual(ev.fx.find((f) => f.kind === 'hit').by, 'stomp');
});

test('düşmana yürümek: yakalanır', () => {
  const w = new World({ map: ['Se.F', '####'] });
  const ev = w.act('forward');
  assert.strictEqual(ev.result, 'dead');
  assert.strictEqual(w.reason, 'enemy');
  assert.deepStrictEqual(pos(w), [0, 0]);
});

test('dikenli kirpi: yalnızca hadoken yener', () => {
  const lv = { map: ['....', 'Sk.F', '####'] };
  for (const move of ['punch', 'forward', 'tatsumaki']) {
    const w = new World(lv);
    const ev = w.act(move);
    assert.strictEqual(ev.result, 'dead', move);
    assert.strictEqual(w.reason, 'spiky', move);
    assert.strictEqual(ev.hits, 0);
  }
  const stomp = new World({ map: ['.....', '.....', 'S.k.F', '#####'] });
  stomp.act('jump');
  assert.strictEqual(stomp.reason, 'spiky');
  const fire = new World(lv);
  fire.act('hadoken');
  assert.strictEqual(fire.enemiesLeft(), 0);
  fire.act('forward'); fire.act('forward'); fire.act('forward');
  assert.ok(fire.isWon());
});

test('dikene basmak', () => {
  const w = new World({ map: ['S^.F', '####'] });
  w.act('forward');
  assert.strictEqual(w.state, 'dead');
  assert.strictEqual(w.reason, 'spike');
});

test('yumruk: kutu kırar, düşmana vurur, boşa da vurabilir', () => {
  const w = new World({ map: ['SB.F', '####'] });
  let ev = w.act('punch');
  assert.deepStrictEqual(kinds(ev), ['punch', 'break']);
  assert.strictEqual(w.cellAt(1, 0), '.');
  ev = w.act('punch');
  assert.strictEqual(ev.fx[0].target, 'none');
  assert.strictEqual(w.state, 'play');

  const b = new World({ map: ['SE.F', '####'] });
  b.act('punch'); b.act('punch');
  assert.strictEqual(b.enemies[0].hp, 1);
  assert.strictEqual(b.combo, 2);
  ev = b.act('punch');
  assert.strictEqual(ev.fx[1].ko, true);
  assert.strictEqual(b.maxCombo, 3);
});

test('kombo: vuruşsuz hareket sayacı sıfırlar', () => {
  const w = new World({ map: ['SE..F', '#####'] });
  w.act('punch');
  w.act('punch');
  assert.strictEqual(w.combo, 2);
  w.act('back');
  assert.strictEqual(w.state, 'blocked');
  const w2 = new World({ map: ['.SE..F', '######'] });
  w2.act('punch'); w2.act('back'); w2.act('hadoken');
  assert.strictEqual(w2.combo, 1);
  assert.strictEqual(w2.maxCombo, 1);
});

test('hadoken: uzaktaki ilk düşmanı vurur, duvarda söner', () => {
  const w = new World({ map: ['S..e.e.F', '##..####'] });
  let ev = w.act('hadoken');
  assert.strictEqual(ev.fx[0].target, 'enemy');
  assert.strictEqual(ev.fx[0].toX, 3);
  assert.strictEqual(w.enemies[0].hp, 0);
  assert.strictEqual(w.enemies[1].hp, 1);
  w.act('hadoken');
  assert.strictEqual(w.enemiesLeft(), 0);
  ev = w.act('hadoken');
  assert.strictEqual(ev.fx[0].target, 'wall');
  assert.deepStrictEqual(pos(w), [0, 0]);
});

test('hadoken kutuyu kırar', () => {
  const w = new World({ map: ['S...B.F', '#######'] });
  const ev = w.act('hadoken');
  assert.strictEqual(ev.fx[0].target, 'crate');
  assert.strictEqual(w.cellAt(4, 0), '.');
});

test('shoryuken: 3 yükselir, 1 ileri, yüksek ? kutusunu açar', () => {
  const w = new World({ map: ['......', '......', '......', '......', 'S....F', '######'] });
  let ev = w.act('shoryuken');
  assert.deepStrictEqual(ev.steps.map((s) => s.kind), ['rise', 'rise', 'rise', 'rise', 'fall', 'fall', 'fall']);
  assert.deepStrictEqual(pos(w), [1, 4]);

  const q = new World({ map: ['......', '.?....', '......', '......', 'S....F', '######'] });
  ev = q.act('shoryuken'); // x=0'da yükselir, ileri gidemez (kutu), geri düşer
  assert.strictEqual(q.cellAt(1, 1), '?');
  assert.deepStrictEqual(pos(q), [0, 4]);
  q.act('forward');
  ev = q.act('shoryuken');
  assert.ok(kinds(ev).includes('qcoin'));
  assert.strictEqual(q.collected, 1);
  assert.deepStrictEqual(pos(q), [2, 4]);
  // zıplama o yüksekliğe yetişmez
  const j = new World({ map: ['......', '.?....', '......', '......', '.S...F', '######'] });
  assert.ok(!kinds(j.act('jump')).includes('qcoin'));
});

test('shoryuken tuğlayı kırıp geçer, havadaki yarasayı yener', () => {
  const w = new World({ map: ['......', '.....F', 'B===##', 'b.....', 'S.....', '######'] });
  const ev = w.act('shoryuken');
  assert.deepStrictEqual(kinds(ev), ['hit', 'break']);
  assert.strictEqual(w.enemiesLeft(), 0);
  assert.deepStrictEqual(pos(w), [1, 1]);
});

test('shoryuken 3 yüksek çıkıntıya çıkar, zıplama çıkamaz', () => {
  const map = ['......', '......', '.###..', '.###..', 'S###.F', '######'];
  const w = new World({ map });
  w.act('shoryuken');
  assert.deepStrictEqual(pos(w), [1, 1]);
  const j = new World({ map });
  j.act('jump');
  assert.deepStrictEqual(pos(j), [0, 4]);
});

test('tatsumaki: 3 kare döner, yoldaki düşmanları ve kutuları yener, çukur geçer', () => {
  const w = new World({ map: ['SeBe.F', '#..###'] });
  const ev = w.act('tatsumaki');
  assert.deepStrictEqual(pos(w), [3, 0]);
  assert.strictEqual(ev.hits, 2);
  assert.strictEqual(w.combo, 2);
  assert.strictEqual(w.enemiesLeft(), 0);
  assert.strictEqual(w.cellAt(2, 0), '.');
});

test('tatsumaki sağ kalan düşmanın önünde durur', () => {
  const w = new World({ map: ['S.E..F', '######'] });
  const ev = w.act('tatsumaki');
  assert.deepStrictEqual(pos(w), [1, 0]);
  assert.strictEqual(ev.hits, 1);
  assert.strictEqual(w.enemies[0].hp, 2);
});

test('altınlar yolda toplanır, hepsi olmadan kazanılmaz', () => {
  const w = new World({ map: ['..o..', 'S...F', '#####'] });
  w.act('forward'); w.act('forward'); w.act('forward');
  assert.strictEqual(w.act('forward').result, 'flag');
  assert.strictEqual(w.isWon(), false);
  const w2 = new World({ map: ['..o..', 'S...F', '#####'] });
  w2.act('forward');
  const ev = w2.act('jump'); // (1,0) -> (2,0)'daki altın
  assert.ok(kinds(ev).includes('coin'));
  w2.act('forward');
  assert.ok(w2.isWon());
});

test('needCombo: kombo yetmezse kazanılmaz', () => {
  const lv = { map: ['SE.F', '####'], needCombo: 3 };
  const ok = new World(lv);
  ok.act('punch'); ok.act('punch'); ok.act('punch'); ok.act('forward'); ok.act('forward'); ok.act('forward');
  assert.ok(ok.isWon());
  const slow = new World(lv);
  slow.act('punch'); slow.act('punch'); slow.act('back');
  assert.strictEqual(slow.state, 'blocked');
});

test('constructor bölüm nesnesini değiştirmez', () => {
  const lv = { map: ['SB?.F', '#####'] };
  const snap = JSON.stringify(lv);
  const w = new World(lv);
  w.act('punch');
  assert.strictEqual(JSON.stringify(lv), snap);
  assert.strictEqual(new World(lv).cellAt(1, 0), 'B');
});
