// El ahorro de energía de Chrome y el calor del teléfono (E1 y E2 del plan de rendimiento, bitácora §190).
//
// Resumen: dos vigías que la página alimenta una vez por segundo con lo que ya mide (el período de la pantalla del
// reloj del monitor, los ms de trabajo del juego por cuadro y dónde está el juego). No cambian nada del juego: solo
// avisan, en la esquina, para que la persona sepa por qué no va a 60.
//   - crearVigiaAhorro (E1): con el «Ahorro de energía» de Chrome (portátil con batería, o batería baja) TODO se
//     dibuja a 30 Hz y no hay forma de preguntárselo al navegador. Se reconoce porque los refrescos llegan cada
//     ~33 ms mientras el juego trabaja poco por cuadro (si el juego trabaja mucho, los 33 ms pueden ser del juego que
//     no alcanza: ahí no se avisa, para no culpar a la batería de lo que es lentitud).
//   - crearVigiaCalor (E2): un teléfono caliente baja el reloj del procesador y el mismo trabajo tarda más. Android no
//     tiene la «Compute Pressure» de Chrome, así que se mira lo que tarda el juego por cuadro minuto a minuto en la
//     carrera: si sube un 25 % sobre los primeros minutos (y más de 1,5 ms), se avisa una vez.
// Puras (sin DOM): las prueba el banco `energia`.

// ---- E1: el ahorro de energía ----
export const AHORRO = {
  periodoMin: 29, periodoMax: 37.5,   // ms entre refrescos: 30 Hz (33,3 ms) con margen
  trabajoMax: 14,                     // ms por cuadro: por encima, los 33 ms pueden ser del juego, no de la batería
  entrar: 3, salir: 5,                // segundos seguidos para decidir que entró o que salió
  normalMax: 25,                      // ms: por debajo, la pantalla volvió a refrescar rápido
};
export const TEXTO_AHORRO = '🔋 Chrome está ahorrando batería y dibuja a 30 por segundo: enchufa el equipo o apaga el «Ahorro de energía» (Configuración → Rendimiento)';

// alAviso(texto | '') se llama al entrar (una sola vez por visita) y al salir (texto vacío)
export function crearVigiaAhorro({ alAviso = () => {}, umbral = AHORRO } = {}) {
  const estado = { ahorro: false, seguidos: 0, normales: 0, avisos: 0, ultimoPeriodo: null };
  return {
    estado,
    // un segundo: periodo = ms entre refrescos (null = no se sabe), trabajo = ms del juego por cuadro, visible = pestaña a la vista
    segundo({ periodo = null, trabajo = null, visible = true } = {}) {
      estado.ultimoPeriodo = periodo;
      if (!visible || !Number.isFinite(periodo) || periodo <= 0) { estado.seguidos = 0; return estado.ahorro; }   // oculta: no se sabe
      const lento = periodo >= umbral.periodoMin && periodo <= umbral.periodoMax;
      const liviano = Number.isFinite(trabajo) && trabajo > 0 && trabajo <= umbral.trabajoMax;
      if (!estado.ahorro) {
        estado.seguidos = lento && liviano ? estado.seguidos + 1 : 0;
        if (estado.seguidos >= umbral.entrar) {
          estado.ahorro = true; estado.normales = 0;
          if (estado.avisos++ === 0) alAviso(TEXTO_AHORRO);
        }
      } else {
        estado.normales = periodo < umbral.normalMax ? estado.normales + 1 : 0;
        if (estado.normales >= umbral.salir) { estado.ahorro = false; estado.seguidos = 0; alAviso(''); }
      }
      return estado.ahorro;
    },
  };
}

// ---- E2: el calor ----
export const CALOR = {
  segundosMinuto: 60,                 // segundos de carrera que forman un «minuto»
  minutosBase: 2,                     // la referencia: el mejor (el más bajo) de los primeros minutos
  sube: 1.25, subeMs: 1.5,            // caliente = un 25 % más Y 1,5 ms más que la referencia…
  seguidos: 2,                        // …dos minutos seguidos
};
export const TEXTO_CALOR = '🌡️ El teléfono se está calentando y frena el procesador: el juego tarda más por cuadro que al empezar. Sacarle la funda o dejarlo enfriar ayuda';

export function crearVigiaCalor({ alAviso = () => {}, umbral = CALOR } = {}) {
  const estado = { minutos: [], base: null, caliente: false, seguidos: 0, avisos: 0, enCurso: [] };
  const cerrarMinuto = () => {
    const v = estado.enCurso; estado.enCurso = [];
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    estado.minutos.push(Math.round(m * 100) / 100);
    if (estado.minutos.length > 120) estado.minutos.shift();
    if (estado.minutos.length <= umbral.minutosBase) { estado.base = Math.min(...estado.minutos); return; }
    const sobre = m > estado.base * umbral.sube && m - estado.base > umbral.subeMs;
    estado.seguidos = sobre ? estado.seguidos + 1 : 0;
    if (!estado.caliente && estado.seguidos >= umbral.seguidos) {
      estado.caliente = true;
      if (estado.avisos++ === 0) alAviso(TEXTO_CALOR);
    } else if (estado.caliente && !sobre) estado.caliente = false;   // se enfrió (el aviso no se repite)
  };
  return {
    estado,
    // un segundo: trabajo = ms del juego por cuadro; enCarrera = la carrera andando (los menús no cuentan: otro trabajo)
    segundo({ trabajo = null, enCarrera = false, visible = true } = {}) {
      if (!enCarrera || !visible || !Number.isFinite(trabajo) || trabajo <= 0) return estado.caliente;
      estado.enCurso.push(trabajo);
      if (estado.enCurso.length >= umbral.segundosMinuto) cerrarMinuto();
      return estado.caliente;
    },
  };
}

// ?ahorro / ?calor de la página: '1' = prendido, '0' = apagado; sin nada = porOmision (§241: el ahorro, prendido salvo con
// Playwright; el calor, apagado hasta verlo en un teléfono)
export function prendido(valor, porOmision = false) {
  if (valor == null) return porOmision;
  return valor !== '0';
}
