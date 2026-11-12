// decomp-avance.mjs — el tablero del avance de la decompilación (el «cuánto falta» de verdad).
//
// Resumen: junta cinco fuentes y escribe una página (build/decomp-avance/index.html) con los números reales:
//   1. el tamaño del código, de la cabecera de main.dol y StaticR.rel (el denominador fijo: bytes de código);
//   2. la lista de funciones del mapa público (terceros/mkw-decomp: symbols.txt, splits.txt, configure.py);
//   3. la lista de entradas de nuestro traductor (generated/base_translation_metadata.json) y lo que parcha Retro Rewind;
//   4. el perfil de una carrera (build/web/datos/impuesto-perfil/…): cuánto pesa cada función en el cuadro;
//   5. NUESTRO avance: herramientas/decomp-estado.json (una fila por función reescrita, escrita a mano al terminarla).
// No lleva código del juego: solo direcciones, tamaños, nombres públicos y tiempos. La página queda en build/ (ignorada).
//
// Uso:  node herramientas/decomp-avance.mjs [--perfil m1-carrera] [--sin-historial]
//   --perfil X       = el perfil a usar (build/web/datos/impuesto-perfil/X-trabajo.json y X-wasm/*.cpuprofile)
//   --sin-historial  = no agrega la fila de hoy al historial de decomp-estado.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // la carpeta del proyecto
const en = (...p) => path.join(RAIZ, ...p);                                      // ruta dentro del proyecto
const arg = (n, d) => { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; };
const PERFIL = arg('--perfil', 'm1-carrera');                                    // el perfil de carrera
const WC = process.env.MKW_WIICOMPILED || 'terceros/Wiicompiled-motor-w30-403s'; // la copia del traductor en uso
const MAPA = 'terceros/mkw-decomp';                                              // el mapa público
const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(8, '0');         // dirección como 0x807C0884

// ---------- 1. El tamaño del código (el denominador) ----------
const dol = fs.readFileSync(en('extraido/disco/sys/main.dol'));
const rel = fs.readFileSync(en('extraido/disco/files/rel/StaticR.rel'));
const u32 = (b, o) => b.readUInt32BE(o);                                         // la Wii guarda los números al revés (big-endian)
const secciones = [];                                                            // {nombre, ini, fin}: cada tramo de código
for (let i = 0; i < 7; i++) {                                                    // main.dol: hasta 7 secciones de código
  const tam = u32(dol, 0x90 + 4 * i), dir = u32(dol, 0x48 + 4 * i);
  if (tam) secciones.push({ nombre: i === 0 ? 'main.dol · arranque' : 'main.dol · código', arch: 'dol', ini: dir, fin: dir + tam });
}
let relTam = 0;                                                                  // StaticR.rel: la sección ejecutable (bit 0 del offset)
{ const n = u32(rel, 0x0C), tab = u32(rel, 0x10);
  for (let i = 0; i < n; i++) { const off = u32(rel, tab + 8 * i), tam = u32(rel, tab + 8 * i + 4); if ((off & 1) && tam) relTam = tam; } }

// ---------- 2. El mapa público: funciones, unidades y cuáles ya calzan ----------
const RE_SIM = /^(\S+) = (\S+):0x([0-9A-Fa-f]+); \/\/ type:function(?: size:0x([0-9A-Fa-f]+))?/;
const leerSim = (f) => fs.readFileSync(en(f), 'utf8').split('\n').map(l => l.match(RE_SIM)).filter(Boolean)
  .map(m => ({ n: m[1], sec: m[2], a: parseInt(m[3], 16), t: m[4] ? parseInt(m[4], 16) : 0 }));
