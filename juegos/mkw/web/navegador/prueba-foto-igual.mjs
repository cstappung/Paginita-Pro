// ¿Dos maneras de dibujar dan la misma imagen? (W9 de la etapa 0 del plan v4, bitácora §205; sirve para cualquier
// cambio del dibujo que no debería verse).
//
// Resumen: la misma carrera dos veces, A con sus parámetros y B con los suyos (p. ej. B con ?huesosFilas=1, el camino de
// reserva de las Adreno). La carrera es la Contrarreloj contra el fantasma experto, sin tocar el mando (como
// prueba-fantasma-igual.mjs): es la misma cuadro por cuadro. La carrera directa de 12 CPU NO sirve aunque lleve la misma
// semilla: las CPU eligen personaje en los menús con el reloj de verdad (otra parrilla cada vez). Con
// ?fotoCuadro=N la página deja el juego quieto en el cuadro de lógica N de la carrera; se saca la foto del lienzo de
// cada una y se comparan píxel a píxel: cuántos píxeles difieren en más de 2 niveles (de 255) en algún canal. La meta
// del plan: menos del 0,5 %. También cuenta los errores de los sombreadores (WGSL) en la consola de cada una.
//
// Uso:  MKW_BUILD=build/web-w19/navegador node web/navegador/prueba-foto-igual.mjs [--extra-a=&…] [--extra-b=&huesosFilas=1]
//         [--copa 0 --fila 0] [--cuadros 600,1500] [--puerto 8183] [--ventana]
//         [--desde 0.32]
//       (se exige que A y B se hayan quedado en el mismo cuadro de lógica: Raceinfo +0x20)
//       --desde = desde qué fracción del alto se compara (0,32 por omisión): arriba quedan los rayos del sol del cielo,
//       que se mueven con el reloj y no con los cuadros de la carrera, y el último dígito del cronómetro; con el mismo
//       programa dos veces (A contra A) solo eso cambia, ~1 % de la imagen. 0 = la imagen entera (se imprime igual)
//       (las fotos quedan en build/web/datos/foto-igual/: son imágenes del juego, nunca a git)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.findIndex(a => a === `--${n}` || a.startsWith(`--${n}=`)); if (i < 0) return d;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1]; };
const PUERTO = Number(opcion('puerto', 8183)), COPA = opcion('copa', '0'), FILA = opcion('fila', '0');
const CUADROS = String(opcion('cuadros', '600,1500')).split(',').map(Number);
const EXTRA_A = opcion('extra-a', ''), EXTRA_B = opcion('extra-b', '');
const DESDE = Math.min(0.9, Math.max(0, Number(opcion('desde', '0.32')) || 0));
const carpeta = path.join(raiz, 'build/web/datos/foto-igual');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${process.env.MKW_VENTANA || '-1880,549'}`] });   // (la pantalla 3, la de 144 Hz)

// una corrida con foto en el cuadro n: perfil nuevo, la Contrarreloj contra el experto (fantasmaPagina=0: el de RR)
async function foto(etiqueta, extra, n) {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('console', m => { const t = m.text(); if (/WGSL|ShaderModule|Error while parsing|Invalid ShaderModule/i.test(t)) errores.push(t.slice(0, 200)); });
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=tt&copa=${COPA}&fila=${FILA}&fantasmaPagina=0&cortina=0&fotoCuadro=${n}${extra}`);   // (§252: sin la cortina de carga, que a veces tapaba la foto)
  const llego = await pagina.waitForFunction(() => window.mkwEstado?.fotoLista === true, null, { timeout: 300000, polling: 250 })
    .then(() => true, () => false);
  await espera(800);   // que la última imagen termine de mostrarse
  const png = llego ? await pagina.locator('#canvas').screenshot() : null;
  const extraEstado = await pagina.evaluate(() => {
    const L = window.mkwMenus, ri = L?.u32(0x809BD730);   // Raceinfo: +0x20 = el cuadro de lógica en que quedó quieta
    return { cuadro: ri ? L.u32(ri + 0x20) : null, huesosFilas: window.mkwEstado?.huesosFilas ?? null };
  }).catch(() => null);
  if (png) writeFileSync(path.join(carpeta, `${etiqueta}-${n}.png`), png);
  console.log(`  ${etiqueta}: cuadro ${n} ${llego ? 'quieto' : 'NO llegó'}; ${errores.length} errores de sombreadores; ${JSON.stringify(extraEstado)}`);
  return { pagina, contexto, png, errores, cuadro: extraEstado?.cuadro ?? null };
}

// la diferencia, dentro de una página (decodificar los PNG con el navegador): píxeles con más de 2 niveles en algún canal
async function comparar(pagina, a, b) {
  return pagina.evaluate(async ([x, y, desde]) => {
    const leer = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
      const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const A = await leer(x), B = await leer(y);
    if (A.width !== B.width || A.height !== B.height) return { distintoTamano: true };
    let mas2 = 0, max = 0, oscuros = 0, mas2Todo = 0;
    const n = A.width * A.height, fila0 = Math.floor(A.height * desde), nZona = (A.height - fila0) * A.width;
    for (let p = 0; p < n * 4; p += 4) {
      let d = 0;
      for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.data[p + k] - B.data[p + k]));
      if (d > 2) mas2Todo++;
      if (A.data[p] + A.data[p + 1] + A.data[p + 2] < 15) oscuros++;
      if (p / 4 < fila0 * A.width) continue;   // arriba de la zona: el cielo y el cronómetro
      if (d > 2) mas2++;
      if (d > max) max = d;
    }
    return { pct: mas2 * 100 / nZona, pctTodo: mas2Todo * 100 / n, max, pctOscuro: oscuros * 100 / n, ancho: A.width, alto: A.height };
  }, [a.toString('base64'), b.toString('base64'), DESDE]);
}

try {
  for (const n of CUADROS) {
    const a = await foto('A', EXTRA_A, n), b = await foto('B', '&build=b' + EXTRA_B, n);
    ok(`cuadro ${n}: las dos llegaron y se quedaron quietas en el mismo cuadro`, !!a.png && !!b.png && a.cuadro === b.cuadro,
       `A en ${a.cuadro}, B en ${b.cuadro}`);
    ok(`cuadro ${n}: sin errores de sombreadores (WGSL) en ninguna`, !a.errores.length && !b.errores.length, [...a.errores, ...b.errores].slice(0, 2).join(' | '));
    if (a.png && b.png) {
      const r = await comparar(a.pagina, a.png, b.png);
      ok(`cuadro ${n}: la foto no está vacía (menos del 60 % negro)`, r.pctOscuro < 60, `${r.pctOscuro?.toFixed(1)} % oscuro, ${r.ancho}×${r.alto}`);
      ok(`cuadro ${n}: la misma imagen (menos del 0,5 % de los píxeles con más de 2 niveles, desde el ${Math.round(DESDE * 100)} % del alto)`,
         !r.distintoTamano && r.pct < 0.5,
         `${r.pct?.toFixed(3)} % distintos, máximo ${r.max} niveles; la imagen entera ${r.pctTodo?.toFixed(3)} %`);
    }
    await a.contexto.close(); await b.contexto.close();
  }
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
}
console.log(`${bien} bien, ${mal} mal  (fotos en ${path.relative(raiz, carpeta)})`);
await navegador.close(); servidor.kill();
process.exit(mal ? 1 : 0);
