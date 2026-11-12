// Los escenarios del simulador de sala mixta y su veredicto (bitácora §281). Puro: sin el juego ni Chrome.
//
// Resumen general: el dueño (2026-11-11) pidió «que simule mejor el multiplayer tipo distintos PCs, lag, etc.» y
// «distintos settings gráficos: algunos con 30, algunos con 60, algunos con N8, otro sin N8». Este archivo dice, para
// cada escenario con nombre, cómo es cada jugador:
//   - su aparato: cuánto más lento es su procesador (cpu ×N, por DevTools), su ventana y densidad de pantalla, su monitor
//     (60 Hz = Chrome sin ventana; 144 Hz = ventana en el monitor de 144), su reloj corrido unos ms, los tirones (el hilo
//     trabado 0,5–2 s) y si esconde la pestaña un rato;
//   - su red (red-simulada.mjs): bajada y subida aparte, pérdida, ancho de banda, picos, un corte y un cambio de red;
//   - sus gráficos: N8 (0 = No, 1 = 30 parejas, 2 = 60 con la del medio, auto), la salida, la fluidez, los efectos
//     quitados y las texturas más chicas.
// Todo sale de una SEMILLA: el mismo escenario con la misma semilla es exactamente el mismo (los mismos tirones a la misma
// hora de la carrera, los mismos paquetes perdidos). Y `evaluar` convierte lo medido en los puntos ✓/✗ del informe.
// Como el banco de pruebas de un tablero con varias cargas distintas: cada carga con su perfil, y la misma secuencia de
// fallas cada vez que se repite el ensayo.
//
// Uso:  import { ESCENARIOS, armarEscenario, parametrosDe, evaluar } from './sala-mixta.mjs';
//       const e = armarEscenario('tormenta', { semilla: 7, segundos: 60 });   e.jugadores[i] = { cpu, red, n8, … }
//       const q = parametrosDe(e.jugadores[i]);   // '&n8=1&salida=720&redSim=…' para la dirección de su página
import { azarConSemilla } from './red-simulada.mjs';

// Las redes de mentira (ms = la mitad de la ida y vuelta de ese tramo; kbps 0 = sin tope)
export const REDES = {
  fibra: { baja: { ms: 4, var: 1, perdida: 0, kbps: 0 }, sube: { ms: 4, var: 1, perdida: 0, kbps: 0 } },
  cable: { baja: { ms: 10, var: 4, perdida: 0.2, kbps: 50000 }, sube: { ms: 12, var: 4, perdida: 0.2, kbps: 10000 } },
  wifi: { baja: { ms: 18, var: 12, perdida: 1, kbps: 20000 }, sube: { ms: 22, var: 15, perdida: 1.5, kbps: 5000 } },
  lejos: { baja: { ms: 55, var: 10, perdida: 0.5, kbps: 8000 }, sube: { ms: 70, var: 15, perdida: 1, kbps: 2000 } },   // ~250 ms de ida y vuelta
  '4g': { baja: { ms: 30, var: 20, perdida: 2, kbps: 8000 }, sube: { ms: 45, var: 30, perdida: 3, kbps: 1000 } },
  'celular-malo': { baja: { ms: 50, var: 35, perdida: 4, kbps: 3000 }, sube: { ms: 70, var: 45, perdida: 5, kbps: 400 } },
};

// un jugador «de base»: un PC de escritorio a toda potencia con fibra y todo como viene
export const BASE = { cpu: 1, vista: [960, 540], dpr: 1, monitor: 144, relojMs: 0, n8: '0', salida: 0, fluidez: 0, quitar: 0, texturas: 0,
  red: 'fibra', picos: null, tirones: [], oculta: null, corte: null, cambio: null, puedeSalir: false };

// los eventos al azar (con la semilla) dentro de la carrera: entre el segundo `desde` y `hasta` (desde el «¡YA!»)
const entre = (azar, a, b) => a + (b - a) * azar();
const tirones = (azar, n, seg, ms = [500, 2000]) => Array.from({ length: n }, () => ({ t: +entre(azar, 6, seg - 8).toFixed(1), ms: Math.round(entre(azar, ms[0], ms[1])) })).sort((x, y) => x.t - y.t);

