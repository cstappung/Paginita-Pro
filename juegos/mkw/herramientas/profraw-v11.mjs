// Arregla la cabecera de los perfiles de PGO que escribe el programa wasm (§198, W4).
//
// Resumen: el compilador de emsdk (LLVM 24) arma las fichas de cada función con el formato 11 (56 bytes en wasm32:
// suma el contador «uniforme» y el tamaño de onda), pero la copia de compiler-rt que trae emscripten es más vieja:
// escribe la cabecera del formato 10 (16 campos) y cuenta las fichas como si midieran 48 bytes. Los datos están
// bien; solo la cabecera miente. Este programa escribe la cabecera del formato 11 (19 campos) con la cantidad de
// fichas de verdad y copia el resto tal cual, así llvm-profdata de emsdk (que espera el 11) lo lee.
//
// Uso:  node herramientas/profraw-v11.mjs entrada.profraw salida.profraw
import { readFileSync, writeFileSync } from 'node:fs';

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) { console.error('uso: node herramientas/profraw-v11.mjs entrada.profraw salida.profraw'); process.exit(2); }
const b = readFileSync(entrada);
const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
const campo = (i) => v.getBigUint64(i * 8, true);          // la cabecera son números de 64 bits, little endian

const version = Number(campo(1));
if (version !== 10) { console.error(`${entrada}: versión ${version}, se esperaba 10 (nada que arreglar)`); process.exit(1); }
// formato 10: Magic, Version, BinaryIdsSize, NumData, PadAntesCont, NumCounters, PadDespCont, NumBitmapBytes,
// PadDespBitmap, NamesSize, CountersDelta, BitmapDelta, NamesDelta, NumVTables, VNamesSize, ValueKindLast
const [magia, , idsBin, numDatos10, padAntes, numCont, padDesp, numBitmap, padBitmap, nombres, deltaCont, deltaBitmap,
  deltaNombres, numVtablas, vnombres, ultimoValor] = Array.from({ length: 16 }, (_, i) => campo(i));
if (idsBin !== 0n || numBitmap !== 0n || numVtablas !== 0n) { console.error('perfil con secciones que este arreglo no conoce'); process.exit(1); }

const FICHA10 = 48n, FICHA11 = 56n;                         // tamaño de la ficha por función que cree cada parte
const bytesDatos = numDatos10 * FICHA10;                    // lo que el runtime de verdad copió de la sección de datos
// E4c (§228.1): el runtime copia NumData × 48 bytes, y si la sección (de fichas de 56) no es múltiplo de 48 la última
// ficha queda cortada: se la deja afuera (se pierde el perfil de UNA función) y se sacan sus bytes sueltos, así los
// contadores empiezan donde el formato 11 los espera
const numDatos = bytesDatos / FICHA11;
const sobra = Number(bytesDatos - numDatos * FICHA11);
if (sobra) console.log(`${entrada}: la última ficha venía cortada (${sobra} de 56 bytes): queda afuera`);

// formato 11: lo mismo más NumUniformCounters, PaddingBytesAfterUniformCounters y UniformCountersDelta (todo 0)
const nueva = [magia, 11n, 0n, numDatos, padAntes, numCont, padDesp, numBitmap, padBitmap, 0n, 0n, 0n, nombres,
  deltaCont, deltaBitmap, deltaNombres, numVtablas, vnombres, ultimoValor];
const cab = Buffer.alloc(nueva.length * 8);
nueva.forEach((x, i) => cab.writeBigUInt64LE(x, i * 8));
const inicio = 16 * 8, finFichas = inicio + Number(numDatos * FICHA11);
writeFileSync(salida, Buffer.concat([cab, b.subarray(inicio, finFichas), b.subarray(inicio + Number(bytesDatos))]));
console.log(`${entrada}: ${numDatos10} fichas de 48 → ${numDatos} de 56; ${numCont} contadores → ${salida}`);
