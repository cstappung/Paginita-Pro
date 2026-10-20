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
//   - solo cuentan los humanos (las CPU no tienen VR, como en línea, donde no hay CPU);
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
//       cambiosVr([{ uid, vr, puesto, cortado }]) → { uid: cambio }      (puesto: 1 = primero; cortado: true/false)
//       peorCaso(uid, corredores) → el cambio de uid si pierde contra todos (≤ 0)
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

const vrDe = c => (Number.isInteger(c.vr) && c.vr >= 1 ? c.vr : VR_INICIAL);
// el cambio de VR de cada humano de la carrera (los que la corrieron: los que quedaron fuera no se pasan)
export function cambiosVr(corredores) {
  const lista = corredores.filter(c => c && c.uid);
  const cambio = Object.fromEntries(lista.map(c => [c.uid, 0]));
  const lugar = c => (c.puesto | 0) || 999;                     // (sin puesto: detrás de todos)
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    const a = lista[i], b = lista[j];
    if (a.cortado && b.cortado) continue;                      // dos cortados: nada
    if (a.cortado || b.cortado) {                              // el cortado pierde; el otro no gana nada por él
      const [g, p] = a.cortado ? [b, a] : [a, b];
      cambio[p.uid] -= puntosPar(vrDe(g), vrDe(p));
      continue;
    }
    const la = lugar(a), lb = lugar(b);
    if (la === lb) continue;                                   // empate: nada
    const [g, p] = la < lb ? [a, b] : [b, a];
    const pts = puntosPar(vrDe(g), vrDe(p));
    cambio[g.uid] += pts; cambio[p.uid] -= pts;
  }
  return cambio;
}
// el peor caso de uid: perder contra todos los que corren (lo que queda guardado mientras corre la carrera)
export function peorCaso(uid, corredores) {
  return cambiosVr(corredores.map(c => ({ ...c, cortado: c.uid === uid })))[uid] ?? 0;
}
export const aplicarCambio = (vr, cambio) => Math.max(1, Math.min(VR_MAXIMO, (Number.isInteger(vr) && vr >= 1 ? vr : VR_INICIAL) + (cambio | 0)));

// Los humanos de la carrera, leídos del juego al terminar (L = el lector de menus.mjs; humanos = los de la sala, en el
// orden de sus puestos de la ficha): el puesto final de cada uno (RaceinfoPlayer +0x20, como UpdatePoints) y si es un
// jugador de verdad en esta carrera (tipo 0 en el escenario de la carrera). vrs = la foto de los VR al empezarla.
export function corredoresDelJuego(L, humanos, { vrs = {}, fuera = [], cortados = [] } = {}) {
  const rd = L.u32(0x809BD728), ri = L.u32(0x809BD730);
  if (!rd || !ri) return [];
  const jugadores = L.u32(ri + 0xC), n = L.u8(rd + 0x20 + 4), lista = [];
  humanos.forEach((h, i) => {
    if (i >= n || fuera.includes(h.uid) || L.u32(rd + 0x20 + 8 + i * 0xF0 + 0x10) !== 0) return;
    const rp = jugadores ? L.u32(jugadores + i * 4) : 0;
    lista.push({ uid: h.uid, vr: vrs[h.uid], puesto: rp ? L.u8(rp + 0x20) : 0, cortado: cortados.includes(h.uid) });
  });
  return lista;
}
