const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');
const Sp = B.Span;

test('sayı hafızası: 3 ile 7 basamak arası', () => {
  assert.strictEqual(Sp.MIN, 3);
  assert.strictEqual(Sp.MAX, 7);
});

test('süre düzeye göre: Kolay iki katı, Orta basamak sayısı, Zor üçte ikisi', () => {
  const secs = (lv) => [3, 4, 5, 6, 7].map((n) => Sp.seconds(n, lv));
  assert.deepStrictEqual(secs(1), [6, 8, 10, 12, 14]);
  assert.deepStrictEqual(secs(2), [3, 4, 5, 6, 7]);
  assert.deepStrictEqual(secs(3), [2, 2.7, 3.3, 4, 4.7]);
  for (let n = Sp.MIN; n <= Sp.MAX; n++) {
    const z = Sp.seconds(n, 3);
    assert.ok(z >= n / 2 && z <= n * 2 / 3 + 0.05, 'Zor süre basamak sayısının yarısı ile üçte ikisi arasında: ' + z);
  }
  assert.deepStrictEqual(Sp.LEVELS.map((l) => l.name), ['Kolay', 'Orta', 'Zor']);
  assert.strictEqual(Sp.seconds(4, 99), 8, 'bilinmeyen düzey Kolay sayılır');
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

test('oyun akışı: doğru cevap bir basamak uzatır, 7 basamak bilinince oyun kazanılır', () => {
  const g = Sp.newGame('both', 3, 2);
  assert.strictEqual(g.level, 2);
  for (let n = 3; n <= 6; n++) { Sp.advance(g, true); assert.strictEqual(g.len, n + 1); assert.strictEqual(g.over, false); }
  Sp.advance(g, true);
  assert.deepStrictEqual([g.best, g.over, g.won, g.len, g.hits], [7, true, true, 7, 5]);
});

test('oyun akışı: yanlışta uzunluk değişmez, üç yanlışta oyun biter', () => {
  const g = Sp.newGame('fwd', 4, 1);
  Sp.advance(g, true);
  Sp.advance(g, false);
  assert.deepStrictEqual([g.len, g.lives, g.over], [5, 2, false]);
  Sp.advance(g, false);
  Sp.advance(g, false);
  assert.deepStrictEqual([g.len, g.lives, g.over, g.won, g.best, g.trials], [5, 0, true, false, 4, 4]);
  assert.strictEqual(Sp.newGame('bwd', 99).len, 7);
  assert.strictEqual(Sp.newGame('bwd', 1).len, 3);
  assert.strictEqual(Sp.newGame('bwd', 3).level, 1, 'düzey verilmezse Kolay');
});
