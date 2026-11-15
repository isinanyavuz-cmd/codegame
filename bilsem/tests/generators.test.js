const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');

const LEVELS = B.LEVELS;      // 1 Kolay, 2 Orta, 3 Zor, 4 En Zor
const RUNS = 300;
const gen = (id, lv, seed) => B.generate(id, lv, new B.RNG(seed));
const value = (q) => q.options[q.answer].value;
const forEach = (id, fn) => { for (const lv of LEVELS) for (let seed = 1; seed <= RUNS; seed++) fn(gen(id, lv, seed), lv, seed); };

test('her kategori için bir üretici var', () => {
  for (const c of B.CATS) assert.strictEqual(typeof B.GEN[c.id], 'function', c.id);
  assert.strictEqual(Object.keys(B.GEN).length, B.CATS.length);
  for (const c of B.CATS) assert.ok(B.AREAS.some((a) => a.id === c.area), c.id + ' alanı tanımlı');
});

test('her soru 3-4 farklı şık, tek doğru cevap ve açıklama içerir', () => {
  for (const c of B.CATS) forEach(c.id, (q, lv, seed) => {
    const where = c.id + ' s' + lv + ' #' + seed;
    assert.ok(q.options.length === 3 || q.options.length === 4, where);
    assert.strictEqual(new Set(q.options.map((o) => o.key)).size, q.options.length, where + ' aynı şık');
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, where);
    assert.ok(q.prompt.length > 5 && q.explain.length > 5, where);
    assert.ok(q.stem || q.memo || c.id === 'odd', where + ' görsel yok');
    const all = q.prompt + q.stem + q.explain + q.options.map((o) => o.html).join('') + (q.memo ? q.memo.html : '');
    assert.ok(!/undefined|NaN|null|\[object/.test(all), where + ' bozuk metin');
    for (const o of q.options) assert.ok(o.html && o.html.length > 5, where);
    if (q.options[0].value != null) for (const o of q.options) assert.ok(o.value >= 0, where + ' negatif şık');
  });
});

test('aynı tohum aynı soruyu üretir', () => {
  for (const c of B.CATS) for (const lv of LEVELS) {
    const a = gen(c.id, lv, 12345), b = gen(c.id, lv, 12345);
    assert.strictEqual(a.stem + a.prompt + a.answer, b.stem + b.prompt + b.answer, c.id);
  }
});

test('doğru cevabın yeri hep aynı şıkta değil', () => {
  for (const c of B.CATS) for (const lv of LEVELS) {
    const hits = [0, 0, 0, 0];
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const q = gen(c.id, lv, seed * 104729 + lv);
      hits[q.answer]++;
      n = Math.max(n, q.options.length);
    }
    for (let i = 0; i < n; i++) assert.ok(hits[i] >= 40, c.id + ' s' + lv + ' şık ' + i + ': ' + hits.join('/'));
  }
});

test('küp sayma: her sütunun tepesi görünür; cevap toplam ya da 27 eksi toplam', () => {
  forEach('cubes', (q) => {
    const h = q.meta.heights;
    let sum = 0;
    for (let x = 0; x < h.length; x++) for (let y = 0; y < h[x].length; y++) {
      sum += h[x][y];
      if (x) assert.ok(h[x - 1][y] >= h[x][y], 'arkadaki sütun daha alçak olamaz');
      if (y) assert.ok(h[x][y - 1] >= h[x][y], 'arkadaki sütun daha alçak olamaz');
    }
    assert.strictEqual(value(q), q.prompt.indexOf('tamamlamak') > 0 ? 27 - sum : sum);
  });
});

