// sala-telefono-mixta.mjs — la sala con varios PC y el teléfono REAL del dueño, medida imagen por imagen (bitácora §281
// parte 2). La queja del dueño (2026-11-11): «los tests más demandantes son los de multiplayer que por alguna razón van
// pésimos cuando se junta el PC con el móvil, tienen muchos spikes, el frame pacing como que funciona mal… y por qué el
// single player va mucho mejor».
//
// Resumen: N PC (cada uno su Chrome y su perfil, en este PC) + el Oppo por el cable USB, en la sala (?modo=sala, copa de
// una carrera) con el lockstep o con «Cada uno su kart» (?red=estado); o el control: el Single Player (?modo=directa) en
// el teléfono o en el PC, la misma pista, semilla y gráficos (N8 automático, ?verGrafico=1, como juega el dueño).
// Lo que toca el teléfono va SIEMPRE por el marco seguro (telefono-seguro.mjs: lista blanca de órdenes, incógnito que se
// borra, limpieza garantizada, foto antes/después, vigía del calor, la pantalla prendida devuelta exacta).
//
// La medición: un REGISTRADOR que se instala en cada página (addInitScript, solo esta herramienta) y que, entre
// «empezar» y «parar», anota en cada requestAnimationFrame:
//   - si hubo imagen nueva del juego (mkwCuadros) y cuándo  → el tiempo de cada imagen (lo que pinta el gráfico);
//   - los contadores que solo crecen: cuadros de lógica (Raceinfo +0x20), lo corrido por mkw_prisa (ponerse al día),
//     pipelines armados, esperas del disco, lo esperado a la sala (mkwEstado.esperaSala), paquetes y bytes que llegaron
//     por los canales de datos de WebRTC (envolviendo RTCDataChannel en la página);
//   - cada 250 ms: el lockstep (cuadro, retraso, inventados, relevos, autoridad, esperas) o «Cada uno su kart» (recibidos,
//     el lento al día), N8 (modo/activo, la vigía de Automático);
//   - los «cuadros largos» del navegador (PerformanceObserver long-animation-frame: qué script, quién lo llamó y cuánto).
// En el teléfono, además, por DevTools: una TRAZA de Chrome de ~12 s (el recolector de basura, cada tarea y su tipo) y un
// PERFIL de CPU de ~15 s (qué funciones gastan), en ventanas aparte (no se mezclan con la medición limpia).
// Después, para cada PICO (una imagen de más de 25 ms y 1,4 veces la mediana de su alrededor): qué pasó en ese instante
// (llegó un montón de paquetes, la lógica no avanzó = esperó a la sala, corrió 2+ cuadros = se puso al día, cambió N8,
// pipeline, disco, recolector, un cuadro largo de tal script).
//
// Uso:  MKW_BUILD=build/web-final-v21/navegador node herramientas/sala-telefono-mixta.mjs --solo sp|sp-pc|sala
//         [--pcs 2] [--modo lockstep|estado] [--segundos 40] [--traza 12] [--perfil 15] [--etiqueta X] [--datos carpeta]
//   (con el candado de medición: herramientas/tanda-sala-telefono.sh; el teléfono con la depuración USB)
// Salida: <datos>/<etiqueta>.json (todo), <etiqueta>.md (el informe), <etiqueta>-traza.json, <etiqueta>.cpuprofile
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { puenteSenal } from './puente-contextos.mjs';
import { crearTurn } from './turn-local.mjs';
import { abrir, crearAdb, buscarAdb, conectarPlaywright, recuerdoPantalla } from './telefono-seguro.mjs';
import { compararLargadas } from '../web/navegador/largada-pareja.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(raiz);
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const opcion = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SOLO = opcion('--solo', 'sala'), PCS = Number(opcion('--pcs', 2)), MODO = opcion('--modo', 'lockstep');
const SEGUNDOS = Number(opcion('--segundos', 40)), TRAZA = Number(opcion('--traza', 12)), PERFIL = Number(opcion('--perfil', 15));
const EXTRA = opcion('--extra', ''), EXTRA_TEL = opcion('--extra-tel', ''), EXTRA_PC = opcion('--extra-pc', '');   // (--extra-tel / --extra-pc = solo en el teléfono / solo en los PC de la sala)
const ETQ = opcion('--etiqueta', SOLO === 'sala' ? `sala-${MODO}-${PCS}pc` : SOLO);
const DATOS = opcion('--datos', path.join('build', 'web', 'datos', 'sala-telefono', new Date().toISOString().slice(0, 10)));
// --cable: el teléfono no está en la red del PC (otra subred: el WebRTC directo no se cruza, §281 parte 2). Todos van
// «🛰 todo por el repetidor» (&conexion=cloudflare) con el TURN de mentira de este PC: los PC por UDP y el teléfono por
// TCP a través del cable (adb reverse del puerto del TURN). Mide la sala como en el modo «Todo por Cloudflare».
const CABLE = process.argv.includes('--cable');
const PUERTO = 8140;    // el que el teléfono ve como su propio 127.0.0.1 (el túnel del cable)
if (!['sp', 'sp-pc', 'sala'].includes(SOLO) || !['lockstep', 'estado'].includes(MODO)) throw new Error('--solo sp|sp-pc|sala, --modo lockstep|estado');
fs.mkdirSync(DATOS, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
const conTope = (pr, ms, d = null) => Promise.race([pr, espera(ms).then(() => d)]).catch(() => d);
const letra = k => String.fromCharCode(65 + k);
const lineas = [];
const nota = l => { console.log(l); lineas.push(`${new Date().toISOString()} ${l}`); };

// ======================= el registrador (corre DENTRO de cada página) =======================
const REGISTRADOR = () => {
  // los canales de datos de WebRTC: cada mensaje que llega, con su hora y sus bytes (envuelve onmessage y
  // addEventListener('message'); la malla no cambia)
  const llegadas = { n: 0, bytes: 0, t: [], b: [] };
  const contar = ev => { const d = ev.data, b = d?.byteLength ?? d?.length ?? 0; llegadas.n++; llegadas.bytes += b;
    if (window.__rec?.activo && llegadas.t.length < 200000) { llegadas.t.push(performance.now()); llegadas.b.push(b); } };
  try {
    const P = RTCDataChannel.prototype, d = Object.getOwnPropertyDescriptor(P, 'onmessage');
    Object.defineProperty(P, 'onmessage', { configurable: true, get() { return d.get.call(this); },
      set(f) { d.set.call(this, typeof f === 'function' ? function (ev) { contar(ev); return f.call(this, ev); } : f); } });
    const ae = P.addEventListener;
    P.addEventListener = function (tipo, f, o) { if (tipo === 'message' && typeof f === 'function') { const g = function (ev) { contar(ev); return f.call(this, ev); }; return ae.call(this, tipo, g, o); } return ae.call(this, tipo, f, o); };
  } catch {}
  const loaf = [];
  try { new PerformanceObserver(l => { if (!window.__rec?.activo) return; for (const e of l.getEntries()) if (loaf.length < 5000) loaf.push({ t: e.startTime, ms: e.duration, bloq: e.blockingDuration,
    render: e.renderStart ? e.renderStart - e.startTime : null, scripts: (e.scripts || []).sort((a, b) => b.duration - a.duration).slice(0, 3).map(s => ({ ms: Math.round(s.duration),
      quien: s.invoker, tipo: s.invokerType, fn: s.sourceFunctionName, url: (s.sourceURL || '').split('/').pop().split('?')[0] })) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  const u32 = a => { try { return window.mkwMenus.u32(a); } catch { return 0; } };
  const logica = () => { const ri = u32(0x809BD730); return ri ? u32(ri + 0x20) : 0; };
  const C = ['t', 'img', 'lg', 'pg', 'pip', 'dis', 'es', 'msg', 'by'];
  let fila = null, antesImg = 0, lento = [], marcaVista = null, marcaJuego = null;   // (§283: marcaJuego)
  const lentoAhora = () => { const e = window.mkwEstado || {}, ls = window.mkwSincro?.lockstep?.estado?.(), re = window.mkwRedEstadoSala?.cuentas;
    let n8 = null; try { const n = e.n8?.(); n8 = n ? { m: n.modo, a: n.activo } : null; } catch {}
    return { t: performance.now(), n8, n8p: e.n8auto?.prendido ?? null,
      ls: ls ? { c: ls.cuadro, r: ls.retraso, inv: ls.inventados, tv: ls.tardeVivo, rel: ls.relevos, aut: ls.autoridad, el: ls.esperasLargas, pr: ls.prisas, pc: ls.prisaCuadros,
        fr: ls.frenos, frv: ls.frenosVivo, yoR: Array.isArray(ls.relevadosAhora) ? ls.relevadosAhora.length : null, fuera: !!ls.fuera,
        mec: ls.msEsperaCorta, ec: ls.esperasCortas, mev: ls.msEsperaVivo, ren: ls.rendidos, me: ls.msEsperando, es: ls.esperas } : null,
      re: re ? { rec: re.recibidos, env: re.enviados, tir: re.tirados, ap: re.alDia?.prisas, ac: re.alDia?.cuadros, at: re.alDia?.atraso } : null };
  };
  const paso = () => {
    const R = window.__rec; if (!R.activo) return;
    const M = window.mkw, c = window.mkwCuadros?.() ?? 0, e = window.mkwEstado || {};
    const v = [performance.now(), c !== antesImg ? 1 : 0, logica(), M?._mkw_prisa_ganada?.() ?? 0, M?._mkw_web_pipelines_cuantos?.() ?? 0,
      window.mkwDisco?.estado?.esperaRed ?? 0, e.esperaSala?.ms ?? 0, llegadas.n, llegadas.bytes];
    antesImg = c;
    for (let i = 0; i < C.length; i++) fila[C[i]].push(v[i]);
    if (!lento.length || v[0] - lento[lento.length - 1].t >= 250) lento.push(lentoAhora());
    requestAnimationFrame(paso);
  };
  // (§281: lo que pidió bugs) el detalle del lockstep al empezar y al parar: las largadas (§250), la espera por consola,
  // los frenos y los traspasos de la autoridad; y las líneas «espera» del registro de la página (con ?esperasLog=N)
  const lsDetalle = () => { try { const e = window.mkwSincro?.lockstep?.estado?.(); if (!e) return null;
    return { t: performance.now(), cuadro: e.cuadro, largadas: e.largadas, esperaDe: e.esperaDe, maxEspera: e.maxEspera, msEsperando: e.msEsperando, esperas: e.esperas,
      esperasLargas: e.esperasLargas, msFrenado: e.msFrenado, frenos: e.frenos, frenosVivo: e.frenosVivo, msEsperaVivo: e.msEsperaVivo, traspasos: e.traspasos,
      inventados: e.inventados, autoridad: e.autoridad, msLlegada: e.msLlegada, tardeDe: e.tardeDe,
      invDe: e.invDe ? { ...e.invDe } : null, invLog: e.invLog ? e.invLog.slice() : null }; } catch { return null; } };
  let lsIni = null, logDesde = 0;   // (el registro del lockstep es window.mkwRed.registro, no mkwEstado.log)
  window.__rec = { activo: false,
    empezar() { lsIni = lsDetalle(); logDesde = window.mkwRed?.registro?.length ?? 0; fila = Object.fromEntries(C.map(k => [k, []])); lento = []; llegadas.t = []; llegadas.b = []; loaf.length = 0; antesImg = window.mkwCuadros?.() ?? 0;
      marcaVista = window.mkwImagenesVista?.marca?.() ?? null; marcaJuego = window.mkwRitmoJuego?.total ?? null; this.activo = true; this.desde = performance.now(); requestAnimationFrame(paso); return performance.timeOrigin; },
    marcar(n) { performance.mark(n); return performance.now(); },
    parar() { this.activo = false; const V = window.mkwImagenesVista;
      let vista = null; try { if (V && marcaVista !== null) vista = { resumen: V.resumen(marcaVista), causas: V.causas(marcaVista) }; } catch {}
      let juego = null; try { const r = window.mkwRitmoJuego; juego = r?.resumen ? r.resumen(600) : null; } catch {}
      // §283: cada imagen (la del medidor, de entrega a entrega) y cada cuadro de juego del tramo medido, para el 1 % bajo
      // por zona y para ubicar cada pico (la suma de los tiempos desde `desde` da su hora)
      let tiempos = null; try { tiempos = { imagen: marcaVista === null ? null : Array.from(V.tiempos({ desde: marcaVista }), x => Math.round(x * 100) / 100),
        juego: marcaJuego === null ? null : Array.from(window.mkwRitmoJuego.tiempos(marcaJuego), x => Math.round(x * 100) / 100),
        juegoModo: new URLSearchParams(location.search).get('ritmoJuego') || 'inicio' }; } catch {}
      let logEsperas = null; try { const L = window.mkwRed?.registro; if (L) logEsperas = (L.length >= logDesde ? L.slice(logDesde) : L).filter(x => /esper|fren|traspas|autoridad/i.test(String(x))).slice(-400).map(String); } catch {}
      return { origen: performance.timeOrigin, lsIni, lsFin: lsDetalle(), logEsperas, fila, lento, llegadas: { t: llegadas.t, b: llegadas.b }, loaf, vista, juego, tiempos, desde: this.desde, hasta: performance.now(),
        hz: window.mkwEstado?.hz ?? null, dpr: devicePixelRatio, vistaPx: [innerWidth, innerHeight], memoria: navigator.deviceMemory ?? null, nucleos: navigator.hardwareConcurrency }; },
  };
};

// ======================= lo de siempre: leer la pestaña, esperar, los dedos =======================
const leer = p => conTope(p.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.(); if (!e) return null;
  const ri = L.u32(0x809BD730), ls = window.mkwSincro?.lockstep?.estado?.();
  return { s: e.seccion, pagina: e.pagina, etapa: ri ? L.u32(ri + 0x28) : -1, eleccion: window.mkwEstado.eleccion || null,
    relojMs: (() => { try { const r = L.u32(ri + 0x14); return r ? (L.u16(r + 8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC) : 0; } catch { return 0; } })(),
    cortina: !document.body.classList.contains('sin-cortina'), picker: !!document.getElementById('elegirPista'), sala: window.mkwEstado.sala || null,
    enCarrera: !!window.mkwEstado.enCarrera, cuadro: ls?.cuadro ?? 0, huellas: ls?.huellasIguales ?? null, desinc: ls?.desincronizado ?? null, fuera: ls?.fuera ?? null, tt: Date.now() };
}), 10000, { colgada: true });
const esperarQue = async (p, f, tope, que) => { let aviso = Date.now() + 15000;
  for (const h = Date.now() + tope; Date.now() < h;) { const x = await leer(p); if (x && !x.colgada && f(x)) return x;
    if (Date.now() > aviso) { aviso = Date.now() + 15000; nota(`  … ${p.__nombre} ${que}: ${JSON.stringify(x ? { s: x.s, pagina: x.pagina, etapa: x.etapa, fase: x.sala?.fase } : null)}`); }
    await espera(500); } return leer(p); };
// los dedos en la pestaña del teléfono (Input.dispatchTouchEvent: toques de verdad, solo dentro de esa pestaña)
async function dedos(p) {
  const cdp = await p.context().newCDPSession(p), puestos = new Map();
  const enviar = tipo => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: [...puestos].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 8, radiusY: 8 })) });
  const boton = pieza => p.evaluate(id => { const e = document.querySelector(`.mkw-tactil [data-pieza="${id}"]`); if (!e) return null;
    const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, pieza).catch(() => null);
  return { boton,
    poner: async (id, q) => { const vacia = puestos.size === 0; puestos.set(id, q); await enviar(vacia ? 'touchStart' : 'touchMove'); },
    levantar: async id => { if (!puestos.delete(id)) return; if (puestos.size) await enviar('touchMove'); else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    soltarTodo: async () => { if (puestos.size) { puestos.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {}); } } };
}
// acelerar: el PC con su tecla, el teléfono con el dedo en A (el kart va derecho: igual en el Single Player y en la sala)
const acelerar = async p => { if (p.__tel) { p.__d ||= await dedos(p); const qa = await p.__d.boton('A'); if (qa) await p.__d.poner(1, qa); else await p.keyboard.down('KeyK'); } else await p.keyboard.down('KeyK'); };
const soltar = async p => { if (p.__tel) { await p.__d?.soltarTodo(); await p.keyboard.up('KeyK').catch(() => {}); } else await p.keyboard.up('KeyK').catch(() => {}); };

// ======================= la traza y el perfil del teléfono (DevTools) =======================
const CATEGORIAS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'disabled-by-default-v8.gc',
  'blink.user_timing', 'toplevel', 'v8.execute', 'webrtc'];
