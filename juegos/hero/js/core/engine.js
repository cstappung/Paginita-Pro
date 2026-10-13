// Motor de juego al estilo Clone Hero. No depende del DOM: lo usa el navegador
// y también el script de pruebas en Node.
import { NOTE_STRUM, NOTE_HOPO, NOTE_TAP } from './constants.js';
import { popcount } from './songParser.js';

// Estados de nota
export const PENDING = 0, HIT = 1, MISSED = 2, DROPPED = 3, SKIPPED = 4;

const STRUM_LENIENCY = 0.05; // rasgueo "en espera" mientras terminas de pisar el acorde
const HOPO_STRUM_GRACE = 0.08; // rasgueo extra justo después de un HOPO no rompe el combo
const SP_DRAIN_BEATS = 32; // la barra completa dura 32 pulsos (8 compases en 4/4)

// Umbrales de estrellas (puntuación / puntuación base a 1x)
const STAR_THRESHOLDS = [0.21, 0.46, 0.77, 1.85, 3.08, 4.52];

class EngineBase {
  constructor(track, tempo, opts = {}) {
    this.track = track;
    this.notes = track.notes;
    this.tempo = tempo;
    this.front = opts.hitWindow ?? 0.07;
    this.back = opts.hitWindow ?? 0.07;
    this.maxMult = 4;
    const n = this.notes.length;
    this.noteState = new Uint8Array(n);
    this.next = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.overhits = 0;
    this.sp = 0;
    this.spActive = false;
    this.spPhrasesHit = 0;
    this.lastTime = null;
    this.listener = null;
    this.laneHitTime = new Float64Array(8).fill(-100);
    this.finished = false;

    const np = track.spPhrases.length;
    this.phraseTotal = new Uint16Array(np);
    this.phraseHits = new Uint16Array(np);
    this.phraseFailed = new Uint8Array(np);
    const ns = track.solos.length;
    this.soloTotal = new Uint16Array(ns);
    this.soloHits = new Uint16Array(ns);
    this.soloIdx = 0;
    this.soloBonus = 0;
  }

  _countPhrases() {
    let total = 0;
    for (let i = 0; i < this.notes.length; i++) {
      if (this.noteState[i] === SKIPPED) continue;
      const nt = this.notes[i];
      total++;
      if (nt.sp >= 0) this.phraseTotal[nt.sp]++;
      if (nt.solo >= 0) this.soloTotal[nt.solo]++;
    }
    this.totalNotes = total;
  }

  emit(type, a, b) {
    this.listener?.(type, a, b);
  }

  multiplier() {
    const base = Math.min(this.maxMult, 1 + Math.floor(this.combo / 10));
    return this.spActive ? base * 2 : base;
  }

  comboProgress() {
    if (1 + Math.floor(this.combo / 10) >= this.maxMult) return 1;
    return (this.combo % 10) / 10;
  }

  _hitCommon(i, t, gems) {
    const nt = this.notes[i];
    this.noteState[i] = HIT;
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.hitCount++;
    this.score += 50 * gems * this.multiplier();
    if (nt.sp >= 0 && !this.phraseFailed[nt.sp]) {
      if (++this.phraseHits[nt.sp] === this.phraseTotal[nt.sp]) {
        this.sp = Math.min(1, this.sp + 0.25);
        this.spPhrasesHit++;
        this.emit('spPhrase', nt.sp, i);
      }
    }
    if (nt.solo >= 0) this.soloHits[nt.solo]++;
    if (this.combo % 50 === 0) this.emit('streak', this.combo, t);
  }

  _missCommon(i, t) {
    const nt = this.notes[i];
    this.noteState[i] = MISSED;
    this.missCount++;
    if (nt.sp >= 0) this.phraseFailed[nt.sp] = 1;
    this.breakCombo(t);
    this.emit('miss', i, t);
  }

  breakCombo(t) {
    const had = this.combo;
    this.combo = 0;
    this.emit('comboBreak', had, t);
  }

  activateSP(t) {
    if (this.spActive || this.sp < 0.5) return false;
    this.spActive = true;
    this.emit('spActivate', 0, t);
    return true;
  }

