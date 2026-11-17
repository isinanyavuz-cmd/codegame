// Hangar ekranı: geminin görünümü, rütbe, sektör armaları, otopilot kitaplığı ve sertifika.
import { PARTS, PART_KEYS, lookOf, nextUnlock } from '../content/hangar.js';
import { rankOf, nextRank, RANKS } from '../content/ranks.js';
import { SECTORS } from '../content/levels.js';
import { ALL_LEVELS } from '../content/extras.js';
import { CREW } from '../content/story.js';
import { FUNCTIONS } from '../engine/blocks.js';
import { renderBlock } from './editor.js';
import { shipSvg } from './shipart.js';
import { robot } from './copilot.js';
import { showCard, hideCard, makeCard } from './overlay.js';

const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Geçilen sektörler (finali geçilmiş olanlar). */
const doneSectors = (store) => SECTORS.filter((s) => store.stars(`${s.id}-8`) > 0);

export class Hangar {
  /** @param o.onLook(look)  görünüm değişince çağrılır (sahnedeki gemi ve rota işareti güncellensin) */
  constructor({ store, sfx, onLook }) { Object.assign(this, { store, sfx, onLook }); }

  look() { return lookOf(this.store.ship, this.store.total()); }

  /** Henüz bakılmamış yeni parça sayısı (köprüdeki rozet). */
  fresh() {
    const total = this.store.total(), seen = this.store.ship.seenAt || 0;
    return PART_KEYS.reduce((a, key) => a + PARTS[key].options.filter((o) => o.need > seen && o.need <= total).length, 0);
  }

