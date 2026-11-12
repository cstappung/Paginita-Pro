// «Cada uno su kart» con N consolas (bitácora §275b, 3c): N pestañas de este PC (una por consola, cada una con su
// perfil), la sala de siempre (?modo=sala, copa) con ?red=estado. La pestaña 0 es la anfitriona (corre las 10 − N + 2 CPU).
// Lo que solo aparece con más de dos:
//   - los avisos de llegada de VARIAS consolas a la vez (cada humano llega por código en SU pestaña, de a uno, 0,4 s
//     entre cada uno: el orden de llegada es el de las pestañas);
//   - los puntos de los 12, los mismos en todas las consolas; el VR con los mismos corredores en todas;
//   - con --se-va K: la pestaña K se cierra a los 5 s de la 1.ª carrera (una consola que se va a mitad de carrera):
//     las demás la terminan con el respaldo (plazo DNF + 3 s), siguen iguales entre ellas y la copa sigue sin ella;
//   - lo que cuesta en red: bytes por segundo que manda y recibe cada consola, por tipo (karts propios, CPU, avisos).
// Uso:  MKW_BUILD=build/web-275/navegador node herramientas/prueba-sala-estado-n.mjs [--n 3] [--se-va 2]
//         [--pistas 0.0,0.1] [--segundos 12] [--etiqueta X] [--puerto 8179]      (con el candado: QUIEN=red-estado)
// Salida: build/web/datos/red-estado/sala-n-<etiqueta>.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { manejar } from './piloto-ruta.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(opcion('--n', 3)), SE_VA = Number(opcion('--se-va', -1)), PUERTO = Number(opcion('--puerto', 8179));
const RECARGA = Number(opcion('--recarga', -1));
const PLAYLIST = process.argv.includes('--playlist');
const SUMADO = process.argv.includes('--sumado');   // la última consola llega con la copa andando (§110): se abre en la 1.ª carrera y corre desde la 2.ª
const N0 = SUMADO ? N - 1 : N;                        // las que empiezan   // la sala en modo playlist (la lista de la anfitriona) en vez de copa   // la pestaña K se recarga a los 5 s de la 1.ª carrera: se salta esa y vuelve en la 2.ª
const SEGUNDOS = Number(opcion('--segundos', 12));
const PISTAS = opcion('--pistas', '0.0,0.1').split(',').map(s => { const [copa, fila] = s.split('.').map(Number); return { copa, fila }; });
const ETIQUETA = opcion('--etiqueta', `n${N}${SE_VA >= 0 ? '-seva' + SE_VA : ''}${RECARGA >= 0 ? '-recarga' + RECARGA : ''}${PLAYLIST ? '-playlist' : ''}`);
const carpeta = path.join('build', 'web', 'datos', 'red-estado');
fs.mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const resultado = { etiqueta: ETIQUETA, n: N, seVa: SE_VA, pistas: PISTAS, segundos: SEGUNDOS, carreras: [] };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

const leer = p => Promise.race([espera(10000).then(() => ({ colgada: true })), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), rd = L.u32(0x809BD728);
  return { pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : 0,
    modo: rd ? L.u32(rd + 0x20 + 0xB48 + 0x8) : -1, eleccion: window.mkwEstado.eleccion || null, sala: window.mkwEstado.sala || null,
    picker: !!document.getElementById('elegirPista'), cortina: !document.body.classList.contains('sin-cortina'),
    karts: (() => { try { return L.u8(L.u32(0x809C18F8) + 0x24); } catch { return -1; } })() };
})]).catch(() => null);
const esperarQue = async (p, f, tope, que) => { let aviso = Date.now() + 15000;
  for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x && f(x)) return x;
    if (Date.now() > aviso) { aviso = Date.now() + 15000; console.log(`  … ${que}: ${JSON.stringify(x && { pagina: x.pagina, etapa: x.etapa, fase: x.sala?.fase })}`); }
    await espera(500); } return leer(p); };
