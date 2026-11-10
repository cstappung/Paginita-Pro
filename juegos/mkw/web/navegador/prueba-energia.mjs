// Prueba con el juego: los vigías del ahorro de energía y del calor (E1 y E2, bitácora §190) conectados a la página.
//
// Resumen: tres carreras directas de 12 CPU en Chrome (perfil nuevo, sin sonido):
//   - «normal» con ?ahorro=1&calor=1: el vigía del ahorro recibe el período de verdad de la pantalla y no avisa; el del
//     calor junta el primer minuto de carrera (los ms por cuadro);
//   - «30 Hz» con ?ahorro=1 y requestAnimationFrame frenado a la mitad (cada refresco se salta uno, como hace el Ahorro de
//     energía de Chrome con batería): el aviso 🔋 tiene que salir en la esquina;
//   - «calor de mentira» (§241) con ?calor=1&calorSeg=15&lastre=1: el «minuto» del vigía dura 15 s y, pasados 40 s de
//     carrera, el lastre sube a 2,5 con el juego andando (el hilo del juego 2,5 veces más lento, como un teléfono que se
//     calienta y baja su reloj): el aviso 🌡️ tiene que salir; y en la carrera normal (los mismos 15 s) no;
//   - «apagado» con ?ahorro=0 y sin ?calor: los vigías no existen (como antes).
//   - «ahorro de verdad» (§241) con ?ahorro=1 en un Chrome con ventana cuyo «Local State» trae el Ahorro de energía
//     prendido siempre (performance_tuning.battery_saver_mode.state = 3): así se prende también en un PC sin batería
//     y Chrome refresca de verdad cada 33,3 ms; el aviso 🔋 tiene que salir. (El caso de un portátil que se
//     desenchufa, o el teléfono con poca batería, queda para el dueño: la regla que lo prende es la de Chrome.)
// Uso:  node web/navegador/prueba-energia.mjs [--puerto 8167]   → ✓/✗
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const i = process.argv.indexOf('--puerto');
const PUERTO = i > 0 ? Number(process.argv[i + 1]) : 8167;
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;
const ok = (txt, si, extra = '') => { si ? bien++ : mal++; console.log(`  ${si ? '✓' : '✗'} ${txt}${extra ? ' — ' + extra : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });

// una carrera: extra = lo que se agrega a la dirección; mitad = frenar requestAnimationFrame a la mitad; seg = segundos de carrera
// real = un Chrome aparte, con ventana (en el monitor de las pruebas, MKW_VENTANA) y el Ahorro de energía prendido
async function carrera(extra, { mitad = false, seg = 20, real = false, calentarEn = 0, calentarK = 2.5 } = {}) {
  let ctx, dirReal = null;
  if (real) {
    dirReal = fs.mkdtempSync(path.join(os.tmpdir(), 'mkw-ahorro-'));
    // la preferencia de Chrome del Ahorro de energía (0 apagado, 1 bajo el 20 % de batería, 2 sin enchufe, 3 siempre)
    fs.writeFileSync(path.join(dirReal, 'Local State'), JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 3 } } }));
    const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
    ctx = await chromium.launchPersistentContext(dirReal, { channel: 'chrome', headless: false, viewport: { width: 960, height: 540 },
      args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`, '--window-size=1000,640'] });
  } else ctx = await navegador.newContext({ viewport: { width: 960, height: 540 } });
  if (mitad) await ctx.addInitScript(() => {
    // cada pedido de refresco espera a que pasen 33 ms desde el refresco anterior que se entregó: la página ve 30 por
    // segundo, como con el Ahorro de energía (sin ventana Chrome refresca a 240 Hz: «saltar uno» daba 8 ms, no 33)
    const raf = window.requestAnimationFrame.bind(window);
    let ultimo = 0;
    window.requestAnimationFrame = cb => raf(function espera(t) {
      if (t !== ultimo && t - ultimo < 33.3 - 2) return raf(espera);   // (todos los del mismo refresco pasan juntos)
      ultimo = t; cb(t);
    });
  });
  const p = real ? (ctx.pages()[0] || await ctx.newPage()) : await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&cc=c150&cpu=maximo&semilla=11&soloCpu=1${extra}`);
  const t0 = Date.now();
  let enCarrera = 0;
  const visto = { ahorro: '', calor: '' };   // el chip dura 15 s en la esquina: se anota cada segundo si se vio alguna vez
  while (Date.now() - t0 < 240000) {
    await espera(1000);
    const e = await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false);
    if (e && !enCarrera) enCarrera = Date.now();
    const ch = await p.evaluate(() => ['ahorro', 'calor'].map(k => document.querySelector(`#estadoJuego [data-clave="${k}"]`)?.textContent ?? '')).catch(() => ['', '']);
    if (ch[0]) visto.ahorro = ch[0]; if (ch[1]) visto.calor = ch[1];
    if (calentarEn && enCarrera && Date.now() - enCarrera > calentarEn * 1000) {   // el «calor»: el hilo del juego más lento
      await p.evaluate(k => { const c = window.mkwLastre?.().cpu; if (c) c.k = k; }, calentarK).catch(() => {});
      calentarEn = 0;
    }
    if (enCarrera && Date.now() - enCarrera > seg * 1000) break;
  }
  const r = await p.evaluate(() => ({
    energia: JSON.parse(JSON.stringify(window.mkwEnergia ?? null)),
    chipAhorro: document.querySelector('#estadoJuego [data-clave="ahorro"]')?.textContent ?? null,
    trabajo: window.mkwEstado?.trabajo, fps: window.mkwEstado?.fps,
  })).catch(e => ({ error: String(e) }));
  await ctx.close();
  if (dirReal) fs.rmSync(dirReal, { recursive: true, force: true });
  return { enCarrera: !!enCarrera, ...r, chipAhorro: r.chipAhorro || visto.ahorro || null, chipCalor: visto.calor || null };
}

