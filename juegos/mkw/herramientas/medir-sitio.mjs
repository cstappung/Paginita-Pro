// Medición repetible del juego EN LAS CONDICIONES DEL SITIO REAL (bitácora §54): la línea base y el "antes/después"
// de cada optimización.
//
// Resumen: levanta herramientas/sitio-local.mjs (el sitio servido como GitHub Pages: gzip, max-age=600, sin COOP/COEP;
// y lo privado desde otro origen con la latencia de R2), abre en Chrome la página de Juegos de verdad con el marco del
// juego encima (como crearBt3Solo), juega siempre la misma secuencia (título → licencia → Mario Kart → pista →
// carrera → N segundos acelerando) y entrega:
//   - CPU por cuadro en la carrera (juego + aurora, de la traza del ritmo): promedio, p95, p99, y cuántos cuadros
//     pasan de 16,7 ms (el presupuesto de 60 fps). "p95" = el valor que el 95 % de los cuadros no supera;
//   - fps por segundo en la carrera (peor segundo y segundos bajo 57);
//   - % del hilo principal ocupado (el de la pestaña: el juego Y la página de Juegos con su Firebase, mando, etc.);
//   - memoria del wasm (MB), tiempo hasta el primer cuadro y hasta la carrera, MB bajados (del sitio y del Worker);
//   - tiempo de GPU por cuadro (demora hasta que la tarjeta termina lo enviado, ?gpu=1);
//   - la tarjeta de video que usó WebGPU (para confirmar que no es un dibujo por software).
// Los pasos esperan CUADROS del juego, no milisegundos: con la CPU frenada el juego va más lento y la secuencia sigue
// cayendo en las mismas pantallas.
//
// Perfiles (--perfil):
//   pc       la PC tal cual
//   cpu4     la CPU de la pestaña 4 veces más lenta (el freno de las DevTools de Chrome) desde que abre
//   celular  un Pixel 7 emulado (pantalla 412×915 a 2,625×, toque, navegador de Android) con la CPU 6× más lenta
//            (un celular de gama media o viejo: el caso pesimista)
//   celular-alto  el mismo Pixel 7 con la CPU 2,5× más lenta: un celular de gama alta actual (Snapdragon 8 Gen 2/3,
//            Apple A17) tiene núcleos a menos de la mitad de un PC de escritorio, no a un sexto
//            (un Android de gama media es varias veces más lento que esta PC)
//
// Uso:  node herramientas/medir-sitio.mjs --perfil pc [--etiqueta base] [--segundos 20] [--extra "&staging=mapeo"]
//                                          [--latencia 50] [--ventana] [--sola]
//   --sola: la página del juego sola, sin el marco de Juegos (para comparar cuánto pesa la página de Juegos)
//   --items: usa el ítem cada 2 s en la carrera (los hongos dan el mismo empujón que un booster pad)
//   --perfilar: perfil de CPU de la carrera → <etiqueta>-<perfil>-v1-perfil.txt
//   --visitas 2: abre dos veces seguidas en el mismo perfil de Chrome; la 2.ª mide la visita con caché
//   --red 50: limita la bajada a 50 Mbit/s (como una conexión de casa; Chrome la frena con Network.emulateNetworkConditions)
// Deja build/web/datos/medir-sitio/<etiqueta>-<perfil>.json, .log (la consola del juego) y -v1.png (foto de la carrera).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PERFIL = opcion('--perfil', 'pc');
const ETIQUETA = opcion('--etiqueta', 'base');
const SEGUNDOS = Number(opcion('--segundos', 20));
const EXTRA = opcion('--extra', '');
const LATENCIA = opcion('--latencia', '50');
const VISITAS = Number(opcion('--visitas', 1));
const PUERTO = 8160;
const FRENO = { pc: 1, cpu4: 4, celular: 6, 'celular-alto': 2.5 }[PERFIL];
if (!FRENO) { console.error('perfil desconocido: ' + PERFIL); process.exit(1); }

// La secuencia: [tecla, cuadros que espera después] (los mismos pasos que guion.mjs / medir-cpu.sh, en cuadros:
// 2500 ms = 150 cuadros). K = botón A. Lleva del título a la primera carrera de Mario Kart con Mario.
const PASOS = [150, 120, 150, 150, 150, 180, 210, 150, 150, 150, 210, 150, 150, 150, 150, 240, 720].map(c => ['KeyK', c]);

const salida = path.join(raiz, 'build/web/datos/medir-sitio');
mkdirSync(salida, { recursive: true });
const base = path.join(salida, `${ETIQUETA}-${PERFIL}`);
const log = createWriteStream(base + '.log');

