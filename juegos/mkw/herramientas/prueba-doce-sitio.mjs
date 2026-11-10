// La sala llena desde la página (bitácora §261, pedido del dueño 2026-11-09: «prueba con 12 jugadores simultáneos desde
// el principio, todos simulados en distintas ventanas; que puedan entrar todos desde la página desde 0, si el rendimiento
// de uno afecta al otro, en qué segundo empiezan la carrera y que los modos funcionen como debieran»).
//
// Resumen: arranca el ensayo de herramientas/experiencia.mjs (emuladores de Firebase con las reglas del sitio, 12 cuentas
// de mentira amigas, el sitio como GitHub Pages y el Worker de verdad; emuladores corridos 20000 puertos para no chocar
// con jugar.bat ni con prueba-experiencia) y abre 12 Chrome, cada uno con SU perfil nuevo (caché vacía = otro PC), en
// una cuadrícula de 4 × 3 en el monitor de MKW_VENTANA. Cada uno: Juegos → iniciar sesión en la ventanita del emulador
// → (la anfitriona abre la sala; los demás llegan con el enlace y «Unirse a la partida») → la precarga del vestíbulo →
// «¡A correr!» → la cortina de preparación → elegir personaje en el juego → la carrera.
// Las rondas (--rondas 0,1,2,3,4,5 = todas):
//   0  la anfitriona SOLA (1 humano + 11 CPU, copa de 1 pista, CPU máximo): la vara para separar «la máquina» de «la red»
//      (los cuadros de lógica por segundo y los ms del juego de UNA ventana en este PC);
//   1  los 12 (sin CPU), copa de 3 pistas, 150cc: carrera 1 la medida y una ventana frenada a propósito (CPU ×4 con el
//      DevTools de Chrome, como un PC lento); carrera 2 una recarga la página a mitad (vuelve en la 3); carrera 3 la
//      anfitriona echa a una con la carrera andando; el fin de la copa;
//   después la anfitriona echa a 5 más en el vestíbulo (quedan 6) y pasa el anfitrión a Piloto Dos;
//   2  6 humanos + 6 CPU, playlist de 1, espejo, CPU difícil;  3  copa de 1, «200cc» (c100), intenso;
//   4  playlist de 1, al azar, fácil;  5  copa de 1, 150cc, imposible.
// En cada carrera: la largada de cada ventana (lockstep.estado().largadas: cuadro y hora del cuadro 0, la cuenta y el
// «¡YA!»; compararLargadas de §250), los cuadros de lógica por segundo de cada una en un tramo de 15 s, lo que esperó a
// otros (ms por cuadro), retraso, relevos, pausas y cortes, las huellas (la misma carrera en todas), los puntos del
// juego (iguales en todas, suman 73), el descanso de 30 s y la carrera siguiente.
// Como enchufar 12 cargas a la misma fuente: primero se mide una sola (la caída de tensión de la fuente sola), y después
// las 12 juntas, para no culpar al cableado (la red) de lo que es la fuente (la CPU de este PC).
//
// Uso:  MKW_BUILD=build/web-final-w30/navegador node herramientas/prueba-doce-sitio.mjs [--n 12] [--rondas 0,1,2,3,4,5]
//       [--puerto 8196] [--ya] [--corta]  (--corta = la ronda 1 de una sola carrera, solo con la ventana frenada)   (resultados en build/web/datos/doce-sitio/; Chrome con --mute-audio)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compararLargadas } from '../web/navegador/largada-pareja.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const N = Math.max(2, Math.min(12, Number(opcion('--n', 12))));
const RONDAS = opcion('--rondas', '0,1,2,3,4,5').split(',').map(Number);
const PUERTO = Number(opcion('--puerto', 8196)), SITIO = `http://127.0.0.1:${PUERTO}`;
const DESPLAZAR = 20000;
const carpeta = path.join(raiz, 'build/web/datos/doce-sitio');
fs.mkdirSync(carpeta, { recursive: true });
const NOMBRES = ['Piloto Uno', 'Piloto Dos', 'Piloto Tres', 'Piloto Cuatro', 'Piloto Cinco', 'Piloto Seis', 'Piloto Siete',
  'Piloto Ocho', 'Piloto Nueve', 'Piloto Diez', 'Piloto Once', 'Piloto Doce'];
