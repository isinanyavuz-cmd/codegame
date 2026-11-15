const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');

const LEVELS = [1, 2, 3];
const RUNS = 300;

function each(fn) {
  for (const c of B.CATS) for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    fn(c.id, lv, seed, B.generate(c.id, lv, new B.RNG(seed * 7919 + lv)));
  }
}

test('her kategori için bir üretici var', () => {
  for (const c of B.CATS) assert.strictEqual(typeof B.GEN[c.id], 'function', c.id);
  assert.strictEqual(Object.keys(B.GEN).length, B.CATS.length);
  for (const c of B.CATS) assert.ok(B.AREAS.some((a) => a.id === c.area), c.id + ' alanı tanımlı');
});

test('her soru 3-4 farklı şık, tek doğru cevap ve açıklama içerir', () => {
  each((id, lv, seed, q) => {
    const where = id + ' s' + lv + ' #' + seed;
    assert.ok(q.options.length === 3 || q.options.length === 4, where);
    assert.strictEqual(new Set(q.options.map((o) => o.key)).size, q.options.length, where + ' aynı şık');
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, where);
    assert.ok(q.prompt.length > 5 && q.explain.length > 5, where);
    assert.ok(q.stem || q.memo || id === 'odd', where + ' görsel yok');
    const all = q.prompt + q.stem + q.explain + q.options.map((o) => o.html).join('') + (q.memo ? q.memo.html : '');
    assert.ok(!/undefined|NaN|null|\[object/.test(all), where + ' bozuk metin');
    for (const o of q.options) assert.ok(o.html && o.html.length > 5, where);
  });
});

test('aynı tohum aynı soruyu üretir', () => {
  for (const c of B.CATS) {
    const a = B.generate(c.id, 2, new B.RNG(12345)), b = B.generate(c.id, 2, new B.RNG(12345));
    assert.strictEqual(a.stem + a.prompt + a.answer, b.stem + b.prompt + b.answer, c.id);
  }
});

test('doğru cevabın yeri hep aynı şıkta değil', () => {
  for (const c of B.CATS) for (const lv of LEVELS) {
    const hits = [0, 0, 0, 0];
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const q = B.generate(c.id, lv, new B.RNG(seed * 104729 + lv));
      hits[q.answer]++;
      n = Math.max(n, q.options.length);
    }
    for (let i = 0; i < n; i++) assert.ok(hits[i] >= 40, c.id + ' s' + lv + ' şık ' + i + ': ' + hits.join('/'));
  }
});

test('küp sayma: cevap yüksekliklerin toplamı, her sütunun tepesi görünür', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('cubes', lv, new B.RNG(seed));
    const h = q.meta.heights;
    let sum = 0;
    for (let x = 0; x < h.length; x++) for (let y = 0; y < h[x].length; y++) {
      sum += h[x][y];
      if (x) assert.ok(h[x - 1][y] >= h[x][y], 'arkadaki sütun daha alçak olamaz');
      if (y) assert.ok(h[x][y - 1] >= h[x][y], 'arkadaki sütun daha alçak olamaz');
    }
    assert.strictEqual(q.options[q.answer].value, sum);
  }
});

test('sayı örüntüsü: boşluk dizideki sayıdır ve şıklar negatif değildir', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('numseq', lv, new B.RNG(seed));
    assert.strictEqual(q.options[q.answer].value, q.meta.seq[q.meta.hole]);
    for (const o of q.options) assert.ok(o.value >= 0);
    for (const v of q.meta.seq) assert.ok(v >= 0 && v <= 200, 'sayı aralık dışında: ' + v);
  }
});

test('meyve işlemleri: değerler tutarlı', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('fruit', lv, new B.RNG(seed));
    assert.strictEqual(q.options[q.answer].value, q.meta.ans);
    assert.ok(q.meta.a >= 1 && q.meta.b >= 1 && q.meta.c >= 1);
    assert.ok(!/−\d|=<\/span><span class="eq-n">-/.test(q.stem), 'negatif sonuç olmamalı');
  }
});

test('ok yolu: oklar hedefe götürür, yanlış şıklar götürmez', () => {
  const D = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] };
  const walk = (m, seq) => {
    let x = m.start[0], y = m.start[1];
    for (const d of seq) { x += D[d][0]; y += D[d][1]; if (x < 0 || y < 0 || x >= m.n || y >= m.n) return null; }
    return [x, y];
  };
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('path', lv, new B.RNG(seed));
    const m = q.meta;
    assert.deepStrictEqual(walk(m, m.seq), m.target);
    assert.strictEqual(new Set(m.cells.map((c) => c.x + ',' + c.y)).size, 4, 'yiyecekler farklı karelerde');
    assert.ok(!m.cells.some((c) => c.x === m.start[0] && c.y === m.start[1]));
    if (m.reverse) {
      q.options.forEach((o, i) => {
        const end = walk(m, o.key.split(''));
        const hit = !!end && end[0] === m.target[0] && end[1] === m.target[1];
        assert.strictEqual(hit, i === q.answer, 'yalnız doğru şık hedefe varmalı');
      });
    } else {
      assert.strictEqual(q.options[q.answer].key, 'e' + m.cells[0].e);
    }
  }
});

