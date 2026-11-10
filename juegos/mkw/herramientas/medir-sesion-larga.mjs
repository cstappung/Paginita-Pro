// V6 (plan v4, etapa E6, bitácora §234): una sesión larga de sala, con la memoria y la CPU de cada minuto.
//
// Resumen: varias cosas de la página pueden crecer sin tope en una sala larga (tablas del lockstep, el registro, la
// lista de pipelines, cachés) y nadie lo había medido más de una copa. Esto abre dos pestañas del juego como dos PC de
// la misma sala (modo=sala, el buzón falso del banco, en un Chrome propio para poder leer la memoria de sus procesos),
// la anfitriona arma una lista de --pistas carreras (por omisión 20, ~1 hora: cada carrera ~3 min con los humanos
// quietos —las CPU llegan y 30 s después el DNF termina la carrera— y 5 s de descanso), y cada minuto anota:
//   - la memoria privada de cada pestaña y del proceso de la tarjeta (Win32_Process, como medir-memoria.mjs);
//   - dentro de cada página: el heap de wasm usado (_sbrk), el heap de JS (performance.memory), el registro (líneas),
//     la memoria de bloques del disco;
//   - los cuadros por segundo, los ms de trabajo del juego por cuadro y en qué carrera va la sala.
//   - las limpiezas de V8 entre dos muestras consecutivas, separadas por proceso de juego.
// Al final: la pendiente de la memoria (MB por hora, del minuto 10 al final, por mínimos cuadrados) y la CPU por cuadro
// de los primeros 10 min contra los últimos 10. «Plana» = cada proceso de juego y de vídeo crece menos de
// 30 MB por hora. «CPU estable» = la mediana final crece como mucho 10 %. Son umbrales de esta prueba.
// Con --telefono, B es el teléfono de gama media simulado (H1: el aparato de mentira, ?comoTelefono=1) y con --pistas 4
// es «una copa entera en el teléfono».
// Uso:  node herramientas/medir-sesion-larga.mjs [--pistas 20] [--telefono] [--etiqueta X] [--puerto 8174] [--extra "&…"]
//       (MKW_BUILD = otro build; la ventana en MKW_VENTANA) → build/web/datos/sesion-larga/<etiqueta>.json
import { spawn, execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PISTAS = Math.max(1, Math.min(32, Number(opcion('--pistas', 20))));
const TELEFONO = args.includes('--telefono');
const MINUTOS = Number(opcion('--minutos', TELEFONO ? 0 : 60)); // Una hora se verifica por reloj.
const ETIQUETA = opcion('--etiqueta', TELEFONO ? `telefono-${PISTAS}` : `pc-${PISTAS}`);
const PUERTO = Number(opcion('--puerto', 8174));
const EXTRA = opcion('--extra', '');
const GAMA_MEDIA = '&lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6&comoTelefono=1';
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const carpeta = path.join(raiz, 'build/web/datos/sesion-larga');
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
const MB = b => Math.round(b / 1048576);
const t0 = Date.now();
const min = () => (Date.now() - t0) / 60000;

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-sesion-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, `--window-position=${vx},${vy}`,
  '--window-size=1400,800', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio',
  '--enable-precise-memory-info', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--js-flags=--wasm-enforce-bounds-checks', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
try {
const ctx = navegador.contexts()[0];

// memoria privada de los chrome.exe de este perfil, por tipo de proceso (MB)
const procesos = () => new Promise(res => {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(dir)}*' } | ` +
    `ForEach-Object { $t = 'navegador'; if ($_.CommandLine -match '--type=([a-z-]+)') { $t = $matches[1] }; "{0}|{1}" -f $t, $_.PrivatePageCount }`;
  execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true }, (e, salida) => {
    const pestañas = []; let tarjeta = 0, total = 0;
    for (const l of String(salida || '').split(/\r?\n/)) {
      const [t, n] = l.trim().split('|'); if (!n) continue;
      total += Number(n);
      if (t === 'renderer') pestañas.push(MB(Number(n))); else if (t === 'gpu-process') tarjeta += Number(n);
    }
    res({ pestañas: pestañas.sort((a, b) => b - a), tarjeta: MB(tarjeta), total: MB(total) });
  });
});
const dentro = (p, marca) => Promise.race([new Promise(r => setTimeout(() => r(null), 10000)), p.evaluate(marca => {
  // El reloj de la marca es el mismo que el de las limpiezas en la traza de Chrome.
  performance.mark(marca);
  performance.clearMarks(marca);
  const M = window.mkw, e = window.mkwEstado || {}, s = window.mkwSala?.estado?.();
  const ls = window.mkwSincro?.lockstep?.estado?.();
  return { usado: M?._sbrk ? Math.round((M._sbrk(0) >>> 0) / 1048576) : null, heap: Math.round((M?.HEAPU8?.length || 0) / 1048576),
           js: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
           bloques: window.mkwDisco?.estado?.memoriaMB?.() ?? null, log: (e.log || []).length,
           fps: e.fps ?? null, trabajo: e.trabajo ?? null, enCarrera: !!e.enCarrera, fase: s?.fase ?? null, carrera: s?.carrera ?? null,
           carreras: s?.carreras ?? null, lsCuadros: ls?.cuadros ?? null,
           sincro: ls && { cuadro: ls.cuadro, esperando: ls.esperando, autoridad: ls.autoridad, cortes: ls.cortes,
             fuera: ls.fuera, salidas: ls.salidas, desincronizado: ls.desincronizado },
           ultimosMensajes: e.fps === 0 ? (e.log || []).slice(-20) : undefined,
           ultimaRed: e.fps === 0 ? window.mkwRed?.registro?.slice(-20) : undefined,
           sonido: { activo: !!window.mkwSonido?.estado.activo, entregas: window.mkwSonido?.estado.entregas ?? 0,
             descartadas: window.mkwSonido?.estado.descartadas ?? 0, reciclado: window.mkwSonido?.estado.reciclado ?? null } };
}, marca)]).catch(() => null);

