// El simulador de sala mixta con el juego de verdad (bitácora §281; el dueño, 2026-11-11: «haz que simule mejor el
// multiplayer tipo distintos PCs, lag, etc.» y «distintos settings gráficos: algunos con 30, algunos con 60, algunos con
// N8, otro sin N8»).
//
// Resumen general: corre la sala de verdad (?modo=sala: la copa de UNA carrera, elegir en la pantalla de personajes, la
// carrera, el fin con los puntos y la tabla) con 2 a 6 jugadores en este PC, cada uno como si fuera OTRO aparato:
//   - su propio Chrome (otro proceso, con su propio proceso de la tarjeta) y su perfil (otra caché, otro localStorage);
//     la señal del banco cruza entre ellos por herramientas/puente-contextos.mjs y la carrera va por WebRTC de verdad;
//   - su procesador (DevTools: Emulation.setCPUThrottlingRate ×N, puesto al terminar de elegir personaje: la carga del
//     programa no se mide aquí), su ventana y su densidad de pantalla (dpr), su monitor (60 Hz = Chrome sin ventana, que
//     refresca a 60; 144 Hz = una ventana en el monitor de 144), su reloj corrido unos ms (Date.now, sin tocar el juego);
//   - su red (?redSim, web/navegador/red-simulada.mjs: bajada y subida aparte, pérdida, ancho de banda, picos, un corte y
//     un cambio de red a mitad de carrera) y sus gráficos (?n8, ?salida, ?fluidez, ?quitarEfectos, ?texturasMenos);
//   - los tirones (el hilo de la página trabado 0,5–2 s) y la pestaña escondida un rato, a la hora que dice la semilla.
// Los escenarios con nombre están en web/navegador/sala-mixta.mjs (los mismos con la misma semilla). Al final, el informe
// ✓/✗ de cada escenario (evaluar): las huellas (o las CPU iguales en «Cada uno su kart»), cuánto se adelanta el más
// rápido, la largada pareja, inventados y relevos, lógica/s, imágenes/s y 1 % bajo de cada uno con la causa de los picos,
// los avisos 📶, quién quedó fuera y por qué, y los puntos, la tabla y el VR iguales en todos.
// Como un banco de ensayo de un tablero con varias cargas distintas colgadas a la vez, cada una con su propia línea: se
// mira si las protecciones (el relevo, el freno, la largada pareja) actúan bien sin cortar a quien no corresponde.
// SOLO busca fallas de sincronía y de ritmo. NO da veredictos de rendimiento: con 6 juegos en un PC cada uno va más
// lento que en su propio aparato (esos se miden en este PC a toda potencia y en el teléfono de verdad).
//
// Uso:  MKW_BUILD=build/web-final-269b/navegador node herramientas/sala-mixta.mjs --escenario parejos[,uno-lento…]
//         [--modo lockstep|estado] [--conexion host|cloudflare] [--semilla 1] [--segundos 60] [--puerto 8190]
//         [--datos build/web/datos/sala-mixta/<fecha>] [--extra "&param=…"] [--lista]
//       node herramientas/sala-mixta.mjs --resumen <carpeta>   (rehace resumen.md desde los .json, con el tráfico extrapolado a 12)
//       (con el candado: herramientas/tanda-sala-mixta.sh, que es como se corre siempre)
// Salida: <datos>/<escenario>-<modo>-<conexion>.json + .md (el informe) y una fila en <datos>/resumen.md
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { manejar } from './piloto-ruta.mjs';
import { crearTurn } from './turn-local.mjs';
import { compararLargadas } from '../web/navegador/largada-pareja.mjs';
import { errorTrayectoria, atrasoDeVista, posicionEn, distancia } from '../web/navegador/red-estado.mjs';
import { ESCENARIOS, REDES, armarEscenario, parametrosDe, lineaDeTiempo, evaluar, filaResumen } from '../web/navegador/sala-mixta.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
if (process.argv.includes('--lista')) { for (const [n, e] of Object.entries(ESCENARIOS)) console.log(`${n.padEnd(20)} ${e.descripcion}`); process.exit(0); }
// --resumen CARPETA: rehace resumen.md desde los .json de esa carpeta (el último de cada escenario y variante), con el
// veredicto vuelto a calcular (sirve si cambió evaluar) y la tabla de tráfico de «seis-iguales» extrapolada a 12
if (process.argv.includes('--resumen')) {
  const letra = i => String.fromCharCode(65 + i);
  const dir = opcion('--resumen');
  const filas = ['| escenario | modo | jugadores | puntos ✓ | lógica/s | imágenes/s | 1 % bajo | falló |', '|---|---|---|---|---|---|---|---|'];
  const orden = Object.keys(ESCENARIOS), trafico = [];
  const js = fs.readdirSync(dir).filter(f => /\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => orden.indexOf(a.escenario.nombre) - orden.indexOf(b.escenario.nombre) || a.modo.localeCompare(b.modo) || a.conexion.localeCompare(b.conexion));
  for (const R of js) {
    const pts = R.error && !R.jugadores.length ? [{ texto: 'el escenario corrió entero', ok: false }] : evaluar(R.escenario, R);
    if (R.error && R.jugadores.length) pts.unshift({ texto: 'el escenario corrió entero', ok: false });
    filas.push(filaResumen(R.escenario, `${R.modo}${R.conexion === 'cloudflare' ? ' 🛰' : ''}`, pts, R.jugadores.length ? R.jugadores : R.escenario.jugadores.map(() => ({}))));
    if (R.escenario.jugadores.length >= 6 && R.jugadores.length && R.jugadores.every(j => j.trafico && (j.logica ?? 0) > 5)) trafico.push(R);
  }
  if (trafico.length) {
    // El modelo por «chorros» (lo que un jugador manda a CADA otro, KB/s): con 6, los «grandes» (los que suben más del
    // doble de la mediana: la anfitriona de «Cada uno su kart», que manda las CPU; la autoridad y el suplente del lockstep,
    // que mandan los botones de todos) y los comunes. Con 12 HUMANOS (la meta del dueño):
    //   estado:   no quedan CPU → todos son comunes: cada uno sube y baja 11 chorros comunes
    //   lockstep: el chorro de los grandes lleva los botones de todos → se multiplica por 12/6 (cota alta: la cabecera no
    //             crece); grandes suben 11 de esos; los comunes suben 11 comunes (cota: hoy los botones van solo a 3) y
    //             bajan 2 grandes + 9 comunes
    // Es una COTA de ingeniería (como dimensionar un conductor por la corriente máxima), no una medida con 12.
    filas.push('', '**Tráfico medido con 6 y la cota para 12 humanos** (KB/s; «chorro» = lo que uno manda a cada otro; ver el modelo en sala-mixta.mjs)', '',
      '| escenario | modo | quién | ↑ con 6 | ↓ con 6 | chorro | ↑ con 12 | ↓ con 12 | ↑ kbit/s con 12 | kart remoto (m) |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const R of trafico) {
      const m = R.remotos?.length ? (R.remotos.reduce((a, x) => a + x.medio, 0) / R.remotos.length / 100).toFixed(1) : '—';
      const med = xs => xs.reduce((a, b) => a + b, 0) / xs.length, n = R.jugadores.length;
      const subidas = R.jugadores.map(j => j.trafico.sube.kbs), mediana = [...subidas].sort((a, b) => a - b)[Math.floor(n / 2)];
      const grandes = R.jugadores.filter(j => j.trafico.sube.kbs > 2 * mediana), comunes = R.jugadores.filter(j => !grandes.includes(j));
      const sg = grandes.length ? med(grandes.map(j => j.trafico.sube.kbs)) / (n - 1) : 0, sc = med(comunes.map(j => j.trafico.sube.kbs)) / (n - 1);
      const g12 = sg * 12 / n;
      const filasM = R.modo === 'estado'
        ? [['cada uno de los otros; con 12 todos (sin CPU)', comunes, 11 * sc, 11 * sc, sc]]
        : [[`los grandes (${grandes.map(j => letra(j.i)).join(', ') || '—'})`, grandes, 11 * g12, 2 * g12 + 9 * sc, sg], ['los comunes', comunes, 11 * sc, 2 * g12 + 9 * sc, sc]];
      if (R.modo === 'estado' && grandes.length) filas.push(`| ${R.escenario.nombre} | ${R.modo} | la anfitriona con 6 (${grandes.map(j => letra(j.i)).join(', ')}) | ${med(grandes.map(j => j.trafico.sube.kbs)).toFixed(1)} | ${med(grandes.map(j => j.trafico.baja.kbs)).toFixed(1)} | ${sg.toFixed(2)} | — | — | — | ${m} |`);
      for (const [q, js2, su12, ba12, ch] of filasM) {
        if (!js2.length) continue;
        filas.push(`| ${R.escenario.nombre} | ${R.modo} | ${q} | ${med(js2.map(j => j.trafico.sube.kbs)).toFixed(1)} | ${med(js2.map(j => j.trafico.baja.kbs)).toFixed(1)} | ${ch.toFixed(2)} | ${su12.toFixed(1)} | ${ba12.toFixed(1)} | ${(su12 * 8.192).toFixed(0)} | ${m} |`);
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'resumen.md'), filas.join('\n') + '\n');
  console.log(filas.join('\n'));
  process.exit(0);
}
const NOMBRES = opcion('--escenario', 'parejos').split(',').filter(Boolean);
const MODO = opcion('--modo', 'lockstep'), CONEXION = opcion('--conexion', 'host');
const SEMILLA = Number(opcion('--semilla', 1)), SEGUNDOS = Number(opcion('--segundos', 60)), PUERTO = Number(opcion('--puerto', 8190));
const EXTRA = opcion('--extra', '');
const fecha = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace(/[:T]/g, '-');
const DATOS = opcion('--datos', path.join('build/web/datos/sala-mixta', fecha));
fs.mkdirSync(DATOS, { recursive: true });
if (!['lockstep', 'estado'].includes(MODO) || !['host', 'cloudflare'].includes(CONEXION)) throw new Error('--modo lockstep|estado, --conexion host|cloudflare');
const espera = ms => new Promise(r => setTimeout(r, ms));
// (los tramos de varios pares juntos: la media de las medias y el peor p90)
const juntar = xs => Object.fromEntries(['antes', 'durante', 'despues'].map(q => { const v = xs.map(x => x[q]).filter(Boolean);
  return [q, v.length ? { n: v.reduce((a, x) => a + x.n, 0), medio: Math.round(v.reduce((a, x) => a + x.medio, 0) / v.length), p90: Math.max(...v.map(x => x.p90)) } : null]; }));
const letra = i => String.fromCharCode(65 + i);
const conTope = (pr, ms, si) => Promise.race([pr, espera(ms).then(() => si)]).catch(() => si);
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);

