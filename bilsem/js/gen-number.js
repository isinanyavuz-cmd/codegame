/* Zekâ Kâşifi — sayı bulmacaları: sayı örüntüsü, meyve işlemleri, şifre çözme */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS;
  const ER = { 1: "1'er", 2: "2'şer", 3: "3'er", 4: "4'er", 5: "5'er", 6: "6'şar", 7: "7'şer", 8: "8'er", 9: "9'ar", 10: "10'ar" };

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
    const kind = rng.pick(level === 1 ? ['add', 'add', 'sub'] : level === 2 ? ['add', 'add', 'sub', 'alt'] : ['grow', 'double', 'inter', 'updown']);
    const seq = [];
    let why, minHole = 2;

    if (kind === 'add') {
      const d = level === 1 ? rng.pick([1, 2, 2, 5, 10]) : rng.pick([3, 4, 6, 7, 8, 9]);
      const a = rng.int(1, level === 1 ? 12 : 20);
      for (let i = 0; i < 6; i++) seq.push(a + i * d);
      why = 'Sayılar ' + ER[d] + ' artıyor.';
    } else if (kind === 'sub') {
      const d = level === 1 ? rng.pick([1, 2, 5]) : rng.pick([3, 4, 5, 6, 10]);
      const a = d * 5 + rng.int(d === 10 ? 0 : 1, level === 1 ? 10 : 30);
      for (let i = 0; i < 6; i++) seq.push(a - i * d);
      why = 'Sayılar ' + ER[d] + ' azalıyor.';
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
      minHole = 4;
    } else if (kind === 'double') {
      const a = rng.int(1, 3);
      for (let i = 0; i < 6; i++) seq.push(a * Math.pow(2, i));
      why = 'Her sayı bir öncekinin 2 katı.';
      minHole = 3;
    } else if (kind === 'inter') {
      const a = rng.int(1, 5), da = rng.pick([1, 2]), db = rng.pick([5, 10]), b = db * rng.int(2, 4);
      for (let i = 0; i < 4; i++) { seq.push(a + i * da); seq.push(b + i * db); }
      why = 'İki örüntü iç içe: ' + [0, 1, 2, 3].map((i) => a + i * da).join(', ') + ' ve ' + [0, 1, 2, 3].map((i) => b + i * db).join(', ') + '.';
      minHole = 4;
    } else {
      const up = rng.int(3, 6), down = rng.int(1, up - 1);
      let v = rng.int(1, 10);
      for (let i = 0; i < 7; i++) { seq.push(v); v += i % 2 ? -down : up; }
      why = 'Sayılar önce ' + up + ' artıyor, sonra ' + down + ' azalıyor: +' + up + ', −' + down + ', +' + up + ', −' + down + '…';
      minHole = 4;
    }

    const last = seq.length - 1;
    const hole = level === 1 ? last : (rng.chance(0.5) ? last : rng.int(minHole, last));
    q.stem = seqSvg(seq, hole);
    q.meta = { seq: seq, hole: hole, kind: kind };
    q.explain = why + ' Boş yere ' + seq[hole] + ' gelmeli.';
    const prev = seq[hole - 1], nxt = hole < last ? seq[hole + 1] : null;
    return Q.finishNum(rng, q, seq[hole], { min: 0, prefer: rng.shuffle([prev + 1, nxt != null ? nxt - 1 : seq[hole] + 10]).slice(0, 1) });
  };

  /* ---------- Meyve İşlemleri ---------- */
  const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍒', '🍐'];

  function eqHtml(lines, fr) {
    const tok = (t) => {
      if (t === 'A' || t === 'B' || t === 'C') return '<span class="eq-em">' + fr[t] + '</span>';
      if (t === '?') return '<span class="eq-q">?</span>';
      if (t === '+' || t === '−' || t === '=') return '<span class="eq-op">' + t + '</span>';
      return '<span class="eq-n">' + t + '</span>';
    };
    return '<div class="eq">' + lines.map((l) => '<div class="eq-row">' + l.map(tok).join('') + '</div>').join('') + '</div>';
  }

  B.GEN.fruit = function (rng, level) {
    const q = { prompt: 'Her meyve bir sayıyı gösteriyor. Soru işaretinin yerine hangi sayı gelmeli?' };
    const f = rng.sample(FRUITS, 3), fr = { A: f[0], B: f[1], C: f[2] };
    const v = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
    let a = v[0], b = v[1], c = v[2];
    let lines, ans, why, prefer;
    const kind = rng.pick(level === 1 ? ['one', 'two', 'given'] : level === 2 ? ['chain', 'sum', 'triple'] : ['all', 'sumdiff', 'elim']);
    const A = fr.A, Bq = fr.B, C = fr.C;

    if (kind === 'one') {
      lines = [['A', '+', 'A', '=', 2 * a], ['A', '=', '?']];
      ans = a; prefer = [2 * a];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '.';
    } else if (kind === 'two') {
      lines = [['A', '+', 'A', '=', 2 * a], ['A', '+', 'B', '=', a + b], ['B', '=', '?']];
      ans = b; prefer = [a, a + b];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '.';
    } else if (kind === 'given') {
      lines = [['A', '=', a], ['A', '+', 'B', '=', a + b], ['B', '+', 'B', '=', '?']];
      ans = 2 * b; prefer = [b, a + b];
      why = a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' + ' + b + ' = ' + 2 * b + '.';
    } else if (kind === 'chain') {
      lines = [['A', '+', 'A', '=', 2 * a], ['A', '+', 'B', '=', a + b], ['B', '+', 'C', '=', b + c], ['C', '=', '?']];
      ans = c; prefer = [b, a];
      why = A + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' + ' + C + ' = ' + (b + c) + ' ise ' + C + ' = ' + c + '.';
    } else if (kind === 'sum') {
      lines = [['A', '+', 'A', '=', 2 * a], ['B', '+', 'B', '+', 'B', '=', 3 * b], ['A', '+', 'B', '=', '?']];
      ans = a + b; prefer = [2 * a + 3 * b, a, b];
      why = A + ' + ' + A + ' = ' + 2 * a + ' ise ' + A + ' = ' + a + '. Üç ' + Bq + ' ' + 3 * b + ' ediyorsa ' + Bq + ' = ' + b + '. ' + a + ' + ' + b + ' = ' + (a + b) + '.';
    } else if (kind === 'triple') {
      lines = [['A', '+', 'A', '+', 'A', '=', 3 * a], ['A', '+', 'B', '=', a + b], ['A', '+', 'B', '+', 'B', '=', '?']];
      ans = a + 2 * b; prefer = [a + b, 2 * a + b];
      why = 'Üç ' + A + ' ' + 3 * a + ' ediyorsa ' + A + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '. ' + a + ' + ' + b + ' + ' + b + ' = ' + (a + 2 * b) + '.';
    } else if (kind === 'all') {
      if (b < c) { const t = b; b = c; c = t; }
      lines = [['A', '+', 'A', '+', 'A', '=', 3 * a], ['A', '+', 'B', '+', 'B', '=', a + 2 * b], ['B', '−', 'C', '=', b - c], ['A', '+', 'B', '+', 'C', '=', '?']];
      ans = a + b + c; prefer = [a + b, a + 2 * b];
      why = A + ' = ' + a + '. ' + a + ' + ' + Bq + ' + ' + Bq + ' = ' + (a + 2 * b) + ' ise ' + Bq + ' = ' + b + '. ' + b + ' − ' + C + ' = ' + (b - c) + ' ise ' + C + ' = ' + c + '. Toplam ' + a + ' + ' + b + ' + ' + c + ' = ' + (a + b + c) + '.';
    } else if (kind === 'sumdiff') {
      if (a < b) { const t = a; a = b; b = t; }
      lines = [['A', '+', 'B', '=', a + b], ['A', '−', 'B', '=', a - b], ['A', '=', '?']];
      ans = a; prefer = [b, a + b];
      why = 'Toplamları ' + (a + b) + ', farkları ' + (a - b) + ' olan iki sayı ' + a + ' ve ' + b + '. Büyük olan ' + A + ' = ' + a + '.';
    } else {
      lines = [['A', '+', 'A', '+', 'B', '=', 2 * a + b], ['A', '+', 'B', '=', a + b], ['B', '=', '?']];
      ans = b; prefer = [a, a + b];
      why = 'İki satırın farkı bir ' + A + ': ' + (2 * a + b) + ' − ' + (a + b) + ' = ' + a + '. ' + a + ' + ' + Bq + ' = ' + (a + b) + ' ise ' + Bq + ' = ' + b + '.';
    }

    q.stem = eqHtml(lines, fr);
    q.speech = 'Her meyve bir sayıyı gösteriyor. Soru işaretinin yerine hangi sayı gelmeli?';
    q.meta = { kind: kind, a: a, b: b, c: c, ans: ans };
    q.explain = why;
    return Q.finishNum(rng, q, ans, { min: 0, prefer: prefer });
  };

  /* ---------- Şifre Çözme ---------- */
  function codeTable(syms, digits) {
    const s = 62, n = syms.length, pad = 6, W = pad * 2 + n * s, H = pad * 2 + s * 2;
    let inner = '<rect x="' + pad + '" y="' + pad + '" width="' + n * s + '" height="' + s * 2 + '" rx="14" fill="#fff" stroke="' + S.INK + '" stroke-width="3"/>' +
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
    const n = level + 2;
    let syms;
    if (level < 3) {
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'plus', 'hexagon'], n), co = rng.sample(COL, n);
      syms = sh.map((s, i) => ({ shape: s, color: co[i] }));
    } else {
      // aynı şekil farklı renklerle: hem şekle hem renge dikkat etmek gerekir
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart'], 3), co = rng.sample(COL, 3), all = [];
      sh.forEach((s) => co.forEach((c) => all.push({ shape: s, color: c })));
      syms = rng.sample(all, n);
    }
    const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], n);
    const len = level === 1 ? rng.int(2, 3) : level === 2 ? 4 : rng.int(4, 5);
    let seq;
    do { seq = Array.from({ length: len }, () => rng.int(0, n - 1)); } while (new Set(seq).size < 2);
    const reverse = level > 1 && rng.chance(level === 2 ? 0.35 : 0.5);
    const numOf = (sq) => sq.map((k) => digits[k]).join('');
    const t = codeTable(syms, digits);

    // yanlış diziler: komşu iki öğeyi değiştir, bir öğeyi başkasıyla değiştir, ters çevir
    const muts = [];
    for (let i = 0; i < len - 1; i++) {
      if (seq[i] !== seq[i + 1]) { const m = seq.slice(); m[i] = seq[i + 1]; m[i + 1] = seq[i]; muts.push(m); }
    }
    for (let i = 0; i < len; i++) {
      for (let k = 0; k < n; k++) if (k !== seq[i]) { const m = seq.slice(); m[i] = k; muts.push(m); }
    }
    muts.push(seq.slice().reverse());
    const wrongSeqs = rng.shuffle(muts);
    const q = { meta: { digits: digits, seq: seq, reverse: reverse } };

    if (!reverse) {
      q.prompt = 'Şifre tablosuna göre alttaki şekiller hangi sayıyı gösterir?';
      const s = 54, rowW = len * (s + 6) - 6;
      const W = Math.max(t.w, rowW + 12), H = t.h + 22 + s + 6;
      q.stem = S.svg(W, H, '<g transform="translate(' + (W - t.w) / 2 + ' 0)">' + t.inner + '</g>' + symRow(syms, seq, s, (W - rowW) / 2, t.h + 20), { maxW: W * 1.05 });
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
