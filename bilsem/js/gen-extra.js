/* Zekâ Kâşifi — sayı makinesi, gölge bulma, terazi, kim hangisi */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS, r1 = S.r1, INK = S.INK;

  /* ---------- Sayı Makinesi ---------- */
  function machineSvg(pairs, holeIn) {
    const rows = pairs.length, th = 58, gap = 10, tw = 86, pad = 8, top = 28, aw = 40, mw = 92;
    const mx = pad + tw + aw, W = mx + mw + aw + tw + pad, H = top + rows * th + (rows - 1) * gap + pad;
    const soft = { fill: '#566889', weight: 700 };
    const arrow = (x, y) => '<path d="M' + x + ' ' + y + 'h20m-9 -9l9 9l-9 9" fill="none" stroke="#566889" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    let inner = S.text(pad + tw / 2, 12, 'giren', 16, soft) + S.text(mx + mw / 2, 12, 'makine', 16, soft) + S.text(W - pad - tw / 2, 12, 'çıkan', 16, soft) +
      '<rect x="' + mx + '" y="' + (top - 4) + '" width="' + mw + '" height="' + (H - top - pad + 8) + '" rx="20" fill="#a565f2" stroke="' + INK + '" stroke-width="4"/>';
    const my = (top + H - pad) / 2;
    [[-16, -26, 20], [16, 6, 15], [-14, 34, 11]].forEach((g) => {
      inner += '<circle cx="' + (mx + mw / 2 + g[0]) + '" cy="' + (my + g[1]) + '" r="' + g[2] + '" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="7" stroke-dasharray="7 5"/>';
    });
    pairs.forEach((p, i) => {
      const y = top + i * (th + gap), last = i === rows - 1, xr = W - pad - tw;
      inner += (last && holeIn ? S.qtile(pad, y, th, { w: tw }) : S.tile(pad, y, th, { w: tw }) + S.text(pad + tw / 2, y + th / 2, p[0], 32)) +
        arrow(pad + tw + 9, y + th / 2) + arrow(mx + mw + 9, y + th / 2) +
        (last && !holeIn ? S.qtile(xr, y, th, { w: tw }) : S.tile(xr, y, th, { w: tw }) + S.text(xr + tw / 2, y + th / 2, p[1], 32));
    });
    return S.svg(W, H, inner, { maxW: W });
  }

  B.GEN.machine = function (rng, level) {
    const kinds = level === 1 ? ['add', 'add', 'sub'] : level === 2 ? ['add', 'sub', 'dbl', 'dbl'] : ['dbl1', 'dblm', 'tri', 'ten', 'add'];
    const kind = rng.pick(kinds);
    let fn, why, lo = 1, hi = 10;
    if (kind === 'add') {
      const k = level === 1 ? rng.int(1, 5) : level === 2 ? rng.int(6, 10) : rng.int(11, 15);
      fn = (n) => n + k; why = 'Makine her sayıya ' + k + ' ekliyor.'; hi = level === 1 ? 10 : 20;
    } else if (kind === 'sub') {
      const k = level === 1 ? rng.int(1, 3) : rng.int(4, 9);
      fn = (n) => n - k; why = 'Makine her sayıdan ' + k + ' çıkarıyor.'; lo = k; hi = k + (level === 1 ? 9 : 15);
    } else if (kind === 'dbl') {
      fn = (n) => 2 * n; why = 'Makine her sayının 2 katını alıyor.';
    } else if (kind === 'dbl1') {
      fn = (n) => 2 * n + 1; why = 'Makine sayının 2 katını alıp 1 ekliyor.';
    } else if (kind === 'dblm') {
      fn = (n) => 2 * n - 1; why = 'Makine sayının 2 katını alıp 1 çıkarıyor.';
    } else if (kind === 'tri') {
      fn = (n) => 3 * n; why = 'Makine her sayının 3 katını alıyor.'; hi = 8;
    } else {
      fn = (n) => 10 - n; why = 'Makine her sayıyı 10\'dan çıkarıyor. Giren ile çıkanın toplamı hep 10.'; lo = 0; hi = 10;
    }
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    const ins = rng.sample(pool, 4);
    const pairs = ins.map((n) => [n, fn(n)]);
    const holeIn = level === 3 && rng.chance(0.4);
    const q = { prompt: holeIn ? 'Makineye hangi sayı girerse bu sayı çıkar?' : 'Makinenin kuralını bul. Soru işaretinin yerine hangi sayı gelmeli?' };
    q.stem = machineSvg(pairs, holeIn);
    const ans = holeIn ? pairs[3][0] : pairs[3][1];
    q.meta = { pairs: pairs, holeIn: holeIn, ans: ans, kind: kind };
    q.explain = why + ' ' + pairs[3][0] + ' girince ' + pairs[3][1] + ' çıkar.';
    return Q.finishNum(rng, q, ans, { min: 0, prefer: [holeIn ? pairs[3][1] : pairs[3][0]] });
  };

  /* ---------- Gölge Bulma ---------- */
  const SH = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon', 'plus', 'diamond', 'semi', 'arrow', 'drop', 'moon'];
  // yerleşimler: 100x100 kutuda parça merkezleri ve boyları
  const LAYOUTS = {
    2: [[[50, 66, 58], [50, 26, 42]], [[35, 56, 58], [73, 58, 40]]],
    3: [[[50, 74, 48], [50, 43, 38], [50, 17, 28]], [[31, 66, 52], [71, 67, 44], [50, 27, 42]], [[50, 63, 60], [22, 28, 34], [78, 28, 34]]],
    4: [[[32, 68, 50], [72, 69, 42], [32, 29, 36], [72, 30, 30]]],
  };

  function partsKey(parts) {
    return parts.map((p, i) => i + ':' + p.shape + ':' + (((p.rot % S.SHAPES[p.shape].sym) + 360) % S.SHAPES[p.shape].sym) + ':' + p.k).join('|');
  }
  function partsDraw(parts, lay, shadow) {
    return parts.map((p, i) => {
      const s = lay[i][2] * p.k;
      return S.figAt({ shape: p.shape, color: shadow ? 'ink' : p.color, rot: p.rot }, lay[i][0] - s / 2, lay[i][1] - s / 2, s);
    }).join('');
  }

  B.GEN.shadow = function (rng, level) {
    const q = { prompt: 'Bu resmin gölgesi hangisi?' };
    const n = level === 1 ? 2 : level === 2 ? 3 : rng.pick([3, 4]);
    const lay = rng.pick(LAYOUTS[n]);
    const shapes = rng.sample(SH, n), colors = rng.sample(COL, n);
    const parts = shapes.map((s, i) => ({ shape: s, color: colors[i], rot: level > 1 && S.SHAPES[s].sym === 360 ? rng.pick([0, 0, 90, 180, 270]) : 0, k: 1 }));
    const copy = () => parts.map((p) => Object.assign({}, p));
    const kinds = level === 1 ? ['shape', 'shape', 'swap'] : level === 2 ? ['shape', 'swap', 'rot'] : ['rot', 'size', 'swap', 'rot', 'shape'];
    const mk = (ps) => ({ html: S.svg(100, 100, partsDraw(ps, lay, true), { cls: 'opt-svg' }), key: partsKey(ps) });
    const wrong = [];
    for (let t = 0; t < 30; t++) {
      const x = copy(), i = rng.int(0, n - 1), kind = rng.pick(kinds);
      if (kind === 'shape') x[i].shape = rng.pick(SH.filter((s) => shapes.indexOf(s) < 0));
      else if (kind === 'swap') {
        const j = (i + 1) % n, a = x[i].shape, ar = x[i].rot;
        x[i].shape = x[j].shape; x[i].rot = x[j].rot; x[j].shape = a; x[j].rot = ar;
      } else if (kind === 'rot') x[i].rot = (x[i].rot + rng.pick([90, 180, 270])) % 360;
      else x[i].k = 0.6;
      wrong.push(mk(x));
    }
    q.stem = S.svg(100, 100, partsDraw(parts, lay, false), { maxW: 210 });
    q.explain = 'Gölgede renkler görünmez ama dış çizgi aynı kalır. Diğer şıklarda bir parçanın biçimi, yeri, yönü ya da boyu farklı.';
    return Q.finish(rng, q, mk(parts), wrong);
  };

  /* ---------- Terazi ---------- */
  function scaleDraw(L, R, tilt, x0, y0) {
    const cx = x0 + 100, cy = y0 + 32, a = tilt * 11 * Math.PI / 180, dx = 66 * Math.cos(a), dy = 66 * Math.sin(a);
    const ends = [[cx - dx, cy - dy], [cx + dx, cy + dy]];
    let o = '<path d="M' + (cx - 36) + ' ' + (y0 + 142) + 'h72l-12 -13h-48z" fill="#b4c5e2" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M' + cx + ' ' + cy + 'V' + (y0 + 129) + '" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M' + r1(ends[0][0]) + ' ' + r1(ends[0][1]) + 'L' + r1(ends[1][0]) + ' ' + r1(ends[1][1]) + '" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#ffc93c" stroke="' + INK + '" stroke-width="3"/>';
    ends.forEach((e, i) => {
      const py = e[1] + 54, ex = r1(e[0]), ey = r1(e[1]);
      o += '<path d="M' + ex + ' ' + ey + 'L' + r1(e[0] - 27) + ' ' + r1(py) + 'M' + ex + ' ' + ey + 'L' + r1(e[0] + 27) + ' ' + r1(py) + '" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
        '<path d="M' + r1(e[0] - 31) + ' ' + r1(py) + 'h62a31 12 0 0 1 -62 0z" fill="#dfe8f7" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
        S.figAt(i ? R : L, e[0] - 20, py - 38, 40);
    });
    return o;
  }

  B.GEN.balance = function (rng, level) {
    const n = level === 1 ? 3 : level === 2 ? 4 : rng.pick([4, 5]);
    const shapes = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'], n), cols = rng.sample(COL, n);
    const figs = shapes.map((s, i) => ({ shape: s, color: cols[i] }));      // 0 en ağır
    let pairs = [];
    for (let i = 0; i < n - 1; i++) pairs.push(rng.chance(0.5) ? [i, i + 1] : [i + 1, i]);
    if (level > 1) pairs = rng.shuffle(pairs);
    const cols2 = 2, rows = Math.ceil(pairs.length / cols2), W = cols2 * 210, H = rows * 156;
    let inner = '';
    pairs.forEach((p, i) => {
      const lastAlone = i === pairs.length - 1 && pairs.length % 2 === 1;
      const x = lastAlone ? (W - 200) / 2 : 5 + (i % cols2) * 210, y = Math.floor(i / cols2) * 156 + 4;
      inner += scaleDraw(figs[p[0]], figs[p[1]], p[0] < p[1] ? -1 : 1, x, y);
    });
    const ask = level === 3 ? rng.pick(['rank', 'rank', 'end']) : 'end';
    let idx, prompt;
    if (ask === 'end') {
      idx = rng.chance(0.5) ? 0 : n - 1;
      prompt = idx === 0 ? 'Terazilere göre en ağır şekil hangisi?' : 'Terazilere göre en hafif şekil hangisi?';
    } else {
      idx = rng.int(1, n - 2);
      prompt = 'Şekiller en ağırdan en hafife doğru sıralanırsa ' + (idx + 1) + '. sırada hangisi olur?';
    }
    const q = { prompt: prompt };
    q.stem = S.svg(W, H, inner, { maxW: W });
    q.meta = { n: n, pairs: pairs, idx: idx };
    q.explain = 'Aşağı inen kefedeki şekil daha ağırdır. En ağırdan en hafife sıra: ' + figs.map((f) => S.name(f)).join(', ') + '.';
    const opt = (f) => ({ html: S.figSvg(f), key: S.key(f) });
    return Q.finish(rng, q, opt(figs[idx]), rng.shuffle(figs.filter((_, i) => i !== idx)).map(opt), Math.min(4, n));
  };

  /* ---------- Kim Hangisi? ---------- */
  // [ad, tamlayan hâli]
  const KIDS = [['Ali', "Ali'nin"], ['Ayşe', "Ayşe'nin"], ['Can', "Can'ın"], ['Elif', "Elif'in"], ['Mert', "Mert'in"], ['Zeynep', "Zeynep'in"],
    ['Efe', "Efe'nin"], ['Defne', "Defne'nin"], ['Kerem', "Kerem'in"], ['Ada', "Ada'nın"], ['Deniz', "Deniz'in"], ['Yusuf', "Yusuf'un"],
    ['Ela', "Ela'nın"], ['Emir', "Emir'in"], ['Duru', "Duru'nun"], ['Mina', "Mina'nın"], ['Ömer', "Ömer'in"], ['Selin', "Selin'in"],
    ['Bora', "Bora'nın"], ['Arda', "Arda'nın"], ['Asya', "Asya'nın"], ['Poyraz', "Poyraz'ın"]];
  const NUMW = { 3: 'Üç', 4: 'Dört' };
  const THEMES = [
    { items: [['🐱', 'kedi'], ['🐶', 'köpek'], ['🐦', 'kuş'], ['🐟', 'balık'], ['🐰', 'tavşan']], intro: 'arkadaşın her birinin farklı bir hayvanı var', what: 'hayvanı' },
    { items: [['🍎', 'elma'], ['🍌', 'muz'], ['🍓', 'çilek'], ['🍇', 'üzüm'], ['🍉', 'karpuz']], intro: 'arkadaşın her biri farklı bir meyveyi seviyor', what: 'en sevdiği meyve' },
    { items: [['⚽', 'top'], ['🚲', 'bisiklet'], ['🎸', 'gitar'], ['🎈', 'balon'], ['🚀', 'roket']], intro: 'arkadaşın her birinin farklı bir oyuncağı var', what: 'oyuncağı' },
  ];

  function perms(n) {
    const out = [];
    (function go(a, rest) {
      if (!rest.length) { out.push(a); return; }
      rest.forEach((v, i) => go(a.concat([v]), rest.slice(0, i).concat(rest.slice(i + 1))));
    })([], Array.from({ length: n }, (_, i) => i));
    return out;
  }
  /* ipuçları: { kid, item, is } — çocuk k'nin eşyası item'dir / değildir. Çözüm sayısını döndürür. */
  function solutions(n, clues) {
    return perms(n).filter((p) => clues.every((c) => (p[c.kid] === c.item) === c.is));
  }

  B.GEN.who = function (rng, level) {
    const n = level === 3 && rng.chance(0.5) ? 4 : 3;
    const th = rng.pick(THEMES), kids = rng.sample(KIDS, n), items = rng.sample(th.items, n);   // çocuk i'nin eşyası items[i]
    let clues, askPool;
    if (level === 1) {
      clues = [{ kid: 0, item: 0, is: true }, { kid: 1, item: 1, is: true }]; askPool = [2];
    } else if (level === 2) {
      clues = [{ kid: 0, item: 0, is: true }, { kid: 1, item: 2, is: false }]; askPool = [1, 2];
    } else if (n === 3) {
      clues = [{ kid: 0, item: 1, is: false }, { kid: 0, item: 2, is: false }, { kid: 1, item: 2, is: false }]; askPool = [0, 1, 2];
    } else {
      clues = [{ kid: 0, item: 0, is: true }, { kid: 1, item: 1, is: true }, { kid: 2, item: 3, is: false }]; askPool = [2, 3];
    }
    const sols = solutions(n, clues);
    if (sols.length !== 1) throw new Error('ipuçları tek çözüm vermiyor');
    if (level > 1) clues = rng.shuffle(clues);
    const ask = rng.pick(askPool);
    const facts = clues.map((c) => kids[c.kid][1] + ' ' + th.what + ' ' + items[c.item][1] + (c.is ? '.' : ' değil.'));
    const names = rng.shuffle(items.map((it) => it[1]));   // sıra ipucu vermesin
    const intro = NUMW[n] + ' ' + th.intro + ': ' + names.slice(0, -1).join(', ') + ' ve ' + names[n - 1] + '.';
    const q = { prompt: kids[ask][1] + ' ' + th.what + ' hangisi?' };
    q.stem = '<div class="story"><p>' + intro + '</p><ul>' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>';
    q.speech = intro + ' ' + facts.join(' ') + ' ' + q.prompt;
    q.meta = { n: n, clues: clues, ask: ask };
    q.explain = 'Kesin olanları yerleştirip kalanları eleyince: ' + kids.map((k, i) => k[0] + ' → ' + items[i][1]).join(', ') + '.';
    const opt = (it) => ({ html: '<span class="opt-pair"><span class="opt-emoji">' + it[0] + '</span><span class="opt-cap">' + it[1] + '</span></span>', key: 'w' + it[1] });
    return Q.finish(rng, q, opt(items[ask]), rng.shuffle(items.filter((_, i) => i !== ask)).map(opt), n);
  };

  B.ExtraUtil = { solutions: solutions };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
