// La última vuelta con un humano (bitácora §269, bug 2 del dueño: «en la vuelta 3 está descargando a Lakitu»).
//
// Resumen: nadie había medido qué lee el juego en la ÚLTIMA vuelta de un humano: las mediciones de §150/§176 iban con
// las 12 en CPU (nadie dispara «¡última vuelta!»: Lakitu con su cartel, la fanfarria y el cambio de música) y las pruebas
// terminan la carrera por código. Esta prueba abre una carrera de un jugador (?modo=directa) con un perfil de Chrome
// NUEVO (sin caché, como la primera visita de un amigo), y en la cuenta regresiva (los karts quietos) pone el contador de
// vueltas de MI kart en 2 (RaceinfoPlayer +0x24 vuelta actual y +0x26 la mayor alcanzada): al cruzar la raya de la
// largada, el juego cree que empieza la vuelta 3, la última. Como poner el cuentakilómetros de un auto cerca del número
// en que salta el aviso del servicio, para ver el aviso sin manejar 10.000 km. Mide:
//   - qué archivos lee el juego desde que empieza la última vuelta (?trazaDisco=1, «[lee] …» en la consola);
//   - qué fue a la RED con la carrera andando (window.mkwRedEnCarrera(): cada pedido con la etapa de ese momento, §176)
//     y qué tuvo que traer el juego fuera de la memoria (window.mkwFaltas());
// y comprueba la regla de §176 D1: 0 pedidos a la red con la carrera andando, también en la última vuelta.
// Uso:  MKW_BUILD=build/web-final-w30/navegador node herramientas/prueba-vuelta-final.mjs [--pista 13.2] [--puerto 8173]
//       [--extra "&param=…"] [--segundos 25] [--baja] [--ventana]   (--baja: CPU ×4 y la red de la gama baja, 20 Mbit/s y 50 ms)
// Salida: build/web/datos/vuelta-final/<pista>[-baja].json (nombres de archivos del juego: nunca a git)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8173));
const PISTA = opcion('--pista', '13.2');
const EXTRA = opcion('--extra', '');
const SEGUNDOS = Number(opcion('--segundos', 25));
const BAJA = process.argv.includes('--baja');
const carpeta = path.join(raiz, 'build/web/datos/vuelta-final');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();

