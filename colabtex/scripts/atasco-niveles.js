/* Genera los niveles de Atasco (juegos/club/atasco/niveles.js).

   Desde colabtex/, en dos pasos:
     node scripts/atasco-niveles.js buscar <semilla> <escaladas>
         junta candidatos en $ATASCO_CACHE (o en la carpeta temporal),
         un archivo por semilla; se pueden correr varias a la vez, una
         por núcleo, porque no comparten nada.
     node scripts/atasco-niveles.js escribir
         junta todos los candidatos, los reparte en pisos y escribe
         juegos/club/atasco/niveles.js.
   Con las mismas semillas y escaladas sale siempre el mismo archivo. Los
   niveles de hoy salieron de las semillas 1, 2, 3 y 4 con 140 escaladas
   cada una (unos doce minutos con un núcleo por semilla).

   Resumen de lo que hace y por qué:
   1. Arma estacionamientos al azar (con una semilla fija, así que correrlo
      dos veces da el mismo archivo): el auto rojo en la fila de la salida y
      entre 7 y 13 vehículos más, a veces con conos. Después los «escala»:
      les saca, pone o cambia de sitio un vehículo y se queda con el cambio
      si el puzzle no se vuelve más corto.
   2. Recorre TODOS los estados a los que se puede llegar desde ahí (el
      «racimo»): mover un vehículo y devolverlo es siempre posible, así que
      el racimo es el mismo empiece donde empiece.
   3. Mide, desde los estados ya resueltos hacia atrás, cuántos movimientos
      le faltan a cada estado. El estado más lejano es el puzzle más difícil
      que ese estacionamiento puede dar: ese es el que se guarda.
   4. Reparte los puzzles en seis pisos, del más corto al más largo, y
      vuelve a resolver cada uno con el motor del juego para escribir su
      mínimo (y fallar si el generador y el motor no estuvieran de acuerdo).

   Es la misma idea con la que Michael Fogleman catalogó todos los puzzles
   de este tipo: buscar el estado más alejado de la salida en lugar de
   desordenar uno resuelto, que casi siempre deja niveles triviales. */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require("../../juegos/club/atasco/motor.js");          // las mismas reglas que la pantalla

const os = require("os");
const SALIDA = path.join(__dirname, "../../juegos/club/atasco/niveles.js");
const CACHE = process.env.ATASCO_CACHE || path.join(os.tmpdir(), "atasco-candidatos");  // carpeta de candidatos
const TAM = M.TAM;

/* Azar reproducible: mulberry32, el mismo que usan los otros juegos. */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let azar = mulberry32(20261005);                                   // se vuelve a sembrar en «buscar»
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));       // entero en [a, b]

/* Un estacionamiento al azar, como texto de 36 letras. */
function alAzar(nVehiculos, nConos) {
  const a = new Array(TAM * TAM).fill(M.LIBRE);
  const c0 = entre(0, 3);                                           // el rojo, nunca ya en la salida
  a[M.FILA_SALIDA * TAM + c0] = a[M.FILA_SALIDA * TAM + c0 + 1] = M.ROJO;
  const letras = "BCDEFGHIJKLMNOPQ";
  let puestos = 0;
  for (let intento = 0; intento < 400 && puestos < nVehiculos; intento++) {
    const largo = azar() < .28 ? 3 : 2;                             // un poco más de un cuarto son camiones
    const h = azar() < .5;
    if (h) {
      const f = entre(0, TAM - 1);
      if (f === M.FILA_SALIDA) continue;                            // uno de lado en la fila de la salida taparía para siempre
      const c = entre(0, TAM - largo);
      const ks = Array.from({ length: largo }, (_, j) => f * TAM + c + j);
      if (ks.some(k => a[k] !== M.LIBRE)) continue;
      for (const k of ks) a[k] = letras[puestos];
    } else {
      const c = entre(0, TAM - 1), f = entre(0, TAM - largo);
      const ks = Array.from({ length: largo }, (_, j) => (f + j) * TAM + c);
      if (ks.some(k => a[k] !== M.LIBRE)) continue;
      for (const k of ks) a[k] = letras[puestos];
    }
    puestos++;
  }
  for (let k = 0, puestosC = 0; k < 200 && puestosC < nConos; k++) { // conos, nunca en la fila de la salida
    const f = entre(0, TAM - 1), c = entre(0, TAM - 1);
    if (f === M.FILA_SALIDA || a[f * TAM + c] !== M.LIBRE) continue;
    a[f * TAM + c] = M.CONO; puestosC++;
  }
  return a.join("");
}

