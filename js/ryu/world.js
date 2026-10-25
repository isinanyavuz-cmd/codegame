/*
 * Ryu'nun Kod Macerası — oyun dünyası (saf mantık, DOM yok).
 * Yandan görünüşlü, karolu bir platform dünyası. Ryu tek bir hücrede durur,
 * hep sağa bakar. Her hareket bir "olay" döndürür: Ryu'nun geçtiği kareler
 * (steps) ve bu sırada olan şeyler (fx). Çizici bu olayı oynatır.
 * Bkz. CONTRACT.md ("CodeGame.Ryu.World").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  const Ryu = CodeGame.Ryu = CodeGame.Ryu || {};

  const SOLID = '#=B?u';
  const ENEMIES = {
    e: { type: 'thug', hp: 1, flying: false },
    E: { type: 'brute', hp: 3, flying: false },
    X: { type: 'boss', hp: 4, flying: false },
    b: { type: 'bat', hp: 1, flying: true },
    k: { type: 'spiky', hp: 1, flying: false, spiky: true }   // yalnızca hadoken ile yenilir
  };
  const POLE = 4;            // bayrak direği kaç hücre yüksek
  const JUMP_UP = 2;
  const JUMP_FWD = 2;
  const RISE_UP = 3;         // shoryuken
  const SPIN_FWD = 3;        // tatsumaki
  const FIRE_RANGE = 12;     // hadoken

  const key = (x, y) => x + ',' + y;

  class World {
    constructor(level) {
      if (!level || !Array.isArray(level.map) || level.map.length === 0) {
        throw new Error('Geçersiz bölüm: harita yok');
      }
      const map = level.map.map((row) => String(row));
      this.height = map.length;
      this.width = map.reduce((m, row) => Math.max(m, row.length), 0);
      this.grid = [];
      this.coins = new Set();
      this.enemies = [];
      let start = null;
      let flag = null;
      let questions = 0;
      for (let y = 0; y < this.height; y++) {
        const row = [];
        for (let x = 0; x < this.width; x++) {
          const ch = map[y][x] || '.';
          if (ch === 'S') {
            if (start) throw new Error("Geçersiz bölüm: birden fazla 'S' var");
            start = { x, y };
            row.push('.');
          } else if (ch === 'F') {
            if (flag) throw new Error("Geçersiz bölüm: birden fazla 'F' var");
            flag = { x, y };
            row.push('.');
          } else if (ch === 'o') {
            this.coins.add(key(x, y));
            row.push('.');
          } else if (ENEMIES[ch]) {
            const d = ENEMIES[ch];
            this.enemies.push({ id: this.enemies.length, type: d.type, x, y, hp: d.hp, maxHp: d.hp, flying: d.flying, spiky: !!d.spiky });
            row.push('.');
          } else if (SOLID.indexOf(ch) !== -1 || ch === '^') {
            if (ch === '?') questions++;
            row.push(ch);
          } else {
            row.push('.');
          }
        }
        this.grid.push(row);
      }
      if (!start) throw new Error("Geçersiz bölüm: 'S' (başlangıç) yok");
      if (!flag) throw new Error("Geçersiz bölüm: 'F' (bayrak) yok");
      this.start = start;
      this.flag = flag;
      this.ryu = { x: start.x, y: start.y };
      this.totalCoins = this.coins.size + questions;
      this.collected = 0;
      this.needCombo = level.needCombo || 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.state = 'play';   // 'play' | 'flag' | 'dead' | 'blocked'
      this.reason = null;    // 'fall' | 'spike' | 'enemy' | 'spiky' | 'wall'
      this.actions = 0;
    }

    // ---------------- sorgular ----------------
    /** Arazi: '.', '#', '=', 'B', '?', 'u', '^'. Kenarlar duvar, alt taraf boşluk. */
    cellAt(x, y) {
      if (x < 0 || x >= this.width || y < 0) return '=';
      if (y >= this.height) return '.';
      return this.grid[y][x];
    }
    isSolid(x, y) { return SOLID.indexOf(this.cellAt(x, y)) !== -1; }
    enemyAt(x, y) {
      for (const e of this.enemies) if (e.hp > 0 && e.x === x && e.y === y) return e;
      return null;
    }
    hasCoin(x, y) { return this.coins.has(key(x, y)); }
    isPole(x, y) { return x === this.flag.x && y <= this.flag.y && y > this.flag.y - POLE; }
    coinsLeft() { return this.totalCoins - this.collected; }
    enemiesLeft() { return this.enemies.filter((e) => e.hp > 0).length; }
    atFlag() { return this.state === 'flag'; }
    isWon() { return this.state === 'flag' && this.coinsLeft() === 0 && this.maxCombo >= this.needCombo; }

    // ---------------- hareketler ----------------
    /**
     * Bir hareketi uygular ve olayı döndürür:
     * { type, from, steps: [{x,y,kind}], fx: [{at, kind, ...}], result, reason, hits, combo }
     * fx.at: o etki gerçekleştiğinde kaç adımın tamamlandığı.
     */
    act(type) {
      if (this.state !== 'play') throw new Error('Oyun bitti');
      const ev = { type, from: { x: this.ryu.x, y: this.ryu.y }, steps: [], fx: [], result: 'ok', reason: null, hits: 0, combo: 0 };
      this.actions++;
      switch (type) {
        case 'forward': this._walk(1, ev); break;
        case 'back': this._walk(-1, ev); break;
        case 'jump': this._jump(ev); break;
        case 'punch': this._punch(ev); break;
        case 'hadoken': this._hadoken(ev); break;
        case 'shoryuken': this._shoryuken(ev); break;
        case 'tatsumaki': this._tatsumaki(ev); break;
        default: throw new Error('Bilinmeyen hareket: ' + type);
      }
      if (ev.hits > 0) this.combo += ev.hits;
      else this.combo = 0;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      ev.combo = this.combo;
      ev.result = this.state === 'play' ? 'ok' : this.state;
      ev.reason = this.reason;
      return ev;
    }

    _fx(ev, kind, data) {
      const f = Object.assign({ at: ev.steps.length, kind }, data);
      ev.fx.push(f);
      return f;
    }

    _end(state, reason) {
      this.state = state;
      this.reason = reason || null;
    }

    /** Düşmana 1 vurur; yere serildiyse true. Dikenliye ateş dışında dokunmak Ryu'yu yakar. */
    _damage(enemy, by, ev) {
      if (enemy.spiky && by !== 'fire') {
        this._fx(ev, 'hurt', { x: enemy.x, y: enemy.y, enemy: enemy.id });
        this._end('dead', 'spiky');
        return false;
      }
      enemy.hp--;
      ev.hits++;
      this._fx(ev, 'hit', { x: enemy.x, y: enemy.y, enemy: enemy.id, hp: enemy.hp, ko: enemy.hp <= 0, by });
      return enemy.hp <= 0;
    }

    /** Ryu'yu hücreye taşır, altın toplar, bayrağı kontrol eder. */
    _enter(x, y, kind, ev) {
      this.ryu.x = x;
      this.ryu.y = y;
      ev.steps.push({ x, y, kind });
      const k = key(x, y);
      if (this.coins.has(k)) {
        this.coins.delete(k);
        this.collected++;
        this._fx(ev, 'coin', { x, y });
      }
      if (this.cellAt(x, y) === '^') {
        this._fx(ev, 'hurt', { x, y });
        this._end('dead', 'spike');
        return 'dead';
      }
      if (this.isPole(x, y)) {
        this._fx(ev, 'flag', { x, y });
        this._end('flag');
        return 'flag';
      }
      return 'ok';
    }

    /**
     * Tek kare hareket denemesi.
     * mode: 'walk' | 'jump' | 'rise' (shoryuken) | 'spin' (tatsumaki)
     * Döner: 'ok' | 'blocked' | 'dead' | 'flag'
     */
    _step(dx, dy, mode, ev) {
      const nx = this.ryu.x + dx;
      const ny = this.ryu.y + dy;
      const cell = this.cellAt(nx, ny);
      if (SOLID.indexOf(cell) !== -1) {
        const inside = nx >= 0 && nx < this.width && ny >= 0;
        if (inside && cell === 'B' && (mode === 'rise' || mode === 'spin')) {
          this.grid[ny][nx] = '.';
          this._fx(ev, 'break', { x: nx, y: ny });
          return this._enter(nx, ny, mode, ev);
        }
        if (inside && dy < 0 && cell === '?') {
          this.grid[ny][nx] = 'u';
          this.collected++;
          this._fx(ev, 'qcoin', { x: nx, y: ny });
        } else if (inside && dy < 0) {
          this._fx(ev, 'bump', { x: nx, y: ny });
        }
        return 'blocked';
      }
      const enemy = this.enemyAt(nx, ny);
      if (enemy) {
        if (mode === 'rise' || mode === 'spin') {
          if (!this._damage(enemy, mode, ev)) return this.state === 'play' ? 'blocked' : 'dead';
        } else {
          this._fx(ev, 'hurt', { x: nx, y: ny, enemy: enemy.id });
          this._end('dead', enemy.spiky ? 'spiky' : 'enemy');
          return 'dead';
        }
      }
      return this._enter(nx, ny, mode, ev);
    }

    /** Yerçekimi: Ryu ayağının altında zemin olana dek düşer. Düşmanın üstüne düşerse ezer. */
    _fall(ev) {
      for (;;) {
        const x = this.ryu.x;
        const y = this.ryu.y + 1;
        if (y >= this.height) {
          ev.steps.push({ x, y: this.height + 1, kind: 'fall' });
          this.ryu.y = this.height + 1;
          this._end('dead', 'fall');
          return 'dead';
        }
        if (this.isSolid(x, y)) return 'ok';
        const enemy = this.enemyAt(x, y);
        if (enemy && !this._damage(enemy, 'stomp', ev)) return this.state === 'play' ? 'ok' : 'dead'; // sağ kaldı: üstünde durur
        const r = this._enter(x, y, 'fall', ev);
        if (r !== 'ok') return r;
      }
    }

    _walk(dir, ev) {
      const r = this._step(dir, 0, 'walk', ev);
      if (r === 'blocked') {
        this._fx(ev, 'wall', { x: this.ryu.x + dir, y: this.ryu.y });
        this._end('blocked', 'wall');
        return;
      }
      if (r === 'ok') this._fall(ev);
    }

    _jump(ev) {
      for (let i = 0; i < JUMP_UP; i++) {
        const r = this._step(0, -1, 'jump', ev);
        if (r === 'blocked') break;
        if (r !== 'ok') return;
      }
      for (let i = 0; i < JUMP_FWD; i++) {
        const r = this._step(1, 0, 'jump', ev);
        if (r === 'blocked') break;
        if (r !== 'ok') return;
      }
      this._fall(ev);
    }

    _punch(ev) {
      const x = this.ryu.x + 1;
      const y = this.ryu.y;
      const enemy = this.enemyAt(x, y);
      const f = this._fx(ev, 'punch', { x, y, target: 'none' });
      if (enemy) {
        f.target = 'enemy';
        this._damage(enemy, 'punch', ev);
      } else if (this.cellAt(x, y) === 'B') {
        f.target = 'crate';
        this.grid[y][x] = '.';
        this._fx(ev, 'break', { x, y });
      }
    }

    _hadoken(ev) {
      const y = this.ryu.y;
      const f = this._fx(ev, 'fireball', { x: this.ryu.x, y, toX: this.ryu.x, target: 'none' });
      for (let i = 1; i <= FIRE_RANGE; i++) {
        const x = this.ryu.x + i;
        f.toX = x;
        const enemy = this.enemyAt(x, y);
        if (enemy) {
          f.target = 'enemy';
          this._damage(enemy, 'fire', ev);
          return;
        }
        const cell = this.cellAt(x, y);
        if (cell === 'B' && x < this.width) {
          f.target = 'crate';
          this.grid[y][x] = '.';
          this._fx(ev, 'break', { x, y });
          return;
        }
        if (SOLID.indexOf(cell) !== -1) {
          f.target = 'wall';
          return;
        }
      }
    }

    _shoryuken(ev) {
      for (let i = 0; i < RISE_UP; i++) {
        const r = this._step(0, -1, 'rise', ev);
        if (r === 'blocked') break;
        if (r !== 'ok') return;
      }
      const r = this._step(1, 0, 'rise', ev);
      if (r === 'dead' || r === 'flag') return;
      this._fall(ev);
    }

    _tatsumaki(ev) {
      for (let i = 0; i < SPIN_FWD; i++) {
        const r = this._step(1, 0, 'spin', ev);
        if (r === 'blocked') break;
        if (r !== 'ok') return;
      }
      this._fall(ev);
    }
  }

  Ryu.World = World;
  Ryu.MOVES = ['forward', 'back', 'jump', 'punch', 'hadoken', 'shoryuken', 'tatsumaki'];
  Ryu.RULES = { JUMP_UP, JUMP_FWD, RISE_UP, SPIN_FWD, FIRE_RANGE, POLE };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