// lo que se lee de cada página (con tope: una página trabada no traba al banco)
const leer = p => conTope(p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), rd = L.u32(0x809BD728);
  return { s: e.seccion, pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, logica: ri ? L.u32(ri + 0x1C) + L.u32(ri + 0x20) : 0, relojMs: (() => { try { const r = L.u32(ri + 0x14); return r ? (L.u16(r + 8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC) : 0; } catch { return 0; } })(),
    tt: performance.timeOrigin + performance.now(), modo: rd ? L.u32(rd + 0x20 + 0xB48 + 0x8) : -1, eleccion: window.mkwEstado.eleccion || null,
    sala: window.mkwEstado.sala || null, picker: !!document.getElementById('elegirPista'), cortina: !document.body.classList.contains('sin-cortina'),
    ls: window.mkwSincro?.lockstep?.estado?.() ?? null, karts: (() => { try { return L.u8(L.u32(0x809C18F8) + 0x24); } catch { return -1; } })() };
}), 10000, { colgada: true });
const esperarQue = async (p, f, tope, que, k) => { let aviso = Date.now() + 20000;
  for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x && !x.colgada && f(x)) return x;
    if (Date.now() > aviso) { aviso = Date.now() + 20000; console.log(`  … ${letra(k)} ${que}: ${JSON.stringify(x && { s: x.s, pagina: x.pagina, etapa: x.etapa, fase: x.sala?.fase, colgada: x.colgada })}`); }
    await espera(500); } return leer(p); };