  _advance(t) {
    if (this.lastTime === null) this.lastTime = t;
    if (t <= this.lastTime) return 0;
    const beats = this.tempo.beatsBetween(this.lastTime, t);
    if (this.spActive) {
      this.sp -= beats / SP_DRAIN_BEATS;
      if (this.sp <= 0) {
        this.sp = 0;
        this.spActive = false;
        this.emit('spEnd', 0, t);
      }
    }
    const solos = this.track.solos;
    while (this.soloIdx < solos.length && t > solos[this.soloIdx].end + this.back + 0.05) {
      const k = this.soloIdx++;
      if (!this.soloTotal[k]) continue;
      const bonus = this.soloHits[k] * 100;
      this.soloBonus += bonus;
      this.score += bonus;
      this.emit('soloEnd', k, { hits: this.soloHits[k], total: this.soloTotal[k], bonus });
    }
    this.lastTime = t;
    return beats;
  }

  _processMisses(t) {
    const n = this.notes.length;
    while (this.next < n) {
      const st = this.noteState[this.next];
      if (st !== PENDING) {
        this.next++;
        continue;
      }
      if (this.notes[this.next].time + this.back < t) {
        this._missCommon(this.next, t);
        this.next++;
      } else break;
    }
  }

  currentSolo(t) {
    const s = this.track.solos[this.soloIdx];
    if (!s || t < s.start - 0.5) return null;
    return { hits: this.soloHits[this.soloIdx], total: this.soloTotal[this.soloIdx] };
  }

  stars() {
    const ratio = this.baseScore > 0 ? this.score / this.baseScore : 0;
    let s = 0;
    for (const th of STAR_THRESHOLDS) if (ratio >= th) s++;
    return s;
  }

  stats() {
    return {
      score: Math.floor(this.score),
      stars: this.stars(),
      hits: this.hitCount,
      total: this.totalNotes,
      misses: this.missCount,
      accuracy: this.totalNotes ? this.hitCount / this.totalNotes : 0,
      bestCombo: this.bestCombo,
      spPhrases: this.spPhrasesHit,
      spTotal: this.track.spPhrases.length,
      overhits: this.overhits,
      fc: this.missCount === 0 && this.overhits === 0 && this.hitCount === this.totalNotes,
    };
  }
}

// ============================ GUITARRA / BAJO / TECLADO ============================
// Acciones: fret(mask), strum(), sp(), whammy(bool)
export class GuitarEngine extends EngineBase {
  constructor(track, tempo, opts = {}) {
    super(track, tempo, opts);
    this.kind = 'guitar';
    this.held = 0;
    this.fresh = false; // hubo cambio de trastes desde el último acierto
    this.pendingStrum = -1;
    this.lastFretHit = -100;
    this.sustains = [];
    this.whammy = false;
    this.overstrums = 0;
    // "Todo taps": una nota abierta se acierta sola si no pulsas ningún traste
    this.openAuto = !!opts.openAuto;
    this._countPhrases();
    let base = 0;
    for (const nt of this.notes) {
      base += 50 * nt.gems;
      for (const s of nt.sus) base += 25 * Math.max(1, popcount(s.mask)) * Math.max(0, (s.endTick - nt.tick) / tempo.resolution);
    }
    this.baseScore = base;
  }

  static matches(nt, held) {
    if (nt.open) return held === 0;
    if (nt.gems > 1) return held === nt.frets;
    return held !== 0 && 31 - Math.clz32(held) === 31 - Math.clz32(nt.frets);
  }

  // Sostenido extendido (como Clone Hero): los trastes de un sostenido que
  // sigue pisado no cuentan al leer la nota nueva. Sin esto, con el amarillo
  // largo apretado, un verde o un rojo encima no entraba nunca (el traste más
  // alto era el amarillo) y soltarlo cortaba el sostenido.
  _matches(nt) {
    if (GuitarEngine.matches(nt, this.held)) return true;
    const sus = this.heldSustainMask();
    return sus !== 0 && GuitarEngine.matches(nt, this.held & ~sus);
  }

