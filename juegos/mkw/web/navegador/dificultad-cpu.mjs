// Los niveles de la CPU de la página (M20, pedido del dueño: «el rework de la dificultad aumentándola, donde el más
// difícil sea todo al máximo», y el nivel como ajuste propio de la sala) — bitácora §96.
//
// Resumen: los niveles de CPU de Mario Kart Wii no son código, son números («perillas») que el juego lee al empezar
// cada carrera (AI::Params::Load). La lista completa salió del código traducido (bitácora §96.1). Aquí se dice, para
// cada nivel de la página, qué fila de la tabla del juego se usa y cuánto se sube cada perilla. El código nativo
// (web/juego/cpu_dificultad_nativo.cpp) lo escribe encima de lo que cargó el juego, en todas las consolas igual (es
// parte de la ficha de la carrera: la misma en todas).
//
// Los cuatro niveles (más altos que los del juego; en el juego son tres):
//   facil   = la fila «normal» del juego, tal cual (lo que antes era «normal»);
//   normal  = la fila «difícil» del juego, tal cual (lo que antes era «difícil»);
//   dificil = la fila «difícil» y, encima, cada perilla a mitad de camino hacia «máximo»;
//   maximo  = la fila «difícil» y todo al tope: lo que en el código depende del nivel ya queda al tope con la fila
//             difícil (atajos con champiñón, esquivar el POW, tirar caparazones, la línea por dentro de las curvas);
//             la velocidad base sube hasta la del kart más rápido que puede armar un humano (×1,14: a 150cc ~86 en vez
//             de ~75), nunca se frena a propósito por ir adelante (bias 0), el «arrebato» que persigue al líder humano
//             pasa siempre y dura toda la carrera, la tinta no la frena y saca los objetos de la misma tabla que un
//             humano (la de la CPU es más pobre).
// §99 (M23, pedido del dueño), dos más arriba, a propósito injustos:
//   intenso   = el «Hard AI» de Retro Rewind: su tabla de velocidad de la IA (base 170 a 150cc, siempre pegada al
//               tope del juego, 120: un 40 % más rápida que el kart humano más rápido), más los objetos del humano;
//   imposible = intenso y, solo en los karts de CPU, estadísticas que ningún humano alcanza: el tope de velocidad
//               ×1,15 (138 a 150cc), su velocidad base ×1,15, la aceleración y el miniturbo ×1,5 (no más de ×1,20 en
//               el tope: la bala va a 145 y la frenaría).
//
// Las perillas de cada nivel (las que no están = las del juego):
//   factorBase    la velocidad base de la CPU (70 + adv) se multiplica por esto
//   factorBias    el «atraso permitido» de cada casilla (bias) se multiplica por esto (0 = ninguna se queda atrás ni
//                 se frena por ir adelantada; todas las que van detrás de la mejor CPU recuperan)
//   mezclaMin     la velocidad mínima (a la que baja una CPU adelantada) va de la del juego (0) a la base nueva (1)
//   arrebato      { prob %, inicio s (el más temprano), hasta s (el más tarde), durMin s, durMax s }: la persecución
//                 del líder humano (una por carrera)
//   tinta         lo que queda de la velocidad con la tinta del Blooper (el juego: 0,8)
//   objetosHumano true = la CPU saca los objetos de la tabla del humano
//   archivoRR     (§99) true = la tabla de velocidad de la IA del Hard AI de RR (kartAISpdParamRR.bin)
//   tope, velKart, acel, giro, mt  (§99) solo los karts de CPU: su tope duro de velocidad, su velocidad base, sus
//                 aceleraciones, su manejo y derrape, y los cuadros de su miniturbo, multiplicados (1 = sin cambio)
//
// Uso:  perfilCpu(nivel) → el perfil (nivel 0..5 o 'facil'…'imposible')
//       aplicarPerfilCpu(M, nivel) → se lo pasa al código nativo (antes de abrir la carrera)
//       NIVELES_CPU (el orden: facil, normal, dificil, maximo, intenso, imposible), NOMBRE_NIVEL
//       velocidadBase(p) → la velocidad base efectiva de la CPU a 150cc (para ordenar los niveles)

export const NIVELES_CPU = ['facil', 'normal', 'dificil', 'maximo', 'intenso', 'imposible'];
export const NOMBRE_NIVEL = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', maximo: 'Máximo', intenso: 'Intenso', imposible: 'Imposible' };

// el juego (para comparar y para lo que no se toca)
export const JUEGO = Object.freeze({ arrebato: Object.freeze({ prob: 80, inicio: 30, hasta: 140, durMin: 50, durMax: 70 }), tinta: 0.8 });

