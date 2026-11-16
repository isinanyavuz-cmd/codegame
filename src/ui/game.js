// Görev ekranı: sahneyi açar, programı çalıştırır, olayları sırayla oynatır,
// dalgaları ve sonucu yönetir.
import { parseField, simulate, sense, stars as calcStars, FAIL_TEXT } from '../engine/world.js';
import { count, clone, toPython, CONDS, EVENTS, FUNCTIONS } from '../engine/blocks.js';
import { LEVELS, SECTORS, KINDS, levelsOf } from '../content/levels.js';
import { Editor, renderBlock, hatBlock } from './editor.js';

const $ = (id) => document.getElementById(id);
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
const rich = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const SPEEDS = [1, 2, 0.5];
// Uçuş sırasında ortaya çıkan başarısızlıklar; çok dalgalı görevde hangi dalgada olduğu da söylenir.
const IN_FLIGHT = ['meteor', 'wall', 'pirate', 'shield', 'energy', 'overflow', 'station', 'ended', 'idle', 'limit'];
const TONE = { bad: 'var(--bad)', ok: 'var(--ok)', info: '#8fa6e8' };

export class Game {
  constructor({ view, store, sfx, music, onExit }) {
    Object.assign(this, { view, store, sfx, music, onExit });
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
    this.setSpeed(SPEEDS.includes(store.speed) ? store.speed : 1);
  }

  // ---------- sahne açma ----------
  open(level) {
    this.loopId++; this.level = level;
    const sector = SECTORS.find((s) => s.id === level.sector);
    this.sector = sector;
    this.fields = level.waves.map(parseField);
    this.wave = 0; this.results = [];
    $('game').hidden = false;
    $('sectorNo').textContent = `SEKTÖR ${sector.id}`; $('sectorName').textContent = sector.name;
    $('missionNo').textContent = `GÖREV ${level.n} / 8`; $('conceptChip').textContent = sector.concept;
    $('missionTitle').textContent = level.title; $('missionText').innerHTML = rich(level.brief);
    this.renderTrack();
    $('waveNote').innerHTML = `Aynı program ${this.fields.length} dalgayı da geçmeli.<span class="more"> Görmek için sayıya dokun.</span>`;
    const saved = this.store.program(level.saveKey);
    const program = saved && saved.length ? clone(saved) : level.initial ? level.initial() : [];
    this.editor.load(level, program);
    this.setTab('blocks'); this.hideToast(); this.hideCall(); this.setStatus('idle');
    this.refreshMeta(); this.renderWaves();
    this.resetTelemetry();
    this.layout();
    this.view.setTheme(sector.id);
    document.documentElement.style.setProperty('--sector', this.view.theme.accent);
    this.view.setField(this.fields[0]);
    this.view.enter();
    history.replaceState(null, '', `#${level.id}`);
    if (level.n === 1 && !this.store.introSeen(sector.id)) this.showIntro(sector);
  }