  heldSustainMask() {
    let m = 0;
    for (const s of this.sustains) if (!s.open && (this.held & s.mask) === s.mask) m |= s.mask;
    return m;
  }

  _firstPendingInWindow(t) {
    for (let i = this.next; i < this.notes.length; i++) {
      if (this.noteState[i] !== PENDING) continue;
      return this.notes[i].time - this.front <= t ? i : -1;
    }
    return -1;
  }

  _hit(i, t) {
    const nt = this.notes[i];
    this._hitCommon(i, t, nt.gems);
    if (nt.open) this.laneHitTime[5] = t;
    else for (let f = 0; f < 5; f++) if (nt.frets & (1 << f)) this.laneHitTime[f] = t;
    for (const s of nt.sus) {
      this.sustains.push({ i, mask: s.mask, open: nt.open, end: s.endTime, last: nt.time, gems: Math.max(1, popcount(s.mask)), sp: nt.sp });
    }
    this.fresh = false;
    this.emit('hit', i, t);
  }

  update(t) {
    if (this.lastTime !== null && t < this.lastTime) t = this.lastTime;
    if (this.pendingStrum >= 0) this._resolvePendingStrum(t);
    this._processMisses(t);
    if (this.fresh) this._tryFretHit(t);
    if (this.openAuto && this.held === 0) this._tryOpenAuto(t);
    const beats = this._advanceSustainsAndTime(t);
    return beats;
  }

  _advanceSustainsAndTime(t) {
    const prevT = this.lastTime ?? t;
    const mult = this.multiplier();
    for (let k = this.sustains.length - 1; k >= 0; k--) {
      const s = this.sustains[k];
      const ok = s.open || (this.held & s.mask) === s.mask;
      if (!ok && t < s.end - 0.04) {
        this.noteState[s.i] = DROPPED;
        this.sustains.splice(k, 1);
        this.emit('drop', s.i, t);
        continue;
      }
      const tEnd = Math.min(t, s.end);
      if (tEnd > s.last) {
        const beats = this.tempo.beatsBetween(s.last, tEnd);
        this.score += beats * 25 * s.gems * mult;
        if (this.whammy && s.sp >= 0 && !this.phraseFailed[s.sp]) this.sp = Math.min(1, this.sp + beats / 30);
        s.last = tEnd;
      }
      if (t >= s.end) this.sustains.splice(k, 1);
    }
    this._advance(t);
    return t - prevT;
  }

  _tryFretHit(t) {
    const i = this._firstPendingInWindow(t);
    if (i < 0) return;
    const nt = this.notes[i];
    if (nt.type === NOTE_STRUM) return;
    if (nt.type === NOTE_HOPO && this.combo === 0) return;
    if (!this._matches(nt)) return;
    this._hit(i, t);
    this.lastFretHit = t;
    this.pendingStrum = -1;
  }

  _tryOpenAuto(t) {
    const i = this._firstPendingInWindow(t);
    if (i < 0) return;
    const nt = this.notes[i];
    if (nt.open && nt.time <= t) this._hit(i, t);
  }

  _strumHit(t) {
    for (let i = this.next; i < this.notes.length && this.notes[i].time - this.front <= t; i++) {
      if (this.noteState[i] !== PENDING) continue;
      if (this._matches(this.notes[i])) {
        for (let k = this.next; k < i; k++) if (this.noteState[k] === PENDING) this._missCommon(k, t);
        this._hit(i, t);
        return true;
      }
    }
    return false;
  }

  _resolvePendingStrum(t) {
    if (this._strumHit(t)) {
      this.pendingStrum = -1;
      return;
    }
    if (t - this.pendingStrum > STRUM_LENIENCY) {
      this.pendingStrum = -1;
      this._overstrum(t);
    }
  }

  _overstrum(t) {
    this.overstrums++;
    this.overhits++;
    this.breakCombo(t);
    this.emit('overstrum', 0, t);
  }

