// Atölye ekranı: çocuk kareleri doldurarak kendi görevini kurar, dener ve bağlantıyla paylaşır.
// Görev ancak kuran kişi onu çözdükten sonra paylaşılabilir: çözülemeyen görev kimseye gitmez.
import { PIECES, SIZE, blankField, encodeField, decodeField, hasRoute, customLevel } from '../content/custom.js';
import { robot } from './copilot.js';
import { showCard, hideCard, makeCard } from './overlay.js';

const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
// Karelerin içindeki resimler
const ART = { '.': '', M: '<i class="rock"></i>', G: '<i class="rock geode"></i>', D: '<i class="rock iron"></i>', K: svg('i-gem'), B: '<i class="ring"></i>', P: svg('i-ship', 'foe'), E: svg('i-bolt'), S: svg('i-ship') };

export class Workshop {
  /** @param o.onPlay(level)  "Dene"ye basılınca görevi açar */
  constructor({ store, sfx, onPlay }) {
    Object.assign(this, { store, sfx, onPlay });
    this.tool = 'M';
  }

  /** Kayıttaki tasarım; yoksa ya da bozuksa boş alan. */
  load() {
    const saved = this.store.workshop;
    const ok = saved && decodeField(encodeField(saved.lines || [], saved.par || 1));
    // battery: lazer pili (0 = lazer kapalı)
    this.design = ok ? { lines: [...saved.lines], par: saved.par || null, solved: !!saved.solved, battery: saved.battery || 0 } : { lines: blankField(), par: null, solved: false, battery: 0 };
  }
  save() { this.store.workshop = { ...this.design }; }

  get lanes() { return this.design.lines[0].length; }
  get rows() { return this.design.lines.length; }
  get battery() { return this.design.battery || 0; }

