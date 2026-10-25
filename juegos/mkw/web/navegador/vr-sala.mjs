// El VR de las carreras de la sala (bitácora §82; pedido del dueño 2026-10-19: «que el VR se mueva con las carreras de
// la sala y quede guardado en Firebase»).
//
// Resumen: en la sala el juego no calcula el VR (para él son carreras sin conexión: UpdatePoints, 0x8052E950, solo lo
// hace en los modos en línea, +0xB50 entre 7 y 10). Lo calculamos aquí con la MISMA regla de Mario Kart Wii, sacada
// del juego (el código traducido, funciones 0x8052D118, 0x8052D1C0 y 0x8052CEF8) y que también describe mkwiiki:
//   - se arma cada PAR de humanos de la carrera; el que llegó antes «gana» el par, el otro lo «pierde»; empate = nada;
//   - diferencia = VR del perdedor − VR del ganador, recortada a ±9998;
//   - t = (diferencia + 9998) / 4999 (de 0 a 4: el juego multiplica por 1/4999, el número de 0x8088FF90; con la
//     prueba del juego mismo, prueba-vr.mjs) y los puntos del par salen de una curva suave (B-spline cúbica uniforme)
//     con los valores 0, 1, 8, 50 y 125 cada 4999 de diferencia: ganarle a alguien de mucho más VR da hasta 112; a
//     alguien de mucho menos, 0; a uno igual, 13. El resultado se trunca (se le sacan los decimales);
//   - el ganador suma esos puntos y el perdedor los resta (los mismos): el VR total que se mueve en la sala es cero;
//   - el cambio de cada uno es la suma de todos sus pares; el primero nunca pierde y el último nunca gana.
// Como un reparto de carga entre pares de acumuladores: cada par se ecualiza un poco según la diferencia, y lo que
// sube uno lo baja el otro.
// En la sala, además:
//   - §95 (pedido del dueño: «que el VR dependa de la posición general incluyendo a los bots, pero con más peso
//     respecto a jugadores reales»): las CPU también cuentan, como rivales de VR FIJO (el ancla de su nivel, REGLA_CPU)
//     y con menos peso: cada par contra una CPU vale 1/4 de un par contra un humano, y todas juntas a lo más 2
//     humanos. Ganarle a una CPU suma peso·puntosPar(VR, ancla); que te gane resta peso·puntosPar(ancla, VR). La parte
//     de las CPU se suma entera y se redondea una vez (§99, la regla v2: ver REGLA_CPU). La CPU no gana ni pierde nada:
//     contra un rival fijo el VR de cada uno se equilibra solo (como un lazo realimentado con referencia fija), sin
//     inflación sin fin, y una cuenta alterna quieta ya no le regala VR a nadie. Los pares entre humanos siguen siendo
//     los del juego, de suma cero;
//   - quien no corrió esta carrera (quedó fuera desde el principio, §75) no entra;
//   - quien se cortó a mitad de carrera (§80, o cerró/recargó la página) PIERDE contra todos (como desconectarse en
//     línea), pero los demás NO ganan nada por él (como en Retro Rewind, mkwiiki: «si un rival se desconecta y ganas
//     por eso, no ganas VR»; así nadie junta VR con un amigo que se desconecta a propósito). Entre dos cortados, nada;
//   - un VR desconocido vale 5000 (como un invitado).
// Cada consola aplica SOLO el suyo (vr.mjs lo guarda aquí y en Firebase). Al EMPEZAR la carrera deja guardado el peor
// caso (perder contra todos: peorCaso) y al terminarla lo cambia por el de verdad; si la página se cierra o se recarga
// a mitad de carrera, queda el peor caso, que es lo mismo que ve la sala (se cortó: pierde contra todos).
// Las cuentas se hacen en precisión simple (32 bits, Math.fround), como la Wii, para truncar igual en los bordes.
//
// Uso:  puntosPar(vrGanador, vrPerdedor) → entero ≥ 0
//       cambiosVr([{ uid, vr, puesto, cortado }, { cpu: true, puesto }…], { nivelCpu, regla }) → { uid: cambio }
//         (puesto: 1 = primero; cortado: true/false; las CPU sin uid; nivelCpu = el de la página: 0 fácil, 1 normal,
//         2 difícil, 3 máximo (§96), 4 intenso, 5 imposible (§99); null = las CPU no cuentan;
//         regla = la de la foto de la carrera, o REGLA_CPU)
//       peorCaso(uid, corredores, { nivelCpu, regla }) → el cambio de uid si pierde contra todos, CPU incluidas (≤ 0)
//       aplicarCambio(vr, cambio) → el VR nuevo (entre 1 y VR_MAXIMO)
//       §99: anclaCpu/premioCpu(nivel, regla), copiaRegla() (para la foto), y para recalibrar anclaDeRitmo(d) y
//       anclaNeutral(pares)
export const VR_INICIAL = 5000, VR_MAXIMO = 1000000;   // (el tope de vr.mjs y de las reglas de Firebase)
export const CURVA = [0, 1, 8, 50, 125];                // los valores de la curva (la tabla del juego, 0x8088FF60)
export const DIF_MAX = 9998, PASO = 4999;     // (t = (diferencia + 9998) · 1/4999: de 0 a 4 justo)

