// ¿El juego dibuja lo mismo con cualquier forma de ventana? — G5 del plan de rendimiento (bitácora §177).
//
// Resumen: en el Oppo el lienzo quedó en 2,18:1 a pantalla completa y el cuadro costó 34 ms, contra 20 ms con el cajón
// abierto (lienzo angosto, §115.5). Si el juego viera más ancho con un lienzo más ancho, dibujaría más cosas. Con
// `force_16_9` (Config.toml, §79) el runtime fija la «pantalla» de EGG en 16:9 (dynamic_aspect.cpp: el registro del
// canvas 16:9 en 0x802A3EF4 = ancho u16, alto u16, escala horizontal f32; la escala vertical de la proyección en
// 0x80386F24) y aurora pone barras negras dentro del lienzo. Esto abre una carrera directa, cambia la ventana a 16:9,
// 2,18:1 (el teléfono acostado) y parada (el cajón abierto), y en cada una lee esos valores de la memoria, el tamaño
// del lienzo y saca una foto. Con `--libre` lo mismo con ?aspecto=libre (el estirado de antes, para comparar).
// OJO (§177): los valores de la memoria no cambiaron en ninguna forma, ni con --libre (donde la foto sí se estira): no
// son las direcciones que mandan en esta versión. Lo que decide son las fotos (las barras negras y el campo visual).
// Uso:  node herramientas/medir-aspecto.mjs [--puerto 8171] [--libre]  → build/web/datos/aspecto/<forma>.png
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8171)), LIBRE = process.argv.includes('--libre');
const salida = path.join(raiz, 'build/web/datos/aspecto' + (LIBRE ? '-libre' : ''));
mkdirSync(salida, { recursive: true });
const FORMAS = [['16x9', 960, 540], ['2.18x1', 1178, 540], ['parada', 400, 800], ['16x9-de-vuelta', 960, 540]];

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
try {
  const p = await (await nav.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cpu=normal&semilla=99&soloCpu=1${LIBRE ? '&aspecto=libre' : ''}`);
  const espera = ms => new Promise(r => setTimeout(r, ms));
  // lo que el juego cree de la pantalla: el registro 16:9 de EGG::Screen y la escala vertical de la proyección
  const leer = () => p.evaluate(() => {
    const L = window.mkwMenus; if (!L?.u32) return null;
    const f32 = a => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, L.u32(a)); return +d.getFloat32(0).toFixed(4); };
    const ri = L.u32(0x809BD730), c = document.querySelector('canvas');
    return { etapa: ri ? L.u32(ri + 0x28) : -1, ancho169: L.u16(0x802A3EF4), alto169: L.u16(0x802A3EF6), escalaH: f32(0x802A3EF8),
             ancho43: L.u16(0x802A3EE8), escalaV: f32(0x80386F24), lienzo: c ? `${c.width}×${c.height}` : '—',
             // (§177.2, G2: las copias del EFB que limpian —todas, con Z, enteras— y el recuadro de la última recortada)
             limpiezas: window.mkw?._mkw_web_limpiezas ? Array.from({ length: 8 }, (_, k) => window.mkw._mkw_web_limpiezas(k)) : null };
  }).catch(() => null);
  let x = null;
  for (const fin = Date.now() + 180000; Date.now() < fin; await espera(500)) { x = await leer(); if (x?.etapa >= 2) break; }
  if (!(x?.etapa >= 2)) throw new Error('la carrera no largó en 3 min');
  for (const [nombre, an, al] of FORMAS) {
    await p.setViewportSize({ width: an, height: al });
    await espera(2500);                                    // (unos cuadros para que el juego y aurora tomen la forma nueva)
    x = await leer();
    await p.screenshot({ path: path.join(salida, `${nombre}.png`) });
    console.log(`${nombre.padEnd(15)} ventana ${an}×${al} · lienzo ${x?.lienzo} · EGG 16:9 ${x?.ancho169}×${x?.alto169} (escala H ${x?.escalaH}) · ` +
                `EGG 4:3 ancho ${x?.ancho43} · escala V de la proyección ${x?.escalaV}`);
    const l = x?.limpiezas;
    if (l) console.log(`                copias que limpian ${l[0]} (con Z ${l[1]}, enteras ${l[2]}); la última recortada ${l[5]}×${l[6]} en (${l[3]},${l[4]}) de un destino ${l[7] >>> 16}×${l[7] & 0xFFFF}`);
  }
} finally {
  await nav.close().catch(() => {}); servidor.kill();
}
