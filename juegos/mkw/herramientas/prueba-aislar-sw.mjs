// W21 (etapa E4b del plan v4, bitácora §225): el marco del juego aislado por un service worker, en el sitio local.
//
// Resumen: levanta herramientas/sitio-local.mjs (el sitio servido COMO GitHub Pages: sin cabeceras COOP/COEP; lo privado
// desde el «Worker» de verdad en otro origen, con CORS y token) y abre Juegos con el marco del juego pidiendo
// ?aislar=sw (o --modo sw-corp). index.html registra web/navegador/sw-aislar.js, que agrega Document-Isolation-Policy
// a la página del juego, y recarga una vez. Puntos ✓/✗:
//   1. el marco queda aislado (crossOriginIsolated) y 2. tiene memoria compartida de verdad (un SharedArrayBuffer que un
//   Worker escribe con Atomics y el marco lee), 3. la página de Juegos NO cambia (sigue sin aislar, su #pantalla vive),
//   4. el token del Worker llega por mensaje y el juego baja lo privado (el disco y el programa, del otro origen), 5. el
//   juego llega a la carrera, 6. el sonido (AudioWorklet) arrancó, 7. el service worker no toca nada sin ?aislar (la
//   misma página sin el parámetro queda sin aislar) y, como inventario de lo que habría que pasar a mensajes,
//   8. el sitio ya no puede tocar el marco directo (SecurityError) — se espera que sea así: lo que hoy hace
//   colabtex/src/juegos/mkw.js con w.mkwConectarRecords/Nube/Vr tendría que ir por postMessage.
// Uso:  MKW_BUILD=build/web-e2w10/navegador node herramientas/prueba-aislar-sw.mjs [--ventana] [--modo sw|sw-corp] [--puerto 8160]
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8160));
const MODO = opcion('--modo', 'sw');
const puntos = [];
const punto = (bien, texto) => { puntos.push(bien); console.log(`${bien ? '✓' : '✗'} ${texto}`); };

