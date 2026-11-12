// El piloto «host + predicción» con el juego de verdad (bitácora §275): dos pestañas con ?red=estado (la red nativa del
// juego, RKNet, por la malla WebRTC) y B con la CPU frenada a propósito (?lastre=K: su hilo del juego K veces más lento).
//
// Resumen: como prueba-enlinea.mjs (A anfitrión con el WFC de la sala, B el otro; el piloto entra solo hasta la carrera en
// línea), pero en la carrera las dos pestañas aceleran (tecla K = botón A, mantenida) y la sonda de red-estado.mjs anota
// en cada cuadro de lógica la posición de cada kart. Después:
//   - el error del kart remoto: el kart de A visto en A (la verdad) contra el mismo kart visto en B a la misma hora
//     (las dos pestañas leen el mismo reloj), y al revés; y el atraso de la vista (el corrimiento que hace mínimo el error)
//   - el botón propio: cada pestaña suelta el acelerador una vez; ¿cuántos cuadros tarda su kart en frenar? (0 = el
//     cuadro siguiente: sin espera de red; en el lockstep serían los cuadros de retraso de la sala, 2 a 12)
//   - los cuadros de lógica por segundo de cada una: A no debe bajar de ~58 aunque B vaya lenta
//   - cuánto avanza el kart de cada uno por segundo de reloj (la lenta, ¿corre en cámara lenta?)
// Se escribe todo en build/web/datos/red-estado/<etiqueta>.json con las fotos.
//
// Uso:  node web/navegador/prueba-red-estado.mjs [--lastre=6] [--segundos=20] [--etiqueta=X] [--ventana] [--extra-b=&…] [--extra=&… (a las dos)]
//       (~6 min; MKW_BUILD = otro programa; con --ventana la ventana va a MKW_VENTANA, por omisión el monitor de 144 Hz)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { errorTrayectoria, atrasoDeVista, ritmo, cuadrosDeRespuesta, distancia } from './red-estado.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const LASTRE = Number(arg('lastre', '6')), SEGUNDOS = Number(arg('segundos', '20')), ETIQUETA = arg('etiqueta', `lastre${LASTRE}`);
const EXTRA_B = arg('extra-b', ''), EXTRA = arg('extra', ''), PUERTO = Number(arg('puerto', '8163'));
const carpeta = path.join(raiz, 'build/web/datos/red-estado');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const VENTANA = process.argv.includes('--ventana');
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !VENTANA,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', ...(VENTANA ? [`--window-position=${vx},${vy}`] : [])] });
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'red-estado-' + Date.now().toString(36);
const registro = [];
async function abrir(nombre, extra) {
  const p = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${nombre}] [pageerror] ${e.message}`); registro.push(`[${nombre}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${nombre}] ${m.text().slice(0, 300)}`));
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=estado&senal=canal&sala=${sala}&uid=${nombre.toLowerCase()}${sala}${EXTRA}${extra}`);   // (--extra=&… = a las dos)
  return p;
}
const t0 = Date.now();
const A = await abrir('A', '&nodo=2&anfitrion=1');
await A.waitForFunction(() => window.mkwRed?.presentador && window.mkwRedEstado, null, { timeout: 60000 });
await A.evaluate(() => window.mkwRed.presentador.presentar({ vr: 5000, br: 5000 }));
await espera(15000);
const B = await abrir('B', `&nodo=3${LASTRE > 1 ? `&lastre=${LASTRE}` : ''}${EXTRA_B}`);
// El lastre solo en la carrera: por los menús y el emparejamiento B va a su ritmo (K = 1, en vivo: estado.k). Con B ×6
// también ahí, la sala del juego (RKNet) a veces se deshacía al minuto de juntarse y ninguna llegaba a la carrera (la
// planilla fallaba 2 de 3 desde el 2026-11-11 11:29); lo que se mide es la carrera con B lenta.
const lastreB = k => B.evaluate(k => { const e = window.mkwLastre?.()?.cpu; if (e) e.k = k; return e?.k ?? null; }, k).catch(() => null);
if (LASTRE > 1) await B.waitForFunction(() => window.mkwLastre?.()?.cpu, null, { timeout: 60000 }).then(() => lastreB(1)).catch(() => {});

// 1) hasta la carrera en línea (sección 0x68) y la cuenta (Raceinfo +0x28 ≥ 1) en las dos
const etapa = p => p.evaluate(() => { const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null; const ri = L.u32(0x809BD730);
  return { s: e.seccion, etapa: ri ? L.u32(ri + 0x28) : -1 }; }).catch(() => null);
