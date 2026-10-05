/* Vía Libre — el sonido (música y efectos).

   QUÉ HACE, EN GLOBAL
   - La MÚSICA: cada estación tiene su tema en el cancionero común
     (juegos/audio/temas.js: "vialibre-barrio", "vialibre-ocaso"…) y lo toca
     Chip.Reproductor, el mismo motor chiptune de toda la sala de juegos. El
     tempo sube con la velocidad de la carrera (más rápido = más apuro) y al
     cambiar de estación el tema se cambia con un fundido.
   - Los EFECTOS: todos sintetizados aquí, sin archivos (moneda, salto,
     rodada, cambio de carril, choque, tropiezo, poderes, mochila cohete,
     túnel, boleto, reto cumplido…). La moneda sube de tono si encadenas
     varias seguidas, como una escala, porque eso es lo que da ganas de
     juntar la fila entera.

   POR QUÉ ASÍ
   - El AudioContext se crea con el primer gesto (un navegador no deja antes).
   - Todo sale por `destination`, que juegos/audio/volumen.js ya convirtió
     en el control de volumen y silencio de la sala: el juego no sabe nada
     del volumen general y aun así lo respeta.
   - Música y efectos tienen cada uno su ganancia, para que Opciones pueda
     bajar uno sin el otro, y el botón ♪ / la tecla M silencian los dos. */
const Chip = window.Chip;                      // el motor chiptune (juegos/audio/chip.js)
const Temas = window.Temas;                    // el cancionero (juegos/audio/temas.js)

