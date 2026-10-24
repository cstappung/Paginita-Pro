// Prueba con el juego de verdad: un jugador con la conexión mala no frena a los demás — bitácora §80.
//
// Resumen: abre la página del juego tres veces (tres computadores de la misma sala, cada uno con su malla WebRTC; el
// buzón es el falso del banco, BroadcastChannel) y corre UNA carrera directa (sin menús) con los tres humanos y 9 CPU.
// La pestaña C tiene la conexión mala de mentira EN LOS DOS SENTIDOS (?redMala=70,10,5,ida: 70 ms ± 10 de ida y 5 %
// perdido; malla.mjs). Los tres aceleran (y B dobla un rato). Durante 25 s de carrera se mide, en cada pestaña:
//   - cuadros por segundo de la carrera (estado().cuadros) y cuánto esperó por cuadro a los demás;
//   - su retraso (§80: cada uno el suyo) y si la autoridad (A) relevó a alguien.
// Se comprueba:
//   - A y B van a ~60 cuadros por segundo y casi no esperan: la conexión de C no los frena;
//   - C agranda SU retraso hasta cubrir su conexión (≥ 8 cuadros: 140 ms de ida y vuelta) y no menos que el de A (que
//     va derecho). Ojo: con tres juegos en la misma PC (12-14 ms de trabajo por cuadro de 16,7) cada pestaña tiene
//     tirones de verdad (B, que dobla, compila gráficos nuevos) y quien se traba paga su propio retraso: por eso no se
//     exige que el de C sea el más grande de todos (ver --red=0, el control sin red mala);
//   - las tres corren la misma carrera: las huellas (el avance de los 12 karts y, §80, los botones de cada cuadro)
//     coinciden y nadie se desincroniza; nadie se corta;
//   - si A relevó a C, C lo ve («Tu conexión o tu PC van lentas») y los demás también («jugador 3 va lento»);
//   - una traba de 1,5 s en B (la pestaña no atiende nada, como un tirón): el margen de la sala es 2 s, nadie se corta;
//   - una traba de 3 s en B: A y C lo cortan en el mismo cuadro y siguen; B lo ve («Se cortó tu conexión…»).
// Fotos y registros en build/web/datos/relevo/.
//
// Uso:  node web/navegador/prueba-relevo.mjs [--ventana] [--sin-relevo] [--red=70,10,5] [--puerto=8148] [--pista=0.0]
//       [--extra=&param=valor] (para las tres; p. ej. --extra=&sincroTiempo=0 = sin la sincronía de §80b)
//       [--trabas=N] (§101: la traba de 1,5 s de B, N veces en la misma carrera: cuánto esperó cada una y a quién)
//       (--sin-relevo: las tres con ?relevo=0, como antes de §80, para comparar: A y B esperan a C;
//        --red=0: sin red mala, el control: lo que cuesta correr tres juegos en la misma PC)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => (process.argv.find(a => a.startsWith(`--${n}=`)) || `--${n}=${def}`).slice(n.length + 3);
const PUERTO = Number(arg('puerto', 8148));
const RED = arg('red', '70,10,5');
const PISTA = arg('pista', '0.0');
const SIN_RELEVO = process.argv.includes('--sin-relevo');
const EXTRA = arg('extra', '');
const TRABAS = Math.max(1, Number(arg('trabas', 1)) || 1);
const carpeta = path.join(raiz, 'build/web/datos/relevo', (SIN_RELEVO ? 'sin-relevo' : RED === '0' ? 'control' : 'red-mala') + (EXTRA.includes('sincroTiempo=0') ? '-sin-sincro' : ''));
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const contexto = await navegador.newContext({ viewport: { width: 960, height: 540 } });
const sala = 'relevo-' + Date.now().toString(36);
const nombres = ['A', 'B', 'C'], uids = nombres.map(n => n.toLowerCase() + sala);
const registro = [];
const paginas = {};
async function abrir(n, k) {
  const p = paginas[n] = await contexto.newPage();
  p.on('pageerror', e => { console.log(`[${n}] [pageerror] ${e.message}`); registro.push(`[${n}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${n}] ${m.text().slice(0, 300)}`));
  const extra = (n === 'C' && RED !== '0' ? `&redMala=${RED},ida` : '') + (SIN_RELEVO ? '&relevo=0' : '');
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uids[k]}&sincro=${uids.join(',')}` +
    `&modo=directa&pista=${PISTA}&semilla=777&cpu=normal${extra}${EXTRA}`);
  return p;
}
const t0 = Date.now();
for (const [k, n] of nombres.entries()) { await abrir(n, k); await espera(2500); }

// (con tope de 10 s: si el hilo de la página quedó tomado, evaluate no vuelve nunca)
const leer = n => Promise.race([new Promise(r => setTimeout(() => r({ colgada: true }), 10000)), paginas[n].evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730);
  return { s: e.seccion, etapa: ri ? L.u32(ri + 0x28) : -1, ls: window.mkwSincro?.lockstep?.estado() || null, t: performance.now(),
    relevo: window.mkwAvisosRelevo || [], lento: window.mkwAvisosLento || [], corte: window.mkwAvisosCorte || [],
    ganada: window.mkw?._mkw_prisa_ganada?.() ?? null };
})]).catch(() => null);
const todas = async () => Object.fromEntries(await Promise.all(nombres.map(async n => [n, await leer(n)])));

// 1) las tres llegan a la carrera y empieza (etapa ≥ 2)
let x = {};
for (const limite = Date.now() + 6 * 60000; Date.now() < limite;) {
  x = await todas();
  if (nombres.every(n => (x[n]?.etapa ?? 0) >= 2 && x[n]?.s === 0x20)) break;
  await espera(1000);
}
ok('las tres llegaron a la carrera y empezó (sección 0x20, etapa ≥ 2)', nombres.every(n => (x[n]?.etapa ?? 0) >= 2),
  nombres.map(n => `${n} sección 0x${(x[n]?.s ?? 0).toString(16)} etapa ${x[n]?.etapa}`).join(', ') + ` (a los ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// 2) manejar: los tres aceleran; B dobla un rato. 5 s para que se acomode el retraso de cada uno y después 25 s medidos
for (const n of nombres) await paginas[n].keyboard.down('KeyK');
await espera(5000);
const antes = await todas();
await paginas.B.keyboard.down('KeyA'); await espera(1500); await paginas.B.keyboard.up('KeyA');
await espera(23500);
const ahora = await todas();
for (const n of nombres) await paginas[n].locator('#canvas').screenshot({ path: path.join(carpeta, `${n}.png`) }).catch(() => null);
for (const n of nombres) await paginas[n].keyboard.up('KeyK');

const med = n => {
  const a = antes[n]?.ls, b = ahora[n]?.ls;
  if (!a || !b) return { fps: 0, espera: 99 };
  const cuadros = b.cuadros - a.cuadros, ms = ahora[n].t - antes[n].t;
  return { fps: cuadros / (ms / 1000), espera: (b.msEsperando - a.msEsperando) / Math.max(1, cuadros), max: b.maxEspera, retraso: b.retraso,
    retrasoMax: b.retrasoMax?.[b.carrera], huellas: b.huellasIguales, desinc: b.desincronizado, cortes: b.cortes, relevados: b.relevadosAhora,
    relevos: b.relevos, inventados: b.inventados, viejos: b.inventadosViejos, autoridad: b.autoridad, esperaDe: b.esperaDe,
    retrasoMedio: b.retrasoMedio, frenos: b.frenos };
};
const m = Object.fromEntries(nombres.map(n => [n, med(n)]));
const fila = n => `${n} ${m[n].fps.toFixed(1)} cuadros/s, espera ${m[n].espera.toFixed(2)} ms/cuadro, retraso ${m[n].retraso} (máx ${m[n].retrasoMax}, promedio ${m[n].retrasoMedio?.toFixed(1)}${m[n].frenos ? `, frenos ${m[n].frenos}` : ''})`;
console.log('  ' + nombres.map(fila).join('\n  '));
console.log(`  autoridad ${m.A.autoridad}; relevos ${m.A.relevos}, relevados ahora ${JSON.stringify(m.A.relevados)}, inventados ${m.A.inventados} (viejos ${m.A.viejos}); A esperó a ${JSON.stringify(m.A.esperaDe)}`);

if (!SIN_RELEVO) {
  ok('A y B siguen a ~60 cuadros por segundo con la conexión de C mala (≥ 55)', m.A.fps >= 55 && m.B.fps >= 55, `${fila('A')} · ${fila('B')}`);
  ok('…y casi no esperan a nadie (< 2 ms por cuadro)', m.A.espera < 2 && m.B.espera < 2, `A ${m.A.espera.toFixed(2)}, B ${m.B.espera.toFixed(2)} ms`);
  ok('C paga su conexión: su retraso creció hasta cubrirla (≥ 8 cuadros) y no es menor que el de A', m.C.retraso >= 8 && m.C.retraso >= m.A.retraso,
    `A ${m.A.retraso}, B ${m.B.retraso}, C ${m.C.retraso} (C partió en ${ahora.C?.ls?.retrasos?.[ahora.C?.ls?.carrera]}, máx ${m.C.retrasoMax})`);
} else {
  ok('sin relevo (?relevo=0): informativo, A y B frente a C', true, `${fila('A')} · ${fila('B')} · ${fila('C')}`);
}
ok('las tres corren la misma carrera: huellas (karts y botones) iguales, sin desincronizar ni cortes',
  nombres.every(n => m[n].huellas >= 6 && !m[n].desinc && !Object.keys(m[n].cortes || {}).length),
  nombres.map(n => `${n} ${m[n].huellas}${m[n].desinc ? ' DESINCRONIZADO ' + JSON.stringify(m[n].desinc) : ''}`).join(', '));
const relevaronC = (ahora.A?.relevo || []).some(t => t.includes('jugador 3'));
const vioC = (ahora.C?.relevo || []).some(t => t.includes('Tu conexión o tu PC van lentas'));
ok('los avisos del relevo calzan: si A vio «jugador 3 va lento», C vio «Tu conexión o tu PC van lentas» (y al revés)', relevaronC === vioC,
  `A: ${[...new Set(ahora.A?.relevo || [])].join(' / ') || 'ninguno'} · C: ${[...new Set(ahora.C?.relevo || [])].join(' / ') || 'ninguno'}`);
ok('nadie avisó «la sala va lenta» en A ni en B', !(ahora.A?.lento || []).length && !(ahora.B?.lento || []).length,
  `A: ${(ahora.A?.lento || []).slice(-1)} · B: ${(ahora.B?.lento || []).slice(-1)}`);

// 3) las trabas de B (con los karts sueltos): el hilo de la página tomado por un bucle, como un tirón de la PC o una
// pestaña que el navegador congela un rato. 1,5 s: menos que el margen (2 s), nadie se corta. §99 (C1), el relevo
// rápido (salvo --extra=&relevoRapido=0): A y C ni siquiera lo esperan: lo pausan a los ~150 ms y B vuelve a manejar
const RAPIDO = !EXTRA.includes('relevoRapido=0');
const traba = ms => paginas.B.evaluate(ms => { const t = performance.now(); while (performance.now() - t < ms); }, ms).catch(() => {});
const t1 = await todas();
await traba(1500); await espera(4000);
const t2 = await todas();
// (lo que esperó en el rato de la traba: msEsperando es la suma de la carrera; maxEspera es el máximo de toda la carrera)
const esperaEn = (a, b, n) => Math.max(0, (b[n]?.ls?.msEsperando || 0) - (a[n]?.ls?.msEsperando || 0));
ok(RAPIDO ? 'una traba de 1,5 s en B: A y C lo pausan (esperan menos que la traba), nadie se corta y B vuelve a manejar'
          : 'una traba de 1,5 s en B (como un tirón): nadie se corta y la carrera sigue en las tres',
  nombres.every(n => !Object.keys(t2[n]?.ls?.cortes || {}).length && !t2[n]?.ls?.fuera && (t2[n]?.ls?.cuadro || 0) > (t1[n]?.ls?.cuadro || 0) + 100) &&
  // (C, la de la red mala, espera de por sí más —le llega todo tarde—: menos de 1,2 s; sin el relevo rápido, los 1,5 s)
  // (medido: A 317-1075 ms según la corrida, con tres juegos en la misma PC; sin el relevo rápido, los 1,5 s enteros más
  // lo que tenía guardado de B. C, la de la red mala, espera de por sí más)
  (!RAPIDO || (esperaEn(t1, t2, 'A') < 1200 && esperaEn(t1, t2, 'C') < 1400 && (t2.A?.ls?.vueltas || 0) >= 1)),
  nombres.map(n => `${n} ${t1[n]?.ls?.cuadro}→${t2[n]?.ls?.cuadro} (esperó ${esperaEn(t1, t2, n).toFixed(0)} ms en el rato, ganó al ponerse al día ${Math.round(t2[n]?.ganada ?? -1)} ms, esperó a ${JSON.stringify(Object.fromEntries(Object.entries(t2[n]?.ls?.esperaDe || {}).map(([u, v]) => [u.slice(0, 1), Math.round(v - (t1[n]?.ls?.esperaDe?.[u] || 0))])))}, pausas ${JSON.stringify((t2[n]?.ls?.pausas || []).map(p => p.desde))}, vueltas ${t2[n]?.ls?.vueltas || 0})`).join(', '));
// §101: más trabas de 1,5 s (--trabas=N): la espera de cada una, a quién y desde qué cuadro se pausó a B. Para ver de
// dónde sale lo que varía entre corridas (0,3 a 1,1 s)
const esperasA = [esperaEn(t1, t2, 'A')], esperasC = [esperaEn(t1, t2, 'C')];
const deQuien = (a, b, n) => Object.fromEntries(Object.entries(b[n]?.ls?.esperaDe || {}).map(([u, v]) => [u.slice(0, 1).toUpperCase(), Math.round(v - (a[n]?.ls?.esperaDe?.[u] || 0))]));
let tAntes = t2;
for (let k = 2; k <= TRABAS; k++) {
  await traba(1500); await espera(4000);
  const tk = await todas();
  esperasA.push(esperaEn(tAntes, tk, 'A')); esperasC.push(esperaEn(tAntes, tk, 'C'));
  console.log(`  traba ${k}: A esperó ${esperaEn(tAntes, tk, 'A').toFixed(0)} ms ${JSON.stringify(deQuien(tAntes, tk, 'A'))}, C ${esperaEn(tAntes, tk, 'C').toFixed(0)} ms ${JSON.stringify(deQuien(tAntes, tk, 'C'))}; pausas ${JSON.stringify((tk.A?.ls?.pausas || []).map(p => p.desde).slice(-1))}, cortes ${JSON.stringify(tk.A?.ls?.cortes || {})}`);
  tAntes = tk;
}
if (TRABAS > 1) {
  const orden = v => [...v].sort((a, b) => a - b), med = v => orden(v)[Math.floor(v.length / 2)];
  console.log(`  ${TRABAS} trabas de 1,5 s: A esperó ${orden(esperasA).map(x => x.toFixed(0)).join(', ')} ms (mediana ${med(esperasA).toFixed(0)}); C ${orden(esperasC).map(x => x.toFixed(0)).join(', ')} ms (mediana ${med(esperasC).toFixed(0)})`);
  ok(`§101: en ${TRABAS} trabas de 1,5 s, A espera siempre menos de 600 ms (el relevo rápido no depende de la suerte)`, Math.max(...esperasA) < 600,
     `A ${orden(esperasA).map(x => x.toFixed(0)).join(', ')} ms`);
}
// 3 s: más que el margen; A y C lo cortan (en el mismo cuadro) y siguen; B, al despertar, ve que lo cortaron
await traba(3000); await espera(5000);
const t3 = await todas();
const corteA = t3.A?.ls?.cortes?.[1], corteC = t3.C?.ls?.cortes?.[1];
// (con --trabas, la 3 s compara con lo de después de la última traba de 1,5 s)
const t2b = tAntes;
if (RAPIDO) {
  // (§99, C1: con 3 s tampoco se lo corta —antes, pasado el margen de 2 s, sí—: se lo pausa y vuelve)
  ok('una traba de 3 s en B: A y C lo pausan (no lo esperan ni lo cortan), siguen iguales y B vuelve a manejar',
    corteA === undefined && corteC === undefined && (t3.A?.ls?.cuadro || 0) > (t2b.A?.ls?.cuadro || 0) + 200 && !t3.A?.ls?.desincronizado && !t3.C?.ls?.desincronizado &&
    !t3.B?.ls?.fuera && (t3.A?.ls?.vueltas || 0) >= 2,
    `cortes A ${JSON.stringify(t3.A?.ls?.cortes)}; A ${t2.A?.ls?.cuadro}→${t3.A?.ls?.cuadro}; pausas ${JSON.stringify((t3.A?.ls?.pausas || []).map(p => p.desde))}, vueltas ${t3.A?.ls?.vueltas}; B fuera ${t3.B?.ls?.fuera}`);
  ok('…y B lo ve en su página (su kart siguió solo un momento)',
    (t3.B?.relevo || []).some(t => /siguió solo un momento/.test(t)),
    `avisos de B: ${[...new Set(t3.B?.relevo || [])].slice(-3).join(' / ') || 'ninguno'}`);
} else {
  ok('una traba de 3 s en B (más que el margen de 2 s): A y C lo cortan en el mismo cuadro y siguen',
    corteA !== undefined && corteA === corteC && (t3.A?.ls?.cuadro || 0) > (t2.A?.ls?.cuadro || 0) + 200 && !t3.A?.ls?.desincronizado && !t3.C?.ls?.desincronizado,
    `corte de B: A ${corteA}, C ${corteC}; A ${t2.A?.ls?.cuadro}→${t3.A?.ls?.cuadro}`);
  ok('…y B lo ve en su página (no queda con la carrera quieta sin explicación)',
    (t3.B?.ls?.cortado || t3.B?.ls?.fuera) && (t3.B?.relevo || []).some(t => /Se cortó tu conexión|Te desconectaste/.test(t)),
    `B cortado ${t3.B?.ls?.cortado}, fuera ${t3.B?.ls?.fuera}; avisos: ${[...new Set(t3.B?.relevo || [])].slice(-2).join(' / ') || 'ninguno'}`);
}
await paginas.B.locator('#canvas').screenshot({ path: path.join(carpeta, 'B-cortado.png') }).catch(() => null);

writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
for (const n of nombres) writeFileSync(path.join(carpeta, `red-${n}.txt`), await paginas[n].evaluate(() => window.mkwRed?.registro.join('\n')).catch(() => ''));
writeFileSync(path.join(carpeta, 'medidas.json'), JSON.stringify({ red: RED, sinRelevo: SIN_RELEVO, medidas: m }, null, 1));
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (registro en ${path.relative(raiz, carpeta).replaceAll('\\', '/')}/)`);
process.exit(mal ? 1 : 0);
