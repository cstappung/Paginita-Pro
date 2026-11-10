// Paso 8 (N3/P10, bitácora §186): la prueba de la puerta A. Corre el juego en trabajador.html con el arnés en un
// Worker (?hilo=trabajador) y en el hilo de la página (?hilo=principal), intercalados en la misma tanda (§166: la carga
// de fondo del PC cambia con la hora), con la carrera directa de 12 CPU y semilla fija, y compara:
//   - el tramo fijo de §163 (cuadros de lógica por segundo, CPU por cuadro) de cada lado;
//   - la huella de la carrera cuadro por cuadro (?huellas=A-B): los cuadros que vieron los dos tienen que dar lo mismo.
// Uso:
//   node herramientas/medir-trabajador.mjs [--repetir 2] [--lastre 3.5] [--extra "&…"] [--hilos trabajador,principal]
//        [--etiqueta X] [--puerto 8160] [--sin-ventana] [--segundos 300] [--huellas 1-3000] [--sin-tope] [--chrome "…"]
// Siempre sin sonido (--mute-audio, pedido del dueño) y la ventana en el monitor de 144 Hz (MKW_VENTANA, §160).
// Va con el candado de medición (herramientas/candado.sh) desde la tanda que la llame. Resultado:
// build/web/datos/trabajador/<etiqueta>/resumen.json (sin nada del juego: números y huellas).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const tiene = n => process.argv.includes('--' + n);
const PUERTO = Number(arg('puerto', 8160));
const REPETIR = Number(arg('repetir', 1));
const HILOS = arg('hilos', 'trabajador,principal').split(',');
const ETIQUETA = arg('etiqueta', 'prueba');
const SEGUNDOS = Number(arg('segundos', 300));
const LASTRE = arg('lastre', '');
const SIN_TOPE = !tiene('con-tope');
const HUELLAS = arg('huellas', SIN_TOPE ? '' : '1-4000');
const BUILD = process.env.MKW_BUILD || 'build/web-m1/navegador';
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const BASE = '?modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo' + (SIN_TOPE ? '&sinTope=1&tramo=600-2400' : '') +
  (LASTRE ? `&lastre=${LASTRE}` : '') + (HUELLAS ? `&huellas=${HUELLAS}` : '') + arg('extra', '');
