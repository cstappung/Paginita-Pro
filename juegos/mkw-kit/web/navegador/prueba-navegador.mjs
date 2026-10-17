// Prueba del banco (fase 3): abre la página del juego en Chrome con Playwright y espera sus verificaciones ✓/✗.
//
// Resumen: Playwright es una herramienta que maneja un navegador desde un programa (abre páginas, lee la
// consola, saca capturas). Este programa:
//   1. levanta el servidor local del juego (web/navegador/servidor.mjs) en el puerto 8141;
//   2. abre Chrome con WebGPU, abre http://127.0.0.1:8141/?auto=1&cuadros=N y copia toda la consola a
//      build/web/datos/navegador.log;
//   3. espera a que la página termine sus verificaciones (o hasta un tiempo máximo), guarda una captura del
//      canvas en build/web/datos/navegador.png y repite el resultado ✓/✗.
// Además mide los cuadros parejos EN PANTALLA (bitácora §43): pasado el cuadro 480 graba unos segundos de la
// "traza" de Chrome (su registro interno) con un solo evento, Display::FrameDisplayed = "esta imagen se mostró en
// este refresco del monitor". Es la verdad de lo que se vio; la página sola no puede saberlo.
// Con --pausa S: a los S segundos PAUSA la página (como un depurador) y escribe en qué funciones estaba el
// programa: sirve para encontrar dónde se queda trabado si la página se congela.
//
// Uso:  node web/navegador/prueba-navegador.mjs [cuadros=900] [--ventana] [--gpu alto|bajo|auto] [--sin-enganche]
//                                              [--sin-ajuste-sonido] [--perfil 14] [--pausa 20]
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, porDefecto) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : porDefecto; };
const cuadros = Number(args.find(a => /^\d+$/.test(a)) || 900);
const pausa = Number(opcion('--pausa', 0));
const conVentana = args.includes('--ventana');
// --gpu alto|bajo|auto: qué tarjeta pide la página. Con "alto" además se lanza Chrome con
// --force_high_performance_gpu (en Windows es lo único que de verdad lo hace usar la dedicada).
const gpu = opcion('--gpu', 'alto');
const sinEnganche = args.includes('--sin-enganche');   // compara: el reloj del juego suelto, sin el monitor
const sinAjusteSonido = args.includes('--sin-ajuste-sonido');   // compara: el sonido sin el ajuste fino de ritmo
const PUERTO = 8141;
// Mínimo de cuadros parejos EN PANTALLA (ver medirPantalla). Es 90 % y no 98 % (bitácora §43): con la fase de
// antes daba 50–65 %, así que 90 % separa de sobra "arreglado" de "roto"; con el arreglo da 91–100 % (casi siempre
// ≥ 98 %) con la máquina tranquila. Lo que falta son demoras de 2 ms o más de Chrome y Windows al presentar (otro
// Chrome con el juego, el compositor de Windows con dos monitores), que a 240 Hz (4,17 ms por refresco) ningún
// reloj del juego puede absorber. A 60 Hz (16,7 ms por refresco) no pasa.
const MINIMO_PANTALLA = 90;

mkdirSync(path.join(raiz, 'build/web/datos'), { recursive: true });
const log = createWriteStream(path.join(raiz, 'build/web/datos/navegador.log'));

// 1) servidor
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