try {
  const n = await carrera('&ahorro=1&calor=1&calorSeg=15', { seg: 70 });
  console.log('normal:', JSON.stringify({ ahorro: n.energia?.ahorro, minutos: n.energia?.calor?.minutos, trabajo: n.trabajo, fps: n.fps }));
  ok('llegó a la carrera', n.enCarrera);
  ok('el vigía del ahorro recibe el período de la pantalla (un número de ms)', Number.isFinite(n.energia?.ahorro?.ultimoPeriodo), String(n.energia?.ahorro?.ultimoPeriodo));
  ok('a la velocidad normal de la pantalla no avisa', n.energia?.ahorro?.ahorro === false && !n.chipAhorro);
  ok('el vigía del calor juntó el primer minuto de carrera (ms por cuadro)', n.energia?.calor?.minutos?.length >= 1 && n.energia.calor.minutos[0] > 0,
     JSON.stringify(n.energia?.calor?.minutos));
  ok('…y en la carrera normal no avisa calor (4 «minutos» de 15 s parejos)', n.energia?.calor?.caliente === false && !n.chipCalor && n.energia?.calor?.minutos?.length >= 4,
     JSON.stringify(n.energia?.calor));

  const c = await carrera('&calor=1&calorSeg=15&lastre=1', { seg: 110, calentarEn: 40 });
  console.log('calor de mentira:', JSON.stringify({ calor: c.energia?.calor, chip: c.chipCalor, trabajo: c.trabajo }));
  ok('con el hilo del juego 2,5 veces más lento a mitad de carrera, el vigía ve subir los ms por cuadro',
     c.energia?.calor?.minutos?.length >= 5 && Math.max(...c.energia.calor.minutos.slice(3)) > c.energia.calor.base * 1.25, JSON.stringify(c.energia?.calor?.minutos));
  ok('…y avisa el calor en la esquina (🌡️)', c.energia?.calor?.avisos >= 1 && /🌡/.test(c.chipCalor || ''), c.chipCalor || '(sin aviso)');

  const m = await carrera('&ahorro=1', { mitad: true, seg: 15 });
  console.log('30 Hz:', JSON.stringify({ ahorro: m.energia?.ahorro, chip: m.chipAhorro, trabajo: m.trabajo, fps: m.fps }));
  ok('con los refrescos a la mitad, el vigía ve ~33 ms entre refrescos', m.energia?.ahorro?.ultimoPeriodo > 29, String(m.energia?.ahorro?.ultimoPeriodo));
  ok('…y avisa el ahorro de energía en la esquina (🔋)', m.energia?.ahorro?.ahorro === true && /🔋/.test(m.chipAhorro || ''), m.chipAhorro || '(sin aviso)');

  const v = await carrera('&ahorro=1', { real: true, seg: 15 });
  console.log('ahorro de verdad:', JSON.stringify({ ahorro: v.energia?.ahorro, chip: v.chipAhorro, trabajo: v.trabajo, fps: v.fps }));
  ok('con el Ahorro de energía de Chrome prendido, el vigía ve ~33 ms entre refrescos', v.energia?.ahorro?.ultimoPeriodo > 29, String(v.energia?.ahorro?.ultimoPeriodo));
  ok('…y avisa en la esquina (🔋)', v.energia?.ahorro?.ahorro === true && /🔋/.test(v.chipAhorro || ''), v.chipAhorro || '(sin aviso)');

  const s = await carrera('&ahorro=0', { seg: 5 });
  ok('con ?ahorro=0 y sin ?calor: los vigías no existen', s.energia && s.energia.ahorro === null && s.energia.calor === null);
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}
console.log(`fin: ${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