  close() {
    this.loopId++; this.view.setField(null); this.view.setTheme(0);
    this.hideCall(); this.hideToast(); this.hideOverlay(); this.editor.closePop();
    $('game').hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
    this.onExit(this.level);
  }

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
  }

  renderTrack() {
    const levels = levelsOf(this.level.sector), parts = [];
    levels.forEach((l, i) => {
      const done = this.store.stars(l.id) > 0, cur = l.id === this.level.id, locked = !this.store.isUnlocked(l, LEVELS);
      const cls = ['node', l.n === 8 ? 'boss' : '', cur ? 'cur' : done ? 'done' : '', locked ? 'locked' : ''].join(' ');
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
    const flying = this.status === 'running' || this.status === 'paused';
    const pips = this.fields.map((_, i) => {
      const cls = i < this.results.length ? 'ok' : i !== this.wave ? '' : this.status === 'failed' ? 'bad' : flying ? 'on' : 'view';
      return `<button class="${cls}" data-wave="${i}" aria-label="Dalga ${i + 1}">${i + 1}</button>`;
    });
    el.innerHTML = pips.join('');
  }

  /** Uçuşu durdurur ve seçilen dalganın alanını gösterir: çocuk programı yazarken bütün dalgalara bakabilsin. */
  showWave(i) {
    this.loopId++; this.hideCall(); this.hideToast(); this.editor.mark(null);
    this.results = []; this.wave = i;
    this.view.setField(this.fields[i]);
    this.resetTelemetry(); this.setStatus('idle');
  }

  refreshMeta() {
    const n = count(this.editor.program), { maxBlocks, par } = this.level;
    const el = $('counter');
    el.classList.toggle('full', n >= maxBlocks);
    el.innerHTML = `<span><b>${n}</b> / ${maxBlocks} blok</span><span class="goal ${n > 0 && n <= par ? 'lit' : ''}">${svg('i-star')}en çok ${par}</span>`;
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
    const code = toPython(this.editor.program).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\b(for|in|while|if|else|pass|True|not|and|or|def)\b/g, '<span class="k">$1</span>')
      .replace(/\b([a-z_]+)\(/g, '<span class="f">$1</span>(')
      .replace(/\((\d+)\)/g, '(<span class="n">$1</span>)')
      .replace(/^(#.*)$/gm, '<span class="c">$1</span>');
    $('py').innerHTML = `<span class="c"># Aynı program, Python diliyle</span>\n${code}`;
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
      this.showToast('bad', `Blok sınırı doldu: en fazla ${this.level.maxBlocks} blok.`, this.level.sector === 2 ? 'Tekrar eden hareketleri bir "tekrarla" bloğuna topla.' : '');
    } else if (kind === 'condtip') this.showToast('', 'Sensörü "eğer" veya "olana kadar" bloğuna bırak. Koşulu değiştirmek için de bloğun koşuluna dokunabilirsin.');
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
    const btn = $('runBtn');
    const label = { idle: ['i-play', 'Uçur'], running: ['i-pause', 'Duraklat'], paused: ['i-play', 'Devam'], failed: ['i-undo', 'Tekrar dene'], won: ['i-play', 'Uçur'] }[s];
    btn.innerHTML = `${svg(label[0])}${label[1]}`;
    btn.classList.toggle('go', s === 'paused');
    $('resetBtn').disabled = s === 'idle';
    this.renderWaves();
  }

  setSpeed(v) { this.speed = v; this.view.speed = v; this.store.speed = v; $('speedLab').textContent = v === 0.5 ? '½×' : `${v}×`; }
  cycleSpeed() { this.sfx.click(); this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]); }

  onRun() {
    this.sfx.click();
    if (this.status === 'failed') this.stop();
    else if (this.status === 'idle') this.start(false);
    else if (this.status === 'running') this.setStatus('paused');
    else if (this.status === 'paused') { this.stepMode = false; this.resume(); }
  }
  onStep() {
    this.sfx.click();
    if (this.status === 'failed') this.stop();
    else if (this.status === 'idle') this.start(true);
    else if (this.status === 'paused') { this.stepMode = true; this.resume(); }
    else if (this.status === 'running') this.stepMode = true;
  }

  start(step) {
    this.reset();
    // Uçuş hep ilk dalgadan başlar; ekranda başka bir dalga duruyorsa önce ilkine dönülür.
    if (this.wave !== 0) { this.wave = 0; this.view.setField(this.fields[0]); }
    this.stepMode = step; this.results = [];
    this.simulateWave();
    this.setStatus('running');
    this.view.launch(); this.sfx.launch();
    this.loop(++this.loopId);
  }

  simulateWave() {
    this.sim = simulate(this.fields[this.wave], this.editor.program);
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
  stop() { this.loopId++; this.reset(); this.setStatus('idle'); }

  reset() {
    this.hideCall(); this.hideToast(); this.editor.mark(null);
    this.results = [];
    this.view.resetShip();
    this.resetTelemetry();
  }

  resetTelemetry() {
    const f = this.fields[this.wave];
    this.flight = { energy: f.energyCells.size ? 0 : null, shielded: false, message: '' };
    this.renderTelemetry();
  }

  /** Uçuş göstergesi: enerji hücreleri, kalkan durumu ve alandaki özel karelerin anlamı. */
  renderTelemetry() {
    const el = $('telemetry'), f = this.fields[this.wave], state = this.flight;
    const hasEnergy = state.energy !== null, hasShield = f.pirates.size > 0;
    el.hidden = !(hasEnergy || hasShield || f.beacons.size || f.energyCells.size);
    const gauges = [], key = [];
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
    if (['move', 'event', 'variable', 'shield', 'call'].includes(ev.t)) marks.push({ id: ev.id, cls: 'now' });
    else if (ev.t === 'crash' || ev.t === 'fail') marks.push({ id: ev.id, cls: 'err' });
    editor.markAll(marks);
    if (senses.length) { this.showCalls(senses); sfx.sense(senses[senses.length - 1].result); } else this.hideCall();
    if (['event', 'variable', 'shield', 'call'].includes(ev.t)) {
      if (ev.t === 'event') this.flight.message = EVENTS[ev.event].label;
      if (ev.t === 'variable') { this.flight.energy = ev.value; this.flight.message = 'Enerji güncellendi'; }
      if (ev.t === 'shield') { this.flight.shielded = ev.shielded; this.flight.message = 'Kalkan hazır'; view.setShield(ev.shielded); sfx.shield(); }
      if (ev.t === 'call') this.flight.message = `${FUNCTIONS[ev.name].label} çağrılıyor`;
      this.renderTelemetry();
      await view.wait(130);
      return !alive();
    }
    if (ev.t === 'move') {
      if (ev.kind === 'fwd') sfx.move(); else sfx.dodge();
      this.showTarget(ev);
      await view.move(ev);
      if (!alive()) return true;
      if (ev.collect) sfx.collect();
      this.flight.energy = ev.energy;
      if (ev.shielded !== undefined) this.flight.shielded = ev.shielded;
      if (ev.blocked) this.flight.message = 'Korsan saldırısı engellendi';
      this.renderTelemetry();
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
      sfx.bad();
      this.fail(ev.reason);
      return true;
    }
    // win
    editor.mark(null); sfx.win();
    await view.win();
    if (!alive()) return true;
    this.results.push(this.sim);
    if (this.wave < this.fields.length - 1) {
      this.showToast('good', `Dalga ${this.wave + 1} tamam! Sıradaki dalga geliyor…`);
      this.wave++; this.renderWaves();
      await view.wait(500);
      if (!alive()) return true;
      view.setField(this.fields[this.wave]);
      await view.enter();
      if (!alive()) return true;
      this.hideToast(); this.simulateWave();
      return false;
    }
    this.finish();
    return true;
  }

  fail(reason) {
    this.setStatus('failed');
    const inFlight = this.fields.length > 1 && IN_FLIGHT.includes(reason);
    const text = inFlight ? `Dalga ${this.wave + 1}: ${FAIL_TEXT[reason]}` : FAIL_TEXT[reason];
    // Önceki dalgayı geçen program burada takıldıysa nedeni söylenir; yoksa "çözmüştüm" diye düşünülür.
    const sub = inFlight && this.wave > 0 ? 'Programın önceki dalgayı geçti ama burada yol farklı. Aynı program bütün dalgaları geçmeli.' : '';
    this.showToast('bad', text, sub, this.level.hint);
  }

  finish() {
    const { level, store } = this, blocks = count(this.editor.program);
    const got = calcStars(this.results, blocks, level.par);
    const first = store.stars(level.id) === 0;
    store.setStars(level.id, got);
    this.setStatus('won'); this.renderTrack();
    const total = this.results.reduce((a, r) => a + r.total, 0), collected = this.results.reduce((a, r) => a + r.collected, 0);
    const next = LEVELS[level.index + 1];
    const lastOfSector = level.n === 8;
    const checks = [
      ['Çıkışa ulaştın', true],
      total ? [`Kristaller: ${collected} / ${total}`, collected === total] : null,
      [blocks <= level.par ? `En çok ${level.par} blok kullandın` : `${blocks} blok kullandın (hedef ${level.par})`, blocks <= level.par],
    ].filter(Boolean);
    const card = document.createElement('div'); card.className = 'card glass';
    card.innerHTML = `
      <span class="tag">${lastOfSector ? `SEKTÖR ${level.sector} TAMAMLANDI` : `GÖREV ${level.n} / 8`}</span>
      <h1>${lastOfSector ? `${this.sector.name} geçildi!` : got === 3 ? 'Kusursuz uçuş!' : 'Görev tamam!'}</h1>
      <div class="bigstars">${[1, 2, 3].map((i) => svg('i-star', i <= got ? 'lit' : '')).join('')}</div>
      <ul class="checks">${checks.map(([t, ok]) => `<li class="${ok ? '' : 'no'}">${svg(ok ? 'i-check' : 'i-cross')}${t}</li>`).join('')}</ul>
      ${lastOfSector && !next ? `<p>Ana gemiye döndün! ${SECTORS.length} sektör ve ${LEVELS.length} görev tamamlandı. Kendi otopilotunu yazdın; şimdi eksik yıldızları tamamlayabilirsin.</p>` : ''}
      <div class="btns">
        <button class="btn" data-act="again">${svg('i-undo')}Tekrar</button>
        <button class="btn" data-act="map">Rota</button>
        ${next ? `<button class="btn primary" data-act="next">${lastOfSector ? 'Sonraki sektör' : 'Sonraki görev'}${svg('i-play')}</button>` : ''}
      </div>`;
    card.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      this.sfx.click(); this.hideOverlay();
      if (act === 'again') this.showWave(0);
      else if (act === 'map') this.close();
      else this.open(next);
    });
    this.showOverlay(card);
    for (let i = 0; i < got; i++) setTimeout(() => this.sfx.star(i), 250 + i * 180);
    return first;
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

  showToast(kind, text, sub = '', hint = '') {
    const el = $('toast');
    el.className = `toast glass ${kind}`;
    el.innerHTML = `<div>${rich(text)}${sub ? `<span class="hint">${rich(sub)}</span>` : ''}</div>${hint ? '<button>İpucu</button>' : ''}`;
    if (hint) el.querySelector('button').addEventListener('click', () => { this.sfx.click(); this.showToast(kind, text, hint); });
    el.hidden = false;
  }
  hideToast() { $('toast').hidden = true; }

  showOverlay(card) { const o = $('overlay'); o.replaceChildren(card); o.hidden = false; }
  hideOverlay() { $('overlay').hidden = true; }

  showIntro(sector) {
    const card = document.createElement('div'); card.className = 'card glass';
    card.innerHTML = `<span class="tag">SEKTÖR ${sector.id} · YENİ KAVRAM: ${sector.concept.toUpperCase()}</span><h1>${sector.intro.title}</h1><p>${sector.intro.text}</p>
      <div class="demo"></div><div class="btns"><button class="btn primary" data-act="go">Başla${svg('i-play')}</button></div>`;
    const demo = card.querySelector('.demo');
    demo.append(hatBlock(), ...sector.intro.demo().map(renderBlock));
    card.querySelector('[data-act]').addEventListener('click', () => { this.sfx.click(); this.store.markIntro(sector.id); this.hideOverlay(); });
    this.showOverlay(card);
  }
}