test('sıralama: cümleler sırayla tutarlı ve doğru kişi soruluyor', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('order', lv, new B.RNG(seed));
    const m = q.meta;
    assert.strictEqual(q.options[q.answer].key, 't' + m.order[m.idx]);
    assert.strictEqual(m.facts.length, m.order.length - 1);
    for (const f of m.facts) {
      const who = m.order.filter((nm) => f.indexOf(nm + ',') === 0 || f.indexOf(nm + "'") > 0);
      assert.strictEqual(who.length, 2, f);
    }
  }
});

test('şifre çözme: sayı tablodaki rakamlardan oluşur', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('code', lv, new B.RNG(seed));
    const num = q.meta.seq.map((k) => q.meta.digits[k]).join('');
    if (q.meta.reverse) assert.ok(q.prompt.indexOf(num) > 0);
    else assert.strictEqual(q.options[q.answer].key, 'n' + num);
    assert.strictEqual(new Set(q.meta.digits).size, q.meta.digits.length);
  }
});

test('görsel hafıza: sorulan resim gerçekten gösterilmiş ya da gösterilmemiş', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('memory', lv, new B.RNG(seed));
    const m = q.meta, ans = q.options[q.answer].key.slice(1);
    assert.ok(q.memo.seconds >= 3 && q.memo.html.length > 20);
    if (m.kind === 'absent') {
      assert.ok(m.shown.indexOf(ans) < 0);
      q.options.forEach((o, i) => { if (i !== q.answer) assert.ok(m.shown.indexOf(o.key.slice(1)) >= 0); });
    } else if (m.kind === 'present') {
      assert.ok(m.shown.indexOf(ans) >= 0);
      q.options.forEach((o, i) => { if (i !== q.answer) assert.ok(m.shown.indexOf(o.key.slice(1)) < 0); });
    } else {
      assert.strictEqual(m.shown[m.hole], ans);
    }
  }
});

test('kareli şekil dönüşümleri: dört çeyrek tur başa döner, ayna iki kez uygulanınca aynı kalır', () => {
  const G = B.Shapes.Grid, m = [[1, 0, 0], [2, 1, 0], [0, 0, 0]];
  assert.deepStrictEqual(G.rot(m), [[0, 2, 1], [0, 1, 0], [0, 0, 0]]);
  assert.deepStrictEqual(G.rot(G.rot(G.rot(G.rot(m)))), m);
  assert.deepStrictEqual(G.flipH(G.flipH(m)), m);
  assert.deepStrictEqual(G.tf(m, { rot: 180, mirror: false }), G.rot(G.rot(m)));
});

test('şekil anahtarı: simetrik şekillerde dönüş fark yaratmaz', () => {
  const K = B.Shapes.key;
  assert.strictEqual(K({ shape: 'square', color: 'red', rot: 90 }), K({ shape: 'square', color: 'red' }));
  assert.strictEqual(K({ shape: 'hexagon', color: 'red', rot: 180 }), K({ shape: 'hexagon', color: 'red' }));
  assert.notStrictEqual(K({ shape: 'arrow', color: 'red', rot: 90 }), K({ shape: 'arrow', color: 'red' }));
  assert.notStrictEqual(K({ shape: 'circle', color: 'red' }), K({ shape: 'circle', color: 'blue' }));
});

test('sayı makinesi: bütün satırlar aynı kurala uyar', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('machine', lv, new B.RNG(seed));
    const m = q.meta;
    assert.strictEqual(q.options[q.answer].value, m.ans);
    assert.strictEqual(new Set(m.pairs.map((p) => p[0])).size, 4, 'giren sayılar farklı');
    for (const p of m.pairs) assert.ok(p[0] >= 0 && p[1] >= 0 && p[1] <= 40, 'sayı aralık dışında: ' + p);
    const d = m.pairs.map((p) => p[1] - p[0]);
    if (m.kind === 'add' || m.kind === 'sub') assert.ok(d.every((v) => v === d[0]));
    if (m.kind === 'dbl') assert.ok(m.pairs.every((p) => p[1] === 2 * p[0]));
  }
});

test('terazi: her terazide ağır olan kefe aşağıda ve zincir eksiksiz', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('balance', lv, new B.RNG(seed));
    const m = q.meta;
    assert.strictEqual(m.pairs.length, m.n - 1);
    const seen = new Set(m.pairs.map((p) => Math.min(p[0], p[1])));
    assert.strictEqual(seen.size, m.n - 1, 'her komşu çift bir kez karşılaştırılır');
    for (const p of m.pairs) assert.strictEqual(Math.abs(p[0] - p[1]), 1);
  }
});

test('kim hangisi: ipuçlarının tek çözümü var ve sorulan kişi doğrudan söylenmemiş', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) {
    const q = B.generate('who', lv, new B.RNG(seed));
    const m = q.meta, sols = B.ExtraUtil.solutions(m.n, m.clues);
    assert.strictEqual(sols.length, 1);
    assert.deepStrictEqual(sols[0], Array.from({ length: m.n }, (_, i) => i));
    assert.ok(!m.clues.some((c) => c.is && c.kid === m.ask), 'cevap ipucunda hazır verilmemeli');
    assert.strictEqual(q.options.length, m.n);
  }
});