// Cada escenario: (azar, segundos) → { descripcion, jugadores: [parcial de BASE…], topes } (topes = lo que se acepta)
export const ESCENARIOS = {
  parejos: {
    descripcion: '3 PCs iguales a toda potencia, fibra, todo como viene: la sala tiene que ir como el Single Player',
    armar: () => ({ jugadores: [{}, {}, {}] }),
  },
  'uno-lento': {
    descripcion: '3 PCs; uno con el procesador 3 veces más lento: la sala lo releva y los demás siguen a 60',
    armar: () => ({ jugadores: [{}, {}, { cpu: 3, n8: 'auto', puedeSalir: true }], topes: { lentos: [2] } }),
  },
  'uno-lejos': {
    descripcion: '3 PCs; uno lejos (~250 ms de ida y vuelta, la subida peor que la bajada) con picos de lag',
    armar: () => ({ jugadores: [{}, { red: 'wifi' }, { red: 'lejos', picos: { cada: 15, ms: 150, dura: 1000 } }], topes: { red: [2] } }),
  },
  'mezcla-graficos': {
    descripcion: '4 PCs con gráficos distintos (N8 No / 30 parejas / 60 con la del medio / Automático, salida, fluidez, efectos, texturas, 60 y 144 Hz): la misma carrera',
    armar: () => ({ jugadores: [
      { n8: '0', salida: 1080, monitor: 144 },
      { n8: '1', salida: 720, fluidez: 120, quitar: 15, texturas: 1, monitor: 60, dpr: 1.5 },
      { n8: '2', salida: 540, texturas: 2, monitor: 144, dpr: 2, vista: [800, 450] },
      { n8: 'auto', salida: 720, fluidez: 180, quitar: 31, monitor: 60, vista: [1260, 540] },
    ] }),
  },
  'telefono-imaginario': {
    descripcion: '2 PCs y un «teléfono»: CPU ×4, 30 parejas, pantalla de teléfono acostado (dpr 2,6, salida 720) y red de celular',
    armar: () => ({ jugadores: [{}, { red: 'wifi' },
      { cpu: 4, n8: '1', salida: 720, vista: [915, 412], dpr: 2.625, monitor: 60, red: 'celular-malo', puedeSalir: true }], topes: { lentos: [2], red: [2] } }),
  },
  tormenta: {
    descripcion: '4 PCs con todo junto: CPU distintas, redes malas con picos, un corte de 5 s, un cambio de red, tirones, una pestaña oculta y relojes corridos',
    armar: (azar, seg) => ({ jugadores: [
      { relojMs: -120, tirones: tirones(azar, 2, seg) },
      { cpu: 2, red: '4g', picos: { cada: 10, ms: 200, dura: 800 }, relojMs: 250, n8: '1', cambio: { t: +entre(azar, 20, seg - 15).toFixed(1), red: 'celular-malo' }, puedeSalir: true },
      { cpu: 1.5, red: 'wifi', corte: { t: +entre(azar, 15, seg - 20).toFixed(1), ms: 5000 }, n8: 'auto', salida: 720, puedeSalir: true },
      { red: 'lejos', oculta: { t: +entre(azar, 12, seg - 20).toFixed(1), s: 4 }, tirones: tirones(azar, 2, seg), n8: '2', monitor: 60, relojMs: -40, puedeSalir: true },
    ], topes: { lentos: [1, 2], red: [1, 2, 3], inventados: 0.3 } }),
  },
  'se-va-y-vuelve': {
    descripcion: '3 PCs; a uno se le corta la red 8 s a mitad de carrera y vuelve; otro esconde la pestaña 5 s',
    armar: (azar, seg) => ({ jugadores: [{}, { oculta: { t: +entre(azar, 10, 18).toFixed(1), s: 5 }, red: 'cable' },
      { red: 'wifi', corte: { t: +entre(azar, 22, Math.max(23, seg - 20)).toFixed(1), ms: 8000 }, puedeSalir: true }], topes: { red: [1, 2], inventados: 0.25 } }),
  },
  // (pedido de la sesión de los bugs, 2026-11-11: el tráfico de 6 en «Cada uno su kart» contra el lockstep, para extrapolar a 12)
  'seis-iguales': {
    descripcion: '6 PCs iguales con fibra: cuánto manda y recibe cada uno (paquetes y KB/s) y el retraso del kart remoto, para extrapolar a 12',
    armar: () => ({ jugadores: [{}, {}, {}, {}, {}, {}] }),
  },
  'seis-mixtos': {
    descripcion: '6 PCs distintos: CPU 1–2,5×, redes de fibra a 4G, N8 mezclados, 60 y 144 Hz, un tirón y un pico de lag',
    armar: (azar, seg) => ({ jugadores: [
      {}, { red: 'cable', n8: '1', monitor: 60 }, { cpu: 2, red: 'wifi', n8: 'auto', salida: 720 },
      { red: '4g', n8: '2', dpr: 1.5, picos: { cada: 20, ms: 120, dura: 600 } }, { cpu: 1.5, red: 'cable', tirones: tirones(azar, 1, seg), monitor: 60, quitar: 15 },
      { cpu: 2.5, red: 'lejos', n8: '1', salida: 540, puedeSalir: true },
    ], topes: { lentos: [2, 5], red: [3, 5], inventados: 0.2 } }),
  },
};

