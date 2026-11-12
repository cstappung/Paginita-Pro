// El ritmo parejo en los MENÚS (bitácora §270, el dueño: «agrega el framepacing a los menús del juego, de selección de
// salas etc también cuidando los 1% lows»).
//
// Qué pasa sin esto. En los menús cada cuadro del juego se dibuja (ahí el dibujo no se puede saltar: §196, por eso N8
// es solo de la carrera). En un aparato que no llega a 60, cada cuadro tarda lo que tarda (25, 31, 40 ms…) y el juego
// suelta el siguiente apenas puede: las imágenes salen disparejas (medido en la gama baja: 6 a 10 refrescos de 240 Hz
// por imagen en la pantalla de personaje, 1 % bajo = 74 % de los fps).
//
// Qué hace. Si el juego no llega a 60 en los menús, la página le da un compás fijo: cada cuadro empieza N tiempos de
// 16,7 ms después del anterior (N = 2 → 30 parejos, N = 3 → 20 parejos), aunque esté listo antes. Si un cuadro llega
// tarde a su tiempo, espera al tiempo siguiente de la misma grilla (la grilla no se corre). N se elige con histéresis:
//   - se prende (N = 2) si en 2 segundos seguidos el juego dio menos de 55 cuadros y cada cuadro trabajó más de 17,5 ms;
//   - pasa a N = 3 si en 2 segundos seguidos cada cuadro trabajó más de 31 ms (no cabe en 33,3); vuelve a 2 si en
//     3 segundos seguidos trabajó menos de 27;
//   - se apaga si en 3 segundos seguidos cada cuadro trabajó menos de 13 ms (cabe en 60 con holgura).
// Nunca con la carrera andando (Raceinfo con etapa 0–2: ahí manda la sala y N8) ni con la pestaña oculta. Fuera de eso
// la lógica de los menús ya iba a lo que daba el aparato: el compás solo la ordena. Como el reloj de un sistema
// muestreado: en vez de disparar cada muestra «cuando se pueda», se dispara en los flancos de un reloj fijo.
//
// API (pura: la prueba el banco `ritmo-menus`):
//   const r = crearRitmoMenus({ periodo = 1000/60 })
//   r.segundo({ cuadros, trabajo, enMenus, visible }) → N (0 = apagado), una vez por segundo
//   r.objetivo(vencimiento, ahora, enMenus) → la hora hasta la que el juego debe esperar este cuadro (≥ vencimiento)
//   r.estado → { n, cambios, cuadros, corridos }
export function crearRitmoMenus({ periodo = 1000 / 60 } = {}) {
  let n = 0, lentos = 0, rapidos = 0, pesados = 0, livianos = 0;
  let ancla = null, ultVenc = null, objetivoActual = null;
  const estado = { n: 0, cambios: 0, cuadros: 0, corridos: 0 };
  const poner = k => { if (k !== n) { n = k; estado.n = k; estado.cambios++; ancla = null; ultVenc = null; } };
  return {
    estado,
    get n() { return n; },
    segundo({ cuadros = null, trabajo = null, enMenus = false, visible = true } = {}) {
      if (!enMenus || !visible || !Number.isFinite(trabajo) || !Number.isFinite(cuadros)) {
        lentos = rapidos = pesados = livianos = 0;
        if (!enMenus || !visible) poner(0);
        return n;
      }
      if (n === 0) {
        lentos = cuadros < 55 && trabajo > 17.5 ? lentos + 1 : 0;
        if (lentos >= 2) { lentos = 0; poner(trabajo > 31 ? 3 : 2); }
        return n;
      }
      rapidos = trabajo < 13 ? rapidos + 1 : 0;
      if (rapidos >= 3) { rapidos = 0; poner(0); return n; }
      if (n === 2) { pesados = trabajo > 31 ? pesados + 1 : 0; if (pesados >= 2) { pesados = 0; poner(3); } }
      else if (n === 3) { livianos = trabajo < 27 ? livianos + 1 : 0; if (livianos >= 3) { livianos = 0; poner(2); } }
      return n;
    },
    // El juego llama a su espera varias veces por cuadro (cada 1 ms, para atender el sonido): el mismo vencimiento =
    // el mismo cuadro, se contesta el mismo objetivo. Un vencimiento nuevo = un cuadro nuevo: su tiempo en la grilla.
    objetivo(vencimiento, ahora, enMenus = true) {
      if (!n || !enMenus) { ancla = null; ultVenc = null; return vencimiento; }
      if (vencimiento === ultVenc && objetivoActual !== null) return Math.max(vencimiento, objetivoActual);
      ultVenc = vencimiento;
      let base = ancla === null ? Math.max(vencimiento, ahora) : ancla + n * periodo;
      if (ahora > base) { const k = Math.ceil((ahora - base) / periodo); base += k * periodo; estado.corridos++; }
      ancla = base; objetivoActual = base; estado.cuadros++;
      return Math.max(vencimiento, base);
    },
  };
}
