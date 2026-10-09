/* Metro Rush — el sonido (música y efectos).

   QUÉ HACE, EN GLOBAL
   - La MÚSICA: cada estación tiene una LISTA de temas del cancionero común
     (juegos/audio/temas.js: "metrorush-barrio", "metrorush-barrio-2"…) y
     los toca Chip.Reproductor, el mismo motor chiptune de toda la sala de
     juegos. Cuando el que suena ha dado sus vueltas, entra el siguiente de
     la lista justo en el borde del compás (ver `LISTAS` y `rota`), así que
     una carrera larga no repite la misma tonada. El tempo sube con la
     velocidad de la carrera (más rápido = más apuro) y al cambiar de
     estación la lista se cambia con un fundido.
   - Los EFECTOS: todos sintetizados aquí, sin archivos (moneda, salto,
     rodada, cambio de carril, choque, tropiezo, poderes, mochila cohete,
     túnel, boleto, reto cumplido…). La moneda sube de tono si encadenas
     varias seguidas, como una escala, porque eso es lo que da ganas de
     juntar la fila entera.
   - La VOZ del altavoz del andén: cada anuncio de historia.js (ANUNCIOS)
     tiene su grabación en assets/voz/<estación>-<proxima|eco>.mp3, hecha
     una vez con colabtex/scripts/metrorush-voz.py. `anuncio(txt)` la toca
     justo después del ding-dong, con la música agachada mientras habla.

   POR QUÉ ASÍ
   - El AudioContext se crea con el primer gesto (un navegador no deja antes).
   - Todo sale por `destination`, que juegos/audio/volumen.js ya convirtió
     en el control de volumen y silencio de la sala: el juego no sabe nada
     del volumen general y aun así lo respeta.
   - Música y efectos tienen cada uno su ganancia, para que Opciones pueda
     bajar uno sin el otro, y el botón ♪ / la tecla M silencian los dos.
   - La voz es GRABADA y no del navegador (speechSynthesis no existe en
     muchos celulares y en cada PC suena distinto), como la de BBTAN. Va por
     los efectos: el volumen de efectos, el mudo y volumen.js la gobiernan.
     Si el archivo no está (sin red, o sin grabar todavía) no pasa nada: el
     anuncio se lee igual en la franja, solo que callado. */
const Chip = window.Chip;                      // el motor chiptune (juegos/audio/chip.js)
const Temas = window.Temas;                    // el cancionero (juegos/audio/temas.js)
// la curva de velocidad del motor (motor.js se carga antes como script): de aquí sale el tempo, sin números escritos a mano
let VEL = (window.MetroRushMotor && window.MetroRushMotor.VELOCIDAD) || { V0: 15, VMAX: 50 };   // CITY: `curva` la cambia (City tiene su propia curva)

/* Las listas de cada sitio, por su id: las diez estaciones de motor.js
   (ESTACIONES[].id) y los cinco barrios de Subway City. El primer tema de
   cada estación es el de siempre (el que motor.js nombra en `musica`), y
   los otros dos son del mismo humor. Los barrios tienen un tema propio y
   toman prestados dos de estación que se le parecen, para rotar igual. */
