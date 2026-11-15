// Rota ekranı: aşağıdan yukarıya tırmanan bir yıldız haritası. Sektörler gezegen,
// görevler gezegenler arasındaki yolun üstünde düğümdür. Gemi sıradaki görevin
// önünde durur; bir görev geçilince yol boyunca yeni yerine uçar.
import { LEVELS, SECTORS, levelsOf } from '../content/levels.js';

const $ = (id) => document.getElementById(id);
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
// Yayındaki sürümü ayırt etmek için: tools/surum.js bu kodu index.html içine yazar.
const SURUM = document.querySelector('meta[name="surum"]')?.content || '';
const RANKS = [[0, 'Çaylak Pilot'], [9, 'Pilot'], [24, 'Kıdemli Pilot'], [45, 'Kaptan'], [66, 'As Kaptan'], [120, 'Uzay Kaşifi'], [192, 'Galaksi Ustası']];
const NS = 'http://www.w3.org/2000/svg';
const SHIP = `<svg viewBox="-24 -24 48 48"><path class="flame" d="M-7 13L-4.500 27-2 13zM2 13l2.500 14L7 13z"/><path d="M0-21C3.500-15 5-7 5 3v9h-10V3c0-10 1.500-18 5-24z" fill="#e6ecf7"/><path d="M-5-2L-21 11v5l16-3zM5-2l16 13v5L5 13z" fill="#dfe6f3"/><path d="M-21 11v5l6-1.200V7zM21 11v5l-6-1.200V7z" fill="#ff6a2b"/><ellipse cx="0" cy="-6" rx="2.300" ry="5.500" fill="#2fc8ff"/></svg>`;

