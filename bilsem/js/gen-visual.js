/* Zekâ Kâşifi — şekil bulmacaları: örüntü, tablo, benzetme, farklı olan */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const BASE = ['circle', 'square', 'triangle', 'star', 'heart', 'pentagon', 'hexagon', 'plus', 'diamond'];
  const ROTS = ['arrow', 'triangle', 'heart', 'drop', 'moon', 'pac', 'semi'];
  const COL = S.COLOR_IDS;
  const SIZES3 = [1, 0.72, 0.46];
  const FILLS3 = ['solid', 'empty', 'stripe'];
  const LABEL = { shape: 'şekil', color: 'renk', size: 'boyut', count: 'şekil sayısı', fill: 'iç dolgusu', rot: 'yön' };

  const mk = (shape, color, extra) => Object.assign({ shape: shape, color: color, fill: 'solid', size: 1, rot: 0, count: 1 }, extra || {});
  const clone = (f, ch) => Object.assign({}, f, ch);
  const opt = (f) => ({ html: S.figSvg(f), key: S.key(f) });
  const colName = (c) => S.COLORS[c].name;
  const shName = (s) => S.SHAPES[s].name;

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

  function rowSvg(figs, hole) {
    const s = 96, gap = 10, pad = 6, n = figs.length;
    let inner = '';
    for (let i = 0; i < n; i++) {
      const x = pad + i * (s + gap);
      inner += i === hole ? S.qtile(x, pad, s) : S.tile(x, pad, s) + S.figAt(figs[i], x, pad, s);
    }
    return S.svg(pad * 2 + n * s + (n - 1) * gap, s + pad * 2, inner, { maxW: (pad * 2 + n * s + (n - 1) * gap) * 0.95 });
  }

  /* ---------- Şekil Örüntüsü ---------- */
  B.GEN.pattern = function (rng, level) {
    const q = { prompt: 'Soru işaretinin yerine hangisi gelmeli?' };
    const kind = rng.pick(level === 1 ? ['unit'] : level === 2 ? ['unitmid', 'rot', 'count', 'two'] : ['two3', 'two3', 'rotcol']);
    const seq = [];
    let hole, wrong, why;

    if (kind === 'unit' || kind === 'unitmid') {
      const tpl = rng.pick(kind === 'unit' ? ['AB', 'ABC', 'AAB', 'ABB'] : ['ABC', 'AAB', 'ABB', 'ABAC', 'AABB']);
      const sh = rng.sample(BASE, 3), co = rng.sample(COL, 3);
      const F = { A: mk(sh[0], co[0]), B: mk(sh[1], co[1]), C: mk(sh[2], co[2]) };
      const p = tpl.length, len = p === 2 ? rng.int(6, 7) : p === 3 ? 7 : 8;
      for (let i = 0; i < len; i++) seq.push(F[tpl[i % p]]);
      hole = kind === 'unit' ? len - 1 : rng.int(2, len - 1);
      wrong = rng.shuffle([F.A, F.B, F.C]).concat(variants(rng, seq[hole], { shape: sh, color: co }));
      why = 'Şekiller şu sırayla tekrar ediyor: ' + tpl.split('').map((k) => S.name(F[k])).join(', ') + '.';
    } else if (kind === 'rot' || kind === 'rotcol') {
      const shape = rng.pick(ROTS), dir = rng.pick([90, 270]), start = rng.pick([0, 90, 180, 270]);
      const cols = kind === 'rotcol' ? rng.sample(COL, rng.pick([2, 3])) : [rng.pick(COL)];
      const len = kind === 'rotcol' ? 7 : 6;
      for (let i = 0; i < len; i++) seq.push(mk(shape, cols[i % cols.length], { rot: (start + i * dir) % 360 }));
      hole = rng.chance(0.5) ? len - 1 : rng.int(2, len - 2);
      wrong = variants(rng, seq[hole], cols.length > 1 ? { rot: [0, 90, 180, 270], color: cols } : { rot: [0, 90, 180, 270] });
      why = 'Şekil her adımda ' + (dir === 90 ? 'sağa' : 'sola') + ' doğru çeyrek tur dönüyor.' +
        (cols.length > 1 ? ' Renkler de sırayla değişiyor: ' + cols.map(colName).join(', ') + '.' : '');
    } else if (kind === 'count') {
      const f = mk(rng.pick(BASE), rng.pick(COL));
      const cyc = rng.pick([[1, 2, 3], [3, 2, 1], [1, 2, 3, 4]]);
      const len = cyc.length === 3 ? 7 : 8;
      for (let i = 0; i < len; i++) seq.push(clone(f, { count: cyc[i % cyc.length] }));
      hole = rng.chance(0.5) ? len - 1 : rng.int(3, len - 2);
      wrong = variants(rng, seq[hole], { count: [1, 2, 3, 4] });
      why = 'Şekil sayısı ' + cyc.join(', ') + ' diye tekrar ediyor.';
    } else {
      const attrs = kind === 'two' ? ['shape', 'color'] : rng.sample(['shape', 'color', 'size', 'fill'], 2);
      const periods = kind === 'two' ? [2, 3] : rng.pick([[2, 3], [3, 2]]);
      const base = mk(rng.pick(BASE), rng.pick(COL));
      const vals = {}, pools = {}, parts = [];
      attrs.forEach((a, i) => {
        const p = periods[i];
        let all;
        if (a === 'shape') all = rng.sample(BASE, 3);
        else if (a === 'color') all = rng.sample(COL, 3);
        else if (a === 'size') all = p === 2 ? rng.shuffle([1, 0.46]).concat([0.72]) : rng.shuffle(SIZES3);
        else all = rng.shuffle(FILLS3);
        vals[a] = all.slice(0, p);
        pools[a] = all;
        const head = a === 'shape' ? 'Şekiller' : a === 'color' ? 'Renkler' : a === 'size' ? 'Boyutlar' : 'İç dolgular';
        parts.push(head + ' sırayla: ' + vals[a].map((v) => valName(a, v)).join(', ') + '.');
      });
      const len = 7;
      for (let i = 0; i < len; i++) seq.push(clone(base, { [attrs[0]]: vals[attrs[0]][i % periods[0]], [attrs[1]]: vals[attrs[1]][i % periods[1]] }));
      hole = kind === 'two' ? len - 1 : rng.int(2, len - 1);
      wrong = variants(rng, seq[hole], pools);
      why = parts.join(' ') + ' İkisi birlikte tekrar ediyor.';
    }

    q.stem = rowSvg(seq, hole);
    q.explain = why + ' Boş yere ' + S.name(seq[hole]) + ' gelmeli.';
    if (kind === 'rot' || kind === 'rotcol') q.explain = why;
    return Q.finish(rng, q, opt(seq[hole]), wrong.map(opt));
  };

  /* ---------- Şekil Tablosu (3x3) ---------- */
  const LATINS = [[[0, 1, 2], [1, 2, 0], [2, 0, 1]], [[0, 1, 2], [2, 0, 1], [1, 2, 0]]];

  function gridSvg(cells, hole) {
    const s = 92, gap = 10, pad = 14, W = pad * 2 + 3 * s + 2 * gap;
    let inner = '<rect x="2" y="2" width="' + (W - 4) + '" height="' + (W - 4) + '" rx="24" fill="#e9f0fb" stroke="#c5d3ea" stroke-width="3"/>';
    for (let i = 0; i < 9; i++) {
      const x = pad + (i % 3) * (s + gap), y = pad + Math.floor(i / 3) * (s + gap);
      inner += i === hole ? S.qtile(x, y, s) : S.tile(x, y, s) + S.figAt(cells[i], x, y, s);
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

  B.GEN.matrix = function (rng, level) {
    const q = { prompt: 'Tablodaki boş kutuya hangisi gelmeli?' };
    const kind = level === 1 ? 'rc' : level === 2 ? rng.pick(['rc2', 'rc2', 'latin']) : rng.pick(['latin2', 'latin2', 'rc3']);
    const cells = [];
    let hole = 8, pools, why;

    if (kind === 'latin' || kind === 'latin2') {
      const rows = rng.shuffle([0, 1, 2]), sh = rng.sample(BASE, 3), co = rng.sample(COL, 4);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          cells.push(mk(sh[LATINS[0][rows[r]][c]], kind === 'latin2' ? co[LATINS[1][rows[r]][c]] : co[0]));
        }
      }
      hole = rng.int(0, 8);
      pools = kind === 'latin2' ? { shape: sh, color: co.slice(0, 3) } : { shape: sh, color: [co[0], co[1]] };
      why = kind === 'latin2'
        ? 'Her satırda ve her sütunda her şekilden ve her renkten birer tane var.'
        : 'Her satırda ve her sütunda her şekilden birer tane var.';
    } else {
      const pairs = kind === 'rc' ? [['shape', 'color']]
        : kind === 'rc2' ? [['shape', 'count'], ['shape', 'size'], ['color', 'count'], ['shape', 'fill'], ['color', 'rot']]
          : [['rot', 'fill'], ['size', 'fill'], ['count', 'fill'], ['rot', 'size'], ['rot', 'count']];
      let pair = rng.pick(pairs);
      if (rng.chance(0.5)) pair = [pair[1], pair[0]];
      const ra = pair[0], ca = pair[1];
      const shapePool = (ra === 'rot' || ca === 'rot') ? ROTS : BASE;
      const base = mk(rng.pick(shapePool), rng.pick(COL));
      const rv = attrVals(rng, ra, shapePool), cv = attrVals(rng, ca, shapePool);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push(clone(base, { [ra]: rv[r], [ca]: cv[c] }));
      hole = kind === 'rc' ? 8 : rng.int(0, 8);
      pools = { [ra]: rv, [ca]: cv };
      why = 'Her satırda ' + LABEL[ra] + ' aynı, her sütunda ' + LABEL[ca] + ' aynı.';
    }

    q.stem = gridSvg(cells, hole);
    q.explain = why + ' Boş kutuya ' + S.name(cells[hole]) + ' gelmeli.';
    return Q.finish(rng, q, opt(cells[hole]), variants(rng, cells[hole], pools).map(opt));
  };

  /* ---------- Şekil Benzetmesi (A -> B, C -> ?) ---------- */
  function arrowGlyph(x, y) {
    return '<path d="M' + x + ' ' + y + 'h26m-11 -11l11 11l-11 11" fill="none" stroke="#5a6b8c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function analogySvg(A, Bf, C) {
    const s = 96, y = 6, aw = 44, mid = 34;
    const xs = [6, 6 + s + aw, 6 + 2 * s + aw + mid, 6 + 3 * s + 2 * aw + mid];
    const W = xs[3] + s + 6;
    let inner = S.tile(xs[0], y, s) + S.figAt(A, xs[0], y, s) + arrowGlyph(xs[0] + s + 8, y + s / 2) +
      S.tile(xs[1], y, s) + S.figAt(Bf, xs[1], y, s) +
      '<path d="M' + (xs[1] + s + mid / 2) + ' ' + (y + 10) + 'v' + (s - 20) + '" stroke="#c5d3ea" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 10"/>' +
      S.tile(xs[2], y, s) + S.figAt(C, xs[2], y, s) + arrowGlyph(xs[2] + s + 8, y + s / 2) + S.qtile(xs[3], y, s);
    return S.svg(W, s + 12, inner, { maxW: W * 0.95 });
  }

  B.GEN.analogy = function (rng, level) {
    const q = { prompt: 'Soldaki değişime bak. Aynı kurala göre soru işaretinin yerine hangisi gelir?' };
    const ids = level === 1 ? [rng.pick(['color', 'size', 'fill', 'count'])]
      : level === 2 ? rng.pick([['rot'], ['inner'], ['count'], ['fill'], ['color', 'size']])
        : rng.pick([['rot', 'fill'], ['rot', 'color'], ['count', 'color'], ['size', 'inner'], ['size', 'fill'], ['rot', 'size'], ['count', 'fill'], ['color', 'inner']]);
    const pool = ids.indexOf('rot') >= 0 ? ROTS : BASE;
    const two = rng.sample(pool, 2), cols = rng.shuffle(COL);
    const A = mk(two[0], cols[0]);
    const C = mk(two[1], (level === 1 || ids.indexOf('color') >= 0) ? cols[0] : cols[1]);
    const T = [];

    ids.forEach((id) => {
      if (id === 'color') {
        T.push({
          ap: (f) => clone(f, { color: cols[2] }),
          alt: (f) => [cols[3], cols[4]].map((c) => clone(f, { color: c })),
          txt: 'rengi ' + colName(cols[2]) + ' oluyor',
        });
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
        C.rot = level === 3 ? rng.pick([0, 90, 180, 270]) : A.rot;
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

    const apAll = (f) => T.reduce((x, t) => t.ap(x), f);
    const Bf = apAll(A), ans = apAll(C);
    let specific;
    if (T.length === 2) {
      specific = [T[0].ap(C), T[1].ap(C)].concat(rng.shuffle(T[0].alt(T[1].ap(C)).concat(T[1].alt(T[0].ap(C)))));
    } else {
      specific = rng.shuffle(T[0].alt(C));
    }
    const wrong = [C].concat(specific, [Bf, clone(ans, { color: cols[5] }), clone(C, { color: cols[5] }), clone(ans, { shape: two[0] })]);

    q.stem = analogySvg(A, Bf, C);
    q.explain = 'Kural: ' + T.map((t) => t.txt).join(' ve ') + '. Aynı kural üçüncü şekle uygulanınca ' + S.name(ans) + ' elde edilir.';
    return Q.finish(rng, q, opt(ans), wrong.map(opt));
  };

  /* ---------- Farklı Olan ---------- */
  B.GEN.odd = function (rng, level) {
    const q = { prompt: 'Hangisi diğerlerinden farklı?', stem: '' };
    const kind = level === 1 ? rng.pick(['shape', 'color'])
      : level === 2 ? rng.pick(['size', 'fill', 'count', 'rot'])
        : rng.pick(['mirror', 'mirror', 'relation', 'noise2']);

    if (kind === 'mirror') {
      const spec = rng.pick([{ kind: 'grid', n: 3, cells: 4, accent: 1 }, { kind: 'grid', n: 3, cells: 5, accent: 1 }, { kind: 'shape' }, { kind: 'glyph' }]);
      const o = S.randObj(rng, spec);
      const mk2 = (tf) => ({ html: S.objSvg(o, tf), key: S.objKey(o, tf) });
      const rots = rng.sample([0, 90, 180, 270], 3);
      q.explain = 'Diğer üçü aynı şeklin döndürülmüş hâli. Farklı olan ise şeklin ters çevrilmiş (ayna) görüntüsü.';
      return Q.finish(rng, q, mk2({ rot: rng.pick([0, 90, 180, 270]), mirror: true }), rots.map((r) => mk2({ rot: r, mirror: false })));
    }

    let odd, rest;
    if (kind === 'relation') {
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'], 4), co = rng.sample(COL, 4);
      const innerCol = (i) => co[(i + 1) % 4];
      const other = rng.pick(sh.filter((s) => s !== sh[0]));
      odd = mk(sh[0], co[0], { inner: { shape: other, color: innerCol(0) } });
      rest = [1, 2, 3].map((i) => mk(sh[i], co[i], { inner: { shape: sh[i], color: innerCol(i) } }));
      q.explain = 'Diğerlerinde içteki küçük şekil dıştaki şekille aynı. Farklı olanda içteki şekil başka.';
    } else {
      const target = kind === 'noise2' ? rng.pick(['size', 'fill', 'count']) : kind;
      const shapePool = target === 'rot' ? ROTS : BASE;
      const shapes = rng.sample(shapePool, 4), colors = rng.sample(COL, 4);
      // gürültü: hangi özellikler dört şıkta da farklı olacak
      let noiseShape, noiseColor;
      if (target === 'shape') { noiseShape = false; noiseColor = true; }
      else if (target === 'color') { noiseShape = true; noiseColor = false; }
      else if (target === 'rot') { noiseShape = false; noiseColor = true; }
      else if (kind === 'noise2') { noiseShape = true; noiseColor = true; }
      else { noiseShape = rng.chance(0.5); noiseColor = !noiseShape; }

      let common, diff;
      if (target === 'shape') { common = shapes[0]; diff = shapes[1]; }
      else if (target === 'color') { common = colors[0]; diff = colors[1]; }
      else if (target === 'size') { const big = rng.chance(0.5); common = big ? 1 : 0.46; diff = big ? 0.46 : 1; }
      else if (target === 'fill') { const two = rng.sample(FILLS3, 2); common = two[0]; diff = two[1]; }
      else if (target === 'count') { const two = rng.sample([1, 2, 3, 4], 2); common = two[0]; diff = two[1]; }
      else { const two = rng.sample([0, 90, 180, 270], 2); common = two[0]; diff = two[1]; }

      const build = (i, v) => {
        const f = mk(noiseShape ? shapes[i] : shapes[0], noiseColor ? colors[i] : colors[0]);
        if (target === 'shape') { f.shape = v; }
        else if (target === 'color') { f.color = v; }
        else f[target] = v;
        return f;
      };
      // hedef şekil/renk olduğunda gürültü dizisinin ilk iki elemanı hedef değerlerdir; çakışmayı önle
      if (target === 'shape') {
        odd = mk(diff, colors[0]);
        rest = [1, 2, 3].map((i) => mk(common, colors[i]));
      } else if (target === 'color') {
        odd = mk(shapes[0], diff);
        rest = [1, 2, 3].map((i) => mk(shapes[i], common));
      } else {
        odd = build(0, diff);
        rest = [1, 2, 3].map((i) => build(i, common));
      }
      q.explain = target === 'shape' ? 'Diğer üçü ' + shName(common) + '. Farklı olan ' + shName(diff) + '.'
        : target === 'color' ? 'Diğer üçü ' + colName(common) + '. Farklı olan ' + colName(diff) + '.'
          : target === 'size' ? 'Diğer üçü ' + S.SIZE_NAMES[common] + '. Farklı olan ' + S.SIZE_NAMES[diff] + '.'
            : target === 'fill' ? 'Diğer üçü ' + S.FILL_NAMES[common] + '. Farklı olan ' + S.FILL_NAMES[diff] + '.'
              : target === 'count' ? 'Diğer kutularda ' + common + ' şekil var. Farklı olanda ' + diff + ' şekil var.'
                : 'Diğer üçü aynı yöne bakıyor. Farklı olan başka yöne bakıyor.';
    }
    return Q.finish(rng, q, opt(odd), rest.map(opt));
  };

  B.GenUtil = { mk: mk, clone: clone, opt: opt, variants: variants, BASE: BASE, ROTS: ROTS };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
