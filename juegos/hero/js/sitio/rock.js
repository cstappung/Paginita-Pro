// Batalla de Rock dentro de PRO HERO: lo que el juego sabe de tu rockero y cómo carga la escena.
//
// La página (colabtex/src/juegos/hero.js) manda `rock` solo a un administrador mientras está a
// prueba: {inv, look, looks}. Sin ese mensaje no existe nada de esto (ni el botón del menú, ni el
// ajuste, ni el fondo) y three.js no se baja. Todo lo que vale dinero (abrir una caja, vender, guardar
// el rockero) se le pide a la página con `pideRock`, que lo comprueba y lo escribe.
import { sitio } from './puente.js';

export const rockSitio = {
  admin: false,
  inv: null, // {coins, parada, own, opened, last}
  look: null, // tu rockero guardado (ya comprobado por la página)
  looks: new Map(), // uid → rockero, los de la sala
};

let escena = null;
// La escena (three.js + el escenario) se baja la primera vez que hace falta
export function cargaEscena() {
  if (!escena) escena = import('../rock/escena.js').then((m) => m.rock, (err) => { escena = null; throw err; });
  return escena;
}

// El fondo de una canción: la escena en un worker con un OffscreenCanvas (no le quita tiempo al hilo del
// juego) o, si el navegador no lo permite o el worker falla, en la página. Las dos dan la misma API:
// monta(host), desmonta(), enVivo({yo, rival, alto, alDemasiado}), pulso(d), ataque(q), hype(k, t, c), fin(g, t).
let fondo = null;
export function cargaFondo() {
  if (fondo) return fondo;
  const puede = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  fondo = (puede ? fondoEnTrabajador() : Promise.reject(new Error('sin OffscreenCanvas')))
    .catch((err) => {
      console.warn('[hero] Batalla de Rock va en la página:', err?.message || err);
      return cargaEscena();
    })
    .catch((err) => {
      fondo = null;
      throw err;
    });
  return fondo;
}

function fondoEnTrabajador() {
  return new Promise((ok, mal) => {
    // el paquete del worker lleva la misma versión que este módulo (?v=hero-N del mapa de index.html)
    const w = new Worker(new URL('../../rock-trabajador.js' + new URL(import.meta.url).search, import.meta.url), { type: 'module' });
    const canvas = document.createElement('canvas');
    canvas.className = 'rock-lienzo';
    const off = canvas.transferControlToOffscreen();
    let listo = false, demasiado = null;
    const tam = () => w.postMessage({ t: 'tam', w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight, dpr: devicePixelRatio || 1 });
    const falla = (err) => {
      if (listo) return console.warn('[hero] worker de Batalla de Rock', err);
      clearTimeout(espera);
      w.terminate();
      mal(err);
    };
    const espera = setTimeout(() => falla(new Error('el worker no respondió')), 30000);
    const api = {
      monta(host) { host.append(canvas); tam(); w.postMessage({ t: 'monta' }); },
      desmonta() { w.postMessage({ t: 'desmonta' }); canvas.remove(); },
      enVivo({ yo, rival = null, alto = false, alDemasiado = null }) { demasiado = alDemasiado; w.postMessage({ t: 'vivo', yo, rival, alto }); },
      pulso(d) { w.postMessage({ t: 'pulso', beats: d.beats, animo: d.animo, hype: d.hype, dtJuego: d.dtJuego || 0 }); },
      ataque(quien) { w.postMessage({ t: 'ataque', quien }); },
      hype(kind, text, color) { w.postMessage({ t: 'hype', kind, text, color }); },
      fin(ganador = 0, texto = '') { w.postMessage({ t: 'fin', ganador, texto }); },
    };
    w.onmessage = (e) => {
      const d = e.data || {};
      if (d.t === 'listo') { listo = true; clearTimeout(espera); ok(api); }
      else if (d.t === 'error') falla(new Error(d.m));
      else if (d.t === 'demasiado') demasiado?.();
    };
    w.onerror = (e) => falla(e.error || new Error(e.message || 'error en el worker'));
    w.postMessage({ t: 'lienzo', canvas: off, w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1 }, [off]);
    new ResizeObserver(tam).observe(canvas);
    document.addEventListener('visibilitychange', () => w.postMessage({ t: 'oculto', on: document.hidden }));
  });
}

let pid = 0;
const pendientes = new Map();
// Una acción que hace la página: 'caja' {b}, 'guarda' {look}, 'vende' {c, p}, 'mercado', 'looks' {uids}
export function pideRock(accion, datos = {}) {
  const id = ++pid;
  return new Promise((ok, mal) => {
    pendientes.set(id, { ok, mal });
    sitio.envia('rock-pide', { id, accion, ...datos });
    setTimeout(() => {
      if (!pendientes.has(id)) return;
      pendientes.delete(id);
      mal(new Error('La página no respondió. Revisa tu conexión.'));
    }, 20000);
  });
}

const oyentes = new Set();
export const alCambiarRock = (fn) => (oyentes.add(fn), () => oyentes.delete(fn));

sitio.on('rock', (d) => {
  rockSitio.admin = !!d.admin;
  if (d.inv) rockSitio.inv = d.inv;
  if ('look' in d) rockSitio.look = d.look || null;
  for (const [u, l] of Object.entries(d.looks || {})) rockSitio.looks.set(u, l);
  if (rockSitio.inv) escena?.then((r) => r.inventario(rockSitio.inv), () => {});
  for (const fn of oyentes) fn();
});
sitio.on('rock-resp', (d) => {
  const p = pendientes.get(d.id);
  if (!p) return;
  pendientes.delete(d.id);
  if (d.ok) p.ok(d.dato);
  else p.mal(new Error(d.error || 'No se pudo.'));
});
