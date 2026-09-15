/* Sonidos de los juegos — sintetizados, no grabados.
 *
 * Tres decisiones, y las tres se explican solas en cuanto se intenta lo
 * contrario:
 *
 * 1. NO HAY ARCHIVOS DE AUDIO. Cada sonido son dos o tres osciladores con
 *    su envolvente, unas decenas de bytes de código frente a los cientos
 *    de kilobytes que pesaría una carpeta de .mp3 que además habría que
 *    servir, cachear y esperar. Un pitido de 120 ms no necesita un archivo.
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

function motor() {
  if (apagado) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch (e) { return null; }
}

/* Una nota: onda, frecuencia (o rampa de f0 a f1), cuándo y cuánto.
   La envolvente sube en 8 ms y baja exponencialmente; sin esa subida
   cada nota empieza con un chasquido, que es el salto de cero al
   volumen de golpe. */
function nota(t0, { onda = "sine", f = 440, f1 = 0, dur = 0.12, vol = 0.12, retardo = 0 } = {}) {
  const a = motor();
  if (!a) return;
  const t = t0 + retardo;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = onda;
  osc.frequency.setValueAtTime(f, t);
  if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/* Ruido blanco con filtro: es lo que suena a humo, a barajar y a roce.
   Un oscilador no sabe hacer eso por muchas envolventes que se le
   pongan — lo que define esos sonidos es justamente no tener tono. */
function ruido(t0, { dur = 0.25, vol = 0.08, tipo = "bandpass", f = 900, q = 0.7, f1 = 0 } = {}) {
  const a = motor();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const filtro = a.createBiquadFilter();
  filtro.type = tipo; filtro.frequency.setValueAtTime(f, t0); filtro.Q.value = q;
  if (f1) filtro.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filtro).connect(g).connect(a.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/* El repertorio. Los nombres dicen qué pasó, no cómo suena: así se
   puede cambiar el timbre de «gana» sin tocar ningún juego. */
const REPERTORIO = {
  clic:     a => nota(a, { onda: "triangle", f: 660, dur: 0.05, vol: 0.06 }),
  carta:    a => ruido(a, { dur: 0.16, vol: 0.09, tipo: "bandpass", f: 2200, f1: 700, q: 1.2 }),
  ficha:    a => { nota(a, { onda: "sine", f: 520, f1: 320, dur: 0.09, vol: 0.1 }); },
  entra:    a => { nota(a, { f: 523, dur: 0.1 }); nota(a, { f: 784, dur: 0.14, retardo: 0.09 }); },
  gana:     a => { nota(a, { onda: "triangle", f: 659, dur: 0.1, vol: 0.13 });
                   nota(a, { onda: "triangle", f: 988, dur: 0.16, vol: 0.13, retardo: 0.09 }); },
  pierde:   a => { nota(a, { onda: "triangle", f: 392, dur: 0.12, vol: 0.11 });
                   nota(a, { onda: "triangle", f: 262, dur: 0.2, vol: 0.11, retardo: 0.1 }); },
  empate:   a => { ruido(a, { dur: 0.5, vol: 0.07, tipo: "lowpass", f: 1200, f1: 240 });
                   nota(a, { onda: "sine", f: 300, f1: 180, dur: 0.4, vol: 0.05 }); },
  /* El golpe del 10, 11 o 12: ruido grave y una caída de sierra. Es el
     único sonido deliberadamente más fuerte que los demás, porque marca
     justo lo que la animación está celebrando. */
  golpe:    a => { ruido(a, { dur: 0.45, vol: 0.16, tipo: "lowpass", f: 1800, f1: 120 });
                   nota(a, { onda: "sawtooth", f: 180, f1: 60, dur: 0.35, vol: 0.12 });
                   nota(a, { onda: "square", f: 880, f1: 220, dur: 0.18, vol: 0.06 }); },
  victoria: a => [523, 659, 784, 1047].forEach((f, k) =>
                   nota(a, { onda: "triangle", f, dur: 0.22, vol: 0.13, retardo: k * 0.1 })),
  derrota:  a => [440, 392, 330, 262].forEach((f, k) =>
                   nota(a, { onda: "triangle", f, dur: 0.26, vol: 0.11, retardo: k * 0.12 }))
};

/* Lo único que exportan los juegos. Nunca lanza: ver la decisión 3. */
export function suena(nombre) {
  try {
    const a = motor();
    if (!a) return;
    const f = REPERTORIO[nombre];
    if (f) f(a.currentTime + 0.01);
  } catch (e) { /* un sonido que falla no puede tumbar una partida */ }
}


/* Música original generativa, independiente de los efectos. */
const TEMAS = {
  minas: {bpm:72, notas:[48,55,60,62,67,62,60,55]},
  snake: {bpm:126, notas:[45,57,60,64,67,64,60,57]},
  escondite: { bpm: 78, notas: [60, 64, 67, 71, 67, 64, 62, 67] },
  cartas: { bpm: 108, notas: [57, 60, 64, 69, 67, 64, 60, 64] },
  cuadritos: { bpm: 94, notas: [60, 67, 69, 64, 62, 69, 67, 64] },
  reversi: { bpm: 72, notas: [50, 57, 60, 64, 62, 57, 55, 60] },
  orbita: { bpm: 88, notas: [57, 64, 69, 71, 76, 71, 69, 64] }
};
let pistaEscondite = null;
let tema = "", timer = null, paso = 0, desbloqueado = false;
let audioMusica = null, bus = null, volumen = 0.3, musicaOn = true;
const voces = new Set();
try {
  musicaOn = localStorage.getItem("jg.musica") !== "0";
  const guardado = localStorage.getItem("jg.volumen");
  if (guardado !== null && Number.isFinite(Number(guardado))) volumen = Math.max(0, Math.min(1, Number(guardado)));
} catch (_) {}
export const musicaActiva = () => musicaOn;
export const volumenMusica = () => volumen;
export function configurarMusica(on, v = volumen) {
  musicaOn = !!on; volumen = Math.max(0, Math.min(1, Number(v) || 0));
  try { localStorage.setItem("jg.musica", on ? "1" : "0"); localStorage.setItem("jg.volumen", String(volumen)); } catch (_) {}
  if (bus && audioMusica) bus.gain.setTargetAtTime(volumen * 0.2, audioMusica.currentTime, 0.05);
  sincronizaMusica();
}
export function ambientar(juego) {
  const siguiente = TEMAS[juego] ? juego : "";
  if (tema !== siguiente) { detenerMusica(); tema = siguiente; paso = 0; }
  sincronizaMusica();
}
export function activarAudio() { desbloqueado = true; sincronizaMusica(); }
function detenerMusica() {
  if (pistaEscondite) pistaEscondite.pause();
  clearInterval(timer); timer = null;
  for (const osc of voces) { try { osc.stop(); osc.disconnect(); } catch (_) {} }
  voces.clear();
}
function sincronizaMusica() {
  if (!tema || !musicaOn || !desbloqueado || document.hidden) { detenerMusica(); return; }
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
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioMusica) {
      audioMusica = new AC(); bus = audioMusica.createGain(); bus.connect(audioMusica.destination);
    }
    audioMusica.resume().catch(() => {});
    bus.gain.value = volumen * 0.2;
    const tick = () => {
      if (!tema || document.hidden) return;
      const t = audioMusica.currentTime, config = TEMAS[tema];
      const melodia = config.notas[paso % config.notas.length];
      const notas = paso % 4 === 0 ? [melodia, config.notas[Math.floor(paso / 16) % 2 * 4] - 24] : [melodia];
      for (const [i, midi] of notas.entries()) {
        const o = audioMusica.createOscillator(), g = audioMusica.createGain();
        const dur = i ? 1.4 : 0.5;
        o.type = i ? "sine" : "triangle"; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i ? 0.6 : 0.24, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus); voces.add(o);
        o.onended = () => { voces.delete(o); o.disconnect(); g.disconnect(); };
        o.start(t); o.stop(t + dur + 0.02);
      }
      paso++;
    };
    tick();
    timer = setInterval(() => { try { tick(); } catch (_) { detenerMusica(); } }, 30000 / TEMAS[tema].bpm);
  } catch (_) { detenerMusica(); }
}
document.addEventListener("visibilitychange", sincronizaMusica);
window.addEventListener("pagehide", detenerMusica);
window.addEventListener("pageshow", sincronizaMusica);
