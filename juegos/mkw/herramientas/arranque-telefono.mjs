// arranque-telefono.mjs — el arranque en el teléfono de verdad (§276): la 1.ª y la 2.ª visita, tramo por tramo.
//
// Resumen: todo lo que toca el teléfono va por el marco seguro (herramientas/telefono-seguro.mjs: lista blanca de
// órdenes, pestaña de incógnito que Chrome borra al cerrarla, limpieza garantizada, foto antes/después, vigía del calor,
// la pantalla prendida y devuelta exacta). Dentro de esa pestaña (al frente, con el medidor de fps prendido):
//   visita 1 = la página por primera vez (el incógnito empieza vacío);
//   visita 2 = la MISMA pestaña recargada (visitasSeguidas): la caché HTTP, Cache Storage, IndexedDB y la caché de
//              shaders siguen llenas; la caché de código de V8 en un incógnito no se guarda (ver la bitácora §276).
// En cada visita: espera el menú de inicio, elige Single Player (como un toque en el botón) y espera el menú «Un
// jugador» del juego; lee window.mkwArranque.informe() (arranque.mjs) y lo guarda.
// Uso (con el candado; antes nada en el puerto 8140):
//   MKW_BUILD=build/web-final-w30/navegador node herramientas/arranque-telefono.mjs [--etiqueta X] [--extra "&…"] [--visitas 2]
// Salida: build/web/datos/telefono/<fecha>/arranque-<etiqueta>.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla, visitasSeguidas } from './telefono-seguro.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = 8140, EXTRA = opcion('--extra', ''), ETIQUETA = opcion('--etiqueta', 'telefono'), VISITAS = Number(opcion('--visitas', 2));
const carpeta = path.join('build', 'web', 'datos', 'telefono', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
fs.mkdirSync(carpeta, { recursive: true });
const lineas = [];
const registro = l => { lineas.push(`${new Date().toISOString()} ${l}`); fs.writeFileSync(path.join(carpeta, 'registro.txt'), lineas.join('\n') + '\n'); };
const espera = ms => new Promise(r => setTimeout(r, ms));

// el servidor del juego en 8140 (el que el teléfono ve como su propio 127.0.0.1 por el túnel del cable)
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
await new Promise((listo, mal) => { servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }); servidor.on('exit', c => mal(new Error(`el servidor salió (${c}): ¿el puerto ${PUERTO} está ocupado?`))); });

