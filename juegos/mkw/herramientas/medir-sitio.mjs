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
//   --arranque: (§151, V2) además, lo que sufre el resto del navegador mientras el juego carga: otra pestaña con un latido
//     cada 50 ms (cuánto se atrasa = cuánto se trabó Chrome entero; meta del paso 4: ≤ 50 ms), el CPU de cada proceso de
//     Chrome cada segundo (CDP SystemInfo.getProcessInfo) y las tareas largas desde que abre la página
//   --piloto: (§157, U3) sin las teclas de siempre: el piloto de la página va a la carrera que diga --extra (por ejemplo
//     "&modo=tt&copa=0&fila=0" = Contrarreloj, "&modo=vs&copa=0&fila=0&cpu=maximo" = 12 karts en la misma pista)
//   --nucleos N: (§151) Chrome atado a los primeros N núcleos (como el PC de un amigo con pocos núcleos; Windows)
//     (§158: y la página ve N en navigator.hardwareConcurrency, como en un PC de N de verdad; --nucleos-sin-decir = no)
//   --navegador chrome|opera-gx|<ruta .exe>: (§289) otro navegador Chromium (también MKW_NAVEGADOR); perfil nuevo en %TEMP%
// Pedidos al Worker (el plan gratis de Workers da 100.000 llamadas al día, §104): los cuenta el Worker local mismo
// (/__cuenta, con las preguntas previas de CORS que la página no ve), por tramo (hasta el primer cuadro, hasta la carrera,
// la carrera) y por tipo (preguntas, programa, semillas, pedazos del disco…) → <base>-v<n>-pedidos.json.
// Deja build/web/datos/medir-sitio/<etiqueta>-<perfil>.json, .log (la consola del juego) y -v1.png (foto de la carrera).
import { opcionesNavegador, elegirNavegador } from './navegador.mjs';   // §289: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resumir, textoResumen } from '../web/navegador/imagenes-vista.mjs';   // (§256, G16)

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
// (§162: --help / -h imprime el uso de la cabecera y sale; antes no se miraba y lanzaba una medida con la etiqueta «base»)
if (args.includes('--help') || args.includes('-h')) {
  const { readFileSync } = await import('node:fs');
  const cabecera = readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/);
  console.log(cabecera.slice(0, cabecera.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PERFIL = opcion('--perfil', 'pc');
const ETIQUETA = opcion('--etiqueta', 'base');
const SEGUNDOS = Number(opcion('--segundos', 20));
const EXTRA = opcion('--extra', '');
const LATENCIA = opcion('--latencia', '50');
const VISITAS = Number(opcion('--visitas', 1));
const PILOTO = args.includes('--piloto');   // §157: la carrera la busca el piloto de la página (ver más abajo)
const PUERTO = Number(opcion('--puerto', 8160));   // (§155: --puerto N = al lado de otra medición; usa N y N+1)
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
// (--sola: la página suelta no tiene a Juegos que le dé el token, así que va con el "Worker" de antes, sin token; §65)
const sitio = spawn(process.execPath, [path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO), '--latencia', LATENCIA,
  ...(args.includes('--sola') || args.includes('--worker-viejo') ? ['--worker', 'servidor'] : [])],   // --worker-viejo: comparar con el de antes
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => { let t = ''; sitio.stdout.on('data', d => { t += d; if (t.includes('worker (')) listo(); }); });
const PAGES = `http://127.0.0.1:${PUERTO}`, WORKER = `http://127.0.0.1:${PUERTO + 1}`;
const cuentaWorker = async lista => { try { return await (await fetch(`${WORKER}/__cuenta${lista ? '?lista=1' : ''}`)).json(); } catch { return null; } };
// de qué es cada pedido (la ruta, sin el /mkw del principio)
const tipoPedido = ([, metodo, ruta, rango]) => metodo === 'OPTIONS' ? 'preguntas CORS'
  : /\/manifiesto\.json$/.test(ruta) ? 'manifiesto'
  : /\/build\/mkw\.(wasm|js)$/.test(ruta) ? 'programa'
  : /\/build\/diminutos\.bin$/.test(ruta) ? 'diminutos.bin'
  : /\/lote$/.test(ruta) ? 'lotes'
  : /\/build\//.test(ruta) ? 'build (semillas, imágenes)'
  : rango !== '' ? 'pedazos del disco' : 'archivos enteros';

// 2) Chrome de verdad (el instalado), con un perfil nuevo (primera visita), sin sonido (pedido del dueño)
const carpetaPerfil = path.join(os.tmpdir(), 'mkw-medir-' + process.pid);
// §289: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR); el perfil es siempre esta carpeta nueva de %TEMP%, nunca el del dueño
const NAVEGADOR = elegirNavegador();
if (NAVEGADOR.nombre !== 'chrome') console.log(`(§289: navegador ${NAVEGADOR.nombre}: ${NAVEGADOR.exe})`);
const contexto = await chromium.launchPersistentContext(carpetaPerfil, {
  // §158: --chrome "…" = banderas de más para Chrome (diagnóstico, p. ej. --js-flags=--liftoff-only), separadas por espacios
  ...opcionesNavegador(), headless: !args.includes('--ventana'), args: ['--mute-audio',
    // --ventana: en el monitor de 144 Hz (el de la izquierda, §160); MKW_VENTANA="x,y" = otro lugar
    ...(args.includes('--ventana') ? [`--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] : []), ...(args.includes('--chrome') ? String(opcion('--chrome', '')).split(' ').filter(Boolean) : [])],
  // §229: --viewport AxB = otro tamaño de la página; --dpr N = píxeles por punto (N11: con 1,5 el lienzo del juego, que
  // en la página mide 854×480 puntos, queda de 1281×720 píxeles; la bandera --force-device-scale-factor no sirve: Playwright la pisa)
  ...(PERFIL.startsWith('celular') ? devices['Pixel 7'] : { viewport: args.includes('--viewport') ? (([w, h]) => ({ width: w, height: h }))(String(opcion('--viewport', '1280x800')).split('x').map(Number)) : { width: 1280, height: 800 },
    ...(args.includes('--dpr') ? { deviceScaleFactor: Number(opcion('--dpr', 1)) } : {}) }),
});
// §151 (V2): --nucleos N = Chrome (y los procesos que abra después, que heredan la máscara) en los primeros N núcleos
if (args.includes('--nucleos')) {
  const n = Number(opcion('--nucleos', 4)), mascara = (2 ** n) - 1;
  const ps = `Get-CimInstance Win32_Process -Filter "Name='${NAVEGADOR.proceso}'" | Where-Object { $_.CommandLine -like '*${path.basename(carpetaPerfil)}*' } | ForEach-Object { (Get-Process -Id $_.ProcessId).ProcessorAffinity = ${mascara} }`;
  spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  console.log(`(${NAVEGADOR.nombre} atado a ${n} núcleos)`);
  // §158: la afinidad no cambia lo que Chrome le dice a la página (navigator.hardwareConcurrency seguía en 16 y el tope
  // del precalentado salía de 16); un PC de N procesadores lógicos de verdad dice N. --nucleos-sin-decir = lo de §151/§156
  if (!args.includes('--nucleos-sin-decir'))
    await contexto.addInitScript(k => { try { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => k, configurable: true }); } catch {} }, n);
}
// §117 (C1): las tareas largas (≥ 50 ms: la página trabada) de cada marco desde que abre, con su hora
await contexto.addInitScript(() => {
  window.__largas = [];
  try { new PerformanceObserver(l => { for (const t of l.getEntries()) window.__largas.push([Math.round(t.startTime), Math.round(t.duration)]); })
    .observe({ type: 'longtask', buffered: true }); } catch {}
});
const resultados = [];
for (let visita = 1; visita <= VISITAS; visita++) resultados.push(await medirUnaVez(visita));
await contexto.close();
sitio.kill();
try { rmSync(carpetaPerfil, { recursive: true, force: true }); } catch {}
writeFileSync(base + '.json', JSON.stringify({ etiqueta: ETIQUETA, navegador: NAVEGADOR.nombre, version: contexto.browser()?.version?.() ?? null, perfil: PERFIL, freno: FRENO, extra: EXTRA, latencia: +LATENCIA, segundos: SEGUNDOS, visitas: resultados }, null, 1));
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
  const lineasPip = [];             // §117: las líneas «[pipelines]» de aurora (una por segundo: pedidos, en camino…)
  pagina.on('console', m => { const t = m.text(); log.write(`[v${visita}] ${t}\n`); if (t.startsWith('[pipelines]')) lineasPip.push([Date.now(), t]); });
  pagina.on('pageerror', e => log.write(`[v${visita}] [pageerror] ${e.message}\n`));

  // §151 (V2): --arranque = otra pestaña con un latido cada 50 ms y el CPU de cada proceso de Chrome cada segundo
  let latido = null, procesos = null;
  if (args.includes('--arranque')) {
    latido = await contexto.newPage();
    // §158: --latido-aparte = la otra pestaña en OTRO sitio (localhost, no 127.0.0.1): Chrome la pone sí o sí en otro
    // proceso, así mide el navegador entero y no las tareas largas del juego (una página data: puede compartir proceso)
    const codigo = 'window.atrasos=[];let t=performance.now();setInterval(()=>{const a=performance.now();atrasos.push([Date.now(),Math.round(a-t-50)]);t=a},50)';
    if (args.includes('--latido-aparte')) {
      await latido.goto(`http://localhost:${PUERTO + 1}/__cuenta`).catch(() => {});
      await latido.evaluate(codigo);
    } else await latido.goto(`data:text/html,<title>latido</title><script>${codigo}</script>`);
    await pagina.bringToFront();
    procesos = { muestras: [], fallo: '' };
    // (§156: SystemInfo.getProcessInfo solo contesta en una sesión del navegador entero, no en la de una pestaña)
    const navCdp = await (contexto.browser()?.newBrowserCDPSession?.() ?? Promise.reject(new Error('sin navegador')))
      .catch(() => contexto.newCDPSession(latido));
    const tomar = async () => {
      try { const { processInfo } = await navCdp.send('SystemInfo.getProcessInfo'); procesos.muestras.push([Date.now(), processInfo.map(x => [x.type, x.id, x.cpuTime])]); }
      catch (e) { procesos.fallo = String(e.message || e).slice(0, 120); }
    };
    procesos.reloj = setInterval(tomar, 1000); await tomar();
  }
  const cw0 = await cuentaWorker(false), marcas = {};
  const extraPagina = `&auto=1&traza=1&gpu=1${EXTRA}`;
  const t0 = Date.now();
  if (args.includes('--sola')) await pagina.goto(`${PAGES}/juegos/mkw/web/navegador/index.html?privado=${WORKER}${extraPagina}`);
  else await pagina.goto(`${PAGES}/juegos.html?mkw=${encodeURIComponent(extraPagina)}`);
  // el marco del juego (o la página sola)
  let juego = null;
  for (let i = 0; i < 600 && !juego; i++) {
    juego = pagina.frames().find(f => f.url().includes('/juegos/mkw/web/navegador/index.html'));
    if (!juego) await pagina.waitForTimeout(100);
  }
  const cuadros = () => juego.evaluate(() => window.mkwCuadros ? window.mkwCuadros() : 0).catch(() => 0);
  const ahoraJuego = () => juego.evaluate(() => performance.now());
  // primer cuadro: mirando el contador cada 50 ms
  let tPrimer = null;
  for (let i = 0; i < 6000 && tPrimer === null; i++) { if (await cuadros() > 0) tPrimer = Date.now() - t0; else await pagina.waitForTimeout(50); }
  marcas.primerCuadro = (await cuentaWorker(false))?.pedidos;
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
  if (PILOTO) {
    // §157 (U3): con --piloto el piloto de la página lleva el juego (?modo=tt|vs&copa=…&fila=… en --extra): se espera a
    // que llegue a la carrera (mkwEstado.enCarrera, §118) y a que pase la cuenta, sin tocar teclas
    for (let i = 0; ; i++) {
      const e = await juego.evaluate(() => ({ llego: window.mkwEstado.piloto?.llego, enCarrera: !!window.mkwEstado.enCarrera })).catch(() => ({}));
      if (e.llego && e.enCarrera) break;
      if (i > Number(opcion('--piloto-espera', 240)) * 10) throw new Error('el piloto no llegó a la carrera');   // §158: --piloto-espera s (240 por omisión)
      await pagina.waitForTimeout(100);
    }
    await esperarCuadros(300);                      // la presentación y la cuenta
  } else
  for (const [tecla, c] of PASOS) { await pagina.keyboard.down(tecla); await pagina.waitForTimeout(120); await pagina.keyboard.up(tecla); await esperarCuadros(c); }
  // la carrera: K apretada SEGUNDOS × 60 cuadros, midiendo
  const tCarrera = Date.now() - t0;
  // §151 (V2): lo que se atrasó la otra pestaña y el CPU por tipo de proceso, de abrir la página a la carrera
  let arranque = null, lineaTiempo = null;
  if (latido) {
    clearInterval(procesos.reloj);
    const visible = await latido.evaluate(() => document.visibilityState).catch(() => '?');
    const crudos = await latido.evaluate(() => window.atrasos).catch(() => []);
    const at = crudos.map(([, d]) => d).sort((a, b) => a - b);
    // §158: la línea de tiempo segundo a segundo (desde que se abrió la página): el peor atraso de la otra pestaña, el CPU
    // de cada tipo de proceso ese segundo y la última línea «[pipelines]» de aurora; así se ve QUÉ pasaba en cada traba
    const linea = new Map(), seg = ms => Math.floor((ms - t0) / 1000);
    const fila = s => linea.get(s) || (linea.set(s, { s, peor: 0, cpu: {}, pip: '' }), linea.get(s));
    for (const [ms, d] of crudos) if (ms >= t0) { const f = fila(seg(ms)); f.peor = Math.max(f.peor, d); }
    for (let i = 1; i < procesos.muestras.length; i++) {
      const [ta, la] = procesos.muestras[i - 1], [tb, lb] = procesos.muestras[i], antes = new Map(la.map(([, id, c]) => [id, c]));
      if (tb < t0) continue;
      const f = fila(seg(tb)), dt = (tb - ta) / 1000;
      for (const [tipo, id, c] of lb) f.cpu[tipo] = Math.round(((f.cpu[tipo] || 0) + (c - (antes.get(id) ?? c)) / dt) * 100) / 100;
    }
    for (const [ms, t] of lineasPip) if (ms >= t0) fila(seg(ms)).pip = t.slice(0, 160);
    // y las tareas largas del marco del juego, en la misma hora (su performance.now + su timeOrigin)
    const { origen, largas } = await juego.evaluate(() => ({ origen: performance.timeOrigin, largas: (window.__largas || []).slice() })).catch(() => ({ largas: [] }));
    if (origen) for (const [ini, dur] of largas) { const f = fila(seg(origen + ini)); f.largaJuego = Math.max(f.largaJuego || 0, dur); }
    lineaTiempo = [...linea.values()].sort((a, b) => a.s - b.s);
    const q = x => at[Math.min(at.length - 1, Math.floor(x * at.length))] ?? null;
    // CPU de cada tipo de proceso: el tiempo de CPU gastado entre la primera y la última muestra / los segundos (1 = un núcleo)
    const cpu = {};
    const [m0, m1] = [procesos.muestras[0], procesos.muestras.at(-1)];
    if (m0 && m1 && m1[0] > m0[0]) {
      const antes = new Map(m0[1].map(([, id, c]) => [id, c])), s = (m1[0] - m0[0]) / 1000;
      for (const [tipo, id, c] of m1[1]) cpu[tipo] = Math.round(((cpu[tipo] || 0) + (c - (antes.get(id) || 0)) / s) * 100) / 100;
      // el pico: el segundo de más CPU del renderer (la pestaña del juego)
    }
    const peores = [...lineaTiempo].sort((a, b) => b.peor - a.peor).slice(0, 6).sort((a, b) => a.s - b.s);
    arranque = { latido: { visible, muestras: at.length, p50: q(0.5), p99: q(0.99), peor: at.at(-1) ?? null, mas50: at.filter(x => x > 50).length },
                 peores,
                 cpuPorTipo: cpu, segundos: m0 && m1 ? Math.round((m1[0] - m0[0]) / 1000) : 0, fallo: procesos.fallo || undefined };
    await latido.close().catch(() => {});
  }
  marcas.carrera = (await cuentaWorker(false))?.pedidos;
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const desde = await ahoraJuego(), c0 = await cuadros(), w0 = Date.now();
  const marcaImagenes = await juego.evaluate(() => window.mkwEstado.imagenes?.marca() ?? null).catch(() => null);   // (§256)
  const largasAntes = await juego.evaluate(() => (window.__largas || []).slice()).catch(() => []);
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
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['toplevel', 'gpu', 'viz', 'cc', 'blink', 'v8', 'disabled-by-default-display.framedisplayed', 'disabled-by-default-gpu.dawn', 'gpu.dawn',
      // §165 (--trazaV8): lo de adentro de V8, para repartir el «(program)» del perfil: compilación, recolector, wasm, IC
      ...(args.includes('--trazaV8') ? ['v8.wasm', 'v8.execute', 'disabled-by-default-v8.compile', 'disabled-by-default-v8.gc', 'disabled-by-default-v8.wasm.detailed', 'disabled-by-default-v8.runtime', 'disabled-by-default-v8.runtime_stats', 'devtools.timeline', 'blink.bindings'] : [])] } });
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
  // §229 (N11): con ?n11=MBIT, el video de la imagen del juego en los segundos de la carrera medidos (n11-video.mjs)
  if (/[?&]n11=/.test(EXTRA)) {
    const n11 = await juego.evaluate(([a]) => { const e = window.mkwEstado.n11; return e ? { r: e.resumen(a, performance.now()), info: e.info, fallo: e.fallo } : null; }, [desde]).catch(e => ({ fallo: String(e) }));
    writeFileSync(`${base}-v${visita}-n11.json`, JSON.stringify(n11, null, 1));
    console.log(`  n11 (§229): ${JSON.stringify(n11)}`);
  }
  // §163: con ?tramo=A-B en --extra, esperar a que el juego pase el cuadro de lógica B (hasta 15 min) y guardar el tramo
  let tramo = null;
  if (/[?&]tramo=\d+-\d+/.test(EXTRA)) {
    for (let i = 0; i < 9000 && !tramo; i++) { tramo = await juego.evaluate(() => window.mkwEstado.tramo?.resultado ?? null).catch(() => null); if (!tramo) await pagina.waitForTimeout(100); }
    // (§177.2, G2: cuántas pasadas no guardaron la profundidad desde que arrancó; null = el programa no lo trae)
    if (tramo) tramo.zDescartadas = await juego.evaluate(() => window.mkwEstado.zDescartadas?.() ?? null).catch(() => null);
    // (§222, E4: con el programa de los techos, qué se escondió de verdad; null = el programa no lo trae)
    if (tramo) tramo.techoE4 = await juego.evaluate(() => window.mkwEstado.techo?.() ?? null).catch(() => null);
    if (tramo?.techoE4) { const t = tramo.techoE4; console.log(`  techo (§222): ${JSON.stringify({ ...t, porOpcion: undefined })}; en la escena por opción: ${(t.porOpcion || []).map((n, k) => n ? `${k}:${n}` : '').filter(Boolean).join(' ')}`); }
    if (tramo?.w31) console.log(`  w31 (§259): ${JSON.stringify(tramo.w31)}`);   // (las listas de dibujo del tramo, ?w31=…)
    // (§224, W22: con ?censoGpu=1, el censo de las llamadas a WebGPU; termina dentro del tramo: se espera hasta 5 min más)
    if (tramo && /[?&]censoGpu=1/.test(EXTRA)) {
      let c = null;
      for (let i = 0; i < 3000 && !c; i++) { c = await juego.evaluate(() => { const x = window.mkwEstado.censoGpu; return x?.estado?.fase === 'listo' ? { r: x.resultado, fallo: x.estado.fallo } : null; }).catch(() => null); if (!c) await pagina.waitForTimeout(100); }
      tramo.censoGpu = c ?? { fallo: 'el censo no terminó' };
      const r = c?.r;
      console.log(r ? `  censo (§224): ráfaga ${r.rafagaMs.mediana} ms/imagen (${r.rafagaMs.enviosPorImagen} envíos), ${r.llamadasPorImagen} llamadas/imagen; ` +
        `grabada: ${r.grabada.pasadas} pasadas, ${r.grabada.ordenes} órdenes ${JSON.stringify(r.grabada.tipos)}; ` +
        `repetición: ${r.repeticion.map(x => `${x.iguales}/${x.ordenes} iguales, ${x.soloDesplazamiento} solo desplazamiento`).join(' · ')}; ` +
        `ensayo (ms/imagen): completo ${r.ensayo.completo?.ms}, sin constantes ${r.ensayo.sinUniformes?.ms}, bundles ${r.ensayo.bundles?.ms ?? '—'} ` +
        `(${r.ensayo.bundlesN} bundles${r.ensayo.bundlesFallo ? ', falla ' + r.ensayo.bundlesFallo : ''}), subidas ${r.ensayo.subidas?.ms}` : `  censo (§224): ${c?.fallo ?? 'no terminó'}`);
    }
    writeFileSync(`${base}-v${visita}-tramo.json`, JSON.stringify(tramo ?? { fallo: 'el tramo no terminó' }, null, 1));
    console.log(`  tramo (§163): ${tramo ? `cuadros ${tramo.desde}–${tramo.hasta} en ${tramo.ms} ms: ${tramo.logicaPorSeg} de lógica/s, ${tramo.imagenesPorSeg} imágenes/s, ` +
      `techo de CPU ${tramo.cpuPorSeg}/s; por cuadro (ms): ${Object.entries(tramo.porCuadro).map(([k, v]) => `${k} ${v}`).join(', ')}` : 'no terminó'}`);
    // §164: con ?perfilGpu=1, la tarjeta por imagen (sus propias marcas de tiempo, en el tramo) contra la CPU por imagen
    if (tramo?.tarjeta) console.log(`  tarjeta en el tramo (§164): ${tramo.tarjeta.msPorImagen ?? '—'} ms por imagen (${tramo.tarjeta.imagenes ?? '—'} imágenes${tramo.tarjeta.fallo ? ', falla: ' + tramo.tarjeta.fallo : ''}); ` +
      `CPU ${tramo.cpuMsPorImagen ?? '—'} ms por imagen → pone el techo: ${tramo.techo ?? '—'}; pasadas: ${(tramo.tarjeta.pasadas || []).join(' · ')}` +
      (tramo.zDescartadas != null ? `; profundidad descartada en ${tramo.zDescartadas} pasadas (G2)` : ''));
  }
  let perfil = null;
  if (perfilar) {
    const { profile } = await cdp.send('Profiler.stop');
    // el perfil entero (para repartirlo por grupos: node herramientas/perfil-impuesto.mjs --solo-perfil <archivo>, §160);
    // tiene los nombres de las funciones del juego: se queda en build/, nunca a git
    writeFileSync(`${base}-v${visita}.cpuprofile`, JSON.stringify(profile));
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
  // los pedidos al Worker de esta visita: por tramo y por tipo
  const cw1 = await cuentaWorker(true);
  let pedidosWorker = null;
  if (cw0 && cw1) {
    const lista = cw1.lista.slice(cw0.pedidos), porTipo = {};
    for (const x of lista) { const k = tipoPedido(x); porTipo[k] = porTipo[k] || { n: 0, mb: 0 }; porTipo[k].n++; porTipo[k].mb += (x[3] || 0) / 1048576; }
    for (const v of Object.values(porTipo)) v.mb = +v.mb.toFixed(1);
    pedidosWorker = { total: lista.length, hastaPrimerCuadro: (marcas.primerCuadro ?? cw0.pedidos) - cw0.pedidos,
                      hastaCarrera: (marcas.carrera ?? cw0.pedidos) - cw0.pedidos, enCarrera: cw1.pedidos - (marcas.carrera ?? cw0.pedidos), porTipo };
    writeFileSync(`${base}-v${visita}-pedidos.json`, JSON.stringify({ ...pedidosWorker, lista }, null, 0));
  }
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const ocupado = 100 * (m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp);
  const heapMB = await juego.evaluate(() => window.mkwHeapMB());
  const programa = await juego.evaluate(() => window.mkwEstado.programa || null);
  // §104: lo que pasó por lote (lote.mjs) y lo que fue de a uno (disco.mjs)
  const lotes = await juego.evaluate(() => ({ lotes: window.mkwEstado.lotes ? { ...window.mkwEstado.lotes, historia: undefined } : null,
    historia: window.mkwEstado.lotes?.historia || [],
    porLote: window.mkwDisco?.estado.porLote, deAUno: window.mkwDisco?.estado.deAUno,
    // §146 (D3): lo de fondo que el juego esperó: subido a urgente / pedido aparte / y el aparte llegó antes
    apurados: window.mkwDisco?.estado.apurados, aparte: window.mkwDisco?.estado.aparte, aparteGano: window.mkwDisco?.estado.aparteGano,
    esperaRed: window.mkwDisco?.estado.esperaRed }));
  // §149 (H2): el informe de rendimiento de la página, con el presupuesto de la gama media (cada pieza contra su meta)
  const informe = await juego.evaluate(() => window.mkwInformeRendimiento?.() ?? null).catch(() => null);
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
  // §117 (C1): la carga, del primer cuadro a la carrera. Cuadros del juego cuyo ciclo pasó de 50 ms (se vio trabado),
  // tareas largas de la página (el hilo trabado ≥ 50 ms) y lo que dijo aurora de los pipelines cada segundo.
  const ciclosCarga = [];
  for (let i = 0, prev = null; i < traza.length; i++) {
    const [c, t] = traza[i];
    if (c !== 1) continue;
    if (t >= desde) break;
    if (prev !== null) ciclosCarga.push(t - prev);
    prev = t;
  }
  const largasCarrera = (await juego.evaluate(() => (window.__largas || []).slice()).catch(() => [])).filter(([t]) => t >= desde && t <= hasta);
  const suma = l => l.reduce((s, [, d]) => s + d, 0), peor = l => l.reduce((m, [, d]) => Math.max(m, d), 0);
  const pip = { maxEnCamino: 0, maxPedidosPorS: 0, maxTardanzaMs: 0, saltados: 0, armadosYa: 0, pedidosTodosS: null, total: null, tope: null };
  for (const [, t] of lineasPip) {
    let m;
    if ((m = /(\d+) pedidos en segundo plano/.exec(t))) pip.maxPedidosPorS = Math.max(pip.maxPedidosPorS, +m[1]);
    if ((m = /tardaron (\d+) ms/.exec(t))) pip.maxTardanzaMs = Math.max(pip.maxTardanzaMs, +m[1]);
    if ((m = /(\d+) en camino/.exec(t))) pip.maxEnCamino = Math.max(pip.maxEnCamino, +m[1]);
    if ((m = /(\d+) dibujos saltados/.exec(t))) pip.saltados += +m[1];
    if ((m = /(\d+) armados en el momento/.exec(t))) pip.armadosYa += +m[1];
    if ((m = /precalentando (\d+)/.exec(t))) pip.total = +m[1];
    if ((m = /con (\d+) compilándose como mucho/.exec(t))) pip.tope = +m[1];
    if ((m = /ya están pedidos \(([\d.]+) s/.exec(t))) pip.pedidosTodosS = +m[1];
  }
  const carga = {
    cuadros: ciclosCarga.length, mas50: ciclosCarga.filter(x => x > 50).length, mas100: ciclosCarga.filter(x => x > 100).length,
    peorCuadroMs: Math.round(ciclosCarga.reduce((m, x) => Math.max(m, x), 0)),
    largas: largasAntes.length, largasMs: suma(largasAntes), peorLargaMs: peor(largasAntes),
    largasCarrera: largasCarrera.length, peorLargaCarreraMs: peor(largasCarrera), pipelines: pip,
  };
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
  // §256 (G16): el 1 % y el 0,1 % bajo de lo que llegó al monitor (Display::FrameDisplayed), con las imágenes extra del
  // compositor juntadas como en «a compás» (dos de 2 refrescos = una de 4), y el de la página (imagenes-vista.mjs: cada
  // imagen de aurora, en el refresco en que se vio)
  const juntados = [];
  for (let i = 1, acum = 0; i < mostrados.length; i++) {
    const d = mostrados[i] - mostrados[i - 1]; acum += d;
    if (Math.round(acum / p) < esperado) continue;
    juntados.push(acum); acum = 0;
  }
  const bajoMonitor = resumir(juntados);
  const bajoPagina = marcaImagenes === null ? null : await juego.evaluate(m => {
    const v = window.mkwEstado.imagenes; return v ? { ...v.resumen(m), causas: v.causas(m) } : null; }, marcaImagenes).catch(() => null);
  const r = {
    visita, tarjeta, ...aislada, freno: FRENO, informe, arranque, apurar: { apurados: lotes.apurados, aparte: lotes.aparte, aparteGano: lotes.aparteGano, esperaRed: lotes.esperaRed },
    primerCuadroS: tPrimer / 1000, hastaCarreraS: tCarrera / 1000,
    fpsCarrera: (c1 - c0) / ((w1 - w0) / 1000),
    cpuMs: { promedio: cpu.reduce((s, x) => s + x, 0) / (cpu.length || 1), p95: pct(0.95), p99: pct(0.99), max: orden[orden.length - 1] || 0,
             cuadros: cpu.length, pasados: cpu.filter(x => x > 16.7).length },
    hiloOcupado: ocupado, heapMB, tironesCuadro, programa,
    gpuMs: { promedio: gpu.reduce((a, b) => a + b, 0) / (gpu.length || 1), p95: gpuPct(0.95), p99: gpuPct(0.99), max: gpu[gpu.length - 1] || 0, n: gpu.length },
    pantalla: { hz: 1000 / p, imagenes: mostrados.length, parejosPct: parejos, aCompasPct: aCompas, tirones, peorHuecoMs: peorHueco, huecos },
    bajo: { monitor: bajoMonitor, pagina: bajoPagina },   // §256 (G16)
    bajadoMB: Object.fromEntries(Object.entries(bajado).map(([k, v]) => [k, { mb: +v.mb.toFixed(1), pedidos: v.pedidos }])), desdeCacheHttp: desdeCache.n,
    pedidosWorker, lotes: { ...lotes, historia: undefined }, carga,
  };
  if (lotes.historia.length) writeFileSync(`${base}-v${visita}-lotes.json`, JSON.stringify(lotes.historia));
  if (lineaTiempo) writeFileSync(`${base}-v${visita}-linea.json`, JSON.stringify(lineaTiempo, null, 0));   // §158
  console.log(`[${ETIQUETA} · ${PERFIL} · visita ${visita}] tarjeta: ${tarjeta}; aislada: ${aislada.crossOriginIsolated}, SharedArrayBuffer: ${aislada.sab}`);
  console.log(`  primer cuadro ${r.primerCuadroS.toFixed(1)} s, carrera a los ${r.hastaCarreraS.toFixed(1)} s, ${r.fpsCarrera.toFixed(1)} fps en la carrera`);
  if (programa && programa.llegó) console.log(`  programa (.wasm): llegó en ${(programa.bajarMs / 1000).toFixed(1)} s, ` +
    `${(programa.bytes / 1048576).toFixed(1)} MB por la red${programa.bytes === 0 ? ' (de la caché HTTP)' : ''} ` +
    `(${(programa.comprimido / 1048576).toFixed(1)} MB → ${(programa.descomprimido / 1048576).toFixed(1)} MB), listo ${(programa.compilarMs / 1000).toFixed(2)} s después`);
  console.log(`  CPU por cuadro: promedio ${r.cpuMs.promedio.toFixed(2)} ms, p95 ${r.cpuMs.p95.toFixed(2)}, p99 ${r.cpuMs.p99.toFixed(2)}, máx ${r.cpuMs.max.toFixed(1)}; ` +
              `${r.cpuMs.pasados} de ${r.cpuMs.cuadros} cuadros > 16,7 ms`);
  console.log(`  pantalla ${r.pantalla.hz.toFixed(0)} Hz: ${mostrados.length} imágenes, ${parejos.toFixed(1)} % duraron ${esperado} refresco(s) (${aCompas.toFixed(1)} % a compás, sin las imágenes extra), ` +
              `${tirones} tirones, peor ${peorHueco.toFixed(0)} ms; refrescos por imagen: ` + Object.entries(huecos).map(([n, k]) => `${n}→${k}`).join(' '));
  console.log(`  1 % bajo (§256), lo que llegó al monitor: ${textoResumen(bajoMonitor)}`);
  if (bajoPagina) console.log(`  1 % bajo (§256), las imágenes de aurora en la página: ${textoResumen(bajoPagina)} · picos ${JSON.stringify(bajoPagina.causas)}`);
  console.log(`  GPU por cuadro (hasta que la tarjeta termina): promedio ${r.gpuMs.promedio.toFixed(2)} ms, p95 ${r.gpuMs.p95.toFixed(2)}, p99 ${r.gpuMs.p99.toFixed(2)}, máx ${r.gpuMs.max.toFixed(1)}`);
  console.log(`  la carga (primer cuadro → carrera): ${carga.cuadros} cuadros, ${carga.mas50} de más de 50 ms y ${carga.mas100} de más de 100 ms ` +
              `(el peor ${carga.peorCuadroMs} ms); tareas largas ${carga.largas} que suman ${carga.largasMs} ms (la peor ${carga.peorLargaMs} ms); ` +
              `en la carrera ${carga.largasCarrera} (la peor ${carga.peorLargaCarreraMs} ms)`);
  console.log(`  pipelines: precalentado ${pip.total ?? '?'}${pip.tope ? ` con tope ${pip.tope}` : ' sin tope'}, todos pedidos a los ${pip.pedidosTodosS ?? '?'} s; ` +
              `como mucho ${pip.maxPedidosPorS} pedidos en un segundo y ${pip.maxEnCamino} en camino; la llegada media más lenta ${pip.maxTardanzaMs} ms; ` +
              `${pip.saltados} dibujos saltados, ${pip.armadosYa} armados en el momento`);
  for (const x of tironesCuadro) console.log(`  tirón a los ${x.s} s: ciclo ${x.ciclo} ms = juego ${x.juego} + aurora ${x.aurora} + espera del runtime ${x.esperaRuntime} + disco ${x.disco}`);
  console.log(`  hilo principal ocupado ${ocupado.toFixed(0)} %, heap del wasm ${heapMB.toFixed(0)} MB, bajado: ` +
              Object.entries(r.bajadoMB).map(([k, v]) => `${k} ${v.mb} MB (${v.pedidos} pedidos)`).join(', ') + `, de la caché HTTP ${desdeCache.n}`);
  if (lotes.lotes) console.log(`  lotes: ${lotes.lotes.lotes} llamadas con ${lotes.lotes.piezas} pedazos (${(lotes.lotes.bytes / 1048576).toFixed(1)} MB; el mayor, ${lotes.lotes.mayor}; ` +
    `urgentes ${lotes.lotes.urgentes}, fallidos ${lotes.lotes.fallidos}${lotes.lotes.apagado ? ', APAGADO' : ''}); el disco: ${lotes.porLote} tramos por lote, ${lotes.deAUno} de a uno` +
    (lotes.apurados !== undefined ? `; el juego esperó a la red ${lotes.esperaRed} veces; de fondo apurados ${lotes.apurados}, aparte ${lotes.aparte} (llegó antes ${lotes.aparteGano})` : ''));
  if (arranque) console.log(`  arranque (§151): la otra pestaña (${arranque.latido.visible}) se atrasó p50 ${arranque.latido.p50} ms, p99 ${arranque.latido.p99} ms, ` +
    `el peor ${arranque.latido.peor} ms, ${arranque.latido.mas50} veces más de 50 ms (de ${arranque.latido.muestras} latidos); ` +
    `CPU por tipo de proceso en ${arranque.segundos} s (1 = un núcleo entero): ` + (Object.entries(arranque.cpuPorTipo).map(([k, v]) => `${k} ${v}`).join(', ') || arranque.fallo));
  // §158: los segundos de las peores trabas de la otra pestaña, con lo que pasaba en cada uno
  if (arranque?.peores) for (const f of arranque.peores) console.log(`  traba a los ${f.s} s: la otra pestaña ${f.peor} ms; CPU ` +
    (Object.entries(f.cpu).filter(([, v]) => v >= 0.05).map(([k, v]) => `${k} ${v}`).join(', ') || '?') + (f.largaJuego ? `; tarea larga del juego ${f.largaJuego} ms` : '') + (f.pip ? `; ${f.pip}` : ''));
  // §155 (H1): lo que dice el medidor de la página (incluye lo girado por el lastre, que la traza cuenta como espera)
  if (informe?.ultimos10s) console.log(`  medidor de la página, últimos 10 s: ${informe.ultimos10s.fps} fps, juego ${informe.ultimos10s.juegoMs} ms por cuadro` +
    (informe.ultimos10s.cpuPuraMs != null ? ` (CPU pura ${informe.ultimos10s.cpuPuraMs} ms, con el lastre)` : '') + `, tarjeta ${informe.ultimos10s.videoMs ?? '—'} ms`);
  // §161: el margen contra 60 (con tope, los fps no pasan de 60 y no dicen cuánto sobra): 16,7 ms ÷ CPU pura por cuadro;
  // y con ?sinTope=1 (banco sin tope) los cuadros de lógica por segundo = el techo de la CPU, las imágenes = el del dibujo
  // (§162: sin tope el juego dibuja menos imágenes que cuadros de lógica, y la CPU pura del medidor es POR IMAGEN: ahí el
  // margen va por cuadro de lógica = CPU pura × imágenes ÷ cuadros de lógica; dicho de otro modo, cuadros de lógica ÷ 60)
  const sinTope = /sinTope=1/.test(EXTRA), u10 = informe?.ultimos10s;
  const cpuLogica = sinTope && u10?.cpuPuraMs > 0 && u10?.logica > 0 && u10?.fps > 0 ? u10.cpuPuraMs * u10.fps / u10.logica : null;
  const cpuMargen = cpuLogica ?? u10?.cpuPuraMs;
  if (cpuMargen > 0) { const m = (1000 / 60) / cpuMargen;
    console.log(`  margen contra 60 (CPU pura${cpuLogica ? ` por cuadro de lógica, ${cpuLogica.toFixed(1)} ms` : ''}): ${m >= 1 ? `×${m.toFixed(2)} de sobra` : `le falta ×${(1 / m).toFixed(2)}`}`); }
  if (sinTope) console.log(`  sin tope (§161): ${u10?.logica ?? '—'} cuadros de lógica por segundo (= ×${u10?.logica ? (u10.logica / 60).toFixed(2) : '—'} contra 60), ${u10?.fps ?? '—'} imágenes por segundo`);
  if (informe?.lastre) console.log(`  lastre (§155): ${JSON.stringify(informe.lastre)}`);
  if (informe?.perfilTarjeta?.estado?.prendido) console.log(`  perfil de la tarjeta (marcas de la tarjeta, ?perfilGpu=1): ${informe.perfilTarjeta.msPorCuadro} ms de pasadas por cuadro; ` +
    `las más caras: ${(informe.perfilTarjeta.pasadasCaras || []).slice(0, 3).join(' · ')}${informe.perfilTarjeta.fallo ? ' · falla: ' + informe.perfilTarjeta.fallo : ''}`);
  if (informe?.presupuesto) { console.log('  presupuesto (§149):'); for (const l of informe.presupuesto) console.log('    ' + l); }
  if (pedidosWorker) console.log(`  pedidos al Worker: ${pedidosWorker.total} (hasta el primer cuadro ${pedidosWorker.hastaPrimerCuadro}, hasta la carrera ` +
    `${pedidosWorker.hastaCarrera}, en la carrera ${pedidosWorker.enCarrera}): ` + Object.entries(pedidosWorker.porTipo).sort((a, b) => b[1].n - a[1].n)
    .map(([k, v]) => `${k} ${v.n}${v.mb ? ` (${v.mb} MB)` : ''}`).join(', '));
  await cdp.detach();
  return r;
}
