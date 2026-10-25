// node banco/pruebas/thp/prueba-node.mjs  → prueba el decodificador THP nativo en Node (V8, igual que Chrome).
// Antes: construir.ps1 (compila thp.js + thp.wasm).
import { correTHP } from './prueba.mjs';
const crea = (await import(new URL('thp.js', import.meta.url))).default;
let bien = 0, mal = 0;
const ok = (n, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
await correTHP(crea, ok, s => console.log('· ' + s));
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
