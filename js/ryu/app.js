/* Ryu'nun Kod Macerası — sürükle-bırak arayüzü, kod düzenleyici ve oyun akışı.
 * Bkz. CONTRACT.md. Program iki dizi olarak tutulur: ana program ve kombo
 * serisi. DOM her değişiklikte bu dizilerden yeniden çizilir. Kod modunda
 * aynı program Türkçe komutlarla metin olarak düzenlenir (CodeGame.Ryu.Code).
 * Sürükleme Pointer Events ile yapılır (fare + dokunmatik).
 */
(function (root) {
  'use strict';
  const CodeGame = root.CodeGame = root.CodeGame || {};
  const Ryu = CodeGame.Ryu = CodeGame.Ryu || {};
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = CodeGame;
    return;
  }

  // ---------------- sabitler ----------------
  const KEY_PROGRESS = 'ryu.v1.progress';
  const KEY_PROGRAM = 'ryu.v1.program.';
  const KEY_CODE = 'ryu.v1.code.';
  const KEY_LEVEL = 'ryu.v1.level';
  const KEY_SPEED = 'ryu.speed';
  const KEY_MODE = 'ryu.mode';
  const SPEEDS = { slow: 430, fast: 210 };
  const LOOP_MIN = 2;
  const LOOP_MAX = 9;
  const COMBO_MAX = 4;
  const UNLOCK_ALL = true;   // test için bütün bölümler açık; normal oyunda false yap
  const MAX_STEPS = 400;
  const K = 'k';
  const INFO = {
    forward: { name: 'İleri', icon: 'i-forward', desc: 'Bir kare ileri yürür.' },
    back: { name: 'Geri', icon: 'i-back', desc: 'Bir kare geri yürür.' },
    jump: { name: 'Zıpla', icon: 'i-jump', desc: '2 kare yükselir, 2 kare ileri gider. Düşmanın üstüne düşerse onu ezer, soru kutusuna alttan kafa atar.' },
    punch: { name: 'Yumruk', icon: 'i-punch', desc: 'Hemen önündeki kutuyu kırar ya da düşmana vurur.' },
    hadoken: { name: 'Hadoken', icon: 'i-hadoken', desc: 'Ateş topu fırlatır: önündeki ilk düşmana vurur ya da ilk kutuyu kırar. Kirpiyi yalnızca o yener.' },
    shoryuken: { name: 'Shoryuken', icon: 'i-shoryuken', desc: 'Yumruğu havada 3 kare yükselir, 1 kare ileri iner. Yüksek soru kutularını açar, kutuları kırar, yarasaları yener.' },
    tatsumaki: { name: 'Tatsumaki', icon: 'i-tatsumaki', desc: 'Tatsumaki Senpukyaku: dönerek 3 kare ileri uçar. Yoldaki düşmanlara vurur, kutuları kırar, geniş çukurları geçer.' },
    loop: { name: 'Tekrarla', icon: 'i-loop', desc: 'İçine koyduğun blokları 2–9 kez tekrarlar. Sayıya tıkla: artır, sağ tık: azalt.' },
    combo: { name: 'Kombo', icon: 'i-combo', desc: 'Kombo serisine dizdiğin blokları (en fazla 4) çalıştırır; aynı seriyi tekrar tekrar kullanmak için. Kodda seriyi fonksiyon kombo() { … } ile yazarsın.' }
  };
  const MOVE_WORDS = ['ileri', 'geri', 'zıpla', 'zipla'];
  const HIT_WORDS = ['yumruk', 'hadoken', 'shoryuken', 'tatsumaki', 'tatsumaki_senpukyaku'];
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------------- depolama (hep try/catch) ----------------
  const store = {
    get(key, fallback) {
      try {
        const v = root.localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* yoksay */ }
    }
  };

  // ---------------- durum ----------------
  const S = {
    levels: Array.isArray(Ryu.LEVELS) ? Ryu.LEVELS : [],
    index: 0,
    level: null,
    program: [],
    combo: [],
    world: null,
    renderer: null,
    running: false,
    runId: 0,
    dirty: false,          // Ryu başlangıçtan ayrıldı mı
    speed: 'slow',
    mode: 'blocks',
    code: '',
    codeError: null,
    progress: {},
    pathMap: new Map(),
    justAdded: null,
    clearArmed: 0,
    history: [],           // Geri al için önceki programlar (JSON)
    firstSeen: {}          // araç -> ilk göründüğü bölüm sırası
  };
  let els = {};

  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------- yardımcılar ----------------
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id, cls) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVGNS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }
  function starsEl(n, cls) {
    const wrap = el('span', cls || 'stars');
    for (let i = 0; i < 3; i++) wrap.appendChild(icon('i-star', i < n ? 'star-on' : 'star-off'));
    wrap.setAttribute('aria-label', n + ' yıldız');
    return wrap;
  }
  function flash(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth; // animasyonu yeniden başlat
    node.classList.add(cls);
    const done = () => { node.classList.remove(cls); node.removeEventListener('animationend', done); };
    node.addEventListener('animationend', done);
    setTimeout(done, 700);
  }
  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  const pathKey = (p) => p.join('.');
  const parsePath = (s) => (s == null || s === '' ? [] : String(s).split('.').map((v) => (v === K ? K : Number(v))));
  const inCombo = (p) => p[0] === K;

  const hasCombo = () => !!S.level && (S.level.tools || []).indexOf('combo') !== -1;
  function count(list) { return Ryu.Blocks.count(list || []); }
  function countBlocks() { return count(S.program) + (hasCombo() ? count(S.combo) : 0); }
  function newBlock(type) {
    return type === 'loop' ? { type: 'loop', count: LOOP_MIN, body: [] } : { type };
  }
  function nodeIn(program, combo, path) {
    let arr = inCombo(path) ? combo : program;
    let node = null;
    for (let i = inCombo(path) ? 1 : 0; i < path.length; i++) {
      node = arr && arr[path[i]];
      if (!node) return null;
      arr = node.body;
    }
    return node;
  }
  const nodeAt = (path) => nodeIn(S.program, S.combo, path);
  function arrayFor(zonePath) {
    if (!zonePath.length) return S.program;
    if (zonePath.length === 1 && zonePath[0] === K) return S.combo;
    const n = nodeAt(zonePath);
    if (!n || n.type !== 'loop') return null;
    if (!Array.isArray(n.body)) n.body = [];
    return n.body;
  }
  function removeAt(path) {
    const parent = arrayFor(path.slice(0, -1));
    return parent ? parent.splice(path[path.length - 1], 1)[0] : null;
  }
  const isFull = () => countBlocks() >= S.level.maxBlocks;

  /** Kayıtlı programı temizler: yalnızca bu bölümün blokları, geçerli sayılar. */
  function sanitize(list, tools, depth, noCombo) {
    if (!Array.isArray(list) || depth > 8) return [];
    const out = [];
    for (const b of list) {
      if (!b || typeof b !== 'object' || tools.indexOf(b.type) === -1 || !INFO[b.type]) continue;
      if (noCombo && b.type === 'combo') continue;
      if (b.type === 'loop') {
        let c = Math.round(Number(b.count));
        if (!isFinite(c)) c = LOOP_MIN;
        c = Math.max(LOOP_MIN, Math.min(LOOP_MAX, c));
        out.push({ type: 'loop', count: c, body: sanitize(b.body, tools, depth + 1, noCombo) });
      } else {
        out.push({ type: b.type });
      }
    }
    return out;
  }
  function loadProgram(level) {
    const raw = store.get(KEY_PROGRAM + level.id, null) || {};
    const tools = level.tools || [];
    const program = sanitize(raw.program, tools, 0, false);
    let combo = tools.indexOf('combo') !== -1 ? sanitize(raw.combo, tools, 0, true) : [];
    if (count(combo) > COMBO_MAX) combo = [];
    if (count(program) + count(combo) > level.maxBlocks) return { program: [], combo: [] };
    return { program, combo };
  }
  function saveProgram() {
    store.set(KEY_PROGRAM + S.level.id, { program: S.program, combo: S.combo });
  }

  function starsFor(id) {
    const v = S.progress[id];
    return typeof v === 'number' && v > 0 ? Math.min(3, Math.floor(v)) : 0;
  }
  function isUnlocked(i) {
    if (i <= 0 || UNLOCK_ALL) return true;
    const lv = S.levels[i];
    return !!lv && (starsFor(S.levels[i - 1].id) > 0 || starsFor(lv.id) > 0);
  }

  // ---------------- mesaj balonu ----------------
  let bubbleTimer = 0;
  function say(text, kind, ms) {
    clearTimeout(bubbleTimer);
    const b = els.bubble;
    b.className = 'bubble' + (kind ? ' ' + kind : '');
    b.textContent = text;
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    if (ms) bubbleTimer = setTimeout(hideBubble, ms);
  }
  function hideBubble() { clearTimeout(bubbleTimer); els.bubble.hidden = true; }

  // ---------------- çizim: başlık, görev, palet, program ----------------
  function renderHeader() {
    els.levelNum.textContent = 'Bölüm ' + (S.index + 1);
    const fresh = starsEl(starsFor(S.level.id));
    fresh.id = 'levelStars';
    els.levelStars.replaceWith(fresh);
    els.levelStars = fresh;
  }

  function renderTask() {
    els.levelTitle.textContent = S.level.title || ('Bölüm ' + (S.index + 1));
    els.levelDesc.textContent = S.level.description || '';
    els.parText.textContent = S.level.par + ' blok';
    els.parChip.title = '3 yıldız için en fazla ' + S.level.par + ' blok';
    const need = S.level.needCombo || 0;
    els.comboChip.hidden = !need;
    if (need) {
      els.comboText.textContent = need + "'lü kombo";
      els.comboChip.title = 'Art arda en az ' + need + ' vuruş yapmalısın';
      els.comboChip.classList.remove('done');
    }
    document.title = 'Ryu Kod Macerası · Bölüm ' + (S.index + 1);
  }

  function updateCoinChip() {
    const w = S.world;
    const total = w ? w.totalCoins : 0;
    els.coinChip.hidden = !total;
    if (!total) return;
    els.coinText.textContent = w.collected + '/' + total;
    els.coinChip.classList.toggle('done', w.collected >= total);
  }
  function updateComboChip() {
    const need = S.level.needCombo || 0;
    if (need && S.world) els.comboChip.classList.toggle('done', S.world.maxCombo >= need);
  }

  function blockEl(type, extraCls) {
    const info = INFO[type];
    const blk = el('div', 'blk blk-' + type + (extraCls ? ' ' + extraCls : ''));
    blk.appendChild(icon(info ? info.icon : 'i-forward'));
    if (type !== 'loop') blk.appendChild(el('span', 'blk-name', info ? info.name : type));
    return blk;
  }

  function renderPalette() {
    els.palette.textContent = '';
    const code = S.mode === 'code';
    els.palette.classList.toggle('code-mode', code);
    els.paletteHint.textContent = code ? 'Dokun: koda ekle' : 'Sürükle ya da dokun';
    for (const t of S.level.tools || []) {
      const info = INFO[t];
      if (!info) continue;
      const item = el('button', 'pal-item');
      item.type = 'button';
      item.dataset.type = t;
      item.title = info.name + ': ' + info.desc;
      item.setAttribute('aria-label', info.name + (code ? ' komutunu koda ekle' : ' bloğu ekle'));
      const blk = blockEl(t);
      if (t === 'loop') blk.appendChild(el('span', 'pal-badge', '×' + LOOP_MIN));
      item.appendChild(blk);
      if (S.firstSeen[t] === S.index && S.index > 0) item.appendChild(el('span', 'new-badge', 'YENİ'));
      item.appendChild(el('span', code ? 'pal-code' : 'pal-label', code ? codeSnippet(t).split('\n')[0].replace(' {', '') : (t === 'loop' ? info.name : '')));
      els.palette.appendChild(item);
    }
  }

  function buildBlock(b, path) {
    let node;
    if (b.type === 'loop') {
      node = el('div', 'blk blk-loop blk-container');
      node.setAttribute('aria-label', 'Tekrarla, ' + b.count + ' kez');
      const head = el('div', 'loop-head');
      head.appendChild(icon(INFO.loop.icon));
      const badge = el('button', 'loop-count', '×' + b.count);
      badge.type = 'button';
      badge.title = 'Tıkla: artır · Sağ tık: azalt';
      badge.setAttribute('aria-label', b.count + ' kez. Değiştirmek için dokun.');
      badge.disabled = S.running;
      head.appendChild(badge);
      const body = el('div', 'loop-body drop-zone');
      body.dataset.zone = pathKey(path);
      body.setAttribute('role', 'list');
      const kids = Array.isArray(b.body) ? b.body : [];
      kids.forEach((c, j) => body.appendChild(buildBlock(c, path.concat(j))));
      if (!kids.length) body.classList.add('is-empty');
      node.appendChild(head);
      node.appendChild(body);
    } else {
      node = blockEl(b.type);
      node.setAttribute('aria-label', INFO[b.type] ? INFO[b.type].name : b.type);
    }
    node.dataset.path = pathKey(path);
    node.tabIndex = 0;
    node.setAttribute('role', 'listitem');
    if (b === S.justAdded) node.classList.add('pop-in');
    S.pathMap.set(pathKey(path), node);
    return node;
  }

  function renderProgram() {
    const rootEl = els.programRoot;
    rootEl.textContent = '';
    S.pathMap = new Map();
    S.program.forEach((b, i) => rootEl.appendChild(buildBlock(b, [i])));
    const free = Math.max(0, S.level.maxBlocks - countBlocks());
    for (let i = 0; i < Math.min(free, 12); i++) {
      const s = el('div', 'slot');
      s.setAttribute('aria-hidden', 'true');
      rootEl.appendChild(s);
    }
    const empty = S.program.length === 0;
    rootEl.classList.toggle('is-empty', empty);
    if (empty) rootEl.appendChild(el('p', 'empty-hint', 'Blokları buraya sürükle'));
    els.palette.classList.toggle('hint', empty && S.mode === 'blocks');
    els.programTip.hidden = empty;

    els.comboDef.hidden = !hasCombo();
    if (hasCombo()) {
      const cr = els.comboRoot;
      cr.textContent = '';
      S.combo.forEach((b, i) => cr.appendChild(buildBlock(b, [K, i])));
      const used = count(S.combo);
      for (let i = 0; i < Math.min(COMBO_MAX - used, free); i++) {
        const s = el('div', 'slot');
        s.setAttribute('aria-hidden', 'true');
        cr.appendChild(s);
      }
      cr.classList.toggle('is-empty', !S.combo.length);
      els.comboHint.textContent = used + ' / ' + COMBO_MAX + ' blok';
    }
    S.justAdded = null;
    updateCounter();
    updateUndo();
  }

  function updateCounter(used) {
    if (used == null) used = countBlocks();
    const max = S.level.maxBlocks;
    els.counter.textContent = used + ' / ' + max;
    els.counter.classList.toggle('full', used === max);
    els.counter.classList.toggle('over', used > max);
    els.counter.setAttribute('aria-label', max + ' bloktan ' + used + ' tanesi kullanıldı');
  }

  // ---------------- geri al ----------------
  function remember() {
    S.history.push(JSON.stringify({ program: S.program, combo: S.combo }));
    if (S.history.length > 60) S.history.shift();
  }
  function updateUndo() { els.btnUndo.disabled = S.running || !S.history.length; }
  function undo() {
    if (S.running || !S.history.length || S.mode !== 'blocks') return;
    const prev = JSON.parse(S.history.pop());
    const tools = S.level.tools || [];
    S.program = sanitize(prev.program, tools, 0, false);
    S.combo = sanitize(prev.combo, tools, 0, true);
    programChanged();
  }

  function poofAt(node) {
    if (!node || reducedMotion()) return;
    const r = node.getBoundingClientRect();
    const g = el('div', 'ghost poof');
    g.setAttribute('aria-hidden', 'true');
    const clone = node.cloneNode(true);
    clone.classList.remove('running', 'error', 'active-loop', 'pop-in', 'calling');
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    g.appendChild(clone);
    g.style.transform = 'translate3d(' + r.left + 'px,' + r.top + 'px,0)';
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 280);
  }

  function deleteBlock(path, node) {
    if (S.running || !nodeAt(path)) return;
    poofAt(node);
    remember();
    removeAt(path);
    programChanged();
    flash(els.btnUndo, 'bump');
  }

  // ---------------- program değişiklikleri ----------------
  function programChanged() {
    saveProgram();
    S.code = '';
    store.set(KEY_CODE + S.level.id, '');
    renderProgram();
    disarmClear();
    if (S.dirty) resetWorld(true);
    hideBubble();
  }

  function refuseFull() {
    flash(els.counter, 'shake');
    flash(els.programPanel, 'shake');
    say('Yer kalmadı! En fazla ' + S.level.maxBlocks + ' blok.', 'hint', 2600);
  }
  function refuseCombo(msg) {
    flash(els.comboDef, 'shake');
    say(msg, 'hint', 2600);
  }

  function appendBlock(type) {
    if (S.running) return;
    if (S.mode === 'code') { insertCode(type); return; }
    if (isFull()) { refuseFull(); return; }
    const b = newBlock(type);
    remember();
    S.program.push(b);
    S.justAdded = b;
    programChanged();
    const node = S.pathMap.get(String(S.program.length - 1));
    if (node) ensureVisible(node);
  }

  /** Sol tık sayıyı artırır (9'dan sonra 2), sağ tık azaltır (2'den sonra 9). */
  function cycleLoop(badge, step) {
    if (S.running) return;
    const host = badge.closest('.blk-loop');
    const node = host && nodeAt(parsePath(host.dataset.path));
    if (!node) return;
    remember();
    updateUndo();
    if (step < 0) node.count = node.count <= LOOP_MIN ? LOOP_MAX : node.count - 1;
    else node.count = node.count >= LOOP_MAX ? LOOP_MIN : node.count + 1;
    badge.textContent = '×' + node.count;
    badge.setAttribute('aria-label', node.count + ' kez. Değiştirmek için dokun.');
    host.setAttribute('aria-label', 'Tekrarla, ' + node.count + ' kez');
    flash(badge, 'bump');
    saveProgram();
    S.code = '';
    if (S.dirty) resetWorld(true);
    hideBubble();
  }

  // ---------------- sürükle-bırak ----------------
  const D = { id: null, src: null, sx: 0, sy: 0, started: false, ghost: null, offX: 0, offY: 0, zone: null, ptype: 'mouse' };
  const programZones = () => [els.programRoot, els.comboRoot];
  const inEditor = (n) => els.programRoot.contains(n) || els.comboRoot.contains(n);

  function onPointerDown(e) {
    if (D.id !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.loop-count')) return; // sayı rozeti: tıklama ile değişir
    const pal = e.target.closest('.pal-item');
    const blk = e.target.closest('.blk');
    let src = null;
    if (pal && els.palette.contains(pal)) {
      src = { kind: 'palette', type: pal.dataset.type, el: pal.querySelector('.blk'), host: pal };
    } else if (blk && inEditor(blk) && S.mode === 'blocks') {
      // Dokununca silme: döngüde yalnızca başlık kısmı siler, gövdenin boşluğu silmez.
      const tapDelete = !blk.classList.contains('blk-loop') || !!e.target.closest('.loop-head');
      src = { kind: 'program', path: parsePath(blk.dataset.path), el: blk, host: blk, tapDelete };
    }
    if (!src) return;
    if (S.running) { e.preventDefault(); return; }
    if (src.kind === 'palette' && S.mode === 'code') return; // kod modunda yalnızca tıklama
    e.preventDefault();
    D.id = e.pointerId;
    D.src = src;
    D.sx = e.clientX;
    D.sy = e.clientY;
    D.started = false;
    D.ptype = e.pointerType || 'mouse';
    try { src.host.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
  }

  function onPointerMove(e) {
    if (e.pointerId !== D.id) return;
    if (!D.started) {
      const dist = Math.hypot(e.clientX - D.sx, e.clientY - D.sy);
      if (dist < (D.ptype === 'mouse' ? 5 : 8)) return;
      startDrag();
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (e.pointerId !== D.id) return;
    const src = D.src;
    if (D.started) endDrag(e.clientX, e.clientY);
    else if (src.kind === 'palette') appendBlock(src.type);
    else if (src.tapDelete) { const path = src.path, node = src.el; resetDrag(); deleteBlock(path, node); return; }
    else flash(src.el, 'wiggle');
    resetDrag();
  }

  function onPointerCancel(e) {
    if (e.pointerId !== D.id) return;
    if (D.started) { clearTargetUI(); dropGhost('fade'); }
    resetDrag();
  }

  function resetDrag() {
    if (D.src && D.src.host) {
      try { D.src.host.releasePointerCapture(D.id); } catch (err) { /* yoksay */ }
    }
    if (D.src && D.src.el) D.src.el.classList.remove('drag-src');
    document.body.classList.remove('is-dragging');
    els.palettePanel.classList.remove('trash-mode', 'trash-hot');
    D.id = null;
    D.src = null;
    D.started = false;
    D.zone = null;
  }

  function startDrag() {
    D.started = true;
    const src = D.src;
    const r = src.el.getBoundingClientRect();
    D.offX = Math.max(0, Math.min(r.width, D.sx - r.left));
    D.offY = Math.max(0, Math.min(r.height, D.sy - r.top));
    const ghost = el('div', 'ghost');
    ghost.setAttribute('aria-hidden', 'true');
    const clone = src.el.cloneNode(true);
    clone.classList.remove('running', 'error', 'active-loop', 'drag-src', 'pop-in', 'wiggle', 'calling');
    clone.removeAttribute('data-path');
    clone.removeAttribute('tabindex');
    clone.querySelectorAll('[data-path],[data-zone],.drop-zone,[tabindex]').forEach((n) => {
      n.removeAttribute('data-path');
      n.removeAttribute('data-zone');
      n.removeAttribute('tabindex');
      n.classList.remove('drop-zone', 'running', 'error', 'active-loop');
    });
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    ghost.appendChild(clone);
    document.body.appendChild(ghost);
    D.ghost = ghost;
    if (src.kind === 'program') {
      src.el.classList.add('drag-src');
      els.palettePanel.classList.add('trash-mode');
    }
    document.body.classList.add('is-dragging');
    hideBubble();
  }

  function moveDrag(x, y) {
    if (D.ghost) D.ghost.style.transform = 'translate3d(' + (x - D.offX) + 'px,' + (y - D.offY) + 'px,0)';
    showTarget(computeTarget(x, y));
  }

  function blockKids(zone, exclude) {
    return Array.prototype.filter.call(zone.children, (c) => c.classList.contains('blk') && c !== exclude);
  }

  /** Bırakma yeri: hangi alan, kaçıncı sıra ve işaretçinin konumu. */
  function indexAt(zone, x, y, exclude) {
    const kids = blockKids(zone, exclude);
    const rects = kids.map((k) => k.getBoundingClientRect());
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = rects[i];
      if (y < r.top) { index = i; break; }
      if (y <= r.bottom + 6 && x < r.left + r.width / 2) { index = i; break; }
    }
    const gap = 5;
    let m;
    if (!kids.length) {
      const zr = zone.getBoundingClientRect();
      const cs = getComputedStyle(zone);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const bs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bs')) || 60;
      m = { x: zr.left + pl - 2, y: zr.top + pt, h: Math.min(bs, zr.height - pt * 2) };
    } else if (index < kids.length) {
      const r = rects[index];
      const prev = index > 0 ? rects[index - 1] : null;
      if (prev && r.top >= prev.bottom - 4 && y >= prev.top && y <= prev.bottom + 6) {
        m = { x: prev.right + gap, y: prev.top, h: prev.height };
      } else {
        m = { x: r.left - gap, y: r.top, h: r.height };
      }
    } else {
      const r = rects[kids.length - 1];
      m = { x: r.right + gap, y: r.top, h: r.height };
    }
    return { index, kids, marker: m };
  }

  function dragInfo() {
    const src = D.src;
    if (src.kind === 'palette') return { type: src.type, size: 1, hasCombo: src.type === 'combo', fromCombo: false };
    const node = nodeAt(src.path) || { type: '' };
    const uses = node.type === 'combo' || (node.type === 'loop' && Ryu.Blocks.usesCombo(node.body));
    return { type: node.type, size: count([node]), hasCombo: uses, fromCombo: inCombo(src.path) };
  }

  function computeTarget(x, y) {
    const src = D.src;
    const fromProgram = src.kind === 'program';
    const offKind = fromProgram ? 'delete' : 'cancel';
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { kind: offKind };
    if (hit.closest('#palettePanel')) return { kind: offKind };
    const inPanel = hit.closest('#programPanel');
    let zone = hit.closest('.drop-zone');
    if (zone && !inEditor(zone) && programZones().indexOf(zone) === -1) zone = null;
    if (!zone && inPanel) zone = hit.closest('#comboDef') ? els.comboRoot : els.programRoot;
    if (!zone) return { kind: offKind };
    if (fromProgram && src.el.contains(zone)) {
      // kendi gövdesine bırakılamaz: bir üstteki alana say
      zone = (src.el.parentElement && src.el.parentElement.closest('.drop-zone')) || els.programRoot;
    }
    const info = dragInfo();
    const toCombo = inCombo(parsePath(zone.dataset.zone));
    if (!fromProgram && isFull()) return { kind: 'full', zone };
    if (toCombo) {
      if (info.hasCombo) return { kind: 'self', zone };
      const extra = info.fromCombo ? 0 : info.size;
      if (count(S.combo) + extra > COMBO_MAX) return { kind: 'comboFull', zone };
    }
    const at = indexAt(zone, x, y, fromProgram ? src.el : null);
    return { kind: 'insert', zone, index: at.index, kids: at.kids, marker: at.marker };
  }

  function showTarget(t) {
    if (D.zone && D.zone !== t.zone) D.zone.classList.remove('drop-target');
    for (const z of programZones()) z.classList.toggle('full-hover', (t.kind === 'full' || t.kind === 'comboFull' || t.kind === 'self') && t.zone === z);
    if (t.kind === 'insert') {
      t.zone.classList.add('drop-target');
      D.zone = t.zone;
      const m = els.dropMarker;
      m.hidden = false;
      m.style.transform = 'translate(' + Math.round(t.marker.x - 3.5) + 'px,' + Math.round(t.marker.y) + 'px)';
      m.style.height = Math.round(t.marker.h) + 'px';
    } else {
      D.zone = null;
      els.dropMarker.hidden = true;
    }
    const del = t.kind === 'delete';
    els.palettePanel.classList.toggle('trash-hot', del);
    if (D.ghost) D.ghost.classList.toggle('to-trash', del);
  }

  function clearTargetUI() {
    els.dropMarker.hidden = true;
    for (const z of programZones()) z.classList.remove('full-hover');
    document.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
  }

  function dropGhost(mode) {
    const g = D.ghost;
    D.ghost = null;
    if (!g) return;
    if (mode === 'land' || reducedMotion()) { g.remove(); return; }
    g.classList.add(mode);
    setTimeout(() => g.remove(), 280);
  }

  function endDrag(x, y) {
    const t = computeTarget(x, y);
    const src = D.src;
    clearTargetUI();
    if (t.kind === 'insert') {
      const arr = arrayFor(parsePath(t.zone.dataset.zone));
      if (!arr) { dropGhost('fade'); return; }
      const beforeEl = t.kids[t.index];
      const beforeNode = beforeEl ? nodeAt(parsePath(beforeEl.dataset.path)) : null;
      remember();
      const node = src.kind === 'palette' ? newBlock(src.type) : removeAt(src.path);
      if (!node) { S.history.pop(); dropGhost('fade'); return; }
      let at = beforeNode ? arr.indexOf(beforeNode) : arr.length;
      if (at < 0) at = arr.length;
      arr.splice(at, 0, node);
      S.justAdded = node;
      dropGhost('land');
      if (src.kind === 'program') src.el.classList.remove('drag-src');
      programChanged();
    } else if (t.kind === 'delete' && src.kind === 'program') {
      remember();
      removeAt(src.path);
      dropGhost('poof');
      programChanged();
    } else if (t.kind === 'full') {
      dropGhost('fade');
      refuseFull();
    } else if (t.kind === 'comboFull') {
      dropGhost('fade');
      refuseCombo('Kombo serisi en fazla ' + COMBO_MAX + ' blok olabilir!');
    } else if (t.kind === 'self') {
      dropGhost('fade');
      refuseCombo('Kombo kendini çağıramaz 🙂');
    } else {
      dropGhost('fade');
    }
  }

  function ensureVisible(node) {
    const box = S.mode === 'code' ? null : els.programScroll;
    if (!box || box.scrollHeight <= box.clientHeight + 2) return;
    const br = box.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    if (r.top < br.top + 8) box.scrollTop -= (br.top + 8 - r.top);
    else if (r.bottom > br.bottom - 8) box.scrollTop += (r.bottom - br.bottom + 8);
  }

  // ---------------- kod modu ----------------
  function codeSnippet(type) {
    if (type === 'loop') return 'tekrarla(2) {\n  \n}';
    return (Ryu.Code.WORDS[type] || type) + '()';
  }

  function highlightCode(text) {
    const out = [];
    for (const line of text.split('\n')) {
      const ci = line.indexOf('//');
      const body = ci >= 0 ? line.slice(0, ci) : line;
      let html = escapeHtml(body).replace(/[A-Za-zÇĞİÖŞÜçğıöşü_][A-Za-zÇĞİÖŞÜçğıöşü_0-9]*|\d+/g, (w) => {
        if (/^\d+$/.test(w)) return '<span class="tok-num">' + w + '</span>';
        const s = Ryu.Code.simplify(w);
        if (s === 'tekrarla' || s === 'fonksiyon') return '<span class="tok-kw">' + w + '</span>';
        if (s === 'kombo') return '<span class="tok-combo">' + w + '</span>';
        if (MOVE_WORDS.indexOf(s) !== -1 || MOVE_WORDS.indexOf(w) !== -1) return '<span class="tok-move">' + w + '</span>';
        if (HIT_WORDS.indexOf(s) !== -1 || s === 'tatsumakisenpukyaku') return '<span class="tok-hit">' + w + '</span>';
        return w;
      });
      if (ci >= 0) html += '<span class="tok-com">' + escapeHtml(line.slice(ci)) + '</span>';
      out.push(html);
    }
    return out.join('\n') + '\n';
  }

  function renderCode() {
    const text = els.codeInput.value;
    els.codeHl.innerHTML = highlightCode(text);
    const n = Math.max(text.split('\n').length, 1);
    const err = S.codeError && S.codeError.line;
    let g = '';
    for (let i = 1; i <= n; i++) g += '<div class="ln' + (i === err ? ' err' : '') + '">' + i + '</div>';
    els.codeGutter.innerHTML = g;
    setCodeBars(err ? [{ line: err, cls: 'err' }] : []);
    syncCodeScroll();
  }

  function setCodeBars(bars) {
    els.codeLines.textContent = '';
    const lh = parseFloat(getComputedStyle(els.codeEditor).getPropertyValue('--lh')) || 26;
    for (const b of bars) {
      const d = el('div', 'bar ' + b.cls);
      d.style.top = (12 + (b.line - 1) * lh) + 'px';
      els.codeLines.appendChild(d);
    }
    els.codeGutter.querySelectorAll('.ln.run').forEach((n) => n.classList.remove('run'));
    for (const b of bars) {
      if (b.cls !== 'run') continue;
      const ln = els.codeGutter.children[b.line - 1];
      if (ln) ln.classList.add('run');
    }
    syncCodeScroll();
  }

  function syncCodeScroll() {
    const t = els.codeInput;
    els.codeHl.scrollTop = t.scrollTop;
    els.codeHl.scrollLeft = t.scrollLeft;
    els.codeLines.style.transform = 'translate(' + (-t.scrollLeft) + 'px,' + (-t.scrollTop) + 'px)';
    els.codeGutter.scrollTop = t.scrollTop;
  }

  /** Metni ayrıştırır; doğruysa programı günceller. Sonucu döndürür. */
  function parseCode(silent) {
    const text = els.codeInput.value;
    let res = null;
    try {
      res = Ryu.Code.parse(text, { tools: S.level.tools || [] });
      if (res.combo && count(res.combo) > COMBO_MAX) {
        const line = text.split('\n').findIndex((l) => /fonksiyon/.test(Ryu.Code.simplify(l))) + 1;
        throw new Ryu.CodeError('Kombo serisi en fazla ' + COMBO_MAX + ' blok olabilir.', line);
      }
      S.codeError = null;
    } catch (e) {
      if (!(e instanceof Ryu.CodeError)) throw e;
      S.codeError = e;
      res = null;
    }
    if (res) {
      const tools = S.level.tools || [];
      S.program = sanitize(res.program, tools, 0, false);
      S.combo = hasCombo() ? sanitize(res.combo || [], tools, 0, true) : [];
      saveProgram();
    }
    S.code = text;
    store.set(KEY_CODE + S.level.id, text);
    updateCodeStatus();
    if (!silent) renderCode();
    if (S.dirty && !S.running) resetWorld(true);
    return res;
  }

  function updateCodeStatus() {
    const st = els.codeStatus;
    const used = countBlocks();
    updateCounter(used);
    if (S.codeError) {
      st.className = 'code-status err';
      st.textContent = '✗ ' + S.codeError.message;
    } else if (!els.codeInput.value.trim()) {
      st.className = 'code-status';
      st.textContent = 'Komut yaz ya da yukarıdaki hareketlere dokun. Örnek: ileri()';
    } else if (used > S.level.maxBlocks) {
      st.className = 'code-status err';
      st.textContent = '✗ Kod çok uzun: ' + used + ' komut var, en fazla ' + S.level.maxBlocks + '. Tekrarla kullan!';
    } else {
      st.className = 'code-status ok';
      st.textContent = '✓ Kod doğru! ' + used + ' komut.';
    }
  }

  let parseTimer = 0;
  function onCodeInput() {
    disarmClear();
    hideBubble();
    els.codeHl.innerHTML = highlightCode(els.codeInput.value);
    clearTimeout(parseTimer);
    parseTimer = setTimeout(() => parseCode(false), 220);
  }

  function insertCode(type) {
    const ta = els.codeInput;
    const snip = codeSnippet(type);
    const v = ta.value;
    let start = ta.selectionStart;
    let end = ta.selectionEnd;
    if (document.activeElement !== ta) { start = end = v.length; }
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const curLine = v.slice(lineStart, start);
    const indent = (curLine.match(/^\s*/) || [''])[0];
    let pre = '';
    if (curLine.trim()) pre = '\n' + indent;
    else if (start > 0 && v[start - 1] !== '\n' && !curLine.length) pre = '\n';
    const body = snip.split('\n').join('\n' + indent);
    let ins = pre + body;
    const after = v.slice(end);
    if (!after.startsWith('\n') && after.length) ins += '\n' + indent;
    ta.value = v.slice(0, start) + ins + after;
    let caret = start + pre.length + body.length;
    if (type === 'loop') caret = start + pre.length + body.indexOf('\n') + 1 + indent.length + 2;
    ta.focus();
    try { ta.setSelectionRange(caret, caret); } catch (e) { /* yoksay */ }
    onCodeInput();
  }

  function sameProgram(a, b) {
    const strip = (l) => JSON.stringify((l || []).map(function s(x) {
      return x.type === 'loop' ? { t: 'loop', c: x.count, b: x.body.map(s) } : { t: x.type };
    }));
    return strip(a) === strip(b);
  }

  function setMode(mode, quiet) {
    if (S.running) return;
    if (mode === S.mode && !quiet) return;
    S.mode = mode;
    store.set(KEY_MODE, mode);
    const code = mode === 'code';
    els.modeBlocks.setAttribute('aria-selected', String(!code));
    els.modeCode.setAttribute('aria-selected', String(code));
    els.blocksView.hidden = code;
    els.codeView.hidden = !code;
    els.btnUndo.hidden = code;
    if (code) {
      // kayıtlı metin aynı programı anlatıyorsa (yorumlarıyla) onu koru
      let text = S.code || store.get(KEY_CODE + S.level.id, '') || '';
      let keep = false;
      if (text) {
        try {
          const r = Ryu.Code.parse(text, { tools: S.level.tools || [] });
          keep = sameProgram(r.program, S.program) && (!hasCombo() || sameProgram(r.combo || [], S.combo));
        } catch (e) { keep = false; }
      }
      if (!keep) text = S.program.length || S.combo.length ? Ryu.Code.format(S.program, hasCombo() && S.combo.length ? S.combo : null) : '';
      els.codeInput.value = text;
      S.codeError = null;
      parseCode(false);
    } else {
      clearTimeout(parseTimer);
      if (S.codeError && !quiet) say('Koddaki hata yüzünden son doğru program gösteriliyor.', 'hint', 3200);
      S.codeError = null;
      renderProgram();
    }
    renderPalette();
  }

  // ---------------- çalıştırma ----------------
  /** Blocks.run ile aynı sırayı izleyip döngü turlarını hesaplar (yalnızca gösterim için). */
  function* trace(list, prefix, iters, combo) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const p = prefix.concat(i);
      if (b.type === 'loop') {
        const k = pathKey(p);
        for (let n = 1; n <= b.count; n++) {
          iters[k] = n;
          yield* trace(b.body || [], p, iters, combo);
        }
        delete iters[k];
      } else if (b.type === 'combo') {
        yield* trace(combo || [], [K], iters, combo);
      } else {
        yield { path: p, iters: Object.assign({}, iters) };
      }
    }
  }
  const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

  function clearHighlight() {
    const scope = els.blocksView;
    scope.querySelectorAll('.running, .active-loop, .calling').forEach((n) => n.classList.remove('running', 'active-loop', 'calling'));
    els.comboDef.classList.remove('active');
    scope.querySelectorAll('.blk-loop').forEach((loopEl) => {
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(parsePath(loopEl.dataset.path));
      if (badge && node) badge.textContent = '×' + node.count;
    });
    if (S.mode === 'code') setCodeBars(S.codeError && S.codeError.line ? [{ line: S.codeError.line, cls: 'err' }] : []);
  }
  function clearMarks() {
    clearHighlight();
    els.blocksView.querySelectorAll('.error').forEach((n) => n.classList.remove('error'));
  }

  function loopPrefixes(path) {
    const out = [];
    for (let k = inCombo(path) ? 2 : 1; k < path.length; k++) out.push(path.slice(0, k));
    return out;
  }

  function highlight(path, calls, iters, run) {
    if (S.mode === 'code') {
      const bars = [];
      for (const c of calls) {
        const n = nodeIn(run.program, run.combo, c);
        if (n && n.line) bars.push({ line: n.line, cls: 'run' });
      }
      const n = nodeIn(run.program, run.combo, path);
      if (n && n.line) bars.push({ line: n.line, cls: 'run' });
      setCodeBars(bars);
      return;
    }
    const scope = els.blocksView;
    scope.querySelectorAll('.running, .calling').forEach((n) => n.classList.remove('running', 'calling'));
    const active = new Set();
    const loops = loopPrefixes(path);
    for (const c of calls) loops.push(...loopPrefixes(c));
    for (const lp of loops) {
      const key = pathKey(lp);
      const loopEl = S.pathMap.get(key);
      if (!loopEl || !loopEl.classList.contains('blk-loop')) continue;
      active.add(loopEl);
      loopEl.classList.add('active-loop');
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(lp);
      if (badge && node) badge.textContent = iters && iters[key] ? iters[key] + '/' + node.count : '×' + node.count;
    }
    scope.querySelectorAll('.active-loop').forEach((loopEl) => {
      if (active.has(loopEl)) return;
      loopEl.classList.remove('active-loop');
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(parsePath(loopEl.dataset.path));
      if (badge && node) badge.textContent = '×' + node.count;
    });
    els.comboDef.classList.toggle('active', calls.length > 0);
    for (const c of calls) {
      const callEl = S.pathMap.get(pathKey(c));
      if (callEl) callEl.classList.add('calling');
    }
    const node = S.pathMap.get(pathKey(path));
    if (node) { node.classList.add('running'); ensureVisible(node); }
  }

  function setRunning(on) {
    S.running = on;
    document.body.classList.toggle('is-running', on);
    els.btnRun.hidden = on;
    els.btnStop.hidden = !on;
    els.btnClear.disabled = on;
    els.modeBlocks.disabled = on;
    els.modeCode.disabled = on;
    els.codeInput.readOnly = on;
    updateUndo();
    els.palette.querySelectorAll('.pal-item').forEach((b) => b.setAttribute('aria-disabled', on ? 'true' : 'false'));
    els.programPanel.querySelectorAll('.loop-count').forEach((b) => { b.disabled = on; });
    if (on) disarmClear();
    updatePanHint();
    const ae = document.activeElement;
    if (on && ae === els.btnRun) els.btnStop.focus();
    else if (!on && ae === els.btnStop) els.btnRun.focus();
  }

  async function run() {
    if (S.running) return;
    let program = S.program;
    let combo = S.combo;
    if (S.mode === 'code') {
      clearTimeout(parseTimer);
      const res = parseCode(false);
      if (!res) {
        say('Kodda hata var: ' + (S.codeError ? S.codeError.plain : ''), 'error');
        flash(els.codeEditor, 'shake');
        return;
      }
      program = res.program;
      combo = res.combo || [];
    }
    if (!program.length) {
      say(S.mode === 'code' ? 'Önce kod yaz! ⌨️' : 'Önce blok ekle! 👇', 'hint', 2600);
      flash(els.programPanel, 'shake');
      return;
    }
    if (countBlocks() > S.level.maxBlocks) { refuseFull(); return; }
    if (Ryu.Blocks.usesCombo(program) && !(combo && combo.length)) {
      say('Kombo serisi boş! Önce kombo kutusuna blok diz.', 'hint', 3000);
      if (S.mode === 'blocks') flash(els.comboDef, 'shake');
      return;
    }
    const runId = ++S.runId;
    setRunning(true);
    clearMarks();
    hideBubble();
    const br = els.boardWrap.getBoundingClientRect();
    if (br.top < 0 || br.bottom > root.innerHeight) {
      els.boardWrap.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    const world = new Ryu.World(S.level);
    S.world = world;
    S.renderer.setWorld(world, S.level);
    S.dirty = true;
    updateCoinChip();
    updateComboChip();
    await wait(180);
    if (runId !== S.runId) return;

    const ms = SPEEDS[S.speed] || SPEEDS.slow;
    const runInfo = { program, combo };
    const tracer = trace(program, [], {}, combo);
    let gen;
    try {
      gen = Ryu.Blocks.run(program, world, { combo: hasCombo() ? combo : null, maxSteps: MAX_STEPS });
    } catch (err) {
      return fail(err, world, runId, runInfo);
    }
    for (;;) {
      let step;
      try {
        step = gen.next();
      } catch (err) {
        return fail(err, world, runId, runInfo);
      }
      if (runId !== S.runId) return;
      if (step.done) break;
      const v = step.value || {};
      const tr = tracer.next().value;
      const path = Array.isArray(v.path) ? v.path : [];
      highlight(path, v.calls || [], tr && samePath(tr.path, path) ? tr.iters : null, runInfo);
      await S.renderer.play(v.event, ms);
      if (runId !== S.runId) return;
      updateCoinChip();
      updateComboChip();
      if (world.state !== 'play') { lastPath = path; break; }
    }
    finish(world, runId, runInfo);
  }
  let lastPath = null;

  function markError(path, runInfo) {
    if (!path) return;
    if (S.mode === 'code') {
      const n = nodeIn(runInfo.program, runInfo.combo, path);
      if (n && n.line) setCodeBars([{ line: n.line, cls: 'err' }]);
      return;
    }
    const node = S.pathMap.get(pathKey(path));
    if (node) { node.classList.add('error'); ensureVisible(node); }
  }

  function fail(err, world, runId, runInfo) {
    const path = err && Array.isArray(err.path) ? err.path : null;
    clearHighlight();
    markError(path, runInfo);
    const msg = String((err && err.message) || '');
    if (/adım/i.test(msg)) say('Ryu çok yoruldu 😴 Daha kısa bir program dene!', 'error');
    else if (/Kombo/i.test(msg)) say(msg, 'error');
    else {
      say('Hımm, olmadı. Tekrar dene!', 'error');
      if (root.console && !(err instanceof Error && err.name === 'BlockError')) console.warn(err);
    }
    if (runId !== S.runId) return;
    setRunning(false);
  }

  const DEATH = {
    fall: 'Ryu boşluğa düştü! 🕳️ Zıplamayı dene.',
    spike: 'Ah! Dikenlere bastın 🌵 Üstünden zıpla.',
    enemy: 'Ryu düşmana çarptı! 👊 Önce onu yen.',
    spiky: 'Kirpiye dokunulmaz! 🔥 Hadoken ile uzaktan vur.'
  };

  function finish(world, runId, runInfo) {
    clearHighlight();
    setRunning(false);
    if (world.isWon()) { win(runId, world); return; }
    if (world.state === 'dead') {
      markError(lastPath, runInfo);
      say(DEATH[world.reason] || 'Ups! Tekrar dene.', 'error');
    } else if (world.state === 'blocked') {
      markError(lastPath, runInfo);
      say('Önünde engel var! 🧱 Kır ya da üstünden zıpla.', 'error');
    } else if (world.state === 'flag') {
      const left = world.coinsLeft();
      if (left > 0) say('Bayrağa vardın ama ' + left + ' altın kaldı 🪙', 'hint');
      else say('Kombo yetmedi! Art arda en az ' + world.needCombo + ' vuruş yap 💥', 'hint');
    } else {
      say('Ryu bayrağa varamadı. Programına hareket ekle!', 'hint');
    }
    lastPath = null;
  }

  function win(runId, world) {
    const used = countBlocks();
    const par = S.level.par;
    const stars = used <= par ? 3 : used <= par + 2 ? 2 : 1;
    if (stars > starsFor(S.level.id)) {
      S.progress[S.level.id] = stars;
      store.set(KEY_PROGRESS, S.progress);
    }
    renderHeader();
    S.renderer.celebrate();
    say('Bayrağa ulaştın! 🎉', 'ok');
    setTimeout(() => {
      if (runId !== S.runId || S.running) return;
      showWin(stars, used, world.maxCombo);
    }, reducedMotion() ? 250 : 1300);
  }

  function stop() {
    if (!S.running) return;
    S.runId++;
    S.renderer.snap();
    clearHighlight();
    setRunning(false);
    say('Durdu ⏹', 'info', 1800);
  }

  function resetWorld(silent) {
    if (S.running) { S.runId++; setRunning(false); }
    S.world = new Ryu.World(S.level);
    S.renderer.setWorld(S.world, S.level);
    S.dirty = false;
    clearMarks();
    updateCoinChip();
    updateComboChip();
    updatePanHint();
    if (!silent) hideBubble();
  }

  function disarmClear() {
    S.clearArmed = 0;
    els.btnClear.classList.remove('confirm');
    els.clearLabel.textContent = 'Temizle';
  }
  function clearProgram() {
    if (S.running) return;
    const big = S.mode === 'code' ? els.codeInput.value.trim().split('\n').length > 3 : countBlocks() > 3;
    if (S.mode === 'blocks' && !S.program.length && !S.combo.length) return;
    if (S.mode === 'code' && !els.codeInput.value.trim()) return;
    // büyük programlarda kazara silmeye karşı ikinci dokunuş
    if (big && Date.now() - S.clearArmed > 2500) {
      S.clearArmed = Date.now();
      els.btnClear.classList.add('confirm');
      els.clearLabel.textContent = 'Emin misin?';
      setTimeout(() => { if (Date.now() - S.clearArmed >= 2500) disarmClear(); }, 2600);
      return;
    }
    if (S.mode === 'code') {
      els.codeInput.value = '';
      parseCode(false);
      disarmClear();
      return;
    }
    remember();
    S.program = [];
    S.combo = [];
    programChanged();
  }

  function applySpeed() {
    const fast = S.speed === 'fast';
    els.speedIco.textContent = fast ? '🐇' : '🐢';
    els.speedLabel.textContent = fast ? 'Hızlı' : 'Yavaş';
    els.btnSpeed.setAttribute('aria-label', 'Hız: ' + (fast ? 'hızlı' : 'yavaş'));
  }

  let panTimer = 0;
  function updatePanHint() {
    clearTimeout(panTimer);
    const show = !!S.renderer && S.renderer.pannable && !S.running;
    els.panHint.hidden = !show;
    if (show) panTimer = setTimeout(() => { els.panHint.hidden = true; }, 4500);
  }

  // ---------------- pencereler ----------------
  let lastFocus = null;
  function openModal(m, focusEl) {
    lastFocus = document.activeElement;
    m.hidden = false;
    setTimeout(() => { (focusEl || m.querySelector('button')).focus(); }, 30);
  }
  function closeModal(m) {
    if (m.hidden) return;
    m.hidden = true;
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function showWin(stars, used, maxCombo) {
    const titles = { 3: 'Mükemmel! 🎉', 2: 'Harika! 👏', 1: 'Bravo! 👍' };
    els.winTitle.textContent = titles[stars];
    els.winStars.querySelectorAll('.win-star').forEach((s, i) => s.classList.toggle('on', i < stars));
    const last = S.index >= S.levels.length - 1;
    let text = used + ' blok kullandın.';
    if (maxCombo >= 2) text += ' En uzun kombo: ' + maxCombo + ' vuruş! 💥';
    if (stars < 3) text += ' ' + S.level.par + ' blokla 3 yıldız alabilirsin!';
    if (last) text += ' Bütün bölümleri bitirdin, gerçek bir kod ustasısın! 🏆';
    els.winText.textContent = text;
    els.nextLabel.textContent = last ? 'Bölümler' : 'Sonraki';
    openModal(els.winModal, els.btnNext);
  }

  function renderLevelGrid() {
    const grid = els.levelGrid;
    grid.textContent = '';
    let total = 0;
    S.levels.forEach((lv, i) => {
      const st = starsFor(lv.id);
      total += st;
      const open = isUnlocked(i);
      const b = el('button', 'level-tile');
      b.type = 'button';
      b.dataset.index = String(i);
      b.title = lv.title || '';
      if (i === S.index) b.classList.add('current');
      if (st > 0) b.classList.add('done');
      if (open) {
        b.appendChild(el('span', 'lt-num', String(i + 1)));
        b.appendChild(starsEl(st, 'lt-stars'));
        b.setAttribute('aria-label', 'Bölüm ' + (i + 1) + ': ' + (lv.title || '') + ', ' + st + ' yıldız');
      } else {
        b.disabled = true;
        b.appendChild(icon('i-lock', 'lock'));
        b.appendChild(el('span', 'lt-num', String(i + 1)));
        b.setAttribute('aria-label', 'Bölüm ' + (i + 1) + ', kilitli');
      }
      grid.appendChild(b);
    });
    els.totalStars.textContent = '';
    els.totalStars.appendChild(icon('i-star'));
    els.totalStars.appendChild(document.createTextNode(total + ' / ' + S.levels.length * 3));
    els.totalStars.setAttribute('aria-label', 'Toplam ' + total + ' yıldız');
  }

  function openLevels() {
    renderLevelGrid();
    openModal(els.levelsModal, els.levelGrid.querySelector('.current') || undefined);
  }

  function openHelp() {
    const list = els.helpList;
    list.textContent = '';
    for (const t of Object.keys(INFO)) {
      const info = INFO[t];
      const seen = S.firstSeen[t] != null && S.firstSeen[t] <= S.index;
      const item = el('div', 'help-item' + (seen ? '' : ' locked'));
      item.appendChild(blockEl(t));
      const txt = el('div');
      const h = el('h3', null, info.name);
      h.appendChild(el('code', null, codeSnippet(t).replace(/\n\s*\n/, ' … ').replace(/\n/g, ' ')));
      txt.appendChild(h);
      txt.appendChild(el('p', null, seen ? info.desc : 'İlerleyen bölümlerde açılacak.'));
      item.appendChild(txt);
      list.appendChild(item);
    }
    openModal(els.helpModal);
  }

  // ---------------- bölüm yükleme ----------------
  function loadLevel(i) {
    if (!S.levels.length) return;
    i = Math.max(0, Math.min(S.levels.length - 1, i | 0));
    if (S.running) { S.runId++; setRunning(false); }
    S.index = i;
    S.level = S.levels[i];
    store.set(KEY_LEVEL, S.level.id);
    const saved = loadProgram(S.level);
    S.program = saved.program;
    S.combo = saved.combo;
    S.code = store.get(KEY_CODE + S.level.id, '') || '';
    S.codeError = null;
    S.history = [];
    S.world = new Ryu.World(S.level);
    S.renderer.setWorld(S.world, S.level, { intro: true });
    S.dirty = false;
    disarmClear();
    renderHeader();
    renderTask();
    renderProgram();
    setMode(S.mode, true);
    updateCoinChip();
    updatePanHint();
    hideBubble();
  }

  function startLevelIndex() {
    const lastId = store.get(KEY_LEVEL, null);
    const idx = S.levels.findIndex((l) => l.id === lastId);
    if (idx >= 0 && isUnlocked(idx)) return idx;
    for (let i = 0; i < S.levels.length; i++) {
      if (isUnlocked(i) && !starsFor(S.levels[i].id)) return i;
    }
    return 0;
  }

  // ---------------- başlatma ----------------
  function init() {
    const ids = ['levelNum', 'levelStars', 'btnLevels', 'btnHelp', 'levelTitle', 'levelDesc', 'coinChip', 'coinText',
      'comboChip', 'comboText', 'parChip', 'parText', 'boardWrap', 'board', 'panHint', 'bubble', 'btnRun', 'btnStop',
      'btnReset', 'btnClear', 'clearLabel', 'btnSpeed', 'speedIco', 'speedLabel', 'programPanel', 'programScroll',
      'programRoot', 'comboDef', 'comboRoot', 'comboHint', 'counter', 'btnUndo', 'programTip', 'palettePanel',
      'palette', 'paletteHint', 'dropMarker', 'levelsModal', 'levelGrid', 'totalStars', 'helpModal', 'helpList',
      'winModal', 'winStars', 'winTitle', 'winText', 'btnRetry', 'btnNext', 'nextLabel', 'modeBlocks', 'modeCode',
      'blocksView', 'codeView', 'codeEditor', 'codeGutter', 'codeLines', 'codeHl', 'codeInput', 'codeStatus'];
    els = {};
    for (const id of ids) els[id] = document.getElementById(id);

    const prog = store.get(KEY_PROGRESS, {});
    S.progress = prog && typeof prog === 'object' && !Array.isArray(prog) ? prog : {};
    S.speed = store.get(KEY_SPEED, 'slow') === 'fast' ? 'fast' : 'slow';
    S.mode = store.get(KEY_MODE, 'blocks') === 'code' ? 'code' : 'blocks';
    applySpeed();
    S.levels.forEach((lv, i) => {
      for (const t of lv.tools || []) if (S.firstSeen[t] == null) S.firstSeen[t] = i;
    });

    S.renderer = new Ryu.Renderer(els.board, { container: els.boardWrap });

    if (!S.levels.length || !Ryu.World) {
      say('Bölümler yüklenemedi 😕', 'error');
      return;
    }

    // sürükle-bırak
    document.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove, { passive: false });
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    els.palette.addEventListener('contextmenu', (e) => e.preventDefault());
    els.programPanel.addEventListener('contextmenu', (e) => {
      const head = e.target.closest('.loop-head');
      if (!head || !inEditor(head)) return;
      e.preventDefault();
      cycleLoop(head.querySelector('.loop-count'), -1);
    });
    document.addEventListener('touchmove', (e) => { if (D.started) e.preventDefault(); }, { passive: false });

    // klavye: palet düğmesi Enter/Boşluk ile eklenir; kod modunda tıklama
    els.palette.addEventListener('click', (e) => {
      const item = e.target.closest('.pal-item');
      if (!item) return;
      if (e.detail === 0 || S.mode === 'code') appendBlock(item.dataset.type);
    });
    els.programPanel.addEventListener('click', (e) => {
      const badge = e.target.closest('.loop-count');
      if (badge && inEditor(badge)) { e.preventDefault(); cycleLoop(badge, 1); }
    });
    els.blocksView.addEventListener('keydown', (e) => {
      if (S.running) return;
      const blk = e.target.closest && e.target.closest('.blk');
      if (!blk || e.target !== blk) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteBlock(parsePath(blk.dataset.path), blk);
        els.programRoot.focus();
      }
    });

    // kod düzenleyici
    els.codeInput.addEventListener('input', onCodeInput);
    els.codeInput.addEventListener('scroll', syncCodeScroll);
    els.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const ta = els.codeInput;
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
        ta.setSelectionRange(s + 2, s + 2);
        onCodeInput();
      } else if (e.key === 'Enter') {
        // girintiyi koru, { sonrasında bir kademe artır
        const ta = els.codeInput;
        const s = ta.selectionStart;
        const v = ta.value;
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const line = v.slice(ls, s);
        let ind = (line.match(/^\s*/) || [''])[0];
        if (/\{\s*$/.test(line)) ind += '  ';
        e.preventDefault();
        ta.value = v.slice(0, s) + '\n' + ind + v.slice(ta.selectionEnd);
        ta.setSelectionRange(s + 1 + ind.length, s + 1 + ind.length);
        onCodeInput();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
    els.modeBlocks.addEventListener('click', () => setMode('blocks'));
    els.modeCode.addEventListener('click', () => setMode('code'));

    els.btnRun.addEventListener('click', run);
    els.btnStop.addEventListener('click', stop);
    els.btnReset.addEventListener('click', () => resetWorld(false));
    els.btnClear.addEventListener('click', clearProgram);
    els.btnUndo.addEventListener('click', undo);
    els.btnSpeed.addEventListener('click', () => {
      S.speed = S.speed === 'fast' ? 'slow' : 'fast';
      store.set(KEY_SPEED, S.speed);
      applySpeed();
    });
    els.btnLevels.addEventListener('click', openLevels);
    els.btnHelp.addEventListener('click', openHelp);
    els.levelGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.level-tile');
      if (!b || b.disabled) return;
      closeModal(els.levelsModal);
      loadLevel(Number(b.dataset.index));
    });
    els.btnRetry.addEventListener('click', () => { closeModal(els.winModal); resetWorld(false); });
    els.btnNext.addEventListener('click', () => {
      closeModal(els.winModal);
      if (S.index >= S.levels.length - 1) openLevels();
      else loadLevel(S.index + 1);
    });
    for (const m of [els.levelsModal, els.winModal, els.helpModal]) {
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('[data-close]')) closeModal(m);
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.target === els.codeInput) return; // düzenleyicinin kendi geri alması var
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'Escape') {
        if (D.started) { clearTargetUI(); dropGhost('fade'); resetDrag(); return; }
        closeModal(els.winModal);
        closeModal(els.levelsModal);
        closeModal(els.helpModal);
      }
    });
    els.programRoot.tabIndex = -1;
    if (root.addEventListener) root.addEventListener('resize', updatePanHint);

    loadLevel(startLevelIndex());
  }

  // test ve hata ayıklama için küçük bir kapı
  CodeGame.Ryu.App = {
    loadLevel: (i) => loadLevel(i),
    setMode: (m) => setMode(m),
    run: () => run(),
    getProgram: () => JSON.parse(JSON.stringify({ program: S.program, combo: S.combo })),
    setProgram: (program, combo) => {
      const tools = S.level.tools || [];
      S.program = sanitize(program, tools, 0, false);
      S.combo = sanitize(combo || [], tools, 0, true);
      programChanged();
      if (S.mode === 'code') setMode('code', true);
    },
    get levelIndex() { return S.index; },
    get running() { return S.running; },
    get world() { return S.world; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
