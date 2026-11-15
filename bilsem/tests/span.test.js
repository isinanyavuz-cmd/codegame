const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');
const Sp = B.Span;

test('sayı hafızası: 3 ile 10 basamak arası, basamak sayısı kadar saniye', () => {
  assert.strictEqual(Sp.MIN, 3);
  assert.strictEqual(Sp.MAX, 10);
  for (let n = Sp.MIN; n <= Sp.MAX; n++) assert.strictEqual(Sp.seconds(n), n);
});

test('üretilen sayı istenen uzunlukta ve kolay kalıplardan arınmış', () => {
  const rng = new B.RNG(42);
  for (let n = Sp.MIN; n <= Sp.MAX; n++) for (let i = 0; i < 500; i++) {
    const s = Sp.makeNumber(rng, n);
    assert.match(s, new RegExp('^[1-9][0-9]{' + (n - 2) + '}[1-9]$'), s);
    assert.notStrictEqual(s, Sp.reverse(s), 'tersi kendisiyle aynı olmamalı: ' + s);
    for (let k = 1; k < n; k++) assert.notStrictEqual(s[k], s[k - 1], 'aynı rakam yan yana: ' + s);
    for (let k = 2; k < n; k++) {
      const a = +s[k - 2], b = +s[k - 1], c = +s[k];
      assert.ok(!(b - a === c - b && Math.abs(c - b) === 1), 'ardışık üçlü: ' + s);
    }
  }
});

test('düzden ve tersten beklenen yazım', () => {
  assert.strictEqual(Sp.expected('4729', 'fwd'), '4729');
  assert.strictEqual(Sp.expected('4729', 'bwd'), '9274');
  assert.deepStrictEqual(Sp.asks('both'), ['fwd', 'bwd']);
  assert.deepStrictEqual(Sp.asks('fwd'), ['fwd']);
  assert.deepStrictEqual(Sp.asks('bwd'), ['bwd']);
});

test('oyun akışı: doğru cevap bir basamak uzatır, 10 basamak bilinince oyun kazanılır', () => {
  const g = Sp.newGame('both', 3);
  for (let n = 3; n <= 9; n++) { Sp.advance(g, true); assert.strictEqual(g.len, n + 1); assert.strictEqual(g.over, false); }
  Sp.advance(g, true);
  assert.deepStrictEqual([g.best, g.over, g.won, g.len, g.hits], [10, true, true, 10, 8]);
});

test('oyun akışı: yanlışta uzunluk değişmez, üç yanlışta oyun biter', () => {
  const g = Sp.newGame('fwd', 4);
  Sp.advance(g, true);
  Sp.advance(g, false);
  assert.deepStrictEqual([g.len, g.lives, g.over], [5, 2, false]);
  Sp.advance(g, false);
  Sp.advance(g, false);
  assert.deepStrictEqual([g.len, g.lives, g.over, g.won, g.best, g.trials], [5, 0, true, false, 4, 4]);
  assert.strictEqual(Sp.newGame('bwd', 99).len, 10);
  assert.strictEqual(Sp.newGame('bwd', 1).len, 3);
});
