/* Sonidos de los juegos — sintetizados, no grabados.
 *
 * Tres decisiones, y las tres se explican solas en cuanto se intenta lo
 * contrario:
 *
 * 1. CASI NO HAY ARCHIVOS DE AUDIO. Efectos y música salen de
 *    `juegos/audio/chip.js`, un chip de 8 bits hecho con Web Audio, y las
 *    canciones son texto en `juegos/audio/temas.js`: unas decenas de líneas
 *    frente a los megas que pesaría una carpeta de .mp3 que además habría
 *    que servir, cachear y esperar. Las excepciones son las que un chip no
 *    sabe imitar: los temas grabados del Escondite y de Flip 7 (`GRABADAS`)
 *    y el golpe de madera y la carta deslizada de Flip 7 (`MUESTRAS`). Todas
 *    son CC0 y se cargan solo cuando ese juego se abre.
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

/* La mesa de Flip 7 no suena a consola sino a mesa: madera, cartón y una
   campanilla. El chip no sabe hacer un golpe de nudillo — su ruido es de
   registro de desplazamiento y sus ondas no caen de tono lo bastante
   rápido —, así que estos van con nodos de Web Audio a pelo: un seno que
   cae de tono (el cuerpo del tablero), un parcial agudo que muere en
   cuarenta milisegundos (la veta) y un chasquido de ruido filtrado (el
   nudillo). Los tres juntos, y dos veces, son el «toc toc» de pedir. */
let ruidoBlanco = null;
function ruido(a) {
  if (ruidoBlanco && ruidoBlanco.sampleRate === a.sampleRate) return ruidoBlanco;
  const n = Math.floor(a.sampleRate * 0.5), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  let x = 22222;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = x / 0x3fffffff - 1; }
  return (ruidoBlanco = b);
}
function envol(a, t, pico, dur, ataque = 0.002) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(busFx);
  return g;
}
function seno(a, t, f, f1, dur, vol, tipo = "sine") {
  const o = a.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (f1 && f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  o.connect(envol(a, t, vol, dur));
  o.start(t); o.stop(t + dur + 0.02);
}
function soplo(a, t, dur, vol, { f = 1800, f1 = f, q = 2, tipo = "bandpass", ataque = 0.002 } = {}) {
  const s = a.createBufferSource(), fl = a.createBiquadFilter();
  s.buffer = ruido(a);
  fl.type = tipo; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f1 !== f) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  s.connect(fl); fl.connect(envol(a, t, vol, dur, ataque));
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}
function nudillo(a, t, v = 1) {
  seno(a, t, 250 * v, 150 * v, 0.14, 0.34);
  seno(a, t, 640 * v, 560 * v, 0.045, 0.1, "triangle");
  soplo(a, t, 0.028, 0.22, { f: 2300 * v, q: 1.4 });
}
/* Una campana: fundamental y dos parciales inarmónicos, como una de mano. */
function campana(a, t, f, vol = 0.07, dur = 1.3) {
  seno(a, t, f, 0, dur, vol);
  seno(a, t, f * 2.76, 0, dur * 0.45, vol * 0.45);
  seno(a, t, f * 5.4, 0, dur * 0.2, vol * 0.2);
}

/* Muestras grabadas de la mesa de Flip 7 — de los paquetes «Impact Sounds»
   y «Casino Audio» de Kenney (kenney.nl, CC0), recortadas a mono 16 bits.
   El nudillo sintetizado de arriba sonaba a juguete: un seno que cae es un
   tambor, no un tablero, y la veta de verdad no se deja sintetizar con tres
   nodos. Se piden la primera vez que suena algo de Flip 7 y, mientras no
   han llegado (o si no llegan nunca), suena el sintetizado: el primer toc
   de la partida no se pierde esperando a la red. */
const MUESTRAS = {
  toc: ["juegos/audio/flip7-toc-1.wav", "juegos/audio/flip7-toc-2.wav"],
  carta: ["juegos/audio/flip7-carta-1.wav", "juegos/audio/flip7-carta-2.wav", "juegos/audio/flip7-carta-3.wav"]
};
const bufs = {};
let pidiendo = false;
function cargaMuestras(a) {
  if (pidiendo || typeof fetch !== "function") return;
  pidiendo = true;
  for (const [k, urls] of Object.entries(MUESTRAS)) {
    Promise.all(urls.map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.arrayBuffer(); })
      .then(b => new Promise((ok, mal) => a.decodeAudioData(b, ok, mal)))))
      .then(lista => { bufs[k] = lista; })
      .catch(() => {});
  }
}
/* Toca la muestra `i` del grupo `k` (al azar si no se dice) y responde si
   pudo, para que quien llama caiga al sintetizado si no. */
