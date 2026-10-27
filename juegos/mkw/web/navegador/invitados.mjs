// Los 6 Mii invitados del juego (la pestaña «Guest» de «Elige un Mii»), con la cara que dibuja el juego — bitácora §86.
//
// Resumen: el juego trae 6 Mii que no son de nadie (los «Mii por defecto» de la librería de caras de la Wii). Este
// módulo:
//   1. se los pide al juego andando (invitados_nativo.cpp): los 74 bytes de cada uno (el mismo formato de RFL_DB.dat,
//      mii.mjs) y la textura del ícono que el juego mismo dibujó, en el formato de la Wii (textura-gx.mjs);
//   2. pasa cada textura a PNG y guarda todo en IndexedDB de ESTE navegador (base «mkw-invitados»). Nada de esto va a
//      git, al sitio, a R2 ni a la nube: sale del juego que el jugador ya tiene, en su navegador (como la fuente de §78);
//   3. arma el Mii del jugador desde un invitado: «cambiar» (el Mii de la licencia toma la cara del invitado y conserva
//      su id, así la licencia lo sigue encontrando) o «nuevo» (con un id nuevo);
//   4. reconoce si un Mii tiene la cara de un invitado (para mostrar la imagen del juego en vez del dibujo aproximado).
// Como guardar la foto de fábrica de cada pieza: se toma una vez, con la cámara del juego, y después se mira sin abrirlo.
//
// Uso:  const reg = await asegurarInvitados(M)      → { version, cuando, datos[6], imagenes[6] (PNG), ancho, alto, formato }
//       const m = miiDeInvitado(reg, 2, { conservar: miiDeLaLicencia })     (o { nombre: 'Ana' } para uno nuevo)
import { desarmarMii, miiNuevo, leerBase, armarBase, RUTA_RFLDB } from './mii.mjs';
import { decodificar } from './textura-gx.mjs';

export const N_INVITADOS = 6;
export const LETRAS = 'ABCDEF';
export const VERSION = 1;
const BASE = 'mkw-invitados', ALMACEN = 'invitados', CLAVE = 'caras';
const PREF = 'mkw.invitado';                       // el invitado elegido para una licencia nueva (0..5)
const espera = ms => new Promise(r => setTimeout(r, ms));

// ---- 1. Pedírselos al juego ----
// Lee lo que dejó invitados_nativo.cpp (struct Salida) en la memoria de wasm (enteros little-endian)
export function leerSalida(M) {
  const base = M._mkw_invitados_salida(), tamInv = M._mkw_invitados_forma(0), desdeInv = M._mkw_invitados_forma(1);
  const desdeImg = M._mkw_invitados_forma(2), tamImg = M._mkw_invitados_forma(3);
  const H = M.HEAPU8, v = new DataView(H.buffer);
  const r = { cuantos: v.getInt32(base, true), cuadros: v.getInt32(base + 4, true), ms: v.getInt32(base + 8, true) / 1000, datos: [], texturas: [] };
  for (let i = 0; i < N_INVITADOS; i++) {
    const p = base + desdeInv + i * tamInv;
    r.datos.push(H.slice(p, p + 74));
    const [ancho, alto, formato, bytes, direccion, bajada] = [0, 1, 2, 3, 4, 5].map(k => v.getUint32(p + 76 + 4 * k, true));
    const q = base + desdeImg + i * tamImg;
    r.texturas.push({ ancho, alto, formato, direccion, bajada, bytes: H.slice(q, q + bytes) });
  }
  return r;
}

// Pide las caras y espera a que el juego las dé (lo hace en su próximo cuadro de menú). → leerSalida() o null
export async function sacarDelJuego(M, { tope = 120000 } = {}) {
  if (!M?._mkw_invitados_pedir) return null;
  M._mkw_invitados_pedir();
  const t0 = performance.now();
  while (performance.now() - t0 < tope) {
    const e = M._mkw_invitados_estado();
    if (e === 2) return leerSalida(M);
    if (e < 0) return null;
    await espera(50);
  }
  return null;
}

// Qué parte de la imagen tiene algo dibujado (opacidad > 0): una copia que no llegó a bajarse da 0
export function tinta(rgba) {
  let n = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) n++;
  return n / (rgba.length / 4);
}

