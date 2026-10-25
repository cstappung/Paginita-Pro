// Prueba con el juego de verdad: los casos de desconexión de la sala — bitácora §100 (PLAN M24).
//
// Resumen: el dueño vio la carrera pegada («me desconecté de un jugador cuando empezaba la partida, cuando el contador
// llegó a 0 no pasó nada, se quedó pegado, debiera seguir jugando con los que quedan») y pidió un banco con los distintos
// casos de desconexión. Esta prueba abre 2 o 3 pestañas del juego como computadores de una sala (?modo=sala, malla
// WebRTC con el buzón falso del banco; A es la anfitriona) y, en cada caso, una se va en otro momento:
//   cuándo: eligiendo personaje · cargando la carrera · en la cuenta regresiva · en plena carrera · en el descanso;
//   quién:  la anfitriona (la que hace avanzar la sala) · otro piloto;
//   cómo:   cierra la pestaña · se le corta internet (sale del buzón y de la malla: mkwCortarRed('todo')) · se le parte
//           solo la conexión directa con los demás (sigue en el buzón: mkwCortarRed('rtc')) · se le parte solo la
//           conexión con la anfitriona (mkwCortarRed('rtc', A): la sala le llega por B, §100 H1.4);
// y comprueba que los que quedan siguen (y, §100 H1.2, que la prueba de conexión de cada pestaña dice lo que pasa:
// todas 🟢 al empezar; con A ↔ C partida, cada una ve a la otra «por B»): si se fue la anfitriona manda otra, la carrera abre y corre (sus cuadros
// avanzan) y nadie queda con la pantalla quieta más de lo que permite cada caso. Al que se le cortó la red también le
// sigue su juego (corre solo con la CPU). Lo que anotó la red de cada pestaña queda en build/web/datos/desconexion/.
//
// Uso:  node web/navegador/prueba-desconexion.mjs [--casos=elegir-anfitriona,carga-otro,…] [--lista] [--ventana] [--puerto=8166]
//       (sin --casos, todos: ~20 min)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const PUERTO = Number(arg('puerto', 8166));
const carpeta = path.join(raiz, 'build/web/datos/desconexion');
mkdirSync(carpeta, { recursive: true });

// Los casos: n pestañas; quién se va (A = la anfitriona); cuándo; cómo; y lo más que puede durar la pantalla quieta de
// los que quedan después de que se fue (pegadaMax, en segundos; en el sitio, el buzón de verdad avisa antes que el falso,
// que borra la presencia de una pestaña 4 s después de su último latido)
const CASOS = {
  'elegir-anfitriona': { n: 2, quien: 'A', cuando: 'elegir', como: 'cerrar' },        // lo que vio el dueño
  'elegir-otro': { n: 2, quien: 'B', cuando: 'elegir', como: 'cerrar' },
  'carga-otro': { n: 2, quien: 'B', cuando: 'carga', como: 'cerrar', pegadaMax: 8 },
  'carga-anfitriona': { n: 2, quien: 'A', cuando: 'carga', como: 'cerrar', pegadaMax: 8 },
  'cuenta-otro': { n: 2, quien: 'B', cuando: 'cuenta', como: 'cerrar', pegadaMax: 3 },
  'carrera-anfitriona': { n: 2, quien: 'A', cuando: 'carrera', como: 'cerrar', pegadaMax: 3, segunda: true },
  'descanso-anfitriona': { n: 2, quien: 'A', cuando: 'descanso', como: 'cerrar' },
  'rtc-anfitriona': { n: 2, quien: 'A', cuando: 'elegir', como: 'rtc' },
  'red-tres': { n: 3, quien: 'C', cuando: 'carrera', como: 'todo', pegadaMax: 3 },
  'anfitriona-tres': { n: 3, quien: 'A', cuando: 'carga', como: 'cerrar', pegadaMax: 8 },
  'par-tres': { n: 3, quien: 'C', cuando: 'elegir', como: 'par' },                  // §100 (H1.2/H1.4)
};
if (process.argv.includes('--lista')) { for (const [k, c] of Object.entries(CASOS)) console.log(k, JSON.stringify(c)); process.exit(0); }
const elegidos = arg('casos', '') ? arg('casos', '').split(',') : Object.keys(CASOS);
for (const k of elegidos) if (!CASOS[k]) { console.log(`no existe el caso ${k} (--lista)`); process.exit(2); }

let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const COPA = [{ copa: 0, fila: 0 }, { copa: 13, fila: 2 }];

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });

