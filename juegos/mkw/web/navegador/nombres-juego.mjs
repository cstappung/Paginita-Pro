// Los nombres de la sala dentro del juego (M22, bitácora §98): lo que la página le pasa a web/juego/nombres_nativo.cpp
// y lo que lee de él.
//
// Resumen: el juego escribe sobre cada kart (y en sus tablas de resultados) el nombre del Mii de ese puesto. La página
// le da el nombre de cada humano de la sala —el mismo en todas las consolas, el que manda el sitio— y la cara de
// invitado de su Mii (si no tiene uno), y después lee cómo nombra el juego a cada CPU (con las skins de Retro Rewind y
// en el idioma del juego) para las tablas de la página.
//   nombreParaJuego(texto) → hasta 10 letras que la letra del juego puede escribir (sin emoji ni controles)
//   caraDe(uid)            → uno de los 6 invitados (0..5), siempre el mismo para ese uid
//   escribirNombres(M, humanos, nombreDe) → llena el búfer del juego (humanos[i] = el puesto i de la carrera)
//   leerNombresCpu(M)      → { listo, nombres: [12 textos o null] } (null = no es CPU o el juego no lo dio)
//   leerSkins(M) / escribirSkins(M, skins) → las skins de las CPU que sorteó esta consola al armar la carrera (RR las
//     sortea en la 1.ª) y las de la sala, que el juego pone al armar cada carrera (así quien recargó, o quien volvió a
//     elegir —pasar por la pantalla de personajes las borra—, ve las mismas CPU que los demás). Las lee el C++: el
//     lector de la página (menus.mjs) no llega a 0x818A08A8
// Memoria de wasm (little-endian), como las estructuras de nombres_nativo.cpp:
//   Nombres:    nombre u16[12][11] (0) · hay u8[12] (264) · cara u8[12] (276) · activo i32 (288)
//   NombresCpu: listo i32 (0) · mensaje i32[12] (4) · texto u16[12][32] (52)
//   Skins:      hay i32 (0) · skin u8[12] (4) · leidas u8[12] (16)
export const SKINS_RR = 0x818A08A8;              // racePlayerSlots de Retro Rewind: la skin de cada puesto (u8[12])
export const LETRAS_NOMBRE = 10;
const N = { nombre: 0, hay: 264, cara: 276, activo: 288 };
const C = { listo: 0, mensaje: 4, texto: 52 };

// Hasta 10 letras del plano básico de Unicode (la fuente del juego no tiene emoji: saldrían como cajas), sin
// caracteres de control, con los espacios juntos. Vacío → 'Piloto'.
export function nombreParaJuego(texto) {
  const limpio = String(texto ?? '').normalize('NFC').replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '').replace(/[\uD800-\uDFFF️​-‏]/g, '').replace(/\s+/g, ' ').trim();
  return [...(limpio || 'Piloto')].slice(0, LETRAS_NOMBRE).join('').trimEnd() || 'Piloto';
}

// La cara de invitado de cada uno: un número fijo sacado de su uid (igual en todas las consolas)
export function caraDe(uid) {
  let h = 2166136261;
  for (const ch of String(uid ?? '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 6;
}

export function escribirNombres(M, humanos, nombreDe) {
  if (typeof M?._mkw_nombres !== 'function' || !M.HEAPU8) return false;
  const base = M._mkw_nombres(), v = new DataView(M.HEAPU8.buffer);
  for (let i = 0; i < 12; i++) {
    const h = humanos?.[i];
    const letras = h ? nombreParaJuego(nombreDe(h.uid)) : '';
    for (let k = 0; k < 11; k++) v.setUint16(base + N.nombre + 2 * (11 * i + k), k < letras.length ? letras.charCodeAt(k) : 0, true);
    v.setUint8(base + N.hay + i, h ? 1 : 0);
    v.setUint8(base + N.cara + i, h ? caraDe(h.uid) : 0xFF);
  }
  v.setInt32(base + N.activo, 1, true);
  return true;
}

export function leerSkins(M) {
  if (typeof M?._mkw_nombres_skins !== 'function' || !M.HEAPU8) return null;
  const base = M._mkw_nombres_skins();
  return Array.from(M.HEAPU8.subarray(base + 16, base + 28));
}
export function escribirSkins(M, skins) {
  if (typeof M?._mkw_nombres_skins !== 'function' || !M.HEAPU8) return false;
  const base = M._mkw_nombres_skins(), v = new DataView(M.HEAPU8.buffer);
  const ok = Array.isArray(skins) && skins.length === 12 && skins.every(x => Number.isInteger(x) && x >= 0 && x <= 100);
  for (let j = 0; j < 12; j++) v.setUint8(base + 4 + j, ok ? skins[j] : 0);
  v.setInt32(base, ok ? 1 : 0, true);
  return ok;
}

export function leerNombresCpu(M) {
  if (typeof M?._mkw_nombres_cpu !== 'function' || !M.HEAPU8) return { listo: 0, nombres: Array(12).fill(null), mensajes: [] };
  const base = M._mkw_nombres_cpu(), v = new DataView(M.HEAPU8.buffer);
  const nombres = [], mensajes = [];
  for (let j = 0; j < 12; j++) {
    mensajes.push(v.getInt32(base + C.mensaje + 4 * j, true));
    let t = '';
    for (let k = 0; k < 32; k++) { const c = v.getUint16(base + C.texto + 2 * (32 * j + k), true); if (!c) break; t += String.fromCharCode(c); }
    nombres.push(t.trim() || null);
  }
  return { listo: v.getInt32(base + C.listo, true), nombres, mensajes };
}
