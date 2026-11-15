/* Şekil bulmacaları: örüntü, tablo, benzetme, farklı olan */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q, G = S.Grid;
  const BASE = ['circle', 'square', 'triangle', 'star', 'heart', 'pentagon', 'hexagon', 'plus', 'diamond'];
  const ROTS = ['arrow', 'triangle', 'heart', 'drop', 'moon', 'pac', 'semi'];
  const HOLDERS = ['circle', 'square', 'triangle', 'hexagon', 'pentagon', 'heart', 'diamond'];   // içine küçük şekil sığanlar
  const COL = S.COLOR_IDS;
  const SIZES3 = [1, 0.72, 0.46];
  const FILLS3 = ['solid', 'empty', 'stripe'];
  const LABEL = { shape: 'şekil', color: 'renk', size: 'boyut', count: 'şekil sayısı', fill: 'iç dolgusu', rot: 'yön' };

  const mk = (shape, color, extra) => Object.assign({ shape: shape, color: color, fill: 'solid', size: 1, rot: 0, count: 1 }, extra || {});
  const clone = (f, ch) => Object.assign({}, f, ch);
  const opt = (f) => ({ html: S.figSvg(f), key: S.key(f) });
  const colName = (c) => S.COLORS[c].name;
  const shName = (s) => S.SHAPES[s].name;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const gridOpt = (m, pal) => ({ html: S.svg(100, 100, G.draw(m, pal, 9, 9, 82), { cls: 'opt-svg' }), key: 'g' + G.key(m) });

  function valName(attr, v) {
    if (attr === 'shape') return shName(v);
    if (attr === 'color') return colName(v);
    if (attr === 'size') return S.SIZE_NAMES[v];
    if (attr === 'fill') return S.FILL_NAMES[v];
    return String(v);
  }

  /* Bir şeklin, verilen özellik havuzlarından tek ya da iki özelliği değişmiş hâlleri (çeldirici). */
  function variants(rng, f, pools) {
    const keys = Object.keys(pools), singles = [], doubles = [];
    for (const k of keys) for (const v of pools[k]) if (v !== f[k]) singles.push(clone(f, { [k]: v }));
    if (keys.length >= 2) {
      for (let i = 0; i < 8; i++) {
        const pair = rng.sample(keys, 2);
        doubles.push(clone(f, { [pair[0]]: rng.pick(pools[pair[0]]), [pair[1]]: rng.pick(pools[pair[1]]) }));
      }
    }
    return rng.shuffle(singles).concat(doubles);
  }

  /* Yan yana kutular; draw(i, x, y, s) kutunun içini çizer. */
  function rowSvg(n, hole, draw) {
    const s = 96, gap = 10, pad = 6;
    let inner = '';
    for (let i = 0; i < n; i++) {
      const x = pad + i * (s + gap);
      inner += i === hole ? S.qtile(x, pad, s) : S.tile(x, pad, s) + draw(i, x, pad, s);
    }
    const W = pad * 2 + n * s + (n - 1) * gap;
    return S.svg(W, s + pad * 2, inner, { maxW: W * 0.95 });
  }
  const figRow = (figs, hole) => rowSvg(figs.length, hole, (i, x, y, s) => S.figAt(figs[i], x, y, s));

  /* ---------- Şekil Örüntüsü ---------- */
  const RING = [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [1, 0]];   // dış halka, saat yönünde
  const stepText = (s) => (s > 0 ? 'saat yönünde ' : 'saat yönünün tersine ') + Math.abs(s) + ' kare';

  function ringPattern(rng, two) {
    const len = 6, pal = rng.sample(COL, 4);
    const steps = rng.sample([1, -1, 2, -2, 3, -3], 2);
    const centre = two ? rng.shuffle([0, 3, 4]) : rng.pick([[0, 0], [3, 0], [0, 3]]);
    let a0, b0, clash;
    do {
      a0 = rng.int(0, 7); b0 = rng.int(0, 7); clash = false;
      for (let i = 0; i < len && two; i++) if ((((a0 + i * steps[0]) % 8) + 8) % 8 === (((b0 + i * steps[1]) % 8) + 8) % 8) clash = true;
    } while (clash);
    const frame = (i, da, db, dc) => {
      const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const pa = RING[(((a0 + i * steps[0] + (da || 0)) % 8) + 8) % 8];
      m[1][1] = centre[(i + (dc || 0)) % centre.length];
      if (two) { const pb = RING[(((b0 + i * steps[1] + (db || 0)) % 8) + 8) % 8]; m[pb[0]][pb[1]] = 2; }
      m[pa[0]][pa[1]] = m[pa[0]][pa[1]] === 2 ? 0 : 1;        // çakışan çeldirici: anahtarı zaten farklı olur
      return m;
    };
    const hole = rng.int(2, len - 1);
    const wrong = rng.shuffle([frame(hole, 1), frame(hole, -1), frame(hole, 2), frame(hole, 0, 1), frame(hole, 0, -1), frame(hole, 0, 0, 1), frame(hole, 1, 1), frame(hole, -1, 0, 1)]);
    let why = cap(colName(pal[0])) + ' kare her adımda ' + stepText(steps[0]) + ' ilerliyor.';
    if (two) why += ' ' + cap(colName(pal[1])) + ' kare ' + stepText(steps[1]) + ' ilerliyor.';
    const names = centre.map((v) => (v ? colName(pal[v - 1]) : 'boş'));
    if (new Set(centre).size > 1) why += ' Ortadaki kare sırayla ' + names.join(', ') + ' oluyor.';
    return {
      stem: rowSvg(len, hole, (i, x, y, s) => G.draw(frame(i), pal, x + 10, y + 10, s - 20)),
      correct: gridOpt(frame(hole), pal), wrong: wrong.map((m) => gridOpt(m, pal)), why: why,
    };
  }

  B.GEN.pattern = function (rng, level) {
    const q = { prompt: 'Soru işaretinin yerine hangisi gelmeli?' };
    const kind = rng.pick(level === 1 ? ['two', 'two', 'rotcol'] : level === 2 ? ['three', 'ring1', 'rot45'] : ['ring2', 'ring2', 'rot45x']);

    if (kind === 'ring1' || kind === 'ring2') {
      const r = ringPattern(rng, kind === 'ring2');
      q.stem = r.stem;
      q.explain = r.why;
      return Q.finish(rng, q, r.correct, r.wrong);
    }

    const seq = [];
    let hole, wrong, why;
    if (kind === 'two') {
      const attrs = rng.sample(['shape', 'color', 'size', 'fill'], 2), periods = rng.pick([[2, 3], [3, 2]]);
      const base = mk(rng.pick(BASE), rng.pick(COL)), vals = {}, pools = {}, parts = [];
      attrs.forEach((a, i) => {
        const p = periods[i];
        const all = a === 'shape' ? rng.sample(BASE, 3) : a === 'color' ? rng.sample(COL, 3)
          : a === 'size' ? (p === 2 ? rng.shuffle([1, 0.46]).concat([0.72]) : rng.shuffle(SIZES3)) : rng.shuffle(FILLS3);
        vals[a] = all.slice(0, p);
        pools[a] = all;
        const head = a === 'shape' ? 'Şekiller' : a === 'color' ? 'Renkler' : a === 'size' ? 'Boyutlar' : 'İç dolgular';
        parts.push(head + ' sırayla: ' + vals[a].map((v) => valName(a, v)).join(', ') + '.');
      });
      for (let i = 0; i < 7; i++) seq.push(clone(base, { [attrs[0]]: vals[attrs[0]][i % periods[0]], [attrs[1]]: vals[attrs[1]][i % periods[1]] }));
      hole = rng.int(2, 6);
      wrong = variants(rng, seq[hole], pools);
      why = parts.join(' ') + ' İkisi birlikte tekrar ediyor. Boş yere ' + S.name(seq[hole]) + ' gelmeli.';
    } else {
      // dönen şekil: rotcol 90° + renk; three 90° + renk + boyut; rot45 45° ; rot45x 45°/135° + renk + boyut
      const fine = kind === 'rot45' || kind === 'rot45x';
      const shape = rng.pick(fine ? ['arrow', 'drop', 'heart', 'triangle'] : ROTS);
      const step = fine ? (kind === 'rot45x' ? rng.pick([45, 315, 135, 225]) : rng.pick([45, 315])) : rng.pick([90, 270]);
      const start = rng.pick([0, 90, 180, 270]);
      const cols = kind === 'rot45' ? [rng.pick(COL)] : rng.sample(COL, kind === 'rotcol' ? rng.pick([2, 3]) : 3);
      const sizes = (kind === 'three' || kind === 'rot45x') ? rng.shuffle([1, 0.6]) : [1];
      const len = kind === 'rot45' ? 6 : 7;
      for (let i = 0; i < len; i++) seq.push(mk(shape, cols[i % cols.length], { rot: (start + i * step) % 360, size: sizes[i % sizes.length] }));
      hole = rng.int(2, len - 1);
      const c = seq[hole], pools = { rot: fine ? [45, 90, 135, 315, 270, 225].map((d) => (c.rot + d) % 360) : [0, 90, 180, 270] };
      if (cols.length > 1) pools.color = cols;
      if (sizes.length > 1) pools.size = sizes;
      wrong = variants(rng, c, pools);
      const dir = step < 180 ? 'sağa' : 'sola', amt = step % 90 === 0 ? 'çeyrek tur' : (step === 45 || step === 315) ? 'çeyrek turun yarısı kadar' : 'bir buçuk çeyrek tur';
      why = 'Şekil her adımda ' + dir + ' doğru ' + amt + ' dönüyor.' +
        (cols.length > 1 ? ' Renkler sırayla: ' + cols.map(colName).join(', ') + '.' : '') +
        (sizes.length > 1 ? ' Boyut bir ' + (sizes[0] === 1 ? 'büyük bir küçük' : 'küçük bir büyük') + ' gidiyor.' : '');
    }
    q.stem = figRow(seq, hole);
    q.explain = why;
    return Q.finish(rng, q, opt(seq[hole]), wrong.map(opt));
  };

  /* ---------- Şekil Tablosu (3x3) ---------- */
  const LATINS = [[[0, 1, 2], [1, 2, 0], [2, 0, 1]], [[0, 1, 2], [2, 0, 1], [1, 2, 0]]];

  function tableSvg(hole, draw) {
    const s = 92, gap = 10, pad = 14, W = pad * 2 + 3 * s + 2 * gap;
    let inner = '<rect x="2" y="2" width="' + (W - 4) + '" height="' + (W - 4) + '" rx="24" fill="#e9f0fb" stroke="#c5d3ea" stroke-width="3"/>';
    for (let i = 0; i < 9; i++) {
      const x = pad + (i % 3) * (s + gap), y = pad + Math.floor(i / 3) * (s + gap);
      inner += i === hole ? S.qtile(x, y, s) : S.tile(x, y, s) + draw(i, x, y, s);
    }
    return S.svg(W, W, inner, { maxW: 300 });
  }

  function attrVals(rng, a, shapePool) {
    if (a === 'shape') return rng.sample(shapePool, 3);
    if (a === 'color') return rng.sample(COL, 3);
    if (a === 'size') return rng.chance(0.5) ? SIZES3.slice() : SIZES3.slice().reverse();
    if (a === 'count') return rng.chance(0.5) ? [1, 2, 3] : [3, 2, 1];
    if (a === 'fill') return rng.shuffle(FILLS3);
    const st = rng.pick([0, 90, 180, 270]);
    return [st, (st + 90) % 360, (st + 180) % 360];
  }

  /* Üst üste koyma tabloları: üçüncü sütun ilk ikisinin birleşimi (union) ya da ortak kareler silinmiş hâli (xor). */
  function overlayMatrix(rng, xor) {
    const pal = [rng.pick(COL)], cellsOf = () => { const a = []; for (let i = 0; i < 9; i++) a.push(i); return a; };
    const toGrid = (set) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => (set.has(r * 3 + c) ? 1 : 0)));
    const rows = [];
    for (let r = 0; r < 3; r++) {
      let A, Bs, C;
      for (let t = 0; t < 50; t++) {
        const pool = rng.shuffle(cellsOf());
        if (xor) {
          const common = pool.slice(0, rng.int(1, 2)), onlyA = pool.slice(2, 2 + rng.int(1, 2)), onlyB = pool.slice(4, 4 + rng.int(1, 3));
          A = new Set(common.concat(onlyA)); Bs = new Set(common.concat(onlyB)); C = new Set(onlyA.concat(onlyB));
        } else {
          A = new Set(pool.slice(0, rng.int(2, 3))); Bs = new Set(pool.slice(3, 3 + rng.int(2, 3))); C = new Set(Array.from(A).concat(Array.from(Bs)));
        }
        const keys = [A, Bs, C].map((x) => G.key(toGrid(x)));
        if (new Set(keys).size === 3 && !rows.some((row) => row.some((g) => keys.indexOf(G.key(g)) >= 0))) break;
      }
      rows.push([toGrid(A), toGrid(Bs), toGrid(C)]);
    }
    const hr = rng.int(0, 2), hc = xor ? rng.int(0, 2) : 2, hole = hr * 3 + hc;
    const ans = rows[hr][hc], others = rows[hr].filter((_, c) => c !== hc);
    const comb = (fn) => ans.map((row, r) => row.map((_, c) => (fn(others[0][r][c], others[1][r][c]) ? 1 : 0)));
    const wrong = [comb((a, b) => a || b), comb((a, b) => a !== b), comb((a, b) => a && b)].filter((g) => g.some((row) => row.some(Boolean)));
    for (let i = 0; i < 6; i++) wrong.push(G.nudge(rng, ans, 1, ['move', 'add', 'remove']));
    wrong.push(others[0], others[1]);
    return {
      rows: rows, hole: hole,
      stem: tableSvg(hole, (i, x, y, s) => G.draw(rows[Math.floor(i / 3)][i % 3], pal, x + 11, y + 11, s - 22)),
      correct: gridOpt(ans, pal), wrong: rng.shuffle(wrong.slice(0, 9)).concat(wrong.slice(9)).map((g) => gridOpt(g, pal)),
      why: xor
        ? 'Her satırda ilk iki şekil üst üste konuyor. İki şekilde de boyalı olan kareler siliniyor, yalnız birinde boyalı olanlar kalıyor.'
        : 'Her satırda ilk iki şekil üst üste konunca üçüncü şekil oluşuyor.',
    };
  }

  B.GEN.matrix = function (rng, level) {
    const q = { prompt: 'Tablodaki boş kutuya hangisi gelmeli?' };
    const kind = rng.pick(level === 1 ? ['latin2', 'latin2', 'rc'] : level === 2 ? ['latin3', 'sum', 'union'] : ['xor', 'xor', 'latin4']);

    if (kind === 'union' || kind === 'xor') {
      const m = overlayMatrix(rng, kind === 'xor');
      q.stem = m.stem;
      q.explain = m.why;
      q.meta = { kind: kind, rows: m.rows, hole: m.hole };
      return Q.finish(rng, q, m.correct, m.wrong);
    }

    const cells = [];
    let hole = rng.int(0, 8), pools, why;
    if (kind === 'sum') {
      const pairs = rng.sample([[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2]], 3), sh = rng.sample(BASE, 3), co = rng.sample(COL, 3);
      pairs.forEach((p, r) => [p[0], p[1], p[0] + p[1]].forEach((n) => cells.push(mk(sh[r], co[r], { count: n }))));
      pools = { count: [1, 2, 3, 4], shape: sh };
      why = 'Her satırda birinci ve ikinci kutudaki şekillerin sayısı toplanınca üçüncü kutudaki sayı çıkıyor.';
    } else if (kind === 'rc') {
      let pair = rng.pick([['rot', 'fill'], ['size', 'fill'], ['count', 'fill'], ['rot', 'size'], ['rot', 'count']]);
      if (rng.chance(0.5)) pair = [pair[1], pair[0]];
      const shapePool = pair.indexOf('rot') >= 0 ? ROTS : BASE, base = mk(rng.pick(shapePool), rng.pick(COL));
      const rv = attrVals(rng, pair[0], shapePool), cv = attrVals(rng, pair[1], shapePool);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(clone(base, { [pair[0]]: rv[r], [pair[1]]: cv[c] }));
      pools = { [pair[0]]: rv, [pair[1]]: cv };
      why = 'Her satırda ' + LABEL[pair[0]] + ' aynı, her sütunda ' + LABEL[pair[1]] + ' aynı.';
    } else {
      // latin2: şekil + renk; latin3: + sütuna bağlı üçüncü özellik; latin4: + satıra bağlı dördüncü özellik
      const rows = rng.shuffle([0, 1, 2]), four = kind === 'latin4';
      const sh = rng.sample(four ? ROTS : BASE, 3), co = rng.sample(COL, 3);
      const third = kind === 'latin2' ? null : four ? 'rot' : rng.pick(['fill', 'size', 'count']);
      const tv = third ? attrVals(rng, third, ROTS) : null, fv = four ? rng.shuffle(FILLS3) : null;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const f = mk(sh[LATINS[0][rows[r]][c]], co[LATINS[1][rows[r]][c]]);
          if (third) f[third] = tv[c];
          if (four) f.fill = fv[r];
          cells.push(f);
        }
      }
      pools = { shape: sh, color: co };
      if (third) pools[third] = tv;
      if (four) pools.fill = fv;
      why = 'Her satırda ve her sütunda her şekilden ve her renkten birer tane var.' +
        (third ? ' Her sütunda ' + LABEL[third] + ' aynı.' : '') + (four ? ' Her satırda iç dolgusu aynı.' : '');
    }
    q.stem = tableSvg(hole, (i, x, y, s) => S.figAt(cells[i], x, y, s));
    q.explain = why + ' Boş kutuya ' + S.name(cells[hole]) + ' gelmeli.';
    return Q.finish(rng, q, opt(cells[hole]), variants(rng, cells[hole], pools).map(opt));
  };

  /* ---------- Şekil Benzetmesi (A -> B, C -> ?) ---------- */
  function arrowGlyph(x, y) {
    return '<path d="M' + x + ' ' + y + 'h26m-11 -11l11 11l-11 11" fill="none" stroke="#5a6b8c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  /* draw: üç çizim işlevi (x, y, s) -> svg */
  function analogySvg(draw) {
    const s = 96, y = 6, aw = 44, mid = 34;
    const xs = [6, 6 + s + aw, 6 + 2 * s + aw + mid, 6 + 3 * s + 2 * aw + mid], W = xs[3] + s + 6;
    const inner = S.tile(xs[0], y, s) + draw[0](xs[0], y, s) + arrowGlyph(xs[0] + s + 8, y + s / 2) +
      S.tile(xs[1], y, s) + draw[1](xs[1], y, s) +
      '<path d="M' + (xs[1] + s + mid / 2) + ' ' + (y + 10) + 'v' + (s - 20) + '" stroke="#c5d3ea" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 10"/>' +
      S.tile(xs[2], y, s) + draw[2](xs[2], y, s) + arrowGlyph(xs[2] + s + 8, y + s / 2) + S.qtile(xs[3], y, s);
    return S.svg(W, s + 12, inner, { maxW: W * 0.95 });
  }
  const figDraw = (f) => (x, y, s) => S.figAt(f, x, y, s);

  const TF_TEXT = {
    r90: 'Şekil sağa doğru çeyrek tur dönüyor.', r270: 'Şekil sola doğru çeyrek tur dönüyor.', r180: 'Şekil yarım tur dönüyor.',
    m0: 'Şekil aynadaki gibi sağdan sola çevriliyor: sağ ile sol yer değiştiriyor.', m180: 'Şekil baş aşağı çevriliyor: üst ile alt yer değiştiriyor.',
  };
  function gridAnalogy(rng, hard) {
    const spec = hard ? { kind: 'grid', n: 4, cells: rng.int(6, 7), accent: 2 } : { kind: 'grid', n: 3, cells: rng.int(4, 5), accent: 1 };
    const A = S.randObj(rng, spec), C = S.randObj(rng, spec);
    const t = rng.pick(hard ? [{ rot: 90 }, { rot: 270 }, { rot: 180 }, { rot: 0, mirror: true }, { rot: 180, mirror: true }] : [{ rot: 90 }, { rot: 270 }, { rot: 180 }]);
    t.mirror = !!t.mirror;
    const o = (tf) => ({ html: S.objSvg(C, tf), key: S.objKey(C, tf) });
    const near = t.mirror
      ? [{ rot: (t.rot + 180) % 360, mirror: true }, { rot: 180, mirror: false }, { rot: 0, mirror: false }]
      : [{ rot: t.rot, mirror: true }, { rot: (t.rot + 180) % 360, mirror: false }, { rot: (t.rot + 90) % 360, mirror: false }];
    const rest = rng.shuffle(S.TFS);
    return {
      stem: analogySvg([(x, y, s) => S.objDraw(A, { rot: 0, mirror: false }, x + 10, y + 10, s - 20), (x, y, s) => S.objDraw(A, t, x + 10, y + 10, s - 20),
        (x, y, s) => S.objDraw(C, { rot: 0, mirror: false }, x + 10, y + 10, s - 20)]),
      correct: o(t), wrong: rng.shuffle(near).concat(rest).map(o),
      why: 'Kural: ' + TF_TEXT[(t.mirror ? 'm' : 'r') + t.rot] + ' Aynı kural üçüncü şekle uygulanıyor.',
    };
  }

  B.GEN.analogy = function (rng, level) {
    const q = { prompt: 'Soldaki değişime bak. Aynı kurala göre soru işaretinin yerine hangisi gelir?' };
    const kind = level === 1 ? 'figs2' : rng.pick(level === 2 ? ['figs3', 'figs3', 'gridrot'] : ['gridtf', 'gridtf', 'inout', 'figs3x']);

    if (kind === 'gridrot' || kind === 'gridtf') {
      const g = gridAnalogy(rng, kind === 'gridtf');
      q.stem = g.stem;
      q.explain = g.why;
      return Q.finish(rng, q, g.correct, g.wrong);
    }
    if (kind === 'inout') {
      // içteki şekil dışa, dıştaki içe geçiyor; renkleriyle birlikte
      const sh = rng.sample(HOLDERS, 4), co = rng.sample(COL, 4);
      const make = (os, oc, is, ic) => mk(os, oc, { inner: { shape: is, color: ic } });
      const A = make(sh[0], co[0], sh[1], co[1]), Bf = make(sh[1], co[1], sh[0], co[0]);
      const C = make(sh[2], co[2], sh[3], co[3]), ans = make(sh[3], co[3], sh[2], co[2]);
      q.stem = analogySvg([figDraw(A), figDraw(Bf), figDraw(C)]);
      q.explain = 'Kural: içteki şekil dışa, dıştaki şekil içe geçiyor; renkleri de kendileriyle birlikte gidiyor.';
      return Q.finish(rng, q, opt(ans), rng.shuffle([make(sh[3], co[2], sh[2], co[3]), make(sh[2], co[3], sh[3], co[2]), C]).concat([Bf]).map(opt));
    }

    const ids = kind === 'figs2'
      ? rng.pick([['rot', 'fill'], ['rot', 'color'], ['count', 'color'], ['size', 'inner'], ['size', 'fill'], ['rot', 'size'], ['count', 'fill'], ['color', 'inner']])
      : kind === 'figs3'
        ? rng.pick([['rot', 'color', 'size'], ['rot', 'fill', 'color'], ['count', 'color', 'fill'], ['size', 'fill', 'color'], ['rot', 'size', 'fill']])
        : rng.pick([['rot', 'color', 'inner'], ['size', 'color', 'inner'], ['rot', 'size', 'inner'], ['count', 'color', 'size']]);
    const turns = ids.indexOf('rot') >= 0, holds = ids.indexOf('inner') >= 0;
    // hem dönen hem içine şekil alan şekiller: ortası dolu ve yönü belli olanlar
    const pool = turns && holds ? ['triangle', 'heart', 'drop', 'arrow'] : turns ? ROTS : holds ? HOLDERS : BASE;
    const two = rng.sample(pool, 2), cols = rng.shuffle(COL);
    const A = mk(two[0], cols[0]), C = mk(two[1], ids.indexOf('color') >= 0 ? cols[0] : cols[1]);
    const T = [];
    ids.forEach((id) => {
      if (id === 'color') {
        T.push({ ap: (f) => clone(f, { color: cols[2] }), alt: (f) => [cols[3], cols[4]].map((c) => clone(f, { color: c })), txt: 'rengi ' + colName(cols[2]) + ' oluyor' });
      } else if (id === 'size') {
        const shrink = rng.chance(0.6), to = shrink ? 0.46 : 1;
        A.size = C.size = shrink ? 1 : 0.46;
        T.push({ ap: (f) => clone(f, { size: to }), alt: (f) => [clone(f, { size: 0.72 })], txt: shrink ? 'şekil küçülüyor' : 'şekil büyüyor' });
      } else if (id === 'fill') {
        const toEmpty = rng.chance(0.5), to = toEmpty ? 'empty' : 'solid';
        A.fill = C.fill = toEmpty ? 'solid' : 'empty';
        T.push({ ap: (f) => clone(f, { fill: to }), alt: (f) => [clone(f, { fill: 'stripe' })], txt: toEmpty ? 'içi boşalıyor' : 'içi doluyor' });
      } else if (id === 'rot') {
        const d = rng.pick([90, 270, 180]);
        A.rot = rng.pick([0, 90, 180, 270]);
        C.rot = rng.pick([0, 90, 180, 270]);
        T.push({
          ap: (f) => clone(f, { rot: (f.rot + d) % 360 }),
          alt: (f) => [90, 180, 270].filter((x) => x !== d).map((x) => clone(f, { rot: (f.rot + x) % 360 })),
          txt: d === 90 ? 'şekil sağa doğru çeyrek tur dönüyor' : d === 270 ? 'şekil sola doğru çeyrek tur dönüyor' : 'şekil yarım tur dönüyor',
        });
      } else if (id === 'count') {
        A.count = rng.int(1, 2);
        C.count = rng.int(1, 3);
        T.push({
          ap: (f) => clone(f, { count: f.count + 1 }),
          alt: (f) => [f.count + 2 <= 4 ? clone(f, { count: f.count + 2 }) : null, f.count > 1 ? clone(f, { count: f.count - 1 }) : null].filter(Boolean),
          txt: 'şekil sayısı bir artıyor',
        });
      } else {
        const inn = rng.sample(['circle', 'square', 'triangle', 'star'], 2);
        const ic = COL.filter((c) => c !== A.color && c !== C.color && c !== cols[2]);
        T.push({
          ap: (f) => clone(f, { inner: { shape: inn[0], color: ic[0] } }),
          alt: (f) => [clone(f, { inner: { shape: inn[1], color: ic[0] } }), clone(f, { inner: { shape: inn[0], color: ic[1] } })],
          txt: 'içine küçük bir ' + shName(inn[0]) + ' ekleniyor',
        });
      }
    });
    const apAll = (f, skip) => T.reduce((x, t, i) => (i === skip ? x : t.ap(x)), f);
    const Bf = apAll(A), ans = apAll(C);
    // en güçlü çeldiriciler: kuralın bir adımı eksik uygulanmış hâller, sonra adımlardan biri yanlış uygulanmış hâller
    let wrong = T.map((_, i) => apAll(C, i));
    T.forEach((t, i) => { wrong = wrong.concat(t.alt(apAll(C, i))); });
    wrong = rng.shuffle(wrong.slice(0, T.length)).concat(rng.shuffle(wrong.slice(T.length)), [C, Bf, clone(ans, { color: cols[5] }), clone(ans, { shape: two[0] })]);
    q.stem = analogySvg([figDraw(A), figDraw(Bf), figDraw(C)]);
    q.explain = 'Kural: ' + T.map((t) => t.txt).join(', ') + '. Aynı kural üçüncü şekle uygulanınca ' + S.name(ans) + ' elde edilir.';
    return Q.finish(rng, q, opt(ans), wrong.map(opt));
  };

  /* ---------- Farklı Olan ---------- */
  B.GEN.odd = function (rng, level) {
    const q = { prompt: 'Hangisi diğerlerinden farklı?', stem: '' };
    const kind = rng.pick(level === 1 ? ['mirror', 'mirror', 'relation', 'noise2'] : level === 2 ? ['mirror4', 'curved', 'parity', 'relcolor'] : ['near', 'near', 'mirror5']);
    const tf = (rot, mirror) => ({ rot: rot, mirror: !!mirror });

    if (kind === 'mirror' || kind === 'mirror4' || kind === 'mirror5') {
      const spec = kind === 'mirror5' ? { kind: 'grid', n: 5, cells: rng.int(9, 10), accent: 3 }
        : kind === 'mirror4' ? { kind: 'grid', n: 4, cells: rng.int(6, 7), accent: 2 }
          : rng.pick([{ kind: 'grid', n: 3, cells: 4, accent: 1 }, { kind: 'grid', n: 3, cells: 5, accent: 1 }, { kind: 'shape' }, { kind: 'glyph' }]);
      const o = S.randObj(rng, spec), mk2 = (t) => ({ html: S.objSvg(o, t), key: S.objKey(o, t) });
      q.explain = 'Diğer üçü aynı şeklin döndürülmüş hâli. Farklı olan ise şeklin ters çevrilmiş (ayna) görüntüsü.';
      return Q.finish(rng, q, mk2(tf(rng.pick([0, 90, 180, 270]), true)), rng.sample([0, 90, 180, 270], 3).map((r) => mk2(tf(r))));
    }
    if (kind === 'near') {
      // üçü aynı şeklin dönmüş hâli; dördüncüde tek bir kare yer değiştirmiş
      const o = S.randObj(rng, { kind: 'grid', n: 4, cells: rng.int(6, 8), accent: 2 });
      const orbit = new Set(S.TFS.map((t) => G.key(G.tf(o.m, t))));
      let alt = null;
      for (let t = 0; t < 40 && !alt; t++) { const m = G.nudge(rng, o.m, 2, ['move']); if (!orbit.has(G.key(m))) alt = m; }
      if (!alt) throw new Error('yakın şekil bulunamadı');
      const mkG = (m) => ({ html: S.svg(100, 100, G.draw(m, o.pal, 9, 9, 82), { cls: 'opt-svg' }), key: 'g' + G.key(m) });
      q.explain = 'Diğer üçü aynı şeklin döndürülmüş hâli. Farklı olanda bir kare başka yerde duruyor.';
      return Q.finish(rng, q, mkG(G.tf(alt, tf(rng.pick([0, 90, 180, 270])))), rng.sample([0, 90, 180, 270], 3).map((r) => mkG(G.tf(o.m, tf(r)))));
    }

    let odd, rest;
    const colors = rng.sample(COL, 4);
    if (kind === 'relation' || kind === 'relcolor') {
      const sh = rng.sample(HOLDERS, 4);
      if (kind === 'relation') {
        const other = rng.pick(sh.filter((s) => s !== sh[0]));
        odd = mk(sh[0], colors[0], { inner: { shape: other, color: colors[1] } });
        rest = [1, 2, 3].map((i) => mk(sh[i], colors[i], { inner: { shape: sh[i], color: colors[(i + 1) % 4] } }));
        q.explain = 'Diğerlerinde içteki küçük şekil dıştaki şekille aynı. Farklı olanda içteki şekil başka.';
      } else {
        const inner = rng.pick(['star', 'plus']);
        odd = mk(sh[0], colors[0], { inner: { shape: inner, color: colors[1] } });
        rest = [1, 2, 3].map((i) => mk(sh[i], colors[i], { inner: { shape: inner, color: colors[i] } }));
        q.explain = 'Diğerlerinde içteki şekil dıştakiyle aynı renkte. Farklı olanda içteki şeklin rengi başka.';
      }
    } else if (kind === 'curved') {
      const straight = rng.sample(['triangle', 'square', 'pentagon', 'hexagon', 'diamond', 'star', 'plus', 'arrow'], 3);
      const round = rng.sample(['circle', 'heart', 'moon', 'drop'], 3), inv = rng.chance(0.5);
      odd = mk(inv ? straight[0] : round[0], colors[0]);
      rest = [1, 2, 3].map((i) => mk((inv ? round : straight)[i - 1], colors[i]));
      q.explain = inv ? 'Diğer üçünün kenarları eğri. Farklı olan düz kenarlı ve köşeli.' : 'Diğer üçünün kenarları düz ve köşeli. Farklı olanın kenarı eğri.';
    } else if (kind === 'parity') {
      const shapes = rng.sample(BASE, 4), even = rng.chance(0.5);
      const common = rng.pick(even ? [[2, 4, 2], [4, 2, 4]] : [[1, 3, 1], [3, 1, 3]]);
      odd = mk(shapes[0], colors[0], { count: rng.pick(even ? [1, 3] : [2, 4]) });
      rest = [1, 2, 3].map((i) => mk(shapes[i], colors[i], { count: common[i - 1] }));
      q.explain = even ? 'Diğer kutularda çift sayıda şekil var. Farklı olanda tek sayıda şekil var.' : 'Diğer kutularda tek sayıda şekil var. Farklı olanda çift sayıda şekil var.';
    } else {
      // noise2: şekil ve renk dördünde de farklı; yalnız boyut, dolgu ya da sayı ortak
      const target = rng.pick(['size', 'fill', 'count']), shapes = rng.sample(BASE, 4);
      const vals = target === 'size' ? rng.shuffle([1, 0.46]) : target === 'fill' ? rng.sample(FILLS3, 2) : rng.sample([1, 2, 3, 4], 2);
      odd = mk(shapes[0], colors[0], { [target]: vals[1] });
      rest = [1, 2, 3].map((i) => mk(shapes[i], colors[i], { [target]: vals[0] }));
      q.explain = target === 'size' ? 'Diğer üçü ' + S.SIZE_NAMES[vals[0]] + '. Farklı olan ' + S.SIZE_NAMES[vals[1]] + '.'
        : target === 'fill' ? 'Diğer üçü ' + S.FILL_NAMES[vals[0]] + '. Farklı olan ' + S.FILL_NAMES[vals[1]] + '.'
          : 'Diğer kutularda ' + vals[0] + ' şekil var. Farklı olanda ' + vals[1] + ' şekil var.';
    }
    return Q.finish(rng, q, opt(odd), rest.map(opt));
  };

  B.GenUtil = { mk: mk, clone: clone, opt: opt, variants: variants, BASE: BASE, ROTS: ROTS, cap: cap };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
