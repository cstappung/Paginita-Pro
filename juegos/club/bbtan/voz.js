/* La voz del juego (UMD en BBTANVoz). Cada 50 rondas el juego habla, y lo que
   dice sigue al descenso y a lo que viene después: en la 50 y la 100 es un
   presentador de feria, en la 150 y la 200 se le cruzan los cables y dice
   disparates a tirones, en la 250 y la 300 se vuelve contra ti y susurra, en
   la 350 algo lo calla y desde la 400 todo es perfecto. Demasiado perfecto.

   No es la voz del navegador: speechSynthesis no existe en muchos móviles y
   en cada PC suena distinto (y casi siempre mal). Cada frase está grabada de
   antemano en assets/voz/ (colabtex/scripts/bbtan-voz.py: síntesis neuronal
   con Piper y el procesado de cada ánimo — el susurro es un vocoder LPC
   excitado con ruido, el coro perfecto son tres copias afinadas en acorde
   mayor), así suena igual en todos lados y audio.js la toca por WebAudio.

   Lo puro (qué frase toca, qué se lee y qué archivo suena) se prueba en Node.
   El texto de FRASES es a la vez lo que se lee en pantalla y lo que se grabó:
   si se cambia una frase, hay que volver a correr el script. «|» separa, en
   el giro de la 350, la parte susurrada de la perfecta; «cu-cu-cucharas» es
   un tartamudeo que la grabación hace de verdad. */
(function (root) {
  'use strict';
  const CADA = 50;
  // Una lista por umbral: 50, 100, …, 450, y de la 500 en adelante.
  const FRASES = [
    ['¡Ronda 50! ¡Eres increíble!', '¡Wiii! ¡50 rondas! ¡Qué crack!', '¡Lo estás haciendo genial! ¡Sigue así!'],
    ['¡100 rondas! ¡Eres el mejor! ¡El mejor!', '¡Qué felicidad tenerte aquí! ¡Qué felicidad!', '¡Yupi! ¡100! ¡Nunca te vayas! ¡Nunca!'],
    ['Ronda 150. Las cu-cu-cucharas también rebotan. ¿Lo sabías?', 'Felicidades. Tu abuela es un cua-cua-cuadrado de siete puntos.', '150. El pa-pa-pan tiene miedo. Muy bien. Muy bien.'],
    ['200. Los bloques me contaron un chi-chi-chiste. Era sobre ti.', 'Error. Error. Tu so-so-sombra pidió vacaciones.', 'Muy bien. Muy. Bien. ¿Quién a-a-apagó la luna?'],
    ['250... ¿por qué sigues aquí?', 'Nadie te pidió que llegaras tan lejos...', 'Te estoy mirando... desde los bloques...'],
    ['300... vete. Vete ahora.', 'Esto ya no es tuyo... es mío...', 'Tus bolas no vuelven por ti... vuelven por mí...'],
    ['350... ya no hay salida... |¡Shhh! ¡Ya pasó! ¡Ahora todo es perfecto!', '¿Qué es esta luz...? |¡Hola! ¡Bienvenido al mundo perfecto!', 'No... no... ¡no! |¡Listo! ¡Todo está bien! ¡Todo está muy bien!'],
    ['¡400 rondas! ¡Todo es perfecto! ¡Tú eres perfecto!', 'Aquí nadie está triste. Nadie. ¡Nunca!', '¡Sonríe! Sonríe más. Así. ¡Perfecto!'],
    ['¡Qué lindo es todo! ¡Qué lindo! ¡Qué lindo!', 'Los bloques te quieren. Todos te queremos. Muchísimo.', 'No hay nada malo aquí. Nada. No mires debajo.'],
    ['Quédate para siempre. ¡Siempre! Es perfecto, ¿no?', 'Ya no tienes que irte nunca más. ¡Qué alegría!', 'Todo es perfecto. Todo es perfecto. Todo es perfecto.'],
  ];
  const ANIMO = ['alegre', 'alegre', 'roto', 'roto', 'susurro', 'susurro', 'giro', 'perfecto', 'perfecto', 'perfecto'];

  // ¿Esta ronda habla? Solo al entrar a un múltiplo de 50.
  const habla = ronda => Number.isInteger(ronda) && ronda >= CADA && ronda % CADA === 0;
  const nivel = ronda => Math.max(0, Math.min(FRASES.length - 1, Math.floor(ronda / CADA) - 1));
  const animo = ronda => ANIMO[nivel(ronda)];
  // Cuál de las frases del umbral: azar en [0, 1).
  const eleccion = (ronda, azar = 0) => Math.max(0, Math.min(FRASES[nivel(ronda)].length - 1, Math.floor(azar * FRASES[nivel(ronda)].length)));
  const texto = (ronda, i) => FRASES[nivel(ronda)][i].replace(/\s*\|\s*/, ' ');
  const archivo = (ronda, i) => `assets/voz/v${nivel(ronda)}-${i}.mp3`;
  // Cuánto dura más o menos, para el aviso mientras el audio no ha llegado.
  const estimada = t => Math.max(2.5, t.length * .085 + (/\.\.\./.test(t) ? 1.2 : .6));

  const api = { CADA, FRASES, ANIMO, habla, nivel, animo, eleccion, texto, archivo, estimada };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BBTANVoz = api;
})(globalThis);
