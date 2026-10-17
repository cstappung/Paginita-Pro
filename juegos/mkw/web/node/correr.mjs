// Corre Mario Kart Wii + Retro Rewind (compilado a wasm) en Node, sin pantalla.
//
// Resumen: Node es el motor de JavaScript de Chrome sin ventana. Este programa carga build/web/node/mkw.js
// (el juego compilado), le prepara una carpeta de datos con su Config.toml (dónde está el disco extraído, sin
// Discord ni red), y llama a su main(). Todo lo que el juego escribe en el log sale por la terminal y además se
// guarda en build/web/datos/ultimo.log.
//
// Uso:  node web/node/correr.mjs [cuadros]      (por defecto 300 cuadros = 5 segundos de juego a 60 fps)
//
// El juego lee los archivos directo del disco del PC (-sNODERAWFS). El programa se para en terceros/Wiicompiled
// porque el runtime busca ahí runtime/assets/... (coeficientes de sonido, archivos base de la NAND).
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// JSPI (lo que deja suspender el wasm en medio de una función) en Node 24 todavía va detrás de una bandera;
// en Chrome ya viene prendido. Si falta, el programa se vuelve a lanzar a sí mismo con la bandera.
if (!('Suspending' in WebAssembly)) {
  const r = spawnSync(process.execPath, ['--experimental-wasm-jspi', ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cuadros = Number(process.argv[2] || 300);
const wc = path.join(raiz, 'terceros/Wiicompiled');
const datos = path.join(raiz, 'build/web/datos');              // hace de "AppData" del juego (partidas, config)
const appdir = path.join(datos, 'WiiCompiled');
mkdirSync(appdir, { recursive: true });

// Config.toml mínimo. El runtime resuelve sus rutas relativas a la carpeta del propio Config.toml; van con
// barras normales para que sirvan dentro de wasm.
const desdeConfig = (p) => path.relative(appdir, path.join(raiz, p)).split(path.sep).join('/');
writeFileSync(path.join(appdir, 'Config.toml'), [
  '# Generado por web/node/correr.mjs',
  '[audio]', 'mix_worker = false', '',
  '[network]', 'enabled = false', '',
  '[discord]', 'enabled = false', '',
  '[paths]',
  `dvd_root = "${desdeConfig('extraido/disco')}"`,
  `retro_rewind_root = "${desdeConfig('terceros/RetroRewind/RetroRewind6')}"`,
  '',
].join('\n'));

const log = createWriteStream(path.join(datos, 'ultimo.log'));
const escribe = (s) => { console.log(s); log.write(s + '\n'); };
process.chdir(wc);

const t0 = performance.now();
// MKW_BUILD_NODE: probar otro build (p. ej. MKW_BUILD_NODE=build/web-sin-simd/node, el de compilar-web.py --sin-simd)
const crea = (await import(pathToFileURL(path.join(raiz, process.env.MKW_BUILD_NODE || 'build/web/node', 'mkw.js')).href)).default;
const M = await crea({
  print: escribe,
  printErr: (s) => escribe('[err] ' + s),
  preRun: [(m) => {
    m.ENV.XDG_DATA_HOME = path.relative(wc, datos).split(path.sep).join('/');
    m.ENV.MKW_HEADLESS_FRAMES = String(cuadros);
    // Al terminar, la RAM de la Wii se guarda aquí (ruta relativa a terceros/Wiicompiled, donde corre el juego)
    m.ENV.MKW_HEADLESS_DUMP = path.relative(wc, path.join(datos, 'volcado.bin')).split(path.sep).join('/');
    // Node no tiene tarjeta de sonido: el driver "dummy" de SDL acepta el sonido y lo descarta, así el camino del
    // sonido del juego trabaja completo. Deja un temporizador vivo, por eso al final se llama a process.exit().
    m.ENV.SDL_AUDIO_DRIVER = 'dummy';
  }],
});
escribe(`[node] wasm cargado en ${(performance.now() - t0).toFixed(0)} ms; arrancando (${cuadros} cuadros)`);
try {
  await M.callMain([]);
} catch (e) {
  escribe('[node] terminó con: ' + (e?.status !== undefined ? `exit(${e.status})` : e));
}
escribe(`[node] ${((performance.now() - t0) / 1000).toFixed(1)} s en total`);
// El temporizador del sonido de SDL mantendría vivo a Node para siempre: salir a mano cuando el log termine.
log.end(() => process.exit(0));
