/* La voz del juego (UMD en BBTANVoz). Cada 50 rondas el juego habla, y lo que
   dice sigue al descenso: en la 50 y la 100 es un presentador de feria, en la
   150 y la 200 se le cruzan los cables y dice disparates a tirones, y desde la
   250 se vuelve contra ti y susurra, grave y lento.

   Lo puro (qué frase toca y en qué trozos se dice, con qué altura, velocidad y
   volumen) se prueba en Node; `decir` es lo único que toca speechSynthesis.
   Si el navegador no tiene voces, el juego sigue igual: la frase se lee en
   pantalla y la cama de sonido de audio.js suena igual. */
(function (root) {
  'use strict';
  const CADA = 50;
  // Una lista por umbral: 50, 100, 150, 200, 250, 300 y de 350 en adelante.
  const FRASES = [
    ['¡Ronda {n}! ¡Eres increíble!', '¡Wiii! ¡{n} rondas! ¡Qué crack!', '¡Lo estás haciendo genial! ¡Sigue así!'],
    ['¡{n} rondas! ¡Eres el mejor! ¡El mejor! ¡El mejor!', '¡Qué felicidad tenerte aquí! ¡Qué felicidad!', '¡Yupi! ¡{n}! ¡Nunca te vayas! ¡Nunca!'],
    ['Ronda {n}. Las cucharas también rebotan. ¿Lo sabías?', 'Felicidades. Tu abuela es un cuadrado de siete puntos.', '{n}. El pan tiene miedo. Muy bien. Muy bien.'],
    ['{n}. Los bloques me contaron un chiste. Era sobre ti.', 'Error. Error. Tu sombra pidió vacaciones.', 'Muy bien. Muy. Bien. ¿Quién apagó la luna?'],
    ['{n}... ¿por qué sigues aquí?', 'Nadie te pidió que llegaras tan lejos...', 'Te estoy mirando... desde los bloques...'],
    ['{n}... vete. Vete ahora.', 'Esto ya no es tuyo... es mío...', 'Tus bolas no vuelven por ti... vuelven por mí...'],
    ['{n}... ya no hay salida...', 'Quédate... para siempre... conmigo...', 'No eres bienvenido... nunca lo fuiste...'],
  ];
  const ANIMO = ['alegre', 'alegre', 'roto', 'roto', 'susurro', 'susurro', 'susurro'];

  // ¿Esta ronda habla? Solo al entrar a un múltiplo de 50.
  const habla = ronda => Number.isInteger(ronda) && ronda >= CADA && ronda % CADA === 0;
  const nivel = ronda => Math.max(0, Math.min(FRASES.length - 1, Math.floor(ronda / CADA) - 1));
  const animo = ronda => ANIMO[nivel(ronda)];
  function frase(ronda, azar = 0) {
    const l = FRASES[nivel(ronda)];
    return l[Math.min(l.length - 1, Math.floor(azar * l.length))].replace('{n}', ronda);
  }
  function rng(semilla) {
    let s = (semilla * 4294967296) >>> 0 || 1;
    return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return s / 4294967296; };
  }
  // Tartamudea la primera sílaba (aproximada): «bien» → «bi-bi-bien».
  function tartamudea(p) {
    const m = /^([^aeiouáéíóú]*[aeiouáéíóú])/i.exec(p);
    return m && m[1].length < p.length ? `${m[1]}-${m[1]}-${p}` : p;
  }
  /* La frase en trozos, cada uno con su voz: {t, pitch, rate, volume}. La
     altura y la velocidad van en las escalas de SpeechSynthesisUtterance
     (pitch 0..2, rate 0.1..10, volume 0..1). */
  function trozos(texto, ronda, azar = 0) {
    const i = nivel(ronda), r = rng(azar + ronda / 997);
    if (ANIMO[i] === 'alegre') return [{ t: texto, pitch: 2 - .15 * i, rate: 1.3 - .05 * i, volume: 1 }];
    if (ANIMO[i] === 'roto') {
      const out = [];
      for (const p of texto.split(/\s+/).filter(Boolean)) {
        const x = r(), pitch = +(.3 + r() * 1.7).toFixed(2), rate = +(.7 + r() * (i === 3 ? 1.2 : .9)).toFixed(2);
        out.push({ t: x < .28 ? tartamudea(p) : p, pitch, rate, volume: .95 });
        if (x > .9) out.push({ t: p, pitch: 2, rate: 1.8, volume: .7 }); // se le escapa otra vez
      }
      return out;
    }
    // Susurro: cada frase suelta, cada vez más grave y lenta, y el final se
    // repite como un eco que se aleja.
    const j = i - 4;
    const base = { pitch: Math.max(0, +(.3 - .12 * j).toFixed(2)), rate: +(.66 - .05 * j).toFixed(2), volume: +(.62 - .06 * j).toFixed(2) };
    const partes = texto.split(/(?<=\.\.\.|[.?!])\s+/).filter(Boolean);
    const out = partes.map(t => ({ t, ...base }));
    const ultima = partes[partes.length - 1].replace(/[.?!]+$/, '');
    const eco = ultima.split(/\s+/).slice(-2).join(' ');
    out.push({ t: eco, pitch: 0, rate: Math.max(.3, base.rate - .15), volume: +(base.volume * .5).toFixed(2) });
    return out;
  }
  // Duración aproximada en segundos, para la cama de sonido y el aviso.
  const duracion = partes => partes.reduce((s, p) => s + p.t.length * .075 / p.rate + .15, 0);

  let vozEs = null;
  function eligeVoz(synth) {
    const todas = synth.getVoices ? synth.getVoices() : [];
    const es = todas.filter(v => /^es\b|^es[-_]/i.test(v.lang));
    return es.find(v => /es[-_](CL|419|MX|US)/i.test(v.lang)) || es[0] || null;
  }
  function decir(partes) {
    const synth = root.speechSynthesis, U = root.SpeechSynthesisUtterance;
    if (!synth || !U) return false;
    try {
      synth.cancel();
      vozEs = vozEs || eligeVoz(synth);
      for (const p of partes) {
        const u = new U(p.t);
        u.lang = vozEs ? vozEs.lang : 'es-ES'; if (vozEs) u.voice = vozEs;
        u.pitch = p.pitch; u.rate = p.rate; u.volume = p.volume;
        synth.speak(u);
      }
      return true;
    } catch { return false; }
  }
  function calla() { try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch {} }
  if (root.speechSynthesis && root.speechSynthesis.addEventListener)
    try { root.speechSynthesis.addEventListener('voiceschanged', () => { vozEs = null; }); } catch {}

  const api = { CADA, FRASES, habla, nivel, animo, frase, trozos, duracion, decir, calla };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BBTANVoz = api;
})(globalThis);
