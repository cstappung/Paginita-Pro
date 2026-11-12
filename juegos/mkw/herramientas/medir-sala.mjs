// La sala contra Single Player, en la misma PC y con los mismos ajustes (bitácora §269; el dueño: «el multiplayer corre
// muchísimo peor que el singleplayer… con 1, 2, 3, 7, 10 debería ser el mismo y muy fluido»).
//
// Resumen: para cada N de --n (1 = Single Player de verdad: ?modo=directa sin sala; 2 o más = la sala de N humanos con
// el lockstep, el árbitro y la malla, como prueba-doce) abre N pestañas de Chrome. La pestaña 0 es «la propia»: la que
// ve un jugador en su PC (1280×720, dibujando todo). Las demás hacen de las OTRAS PCs: corren la carrera entera (la
// lógica a 60, mandan y reciben sus botones), pero dibujan 1 de cada 60 cuadros (?saltarDibujo=60&saltarDibujoModo=2):
// así esta PC no se satura dibujando N juegos y la medida dice lo que vería cada jugador en la suya. Como medir el
// consumo de UN aparato del tablero con los demás conectados pero en vacío.
// En la carrera (12 karts, la misma pista y semilla), todos aceleran; pasados --asentar s, mide --segundos s en la
// propia: imágenes/s y su 1 % bajo (cada cambio de cuadro visto por requestAnimationFrame), cuadros de lógica/s
// (Raceinfo), la CPU del juego por cuadro (?lastre=1: lo trabajado entre dos esperas, sin las esperas), la espera de la
// sala por cuadro (esperaSala, §269) y la CPU de la página (tareas largas y lo que tarda cada refresco fuera del juego).
// Uso:  MKW_BUILD=build/web-final-w30/navegador node herramientas/medir-sala.mjs [--n 1,2,3,7,10,12] [--segundos 30]
//       [--asentar 10] [--pista 0.0] [--extra "&…"] [--extra-otras "&…"] [--etiqueta X] [--puerto 8176] [--ventana]
// Salida: build/web/datos/medir-sala/<etiqueta>.json y la tabla en la consola.
import { opcionesNavegador, elegirNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const NS = opcion('--n', '1,2,3').split(',').map(Number).filter(n => n >= 1 && n <= 12);
const SEGUNDOS = Number(opcion('--segundos', 30)), ASENTAR = Number(opcion('--asentar', 10));
const PISTA = opcion('--pista', '0.0'), EXTRA = opcion('--extra', ''), EXTRA_OTRAS = opcion('--extra-otras', '&saltarDibujo=60&saltarDibujoModo=2');
const ETIQUETA = opcion('--etiqueta', 'sala'), PUERTO = Number(opcion('--puerto', 8176));
// --baja: el teléfono simulado de §163 en la propia (la CPU ×4 y la revisión de límites de Android, W5)
const BAJA = process.argv.includes('--baja');
// --carga: el control. Las N pestañas corren carreras SUELTAS de un jugador (sin sala), la propia igual que las otras: si la
// CPU de la propia crece igual que en la sala de N, lo que crece es la carga de esta PC (N juegos a la vez), no la sala
const CARGA = process.argv.includes('--carga');
// §291 (Opera GX contra Chrome): --sala1 = con N=1 la sala de UN humano (malla, lockstep, árbitro) en vez del Single Player;
// --mando-falso = la página ve un mando conectado en reposo (sin él, Playwright no tiene mandos y las fotos de §269 no salen);
// --dpr N y --vista AxB = el lienzo de la propia como el del dueño (p. ej. --dpr 1.75 --vista 2157x1151 = 3775×2014 píxeles)
const SALA1 = process.argv.includes('--sala1'), MANDO_FALSO = process.argv.includes('--mando-falso');
const DPR = Number(opcion('--dpr', 1)), VISTA = String(opcion('--vista', '1280x720')).split('x').map(Number);
const NAV = elegirNavegador();
// §291, el cruce (crossplay): --navegador-otras chrome|opera-gx|ruta = las OTRAS consolas en otro navegador (la señal
// cruza por el puente de Node, la carrera por WebRTC); --vista-otras AxB = su ventana (por omisión 320×180)
const NAV_OTRAS = process.argv.includes('--navegador-otras') ? elegirNavegador(['--navegador', opcion('--navegador-otras', 'chrome')]) : null;
const VISTA_OTRAS = String(opcion('--vista-otras', '320x180')).split('x').map(Number);
const carpeta = path.join(raiz, 'build/web/datos/medir-sala');
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
const puente = puenteSenal();

// --pagina CARPETA = servir la página de otra copia (p. ej. la v2.0 sacada con git archive: «antes»)
const PAGINA = opcion('--pagina', null);
const servidor = spawn(process.execPath, [path.join(PAGINA ? path.resolve(PAGINA) : raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);

// lo que se mide en la propia, desde la página (un requestAnimationFrame que anota cada cuadro nuevo del juego)
const empezar = p => p.evaluate(() => {
  const m = window.__medir = { t: [], tareas: 0, msTareas: 0, h0: (window.mkwEstado.historial || []).length, sala0: window.mkwEstado.esperaSala?.ms ?? 0,
    salaVeces0: window.mkwEstado.esperaSala?.veces ?? 0, L0: null, t0: performance.now() };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { m.tareas++; m.msTareas += e.duration; } }).observe({ type: 'longtask' }); } catch {}
  // (§269: el tiempo del lockstep en esta página: la parte sin esperas de pad() —armar y mandar mis botones, resolver— y
  // lo que tarda cada paquete que llega, alBinario; se envuelven las funciones del objeto, que se buscan en cada llamada)
  m.padMs = 0; m.pads = 0; m.msgMs = 0; m.msgs = 0;
  const ls = window.mkwSincro?.lockstep;
  if (ls?.pad && !ls.__medido) {
    const pad0 = ls.pad, msg0 = ls.alBinario; ls.__medido = true;
    ls.pad = (...a) => { const t = performance.now(); const r = pad0(...a); if (window.__medir && !window.__medir.fin) { window.__medir.padMs += performance.now() - t; window.__medir.pads++; } return r; };
    ls.alBinario = (...a) => { const t = performance.now(); const r = msg0(...a); if (window.__medir && !window.__medir.fin) { window.__medir.msgMs += performance.now() - t; window.__medir.msgs++; } return r; };
  }
  const L = window.mkwMenus, ri = L.u32(0x809BD730); m.L0 = L.u32(ri + 0x20);
  m.gpu0 = window.mkwPerfilGpu?.foto?.() ?? null;   // (§269b: con &gpu=1&ventanaGpu=0, lo que se le pide a la tarjeta)
  let antes = window.mkwCuadros ? window.mkwCuadros() : 0;
  const paso = h => { if (!window.__medir || window.__medir.fin) return; const c = window.mkwCuadros ? window.mkwCuadros() : 0; if (c !== antes) { m.t.push(h); antes = c; } requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
});
const terminar = p => p.evaluate(() => {
  const m = window.__medir; m.fin = true;
  const dur = (performance.now() - m.t0) / 1000, L = window.mkwMenus, ri = L.u32(0x809BD730);
  const d = []; for (let i = 1; i < m.t.length; i++) d.push(m.t[i] - m.t[i - 1]);
  d.sort((a, b) => a - b);
  const p99 = d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.99))] : null;
  const h = (window.mkwEstado.historial || []).slice(m.h0);
  const media = k => { const v = h.map(x => x[k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const cuadrosLogica = L.u32(ri + 0x20) - m.L0;
  const sala = (window.mkwEstado.esperaSala?.ms ?? 0) - m.sala0;
  // (§269b: por imagen dibujada: pasadas, dibujos, recetas, grupos, KB subidos a la tarjeta)
  const g1 = window.mkwPerfilGpu?.foto?.() ?? null, g0 = m.gpu0, img = Math.max(1, m.t.length);
  const gpu = g1 && g0 ? Object.fromEntries(['pasadas', 'dibujos', 'recetas', 'grupos', 'subidas', 'copias'].map(k => [k, +((g1[k] - g0[k]) / img).toFixed(1)]).concat([['kb', +((g1.bytes - g0.bytes) / img / 1024).toFixed(1)]])) : null;
  return { segundos: dur, imagenes: m.t.length / dur, bajo1: p99 ? 1000 / p99 : null, logica: cuadrosLogica / dur,
    rr: (() => { const M = window.mkw; return { saltosRR: M?._mkw_rr_saltos?.() ?? null, saltadosComoN8: M?._mkw_n8_estado?.(18) ?? null }; })(),
    gpu, pasadasGpu: (() => { try { return window.mkwPerfilGpu?.tiempos?.() ?? null; } catch { return null; } })(), cpuMs: media('cpu'), juegoMs: media('juego'), esperaSalaMsCuadro: cuadrosLogica ? sala / cuadrosLogica : 0,
    lsPadMs: cuadrosLogica ? m.padMs / cuadrosLogica : 0, lsMsgMs: cuadrosLogica ? m.msgMs / cuadrosLogica : 0, msgsPorCuadro: cuadrosLogica ? m.msgs / cuadrosLogica : 0,
    tareasLargas: m.tareas, msTareasLargasS: m.msTareas / dur, paginaMs: window.mkwRelojMonitor?.paginaMs ?? null,
    n8: (() => { try { const n = window.mkwEstado.n8?.(); return n ? { modo: n.modo, activo: n.activo, saltados: n.saltados } : null; } catch { return null; } })(),
    n8auto: window.mkwEstado.n8auto ? { ...window.mkwEstado.n8auto } : null,
    n8log: (window.mkwEstado.log || []).filter(l => String(l).includes('[n8]')).slice(-6), avisos: (window.mkwAvisosLento || []).filter(t => /Tu PC no alcanza/.test(t)).length,
    pantallasLocales: (() => { try { const rd = L.u32(0x809BD728), esc = rd + 0x20; return [L.u8(esc + 5), L.u8(esc + 6)]; } catch { return null; } })(),
    retraso: window.mkwSincro?.lockstep?.estado?.().retraso ?? null,
    // §291: el informe de rendimiento entero (el mismo de «📋 Copiar el informe»), la vista y las fotos de los mandos
    informe: (() => { try { return JSON.parse(JSON.stringify(window.mkwInformeRendimiento?.() ?? null)); } catch (e) { return { error: String(e) }; } })(),
    ventanas: window.mkwControles?.estado?.ventanas ?? null, lienzo: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })(), dpr: devicePixelRatio,
    // §269: ¿de verdad está en la sala con los demás? (paquetes de botones recibidos de cada uno; 0 = sola)
    recibidos: (() => { const r = window.mkwSincro?.lockstep?.estado?.().recibidosDe || {}; return Object.keys(r).length + ':' + Object.values(r).reduce((a, b) => a + b, 0); })() };
});
const leerEtapa = p => p.evaluate(() => { const L = window.mkwMenus, s = L?.estado?.(); if (!s) return -1; const ri = L.u32(0x809BD730); return s.seccion === 0x20 && ri ? L.u32(ri + 0x28) : -1; }).catch(() => -1);

