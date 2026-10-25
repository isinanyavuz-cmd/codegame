/*
 * KodRobot — oyun dünyası (saf mantık, DOM yok).
 * Bkz. CONTRACT.md ("CodeGame.World").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  const DIRS = ['N', 'E', 'S', 'W'];
  const DELTA = { N: { dx: 0, dy: -1 }, E: { dx: 1, dy: 0 }, S: { dx: 0, dy: 1 }, W: { dx: -1, dy: 0 } };

  function key(x, y) { return x + ',' + y; }
  function leftOf(dir) { return DIRS[(DIRS.indexOf(dir) + 3) % 4]; }
  function rightOf(dir) { return DIRS[(DIRS.indexOf(dir) + 1) % 4]; }

  class World {
    constructor(level) {
      if (!level || !Array.isArray(level.map) || level.map.length === 0) {
        throw new Error('Geçersiz bölüm: harita yok');
      }
      const map = level.map.map((row) => String(row));
      this.height = map.length;
      this.width = map.reduce((m, row) => Math.max(m, row.length), 0);

      // Hücreleri normalize et: '#', '.', 'G'
      this.grid = [];
      this.gems = new Set();
      let start = null;
      let goal = null;
      for (let y = 0; y < this.height; y++) {
        const row = [];
        for (let x = 0; x < this.width; x++) {
          const ch = map[y][x];
          if (ch === 'S') {
            if (start) throw new Error("Geçersiz bölüm: haritada birden fazla 'S' var");
            start = { x, y };
            row.push('.');
          } else if (ch === 'G') {
            if (goal) throw new Error("Geçersiz bölüm: haritada birden fazla 'G' var");
            goal = { x, y };
            row.push('G');
          } else if (ch === '*') {
            this.gems.add(key(x, y));
            row.push('.');
          } else if (ch === '.') {
            row.push('.');
          } else {
            row.push('#'); // '#', boşluk, eksik hücre vb.
          }
        }
        this.grid.push(row);
      }
      if (!start) throw new Error("Geçersiz bölüm: haritada 'S' (başlangıç) yok");
      if (!goal) throw new Error("Geçersiz bölüm: haritada 'G' (hedef) yok");

      const dir = level.startDir == null ? 'E' : level.startDir;
      if (DIRS.indexOf(dir) === -1) throw new Error('Geçersiz bölüm: startDir N, E, S veya W olmalı');

      this.start = { x: start.x, y: start.y, dir };
      this.goal = goal;
      this.robot = { x: start.x, y: start.y, dir };
      this.totalGems = this.gems.size;
      this.collected = 0;
      this.crashed = false;
    }

    cellAt(x, y) {
      if (y < 0 || y >= this.height || x < 0 || x >= this.width) return '#';
      return this.grid[y][x];
    }

    _free(dir) {
      const d = DELTA[dir];
      return this.cellAt(this.robot.x + d.dx, this.robot.y + d.dy) !== '#';
    }

    move() {
      const d = DELTA[this.robot.dir];
      const nx = this.robot.x + d.dx;
      const ny = this.robot.y + d.dy;
      if (this.cellAt(nx, ny) === '#') {
        this.crashed = true;
        throw new Error('Robot duvara çarptı!');
      }
      this.robot.x = nx;
      this.robot.y = ny;
    }

    turnLeft() { this.robot.dir = leftOf(this.robot.dir); }
    turnRight() { this.robot.dir = rightOf(this.robot.dir); }

    pick() {
      const k = key(this.robot.x, this.robot.y);
      if (!this.gems.has(k)) throw new Error('Burada toplanacak elmas yok!');
      this.gems.delete(k);
      this.collected++;
    }

    isPathAhead() { return this._free(this.robot.dir); }
    isPathLeft() { return this._free(leftOf(this.robot.dir)); }
    isPathRight() { return this._free(rightOf(this.robot.dir)); }
    atGoal() { return this.cellAt(this.robot.x, this.robot.y) === 'G'; }
    hasGem() { return this.gems.has(key(this.robot.x, this.robot.y)); }
    isWon() { return this.atGoal() && this.gems.size === 0; }
  }

  CodeGame.World = World;

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
