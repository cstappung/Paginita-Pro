// Letreros con la letra del juego, encima de su imagen (M22, el modelo «Modo consola» que eligió el dueño) — bitácora §98.
//
// Resumen: la página le habla al jugador en las pausas con la misma letra y los mismos colores que el juego, como ya
// hace el contador de los que faltan (dnf.mjs). Tres cosas:
//   - las MARCAS DE LA TABLA: en el descanso, al lado de la fila de cada humano de la tabla de puntos del juego, cuánto
//     se movió su VR («+109 VR» en verde, «−17 VR» en rojo). La tabla del juego tiene 12 filas a alturas fijas de su
//     imagen 16:9 (medidas en una foto del descanso: la fila k está en 44 + 40,45·(k−1) de 540 px), y entre su borde
//     derecho (820 de 960) y el de la imagen queda una franja libre: ahí van;
//   - el PODIO del final de la copa: «¡GANÓ PILOTO UNO!» y los tres primeros, 8 s, antes de volver al vestíbulo;
//   - un CARTEL arriba (texto de la página, no del juego): para quien recargó con la copa andando, «Carrera 2 de 4 en
//     curso · vuelves en la 3».
// La letra sale de la fuente que el juego ya cargó (UI/Font.szs, por la caché del disco: dnf.mjs cargarFuentes); si
// no se puede leer, una letra gruesa con borde parecida. Todo se ubica sobre el rectángulo 16:9 que ocupa la imagen
// del juego dentro del <canvas id="canvas"> (con bandas negras si la ventana no tiene esa forma).
//
// Uso:  const l = crearLetreros({ leerArchivo, documento });
//       await l.marcas([{ puesto, texto, sube, yo }])   (puesto 1..12)   ·  l.quitarMarcas()
//       await l.podio(tabla /* [{ nombre, puntos, vr }] */, ms, yo)       ·  l.quitarPodio()
//       l.cartel(titulo, texto)                                          ·  l.quitarCartel()
//       filaTabla(k) → la altura (0..1) del centro de la fila k en la imagen del juego (para las pruebas)
//       filasDeTabla(puntos, llegada) → en qué fila de la tabla queda cada puesto de la ficha (0 = no está)
import { cargarFuentes, PALETAS } from './dnf.mjs';
import { pintar } from './fuente-wii.mjs';

export const filaTabla = k => (44 + 40.45 * (k - 1)) / 540;   // el centro de la fila k (1..12) de la tabla de puntos
export const BORDE_TABLA = 822 / 960;                          // donde termina la tabla (fracción del ancho de la imagen)

// En qué fila (1..12) de la tabla de puntos del juego queda cada puesto de la ficha (0..11). La tabla va de más a menos
// puntos (los de la copa, ya sumados); a igual puntos, primero el que llegó antes en esta carrera (la tabla aparece en
// el orden de llegada y el juego solo cambia de lugar a quien tiene más puntos). puntos y llegada: los 12 de la sala
// (tablaValida / llegadaValida de sala-carrera.mjs); 0 en llegada = nadie en ese puesto. null si falta algo.
export function filasDeTabla(puntos, llegada) {
  if (!Array.isArray(puntos) || !Array.isArray(llegada) || puntos.length !== 12 || llegada.length !== 12) return null;
  const hay = [...Array(12).keys()].filter(i => llegada[i] > 0);
  if (!hay.length) return null;
  hay.sort((a, b) => (puntos[b] | 0) - (puntos[a] | 0) || llegada[a] - llegada[b]);
  const fila = new Array(12).fill(0);
  hay.forEach((i, k) => { fila[i] = k + 1; });
  return fila;
}
// (como las de dnf.mjs: el color de la letra = relleno × el degradado de arriba a abajo; borde oscuro para que se lea
// sobre cualquier fondo)
const VERDE = { borde: [10, 40, 14], relleno: [150, 255, 130], arriba: [255, 255, 255], abajo: [170, 230, 170] };
const ROJO = { borde: [56, 10, 10], relleno: [255, 135, 120], arriba: [255, 255, 255], abajo: [235, 175, 175] };
const ORO = PALETAS.naranja, BLANCO = PALETAS.blanco;