export class MapScreen {
  constructor({ store, sfx, music, onOpen }) {
    Object.assign(this, { store, sfx, music, onOpen });
    this.segs = []; this.shipLen = null; this.raf = 0;
    $('route').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level]');
      if (!b || b.classList.contains('locked')) return;
      sfx.click(); onOpen(LEVELS.find((l) => l.id === b.dataset.level));
    });
    $('soundBtn').addEventListener('click', () => { store.sound = !store.sound; sfx.enabled = store.sound; this.renderToggles(); sfx.click(); });
    $('musicBtn').addEventListener('click', () => { store.music = !store.music; music.enabled = store.music; this.renderToggles(); sfx.click(); });
    let timer = 0;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (!$('map').hidden) this.render(false); }, 150); });
    this.renderToggles();
  }

  renderToggles() {
    $('soundBtn').classList.toggle('off', !this.store.sound);
    $('musicBtn').classList.toggle('off', !this.store.music);
  }

  show() {
    $('map').hidden = false;
    this.render(true);
  }
  hide() { $('map').hidden = true; cancelAnimationFrame(this.raf); }

  /** Sıradaki görev: açık olup henüz geçilmemiş ilk görev. */
  current() { return LEVELS.find((l) => this.store.isUnlocked(l, LEVELS) && this.store.stars(l.id) === 0) || null; }

  // ---------- yerleşim ----------
  render(travel) {
    const { store } = this, route = $('route'), total = store.total();
    $('totalStars').textContent = total; $('maxStars').textContent = `/ ${LEVELS.length * 3}`;
    $('rank').textContent = RANKS.filter(([min]) => total >= min).pop()[1];

    const W = Math.min(1040, $('map').clientWidth - 24), narrow = W < 660;
    const side = narrow ? 58 : 150, R = narrow ? 34 : 48, band = narrow ? 420 : 330, soonBand = narrow ? 210 : 230;
    const sectors = SECTORS.map((s) => ({ s, levels: levelsOf(s.id) }));
    const heights = sectors.map((x) => (x.levels.length ? band : soonBand));
    const H = heights.reduce((a, b) => a + b, 0) + 210 + (narrow ? 210 : 250);
    const xs = (i) => (i % 2 === 0 ? side : W - side);
    const ys = [H - 210];
    heights.forEach((h, i) => ys.push(ys[i] - h));
    const cur = this.current();

    // yol parçaları: her sektörün gezegeninden bir sonrakine (sonuncusu hedef gezegene)
    const root = document.createElementNS(NS, 'svg');
    root.setAttribute('class', 'rsvg'); root.setAttribute('width', W); root.setAttribute('height', H); root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    route.replaceChildren(root); route.style.width = `${W}px`; route.style.height = `${H}px`;
    this.segs = sectors.map((x, i) => {
      // Yol gezegenden yukarı doğru çıkar, sonra karşı taraftaki gezegene yandan varır
      // (dağ yolundaki virajlar gibi). Böylece gezegenin altı etiket için boş kalır.
      const x0 = xs(i), y0 = ys[i], x1 = xs(i + 1), y1 = ys[i + 1];
      const d = `M${x0} ${y0}C${x0} ${y0 - heights[i] * 0.86} ${x1 + (x0 - x1) * 0.62} ${y1} ${x1} ${y1}`;
      const base = document.createElementNS(NS, 'path'); base.setAttribute('d', d); base.setAttribute('class', 'rbase');
      const done = document.createElementNS(NS, 'path'); done.setAttribute('d', d); done.setAttribute('class', 'rdone');
      root.append(base, done);
      return { ...x, base, done, len: base.getTotalLength(), start: 0 };
    });
    let acc = 0;
    for (const g of this.segs) { g.start = acc; acc += g.len; }
    this.totalLen = acc;

    // gezegenler, etiketler, görev düğümleri
    const html = [];
    const lenOf = new Map();
    this.segs.forEach((g, i) => {
      const { s, levels } = g, x = xs(i), y = ys[i], left = i % 2 === 0;
      const open = levels.length > 0 && store.isUnlocked(levels[0], LEVELS);
      const got = levels.reduce((a, l) => a + store.stars(l.id), 0);
      html.push(`<div class="planet v${i % 4} ${open ? '' : 'dim'}" style="left:${x}px;top:${y}px;--h:${s.hue};--r:${R}px"><i></i></div>`);
      const info = s.soon || !levels.length
        ? `<span class="soon">${svg('i-lock')}YAKINDA</span>`
        : `<span class="sstars">${svg('i-star')}${got} / ${levels.length * 3}</span>`;
      const pos = narrow ? (left ? 'left:4px' : 'right:4px') : `left:${x}px`;
      html.push(`<div class="slabel ${narrow ? (left ? 'l' : 'r') : ''} ${open ? '' : 'dim'}" style="${pos};top:${y + R + 14}px"><small>SEKTÖR ${s.id}</small><b>${s.name}</b><span class="chip">${s.concept}</span>${info}</div>`);
      levels.forEach((l, k) => {
        const at = g.start + g.len * ((k + 1) / (levels.length + 1));
        lenOf.set(l.id, at);
        const p = this.pointAt(at), st = store.stars(l.id), locked = !store.isUnlocked(l, LEVELS), isCur = cur && l.id === cur.id;
        const cls = ['node', l.n === 8 ? 'boss' : '', isCur ? 'cur' : st ? 'done' : '', locked ? 'locked' : ''].join(' ');
        const inner = locked ? svg('i-lock') : l.n === 8 ? svg('i-star') : l.n;
        const stars = locked ? '' : [1, 2, 3].map((n) => svg('i-star', n <= st ? 'lit' : '')).join('');
        html.push(`<div class="mn" style="left:${p.x}px;top:${p.y}px"><button class="${cls}" data-level="${l.id}" title="${l.title}" aria-label="Görev ${l.id}: ${l.title}">${inner}</button><div class="mstars">${stars}</div></div>`);
      });
    });
    const last = sectors.length;
    html.push(`<div class="nova" style="left:${xs(last)}px;top:${ys[last]}px"><i></i><div><small>HEDEF GEZEGEN</small><b>NOVA</b></div></div>`);
    html.push(`<div class="shipmark" id="shipmark">${SHIP}${cur ? `<span>Sıradaki: <b>${cur.title}</b></span>` : ''}</div>`);
    html.push(`<p class="mapfoot" style="top:${H - 46}px">Her sektör yeni bir kodlama kavramı öğretir. Bir görevi geçince sıradaki açılır.${SURUM ? ` · sürüm ${SURUM}` : ''}</p>`);
    route.insertAdjacentHTML('beforeend', html.join(''));

    // gemi: sıradaki görevin hemen önünde; hepsi bittiyse son görevin üstünde
    const playable = LEVELS.filter((l) => lenOf.has(l.id));
    const target = cur ? lenOf.get(cur.id) - (narrow ? 30 : 38) : playable.length ? lenOf.get(playable[playable.length - 1].id) : 0;
    const from = travel && this.shipLen !== null && Math.abs(this.shipLen - target) > 4 ? this.shipLen : null;
    cancelAnimationFrame(this.raf);
    if (from === null) { this.placeShip(target); this.scrollTo(target, false); } else this.fly(from, target);
  }

  /** Yolun başından `len` uzaklıktaki nokta. */
  pointAt(len) {
    const L = Math.max(0, Math.min(this.totalLen - 0.01, len));
    const g = this.segs.find((s) => L < s.start + s.len) || this.segs[this.segs.length - 1];
    return g.base.getPointAtLength(L - g.start);
  }

  placeShip(len) {
    this.shipLen = len;
    const p = this.pointAt(len), q = this.pointAt(len + 2), el = $('shipmark');
    const angle = Math.atan2(q.x - p.x, -(q.y - p.y)) * 180 / Math.PI;
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    el.firstElementChild.style.transform = `rotate(${angle}deg)`;
    for (const g of this.segs) {
      const part = Math.max(0, Math.min(g.len, len - g.start));
      g.done.style.strokeDasharray = `${part} ${g.len + 10}`;
      g.done.style.visibility = part > 0.5 ? 'visible' : 'hidden';
    }
  }

  scrollTo(len, smooth) {
    const p = this.pointAt(len), box = $('map');
    const top = $('route').offsetTop + p.y - box.clientHeight * 0.58;
    box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }

  /** Gemi yol boyunca eski yerinden yenisine uçar. */
  fly(from, to) {
    const el = $('shipmark'); el.classList.add('flying');
    this.placeShip(from); this.scrollTo(from, false);
    const dur = Math.max(700, Math.min(2200, Math.abs(to - from) * 6)), t0 = performance.now();
    this.sfx.travel(dur / 1000);
    this.scrollTo(to, true);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.placeShip(from + (to - from) * e);
      if (k < 1) this.raf = requestAnimationFrame(step); else el.classList.remove('flying');
    };
    this.raf = requestAnimationFrame(step);
  }
}
