// Görev ekranı: sahneyi açar, programı çalıştırır, olayları sırayla oynatır,
// dalgaları ve sonucu yönetir.
import { parseField, simulate, sense, hasMeteor, stars as calcStars, FAIL_TEXT } from '../engine/world.js';
import { count, clone, pythonLines, sameBlocks, CONDS, EVENTS, FUNCTIONS } from '../engine/blocks.js';
import { LEVELS, SECTORS, KINDS, levelsOf } from '../content/levels.js';
import { EXTRAS, EXTRA_LABEL, SECRET_STARS, sectorStars, extrasOf } from '../content/extras.js';
import { missing, skeleton } from '../content/hints.js';
import { dayTitle } from '../content/daily.js';
import { teaser, nearGoal, STORY, VILLAIN, crewOf, botOf } from '../content/story.js';
import { rankOf } from '../content/ranks.js';
import { choicesFor, LETTERS } from '../content/predict.js';
import { unlockedBetween } from '../content/hangar.js';
import { Editor, renderBlock, hatBlock } from './editor.js';
import { robot, face, miniBot, COPILOT } from './copilot.js';
import { showCard, hideCard, makeCard, confetti } from './overlay.js';

const $ = (id) => document.getElementById(id);
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
const rich = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const SPEEDS = [1, 2, 0.5];
// Uçuş sırasında ortaya çıkan başarısızlıklar; çok dalgalı görevde hangi dalgada olduğu da söylenir.
const IN_FLIGHT = ['meteor', 'wall', 'pirate', 'shield', 'energy', 'overflow', 'station', 'counter', 'param', 'ended', 'idle', 'limit'];
const TONE = { bad: 'var(--bad)', ok: 'var(--ok)', info: '#8fa6e8' };