export const LISTAS = {
  barrio: ['metrorush-barrio', 'metrorush-barrio-2', 'metrorush-barrio-3'],
  ocaso: ['metrorush-ocaso', 'metrorush-ocaso-2', 'metrorush-ocaso-3'],
  neon: ['metrorush-neon', 'metrorush-neon-2', 'metrorush-neon-3'],
  fantasma: ['metrorush-fantasma', 'metrorush-fantasma-2', 'metrorush-fantasma-3'],
  invierno: ['metrorush-invierno', 'metrorush-invierno-2', 'metrorush-invierno-3'],
  oxido: ['metrorush-oxido', 'metrorush-oxido-2', 'metrorush-oxido-3'],
  fin: ['metrorush-fin', 'metrorush-fin-2', 'metrorush-fin-3'],
  // las tres estaciones nuevas: su tema propio y dos prestados del mismo humor
  mercado: ['metrorush-mercado', 'metrorush-barrio-3', 'metrorush-ocaso-2'],        // fiesta de feria: el barrio y el atardecer
  cocheras: ['metrorush-cocheras', 'metrorush-oxido-2', 'metrorush-fantasma-3'],    // patio de maniobras de noche: lo industrial y lo vacío
  muelle: ['metrorush-muelle', 'metrorush-neon-3', 'metrorush-fantasma-2'],         // puerto con lluvia: el neón y la estación fantasma
  'city-sur': ['metrorush-city-sur', 'metrorush-barrio-2', 'metrorush-barrio-3'],            // soleado: el barrio
  'city-muelles': ['metrorush-city-muelles', 'metrorush-oxido-3', 'metrorush-oxido-2'],      // industrial: el óxido
  'city-bulevar': ['metrorush-city-bulevar', 'metrorush-neon-2', 'metrorush-neon-3'],        // de noche: el neón
  'city-parque': ['metrorush-city-parque', 'metrorush-invierno-3', 'metrorush-barrio-3'],    // juguetón y tranquilo
  'city-bajo': ['metrorush-city-bajo', 'metrorush-fantasma-2', 'metrorush-oxido-2']          // oscuro: el fantasma
};
/* Cuándo pasar al siguiente tema. Solo se mira al terminar una vuelta del
   tema (el final de su `orden`, que siempre cae en borde de compás):
   - con VUELTAS_TEMA vueltas y al menos SEG_MIN segundos sonando, se cambia
     (dos vueltas de un tema son entre 55 y 100 s a velocidad de carrera);
   - con SEG_MAX segundos se cambia aunque falten vueltas. */
const VUELTAS_TEMA = 2, SEG_MIN = 50, SEG_MAX = 110;

/** La lista que corresponde a `id`, que puede ser el id de una estación
    ("barrio"), el de un barrio de Subway City ("city-sur") o la clave de un
    tema ("metrorush-barrio", la que motor.js guarda en `musica`). Un tema
    que encabeza una lista trae esa lista; uno suelto (o desconocido) es una
    lista de uno, que se repite como antes. Devuelve {clave, temas}. */
export function listaDe(id) {
  if (LISTAS[id]) return { clave: id, temas: LISTAS[id] };                   // id de estación o de barrio
  for (const k in LISTAS) if (LISTAS[k][0] === id) return { clave: k, temas: LISTAS[k] };   // el tema de cabecera de una estación
  return { clave: id, temas: [id] };                                         // un tema suelto: se repite solo
}

/* ---------- la voz del altavoz ----------
   Los textos están en historia.js (window.MetroRushHistoria.ANUNCIOS) y la
   grabación de cada uno se llama como su estación y cuál de los dos es:
   «barrio-proxima», «barrio-eco»… Se busca por el TEXTO que juego.js
   muestra, así juego.js no tiene que saber de archivos: un texto que no
   está en ANUNCIOS (el de las vueltas, «Otra vuelta…») no tiene voz. */
const VOZ_TRAS_DING = 1.1;                     // segundos desde el ding-dong hasta la voz (la segunda campana suena a los 0,45 s y se apaga)
const VOZ_TARDE = 3;                           // si la grabación llega más de 3 s después de pedirla, ya no se dice (la franja casi se fue)
const VOZ_VOL = 0.7;                           // la voz sobre los efectos: se normalizó en el script, aquí solo se acomoda a los demás sonidos
const VOZ_AGACHA = 0.45;                       // a cuánto baja la música mientras habla el altavoz (1 = no baja)
const CUALES = ['proxima', 'eco'];             // los dos anuncios de cada estación, en el orden en que se oyen
/** Los anuncios de historia.js, o null si no se cargó (en City igual existen; juego.js decide si habla). */
const anuncios = () => (typeof window !== 'undefined' && window.MetroRushHistoria && window.MetroRushHistoria.ANUNCIOS) || null;
/** El nombre de la grabación de un anuncio, por su texto: 'barrio-proxima', 'oxido-eco'… null si no tiene. */
export function vozDe(txt) {
  const A = anuncios();
  if (!A || !txt) return null;
  for (const id in A) for (const cual of CUALES) if (A[id] && A[id][cual] === txt) return id + '-' + cual;
  return null;
}
/** La grabación que se oirá después de `nombre`: tras el «próxima» de una
    estación viene su eco, y tras el eco el «próxima» de la siguiente (las
    estaciones de ANUNCIOS van en el orden del recorrido). null al final. */
