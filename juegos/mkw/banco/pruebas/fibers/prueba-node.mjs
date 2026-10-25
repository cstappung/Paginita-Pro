// La prueba de fibers en Node (sin navegador): node --experimental-wasm-jspi banco/pruebas/fibers/prueba-node.mjs
import { pathToFileURL } from 'node:url';
const crea = (await import(new URL('./fibers.js', import.meta.url))).default;
const M = await crea({ print: t => console.log('[wasm] ' + t) });
await M.callMain([]);
const orden = M.UTF8ToString(M._orden()), res = [1, 2, 3].map(i => M._resultado(i));
console.log((orden === 'MABCcab31m2no' ? '✓' : '✗') + ' orden de los turnos — ' + orden + ' (esperado MABCcab31m2no)');
console.log((res.every(r => r === 136) ? '✓' : '✗') + ' cada pila de C intacta tras los cambios — ' + res.join(', ') + ' (esperado 136 c/u)');
console.log((M._quien_espero() === 3 ? '✓' : '✗') + ' un fiber esperó algo asíncrono en medio — fiber ' + M._quien_espero());
const ms = await M._mide_cambios(100000);
console.log('· 200 000 cambios en ' + ms.toFixed(1) + ' ms → ' + Math.round(200000 / ms * 1000).toLocaleString() + ' cambios/s (' + (ms * 1000 / 200000).toFixed(2) + ' µs c/u)');
