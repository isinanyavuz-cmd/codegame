// Rota ekranı: aşağıdan yukarıya tırmanan bir yıldız haritası. Sektörler gezegen,
// görevler gezegenler arasındaki yolun üstünde düğümdür. Gemi sıradaki görevin
// önünde durur; bir görev geçilince yol boyunca yeni yerine uçar.
import { LEVELS, SECTORS, levelsOf, levelById } from '../content/levels.js';
import { ALL_LEVELS, EXTRA_LABEL, SECRET_STARS, extrasOf, findLevel, sectorStars } from '../content/extras.js';
import { rankOf } from '../content/ranks.js';
import { groupLog, welcome } from '../content/logbook.js';
import { CREW, BOTS, SHIP } from '../content/story.js';
import { robot, face, miniBot } from './copilot.js';
import { showCard, hideCard, makeCard } from './overlay.js';

const $ = (id) => document.getElementById(id);
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
// Yayındaki sürümü ayırt etmek için: tools/surum.js bu kodu index.html içine yazar.
const SURUM = document.querySelector('meta[name="surum"]')?.content || '';
const rich = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const NS = 'http://www.w3.org/2000/svg';
const SHIP_ICON = `<svg viewBox="-24 -24 48 48"><path class="flame" d="M-7 13L-4.500 27-2 13zM2 13l2.500 14L7 13z"/><path d="M0-21C3.500-15 5-7 5 3v9h-10V3c0-10 1.500-18 5-24z" fill="#e6ecf7"/><path d="M-5-2L-21 11v5l16-3zM5-2l16 13v5L5 13z" fill="#dfe6f3"/><path d="M-21 11v5l6-1.200V7zM21 11v5l-6-1.200V7z" fill="#ff6a2b"/><ellipse cx="0" cy="-6" rx="2.300" ry="5.500" fill="#2fc8ff"/></svg>`;

