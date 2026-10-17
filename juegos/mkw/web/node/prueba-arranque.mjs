// Prueba del banco (fase 2): ¿el juego arranca en Node y llega a correr cuadros?
//
// Resumen: corre web/node/correr.mjs (el juego sin pantalla) por N cuadros y revisa su log, punto por punto, con
// ✓/✗ como las demás pruebas del banco. No puede ser una página del navegador porque el .wasm del juego no se
// publica ni se sirve desde el banco (es código de Nintendo); por eso es una prueba de Node, como prueba-node.mjs
// de las otras. Guarda el resumen en build/web/datos/prueba-arranque.json.
//
// Uso:  node web/node/prueba-arranque.mjs [cuadros]     (por defecto 600 = 10 s de juego)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cuadros = Number(process.argv[2] || 600);
const t0 = Date.now();
const r = spawnSync(process.execPath, [path.join(raiz, 'web/node/correr.mjs'), String(cuadros)],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 });
const log = (r.stdout || '') + (r.stderr || '');

let bien = 0, mal = 0;
const ok = (nombre, cond, detalle = '') => {
  cond ? bien++ : mal++;
  console.log(`${cond ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
};
const hay = (texto) => log.includes(texto);

ok('el runtime lee su Config.toml', hay('Config.toml loaded'));
ok('carga las secciones del DOL y StaticR embebidos', hay('Loaded StaticR'));
ok('corre los constructores del juego (DOL y StaticR)', /Executed \d+ main DOL static constructors/.test(log) && /Executed \d+ static constructors/.test(log));
ok('arranca el sistema operativo de la Wii', hay('Revolution OS'));
ok('lee el disco extraído (índice con archivos del disco)', /disc index: [1-9]\d* disc file/.test(log), (log.match(/disc index: [^\n]*/) || [''])[0]);
ok('carga StaticR.rel desde el disco', /\[Rel\] Load Module\[1\]: size=/.test(log));
ok('el código de Retro Rewind se ejecuta (payload de Retro WFC)', hay('WWFC_NOTICE'));
ok('el juego cambia de escena (Pulsar avisa «New race started»)', hay('New race started'));
const fps = [...log.matchAll(/cuadro (\d+) \(([\d.]+) fps, trabajo ([\d.]+) ms/g)].map(m => ({ c: +m[1], fps: +m[2], ms: +m[3] }));
ok(`llega a los ${cuadros} cuadros`, hay(`listo: ${cuadros} cuadros`));
const estables = fps.filter(f => f.c >= 300);
const fpsMin = estables.length ? Math.min(...estables.map(f => f.fps)) : 0;
ok('mantiene 60 fps desde el cuadro 300', estables.length > 0 && fpsMin >= 59.5, `mínimo ${fpsMin.toFixed(1)} fps`);
const msMax = estables.length ? Math.max(...estables.map(f => f.ms)) : 99;
ok('el trabajo por cuadro cabe en 16,67 ms', msMax < 16.67, `máximo ${msMax.toFixed(2)} ms por cuadro`);
let volcado = 0;
try { volcado = statSync(path.join(raiz, 'build/web/datos/volcado.bin')).size; } catch {}
ok('deja el volcado de memoria (MEM1 + MEM2)', volcado === 152 * 1024 * 1024, `${(volcado / 1048576).toFixed(0)} MB`);
ok('termina sin errores', r.status === 0 && !/terminó con: (?!exit\(0\))/.test(log), `código ${r.status}`);

const resumen = { cuadros, bien, mal, fpsMin, msMax, segundos: (Date.now() - t0) / 1000, cuando: new Date().toISOString() };
writeFileSync(path.join(raiz, 'build/web/datos/prueba-arranque.json'), JSON.stringify(resumen, null, 2));
console.log(`${bien} bien, ${mal} mal  (${resumen.segundos.toFixed(1)} s)`);
process.exit(mal ? 1 : 0);
