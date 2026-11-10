// La memoria tras varias pistas distintas en la MISMA pestaña (W8 y W20 de la etapa 0 del plan v4, bitácora §203–§204).
//
// Resumen: en KartPad los pipelines compilados (las recetas con que la tarjeta dibuja cada material) nunca se sueltan y
// las texturas de copia de repuesto tampoco: la memoria crece con cada pista (+233 MB en 4 pistas). Una copa de la
// sala, o una hora de juego, es justo ese caso. Esta herramienta abre UNA pestaña con una carrera directa y, sin
// recargar, salta a la siguiente pista con la ficha del juego (window.mkwDirecto.carrera, como la sala entre carreras),
// N pistas distintas. Tras `--segundos` de cada carrera anota:
//   - la memoria privada de los procesos de Chrome de ese perfil (la pestaña, la tarjeta de video, el navegador, otros);
//   - dentro de la página: el heap del programa, lo usado (sbrk), el JS, los bloques del disco, los pipelines que
//     armó aurora (mkw_web_pipelines_cuantos) y la piscina de copias (W20, mkwEstado.piscina(), si el programa la trae).
// Al final: lo que creció de la pista 1 a la última (la meta de W8: menos de +50 MB tras 8 pistas, o explicado).
//
// Uso:  MKW_BUILD=build/web-w19/navegador node herramientas/medir-memoria-pistas.mjs [--pistas 0.0,0.2,…]
//         [--segundos 20] [--puerto 8182] [--extra "&piscina=1"] [--etiqueta X]
//       → build/web/datos/memoria-pistas/<etiqueta>.json
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8182)), SEG = Number(arg('segundos', 20)), EXTRA = arg('extra', '');
const ETIQUETA = arg('etiqueta', `medida-${Date.now()}`);
// 8 pistas distintas: 4 de Nintendo (copas 0–7) y 4 de Retro Rewind (copas 8 en adelante); copa.fila
const PISTAS = arg('pistas', '0.0,1.1,2.2,5.3,13.2,30.2,50.2,65.0').split(',');
const espera = ms => new Promise(r => setTimeout(r, ms));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const MB = b => Math.round(b / 1048576);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-memoria-pistas-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, `--window-position=${vx + 40},${vy + 40}`,
  '--window-size=1600,900', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio',
  '--enable-precise-memory-info', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
const ctx = navegador.contexts()[0];

// memoria privada de los chrome.exe de este perfil, por tipo de proceso (MB), como medir-memoria.mjs
const procesos = () => new Promise(res => {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(dir)}*' } | ` +
    `ForEach-Object { $t = 'navegador'; if ($_.CommandLine -match '--type=([a-z-]+)') { $t = $matches[1] }; "{0}|{1}" -f $t, $_.PrivatePageCount }`;
  execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true }, (e, salida) => {
    const por = {};
    for (const l of String(salida || '').split(/\r?\n/)) {
      const [t, n] = l.trim().split('|'); if (!n) continue;
      const tipo = t === 'gpu-process' ? 'tarjeta' : t === 'renderer' ? 'pestaña' : t === 'navegador' ? 'navegador' : 'otros';
      por[tipo] = (por[tipo] || 0) + Number(n);
    }
    const total = Object.values(por).reduce((s, x) => s + x, 0);
    res({ ...Object.fromEntries(Object.entries(por).map(([k, v]) => [k, MB(v)])), total: MB(total) });
  });
});

const dentro = p => p.evaluate(() => {
  const M = window.mkw;
  return { heap: Math.round((M?.HEAPU8?.length || 0) / 1048576), usado: M?._sbrk ? Math.round((M._sbrk(0) >>> 0) / 1048576) : null,
           js: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
           bloques: window.mkwDisco?.estado?.memoriaMB?.() ?? null, pipelines: M?._mkw_web_pipelines_cuantos?.() ?? null,
           piscina: window.mkwEstado?.piscina?.() ?? null,
           soltados: window.mkwEstado?.pipelinesSoltados?.() ?? null,   // §203 (W8): ?soltarPipelines=1
           wgsl: window.mkwEstado?.wgsl?.() ?? null,   // §248 (W26): sombreadores armados, textos WGSL distintos, reusados
           // §203 (W8): las texturas vivas de aurora y sus MB en la tarjeta (estimado), si el programa lo trae
           texturas: M?._mkw_web_texturas_dato ? { n: M._mkw_web_texturas_dato(0), mb: Math.round(M._mkw_web_texturas_dato(1)) } : null };
}).catch(e => ({ error: String(e) }));

// espera a que la carrera esté andando (sección 0x20 y Raceinfo en carrera); con `antes`, primero que se haya ido
async function esperarCarrera(p, salir) {
  if (salir) for (const hasta = Date.now() + 30000; Date.now() < hasta; await espera(250))
    if (!(await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => true))) break;
  for (const hasta = Date.now() + 240000; Date.now() < hasta; await espera(500)) {
    const x = await p.evaluate(() => { const e = window.mkwMenus?.estado?.(); return !!(e && e.seccion === 0x20 && window.mkwEstado?.enCarrera); }).catch(() => false);
    if (x) return true;
  }
  return false;
}