/* Recorre el racimo entero y devuelve el estado más lejano de la salida
   (y a cuántos movimientos está), o null si no tiene salida o es enorme.
   Es la parte que se repite cientos de miles de veces, así que no usa el
   motor tal cual: los estados viven en un arreglo plano y la clave de un
   vecino se calcula sumando, sin rehacer el número entero. El motor
   vuelve a resolver cada nivel elegido al final, así que si esta versión
   rápida se equivocara, el script se detendría en vez de escribirlo. */
function masLejano(nivel) {
  const V = nivel.vehiculos, n = V.length;
  const peso = V.map((_, i) => Math.pow(TAM, n - 1 - i));            // cuánto vale cada posición en la clave
  let cap = 4096, buf = new Int8Array(cap * n), claves = new Float64Array(cap), total = 0;
  const vistos = new Map();
  const mete = (pos, k) => {                                         // guarda un estado nuevo
    if (total === cap) {                                             // crece el arreglo al doble
      cap *= 2;
      const b2 = new Int8Array(cap * n); b2.set(buf); buf = b2;
      const k2 = new Float64Array(cap); k2.set(claves); claves = k2;
    }
    buf.set(pos, total * n); claves[total] = k; vistos.set(k, total); total++;
  };
  const occ = new Int8Array(TAM * TAM);
  const conos = nivel.conos;
  /* Llama a cb(i, d) por cada movimiento legal del estado q. */
  const vecinos = (q, cb) => {
    occ.fill(-1);
    for (const k of conos) occ[k] = -2;
    const o = q * n;
    for (let i = 0; i < n; i++) {
      const v = V[i], p = buf[o + i];
      for (let j = 0; j < v.largo; j++) occ[v.h ? v.carril * TAM + p + j : (p + j) * TAM + v.carril] = i;
    }
    for (let i = 0; i < n; i++) {
      const v = V[i], p = buf[o + i];
      for (let d = 1; p - d >= 0; d++) {                             // hacia atrás
        if (occ[v.h ? v.carril * TAM + p - d : (p - d) * TAM + v.carril] !== -1) break;
        cb(i, -d);
      }
      for (let d = 1; p + v.largo - 1 + d < TAM; d++) {               // hacia adelante
        const c = p + v.largo - 1 + d;
        if (occ[v.h ? v.carril * TAM + c : c * TAM + v.carril] !== -1) break;
        cb(i, d);
      }
    }
  };
  mete(nivel.pos, M.clave(nivel.pos));
  const tmp = new Int8Array(n);
  for (let q = 0; q < total; q++) {                                  // 1) todo el racimo
    const kq = claves[q];
    vecinos(q, (i, d) => {
      const k = kq + d * peso[i];
      if (vistos.has(k)) return;
      for (let j = 0; j < n; j++) tmp[j] = buf[q * n + j];
      tmp[i] += d;
      mete(tmp, k);
    });
    if (total > 400000) return null;                                 // demasiado grande para la tarea
  }
  const dist = new Int16Array(total).fill(-1);
  let frente = [];
  for (let q = 0; q < total; q++) if (buf[q * n] === M.META) { dist[q] = 0; frente.push(q); } // 2) los resueltos
  if (!frente.length) return null;                                   // racimo sin salida
  let lejos = frente[0], d = 0;
  while (frente.length) {                                            // 3) hacia atrás, capa por capa
    const sig = [];
    for (const q of frente) {
      const kq = claves[q];
      vecinos(q, (i, dd) => {
        const j = vistos.get(kq + dd * peso[i]);
        if (dist[j] === -1) { dist[j] = d + 1; sig.push(j); }
      });
    }
    if (sig.length) { d++; lejos = sig[0]; }
    frente = sig;
  }
  return { pos: Array.from(buf.subarray(lejos * n, lejos * n + n)), dist: d, racimo: total };
}

