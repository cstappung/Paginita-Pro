// Convierte ticks <-> segundos usando los cambios de tempo del chart.
// `offset` (segundos) desplaza todo el chart respecto al audio (song.ini delay).
export class TempoMap {
  constructor(resolution, tempos, timeSigs, offset = 0) {
    this.resolution = resolution > 0 ? resolution : 192;
    this.offset = offset;
    const sorted = tempos
      .filter((t) => t.uspq > 0 && Number.isFinite(t.uspq))
      .sort((a, b) => a.tick - b.tick);
    if (!sorted.length || sorted[0].tick > 0) sorted.unshift({ tick: 0, uspq: 500000 });

    this.segs = [];
    for (const t of sorted) {
      const last = this.segs[this.segs.length - 1];
      if (last && last.tick === t.tick) {
        last.uspq = t.uspq;
        continue;
      }
      const sec = last ? last.sec + ((t.tick - last.tick) * last.uspq) / 1e6 / this.resolution : 0;
      this.segs.push({ tick: t.tick, uspq: t.uspq, sec });
    }

    this.timeSigs = timeSigs
      .filter((ts) => ts.num > 0 && ts.den > 0)
      .sort((a, b) => a.tick - b.tick);
    if (!this.timeSigs.length || this.timeSigs[0].tick > 0) this.timeSigs.unshift({ tick: 0, num: 4, den: 4 });
  }

  _segByTick(tick) {
    const s = this.segs;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid].tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    return s[lo];
  }

  _segBySec(sec) {
    const s = this.segs;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid].sec <= sec) lo = mid;
      else hi = mid - 1;
    }
    return s[lo];
  }

  tickToSec(tick) {
    const seg = this._segByTick(tick);
    return seg.sec + ((tick - seg.tick) * seg.uspq) / 1e6 / this.resolution + this.offset;
  }

  secToTick(sec) {
    const s = sec - this.offset;
    const seg = this._segBySec(s);
    return seg.tick + ((s - seg.sec) * 1e6 * this.resolution) / seg.uspq;
  }

  beatsBetween(a, b) {
    return (this.secToTick(b) - this.secToTick(a)) / this.resolution;
  }

  bpmAt(sec) {
    return 60e6 / this._segBySec(sec - this.offset).uspq;
  }

  // Líneas de compás / pulso para dibujar en la autopista
  beatLines(endTick) {
    const out = [];
    const ts = this.timeSigs;
    for (let k = 0; k < ts.length; k++) {
      const start = ts[k].tick;
      const stop = k + 1 < ts.length ? ts[k + 1].tick : endTick;
      const beatLen = Math.max(1, (this.resolution * 4) / ts[k].den);
      let b = 0;
      for (let tick = start; tick < stop; tick += beatLen, b++) {
        out.push({ time: this.tickToSec(tick), measure: b % ts[k].num === 0 });
        if (out.length > 200000) return out;
      }
    }
    return out;
  }
}
