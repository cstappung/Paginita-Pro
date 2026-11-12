// La última vuelta EN LA SALA, como la vivió el dueño (bitácora §269, bug 2: «en la vuelta 3 está descargando a Lakitu»,
// visto en el multijugador).
//
// Resumen: prueba-vuelta-final mira la vuelta 3 con un jugador o con la carrera directa sincronizada (?modo=directa con
// sincro). Pero la sala de verdad (?modo=sala, una copa) pide lo de cada carrera por OTRO camino: el paquete se pide con
// la ficha que manda la anfitriona (`pedirFicha`) y con la pista que viene (`pedirPista`), y la 2.ª carrera llega
// después del descanso. Esta prueba hace eso: dos perfiles NUEVOS (caché vacía, sin lo aprendido), la anfitriona fija una
// copa de 2 pistas, cada una elige personaje con las pantallas del juego, y en la cuenta de CADA carrera las dos
// consolas ponen el contador de vueltas de los dos humanos en la última (como prueba-vuelta-final: al cruzar la raya,
// empieza la vuelta 3, con Lakitu, su cartel, la fanfarria y la música rápida). Las dos aceleran 25 s en la última vuelta
// y se mira, en cada pestaña y en cada carrera, qué fue a la RED con la carrera andando (window.mkwRedEnCarrera(), §176:
// cada pedido con la etapa de ese momento; etapa 2 = carrera andando) y qué leyó el juego (?trazaDisco=1).
// La regla (§176 D1): 0 pedidos con la carrera andando, en las dos pestañas y en las dos carreras.
// Uso:  MKW_BUILD=build/web-final-w30/navegador node herramientas/prueba-vuelta-sala.mjs [--pistas 0.0,13.2] [--red-b 50,20]
//       [--extra "&…"] [--puerto 8179] [--ventana]
//   --red-b LAT,MBIT = la pestaña B (la que no es anfitriona) con esa red (ms de latencia, Mbit/s de bajada), por CDP.
// Salida: build/web/datos/vuelta-final/sala-<pistas>[-redb].json (nombres de archivos del juego: nunca a git)
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = Number(opcion('--puerto', 8179)), EXTRA = opcion('--extra', '');
const PISTAS = opcion('--pistas', '0.0,13.2').split(',').map(s => { const [copa, fila] = s.split('.').map(Number); return { copa, fila }; });
const RED_B = opcion('--red-b', null)?.split(',').map(Number) || null;
const SEGUNDOS = 25;
const carpeta = path.join(raiz, 'build/web/datos/vuelta-final');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: process.env.MKW_LATENCIA || '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
const sala = 'vs' + Date.now().toString(36), uidA = 'A' + sala, uidB = 'B' + sala;
const pestanas = [];
for (const [n, uid] of [['A', uidA], ['B', uidB]]) {
  const ctx = await navegador.newContext({ viewport: { width: 1000, height: 600 } });   // (perfil nuevo: sin caché ni lo aprendido)
  await puente.agregar(ctx);   // (§269: la señal del banco cruza entre perfiles: herramientas/puente-contextos.mjs)
  const p = await ctx.newPage();
  if (n === 'B' && RED_B) {
    const c = await ctx.newCDPSession(p);
    await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: RED_B[0], downloadThroughput: RED_B[1] * 1e6 / 8, uploadThroughput: 5e6 / 8 });
  }
  const consola = [];
  p.on('console', m => consola.push(m.text()));
  p.on('pageerror', e => console.log(`[${n}] [pageerror] ` + e.message));
  // (&huella=0: cada consola escribe las vueltas en un cuadro algo distinto; la huella compararía eso. &descanso=12: el
  // descanso corto, solo pruebas)
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uid}&sincro=${uidA},${uidB}&jefe=${uidA}` +
    `&semilla=777&modo=sala&estilo=copa&carreras=${PISTAS.length}&cc=c150&cpu=normal&trazaDisco=1&huella=0&descanso=12${EXTRA}`);
  pestanas.push({ n, p, consola });
  await espera(2000);
}
const [A, B] = pestanas.map(t => t.p);
const leer = p => p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730);
  const humanos = [0, 1].map(k => { try { const yo = L.u32(L.u32(ri + 0xC) + 4 * k); return yo ? [L.u16(yo + 0x24), L.u8(yo + 0x26)] : null; } catch { return null; } });
  return { s: e.seccion, pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, humanos, eleccion: window.mkwEstado.eleccion || null,
    cortina: !document.body.classList.contains('sin-cortina'), picker: !!document.getElementById('elegirPista'), sala: window.mkwEstado.sala || null,
    cuadro: window.mkwSincro?.lockstep?.estado?.().cuadro ?? 0, red: (window.mkwRedEnCarrera?.() || []).length };
}).catch(() => null);
const esperarQue = async (p, f, tope = 120000) => { for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x && f(x)) return x; await espera(400); } return leer(p); };

// 1) la copa (la anfitriona la fija con lo mismo que hace el selector al confirmar)
await esperarQue(A, x => x.picker, 240000);
const puso = await A.evaluate(c => window.mkwSala.ponerPistas(c), PISTAS);
ok('la anfitriona fija la copa', puso === true, JSON.stringify(PISTAS));
// 2) cada una elige personaje con las pantallas del juego (A apretado cada 1,2 s; B se corre a la derecha)
const elegir = async (p, derecha) => {
  let visto = false, ultimo = 0;
  for (const h = Date.now() + 120000; Date.now() < h;) {
    const x = await leer(p);
    if (x?.eleccion) return x;
    if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
      if (!visto && x.pagina === 0x6B) { visto = true; await espera(700); if (derecha) { await p.keyboard.down('KeyD'); await espera(150); await p.keyboard.up('KeyD'); await espera(400); } }
      if (Date.now() - ultimo > 1200) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
    }
    await espera(300);
  }
  return leer(p);
};
const [ea, eb] = await Promise.all([elegir(A, false), elegir(B, true)]);
ok('las dos eligieron personaje', !!(ea?.eleccion && eb?.eleccion));

// 3) cada carrera: en la cuenta, las vueltas de los dos humanos en la última; acelerar; 25 s en la última vuelta
// (en la cuenta: +2 a los dos humanos, así al cruzar la raya de la largada empieza la última, con Lakitu y su cartel —
// medido en 0.0—; si 5 s después alguno no está en la 3 —13.2 cuenta distinto—, se la pone en 3 a mano)
const sumarVueltas = p => p.evaluate(() => {
  const L = window.mkwMenus, ri = L.u32(0x809BD730), r = [];
  for (const k of [0, 1]) { const yo = L.u32(L.u32(ri + 0xC) + 4 * k); const v = L.u16(yo + 0x24), m = L.u8(yo + 0x26); L.w8(yo + 0x25, v + 2); L.w8(yo + 0x26, m + 2); r.push([v, m]); }
  return r;
});
const ponerUltima = p => p.evaluate(() => {
  const L = window.mkwMenus, ri = L.u32(0x809BD730), r = [];
  for (const k of [0, 1]) { const yo = L.u32(L.u32(ri + 0xC) + 4 * k); r.push(L.u16(yo + 0x24)); if (L.u16(yo + 0x24) < 3) { L.w8(yo + 0x25, 3); L.w8(yo + 0x26, 3); } }
  return r;
});
const datos = [];
for (let carrera = 1; carrera <= PISTAS.length; carrera++) {
  const pista = `${PISTAS[carrera - 1].copa}.${PISTAS[carrera - 1].fila}`;
  // (la carrera n: sección de carrera y la cuenta; la red anotada hasta acá no cuenta para esta carrera)
  const inicio = await Promise.all([A, B].map(p => esperarQue(p, x => x.sala?.fase === 'correr' && x.sala?.carrera === carrera && x.s === 0x20 && x.etapa >= 0 && x.etapa <= 1 && x.humanos?.every(h => h && h[0] <= 1), 300000)));
  const red0 = await Promise.all([A, B].map(p => p.evaluate(() => (window.mkwRedEnCarrera?.() || []).length).catch(() => 0)));
  const cons0 = pestanas.map(t => t.consola.length);
  // las vueltas: apenas arranca la carrera (la raya de la largada ya pasó para el que está en la parrilla: se ponen en 3
  // directo, en las dos consolas, en cuanto la etapa es 2)
    const sumadas = await Promise.all([A, B].map(sumarVueltas));
  await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa === 2, 120000)));
  for (const p of [A, B]) await p.keyboard.down('KeyK');
  await espera(5000);
  const puestas = [sumadas, await Promise.all([A, B].map(ponerUltima))];
  const ultima = await Promise.all([A, B].map(p => esperarQue(p, x => x.humanos?.every(h => h?.[0] >= 3), 20000)));
  console.log(`  carrera ${carrera} (${pista}): vueltas antes ${JSON.stringify(puestas)} → ${JSON.stringify(ultima.map(x => x?.humanos))}`);
  // ¿se ve la barra de descarga? (cada 250 ms, en las dos)
  const barra = [0, 0];
  for (const h = Date.now() + SEGUNDOS * 1000; Date.now() < h;) {
    for (const [i, p] of [A, B].entries()) barra[i] += await p.evaluate(() => { const b = document.getElementById('descarga'); return b && !b.hidden && getComputedStyle(b).display !== 'none' && b.offsetWidth > 0 ? 1 : 0; }).catch(() => 0);
    await espera(250);
  }
  const fin = await Promise.all([A, B].map(leer));
  for (const p of [A, B]) await p.keyboard.up('KeyK');
  for (const [i, t] of pestanas.entries()) {
    const red = (await t.p.evaluate(() => window.mkwRedEnCarrera?.() || []).catch(() => [])).slice(red0[i]);
    const andando = red.filter(r => r[5] === 2);
    const lecturas = t.consola.slice(cons0[i]).filter(l => l.startsWith('[lee] '));
    const archivos = {};
    for (const l of lecturas) { const [, , c, ruta, , largo] = l.split(' '); const a = archivos[ruta] || (archivos[ruta] = { lecturas: 0, bytes: 0, primera: +c }); a.lecturas++; a.bytes += +largo; }
    const pip = { pedidos: 0, golpe: 0, nuevos: 0 };
    for (const l of t.consola.slice(cons0[i])) {
      const y = /^\[pipelines\] (\d+) pedidos .* (\d+) armados en el momento/.exec(l); if (y) { pip.pedidos += +y[1]; pip.golpe += +y[2]; }
      const z = /el juego pidió \d+ de la cola, \d+ de la lista esperando, (\d+) nuevos/.exec(l); if (z) pip.nuevos += +z[1];
    }
    console.log(`  ${t.n} carrera ${carrera}: a la red en la carrera: ${red.length} pedidos (${andando.length} con la carrera andando) · leyó ${Object.keys(archivos).length} archivos · pipelines ${pip.pedidos} pedidos, ${pip.golpe} de golpe, ${pip.nuevos} nuevos · barra ${barra[i]} veces`);
    for (const r of andando.slice(0, 15)) console.log('    ' + JSON.stringify(r).slice(0, 220));
    datos.push({ carrera, pista, pestana: t.n, red, archivos, pip, barra: barra[i], fin: fin[i] });
    ok(`${t.n} (${t.n === 'A' ? 'anfitriona' : 'invitada'}${t.n === 'B' && RED_B ? `, red ${RED_B[0]} ms y ${RED_B[1]} Mbit/s` : ''}), carrera ${carrera} (${pista}): llegó a la última vuelta`,
      ultima[i]?.humanos?.[i]?.[0] >= 3 && fin[i]?.etapa >= 2, `${JSON.stringify(fin[i]?.humanos)} etapa ${fin[i]?.etapa} sección ${fin[i]?.s}`);
    ok(`${t.n}, carrera ${carrera}: 0 pedidos a la red con la carrera andando (también en la vuelta 3) y sin barra de descarga`,
      andando.length === 0 && barra[i] === 0, andando.map(r => String(r[0]).split('/').slice(-2).join('/')).slice(0, 5).join(' · '));
  }
  // terminar la carrera en el mismo cuadro en las dos (los humanos cruzan la meta: los resultados, el descanso y la siguiente)
  const f = Math.max(...fin.map(x => x?.cuadro || 0)) + 180;
  await Promise.all([A, B].map(p => p.evaluate(c => window.mkwTerminarEn(c), f).catch(() => {})));
  await Promise.all([A, B].map(p => esperarQue(p, x => x.etapa >= 4 || x.s !== 0x20, 90000)));
}
writeFileSync(path.join(carpeta, `sala-${PISTAS.map(x => `${x.copa}.${x.fila}`).join('_')}${RED_B ? '-redb' : ''}.json`), JSON.stringify({ pistas: PISTAS, redB: RED_B, datos }, null, 1));
await navegador.close(); servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (build/web/datos/vuelta-final/)`);
process.exit(mal ? 1 : 0);
