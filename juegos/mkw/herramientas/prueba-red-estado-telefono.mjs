// El piloto «host + predicción» entre aparatos de verdad: este PC + el celular del dueño por el cable USB (bitácora §275).
//
// Resumen: como web/navegador/prueba-red-estado.mjs (dos consolas con ?red=estado = la red nativa del juego, RKNet, por
// la malla WebRTC), pero la consola B es el teléfono. Todo lo que toca el teléfono va por el marco seguro
// (herramientas/telefono-seguro.mjs: lista blanca de órdenes, pestaña de incógnito que se borra al cerrarla, limpieza
// garantizada, foto antes/después, vigía del calor, la pantalla prendida con el cable y devuelta exacta). La pestaña del
// teléfono va al frente, a pantalla real y con el medidor de fps. La señal del banco cruza entre los dos navegadores por
// herramientas/puente-contextos.mjs; la carrera va por WebRTC entre el PC y el teléfono.
// En la carrera: el PC acelera con su tecla, el teléfono con el dedo en el botón A de la pantalla (toques de verdad por
// DevTools en esa pestaña). La sonda (red-estado.mjs) anota en cada cuadro de lógica la posición de cada kart. Se mide:
//   - el error del kart remoto (el del PC visto en el teléfono contra el del PC en el PC, a la misma hora: los relojes de
//     los dos aparatos se emparejan con idas y vueltas por DevTools, la de menor demora) y el atraso de la vista;
//   - el botón propio: cada uno suelta el acelerador una vez; cuántos cuadros tarda su kart en frenar (0 = sin esperar);
//   - los cuadros de lógica por segundo de cada aparato (¿el teléfono frena al PC?) y la ventaja del PC: cuántos cuadros
//     de carrera lleva el PC delante del teléfono cada 2 s (en el lockstep de hoy, el dueño vio «el pc le gana por 2 s»);
//   - cuánto avanza cada kart por segundo de reloj (¿el lento corre en cámara lenta?) y los avisos de «frame lag» de RR.
// Uso:  MKW_BUILD=build/web-274/navegador node herramientas/prueba-red-estado-telefono.mjs [--segundos 20] [--extra-b "&…"]
//   (el teléfono con la depuración USB y Chrome abierto; TELEFONO_ADB=ruta de adb.exe; con el candado de medición)
// Salida: build/web/datos/telefono/<fecha>/red-estado.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { dedos, manejar } from './piloto-ruta.mjs';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';
import { errorTrayectoria, atrasoDeVista, ritmo, cuadrosDeRespuesta, distancia, posicionEn } from '../web/navegador/red-estado.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = 8140;                    // el que el teléfono ve como su propio 127.0.0.1 (el túnel del cable)
const SEGUNDOS = Number(opcion('--segundos', 20)), EXTRA_B = opcion('--extra-b', '');
// la carrera, fijada por código (la anfitriona decide; sin ruleta y con 5 s de votación): por omisión Luigi Circuit a 150cc
const CARRERA = opcion('--carrera', '&estilo=playlist&pistas=0.0&cc=c150&eleccion=5');
const carpeta = path.join('build', 'web', 'datos', 'telefono', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
fs.mkdirSync(carpeta, { recursive: true });
const lineas = [];
const registro = l => { lineas.push(`${new Date().toISOString()} ${l}`); fs.writeFileSync(path.join(carpeta, 'registro.txt'), lineas.join('\n') + '\n'); };
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; const l = `${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`; console.log(l); registro(l); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();
const resultado = { segundos: SEGUNDOS, extraB: EXTRA_B };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const adb = crearAdb({ ejecutable: buscarAdb(), puertos: [PUERTO], registro });

const etapa = p => Promise.race([espera(10000).then(() => ({ colgada: true })), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null; const ri = L.u32(0x809BD730);
  return { s: e.seccion, etapa: ri ? L.u32(ri + 0x28) : -1, logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : 0, sonda: !!window.mkwRedEstado };
})]).catch(() => null);
// la diferencia entre el reloj del teléfono y el del PC (ms): varias idas y vueltas, la de menor demora
async function desfase(p) {
  let mejor = null;
  for (let i = 0; i < 12; i++) {
    const t0 = Date.now(); const tp = await p.evaluate(() => performance.timeOrigin + performance.now()).catch(() => null); const t1 = Date.now();
    if (tp !== null && (!mejor || t1 - t0 < mejor.rtt)) mejor = { rtt: t1 - t0, ms: tp - (t0 + t1) / 2 };
    await espera(50);
  }
  return mejor;
}
async function carrera(A, B) {
  const r = {};
  B.on('crash', () => { r.caida = new Date().toISOString(); console.log('  ✗ la pestaña del teléfono se cayó'); });
  const t0 = Date.now(), llego = { A: null, B: null }, aviso = { A: 0, B: 0 };
  for (; Date.now() < t0 + 8 * 60000 && !(llego.A && llego.B);) {
    for (const [n, p] of [['A', A], ['B', B]]) {
      const e = await etapa(p);
      if (!llego[n] && e?.s === 0x68 && e.etapa >= 1) { llego[n] = Math.round((Date.now() - t0) / 1000); console.log(`  ${n === 'A' ? 'PC' : 'teléfono'}: en la carrera a los ${llego[n]} s`); }
      if (Date.now() > aviso[n]) { aviso[n] = Date.now() + 15000; console.log(`  … ${n === 'A' ? 'PC' : 'teléfono'}: ${JSON.stringify(e)}`); }
    }
    await espera(1000);
  }
  r.llego = llego;
  ok('el PC y el teléfono llegaron a la carrera en línea (la red nativa por la malla)', !!(llego.A && llego.B), JSON.stringify(llego));
  if (!(llego.A && llego.B)) return r;
  const dB = await dedos(B), qa = await dB.boton('A');
  ok('teléfono: el mando en pantalla está puesto', !!qa);
  await A.keyboard.down('KeyK'); if (qa) await dB.poner(1, qa);
  await A.waitForFunction(() => { const L = window.mkwMenus, ri = L.u32(0x809BD730); return ri && L.u32(ri + 0x28) >= 2; }, null, { timeout: 30000, polling: 100 }).catch(() => {});
  // el botón propio, apenas largan (el kart acelera derecho: sin paredes, la frenada se ve clara): a 1,5 s del «¡YA!»
  // los dos sueltan el acelerador 1 s y lo vuelven a apretar
  const desde = Date.now();
  await espera(1500);
  const [fSueltaA, fSueltaB] = await Promise.all([
    (async () => { const f = await A.evaluate(() => window.mkwRedEstado.marcar('suelta')); await A.keyboard.up('KeyK'); await espera(1000); await A.keyboard.down('KeyK'); return f; })(),
    (async () => { const f = await B.evaluate(() => window.mkwRedEstado.marcar('suelta')); await dB.levantar(1); await espera(1000); if (qa) await dB.poner(1, qa); return f; })()]);
  r.desfaseAntes = await desfase(B);
  // el resto, manejando por la ruta de la pista (piloto-ruta.mjs): dobla, derrapa, frena en las curvas y retrocede si se traba
  const yoA = await A.evaluate(() => window.mkwRedEstado.ultima()?.propio ?? 0), yoB = await B.evaluate(() => window.mkwRedEstado.ultima()?.propio ?? 1);
  const pararA = manejar(A, null, yoA), pararB = manejar(B, dB, yoB);
  // la ventaja del PC: cada 2 s, el cuadro de la carrera de las dos consolas leído en el mismo instante
  let muestreando = true; r.adelantoPC = [];
  const muestreo = (async () => { while (muestreando) { const [a, b] = await Promise.all([etapa(A), etapa(B)]);
    if (a?.logica && b?.logica) r.adelantoPC.push(a.logica - b.logica); await espera(2000); } })();
  await espera(SEGUNDOS * 1000);
  muestreando = false; await muestreo;
  r.manejo = { PC: await pararA(), telefono: await pararB() };
  await A.keyboard.up('KeyK'); await dB.soltarTodo();
  r.desfaseDespues = await desfase(B);
  await A.screenshot({ path: path.join(carpeta, 'red-estado-PC.png') }).catch(() => {});
  // lo medido: la hora del teléfono pasada a la del PC
  const dms = ((r.desfaseAntes?.ms ?? 0) + (r.desfaseDespues?.ms ?? r.desfaseAntes?.ms ?? 0)) / 2;
  const mA = await A.evaluate(d => window.mkwRedEstado.muestras(d), desde).catch(() => []);
  const mB = (await B.evaluate(d => window.mkwRedEstado.muestras(d), desde + dms).catch(() => [])).map(s => ({ ...s, t: s.t - dms }));
  const propioA = mA.at(-1)?.propio, propioB = mB.at(-1)?.propio;
  r.n = { A: mA.length, B: mB.length }; r.propio = { A: propioA, B: propioB };
  ok('las dos sondas anotaron la carrera', mA.length > 200 && mB.length > 100, JSON.stringify(r.n));
  ok('cada aparato maneja un kart distinto', Number.isInteger(propioA) && Number.isInteger(propioB) && propioA !== propioB, `PC ${propioA}, teléfono ${propioB}`);
  r.ritmo = { PC: ritmo(mA.map(s => ({ t: s.t, f: s.f }))), telefono: ritmo(mB.map(s => ({ t: s.t, f: s.f }))) };
  ok('el PC sigue a ~60 cuadros de lógica por segundo (el teléfono no lo frena)', r.ritmo.PC >= 57, `PC ${r.ritmo.PC?.toFixed(1)}/s, teléfono ${r.ritmo.telefono?.toFixed(1)}/s`);
  const tray = (m, i) => m.filter(s => s.karts[i]).map(s => ({ t: s.t, f: s.f, pos: s.karts[i] }));
  const vA = tray(mA, propioA), vAenB = tray(mB, propioA), vB = tray(mB, propioB), vBenA = tray(mA, propioB);
  r.errorPCenTelefono = errorTrayectoria(vA, vAenB); r.atrasoPCenTelefono = atrasoDeVista(vA, vAenB, { maxMs: 1500, pasoMs: 8 });
  r.errorTelefonoEnPC = errorTrayectoria(vB, vBenA); r.atrasoTelefonoEnPC = atrasoDeVista(vB, vBenA, { maxMs: 1500, pasoMs: 8 });
  const fmt = e => e?.n ? `medio ${e.medio.toFixed(0)}, p90 ${e.p90.toFixed(0)}, máx ${e.max.toFixed(0)} (n ${e.n})` : 'sin datos';
  const vel = tr => { const v = [], vf = []; for (let i = 0, j = 0; i < tr.length; i++) { while (j < tr.length && tr[j].t < tr[i].t + 500) j++; if (j >= tr.length) break;
    const d = distancia(tr[i].pos, tr[j].pos); v.push(d / ((tr[j].t - tr[i].t) / 1000)); if (tr[j].f > tr[i].f) vf.push(d / (tr[j].f - tr[i].f)); }
    const med = x => x.length ? [...x].sort((a, b) => a - b)[x.length >> 1] : null; return { porSegundo: med(v), porCuadro: med(vf) }; };
  // el atraso medido solo donde el kart de verdad se mueve (más de 3000 unidades/s, ~30 m/s): quieto, cualquier atraso «calza»
  const moviendo = (v, vista) => vista.filter(x => { const a = posicionEn(v, x.t), b = posicionEn(v, x.t - 100); return a && b && distancia(a, b) > 300; });
  r.atrasoMovPCenTelefono = atrasoDeVista(vA, moviendo(vA, vAenB), { maxMs: 1500, pasoMs: 8 }); r.errorMovPCenTelefono = errorTrayectoria(vA, moviendo(vA, vAenB));
  r.atrasoMovTelefonoEnPC = atrasoDeVista(vB, moviendo(vB, vBenA), { maxMs: 1500, pasoMs: 8 }); r.errorMovTelefonoEnPC = errorTrayectoria(vB, moviendo(vB, vBenA));
  console.log(`  con el kart andando: PC visto en el teléfono atraso ${r.atrasoMovPCenTelefono.ms} ms, ${fmt(r.errorMovPCenTelefono)}; teléfono visto en el PC atraso ${r.atrasoMovTelefonoEnPC.ms} ms, ${fmt(r.errorMovTelefonoEnPC)}`);
  r.velPC = vel(vA); r.velTelefono = vel(vB);
  console.log(`  kart del PC visto en el teléfono: ${fmt(r.errorPCenTelefono)}; atraso ${r.atrasoPCenTelefono.ms} ms`);
  console.log(`  kart del teléfono visto en el PC: ${fmt(r.errorTelefonoEnPC)}; atraso ${r.atrasoTelefonoEnPC.ms} ms`);
  console.log(`  velocidad: PC ${r.velPC.porSegundo?.toFixed(0)}/s, teléfono ${r.velTelefono.porSegundo?.toFixed(0)}/s · desfase de relojes ${dms.toFixed(0)} ms (ida y vuelta ${r.desfaseAntes?.rtt} ms)`);
  console.log(`  ventaja del PC en cuadros de carrera cada 2 s: ${r.adelantoPC.join(' ')}`);
  ok('el kart del PC se ve moverse en el teléfono', r.errorPCenTelefono.n > 50 && r.atrasoPCenTelefono.ms < 1000, `atraso ${r.atrasoPCenTelefono.ms} ms`);
  ok('el kart del teléfono se ve moverse en el PC', r.errorTelefonoEnPC.n > 50 && r.atrasoTelefonoEnPC.ms < 1000, `atraso ${r.atrasoTelefonoEnPC.ms} ms`);
  const propias = (m, i) => m.filter(s => s.karts[i]).map(s => ({ f: s.f, pos: s.karts[i] }));
  r.respuesta = { PC: cuadrosDeRespuesta(propias(mA, propioA), fSueltaA), telefono: cuadrosDeRespuesta(propias(mB, propioB), fSueltaB) };
  ok('PC: el kart propio responde al botón sin esperar a la red (≤ 1 cuadro)', r.respuesta.PC !== null && r.respuesta.PC <= 1, String(r.respuesta.PC));
  ok('teléfono: el kart propio responde al dedo sin esperar a la red (≤ 1 cuadro)', r.respuesta.telefono !== null && r.respuesta.telefono <= 1, String(r.respuesta.telefono));
  r.informeTelefono = await B.evaluate(() => window.mkwInformeRendimiento?.()?.ultimos10s ?? null).catch(() => null);
  r.frameLag = await B.evaluate(() => (window.mkwEstado?.log || []).filter(t => /frame lag/i.test(String(t))).slice(-5).map(String)).catch(() => []);
  r.muestras = { PC: mA, telefono: mB };
  return r;
}