  open() {
    this.load();
    const card = makeCard(`<span class="tag">ATÖLYE</span><h1>Kendi görevini kur</h1>
      <p class="fine">Bir parça seç, sonra karelere dokun. En alt sıraya dokunursan gemi oraya geçer.</p>
      <div class="wk"><div class="wkgrid" id="wkGrid"></div>
        <div class="wkside"><div class="wktools" id="wkTools"></div><div id="wkSize"></div><div class="wkmsg" id="wkMsg"></div></div></div>
      <div class="btns"><button class="btn" data-act="clear">Temizle</button><button class="btn" data-act="share" id="wkShare">Paylaş</button><button class="btn" data-act="close">Kapat</button><button class="btn primary" data-act="play">Dene${svg('i-play')}</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'close') hideCard();
      else if (act === 'clear') { this.design = { lines: blankField(this.lanes, this.rows), par: null, solved: false, battery: 0 }; this.save(); this.render(); }
      else if (act === 'play') this.play();
      else if (act === 'share') this.share();
    }, 'wide');
    card.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-cell]'), tool = e.target.closest('[data-piece]'), size = e.target.closest('[data-size]'), copy = e.target.closest('[data-copy]');
      if (cell) { const [lane, y] = cell.dataset.cell.split(',').map(Number); this.paint(lane, y); }
      else if (tool) { this.sfx.click(); this.tool = tool.dataset.piece; this.render(); }
      else if (size) { const [key, d] = size.dataset.size.split(','); this.resize(key, Number(d)); }
      else if (copy) this.copy();
    });
    showCard(card);
    this.render();
  }

  render(message = '') {
    const { lines, solved, par } = this.design, grid = document.getElementById('wkGrid');
    if (!grid) return;
    grid.style.setProperty('--lanes', this.lanes); grid.style.setProperty('--rows', this.rows);
    grid.innerHTML = lines.map((line, i) => [...line].map((ch, lane) => {
      const y = this.rows - 1 - i;
      return `<button class="wkc ${ch === '.' ? '' : `p${ch}`} ${y === 0 ? 'base' : ''}" data-cell="${lane},${y}" aria-label="${lane + 1}. şerit, ${y + 1}. sıra">${ART[ch]}</button>`;
    }).join('')).join('');
    document.getElementById('wkTools').innerHTML = PIECES.map((p) => `<button class="${p.ch === this.tool ? 'on' : ''}" data-piece="${p.ch}"><span class="wkc ${p.ch === '.' ? '' : `p${p.ch}`}">${p.ch === '.' ? svg('i-cross') : ART[p.ch]}</span>${p.name}</button>`).join('');
    const stepper = (key, label, value) => `<div class="wksize"><span>${label}</span><button data-size="${key},-1" ${value <= SIZE[key][0] ? 'disabled' : ''} aria-label="${label} azalt">−</button><b>${value}</b><button data-size="${key},1" ${value >= SIZE[key][1] ? 'disabled' : ''} aria-label="${label} artır">+</button></div>`;
    document.getElementById('wkSize').innerHTML = stepper('lanes', 'Şerit', this.lanes) + stepper('rows', 'Sıra', this.rows) + stepper('battery', 'Lazer pili', this.battery);
    document.getElementById('wkShare').disabled = !solved;
    document.getElementById('wkMsg').innerHTML = message || (solved ? `${robot('happy')}<span>Görevini <b>${par} blokla</b> çözdün. Artık paylaşabilirsin!</span>` : `${robot('idle')}<span>Önce <b>Dene</b>'ye bas ve görevini kendin çöz; sonra paylaşabilirsin.</span>`);
  }

  /** Değişen tasarımın çözümü geçersizdir: yeniden çözülmeden paylaşılamaz. */
  touch(lines, battery = this.battery) {
    this.design = { lines, par: null, solved: false, battery }; this.save();
    this.store.setProgram('atolye', []);   // eski alan için yazılan program yeni alana taşınmaz
    this.render();
  }

  paint(lane, y) {
    const board = this.design.lines.map((l) => [...l]), i = this.rows - 1 - y;
    if (y === 0) {
      // Alt sıra kalkış sırasıdır: dokunulan kare geminin yeri olur.
      if (board[i][lane] === 'S') return;
      board[i] = board[i].map(() => '.'); board[i][lane] = 'S';
    } else board[i][lane] = board[i][lane] === this.tool ? '.' : this.tool;
    this.sfx.drop();
    this.touch(board.map((r) => r.join('')));
  }

  resize(key, d) {
    if (key === 'battery') {
      // Lazer pili: 0 lazeri kapatır. Pil değişince görev yeniden çözülmelidir.
      const battery = Math.max(SIZE.battery[0], Math.min(SIZE.battery[1], this.battery + d));
      if (battery !== this.battery) { this.sfx.click(); this.touch(this.design.lines, battery); }
      return;
    }
    const lanes = Math.max(SIZE.lanes[0], Math.min(SIZE.lanes[1], this.lanes + (key === 'lanes' ? d : 0)));
    const rows = Math.max(SIZE.rows[0], Math.min(SIZE.rows[1], this.rows + (key === 'rows' ? d : 0)));
    if (lanes === this.lanes && rows === this.rows) return;
    this.sfx.click();
    // Eski içerik alt-sol köşeden hizalanarak korunur; gemi alanın içinde kalır.
    const old = this.design.lines, start = Math.min(old[old.length - 1].indexOf('S'), lanes - 1);
    const lines = Array.from({ length: rows }, (_, i) => {
      const y = rows - 1 - i, src = old[old.length - 1 - y];
      if (y === 0) return '.'.repeat(start) + 'S' + '.'.repeat(lanes - start - 1);
      return (src || '').replace('S', '.').slice(0, lanes).padEnd(lanes, '.');
    });
    this.touch(lines);
  }

  play() {
    if (!hasRoute(this.design.lines, { laser: this.battery > 0 })) { this.sfx.bad(); this.render(`${robot('sad')}<span>Çıkışa giden yol kapalı! Bir meteoru kaldır, gemiyi başka kareye al ya da lazer pili ekle (demiri lazer de kıramaz).</span>`); return; }
    hideCard();
    const { lines, par, solved } = this.design;
    this.onPlay(customLevel(lines, { par: solved ? par : null, own: true, library: Object.keys(this.store.library()), battery: this.battery }));
  }

  /** Oyun, çocuğun kendi görevini çözdüğünü bildirir: en az blokla çözümü hedef olur. */
  solved(lines, blocks) {
    this.load();
    if (lines.join('-') !== this.design.lines.join('-')) return;
    this.design.par = this.design.solved ? Math.min(this.design.par, blocks) : blocks;
    this.design.solved = true;
    this.save();
  }

  link() { return `${location.origin}${location.pathname}#oyna=${encodeField(this.design.lines, this.design.par, this.battery)}`; }

  share() {
    if (!this.design.solved) return;
    const url = this.link();
    // Telefonda sistemin paylaşma penceresi açılır; yoksa bağlantı kopyalanmak üzere gösterilir.
    if (navigator.share) navigator.share({ title: 'Kod Pilotu: benim görevim', text: 'Kod Pilotu\'nda bir görev kurdum. Çözebilir misin?', url }).catch(() => {});
    this.render(`<span class="wklink"><input readonly value="${url}" aria-label="Görev bağlantısı"><button class="btn" data-copy="1">Kopyala</button></span>`);
  }

  async copy() {
    const input = document.querySelector('.wklink input');
    if (!input) return;
    input.select();
    try { await navigator.clipboard.writeText(input.value); } catch (e) { try { document.execCommand('copy'); } catch (err) { /* elle kopyalanır */ } }
    this.sfx.drop();
    const b = document.querySelector('[data-copy]'); if (b) b.textContent = 'Kopyalandı';
  }
}