/* Los seis pisos del edificio: cuántos movimientos piden y cuántos niveles
   lleva cada uno. Los rangos se tocan para que la subida sea suave. */
const PISOS = [
  { id: "calle", nombre: "La calle", desc: "Para aprender a mover los autos.", min: 2, max: 8, n: 40, conos: 0 },
  { id: "s1", nombre: "Subterráneo 1", desc: "Ya hay que pensar dos jugadas.", min: 8, max: 14, n: 40, conos: .15 },
  { id: "s2", nombre: "Subterráneo 2", desc: "Camiones atravesados y poco espacio.", min: 14, max: 20, n: 40, conos: .25 },
  { id: "s3", nombre: "Subterráneo 3", desc: "Cada auto que mueves tapa a otro.", min: 20, max: 27, n: 40, conos: .25 },
  { id: "s4", nombre: "Subterráneo 4", desc: "Solo para quien no se rinde.", min: 27, max: 35, n: 40, conos: .2 },
  { id: "boveda", nombre: "La bóveda", desc: "Los atascos más largos que encontramos.", min: 35, max: 99, n: 40, conos: .2 }
];

/* Cambia un poco un estacionamiento: saca un vehículo, pone uno nuevo,
   cambia uno de sitio o pone/saca un cono. Es la «mutación» de la escalada. */
function muta(txt, conConos) {
  const a = txt.split("");
  const letras = [...new Set(a.filter(ch => /[B-Z]/.test(ch)))];
  const r = azar();
  const saca = l => { for (let k = 0; k < a.length; k++) if (a[k] === l) a[k] = M.LIBRE; };
  const pon = () => {                                              // un vehículo nuevo donde quepa
    const libre = "BCDEFGHIJKLMNOPQ".split("").find(l => !a.includes(l));
    if (!libre) return;
    for (let intento = 0; intento < 60; intento++) {
      const largo = azar() < .3 ? 3 : 2, h = azar() < .5;
      const f = h ? entre(0, TAM - 1) : entre(0, TAM - largo), c = h ? entre(0, TAM - largo) : entre(0, TAM - 1);
      if (h && f === M.FILA_SALIDA) continue;
      const ks = Array.from({ length: largo }, (_, j) => h ? f * TAM + c + j : (f + j) * TAM + c);
      if (ks.some(k => a[k] !== M.LIBRE)) continue;
      for (const k of ks) a[k] = libre;
      return;
    }
  };
  if (r < .3 && letras.length > 4) saca(letras[entre(0, letras.length - 1)]);
  else if (r < .6) pon();
  else if (r < .9 && letras.length) { saca(letras[entre(0, letras.length - 1)]); pon(); }
  else if (conConos) {                                             // un cono más o uno menos
    const conos = a.map((ch, k) => ch === M.CONO ? k : -1).filter(k => k >= 0);
    if (conos.length && azar() < .5) a[conos[entre(0, conos.length - 1)]] = M.LIBRE;
    else if (conos.length < 3) { const k = entre(0, TAM * TAM - 1); if (a[k] === M.LIBRE && Math.floor(k / TAM) !== M.FILA_SALIDA) a[k] = M.CONO; }
  }
  return a.join("");
}

/* Las letras de los vehículos, renombradas en el orden en que aparecen
   (la A sigue siendo el rojo): dos estacionamientos iguales con letras
   distintas son el mismo nivel, y así se ven repetidos. */
function canon(txt) {
  const mapa = { A: "A", o: "o", x: "x" };
  let sig = 1;
  return txt.split("").map(ch => mapa[ch] || (mapa[ch] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[sig++])).join("");
}

/* «buscar»: escaladas desde estacionamientos al azar. Se muta el puzzle
   más difícil hallado y se queda el cambio si el más lejano no empeora.
   Las primeras escaladas son cortas (dan niveles fáciles y variados) y las
   demás largas (dan los difíciles). Todo lo que se cruza se guarda como
   candidato, con el número de su escalada para no llenar un piso de primos. */
