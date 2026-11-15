// Rota ekranı: sektörler, sahne düğümleri, yıldızlar ve rütbe.
import { LEVELS, SECTORS, levelsOf } from '../content/levels.js';

const $ = (id) => document.getElementById(id);
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
// Yayındaki sürümü ayırt etmek için: tools/surum.js bu kodu index.html içine yazar.
const SURUM = document.querySelector('meta[name="surum"]')?.content || '';
const RANKS = [[0, 'Çaylak Pilot'], [9, 'Pilot'], [24, 'Kıdemli Pilot'], [45, 'Kaptan'], [66, 'As Kaptan']];

export class MapScreen {
  constructor({ store, sfx, onOpen }) {
    Object.assign(this, { store, sfx, onOpen });
    $('route').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level]');
      if (!b || b.classList.contains('locked')) return;
      sfx.click(); onOpen(LEVELS.find((l) => l.id === b.dataset.level));
    });
    $('soundBtn').addEventListener('click', () => { store.sound = !store.sound; sfx.enabled = store.sound; this.renderSound(); sfx.click(); });
    this.renderSound();
  }

  renderSound() { $('soundBtn').classList.toggle('off', !this.store.sound); }

  show(focusLevel) {
    $('map').hidden = false;
    this.render();
    const target = focusLevel ? document.querySelector(`.sector[data-sector="${focusLevel.sector}"]`) : document.querySelector('.sector .node.cur')?.closest('.sector');
    if (target) target.scrollIntoView({ block: 'nearest' });
  }
  hide() { $('map').hidden = true; }

  render() {
    const { store } = this, total = store.total();
    $('totalStars').textContent = total; $('maxStars').textContent = `/ ${LEVELS.length * 3}`;
    $('rank').textContent = RANKS.filter(([min]) => total >= min).pop()[1];
    const current = LEVELS.find((l) => store.isUnlocked(l, LEVELS) && store.stars(l.id) === 0);
    $('route').innerHTML = SECTORS.map((s) => {
      const levels = levelsOf(s.id);
      const open = levels.length && store.isUnlocked(levels[0], LEVELS);
      const nodes = levels.map((l, i) => {
        const st = store.stars(l.id), locked = !store.isUnlocked(l, LEVELS), cur = current && l.id === current.id;
        const cls = ['node', l.n === 8 ? 'boss' : '', cur ? 'cur' : st ? 'done' : '', locked ? 'locked' : ''].join(' ');
        const inner = locked ? svg('i-lock') : l.n === 8 ? svg('i-star') : l.n;
        const stars = [1, 2, 3].map((k) => svg('i-star', k <= st ? 'lit' : '')).join('');
        return `<div class="mn"><button class="${cls}" data-level="${l.id}" aria-label="${l.title}">${inner}</button><div class="mstars">${locked ? '' : stars}</div></div>`
          + (i < levels.length - 1 ? `<div class="seg ${st ? 'done' : ''}"></div>` : '');
      }).join('');
      const right = s.soon ? `<div class="soon">${svg('i-lock')}YAKINDA</div>` : `<div class="strack">${nodes}</div>`;
      return `<div class="sector glass ${open ? '' : 'locked'}" data-sector="${s.id}" style="--h:${s.hue}">
        <div class="planet"><b>${s.id}</b></div>
        <div class="sinfo"><small>SEKTÖR ${s.id}</small><b>${s.name}</b><span class="chip">${s.concept}</span></div>
        ${right}</div>`;
    }).join('') + `<p class="mapfoot">Her sektör yeni bir kodlama kavramı öğretir. Bir görevi geçince sıradaki açılır.${SURUM ? ` · sürüm ${SURUM}` : ''}</p>`;
  }
}