function muestra(a, k, t, { i, vol = 1, vel = 1 } = {}) {
  cargaMuestras(a);
  const lista = bufs[k];
  if (!lista || !lista.length) return false;
  const s = a.createBufferSource(), g = a.createGain();
  s.buffer = lista[Number.isInteger(i) ? i % lista.length : Math.floor(Math.random() * lista.length)];
  s.playbackRate.value = vel;
  g.gain.value = vol;
  s.connect(g); g.connect(busFx);
  s.start(t);
  return true;
}

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
  /* La reacción en cadena: el orbe que se posa es un «plip» corto, y cada
     onda de la cadena estalla medio tono más aguda que la anterior —
     `k` es el número de onda —, que es lo que hace que una cadena larga
     suene a subida y no a la misma explosión repetida. */
  orbe:     (a, t) => P(a, t, H(76), 0.06, { f1: H(88), onda: "p50", vol: 0.07 }),
  estalla:  (a, t, k = 0) => { const n = Math.min(k || 0, 24);
                               N(a, t, 0.18, { vol: 0.1, tono: 1.4 + n * 0.05, tono1: 0.4 });
                               P(a, t, H(60 + n), 0.09, { f1: H(72 + n), onda: "p25", vol: 0.07 }); },
  /* Flip 7: dos golpes en la mesa para pedir, el segundo algo más grave
     y más flojo, como los da una mano de verdad. */
  madera:   (a, t) => { if (muestra(a, "toc", t, { i: 0, vol: 0.95, vel: 1.02 + Math.random() * 0.04 })) {
                          muestra(a, "toc", t + 0.12, { i: 1, vol: 0.72, vel: 0.9 + Math.random() * 0.04 }); return; }
                        nudillo(a, t, 1.06); nudillo(a, t + 0.11, 0.92); },
  /* La carta que el crupier desliza por el tapete. Se varía un poco la
     velocidad para que veinte cartas seguidas no suenen a la misma. */
  reparte:  (a, t) => { if (muestra(a, "carta", t, { vol: 0.8, vel: 0.95 + Math.random() * 0.1 })) return;
                        soplo(a, t, 0.16, 0.12, { f: 700, f1: 3600, q: 0.9, ataque: 0.03 });
                        soplo(a, t + 0.17, 0.03, 0.14, { f: 3200, q: 1.2 }); },
  /* Cacho: el cubilete agitado — una docena de dados chocando contra el
     cuero, cada vez más juntos — y el golpe del vaso boca abajo en la mesa. */
  cubilete: (a, t) => { for (let k = 0; k < 12; k++) {
                          const d = k * 0.038 + Math.random() * 0.012;
                          soplo(a, t + d, 0.018, 0.07 + Math.random() * 0.05, { f: 2600 + Math.random() * 2400, q: 3 }); }
                        if (!muestra(a, "toc", t + 0.5, { i: 1, vol: 0.85, vel: 0.8 })) nudillo(a, t + 0.5, 0.8); },
  /* Cacho: alzar un vaso — el cuero que despega y los dados que se asientan. */
  dado:     (a, t) => { soplo(a, t, 0.06, 0.06, { f: 500, f1: 1400, q: 0.8, ataque: 0.01 });
                        [0.05, 0.085, 0.11].forEach((d, k) => soplo(a, t + d, 0.02, 0.1 - k * 0.025, { f: 3400 - k * 400, q: 3 }));
                        if (!muestra(a, "toc", t, { i: 0, vol: 0.5, vel: 1.25 })) nudillo(a, t, 1.3); },
  /* Plantarse: la palma sobre la mesa y una campanilla que sube en arpegio. */
  planta:   (a, t) => { seno(a, t, 120, 55, 0.3, 0.42); soplo(a, t, 0.1, 0.18, { f: 420, q: 0.7, tipo: "lowpass" });
                        [H(84), H(88), H(91), H(96)].forEach((f, k) => campana(a, t + 0.12 + k * 0.07, f, 0.05, 1.1 + k * 0.2)); },
  /* Pasarse: el cartón que se rompe y dos notas que se caen. */
  revienta: (a, t) => { soplo(a, t, 0.22, 0.22, { f: 900, f1: 180, q: 0.8 }); seno(a, t, 180, 60, 0.35, 0.3);
                        P(a, t + 0.12, 392, 0.12, { f1: 330, onda: "p50", vol: 0.07 });
                        P(a, t + 0.25, 311, 0.28, { f1: 185, onda: "p50", vol: 0.07 }); },
  /* Siete distintos: campanas en escalera y la fanfarria del chip encima. */
  flip7:    (a, t) => { [72, 76, 79, 84, 88, 91, 96].forEach((n, k) => campana(a, t + k * 0.075, H(n), 0.06, 1.6));
                        [[84, .55, .12], [88, .68, .12], [91, .81, .5]].forEach(([n, d, l]) => P(a, t + d, H(n), l, { vol: 0.08 }));
                        P(a, t + 0.55, H(48), 0.9, { onda: "tri", vol: 0.13, sus: 0.9 }); },
  /* Congelar: un cristal que se estrecha. */
  hielo:    (a, t) => { [H(96), H(100), H(103)].forEach((f, k) => campana(a, t + k * 0.04, f, 0.04, 0.7));
                        soplo(a, t, 0.4, 0.08, { f: 6000, f1: 2500, q: 3 }); },
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
export function suena(nombre, x) {
  try {
    const a = motor();
    if (!a) return;
    const f = REPERTORIO[nombre];
    if (f && fx()) f(a, a.currentTime + 0.01, x);
  } catch (e) { /* un sonido que falla no puede tumbar una partida */ }
}