// RGBA → PNG (Blob), con el lienzo que haya (OffscreenCanvas en Chrome; uno del documento si no)
export async function aPng(rgba, ancho, alto) {
  const datos = new ImageData(new Uint8ClampedArray(rgba), ancho, alto);
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(ancho, alto);
    c.getContext('2d').putImageData(datos, 0, 0);
    return c.convertToBlob({ type: 'image/png' });
  }
  const c = Object.assign(document.createElement('canvas'), { width: ancho, height: alto });
  c.getContext('2d').putImageData(datos, 0, 0);
  return new Promise(listo => c.toBlob(listo, 'image/png'));
}

// La salida del juego → el registro que se guarda (falla si alguna cara salió vacía)
export async function armarRegistro(salida, { ahora = Date.now() } = {}) {
  if (!salida || salida.datos.length !== N_INVITADOS) throw new Error('el juego no dio los 6 invitados');
  const imagenes = [];
  for (const [i, t] of salida.texturas.entries()) {
    if (!t.bytes.length) throw new Error(`el invitado ${LETRAS[i]} vino sin imagen`);
    const rgba = decodificar(t.bytes, t.ancho, t.alto, t.formato);
    if (tinta(rgba) < 0.05) throw new Error(`la imagen del invitado ${LETRAS[i]} está vacía (¿no se bajó de la tarjeta de video?)`);
    imagenes.push(await aPng(rgba, t.ancho, t.alto));
  }
  const t0 = salida.texturas[0];
  return { version: VERSION, cuando: ahora, datos: salida.datos.map(d => new Uint8Array(d)), imagenes,
           ancho: t0.ancho, alto: t0.alto, formato: t0.formato };
}

