// El puente con Juegos (colabtex/src/juegos/hero.js). Dentro del sitio el
// juego vive en un iframe y no escribe nada en la base: le pide todo a la
// página, que es la que conoce la cuenta, verifica los récords y guarda.
// Fuera de un iframe (abierto a mano) el juego funciona igual, sin récords
// en la nube.
import { claveCancion } from './clave.js';
import { celular } from './celular.js';

const PADRE = 'hero-padre', HIJO = 'hero-hijo';
const params = new URLSearchParams(location.search);
const embebido = window.parent !== window;
const oyentes = new Map();

export const sitio = {
  embebido,
  // ?modo=online: el iframe de una sala de PRO HERO (colabtex/src/juegos/hero-sala.js)
  sala: embebido && params.get('modo') === 'online',
  cuenta: null, // {uid, nombre}
  mias: new Map(), // clave → {g, b, s}: tus estrellas doradas, azules y tu mejor puntaje
  listo: false,

  envia(tipo, datos = {}, transfer) {
    if (!embebido) return;
    window.parent.postMessage({ canal: HIJO, tipo, ...datos }, location.origin, transfer || []);
  },

  on(tipo, fn) {
    if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
    oyentes.get(tipo).add(fn);
    return () => oyentes.get(tipo)?.delete(fn);
  },

  // Lo que tienes en una canción (o null)
  record(entry) {
    return entry ? this.mias.get(claveCancion(entry.id)) || null : null;
  },
};

function emite(tipo, d) {
  for (const fn of oyentes.get(tipo) || []) {
    try {
      fn(d);
    } catch (err) {
      console.error(err);
    }
  }
}

window.addEventListener('message', (e) => {
  if (!embebido || e.source !== window.parent || e.origin !== location.origin || e.data?.canal !== PADRE) return;
  const d = e.data;
  if (d.tipo === 'cuenta') {
    sitio.cuenta = d.cuenta || null;
    sitio.listo = true;
  }
  if (d.tipo === 'cuenta' || d.tipo === 'mias') {
    sitio.mias = new Map(Object.entries(d.mias || {}).map(([k, v]) => [k, { g: v.g | 0, b: v.b | 0, s: v.s | 0 }]));
    emite('mias', d);
  }
  if (d.tipo === 'tema') document.documentElement.dataset.tema = d.oscuro ? 'oscuro' : 'claro';
  emite(d.tipo, d);
});

if (embebido) {
  document.documentElement.classList.add('en-juegos');
  if (sitio.sala) document.documentElement.classList.add('en-sala');
}

// En una sala, la canción se toca a pantalla completa, como tocando solo.
// El navegador solo la concede con un gesto: se pide al pulsar «Estoy listo»
// o «Empezar canción» (el iframe tiene allow="fullscreen").
export function pantallaCompleta() {
  if (!sitio.sala || document.fullscreenElement || document.webkitFullscreenElement) return;
  const raiz = document.documentElement;
  const pide = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  try {
    const r = pide?.call(raiz, { navigationUI: 'hide' });
    // en el celular, además, horizontal (donde el navegador deja bloquearla)
    r?.then?.(() => celular && screen.orientation?.lock?.('landscape')?.catch?.(() => {}), () => {});
  } catch {}
}

// Las estrellas que se pintan en una canción: las doradas encima de las
// azules. Con 4 azules y 3 doradas se ven ★★★ doradas y una ★ azul.
export function estrellasDe(r) {
  const g = Math.min(5, r?.g | 0), b = Math.min(5, r?.b | 0);
  return { oro: g, azul: Math.max(0, b - g) };
}
