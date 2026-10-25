// Dibuja el plano de cada pista (visto desde arriba) con el MAPA CHICO del propio juego — bitácora §56.
//
// Resumen: cada pista trae map_model.brres, el modelo del mapa chico que el juego muestra en la esquina durante la
// carrera: solo el camino, con su forma exacta (herramientas/brres.mjs saca sus triángulos, ya puestos en su lugar
// del mundo con el "hueso" del modelo: escala, giro y traslado). Este programa:
//   1. mira esos triángulos desde arriba (x, z; z hacia abajo, como el mapa del juego) y los escala a 400×300;
//   2. se queda solo con el CONTORNO: cada triángulo se orienta igual (antihorario) y sus lados se anotan con
//      dirección; un lado compartido por dos triángulos aparece una vez en cada sentido y se cancela. Lo que queda es
//      el borde del camino (y el de los huecos, en sentido contrario), que se encadena en lazos cerrados;
//   3. limpia: borra pedazos sueltos que no tocan la ruta de las CPU (marcas, islas de adorno) y simplifica cada
//      lazo (Douglas-Peucker: saca los puntos que se desvían menos de 0,4 px de la recta) → unos KB por pista;
//   4. dibuja el contorno dos veces: borde lila grueso debajo y relleno claro encima (con un trazo claro de 5 px que
//      tapa las costuras entre pedazos del modelo); y la largada (KTPT del course.kmp, en las mismas coordenadas del
//      mundo) como una banderita a cuadros. Si la largada no cae sobre el camino, lo avisa con ✗.
// Algunas pistas no traen el mapa chico como forma sino como un DIBUJO pegado en un cuadrado (2 triángulos): para
// esas se usa course.kcl, el modelo de choques: sus caras de tipo "camino" (asfalto, tierra, hielo, aceleradores,
// saltos…) vistas desde arriba, pintadas en una grilla y contorneadas igual. Sin nada de eso, la ruta de las CPU.
// Comprobado contra planos conocidos (MarioWiki) por una revisión aparte: Luigi Circuit (Wii) sale igual, y ~30 más.
// El dibujo sale de datos de la pista (de Retro Rewind/Nintendo): va a build/ (nunca a git) y a R2 con las fotos.
//
// Uso:  node herramientas/planos-pistas.mjs [archivo.szs …]   (sin argumentos: todas las de archivos.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yaz0, u8 } from './szs.mjs';
import { triangulosBrres } from './brres.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = path.join(raiz, 'build/web/navegador/imagenes/planos');
const W = 400, H = 300, MARGEN = 16;
const BORDE = '#7f76c9', RELLENO = '#ece9f8';

// ---- course.kmp: la largada (KTPT) y la ruta de las CPU (ENPT/ENPH) ----
export function leerKmp(b) {
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
  const [en, nen] = buscar('ENPT'), puntos = [];                                // 0x14 bytes: x, y, z, ancho, …
  for (let i = 0; i < nen; i++) { const p = en + i * 0x14; puntos.push([v.getFloat32(p), v.getFloat32(p + 8)]); }
  const [eh, neh] = buscar('ENPH'), rutas = [];                                 // 0x10 bytes: inicio, largo, …
  for (let i = 0; i < neh; i++) { const p = eh + i * 0x10; rutas.push(puntos.slice(b[p], b[p] + b[p + 1])); }
  if (!rutas.length && puntos.length) rutas.push(puntos);
  const [kt] = buscar('KTPT');
  const largada = kt ? [v.getFloat32(kt), v.getFloat32(kt + 8), v.getFloat32(kt + 16)] : null;   // x, z y el giro en y
  return { rutas: rutas.filter(r => r.length > 1), puntos, largada };
}