const sala = 'larga-' + Date.now().toString(36), uidA = 'a' + sala, uidB = 'b' + sala;
const abrir = async (uid, extra) => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 640, height: 360 });
  if (extra.includes('comoTelefono=1')) {
    // Emulación por página: mantiene el mismo perfil/buzón y activa pantalla y puntero de teléfono.
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  p.on('pageerror', e => caidas.push(`[${uid.slice(0, 1)}] ${e.message}`));
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}` +
    `&semilla=777&modo=sala&estilo=copa&carreras=${PISTAS}&cc=c150&cpu=normal&descanso=5&copaReloj=0&n8=0${extra}${EXTRA}`);
  // Silenciar Chrome no debe suspender el procesamiento de audio. Control no está asignado a un mando.
  await p.waitForFunction(() => !!window.mkwSonido?.contexto, null, { timeout: 90000 });
  await Promise.race([p.keyboard.press('Control'), espera(10000).then(() => { throw new Error('El gesto de audio no responde'); })]);
  await p.waitForFunction(() => window.mkwSonido?.estado.activo, null, { timeout: 10000 });
  return p;
};
const caidas = [];
const A = await abrir(uidA, '');
await espera(2000);
const B = await abrir(uidB, TELEFONO ? GAMA_MEDIA : '');
// la anfitriona arma la lista cuando la sala está lista (lo que hace el selector de la página al confirmar)
const lista = Array.from({ length: PISTAS }, (_, k) => ({ copa: k % 8, fila: Math.floor(k / 8) % 4 }));
for (let k = 0; k < 240; k++) {
  const r = await A.evaluate(l => window.mkwSala?.lista ? window.mkwSala.ponerPistas(l) : false, lista).catch(() => false);
  if (r) { console.log(`la anfitriona armó ${PISTAS} pistas a los ${min().toFixed(1)} min`); break; }
  await espera(1000);
}
const muestras = [];
const traza = await navegador.newBrowserCDPSession();
const eventos = [];
traza.on('Tracing.dataCollected', ({ value }) => {
  // Guardar solo los cortes de minuto y los números de GC. El resto de la traza no se escribe al disco.
  for (const { name, ph, pid, ts, dur } of value) {
    if (name?.startsWith('e6-v6-') || (ph === 'X' && ['MinorGC', 'MinorGC_Incremental', 'MajorGC'].includes(name))) {
      eventos.push({ name, pid, ts, dur });
    }
  }
});
await traza.send('Tracing.start', { traceConfig: { includedCategories: ['v8', 'blink.user_timing'], enableArgumentFilter: true } });
let ultimo = null;
let sinRespuesta = 0;
let inmovil = 0;
for (;;) {
  const i = muestras.length;
  const [pr, a, b] = await Promise.all([procesos(), dentro(A, `e6-v6-A-${i}`), dentro(B, `e6-v6-B-${i}`)]);
  const m = { min: Math.round(min() * 10) / 10, procesos: pr, A: a, B: b };
  muestras.push(m);
  // Tres minutos sin lector vivo indican instrumento/juego bloqueado, no memoria plana.
  sinRespuesta = !a || !b ? sinRespuesta + 1 : 0;
  const anterior = muestras.at(-2);
  const sinAvance = a?.fase === 'correr' && b?.fase === 'correr' && a.fps === 0 && b.fps === 0 &&
    a.lsCuadros === anterior?.A?.lsCuadros && b.lsCuadros === anterior?.B?.lsCuadros;
  inmovil = sinAvance ? inmovil + 1 : 0;
  console.log(`${m.min.toFixed(1)} min · carrera ${a?.carrera}/${a?.carreras} ${a?.fase} · pestañas ${pr.pestañas.join('+')} MB, tarjeta ${pr.tarjeta} · ` +
    `A: wasm ${a?.usado} js ${a?.js} log ${a?.log} ${a?.fps?.toFixed?.(0)} fps ${a?.trabajo?.toFixed?.(1)} ms · B: wasm ${b?.usado} js ${b?.js} ${b?.fps?.toFixed?.(0)} fps ${b?.trabajo?.toFixed?.(1)} ms`);
  writeFileSync(path.join(carpeta, `${ETIQUETA}.json`), JSON.stringify({ pistas: PISTAS, telefono: TELEFONO, muestras, caidas }, null, 1));
  if (sinRespuesta >= 3) { caidas.push('Tres muestras consecutivas sin respuesta de una página'); break; }
  if (inmovil >= 2) { caidas.push('Dos minutos consecutivos sin avanzar en ninguna consola'); break; }
  if (a?.fase === 'fin' && b?.fase === 'fin') { if (ultimo === null) ultimo = Date.now(); else if (Date.now() - ultimo > 20000) break; }
  if (min() > PISTAS * 5 + 15) { console.log('tope de tiempo'); break; }
  await espera(60000 - ((Date.now() - t0) % 60000));
}
const trazaCompleta = new Promise(listo => traza.once('Tracing.tracingComplete', listo));
await traza.send('Tracing.end');
const { dataLossOccurred } = await trazaCompleta;
const marcas = new Map(eventos.filter(e => e.name.startsWith('e6-v6-')).map(e => [e.name, e]));
const limpiezas = eventos.filter(e => !e.name.startsWith('e6-v6-'));
for (let i = 1; i < muestras.length; i++) {
  muestras[i].gc = Object.fromEntries(['A', 'B'].map(juego => {
    const a = marcas.get(`e6-v6-${juego}-${i - 1}`), b = marcas.get(`e6-v6-${juego}-${i}`);
    if (dataLossOccurred || !a || !b || a.pid !== b.pid || b.ts <= a.ts) return [juego, null];
    const gc = limpiezas.filter(e => e.pid === a.pid && e.ts >= a.ts && e.ts < b.ts);
    return [juego, { segundos: (b.ts - a.ts) / 1e6, menores: gc.filter(e => e.name !== 'MajorGC').length,
      mayores: gc.filter(e => e.name === 'MajorGC').length, ms: gc.reduce((s, e) => s + (e.dur || 0), 0) / 1000 }];
  }));
}
// la pendiente (MB por hora) desde el minuto 10 hasta el final, por mínimos cuadrados
const pendiente = (f) => {
  const pts = muestras.filter(m => m.min >= Math.min(10, muestras.at(-1).min / 3)).map(m => [m.min, f(m)]).filter(([, y]) => Number.isFinite(y));
  if (pts.length < 3) return null;
  const n = pts.length, sx = pts.reduce((s, [x]) => s + x, 0), sy = pts.reduce((s, [, y]) => s + y, 0);
  const sxx = pts.reduce((s, [x]) => s + x * x, 0), sxy = pts.reduce((s, [x, y]) => s + x * y, 0);
  return Math.round(((n * sxy - sx * sy) / (n * sxx - sx * sx)) * 60 * 10) / 10;
};
const mediana = v => { const o = v.filter(Number.isFinite).sort((a, b) => a - b); return o.length ? o[o.length >> 1] : null; };
const trabajoEn = (q, desde, hasta) => mediana(muestras.filter(m => m.min >= desde && m.min < hasta && m[q]?.enCarrera).map(m => m[q].trabajo));
const fin = muestras.at(-1).min;
const r = {
  minutos: fin, carreras: muestras.at(-1).A?.carrera,
  // Los dos procesos más grandes son los juegos; el último suele ser un marco auxiliar de pocos MB.
  pendienteMBporHora: { pestañaMayor: pendiente(m => m.procesos.pestañas[0]), pestañaMenor: pendiente(m => m.procesos.pestañas[1]),
    tarjeta: pendiente(m => m.procesos.tarjeta), wasmA: pendiente(m => m.A?.usado), wasmB: pendiente(m => m.B?.usado), jsA: pendiente(m => m.A?.js), jsB: pendiente(m => m.B?.js) },
  trabajoMs: { A: [trabajoEn('A', 0, 10), trabajoEn('A', fin - 10, fin + 1)], B: [trabajoEn('B', 0, 10), trabajoEn('B', fin - 10, fin + 1)] },
  trazaGcCompleta: !dataLossOccurred && muestras.length > 1 && muestras.slice(1).every(m => m.gc.A && m.gc.B),
  caidas,
};
console.log(JSON.stringify(r, null, 1));
const completa = fin >= MINUTOS && muestras.at(-1).A?.fase === 'fin' && muestras.at(-1).B?.fase === 'fin';
const participacion = !muestras.some(m => [m.A, m.B].some(p => p?.sincro?.fuera || p?.sincro?.salidas > 0 || p?.sincro?.desincronizado));
const memoriaMedida = muestras.every(m => m.procesos.pestañas.length >= 2 && m.procesos.tarjeta > 0);
const plana = memoriaMedida && ['pestañaMayor', 'pestañaMenor', 'tarjeta'].every(k => Number.isFinite(r.pendienteMBporHora[k]) && r.pendienteMBporHora[k] < 30);
const cpuEstable = Object.values(r.trabajoMs).every(([inicio, final]) => inicio > 0 && final > 0 && final <= inicio * 1.1);
console.log(`${completa ? '✓' : '✗'} sesión completa: ${fin} min, mínimo ${MINUTOS}, copa terminada en ambas páginas`);
console.log(`${participacion ? '✓' : '✗'} ambas consolas siguieron dentro de la carrera compartida`);
console.log(`${plana ? '✓' : '✗'} la memoria plana (cada proceso crece menos de 30 MB por hora)`);
console.log(`${cpuEstable ? '✓' : '✗'} CPU por cuadro estable (mediana final hasta 10 % sobre la inicial)`);
console.log(`${r.trazaGcCompleta ? '✓' : '✗'} limpiezas por minuto en las dos páginas`);
console.log(`${caidas.length ? '✗' : '✓'} ninguna página se cayó`);
writeFileSync(path.join(carpeta, `${ETIQUETA}.json`), JSON.stringify({ pistas: PISTAS, telefono: TELEFONO, resultado: r, muestras, caidas }, null, 1));
process.exitCode = completa && participacion && plana && cpuEstable && r.trazaGcCompleta && !caidas.length ? 0 : 1;
} finally {
  // También limpiar si una comprobación falla antes de la primera muestra.
  await Promise.race([navegador?.close().catch(() => {}), espera(10000)]);
  chrome.kill(); servidor.kill();
}
