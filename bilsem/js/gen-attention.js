/* Zekâ Kâşifi — dikkat ve hafıza: aynısını bul, şekil sayma, görsel hafıza */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS, r1 = S.r1;

  /* ---------- Aynısını Bul ---------- */
  function randCells(rng, n, k, colors) {
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    const all = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) all.push([r, c]);
    rng.sample(all, k).forEach((p) => { m[p[0]][p[1]] = rng.int(1, colors); });
    return m;
  }
  function mutateGrid(rng, m, colors, easy) {
    const n = m.length, x = m.map((r) => r.slice());
    const filled = [], empty = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) (x[r][c] ? filled : empty).push([r, c]);
    const kind = rng.pick(easy ? ['move', 'recolor', 'add', 'remove'] : ['move', 'recolor', 'move']);
    const p = rng.pick(filled);
    if (kind === 'recolor') {
      let v;
      do { v = rng.int(1, colors); } while (v === x[p[0]][p[1]]);
      x[p[0]][p[1]] = v;
    } else if (kind === 'add') {
      const e = rng.pick(empty);
      x[e[0]][e[1]] = rng.int(1, colors);
    } else if (kind === 'remove') {
      x[p[0]][p[1]] = 0;
    } else {
      const near = empty.filter((e) => Math.abs(e[0] - p[0]) + Math.abs(e[1] - p[1]) === 1);
      const e = near.length ? rng.pick(near) : rng.pick(empty);
      x[e[0]][e[1]] = x[p[0]][p[1]];
      x[p[0]][p[1]] = 0;
    }
    return x;
  }

  function figRow(figs, s, cls) {
    const gap = 6, W = figs.length * (s + gap) - gap + 8;
    const inner = figs.map((f, i) => S.tile(4 + i * (s + gap), 4, s) + S.figAt(f, 4 + i * (s + gap) + 3, 7, s - 6)).join('');
    return S.svg(W, s + 8, inner, cls ? { cls: cls } : { maxW: W });
  }

  B.GEN.same = function (rng, level) {
    const q = { prompt: 'Üstteki şeklin tıpatıp aynısı hangisi?' };
    if (rng.chance(0.6)) {
      const n = level + 2, colors = level === 1 ? 2 : 3;
      const k = [4, 7, 11][level - 1];
      const pal = rng.sample(COL, 3);
      const m = randCells(rng, n, k, colors);
      const mk = (g) => ({ html: S.svg(100, 100, S.Grid.draw(g, pal, 8, 8, 84), { cls: 'opt-svg' }), key: S.Grid.key(g) });
      const wrong = [];
      for (let i = 0; i < 12; i++) wrong.push(mk(mutateGrid(rng, m, colors, level === 1)));
      q.stem = S.svg(172, 172, S.Grid.draw(m, pal, 6, 6, 160), { maxW: 190 });
      q.explain = 'Kare kare karşılaştır. Diğer şıklarda bir kare başka yerde ya da başka renkte.';
      return Q.finish(rng, q, mk(m), wrong);
    }
    // şekil dizisi
    const len = level + 3;
    const shapes = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'plus'], 3), cols = rng.sample(COL, 3);
    let seq;
    do {
      seq = Array.from({ length: len }, () => ({ shape: rng.pick(shapes), color: rng.pick(cols) }));
    } while (new Set(seq.map(S.key)).size < 3);
    const mutate = () => {
      const x = seq.map((f) => Object.assign({}, f));
      const i = rng.int(0, len - 1), kind = rng.pick(['swap', 'color', 'shape']);
      if (kind === 'swap') { const j = i < len - 1 ? i + 1 : i - 1; const t = x[i]; x[i] = x[j]; x[j] = t; }
      else if (kind === 'color') x[i].color = rng.pick(cols.filter((c) => c !== x[i].color));
      else x[i].shape = rng.pick(shapes.filter((s) => s !== x[i].shape));
      return x;
    };
    const mk = (sq) => ({ html: figRow(sq, 46, 'opt-svg opt-svg-row'), key: sq.map(S.key).join('+') });
    const wrong = [];
    for (let i = 0; i < 14; i++) wrong.push(mk(mutate()));
    q.stem = figRow(seq, 64);
    q.layout = 'wide';
    q.explain = 'Soldan sağa tek tek karşılaştır. Diğer şıklarda bir şeklin yeri, rengi ya da biçimi farklı.';
    return Q.finish(rng, q, mk(seq), wrong);
  };

  /* ---------- Şekil Sayma ---------- */
  const CNT = ['circle', 'square', 'triangle', 'star', 'heart', 'plus'];

  function nested(rng) {
    const q = {};
    let total, why, small, inner, W, H;
    if (rng.chance(0.5)) {
      const n = rng.pick([2, 3, 3, 4]);
      total = n * (n + 1) / 2; small = n;
      W = 300; H = 220;
      const ax = 150, ay = 14, by = 204, x0 = 22, x1 = 278;
      let lines = '';
      for (let i = 1; i < n; i++) lines += 'M' + ax + ' ' + ay + 'L' + r1(x0 + (x1 - x0) * i / n) + ' ' + by;
      inner = '<path d="M' + ax + ' ' + ay + 'L' + x1 + ' ' + by + 'H' + x0 + 'Z" fill="#fff4cc" stroke="' + S.INK + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="' + lines + '" stroke="' + S.INK + '" stroke-width="5" stroke-linecap="round" fill="none"/>';
      q.prompt = 'Bu şekilde toplam kaç üçgen var? Büyük küçük hepsini say.';
      const parts = [];
      for (let k = 1; k <= n; k++) parts.push(k + ' parçalı ' + (n - k + 1) + ' tane');
      why = 'Üçgenleri parça sayısına göre sayalım: ' + parts.join(', ') + '. Toplam ' + total + ' üçgen.';
    } else {
      const d = rng.pick([[2, 2], [2, 3], [3, 3]]), rows = d[0], cols = d[1], c = 64;
      const parts = [];
      total = 0;
      for (let k = 1; k <= Math.min(rows, cols); k++) {
        const cnt = (rows - k + 1) * (cols - k + 1);
        total += cnt;
        parts.push(k === 1 ? 'küçük kareler ' + cnt + ' tane' : k * k + ' küçük kareden oluşan kareler ' + cnt + ' tane');
      }
      small = rows * cols;
      W = cols * c + 16; H = rows * c + 16;
      let lines = '';
      for (let i = 1; i < cols; i++) lines += 'M' + (8 + i * c) + ' 8v' + rows * c;
      for (let i = 1; i < rows; i++) lines += 'M8 ' + (8 + i * c) + 'h' + cols * c;
      inner = '<rect x="8" y="8" width="' + cols * c + '" height="' + rows * c + '" fill="#e2f6e9" stroke="' + S.INK + '" stroke-width="5" stroke-linejoin="round"/>' +
        '<path d="' + lines + '" stroke="' + S.INK + '" stroke-width="5" fill="none"/>';
      q.prompt = 'Bu şekilde toplam kaç kare var? Büyük küçük hepsini say.';
      why = 'Kareleri boyuna göre sayalım: ' + parts.join(', ') + '. Toplam ' + total + ' kare.';
    }
    q.stem = S.svg(W, H, inner, { maxW: Math.min(300, W * 1.3) });
    q.explain = why;
    q.meta = { total: total };
    return Q.finishNum(rng, q, total, { min: 1, prefer: [small, small + 1] });
  }

  B.GEN.count = function (rng, level) {
    if (level === 3 && rng.chance(0.5)) return nested(rng);
    const cols = level === 1 ? 4 : level === 2 ? 5 : 6, rows = level === 3 ? 4 : 3;
    const total = level === 1 ? rng.int(8, 10) : level === 2 ? rng.int(12, 14) : rng.int(18, 21);
    const k = rng.int(2, level === 1 ? 5 : 6);
    const shapes = rng.sample(CNT, level === 1 ? 3 : 4), colors = rng.sample(COL, level === 1 ? 3 : 4);
    const tShape = shapes[0], tColor = colors[0], byColor = level > 1;
    const items = [];
    for (let i = 0; i < k; i++) items.push({ shape: tShape, color: byColor ? tColor : rng.pick(colors) });
    while (items.length < total) {
      const f = { shape: rng.pick(shapes), color: rng.pick(colors) };
      const isTarget = byColor ? (f.shape === tShape && f.color === tColor) : f.shape === tShape;
      if (!isTarget) items.push(f);
    }
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push([c, r]);
    const place = rng.sample(slots, total);
    const inner = rng.shuffle(items).map((f, i) => {
      const s = 62 + rng.int(0, 18), x = 10 + place[i][0] * 100 + rng.int(4, 96 - s), y = 10 + place[i][1] * 100 + rng.int(4, 96 - s);
      return '<g transform="rotate(' + rng.int(-14, 14) + ' ' + (x + s / 2) + ' ' + (y + s / 2) + ')">' + S.figAt(f, x, y, s) + '</g>';
    }).join('');
    const q = {
      prompt: 'Resimde kaç tane ' + (byColor ? S.COLORS[tColor].name + ' ' : '') + S.SHAPES[tShape].name + ' var?',
      stem: S.svg(cols * 100 + 20, rows * 100 + 20, inner, { maxW: cols * 100 + 20 }),
      meta: { total: k },
    };
    q.explain = 'Soldan sağa, satır satır sayınca ' + k + ' tane ' + (byColor ? S.COLORS[tColor].name + ' ' : '') + S.SHAPES[tShape].name + ' bulunur.' +
      (byColor ? ' Başka renkteki ' + S.SHAPES[tShape].name + ' şekillerini sayma.' : '');
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
      if (hole == null) inner += S.tile(x, y, s) + S.emoji(x + s / 2, y + s / 2, pics[i], 58);
      else inner += i === hole ? S.qtile(x, y, s) : S.tile(x, y, s, { fill: '#eef3fb' });
    }
    const W = pad * 2 + cols * s + (cols - 1) * gap;
    return S.svg(W, pad * 2 + rows * s + (rows - 1) * gap, inner, { maxW: W * 0.95 });
  }

  B.GEN.memory = function (rng, level) {
    const dims = level === 1 ? [3, 1] : level === 2 ? [2, 2] : [3, 2];
    const n = dims[0] * dims[1];
    const pool = rng.shuffle(PICS), shown = pool.slice(0, n), fresh = pool.slice(n, n + 3);
    const kind = rng.pick(level === 1 ? ['absent', 'present'] : ['where', 'where', 'absent']);
    const q = { memo: { html: picGrid(dims[0], dims[1], shown, null), seconds: level + 3 }, stem: '' };
    q.explain = 'Resimde bunlar vardı: ' + shown.join(' ');
    q.meta = { shown: shown, kind: kind };
    if (kind === 'absent') {
      q.prompt = 'Hangisi resimde yoktu?';
      return Q.finish(rng, q, Q.emoji(fresh[0]), rng.sample(shown, 3).map(Q.emoji));
    }
    if (kind === 'present') {
      q.prompt = 'Hangisi resimde vardı?';
      return Q.finish(rng, q, Q.emoji(shown[0]), fresh.map(Q.emoji));
    }
    const hole = rng.int(0, n - 1);
    q.prompt = 'Soru işaretli kutuda hangisi vardı?';
    q.stem = picGrid(dims[0], dims[1], shown, hole);
    q.meta.hole = hole;
    return Q.finish(rng, q, Q.emoji(shown[hole]), rng.shuffle(shown.filter((_, i) => i !== hole)).map(Q.emoji));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