// esconder y volver a mostrar la pestaña (como prueba-sincro --oculta-b: document.hidden y sin requestAnimationFrame)
const esconder = p => p.evaluate(() => { window.__rafOriginal = window.requestAnimationFrame;
  Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
  window.requestAnimationFrame = () => 0; document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
const mostrar = p => p.evaluate(() => { delete document.hidden; delete document.visibilityState; window.requestAnimationFrame = window.__rafOriginal;
  window.requestAnimationFrame(h => window.mkwRelojMonitor?.tic(h)); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});

async function correrEscenario(nombre) {
  const e = armarEscenario(nombre, { semilla: SEMILLA, segundos: SEGUNDOS }), N = e.jugadores.length;
  const etq = `${nombre}-${MODO}-${CONEXION}`;
  console.log(`\n=== ${etq} (semilla ${SEMILLA}, ${N} jugadores): ${e.descripcion}`);
  for (const j of e.jugadores) console.log(`  ${letra(j.i)}: CPU ×${j.cpu}, ${j.vista.join('×')} dpr ${j.dpr}, ${j.monitor} Hz, reloj ${j.relojMs >= 0 ? '+' : ''}${j.relojMs} ms, red ${typeof j.red === 'string' ? j.red : 'propia'}${j.picos ? ' con picos' : ''}, N8 ${j.n8}, salida ${j.salida || 'como viene'}${j.fluidez ? ', fluidez ' + j.fluidez : ''}${j.quitar ? ', sin efectos ' + j.quitar : ''}${j.texturas ? ', texturas ÷' + 2 ** j.texturas : ''}`);
  const linea = lineaDeTiempo(e);
  if (linea.length) console.log('  línea de tiempo (s desde el «¡YA!»): ' + linea.map(x => `${x.t} ${letra(x.i)} ${x.que}${x.ms ? ' ' + x.ms + ' ms' : x.s ? ' ' + x.s + ' s' : x.red ? ' → ' + x.red : ''}`).join(' · '));
  const R = { escenario: e, modo: MODO, conexion: CONEXION, build: process.env.MKW_BUILD || 'build/web/navegador', jugadores: [], adelantos: [], eventos: [], registro: {} };
  const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
  await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
  const turn = CONEXION === 'cloudflare' ? await crearTurn() : null;
  const puente = puenteSenal(), navegadores = [], P = [];
  const salaId = 'mx' + Date.now().toString(36), uids = e.jugadores.map(j => `${letra(j.i)}${salaId}`);
  const registro = e.jugadores.map(() => []);
  try {
    // ---- 1. un Chrome por jugador (otro proceso, otro perfil) ----
    for (const j of e.jugadores) {
      const ventana = j.monitor !== 60;
      const nav = await chromium.launch({ ...opcionesNavegador(), headless: !ventana,
        args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows', `--window-position=${vx + 40 * j.i},${vy + 30 * j.i}`] });
      navegadores.push(nav);
      const ctx = await nav.newContext({ viewport: { width: j.vista[0], height: j.vista[1] }, deviceScaleFactor: j.dpr });
      await puente.agregar(ctx);
      if (j.relojMs) await ctx.addInitScript(off => { const d = Date.now; Date.now = () => d() + off; }, j.relojMs);   // (su reloj corrido; el del juego no se toca)
      const p = await ctx.newPage();
      p.on('pageerror', x => { registro[j.i].push('[pageerror] ' + x.message); console.log(`  [${letra(j.i)}] [pageerror] ${x.message}`); });
      p.on('console', m => { if (registro[j.i].length < 20000) registro[j.i].push(m.text().slice(0, 400)); });
      p.__cdp = await ctx.newCDPSession(p);
      const q = `/?auto=1&${MODO === 'estado' ? 'red=estado' : 'red=malla&sonda=1'}&senal=canal&sala=${salaId}&uid=${uids[j.i]}&sincro=${uids.join(',')}&jefe=${uids[0]}` +
        `&modo=sala&estilo=copa&carreras=1&descanso=12&semilla=4242&cc=c150&cpu=normal&pista=0.0${CONEXION === 'cloudflare' ? '&conexion=cloudflare' : ''}${parametrosDe(j)}${EXTRA}`;
      await p.goto(`http://127.0.0.1:${PUERTO}${q}`);
      if (turn) await p.evaluate(ice => window.postMessage({ canal: 'mkw-padre', tipo: 'turn', iceServers: ice }, location.origin), turn.iceServers()).catch(() => {});
      P.push(p);
      await espera(1500);
    }
    // ---- 2. la copa (una pista) y elegir personaje ----
    await esperarQue(P[0], x => x.picker, 300000, 'hasta el selector', 0);
    const puso = await P[0].evaluate(() => window.mkwSala.ponerPistas([{ copa: 0, fila: 0 }])).catch(x => x.message);
    if (puso !== true) throw new Error('la anfitriona no pudo fijar la copa: ' + puso);
    const elegir = async (p, k) => { let visto = false, ultimo = 0;
      // (si la sala ya pasó a la carrera —el reloj de elegir, 45 s, venció—, el juego eligió por él: no se espera más)
      for (const h = Date.now() + 300000; Date.now() < h;) { const x = await leer(p); if (x?.eleccion || x?.sala?.fase === 'correr') return x;
        if (x && !x.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(x.pagina)) {
          if (!visto && x.pagina === 0x6B) { visto = true; await espera(800); }
          if (Date.now() - ultimo > 1300) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); } }
        await espera(300); }
      console.log(`  ${letra(k)} no eligió personaje en 5 min`); return leer(p); };
    await Promise.all(P.map(elegir));
    // (el aparato lento desde aquí: la carga de la carrera y la carrera, como en su aparato)
    for (const j of e.jugadores) if (j.cpu > 1) await P[j.i].__cdp.send('Emulation.setCPUThrottlingRate', { rate: j.cpu });
    // ---- 3. la carrera ----
    const cuenta = await Promise.all(P.map((p, k) => esperarQue(p, x => (x.sala?.fase === 'correr' && x.etapa >= 0 && x.etapa <= 2 && x.logica > 0) || x.sala?.fase === 'fin', 480000, 'hasta la carrera', k)));
    if (cuenta.some(x => x?.sala?.fase === 'fin' || x?.etapa >= 4)) throw new Error('la carrera terminó antes de poder medirla (alguien tardó en elegir y la sala largó sin esperar)');
    const cuentaYa = await Promise.all(P.map((p, k) => esperarQue(p, x => x.etapa >= 1, 90000, 'hasta la cuenta', k)));
    for (const p of P) await p.keyboard.down('KeyK').catch(() => {});
    const ya = await Promise.all(P.map((p, k) => esperarQue(p, x => x.etapa >= 2, 90000, 'hasta el «¡YA!»', k)));
    const tYa = Date.now();
    // (con muchos juegos en este PC las lecturas se atrasan: si alguna ya pasó la meta, la carrera no se midió)
    if (ya.some(x => !(x?.etapa === 2))) throw new Error(`la carrera no se pudo medir: etapas al «¡YA!» ${ya.map(x => x?.colgada ? 'colgada' : x?.etapa).join('/')} (este PC no dio abasto)`);
    R.inicio = { carrera: cuenta.map(x => x?.etapa), cuenta: cuentaYa.map(x => x?.etapa), ya: ya.map(x => x?.etapa), modoRacedata: cuenta.map(x => x?.modo), karts: cuenta.map(x => x?.karts) };
    console.log(`  en la carrera: etapas ${R.inicio.ya.join('/')}, karts ${R.inicio.karts.join('/')}, Racedata modo ${R.inicio.modoRacedata.join('/')}`);
    const yo = await Promise.all(P.map((p, k) => conTope(p.evaluate(k2 => window.mkwRedEstado?.ultima()?.propio ?? k2, k), 5000, k)));
    const pilotos = P.map((p, k) => manejar(p, null, yo[k]));
    // lo de cada uno al empezar a medir: la marca del medidor de imágenes y la lógica
    const marca0 = await Promise.all(P.map(p => conTope(p.evaluate(() => window.mkwImagenesVista?.marca?.() ?? null), 5000, null)));
    const l0 = await Promise.all(P.map(leer));
    const red0 = await Promise.all(P.map(p => conTope(p.evaluate(() => window.mkwRedSim?.estado?.() ?? null), 5000, null)));
    // ---- 4. los eventos de la semilla, a su hora ----
    const perturbado = e.jugadores.map(() => []);   // [desde, hasta] ms desde el «¡YA!»: ahí no cuenta para el adelanto
    const eventos = linea.map(x => (async () => {
      await espera(Math.max(0, tYa + x.t * 1000 - Date.now()));
      const p = P[x.i], t = Date.now() - tYa;
      R.eventos.push({ ...x, real: +(t / 1000).toFixed(1) });
      console.log(`  ${(t / 1000).toFixed(1)} s: ${letra(x.i)} ${x.que}`);
      if (x.que === 'tiron') { perturbado[x.i].push([t, t + x.ms + 5000]); await conTope(p.evaluate(ms => { const t0 = performance.now(); while (performance.now() - t0 < ms); }, x.ms), x.ms + 15000); }
      else if (x.que === 'oculta') { perturbado[x.i].push([t, t + x.s * 1000 + 6000]); await esconder(p); await espera(x.s * 1000); await mostrar(p); }
      else if (x.que === 'corte') { perturbado[x.i].push([t, t + x.ms + 6000]); await conTope(p.evaluate(ms => window.mkwRedSim?.cortar(ms), x.ms), 5000); }
      else if (x.que === 'cambio') await conTope(p.evaluate(r => window.mkwRedSim?.cambiar(r), REDES[x.red]), 5000);
    })());
    // ---- 5. el adelanto del más rápido, cada 2 s (la lógica de todos llevada a la misma hora: 60 cuadros por segundo) ----
    const muestras = [];
    while (Date.now() - tYa < SEGUNDOS * 1000) {
      const xs = await Promise.all(P.map(leer)), t = Date.now() - tYa;
      const tRef = Math.max(...xs.map(x => x?.tt || 0));
      // (el cuadro que se compara: en el lockstep, el cuadro común del lockstep; en «Cada uno su kart», el reloj de la
      // carrera del juego (Raceinfo +0x14, arranca con el «¡YA!» en todas) en cuadros de 1/60 s. Los contadores de Raceinfo
      // +0x1C y +0x20 NO son iguales entre páginas: cuentan desde que cada una cargó)
      const cuadroDe = x => MODO === 'lockstep' ? x.ls?.cuadro : x.relojMs ? x.relojMs * 0.06 : null;
      const vals = xs.map((x, k) => x && !x.colgada && cuadroDe(x) ? { k, l: cuadroDe(x) + (tRef - x.tt) * 0.06, fuera: !!(x.ls?.fuera || x.ls?.cortado) } : { k, l: null });
      const fila = { t: Math.round(t), l: vals.map(v => v.l === null ? null : Math.round(v.l)), fuera: vals.map(v => !!v.fuera) };
      const cuentan = vals.filter(v => v.l !== null && !v.fuera && !perturbado[v.k].some(([a, b]) => t >= a && t <= b));
      if (cuentan.length >= 2) { fila.adelanto = Math.round(Math.max(...cuentan.map(v => v.l)) - Math.min(...cuentan.map(v => v.l))); R.adelantos.push(fila.adelanto); }
      muestras.push(fila);
      await espera(2000);
    }
    R.muestras = muestras;
    await Promise.all(eventos);
    // ---- 6. lo medido de cada uno ----
    const l1 = await Promise.all(P.map(leer));
    for (const j of e.jugadores) {
      const p = P[j.i], k = j.i;
      const dt = l1[k]?.tt && l0[k]?.tt ? (l1[k].tt - l0[k].tt) / 1000 : SEGUNDOS;
      const vista = await conTope(p.evaluate(m => { const v = window.mkwImagenesVista; if (!v) return null;
        const r = v.resumen(m), u = v.ultimos(4000).filter(x => x.ms > 25), causas = {};
        for (const x of u) causas[x.causa || 'normal'] = (causas[x.causa || 'normal'] || 0) + 1;
        return { fps: r.fps, bajo1: r.bajo1, p99ms: r.p99ms, largas: u.length, causas, peores: u.map(x => Math.round(x.ms)).sort((a, b) => b - a).slice(0, 8) };
      }, marca0[k]), 10000, null);
      const extra = await conTope(p.evaluate(() => ({ avisos: [...(window.mkwAvisosRelevo || []), ...(window.mkwAvisosLento || []), ...(window.mkwAvisosCorte || [])].map(String),
        redSim: window.mkwRedSim?.estado?.() ?? null, n8: (() => { try { const n = window.mkwEstado.n8?.(); return n ? { modo: n.modo, activo: n.activo } : null; } catch { return null; } })(),
        redEstado: window.mkwRedEstadoSala?.estado?.() ?? null,
        // (lo que la sala y el lockstep anotaron en el registro de la página: para los reportes de fallas)
        // (§269b.15: el lockstep anota en window.mkwRed.registro, no en mkwEstado.log: sin eso no llegaba ninguna línea suya)
        logSala: [...(window.mkwEstado.log || []), ...(window.mkwRed?.registro || [])].map(String).filter(l => !l.includes('[aurora') && /lockstep|sala|isla|cort|relev|pausa|autoridad|árbitro|arbitro|separ|📶|red-estado|\[red/i.test(l)).slice(-2000) })), 10000, {});
      // el tráfico de la carrera (la red de mentira cuenta todo lo que pasa por la malla): paquetes y KB/s, subida y bajada
      const r0 = red0[k], r1 = extra.redSim, tr = (x, y) => x && y ? { paquetes: +((y.llegados + y.perdidos + y.tiradosCola + y.tiradosCorte - x.llegados - x.perdidos - x.tiradosCola - x.tiradosCorte) / dt).toFixed(1),
        kbs: +((y.bytes - x.bytes) / 1024 / dt).toFixed(2) } : null;
      const trafico = r0 && r1 ? { sube: tr(r0.sube, r1.sube), baja: tr(r0.baja, r1.baja) } : null;
      R.jugadores.push({ i: k, yo: yo[k], trafico, enCarrera: (cuenta[k]?.etapa ?? -1) >= 0, karts: cuenta[k]?.karts, logica: l1[k]?.logica && l0[k]?.logica ? (l1[k].logica - l0[k].logica) / dt : null,
        imagenes: vista?.fps ?? null, bajo1: vista?.bajo1 ?? null, causas: vista?.causas || {}, peores: vista?.peores || [], ls: l1[k]?.ls ?? null, ...extra });
    }
    // las CPU de la anfitriona vistas en cada uno (la sonda: posiciones de los 12 karts en cada cuadro)
    const sondas = await Promise.all(P.map(p => conTope(p.evaluate(d => window.mkwRedEstado?.muestras(d) ?? [], tYa), 20000, [])));
    const humanos = new Set(yo), cpus = [...Array(12).keys()].filter(i => !humanos.has(i));
    const tray = (m, i) => m.filter(s => s.karts?.[i]).map(s => ({ t: s.t, f: s.f, pos: s.karts[i] }));
    const moviendo = (v, vista) => vista.filter(x => { const a = posicionEn(v, x.t), b = posicionEn(v, x.t - 100); return a && b && distancia(a, b) > 300; });
    for (const jr of R.jugadores) if (jr.i > 0) {
      const errs = cpus.map(i => { const v = tray(sondas[0], i); return errorTrayectoria(v, moviendo(v, tray(sondas[jr.i], i))); }).filter(x => x.n);
      jr.errorCpu = errs.length ? { n: errs.reduce((a, x) => a + x.n, 0), medio: errs.reduce((a, x) => a + x.medio, 0) / errs.length, p90: Math.max(...errs.map(x => x.p90)), cpus: errs.length } : { n: 0 };
    }
    // (pedido de red-estado, 2026-11-11) lo mismo partido en tramos: «antes» de la primera perturbación de la sala, «durante»
    // (dentro de la ventana de un tirón, pestaña oculta o corte de cualquiera de los dos involucrados) y «después» (desde
    // 3 s después de que terminó la última de esos dos): ¿se recupera? Las ventanas en la hora de la sonda (= Date.now de este PC)
    const ventanas = k => perturbado[k].map(([a, b]) => [tYa + a, tYa + b]);
    const tramoDe = (t, ks) => { const v = ks.flatMap(ventanas); if (!v.length) return 'antes';
      if (v.some(([a, b]) => t >= a && t <= b)) return 'durante'; return t > Math.max(...v.map(x => x[1])) + 3000 ? 'despues' : t < Math.min(...v.map(x => x[0])) ? 'antes' : 'entre'; };
    const porTramos = (v, w, ks) => Object.fromEntries(['antes', 'durante', 'despues'].map(q => { const r = errorTrayectoria(v, w.filter(x => tramoDe(x.t, ks) === q));
      return [q, r.n ? { n: r.n, medio: Math.round(r.medio), p90: Math.round(r.p90) } : null]; }));
    for (const jr of R.jugadores) if (jr.i > 0) jr.errorCpuTramos = juntar(cpus.map(i => { const v = tray(sondas[0], i); return porTramos(v, moviendo(v, tray(sondas[jr.i], i)), [0, jr.i]); }));
    // la lógica de cada uno por tramo, con el cuadro que se compara (muestras cada 2 s): cuadros por segundo
    for (const jr of R.jugadores) {
      const ms = muestras.filter(m => m.l[jr.i] !== null), tr = {};
      for (const q of ['antes', 'durante', 'despues']) { const x = ms.filter(m => tramoDe(tYa + m.t, [jr.i]) === q);
        tr[q] = x.length >= 2 ? +((x.at(-1).l[jr.i] - x[0].l[jr.i]) / ((x.at(-1).t - x[0].t) / 1000)).toFixed(1) : null; }
      jr.logicaTramos = tr;
    }
    // el kart de cada humano visto en las otras pantallas: la distancia (unidades del juego; 100 ≈ 1 m) y el atraso en ms
    R.remotos = [];
    for (let a = 0; a < P.length; a++) for (let b = 0; b < P.length; b++) if (a !== b) {
      const v = tray(sondas[a], yo[a]), w = moviendo(v, tray(sondas[b], yo[a]));
      const x = errorTrayectoria(v, w), at = w.length ? atrasoDeVista(v, w, { maxMs: 1500, pasoMs: 8 }) : null;
      if (x.n) R.remotos.push({ de: a, en: b, n: x.n, medio: Math.round(x.medio), p90: Math.round(x.p90), atrasoMs: at?.ms ?? null, tramos: porTramos(v, w, [a, b]) });
    }
    if (MODO === 'lockstep') { const c = compararLargadas(R.jugadores.map(j => j.ls), R.jugadores[0].ls?.carrera ?? 1, 200); R.largada = { cumple: c.cumple, detalle: c.detalle }; }
    for (const pl of pilotos) await conTope(pl(), 5000);
    for (const p of P) await p.keyboard.up('KeyK').catch(() => {});
    // ---- 7. el fin: los humanos cruzan la meta (en el lockstep, en el mismo cuadro en todas), los puntos y la tabla ----
    if (MODO === 'lockstep') {
      const ls = (await Promise.all(P.map(leer))).map(x => x?.ls), c = Math.max(...ls.map(x => x?.cuadro || 0)) + 180;
      await Promise.all(P.map(p => conTope(p.evaluate(([c2, ps]) => window.mkwTerminarEn?.(c2, undefined, ps), [c, yo]), 5000)));
    } else await Promise.all(P.map((p, k) => conTope(p.evaluate(q => window.mkwTerminarEn?.(0, undefined, [q]), yo[k]), 5000)));
    const fines = await Promise.all(P.map((p, k) => esperarQue(p, x => x.etapa >= 4 || x.sala?.fase !== 'correr', 120000, 'hasta el fin de la carrera', k)));
    R.fin = fines.map(x => ({ etapa: x?.etapa, fase: x?.sala?.fase }));
    await espera(6000);
    const puntos = await Promise.all(P.map(p => conTope(p.evaluate(() => { const L = window.mkwMenus, rd = L.u32(0x809BD728);
      return Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)); }), 10000, null)));
    const finCopa = await Promise.all(P.map((p, k) => esperarQue(p, x => x.sala?.fase === 'fin', 120000, 'hasta el fin de la copa', k)));
    const vrs = await Promise.all(P.map(p => conTope(p.evaluate(() => window.mkwEstado.vr ? JSON.parse(JSON.stringify(window.mkwEstado.vr)) : null), 10000, null)));
    R.tablas = finCopa.map(x => x?.sala?.puntos ?? null);
    R.jugadores.forEach((j, k) => { j.puntos = puntos[k]; j.vr = vrs[k]; j.fase = finCopa[k]?.sala?.fase; });
  } catch (x) { R.error = x.stack?.slice(0, 600); console.log('  ✗ el escenario no corrió entero: ' + x.message); }
  finally {
    for (const n of navegadores) await n.close().catch(() => {});
    servidor.kill(); if (turn) R.turn = { ...turn.cuenta }; try { turn?.cerrar?.(); } catch {}   // (§103: lo que pasó por el repetidor)
  }
  // ---- 8. el informe ----
  const puntos = R.error && !R.jugadores.length ? [{ texto: 'el escenario corrió entero', ok: false, detalle: R.error }] : evaluar(e, R);
  if (R.error && R.jugadores.length) puntos.unshift({ texto: 'el escenario corrió entero', ok: false, detalle: R.error });
  R.puntos = puntos;
  for (const x of puntos) console.log(`${x.nota && !x.ok ? '·' : x.ok ? '✓' : '✗'} ${x.texto}${x.detalle ? ' — ' + x.detalle : ''}${x.nota && !x.ok ? ' (nota, no cuenta)' : ''}`);
  R.registro = Object.fromEntries(registro.map((r, k) => [letra(k), r]));
  fs.writeFileSync(path.join(DATOS, `${etq}.json`), JSON.stringify(R));
  for (const [k, r] of Object.entries(R.registro)) fs.writeFileSync(path.join(DATOS, `${etq}-${k}.log`), r.join('\n'));
  const md = [`# ${etq} (semilla ${SEMILLA})`, '', e.descripcion, '', '| | aparato | red | gráficos | lógica/s | imágenes/s | 1 % bajo | picos |', '|---|---|---|---|---|---|---|---|',
    ...e.jugadores.map(j => { const m = R.jugadores.find(x => x.i === j.i) || {};
      return `| ${letra(j.i)} | CPU ×${j.cpu}, ${j.vista.join('×')}@${j.dpr}, ${j.monitor} Hz | ${typeof j.red === 'string' ? j.red : 'propia'}${j.picos ? '+picos' : ''} | N8 ${j.n8}, salida ${j.salida || '—'} | ${m.logica?.toFixed?.(1) ?? '—'} | ${m.imagenes?.toFixed?.(1) ?? '—'} | ${m.bajo1?.toFixed?.(1) ?? '—'} | ${JSON.stringify(m.causas || {})} |`; }),
    '', '**Tráfico de la carrera por jugador** (paquetes/s y KB/s, subida · bajada): ' + R.jugadores.map(j => `${letra(j.i)} ${j.trafico ? `↑${j.trafico.sube.paquetes}/s ${j.trafico.sube.kbs} KB/s · ↓${j.trafico.baja.paquetes}/s ${j.trafico.baja.kbs} KB/s` : '—'}`).join(' · '),
    '', '**El kart de cada humano en las otras pantallas** (media de todos los pares): ' + (R.remotos?.length ? `distancia media ${Math.round(R.remotos.reduce((a, x) => a + x.medio, 0) / R.remotos.length)} (≈ ${(R.remotos.reduce((a, x) => a + x.medio, 0) / R.remotos.length / 100).toFixed(1)} m), p90 peor ${Math.max(...R.remotos.map(x => x.p90))}, atraso medio ${Math.round(R.remotos.filter(x => x.atrasoMs != null).reduce((a, x) => a + x.atrasoMs, 0) / Math.max(1, R.remotos.filter(x => x.atrasoMs != null).length))} ms (${R.remotos.length} pares)` : 'sin datos'),
    '', '**Por tramos** (antes / durante / después de las perturbaciones: tirón, pestaña oculta o corte; distancias en m):', '',
    ...R.jugadores.map(j => { const f = t => t ? `${(t.medio / 100).toFixed(1)} (p90 ${(t.p90 / 100).toFixed(1)})` : '—', c = j.errorCpuTramos, lt = j.logicaTramos || {};
      const rem = juntar((R.remotos || []).filter(x => x.en === j.i).map(x => x.tramos || {}));
      return `- ${letra(j.i)}: lógica ${lt.antes ?? '—'} / ${lt.durante ?? '—'} / ${lt.despues ?? '—'} por s · CPU de la anfitriona ${c ? `${f(c.antes)} / ${f(c.durante)} / ${f(c.despues)}` : '— (es la anfitriona)'} · karts de los demás humanos ${f(rem.antes)} / ${f(rem.durante)} / ${f(rem.despues)}`; }),
    '', ...puntos.map(x => `- ${x.nota && !x.ok ? '·' : x.ok ? '✓' : '✗'} ${x.texto}${x.detalle ? ' — ' + x.detalle : ''}`), ''];
  fs.writeFileSync(path.join(DATOS, `${etq}.md`), md.join('\n'));
  const resumen = path.join(DATOS, 'resumen.md');
  if (!fs.existsSync(resumen)) fs.writeFileSync(resumen, '| escenario | modo | jugadores | puntos ✓ | lógica/s | imágenes/s | 1 % bajo | falló |\n|---|---|---|---|---|---|---|---|\n');
  fs.appendFileSync(resumen, filaResumen(e, `${MODO}${CONEXION === 'cloudflare' ? ' 🛰' : ''}`, puntos, R.jugadores.length ? R.jugadores : e.jugadores.map(() => ({}))) + '\n');
  return puntos.filter(x => !x.ok && !x.nota).length;
}

let fallas = 0;
for (const n of NOMBRES) fallas += await correrEscenario(n);
console.log(`\n${fallas ? fallas + ' puntos ✗' : 'todo ✓'} · ${path.join(DATOS, 'resumen.md')}`);
process.exit(fallas ? 1 : 0);