// (la latencia hasta R2 de mentira, como medir-carrera-entera: el servidor la agrega a cada pedido)
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: process.env.MKW_LATENCIA || '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
// --sala: dos pestañas (dos perfiles nuevos) en la carrera sincronizada de la sala, como prueba-sincro --directa (el
// lockstep con el árbitro, la ficha y el paquete de la sala). Cada consola escribe la MISMA vuelta en los karts de los
// dos humanos en la cuenta, así la carrera sigue siendo la misma en las dos (&huella=0: la huella compararía el momento
// de la escritura)
const SALA = process.argv.includes('--sala');
const sala = 'vf' + Date.now().toString(36);
const nombres = SALA ? ['A', 'B'] : ['A'];
const t0 = Date.now();
const pestanas = [];
for (const [i, n] of nombres.entries()) {
  const contexto = await navegador.newContext({ viewport: { width: 1000, height: 600 } });   // (perfil nuevo: sin caché)
  await puente.agregar(contexto);   // (§269: la señal del banco cruza entre perfiles: herramientas/puente-contextos.mjs)
  const p = await contexto.newPage();
  if (BAJA) {
    const c = await contexto.newCDPSession(p);
    await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 });
  }
  const consola = [];
  p.on('console', m => consola.push(m.text()));
  p.on('pageerror', e => console.log(`[${n}] [pageerror] ` + e.message));
  const q = SALA ? `&red=malla&senal=canal&sala=${sala}&uid=${n}${sala}&sincro=A${sala},B${sala}&semilla=777&huella=0` : '&pj=0&kart=1';
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&cc=c150&cpu=normal&trazaDisco=1${q}${EXTRA}`);
  pestanas.push({ n, p, consola, puesto: i, puesta: null, acelera: false, ultima: null, x: null });
  if (SALA && i === 0) await espera(4000);
}

// lo de mi kart: la etapa de la carrera, la vuelta y el cuadro
const leer = (p, puesto) => p.evaluate(k => {
  const L = window.mkwMenus, s = L?.estado?.(); if (!s) return null;
  const ri = L.u32(0x809BD730); if (!ri) return { seccion: s.seccion };
  const yo = L.u32(L.u32(ri + 0xC) + 4 * k);
  return { seccion: s.seccion, etapa: L.u32(ri + 0x28), vuelta: yo ? L.u16(yo + 0x24) : -1, mayor: yo ? L.u8(yo + 0x26) : -1,
           cuadro: window.mkwCuadros ? window.mkwCuadros() : 0, lineas: window.mkwEstado?.log?.length || 0 };
}, puesto).catch(() => null);
// (medido: en la cuenta la vuelta vale 0 y la raya de la largada la pasa a 1; --vuelta N = cuántas vueltas se «regalan»
// antes de cruzarla. Con 2, al cruzar la largada queda directo en la última: medido en 0.0. En 13.2 la carrera termina
// —esa pista cuenta distinto—: ahí --vuelta 1)
const REGALO = Number(opcion('--vuelta', 2));
const escribirVuelta = (p, puestos) => p.evaluate(([n, ks]) => {
  const L = window.mkwMenus, ri = L.u32(0x809BD730), r = [];
  for (const k of ks) {
    const yo = L.u32(L.u32(ri + 0xC) + 4 * k);
    const antes = [L.u16(yo + 0x24), L.u8(yo + 0x26)];
    L.w8(yo + 0x25, antes[0] + n); L.w8(yo + 0x26, antes[1] + n);   // (+0x24 es de 16 bits, big-endian: el byte de abajo es +0x25)
    r.push({ antes, ahora: [L.u16(yo + 0x24), L.u8(yo + 0x26)] });
  }
  return r;
}, [REGALO, puestos]);
const humanos = nombres.map((_, i) => i);
while (Date.now() - t0 < 300000) {
  for (const t of pestanas) {
    const x = t.x = await leer(t.p, t.puesto);
    if (x?.seccion === 0x20 && x.etapa <= 1 && !t.puesta) { t.puesta = await escribirVuelta(t.p, humanos); console.log(`  ${t.n} en la cuenta: la vuelta ${JSON.stringify(t.puesta)} (a los ${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
    if (t.puesta && x?.etapa === 2 && !t.acelera) { t.acelera = true; await t.p.keyboard.down('KeyK'); }
    // (§269: en 13.2 la raya cuenta distinto según la largada y con solo acelerar el kart choca: si 4 s después de la
    // largada mi vuelta aún no es la última, se la pongo en 3 directamente, sin pasar por la raya)
    if (t.acelera && !t.ultima && !t.empuje && x?.etapa === 2 && x.vuelta >= 1 && x.vuelta < 3) {
      t.vista2 ??= Date.now();
      if (Date.now() - t.vista2 > 4000) { t.empuje = await t.p.evaluate(([k]) => { const L = window.mkwMenus, ri = L.u32(0x809BD730), yo = L.u32(L.u32(ri + 0xC) + 4 * k); L.w8(yo + 0x25, 3); L.w8(yo + 0x26, 3); return [L.u16(yo + 0x24), L.u8(yo + 0x26)]; }, [t.puesto]); console.log(`  ${t.n}: la vuelta puesta en 3 a mano: ${JSON.stringify(t.empuje)}`); }
    }
    if (t.acelera && x?.vuelta >= 3 && x.etapa === 2 && !t.ultima) { t.ultima = { ...x, t: Date.now(), idx: t.consola.length, barra: 0 }; console.log(`  ${t.n}: ¡última vuelta! cuadro ${x.cuadro} (a los ${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  }
  // (¿se ve la barra de descarga en la última vuelta? la mira cada 250 ms)
  for (const t of pestanas) if (t.ultima) t.ultima.barra += await t.p.evaluate(() => { const b = document.getElementById('descarga'); return b && !b.hidden && getComputedStyle(b).display !== 'none' && b.offsetWidth > 0 ? 1 : 0; }).catch(() => 0);
  if (pestanas.every(t => t.ultima && Date.now() - t.ultima.t > SEGUNDOS * 1000)) break;
  await espera(250);
}
const datos = {};
for (const t of pestanas) {
  await t.p.keyboard.up('KeyK').catch(() => {});
  const red = await t.p.evaluate(() => window.mkwRedEnCarrera?.() || null).catch(() => null);
  const faltas = await t.p.evaluate(() => window.mkwFaltas?.() || null).catch(() => null);
  const paquete = await t.p.evaluate(() => { const e = window.mkwEstado?.paquete; return e ? { carreras: e.carreras, rutas: e.rutas, ultima: e.ultima, sala: e.sala, fichas: e.fichas } : null; }).catch(() => null);
  // lo que leyó el juego desde la última vuelta (la consola, «[lee] cuadro N ruta inicio largo»)
  const lecturas = t.consola.filter(l => l.startsWith('[lee] ')).map(l => { const [, , c, ruta, ini, largo] = l.split(' '); return { cuadro: +c, ruta, ini: +ini, largo: +largo }; });
  const desde = t.ultima?.cuadro ?? Infinity;
  const archivos = {};
  for (const l of lecturas.filter(l => l.cuadro >= desde - 2)) { const a = archivos[l.ruta] || (archivos[l.ruta] = { lecturas: 0, bytes: 0, primera: l.cuadro }); a.lecturas++; a.bytes += l.largo; }
  console.log(`  ${t.n}: leído en la última vuelta (${SEGUNDOS} s): ${Object.keys(archivos).length} archivos`);
  for (const [r, a] of Object.entries(archivos)) console.log(`    ${r}: ${a.lecturas} lecturas, ${(a.bytes / 1048576).toFixed(2)} MB, desde el cuadro ${a.primera}`);
  // los pipelines armados de golpe desde la última vuelta (Lakitu con el cartel, la fanfarria: lo que la semilla de 12 CPU
  // nunca vio) y los segundos más lentos del juego desde ahí
  const pip = { pedidos: 0, golpe: 0, ms: 0, nuevos: 0 };
  for (const l of t.consola.slice(t.ultima?.idx ?? Infinity)) {
    const y = /^\[pipelines\] (\d+) pedidos .* (\d+) armados en el momento \(([\d.]+) ms\)/.exec(l);
    if (y) { pip.pedidos += +y[1]; pip.golpe += +y[2]; pip.ms += +y[3]; }
    const z = /el juego pidió \d+ de la cola, \d+ de la lista esperando, (\d+) nuevos/.exec(l); if (z) pip.nuevos += +z[1];
  }
  const lentos = await t.p.evaluate(n => (window.mkwEstado?.historial || []).slice(-n).map(h => ({ s: h.s, fps: h.fps, juego: h.juego })).sort((a, b) => a.fps - b.fps).slice(0, 3), SEGUNDOS).catch(() => []);
  console.log(`  ${t.n}: pipelines desde la última vuelta: ${pip.pedidos} pedidos, ${pip.golpe} armados de golpe (${pip.ms.toFixed(0)} ms), ${pip.nuevos} nuevos · barra de descarga a la vista ${t.ultima?.barra || 0} de cada 4 por s · los 3 segundos más lentos: ${lentos.map(h => `${h.fps} fps (juego ${h.juego} ms)`).join(', ')}`);
  const andando = (red || []).filter(r => r[5] === 2);   // ([archivo, bloque, último, bytes, urgente, etapa], disco.mjs)
  console.log(`  ${t.n}: a la red con la carrera andando: ${andando.length}`);
  for (const r of andando.slice(0, 20)) console.log('    ' + JSON.stringify(r).slice(0, 220));
  datos[t.n] = { puesta: t.puesta, ultima: t.ultima, archivos, red, faltas, paquete, pip, lentos };
  ok(`${t.n}: la carrera llegó a la última vuelta de su kart (la vuelta 3, con Lakitu y su cartel)`, !!t.ultima, JSON.stringify(t.x));
  ok(`${t.n}: la barra de descarga no aparece en la última vuelta`, !(t.ultima?.barra > 0), `${t.ultima?.barra} veces`);
  ok(`${t.n}: §176 D1 / §269: 0 pedidos a la red con la carrera andando, también en la última vuelta`, !!t.ultima && Array.isArray(red) && andando.length === 0,
     andando.map(r => String(r[0]).split('/').slice(-2).join('/')).slice(0, 5).join(' · '));
}
writeFileSync(path.join(carpeta, `${PISTA}${SALA ? '-sala' : ''}${BAJA ? '-baja' : ''}${EXTRA ? '-extra' : ''}.json`),
  JSON.stringify({ pista: PISTA, extra: EXTRA, baja: BAJA, sala: SALA, datos }, null, 1));
await navegador.close(); servidor.kill();
console.log(`\n${bien} bien, ${mal} mal  (build/web/datos/vuelta-final/)`);
process.exit(mal ? 1 : 0);