const llego = { A: null, B: null };
const limite = Date.now() + 7 * 60000;
while (Date.now() < limite && !(llego.A && llego.B)) {
  for (const [n, p] of [['A', A], ['B', B]]) {
    const e = await etapa(p);
    if (!llego[n] && e?.s === 0x68 && e.etapa >= 1) { llego[n] = ((Date.now() - t0) / 1000).toFixed(0); console.log(`  ${n}: en la carrera a los ${llego[n]} s`); }
  }
  await espera(1000);
}
ok('las dos llegaron a la carrera en línea (la red nativa por la malla)', !!(llego.A && llego.B), `A ${llego.A ?? '-'} s, B ${llego.B ?? '-'} s`);
if (!(llego.A && llego.B)) await terminar();
if (LASTRE > 1) console.log(`  B: lastre ×${await lastreB(LASTRE)} desde la carrera`);

// 2) las dos aceleran (desde la cuenta: así salen juntas) hasta que la carrera anda
for (const p of [A, B]) await p.keyboard.down('KeyK');
await A.waitForFunction(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730); return ri && L.u32(ri + 0x28) >= 2; }, null, { timeout: 30000, polling: 100 }).catch(() => {});
const desde = Date.now() + 3000;            // 3 s después del «¡YA!», cuando ya van rápido
await espera(3000 + SEGUNDOS * 500);
// el botón propio: cada una suelta el acelerador 1,2 s y lo vuelve a apretar (A primero, B después)
// La marca se toma en la página al recibir la tecla (no antes de mandarla: el viaje de Playwright a la página tarda
// 1-2 cuadros con el PC cargado, como en la planilla, y eso no es demora del juego).
const soltar = async p => {
  await p.evaluate(() => { window.__fSuelta = null; addEventListener('keyup', e => { if (e.code === 'KeyK') window.__fSuelta = window.mkwRedEstado.marcar('suelta'); }, { once: true, capture: true }); });
  await p.keyboard.up('KeyK'); await espera(1200); await p.keyboard.down('KeyK');
  return p.evaluate(() => window.__fSuelta);
};
// Tres veces cada una y vale la mejor: la respuesta se lee en la velocidad del kart, y si al soltar va en el aire o
// contra una pared la caída llega tarde (una corrida de la planilla midió 60 cuadros así). Una demora de verdad (el
// kart propio esperando a la red) saldría en las tres.
const fSueltaA = [], fSueltaB = [];
for (let k = 0; k < 3; k++) { fSueltaA.push(await soltar(A)); await espera(1500); fSueltaB.push(await soltar(B)); await espera(1500); }
await espera(Math.max(1000, SEGUNDOS * 500 - 3900));
await A.locator('#canvas').screenshot({ path: path.join(carpeta, `${ETIQUETA}-A.png`) }).catch(() => {});
await B.locator('#canvas').screenshot({ path: path.join(carpeta, `${ETIQUETA}-B.png`) }).catch(() => {});
for (const p of [A, B]) await p.keyboard.up('KeyK');

// 3) lo medido
const datos = {};
for (const [n, p] of [['A', A], ['B', B]]) datos[n] = await p.evaluate(d => ({ m: window.mkwRedEstado.muestras(d), marcas: window.mkwRedEstado.marcas(),
  lastre: window.mkwLastre?.() ?? null, red: window.mkwRed?.pila?.cuentas?.() ?? null }), desde).catch(() => null);
const mA = datos.A?.m ?? [], mB = datos.B?.m ?? [];
const propioA = mA.at(-1)?.propio, propioB = mB.at(-1)?.propio;
const tray = (m, i) => m.filter(s => s.karts[i]).map(s => ({ t: s.t, f: s.f, pos: s.karts[i] }));
const r = { etiqueta: ETIQUETA, lastre: LASTRE, segundos: SEGUNDOS, llego, propioA, propioB, n: { A: mA.length, B: mB.length } };
ok('las dos sondas anotaron la carrera', mA.length > 200 && mB.length > 100, JSON.stringify(r.n));
ok('cada consola maneja un kart distinto', Number.isInteger(propioA) && Number.isInteger(propioB) && propioA !== propioB, `A = ${propioA}, B = ${propioB}`);

r.ritmo = { A: ritmo(mA.map(s => ({ t: s.t, f: s.f }))), B: ritmo(mB.map(s => ({ t: s.t, f: s.f }))) };
ok('A (la rápida) sigue a ~60 cuadros de lógica por segundo aunque B vaya lenta', r.ritmo.A >= 57, `A ${r.ritmo.A?.toFixed(1)}/s, B ${r.ritmo.B?.toFixed(1)}/s`);
if (LASTRE > 1) ok('B va de verdad más lenta (el lastre se nota)', r.ritmo.B < r.ritmo.A - 3, `B ${r.ritmo.B?.toFixed(1)}/s`);