// ---- course.kcl: las caras de choque que son camino (formato público: wiki.tockdom.com/wiki/KCL) ----
// Cabecera: dónde están las posiciones, las normales y los "prismas" (+0, +4, +8). Cada prisma (0x10 bytes): alto,
// índice de posición, de normal de la cara, de las 3 normales de los lados, y su tipo (los 5 bits bajos). Las 3
// esquinas salen de la posición y esas normales (la cuenta del wiki).
const TIPOS_CAMINO = new Set([0x00, 0x01, 0x05, 0x06, 0x07, 0x08, 0x09, 0x13, 0x15, 0x16, 0x17, 0x1D]);
export function caminoKcl(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const pPos = v.getUint32(0), pNor = v.getUint32(4), pPri = v.getUint32(8) + 0x10, pOct = v.getUint32(12);
  const vec = (base, i) => [v.getFloat32(base + 12 * i), v.getFloat32(base + 12 * i + 4), v.getFloat32(base + 12 * i + 8)];
  const cruz = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  const punto = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const tris = [];
  for (let p = pPri; p + 0x10 <= pOct; p += 0x10) {
    const tipo = v.getUint16(p + 14) & 0x1F;
    if (!TIPOS_CAMINO.has(tipo)) continue;
    const alto = v.getFloat32(p), pos = vec(pPos, v.getUint16(p + 4)), fn = vec(pNor, v.getUint16(p + 6));
    if (fn[1] < 0.3) continue;                                                  // casi vertical: es una pared
    const e1 = vec(pNor, v.getUint16(p + 8)), e2 = vec(pNor, v.getUint16(p + 10)), e3 = vec(pNor, v.getUint16(p + 12));
    const ca = cruz(e1, fn), cb = cruz(e2, fn);
    const v2 = pos.map((x, k) => x + cb[k] * (alto / punto(cb, e3))), v3 = pos.map((x, k) => x + ca[k] * (alto / punto(ca, e3)));
    if (![...v2, ...v3].every(Number.isFinite)) continue;
    tris.push([...pos, ...v2, ...v3]);
  }
  return tris;
}

// ---- triángulos (x, z) → lazos del contorno ----
export function contorno(tris2d, decimales = 1) {
  const clave = ([x, y]) => `${x.toFixed(decimales)},${y.toFixed(decimales)}`;
  const lados = new Map();                                                      // "a>b" → cuántos
  const pon = (a, b) => {
    const ida = a + '>' + b, vuelta = b + '>' + a;
    if (lados.get(vuelta)) { const n = lados.get(vuelta) - 1; if (n) lados.set(vuelta, n); else lados.delete(vuelta); }
    else lados.set(ida, (lados.get(ida) || 0) + 1);
  };
  for (let [a, b, c] of tris2d) {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-4) continue;                                        // triángulo aplastado
    if (area < 0) [b, c] = [c, b];                                              // todos en el mismo sentido
    const [ka, kb, kc] = [a, b, c].map(clave);
    if (ka === kb || kb === kc || ka === kc) continue;
    pon(ka, kb); pon(kb, kc); pon(kc, ka);
  }
  const siguiente = new Map();                                                  // encadenar: de cada punto, a dónde sigue
  for (const [lado, n] of lados) {
    const [a, b] = lado.split('>');
    for (let i = 0; i < n; i++) { if (!siguiente.has(a)) siguiente.set(a, []); siguiente.get(a).push(b); }
  }
  const lazos = [];
  for (const inicio of [...siguiente.keys()]) {
    while (siguiente.get(inicio)?.length) {
      const lazo = [inicio];
      let p = inicio;
      for (let paso = 0; paso < 200000; paso++) {
        const ops = siguiente.get(p);
        if (!ops || !ops.length) break;
        p = ops.pop();
        if (p === inicio) break;
        lazo.push(p);
      }
      if (lazo.length > 2) lazos.push(lazo.map(k => k.split(',').map(Number)));
    }
  }
  return lazos;
}
const areaLazo = l => { let a = 0; for (let i = 0; i < l.length; i++) { const [x1, y1] = l[i], [x2, y2] = l[(i + 1) % l.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
// ¿el punto está adentro del lazo? (cuenta cuántas veces una semirrecta cruza el borde)
function adentro([x, y], l) {
  let si = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) si = !si;
  }
  return si;
}
// "número de vueltas" distinto de 0 = el punto está pintado (la misma regla "nonzero" con que el SVG rellena)
const pintado = (p, lazos) => lazos.reduce((n, l) => n + (adentro(p, l) ? Math.sign(areaLazo(l)) : 0), 0) !== 0;
// Douglas-Peucker sobre un lazo cerrado
function simplificar(l, eps) {
  if (l.length < 8) return l;
  const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9; return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L; };
  const rdp = (pts) => {
    let max = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; idx = i; } }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
  };
  // se corta el lazo en el punto más lejano al primero, para tener dos tramos abiertos
  let lejos = 0, dmax = 0;
  l.forEach((p, i) => { const d = Math.hypot(p[0] - l[0][0], p[1] - l[0][1]); if (d > dmax) { dmax = d; lejos = i; } });
  const r = [...rdp(l.slice(0, lejos + 1)).slice(0, -1), ...rdp([...l.slice(lejos), l[0]]).slice(0, -1)];
  return r.length >= 3 ? r : l;
}

