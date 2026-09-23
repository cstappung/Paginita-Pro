/* Sonidos de los juegos — sintetizados, no grabados.
 *
 * Tres decisiones, y las tres se explican solas en cuanto se intenta lo
 * contrario:
 *
 * 1. NO HAY ARCHIVOS DE AUDIO (salvo el tema del Escondite). Efectos y
 *    música salen de `juegos/audio/chip.js`, un chip de 8 bits hecho con
 *    Web Audio, y las canciones son texto en `juegos/audio/temas.js`: unas
 *    decenas de líneas frente a los megas que pesaría una carpeta de .mp3
 *    que además habría que servir, cachear y esperar.
 *
 * 2. EL `AudioContext` NACE EN EL PRIMER GESTO, no al cargar la página.
 *    Un contexto creado sin que nadie haya tocado nada arranca
 *    `suspended` en todos los navegadores actuales, y el primer sonido se
 *    pierde sin decir nada. Aquí se crea perezosamente, en la primera
 *    llamada — que siempre viene detrás de un clic —, y si aun así llega
 *    suspendido se le pide `resume()`.
 *
 * 3. TODO FALLA EN SILENCIO. Un navegador sin Web Audio, una política que
 *    bloquea el audio o una pestaña en segundo plano no pueden tumbar una
 *    partida: cada función está envuelta y no lanza nunca. Un juego sin
 *    sonido se juega; un juego que revienta al ganar, no.
 *
 * El silencio se recuerda en `localStorage` y no en la nube: es una
 * preferencia de este ordenador y de estos altavoces, no de la cuenta.
 */
"use strict";
import Chip from "../../../juegos/audio/chip.js";
import Temas from "../../../juegos/audio/temas.js";

const LLAVE = "jg.sonido";

let ctx = null;
let apagado = leerApagado();

function leerApagado() {
  try { return localStorage.getItem(LLAVE) === "0"; } catch (e) { return false; }
}

export const silenciado = () => apagado;

export function silenciar(v) {
  apagado = !!v;
  try { localStorage.setItem(LLAVE, apagado ? "0" : "1"); } catch (e) {}
  return apagado;
}

/* Un solo contexto para efectos y música: el silencio de los efectos no
   puede apagar la música, así que `motor` pregunta por él y `contexto` no. */
function motor() { return apagado ? null : contexto(); }
function contexto() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch (e) { return null; }
}

/* Los efectos son de consola de 8 bits: onda de pulso, barridos y ruido de
   registro de desplazamiento, del mismo `Chip` que toca la música. Así un
   «gana» suena de la misma familia que el tema que tiene debajo, en vez de
   un pitido de seno pegado encima de otra cosa. */
let bus = null, busFx = null;
function fx() {
  const a = motor();
  if (!a) return null;
  if (!busFx) { busFx = a.createGain(); busFx.gain.value = 0.9; busFx.connect(a.destination); }
  return a;
}
const P = (a, t, f, dur, o = {}) => Chip.voz(a, busFx, Object.assign({ t, f, dur, vol: 0.1, onda: "p25", sus: 0.8 }, o));
const N = (a, t, dur, o = {}) => Chip.ruido(a, busFx, Object.assign({ t, dur, vol: 0.12 }, o));
const H = Chip.hz;

/* El repertorio. Los nombres dicen qué pasó, no cómo suena: así se
   puede cambiar el timbre de «gana» sin tocar ningún juego. */
const REPERTORIO = {
  clic:     (a, t) => P(a, t, 1568, 0.03, { onda: "p50", vol: 0.05 }),
  carta:    (a, t) => { N(a, t, 0.09, { vol: 0.09, corto: false, tono: 3, tono1: 1.2 });
                        P(a, t + 0.02, 1760, 0.03, { onda: "p12", vol: 0.04 }); },
  /* El timbre de «te toca»: dos notas rápidas hacia arriba, como un
     «¿hola?». Solo suena con la pestaña escondida. */
  turno:    (a, t) => { P(a, t, H(79), 0.06, { onda: "p50", vol: 0.08 });
                        P(a, t + 0.08, H(86), 0.14, { onda: "p50", vol: 0.08, sus: 0.6 }); },
  ficha:    (a, t) => P(a, t, 440, 0.08, { f1: 990, onda: "p50", vol: 0.08 }),
  entra:    (a, t) => [72, 76, 79, 84].forEach((n, k) => P(a, t + k * 0.045, H(n), 0.05, { onda: "p50", vol: 0.07 })),
  /* La moneda: si y mi, la segunda larga. Dos notas bastan para decir «bien». */
  gana:     (a, t) => { P(a, t, H(83), 0.07, { vol: 0.09 }); P(a, t + 0.07, H(88), 0.22, { vol: 0.09, sus: 0.5 }); },
  pierde:   (a, t) => { P(a, t, 392, 0.1, { f1: 330, onda: "p50", vol: 0.08 });
                        P(a, t + 0.11, 311, 0.2, { f1: 196, onda: "p50", vol: 0.08 }); },
  empate:   (a, t) => { N(a, t, 0.55, { vol: 0.09, tono: 0.7, tono1: 0.25 });
                        P(a, t, 300, 0.4, { f1: 170, onda: "tri", vol: 0.1 }); },
  /* El golpe del 10, 11 o 12: explosión de ruido que cae y un bombo de
     triángulo. Es el único efecto deliberadamente más fuerte que los demás,
     porque marca justo lo que la animación está celebrando. */
  golpe:    (a, t) => { N(a, t, 0.5, { vol: 0.2, tono: 1.1, tono1: 0.18 });
                        P(a, t, 190, 0.32, { f1: 45, onda: "tri", vol: 0.22, sus: 0.6 });
                        P(a, t, 1200, 0.16, { f1: 200, onda: "p12", vol: 0.05 }); },
  victoria: (a, t) => {
    [[72, 0, .09], [76, .1, .09], [79, .2, .09], [84, .3, .16], [79, .48, .08], [84, .58, .5]]
      .forEach(([n, d, l]) => { P(a, t + d, H(n), l, { vol: 0.09 }); P(a, t + d, H(n - 12), l, { onda: "p12", vol: 0.04 }); });
    P(a, t + 0.3, H(48), 0.8, { onda: "tri", vol: 0.14, sus: 0.9 });
  },
  derrota:  (a, t) => {
    [[67, 0], [66, .16], [65, .32]].forEach(([n, d]) => P(a, t + d, H(n), 0.14, { onda: "p50", vol: 0.07 }));
    P(a, t + 0.48, H(64), 0.6, { onda: "p50", vol: 0.07, vib: 0.02, sus: 0.8 });
    P(a, t + 0.48, H(40), 0.6, { onda: "tri", vol: 0.14, sus: 0.9 });
  }
};

