/* Zekâ Kâşifi — mantık yürütme: sıralama, ok yolu */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q;

  /* ---------- Sıralama ---------- */
  // [ad, ayrılma hâli] — ek, ünlü ve ünsüz uyumuna göre elle yazıldı
  const NAMES = [['Ali', "Ali'den"], ['Ayşe', "Ayşe'den"], ['Can', "Can'dan"], ['Elif', "Elif'ten"], ['Mert', "Mert'ten"], ['Zeynep', "Zeynep'ten"],
    ['Efe', "Efe'den"], ['Defne', "Defne'den"], ['Kerem', "Kerem'den"], ['Ada', "Ada'dan"], ['Deniz', "Deniz'den"], ['Yusuf', "Yusuf'tan"],
    ['Ela', "Ela'dan"], ['Emir', "Emir'den"], ['Duru', "Duru'dan"], ['Mina', "Mina'dan"], ['Ömer', "Ömer'den"], ['Selin', "Selin'den"],
    ['Bora', "Bora'dan"], ['Arda', "Arda'dan"], ['Asya', "Asya'dan"], ['Poyraz', "Poyraz'dan"]];
  const ATTRS = [
    { intro: 'Çocukların boyları birbirinden farklı.', more: 'uzun', less: 'kısa', most: 'En uzun kim?', least: 'En kısa kim?', from: 'en uzundan', to: 'en kısaya' },
    { intro: 'Çocuklar koşu yarışı yaptı.', more: 'hızlı', less: 'yavaş', most: 'En hızlı kim?', least: 'En yavaş kim?', from: 'en hızlıdan', to: 'en yavaşa' },
    { intro: 'Çocukların yaşları birbirinden farklı.', more: 'büyük', less: 'küçük', most: 'Yaşı en büyük olan kim?', least: 'Yaşı en küçük olan kim?', from: 'en büyükten', to: 'en küçüğe' },
    { intro: 'Çocuklar sırayla tartıldı.', more: 'ağır', less: 'hafif', most: 'En ağır kim?', least: 'En hafif kim?', from: 'en ağırdan', to: 'en hafife' },
  ];

  B.GEN.order = function (rng, level) {
    const n = level === 1 ? 3 : level === 2 ? 4 : rng.pick([4, 5]);
    const kids = rng.sample(NAMES, n);            // 0 en çok (en uzun, en hızlı…), sonuncu en az
    const at = rng.pick(ATTRS);
    let facts = [];
    for (let i = 0; i < n - 1; i++) {
      const inverse = level > 1 && rng.chance(0.5);
      facts.push(inverse
        ? kids[i + 1][0] + ', ' + kids[i][1] + ' ' + at.less + '.'
        : kids[i][0] + ', ' + kids[i + 1][1] + ' ' + at.more + '.');
    }
    if (level > 1) facts = rng.shuffle(facts);

    let idx, prompt;
    const ask = level === 3 ? rng.pick(['rank', 'rank', 'end']) : 'end';
    if (ask === 'end') {
      const most = rng.chance(0.5);
      idx = most ? 0 : n - 1;
      prompt = most ? at.most : at.least;
    } else {
      idx = rng.int(1, n - 2);
      prompt = 'Çocuklar ' + at.from + ' ' + at.to + ' doğru sıralanırsa ' + (idx + 1) + '. sırada kim olur?';
    }
    const q = { prompt: prompt };
    q.stem = '<div class="story"><p>' + at.intro + '</p><ul>' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>';
    q.speech = at.intro + ' ' + facts.join(' ') + ' ' + prompt;
    q.explain = at.from.charAt(0).toUpperCase() + at.from.slice(1) + ' ' + at.to + ' sıralama: ' + kids.map((k) => k[0]).join(', ') + '.';
    q.meta = { order: kids.map((k) => k[0]), idx: idx, facts: facts };
    const others = rng.shuffle(kids.filter((_, i) => i !== idx));
    return Q.finish(rng, q, Q.text(kids[idx][0]), others.map((k) => Q.text(k[0])), Math.min(4, n));
  };

  /* ---------- Ok Yolu ---------- */
  const ITEMS = [['🥕', 'havuca'], ['🍎', 'elmaya'], ['🧀', 'peynire'], ['🍌', 'muza'], ['🍓', 'çileğe'], ['🌽', 'mısıra'], ['🍇', 'üzüme'], ['🍉', 'karpuza']];
  const HEROES = [['🐰', 'Tavşan'], ['🐭', 'Fare'], ['🐵', 'Maymun'], ['🐻', 'Ayı'], ['🐢', 'Kaplumbağa']];
  const DIRS = { U: [0, -1, 0, 'yukarı'], R: [1, 0, 90, 'sağa'], D: [0, 1, 180, 'aşağı'], L: [-1, 0, 270, 'sola'] };
  const DKEYS = ['U', 'R', 'D', 'L'];

  function walk(n, start, seq) {
    let x = start[0], y = start[1];
    for (const d of seq) {
      x += DIRS[d][0]; y += DIRS[d][1];
      if (x < 0 || y < 0 || x >= n || y >= n) return null;
    }
    return [x, y];
  }

  function arrowRow(seq, s, x0, y0) {
    return seq.map((d, i) => {
      const x = x0 + i * (s + 6);
      return '<rect x="' + x + '" y="' + y0 + '" width="' + s + '" height="' + s + '" rx="' + s * 0.24 + '" fill="#3cc35f" stroke="#23924a" stroke-width="3"/>' +
        '<g transform="translate(' + (x + s / 2) + ' ' + (y0 + s / 2) + ') rotate(' + DIRS[d][2] + ') scale(' + s / 150 + ')"><path d="M0 -40L32 -4H14V38H-14V-4H-32Z" fill="#fff"/></g>';
    }).join('');
  }

  function boardSvg(n, start, hero, cells) {
    const c = 66, pad = 6, W = n * c + pad * 2;
    let inner = '<rect x="' + pad + '" y="' + pad + '" width="' + n * c + '" height="' + n * c + '" rx="12" fill="#f3fbef" stroke="' + S.INK + '" stroke-width="3"/>';
    let lines = '';
    for (let i = 1; i < n; i++) lines += 'M' + (pad + i * c) + ' ' + pad + 'v' + n * c + 'M' + pad + ' ' + (pad + i * c) + 'h' + n * c;
    inner += '<path d="' + lines + '" stroke="' + S.INK + '" stroke-opacity="0.25" stroke-width="2" fill="none"/>';
    inner += '<rect x="' + (pad + start[0] * c + 4) + '" y="' + (pad + start[1] * c + 4) + '" width="' + (c - 8) + '" height="' + (c - 8) + '" rx="12" fill="#ffe27a"/>';
    inner += S.emoji(pad + start[0] * c + c / 2, pad + start[1] * c + c / 2, hero, 40);
    cells.forEach((it) => { inner += S.emoji(pad + it.x * c + c / 2, pad + it.y * c + c / 2, it.e, 38); });
    return { inner: inner, w: W };
  }

  B.GEN.path = function (rng, level) {
    const n = level === 1 ? 4 : 5;
    const k = level === 1 ? rng.int(3, 4) : level === 2 ? rng.int(5, 6) : rng.int(6, 8);
    const hero = rng.pick(HEROES);
    const reverse = level === 3 && rng.chance(0.5);

    // kendini kesmeyen rastgele yol
    const start = [rng.int(0, n - 1), rng.int(0, n - 1)];
    const seq = [], seen = new Set([start.join()]);
    let x = start[0], y = start[1];
    for (let i = 0; i < k; i++) {
      const moves = rng.shuffle(DKEYS).filter((d) => {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen.has(nx + ',' + ny);
      });
      if (!moves.length) throw new Error('yol tıkandı');
      x += DIRS[moves[0]][0]; y += DIRS[moves[0]][1];
      seen.add(x + ',' + y);
      seq.push(moves[0]);
    }
    const free = [];
    for (let cx = 0; cx < n; cx++) for (let cy = 0; cy < n; cy++) if (!seen.has(cx + ',' + cy)) free.push([cx, cy]);
    if (free.length < 3) throw new Error('yer yok');
    const items = rng.sample(ITEMS, 4);
    const spots = rng.sample(free, 3);
    const cells = [{ x: x, y: y, e: items[0][0] }].concat(spots.map((p, i) => ({ x: p[0], y: p[1], e: items[i + 1][0] })));
    const board = boardSvg(n, start, hero[0], cells);
    const steps = seq.map((d) => DIRS[d][3]).join(', ');
    const q = { meta: { n: n, start: start, seq: seq, target: [x, y], cells: cells, reverse: reverse } };

    if (!reverse) {
      const s = 44, rowW = k * (s + 6) - 6, W = Math.max(board.w, rowW + 12);
      q.prompt = hero[1] + ' okları sırayla takip ederse hangisine ulaşır?';
      q.stem = S.svg(W, board.w + s + 16,
        '<g transform="translate(' + (W - board.w) / 2 + ' 0)">' + board.inner + '</g>' + arrowRow(seq, s, (W - rowW) / 2, board.w + 8), { maxW: W * 1.05 });
      q.explain = 'Sarı kareden başla ve her ok için bir kare ilerle: ' + steps + '. ' + hero[1] + ' ' + items[0][0] + ' olan kareye ulaşır.';
      return Q.finish(rng, q, Q.emoji(items[0][0]), items.slice(1).map((it) => Q.emoji(it[0])));
    }

    q.prompt = hero[1] + ' ' + items[0][0] + ' olan kareye gitmek için hangi okları takip etmeli?';
    q.speech = hero[1] + ' ' + items[0][1] + ' gitmek için hangi okları takip etmeli?';
    q.stem = S.svg(board.w, board.w, board.inner, { maxW: board.w * 1.05 });
    q.layout = 'wide';
    q.explain = 'Doğru yol: ' + steps + '. Diğer yollar başka bir kareye çıkıyor.';
    const s = 40;
    const mk = (sq) => ({ html: S.svg(k * (s + 6) + 2, s + 8, arrowRow(sq, s, 4, 4), { cls: 'opt-svg opt-svg-row' }), key: sq.join('') });
    // yanlış yollar: bir oku değiştir ya da iki oku yer değiştir; hedefe varmayanları al
    const inside = [], outside = [];
    for (let t = 0; t < 60; t++) {
      const m = seq.slice(), i = rng.int(0, k - 1);
      if (rng.chance(0.6)) m[i] = rng.pick(DKEYS.filter((d) => d !== m[i]));
      else { const j = rng.int(0, k - 1); const tmp = m[i]; m[i] = m[j]; m[j] = tmp; if (rng.chance(0.5)) m[rng.int(0, k - 1)] = rng.pick(DKEYS); }
      const end = walk(n, start, m);
      if (end && end[0] === x && end[1] === y) continue;
      (end ? inside : outside).push(mk(m));
    }
    return Q.finish(rng, q, mk(seq), inside.concat(outside));
  };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