const leerUnidades = (f) => {                                                    // splits.txt → [{unidad, ini, fin}] de .text
  const u = []; let act = null;
  for (const l of fs.readFileSync(en(f), 'utf8').split('\n')) {
    const c = l.match(/^(\S.*):\s*$/); if (c) { act = c[1]; continue; }
    const m = l.match(/^\s+\.text\s+start:0x([0-9A-Fa-f]+) end:0x([0-9A-Fa-f]+)/);
    if (m && act && act !== 'Sections') u.push({ unidad: act, ini: parseInt(m[1], 16), fin: parseInt(m[2], 16) });
  }
  return u.sort((a, b) => a.ini - b.ini);
};
const conf = fs.readFileSync(en(MAPA, 'configure.py'), 'utf8');
const calzan = new Set([...conf.matchAll(/Object\(Matching,\s*"([^"]+)"/g)].map(m => m[1]));   // unidades que ya calzan

// La base de carga de StaticR.rel: las direcciones del mapa son relativas a .text; las del traductor, las de memoria.
const meta = JSON.parse(fs.readFileSync(en(WC, 'generated/base_translation_metadata.json'), 'utf8'));
const trad = meta.functions.map(f => f.entryPoint).sort((a, b) => a - b);        // entradas del traductor
const simRel = leerSim(`${MAPA}/config/RMCP01/module/symbols.txt`).filter(f => f.sec === '.text');
const votos = new Map();                                                         // la diferencia más repetida = la base
{ const d0 = simRel.slice(0, 200).map(f => f.a);
  for (const a of trad.filter(x => x >= 0x80500000).slice(0, 400)) for (const d of d0) votos.set(a - d, (votos.get(a - d) || 0) + 1); }
// El mapa nuevo (doldecomp/mkw) ya trae las direcciones de memoria: ahí la base es 0 y el código empieza en la primera función.
const ABSOLUTO = simRel.length > 0 && Math.min(...simRel.slice(0, 50).map(f => f.a)) >= 0x80000000;
const BASE_REL = ABSOLUTO ? 0 : [...votos].sort((a, b) => b[1] - a[1])[0][0];
const INI_REL = ABSOLUTO ? simRel.reduce((m, f) => Math.min(m, f.a), Infinity) : BASE_REL;
secciones.push({ nombre: 'StaticR.rel · el juego', arch: 'rel', ini: INI_REL, fin: INI_REL + relTam });

const uniDol = leerUnidades(`${MAPA}/config/RMCP01/splits.txt`);
const uniRel = leerUnidades(`${MAPA}/config/RMCP01/module/splits.txt`).map(u => ({ ...u, ini: u.ini + BASE_REL, fin: u.fin + BASE_REL }));
const unidades = [...uniDol, ...uniRel].sort((a, b) => a.ini - b.ini);
const unidadDe = (a) => { let lo = 0, hi = unidades.length - 1;                  // búsqueda binaria de la unidad que contiene a
  while (lo <= hi) { const m = (lo + hi) >> 1; if (unidades[m].fin <= a) lo = m + 1; else if (unidades[m].ini > a) hi = m - 1; else return unidades[m].unidad; } return ''; };

const auto = /^(fn_|lbl_|func_|sub_|zz_|FUN_|unk_)/i;                            // nombres puestos por la máquina, sin significado
const funcs = [...leerSim(`${MAPA}/config/RMCP01/symbols.txt`).map(f => ({ ...f, arch: 'dol' })),
  ...simRel.map(f => ({ ...f, a: f.a + BASE_REL, arch: 'rel' }))]
  .filter(f => secciones.some(s => f.a >= s.ini && f.a < s.fin)).sort((a, b) => a.a - b.a);
for (const f of funcs) { f.u = unidadDe(f.a); f.pub = f.u ? (calzan.has(f.u) ? 2 : 1) : 0; f.ms = 0; f.rr = 0; f.est = ''; }
const duenoDe = (a) => { let lo = 0, hi = funcs.length - 1;                      // la función conocida que contiene a
  while (lo <= hi) { const m = (lo + hi) >> 1; const f = funcs[m]; if (f.a + Math.max(f.t, 1) <= a) lo = m + 1; else if (f.a > a) hi = m - 1; else return f; } return null; };

// ---------- 3. Descubrimiento: bytes de código sin función dueña, y el cruce con el traductor ----------
const desc = secciones.map(s => {
  const fs_ = funcs.filter(f => f.a >= s.ini && f.a < s.fin); let p = s.ini, cub = 0; const huecos = [];
  for (const f of fs_) { if (f.a > p) huecos.push([p, f.a - p]); const e = f.a + f.t; if (e > p) { cub += e - Math.max(p, f.a); p = e; } }
  if (s.fin > p) huecos.push([p, s.fin - p]);
  const tl = trad.filter(a => a >= s.ini && a < s.fin), ini = new Set(fs_.map(f => f.a)), ts = new Set(tl);
  const extra = tl.filter(a => !ini.has(a));                                     // entradas del traductor que el mapa no tiene
  const fuera = extra.filter(a => !duenoDe(a));                                  // …y que caen en un hueco: candidatas a función nueva
  return { nombre: s.nombre, bytes: s.fin - s.ini, funciones: fs_.length, cubierto: cub, sinDueno: (s.fin - s.ini) - cub,
    huecos: huecos.filter(h => h[1] > 16).sort((a, b) => b[1] - a[1]).slice(0, 12).map(h => [hex(h[0]), h[1]]),
    nHuecos: huecos.filter(h => h[1] > 16).length, traductor: tl.length, interiores: extra.length - fuera.length,
    candidatas: fuera.length, soloMapa: fs_.filter(f => !ts.has(f.a)).length };
});

// Lo que parcha Retro Rewind: la función que contiene cada dirección parchada queda marcada.
try { const mod = JSON.parse(fs.readFileSync(en(WC, 'generated/base_translation_mod_awareness.json'), 'utf8'));
  for (const a of (mod.profiles?.[0]?.consequentialPatchedAddresses || [])) { const f = duenoDe(a); if (f) f.rr = 1; } } catch { /* sin el archivo: nadie marcado */ }

// ---------- 4. El perfil de la carrera: milisegundos por cuadro de cada función ----------
const carrera = { perfil: PERFIL, cuadros: 0, juegoMs: 0, rrMs: 0, sinDuenoMs: 0, otroMs: 0, totalMs: 0, rrFunciones: 0 };
try {
  const trabajo = JSON.parse(fs.readFileSync(en(`build/web/datos/impuesto-perfil/${PERFIL}-trabajo.json`), 'utf8'));
  const dir = en(`build/web/datos/impuesto-perfil/${PERFIL}-wasm`);
  const p = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.cpuprofile'))), 'utf8'));
  const cuadrosH = Object.keys(trabajo.horasWasm).map(Number).sort((a, b) => a - b);
  const HASTA = cuadrosH[cuadrosH.length - 1], DESDE = cuadrosH.find(c => c >= HASTA - 2700) ?? cuadrosH[0];   // el tramo de carrera
  const desdeUs = trabajo.horasWasm[DESDE].us, hastaUs = trabajo.horasWasm[HASTA].us; carrera.cuadros = HASTA - DESDE;
  const nodo = new Map(p.nodes.map(n => [n.id, n.callFrame.functionName])); const rrSet = new Set();
  let t = p.startTime;
  for (let i = 0; i < p.samples.length; i++) {
    t += p.timeDeltas[i] ?? 0; if (t < desdeUs || t > hastaUs) continue;
    const ms = (p.timeDeltas[i + 1] ?? 0) / 1000, nom = nodo.get(p.samples[i]) || '';
    if (/^(\(idle\)|\(program\)|\(garbage collector\))$/.test(nom)) continue;    // esperas y servicio del motor de JS: no es el juego
    carrera.totalMs += ms;
    if (/^rr_kamek_/.test(nom)) { carrera.rrMs += ms; rrSet.add(nom); continue; } // el código propio de Retro Rewind (tiene fuente pública)
    const m = /Thunk|InvokeDirect/.test(nom) ? null : nom.match(/_([0-9A-Fa-f]{8})$/);   // func_807C0884, rr_overlay_8052FB90, GX…_80172f64
    if (!m) { carrera.otroMs += ms; continue; }
    const f = duenoDe(parseInt(m[1], 16));
    if (f) { f.ms += ms; carrera.juegoMs += ms; if (/^rr_overlay_/.test(nom)) f.rr = 1; } else carrera.sinDuenoMs += ms;
  }
  for (const k of ['juegoMs', 'rrMs', 'sinDuenoMs', 'otroMs', 'totalMs']) carrera[k] /= carrera.cuadros;       // a ms por cuadro
  for (const f of funcs) f.ms /= carrera.cuadros;
  carrera.rrFunciones = rrSet.size;
} catch (e) { console.error('sin perfil de carrera:', e.message); }

// ---------- 5. Nuestro avance ----------
const ESTADO = en('herramientas/decomp-estado.json');
const estado = JSON.parse(fs.readFileSync(ESTADO, 'utf8'));
const porDir = new Map(funcs.map(f => [f.a, f]));
for (const e of estado.funciones) { const f = porDir.get(parseInt(e.dir, 16)); if (!f) { console.error('no está en el mapa:', e.dir); continue; }
  f.est = e.estado; f.nota = e.nota || ''; f.fecha = e.fecha || ''; if (e.nombre) f.n = e.nombre; }
// El informe de objdiff del proyecto público armado aquí (terceros/mkw-decomp/build/RMCP01/report.json): qué funciones
// calzan byte a byte con el original. Las que ya calzaban al empezar están en decomp-base.json (material público);
// las que calzan y no están ahí son avance nuestro: estado «calza» (falta llevarlas a nuestro programa y verificarlas).
const calce = { hay: false, total: 0, base: 0, nuestras: 0, parciales: 0 };
try {
  const rep = JSON.parse(fs.readFileSync(en(MAPA, 'build/RMCP01/report.json'), 'utf8'));
  const bj = JSON.parse(fs.readFileSync(en('herramientas/decomp-base.json'), 'utf8'));
  const base = new Set(bj.direcciones.map(d => parseInt(d, 16))), baseParcial = new Set((bj.parciales || []).map(d => parseInt(d, 16)));
  calce.hay = true;
  for (const f of funcs) f.pub = 0;                                              // con el informe, «pública» = calzaba en la base
  for (const u of rep.units) for (const fr of (u.functions || [])) {
    if (fr.metadata?.virtual_address == null) continue;
    let dir = Number(fr.metadata.virtual_address); if (u.metadata?.module_name && dir < 0x80000000) dir += INI_REL;   // las del módulo vienen relativas a su código
    const f = porDir.get(dir); if (!f) continue;
    const p = fr.fuzzy_match_percent || 0; f.calza = p;
    if (fr.metadata?.demangled_name && auto.test(f.n)) f.n = fr.metadata.demangled_name;
    if (p === 100) { calce.total++; if (base.has(f.a)) { f.pub = 2; calce.base++; } else { calce.nuestras++; if (!f.est) { f.est = 'calza'; f.nota = 'Calza byte a byte con el original (objdiff). Falta llevarla a nuestro programa y verificarla en carrera.'; } } }
    else if (p > 0) { calce.parciales++; if (!f.est && !baseParcial.has(f.a)) { f.est = 'borrador'; f.nota = 'En curso: calza al ' + p.toFixed(1) + ' % (objdiff).'; } }
  }
} catch (e) { console.error('sin informe de objdiff:', e.message); }
// La auditoría (herramientas/decomp-auditoria.json): una segunda sesión revisa, en una copia limpia, que cada función
// nuestra que «calza» calce de verdad (compilación desde cero, 100 % en el informe, C real sin trucos, SHA-1 del juego igual).
// «ok» se anota en la nota; «rechazada» la devuelve a «en curso» con el motivo.
calce.auditadas = 0; calce.rechazadas = 0;
try {
  for (const a of JSON.parse(fs.readFileSync(en('herramientas/decomp-auditoria.json'), 'utf8')).funciones) {
    const f = porDir.get(parseInt(a.dir, 16)); if (!f || f.est !== 'calza') continue;
    if (a.resultado === 'ok') { calce.auditadas++; f.nota = 'Auditada el ' + a.fecha + ': calza en una compilación limpia. ' + f.nota; }
    else { calce.rechazadas++; f.est = 'borrador'; f.nota = 'Rechazada por la auditoría (' + a.fecha + '): ' + (a.motivo || 'sin motivo anotado'); }
  }
} catch { /* sin auditoría todavía */ }
const HECHO = new Set(['verificada', 'adoptada']);                               // lo que cuenta como hecho
const suma = (l, g) => l.reduce((s, x) => s + g(x), 0);
const resumenDe = (l) => ({ funciones: l.length, bytes: suma(l, f => f.t), ms: suma(l, f => f.ms),
  hechasN: l.filter(f => HECHO.has(f.est)).length, hechasBytes: suma(l.filter(f => HECHO.has(f.est)), f => f.t), hechasMs: suma(l.filter(f => HECHO.has(f.est)), f => f.ms),
  cursoN: l.filter(f => (f.est === 'borrador' || f.est === 'calza')).length, cursoBytes: suma(l.filter(f => (f.est === 'borrador' || f.est === 'calza')), f => f.t), cursoMs: suma(l.filter(f => (f.est === 'borrador' || f.est === 'calza')), f => f.ms),
  adoptadasN: l.filter(f => f.est === 'adoptada').length,
  pubN: l.filter(f => f.pub === 2 && !f.est).length, pubBytes: suma(l.filter(f => f.pub === 2 && !f.est), f => f.t), pubMs: suma(l.filter(f => f.pub === 2 && !f.est), f => f.ms),
  rrN: l.filter(f => f.rr).length });
const deCarrera = funcs.filter(f => f.ms > 0);
const totales = { carrera: resumenDe(deCarrera), todo: resumenDe(funcs) };
totales.todo.bytes = suma(secciones, s => s.fin - s.ini);                        // el denominador de «todo» es el código entero, con dueño o no

// Las zonas del binario entero: bloques de 64 KB de direcciones (como las «áreas» de la página de ejemplo).
const BLOQUE = 0x10000; const zonas = new Map();
for (const f of funcs) { const k = Math.floor(f.a / BLOQUE) * BLOQUE; let z = zonas.get(k);
  if (!z) zonas.set(k, z = { a: k, arch: f.arch, bytes: 0, n: 0, hechas: 0, curso: 0, pub: 0, ms: 0, dirs: {} });
  z.bytes += f.t; z.n++; z.ms += f.ms; if (HECHO.has(f.est)) z.hechas += f.t; else if ((f.est === 'borrador' || f.est === 'calza')) z.curso += f.t; else if (f.pub === 2) z.pub += f.t;
  const d = f.u ? f.u.split('/').slice(0, -1).join('/') || f.u : ''; if (d) z.dirs[d] = (z.dirs[d] || 0) + f.t; }
const zonasL = [...zonas.values()].map(z => { const d = Object.entries(z.dirs).sort((a, b) => b[1] - a[1])[0];
  return [hex(z.a), z.arch, z.bytes, z.n, z.hechas, z.curso, z.pub, +z.ms.toFixed(4), d ? d[0] : '']; });

// El historial: una fila por día en que cambian los números (queda en decomp-estado.json, en git).
const hoy = new Date().toLocaleDateString('sv-SE');                              // AAAA-MM-DD, hora local
const fila = { fecha: hoy, funciones: totales.carrera.hechasN, bytes: totales.todo.hechasBytes, ms: +totales.carrera.hechasMs.toFixed(4),
  deMs: +totales.carrera.ms.toFixed(4), deFunciones: totales.carrera.funciones, calzan: calce.nuestras, calzanCarrera: deCarrera.filter(f => f.est === 'calza').length };
estado.historial ||= [];
const ult = estado.historial[estado.historial.length - 1];
if (!process.argv.includes('--sin-historial') && (!ult || ult.funciones !== fila.funciones || ult.bytes !== fila.bytes || ult.deFunciones !== fila.deFunciones || ult.calzan !== fila.calzan)) {
  if (ult && ult.fecha === hoy) estado.historial[estado.historial.length - 1] = fila; else estado.historial.push(fila);
  fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2) + '\n');
}

