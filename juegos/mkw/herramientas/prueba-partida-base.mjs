// Prueba de herramientas/partida-base.mjs (bitácora §175), con un rksys.dat inventado (la forma del de MKW, nada del
// juego): las licencias quedan vacías como la casilla de molde, los fantasmas en ceros, el CRC32 al día, y una partida
// sin casilla vacía o que no es rksys.dat da error.   Uso: node herramientas/prueba-partida-base.mjs
import { crc32 } from 'node:zlib';
import { limpiarRksys } from './partida-base.mjs';

let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`); };
const TAM = 0x8CC0, ini = i => 8 + i * TAM;

// Una partida inventada: cabecera RKSD0006, licencia 1 hecha (RKPD + nombre), las otras 3 vacías con unos bytes por
// omisión iguales entre sí, opciones globales, un fantasma y el CRC del final
function inventada(licencias = [0]) {
  const b = Buffer.alloc(0x2BC000);
  b.write('RKSD0006', 0, 'latin1');
  for (let i = 0; i < 4; i++) { b[ini(i) + 0x100] = 7; b[ini(i) + 0x2000] = 3; }
  for (const i of licencias) { b.write('RKPD', ini(i), 'latin1'); b.write('n\0o\0', ini(i) + 0x14, 'latin1'); b[ini(i) + 0x100] = 99; }
  b[0x23400] = 5;
  b.fill(0xAB, 0x28000, 0x28100);
  b.writeUInt32BE(crc32(b.subarray(0, 0x27FFC)) >>> 0, 0x27FFC);
  return b;
}

const { bytes, habia } = limpiarRksys(inventada([0]));
ok('cuenta las licencias que había', habia === 1, String(habia));
ok('ninguna licencia empieza con «RKPD»', [0, 1, 2, 3].every(i => bytes.toString('latin1', ini(i), ini(i) + 4) !== 'RKPD'));
ok('las 4 casillas quedan iguales a la vacía de molde', [0, 1, 2, 3].every(i => bytes.subarray(ini(i), ini(i) + TAM).equals(bytes.subarray(ini(1), ini(1) + TAM))));
ok('…con sus bytes por omisión (no en ceros)', bytes[ini(0) + 0x100] === 7 && bytes[ini(0) + 0x2000] === 3);
ok('las opciones de fuera de las licencias no se tocan', bytes[0x23400] === 5);
ok('los fantasmas quedan en ceros', bytes.subarray(0x28000).every(v => v === 0));
ok('el CRC32 de 0x27FFC está al día', bytes.readUInt32BE(0x27FFC) === (crc32(bytes.subarray(0, 0x27FFC)) >>> 0));
ok('una partida ya limpia queda igual', limpiarRksys(bytes).bytes.equals(bytes));
let error = '';
try { limpiarRksys(inventada([0, 1, 2, 3])); } catch (e) { error = e.message; }
ok('con las 4 licencias ocupadas, error (no hay molde)', /ocupadas/.test(error), error);
error = '';
try { limpiarRksys(Buffer.alloc(0x30000)); } catch (e) { error = e.message; }
ok('un archivo que no es rksys.dat, error', /no es/.test(error), error);
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