export function vozSiguiente(nombre) {
  const A = anuncios();
  if (!A || !nombre) return null;
  const [id, cual] = nombre.split('-'), ids = Object.keys(A), i = ids.indexOf(id);
  if (i < 0) return null;
  if (cual === 'proxima') return id + '-eco';                              // la misma estación, a mitad de camino
  return i + 1 < ids.length ? ids[i + 1] + '-proxima' : null;               // el túnel de la que sigue
}
/** La dirección del MP3, al lado de este módulo, con su mismo `?v=`: una
    grabación nueva llega con el próximo cambio de versión, sin caché vieja. */
function urlVoz(nombre) {
  const aqui = new URL(import.meta.url);                                   // audio.js?v=metrorush-N
  const u = new URL('assets/voz/' + nombre + '.mp3', aqui);
  u.search = aqui.search;                                                  // el mismo ?v= que el módulo
  return u.href;
}

export class Sonido {
  constructor() {
    this.ctx = null;                           // se crea con el primer gesto
    this.mudo = false;                         // el botón ♪ / la tecla M
    this.volMusica = 0.8; this.volEfectos = 0.9;
    this.rep = null; this.tema = null;         // la canción que suena y su clave en el cancionero
    this.lista = null;                         // la lista que suena: {clave, temas} (ver listaDe)
    this.pos = {};                             // por clave de lista, el índice del tema que toca (se recuerda entre pausas y carreras)
    this.racha = 0; this.ultMoneda = 0;        // para que las monedas seguidas suban de tono
    this.voces = new Set();                    // las notas vivas (para poder callarlas)
    this.motor = null;                         // el ruido continuo de la mochila cohete
    this.vozBufs = new Map();                  // las grabaciones del altavoz: nombre → promesa del AudioBuffer (o null si no se pudo)
    this.vozSeq = 0;                           // sube con cada anuncio y con cada «calla»: una grabación que llega tarde mira si sigue siendo la suya
    this.vozActual = null;                     // la fuente que está hablando ahora (para cortarla en la pausa o con otro anuncio)
    this.dingT = -9;                           // cuándo sonó el último ding-dong (la voz espera a que termine)
  }
  /** Crea el contexto de audio (llamar dentro de un gesto: tecla, toque, clic). */
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                                           // sin audio: el juego sigue igual, mudo
    this.ctx = new AC();
    this.salida = this.ctx.createGain(); this.salida.gain.value = this.mudo ? 0 : 1; this.salida.connect(this.ctx.destination);
    this.agacha = this.ctx.createGain(); this.agacha.gain.value = 1; this.agacha.connect(this.salida);   // la música baja aquí mientras habla el altavoz (aparte de su volumen de Opciones)
    this.musica = this.ctx.createGain(); this.musica.gain.value = this.volMusica; this.musica.connect(this.agacha);
    this.efectos = this.ctx.createGain(); this.efectos.gain.value = this.volEfectos; this.efectos.connect(this.salida);
    if (this.temaPendiente) this.tocaTema(this.temaPendiente);
    this.cargaVoz('barrio-eco');                               // la primera voz de una carrera: se baja ya, mientras está la portada
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