async function trazar(p, seg) {
  const cdp = await p.context().newCDPSession(p), eventos = [];
  cdp.on('Tracing.dataCollected', d => { for (const e of d.value) eventos.push(e); });
  const fin = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: CATEGORIAS, recordMode: 'recordAsMuchAsPossible' } });
  await espera(300);
  const marca = await p.evaluate(() => window.__rec.marcar('rec-sync'));
  await espera(seg * 1000);
  await cdp.send('Tracing.end'); await conTope(fin, 60000);
  await cdp.detach().catch(() => {});
  return { eventos, marca };
}
async function perfilar(p, seg) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  const desde = await p.evaluate(() => performance.now());
  await cdp.send('Profiler.start'); await espera(seg * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable').catch(() => {}); await cdp.detach().catch(() => {});
  return { profile, desde, hasta: desde + seg * 1000 };
}

// ======================= el análisis (en Node) =======================
const pct = (orden, f) => orden.length ? orden[Math.min(orden.length - 1, Math.floor(orden.length * f))] : null;
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
export function analizar(d, { traza = null, ventanas = {} } = {}) {
  const F = d.fila, n = F.t.length, imgs = [];
  // cada imagen nueva: su tiempo (desde la anterior) y lo que cambió en ese rato
  let prev = -1;
  for (let i = 0; i < n; i++) if (F.img[i]) { if (prev >= 0) imgs.push({ i, t: F.t[i], ms: F.t[i] - F.t[prev], desde: prev }); prev = i; }
  const zona = t => Object.entries(ventanas).find(([, [a, b]]) => t >= a && t <= b)?.[0] ?? 'limpia';
  const lentoEn = t => { let m = null; for (const x of d.lento) { if (x.t <= t) m = x; else break; } return m; };
  const mensajesEntre = (a, b) => { let k = 0, by = 0; for (let j = 0; j < d.llegadas.t.length; j++) { const t = d.llegadas.t[j]; if (t > a && t <= b) { k++; by += d.llegadas.b[j]; } } return [k, by]; };
  const dur = (F.t[n - 1] - F.t[0]) / 1000;
  const tasaMsg = d.llegadas.t.length / Math.max(1, dur);       // mensajes por segundo de media
  const gc = traza ? traza.gc : [], tareas = traza ? traza.tareas : [];
  // la mediana del alrededor (60 imágenes): con «30 parejas» lo normal es 33 ms y eso no es un pico
  const ms = imgs.map(x => x.ms);
  const medianaCerca = k => { const v = ms.slice(Math.max(0, k - 30), k + 30).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 16.7; };
  const picos = [];
  imgs.forEach((x, k) => {
    const med = medianaCerca(k);
    x.zona = zona(x.t);
    if (!(x.ms > 25 && x.ms > 1.4 * med)) return;
    const a = x.desde, b = x.i, ta = F.t[a], tb = F.t[b];
    const dLog = F.lg[b] - F.lg[a], dPrisa = F.pg[b] - F.pg[a], dPip = F.pip[b] - F.pip[a], dDis = F.dis[b] - F.dis[a], dEsp = F.es[b] - F.es[a];
    const [msgs, bytes] = mensajesEntre(ta, tb);
    const la = lentoEn(ta), lb = lentoEn(tb + 260);
    const n8cambio = !!(la?.n8 && lb?.n8 && (la.n8.m !== lb.n8.m || la.n8.a !== lb.n8.a)) || (la && lb && la.n8p !== lb.n8p);
    const lf = d.loaf.filter(l => l.t < tb && l.t + l.ms > ta).sort((p, q) => q.ms - p.ms)[0] ?? null;
    const enGc = gc.filter(g => g.t < tb && g.t + g.ms > ta), gcMs = enGc.reduce((s, g) => s + g.ms, 0);
    const tarea = tareas.filter(g => g.t < tb && g.t + g.ms > ta).sort((p, q) => q.ms - p.ms)[0] ?? null;
    const esperados = Math.round((tb - ta) / 16.67);
    const causas = [];
    // (el orden dice cuál se nombra primero; un pico puede tener varias)
    if (dEsp > 5 || (la?.ls && lb?.ls && lb.ls.el > la.ls.el)) causas.push('espera-sala');
    if (dPrisa > 0 || dLog >= esperados + 2) causas.push('al-dia');
    if (dLog === 0 && (tb - ta) > 30) causas.push('logica-quieta');
    if (dPip > 0) causas.push('pipeline');
    if (dDis > 0) causas.push('disco');
    if (gcMs > 3) causas.push('recolector');
    if (n8cambio) causas.push('n8-cambio');
    if (msgs >= Math.max(4, 3 * tasaMsg * (tb - ta) / 1000)) causas.push('rafaga-paquetes');
    if (!causas.length && lf) causas.push(lf.scripts?.[0] ? `script:${lf.scripts[0].tipo || lf.scripts[0].quien}` : 'cuadro-largo-sin-script');
    if (!causas.length) causas.push('sin-pista');
    picos.push({ t: r1((ta - d.desde) / 1000), ms: r1(x.ms), mediana: r1(med), zona: x.zona, logica: dLog, esperados, prisa: r1(dPrisa), esperaSalaMs: r1(dEsp), msgs, bytes, pip: dPip, dis: dDis,
      gcMs: r1(gcMs), n8: la?.n8 ?? null, n8cambio, causas, loaf: lf ? { ms: Math.round(lf.ms), render: lf.render == null ? null : Math.round(lf.render), scripts: lf.scripts } : null,
      tarea: tarea ? { nombre: tarea.nombre, ms: r1(tarea.ms), detalle: tarea.detalle } : null });
  });
  // por zona: el resumen de las imágenes (1 % bajo, ritmo, picos por minuto por causa)
  const porZona = {};
  for (const z of ['limpia', ...Object.keys(ventanas)]) {
    const v = imgs.filter(x => x.zona === z); if (!v.length) continue;
    const vm = v.map(x => x.ms).sort((a, b) => a - b), seg = v.reduce((s, x) => s + x.ms, 0) / 1000;
    const prom = vm.reduce((a, b) => a + b, 0) / vm.length, med = vm[Math.floor(vm.length / 2)];
    const pz = picos.filter(p => p.zona === z), porCausa = {};
    for (const p of pz) for (const c of p.causas) porCausa[c] = r1((porCausa[c] || 0) + 60 / seg);
    // la lógica y el ritmo en esta zona
    const ini = v[0].desde, fin = v[v.length - 1].i;
    porZona[z] = { segundos: r1(seg), imagenes: r1(v.length / seg), bajo1: r1(1000 / pct(vm, 0.99)), p99ms: r1(pct(vm, 0.99)), medianaMs: r1(med),
      jitterMs: r1(Math.sqrt(vm.reduce((a, b) => a + (b - prom) ** 2, 0) / vm.length)), tironesPct: r1(100 * vm.filter(x => x > 1.5 * med).length / vm.length),
      mas25: vm.filter(x => x > 25).length, picos: pz.length, picosMin: r1(pz.length * 60 / seg), porCausa,
      logica: r1((F.lg[fin] - F.lg[ini]) / ((F.t[fin] - F.t[ini]) / 1000)), prisaMs: r1(F.pg[fin] - F.pg[ini]), esperaSalaMs: r1(F.es[fin] - F.es[ini]),
      msgsSeg: r1(mensajesEntre(F.t[ini], F.t[fin])[0] / ((F.t[fin] - F.t[ini]) / 1000)) };
  }
  // segundo a segundo (la serie para el informe)
  const porSegundo = [];
  for (let s = 0; s < Math.ceil(dur); s++) {
    const a = d.desde + s * 1000, b = a + 1000, v = imgs.filter(x => x.t > a && x.t <= b);
    if (!v.length) { porSegundo.push({ s, imagenes: 0 }); continue; }
    const i0 = v[0].desde, i1 = v[v.length - 1].i, la = lentoEn(b);
    porSegundo.push({ s, imagenes: v.length, peorMs: r1(Math.max(...v.map(x => x.ms))), picos: picos.filter(p => p.t >= s && p.t < s + 1).length,
      logica: F.lg[i1] - F.lg[i0], prisa: r1(F.pg[i1] - F.pg[i0]), msgs: mensajesEntre(a, b)[0], n8: la?.n8 ? `${la.n8.m}${la.n8.a ? '+' : '-'}` : null,
      ls: la?.ls ? { r: la.ls.r, inv: la.ls.inv, tv: la.ls.tv, aut: la.ls.aut } : null, re: la?.re ? { at: la.re.at, ap: la.re.ap } : null });
  }
  // los cuadros largos del navegador por quién los causó (todo el rato)
  const loafPor = {};
  for (const l of d.loaf) { const s = l.scripts?.[0]; const k = s ? `${s.tipo || '?'}:${s.quien || '?'}`.slice(0, 80) : 'sin script'; const q = loafPor[k] ||= { n: 0, ms: 0 }; q.n++; q.ms += l.ms; }
  for (const k in loafPor) loafPor[k].ms = Math.round(loafPor[k].ms);
  const fin = d.lento[d.lento.length - 1];
  return { segundos: r1(dur), porZona, picos, porSegundo, loafPor, msgsSeg: r1(tasaMsg), final: fin, lsIni: d.lsIni ?? null, lsFin: d.lsFin ?? null, logEsperas: d.logEsperas ?? null, vista: d.vista, juego: d.juego, tiempos: d.tiempos ?? null, desdeMs: d.desde, ventanas };   // (§283: tiempos, desdeMs, ventanas)
}
// la traza de Chrome → el recolector y las tareas largas (en la hora de performance.now de la página, por la marca)
export function leerTraza(eventos, marcaMs) {
  const sync = eventos.find(e => e.name === 'rec-sync' && (e.ph === 'R' || e.ph === 'I' || e.ph === 'n' || e.ph === 'b' || e.cat?.includes('user_timing')));
  if (!sync) return null;
  const off = marcaMs - sync.ts / 1000;   // hora de la página = ts/1000 + off
  const hilo = sync.tid, proc = sync.pid;
  const gc = [], tareas = [], nombres = {};
  const GC = /^(MinorGC|MajorGC|V8\.GC|V8\.GCScavenger|V8\.GCFinalizeMC|V8\.GCIncrementalMarking|ScavengeTask|BlinkGC|ThreadState::|V8\.GC_)/;
  for (const e of eventos) {
    if (e.ph !== 'X' || e.pid !== proc || !e.dur) continue;
    const t = e.ts / 1000 + off, ms = e.dur / 1000;
    if (GC.test(e.name) && e.tid === hilo) { gc.push({ t, ms, nombre: e.name }); continue; }
    if (e.tid !== hilo) continue;
    if (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') { if (ms > 8) tareas.push({ t, ms, nombre: 'tarea', detalle: null }); }
    else if (ms > 4 && ['FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'v8.callFunction', 'v8.compile', 'v8.wasm.compile', 'V8.Execute', 'Layout', 'Paint',
      'UpdateLayoutTree', 'HitTest', 'ParseHTML', 'RunMicrotasks', 'v8.run'].includes(e.name)) {
      const det = e.args?.data?.type || e.args?.data?.functionName || e.args?.data?.url?.split('/').pop() || null;
      tareas.push({ t, ms, nombre: e.name, detalle: det });
    }
    nombres[e.name] = (nombres[e.name] || 0) + ms;
  }
  // (las tareas «RunTask» se reemplazan por su hijo más largo si lo hay: dice qué fue)
  const hijos = tareas.filter(x => x.nombre !== 'tarea');
  for (const t of tareas.filter(x => x.nombre === 'tarea')) { const h = hijos.filter(c => c.t >= t.t - 0.01 && c.t + c.ms <= t.t + t.ms + 0.01).sort((a, b) => b.ms - a.ms)[0]; if (h) { t.nombre = h.nombre; t.detalle = h.detalle; } }
  const gcTot = gc.reduce((s, g) => s + g.ms, 0);
  const caro = Object.entries(nombres).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, Math.round(v)]);
  return { gc, tareas: tareas.filter(x => x.ms > 8), gcMs: Math.round(gcTot), gcN: gc.length, gcPor: gc.reduce((m, g) => (m[g.nombre] = r1((m[g.nombre] || 0) + g.ms), m), {}), caro };
}
// el perfil de CPU → el tiempo propio de cada función (y por grupos: wasm del juego, la página, el recolector, el resto)
export function leerPerfil(profile) {
  const porId = new Map(profile.nodes.map(n => [n.id, n])), propio = new Map();
  const dt = profile.timeDeltas || [];
  for (let i = 0; i < profile.samples.length; i++) { const nd = porId.get(profile.samples[i]); const ms = (dt[i + 1] ?? dt[i] ?? 0) / 1000; const c = nd.callFrame;
    const k = `${c.functionName || '(anónima)'} ${(c.url || '').split('/').pop().split('?')[0]}`.trim(); propio.set(k, (propio.get(k) || 0) + ms); }
  const total = [...propio.values()].reduce((a, b) => a + b, 0) || 1;
  const grupo = k => /^\(idle\)/.test(k) ? 'reposo' : /^\(garbage collector\)/.test(k) ? 'recolector' : /^\(program\)/.test(k) ? 'programa (navegador)'
    : /wasm|^\$?func|^js-to-wasm|^wasm-to-js/.test(k) || /mkw\.wasm/.test(k) ? 'wasm (el juego)' : /mkw\.js/.test(k) ? 'mkw.js (runtime)' : /\.mjs/.test(k) ? 'la página (.mjs)' : 'otro';
  const grupos = {};
  for (const [k, v] of propio) grupos[grupo(k)] = (grupos[grupo(k)] || 0) + v;
  const arriba = [...propio].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => ({ fn: k, ms: Math.round(v), pct: r1(100 * v / total) }));
  return { totalMs: Math.round(total), grupos: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, { ms: Math.round(v), pct: r1(100 * v / total) }])), arriba,
    todo: Object.fromEntries([...propio].map(([k, v]) => [k, Math.round(v * 10) / 10])) };
}

