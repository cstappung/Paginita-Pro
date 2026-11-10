// La vibración del juego, hecha pulsos parejos (§167, el dueño 2026-10-30: «vibra de manera descontrolada en la mayoría
// de ocasiones» en el teléfono).
//
// Resumen: el juego (PADControlMotor) no pide «vibra con tal fuerza»: prende y apaga el motor del mando, y para una
// vibración suave lo prende y apaga muy seguido (como un regulador por ancho de pulso, PWM). Antes la página pasaba
// cada prendido a `navigator.vibrate(5000)` y cada apagado a `navigator.vibrate(0)`: decenas de órdenes por segundo
// a un motor de teléfono que tarda en arrancar y frenar, y si un apagado se perdía (o el juego se quedaba trabado
// cargando) seguía 5 s a fondo. Ahora se mide qué fracción de cada periodo (100 ms) el juego tuvo el motor prendido
// —el «ciclo de trabajo», como el de un PWM— y se manda UNA orden por periodo: en el teléfono un pulso de esa
// fracción del periodo (el teléfono no tiene fuerza regulable, solo duración), en el mando la fuerza proporcional.
// Seguros: nunca más de 2 s seguidos prendido (se corta hasta que el juego apague y vuelva a prender), y si el juego
// deja de dar señales el pulso se acaba solo (cada orden dura un periodo y poco más).
//
// No sabe nada del juego ni del navegador: recibe las salidas y el reloj, así se prueba en el banco (banco/pruebas/vibracion).

export const PERIODO_MS = 100;          // cada cuánto se manda una orden
export const MAX_SEGUIDO_MS = 2000;     // tope de vibración continua (seguro contra un «apagar» que no llega)
export const PULSO_MIN_MS = 12;         // un pulso más corto que esto el motor ni lo nota: no se manda
export const FUERZA_MAX = 0.8;          // la fuerza del mando con el motor prendido todo el periodo (la de antes)

// telefono(ms): ms > 0 = vibrar ese tiempo (reemplaza lo anterior), 0 = parar.
// mando(puerto, fuerza 0..1, ms): fuerza 0 = parar.
// programar(fn, ms) / cancelar(id): el temporizador (setInterval/clearInterval en la página).
export function crearVibracion({ telefono = () => {}, mando = () => {}, ahora = () => performance.now(),
                                 programar = (fn, ms) => setInterval(fn, ms), cancelar = id => clearInterval(id),
                                 periodoMs = PERIODO_MS, maxSeguidoMs = MAX_SEGUIDO_MS, pulsoMinMs = PULSO_MIN_MS } = {}) {
  const puertos = new Map();   // puerto → { on, desde, acum, encendidoDesde, cortado, sonando }
  const estado = { ordenes: 0, cambios: 0, cortes: 0, ultimoPulso: 0 };
  let reloj = null;

  const de = p => {
    if (!puertos.has(p)) puertos.set(p, { on: false, desde: 0, acum: 0, encendidoDesde: 0, cortado: false, sonando: false });
    return puertos.get(p);
  };

  // un periodo: por puerto, la fracción prendida → una orden
  function tic() {
    const t = ahora();
    let alguno = false;
    for (const [p, s] of puertos) {
      if (s.on) { s.acum += t - s.desde; s.desde = t; }
      if (s.on && !s.cortado && t - s.encendidoDesde > maxSeguidoMs) { s.cortado = true; estado.cortes++; }
      const frac = s.cortado ? 0 : Math.min(1, s.acum / periodoMs);
      s.acum = 0;
      const ms = Math.round(frac * periodoMs);
      if (ms >= pulsoMinMs) {
        // prendido todo el periodo: el pulso cubre un poco más, para que el siguiente lo empalme sin hueco
        const largo = frac >= 0.95 ? periodoMs + 30 : ms;
        telefono(p, largo); mando(p, FUERZA_MAX * frac, periodoMs + 30);
        s.sonando = true; estado.ordenes++; estado.ultimoPulso = largo;
      } else if (s.sonando) {
        telefono(p, 0); mando(p, 0, 0); s.sonando = false; estado.ordenes++;
      }
      if (s.on || s.sonando) alguno = true;
    }
    if (!alguno && reloj !== null) { cancelar(reloj); reloj = null; }
  }

  return {
    estado,
    // el juego prendió (true) o apagó (false) el motor de un puerto
    pedir(p, on) {
      const s = de(p), t = ahora();
      if (on === s.on) return;
      estado.cambios++;
      if (on) { s.on = true; s.desde = t; s.encendidoDesde = t; s.cortado = false; }
      else { s.acum += t - s.desde; s.on = false; }
      if (reloj === null) { reloj = programar(tic, periodoMs); }
    },
    // parar todo ya (pestaña oculta, vibración apagada en los ajustes)
    parar() {
      for (const [p, s] of puertos) {
        if (s.sonando) { telefono(p, 0); mando(p, 0, 0); estado.ordenes++; }
        s.on = false; s.acum = 0; s.sonando = false; s.cortado = false;
      }
      if (reloj !== null) { cancelar(reloj); reloj = null; }
    },
    tic,             // para el banco (en la página lo llama el temporizador)
    activo: () => reloj !== null,
  };
}
