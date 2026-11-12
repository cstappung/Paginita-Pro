// La recta de la largada de cada pista (bitácora §281 parte 2; el dueño: «elige el track donde el inicio tenga la línea
// recta más larga», así el piloto automático de las pruebas va derecho y los picos no salen de doblar).
//
// Resumen: para cada pista (las de Nintendo y las de Retro Rewind, todas en archivos.json: número de pista → .szs) se
// abre el .szs (Yaz0 → U8 → course.kmp, con szs.mjs) y se leen:
//   - KTPT: la largada (dónde está la línea y hacia dónde mira, el giro en y);
//   - ENPT/ENPH: la ruta de las CPU (los puntos x, z en orden; los grupos dicen cuál sigue a cuál).
// Se corta también al llegar a un cañón (las caras de tipo 0x11 de course.kcl): ahí el kart vuela, no maneja.
// Desde el punto de la ruta más cercano a la largada (y que quede hacia adelante) se camina por la ruta sumando metros
// mientras la dirección de cada tramo no se aparte más de ±10° de la dirección de la largada (la del giro de KTPT). La
// primera vez que se aparta, ahí termina la recta. Como medir con una huincha desde la línea hasta la primera curva.
// Las unidades del juego: 1 unidad ≈ 1 cm (la convención de la comunidad; un kart a 150cc va a ~84 unidades por
// cuadro, unos 5.000 por segundo), por eso también se dan los segundos a velocidad máxima.
// Lee datos del juego (los .szs de terceros/RetroRewind): no escribe nada salvo lo que imprime (y --json a build/).
// Uso:  node herramientas/recta-largada.mjs [--grados 10] [--top 5] [--json build/web/datos/recta-largada.json]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yaz0, u8 } from './szs.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const GRADOS = Number(opcion('--grados', 10)), TOP = Number(opcion('--top', 5)), JSON_SALIDA = opcion('--json', null);
const VELOCIDAD = 84 * 60;   // unidades por segundo a la máxima de 150cc (aprox.)

// course.kmp → la largada (x, z, giro y) y los puntos de la ruta con quién sigue a cada uno
export function rutaYLargada(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (v.getUint32(0) !== 0x524B4D44) throw new Error('no es un KMP');          // "RKMD"
  const secciones = v.getUint16(8), cabeza = v.getUint16(10);
  const buscar = magia => {
    for (let i = 0; i < secciones; i++) {
      const p = cabeza + v.getUint32(0x10 + 4 * i);
      if (String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]) === magia) return [p + 8, v.getUint16(p + 4)];
    }
    return [0, 0];
  };
  const [en, nen] = buscar('ENPT'), pts = [];                                   // 0x14 bytes: x, y, z, ancho, …
  for (let i = 0; i < nen; i++) { const p = en + i * 0x14; pts.push([v.getFloat32(p), v.getFloat32(p + 8), v.getFloat32(p + 4)]); }   // x, z, y
  // ENPH (0x10 bytes): primer punto, cuántos, 6 anteriores, 6 siguientes (0xFF = ninguno). En un desvío, el primero
  const [eh, neh] = buscar('ENPH'), sig = pts.map((_, i) => i + 1);
  const grupos = [];
  for (let g = 0; g < neh; g++) { const p = eh + g * 0x10; grupos.push({ ini: b[p], n: b[p + 1], sig: b[p + 8] }); }
  for (const g of grupos) { const fin = g.ini + g.n - 1; if (fin < pts.length) sig[fin] = g.sig < grupos.length ? grupos[g.sig].ini : 0; }
  if (pts.length) sig[pts.length - 1] = Math.min(sig[pts.length - 1], pts.length - 1) === pts.length - 1 && !grupos.length ? 0 : sig[pts.length - 1];
  const [kt] = buscar('KTPT');
  const largada = kt ? { x: v.getFloat32(kt), z: v.getFloat32(kt + 8), giro: v.getFloat32(kt + 16) } : null;
  return { pts, sig: sig.map(s => s >= pts.length ? 0 : s), largada };
}

// course.kcl: dónde están las caras que disparan un cañón (tipo 0x11 del modelo de choques, formato público de
// wiki.tockdom.com/wiki/KCL). El dueño: en Waluigi Pinball la «recta» de la largada es el cañón, que lanza el kart; eso
// no es manejar. La recta se corta al llegar a un cañón.
export const TIPO_CANON = 0x11;
export function canonesKcl(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const pPos = v.getUint32(0), pPri = v.getUint32(8) + 0x10, pOct = v.getUint32(12), lugares = [];
  for (let p = pPri; p + 0x10 <= pOct; p += 0x10) {
    if ((v.getUint16(p + 14) & 0x1F) !== TIPO_CANON) continue;
    const i = v.getUint16(p + 4), q = pPos + 12 * i;
    lugares.push([v.getFloat32(q), v.getFloat32(q + 8), v.getFloat32(q + 4)]);   // x, z, y (una esquina de la cara)
  }
  return lugares;
}
const CERCA_CANON = 2500;   // unidades: el tramo que pasa a menos de esto de un cañón ya es el cañón

