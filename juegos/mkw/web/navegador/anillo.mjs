// Los anillos de subida de aurora (G3 y H12 del plan de rendimiento, bitácora §181), del lado de la página.
//
// Resumen: aurora (terceros/Wiicompiled/aurora-main/lib/gfx/common.cpp) guarda en la tarjeta, en un ANILLO detrás de
// cada búfer, los vértices, índices y arreglos ya subidos, y no los vuelve a subir mientras no cambien. Este módulo
// tiene dos cosas:
//   - envAnillo(valor de ?anillo): la variable MKW_ANILLO que la página le pasa al juego (?anillo=0 = como antes,
//     ?anillo=verifica = además comparar cada acierto con su huella, ?anillo=1 o nada = prendido);
//   - crearAnillo: el MISMO reparto que el C++ (en JS, para el banco `anillo`, sin el juego): dónde cae cada entrada,
//     cuándo una sirve todavía, cuándo se vuelve a escribir y cuánto puede escribir un lote. Si se cambia una regla en
//     common.cpp, se cambia aquí y el banco la vuelve a probar.

// ?anillo → MKW_ANILLO (undefined = no tocar: lo que diga el programa)
export function envAnillo(valor) {
  if (valor == null) return undefined;
  return { '0': '0', verifica: '2', '2': '2' }[valor] ?? '1';
}

// N14 (§181, el mismo paso del plan): ?caliente → MKW_CALIENTE, las funciones calientes reescritas
// (web/juego/caliente_nativo.cpp): 0 = las traducidas, 1 = las nuestras, comprobar = las dos en cada llamada.
// (Solo en un programa compilado con MKW_CALIENTE_COMPILAR=1; en los otros no cambia nada.)
export function envCaliente(valor) {
  if (valor == null) return undefined;
  return { '0': '0', '1': '1', comprobar: '2', '2': '2' }[valor] ?? '1';
}

// Un anillo de `tam` bytes: entradas de `len` bytes (múltiplo de 4) en posiciones virtuales que solo crecen.
// Las reglas (iguales a las de common.cpp):
//   - una entrada nunca queda partida en el borde: si no cabe, va al principio de la vuelta siguiente;
//   - una entrada mide a lo más tam/8 y un lote escribe a lo más tam/4 (contando el salto de vuelta);
//   - una entrada sirve mientras la cabeza no le dio la vuelta encima (cabeza <= pos + tam) y está a media vuelta o
//     menos (cabeza - pos <= tam/2); si no, se vuelve a escribir.
// Por eso lo que un dibujo usa nunca se pisa dentro del mismo lote: al usarla está a ≤ tam/2, el lote suma ≤ tam/4 y la
// entrada mide ≤ tam/8.
export function crearAnillo(tam, alinear = 4) {
  const a = { tam, cabeza: 0, inicioLote: 0, escrito: 0, reusado: 0, fuera: 0, mapa: new Map() };
  const vale = (e, len) => !!e && e.len === len && a.cabeza <= e.pos + tam && a.cabeza - e.pos <= tam / 2;
  // lugar para len bytes, o null si no entra en este lote
  function poner(len) {
    if (len > tam / 8) return null;
    let pos = Math.ceil(a.cabeza / alinear) * alinear;
    if ((pos % tam) + len > tam) pos = (Math.floor(pos / tam) + 1) * tam;
    if (pos + len - a.inicioLote > tam / 4) return null;
    a.cabeza = pos + len;
    return pos;
  }
  // un contenido (clave) de len bytes: devuelve { pos, fisica, nuevo } o null (= no entró: va por la parte de siempre)
  function usar(clave, len) {
    len = Math.ceil(len / 4) * 4;
    const e = a.mapa.get(clave);
    if (vale(e, len)) { a.reusado += len; return { pos: e.pos, fisica: e.pos % tam, nuevo: false }; }
    const pos = poner(len);
    if (pos == null) { a.fuera++; return null; }
    a.mapa.set(clave, { pos, len });
    a.escrito += len;
    return { pos, fisica: pos % tam, nuevo: true };
  }
  function cerrarLote() { a.inicioLote = a.cabeza; }
  // ¿los bytes [pos, pos+len) siguen intactos? (nadie escribió encima después)
  const intacta = (pos, len) => a.cabeza <= pos + tam;
  return { a, usar, cerrarLote, vale, intacta };
}