const f = Math.fround;
// la «campana» de la B-spline cúbica uniforme: pesa cada valor de la curva según su distancia (en pasos) a t.
// Paso a paso y redondeando a 32 bits en el mismo orden que el juego (0x8052CEF8): 3x·x·x − 6x·x, +4, ÷6;
// (x−2)·(x−2)·(x−2) cambiado de signo, ÷6
function campana(x) {
  x = f(Math.abs(x));
  if (x < 1) return f(f(4 + f(f(f(f(3 * x) * x) * x) - f(f(6 * x) * x))) / 6);
  if (x <= 2) { const d = f(x - 2); return f(f(f(-d * d) * d) / 6); }
  return 0;
}
// la curva en t (0 a 4): suma de los valores 0, 1, 8, 50, 125 pesados por su campana (los de los bordes se repiten)
export function curva(t) {
  let s = f(0);
  for (let k = -2; k <= 6; k++) s = f(s + f(campana(f(t - k)) * CURVA[Math.min(4, Math.max(0, k))]));
  return s;
}
// los puntos que gana el ganador del par (y pierde el perdedor)
export function puntosPar(vrGanador, vrPerdedor) {
  const dif = Math.max(-DIF_MAX, Math.min(DIF_MAX, (vrPerdedor | 0) - (vrGanador | 0)));
  const t = f((dif + DIF_MAX) * f(1 / PASO));
  return Math.trunc(curva(t));
}