export class Sonido {
  constructor() {
    this.ctx = null;                           // se crea con el primer gesto
    this.mudo = false;                         // el botón ♪ / la tecla M
    this.volMusica = 0.8; this.volEfectos = 0.9;
    this.rep = null; this.tema = null;         // la canción que suena y su nombre
    this.racha = 0; this.ultMoneda = 0;        // para que las monedas seguidas suban de tono
    this.voces = new Set();                    // las notas vivas (para poder callarlas)
    this.motor = null;                         // el ruido continuo de la mochila cohete
  }
  /** Crea el contexto de audio (llamar dentro de un gesto: tecla, toque, clic). */
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                                           // sin audio: el juego sigue igual, mudo
    this.ctx = new AC();
    this.salida = this.ctx.createGain(); this.salida.gain.value = this.mudo ? 0 : 1; this.salida.connect(this.ctx.destination);
    this.musica = this.ctx.createGain(); this.musica.gain.value = this.volMusica; this.musica.connect(this.salida);
    this.efectos = this.ctx.createGain(); this.efectos.gain.value = this.volEfectos; this.efectos.connect(this.salida);
    if (this.temaPendiente) this.tocaTema(this.temaPendiente);
  }
  /** Silencia o devuelve todo el sonido del juego. */
  ponMudo(m) {
    this.mudo = !!m;
    if (this.salida) this.salida.gain.setTargetAtTime(this.mudo ? 0 : 1, this.ctx.currentTime, 0.03);
  }
  /** Volumen de la música y de los efectos (0 a 1), desde Opciones. */
  volumenes(musica, efectos) {
    this.volMusica = musica; this.volEfectos = efectos;
    if (!this.ctx) return;
    this.musica.gain.setTargetAtTime(musica, this.ctx.currentTime, 0.05);
    this.efectos.gain.setTargetAtTime(efectos, this.ctx.currentTime, 0.05);
  }

  /* ---------- música ---------- */

  /** Cambia el tema (con un fundido corto). `id` es la clave en el cancionero. */
  tocaTema(id) {
    if (!this.ctx) { this.temaPendiente = id; return; }        // todavía no hubo gesto: se toca después
    this.temaPendiente = null;
    if (id === this.tema && this.rep) return;
    const cancion = Temas && Temas.temas[id];
    const viejo = this.rep, viejoGain = this.capaRep;
    if (viejo) {                                               // el tema viejo se apaga en medio segundo
      const t = this.ctx.currentTime;
      viejoGain.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => { try { viejo.destruir(); viejoGain.disconnect(); } catch (e) {} }, 900);
    }
    this.rep = null; this.tema = id;
    if (!cancion || !Chip || !Chip.Reproductor) return;
    this.capaRep = this.ctx.createGain(); this.capaRep.gain.value = 0; this.capaRep.connect(this.musica);
    this.capaRep.gain.setTargetAtTime(1, this.ctx.currentTime, 0.25);
    this.rep = new Chip.Reproductor(this.ctx, this.capaRep, cancion);
  }
  /** Calla la música (en la pausa y en el fin). */
  calla() {
    if (!this.rep) return;
    try { this.rep.destruir(); this.capaRep.disconnect(); } catch (e) {}
    this.rep = null; this.tema = null;
  }
  /** Llamar en cada cuadro: agenda las notas que vienen y ajusta el tempo a la velocidad. */
  tick(velocidad, capas) {
    if (!this.ctx || !this.rep) return;
    // de 13 m/s (×0,92) a 30 m/s (×1,15): el apuro se oye
    this.rep.tempo = 0.92 + 0.23 * Math.max(0, Math.min(1, ((velocidad || 13) - 13) / 17));
    if (capas) Object.assign(this.rep.capas, capas);
    this.rep.tick(0.25);
  }

  /* ---------- efectos ---------- */

  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  /** Una nota corta de chip (frecuencia en Hz). */
  nota(f, dur, vol, onda = 'p25', extra) {
    if (!this.ctx || !Chip) return;
    Chip.voz(this.ctx, this.efectos, Object.assign({ t: this.t, f, dur, vol, onda, sus: 0.6 }, extra), this.voces);
  }
  /** Un golpe de ruido (tono = velocidad de lectura: más alto, más agudo). */
  soplo(dur, vol, tono = 1, extra) {
    if (!this.ctx || !Chip) return;
    Chip.ruido(this.ctx, this.efectos, Object.assign({ t: this.t, dur, vol, tono }, extra), this.voces);
  }
  /** Una moneda: dos notitas que suben, y cada moneda seguida un semitono más (hasta una octava). */
  moneda() {
    if (!this.ctx) return;
    const ahora = this.t;
    this.racha = ahora - this.ultMoneda < 0.5 ? Math.min(12, this.racha + 1) : 0;
    this.ultMoneda = ahora;
    const f = 988 * Math.pow(2, this.racha / 12);              // Si5, subiendo
    this.nota(f, 0.05, 0.07, 'p25');
    Chip.voz(this.ctx, this.efectos, { t: ahora + 0.05, f: f * 1.335, dur: 0.12, vol: 0.07, onda: 'p25', sus: 0.5 }, this.voces);
  }
  salto() { this.nota(320, 0.16, 0.08, 'p12', { f1: 760 }); this.soplo(0.12, 0.05, 2.2); }
  saltoAlto() { this.nota(260, 0.3, 0.09, 'p12', { f1: 1200 }); this.soplo(0.2, 0.06, 2.6); }
  aterriza() { this.soplo(0.06, 0.05, 0.6); }
  rodar() { this.soplo(0.28, 0.07, 0.8, { tono1: 0.35 }); }
  carril() { this.soplo(0.07, 0.035, 2.8, { tono1: 1.6 }); }
  /** El choque: un golpe grave, un estallido de ruido y un chirrido metálico. */
  choque() {
    if (!this.ctx) return;
    this.nota(140, 0.45, 0.22, 'tri', { f1: 38, sus: 0.8 });
    this.soplo(0.5, 0.2, 0.7, { tono1: 0.2 });
    this.soplo(0.35, 0.08, 3.5, { corto: true });
  }
  tropiezo() { this.nota(180, 0.18, 0.14, 'tri', { f1: 90 }); this.soplo(0.12, 0.08, 1.2); }
  /** Un poder: un arpegio que sube (Do Mi Sol Do). */
  poder() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => Chip.voz(this.ctx, this.efectos, { t: this.t + i * 0.06, f, dur: 0.12, vol: 0.07, onda: 'p25', sus: 0.6 }, this.voces));
  }
  /** Una estrella (+1 al multiplicador): un brillo agudo con eco. */
  estrella() {
    if (!this.ctx) return;
    [1319, 1760, 2093, 2637].forEach((f, i) => Chip.voz(this.ctx, this.efectos, { t: this.t + i * 0.045, f, dur: 0.18, vol: 0.05, onda: 'p12', sus: 0.4 }, this.voces));
  }
  /** El boleto dorado: una fanfarria corta. */
  boleto() {
    if (!this.ctx) return;
    const t = this.t, notas = [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3], [1047, 0.45]];
    for (const [f, d] of notas) Chip.voz(this.ctx, this.efectos, { t: t + d, f, dur: d === 0.45 ? 0.5 : 0.12, vol: 0.08, onda: 'p25', sus: 0.7 }, this.voces);
    Chip.voz(this.ctx, this.efectos, { t: t + 0.45, f: 659, dur: 0.5, vol: 0.05, onda: 'tri' }, this.voces);
    Chip.voz(this.ctx, this.efectos, { t: t + 0.45, f: 784, dur: 0.5, vol: 0.05, onda: 'tri' }, this.voces);
  }
  reto() {
    if (!this.ctx) return;
    [784, 988, 1175].forEach((f, i) => Chip.voz(this.ctx, this.efectos, { t: this.t + i * 0.09, f, dur: 0.14, vol: 0.07, onda: 'p50', sus: 0.6 }, this.voces));
  }
  /** Subió el multiplicador: la fanfarria grande. */
  multiplicador() {
    if (!this.ctx) return;
    const t = this.t;
    [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [1047, 0.5], [1319, 0.62]].forEach(([f, d]) => Chip.voz(this.ctx, this.efectos, { t: t + d, f, dur: 0.18, vol: 0.08, onda: 'p25' }, this.voces));
    Chip.voz(this.ctx, this.efectos, { t: t + 0.62, f: 523, f1: 1047, dur: 0.6, vol: 0.05, onda: 'saw' }, this.voces);
  }
  caja() { this.soplo(0.08, 0.08, 1.8); this.nota(659, 0.1, 0.06, 'p25'); setTimeout(() => this.moneda(), 90); }
  patineta() { this.nota(220, 0.35, 0.08, 'saw', { f1: 880 }); this.soplo(0.3, 0.05, 1.6); }
  rompePatineta() { this.soplo(0.25, 0.14, 1.4, { corto: true }); this.nota(300, 0.2, 0.1, 'tri', { f1: 80 }); }
  seguir() { this.multiplicador(); }
  record() { this.boleto(); }
  /** Entrar al túnel: un retumbo grave que se va apagando. */
  tunel() {
    if (!this.ctx) return;
    this.soplo(1.6, 0.09, 0.3, { tono1: 0.15 });
    this.nota(55, 1.4, 0.08, 'tri', { f1: 40 });
  }
  /** La mochila cohete suena mientras dura (un soplido continuo). */
  mochila(encendida) {
    if (!this.ctx) return;
    if (encendida && !this.motor) {
      const r = Chip.ruido(this.ctx, this.efectos, { t: this.t, dur: 60, vol: 0.05, tono: 0.5 }, this.voces);
      this.motor = r;
    } else if (!encendida && this.motor) {
      try { this.motor.stop(this.t + 0.05); } catch (e) {}
      this.motor = null;
    }
  }
  /** Calla todos los efectos que estén sonando. */
  callaEfectos() {
    for (const v of this.voces) { try { v.fuente.stop(0); } catch (e) {} }
    this.voces.clear(); this.motor = null;
  }
}