// lo que se mide en cada visita
async function medir(p, n) {
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && !(await p.evaluate(() => !!window.mkwInicio?.visible).catch(() => false))) await espera(250);
  const menu = await p.evaluate(() => window.mkwArranque?.marcas.inicioVisto ?? null).catch(() => null);
  // Single Player: lo mismo que tocar el botón resaltado (el primero)
  await p.evaluate(() => { window.mkwInicio.elegir(0); window.mkwInicio.aceptar(); }).catch(() => {});
  const t1 = Date.now();
  while (Date.now() - t1 < 180000 && !(await p.evaluate(() => window.mkwArranque?.marcas.unJugador != null).catch(() => false))) await espera(250);
  // --personaje: 1,5 s después del menú, la pantalla de elegir personaje (la que más pipelines nuevos pide; como alguien
  // que entra rápido): cuántos dibujos se saltan ahí por pipelines que todavía no llegaron
  let personaje = null;
  if (process.argv.includes('--personaje')) {
    await espera(1500);
    const cuenta = () => p.evaluate(() => window.mkwEstado.log.reduce((n, l) => { const m = /^\[pipelines\].* (\d+) dibujos saltados/.exec(l); return n + (m ? +m[1] : 0); }, 0)).catch(() => null);
    const antes = await cuenta();
    const llego = await p.evaluate(() => window.mkwDirecto.ir(0x49, { tope: 20000 })).catch(e => String(e));
    await espera(8000);
    personaje = { llego, saltados: (await cuenta()) - antes };
    console.log(`  elegir personaje: ${JSON.stringify(personaje)}`);
  }
  // la fluidez del menú justo después (los pipelines que faltan siguen llegando de fondo): imágenes por segundo, 8 s
  const fluidez = [];
  for (let k = 0; k < 8; k++) { await espera(1000); fluidez.push(await p.evaluate(() => Math.round(window.mkwEstado.imagenesSeg ?? window.mkwEstado.fps ?? -1)).catch(() => null)); }
  const informe = await p.evaluate(() => ({ ...window.mkwArranque.informe(), programa: window.mkwEstado.programa, armado: window.mkwEstado.armado,
    esperaGraficos: window.mkwEstado.esperaGraficos, arranqueRapido: window.mkwEstado.arranqueRapido, lecturas: window.mkwEstado.lecturas,
    mbLeidos: +((window.mkwEstado.bytes || 0) / 1048576).toFixed(1), saltados: window.mkwEstado.log.reduce((n, l) => { const m = /^\[pipelines\].* (\d+) dibujos saltados/.exec(l); return n + (m ? +m[1] : 0); }, 0), nucleos: navigator.hardwareConcurrency, memoria: navigator.deviceMemory,
    log: window.mkwEstado.log.filter(l => /^\[arranque\]|^programa:|armar archivos|paquete de diminutos|\[pipelines\]|§133|§276|semilla/.test(l)).slice(0, 60) })).catch(e => ({ error: e.message }));
  const m = informe.marcas || {};
  console.log(`\nvisita ${n}: menú de inicio ${(menu / 1000).toFixed(2)} s · Un jugador ${m.unJugador != null ? (m.unJugador / 1000).toFixed(2) : '—'} s`);
  for (const [k, ms, d] of informe.tramos || []) console.log(`  ${k.padEnd(18)} ${(ms / 1000).toFixed(2).padStart(7)} s  (+${(d / 1000).toFixed(2)})`);
  for (const [k, r] of Object.entries(informe.red || {})) if (r.inicio != null) console.log(`  red ${k.padEnd(11)} ${(r.inicio / 1000).toFixed(2)} → ${(r.fin / 1000).toFixed(2)} s  ${(r.bytes / 1048576).toFixed(2)} MB`);
  console.log(`  pantallas: ${JSON.stringify(informe.pantallas)}`);
  console.log(`  imágenes/s en el menú los 8 s siguientes: ${fluidez.join(' ')} · dibujos saltados (pipelines no listos): ${informe.saltados}`);
  return { visita: n, fluidez, personaje, ...informe };
}
// espera a que la recarga de verdad empezó y la página nueva ya tiene su línea de tiempo
async function esperarCarga(p, origenViejo) {
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const o = await p.evaluate(() => (window.mkwArranque ? performance.timeOrigin : null)).catch(() => null);
    if (o && o !== origenViejo) return;
    await espera(250);
  }
  throw new Error('la recarga no volvió en 120 s');
}

const adb = crearAdb({ ejecutable: buscarAdb(), puertos: [PUERTO], registro });
let origen = null;
try {
  const r = await abrir({ adb, puertos: [PUERTO], ruta: `/?inicio=1&bienvenida=0${EXTRA}`, segundos: 900,
    conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx), pantalla: true, recuerdo: recuerdoPantalla(),
    esperar: ms => espera(ms),
    durante: pagina => visitasSeguidas(pagina, { visitas: VISITAS,
      medir: async (p, n) => { const x = await medir(p, n); origen = await p.evaluate(() => performance.timeOrigin).catch(() => null); return x; },
      pausa: () => espera(2000), esperarCarga: p => esperarCarga(p, origen) }) });
  fs.writeFileSync(path.join(carpeta, `arranque-${ETIQUETA}.json`), JSON.stringify({ etiqueta: ETIQUETA, extra: EXTRA, build: process.env.MKW_BUILD || 'build/web/navegador', ...r }, null, 2));
  console.log(`\nfin: ${r.motivo}`);
  console.log(r.cambios?.igual ? '✓ el teléfono quedó igual que antes (apps y ajustes)' : `✗ algo cambió: ${JSON.stringify(r.cambios)}`);
  console.log(`→ ${path.join(carpeta, `arranque-${ETIQUETA}.json`)}`);
} finally {
  servidor.kill();
}