// 2) Chrome (el instalado en el PC; Playwright no baja uno propio con playwright-core)
const navegador = await chromium.launch({
  channel: 'chrome',
  headless: !conVentana,
  // --mute-audio: Chrome sin sonido durante las pruebas (el juego igual mezcla su audio, solo no se oye).
  // Chrome manejado por Playwright (--enable-automation) no bloquea el sonido aunque se le pida
  // (--autoplay-policy=user-gesture-required no alcanza): la página lo simula con ?bloquearSonido=1.
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--autoplay-policy=user-gesture-required',
         ...(gpu === 'alto' ? ['--force_high_performance_gpu'] : [])],
});
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
let ultimo = Date.now();
pagina.on('console', m => { const t = m.text(); log.write(t + '\n'); ultimo = Date.now(); if (/^[✓✗·]|^fin:/.test(t)) console.log(t); });
pagina.on('pageerror', e => { log.write('[pageerror] ' + e.message + '\n'); console.log('[pageerror] ' + e.message); });
const t0 = Date.now();
await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&bloquearSonido=1&cuadros=${cuadros}&gpu=${gpu}${sinEnganche ? '&enganche=0' : ''}${sinAjusteSonido ? '&ajusteSonido=0' : ''}${opcion('--extra', '')}`);

let codigo = 0;
const perfil = Number(opcion('--perfil', 0));
if (perfil) {
  // 3c) Perfil: a los S segundos mide durante 4 s cuánto tiempo pasa el programa en cada función ("tiempo
  // propio" = sin contar las funciones que esa llama) y escribe las 30 que más tardan.
  await new Promise(r => setTimeout(r, perfil * 1000));
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });   // una muestra cada 0,2 ms
  await cdp.send('Profiler.start');
  await new Promise(r => setTimeout(r, 4000));
  const { profile } = await cdp.send('Profiler.stop');
  const porId = new Map(profile.nodes.map(n => [n.id, n]));
  const cuenta = new Map();
  for (const id of profile.samples) {
    const n = porId.get(id);
    const nombre = n.callFrame.functionName || `(${n.callFrame.url.split('/').pop() || 'nativo'})`;
    cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1);
  }
  const total = profile.samples.length;
  console.log(`perfil de 4 s (${total} muestras):`);
  for (const [nombre, c] of [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 30))
    console.log(`  ${(100 * c / total).toFixed(1).padStart(5)} %  ${nombre}`);
} else if (pausa) {
  // 3a) Pausar como un depurador y ver la pila de llamadas (qué función llamó a cuál)
  await new Promise(r => setTimeout(r, pausa * 1000));
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send('Debugger.enable');
  const pausado = new Promise(r => cdp.once('Debugger.paused', r));
  await cdp.send('Debugger.pause');
  const ev = await Promise.race([pausado, new Promise(r => setTimeout(() => r(null), 15000))]);
  if (!ev) console.log('no se pudo pausar en 15 s');
  else {
    console.log(`pila a los ${pausa} s (lo de arriba es lo que corría):`);
    for (const f of ev.callFrames.slice(0, 40)) console.log('  ' + (f.functionName || '(anónima)') + '  ' + (f.url || '').split('/').pop());
  }
  console.log(`(última línea de consola hace ${((Date.now() - ultimo) / 1000).toFixed(1)} s)`);
} else {
  // 3b) Esperar el final de la prueba (máximo: el tiempo de los cuadros pedidos + 2 minutos)
  const maximo = (cuadros / 60 + 120) * 1000;
  // Desbloquear el sonido como una persona: cuando el medidor de la página dice "sonido bloqueado", un clic de
  // verdad (Playwright hace clics "confiables", como un mouse) en el título de la página, lejos del juego.
  // OJO: antes del clic no se le pregunta nada a la página (evaluate/waitForFunction): Playwright los corre como
  // si fueran un gesto de la persona, y eso solo ya desbloquearía el sonido. Por eso se lee la consola.
  const bloqueado = await new Promise(listo => {
    const mirar = m => { if (/^\[medidor\].*sonido (bloqueado|-?\d)/.test(m.text())) { pagina.off('console', mirar); listo(/sonido bloqueado/.test(m.text())); } };
    pagina.on('console', mirar);
    setTimeout(() => { pagina.off('console', mirar); listo(null); }, 60000);
  });
  console.log(`· sonido antes del clic: ${bloqueado === null ? 'el juego no lo abrió en 60 s' : bloqueado ? 'bloqueado' : 'sonando'}; clic en el título de la página`);
  await pagina.locator('h1').click();
  const pantalla = medirPantalla();
  try {
    await pagina.waitForFunction(() => document.body.dataset.fin === '1', null, { timeout: maximo, polling: 1000 });
  } catch { console.log('✗ la página no terminó a tiempo'); codigo = 1; }
  await pagina.locator('#canvas').screenshot({ path: path.join(raiz, 'build/web/datos/navegador.png') }).catch(() => {});
  let resumen = await pagina.locator('#resumen').textContent().catch(() => '');
  const enPantalla = juzgarPantalla(await pantalla);
  if (enPantalla !== null) {
    resumen = (resumen || '').replace(/(\d+) bien, (\d+) mal/, (_, b, m) => enPantalla ? `${+b + 1} bien, ${m} mal` : `${b} bien, ${+m + 1} mal`);
    log.write(`fin con la traza de Chrome: ${resumen}
`);
  }
  console.log(`${resumen}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (/[1-9]\d* mal/.test(resumen || '')) codigo = 1;
}
await navegador.close();
servidor.kill();