const ESTILO = `
.letreros-capa { position: fixed; z-index: 6; pointer-events: none; }
.letreros-capa[hidden] { display: none; }
.letrero-marca { position: absolute; display: flex; align-items: center; filter: drop-shadow(0 0 3px #000c); }
.letrero-marca canvas { display: block; height: 100%; width: auto; max-width: 100%; object-fit: contain; object-position: left center; }
.letreros-podio { display: grid; place-items: center; align-content: center; gap: 1.6%; background: radial-gradient(#0008, #000b); }
.letreros-podio canvas { display: block; width: auto; filter: drop-shadow(0 0 4px #000c) drop-shadow(0 4px 6px #0008); }
.letreros-podio .grande { height: 11%; } .letreros-podio .linea { height: 6%; } .letreros-podio .yo { margin-top: 2%; opacity: .9; }
.letreros-cartel { position: fixed; z-index: 8; left: 50%; top: calc(12px + var(--st, 0px)); translate: -50% 0; max-width: min(640px, calc(100vw - 32px));
  padding: 10px 16px; border-radius: 14px; background: #1b1440ee; border: 2px solid #4b3d93; color: #f4f1ff; text-align: center;
  box-shadow: inset 0 3px 0 #ffd84a, 0 10px 28px #000a; font: 600 14px 'IBM Plex Sans', system-ui, sans-serif; }
.letreros-cartel b { display: block; font: 400 20px 'Lilita One', system-ui, sans-serif; color: #ffd84a; }
.letreros-cartel[hidden] { display: none; }
`;

// La letra de reserva: gruesa, con borde, con los colores de la paleta
function reserva(texto, paleta, documento) {
  const c = documento.createElement('canvas'), px = 40, alto = 50;
  const ctx = c.getContext('2d'), fuente = `italic 900 ${px}px "Arial Black", system-ui, sans-serif`;
  ctx.font = fuente;
  c.width = Math.max(1, Math.ceil(ctx.measureText(texto).width + px * 0.5)); c.height = alto;
  ctx.font = fuente; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const rgb = a => `rgb(${a.join(',')})`, deg = ctx.createLinearGradient(0, 0, 0, alto);
  deg.addColorStop(0, rgb(paleta.arriba)); deg.addColorStop(1, rgb(paleta.abajo));
  ctx.lineWidth = px * 0.2; ctx.strokeStyle = rgb(paleta.borde); ctx.strokeText(texto, c.width / 2, alto / 2 + 1);
  ctx.fillStyle = deg; ctx.fillText(texto, c.width / 2, alto / 2 + 1);
  return c;
}