// §95: las CPU (diseño revisado por un crítico externo: bitácora §95); §99, la regla v2 (otro crítico, con los 6
// niveles: bitácora §99). La regla va en un objeto que la anfitriona congela en la foto de cada carrera
// (estado.vrCarrera.cpu, como los VR): así todas las consolas cuentan igual aunque alguna tuviera otra versión.
//   niveles: 0 fácil, 1 normal, 2 difícil, 3 máximo, 4 intenso, 5 imposible (los de dificultad-cpu.mjs; lo elige el
//     anfitrión, aparte de la cilindrada).
//   anclas: el VR fijo de cada nivel «con escala» (la CPU es un rival de ese VR); null = sin bolsa absoluta. 5000 = le
//     gana la mitad de las veces a la «normal» de la página. Las otras salen de lo medido con 12 CPU, el mismo kart en
//     las mismas pistas (herramientas/medir-cpu-niveles.mjs, §96): fácil recorre un 6 % menos que normal, difícil un
//     8,4 % más y máximo un 14 % más; pasado a VR con la curva del juego y una persona que varía un 8 % de carrera a
//     carrera. §99: difícil y máximo bajan a 7300 y 9000 (con 7400/9400, elegir «máximo» regalaba +300 a +700 por la
//     suerte de los objetos: el «ancla neutral» simulada da 7358 y 8961).
//   premio: §99, lo que vale (a igual VR) la «segunda llegada» de los niveles «fuera de escala» (intenso e imposible,
//     40 % o más rápidos que cualquier kart humano: una persona de 5000 les gana menos del 1,3 % de las veces, menos
//     de lo que la curva distingue). Contra ellos no se puede tener un VR fijo: cualquier ancla funcionaría como un
//     «imán» que lleva a todos al mismo VR, sepan lo que sepan. Entonces esas CPU no ponen ni sacan VR de la sala: son
//     una vara común para comparar a los humanos. Entre cada par de humanos gana la segunda llegada quien le ganó a
//     MÁS CPU (empate = nada), con la curva del par, escalada a premio/13 y repartida entre los H−1 rivales: suma cero.
//     Como una medición diferencial (un puente): lo que les pasa a todos (perder contra la CPU) se cancela —rechazo
//     del modo común— y solo cuenta la diferencia entre los humanos.
//   cuarto: cada par contra una CPU vale 1/cuarto de un par contra un humano (4: un humano = 4 CPU).
//   tope: todas las CPU juntas valen a lo más «tope» humanos (2): con más de 8 CPU, cada una vale tope/cuántas.
//   maxCarrera: §99, el fusible: la parte de las CPU de una carrera, a lo más ±112 (el par humano más grande).
//   minHumanos: §99, con menos de 2 humanos que corrieron (los cortados cuentan, los «fuera» no) nadie mueve VR: solo
//     contra las CPU, el VR dejaba de medir contra personas (y el otro «fuera» en el cuadro 0 le regalaba todo).
// La parte de las CPU de cada uno: tope·S/max(tope·cuarto, n) + premio·E/(13·(H−1)), con S = la suma entera de sus
// pares contra las CPU (bolsa absoluta) y E la de sus segundas llegadas (bolsa relativa), todo sobre un denominador
// común (enteros exactos) y redondeado UNA vez al entero más cercano (§99: antes se truncaba hacia el cero, y las
// pérdidas chicas quedaban más chicas de lo debido).
export const NIVELES_VR = 6;
export const REGLA_CPU = Object.freeze({
  version: 2,
  anclas: Object.freeze([3000, 5000, 7300, 9000, null, null]),
  premio: Object.freeze([0, 0, 0, 0, 16, 24]),
  cuarto: 4, tope: 2,
  maxCarrera: 112,
  minHumanos: 2,
});
const entero = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
const anclaValida = a => a === null || entero(a, 1, VR_MAXIMO);
// (la regla que llega en la foto viene de otra página: si no tiene la forma v2 —una rota, o la v1 de §96 con 4
// anclas—, la de aquí)
export function reglaValida(r) {
  return r && r.version === 2 && Array.isArray(r.anclas) && r.anclas.length === NIVELES_VR && r.anclas.every(anclaValida) &&
    Array.isArray(r.premio) && r.premio.length === NIVELES_VR && r.premio.every(x => entero(x, 0, 1000)) &&
    entero(r.cuarto, 1, 100) && entero(r.tope, 1, 12) && entero(r.maxCarrera, 1, 10000) &&
    entero(r.minHumanos, 1, 12) ? r : REGLA_CPU;
}
// el nivel tiene que ser un entero de la regla; cualquier otra cosa = las CPU no cuentan (§99: antes se recortaba a
// 0..3 y un nivel 4 o 5 contaba como «máximo»)
const nivelValido = (nivel, r) => entero(nivel, 0, r.anclas.length - 1);
export const anclaCpu = (nivel, regla = REGLA_CPU) => { const r = reglaValida(regla); return nivelValido(nivel, r) ? r.anclas[nivel] : null; };
export const premioCpu = (nivel, regla = REGLA_CPU) => { const r = reglaValida(regla); return nivelValido(nivel, r) ? r.premio[nivel] : 0; };
export const pesoCpu = (n, regla = REGLA_CPU) => { const r = reglaValida(regla); return n > 0 ? r.tope / Math.max(r.tope * r.cuarto, n) : 0; };
export const copiaRegla = (r = REGLA_CPU) => JSON.parse(JSON.stringify(r));
// lo que da un par contra una CPU de ancla A (bolsa absoluta), en puntos enteros: gana → +g; pierde → −l. §99, «sin
// lotería»: si perder no cuesta nada (la CPU está 6599 o más por encima: l = 0), ganarle tampoco paga (antes era un
// billete gratis: perder 0, ganar hasta 112 × peso). Es la banda muerta de un comparador: dentro, el lazo no actúa
export function parAbsoluto(v, A, gano) {
  const g = puntosPar(v, A), l = puntosPar(A, v);
  return gano ? (l > 0 ? g : 0) : -l;
}
// a/b al entero más cercano; un empate exacto (…,5) va hacia abajo. Enteros exactos (|a| < 2⁵³, b < 10⁸)
export const redondear = (a, b) => Math.ceil((2 * a - b) / (2 * b));

