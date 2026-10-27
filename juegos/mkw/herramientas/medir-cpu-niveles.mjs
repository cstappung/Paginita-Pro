// Medir qué tan rápidas son las CPU de cada nivel en cada cilindrada — PLAN M20 (la bitácora va con esa tarea).
//
// Resumen: el VR de la sala (§95, vr-sala.mjs REGLA_CPU) le da a cada nivel de CPU un VR fijo (difícil 5000, normal
// 3000). Esos valores se eligieron sin datos. Esta herramienta corre carreras directas con el juego, con las 12 en CPU
// (sin humano: ?soloCpu=1, así no actúa el «elástico» que ajusta su velocidad según dónde va el humano), y anota cuándo
// llega cada una. Cada combinación (cilindrada + nivel) corre las MISMAS pistas con las MISMAS semillas: misma pista,
// mismos personajes y vehículos en cada puesto, mismo azar de partida. Lo único que cambia es el nivel o la cilindrada,
// como un ensayo en el que se cambia una sola variable por vez.
//
// Lo que lee (memoria de la Wii, big-endian; direcciones del código abierto de Pulsar/mkw-decomp, las mismas que
// records.mjs y dnf.mjs):
//   Raceinfo 0x809BD730: +0x28 etapa (2 = corriendo, 4 = terminada), +0x14 → el reloj (minutos +0x8, segundos +0xA,
//     milésimas +0xC), +0xC → los 12 RaceinfoPlayer: +0xC avance (vueltas, float: 1,0 = empieza la vuelta 1), +0x20
//     puesto, +0x38 estado (bit 0x2 = cruzó la meta), +0x40 → su tiempo final (minutos u16 +4, segundos u8 +6, milésimas
//     u16 +8);
//   Racedata 0x809BD728: escenario de la carrera +0x20, jugador i en +8 + i·0xF0, tipo +0x10 (0 humano, 1 CPU).
// Sin humano la carrera se da por terminada cuando llega la PRIMERA (etapa 4) y el juego les estima el tiempo a las
// demás según su avance: solo el tiempo de la ganadora es real. Por eso la medida principal es el AVANCE de cada una
// (vueltas, del juego) cada 10 s del reloj de la carrera: la comparación es kart por kart, el mismo kart en el mismo
// instante de la misma carrera, cambiando solo el nivel o la cilindrada.
//
// Salen: build/web/datos/cpu-niveles/carreras.jsonl (una línea por carrera) y resumen.txt (por combinación y la
// comparación normal contra difícil). Lo que sale son tiempos del juego: no van a git (build/ está ignorado).
//
// Uso:  node herramientas/medir-cpu-niveles.mjs [--puerto 8163] [--pestanas 3]
//         [--combos c150:dificil,c150:normal,espejo:dificil,c100:normal,c100:dificil] [--pistas 0.0,13.2,20.2,30.2]
//         [--semillas 11,22] [--humano] [--etiqueta X] [--solo-resumen]
//       (c100 = la cilindrada 100cc del juego, que Retro Rewind corre como 200cc: §84. --humano = con el humano quieto
//       en el puesto 1, para ver el «elástico». --etiqueta X = otra carpeta (cpu-niveles-X): una corrida aparte, p. ej.
//       con otro programa. --solo-resumen = rehacer resumen.txt con lo ya medido)
// M20 (§96): los niveles son los de la página (dificultad-cpu.mjs: facil, normal, dificil, maximo), más altos que los
// del juego; la medición de antes (sin etiqueta, 2026-10-20) es con los del juego (normal = su fila normal, dificil =
// su fila difícil). Cada carrera anota lo que dice el gancho nativo (mkw_cpu_estado: nivel aplicado, velocidad escrita;
// §99: 14 la tabla de RR cargada, 15 karts de CPU mejorados, 16 el tope escrito ×1000, 17 veces que se subió el tope).
import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(opcion('--puerto', 8163));
const PESTANAS = Number(opcion('--pestanas', 3));
const COMBOS = opcion('--combos', 'c150:dificil,c150:normal,espejo:dificil,c100:normal,c100:dificil').split(',').map(x => x.split(':'));
const PISTAS = opcion('--pistas', '0.0,13.2,20.2,30.2').split(',');
const SEMILLAS = opcion('--semillas', '11,22').split(',').map(Number);
const HUMANO = process.argv.includes('--humano');
const ETIQUETA = opcion('--etiqueta', '');
const carpeta = path.join(raiz, 'build/web/datos', (HUMANO ? 'cpu-niveles-humano' : 'cpu-niveles') + (ETIQUETA ? '-' + ETIQUETA : ''));
const archivo = path.join(carpeta, 'carreras.jsonl');
mkdirSync(carpeta, { recursive: true });
const NOMBRE_CC = { c150: '150cc', espejo: 'espejo', c100: '200cc', c50: '50cc' };