  open() {
    const { store } = this, total = store.total();
    if ((store.ship.seenAt || 0) !== total) store.setShip('seenAt', total);
    const rank = rankOf(total), next = nextRank(total), from = [...RANKS].reverse().find(([min]) => total >= min)[0];
    const pct = next ? Math.round(100 * (total - from) / (total + next.need - from)) : 100;
    const upcoming = nextUnlock(total);
    const patches = SECTORS.map((s) => {
      const done = store.stars(`${s.id}-8`) > 0;
      return `<span class="patch ${done ? '' : 'off'}" style="--h:${s.hue}" title="${s.name}"><b>${done ? s.id : svg('i-lock')}</b></span>`;
    }).join('');
    const hasLib = Object.keys(store.library()).length > 0;
    const card = makeCard(`<span class="tag">HANGAR</span><h1>${rank}</h1>
      <div class="rankbar"><i style="width:${pct}%"></i></div>
      <p class="fine">${next ? `Sıradaki rütbe <b>${next.name}</b>: ${next.need} yıldız kaldı.` : 'En yüksek rütbedesin!'}${upcoming ? ` Yeni parça: <b>${upcoming.option.name}</b> (${upcoming.label.toLocaleLowerCase('tr')}) için ${upcoming.need} yıldız.` : ''}</p>
      <div class="hangar"><div class="preview" id="hgPreview"></div><div class="parts" id="hgParts"></div></div>
      <div class="patches"><small>SEKTÖR ARMALARI</small><div>${patches}</div></div>
      <div class="btns">${hasLib ? `<button class="btn" data-act="lib">${svg('i-fn')}Kitaplığım</button>` : ''}<button class="btn" data-act="cert">${svg('i-star')}Sertifika</button><button class="btn primary" data-act="close">Tamam</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'lib') this.openLibrary(); else if (act === 'cert') this.openCertificate(); else hideCard();
    }, 'wide');
    card.addEventListener('click', (e) => { const pick = e.target.closest('[data-part]'); if (pick) this.pick(pick.dataset.part, pick.dataset.option); });
    showCard(card);
    this.renderParts();
  }

  renderParts() {
    const total = this.store.total(), look = this.look(), box = document.getElementById('hgParts');
    if (!box) return;
    document.getElementById('hgPreview').innerHTML = shipSvg(look);
    box.innerHTML = PART_KEYS.map((key) => {
      const options = PARTS[key].options.map((o) => {
        const locked = o.need > total, on = look[key].id === o.id;
        const face = key === 'shape' ? shipSvg({ ...look, shape: o }) : `<i style="background:${o.color}"></i>`;
        return `<button class="swatch ${key === 'shape' ? 'shape' : ''} ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-part="${key}" data-option="${o.id}" title="${o.name}" aria-label="${PARTS[key].label}: ${o.name}${locked ? ` (${o.need} yıldızla açılır)` : ''}">${face}${locked ? `<em>${svg('i-lock')}${o.need}</em>` : ''}</button>`;
      }).join('');
      return `<div class="part"><small>${PARTS[key].label.toLocaleUpperCase('tr')} · <b>${look[key].name}</b></small><div>${options}</div></div>`;
    }).join('');
  }

  pick(key, id) {
    const option = PARTS[key].options.find((o) => o.id === id), total = this.store.total();
    if (!option) return;
    if (option.need > total) { this.sfx.bad(); return; }
    this.sfx.drop();
    this.store.setShip(key, id);
    this.renderParts();
    this.onLook(this.look());
  }

  /** Otopilot kitaplığı: çocuğun kazandığı görevlerde yazdığı fonksiyonlar. */
  openLibrary() {
    const lib = this.store.library(), names = Object.keys(lib).filter((n) => FUNCTIONS[n]);
    const card = makeCard(`<div class="who">${robot('happy')}<span class="tag">OTOPİLOT KİTAPLIĞIN</span></div><h1>Senin manevraların</h1>
      <p>Kazandığın görevlerde yazdığın manevralar burada saklanır. Final görevlerinde onları <b>yeniden tanımlamadan</b> çağırabilirsin.</p>
      <div class="libgrid"></div>
      <div class="btns"><button class="btn primary" data-act="back">Hangara dön</button></div>`, () => { this.sfx.click(); this.open(); }, 'wide');
    const grid = card.querySelector('.libgrid');
    for (const name of names) {
      const box = document.createElement('div'); box.className = 'demo';
      box.append(renderBlock({ id: `lib-${name}`, type: 'define', name, body: lib[name] }));
      grid.append(box);
    }
    showCard(card);
  }

  /** Sertifika: ekranda gösterilir, istenirse yazdırılır. Pilotun adı burada sorulur. */
  openCertificate() {
    const { store } = this, total = store.total(), sectors = doneSectors(store);
    const passed = ALL_LEVELS.filter((l) => store.stars(l.id) > 0).length, crew = CREW.filter((c) => store.hasCrew(c.id)).length;
    const d = new Date(), date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const sheet = () => `<div class="certificate">
        <small>KOD PİLOTU · UZAY KODLAMA MACERASI</small><h2>Başarı Sertifikası</h2>
        <div class="cship">${shipSvg(this.look())}</div>
        <p class="cname">${esc(store.name || 'Genç Pilot')}</p>
        <p><b>${rankOf(total)}</b> rütbesine ulaştı.</p>
        <p class="cstats">${total} yıldız · ${passed} görev · ${sectors.length} sektör${crew ? ` · ${crew} mürettebat kurtarıldı` : ''}</p>
        ${sectors.length ? `<p class="cskills">Öğrendiği kavramlar: ${sectors.map((s) => s.concept).join(', ')}</p>` : '<p class="cskills">Yolculuğun başında: ilk sektörü bitirince kavramlar burada yazacak.</p>'}
        <div class="csign"><span>${date}</span><span>${robot('happy')}Kopilot Bip</span></div>
      </div>`;
    const card = makeCard(`<span class="tag">SERTİFİKA</span>
      <label class="namebox">Pilotun adı<input id="certName" maxlength="24" placeholder="Adını yaz" value="${esc(store.name)}" autocomplete="off"></label>
      <div id="certBox">${sheet()}</div>
      <div class="btns"><button class="btn" data-act="back">Hangara dön</button><button class="btn primary" data-act="print">Yazdır</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'back') { this.open(); return; }
      // Yazdırma: sertifikanın bir kopyası sayfanın tek görünen öğesi olur (bkz. style.css, @media print).
      document.querySelector('.printsheet')?.remove();
      const page = document.createElement('div'); page.className = 'printsheet'; page.innerHTML = sheet();
      document.body.append(page);
      window.print();
    }, 'wide');
    card.querySelector('#certName').addEventListener('input', (e) => { store.name = e.target.value; card.querySelector('#certBox').innerHTML = sheet(); });
    showCard(card);
  }
}