const filas = [];
// --perfil: el perfil de CPU de la propia (CDP Profiler) mientras se mide → <etiqueta>-N<n>.cpuprofile y lo propio de cada
// función (las 25 más caras, ms por cuadro de lógica) en la consola (§269b: qué hace de más la sala)
const PERFIL = process.argv.includes('--perfil');
let cdpPropia = null;
const resumirPerfil = (prof, cuadros) => {
  const por = new Map(), dt = prof.timeDeltas, total = {};
  const nodos = new Map(prof.nodes.map(n => [n.id, n]));
  for (let i = 0; i < prof.samples.length; i++) {
    const n = nodos.get(prof.samples[i]), cf = n.callFrame;
    const k = `${cf.functionName || '(anónima)'} ${cf.url ? cf.url.split('/').pop() : ''}${cf.url && !/wasm/.test(cf.url) ? ':' + cf.lineNumber : ''}`;
    por.set(k, (por.get(k) || 0) + (dt[i] || 0) / 1000);
    const g = /wasm/.test(cf.url) || /^\$?(func_|rr_|wasm-function)/.test(cf.functionName) ? 'wasm' : cf.url ? 'js' : cf.functionName;
    total[g] = (total[g] || 0) + (dt[i] || 0) / 1000;
  }
  const top = [...por].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, ms]) => [k, +(ms / cuadros).toFixed(3)]);
  return { porGrupo: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, +(v / cuadros).toFixed(3)])), top };
};
for (const N of NS) {
  const lanzar = (opc, x = vx) => chromium.launch({ ...opc, headless: !process.argv.includes('--ventana'),
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', `--window-position=${x},${vy}`, ...(BAJA ? ['--js-flags=--wasm-enforce-bounds-checks'] : [])] });
  const navegador = await lanzar(opcionesNavegador());
  const navegadorOtras = NAV_OTRAS && N > 1 ? await lanzar(NAV_OTRAS.opciones, vx + 960) : navegador;   // (§291: el cruce)
  const sala = 'ms' + Date.now().toString(36), uids = Array.from({ length: N }, (_, i) => `j${i}${sala}`);
  const paginas = [];
  for (let i = 0; i < N; i++) {
    // (cada una con su perfil: otra PC; la propia en 1280×720)
    const ctx = await (i === 0 ? navegador : navegadorOtras).newContext({ viewport: i === 0 ? { width: VISTA[0], height: VISTA[1] } : { width: VISTA_OTRAS[0], height: VISTA_OTRAS[1] }, ...(i === 0 && DPR !== 1 ? { deviceScaleFactor: DPR } : {}) });
    // §291: un mando de mentira en reposo (como el del dueño, conectado aunque juegue con el teclado): el tiempo avanza en cada lectura
    if (MANDO_FALSO && i === 0) await ctx.addInitScript(() => { let ts = 0; const pad = () => ({ index: 0, id: 'Mando de mentira (STANDARD GAMEPAD Vendor: 0000 Product: 0000)', mapping: 'standard', connected: true,
      timestamp: ++ts, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), vibrationActuator: null });
      Object.defineProperty(Navigator.prototype, 'getGamepads', { value: function () { return [pad(), null, null, null]; }, configurable: true }); });
  await puente.agregar(ctx);   // (§269: la señal del banco cruza entre perfiles: herramientas/puente-contextos.mjs)
    const p = await ctx.newPage();
    if (i === 0) {
      const c = await ctx.newCDPSession(p); cdpPropia = c;
      if (BAJA) await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    const q = (N === 1 && !SALA1) || CARGA ? '&pj=0&kart=1' : `&red=malla&senal=canal&sala=${sala}&uid=${uids[i]}&sincro=${uids.join(',')}`;
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${PISTA}&semilla=4242&cc=c150&cpu=normal&lastre=1${q}${EXTRA}${i ? EXTRA_OTRAS : ''}`);
    paginas.push(p);
    await espera(1500);
  }
  // todas a la carrera
  for (const lim = Date.now() + 8 * 60000; Date.now() < lim;) { const e = await Promise.all(paginas.map(leerEtapa)); if (e.every(x => x >= 2)) break; await espera(500); }
  for (const p of paginas) await p.keyboard.down('KeyK').catch(() => {});
  await espera(ASENTAR * 1000);
  await empezar(paginas[0]);
  if (PERFIL && cdpPropia) { await cdpPropia.send('Profiler.enable'); await cdpPropia.send('Profiler.setSamplingInterval', { interval: 200 }); await cdpPropia.send('Profiler.start'); }
  await espera(SEGUNDOS * 1000);
  const prof = PERFIL && cdpPropia ? (await cdpPropia.send('Profiler.stop').catch(() => null))?.profile : null;
  const r = await terminar(paginas[0]).catch(e => ({ error: String(e) }));
  if (prof) {
    writeFileSync(path.join(carpeta, `${ETIQUETA}-N${N}.cpuprofile`), JSON.stringify(prof));
    const cuadros = Math.max(1, Math.round((r.logica || 1) * (r.segundos || SEGUNDOS)));
    r.perfil = resumirPerfil(prof, cuadros);
    console.log(`perfil N=${N} (ms por cuadro de lógica): ${JSON.stringify(r.perfil.porGrupo)}`);
    for (const [k, ms] of r.perfil.top) console.log(`   ${ms.toFixed(3)}  ${k}`);
  }
  const fila = { N, sala1: SALA1, navegador: NAV.nombre, version: navegador.version(), otras: navegadorOtras !== navegador ? [NAV_OTRAS.nombre, navegadorOtras.version()] : null, ...r };
  if (N > 1 && !CARGA && !(Number(String(r.recibidos).split(':')[0]) >= N - 1)) console.log(`✗ N=${N}: la propia no recibe botones de las otras ${N - 1} (recibidos ${r.recibidos}): la sala no se armó, la medida no vale`);
  if (r.pasadasGpu?.length) console.log(`pasadas N=${N}: ` + r.pasadasGpu.map(x => `#${x.n} ${x.tam} «${x.etiqueta}» ×${x.veces} ${x.dibujos} dib ${x.ms} ms`).join(' | '));
  filas.push(fila);
  console.log(`§291 [${NAV.nombre} ${navegador.version()}] lienzo ${r.lienzo} dpr ${r.dpr}, fotos de los mandos ${JSON.stringify(r.ventanas)}`);
  console.log(`N=${N}${N === 1 || CARGA ? ' (Single Player' + (CARGA && N > 1 ? ` con ${N - 1} carreras sueltas al lado` : '') + ')' : ''}: ${r.imagenes?.toFixed(1)} imágenes/s, 1 % bajo ${r.bajo1?.toFixed(1)}, lógica ${r.logica?.toFixed(1)}/s, CPU del juego ${r.cpuMs?.toFixed(2)} ms/cuadro (juego ${r.juegoMs?.toFixed(2)}), espera de la sala ${r.esperaSalaMsCuadro?.toFixed(2)} ms/cuadro, lockstep pad ${r.lsPadMs?.toFixed(3)} + mensajes ${r.lsMsgMs?.toFixed(3)} ms/cuadro (${r.msgsPorCuadro?.toFixed(1)} mensajes por cuadro), tareas largas ${r.tareasLargas} (${r.msTareasLargasS?.toFixed(0)} ms/s),${r.gpu ? ` tarjeta por imagen ${JSON.stringify(r.gpu)},` : ''} RR quiso saltar ${r.rr?.saltosRR} (saltados como N8 ${r.rr?.saltadosComoN8}), página ${r.paginaMs?.toFixed?.(2)} ms, N8 ${JSON.stringify(r.n8)} ${JSON.stringify(r.n8auto?.ultimo || null)} ${JSON.stringify(r.n8log || [])}, pantallas/locales ${r.pantallasLocales}, retraso ${r.retraso}, recibidos de ${r.recibidos}, avisos «no alcanza» ${r.avisos}`);
  if (navegadorOtras !== navegador) await navegadorOtras.close();
  await navegador.close();
}
servidor.kill();
writeFileSync(path.join(carpeta, `${ETIQUETA}.json`), JSON.stringify({ navegador: NAV.nombre, exe: NAV.exe, dpr: DPR, vista: VISTA, mandoFalso: MANDO_FALSO, pista: PISTA, extra: EXTRA, extraOtras: EXTRA_OTRAS, segundos: SEGUNDOS, filas }, null, 1));
console.log('\n| humanos | imágenes/s | 1 % bajo | lógica/s | CPU juego ms | espera sala ms | tareas largas |');
console.log('|---|---|---|---|---|---|---|');
for (const f of filas) console.log(`| ${f.N === 1 ? '1 (Single Player)' : f.N} | ${f.imagenes?.toFixed(1)} | ${f.bajo1?.toFixed(1)} | ${f.logica?.toFixed(1)} | ${f.cpuMs?.toFixed(2)} | ${f.esperaSalaMsCuadro?.toFixed(2)} | ${f.tareasLargas} |`);
process.exit(0);