// Graba la traza de Chrome con solo Display::FrameDisplayed, desde el cuadro 480 (pasado el arranque y con el
// reloj del juego ya enganchado) durante hasta 8 s, sin pasar del final de la prueba. Devuelve las horas (ms) en
// que se mostró una imagen nueva y el período del monitor que midió la página; null = no se mide.
async function medirPantalla() {
  const desde = 480, seg = Math.min(8, (cuadros - desde) / 60 - 1);
  if (seg < 3 || sinEnganche) return null;
  await new Promise(listo => {
    const mirar = m => { const c = /^\[medidor\] \d+ s: cuadro (\d+)/.exec(m.text()); if (c && +c[1] >= desde) { pagina.off('console', mirar); listo(); } };
    pagina.on('console', mirar);
  });
  const cdp = await pagina.context().newCDPSession(pagina);
  // Además: cuánto del tiempo estuvo ocupado el hilo principal de la página (donde corre el juego). TaskDuration
  // = segundos sumados de todas las tareas del hilo; dividido por el tiempo real = fracción ocupada (§48).
  await cdp.send('Performance.enable');
  const metrica = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const m0 = await metrica();
  const mostrados = [];
  cdp.on('Tracing.dataCollected', e => { for (const x of e.value) if (x.name === 'Display::FrameDisplayed') mostrados.push(x.ts / 1000); });
  const completa = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  // Una sola categoría (la de ese evento): grabar más (gpu, cc, viz...) carga a Chrome y cambia el ritmo medido
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-display.framedisplayed'] } });
  await new Promise(r => setTimeout(r, seg * 1000));
  await cdp.send('Tracing.end');
  const m1 = await metrica();
  await completa;
  const ocupado = 100 * (m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp);
  console.log(`· hilo principal de la página ocupado ${ocupado.toFixed(0)} % del tiempo (el juego, el navegador y sus esperas activas)`);
  log.write(`[pantalla] hilo principal ocupado ${ocupado.toFixed(1)} %\n`);
  const p = await pagina.evaluate(() => (window.mkw && window.mkw.mkwVsync && window.mkw.mkwVsync.p) || 0).catch(() => 0);
  return { mostrados: [...new Set(mostrados)].sort((a, b) => a - b), p, seg };
}

// "Parejo en pantalla" = cuántos refrescos hay entre dos imágenes mostradas: a 240 Hz lo parejo es 4 (60 fps).
// Una imagen que llega menos de 2 refrescos después de la anterior es un cambio de la página (el texto del
// medidor) y no del juego: se salta. Imprime ✓/✗ (o · si el monitor no es múltiplo de 60 Hz) y devuelve
// true/false, o null si no hubo medida.
function juzgarPantalla(m) {
  if (!m) return null;
  if (!m.p || m.mostrados.length < 60) { console.log(`✗ cuadros parejos en pantalla — la traza trajo ${m.mostrados.length} imágenes`); return false; }
  const esperado = Math.round(16.6667 / m.p);
  const huecos = {};
  let anterior = m.mostrados[0], dibujo = '';
  for (const t of m.mostrados.slice(1)) {
    const k = Math.round((t - anterior) / m.p);
    if (k < 2 && esperado >= 2) continue;
    huecos[k] = (huecos[k] || 0) + 1;
    dibujo += k === esperado ? '.' : k > 9 ? '+' : String(k);
    anterior = t;
  }
  // al log, la "película": un punto por imagen pareja y el número de refrescos si no (60 por línea = 1 s)
  log.write('[pantalla] película:\n' + dibujo.replace(/(.{60})/g, '$1\n') + '\n');
  const total = Object.values(huecos).reduce((a, b) => a + b, 0);
  const parejo = 100 * (huecos[esperado] || 0) / total;
  const detalle = `monitor ${(1000 / m.p).toFixed(1)} Hz, ${parejo.toFixed(1)} % de ${total} imágenes duraron ${esperado} refresco(s) ` +
                  `en ${m.seg.toFixed(0)} s (${Object.entries(huecos).map(([k, n]) => `${k}→${n}`).join(', ')})`;
  log.write(`[pantalla] ${detalle}
`);
  if (Math.abs(16.6667 - esperado * m.p) >= 0.1) { console.log(`· ritmo en pantalla sin exigencia (el monitor no es múltiplo de 60 Hz): ${detalle}`); return null; }
  console.log(`${parejo >= MINIMO_PANTALLA ? '✓' : '✗'} cuadros parejos en pantalla (traza de Chrome, ≥ ${MINIMO_PANTALLA} %) — ${detalle}`);
  return parejo >= MINIMO_PANTALLA;
}
log.end(() => process.exit(codigo));
