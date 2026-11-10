// W32 (bitácora §258): ¿se nota que la IA de las CPU piense uno de cada dos cuadros?
//
// Resumen: compara carreras de 12 CPU medidas con herramientas/medir-cpu-niveles.mjs (con --traza) en dos o más
// carpetas: la de referencia (A) contra cada una de las otras. Las carreras se emparejan por cilindrada, nivel, pista y
// semilla (los mismos karts en los mismos puestos). Por cada nivel dice:
//   - cuánto recorre cada kart en B respecto del MISMO kart en A (en la última marca de 10 s antes de que llegue la
//     primera; media por carrera, y la media de las carreras ± su error), y el tiempo de la ganadora;
//   - el puesto medio de cada puesto de salida (los karts son distintos: uno más rápido tiende a ganar) y cuánto cambia;
//   - los tropiezos por carrera, de la traza (el avance de las 12 cada medio segundo): un tramo de al menos 1 s en que
//     el kart avanza a menos del 40 % de su ritmo normal (un choque, un golpe de un objeto, quedarse atascado) y las
//     caídas (el avance va hacia atrás más de 0,002 vueltas: Lakitu lo devuelve a la pista).
// La referencia para «dentro del ruido» es otra carpeta medida igual que A (sin cambiar nada): lo que difieren A y A2
// es lo que cambian las carreras solo por el azar; si B difiere de A como A2 de A, no se nota.
//
// Uso:  node herramientas/comparar-ia30.mjs build/web/datos/cpu-niveles-w32-base build/web/datos/cpu-niveles-w32-base2 build/web/datos/cpu-niveles-w32-ia30
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const carpetas = process.argv.slice(2);
if (carpetas.length < 2) { console.log('uso: node herramientas/comparar-ia30.mjs <carpeta A> <carpeta B> [<carpeta C> …]'); process.exit(1); }
const leer = c => { const a = path.join(c, 'carreras.jsonl'); return existsSync(a) ? readFileSync(a, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.fin) : []; };
const media = xs => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const error = xs => xs.length > 1 ? Math.sqrt(media(xs.map(x => (x - media(xs)) ** 2)) / (xs.length - 1)) : 0;   // error de la media
const pc = x => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(2)} %`;

const ganadora = c => Math.min(...c.fin.jugadores.filter(j => j.tipo === 1 && j.tiempo != null).map(j => j.tiempo));
const ultimaMarca = c => Math.max(0, ...Object.keys(c.marcas || {}).map(Number).filter(m => m * 1000 < ganadora(c)));
// el puesto de cada kart al final (el del juego; sin humano, la primera llega y a las demás se les estima)
const puestos = c => c.fin.jugadores.map(j => j.puesto);

// los tropiezos y caídas de una carrera, de la traza [reloj, avance0..11]
function tropiezos(c) {
  const t = c.traza || [];
  let tropiezos = 0, caidas = 0, segundosLentos = 0;
  if (t.length < 20) return null;
  for (let k = 0; k < 12; k++) {
    if (c.fin.jugadores[k]?.tipo !== 1) continue;
    const ritmos = [];
    for (let i = 1; i < t.length; i++) { const dt = t[i][0] - t[i - 1][0]; if (dt > 0) ritmos.push((t[i][1 + k] - t[i - 1][1 + k]) / dt); }
    const normal = [...ritmos].sort((a, b) => a - b)[Math.floor(ritmos.length / 2)] || 0;
    let lento = 0, enTropiezo = false;
    for (let i = 1; i < t.length; i++) {
      if (t[i][0] < 5000) continue;                                   // (la largada)
      if (c.fin.jugadores[k].llego && t[i][1 + k] >= Math.floor(t[t.length - 1][1 + k])) break;   // (ya cruzó la meta)
      const dt = t[i][0] - t[i - 1][0], d = t[i][1 + k] - t[i - 1][1 + k];
      if (dt <= 0) continue;
      if (d < -0.002) caidas++;
      if (d / dt < 0.4 * normal) { lento += dt; segundosLentos += dt / 1000; if (lento >= 1000 && !enTropiezo) { tropiezos++; enTropiezo = true; } }
      else { lento = 0; enTropiezo = false; }
    }
  }
  return { tropiezos, caidas, segundosLentos };
}

const A = leer(carpetas[0]);
console.log(`Referencia A = ${carpetas[0]} (${A.length} carreras)`);
for (const otra of carpetas.slice(1)) {
  const B = leer(otra);
  console.log(`\n=== ${otra} (${B.length} carreras) contra A`);
  const niveles = [...new Set(A.map(c => `${c.cc}:${c.nivel}`))];
  const total = { rel: [], gan: [], trA: [], trB: [], caA: [], caB: [], dPuesto: [] };
  for (const nv of niveles) {
    const [cc, nivel] = nv.split(':');
    const rel = [], gan = [], trA = [], trB = [], caA = [], caB = [], lenA = [], lenB = [];
    const puestoA = Array.from({ length: 12 }, () => []), puestoB = Array.from({ length: 12 }, () => []);
    let masLentos = 0, karts = 0;
    for (const a of A.filter(c => c.cc === cc && c.nivel === nivel)) {
      const b = B.find(c => c.cc === cc && c.nivel === nivel && c.pista === a.pista && c.semilla === a.semilla);
      if (!b) continue;
      const m = Math.min(ultimaMarca(a), ultimaMarca(b));
      if (!m) continue;
      const vel = (c, i) => (c.marcas[m].avances[i] - 1) / c.marcas[m].reloj;
      const q = [];
      a.fin.jugadores.forEach((j, i) => { if (j.tipo === 1 && b.fin.jugadores[i]?.tipo === 1) { const x = vel(b, i) / vel(a, i) - 1; q.push(x); karts++; if (x < 0) masLentos++; } });
      rel.push(media(q));
      gan.push(ganadora(b) / ganadora(a) - 1);
      puestos(a).forEach((p, i) => puestoA[i].push(p)); puestos(b).forEach((p, i) => puestoB[i].push(p));
      const ta = tropiezos(a), tb = tropiezos(b);
      if (ta && tb) { trA.push(ta.tropiezos); trB.push(tb.tropiezos); caA.push(ta.caidas); caB.push(tb.caidas); lenA.push(ta.segundosLentos); lenB.push(tb.segundosLentos); }
    }
    if (!rel.length) continue;
    const dPuesto = media(puestoA.map((xs, i) => Math.abs(media(xs) - media(puestoB[i]))));
    console.log(`  ${nv.padEnd(16)} ${String(rel.length).padStart(2)} pares: recorre ${pc(media(rel))} ± ${(100 * error(rel)).toFixed(2)} ` +
                `(de ${pc(Math.min(...rel))} a ${pc(Math.max(...rel))}; más lento el mismo kart ${masLentos}/${karts}); ganadora ${pc(media(gan))} ± ${(100 * error(gan)).toFixed(2)}; ` +
                `puesto medio por kart cambia ${dPuesto.toFixed(2)}; tropiezos/carrera ${media(trA).toFixed(1)} → ${media(trB).toFixed(1)}, ` +
                `caídas ${media(caA).toFixed(2)} → ${media(caB).toFixed(2)}, s lentos ${media(lenA).toFixed(1)} → ${media(lenB).toFixed(1)}`);
    total.rel.push(...rel); total.gan.push(...gan); total.trA.push(...trA); total.trB.push(...trB); total.caA.push(...caA); total.caB.push(...caB); total.dPuesto.push(dPuesto);
  }
  console.log(`  TODOS            ${total.rel.length} pares: recorre ${pc(media(total.rel))} ± ${(100 * error(total.rel)).toFixed(2)}; ganadora ${pc(media(total.gan))} ± ${(100 * error(total.gan)).toFixed(2)}; ` +
              `puesto medio cambia ${media(total.dPuesto).toFixed(2)}; tropiezos ${media(total.trA).toFixed(1)} → ${media(total.trB).toFixed(1)}; caídas ${media(total.caA).toFixed(2)} → ${media(total.caB).toFixed(2)}`);
  const ia = B.map(c => c.ia30Fin).filter(Boolean);
  if (ia.length) console.log(`  gancho (mkw_ia30_estado al final, media): modo ${media(ia.map(x => x[0]))}, pensadas ${Math.round(media(ia.map(x => x[2])))}, retenidas ${Math.round(media(ia.map(x => x[3])))}, karts ${media(ia.map(x => x[5]))}, CPU ${media(ia.map(x => x[6]))}, desbordes ${media(ia.map(x => x[7]))}`);
}

// ── El manejo de las CPU (con el programa que cuenta: r.ia30Bits y r.ia30Vueltas) ──────────────────────────────────────
// Las vueltas: el cuadro exacto en que cada kart empezó cada vuelta; la vuelta 1 (de la largada a la línea) y la 2
// (entera, lanzado) de cada CPU, el mismo kart en B contra A. Las marcas: cada bit de las 5 palabras del estado del kart
// (derrapar, el turbo, el golpe, en el aire…), sumando las CPU: veces que se prende por minuto de CPU y la parte del
// tiempo prendido. La diferencia es por carrera emparejada (B − A), su media ± su error; la primera carpeta después de A
// es el ruido (A repetida): una diferencia está «fuera del ruido» si es más de 2 errores y más grande que la del ruido más
// 2 de sus errores.
const vueltaDe = (c, i, v) => { const x = c.ia30Vueltas; if (!x) return null; const a = x[i * 9 + v], b = x[i * 9 + v + 1]; return a > 0 && b > a ? (b - a) / 60 : null; };
const NOMBRE_BIT = {};   // (se completa con los que se identifican: ver la bitácora §258)
function manejo(A, B) {
  const pares = [];
  for (const a of A) { const b = B.find(c => c.cc === a.cc && c.nivel === a.nivel && c.pista === a.pista && c.semilla === a.semilla); if (b) pares.push([a, b]); }
  const conBits = pares.filter(([a, b]) => a.ia30Bits && b.ia30Bits && a.ia30Bits[320] > 0 && b.ia30Bits[320] > 0);
  const v = { 1: [], 2: [] };
  for (const [a, b] of pares) for (const n of [1, 2]) {
    const q = [];
    for (let i = 0; i < 12; i++) { if (a.fin.jugadores[i]?.tipo !== 1) continue; const ta = vueltaDe(a, i, n), tb = vueltaDe(b, i, n); if (ta && tb) q.push(tb / ta - 1); }
    if (q.length) v[n].push(media(q));
  }
  const bits = [];
  for (let k = 0; k < 160; k++) {
    const ritmo = c => c.ia30Bits[k] / (c.ia30Bits[320] / 3600), parte = c => c.ia30Bits[160 + k] / c.ia30Bits[320];
    const rA = conBits.map(([a]) => ritmo(a)), pA = conBits.map(([a]) => parte(a));
    if (!conBits.length || (media(rA) < 0.5 && media(pA) < 0.005)) continue;
    bits.push({ k, ritmoA: media(rA), parteA: media(pA), dRitmo: conBits.map(([a, b]) => ritmo(b) - ritmo(a)), dParte: conBits.map(([a, b]) => parte(b) - parte(a)) });
  }
  return { v, bits, carreras: conBits.length };
}
const fuera = (d, ruido) => Math.abs(media(d)) > 2 * error(d) && (!ruido || Math.abs(media(d)) > Math.abs(media(ruido)) + 2 * error(ruido));
const conBitsA = A.filter(c => c.ia30Bits);
if (conBitsA.length) {
  const otras = carpetas.slice(1).map(c => ({ c, m: manejo(A, leer(c)) }));
  const ruido = otras[0].m;
  console.log(`\n=== El manejo de las CPU contra A (${conBitsA.length} carreras de A con las marcas; la primera de abajo es el ruido)`);
  for (const { c, m } of otras) {
    const esRuido = m === ruido;
    console.log(`\n--- ${c} (${m.carreras} carreras emparejadas con marcas)${esRuido ? '  [el ruido]' : ''}`);
    for (const n of [1, 2]) {
      const d = m.v[n], r = ruido.v[n];
      console.log(`  vuelta ${n} (el mismo kart): ${pc(media(d))} ± ${(100 * error(d)).toFixed(2)} (${d.length} carreras)` +
                  (esRuido ? '' : `  → ${fuera(d, r) ? 'FUERA del ruido' : 'dentro del ruido'}`));
    }
    console.log('  marca (palabra.bit)   por min de CPU en A   cambio por min          parte del tiempo en A   cambio de la parte');
    for (const b of m.bits) {
      const rb = ruido.bits.find(x => x.k === b.k);
      const fR = !esRuido && fuera(b.dRitmo, rb?.dRitmo), fP = !esRuido && fuera(b.dParte, rb?.dParte);
      const nombre = `${(b.k >> 5)}.${String(b.k & 31).padStart(2)}${NOMBRE_BIT[b.k] ? ' ' + NOMBRE_BIT[b.k] : ''}`;
      console.log(`  ${nombre.padEnd(20)} ${b.ritmoA.toFixed(1).padStart(10)}            ${(media(b.dRitmo) >= 0 ? '+' : '') + media(b.dRitmo).toFixed(2)} ± ${error(b.dRitmo).toFixed(2)}${fR ? ' *' : '  '}`.padEnd(68) +
                  `${(100 * b.parteA).toFixed(2).padStart(7)} %            ${(media(b.dParte) >= 0 ? '+' : '') + (100 * media(b.dParte)).toFixed(3)} ± ${(100 * error(b.dParte)).toFixed(3)} pts${fP ? ' *' : ''}`);
    }
    if (!esRuido) {
      const n = m.bits.filter(b => { const rb = ruido.bits.find(x => x.k === b.k); return fuera(b.dRitmo, rb?.dRitmo) || fuera(b.dParte, rb?.dParte); }).length;
      console.log(`  (* = fuera del ruido) marcas fuera del ruido: ${n} de ${m.bits.length}`);
    }
  }
}
