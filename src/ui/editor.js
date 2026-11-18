// Blok düzenleyici: paleti ve programı çizer; sürükle-bırak, dokunarak ekleme,
// sayı ve koşul seçimi, silme ve geri alma işlerini yürütür. Fare ve dokunmatik çalışır.
import { ACTIONS, CONDS, EVENTS, FUNCTIONS, TOOLS, isAction, create, count, find, remove, listOf } from '../engine/blocks.js';

const icon = (id, cls = '') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 32 32');
  if (cls) s.setAttribute('class', cls);
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', `#${id}`); s.append(u);
  return s;
};
function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.append(...kids);
  return e;
}

// Her bloğun simgesi: yazıyı okumadan da ne yaptığı anlaşılsın.
const ICONS = {
  fwd: 'i-up', left: 'i-upl', right: 'i-upr', shield: 'i-shield', fire: 'i-laser', setEnergy: 'i-bolt', addEnergy: 'i-bolt', setCounter: 'i-count', addCounter: 'i-count',
  repeat: 'i-loop', forever: 'i-inf', ifelse: 'i-if', until: 'i-flag', on: 'i-event', define: 'i-fn', call: 'i-call',
};
const sign = (type) => icon(ICONS[type], 'bi');

/** Bir bloğun (ve içindekilerin) görünümünü kurar. */
export function renderBlock(b) {
  // İpucu iskeletindeki gizli komut
  if (b.type === 'gizli') return h('div', 'blk hole', '?');
  const number = (value) => { const e = h('span', 'num', String(value)); e.dataset.num = '1'; return e; };
  const choice = (key, label) => { const e = h('span', 'pick choice', label); e.dataset.choice = key; return e; };
  if (isAction(b.type) || b.type === 'call') {
    let e;
    // Sayı alan manevranın çağrısı sayıyı da gösterir: "zikzak ( 2 ) çağır"
    if (b.type === 'call') e = h('div', 'blk fun', sign('call'), choice('name', FUNCTIONS[b.name].label), ...(b.arg === undefined ? [] : [number(b.arg)]), 'çağır');
    else if (b.type === 'setEnergy') e = h('div', 'blk variable', sign(b.type), 'enerji =', number(b.value));
    else if (b.type === 'addEnergy') e = h('div', 'blk variable', sign(b.type), 'enerjiye', number(b.value), 'ekle');
    else if (b.type === 'setCounter') e = h('div', 'blk variable counter', sign(b.type), 'sayaç =', number(b.value));
    else if (b.type === 'addCounter') e = h('div', 'blk variable counter', sign(b.type), 'sayacı', number(b.value), 'artır');
    else e = h('div', `blk mov${b.type === 'fire' ? ' fire' : ''}`, sign(b.type), ACTIONS[b.type].label);
    e.dataset.id = b.id; return e;
  }
  const c = h('div', `c ${b.type === 'on' ? 'ev' : b.type === 'define' ? 'fun' : 'ctl'}`); c.dataset.id = b.id;
  const body = (key) => {
    const l = h('div', 'body'); l.dataset.list = key; l.dataset.parent = b.id;
    for (const k of b[key] || []) l.append(renderBlock(k));
    return l;
  };
  if (b.type === 'repeat') {
    const num = h('span', 'num', String(b.count)); num.dataset.num = '1';
    c.append(h('div', 'blk', sign('repeat'), num, 'kez tekrarla'), body('body'), h('div', 'cap'));
  } else if (b.type === 'forever') {
    c.append(h('div', 'blk', sign('forever'), 'sürekli tekrarla'), body('body'), h('div', 'cap'));
  } else if (b.type === 'on') {
    c.append(h('div', 'blk', sign('on'), choice('event', EVENTS[b.event].label)), body('body'), h('div', 'cap'));
  } else if (b.type === 'define') {
    c.append(h('div', 'blk', sign('define'), choice('name', FUNCTIONS[b.name].label), ...(b.param ? [h('span', 'param', 'n')] : []), 'tanımla'), body('body'), h('div', 'cap'));
  } else if (b.type === 'ifelse' || b.type === 'until') {
    const cond = h('span', `cond pick${b.cond ? '' : ' empty'}`, b.cond ? CONDS[b.cond].label : 'koşul seç'); cond.dataset.cond = '1';
    if (b.type === 'until') c.append(h('div', 'blk', sign('until'), cond, 'olana kadar'), body('body'), h('div', 'cap'));
    else c.append(h('div', 'blk', sign('ifelse'), 'eğer', cond, 'ise'), body('then'), h('div', 'blk mid', 'değilse'), body('else'), h('div', 'cap'));
  }
  return c;
}

