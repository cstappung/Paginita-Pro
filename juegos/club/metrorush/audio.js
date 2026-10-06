/* Metro Rush — el sonido (música y efectos).

   QUÉ HACE, EN GLOBAL
   - La MÚSICA: cada estación tiene su tema en el cancionero común
     (juegos/audio/temas.js: "metrorush-barrio", "metrorush-ocaso"…) y lo toca
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
// la curva de velocidad del motor (motor.js se carga antes como script): de aquí sale el tempo, sin números escritos a mano
const VEL = (window.MetroRushMotor && window.MetroRushMotor.VELOCIDAD) || { V0: 15, VMAX: 50 };

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
    // de V0 (×0,92) a VMAX (×1,15), con la curva del motor: el apuro se oye. Ejemplo: a 32,5 m/s, ×1,035
    const k = ((velocidad || VEL.V0) - VEL.V0) / (VEL.VMAX - VEL.V0);
    this.rep.tempo = 0.92 + 0.23 * Math.max(0, Math.min(1, k));
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
  /** Tocar el suelo. `v` = la velocidad de caída (m/s): desde 14 (bajar de
      la mochila, o rodar en el aire) suma un golpe grave, más fuerte mientras
      más rápido cae. Un salto normal cae a ~10 m/s y suena como siempre. */
  aterriza(v = 0) {
    this.soplo(0.06, 0.05, 0.6);
    if (v > 14) { const k = Math.min(1, (v - 14) / 12); this.nota(120, 0.22, 0.08 + 0.1 * k, 'tri', { f1: 42 }); this.soplo(0.14, 0.04 + 0.05 * k, 0.5); }
  }
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
  /** El pogo: un «boing» de resorte (sube y vuelve a subir, como un muelle) y un soplo hacia arriba. */
  pogo() {
    this.nota(140, 0.12, 0.1, 'tri', { f1: 520 });
    setTimeout(() => this.nota(220, 0.32, 0.09, 'p25', { f1: 1400 }), 70);
    this.soplo(0.35, 0.05, 2.4, { tono1: 3.2 });
  }
  patineta() { this.nota(220, 0.35, 0.08, 'saw', { f1: 880 }); this.soplo(0.3, 0.05, 1.6); }
  rompePatineta() { this.soplo(0.25, 0.14, 1.4, { corto: true }); this.nota(300, 0.2, 0.1, 'tri', { f1: 80 }); }
  seguir() { this.multiplicador(); }
  /** El tic de la cuenta regresiva de «¿Seguir corriendo?» (el último segundo, más agudo). */
  tic(ultimo) { this.nota(ultimo ? 1568 : 1046, 0.06, 0.07, 'p50'); }
  /** Un tic suave mientras suben los puntos del resumen (sube de tono con la cuenta, k de 0 a 1). */
  sube(k) { this.nota(660 + 660 * k, 0.03, 0.03, 'p25'); }
  record() { this.boleto(); }
  /** Entrar al túnel: un retumbo grave que se va apagando. */
  tunel() {
    if (!this.ctx) return;
    this.soplo(1.6, 0.09, 0.3, { tono1: 0.15 });
    this.nota(55, 1.4, 0.08, 'tri', { f1: 40 });
  }
  /** Un búfer de ruido blanco de 2 s, hecho una vez y reusado (la mochila,
      los soplidos y el aire de la bocina). Lo hace un generador propio para
      no gastar el Math.random del juego. */
  ruidoBlanco() {
    if (this._ruido) return this._ruido;
    const n = Math.floor(this.ctx.sampleRate * 2), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), a = b.getChannelData(0);
    let s = 0x9E3779B9;
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = s / 2147483648 - 1; }   // de −1 a 1
    return (this._ruido = b);
  }
  /** Guarda unos nodos entre las voces vivas (para que callaEfectos los pueda
      parar) y los suelta solos cuando la fuente termina. */
  vive(fuente, nodos) {
    const v = { fuente, nodos };
    this.voces.add(v);
    fuente.onended = () => { this.voces.delete(v); for (const n of nodos) { try { n.disconnect(); } catch (e) {} } };
  }
  /** Un soplido de viento: ruido por un filtro de banda que barre de f0 a f1
      Hz en `dur` segundos. Ejemplo: de 300 a 2600 Hz es un «¡fuuum!» que sube. */
  barrido(dur, vol, f0, f1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.ruidoBlanco();
    f.type = 'bandpass'; f.Q.value = 1.3;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.efectos);
    s.start(t); s.stop(t + dur + 0.02);
    this.vive(s, [s, f, g]);
  }
  /** El despegue de la mochila: un soplido que sube y un golpe grave. */
  despega() {
    if (!this.ctx) return;
    this.barrido(0.42, 0.16, 280, 2800);
    this.nota(96, 0.38, 0.2, 'sine', { f1: 36, sus: 0.75 });
    this.soplo(0.25, 0.07, 1.4, { tono1: 2.6 });
  }
  /** Se acaba la mochila: un soplido que baja y el motor que tose dos veces
      (el golpe del suelo lo pone `aterriza`, cuando de verdad toca el suelo). */
  cortaMochila() {
    if (!this.ctx) return;
    this.barrido(0.36, 0.1, 2200, 240);
    this.nota(70, 0.1, 0.07, 'saw', { f1: 40 });
    Chip.voz(this.ctx, this.efectos, { t: this.t + 0.13, f: 62, f1: 36, dur: 0.12, vol: 0.06, onda: 'saw' }, this.voces);
  }
  /** La mochila cohete ruge mientras dura. Son tres capas que suenan solas,
      sin que el juego tenga que tocar nada en cada cuadro:
      - el rugido: ruido por un filtro de banda cuyo centro tiembla 11 veces
        por segundo (el aleteo de la llama);
      - el retumbo: el mismo ruido por un filtro de graves;
      - el motor: una onda de sierra grave que se mece.
      Todo pasa por una ganancia propia (para encenderla de golpe y apagarla
      suave) y de ahí a los efectos, así que el volumen de la sala la manda. */
  mochila(encendida) {
    if (!this.ctx) return;
    if (encendida && !this.motor) {
      const ctx = this.ctx, t = this.t;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t); master.gain.exponentialRampToValueAtTime(1, t + 0.07);   // se enciende de golpe
      master.connect(this.efectos);
      const ruido = ctx.createBufferSource(); ruido.buffer = this.ruidoBlanco(); ruido.loop = true;
      const banda = ctx.createBiquadFilter(); banda.type = 'bandpass'; banda.frequency.value = 850; banda.Q.value = 0.9;
      const gB = ctx.createGain(); gB.gain.value = 0.11;
      const aleteo = ctx.createOscillator(); aleteo.frequency.value = 11;
      const gA = ctx.createGain(); gA.gain.value = 260;                      // ±260 Hz alrededor de los 850
      aleteo.connect(gA); gA.connect(banda.frequency);
      ruido.connect(banda); banda.connect(gB); gB.connect(master);
      const grave = ctx.createBiquadFilter(); grave.type = 'lowpass'; grave.frequency.value = 160;
      const gG = ctx.createGain(); gG.gain.value = 0.22;
      ruido.connect(grave); grave.connect(gG); gG.connect(master);
      const sierra = ctx.createOscillator(); sierra.type = 'sawtooth'; sierra.frequency.value = 52;
      const meceo = ctx.createOscillator(); meceo.frequency.value = 6.5;
      const gM = ctx.createGain(); gM.gain.value = 4;                        // ±4 Hz: el motor que vibra
      meceo.connect(gM); gM.connect(sierra.frequency);
      const pasa = ctx.createBiquadFilter(); pasa.type = 'lowpass'; pasa.frequency.value = 420;
      const gS = ctx.createGain(); gS.gain.value = 0.05;
      sierra.connect(pasa); pasa.connect(gS); gS.connect(master);
      const fuentes = [ruido, aleteo, sierra, meceo];
      for (const f of fuentes) f.start(t);
      this.motor = { master, fuentes, nodos: [banda, gB, gA, grave, gG, gM, pasa, gS, master] };
    } else if (!encendida && this.motor) {
      const m = this.motor, t = this.t, g = m.master.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.exponentialRampToValueAtTime(0.0001, t + 0.15);   // se apaga en 0,15 s
      for (const f of m.fuentes) { try { f.stop(t + 0.2); } catch (e) {} }
      m.fuentes[0].onended = () => { for (const n of [...m.fuentes, ...m.nodos]) { try { n.disconnect(); } catch (e) {} } };
      this.motor = null;
    }
  }
  /** La bocina de un tren que viene de frente: tres sierras en La menor (suena
      a advertencia), que entran un poco bajas y afinan en 70 ms, como el aire
      de una bocina de verdad, por un filtro que les quita lo chillón.
      fuerza 1: un bocinazo largo (viene por tu carril);
      fuerza 2: dos toques cortos y urgentes (ya casi llega);
      fuerza 0: uno corto y bajito (viene por el carril de al lado).
      `pan`: de −1 (a tu izquierda) a 1 (a tu derecha). */
  bocina(fuerza, pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = this.t;
    const golpes = fuerza === 2 ? [[0, 0.16], [0.24, 0.2]] : [[0, fuerza === 1 ? 0.8 : 0.42]];   // [cuándo, cuánto dura]
    const vol = fuerza === 0 ? 0.035 : fuerza === 2 ? 0.1 : 0.085;
    const lado = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (lado.pan) lado.pan.value = Math.max(-1, Math.min(1, pan));
    const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = fuerza === 0 ? 1100 : 2000; filtro.Q.value = 1.5;
    filtro.connect(lado); lado.connect(this.efectos);
    const comunes = [filtro, lado];
    golpes.forEach(([d, dur], gi) => {
      const t = t0 + d, g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.035);
      g.gain.setValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
      g.connect(filtro);
      [220, 262, 330].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.96, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
        o.detune.value = (i - 1) * 6;                                        // un poquito desafinadas entre sí: más ancha
        o.connect(g); o.start(t); o.stop(t + dur + 0.14);
        // la última nota del último golpe suelta también lo común (el filtro y el paneo)
        const ultima = gi === golpes.length - 1 && i === 2;
        this.vive(o, ultima ? [o, g, ...comunes] : i === 2 ? [o, g] : [o]);
      });
    });
    // el aire: un soplo corto al empezar cada bocinazo
    if (fuerza !== 0) Chip.ruido(ctx, filtro, { t: t0, dur: 0.12, vol: vol * 0.5, tono: 1.8 }, this.voces);
  }
  /** Calla todos los efectos que estén sonando. */
  callaEfectos() {
    if (this.motor) this.mochila(false);
    for (const v of this.voces) { try { v.fuente.stop(0); } catch (e) {} }
    this.voces.clear(); this.motor = null;
  }
}