// ---- 2. IndexedDB de este navegador ----
function abrir(idb, nombre) {
  return new Promise((listo, falla) => {
    const pedido = idb.open(nombre, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => listo(pedido.result);
    pedido.onerror = () => falla(pedido.error);
  });
}
async function operar({ indexedDB: idb = globalThis.indexedDB, base = BASE } = {}, modo, accion) {
  const db = await abrir(idb, base);
  try {
    return await new Promise((listo, falla) => {
      const tx = db.transaction(ALMACEN, modo), pedido = accion(tx.objectStore(ALMACEN));
      tx.oncomplete = () => listo(pedido.result);
      tx.onerror = tx.onabort = () => falla(tx.error);
    });
  } finally { db.close(); }
}
// El registro guardado, o null (si no hay, si es de otra versión o si IndexedDB no anda: privado, bloqueado…)
export async function leerInvitados(opciones = {}) {
  try {
    const r = await operar(opciones, 'readonly', s => s.get(CLAVE));
    return r && r.version === VERSION && r.datos?.length === N_INVITADOS && r.imagenes?.length === N_INVITADOS ? r : null;
  } catch { return null; }
}
export const guardarInvitados = (reg, opciones = {}) => operar(opciones, 'readwrite', s => s.put(reg, CLAVE));
export const borrarInvitados = (opciones = {}) => operar(opciones, 'readwrite', s => s.delete(CLAVE));

// Los de IndexedDB o, si no hay, los del juego (y quedan guardados). → registro o null (sin juego, o no se pudo)
export async function asegurarInvitados(M, { forzar = false, nota = () => {}, tope, ...opciones } = {}) {
  if (!forzar) { const r = await leerInvitados(opciones); if (r) return r; }
  const t0 = performance.now();
  const salida = await sacarDelJuego(M, { tope });
  if (!salida) { nota('invitados: el juego no dio las caras'); return null; }
  try {
    const reg = await armarRegistro(salida);
    await guardarInvitados(reg, opciones).catch(() => {});      // sin IndexedDB igual sirven en esta visita
    const t = salida.texturas[0];
    nota(`invitados: 6 caras del juego (${t.ancho}×${t.alto}, formato ${t.formato}, bajada ${salida.texturas.map(x => x.bajada).join('')}) ` +
         `en el cuadro ${salida.cuadros} desde el pedido; el juego tardó ${salida.ms.toFixed(1)} ms en ese cuadro (${Math.round(performance.now() - t0)} ms de espera en total)`);
    return reg;
  } catch (e) { nota('invitados: ' + e.message); return null; }
}

// ---- 3. El Mii del jugador desde un invitado ----
// conservar = el Mii que se reemplaza (el de la licencia): se quedan su id, su consola, su nombre y su creador; el resto
// (cara, pelo, ojos, color favorito, altura…) es del invitado. Sin conservar: uno nuevo, con id nuevo.
export function miiDeInvitado(reg, i, { conservar = null, nombre = '', ahora = Date.now() } = {}) {
  const m = desarmarMii(reg.datos[i]);
  if (conservar) {
    m.id = [...conservar.id]; m.consola = [...conservar.consola];
    m.nombre = conservar.nombre; m.creador = conservar.creador || '';
  } else {
    const nuevo = miiNuevo({ ahora });
    m.id = nuevo.id; m.consola = nuevo.consola;
    m.nombre = (nombre || `Invitado ${LETRAS[i]}`).slice(0, 10);       // (en el juego se llaman «no name»)
  }
  m.invalido = 0;
  return m;
}

// Primera visita: la licencia nueva se creó con una cara de la página (prepararMii en directo.mjs: todavía no había
// invitados en este navegador). Apenas llegan, ese Mii de la base (RFL_DB.dat del sistema de archivos del juego) toma
// la cara del invitado elegido y conserva su id: la licencia lo sigue encontrando y lo muestra desde el próximo
// arranque (el juego ya leyó la base). El guardado de la página vigila el archivo y lo deja en IndexedDB solo.
// createId = los 8 bytes de prepararMii (id + consola). → true si lo cambió
export function mejorarMiiNuevo(FS, reg, createId, elegido = invitadoElegido()) {
  let bytes = null;
  try { bytes = FS.readFile(RUTA_RFLDB); } catch { return false; }
  const base = leerBase(bytes);
  if (!base.valida) return false;
  const lista = base.mii.map(x => x.mii);
  const k = lista.findIndex(m => [...m.id, ...m.consola].every((x, i) => x === createId[i]));
  if (k < 0 || base.mii.some((x, i) => x.casilla !== i)) return false;      // (con huecos en la base, mejor no tocarla)
  lista[k] = miiDeInvitado(reg, elegido, { conservar: lista[k] });
  FS.writeFile(RUTA_RFLDB, armarBase(lista, bytes));
  return true;
}

// ---- 4. ¿Tiene la cara de un invitado? (los rasgos, bytes 0x20-0x35, y chico/chica) → 0..5 o -1
const MIS_RASGOS = m => [m.esChica, m.cara?.forma, m.cara?.piel, m.cara?.rasgo, m.pelo?.tipo, m.pelo?.color, m.pelo?.invertido,
  m.cejas?.tipo, m.cejas?.giro, m.cejas?.color, m.cejas?.tam, m.cejas?.alto, m.cejas?.sep,
  m.ojos?.tipo, m.ojos?.giro, m.ojos?.alto, m.ojos?.color, m.ojos?.tam, m.ojos?.sep, m.nariz?.tipo, m.nariz?.tam, m.nariz?.alto,
  m.boca?.tipo, m.boca?.color, m.boca?.tam, m.boca?.alto, m.lentes?.tipo, m.lentes?.color, m.lentes?.tam, m.lentes?.alto,
  m.barba?.bigote, m.barba?.tipo, m.barba?.color, m.barba?.tam, m.barba?.alto, m.lunar?.si, m.lunar?.tam, m.lunar?.alto, m.lunar?.x].join();
export function cualInvitado(reg, m) {
  if (!reg || !m) return -1;
  const mios = MIS_RASGOS(m);
  for (let i = 0; i < N_INVITADOS; i++) if (MIS_RASGOS(desarmarMii(reg.datos[i])) === mios) return i;
  return -1;
}

// El invitado elegido para la licencia nueva (lo recuerda este navegador; 0 = el primero)
export function invitadoElegido() { try { const v = Number(localStorage.getItem(PREF)); return v >= 0 && v < N_INVITADOS ? v : 0; } catch { return 0; } }
export function elegirInvitado(i) { try { localStorage.setItem(PREF, String(i)); } catch {} }