let bien = 0, mal = 0;
const lineas = [];
const di = t => { console.log(t); lineas.push(t); };
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; di(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now(), seg = (t = Date.now()) => ((t - T0) / 1000).toFixed(0);
const resultados = { inicio: new Date().toISOString(), build: process.env.MKW_BUILD || 'build/web/navegador', ventanas: [], rondas: [] };
const registro = [];
const matar = h => { if (!h || h.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };
const guardar = () => {
  fs.writeFileSync(path.join(carpeta, 'resultados.json'), JSON.stringify(resultados, null, 1));
  fs.writeFileSync(path.join(carpeta, 'resumen.txt'), lineas.join('\n'));
  fs.writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
};

// 1) el ensayo, con 12 cuentas
let ensayo = null;
if (!args.includes('--ya')) {
  ensayo = spawn(process.execPath, [path.join(raiz, 'herramientas/experiencia.mjs'), '--sin-ventanas', '--puerto', String(PUERTO),
    '--carpeta', 'build/emuladores-doce', '--limpiar', '--emu-desplazar', String(DESPLAZAR), '--cuentas', '12'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const salida = [];
  await new Promise((listo, fallo) => {
    const reloj = setTimeout(() => fallo(new Error('el ensayo no arrancó en 4 min:\n' + salida.join(''))), 240000);
    const mira = d => { salida.push(String(d)); if (/Listo:/.test(String(d))) { clearTimeout(reloj); listo(); } };
    ensayo.stdout.on('data', mira); ensayo.stderr.on('data', mira);
    ensayo.once('exit', c => { clearTimeout(reloj); fallo(new Error(`el ensayo se cerró (código ${c}):\n${salida.join('')}`)); });
  }).catch(e => { console.log('✗ ' + e.message); process.exit(1); });
}

// 2) los 12 «PC»: un Chrome cada uno, con su perfil nuevo, en la cuadrícula 4 × 3
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const ANCHO = 480, ALTO = 357;
const perfiles = path.join(os.tmpdir(), 'mkw-doce-sitio-' + Date.now().toString(36));
const ventanas = [];   // { i, nombre, ctx, p, tAbrir, uid, caidas: [] }
async function abrirPc(i) {
  const dir = path.join(perfiles, `pc${i + 1}`);
  const x = vx - 40 + (i % 4) * ANCHO, y = vy - 40 + Math.floor(i / 4) * ALTO;
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chrome', headless: false, viewport: null,
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--no-first-run',
      `--window-position=${x},${y}`, `--window-size=${ANCHO},${ALTO}`] });
  // (lo mismo que prueba-experiencia: se ve lo que ve una persona y la Tienda de Halloween ya «se vio hoy»)
  await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch {} });
  await ctx.addInitScript(() => { try { const f = new Date(); localStorage.setItem('jg.tiendaHw.visto', `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`); } catch {} });
  const p = ctx.pages()[0] || await ctx.newPage();
  const v = { i, nombre: NOMBRES[i], ctx, p, tAbrir: Date.now(), uid: null, caidas: [] };
  p.on('pageerror', e => { v.caidas.push(e.message); registro.push(`[${i + 1}] pageerror ${e.message}`); });
  p.on('console', m => registro.push(`[${i + 1}] ${m.type()} ${m.text().slice(0, 300)}`));
  p.on('crash', () => { v.caidas.push('la pestaña se cayó (crash)'); registro.push(`[${i + 1}] CRASH`); });
  return v;
}
async function entrar(v) {
  const p = v.p;
  await p.goto(SITIO + '/juegos.html?salasObra=0');
  await p.locator('#btnEntrar').waitFor({ timeout: 60000 });
  const [ventanita] = await Promise.all([p.waitForEvent('popup', { timeout: 30000 }), p.locator('#btnEntrar').click()]);
  await ventanita.waitForLoadState();
  await ventanita.getByText(new RegExp(`^\\s*${v.nombre}(?![\\wáéíóú])`)).first().click({ timeout: 30000 });
  await p.waitForFunction(n => document.querySelector('#btnEntrar') === null || document.body.textContent.includes(n), v.nombre, { timeout: 60000 });
  v.tSesion = Date.now();
}
const hastaQue = async (fn, cond, ms, cada = 500) => {
  let x;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(cada)) { x = await fn().catch(() => null); if (x && cond(x)) return x; }
  return x ?? await fn().catch(() => null);
};
const esJuego = u => /\/juegos\/mkw\/.*index\.html/.test(u);
const enSala = u => { try { return new URL(u).searchParams.get('modo') === 'sala'; } catch { return false; } };
const marcoDe = v => v.p.frames().find(f => esJuego(f.url()) && enSala(f.url())) || null;
const leer = v => { const f = marcoDe(v); if (!f) return Promise.resolve(null); return Promise.race([espera(10000).then(() => ({ colgada: true })), f.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const rd = L.u32(0x809BD728), esc = rd + 0x20, ri = L.u32(0x809BD730);
  const ls = window.mkwSincro?.lockstep?.estado() || null;
  let inf = null; try { inf = window.mkwInformeRendimiento?.().ultimos10s || null; } catch {}
  const q = new URLSearchParams(location.search);
  return { s: e.seccion, pagina: e.pagina, cortina: !document.body.classList.contains('sin-cortina'),
    sala: window.mkwEstado.sala || null, eleccion: window.mkwEstado.eleccion || null, carrera: window.mkwEstado.piloto?.carrera,
    picker: !!document.getElementById('elegirPista'), modoPicker: document.getElementById('elegirPista')?.className || '',
    etapa: ri ? L.u32(ri + 0x28) : -1, descanso: window.mkwEstado.descanso || null, inf,
    cartel: window.mkwLetreros?.cartelVisible || '', podio: window.mkwEstado.podio || null,
    tipos: Array.from({ length: 12 }, (_, i) => L.u32(esc + 8 + i * 0xF0 + 0x10)),
    puntosMenu: Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)),
    q: { uid: q.get('uid'), estilo: q.get('estilo'), cc: q.get('cc'), cpu: q.get('cpu'), carreras: q.get('carreras'), sincro: (q.get('sincro') || '').split(',').filter(Boolean).length },
    ls: ls && { cuadro: ls.cuadro, carrera: ls.carrera, cuadros: ls.cuadros, msEsperando: ls.msEsperando, retraso: ls.retraso,
      huellasIguales: ls.huellasIguales, desincronizado: ls.desincronizado || null, relevos: ls.relevos, pausas: ls.pausas,
      cortes: ls.cortes, fuera: ls.fuera, autoridad: ls.autoridad, largadas: ls.largadas, trabasVivas: ls.trabasVivas,
      relevadosAhora: ls.relevadosAhora, maxEspera: ls.maxEspera, arbitro: ls.arbitro } };
})]).catch(() => null); };
const foco = async v => { const f = marcoDe(v); const el = f && await f.frameElement().catch(() => null); await el?.focus().catch(() => {}); await f?.evaluate(() => window.focus()).catch(() => {}); };
const tecla = async (v, t, ms = 150) => { await v.p.keyboard.down(t).catch(() => {}); await espera(ms); await v.p.keyboard.up(t).catch(() => {}); };
const vest = v => v.p.textContent('.jg-mkw-vest').then(t => t.replace(/\s+/g, ' ')).catch(() => '');
const foto = (v, nombre) => v.p.screenshot({ path: path.join(carpeta, nombre) }).catch(() => {});