test('sayı örüntüsü: boşluk dizideki sayıdır, sayılar 0-200 arasındadır ve kurala uyar', () => {
  forEach('numseq', (q) => {
    const s = q.meta.seq, k = q.meta.kind;
    assert.strictEqual(value(q), s[q.meta.hole]);
    for (const v of s) assert.ok(Number.isInteger(v) && v >= 0 && v <= 200, k + ' aralık dışı: ' + v);
    for (let i = 3; i < s.length; i++) {
      if (k === 'fib') assert.strictEqual(s[i], s[i - 1] + s[i - 2]);
      if (k === 'trib') assert.strictEqual(s[i], s[i - 1] + s[i - 2] + s[i - 3]);
      if (k === 'double') assert.strictEqual(s[i], 2 * s[i - 1]);
      if (k === 'triple') assert.strictEqual(s[i], 3 * s[i - 1]);
      if (k === 'diffdbl') assert.strictEqual(s[i] - s[i - 1], 2 * (s[i - 1] - s[i - 2]));
      if (k === 'grow2') assert.strictEqual((s[i] - s[i - 1]) - (s[i - 1] - s[i - 2]), (s[2] - s[1]) - (s[1] - s[0]));
      if (k === 'mul2add' || k === 'mul2sub') assert.strictEqual(s[i] - 2 * s[i - 1], s[1] - 2 * s[0]);
    }
    if (k === 'square') s.forEach((v) => assert.strictEqual(Math.sqrt(v) % 1, 0));
  });
});

test('meyve işlemleri: bütün satırlar meyve değerleriyle tutuyor', () => {
  forEach('fruit', (q) => {
    const m = q.meta;
    const side = (toks) => {
      let sum = 0, sign = 1;
      for (const t of toks) {
        if (t === '+') sign = 1; else if (t === '−') sign = -1;
        else sum += sign * (t === '?' ? m.ans : (m.vals[t] != null ? m.vals[t] : t));
      }
      return sum;
    };
    assert.strictEqual(value(q), m.ans);
    for (const line of m.lines) {
      const i = line.indexOf('=');
      const l = side(line.slice(0, i)), r = side(line.slice(i + 1));
      assert.strictEqual(l, r, m.kind + ': ' + line.join(' '));
      assert.ok(l >= 0, 'negatif sonuç olmamalı');
    }
  });
});

test('ok yolu: oklar ve robot komutları hedefe götürür, yanlış şıklar götürmez', () => {
  const D = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }, KEYS = ['U', 'R', 'D', 'L'];
  forEach('path', (q, lv) => {
    const m = q.meta;
    assert.deepStrictEqual(B.LogicUtil.walk(m.n, m.start, m.steps), m.target);
    assert.strictEqual(new Set(m.cells.map((c) => c.x + ',' + c.y)).size, 4, 'yiyecekler farklı karelerde');
    assert.ok(!m.cells.some((c) => c.x === m.start[0] && c.y === m.start[1]));
    assert.strictEqual(m.kind === 'robot', lv === 4);
    if (lv === 1) assert.strictEqual(m.kind, 'forward', 'en kolay kademede yalnız ok takibi sorulur');
    if (lv < 3) assert.ok(m.steps.every((st) => st.k === 1), 'ilk iki kademede oklar tek karelik');
    if (m.kind === 'robot') {
      // komutları bağımsız olarak yürüt
      let x = m.start[0], y = m.start[1], f = KEYS.indexOf(m.facing);
      for (const c of m.cmds) {
        if (c.t === 'R') f = (f + 1) % 4; else if (c.t === 'L') f = (f + 3) % 4;
        else { x += D[KEYS[f]][0] * c.k; y += D[KEYS[f]][1] * c.k; }
      }
      assert.deepStrictEqual([x, y], m.target);
      assert.ok(m.cmds[0].t !== 'R' || m.cmds[1].t !== 'R', 'baştan tam geri dönüş olmamalı');
    }
    if (m.kind === 'reverse') {
      q.options.forEach((o, i) => {
        const end = B.LogicUtil.walk(m.n, m.start, o.steps);
        assert.strictEqual(!!end && end[0] === m.target[0] && end[1] === m.target[1], i === q.answer, 'yalnız doğru şık hedefe varmalı');
      });
    } else assert.strictEqual(q.options[q.answer].key, 'e' + m.cells[0].e);
  });
});