// (§99: lo del kart, sin cambios salvo en los niveles de más arriba)
const KART_IGUAL = { archivoRR: false, tope: 1, velKart: 1, acel: 1, giro: 1, mt: 1 };
const MAXIMO = Object.freeze({
  fila: 2, factorBase: 1.14, factorBias: 0, mezclaMin: 1,
  arrebato: Object.freeze({ prob: 100, inicio: 10, hasta: 11, durMin: 600, durMax: 601 }),
  tinta: 1, objetosHumano: true, ...KART_IGUAL,
});
// §99: «intenso» = la tabla del Hard AI de RR tal cual (sus 3 filas por cilindrada y pista), con lo de «máximo» que
// sigue valiendo (los objetos del humano; el arrebato y la tinta dan igual: el tope ya la corta)
const INTENSO = Object.freeze({ ...MAXIMO, factorBase: 1, factorBias: 1, mezclaMin: 0, archivoRR: true });
// «imposible» = intenso con todo ×1,15 solo en las CPU (la receta del 200cc de Pulsar, pero solo para ellas) y más
// aceleración y miniturbo
const IMPOSIBLE = Object.freeze({ ...INTENSO, factorBase: 1.15, tope: 1.15, velKart: 1.15, acel: 1.5, mt: 1.5, giro: 1 });
// «difícil» = la fila difícil del juego y cada perilla a mitad de camino hacia «máximo»
const mitad = (a, b) => a + (b - a) / 2;
const DIFICIL = Object.freeze({
  fila: 2, factorBase: mitad(1, MAXIMO.factorBase), factorBias: mitad(1, MAXIMO.factorBias), mezclaMin: mitad(0, MAXIMO.mezclaMin),
  arrebato: Object.freeze({ prob: 100, inicio: 30, hasta: 80, durMin: 60, durMax: 80 }),
  tinta: mitad(JUEGO.tinta, MAXIMO.tinta), objetosHumano: false, ...KART_IGUAL,
});
const SIN_CAMBIOS = { factorBase: 1, factorBias: 1, mezclaMin: 0, arrebato: null, tinta: null, objetosHumano: false, ...KART_IGUAL };
const PERFILES = Object.freeze([
  Object.freeze({ nivel: 0, clave: 'facil', fila: 1, ...SIN_CAMBIOS }),
  Object.freeze({ nivel: 1, clave: 'normal', fila: 2, ...SIN_CAMBIOS }),
  Object.freeze({ nivel: 2, clave: 'dificil', ...DIFICIL }),
  Object.freeze({ nivel: 3, clave: 'maximo', ...MAXIMO }),
  Object.freeze({ nivel: 4, clave: 'intenso', ...INTENSO }),
  Object.freeze({ nivel: 5, clave: 'imposible', ...IMPOSIBLE }),
]);
// §99: la velocidad base efectiva de la CPU a 150cc (70 + adv de su fila: normal ~71,97, difícil ~75,25; la del Hard AI
// de RR, 170), por factorBase; en el suelo la corta el tope de su kart (120 × tope)
export const velocidadBase = p => Math.min((p.archivoRR ? 170 : p.fila === 1 ? 71.97 : 75.25) * p.factorBase, 120 * p.tope);

// el nivel (número o clave) → su perfil; lo que no se entiende = máximo (el de la sala por omisión)
export function perfilCpu(nivel) {
  const i = typeof nivel === 'string' ? NIVELES_CPU.indexOf(nivel) : Number.isInteger(nivel) ? nivel : -1;
  return PERFILES[i >= 0 && i < PERFILES.length ? i : 3];
}

// Se lo pasa al código nativo (enteros: los factores en milésimas). arrebato null = el del juego (−1). Sin el programa
// nuevo (sin _mkw_cpu_perfil) no hace nada: las carreras salen con la fila del juego. §99: lo del kart va después, con
// _mkw_cpu_perfil_kart (sin él, intenso e imposible corren como máximo: directo.mjs recorta el nivel).
export function aplicarPerfilCpu(M, nivel) {
  const p = perfilCpu(nivel);
  if (!M || typeof M._mkw_cpu_perfil !== 'function') return null;
  const a = p.arrebato || { prob: -1, inicio: -1, hasta: -1, durMin: -1, durMax: -1 };
  M._mkw_cpu_perfil(p.nivel, Math.round(p.factorBase * 1000), Math.round(p.factorBias * 1000), Math.round(p.mezclaMin * 1000),
                    a.prob, a.inicio, a.hasta, a.durMin, a.durMax, p.tinta == null ? -1 : Math.round(p.tinta * 1000), p.objetosHumano ? 1 : 0);
  if (typeof M._mkw_cpu_perfil_kart === 'function')
    M._mkw_cpu_perfil_kart(p.archivoRR ? 1 : 0, Math.round(p.tope * 1000), Math.round(p.velKart * 1000), Math.round(p.acel * 1000),
                           Math.round(p.giro * 1000), Math.round(p.mt * 1000));
  return p;
}