// el kart remoto: la verdad (el kart de A en A) contra la vista (el kart de A en B), y al revés
const verdadA = tray(mA, propioA), vistaA = tray(mB, propioA), verdadB = tray(mB, propioB), vistaB = tray(mA, propioB);
r.errorAenB = errorTrayectoria(verdadA, vistaA); r.atrasoAenB = atrasoDeVista(verdadA, vistaA, { maxMs: 1500, pasoMs: 8 });
r.errorBenA = errorTrayectoria(verdadB, vistaB); r.atrasoBenA = atrasoDeVista(verdadB, vistaB, { maxMs: 1500, pasoMs: 8 });
// velocidad de cada kart propio en unidades por segundo de reloj y por cuadro (la mediana de tramos de 0,5 s)
const vel = tr => { const v = [], vf = []; for (let i = 0, j = 0; i < tr.length; i++) { while (j < tr.length && tr[j].t < tr[i].t + 500) j++; if (j >= tr.length) break;
  const d = distancia(tr[i].pos, tr[j].pos); v.push(d / ((tr[j].t - tr[i].t) / 1000)); if (tr[j].f > tr[i].f) vf.push(d / (tr[j].f - tr[i].f)); }
  const med = x => x.length ? [...x].sort((a, b) => a - b)[x.length >> 1] : null; return { porSegundo: med(v), porCuadro: med(vf) }; };
r.velA = vel(verdadA); r.velB = vel(verdadB);
const fmt = e => e?.n ? `medio ${e.medio.toFixed(0)}, p90 ${e.p90.toFixed(0)}, máx ${e.max.toFixed(0)} (n ${e.n})` : 'sin datos';
console.log(`  kart de A visto en B: ${fmt(r.errorAenB)}; atraso de la vista ${r.atrasoAenB.ms} ms (queda ${r.atrasoAenB.medio.toFixed(0)})`);
console.log(`  kart de B visto en A: ${fmt(r.errorBenA)}; atraso de la vista ${r.atrasoBenA.ms} ms (queda ${r.atrasoBenA.medio.toFixed(0)})`);
console.log(`  velocidad: A ${r.velA.porSegundo?.toFixed(0)}/s (${r.velA.porCuadro?.toFixed(1)} por cuadro), B ${r.velB.porSegundo?.toFixed(0)}/s (${r.velB.porCuadro?.toFixed(1)} por cuadro)`);
ok('el kart de A se ve moverse en B (la red nativa trae su estado)', r.errorAenB.n > 50 && r.atrasoAenB.ms < 1000, `atraso ${r.atrasoAenB.ms} ms`);
ok('el kart de B se ve moverse en A', r.errorBenA.n > 50 && r.atrasoBenA.ms < 1000, `atraso ${r.atrasoBenA.ms} ms`);

// el botón propio
const propias = (m, i) => m.filter(s => s.karts[i]).map(s => ({ f: s.f, pos: s.karts[i] }));
const mejor = (m, fs) => { const v = fs.map(f => f == null ? null : cuadrosDeRespuesta(m, f)); const ok = v.filter(x => x !== null); return { mejor: ok.length ? Math.min(...ok) : null, todas: v }; };
const rA = mejor(propias(mA, propioA), fSueltaA), rB = mejor(propias(mB, propioB), fSueltaB);
r.respuesta = { A: rA.mejor, B: rB.mejor, todasA: rA.todas, todasB: rB.todas, fSueltaA, fSueltaB };
ok('A: el kart propio responde al botón sin esperar a la red (≤ 1 cuadro)', r.respuesta.A !== null && r.respuesta.A <= 1, `${r.respuesta.A} (${r.respuesta.todasA.join(', ')})`);
ok('B: igual, aunque vaya lenta (≤ 1 cuadro)', r.respuesta.B !== null && r.respuesta.B <= 1, `${r.respuesta.B} (${r.respuesta.todasB.join(', ')})`);
r.red = { A: datos.A?.red, B: datos.B?.red };
r.lastreEstado = datos.B?.lastre;
r.frameLag = registro.filter(t => /frame lag/i.test(t)).slice(-5);
r.fameLagVeces = registro.filter(t => /frame lag/i.test(t)).length;
console.log(`  avisos «Detected frame lag» de RR (corrige SOLO el reloj de la carrera): ${r.fameLagVeces}`);
writeFileSync(path.join(carpeta, `${ETIQUETA}.json`), JSON.stringify({ ...r, muestras: { A: mA, B: mB } }));
await terminar();

async function terminar() {
  // el registro de la red de cada pestaña (window.mkwRed.registro: no va a la consola), para ver dónde se quedó
  for (const [n, p] of [['A', A], ['B', B]]) {
    const r = await p?.evaluate(() => window.mkwRed?.registro?.slice(-400) ?? null).catch(() => null);
    if (r) registro.push(...r.map(t => `[${n}] [red] ${t}`));
  }
  writeFileSync(path.join(carpeta, `${ETIQUETA}-registro.txt`), registro.join('\n'));
  await navegador.close().catch(() => {});
  servidor.kill();
  console.log(`\n${bien} bien, ${mal} mal  (build/web/datos/red-estado/${ETIQUETA}.json)`);
  process.exit(mal ? 1 : 0);
}