test('sıralama: ipuçları sırayı tek biçimde belirler ve cevap doğru', () => {
  forEach('order', (q) => {
    const m = q.meta, n = m.order.length;
    // ipuçlarından çıkan "daha üstte" ilişkisinin geçişli kapanışı tam sıralama vermeli
    const above = Array.from({ length: n }, () => Array(n).fill(false));
    m.pairs.forEach((p) => { assert.ok(p[0] < p[1]); above[p[0]][p[1]] = true; });
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (above[i][k] && above[k][j]) above[i][j] = true;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(above[i][j], 'sıra belirsiz');
    if (m.ask === 'count') { assert.strictEqual(value(q), m.answer); assert.ok(m.answer >= 0 && m.answer < n); }
    else assert.strictEqual(q.options[q.answer].key, 't' + m.answer);
    if (m.ask === 'between') assert.strictEqual(q.options.length, n - 2);
  });
});

test('şifre çözme: cevap tablodan yeniden hesaplanınca aynı çıkar', () => {
  forEach('code', (q) => {
    const m = q.meta, num = (sq) => Number(sq.map((k) => m.digits[k]).join(''));
    assert.strictEqual(new Set(m.digits).size, m.digits.length);
    if (m.kind === 'decode') assert.strictEqual(q.options[q.answer].key, 'n' + num(m.seq));
    else if (m.kind === 'encode') { assert.ok(q.prompt.indexOf(String(num(m.seq))) > 0); assert.strictEqual(q.options[q.answer].key, 'r' + m.seq.join('')); }
    else if (m.kind === 'digitsum') assert.strictEqual(value(q), m.seq.reduce((a, k) => a + m.digits[k], 0));
    else {
      const r = m.kind === 'add' ? num(m.x) + num(m.y) : num(m.x) - num(m.y);
      assert.strictEqual(value(q), r);
      assert.ok(r >= 0 && r <= 99);
    }
  });
});

test('görsel hafıza: sorulan resim gerçekten gösterilmiş ya da gösterilmemiş', () => {
  forEach('memory', (q) => {
    const m = q.meta, ans = q.options[q.answer].key.slice(1), rest = q.options.filter((_, i) => i !== q.answer).map((o) => o.key.slice(1));
    assert.strictEqual(q.memo.seconds, m.shown.length);
    if (m.kind === 'where') assert.strictEqual(m.shown[m.hole], ans);
    else {
      assert.ok(m.shown.indexOf(ans) < 0, 'yeni ya da olmayan resim gösterilenlerde bulunmamalı');
      rest.forEach((e) => assert.ok(m.shown.indexOf(e) >= 0));
      if (m.kind === 'new') rest.forEach((e) => assert.notStrictEqual(e, m.shown[m.hole], 'giden resim şıklarda olmamalı'));
    }
  });
});

test('şekil sayma: iç içe şekillerde toplam bağımsız sayımla aynı', () => {
  forEach('count', (q) => {
    const m = q.meta;
    assert.strictEqual(value(q), m.total);
    if (m.kind === 'grid') {
      let n = 0;
      for (let s = 1; s <= Math.min(m.rows, m.cols); s++) for (let r = 0; r + s <= m.rows; r++) for (let c = 0; c + s <= m.cols; c++) n++;
      assert.strictEqual(m.total, n);
    }
    if (m.kind === 'fan' || m.kind === 'fanline') {
      // tepe noktasını içeren her üçgen: iki ışın (i < j) ve bir yatay düzey
      let n = 0;
      for (let i = 0; i <= m.n; i++) for (let j = i + 1; j <= m.n; j++) for (let l = 0; l <= m.lines; l++) n++;
      assert.strictEqual(m.total, n);
    }
    if (m.kind === 'diag') assert.strictEqual(m.total, 8);
  });
});

