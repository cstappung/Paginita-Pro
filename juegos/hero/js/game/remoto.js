// Estado de un jugador de la sala que toca en otro navegador, armado con lo
// que llega por el directo (session.js → la malla WebRTC → onRemoteState).
import { HIT, MISSED, DROPPED } from '../core/engine.js';

// Estado de un jugador remoto reconstruido a partir de los mensajes de red
export class RemoteState {
  constructor(track, kind) {
    this.kind = kind;
    this.track = track;
    this.notes = track.notes;
    this.noteState = new Uint8Array(track.notes.length);
    this.held = 0;
    this.laneHitTime = new Float64Array(8).fill(-100);
    this.padHitTime = new Float64Array(7).fill(-100);
    this.score = 0;
    this.combo = 0;
    this.mult = 1;
    this.prog = 0;
    this.sp = 0;
    this.spActive = false;
    this.solo = null;
    this.sus = 0;
    this.onHitFx = null;
    const np = track.spPhrases.length;
    this.phraseFailed = new Uint8Array(np);
    this.phraseHits = new Uint16Array(np);
    this.phraseTotal = new Uint16Array(np);
    for (const nt of track.notes) if (nt.sp >= 0 && !nt.double) this.phraseTotal[nt.sp]++;
  }
  multiplier() { return this.mult; }
  comboProgress() { return this.prog; }
  currentSolo() { return this.solo; }
  sustainingMask() { return this.sus; }

  apply(m, now) {
    this.score = m.s;
    this.combo = m.c;
    this.mult = m.m;
    this.prog = m.p;
    this.sp = m.sp;
    if (m.sa && !this.spActive) this.onHitFx?.(null, 'spActivate');
    this.spActive = !!m.sa;
    this.held = m.h || 0;
    this.sus = m.su || 0;
    this.solo = m.so || null;
    // El directo va por un canal que no reenvía lo perdido: cada estado trae
    // los últimos sucesos (`ev`), así que un suceso puede llegar varias veces.
    // Una nota solo avanza (pendiente → acertada → soltada, o → fallada): un
    // sostenido soltado viaja como [i, HIT] y luego [i, DROPPED], y volver a
    // aplicar el HIT en cada estado encendía llamas y saltos del traste diez
    // veces por segundo en un carril sin notas.
    for (const [i, st] of m.ev || []) {
      if (!Number.isInteger(i) || i < 0 || i >= this.noteState.length || !(st > this.noteState[i]) || st > DROPPED) continue;
      this.noteState[i] = st;
      const nt = this.notes[i];
      if (st === MISSED && nt.sp >= 0) this.phraseFailed[nt.sp] = 1;
      if (st !== HIT) continue;
      this.onHitFx?.(nt);
      if (nt.sp >= 0 && !this.phraseFailed[nt.sp] && ++this.phraseHits[nt.sp] === this.phraseTotal[nt.sp]) this.onHitFx?.(nt, 'phrase');
      if (this.kind === 'drums') {
        this.laneHitTime[nt.pad + 1] = now;
        this.padHitTime[nt.pad + 1] = now;
      } else if (nt.open) this.laneHitTime[5] = now;
      else for (let f = 0; f < 5; f++) if (nt.frets & (1 << f)) this.laneHitTime[f] = now;
    }
  }
}
