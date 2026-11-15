/* Zekâ Kâşifi — uzamsal sorular: döndürme, ayna görüntüsü, küp sayma, üst üste şekiller */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;
  const COL = S.COLOR_IDS, r1 = S.r1;

  const objOpt = (o, tf) => ({ html: S.objSvg(o, tf), key: S.objKey(o, tf) });
  const tf = (rot, mirror) => ({ rot: ((rot % 360) + 360) % 360, mirror: !!mirror });

  function pickObj(rng, level) {
    if (level === 1) return S.randObj(rng, rng.pick([{ kind: 'glyph' }, { kind: 'shape' }, { kind: 'grid', n: 3, cells: 4, accent: 0 }]));
    if (level === 2) return S.randObj(rng, { kind: 'grid', n: 3, cells: rng.int(4, 5), accent: 1 });
    return S.randObj(rng, { kind: 'grid', n: 4, cells: rng.int(6, 8), accent: 2 });
  }

  /* Dönüş yönünü gösteren yay biçimli ok */
  function turnIcon(turn, cx, cy) {
    const R = 30, end = turn === 90 ? 0 : turn === 270 ? 180 : 90, sweep = turn === 270 ? 0 : 1;
    const p = (deg, rad) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];
    const a = p(-90, R), b = p(end, R), tdeg = end + (sweep ? 90 : -90);
    const tip = [b[0] + 15 * Math.cos(tdeg * Math.PI / 180), b[1] + 15 * Math.sin(tdeg * Math.PI / 180)];
    const b1 = p(end, R - 12), b2 = p(end, R + 12);
    const P = (pt) => r1(pt[0]) + ' ' + r1(pt[1]);
    return '<path d="M' + P(a) + 'A' + R + ' ' + R + ' 0 0 ' + sweep + ' ' + P(b) + '" fill="none" stroke="#f08c00" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M' + P(tip) + 'L' + P(b1) + 'L' + P(b2) + 'Z" fill="#f08c00" stroke="#f08c00" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + S.INK + '"/>';
  }

  /* ---------- Döndürme ---------- */
  B.GEN.rotate = function (rng, level) {
    const o = pickObj(rng, level);
    const turn = level === 1 ? 90 : rng.pick([90, 270, 180]);
    const q = {
      prompt: turn === 90 ? 'Şekil sağa doğru çeyrek tur dönerse hangisi olur?'
        : turn === 270 ? 'Şekil sola doğru çeyrek tur dönerse hangisi olur?'
          : 'Şekil yarım tur dönerse (baş aşağı) hangisi olur?',
    };
    const label = turn === 90 ? 'çeyrek tur sağa' : turn === 270 ? 'çeyrek tur sola' : 'yarım tur';
    const s = 150;
    q.stem = S.svg(s + 150, s + 12,
      S.tile(6, 6, s) + S.objDraw(o, tf(0), 6 + 14, 6 + 14, s - 28) + turnIcon(turn, s + 78, 66) +
      S.text(s + 78, 130, label, 17, { fill: '#5a6b8c', weight: 700 }), { maxW: 330 });

    const rots = rng.shuffle([turn + 90, turn + 180, turn + 270].map((r) => tf(r)));
    const mirs = [tf(turn, true)].concat(rng.shuffle([tf(turn + 90, true), tf(turn + 180, true), tf(turn + 270, true)]));
    const wrong = level === 3 ? [mirs[0], mirs[1], rots[0], rots[1]] : [rots[0], rots[1], mirs[0], mirs[1]];
    q.explain = turn === 90 ? 'Sağa doğru çeyrek turda üstteki kısım sağa, sağdaki kısım alta geçer.'
      : turn === 270 ? 'Sola doğru çeyrek turda üstteki kısım sola, soldaki kısım alta geçer.'
        : 'Yarım turda üst ile alt, sağ ile sol yer değiştirir.';
    return Q.finish(rng, q, objOpt(o, tf(turn)), wrong.map((t) => objOpt(o, t)));
  };

  /* ---------- Ayna Görüntüsü ---------- */
  B.GEN.mirror = function (rng, level) {
    const o = pickObj(rng, level);
    const water = level > 1 && rng.chance(0.4);
    const q = { prompt: water ? 'Şeklin sudaki yansıması hangisi?' : 'Şeklin aynadaki görüntüsü hangisi?' };
    const s = 130, g = 22;
    let inner, W, H;
    if (!water) {
      W = s * 2 + g * 2 + 12; H = s + 12;
      const mx = 6 + s + g;
      inner = S.tile(6, 6, s) + S.objDraw(o, tf(0), 6 + 12, 6 + 12, s - 24) +
        '<rect x="' + (mx - 5) + '" y="2" width="10" height="' + (H - 4) + '" rx="5" fill="#bfe3ff"/>' +
        '<path d="M' + mx + ' 6V' + (H - 6) + '" stroke="#2f7de1" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>' +
        S.qtile(mx + g, 6, s);
    } else {
      W = s + 12; H = s * 2 + g * 2 + 12;
      const my = 6 + s + g;
      let wave = 'M2 ' + my;
      for (let x = 2; x < W - 2; x += 20) wave += 'q5 -7 10 0t10 0';
      inner = S.tile(6, 6, s) + S.objDraw(o, tf(0), 6 + 12, 6 + 12, s - 24) +
        '<path d="' + wave + '" fill="none" stroke="#2f9be1" stroke-width="4" stroke-linecap="round"/>' +
        S.qtile(6, my + g, s);
    }
    q.stem = S.svg(W, H, inner, { maxW: water ? 150 : 310 });

    const correct = water ? tf(180, true) : tf(0, true);
    const other = water ? tf(0, true) : tf(180, true);
    const wrong = rng.shuffle([tf(0), other, tf(180)]).concat(rng.shuffle([tf(90), tf(270), tf(90, true)]));
    q.explain = water
      ? 'Suda üst ile alt yer değiştirir; sağ ve sol aynı kalır.'
      : 'Aynada sağ ile sol yer değiştirir; üst ve alt aynı kalır.';
    return Q.finish(rng, q, objOpt(o, correct), wrong.map((t) => objOpt(o, t)));
  };

  /* ---------- Küp Sayma ---------- */
  B.GEN.cubes = function (rng, level) {
    const q = { prompt: 'Bu yapıda toplam kaç küp var?' };
    const dims = level === 1 ? rng.pick([[2, 2], [3, 1], [1, 3], [2, 2]]) : level === 2 ? rng.pick([[3, 2], [2, 3], [3, 3]]) : [3, 3];
    const maxH = level === 1 ? 2 : 3;
    const range = level === 1 ? [3, 6] : level === 2 ? [6, 10] : [10, 17];
    let h = null, total = 0;
    for (let t = 0; t < 400 && !h; t++) {
      const g = [];
      let sum = 0;
      for (let x = 0; x < dims[0]; x++) {
        g.push([]);
        for (let y = 0; y < dims[1]; y++) {
          // izleyiciye yaklaştıkça yükseklik artmaz: her sütunun tepesi görünür kalır
          const cap = Math.min(x ? g[x - 1][y] : maxH, y ? g[x][y - 1] : maxH);
          const v = (x === 0 && y === 0) ? rng.int(Math.max(1, maxH - 1), maxH) : (rng.chance(0.45) ? cap : rng.int(0, cap));
          g[x].push(v);
          sum += v;
        }
      }
      if (sum >= range[0] && sum <= range[1]) { h = g; total = sum; }
    }
    if (!h) throw new Error('küp yapısı üretilemedi');

    const c = S.cubes(h, 44, rng.pick(S.CUBE_TONES));
    q.stem = S.svg(c.w, c.h, c.inner, { maxW: Math.min(340, c.w * 1.25) });
    q.meta = { heights: h };

    const layers = [];
    for (let k = 1; k <= maxH; k++) {
      let n = 0;
      h.forEach((col) => col.forEach((v) => { if (v >= k) n++; }));
      if (n) layers.push(n);
    }
    q.explain = layers.length > 1
      ? 'Kat kat sayalım: ' + layers.map((n, i) => (i === 0 ? 'en alt katta ' : (i + 1) + '. katta ') + n).join(', ') + ' küp var. Toplam ' + total + ' küp.'
      : 'Bütün küpler tek katta duruyor. Toplam ' + total + ' küp.';
    return Q.finishNum(rng, q, total, { min: 1, prefer: layers.length > 1 ? [layers[0]] : [] });
  };

  /* ---------- Üst Üste Şekiller ---------- */
  B.GEN.stack = function (rng, level) {
    const n = level === 3 ? 5 : level === 2 ? 4 : rng.pick([3, 4]);
    const shapes = rng.sample(['circle', 'square', 'triangle', 'hexagon', 'pentagon', 'heart'], n);
    const cols = rng.sample(COL, n);
    const figs = shapes.map((s, i) => ({ shape: s, color: cols[i] }));   // 0 en altta

    // zincir: her şekil bir öncekinin üstüne biner, daha eskilere fazla yaklaşmaz
    const pts = [[0, 0]];
    for (let i = 1; i < n; i++) {
      let placed = false;
      for (let t = 0; t < 80 && !placed; t++) {
        const ang = rng.next() * Math.PI * 2;
        const p = [pts[i - 1][0] + 34 * Math.cos(ang), pts[i - 1][1] + 34 * Math.sin(ang)];
        let ok = true;
        for (let j = 0; j < i - 1; j++) if (Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]) < 46) ok = false;
        if (ok) { pts.push(p); placed = true; }
      }
      if (!placed) throw new Error('üst üste dizilemedi');
    }
    const minX = Math.min.apply(null, pts.map((p) => p[0])) - 50, maxX = Math.max.apply(null, pts.map((p) => p[0])) + 50;
    const minY = Math.min.apply(null, pts.map((p) => p[1])) - 50, maxY = Math.max.apply(null, pts.map((p) => p[1])) + 50;
    const inner = figs.map((f, i) => S.figAt(f, pts[i][0] - 50 - minX, pts[i][1] - 50 - minY, 100)).join('');
    const W = maxX - minX, H = maxY - minY;

    const asks = n === 3 ? [0, n - 1] : level === 1 ? [0, n - 1] : level === 2 ? [0, n - 1, 1, n - 2] : [1, n - 2, 2, 1, n - 2];
    const idx = rng.pick(asks);
    const q = {
      prompt: idx === 0 ? 'En altta hangi şekil var?'
        : idx === n - 1 ? 'En üstte hangi şekil var?'
          : idx === 1 ? 'Alttan ikinci şekil hangisi?'
            : idx === n - 2 ? 'Üstten ikinci şekil hangisi?'
              : 'Tam ortadaki (alttan üçüncü) şekil hangisi?',
    };
    q.stem = S.svg(W, H, inner, { maxW: Math.min(330, W * 1.5) });
    q.explain = 'Alttan üste doğru sıra: ' + figs.map((f) => S.name(f)).join(', ') + '.';
    const opt = (f) => ({ html: S.figSvg(f), key: S.key(f) });
    const others = rng.shuffle(figs.filter((_, i) => i !== idx));
    return Q.finish(rng, q, opt(figs[idx]), others.map(opt), Math.min(4, n));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