  /** Pone la música de un sitio (con un fundido corto). LA API, entera:
      `id` es el id de una estación ("barrio"… "fin"), el de un barrio de
      Subway City ("city-sur", "city-muelles", "city-bulevar",
      "city-parque", "city-bajo") o la clave de un tema del cancionero
      ("metrorush-barrio", que es lo que juego.js pasa con
      `estacion.musica` y trae la lista de esa estación). Desde ahí la
      lista rota sola en `tick`. Si ya suena esa lista, no hace nada. */
  tocaTema(id) {
    if (!this.ctx) { this.temaPendiente = id; return; }        // todavía no hubo gesto: se toca después
    this.temaPendiente = null;
    const lista = listaDe(id);                                 // la lista del sitio pedido
    if (this.rep && this.lista && this.lista.clave === lista.clave) return;   // ya suena: no se reinicia
    this.lista = lista;
    const i = (this.pos[lista.clave] || 0) % lista.temas.length;   // donde había quedado esa lista (0 la primera vez)
    this.ponTema(lista.temas[i]);
  }
  /** Cambia a un tema concreto con un fundido corto (el viejo se apaga en
      medio segundo, el nuevo entra en un cuarto). */
  ponTema(id) {
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
    this.rep = this.nuevoRep(cancion);
  }
  /** Un reproductor para `cancion` que avisa cuando toca rotar. Se le
      envuelve `toca` (la función que hace sonar cada paso): al empezar una
      vuelta nueva, si ya toca cambiar, apunta en `corte` el instante de ese
      primer paso y desde ahí no suena nada más. Así el corte cae justo
      donde termina la vuelta, y `tick` arranca el siguiente tema en ese
      mismo instante: sin hueco y sin una nota del tema viejo de más. */
  nuevoRep(cancion) {
    const rep = new Chip.Reproductor(this.ctx, this.capaRep, cancion);
    rep.inicio = rep.sig;                                      // cuándo suena su primer paso (para contar segundos)
    rep.vistas = 0;                                            // las vueltas ya revisadas
    rep.corte = null;                                          // el instante del corte, cuando toque
    const toca = rep.toca.bind(rep);                           // el `toca` original del reproductor
    rep.toca = (ent, k, t, d) => {
      if (rep.corte == null && rep.vueltas > rep.vistas) {     // primer paso de una vuelta nueva
        rep.vistas = rep.vueltas;
        if (this.debeRotar(rep, t)) rep.corte = t;             // aquí empieza el siguiente tema
      }
      if (rep.corte != null) return;                           // pasado el corte, este tema ya no suena
      toca(ent, k, t, d);
    };
    return rep;
  }
  /** ¿Toca pasar al siguiente tema en este borde de vuelta (instante `t`)? */
  debeRotar(rep, t) {
    if (!this.lista || this.lista.temas.length < 2) return false;   // una lista de uno se repite
    const seg = t - rep.inicio;                                // segundos que lleva sonando
    return (rep.vueltas >= VUELTAS_TEMA && seg >= SEG_MIN) || seg >= SEG_MAX;
  }
  /** Pasa al siguiente tema de la lista, que empieza en `corte` (el borde de
      la vuelta del que sonaba). El tempo y las capas se heredan para que el
      apuro no dé un salto; el viejo deja de agendar y se suelta cuando ya
      se apagaron sus últimas notas (y su eco). */
  rota(corte) {
    const viejo = this.rep, viejoGain = this.capaRep, L = this.lista;
    const i = ((this.pos[L.clave] || 0) + 1) % L.temas.length;     // el siguiente, y vuelta al primero tras el último
    this.pos[L.clave] = i;
    const id = L.temas[i], cancion = Temas && Temas.temas[id];
    if (!cancion) { viejo.corte = null; return; }              // sin el tema (cancionero viejo en caché): sigue el que estaba
    const t = this.ctx.currentTime;
    viejoGain.gain.setTargetAtTime(0, Math.max(t, corte + .3), .25);   // lo que quede colgando del viejo se apaga tras el corte
    setTimeout(() => { try { viejo.destruir(); viejoGain.disconnect(); } catch (e) {} }, Math.max(0, corte - t) * 1000 + 2500);
    this.capaRep = this.ctx.createGain(); this.capaRep.gain.value = 1; this.capaRep.connect(this.musica);   // entra a todo volumen: el corte ya es limpio
    const rep = this.nuevoRep(cancion);
    rep.sig = Math.max(corte, t + .02);                        // su primer paso, justo en el borde del compás
    rep.inicio = rep.sig;
    rep.tempo = viejo.tempo; Object.assign(rep.capas, viejo.capas);   // el mismo apuro y las mismas capas
    this.rep = rep; this.tema = id;
  }
  /** Calla la música (en la pausa y en el fin). */
  calla() {
    this.callaVoz();                                           // el altavoz también se calla (pausa, «¿Seguir?», resumen)
    if (!this.rep) return;
    try { this.rep.destruir(); this.capaRep.disconnect(); } catch (e) {}
    this.rep = null; this.tema = null;                       // la lista y su posición se recuerdan: al volver sigue el mismo tema
  }
  /** Llamar en cada cuadro: agenda las notas que vienen y ajusta el tempo a la velocidad. */
  tick(velocidad, capas) {
    if (!this.ctx || !this.rep) return;
    // de V0 (×0,92) a VMAX (×1,15), con la curva del motor: el apuro se oye. Ejemplo: a 32,5 m/s, ×1,035
    const k = ((velocidad || VEL.V0) - VEL.V0) / (VEL.VMAX - VEL.V0);
    this.rep.tempo = 0.92 + 0.23 * Math.max(0, Math.min(1, k));
    if (capas) Object.assign(this.rep.capas, capas);
    this.rep.tick(0.25);
    if (this.rep.corte != null) {                              // el tema terminó sus vueltas: entra el siguiente
      this.rota(this.rep.corte);
      this.rep.tempo = 0.92 + 0.23 * Math.max(0, Math.min(1, k));
      this.rep.tick(0.25);                                     // y se agenda desde el corte en este mismo cuadro
    }
  }