export function hatBlock() { return h('div', 'blk ev', icon('i-play'), 'kalkışta'); }


export class Editor {
  /**
   * @param o.ws, o.pal, o.pop  çalışma alanı, palet ve açılır kutu öğeleri
   * @param o.onChange          program değişince çağrılır
   * @param o.onTouch           çocuk düzenlemeye başlayınca çağrılır (uçuşu durdurmak için)
   * @param o.notify(kind)      'full' (blok sınırı), 'condtip', 'add', 'remove'
   */
  constructor(o) {
    Object.assign(this, o);
    this.program = []; this.history = []; this.level = null; this.drag = null; this.selected = null;
    this.ws.addEventListener('pointerdown', (e) => this.down(e));
    this.pal.addEventListener('pointerdown', (e) => this.down(e));
    document.addEventListener('pointermove', (e) => this.move(e));
    document.addEventListener('pointerup', (e) => this.up(e));
    document.addEventListener('pointercancel', () => this.endDrag(false));
    document.addEventListener('pointerdown', (e) => { if (!this.pop.hidden && !this.pop.contains(e.target)) this.closePop(); }, true);
    this.ws.addEventListener('click', (e) => { if (e.target.closest('.del') && this.selected) this.deleteBlock(this.selected); });
  }

  /**
   * @param library  bu görevde tanımlamadan çağrılabilen manevraların adları (otopilot kitaplığı)
   * @param locked   program yalnızca okunur (tahmin turu)
   */
  load(level, program, library = [], locked = false) {
    this.level = level; this.program = program; this.history = []; this.selected = null; this.library = library; this.locked = locked;
    this.ws.classList.toggle('multi', level.conds.length > 1);
    this.closePop(); this.render(); this.renderPalette();
  }

  render() {
    const top = this.ws.scrollTop;
    this.ws.replaceChildren();
    const stack = h('div', 'stack', hatBlock()); stack.dataset.list = 'root'; stack.dataset.parent = '';
    for (const b of this.program) stack.append(renderBlock(b));
    this.ws.append(stack); this.stack = stack; this.ws.scrollTop = top;
    this.selected = null;
  }

  renderPalette() {
    this.pal.replaceChildren();
    for (const t of this.level.tools) {
      const cls = ['define', 'call'].includes(t) ? 'fun' : t === 'on' ? 'ev' : ['setEnergy', 'addEnergy'].includes(t) ? 'variable' : ['setCounter', 'addCounter'].includes(t) ? 'variable counter' : t === 'fire' ? 'mov fire' : isAction(t) ? 'mov' : 'ctl';
      const e = h('div', `blk ${cls}`, sign(t), isAction(t) ? ACTIONS[t].label : TOOLS[t]);
      e.dataset.tool = t; this.pal.append(e);
    }
    // Kitaplıktaki manevralar: tanımlamadan çağrılır.
    for (const name of this.library) {
      const e = h('div', 'blk fun lib', icon('i-book', 'bi'), `${FUNCTIONS[name].label} çağır`);
      e.dataset.tool = 'call'; e.dataset.name = name; this.pal.append(e);
    }
    // Tek sensör varsa palette gösterilir; birden çoksa "eğer" bloğundaki koşula dokunarak seçilir.
    if (this.level.conds.length === 1) { const e = h('span', 'cond', CONDS[this.level.conds[0]].label); e.dataset.condtool = this.level.conds[0]; this.pal.append(e); }
    // Blok sayısı çoksa palet sıkışık çizilir; hepsi kaydırmadan görünsün.
    this.pal.classList.toggle('dense', this.pal.children.length > 6);
  }