// ---- lo que ya está medido (se puede cortar y seguir: no se repite lo que ya está en carreras.jsonl) ----
const leidas = () => (existsSync(archivo) ? readFileSync(archivo, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const clave = (cc, nivel, pista, semilla) => `${cc}:${nivel}:${pista}:${semilla}`;

// ---- una carrera en una pestaña ----
// (esto corre dentro de la página: lee la memoria del juego con el lector de menus.mjs)
function leerCarrera() {
  const L = window.mkwMenus;
  if (!L?.estado) return null;
  const ri = L.u32(0x809BD730), rd = L.u32(0x809BD728);
  if (!ri || !rd) return { etapa: -1 };
  const f32 = a => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, L.u32(a)); return d.getFloat32(0); };
  const r = L.u32(ri + 0x14), lista = L.u32(ri + 0xC);
  const reloj = r ? (L.u16(r + 0x8) * 60 + L.u8(r + 0xA)) * 1000 + L.u16(r + 0xC) : -1;
  const jugadores = [];
  for (let i = 0; i < 12; i++) {
    const p = lista ? L.u32(lista + 4 * i) : 0, t = p ? L.u32(p + 0x40) : 0;
    const llego = p ? (L.u32(p + 0x38) & 2) !== 0 : false;
    jugadores.push({ tipo: L.u32(rd + 0x20 + 8 + i * 0xF0 + 0x10), puesto: p ? L.u8(p + 0x20) : 0, avance: p ? f32(p + 0xC) : 0, llego,
                     tiempo: llego && t ? (L.u16(t + 4) * 60 + L.u8(t + 6)) * 1000 + L.u16(t + 8) : null });
  }
  return { etapa: L.u32(ri + 0x28), reloj, jugadores };
}

