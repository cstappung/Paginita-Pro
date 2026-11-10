// R4 (plan v4, etapa E5; bitácora §230): ¿el lockstep nuevo hace EXACTAMENTE lo mismo que el viejo?
//
// Resumen: carga dos copias de lockstep.mjs (la de antes y la de ahora) y corre con cada una las mismas salas falsas
// en Node, con un reloj virtual (como el banco relevo, §180.1: setTimeout/setInterval van a una fila y la hora salta de
// aviso en aviso) y una red de mentira con semilla fija. De cada consola guarda la huella de TODO lo que hace hacia
// afuera: los botones que le devuelve al juego en cada cuadro (pad), cada paquete que manda (a quién, por qué canal, en
// qué momento y sus bytes), cada línea de su registro y su estado() final. Si las dos copias dan las mismas huellas,
// el cambio no tocó la lógica: solo cómo se guardan las cosas. Como comparar dos tableros de control cableados
// distinto: se les dan las mismas entradas, en el mismo orden y en el mismo instante, y se miran todas las salidas.
//
// Uso:  node herramientas/r4-igual.mjs <lockstep-viejo.mjs> [<lockstep-nuevo.mjs>] [--solo N] [--gc]
//   (por omisión el nuevo es web/navegador/lockstep.mjs). --gc: además cuenta las limpiezas del recolector de basura
//   de V8 mientras corre cada copia (las chicas, Scavenge, y las grandes, Mark-Compact; perf_hooks «gc»), corriendo
//   cada escenario 3 veces de cada una, alternadas (node --expose-gc …: así cada corrida empieza con la memoria limpia).
// Sale con código 1 si alguna huella difiere.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PerformanceObserver, constants as perf } from 'node:perf_hooks';

const args = process.argv.slice(2);
const archivos = args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a));
const viejo = path.resolve(archivos[0] || ''), nuevo = path.resolve(archivos[1] || 'web/navegador/lockstep.mjs');
const SOLO = args.includes('--solo') ? Number(args[args.indexOf('--solo') + 1]) : null;
const GC = args.includes('--gc');
if (!archivos[0]) { console.error('uso: node herramientas/r4-igual.mjs <lockstep-viejo.mjs> [<nuevo>]'); process.exit(2); }