// ======================= la corrida =======================
const R = { solo: SOLO, modo: MODO, pcs: SOLO === 'sala' ? PCS : SOLO === 'sp-pc' ? 1 : 0, build: process.env.MKW_BUILD || 'build/web/navegador', extra: EXTRA, etiqueta: ETQ,
  inicio: new Date().toISOString(), paginas: [], adelantos: [], puntos: [] };
// --pista c.f: la pista (por omisión 0.0; herramientas/recta-largada.mjs dice cuál tiene la recta de largada más larga)
const PISTA = opcion('--pista', '0.0'), [COPA, FILA] = PISTA.split('.').map(Number);
const comun = `&semilla=4242&cc=c150&cpu=normal&pista=${PISTA}&verGrafico=1&n8=auto${EXTRA}`;
const turn = CABLE && SOLO === 'sala' ? await crearTurn() : null;
const CONEXION = turn ? '&conexion=cloudflare' : '';
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env } });
await new Promise(listo => servidor.stdout.on('data', x => { if (String(x).includes('juego en')) listo(); }));
const puente = puenteSenal(), navegadores = [];
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const abrirPC = async (k, ruta) => {
  const nav = await chromium.launch({ channel: 'chrome', headless: false,
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', `--window-position=${vx + 60 * k},${vy + 40 * k}`] });
  navegadores.push(nav);
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 } });
  await puente.agregar(ctx); await ctx.addInitScript(REGISTRADOR);
  const p = await ctx.newPage(); p.__nombre = `PC ${letra(k)}`;
  p.on('pageerror', x => nota(`  [${p.__nombre}] [pageerror] ${x.message}`));
  await p.goto(`http://127.0.0.1:${PUERTO}${ruta}`);
  if (turn) await p.evaluate(ice => window.postMessage({ canal: 'mkw-padre', tipo: 'turn', iceServers: ice }, location.origin), turn.iceServers('udp')).catch(() => {});
  return p;
};

