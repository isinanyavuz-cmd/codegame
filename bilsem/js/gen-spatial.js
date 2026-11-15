/* Uzamsal sorular: döndürme, ayna görüntüsü, küp sayma, üst üste şekiller */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q, G = S.Grid;
  const COL = S.COLOR_IDS, r1 = S.r1;

  const tf = (rot, mirror) => ({ rot: ((rot % 360) + 360) % 360, mirror: !!mirror });
  const objOpt = (o, t) => ({ html: S.objSvg(o, t), key: S.objKey(o, t) });
  const gridOpt = (o, m) => ({ html: S.svg(100, 100, G.draw(m, o.pal, 9, 9, 82), { cls: 'opt-svg' }), key: 'g' + G.key(m) + o.pal.join('') });
  const gridObj = (rng, n) => S.randObj(rng, n === 5 ? { kind: 'grid', n: 5, cells: rng.int(9, 11), accent: 3 }
    : n === 4 ? { kind: 'grid', n: 4, cells: rng.int(6, 8), accent: 2 } : { kind: 'grid', n: 3, cells: rng.int(4, 5), accent: 1 });

  /* Doğru şekle çok benzeyen, tek karesi kaymış çeldiriciler */
  function nearMisses(rng, o, m, count) {
    const out = [];
    for (let i = 0; i < count * 3; i++) out.push(gridOpt(o, G.nudge(rng, m, 2, ['move'])));
    return out;
  }

  /* Dönüş yönünü gösteren yay biçimli ok */
  function turnIcon(turn, cx, cy) {
    const R = 30, end = turn === 90 ? 0 : turn === 270 ? 180 : 90, sweep = turn === 270 ? 0 : 1;
    const p = (deg, rad) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];
    const a = p(-90, R), b = p(end, R), tdeg = end + (sweep ? 90 : -90);
    const tip = [b[0] + 15 * Math.cos(tdeg * Math.PI / 180), b[1] + 15 * Math.sin(tdeg * Math.PI / 180)];
    const b1 = p(end, R - 12), b2 = p(end, R + 12), P = (pt) => r1(pt[0]) + ' ' + r1(pt[1]);
    return '<path d="M' + P(a) + 'A' + R + ' ' + R + ' 0 0 ' + sweep + ' ' + P(b) + '" fill="none" stroke="#f08c00" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M' + P(tip) + 'L' + P(b1) + 'L' + P(b2) + 'Z" fill="#f08c00" stroke="#f08c00" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + S.INK + '"/>';
  }
  /* Ayna (dik kesik çizgi) ve su (dalgalı çizgi) simgeleri */
  function flipIcon(water, cx, cy) {
    if (water) return '<path d="M' + (cx - 34) + ' ' + cy + 'q8.5 -11 17 0t17 0t17 0t17 0" fill="none" stroke="#2f9be1" stroke-width="6" stroke-linecap="round"/>';
    return '<rect x="' + (cx - 6) + '" y="' + (cy - 34) + '" width="12" height="68" rx="6" fill="#bfe3ff"/>' +
      '<path d="M' + cx + ' ' + (cy - 30) + 'v60" stroke="#2f7de1" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round"/>';
  }
  const TURN_LABEL = { 90: 'çeyrek tur sağa', 270: 'çeyrek tur sola', 180: 'yarım tur' };
  const TURN_TEXT = { 90: 'sağa doğru çeyrek tur dönüyor', 270: 'sola doğru çeyrek tur dönüyor', 180: 'yarım tur dönüyor' };
  const soft = { fill: '#5a6b8c', weight: 700 };

  /* ---------- Döndürme ---------- */
  B.GEN.rotate = function (rng, level) {
    const s = 150, o = gridObj(rng, level === 1 ? 3 : level === 3 ? 5 : 4);
    const figure = S.tile(6, 6, s) + S.objDraw(o, tf(0), 20, 20, s - 28);
    const q = {};

    if (level < 4) {
      // sağa ya da sola; bir, iki ya da üç kez çeyrek tur. İki çeyrek tur bazen "yarım tur" diye sorulur.
      const right = rng.chance(0.5), k = rng.pick(level === 1 ? [1, 1, 2] : [1, 2, 2, 3, 3]), half = k === 2 && rng.chance(0.3);
      const turn = (right ? 90 * k : 360 - 90 * k) % 360, yon = right ? 'sağa' : 'sola', KEZ = ['', 'bir', 'iki', 'üç'];
      q.prompt = half ? 'Şekil yarım tur dönerse (baş aşağı) hangisi olur?' : 'Şekil ' + yon + ' doğru ' + KEZ[k] + ' kez çeyrek tur dönerse hangisi olur?';
      const cx = s + 100, label = half ? 'yarım tur' : k === 1 ? 'çeyrek tur ' + yon : yon + ' ' + k + ' kez çeyrek tur';
      const times = (half || k === 1) ? '' : '<circle cx="' + (cx + 50) + '" cy="30" r="17" fill="' + S.INK + '"/>' + S.text(cx + 50, 30, '×' + k, 18, { fill: '#fff' });
      q.stem = S.svg(s + 200, s + 12, figure + turnIcon(half ? 180 : right ? 90 : 270, cx, 66) + times + S.text(cx, 130, label, 17, soft), { maxW: 380 });
      q.explain = k === 1 ? (right ? 'Sağa doğru çeyrek turda üstteki kısım sağa, sağdaki kısım alta geçer.' : 'Sola doğru çeyrek turda üstteki kısım sola, soldaki kısım alta geçer.')
        : k === 2 ? (half ? 'Yarım turda üst ile alt, sağ ile sol yer değiştirir.' : 'İki çeyrek tur bir yarım tur eder: üst ile alt, sağ ile sol yer değiştirir.')
          : right ? 'Sağa üç çeyrek tur, sola bir çeyrek tur ile aynı yere getirir: üstteki kısım sola geçer.'
            : 'Sola üç çeyrek tur, sağa bir çeyrek tur ile aynı yere getirir: üstteki kısım sağa geçer.';
      q.meta = { m: o.m, right: right, k: k, result: G.tf(o.m, tf(turn)) };
      const rots = rng.shuffle([turn + 90, turn + 180, turn + 270].map((r) => objOpt(o, tf(r))));
      const mirs = rng.shuffle([turn + 90, turn + 180, turn + 270].map((r) => objOpt(o, tf(r, true))));
      const wrong = level === 1 ? [rots[0], rots[1], objOpt(o, tf(turn, true)), mirs[0]]
        : level === 2 ? [objOpt(o, tf(turn, true)), mirs[0], rots[0], rots[1]]
          : [objOpt(o, tf(turn, true))].concat(nearMisses(rng, o, G.tf(o.m, tf(turn)), 1).slice(0, 1), [rots[0]], nearMisses(rng, o, G.tf(o.m, tf(turn)), 1), rots);
      return Q.finish(rng, q, objOpt(o, tf(turn)), wrong);
    }

    // iki adım: bir dönüş ve bir yansıma (sırası rastgele)
    const turn = rng.pick([90, 270, 180]), water = rng.chance(0.4), turnFirst = rng.chance(0.5);
    const doTurn = (m) => G.tf(m, tf(turn)), doFlip = (m) => (water ? G.flipV(m) : G.flipH(m));
    const result = turnFirst ? doFlip(doTurn(o.m)) : doTurn(doFlip(o.m));
    const flipText = water ? 'sudaki yansıması alınıyor' : 'aynadaki görüntüsü alınıyor';
    q.prompt = 'Şekil önce ' + (turnFirst ? TURN_TEXT[turn] : flipText) + ', sonra ' + (turnFirst ? flipText : TURN_TEXT[turn]) + '. Sonunda hangisi olur?';
    const icon = (isTurn, cx) => (isTurn ? turnIcon(turn, cx, 62) : flipIcon(water, cx, 62)) +
      S.text(cx, 128, isTurn ? TURN_LABEL[turn] : water ? 'su' : 'ayna', 16, soft);
    const badge = (n, cx) => '<circle cx="' + cx + '" cy="14" r="12" fill="#1d2b4a"/>' + S.text(cx, 14, n, 15, { fill: '#fff' });
    q.stem = S.svg(s + 262, s + 12, figure + badge(1, s + 72) + icon(turnFirst, s + 72) + badge(2, s + 194) + icon(!turnFirst, s + 194), { maxW: 440 });
    q.explain = 'Adım adım düşün: önce ' + (turnFirst ? TURN_TEXT[turn] : flipText) + ', sonra ' + (turnFirst ? flipText : TURN_TEXT[turn]) +
      '. Aynada sağ ile sol, suda üst ile alt yer değiştirir.';
    q.meta = { m: o.m, turn: turn, water: water, turnFirst: turnFirst, result: result };
    const wrong = rng.shuffle([doTurn(o.m), doFlip(o.m), turnFirst ? doTurn(doFlip(o.m)) : doFlip(doTurn(o.m))]).concat(rng.shuffle(S.TFS).map((t) => G.tf(o.m, t)));
    return Q.finish(rng, q, gridOpt(o, result), wrong.map((m) => gridOpt(o, m)));
  };

  /* ---------- Ayna Görüntüsü ---------- */
  B.GEN.mirror = function (rng, level) {
    const o = gridObj(rng, level === 1 ? 3 : level === 2 ? 4 : rng.pick([4, 5, 5]));
    const s = 130, g = 22, q = {};
    const tile = (x, y) => S.tile(x, y, s) + S.objDraw(o, tf(0), x + 12, y + 12, s - 24);
    const mirrorLine = (x, y0, y1) => '<rect x="' + (x - 5) + '" y="' + y0 + '" width="10" height="' + (y1 - y0) + '" rx="5" fill="#bfe3ff"/>' +
      '<path d="M' + x + ' ' + (y0 + 4) + 'V' + (y1 - 4) + '" stroke="#2f7de1" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>';
    const waterLine = (x0, x1, y) => {
      let d = 'M' + x0 + ' ' + y;
      for (let x = x0; x < x1 - 10; x += 20) d += 'q5 -7 10 0t10 0';
      return '<path d="' + d + '" fill="none" stroke="#2f9be1" stroke-width="4" stroke-linecap="round"/>';
    };

    if (level === 4) {
      // önce ayna, sonra su: şekil baş aşağı döner
      const W = s * 2 + g * 2 + 12, mx = 6 + s + g, my = 6 + s + g;
      q.prompt = 'Şekil önce aynada, sonra suda yansıyor. Soru işaretinin yerine hangisi gelir?';
      q.stem = S.svg(W, W, tile(6, 6) + mirrorLine(mx, 2, 6 + s + 4) +
        '<rect x="' + (mx + g) + '" y="6" width="' + s + '" height="' + s + '" rx="22" fill="none" stroke="#c5d3ea" stroke-width="3" stroke-dasharray="9 8"/>' +
        waterLine(mx + g - 10, W - 2, my) + S.qtile(mx + g, my + g, s), { maxW: 300 });
      q.explain = 'Aynada sağ ile sol, suda üst ile alt yer değiştirir. İkisi birlikte şekli baş aşağı çevirir.';
      const ans = G.tf(o.m, tf(180));
      const wrong = nearMisses(rng, o, ans, 1).slice(0, 1).concat(rng.shuffle([G.flipH(o.m), G.flipV(o.m), o.m]).map((m) => gridOpt(o, m)));
      return Q.finish(rng, q, gridOpt(o, ans), wrong);
    }

    const water = rng.chance(0.4);
    q.prompt = water ? 'Şeklin sudaki yansıması hangisi?' : 'Şeklin aynadaki görüntüsü hangisi?';
    if (!water) {
      const W = s * 2 + g * 2 + 12, H = s + 12, mx = 6 + s + g;
      q.stem = S.svg(W, H, tile(6, 6) + mirrorLine(mx, 2, H - 2) + S.qtile(mx + g, 6, s), { maxW: 310 });
    } else {
      const W = s + 12, my = 6 + s + g;
      q.stem = S.svg(W, s * 2 + g * 2 + 12, tile(6, 6) + waterLine(2, W, my) + S.qtile(6, my + g, s), { maxW: 150 });
    }
    q.explain = water ? 'Suda üst ile alt yer değiştirir; sağ ve sol aynı kalır.' : 'Aynada sağ ile sol yer değiştirir; üst ve alt aynı kalır.';
    const ans = water ? G.flipV(o.m) : G.flipH(o.m), other = water ? G.flipH(o.m) : G.flipV(o.m);
    const plain = [other, G.tf(o.m, tf(180)), o.m].map((m) => gridOpt(o, m));
    const wrong = level < 3
      ? rng.shuffle(plain).concat([tf(90), tf(270)].map((t) => objOpt(o, t)))
      : nearMisses(rng, o, ans, 1).slice(0, 1).concat(rng.shuffle(plain));
    return Q.finish(rng, q, gridOpt(o, ans), wrong);
  };

  /* ---------- Küp Sayma ---------- */
  function heights(rng, W, D, maxH, range) {
    for (let t = 0; t < 600; t++) {
      const g = [];
      let sum = 0;
      for (let x = 0; x < W; x++) {
        g.push([]);
        for (let y = 0; y < D; y++) {
          // izleyiciye yaklaştıkça yükseklik artmaz: her sütunun tepesi görünür kalır
          const cap = Math.min(x ? g[x - 1][y] : maxH, y ? g[x][y - 1] : maxH);
          const v = (x === 0 && y === 0) ? rng.int(maxH - 1, maxH) : (rng.chance(0.45) ? cap : rng.int(0, cap));
          g[x].push(v);
          sum += v;
        }
      }
      if (sum >= range[0] && sum <= range[1]) return { h: g, total: sum };
    }
    throw new Error('küp yapısı üretilemedi');
  }
  function layerText(h, maxH) {
    const layers = [];
    for (let k = 1; k <= maxH; k++) {
      let n = 0;
      h.forEach((col) => col.forEach((v) => { if (v >= k) n++; }));
      if (n) layers.push(n);
    }
    return { layers: layers, text: 'Kat kat sayalım: ' + layers.map((n, i) => (i === 0 ? 'en alt katta ' : (i + 1) + '. katta ') + n).join(', ') + ' küp var.' };
  }

  B.GEN.cubes = function (rng, level) {
    const tone = rng.pick(S.CUBE_TONES), q = {};
    if (level === 4 && rng.chance(0.5)) {
      // eksik küpler: 3x3x3'lük büyük küpe tamamlama
      const st = heights(rng, 3, 3, 3, [9, 21]), need = 27 - st.total, c = S.cubes(st.h, 44, tone, [3, 3, 3]);
      q.prompt = 'Bu yapıyı kesik çizgiyle gösterilen büyük küpe tamamlamak için kaç küp daha gerekir?';
      q.stem = S.svg(c.w, c.h, c.inner, { maxW: Math.min(330, c.w * 1.2) });
      q.meta = { heights: st.h, answer: need };
      q.explain = layerText(st.h, 3).text + ' Yapıda toplam ' + st.total + ' küp var. Büyük küpte her katta 9, üç katta 27 küp olur. 27 − ' + st.total + ' = ' + need + ' küp daha gerekir.';
      return Q.finishNum(rng, q, need, { min: 1, prefer: [st.total, need + 9, need - 9] });
    }
    const dims = rng.pick([null, [[3, 2], [2, 3], [3, 3]], [[3, 3]], [[4, 3], [3, 4], [4, 4]], [[4, 4], [4, 4], [5, 4]]][level]);
    const maxH = level < 3 ? 3 : 4, range = [null, [6, 10], [10, 17], [16, 26], [26, 40]][level];
    const st = heights(rng, dims[0], dims[1], maxH, range), c = S.cubes(st.h, level < 3 ? 44 : 36, tone), lt = layerText(st.h, maxH);
    q.prompt = 'Bu yapıda toplam kaç küp var?';
    q.stem = S.svg(c.w, c.h, c.inner, { maxW: Math.min(360, c.w * 1.25) });
    q.meta = { heights: st.h, answer: st.total };
    q.explain = lt.text + ' Toplam ' + st.total + ' küp.';
    return Q.finishNum(rng, q, st.total, { min: 1, prefer: [lt.layers[0], st.total - lt.layers[lt.layers.length - 1]] });
  };

  /* ---------- Üst Üste Çizgiler ---------- */
  const ORD = ['', 'birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', 'altıncı'];
  const LW = 380, LH = 310, LPAD = 20;

  /* n doğru parçası. Çerçevenin kenarında sırayla 2n nokta seçilir ve her nokta tam karşısındakiyle birleştirilir:
     uçları böyle iç içe geçen kirişlerin her ikisi çerçevenin içinde mutlaka kesişir. Sonra uçlar küçük adımlarla
     oynatılarak kesişme noktaları birbirinden ve kenardan uzaklaştırılır, dar açılı kesişmeler açılır;
     böylece her çiftte hangi çizginin üstte olduğu rahat görülür. */
  const LINE_RULES = { 4: [34, 38, 0.3, 500], 5: [27, 36, 0.3, 900], 6: [17, 30, 0.24, 1200] };   // [noktalar arası, kenar payı, en küçük sinüs, adım]
  function edgePoint(u) {
    const w = LW - 2 * LPAD, h = LH - 2 * LPAD;
    let d = (((u % 1) + 1) % 1) * 2 * (w + h);
    if (d < w) return [LPAD + d, LPAD];
    d -= w;
    if (d < h) return [LPAD + w, LPAD + d];
    d -= h;
    if (d < w) return [LPAD + w - d, LPAD + h];
    return [LPAD, LPAD + h - (d - w)];
  }
  /* 1 ve üstü: bütün koşullar sağlanıyor */
  function lineScore(us, n, rule) {
    const e = us.map(edgePoint), pts = [];
    let f = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ax = e[i + n][0] - e[i][0], ay = e[i + n][1] - e[i][1], cx = e[j + n][0] - e[j][0], cy = e[j + n][1] - e[j][1];
        const den = ax * cy - ay * cx, k = ((e[j][0] - e[i][0]) * cy - (e[j][1] - e[i][1]) * cx) / den;
        const x = e[i][0] + k * ax, y = e[i][1] + k * ay;
        f = Math.min(f, Math.abs(den) / (Math.hypot(ax, ay) * Math.hypot(cx, cy)) / rule[2], Math.min(x, y, LW - x, LH - y) / rule[1]);
        for (const p of pts) f = Math.min(f, Math.hypot(p[0] - x, p[1] - y) / rule[0]);
        pts.push([x, y]);
      }
    }
    return f;
  }
  function lineSet(rng, n) {
    const rule = LINE_RULES[n];
    for (let r = 0; r < 12; r++) {
      let us = Array.from({ length: 2 * n }, () => rng.next()).sort((a, c) => a - c), f = lineScore(us, n, rule);
      for (let it = 0; it < rule[3] && f < 1; it++) {
        const k = rng.int(0, 2 * n - 1), v = us[k] + (rng.next() - 0.5) * 0.08;
        const lo = k ? us[k - 1] : us[2 * n - 1] - 1, hi = k < 2 * n - 1 ? us[k + 1] : us[0] + 1;
        if (v <= lo + 0.004 || v >= hi - 0.004) continue;        // kenardaki sıra bozulmaz: kirişler kesişmeyi sürdürür
        const t = us.slice();
        t[k] = v;
        const g = lineScore(t, n, rule);
        if (g > f) { us = t; f = g; }
      }
      if (f >= 1) {
        const e = us.map(edgePoint);
        return rng.shuffle(Array.from({ length: n }, (_, i) => ({ x0: r1(e[i][0]), y0: r1(e[i][1]), x1: r1(e[i + n][0]), y1: r1(e[i + n][1]) })));
      }
    }
    throw new Error('çizgiler yerleşmedi');
  }

  /* Çizginin yolu. Uçlar hep doğrunun uçlarında kalır; böylece eğri çizgiler de birbirini mutlaka keser. */
  function linePath(l) {
    const dx = l.x1 - l.x0, dy = l.y1 - l.y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const at = (t, o) => r1(l.x0 + ux * t + nx * o) + ' ' + r1(l.y0 + uy * t + ny * o);
    if (l.style === 'arc') return 'M' + at(0, 0) + 'Q' + at(L / 2, l.amp * 4.5) + ' ' + at(L, 0);
    if (l.style === 'zigzag') {
      const k = Math.max(3, Math.round(L / 46));
      let d = 'M' + at(0, 0);
      for (let i = 1; i < k; i++) d += 'L' + at(L * i / k, i % 2 ? l.amp : -l.amp);
      return d + 'L' + at(L, 0);
    }
    if (l.style === 'wave') {
      const k = Math.max(2, Math.round(L / 62));
      let d = 'M' + at(0, 0);
      for (let t = 5; t < L; t += 5) d += 'L' + at(t, l.amp * Math.sin(Math.PI * k * t / L));
      return d + 'L' + at(L, 0);
    }
    return 'M' + at(0, 0) + 'L' + at(L, 0);
  }
  function lineDraw(l, w) {
    const d = linePath(l), common = '" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="';
    return '<path d="' + d + common + S.INK + '" stroke-width="' + (w + 5) + '"/><path d="' + d + common + S.COLORS[l.color].fill + '" stroke-width="' + w + '"/>';
  }
  const lineOpt = (l) => ({
    html: '<span class="opt-pair">' + S.svg(100, 50, lineDraw({ x0: 12, y0: 25, x1: 88, y1: 25, color: l.color, style: l.style, amp: l.style === 'arc' ? 3 : 7 }, 12), { cls: 'opt-svg opt-line' }) +
      '<span class="opt-cap">' + S.COLORS[l.color].name + '</span></span>',
    key: 'l' + l.color,
  });

  B.GEN.stack = function (rng, level) {
    const n = [0, 4, 5, 5, 6][level];
    const styles = level < 3 ? ['straight'] : level === 3 ? [rng.pick(['wave', 'zigzag', 'arc'])] : ['straight', 'wave', 'zigzag', 'arc'];
    const cols = rng.sample(COL, n);
    // çizim sırası = alttan üste; yerleşimle ilgisi yok
    const lines = lineSet(rng, n).map((l, i) => Object.assign(l, { color: cols[i], style: rng.pick(styles), amp: (rng.chance(0.5) ? 1 : -1) * rng.int(8, 11) }));
    const w = n > 5 ? 11 : 13;
    const q = { stem: S.svg(LW, LH, lines.map((l) => lineDraw(l, w)).join(''), { maxW: LW }) };
    const names = lines.map((l) => S.COLORS[l.color].name), cap = B.GenUtil.cap;
    q.explain = 'Kesiştikleri yerde kesintisiz görünen çizgi üsttedir. Alttan üste doğru sıra: ' + names.join(', ') + '.';
    q.meta = { n: n, lines: lines.map((l) => ({ x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, color: l.color, style: l.style })), order: lines.map((l) => l.color) };
    const others = (skip) => rng.shuffle(lines.filter((_, i) => skip.indexOf(i) < 0)).map(lineOpt);

    if (level === 4) {
      const ask = rng.pick(['above', 'below', 'countAbove', 'countBelow']);
      q.meta.ask = ask;
      if (ask === 'above' || ask === 'below') {
        const r = ask === 'above' ? rng.int(0, n - 2) : rng.int(1, n - 1), a = ask === 'above' ? r + 1 : r - 1;
        q.prompt = cap(names[r]) + ' çizginin ' + (ask === 'above' ? 'hemen üstündeki' : 'hemen altındaki') + ' çizgi hangisi?';
        q.meta.ref = r; q.meta.answer = lines[a].color;
        return Q.finish(rng, q, lineOpt(lines[a]), others([a, r]));
      }
      const r = rng.int(0, n - 1), ans = ask === 'countAbove' ? n - 1 - r : r;
      q.prompt = cap(names[r]) + ' çizginin ' + (ask === 'countAbove' ? 'üstünden' : 'altından') + ' kaç çizgi geçiyor?';
      q.meta.ref = r; q.meta.answer = ans;
      return Q.finishNum(rng, q, ans, { min: 0, max: n - 1 });
    }

    const idx = level === 1 ? rng.pick([0, n - 1]) : level === 2 ? rng.pick([0, n - 1, 1, n - 2]) : rng.int(0, n - 1);
    q.prompt = idx === 0 ? 'En alttaki çizgi hangisi?' : idx === n - 1 ? 'En üstteki çizgi hangisi?'
      : idx < n / 2 ? 'Alttan ' + ORD[idx + 1] + ' çizgi hangisi?' : 'Üstten ' + ORD[n - idx] + ' çizgi hangisi?';
    q.meta.ask = 'rank'; q.meta.answer = lines[idx].color;
    return Q.finish(rng, q, lineOpt(lines[idx]), others([idx]));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