  /* CITY: la curva de velocidad de la carrera ({V0, VMAX}, la de
     M.velocidadDe(modo)). El tempo va de ×0,92 en V0 a ×1,15 en VMAX de
     ESA curva: City corre de 16 a 46 m/s, y con la clásica (15 a 50) su
     tope sonaría a ×1,08 y nunca llegaría al apuro. */
  curva(V) { if (V && V.VMAX > V.V0) VEL = V; }

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
  /** El «ding-dong» del altavoz del andén, antes de cada anuncio (juego.js:
      altavozDice): dos campanas que bajan, Mi y Do, como en las estaciones.
      Cada una lleva su octava encima, más corta y suave: el brillo del metal. */
  dingDong() {
    if (!this.ctx) return;
    const t = this.t;
    this.dingT = t;                                            // la voz del anuncio (si tiene) espera a que pase
    for (const [f, d] of [[659, 0], [523, 0.45]]) {
      Chip.voz(this.ctx, this.efectos, { t: t + d, f, dur: 1.0, vol: 0.06, onda: 'sine', sus: 0.35 }, this.voces);        // la campana
      Chip.voz(this.ctx, this.efectos, { t: t + d, f: f * 2, dur: 0.45, vol: 0.018, onda: 'sine', sus: 0.2 }, this.voces);   // su brillo
    }
  }
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
  /* ---------- La persecución: el perro, el grito y el silbato (ronda 2) ----------
     Don Ramón y Tornillo se hacen oír. Todo es sintetizado, como el resto de
     los efectos (nada que bajar, nada que esperar):
     - `ladrido`: un «¡guau!» con un diente de sierra que sube y cae de tono
       por un filtro de banda (la boca del perro) y un soplo de aire;
     - `alto`: el grito «¡Alto!» de un inspector, hecho con síntesis de
       formantes (una voz de sierra pasada por tres filtros que se mueven de
       la «a» a la «l», un corte para la «t» y la «o»), seguido de dos
       pitazos de silbato de policía (dos tonos agudos con un trino de 30 Hz);
     - `atrapado`: el golpe de que te atrapen: un golpe sordo, un pitazo
       largo y el perro que ladra dos veces encima tuyo.
     Todo pasa por `this.efectos`, así el volumen de efectos y el mudo lo
     gobiernan, y por `vive`, así `callaEfectos` lo puede cortar. */

