// Prueba con el juego de verdad: dónde guarda Retro Rewind (Pulsar) sus trofeos, fantasmas y ajustes, y que todo eso
// queda en el navegador, en el paquete de la nube y vuelve al recargar (PLAN C8, bitácora §90).
//
// Resumen: en Retro Rewind los trofeos NO salen de las copas: salen en Contrarreloj, al batir el tiempo del fantasma
// «experto» de la pista (Pulsar, GhostManager: AddTrophy). Pulsar los escribe en la carpeta del mod dentro de la
// memoria interna de la Wii (NAND): shared2/Pulsar/RetroRewind6/Trophies/<crc32 de la pista>/Trophy.pul, junto al
// fantasma (Ghosts/…) y los ajustes (RRGameSettings.pul). El VR (RRRating.pul) también va ahí, pero solo lo escribe
// la partida en línea del juego; en nuestra sala el VR vive en Firebase (vr.mjs, §82).
// La prueba, con un navegador sin partidas:
//   1. abre una Contrarreloj directo (?modo=tt), espera a que corra y la termina por código al instante
//      (Module._mkw_sala_terminar: el juego llama a EndLap como si cruzara la meta). Un tiempo de un segundo bate a
//      cualquier experto: Pulsar guarda el fantasma y el trofeo;
//   2. mira los archivos que quedaron en la carpeta del mod (el sistema de archivos del juego);
//   3. que guardado.mjs los copió a IndexedDB y que el paquete de la nube (guardado.exportar, el mismo que sube
//      nube.mjs) los lleva;
//   4. recarga la página: vuelven antes de que arranque el juego, con los mismos bytes.
//
// Uso:  node web/navegador/prueba-trofeos.mjs [--ventana] [--puerto N]    (MKW_BUILD = otro build, como siempre)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8148));
const carpeta = path.join(raiz, 'build/web/datos/trofeos');
mkdirSync(carpeta, { recursive: true });
const MOD = '/datos/WiiCompiled/NAND/shared2/Pulsar/RetroRewind6';   // la carpeta del mod (GetModFolder en la NAND)
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
const espera = ms => new Promise(r => setTimeout(r, ms));
const foto = nombre => pagina.locator('#canvas').screenshot({ path: path.join(carpeta, nombre + '.png') }).catch(() => {});
// la etapa de la carrera (Raceinfo 0x809BD730, +0x28: 0 presentación, 1 cuenta, 2 corriendo, 4 terminada)
const etapa = () => pagina.evaluate(() => { const L = window.mkwMenus, ri = L?.u32(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; });
// los archivos de la carpeta del mod, con su tamaño (recorre el sistema de archivos del juego)
const archivosMod = () => pagina.evaluate(mod => {
  const FS = window.mkwFS, fuera = {};
  const recorrer = d => {
    let nombres = [];
    try { nombres = FS.readdir(d); } catch { return; }
    for (const n of nombres) {
      if (n === '.' || n === '..') continue;
      const r = d + '/' + n, st = FS.stat(r);
      if (FS.isDir(st.mode)) recorrer(r); else fuera[r.slice(mod.length + 1)] = st.size;
    }
  };
  recorrer(mod);
  return fuera;
}, MOD);
// huella sencilla de un archivo del juego (para comparar antes y después de recargar)
const huella = ruta => pagina.evaluate(r => {
  try { const d = window.mkwFS.readFile(r); let h = 2166136261; for (const b of d) h = Math.imul(h ^ b, 16777619) >>> 0; return `${d.length}:${h.toString(16)}`; }
  catch { return 'sin archivo'; }
}, ruta);

let trofeos = [], fantasmas = [];
try {
  // 1) Sin partidas y directo a una Contrarreloj (copa 0, pista 0: Luigi Circuit de las de Nintendo)
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?portada=1`);
  await pagina.evaluate(() => window.mkwGuardado.borrarTodo());
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=0&fila=0`);
  await pagina.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 60, null, { timeout: 120000, polling: 250 });
  const antes = await archivosMod();
  ok('sin partidas: en la carpeta del mod no hay trofeos ni fantasmas', !Object.keys(antes).some(r => /^(Trophies|Ghosts)\//.test(r)),
     Object.keys(antes).join(', ') || 'vacía');

  let e = -1; const t0 = Date.now();
  while (Date.now() - t0 < 120000 && (e = await etapa()) !== 2) await espera(250);
  ok('la Contrarreloj abrió y corre', e === 2, `etapa ${e} a los ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await espera(1000); await foto('1-corriendo');
  await pagina.evaluate(() => window.mkw._mkw_sala_terminar(0));   // window.mkw = el Module del juego (mkw.mjs)
  const t1 = Date.now();
  while (Date.now() - t1 < 20000 && (e = await etapa()) < 4) await espera(250);
  ok('terminada por código: el juego la da por cruzada (etapa 4)', e >= 4, `etapa ${e}`);

  // 2) Pulsar guarda el fantasma y el trofeo en su tarea de fondo: esperar a que aparezcan
  let ahora = {}; const t2 = Date.now();
  while (Date.now() - t2 < 30000) {
    ahora = await archivosMod();
    trofeos = Object.keys(ahora).filter(r => /^Trophies\/[0-9a-f]{8}(\/\d+)?\/Trophy\.pul$/i.test(r));
    fantasmas = Object.keys(ahora).filter(r => /^Ghosts\//.test(r) && ahora[r] > 0);
    if (trofeos.length && fantasmas.length) break;
    await espera(500);
  }
  await foto('2-terminada');
  ok('Pulsar escribió el trofeo en la carpeta del mod (Trophies/<crc32>/Trophy.pul)', trofeos.length > 0, trofeos.join(', ') || Object.keys(ahora).join(', '));
  ok('…y el fantasma de esa vuelta (Ghosts/…)', fantasmas.length > 0, fantasmas.slice(0, 3).join(', '));
  ok('los ajustes de RR siguen en la misma carpeta (RRGameSettings.pul)', 'RRGameSettings.pul' in ahora);

  // 3) guardado.mjs los copió a IndexedDB, y el paquete de la nube los lleva
  const rutas = [...trofeos, ...fantasmas].map(r => `${MOD}/${r}`);
  await pagina.waitForFunction(rs => window.mkwGuardado.cargar().then(m => rs.every(r => m.has(r))), rutas, { timeout: 15000, polling: 500 }).catch(() => {});
  const enIdb = await pagina.evaluate(rs => window.mkwGuardado.cargar().then(m => rs.filter(r => m.has(r)).length), rutas);
  ok('quedaron guardados en el navegador (IndexedDB)', rutas.length > 0 && enIdb === rutas.length, `${enIdb} de ${rutas.length}`);
  const enPaquete = await pagina.evaluate(async rs => {
    const g = window.mkwGuardado, archivos = await g.abrirPaquete(await g.exportar());
    const dentro = new Set(archivos.map(([r]) => r));
    return rs.filter(r => dentro.has(r)).length;
  }, rutas);
  ok('el paquete de la nube (el que sube nube.mjs) los lleva', rutas.length > 0 && enPaquete === rutas.length, `${enPaquete} de ${rutas.length}`);

  // 4) Recargar: vuelven antes de que arranque el juego, iguales
  const huellas = {};
  for (const r of rutas) huellas[r] = await huella(r);
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1`);
  await pagina.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 60, null, { timeout: 120000, polling: 250 });
  let iguales = 0;
  for (const r of rutas) if ((await huella(r)) === huellas[r]) iguales++;
  ok('al recargar vuelven el trofeo y el fantasma, con los mismos bytes', rutas.length > 0 && iguales === rutas.length, `${iguales} de ${rutas.length}`);
} catch (e) {
  ok('la prueba corrió sin errores', false, String(e && e.message || e));
}

await pagina.evaluate(() => window.mkwGuardado && window.mkwGuardado.borrarTodo()).catch(() => {});
console.log(`${bien} bien, ${mal} mal`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
