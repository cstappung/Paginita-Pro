// ¿Adónde llega el juego si alguien aprieta A en los resultados de una carrera? — bitácora §94.4.
//
// Resumen: abre una carrera directa, la termina por código y aprieta A (tecla K) cada 1,5 s durante 30 s, anotando la
// sección y la página de arriba. Sin el cerrojo de la sala (controles.cerrojo, que pone solo ?modo=sala) se ve: la
// carrera terminada (0x0E) → resultados (0x2F) → tabla de puntos (0x30) → el menú de «carrera siguiente» (0x22, ~11 s)
// → la sección 0x4B (el juego elige pista) → otra carrera (0x1A, 0x20).
// Uso:  node herramientas/medir-resultados-a.mjs [puerto=8169] [carpeta de las fotos=build/web/datos]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = Number(process.argv[2] || 8169), salida = process.argv[3] || path.join(raiz, 'build/web/datos');
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const p = await (await nav.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cpu=normal&semilla=99`);
const espera = ms => new Promise(r => setTimeout(r, ms));
const foto = () => p.evaluate(() => { const L = window.mkwMenus; if (!L?.estado) return null; const e = L.estado(), ri = L.u32(0x809BD730);
  return { s: e.seccion, pag: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1 }; }).catch(() => null);
let x = null;
for (const fin = Date.now() + 120000; Date.now() < fin; await espera(500)) { x = await foto(); if (x?.etapa >= 2) break; }
await p.evaluate(() => { window.mkw._mkw_sala_dnf?.(2000); window.mkw._mkw_sala_terminar(0); });
for (const fin = Date.now() + 60000; Date.now() < fin; await espera(500)) { x = await foto(); if (x?.etapa >= 4) break; }
const t0 = Date.now();
for (let k = 0; k < 20; k++) {
  await p.keyboard.down('KeyK'); await espera(120); await p.keyboard.up('KeyK');
  await espera(1400); x = await foto();
  console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s: sección 0x${x?.s?.toString(16)} página 0x${x?.pag?.toString(16)} etapa ${x?.etapa}`);
  if (k === 8 || k === 19) await p.screenshot({ path: path.join(salida, `resultados-a-${k}.png`) });
}
await nav.close(); servidor.kill();