  fret(mask, t) {
    this.update(t);
    if (mask === this.held) return;
    this.held = mask;
    this.fresh = true;
    if (this.pendingStrum >= 0) {
      if (this._strumHit(t)) {
        this.pendingStrum = -1;
        this.fresh = false;
        return;
      }
    }
    this._tryFretHit(t);
  }

  strum(t) {
    this.update(t);
    if (this._strumHit(t)) {
      this.pendingStrum = -1;
      return;
    }
    if (t - this.lastFretHit < HOPO_STRUM_GRACE) {
      this.lastFretHit = -100;
      return;
    }
    if (this.pendingStrum >= 0) {
      // segundo rasgueo sin nota: el primero cuenta como fallo
      this.pendingStrum = -1;
      this._overstrum(t);
      return;
    }
    const i = this._firstPendingInWindow(t + STRUM_LENIENCY);
    if (i >= 0) this.pendingStrum = t;
    else this._overstrum(t);
  }

  spAction(t) {
    this.update(t);
    this.activateSP(t);
  }

  sustainingMask() {
    let m = 0;
    for (const s of this.sustains) m |= s.open ? 32 : s.mask;
    return m;
  }
}

// ============================ BATERÍA ============================
// Acciones: pad(pad, cymbal?) con pad -1 = bombo
export class DrumEngine extends EngineBase {
  constructor(track, tempo, opts = {}) {
    super(track, tempo, opts);
    this.kind = 'drums';
    this.proCymbals = !!opts.proCymbals;
    if (!opts.expertPlus) {
      for (let i = 0; i < this.notes.length; i++) if (this.notes[i].double) this.noteState[i] = SKIPPED;
    }
    this._countPhrases();
    this.baseScore = 50 * this.totalNotes;
    this.padHitTime = new Float64Array(7).fill(-100);
  }

  update(t) {
    if (this.lastTime !== null && t < this.lastTime) t = this.lastTime;
    this._processMisses(t);
    this._advance(t);
  }

  pad(pad, t, cymbal = null) {
    this.update(t);
    this.padHitTime[pad + 1] = t;
    for (let i = this.next; i < this.notes.length && this.notes[i].time - this.front <= t; i++) {
      if (this.noteState[i] !== PENDING) continue;
      const nt = this.notes[i];
      if (nt.pad !== pad) continue;
      if (this.proCymbals && cymbal !== null && nt.cymbal !== cymbal) continue;
      this._hitCommon(i, t, 1);
      this.laneHitTime[pad + 1] = t;
      this.emit('hit', i, t);
      return;
    }
    this.overhits++;
    this.emit('overhit', pad, t);
  }

  spAction(t) {
    this.update(t);
    this.activateSP(t);
  }
}

export function createEngine(track, tempo, opts) {
  return track.kind === 'drums' ? new DrumEngine(track, tempo, opts) : new GuitarEngine(track, tempo, opts);
}

// ============================ BOT ============================
// Juega perfecto a través de las mismas acciones que un jugador humano.
export class Bot {
  constructor(engine) {
    this.engine = engine;
    this.idx = 0;
  }

  update(t) {
    const e = this.engine;
    const notes = e.notes;
    while (this.idx < notes.length && notes[this.idx].time <= t) {
      const i = this.idx++;
      const nt = notes[i];
      if (e.noteState[i] !== PENDING) continue;
      const at = Math.max(nt.time, e.lastTime ?? nt.time);
      if (e.kind === 'drums') {
        e.pad(nt.pad, at, nt.cymbal);
        continue;
      }
      // sigue pisando los sostenidos que suenan si la nota nueva no los usa
      // (update antes: uno que termina justo en esta nota ya no cuenta)
      e.update(at);
      const sus = e.heldSustainMask();
      const keep = nt.open || (nt.frets & sus) ? 0 : sus;
      const want = (nt.open ? 0 : nt.frets) | keep;
      if (nt.type !== NOTE_STRUM && e.held === want) e.fret(keep || (want === 0 ? 16 : 0), at);
      e.fret(want, at);
      if (e.noteState[i] === PENDING) e.strum(at);
    }
    if (e.kind === 'guitar' && e.spActive === false && e.sp >= 0.5) e.spAction(t);
  }
}