// ---- el reloj virtual (como el del banco relevo): la hora salta al próximo aviso; entre dos avisos, las promesas ----
const real = { setTimeout, setInterval, clearTimeout, clearInterval, setImmediate };
function relojVirtual() {
  let ahoraV = 0, numero = 0;
  const fila = new Map();
  const poner = (fn, ms, a, cada) => { const id = ++numero; fila.set(id, { t: ahoraV + Math.max(0, +ms || 0), n: id, fn, a, cada }); return id; };
  globalThis.setTimeout = (fn, ms, ...a) => poner(fn, ms, a, 0);
  globalThis.setInterval = (fn, ms, ...a) => poner(fn, ms, a, Math.max(1, +ms || 0));
  globalThis.clearTimeout = globalThis.clearInterval = id => { fila.delete(id); };
  return {
    ahora: () => ahoraV,
    // corre avisos hasta `hasta` ms (o hasta que no quede ninguno)
    async correr(hasta) {
      for (;;) {
        let mejor = null;
        for (const [id, x] of fila) if (!mejor || x.t < mejor[1].t || (x.t === mejor[1].t && x.n < mejor[1].n)) mejor = [id, x];
        if (!mejor || mejor[1].t > hasta) return;
        const [id, x] = mejor;
        ahoraV = Math.max(ahoraV, x.t);
        if (x.cada) { x.t = ahoraV + x.cada; x.n = ++numero; } else fila.delete(id);
        try { x.fn(...x.a); } catch (e) { console.error(e); }
        await new Promise(r => real.setImmediate(r));          // (las promesas pendientes terminan antes del siguiente)
      }
    },
    restaurar() { Object.assign(globalThis, { setTimeout: real.setTimeout, setInterval: real.setInterval, clearTimeout: real.clearTimeout, clearInterval: real.clearInterval }); },
  };
}
function azar(semilla) { let s = semilla; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const huellaDe = () => createHash('sha256');

// ---- una sala falsa: n consolas, la red con semilla, trabas y lentos ----
// esc = { n, cuadros, arbitro, semilla, perdida, demora: [a, b], trabas: { i: [cuadro, ms] }, lentos: { i: ritmo }, salir: { i: cuadro }, cuadroMs }
async function correrSala(crearLockstep, esc) {
  const reloj = relojVirtual(), ahora = reloj.ahora, rnd = azar(esc.semilla);
  const uids = Array.from({ length: esc.n }, (_, i) => 'u' + String.fromCharCode(97 + i));
  const humanos = uids.map((uid, mando) => ({ uid, mando }));
  const CUADRO = esc.cuadroMs || 1000 / 60;
  const con = {};
  for (const [i, uid] of uids.entries()) {
    const c = con[uid] = { uid, i, estado: 2166136261, h: { pad: huellaDe(), env: huellaDe(), reg: huellaDe() }, dormidaHasta: -1, fuera: false, tcp: {}, toque: 0, envios: 0, regs: 0 };
    c.ls = crearLockstep({
      yo: uid, humanos: humanos.map(h => ({ ...h })), ahora, cuadroMs: CUADRO,
      ...(esc.arbitro !== undefined ? { arbitro: esc.arbitro } : {}), relevoRapido: esc.relevoRapido ?? true,
      prisa: esc.prisa ? ms => { c.prisa = ms; } : null,
      registro: t => { c.h.reg.update(`${ahora().toFixed(3)} ${t}\n`); c.regs++; },
      local: () => { c.toque++; const k = c.toque; return [(k * 37 + i * 11) & 0x0F7F, (k % 255) - 128, (i * 13) % 100 - 50, 0, 0, k % 7, 0]; },
      huella: () => c.estado,
      enviar: (a, bytes, canal) => {
        const ca = con[a];
        if (c.fuera || ca.fuera || ahora() < c.dormidaHasta) return;
        c.envios++;
        c.h.env.update(`${ahora().toFixed(3)} ${a} ${canal} `); c.h.env.update(bytes); c.h.env.update('\n');
        if (canal === 'udp' && rnd() < esc.perdida) return;
        const copia = bytes.slice();                       // (como WebRTC: send copia los bytes al mandar)
        let t = ahora() + esc.demora[0] + rnd() * (esc.demora[1] - esc.demora[0]);
        if (canal === 'tcp') { t = Math.max(t, (c.tcp[a] || 0) + 0.1); c.tcp[a] = t; }
        if (t < ca.dormidaHasta) t = ca.dormidaHasta + rnd();
        setTimeout(() => { if (!ca.fuera) ca.ls.alBinario(uid, copia); }, t - ahora());
      },
    });
  }
  // el juego falso de cada consola: pide los botones, los mezcla en su estado, trabaja 2 ms y espera su tic
  const juegos = uids.map(async uid => {
    const c = con[uid], ritmo = esc.lentos?.[c.i] || 1, traba = esc.trabas?.[c.i], salir = esc.salir?.[c.i] ?? Infinity;
    const t0 = ahora();
    let prox = t0;
    for (let k = 0; k < esc.cuadros; k++) {
      if (k === salir) { c.fuera = true; c.ls.detener(); return; }
      if (traba && k === traba[0]) {                       // la pestaña entera trabada (no manda ni lee nada)
        c.dormidaHasta = ahora() + traba[1];
        await new Promise(r => setTimeout(r, traba[1]));
      }
      const d = await c.ls.pad(k);
      if (d) { c.h.pad.update(`${k}:`); c.h.pad.update(new Uint8Array(d.buffer, d.byteOffset, d.byteLength)); for (let j = 0; j < d.length; j++) c.estado = Math.imul(c.estado ^ d[j], 16777619) >>> 0; }
      await new Promise(r => setTimeout(r, 2));
      prox = Math.max(ahora(), prox + CUADRO * ritmo);
      if (c.prisa > 0) { const n = Math.min(c.prisa, 200); c.prisa = 0; prox -= n * 0.5; }   // (la ráfaga: corre más seguido)
      await new Promise(r => setTimeout(r, Math.max(0, prox - ahora())));
    }
  });
  let terminado = false;
  Promise.all(juegos).then(() => { terminado = true; });
  const tope = esc.cuadros * CUADRO * 4 + 60000;
  while (!terminado && ahora() < tope) await reloj.correr(ahora() + 50);
  const res = {};
  for (const uid of uids) {
    const c = con[uid], e = c.ls.estado();
    c.ls.detener();
    res[uid] = { pad: c.h.pad.digest('hex').slice(0, 16), env: c.h.env.digest('hex').slice(0, 16), reg: c.h.reg.digest('hex').slice(0, 16),
      envios: c.envios, regs: c.regs, estado: createHash('sha256').update(JSON.stringify(e)).digest('hex').slice(0, 16),
      resumen: { cuadros: e.cuadros, esperas: e.esperas, relevos: e.relevos, cortes: e.cortes.length, pausas: e.pausas.length, huellasIguales: e.huellasIguales, desincronizado: !!e.desincronizado } };
  }
  reloj.restaurar();
  return { res, msVirtual: ahora(), terminado };
}

const ESCENARIOS = [
  { nombre: '4 consolas, red con pérdida, una traba de 1,5 s', n: 4, cuadros: 3000, semilla: 11, perdida: 0.03, demora: [3, 25], trabas: { 2: [1200, 1500] } },
  { nombre: '4 consolas con el árbitro, la misma traba', n: 4, cuadros: 3000, semilla: 12, perdida: 0.03, demora: [3, 25], arbitro: true, trabas: { 2: [1200, 1500] } },
  { nombre: '3 consolas, una lenta (×1,4) que se pone al día', n: 3, cuadros: 2400, semilla: 13, perdida: 0.02, demora: [2, 12], lentos: { 1: 1.4 }, prisa: true },
  { nombre: '6 consolas, una se va a mitad (corte)', n: 6, cuadros: 2400, semilla: 14, perdida: 0.02, demora: [2, 15], salir: { 4: 900 } },
  { nombre: '12 consolas con el árbitro y dos trabas', n: 12, cuadros: 1500, semilla: 15, perdida: 0.02, demora: [3, 20], arbitro: true, trabas: { 3: [500, 1500], 7: [900, 800] } },
  { nombre: '12 consolas sin árbitro, una traba larga (pausa)', n: 12, cuadros: 1500, semilla: 16, perdida: 0.02, demora: [3, 20], trabas: { 5: [600, 3000] } },
];

const cargar = async f => (await import(pathToFileURL(f).href + '?v=' + encodeURIComponent(f))).crearLockstep;
const [lsViejo, lsNuevo] = [await cargar(viejo), await cargar(nuevo)];
let malos = 0;
for (const [k, esc] of ESCENARIOS.entries()) {
  if (SOLO !== null && SOLO !== k) continue;
  const medir = async ls => {
    if (GC && globalThis.gc) gc();
    const cuenta = { menor: 0, mayor: 0, ms: 0 };
    const obs = GC ? new PerformanceObserver(l => { for (const e of l.getEntries()) { const k = e.detail?.kind ?? e.kind; if (k === perf.NODE_PERFORMANCE_GC_MINOR) cuenta.menor++; else if (k === perf.NODE_PERFORMANCE_GC_MAJOR) cuenta.mayor++; cuenta.ms += e.duration; } }) : null;
    obs?.observe({ entryTypes: ['gc'] });
    const t0 = performance.now();
    const r = await correrSala(ls, esc);
    r.msReal = Math.round(performance.now() - t0);
    if (obs) { await new Promise(x => real.setTimeout(x, 50)); obs.disconnect(); r.gc = cuenta; }
    return r;
  };
  const a = await medir(lsViejo), b = await medir(lsNuevo);
  if (GC) {                                                // (dos vueltas más de cada una, alternadas)
    for (let k = 0; k < 2; k++) for (const [x, ls] of [[a, lsViejo], [b, lsNuevo]]) { const r = await medir(ls); for (const c of ['menor', 'mayor', 'ms']) x.gc[c] += r.gc[c]; x.msReal += r.msReal; }
    for (const x of [a, b]) { for (const c of ['menor', 'mayor']) x.gc[c] = Math.round(x.gc[c] / 3 * 10) / 10; x.gc.ms = Math.round(x.gc.ms / 3 * 10) / 10; x.msReal = Math.round(x.msReal / 3); }
  }
  let igual = a.terminado === b.terminado;
  for (const u of Object.keys(a.res)) for (const campo of ['pad', 'env', 'reg', 'estado']) if (a.res[u][campo] !== b.res[u][campo]) { igual = false; console.log(`   ✗ ${u} ${campo}: ${a.res[u][campo]} ≠ ${b.res[u][campo]}`); }
  if (!igual) malos++;
  const r0 = Object.values(a.res)[0].resumen;
  console.log(`${igual ? '✓' : '✗'} ${k}. ${esc.nombre}: ${Object.values(a.res).reduce((s, x) => s + x.envios, 0)} paquetes, ${Object.values(a.res).reduce((s, x) => s + x.regs, 0)} líneas de registro` +
    ` · ${JSON.stringify(r0)}${a.terminado ? '' : ' (NO TERMINÓ)'} · tiempo real ${a.msReal} → ${b.msReal} ms` +
    (GC ? ` · limpiezas por corrida: chicas ${a.gc.menor} → ${b.gc.menor}, grandes ${a.gc.mayor} → ${b.gc.mayor}, ${a.gc.ms} → ${b.gc.ms} ms` : ''));
}
console.log(malos ? `✗ ${malos} escenario(s) distintos` : '✓ las dos copias hacen exactamente lo mismo');
process.exit(malos ? 1 : 0);
