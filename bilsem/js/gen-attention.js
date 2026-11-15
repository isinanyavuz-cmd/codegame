/* Dikkat ve hafıza: aynısını bul, şekil sayma, görsel hafıza */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q, G = S.Grid;
  const COL = S.COLOR_IDS, r1 = S.r1;

  /* ---------- Aynısını Bul ---------- */
  function randCells(rng, n, k, colors) {
    const m = Array.from({ length: n }, () => Array(n).fill(0)), all = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) all.push([r, c]);
    rng.sample(all, k).forEach((p) => { m[p[0]][p[1]] = rng.int(1, colors); });
    return m;
  }
  function figRow(figs, s, cls) {
    const gap = 6, W = figs.length * (s + gap) - gap + 8;
    const inner = figs.map((f, i) => S.tile(4 + i * (s + gap), 4, s) + S.figAt(f, 4 + i * (s + gap) + 3, 7, s - 6)).join('');
    return S.svg(W, s + 8, inner, cls ? { cls: cls } : { maxW: W });
  }

  B.GEN.same = function (rng, level) {
    const q = { prompt: 'Üstteki şeklin tıpatıp aynısı hangisi?' };
    if (rng.chance(0.6)) {
      const n = level + 3, colors = level === 4 ? 4 : 3, k = [0, 7, 11, 15, 21][level];
      const pal = rng.sample(COL, 4), m = randCells(rng, n, k, colors);
      const mk = (g) => ({ html: S.svg(100, 100, G.draw(g, pal, 6, 6, 88), { cls: 'opt-svg' }), key: G.key(g) });
      const wrong = [];
      for (let i = 0; i < 12; i++) wrong.push(mk(G.nudge(rng, m, colors, ['move', 'recolor', 'move'])));
      q.stem = S.svg(202, 202, G.draw(m, pal, 6, 6, 190), { maxW: 210 });
      q.explain = 'Satır satır karşılaştır. Diğer şıklarda tek bir kare başka yerde ya da başka renkte.';
      return Q.finish(rng, q, mk(m), wrong);
    }
    // şekil dizisi; en zor düzeyde şekillerin yönü de değişir
    const len = [0, 5, 6, 8, 9][level], turning = level === 4;
    const shapes = rng.sample(turning ? ['arrow', 'triangle', 'heart', 'drop'] : ['circle', 'square', 'triangle', 'star', 'heart', 'plus'], level < 3 ? 3 : 4);
    const cols = rng.sample(COL, 3);
    let seq;
    do {
      seq = Array.from({ length: len }, () => ({ shape: rng.pick(shapes), color: rng.pick(cols), rot: turning ? rng.pick([0, 90, 180, 270]) : 0 }));
    } while (new Set(seq.map(S.key)).size < 4);
    const mutate = () => {
      const x = seq.map((f) => Object.assign({}, f)), i = rng.int(0, len - 1);
      const kind = rng.pick(turning ? ['swap', 'color', 'rot', 'rot'] : ['swap', 'color', 'shape']);
      if (kind === 'swap') { const j = i < len - 1 ? i + 1 : i - 1, t = x[i]; x[i] = x[j]; x[j] = t; }
      else if (kind === 'color') x[i].color = rng.pick(cols.filter((c) => c !== x[i].color));
      else if (kind === 'rot') x[i].rot = (x[i].rot + rng.pick([90, 270])) % 360;
      else x[i].shape = rng.pick(shapes.filter((s) => s !== x[i].shape));
      return x;
    };
    const mk = (sq) => ({ html: figRow(sq, 46, 'opt-svg opt-svg-row'), key: sq.map(S.key).join('+') });
    const wrong = [];
    for (let i = 0; i < 14; i++) wrong.push(mk(mutate()));
    q.stem = figRow(seq, 64);
    q.layout = 'wide';
    q.explain = 'Soldan sağa tek tek karşılaştır. Diğer şıklarda bir şeklin yeri, rengi, biçimi ya da yönü farklı.';
    return Q.finish(rng, q, mk(seq), wrong);
  };

  /* ---------- Şekil Sayma ---------- */
  const CNT = ['circle', 'square', 'triangle', 'star', 'heart', 'plus'];

  /* İç içe şekiller: tepeden yelpaze gibi açılan üçgenler, kareli alan, köşegenli kare */
  function nested(rng, tier) {
    const q = {}, INK = S.INK;
    const kind = rng.pick(tier === 1 ? ['fan', 'grid'] : tier === 2 ? ['fan', 'fanline', 'grid'] : ['fanline', 'fanline', 'grid', 'diag']);
    let total, why, inner, W, H, prefer, dims = {};
    if (kind === 'fan' || kind === 'fanline') {
      const lines = kind === 'fan' ? 0 : tier === 2 ? 1 : rng.pick([1, 2]);
      const n = kind === 'fan' ? (tier === 1 ? rng.pick([2, 3, 3, 4]) : rng.pick([4, 5])) : (lines === 2 ? rng.pick([2, 3]) : tier === 2 ? rng.pick([2, 3]) : rng.pick([3, 4]));
      const base = n * (n + 1) / 2;
      total = base * (lines + 1);
      dims = { n: n, lines: lines };
      W = 300; H = 224;
      const ax = 150, ay = 14, by = 208, x0 = 22, x1 = 278;
      let d = '';
      for (let i = 1; i < n; i++) d += 'M' + ax + ' ' + ay + 'L' + r1(x0 + (x1 - x0) * i / n) + ' ' + by;
      for (let k = 1; k <= lines; k++) {
        const t = k / (lines + 1) * 0.92 + 0.04, y = ay + (by - ay) * t;
        d += 'M' + r1(ax + (x0 - ax) * t) + ' ' + r1(y) + 'H' + r1(ax + (x1 - ax) * t);
      }
      inner = '<path d="M' + ax + ' ' + ay + 'L' + x1 + ' ' + by + 'H' + x0 + 'Z" fill="#fff4cc" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="' + d + '" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" fill="none"/>';
      q.prompt = 'Bu şekilde toplam kaç üçgen var? Büyük küçük hepsini say.';
      const parts = [];
      for (let k = 1; k <= n; k++) parts.push(k + ' parçalı ' + (n - k + 1) + ' tane');
      why = 'Önce tabana kadar inen üçgenleri say: ' + parts.join(', ') + '; toplam ' + base + '.' +
        (lines ? ' Aynı üçgenler her yatay çizgide de biter. ' + base + ' × ' + (lines + 1) + ' = ' + total + ' üçgen.' : '');
      prefer = [n, base, n * (lines + 1), total - 1];
    } else if (kind === 'grid') {
      const rc = rng.pick(tier === 1 ? [[2, 2], [2, 3], [3, 3]] : tier === 2 ? [[3, 3], [2, 4], [3, 4]] : [[4, 4], [3, 4], [3, 5]]);
      const rows = rc[0], cols = rc[1], c = 300 / Math.max(cols, 4.6), parts = [];
      dims = { rows: rows, cols: cols };
      total = 0;
      for (let k = 1; k <= Math.min(rows, cols); k++) {
        const cnt = (rows - k + 1) * (cols - k + 1);
        total += cnt;
        parts.push(k === 1 ? 'küçük kareler ' + cnt + ' tane' : k * k + ' küçük kareden oluşan kareler ' + cnt + ' tane');
      }
      W = cols * c + 16; H = rows * c + 16;
      let d = '';
      for (let i = 1; i < cols; i++) d += 'M' + r1(8 + i * c) + ' 8v' + r1(rows * c);
      for (let i = 1; i < rows; i++) d += 'M8 ' + r1(8 + i * c) + 'h' + r1(cols * c);
      inner = '<rect x="8" y="8" width="' + r1(cols * c) + '" height="' + r1(rows * c) + '" fill="#e2f6e9" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="' + d + '" stroke="' + INK + '" stroke-width="5" fill="none"/>';
      q.prompt = 'Bu şekilde toplam kaç kare var? Büyük küçük hepsini say.';
      why = 'Kareleri boyuna göre say: ' + parts.join(', ') + '. Toplam ' + total + ' kare.';
      prefer = [rows * cols, rows * cols + 1, total - 1];
    } else {
      total = 8; W = 236; H = 236;
      inner = '<rect x="8" y="8" width="220" height="220" fill="#e6efff" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="M8 8L228 228M228 8L8 228" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>';
      q.prompt = 'Bu şekilde toplam kaç üçgen var? Büyük küçük hepsini say.';
      why = 'Köşegenler kareyi 4 küçük üçgene böler. Yan yana iki küçük üçgen birleşince 4 büyük üçgen daha oluşur. Toplam 8 üçgen.';
      prefer = [4, 6];
    }
    q.stem = S.svg(W, H, inner, { maxW: Math.min(310, W * 1.2) });
    q.explain = why;
    q.meta = Object.assign({ total: total, kind: kind }, dims);
    return Q.finishNum(rng, q, total, { min: 1, prefer: prefer });
  }

  B.GEN.count = function (rng, level) {
    if (level > 1 && rng.chance(0.5)) return nested(rng, level - 1);
    // dağınık şekiller: renk ve şekle (en zor düzeyde boya da) göre say
    const cols = [0, 5, 6, 7, 7][level], rows = level === 1 ? 3 : 4, bySize = level === 4;
    const total = level === 1 ? rng.int(12, 14) : level === 2 ? rng.int(18, 21) : rng.int(23, 26), k = rng.int(level === 1 ? 2 : 3, level < 3 ? 6 : 7);
    const shapes = rng.sample(CNT, level < 3 ? 4 : 5), colors = rng.sample(COL, 4);
    const tShape = shapes[0], tColor = colors[0], tSmall = rng.chance(0.5);
    const isTarget = (f) => f.shape === tShape && f.color === tColor && (!bySize || f.small === tSmall);
    const items = [];
    for (let i = 0; i < k; i++) items.push({ shape: tShape, color: tColor, small: bySize ? tSmall : rng.chance(0.3) });
    // en çok karışan çeldiriciler: aynı şekil başka renk, aynı renk başka şekil, aynısı ama başka boy
    while (items.length < total) {
      const r = rng.next();
      const f = { shape: r < 0.3 ? tShape : rng.pick(shapes), color: r >= 0.3 && r < 0.55 ? tColor : rng.pick(colors), small: bySize ? rng.chance(0.5) : rng.chance(0.3) };
      if (bySize && r >= 0.55 && r < 0.75) { f.shape = tShape; f.color = tColor; f.small = !tSmall; }
      if (!isTarget(f)) items.push(f);
    }
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([c, r]);
    const place = rng.sample(slots, total);
    const inner = rng.shuffle(items).map((f, i) => {
      const s = f.small ? 44 + rng.int(0, 6) : 76 + rng.int(0, 12);
      const x = 10 + place[i][0] * 100 + rng.int(4, 96 - s), y = 10 + place[i][1] * 100 + rng.int(4, 96 - s);
      return '<g transform="rotate(' + rng.int(-14, 14) + ' ' + (x + s / 2) + ' ' + (y + s / 2) + ')">' + S.figAt(f, x, y, s) + '</g>';
    }).join('');
    const label = (bySize ? (tSmall ? 'küçük ' : 'büyük ') : '') + S.COLORS[tColor].name + ' ' + S.SHAPES[tShape].name;
    const q = {
      prompt: 'Resimde kaç tane ' + label + ' var?',
      stem: S.svg(cols * 100 + 20, rows * 100 + 20, inner, { maxW: cols * 100 + 20 }),
      meta: { total: k, kind: 'scatter' },
    };
    q.explain = 'Soldan sağa, satır satır sayınca ' + k + ' tane ' + label + ' bulunur. Rengi' + (bySize ? ', biçimi ya da boyu' : ' ya da biçimi') + ' farklı olanları sayma.';
    return Q.finishNum(rng, q, k, { min: 1 });
  };

  /* ---------- Görsel Hafıza ---------- */
  const PICS = ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐢', '🐙', '🐬', '🦋', '🐝', '🐞', '🐠',
    '⚽', '🎈', '🚗', '🚀', '⏰', '🎁', '🔑', '🌈', '⭐', '🌙', '🍎', '🍌', '🍓', '🍉', '🚲', '🎸', '🏠', '🌻'];

  function picGrid(cols, rows, pics, hole) {
    const s = 96, gap = 10, pad = 6;
    let inner = '';
    for (let i = 0; i < cols * rows; i++) {
      const x = pad + (i % cols) * (s + gap), y = pad + Math.floor(i / cols) * (s + gap);
      if (pics) inner += S.tile(x, y, s) + S.emoji(x + s / 2, y + s / 2, pics[i], 58);
      else inner += i === hole ? S.qtile(x, y, s) : S.tile(x, y, s, { fill: '#eef3fb' });
    }
    const W = pad * 2 + cols * s + (cols - 1) * gap;
    return S.svg(W, pad * 2 + rows * s + (rows - 1) * gap, inner, { maxW: W * 0.95 });
  }

  B.GEN.memory = function (rng, level) {
    const dims = [null, [2, 2], [3, 2], [4, 2], [3, 3]][level], n = dims[0] * dims[1];
    const pool = rng.shuffle(PICS), shown = pool.slice(0, n), fresh = pool.slice(n, n + 3);
    const kind = rng.pick(level < 3 ? ['where', 'where', 'absent'] : ['where', 'absent', 'new']);
    const q = { memo: { html: picGrid(dims[0], dims[1], shown), seconds: n }, stem: '' };
    q.explain = 'Resimde bunlar vardı: ' + shown.join(' ');
    q.meta = { shown: shown, kind: kind };
    if (kind === 'absent') {
      q.prompt = 'Hangisi resimde yoktu?';
      return Q.finish(rng, q, Q.emoji(fresh[0]), rng.sample(shown, 3).map(Q.emoji));
    }
    const hole = rng.int(0, n - 1), others = rng.shuffle(shown.filter((_, i) => i !== hole));
    q.meta.hole = hole;
    if (kind === 'new') {
      // resimlerden biri değişmiş olarak yeniden gösterilir
      const now = shown.slice();
      now[hole] = fresh[0];
      q.prompt = 'Resimlerden biri değişti. Yeni gelen resim hangisi?';
      q.stem = picGrid(dims[0], dims[1], now);
      q.explain += '. ' + shown[hole] + ' gitti, yerine ' + fresh[0] + ' geldi.';
      return Q.finish(rng, q, Q.emoji(fresh[0]), others.map(Q.emoji));
    }
    q.prompt = 'Soru işaretli kutuda hangisi vardı?';
    q.stem = picGrid(dims[0], dims[1], null, hole);
    return Q.finish(rng, q, Q.emoji(shown[hole]), others.map(Q.emoji));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
