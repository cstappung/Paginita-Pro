// La partida base que reciben las páginas (bitácora §175): una copia fija y limpia de terceros/RetroRewind/riivolution.
//
// Resumen: la página arranca el juego con la partida de Retro Rewind que sirve el servidor en /mkw/sd/riivolution/
// (`save/RetroWFC/RMCP/rksys.dat`, el archivo de guardado, y el XML de Riivolution). Si el navegador no tiene partidas
// guardadas, esa es la que ve el juego: debe tener las 4 licencias vacías («NEW»). Pero el juego corrido en Node y como
// programa de Windows (las mediciones de §153–§170: medir-node-estable, perfil-impuesto…) escribe su partida en esa
// MISMA carpeta (el runtime manda la partida de RR a <retro_rewind_root>/../riivolution/save), y el guion de botones de
// §165 crea una licencia («no name»). Desde entonces cada perfil nuevo de Chrome recibía una licencia ya hecha y las
// pruebas que la crean o recorren los menús con teclas (partidas, menus, invitados…) se iban a otro lado.
// Es como alimentar el banco de pruebas desde la misma barra que usa otro equipo: lo que ese equipo deja conectado
// aparece en tu medición. La solución es una barra propia: esta copia fija.
//
// Qué hace: copia la carpeta a build/web/partida-base/ (una sola vez; con --rehacer otra vez) y, en rksys.dat, deja
// las 4 licencias como una vacía (la casilla que no empieza con «RKPD» sirve de molde: así las escribe el juego) y
// vuelve a calcular el CRC32 del final de la parte principal (0x27FFC, sobre 0..0x27FFB; formato de Tockdom). Los
// fantasmas (desde 0x28000) se dejan en ceros. Es una partida del juego: queda en build/ (nunca a git).
//
// Para el juego fuera del navegador (Node y Windows), cada corrida con su propia copia: herramientas/partida-aislada.mjs.
//
// Uso:  node herramientas/partida-base.mjs [--rehacer]      (servidor.mjs, worker-local.mjs, diminutos.mjs y
//       subir-r2.mjs llaman a carpetaPartidaBase(raiz), que la arma si falta)
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const LICENCIAS = 4, INICIO = 0x08, TAM = 0x8CC0, FIN_CRC = 0x27FFC, FANTASMAS = 0x28000;

// rksys.dat → la misma partida con las 4 licencias vacías y el CRC al día. Devuelve { bytes, habia } (habia = cuántas
// licencias tenía). Lanza un error si no reconoce el archivo o no hay ninguna casilla vacía para usar de molde.
export function limpiarRksys(original) {
  const b = Buffer.from(original);
  if (b.length < FANTASMAS || b.toString('latin1', 0, 4) !== 'RKSD') throw new Error('no es un rksys.dat');
  const esLicencia = i => b.toString('latin1', INICIO + i * TAM, INICIO + i * TAM + 4) === 'RKPD';
  const habia = [...Array(LICENCIAS).keys()].filter(esLicencia).length;
  const molde = [...Array(LICENCIAS).keys()].find(i => !esLicencia(i));
  if (molde === undefined) throw new Error('las 4 licencias están ocupadas: no hay una vacía de molde');
  const vacia = Buffer.from(b.subarray(INICIO + molde * TAM, INICIO + (molde + 1) * TAM));
  for (let i = 0; i < LICENCIAS; i++) vacia.copy(b, INICIO + i * TAM);
  b.fill(0, FANTASMAS);
  b.writeUInt32BE(crc32(b.subarray(0, FIN_CRC)) >>> 0, FIN_CRC);
  return { bytes: b, habia };
}

// La carpeta que se sirve en /mkw/sd/riivolution/ (la arma la primera vez)
export function carpetaPartidaBase(raiz, { rehacer = false, nota = () => {} } = {}) {
  const origen = path.join(raiz, 'terceros/RetroRewind/riivolution');
  const destino = path.join(raiz, 'build/web/partida-base');
  const rk = path.join(destino, 'save/RetroWFC/RMCP/rksys.dat');
  if (existsSync(rk) && !rehacer) return destino;
  if (!existsSync(origen)) return origen;            // (sin Retro Rewind: lo de antes, que dará 404 igual)
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  cpSync(origen, destino, { recursive: true });
  if (existsSync(rk)) {
    const { bytes, habia } = limpiarRksys(readFileSync(rk));
    writeFileSync(rk, bytes);
    nota(`partida base: ${destino} (rksys.dat con ${habia} licencia${habia === 1 ? '' : 's'} → 0, CRC rehecho)`);
  }
  return destino;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(carpetaPartidaBase(raiz, { rehacer: process.argv.includes('--rehacer'), nota: console.log }));
}