test('sayı makinesi: bütün satırlar kurala uyar; iki girişli örnekler tek kurala uyar', () => {
  const U = B.ExtraUtil;
  forEach('machine', (q, lv) => {
    const m = q.meta;
    assert.strictEqual(value(q), m.ans);
    assert.strictEqual(new Set(m.rows.map((r) => r.ins.join())).size, 4, 'girişler farklı');
    for (const r of m.rows) assert.ok(Number.isInteger(r.out) && r.out >= 0 && r.out <= 60, 'çıkan aralık dışı: ' + r.out);
    if (lv === 1) assert.strictEqual(m.rows[3].out, m.ans, 'en kolay kademede hep çıkan sayı sorulur');
    if (lv === 4) {
      for (const r of m.rows) assert.strictEqual(U.RULES2[m.rule][0](r.ins[0], r.ins[1]), r.out);
      const fits = Object.keys(U.RULES2).filter((k) => m.rows.slice(0, 3).every((r) => U.RULES2[k][0](r.ins[0], r.ins[1]) === r.out));
      assert.deepStrictEqual(fits, [m.rule]);
    } else if (m.rule === 'add' || m.rule === 'sub') {
      assert.ok(m.rows.every((r) => r.out - r.ins[0] === m.rows[0].out - m.rows[0].ins[0]));
    } else for (const r of m.rows) assert.strictEqual(U.RULES1[m.rule][0](r.ins[0]), r.out);
  });
});

test('terazi: zincir eksiksiz; dengeli terazilerde cevap doğru', () => {
  forEach('balance', (q, lv) => {
    const m = q.meta;
    if (lv === 4) { assert.strictEqual(value(q), m.kind === 'chain' ? m.k * m.m : m.m + 1); return; }
    assert.strictEqual(m.pairs.length, m.n - 1);
    assert.strictEqual(new Set(m.pairs.map((p) => Math.min(p[0], p[1]))).size, m.n - 1, 'her komşu çift bir kez karşılaştırılır');
    for (const p of m.pairs) assert.strictEqual(Math.abs(p[0] - p[1]), 1);
    if (m.ask === 'count') assert.strictEqual(value(q), m.answer);
  });
});

test('kim hangisi: ipuçlarının tek çözümü var, gereksiz ipucu yok, cevap hazır verilmemiş', () => {
  forEach('who', (q, lv) => {
    const m = q.meta, sols = B.ExtraUtil.solutions(m.n, m.clues);
    assert.strictEqual(sols.length, 1);
    assert.deepStrictEqual(sols[0], Array.from({ length: m.n }, (_, i) => i));
    assert.ok(!m.clues.some((c) => c.t === 'is' && c.kid === m.ask), 'cevap ipucunda hazır verilmemeli');
    assert.strictEqual(q.options.length, m.n);
    if (lv > 2) {
      for (const c of m.clues) assert.ok(B.ExtraUtil.solutions(m.n, m.clues.filter((x) => x !== c)).length > 1, 'gereksiz ipucu');
      assert.ok(m.clues.length >= 3 && m.clues.length <= 5);
    }
    if (lv === 4) assert.ok(!m.clues.some((c) => c.t === 'is'));
    if (lv === 1) assert.strictEqual(m.n, 3);
  });
});

test('döndürme (en zor kademe): iki adımın sonucu bağımsız hesapla aynı', () => {
  const cw = (m) => m.map((_, r) => m.map((__, c) => m[m.length - 1 - c][r]));
  const lr = (m) => m.map((row) => row.slice().reverse()), ud = (m) => m.slice().reverse();
  for (let seed = 1; seed <= RUNS; seed++) {
    const q = gen('rotate', 4, seed), m = q.meta;
    const turn = (g) => { for (let i = 0; i < m.turn / 90; i++) g = cw(g); return g; };
    const flip = m.water ? ud : lr;
    assert.deepStrictEqual(m.result, m.turnFirst ? flip(turn(m.m)) : turn(flip(m.m)));
    assert.ok(q.options[q.answer].key.indexOf(m.result.map((r) => r.join('')).join('/')) === 1);
  }
});

