// Por qué la pantalla de elegir personaje va más lenta que la carrera (bitácora §270, el dueño: «no es posible ni
// aceptable que seleccionando personaje vaya a tan bajos fps tipo 25 si en el juego va a mejor fps»).
// Abre, una detrás de la otra, en páginas nuevas:
//   - «personaje»: ?modo=directa&elegir=1 (la pantalla de personaje del juego, sin la sala) y se queda mirando;
//   - «sala-personaje»: una sala de un humano en su pantalla de personaje (con lo de la página: sala, cortina…);
//   - «carrera»: ?modo=directa (12 CPU), la carrera andando.
// En cada una, 15 s: imágenes por segundo, CPU del juego por cuadro, la tarjeta por cuadro (sus marcas de tiempo,
// ?perfilGpu=1: la mediana del tramo de cada cuadro), pasadas/dibujos/copias/KB por cuadro (?gpu=1, ?ventanaGpu=0), los
// pipelines nuevos y las 8 pasadas más caras. Así se ve si lo caro es la CPU o la tarjeta, y qué pasada.
// Uso:  node herramientas/medir-personaje.mjs [--ventana] [--chrome "…"] [--lugares personaje,sala-personaje,carrera] ["&param=…"]
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : d; };
const VENTANA = args.includes('--ventana'); if (VENTANA) args.splice(args.indexOf('--ventana'), 1);
const PUERTO = Number(opcion('--puerto', 8188));
const CHROME = opcion('--chrome', '');
const LUGARES = opcion('--lugares', 'personaje,sala-personaje,carrera').split(',');
const PERFIL = args.includes('--perfil'); if (PERFIL) args.splice(args.indexOf('--perfil'), 1);   // §273: perfil de CPU de la página 10 s
const EXTRA = args.join('');
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !VENTANA,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-dawn-features=timestamp_quantization',
    ...(VENTANA ? [`--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] : []), ...(CHROME ? CHROME.split(' ') : [])] });

const PROBAR = '&gpu=1&perfilGpu=1&ventanaGpu=0&verDetalle=1';
for (const lugar of LUGARES) {
  const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
  const p = await contexto.newPage();
  const uid = 'p' + Date.now().toString(36);
  const url = {
    personaje: `/?auto=1&modo=directa&elegir=1&pista=0.0&semilla=1234&cpu=maximo`,
    'sala-personaje': `/?auto=1&red=malla&senal=canal&sala=s${uid}&uid=${uid}&sincro=${uid}&jefe=${uid}&semilla=777&modo=sala&estilo=copa&carreras=2&cc=c150&cpu=maximo&copaReloj=200`,
    carrera: `/?auto=1&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&autoconducir=1`,
  }[lugar];
  await p.goto(`http://127.0.0.1:${PUERTO}${url}${PROBAR}${EXTRA}`);
  // esperar el lugar: la pantalla de personaje (página 0x6B) sin la cortina, o la carrera andando (etapa 2)
  const listo = await p.waitForFunction(l => {
    const L = window.mkwMenus, e = L?.estado?.(); if (!e || !document.body.classList.contains('sin-cortina')) return false;
    if (l === 'carrera') { const ri = L.u32(0x809BD730); return !!ri && L.u32(ri + 0x28) === 2; }
    if (l === 'sala-personaje' && document.getElementById('elegirPista')) window.mkwSala?.ponerPistas?.([{ copa: 0, fila: 0 }, { copa: 0, fila: 1 }]);
    return e.pagina === 0x6B && !document.getElementById('elegirPista');
  }, lugar, { timeout: 240000, polling: 500 }).then(() => true, () => false);
  if (!listo) { console.log(`${lugar}: no llegó`); await contexto.close(); continue; }
  await espera(5000);
  // 15 s midiendo: la tarjeta con sus marcas (desde ahora) y los renglones por segundo del historial
  await p.evaluate(() => window.mkwPerfilGpu?.medirTiempos(true));
  // §273: qué hace la página en los cuadros largos (Long Animation Frames: cada guion que corrió, de qué archivo y
  // función, y cuánto) y los pipelines que armó aurora en el tramo
  await p.evaluate(() => {
    const t = window.__loaf = { cuadros: 0, ms: 0, guiones: {} };
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) { t.cuadros++; t.ms += e.duration;
      for (const g of e.scripts || []) { const k = `${(g.sourceURL || '?').split('/').pop().split('?')[0]}:${g.sourceFunctionName || '?'} ← ${g.invoker || '?'}`;
        const x = t.guiones[k] ||= { veces: 0, ms: 0 }; x.veces++; x.ms += g.duration; } } }).observe({ type: 'long-animation-frame' }); } catch {}
    window.__pipLog0 = (window.mkwEstado.log || []).length;
  });
  const desde = await p.evaluate(() => (window.mkwEstado.historial || []).length);
  // §273 (--perfil): el perfil de la CPU de la pestaña durante 10 s del tramo, agrupado por archivo (el wasm del juego,
  // cada módulo de la página) y las funciones de la página que más tiempo propio tuvieron
  let perfil = null;
  if (PERFIL) {
    const cdp = await contexto.newCDPSession(p);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    await espera(10000);
    const { profile } = await cdp.send('Profiler.stop');
    const porId = new Map(profile.nodes.map(n => [n.id, n])), cuenta = new Map();
    for (const id of profile.samples) cuenta.set(id, (cuenta.get(id) || 0) + 1);
    const total = profile.samples.length, porArchivo = {}, porFuncion = {};
    for (const [id, c] of cuenta) {
      const f = porId.get(id).callFrame, archivo = (f.url || '').split('/').pop().split('?')[0] || `(${f.functionName || 'program'})`;
      porArchivo[archivo] = (porArchivo[archivo] || 0) + c;
      if (/\.m?js$/.test(archivo)) { const k = `${archivo}:${f.functionName || '(anónima)'}:${f.lineNumber + 1}`; porFuncion[k] = (porFuncion[k] || 0) + c; }
    }
    const pct = c => Math.round(c / total * 1000) / 10;
    perfil = { archivos: Object.entries(porArchivo).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, c]) => `${k} ${pct(c)} %`),
               funciones: Object.entries(porFuncion).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, c]) => `${k} ${pct(c)} %`) };
    await espera(5000);
  } else await espera(15000);
  const r = await p.evaluate(d => {
    const h = (window.mkwEstado.historial || []).slice(-15);
    const pg = window.mkwPerfilGpu;
    return { h, tramo: pg?.tramo?.() ?? null, caras: (pg?.tiempos?.() || []).slice(0, 8), estado: window.mkwMenus.estado(),
             imagenes: window.mkwEstado.imagenes?.resumen(null, 900) ?? null,
             loaf: window.__loaf, pipLog: (window.mkwEstado.log || []).slice(window.__pipLog0).filter(l => /pipelines|precalentado/.test(l)).slice(-6),
             pausa: window.mkwEstado.pausaPrecalentado ?? null,
             juego: window.mkwRitmoJuego?.resumen?.(900) ?? null, n8: window.mkwEstado.n8?.() ?? null, total: window.mkwRitmoJuego?.total, juegoSeg: window.mkwEstado.juegoSeg };
  }, desde);
  const media = k => { const v = r.h.map(x => x[k]).filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const suma = k => r.h.map(x => x[k]).filter(Number.isFinite).reduce((a, b) => a + b, 0);
  console.log(`\n== ${lugar} (sección 0x${(r.estado.seccion >>> 0).toString(16)} página 0x${(r.estado.pagina >>> 0).toString(16)}): ` +
    `${media('fps')} cuadros/s · imágenes 1 % bajo ${r.imagenes?.bajo1?.toFixed(1)} · CPU del juego ${media('juego')} ms/cuadro${media('cpu') !== null ? ` (pura ${media('cpu')})` : ''} · ` +
    `tarjeta ${r.tramo ? JSON.stringify(r.tramo) : 'sin marcas'} · demora tarjeta ${media('video')} ms · pasadas ${media('pasadas')}, dibujos ${media('dibujos')}, ` +
    `copias ${media('copias')}, ${media('kb')} KB por cuadro · juego ${r.juego?.porSeg?.toFixed?.(1)}/s [seg ${r.juegoSeg?.toFixed?.(1)}, total ${r.total}] (1 % bajo ${r.juego?.bajo1?.toFixed?.(1)}) · n8 ${r.n8 ? JSON.stringify({ menus: r.n8.menus, saltadosMenus: r.n8.saltadosMenus }) : '—'} · pipelines nuevos ${suma('pip')} (${suma('pipMs')} ms) · disco ${suma('disco')} ms`);
  if (r.loaf) { console.log(`   cuadros largos (LoAF): ${r.loaf.cuadros}, ${Math.round(r.loaf.ms)} ms · pausa ${JSON.stringify(r.pausa)}`);
    for (const [k, x] of Object.entries(r.loaf.guiones).sort((a, b) => b[1].ms - a[1].ms).slice(0, 10)) console.log(`   guion ${k}: ${Math.round(x.ms)} ms × ${x.veces}`); }
  if (perfil) { console.log('   perfil por archivo: ' + perfil.archivos.join(' · ')); console.log('   perfil, la página: ' + perfil.funciones.join(' · ')); }
  for (const l of r.pipLog || []) console.log('   log ' + String(l).slice(0, 200));
  for (const c of r.caras) console.log(`   pasada ${c.tam}${c.etiqueta ? ' «' + c.etiqueta + '»' : ''}: ${c.ms} ms × ${c.veces}, ${c.dibujos} dibujos`);
  await contexto.close();
}
await navegador.close(); servidor.kill();
process.exit(0);