// la llegada de los N humanos, los puntos de los 12 y el VR, leídos del juego de una pestaña
const fotoFin = (p, nhs = N) => p.evaluate(nh => { const L = window.mkwMenus, ri = L.u32(0x809BD730), lista = L.u32(ri + 0xC), rd = L.u32(0x809BD728);
  const t = q => q ? (L.u16(q + 4) * 60 + L.u8(q + 6)) * 1000 + L.u16(q + 8) : -1, v = window.mkwEstado.vr;
  return { etapa: L.u32(ri + 0x28), fin: window.mkwRedEstadoSala?.estado?.()?.fin,
    humanos: Array.from({ length: nh }, (_, i) => { const q = L.u32(lista + 4 * i); return { puesto: L.u8(q + 0x20), llego: !!(L.u32(q + 0x38) & 2), ms: t(L.u32(q + 0x40)) }; }),
    puntos: Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)),
    vr: v ? { carrera: v.carrera, cambio: v.cambio, nivelVr: v.nivelVr, corredores: (v.corredores || []).map(x => `${x.uid || 'cpu'}:${x.puesto}${x.cortado ? '✂' : ''}`).join(',') } : null };
}, nhs).catch(e => ({ error: e.message }));
const redDe = p => p.evaluate(() => { const c = window.mkwRedEstadoSala?.cuentas; return c?.bytes ? { ...c.bytes, ahora: performance.now() } : null; }).catch(() => null);

async function elegir(p) {
  let ultimo = 0;
  for (const h = Date.now() + 240000; Date.now() < h;) {
    const x = await leer(p);
    if (x?.eleccion) return x;
    if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina) && Date.now() - ultimo > 1300) {
      ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); }
    await espera(300);
  }
  return leer(p);
}