// 1) El sitio local (Pages + Worker)
const sitio = spawn(process.execPath, [path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO), '--latencia', LATENCIA],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => { let t = ''; sitio.stdout.on('data', d => { t += d; if (t.includes('worker (')) listo(); }); });
const PAGES = `http://127.0.0.1:${PUERTO}`, WORKER = `http://127.0.0.1:${PUERTO + 1}`;

// 2) Chrome de verdad (el instalado), con un perfil nuevo (primera visita), sin sonido (pedido del dueño)
const carpetaPerfil = path.join(os.tmpdir(), 'mkw-medir-' + process.pid);
const contexto = await chromium.launchPersistentContext(carpetaPerfil, {
  channel: 'chrome', headless: !args.includes('--ventana'), args: ['--mute-audio'],
  ...(PERFIL.startsWith('celular') ? devices['Pixel 7'] : { viewport: { width: 1280, height: 800 } }),
});
const resultados = [];
for (let visita = 1; visita <= VISITAS; visita++) resultados.push(await medirUnaVez(visita));
await contexto.close();
sitio.kill();
try { rmSync(carpetaPerfil, { recursive: true, force: true }); } catch {}
writeFileSync(base + '.json', JSON.stringify({ etiqueta: ETIQUETA, perfil: PERFIL, freno: FRENO, extra: EXTRA, latencia: +LATENCIA, segundos: SEGUNDOS, visitas: resultados }, null, 1));
console.log(`→ ${path.relative(raiz, base)}.json`);

