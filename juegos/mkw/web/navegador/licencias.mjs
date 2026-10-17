// Las licencias de Mario Kart Wii: leer, revisar y resumir una partida (rksys.dat) — bitácora §55.
//
// Resumen: la partida del juego es UN archivo, rksys.dat (2,8 MB). Adentro van hasta 4 "licencias" (los perfiles que
// el juego muestra al empezar: cada una con su Mii, sus récords, su VR…). Este módulo lo lee para que la página pueda
// mostrarle a una persona QUÉ tiene guardado ("Juan · VR 5.230 · 812 carreras") y para revisar un archivo antes de
// cargarlo (que sea de verdad una partida de MKW, que no esté dañado). No toca el juego: solo lee bytes.
//
// El formato es público (mkwiiki.org/wiki/Rksys.dat, antes Tockdom; todo big-endian, como la Wii):
//   0x00  "RKSD"  0x04  "0006" (versión)          tamaño total 0x2BC000 bytes
//   0x08 + n·0x8CC0   la licencia n (n = 0..3), cada una empieza con "RKPD" si existe (ceros si la casilla está vacía)
//     +0x14  nombre del Mii, UTF-16 big-endian, 10 caracteres (relleno con ceros)
//     +0x28  ID del Mii (avatar)  +0x2C  ID de la consola que lo creó (cliente): así el juego encuentra el Mii en la
//            base de Mii de la Wii (RFL_DB.dat, ver mii.mjs)
//     +0x5C  ID de perfil de Nintendo WFC (de ahí sale el código de amigo; 0 = nunca entró en línea)
//     +0x88…+0xAC  victorias y derrotas (VS, batalla, en línea, fantasmas), +0xB0 VR, +0xB2 BR, +0xB4 carreras totales
//   0x27FFC  CRC-32 (el mismo de zip/PNG) de todo lo anterior, 0x0000..0x27FFB. Si no cuadra, el juego dice que la
//            partida está dañada y ofrece BORRARLA: por eso aquí un archivo con el CRC malo no se carga.
//
// Una partida de la Wii original (Wii/title/00010000/524d4350/data/rksys.dat) y una de Retro Rewind
// (riivolution/save/RetroWFC/RMCP/rksys.dat) tienen el mismo formato: cualquiera sirve.

import { codigoDesdePid } from './salas.mjs';

export const TAM_RKSYS = 0x2BC000;
export const RUTA_RKSYS = '/mkw/sd/riivolution/save/RetroWFC/RMCP/rksys.dat';   // donde la busca Retro Rewind
const INICIO_LICENCIA = 0x08, TAM_LICENCIA = 0x8CC0, POS_CRC = 0x27FFC;

// CRC-32 (polinomio 0xEDB88320 reflejado, el de zip): una tabla de 256 valores y un byte a la vez
let tabla = null;
export function crc32(bytes, desde = 0, hasta = bytes.length) {
  if (!tabla) {
    tabla = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tabla[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = desde; i < hasta; i++) c = tabla[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const texto4 = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
// UTF-16 big-endian de largo fijo, hasta el primer 0
export function utf16be(b, i, caracteres) {
  let s = '';
  for (let k = 0; k < caracteres; k++) { const c = (b[i + 2 * k] << 8) | b[i + 2 * k + 1]; if (!c) break; s += String.fromCharCode(c); }
  return s;
}

// Revisa un archivo y dice qué es. Devuelve { tipo: 'rksys', valido, problema, licencias: [...] } — nunca lanza.
export function leerRksys(bytes) {
  const r = { tipo: 'rksys', valido: false, problema: '', licencias: [], crcBien: false };
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes || 0);
  if (bytes.length < 8 || texto4(bytes, 0) !== 'RKSD') { r.problema = 'no es una partida de Mario Kart Wii (no empieza con «RKSD»)'; return r; }
  if (bytes.length !== TAM_RKSYS) {
    r.problema = `tiene ${bytes.length.toLocaleString('es')} bytes y una partida de Mario Kart Wii tiene ${TAM_RKSYS.toLocaleString('es')}`;
    return r;
  }
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  r.version = texto4(bytes, 4);
  r.crcBien = v.getUint32(POS_CRC) === crc32(bytes, 0, POS_CRC);
  for (let n = 0; n < 4; n++) {
    const b = INICIO_LICENCIA + n * TAM_LICENCIA;
    if (texto4(bytes, b) !== 'RKPD') continue;
    const pid = v.getUint32(b + 0x5C);
    r.licencias.push({
      casilla: n + 1,
      nombre: utf16be(bytes, b + 0x14, 10) || 'Sin nombre',
      miiId: v.getUint32(b + 0x28), consolaId: v.getUint32(b + 0x2C),
      vr: v.getUint16(b + 0xB0), br: v.getUint16(b + 0xB2),
      carreras: v.getInt32(b + 0xB4), batallas: v.getInt32(b + 0xB8),
      victoriasVs: v.getInt32(b + 0x88), victoriasEnLinea: v.getInt32(b + 0x98),
      codigoAmigo: pid ? codigoDesdePid(pid) : '',
    });
  }
  if (!r.crcBien) { r.problema = 'el archivo está dañado (su suma de control no cuadra): el juego lo rechazaría y ofrecería borrarlo'; return r; }
  r.valido = true;
  return r;
}

// Una línea para mostrar una licencia: "Juan · VR 5.230 · 812 carreras"
export function resumenLicencia(l) {
  const partes = [];
  if (l.vr) partes.push(`VR ${l.vr.toLocaleString('es')}`);
  if (l.carreras > 0) partes.push(`${l.carreras.toLocaleString('es')} carrera${l.carreras === 1 ? '' : 's'}`);
  return partes.join(' · ');
}

// ¿Qué archivo es? Por el contenido, no por el nombre: un rksys.dat, un paquete .mkwp (gzip que adentro dice "MKWP"),
// una base de Mii (RFL_DB.dat, "RNOD") o un Mii suelto (.mii, 74 bytes)
export function queArchivo(bytes) {
  if (bytes.length >= 4 && texto4(bytes, 0) === 'RKSD') return 'rksys';
  if (bytes.length >= 2 && bytes[0] === 0x1F && bytes[1] === 0x8B) return 'paquete';
  if (bytes.length >= 4 && texto4(bytes, 0) === 'RNOD') return 'rfldb';
  if (bytes.length === 74 || bytes.length === 76) return 'mii';
  return 'otro';
}