export function crearLetreros({ leerArchivo = null, documento = document, lienzo = () => documento.getElementById('canvas') } = {}) {
  if (!documento.getElementById('letreros-estilo')) {
    const s = documento.createElement('style'); s.id = 'letreros-estilo'; s.textContent = ESTILO; documento.head.append(s);
  }
  let fuentes = null, cargando = null;
  const cargar = () => cargando || (cargando = (leerArchivo ? cargarFuentes(leerArchivo) : Promise.resolve(null)).then(f => (fuentes = f)).catch(() => null));
  // un texto como <canvas>: con la fuente del juego si tiene todas sus letras; si no, la de reserva
  // (recorte: las filas con tinta de las letras del juego: todos los letreros del mismo alto)
  const texto = (t, paleta) => (fuentes?.texto?.tiene(t) ? pintar(fuentes.texto, t, paleta, documento, null, fuentes.letras) : reserva(t, paleta, documento));
  // el rectángulo de la imagen 16:9 del juego en la ventana (centrada en el canvas, con bandas si hace falta)
  function imagen() {
    const c = lienzo(), r = c?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    const w = Math.min(r.width, r.height * 16 / 9), h = w * 9 / 16;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
  }
  const capa = clase => { const d = documento.createElement('div'); d.className = 'letreros-capa ' + clase; documento.body.append(d); return d; };
  const ubicar = (d, im) => Object.assign(d.style, { left: im.x + 'px', top: im.y + 'px', width: im.w + 'px', height: im.h + 'px' });
  let marcas = null, podioCapa = null, cartelCaja = null, filasMarcas = [];
  function pintarMarcas() {
    const im = imagen();
    if (!marcas || !im) return;
    ubicar(marcas, im);
    marcas.replaceChildren(...filasMarcas.filter(f => f.puesto >= 1 && f.puesto <= 12).map(f => {
      const d = documento.createElement('div');
      d.className = 'letrero-marca' + (f.yo ? ' yo' : '');
      d.dataset.puesto = String(f.puesto);
      const alto = 0.052;
      Object.assign(d.style, { left: (BORDE_TABLA * 100 + 0.6) + '%', top: ((filaTabla(f.puesto) - alto / 2) * 100) + '%', height: (alto * 100) + '%',
        maxWidth: ((1 - BORDE_TABLA) * 100 - 1) + '%' });
      const c = texto(f.texto, f.sube ? VERDE : ROJO);
      c.setAttribute('aria-label', f.texto);
      d.append(c);
      return d;
    }));
  }
  const alCambiarTamano = () => { pintarMarcas(); if (podioCapa) { const im = imagen(); if (im) ubicar(podioCapa, im); } };
  addEventListener('resize', alCambiarTamano);
  return {
    filaTabla, cargar,
    async marcas(filas) {
      await cargar();
      filasMarcas = Array.isArray(filas) ? filas : [];
      if (!marcas) marcas = capa('letreros-marcas');
      marcas.hidden = !filasMarcas.length;
      pintarMarcas();
    },
    quitarMarcas() { filasMarcas = []; if (marcas) { marcas.hidden = true; marcas.replaceChildren(); } },
    get marcasVisibles() { return !!marcas && !marcas.hidden ? [...marcas.querySelectorAll('.letrero-marca')].map(d => ({ puesto: +d.dataset.puesto, texto: d.querySelector('canvas')?.getAttribute('aria-label') })) : []; },
    // el podio: «¡GANÓ …!» y los tres primeros (con el VR que ganaron o perdieron en la copa, los humanos); yo = tu
    // fila si no estás entre los tres ({ puesto, puntos, vr })
    async podio(tabla, ms = 8000, yo = null) {
      await cargar();
      if (!podioCapa) podioCapa = capa('letreros-podio');
      const t = (Array.isArray(tabla) ? tabla : []).slice(0, 3);
      if (!t.length) return;
      const conVr = f => (Number.isInteger(f.vr) ? `  ${f.vr >= 0 ? '+' : '-'}${Math.abs(f.vr)} VR` : '');
      const g = texto(`¡GANÓ ${String(t[0].nombre).toUpperCase()}!`, ORO); g.className = 'grande';
      const lineas = t.map((f, i) => { const c = texto(`${i + 1}.º  ${f.nombre}  ${f.puntos} pts${conVr(f)}`, BLANCO); c.className = 'linea'; return c; });
      if (yo?.puesto) { const c = texto(`${yo.puesto}.º  ${yo.nombre || 'Tú'}  ${yo.puntos} pts${conVr(yo)}`, BLANCO); c.className = 'linea yo'; lineas.push(c); }
      podioCapa.replaceChildren(g, ...lineas);
      podioCapa.setAttribute('role', 'status');
      podioCapa.setAttribute('aria-label', `Ganó ${t[0].nombre} con ${t[0].puntos} puntos`);
      const im = imagen(); if (im) ubicar(podioCapa, im);
      podioCapa.hidden = false;
      await new Promise(listo => setTimeout(listo, ms));
    },
    quitarPodio() { if (podioCapa) podioCapa.hidden = true; },
    get podioVisible() { return !!podioCapa && !podioCapa.hidden ? podioCapa.getAttribute('aria-label') : ''; },
    cartel(titulo, txt) {
      if (!cartelCaja) { cartelCaja = documento.createElement('div'); cartelCaja.className = 'letreros-cartel'; cartelCaja.setAttribute('role', 'status'); documento.body.append(cartelCaja); }
      const b = documento.createElement('b'); b.textContent = titulo;
      cartelCaja.replaceChildren(b, documento.createTextNode(txt || ''));
      cartelCaja.hidden = false;
    },
    quitarCartel() { if (cartelCaja) cartelCaja.hidden = true; },
    get cartelVisible() { return !!cartelCaja && !cartelCaja.hidden ? cartelCaja.textContent : ''; },
  };
}
