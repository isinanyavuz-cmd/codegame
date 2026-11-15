/* Enes BİLSEM'e Hazırlanıyor — arayüz: ana sayfa, soru ekranı, sayı hafızası, sonuç, veli paneli */
(function () {
  'use strict';
  const B = window.Bilsem, S = B.Shapes, Store = B.Store, U = B.StoreUtil, Span = B.Span;
  const app = document.getElementById('app');
  const rng = new B.RNG((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  const LETTERS = ['A', 'B', 'C', 'D'];
  const EXAMS = [{ n: 20, min: 25, name: 'Kısa deneme' }, { n: 40, min: 50, name: 'Orta deneme' }, { n: 60, min: 75, name: 'Uzun deneme' }];
  const PRAISE = ['Harika!', 'Süpersin!', 'Aferin!', 'Tam isabet!', 'Çok iyi!', 'Bravo!'];
  const CHEER = ['Olsun, birlikte bakalım.', 'Az kaldı!', 'Bir dahakine olacak.'];
  const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  let view = 'home';     // home | quiz | result | parent | span
  let ses = null;        // etkin oturum
  let span = null;       // etkin sayı hafızası oyunu
  let sheet = null;      // açık pencere
  let clock = null, memoT = null, trVoice = null, actx = null;

  /* ---------- simgeler ---------- */
  function star(on) {
    return '<svg viewBox="0 0 24 24" class="' + (on ? 'on' : 'off') + '" aria-hidden="true"><path d="M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="' +
      (on ? 'var(--sun)' : 'var(--surface-2)') + '" stroke="' + (on ? 'var(--sun-dark)' : 'var(--line-strong)') + '" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  }
  function heart(on) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C5.5 15.6 3 12.4 3 8.9 3 6.2 5 4.3 7.5 4.3c1.8 0 3.4 1 4.5 2.7 1.1-1.7 2.7-2.7 4.5-2.7C19 4.3 21 6.2 21 8.9c0 3.5-2.5 6.7-9 11.6z" fill="' +
      (on ? 'var(--bad)' : 'var(--surface-2)') + '" stroke="' + (on ? 'var(--bad-dark)' : 'var(--line-strong)') + '" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  }
  const starsRow = (n) => '<span class="stars-row">' + [0, 1, 2].map((i) => star(i < n)).join('') + '</span>';
  const I = {
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.4 2.2c.5 3.4 5 5.6 5 10.9a5.4 5.4 0 0 1-10.8 0c0-2.1.8-3.6 1.9-4.8.2 1.6.9 2.6 1.9 3.1-.5-3.6.4-6.9 2-9.2z" fill="#ff7a2e" stroke="#c94f10" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5l-7 7 7 7"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a7.6 7.6 0 0 1 0 11"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/></svg>',
    span: '<svg class="hero-ico" viewBox="0 0 56 56" aria-hidden="true">' + [['4', 3, '#fff'], ['7', 20.5, '#fff'], ['2', 38, '#ffc93c']].map((d) =>
      '<rect x="' + d[1] + '" y="14" width="15" height="24" rx="5" fill="' + d[2] + '" stroke="#1d2b4a" stroke-width="3"/><text x="' + (d[1] + 7.5) + '" y="26" dy="0.35em" text-anchor="middle" font-size="14" font-weight="800" fill="#1d2b4a">' + d[0] + '</text>').join('') +
      '<path d="M14 47h28m-6 -5l6 5l-6 5M42 47H14m6 -5l-6 5l6 5" fill="none" stroke="#1d2b4a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    exam: '<svg class="hero-ico" viewBox="0 0 56 56" aria-hidden="true"><rect x="8" y="5" width="32" height="42" rx="6" fill="#fff" stroke="#1d2b4a" stroke-width="3.4"/>' +
      '<path d="M15 16h18M15 24h18M15 32h10" stroke="#b4c5e2" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="39" cy="39" r="12" fill="#ffc93c" stroke="#1d2b4a" stroke-width="3.4"/><path d="M39 32v7l4.5 3" fill="none" stroke="#1d2b4a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function robot(mood, cls) {
    const eyes = mood === 'happy'
      ? '<path d="M15.2 27.5q3.6-5.4 7.2 0M27.6 27.5q3.6-5.4 7.2 0" fill="none" stroke="#7cf7ff" stroke-width="3" stroke-linecap="round"/>'
      : mood === 'sad'
        ? '<circle cx="19" cy="25" r="3" fill="#7cf7ff"/><circle cx="31" cy="25" r="3" fill="#7cf7ff"/><path d="M21 31.2q4-2.4 8 0" fill="none" stroke="#7cf7ff" stroke-width="2.2" stroke-linecap="round"/>'
        : '<circle cx="19" cy="26" r="3.5" fill="#7cf7ff"/><circle cx="31" cy="26" r="3.5" fill="#7cf7ff"/>';
    return '<svg class="robot' + (cls ? ' ' + cls : '') + '" viewBox="0 0 56 56" aria-hidden="true">' +
      /* başında ampul yanan robot: "fikir buldum" */
      '<path d="M20.6 4.4l-2.2-2M35.4 4.4l2.2-2M18.6 11h-3M37.4 11h3" stroke="#f5a700" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="24.6" y="14.5" width="6.8" height="6" rx="1.6" fill="#c9d3e6" stroke="#1d2b4a" stroke-width="2.4"/>' +
      '<circle cx="28" cy="10" r="6.6" fill="#ffd84d" stroke="#1d2b4a" stroke-width="2.6"/>' +
      '<path d="M25.2 11.6l1.4-2.2 1.4 2.2 1.4-2.2 1.4 2.2" fill="none" stroke="#f08c00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="9" y="20" width="38" height="31" rx="12" fill="#3d8ef7" stroke="#1d2b4a" stroke-width="3.4"/>' +
      '<g transform="translate(3 7)"><rect x="11.5" y="18" width="27" height="16" rx="8" fill="#1d2b4a"/>' + eyes + '</g></svg>';
  }

  /* kategori simgeleri: soru çizimleriyle aynı şekil kütüphanesinden */
  const F = (shape, color, extra) => Object.assign({ shape: shape, color: color }, extra || {});
  const greenTile = (x, y, rot) => '<rect x="' + x + '" y="' + y + '" width="40" height="40" rx="10" fill="#3cc35f" stroke="#23924a" stroke-width="3"/>' +
    '<g transform="translate(' + (x + 20) + ' ' + (y + 20) + ') rotate(' + rot + ') scale(.27)"><path d="M0 -40L32 -4H14V38H-14V-4H-32Z" fill="#fff"/></g>';
  const ICONS = {
    pattern: () => S.figAt(F('circle', 'red'), 0, 30, 40) + S.figAt(F('square', 'blue'), 30, 30, 40) + S.figAt(F('circle', 'red'), 60, 30, 40),
    matrix: () => S.tile(8, 8, 40) + S.figAt(F('triangle', 'green'), 8, 8, 40) + S.tile(52, 8, 40) + S.figAt(F('triangle', 'orange'), 52, 8, 40) +
      S.tile(8, 52, 40) + S.figAt(F('circle', 'green'), 8, 52, 40) + S.qtile(52, 52, 40),
    analogy: () => S.figAt(F('star', 'yellow'), 0, 22, 56) + '<path d="M56 50h14m-6 -6l6 6l-6 6" fill="none" stroke="#566889" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' + S.figAt(F('star', 'yellow'), 68, 36, 28),
    odd: () => S.figAt(F('circle', 'blue'), 6, 6, 44) + S.figAt(F('circle', 'blue'), 50, 6, 44) + S.figAt(F('circle', 'blue'), 6, 50, 44) + S.figAt(F('square', 'orange'), 50, 50, 44),
    rotate: () => S.figAt(F('flag', 'purple'), 6, 24, 62) + '<path d="M62 20a26 26 0 0 1 24 26" fill="none" stroke="#f08c00" stroke-width="7" stroke-linecap="round"/><path d="M86 58l-10 -13h20z" fill="#f08c00"/>',
    mirror: () => S.figAt(F('flag', 'green'), 0, 22, 56) + '<path d="M50 10v80" stroke="#2f7de1" stroke-width="3.4" stroke-dasharray="6 6" stroke-linecap="round"/>' + S.figAt(F('flag', 'green', { mirror: true }), 44, 22, 56),
    cubes: () => { const c = S.cubes([[2, 1], [1, 0]], 26, S.CUBE_TONES[0]); return '<g transform="translate(' + (100 - c.w) / 2 + ' ' + (100 - c.h) / 2 + ')">' + c.inner + '</g>'; },
    stack: () => [['#3d8ef7', 'M12 72L88 28'], ['#ffd233', 'M10 40L90 58'], ['#f2545b', 'M24 16L76 86']].map((l) =>
      '<path d="' + l[1] + '" stroke="#1d2b4a" stroke-width="15" stroke-linecap="round"/><path d="' + l[1] + '" stroke="' + l[0] + '" stroke-width="10" stroke-linecap="round"/>').join(''),
    numseq: () => S.tile(3, 35, 29) + S.text(17.5, 49.5, '2', 20) + S.tile(35.5, 35, 29) + S.text(50, 49.5, '4', 20) + S.qtile(68, 35, 29),
    fruit: () => S.emoji(24, 50, '🍎', 32) + S.text(50, 50, '+', 26, { fill: '#566889' }) + S.emoji(76, 50, '🍌', 32),
    code: () => S.figAt(F('triangle', 'red'), 0, 27, 46) + S.text(53, 50, '=', 26, { fill: '#566889' }) + S.text(78, 50, '7', 42),
    same: () => { const m = [[1, 0, 2], [0, 1, 0], [2, 0, 0]], p = ['purple', 'yellow']; return S.Grid.draw(m, p, 5, 29, 42) + S.Grid.draw(m, p, 53, 29, 42); },
    count: () => S.figAt(F('star', 'yellow'), 2, 4, 46) + S.figAt(F('star', 'yellow'), 50, 18, 46) + S.figAt(F('star', 'yellow'), 14, 50, 46),
    memory: () => S.tile(6, 28, 42) + S.emoji(27, 49, '🐱', 26) + S.qtile(52, 28, 42),
    order: () => [['#3d8ef7', 14, 34], ['#ffc93c', 40, 52], ['#f2545b', 66, 70]].map((b) =>
      '<rect x="' + b[1] + '" y="' + (88 - b[2]) + '" width="20" height="' + b[2] + '" rx="6" fill="' + b[0] + '" stroke="#1d2b4a" stroke-width="3.4"/>').join(''),
    path: () => greenTile(8, 14, 90) + greenTile(52, 14, 90) + greenTile(52, 54, 180),
    machine: () => '<rect x="26" y="22" width="48" height="56" rx="12" fill="#a565f2" stroke="#1d2b4a" stroke-width="3.4"/>' + S.text(50, 50, '+2', 24, { fill: '#fff' }) +
      S.text(11, 50, '3', 24) + S.text(89, 50, '5', 24),
    shadow: () => S.figAt(F('star', 'yellow'), 2, 14, 54) + S.figAt(F('star', 'ink'), 44, 32, 54),
    balance: () => '<path d="M50 30V78M34 82h32" stroke="#1d2b4a" stroke-width="5" stroke-linecap="round"/><path d="M18 24L82 38" stroke="#1d2b4a" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="50" cy="31" r="5" fill="#ffc93c" stroke="#1d2b4a" stroke-width="2.6"/>' + S.figAt(F('circle', 'red'), 4, 26, 30) + S.figAt(F('square', 'blue'), 68, 42, 28),
    who: () => S.emoji(27, 40, '🐱', 30) + S.emoji(73, 40, '🐶', 30) + S.text(50, 76, '?', 30, { fill: '#e08600' }),
  };
  const icon = (id) => S.svg(100, 100, ICONS[id](), { cls: 'cat-svg' });

  /* ---------- yardımcılar ---------- */
  const cur = () => (ses ? ses.items[ses.idx] : null);
  const fmtTime = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const closeBtn = '<button type="button" class="icon-btn sheet-x" data-act="close" aria-label="Kapat">' + I.x + '</button>';

  function beep(seq) {
    if (!Store.data.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      let t = actx.currentTime + 0.01;
      seq.forEach((n) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle';
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + n[1] + 0.03);
        t += n[1] * 0.75;
      });
    } catch (e) { /* ses çalınamazsa sessiz devam */ }
  }
  const SND = { ok: [[660, 0.12], [880, 0.2]], no: [[240, 0.16], [190, 0.26]], win: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.32]], done: [[523, 0.14], [659, 0.26]] };

  function findVoice() {
    try { trVoice = window.speechSynthesis.getVoices().find((v) => /^tr/i.test(v.lang)) || null; } catch (e) { trVoice = null; }
  }
  function speak(text) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR'; u.rate = 0.9;
      if (trVoice) u.voice = trVoice;
      window.speechSynthesis.speak(u);
    } catch (e) { /* seslendirme yoksa geç */ }
  }

  /* ---------- oturum kurma ---------- */
  function makeItems(specs) {
    const seen = new Set(), items = [];
    specs.forEach((sp) => {
      let q = null;
      for (let t = 0; t < 6; t++) {
        try { q = B.generate(sp.type, sp.level, rng); } catch (e) { q = null; continue; }
        const sig = q.prompt + q.stem + (q.memo ? q.memo.html : '') + q.options.map((o) => o.key).sort().join();
        if (!seen.has(sig)) { seen.add(sig); break; }
      }
      if (q) items.push({ q: q, chosen: null, ms: 0, t0: 0, memoSeen: false, msg: '' });
    });
    return items;
  }
  function begin(s) {
    stopTimers();
    ses = Object.assign({ idx: 0, startedAt: Date.now(), result: null }, s);
    sheet = null;
    view = 'quiz';
    if (ses.mode === 'exam') clock = setInterval(tick, 1000);
    enter();
  }
  function startPractice(id, level) {
    const n = Store.data.settings.len;
    begin({ mode: 'practice', cat: id, level: level, items: makeItems(Array.from({ length: n }, () => ({ type: id, level: level }))) });
  }
  function startDaily(level) {
    const plan = rng.shuffle(Store.dailyPlan(rng, 10));
    if (level) plan.forEach((sp) => { sp.level = level; });
    begin({ mode: 'daily', fixed: level || 0, items: makeItems(plan) });
  }
  function startExam(i, level) {
    const ex = EXAMS[i], specs = [];
    let pool = [];
    for (let k = 0; k < ex.n; k++) {
      if (!pool.length) pool = rng.shuffle(B.CATS.map((c) => c.id));
      const f = k / ex.n;
      specs.push({ type: pool.pop(), level: level || (f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.8 ? 3 : 4) });   // seçilmediyse kolaydan zora
    }
    begin({ mode: 'exam', exam: i, fixed: level || 0, left: ex.min * 60, items: makeItems(specs) });
  }
  function stopTimers() { clearInterval(clock); clearTimeout(memoT); clock = null; memoT = null; }

  function enter() {
    clearTimeout(memoT);
    const it = cur();
    if (it.q.memo && !it.memoSeen) memoT = setTimeout(memoDone, it.q.memo.seconds * 1000);
    else it.t0 = performance.now();
    render();
    window.scrollTo(0, 0);
  }
  function memoDone() {
    clearTimeout(memoT);
    const it = cur();
    if (!it || it.memoSeen || view !== 'quiz') return;
    it.memoSeen = true;
    it.t0 = performance.now();
    render();
  }
  function leave() {
    const it = cur();
    if (it && ses.mode === 'exam' && it.t0) { it.ms += performance.now() - it.t0; it.t0 = 0; }
  }
  function tick() {
    if (!ses || ses.mode !== 'exam') return;
    ses.left--;
    const el = document.getElementById('clock');
    if (el) {
      el.querySelector('b').textContent = fmtTime(Math.max(0, ses.left));
      el.classList.toggle('low', ses.left <= 60);
    }
    if (ses.left <= 0) finish();
  }

  function pick(i) {
    const it = cur();
    if (!it || view !== 'quiz' || (it.q.memo && !it.memoSeen) || i >= it.q.options.length) return;
    if (ses.mode === 'exam') {
      it.chosen = it.chosen === i ? null : i;
      render();
      return;
    }
    if (it.chosen != null) return;
    it.chosen = i;
    it.ms = performance.now() - it.t0;
    const ok = i === it.q.answer;
    it.msg = rng.pick(ok ? PRAISE : CHEER);
    Store.recordAnswer(it.q.type, it.q.level, ok, it.ms);
    Store.save();
    beep(ok ? SND.ok : SND.no);
    render();
    const fb = app.querySelector('.fb');
    if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function next() {
    const it = cur();
    if (!it || view !== 'quiz') return;
    if (ses.mode !== 'exam' && it.chosen == null) return;
    if (ses.idx >= ses.items.length - 1) {
      if (ses.mode === 'exam') { sheet = { kind: 'finish' }; render(); } else finish();
      return;
    }
    leave();
    ses.idx++;
    enter();
  }
  function prev() {
    if (!ses || ses.idx === 0) return;
    leave();
    ses.idx--;
    enter();
  }
  function finish() {
    leave();
    stopTimers();
    let ok = 0, blank = 0;
    ses.items.forEach((it) => {
      const good = it.chosen === it.q.answer;
      if (good) ok++;
      if (it.chosen == null) blank++;
      if (ses.mode === 'exam' && it.chosen != null) Store.recordAnswer(it.q.type, it.q.level, good, it.ms);
    });
    const total = ses.items.length, stars = U.starsFor(ok, total);
    const sec = Math.round((Date.now() - ses.startedAt) / 1000);
    if (ses.mode === 'practice') Store.setStars(ses.cat, ses.level, stars);
    if (ses.mode === 'daily') Store.finishDaily(stars);
    if (ses.mode === 'exam') Store.addExam({ date: U.dayKey(), n: total, ok: ok, blank: blank, sec: sec });
    Store.save();
    ses.result = { ok: ok, total: total, blank: blank, stars: stars, sec: sec };
    sheet = null;
    view = 'result';
    render();
    window.scrollTo(0, 0);
    beep(stars >= 2 ? SND.win : SND.done);
  }

  /* ---------- ana sayfa ---------- */
  const STAR_MAX = B.LEVELS.length * 3;
  const starSum = (st) => st.stars.reduce((a, b) => a + b, 0);
  function catCard(c) {
    const total = starSum(Store.cat(c.id));
    return '<button type="button" class="cat" data-act="cat" data-id="' + c.id + '">' +
      '<span class="cat-ico">' + icon(c.id) + '</span><span class="cat-name">' + c.name + '</span><span class="cat-desc">' + c.desc + '</span>' +
      '<span class="cat-stars">' + star(total > 0) + total + '<i>/ ' + STAR_MAX + '</i></span></button>';
  }
  const fmtSec = (v) => String(v).replace('.', ',');
  function spanRecords() {
    const best = Store.data.span.best;
    const list = Span.LEVELS.map((l) => ({ name: l.name, v: Math.max(best[l.id].both, best[l.id].fwd, best[l.id].bwd) })).filter((x) => x.v);
    return list.length ? 'Rekor: ' + list.map((x) => x.name + ' ' + x.v + ' basamak').join(' · ') : 'Henüz rekor yok.';
  }
  function homeView() {
    const done = Store.dailyDone();
    return '<div class="page home">' +
      '<header class="top"><div class="brand">' + robot('idle', 'logo badge') +
      '<div><span class="brand-name">Enes <b>BİLSEM\'e</b> Hazırlanıyor</span><span class="brand-sub">2. sınıf · genel yetenek alıştırmaları</span></div></div>' +
      '<div class="chips"><span class="chip">' + star(true) + '<b>' + Store.totalStars() + '</b><small>yıldız</small></span>' +
      '<span class="chip">' + I.flame + '<b>' + Store.streak() + '</b><small>gün üst üste</small></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="parent">Veli paneli</button></div></header>' +
      '<section class="hero">' +
      '<button type="button" class="hero-card hero-daily" data-act="daily">' + robot(done ? 'happy' : 'idle') +
      '<span class="hc"><span class="hc-title">Günün Görevi</span><span class="hc-text">' +
      (done ? 'Bugünkü görev tamam. İstersen yeniden oyna.' : 'Her konudan karışık 10 soru. Yaklaşık 10 dakika sürer.') +
      '</span><span class="hero-go">' + (done ? 'Tekrar oyna' : 'Başla') + '</span></span></button>' +
      '<button type="button" class="hero-card hero-exam" data-act="exam-pick">' + I.exam +
      '<span class="hc"><span class="hc-title">Deneme Sınavı</span><span class="hc-text">Süreli ve karışık sorular. Cevaplar sınav bitince gösterilir.</span>' +
      '<span class="hero-go">Sınav seç</span></span></button></section>' +
      '<section class="area" style="--area: var(--a-hafiza)"><h2>Sayı Hafızası</h2>' +
      '<button type="button" class="span-card" data-act="span-pick">' + I.span +
      '<span class="hc"><span class="hc-title">Sayıyı aklında tut</span><span class="hc-text">Sayıya bak; kapanınca süre bitmeden klavyeyle düzden ve tersten yaz. ' +
      Span.MIN + ' basamakla başlar, ' + Span.MAX + ' basamağa kadar uzar.</span><span class="span-recs">' + spanRecords() + '</span></span>' +
      '<span class="hero-go">Başla</span></button></section>' +
      B.AREAS.map((a) => '<section class="area" style="--area: var(--a-' + a.id + ')"><h2>' + a.name + '</h2><div class="cat-grid">' +
        B.CATS.filter((c) => c.area === a.id).map(catCard).join('') + '</div></section>').join('') +
      '<p class="foot">Her gün kısa bir çalışma, arada bir uzun çalışmadan daha çok işe yarar.' +
      (app.dataset.surum ? '<span class="surum">Sürüm ' + app.dataset.surum + '</span>' : '') + '</p></div>';
  }

  /* ---------- soru ekranı ---------- */
  function optBtn(q, it, i, mode) {
    let cls = 'opt', attr = ' data-act="pick" data-i="' + i + '"';
    if (mode === 'exam') { if (it.chosen === i) cls += ' sel'; }
    else if (mode === 'done') {
      attr = ' disabled';
      cls += i === q.answer ? ' ok' : i === it.chosen ? ' no' : ' dim';
    }
    return '<button type="button" class="' + cls + '"' + attr + '><span class="opt-letter">' + LETTERS[i] + '</span>' + q.options[i].html + '</button>';
  }
  function optsHtml(q, it, mode) {
    return '<div class="opts opts-' + q.options.length + (q.layout === 'wide' ? ' opts-wide' : '') + '">' +
      q.options.map((_, i) => optBtn(q, it, i, mode)).join('') + '</div>';
  }
  function quizTop() {
    const n = ses.items.length, exam = ses.mode === 'exam';
    const right = exam
      ? '<span class="chip chip-time' + (ses.left <= 60 ? ' low' : '') + '" id="clock">' + I.clock + '<b>' + fmtTime(Math.max(0, ses.left)) + '</b></span>'
      : '<span class="chip">' + star(true) + '<b>' + ses.items.filter((it) => it.chosen != null && it.chosen === it.q.answer).length + '</b></span>';
    return '<header class="quiz-top"><button type="button" class="icon-btn" data-act="quit" aria-label="Çık">' + I.x + '</button>' +
      '<div class="prog"><div class="prog-bar" style="width:' + pct(ses.idx + (ses.mode !== 'exam' && cur().chosen != null ? 1 : 0), n) + '%"></div>' +
      '<span class="prog-txt">' + (ses.idx + 1) + ' / ' + n + '</span></div>' + right + '</header>';
  }
  function quizView() {
    const it = cur(), q = it.q, cat = B.catById(q.type), exam = ses.mode === 'exam';
    const area = ' style="--area: var(--a-' + cat.area + ')"';
    if (q.memo && !it.memoSeen) {
      return '<div class="page quiz memo"' + area + '>' + quizTop() + '<h1>Resimlere iyi bak!</h1>' +
        '<div class="paper stem">' + q.memo.html + '</div>' +
        '<div class="memo-bar"><i style="animation-duration:' + q.memo.seconds + 's"></i></div>' +
        '<button type="button" class="btn btn-ghost" data-act="memo-done">Hazırım</button></div>';
    }
    const answered = it.chosen != null && !exam, last = ses.idx === ses.items.length - 1;
    const tag = '<span class="q-tag">' + cat.name + ' · ' + B.LEVEL_NAMES[q.level] + '</span>';
    const prompt = '<div class="q-prompt"><h1>' + q.prompt + '</h1>' +
      (trVoice ? '<button type="button" class="icon-btn" data-act="speak" aria-label="Soruyu sesli oku">' + I.sound + '</button>' : '') + '</div>';
    const stem = q.stem ? '<div class="paper stem">' + q.stem + '</div>' : '';
    // öncüllü sorularda (Kim Hangisi, Sıralama) soru cümlesi öncüllerin altında durur
    let html = '<div class="page quiz"' + area + '>' + quizTop() +
      (q.promptBelow ? tag + stem + prompt : '<div class="q-head">' + tag + prompt + '</div>' + stem) +
      optsHtml(q, it, exam ? 'exam' : answered ? 'done' : 'live');
    if (answered) {
      const ok = it.chosen === q.answer;
      html += '<div class="fb ' + (ok ? 'fb-ok' : 'fb-no') + '" role="status">' + robot(ok ? 'happy' : 'sad', 'badge') +
        '<div class="fb-msg"><b>' + it.msg + '</b>' + (ok ? '' : 'Doğru cevap ' + LETTERS[q.answer] + ' şıkkı. ') + q.explain + '</div>' +
        '<button type="button" class="btn btn-sun" data-act="next">' + (last ? 'Bitir' : 'Devam') + '</button></div>';
    }
    if (exam) {
      html += '<div class="exam-nav"><button type="button" class="btn btn-ghost" data-act="prev"' + (ses.idx === 0 ? ' disabled' : '') + '>Önceki</button>' +
        '<button type="button" class="btn btn-ghost" data-act="finish-ask">Sınavı bitir</button>' +
        (last ? '' : '<button type="button" class="btn btn-sun" data-act="next">Sonraki</button>') + '</div>';
    }
    return html + '</div>';
  }

  /* ---------- sayı hafızası ---------- */
  function spanStart(mode, level) {
    stopTimers();
    ses = null; sheet = null;
    view = 'span';
    const set = Store.data.settings;
    span = { g: Span.newGame(mode, set.spanStart, level || set.spanLevel), phase: 'show', number: '', askIdx: 0, typed: '', entries: [], late: [], ok: false, record: false, total: 0, t0: 0, typeTimed: set.spanTypeTimed !== false };
    spanShow();
  }
  /* süre sayacı: gösterme ve her yazım için aynı süre (düzeye göre) */
  function spanTimer(fn) {
    clearTimeout(memoT);
    span.total = Span.seconds(span.g.len, span.g.level);
    span.t0 = performance.now();
    memoT = setTimeout(fn, span.total * 1000);
  }
  /* Yazma süresi isteğe bağlı: kapalıysa sayaç kurulmaz, çocuk "Tamam"a basana kadar bekler. */
  function spanTypeTimer() {
    if (span.typeTimed) spanTimer(spanTimeout);
    else { clearTimeout(memoT); span.total = 0; }
  }
  function spanShow() {
    span.number = Span.makeNumber(rng, span.g.len);
    span.phase = 'show'; span.askIdx = 0; span.typed = ''; span.entries = []; span.late = [];
    spanTimer(spanHide);
    render();
    window.scrollTo(0, 0);
  }
  function spanHide() {
    clearTimeout(memoT);
    if (!span || view !== 'span' || span.phase !== 'show') return;
    span.phase = 'type';
    spanTypeTimer();
    render();
  }
  function spanKey(d) {
    if (!span || view !== 'span' || sheet || span.phase !== 'type' || span.typed.length >= span.g.len) return;
    span.typed += d;
    render();
  }
  function spanDel() {
    if (!span || view !== 'span' || sheet || span.phase !== 'type' || !span.typed) return;
    span.typed = span.typed.slice(0, -1);
    render();
  }
  function spanOk() { if (!sheet) spanSubmit(false); }
  function spanTimeout() { spanSubmit(true); }
  /* Yazılanı gönderir. Süre bittiyse o ana kadar yazılan neyse o sayılır (eksikse yanlış). */
  function spanSubmit(timeout) {
    if (!span || view !== 'span' || span.phase !== 'type') return;
    const list = Span.asks(span.g.mode), len = span.g.len;
    if (!timeout && span.typed.length !== len) return;
    clearTimeout(memoT);
    span.entries.push(span.typed);
    span.late.push(span.typed.length < len);
    span.typed = '';
    if (span.askIdx < list.length - 1) { span.askIdx++; spanTypeTimer(); render(); return; }
    span.ok = list.every((a, i) => span.entries[i] === Span.expected(span.number, a));
    span.shownLen = len;
    Span.advance(span.g, span.ok);
    Store.spanTrial(span.ok);
    if (span.ok && Store.spanBest(span.g.level, span.g.mode, span.g.best)) span.record = true;
    if (span.g.over) Store.spanPlayed();
    Store.save();
    span.phase = 'result';
    beep(span.ok ? SND.ok : SND.no);
    render();
  }
  function spanNext() {
    if (!span || view !== 'span' || sheet || span.phase !== 'result') return;
    if (span.g.over) { span.phase = 'over'; render(); window.scrollTo(0, 0); beep(span.g.best ? SND.win : SND.done); }
    else spanShow();
  }
  /* azalan süre çubuğu; ekran yeniden çizilse de kaldığı yerden devam eder */
  function timeBar() {
    const gone = Math.min(span.total, (performance.now() - span.t0) / 1000);
    return '<div class="memo-bar"><i style="animation-duration:' + span.total + 's;animation-delay:-' + gone.toFixed(2) + 's"></i></div>';
  }
  /* rakam kutuları; marks verilirse her kutu doğru/yanlış boyanır */
  function digitsHtml(str, n, marks) {
    let out = '<div class="digits" style="--n:' + n + '">';
    for (let i = 0; i < n; i++) {
      const ch = str[i];
      out += '<span class="digit' + (ch == null ? (marks ? ' no' : i === str.length ? ' cur' : ' empty') : marks ? (marks[i] ? ' ok' : ' no') : '') + '">' + (ch == null ? '' : ch) + '</span>';
    }
    return out + '</div>';
  }
  function spanView() {
    const g = span.g, list = Span.asks(g.mode), mode = Span.MODES.find((m) => m.id === g.mode), lvl = Span.levelOf(g.level);
    const tag = '<span class="q-tag">Sayı Hafızası · ' + lvl.name + ' · ' + mode.name + '</span>';
    const n = span.phase === 'result' ? span.shownLen : g.len;
    let steps = '';
    for (let k = Span.MIN; k <= Span.MAX; k++) steps += '<i class="' + (k <= g.best ? 'done' : '') + (k === n && span.phase !== 'over' ? ' cur' : '') + '">' + k + '</i>';
    const top = '<header class="quiz-top"><button type="button" class="icon-btn" data-act="quit" aria-label="Çık">' + I.x + '</button>' +
      '<div class="steps" aria-label="Basamak sayısı">' + steps + '</div><span class="chip hearts" aria-label="Kalan can: ' + g.lives + '">' + [0, 1, 2].map((i) => heart(i < g.lives)).join('') + '</span></header>';
    const open = '<div class="page quiz span" style="--area: var(--a-hafiza)">' + top;

    if (span.phase === 'over') {
      const rec = Store.data.span.best[g.level][g.mode];
      return '<div class="page result" style="--area: var(--a-hafiza)">' + robot(g.best ? 'happy' : 'idle', 'badge') +
        '<h1>' + (g.won ? Span.MAX + ' basamağı da bildin!' : g.best ? 'Güzel hafıza!' : 'Bu sefer olmadı') + '</h1>' +
        '<div class="score">' + g.best + '<small> basamak</small></div>' +
        '<p class="result-sub">' + lvl.name + ' · ' + mode.name + ' · ' + g.hits + ' doğru, ' + (g.trials - g.hits) + ' yanlış · ' + (span.record ? 'Yeni rekor!' : rec ? 'Rekorun ' + rec + ' basamak' : 'Henüz rekor yok') + '</p>' +
        '<div class="result-actions"><button type="button" class="btn btn-sun" data-act="span-again">Tekrar oyna</button><button type="button" class="btn btn-ghost" data-act="home">Ana sayfa</button></div></div>';
    }
    if (span.phase === 'show') {
      return open + '<div class="span-head">' + tag + '<h1>Sayıya iyi bak!</h1><p>' + n + ' basamak, ' + fmtSec(span.total) + ' saniye</p></div>' +
        '<div class="paper stem">' + digitsHtml(span.number, n) + '</div>' + timeBar() + '</div>';
    }
    if (span.phase === 'type') {
      const ask = list[span.askIdx], full = span.typed.length === n;
      let keys = '';
      for (let d = 1; d <= 9; d++) keys += '<button type="button" class="key" data-act="span-key" data-d="' + d + '">' + d + '</button>';
      return open + '<div class="span-head">' + tag +
        '<h1>' + (ask === 'fwd' ? 'Sayıyı yaz' : 'Sayıyı tersten yaz') + '</h1><p>' + (span.typeTimed ? fmtSec(span.total) + ' saniyen var. ' : 'Acele etme, süre yok. ') + (list.length > 1 ? (span.askIdx + 1) + '. adım: ' : '') +
        (ask === 'fwd' ? 'gördüğün sırayla, soldan sağa' : 'son rakamdan başla, geriye doğru git') + '</p></div>' +
        '<div class="paper stem">' + digitsHtml(span.typed, n) + '</div>' + (span.typeTimed ? timeBar() : '') +
        '<div class="numpad">' + keys + '<button type="button" class="key key-del" data-act="span-del" aria-label="Sil"' + (span.typed ? '' : ' disabled') + '>' + I.del + '</button>' +
        '<button type="button" class="key" data-act="span-key" data-d="0">0</button>' +
        '<button type="button" class="key key-ok" data-act="span-ok"' + (full ? '' : ' disabled') + '>Tamam</button></div></div>';
    }
    // sonuç: sayı ve yazılanlar yan yana
    let rows = '<div class="span-row"><span>Sayı</span>' + digitsHtml(span.number, n) + '</div>';
    list.forEach((a, i) => {
      const want = Span.expected(span.number, a), got = span.entries[i], good = got === want;
      rows += '<div class="span-row"><span>' + (a === 'fwd' ? 'Düzden yazdığın' : 'Tersten yazdığın') + (span.late[i] ? ' (süre bitti)' : '') + '</span>' +
        digitsHtml(got, n, got.split('').map((ch, k) => ch === want[k])) + '</div>';
      if (!good) rows += '<div class="span-row"><span>' + (a === 'fwd' ? 'Doğrusu' : 'Tersten doğrusu') + '</span>' + digitsHtml(want, n) + '</div>';
    });
    const nextInfo = g.over ? (g.won ? 'En uzun sayıyı da bildin.' : 'Canların bitti.')
      : span.ok ? 'Sıradaki sayı ' + g.len + ' basamaklı.' : 'Aynı uzunlukta yeni bir sayı gelecek. Kalan can: ' + g.lives + '.';
    return open + '<div class="paper span-result">' + rows + '</div>' +
      '<div class="fb ' + (span.ok ? 'fb-ok' : 'fb-no') + '" role="status">' + robot(span.ok ? 'happy' : 'sad', 'badge') +
      '<div class="fb-msg"><b>' + (span.ok ? rng.pick(PRAISE) : 'Olmadı, bir daha deneyelim.') + '</b>' + nextInfo + '</div>' +
      '<button type="button" class="btn btn-sun" data-act="span-next">' + (g.over ? 'Bitir' : 'Devam') + '</button></div></div>';
  }

  /* ---------- sonuç ---------- */
  function areaBars(items) {
    return '<div class="bars">' + B.AREAS.map((a) => {
      const list = items.filter((it) => B.catById(it.q.type).area === a.id);
      if (!list.length) return '';
      const ok = list.filter((it) => it.chosen === it.q.answer).length;
      return '<div class="bar-row" style="--area: var(--a-' + a.id + ')"><span>' + a.name + '</span><div class="bar"><i style="width:' + pct(ok, list.length) + '%"></i></div><b>' + ok + ' / ' + list.length + '</b></div>';
    }).join('') + '</div>';
  }
  function resultView() {
    const r = ses.result, exam = ses.mode === 'exam', p = r.ok / r.total;
    const title = p >= 0.9 ? 'Harikasın!' : p >= 0.7 ? 'Çok iyi gidiyorsun!' : p >= 0.5 ? 'Güzel çalıştın!' : 'Denemeye devam!';
    let sub;
    if (ses.mode === 'practice') {
      sub = B.catById(ses.cat).name + ' · ' + B.LEVEL_NAMES[ses.level] + (r.stars ? ' · ' + r.stars + ' yıldız kazandın' : ' · Yıldız için soruların en az yarısını doğru yapmalısın');
    } else if (ses.mode === 'daily') {
      sub = 'Günün görevi' + (ses.fixed ? ' (' + B.LEVEL_NAMES[ses.fixed] + ')' : '') + ' tamamlandı. ' + Store.streak() + ' gündür üst üste çalışıyorsun.';
    } else {
      sub = EXAMS[ses.exam].name + ' · ' + (ses.fixed ? B.LEVEL_NAMES[ses.fixed] : 'karışık kademe') + ' · ' + r.blank + ' boş · süre ' + fmtTime(r.sec);
    }
    let html = '<div class="page result">' + robot(p >= 0.5 ? 'happy' : 'idle', 'badge') + '<h1>' + title + '</h1>';
    if (!exam) html += '<div class="big-stars">' + [0, 1, 2].map((i) => star(i < r.stars)).join('') + '</div>';
    html += '<div class="score">' + r.ok + '<small> / ' + r.total + ' doğru</small></div><p class="result-sub">' + sub + '</p>';
    if (ses.mode !== 'practice') html += '<div class="card"><h2>Konulara göre</h2>' + areaBars(ses.items) + '</div>';
    html += '<div class="card"><h2>Sorulara tekrar bak</h2><div class="qchips">' + ses.items.map((it, i) => {
      const cls = it.chosen == null ? 'blank' : it.chosen === it.q.answer ? 'ok' : 'no';
      return '<button type="button" class="qchip ' + cls + '" data-act="review" data-i="' + i + '" aria-label="Soru ' + (i + 1) + '">' + (i + 1) + '</button>';
    }).join('') + '</div></div>';
    html += '<div class="result-actions">';
    if (ses.mode === 'practice' && r.stars >= 2 && ses.level < B.LEVELS.length) {
      html += '<button type="button" class="btn btn-sun" data-act="level-up">Sonraki seviye</button><button type="button" class="btn btn-ghost" data-act="again">Tekrar oyna</button>';
    } else {
      html += '<button type="button" class="btn btn-sun" data-act="again">' + (exam ? 'Yeni deneme' : 'Tekrar oyna') + '</button>';
    }
    return html + '<button type="button" class="btn btn-ghost" data-act="home">Ana sayfa</button></div></div>';
  }

  /* ---------- veli paneli ---------- */
  function parentView() {
    const rows = B.CATS.map((c) => ({ c: c, s: Store.cat(c.id) }));
    const seen = rows.reduce((a, r) => a + r.s.seen, 0), ok = rows.reduce((a, r) => a + r.s.ok, 0), ms = rows.reduce((a, r) => a + r.s.ms, 0);
    const set = Store.data.settings;
    const weak = rows.filter((r) => r.s.seen >= 5 && r.s.ok / r.s.seen < 0.7).sort((a, b) => a.s.ok / a.s.seen - b.s.ok / b.s.seen).slice(0, 3);
    const strong = rows.filter((r) => r.s.seen >= 5 && r.s.ok / r.s.seen >= 0.9);

    const keys = [];
    for (let i = 6; i >= 0; i--) keys.push(U.addDays(U.dayKey(), -i));
    const vals = keys.map((k) => (Store.data.days[k] ? Store.data.days[k].n : 0));
    const max = Math.max(10, Math.max.apply(null, vals));
    const week = '<div class="week">' + keys.map((k, i) => {
      const p = k.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
      return '<div class="week-day"><b>' + vals[i] + '</b><i class="' + (vals[i] ? '' : 'zero') + '" style="height:' + Math.round((vals[i] / max) * 100) + '%"></i><span>' + DAYS[d.getDay()] + '</span></div>';
    }).join('') + '</div>';

    let advice;
    if (seen < 20) advice = '<p class="note">Öneri çıkarmak için henüz yeterli soru çözülmedi. Birkaç gün Günün Görevi oynandıktan sonra burada güçlü ve zayıf konular görünür.</p>';
    else {
      advice = (weak.length
        ? '<p class="note"><b>Önce bunlara çalışın:</b> ' + weak.map((r) => r.c.name + ' (%' + pct(r.s.ok, r.s.seen) + ')').join(', ') + '. Bu konuları Kolay seviyeden başlatıp ipucunu birlikte okuyun.</p>'
        : '<p class="note">Belirgin bir zayıf konu görünmüyor. Orta ve Zor seviyelerle devam edebilirsiniz.</p>') +
        (strong.length ? '<p class="note"><b>Güçlü olduğu konular:</b> ' + strong.map((r) => r.c.name).join(', ') + '.</p>' : '');
    }

    const table = '<div class="table-wrap"><table><thead><tr><th>Konu</th><th class="num">Çözülen</th><th class="num">Doğru</th><th class="num">Ort. süre</th><th>Son cevaplar</th><th class="num">Yıldız</th></tr></thead><tbody>' +
      rows.map((r) => {
        const s = r.s, acc = s.seen ? pct(s.ok, s.seen) : null;
        return '<tr style="--area: var(--a-' + r.c.area + ')"><td><span class="dot"></span>' + r.c.name + '</td><td class="num">' + s.seen + '</td>' +
          '<td class="num">' + (acc == null ? '—' : '<span class="pill ' + (s.seen >= 5 && acc < 70 ? 'weak' : s.seen >= 5 && acc >= 90 ? 'strong' : '') + '">%' + acc + '</span>') + '</td>' +
          '<td class="num">' + (s.seen ? Math.round(s.ms / s.seen / 1000) + ' sn' : '—') + '</td>' +
          '<td><span class="dots">' + s.recent.slice(-10).map((v) => '<i class="' + (v ? '' : 'x') + '"></i>').join('') + '</span></td>' +
          '<td class="num">' + starSum(s) + ' / ' + STAR_MAX + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    const exams = Store.data.exams.slice(-8).reverse();
    const seg = (key, opts, val) => '<span class="seg">' + opts.map((o) =>
      '<button type="button" class="' + (o[0] === val ? 'on' : '') + '" data-act="set" data-key="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + o[1] + '</button>').join('') + '</span>';

    return '<div class="page parent">' +
      '<header class="parent-top"><button type="button" class="icon-btn" data-act="home" aria-label="Ana sayfaya dön">' + I.back + '</button><h1>Veli paneli</h1></header>' +
      '<div class="tiles"><div class="tile"><b>' + seen + '</b><span>çözülen soru</span></div>' +
      '<div class="tile"><b>' + (seen ? '%' + pct(ok, seen) : '—') + '</b><span>doğru cevap oranı</span></div>' +
      '<div class="tile"><b>' + Math.round(ms / 60000) + ' dk</b><span>soru başında geçen süre</span></div>' +
      '<div class="tile"><b>' + Store.streak() + '</b><span>gün üst üste çalışma</span></div></div>' +
      '<div class="card"><h2>Son 7 gün: çözülen soru sayısı</h2>' + week + '</div>' +
      '<div class="card"><h2>Öneriler</h2>' + advice + '</div>' +
      '<div class="card"><h2>Konulara göre durum</h2>' + table + '</div>' +
      '<div class="card"><h2>Deneme sınavları</h2>' + (exams.length
        ? '<div class="table-wrap"><table><thead><tr><th>Tarih</th><th class="num">Soru</th><th class="num">Doğru</th><th class="num">Boş</th><th class="num">Süre</th></tr></thead><tbody>' +
          exams.map((e) => '<tr><td>' + e.date.split('-').reverse().join('.') + '</td><td class="num">' + e.n + '</td><td class="num">' + e.ok + ' (%' + pct(e.ok, e.n) + ')</td><td class="num">' + e.blank + '</td><td class="num">' + fmtTime(e.sec) + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<p class="note">Henüz deneme sınavı çözülmedi.</p>') + '</div>' +
      '<div class="card"><h2>Sayı Hafızası</h2>' +
      '<div class="table-wrap"><table><thead><tr><th>Düzey</th>' + Span.MODES.map((m) => '<th class="num">' + m.short + '</th>').join('') + '</tr></thead><tbody>' +
      Span.LEVELS.map((l) => '<tr><td>' + l.name + '</td>' + Span.MODES.map((m) => { const v = Store.data.span.best[l.id][m.id]; return '<td class="num">' + (v ? v + ' basamak' : '—') + '</td>'; }).join('') + '</tr>').join('') +
      '</tbody></table></div><p class="note">En uzun doğru yazılan sayı. Süre: Kolay basamak sayısının iki katı, Orta basamak sayısı, Zor basamak sayısının üçte ikisi kadar saniye.</p>' +
      '<div class="set-row"><span>Oynanan oyun</span><b>' + Store.data.span.plays + '</b></div></div>' +
      '<div class="card"><h2>Ayarlar</h2>' +
      '<div class="set-row"><span>Ses efektleri</span>' + seg('sound', [[true, 'Açık'], [false, 'Kapalı']], set.sound) + '</div>' +
      '<div class="set-row"><span>Sayı Hafızası\'nda yazarken süre</span>' + seg('spanTypeTimed', [[true, 'Süreli'], [false, 'Süresiz']], set.spanTypeTimed !== false) + '</div>' +
      '<div class="set-row"><span>Alıştırmadaki soru sayısı</span>' + seg('len', [[5, '5'], [10, '10'], [15, '15']], set.len) + '</div>' +
      '<div class="set-row"><span>Bütün ilerlemeyi sil</span><button type="button" class="btn btn-ghost btn-sm" data-act="reset-ask">Sıfırla</button></div></div>' +
      '<div class="card"><h2>Sınav hakkında</h2>' +
      '<p class="note">BİLSEM genel zihinsel yetenek ön değerlendirmesi tablet üzerinde yapılır. Soru sayısı ve süre her yıl MEB kılavuzunda duyurulur; deneme uzunluğunu o yılın kılavuzuna göre seçin.</p>' +
      '<p class="note">Buradaki sorular çıkmış sınav sorusu değildir. Aynı beceri alanlarında her seferinde yeniden üretilen alıştırmalardır; bu yüzden ezberlenemez.</p>' +
      '<p class="note">İlerleme yalnızca bu cihazdaki tarayıcıda saklanır.</p></div></div>';
  }

  /* ---------- pencereler ---------- */
  function sheetView() {
    if (!sheet) return '';
    let body = '', wide = false;
    if (sheet.kind === 'cat') {
      const c = B.catById(sheet.id), st = Store.cat(c.id), rec = Store.workLevel(c.id);
      body = '<div class="sheet-head"><span class="cat-ico">' + icon(c.id) + '</span><div><h2>' + c.name + '</h2><p>' + c.desc + '</p></div>' + closeBtn + '</div>' +
        '<p class="tip"><b>İpucu:</b> ' + c.tip + '</p><div class="levels">' +
        B.LEVELS.map((lv) => '<button type="button" class="level' + (lv === rec ? ' rec' : '') + '" data-act="start" data-id="' + c.id + '" data-level="' + lv + '"><span>' +
          B.LEVEL_NAMES[lv] + (lv === rec ? '<small>Sana uygun seviye</small>' : '') + '</span>' + starsRow(st.stars[lv - 1]) + '</button>').join('') +
        '</div><p class="note">' + Store.data.settings.len + ' soruluk alıştırma. Soruların çoğunu doğru yaparsan yıldız kazanırsın.</p>';
    } else if (sheet.kind === 'daily') {
      body = '<div class="sheet-head"><span class="cat-ico">' + robot('happy') + '</span><div><h2>Günün Görevi</h2><p>Her konudan karışık 10 soru. Hangi kademede olsun?</p></div>' + closeBtn + '</div><div class="levels">' +
        '<button type="button" class="level rec" data-act="daily-go" data-level="0"><span>Bana uygun<small>Her konuda kendi kademen</small></span></button>' +
        B.LEVELS.map((lv) => '<button type="button" class="level" data-act="daily-go" data-level="' + lv + '"><span>' + B.LEVEL_NAMES[lv] + '</span></button>').join('') + '</div>';
    } else if (sheet.kind === 'exam') {
      const lv = sheet.level || 0;
      body = '<div class="sheet-head"><div><h2>Deneme Sınavı</h2><p>Bütün konulardan sorular. Önce kademeyi, sonra uzunluğu seç.</p></div>' + closeBtn + '</div>' +
        '<div class="set-row"><span>Kademe</span><span class="seg">' + [0].concat(B.LEVELS).map((l) =>
          '<button type="button" class="' + (l === lv ? 'on' : '') + '" data-act="exam-level" data-level="' + l + '" aria-pressed="' + (l === lv) + '">' + (l ? B.LEVEL_NAMES[l] : 'Karışık') + '</button>').join('') + '</span></div>' +
        '<p class="tip">' + (lv ? 'Bütün sorular <b>' + B.LEVEL_NAMES[lv] + '</b> kademesinden gelir.' : '<b>Karışık:</b> sorular kolaydan en zora doğru sıralanır.') + '</p><div class="levels">' +
        EXAMS.map((e, i) => '<button type="button" class="level" data-act="exam" data-i="' + i + '"><span>' + e.name + '<small>' + e.n + ' soru · ' + e.min + ' dakika</small></span></button>').join('') +
        '</div><p class="note">Sınav sırasında doğru cevap gösterilmez. İstediğin soruya geri dönüp cevabını değiştirebilirsin.</p>';
    } else if (sheet.kind === 'span') {
      const set = Store.data.settings, st = set.spanStart, lv = Span.levelOf(set.spanLevel), rec = Store.data.span.best[lv.id], sec = fmtSec(Span.seconds(st, lv.id)), timed = set.spanTypeTimed !== false;
      body = '<div class="sheet-head"><span class="cat-ico">' + I.span + '</span><div><h2>Sayı Hafızası</h2><p>Sayı bir süre görünür ve kapanır. Sonra süre bitmeden klavyeyle yazarsın.</p></div>' + closeBtn + '</div>' +
        '<div class="set-row"><span>Düzey</span><span class="seg">' + Span.LEVELS.map((l) =>
          '<button type="button" class="' + (l.id === lv.id ? 'on' : '') + '" data-act="span-level" data-level="' + l.id + '" aria-pressed="' + (l.id === lv.id) + '">' + l.name + '</button>').join('') + '</span></div>' +
        '<div class="set-row"><span>İlk sayı kaç basamaklı olsun?</span><span class="stepper">' +
        '<button type="button" class="icon-btn" data-act="span-len" data-d="-1" aria-label="Azalt"' + (st <= Span.MIN ? ' disabled' : '') + '>−</button><b>' + st + '</b>' +
        '<button type="button" class="icon-btn" data-act="span-len" data-d="1" aria-label="Artır"' + (st >= Span.MAX ? ' disabled' : '') + '>+</button></span></div>' +
                '<p class="tip"><b>' + lv.name + ':</b> ' + lv.text + ' ' + st + ' basamaklı sayı ' + sec + ' saniye görünür; ' +
        (timed ? 'her yazım için de ' + sec + ' saniye verilir.' : 'yazarken süre yoktur, istediğin kadar düşünebilirsin.') + '</p>' +
        '<div class="levels">' + Span.MODES.map((m) => '<button type="button" class="level' + (m.id === 'both' ? ' rec' : '') + '" data-act="span-go" data-mode="' + m.id + '"><span>' + m.name +
          '<small>' + (rec[m.id] ? lv.name + ' rekoru: ' + rec[m.id] + ' basamak' : lv.name + ' düzeyde henüz oynanmadı') + '</small></span></button>').join('') + '</div>' +
        '<p class="note">Doğru yazınca sayı bir basamak uzar, en çok ' + Span.MAX + ' basamak.' + (timed ? ' Süre bitince o ana kadar yazdığın sayılır.' : '') + ' Üç yanlışta oyun biter.</p>';
    } else if (sheet.kind === 'pin') {
      body = '<div class="sheet-head"><div><h2>Veli paneli</h2><p>Devam etmek için veli şifresini yaz.</p></div>' + closeBtn + '</div>' +
        '<form class="pin-form" data-form="pin" autocomplete="off">' +
        '<input id="pin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" aria-label="Veli şifresi"' + (sheet.wrong ? ' aria-invalid="true"' : '') + '>' +
        (sheet.wrong ? '<p class="pin-err" role="alert">Şifre yanlış. Tekrar dene.</p>' : '') +
        '<div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="close">Vazgeç</button><button type="submit" class="btn btn-sun">Giriş</button></div></form>';
    } else if (sheet.kind === 'quit') {
      body = '<div class="sheet-head"><div><h2>Çıkmak istiyor musun?</h2><p>' +
        (view === 'span' ? 'Oyundan çıkarsan bu oyun biter. Ulaştığın rekor kaydedildi.' : ses.mode === 'exam' ? 'Sınavdan çıkarsan cevapların kaydedilmez.' : 'Şimdiye kadar çözdüğün sorular kaydedildi. Yıldız kazanmak için alıştırmayı bitirmelisin.') +
        '</p></div></div><div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="home">Çık</button><button type="button" class="btn btn-sun" data-act="close">Devam et</button></div>';
    } else if (sheet.kind === 'finish') {
      const blank = ses.items.filter((it) => it.chosen == null).length;
      body = '<div class="sheet-head"><div><h2>Sınavı bitirelim mi?</h2><p>' + (blank ? blank + ' soru boş kaldı. Geri dönüp cevaplayabilirsin.' : 'Bütün soruları cevapladın.') +
        '</p></div></div><div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="close">Geri dön</button><button type="button" class="btn btn-sun" data-act="finish">Bitir</button></div>';
    } else if (sheet.kind === 'reset') {
      body = '<div class="sheet-head"><div><h2>İlerleme silinsin mi?</h2><p>Bütün yıldızlar, gün serisi ve istatistikler silinir. Bu işlem geri alınamaz.</p></div></div>' +
        '<div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="close">Vazgeç</button><button type="button" class="btn btn-bad" data-act="reset">Sil</button></div>';
    } else if (sheet.kind === 'review') {
      wide = true;
      const i = sheet.i, it = ses.items[i], q = it.q, cat = B.catById(q.type);
      const state = it.chosen == null ? 'Boş bırakıldı.' : it.chosen === q.answer ? 'Doğru cevapladın.' : 'Yanlış cevapladın.';
      body = '<div class="sheet-head"><div><h2>Soru ' + (i + 1) + '</h2><p>' + cat.name + ' · ' + B.LEVEL_NAMES[q.level] + '</p></div>' + closeBtn + '</div>' +
        (q.promptBelow ? '' : '<p class="rv-prompt">' + q.prompt + '</p>') +
        (q.memo ? '<div class="paper stem">' + q.memo.html + '</div>' : '') +
        (q.stem ? '<div class="paper stem">' + q.stem + '</div>' : '') +
        (q.promptBelow ? '<p class="rv-prompt">' + q.prompt + '</p>' : '') +
        optsHtml(q, it, 'done') +
        '<p class="tip"><b>' + state + '</b> Doğru cevap ' + LETTERS[q.answer] + ' şıkkı. ' + q.explain + '</p>' +
        '<div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="review" data-i="' + (i - 1) + '"' + (i === 0 ? ' disabled' : '') + '>Önceki soru</button>' +
        '<button type="button" class="btn btn-ghost" data-act="review" data-i="' + (i + 1) + '"' + (i === ses.items.length - 1 ? ' disabled' : '') + '>Sonraki soru</button></div>';
    }
    return '<div class="scrim"><div class="sheet' + (wide ? ' sheet-wide' : '') + '" role="dialog" aria-modal="true">' + body + '</div></div>';
  }

  function render() {
    const html = view === 'quiz' ? quizView() : view === 'result' ? resultView() : view === 'parent' ? parentView() : view === 'span' ? spanView() : homeView();
    app.innerHTML = S.defs() + html + sheetView();
  }

  /* ---------- olaylar ---------- */
  const actions = {
    home() { stopTimers(); ses = null; span = null; sheet = null; view = 'home'; render(); window.scrollTo(0, 0); },
    'span-pick'() { sheet = { kind: 'span' }; render(); },
    'span-go'(el) { spanStart(el.dataset.mode); },
    'span-len'(el) {
      const set = Store.data.settings;
      set.spanStart = Math.max(Span.MIN, Math.min(Span.MAX, set.spanStart + Number(el.dataset.d)));
      Store.save();
      render();
    },
    'span-level'(el) { Store.data.settings.spanLevel = Number(el.dataset.level); Store.save(); render(); },
    'span-key'(el) { spanKey(el.dataset.d); },
    'span-del': spanDel,
    'span-ok': spanOk,
    'span-next': spanNext,
    'span-again'() { sheet = { kind: 'span' }; render(); },
    parent() {
      sheet = { kind: 'pin', wrong: false }; render();
      const inp = app.querySelector('#pin'); if (inp) inp.focus();
    },
    cat(el) { sheet = { kind: 'cat', id: el.dataset.id }; render(); },
    'exam-pick'() { sheet = { kind: 'exam', level: 0 }; render(); },
    'exam-level'(el) { sheet.level = Number(el.dataset.level); render(); },
    'daily-go'(el) { startDaily(Number(el.dataset.level)); },
    close() { sheet = null; render(); },
    start(el) { startPractice(el.dataset.id, Number(el.dataset.level)); },
    daily() { if (Store.dailyDone()) { sheet = { kind: 'daily' }; render(); } else startDaily(0); },   // ilk oyun tek dokunuş; tekrarında kademe sorulur
    exam(el) { startExam(Number(el.dataset.i), sheet.level || 0); },
    pick(el) { pick(Number(el.dataset.i)); },
    next: next,
    prev: prev,
    'memo-done': memoDone,
    quit() { sheet = { kind: 'quit' }; render(); },
    'finish-ask'() { sheet = { kind: 'finish' }; render(); },
    finish() { finish(); },
    review(el) { sheet = { kind: 'review', i: Number(el.dataset.i) }; render(); },
    again() {
      sheet = ses.mode === 'practice' ? { kind: 'cat', id: ses.cat } : ses.mode === 'daily' ? { kind: 'daily' } : { kind: 'exam', level: ses.fixed || 0 };
      render();
    },
    'level-up'() { startPractice(ses.cat, ses.level + 1); },
    speak() { const q = cur().q; speak(q.speech || q.prompt); },
    set(el) {
      const v = el.dataset.val;
      Store.data.settings[el.dataset.key] = v === 'true' || v === 'false' ? v === 'true' : Number(v);
      Store.save();
      render();
    },
    'reset-ask'() { sheet = { kind: 'reset' }; render(); },
    reset() { Store.reset(); sheet = null; render(); },
  };

  app.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('scrim')) {
      if (sheet && sheet.kind !== 'finish') { sheet = null; render(); }
      return;
    }
    const el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });

  /* Veli şifresi: yalnızca çocuğun ayarları kazara değiştirmesini önlemek için; gerçek bir güvenlik önlemi değildir. */
  const PARENT_PIN = '321321';
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f || f.dataset.form !== 'pin') return;
    e.preventDefault();
    if (f.querySelector('#pin').value.trim() === PARENT_PIN) { sheet = null; view = 'parent'; render(); window.scrollTo(0, 0); return; }
    sheet = { kind: 'pin', wrong: true }; render();
    const inp = app.querySelector('#pin'); if (inp) inp.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet) { sheet = null; render(); return; }
    if (sheet || e.ctrlKey || e.metaKey || e.altKey) return;
    if (view === 'span' && span) {
      // sayı hafızası: rakamlar, Geri tuşu ve Enter
      if (/^[0-9]$/.test(e.key)) spanKey(e.key);
      else if (e.key === 'Backspace') { e.preventDefault(); spanDel(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (span.phase === 'type') spanOk(); else spanNext(); }
      return;
    }
    if (view !== 'quiz') return;
    const k = e.key.toLowerCase();
    const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    if (k.length === 1 && i >= 0) { pick(i); return; }
    if (e.key === 'Enter' && document.activeElement === document.body) next();
  });

  if ('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined') {
    findVoice();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', findVoice);
  }

  Store.load();
  render();

  // otomatik denetimler için
  window.BilsemApp = { startPractice: startPractice, startDaily: startDaily, startExam: startExam, startSpan: spanStart, state: () => ({ view: view, ses: ses, span: span, sheet: sheet }) };
})();