// §203 (W8): lo que costó cada pista en pipelines, de las líneas «[pipelines]» del registro de la página desde la medición
// anterior: armados en el momento (el juego esperó a compilarlos), sincrónicos, dibujos saltados (no estaban listos) y lo
// que aurora soltó al entrar (W8). Con ?soltarPipelines=2 las pistas que vuelven a armar sombreadores lo muestran aquí.
let lineasVistas = 0;
const costoPipelines = p => p.evaluate(desde => {
  const log = window.mkwEstado?.log || [], recortadas = window.mkwEstado?.logRecortado || 0;
  const r = { armados: 0, armadosMs: 0, sincronicos: 0, saltados: 0, soltadosAlEntrar: 0, total: log.length + recortadas };
  for (const l of log.slice(Math.max(0, desde - recortadas))) {
    let m = /(\d+) sincrónicos, (\d+) armados en el momento \(([\d.]+) ms\), (\d+) dibujos saltados/.exec(l);
    if (m) { r.sincronicos += +m[1]; r.armados += +m[2]; r.armadosMs += +m[3]; r.saltados += +m[4]; }
    m = /W8: al entrar a la pista \S+ se soltaron (\d+)/.exec(l);
    if (m) r.soltadosAlEntrar += +m[1];
  }
  r.armadosMs = Math.round(r.armadosMs * 10) / 10;
  return r;
}, lineasVistas).then(r => { lineasVistas = r.total; delete r.total; return r; }).catch(e => ({ error: String(e) }));

const filas = [];
const p = await ctx.newPage();
const [c0, f0] = PISTAS[0].split('.');
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTAS[0]}&cc=c150&cpu=maximo&semilla=11&soloCpu=1${EXTRA}${/[?&]n8=/.test(EXTRA) ? '' : '&n8=0'}`);
for (let i = 0; i < PISTAS.length; i++) {
  const pista = PISTAS[i];
  if (i > 0) {
    const [c, f] = pista.split('.').map(Number);
    // la siguiente pista con la ficha del juego, sin recargar (como la sala entre carreras)
    const r = await p.evaluate(async id => {
      const { armarFicha } = await import('./directo.mjs');
      return !!(await window.mkwDirecto.carrera(armarFicha({ pista: id, cc: 'c150', cpu: 'maximo', semilla: 11, carrera: 0, carreras: 1 }), { licencia: -1 }));
    }, 0x100 + 4 * c + f).catch(e => String(e));
    if (r !== true) console.log(`  (pista ${pista}: carrera() devolvió ${r})`);
  }
  const llego = await esperarCarrera(p, i > 0);
  if (!llego) { console.log(`✗ pista ${pista}: no llegó a la carrera`); break; }
  await espera(SEG * 1000);
  const fila = { pista, n: i + 1, procesos: await procesos(), pagina: await dentro(p), costo: await costoPipelines(p) };
  filas.push(fila);
  console.log(`pista ${pista} (${i + 1}): pestaña ${fila.procesos.pestaña} MB · tarjeta ${fila.procesos.tarjeta} MB · total ${fila.procesos.total} MB · ` +
              `heap usado ${fila.pagina.usado} MB · pipelines ${fila.pagina.pipelines} · piscina ${JSON.stringify(fila.pagina.piscina)}` +
              (fila.pagina.texturas ? ` · texturas ${fila.pagina.texturas.n} (${fila.pagina.texturas.mb} MB)` : '') +
              (fila.pagina.soltados != null ? ` · soltados ${fila.pagina.soltados}` : '') +
              (fila.pagina.wgsl ? ` · sombreadores ${fila.pagina.wgsl.armados}, textos WGSL ${fila.pagina.wgsl.textos}, reusados ${fila.pagina.wgsl.reusados}` : ''));
  const k = fila.costo;
  if (!k.error) console.log(`  costo: ${k.armados} armados en el momento (${k.armadosMs} ms), ${k.sincronicos} sincrónicos, ` +
                           `${k.saltados} dibujos saltados, ${k.soltadosAlEntrar} soltados al entrar`);
}
if (filas.length > 1) {
  const a = filas[0].procesos, b = filas.at(-1).procesos;
  console.log(`de la pista 1 a la ${filas.length}: pestaña ${b.pestaña - a.pestaña >= 0 ? '+' : ''}${b.pestaña - a.pestaña} MB, ` +
              `tarjeta ${b.tarjeta - a.tarjeta >= 0 ? '+' : ''}${b.tarjeta - a.tarjeta} MB, total ${b.total - a.total >= 0 ? '+' : ''}${b.total - a.total} MB`);
}
const salida = path.join(raiz, 'build/web/datos/memoria-pistas');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `${ETIQUETA}.json`), JSON.stringify({ extra: EXTRA, pistas: PISTAS, segundos: SEG, filas }, null, 1));
await navegador.close().catch(() => {}); chrome.kill(); servidor.kill();
await espera(1000);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