test('kareli şekil dönüşümleri: dört çeyrek tur başa döner, ayna iki kez uygulanınca aynı kalır', () => {
  const G = B.Shapes.Grid, m = [[1, 0, 0], [2, 1, 0], [0, 0, 0]];
  assert.deepStrictEqual(G.rot(m), [[0, 2, 1], [0, 1, 0], [0, 0, 0]]);
  assert.deepStrictEqual(G.rot(G.rot(G.rot(G.rot(m)))), m);
  assert.deepStrictEqual(G.flipH(G.flipH(m)), m);
  assert.deepStrictEqual(G.flipV(m), [[0, 0, 0], [2, 1, 0], [1, 0, 0]]);
  assert.deepStrictEqual(G.tf(m, { rot: 180, mirror: false }), G.rot(G.rot(m)));
  assert.deepStrictEqual(G.tf(m, { rot: 180, mirror: true }), G.flipV(m), 'ayna + yarım tur = su yansıması');
  const n = G.nudge(new B.RNG(5), m, 2, ['move']);
  assert.notDeepStrictEqual(n, m);
  assert.strictEqual(n.flat().filter(Boolean).length, 3, 'taşıma kare sayısını değiştirmez');
});

test('şekil anahtarı: simetrik şekillerde dönüş fark yaratmaz', () => {
  const K = B.Shapes.key;
  assert.strictEqual(K({ shape: 'square', color: 'red', rot: 90 }), K({ shape: 'square', color: 'red' }));
  assert.strictEqual(K({ shape: 'hexagon', color: 'red', rot: 180 }), K({ shape: 'hexagon', color: 'red' }));
  assert.notStrictEqual(K({ shape: 'arrow', color: 'red', rot: 90 }), K({ shape: 'arrow', color: 'red' }));
  assert.notStrictEqual(K({ shape: 'arrow', color: 'red', rot: 45 }), K({ shape: 'arrow', color: 'red', rot: 90 }));
  assert.notStrictEqual(K({ shape: 'circle', color: 'red' }), K({ shape: 'circle', color: 'blue' }));
});

test('sayısal şıklar verilen alt ve üst sınırın dışına çıkmaz', () => {
  for (let seed = 1; seed <= 200; seed++) for (let c = 0; c <= 5; c++) {
    const q = B.Q.finishNum(new B.RNG(seed), {}, c, { min: 0, max: 5 });
    assert.strictEqual(q.options.length, 4);
    assert.strictEqual(q.options[q.answer].value, c);
    for (const o of q.options) assert.ok(o.value >= 0 && o.value <= 5);
  }
});

test('şekil tablosu (üst üste koyma): üçüncü sütun ilk ikisinin birleşimi ya da farkı', () => {
  let seen = 0;
  for (const lv of [3, 4]) for (let seed = 1; seed <= RUNS; seed++) {
    const q = gen('matrix', lv, seed), m = q.meta;
    if (!m) continue;
    seen++;
    m.rows.forEach((row) => row[2].forEach((line, r) => line.forEach((v, c) => {
      const a = row[0][r][c], b = row[1][r][c];
      if (m.kind === 'union') { assert.ok(!(a && b), 'birleşimde parçalar çakışmaz'); assert.strictEqual(v, a || b ? 1 : 0); }
      else assert.strictEqual(v, a !== b ? 1 : 0);
    })));
    const ans = m.rows[Math.floor(m.hole / 3)][m.hole % 3];
    assert.strictEqual(q.options[q.answer].key, 'g' + ans.map((r) => r.join('')).join('/'));
    if (m.kind === 'union') assert.strictEqual(m.hole % 3, 2, 'birleşimde yalnız üçüncü sütun sorulur');
  }
  assert.ok(seen > 100);
});

test('dört kademe var ve adları Kolay, Orta, Zor, En Zor', () => {
  assert.deepStrictEqual(B.LEVELS, [1, 2, 3, 4]);
  assert.deepStrictEqual(B.LEVEL_NAMES.slice(1), ['Kolay', 'Orta', 'Zor', 'En Zor']);
});