// lo común de la carrera, ya con todas las pestañas en la carrera (P = todas; tel = la del teléfono o null)
async function medirCarrera(P, tel) {
  for (const p of P) await acelerar(p);
  await espera(3000);
  const t0 = await Promise.all(P.map(p => conTope(p.evaluate(() => window.__rec.empezar()), 10000)));
  const tYa = Date.now();
  nota(`  midiendo: ${SEGUNDOS} s limpios${tel ? `, luego la traza (${TRAZA} s) y el perfil de CPU (${PERFIL} s) del teléfono` : ''}`);
  // el adelanto entre consolas cada 2 s (lockstep: su cuadro; «Cada uno su kart» y el Single Player: el reloj de la carrera)
  let muestreando = true;
  // (la hora de cada lectura es la de este PC al recibirla: el reloj del teléfono va corrido ~2,5 min del PC y su Date.now no sirve)
  const muestreo = (async () => { while (muestreando) { const xs = await Promise.all(P.map(p => leer(p).then(x => x && !x.colgada ? { ...x, tt: Date.now() } : x))), tRef = Math.max(...xs.map(x => x?.tt || 0));
    const c = x => MODO === 'lockstep' && SOLO === 'sala' ? x.cuadro : x.relojMs * 0.06;
    const l = xs.map(x => x && !x.colgada && c(x) ? Math.round(c(x) + (tRef - x.tt) * 0.06) : null);
    R.adelantos.push({ t: Math.round((Date.now() - tYa) / 1000), l }); await espera(2000); } })();
  const ventanas = {};
  await espera(SEGUNDOS * 1000);
  let traza = null, perfil = null;
  if (tel && TRAZA > 0) {
    const a = await tel.evaluate(() => performance.now());
    const x = await trazar(tel, TRAZA).catch(e => { nota('  traza: ' + e.message); return null; });
    ventanas.traza = [a, await tel.evaluate(() => performance.now())];
    if (x) { fs.writeFileSync(path.join(DATOS, `${ETQ}-traza.json`), JSON.stringify({ traceEvents: x.eventos })); traza = leerTraza(x.eventos, x.marca); nota(`  traza: ${x.eventos.length} eventos, recolector ${traza?.gcN} veces ${traza?.gcMs} ms`); }
  }
  if (tel && PERFIL > 0) {
    const x = await perfilar(tel, PERFIL).catch(e => { nota('  perfil: ' + e.message); return null; });
    if (x) { ventanas.perfil = [x.desde, x.hasta]; fs.writeFileSync(path.join(DATOS, `${ETQ}.cpuprofile`), JSON.stringify(x.profile)); perfil = leerPerfil(x.profile); }
  }
  muestreando = false; await muestreo;
  const datos = await Promise.all(P.map(p => conTope(p.evaluate(() => window.__rec.parar()), 30000)));
  // (§281) el reloj de pared de cada página contra el de Node (el del teléfono va corrido ~156 s): para comparar las largadas
  const relojes = [];
  for (const p of P) { try { const a = Date.now(), t = await conTope(p.evaluate(() => Date.now()), 5000), b = Date.now(); relojes.push(t - (a + b) / 2); } catch { relojes.push(0); } }
  for (const p of P) await soltar(p);
  P.forEach((p, k) => { if (!datos[k] || datos[k].origen !== t0[k]) nota(`  ✗ ${p.__nombre}: la página se recargó o se cayó durante la medición (origen ${t0[k]} → ${datos[k]?.origen ?? 'sin respuesta'})`); });
  P.forEach((p, k) => {
    const d = datos[k]; if (!d || !d.fila) { R.paginas.push({ nombre: p.__nombre, error: 'sin datos' }); return; }
    const esTel = p === tel;
    const a = analizar(d, { traza: esTel ? traza : null, ventanas: esTel ? ventanas : {} });
    R.paginas.push({ nombre: p.__nombre, telefono: esTel, hz: d.hz, dpr: d.dpr, vistaPx: d.vistaPx, memoria: d.memoria, nucleos: d.nucleos, ...a,
      ...(esTel ? { traza: traza ? { gcMs: traza.gcMs, gcN: traza.gcN, gcPor: traza.gcPor, caro: traza.caro, tareasLargas: traza.tareas.length } : null, perfil } : {}) });
    const z = a.porZona.limpia || {};
    if (a.final?.ls) { const f = a.final.ls; nota(`  ${p.__nombre} lockstep: retraso ${f.r}, inventados ${f.inv}, tardeVivo ${f.tv}, esperas ${f.es} (${Math.round(f.me ?? 0)} ms), largas ${f.el}, esperasCortas ${f.ec ?? '—'} (${Math.round(f.mec ?? 0)} ms), msEsperaVivo ${Math.round(f.mev ?? 0)}, frenosVivo ${f.frv ?? 0}, rendidos ${JSON.stringify(f.ren ?? null)}, autoridad ${f.aut}`); }
    nota(`  ${p.__nombre}: limpia ${z.imagenes} img/s, 1 % bajo ${z.bajo1}, lógica ${z.logica}/s, jitter ${z.jitterMs} ms, picos ${z.picosMin}/min ${JSON.stringify(z.porCausa)}`);
  });
  // (§281, lo que pidió bugs) la largada pareja (§250) y de quién se esperó, en el tramo medido (fin − inicio) y desde la
  // carrera entera (fin), los frenos y la historia de la autoridad (de las muestras cada 250 ms)
  const quien = u => !u ? '?' : u[0] === 'T' ? 'teléfono' : `PC ${u[0]}`;
  const fines = R.paginas.map(x => x.lsFin).filter(Boolean);
  if (fines.length) try {
    const ns = [...new Set(fines.flatMap(f => (f.largadas || []).map(l => l.carrera)))];
    // las horas de cada página llevadas al reloj de Node (la largada usa el reloj de pared de cada aparato)
    const corregir = (f, k) => f && { ...f, largadas: (f.largadas || []).map(l => ({ ...l, t0: l.t0 - relojes[k],
      cuenta: l.cuenta && { ...l.cuenta, t: l.cuenta.t - relojes[k] }, ya: l.ya && { ...l.ya, t: l.ya.t - relojes[k] } })) };
    R.relojes = relojes.map(Math.round);
    R.largadas = ns.map(n => ({ carrera: n, ...compararLargadas(R.paginas.map((x, k) => corregir(x.lsFin, k)), n) }));
    nota(`  relojes de pared contra Node (ms): ${R.paginas.map((x, k) => `${x.nombre} ${R.relojes[k]}`).join(', ')}`);
    for (const l of R.largadas) nota(`  largada pareja (§250): ${l.cumple ? '✓' : '✗'} ${l.detalle}`);
    R.paginas.forEach((x, k) => { const i = x.lsIni, f = x.lsFin; if (!f) return;
      const tramo = (c) => Math.round((f[c] ?? 0) - (i?.[c] ?? 0));
      const de = Object.entries(f.esperaDe || {}).map(([u, ms]) => `${quien(u)} ${Math.round(ms)}${i ? ` (tramo ${Math.round(ms - (i.esperaDe?.[u] || 0))})` : ''}`).join(', ');
      const hist = []; for (const m of datos[k]?.lento || []) { const a = m.ls?.aut; if (a && (!hist.length || hist[hist.length - 1][1] !== a)) hist.push([Math.round((m.t - datos[k].desde) / 1000), a]); }
      x.autoridades = hist;
      // (con herramientas/lockstep-contado.mjs) a quién le inventó botones esta consola en el tramo, y cuántos en los 2 s
      // después de cada cambio de autoridad (¿la historia que le falta a la autoridad nueva?)
      let inv = '';
      if (f.invLog) {
        const d0 = datos[k].desde, d1 = datos[k].hasta, cambios = [];
        for (const m of datos[k].lento || []) { const a = m.ls?.aut; if (a && cambios.length && cambios[cambios.length - 1][1] !== a || a && !cambios.length) cambios.push([m.t, a]); }
        const tramoInv = f.invLog.filter(([t]) => t >= d0 && t <= d1), por = {}, porTras = {};
        let tras = 0;
        for (const [t, u] of tramoInv) { por[quien(u)] = (por[quien(u)] || 0) + 1;
          if (cambios.slice(1).some(([tc]) => t >= tc && t < tc + 2000)) { tras++; porTras[quien(u)] = (porTras[quien(u)] || 0) + 1; } }
        x.inventadosTramo = { total: tramoInv.length, por, tras2s: tras, porTras, cambios: cambios.map(([t, a]) => [Math.round((t - d0) / 1000 * 10) / 10, quien(a)]) };
        inv = `; inventó en el tramo ${tramoInv.length} (${Object.entries(por).map(([q, n]) => `${q} ${n}`).join(', ') || '—'}), en los 2 s tras un cambio de autoridad ${tras}` +
          (tras ? ` (${Object.entries(porTras).map(([q, n]) => `${q} ${n}`).join(', ')})` : '');
      }
      nota(`  ${x.nombre} esperas: en total ${Math.round(f.msEsperando)} ms en ${f.esperas} (tramo ${tramo('msEsperando')} ms en ${tramo('esperas')}), máx ${Math.round(f.maxEspera)} ms; ` +
        `de quién: ${de || '—'}; frenado ${Math.round(f.msFrenado)} ms en ${f.frenos} (tramo ${tramo('msFrenado')} en ${tramo('frenos')}); traspasos ${f.traspasos} (tramo ${tramo('traspasos')}); ` +
        `inventados tramo ${tramo('inventados')}; autoridad ${hist.map(([s, a]) => `${s}s→${quien(a)}`).join(' ')}${inv}`);
      if (x.logEsperas?.length) nota(`    ${x.nombre}: ${x.logEsperas.length} líneas de espera/freno/traspaso del registro (en el json); la primera: ${String(x.logEsperas[0]).slice(0, 220)}`);
    });
  } catch (e) { nota(`  ✗ el resumen de esperas/largadas: ${e.message}`); }
  const ad = R.adelantos.map(x => x.l.filter(v => v !== null)).filter(v => v.length >= 2).map(v => Math.max(...v) - Math.min(...v));
  R.adelanto = ad.length ? { medio: r1(ad.reduce((a, b) => a + b, 0) / ad.length), max: Math.max(...ad) } : null;
  return t0;
}