// lo que se mira de cada pestaña: la sección del juego, la sala (fase, quién manda, quiénes están fuera) y la carrera
// sincronizada (cuadro, cortes)
const leer = p => Promise.race([espera(6000).then(() => null), p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), S = window.mkwSala, se = S?.estado(), ls = window.mkwSincro?.lockstep?.estado();
  return { s: e.seccion, pagina: e.pagina, cortina: !document.body.classList.contains('sin-cortina'), etapa: ri ? L.u32(ri + 0x28) : -1,
    piloto: window.mkwEstado.piloto || null, lista: !!S?.lista, jefe: S?.anfitrion || null, soy: !!S?.soyAnfitrion,
    sala: se ? { fase: se.fase, carrera: se.carrera, fuera: se.fuera || [], version: se.version, terminaron: Object.keys(se.terminaron || {}), plazo: se.plazo } : null,
    ls: ls ? { cuadro: ls.cuadro, carrera: ls.carrera, cortes: ls.cortes, fuera: ls.fuera } : null,
    aviso: document.getElementById('avisoJuego')?.hidden ? '' : document.getElementById('avisoJuego')?.textContent || '',
    con: (window.mkwEstado.conexiones || []).map(c => ({ uid: c.uid, e: c.e, ms: c.ms ?? null, por: c.por || null })) };
})]).catch(() => null);
const esperarQue = async (p, cond, tope) => { for (const hasta = Date.now() + tope; Date.now() < hasta;) { const x = await leer(p); if (x && cond(x)) return x; await espera(250); } return await leer(p); };
const enCarrera = (x, n) => x?.s === 0x20 && x.piloto?.carrera === n && x.ls?.carrera === n;

