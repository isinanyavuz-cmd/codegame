/* Zekâ Kâşifi — şekil çizimleri. Her şey SVG metni üretir; DOM gerekmez. */
(function (root) {
  'use strict';
  const Bilsem = root.Bilsem = root.Bilsem || {};
  const INK = '#1d2b4a';
  const r1 = (v) => Math.round(v * 10) / 10;

  const COLORS = {
    red: { name: 'kırmızı', fill: '#f2545b' },
    blue: { name: 'mavi', fill: '#3d8ef7' },
    yellow: { name: 'sarı', fill: '#ffd233' },
    green: { name: 'yeşil', fill: '#35c26b' },
    purple: { name: 'mor', fill: '#a565f2' },
    orange: { name: 'turuncu', fill: '#ff9838' },
  };
  const COLOR_IDS = Object.keys(COLORS);

  function polyPts(n, R, rot) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ((rot || 0) + (i * 360) / n - 90) * Math.PI / 180;
      pts.push(r1(R * Math.cos(a)) + ',' + r1(R * Math.sin(a)));
    }
    return pts.join(' ');
  }
  function starPts(R, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * 36 - 90) * Math.PI / 180, rad = i % 2 ? r : R;
      pts.push(r1(rad * Math.cos(a)) + ',' + r1(rad * Math.sin(a)));
    }
    return pts.join(' ');
  }

  /* sym: şekil kaç derecede bir kendisiyle aynı görünür (90'ın katlarıyla döndürmede). */
  const SHAPES = {
    circle: { name: 'daire', sym: 90, d: '<circle r="36"/>' },
    square: { name: 'kare', sym: 90, d: '<rect x="-32" y="-32" width="64" height="64" rx="5"/>' },
    triangle: { name: 'üçgen', sym: 360, d: '<path d="M0 -38L35 24L-35 24Z"/>' },
    diamond: { name: 'baklava', sym: 180, d: '<path d="M0 -40L27 0L0 40L-27 0Z"/>' },
    pentagon: { name: 'beşgen', sym: 360, d: '<polygon points="' + polyPts(5, 38) + '"/>' },
    hexagon: { name: 'altıgen', sym: 180, d: '<polygon points="' + polyPts(6, 38) + '"/>' },
    star: { name: 'yıldız', sym: 360, d: '<polygon points="' + starPts(40, 17) + '"/>' },
    heart: { name: 'kalp', sym: 360, d: '<path d="M0 33C-14 21-38 7-38-12C-38-26-27-34-16-34C-8-34-2-29 0-23C2-29 8-34 16-34C27-34 38-26 38-12C38 7 14 21 0 33Z"/>' },
    plus: { name: 'artı', sym: 90, d: '<path d="M-12 -36H12V-12H36V12H12V36H-12V12H-36V-12H-12Z"/>' },
    arrow: { name: 'ok', sym: 360, d: '<path d="M0 -40L32 -4H14V38H-14V-4H-32Z"/>' },
    moon: { name: 'ay', sym: 360, d: '<path d="M18 -36A36 36 0 0 0 18 36A44 44 0 0 1 18 -36Z"/>' },
    drop: { name: 'damla', sym: 360, d: '<path d="M0 -40C8 -24 26 -6 26 12A26 26 0 0 1 -26 12C-26 -6 -8 -24 0 -40Z"/>' },
    semi: { name: 'yarım daire', sym: 360, d: '<path d="M-36 18A36 36 0 0 1 36 18Z"/>' },
    pac: { name: 'dilimli daire', sym: 360, d: '<path d="M0 0L31 -18A36 36 0 1 0 31 18Z"/>' },
    flag: { name: 'bayrak', sym: 360, chiral: true, d: '<path d="M-22 -40H-13V-36L26 -20L-13 -4V40H-22Z"/>' },
    ell: { name: 'L şekli', sym: 360, chiral: true, d: '<path d="M-28 -38H-4V14H30V38H-28Z"/>' },
  };

  const SIZE_NAMES = { 1: 'büyük', 0.72: 'orta boy', 0.46: 'küçük' };
  const FILL_NAMES = { solid: 'içi dolu', empty: 'içi boş', stripe: 'çizgili' };

  /* Tek bir şekil; merkez (0,0), yaklaşık 40 birim yarıçap. */
  function one(f) {
    const sh = SHAPES[f.shape], col = f.color === 'ink' ? { fill: INK } : COLORS[f.color];
    const size = f.size || 1;
    let body;
    if (f.fill === 'empty') {
      // içi boş: koyu çizgiyle çevrili renkli halka; sarı gibi açık renkler de seçilir
      body = '<g fill="#fff" stroke="' + INK + '" stroke-width="13">' + sh.d + '</g><g fill="none" stroke="' + col.fill + '" stroke-width="7">' + sh.d + '</g>';
    } else if (f.fill === 'stripe') {
      body = '<g fill="url(#bz-st-' + f.color + ')" stroke="' + INK + '" stroke-width="4">' + sh.d + '</g>';
    } else {
      body = '<g fill="' + col.fill + '" stroke="' + INK + '" stroke-width="4">' + sh.d + '</g>';
    }
    const t = [];
    if (f.rot) t.push('rotate(' + f.rot + ')');
    if (f.mirror || size !== 1) t.push('scale(' + (f.mirror ? -size : size) + ' ' + size + ')');
    let inner = '';
    if (f.inner) {
      inner = '<g transform="scale(0.36)" fill="' + COLORS[f.inner.color].fill + '" stroke="' + INK + '" stroke-width="9">' + SHAPES[f.inner.shape].d + '</g>';
    }
    return '<g' + (t.length ? ' transform="' + t.join(' ') + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round">' + body + inner + '</g>';
  }

  const COUNT_LAYOUT = {
    1: { s: 1, pos: [[0, 0]] },
    2: { s: 0.5, pos: [[-23, 0], [23, 0]] },
    3: { s: 0.46, pos: [[0, -21], [-23, 19], [23, 19]] },
    4: { s: 0.46, pos: [[-22, -22], [22, -22], [-22, 22], [22, 22]] },
  };

  /* 100x100 kutunun içeriği */
  function fig(f) {
    const L = COUNT_LAYOUT[f.count || 1];
    if (L.pos.length === 1) return '<g transform="translate(50 50)">' + one(f) + '</g>';
    return L.pos.map((p) => '<g transform="translate(' + (50 + p[0]) + ' ' + (50 + p[1]) + ') scale(' + L.s + ')">' + one(f) + '</g>').join('');
  }
  function figAt(f, x, y, s) {
    return '<g transform="translate(' + r1(x) + ' ' + r1(y) + ') scale(' + r1(s) / 100 + ')">' + fig(f) + '</g>';
  }

  /* İki şekil aynı görünüyorsa anahtarları da aynıdır. */
  function key(f) {
    const sym = SHAPES[f.shape].sym;
    const rot = (((f.rot || 0) % sym) + sym) % sym;
    return [f.shape, f.color, f.fill || 'solid', f.size || 1, rot, f.mirror ? 1 : 0, f.count || 1,
      f.inner ? f.inner.shape + '.' + f.inner.color : '-'].join('|');
  }

  function name(f) {
    const parts = [];
    if ((f.count || 1) > 1) parts.push(f.count);
    if (f.size && f.size !== 1) parts.push(SIZE_NAMES[f.size]);
    if (f.fill && f.fill !== 'solid') parts.push(FILL_NAMES[f.fill]);
    parts.push(COLORS[f.color].name, SHAPES[f.shape].name);
    return parts.join(' ');
  }

  function svg(w, h, inner, o) {
    o = o || {};
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + r1(w) + ' ' + r1(h) + '" class="' + (o.cls || 'q-svg') + '"' +
      (o.cls ? '' : ' style="max-width:' + Math.round(o.maxW || w) + 'px"') + ' aria-hidden="true">' + inner + '</svg>';
  }
  function figSvg(f) { return svg(100, 100, fig(f), { cls: 'opt-svg' }); }

  function text(x, y, str, size, o) {
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" dy="0.35em" text-anchor="middle" font-size="' + r1(size) + '" font-weight="' + (o.weight || 800) +
      '" fill="' + (o.fill || INK) + '">' + str + '</text>';
  }
  function emoji(x, y, ch, size) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" dy="0.36em" text-anchor="middle" font-size="' + r1(size) + '">' + ch + '</text>';
  }

  function tile(x, y, s, o) {
    o = o || {};
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(o.w || s) + '" height="' + r1(s) + '" rx="' + r1(s * 0.17) + '" fill="' + (o.fill || '#fff') +
      '" stroke="' + (o.stroke || '#c5d3ea') + '" stroke-width="3"/>';
  }
  function qtile(x, y, s, o) {
    o = o || {};
    const w = o.w || s;
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(s) + '" rx="' + r1(s * 0.17) +
      '" fill="#fff4cc" stroke="#f0a000" stroke-width="4" stroke-dasharray="11 8"/>' + text(x + w / 2, y + s / 2, '?', s * 0.6, { fill: '#e08600' });
  }

  /* Kareli şekiller: 0 boş, 1..n renk numarası */
  const Grid = {
    rot(m) { const n = m.length; return m.map((_, r) => m.map((__, c) => m[n - 1 - c][r])); },
    flipH(m) { return m.map((row) => row.slice().reverse()); },
    key(m) { return m.map((r) => r.join('')).join('/'); },
    tf(m, t) {
      let x = t.mirror ? Grid.flipH(m) : m;
      for (let i = 0; i < ((t.rot || 0) / 90) % 4; i++) x = Grid.rot(x);
      return x;
    },
    draw(m, pal, x, y, size) {
      const n = m.length, c = size / n;
      let o = '<g transform="translate(' + r1(x) + ' ' + r1(y) + ')"><rect width="' + size + '" height="' + size + '" rx="5" fill="#fff"/>';
      for (let r = 0; r < n; r++) {
        for (let k = 0; k < n; k++) {
          if (m[r][k]) o += '<rect x="' + r1(k * c) + '" y="' + r1(r * c) + '" width="' + r1(c) + '" height="' + r1(c) + '" fill="' + COLORS[pal[m[r][k] - 1]].fill + '"/>';
        }
      }
      let lines = '';
      for (let i = 1; i < n; i++) lines += 'M' + r1(i * c) + ' 0V' + size + 'M0 ' + r1(i * c) + 'H' + size;
      o += '<path d="' + lines + '" stroke="' + INK + '" stroke-opacity="0.35" stroke-width="' + r1(Math.max(1.5, size / 70)) + '" fill="none"/>';
      o += '<rect width="' + size + '" height="' + size + '" rx="5" fill="none" stroke="' + INK + '" stroke-width="' + r1(Math.max(3, size / 34)) + '"/></g>';
      return o;
    },
  };

  /* Döndürülüp ayna görüntüsü alınabilen nesneler: kareli şekil, harf/rakam, bayrak ve L şekli. */
  const TFS = [];
  [0, 90, 180, 270].forEach((rot) => { TFS.push({ rot: rot, mirror: false }); TFS.push({ rot: rot, mirror: true }); });
  const GLYPHS = ['F', 'R', 'P', 'G', 'J', 'L', '2', '4', '5', '7'];

  function blob(rng, n, k) {
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    const filled = [[rng.int(0, n - 1), rng.int(0, n - 1)]];
    m[filled[0][0]][filled[0][1]] = 1;
    let guard = 0;
    while (filled.length < k && guard++ < 600) {
      const b = rng.pick(filled), d = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const r = b[0] + d[0], c = b[1] + d[1];
      if (r < 0 || c < 0 || r >= n || c >= n || m[r][c]) continue;
      m[r][c] = 1;
      filled.push([r, c]);
    }
    return { m: m, filled: filled };
  }

  /* spec: { kind: 'glyph' | 'shape' | 'grid', n, cells, accent } */
  function randObj(rng, spec) {
    if (spec.kind === 'glyph') return { kind: 'glyph', ch: rng.pick(GLYPHS), color: rng.pick(COLOR_IDS) };
    if (spec.kind === 'shape') return { kind: 'shape', shape: rng.pick(['flag', 'ell']), color: rng.pick(COLOR_IDS) };
    for (let t = 0; t < 300; t++) {
      const b = blob(rng, spec.n, spec.cells);
      if (b.filled.length < spec.cells) continue;
      rng.sample(b.filled, spec.accent || 0).forEach((p) => { b.m[p[0]][p[1]] = 2; });
      const o = { kind: 'grid', m: b.m, pal: rng.sample(COLOR_IDS, 2) };
      if (new Set(TFS.map((tf) => objKey(o, tf))).size === 8) return o;
    }
    throw new Error('kareli şekil üretilemedi');
  }
  function objKey(o, tf) {
    if (o.kind === 'grid') return 'g' + Grid.key(Grid.tf(o.m, tf)) + o.pal.join('');
    return o.kind[0] + (o.ch || o.shape) + o.color + '|' + tf.rot + (tf.mirror ? 'm' : '');
  }
  function objDraw(o, tf, x, y, s) {
    if (o.kind === 'grid') return Grid.draw(Grid.tf(o.m, tf), o.pal, x, y, s);
    if (o.kind === 'shape') return figAt({ shape: o.shape, color: o.color, rot: tf.rot, mirror: tf.mirror }, x, y, s);
    return '<g transform="translate(' + r1(x + s / 2) + ' ' + r1(y + s / 2) + ') rotate(' + tf.rot + ')' + (tf.mirror ? ' scale(-1 1)' : '') + '">' +
      '<text dy="0.35em" text-anchor="middle" font-size="' + r1(s * 0.86) + '" font-weight="800" fill="' + COLORS[o.color].fill +
      '" stroke="' + INK + '" stroke-width="' + r1(s * 0.035) + '" stroke-linejoin="round" paint-order="stroke">' + o.ch + '</text></g>';
  }
  function objSvg(o, tf) { return svg(100, 100, objDraw(o, tf, 9, 9, 82), { cls: 'opt-svg' }); }

  /* Küp yapısı: h[x][y] yükseklik. Dönen: { inner, w, h } */
  const CUBE_TONES = [
    { t: '#ffe684', l: '#ffc93c', r: '#e59d00' },
    { t: '#b3d6ff', l: '#62a6fa', r: '#2f7de1' },
    { t: '#b5efc9', l: '#5fd08a', r: '#2ea45c' },
    { t: '#ffc9cd', l: '#f7848b', r: '#d9434d' },
  ];
  function cubes(h, s, tone) {
    const a = s * 0.866, b = s * 0.5, items = [];
    for (let x = 0; x < h.length; x++) for (let y = 0; y < h[x].length; y++) for (let z = 0; z < h[x][y]; z++) items.push([x, y, z]);
    items.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]) || p[2] - q[2]);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, out = '';
    const P = (pts) => pts.map((p) => r1(p[0]) + ',' + r1(p[1])).join(' ');
    for (const it of items) {
      const ox = (it[0] - it[1]) * a, oy = (it[0] + it[1]) * b - (it[2] + 1) * s;
      minX = Math.min(minX, ox - a); maxX = Math.max(maxX, ox + a);
      minY = Math.min(minY, oy); maxY = Math.max(maxY, oy + 2 * b + s);
      out += '<polygon points="' + P([[ox, oy], [ox + a, oy + b], [ox, oy + 2 * b], [ox - a, oy + b]]) + '" fill="' + tone.t + '"/>' +
        '<polygon points="' + P([[ox - a, oy + b], [ox, oy + 2 * b], [ox, oy + 2 * b + s], [ox - a, oy + b + s]]) + '" fill="' + tone.l + '"/>' +
        '<polygon points="' + P([[ox, oy + 2 * b], [ox + a, oy + b], [ox + a, oy + b + s], [ox, oy + 2 * b + s]]) + '" fill="' + tone.r + '"/>';
    }
    const pad = 8;
    return {
      inner: '<g transform="translate(' + r1(pad - minX) + ' ' + r1(pad - minY) + ')" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round">' + out + '</g>',
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }

  /* Çizgili dolgu desenleri; sayfada bir kez bulunmalı. */
  function defs() {
    return '<svg class="bz-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' + COLOR_IDS.map((id) =>
      '<pattern id="bz-st-' + id + '" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="' + COLORS[id].fill + '"/></pattern>').join('') + '</defs></svg>';
  }

  Bilsem.Shapes = {
    INK, COLORS, COLOR_IDS, SHAPES, SIZE_NAMES, FILL_NAMES, CUBE_TONES, TFS, GLYPHS,
    fig, figAt, figSvg, key, name, svg, text, emoji, tile, qtile, Grid, randObj, objKey, objDraw, objSvg, cubes, defs, r1,
  };

  if (typeof module !== 'undefined') module.exports = Bilsem;
})(typeof window !== 'undefined' ? window : globalThis);