// la pestaña del teléfono: si se cae o se recarga (otra navegación del marco principal), queda anotado con la hora
const vigilarTel = B => {
  const t0 = Date.now();
  B.on('crash', () => nota(`  ✗ [teléfono] la pestaña se cayó (${((Date.now() - t0) / 1000).toFixed(1)} s)`));
  B.on('framenavigated', f => { if (f === B.mainFrame()) nota(`  [teléfono] navegó/recargó a ${f.url().slice(0, 120)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); });
  B.on('console', m => { const t = m.text(); if (/error|caída|caida|⚠|recarg|pageerror|sala\]|\[malla|\[red/i.test(t)) lineas.push(`${new Date().toISOString()} [teléfono consola] ${t.slice(0, 300)}`); });
};
const marcoTel = { aviso: m => nota('  [teléfono] ' + m), esperar: ms => espera(ms), conectar: (p, alCtx) => conectarPlaywright(p, { fps: true }, alCtx), pantalla: true, recuerdo: recuerdoPantalla() };
const PUERTOS_ADB = turn ? [PUERTO, turn.puerto] : [PUERTO];
const adb = crearAdb({ ejecutable: buscarAdb(), puertos: PUERTOS_ADB, registro: l => lineas.push(`${new Date().toISOString()} ${l}`) });
try {
  if (SOLO === 'sp-pc') {
    const p = await abrirPC(0, `/?auto=1&modo=directa&pj=0&kart=1${comun}`);
    await esperarQue(p, x => x.enCarrera && x.etapa === 2, 420000, 'hasta la carrera');
    await medirCarrera([p], null);
  } else if (SOLO === 'sp') {
    const x = await abrir({ adb, puertos: [PUERTO], segundos: 1500, ...marcoTel, ruta: `/?auto=1&modo=directa&pj=0&kart=1${comun}${EXTRA_TEL}`,
      alContexto: ctx => ctx.addInitScript(REGISTRADOR),
      durante: async B => { B.__tel = true; B.__nombre = 'teléfono'; vigilarTel(B);
        const y = await esperarQue(B, x => x.enCarrera && x.etapa === 2, 600000, 'hasta la carrera');
        if (!(y?.etapa === 2)) throw new Error('el teléfono no llegó a la carrera');
        await medirCarrera([B], B); } });
    R.marco = { motivo: x.motivo, igual: x.cambios?.igual ?? null, temperatura: x.historial?.map(h => h.grados), consola: (x.consola || []).slice(-400) };
  } else {
    const salaId = 'st' + Date.now().toString(36), uids = [...Array(PCS).keys()].map(k => `${letra(k)}${salaId}`).concat([`T${salaId}`]);
    const q = uid => `/?auto=1&${MODO === 'estado' ? 'red=estado' : 'red=malla'}&senal=canal&sala=${salaId}&uid=${uid}&sincro=${uids.join(',')}&jefe=${uids[0]}` +
      `&modo=sala&estilo=copa&carreras=1&descanso=12${CONEXION}${comun}`;
    const P = [];
    for (let k = 0; k < PCS; k++) { P.push(await abrirPC(k, q(uids[k]) + EXTRA_PC)); await espera(1500); }
    const x = await abrir({ adb, puertos: PUERTOS_ADB, segundos: 2400, ...marcoTel, ruta: q(uids[PCS]) + EXTRA_TEL,
      alContexto: async ctx => { await puente.agregar(ctx); await ctx.addInitScript(REGISTRADOR);
        // (--cable: las credenciales del TURN por TCP, contestadas dentro de la página como lo haría el sitio; se repiten
        // los primeros 20 s porque la página empieza a escuchar apenas arma la malla)
        if (turn) await ctx.addInitScript(ice => { let n = 0; const f = () => { try { window.postMessage({ canal: 'mkw-padre', tipo: 'turn', iceServers: ice }, location.origin); } catch {} if (++n < 40) setTimeout(f, 500); }; setTimeout(f, 200); }, turn.iceServers('tcp')); },
      durante: async B => { B.__tel = true; B.__nombre = 'teléfono'; vigilarTel(B); const T = [...P, B];
        await esperarQue(P[0], x => x.picker, 600000, 'hasta el selector');
        const puso = await P[0].evaluate(c => window.mkwSala.ponerPistas([c]), { copa: COPA, fila: FILA }).catch(e => e.message);
        if (puso !== true) throw new Error('la anfitriona no pudo fijar la copa: ' + puso);
        const elegir = async p => { let visto = false, ultimo = 0;
          for (const h = Date.now() + 300000; Date.now() < h;) { const y = await leer(p); if (y?.eleccion || y?.sala?.fase === 'correr') return y;
            if (y && !y.cortina && [0x6B, 0x6C, 0x10E, 0x6D].includes(y.pagina)) {
              if (!visto && y.pagina === 0x6B) { visto = true; await espera(800); }
              if (Date.now() - ultimo > 1300) { ultimo = Date.now(); await p.keyboard.down('KeyK'); await espera(150); await p.keyboard.up('KeyK'); } }
            await espera(300); }
          nota(`  ${p.__nombre} no eligió personaje en 5 min`); return leer(p); };
        // (el WebRTC del teléfono con los PC: si no conecta en 60 s, el teléfono está en otra red —sin STUN no se cruzan
        // dos subredes— y la sala no puede medirse: se dice y se corta, en vez de esperar 10 min)
        for (let k = 0; k < 60; k++) { const c = await conTope(B.evaluate(() => window.mkwRed?.malla?.conectados?.()?.length ?? 0), 5000, 0); if (c >= PCS) break;
          if (k === 59) { const cand = await conTope(B.evaluate(async () => { const pc = new RTCPeerConnection(); pc.createDataChannel('x'); const v = [];
            pc.onicecandidate = e => { if (e.candidate) v.push(e.candidate.address); }; await pc.setLocalDescription(await pc.createOffer()); await new Promise(f => setTimeout(f, 2000)); pc.close(); return v; }), 8000, []);
            throw new Error(`el WebRTC del teléfono no conecta con los PC en 60 s (conectados ${c} de ${PCS}; el teléfono está en ${cand.join(', ')}): ¿el teléfono está en otra red que el PC?`); }
          await espera(1000); }
        nota('  el teléfono conectó por WebRTC con los PC');
        await Promise.all(T.map(elegir));
        const ya = await Promise.all(T.map(p => esperarQue(p, y => (y.sala?.fase === 'correr' && y.etapa === 2) || y.sala?.fase === 'fin', 600000, 'hasta el «¡YA!»')));
        if (ya.some(y => y?.etapa !== 2)) throw new Error(`la carrera no se pudo medir: ${ya.map(y => y?.colgada ? 'colgada' : `etapa ${y?.etapa} fase ${y?.sala?.fase}`).join(' / ')}`);
        await medirCarrera(T, B);
        // el fin: los humanos cruzan la meta (lockstep: en el mismo cuadro en todas) y lo que quedó en cada una
        const fin = await Promise.all(T.map(leer));
        R.huellas = fin.map(y => ({ huellas: y?.huellas, desinc: y?.desinc, fuera: y?.fuera }));
        const yo = await Promise.all(T.map((p, k) => conTope(p.evaluate(k2 => window.mkwRedEstado?.ultima()?.propio ?? k2, k), 5000, k)));
        if (MODO === 'lockstep') { const c = Math.max(...fin.map(y => y?.cuadro || 0)) + 180; await Promise.all(T.map(p => conTope(p.evaluate(([c2, ps]) => window.mkwTerminarEn?.(c2, undefined, ps), [c, yo]), 5000))); }
        else await Promise.all(T.map((p, k) => conTope(p.evaluate(q2 => window.mkwTerminarEn?.(0, undefined, [q2]), yo[k]), 5000)));
        await Promise.all(T.map(p => esperarQue(p, y => y.etapa >= 4 || y.sala?.fase !== 'correr', 120000, 'hasta el fin')));
        await espera(5000);
        R.puntos = await Promise.all(T.map(p => conTope(p.evaluate(() => { const L = window.mkwMenus, rd = L.u32(0x809BD728);
          return Array.from({ length: 12 }, (_, i) => L.u16(rd + 0xC10 + 8 + i * 0xF0 + 0xDA)); }), 10000)));
      } });
    R.marco = { motivo: x.motivo, igual: x.cambios?.igual ?? null, temperatura: x.historial?.map(h => h.grados), consola: (x.consola || []).slice(-400) };
  }
} catch (e) { R.error = e.message; nota('✗ ' + e.message); }
finally {
  for (const n of navegadores) await n.close().catch(() => {});
  servidor.kill();
  if (turn) { R.turn = { ...turn.cuenta }; try { turn.cerrar(); } catch {} }
}
R.fin = new Date().toISOString(); R.registro = lineas;
fs.writeFileSync(path.join(DATOS, `${ETQ}.json`), JSON.stringify(R, null, 1));
// el informe corto
const md = [`# ${ETQ} (${R.inicio})`, '', `build ${R.build} · ${SOLO}${turn ? ' · por el repetidor (--cable)' : ''}${SOLO === 'sala' ? ` · ${MODO} · ${PCS} PC + teléfono` : ''}${R.error ? ` · **error: ${R.error}**` : ''}`,
  R.marco ? `el teléfono quedó igual que antes: ${R.marco.igual} · temperatura ${JSON.stringify(R.marco.temperatura)}` : '', R.adelanto ? `adelanto entre consolas: medio ${R.adelanto.medio}, máx ${R.adelanto.max} cuadros` : '', '',
  '| página | zona | img/s | 1 % bajo | lógica/s | mediana ms | jitter ms | tirones % | >25 ms | picos/min | por causa |', '|---|---|---|---|---|---|---|---|---|---|---|',
  ...R.paginas.flatMap(p => Object.entries(p.porZona || {}).map(([z, v]) => `| ${p.nombre} | ${z} | ${v.imagenes} | ${v.bajo1} | ${v.logica} | ${v.medianaMs} | ${v.jitterMs} | ${v.tironesPct} | ${v.mas25} | ${v.picosMin} | ${JSON.stringify(v.porCausa)} |`)),
  '', ...R.paginas.filter(p => p.telefono).flatMap(p => ['## el teléfono', '', `cuadros largos del navegador por quién: ${JSON.stringify(p.loafPor)}`,
    p.traza ? `traza: recolector ${p.traza.gcN} veces, ${p.traza.gcMs} ms (${JSON.stringify(p.traza.gcPor)}); lo más caro: ${JSON.stringify(p.traza.caro.slice(0, 10))}` : '',
    p.perfil ? `perfil de CPU: ${JSON.stringify(p.perfil.grupos)}` : '', '', 'los 25 peores picos:', '',
    ...p.picos.slice().sort((a, b) => b.ms - a.ms).slice(0, 25).map(x => `- ${x.t} s ${x.ms} ms (mediana ${x.mediana}, ${x.zona}): ${x.causas.join(', ')} · lógica ${x.logica}/${x.esperados} · msgs ${x.msgs} · n8 ${JSON.stringify(x.n8)}${x.loaf ? ` · loaf ${x.loaf.ms} ms ${JSON.stringify(x.loaf.scripts)}` : ''}${x.tarea ? ` · tarea ${x.tarea.nombre} ${x.tarea.ms} ms ${x.tarea.detalle ?? ''}` : ''}`)])];
fs.writeFileSync(path.join(DATOS, `${ETQ}.md`), md.join('\n') + '\n');
nota(`listo: ${path.join(DATOS, ETQ)}.{json,md}`);
process.exit(R.error ? 1 : 0);