  /** Un ladrido. `fuerza` 1 = uno normal; 2 o más = doble y más fuerte (más cerca). */
  ladrido(fuerza = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, vol = 0.07 + 0.03 * Math.min(2, fuerza);           // más fuerte mientras más cerca
    const veces = fuerza >= 2 ? 2 : 1;                                       // «¡guau, guau!» cuando está encima
    for (let i = 0; i < veces; i++) {
      const t = this.t + i * 0.2, tono = 1 + (i ? -0.08 : 0) + (Math.random() - 0.5) * 0.1;   // el segundo un poco más grave; cada uno distinto
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth';                                                   // la garganta: rica en armónicos
      o.frequency.setValueAtTime(330 * tono, t);                             // arranca medio
      o.frequency.exponentialRampToValueAtTime(620 * tono, t + 0.03);        // sube de golpe (la «gu»)
      o.frequency.exponentialRampToValueAtTime(240 * tono, t + 0.16);        // y cae (el «au»)
      f.type = 'bandpass'; f.Q.value = 2.2;                                  // la boca: una sola resonancia
      f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.16);   // se cierra al final
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);          // ataque seco
      g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);   // y se apaga rápido
      o.connect(f); f.connect(g); g.connect(this.efectos);
      o.start(t); o.stop(t + 0.21);
      this.vive(o, [o, f, g]);
      Chip.ruido(ctx, this.efectos, { t, dur: 0.07, vol: vol * 0.45, tono: 1.6 }, this.voces);   // el aire que sale con el ladrido
    }
  }
  /** El grito «¡Alto!» del inspector y dos pitazos de silbato. */
  alto() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.t, VOL = 0.16;
    // la voz: una sierra grave (un hombre gritando) que sube en la «a» y baja en la «o»
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(205, t + 0.12);   // «¡Aaa…» sube con el esfuerzo
    o.frequency.linearRampToValueAtTime(185, t + 0.24); o.frequency.linearRampToValueAtTime(175, t + 0.33);   // «…l-t…»
    o.frequency.linearRampToValueAtTime(130, t + 0.62);                      // «…to!» cae al final
    const vib = ctx.createOscillator(), vibG = ctx.createGain();             // un temblor de voz (5,5 Hz): que no suene a máquina
    vib.frequency.value = 5.5; vibG.gain.value = 4; vib.connect(vibG); vibG.connect(o.frequency);
    // la boca: tres formantes en paralelo, cada uno un filtro de banda que se mueve de vocal en vocal
    const boca = ctx.createGain(); boca.gain.value = 1; boca.connect(this.efectos);
    const env = ctx.createGain(); o.connect(env);                            // la envolvente de la voz (se corta para la «t»)
    // [F, amplitud] por momento: «a» (0–0,18 s), «l» (0,18–0,24), «t» (silencio, 0,24–0,3), «o» (0,3–0,62)
    const formantes = [
      { q: 6, a: [[0, 780], [0.18, 760], [0.22, 380], [0.3, 520], [0.62, 480]], g: 1 },     // F1: abierta en la «a», cerrada en la «l»
      { q: 8, a: [[0, 1250], [0.18, 1200], [0.22, 1050], [0.3, 880], [0.62, 820]], g: 0.6 },  // F2: baja de la «a» a la «o»
      { q: 10, a: [[0, 2600], [0.62, 2500]], g: 0.25 }                                       // F3: el brillo del grito
    ];
    const nodos = [o, vib, vibG, env, boca];
    for (const fo of formantes) {
      const f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = fo.q; g.gain.value = fo.g;
      fo.a.forEach(([d, hz], i) => i === 0 ? f.frequency.setValueAtTime(hz, t + d) : f.frequency.linearRampToValueAtTime(hz, t + d));
      env.connect(f); f.connect(g); g.connect(boca); nodos.push(f, g);
    }
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(VOL, t + 0.03);   // el grito arranca fuerte
    env.gain.setValueAtTime(VOL, t + 0.2); env.gain.linearRampToValueAtTime(VOL * 0.6, t + 0.235);   // la «l», un poco más suave
    env.gain.linearRampToValueAtTime(0.0001, t + 0.25);                       // la lengua cierra: silencio de la «t»
    env.gain.setValueAtTime(0.0001, t + 0.3); env.gain.linearRampToValueAtTime(VOL, t + 0.33);   // se abre en la «o»
    env.gain.setValueAtTime(VOL, t + 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);   // y se apaga
    o.start(t); vib.start(t); o.stop(t + 0.68); vib.stop(t + 0.68);
    this.vive(o, nodos);
    Chip.ruido(ctx, this.efectos, { t: t + 0.285, dur: 0.035, vol: 0.06, tono: 3.4, corto: true }, this.voces);   // el chasquido de la «t»
    // el silbato: dos pitazos cortos, después del grito
    this.silbato(t + 0.72, 0.16); this.silbato(t + 0.95, 0.32);
  }
  /** Un pitazo de silbato de policía que empieza en `t0` y dura `dur` s: dos tonos agudos con un trino rápido (la bolita del silbato). */
  silbato(t0, dur) {
    if (!this.ctx) return;
    const ctx = this.ctx, g = ctx.createGain(), trino = ctx.createOscillator(), trinoG = ctx.createGain();
    trino.frequency.value = 30; trinoG.gain.value = 140;                     // la bolita: 30 vueltas por segundo, ±140 Hz
    trino.connect(trinoG);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.015);   // entra de golpe…
    g.gain.setValueAtTime(0.045, t0 + dur); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.04);   // …y se corta
    g.connect(this.efectos);
    const nodos = [trino, trinoG, g];
    [2850, 3150].forEach(f => {                                              // dos cámaras del silbato, un poco desafinadas: el «batido»
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      trinoG.connect(o.frequency); o.connect(g); o.start(t0); o.stop(t0 + dur + 0.06); nodos.push(o);
    });
    trino.start(t0); trino.stop(t0 + dur + 0.06);
    this.vive(trino, nodos);
  }
  /** Te atraparon: un golpe sordo, un pitazo largo y el perro encima, ladrando. */
  atrapado() {
    if (!this.ctx) return;
    this.nota(95, 0.35, 0.16, 'tri', { f1: 40, sus: 0.7 });                  // el golpe: la mano en el hombro (o el suelo)
    this.silbato(this.t + 0.05, 0.75);                                       // el pitazo largo de «¡te pillé!»
    setTimeout(() => this.ladrido(2), 380);                                  // el perro cae encima y ladra dos veces
  }

  /* ---------- La voz del altavoz ----------
     juego.js (altavozDice) llama `anuncio(txt)` con el texto que muestra,
     justo después del ding-dong. Aquí:
     - se busca su grabación (vozDe); sin grabación, nada;
     - se baja (fetch) y se decodifica una vez, y queda guardada para la
       próxima vuelta por esa estación; de paso se baja la que se oirá
       después (vozSiguiente), así el túnel siguiente no espera a la red;
     - suena VOZ_TRAS_DING s después del ding-dong (o enseguida, si llegó
       tarde), y solo si llegó a tiempo y nadie la calló entretanto;
     - va por `this.efectos` (volumen de efectos, mudo ♪ y volumen.js) y por
       `vive` (callaEfectos la corta);
     - mientras habla, la música baja a VOZ_AGACHA y vuelve al terminar.
     Ejemplo: un anuncio de 4 s pedido a los 10,0 s suena de 11,1 a 15,1 s,
     con la música a menos de la mitad de 11,0 a ~15,5 s. */

  /** Baja (una sola vez) y decodifica la grabación `nombre`. Promesa del AudioBuffer, o de null si no está o no hay red. */
  cargaVoz(nombre) {
    if (!this.ctx || !nombre || typeof fetch !== 'function') return Promise.resolve(null);
    if (!this.vozBufs.has(nombre)) {
      const p = fetch(urlVoz(nombre))
        .then(r => (r.ok ? r.arrayBuffer() : null))                         // un 404 (sin grabar) es null, no un error
        .then(b => b && new Promise((ok, mal) => this.ctx.decodeAudioData(b, ok, mal)))   // con callbacks: el Safari viejo no devuelve promesa
        .catch(() => null);                                                  // sin red o archivo roto: callado, sin romper nada
      p.then(buf => { if (!buf) this.vozBufs.delete(nombre); });             // lo que falló se puede volver a pedir en otra vuelta
      this.vozBufs.set(nombre, p);
    }
    return this.vozBufs.get(nombre);
  }
  /** Dice el anuncio `txt` con su grabación, después del ding-dong. Sin grabación (o en mudo), no hace nada. */
  anuncio(txt) {
    const nombre = vozDe(txt);
    if (!this.ctx || !nombre) return;                                        // sin audio o sin grabación: el anuncio solo se lee
    this.callaVoz();                                                         // si hablaba otro anuncio, se corta
    const seq = this.vozSeq, pedido = this.t;
    const desde = pedido - this.dingT < 0.25 ? this.dingT + VOZ_TRAS_DING : pedido;   // con ding-dong recién tocado, espera que termine
    this.cargaVoz(nombre).then(buf => {
      if (!buf || seq !== this.vozSeq || this.mudo) return;                  // no llegó, lo callaron entretanto, o el juego está mudo
      const ctx = this.ctx, ahora = ctx.currentTime;
      if (ahora - pedido > VOZ_TARDE) return;                                // llegó demasiado tarde: la franja ya casi se fue
      const t0 = Math.max(desde, ahora + 0.02), fin = t0 + buf.duration;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; g.gain.value = VOZ_VOL;
      s.connect(g); g.connect(this.efectos);                                 // por los efectos: su volumen, el mudo y volumen.js
      s.start(t0);
      this.vive(s, [s, g]);                                                  // callaEfectos la puede cortar
      this.vozActual = s;
      const a = this.agacha.gain;                                            // la música se agacha mientras habla…
      a.cancelScheduledValues(ahora); a.setValueAtTime(a.value, ahora);
      a.setTargetAtTime(VOZ_AGACHA, Math.max(ahora, t0 - 0.15), 0.08);
      a.setTargetAtTime(1, fin, 0.25);                                       // …y vuelve sola al terminar
    });
    this.cargaVoz(vozSiguiente(nombre));                                     // la que viene, ya bajada para cuando toque
  }
  /** Corta la voz que esté hablando (o por llegar) y devuelve la música a su volumen. */
  callaVoz() {
    this.vozSeq++;                                                           // una grabación que aún se está bajando ya no sonará
    if (!this.ctx) return;
    if (this.vozActual) { try { this.vozActual.stop(0); } catch (e) {} this.vozActual = null; }
    const a = this.agacha.gain, ahora = this.ctx.currentTime;
    a.cancelScheduledValues(ahora); a.setTargetAtTime(1, ahora, 0.12);       // la música vuelve enseguida
  }

  /** Calla todos los efectos que estén sonando. */
  callaEfectos() {
    this.callaVoz();                                                         // el altavoz incluido
    if (this.motor) this.mochila(false);
    for (const v of this.voces) { try { v.fuente.stop(0); } catch (e) {} }
    this.voces.clear(); this.motor = null;
  }
}