/* Lo único que exportan los juegos. Nunca lanza: ver la decisión 3. */
export function suena(nombre) {
  try {
    const a = motor();
    if (!a) return;
    const f = REPERTORIO[nombre];
    if (f && fx()) f(a, a.currentTime + 0.01);
  } catch (e) { /* un sonido que falla no puede tumbar una partida */ }
}


/* La música. Cada juego tiene su tema en el cancionero compartido
   (`juegos/audio/temas.js`) y lo toca un `Chip.Reproductor`, que agenda un
   poco por delante del reloj de audio: el temporizador solo lo despierta, no
   marca el compás, así que un `setInterval` que llega tarde no desafina nada.
   El Escondite es la excepción: su tema es una grabación, Midnight Pulse. */
const TEMAS = Temas.temas;
let pistaEscondite = null;
let tema = "", timer = null, desbloqueado = false, rep = null;
let volumen = 0.3, musicaOn = true;
let ajuste = { tempo: 1, capas: null };
try {
  musicaOn = localStorage.getItem("jg.musica") !== "0";
  const guardado = localStorage.getItem("jg.volumen");
  if (guardado !== null && Number.isFinite(Number(guardado))) volumen = Math.max(0, Math.min(1, Number(guardado)));
} catch (_) {}
const GANANCIA = 0.5;
export const musicaActiva = () => musicaOn;
export const volumenMusica = () => volumen;
export function configurarMusica(on, v = volumen) {
  musicaOn = !!on; volumen = Math.max(0, Math.min(1, Number(v) || 0));
  try { localStorage.setItem("jg.musica", on ? "1" : "0"); localStorage.setItem("jg.volumen", String(volumen)); } catch (_) {}
  if (bus && ctx) bus.gain.setTargetAtTime(volumen * GANANCIA, ctx.currentTime, 0.05);
  sincronizaMusica();
}
export function ambientar(juego) {
  const siguiente = juego === "escondite" || TEMAS[juego] ? juego : "";
  if (tema !== siguiente) { detenerMusica(true); tema = siguiente; ajuste = { tempo: 1, capas: null }; }
  sincronizaMusica();
}
/** Lo que el juego sabe y la música no: lo rápido que va y cuánto falta.
    tempo multiplica el bpm; capas pone a 0 o a 1 cada canal (lead, arp, bajo, bat). */
export function ajustarMusica({ tempo, capas } = {}) {
  if (Number.isFinite(tempo)) ajuste.tempo = Math.max(0.5, Math.min(2, tempo));
  if (capas) ajuste.capas = Object.assign({}, ajuste.capas, capas);
  aplicaAjuste();
}
function aplicaAjuste() {
  if (!rep) return;
  rep.tempo = ajuste.tempo;
  if (ajuste.capas) Object.assign(rep.capas, ajuste.capas);
}
export function activarAudio() { desbloqueado = true; sincronizaMusica(); }
function detenerMusica(olvida) {
  if (pistaEscondite) pistaEscondite.pause();
  clearInterval(timer); timer = null;
  if (rep) {
    try { if (olvida) rep.destruir(); else rep.detener(); } catch (_) {}
    if (olvida) rep = null;
  }
}
function sincronizaMusica() {
  if (!tema || !musicaOn || !desbloqueado || document.hidden) { detenerMusica(false); return; }
  if (tema === "escondite") {
    try {
      if (!pistaEscondite) {
        pistaEscondite = new Audio("juegos/audio/escondite-midnight-pulse.mp3");
        pistaEscondite.loop = true; pistaEscondite.preload = "none";
      }
      pistaEscondite.volume = volumen;
      if (pistaEscondite.paused) pistaEscondite.play().catch(() => {});
    } catch (_) {}
    return;
  }
  if (timer) return;
  try {
    const a = contexto();
    if (!a) return;
    if (!bus) { bus = a.createGain(); bus.connect(a.destination); }
    bus.gain.value = volumen * GANANCIA;
    if (!rep) rep = new Chip.Reproductor(a, bus, TEMAS[tema]);
    aplicaAjuste();
    rep.tick(0.25);
    timer = setInterval(() => { try { rep.tick(0.25); } catch (_) { detenerMusica(true); } }, 50);
  } catch (_) { detenerMusica(true); }
}
document.addEventListener("visibilitychange", sincronizaMusica);
window.addEventListener("pagehide", () => detenerMusica(false));
window.addEventListener("pageshow", sincronizaMusica);