// el escenario armado: los jugadores completos (BASE + lo suyo) con su semilla de red propia
export function armarEscenario(nombre, { semilla = 1, segundos = 60 } = {}) {
  const e = ESCENARIOS[nombre];
  if (!e) throw new Error(`escenario desconocido: ${nombre} (hay: ${Object.keys(ESCENARIOS).join(', ')})`);
  const azar = azarConSemilla(semilla * 1000003 + [...nombre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
  const x = e.armar(azar, segundos);
  const jugadores = x.jugadores.map((j, i) => ({ ...BASE, ...j, i, semillaRed: (semilla * 97 + i * 13 + 1) >>> 0 }));
  if (jugadores.length < 2 || jugadores.length > 6) throw new Error('de 2 a 6 jugadores');
  return { nombre, descripcion: e.descripcion, semilla, segundos, jugadores,
    topes: { lentos: [], red: [], inventados: 0.05, adelantoMax: 60, ...(x.topes || {}) } };
}

// la red de un jugador como ?redSim (el nombre de REDES o un objeto { baja, sube })
export function specRed(j) {
  const r = typeof j.red === 'string' ? REDES[j.red] : j.red;
  if (!r) throw new Error(`red desconocida: ${j.red}`);
  return { semilla: j.semillaRed || 1, baja: r.baja, sube: r.sube, ...(j.picos ? { picos: j.picos } : {}) };
}

// lo que va en la dirección de la página de ese jugador (los gráficos y la red; el aparato lo pone el banco por DevTools)
export function parametrosDe(j) {
  const q = [`n8=${j.n8}`];
  if (j.salida) q.push(`salida=${j.salida}`);
  if (j.fluidez) q.push(`fluidez=${j.fluidez}`);
  if (j.quitar) q.push(`quitarEfectos=${j.quitar}`);
  if (j.texturas) q.push(`texturasMenos=${j.texturas}`);
  q.push('redSim=' + encodeURIComponent(JSON.stringify(specRed(j))));
  return '&' + q.join('&');
}

// la línea de tiempo de la carrera (segundos desde el «¡YA!»): qué le pasa a quién y cuándo, en orden
export function lineaDeTiempo(e) {
  const ev = [];
  for (const j of e.jugadores) {
    for (const t of j.tirones) ev.push({ t: t.t, i: j.i, que: 'tiron', ms: t.ms });
    if (j.oculta) ev.push({ t: j.oculta.t, i: j.i, que: 'oculta', s: j.oculta.s });
    if (j.corte) ev.push({ t: j.corte.t, i: j.i, que: 'corte', ms: j.corte.ms });
    if (j.cambio) ev.push({ t: j.cambio.t, i: j.i, que: 'cambio', red: j.cambio.red });
  }
  return ev.sort((a, b) => a.t - b.t || a.i - b.i);
}

// el percentil p (0–1) de una lista de números
export const percentil = (xs, p) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : null; };

// El veredicto. m = lo medido:
//   { modo: 'lockstep'|'estado', jugadores: [{ i, enCarrera, karts, logica, imagenes, bajo1, causas, ls (lockstep.estado()), avisos: [],
//     puntos: [12], vr: {…}, errorCpu: {medio, n} }], adelantos: [cuadros entre el más rápido y el más lento, cada 2 s],
//     largada: { cumple, detalle } | null, tablas: [la tabla de la sala de cada uno] }
// → [{ texto, ok, detalle, nota }] (nota = informativo: no cuenta)
export function evaluar(e, m) {
  const P = [], pt = (texto, ok, detalle = '', nota = false) => P.push({ texto, ok: !!ok, detalle, nota });
  const J = m.jugadores, L = i => String.fromCharCode(65 + i), lento = i => e.topes.lentos.includes(i), deRed = i => e.topes.red.includes(i);
  const puede = i => e.jugadores[i]?.puedeSalir;
  pt('la carrera se midió (todos con lógica y medidor)', J.length === e.jugadores.length && J.every(j => (j.logica ?? 0) > 5 && Number.isFinite(j.imagenes)),
    J.map(j => `${L(j.i)} lógica ${j.logica?.toFixed?.(1) ?? '—'}`).join(' · '));
  pt('todos llegaron a la carrera con 12 karts', J.every(j => j.enCarrera && j.karts === 12), J.map(j => `${L(j.i)} ${j.enCarrera ? j.karts + ' karts' : 'no llegó'}`).join(' · '));
  if (m.modo === 'lockstep') {
    const vivos = J.filter(j => j.ls && !j.ls.fuera);
    pt('las huellas iguales: la misma carrera en todos', vivos.length >= 2 && vivos.every(j => !j.ls.desincronizado && (j.ls.huellasIguales || 0) >= 3),
      J.map(j => `${L(j.i)} ${j.ls ? (j.ls.desincronizado ? 'SEPARADO ' + JSON.stringify(j.ls.desincronizado).slice(0, 120) : j.ls.huellasIguales + ' iguales') : 'sin lockstep'}`).join(' · '));
    if (m.largada) pt('largada pareja (la misma cuenta y el «¡YA!» a la vez)', m.largada.cumple, m.largada.detalle, J.some(j => lento(j.i) || deRed(j.i)) && !m.largada.cumple);
    const inv = J.map(j => j.ls ? (j.ls.inventados || 0) / Math.max(1, j.ls.cuadros || j.ls.cuadro || 1) : 0);
    pt(`inventados por debajo del ${Math.round(e.topes.inventados * 100)} % de los cuadros`, inv.every(x => x <= e.topes.inventados),
      J.map((j, k) => `${L(j.i)} ${j.ls?.inventados ?? '?'} (${(inv[k] * 100).toFixed(1)} %), relevos ${j.ls?.relevos ?? '?'}, pausas ${j.ls?.pausas?.length ?? '?'}, tarde ${j.ls?.tardeVivo ?? '?'}`).join(' · '));
  } else {
    const otros = J.filter(j => j.i > 0 && j.errorCpu);
    pt('las CPU de la anfitriona son las mismas en todas (error medio < 600 ≈ 6 m)', otros.length === J.length - 1 && otros.every(j => j.errorCpu.n > 0 && j.errorCpu.medio < 600),
      otros.map(j => `${L(j.i)} medio ${j.errorCpu.medio?.toFixed?.(0)} p90 ${j.errorCpu.p90?.toFixed?.(0)} (n ${j.errorCpu.n})`).join(' · ') || 'sin datos');
  }
  const ad = m.adelantos || [], p95 = percentil(ad, 0.95), max = ad.length ? Math.max(...ad) : null, ult = ad.slice(-3);
  pt(`el más rápido no se escapa (p95 ≤ ${e.topes.adelantoMax} cuadros y al final ≤ ${e.topes.adelantoMax})`, ad.length >= 5 && p95 <= e.topes.adelantoMax && ult.every(x => x <= e.topes.adelantoMax),
    `p95 ${p95}, máx ${max}, los últimos ${ult.join('/')} (cuadros de lógica entre el que va más adelante y el más atrás; ${ad.length} muestras)`);
  for (const j of J) {
    // (en el lockstep, con un lento a propósito la sala va a SU ritmo, §269b «esperaVivo»: la lógica de todos es nota;
    // lo que cuida esa sala es el adelanto de arriba)
    const debe = !lento(j.i) && !(m.modo === 'lockstep' && e.topes.lentos.length);
    pt(`${L(j.i)}: la lógica a 60 (≥ 57/s)${debe ? '' : lento(j.i) ? ' — es el lento a propósito' : ' — la sala va al ritmo del lento'}`, (j.logica ?? 0) >= 57,
      `lógica ${j.logica?.toFixed?.(1)}/s · imágenes ${j.imagenes?.toFixed?.(1)}/s · 1 % bajo ${j.bajo1?.toFixed?.(1)} · picos ${JSON.stringify(j.causas || {})}`, !debe);
  }
  const avisos = J.map(j => (j.avisos || []).length);
  const sinCulpa = !J.some(j => lento(j.i) || deRed(j.i) || e.jugadores[j.i].tirones.length || e.jugadores[j.i].oculta || e.jugadores[j.i].corte);
  pt('avisos 📶' + (sinCulpa ? ' (sin nadie lento ni con mala red: ninguno)' : ''), sinCulpa ? avisos.every(n => n === 0) : true,
    J.map(j => `${L(j.i)} ${(j.avisos || []).length}${(j.avisos || []).length ? ' («' + String(j.avisos.slice(-1)[0]).slice(0, 80) + '»)' : ''}`).join(' · '), !sinCulpa);
  const fuera = J.filter(j => j.ls?.fuera || j.ls?.cortado || j.ls?.salidasAtras || j.fuera);
  pt('nadie quedó fuera salvo los que podían', fuera.every(j => puede(j.i)),
    fuera.length ? fuera.map(j => `${L(j.i)} fuera (${j.ls?.cortado ? 'cortado' : j.ls?.salidasAtras ? 'muy atrás' : j.fuera || 'fuera'})`).join(' · ') : 'nadie');
  const conPuntos = J.filter(j => Array.isArray(j.puntos));
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  pt('los puntos del juego iguales en todos (suman 73)', conPuntos.length === J.length && conPuntos.every(j => sum(j.puntos) === 73 && JSON.stringify(j.puntos) === JSON.stringify(conPuntos[0].puntos)),
    conPuntos.map(j => `${L(j.i)} ${j.puntos.join(',')}`).join(' · ') || 'sin puntos');
  const tablas = (m.tablas || []).map(t => JSON.stringify(t ?? null));
  pt('la tabla de la sala igual en todos', tablas.length === J.length && tablas.every(t => t !== 'null' && t === tablas[0]), tablas.map((t, k) => `${L(k)} ${t.slice(0, 90)}`).join(' · '));
  const vrs = J.map(j => j.vr ? JSON.stringify((j.vr.corredores || []).map(c => [c.uid, c.puesto ?? c.p, c.vr])) : null);
  pt('el VR se calcula con los mismos datos en todos', vrs.every(v => v && v === vrs[0]), J.map(j => `${L(j.i)} ${j.vr ? `${j.vr.antes}→${j.vr.despues}` : 'sin VR'}`).join(' · '));
  return P;
}

// la línea de la tabla resumen de un escenario (markdown)
export function filaResumen(e, modo, puntos, J) {
  const bien = puntos.filter(p => p.ok && !p.nota).length, cuentan = puntos.filter(p => !p.nota).length;
  const mal = puntos.filter(p => !p.ok && !p.nota).map(p => p.texto.split(' (')[0]).join('; ');
  const log = J.map(j => (j.logica ?? 0).toFixed(0)).join('/'), img = J.map(j => (j.imagenes ?? 0).toFixed(0)).join('/'), bajo = J.map(j => (j.bajo1 ?? 0).toFixed(0)).join('/');
  return `| ${e.nombre} | ${modo} | ${e.jugadores.length} | ${bien}/${cuentan} | ${log} | ${img} | ${bajo} | ${mal || '—'} |`;
}