const salaId = 'sn' + Date.now().toString(36), uids = Array.from({ length: N }, (_, i) => `U${i}${salaId}`);
const q = (uid, lista = uids.slice(0, N0), base = 0) => `/?auto=1&red=estado&senal=canal&sala=${salaId}&uid=${uid}&sincro=${lista.join(',')}&jefe=${uids[0]}${base ? '&base=' + base : ''}` +
  `&modo=sala&estilo=${PLAYLIST ? 'playlist' : 'copa'}&carreras=${PISTAS.length}&descanso=12&semilla=4242&cc=c150&cpu=normal&pista=${PISTAS[0].copa}.${PISTAS[0].fila}`;
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', `--window-position=${vx},${vy}`] });
const puente = puenteSenal();
try {
  const P = [];
  const abrirPestana = async (i, url) => {
    const ctx = await navegador.newContext({ viewport: { width: 960, height: 540 } });
    await puente.agregar(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log(`[${i}] [pageerror] ${e.message}`));
    await p.goto(`http://127.0.0.1:${PUERTO}${url}`);
    P[i] = p;
  };
  for (let i = 0; i < N0; i++) await abrirPestana(i, q(uids[i]));
  await esperarQue(P[0], x => x.picker, 300000, 'la anfitriona hasta el selector');
  ok('la anfitriona fija la copa', await P[0].evaluate(c => window.mkwSala.ponerPistas(c), PISTAS).catch(e => e.message) === true);
  const el = await Promise.all(P.map(elegir));
  ok(`las ${N0} consolas eligieron personaje`, el.every(x => x?.eleccion));
  let sumado = null;                                     // (--sumado: la elección de la que llega)
  let vivas = P.map((p, i) => i);                        // las pestañas que siguen abiertas
  for (let n = 1; n <= PISTAS.length; n++) {
    const c = { carrera: n };
    const cuenta = await Promise.all(vivas.map(i => esperarQue(P[i], x => x.sala?.fase === 'correr' && x.sala?.carrera === n && x.etapa >= 0 && x.etapa <= 2 && x.logica > 0, 420000, `${i} hasta la carrera ${n}`)));
    ok(`carrera ${n}: las ${vivas.length} en la carrera, en línea (modo 7) con 12 karts`, cuenta.every(x => x?.modo === 7 && x?.karts === 12), cuenta.map(x => `m${x?.modo} k${x?.karts}`).join(' / '));
    const ya = await Promise.all(vivas.map(i => esperarQue(P[i], x => x.etapa >= 1, 60000, 'la cuenta')));
    if (!ya.every(x => x?.etapa >= 1)) { ok(`carrera ${n}: la cuenta empieza antes de 60 s`, false); throw new Error('sin cuenta en 60 s'); }
    await Promise.all(vivas.map(i => P[i].keyboard.down('KeyK')));
    await Promise.all(vivas.map(i => esperarQue(P[i], x => x.etapa === 2, 60000, '«¡YA!»')));
    const red0 = new Map(await Promise.all(vivas.map(async i => [i, await redDe(P[i])])));
    const parar = vivas.map(i => manejar(P[i], null, i));
    if (SUMADO && n === 1) {                                     // llega uno con la copa andando
      await abrirPestana(N - 1, q(uids[N - 1], uids, N - 1));
      await Promise.all(vivas.map(i => P[i].evaluate(l => window.mkwSala?.sumar(l), uids).catch(() => {})));
      sumado = elegir(P[N - 1]);
      console.log(`  carrera ${n}: llega la consola ${N - 1} (se suma desde la siguiente)`);
    }
    let recargada = -1;
    if (RECARGA >= 0 && n === 1) {                                  // una consola que recarga a mitad de carrera
      await espera(5000);
      await P[RECARGA].reload().catch(() => {});
      recargada = RECARGA; vivas = vivas.filter(i => i !== RECARGA);
      console.log(`  carrera ${n}: la consola ${RECARGA} recargó a los 5 s (se salta esta carrera)`);
      await espera(Math.max(0, SEGUNDOS * 1000 - 5000));
    } else if (SE_VA >= 0 && n === 1 && vivas.includes(SE_VA)) {          // una consola que se va a mitad de carrera
      await espera(5000);
      await P[SE_VA].close().catch(() => {});
      vivas = vivas.filter(i => i !== SE_VA);
      console.log(`  carrera ${n}: la consola ${SE_VA} se fue (pestaña cerrada) a los 5 s`);
      await espera(Math.max(0, SEGUNDOS * 1000 - 5000));
    } else await espera(SEGUNDOS * 1000);
    const red1 = await Promise.all(vivas.map(i => redDe(P[i])));
    // lo que cuesta en red: bytes/s de cada consola (sale/entra), por tipo
    c.red = vivas.map((i, k) => { const a0 = red0.get(i), b = red1[k], s = b && a0 ? (b.ahora - a0.ahora) / 1000 : 0;
      const tasa = (lado, t) => s > 0 ? Math.round((b[lado][t] - a0[lado][t]) / s) : null;
      return { consola: i, sale: { race: tasa('sale', 'race'), cpu: tasa('sale', 'cpu'), llego: tasa('sale', 'llego') }, entra: { race: tasa('entra', 'race'), cpu: tasa('entra', 'cpu'), llego: tasa('entra', 'llego') } }; });
    console.log(`  carrera ${n}: red (bytes/s) ${c.red.map(x => `#${x.consola} sale ${x.sale.race}+${x.sale.cpu}+${x.sale.llego} entra ${x.entra.race}+${x.entra.cpu}+${x.entra.llego}`).join(' · ')}`);
    for (const f of parar) await f?.().catch?.(() => {});
    await Promise.all(vivas.map(i => P[i].keyboard.up('KeyK').catch(() => {})));
    // cada humano llega en SU pestaña, de a uno (0,4 s entre cada uno): avisos de varias consolas a la vez
    for (const i of vivas) { await P[i].evaluate(yo => window.mkwTerminarEn?.(0, undefined, [yo]), i).catch(() => {}); await espera(400); }
    // hasta que en todas llegaron los N humanos (el que se fue, por el respaldo: plazo DNF + 3 s)
    const nh = SUMADO && n === 1 ? N - 1 : N;
    const todos = async i => { const f = await fotoFin(P[i], nh); return f?.humanos?.every(h => h.llego) && f.etapa >= 4; };
    for (const h = Date.now() + 90000; Date.now() < h;) { const r = await Promise.all(vivas.map(todos)); if (r.every(Boolean)) break; await espera(500); }
    await espera(5000);                                           // (los resultados suman los puntos)
    c.fin = await Promise.all(vivas.map(i => fotoFin(P[i], nh)));
    vivas.forEach((i, k) => console.log(`  carrera ${n}: #${i} ${JSON.stringify({ fin: c.fin[k]?.fin, humanos: c.fin[k]?.humanos, vr: c.fin[k]?.vr })}`));
    const iguales = f => c.fin.every(x => JSON.stringify(f(x)) === JSON.stringify(f(c.fin[0])));
    ok(`carrera ${n}: los ${nh} humanos llegaron en todas, con el mismo puesto y tiempo`, c.fin.every(x => x?.humanos?.every(h => h.llego)) && iguales(x => x?.humanos),
      c.fin.map(x => x?.humanos?.map(h => `${h.puesto}:${h.ms}`).join(' ')).join(' | '));
    const suma = xs => (xs || []).reduce((a, b) => a + b, 0);
    // (§110: con --sumado, la que llega toma el puesto de una CPU y empieza con 0: la suma pierde lo que esa CPU llevaba)
    const esperado = 73 * n - (SUMADO && n > 1 ? (resultado.carreras[0]?.fin?.[0]?.puntos?.[N - 1] ?? 0) : 0);
    ok(`carrera ${n}: los puntos de los 12 (suman ${esperado}), los mismos en todas`, c.fin.every(x => suma(x?.puntos) === esperado) && iguales(x => x?.puntos),
      c.fin.map(x => x?.puntos?.join(',')).join(' | '));
    ok(`carrera ${n}: el VR con los mismos corredores en todas`, c.fin.every(x => x?.vr?.carrera === n) && iguales(x => x?.vr?.corredores),
      c.fin.map(x => `${x?.vr?.cambio}`).join(' / '));
    if (SE_VA >= 0 && n === 1) {
      const h = c.fin[0]?.humanos?.[SE_VA];
      ok(`carrera ${n}: la consola que se fue queda terminada (el respaldo) y cuenta como cortada en el VR`,
        h?.llego && c.fin.every(x => x?.vr?.corredores?.includes(`${uids[SE_VA]}:`) ? x.vr.corredores.includes('✂') : true), JSON.stringify(h));
    }
    resultado.carreras.push(c);
    if (sumado && n === 1) { const e = await sumado; ok('la que llegó eligió personaje', !!e?.eleccion); vivas = [...vivas, N - 1]; }
    if (recargada >= 0) { vivas = [...vivas, recargada].sort((x, y) => x - y); console.log(`  la consola ${recargada} vuelve para la carrera ${n + 1}`); }
  }
  const finCopa = await Promise.all(vivas.map(i => esperarQue(P[i], x => x.sala?.fase === 'fin', 120000, 'el fin de la copa')));
  const tablas = finCopa.map(x => JSON.stringify(x?.sala?.puntos ?? null));
  ok(`la copa termina en las ${vivas.length} con la misma tabla de la sala`, finCopa.every(x => x?.sala?.fase === 'fin') && tablas.every(t => t === tablas[0]), tablas[0]?.slice(0, 200));
} catch (e) { ok('la prueba corrió entera', false, e.stack?.slice(0, 400)); }
finally { await navegador.close().catch(() => {}); servidor.kill(); }
fs.writeFileSync(path.join(carpeta, `sala-n-${ETIQUETA}.json`), JSON.stringify(resultado));
console.log(`\n${bien} bien, ${mal} mal  (${path.join(carpeta, `sala-n-${ETIQUETA}.json`)})`);
process.exit(mal ? 1 : 0);
