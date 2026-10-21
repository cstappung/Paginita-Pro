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
