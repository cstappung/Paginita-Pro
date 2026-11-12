// Mide D5 del plan de rendimiento (bitácora §174): ¿una actualización de UN archivo obliga a bajar todo de nuevo?
//
// Resumen: por cada camino (el de antes, ?versionArchivo=0, y el nuevo, una versión por archivo) abre un perfil de
// Chrome nuevo (= un PC que nunca jugó) y hace dos visitas a la página de la precarga (?precarga=1, §98: baja el programa,
// los chicos, los diminutos y la semilla de bloques a las cachés sin arrancar el juego):
//   1) la primera visita, con el servidor de siempre (todo se baja);
//   2) la segunda, con el servidor reiniciado y un archivo «actualizado» (MKW_CAMBIAR_HUELLA: el servidor le da otra
//      huella y otra versión de todo, sin tocar el archivo del juego).
// Una tercera fila, «sin cambio», hace la segunda visita con el servidor igual (lo mínimo que baja una visita normal).
// Dice cuántos MB del disco bajó cada visita (disco.estado.bytesRed), cuántos pedidos y lo que barrió de la caché.
// Antes: la 2.ª visita tras el cambio baja todo otra vez; con §174, solo lo del archivo cambiado.
//
// Uso:  node herramientas/medir-version-archivo.mjs [--puerto 8174] [--archivo files/sound/revo_kart.brsar]
//       → una línea por camino y build/web/datos/version-archivo/medida-<hora>.json
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8174)), ARCHIVO = arg('archivo', 'files/sound/revo_kart.brsar');
const espera = ms => new Promise(r => setTimeout(r, ms));
const mb = b => +(b / 1048576).toFixed(1);

// el servidor local (nuestro: se apaga al terminar cada visita), con o sin el archivo «cambiado»
async function servidor(cambiado) {
  const s = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
    { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: '50', MKW_CAMBIAR_HUELLA: cambiado ? ARCHIVO : '' } });
  await new Promise(listo => s.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
  return s;
}

// una visita a la precarga con el perfil dir: lo que bajó el disco
async function visita(dir, extra, cambiado) {
  const s = await servidor(cambiado);
  const ctx = await chromium.launchPersistentContext(dir, { ...opcionesNavegador(), headless: true,
    args: ['--enable-unsafe-webgpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const p = ctx.pages()[0] || await ctx.newPage();
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PUERTO}/?precarga=1${extra}`);
  let pre = null;
  for (const hasta = Date.now() + 300000; Date.now() < hasta; await espera(300)) {
    pre = await p.evaluate(() => window.mkwEstado?.precarga || null).catch(() => null);
    if (pre?.listo || pre?.error) break;
  }
  const ms = Date.now() - t0;
  // (el barrido de lo huérfano corre 20 s después de abrir: esperarlo, como mucho 40 s)
  let barrido = null;
  for (const hasta = Date.now() + 40000; Date.now() < hasta && extra === ''; await espera(500)) {
    barrido = await p.evaluate(() => window.mkwDisco?.estado?.barrido || null).catch(() => null);
    const antes = await p.evaluate(() => window.mkwDisco?.estado?.versionAntes ?? null).catch(() => null);
    if (barrido || !cambiado || antes === null) break;
  }
  const e = await p.evaluate(() => { const e = window.mkwDisco?.estado || {}; return { bytesRed: e.bytesRed, pedidosRed: e.pedidosRed,
    bloquesCache: e.bloquesCache, versionArchivo: window.mkwEstado?.versionArchivo, versionAntes: e.versionAntes ?? null }; }).catch(() => ({}));
  await ctx.close();
  s.kill();
  return { ms, listo: !!pre?.listo, mb: mb(e.bytesRed || 0), pedidos: e.pedidosRed, deCache: e.bloquesCache, versionArchivo: e.versionArchivo, barrido };
}

const filas = [];
for (const [nombre, extra, cambiado] of [['antes (?versionArchivo=0)', '&versionArchivo=0', true], ['§174 (por archivo)', '', true], ['§174, sin cambio', '', false]]) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-verarch-'));
  const v1 = await visita(dir, extra, false);
  const v2 = await visita(dir, extra, cambiado);
  rmSync(dir, { recursive: true, force: true });
  filas.push({ nombre, v1, v2 });
  console.log(`${nombre}: 1.ª visita ${v1.mb} MB (${v1.pedidos} pedidos, ${(v1.ms / 1000).toFixed(1)} s) · 2.ª ${cambiado ? 'con ' + ARCHIVO + ' cambiado' : 'sin cambio'}: ` +
    `${v2.mb} MB (${v2.pedidos} pedidos, ${v2.deCache} bloques de la caché, ${(v2.ms / 1000).toFixed(1)} s)` +
    `${v2.barrido ? ` · barrido: ${v2.barrido.borradas} de ${v2.barrido.revisadas} entradas en ${v2.barrido.ms} ms` : ''} · huellas por archivo: ${v2.versionArchivo ? 'sí' : 'no'}`);
}
const salida = path.join(raiz, 'build/web/datos/version-archivo');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `medida-${Date.now()}.json`), JSON.stringify({ archivo: ARCHIVO, filas }, null, 1));
process.exit(0);
