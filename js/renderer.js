/* KodRobot — Canvas renderer (CodeGame.Renderer)
 * Bir World nesnesini canvas üzerine çizer; eylemler arasında yumuşak
 * geçişler, çarpma sarsıntısı, elmas patlaması ve kazanma konfetisi yapar.
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  const TAU = Math.PI * 2;
  const DIR_ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  const DIR_VEC = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const DEPTH = 0.24; // duvar yüksekliği (hücre oranı)

  const COLOR_VARS = [
    'floor-a', 'floor-b', 'floor-line', 'wall-top', 'wall-side', 'wall-edge',
    'goal', 'goal-glow', 'gem', 'gem-dark', 'gem-light', 'robot', 'robot-dark',
    'robot-face', 'robot-eye', 'crash', 'confetti-1', 'confetti-2', 'confetti-3',
    'confetti-4', 'confetti-5', 'ink'
  ];
  const FALLBACK = {
    'floor-a': '#f3ecff', 'floor-b': '#ebe1fb', 'floor-line': '#ddd0f5',
    'wall-top': '#8f82e0', 'wall-side': '#5e51b0', 'wall-edge': '#b3a9f0',
    'goal': '#ffc23d', 'goal-glow': 'rgba(255,194,61,.55)', 'gem': '#20c4f4',
    'gem-dark': '#0f86c9', 'gem-light': '#c8f4ff', 'robot': '#ff8a3d',
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
      this.dpr = 1;
      this.cssW = 0;
      this.cssH = 0;
      this.time = 0;
      this.last = now();

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
      this.snap();
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
      this.robot = { x: w.robot.x, y: w.robot.y, angle: DIR_ANGLE[w.robot.dir] || 0, hop: 0 };
      this.displayGems = new Set(w.gems);
      this.mood = w.crashed ? 'crash' : 'normal';
    }

    resize() {
      const w = this.world;
      const box = this.container;
      if (!w || !box) return;
      const ratio = w.width + ' / ' + (w.height + DEPTH);
      box.style.setProperty('--board-ratio', ratio);
      const availW = Math.max(60, box.clientWidth - 8);
      const availH = Math.max(60, box.clientHeight - 8);
      let cell = Math.floor(Math.min(availW / w.width, availH / (w.height + DEPTH)));
      cell = Math.max(10, Math.min(cell, 84));
      const cssW = cell * w.width;
      const cssH = Math.round(cell * (w.height + DEPTH));
      const dpr = Math.min(root.devicePixelRatio || 1, 3);
      if (cell === this.cell && cssW === this.cssW && cssH === this.cssH && dpr === this.dpr) return;
      this.cell = cell;
      this.cssW = cssW;
      this.cssH = cssH;
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

    /** Çarpma: ileri sekme, sarsıntı ve kıvılcım. */
    crash(world, duration) {
      if (world) this.world = world;
      if (this.tween) this._finishTween();
      duration = Math.max(200, (duration || 300) * 1.6);
      const w = this.world;
      const v = DIR_VEC[w.robot.dir] || [1, 0];
      const from = { x: this.robot.x, y: this.robot.y, angle: this.robot.angle };
      this.mood = 'crash';
      return new Promise((resolve) => {
        this.tween = { from, to: from, start: now(), dur: duration, kind: 'crash', v, resolve, hit: false };
      });
    }

    /** Kazanma kutlaması: konfeti + mutlu robot. */
    celebrate() {
      this.mood = 'happy';
      const cols = ['confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5'];
      const W = this.cssW || 300;
      for (let i = 0; i < 160; i++) {
        this.particles.push({
          type: 'confetti',
          x: Math.random() * W,
          y: -20 - Math.random() * (this.cssH * 0.6),
          vx: (Math.random() - 0.5) * 80,
          vy: 40 + Math.random() * 120,
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
          w: 5 + Math.random() * 6,
          h: 3 + Math.random() * 4,
          color: this.colors[cols[i % cols.length]],
          wob: Math.random() * TAU,
          life: 4 + Math.random() * 2
        });
      }
      // robotun etrafında küçük yıldız patlaması
      const c = this.cell;
      const cx = (this.robot.x + 0.5) * c;
      const cy = (this.robot.y + 0.5 + DEPTH) * c;
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

    _finishTween() {
      const t = this.tween;
      if (!t) return;
      this.tween = null;
      this.robot.x = t.to.x;
      this.robot.y = t.to.y;
      this.robot.angle = t.to.angle;
      this.robot.hop = 0;
      t.resolve();
    }

    _gemPop(gx, gy) {
      this.effects.push({ type: 'pop', x: gx, y: gy, start: now(), dur: 650 });
      const c = this.cell;
      const cx = (gx + 0.5) * c;
      const cy = (gy + 0.5 + DEPTH) * c;
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

    _crashSparks() {
      const c = this.cell;
      const v = (this.tween && this.tween.v) || [1, 0];
      const cx = (this.robot.x + 0.5 + v[0] * 0.5) * c;
      const cy = (this.robot.y + 0.5 + DEPTH + v[1] * 0.5) * c;
      for (let i = 0; i < 16; i++) {
        const a = Math.atan2(-v[1], -v[0]) + (Math.random() - 0.5) * 2.4;
        const sp = 80 + Math.random() * 160;
        this.particles.push({
          type: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.45, max: 0.45, size: 2 + Math.random() * 2.5,
          color: i % 2 ? this.colors.goal : this.colors.crash
        });
      }
    }

    _update(dt, t) {
      this.time += dt;
      const tw = this.tween;
      if (tw) {
        const p = clamp01((t - tw.start) / tw.dur);
        if (tw.kind === 'crash') {
          // 0..0.35 ileri, 0.35..1 geri sek
          let off;
          if (p < 0.35) off = easeOut(p / 0.35) * 0.3;
          else off = 0.3 * (1 - easeOut((p - 0.35) / 0.65));
          if (p >= 0.35 && !tw.hit) {
            tw.hit = true;
            this.shake = 1;
            this.flash = 1;
            this._crashSparks();
          }
          this.robot.x = tw.from.x + tw.v[0] * off;
          this.robot.y = tw.from.y + tw.v[1] * off;
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
          pt.vy += (pt.type === 'shard' ? 380 : 120) * dt;
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

    _draw(t) {
      const ctx = this.ctx;
      const w = this.world;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      if (!w) return;
      const c = this.cell;
      const col = this.colors;

      ctx.save();
      if (this.shake > 0) {
        const s = this.shake * this.shake * c * 0.12;
        ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
      }
      ctx.translate(0, DEPTH * c);

      // zemin
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (w.cellAt(x, y) === '#') continue;
          ctx.fillStyle = (x + y) % 2 ? col['floor-b'] : col['floor-a'];
          ctx.fillRect(x * c, y * c, c, c);
          ctx.strokeStyle = col['floor-line'];
          ctx.lineWidth = 1;
          ctx.strokeRect(x * c + 0.5, y * c + 0.5, c - 1, c - 1);
        }
      }

      // hedef
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (w.cellAt(x, y) === 'G') this._drawGoal(x, y, t);
        }
      }

      // satır satır: duvarlar, elmaslar, robot (derinlik sırası)
      const robotRow = Math.round(this.robot.y);
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          if (w.cellAt(x, y) === '#') this._drawWall(x, y);
        }
        for (const key of this.displayGems) {
          const p = key.split(',');
          if (+p[1] === y) this._drawGem(+p[0], y, t);
        }
        if (robotRow === y) this._drawRobot(t);
      }
      if (robotRow < 0 || robotRow >= w.height) this._drawRobot(t);

      // efektler
      for (const e of this.effects) {
        if (e.type === 'pop') this._drawPop(e, t);
      }
      ctx.restore();

      // parçacıklar (sarsıntıdan bağımsız)
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
          ctx.translate(p.x, p.y + DEPTH * 0);
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
        ctx.globalAlpha = this.flash * 0.22;
        ctx.fillStyle = col.crash;
        ctx.fillRect(0, 0, this.cssW, this.cssH);
        ctx.globalAlpha = 1;
      }
    }

    _drawWall(x, y) {
      const ctx = this.ctx;
      const c = this.cell;
      const d = DEPTH * c;
      const px = x * c;
      const py = y * c;
      const w = this.world;
      const below = w.cellAt(x, y + 1) === '#';
      // ön yüz (yalnızca altı boşsa görünür)
      if (!below) {
        ctx.fillStyle = this.colors['wall-side'];
        roundRect(ctx, px, py + c - d - 2, c, d + 2, c * 0.08);
        ctx.fill();
        // tuğla çizgileri
        ctx.strokeStyle = 'rgba(0,0,0,.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + c * 0.5, py + c - d);
        ctx.lineTo(px + c * 0.5, py + c);
        ctx.stroke();
      }
      // üst yüz
      ctx.fillStyle = this.colors['wall-top'];
      ctx.fillRect(px, py - d, c, c);
      // kenar parlaklıkları: komşu duvar yoksa çiz
      ctx.fillStyle = this.colors['wall-edge'];
      const e = Math.max(1.5, c * 0.05);
      if (w.cellAt(x, y - 1) !== '#') ctx.fillRect(px, py - d, c, e);
      if (w.cellAt(x - 1, y) !== '#') ctx.fillRect(px, py - d, e, c);
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      if (w.cellAt(x + 1, y) !== '#') ctx.fillRect(px + c - e, py - d, e, c);
      // blok derzleri
      ctx.strokeStyle = 'rgba(0,0,0,.09)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py - d + 0.5, c - 1, c - 1);
      // küçük doku noktaları (hücreye göre değişen)
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath();
      const n = 1 + (h % 3);
      for (let i = 0; i < n; i++) {
        const hx = ((h >> (i * 5)) % 60) / 100 + 0.2;
        const hy = ((h >> (i * 5 + 3)) % 60) / 100 + 0.2;
        const rr = c * (0.03 + ((h >> (i * 2)) % 3) * 0.015);
        ctx.moveTo(px + c * hx + rr, py - d + c * hy);
        ctx.arc(px + c * hx, py - d + c * hy, rr, 0, TAU);
      }
      ctx.fill();
    }

    _drawGoal(x, y, t) {
      const ctx = this.ctx;
      const c = this.cell;
      const cx = (x + 0.5) * c;
      const cy = (y + 0.5) * c;
      const pulse = 0.5 + 0.5 * Math.sin(t / 380);
      // parıltı
      const g = ctx.createRadialGradient(cx, cy, c * 0.1, cx, cy, c * (0.75 + pulse * 0.15));
      g.addColorStop(0, this.colors['goal-glow']);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
      // taban
      ctx.fillStyle = this.colors.goal;
      ctx.globalAlpha = 0.35 + pulse * 0.15;
      roundRect(ctx, x * c + c * 0.08, y * c + c * 0.08, c * 0.84, c * 0.84, c * 0.18);
      ctx.fill();
      ctx.globalAlpha = 1;
      // halkalar
      ctx.strokeStyle = this.colors.goal;
      ctx.lineWidth = Math.max(2, c * 0.06);
      ctx.beginPath();
      ctx.arc(cx, cy, c * 0.3, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, c * (0.3 + pulse * 0.16), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // yıldız
      ctx.fillStyle = this.colors.goal;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? c * 0.08 : c * 0.18;
        const a = -Math.PI / 2 + (i * Math.PI) / 5 + t / 2000;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
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
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.3, c * (0.18 - bob / c), c * 0.06, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy + bob);
      const s = c;
      // alt (pavilion)
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
      // üst (crown)
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

      // pırıltı
      const tw = Math.sin(t / 260 + phase * 1.7);
      if (tw > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = tw;
        star4(ctx, cx + c * 0.17, cy + bob - c * 0.17, c * 0.09 * tw);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const tw2 = Math.sin(t / 330 + phase * 2.3 + 2);
      if (tw2 > 0.3) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = tw2 * 0.8;
        star4(ctx, cx - c * 0.2, cy + bob + c * 0.06, c * 0.055 * tw2);
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
      // genişleyen halka
      ctx.strokeStyle = this.colors.gem;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = Math.max(1, c * 0.07 * (1 - p));
      ctx.beginPath();
      ctx.arc(cx, cy, c * (0.15 + easeOut(p) * 0.5), 0, TAU);
      ctx.stroke();
      // yukarı süzülen +1
      ctx.fillStyle = this.colors.gem;
      ctx.font = '800 ' + Math.round(c * 0.34) + 'px "Baloo 2", Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+1', cx, cy - c * 0.2 - easeOut(p) * c * 0.5);
      ctx.globalAlpha = 1;
    }

    _drawRobot(t) {
      const ctx = this.ctx;
      const c = this.cell;
      const r = this.robot;
      const cx = (r.x + 0.5) * c;
      let cy = (r.y + 0.5) * c;
      let lift = r.hop * c * 0.12;
      if (this.mood === 'happy') lift += Math.abs(Math.sin(t / 160)) * c * 0.1;
      const idle = this.tween ? 0 : Math.sin(t / 500) * c * 0.012;

      // gölge
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + c * 0.3, c * (0.3 - lift / c * 0.6), c * 0.08, 0, 0, TAU);
      ctx.fill();

      cy -= lift + idle + c * 0.03;
      ctx.save();
      ctx.translate(cx, cy);
      if (this.mood === 'crash' && !this.tween) ctx.rotate(Math.sin(t / 90) * 0.04);
      ctx.rotate(r.angle);
      const s = c;

      // paletler (yanlarda)
      ctx.fillStyle = this.colors['robot-face'];
      roundRect(ctx, -0.26 * s, -0.37 * s, 0.52 * s, 0.13 * s, 0.06 * s);
      ctx.fill();
      roundRect(ctx, -0.26 * s, 0.24 * s, 0.52 * s, 0.13 * s, 0.06 * s);
      ctx.fill();
      // palet dişleri
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
      // parlama
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
      ctx.moveTo(0.33 * s, -0.06 * s);
      ctx.lineTo(0.42 * s, 0);
      ctx.lineTo(0.33 * s, 0.06 * s);
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
          const a = t / 300 + (i * TAU) / 3;
          star4(ctx, cx + Math.cos(a) * c * 0.3, cy - c * 0.36 + Math.sin(a) * c * 0.08, c * 0.07);
          ctx.fill();
        }
      }
    }
  }

  CodeGame.Renderer = Renderer;
  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