// ---- el SVG ----
function escala(xs, zs) {
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const x of xs) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  for (const z of zs) { if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const k = Math.min((W - 2 * MARGEN) / (x1 - x0 || 1), (H - 2 * MARGEN) / (z1 - z0 || 1));
  const ox = (W - (x1 - x0) * k) / 2, oz = (H - (z1 - z0) * k) / 2;
  return (x, z) => [ox + (x - x0) * k, oz + (z - z0) * k];
}
function bandera(P, largada) {
  if (!largada) return '';
  let [cx, cz] = P(largada[0], largada[1]);
  cx = Math.min(W - 11, Math.max(11, cx)); cz = Math.min(H - 11, Math.max(11, cz));   // que no quede cortada
  return `<g transform="translate(${cx.toFixed(1)} ${cz.toFixed(1)}) rotate(${(-largada[2]).toFixed(1)})"><rect x="-11" y="-4" width="22" height="8" fill="#fff" stroke="#111" stroke-width="1"/>` +
    `<path d="M-11-4h3.67v4h-3.67zM-3.67-4h3.67v4h-3.67zM3.67-4h3.67v4h-3.67zM-7.33 0h3.67v4h-3.67zM0 0h3.67v4h-3.67zM7.33 0h3.67v4h-3.67z" fill="#111"/></g>`;
}
function svgDeLazos(lazos, P, datos) {
  // limpiar: pedazos de borde exterior chicos que no tocan la ruta de las CPU (marcas, islas de adorno) → fuera
  const ruta = datos.puntos.map(([x, z]) => P(x, z));
  const mayor = Math.max(...lazos.map(areaLazo));
  lazos = lazos.filter(l => {
    const a = areaLazo(l);
    if (a < 0) return Math.abs(a) > 2;                                          // huecos: fuera solo los mínimos
    if (a < mayor * 0.004) return false;                                        // migas
    if (a < mayor * 0.08 && ruta.length && !ruta.some(p => adentro(p, l))) return false;   // pedazo suelto sin ruta
    return true;
  }).map(l => simplificar(l, 0.4));
  const d = lazos.map(l => 'M' + l.map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join('L') + 'Z').join('');
  // la largada sobre el camino: el punto o alguno a 10 px (la línea de largada puede quedar justo en el borde)
  const L0 = datos.largada && P(datos.largada[0], datos.largada[1]);
  const enCamino = !L0 || [[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]].some(([dx, dy]) => pintado([L0[0] + dx, L0[1] + dy], lazos));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><path id="c" d="${d}"/></defs>` +
    `<use href="#c" fill="${BORDE}" stroke="${BORDE}" stroke-width="11" stroke-linejoin="round"/>` +
    `<use href="#c" fill="${RELLENO}" stroke="${RELLENO}" stroke-width="5" stroke-linejoin="round"/>${bandera(P, datos.largada)}</svg>`;
  return { svg, enCamino };
}
export function svgDesdeMapa(tris, datos) {
  const P = escala(tris.flatMap(t => [t[0], t[3], t[6]]), tris.flatMap(t => [t[2], t[5], t[8]]));
  return svgDeLazos(contorno(tris.map(t => [P(t[0], t[2]), P(t[3], t[5]), P(t[6], t[8])])), P, datos);
}
// Desde el modelo de choques: se pintan los triángulos de camino en una grilla de 2 px y se contornea la grilla
// (cada celda pintada = un cuadradito de 2 triángulos); así no importan los miles de triángulos sueltos del KCL.
export function svgDesdeKcl(tris, datos) {
  const P = escala(tris.flatMap(t => [t[0], t[3], t[6]]), tris.flatMap(t => [t[2], t[5], t[8]]));
  const C = 2, gw = W / C, gh = H / C, grilla = new Uint8Array(gw * gh);
  for (const t of tris) {                                                       // pintar cada triángulo (por filas)
    const ps = [P(t[0], t[2]), P(t[3], t[5]), P(t[6], t[8])].map(([x, y]) => [x / C, y / C]);
    const y0 = Math.max(0, Math.floor(Math.min(...ps.map(p => p[1])))), y1 = Math.min(gh - 1, Math.ceil(Math.max(...ps.map(p => p[1]))));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < 3; i++) {
        const [a, b] = [ps[i], ps[(i + 1) % 3]];
        if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      if (xs.length < 2) { const xm = ps.reduce((s, p) => s + p[0], 0) / 3; if (Math.abs(ps[0][1] - yc) < 1) grilla[y * gw + Math.max(0, Math.min(gw - 1, Math.floor(xm)))] = 1; continue; }
      const [xa, xb] = [Math.min(...xs), Math.max(...xs)];
      for (let x = Math.max(0, Math.floor(xa)); x <= Math.min(gw - 1, Math.floor(xb)); x++) grilla[y * gw + x] = 1;
    }
  }
  const celdas = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (grilla[y * gw + x]) {
    const a = [x * C, y * C], b = [x * C + C, y * C], c = [x * C + C, y * C + C], d = [x * C, y * C + C];
    celdas.push([a, b, c], [a, c, d]);
  }
  const r = svgDeLazos(contorno(celdas, 0).map(l => simplificar(l, 1.2)), P, datos);
  return r;
}
export function svgDesdeRutas(datos) {                                          // último recurso: la ruta de las CPU
  const pts = datos.rutas.flat();
  if (!pts.length) return null;
  const P = escala(pts.map(p => p[0]), pts.map(p => p[1]));
  const d = datos.rutas.map(r => 'M' + r.map(([x, z]) => P(x, z).map(n => n.toFixed(1)).join(' ')).join('L')).join('');
  const trazo = (c, a) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${a}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${trazo(BORDE, 14)}${trazo(RELLENO, 8)}${bandera(P, datos.largada)}</svg>`, enCamino: true };
}