const sitio = spawn(process.execPath, [path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO), '--latencia', '20'],
  { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
await new Promise((listo, mal) => { sitio.stdout.on('data', d => { if (/8\d{3}/.test(String(d))) listo(); }); sitio.on('exit', c => mal(new Error('sitio-local salió ' + c))); setTimeout(listo, 4000); });
const perfil = mkdtempSync(path.join(os.tmpdir(), 'mkw-aislar-'));
const contexto = await chromium.launchPersistentContext(perfil, {
  channel: 'chrome', headless: !args.includes('--ventana'), viewport: { width: 1280, height: 720 },
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required',
    ...(args.includes('--ventana') ? [`--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] : [])],
});
const pagina = contexto.pages()[0] || await contexto.newPage();
const consola = [];
pagina.on('console', m => consola.push(m.text()));
let codigo = 1;
try {
  const extra = `1&aislar=${MODO}&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&n8=0&cortina=0`;
  await pagina.goto(`http://127.0.0.1:${PUERTO}/juegos.html?mkw=${encodeURIComponent(extra)}`);
  const marco = async () => { for (let i = 0; i < 600; i++) { const f = pagina.frames().find(x => x.url().includes('/juegos/mkw/web/navegador/index.html')); if (f) return f; await pagina.waitForTimeout(100); } return null; };
  let juego = await marco();
  if (!juego) throw new Error('no apareció el marco del juego');
  // esperar la recarga del service worker: el marco aislado
  let aislado = false;
  for (let i = 0; i < 300 && !aislado; i++) { aislado = await juego.evaluate(() => self.crossOriginIsolated === true).catch(() => false); if (!aislado) await pagina.waitForTimeout(100); }
  punto(aislado, `el marco del juego queda aislado (crossOriginIsolated) con ?aislar=${MODO}`);
  const compartida = await juego.evaluate(async () => {
    try {
      const sab = new SharedArrayBuffer(8), v = new Int32Array(sab);
      const w = new Worker(URL.createObjectURL(new Blob(['onmessage = e => { const v = new Int32Array(e.data); Atomics.store(v, 0, 42); Atomics.notify(v, 0); postMessage(1); }'], { type: 'text/javascript' })));
      w.postMessage(sab);
      await new Promise(r => { w.onmessage = r; setTimeout(r, 3000); });
      w.terminate();
      return Atomics.load(v, 0) === 42 && typeof WebAssembly.Memory === 'function' && !!new WebAssembly.Memory({ initial: 1, maximum: 2, shared: true });
    } catch (x) { return String(x); }
  }).catch(x => String(x));
  punto(compartida === true, `memoria compartida de verdad en el marco (un Worker escribe con Atomics; memoria de wasm compartida)${compartida === true ? '' : ': ' + compartida}`);
  const afuera = await pagina.evaluate(() => ({ aislada: self.crossOriginIsolated === true, pantalla: !!document.getElementById('pantalla')?.children.length }));
  punto(!afuera.aislada && afuera.pantalla, `la página de Juegos no cambia: sin aislar (${afuera.aislada}) y su #pantalla con el marco (${afuera.pantalla})`);
  // el juego: lo privado del otro origen y la carrera
  let estado = null, vioCarrera = false;     // (si la vio en algún momento: al terminar la carrera enCarrera vuelve a false)
  for (let i = 0; i < 2400; i++) {
    estado = await juego.evaluate(() => ({ carrera: !!window.mkwEstado?.enCarrera,
      cuadros: window.mkw?._mkw_web_cuadros?.() ?? 0, error: window.mkwEstado?.error ?? null })).catch(() => null);
    if (estado?.carrera) vioCarrera = true;
    if (vioCarrera && estado?.cuadros > 300) break;
    await pagina.waitForTimeout(100);
  }
  const bajo = consola.some(l => /token|privado/i.test(l)) || (estado?.cuadros > 0);
  punto(!!estado && estado.cuadros > 0 && bajo, `el token llega por mensaje y el juego baja lo privado del otro origen y arranca (imágenes ${estado?.cuadros ?? '—'})`);
  punto(vioCarrera, `el juego llega a la carrera dentro del marco aislado`);
  const sonido = await juego.evaluate(() => ({ ctx: window.mkwSonido?.estado?.contexto ?? window.mkwSonido?.contexto?.state ?? null, worklet: !!window.mkwSonido?.estado })).catch(() => null);
  punto(!!sonido?.worklet, `el sonido arrancó (${JSON.stringify(sonido)})`);
  const directo = await pagina.evaluate(() => { try { return typeof window.mkwMarco.contentWindow.mkwEstado; } catch (x) { return 'SecurityError: ' + x.name; } });
  const arriba = await juego.evaluate(() => { try { return typeof parent.document; } catch (x) { return 'SecurityError: ' + x.name; } }).catch(x => String(x));
  punto(/SecurityError/.test(directo) && /SecurityError/.test(arriba), `el sitio y el marco ya no se tocan directo (sitio → marco: ${directo}; marco → sitio: ${arriba}): lo de mkw.js del sitio tendría que ir por mensajes`);
  // sin el parámetro: la misma página, sin aislar (el service worker sigue registrado pero pasa de largo)
  const p2 = await contexto.newPage();
  await p2.goto(`http://127.0.0.1:${PUERTO}/juegos/mkw/web/navegador/index.html?privado=http://127.0.0.1:${PUERTO + 1}/mkw&portada=1`);
  await p2.waitForTimeout(1500);
  const sinParam = await p2.evaluate(() => ({ aislada: self.crossOriginIsolated === true, controlada: !!navigator.serviceWorker?.controller }));
  punto(!sinParam.aislada && sinParam.controlada, `sin ?aislar la página queda como siempre (aislada ${sinParam.aislada}, el service worker la ve ${sinParam.controlada} y pasa de largo)`);
  await p2.close();
  const bien = puntos.filter(Boolean).length;
  console.log(`\n${bien}/${puntos.length} puntos`);
  const errores = consola.filter(l => /error|Error/.test(l)).slice(0, 8);
  if (errores.length) console.log('consola (errores):\n  ' + errores.join('\n  '));
  codigo = bien === puntos.length ? 0 : 1;
} catch (x) { console.log('✗ ' + (x?.stack || x)); }
await contexto.close().catch(() => {});
sitio.kill();
try { rmSync(perfil, { recursive: true, force: true }); } catch {}
process.exit(codigo);