const cortes = { aviso: m => { console.log('  [teléfono] ' + m); registro('[teléfono] ' + m); }, esperar: ms => espera(ms),
  conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx), pantalla: true, recuerdo: recuerdoPantalla() };
try {
  const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
  const navegador = await chromium.launch({ channel: 'chrome', headless: false,
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
  try {
    const sala = 're' + Date.now().toString(36);
    const q = (uid, extra) => `/?auto=1&red=estado&senal=canal&sala=${sala}&uid=${uid}${CARRERA}${extra}`;
    const ctxA = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
    await puente.agregar(ctxA);
    const A = await ctxA.newPage();
    A.on('pageerror', e => console.log('[PC] [pageerror] ' + e.message));
    await A.goto(`http://127.0.0.1:${PUERTO}${q('a' + sala, '&nodo=2&anfitrion=1')}`);
    await A.waitForFunction(() => window.mkwRed?.presentador && window.mkwRedEstado, null, { timeout: 60000 });
    await A.evaluate(() => window.mkwRed.presentador.presentar({ vr: 5000, br: 5000 }));
    const x = await abrir({ adb, puertos: [PUERTO], segundos: 1500, ...cortes, ruta: q('b' + sala, '&nodo=3' + EXTRA_B), alContexto: ctx => puente.agregar(ctx), durante: B => carrera(A, B) });
    resultado.carrera = x.durante;
    ok('el teléfono quedó igual que antes (apps y ajustes)', !!x?.cambios?.igual, x?.cambios ? JSON.stringify(x.cambios).slice(0, 300) : 'sin la foto de después');
    resultado.corrida = { motivo: x?.motivo, historial: x?.historial, informe: x?.informe, consola: x?.consola?.slice(-200) };
  } finally { await navegador.close().catch(() => {}); }
} catch (e) { ok('la prueba corrió entera', false, e.message); }
finally { servidor.kill(); }
fs.writeFileSync(path.join(carpeta, 'red-estado.json'), JSON.stringify(resultado));
console.log(`\n${bien} bien, ${mal} mal  (${carpeta})`);
process.exit(mal ? 1 : 0);
