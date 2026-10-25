/* KodRobot — sürükle-bırak arayüzü ve oyun akışı.
 * Bkz. CONTRACT.md. Blok programı bir dizi olarak tutulur, DOM her
 * değişiklikte bu diziden yeniden çizilir. Sürükleme Pointer Events ile
 * yapılır (fare + dokunmatik).
 */
(function (root) {
  'use strict';
  const CodeGame = root.CodeGame = root.CodeGame || {};
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = CodeGame;
    return;
  }

  // ---------------- sabitler ----------------
  // v3: oklar ekrana göre; eski sürümün bölümleri ve programları geçersiz
  const KEY_PROGRESS = 'kodrobot.v3.progress';
  const KEY_PROGRAM = 'kodrobot.v3.program.';
  const KEY_LEVEL = 'kodrobot.v3.level';
  const KEY_SPEED = 'kodrobot.blocks.speed';
  const SPEEDS = { slow: 520, fast: 230 };
  const LOOP_MIN = 2;
  const LOOP_MAX = 9;
  const MAX_STEPS = 500;
  const INFO = {
    up: { name: 'Yukarı', aria: 'Yukarı git', icon: 'i-up' },
    down: { name: 'Aşağı', aria: 'Aşağı git', icon: 'i-down' },
    left: { name: 'Sola', aria: 'Sola git', icon: 'i-left' },
    right: { name: 'Sağa', aria: 'Sağa git', icon: 'i-right' },
    pick: { name: 'Topla', aria: 'Elmas topla', icon: 'i-gem' },
    loop: { name: 'Tekrarla', aria: 'Tekrarla', icon: 'i-loop' }
  };
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
    levels: Array.isArray(CodeGame.LEVELS) ? CodeGame.LEVELS : [],
    index: 0,
    level: null,
    program: [],
    world: null,
    renderer: null,
    running: false,
    runId: 0,
    dirty: false,          // robot başlangıçtan ayrıldı mı
    speed: 'slow',
    progress: {},
    pathMap: new Map(),
    justAdded: null,
    clearArmed: 0
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

  const pathKey = (p) => p.join('.');
  const parsePath = (s) => (s == null || s === '' ? [] : String(s).split('.').map(Number));

  function countBlocks(prog) {
    if (CodeGame.Blocks && typeof CodeGame.Blocks.count === 'function') return CodeGame.Blocks.count(prog);
    let n = 0;
    for (const b of prog) { n++; if (b.type === 'loop') n += countBlocks(b.body || []); }
    return n;
  }
  function newBlock(type) {
    return type === 'loop' ? { type: 'loop', count: LOOP_MIN, body: [] } : { type };
  }
  function nodeAt(path) {
    let arr = S.program;
    let node = null;
    for (const i of path) {
      node = arr && arr[i];
      if (!node) return null;
      arr = node.body;
    }
    return node;
  }
  function arrayFor(zonePath) {
    if (!zonePath.length) return S.program;
    const n = nodeAt(zonePath);
    if (!n || n.type !== 'loop') return null;
    if (!Array.isArray(n.body)) n.body = [];
    return n.body;
  }
  function removeAt(path) {
    const parent = arrayFor(path.slice(0, -1));
    return parent ? parent.splice(path[path.length - 1], 1)[0] : null;
  }
  const isFull = () => countBlocks(S.program) >= S.level.maxBlocks;

  /** Kayıtlı programı temizler: yalnızca bu bölümün blokları, geçerli sayılar. */
  function sanitize(list, tools, depth) {
    if (!Array.isArray(list) || depth > 8) return [];
    const out = [];
    for (const b of list) {
      if (!b || typeof b !== 'object' || tools.indexOf(b.type) === -1 || !INFO[b.type]) continue;
      if (b.type === 'loop') {
        let c = Math.round(Number(b.count));
        if (!isFinite(c)) c = LOOP_MIN;
        c = Math.max(LOOP_MIN, Math.min(LOOP_MAX, c));
        out.push({ type: 'loop', count: c, body: sanitize(b.body, tools, depth + 1) });
      } else {
        out.push({ type: b.type });
      }
    }
    return out;
  }
  function loadProgram(level) {
    const raw = store.get(KEY_PROGRAM + level.id, []);
    const prog = sanitize(raw, level.tools || [], 0);
    return countBlocks(prog) > level.maxBlocks ? [] : prog;
  }
  function saveProgram() { store.set(KEY_PROGRAM + S.level.id, S.program); }

  function starsFor(id) {
    const v = S.progress[id];
    return typeof v === 'number' && v > 0 ? Math.min(3, Math.floor(v)) : 0;
  }
  function isUnlocked(i) {
    if (i <= 0) return true;
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
    // animasyonu yeniden başlat
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    if (ms) bubbleTimer = setTimeout(hideBubble, ms);
  }
  function hideBubble() { clearTimeout(bubbleTimer); els.bubble.hidden = true; }

  // ---------------- çizim: başlık, görev, palet, program ----------------
  function renderHeader() {
    els.levelNum.textContent = 'Bölüm ' + (S.index + 1);
    const st = starsFor(S.level.id);
    const fresh = starsEl(st);
    fresh.id = 'levelStars';
    els.levelStars.replaceWith(fresh);
    els.levelStars = fresh;
  }

  function renderTask() {
    els.levelTitle.textContent = S.level.title || ('Bölüm ' + (S.index + 1));
    els.levelDesc.textContent = S.level.description || '';
    els.parText.textContent = S.level.par + ' blok';
    els.parChip.title = '3 yıldız için en fazla ' + S.level.par + ' blok';
    document.title = 'KodRobot · Bölüm ' + (S.index + 1);
  }

  function updateGemChip() {
    const w = S.world;
    const total = w ? w.totalGems : 0;
    els.gemChip.hidden = !total;
    if (!total) return;
    els.gemText.textContent = w.collected + '/' + total;
    els.gemChip.classList.toggle('done', w.collected >= total);
  }

  function renderPalette() {
    els.palette.textContent = '';
    for (const t of S.level.tools || []) {
      const info = INFO[t];
      if (!info) continue;
      const item = el('button', 'pal-item');
      item.type = 'button';
      item.dataset.type = t;
      item.setAttribute('aria-label', info.aria + ' bloğu ekle');
      const blk = el('div', 'blk blk-' + t);
      blk.appendChild(icon(info.icon));
      if (t === 'loop') blk.appendChild(el('span', 'pal-badge', '×' + LOOP_MIN));
      item.appendChild(blk);
      item.appendChild(el('span', 'pal-label', info.name));
      els.palette.appendChild(item);
    }
  }

  function buildBlock(b, path) {
    const node = el('div', 'blk blk-' + b.type);
    node.dataset.path = pathKey(path);
    node.tabIndex = 0;
    node.setAttribute('role', 'listitem');
    if (b.type === 'loop') {
      node.classList.add('blk-container');
      node.setAttribute('aria-label', 'Tekrarla, ' + b.count + ' kez');
      const head = el('div', 'loop-head');
      head.appendChild(icon(INFO.loop.icon));
      const badge = el('button', 'loop-count', '×' + b.count);
      badge.type = 'button';
      badge.title = 'Dokun: sayıyı değiştir';
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
      node.appendChild(icon(INFO[b.type] ? INFO[b.type].icon : 'i-up'));
      node.setAttribute('aria-label', INFO[b.type] ? INFO[b.type].aria : b.type);
    }
    if (b === S.justAdded) node.classList.add('pop-in');
    S.pathMap.set(pathKey(path), node);
    return node;
  }

  function renderProgram() {
    const rootEl = els.programRoot;
    rootEl.textContent = '';
    S.pathMap = new Map();
    S.program.forEach((b, i) => rootEl.appendChild(buildBlock(b, [i])));
    S.justAdded = null;
    const used = countBlocks(S.program);
    const free = Math.max(0, S.level.maxBlocks - used);
    for (let i = 0; i < free; i++) {
      const s = el('div', 'slot');
      s.setAttribute('aria-hidden', 'true');
      rootEl.appendChild(s);
    }
    const empty = S.program.length === 0;
    rootEl.classList.toggle('is-empty', empty);
    if (empty) rootEl.appendChild(el('p', 'empty-hint', 'Blokları buraya sürükle'));
    els.palette.classList.toggle('hint', empty);
    updateCounter();
  }

  function updateCounter() {
    const used = countBlocks(S.program);
    const max = S.level.maxBlocks;
    els.counter.textContent = used + ' / ' + max;
    els.counter.classList.toggle('full', used >= max);
    els.counter.setAttribute('aria-label', max + ' bloktan ' + used + ' tanesi kullanıldı');
  }

  // ---------------- program değişiklikleri ----------------
  function programChanged() {
    saveProgram();
    renderProgram();
    disarmClear();
    if (S.dirty) resetRobot(true);
    hideBubble();
  }

  function refuseFull() {
    flash(els.counter, 'shake');
    flash(els.programPanel, 'shake');
    say('Yer kalmadı! En fazla ' + S.level.maxBlocks + ' blok.', 'hint', 2600);
  }

  function appendBlock(type) {
    if (S.running) return;
    if (isFull()) { refuseFull(); return; }
    const b = newBlock(type);
    S.program.push(b);
    S.justAdded = b;
    programChanged();
    const node = S.pathMap.get(String(S.program.length - 1));
    if (node) ensureVisible(node);
  }

  function cycleLoop(badge) {
    if (S.running) return;
    const host = badge.closest('.blk-loop');
    const node = host && nodeAt(parsePath(host.dataset.path));
    if (!node) return;
    node.count = node.count >= LOOP_MAX ? LOOP_MIN : node.count + 1;
    badge.textContent = '×' + node.count;
    badge.setAttribute('aria-label', node.count + ' kez. Değiştirmek için dokun.');
    host.setAttribute('aria-label', 'Tekrarla, ' + node.count + ' kez');
    flash(badge, 'bump');
    saveProgram();
    if (S.dirty) resetRobot(true);
    hideBubble();
  }

  // ---------------- sürükle-bırak ----------------
  const D = { id: null, src: null, sx: 0, sy: 0, started: false, ghost: null, offX: 0, offY: 0, zone: null, ptype: 'mouse' };

  function onPointerDown(e) {
    if (D.id !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.loop-count')) return; // sayı rozeti: tıklama ile değişir
    const pal = e.target.closest('.pal-item');
    const blk = e.target.closest('.blk');
    let src = null;
    if (pal && els.palette.contains(pal)) {
      src = { kind: 'palette', type: pal.dataset.type, el: pal.querySelector('.blk'), host: pal };
    } else if (blk && els.programRoot.contains(blk)) {
      src = { kind: 'program', path: parsePath(blk.dataset.path), el: blk, host: blk };
    }
    if (!src) return;
    if (S.running) { e.preventDefault(); return; }
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
    clone.classList.remove('running', 'error', 'active-loop', 'drag-src', 'pop-in', 'wiggle');
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
    els.dropMarker.dataset.type = src.kind === 'palette' ? src.type : (nodeAt(src.path) || {}).type || '';
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

  function computeTarget(x, y) {
    const src = D.src;
    const fromProgram = src.kind === 'program';
    const offKind = fromProgram ? 'delete' : 'cancel';
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { kind: offKind };
    if (hit.closest('#palettePanel')) return { kind: offKind };
    const inPanel = hit.closest('#programPanel');
    let zone = hit.closest('.drop-zone');
    if (zone && !els.programPanel.contains(zone)) zone = null;
    if (!zone && inPanel) zone = els.programRoot;
    if (!zone) return { kind: offKind };
    if (fromProgram && src.el.contains(zone)) {
      // kendi gövdesine bırakılamaz: bir üstteki alana say
      zone = (src.el.parentElement && src.el.parentElement.closest('.drop-zone')) || els.programRoot;
    }
    if (!fromProgram && isFull()) return { kind: 'full', zone };
    const at = indexAt(zone, x, y, fromProgram ? src.el : null);
    return { kind: 'insert', zone, index: at.index, kids: at.kids, marker: at.marker };
  }

  function showTarget(t) {
    if (D.zone && D.zone !== t.zone) D.zone.classList.remove('drop-target');
    els.programRoot.classList.toggle('full-hover', t.kind === 'full');
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
    els.programRoot.classList.remove('full-hover');
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
      if (src.kind === 'palette' && isFull()) { refuseFull(); dropGhost('fade'); return; }
      const arr = arrayFor(parsePath(t.zone.dataset.zone));
      if (!arr) { dropGhost('fade'); return; }
      const beforeEl = t.kids[t.index];
      const beforeNode = beforeEl ? nodeAt(parsePath(beforeEl.dataset.path)) : null;
      const node = src.kind === 'palette' ? newBlock(src.type) : removeAt(src.path);
      if (!node) { dropGhost('fade'); return; }
      let at = beforeNode ? arr.indexOf(beforeNode) : arr.length;
      if (at < 0) at = arr.length;
      arr.splice(at, 0, node);
      S.justAdded = node;
      dropGhost('land');
      if (src.kind === 'program') src.el.classList.remove('drag-src');
      programChanged();
    } else if (t.kind === 'delete' && src.kind === 'program') {
      removeAt(src.path);
      dropGhost('poof');
      programChanged();
    } else if (t.kind === 'full') {
      dropGhost('fade');
      refuseFull();
    } else {
      dropGhost('fade');
    }
  }

  function ensureVisible(node) {
    const box = els.programScroll;
    if (!box || box.scrollHeight <= box.clientHeight + 2) return;
    const br = box.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    if (r.top < br.top + 8) box.scrollTop -= (br.top + 8 - r.top);
    else if (r.bottom > br.bottom - 8) box.scrollTop += (r.bottom - br.bottom + 8);
  }

  // ---------------- çalıştırma ----------------
  /** Blocks.run ile aynı sırayı izleyip döngü turlarını hesaplar (yalnızca gösterim için). */
  function* trace(list, prefix, iters) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const p = prefix.concat(i);
      if (b.type === 'loop') {
        const k = pathKey(p);
        for (let n = 1; n <= b.count; n++) {
          iters[k] = n;
          yield* trace(b.body || [], p, iters);
        }
        delete iters[k];
      } else {
        yield { path: p, iters: Object.assign({}, iters) };
      }
    }
  }
  const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

  function clearHighlight() {
    els.programRoot.querySelectorAll('.running, .active-loop').forEach((n) => n.classList.remove('running', 'active-loop'));
    els.programRoot.querySelectorAll('.blk-loop').forEach((loopEl) => {
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(parsePath(loopEl.dataset.path));
      if (badge && node) badge.textContent = '×' + node.count;
    });
  }
  function clearMarks() {
    clearHighlight();
    els.programRoot.querySelectorAll('.error').forEach((n) => n.classList.remove('error'));
  }

  function highlight(path, iters) {
    els.programRoot.querySelectorAll('.running').forEach((n) => n.classList.remove('running'));
    const active = new Set();
    for (let k = 1; k < path.length; k++) {
      const lp = path.slice(0, k);
      const key = pathKey(lp);
      const loopEl = S.pathMap.get(key);
      if (!loopEl || !loopEl.classList.contains('blk-loop')) continue;
      active.add(loopEl);
      loopEl.classList.add('active-loop');
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(lp);
      if (badge && node) badge.textContent = iters && iters[key] ? iters[key] + '/' + node.count : '×' + node.count;
    }
    // artık içinde olmadığımız döngüleri söndür
    els.programRoot.querySelectorAll('.active-loop').forEach((loopEl) => {
      if (active.has(loopEl)) return;
      loopEl.classList.remove('active-loop');
      const badge = loopEl.querySelector(':scope > .loop-head > .loop-count');
      const node = nodeAt(parsePath(loopEl.dataset.path));
      if (badge && node) badge.textContent = '×' + node.count;
    });
    const node = S.pathMap.get(pathKey(path));
    if (node) { node.classList.add('running'); ensureVisible(node); }
  }

  function setRunning(on) {
    S.running = on;
    document.body.classList.toggle('is-running', on);
    els.btnRun.hidden = on;
    els.btnStop.hidden = !on;
    els.btnClear.disabled = on;
    els.palette.querySelectorAll('.pal-item').forEach((b) => b.setAttribute('aria-disabled', on ? 'true' : 'false'));
    els.programRoot.querySelectorAll('.loop-count').forEach((b) => { b.disabled = on; });
    if (on) disarmClear();
    // odak gizlenen düğmede kalmasın
    const ae = document.activeElement;
    if (on && ae === els.btnRun) els.btnStop.focus();
    else if (!on && ae === els.btnStop) els.btnRun.focus();
  }

  async function run() {
    if (S.running) return;
    if (!S.program.length) {
      say('Önce blok ekle! 👇', 'hint', 2600);
      flash(els.programPanel, 'shake');
      return;
    }
    if (!CodeGame.Blocks || typeof CodeGame.Blocks.run !== 'function') {
      say('Oyun yüklenemedi 😕', 'error');
      return;
    }
    const runId = ++S.runId;
    setRunning(true);
    clearMarks();
    hideBubble();
    const world = new CodeGame.World(S.level);
    S.world = world;
    S.renderer.setWorld(world);
    S.dirty = true;
    updateGemChip();
    await wait(200);
    if (runId !== S.runId) return;

    const ms = SPEEDS[S.speed] || SPEEDS.slow;
    const program = JSON.parse(JSON.stringify(S.program));
    const tracer = trace(S.program, [], {});
    let gen;
    try {
      gen = CodeGame.Blocks.run(program, world, { maxSteps: MAX_STEPS });
    } catch (err) {
      return fail(err, world, ms, runId);
    }
    for (;;) {
      let step;
      try {
        step = gen.next();
      } catch (err) {
        return fail(err, world, ms, runId);
      }
      if (runId !== S.runId) return;
      if (step.done) break;
      const v = step.value || {};
      const tr = tracer.next().value;
      const path = Array.isArray(v.path) ? v.path : [];
      highlight(path, tr && samePath(tr.path, path) ? tr.iters : null);
      if (v.action === 'pick') updateGemChip();
      await S.renderer.animate(v.action, world, ms);
      if (runId !== S.runId) return;
    }
    finish(world, runId);
  }

  async function fail(err, world, ms, runId) {
    const path = err && Array.isArray(err.path) ? err.path : null;
    clearHighlight();
    if (path) {
      const node = S.pathMap.get(pathKey(path));
      if (node) { node.classList.add('error'); ensureVisible(node); }
    }
    const msg = String((err && err.message) || '');
    let text;
    if (world.crashed) {
      text = 'Ups! Robot suya düştü 🌊';
      say(text, 'error');
      await S.renderer.crash(world, ms);
    } else if (/elmas/i.test(msg)) {
      text = 'Burada elmas yok 💎';
      say(text, 'error');
      if (typeof S.renderer.puzzled === 'function') await S.renderer.puzzled(world, ms);
    } else if (/adım|step/i.test(msg)) {
      say('Robot çok yoruldu 😴 Daha kısa bir program dene!', 'error');
    } else {
      say('Hımm, olmadı. Tekrar dene!', 'error');
      if (root.console && !(err instanceof Error && err.name === 'BlockError')) console.warn(err);
    }
    if (runId !== S.runId) return;
    setRunning(false);
  }

  function finish(world, runId) {
    clearHighlight();
    setRunning(false);
    if (world.isWon()) {
      win(runId);
    } else if (world.atGoal() && world.gems.size > 0) {
      say('Elmasları unuttun 💎', 'hint');
    } else {
      say('Robot hedefe varamadı, tekrar dene!', 'hint');
    }
  }

  function win(runId) {
    const used = countBlocks(S.program);
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
      showWin(stars, used);
    }, reducedMotion() ? 250 : 1100);
  }

  function stop() {
    if (!S.running) return;
    S.runId++;
    S.renderer.snap();
    clearHighlight();
    setRunning(false);
    say('Durdu ⏹', 'info', 1800);
  }

  function resetRobot(silent) {
    if (S.running) { S.runId++; setRunning(false); }
    S.world = new CodeGame.World(S.level);
    S.renderer.setWorld(S.world);
    S.dirty = false;
    clearMarks();
    updateGemChip();
    if (!silent) hideBubble();
  }

  function disarmClear() {
    S.clearArmed = 0;
    els.btnClear.classList.remove('confirm');
    els.clearLabel.textContent = 'Temizle';
  }
  function clearProgram() {
    if (S.running || !S.program.length) return;
    // büyük programlarda kazara silmeye karşı ikinci dokunuş
    if (countBlocks(S.program) > 3 && Date.now() - S.clearArmed > 2500) {
      S.clearArmed = Date.now();
      els.btnClear.classList.add('confirm');
      els.clearLabel.textContent = 'Emin misin?';
      setTimeout(() => { if (Date.now() - S.clearArmed >= 2500) disarmClear(); }, 2600);
      return;
    }
    S.program = [];
    programChanged();
  }

  function applySpeed() {
    const fast = S.speed === 'fast';
    els.speedIco.textContent = fast ? '🐇' : '🐢';
    els.speedLabel.textContent = fast ? 'Hızlı' : 'Yavaş';
    els.btnSpeed.setAttribute('aria-label', 'Hız: ' + (fast ? 'hızlı' : 'yavaş'));
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

  function showWin(stars, used) {
    const titles = { 3: 'Mükemmel! 🎉', 2: 'Harika! 👏', 1: 'Bravo! 👍' };
    els.winTitle.textContent = titles[stars];
    els.winStars.querySelectorAll('.win-star').forEach((s, i) => s.classList.toggle('on', i < stars));
    const last = S.index >= S.levels.length - 1;
    let text = used + ' blok kullandın.';
    if (stars < 3) text += ' ' + S.level.par + ' blokla 3 yıldız alabilirsin!';
    if (last) text += ' Bütün bölümleri bitirdin! 🏆';
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

  // ---------------- bölüm yükleme ----------------
  function loadLevel(i) {
    if (!S.levels.length) return;
    i = Math.max(0, Math.min(S.levels.length - 1, i | 0));
    if (S.running) { S.runId++; setRunning(false); }
    S.index = i;
    S.level = S.levels[i];
    store.set(KEY_LEVEL, S.level.id);
    S.program = loadProgram(S.level);
    S.world = new CodeGame.World(S.level);
    S.renderer.setWorld(S.world);
    S.dirty = false;
    disarmClear();
    renderHeader();
    renderTask();
    renderPalette();
    renderProgram();
    updateGemChip();
    hideBubble();
  }

  function startLevelIndex() {
    const lastId = store.get(KEY_LEVEL, null);
    const idx = S.levels.findIndex((l) => l.id === lastId);
    if (idx >= 0 && isUnlocked(idx)) return idx;
    // ilk yıldızsız açık bölüm
    for (let i = 0; i < S.levels.length; i++) {
      if (isUnlocked(i) && !starsFor(S.levels[i].id)) return i;
    }
    return 0;
  }

  // ---------------- başlatma ----------------
  function init() {
    const ids = ['levelNum', 'levelStars', 'btnLevels', 'levelTitle', 'levelDesc', 'gemChip', 'gemText',
      'parChip', 'parText', 'boardWrap', 'board', 'bubble', 'btnRun', 'btnStop', 'btnReset', 'btnClear',
      'clearLabel', 'btnSpeed', 'speedIco', 'speedLabel', 'programPanel', 'programScroll', 'programRoot',
      'counter', 'palettePanel', 'palette', 'dropMarker', 'levelsModal', 'levelGrid', 'totalStars',
      'winModal', 'winStars', 'winTitle', 'winText', 'btnRetry', 'btnNext', 'nextLabel'];
    els = {};
    for (const id of ids) els[id] = document.getElementById(id);

    const prog = store.get(KEY_PROGRESS, {});
    S.progress = prog && typeof prog === 'object' && !Array.isArray(prog) ? prog : {};
    S.speed = store.get(KEY_SPEED, 'slow') === 'fast' ? 'fast' : 'slow';
    applySpeed();

    S.renderer = new CodeGame.Renderer(els.board, { container: els.boardWrap });

    if (!S.levels.length || !CodeGame.World) {
      say('Bölümler yüklenemedi 😕', 'error');
      return;
    }

    // sürükle-bırak
    document.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove, { passive: false });
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    els.palette.addEventListener('contextmenu', (e) => e.preventDefault());
    els.programRoot.addEventListener('contextmenu', (e) => e.preventDefault());
    // dokunmatikte sayfanın kaymasını engelle (eski iOS için)
    document.addEventListener('touchmove', (e) => { if (D.started) e.preventDefault(); }, { passive: false });

    // klavye: palet düğmesi Enter/Boşluk ile eklenir
    els.palette.addEventListener('click', (e) => {
      const item = e.target.closest('.pal-item');
      if (item && e.detail === 0) appendBlock(item.dataset.type);
    });
    els.programRoot.addEventListener('click', (e) => {
      const badge = e.target.closest('.loop-count');
      if (badge) { e.preventDefault(); cycleLoop(badge); }
    });
    els.programRoot.addEventListener('keydown', (e) => {
      if (S.running) return;
      const blk = e.target.closest && e.target.closest('.blk');
      if (!blk || e.target !== blk) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeAt(parsePath(blk.dataset.path));
        programChanged();
        els.programRoot.focus();
      }
    });

    els.btnRun.addEventListener('click', run);
    els.btnStop.addEventListener('click', stop);
    els.btnReset.addEventListener('click', () => resetRobot(false));
    els.btnClear.addEventListener('click', clearProgram);
    els.btnSpeed.addEventListener('click', () => {
      S.speed = S.speed === 'fast' ? 'slow' : 'fast';
      store.set(KEY_SPEED, S.speed);
      applySpeed();
    });
    els.btnLevels.addEventListener('click', openLevels);
    els.levelGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.level-tile');
      if (!b || b.disabled) return;
      closeModal(els.levelsModal);
      loadLevel(Number(b.dataset.index));
    });
    els.btnRetry.addEventListener('click', () => { closeModal(els.winModal); resetRobot(false); });
    els.btnNext.addEventListener('click', () => {
      closeModal(els.winModal);
      if (S.index >= S.levels.length - 1) openLevels();
      else loadLevel(S.index + 1);
    });
    for (const m of [els.levelsModal, els.winModal]) {
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('[data-close]')) closeModal(m);
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (D.started) { clearTargetUI(); dropGhost('fade'); resetDrag(); return; }
        closeModal(els.winModal);
        closeModal(els.levelsModal);
      }
    });
    els.programRoot.tabIndex = -1;

    loadLevel(startLevelIndex());
  }

  // test ve hata ayıklama için küçük bir kapı
  CodeGame.App = {
    loadLevel: (i) => loadLevel(i),
    getProgram: () => JSON.parse(JSON.stringify(S.program)),
    get levelIndex() { return S.index; },
    get running() { return S.running; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