  // ---------- vurgular ----------
  el(id) { return id ? this.ws.querySelector(`[data-id="${id}"]`) : null; }
  /** Blokları vurgular: [{ id, cls }] (cls: now, sensing, err). Öncekiler silinir. */
  markAll(list) {
    for (const e of this.ws.querySelectorAll('.now, .sensing, .err')) e.classList.remove('now', 'sensing', 'err');
    let last = null;
    for (const { id, cls } of list) {
      const e = this.el(id);
      if (!e || !cls) continue;
      last = e.classList.contains('c') ? e.firstElementChild : e;
      last.classList.add(cls);
    }
    if (!last) return;
    const r = last.getBoundingClientRect(), w = this.ws.getBoundingClientRect();
    if (r.top < w.top + 8 || r.bottom > w.bottom - 8) last.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  mark(id, cls) { this.markAll(id && cls ? [{ id, cls }] : []); }

  select(id) {
    for (const e of this.ws.querySelectorAll('.sel')) e.classList.remove('sel');
    for (const e of this.ws.querySelectorAll('.del')) e.remove();
    this.selected = id;
    const e = this.el(id);
    if (!e) { this.selected = null; return; }
    e.classList.add('sel');
    const del = h('button', 'del', icon('i-trash')); del.setAttribute('aria-label', 'Sil');
    (e.classList.contains('c') ? e.firstElementChild : e).append(del);
  }

  // ---------- değişiklikler ----------
  snapshot() {
    this.history.push(JSON.stringify(this.program));
    if (this.history.length > 60) this.history.shift();
  }
  changed() { this.render(); this.onChange(); }
  undo() {
    const last = this.history.pop();
    if (!last) return;
    this.program = JSON.parse(last);
    this.changed();
  }
  canAdd(block) {
    if (count(this.program) + count([block]) <= this.level.maxBlocks) return true;
    this.notify('full'); return false;
  }
  newBlock(type, name = null) {
    const { conds, events, functions } = this.level;
    // "Olana kadar" çoğunlukla işareti bekler; "eğer" ise yol seçen bir sensörle başlar.
    return create(type, { cond: conds.find((c) => c !== 'atBeacon') || conds[0] || null, untilCond: conds.includes('atBeacon') ? 'atBeacon' : conds[0], event: events?.[0], name: name || functions?.[0], params: !!this.level.params });
  }
  deleteBlock(id) { this.snapshot(); remove(this.program, id); this.notify('remove'); this.changed(); }

  // ---------- sürükleme ----------
  down(e) {
    if (this.locked || e.button > 0 || e.target.closest('.del')) return;
    const tool = e.target.closest('[data-tool]'), condTool = e.target.closest('[data-condtool]');
    const blockEl = e.target.closest('[data-id]');
    let src = null;
    if (tool) src = { kind: 'new', type: tool.dataset.tool, name: tool.dataset.name, el: tool };
    else if (condTool) src = { kind: 'cond', cond: condTool.dataset.condtool, el: condTool };
    else if (blockEl && this.ws.contains(blockEl)) src = { kind: 'move', id: blockEl.dataset.id, el: blockEl };
    if (!src) { this.select(null); return; }
    this.onTouch();
    const r = src.el.getBoundingClientRect();
    this.drag = { src, x0: e.clientX, y0: e.clientY, pid: e.pointerId, active: false, hit: e.target, dx: e.clientX - r.left, dy: e.clientY - r.top, target: null };
    if (e.pointerType === 'mouse') e.preventDefault();
  }

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return;
      this.beginDrag(d);
    }
    d.ghost.style.left = `${e.clientX - d.dx}px`; d.ghost.style.top = `${e.clientY - d.dy}px`;
    this.locate(e.clientX, e.clientY);
    // çalışma alanı kenarlarında otomatik kaydır
    const w = this.ws.getBoundingClientRect();
    if (e.clientY > w.bottom - 34 && e.clientY < w.bottom + 20) this.ws.scrollTop += 9;
    else if (e.clientY < w.top + 34 && e.clientY > w.top - 20) this.ws.scrollTop -= 9;
  }

  beginDrag(d) {
    d.active = true; this.select(null); this.closePop();
    let inner;
    if (d.src.kind === 'new') { d.block = this.newBlock(d.src.type, d.src.name); inner = renderBlock(d.block); d.dx = 14; d.dy = 19; }
    else if (d.src.kind === 'move') { d.block = find(this.program, d.src.id).block; inner = d.src.el.cloneNode(true); d.src.el.classList.add('dragging'); }
    else inner = d.src.el.cloneNode(true);
    for (const e of [inner, ...inner.querySelectorAll('*')]) e.classList.remove('now', 'sensing', 'err', 'sel');
    d.ghost = h('div', 'ghost', inner);
    if (d.src.kind !== 'cond') inner.style.zoom = 'var(--bz)';
    document.body.append(d.ghost);
    d.marker = h('div', 'marker');
  }

  /** İmlecin altındaki bırakma yerini bulur ve işaretler. */
  locate(x, y) {
    const d = this.drag, under = document.elementFromPoint(x, y);
    d.marker.remove(); d.target = null;
    for (const e of this.ws.querySelectorAll('.condhit')) e.classList.remove('condhit', 'sensing');
    const inWs = !!under && this.ws.contains(under);
    this.ws.classList.toggle('over', inWs);
    if (d.src.kind === 'cond') {
      const ifEl = under && under.closest('.c[data-id]'), hit = ifEl && find(this.program, ifEl.dataset.id);
      if (hit && ['ifelse', 'until'].includes(hit.block.type)) { d.target = { ifId: hit.block.id }; ifEl.firstElementChild.classList.add('condhit', 'sensing'); }
      return;
    }
    let list = under && under.closest('[data-list]');
    if (!list && inWs) list = this.stack;
    if (list && !this.ws.contains(list)) list = null;
    d.ghost.classList.toggle('del', !list && d.src.kind === 'move');
    if (!list) return;
    if (d.src.kind === 'move' && d.src.el.contains(list)) { d.target = 'self'; return; }
    const kids = [...list.children].filter((k) => k.dataset.id && k !== d.src.el);
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { index = i; break; }
    }
    if (index < kids.length) list.insertBefore(d.marker, kids[index]); else list.append(d.marker);
    d.target = { parent: list.dataset.parent || null, key: list.dataset.list, index };
  }

  up(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.active) { this.drag = null; this.tap(d); return; }
    this.endDrag(true);
  }

  endDrag(commit) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (!d.active) return;
    d.ghost.remove(); d.marker.remove(); this.ws.classList.remove('over');
    d.src.el.classList.remove('dragging');
    for (const e of this.ws.querySelectorAll('.condhit')) e.classList.remove('condhit', 'sensing');
    if (!commit) return;
    const { src, target, block } = d;
    if (src.kind === 'cond') {
      if (!target) return;
      this.snapshot(); find(this.program, target.ifId).block.cond = src.cond; this.notify('add'); this.changed();
    } else if (target === 'self') {
      return;
    } else if (target) {
      if (src.kind === 'new' && !this.canAdd(block)) return;
      this.snapshot();
      if (src.kind === 'move') remove(this.program, src.id);
      listOf(this.program, target.parent, target.key).splice(target.index, 0, block);
      this.notify('add'); this.changed();
    } else if (src.kind === 'move') {
      this.deleteBlock(src.id);
    }
  }

  // ---------- dokunma ----------
  tap(d) {
    const { src } = d;
    if (src.kind === 'new') {
      const block = this.newBlock(src.type, src.name);
      if (!this.canAdd(block)) return;
      this.snapshot(); this.program.push(block); this.notify('add'); this.changed();
      this.ws.scrollTop = this.ws.scrollHeight;
    } else if (src.kind === 'cond') {
      const sel = this.selected && find(this.program, this.selected);
      if (sel && ['ifelse', 'until'].includes(sel.block.type)) { this.snapshot(); sel.block.cond = src.cond; this.notify('add'); this.changed(); }
      else this.notify('condtip');
    } else {
      const hit = find(this.program, src.id);
      if (!hit) return;
      if (d.hit.closest('[data-num]') && d.hit.closest('[data-id]') === src.el) this.openNums(hit.block, d.hit.closest('[data-num]'));
      else if (d.hit.closest('[data-cond]') && d.hit.closest('[data-id]') === src.el && this.level.conds.length > 1) this.openConds(hit.block, d.hit.closest('[data-cond]'));
      else if (d.hit.closest('[data-choice]') && d.hit.closest('[data-id]') === src.el) this.openChoices(hit.block, d.hit.closest('[data-choice]'));
      else this.select(this.selected === src.id ? null : src.id);
    }
  }

  // ---------- açılır kutular ----------
  openPop(anchor, cls, items) {
    this.pop.className = `pop glass ${cls}`; this.pop.replaceChildren(...items); this.pop.hidden = false;
    const a = anchor.getBoundingClientRect(), p = this.pop.getBoundingClientRect();
    let x = a.left + a.width / 2 - p.width / 2, y = a.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - p.width - 8, x));
    if (y + p.height > window.innerHeight - 8) y = a.top - p.height - 10;
    this.pop.style.left = `${x}px`; this.pop.style.top = `${y}px`;
  }
  closePop() { this.pop.hidden = true; }
  openNums(block, anchor) {
    const items = [];
    const key = block.type === 'repeat' ? 'count' : block.type === 'call' ? 'arg' : 'value';
    const from = block.type === 'repeat' ? 2 : ['setEnergy', 'setCounter'].includes(block.type) ? 0 : 1;
    const values = [];
    for (let n = from; n <= 9; n++) values.push(n);
    // Sayı alan bir manevranın içindeki döngü, o sayıyı (n) da kullanabilir.
    if (block.type === 'repeat' && this.program.some((d) => d.type === 'define' && d.param && find(d.body, block.id))) values.push('n');
    for (const n of values) {
      const b = h('button', n === block[key] ? 'on' : '', String(n));
      b.addEventListener('click', () => { this.closePop(); if (n === block[key]) return; this.snapshot(); block[key] = n; this.notify('add'); this.changed(); });
      items.push(b);
    }
    this.openPop(anchor, 'nums', items);
  }
  openConds(block, anchor) {
    const items = this.level.conds.map((c) => {
      const b = h('button', '', h('span', 'cond', CONDS[c].label));
      b.addEventListener('click', () => { this.closePop(); if (c === block.cond) return; this.snapshot(); block.cond = c; this.notify('add'); this.changed(); });
      return b;
    });
    this.openPop(anchor, 'conds', items);
  }

  openChoices(block, anchor) {
    const key = anchor.dataset.choice, options = key === 'event' ? this.level.events || ['pirate'] : this.level.functions || ['zigzag'];
    const labels = key === 'event' ? EVENTS : FUNCTIONS;
    const items = options.map((value) => {
      const b = h('button', block[key] === value ? 'on' : '', labels[value].label);
      b.addEventListener('click', () => { this.closePop(); if (block[key] === value) return; this.snapshot(); block[key] = value; this.notify('add'); this.changed(); });
      return b;
    });
    this.openPop(anchor, 'choices', items);
  }
}