export function planoDePista(archivo) {
  const todo = u8(yaz0(new Uint8Array(readFileSync(archivo))));
  const buscar = nombre => [...todo].find(([r]) => r.endsWith('/' + nombre))?.[1];
  const kmp = buscar('course.kmp'), mapa = buscar('map_model.brres'), kcl = buscar('course.kcl');
  const datos = kmp ? leerKmp(kmp) : { rutas: [], puntos: [], largada: null };
  if (mapa) {
    try { const tris = triangulosBrres(mapa); if (tris.length >= 8) return { ...svgDesdeMapa(tris, datos), de: 'mapa' }; } catch { /* sigue */ }
  }
  if (kcl) {
    try { const tris = caminoKcl(kcl); if (tris.length) return { ...svgDesdeKcl(tris, datos), de: 'kcl' }; } catch { /* sigue */ }
  }
  const r = svgDesdeRutas(datos);
  return r ? { ...r, de: 'ruta' } : null;
}

// ---- como programa ----
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  mkdirSync(carpeta, { recursive: true });
  const pedidos = process.argv.slice(2);
  let lista;
  if (pedidos.length) lista = pedidos.map(a => [path.basename(a, '.szs'), a]);
  else {
    const mapa = JSON.parse(readFileSync(path.join(carpeta, '..', 'archivos.json'), 'utf8'));
    lista = Object.entries(mapa).map(([hex, rel]) => [hex, path.join(raiz, 'terceros/RetroRewind', rel)]);
  }
  const cuenta = { mapa: 0, kcl: 0, ruta: 0 };
  let bytes = 0;
  for (const [nombre, archivo] of lista) {
    if (!existsSync(archivo)) { console.log(`✗ ${nombre}: no está ${archivo}`); continue; }
    try {
      const r = planoDePista(archivo);
      if (!r) { console.log(`✗ ${nombre}: sin mapa ni ruta`); continue; }
      writeFileSync(path.join(carpeta, nombre + '.svg'), r.svg);
      cuenta[r.de]++; bytes += r.svg.length;
      if (r.de !== 'mapa') console.log(`· ${nombre}: sin mapa chico con forma, dibujado con ${r.de === 'kcl' ? 'el modelo de choques' : 'la ruta de las CPU'}`);
      if (!r.enCamino) console.log(`✗ ${nombre}: la largada no cae sobre el camino dibujado`);
    } catch (e) { console.log(`✗ ${nombre}: ${e.message}`); }
  }
  console.log(`${cuenta.mapa} del mapa chico + ${cuenta.kcl} del modelo de choques + ${cuenta.ruta} de la ruta, ${(bytes / 1024).toFixed(0)} KB en ${path.relative(raiz, carpeta)}`);
}
