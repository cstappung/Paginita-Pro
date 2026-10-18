// Estado de un jugador de la sala que toca en otro navegador, armado con lo
// que llega por el directo (session.js → la malla WebRTC → onRemoteState).
import { HIT, MISSED, DROPPED } from '../core/engine.js';

/* Sus aciertos llegan tarde: lo que tarda la malla, más hasta 100 ms de espera
   al próximo estado (session.js, STATE_INTERVAL), más lo que su canción vaya
   corrida de la tuya. Pintada con tu reloj, su autopista dejaba pasar cada nota
   por la barra y la encendía después: se veía tocando a destiempo. Así que se
   pinta con retraso (`retraso`, session.draw): cada acierto nuevo mide cuánto
   después de su nota llegó, el objetivo sigue el borde de arriba de esas
   medidas (sube rápido, baja lento) y lo pintado se acerca a él sin saltos. */
const RETRASO_INI = 0.12, RETRASO_MAX = 0.8, RETRASO_VEL = 0.15;

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
    this.lag = RETRASO_INI;
    this.lagVis = RETRASO_INI;
    this._lagPerf = null;
  }

  // Segundos de atraso con que se pinta su autopista (cambia a lo más un 15 %)
  retraso(perf) {
    const dt = this._lagPerf === null ? 0 : Math.min(0.1, Math.max(0, (perf - this._lagPerf) / 1000));
    this._lagPerf = perf;
    const paso = RETRASO_VEL * dt;
    this.lagVis += Math.max(-paso, Math.min(paso, this.lag - this.lagVis));
    return this.lagVis;
  }

  _mide(nt, now) {
    const s = now - nt.time;
    // uno muy viejo es un estado que llegó a destiempo (al entrar o tras un corte): no dice nada
    if (!(s >= 0 && s <= RETRASO_MAX)) return;
    this.lag += (s - this.lag) * (s > this.lag ? 0.3 : 0.03);
  }
  multiplier() { return this.mult; }
  comboProgress() { return this.prog; }
  currentSolo() { return this.solo; }
  sustainingMask() { return this.sus; }

  // `now`: tu tiempo de canción; lo que se marca va en el reloj retrasado de su autopista
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
      this._mide(nt, now);
      this.onHitFx?.(nt);
      if (nt.sp >= 0 && !this.phraseFailed[nt.sp] && ++this.phraseHits[nt.sp] === this.phraseTotal[nt.sp]) this.onHitFx?.(nt, 'phrase');
      const t = now - this.lagVis;
      if (this.kind === 'drums') {
        this.laneHitTime[nt.pad + 1] = t;
        this.padHitTime[nt.pad + 1] = t;
      } else if (nt.open) this.laneHitTime[5] = t;
      else for (let f = 0; f < 5; f++) if (nt.frets & (1 << f)) this.laneHitTime[f] = t;
    }
  }
}