const salida = path.join(raiz, 'build/web/datos/trabajador', ETIQUETA);
mkdirSync(salida, { recursive: true });

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { cwd: raiz, env: { ...process.env, MKW_BUILD: BUILD }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => servidor.stdout.on('data', d => { if (/escuchando|http:\/\//i.test(String(d))) r(); }));
const perfil = path.join(raiz, 'build/web/datos/trabajador/perfil-' + PUERTO);
rmSync(perfil, { recursive: true, force: true });

async function una(hilo, n) {
  const ctx = await chromium.launchPersistentContext(perfil, { channel: 'chrome', headless: tiene('sin-ventana'), viewport: null,
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`, '--window-size=1280,760',
           '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
           // (--chrome "…" = banderas de más, p. ej. la revisión de límites de Android, W5: --js-flags=--wasm-enforce-bounds-checks)
           ...(arg('chrome', '') ? arg('chrome', '').split(' ') : [])] });
  const pag = ctx.pages()[0] || await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  const t0 = Date.now();
  await pag.goto(`http://127.0.0.1:${PUERTO}/trabajador.html${BASE}&hilo=${hilo}`);
  let e = null;
  while (Date.now() - t0 < SEGUNDOS * 1000) {
    await pag.waitForTimeout(1000);
    e = await pag.evaluate(() => { const x = window.mkwEstado || {}; return { fase: x.fase, error: x.error, logica: x.logica, cuadros: x.cuadros, carrera: x.carrera,
      tramo: x.tramo, huellas: x.huellas, donde: x.donde, programaMs: x.programaMs, lecturas: x.lecturas, msEsperaDisco: x.msEsperaDisco, sonido: x.sonido, jspi: x.jspi, webgpu: x.webgpu }; }).catch(() => null);
    if (!e) continue;
    if (e.error) break;
    const huellaLista = !HUELLAS || (e.logica != null && e.logica >= Number(HUELLAS.split('-')[1]));
    if ((!SIN_TOPE || e.tramo?.resultado) && huellaLista) break;
  }
  const eco = hilo === 'trabajador' ? await pag.evaluate(() => window.mkwEco?.(200)).catch(() => null) : null;
  const registro = await pag.evaluate(() => (window.mkwRegistro || globalThis.mkwEstado?.log || []).slice(-60)).catch(() => []);
  await pag.screenshot({ path: path.join(salida, `foto-${hilo}-${n}.png`) }).catch(() => {});
  await ctx.close();
  return { hilo, n, segundos: Math.round((Date.now() - t0) / 1000), ...e, eco, errores: errores.slice(0, 10), registro };
}

// Calentar: una corrida que llena la caché del disco y la de código (no cuenta)
const corridas = [];
if (!tiene('sin-calentar')) { const c = await una(HILOS[0], 0); console.log(`calentar (${c.hilo}): fase ${c.fase} lógica ${c.logica} ${c.error || ''}`); }
for (let n = 1; n <= REPETIR; n++) for (const hilo of (n % 2 ? HILOS : [...HILOS].reverse())) {
  const c = await una(hilo, n);
  corridas.push(c);
  const r = c.tramo?.resultado;
  console.log(`${hilo} #${n}: ${c.fase}${c.error ? ' ERROR ' + c.error.split('\n')[0] : ''} · lógica ${c.logica} · ` +
    (r ? `tramo ${r.logicaPorSeg} lógica/s, ${r.imagenesPorSeg} img/s, trabajo ${r.porCuadro.trabajo} ms, giro ${r.porCuadro.giro} ms, techo CPU ${r.cpuPorSeg}/s` : 'sin tramo') +
    (c.huellas ? ` · ${c.huellas.length} huellas` : '') + (c.eco ? ` · eco ${c.eco.mediana.toFixed(3)} ms (p95 ${c.eco.p95.toFixed(3)})` : ''));
}

// Las huellas: en los cuadros que vieron dos corridas, ¿lo mismo?
const comparacion = [];
for (let i = 0; i < corridas.length; i++) for (let j = i + 1; j < corridas.length; j++) {
  const a = new Map((corridas[i].huellas || []).map(([c, h, p]) => [c, h + '|' + p])), b = corridas[j].huellas || [];
  let comunes = 0, distintas = 0, primera = null;
  for (const [c, h, p] of b) if (a.has(c)) { comunes++; if (a.get(c) !== h + '|' + p) { distintas++; primera ??= c; } }
  comparacion.push({ a: `${corridas[i].hilo}#${corridas[i].n}`, b: `${corridas[j].hilo}#${corridas[j].n}`, comunes, distintas, primera });
  if (HUELLAS) console.log(`huellas ${corridas[i].hilo}#${corridas[i].n} vs ${corridas[j].hilo}#${corridas[j].n}: ${comunes} cuadros en común, ${distintas} distintos${primera != null ? ' (el primero: ' + primera + ')' : ''}`);
}
const media = (hilo, f) => { const v = corridas.filter(c => c.hilo === hilo && c.tramo?.resultado).map(c => f(c.tramo.resultado)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const resumen = { etiqueta: ETIQUETA, base: BASE, build: BUILD, fecha: new Date().toISOString(),
  medias: Object.fromEntries(HILOS.map(h => [h, { logicaPorSeg: media(h, r => r.logicaPorSeg), trabajo: media(h, r => r.porCuadro.trabajo), cpuPorSeg: media(h, r => r.cpuPorSeg) }])),
  comparacion, corridas: corridas.map(c => ({ ...c, huellas: c.huellas ? c.huellas.length : 0 })) };
writeFileSync(path.join(salida, 'resumen.json'), JSON.stringify(resumen, null, 1));
writeFileSync(path.join(salida, 'huellas.json'), JSON.stringify(corridas.map(c => ({ hilo: c.hilo, n: c.n, huellas: c.huellas || [] }))));
console.log('medias:', JSON.stringify(resumen.medias));
servidor.kill();
rmSync(perfil, { recursive: true, force: true });
process.exit(0);