// ---------- La página ----------
const datos = { generado: new Date().toISOString(), calce, carrera, totales, desc, zonas: zonasL, historial: estado.historial,
  // una fila por función de la carrera: [dirección, bytes, nombre, ms por cuadro, fuente pública 0/1/2, la parcha RR, estado, nota, unidad]
  funciones: deCarrera.sort((a, b) => b.ms - a.ms).map(f => [hex(f.a), f.t, auto.test(f.n) ? '' : f.n, +f.ms.toFixed(5), f.pub, f.rr, f.est, f.nota || '', f.u]) };
const SALIDA = en('build/decomp-avance'); fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, 'datos.json'), JSON.stringify(datos));
const plantilla = fs.readFileSync(en('herramientas/decomp-avance.html'), 'utf8');
fs.writeFileSync(path.join(SALIDA, 'index.html'), plantilla.replace('/*DATOS*/null', () => JSON.stringify(datos).replace(/</g, '\\u003c')));

const c = totales.carrera, pc = (a, b) => (b ? (100 * a / b).toFixed(2) : '0') + ' %';
console.log(`código: ${totales.todo.bytes} bytes · ${funcs.length} funciones conocidas · sin dueño ${suma(desc, d => d.sinDueno)} bytes`);
console.log(`carrera (${PERFIL}, ${carrera.cuadros} cuadros): ${c.funciones} funciones del juego · ${c.ms.toFixed(3)} ms/cuadro · Retro Rewind propio ${carrera.rrMs.toFixed(3)} ms (${carrera.rrFunciones})`);
console.log(`hecho: ${c.hechasN} funciones (${pc(c.hechasN, c.funciones)}) · ${c.hechasMs.toFixed(4)} ms (${pc(c.hechasMs, c.ms)}) · con fuente pública que calza: ${c.pubN}`);
console.log(`calzan (objdiff): ${calce.total} · ya calzaban ${calce.base} · nuestras ${calce.nuestras} · a medias ${calce.parciales} · auditadas ${calce.auditadas} · rechazadas ${calce.rechazadas}`);
console.log(`página: ${path.join(SALIDA, 'index.html')}`);
