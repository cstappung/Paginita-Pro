// Mide lo que ve UN jugador en una sala en línea (bitácora §63): una sola pestaña en la carrera sincronizada (un solo
// humano en ?sincro, con red=malla, como cada jugador en su PC; sin la red con SIN_RED=1) y, por cada variante de la
// dirección, 60 s de carrera:
//   - cuadros del juego por segundo (los que el juego le entrega a aurora);
//   - de los refrescos del monitor, cuántos traen un cuadro nuevo justo / repiten el anterior / se saltaron uno
//     (mkwEstado.vsync; con un monitor de F Hz lo ideal es 60/F con cuadro nuevo, el resto repetidos y 0 saltados);
//   - el hueco máximo y medio de un setInterval de 100 ms ("latido": si el hilo de la página está tomado, crece).
// Uso:  node herramientas/medir-enlinea.mjs ["&param=valor" …]     (sin variantes: la página tal cual)
//       p. ej. node herramientas/medir-enlinea.mjs "" "&esperaToma=0&atrasada=0"   (con y sin la pausa de presentar)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8148;
const variantes = process.argv.slice(2).length ? process.argv.slice(2) : [''];
const espera = ms => new Promise(r => setTimeout(r, ms));
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
for (const extra of variantes) {
  const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
  const p = await contexto.newPage();
  const sala = 'solo-' + Date.now().toString(36), uid = 'a' + sala;
  const red = process.env.SIN_RED ? '' : `&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uid}`;
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1${red}&modo=copa&pistas=50.2,50.0,65.3,45.0&semilla=2121618600&cpu=normal&autoconducir=1${extra}`);
  await p.evaluate(() => { window.__lat = { ult: performance.now(), max: 0, n: 0, suma: 0 }; setInterval(() => { const a = performance.now(), d = a - window.__lat.ult; window.__lat.max = Math.max(window.__lat.max, d); window.__lat.n++; window.__lat.suma += d; window.__lat.ult = a; }, 100); });
  // el latido: cada vuelta de un setInterval de 100 ms anota el hueco desde la anterior
  // esperar la carrera (sección 0x20, etapa 2 = corriendo) y 10 s más (pasada la largada)
  for (let i = 0; i < 200; i++) {
    const ok = await p.evaluate(() => { const L = window.mkwMenus, e = L?.estado?.(); if (!e) return false; const ri = L.u32(0x809BD730); return e.seccion === 0x20 && ri && L.u32(ri + 0x28) === 2; }).catch(() => false);
    if (ok) break; await espera(1000);
  }
  await espera(10000);
  const foto = () => p.evaluate(() => { const v = window.mkwEstado.vsync; const l = window.__lat; const r = { t: performance.now(), c: window.mkwCuadros(), ref: v.refrescos, uno: v.unoJusto, rep: v.repetidos, sal: v.saltados, latMax: l.max, latN: l.n, latSuma: l.suma }; l.max = 0; return r; });
  const a = await foto(); await espera(60000); const b = await foto();
  const s = (b.t - a.t) / 1000, ref = b.ref - a.ref;
  console.log(`variante "${extra || '(por omisión)'}": juego ${((b.c - a.c) / s).toFixed(1)} cuadros/s · refrescos ${ref}: 1 justo ${(100 * (b.uno - a.uno) / ref).toFixed(1)} %, repetidos ${(100 * (b.rep - a.rep) / ref).toFixed(1)} %, saltados ${(100 * (b.sal - a.sal) / ref).toFixed(1)} % · latido máx ${b.latMax.toFixed(0)} ms, medio ${((b.latSuma - a.latSuma) / Math.max(1, b.latN - a.latN)).toFixed(0)} ms`);
  await contexto.close();
}
await navegador.close(); servidor.kill();
