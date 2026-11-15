/* Sayı makinesi, gölge bulma, terazi, kim hangisi */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS, r1 = S.r1, INK = S.INK;

  /* ---------- Sayı Makinesi ---------- */
  // rows: [{ ins: [sayılar], out: sayı }]; son satırda hole: 'in' | 'out'
  function machineSvg(rows, hole) {
    const k = rows[0].ins.length, th = 58, gap = 10, tw = k === 2 ? 62 : 86, pad = 8, top = 28, aw = 40, mw = 92;
    const inW = k * tw + (k - 1) * 8, mx = pad + inW + aw, W = mx + mw + aw + 86 + pad, H = top + rows.length * th + (rows.length - 1) * gap + pad;
    const soft = { fill: '#566889', weight: 700 };
    const arrow = (x, y) => '<path d="M' + x + ' ' + y + 'h20m-9 -9l9 9l-9 9" fill="none" stroke="#566889" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
    let inner = S.text(pad + inW / 2, 12, 'giren', 16, soft) + S.text(mx + mw / 2, 12, 'makine', 16, soft) + S.text(W - pad - 43, 12, 'çıkan', 16, soft) +
      '<rect x="' + mx + '" y="' + (top - 4) + '" width="' + mw + '" height="' + (H - top - pad + 8) + '" rx="20" fill="#a565f2" stroke="' + INK + '" stroke-width="4"/>';
    const my = (top + H - pad) / 2;
    [[-16, -26, 20], [16, 6, 15], [-14, 34, 11]].forEach((g) => {
      inner += '<circle cx="' + (mx + mw / 2 + g[0]) + '" cy="' + (my + g[1]) + '" r="' + g[2] + '" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="7" stroke-dasharray="7 5"/>';
    });
    rows.forEach((row, i) => {
      const y = top + i * (th + gap), last = i === rows.length - 1, xr = W - pad - 86;
      row.ins.forEach((v, j) => {
        const x = pad + j * (tw + 8);
        inner += last && hole === 'in' ? S.qtile(x, y, th, { w: tw }) : S.tile(x, y, th, { w: tw }) + S.text(x + tw / 2, y + th / 2, v, 32);
      });
      inner += arrow(pad + inW + 9, y + th / 2) + arrow(mx + mw + 9, y + th / 2) +
        (last && hole === 'out' ? S.qtile(xr, y, th, { w: 86 }) : S.tile(xr, y, th, { w: 86 }) + S.text(xr + 43, y + th / 2, row.out, 32));
    });
    return S.svg(W, H, inner, { maxW: W });
  }

  // tek girişli kurallar: [işlev, açıklama, en küçük giriş, en büyük giriş]
  const RULES1 = {
    dbl: [(n) => 2 * n, 'Makine her sayının 2 katını alıyor.', 1, 10],
    dbl1: [(n) => 2 * n + 1, 'Makine sayının 2 katını alıp 1 ekliyor.', 1, 10],
    dblm: [(n) => 2 * n - 1, 'Makine sayının 2 katını alıp 1 çıkarıyor.', 1, 10],
    tri: [(n) => 3 * n, 'Makine her sayının 3 katını alıyor.', 1, 8],
    ten: [(n) => 10 - n, 'Makine her sayıyı 10\'dan çıkarıyor. Giren ile çıkanın toplamı hep 10.', 0, 10],
    tri1: [(n) => 3 * n + 1, 'Makine sayının 3 katını alıp 1 ekliyor.', 1, 9],
    trim: [(n) => 3 * n - 1, 'Makine sayının 3 katını alıp 1 çıkarıyor.', 1, 9],
    dbl3: [(n) => 2 * n + 3, 'Makine sayının 2 katını alıp 3 ekliyor.', 1, 10],
    sq: [(n) => n * n, 'Makine her sayıyı kendisiyle çarpıyor.', 1, 7],
    twenty: [(n) => 20 - n, 'Makine her sayıyı 20\'den çıkarıyor. Giren ile çıkanın toplamı hep 20.', 1, 19],
    half: [(n) => n / 2, 'Makine her sayının yarısını alıyor.', 2, 20],
  };
  // iki girişli kurallar
  const RULES2 = {
    sum1: [(a, b) => a + b + 1, 'Makine iki sayıyı toplayıp 1 ekliyor.'],
    sum2: [(a, b) => a + b + 2, 'Makine iki sayıyı toplayıp 2 ekliyor.'],
    prod: [(a, b) => a * b, 'Makine iki sayıyı çarpıyor.'],
    prod1: [(a, b) => a * b + 1, 'Makine iki sayıyı çarpıp 1 ekliyor.'],
    dsum: [(a, b) => 2 * a + b, 'Makine birinci sayının 2 katına ikinci sayıyı ekliyor.'],
    ddif: [(a, b) => 2 * a - b, 'Makine birinci sayının 2 katından ikinci sayıyı çıkarıyor.'],
    plain: [(a, b) => a + b, ''], sumd: [(a, b) => a + 2 * b, ''], dif: [(a, b) => a - b, ''],   // yalnız karışmayı önlemek için
  };

  B.GEN.machine = function (rng, level) {
    const q = {};
    if (level === 4) {
      const id = rng.pick(['sum1', 'sum2', 'prod', 'prod1', 'dsum', 'ddif']), fn = RULES2[id][0];
      let rows;
      for (let t = 0; t < 200; t++) {
        const seen = new Set();
        rows = [];
        while (rows.length < 4) {
          const a = rng.int(2, 6), b = rng.int(1, 5);
          if (seen.has(a + ',' + b) || a === b || fn(a, b) < 0) continue;
          seen.add(a + ',' + b);
          rows.push({ ins: [a, b], out: fn(a, b) });
        }
        // örnek satırlar başka hiçbir kurala uymamalı
        const fits = Object.keys(RULES2).filter((k) => rows.slice(0, 3).every((r) => RULES2[k][0](r.ins[0], r.ins[1]) === r.out));
        if (fits.length === 1) break;
        rows = null;
      }
      if (!rows) throw new Error('makine kuralı ayırt edilemedi');
      q.prompt = 'Makineye iki sayı giriyor, bir sayı çıkıyor. Kuralı bul: soru işaretinin yerine hangi sayı gelmeli?';
      q.stem = machineSvg(rows, 'out');
      q.meta = { rule: id, rows: rows, ans: rows[3].out };
      q.explain = RULES2[id][1] + ' ' + rows[3].ins[0] + ' ve ' + rows[3].ins[1] + ' girince ' + rows[3].out + ' çıkar.';
      return Q.finishNum(rng, q, rows[3].out, { min: 0, prefer: [rows[3].ins[0] + rows[3].ins[1], rows[3].ins[0] * rows[3].ins[1]] });
    }
    // 1. kademe: ekleme, çıkarma, 2 katı. 2. kademe: 2 katı ± 1, 3 katı, 10'dan çıkarma. 3. kademe: 3 katı ± 1, kare, yarı.
    let fn, why, lo, hi;
    const id = level === 1 ? rng.pick(['add', 'sub', 'dbl', 'dbl'])
      : level === 2 ? (rng.chance(0.2) ? 'add' : rng.pick(['dbl1', 'dblm', 'tri', 'ten']))
        : rng.pick(['tri1', 'trim', 'dbl3', 'sq', 'twenty', 'half']);
    if (id === 'add') {
      const k = level === 1 ? rng.int(6, 10) : rng.int(11, 15);
      fn = (n) => n + k; why = 'Makine her sayıya ' + k + ' ekliyor.'; lo = 1; hi = 20;
    } else if (id === 'sub') {
      const k = rng.int(4, 9);
      fn = (n) => n - k; why = 'Makine her sayıdan ' + k + ' çıkarıyor.'; lo = k; hi = k + 15;
    } else {
      fn = RULES1[id][0]; why = RULES1[id][1]; lo = RULES1[id][2]; hi = RULES1[id][3];
    }
    const pool = [];
    for (let n = lo; n <= hi; n++) if (id !== 'half' || n % 2 === 0) pool.push(n);
    const rows = rng.sample(pool, 4).map((n) => ({ ins: [n], out: fn(n) }));
    const holeIn = level > 1 && rng.chance(level === 2 ? 0.4 : 0.5), ans = holeIn ? rows[3].ins[0] : rows[3].out;
    q.prompt = holeIn ? 'Makineye hangi sayı girerse bu sayı çıkar?' : 'Makinenin kuralını bul. Soru işaretinin yerine hangi sayı gelmeli?';
    q.stem = machineSvg(rows, holeIn ? 'in' : 'out');
    q.meta = { rule: id, rows: rows, ans: ans };
    q.explain = why + ' ' + rows[3].ins[0] + ' girince ' + rows[3].out + ' çıkar.';
    return Q.finishNum(rng, q, ans, { min: 0, prefer: [holeIn ? rows[3].out : rows[3].ins[0]] });
  };

  /* ---------- Gölge Bulma ---------- */
  const SH = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon', 'plus', 'diamond', 'semi', 'arrow', 'drop', 'moon'];
  // yerleşimler: 100x100 kutuda parça merkezleri ve boyları
  const LAYOUTS = {
    3: [[[50, 74, 48], [50, 43, 38], [50, 17, 28]], [[31, 66, 52], [71, 67, 44], [50, 27, 42]], [[50, 63, 60], [22, 28, 34], [78, 28, 34]]],
    4: [[[32, 68, 50], [72, 69, 42], [32, 29, 36], [72, 30, 30]], [[50, 72, 46], [18, 46, 30], [82, 46, 30], [50, 30, 36]], [[30, 74, 44], [70, 74, 44], [50, 44, 30], [50, 18, 28]]],
    5: [[[50, 76, 42], [20, 52, 30], [80, 52, 30], [50, 44, 28], [50, 17, 26]], [[28, 74, 42], [72, 74, 42], [50, 46, 32], [22, 24, 28], [78, 24, 28]]],
  };
  const symOf = (p) => S.SHAPES[p.shape].sym;
  const partsKey = (parts) => parts.map((p, i) => i + ':' + p.shape + ':' + (((p.rot % symOf(p)) + 360) % symOf(p)) + ':' + p.k).join('|');
  function partsDraw(parts, lay, shadow) {
    return parts.map((p, i) => {
      const s = lay[i][2] * p.k;
      return S.figAt({ shape: p.shape, color: shadow ? 'ink' : p.color, rot: p.rot }, lay[i][0] - s / 2, lay[i][1] - s / 2, s);
    }).join('');
  }

  B.GEN.shadow = function (rng, level) {
    const n = level === 1 ? 3 : level === 2 ? rng.pick([3, 4]) : rng.pick([4, 5]), lay = rng.pick(LAYOUTS[n]);
    const turn = level === 4 ? rng.pick([90, 180, 270]) : 0;
    const q = { prompt: turn ? 'Bu resmin gölgesi döndürülmüş. Hangisi bu resmin gölgesi?' : 'Bu resmin gölgesi hangisi?' };
    const shapes = rng.sample(SH, n), colors = rng.shuffle(COL.concat(COL)).slice(0, n);
    const parts = shapes.map((s, i) => ({ shape: s, color: colors[i], rot: S.SHAPES[s].sym === 360 ? rng.pick([0, 0, 90, 180, 270]) : 0, k: 1 }));
    const kinds = level === 1 ? ['shape', 'swap', 'rot'] : level === 2 ? ['rot', 'size', 'swap', 'rot', 'shape'] : ['rot', 'rot', 'size', 'size', 'swap'];
    const mk = (ps) => ({
      html: S.svg(100, 100, '<g transform="rotate(' + turn + ' 50 50)">' + partsDraw(ps, lay, true) + '</g>', { cls: 'opt-svg' }),
      key: partsKey(ps),
    });
    const wrong = [];
    for (let t = 0; t < 40; t++) {
      const x = parts.map((p) => Object.assign({}, p)), i = rng.int(0, n - 1), kind = rng.pick(kinds);
      if (kind === 'shape') x[i].shape = rng.pick(SH.filter((s) => shapes.indexOf(s) < 0));
      else if (kind === 'swap') {
        const j = (i + 1) % n, a = x[i].shape, ar = x[i].rot;
        x[i].shape = x[j].shape; x[i].rot = x[j].rot; x[j].shape = a; x[j].rot = ar;
      } else if (kind === 'rot') x[i].rot = (x[i].rot + rng.pick([90, 180, 270])) % 360;
      else x[i].k = 0.6;
      wrong.push(mk(x));
    }
    q.stem = S.svg(100, 100, partsDraw(parts, lay, false), { maxW: 220 });
    q.explain = 'Gölgede renkler görünmez ama dış çizgi aynı kalır.' + (turn ? ' Gölge döndürülmüş olsa da parçaların birbirine göre yeri değişmez.' : '') +
      ' Diğer şıklarda bir parçanın biçimi, yeri, yönü ya da boyu farklı.';
    return Q.finish(rng, q, mk(parts), wrong);
  };

  /* ---------- Terazi ---------- */
  /* L, R: şekil dizileri ya da '?'; tilt: -1 sol ağır, 1 sağ ağır, 0 dengede */
  function scaleDraw(L, R, tilt, x0, y0) {
    const cx = x0 + 100, cy = y0 + 32, a = tilt * 11 * Math.PI / 180, dx = 66 * Math.cos(a), dy = 66 * Math.sin(a);
    const ends = [[cx - dx, cy - dy], [cx + dx, cy + dy]];
    let o = '<path d="M' + (cx - 36) + ' ' + (y0 + 142) + 'h72l-12 -13h-48z" fill="#b4c5e2" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M' + cx + ' ' + cy + 'V' + (y0 + 129) + '" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M' + r1(ends[0][0]) + ' ' + r1(ends[0][1]) + 'L' + r1(ends[1][0]) + ' ' + r1(ends[1][1]) + '" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#ffc93c" stroke="' + INK + '" stroke-width="3"/>';
    ends.forEach((e, i) => {
      const py = e[1] + 54, ex = r1(e[0]), ey = r1(e[1]), load = i ? R : L;
      o += '<path d="M' + ex + ' ' + ey + 'L' + r1(e[0] - 30) + ' ' + r1(py) + 'M' + ex + ' ' + ey + 'L' + r1(e[0] + 30) + ' ' + r1(py) + '" stroke="' + INK + '" stroke-width="2.5" fill="none"/>' +
        '<path d="M' + r1(e[0] - 34) + ' ' + r1(py) + 'h68a34 12 0 0 1 -68 0z" fill="#dfe8f7" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>';
      if (load === '?') o += S.text(e[0], py - 17, '?', 34, { fill: '#e08600' });
      else {
        const m = load.length, s = m === 1 ? 40 : m === 2 ? 30 : 23, w = m * s;
        load.forEach((f, j) => { o += S.figAt(f, e[0] - w / 2 + j * s, py - s + 2, s); });
      }
    });
    return o;
  }
  function scalesSvg(list) {
    const cols = 2, rows = Math.ceil(list.length / cols), W = cols * 210, H = rows * 156;
    const lastRow = list.length - (rows - 1) * cols;
    return S.svg(W, H, list.map((sc, i) => {
      const r = Math.floor(i / cols), shift = r === rows - 1 ? (cols - lastRow) * 105 : 0;
      return scaleDraw(sc[0], sc[1], sc[2], 5 + (i % cols) * 210 + shift, r * 156 + 4);
    }).join(''), { maxW: W });
  }

  B.GEN.balance = function (rng, level) {
    const opt = (f) => ({ html: S.figSvg(f), key: S.key(f) });
    const abl = (f) => S.COLORS[f.color].name + ' ' + S.SHAPES[f.shape].abl;
    const q = {};

    if (level === 4) {
      // dengede duran teraziler: bir şekil diğerinden kaç tane eder?
      const sh = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'], 3), co = rng.sample(COL, 3);
      const A = { shape: sh[0], color: co[0] }, Bf = { shape: sh[1], color: co[1] }, C = { shape: sh[2], color: co[2] };
      const rep = (f, k) => Array.from({ length: k }, () => f), kind = rng.pick(['chain', 'chain', 'sum']);
      let list, ans, why;
      if (kind === 'chain') {
        const k = rng.pick([2, 3]), m = rng.pick([2, 3]);
        list = [[[A], rep(Bf, k), 0], [[Bf], rep(C, m), 0], [[A], '?', 0]];
        ans = k * m;
        why = 'Bir ' + S.name(A) + ' ' + k + ' ' + S.name(Bf) + ' eder. Her ' + S.name(Bf) + ' de ' + m + ' ' + S.name(C) + ' eder. ' + k + ' tane ' + m + ' = ' + ans + '.';
        q.meta = { kind: kind, k: k, m: m, ans: ans };
      } else {
        const m = rng.pick([2, 3]);
        list = [[[A], [Bf, C], 0], [[Bf], rep(C, m), 0], [[A], '?', 0]];
        ans = m + 1;
        why = 'Bir ' + S.name(A) + ', bir ' + S.name(Bf) + ' ile bir ' + S.name(C) + ' kadar ağır. ' + cap(S.name(Bf)) + ' yerine ' + m + ' ' + S.name(C) + ' koyarsak toplam ' + m + ' + 1 = ' + ans + ' eder.';
        q.meta = { kind: kind, m: m, ans: ans };
      }
      q.prompt = 'İlk iki terazi dengede. Üçüncü teraziyi dengelemek için soru işaretli kefeye kaç tane ' + S.name(C) + ' konmalı?';
      q.stem = scalesSvg(list);
      q.explain = why;
      return Q.finishNum(rng, q, ans, { min: 1, prefer: [ans - 1, ans + 1, ans + 2] });
    }

    const n = level === 1 ? 4 : level === 2 ? rng.pick([4, 5]) : 6;
    const shapes = rng.sample(['circle', 'square', 'triangle', 'star', 'heart', 'hexagon'], n), cols = rng.sample(COL, n);
    const figs = shapes.map((s, i) => ({ shape: s, color: cols[i] }));      // 0 en ağır
    const pairs = rng.shuffle(Array.from({ length: n - 1 }, (_, i) => (rng.chance(0.5) ? [i, i + 1] : [i + 1, i])));
    q.stem = scalesSvg(pairs.map((p) => [[figs[p[0]]], [figs[p[1]]], p[0] < p[1] ? -1 : 1]));
    q.explain = 'Aşağı inen kefedeki şekil daha ağırdır. En ağırdan en hafife sıra: ' + figs.map((f) => S.name(f)).join(', ') + '.';
    const ask = rng.pick([null, ['end'], ['rank', 'rank', 'end'], ['rank', 'count', 'count']][level]);
    q.meta = { kind: 'chain', n: n, pairs: pairs, ask: ask };
    if (ask === 'count') {
      const r = rng.int(0, n - 1), heavier = rng.chance(0.5), ans = heavier ? r : n - 1 - r;
      q.prompt = cap(abl(figs[r])) + (heavier ? ' ağır' : ' hafif') + ' kaç şekil var?';
      q.meta.answer = ans;
      return Q.finishNum(rng, q, ans, { min: 0, max: n - 1 });
    }
    const idx = ask === 'end' ? (rng.chance(0.5) ? 0 : n - 1) : rng.int(1, n - 2);
    q.prompt = ask === 'end' ? (idx === 0 ? 'Terazilere göre en ağır şekil hangisi?' : 'Terazilere göre en hafif şekil hangisi?')
      : 'Şekiller en ağırdan en hafife doğru sıralanırsa ' + (idx + 1) + '. sırada hangisi olur?';
    q.meta.answer = idx;
    return Q.finish(rng, q, opt(figs[idx]), rng.shuffle(figs.filter((_, i) => i !== idx)).map(opt));
  };
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* ---------- Kim Hangisi? ---------- */
  // [ad, tamlayan hâli]
  const KIDS = [['Ali', "Ali'nin"], ['Ayşe', "Ayşe'nin"], ['Can', "Can'ın"], ['Elif', "Elif'in"], ['Mert', "Mert'in"], ['Zeynep', "Zeynep'in"],
    ['Efe', "Efe'nin"], ['Defne', "Defne'nin"], ['Kerem', "Kerem'in"], ['Ada', "Ada'nın"], ['Deniz', "Deniz'in"], ['Yusuf', "Yusuf'un"],
    ['Ela', "Ela'nın"], ['Emir', "Emir'in"], ['Duru', "Duru'nun"], ['Mina', "Mina'nın"], ['Ömer', "Ömer'in"], ['Selin', "Selin'in"],
    ['Bora', "Bora'nın"], ['Arda', "Arda'nın"], ['Asya', "Asya'nın"], ['Poyraz', "Poyraz'ın"]];
  const NUMW = { 3: 'Üç', 4: 'Dört' };
  // items: [resim, ad, belirtme hâli]
  const THEMES = [
    { items: [['🐱', 'kedi'], ['🐶', 'köpek'], ['🐦', 'kuş'], ['🐟', 'balık'], ['🐰', 'tavşan']], intro: 'arkadaşın her birinin farklı bir hayvanı var', what: 'hayvanı',
      either: (it, a, b) => cap(it[1]) + ', ' + a[1] + ' ya da ' + b[1] + '.' },
    { items: [['🍎', 'elma', 'elmayı'], ['🍌', 'muz', 'muzu'], ['🍓', 'çilek', 'çileği'], ['🍇', 'üzüm', 'üzümü'], ['🍉', 'karpuz', 'karpuzu']], intro: 'arkadaşın her biri farklı bir meyveyi seviyor', what: 'en sevdiği meyve',
      either: (it, a, b) => cap(it[2]) + ' ' + a[0] + ' ya da ' + b[0] + ' seviyor.' },
    { items: [['⚽', 'top'], ['🚲', 'bisiklet'], ['🎸', 'gitar'], ['🎈', 'balon'], ['🚀', 'roket']], intro: 'arkadaşın her birinin farklı bir oyuncağı var', what: 'oyuncağı',
      either: (it, a, b) => cap(it[1]) + ', ' + a[1] + ' ya da ' + b[1] + '.' },
  ];

  function perms(n) {
    const out = [];
    (function go(a, rest) {
      if (!rest.length) { out.push(a); return; }
      rest.forEach((v, i) => go(a.concat([v]), rest.slice(0, i).concat(rest.slice(i + 1))));
    })([], Array.from({ length: n }, (_, i) => i));
    return out;
  }
  /* İpucu türleri: is (çocuğun eşyası bu), not (bu değil), not2 (ikisi de değil), either (eşya bu iki çocuktan birinin) */
  function clueOk(c, p) {
    if (c.t === 'is') return p[c.kid] === c.item;
    if (c.t === 'not') return p[c.kid] !== c.item;
    if (c.t === 'not2') return p[c.kid] !== c.items[0] && p[c.kid] !== c.items[1];
    return p[c.kids[0]] === c.item || p[c.kids[1]] === c.item;
  }
  function solutions(n, clues) { return perms(n).filter((p) => clues.every((c) => clueOk(c, p))); }

  /* Çözümü tek olan, gereksiz ipucu içermeyen bir ipucu kümesi arar. Doğru eşleşme: çocuk i -> eşya i. */
  function searchClues(rng, n, hard) {
    const pool = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        pool.push({ t: 'not', kid: i, item: j });
        if (hard) {
          for (let k = j + 1; k < n; k++) if (k !== i) pool.push({ t: 'not2', kid: i, items: [j, k] });
          pool.push({ t: 'either', item: i, kids: rng.shuffle([i, j]) });
        }
      }
    }
    const order = rng.shuffle(pool);
    let clues = hard ? [] : [{ t: 'is', kid: rng.int(0, n - 1), item: 0 }];
    if (!hard) clues[0].item = clues[0].kid;
    for (const c of order) {
      if (solutions(n, clues).length === 1) break;
      if (solutions(n, clues.concat([c])).length < solutions(n, clues).length) clues.push(c);
    }
    if (solutions(n, clues).length !== 1) return null;
    for (const c of rng.shuffle(clues)) {            // gereksizleri at
      const rest = clues.filter((x) => x !== c);
      if (rest.length && solutions(n, rest).length === 1) clues = rest;
    }
    return clues;
  }

  B.GEN.who = function (rng, level) {
    const n = level === 1 ? 3 : level === 2 ? rng.pick([3, 4]) : 4;
    const th = rng.pick(THEMES), kids = rng.sample(KIDS, n), items = rng.sample(th.items, n);   // çocuk i'nin eşyası items[i]
    let clues;
    if (level === 1) {
      // biri doğrudan söylenir, bir "değil" ipucu kalan ikisini ayırır
      clues = [{ t: 'is', kid: 0, item: 0 }, { t: 'not', kid: 1, item: 2 }];
    } else if (level === 2) {
      clues = n === 3
        ? [{ t: 'not', kid: 0, item: 1 }, { t: 'not', kid: 0, item: 2 }, { t: 'not', kid: 1, item: 2 }]
        : [{ t: 'is', kid: 0, item: 0 }, { t: 'is', kid: 1, item: 1 }, { t: 'not', kid: 2, item: 3 }];
    } else {
      clues = searchClues(rng, n, level === 4);
      if (!clues || clues.length < 3 || clues.length > 5) throw new Error('ipucu kümesi uygun değil');
      if (level === 4 && !clues.some((c) => c.t !== 'not')) throw new Error('ipuçları fazla düz');
    }
    if (solutions(n, clues).length !== 1) throw new Error('ipuçları tek çözüm vermiyor');
    clues = rng.shuffle(clues);
    const given = clues.filter((c) => c.t === 'is').map((c) => c.kid);
    const ask = rng.pick(Array.from({ length: n }, (_, i) => i).filter((i) => given.indexOf(i) < 0));
    const facts = clues.map((c) => {
      if (c.t === 'either') return th.either(items[c.item], kids[c.kids[0]], kids[c.kids[1]]);
      const head = kids[c.kid][1] + ' ' + th.what + ' ';
      if (c.t === 'not2') return head + 'ne ' + items[c.items[0]][1] + ' ne ' + items[c.items[1]][1] + '.';
      return head + items[c.item][1] + (c.t === 'is' ? '.' : ' değil.');
    });
    const names = rng.shuffle(items.map((it) => it[1]));   // sıra ipucu vermesin
    const intro = NUMW[n] + ' ' + th.intro + ': ' + names.slice(0, -1).join(', ') + ' ve ' + names[n - 1] + '.';
    const q = { prompt: kids[ask][1] + ' ' + th.what + ' hangisi?' };
    q.stem = '<div class="story"><p>' + intro + '</p><ul>' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>';
    q.promptBelow = true;       // önce öncüller okunur, soru cümlesi altlarında durur
    q.speech = intro + ' ' + facts.join(' ') + ' ' + q.prompt;
    q.meta = { n: n, clues: clues, ask: ask };
    q.explain = 'İpuçlarını tek tek eleyince: ' + kids.map((k, i) => k[0] + ' → ' + items[i][1]).join(', ') + '.';
    const opt = (it) => ({ html: '<span class="opt-pair"><span class="opt-emoji">' + it[0] + '</span><span class="opt-cap">' + it[1] + '</span></span>', key: 'w' + it[1] });
    return Q.finish(rng, q, opt(items[ask]), rng.shuffle(items.filter((_, i) => i !== ask)).map(opt), n);
  };

  B.ExtraUtil = { solutions: solutions, RULES1: RULES1, RULES2: RULES2 };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
