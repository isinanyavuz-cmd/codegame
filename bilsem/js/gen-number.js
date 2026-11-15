/* Sayı bulmacaları: sayı örüntüsü, meyve işlemleri, şifre çözme */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS;
  const ER = { 3: "3'er", 4: "4'er", 5: "5'er", 6: "6'şar", 7: "7'şer", 8: "8'er", 9: "9'ar", 10: "10'ar" };

  /* ---------- Sayı Örüntüsü ---------- */
  function seqSvg(vals, hole) {
    const s = 84, gap = 10, pad = 6, n = vals.length;
    let inner = '';
    for (let i = 0; i < n; i++) {
      const x = pad + i * (s + gap);
      inner += i === hole ? S.qtile(x, pad, s) : S.tile(x, pad, s) + S.text(x + s / 2, pad + s / 2, vals[i], vals[i] > 99 ? 32 : 40);
    }
    const W = pad * 2 + n * s + (n - 1) * gap;
    return S.svg(W, s + pad * 2, inner, { maxW: W * 0.9 });
  }

  B.GEN.numseq = function (rng, level) {
    const q = { prompt: 'Soru işaretinin yerine hangi sayı gelmeli?' };
    const kind = rng.pick([null, ['add', 'add', 'sub', 'alt'], ['grow', 'double', 'inter', 'updown'],
      ['fib', 'mul2add', 'triple', 'growdown', 'inter2', 'grow2'], ['trib', 'altmul', 'diffdbl', 'mul2sub', 'square']][level]);
    const seq = [];
    let why, minHole = 3;

    if (kind === 'add') {
      const d = rng.pick([3, 4, 6, 7, 8, 9]), a = rng.int(1, 20);
      for (let i = 0; i < 6; i++) seq.push(a + i * d);
      why = 'Sayılar ' + ER[d] + ' artıyor.';
      minHole = 2;
    } else if (kind === 'sub') {
      const d = rng.pick([3, 4, 5, 6, 10]), a = d * 5 + rng.int(d === 10 ? 0 : 1, 30);
      for (let i = 0; i < 6; i++) seq.push(a - i * d);
      why = 'Sayılar ' + ER[d] + ' azalıyor.';
      minHole = 2;
    } else if (kind === 'alt') {
      const st = rng.sample([1, 2, 3, 4, 5], 2);
      let v = rng.int(1, 10);
      for (let i = 0; i < 7; i++) { seq.push(v); v += st[i % 2]; }
      why = 'Sayılar sırayla ' + st[0] + ' ve ' + st[1] + ' artıyor: +' + st[0] + ', +' + st[1] + ', +' + st[0] + ', +' + st[1] + '…';
      minHole = 4;
    } else if (kind === 'grow') {
      const k = rng.pick([1, 1, 2]);
      let v = rng.int(1, 6);
      for (let i = 0; i < 6; i++) { seq.push(v); v += k * (i + 1); }
      why = 'Artış her adımda büyüyor: +' + k + ', +' + 2 * k + ', +' + 3 * k + ', +' + 4 * k + '…';
    } else if (kind === 'double') {
      const a = rng.int(1, 3);
      for (let i = 0; i < 6; i++) seq.push(a * Math.pow(2, i));
      why = 'Her sayı bir öncekinin 2 katı.';
    } else if (kind === 'inter') {
      const a = rng.int(1, 5), da = rng.pick([1, 2]), db = rng.pick([5, 10]), b = db * rng.int(2, 4);
      for (let i = 0; i < 4; i++) { seq.push(a + i * da); seq.push(b + i * db); }
      why = 'İki örüntü iç içe: ' + [0, 1, 2, 3].map((i) => a + i * da).join(', ') + ' ve ' + [0, 1, 2, 3].map((i) => b + i * db).join(', ') + '.';
      minHole = 4;
    } else if (kind === 'updown') {
      const up = rng.int(3, 6), down = rng.int(1, up - 1);
      let v = rng.int(1, 10);
      for (let i = 0; i < 7; i++) { seq.push(v); v += i % 2 ? -down : up; }
      why = 'Sayılar önce ' + up + ' artıyor, sonra ' + down + ' azalıyor: +' + up + ', −' + down + ', +' + up + ', −' + down + '…';
      minHole = 4;
    } else if (kind === 'fib') {
      const a = rng.int(1, 3), b = a + rng.int(1, 3);
      seq.push(a, b);
      for (let i = 2; i < 7; i++) seq.push(seq[i - 1] + seq[i - 2]);
      why = 'Her sayı kendinden önceki iki sayının toplamı: ' + seq[0] + ' + ' + seq[1] + ' = ' + seq[2] + ', ' + seq[1] + ' + ' + seq[2] + ' = ' + seq[3] + '…';
    } else if (kind === 'mul2add') {
      const k = rng.pick([1, 1, 2, 3]);
      let v = rng.int(1, 3);
      for (let i = 0; i < 6; i++) { seq.push(v); v = 2 * v + k; }
      why = 'Her sayı bir öncekinin 2 katının ' + k + ' fazlası.';
    } else if (kind === 'triple') {
      const a = rng.pick([1, 2]);
      for (let i = 0; i < 5; i++) seq.push(a * Math.pow(3, i));
      why = 'Her sayı bir öncekinin 3 katı.';
    } else if (kind === 'growdown') {
      const k = rng.pick([1, 2]);
      let v = 15 * k + rng.int(20, 40);
      for (let i = 0; i < 6; i++) { seq.push(v); v -= k * (i + 1); }
      why = 'Azalma her adımda büyüyor: −' + k + ', −' + 2 * k + ', −' + 3 * k + ', −' + 4 * k + '…';
    } else if (kind === 'inter2') {
      const a = rng.int(1, 9), da = rng.int(2, 4), b = rng.int(1, 3);
      for (let i = 0; i < 4; i++) { seq.push(a + i * da); seq.push(b * Math.pow(2, i)); }
      why = 'İki örüntü iç içe: ' + [0, 1, 2, 3].map((i) => a + i * da).join(', ') + ' (' + da + ' artıyor) ve ' +
        [0, 1, 2, 3].map((i) => b * Math.pow(2, i)).join(', ') + ' (2 katına çıkıyor).';
      minHole = 4;
    } else if (kind === 'grow2') {
      const p = rng.pick([[3, 2], [2, 3], [1, 3]]);       // ilk artış, artışın artışı
      let v = rng.int(1, 9);
      for (let i = 0; i < 6; i++) { seq.push(v); v += p[0] + i * p[1]; }
      why = 'Artış her adımda ' + p[1] + ' büyüyor: +' + p[0] + ', +' + (p[0] + p[1]) + ', +' + (p[0] + 2 * p[1]) + ', +' + (p[0] + 3 * p[1]) + '…';
    } else if (kind === 'trib') {
      const a = rng.int(1, 2), b = a + rng.int(0, 1), c = b + rng.int(1, 2);
      seq.push(a, b, c);
      for (let i = 3; i < 8; i++) seq.push(seq[i - 1] + seq[i - 2] + seq[i - 3]);
      why = 'Her sayı kendinden önceki üç sayının toplamı: ' + seq[0] + ' + ' + seq[1] + ' + ' + seq[2] + ' = ' + seq[3] + '…';
      minHole = 4;
    } else if (kind === 'altmul') {
      const add = rng.chance(0.6), k = add ? rng.int(1, 4) : 1;
      let v = add ? rng.int(1, 3) : rng.int(2, 4);
      for (let i = 0; i < 7; i++) { seq.push(v); v = i % 2 ? (add ? v + k : v - k) : v * 2; }
      why = 'Sırayla iki işlem yapılıyor: önce 2 katı alınıyor, sonra ' + k + (add ? ' ekleniyor' : ' çıkarılıyor') + '. ×2, ' + (add ? '+' : '−') + k + ', ×2, ' + (add ? '+' : '−') + k + '…';
      minHole = 4;
    } else if (kind === 'diffdbl') {
      let v = rng.int(1, 9), d = rng.pick([1, 1, 2, 3]);
      const first = d;
      for (let i = 0; i < 6; i++) { seq.push(v); v += d; d *= 2; }
      why = 'Artış her adımda 2 katına çıkıyor: +' + first + ', +' + 2 * first + ', +' + 4 * first + ', +' + 8 * first + '…';
    } else if (kind === 'mul2sub') {
      const k = rng.int(1, 3);
      let v = k + rng.int(1, 2);
      for (let i = 0; i < 6; i++) { seq.push(v); v = 2 * v - k; }
      why = 'Her sayı bir öncekinin 2 katının ' + k + ' eksiği.';
    } else {
      const a = rng.int(1, 3);
      for (let i = 0; i < 7; i++) seq.push((a + i) * (a + i));
      why = 'Sayılar ' + a + ' × ' + a + ', ' + (a + 1) + ' × ' + (a + 1) + ', ' + (a + 2) + ' × ' + (a + 2) + '… diye gidiyor. Artışlar ikişer büyüyor: +' +
        (2 * a + 1) + ', +' + (2 * a + 3) + ', +' + (2 * a + 5) + '…';
    }

    const last = seq.length - 1, hole = rng.chance(0.4) ? last : rng.int(Math.min(minHole, last), last);
    q.stem = seqSvg(seq, hole);
    q.meta = { seq: seq, hole: hole, kind: kind };
    q.explain = why + ' Boş yere ' + seq[hole] + ' gelmeli.';
    const d = Math.abs(seq[hole] - seq[hole - 1]);
    return Q.finishNum(rng, q, seq[hole], { min: 0, prefer: rng.shuffle([seq[hole - 1] + d + 1, seq[hole] - 2, seq[hole] + 2, seq[hole] + 10]).slice(0, 2) });
  };

  /* ---------- Meyve İşlemleri ---------- */
  const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍒', '🍐'];

  function eqHtml(lines, fr) {
    const tok = (t) => {
      if (fr[t]) return '<span class="eq-em">' + fr[t] + '</span>';
      if (t === '?') return '<span class="eq-q">?</span>';
      if (t === '+' || t === '−' || t === '=') return '<span class="eq-op">' + t + '</span>';
      return '<span class="eq-n">' + t + '</span>';
    };
    return '<div class="eq">' + lines.map((l) => '<div class="eq-row">' + l.map(tok).join('') + '</div>').join('') + '</div>';
  }

  B.GEN.fruit = function (rng, level) {
    const q = { prompt: 'Her meyve bir sayıyı gösteriyor. Soru işaretinin yerine hangi sayı gelmeli?' };
    const f = rng.sample(FRUITS, 4), fr = { A: f[0], B: f[1], C: f[2], D: f[3] };
    const v = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
    let a = v[0], b = v[1], c = v[2], d = v[3];
    let lines, ans, why, prefer;
    const kind = rng.pick([null, ['chain', 'sum', 'triple'], ['all', 'sumdiff', 'elim'], ['swap', 'sub', 'four'], ['tri', 'ratio', 'mix']][level]);
    const A = fr.A, Bq = fr.B, C = fr.C, D = fr.D;

    if (kind === 'chain') {
      lines = [['A', '+', 'A', '=', 2 * a], ['A', '+', 'B', '=', a + b], ['B', '+', 'C', '=', b + c], ['C', '=', '?']];
      ans = c; prefer = [b, a];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' + ' + C + ' = ' + (b + c) + ' ise ' + C + ' = ' + c + '.';
    } else if (kind === 'sum') {
      lines = [['A', '+', 'A', '=', 2 * a], ['B', '+', 'B', '+', 'B', '=', 3 * b], ['A', '+', 'B', '=', '?']];
      ans = a + b; prefer = [a, b, 2 * a + 3 * b];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '. Üç ' + Bq + ' ' + 3 * b + ' ediyorsa ' + Bq + ' = ' + b + '. ' + a + ' + ' + b + ' = ' + (a + b) + '.';
    } else if (kind === 'triple') {
      lines = [['A', '+', 'A', '+', 'A', '=', 3 * a], ['A', '+', 'B', '=', a + b], ['A', '+', 'B', '+', 'B', '=', '?']];
      ans = a + 2 * b; prefer = [a + b, 2 * a + b];
      why = 'Üç ' + A + ' ' + 3 * a + ' ediyorsa ' + A + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '. ' + a + ' + ' + b + ' + ' + b + ' = ' + (a + 2 * b) + '.';
    } else if (kind === 'all') {
      if (b < c) { const t = b; b = c; c = t; }
      lines = [['A', '+', 'A', '+', 'A', '=', 3 * a], ['A', '+', 'B', '+', 'B', '=', a + 2 * b], ['B', '−', 'C', '=', b - c], ['A', '+', 'B', '+', 'C', '=', '?']];
      ans = a + b + c; prefer = [a + b, a + 2 * b];
      why = A + ' = ' + a + '. ' + a + ' + ' + Bq + ' + ' + Bq + ' = ' + (a + 2 * b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' − ' + C + ' = ' + (b - c) + ' ise ' + C + ' = ' + c + '. Toplam ' + a + ' + ' + b + ' + ' + c + ' = ' + ans + '.';
    } else if (kind === 'sumdiff') {
      if (a < b) { const t = a; a = b; b = t; }
      lines = [['A', '+', 'B', '=', a + b], ['A', '−', 'B', '=', a - b], ['A', '=', '?']];
      ans = a; prefer = [b, a + b];
      why = 'Toplamları ' + (a + b) + ', farkları ' + (a - b) + ' olan iki sayı ' + a + ' ve ' + b + '. Büyük olan ' + A + ' = ' + a + '.';
    } else if (kind === 'elim') {
      lines = [['A', '+', 'A', '+', 'B', '=', 2 * a + b], ['A', '+', 'B', '=', a + b], ['B', '=', '?']];
      ans = b; prefer = [a, a + b];
      why = 'İki satırın farkı bir ' + A + ': ' + (2 * a + b) + ' − ' + (a + b) + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '.';
    } else if (kind === 'swap') {
      const ask = rng.pick(['A', 'B', 'AB']);
      lines = [['A', '+', 'A', '+', 'B', '=', 2 * a + b], ['A', '+', 'B', '+', 'B', '=', a + 2 * b], ask === 'AB' ? ['A', '+', 'B', '=', '?'] : [ask, '=', '?']];
      ans = ask === 'A' ? a : ask === 'B' ? b : a + b; prefer = [a, b, a + b];
      why = 'İki satırı toplayınca üç ' + A + ' ile üç ' + Bq + ' ' + (3 * a + 3 * b) + ' eder; yani ' + A + ' + ' + Bq + ' = ' + (a + b) + '. Bunu ilk satırdan çıkarınca ' +
        A + ' = ' + a + ', ikinci satırdan çıkarınca ' + Bq + ' = ' + b + ' bulunur.';
    } else if (kind === 'sub') {
      a = rng.pick([2, 4, 6, 8]); b = a / 2;
      c = rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== a && x !== b));
      lines = [['A', '+', 'A', '=', 2 * a], ['B', '+', 'B', '=', 'A'], ['A', '+', 'B', '+', 'C', '=', a + b + c], ['C', '=', '?']];
      ans = c; prefer = [a, b, a + b];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '. İki ' + Bq + ' bir ' + A + ' ediyorsa ' + Bq + ' = ' + b + '. ' + a + ' + ' + b + ' + ' + C + ' = ' + (a + b + c) + ' ise ' + C + ' = ' + c + '.';
    } else if (kind === 'four') {
      if (c < d) { const t = c; c = d; d = t; }
      lines = [['A', '+', 'A', '+', 'A', '=', 3 * a], ['A', '+', 'B', '+', 'B', '=', a + 2 * b], ['B', '+', 'C', '+', 'C', '=', b + 2 * c], ['C', '−', 'D', '=', c - d], ['A', '+', 'D', '=', '?']];
      ans = a + d; prefer = [a + c, c + d, d];
      why = A + ' = ' + a + '. ' + a + ' + ' + Bq + ' + ' + Bq + ' = ' + (a + 2 * b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' + ' + C + ' + ' + C + ' = ' + (b + 2 * c) + ' ise ' + C + ' = ' + c + '. ' +
        c + ' − ' + D + ' = ' + (c - d) + ' ise ' + D + ' = ' + d + '. ' + a + ' + ' + d + ' = ' + ans + '.';
    } else if (kind === 'tri') {
      const total = rng.chance(0.6), sum2 = 2 * (a + b + c);
      lines = [['A', '+', 'B', '=', a + b], ['B', '+', 'C', '=', b + c], ['A', '+', 'C', '=', a + c], total ? ['A', '+', 'B', '+', 'C', '=', '?'] : ['A', '=', '?']];
      ans = total ? a + b + c : a; prefer = total ? [sum2, a + b, b + c] : [b, c, a + b + c];
      why = 'Üç satırı toplayınca her meyveden ikişer tane olur: ' + (a + b) + ' + ' + (b + c) + ' + ' + (a + c) + ' = ' + sum2 + '. Yarısı ' + A + ' + ' + Bq + ' + ' + C + ' = ' + (a + b + c) + '.' +
        (total ? '' : ' Bundan ' + Bq + ' + ' + C + ' = ' + (b + c) + ' çıkarılınca ' + A + ' = ' + a + ' kalır.');
    } else if (kind === 'ratio') {
      const k = rng.int(1, 3), askA = rng.chance(0.5);
      a = 2 * k; b = 3 * k;
      lines = [['A', '+', 'A', '+', 'A', '=', 'B', '+', 'B'], ['A', '+', 'B', '=', a + b], [askA ? 'A' : 'B', '=', '?']];
      ans = askA ? a : b; prefer = [a, b, a + b];
      why = 'Toplamı ' + (a + b) + ' eden sayı çiftlerini dene. ' + A + ' = ' + a + ', ' + Bq + ' = ' + b + ' olunca üç ' + A + ' ' + 3 * a + ', iki ' + Bq + ' de ' + 2 * b + ' eder; ikisi eşit.';
    } else {
      lines = [['A', '+', 'B', '+', 'C', '=', a + b + c], ['A', '+', 'B', '=', a + b], ['B', '+', 'C', '=', b + c], ['B', '=', '?']];
      ans = b; prefer = [a, c, a + b];
      why = 'İlk satırdan ikinci satırı çıkarınca ' + C + ' = ' + (a + b + c) + ' − ' + (a + b) + ' = ' + c + '. Üçüncü satırda ' + Bq + ' + ' + c + ' = ' + (b + c) + ' ise ' + Bq + ' = ' + b + '.';
    }

    q.stem = eqHtml(lines, fr);
    q.speech = q.prompt;
    q.meta = { kind: kind, vals: { A: a, B: b, C: c, D: d }, lines: lines, ans: ans };
    q.explain = why;
    return Q.finishNum(rng, q, ans, { min: 0, prefer: prefer });
  };

  /* ---------- Şifre Çözme ---------- */
  function codeTable(syms, digits) {
    const s = 62, n = syms.length, pad = 6, W = pad * 2 + n * s, H = pad * 2 + s * 2;
    let inner = '<rect x="' + pad + '" y="' + pad + '" width="' + n * s + '" height="' + s * 2 + '" rx="14" fill="#fff"/>' +
      '<rect x="' + pad + '" y="' + (pad + s) + '" width="' + n * s + '" height="' + s + '" fill="#fff4cc"/>' +
      '<path d="M' + pad + ' ' + (pad + s) + 'h' + n * s + '" stroke="' + S.INK + '" stroke-width="3"/>';
    for (let i = 0; i < n; i++) {
      const x = pad + i * s;
      if (i) inner += '<path d="M' + x + ' ' + pad + 'v' + s * 2 + '" stroke="' + S.INK + '" stroke-opacity="0.35" stroke-width="2"/>';
      inner += S.figAt(syms[i], x + 6, pad + 6, s - 12) + S.text(x + s / 2, pad + s * 1.5, digits[i], 34);
    }
    inner += '<rect x="' + pad + '" y="' + pad + '" width="' + n * s + '" height="' + s * 2 + '" rx="14" fill="none" stroke="' + S.INK + '" stroke-width="3"/>';
    return { inner: inner, w: W, h: H };
  }
  function symRow(syms, seq, s, x0, y0) {
    return seq.map((k, i) => S.tile(x0 + i * (s + 6), y0, s) + S.figAt(syms[k], x0 + i * (s + 6) + 4, y0 + 4, s - 8)).join('');
  }

  B.GEN.code = function (rng, level) {
    const n = level === 1 ? 4 : level === 2 ? 5 : 6;
    let syms;
    if (level === 1) {
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'plus', 'hexagon'], n), co = rng.sample(COL, n);
      syms = sh.map((s, i) => ({ shape: s, color: co[i] }));
    } else {
      // aynı şekil farklı renklerle: hem şekle hem renge dikkat etmek gerekir
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart'], 3), co = rng.sample(COL, 3), all = [];
      sh.forEach((s) => co.forEach((c) => all.push({ shape: s, color: c })));
      syms = rng.sample(all, n);
    }
    const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], n);
    const t = codeTable(syms, digits), q = {};
    const numOf = (sq) => sq.map((k) => digits[k]).join('');
    const randSeq = (len) => { let s; do { s = Array.from({ length: len }, () => rng.int(0, n - 1)); } while (new Set(s).size < 2); return s; };
    const under = (inner, w, h) => { const W = Math.max(t.w, w + 12); return S.svg(W, t.h + h, '<g transform="translate(' + (W - t.w) / 2 + ' 0)">' + t.inner + '</g><g transform="translate(' + (W - w) / 2 + ' ' + t.h + ')">' + inner + '</g>', { maxW: W * 1.05 }); };
    const kind = rng.pick([null, ['decode', 'decode', 'encode'], ['decode', 'encode'], ['digitsum', 'decode', 'encode'], ['add', 'add', 'sub']][level]);

    if (kind === 'add' || kind === 'sub') {
      // iki basamaklı iki şifreli sayı ile işlem
      let x, y;
      do { x = randSeq(2); y = randSeq(2); } while (kind === 'add' ? Number(numOf(x)) + Number(numOf(y)) > 99 : Number(numOf(x)) - Number(numOf(y)) < 3);
      const X = Number(numOf(x)), Y = Number(numOf(y)), ans = kind === 'add' ? X + Y : X - Y, s = 54;
      const row = symRow(syms, x, s, 0, 14) + S.text(2 * s + 30, 14 + s / 2, kind === 'add' ? '+' : '−', 40, { fill: '#566889' }) +
        symRow(syms, y, s, 2 * s + 54, 14) + S.text(4 * s + 84, 14 + s / 2, '=', 40, { fill: '#566889' }) + S.qtile(4 * s + 108, 14, s);
      q.prompt = 'Şifre tablosuna göre alttaki işlemin sonucu kaç?';
      q.stem = under(row, 5 * s + 108, s + 20);
      q.meta = { digits: digits, kind: kind, x: x, y: y, ans: ans };
      q.explain = 'Şekilleri sayıya çevir: ' + X + (kind === 'add' ? ' + ' : ' − ') + Y + ' = ' + ans + '.';
      return Q.finishNum(rng, q, ans, { min: 0, prefer: [ans + 10, ans - 10, kind === 'add' ? ans - 1 : ans + 1] });
    }

    const len = level === 1 ? 4 : (level === 2 || kind === 'digitsum') ? rng.int(4, 5) : 6, seq = randSeq(len);
    q.meta = { digits: digits, kind: kind, seq: seq };
    if (kind === 'digitsum') {
      const s = 54, sum = seq.reduce((acc, k) => acc + digits[k], 0);
      q.prompt = 'Şifre tablosuna göre alttaki şekillerin gösterdiği rakamların toplamı kaç?';
      q.stem = under(symRow(syms, seq, s, 0, 14), len * (s + 6) - 6, s + 20);
      q.meta.ans = sum;
      q.explain = 'Şekilleri rakama çevirip topla: ' + seq.map((k) => digits[k]).join(' + ') + ' = ' + sum + '.';
      return Q.finishNum(rng, q, sum, { min: 1 });
    }
    // yanlış diziler: komşu iki öğeyi değiştir, bir öğeyi başkasıyla değiştir
    const muts = [];
    for (let i = 0; i < len - 1; i++) if (seq[i] !== seq[i + 1]) { const m = seq.slice(); m[i] = seq[i + 1]; m[i + 1] = seq[i]; muts.push(m); }
    for (let i = 0; i < len; i++) for (let k = 0; k < n; k++) if (k !== seq[i]) { const m = seq.slice(); m[i] = k; muts.push(m); }
    const wrongSeqs = rng.shuffle(muts);
    if (kind === 'decode') {
      const s = 54;
      q.prompt = 'Şifre tablosuna göre alttaki şekiller hangi sayıyı gösterir?';
      q.stem = under(symRow(syms, seq, s, 0, 14), len * (s + 6) - 6, s + 20);
      q.explain = 'Şekilleri sırayla sayıya çevir: ' + seq.map((k) => digits[k]).join(' - ') + '. Şifre ' + numOf(seq) + '.';
      const mkNum = (sq) => ({ html: '<span class="opt-num opt-num-sm">' + numOf(sq) + '</span>', key: 'n' + numOf(sq) });
      return Q.finish(rng, q, mkNum(seq), wrongSeqs.map(mkNum));
    }
    q.prompt = 'Şifre tablosuna göre ' + numOf(seq) + ' sayısı hangi şekillerle yazılır?';
    q.stem = S.svg(t.w, t.h + 58, t.inner + S.text(t.w / 2, t.h + 32, numOf(seq), 40), { maxW: t.w * 1.05 });
    q.layout = 'wide';
    q.explain = 'Her rakamın şeklini tablodan bul: ' + seq.map((k) => digits[k] + ' → ' + S.name(syms[k])).join(', ') + '.';
    const s = 46, rw = len * (s + 6) - 6;
    const mkRow = (sq) => ({ html: S.svg(rw + 8, s + 8, symRow(syms, sq, s, 4, 4), { cls: 'opt-svg opt-svg-row' }), key: 'r' + sq.join('') });
    return Q.finish(rng, q, mkRow(seq), wrongSeqs.map(mkRow));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