function buscar(semilla, escaladas) {
  azar = mulberry32(semilla);
  const archivo = path.join(CACHE, `semilla-${semilla}.json`);
  fs.mkdirSync(CACHE, { recursive: true });
  const cand = new Map();                                           // texto → candidato
  const t0 = Date.now();
  let k = 0, top = 0;
  for (let esc = 1; esc <= escaladas; esc++) {
    const conConos = azar() < .25;
    let txt = alAzar(entre(7, 13), conConos ? entre(1, 2) : 0), mejor = -1;
    const pasos = esc <= escaladas * .3 ? 40 : 260;                  // cortas primero, largas después
    for (let paso = 0; paso < pasos; paso++) {
      k++;
      const prueba = paso === 0 ? txt : muta(txt, conConos);
      let nivel;
      try { nivel = M.lee(prueba); } catch (e) { continue; }
      const r = masLejano(nivel);
      if (!r) continue;
      const t = canon(M.texto(nivel, r.pos));
      if (r.dist >= 2 && !cand.has(t))
        cand.set(t, { texto: t, dist: r.dist, esc: `${semilla}:${esc}`, conos: nivel.conos.length, vehiculos: nivel.vehiculos.length, racimo: r.racimo });
      if (r.dist >= mejor) { mejor = r.dist; txt = t; }             // sube o empata: se queda
      top = Math.max(top, r.dist);
    }
    if (esc % 5 === 0 || esc === escaladas) {
      fs.writeFileSync(archivo, JSON.stringify([...cand.values()]));
      process.stderr.write(`\rsemilla ${semilla}: ${esc}/${escaladas} escaladas · ${k} pruebas · más largo ${top} · ${Math.round((Date.now() - t0) / 1000)} s   `);
    }
  }
  process.stderr.write("\n");
}

/* Todos los candidatos de la carpeta, sin repetidos, agrupados por distancia. */
function leeCandidatos() {
  const porDist = new Map(), vistos = new Set();
  const archivos = fs.existsSync(CACHE) ? fs.readdirSync(CACHE).filter(f => /^semilla-\d+\.json$/.test(f)).sort() : [];
  for (const f of archivos)
    for (const x of JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8"))) {
      if (vistos.has(x.texto)) continue;
      vistos.add(x.texto);
      if (!porDist.has(x.dist)) porDist.set(x.dist, []);
      porDist.get(x.dist).push(x);
    }
  return porDist;
}

/* Elige los niveles de cada piso repartidos parejo entre su mínimo y su
   máximo, del más corto al más largo, sin repetir ninguno y (mientras se
   pueda) sin dos de la misma escalada. */
function reparte(porDist) {
  const usados = new Set(), porEsc = new Map();                     // niveles elegidos y cuántos por escalada
  const libre = (x, tope) => !usados.has(x.texto) && (porEsc.get(x.esc) || 0) < tope;
  return PISOS.map(piso => {
    const pool = [];
    for (let d = piso.min; d <= piso.max; d++)
      for (const x of porDist.get(d) || [])
        if (piso.conos > 0 || !x.conos) pool.push(x);
    if (pool.length < piso.n) throw new Error(`El piso ${piso.nombre} solo tiene ${pool.length} candidatos`);
    pool.sort((a, b) => a.dist - b.dist || a.texto.localeCompare(b.texto));
    const conConos = Math.round(piso.n * piso.conos);              // cuántos de este piso llevan conos
    const elegidos = [];
    for (let j = 0; j < piso.n; j++) {                              // uno de cada tramo del rango
      const ini = Math.floor(j * pool.length / piso.n), fin = Math.max(Math.floor((j + 1) * pool.length / piso.n), ini + 1);
      const quiereConos = elegidos.filter(x => x.conos).length < conConos && (j % 4 === 1);
      const ultimo = piso === PISOS[PISOS.length - 1] && j === piso.n - 1;   // el último del edificio: el más largo que haya
      const orden = (a, b) => (ultimo ? b.dist - a.dist : a.dist - b.dist) || (quiereConos ? b.conos - a.conos : a.conos - b.conos) || b.vehiculos - a.vehiculos || a.texto.localeCompare(b.texto); // el más corto del tramo primero: la subida es suave
      let x = null;
      for (const tope of ultimo ? [99] : [1, 2, 3, 99]) {             // el último no mira la escalada: va el más largo                           // primero uno por escalada; si no alcanza, se afloja
        x = (ultimo ? pool : pool.slice(ini, fin)).filter(y => libre(y, tope)).sort(orden)[0] ||
            pool.filter(y => libre(y, tope)).sort((a, b) => Math.abs(a.dist - pool[ini].dist) - Math.abs(b.dist - pool[ini].dist) || orden(a, b))[0];
        if (x) break;
      }
      usados.add(x.texto); porEsc.set(x.esc, (porEsc.get(x.esc) || 0) + 1); elegidos.push(x);
    }
    elegidos.sort((a, b) => a.dist - b.dist || a.texto.localeCompare(b.texto));
    return { piso, elegidos };
  });
}

