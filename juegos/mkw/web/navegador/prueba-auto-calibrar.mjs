// Prueba con el juego: «⚡ Auto calibración: máxima fluidez» jugando solo — bitácora §274.
//
// Resumen: abre una carrera directa (12 karts: el jugador y 11 CPU en «máximo»), aprieta el botón en los menús (queda
// pendiente: ahí no hay carrera que medir) y espera a que la calibración arranque sola 5 s después de la largada.
// Comprueba que dura 30 s o menos, que lo elegido tiene la lógica a 60 (o lo dice), que su 1 % bajo es al menos el de
// lo de antes (con --baja, la gama baja simulada: mejor que lo de por omisión), que queda guardado (mkw.graficos) y en
// el panel con «Deshacer», y que «Deshacer» vuelve atrás. Imprime la tabla de lo medido (== líneas, para la bitácora).
//
// Uso:  MKW_BUILD=build/web-274/navegador node web/navegador/prueba-auto-calibrar.mjs [--ventana] [--baja] [--extra "&…"]
//       [--chrome "--js-flags=…"] [--puerto 8174]
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8174));
const BAJA = process.argv.includes('--baja');
const EXTRA = opcion('--extra', '');
const CHROME = opcion('--chrome', '');
const VENTANA = process.argv.includes('--ventana');
const carpeta = path.join(raiz, 'build/web/datos/auto-calibrar');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);   // (el monitor de 144 Hz)
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !VENTANA,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', ...(VENTANA ? [`--window-position=${vx},${vy}`] : []), ...(CHROME ? CHROME.split(' ') : [])] });
let salida = 0;
try {
  const p = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
  const errores = [];
  p.on('pageerror', e => { errores.push(e.message); console.log('[pageerror] ' + e.message); });
  const registro = [];
  p.on('console', m => { const t = m.text(); if (t.includes('[auto-calibrar]') || t.includes('[n8]')) registro.push(t); });
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=maximo&pj=0&kart=1${EXTRA}`);
  await p.waitForFunction(() => !!window.mkwAutoCalibrar && !!document.getElementById('autoCalibrar'), null, { timeout: 120000 });
  const boton = await p.evaluate(() => document.getElementById('autoCalibrar').textContent);
  ok('el botón está en Gráficos y dice «⚡ Auto calibración: máxima fluidez»', boton === '⚡ Auto calibración: máxima fluidez', boton);
  // en los menús (o la carga): pendiente
  const pend = await p.evaluate(() => { window.mkwAutoCalibrar.apretar(); const e = window.mkwAutoCalibrar.estado; return { pendiente: e.pendiente, texto: e.texto }; });
  ok('apretado antes de la carrera: queda pendiente, con el aviso', pend.pendiente && /Pendiente/.test(pend.texto), pend.texto);
  // la carrera, la largada y la calibración (sola, 3 s después de que la carrera anda)
  const t0 = Date.now();
  await p.waitForFunction(() => window.mkwAutoCalibrar.estado.veces >= 1 || !!window.mkwAutoCalibrar.estado.ultimo?.cancelada, null, { timeout: 300000, polling: 500 });
  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  const r = await p.evaluate(() => {
    const e = window.mkwAutoCalibrar.estado, u = e.ultimo;
    return { u: u && { ms: u.ms, cancelada: u.cancelada, texto: u.texto, frena: u.frena, cortado: u.cortado,
      elegido: u.elegido && { n8: u.elegido.n8, salida: u.elegido.salida, bajo1: u.elegido.bajo1, fps: u.elegido.fps, logica: u.elegido.logicaFinal, sinLogica: !!u.elegido.sinLogica },
      antes: u.antes && { bajo1: u.antes.bajo1, fps: u.antes.fps, logica: u.antes.logicaFinal },
      resultados: (u.resultados || []).map(x => ({ n8: x.n8, salida: x.salida, bajo1: x.bajo1, fps: x.fps, logica: x.logicaFinal, ocupado: x.ocupado, llega: x.llega, gpuMs: x.gpuMs })) },
      guardado: JSON.parse(localStorage.getItem('mkw.graficos') || '{}'), panel: document.getElementById('autoCalibrarEstado')?.textContent,
      deshacer: !document.getElementById('autoCalibrarDeshacer')?.hidden, n8: window.mkwEstado.n8?.(), lienzo: document.querySelector('canvas')?.height, historial: e.historial };
  });
  writeFileSync(path.join(carpeta, `solo${BAJA ? '-baja' : ''}.json`), JSON.stringify(r, null, 1));
  for (const x of r.u?.resultados || []) console.log(`== ${BAJA ? 'baja' : 'pc'} n8=${x.n8} salida=${x.salida} · 1 % bajo ${x.bajo1?.toFixed(1)} · ${x.fps?.toFixed(1)} fps · lógica ${x.logica?.toFixed?.(1) ?? x.logica} · ocupado ${Math.round(100 * (x.ocupado ?? 0))} %${x.gpuMs ? ` · tarjeta ${x.gpuMs.toFixed(1)} ms` : ''}${x.llega === false ? ' · DESCARTADA' : ''}`);
  console.log(`== ${r.u?.texto} (${((r.u?.ms ?? 0) / 1000).toFixed(1)} s, lienzo ${r.lienzo} px)`);
  ok(`la calibración corrió sola en la carrera (${seg} s después de abrir)`, !!r.u && !r.u.cancelada && !!r.u.elegido, r.u?.cancelada || '');
  ok('duró 30 s o menos', r.u && r.u.ms <= 30000, `${((r.u?.ms ?? 0) / 1000).toFixed(1)} s`);
  ok('lo elegido tiene la lógica a 60 (57 o más), o lo dice', r.u?.elegido && (r.u.elegido.sinLogica ? /Ninguna combinación llegó a 60/.test(r.u.texto) : r.u.elegido.logica >= 57), `lógica ${r.u?.elegido?.logica}`);
  // (la regla: primero la lógica a 60; si ninguna llega, la que más lógica da —«mejor» es más lógica—; si llegan, el 1 % bajo)
  const sinL = !!r.u?.elegido?.sinLogica;
  ok(sinL ? 'ninguna llega a 60: lo elegido da más lógica que lo de antes (o la misma)' : 'el 1 % bajo de lo elegido es al menos el de lo de antes',
     r.u?.elegido && r.u.antes && (sinL ? r.u.elegido.logica >= r.u.antes.logica * 0.98 : r.u.elegido.bajo1 >= r.u.antes.bajo1 * 0.97),
     `1 % bajo ${r.u?.elegido?.bajo1?.toFixed(1)} contra ${r.u?.antes?.bajo1?.toFixed(1)}; lógica ${r.u?.elegido?.logica?.toFixed(1)} contra ${r.u?.antes?.logica?.toFixed(1)}`);
  if (BAJA) ok('gama baja: elige algo mejor que lo de por omisión (60 siempre): más lógica si nada llega a 60, si no mejor 1 % bajo', r.u?.elegido && (r.u.elegido.n8 !== 0 || r.u.elegido.salida !== 0) &&
                (sinL ? r.u.elegido.logica > (r.u.antes?.logica ?? 0) * 1.05 : r.u.elegido.bajo1 > (r.u.antes?.bajo1 ?? 0) * 1.05),
                `${r.u?.elegido?.n8}/${r.u?.elegido?.salida}: lógica ${r.u?.elegido?.logica?.toFixed(1)} contra ${r.u?.antes?.logica?.toFixed(1)}, 1 % bajo ${r.u?.elegido?.bajo1?.toFixed(1)} contra ${r.u?.antes?.bajo1?.toFixed(1)}`);
  ok('queda guardado en mkw.graficos', r.u?.elegido && Number(r.guardado.n8) === r.u.elegido.n8 && Number(r.guardado.salida) === r.u.elegido.salida, JSON.stringify(r.guardado));
  ok('el panel dice «Elegido: …» y ofrece «Deshacer»', /^Elegido: /.test(r.panel || '') && (r.deshacer || (r.u?.elegido?.n8 === 0 && r.u?.elegido?.salida === 0)), r.panel);
  ok('el juego quedó con la Imagen elegida', r.u?.elegido && (r.u.elegido.n8 === 0 ? !r.n8?.activo || r.n8.modo === 0 : r.n8?.modo === r.u.elegido.n8), JSON.stringify({ modo: r.n8?.modo, activo: r.n8?.activo }));
  await p.screenshot({ path: path.join(carpeta, `solo${BAJA ? '-baja' : ''}.png`) }).catch(() => {});
  const d = await p.evaluate(() => { const hubo = !!window.mkwAutoCalibrar.estado.previo; const x = window.mkwAutoCalibrar.deshacer();
    return { hubo, x, g: JSON.parse(localStorage.getItem('mkw.graficos') || '{}'), texto: document.getElementById('autoCalibrarEstado')?.textContent }; });
  ok('«Deshacer» vuelve a lo de antes', !d.hubo || (d.x && d.texto === 'Vuelto como estaba.'), JSON.stringify(d.g));
  ok('sin errores de la página', errores.length === 0, errores.slice(0, 2).join(' | '));
  writeFileSync(path.join(carpeta, `solo${BAJA ? '-baja' : ''}-registro.txt`), registro.join('\n'));
} catch (e) { ok('sin errores de la prueba', false, e.stack || String(e)); }
finally {
  console.log(`\n${bien} bien, ${mal} mal`);
  salida = mal ? 1 : 0;
  await navegador.close().catch(() => {});
  servidor.kill();
}
process.exit(salida);
