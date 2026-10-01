/* El descenso: cinco pisos por debajo de la luz (rondas 50, 110, 170, 230 y
   290). Cada uno entra fundido a lo largo de sesenta rondas, no de golpe, y
   cada fundido empieza justo donde acaba el anterior: `corrupcion(ronda)` vale
   0 hasta la 49 y sube sin mesetas de a 1/60 por ronda hasta llegar a 5 en la
   349. De ese número salen los colores,
   los bordes, la cara del personaje, los textos y la música. La jugabilidad
   no lo lee: los bloques, las bolas y la física son los mismos en todos. */
(function (root, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BBTANDescenso = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DESDE = [50, 110, 170, 230, 290];
  const FUNDIDO = 60;
  const lim = v => Math.max(0, Math.min(1, v));

  function corrupcion(ronda) {
    let c = 0;
    for (const r of DESDE) c += lim((ronda - r + 1) / FUNDIDO);
    return c;
  }

  /* Paletas por piso. Las cuatro claves de los bloques (lime, purple, orange,
     cyan) tienen que seguir distinguiéndose entre sí en todas: dicen cuánta
     vida tiene cada bloque. */
  const ETAPAS = [
    { nombre: 'luz', lime: '#c4f568', purple: '#b7a1f7', orange: '#ffa675', cyan: '#77d9d2',
      bg: '#141719', puntos: '#2a2e2f', suelo: '#4b5142', bola: '#f6ffe9', estela: '#ecfbd7', texto: '#a9b699', velo: '#78101e00',
      css: { bg: '#101311', panel: '#191d1b', line: '#353c33', muted: '#9ca58f', green: '#c4f568', purple: '#b7a1f7',
        barra: '#1b201e', borde: '#3a4235', lienzo: '#141719', halo: '#c4f56866', sombra: '#3d5a1c', text: '#f1f0e9' } },
    { nombre: 'abismo', lime: '#ff4f6d', purple: '#9b6bff', orange: '#ff7a3d', cyan: '#5f7bff',
      bg: '#0b0709', puntos: '#241218', suelo: '#5a2a35', bola: '#ffe3ea', estela: '#ffc9d4', texto: '#b89aa2', velo: '#78101e4a',
      css: { bg: '#07050a', panel: '#120c11', line: '#3a2330', muted: '#a58f99', green: '#ff4f6d', purple: '#9b6bff',
        barra: '#150c10', borde: '#4a2433', lienzo: '#0b0709', halo: '#ff4f6d66', sombra: '#5a1020', text: '#f1f0e9' } },
    { nombre: 'ruina', lime: '#d9453f', purple: '#8a5aa3', orange: '#c9702e', cyan: '#4f6a9a',
      bg: '#080405', puntos: '#1e0d0f', suelo: '#4a1f22', bola: '#e8cfc8', estela: '#b8908a', texto: '#9a7a74', velo: '#5a080e70',
      css: { bg: '#050304', panel: '#0e0708', line: '#351a1c', muted: '#8f7470', green: '#d9453f', purple: '#8a5aa3',
        barra: '#100708', borde: '#5a2224', lienzo: '#080405', halo: '#d9453f55', sombra: '#3a0a0c', text: '#f1f0e9' } },
    { nombre: 'estática', lime: '#c8d23a', purple: '#7a6690', orange: '#d4521c', cyan: '#3f7a64',
      bg: '#050605', puntos: '#161a14', suelo: '#3a3f22', bola: '#e6ecc0', estela: '#9aa070', texto: '#8a9068', velo: '#20300a80',
      css: { bg: '#030403', panel: '#0a0c09', line: '#2a2f1c', muted: '#80866a', green: '#c8d23a', purple: '#7a6690',
        barra: '#0a0c08', borde: '#4a5020', lienzo: '#050605', halo: '#c8d23a55', sombra: '#2a3008', text: '#f1f0e9' } },
    { nombre: 'hostil', lime: '#ff2a2a', purple: '#b0204a', orange: '#ff6a1a', cyan: '#8a3a9a',
      bg: '#070000', puntos: '#200404', suelo: '#6a0a0a', bola: '#ffd0d0', estela: '#ff8080', texto: '#c06060', velo: '#8a0000a0',
      css: { bg: '#040000', panel: '#0c0202', line: '#4a0808', muted: '#b07070', green: '#ff2a2a', purple: '#b0204a',
        barra: '#0e0202', borde: '#8a0a0a', lienzo: '#070000', halo: '#ff2a2a88', sombra: '#4a0000', text: '#f1f0e9' } },
    { nombre: 'vacío', lime: '#f0e6e6', purple: '#958897', orange: '#ff2020', cyan: '#5e6070',
      bg: '#000000', puntos: '#141010', suelo: '#3a3030', bola: '#ffffff', estela: '#807070', texto: '#8a8080', velo: '#000000c8',
      css: { bg: '#000000', panel: '#050404', line: '#2a2222', muted: '#8a8080', green: '#f0e6e6', purple: '#958897',
        barra: '#030202', borde: '#5a1010', lienzo: '#000000', halo: '#ff202055', sombra: '#300000', text: '#f1f0e9' } },
  ];

  const hex = h => { const s = h.slice(1); return [0, 2, 4, 6].map(i => i < s.length ? parseInt(s.slice(i, i + 2), 16) : 255); };
  const aHex = v => '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  function mezclaHex(a, b, t) {
    const A = hex(a), B = hex(b), largo = a.length > 7 || b.length > 7;
    const r = A.map((x, i) => x + (B[i] - x) * t);
    return aHex(largo ? r : r.slice(0, 3));
  }
  function mezclaObj(a, b, t) {
    const o = {};
    for (const k in a) o[k] = typeof a[k] === 'string' && a[k][0] === '#' ? mezclaHex(a[k], b[k], t) : typeof a[k] === 'object' ? mezclaObj(a[k], b[k], t) : (t < .5 ? a[k] : b[k]);
    return o;
  }
  /* La paleta de una corrupción cualquiera, fundida entre los dos pisos. */
  function mezcla(c) {
    c = Math.max(0, Math.min(ETAPAS.length - 1, c));
    const i = Math.min(ETAPAS.length - 2, Math.floor(c));
    return mezclaObj(ETAPAS[i], ETAPAS[i + 1], c - i);
  }
  /* El piso cuyos textos se usan: el más cercano, así el tono cambia a mitad
     del fundido y no en su primera ronda. */
  const etapa = c => Math.max(0, Math.min(5, Math.floor(c + .5)));

  const TEXTOS = {
    entrada: ['', 'EL ABISMO', 'LA RUINA', 'ESTÁTICA', 'NO ERES BIENVENIDO', 'EL VACÍO'],
    animo: [
      ['¡Vas con todo!', '¡Así se juega!'],
      ['Sigues bajando', 'Qué oscuro, ¿no?'],
      ['¿Todavía aquí?', 'Nadie te pidió llegar tan lejos'],
      ['Vete.', 'No deberías ver esto'],
      ['NO TE QUEREMOS AQUÍ', 'Los bloques te recuerdan'],
      ['NO HAY NADA MÁS ABAJO', 'APÁGALO'],
    ],
    combo: [n => `¡COMBO ×${n}!`, n => `COMBO ×${n}`, n => `COMBO ×${n}. ¿Y?`, n => `×${n}. No importa.`, n => `×${n}. NO SIRVE DE NADA`, n => `×${n} ... para qué`],
    recall: ['Todas de vuelta. ¡Nuevo tiro!', 'Todas de vuelta.', 'Volvieron. Qué lástima.', 'Vuelven. Siempre vuelven.', 'Ni tus bolas quieren salir.', 'Nada vuelve igual.'],
    estado: {
      aim: ['TODO LISTO', 'LISTO', 'SI INSISTES', 'NO LO HAGAS', 'DETENTE', 'NO'],
      shoot: ['QUE NO PARE', 'SIGUE', 'PARA YA', 'INÚTIL', 'NADIE MIRA', '...'],
      descend: ['SIGUIENTE RONDA', 'MÁS ABAJO', 'MÁS HONDO', 'NO HAY FONDO', 'CAEN SOBRE TI', 'CAER'],
      pause: ['EN PAUSA', 'EN PAUSA', 'EN PAUSA', 'EN PAUSA', 'QUÉDATE AHÍ', 'NO VUELVAS'],
      over: ['FIN DE LA PARTIDA', 'FIN DE LA PARTIDA', 'POR FIN', 'POR FIN', 'LIBRE', 'GRACIAS POR IRTE'],
    },
    fin: [
      { rotulo: 'BIEN JUGADO', record: 'UNA MARCA PARA SUPERAR', titulo: 'Una más', signo: '?', copia: 'Los bloques ganaron esta. La siguiente es tuya.', boton: 'Volver a jugar' },
      { rotulo: 'EL ABISMO GANA', record: 'LLEGASTE MÁS HONDO QUE NUNCA', titulo: 'Otra vez', signo: '?', copia: 'Bajaste hasta aquí. Los bloques no olvidan.', boton: 'Volver a caer' },
      { rotulo: 'SE ACABÓ', record: 'UNA MARCA. ¿Y QUÉ?', titulo: 'Por fin', signo: '.', copia: 'Ya era hora. Nadie quería que llegaras tan lejos.', boton: 'Volver a caer' },
      { rotulo: 'SEÑAL PERDIDA', record: 'NADIE VA A VER ESTA MARCA', titulo: 'Vete', signo: '.', copia: 'No hay premio aquí abajo. Nunca lo hubo.', boton: 'Insistir' },
      { rotulo: 'NO VUELVAS', record: 'TU MARCA NO LE IMPORTA A NADIE', titulo: 'Fuera', signo: '.', copia: 'El juego no te quiere aquí. Ni los bloques. Ni nosotros.', boton: 'Insistir' },
      { rotulo: 'VACÍO', record: 'VACÍO', titulo: '..', signo: '.', copia: 'Apágalo. No hay nada más abajo. No había nada nunca.', boton: 'Otra vez' },
    ],
    pausa: [
      { rotulo: 'TÓMATE UN RESPIRO', titulo: 'En pausa', signo: '.', copia: 'Los bloques pueden esperar.', boton: 'Seguir jugando' },
      { rotulo: 'RESPIRA', titulo: 'En pausa', signo: '.', copia: 'Los bloques esperan. Abajo.', boton: 'Seguir jugando' },
      { rotulo: 'NO TE VAYAS AÚN', titulo: 'Quieto', signo: '.', copia: 'Los bloques siguen aquí cuando no miras.', boton: 'Seguir jugando' },
      { rotulo: 'NO HAY PAUSA', titulo: 'Pausa', signo: '?', copia: 'Esto no se detiene. Solo dejaste de mirar.', boton: 'Seguir cayendo' },
      { rotulo: 'QUÉDATE AHÍ', titulo: 'Mejor así', signo: '.', copia: 'Si cierras la pestaña, nadie te lo va a reprochar.', boton: 'Seguir cayendo' },
      { rotulo: 'NO VUELVAS', titulo: '..', signo: '.', copia: 'Quédate en pausa. Para siempre.', boton: 'Seguir cayendo' },
    ],
  };

  /* Un texto que se rompe: con fuerza f (0..1) cambia algunas letras por
     signos que la Press Start 2P sí tiene. Con la misma semilla sale igual,
     así la barra de estado no parpadea en cada repintado. */
  const RUIDO = '#%&*/\\_0';
  function corrompe(texto, f, semilla) {
    if (!(f > 0)) return texto;
    let s = (semilla | 0) ^ 0x9e3779b9, out = '';
    for (const ch of texto) {
      s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) ^ Math.imul(s ^ (s >>> 12), 0x297a2d39);
      const u = ((s ^ (s >>> 15)) >>> 0) / 4294967296;
      out += ch !== ' ' && u < f * .35 ? RUIDO[Math.floor(u * 1e4) % RUIDO.length] : ch;
    }
    return out;
  }

  /* Y después del fondo, la luz. Pasada la 350 algo limpia la máquina: en
     quince rondas el descenso se deshace (`luz`, lo que el juego resta de la
     corrupción) y entra el mundo perfecto, en tres pisos: `perfeccion(ronda)`
     vale 0 hasta la 349, llega a 1 en la 369 (dulce: el primero entra rápido,
     porque es lo que barre la oscuridad), y sube de a 1/50 por ronda hasta 2
     en la 449 (radiante) y 3 en la 499 (perfecto). Cada piso más feliz que
     el anterior, hasta que la felicidad no deja espacio para nada más. */
  const CIELO_DESDE = [350, 400, 450];
  const CIELO_FUNDIDO = [20, 50, 50];
  const LUZ = 15;
  const luz = ronda => lim((ronda - CIELO_DESDE[0] + 1) / LUZ);
  function perfeccion(ronda) {
    let p = 0;
    CIELO_DESDE.forEach((r, i) => { p += lim((ronda - r + 1) / CIELO_FUNDIDO[i]); });
    return p;
  }
  // Lo que se ve del descenso: se deshace mientras entra la luz.
  const corrupcionVista = ronda => corrupcion(ronda) * (1 - luz(ronda));

  /* Paletas del cielo: claras, de caramelo. Como abajo, las cuatro claves de
     los bloques siguen distinguiéndose (dicen cuánta vida les queda). */
  const CIELO = [
    { nombre: 'dulce', lime: '#6fdc8c', purple: '#c58cff', orange: '#ff8fb8', cyan: '#5ec8ff',
      bg: '#fdf3fa', puntos: '#f4cfe6', suelo: '#f0a8cf', bola: '#ff6fae', estela: '#ffc2dd', texto: '#b0578a', velo: '#ffffff00',
      css: { bg: '#fbe9f5', panel: '#ffffff', line: '#f2c4df', muted: '#b27a99', green: '#e2559a', purple: '#9b6be0',
        barra: '#fff4fa', borde: '#f59ac8', lienzo: '#fdf3fa', halo: '#ff8fc866', sombra: '#f7b8d6', text: '#6a2b50' } },
    { nombre: 'radiante', lime: '#4fe07a', purple: '#b56cff', orange: '#ff6fa0', cyan: '#3fb8ff',
      bg: '#fff9e8', puntos: '#ffe3a3', suelo: '#ffc24d', bola: '#ff4f9a', estela: '#ffe066', texto: '#c2632a', velo: '#fff6c000',
      css: { bg: '#fff3d6', panel: '#ffffff', line: '#ffd88a', muted: '#c08a3a', green: '#ff5a9e', purple: '#8f5bff',
        barra: '#fffaf0', borde: '#ffb84d', lienzo: '#fff9e8', halo: '#ffd23f88', sombra: '#ffc98a', text: '#6a3b12' } },
    { nombre: 'perfecto', lime: '#5ef08a', purple: '#c77dff', orange: '#ff7ab6', cyan: '#4cc9ff',
      bg: '#ffffff', puntos: '#ffe1f0', suelo: '#ffb3d9', bola: '#ff5fa8', estela: '#ffd6ea', texto: '#e0409a', velo: '#ffffff00',
      css: { bg: '#ffffff', panel: '#ffffff', line: '#ffd1e8', muted: '#e070aa', green: '#ff3d99', purple: '#b060ff',
        barra: '#ffffff', borde: '#ff8cc6', lienzo: '#ffffff', halo: '#ff7ab699', sombra: '#ffc2e0', text: '#c0207a' } },
  ];
  /* La paleta del cielo para una perfección p, fundida sobre la de abajo
     (`base`, la del descenso que se está deshaciendo): de 0 a 1 entra el
     primer piso, y de ahí en adelante se funde de un piso al siguiente. */
  function mezclaCielo(base, p) {
    if (!(p > 0)) return base;
    const c = p <= 1 ? CIELO[0] : mezclaObj(CIELO[Math.min(1, Math.floor(p) - 1)], CIELO[Math.min(2, Math.floor(p))], p - Math.floor(p));
    return p < 1 ? mezclaObj(base, c, p) : c;
  }
  // El piso del cielo cuyos textos se usan (1..3), 0 antes de que se note.
  const etapaCielo = p => p < .5 ? 0 : Math.max(1, Math.min(3, Math.round(p)));

  // Los textos del cielo: índice 1 dulce, 2 radiante, 3 perfecto (0 no se usa).
  const TEXTOS_CIELO = {
    animo: [null,
      ['¡Qué bonito todo!', '¡Así me gusta!'],
      ['¡TODO ESTÁ BIEN!', '¡Nadie está triste!'],
      ['SONRÍE', 'NO HAY NADA MALO AQUÍ :)'],
    ],
    combo: [null, n => `¡COMBO ×${n}! ♥`, n => `¡¡COMBO ×${n}!! ♥♥`, n => `×${n} ♥ PERFECTO ♥`],
    recall: [null, '¡Todas en casita! ♥', '¡Volvieron felices!', 'Siempre vuelven. Siempre. :)'],
    estado: {
      aim: [null, 'TODO LISTO ♥', '¡TODO PERFECTO!', 'SONRÍE :)'],
      shoot: [null, '¡WIII!', '¡QUÉ FELICIDAD!', 'MÁS FELIZ'],
      descend: [null, '¡MÁS AMIGOS!', '¡VIENEN A ABRAZARTE!', 'MÁS CERCA :)'],
      pause: [null, 'EN PAUSA ♥', '¡VUELVE PRONTO!', 'TE ESPERAMOS :)'],
      over: [null, 'OH, NO', 'NO PASA NADA :)', 'NADA PASÓ :)'],
    },
    fin: [null,
      { rotulo: '¡OH, NO!', record: '¡UNA MARCA PRECIOSA!', titulo: 'Casi', signo: '♥', copia: 'No pasa nada. Aquí todos te queremos igual.', boton: 'Otra vez ♥' },
      { rotulo: '¡NO PASA NADA!', record: '¡QUÉ ORGULLO!', titulo: 'Perfecto', signo: '!', copia: 'Perder también es perfecto. Todo es perfecto.', boton: '¡Otra vez!' },
      { rotulo: 'NADA PASÓ :)', record: 'PERFECTO :)', titulo: 'Sonríe', signo: ':)', copia: 'Aquí nadie pierde. Aquí nadie se va. Vuelve a jugar. Vuelve.', boton: 'Volver :)' },
    ],
    pausa: [null,
      { rotulo: '¡UN RESPIRITO!', titulo: 'En pausa', signo: '♥', copia: 'Los bloquecitos te esperan con cariño.', boton: 'Seguir jugando ♥' },
      { rotulo: '¡NO TARDES!', titulo: 'En pausa', signo: '!', copia: 'Todos te extrañan ya. Muchísimo.', boton: '¡Volver!' },
      { rotulo: 'TE ESTAMOS MIRANDO :)', titulo: 'Pausa', signo: ':)', copia: 'Seguimos sonriendo mientras no estás. Siempre sonreímos.', boton: 'Volver :)' },
    ],
  };

  return { DESDE, FUNDIDO, corrupcion, ETAPAS, mezcla, mezclaHex, mezclaObj, etapa, TEXTOS, corrompe,
    CIELO_DESDE, CIELO_FUNDIDO, LUZ, luz, perfeccion, corrupcionVista, CIELO, mezclaCielo, etapaCielo, TEXTOS_CIELO };
});