let codigo = 1;
let anfitrion = 0;
try {
  // ---------- todos abren Chrome y entran a la vez (perfiles nuevos) ----------
  di(`[${seg()} s] abren ${N} Chrome con perfiles nuevos (${perfiles})`);
  for (const v of await Promise.all(Array.from({ length: N }, (_, i) => abrirPc(i)))) ventanas.push(v);
  const entradas = await Promise.all(ventanas.map(v => entrar(v).then(() => null, e => e.message.split('\n')[0])));
  ok(`las ${N} inician sesión en Juegos (la ventanita del emulador, cada una con su cuenta)`, entradas.every(e => !e),
     entradas.map((e, i) => e ? `${i + 1}: ${e}` : null).filter(Boolean).join(' | ') || `${((Math.max(...ventanas.map(v => v.tSesion)) - T0) / 1000).toFixed(0)} s la última`);

  // ---------- la anfitriona abre la sala ----------
  const A = ventanas[0];
  await A.p.locator('.jg-mn').filter({ hasNotText: 'un jugador' }).filter({ hasText: 'Mario Kart' }).first().click({ timeout: 30000 });
  await A.p.locator('.jg-hoja-ya[data-f=sala]').click({ timeout: 20000 });
  await A.p.waitForFunction(() => /#p\//.test(location.hash) && document.querySelector('.jg-mkw-empieza'), null, { timeout: 30000 });
  const enlace = A.p.url().replace(/\/juegos\.html(\?[^#]*)?/, '/juegos.html?salasObra=0');
  ok('la anfitriona abre la sala de Mario Kart desde la ficha', /#p\//.test(enlace), enlace.split('#')[1]);
  const hayCambiar = async v => (await v.p.getAttribute('.jg-mkw-vest [data-cambiar]', 'aria-expanded').catch(() => null));
  async function ajustar(v, { estilo, cc, nivel }) {
    if (await hayCambiar(v) !== 'true') await v.p.locator('.jg-mkw-vest [data-cambiar]').click({ timeout: 10000 });
    await espera(500);
    if (estilo) await v.p.locator(`.jg-mkw-vest .jg-mkw-modo[data-e=${estilo}]`).click({ timeout: 10000 });
    await espera(700);
    if (cc) await v.p.locator(`.jg-mkw-vest [data-cc=${cc}]`).click({ timeout: 10000 });
    await espera(700);
    if (nivel) await v.p.locator(`.jg-mkw-vest [data-nivel=${nivel}]`).click({ timeout: 10000 });
    await espera(1500);
    return (await vest(v)).match(/(Copa|Playlist)[^·]*·[^·]*·[^·]*/)?.[0] || '';
  }

  // ---------- una carrera de la sala, medida ----------
  const humanosDe = lista => lista.filter(v => !v.fuera);
  async function correrRonda(nr, lista, { estilo, cc, nivel, pistas, eventos = {} }) {
    const ronda = { n: nr, estilo, cc, nivel, humanos: lista.length, carreras: [] };
    resultados.rondas.push(ronda);
    const H = lista[anfitrion === 0 ? 0 : lista.findIndex(v => v.i === anfitrion)] || lista[0];
    di(`\n=== ronda ${nr}: ${lista.length} humanos${lista.length < 12 ? ` + ${12 - lista.length} CPU` : ''}, ${estilo}, ${cc}, CPU ${nivel} (anfitriona ${H.nombre}) [${seg()} s]`);
    const titular = await ajustar(H, { estilo, cc, nivel });
    const visto = await hastaQue(() => Promise.all(lista.map(vest)), ts => ts.every(t => t.includes(titular)), 15000);
    ok(`r${nr}: la anfitriona pone ${estilo}/${cc}/${nivel} y todas lo ven en el titular`, !!titular && !!visto?.every(t => t.includes(titular)), titular);
    const tCorrer = Date.now();
    await H.p.locator('.jg-mkw-empieza').click({ timeout: 20000 });
    ronda.tCorrer = tCorrer;
    // el juego se abre en la sala de todas
    const abiertos = await Promise.all(lista.map(v => hastaQue(async () => marcoDe(v), f => !!f, 60000)));
    ok(`r${nr}: «¡A correr!» abre el juego de la sala en las ${lista.length}`, abiertos.every(Boolean), abiertos.map((f, k) => f ? null : lista[k].i + 1).filter(Boolean).join(',') || '');
    // la cortina de preparación y la pantalla de personajes
    const prep = await Promise.all(lista.map(v => hastaQue(() => leer(v), x => x.s === 0x49 && !x.cortina, 900000, 1000).then(x => ({ x, t: Date.now() }))));
    lista.forEach((v, k) => { (v.preparado ||= {})[nr] = prep[k].t - tCorrer; });
    ok(`r${nr}: las ${lista.length} pasan la cortina de preparación y llegan a elegir personaje (0x49)`, prep.every(r => r.x?.s === 0x49 && !r.x.cortina),
       prep.map((r, k) => `${lista[k].i + 1}: ${r.x?.s === 0x49 && !r.x.cortina ? ((r.t - tCorrer) / 1000).toFixed(0) + ' s' : 'NO ' + JSON.stringify(r.x && { s: r.x.s, cortina: r.x.cortina })}`).join(' · '));
    // las pistas
    if (estilo === 'copa') {
      await hastaQue(() => leer(H), x => x.picker, 60000);
      const puso = await marcoDe(H).evaluate(c => window.mkwSala.ponerPistas(c), pistas).catch(e => e.message);
      ok(`r${nr}: la anfitriona fija la copa (${pistas.length} pistas)`, puso === true, String(puso));
    } else {
      const x = await hastaQue(() => leer(H), x => /modo-lista/.test(x.modoPicker), 60000);
      const f = marcoDe(H);
      for (const nth of pistas) { await f.locator('#elegirPista .pista').nth(nth).click({ timeout: 10000 }).catch(() => {}); await espera(400); }
      await f.click('#listaConfirmar', { timeout: 10000 }).catch(() => {});
      ok(`r${nr}: la anfitriona arma la playlist de ${pistas.length} y la confirma`, /modo-lista/.test(x?.modoPicker || ''), x?.modoPicker);
    }
    // cada una elige personaje (las impares se corren a la derecha antes) con el teclado de su ventana
    const elegir = async (v, k) => {
      let vistoP = false, ultimo = 0;
      for (const hasta = Date.now() + 180000; Date.now() < hasta; await espera(400)) {
        const x = await leer(v);
        if (x?.eleccion) return x;
        if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
          if (!vistoP && x.pagina === 0x6B) { vistoP = true; await foco(v); await espera(700); for (let d = 0; d < k % 4; d++) { await tecla(v, 'KeyD'); await espera(300); } }
          if (Date.now() - ultimo > 1500) { ultimo = Date.now(); await foco(v); await tecla(v, 'KeyK'); }
        }
      }
      return await leer(v);
    };
    const el = await Promise.all(lista.map(elegir));
    ok(`r${nr}: las ${lista.length} eligen personaje y vehículo en el juego`, el.every(x => x?.eleccion), el.map((x, k) => x?.eleccion ? null : lista[k].i + 1).filter(Boolean).join(',') || '');

    const nCarreras = pistas.length;
    for (let n = 1; n <= nCarreras; n++) {
      const car = { n };
      ronda.carreras.push(car);
      const corren = humanosDe(lista);
      const enCarrera = x => x?.s === 0x20 && x.carrera === n && !x.cortina;
      // (la primera hasta 10 min: con 12 juegos en un PC la carga es lenta; después cada una 3 min más)
      const r0 = await hastaQue(() => leer(corren[0]), enCarrera, 600000, 1000);
      const rs = [r0, ...await Promise.all(corren.slice(1).map(v => hastaQue(() => leer(v), enCarrera, 180000, 1000)))];
      ok(`r${nr} c${n}: la carrera abre en las ${corren.length}`, rs.every(enCarrera), rs.map((x, k) => enCarrera(x) ? null : `${corren[k].i + 1}:${x?.s}/${x?.carrera}`).filter(Boolean).join(' '));
      const x0 = rs.find(Boolean);
      if (n === 1) ok(`r${nr}: la ficha del juego trae lo elegido (estilo, cc, CPU) y ${corren.length} humanos, el resto CPU`,
        rs.every(x => x?.q?.estilo === estilo && x.q.cc === cc && x.q.cpu === nivel) &&
        rs.every(x => x?.tipos?.filter(t => t === 0).length === corren.length && x.tipos.filter(t => t === 1).length === 12 - corren.length),
        `${x0?.q?.estilo}/${x0?.q?.cc}/${x0?.q?.cpu}, tipos ${x0?.tipos?.join('')}`);
      // todas aceleran (K apretada) cuando la carrera anda
      await Promise.all(corren.map(v => hastaQue(() => leer(v), x => x.etapa >= 2, 180000, 1000)));
      for (const v of corren) { await foco(v); await v.p.keyboard.down('KeyK').catch(() => {}); }
      await espera(5000);
      // la largada (§250): cuadro y hora de cada una; el segundo desde «¡A correr!» (carrera 1)
      const ya = await Promise.all(corren.map(leer));
      const lc = compararLargadas(ya.map(y => y?.ls), ya[0]?.ls?.carrera ?? n, 200);
      car.largadas = ya.map((y, k) => ({ v: corren[k].i + 1, largada: (y?.ls?.largadas || []).find(l => l.carrera === y?.ls?.carrera) || null }));
      const yaT = car.largadas.map(l => l.largada?.ya?.t).filter(Number.isFinite);
      if (n === 1) car.yaDesdeCorrer = car.largadas.map(l => l.largada?.ya ? +((l.largada.ya.t - tCorrer) / 1000).toFixed(1) : null);
      ok(`r${nr} c${n}: §250 las ${corren.length} largan en el mismo cuadro y a la vez`, lc.cumple, lc.detalle +
         (n === 1 ? ` · el ¡YA! a los ${car.yaDesdeCorrer.join('/')} s de «¡A correr!»` : yaT.length ? ` · ¡YA! dispersión ${(Math.max(...yaT) - Math.min(...yaT)).toFixed(0)} ms` : ''));
      // el tramo de 15 s: cuadros de lógica por segundo y la espera a otros, de cada una
      const tramo = async (etiqueta) => {
        const a = await Promise.all(corren.map(leer)), ta = Date.now();
        await espera(15000);
        const b = await Promise.all(corren.map(leer)), tb = Date.now();
        const filas = corren.map((v, k) => { const la = a[k]?.ls, lb = b[k]?.ls; if (!la || !lb) return { v: v.i + 1, sin: true };
          const dc = lb.cuadro - la.cuadro, dCu = Math.max(1, (lb.cuadros || 0) - (la.cuadros || 0));
          return { v: v.i + 1, logicaS: +(dc / ((tb - ta) / 1000)).toFixed(1), esperaMsCuadro: +(((lb.msEsperando || 0) - (la.msEsperando || 0)) / dCu).toFixed(2),
            juegoMs: b[k]?.inf?.juegoMs ?? null, fps: b[k]?.inf?.fps ?? null, retraso: lb.retraso, relevos: lb.relevos, pausas: lb.pausas,
            cortes: Array.isArray(lb.cortes) ? lb.cortes.length : lb.cortes, autoridad: lb.autoridad, huellas: lb.huellasIguales, desinc: !!lb.desincronizado }; });
        di(`  ${etiqueta}: ` + filas.map(f => f.sin ? `${f.v}: —` : `${f.v}: ${f.logicaS}/s esp ${f.esperaMsCuadro} juego ${f.juegoMs} ret ${f.retraso}`).join(' · '));
        return filas;
      };
      car.tramo = await tramo(`c${n} tramo (cuadros de lógica/s, ms de espera por cuadro, ms del juego, retraso)`);
      if (eventos.frenar === n && corren.length > 1) {
        const lento = corren[corren.length - 1];
        const s = await lento.p.context().newCDPSession(lento.p);
        await s.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        di(`  [${seg()} s] la ventana ${lento.i + 1} frenada: CPU ×4 (DevTools)`);
        await espera(3000);
        car.frenada = { ventana: lento.i + 1, tramo: await tramo(`c${n} con la ${lento.i + 1} frenada ×4`) };
        await s.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await s.detach().catch(() => {});
        const otros = car.frenada.tramo.filter(f => f.v !== lento.i + 1 && !f.sin), antes = car.tramo.filter(f => f.v !== lento.i + 1 && !f.sin);
        const med = xs => xs.length ? xs.reduce((a, f) => a + f.logicaS, 0) / xs.length : 0;
        car.frenada.otrosAntes = +med(antes).toFixed(1); car.frenada.otrosDurante = +med(otros).toFixed(1);
        ok(`r${nr} c${n}: con la ${lento.i + 1} frenada, las demás siguen (media de lógica/s ${car.frenada.otrosAntes} → ${car.frenada.otrosDurante}) y nadie se separa`,
           car.frenada.otrosDurante >= car.frenada.otrosAntes * 0.85 && !car.frenada.tramo.some(f => f.desinc),
           `la frenada: ${car.frenada.tramo.find(f => f.v === lento.i + 1)?.logicaS}/s`);
      }
      if (eventos.recargar === n) {
        const r = corren[Math.min(5, corren.length - 1)];
        di(`  [${seg()} s] la ventana ${r.i + 1} recarga la página a mitad de la carrera ${n}`);
        await r.p.keyboard.up('KeyK').catch(() => {});
        await r.p.reload({ timeout: 60000 }).catch(e => di('  (recarga: ' + e.message + ')'));
        r.recargo = n; r.fuera = true;
        await espera(20000);
        const resto = humanosDe(lista);
        const sig = await Promise.all(resto.map(leer));
        const cr = await hastaQue(async () => (await leer(r))?.cartel || '', t => !!t, 60000);
        ok(`r${nr} c${n}: tras la recarga de la ${r.i + 1} la carrera sigue en las demás y ella ve el cartel de «vuelves en la siguiente»`,
           sig.every(x => x?.s === 0x20 && !x.ls?.desincronizado) && !!cr, `cartel «${cr}»`);
      }
      if (eventos.echar === n) {
        const e = corren[Math.min(6, corren.length - 1)], uidE = (await leer(e))?.q?.uid;
        di(`  [${seg()} s] la anfitriona echa a la ventana ${e.i + 1} con la carrera andando`);
        H.p.once('dialog', d => d.accept());
        await H.p.locator(`.jg-mkw-vest [data-menu="${uidE}"]`).click({ timeout: 10000 }).catch(() => {});
        await H.p.locator('.jg-mkw-echa').first().click({ timeout: 10000 }).catch(() => {});
        const t = await hastaQue(() => vest(e), t => /te sacó/.test(t), 30000);
        e.fuera = true; e.echada = true;
        await espera(8000);
        const resto = humanosDe(lista), sig = await Promise.all(resto.map(leer));
        ok(`r${nr} c${n}: la anfitriona echa a la ${e.i + 1}: a ella se le va el juego y la carrera de las demás sigue`,
           /te sacó/.test(t || '') && !marcoDe(e) && sig.every(x => x?.s === 0x20 && !x.ls?.desincronizado), `«${(t || '').slice(-60)}»`);
      }
      // la meta por código, en el mismo cuadro en todas (3 a 6 s más adelante)
      const vivos = humanosDe(lista);
      const cs = await Promise.all(vivos.map(leer));
      const huellas = cs.map(x => x?.ls?.huellasIguales || 0), desinc = cs.filter(x => x?.ls?.desincronizado);
      if (vivos.length > 1) ok(`r${nr} c${n}: las huellas coinciden en las ${vivos.length} (la misma carrera)`, huellas.every(h => h >= 3) && !desinc.length,
         `iguales ${huellas.join(' ')}${desinc.length ? ' DESINC ' + JSON.stringify(desinc[0].ls.desincronizado) : ''}`);
      car.estadoFin = cs.map((x, k) => ({ v: vivos[k].i + 1, ls: x?.ls && { ...x.ls, largadas: undefined } }));
      for (const v of vivos) await v.p.keyboard.up('KeyK').catch(() => {});
      const meta = Math.max(...cs.map(x => x?.ls?.cuadro || 0)) + 360;
      await Promise.all(vivos.map(v => marcoDe(v)?.evaluate(c => window.mkwTerminarEn(c), meta).catch(() => {})));
      const fines = await Promise.all(vivos.map(v => hastaQue(() => leer(v), x => x.etapa >= 4, 240000, 1500)));
      await espera(6000);
      const ds = await Promise.all(vivos.map(leer));
      const pm = ds.map(x => JSON.stringify(x?.puntosMenu)), suma = (ds[0]?.puntosMenu || []).reduce((a, b) => a + b, 0);
      car.puntos = ds[0]?.puntosMenu;
      // (los puntos del juego son los de la copa entera: después de la carrera n suman 73·n)
      ok(`r${nr} c${n}: todas cruzan la meta (etapa 4) y los puntos de la copa son iguales en todas (suman ${73 * n})`,
         fines.every(x => x?.etapa >= 4) && pm.every(p => p === pm[0]) && suma === 73 * n, `${ds[0]?.puntosMenu?.join(',')} (suma ${suma})`);
      await Promise.all(vivos.map((v, k) => k < 4 ? foto(v, `r${nr}-c${n}-${v.i + 1}.png`) : null));
      if (n < nCarreras) {
        const dsc = await Promise.all(vivos.map(v => hastaQue(() => leer(v), x => x.descanso?.carrera === n, 60000)));
        ok(`r${nr} c${n}: el descanso de 30 s entre carreras (la cuenta al abrir, en todas)`, dsc.every(x => x?.descanso && x.descanso.restanAlAbrir > 25000 && x.descanso.restanAlAbrir <= 30000),
           dsc.map(x => x?.descanso?.restanAlAbrir).join(' '));
        if (eventos.recargar === n) { const r = lista.find(v => v.recargo === n); if (r) r.fuera = false; }
      }
    }
    // el fin de la copa: el podio y la sala de vuelta en el vestíbulo
    const vuelta = await hastaQue(() => vest(H), t => /¡A correr!/.test(t), 180000, 2000);
    const vivos = humanosDe(lista);
    const sinJuego = vivos.every(v => !marcoDe(v));
    ok(`r${nr}: la copa termina: la sala vuelve al vestíbulo con «¡A correr!» y el juego se cierra en todas`, /¡A correr!/.test(vuelta || '') && sinJuego, (vuelta || '').slice(0, 100));
    await foto(H, `r${nr}-fin.png`);
    ronda.caidas = lista.map(v => ({ v: v.i + 1, caidas: [...v.caidas] }));
    guardar();
    return ronda;
  }

  // ---------- ronda 0: la anfitriona sola (la vara) ----------
  if (RONDAS.includes(0)) await correrRonda(0, [A], { estilo: 'copa', cc: 'c150', nivel: 'maximo', pistas: [{ copa: 0, fila: 0 }] });

  // ---------- los demás llegan con el enlace, a la vez ----------
  const otros = ventanas.slice(1);
  const unirse = await Promise.all(otros.map(async v => {
    try {
      await v.p.goto(enlace);
      await v.p.getByRole('button', { name: /Unirse a la partida/ }).click({ timeout: 60000 });
      v.tUnido = Date.now(); return null;
    } catch (e) { return e.message.split('\n')[0]; }
  }));
  const n12 = await hastaQue(() => vest(A), t => new RegExp(`${N} de 12`).test(t), 60000);
  ok(`las ${N - 1} entran con el enlace: «${N} de 12» en el vestíbulo`, unirse.every(e => !e) && new RegExp(`${N} de 12`).test(n12 || ''),
     unirse.map((e, k) => e ? `${k + 2}: ${e}` : null).filter(Boolean).join(' | ') || '');
  // la precarga del vestíbulo: «● listo» de cada piloto (en el vestíbulo de la anfitriona)
  const listo = {};
  for (const hasta = Date.now() + 900000; Date.now() < hasta && Object.keys(listo).length < N; await espera(2000)) {
    const filas = await A.p.$$eval('.jg-mkw-vest .jg2-lista li', l => l.map(li => li.textContent.replace(/\s+/g, ' '))).catch(() => []);
    for (const v of ventanas) if (!listo[v.i] && filas.some(f => f.includes(v.nombre) && f.includes('● listo'))) { listo[v.i] = Date.now(); v.tListo = Date.now(); }
  }
  for (const v of ventanas) resultados.ventanas.push({ v: v.i + 1, nombre: v.nombre, sesionS: v.tSesion ? +((v.tSesion - v.tAbrir) / 1000).toFixed(1) : null,
    listoS: v.tListo ? +((v.tListo - v.tAbrir) / 1000).toFixed(1) : null });
  ok(`la precarga: los ${N} dicen «● listo» en el vestíbulo`, Object.keys(listo).length === N,
     resultados.ventanas.map(r => `${r.v}: ${r.listoS ?? '—'} s`).join(' · ') + ' (desde abrir Chrome)');
  await foto(A, 'vestibulo-12.png');
  guardar();

  // ---------- ronda 1: los 12 ----------
  // --corta (el dueño, 2026-11-09: «solo las esenciales, livianas y cortas»): una carrera, solo con la ventana frenada
  if (RONDAS.includes(1)) await correrRonda(1, ventanas, { estilo: 'copa', cc: 'c150', nivel: 'normal',
    pistas: args.includes('--corta') ? [{ copa: 0, fila: 0 }] : [{ copa: 0, fila: 0 }, { copa: 13, fila: 2 }, { copa: 1, fila: 1 }],
    eventos: args.includes('--corta') ? { frenar: 1 } : { frenar: 1, recargar: 2, echar: 3 } });

  // ---------- quedan 6: la anfitriona echa a las que sobran y pasa el anfitrión ----------
  const quedan = ventanas.slice(0, 6);
  if (RONDAS.some(r => r >= 2)) {
    for (const v of ventanas.slice(6)) {
      if (v.echada) continue;
      const filas = await A.p.$$eval('.jg-mkw-vest .jg2-lista li', (l, n) => l.filter(li => li.textContent.includes(n)).map(li => li.querySelector('[data-menu]')?.dataset.menu), v.nombre).catch(() => []);
      if (!filas[0]) continue;
      A.p.once('dialog', d => d.accept());
      await A.p.locator(`.jg-mkw-vest [data-menu="${filas[0]}"]`).click({ timeout: 10000 }).catch(() => {});
      await A.p.locator('.jg-mkw-echa').first().click({ timeout: 10000 }).catch(() => {});
      v.fuera = true; v.echada = true;
      await espera(1500);
    }
    for (const v of ventanas.slice(6)) await v.ctx.close().catch(() => {});   // (las echadas cierran su Chrome: no gastan CPU)
    const seis = await hastaQue(() => vest(A), t => /6 de 12/.test(t), 30000);
    ok('la anfitriona echa a las 6 que sobran en el vestíbulo: «6 de 12»', /6 de 12/.test(seis || ''), (seis || '').slice(0, 80));
    const uidDos = await A.p.$$eval('.jg-mkw-vest .jg2-lista li', l => l.filter(li => li.textContent.includes('Piloto Dos')).map(li => li.querySelector('[data-menu]')?.dataset.menu)[0]).catch(() => null);
    await A.p.locator(`.jg-mkw-vest [data-menu="${uidDos}"]`).click({ timeout: 10000 }).catch(() => {});
    await A.p.locator('.jg-mkw-dar').first().click({ timeout: 10000 }).catch(() => {});
    const dosManda = await hastaQue(async () => await ventanas[1].p.locator('.jg-mkw-vest [data-cambiar]').count(), c => c > 0, 30000);
    const unoNo = await A.p.locator('.jg-mkw-vest [data-cambiar]').count().catch(() => -1);
    ok('el cambio de anfitrión: Piloto Uno pasa el anfitrión a Piloto Dos (Dos ve «✎ Cambiar», Uno ya no)', dosManda > 0 && unoNo === 0, `Dos ${dosManda} · Uno ${unoNo}`);
    if (dosManda > 0) anfitrion = 1;
    for (const v of quedan) v.fuera = false;
  }
  const RONDAS_SEIS = { 2: { estilo: 'playlist', cc: 'espejo', nivel: 'dificil', pistas: [0] },
    3: { estilo: 'copa', cc: 'c100', nivel: 'intenso', pistas: [{ copa: 2, fila: 0 }] },
    4: { estilo: 'playlist', cc: 'azar', nivel: 'facil', pistas: [9] },
    5: { estilo: 'copa', cc: 'c150', nivel: 'imposible', pistas: [{ copa: 20, fila: 3 }] } };
  for (const r of [2, 3, 4, 5]) if (RONDAS.includes(r)) await correrRonda(r, quedan, RONDAS_SEIS[r]);

  // ---------- la máquina contra la red: cada ronda contra la ventana sola ----------
  const vara = resultados.rondas.find(r => r.n === 0)?.carreras?.[0]?.tramo?.[0];
  if (vara) for (const r of resultados.rondas.filter(r => r.n > 0)) {
    const t = r.carreras[0]?.tramo?.filter(f => !f.sin) || [];
    if (!t.length) continue;
    const med = k => (t.reduce((a, f) => a + (f[k] || 0), 0) / t.length).toFixed(2);
    di(`ronda ${r.n} (${r.humanos} ventanas): lógica/s media ${med('logicaS')} (sola ${vara.logicaS}), juego ms ${med('juegoMs')} (sola ${vara.juegoMs}), espera a otros ${med('esperaMsCuadro')} ms/cuadro (sola ${vara.esperaMsCuadro})`);
  }
  const caidas = ventanas.filter(v => v.caidas.length);
  ok('ninguna página se cayó (pageerror / crash)', !caidas.length, caidas.map(v => `${v.i + 1}: ${v.caidas[0].slice(0, 120)}`).join(' | '));
  codigo = mal ? 1 : 0;
} catch (e) {
  di('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  try {
    const c = await (await fetch(`http://127.0.0.1:${PUERTO + 1}/__cuenta?lista=1`)).json();
    di(`· llamadas al Worker: ${c.pedidos}`);
  } catch {}
  di(`\n${bien} bien, ${mal} mal  (${((Date.now() - T0) / 60000).toFixed(1)} min; build/web/datos/doce-sitio/)`);
  guardar();
  for (const v of ventanas) await v.ctx.close().catch(() => {});
  matar(ensayo);
  // (como prueba-experiencia: el java del emulador a veces sobrevive; los puertos + 20000 son solo de esta prueba)
  if (ensayo && process.platform === 'win32') {
    const propios = new Set([9099, 9000, 9199, 4400, 4500].map(p => String(p + DESPLAZAR)));
    const pids = new Set(spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout.split('\n')
      .map(l => l.trim().split(/\s+/)).filter(c => c[3] === 'LISTENING' && propios.has(c[1].split(':').pop())).map(c => c[4]));
    for (const pid of pids) spawnSync('taskkill', ['/pid', pid, '/T', '/F']);
  }
  fs.rmSync(perfiles, { recursive: true, force: true });
  process.exit(codigo);
}