async function correrCarrera(contexto, [cc, nivel], pista, semilla) {
  const p = await contexto.newPage({ viewport: { width: 640, height: 360 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  const url = `http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=${pista}&cc=${cc}&cpu=${nivel}&semilla=${semilla}&pj=0&kart=1${HUMANO ? '' : '&soloCpu=1'}`;
  const t0 = Date.now();
  await p.goto(url);
  const r = { cc, nivel, pista, semilla, humano: HUMANO, marcas: {}, fin: null, errores };
  let ultimo = null, empezo = 0;
  while (Date.now() - t0 < 12 * 60000) {                       // (12 min de reloj de pared, con la carga incluida)
    await new Promise(listo => setTimeout(listo, 500));
    const c = await p.evaluate(leerCarrera).catch(() => null);
    if (!c || c.etapa < 2) { if (Date.now() - t0 > 180000 && !empezo) break; continue; }
    if (!empezo) {
      empezo = Date.now();
      r.ficha = await p.evaluate(() => window.mkwEstado?.ficha?.puestos?.map(q => [q.tipo, q.personaje, q.vehiculo])).catch(() => null);
      // (M20) lo que dice el gancho: cargas, aplicadas, nivel, objetos, adv/bias/min escritos, datos ok, los del juego…
      r.gancho = await p.evaluate(() => { const M = window.mkw; return M?._mkw_cpu_estado ? Array.from({ length: 20 }, (_, k) => M._mkw_cpu_estado(k)) : null; }).catch(() => null);
    }
    ultimo = c;
    // el avance de las 12 en cada marca de 10 s (la primera lectura pasada la marca: a lo más medio segundo después,
    // y se guarda también el reloj de esa lectura para corregir)
    const marca = Math.floor(c.reloj / 10000) * 10;
    if (c.etapa === 2 && marca > 0 && !r.marcas[marca]) r.marcas[marca] = { reloj: c.reloj, avances: c.jugadores.map(j => j.avance) };
    const cpus = c.jugadores.filter(j => j.tipo === 1);
    if (c.etapa >= 4 || (cpus.length && cpus.every(j => j.llego))) break;
    if (c.reloj > 6 * 60000) break;                            // (6 min de carrera: alguna quedó trabada)
  }
  r.fin = ultimo;
  r.segundos = Math.round((Date.now() - t0) / 1000);
  await p.close().catch(() => {});
  return r;
}

// ---- el resumen ----
const media = xs => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const mediana = xs => { const o = [...xs].sort((a, b) => a - b); return o.length ? (o.length % 2 ? o[o.length >> 1] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2) : NaN; };
const desvio = xs => { const m = media(xs); return Math.sqrt(media(xs.map(x => (x - m) ** 2))); };
const seg = ms => (ms / 1000).toFixed(2);
function resumen(carreras) {
  const lineas = [];
  const de = (cc, nivel) => carreras.filter(c => c.cc === cc && c.nivel === nivel && c.fin);
  const ganadora = c => Math.min(...c.fin.jugadores.filter(j => j.tipo === 1 && j.tiempo != null).map(j => j.tiempo));
  // la última marca de 10 s antes de que llegara la primera (ahí todas siguen corriendo de verdad)
  const ultimaMarca = c => Math.max(0, ...Object.keys(c.marcas || {}).map(Number).filter(m => m * 1000 < ganadora(c)));
  // vueltas recorridas en la lectura de la marca m (avance − 1: el avance empieza en 1,0)
  const recorrido = (c, m, i) => c.marcas[m].avances[i] - 1;
  lineas.push(`Carreras con 12 CPU${HUMANO ? ' (con el humano quieto en el puesto 1)' : ''}: pistas ${PISTAS.join(', ')}, semillas ${SEMILLAS.join(', ')}.`);
  lineas.push('Por combinación: el tiempo de la ganadora (real) y lo que recorre una CPU por minuto (vueltas/min, media de las 12):');
  lineas.push('  combinación          carreras  ganadora (s, media por pista)                  vueltas/min (media)  separación 1.ª–última (vueltas)');
  for (const [cc, nivel] of COMBOS) {
    const cs = de(cc, nivel);
    if (!cs.length) continue;
    const porPista = PISTAS.map(p => { const x = cs.filter(c => c.pista === p).map(ganadora); return x.length ? `${p} ${seg(media(x))}` : null; }).filter(Boolean).join(' · ');
    const vpm = [], sep = [];
    for (const c of cs) {
      const m = ultimaMarca(c); if (!m) continue;
      const rs = c.fin.jugadores.map((j, i) => (j.tipo === 1 ? recorrido(c, m, i) : null)).filter(x => x != null);
      vpm.push(media(rs) / (c.marcas[m].reloj / 60000));
      sep.push(Math.max(...rs) - Math.min(...rs));
    }
    lineas.push(`  ${(NOMBRE_CC[cc] + ' ' + nivel).padEnd(20)} ${String(cs.length).padStart(8)}  ${porPista.padEnd(45)}  ${media(vpm).toFixed(3).padStart(19)}  ${media(sep).toFixed(3).padStart(10)}`);
  }
  // comparación pareada: la misma pista y la misma semilla (mismos karts en los mismos puestos), cambiando una cosa
  const pares = [['c150', 'normal', 'c150', 'dificil'], ['c100', 'normal', 'c100', 'dificil'], ['espejo', 'dificil', 'c150', 'dificil'],
                 ['c100', 'normal', 'c150', 'dificil'], ['c100', 'dificil', 'c150', 'dificil'],
                 // M20: los niveles de la página
                 ['c150', 'facil', 'c150', 'normal'], ['c150', 'dificil', 'c150', 'normal'], ['c150', 'maximo', 'c150', 'normal'],
                 ['c150', 'maximo', 'c150', 'dificil'], ['espejo', 'maximo', 'c150', 'maximo'], ['c100', 'maximo', 'c150', 'maximo'],
                 // §99 (M23): intenso (el Hard AI de RR) e imposible (además, solo las CPU: tope, base y aceleración)
                 ['c150', 'intenso', 'c150', 'maximo'], ['c150', 'imposible', 'c150', 'intenso'], ['c150', 'imposible', 'c150', 'maximo'],
                 ['c100', 'imposible', 'c100', 'intenso']];
  lineas.push('');
  lineas.push('Comparación pareada (misma pista y semilla): cuánto recorre cada kart en A respecto del MISMO kart en B, en la');
  lineas.push('última marca de 10 s que tienen las dos carreras (antes de que llegue la primera); y el tiempo de la ganadora:');
  for (const [ca, na, cb, nb] of pares) {
    const rel = [], ganA = [];
    let karts = 0, masLentos = 0;
    for (const pista of PISTAS) for (const s of SEMILLAS) {
      const a = carreras.find(c => c.cc === ca && c.nivel === na && c.pista === pista && c.semilla === s && c.fin);
      const b = carreras.find(c => c.cc === cb && c.nivel === nb && c.pista === pista && c.semilla === s && c.fin);
      if (!a || !b) continue;
      const m = Math.min(ultimaMarca(a), ultimaMarca(b));
      if (!m) continue;
      // (cada lectura puede haber caído hasta medio segundo después de la marca: se pasa a vueltas por segundo)
      const vel = (c, i) => recorrido(c, m, i) / c.marcas[m].reloj;
      const cocientes = [];
      a.fin.jugadores.forEach((j, i) => { if (j.tipo === 1 && b.fin.jugadores[i]?.tipo === 1) { const q = vel(a, i) / vel(b, i) - 1; cocientes.push(q); karts++; if (q < 0) masLentos++; } });
      rel.push(media(cocientes));
      ganA.push(ganadora(a) / ganadora(b) - 1);
    }
    if (!rel.length) continue;
    const pc = x => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)} %`;
    lineas.push(`  ${(NOMBRE_CC[ca] + ' ' + na).padEnd(16)} vs ${(NOMBRE_CC[cb] + ' ' + nb).padEnd(16)}: ${rel.length} pares; recorre ${pc(media(rel))} ` +
                `(de ${pc(Math.min(...rel))} a ${pc(Math.max(...rel))}); más lento el mismo kart en ${masLentos} de ${karts}; ` +
                `la ganadora tarda ${pc(media(ganA))}`);
  }
  return lineas.join('\n');
}

if (process.argv.includes('--solo-resumen')) {
  const txt = resumen(leidas());
  writeFileSync(path.join(carpeta, 'resumen.txt'), txt + '\n');
  console.log(txt);
  process.exit(0);
}

// ---- correr ----
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const hechas = new Set(leidas().filter(c => c.fin).map(c => clave(c.cc, c.nivel, c.pista, c.semilla)));
const cola = [];
for (const s of SEMILLAS) for (const pista of PISTAS) for (const combo of COMBOS)
  if (!hechas.has(clave(combo[0], combo[1], pista, s))) cola.push([combo, pista, s]);
console.log(`${cola.length} carreras por correr (${hechas.size} ya medidas), ${PESTANAS} a la vez → ${carpeta}`);

// el servidor del juego (solo esta PC) y Chrome, los dos nuestros: al terminar se cierran solo estos
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const contexto = await navegador.newContext();
let hecho = 0;
const trabajador = async () => {
  while (cola.length) {
    const [combo, pista, s] = cola.shift();
    const r = await correrCarrera(contexto, combo, pista, s);
    appendFileSync(archivo, JSON.stringify(r) + '\n');
    hecho++;
    const cpus = r.fin?.jugadores?.filter(j => j.tipo === 1) || [];
    console.log(`[${hecho}] ${NOMBRE_CC[combo[0]]} ${combo[1]} pista ${pista} semilla ${s}: ${cpus.filter(j => j.llego).length}/${cpus.length} llegaron, ` +
                `reloj ${r.fin ? seg(r.fin.reloj) : '?'} s, ${r.segundos} s de pared${r.errores.length ? ', errores: ' + r.errores.slice(0, 2).join(' | ') : ''}`);
  }
};
try {
  await Promise.all(Array.from({ length: PESTANAS }, trabajador));
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}
const txt = resumen(leidas());
writeFileSync(path.join(carpeta, 'resumen.txt'), txt + '\n');
console.log('\n' + txt);
