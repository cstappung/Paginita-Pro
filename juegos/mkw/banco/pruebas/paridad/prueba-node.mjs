// node banco/pruebas/paridad/prueba-node.mjs [--simd]  → corre la paridad en Node (V8, igual que Chrome).
// --simd: usa paridad-simd.js (compilado con -msimd128: construir.ps1 -Simd).
import { readFileSync } from 'node:fs';
import { correParidad } from './prueba.mjs';
const aqui = new URL('.', import.meta.url);
const crea = (await import(new URL(process.argv.includes('--simd') ? 'paridad-simd.js' : 'paridad.js', aqui))).default;
let bien = 0, mal = 0;
const ok = (n, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
await correParidad(crea, readFileSync(new URL('referencia-x86.txt', aqui), 'utf8'), ok, s => console.log('· ' + s));
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
