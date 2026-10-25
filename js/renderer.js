/* KodRobot — Canvas renderer (CodeGame.Renderer)
 * Bir World nesnesini Box Island tarzında çizer: denizin ortasında çimenli
 * bir ada. '#' hücreler deniz, diğerleri çimen karo. Eylemler arasında yumuşak
 * geçişler, suya çarpınca sıçrama, elmas patlaması ve kazanma konfetisi yapar.
 *
 * Genel API:
 *   new CodeGame.Renderer(canvas, { container })
 *   setWorld(world), snap(), resize(), celebrate()
 *   animate(action, world, ms) -> Promise
 *   crash(world, ms)           -> Promise
 *   puzzled(world, ms)         -> Promise   (ör. elmas olmayan yerde topla)
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  const TAU = Math.PI * 2;
  const DIR_ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  const DIR_VEC = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const CLIFF = 0.3;   // adanın ön yüz (toprak) yüksekliği, hücre oranı
  const MARGIN = 0.75; // adanın çevresinde görünen deniz payı (hücre)
  const MAX_CELL = 112;

  const COLOR_VARS = [
    'sea', 'sea-deep', 'sea-light', 'sea-shallow', 'foam',
    'grass-a', 'grass-b', 'grass-light', 'grass-tuft', 'dirt', 'dirt-dark',
    'goal', 'goal-glow', 'flag', 'flag-dark', 'gem', 'gem-dark', 'gem-light',
    'robot', 'robot-dark', 'robot-face', 'robot-eye', 'crash',
    'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'ink'
  ];
  const FALLBACK = {
    'sea': '#4cc3ee', 'sea-deep': '#36afe2', 'sea-light': '#b9ecff', 'sea-shallow': '#7fdcf0',
    'foam': '#f4fdff', 'grass-a': '#8fdc5a', 'grass-b': '#80d04c', 'grass-light': '#b9f080',
    'grass-tuft': '#5cad38', 'dirt': '#c98b52', 'dirt-dark': '#9a6236',
    'goal': '#ffc23d', 'goal-glow': 'rgba(255,214,90,.55)', 'flag': '#ff4f6d', 'flag-dark': '#c92c4a',
    'gem': '#b25cff', 'gem-dark': '#7a2fd6', 'gem-light': '#ecd6ff', 'robot': '#ff8a3d',
    'robot-dark': '#d9631b', 'robot-face': '#2b2340', 'robot-eye': '#7cf7ff',
    'crash': '#ef4b5f', 'confetti-1': '#ff4fa3', 'confetti-2': '#20c4f4',
    'confetti-3': '#ffc23d', 'confetti-4': '#1fb86a', 'confetti-5': '#6c4cf1',
    'ink': '#2b2340'
  };

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const now = () => (root.performance && performance.now ? performance.now() : Date.now());
  const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : (fn) => setTimeout(() => fn(now()), 16);
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Köşe başına yarıçaplı dikdörtgen: [sol-üst, sağ-üst, sağ-alt, sol-alt] */
  function cornerRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r[0], y);
    ctx.lineTo(x + w - r[1], y);
    if (r[1]) ctx.arcTo(x + w, y, x + w, y + r[1], r[1]); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - r[2]);
    if (r[2]) ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + r[3], y + h);
    if (r[3]) ctx.arcTo(x, y + h, x, y + h - r[3], r[3]); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r[0]);
    if (r[0]) ctx.arcTo(x, y, x + r[0], y, r[0]); else ctx.lineTo(x, y);
    ctx.closePath();
  }

  function star4(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
  }

  class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{container?: HTMLElement}} [opts]
     */
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.container = opts.container || canvas.parentElement;
      this.world = null;
      this.colors = Object.assign({}, FALLBACK);
      this.robot = { x: 0, y: 0, angle: 0, hop: 0 };
      this.displayGems = new Set();
      this.tween = null;
      this.effects = [];
      this.particles = [];
      this.shake = 0;
      this.flash = 0;
      this.mood = 'normal';
      this.cell = 40;
      this.ox = 0;
      this.oy = 0;
      this.dpr = 1;
      this.cssW = 0;
      this.cssH = 0;
      this.time = 0;
      this.last = now();
      this._rm = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

      this.readColors();
      this._onResize = () => this.resize();
      if (typeof ResizeObserver !== 'undefined' && this.container) {
        this._ro = new ResizeObserver(this._onResize);
        this._ro.observe(this.container);
      }
      if (root.addEventListener) root.addEventListener('resize', this._onResize);
      if (root.matchMedia) {
        const mq = root.matchMedia('(prefers-color-scheme: dark)');
        const onTheme = () => this.readColors();
        if (mq.addEventListener) mq.addEventListener('change', onTheme);
        else if (mq.addListener) mq.addListener(onTheme);
      }
      this._loop = this._loop.bind(this);
      raf(this._loop);
    }

    get reduced() { return !!(this._rm && this._rm.matches); }

    /** CSS özel özelliklerinden renkleri okur. */
    readColors() {
      if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') return;
      const cs = getComputedStyle(document.documentElement);
      for (const name of COLOR_VARS) {
        const v = cs.getPropertyValue('--' + name).trim();
        this.colors[name] = v || FALLBACK[name];
      }
    }

    /** Yeni bir dünya bağlar ve her şeyi anında onun durumuna getirir. */
    setWorld(world) {
      this.world = world;
      this.particles = [];
      this.effects = [];
      this.shake = 0;
      this.flash = 0;
      this._land = null;
      this.snap();
      this.cssW = 0; // yeniden boyutlandırmayı zorla
      this.resize();
    }

    /** Animasyonu kesip görüntüyü dünyanın şu anki durumuna eşitler. */
    snap() {
      const w = this.world;
      if (this.tween) {
        const r = this.tween.resolve;
        this.tween = null;
        r();
      }
      if (!w) return;
      this.robot = { x: w.robot.x, y: w.robot.y, angle: DIR_ANGLE[w.robot.dir] || 0, hop: 0, tilt: 0 };
      this.displayGems = new Set(w.gems);
      this.mood = w.crashed ? 'crash' : 'normal';
    }

    /** Karalardan oluşan alanın sınır kutusu (deniz payı hesabı için). */
    _landBox() {
      const w = this.world;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (w.cellAt(x, y) === '#') continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (minX === Infinity) { minX = 0; minY = 0; maxX = w.width - 1; maxY = w.height - 1; }
      return { minX, minY, maxX, maxY };
    }

    resize() {
      const w = this.world;
      const box = this.container;
      if (!w || !box) return;
      const lb = this._landBox();
      const viewW = (lb.maxX - lb.minX + 1) + MARGIN * 2;
      const viewH = (lb.maxY - lb.minY + 1) + MARGIN * 2 + CLIFF;
      box.style.setProperty('--board-ratio', viewW.toFixed(2) + ' / ' + viewH.toFixed(2));
      const cssW = Math.floor(box.clientWidth);
      const cssH = Math.floor(box.clientHeight);
      if (cssW < 20 || cssH < 20) return;
      let cell = Math.floor(Math.min(cssW / viewW, cssH / viewH));
      cell = Math.max(8, Math.min(cell, MAX_CELL));
      const ox = Math.round((cssW - cell * viewW) / 2 - (lb.minX - MARGIN) * cell);
      const oy = Math.round((cssH - cell * viewH) / 2 - (lb.minY - MARGIN) * cell);
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      if (cell === this.cell && cssW === this.cssW && cssH === this.cssH && dpr === this.dpr &&
          ox === this.ox && oy === this.oy) return;
      this.cell = cell;
      this.cssW = cssW;
      this.cssH = cssH;
      this.ox = ox;
      this.oy = oy;
      this.dpr = dpr;
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
    }

    /**
     * Dünyada az önce gerçekleşen eylemi canlandırır.
     * @returns {Promise<void>} animasyon bitince çözülür
     */
    animate(action, world, duration) {
      if (world && world !== this.world) this.world = world;
      const w = this.world;
      duration = Math.max(16, duration || 300);
      if (this.tween) this._finishTween();
      const from = { x: this.robot.x, y: this.robot.y, angle: this.robot.angle };
      let delta = (DIR_ANGLE[w.robot.dir] || 0) - from.angle;
      delta = ((delta % TAU) + TAU + Math.PI) % TAU - Math.PI; // en kısa dönüş
      const to = { x: w.robot.x, y: w.robot.y, angle: from.angle + delta };
      let kind = action;
      if (action === 'pick' || action === 'topla') {
        kind = 'pick';
        for (const key of this.displayGems) {
          if (!w.gems.has(key)) {
            const p = key.split(',').map(Number);
            this._gemPop(p[0], p[1]);
          }
        }
        this.displayGems = new Set(w.gems);
      }
      return new Promise((resolve) => {
        this.tween = { from, to, start: now(), dur: duration, kind, resolve };
      });
    }

    /** Suya çarpma: kenara kadar kayma, sıçrama, sarsıntı, geri sekme. */
    crash(world, duration) {
      if (world) this.world = world;
      if (this.tween) this._finishTween();
      duration = Math.max(260, (duration || 300) * 1.9);
      const w = this.world;
      const v = DIR_VEC[w.robot.dir] || [1, 0];
      const from = { x: this.robot.x, y: this.robot.y, angle: this.robot.angle };
      this.mood = 'crash';
      return new Promise((resolve) => {
        this.tween = { from, to: from, start: now(), dur: duration, kind: 'crash', v, resolve, hit: false };
      });
    }

    /** Şaşkın robot: kafa sallar, üstünde "?" çıkar. */
    puzzled(world, duration) {
      if (world) this.world = world;
      if (this.tween) this._finishTween();
      duration = Math.max(300, (duration || 300) * 1.8);
      const from = { x: this.robot.x, y: this.robot.y, angle: this.robot.angle };
      this.effects.push({ type: 'question', start: now(), dur: duration + 900 });
      return new Promise((resolve) => {
        this.tween = { from, to: from, start: now(), dur: duration, kind: 'puzzled', resolve };
      });
    }

    /** Kazanma kutlaması: konfeti + mutlu robot. */
    celebrate() {
      this.mood = 'happy';
      const cols = ['confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5'];
      const W = this.cssW || 300;
      const n = this.reduced ? 0 : 170;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          type: 'confetti',
          x: Math.random() * W,
          y: -20 - Math.random() * (this.cssH * 0.6),
          vx: (Math.random() - 0.5) * 80,
          vy: 40 + Math.random() * 120,
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
          w: 5 + Math.random() * 7,
          h: 3 + Math.random() * 4,
          color: this.colors[cols[i % cols.length]],
          wob: Math.random() * TAU,
          life: 4 + Math.random() * 2
        });
      }
      // robotun etrafında yıldız patlaması
      const cx = this._px(this.robot.x);
      const cy = this._py(this.robot.y);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        const sp = 90 + Math.random() * 90;
        this.particles.push({
          type: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.7, max: 0.7, color: this.colors.goal, size: 3 + Math.random() * 3
        });
      }
    }

    // ---------------- iç işler ----------------

    _px(x) { return this.ox + (x + 0.5) * this.cell; }
    _py(y) { return this.oy + (y + 0.5) * this.cell; }

    _finishTween() {
      const t = this.tween;
      if (!t) return;
      this.tween = null;
      this.robot.x = t.to.x;
      this.robot.y = t.to.y;
      this.robot.angle = t.to.angle;
      this.robot.hop = 0;
      this.robot.tilt = 0;
      t.resolve();
    }

    _gemPop(gx, gy) {
      this.effects.push({ type: 'pop', x: gx, y: gy, start: now(), dur: 650 });
      const c = this.cell;
      const cx = this._px(gx);
      const cy = this._py(gy);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU;
        const sp = 60 + Math.random() * 120;
        this.particles.push({
          type: 'shard', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
          life: 0.8, max: 0.8, size: c * (0.05 + Math.random() * 0.05),
          color: i % 3 === 0 ? this.colors['gem-light'] : this.colors.gem
        });
      }
    }

    _splash() {
      const c = this.cell;
      const v = (this.tween && this.tween.v) || [1, 0];
      const gx = this.robot.x + v[0] * 0.75;
      const gy = this.robot.y + v[1] * 0.75;
      this.effects.push({ type: 'splash', x: gx, y: gy, start: now(), dur: 900 });
      const cx = this._px(gx);
      const cy = this._py(gy);
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 70 + Math.random() * 150;
        this.particles.push({
          type: 'drop', x: cx + (Math.random() - 0.5) * c * 0.3, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.75, max: 0.75, size: 2 + Math.random() * c * 0.05,
          color: i % 3 ? this.colors.foam : this.colors['sea-light']
        });
      }
    }

    _update(dt, t) {
      this.time += dt;
      const tw = this.tween;
      if (tw) {
        const p = clamp01((t - tw.start) / tw.dur);
        if (tw.kind === 'crash') {
          // 0..0.4 kenara kay, 0.4'te sıçrama, sonra geri sek
          let off;
          if (p < 0.4) off = easeOut(p / 0.4) * 0.42;
          else off = 0.42 * (1 - easeOut((p - 0.4) / 0.6));
          if (p >= 0.4 && !tw.hit) {
            tw.hit = true;
            this.shake = this.reduced ? 0 : 1;
            this.flash = 1;
            this._splash();
          }
          this.robot.x = tw.from.x + tw.v[0] * off;
          this.robot.y = tw.from.y + tw.v[1] * off;
          this.robot.tilt = p < 0.4 ? 0 : Math.sin((p - 0.4) / 0.6 * Math.PI * 3) * 0.18 * (1 - p);
        } else if (tw.kind === 'puzzled') {
          this.robot.angle = tw.from.angle + Math.sin(p * Math.PI * 4) * 0.35 * (1 - p);
        } else {
          const e = easeInOut(p);
          this.robot.x = tw.from.x + (tw.to.x - tw.from.x) * e;
          this.robot.y = tw.from.y + (tw.to.y - tw.from.y) * e;
          this.robot.angle = tw.from.angle + (tw.to.angle - tw.from.angle) * e;
          this.robot.hop = tw.kind === 'pick' ? Math.sin(p * Math.PI) : tw.kind === 'move' ? Math.sin(p * Math.PI) * 0.25 : 0;
        }
        if (p >= 1) this._finishTween();
      }
      this.shake = Math.max(0, this.shake - dt * 2.6);
      this.flash = Math.max(0, this.flash - dt * 2.2);

      const H = this.cssH;
      for (const pt of this.particles) {
        pt.life -= dt;
        if (pt.type === 'confetti') {
          pt.wob += dt * 6;
          pt.vy = Math.min(pt.vy + 220 * dt, 260);
          pt.x += (pt.vx + Math.sin(pt.wob) * 30) * dt;
          pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt;
          if (pt.y > H + 20) pt.life = 0;
        } else {
          pt.vy += (pt.type === 'shard' || pt.type === 'drop' ? 420 : 120) * dt;
          pt.vx *= 0.98;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          if (pt.rot !== undefined) pt.rot += pt.vr * dt;
        }
      }
      this.particles = this.particles.filter((p) => p.life > 0);
      this.effects = this.effects.filter((e) => t - e.start < e.dur);
    }

    _loop(t) {
      t = t || now();
      const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      try {
        this._update(dt, now());
        this._draw(now());
      } catch (e) {
        if (root.console) console.error(e);
      }
      raf(this._loop);
    }

    _isLand(x, y) { return this.world.cellAt(x, y) !== '#'; }

    /** cornerRect gibi ama yeni yol başlatmaz (birden çok şekli tek dolguda birleştirmek için). */
    _cornerPath(x, y, w, h, r) {
      const ctx = this.ctx;
      ctx.moveTo(x + r[0], y);
      ctx.lineTo(x + w - r[1], y);
      if (r[1]) ctx.arcTo(x + w, y, x + w, y + r[1], r[1]); else ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r[2]);
      if (r[2]) ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]); else ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + r[3], y + h);
      if (r[3]) ctx.arcTo(x, y + h, x, y + h - r[3], r[3]); else ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r[0]);
      if (r[0]) ctx.arcTo(x, y, x + r[0], y, r[0]); else ctx.lineTo(x, y);
      ctx.closePath();
    }

    _draw(t) {
      const ctx = this.ctx;
      const w = this.world;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      if (!w || !this.cssW) return;
      const col = this.colors;
      const tt = this.reduced ? 0 : t;

      ctx.save();
      if (this.shake > 0) {
        const s = this.shake * this.shake * this.cell * 0.12;
        ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
      }
      this._drawSea(tt);
      ctx.translate(this.ox, this.oy);
      this._drawIsland(tt);

      // hedef bayrağın zemini
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (w.cellAt(x, y) === 'G') this._drawGoalPad(x, y, tt);
        }
      }

      // satır satır: elmaslar, bayrak, robot (derinlik sırası)
      const robotRow = Math.round(this.robot.y);
      for (let y = 0; y < w.height; y++) {
        for (const key of this.displayGems) {
          const p = key.split(',');
          if (+p[1] === y) this._drawGem(+p[0], y, tt);
        }
        const goalHere = w.goal && w.goal.y === y;
        const robotOnGoal = w.goal && Math.round(this.robot.x) === w.goal.x && robotRow === w.goal.y;
        if (goalHere && !robotOnGoal) this._drawFlag(w.goal.x, y, tt);
        if (robotRow === y) this._drawRobot(t);
        if (goalHere && robotOnGoal) this._drawFlag(w.goal.x, y, tt);
      }
      if (robotRow < 0 || robotRow >= w.height) this._drawRobot(t);

      // efektler
      for (const e of this.effects) {
        if (e.type === 'pop') this._drawPop(e, t);
        else if (e.type === 'splash') this._drawSplash(e, t);
        else if (e.type === 'question') this._drawQuestion(e, t);
      }
      ctx.restore();

      // parçacıklar (sarsıntıdan bağımsız, tuval koordinatlarında)
      ctx.save();
      for (const p of this.particles) {
        if (p.type === 'confetti') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.wob)) * 0.8 + 0.2);
          ctx.globalAlpha = Math.min(1, p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        } else if (p.type === 'shard') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = clamp01(p.life / p.max);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.7, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.7, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.globalAlpha = clamp01(p.life / p.max);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * clamp01(p.life / p.max)), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();

      if (this.flash > 0) {
        ctx.globalAlpha = this.flash * 0.16;
        ctx.fillStyle = col.crash;
        ctx.fillRect(0, 0, this.cssW, this.cssH);
        ctx.globalAlpha = 1;
      }
    }

    /** Deniz: düz renk + hafifçe salınan dalga çizgileri. */
    _drawSea(t) {
      const ctx = this.ctx;
      const c = this.cell;
      const col = this.colors;
      ctx.fillStyle = col.sea;
      ctx.fillRect(-20, -20, this.cssW + 40, this.cssH + 40);
      // köşelere doğru biraz daha derin
      const g = ctx.createRadialGradient(this.cssW / 2, this.cssH / 2, Math.min(this.cssW, this.cssH) * 0.3,
        this.cssW / 2, this.cssH / 2, Math.max(this.cssW, this.cssH) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, col['sea-deep']);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.cssW, this.cssH);

      const s = Math.max(26, c * 1.15);
      ctx.strokeStyle = col['sea-light'];
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, c * 0.045);
      const cols = Math.ceil(this.cssW / s) + 1;
      const rows = Math.ceil(this.cssH / (s * 0.7)) + 1;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const h = hash(gx + 11, gy + 7);
          if (h % 3) continue;
          const px = gx * s + (gy % 2) * s * 0.5 + ((h >> 4) % 40) / 100 * s + Math.sin(t / 1700 + h) * c * 0.08;
          const py = gy * s * 0.7 + ((h >> 9) % 30) / 100 * s;
          const L = s * 0.16;
          const A = s * 0.07;
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t / 900 + (h % 13));
          ctx.beginPath();
          ctx.moveTo(px - L, py);
          ctx.quadraticCurveTo(px - L / 2, py - A, px, py);
          ctx.quadraticCurveTo(px + L / 2, py + A, px + L, py);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    /** Ada: sığ su halkası, köpük, toprak yamaç ve çimen karolar. */
    _drawIsland(t) {
      const ctx = this.ctx;
      const w = this.world;
      const c = this.cell;
      const col = this.colors;
      const land = (x, y) => this._isLand(x, y);
      const cliff = CLIFF * c;

      // sığ su ve köpük halkaları
      const rings = [
        { e: c * 0.26, color: col['sea-shallow'], alpha: 0.75 },
        { e: c * (0.1 + 0.025 * Math.sin(t / 650)), color: col.foam, alpha: 0.85 }
      ];
      for (const ring of rings) {
        // tek bir yol: üst üste binen karolar ek yeri bırakmasın
        ctx.fillStyle = ring.color;
        ctx.globalAlpha = ring.alpha;
        ctx.beginPath();
        const R = c * 0.24 + ring.e;
        for (let y = 0; y < w.height; y++) {
          for (let x = 0; x < w.width; x++) {
            if (!land(x, y)) continue;
            const up = land(x, y - 1), dn = land(x, y + 1), lf = land(x - 1, y), rt = land(x + 1, y);
            const bottom = dn ? 0 : cliff;
            const r = [(!up && !lf) ? R : 0, (!up && !rt) ? R : 0, (!dn && !rt) ? R : 0, (!dn && !lf) ? R : 0];
            this._cornerPath(x * c - ring.e, y * c - ring.e, c + ring.e * 2, c + bottom + ring.e * 2, r);
          }
        }
        ctx.fill('nonzero');
      }
      ctx.globalAlpha = 1;

      // toprak yamaç (altı deniz olan karoların ön yüzü)
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (!land(x, y) || land(x, y + 1)) continue;
          const rl = land(x - 1, y) ? 0 : c * 0.2;
          const rr = land(x + 1, y) ? 0 : c * 0.2;
          ctx.fillStyle = col['dirt-dark'];
          cornerRect(ctx, x * c, y * c + c * 0.5, c, c * 0.5 + cliff, [0, 0, rr, rl]);
          ctx.fill();
          ctx.fillStyle = col.dirt;
          cornerRect(ctx, x * c, y * c + c * 0.5, c, c * 0.5 + cliff * 0.62, [0, 0, rr * 0.8, rl * 0.8]);
          ctx.fill();
          // taşlar
          const h = hash(x, y);
          ctx.fillStyle = 'rgba(0,0,0,.12)';
          ctx.beginPath();
          ctx.ellipse(x * c + c * (0.25 + (h % 50) / 100), y * c + c + cliff * 0.55, c * 0.06, c * 0.035, 0, 0, TAU);
          ctx.fill();
        }
      }

      // çimen karolar
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (!land(x, y)) continue;
          const R = c * 0.24;
          const up = land(x, y - 1), dn = land(x, y + 1), lf = land(x - 1, y), rt = land(x + 1, y);
          const r = [(!up && !lf) ? R : 0, (!up && !rt) ? R : 0, (!dn && !rt) ? R : 0, (!dn && !lf) ? R : 0];
          ctx.fillStyle = (x + y) % 2 ? col['grass-b'] : col['grass-a'];
          cornerRect(ctx, x * c, y * c, c, c, r);
          ctx.fill();
          // üst kenar parlaklığı, alt kenar gölgesi
          ctx.save();
          cornerRect(ctx, x * c, y * c, c, c, r);
          ctx.clip();
          if (!up) {
            ctx.fillStyle = col['grass-light'];
            ctx.fillRect(x * c, y * c, c, Math.max(2, c * 0.07));
          }
          if (!dn) {
            ctx.fillStyle = 'rgba(0,0,0,.10)';
            ctx.fillRect(x * c, y * c + c - Math.max(2, c * 0.06), c, Math.max(2, c * 0.06));
          }
          // karo çizgileri
          ctx.strokeStyle = 'rgba(0,0,0,.07)';
          ctx.lineWidth = 1;
          if (rt) { ctx.beginPath(); ctx.moveTo(x * c + c - 0.5, y * c); ctx.lineTo(x * c + c - 0.5, y * c + c); ctx.stroke(); }
          if (dn) { ctx.beginPath(); ctx.moveTo(x * c, y * c + c - 0.5); ctx.lineTo(x * c + c, y * c + c - 0.5); ctx.stroke(); }
          ctx.restore();
          // çimen tutamları
          if (w.cellAt(x, y) === 'G') continue;
          const h = hash(x + 3, y + 5);
          if (h % 3 === 0) {
            ctx.strokeStyle = col['grass-tuft'];
            ctx.lineWidth = Math.max(1.2, c * 0.03);
            ctx.lineCap = 'round';
            const tx = x * c + c * (0.18 + ((h >> 3) % 60) / 100);
            const ty = y * c + c * (0.25 + ((h >> 7) % 55) / 100);
            const L = c * 0.08;
            ctx.beginPath();
            ctx.moveTo(tx - L * 0.6, ty - L); ctx.lineTo(tx - L * 0.2, ty);
            ctx.moveTo(tx, ty - L * 1.25); ctx.lineTo(tx, ty);
            ctx.moveTo(tx + L * 0.6, ty - L); ctx.lineTo(tx + L * 0.2, ty);
            ctx.stroke();
          } else if (h % 7 === 1) {
            // minik çiçek
            const fx = x * c + c * (0.2 + ((h >> 5) % 60) / 100);
            const fy = y * c + c * (0.2 + ((h >> 11) % 60) / 100);
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * TAU;
              ctx.beginPath();
              ctx.arc(fx + Math.cos(a) * c * 0.03, fy + Math.sin(a) * c * 0.03, c * 0.026, 0, TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(fx, fy, c * 0.022, 0, TAU);
            ctx.fill();
          }
        }
      }
    }

    _drawGoalPad(x, y, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const cx = (x + 0.5) * c;
      const cy = (y + 0.5) * c;
      const pulse = 0.5 + 0.5 * Math.sin(t / 380);
      const g = ctx.createRadialGradient(cx, cy, c * 0.1, cx, cy, c * (0.7 + pulse * 0.12));
      g.addColorStop(0, this.colors['goal-glow']);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
      // altın halka
      ctx.strokeStyle = this.colors.goal;
      ctx.lineWidth = Math.max(2, c * 0.06);
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.12, c * 0.32, c * 0.2, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = (1 - pulse) * 0.9;
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.12, c * (0.32 + pulse * 0.12), c * (0.2 + pulse * 0.08), 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    _drawFlag(x, y, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const px = (x + 0.5) * c;
      const base = (y + 0.5) * c + c * 0.12;
      const top = base - c * 0.9;
      // gölge
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath();
      ctx.ellipse(px + c * 0.04, base, c * 0.1, c * 0.04, 0, 0, TAU);
      ctx.fill();
      // direk
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, c * 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, base);
      ctx.lineTo(px, top);
      ctx.stroke();
      ctx.fillStyle = this.colors.goal;
      ctx.beginPath();
      ctx.arc(px, top, c * 0.05, 0, TAU);
      ctx.fill();
      // dalgalanan bayrak
      const fw = c * 0.42;
      const fh = c * 0.28;
      const wave = (k) => Math.sin(t / 220 + k * 2.6) * c * 0.035 * k;
      ctx.fillStyle = this.colors.flag;
      ctx.beginPath();
      ctx.moveTo(px, top + c * 0.04);
      ctx.quadraticCurveTo(px + fw * 0.5, top + c * 0.04 + wave(0.5) - c * 0.03, px + fw, top + c * 0.04 + wave(1));
      ctx.lineTo(px + fw, top + c * 0.04 + fh + wave(1));
      ctx.quadraticCurveTo(px + fw * 0.5, top + c * 0.04 + fh + wave(0.5) - c * 0.03, px, top + c * 0.04 + fh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colors['flag-dark'];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(px, top + c * 0.04 + fh * 0.62);
      ctx.quadraticCurveTo(px + fw * 0.5, top + c * 0.04 + fh * 0.62 + wave(0.5) - c * 0.03, px + fw, top + c * 0.04 + fh * 0.62 + wave(1));
      ctx.lineTo(px + fw, top + c * 0.04 + fh + wave(1));
      ctx.quadraticCurveTo(px + fw * 0.5, top + c * 0.04 + fh + wave(0.5) - c * 0.03, px, top + c * 0.04 + fh);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // bayraktaki yıldız
      ctx.fillStyle = '#ffffff';
      star4(ctx, px + fw * 0.45, top + c * 0.04 + fh * 0.5 + wave(0.45) - c * 0.015, c * 0.07);
      ctx.fill();
    }

    _drawGem(x, y, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const phase = (x * 7 + y * 13) % 10;
      const bob = Math.sin(t / 420 + phase) * c * 0.05;
      const cx = (x + 0.5) * c;
      const cy = (y + 0.5) * c - c * 0.04;
      // gölge
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.3, c * (0.18 - bob / c), c * 0.06, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy + bob);
      const s = c * 1.1;
      ctx.fillStyle = this.colors.gem;
      ctx.beginPath();
      ctx.moveTo(-0.24 * s, -0.04 * s);
      ctx.lineTo(0.24 * s, -0.04 * s);
      ctx.lineTo(0, 0.26 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colors['gem-dark'];
      ctx.beginPath();
      ctx.moveTo(0.08 * s, -0.04 * s);
      ctx.lineTo(0.24 * s, -0.04 * s);
      ctx.lineTo(0, 0.26 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colors['gem-light'];
      ctx.beginPath();
      ctx.moveTo(-0.24 * s, -0.04 * s);
      ctx.lineTo(-0.13 * s, -0.17 * s);
      ctx.lineTo(0.13 * s, -0.17 * s);
      ctx.lineTo(0.24 * s, -0.04 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colors.gem;
      ctx.beginPath();
      ctx.moveTo(-0.08 * s, -0.04 * s);
      ctx.lineTo(-0.03 * s, -0.17 * s);
      ctx.lineTo(0.03 * s, -0.17 * s);
      ctx.lineTo(0.08 * s, -0.04 * s);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      const tw = Math.sin(t / 260 + phase * 1.7);
      if (tw > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = tw;
        star4(ctx, cx + c * 0.19, cy + bob - c * 0.19, c * 0.09 * tw);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const tw2 = Math.sin(t / 330 + phase * 2.3 + 2);
      if (tw2 > 0.3) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = tw2 * 0.8;
        star4(ctx, cx - c * 0.22, cy + bob + c * 0.06, c * 0.055 * tw2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    _drawPop(e, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const p = clamp01((t - e.start) / e.dur);
      const cx = (e.x + 0.5) * c;
      const cy = (e.y + 0.5) * c;
      ctx.strokeStyle = this.colors.gem;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = Math.max(1, c * 0.07 * (1 - p));
      ctx.beginPath();
      ctx.arc(cx, cy, c * (0.15 + easeOut(p) * 0.5), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = this.colors.gem;
      ctx.font = '800 ' + Math.round(c * 0.36) + 'px "Baloo 2", Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, c * 0.06);
      ctx.strokeStyle = '#ffffff';
      const ty = cy - c * 0.2 - easeOut(p) * c * 0.5;
      ctx.strokeText('+1', cx, ty);
      ctx.fillText('+1', cx, ty);
      ctx.globalAlpha = 1;
    }

    _drawSplash(e, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const p = clamp01((t - e.start) / e.dur);
      const cx = (e.x + 0.5) * c;
      const cy = (e.y + 0.5) * c;
      ctx.strokeStyle = this.colors.foam;
      for (let i = 0; i < 2; i++) {
        const q = clamp01(p * 1.2 - i * 0.2);
        if (q <= 0) continue;
        ctx.globalAlpha = (1 - q) * 0.9;
        ctx.lineWidth = Math.max(1.5, c * 0.06 * (1 - q));
        ctx.beginPath();
        ctx.ellipse(cx, cy, c * (0.12 + easeOut(q) * 0.45), c * (0.06 + easeOut(q) * 0.22), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    _drawQuestion(e, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const p = clamp01((t - e.start) / e.dur);
      const cx = (this.robot.x + 0.5) * c;
      const cy = (this.robot.y + 0.5) * c - c * 0.62 - easeOut(Math.min(1, p * 3)) * c * 0.1;
      ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, c * 0.22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = this.colors.ink;
      ctx.font = '800 ' + Math.round(c * 0.32) + 'px "Baloo 2", Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy + c * 0.02);
      ctx.globalAlpha = 1;
    }

    _drawRobot(t) {
      const ctx = this.ctx;
      const c = this.cell;
      const r = this.robot;
      const cx = (r.x + 0.5) * c;
      let cy = (r.y + 0.5) * c;
      let lift = r.hop * c * 0.12;
      if (this.mood === 'happy' && !this.reduced) lift += Math.abs(Math.sin(t / 160)) * c * 0.1;
      const idle = this.tween || this.reduced ? 0 : Math.sin(t / 500) * c * 0.012;

      // gölge
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.3, c * (0.3 - lift / c * 0.6), c * 0.08, 0, 0, TAU);
      ctx.fill();

      cy -= lift + idle + c * 0.03;
      ctx.save();
      ctx.translate(cx, cy);
      if (r.tilt) ctx.rotate(r.tilt);
      if (this.mood === 'crash' && !this.tween && !this.reduced) ctx.rotate(Math.sin(t / 90) * 0.04);
      ctx.rotate(r.angle);
      const s = c;

      // paletler (yanlarda)
      ctx.fillStyle = this.colors['robot-face'];
      roundRect(ctx, -0.26 * s, -0.37 * s, 0.52 * s, 0.13 * s, 0.06 * s);
      ctx.fill();
      roundRect(ctx, -0.26 * s, 0.24 * s, 0.52 * s, 0.13 * s, 0.06 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      const roll = ((r.x + r.y) * 4) % 1;
      for (let i = 0; i < 5; i++) {
        const tx = (-0.22 + ((i * 0.1 + roll * 0.1) % 0.5)) * s;
        ctx.fillRect(tx, -0.35 * s, 0.03 * s, 0.09 * s);
        ctx.fillRect(tx, 0.26 * s, 0.03 * s, 0.09 * s);
      }

      // gövde
      ctx.fillStyle = this.colors['robot-dark'];
      roundRect(ctx, -0.3 * s, -0.28 * s, 0.6 * s, 0.6 * s, 0.17 * s);
      ctx.fill();
      ctx.fillStyle = this.colors.robot;
      roundRect(ctx, -0.3 * s, -0.31 * s, 0.6 * s, 0.58 * s, 0.17 * s);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      roundRect(ctx, -0.24 * s, -0.27 * s, 0.22 * s, 0.1 * s, 0.05 * s);
      ctx.fill();

      // yüz paneli (önde)
      ctx.fillStyle = this.colors['robot-face'];
      roundRect(ctx, 0.02 * s, -0.21 * s, 0.24 * s, 0.4 * s, 0.09 * s);
      ctx.fill();

      // gözler
      const ex = 0.15 * s;
      const ey = 0.1 * s;
      const er = 0.055 * s;
      ctx.lineCap = 'round';
      if (this.mood === 'crash') {
        ctx.strokeStyle = this.colors.crash;
        ctx.lineWidth = Math.max(1.5, s * 0.03);
        for (const sy of [-ey, ey]) {
          ctx.beginPath();
          ctx.moveTo(ex - er, sy - er); ctx.lineTo(ex + er, sy + er);
          ctx.moveTo(ex + er, sy - er); ctx.lineTo(ex - er, sy + er);
          ctx.stroke();
        }
      } else if (this.mood === 'happy') {
        ctx.strokeStyle = this.colors['robot-eye'];
        ctx.lineWidth = Math.max(1.5, s * 0.035);
        for (const sy of [-ey, ey]) {
          ctx.beginPath();
          ctx.arc(ex + er * 0.4, sy - 0.01 * s, er, Math.PI * 0.6, Math.PI * 1.4);
          ctx.stroke();
        }
      } else {
        const blink = (t % 3600) < 120 ? 0.25 : 1;
        ctx.fillStyle = this.colors['robot-eye'];
        ctx.shadowColor = this.colors['robot-eye'];
        ctx.shadowBlur = s * 0.12;
        for (const sy of [-ey, ey]) {
          ctx.beginPath();
          ctx.ellipse(ex, sy, er * blink, er, 0, 0, TAU);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        for (const sy of [-ey, ey]) {
          ctx.beginPath();
          ctx.arc(ex + er * 0.35, sy - er * 0.35, er * 0.3 * blink, 0, TAU);
          ctx.fill();
        }
      }

      // burun / yön oku
      ctx.fillStyle = this.colors['robot-dark'];
      ctx.beginPath();
      ctx.moveTo(0.33 * s, -0.07 * s);
      ctx.lineTo(0.44 * s, 0);
      ctx.lineTo(0.33 * s, 0.07 * s);
      ctx.closePath();
      ctx.fill();

      // anten
      ctx.strokeStyle = this.colors['robot-face'];
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(-0.14 * s, 0);
      ctx.lineTo(-0.2 * s, -0.04 * s);
      ctx.stroke();
      const glow = 0.5 + 0.5 * Math.sin(t / 250);
      ctx.fillStyle = this.mood === 'crash' ? this.colors.crash : this.colors.gem;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = s * 0.15 * glow;
      ctx.beginPath();
      ctx.arc(-0.2 * s, -0.04 * s, 0.05 * s, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // sersemleme yıldızları
      if (this.mood === 'crash' && !this.tween) {
        ctx.fillStyle = this.colors.goal;
        for (let i = 0; i < 3; i++) {
          const a = (this.reduced ? 0 : t / 300) + (i * TAU) / 3;
          star4(ctx, cx + Math.cos(a) * c * 0.3, cy - c * 0.36 + Math.sin(a) * c * 0.08, c * 0.07);
          ctx.fill();
        }
      }
    }
  }

  CodeGame.Renderer = Renderer;
  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
