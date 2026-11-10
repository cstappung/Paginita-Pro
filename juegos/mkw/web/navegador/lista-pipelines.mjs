// La lista de pipelines de aurora, del lado de JavaScript (C2 del plan de rendimiento, bitácora §174). Puro: sin el juego.
//
// Resumen: aurora (pipeline_cache.cpp del parche) guarda los pipelines que usó el juego en una lista que la próxima visita
// precalienta (le pide al navegador que los compile antes de que hagan falta). Desde §174 cada uno lleva una ETIQUETA,
// dónde se usó: 0 = los menús, 1 = la carrera de dos pistas o más («común»), 0x10000 + la pista de Pulsar = solo esa pista,
// 0xFFFFFFFF = sin etiqueta (una lista del formato viejo). Al arrancar se precalientan los de los menús, los comunes, los
// sin etiqueta y los urgentes (C3: primer cuadro 0); los de una pista, cuando se elige esa pista. Aquí están las mismas
// reglas que en aurora (para la herramienta que arma la semilla, juntar-pipelines.mjs, y para el banco):
//   leer(bytes) → [{ tipo, version, cuadro, etiqueta, visita, config }]   (formato "MKWPIPE1" o "MKWPIPE2")
//   escribir(lista) → bytes "MKWPIPE2"
//   combinar(a, b): dos etiquetas de un mismo pipeline (los menús ganan; dos pistas distintas = común)
//   juntar(listas) → una lista sin repetidos (primer cuadro el menor, etiquetas combinadas, visita 0: la semilla no se poda)
//   alArrancar(e): ¿va al precalentado del arranque?   podar(e, visita): ¿sale de la lista propia en esa visita?
// Formato (little-endian): "MKWPIPE1", u32 cantidad y por cada una u32 tipo, u32 versión, u32 primer cuadro, u32 tamaño y
// la configuración; "MKWPIPE2" igual pero con u32 etiqueta y u32 visita después del primer cuadro.

export const SIN = 0xFFFFFFFF, MENUS = 0, COMUN = 1, PODA = 8;
export const dePista = pista => 0x10000 + pista;
export const esDePista = e => e !== SIN && e !== MENUS && e !== COMUN;

export const combinar = (a, b) => a === SIN ? b : b === SIN ? a : (a === MENUS || b === MENUS) ? MENUS : a === b ? a : COMUN;
export const alArrancar = e => !esDePista(e.etiqueta) || e.cuadro === 0;
export const podar = (e, visita) => esDePista(e.etiqueta) && e.visita + PODA < visita;

export function leer(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const magia = String.fromCharCode(...b.subarray(0, 8));
  if (b.length < 12 || (magia !== 'MKWPIPE1' && magia !== 'MKWPIPE2')) throw new Error('no es una lista de pipelines');
  const v2 = magia === 'MKWPIPE2', cab = v2 ? 24 : 16, n = dv.getUint32(8, true), lista = [];
  let o = 12;
  for (let i = 0; i < n && o + cab <= b.length; i++) {
    const tam = dv.getUint32(o + cab - 4, true);
    if (o + cab + tam > b.length) break;
    lista.push({ tipo: dv.getUint32(o, true), version: dv.getUint32(o + 4, true), cuadro: dv.getUint32(o + 8, true),
                 etiqueta: v2 ? dv.getUint32(o + 12, true) : SIN, visita: v2 ? dv.getUint32(o + 16, true) : 0,
                 config: b.subarray(o + cab, o + cab + tam) });
    o += cab + tam;
  }
  return lista;
}

export function escribir(lista) {
  const b = new Uint8Array(12 + lista.reduce((s, x) => s + 24 + x.config.length, 0));
  const dv = new DataView(b.buffer);
  for (let i = 0; i < 8; i++) b[i] = 'MKWPIPE2'.charCodeAt(i);
  dv.setUint32(8, lista.length, true);
  let o = 12;
  for (const x of lista) {
    [x.tipo, x.version, x.cuadro, x.etiqueta, x.visita || 0, x.config.length].forEach((v, k) => dv.setUint32(o + 4 * k, v >>> 0, true));
    b.set(x.config, o + 24);
    o += 24 + x.config.length;
  }
  return b;
}

const claveDe = x => `${x.tipo}|${x.version}|${Array.from(x.config, v => v.toString(16).padStart(2, '0')).join('')}`;
export function juntar(listas) {
  const todos = new Map();
  for (const lista of listas) for (const x of lista) {
    const k = claveDe(x), v = todos.get(k);
    if (v) { v.cuadro = Math.min(v.cuadro, x.cuadro); v.etiqueta = combinar(v.etiqueta, x.etiqueta); }
    else todos.set(k, { ...x, visita: 0 });
  }
  return [...todos.values()].sort((a, b) => a.cuadro - b.cuadro);   // (los urgentes, cuadro 0, primero)
}

// Para contar: cuántos al arranque, cuántos esperan pista y de cuántas pistas
export function resumen(lista) {
  const arranque = lista.filter(alArrancar).length, pistas = new Set(lista.filter(x => !alArrancar(x)).map(x => x.etiqueta));
  const de = e => lista.filter(x => x.etiqueta === e).length;
  return { total: lista.length, arranque, esperan: lista.length - arranque, pistas: pistas.size,
           menus: de(MENUS), comun: de(COMUN), sin: de(SIN), urgentes: lista.filter(x => x.cuadro === 0).length };
}