export class Game {
  constructor({ view, store, sfx, music, voice, hangar, workshop, onEnter, onExit }) {
    Object.assign(this, { view, store, sfx, music, voice, hangar, workshop, onEnter, onExit });
    this.status = 'idle'; this.loopId = 0; this.current = Promise.resolve(); this.level = null; this.tab = 'blocks';
    this.editor = new Editor({
      ws: $('ws'), pal: $('pal'), pop: $('pop'),
      onChange: () => this.programChanged(),
      onTouch: () => { if (this.status !== 'idle') this.stop(); if (this.tab !== 'blocks') this.setTab('blocks'); },
      notify: (kind) => this.notify(kind),
    });
    $('runBtn').addEventListener('click', () => this.onRun());
    $('stepBtn').addEventListener('click', () => this.onStep());
    $('resetBtn').addEventListener('click', () => { sfx.click(); this.stop(); });
    $('gameSoundBtn').addEventListener('click', () => this.toggleSound());
    this.renderSound();
    $('camBtn').addEventListener('click', () => {
      sfx.click(); store.camera = store.camera === 'pilot' ? 'ust' : 'pilot';
      this.applyCamera();
    });
    $('speedBtn').addEventListener('click', () => this.cycleSpeed());
    $('undoBtn').addEventListener('click', () => { sfx.click(); if (this.status !== 'idle') this.stop(); this.editor.undo(); });
    $('backBtn').addEventListener('click', () => { sfx.click(); this.close(); });
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { sfx.click(); this.setTab(b.dataset.tab); } });
    $('waves').addEventListener('click', (e) => {
      const b = e.target.closest('[data-wave]');
      if (b) { sfx.click(); this.showWave(Number(b.dataset.wave)); }
    });
    $('track').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level]');
      if (b && !b.classList.contains('locked') && b.dataset.level !== this.level.id) { sfx.click(); this.open(LEVELS.find((l) => l.id === b.dataset.level)); }
    });
    $('scrubRange').addEventListener('input', (e) => this.scrubTo(Number(e.target.value)));
    for (const id of ['quizBtns', 'picks']) $(id).addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) this.pickAnswer(Number(b.dataset.pick)); });
    $('speakBtn').hidden = !voice.supported;
    $('speakBtn').addEventListener('click', () => { sfx.click(); voice.say(`${this.level.title}. ${this.level.brief}`, { force: true }); });
    this.setSpeed(SPEEDS.includes(store.speed) ? store.speed : 1);
  }

  // ---------- sahne açma ----------
  open(level, { navigate = true } = {}) {
    this.onEnter(); this.hideOverlay(); this.voice.stop();
    this.loopId++; this.level = level;
    const sector = SECTORS.find((s) => s.id === level.sector);
    this.sector = sector;
    this.fields = level.waves.map(parseField);
    this.wave = 0; this.results = [];
    this.hintStep = 0; this.clock = performance.now();
    // Tahmin turu: program yazılmaz, okunur (bkz. askRound).
    this.quiz = level.tahmin ? { score: [] } : null;
    $('game').dataset.mode = level.tahmin ? 'tahmin' : '';
    $('quizBar').hidden = !this.quiz; $('picks').replaceChildren();
    $('game').hidden = false;
    // Serbest görevler (günün dalgası, atölye) bir sektöre bağlı değildir: şerit gizlenir, başlık görevin adıdır.
    $('sectorNo').textContent = level.free ? EXTRA_LABEL[level.extra] : `SEKTÖR ${sector.id}`;
    $('sectorName').textContent = level.extra === 'gunluk' ? dayTitle(level.day) : level.free ? level.title : sector.name;
    $('track').hidden = !!level.free;
    $('missionNo').textContent = level.extra ? EXTRA_LABEL[level.extra] : `GÖREV ${level.n} / 8`; $('conceptChip').textContent = level.chip || sector.concept;
    $('panel').dataset.extra = level.extra || '';
    $('missionTitle').textContent = level.title; $('missionText').innerHTML = rich(level.brief);
    this.renderTrack();
    $('waveNote').innerHTML = this.quiz ? `${this.fields.length} soru: her birinde geminin duracağı kareyi tahmin et.`
      : `Aynı program ${this.fields.length} dalgayı da geçmeli.<span class="more"> Görmek için sayıya dokun.</span>`;
    const saved = this.store.program(level.saveKey);
    const solution = this.store.showSolutions && level.solution ? level.solution() : null;
    const program = this.quiz ? level.rounds[0].program() : solution ?? (saved && saved.length ? clone(saved) : level.initial ? level.initial() : []);
    this.lib = this.libraryFor(level);
    this.editor.load(level, program, Object.keys(this.lib || {}), !!this.quiz);
    this.setTab('blocks'); this.hideToast(); this.hideCall(); this.setStatus('idle');
    this.refreshMeta(); this.renderWaves();
    this.resetTelemetry();
    this.layout();
    // Sektörde ilerledikçe arka plandaki gezegen (son sektörde Atlas) yaklaşır.
    this.view.setTheme(sector.id, level.extra ? 0.5 : (level.n - 1) / 7);
    this.music.theme(sector.id); this.applyCamera();
    document.documentElement.style.setProperty('--sector', this.view.theme.accent);
    this.setScene(0);
    this.view.enter();
    this.renderRecord();
    if (this.quiz) this.askRound();
    const hash = `#${level.hash ?? level.id}`;
    if (navigate && location.hash !== hash) history.pushState(null, '', hash);
    $('missionTitle').focus({ preventScroll: true });
    if (level.n === 1 && !this.store.introSeen(sector.id)) this.showStory(sector, () => this.showIntro(sector));
    else {
      this.voice.say(`${level.title}. ${level.brief}`);
      if (level.extra === 'gunluk' && !this.store.daily(level.day)) this.showToast('', 'Her gün yeni bir dalga!', { sub: 'Bugünün yıldızları ayrı sayılır; yarın yenisi gelir.', mood: 'happy', quiet: true });
      else if (this.lib) this.showToast('', `Kitaplığında **${Object.keys(this.lib).map((n) => FUNCTIONS[n].label).join(', ')}** var.`, { sub: 'Tanımlamadan çağırabilirsin: paletteki kitap işaretli bloğa dokun.', mood: 'happy', quiet: true });
    }
  }

  /** Bu görevde kitaplıktan çağrılabilen manevralar: { ad: gövde }. Kitaplık kapalıysa ya da boşsa null. */
  libraryFor(level) {
    if (!level.library) return null;
    const all = this.store.library(), out = {};
    for (const name of level.functions || []) if (all[name]?.length) out[name] = all[name];
    return Object.keys(out).length ? out : null;
  }

  /** Dalganın alanını sahneye kurar; görev daha önce geçildiyse rekor uçuşun izi de çizilir. */
  setScene(i, extra = {}) {
    this.view.setField(this.fields[i], this.stage(extra));
    this.view.setTrail(this.level.free ? null : this.store.best(this.level.id)?.paths?.[i] || null);
  }

  /** Rekor rozeti: bu görevi en az kaç blokla geçtin. */
  renderRecord() {
    const el = $('record'), best = this.level.free ? null : this.store.best(this.level.id);
    el.hidden = !best;
    if (best) el.innerHTML = `<i></i>rekor <b>${best.blocks}</b> blok`;
  }

  close({ navigate = true } = {}) {
    this.loopId++; this.replaying = false; this.view.setField(null); this.view.setTheme(0); this.view.setCamera('ust');
    this.music.theme(0); this.music.tension(0);
    this.hideCall(); this.hideToast(); this.hideOverlay(); this.editor.closePop(); this.voice.stop();
    $('picks').replaceChildren();
    $('game').hidden = true;
    if (navigate && location.hash) history.pushState(null, '', location.pathname + location.search);
    this.onExit(this.level);
  }

  /** Kamera: çocuğun seçtiği görünüm; tahmin turunda bütün alan görünsün diye hep üstten. */
  applyCamera() {
    const pilot = !this.quiz && this.store.camera === 'pilot';
    this.view.setCamera(pilot ? 'pilot' : 'ust');
    const b = $('camBtn'); b.classList.toggle('on', pilot); b.setAttribute('aria-pressed', String(pilot));
    if (this.quiz?.choices) this.renderPicks();
  }

  /**
   * Müziğin gerilimi: uçuş başlayınca yükselir; enerji azalınca ya da bir korsan yaklaşınca
   * daha da artar. Uçuş bitince söner.
   */
  tune() {
    if (this.status !== 'running') { this.music.tension(0); return; }
    const f = this.fields[this.wave], ship = this.shipCell || { lane: f.start, y: 0 };
    const low = this.flight.energy !== null && this.flight.energy < 3;
    const near = [...f.pirates].some((k) => { const [lane, y] = k.split(',').map(Number); return y > ship.y && y - ship.y <= 2 && Math.abs(lane - ship.lane) <= 1; });
    this.music.tension(low || near ? 0.9 : this.fields.length > 1 && this.wave === this.fields.length - 1 ? 0.6 : 0.4);
  }

  /** Sahnenin göreve özel süsleri: finallerdeki kaptan korsan ve Atlas'ın kapısı. */
  stage(extra = {}) { return { boss: !!this.level.boss, gate: !!this.level.dock, ...extra }; }

  /** Alanın sığacağı ekran bölgesini hesaplar (panelin kapatmadığı kısım). */
  layout() {
    if ($('game').hidden) return;
    const W = window.innerWidth, H = window.innerHeight, p = $('panel').getBoundingClientRect();
    const stacked = p.width > W * 0.8;
    const top = $('track').offsetParent ? 100 : 76;
    const telemetry = $('telemetry').hidden ? null : $('telemetry').getBoundingClientRect();
    const stageTop = stacked && telemetry ? telemetry.bottom + 8 : stacked ? 66 : top;
    const stageBottom = stacked ? p.top - 4 : telemetry ? telemetry.top - 8 : H - 6;
    this.rect = { x: 0, y: stageTop, w: stacked ? W : p.left - 6, h: Math.max(120, stageBottom - stageTop) };
    this.view.setRect(this.rect);
    $('toast').style.left = `${this.rect.x + this.rect.w / 2}px`;
    const scrub = $('scrub').style;
    scrub.right = `${W - this.rect.x - this.rect.w + 14}px`; scrub.top = `${this.rect.y + this.rect.h - (stacked ? 44 : 52)}px`;
    if (this.quiz?.choices) this.renderPicks();
  }

  renderTrack() {
    const levels = levelsOf(this.level.sector), parts = [];
    levels.forEach((l, i) => {
      const done = this.store.stars(l.id) > 0 || (!!l.alt && this.store.stars(l.alt) > 0), cur = l.id === this.level.id, locked = !this.store.isUnlocked(l, LEVELS);
      const cls = ['node', l.n === 8 ? 'boss' : '', cur ? 'cur' : done ? 'done' : '', locked ? 'locked' : '', this.store.isSkipped(l.id) ? 'skipped' : ''].join(' ');
      const inner = l.n === 8 ? svg('i-star') : done && !cur ? svg('i-check') : l.n;
      parts.push(`<div class="n"><button class="${cls}" data-level="${l.id}" aria-label="Görev ${l.n}">${inner}</button><span class="${cur ? 'on' : ''}">${KINDS[l.kind]}</span></div>`);
      if (i < levels.length - 1) parts.push(`<div class="seg ${done ? 'done' : ''}"></div>`);
    });
    $('track').innerHTML = parts.join('');
  }

  /** Dalga düğmeleri: geçilen yeşil, uçulan sarı, takılınan kırmızı; uçuş yokken ekrandaki dalga beyaz çerçeveli. */
  renderWaves() {
    const el = $('waves'), many = this.fields.length > 1;
    $('waveBar').hidden = !many;
    if (!many) { el.innerHTML = ''; return; }
    if (this.quiz) {
      // Tahmin turunda sayılar sorulardır: doğru yeşil, yanlış kırmızı; aralarında gezilmez.
      const { score } = this.quiz;
      el.innerHTML = this.fields.map((_, i) => `<button class="${score[i] === true ? 'ok' : score[i] === false ? 'bad' : i === this.wave ? 'view' : ''}" disabled>${i + 1}</button>`).join('');
      return;
    }
    const flying = this.status === 'running' || this.status === 'paused';
    const pips = this.fields.map((_, i) => {
      const cls = i < this.results.length ? 'ok' : i !== this.wave ? '' : this.status === 'failed' ? 'bad' : flying ? 'on' : 'view';
      return `<button class="${cls}" data-wave="${i}" aria-label="Dalga ${i + 1}">${i + 1}</button>`;
    });
    el.innerHTML = pips.join('');
  }

  /** Uçuşu durdurur ve seçilen dalganın alanını gösterir: çocuk programı yazarken bütün dalgalara bakabilsin. */
  showWave(i) {
    this.loopId++; this.hideCall(); this.hideToast(); this.markBlocks([]);
    this.results = []; this.wave = i;
    this.setScene(i, { rain: true });
    this.resetTelemetry(); this.setStatus('idle');
  }

  refreshMeta() {
    const n = count(this.editor.program), { maxBlocks, par } = this.level;
    const el = $('counter');
    el.classList.toggle('full', n >= maxBlocks);
    el.innerHTML = `<span><b>${n}</b> / ${maxBlocks} blok</span>${par ? `<span class="goal ${n > 0 && n <= par ? 'lit' : ''}">${svg('i-star')}en çok ${par}</span>` : ''}`;
    $('undoBtn').disabled = !this.editor.history.length;
    if (this.tab === 'python') this.renderPython();
  }

  setTab(tab) {
    this.tab = tab;
    for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
    $('ws').hidden = tab !== 'blocks'; $('py').hidden = tab !== 'python';
    if (tab === 'python') this.renderPython();
  }
  renderPython() {
    const paint = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\b(for|in|while|if|else|pass|True|not|and|or|def|from|import)\b/g, '<span class="k">$1</span>')
      .replace(/\b([a-z_]+)\(/g, '<span class="f">$1</span>(')
      .replace(/\((\d+|n)\)/g, '(<span class="pn">$1</span>)')
      .replace(/(#.*)$/, '<span class="c">$1</span>');
    // Her satır kendisini üreten bloğun kimliğini taşır: uçuşta çalışan satır vurgulanır.
    const lines = pythonLines(this.editor.program, { library: Object.keys(this.lib || {}) })
      .map((l) => `<span class="ln"${l.id ? ` data-id="${l.id}"` : ''}>${paint(l.text) || ' '}</span>`);
    $('py').innerHTML = `<span class="ln c"># Aynı program, Python diliyle</span>${lines.join('')}`;
    this.paintPython();
  }

  /** Blokları ve (Python sekmesi açıksa) karşılık gelen satırları vurgular. */
  markBlocks(list) {
    this.editor.markAll(list); this.pyMarks = list;
    if (this.tab === 'python') this.paintPython();
  }
  paintPython() {
    const box = $('py');
    for (const e of box.querySelectorAll('.now, .sensing, .err')) e.classList.remove('now', 'sensing', 'err');
    let last = null;
    for (const { id, cls } of this.pyMarks || []) { const e = id && box.querySelector(`[data-id="${id}"]`); if (e) { e.classList.add(cls); last = e; } }
    if (!last) return;
    const r = last.getBoundingClientRect(), w = box.getBoundingClientRect();
    if (r.top < w.top + 6 || r.bottom > w.bottom - 6) last.scrollIntoView({ block: 'center' });
  }

  programChanged() {
    if (this.status !== 'idle') this.stop();
    this.store.setProgram(this.level.saveKey, this.editor.program);
    this.refreshMeta();
  }

  notify(kind) {
    if (kind === 'add') this.sfx.drop();
    else if (kind === 'remove') this.sfx.remove();
    else if (kind === 'full') {
      this.sfx.bad();
      const c = $('counter'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
      this.showToast('bad', `Blok sınırı doldu: en fazla ${this.level.maxBlocks} blok.`, { sub: this.level.sector === 2 ? 'Tekrar eden hareketleri bir "tekrarla" bloğuna topla.' : '', mood: 'think' });
    } else if (kind === 'condtip') this.showToast('', 'Sensörü "eğer" veya "olana kadar" bloğuna bırak. Koşulu değiştirmek için de bloğun koşuluna dokunabilirsin.', { mood: 'think' });
  }

  /** Sesi ve müziği birlikte açar/kapatır. Harita ekranındaki iki düğmeyle aynı ayarları kullanır. */
  toggleSound() {
    const on = !(this.store.sound && this.store.music);
    this.store.sound = on; this.store.music = on;
    this.sfx.enabled = on; this.music.enabled = on;
    this.renderSound();
    if (on) this.sfx.click();
  }
  renderSound() {
    const silent = !this.store.sound && !this.store.music;
    const b = $('gameSoundBtn');
    b.classList.toggle('off', silent);
    b.setAttribute('aria-pressed', String(!silent));
  }

  // ---------- çalıştırma ----------
  setStatus(s) {
    this.status = s;
    if (s !== 'failed') { this.reel = null; $('scrub').hidden = true; }
    const btn = $('runBtn');
    const label = { idle: ['i-play', 'Uçur'], running: ['i-pause', 'Duraklat'], paused: ['i-play', 'Devam'], failed: ['i-restart', 'Tekrar dene'], won: ['i-play', 'Uçur'] }[s];
    btn.innerHTML = `${svg(label[0])}${label[1]}`;
    btn.classList.toggle('go', s === 'paused');
    $('resetBtn').disabled = s === 'idle';
    this.renderWaves(); this.tune();
  }

  setSpeed(v) { this.speed = v; this.view.speed = v; this.store.speed = v; $('speedLab').textContent = v === 0.5 ? '½×' : `${v}×`; }
  cycleSpeed() { this.sfx.click(); this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]); }

  onRun() {
    this.sfx.click();
    if (this.replaying) this.stop();
    else if (this.status === 'failed') this.stop();
    else if (this.status === 'idle') this.start(false);
    else if (this.status === 'running') this.setStatus('paused');
    else if (this.status === 'paused') { this.stepMode = false; this.resume(); }
  }
  onStep() {
    this.sfx.click();
    if (this.replaying) this.stop();
    else if (this.status === 'failed') this.stop();
    else if (this.status === 'idle') this.start(true);
    else if (this.status === 'paused') { this.stepMode = true; this.resume(); }
    else if (this.status === 'running') this.stepMode = true;
  }

  start(step) {
    this.reset();
    // Uçuş hep ilk dalgadan başlar; ekranda başka bir dalga duruyorsa önce ilkine dönülür.
    if (this.wave !== 0) { this.wave = 0; this.setScene(0); }
    this.stepMode = step; this.results = [];
    this.simulateWave();
    this.setStatus('running');
    this.view.launch(); this.sfx.launch();
    this.loop(++this.loopId);
  }

  simulateWave() {
    this.sim = simulate(this.fields[this.wave], this.editor.program, { library: this.lib });
    this.events = this.sim.events; this.i = 0;
    this.resetTelemetry();
  }

  async resume() {
    const id = ++this.loopId;
    this.setStatus('running');
    await this.current;
    if (id === this.loopId) this.loop(id);
  }

  /**
   * Uçuşu durdurur ve gemiyi başa alır. Ekrandaki dalga değişmez: program sonraki bir
   * dalgada takıldıysa çocuk onu düzeltirken o dalgayı görmeye devam eder.
   */
  stop() {
    this.loopId++;
    if (this.replaying) { this.replaying = false; this.applyCamera(); }
    this.reset(); this.setStatus('idle');
  }

  reset() {
    this.hideCall(); this.hideToast(); this.markBlocks([]);
    this.results = [];
    this.view.resetShip();
    this.resetTelemetry();
  }

  resetTelemetry() {
    const f = this.fields[this.wave];
    this.flight = { energy: f.energyCells.size ? 0 : null, counter: null, shielded: false, message: '', gems: 0, dodged: false, broken: new Set() };
    this.shipCell = null;
    this.renderTelemetry(); this.renderGems();
  }

  /** Kristal sayacı: bu dalgada toplanan / toplam. */
  renderGems(pop = false) {
    const el = $('gems'), total = this.fields[this.wave].crystals.size;
    el.hidden = !total;
    if (!total) return;
    el.innerHTML = `${svg('i-gem')}<b>${this.flight.gems}</b><span>/ ${total}</span>`;
    el.classList.toggle('full', this.flight.gems === total);
    if (pop) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }   // 'pop' adı açılır kutunun sınıfıdır
  }

  /** Uçuş göstergesi: enerji hücreleri, kalkan durumu ve alandaki özel karelerin anlamı. */
  renderTelemetry() {
    const el = $('telemetry'), f = this.fields[this.wave], state = this.flight;
    const hasEnergy = state.energy !== null, hasShield = f.pirates.size > 0, hasCounter = this.level.tools.includes('setCounter');
    el.hidden = !(hasEnergy || hasShield || hasCounter || f.beacons.size || f.energyCells.size);
    const gauges = [], key = [];
    if (hasCounter) gauges.push(`<div class="gauge counter ${state.counter === null ? 'off' : ''}">${svg('i-count')}<b>sayaç = ${state.counter ?? '?'}</b></div>`);
    if (hasEnergy) {
      const cells = Array.from({ length: 9 }, (_, i) => `<i class="${i < state.energy ? 'on' : ''}"></i>`).join('');
      gauges.push(`<div class="gauge energy ${state.energy < 3 ? 'low' : ''}">${svg('i-bolt')}<div class="cells">${cells}</div><b>${state.energy}</b></div>`);
    }
    if (hasShield) gauges.push(`<div class="gauge shield ${state.shielded ? 'on' : ''}">${svg('i-shield')}<b>Kalkan ${state.shielded ? 'açık' : 'kapalı'}</b></div>`);
    if (f.beacons.size) key.push('<span class="legend-beacon"><i></i>mor halka: işaret</span>');
    if (f.pirates.size) key.push('<span class="legend-pirate"><i></i>kırmızı gemi: korsan</span>');
    if (f.energyCells.size) key.push('<span class="legend-energy"><i></i>yeşil istasyon: şarj</span>');
    el.innerHTML = `${gauges.length ? `<div class="gauges">${gauges.join('')}</div>` : ''}<div class="field-key">${key.join('')}</div>${this.status !== 'idle' && state.message ? `<div class="flight-state">${state.message}</div>` : ''}`;
  }

  /** Sıradaki adımı döndürür: o adımda bakılan sensörler ve ardından gelen olay. */
  nextTick() {
    const senses = [];
    while (this.i < this.events.length) {
      const ev = this.events[this.i++];
      if (ev.t === 'sense') senses.push(ev); else return { senses, ev };
    }
    return null;
  }

  async loop(id) {
    const alive = () => id === this.loopId;
    while (alive() && this.status === 'running') {
      const tick = this.nextTick();
      if (!tick) break;
      this.current = this.play(tick, alive);
      const done = await this.current;
      if (!alive() || done) return;
      // Adım modunda her hareketten sonra dur; çıkıştan geçiş hareketinde durma, görev bitsin.
      if (this.stepMode && tick.ev.t === 'move' && !tick.ev.exit) { this.setStatus('paused'); return; }
    }
  }

  /**
   * Bir adımı oynatır. Sensör sonuçları hareketle aynı anda gösterilir; gemi
   * beklemeden uçmaya devam eder. Uçuş bittiyse true döner.
   */
  async play({ senses, ev }, alive) {
    const { view, sfx, editor } = this;
    const marks = senses.map((s) => ({ id: s.id, cls: 'sensing' }));
    if (['move', 'fire', 'beam', 'event', 'variable', 'shield', 'call'].includes(ev.t)) marks.push({ id: ev.id, cls: 'now' });
    else if (ev.t === 'crash' || ev.t === 'fail') marks.push({ id: ev.id, cls: 'err' });
    this.markBlocks(marks);
    if (senses.length) { this.showCalls(senses); sfx.sense(senses[senses.length - 1].result); } else this.hideCall();
    if (['event', 'variable', 'shield', 'call'].includes(ev.t)) {
      if (ev.t === 'event') this.flight.message = EVENTS[ev.event].label;
      if (ev.t === 'variable' && ev.name === 'counter') { this.flight.counter = ev.value; this.flight.message = `Sayaç ${ev.value} oldu`; }
      else if (ev.t === 'variable') { this.flight.energy = ev.value; this.flight.message = 'Enerji güncellendi'; }
      if (ev.t === 'shield') { this.flight.shielded = ev.shielded; this.flight.message = 'Kalkan hazır'; view.setShield(ev.shielded); sfx.shield(); }
      if (ev.t === 'call') this.flight.message = `${FUNCTIONS[ev.name].label}${ev.arg === undefined ? '' : ` (${ev.arg})`} çağrılıyor`;
      this.renderTelemetry();
      await view.wait(130);
      return !alive();
    }
    if (ev.t === 'fire') {
      sfx.laser(!!ev.hit);
      if (ev.hit) this.flight.broken.add(`${ev.hit.lane},${ev.hit.y}`);
      this.flight.message = ev.hit ? 'Kaya parçalandı!' : 'Işın boşa gitti';
      this.renderTelemetry();
      await view.fire(ev);
      if (!alive()) return true;
      if (ev.hit) this.floaty(ev.hit, 'Kaya parçalandı!');
      // Kırılan kaya artık engel değil: sıradaki hedef silüeti yeniden gösterilir.
      this.showTarget(this.events.slice(this.i).find((e) => e.t === 'move' || e.t === 'crash'));
      return false;
    }
    if (ev.t === 'beam') {
      await view.beam(ev, { onFire: () => {
        sfx.beam(ev.hits.length > 0);
        for (const h of ev.hits) this.flight.broken.add(`${h.lane},${h.y}`);
        this.flight.message = ev.hits.length ? `${ev.hits.length} kaya parçalandı!` : 'Işın boşa gitti';
        this.renderTelemetry();
      } });
      if (!alive()) return true;
      if (ev.hits.length) this.floaty(ev.hits[0], `${ev.hits.length} kaya parçalandı!`);
      this.showTarget(this.events.slice(this.i).find((e) => e.t === 'move' || e.t === 'crash'));
      return false;
    }
    if (ev.t === 'move') {
      if (ev.kind === 'fwd') sfx.move(); else sfx.dodge();
      this.showTarget(ev);
      // Önündeki meteordan kaçış tam tur dönüşle yapılır; art arda kaçışlarda (zikzak) baş döndürmesin diye yalnız ilkinde.
      const field = this.fields[this.wave], dodge = ev.kind !== 'fwd' && this.rockAt(field, ev.from.lane, ev.from.y + 1);
      const roll = dodge && !this.flight.dodged;
      this.flight.dodged = ev.kind !== 'fwd';
      await view.move({ ...ev, roll });
      if (!alive()) return true;
      if (ev.collect) { sfx.collect(this.flight.gems); this.flight.gems++; this.renderGems(true); }
      if (!ev.exit) this.nearMiss(field, ev.to);
      this.flight.energy = ev.energy;
      if (ev.shielded !== undefined) this.flight.shielded = ev.shielded;
      if (ev.blocked) {
        const captain = view.isCaptain(ev.to);
        this.flight.message = captain ? `${VILLAIN} kaçıyor!` : 'Korsan saldırısı engellendi';
        if (captain) this.floaty(ev.to, `${VILLAIN} kaçıyor!`, 'red');
      }
      this.renderTelemetry();
      this.shipCell = ev.to; this.tune();
      // Gemi silüetin olduğu kareye vardı: silüet sıradaki hedefe geçer.
      this.showTarget(this.events.slice(this.i).find((e) => e.t === 'move' || e.t === 'crash'));
      return false;
    }
    if (ev.t === 'crash') {
      sfx.dodge(); this.showTarget(ev);
      setTimeout(() => { if (alive()) sfx.crash(); }, 250 / this.speed);
      await view.crash(ev);
      if (alive()) this.fail(ev.reason);
      return true;
    }
    if (ev.t === 'fail') {
      if (!this.quiz) sfx.bad();
      this.fail(ev.reason);
      return true;
    }
    // win
    this.markBlocks([]); sfx.win();
    await view.win(this.wave === this.fields.length - 1);
    if (!alive() || this.replaying) return true;
    this.results.push(this.sim);
    if (this.wave < this.fields.length - 1) {
      this.showToast('good', `Dalga ${this.wave + 1} tamam! Sıradaki dalga geliyor…`, { quiet: true });
      this.wave++; this.renderWaves();
      await view.wait(500);
      if (!alive()) return true;
      this.setScene(this.wave, { rain: true });
      await view.enter();
      if (!alive()) return true;
      this.hideToast(); this.simulateWave();
      return false;
    }
    this.finish();
    return true;
  }

  fail(reason) {
    if (this.quiz) { this.quizEnd(reason); return; }
    this.setStatus('failed');
    const inFlight = this.fields.length > 1 && IN_FLIGHT.includes(reason);
    const text = inFlight ? `Dalga ${this.wave + 1}: ${FAIL_TEXT[reason]}` : FAIL_TEXT[reason];
    // Önceki dalgayı geçen program burada takıldıysa nedeni söylenir; yoksa "çözmüştüm" diye düşünülür.
    const sub = inFlight && this.wave > 0 ? 'Programın önceki dalgayı geçti ama burada yol farklı. Aynı program bütün dalgaları geçmeli.' : '';
    // Boş programla basılan "Uçur" bir deneme sayılmaz.
    if (reason !== 'empty') this.store.attempt(this.level.id, { won: false, reason, ms: this.lap() });
    this.failure = { text, sub };
    this.showFailure();
    this.showScrub();
  }

  /**
   * Geri sarma: başarısız uçuşun kareleri (başlangıç, her hareketten sonraki durum ve hatanın
   * olduğu adım). Kaydırıcı çekilince gemi o kareye, vurgu o kareyi üreten bloğa gider.
   */
  showScrub() {
    const f = this.fields[this.wave], reel = [{ cell: { lane: f.start, y: 0 }, mark: [], energy: f.energyCells.size ? 0 : null, taken: [], gone: [], broken: [], shielded: false }];
    let { energy } = reel[0], taken = [], gone = [], broken = [], shielded = false, stop = null;
    for (const ev of this.events.slice(0, this.i)) {
      if (ev.t === 'shield') shielded = ev.shielded;
      else if ((ev.t === 'fire' && ev.hit) || (ev.t === 'beam' && ev.hits.length)) {
        // Atış da bir kare sayılır: geri sarınca kayanın hangi blokla kırıldığı görülür.
        broken = [...broken, ...(ev.t === 'fire' ? [ev.hit] : ev.hits)];
        reel.push({ ...reel[reel.length - 1], mark: [{ id: ev.id, cls: 'now' }], broken });
      }
      else if (ev.t === 'variable' && ev.name === 'energy') energy = ev.value;
      else if (ev.t === 'move' && !ev.exit) {
        if (ev.collect) taken = [...taken, ev.to];
        if (ev.blocked) gone = [...gone, ev.to];
        shielded = !!ev.shielded; energy = ev.energy;
        reel.push({ cell: ev.to, mark: [{ id: ev.id, cls: 'now' }], energy, taken, gone, broken, shielded });
      } else if (ev.t === 'crash' || ev.t === 'fail') stop = ev;
    }
    if (stop && stop.id) reel.push({ ...reel[reel.length - 1], mark: [{ id: stop.id, cls: 'err' }], last: true });
    this.reel = reel;
    const range = $('scrubRange'), on = reel.length > 2;
    $('scrub').hidden = !on;
    if (!on) return;
    range.max = reel.length - 1; range.value = reel.length - 1;
    $('scrubLab').textContent = `${reel.length - 1} / ${reel.length - 1}`;
  }

  scrubTo(k) {
    const fr = this.reel?.[k];
    if (!fr) return;
    this.hideCall();
    this.view.pose(fr.cell, fr);
    this.markBlocks(fr.mark);
    Object.assign(this.flight, { energy: fr.energy, shielded: fr.shielded, gems: fr.taken.length, message: fr.last ? 'Hata bu adımda oldu' : k ? `${k}. adımdan sonra` : 'Kalkıştan önce' });
    this.renderTelemetry(); this.renderGems();
    $('scrubLab').textContent = `${k} / ${this.reel.length - 1}`;
  }

  // ---------- tahmin turu ----------
  /** Sorunun seçeneklerini sahneye (harfli kareler) ve panele (düğmeler) koyar. */
  askRound() {
    const q = this.quiz;
    q.picked = null; q.done = false;
    Object.assign(q, choicesFor(this.level.rounds[this.wave].lines, this.editor.program, this.wave));
    $('quizAsk').innerHTML = `Soru ${this.wave + 1} / ${this.fields.length}: program bitince gemi <b>hangi karede</b> olur?`;
    this.renderPicks();
  }

  renderPicks() {
    const q = this.quiz, right = (i) => q.choices[i].lane === q.answer.lane && q.choices[i].y === q.answer.y;
    const cls = (i) => (this.store.showSolutions && right(i) ? 'ok' : !q.done ? (q.picked === i ? 'on' : q.picked === null ? '' : 'off') : right(i) ? 'ok' : q.picked === i ? 'bad' : 'off');
    $('quizBtns').innerHTML = q.choices.map((_, i) => `<button class="${cls(i)}" data-pick="${i}" aria-label="${LETTERS[i]} karesi">${LETTERS[i]}</button>`).join('');
    $('picks').innerHTML = q.choices.map((c, i) => { const b = this.view.cellBox(c); return `<button class="${cls(i)}" data-pick="${i}" style="left:${(b.left + b.right) / 2}px;top:${b.y}px">${LETTERS[i]}</button>`; }).join('');
  }

  showRound(i) {
    this.loopId++; this.wave = i;
    this.setScene(i, { rain: true });
    this.editor.load(this.level, this.level.rounds[i].program(), [], true);
    this.hideToast(); this.hideCall(); this.markBlocks([]); this.resetTelemetry(); this.setStatus('idle');
    this.askRound();
  }

  /** Çocuk bir kare seçti: program çalışır ve cevap ortaya çıkar. */
  pickAnswer(i) {
    const q = this.quiz;
    if (!q || q.picked !== null || this.status !== 'idle') return;
    this.sfx.click(); q.picked = i; this.renderPicks(); this.hideToast();
    this.stepMode = false; this.results = [];
    this.simulateWave(); this.setStatus('running');
    this.view.launch(); this.sfx.launch();
    this.loop(++this.loopId);
  }

  quizEnd(reason) {
    const q = this.quiz, at = q.choices.findIndex((c) => c.lane === q.answer.lane && c.y === q.answer.y), right = q.picked === at;
    const last = this.wave === this.fields.length - 1;
    q.score[this.wave] = right; q.done = true;
    this.status = 'idle'; this.renderWaves(); this.renderPicks();
    if (right) this.sfx.star(1); else this.sfx.bad();
    this.showToast(right ? 'good' : 'bad', right ? 'Doğru tahmin!' : `Bu kez olmadı: gemi **${LETTERS[at]}** karesinde durdu.`, {
      sub: reason === 'energy' ? 'Enerji bitince gemi olduğu yerde kalır.' : right ? '' : 'Programı blok blok oku: her blok gemiyi hangi kareye götürüyor?',
      buttons: [{ label: last ? 'Sonucu gör' : 'Sıradaki soru', cls: 'nudge', onClick: () => (last ? this.quizFinish() : this.showRound(this.wave + 1)) }],
    });
  }

  quizFinish() {
    const { level, store } = this, got = this.quiz.score.filter(Boolean).length, before = store.stars(level.id), totalBefore = store.total();
    this.hideToast(); $('picks').replaceChildren();
    if (got) { store.setStars(level.id, got); store.addLog({ kind: 'win', id: level.id, stars: got, gain: Math.max(0, got - before) }); }
    store.attempt(level.id, { won: got > 0, reason: got ? null : 'tahmin', ms: this.lap() });
    const card = makeCard(`<div class="who">${robot(got === 3 ? 'wow' : got ? 'happy' : 'think')}<span class="tag">${EXTRA_LABEL.tahmin}</span></div>
      <h1>${got === this.fields.length ? 'Hepsi doğru!' : got ? `${got} doğru tahmin` : 'Bu tur olmadı'}</h1>
      <div class="bigstars">${[1, 2, 3].map((i) => svg('i-star', i <= got ? 'lit' : '')).join('')}</div>
      <p>${got === this.fields.length ? 'Programı çalıştırmadan okuyabiliyorsun: tam bir pilot gözü!' : 'Kod okumak da bir beceri. Programı blok blok, geminin yolunu parmağınla izleyerek oku ve yeniden dene.'}</p>
      <div class="btns"><button class="btn" data-act="again">${svg('i-restart')}Tekrar</button><button class="btn primary" data-act="map">Rota</button></div>`, (act) => {
      this.sfx.click(); this.hideOverlay();
      if (act === 'again') this.open(level); else this.close();
    });
    const reveal = () => {
      this.showOverlay(card);
      for (let i = 0; i < got; i++) setTimeout(() => this.sfx.star(i), 250 + i * 180);
      if (got === this.fields.length) confetti();
    };
    if (!this.promoted(totalBefore, reveal)) reveal();
  }

  /** Son denemeden bu yana geçen süre (ms); sayaç yeniden başlar. */
  lap() { const now = performance.now(), ms = now - this.clock; this.clock = now; return ms; }

  /** Bu görevin ipucu cümleleri; son basamak (iskelet) ayrı bir kartta gösterilir. */
  hintLines() { return [this.level.hint, this.level.solution ? missing(this.level, this.editor.program) : null].filter(Boolean); }

  /**
   * Başarısızlık balonu. Bip önce ne olduğunu söyler; düğmeye basıldıkça ipucu bir basamak
   * derinleşir. Üç başarısız denemeden sonra ipucunu kendisi önerir, beşten sonra görevi
   * sonraya bırakmayı da.
   */
  showFailure() {
    const { level } = this, streak = this.store.tries(level.id)?.streak || 0, lines = this.hintLines();
    const sub = this.hintStep > 0 ? lines[Math.min(this.hintStep, lines.length) - 1] : this.failure.sub || (streak >= 3 ? 'Birkaç kez denedin. İstersen bir ipucu vereyim.' : '');
    // Sıradaki basamak: önce cümleler, en sonda (örnek çözüm varsa) iskelet. Basamak kalmadıysa düğme de yoktur.
    const label = this.hintStep < lines.length ? (this.hintStep === 0 ? 'İpucu' : 'Bir ipucu daha') : level.solution ? 'İskeleti göster' : null;
    const buttons = label ? [{ label, cls: streak >= 3 && this.hintStep === 0 ? 'nudge' : '', onClick: () => this.nextHint() }] : [];
    if (streak >= 5 && this.canSkip()) buttons.push({ label: 'Sonraya bırak', onClick: () => this.skip() });
    this.showToast('bad', this.failure.text, { sub, buttons, mood: this.hintStep ? 'think' : 'sad' });
  }

  nextHint() {
    if (this.hintStep >= this.hintLines().length) { this.showSkeleton(); return; }
    this.hintStep++; this.showFailure();
  }

  /** Son ipucu basamağı: örnek çözümün yapısı, komutlarının yarısı gizli. */
  showSkeleton() {
    const card = makeCard(`<div class="who">${robot('think')}<span class="tag">${COPILOT.toLocaleUpperCase('tr')}'İN İPUCU</span></div><h1>Programın iskeleti</h1>
      <p>Programın aşağı yukarı böyle görünmeli. Soru işaretli yerleri sen doldur.</p><div class="demo"></div>
      <div class="btns"><button class="btn primary" data-act="ok">Anladım</button></div>`, () => { this.sfx.click(); this.hideOverlay(); });
    card.querySelector('.demo').append(hatBlock(), ...skeleton(this.level.solution()).map(renderBlock));
    this.showOverlay(card);
    this.voice.say('Programın aşağı yukarı böyle görünmeli. Soru işaretli yerleri sen doldur.');
  }

  /** Çok takılınan görev sonraya bırakılabilir: sıradaki açılır, buna dönmek her zaman mümkündür. */
  canSkip() { const l = this.level; return !l.extra && l.index < LEVELS.length - 1 && !this.store.passed(l); }
  skip() {
    const next = LEVELS[this.level.index + 1];
    this.store.skip(this.level.id); this.store.addLog({ kind: 'skip', id: this.level.id });
    this.open(next);
    this.showToast('', 'O görevi sonraya bıraktık.', { sub: 'Rota ekranından istediğin zaman geri dönebilirsin.', mood: 'happy' });
  }

  /** İki yanı da kapalı bir aralıktan geçildiyse küçük bir kutlama. */
  /** Bu uçuşta ışınla kırılmamış bir kaya var mı? */
  rockAt(field, lane, y) { return hasMeteor(field, lane, y) && !this.flight.broken.has(`${lane},${y}`); }

  nearMiss(field, cell) {
    const blocked = (lane) => lane < 0 || lane >= field.lanes || this.rockAt(field, lane, cell.y);
    if (!blocked(cell.lane - 1) || !blocked(cell.lane + 1) || !(this.rockAt(field, cell.lane - 1, cell.y) || this.rockAt(field, cell.lane + 1, cell.y))) return;
    this.floaty(cell, 'Kıl payı!'); this.sfx.whoosh();
  }

  /** Bir karenin üstünde belirip yükselen kısa yazı. */
  floaty(cell, text, cls = '') {
    const box = this.view.cellBox(cell), el = document.createElement('div');
    el.className = `floaty ${cls}`; el.textContent = text;
    el.style.left = `${(box.left + box.right) / 2}px`; el.style.top = `${box.y}px`;
    $('game').append(el);
    setTimeout(() => el.remove(), 1000);
  }

  /**
   * Serbest görevin (günün dalgası, atölye) sonucu. Yıldızlar ana toplama eklenmez:
   * günün dalgası kendi sayacına yazılır, atölyede çözüm görevi paylaşılabilir kılar.
   */
  finishFree() {
    const { level, store } = this, blocks = count(this.editor.program), daily = level.extra === 'gunluk';
    // Kuranın henüz çözmediği görevde blok hedefi yoktur: yıldızlar geçiş ve kristallerdir.
    const got = level.par ? calcStars(this.results, blocks, level.par) : Math.min(2, calcStars(this.results, blocks, Infinity));
    store.attempt(level.id, { won: true, ms: this.lap() });
    this.setStatus('won');
    const total = this.results.reduce((a, r) => a + r.total, 0), collected = this.results.reduce((a, r) => a + r.collected, 0);
    const checks = [
      ['Çıkışa ulaştın', true],
      total ? [`Kristaller: ${collected} / ${total}`, collected === total] : null,
      level.par ? [blocks <= level.par ? `En çok ${level.par} blok kullandın` : `${blocks} blok kullandın (hedef ${level.par})`, blocks <= level.par] : [`${blocks} blokla çözdün`, true],
    ].filter(Boolean);
    let title = got === 3 ? 'Kusursuz uçuş!' : 'Görev tamam!', hooks = [];
    if (daily) {
      store.setDaily(level.day, got);
      hooks = [`Bugüne kadar **${store.dailyDays()}** günün dalgasını geçtin.`, 'Yarın yeni bir dalga seni bekliyor.'];
    } else if (level.own) {
      this.workshop.solved(level.waves[0], blocks);
      title = 'Görevin çözülüyor!'; hooks = ['Artık atölyeden **paylaşabilirsin**: bağlantıyı alan herkes görevini oynar.'];
    } else { title = 'Arkadaşının görevini geçtin!'; hooks = ['Sen de atölyede kendi görevini kurabilirsin.']; }
    const card = makeCard(`
      <div class="who">${robot(got === 3 ? 'wow' : 'happy')}<span class="tag">${EXTRA_LABEL[level.extra]}</span></div><h1>${title}</h1>
      <div class="bigstars">${[1, 2, 3].map((i) => svg('i-star', i <= got ? 'lit' : '')).join('')}</div>
      <ul class="checks">${checks.map(([t, ok]) => `<li class="${ok ? '' : 'no'}">${svg(ok ? 'i-check' : 'i-cross')}${t}</li>`).join('')}</ul>
      <div class="hooks">${hooks.map((h) => `<p>${rich(h)}</p>`).join('')}</div>
      <div class="btns"><button class="btn" data-act="again">${svg('i-restart')}Tekrar</button><button class="btn" data-act="watch">${svg('i-cam')}İzle</button>${daily ? '' : `<button class="btn" data-act="workshop">${level.own ? 'Atölyeye dön' : 'Ben de kurayım'}</button>`}<button class="btn primary" data-act="map">Rota</button></div>`, (act) => {
      this.sfx.click(); this.hideOverlay();
      if (act === 'watch') { this.replay(card); return; }
      if (act === 'again') { this.showWave(0); return; }
      this.close();
      if (act === 'workshop') this.workshop.open();
    });
    this.showOverlay(card);
    for (let i = 0; i < got; i++) setTimeout(() => this.sfx.star(i), 250 + i * 180);
    if (got === 3) confetti();
    this.voice.say(`${title} ${hooks.join(' ')}`);
  }

  finish() {
    if (this.level.free) return this.finishFree();
    const { level, store } = this, blocks = count(this.editor.program);
    const got = calcStars(this.results, blocks, level.par);
    const before = store.stars(level.id), first = before === 0;
    const sectorBefore = sectorStars(store, level.sector), totalBefore = store.total();
    store.setStars(level.id, got);
    store.attempt(level.id, { won: true, ms: this.lap() });
    store.addLog({ kind: 'win', id: level.id, stars: got, gain: Math.max(0, got - before) });
    // Rekor: daha çok yıldız ya da aynı yıldızla daha az blok. Uçulan yol da saklanır (rekor izi).
    const best = store.best(level.id), record = !best || got > best.stars || (got === best.stars && blocks < best.blocks);
    if (record) store.setBest(level.id, { blocks, stars: got, paths: this.results.map((r, i) => [this.fields[i].start, ...r.events.filter((e) => e.t === 'move' && !e.exit).map((e) => e.to.lane)]) });
    // Kitaplık: bu uçuşta çağrılan her manevra tanımı saklanır; ileride tanımlamadan çağrılabilir.
    const called = new Set(this.results.flatMap((r) => r.events.filter((e) => e.t === 'call').map((e) => e.name))), kept = [];
    for (const b of this.editor.program) {
      if (b.type !== 'define' || b.param || !b.body.length || !called.has(b.name)) continue;
      const old = store.library()[b.name];
      if (!old || !sameBlocks(old, b.body)) { store.keepFunction(b.name, clone(b.body)); kept.push(FUNCTIONS[b.name].label); }
    }
    this.setStatus('won'); this.renderTrack(); this.renderRecord();
    const total = this.results.reduce((a, r) => a + r.total, 0), collected = this.results.reduce((a, r) => a + r.collected, 0);
    const next = this.nextOf(level);
    const lastOfSector = !level.extra && level.n === 8;
    const checks = [
      ['Çıkışa ulaştın', true],
      total ? [`Kristaller: ${collected} / ${total}`, collected === total] : null,
      [blocks <= level.par ? `En çok ${level.par} blok kullandın` : `${blocks} blok kullandın (hedef ${level.par})`, blocks <= level.par],
      best && blocks < best.blocks ? [`Yeni rekor: ${blocks} blok (eskisi ${best.blocks})`, true] : null,
    ].filter(Boolean);
    // Kanca: sırada ne var ve en yakın hedef ne? Çocuk kartı kapatmadan bir sonraki adımı görsün.
    const leftInSector = levelsOf(level.sector).filter((l) => !store.passed(l)).length;
    const secret = extrasOf(level.sector).find((x) => x.extra === 'gizli');
    const opened = secret && !level.extra && sectorBefore < SECRET_STARS && sectorStars(store, level.sector) >= SECRET_STARS;
    const parts = unlockedBetween(totalBefore, store.total());
    const hooks = [
      opened ? `Gizli görev açıldı: **${secret.title}**! Rota ekranında soru işaretini ara.` : '',
      parts.length ? `Hangarda yeni parça: **${parts.map((p) => `${p.option.name} ${p.label.toLocaleLowerCase('tr')}`).join(', ')}**.` : '',
      kept.length ? `Kitaplığına eklendi: **${kept.join(', ')}**.` : '',
      teaser(next), nearGoal({ total: store.total(), leftInSector, sectorName: this.sector.name }),
    ].filter(Boolean);
    const card = makeCard(`
      <div class="who">${robot(got === 3 ? 'wow' : 'happy')}<span class="tag">${lastOfSector ? `SEKTÖR ${level.sector} TAMAMLANDI` : level.extra ? EXTRA_LABEL[level.extra] : `GÖREV ${level.n} / 8`}</span></div>
      <h1>${lastOfSector ? `${this.sector.name} geçildi!` : got === 3 ? 'Kusursuz uçuş!' : 'Görev tamam!'}</h1>
      <div class="bigstars">${[1, 2, 3].map((i) => svg('i-star', i <= got ? 'lit' : '')).join('')}</div>
      <ul class="checks">${checks.map(([t, ok]) => `<li class="${ok ? '' : 'no'}">${svg(ok ? 'i-check' : 'i-cross')}${t}</li>`).join('')}</ul>
      ${lastOfSector && !next ? `<p>Ana gemiye döndün! ${SECTORS.length} sektör ve ${LEVELS.length} görev tamamlandı. Kendi otopilotunu yazdın; şimdi eksik yıldızları tamamlayabilirsin.</p>` : ''}
      ${hooks.length ? `<div class="hooks">${hooks.map((h) => `<p>${rich(h)}</p>`).join('')}</div>` : ''}
      <div class="btns">
        <button class="btn" data-act="again">${svg('i-restart')}Tekrar</button>
        <button class="btn" data-act="watch">${svg('i-cam')}İzle</button>
        <button class="btn" data-act="map">Rota</button>
        ${next ? `<button class="btn primary" data-act="next">${lastOfSector ? 'Sonraki sektör' : 'Sonraki görev'}${svg('i-play')}</button>` : ''}
      </div>`, (act) => {
      this.sfx.click(); this.hideOverlay();
      if (act === 'watch') this.replay(card);
      else if (act === 'again') this.showWave(0);
      else if (act === 'map') this.close();
      else this.advance(level, next);
    });
    const reveal = () => {
      this.showOverlay(card);
      for (let i = 0; i < got; i++) setTimeout(() => this.sfx.star(i), 250 + i * 180);
      if (got === 3) confetti();
      this.voice.say(`${got === 3 ? 'Kusursuz uçuş!' : 'Görev tamam!'} ${hooks.join(' ')}`);
    };
    // Kurtarma ve terfi sahneleri sonuç kartından önce gelir: büyük ödüller yıldızlardan önce kutlanır.
    const scenes = [(then) => this.rescued(level, then), (then) => this.promoted(totalBefore, then)];
    const play = (i) => { if (i >= scenes.length) reveal(); else if (!scenes[i](() => play(i + 1))) play(i + 1); };
    play(0);
    return first;
  }

  /** Terfi töreni: toplam yıldız yeni bir rütbeye yettiyse. Kart gösterildiyse true döner. */
  promoted(totalBefore, then) {
    const rank = rankOf(this.store.total());
    if (rank === rankOf(totalBefore)) return false;
    const card = makeCard(`<div class="who"><div class="medal">${svg('i-star')}</div><span class="tag">TERFİ</span></div>
      <h1>${rank}</h1><p>Yeni rütben hayırlı olsun, pilot! Toplam <b>${this.store.total()} yıldız</b> topladın.</p>
      <div class="btns"><button class="btn primary" data-act="ok">Devam${svg('i-play')}</button></div>`, () => { this.sfx.click(); this.voice.stop(); then(); }, 'rescue');
    this.showOverlay(card); confetti(60); this.sfx.fanfare();
    this.voice.say(`Terfi ettin! Yeni rütben: ${rank}.`);
    return true;
  }

  /**
   * Kazanılan uçuşun son dalgasını öteki kameradan yeniden oynatır (üstten bakıyorsan pilot
   * gözünden); bitince sonuç kartı geri gelir. Kayda hiçbir şey yazılmaz.
   */
  async replay(card) {
    this.voice.stop();
    const id = ++this.loopId, alive = () => id === this.loopId, back = this.view.camMode;
    this.replaying = true;
    this.view.setCamera(back === 'pilot' ? 'ust' : 'pilot');
    this.view.resetShip(); this.i = 0; this.resetTelemetry();
    this.status = 'running'; this.tune();   // setStatus çağrılmaz: düğmeler ve dalga şeridi sonuç halinde kalır
    this.view.launch(); this.sfx.launch();
    for (let tick = this.nextTick(); tick && alive(); tick = this.nextTick()) {
      this.current = this.play(tick, alive);
      if (await this.current) break;
    }
    if (!alive()) return;                   // çocuk araya girdi: durdurdu ya da görevden çıktı
    this.replaying = false; this.status = 'won'; this.tune();
    this.view.setCamera(back);
    this.showOverlay(card);
  }

  /** Bu görevden sonra gidilecek ana görev (acil durumda: yanında durduğu görevin sonraki). Gizli görevden rotaya dönülür. */
  nextOf(level) {
    if (level.extra === 'gizli' || level.free) return null;
    const main = level.extra ? LEVELS.find((l) => l.id === level.after) : level;
    return LEVELS[main.index + 1] || null;
  }

  /** Sıradaki göreve geçer; araya girecek bir acil durum varsa önce onu haber verir (bir kez). */
  advance(level, next) {
    const mainId = level.extra === 'catal' ? level.after : level.id;
    const alarm = EXTRAS.find((x) => x.extra === 'acil' && x.after === mainId && !this.store.seen(`acil:${x.id}`) && !this.store.stars(x.id));
    if (!alarm) { this.open(next); return; }
    this.store.markSeen(`acil:${alarm.id}`);
    const card = makeCard(`<div class="who">${robot('alarm')}<span class="tag alarm">${EXTRA_LABEL.acil}</span></div><h1>${alarm.title}</h1><p>${alarm.alarm}</p>
      <p class="fine">Bu bir yan görev. Şimdi gitmezsen rota ekranında seni bekler.</p>
      <div class="btns"><button class="btn" data-act="later">Şimdi değil</button><button class="btn primary" data-act="go">Yardıma git${svg('i-play')}</button></div>`, (act) => {
      this.sfx.click(); this.hideOverlay(); this.voice.stop();
      this.open(act === 'go' ? alarm : next);
    }, 'alarm');
    this.showOverlay(card); this.sfx.alarm();
    this.voice.say(`Acil durum! ${alarm.alarm}`);
  }

  /**
   * Sektör finali ilk kez geçilince mürettebattan biri, gizli görevde Bip'in bir arkadaşı
   * kurtulur. Kart gösterildiyse true döner; kart kapatılınca `then` çağrılır.
   */
  rescued(level, then) {
    const bot = level.extra === 'gizli';
    const who = bot ? botOf(level.sector) : !level.extra && level.n === 8 ? crewOf(level.sector) : null;
    if (!who || !this.store.rescue(who.id)) return false;
    const story = STORY[level.sector];
    const body = bot
      ? `<p>${COPILOT}'in arkadaşı <b>${who.name}</b> bu sektörde saklanıyormuş. Artık o da köprüde!</p>`
      : `<p class="role">${who.role}</p><p class="quote">“${who.line}”</p><p>${story.close}</p>${story.villain ? `<p class="villain"><b>${VILLAIN}:</b> “${story.villain}”</p>` : ''}`;
    const card = makeCard(`<div class="who">${bot ? miniBot(who.hue) : face(who.hue)}<span class="tag">${bot ? 'GİZLİ GÖREV TAMAM' : 'KURTARMA KAPSÜLÜ BULUNDU'}</span></div>
      <h1>${who.name} gemide!</h1>${body}
      <div class="btns"><button class="btn primary" data-act="ok">Devam${svg('i-play')}</button></div>`, () => { this.sfx.click(); this.voice.stop(); then(); }, 'rescue');
    this.showOverlay(card); confetti(34); this.sfx.star(2);
    this.voice.say(bot ? `${who.name} gemide!` : `${who.name} gemide! ${who.line} ${story.close}`);
    return true;
  }

  // ---------- katmanlar ----------
  /** Bu adımda bakılan sensörleri sahnede ve kare yanındaki etiketlerde gösterir. */
  showCalls(senses) {
    const box = $('calls'); box.replaceChildren();
    const field = this.fields[this.wave];
    // Renk cevaba değil duruma bakar: engel kırmızı, açık yol yeşil; işaret ve şarj gibi
    // tehlike bildirmeyen sensörler "hayır" derken nötrdür.
    const marks = new Map();
    const mark = (ev, cell, tone) => {
      const k = `${cell.lane},${cell.y}`;
      if (!marks.has(k) || tone === 'bad') marks.set(k, { from: { lane: ev.lane, y: ev.y }, cell, tone });
    };
    const tones = senses.map((ev) => {
      const look = (cond) => sense(field, ev.lane, ev.y, cond);
      const here = { lane: ev.lane, y: ev.y }, ahead = look('ahead'), blocked = ahead.result ? 'bad' : 'ok';
      if (ev.cond === 'ahead') { mark(ev, ahead.cell, blocked); return blocked; }
      if (ev.cond === 'rightFree' || ev.cond === 'leftFree') { const t = ev.result ? 'ok' : 'bad'; mark(ev, ev.cell, t); return t; }
      if (ev.cond === 'energyLow') return ev.result ? 'bad' : 'ok';   // sayaca bakar, kareye değil
      if (ev.cond === 'counter3') return ev.result ? 'ok' : 'info';
      if (ev.cond === 'aheadAndRightFree' || ev.cond === 'aheadOrRightBlocked') {
        // Bileşik sensör iki kareye bakar; ikisi de gösterilir.
        const right = look('rightFree');
        mark(ev, ahead.cell, blocked); mark(ev, right.cell, right.result ? 'ok' : 'bad');
        return ahead.result || !right.result ? 'bad' : 'ok';
      }
      if (ev.cond === 'atBeaconOrAhead' || ev.cond === 'atBeaconAndAhead') {
        const at = look('atBeacon').result;
        mark(ev, ahead.cell, blocked); mark(ev, here, at ? 'ok' : 'info');
        return ahead.result ? 'bad' : at ? 'ok' : 'info';
      }
      const t = ev.result ? 'ok' : 'info';   // işarete vardım mı, şarjda mıyım
      mark(ev, here, t); return t;
    });
    this.view.showSenses([...marks.values()]);
    const side = senses.find((ev) => ev.cond !== 'ahead');
    const taken = new Set();
    for (const [i, ev] of senses.entries()) {
      const el = document.createElement('div'); el.className = 'call';
      el.style.setProperty('--c', TONE[tones[i]]);
      el.innerHTML = `<span class="cond">${CONDS[ev.cond].label}</span><span class="ans ${ev.result ? '' : 'no'}">${svg(ev.result ? 'i-check' : 'i-cross')}${ev.result ? 'EVET' : 'HAYIR'}</span>`;
      box.append(el);
      const cell = this.view.cellBox(ev.cell), w = el.offsetWidth, r = this.rect;
      const fits = { left: cell.left - 26 - w > r.x + 6, right: cell.right + 26 + w < r.x + r.w - 6 };
      // Yan sensörün etiketi kendi tarafına, ön sensörünki karşı tarafa konur; sığmazsa karenin üstüne.
      const want = ev.cond === 'rightFree' ? 'right' : ev.cond === 'leftFree' ? 'left' : side && side.cond === 'leftFree' ? 'right' : 'left';
      const other = want === 'left' ? 'right' : 'left';
      const place = fits[want] && !taken.has(want) ? want : fits[other] && !taken.has(other) ? other : 'top';
      taken.add(place);
      if (place === 'top') {
        el.classList.add('top');
        el.style.left = `${Math.max(r.x + w / 2 + 6, Math.min(r.x + r.w - w / 2 - 6, (cell.left + cell.right) / 2))}px`;
        el.style.top = `${cell.y - (cell.right - cell.left) * 0.42 - 12}px`;
      } else {
        el.classList.toggle('right', place === 'right');
        el.style.left = `${place === 'left' ? cell.left - 26 : cell.right + 26}px`; el.style.top = `${cell.y}px`;
      }
    }
  }
  hideCall() { $('calls').replaceChildren(); this.view.hideSense(); }

  /** Sarı silüeti verilen hareketin hedef karesine koyar; hedef yoksa ya da çıkışın ötesindeyse gizler. */
  showTarget(ev) {
    if (ev && !ev.exit) this.view.showTarget(ev.to); else this.view.hideTarget();
  }

  /**
   * Bip'in konuşma balonu.
   * @param kind          'bad' | 'good' | ''
   * @param opts.sub      ikinci satır (açıklama ya da ipucu)
   * @param opts.mood     robotun yüzü; verilmezse türe göre seçilir
   * @param opts.buttons  [{ label, onClick, cls }]
   * @param opts.quiet    sesli okuma açık olsa da okunmaz
   */
  showToast(kind, text, { sub = '', mood = null, buttons = [], quiet = false } = {}) {
    const el = $('toast');
    el.className = `toast glass ${kind}`;
    el.innerHTML = `${robot(mood || (kind === 'bad' ? 'sad' : kind === 'good' ? 'happy' : 'idle'))}<div class="say">${rich(text)}${sub ? `<span class="hint">${rich(sub)}</span>` : ''}</div>`;
    if (buttons.length) {
      const box = document.createElement('div'); box.className = 'tbtns';
      for (const b of buttons) {
        const btn = document.createElement('button'); btn.textContent = b.label; if (b.cls) btn.className = b.cls;
        btn.addEventListener('click', () => { this.sfx.click(); b.onClick(); });
        box.append(btn);
      }
      el.append(box);
    }
    el.hidden = false;
    if (!quiet) this.voice.say(`${text} ${sub}`);
  }
  hideToast() { $('toast').hidden = true; }

  showOverlay(card) { showCard(card); }
  hideOverlay() { hideCard(); }

  /** Sektöre ilk girişte Bip'in telsiz mesajı: hikâye bir adım ilerler. Ardından `then` çalışır. */
  showStory(sector, then) {
    const story = STORY[sector.id];
    if (!story || this.store.seen(`story:${sector.id}`)) { then(); return; }
    const card = makeCard(`<div class="who">${robot('idle')}<span class="tag radio">${svg('i-radio')}TELSİZ · SEKTÖR ${sector.id}</span></div>
      <h1>${sector.name}</h1><p>${story.open}</p>
      <div class="btns"><button class="btn primary" data-act="ok">Devam${svg('i-play')}</button></div>`, () => { this.sfx.click(); this.store.markSeen(`story:${sector.id}`); then(); });
    this.showOverlay(card);
    this.voice.say(story.open);
  }

  showIntro(sector) {
    const card = document.createElement('div'); card.className = 'card glass';
    card.innerHTML = `<span class="tag">SEKTÖR ${sector.id} · YENİ KAVRAM: ${sector.concept.toLocaleUpperCase('tr')}</span><h1>${sector.intro.title}</h1><p>${sector.intro.text}</p>
      <div class="demo"></div><div class="btns"><button class="btn primary" data-act="go">Başla${svg('i-play')}</button></div>`;
    const demo = card.querySelector('.demo');
    demo.append(hatBlock(), ...sector.intro.demo().map(renderBlock));
    card.querySelector('[data-act]').addEventListener('click', () => { this.sfx.click(); this.store.markIntro(sector.id); this.hideOverlay(); this.voice.say(`${this.level.title}. ${this.level.brief}`); });
    this.showOverlay(card);
    this.voice.say(`${sector.intro.title}. ${sector.intro.text}`);
  }
}
