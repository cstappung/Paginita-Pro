// Leer la forma de un modelo 3D de la Wii (BRRES → MDL0): sus triángulos — bitácora §56.
//
// Resumen: cada pista trae map_model.brres = el dibujo del MAPA CHICO que el juego muestra en la esquina durante la
// carrera (solo el camino, sin pasto ni adornos). Es un modelo 3D común (formato BRRES, público: wiki.tockdom.com/wiki/
// BRRES y /MDL0). Este módulo lo abre y devuelve sus triángulos; herramientas/planos-pistas.mjs los mira desde arriba
// (x, z) y arma el plano de la pista. Es exactamente la forma que dibuja el juego, sin adivinar nada.
//
// Cómo está armado (lo mínimo que se usa):
//   BRRES: "bres" + carpetas ("index groups": árboles con nombre → dato). Carpeta "3DModels(NW4R)" → los MDL0.
//   MDL0: secciones (también carpetas). La 2 son los vértices (listas de x,y,z) y la 10 los "objetos": cada uno trae
//     una lista de dibujo de la GPU (display list): un código por grupo (0x90 triángulos, 0x98 tira, 0xA0 abanico,
//     0x80 cuadriláteros) + cuántos vértices + por cada vértice los índices de sus datos (posición, normal, color, uv…),
//     en el orden y tamaño que dice el "descriptor de vértice" (VCD) del objeto.
//
// Uso:  import { triangulosBrres } from './brres.mjs';  triangulosBrres(bytes) → [[x,y,z, x,y,z, x,y,z], …]

import { decodificar } from './szs.mjs';

const texto = (b, p) => { let s = ''; while (b[p]) s += String.fromCharCode(b[p++]); return s; };

// Una carpeta ("index group"): u32 largo, u32 cuántas, y entradas de 16 bytes (la primera es la raíz del árbol).
// Nombre y dato van como distancias desde el comienzo de la carpeta.
function carpeta(v, b, p) {
  const n = v.getInt32(p + 4), salida = [];
  for (let i = 1; i <= n; i++) {
    const e = p + 8 + i * 16;
    salida.push({ nombre: texto(b, p + v.getInt32(e + 8)), dato: p + v.getInt32(e + 12) });
  }
  return salida;
}

export function modelosBrres(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (texto(b, 0).slice(0, 4) !== 'bres') throw new Error('no es un BRRES');
  const raiz = v.getUint16(0xC);                                   // la sección "root"
  const grupos = carpeta(v, b, raiz + 8);
  const modelos = grupos.find(g => g.nombre === '3DModels(NW4R)');
  return modelos ? carpeta(v, b, modelos.dato).map(m => ({ nombre: m.nombre, p: m.dato })) : [];
}

