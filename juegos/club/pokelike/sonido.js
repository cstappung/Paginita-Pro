/* Pokelike — efectos de sonido sintetizados (sin archivos). El volumen y el
   silencio los pone audio/volumen.js, que envuelve todo AudioContext creado
   después de cargarse; por eso el contexto se crea recién al primer sonido. */
(function () {
  let ctx = null;
  const ac = () => {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tono(frecs, { dur = 0.1, tipo = 'square', vol = 0.08, paso = dur } = {}) {
    const c = ac(); if (!c) return;
    frecs.forEach((f, i) => {
      const t = c.currentTime + i * paso, o = c.createOscillator(), g = c.createGain();
      o.type = tipo; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  }
  function ruido(dur = 0.15, vol = 0.12) {
    const c = ac(); if (!c) return;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); // solo sonido, no juego
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(c.destination); s.start();
  }
  window.PokelikeSonido = {
    clic: () => tono([660], { dur: 0.05, vol: 0.05 }),
    golpe: () => ruido(0.12, 0.14),
    superEficaz: () => { ruido(0.2, 0.18); tono([220, 330], { dur: 0.08, vol: 0.06 }); },
    flojo: () => ruido(0.08, 0.07),
    cae: () => tono([440, 330, 220, 147], { dur: 0.12, tipo: 'triangle', vol: 0.1 }),
    nivel: () => tono([523, 659, 784, 1047], { dur: 0.09, vol: 0.06 }),
    evoluciona: () => tono([392, 523, 659, 784, 1047, 1319], { dur: 0.14, tipo: 'triangle', vol: 0.1 }),
    victoria: () => tono([523, 523, 523, 698, 880, 784, 698, 880], { dur: 0.13, vol: 0.07 }),
    derrota: () => tono([392, 370, 349, 330], { dur: 0.25, tipo: 'triangle', vol: 0.1 }),
    cura: () => tono([659, 784, 988, 1319], { dur: 0.15, tipo: 'sine', vol: 0.12 }),
  };
})();
