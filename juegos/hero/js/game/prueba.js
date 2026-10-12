// La prueba de una partida: lo que hace falta para volver a tocarla y llegar
// al mismo puntaje. No depende del DOM: la usa el juego para grabar y la
// página de Juegos (colabtex/src/juegos/hero.js) para verificar el récord
// antes de guardarlo, con el mismo motor.
//
// Para que repetir dé exactamente lo mismo, el motor ya no avanza al ritmo
// de los cuadros de la pantalla (que cambia de un computador a otro):
//  - avanza en una rejilla fija de la canción, cada PASO décimas de
//    milisegundo (`hasta`). Lo que el motor decide en `update` (fallos, notas
//    HOPO que entran solas, sostenidos, Star Power que se acaba) cae siempre
//    en los mismos instantes;
//  - cada acción (trastes, rasgueo, Star Power, whammy, golpes de batería) se
//    redondea a 0,1 ms y se anota con el punto de la rejilla al que había
//    llegado el motor (`k`). Al repetirla se avanza hasta ese `k` y se aplica
//    con el mismo tiempo, así que el motor recibe las mismas llamadas, en el
//    mismo orden y con los mismos números.
import { createEngine, HIT } from '../core/engine.js';
import { applyNoteMode } from '../core/noteMode.js';

export const PASO = 50; // en décimas de ms: 5 ms
export const Q = 10000; // décimas de ms por segundo
export const VERSION_PRUEBA = 1;
export const VENTANA = 70; // ms, fija en settings.js (FIXED)

// Códigos de acción
const FRET = 0, STRUM = 1, SP = 2, WHAMMY = 3, PAD = 4, SUELTA = 5;

export function aplica(e, op, arg, t) {
  if (op === FRET) e.fret(arg, t);
  else if (op === STRUM) e.strum(t);
  else if (op === SP) e.spAction(t);
  else if (op === WHAMMY) e.whammy = !!arg;
  else if (op === PAD) {
    const c = arg % 3;
    e.pad(Math.floor(arg / 3) - 1, t, c === 0 ? null : c === 1);
  } else if (op === SUELTA) e.held = 0;
}

// Opciones del motor que salen de la prueba (y de los ajustes al grabar)
export function opcionesMotor(cab) {
  return { hitWindow: VENTANA / 1000, expertPlus: !!cab.xp, proCymbals: !!cab.pc, openAuto: cab.m === 'taps' };
}

export class Grabadora {
  constructor(engine, cab) {
    this.e = engine;
    this.cab = cab; // {id, p, d, m, xp, pc}
    this.k = -1;
    this.ev = [];
  }

  // Avanza la rejilla hasta el tiempo de canción t (s)
  hasta(t) {
    const kmax = Math.floor(Math.round(t * Q) / PASO);
    while (this.k < kmax) {
      this.k++;
      this.e.update((this.k * PASO) / Q);
    }
  }

  _accion(op, arg, t) {
    const u = Math.round(t * Q);
    this.hasta(u / Q);
    this.ev.push([this.k, u, op, arg]);
    aplica(this.e, op, arg, u / Q);
  }

  fret(mask, t) { this._accion(FRET, mask & 63, t); }
  strum(t) { this._accion(STRUM, 0, t); }
  sp(t) { this._accion(SP, 0, t); }
  whammy(on, t) { this._accion(WHAMMY, on ? 1 : 0, t); }
  pad(pad, t, cymbal = null) { this._accion(PAD, (pad + 1) * 3 + (cymbal === null ? 0 : cymbal ? 1 : 2), t); }
  suelta(t) { this._accion(SUELTA, 0, t); }

  // El texto de la prueba: la cabecera y los sucesos, con diferencias en base 36
  texto() {
    let pk = 0, pu = 0;
    const partes = [];
    for (const [k, u, op, arg] of this.ev) {
      partes.push(`${(k - pk).toString(36)},${(u - pu).toString(36)},${(op * 64 + arg).toString(36)}`);
      pk = k;
      pu = u;
    }
    const c = this.cab;
    return JSON.stringify({ v: VERSION_PRUEBA, id: c.id, p: c.p, d: c.d, m: c.m, xp: c.xp ? 1 : 0, pc: c.pc ? 1 : 0, w: VENTANA, k: this.k, e: partes.join(';') });
  }
}

export function leePrueba(texto) {
  const o = typeof texto === 'string' && texto.length < 400000 ? JSON.parse(texto) : null;
  if (!o || o.v !== VERSION_PRUEBA || typeof o.e !== 'string' || !Number.isSafeInteger(o.k)) throw new Error('prueba ilegible');
  const ev = [];
  let k = 0, u = 0;
  if (o.e) {
    for (const s of o.e.split(';')) {
      const [a, b, c] = s.split(',').map((x) => parseInt(x, 36));
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || a < 0) throw new Error('suceso ilegible');
      k += a;
      u += b;
      ev.push([k, u, c >> 6, c & 63]);
    }
  }
  return { cab: o, ev };
}

// Vuelve a tocar la prueba sobre la canción ya leída (song de parseSongFile).
// Devuelve las estadísticas del motor y el desvío de cada acierto respecto a su
// nota (para reconocer un bot).
export function rehace(song, texto) {
  const { cab, ev } = leePrueba(texto);
  if (cab.w !== VENTANA) throw new Error('ventana de acierto distinta');
  const raw = song.parts?.[cab.p]?.[cab.d];
  if (!raw) throw new Error('la canción no tiene esa parte');
  const track = applyNoteMode(raw, cab.m || 'normal');
  const e = createEngine(track, song.tempo, opcionesMotor(cab));
  const desvios = [];
  e.listener = (type, i, t) => {
    // las abiertas en «todo taps» entran solas en la rejilla: no dicen nada de quien toca
    if (type === 'hit' && !e.notes[i].open) desvios.push(t - e.notes[i].time);
  };
  const g = new Grabadora(e, cab);
  for (const [k, u, op, arg] of ev) {
    if (k < g.k || k > cab.k) throw new Error('sucesos fuera de orden');
    while (g.k < k) {
      g.k++;
      e.update((g.k * PASO) / Q);
    }
    aplica(e, op, arg, u / Q);
  }
  while (g.k < cab.k) {
    g.k++;
    e.update((g.k * PASO) / Q);
  }
  const ultima = track.notes.length ? track.notes[track.notes.length - 1].time : 0;
  return { stats: e.stats(), cab, desvios, completa: (cab.k * PASO) / Q >= ultima, hits: e.noteState.filter((s) => s === HIT).length };
}

// ¿Toca como un programa? Un humano reparte sus aciertos varias decenas de
// milisegundos alrededor de cada nota; el bot del juego (y un script que
// mande teclas a la hora exacta) acierta todas a menos de un par de ms.
export function pareceBot(desvios) {
  if (desvios.length < 60) return false;
  const exactos = desvios.filter((d) => Math.abs(d) < 0.002).length;
  return exactos / desvios.length >= 0.9;
}