function escribe(pisos) {
  const filas = [];
  for (const { piso, elegidos } of pisos) {
    const niveles = elegidos.map(x => {
      const sol = M.resuelve(M.lee(x.texto));                       // el motor de la pantalla confirma el mínimo
      if (!sol || sol.length !== x.dist) throw new Error(`Desacuerdo en ${x.texto}: ${x.dist} vs ${sol && sol.length}`);
      return `      ["${x.texto}", ${sol.length}]`;
    });
    filas.push(`    { id: "${piso.id}", nombre: "${piso.nombre}", desc: "${piso.desc}", niveles: [\n${niveles.join(",\n")}\n    ] }`);
  }
  const total = pisos.reduce((s, p) => s + p.elegidos.length, 0);
  const js = `/* Atasco — los niveles. GENERADO por colabtex/scripts/atasco-niveles.js:
   no se edita a mano, se vuelve a correr el script.
   Cada nivel es [estacionamiento de 36 letras, mínimo de movimientos].
   «o» libre, «x» cono, «A» el auto rojo, otra letra un vehículo.
   ${total} niveles en ${pisos.length} pisos, del más corto al más largo;
   tests/atasco.test.cjs comprueba que todos tienen salida, que el mínimo
   escrito es el verdadero y que se pueden sacar con 1, 2 y 3 estrellas. */
(function (raiz, datos) {
  if (typeof module === "object" && module.exports) module.exports = datos;
  else raiz.AtascoNiveles = datos;
})(typeof self !== "undefined" ? self : this, {
  pisos: [
${filas.join(",\n")}
  ]
});
`;
  fs.writeFileSync(SALIDA, js);
  console.log(`Escrito ${path.relative(process.cwd(), SALIDA)}: ${total} niveles`);
  for (const { piso, elegidos } of pisos)
    console.log(`  ${piso.nombre.padEnd(15)} ${elegidos[0].dist}–${elegidos[elegidos.length - 1].dist} movimientos, ${elegidos.filter(x => x.conos).length} con conos, ${new Set(elegidos.map(x => x.esc)).size} escaladas`);
}

/* Cuántos candidatos hay por distancia (para elegir los rangos de los pisos). */
function resumen() {
  const porDist = leeCandidatos();
  const filas = [...porDist.keys()].sort((a, b) => a - b).map(d => `${d}:${porDist.get(d).length}/${new Set(porDist.get(d).map(x => x.esc)).size}`);
  console.log("distancia:candidatos/escaladas\n" + filas.join("  "));
}

const [orden, a1, a2] = process.argv.slice(2);
if (orden === "buscar") buscar(Number(a1) || 1, Number(a2) || 100);
else if (orden === "resumen") resumen();
else if (orden === "escribir") escribe(reparte(leeCandidatos()));
else console.log("Uso: node scripts/atasco-niveles.js buscar <semilla> <escaladas> | resumen | escribir");
