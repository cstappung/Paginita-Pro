// Prueba de la PRECARGA del vestíbulo (M22, bitácora §98): la página con ?precarga=1 baja lo que el juego necesita
// para arrancar y para la primera carrera, lo deja en las cachés del navegador y NO arranca el juego. Después, el juego
// de verdad lo encuentra guardado y llega antes a la carrera.
//
// Resumen: dos perfiles de Chrome nuevos (como dos PC que nunca jugaron), con 50 ms de red hasta los archivos (como R2).
//   1. SIN precarga: abre una carrera directa (?modo=directa) y mide cuánto tarda en llegar a la carrera y cuánto bajó.
//   2. CON precarga: abre ?precarga=1 (lo que hace el marco escondido del vestíbulo), espera «listo», y abre la misma
//      carrera: mide lo mismo.
// Puntos: la precarga termina (100 %) sin arrancar el juego, el porcentaje sube de a poco, deja el disco en Cache
// Storage, el programa sale de la caché HTTP, el juego llega antes a la carrera y baja menos de la red.
//
// Uso:  node web/navegador/prueba-precarga.mjs [--ventana] [--puerto=8158]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = Number((process.argv.find(a => a.startsWith('--puerto=')) || '--puerto=8158').slice(9));
const carpeta = path.join(raiz, 'build/web/datos/precarga');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const mb = b => (b / 1048576).toFixed(1) + ' MB';

// el servidor local con 50 ms por pedido a los archivos del juego (la red hasta R2 del sitio)
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const ARGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'];
const CARRERA = `http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1`;
const perfiles = [];
const perfilNuevo = async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-precarga-'));
  perfiles.push(dir);
  return chromium.launchPersistentContext(dir, { channel: 'chrome', headless: !process.argv.includes('--ventana'), args: ARGS,
    viewport: { width: 960, height: 540 } });
};
// abre la carrera directa y mide hasta que el juego está en la carrera (sección 0x20 con su página)
async function hastaLaCarrera(contexto) {
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  const t0 = Date.now();
  await p.goto(CARRERA);
  let x = null;
  for (const hasta = Date.now() + 240000; Date.now() < hasta; await espera(250)) {
    x = await p.evaluate(() => { const e = window.mkwMenus?.estado?.(); return e && { s: e.seccion, pagina: e.pagina, llego: window.mkwEstado?.piloto?.llego,
      programa: window.mkwEstado?.programa || null, disco: window.mkwDisco ? { ...window.mkwDisco.estado, colaBaja: undefined } : null }; }).catch(() => null);
    if (x?.s === 0x20 && x.pagina >= 0 && x.llego) break;
  }
  const ms = Date.now() - t0;
  await p.screenshot({ path: path.join(carpeta, `carrera-${perfiles.length}.png`) }).catch(() => {});
  await p.close();
  return { ms, x, errores };
}

// 1) sin precarga
const c1 = await perfilNuevo();
const sin = await hastaLaCarrera(c1);
await c1.close();
console.log(`· sin precarga: a la carrera en ${(sin.ms / 1000).toFixed(1)} s, de la red ${mb(sin.x?.disco?.bytesRed || 0)} del disco`);

// 2) con precarga
const c2 = await perfilNuevo();
const pp = await c2.newPage();
const erroresPre = [];
pp.on('pageerror', e => erroresPre.push(e.message));
// (cada porcentaje que la página anuncia, anotado desde adentro cada 10 ms: el sitio recibe cada aviso por mensaje, y
// mirar desde aquí cada 300 ms no alcanza desde §104, con la precarga en ~1 s)
await pp.addInitScript(() => {
  window.__vistos = [];
  setInterval(() => {
    const p = window.mkwEstado?.precarga;
    if (p && window.__vistos[window.__vistos.length - 1] !== p.pct) window.__vistos.push(p.pct);
  }, 10);
});
const t0 = Date.now();
await pp.goto(`http://127.0.0.1:${PUERTO}/?precarga=1`);
let pre = null;
for (const hasta = Date.now() + 300000; Date.now() < hasta; await espera(300)) {
  pre = await pp.evaluate(() => ({ p: window.mkwEstado?.precarga || null, juego: !!window.mkw })).catch(() => null);
  if (pre?.p?.listo || pre?.p?.error) break;
}
const vistos = await pp.evaluate(() => window.__vistos).catch(() => []);
const msPre = Date.now() - t0;
const guardado = await pp.evaluate(async () => {
  let n = 0;
  for (const k of await caches.keys()) if (k.startsWith('mkw-disco:')) n += (await (await caches.open(k)).keys()).length;
  return n;
});
ok('la precarga termina (100 %, «listo») sin arrancar el juego (sin programa corriendo)', pre?.p?.listo === true && pre.p.pct === 100 && pre.juego === false,
   `${(msPre / 1000).toFixed(1)} s; ${JSON.stringify(pre)}`);
ok('el porcentaje sube de a poco (lo que ve cada piloto en el vestíbulo)', vistos.length >= 5 && vistos.every((v, i) => !i || v >= vistos[i - 1]),
   vistos.length > 8 ? `${vistos.length} valores: ${vistos.slice(0, 5).join(' → ')} → … → ${vistos.slice(-2).join(' → ')}` : vistos.join(' → '));
ok('deja el disco guardado en este navegador (Cache Storage)', guardado > 100, `${guardado} archivos y bloques`);
ok('sin errores de JavaScript en la precarga', erroresPre.length === 0, erroresPre.slice(0, 2).join(' · '));
await pp.close();
const con = await hastaLaCarrera(c2);
await c2.close();
console.log(`· con precarga: a la carrera en ${(con.ms / 1000).toFixed(1)} s, de la red ${mb(con.x?.disco?.bytesRed || 0)} del disco`);
ok('después, el programa sale de la caché HTTP (no viaja de nuevo)', con.x?.programa?.bytes === 0,
   `transferidos ${con.x?.programa?.bytes} (sin precarga ${sin.x?.programa?.bytes})`);
ok('el juego llega a la carrera antes que sin precarga', con.x?.s === 0x20 && sin.x?.s === 0x20 && con.ms < sin.ms,
   `con ${(con.ms / 1000).toFixed(1)} s · sin ${(sin.ms / 1000).toFixed(1)} s`);
ok('…y baja de la red mucho menos del disco (menos de la mitad)', (con.x?.disco?.bytesRed || 0) < (sin.x?.disco?.bytesRed || 1) / 2,
   `con ${mb(con.x?.disco?.bytesRed || 0)} · sin ${mb(sin.x?.disco?.bytesRed || 0)}`);
ok('sin errores de JavaScript en el juego', !sin.errores.length && !con.errores.length, [...sin.errores, ...con.errores].slice(0, 2).join(' · '));

servidor.kill();
for (const d of perfiles) try { rmSync(d, { recursive: true, force: true }); } catch {}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
