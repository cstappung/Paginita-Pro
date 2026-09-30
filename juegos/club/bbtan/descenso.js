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
        barra: '#1b201e', borde: '#3a4235', lienzo: '#141719', halo: '#c4f56866', sombra: '#3d5a1c' } },
    { nombre: 'abismo', lime: '#ff4f6d', purple: '#9b6bff', orange: '#ff7a3d', cyan: '#5f7bff',
      bg: '#0b0709', puntos: '#241218', suelo: '#5a2a35', bola: '#ffe3ea', estela: '#ffc9d4', texto: '#b89aa2', velo: '#78101e4a',
      css: { bg: '#07050a', panel: '#120c11', line: '#3a2330', muted: '#a58f99', green: '#ff4f6d', purple: '#9b6bff',
        barra: '#150c10', borde: '#4a2433', lienzo: '#0b0709', halo: '#ff4f6d66', sombra: '#5a1020' } },
    { nombre: 'ruina', lime: '#d9453f', purple: '#8a5aa3', orange: '#c9702e', cyan: '#4f6a9a',
      bg: '#080405', puntos: '#1e0d0f', suelo: '#4a1f22', bola: '#e8cfc8', estela: '#b8908a', texto: '#9a7a74', velo: '#5a080e70',
      css: { bg: '#050304', panel: '#0e0708', line: '#351a1c', muted: '#8f7470', green: '#d9453f', purple: '#8a5aa3',
        barra: '#100708', borde: '#5a2224', lienzo: '#080405', halo: '#d9453f55', sombra: '#3a0a0c' } },
    { nombre: 'estática', lime: '#c8d23a', purple: '#7a6690', orange: '#d4521c', cyan: '#3f7a64',
      bg: '#050605', puntos: '#161a14', suelo: '#3a3f22', bola: '#e6ecc0', estela: '#9aa070', texto: '#8a9068', velo: '#20300a80',
      css: { bg: '#030403', panel: '#0a0c09', line: '#2a2f1c', muted: '#80866a', green: '#c8d23a', purple: '#7a6690',
        barra: '#0a0c08', borde: '#4a5020', lienzo: '#050605', halo: '#c8d23a55', sombra: '#2a3008' } },
    { nombre: 'hostil', lime: '#ff2a2a', purple: '#b0204a', orange: '#ff6a1a', cyan: '#8a3a9a',
      bg: '#070000', puntos: '#200404', suelo: '#6a0a0a', bola: '#ffd0d0', estela: '#ff8080', texto: '#c06060', velo: '#8a0000a0',
      css: { bg: '#040000', panel: '#0c0202', line: '#4a0808', muted: '#b07070', green: '#ff2a2a', purple: '#b0204a',
        barra: '#0e0202', borde: '#8a0a0a', lienzo: '#070000', halo: '#ff2a2a88', sombra: '#4a0000' } },
    { nombre: 'vacío', lime: '#f0e6e6', purple: '#958897', orange: '#ff2020', cyan: '#5e6070',
      bg: '#000000', puntos: '#141010', suelo: '#3a3030', bola: '#ffffff', estela: '#807070', texto: '#8a8080', velo: '#000000c8',
      css: { bg: '#000000', panel: '#050404', line: '#2a2222', muted: '#8a8080', green: '#f0e6e6', purple: '#958897',
        barra: '#030202', borde: '#5a1010', lienzo: '#000000', halo: '#ff202055', sombra: '#300000' } },
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

  return { DESDE, FUNDIDO, corrupcion, ETAPAS, mezcla, mezclaHex, etapa, TEXTOS, corrompe };
});
