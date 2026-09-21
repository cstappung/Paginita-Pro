(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mina = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LEVELS = { easy: { cols: 10, rows: 8, mines: 10, label: 'FÁCIL' }, medium: { cols: 18, rows: 14, mines: 40, label: 'MEDIO' }, hard: { cols: 24, rows: 20, mines: 99, label: 'DIFÍCIL' } };
  class Game {
    constructor(level = 'easy', random = Math.random) {
      Object.assign(this, LEVELS[level]); this.level = level; this.random = random;
      this.state = 'ready'; this.flags = 0; this.revealed = 0; this.exploded = -1;
      this.cells = Array.from({ length: this.cols * this.rows }, () => ({ mine: false, open: false, flag: false, count: 0 }));
    }
    neighbors(i) {
      const x = i % this.cols, y = Math.floor(i / this.cols), result = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= this.cols || y + dy < 0 || y + dy >= this.rows) continue;
        result.push((y + dy) * this.cols + x + dx);
      }
      return result;
    }
    plant(first) {
      const safe = new Set([first, ...this.neighbors(first)]);
      const pool = this.cells.map((_, i) => i).filter(i => !safe.has(i));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      pool.slice(0, this.mines).forEach(i => { this.cells[i].mine = true; });
      this.cells.forEach((cell, i) => { cell.count = this.neighbors(i).filter(n => this.cells[n].mine).length; });
      this.state = 'playing';
    }
    flag(i) {
      const c = this.cells[i];
      if (!c || c.open || ['won', 'lost'].includes(this.state) || (!c.flag && this.flags === this.mines)) return false;
      c.flag = !c.flag; this.flags += c.flag ? 1 : -1; return true;
    }
    open(i) {
      const c = this.cells[i];
      if (!c || c.flag || ['won', 'lost'].includes(this.state)) return [];
      if (this.state === 'ready') this.plant(i);
      if (c.open) {
        if (!c.count) return [];
        const neighbors = this.neighbors(i);
        if (neighbors.filter(n => this.cells[n].flag).length !== c.count) return [];
        return this.reveal(neighbors.filter(n => !this.cells[n].flag && !this.cells[n].open));
      }
      return this.reveal([i]);
    }
    reveal(indices) {
      const changed = [], queue = [...indices];
      while (queue.length) {
        const i = queue.pop(), c = this.cells[i];
        if (c.open || c.flag) continue;
        c.open = true; changed.push(i);
        if (c.mine) { this.state = 'lost'; this.exploded = i; break; }
        this.revealed++;
        if (!c.count) this.neighbors(i).forEach(n => { if (!this.cells[n].open) queue.push(n); });
      }
      if (this.state !== 'lost' && this.revealed === this.cells.length - this.mines) this.state = 'won';
      return changed;
    }
    get progress() { return this.revealed / (this.cells.length - this.mines); }
  }
  return { Game, LEVELS };
});
