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
//     de las CPU se suma entera y se trunca una vez (hacia cero). La CPU no gana ni pierde nada (no tiene VR guardado):
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
//         2 difícil, 3 máximo, §96;
//         regla = la de la foto de la carrera, o REGLA_CPU)
//       peorCaso(uid, corredores, { nivelCpu, regla }) → el cambio de uid si pierde contra todos, CPU incluidas (≤ 0)
//       aplicarCambio(vr, cambio) → el VR nuevo (entre 1 y VR_MAXIMO)
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

// §95: las CPU (diseño revisado por un crítico externo: bitácora §95). La regla va en un objeto que la anfitriona
// congela en la foto de cada carrera (estado.vrCarrera.cpu, como los VR): así todas las consolas cuentan igual aunque
// alguna tuviera otra versión de la página.
//   anclas: el VR fijo de cada nivel de CPU, el de la página (§96: 0 fácil, 1 normal, 2 difícil, 3 máximo; lo elige
//     el anfitrión, aparte de la cilindrada). null = esas CPU no cuentan. La escala no cambió con §96: 5000 = le gana
//     la mitad de las veces a la «normal» de la página (la «difícil» del juego, la de §95). Las otras salen de lo medido
//     con 12 CPU, el mismo kart en las mismas pistas (herramientas/medir-cpu-niveles.mjs, bitácora §96): fácil recorre
//     un 5 % menos que normal, difícil un 8,4 % más y máximo un 14 % más; pasado a VR con la curva del juego y una
//     persona que varía un 8 % de carrera a carrera (el supuesto que da las anclas más BAJAS de los tres que se
//     probaron: un ancla alta se aprovecha, una baja solo cuesta un poco de VR en ese nivel; el crítico de §95).
//   cuarto: cada par contra una CPU vale 1/cuarto de un par contra un humano (4: un humano = 4 CPU).
//   tope: todas las CPU juntas valen a lo más «tope» humanos (2): con más de 8 CPU, cada una vale tope/cuántas.
// El peso de una CPU es min(1/cuarto, tope/n) = tope / max(tope·cuarto, n), así que la parte de las CPU de cada uno es
// trunc(tope·S / max(tope·cuarto, n)) con S = la suma entera de sus pares contra las CPU: cuentas en enteros, exactas.
export const REGLA_CPU = Object.freeze({ anclas: Object.freeze([3000, 5000, 7400, 9400]), cuarto: 4, tope: 2 });
// (la regla que llega en la foto de la carrera viene de otra página: si no tiene la forma, la de aquí)
const anclaValida = a => a === null || (Number.isInteger(a) && a >= 1 && a <= VR_MAXIMO);
export function reglaValida(r) {
  return r && Array.isArray(r.anclas) && r.anclas.length === 4 && r.anclas.every(anclaValida) && Number.isInteger(r.cuarto) && r.cuarto >= 1 &&
    r.cuarto <= 100 && Number.isInteger(r.tope) && r.tope >= 1 && r.tope <= 12 ? r : REGLA_CPU;
}
export const anclaCpu = (nivel, regla = REGLA_CPU) => reglaValida(regla).anclas[Math.max(0, Math.min(3, nivel | 0))];
export const pesoCpu = (n, regla = REGLA_CPU) => { const r = reglaValida(regla); return n > 0 ? r.tope / Math.max(r.tope * r.cuarto, n) : 0; };

const vrDe = c => (Number.isInteger(c.vr) && c.vr >= 1 ? c.vr : VR_INICIAL);
const sinPuesto = c => !(Number.isInteger(c.puesto) && c.puesto >= 1 && c.puesto <= 12);
// el cambio de VR de cada humano de la carrera (los que la corrieron: los que quedaron fuera no se pasan). §95: con las
// CPU de la carrera (los corredores con cpu: true), al VR fijo de su nivel y con su peso.
// Un humano sin puesto (el juego no lo dio) cuenta como cortado: pierde contra todos y nadie gana por él.
export function cambiosVr(corredores, { nivelCpu = 3, regla = REGLA_CPU } = {}) {
  const lista = corredores.filter(c => c && c.uid && !c.cpu);
  const cpus = corredores.filter(c => c && c.cpu);
  const cambio = Object.fromEntries(lista.map(c => [c.uid, 0]));
  const perdido = c => !!c.cortado || sinPuesto(c);
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
  // todos» y le regalaría hasta 26 a cada uno), sin parte de CPU. La suma entera, por el peso, truncada UNA vez
  const r = reglaValida(regla), ancla = anclaCpu(nivelCpu, r);
  if (cpus.length && ancla !== null) {
    const puestos = [...cpus, ...lista.filter(h => !perdido(h))].map(c => c.puesto);
    const creibles = cpus.every(k => !sinPuesto(k)) && new Set(puestos).size === puestos.length;
    for (const h of lista) {
      if (!perdido(h) && !creibles) continue;
      let s = 0;
      for (const k of cpus) s += perdido(h) || k.puesto < h.puesto ? -puntosPar(ancla, vrDe(h)) : puntosPar(vrDe(h), ancla);
      cambio[h.uid] += Math.trunc(r.tope * s / Math.max(r.tope * r.cuarto, cpus.length));
    }
  }
  return cambio;
}
// el peor caso de uid: perder contra todos los que corren (lo que queda guardado mientras corre la carrera), §95: las
// CPU incluidas. (Los demás, sin cortar y con un puesto cualquiera: contra uid da lo mismo)
export function peorCaso(uid, corredores, opciones = {}) {
  return cambiosVr(corredores.map(c => (c.cpu ? c : c.uid === uid ? { ...c, cortado: true } : { ...c, cortado: false, puesto: sinPuesto(c) ? 1 : c.puesto })),
                   opciones)[uid] ?? 0;
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