async function medirUnaVez(visita) {
  const pagina = contexto.pages()[0] || await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  if (FRENO > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO });
  // MB bajados, por origen (encodedDataLength = lo que viajó por la red, ya comprimido)
  await cdp.send('Network.enable');
  if (args.includes('--red')) {
    const mbps = Number(opcion('--red', 50));
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: mbps * 1e6 / 8, uploadThroughput: 10e6 / 8 });
  }
  const urls = new Map(), bajado = {}, desdeCache = { n: 0 };
  cdp.on('Network.requestWillBeSent', e => urls.set(e.requestId, e.request.url));
  cdp.on('Network.requestServedFromCache', () => desdeCache.n++);
  cdp.on('Network.loadingFinished', e => {
    const u = urls.get(e.requestId) || '';
    const o = u.startsWith(PAGES) ? 'sitio' : u.startsWith(WORKER) ? 'worker' : u.startsWith('data:') ? null : 'otros';
    if (!o) return;
    bajado[o] = bajado[o] || { mb: 0, pedidos: 0 };
    bajado[o].mb += e.encodedDataLength / 1048576; bajado[o].pedidos++;
  });
  await cdp.send('Performance.enable');
  pagina.on('console', m => log.write(`[v${visita}] ${m.text()}\n`));
  pagina.on('pageerror', e => log.write(`[v${visita}] [pageerror] ${e.message}\n`));

  const extraPagina = `&auto=1&traza=1&gpu=1${EXTRA}`;
  const t0 = Date.now();
  if (args.includes('--sola')) await pagina.goto(`${PAGES}/juegos/mkw/index.html?privado=${WORKER}${extraPagina}`);
  else await pagina.goto(`${PAGES}/juegos.html?mkw=${encodeURIComponent(extraPagina)}`);
  // el marco del juego (o la página sola)
  let juego = null;
  for (let i = 0; i < 600 && !juego; i++) {
    juego = pagina.frames().find(f => f.url().includes('/juegos/mkw/index.html'));
    if (!juego) await pagina.waitForTimeout(100);
  }
  const cuadros = () => juego.evaluate(() => window.mkwCuadros ? window.mkwCuadros() : 0).catch(() => 0);
  const ahoraJuego = () => juego.evaluate(() => performance.now());
  // primer cuadro: mirando el contador cada 50 ms
  let tPrimer = null;
  for (let i = 0; i < 6000 && tPrimer === null; i++) { if (await cuadros() > 0) tPrimer = Date.now() - t0; else await pagina.waitForTimeout(50); }
  const tarjeta = await juego.evaluate(async () => {
    try { const a = await navigator.gpu.requestAdapter(); const i = a.info || {}; return `${i.vendor || '?'} · ${i.architecture || '?'} · ${i.description || ''}`.trim(); }
    catch (e) { return 'sin WebGPU: ' + e; }
  });
  const aislada = await juego.evaluate(() => ({ crossOriginIsolated: self.crossOriginIsolated, sab: typeof SharedArrayBuffer !== 'undefined' }));
  // un clic en el juego: le da el foco del teclado (y desbloquea el sonido, que va silenciado)
  await (args.includes('--sola') ? pagina.locator('#canvas') : pagina.frameLocator('iframe.jg-bt3-solo').locator('#canvas')).click({ force: true });   // force: en el celular el mando táctil tapa el canvas
  const esperarCuadros = async n => { const fin = (await cuadros()) + n; let ult = -1, quieto = 0;
    while (true) { const c = await cuadros(); if (c >= fin) return; quieto = c === ult ? quieto + 1 : 0; ult = c; if (quieto > 1200) throw new Error('el juego se detuvo'); await pagina.waitForTimeout(50); } };
  await esperarCuadros(360 - Math.min(360, await cuadros()));      // como guion.mjs: ya en el título
  for (const [tecla, c] of PASOS) { await pagina.keyboard.down(tecla); await pagina.waitForTimeout(120); await pagina.keyboard.up(tecla); await esperarCuadros(c); }
  // la carrera: K apretada SEGUNDOS × 60 cuadros, midiendo
  const tCarrera = Date.now() - t0;
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const desde = await ahoraJuego(), c0 = await cuadros(), w0 = Date.now();
  log.write(`[v${visita}] [medir] carrera desde el cuadro ${c0}
`);
  // lo que de verdad muestra la pantalla: Chrome anota cada imagen que llega al monitor (Display::FrameDisplayed).
  // Una sola categoría: grabar más cambia el ritmo medido (ver prueba-navegador.mjs)
  const mostrados = [];
  const ondata = e => { for (const x of e.value) if (x.name === 'Display::FrameDisplayed') mostrados.push(x.ts / 1000); };
  cdp.on('Tracing.dataCollected', ondata);
  const completa = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-display.framedisplayed'] } });
  // --perfilar: perfil de CPU de la carrera (en qué funciones se va el tiempo; ver guion.mjs P:ms)
  const perfilar = args.includes('--perfilar');
  if (perfilar) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  await pagina.keyboard.down('KeyK');
  // --items: cada 2 s aprieta L (Espacio = usar el ítem): un hongo da el mismo empujón que un booster pad
  const items = args.includes('--items') ? setInterval(() => pagina.keyboard.press('Space', { delay: 100 }).catch(() => {}), 2000) : null;
  if (args.includes('--trazaChrome')) {
    // --trazaChrome: 3 s de traza completa de Chrome a mitad de la carrera (todos los procesos: la página, la GPU y
    // el compositor) → <base>-v1-chrome.json, para abrir en chrome://tracing o analizar (qué hace cada hilo)
    await cdp.send('Tracing.end'); await completa; cdp.off('Tracing.dataCollected', ondata);
    await esperarCuadros(300);
    const eventos = []; const junta = e => eventos.push(...e.value);
    cdp.on('Tracing.dataCollected', junta);
    const fin2 = new Promise(r => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['toplevel', 'gpu', 'viz', 'cc', 'blink', 'v8', 'disabled-by-default-display.framedisplayed', 'disabled-by-default-gpu.dawn', 'gpu.dawn'] } });
    await esperarCuadros(180);
    await cdp.send('Tracing.end'); await fin2; cdp.off('Tracing.dataCollected', junta);
    writeFileSync(`${base}-v${visita}-chrome.json`, JSON.stringify({ traceEvents: eventos }));
    await esperarCuadros(Math.max(0, SEGUNDOS * 60 - 480));
    if (items) clearInterval(items);
  } else {
  await esperarCuadros(SEGUNDOS * 60);
  if (items) clearInterval(items);
  await cdp.send('Tracing.end');
  await completa;
  }
  let perfil = null;
  if (perfilar) {
    const { profile } = await cdp.send('Profiler.stop');
    const porId = new Map(profile.nodes.map(n => [n.id, n])), cuenta = new Map();
    for (const id of profile.samples) {
      const cf = porId.get(id).callFrame;
      const nombre = cf.functionName || (cf.url ? `(${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1})` : '(nativo)');
      cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1);
    }
    perfil = [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, c]) => [n, +(100 * c / profile.samples.length).toFixed(2)]);
    writeFileSync(`${base}-v${visita}-perfil.txt`, perfil.map(([n, x]) => `${String(x).padStart(6)} %  ${n}`).join('\n'));
  }
  cdp.off('Tracing.dataCollected', ondata);
  writeFileSync(`${base}-v${visita}-mostrados.json`, JSON.stringify(mostrados));   // horas de cada imagen (para reanalizar)
  await pagina.screenshot({ path: `${base}-v${visita}.png` });   // la foto de la carrera (para no romper la imagen)
  await pagina.keyboard.up('KeyK');
  const hasta = await ahoraJuego(), c1 = await cuadros(), w1 = Date.now();
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const ocupado = 100 * (m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp);
  const heapMB = await juego.evaluate(() => window.mkwHeapMB());
  const programa = await juego.evaluate(() => window.mkwEstado.programa || null);
  const traza = await juego.evaluate(() => window.mkwTrazaRitmo());
  // la traza de la carrera, en el formato de la consola ([traza] [...]) para herramientas/analizar-traza.mjs
  writeFileSync(`${base}-v${visita}-traza.log`, traza.filter(e => e[1] >= desde && e[1] <= hasta).reduce((o, e, i, a) =>
    i % 3000 ? o : o + '[traza] ' + JSON.stringify(a.slice(i, i + 3000)) + '\n', ''));
  // GPU: demora entre el primer envío de cada cuadro y que la tarjeta lo termine (?gpu=1 en mkw.mjs)
  const gpu = (await juego.evaluate(() => window.mkwGpu ? window.mkwGpu() : [])).filter(([t]) => t >= desde && t <= hasta).map(([, d]) => d).sort((a, b) => a - b);
  const gpuPct = q => gpu[Math.min(gpu.length - 1, Math.floor(q * gpu.length))] || 0;

  // CPU por cuadro (juego + aurora) de los cuadros entregados dentro de la ventana de la carrera; ver tiempos-cuadro.mjs
  // y los tirones: cuadros cuyo ciclo (entrega a entrega) pasó de 33 ms, con su desglose
  const cpu = [], tironesCuadro = [];
  let previo = null;
  for (const [c, t, , esp, dis] of traza) {
    if (c === 1) {
      if (previo && previo.t2 && previo.t1 >= desde && t <= hasta) {
        const juegoMs = t - previo.t2 - ((esp - previo.esp2) + (dis - previo.dis2)), auroraMs = previo.t2 - previo.t1;
        cpu.push(juegoMs + auroraMs);
        if (t - previo.t1 > 33) tironesCuadro.push({ s: +((previo.t1 - desde) / 1000).toFixed(2), ciclo: +(t - previo.t1).toFixed(1),
          juego: +juegoMs.toFixed(1), aurora: +auroraMs.toFixed(1), esperaRuntime: +(esp - previo.esp2).toFixed(1), disco: +(dis - previo.dis2).toFixed(1) });
      }
      previo = { t1: t };
    } else if (c === 2 && previo && !previo.t2) { previo.t2 = t; previo.esp2 = esp; previo.dis2 = dis; }
  }
  const orden = [...cpu].sort((a, b) => a - b), pct = q => orden[Math.min(orden.length - 1, Math.floor(q * orden.length))] || 0;
  // Ritmo en pantalla: cuánto duró cada imagen, en refrescos del monitor (p = período del refresco, del reloj de la
  // página). A 60 fps en un monitor de 240 Hz cada imagen debería durar 4 refrescos; "tirón" = una imagen que duró más
  // de 1,5 veces lo esperado (se vio la misma imagen de más: el ojo lo nota, más a alta velocidad).
  const p = await juego.evaluate(() => (window.mkw && window.mkw.mkwVsync && window.mkw.mkwVsync.p) || 0).catch(() => 0) || 1000 / 60;
  const esperado = Math.max(1, Math.round((1000 / 60) / p));
  const huecos = {}; let tirones = 0, peorHueco = 0;
  for (let i = 1; i < mostrados.length; i++) {
    const d = mostrados[i] - mostrados[i - 1], n = Math.max(1, Math.round(d / p));
    huecos[n] = (huecos[n] || 0) + 1;
    if (n > esperado * 1.5) tirones++;
    peorHueco = Math.max(peorHueco, d);
  }
  const parejos = mostrados.length > 1 ? 100 * (huecos[esperado] || 0) / (mostrados.length - 1) : 0;
  // "A compás": la pantalla también muestra imágenes de más que no son cuadros del juego (cuando cambia un texto de la
  // página, p. ej. el medidor de fps cada 1 s, el compositor dibuja una imagen extra: huecos 2+2 en vez de un 4). La
  // imagen del juego no cambia ni se corre, el ojo no lo ve. Aquí se juntan los huecos cortos seguidos que suman
  // justo lo esperado (2+2, 1+3, 3+1…) y se cuenta qué parte de los cuadros quedó en su lugar.
  let enCompas = 0, totalCompas = 0;
  for (let i = 1, acum = 0; i < mostrados.length; i++) {
    const n = Math.max(1, Math.round((mostrados[i] - mostrados[i - 1]) / p));
    if (acum + n < esperado) { acum += n; continue; }   // imagen extra: sigue sumando
    totalCompas++; if (acum + n === esperado) enCompas++;
    acum = 0;
  }
  const aCompas = totalCompas ? 100 * enCompas / totalCompas : 0;
  const r = {
    visita, tarjeta, ...aislada, freno: FRENO,
    primerCuadroS: tPrimer / 1000, hastaCarreraS: tCarrera / 1000,
    fpsCarrera: (c1 - c0) / ((w1 - w0) / 1000),
    cpuMs: { promedio: cpu.reduce((s, x) => s + x, 0) / (cpu.length || 1), p95: pct(0.95), p99: pct(0.99), max: orden[orden.length - 1] || 0,
             cuadros: cpu.length, pasados: cpu.filter(x => x > 16.7).length },
    hiloOcupado: ocupado, heapMB, tironesCuadro, programa,
    gpuMs: { promedio: gpu.reduce((a, b) => a + b, 0) / (gpu.length || 1), p95: gpuPct(0.95), p99: gpuPct(0.99), max: gpu[gpu.length - 1] || 0, n: gpu.length },
    pantalla: { hz: 1000 / p, imagenes: mostrados.length, parejosPct: parejos, aCompasPct: aCompas, tirones, peorHuecoMs: peorHueco, huecos },
    bajadoMB: Object.fromEntries(Object.entries(bajado).map(([k, v]) => [k, { mb: +v.mb.toFixed(1), pedidos: v.pedidos }])), desdeCacheHttp: desdeCache.n,
  };
  console.log(`[${ETIQUETA} · ${PERFIL} · visita ${visita}] tarjeta: ${tarjeta}; aislada: ${aislada.crossOriginIsolated}, SharedArrayBuffer: ${aislada.sab}`);
  console.log(`  primer cuadro ${r.primerCuadroS.toFixed(1)} s, carrera a los ${r.hastaCarreraS.toFixed(1)} s, ${r.fpsCarrera.toFixed(1)} fps en la carrera`);
  if (programa && programa.llegó) console.log(`  programa (.wasm): llegó en ${(programa.bajarMs / 1000).toFixed(1)} s, ` +
    `${(programa.bytes / 1048576).toFixed(1)} MB por la red${programa.bytes === 0 ? ' (de la caché HTTP)' : ''} ` +
    `(${(programa.comprimido / 1048576).toFixed(1)} MB → ${(programa.descomprimido / 1048576).toFixed(1)} MB), listo ${(programa.compilarMs / 1000).toFixed(2)} s después`);
  console.log(`  CPU por cuadro: promedio ${r.cpuMs.promedio.toFixed(2)} ms, p95 ${r.cpuMs.p95.toFixed(2)}, p99 ${r.cpuMs.p99.toFixed(2)}, máx ${r.cpuMs.max.toFixed(1)}; ` +
              `${r.cpuMs.pasados} de ${r.cpuMs.cuadros} cuadros > 16,7 ms`);
  console.log(`  pantalla ${r.pantalla.hz.toFixed(0)} Hz: ${mostrados.length} imágenes, ${parejos.toFixed(1)} % duraron ${esperado} refresco(s) (${aCompas.toFixed(1)} % a compás, sin las imágenes extra), ` +
              `${tirones} tirones, peor ${peorHueco.toFixed(0)} ms; refrescos por imagen: ` + Object.entries(huecos).map(([n, k]) => `${n}→${k}`).join(' '));
  console.log(`  GPU por cuadro (hasta que la tarjeta termina): promedio ${r.gpuMs.promedio.toFixed(2)} ms, p95 ${r.gpuMs.p95.toFixed(2)}, p99 ${r.gpuMs.p99.toFixed(2)}, máx ${r.gpuMs.max.toFixed(1)}`);
  for (const x of tironesCuadro) console.log(`  tirón a los ${x.s} s: ciclo ${x.ciclo} ms = juego ${x.juego} + aurora ${x.aurora} + espera del runtime ${x.esperaRuntime} + disco ${x.disco}`);
  console.log(`  hilo principal ocupado ${ocupado.toFixed(0)} %, heap del wasm ${heapMB.toFixed(0)} MB, bajado: ` +
              Object.entries(r.bajadoMB).map(([k, v]) => `${k} ${v.mb} MB (${v.pedidos} pedidos)`).join(', ') + `, de la caché HTTP ${desdeCache.n}`);
  await cdp.detach();
  return r;
}
