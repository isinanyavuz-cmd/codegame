/*
 * Ryu'nun Kod Macerası — canvas çizici (CodeGame.Ryu.Renderer).
 * Yandan görünüşlü, karolu bir dünya çizer: gökyüzü ve paralaks arka plan,
 * çimenli toprak, soru kutuları, kasalar, altınlar, bayrak direği, düşmanlar
 * ve iskeletle canlandırılan Ryu. World.act() olaylarını oynatır.
 *
 * Genel API:
 *   new CodeGame.Ryu.Renderer(canvas, { container })
 *   setWorld(world), snap(), resize(), celebrate()
 *   play(event, ms) -> Promise      (bir hareket olayını oynatır)
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  const Ryu = CodeGame.Ryu = CodeGame.Ryu || {};

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const VIEW_ROWS = 8;        // en az bu kadar satır görünür
  const BELOW = 0.6;          // haritanın altında görünen toprak (hücre)
  const ARCADE = "'Press Start 2P', 'Baloo 2', monospace";
  const SOLID = '#=B?u';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (t) => clamp(t, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const now = () => (root.performance && performance.now ? performance.now() : Date.now());
  const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : (fn) => setTimeout(() => fn(now()), 16);
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------------- temalar ----------------
  const THEMES = {
    day: {
      sky: ['#5fc4ff', '#bdeaff'], sun: '#fff6c8', far: '#8fb4e8', farSnow: '#f4f8ff', mid: '#5cc472', midDark: '#45a85c',
      near: '#3f9a4f', cloud: '#ffffff', grass: '#5ccf3f', grassDark: '#3fa82d', grassLight: '#9cf06a',
      dirt: '#c9773a', dirtDark: '#9a5426', dirtLight: '#e09356', stars: false
    },
    evening: {
      sky: ['#1b2b5e', '#4f5fa8'], sun: '#fdf3c4', far: '#3a4a86', farSnow: '#c8d2f2', mid: '#2f6b55', midDark: '#255645',
      near: '#21503f', cloud: '#7d8cc4', grass: '#46a83a', grassDark: '#2f7f28', grassLight: '#76cc5c',
      dirt: '#99592c', dirtDark: '#6c3a1a', dirtLight: '#b36d3d', stars: true, moon: true
    },
    sunset: {
      sky: ['#ff8a5c', '#ffd27a'], sun: '#fff1a8', far: '#b0608a', farSnow: '#ffd9e6', mid: '#8a4a78', midDark: '#723c64',
      near: '#5a2f55', cloud: '#ffc3a0', grass: '#64c43c', grassDark: '#3f962a', grassLight: '#a0ea6c',
      dirt: '#c26b35', dirtDark: '#8e4622', dirtLight: '#dd8a50', stars: false, pagoda: true
    },
    night: {
      sky: ['#0b1433', '#243a78'], sun: '#fff8d8', far: '#22346a', farSnow: '#9fb2e6', mid: '#1c3a52', midDark: '#152c3f',
      near: '#122634', cloud: '#3c4f86', grass: '#3d9a46', grassDark: '#2a7232', grassLight: '#62c066',
      dirt: '#7e4a2a', dirtDark: '#57301a', dirtLight: '#965c36', stars: true, moon: true
    },
    cave: {
      sky: ['#2a2238', '#433654'], sun: null, far: '#3a2f4a', farSnow: '#4a3d5c', mid: '#30263d', midDark: '#271f33',
      near: '#221b2c', cloud: null, grass: '#7a6a8e', grassDark: '#5b4d6e', grassLight: '#9a8aae',
      dirt: '#5e4e70', dirtDark: '#43365a', dirtLight: '#76668a', stars: false, cave: true
    },
    castle: {
      sky: ['#3d2a5e', '#e07a5f'], sun: '#ffd27a', far: '#5c3d6e', farSnow: '#e9c8e0', mid: '#3e2a4c', midDark: '#2f1f3b',
      near: '#2a1b33', cloud: '#c0748a', grass: '#a3a0aa', grassDark: '#7e7a88', grassLight: '#c9c6d0',
      dirt: '#8a8494', dirtDark: '#625d6c', dirtLight: '#a8a2b2', stars: true, castle: true
    }
  };

  const C = {
    ink: '#1d1626', gi: '#f6f3ec', giShade: '#cbc3b4', belt: '#25212c', skin: '#f5bf8e', skinShade: '#d8905e',
    hair: '#3b2416', hairLight: '#5c3a24', band: '#e3262f', bandDark: '#a3141f', glove: '#cc2630', gloveDark: '#8e1820',
    coin: '#ffcf2e', coinDark: '#e09a00', coinLight: '#fff2a6', qBlock: '#ffb627', qDark: '#c9780a', qLight: '#ffe08a',
    used: '#a9734a', usedDark: '#7a4f2e', crate: '#d99a52', crateDark: '#9c6430', crateLight: '#f2bd78',
    stone: '#a8adbd', stoneDark: '#71768a', stoneLight: '#d4d8e4', spike: '#dfe5ee', spikeDark: '#8a93a6',
    pole: '#d9dde6', poleDark: '#8d93a3', flag: '#e3262f', flagDark: '#a3141f', fire: '#5fd8ff', fireCore: '#ffffff', fireDark: '#2a7bff',
    flame: '#ffb42a', flameHot: '#fff2a0', flameRed: '#ff5a2a', spark: '#fff36a'
  };

  // ---------------- yardımcı çizimler ----------------
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
  function star(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = rot + (i * Math.PI) / n;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  /** Kalın, kenarlı bir uzuv çizgisi. */
  function limb(ctx, pts, w, color, ink) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = ink;
    ctx.lineWidth = w + 1.5;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  function polar(x, y, deg, len) {
    return [x + Math.cos(deg * DEG) * len, y + Math.sin(deg * DEG) * len];
  }
  /** Catmull-Rom eğrisi üzerinde nokta. */
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
  }

  // ---------------- Ryu pozları ----------------
  // Açılar derece: 0 sağ, 90 aşağı. Kol/bacak: [üst, alt (üste göre)].
  const POSES = {
    idle: { lean: 4, armF: [55, -105], armB: [70, -110], legF: [70, 25], legB: [112, -20] },
    walkA: { lean: 6, armF: [55, -100], armB: [75, -105], legF: [55, 40], legB: [118, -10] },
    walkB: { lean: 6, armF: [50, -95], armB: [70, -110], legF: [100, 5], legB: [80, 35] },
    jump: { lean: -4, armF: [-40, -60], armB: [-150, 60], legF: [20, 110], legB: [60, 90] },
    fall: { lean: 0, armF: [-60, -20], armB: [-130, 20], legF: [70, 40], legB: [105, 15] },
    punch: { lean: 14, armF: [0, 0], armB: [110, -150], legF: [55, 35], legB: [125, -5] },
    punchWind: { lean: -6, armF: [80, -150], armB: [100, -140], legF: [65, 30], legB: [115, -15] },
    hadoWind: { lean: -10, armF: [150, -60], armB: [145, -60], legF: [55, 40], legB: [120, -10] },
    hadoken: { lean: 16, armF: [-4, 4], armB: [8, -6], legF: [50, 40], legB: [128, -5] },
    shoWind: { lean: 18, armF: [95, -140], armB: [80, -100], legF: [50, 60], legB: [120, -20] },
    shoryuken: { lean: -10, armF: [-82, -6], armB: [100, -120], legF: [30, 100], legB: [96, 0] },
    tatsu: { lean: 0, armF: [-20, -40], armB: [190, 40], legF: [-2, 2], legB: [70, 110] },
    hurt: { lean: -22, armF: [-120, 40], armB: [-60, -30], legF: [60, 30], legB: [110, 10] },
    ko: { lean: -80, armF: [-160, 20], armB: [-110, 10], legF: [10, 10], legB: [20, 10] },
    win: { lean: 0, armF: [-95, -5], armB: [120, -150], legF: [78, 10], legB: [104, -8] },
    grab: { lean: 0, armF: [-70, -10], armB: [-60, -30], legF: [60, 40], legB: [100, 20] },
    bump: { lean: -14, armF: [40, -100], armB: [60, -110], legF: [75, 20], legB: [110, -10] }
  };
  function mixPose(a, b, t) {
    const m = (x, y) => [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
    return { lean: lerp(a.lean, b.lean, t), armF: m(a.armF, b.armF), armB: m(a.armB, b.armB), legF: m(a.legF, b.legF), legB: m(a.legB, b.legB) };
  }

  class Renderer {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.container = opts.container || canvas.parentElement;
      this.world = null;
      this.level = null;
      this.tiles = [];
      this.coins = new Set();
      this.enemies = [];
      this.bumps = new Map();      // "x,y" -> zaman (soru kutusu zıplaması)
      this.ryu = { x: 0, y: 0, pose: 'idle', mix: null, spin: 0, flash: 0, charge: 0 };
      this.tween = null;
      this.intro = null;      // açılışta bayraktan Ryu'ya kamera kaydırması
      this.effects = [];
      this.particles = [];
      this.texts = [];
      this.combo = null;
      this.flagRaise = 0;
      this.shake = 0;
      this.cam = { x: 0, y: 0, manual: false };
      this.scale = 3;
      this.dpr = 1;
      this.cssW = 0;
      this.cssH = 0;
      this.time = 0;
      this.last = now();
      this.dark = false;
      this._rm = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;

      this._onResize = () => this.resize();
      if (typeof ResizeObserver !== 'undefined' && this.container) {
        this._ro = new ResizeObserver(this._onResize);
        this._ro.observe(this.container);
      }
      if (root.addEventListener) root.addEventListener('resize', this._onResize);
      if (root.matchMedia) {
        const mq = root.matchMedia('(prefers-color-scheme: dark)');
        const onTheme = () => { this.dark = this._isDark(); };
        if (mq.addEventListener) mq.addEventListener('change', onTheme);
        else if (mq.addListener) mq.addListener(onTheme);
      }
      this.dark = this._isDark();
      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        new MutationObserver(() => { this.dark = this._isDark(); })
          .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }
      this._initPan();
      this._loop = this._loop.bind(this);
      raf(this._loop);
    }

    get reduced() { return !!(this._rm && this._rm.matches); }
    get busy() { return !!this.tween; }

    _isDark() {
      if (typeof document !== 'undefined') {
        const t = document.documentElement.getAttribute('data-theme');
        if (t === 'dark') return true;
        if (t === 'light') return false;
      }
      return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    get theme() {
      let name = (this.level && this.level.theme) || 'day';
      if (name === 'day' && this.dark) name = 'evening';
      return THEMES[name] || THEMES.day;
    }

    // ---------------- dünya ----------------
    /** opts.intro: kamera önce bayrağı gösterip Ryu'ya kayar. */
    setWorld(world, level, opts) {
      this.world = world;
      if (level) this.level = level;
      this._finishTween(true);
      this.tiles = world.grid.map((r) => r.slice());
      this.coins = new Set(world.coins);
      this.enemies = world.enemies.map((e) => ({
        id: e.id, type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, flying: e.flying,
        alive: e.hp > 0, hitT: -9, koT: -9, phase: hash(e.x, e.y) % 100 / 100 * TAU
      }));
      this.bumps.clear();
      this.effects = [];
      this.particles = [];
      this.texts = [];
      this.combo = null;
      this.flagRaise = 0;
      this.ryu = { x: world.ryu.x, y: world.ryu.y, pose: 'idle', mix: null, spin: 0, flash: 0, charge: 0 };
      this.cam.manual = false;
      this.resize();
      this._snapCamera();
      this.intro = null;
      if (opts && opts.intro && !this.reduced && this.pannable) {
        this.cam.x = world.width - this.viewW + 0.5;
        this.intro = { t0: this.time + 0.7 };
      }
    }

    /** Bekleyen animasyonu hemen bitirip görüntüyü dünyaya eşitler. */
    snap() {
      if (!this.world) return;
      this._finishTween(true);
      this.tiles = this.world.grid.map((r) => r.slice());
      this.coins = new Set(this.world.coins);
      for (const e of this.enemies) {
        const w = this.world.enemies[e.id];
        e.hp = w.hp;
        if (w.hp <= 0) e.alive = false;
      }
      this.effects = [];
      this.ryu.x = this.world.ryu.x;
      this.ryu.y = Math.min(this.world.ryu.y, this.world.height);
      this.ryu.pose = this.world.state === 'dead' ? 'ko' : 'idle';
      this.ryu.mix = null;
      this.ryu.spin = 0;
    }

    resize() {
      const box = this.container || this.canvas;
      const r = box.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      const dpr = Math.min(3, root.devicePixelRatio || 1);
      if (w !== this.cssW || h !== this.cssH || dpr !== this.dpr) {
        this.cssW = w;
        this.cssH = h;
        this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
      }
      const rows = Math.max(VIEW_ROWS, this.world ? Math.min(this.world.height + BELOW + 0.8, 12.5) : VIEW_ROWS);
      this.scale = h / (rows * 16);            // css px / sanat pikseli
      this._clampCamera();
    }

    get tile() { return 16 * this.scale; }
    get viewW() { return this.cssW / this.tile; }   // hücre cinsinden
    get viewH() { return this.cssH / this.tile; }

    _camTarget() {
      const w = this.world;
      const vw = this.viewW;
      const vh = this.viewH;
      let x;
      if (w.width <= vw) x = (w.width - vw) / 2;
      else x = clamp(this.ryu.x + 0.5 - vw * 0.38, -0.5, w.width - vw + 0.5);
      const bottom = w.height + BELOW;
      let y;
      if (bottom <= vh) y = bottom - vh;
      else y = clamp(Math.min(this.ryu.y, w.height - 1) + 0.5 - vh * 0.55, -1, bottom - vh);
      return { x, y };
    }
    _snapCamera() {
      if (!this.world) return;
      const t = this._camTarget();
      this.cam.x = t.x;
      this.cam.y = t.y;
    }
    _clampCamera() {
      if (!this.world) return;
      const w = this.world;
      const vw = this.viewW;
      if (w.width <= vw) this.cam.x = (w.width - vw) / 2;
      else this.cam.x = clamp(this.cam.x, -0.5, w.width - vw + 0.5);
    }

    /** Programı çalıştırmadan önce haritayı sürükleyerek gezme. */
    _initPan() {
      const c = this.canvas;
      if (!c.addEventListener) return;
      let drag = null;
      c.addEventListener('pointerdown', (e) => {
        if (!this.world || this.tween || this.world.width <= this.viewW) return;
        drag = { id: e.pointerId, x: e.clientX, cam: this.cam.x };
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = (e.clientX - drag.x) / this.tile;
        if (Math.abs(dx) > 0.05) this.cam.manual = true;
        this.cam.x = drag.cam - dx;
        this._clampCamera();
      });
      const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
    }

    get pannable() { return !!this.world && this.world.width > this.viewW + 0.2; }

    // ---------------- olay oynatma ----------------
    /**
     * Bir World.act() olayını oynatır. ms: bir adımlık temel süre.
     */
    play(ev, ms) {
      if (!this.world) return Promise.resolve();
      this._finishTween(true);
      this.cam.manual = false;
      const unit = Math.max(60, ms || 400);
      const pts = [{ x: ev.from.x, y: ev.from.y }].concat(ev.steps.map((s) => ({ x: s.x, y: s.y, kind: s.kind })));
      const SEG = { walk: 1, jump: 0.38, rise: 0.34, spin: 0.46, fall: 0.22 };
      const PRE = { forward: 0, back: 0, jump: 0.18, punch: 0.35, hadoken: 0.85, shoryuken: 0.4, tatsumaki: 0.25 };
      let tm = (PRE[ev.type] || 0) * unit;
      const segT = [tm];
      let fallRun = 0;
      for (let i = 1; i < pts.length; i++) {
        const k = pts[i].kind;
        let d = SEG[k] || 0.4;
        if (k === 'fall') { fallRun++; d *= fallRun === 1 ? 1.3 : 0.85; } else fallRun = 0;
        tm += d * unit;
        segT.push(tm);
      }
      const moveEnd = tm;
      let end = moveEnd;
      const fx = ev.fx.map((f) => Object.assign({ done: false, time: segT[Math.min(f.at, segT.length - 1)] }, f));
      // ateş topu ve yumruk: vuruş zamanlarını ayarla
      const fire = fx.find((f) => f.kind === 'fireball');
      if (fire) {
        const dist = Math.max(0.5, fire.toX - fire.x - 0.4);
        fire.time = PRE.hadoken * unit;
        fire.travel = dist * 0.15 * unit + 80;
        for (const f of fx) if (f !== fire && f.at === 0) f.time = fire.time + fire.travel;
        end = Math.max(end, fire.time + fire.travel + 0.35 * unit);
      }
      const punch = fx.find((f) => f.kind === 'punch');
      if (punch) {
        for (const f of fx) if (f.at === 0) f.time = PRE.punch * unit;
        end = Math.max(end, PRE.punch * unit + 0.6 * unit);
      }
      // duvara ya da düşmana dokunup geri sekme (Ryu o kareye girmediyse)
      const last = pts[pts.length - 1];
      const hurt = fx.find((f) => (f.kind === 'hurt' || f.kind === 'wall') && (f.x !== last.x || f.y !== last.y)) || null;
      if (hurt) end = Math.max(end, hurt.time + 0.55 * unit);
      const deathAt = ev.result === 'dead' && ev.reason !== 'fall' ? (hurt ? hurt.time : moveEnd) : Infinity;
      if (deathAt < Infinity) end = Math.max(end, deathAt + 0.9 * unit);
      if (ev.result === 'flag') end += (this.world.flag.y - ev.steps[ev.steps.length - 1].y) * 0.22 * unit + 0.5 * unit;
      if (ev.type === 'tatsumaki' || ev.type === 'shoryuken') end = Math.max(end, moveEnd + 0.12 * unit);

      return new Promise((resolve) => {
        this.tween = { ev, pts, segT, moveEnd, end, fx, unit, t0: now(), resolve, hurt, deathAt };
      });
    }

    _finishTween(silent) {
      const tw = this.tween;
      if (!tw) return;
      this.tween = null;
      for (const f of tw.fx) if (!f.done) this._applyFx(f, tw, true);
      const last = tw.pts[tw.pts.length - 1];
      this.ryu.x = last.x;
      this.ryu.y = Math.min(last.y, this.world.height + 2);
      if (tw.ev.result === 'flag') { this.ryu.y = this.world.flag.y; this.ryu.x = this.world.flag.x - 0.3; }
      if (tw.ev.result === 'dead' && tw.hurt && tw.hurt.kind === 'hurt') this.ryu.x -= (Math.sign(tw.hurt.x - last.x) || 1) * 0.25;
      this.ryu.spin = 0;
      this.ryu.mix = null;
      this.ryu.charge = 0;
      this.ryu.pose = tw.ev.result === 'dead' ? 'ko' : tw.ev.result === 'flag' ? 'grab' : 'idle';
      if (tw.ev.combo >= 2 && !silent) this._showCombo(tw.ev.combo);
      tw.resolve();
    }

    _applyFx(f, tw, quick) {
      f.done = true;
      const k = f.x + ',' + f.y;
      switch (f.kind) {
        case 'coin':
          this.coins.delete(k);
          if (!quick) {
            this._sparkle(f.x + 0.5, f.y + 0.5, C.coinLight, 8);
            this._text('+1', f.x + 0.5, f.y + 0.2, C.coin);
          }
          break;
        case 'qcoin':
          this.tiles[f.y][f.x] = 'u';
          this.bumps.set(k, this.time);
          if (!quick) {
            this.effects.push({ kind: 'qcoin', x: f.x + 0.5, y: f.y, t0: this.time, dur: 0.7 });
            this._text('+1', f.x + 0.5, f.y - 0.9, C.coin);
          }
          break;
        case 'bump':
          this.bumps.set(k, this.time);
          break;
        case 'break':
          this.tiles[f.y][f.x] = '.';
          if (!quick) this._shards(f.x + 0.5, f.y + 0.5);
          break;
        case 'hit': {
          const e = this.enemies[f.enemy];
          if (!e) break;
          e.hp = f.hp;
          e.hitT = this.time;
          if (f.ko) { e.alive = false; e.koT = this.time; }
          if (!quick) {
            this._spark(f.x + 0.5, f.y + 0.5, f.ko ? 1.3 : 1);
            if (f.ko && (e.type === 'brute' || e.type === 'boss')) {
              this._text('K.O.!', f.x + 0.5, f.y - 0.6, '#ffd23a', 'big');
              this.shake = Math.max(this.shake, 0.35);
            } else if (!f.ko) {
              this.shake = Math.max(this.shake, 0.12);
            }
          }
          break;
        }
        case 'fireball':
          if (!quick) {
            this.effects.push({ kind: 'fireball', x0: f.x + 0.95, x1: f.toX + (f.target === 'none' ? 1.5 : 0.2), y: f.y + 0.5, t0: this.time, dur: (f.travel || 300) / 1000, target: f.target, ember: 0 });
            this.effects.push({ kind: 'flash', x: f.x + 0.95, y: f.y + 0.5, t0: this.time, dur: 0.3 });
          }
          break;
        case 'punch':
          if (!quick && f.target !== 'none') this._spark(f.x + 0.25, f.y + 0.5, 0.8);
          break;
        case 'hurt':
          if (!quick) { this._spark(f.x + 0.5, f.y + 0.5, 1.1); this.shake = Math.max(this.shake, 0.3); }
          this.ryu.flash = this.time;
          break;
        case 'wall':
          if (!quick) this._dust(f.x + 0.05, f.y + 0.6);
          break;
        case 'flag':
          this.flagRaise = this.time;
          break;
        default:
          break;
      }
    }

    _updateTween() {
      const tw = this.tween;
      if (!tw) return;
      const el = now() - tw.t0;
      // etkiler
      for (const f of tw.fx) if (!f.done && el >= f.time) this._applyFx(f, tw, false);
      const r = this.ryu;
      const type = tw.ev.type;
      const unit = tw.unit;
      const pre = tw.segT[0];
      // Ryu'nun konumu
      if (el < pre) {
        const p = tw.pts[0];
        r.x = p.x; r.y = p.y;
      } else if (el < tw.moveEnd) {
        let i = 1;
        while (i < tw.segT.length - 1 && el > tw.segT[i]) i++;
        const a = tw.pts[i - 1];
        const b = tw.pts[i];
        let u = clamp01((el - tw.segT[i - 1]) / (tw.segT[i] - tw.segT[i - 1] || 1));
        if (b.kind === 'walk') u = easeInOut(u);
        if (b.kind === 'walk' || b.kind === 'fall') {
          r.x = lerp(a.x, b.x, u);
          r.y = lerp(a.y, b.y, u);
        } else {
          const p0 = tw.pts[Math.max(0, i - 2)];
          const p3 = tw.pts[Math.min(tw.pts.length - 1, i + 1)];
          const q = catmull(p0, a, b, p3, u);
          r.x = q.x; r.y = q.y;
        }
      } else {
        const p = tw.pts[tw.pts.length - 1];
        r.x = p.x;
        r.y = p.y;
        if (tw.ev.result === 'flag') {
          const sl = clamp01((el - tw.moveEnd) / Math.max(1, (this.world.flag.y - p.y) * 0.22 * unit));
          r.y = lerp(p.y, this.world.flag.y, sl);
        }
        if (tw.ev.result === 'dead' && tw.ev.reason === 'fall') r.y = Math.min(p.y, this.world.height + 2);
      }
      // dokunup geri sekme (duvar ya da düşman)
      if (tw.hurt) {
        const ht = (el - tw.hurt.time) / (0.5 * unit);
        const dir = Math.sign(tw.hurt.x - r.x) || 1;
        if (ht > -0.6 && ht < 0) r.x += dir * 0.32 * easeOut(1 + ht / 0.6);
        else if (ht >= 0 && ht < 1) r.x += dir * 0.32 * (1 - easeOut(ht)) - (tw.hurt.kind === 'hurt' ? dir * 0.25 * easeOut(ht) : 0);
        else if (ht >= 1 && tw.hurt.kind === 'hurt') r.x -= dir * 0.25;
      }
      // poz
      r.spin = 0;
      r.mix = null;
      r.charge = 0;
      const lastKind = (el >= tw.moveEnd ? null : tw.pts[Math.min(tw.pts.length - 1, this._segIndex(tw, el))].kind);
      if (type === 'forward' || type === 'back') {
        r.pose = lastKind === 'fall' ? 'fall' : 'walk';
      } else if (type === 'jump') {
        r.pose = el < pre ? 'bump' : lastKind === 'fall' ? 'fall' : el < tw.moveEnd ? 'jump' : 'idle';
      } else if (type === 'punch') {
        const p = el / (pre + 0.35 * unit);
        r.pose = 'punch';
        r.mix = p < 0.75 ? { a: 'punchWind', b: 'punch', t: easeOut(clamp01(p / 0.75)) } : { a: 'punch', b: 'idle', t: clamp01((p - 1) / 0.6) };
      } else if (type === 'hadoken') {
        const p = el / pre;
        r.pose = 'hadoken';
        r.mix = p < 1 ? { a: 'idle', b: 'hadoWind', t: easeOut(clamp01(p * 1.6)) } : { a: 'hadoWind', b: 'hadoken', t: easeOut(clamp01((p - 1) * 8)) };
        if (p < 1 && !this.reduced) r.charge = clamp01(p * 1.3);
      } else if (type === 'shoryuken') {
        r.pose = el < pre ? 'shoWind' : lastKind === 'fall' ? 'fall' : el < tw.moveEnd ? 'shoryuken' : 'idle';
        if (r.pose === 'shoryuken' && !this.reduced && Math.random() < 0.7) this._flame(r.x + 0.75, r.y - 0.6);
      } else if (type === 'tatsumaki') {
        if (el < pre) r.pose = 'bump';
        else if (lastKind === 'fall') r.pose = 'fall';
        else if (el < tw.moveEnd) {
          r.pose = 'tatsu';
          r.spin = (el - pre) / (0.3 * unit);
        } else r.pose = 'idle';
      }
      if (tw.ev.result === 'flag' && el >= tw.moveEnd) {
        r.pose = 'grab';
        r.x = this.world.flag.x - 0.3;
      }
      if (el >= tw.deathAt) r.pose = (el - tw.deathAt) / (0.35 * unit) < 1 ? 'hurt' : 'ko';
      if (tw.ev.result === 'dead' && tw.ev.reason === 'fall' && lastKind === 'fall') r.pose = 'hurt';
      if (el >= tw.end) this._finishTween(false);
    }

    _segIndex(tw, el) {
      let i = 1;
      while (i < tw.segT.length - 1 && el > tw.segT[i]) i++;
      return i;
    }

    celebrate() {
      this.ryu.pose = 'win';
      this.ryu.mix = null;
      if (this.world) {
        this.ryu.y = this.world.flag.y;
        this.ryu.x = this.world.flag.x + 0.62;
      }
      this._text('BAŞARDIN!', this.ryu.x + 0.5, this.ryu.y - 1.6, '#ffd23a', 'big');
      if (this.reduced) return;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => this._firework(this.cam.x + rnd(0.2, 0.8) * this.viewW, this.cam.y + rnd(0.15, 0.4) * this.viewH), i * 260);
      }
    }

    // ---------------- parçacıklar ----------------
    _spark(x, y, size) {
      this.effects.push({ kind: 'spark', x, y, t0: this.time, dur: 0.28, size: size || 1 });
      if (this.reduced) return;
      for (let i = 0; i < 7; i++) {
        const a = rnd(0, TAU);
        const s = rnd(3, 7);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: 10, life: 0.35, t: 0, color: i % 2 ? C.spark : '#ffffff', r: 0.07 });
      }
    }
    _sparkle(x, y, color, n) {
      if (this.reduced) return;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        this.particles.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, g: 0, life: 0.4, t: 0, color, r: 0.06, star: true });
      }
    }
    _shards(x, y) {
      const n = this.reduced ? 0 : 8;
      for (let i = 0; i < n; i++) {
        this.particles.push({ x: x + rnd(-0.3, 0.3), y: y + rnd(-0.3, 0.3), vx: rnd(-4, 4), vy: rnd(-9, -4), g: 26, life: 0.9, t: 0, color: i % 2 ? C.crate : C.crateDark, r: 0.13, rot: rnd(0, TAU), vr: rnd(-12, 12), plank: true });
      }
      this._dust(x, y + 0.3);
    }
    _dust(x, y) {
      if (this.reduced) return;
      for (let i = 0; i < 5; i++) {
        this.particles.push({ x, y, vx: rnd(-1.6, 1.6), vy: rnd(-1.8, -0.4), g: 0, life: 0.5, t: 0, color: 'rgba(255,255,255,.75)', r: rnd(0.08, 0.16), puff: true });
      }
    }
    _flame(x, y) {
      this.particles.push({ x: x + rnd(-0.15, 0.15), y: y + rnd(-0.2, 0.3), vx: rnd(-0.6, 0.6), vy: rnd(0.5, 1.6), g: 0, life: 0.35, t: 0, color: Math.random() < 0.5 ? C.flame : C.flameRed, r: rnd(0.1, 0.2), puff: true, glow: true });
    }
    _firework(x, y) {
      const colors = ['#ff4fa3', '#20c4f4', '#ffd23a', '#38d36b', '#a57bff'];
      const col = colors[Math.floor(rnd(0, colors.length))];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        const s = rnd(4, 6);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 3, life: 1.1, t: 0, color: col, r: 0.08, star: i % 3 === 0 });
      }
    }
    _text(text, x, y, color, size) {
      this.texts.push({ text, x, y, color, size: size || 'small', t0: this.time, dur: size === 'big' ? 1.6 : 0.8 });
    }
    _showCombo(n) {
      this.combo = { n, t0: this.time };
    }

    // ---------------- döngü ----------------
    _loop(t) {
      const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      this.time += dt;
      this._updateTween();
      this._update(dt);
      this._draw();
      raf(this._loop);
    }

    _update(dt) {
      for (const p of this.particles) {
        p.t += dt;
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
      this.particles = this.particles.filter((p) => p.t < p.life);
      if (!this.reduced) {
        for (const e of this.effects) {
          if (e.kind !== 'fireball') continue;
          const k = this.time - e.t0;
          if (k >= e.dur || this.time - e.ember < 0.03) continue;
          e.ember = this.time;
          const x = lerp(e.x0, e.x1, clamp01(k / e.dur));
          this.particles.push({ x: x - 0.35, y: e.y + rnd(-0.18, 0.18), vx: rnd(-3, -1), vy: rnd(-0.6, 0.6), g: 0, life: 0.3, t: 0, color: Math.random() < 0.5 ? '#9be7ff' : '#ffffff', r: rnd(0.04, 0.08), puff: true });
        }
      }
      this.effects = this.effects.filter((e) => this.time - e.t0 < (e.dur || 0.5) + 0.05 || e.kind === 'fireball' && this.time - e.t0 < 2);
      this.texts = this.texts.filter((x) => this.time - x.t0 < x.dur);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      if (this.intro && (this.tween || this.cam.manual)) this.intro = null;
      if (this.world && !this.cam.manual && !(this.intro && this.time < this.intro.t0)) {
        const target = this._camTarget();
        let k = this.tween ? 1 - Math.pow(0.002, dt) : 1 - Math.pow(0.02, dt);
        if (this.intro) {
          k = 1 - Math.pow(0.25, dt);
          if (Math.abs(target.x - this.cam.x) < 0.05) this.intro = null;
        }
        this.cam.x += (target.x - this.cam.x) * k;
        this.cam.y += (target.y - this.cam.y) * k;
      }
    }

    // ---------------- çizim ----------------
    _draw() {
      const ctx = this.ctx;
      const dpr = this.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      if (!this.world) return;
      const T = this.tile;
      this._drawBackground(ctx);
      ctx.save();
      let sx = 0;
      let sy = 0;
      if (this.shake > 0 && !this.reduced) {
        sx = rnd(-1, 1) * this.shake * T * 0.25;
        sy = rnd(-1, 1) * this.shake * T * 0.25;
      }
      ctx.translate(Math.round(-this.cam.x * T + sx), Math.round(-this.cam.y * T + sy));
      this._drawTiles(ctx);
      this._drawFlag(ctx);
      this._drawCoins(ctx);
      this._drawEnemies(ctx);
      this._drawEffects(ctx, 'back');
      this._drawRyu(ctx);
      this._drawEffects(ctx, 'front');
      this._drawParticles(ctx);
      this._drawTexts(ctx);
      ctx.restore();
      this._drawHud(ctx);
    }

    _drawBackground(ctx) {
      const th = this.theme;
      const W = this.cssW;
      const H = this.cssH;
      const T = this.tile;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(1, th.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const camX = this.cam.x * T;
      const groundY = (this.world.height - 1 - this.cam.y) * T;   // en alt satırın üstü
      const t = this.time;

      if (th.stars) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < 60; i++) {
          const x = ((hash(i, 7) % 1000) / 1000 * W * 1.5 - camX * 0.03) % (W * 1.5);
          const y = (hash(i, 13) % 1000) / 1000 * H * 0.55;
          const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
          ctx.globalAlpha = 0.35 + tw * 0.6;
          const s = (i % 3 === 0 ? 2 : 1.3);
          ctx.fillRect(x < 0 ? x + W * 1.5 : x, y, s, s);
        }
        ctx.globalAlpha = 1;
      }
      if (th.sun && !th.cave) {
        const sx = W * 0.78 - camX * 0.02;
        const sy = H * (th.moon ? 0.2 : th.castle ? 0.52 : 0.24);
        const r = T * (th.moon ? 0.6 : 0.95);
        const sg = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 2.6);
        sg.addColorStop(0, th.sun);
        sg.addColorStop(0.35, th.moon ? 'rgba(255,248,216,.35)' : 'rgba(255,246,200,.45)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = th.sun;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();
        if (th.moon) {
          ctx.fillStyle = th.sky[0];
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(sx + r * 0.42, sy - r * 0.2, r * 0.85, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      if (th.cave) {
        // sarkıtlar
        ctx.fillStyle = th.far;
        for (let i = -1; i < W / T + 2; i++) {
          const wx = i + Math.floor(this.cam.x * 0.4);
          const x = (wx - this.cam.x * 0.4) * T;
          const h = (0.6 + (hash(wx, 3) % 100) / 100 * 1.4) * T;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + T * 0.5, h);
          ctx.lineTo(x + T, 0);
          ctx.fill();
        }
        // meşaleler
        for (let i = -1; i < W / (T * 4) + 2; i++) {
          const wx = i + Math.floor(this.cam.x * 0.6 / 4);
          const x = (wx * 4 - this.cam.x * 0.6) * T + T * 1.5;
          const y = groundY - T * 2.4;
          const fl = 0.8 + 0.2 * Math.sin(t * 12 + wx);
          const fg = ctx.createRadialGradient(x, y, 2, x, y, T * 1.6 * fl);
          fg.addColorStop(0, 'rgba(255,190,90,.55)');
          fg.addColorStop(1, 'rgba(255,190,90,0)');
          ctx.fillStyle = fg;
          ctx.fillRect(x - T * 2, y - T * 2, T * 4, T * 4);
          ctx.fillStyle = '#6b4a30';
          ctx.fillRect(x - T * 0.06, y, T * 0.12, T * 0.5);
          ctx.fillStyle = C.flame;
          ctx.beginPath();
          ctx.ellipse(x, y - T * 0.05, T * 0.12 * fl, T * 0.22 * fl, 0, 0, TAU);
          ctx.fill();
        }
        return;
      }
      // uzak dağlar
      const far = (factor, color, snow, base, peak, spacing, seed) => {
        const off = this.cam.x * factor;
        const start = Math.floor(off / spacing) - 1;
        for (let i = start; i < start + W / (T * spacing) + 3; i++) {
          const x = (i * spacing - off) * T;
          const h = (peak * (0.7 + (hash(i, seed) % 100) / 330)) * T;
          const w = spacing * T * 0.9;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x - w * 0.5, base);
          ctx.lineTo(x + w * 0.5, base - h);
          ctx.lineTo(x + w * 1.5, base);
          ctx.closePath();
          ctx.fill();
          if (snow) {
            ctx.fillStyle = snow;
            ctx.beginPath();
            ctx.moveTo(x + w * 0.5, base - h);
            ctx.lineTo(x + w * 0.5 - w * 0.22, base - h * 0.72);
            ctx.lineTo(x + w * 0.42, base - h * 0.78);
            ctx.lineTo(x + w * 0.56, base - h * 0.7);
            ctx.lineTo(x + w * 0.5 + w * 0.22, base - h * 0.72);
            ctx.closePath();
            ctx.fill();
          }
        }
      };
      far(0.12, th.far, th.farSnow, groundY + T * 0.2, 4.2, 7, 11);
      // bulutlar
      if (th.cloud) {
        ctx.fillStyle = th.cloud;
        ctx.globalAlpha = th.stars ? 0.45 : 0.95;
        for (let i = -1; i < 6; i++) {
          const span = W / T + 8;
          let x = ((i * 5.3 + (hash(i, 5) % 7)) - this.cam.x * 0.2 + t * 0.15) % span;
          if (x < -4) x += span;
          const y = (0.6 + (hash(i, 9) % 100) / 100 * 1.8) * T;
          this._cloud(ctx, x * T, y, T * (0.8 + (i % 3) * 0.2));
        }
        ctx.globalAlpha = 1;
      }
      // pagoda / kale silueti
      if (th.pagoda || th.castle) {
        const off = this.cam.x * 0.3;
        const spacing = th.castle ? 9 : 13;
        const start = Math.floor(off / spacing) - 1;
        for (let i = start; i < start + W / (T * spacing) + 3; i++) {
          const x = (i * spacing - off) * T + T * 3;
          this._pagoda(ctx, x, groundY + T * 0.1, T * (th.castle ? 1.25 : 0.9), th.midDark);
        }
      }
      // yakın tepeler
      const off = this.cam.x * 0.45;
      const start = Math.floor(off / 4) - 1;
      ctx.fillStyle = th.mid;
      for (let i = start; i < start + W / (T * 4) + 3; i++) {
        const x = (i * 4 - off) * T;
        const r = (1.6 + (hash(i, 21) % 100) / 100 * 0.9) * T;
        ctx.beginPath();
        ctx.ellipse(x + T * 2, groundY + T * 0.35, r * 1.2, r, 0, Math.PI, TAU);
        ctx.fill();
      }
      ctx.fillStyle = th.midDark;
      ctx.fillRect(0, groundY + T * 0.3, W, H);
    }

    _cloud(ctx, x, y, s) {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, TAU);
      ctx.arc(x + s * 0.55, y - s * 0.25, s * 0.6, 0, TAU);
      ctx.arc(x + s * 1.15, y, s * 0.5, 0, TAU);
      ctx.rect(x, y - s * 0.05, s * 1.15, s * 0.5);
      ctx.fill();
    }

    _pagoda(ctx, x, base, s, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x - s * 0.9, base - s * 1.2, s * 1.8, s * 1.2);
      for (let k = 0; k < 3; k++) {
        const y = base - s * (1.2 + k * 0.9);
        const w = s * (1.6 - k * 0.3);
        ctx.beginPath();
        ctx.moveTo(x - w - s * 0.2, y);
        ctx.quadraticCurveTo(x - w * 0.5, y - s * 0.12, x - w * 0.55, y - s * 0.3);
        ctx.lineTo(x + w * 0.55, y - s * 0.3);
        ctx.quadraticCurveTo(x + w * 0.5, y - s * 0.12, x + w + s * 0.2, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x - w * 0.5, y - s * 0.9, w, s * 0.62);
      }
      ctx.fillRect(x - s * 0.04, base - s * 4.3, s * 0.08, s * 0.5);
    }

    _solidAt(x, y) {
      if (y < 0) return false;
      const w = this.world;
      if (y >= w.height) return false;
      if (x < 0) x = 0;
      if (x >= w.width) x = w.width - 1;
      const c = this.tiles[y][x];
      return SOLID.indexOf(c) !== -1;
    }
    _groundAt(x, y) {
      const w = this.world;
      if (y < 0 || y >= w.height) return false;
      const cx = clamp(x, 0, w.width - 1);
      return this.tiles[y][cx] === '#';
    }

    _drawTiles(ctx) {
      const w = this.world;
      const T = this.tile;
      const x0 = Math.floor(this.cam.x) - 1;
      const x1 = Math.ceil(this.cam.x + this.viewW) + 1;
      for (let y = 0; y < w.height; y++) {
        for (let x = x0; x <= x1; x++) {
          const inside = x >= 0 && x < w.width;
          let c = inside ? this.tiles[y][x] : (this._groundAt(x, y) ? '#' : '.');
          if (!inside && c !== '#') continue;
          if (c === '.') continue;
          const px = Math.floor(x * T);
          let py = Math.floor(y * T);
          const tw = Math.floor((x + 1) * T) - px;
          const bt = this.bumps.get(x + ',' + y);
          if (bt != null) {
            const k = (this.time - bt) / 0.22;
            if (k < 1) py -= Math.sin(k * Math.PI) * T * 0.28;
            else this.bumps.delete(x + ',' + y);
          }
          if (c === '#') this._ground(ctx, px, py, tw, !this._solidAt(x, y - 1), x, y);
          else if (c === '=') this._stone(ctx, px, py, T);
          else if (c === 'B') this._crate(ctx, px, py, T);
          else if (c === '?') this._question(ctx, px, py, T, x);
          else if (c === 'u') this._used(ctx, px, py, T);
          else if (c === '^') this._spikes(ctx, px, py, T);
        }
      }
      // haritanın altında devam eden toprak; çukurlar karanlık bir boşluk
      const by = Math.floor(w.height * T);
      const th = this.theme;
      const pit = ctx.createLinearGradient(0, (w.height - 1) * T, 0, (w.height + 1.5) * T);
      pit.addColorStop(0, 'rgba(18,12,24,0)');
      pit.addColorStop(0.35, 'rgba(18,12,24,.55)');
      pit.addColorStop(1, 'rgba(18,12,24,.95)');
      for (let x = x0; x <= x1; x++) {
        const px = Math.floor(x * T);
        const tw = Math.floor((x + 1) * T) - px;
        if (this._groundAt(x, w.height - 1)) {
          ctx.fillStyle = th.dirtDark;
          ctx.fillRect(px, by, tw, T * 3);
        } else if (!this._solidAt(x, w.height - 1)) {
          ctx.fillStyle = pit;
          ctx.fillRect(px, (w.height - 1) * T, tw, T * 4);
        }
      }
    }

    _ground(ctx, x, y, T, top, cx, cy) {
      const th = this.theme;
      const castle = th.castle || th.cave;
      ctx.fillStyle = th.dirt;
      ctx.fillRect(x, y, T, T + 1);
      if (castle) {
        // taş tuğla
        ctx.fillStyle = th.dirtDark;
        const off = cy % 2 ? T * 0.5 : 0;
        ctx.fillRect(x, y + T * 0.48, T, T * 0.06);
        ctx.fillRect(x + ((off + T * 0.25) % T), y, T * 0.06, T * 0.48);
        ctx.fillRect(x + ((off + T * 0.75) % T), y + T * 0.54, T * 0.06, T * 0.46);
        ctx.fillStyle = th.dirtLight;
        ctx.fillRect(x, y, T, T * 0.06);
      } else {
        // taşçıklar
        const h = hash(cx, cy);
        ctx.fillStyle = th.dirtDark;
        for (let i = 0; i < 3; i++) {
          const sx = ((h >> (i * 5)) % 10) / 10;
          const sy = ((h >> (i * 7 + 3)) % 10) / 10;
          ctx.beginPath();
          ctx.ellipse(x + (0.15 + sx * 0.7) * T, y + (0.3 + sy * 0.6) * T, T * 0.07, T * 0.045, 0, 0, TAU);
          ctx.fill();
        }
      }
      if (top) {
        ctx.fillStyle = th.grassDark;
        ctx.fillRect(x, y, T, T * 0.34);
        ctx.fillStyle = th.grass;
        ctx.fillRect(x, y, T, T * 0.26);
        // çim tırtıkları
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const bx = x + (i + 0.5) * T / 4;
          ctx.moveTo(bx - T * 0.08, y + T * 0.25);
          ctx.lineTo(bx, y + T * 0.38);
          ctx.lineTo(bx + T * 0.08, y + T * 0.25);
        }
        ctx.fill();
        ctx.fillStyle = th.grassLight;
        ctx.fillRect(x, y, T, T * 0.07);
      }
    }

    _stone(ctx, x, y, T) {
      ctx.fillStyle = C.stoneDark;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = C.stone;
      ctx.fillRect(x + T * 0.06, y + T * 0.06, T * 0.88, T * 0.82);
      ctx.fillStyle = C.stoneLight;
      ctx.fillRect(x + T * 0.06, y + T * 0.06, T * 0.88, T * 0.1);
      ctx.fillRect(x + T * 0.06, y + T * 0.06, T * 0.1, T * 0.82);
    }

    _crate(ctx, x, y, T) {
      const p = T * 0.06;
      ctx.fillStyle = C.ink;
      roundRect(ctx, x + p * 0.3, y + p * 0.3, T - p * 0.6, T - p * 0.6, T * 0.08);
      ctx.fill();
      ctx.fillStyle = C.crate;
      ctx.fillRect(x + p * 1.4, y + p * 1.4, T - p * 2.8, T - p * 2.8);
      ctx.fillStyle = C.crateDark;
      for (let i = 1; i < 3; i++) ctx.fillRect(x + p * 1.4, y + i * T / 3 - p * 0.3, T - p * 2.8, p * 0.6);
      ctx.strokeStyle = C.crateDark;
      ctx.lineWidth = T * 0.11;
      ctx.beginPath();
      ctx.moveTo(x + p * 2.4, y + p * 2.4);
      ctx.lineTo(x + T - p * 2.4, y + T - p * 2.4);
      ctx.stroke();
      ctx.strokeStyle = C.crateLight;
      ctx.lineWidth = T * 0.05;
      ctx.beginPath();
      ctx.moveTo(x + p * 2.4, y + p * 2.0);
      ctx.lineTo(x + T - p * 2.8, y + T - p * 3.4);
      ctx.stroke();
      ctx.fillStyle = C.crateLight;
      ctx.fillRect(x + p * 1.4, y + p * 1.4, T - p * 2.8, p * 0.8);
    }

    _question(ctx, x, y, T, cx) {
      const p = T * 0.06;
      ctx.fillStyle = C.ink;
      roundRect(ctx, x + p * 0.3, y + p * 0.3, T - p * 0.6, T - p * 0.6, T * 0.1);
      ctx.fill();
      ctx.fillStyle = C.qDark;
      roundRect(ctx, x + p * 1.2, y + p * 1.2, T - p * 2.4, T - p * 2.4, T * 0.07);
      ctx.fill();
      ctx.fillStyle = C.qBlock;
      roundRect(ctx, x + p * 1.2, y + p * 1.2, T - p * 2.4, T - p * 3.4, T * 0.07);
      ctx.fill();
      const shine = 0.5 + 0.5 * Math.sin(this.time * 4 + cx);
      ctx.fillStyle = C.qLight;
      ctx.globalAlpha = 0.5 + shine * 0.5;
      ctx.fillRect(x + p * 2, y + p * 2, T - p * 4, p * 0.9);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.qDark;
      for (const [rx, ry] of [[2.6, 2.6], [T / p - 3.4, 2.6], [2.6, T / p - 4.2], [T / p - 3.4, T / p - 4.2]]) {
        ctx.fillRect(x + rx * p, y + ry * p, p * 0.9, p * 0.9);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 ' + Math.round(T * 0.62) + "px 'Baloo 2', 'Nunito', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.qDark;
      ctx.fillText('?', x + T / 2 + T * 0.04, y + T * 0.5 + T * 0.04);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('?', x + T / 2, y + T * 0.48);
    }

    _used(ctx, x, y, T) {
      const p = T * 0.06;
      ctx.fillStyle = C.ink;
      roundRect(ctx, x + p * 0.3, y + p * 0.3, T - p * 0.6, T - p * 0.6, T * 0.1);
      ctx.fill();
      ctx.fillStyle = C.usedDark;
      ctx.fillRect(x + p * 1.2, y + p * 1.2, T - p * 2.4, T - p * 2.4);
      ctx.fillStyle = C.used;
      ctx.fillRect(x + p * 1.2, y + p * 1.2, T - p * 2.4, T - p * 3.6);
      ctx.fillStyle = C.usedDark;
      for (const [rx, ry] of [[2.6, 2.6], [T / p - 3.4, 2.6], [2.6, T / p - 4.4], [T / p - 3.4, T / p - 4.4]]) {
        ctx.fillRect(x + rx * p, y + ry * p, p * 0.9, p * 0.9);
      }
    }

    _spikes(ctx, x, y, T) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const bx = x + (i / n) * T;
        const w = T / n;
        ctx.fillStyle = C.spikeDark;
        ctx.beginPath();
        ctx.moveTo(bx, y + T);
        ctx.lineTo(bx + w / 2, y + T * 0.35);
        ctx.lineTo(bx + w, y + T);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = C.spike;
        ctx.beginPath();
        ctx.moveTo(bx + w * 0.12, y + T);
        ctx.lineTo(bx + w / 2, y + T * 0.42);
        ctx.lineTo(bx + w * 0.55, y + T);
        ctx.closePath();
        ctx.fill();
      }
    }

    _drawCoins(ctx) {
      const T = this.tile;
      for (const k of this.coins) {
        const [x, y] = k.split(',').map(Number);
        this._coin(ctx, (x + 0.5) * T, (y + 0.5 + Math.sin(this.time * 3 + x) * 0.05) * T, T * 0.3, this.time * 3 + x * 0.7);
      }
    }

    _coin(ctx, cx, cy, r, phase) {
      const sx = Math.max(0.18, Math.abs(Math.cos(phase)));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, 1);
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.12, r * 1.25, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.coinDark;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 1.13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.coin;
      ctx.beginPath();
      ctx.ellipse(-r * 0.08, -r * 0.06, r * 0.82, r * 0.98, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.coinLight;
      ctx.fillRect(-r * 0.2, -r * 0.62, r * 0.28, r * 1.1);
      ctx.restore();
    }

    _drawFlag(ctx) {
      const T = this.tile;
      const f = this.world.flag;
      const px = (f.x + 0.5) * T;
      const top = (f.y - Math.min(3.4, f.y + 0.6)) * T;
      const base = (f.y + 1) * T;
      // kaide
      ctx.fillStyle = C.stoneDark;
      ctx.fillRect(px - T * 0.32, base - T * 0.3, T * 0.64, T * 0.3);
      ctx.fillStyle = C.stone;
      ctx.fillRect(px - T * 0.28, base - T * 0.28, T * 0.56, T * 0.14);
      // direk
      ctx.fillStyle = C.poleDark;
      ctx.fillRect(px - T * 0.07, top, T * 0.14, base - top - T * 0.28);
      ctx.fillStyle = C.pole;
      ctx.fillRect(px - T * 0.07, top, T * 0.06, base - top - T * 0.28);
      ctx.fillStyle = C.coin;
      ctx.beginPath();
      ctx.arc(px, top, T * 0.15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = C.coinDark;
      ctx.lineWidth = T * 0.04;
      ctx.stroke();
      // bayrak: Ryu değince sevinçle dalgalanır
      const cheer = this.flagRaise ? clamp01((this.time - this.flagRaise) / 1.2) : 1;
      const fy = top + T * 0.12;
      const wave = Math.sin(this.time * (cheer < 1 ? 14 : 5)) * T * (cheer < 1 ? 0.14 : 0.06);
      if (cheer < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - cheer;
        ctx.fillStyle = C.coinLight;
        star(ctx, px - T * 0.45, fy + T * 0.38, T * (0.5 + cheer * 0.6), T * 0.2, 8, cheer * 3);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = C.flagDark;
      ctx.beginPath();
      ctx.moveTo(px - T * 0.06, fy);
      ctx.quadraticCurveTo(px - T * 0.5, fy + T * 0.1 + wave, px - T * 1.0, fy + T * 0.04 + wave);
      ctx.lineTo(px - T * 0.86, fy + T * 0.42);
      ctx.lineTo(px - T * 1.0, fy + T * 0.8 - wave);
      ctx.quadraticCurveTo(px - T * 0.5, fy + T * 0.74 - wave, px - T * 0.06, fy + T * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.flag;
      ctx.beginPath();
      ctx.moveTo(px - T * 0.06, fy);
      ctx.quadraticCurveTo(px - T * 0.5, fy + T * 0.1 + wave, px - T * 0.94, fy + T * 0.06 + wave);
      ctx.lineTo(px - T * 0.8, fy + T * 0.4);
      ctx.lineTo(px - T * 0.94, fy + T * 0.72 - wave);
      ctx.quadraticCurveTo(px - T * 0.5, fy + T * 0.68 - wave, px - T * 0.06, fy + T * 0.72);
      ctx.closePath();
      ctx.fill();
      // amblem: beyaz yumruk yıldızı
      ctx.fillStyle = '#ffffff';
      star(ctx, px - T * 0.45, fy + T * 0.38 + wave * 0.3, T * 0.16, T * 0.07, 5, -Math.PI / 2);
      ctx.fill();
    }

    // ---------------- düşmanlar ----------------
    _drawEnemies(ctx) {
      const T = this.tile;
      for (const e of this.enemies) {
        let ex = e.x;
        let ey = e.y;
        let rot = 0;
        let alpha = 1;
        if (!e.alive) {
          const k = this.time - e.koT;
          if (k > 1.2) continue;
          ex += k * 1.6;
          ey += -6 * k + 14 * k * k;
          rot = k * 9;
          alpha = clamp01(1.4 - k);
        }
        const hit = this.time - e.hitT;
        const flash = hit >= 0 && hit < 0.25;
        const shakeX = flash ? Math.sin(hit * 80) * 0.06 : 0;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate((ex + 0.5 + shakeX) * T, (ey + 1) * T);
        if (rot) {
          ctx.translate(0, -T * 0.5);
          ctx.rotate(rot);
          ctx.translate(0, T * 0.5);
        }
        const s = T / 16;
        ctx.scale(s, s);
        const bob = Math.sin(this.time * 4 + e.phase);
        if (e.type === 'thug') this._thug(ctx, bob, flash);
        else if (e.type === 'brute') this._brute(ctx, bob, flash, 1);
        else if (e.type === 'boss') this._brute(ctx, bob, flash, 1.3, true);
        else if (e.type === 'bat') this._bat(ctx, this.time * 14 + e.phase, flash);
        else if (e.type === 'spiky') this._spiky(ctx, bob, flash);
        ctx.restore();
        if (e.alive && e.maxHp > 1) this._hpPips(ctx, (e.x + 0.5) * T, (e.y - (e.type === 'boss' ? 0.75 : 0.45)) * T, e.hp, e.maxHp, T);
      }
    }

    _hpPips(ctx, cx, y, hp, max, T) {
      const w = T * 0.2;
      const gap = T * 0.05;
      const total = max * w + (max - 1) * gap;
      let x = cx - total / 2;
      for (let i = 0; i < max; i++) {
        ctx.fillStyle = C.ink;
        roundRect(ctx, x - 1, y - 1, w + 2, T * 0.14 + 2, 3);
        ctx.fill();
        ctx.fillStyle = i < hp ? '#ff4d5e' : '#4a3a4f';
        roundRect(ctx, x, y, w, T * 0.14, 2);
        ctx.fill();
        x += w + gap;
      }
    }

    _thug(ctx, bob, flash) {
      // küçük, yuvarlak, maskeli haydut (16 birimlik hücre, ayaklar y=0)
      const y = -bob * 0.4;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = C.ink;
      // ayaklar
      ctx.fillStyle = '#3a2a40';
      ctx.beginPath();
      ctx.ellipse(-3.5, -1.2, 2.8, 1.6, 0, 0, TAU);
      ctx.ellipse(3.5, -1.2, 2.8, 1.6, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // gövde
      ctx.fillStyle = flash ? '#ffffff' : '#8a5cd6';
      ctx.beginPath();
      ctx.ellipse(0, -7 + y, 6.6, 6.2, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : '#a97df0';
      ctx.beginPath();
      ctx.ellipse(-1.8, -9.5 + y, 3, 2, -0.4, 0, TAU);
      ctx.fill();
      // bandana
      ctx.fillStyle = '#e8483c';
      ctx.fillRect(-6.4, -11.2 + y, 12.8, 2.2);
      ctx.beginPath();
      ctx.moveTo(6, -11 + y);
      ctx.lineTo(9, -13 + y + bob * 0.5);
      ctx.lineTo(8.6, -9.6 + y);
      ctx.closePath();
      ctx.fill();
      // maske ve gözler
      ctx.fillStyle = C.ink;
      roundRect(ctx, -5.4, -8.4 + y, 10.8, 3, 1.4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3.8, -7.6 + y, 2.4, 1.6);
      ctx.fillRect(1.4, -7.6 + y, 2.4, 1.6);
      ctx.fillStyle = C.ink;
      ctx.fillRect(-2.6, -7.4 + y, 1.1, 1.3);
      ctx.fillRect(1.5, -7.4 + y, 1.1, 1.3);
      // kaşlar (kızgın)
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4.2, -9.4 + y); ctx.lineTo(-1.2, -8.6 + y);
      ctx.moveTo(4.2, -9.4 + y); ctx.lineTo(1.2, -8.6 + y);
      ctx.stroke();
      // ağız
      ctx.beginPath();
      ctx.moveTo(-1.6, -3.4 + y);
      ctx.lineTo(1.6, -3.6 + y);
      ctx.stroke();
    }

    _brute(ctx, bob, flash, size, boss) {
      ctx.save();
      ctx.scale(size, size);
      const y = -Math.abs(bob) * 0.5;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.1;
      const body = flash ? '#ffffff' : boss ? '#5b3a8a' : '#d4733a';
      const bodyLight = flash ? '#ffffff' : boss ? '#7a55b0' : '#ee9458';
      const skin = flash ? '#ffffff' : boss ? '#9b8ac2' : '#7fb85a';
      // bacaklar
      ctx.fillStyle = '#3b2c3f';
      ctx.fillRect(-5.5, -5, 4, 5);
      ctx.fillRect(1.5, -5, 4, 5);
      ctx.strokeRect(-5.5, -5, 4, 5);
      ctx.strokeRect(1.5, -5, 4, 5);
      // gövde
      ctx.fillStyle = body;
      roundRect(ctx, -7.5, -15 + y, 15, 11, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = bodyLight;
      roundRect(ctx, -6, -14 + y, 6, 4, 2);
      ctx.fill();
      // kemer
      ctx.fillStyle = C.ink;
      ctx.fillRect(-7.5, -6.6 + y, 15, 1.8);
      ctx.fillStyle = C.coin;
      ctx.fillRect(-1.2, -6.8 + y, 2.4, 2.2);
      // kollar
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(-8.4, -9 + y, 2.6, 4, 0.3, 0, TAU);
      ctx.ellipse(8.4, -9 + y, 2.6, 4, -0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.glove;
      ctx.beginPath();
      ctx.arc(-9.2, -5 + y, 2.2, 0, TAU);
      ctx.arc(9.2, -5 + y, 2.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // kafa
      ctx.fillStyle = skin;
      roundRect(ctx, -4.5, -21 + y, 9, 7.5, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(-3.2, -18.6 + y, 2.2, 1.6);
      ctx.fillRect(1, -18.6 + y, 2.2, 1.6);
      ctx.beginPath();
      ctx.moveTo(-3.6, -20 + y); ctx.lineTo(-0.8, -19 + y);
      ctx.moveTo(3.6, -20 + y); ctx.lineTo(0.8, -19 + y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -15.6 + y, 1.2, 1.2);
      ctx.fillRect(0.8, -15.6 + y, 1.2, 1.2);
      if (boss) {
        // boynuzlar ve pelerin yakası
        ctx.fillStyle = '#f2e6c8';
        ctx.beginPath();
        ctx.moveTo(-4, -20 + y); ctx.lineTo(-6.5, -25 + y); ctx.lineTo(-2.4, -21 + y);
        ctx.moveTo(4, -20 + y); ctx.lineTo(6.5, -25 + y); ctx.lineTo(2.4, -21 + y);
        ctx.fill();
        ctx.stroke();
      } else {
        // mohikan
        ctx.fillStyle = '#2c2030';
        ctx.beginPath();
        ctx.moveTo(-1.5, -21 + y); ctx.lineTo(0, -24.5 + y); ctx.lineTo(1.5, -21 + y);
        ctx.fill();
      }
      ctx.restore();
    }

    _bat(ctx, phase, flash) {
      const flap = Math.sin(phase);
      const y = -8 + Math.sin(phase * 0.25) * 0.8;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.1;
      ctx.fillStyle = flash ? '#ffffff' : '#5a3d7a';
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * 2.5, y - 1);
        ctx.quadraticCurveTo(d * 7, y - 6 * flap - 2, d * 9.5, y - 3 * flap);
        ctx.quadraticCurveTo(d * 7.4, y - 1, d * 6.8, y + 1.5);
        ctx.quadraticCurveTo(d * 5, y, d * 2.5, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = flash ? '#ffffff' : '#6e4c94';
      ctx.beginPath();
      ctx.ellipse(0, y, 3.6, 4, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2.6, y - 3); ctx.lineTo(-1.8, y - 6); ctx.lineTo(-0.6, y - 3.6);
      ctx.moveTo(2.6, y - 3); ctx.lineTo(1.8, y - 6); ctx.lineTo(0.6, y - 3.6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(-2, y - 1.2, 1.4, 1.4);
      ctx.fillRect(0.6, y - 1.2, 1.4, 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, y + 1.6, 0.8, 1.2);
      ctx.fillRect(0.4, y + 1.6, 0.8, 1.2);
    }

    _spiky(ctx, bob, flash) {
      const y = -bob * 0.25;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.1;
      // dikenler
      ctx.fillStyle = flash ? '#ffffff' : '#6f6a7a';
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI * 1.05 - 0.05;
        const r1 = 7.2;
        const r2 = 10.2;
        const ax = Math.cos(a) * r1 - 0.5;
        const ay = Math.sin(a) * r1 * 0.9 - 4.5 + y;
        const bx = Math.cos(a + 0.18) * r2 - 0.5;
        const by = Math.sin(a + 0.18) * r2 * 0.9 - 4.5 + y;
        ctx[i ? 'lineTo' : 'moveTo'](ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.lineTo(7, -4 + y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // gövde
      ctx.fillStyle = flash ? '#ffffff' : '#c08a5a';
      ctx.beginPath();
      ctx.ellipse(0.5, -4 + y, 7, 4.6, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      // yüz (sola, Ryu'ya bakıyor)
      ctx.fillStyle = flash ? '#ffffff' : '#f0c79a';
      ctx.beginPath();
      ctx.ellipse(-4.4, -3.6 + y, 3.4, 2.8, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(-7.6, -3.4 + y, 0.9, 0, TAU);
      ctx.fill();
      ctx.fillRect(-5.4, -5 + y, 1.2, 1.4);
      ctx.fillStyle = '#3a2a40';
      ctx.beginPath();
      ctx.ellipse(-2.5, -0.3, 1.8, 0.9, 0, 0, TAU);
      ctx.ellipse(3.5, -0.3, 1.8, 0.9, 0, 0, TAU);
      ctx.fill();
    }

    // ---------------- Ryu ----------------
    _drawRyu(ctx) {
      const r = this.ryu;
      const T = this.tile;
      if (r.y > this.world.height + 1.5) return;
      let pose = POSES[r.pose] || POSES.idle;
      let bob = 0;
      if (r.pose === 'idle') bob = Math.sin(this.time * 5) * 0.35;
      if (r.pose === 'walk') {
        const c = Math.sin(r.x * Math.PI * 2);
        pose = mixPose(POSES.walkA, POSES.walkB, (c + 1) / 2);
        bob = -Math.abs(Math.sin(r.x * Math.PI * 2)) * 0.8;
      }
      if (r.mix) pose = mixPose(POSES[r.mix.a], POSES[r.mix.b], r.mix.t);
      if (r.pose === 'win') {
        bob = -Math.abs(Math.sin(this.time * 6)) * 1.5;
      }
      const flash = this.time - (r.flash || -9) < 0.3;
      ctx.save();
      ctx.translate((r.x + 0.5) * T, (r.y + 1) * T);
      const s = T / 16;
      ctx.scale(s, s);
      // tavanın altındaysa eğil
      const cx = Math.round(r.x);
      const cy = Math.round(r.y);
      if (Math.abs(r.y - cy) < 0.2 && this._solidAt(cx, cy - 1) && cx >= 0 && cx < this.world.width) ctx.scale(1.06, 0.8);
      if (r.pose === 'ko') ctx.translate(-2, 4.5);   // sırtüstü yerde
      if (r.spin) {
        const sx = Math.cos(r.spin * TAU);
        ctx.scale(Math.abs(sx) < 0.15 ? 0.15 * Math.sign(sx || 1) : sx, 1);
        // dönüş rüzgârı
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, -9 - i * 3.5, 10 - i, 2.4, 0, r.spin * TAU + i, r.spin * TAU + i + 3.6);
          ctx.stroke();
        }
        ctx.restore();
      }
      this._ryuBody(ctx, pose, bob, flash, r);
      ctx.restore();
    }

    _ryuBody(ctx, pose, bob, flash, r) {
      const ink = C.ink;
      const skin = flash ? '#ffffff' : C.skin;
      const gi = flash ? '#ffffff' : C.gi;
      const hipY = -7.6 + bob * 0.5;
      const lean = pose.lean;
      // gövde eksenine göre noktalar
      const rot = (px, py) => {
        const a = lean * DEG;
        const dx = px;
        const dy = py - hipY;
        return [dx * Math.cos(a) - dy * Math.sin(a), hipY + dx * Math.sin(a) + dy * Math.cos(a)];
      };
      const shF = rot(2.6, hipY - 6.2);
      const shB = rot(-2.2, hipY - 6.0);
      const neck = rot(0.4, hipY - 7.2);
      const head = rot(1.0, hipY - 11.6 + bob * 0.2);
      const hipF = [1.6, hipY];
      const hipB = [-1.8, hipY];
      const leg = (hip, ang) => {
        const knee = polar(hip[0], hip[1], ang[0], 4.1);
        const foot = polar(knee[0], knee[1], ang[0] + ang[1], 3.7);
        return [hip, knee, foot];
      };
      const arm = (sh, ang) => {
        const el = polar(sh[0], sh[1], ang[0] + lean, 3.4);
        const hand = polar(el[0], el[1], ang[0] + ang[1] + lean, 3.3);
        return [sh, el, hand];
      };
      const lB = leg(hipB, pose.legB);
      const lF = leg(hipF, pose.legF);
      const aB = arm(shB, pose.armB);
      const aF = arm(shF, pose.armF);

      // bandana kuyrukları (başın arkasında, rüzgârda dalgalanır)
      const wv = Math.sin(this.time * 9) * 1.2;
      const knot = [head[0] - 4.6, head[1] - 1.6];
      ctx.lineCap = 'round';
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(knot[0], knot[1]);
        ctx.quadraticCurveTo(knot[0] - 3, knot[1] + 1 + i * 1.5 + wv, knot[0] - 6.5, knot[1] + 2.5 + i * 2.6 - wv * 0.6);
        ctx.stroke();
        ctx.strokeStyle = i ? C.bandDark : C.band;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // arka kol ve bacak
      limb(ctx, aB, 2.3, flash ? '#ffffff' : C.skinShade, ink);
      this._glove(ctx, aB[2], flash, true);
      limb(ctx, lB, 3.4, flash ? '#ffffff' : C.giShade, ink);
      this._foot(ctx, lB[2], flash);

      // gövde (kolsuz karate kıyafeti)
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(lean * DEG);
      ctx.translate(0, -hipY);
      ctx.fillStyle = gi;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-3.6, hipY - 6.6);
      ctx.lineTo(3.9, hipY - 6.6);
      ctx.lineTo(3.4, hipY + 0.8);
      ctx.lineTo(-3.4, hipY + 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : C.giShade;
      ctx.fillRect(-3.3, hipY - 6.1, 1.4, 6.6);
      // V yaka, göğüs
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(-0.6, hipY - 6.6);
      ctx.lineTo(3.0, hipY - 6.6);
      ctx.lineTo(1.6, hipY - 3.2);
      ctx.closePath();
      ctx.fill();
      // siyah kuşak
      ctx.fillStyle = C.belt;
      ctx.fillRect(-3.6, hipY - 1.2, 7.4, 1.8);
      ctx.beginPath();
      ctx.moveTo(1.8, hipY + 0.4);
      ctx.lineTo(1.0, hipY + 3.2);
      ctx.lineTo(2.2, hipY + 3.0);
      ctx.lineTo(2.6, hipY + 0.6);
      ctx.lineTo(3.6, hipY + 3.0);
      ctx.lineTo(4.4, hipY + 2.6);
      ctx.lineTo(3.2, hipY + 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ön bacak
      limb(ctx, lF, 3.4, gi, ink);
      this._foot(ctx, lF[2], flash);

      // kafa
      this._head(ctx, head, lean, flash, r);

      // ön kol
      limb(ctx, aF, 2.4, skin, ink);
      this._glove(ctx, aF[2], flash, false);

      // hadoken yükü: avuçlar arasında mavi ışık
      if (r.charge) {
        const hx = (aF[2][0] + aB[2][0]) / 2;
        const hy = (aF[2][1] + aB[2][1]) / 2;
        const g = ctx.createRadialGradient(hx, hy, 0.2, hx, hy, 3 + r.charge * 2.5);
        g.addColorStop(0, 'rgba(255,255,255,.95)');
        g.addColorStop(0.4, 'rgba(95,216,255,.8)');
        g.addColorStop(1, 'rgba(42,123,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, 3 + r.charge * 2.5, 0, TAU);
        ctx.fill();
      }
    }

    _glove(ctx, p, flash, back) {
      ctx.fillStyle = flash ? '#ffffff' : back ? C.gloveDark : C.glove;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.9, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    _foot(ctx, p, flash) {
      ctx.fillStyle = flash ? '#ffffff' : C.skin;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p[0] + 0.9, p[1] - 0.2, 2.1, 1.1, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    _head(ctx, c, lean, flash, r) {
      const [x, y] = c;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lean * DEG * 0.6);
      const ink = C.ink;
      // saç (arka, sivri)
      ctx.fillStyle = flash ? '#ffffff' : C.hair;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5.4, 1.2);
      ctx.lineTo(-6.8, -1.4);
      ctx.lineTo(-5.4, -2.4);
      ctx.lineTo(-6.6, -4.6);
      ctx.lineTo(-4.2, -4.8);
      ctx.lineTo(-4.4, -7.0);
      ctx.lineTo(-1.8, -5.8);
      ctx.lineTo(-0.8, -7.8);
      ctx.lineTo(1.0, -5.8);
      ctx.lineTo(3.2, -7.0);
      ctx.lineTo(3.6, -4.8);
      ctx.lineTo(5.6, -4.4);
      ctx.lineTo(5.0, -2.2);
      ctx.lineTo(-2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // yüz
      ctx.fillStyle = flash ? '#ffffff' : C.skin;
      ctx.beginPath();
      ctx.moveTo(-4.6, -2.6);
      ctx.lineTo(4.6, -2.6);
      ctx.quadraticCurveTo(5.6, 1.5, 3.6, 3.9);
      ctx.lineTo(0.4, 4.6);
      ctx.quadraticCurveTo(-4.4, 4.2, -5.0, 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // favori ve yan saç
      ctx.fillStyle = flash ? '#ffffff' : C.hair;
      ctx.beginPath();
      ctx.moveTo(-5.0, -2.6);
      ctx.lineTo(-2.4, -2.6);
      ctx.lineTo(-3.0, 1.0);
      ctx.lineTo(-4.8, 1.4);
      ctx.closePath();
      ctx.fill();
      // kulak
      ctx.fillStyle = flash ? '#ffffff' : C.skinShade;
      ctx.beginPath();
      ctx.ellipse(-1.6, 0.6, 1.0, 1.4, 0, 0, TAU);
      ctx.fill();
      // kırmızı bandana
      ctx.fillStyle = flash ? '#ffffff' : C.band;
      ctx.beginPath();
      ctx.moveTo(-5.6, -3.6);
      ctx.lineTo(5.2, -3.4);
      ctx.lineTo(5.0, -1.6);
      ctx.lineTo(-5.4, -1.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = flash ? '#ffffff' : C.bandDark;
      ctx.fillRect(-5.3, -2.4, 10.2, 0.6);
      // göz, kaş
      const ko = r.pose === 'ko' || r.pose === 'hurt';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.9;
      if (ko) {
        ctx.beginPath();
        ctx.moveTo(1.6, -0.6); ctx.lineTo(3.4, 1.0);
        ctx.moveTo(3.4, -0.6); ctx.lineTo(1.6, 1.0);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1.6, -0.9, 2.2, 1.9);
        ctx.fillStyle = ink;
        ctx.fillRect(2.6, -0.7, 1.1, 1.6);
        ctx.beginPath();
        ctx.moveTo(1.2, -1.4);
        ctx.lineTo(4.2, -1.0);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      // ağız
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      if (r.pose === 'win' || r.pose === 'hadoken' || r.pose === 'shoryuken' || r.pose === 'tatsu' || r.pose === 'punch') {
        ctx.fillStyle = '#7a2a2a';
        ctx.ellipse(3.0, 2.6, 0.9, 0.7, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.moveTo(2.2, 2.7);
        ctx.lineTo(3.8, 2.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---------------- efektler ----------------
    _drawEffects(ctx, layer) {
      const T = this.tile;
      for (const e of this.effects) {
        const k = this.time - e.t0;
        if (e.kind === 'fireball' && layer === 'front') {
          const p = e.dur > 0 ? clamp01(k / e.dur) : 1;
          if (p >= 1) {
            if (e.target !== 'none') this._fireBurst(ctx, e.x1 * T, e.y * T, T, (k - e.dur) / 0.35);
            continue;
          }
          const x = lerp(e.x0, e.x1, p) * T;
          const y = e.y * T;
          // ilk anda biraz büyüyerek doğar
          this._fireball(ctx, x, y, T * Math.min(1, 0.55 + k * 5), k);
        } else if (e.kind === 'flash' && layer === 'front') {
          const p = k / e.dur;
          if (p > 1) continue;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = T * (0.25 + p * 0.55);
          const g = ctx.createRadialGradient(e.x * T, e.y * T, 0, e.x * T, e.y * T, r);
          g.addColorStop(0, 'rgba(255,255,255,' + (1 - p) + ')');
          g.addColorStop(0.4, 'rgba(120,210,255,' + 0.8 * (1 - p) + ')');
          g.addColorStop(1, 'rgba(40,110,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(e.x * T, e.y * T, r, 0, TAU);
          ctx.fill();
          ctx.restore();
        } else if (e.kind === 'spark' && layer === 'front') {
          const p = k / e.dur;
          if (p > 1) continue;
          ctx.save();
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = C.spark;
          star(ctx, e.x * T, e.y * T, T * 0.55 * e.size * (0.6 + p * 0.6), T * 0.18 * e.size, 8, p * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          star(ctx, e.x * T, e.y * T, T * 0.3 * e.size, T * 0.1 * e.size, 8, p * 2 + 0.3);
          ctx.fill();
          ctx.restore();
        } else if (e.kind === 'qcoin' && layer === 'back') {
          const p = k / e.dur;
          if (p > 1) continue;
          const y = (e.y - 0.5 - Math.sin(p * Math.PI) * 1.4) * T;
          ctx.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1;
          this._coin(ctx, e.x * T, y, T * 0.3, k * 18);
          ctx.globalAlpha = 1;
        }
      }
    }

    /** Alevli enerji topu: önü yuvarlak, arkada titreyen alev dilleri. s: hücre boyu. */
    _fireball(ctx, x, y, s, k) {
      const layers = [
        { r: 0.46, tail: 1.25, color: 'rgba(30,80,230,.55)' },
        { r: 0.38, tail: 1.0, color: 'rgba(40,140,255,.9)' },
        { r: 0.29, tail: 0.75, color: '#5fd0ff' },
        { r: 0.2, tail: 0.5, color: '#c8f4ff' }
      ];
      ctx.save();
      // dış parıltı
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 0.95);
      halo.addColorStop(0, 'rgba(120,200,255,.55)');
      halo.addColorStop(1, 'rgba(30,90,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.95, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const N = 28;
      layers.forEach((L, li) => {
        ctx.fillStyle = L.color;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * TAU;                 // 0: ileri (sağ)
          const back = Math.max(0, -Math.cos(a));   // arka tarafta 1'e yaklaşır
          const tongue = Math.sin(a * 5 + k * 34 + li) * 0.5 + Math.sin(a * 3 - k * 21) * 0.35;
          const rr = s * L.r * (1 + back * back * (L.tail * 1.6 + tongue * 0.45 * back));
          const px = x + Math.cos(a) * rr;
          const py = y + Math.sin(a) * rr * (0.82 - back * 0.25);
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      });
      // beyaz sıcak çekirdek ve dönen girdap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.05, y, s * 0.13, s * 0.11, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = s * 0.045;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x - s * 0.02, y, s * 0.22, k * 18, k * 18 + 2.2);
      ctx.stroke();
      ctx.restore();
    }

    /** Ateş topunun çarpınca dağılması. q: 0..1 */
    _fireBurst(ctx, x, y, T, q) {
      if (q >= 1 || q < 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - q;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.3;
        const len = T * (0.35 + q * 0.75);
        ctx.fillStyle = i % 2 ? '#5fd0ff' : '#c8f4ff';
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - 0.22) * T * 0.15, y + Math.sin(a - 0.22) * T * 0.15);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a + 0.22) * T * 0.15, y + Math.sin(a + 0.22) * T * 0.15);
        ctx.closePath();
        ctx.fill();
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, T * (0.3 + q * 0.4));
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(1, 'rgba(60,150,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, T * (0.3 + q * 0.4), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    _drawParticles(ctx) {
      const T = this.tile;
      for (const p of this.particles) {
        const a = 1 - p.t / p.life;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.color;
        if (p.plank) {
          ctx.save();
          ctx.translate(p.x * T, p.y * T);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.r * T, -p.r * T * 0.35, p.r * T * 2, p.r * T * 0.7);
          ctx.restore();
        } else if (p.star) {
          star(ctx, p.x * T, p.y * T, p.r * T * 1.8, p.r * T * 0.6, 4, 0);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x * T, p.y * T, p.r * T * (p.puff ? 1 + (1 - a) : 1), 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawTexts(ctx) {
      const T = this.tile;
      for (const t of this.texts) {
        const p = (this.time - t.t0) / t.dur;
        const big = t.size === 'big';
        const y = (t.y - p * (big ? 0.4 : 0.8)) * T;
        const sc = big ? Math.min(1, 0.4 + p * 4) : 1;
        ctx.save();
        ctx.globalAlpha = p > 0.75 ? (1 - p) * 4 : 1;
        ctx.translate(t.x * T, y);
        ctx.scale(sc, sc);
        ctx.font = (big ? Math.round(T * 0.42) : Math.round(T * 0.26)) + 'px ' + ARCADE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = big ? T * 0.1 : T * 0.07;
        ctx.strokeStyle = C.ink;
        ctx.lineJoin = 'round';
        ctx.strokeText(t.text, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }
    }

    _drawHud(ctx) {
      const T = this.tile;
      if (this.combo) {
        const k = this.time - this.combo.t0;
        if (k > 1.6) { this.combo = null; return; }
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
        const alpha = k > 1.3 ? (1.6 - k) / 0.3 : 1;
        const x = T * 0.4;
        const y = T * 0.55;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';
        const big = Math.round(T * 0.62);
        ctx.font = big + 'px ' + ARCADE;
        ctx.lineWidth = T * 0.14;
        ctx.strokeStyle = C.ink;
        const n = String(this.combo.n);
        ctx.strokeText(n, 0, 0);
        const g = ctx.createLinearGradient(0, 0, 0, big);
        g.addColorStop(0, '#fff36a');
        g.addColorStop(1, '#ff8a1e');
        ctx.fillStyle = g;
        ctx.fillText(n, 0, 0);
        const w = ctx.measureText(n).width;
        ctx.font = Math.round(T * 0.3) + 'px ' + ARCADE;
        ctx.lineWidth = T * 0.09;
        ctx.strokeText('HIT', w + T * 0.12, T * 0.05);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('HIT', w + T * 0.12, T * 0.05);
        ctx.strokeText('KOMBO!', w + T * 0.12, T * 0.36);
        ctx.fillStyle = '#ff5a6e';
        ctx.fillText('KOMBO!', w + T * 0.12, T * 0.36);
        ctx.restore();
      }
    }
  }

  Ryu.Renderer = Renderer;
  Ryu.THEMES = THEMES;

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
