/* Sayı Hafızası: sayı gösterilir, kapanır; düzden ve tersten yazılır. 3 basamaktan 10 basamağa kadar ilerler. */
(function (root) {
  'use strict';
  const Bilsem = root.Bilsem = root.Bilsem || {};
  const MIN = 3, MAX = 10, LIVES = 3;
  const MODES = [
    { id: 'both', name: 'Düzden ve tersten yaz', short: 'düzden ve tersten' },
    { id: 'fwd', name: 'Yalnız düzden yaz', short: 'yalnız düzden' },
    { id: 'bwd', name: 'Yalnız tersten yaz', short: 'yalnız tersten' },
  ];

  const reverse = (s) => s.split('').reverse().join('');

  /* n basamaklı sayı. Kolay ezberlenen kalıplar elenir: 0 ile başlamaz ya da bitmez (tersi de sayı gibi okunsun),
     aynı rakam yan yana gelmez, 1-2-3 ya da 3-2-1 gibi üçlü sıra olmaz, tersi kendisiyle aynı değildir. */
  function makeNumber(rng, n) {
    for (;;) {
      const d = [rng.int(1, 9)];
      while (d.length < n) {
        const last = d[d.length - 1], prev = d.length > 1 ? d[d.length - 2] : null;
        const v = d.length === n - 1 ? rng.int(1, 9) : rng.int(0, 9);
        if (v === last) continue;
        if (prev != null && Math.abs(v - last) === 1 && v - last === last - prev) continue;
        d.push(v);
      }
      const s = d.join('');
      if (s !== reverse(s)) return s;
    }
  }

  /* Bir oyunda sırayla istenen yazımlar: ['fwd'], ['bwd'] ya da ['fwd', 'bwd'] */
  const asks = (mode) => (mode === 'both' ? ['fwd', 'bwd'] : [mode]);
  const expected = (number, ask) => (ask === 'bwd' ? reverse(number) : number);
  const seconds = (n) => n;                 // basamak sayısı kadar saniye

  function newGame(mode, start) {
    return { mode: mode, len: Math.max(MIN, Math.min(MAX, start || MIN)), lives: LIVES, best: 0, trials: 0, hits: 0, over: false, won: false };
  }
  /* Bir sayı denemesi bitti. Doğruysa bir basamak uzar; yanlışsa bir can gider ve aynı uzunluk yeni sayıyla yinelenir. */
  function advance(g, success) {
    g.trials++;
    if (success) {
      g.hits++;
      g.best = Math.max(g.best, g.len);
      if (g.len >= MAX) { g.over = true; g.won = true; } else g.len++;
    } else {
      g.lives--;
      if (g.lives <= 0) g.over = true;
    }
    return g;
  }

  Bilsem.Span = { MIN: MIN, MAX: MAX, LIVES: LIVES, MODES: MODES, reverse: reverse, makeNumber: makeNumber, asks: asks, expected: expected, seconds: seconds, newGame: newGame, advance: advance };

  if (typeof module !== 'undefined') module.exports = Bilsem;
})(typeof window !== 'undefined' ? window : globalThis);