export class MapScreen {
  constructor({ store, sfx, music, voice, onOpen }) {
    Object.assign(this, { store, sfx, music, voice, onOpen });
    this.segs = []; this.shipLen = null; this.raf = 0;
    $('route').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level]');
      if (!b) return;
      const level = findLevel(b.dataset.level);
      if (b.classList.contains('locked')) { if (level.extra === 'gizli') { sfx.click(); this.showSecret(level); } return; }
      sfx.click(); onOpen(level);
    });
    $('soundBtn').addEventListener('click', () => { store.sound = !store.sound; sfx.enabled = store.sound; this.renderToggles(); sfx.click(); });
    $('musicBtn').addEventListener('click', () => { store.music = !store.music; music.enabled = store.music; this.renderToggles(); sfx.click(); });
    $('voiceBtn').hidden = !voice.supported;
    $('voiceBtn').addEventListener('click', () => {
      store.voice = !store.voice; voice.enabled = store.voice; this.renderToggles(); sfx.click();
      if (store.voice) voice.say('Sesli okuma açık. Görevleri sana ben okuyacağım.');
    });
    // Köprü: rota ekranının altındaki çubuk. Yeni ekranlar buraya eklenir.
    this.dock = [
      { id: 'crew', icon: 'i-crew', label: 'Mürettebat', run: () => this.showCrew() },
      { id: 'log', icon: 'i-book', label: 'Günlük', run: () => this.showLog() },
    ];
    $('dock').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dock]'), item = b && this.dock.find((d) => d.id === b.dataset.dock);
      if (item) { sfx.click(); item.run(); }
    });
    let timer = 0;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (!$('map').hidden) this.render(false); }, 150); });
    this.renderToggles();
  }

  renderToggles() {
    $('soundBtn').classList.toggle('off', !this.store.sound);
    $('musicBtn').classList.toggle('off', !this.store.music);
    $('voiceBtn').classList.toggle('off', !this.store.voice);
  }

  renderDock() {
    $('dock').innerHTML = this.dock.map((d) => `<button data-dock="${d.id}">${svg(d.icon)}<span>${d.label}</span>${d.badge?.() ? `<i>${d.badge()}</i>` : ''}</button>`).join('');
  }

  /** Mürettebat: kurtarılanlar yüzleri ve sözleriyle, ötekiler siluet olarak. */
  showCrew() {
    const { store } = this;
    const people = CREW.map((c) => (store.hasCrew(c.id)
      ? `<li>${face(c.hue)}<div><b>${c.name}</b><small>${c.role}</small><p>“${c.line}”</p></div></li>`
      : `<li class="lost">${face(c.hue, { lost: true })}<div><b>Kayıp</b><small>${c.sector}. sektörün finalinde</small></div></li>`)).join('');
    const bots = BOTS.map((b) => (store.hasCrew(b.id) ? `<span>${miniBot(b.hue)}<b>${b.name}</b></span>` : `<span class="lost">${miniBot(0, { lost: true })}<b>?</b></span>`)).join('');
    const found = CREW.filter((c) => store.hasCrew(c.id)).length;
    showCard(makeCard(`<span class="tag">${SHIP.toLocaleUpperCase('tr')} MÜRETTEBATI · ${found} / ${CREW.length}</span><h1>Köprü</h1>
      <ul class="crew">${people}</ul>
      <div class="bots"><small>BİP'İN ARKADAŞLARI · gizli görevlerde saklanıyorlar</small><div>${bots}</div></div>
      <div class="btns"><button class="btn primary" data-act="close">Tamam</button></div>`, () => { this.sfx.click(); hideCard(); }, 'wide'));
  }

  /** Kilitli gizli görev: nasıl açılacağını söyler. */
  showSecret(level) {
    const got = sectorStars(this.store, level.sector), name = SECTORS.find((x) => x.id === level.sector).name;
    showCard(makeCard(`<div class="who">${robot('think')}<span class="tag">${EXTRA_LABEL.gizli}</span></div><h1>Burada bir şey saklı…</h1>
      <p><b>${name}</b> sektöründe <b>${SECRET_STARS} yıldız</b> toplarsan bu gizli görev açılır. Şu an ${got} yıldızın var.</p>
      <div class="btns"><button class="btn primary" data-act="close">Tamam</button></div>`, () => { this.sfx.click(); hideCard(); }));
  }

  show() {
    this.renderToggles();
    $('map').hidden = false;
    this.render(true);
    this.greet();
  }

  /** Oyuna yeni bir günde dönen çocuğu günlükten bir özetle karşılar (sayfa açılışında bir kez). */
  greet() {
    if (this.greeted) return;
    this.greeted = true;
    const next = this.current();
    const w = welcome(this.store.log(), { levelById, sectorName: (id) => SECTORS.find((s) => s.id === id).name, next });
    if (!w) return;
    showCard(makeCard(`<div class="who">${robot('happy')}<span class="tag">KAPTAN GÜNLÜĞÜ</span></div><h1>Tekrar hoş geldin!</h1>
      <p>${rich(w.text)}</p><div class="hooks"><p>${rich(w.next)}</p></div>
      <div class="btns"><button class="btn" data-act="close">Rotaya bak</button>${next ? `<button class="btn primary" data-act="go">Devam et${svg('i-play')}</button>` : ''}</div>`, (act) => {
      this.sfx.click(); hideCard(); this.voice.stop();
      if (act === 'go') this.onOpen(next);
    }));
    this.voice.say(`Tekrar hoş geldin! ${w.text} ${w.next}`);
  }

  /** Kaptan günlüğü: son günlerde geçilen ve sonraya bırakılan görevler. */
  showLog() {
    const groups = groupLog(this.store.log()).slice(0, 6), stars = (n) => [1, 2, 3].map((i) => svg('i-star', i <= n ? 'lit' : '')).join('');
    const rows = groups.map((g) => `<h3>${g.label}</h3><ul>${g.entries.slice(0, 10).map((e) => {
      const level = levelById(e.id);
      if (!level) return '';
      return e.kind === 'skip'
        ? `<li class="skip"><span>${level.id}</span><b>${level.title}</b><i>sonraya bırakıldı</i></li>`
        : `<li><span>${level.id}</span><b>${level.title}</b><i class="mstars">${stars(e.stars)}</i></li>`;
    }).join('')}</ul>`).join('');
    showCard(makeCard(`<div class="who">${robot('idle')}<span class="tag">KAPTAN GÜNLÜĞÜ</span></div><h1>Uçuş kayıtların</h1>
      ${rows ? `<div class="loglist">${rows}</div>` : '<p>Henüz kayıt yok. İlk görevini geçince burada görünecek.</p>'}
      <div class="btns"><button class="btn primary" data-act="close">Tamam</button></div>`, () => { this.sfx.click(); hideCard(); }));
  }
  hide() { $('map').hidden = true; cancelAnimationFrame(this.raf); }

  /** Sıradaki görev: açık olup henüz geçilmemiş ilk görev; sonraya bırakılanlar en sona kalır. */
  current() {
    const open = LEVELS.filter((l) => this.store.isUnlocked(l, LEVELS) && this.store.stars(l.id) === 0);
    return open.find((l) => !this.store.isSkipped(l.id)) || open[0] || null;
  }

  // ---------- yerleşim ----------
  render(travel) {
    const { store } = this, route = $('route'), total = store.total();
    $('totalStars').textContent = total; $('maxStars').textContent = `/ ${ALL_LEVELS.length * 3}`;
    this.renderDock();
    $('rank').textContent = rankOf(total);

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
        // Son sektörün yolu büyük hedef gezegende biter; son düğüm ona değmesin diye pay bırakılır.
        const at = g.start + g.len * ((k + 1) / (levels.length + (i === sectors.length - 1 ? 1.8 : 1)));
        lenOf.set(l.id, at);
        const p = this.pointAt(at), st = store.stars(l.id), locked = !store.isUnlocked(l, LEVELS), isCur = cur && l.id === cur.id;
        const cls = ['node', l.n === 8 ? 'boss' : '', isCur ? 'cur' : st ? 'done' : '', locked ? 'locked' : '', store.isSkipped(l.id) ? 'skipped' : ''].join(' ');
        const inner = locked ? svg('i-lock') : l.n === 8 ? svg('i-star') : l.n;
        const stars = locked ? '' : [1, 2, 3].map((n) => svg('i-star', n <= st ? 'lit' : '')).join('');
        html.push(`<div class="mn" style="left:${p.x}px;top:${p.y}px"><button class="${cls}" data-level="${l.id}" title="${l.title}" aria-label="Görev ${l.id}: ${l.title}">${inner}</button><div class="mstars">${stars}</div></div>`);
      });
      // Yan görevler: bağlı oldukları ana görevin yanında, yoldan dışarıda durur.
      for (const x of extrasOf(s.id)) {
        const at = lenOf.get(x.after), unlocked = store.isUnlocked(x, LEVELS);
        // Gizli görev sektör açılınca kilitli görünür (hedef olsun); acil durum açılmadan görünmez.
        if (at === undefined || !open || (x.extra === 'acil' && !unlocked)) continue;
        const p = this.pointAt(at), q = this.pointAt(at + 3), len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const tx = (q.x - p.x) / len, ty = (q.y - p.y) / len, toCentre = Math.sign(W / 2 - p.x) || 1;
        // Yola dik iki yönden yukarı ve haritanın ortasına bakanı seçilir: gezegen etiketlerine değmesin.
        const score = (nx, ny) => ny - toCentre * nx * 0.6;
        const [nx, ny] = score(-ty, tx) < score(ty, -tx) ? [-ty, tx] : [ty, -tx], D = narrow ? 54 : 66;
        const sx = p.x + nx * D, sy = p.y + ny * D, st = store.stars(x.id);
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('class', 'rside'); line.setAttribute('x1', p.x); line.setAttribute('y1', p.y); line.setAttribute('x2', sx); line.setAttribute('y2', sy);
        root.append(line);
        const cls = ['node', st ? 'done' : '', unlocked ? '' : 'locked'].join(' ');
        const inner = !unlocked ? svg('i-lock') : x.extra === 'gizli' ? '?' : '!';
        const under = unlocked ? `<div class="mstars">${[1, 2, 3].map((n) => svg('i-star', n <= st ? 'lit' : '')).join('')}</div>` : `<small>${SECRET_STARS}${svg('i-star')}</small>`;
        html.push(`<div class="mn side ${x.extra}" style="left:${sx}px;top:${sy}px"><button class="${cls}" data-level="${x.id}" title="${x.title}" aria-label="${EXTRA_LABEL[x.extra]}: ${x.title}">${inner}</button>${under}</div>`);
      }
    });
    const last = sectors.length;
    html.push(`<div class="nova" style="left:${xs(last)}px;top:${ys[last]}px"><i></i><div><small>HEDEF GEZEGEN</small><b>NOVA</b></div></div>`);
    html.push(`<div class="shipmark" id="shipmark">${SHIP_ICON}${cur ? `<span>Sıradaki: <b>${cur.title}</b></span>` : ''}</div>`);
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