const vrDe = c => (Number.isInteger(c.vr) && c.vr >= 1 ? c.vr : VR_INICIAL);
const sinPuesto = c => !(Number.isInteger(c.puesto) && c.puesto >= 1 && c.puesto <= 12);
// el cambio de VR de cada humano de la carrera (los que la corrieron: los que quedaron fuera no se pasan). §95: con las
// CPU de la carrera (los corredores con cpu: true), según su nivel (§99: null o uno que no existe = no cuentan).
// Un humano sin puesto (el juego no lo dio) cuenta como cortado: pierde contra todos y nadie gana por él.
export function cambiosVr(corredores, { nivelCpu = null, regla = REGLA_CPU } = {}) {
  const r = reglaValida(regla);
  const lista = corredores.filter(c => c && c.uid && !c.cpu);
  const cpus = corredores.filter(c => c && c.cpu);
  const cambio = Object.fromEntries(lista.map(c => [c.uid, 0]));
  const perdido = c => !!c.cortado || sinPuesto(c);
  if (lista.length < r.minHumanos) return cambio;              // §99: solo (o el otro «fuera»): nada
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i], b = lista[j];
    if (perdido(a) && perdido(b)) continue;                    // dos cortados: nada
    if (perdido(a) || perdido(b)) {                            // el cortado pierde; el otro no gana nada por él
      const [g, p] = perdido(a) ? [b, a] : [a, b];
      cambio[p.uid] -= puntosPar(vrDe(g), vrDe(p));
      continue;
    }
    if (a.puesto === b.puesto) continue;                       // empate: nada
    const [g, p] = a.puesto < b.puesto ? [a, b] : [b, a];
    const pts = puntosPar(vrDe(g), vrDe(p));
    cambio[g.uid] += pts; cambio[p.uid] -= pts;
  }
  // §95: contra cada CPU. El cortado pierde contra todas. Para los demás hace falta que los puestos se puedan creer
  // (cada CPU con su puesto, del 1 al 12, y ninguno repetido): si no (una lectura fallida dejaría una CPU «detrás de
  // todos» y le regalaría hasta 26 a cada uno), sin parte de CPU. §99: las dos bolsas, una sola cuenta en enteros y un
  // solo redondeo, con el fusible
  const A = anclaCpu(nivelCpu, r), P = premioCpu(nivelCpu, r);
  if (!cpus.length || (A === null && P === 0)) return cambio;
  const puestos = [...cpus, ...lista.filter(h => !perdido(h))].map(c => c.puesto);
  const creibles = cpus.every(k => !sinPuesto(k)) && new Set(puestos).size === puestos.length;
  const gana = (h, k) => !perdido(h) && creibles && h.puesto < k.puesto;   // (el cortado no le gana a ninguna)
  const H = lista.length, base = Math.max(r.tope * r.cuarto, cpus.length);
  const vencidas = new Map(lista.map(h => [h, cpus.filter(k => gana(h, k)).length]));   // (bolsa relativa)
  for (const h of lista) {
    if (!perdido(h) && !creibles) continue;
    const v = vrDe(h);
    let S = 0;                                                 // bolsa absoluta: contra el VR fijo de cada CPU
    if (A !== null) for (const k of cpus) S += parAbsoluto(v, A, gana(h, k));
    let E = 0;                                                 // bolsa relativa: la «segunda llegada» con cada humano
    if (P > 0 && creibles) for (const o of lista) {
      if (o === h) continue;
      const yo = vencidas.get(h), el = vencidas.get(o);
      if (yo > el && !perdido(o)) E += puntosPar(v, vrDe(o));    // le gané a más CPU que o (y o no se cortó)
      if (el > yo) E -= puntosPar(vrDe(o), v);                   // o le ganó a más CPU que yo
    }
    // tope·S/base + P·E/(13·(H−1)), sobre el denominador común 13·(H−1)·base
    const den = 13 * Math.max(1, H - 1) * base;
    const num = r.tope * S * 13 * Math.max(1, H - 1) + P * E * base;
    cambio[h.uid] += Math.max(-r.maxCarrera, Math.min(r.maxCarrera, redondear(num, den)));
  }
  return cambio;
}
// el peor caso de uid: perder contra todos los que corren (lo que queda guardado mientras corre la carrera), §95: las
// CPU incluidas; §99: cortado, con TODOS los demás humanos delante de TODAS las CPU (así pierde también todas las
// segundas llegadas). Solo hace falta saber cuántas CPU corren, no sus puestos
export function peorCaso(uid, corredores, opciones = {}) {
  const otros = corredores.filter(c => c && c.uid && !c.cpu && c.uid !== uid);
  const yo = corredores.find(c => c && c.uid === uid && !c.cpu);
  if (!yo) return 0;
  const n = corredores.filter(c => c && c.cpu).length;
  const peor = [...otros.map((c, i) => ({ ...c, cortado: false, puesto: i + 1 })), { ...yo, cortado: true, puesto: 12 },
                ...Array.from({ length: n }, (_, i) => ({ cpu: true, puesto: otros.length + 1 + i }))];
  return cambiosVr(peor, opciones)[uid] ?? 0;
}
export const aplicarCambio = (vr, cambio) => Math.max(1, Math.min(VR_MAXIMO, (Number.isInteger(vr) && vr >= 1 ? vr : VR_INICIAL) + (cambio | 0)));

