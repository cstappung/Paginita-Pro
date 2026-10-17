// Modo celular: PRO HERO en un teléfono, siempre en horizontal.
// - Se detecta por la pantalla (táctil y su lado corto ≤ 600 px), no por el
//   tamaño del iframe; ?celular=1 / ?celular=0 lo fuerza para probar en un PC.
// - Parte en alto rendimiento y en «todo taps» (con cinco botones no hay rasgueo).
// - En vertical tapa todo con «Gira el celular»; al tocar pide pantalla completa
//   y bloquea la orientación donde el navegador lo permite (Android; iPhone no).
// - Las partidas no se guardan: los récords y las estrellas son para mando,
//   guitarra o teclado (main.js no manda el resultado a la página).
// - Los cinco botones táctiles del juego están en ui/tactil.js.
import { settings } from '../settings.js';

const params = new URLSearchParams(location.search);
const sala = window.parent !== window && params.get('modo') === 'online';

function detecta() {
  if (params.has('celular')) return params.get('celular') !== '0';
  try {
    const tactil = matchMedia('(pointer: coarse)').matches;
    return tactil && Math.min(screen.width, screen.height) <= 600;
  } catch {
    return false;
  }
}

export const celular = detecta();

export function enHorizontal() {
  return window.innerWidth >= window.innerHeight;
}

// Pantalla completa + horizontal. Solo funciona dentro de un gesto (un toque).
// En una sala no: ahí la página tiene el chat y «Abandonar», y la pantalla completa
// se pide al pulsar «Estoy listo» / «Empezar canción» (puente.js, pantallaCompleta).
export function pideHorizontal() {
  if (!celular || sala) return;
  const bloquea = () => {
    try {
      screen.orientation?.lock?.('landscape')?.catch?.(() => {});
    } catch {}
  };
  if (document.fullscreenElement || document.webkitFullscreenElement) return bloquea();
  const raiz = document.documentElement;
  const pide = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  try {
    const r = pide?.call(raiz, { navigationUI: 'hide' });
    if (r?.then) r.then(bloquea, () => {});
    else bloquea();
  } catch {}
}

export function iniciaCelular() {
  if (!celular) return;
  document.documentElement.classList.add('celular');
  // parte en alto rendimiento y en todo taps (no se guarda: si lo cambias en Ajustes, vale esa vez)
  settings.altoRendimiento = true;
  settings.noteMode = 'taps';
  const gira = document.createElement('div');
  gira.className = 'gira';
  gira.innerHTML = '<div class="gira-cel"></div><b>Gira el celular</b><span>PRO HERO se juega en horizontal</span>';
  document.body.append(gira);
  // pointerup y no pointerdown: la pantalla completa cambia el tamaño, y un
  // cambio entre el dedo abajo y el clic hacía caer el toque en otro botón
  window.addEventListener('pointerup', pideHorizontal, true);
}
