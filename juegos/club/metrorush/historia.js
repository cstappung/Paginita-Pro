/* Metro Rush — la historia que se ve y se oye mientras se corre.

   QUÉ HACE, EN GLOBAL
   Los boletos dorados (motor.js) cuentan la última noche de la Línea 3 en
   la Libreta, pero una Libreta se lee con el juego en pausa. Este archivo
   junta lo que la cuenta EN CARRERA, sin detener nada:
   - AFICHES: los carteles de la vereda de cada estación (avisos de la
     empresa, «se busca», homenajes, publicidad del barrio y el plano de la
     línea con «usted está aquí»). Los personajes salen retratados en ellos.
     escenarios.js los dibuja; aquí solo está qué dice cada uno.
   - ANUNCIOS: el altavoz del andén. Uno al entrar al túnel de cada estación
     («Próxima estación: …») y otro, el «eco», una sola vez a mitad de la
     estación y solo en un momento tranquilo (juego.js lo decide). La voz
     empieza siendo la de la empresa y se va volviendo la de Marta, la
     maquinista del último tren, que habla con Don Ramón y contigo.
   - LORE: los grafitis y los letreros de tienda que se suman a cada paleta
     (cortos: un grafiti son ~9 letras a 190 px en un lienzo de 1024).

   POR QUÉ ASÍ
   - Es solo texto y datos, sin DOM ni Three: se carga como script normal
     (window.MetroRushHistoria) y en Node con require, para que un test
     revise que cada estación tiene sus afiches y sus anuncios.
   - Los afiches van por PALETA (cada kit del mundo es una paleta) y los
     anuncios por ESTACIÓN (el juego sabe en qué estación va).
   - Nada de esto cambia puntos ni metros: el antitrampas no lo ve.

   EL ARCO (para quien escriba más): la Línea 3 cierra mañana; un último
   tren que no para en ninguna estación; Don Ramón, que en cuarenta años no
   multó a nadie, y Tornillo te persiguen. Las pistas llevan a Marta
   Quiroga, que manejó el viaje inaugural del 317 en 1986 con Ramón de
   inspector en práctica; en 2006, la noche en que iban a desguazar el 317,
   desapareció con él, y desde entonces maneja de noche por las vías que
   nadie usa. Ramón y Marta se dejan café en un andén de Invierno hace
   veinte años y nunca coinciden. Al amanecer el 317 se detiene por primera
   vez, Marta le paga a Ramón el café que le debía desde 1986, y Ramón por
   fin «atrapa» a alguien (a ti) y te pica el boleto: «Válido, para todos
   los viajes que queden». */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();   // Node (los tests)
  else raiz.MetroRushHistoria = fabrica();                                         // el navegador
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Los personajes ----------
     Para los retratos de los afiches (escenarios.js los dibuja con estos
     colores) y para quien escriba textos nuevos. */
  const PERSONAJES = {
    ramon: { nombre: 'Don Ramón Ibarra', gorra: '#1f3a5f', placa: '#fca311', piel: '#e8b48a', bigote: '#d9d4cc' },
    marta: { nombre: 'Marta Quiroga', gorra: '#3d6fa8', raya: '#dfe8f2', piel: '#c98d66', trenza: '#cfcac2', bufanda: '#c8402e' },
    tornillo: { nombre: 'Tornillo', pelo: '#a8703c', mancha: '#5a3a20', collar: '#e8463b' },
    corredor: { nombre: 'Tú', sudadera: '#ff5a3c', gorra: '#2a6df4' }
  };

  /* ---------- Los afiches de cada paleta ----------
     Tipos (escenarios.js sabe dibujar cada uno):
       aviso    papel blanco con franja de color: `cabeza` (la franja),
                `titulo` (grande), `pie` (chico). Los avisos de la empresa.
       retrato  un «se busca», un «¿la ha visto?» o un homenaje: `quien`
                (ramon, marta, tornillo, corredor), `cabeza`, `titulo`, `pie`.
       anuncio  publicidad del barrio: `titulo`, `pie`, `fondo` y `tinta`.
       mapa     el plano de la Línea 3 con «usted está aquí» en `aqui`.
     El titular manda: a 30 m/s se alcanza a leer UNA idea por afiche, así
     que el `titulo` va en pocas palabras y lo demás es para quien mire.
     Se dibujan ocho por paleta (un atlas de 4 × 2); si hay menos, se repiten
     en orden, y en la vereda salen en orden, para que la historia se lea. */
  const AFICHES = {
    barrio: [
      { t: 'aviso', cabeza: 'AVISO', titulo: 'LA LÍNEA 3 CIERRA MAÑANA', pie: 'Último servicio 23:59 · no se detiene en ninguna estación', color: '#e8463b' },
      { t: 'retrato', quien: 'ramon', cabeza: 'GRACIAS', titulo: 'DON RAMÓN', pie: '40 años de servicio' },
      { t: 'retrato', quien: 'corredor', cabeza: 'SE BUSCA', titulo: 'POR CORRER EN LA VÍA', pie: 'Recompensa: un café' },
      { t: 'mapa', aqui: 'barrio' },
      { t: 'anuncio', titulo: 'CAFÉ LA VÍA', pie: 'Abierto hasta el último tren', fondo: '#6a3d1f', tinta: '#ffe2a8' },
      { t: 'retrato', quien: 'tornillo', cabeza: 'PERRO DE SERVICIO', titulo: 'TORNILLO', pie: 'No muerde (casi)' }
    ],
    ocaso: [
      { t: 'retrato', quien: 'ramon', cabeza: 'RÉCORD', titulo: '0 MULTAS', pie: 'Don Ramón · 40 años de inspector' },
      { t: 'aviso', cabeza: 'HORARIO', titulo: 'ÚLTIMO TREN 23:59', pie: 'Ese tren no se detiene. Repetimos: no se detiene.', color: '#2a6df4' },
      { t: 'mapa', aqui: 'ocaso' },
      { t: 'anuncio', titulo: 'RADIO OCASO', pie: 'Canciones para despedir la línea', fondo: '#4b3474', tinta: '#ffd23f' },
      { t: 'retrato', quien: 'corredor', cabeza: 'SE BUSCA', titulo: '¿LO HAS VISTO?', pie: 'Corre más rápido que el 3' }
    ],
    mercado: [
      { t: 'anuncio', titulo: 'OBJETOS PERDIDOS', pie: 'Se vende todo, menos la gorra', fondo: '#2f7a5a', tinta: '#fff3c4' },
      { t: 'aviso', cabeza: 'FIRME AQUÍ', titulo: 'NO AL CIERRE', pie: 'Los puestos del mercado con la Línea 3', color: '#2fb59a' },
      { t: 'anuncio', titulo: 'EMPANADAS 2×1', pie: 'Solo esta noche', fondo: '#c8402e', tinta: '#fff1d4' },
      { t: 'mapa', aqui: 'mercado' },
      { t: 'retrato', quien: 'tornillo', cabeza: 'PROHIBIDO', titulo: 'DARLE SOPAIPILLAS', pie: 'A Tornillo (ya comió seis)' }
    ],
    neon: [
      { t: 'anuncio', titulo: 'TU NOMBRE AQUÍ', pie: 'Si corres lo bastante rápido', fondo: '#140a2e', tinta: '#22e5ff' },
      { t: 'aviso', cabeza: 'CONSULTA', titulo: '¿QUIÉN PAGA ESTA LUZ?', pie: 'La empresa no. Nadie sabe.', color: '#ff2bd6' },
      { t: 'mapa', aqui: 'neon' },
      { t: 'retrato', quien: 'corredor', cabeza: 'SE BUSCA', titulo: 'AHORA DE NOCHE', pie: 'Si lo ves pasar, salúdalo' }
    ],
    fantasma: [
      { t: 'retrato', quien: 'marta', cabeza: '¿LA HA VISTO?', titulo: 'MARTA QUIROGA', pie: 'Maquinista del 317 · desde 2006' },
      { t: 'aviso', cabeza: 'ESTACIÓN CERRADA', titulo: 'AQUÍ NO PARA NADIE', pie: 'Desde 2006, por orden de la empresa', color: '#2bd6a0' },
      { t: 'anuncio', titulo: 'ADIÓS 317', pie: '1986 – 2006 · el primer tren', fondo: '#0f3a30', tinta: '#b6fff0' },
      { t: 'mapa', aqui: 'fantasma' }
    ],
    cocheras: [
      { t: 'aviso', cabeza: 'TURNO 1986', titulo: 'VIAJE INAUGURAL 317', pie: 'Maq.: M. Quiroga · Insp. en práctica: R. Ibarra', color: '#3b5ba8' },
      { t: 'aviso', cabeza: 'VÍA 7', titulo: 'EL 317 NO ESTÁ', pie: 'Se ruega devolver la llave', color: '#ff8a1f' },
      { t: 'retrato', quien: 'marta', cabeza: 'SE BUSCA', titulo: 'LA LLAVE DEL 317', pie: 'Y a quien la tenga' },
      { t: 'mapa', aqui: 'cocheras' },
      { t: 'retrato', quien: 'ramon', cabeza: '1986', titulo: 'R. IBARRA, 19 AÑOS', pie: 'Inspector en práctica' }
    ],
    invierno: [
      { t: 'anuncio', titulo: 'CAFÉ PARA LA MAQUINISTA', pie: '—R.', fondo: '#7a4a2a', tinta: '#fff1d4' },
      { t: 'aviso', cabeza: 'CUIDADO', titulo: 'RIELES CON HIELO', pie: 'Y café en el andén', color: '#2a6df4' },
      { t: 'retrato', quien: 'tornillo', cabeza: 'ABRIGADITO', titulo: 'TORNILLO', pie: 'Con la bufanda de alguien' },
      { t: 'mapa', aqui: 'invierno' }
    ],
    muelle: [
      { t: 'aviso', cabeza: 'PROYECTO 1986', titulo: 'LÍNEA 3 HASTA EL MAR', pie: 'Obra suspendida', color: '#22e5ff' },
      { t: 'anuncio', titulo: 'FARO DEL MUELLE', pie: 'Luz para los que llegan tarde', fondo: '#0a1e33', tinta: '#ffe14d' },
      { t: 'mapa', aqui: 'muelle' },
      { t: 'retrato', quien: 'marta', cabeza: 'SE BUSCA', titulo: 'MARTA QUIROGA', pie: 'Vista anoche, en el muelle' }
    ],
    oxido: [
      { t: 'aviso', cabeza: 'ATENCIÓN', titulo: 'FIN DEL MAPA', pie: 'Siga los rieles tibios', color: '#a0623a' },
      { t: 'anuncio', titulo: 'ÚLTIMA BOMBA', pie: 'Agua · aceite · café para dos', fondo: '#5a3020', tinta: '#ffd23f' },
      { t: 'mapa', aqui: 'oxido' },
      { t: 'retrato', quien: 'corredor', cabeza: 'SE BUSCA', titulo: 'YA CASI', pie: 'Falta una estación' }
    ],
    fin: [
      { t: 'anuncio', titulo: 'GRACIAS POR CORRERLA', pie: 'Línea 3 · 1986 – siempre', fondo: '#ffd6a5', tinta: '#7a3a22' },
      { t: 'retrato', quien: 'ramon', cabeza: 'ÚLTIMO TURNO', titulo: 'CUMPLIDO', pie: 'Don Ramón Ibarra' },
      { t: 'retrato', quien: 'marta', cabeza: 'BIENVENIDA', titulo: 'MARTA', pie: 'El 317 vuelve a casa' },
      { t: 'mapa', aqui: 'fin' },
      { t: 'retrato', quien: 'corredor', cabeza: 'BOLETO', titulo: 'VÁLIDO', pie: 'Para todos los viajes que queden' }
    ]
  };

  /* ---------- El altavoz del andén ----------
     `proxima` suena al entrar al túnel de esa estación (en el túnel no hay
     obstáculos: es el único momento en que un texto no compite con
     esquivar). `eco` suena una vez a mitad de la estación, cuando juego.js
     ve que no viene nada por tu carril. Una línea cada uno, cortos: se leen
     de un vistazo en una franja chica arriba. */
  const ANUNCIOS = {
    barrio: { proxima: 'Próxima estación: Barrio Estación. Donde empezó todo.', eco: 'Señores pasajeros: la Línea 3 cierra mañana. Gracias por cuarenta años de viajes.' },
    ocaso: { proxima: 'Próxima estación: Ocaso. Este tren no se detiene. Repetimos: no se detiene.', eco: 'Se informa que el inspector Ramón Ibarra está de turno. Por última vez.' },
    mercado: { proxima: 'Próxima estación: Mercado de Farolillos. Se ruega no comprar desde la vía.', eco: 'Objetos perdidos informa: la gorra bordada… ya fue retirada.' },
    neon: { proxima: 'Próxima estación: Línea Neón. Las luces se encienden solas. No pregunte quién.', eco: 'Los letreros de esta estación están encendidos sin autorización. Gracias a quien sea.' },
    fantasma: { proxima: 'Próxima estación: Estación Fantasma. Aquí no para un tren desde 2006.', eco: 'Esta estación no tiene pasajeros. Esta noche tiene público.' },
    cocheras: { proxima: 'Próxima estación: Cocheras. Vía 7 libre desde hace veinte años.', eco: 'Atención, cocheras: el 317 no está en su vía. Repito: el 317 salió.' },
    invierno: { proxima: 'Próxima estación: Invierno. Hay café en el andén.', eco: 'Ramón: el del termo no cuenta. El café bueno te lo debo desde 1986.' },
    muelle: { proxima: 'Próxima estación: Muelle. La línea nunca llegó al mar. Hasta esta noche.', eco: 'Aviso a los navegantes: hay un tren en el muelle. Sí, un tren.' },
    oxido: { proxima: 'Aquí el 317. Se acaba el mapa. Sigan los rieles tibios.', eco: 'Ramón, no te hagas el leso: sigue al que corre. Él conoce el camino.' },
    fin: { proxima: 'Aquí el 317. Última estación: Fin de la Línea. Esta vez sí me detengo.', eco: 'Gracias por correr la Línea 3. Mientras alguien la corra, sigue abierta.' }
  };
  /** El anuncio del túnel para la estación `est` (la que viene). En las
      vueltas (la misma estación otra vez) es uno propio. null si no hay. */
  function anuncioProxima(est) {
    if (!est) return null;
    if (est.vuelta > 1) return `Próxima estación: ${est.nombre.split(' · ')[0]}. Otra vuelta. La Línea 3 sigue abierta.`;
    return (ANUNCIOS[est.id] && ANUNCIOS[est.id].proxima) || null;
  }
  /** El anuncio de mitad de estación (una vez por visita). En las vueltas, ninguno: ya se oyó. */
  function anuncioEco(est) {
    if (!est || est.vuelta > 1) return null;
    return (ANUNCIOS[est.id] && ANUNCIOS[est.id].eco) || null;
  }

  /* ---------- Grafitis y letreros que se suman a cada paleta ----------
     [texto, color 1, color 2] como los de mundo.js. El texto es corto a
     propósito (cabe en el muro). No se tocan las paletas base: se suman
     con una copia (ver escenarios.js). */
  const LORE = {
    barrio: { grafitis: [['NO CIERREN', 0xff5a3c, 0xffd23f]], carteles: ['CAFÉ LA VÍA'] },
    ocaso: { grafitis: [['0 MULTAS', 0xffd23f, 0xff6a9a]], carteles: ['RADIO'] },
    mercado: { grafitis: [['¿QUIÉN M?', 0xffd23f, 0xe8463b], ['NO CIERREN', 0x2fb59a, 0xffd23f]], carteles: [] },
    neon: { grafitis: [['317', 0x22e5ff, 0xff2bd6]], carteles: [] },
    fantasma: { grafitis: [['MARTA', 0xb6fff0, 0x2bd6a0]], carteles: [] },
    cocheras: { grafitis: [['VÍA 7', 0xffb020, 0xe2463a], ['317', 0xfff1d4, 0x6c8cd8]], carteles: [] },
    invierno: { grafitis: [['GRACIAS R.', 0x3fd0ff, 0x7a5cff]], carteles: [] },
    muelle: { grafitis: [['AL MAR', 0x22e5ff, 0x7b5cff], ['317', 0xffe14d, 0xff2bd6]], carteles: [] },
    oxido: { grafitis: [['SIGUE', 0xffd23f, 0xe2463a]], carteles: [] },
    fin: { grafitis: [['VÁLIDO', 0xffd23f, 0x2fb59a]], carteles: [] }
  };

  /** Los afiches de una paleta (lista vacía si no tiene). */
  const afichesDe = paleta => AFICHES[paleta] || [];

  return { PERSONAJES, AFICHES, ANUNCIOS, LORE, afichesDe, anuncioProxima, anuncioEco };
});