// la recta: desde la largada por la ruta, mientras cada tramo va a menos de `grados` de la dirección de partida y antes
// de cualquier cañón
export function recta({ pts, sig, largada }, grados = GRADOS, canones = []) {
  if (!largada || pts.length < 3) return null;
  // la dirección de la largada: el giro en y de KTPT (grados; 0 = hacia +z). Se confirma con la ruta: si el primer tramo
  // va al revés (algunas pistas tienen el giro dado vuelta), se usa el de la ruta
  const g = largada.giro * Math.PI / 180;
  let dir = [Math.sin(g), Math.cos(g)];
  const d2 = i => (pts[i][0] - largada.x) ** 2 + (pts[i][1] - largada.z) ** 2;
  // el punto de partida: el más cercano que quede adelante de la línea (o el más cercano, si ninguno)
  let i0 = -1;
  for (let i = 0; i < pts.length; i++) { const ade = (pts[i][0] - largada.x) * dir[0] + (pts[i][1] - largada.z) * dir[1] > -50;
    if (ade && (i0 < 0 || d2(i) < d2(i0))) i0 = i; }
  if (i0 < 0) i0 = 0;
  const tramo = (a, b) => [pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]];
  const t0 = tramo(i0, sig[i0]), l0 = Math.hypot(...t0);
  let giroDado = false;
  if (l0 > 1 && (t0[0] * dir[0] + t0[1] * dir[1]) / l0 < 0) { dir = [t0[0] / l0, t0[1] / l0]; giroDado = true; }
  const lim = Math.cos(grados * Math.PI / 180);
  // de la línea al primer punto, y después tramo a tramo
  let largo = Math.hypot(pts[i0][0] - largada.x, pts[i0][1] - largada.z), i = i0, n = 0, hasta = i0, canon = false;
  for (; n < pts.length; n++) {
    const j = sig[i]; if (j === i0 && n) break;                                  // (dio la vuelta entera: toda la pista es recta)
    const t = tramo(i, j), l = Math.hypot(...t);
    if (l < 1) { i = j; continue; }
    const c = (t[0] * dir[0] + t[1] * dir[1]) / l;
    if (c < lim) break;   // este tramo ya dobla: ahí termina la recta
    // ¿este tramo llega a un cañón? (su punto final cerca de una cara de cañón, en las tres dimensiones)
    const q = pts[j];
    if (canones.some(k => Math.hypot(k[0] - q[0], k[1] - q[1], k[2] - q[2]) < CERCA_CANON)) { canon = true; break; }
    largo += l; i = j; hasta = j;
  }
  return { unidades: Math.round(largo), metros: Math.round(largo / 100), segundos: +(largo / VELOCIDAD).toFixed(1), tramos: n, desde: i0, hasta, giroDado, terminaEnCanon: canon };
}

// ---- como programa ----
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const imagenes = path.join(raiz, 'build/web/navegador/imagenes');
  const archivos = JSON.parse(readFileSync(path.join(imagenes, 'archivos.json'), 'utf8'));
  const nombres = existsSync(path.join(imagenes, 'pistas.json')) ? JSON.parse(readFileSync(path.join(imagenes, 'pistas.json'), 'utf8')) : [];
  const filas = [];
  for (const [hex, rel] of Object.entries(archivos)) {
    const n = parseInt(hex, 16) - 0x100, id = `${n >> 2}.${n & 3}`, archivo = path.join(raiz, 'terceros/RetroRewind', rel);
    if (!existsSync(archivo)) { console.log(`✗ ${id}: no está ${rel}`); continue; }
    try {
      const todo = u8(yaz0(new Uint8Array(readFileSync(archivo))));
      const kmp = [...todo].find(([r]) => r.endsWith('/course.kmp'))?.[1];
      if (!kmp) { console.log(`✗ ${id}: sin course.kmp`); continue; }
      const kcl = [...todo].find(([r]) => r.endsWith('/course.kcl'))?.[1];
      const r = recta(rutaYLargada(kmp), GRADOS, kcl ? canonesKcl(kcl) : []);
      if (r) filas.push({ id, nombre: nombres[n >> 2]?.[n & 3] ?? '', archivo: rel, ...r });
    } catch (e) { console.log(`✗ ${id}: ${e.message}`); }
  }
  filas.sort((a, b) => b.unidades - a.unidades);
  console.log(`${filas.length} pistas medidas (recta = hasta que la ruta se aparta más de ${GRADOS}° de la dirección de la largada)\n`);
  console.log('| # | pista | nombre | recta (unidades) | ≈ m | ≈ s a la máxima |');
  console.log('|---|---|---|---|---|---|');
  filas.slice(0, TOP).forEach((f, k) => console.log(`| ${k + 1} | ${f.id} | ${f.nombre} | ${f.unidades} | ${f.metros} | ${f.segundos}${f.giroDado ? ' (giro de KTPT al revés)' : ''}${f.terminaEnCanon ? ' (termina en un cañón)' : ''} |`));
  if (JSON_SALIDA) { mkdirSync(path.dirname(JSON_SALIDA), { recursive: true }); writeFileSync(JSON_SALIDA, JSON.stringify(filas, null, 1)); console.log(`\n→ ${JSON_SALIDA}`); }
}