/* La música. Cada juego tiene su tema en el cancionero compartido
   (`juegos/audio/temas.js`) y lo toca un `Chip.Reproductor`, que agenda un
   poco por delante del reloj de audio: el temporizador solo lo despierta, no
   marca el compás, así que un `setInterval` que llega tarde no desafina nada.
   Dos juegos son la excepción y suenan a grabación (`GRABADAS`): el
   Escondite, con Midnight Pulse, y Flip 7, con «Poker Night» de Zane Little
   (opengameart.org, CC0) — un casino pide un piano de bar de fondo, y un
   chip de 8 bits sobre madera y tapete sonaba a otra habitación.

   `fin` es dónde acaba la música de verdad: «Poker Night» termina en seco a
   los 124 s y trae dos segundos y medio de silencio detrás, que en bucle
   eran un hueco en cada vuelta. `loop` no sabe de puntos de corte, así que
   se salta a mano al inicio desde `timeupdate`. `vol` equilibra cada pista
   con los efectos: esta es más fuerte que Midnight Pulse. */
const TEMAS = Temas.temas;
const GRABADAS = {
  escondite: { url: "juegos/audio/escondite-midnight-pulse.mp3", vol: 1 },
  flip7: { url: "juegos/audio/flip7-poker-night.mp3", vol: 0.7, fin: 124.3 },
  /* El Cacho se juega en la misma barra de madera: comparte la grabación. */
  cacho: { url: "juegos/audio/flip7-poker-night.mp3", vol: 0.6, fin: 124.3 },
  /* Y el UNO, que es otra mesa de cartas con las mismas muestras. */
  uno: { url: "juegos/audio/flip7-poker-night.mp3", vol: 0.6, fin: 124.3 }
};
const pistas = {};
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
  const siguiente = GRABADAS[juego] || TEMAS[juego] ? juego : "";
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
  /* Una grabación no se acelera nota a nota, pero sí entera: el navegador
     conserva el tono al cambiar `playbackRate`, así que el «date prisa» del
     final de partida también llega a ellas. */
  const p = pistas[tema];
  if (p) try { p.playbackRate = ajuste.tempo; } catch (_) {}
  if (!rep) return;
  rep.tempo = ajuste.tempo;
  if (ajuste.capas) Object.assign(rep.capas, ajuste.capas);
}
export function activarAudio() { desbloqueado = true; sincronizaMusica(); }
function detenerMusica(olvida) {
  for (const p of Object.values(pistas)) p.pause();
  clearInterval(timer); timer = null;
  if (rep) {
    try { if (olvida) rep.destruir(); else rep.detener(); } catch (_) {}
    if (olvida) rep = null;
  }
}
function sincronizaMusica() {
  if (!tema || !musicaOn || !desbloqueado || document.hidden) { detenerMusica(false); return; }
  const g = GRABADAS[tema];
  if (g) {
    try {
      let p = pistas[tema];
      if (!p) {
        p = pistas[tema] = new Audio(g.url);
        p.loop = true; p.preload = "none";
        if (g.fin) p.addEventListener("timeupdate", () => { if (p.currentTime >= g.fin) p.currentTime = 0; });
      }
      p.volume = Math.min(1, volumen * g.vol);
      aplicaAjuste();
      if (p.paused) p.play().catch(() => {});
      /* Las muestras de la mesa se piden con la música, no con el primer
         toc: así ese primero ya suena a madera. */
      if (tema === "flip7" || tema === "cacho" || tema === "uno") { const a = motor(); if (a) cargaMuestras(a); }
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