// Triángulos de todos los modelos del archivo, en coordenadas del mundo (con el hueso de cada objeto aplicado)
export function triangulosBrres(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tris = [];
  for (const { p: m } of modelosBrres(b)) {
    if (texto(b, m).slice(0, 4) !== 'MDL0') continue;
    const version = v.getUint32(m + 8);
    const nSecciones = { 8: 11, 9: 11, 10: 14, 11: 14 }[version];
    if (!nSecciones) throw new Error('MDL0 versión ' + version);
    const seccion = i => { const o = v.getInt32(m + 0x10 + 4 * i); return o ? carpeta(v, b, m + o) : []; };
    const iObjetos = nSecciones === 14 ? 10 : 8;
    // vértices: cabecera con dato (desde la cabecera), componentes (0 = xy, 1 = xyz), formato, divisor, paso, cuántos
    const vertices = seccion(2).map(({ dato: h }) => {
      const datos = h + v.getInt32(h + 8), comps = v.getUint32(h + 0x14) ? 3 : 2, formato = v.getUint32(h + 0x18);
      const div = 1 << b[h + 0x1C], paso = b[h + 0x1D], cuantos = v.getUint16(h + 0x1E);
      const leer = [q => b[q], q => v.getInt8(q), q => v.getUint16(q), q => v.getInt16(q), q => v.getFloat32(q)][formato];
      const tam = [1, 1, 2, 2, 4][formato];
      return i => { const q = datos + i * paso, r = []; for (let k = 0; k < comps; k++) r.push(leer(q + k * tam) / (formato === 4 ? 1 : div)); if (comps === 2) r.push(0); return r; };
    });
    // huesos: cada objeto cuelga de uno (cabecera del objeto +8) que lo escala, gira y mueve: escala (+0x20, 3 números),
    // giro en grados (+0x2C, x-y-z) y traslado (+0x38). Hay que aplicarlo: p. ej. el mapa de GCN Baby Park está girado
    // 90° y agrandado 1,2 veces, y el de DS Tick-Tock Clock agrandado 1,2 (sin esto la largada cae fuera del camino).
    // (La matriz ya calculada que trae el hueso suele venir en blanco, así que se arma con esos números.)
    const huesos = new Map();
    for (const { dato: h } of seccion(1)) {
      const f = k => v.getFloat32(h + k), rad = Math.PI / 180;
      const [sx, sy, sz, rx, ry, rz, tx, ty, tz] = [0x20, 0x24, 0x28, 0x2C, 0x30, 0x34, 0x38, 0x3C, 0x40].map(f);
      const [cx, sx_] = [Math.cos(rx * rad), Math.sin(rx * rad)], [cy, sy_] = [Math.cos(ry * rad), Math.sin(ry * rad)], [cz, sz_] = [Math.cos(rz * rad), Math.sin(rz * rad)];
      // (las pistas nuevas a veces numeran todos los huesos 0: vale el primero, que es la raíz "map"; los otros dos,
      // posLD y posRU, solo marcan las esquinas del mapa)
      if (huesos.has(v.getUint32(h + 0xC))) continue;
      huesos.set(v.getUint32(h + 0xC), ([x, y, z]) => {
        x *= sx; y *= sy; z *= sz;                                                   // escala
        [y, z] = [cx * y - sx_ * z, sx_ * y + cx * z];                               // giro en x
        [x, z] = [cy * x + sy_ * z, -sy_ * x + cy * z];                              // giro en y
        [x, y] = [cz * x - sz_ * y, sz_ * x + cz * y];                               // giro en z
        return [x + tx, y + ty, z + tz];                                             // traslado
      });
    }
    for (const { dato: o } of seccion(iObjetos)) {
      const hueso = huesos.get(v.getInt32(o + 8)) || (p => p);
      // El descriptor de vértice verdadero es el que se carga en la GPU: los registros CP 0x50 (VCD bajo) y 0x60 (VCD
      // alto) dentro del bloque de declaración del objeto (códigos 08 50 …, 08 60 …). La copia en la cabecera del objeto
      // (+0xC) no siempre coincide (las pistas hechas con otras herramientas la dejan mal), así que solo es el respaldo.
      let lo = v.getUint32(o + 0xC), hi = v.getUint32(o + 0x10);
      const decl = o + 0x18 + v.getInt32(o + 0x18 + 8), tamDecl = v.getInt32(o + 0x18 + 4);
      for (let q = decl; q + 6 <= decl + tamDecl; q++) {
        if (b[q] !== 0x08) continue;
        if (b[q + 1] === 0x50) { lo = v.getUint32(q + 2); q += 5; } else if (b[q + 1] === 0x60) { hi = v.getUint32(q + 2); q += 5; }
      }
      const prim = o + 0x24 + v.getInt32(o + 0x24 + 8), largo = v.getInt32(o + 0x24 + 4);   // (la distancia cuenta desde el comienzo de ese bloque)
      const idVert = v.getInt16(o + 0x48);
      const pos = vertices[idVert];
      if (!pos) continue;
      // el tamaño de cada dato del vértice, en el orden del descriptor: índices de matriz (1 byte cada uno si están),
      // posición, normal, color 0 y 1, uv 0..7 (0 = no está, 1 = directo, 2 = índice de 8 bits, 3 = de 16)
      const campos = [];
      if (lo & 1) campos.push(['mtx', 1]);
      for (let t = 0; t < 8; t++) if (lo & (1 << (1 + t))) campos.push(['mtx', 1]);
      const modoPos = (lo >> 9) & 3;
      const resto = [(lo >> 11) & 3, (lo >> 13) & 3, (lo >> 15) & 3];
      for (let t = 0; t < 8; t++) resto.push((hi >> (2 * t)) & 3);
      if (modoPos < 2) throw new Error('posiciones directas (no soportado)');
      campos.push(['pos', modoPos === 2 ? 1 : 2]);
      for (const r of resto) { if (r === 1) throw new Error('dato directo (no soportado)'); if (r) campos.push(['otro', r === 2 ? 1 : 2]); }
      // recorrer la lista de dibujo
      let q = prim;
      const fin = prim + largo;
      while (q < fin) {
        const op = b[q++];
        if (op === 0) continue;                                       // NOP (relleno)
        if (op === 0x08) { q += 5; continue; }                        // carga de registro CP
        if (op === 0x10) { const n = v.getUint16(q) + 1; q += 4 + 4 * n; continue; }   // carga de XF
        if (op === 0x20 || op === 0x28 || op === 0x30 || op === 0x38) { q += 4; continue; }  // XF indexado (matrices)
        const tipo = op & 0xF8;
        if (tipo < 0x80 || tipo > 0xB8) break;                        // algo que no se entiende: se corta este objeto
        const n = v.getUint16(q); q += 2;
        const ps = [];
        for (let k = 0; k < n; k++) {
          for (const [nombre, tam] of campos) {
            if (nombre === 'pos') ps.push(hueso(pos(tam === 1 ? b[q] : v.getUint16(q))));
            q += tam;
          }
        }
        const tri = (a, c, d) => tris.push([...ps[a], ...ps[c], ...ps[d]]);
        if (tipo === 0x90) for (let k = 0; k + 2 < n; k += 3) tri(k, k + 1, k + 2);
        else if (tipo === 0x98) for (let k = 0; k + 2 < n; k++) tri(k, k + 1, k + 2);
        else if (tipo === 0xA0) for (let k = 1; k + 1 < n; k++) tri(0, k, k + 1);
        else if (tipo === 0x80) for (let k = 0; k + 3 < n; k += 4) { tri(k, k + 1, k + 2); tri(k, k + 2, k + 3); }
      }
    }
  }
  return tris;
}

// Las texturas del archivo (carpeta "Textures(NW4R)", cada una un TEX0): [{ nombre, ancho, alto, rgba }]. Algunas pistas
// no traen el mapa chico como forma sino como DIBUJO pegado en un cuadrado de 2 triángulos: entonces se usa la textura.
// TEX0: +0x10 dónde empiezan los píxeles (desde la cabecera), +0x1C ancho, +0x1E alto, +0x20 formato (los de TPL).
export function texturasBrres(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const raiz = v.getUint16(0xC);
  const grupo = carpeta(v, b, raiz + 8).find(g => g.nombre === 'Textures(NW4R)');
  if (!grupo) return [];
  return carpeta(v, b, grupo.dato).map(({ nombre, dato: h }) => {
    const ancho = v.getUint16(h + 0x1C), alto = v.getUint16(h + 0x1E), formato = v.getUint32(h + 0x20);
    try { return { nombre, ancho, alto, rgba: decodificar(b, h + v.getInt32(h + 0x10), ancho, alto, formato) }; } catch { return null; }
  }).filter(Boolean);
}
