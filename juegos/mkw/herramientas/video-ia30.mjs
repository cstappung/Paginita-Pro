// W32 (bitácora §258): el video lado a lado para el dueño: la misma carrera de 12 CPU con la IA de siempre y con la IA
// pensando uno de cada dos cuadros (?ia30=1).
//
// Resumen: graba las carreras dentro de la página (MediaRecorder sobre el lienzo del juego: no hace falta el ffmpeg de
// Playwright, que en este PC no está), una detrás de la otra, desde la cuenta de salida,
// con la misma pista, la misma semilla y el azar de la carrera de la semilla (?azarFijo=1): las dos largan igual y solo
// cambia la IA, así se ve cuándo y cuánto se separan. Después escribe lado-a-lado.html, que muestra los dos videos juntos
// desde la largada (los dos con el mismo botón de reproducir). Todo queda en build/web/datos/w32/ (es imagen del juego:
// nunca a git ni a la red).
// Uso:  MKW_BUILD=build/web-w32/navegador node herramientas/video-ia30.mjs [--pista 0.0] [--semilla 1234] [--cpu maximo]
//         [--segundos 45] [--puerto 8179] [--modos 0,1,3]  (los valores de ?ia30 a grabar: 0 de siempre, 1 o 2 = 1 de cada 2,
//         3 = 1 de cada 3; por omisión 0,1)
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PISTA = opcion('--pista', '0.0'), SEMILLA = opcion('--semilla', '1234'), CPU = opcion('--cpu', 'maximo');
const SEGUNDOS = Number(opcion('--segundos', 45)), PUERTO = Number(opcion('--puerto', 8179));
const MODOS = opcion('--modos', '0,1').split(',').map(Number);
const rotulo = m => m === 0 ? 'IA de siempre (60 por segundo)' : `IA uno de cada ${m === 1 ? 2 : m} cuadros (${Math.round(60 / (m === 1 ? 2 : m))} por segundo)`;
const carpeta = path.join(raiz, 'build/web/datos/w32');
mkdirSync(carpeta, { recursive: true });
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);

const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`, '--window-size=1000,640'] });

const ANCHO = 960, ALTO = 540;
const resultado = {};
try {
  for (const ia of MODOS) {
    const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO } });
    const p = await contexto.newPage();
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&cc=c150&cpu=${CPU}&semilla=${SEMILLA}&pj=0&kart=1&soloCpu=1&azarFijo=1&cortina=0&ia30=${ia}`);
    // la cuenta de salida (etapa 1) y después la carrera andando (etapa 2)
    const etapa = () => p.evaluate(() => { const L = window.mkwMenus, ri = L?.u32?.(0x809BD730); return ri ? L.u32(ri + 0x28) : -1; }).catch(() => -1);
    let desde = 0;
    while (Date.now() - t0 < 240000) { const e = await etapa(); if (e >= 1) { desde = Date.now() - t0; break; } await p.waitForTimeout(100); }
    // grabar el lienzo más grande de la página (el del juego) a 30 imágenes por segundo
    await p.evaluate(() => {
      const lienzo = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const g = window.__grabar = { trozos: [] };
      g.mr = new MediaRecorder(lienzo.captureStream(30), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5e6 });
      g.mr.ondataavailable = e => { if (e.data.size) g.trozos.push(e.data); };
      g.mr.start(1000);
    });
    await p.waitForTimeout(SEGUNDOS * 1000);
    const estado = await p.evaluate(() => { const M = window.mkw; return M?._mkw_ia30_estado ? Array.from({ length: 8 }, (_, k) => M._mkw_ia30_estado(k)) : null; }).catch(() => null);
    const largo = await p.evaluate(async () => {
      const g = window.__grabar; await new Promise(r => { g.mr.onstop = r; g.mr.stop(); });
      g.bytes = new Uint8Array(await new Blob(g.trozos, { type: 'video/webm' }).arrayBuffer()); return g.bytes.length;
    });
    const partes = [];
    for (let i = 0; i < largo; i += 1 << 20) partes.push(Buffer.from(await p.evaluate(([a, b]) => {
      const x = window.__grabar.bytes.subarray(a, b); let s = ''; for (let k = 0; k < x.length; k += 8192) s += String.fromCharCode(...x.subarray(k, k + 8192)); return btoa(s);
    }, [i, Math.min(largo, i + (1 << 20))]), 'base64'));
    await contexto.close();
    const destino = path.join(carpeta, `carrera-ia30-${ia}.webm`);
    writeFileSync(destino, Buffer.concat(partes));
    desde = 0;                                                  // (el video empieza en la cuenta)
    resultado[ia] = { desde: desde / 1000, estado };
    console.log(`ia30=${ia}: la cuenta a los ${(desde / 1000).toFixed(1)} s del video; gancho ${JSON.stringify(estado)} → ${destino}`);
  }
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}

// la página que muestra los dos juntos desde la cuenta de salida
const vids = MODOS.map((m, n) => `<figure><video id="v${n}" src="carrera-ia30-${m}.webm" muted></video><figcaption>${rotulo(m)}</figcaption></figure>`).join('');
const desdes = JSON.stringify(MODOS.map(m => resultado[m]?.desde ?? 0));
writeFileSync(path.join(carpeta, 'lado-a-lado.html'), `<!doctype html><meta charset="utf-8"><title>W32: la IA a menos cuadros</title>
<style>body{background:#111;color:#eee;font:15px system-ui;margin:16px}div.f{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0}video{width:min(${MODOS.length > 2 ? 31 : 46}vw,960px)}button{font-size:16px;padding:6px 14px}</style>
<h2>La misma carrera (pista ${PISTA}, semilla ${SEMILLA}, CPU ${CPU}, 12 CPU)</h2>
<p>Cada video es la misma carrera con la IA de las CPU pensando más o menos seguido; la física de todos sigue a 60 cuadros por segundo.
Todas largan exactamente igual y se van separando de a poco (cualquier diferencia mínima cambia la carrera, como dos veces la misma carrera con otra suerte): lo que hay que mirar es si las CPU manejan peor (más choques, zigzag, derrapes raros).</p>
<p><button id="b">▶ Reproducir todos</button> <button id="r">↺ Desde la largada</button></p>
<div class="f">${vids}</div>
<script>
const vs=[...document.querySelectorAll('video')],d=${desdes};
const ir=()=>vs.forEach((v,n)=>{v.currentTime=d[n];});
vs.forEach(v=>v.addEventListener('loadedmetadata',ir,{once:true}));
document.getElementById('b').onclick=()=>{if(vs[0].paused)vs.forEach(v=>v.play());else vs.forEach(v=>v.pause());};
document.getElementById('r').onclick=()=>{vs.forEach(v=>v.pause());ir();};
</script>`);
console.log('→ ' + path.join(carpeta, 'lado-a-lado.html'));