async function correrCaso(nombre, def) {
  console.log(`\n— ${nombre}: ${def.n} pestañas; se va ${def.quien === 'A' ? 'la anfitriona (A)' : def.quien} ${{ elegir: 'eligiendo personaje', carga: 'al cargar la carrera', cuenta: 'en la cuenta regresiva', carrera: 'en plena carrera', descanso: 'en el descanso' }[def.cuando]}; ${{ cerrar: 'cierra la pestaña', todo: 'se le corta internet', rtc: 'se le parte la conexión directa (sigue en el buzón)', par: 'se le parte solo la conexión con la anfitriona (sigue con B)' }[def.como]}`);
  const t0 = Date.now(), seg = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  const contexto = await navegador.newContext({ viewport: { width: 800, height: 450 } });
  const sala = 'desc-' + Date.now().toString(36);
  const letras = ['A', 'B', 'C'].slice(0, def.n), uids = letras.map(l => l.toLowerCase() + sala), pag = {};
  const errores = [];
  for (const [i, l] of letras.entries()) {
    const p = pag[l] = await contexto.newPage();
    p.on('pageerror', e => errores.push(`[${l}] ${e.message}`));
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&red=malla&senal=canal&sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}&jefe=${uids[0]}` +
      `&semilla=4242&modo=sala&estilo=copa&carreras=2&cc=c150&cpu=normal&descanso=6&limite=120`);
    if (i < letras.length - 1) await espera(1500);
  }
  const quedan = letras.filter(l => l !== def.quien);
  // los que siguen jugando: los que quedan y, si no cerró la pestaña, también el que se cortó (sigue solo)
  const siguen = def.como === 'cerrar' ? quedan : letras;
  try {
    // 1) todas arrancadas en la pantalla de personajes, la copa puesta
    for (const l of letras) await esperarQue(pag[l], x => x.lista && x.s === 0x49 && !x.cortina, 150000);
    await pag.A.evaluate(c => window.mkwSala.ponerPistas(c), COPA);
    for (const l of letras) await esperarQue(pag[l], x => x.sala?.fase === 'elegir', 15000);
    // §100 (H1.2): la prueba de conexión de cada pestaña: todas se ven 🟢 directa (en esta PC no hace falta el repetidor)
    {
      const xs = await Promise.all(letras.map(l => esperarQue(pag[l], x => x.con.length === def.n - 1 && x.con.every(c => c.e === 'directa'), 20000)));
      ok(`${nombre}: al empezar, cada pestaña ve a las otras 🟢 directa`, xs.every(x => x?.con.length === def.n - 1 && x.con.every(c => c.e === 'directa')),
         xs.map((x, i) => `${letras[i]}: ${(x?.con || []).map(c => `${c.uid.slice(0, 1).toUpperCase()} ${c.e}${c.ms != null ? ` ${c.ms} ms` : ''}`).join(', ')}`).join(' · '));
    }
    const elegir = async ls => { for (const l of ls) await pag[l].evaluate(i => window.mkwSala.elegi({ personaje: 1 + 3 * i, vehiculo: 1, derrape: 0 }), letras.indexOf(l)); };
    // 2) hasta el momento del caso
    let antes = null;
    if (def.cuando === 'elegir') { await elegir(quedan); await espera(1000); }
    else {
      await elegir(letras);
      const mira = pag[quedan[0]];
      if (def.cuando === 'carga') antes = await esperarQue(mira, x => x.sala?.fase === 'correr', 30000);
      else if (def.cuando === 'cuenta') antes = await esperarQue(mira, x => enCarrera(x, 1) && x.etapa === 1, 120000);
      else if (def.cuando === 'carrera') antes = await esperarQue(mira, x => enCarrera(x, 1) && x.ls.cuadro >= 900, 150000);
      else if (def.cuando === 'descanso') {
        for (const l of letras) await esperarQue(pag[l], x => enCarrera(x, 1) && x.ls.cuadro >= 400, 150000);
        const xs = await Promise.all(letras.map(l => leer(pag[l])));
        const meta = Math.max(...xs.map(x => x?.ls?.cuadro || 0)) + 300;
        for (const l of letras) await pag[l].evaluate(c => window.mkwTerminarEn(c, 1), meta);
        antes = await esperarQue(mira, x => x.sala?.terminaron.includes('1') && x.sala.plazo > 0, 60000);
      }
    }
    ok(`${nombre}: llegamos al momento del caso`, def.cuando === 'elegir' || !!antes, `${def.cuando} a los ${seg()}${antes?.ls ? `, cuadro ${antes.ls.cuadro}` : ''}`);
    // 3) se va
    const tFue = Date.now();
    if (def.como === 'cerrar') await pag[def.quien].close();
    else if (def.como === 'par') await pag[def.quien].evaluate(u => window.mkwCortarRed('rtc', u), uids[0]);
    else await pag[def.quien].evaluate(m => window.mkwCortarRed(m), def.como);
    // §100 (H1.2/H1.4): con A ↔ C partida, la sala sigue con A por B, y la prueba de conexión lo dice en las dos
    if (def.como === 'par') {
      const L = l => uids[letras.indexOf(l)], porB = (x, u) => x?.con.find(c => c.uid === u && c.e === 'puente' && c.por === L('B'));
      const [xa, xc] = await Promise.all([esperarQue(pag.A, x => porB(x, L('C')), 20000), esperarQue(pag.C, x => porB(x, L('A')), 20000)]);
      const ver = x => (x?.con || []).map(c => `${c.uid.slice(0, 1).toUpperCase()} ${c.e}${c.por ? ' por ' + c.por.slice(0, 1).toUpperCase() : ''}`).join(', ');
      ok(`${nombre}: A ve a C 🔴 «por B» y C a A igual (a los ${((Date.now() - tFue) / 1000).toFixed(0)} s)`, !!porB(xa, L('C')) && !!porB(xc, L('A')), `A: ${ver(xa)} · C: ${ver(xc)}`);
      const xb = await leer(pag.B);
      ok(`${nombre}: B ve a las dos 🟢 directa`, xb?.con.length === 2 && xb.con.every(c => c.e === 'directa'), `B: ${ver(xb)}`);
      const xs = await Promise.all(letras.map(l => leer(pag[l])));
      ok(`${nombre}: sigue mandando A en las tres (sin reemplazo)`, xs.every(x => x?.jefe === uids[0]), xs.map(x => x?.jefe?.slice(0, 1)).join(','));
    }
    // 4) lo que tiene que pasar en cada uno de los que siguen (todas las pestañas a la vez: así cada tiempo es el suyo)
    const revisar = async l => {
      const p = pag[l], solo = l === def.quien && def.como !== 'par', r = [], anota = (t, c, d = '') => r.push([t, c, d]);
      const quien = solo ? `${l} (sola, sin red)` : l;
      // la anfitriona: si se fue A, manda la primera que queda (en la isla del que se cortó, él mismo)
      if (def.quien === 'A') {
        const esperado = solo ? uids[0] : uids[letras.indexOf(quedan[0])];
        const x = await esperarQue(p, y => y.jefe === esperado, 20000);
        anota(`${nombre}: ${quien} — manda ${esperado === uids[letras.indexOf(l)] ? 'ella' : esperado.slice(0, 1).toUpperCase()} (la sala no se queda sin anfitriona)`,
           x?.jefe === esperado, `a los ${((Date.now() - tFue) / 1000).toFixed(1)} s de irse A · jefe ${x?.jefe?.slice(0, 1)}`);
      }
      const n = def.cuando === 'descanso' ? 2 : 1;
      if (['elegir', 'descanso'].includes(def.cuando)) {
        // el reloj de elegir (o el descanso) llega a 0 y la carrera abre (sin el que se fue)
        const x = await esperarQue(p, y => enCarrera(y, n) && y.ls.cuadro >= 0, 120000);
        anota(`${nombre}: ${quien} — la carrera ${n} abre`, enCarrera(x, n), `a los ${((Date.now() - tFue) / 1000).toFixed(0)} s · sección 0x${(x?.s ?? 0).toString(16)}, fase ${x?.sala?.fase} ${x?.sala?.carrera}`);
        const otro = solo ? letras.find(k => k !== l) : def.quien;
        if (def.como === 'par') anota(`${nombre}: ${quien} — nadie va fuera (la sala le llega a C por B)`, x?.sala?.fuera.length === 0, `fuera: ${x?.sala?.fuera.map(u => u.slice(0, 1)).join(',') || 'nadie'}`);
        else anota(`${nombre}: ${quien} — ${otro} va fuera de esa carrera (nadie lo espera)`, !!x?.sala?.fuera.includes(uids[letras.indexOf(otro)]), `fuera: ${x?.sala?.fuera.map(u => u.slice(0, 1)).join(',')}`);
      }
      // la carrera corre: sus cuadros avanzan, y lo más que estuvo quieta desde que se fue
      let c0 = (await leer(p))?.ls?.cuadro ?? -1, tC = Date.now(), quieta = 0;
      const desde = c0, hasta = Date.now() + 45000, avisos = new Set();
      let ultimo = null;
      while (Date.now() < hasta) {
        const x = await leer(p); ultimo = x;
        if (x?.aviso) avisos.add(x.aviso);
        const c = x?.ls?.carrera === n ? x.ls.cuadro : -1;
        if (c > c0) { c0 = c; tC = Date.now(); } else quieta = Math.max(quieta, (Date.now() - tC) / 1000);
        if (c0 >= Math.max(0, desde) + 600) break;
        await espera(250);
      }
      anota(`${nombre}: ${quien} — la carrera ${n} sigue corriendo (avanzó ${Math.max(0, c0 - Math.max(0, desde))} cuadros)`, c0 >= Math.max(0, desde) + 300,
         `cuadro ${desde} → ${c0}; cortes ${JSON.stringify(ultimo?.ls?.cortes || {})}${ultimo?.aviso ? ` · aviso «${ultimo.aviso.slice(0, 90)}»` : ''}`);
      // (en la carga: desde que se fue hasta el primer cuadro que avanzó, más lo que estuvo quieta después)
      if (def.pegadaMax && !solo) anota(`${nombre}: ${quien} — la pantalla quieta, a lo más ${def.pegadaMax} s`, quieta <= def.pegadaMax, `${quieta.toFixed(1)} s`);
      // §100: al que queda no se le dice que se cortó SU conexión cuando el otro cerró la página (se fue del buzón). (Si
      // solo se partió la conexión directa, desde este lado no se sabe de quién es la culpa: ahí el aviso puede salir)
      const mio = [...avisos].some(t => t.includes('Se cortó TU conexión'));
      if (!solo && def.como === 'cerrar') anota(`${nombre}: ${quien} — no le dice «se cortó TU conexión» (el que se fue es otro)`, !mio, [...avisos].map(t => `«${t.slice(0, 70)}»`).join(' ') || 'sin avisos');
      return r;
    };
    for (const r of await Promise.all(siguen.map(revisar))) for (const x of r) ok(...x);
    // 5) la carrera 2 después de que se fue la anfitriona en plena carrera: la que manda ahora la cierra y abre la siguiente
    if (def.segunda) {
      // (cada una termina su carrera por código, unos cuadros más adelante: ya no hay con quién coincidir)
      for (const l of quedan) await pag[l].evaluate(() => window.mkwTerminarEn(window.mkwSincro.lockstep.estado().cuadro + 120, 1));
      for (const l of quedan) {
        const x = await esperarQue(pag[l], y => enCarrera(y, 2) && y.ls.cuadro >= 120, 90000);
        ok(`${nombre}: ${l} — terminada la 1, la sala sigue sin A: abre la carrera 2 y corre`, enCarrera(x, 2) && x.ls.cuadro >= 120, `fase ${x?.sala?.fase} ${x?.sala?.carrera}, cuadro ${x?.ls?.cuadro}`);
      }
    }
    ok(`${nombre}: ninguna página se cayó (pageerror)`, !errores.length, errores.slice(0, 3).join(' | '));
  } catch (e) {
    ok(`${nombre}: el caso corrió sin errores`, false, e.stack || e.message);
  }
  for (const l of letras) {
    const p = pag[l];
    if (p.isClosed()) continue;
    writeFileSync(path.join(carpeta, `${nombre}-${l}.txt`), await p.evaluate(() => (window.mkwRed?.registro || []).join('\n')).catch(() => '') || '');
  }
  await contexto.close();
}

for (const k of elegidos) await correrCaso(k, CASOS[k]);
console.log(`\n${bien} bien, ${mal} mal`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
