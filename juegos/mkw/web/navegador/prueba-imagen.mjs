// Prueba con el juego de G15 (bitácora §255): cambiar «Imagen» (60 / 30 parejas / con imagen intermedia / Automático)
// en plena carrera, sin reiniciar, sin tirón ni cuadro negro, con la lógica siempre en 60.
//
// Resumen: una carrera directa de 12 CPU (perfil nuevo, sin sonido). Con la carrera andando, la prueba llama
// window.mkwImagen(v) 21 veces, cada 1,5 s, recorriendo 30 parejas → 60 → intermedia → Automático → …; después de cada
// cambio saca tres fotos de la pantalla (lo que de verdad se ve, con el compositor) y mira que no estén negras. Al final:
//   - el juego aplicó los cambios (n8 «cambiosModo») y quedó en el último pedido;
//   - en 30 parejas y en intermedia se saltó la mitad de los dibujos, en 60 ninguno (los contadores del juego);
//   - las imágenes de verdad guardadas por aurora casi no se tiraron (el cambio espera el borde del par: aplicarPedido);
//   - la lógica fue a 60 cuadros por segundo todo el rato (Raceinfo +0x20 contra el reloj).
// Uso:  MKW_BUILD=build/web-g15/navegador node web/navegador/prueba-imagen.mjs [--puerto 8184] [--ventana]
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const i = args.indexOf('--puerto');
const PUERTO = i >= 0 ? Number(args[i + 1]) : 8184;
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;
const ok = (txt, si, extra = '') => { si ? bien++ : mal++; console.log(`  ${si ? '✓' : '✗'} ${txt}${extra ? ' — ' + extra : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
         '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
         `--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] });
try {
  const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
  const p = await contexto.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&cortina=0&verGrafico=1`);
  let enCarrera = false;
  for (let k = 0; k < 300 && !enCarrera; k++) {
    enCarrera = await p.evaluate(() => { const L = window.mkwMenus, ri = L?.u32?.(0x809BD730); return !!ri && L.u32(ri + 0x28) === 2; }).catch(() => false);
    if (!enCarrera) await espera(1000);
  }
  ok('la carrera arrancó', enCarrera);
  ok('la página trae window.mkwImagen y el juego lo pedido (G15)', await p.evaluate(() => typeof window.mkwImagen === 'function' && window.mkwEstado.n8?.().pedido >= 0));
  await espera(3000);
  const leer = () => p.evaluate(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730); return { t: performance.now(), logica: L.u32(ri + 0x20), n8: window.mkwEstado.n8() }; });
  const oscuro = async () => {   // (la foto con el compositor, decodificada por el navegador: % de píxeles casi negros)
    const png = await p.locator('#canvas').screenshot();
    return p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = new OffscreenCanvas(im.width, im.height), g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, im.height).data; let n = 0;
      for (let q = 0; q < d.length; q += 4) if (d[q] + d[q + 1] + d[q + 2] < 15) n++;
      return n * 100 / (d.length / 4); }, png.toString('base64'));
  };
  const ciclo = [1, 0, 2, 'auto'], porModo = { 0: [], 1: [], 2: [] }, fotos = [], aplicados = [];
  const a = await leer();
  for (let c = 0; c < 21; c++) {
    const v = ciclo[c % ciclo.length];
    const antes = await leer();
    await p.evaluate(x => window.mkwImagen(x), v);
    await espera(120);
    for (let f = 0; f < 3; f++) fotos.push(await oscuro());
    await espera(1300);
    const despues = await leer();
    aplicados.push(despues.n8.modo === (v === 'auto' ? despues.n8.modo : v) && despues.n8.pedido === despues.n8.modo);
    if (v !== 'auto') {
      const dib = despues.n8.dibujados - antes.n8.dibujados, sal = despues.n8.saltados - antes.n8.saltados;
      // (en 60 el juego no cuenta los dibujos: solo se mira que no se salte más que el del par del cambio)
      porModo[v].push(v === 0 ? sal : sal / Math.max(1, dib + sal));
    }
  }
  const b = await leer();
  const logica = (b.logica - a.logica) / ((b.t - a.t) / 1000);
  ok('21 cambios aplicados por el juego (cambiosModo) y cada vez quedó en lo pedido', b.n8.cambiosModo - a.n8.cambiosModo >= 20 && aplicados.every(Boolean),
     `${b.n8.cambiosModo - a.n8.cambiosModo} cambios; ${aplicados.filter(Boolean).length}/21 en lo pedido`);
  const prom = xs => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  // (el tramo de 1,4 s incluye el par del cambio: la fracción saltada se mide con margen)
  ok('en 60 no se salta ningún dibujo (salvo el del par del cambio); en 30 parejas y en intermedia, la mitad', Math.max(...porModo[0]) <= 1 && prom(porModo[1]) > 0.4 && prom(porModo[2]) > 0.4,
     `saltados: 60 ${porModo[0].join('/')} por tramo, 30 parejas ${(100 * prom(porModo[1])).toFixed(0)} %, intermedia ${(100 * prom(porModo[2])).toFixed(0)} %`);
  ok('ninguna foto negra justo después de cambiar (63 fotos, menos del 60 % oscuro cada una)', fotos.every(x => x < 60), `peor ${Math.max(...fotos).toFixed(1)} % oscuro`);
  const tiradas = b.n8.descartadas - a.n8.descartadas, guardadas = b.n8.guardadas - a.n8.guardadas;
  ok('aurora casi no tiró imágenes de verdad guardadas (menos del 2 %)', tiradas <= Math.max(2, guardadas * 0.02), `${tiradas} tiradas de ${guardadas} guardadas`);
  ok('la lógica fue a 60 cuadros por segundo todo el rato', logica > 57 && logica < 62, `${logica.toFixed(1)} cuadros de lógica por segundo`);
  // §256 (G16): el medidor con el gráfico del tiempo de cada imagen (?verGrafico=1): el lienzo está, se ve, tiene barras
  // pintadas, y el texto dice el 1 % bajo
  const g = await p.evaluate(() => {
    const c = document.querySelector('canvas.grafico-imagenes'); if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let pint = 0;
    for (let q = 0; q < d.length; q += 4) if (d[q + 1] > 150 && d[q] < 120) pint++;   // (verde: las barras parejas)
    const m = document.getElementById('medidor');
    return { visible: c.offsetWidth > 0 && !c.hidden, pint, texto: m?.textContent || '', resumen: window.mkwEstado.imagenes?.resumen(null, 600) };
  });
  ok('G16: el gráfico en vivo del medidor se ve con barras y dice el 1 % bajo', !!g && g.visible && g.pint > 50 && /1 % bajo/.test(g.texto),
     g ? `${g.pint} píxeles verdes; «${g.texto.slice(0, 80)}»; 1 % bajo ${g.resumen?.bajo1?.toFixed(1)} de ${g.resumen?.fps?.toFixed(1)} fps` : 'sin lienzo');
  await contexto.close();
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
}
console.log(`${bien} bien, ${mal} mal`);
await navegador.close(); servidor.kill();
process.exit(mal ? 1 : 0);