test('kademe yükseldikçe sorular büyür: küp sayısı, hafıza resmi, sıralamadaki kişi sayısı', () => {
  const avg = (fn) => LEVELS.map((lv) => { let t = 0; for (let seed = 1; seed <= 200; seed++) t += fn(gen.apply(null, [fn.id, lv, seed])); return t / 200; });
  const cubes = (q) => q.meta.heights.flat().reduce((a, b) => a + b, 0); cubes.id = 'cubes';
  const pics = (q) => q.meta.shown.length; pics.id = 'memory';
  const kids = (q) => q.meta.order.length; kids.id = 'order';
  for (const fn of [cubes, pics, kids]) {
    const a = avg(fn);
    for (let i = 1; i < a.length; i++) assert.ok(a[i] >= a[i - 1], fn.id + ': ' + a.join(' < '));
    assert.ok(a[3] > a[0], fn.id);
  }
});

test('öncüllü sorularda soru cümlesi öncüllerin altında gösterilir', () => {
  for (const lv of LEVELS) for (let seed = 1; seed <= 50; seed++) {
    assert.strictEqual(gen('who', lv, seed).promptBelow, true);
    assert.strictEqual(gen('order', lv, seed).promptBelow, true);
    assert.ok(!gen('pattern', lv, seed).promptBelow);
  }
});

test('üst üste çizgiler: her iki çizgi kesişir, sıra tek biçimde belirlenir ve cevap sırayla tutar', () => {
  const cross = (a, b) => {
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const A = [a.x0, a.y0], B2 = [a.x1, a.y1], C = [b.x0, b.y0], D = [b.x1, b.y1];
    return d(A, B2, C) * d(A, B2, D) < 0 && d(C, D, A) * d(C, D, B2) < 0;
  };
  forEach('stack', (q, lv) => {
    const m = q.meta, n = m.n, L = m.lines;
    assert.strictEqual(n, [0, 4, 5, 5, 6][lv]);
    assert.strictEqual(new Set(m.order).size, n, 'her çizgi ayrı renkte');
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(cross(L[i], L[j]), 'kesişmeyen çizgi çifti');
    const styles = new Set(L.map((l) => l.style));
    if (lv < 3) assert.deepStrictEqual(Array.from(styles), ['straight']);
    if (lv === 3) { assert.strictEqual(styles.size, 1); assert.ok(!styles.has('straight')); }
    if (m.ask === 'rank' || m.ask === 'above' || m.ask === 'below') {
      assert.strictEqual(q.options[q.answer].key, 'l' + m.answer);
      if (m.ask === 'above') assert.strictEqual(m.order.indexOf(m.answer), m.ref + 1);
      if (m.ask === 'below') assert.strictEqual(m.order.indexOf(m.answer), m.ref - 1);
    } else {
      assert.strictEqual(value(q), m.answer);
      assert.strictEqual(m.answer, m.ask === 'countAbove' ? n - 1 - m.ref : m.ref);
      for (const o of q.options) assert.ok(o.value <= n - 1);
    }
    assert.strictEqual(m.ask === 'rank', lv < 4);
  });
});

test('döndürme: sağa ya da sola sayılı çeyrek turların sonucu bağımsız hesapla aynı', () => {
  const cw = (m) => m.map((_, r) => m.map((__, c) => m[m.length - 1 - c][r]));
  const seen = new Set();
  for (const lv of [1, 2, 3]) for (let seed = 1; seed <= RUNS; seed++) {
    const q = gen('rotate', lv, seed), m = q.meta;
    let g = m.m;
    for (let i = 0; i < (m.right ? m.k : 4 - m.k); i++) g = cw(g);      // sola k kez = sağa 4 - k kez
    assert.deepStrictEqual(m.result, g);
    assert.ok(q.options[q.answer].key.indexOf(g.map((r) => r.join('')).join('/')) === 1);
    assert.ok(m.k >= 1 && m.k <= (lv === 1 ? 2 : 3));
    if (!/yarım tur/.test(q.prompt)) assert.ok(q.prompt.indexOf((m.right ? 'sağa' : 'sola') + ' doğru ' + ['', 'bir', 'iki', 'üç'][m.k] + ' kez') > 0, q.prompt);
    seen.add((m.right ? 'sağa' : 'sola') + m.k);
  }
  assert.strictEqual(seen.size, 6, 'iki yön ve bir, iki, üç kez dönüşlerin hepsi çıkıyor');
});
