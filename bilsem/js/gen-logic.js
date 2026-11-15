/* Mantık yürütme: sıralama, ok yolu */
(function (root) {
  'use strict';
  const B = root.Bilsem, S = B.Shapes, Q = B.Q, r1 = S.r1;

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
    const n = level === 1 ? 4 : level === 2 ? rng.pick([4, 5]) : level === 3 ? 5 : 6;
    const kids = rng.sample(NAMES, n);            // 0 en çok (en uzun, en hızlı…), sonuncu en az
    const at = rng.pick(ATTRS), facts = [], pairs = [];
    const simple = (hi, lo) => {
      pairs.push([hi, lo]);
      return rng.chance(0.5) ? kids[lo][0] + ', ' + kids[hi][1] + ' ' + at.less + '.' : kids[hi][0] + ', ' + kids[lo][1] + ' ' + at.more + '.';
    };
    // komşu çiftlerin hepsi söylenir; üst düzeylerde bazıları tek cümlede birleşir ("... ama ...")
    for (let i = 0; i < n - 1;) {
      if (level > 2 && i + 1 < n - 1 && rng.chance(0.55)) {
        pairs.push([i, i + 1], [i + 1, i + 2]);
        facts.push(kids[i + 1][0] + ', ' + kids[i][1] + ' ' + at.less + ' ama ' + kids[i + 2][1] + ' ' + at.more + '.');
        i += 2;
      } else { facts.push(simple(i, i + 1)); i += 1; }
    }
    if (level > 2) { const a = rng.int(0, n - 3); facts.push(simple(a, rng.int(a + 2, n - 1))); }   // gereksiz ama doğru bir ipucu
    const list = rng.shuffle(facts);

    const ask = rng.pick([null, ['end'], ['rank', 'rank', 'end'], ['rank', 'count'], ['count', 'count', 'between', 'rank']][level]);
    const q = { promptBelow: true, meta: { order: kids.map((k) => k[0]), pairs: pairs, ask: ask } };   // soru cümlesi öncüllerin altında durur
    q.explain = at.from.charAt(0).toUpperCase() + at.from.slice(1) + ' ' + at.to + ' sıralama: ' + kids.map((k) => k[0]).join(', ') + '.';
    let idx;
    if (ask === 'count') {
      const r = rng.int(0, n - 1), more = rng.chance(0.5), ans = more ? r : n - 1 - r;
      q.prompt = kids[r][1] + ' ' + (more ? at.more : at.less) + ' kaç çocuk var?';
      q.meta.answer = ans;
      q.stem = story(at.intro, list);
      q.speech = at.intro + ' ' + list.join(' ') + ' ' + q.prompt;
      return Q.finishNum(rng, q, ans, { min: 0, max: n - 1 });
    }
    if (ask === 'end') {
      idx = rng.chance(0.5) ? 0 : n - 1;
      q.prompt = idx === 0 ? at.most : at.least;
    } else if (ask === 'between') {
      idx = rng.int(1, n - 2);
      q.prompt = 'Sıralamada ' + kids[idx - 1][0] + ' ile ' + kids[idx + 1][0] + ' arasında kim var?';
    } else {
      idx = rng.int(1, n - 2);
      q.prompt = 'Çocuklar ' + at.from + ' ' + at.to + ' doğru sıralanırsa ' + (idx + 1) + '. sırada kim olur?';
    }
    q.meta.answer = kids[idx][0];
    q.stem = story(at.intro, list);
    q.speech = at.intro + ' ' + list.join(' ') + ' ' + q.prompt;
    const banned = ask === 'between' ? [idx - 1, idx, idx + 1] : [idx];
    return Q.finish(rng, q, Q.text(kids[idx][0]), rng.shuffle(kids.filter((_, i) => banned.indexOf(i) < 0)).map((k) => Q.text(k[0])), Math.min(4, n - banned.length + 1));
  };
  function story(intro, facts) {
    return '<div class="story"><p>' + intro + '</p><ul>' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>';
  }

  /* ---------- Ok Yolu ---------- */
  const ITEMS = [['🥕', 'havuca'], ['🍎', 'elmaya'], ['🧀', 'peynire'], ['🍌', 'muza'], ['🍓', 'çileğe'], ['🌽', 'mısıra'], ['🍇', 'üzüme'], ['🍉', 'karpuza']];
  const HEROES = [['🐰', 'Tavşan'], ['🐭', 'Fare'], ['🐵', 'Maymun'], ['🐻', 'Ayı'], ['🐢', 'Kaplumbağa']];
  const DIRS = { U: [0, -1, 0, 'yukarı'], R: [1, 0, 90, 'sağa'], D: [0, 1, 180, 'aşağı'], L: [-1, 0, 270, 'sola'] };
  const DKEYS = ['U', 'R', 'D', 'L'];
  const ARROW = 'M0 -40L32 -4H14V38H-14V-4H-32Z';

  /* adımlar: [{ d: 'U'|'R'|'D'|'L', k: kaç kare }] -> varılan kare; dışarı çıkarsa null */
  function walk(n, start, steps) {
    let x = start[0], y = start[1];
    for (const st of steps) {
      for (let i = 0; i < st.k; i++) {
        x += DIRS[st.d][0]; y += DIRS[st.d][1];
        if (x < 0 || y < 0 || x >= n || y >= n) return null;
      }
    }
    return [x, y];
  }
  const badge = (x, y, k) => '<circle cx="' + x + '" cy="' + y + '" r="11" fill="#1d2b4a" stroke="#fff" stroke-width="2"/>' + S.text(x, y, k, 14, { fill: '#fff' });
  function tileBox(x, y, s, fill, line) {
    return '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="' + s * 0.24 + '" fill="' + fill + '" stroke="' + line + '" stroke-width="3"/>';
  }
  /* mutlak yönlü oklar; k > 1 ise köşede tekrar sayısı */
  function arrowRow(steps, s, x0, y0) {
    return steps.map((st, i) => {
      const x = x0 + i * (s + 8);
      return tileBox(x, y0, s, '#3cc35f', '#23924a') +
        '<g transform="translate(' + (x + s / 2) + ' ' + (y0 + s / 2) + ') rotate(' + DIRS[st.d][2] + ') scale(' + s / 150 + ')"><path d="' + ARROW + '" fill="#fff"/></g>' +
        (st.k > 1 ? badge(x + s - 4, y0 + 4, st.k) : '');
    }).join('');
  }
  /* robot komutları: F ileri (k kare), R sağa dön, L sola dön */
  function commandRow(cmds, s, x0, y0) {
    return cmds.map((c, i) => {
      const x = x0 + i * (s + 8), cx = x + s / 2, cy = y0 + s / 2;
      if (c.t === 'F') {
        return tileBox(x, y0, s, '#3cc35f', '#23924a') + '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s / 150 + ')"><path d="' + ARROW + '" fill="#fff"/></g>' + (c.k > 1 ? badge(x + s - 4, y0 + 4, c.k) : '');
      }
      // çeyrek dönüş: aşağıdan gelip sağa ya da sola kıvrılan ok
      const u = s / 44, dir = c.t === 'R' ? 1 : -1, xs = cx - dir * 8 * u, y1 = cy - 5 * u, x1 = cx + dir * 7 * u;
      return tileBox(x, y0, s, '#ff9838', '#cc6a12') +
        '<path d="M' + r1(xs) + ' ' + r1(cy + 13 * u) + 'V' + r1(y1 + 6 * u) + 'a' + r1(6 * u) + ' ' + r1(6 * u) + ' 0 0 ' + (dir > 0 ? 1 : 0) + ' ' + r1(dir * 6 * u) + ' ' + r1(-6 * u) + 'H' + r1(x1) +
        '" fill="none" stroke="#fff" stroke-width="' + r1(5 * u) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M' + r1(x1) + ' ' + r1(y1 - 7 * u) + 'L' + r1(x1 + dir * 8 * u) + ' ' + r1(y1) + 'L' + r1(x1) + ' ' + r1(y1 + 7 * u) + 'Z" fill="#fff" stroke="#fff" stroke-width="' + r1(2 * u) + '" stroke-linejoin="round"/>';
    }).join('');
  }

  function boardSvg(n, start, hero, cells, facing) {
    const c = n > 5 ? 58 : 66, pad = 6, W = n * c + pad * 2;
    let inner = '<rect x="' + pad + '" y="' + pad + '" width="' + n * c + '" height="' + n * c + '" rx="12" fill="#f3fbef" stroke="' + S.INK + '" stroke-width="3"/>';
    let lines = '';
    for (let i = 1; i < n; i++) lines += 'M' + (pad + i * c) + ' ' + pad + 'v' + n * c + 'M' + pad + ' ' + (pad + i * c) + 'h' + n * c;
    inner += '<path d="' + lines + '" stroke="' + S.INK + '" stroke-opacity="0.25" stroke-width="2" fill="none"/>';
    const sx = pad + start[0] * c, sy = pad + start[1] * c;
    inner += '<rect x="' + (sx + 4) + '" y="' + (sy + 4) + '" width="' + (c - 8) + '" height="' + (c - 8) + '" rx="12" fill="#ffe27a"/>';
    if (facing) {
      // robot: baktığı yönü gösteren mavi ok
      inner += '<g transform="translate(' + (sx + c / 2) + ' ' + (sy + c / 2) + ') rotate(' + DIRS[facing][2] + ') scale(' + c / 130 + ')"><path d="' + ARROW + '" fill="#3d8ef7" stroke="' + S.INK + '" stroke-width="5" stroke-linejoin="round"/></g>';
    } else inner += S.emoji(sx + c / 2, sy + c / 2, hero, c * 0.6);
    cells.forEach((it) => { inner += S.emoji(pad + it.x * c + c / 2, pad + it.y * c + c / 2, it.e, c * 0.58); });
    return { inner: inner, w: W };
  }

  B.GEN.path = function (rng, level) {
    const n = level < 3 ? 5 : 6, hero = rng.pick(HEROES), single = level < 3;
    // 1. ve 2. kademe: tek karelik adımlar; 3. ve 4. kademe: her parçası bir öncekine dik, 1-3 karelik köşeli yol
    const start = [rng.int(0, n - 1), rng.int(0, n - 1)], seen = new Set([start.join()]), steps = [];
    const span = [null, [5, 6], [6, 8], [4, 5], [3, 4]][level], runs = rng.int(span[0], span[1]);
    let x = start[0], y = start[1];
    for (let i = 0; i < runs; i++) {
      const prev = steps.length ? steps[steps.length - 1].d : null;
      const dirs = rng.shuffle(DKEYS.filter((d) => single || !prev || (DIRS[d][0] === 0) !== (DIRS[prev][0] === 0)));
      let done = false;
      for (const d of dirs) {
        for (const k of rng.shuffle(single ? [1] : [1, 2, 2, 3])) {
          const cells = [];
          for (let j = 1; j <= k; j++) cells.push([x + DIRS[d][0] * j, y + DIRS[d][1] * j]);
          if (cells.every((p) => p[0] >= 0 && p[1] >= 0 && p[0] < n && p[1] < n && !seen.has(p.join()))) {
            cells.forEach((p) => seen.add(p.join()));
            x = cells[k - 1][0]; y = cells[k - 1][1];
            steps.push({ d: d, k: k });
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (!done) throw new Error('yol tıkandı');
    }
    const free = [];
    for (let cx = 0; cx < n; cx++) for (let cy = 0; cy < n; cy++) if (!seen.has(cx + ',' + cy)) free.push([cx, cy]);
    if (free.length < 3) throw new Error('yer yok');
    const items = rng.sample(ITEMS, 4), spots = rng.sample(free, 3);
    const cells = [{ x: x, y: y, e: items[0][0] }].concat(spots.map((p, i) => ({ x: p[0], y: p[1], e: items[i + 1][0] })));
    const told = steps.map((st) => (st.k > 1 ? st.k + ' kare ' : '') + DIRS[st.d][3]).join(', ');
    const q = { meta: { n: n, start: start, steps: steps, target: [x, y], cells: cells, kind: 'forward' } };
    const s = 44;

    if (level === 4) {
      // robot baktığı yöne göre komut alır: ileri git, sağa dön, sola dön
      // başlangıçta tam ters yöne bakmasın: ilk komut en çok bir dönüş olsun
      const facing = rng.pick(DKEYS.filter((d) => (DKEYS.indexOf(d) + 2) % 4 !== DKEYS.indexOf(steps[0].d))), cmds = [];
      let f = DKEYS.indexOf(facing);
      steps.forEach((st) => {
        const t = DKEYS.indexOf(st.d), diff = (t - f + 4) % 4;
        if (diff === 1) cmds.push({ t: 'R' });
        else if (diff === 3) cmds.push({ t: 'L' });
        else if (diff === 2) { cmds.push({ t: 'R' }); cmds.push({ t: 'R' }); }
        cmds.push({ t: 'F', k: st.k });
        f = t;
      });
      const board = boardSvg(n, start, null, cells, facing), rowW = cmds.length * (s + 8) - 8, W = Math.max(board.w, rowW + 16);
      q.prompt = 'Mavi ok bir robot ve ucunun gösterdiği yöne bakıyor. Yeşil komutta baktığı yöne ilerler, turuncu komutta olduğu yerde döner. Robot hangisine ulaşır?';
      q.stem = S.svg(W, board.w + s + 22, '<g transform="translate(' + (W - board.w) / 2 + ' 0)">' + board.inner + '</g>' + commandRow(cmds, s, (W - rowW) / 2, board.w + 12), { maxW: W * 1.02 });
      q.meta.kind = 'robot'; q.meta.facing = facing; q.meta.cmds = cmds;
      q.explain = 'Robotun yolu: ' + told + '. Böylece ' + items[0][0] + ' olan kareye ulaşır.';
      return Q.finish(rng, q, Q.emoji(items[0][0]), items.slice(1).map((it) => Q.emoji(it[0])));
    }

    const board = boardSvg(n, start, hero[0], cells);
    if (level === 1 || rng.chance(0.5)) {
      const rowW = steps.length * (s + 8) - 8, W = Math.max(board.w, rowW + 16);
      q.prompt = hero[1] + ' okları sırayla takip ederse hangisine ulaşır?' + (!single ? ' Okun köşesindeki sayı kaç kare gidileceğini gösterir.' : '');
      q.stem = S.svg(W, board.w + s + 22, '<g transform="translate(' + (W - board.w) / 2 + ' 0)">' + board.inner + '</g>' + arrowRow(steps, s, (W - rowW) / 2, board.w + 12), { maxW: W * 1.02 });
      q.explain = 'Sarı kareden başla: ' + told + '. ' + hero[1] + ' ' + items[0][0] + ' olan kareye ulaşır.';
      return Q.finish(rng, q, Q.emoji(items[0][0]), items.slice(1).map((it) => Q.emoji(it[0])));
    }

    q.prompt = hero[1] + ' ' + items[0][0] + ' olan kareye gitmek için hangi okları takip etmeli?' + (!single ? ' Okun köşesindeki sayı kaç kare gidileceğini gösterir.' : '');
    q.speech = hero[1] + ' ' + items[0][1] + ' gitmek için hangi okları takip etmeli?';
    q.stem = S.svg(board.w, board.w, board.inner, { maxW: board.w * 1.05 });
    q.layout = 'wide';
    q.meta.kind = 'reverse';
    q.explain = 'Doğru yol: ' + told + '. Diğer yollar başka bir kareye çıkıyor.';
    const so = 40, key = (sq) => sq.map((st) => st.d + st.k).join('');
    const mk = (sq) => ({ html: S.svg(steps.length * (so + 8) + 8, so + 14, arrowRow(sq, so, 6, 9), { cls: 'opt-svg opt-svg-row' }), key: key(sq), steps: sq });
    // yanlış yollar: bir okun yönünü ya da kare sayısını değiştir, iki oku yer değiştir; hedefe varmayanları al
    const inside = [], outside = [];
    for (let t = 0; t < 80; t++) {
      const m = steps.map((st) => ({ d: st.d, k: st.k })), i = rng.int(0, m.length - 1), r = rng.next();
      if (r < 0.4) m[i].d = rng.pick(DKEYS.filter((d) => d !== m[i].d));
      else if (r < 0.7 && !single) m[i].k = rng.pick([1, 2, 3].filter((k) => k !== m[i].k));
      else { const j = rng.int(0, m.length - 1), tmp = m[i]; m[i] = m[j]; m[j] = tmp; }
      const end = walk(n, start, m);
      if (end && end[0] === x && end[1] === y) continue;
      (end ? inside : outside).push(mk(m));
    }
    return Q.finish(rng, q, mk(steps), inside.concat(outside));
  };

  B.LogicUtil = { walk: walk, NAMES: NAMES };

  if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
