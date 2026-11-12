// foto-cartel.mjs — fotos del cartel de la carga (§276b) en este PC: qué dice la cortina mientras el juego carga.
//
// Resumen: abre Chrome (Playwright, sin sonido, en el monitor de 144 Hz) con un perfil nuevo, carga la página con la
// espera de los gráficos del teléfono (&esperaGraficos=1, así se ve también «Preparando gráficos: N de M»), anota cada
// texto distinto de la cortina con su hora y saca una foto en cada fase nueva; después elige Single Player y hace lo
// mismo en la espera de los gráficos de los menús. --telefono = la ventana del tamaño de un teléfono acostado (915×412,
// 2,625 puntos por pixel; solo el tamaño, sin frenar nada). Salida: build/vistas/cartel-<etiqueta>-*.png y el JSON.
// Uso (con el candado):  node herramientas/foto-cartel.mjs [--telefono] [--etiqueta X] [--puerto 8166]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const TELEFONO = args.includes('--telefono'), ETIQUETA = arg('etiqueta', TELEFONO ? 'telefono' : 'pc'), PUERTO = Number(arg('puerto', 8166));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const espera = ms => new Promise(r => setTimeout(r, ms));
const carpeta = path.join(raiz, 'build/vistas'); fs.mkdirSync(carpeta, { recursive: true });

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--mute-audio', `--window-position=${vx + 40},${vy + 40}`, '--window-size=1280,800'] });
const textos = [];
try {
  const ctx = await navegador.newContext(TELEFONO ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true } : { viewport: { width: 1200, height: 675 } });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PUERTO}/?inicio=1&bienvenida=0&esperaGraficos=1&n8=0`);
  let fases = new Set(), n = 0;
  // mira la cortina cada 200 ms: cada texto nuevo se anota; cada FASE nueva (lo de antes de «:» o de «…»), una foto
  const mirar = async (hasta, tope) => {
    const t1 = Date.now();
    while (Date.now() - t1 < tope) {
      const c = await p.evaluate(() => ({ texto: document.getElementById('cortinaTexto')?.textContent, vivo: document.getElementById('cortinaVivo')?.textContent,
        calma: document.getElementById('cortinaCalma')?.textContent, puesta: !document.body.classList.contains('sin-cortina'),
        inicio: !!window.mkwInicio?.visible, un: window.mkwArranque?.marcas.unJugador != null })).catch(() => null);
      if (c && c.puesta) {
        const ultimo = textos.at(-1);
        if (!ultimo || ultimo.texto !== c.texto) textos.push({ ms: Date.now() - t0, texto: c.texto, vivo: c.vivo, calma: c.calma });
        const fase = (c.texto || '').split(/[:…]/)[0];
        // (la foto 500 ms después: la cortina entra y sale con un fundido de 0,4 s)
        if (!fases.has(fase)) { fases.add(fase); await espera(500); await p.screenshot({ path: path.join(carpeta, `cartel-${ETIQUETA}-${String(++n).padStart(2, '0')}.png`) }); }
      }
      if (c && hasta(c)) return c;
      await espera(200);
    }
    return null;
  };
  await mirar(c => c.inicio, 240000);
  console.log(`menú de inicio a los ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.evaluate(() => { window.mkwInicio.elegir(0); window.mkwInicio.aceptar(); });
  await mirar(c => c.un, 120000);
  console.log(`menú «Un jugador» a los ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const x of textos) console.log(`  ${(x.ms / 1000).toFixed(1).padStart(6)} s  ${x.texto}   [${x.vivo || ''}]${x.calma ? '  · ' + x.calma : ''}`);
  console.log(`${n} fotos → build/vistas/cartel-${ETIQUETA}-*.png`);
} finally {
  fs.writeFileSync(path.join(carpeta, `cartel-${ETIQUETA}.json`), JSON.stringify(textos, null, 2));
  await navegador.close().catch(() => {});
  servidor.kill();
}