// Los humanos de la carrera, leídos del juego al terminar (L = el lector de menus.mjs; humanos = los de la sala, en el
// orden de sus puestos de la ficha): el puesto final de cada uno (RaceinfoPlayer +0x20, como UpdatePoints) y si es un
// jugador de verdad en esta carrera (tipo 0 en el escenario de la carrera). vrs = la foto de los VR al empezarla.
// §95: y después las CPU de la carrera (tipo 1), con su puesto: { cpu: true, puesto }.
export function corredoresDelJuego(L, humanos, { vrs = {}, fuera = [], cortados = [] } = {}) {
  const rd = L.u32(0x809BD728), ri = L.u32(0x809BD730);
  if (!rd || !ri) return [];
  const jugadores = L.u32(ri + 0xC), n = L.u8(rd + 0x20 + 4), lista = [];
  humanos.forEach((h, i) => {
    if (i >= n || fuera.includes(h.uid) || L.u32(rd + 0x20 + 8 + i * 0xF0 + 0x10) !== 0) return;
    const rp = jugadores ? L.u32(jugadores + i * 4) : 0;
    lista.push({ uid: h.uid, vr: vrs[h.uid], puesto: rp ? L.u8(rp + 0x20) : 0, cortado: cortados.includes(h.uid) });
  });
  for (let i = 0; i < n && i < 12; i++) {
    if (L.u32(rd + 0x20 + 8 + i * 0xF0 + 0x10) !== 1) continue;
    const rp = jugadores ? L.u32(jugadores + i * 4) : 0;
    lista.push({ cpu: true, puesto: rp ? L.u8(rp + 0x20) : 0 });
  }
  return lista;
}

// ---- §99: para recalibrar las anclas (herramientas, o al medir) ----
// x(p): cuánto por ENCIMA del ancla queda, en equilibrio, quien le gana con probabilidad p a esa CPU (bolsa absoluta,
// con la zona muerta). null = no hay equilibrio dentro de la escala (p menor que el de la orilla de la zona muerta,
// 1/(C(6598)+1) ≈ 1,3 %): el nivel es «fuera de escala».
export function equilibrioSobreAncla(p, A = 5000) {
  for (let x = -6598; x <= 9998; x++) {
    const v = A + x, g = puntosPar(v, A), l = puntosPar(A, v);
    if (p * g - (1 - p) * l <= 0) return x === -6598 && p * g - (1 - p) * l < 0 ? null : x;
  }
  return 9998;
}
// Φ (la normal acumulada) para pasar del ritmo a la probabilidad de ganar
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
export const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
// d = cuánto MÁS recorre esa CPU que la «normal» (en %, lo que da medir-cpu-niveles.mjs); σ = cuánto varía una persona
// de carrera a carrera (8 %, el supuesto de §96) → el ancla (redondeada a 100), o null si es «fuera de escala»
export function anclaDeRitmo(d, { sigma = 8, ref = 5000 } = {}) {
  const x = equilibrioSobreAncla(Phi(-d / sigma));
  return x === null ? null : Math.round((ref - x) / 100) * 100;
}
// pares = [{ vr, gano }] de un nivel: cada par humano–CPU que se corrió (el VR congelado del humano y si le ganó). El
// ancla «neutral» es la que hace que, con esas carreras, las CPU de ese nivel no hubieran creado ni quitado VR en total
// (como calibrar el cero de un instrumento: mover la referencia hasta que la corriente neta sea cero). Lo que da un par
// crece con el ancla: se busca por bisección y se toma el medio de la meseta en 0. null = ninguna ancla finita
// (casi nadie les ganó): «fuera de escala»
export function anclaNeutral(pares, { desde = 1, hasta = 40000 } = {}) {
  if (!pares.length) return null;
  const total = A => pares.reduce((t, x) => t + parAbsoluto(x.vr, A, x.gano), 0);
  // (más arriba de max(VR) + 6598 todos los pares caen en la zona muerta y el total vuelve a 0: no se busca ahí)
  const tope = Math.min(hasta, pares.reduce((m, x) => Math.max(m, x.vr), 0) + 6598);
  const primera = cumple => { let lo = desde - 1, hi = tope; if (!cumple(tope)) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cumple(m)) hi = m; else lo = m; } return hi; };
  const a1 = primera(A => total(A) >= 0);
  if (a1 === null) return null;
  const a2 = primera(A => total(A) > 0) ?? a1;
  return Math.round((a1 + a2 - 1) / 2);
}
