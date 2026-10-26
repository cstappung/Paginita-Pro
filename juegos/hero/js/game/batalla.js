// Modo batalla 1 contra 1, como en Guitar Hero III: no hay Star Power, cada frase de estrellas completa te
// da un poder (hasta MAX_PODERES) y el botón de Star Power se lo lanza al rival. Cada uno tiene una barra de
// vida que sube con los aciertos y baja con los fallos: el primero que llega a cero pierde por K.O.; si la
// canción termina con los dos en pie, gana el que tiene más vida (y si empatan, el puntaje).
//
// Puro (sin DOM ni motor): lo usa la sesión (game/session.js) y lo prueban tests/hero.test.cjs. Cada jugador
// es un «puesto» (0 y 1). En una sala en línea solo se simula el tuyo; el del rival llega por la malla con su
// estado (`vista`) y tus ataques le llegan a él en tu estado (`ataques`).
export const PODERES = {
  amp: { n: 'Amplificador saturado', ic: '🔊', dur: 7, color: '#ffb21e', txt: '¡AMPLIFICADOR SATURADO!', ayuda: 'La pista se sacude y las notas parpadean' },
  cuerda: { n: 'Cuerda rota', ic: '✂️', dur: 14, color: '#ff4a4a', txt: '¡CUERDA ROTA!', ayuda: 'Pulsa ese traste varias veces para repararla' },
  cruce: { n: 'Teclas cruzadas', ic: '🔀', dur: 9, color: '#c79bff', txt: '¡TECLAS CRUZADAS!', ayuda: 'Dos trastes se intercambiaron' },
  dobles: { n: 'Notas dobles', ic: '👯', dur: 8, color: '#ff7ad8', txt: '¡NOTAS DOBLES!', ayuda: 'Cada nota viene con otra al lado' },
  apagon: { n: 'Apagón', ic: '🌑', dur: 6, color: '#6a8aff', txt: '¡APAGÓN!', ayuda: 'Toca a ciegas: la pista queda a oscuras' },
  drenaje: { n: 'Drenaje', ic: '🩸', dur: 6, color: '#ff3a6a', txt: '¡DRENAJE!', ayuda: 'La vida baja sola unos segundos' },
  robo: { n: 'Robo', ic: '🦝', dur: 0, color: '#9dff6f', txt: '¡TE ROBARON LOS PODERES!', ayuda: 'Le quitas los poderes al rival y te quedas uno' },
};
export const TIPOS = Object.keys(PODERES);
export const MAX_PODERES = 3;
export const REPARA = 6;   // pulsaciones del traste roto para arreglar la cuerda
export const VIDA = { inicio: 0.6, acierto: 0.012, fallo: 0.045, drenaje: 0.05 };
// cuánto dura el «¡K.O.!» antes de terminar la canción
export const FIN_KO = 3;
// las notas dobles empiezan un poco más adelante: las que ya estaban por llegar a la barra no cambian de golpe
export const DOBLES_ANTES = 0.8;
// qué poderes sirven contra cada instrumento (la batería no tiene acordes de trastes)
export const PODERES_BATERIA = TIPOS.filter((k) => k !== 'dobles');

/* «Notas dobles»: cada nota simple de guitarra entre t0 y t1 (hora de la canción) se vuelve un acorde con el
   traste de al lado (arriba o abajo según la nota, para que no sea siempre el mismo dibujo); sus sostenidos
   también. Las notas son del jugador (session.js las copia en la batalla) y se cambian una sola vez. Puro: el que
   recibe el ataque lo aplica a su motor y el rival, a la autopista que ve de él, con la misma ventana. */
export function dobla(notes, t0, t1) {
  let n = 0;
  for (let i = 0; i < notes.length; i++) {
    const nt = notes[i];
    if (nt.time < t0) continue;
    if (nt.time >= t1) break;
    if (nt.open || nt.dbl || nt.gems !== 1) continue;
    const f = 31 - Math.clz32(nt.frets), otro = f === 4 || (f > 0 && i % 2) ? f - 1 : f + 1, bit = 1 << otro;
    nt.dbl = true; nt.frets |= bit; nt.gems = 2;
    if (nt.sus) nt.sus = nt.sus.map((s) => (s.mask & (1 << f) ? { ...s, mask: s.mask | bit } : s));
    n++;
  }
  return n;
}

const nuevo = () => ({ vida: VIDA.inicio, poderes: [], efectos: {}, roto: -1, reparo: 0, cruce: null, dobles: null, ko: false, koT: null, aviso: null, recibidos: new Set(), lanzados: [] });

export class Batalla {
  // `rnd()` en [0, 1): qué poder sale y qué cuerda se rompe
  constructor(rnd = Math.random) {
    this.rnd = rnd;
    this.j = [nuevo(), nuevo()];
    this.sig = 1;   // id del próximo ataque lanzado (en línea, para no aplicarlo dos veces)
    this.ganador = null;   // 0 | 1 cuando termina
    this.motivo = '';      // 'ko' | 'vida' | 'puntaje'
    this.finT = null;      // hora de la canción en que terminó
  }

  vivo(q) { return !this.j[q].ko && this.ganador === null; }

  // un acierto sube la vida; un fallo (nota perdida o rasgueo de más) la baja
  acierto(q) { if (this.vivo(q)) this.j[q].vida = Math.min(1, this.j[q].vida + VIDA.acierto); }
  fallo(q, t) {
    const J = this.j[q];
    if (!this.vivo(q)) return;
    J.vida = Math.max(0, J.vida - VIDA.fallo);
    if (J.vida <= 0) this._ko(q, t);
  }

  // una frase de estrellas completa: un poder al azar (si cabe). `tipos`: los que sirven contra el rival
  gana(q, t, tipos = TIPOS) {
    const J = this.j[q];
    if (!this.vivo(q) || J.poderes.length >= MAX_PODERES) return null;
    const k = tipos[Math.floor(this.rnd() * tipos.length)];
    J.poderes.push(k);
    J.aviso = { text: `${PODERES[k].ic} ${PODERES[k].n}`, color: PODERES[k].color, t };
    return k;
  }

  /* `q` lanza su poder más viejo. `lanes`: cuántos carriles tiene la pista del rival (la cuerda rota y las teclas
     cruzadas eligen ahí: `l` es el carril o, en el cruce, a·8 + b). Devuelve el ataque {id, k, l, de} o null. */
  lanza(q, t, lanes = 5) {
    const J = this.j[q];
    if (!this.vivo(q) || !J.poderes.length) return null;
    const k = J.poderes.shift();
    let l = -1;
    if (k === 'cuerda') l = Math.floor(this.rnd() * lanes);
    else if (k === 'cruce') { const x = Math.floor(this.rnd() * lanes), y = (x + 1 + Math.floor(this.rnd() * (lanes - 1))) % lanes; l = Math.min(x, y) * 8 + Math.max(x, y); }
    const a = { id: this.sig++, k, l, de: q };
    J.lanzados.push(a);
    if (J.lanzados.length > 8) J.lanzados.shift();
    J.aviso = { text: `¡${PODERES[k].n.toUpperCase()}!`, color: PODERES[k].color, t };
    return a;
  }

  /* el ataque `a` le cae a `q` (una sola vez por id y atacante) */
  recibe(q, a, t) {
    const J = this.j[q], clave = a.de + ':' + a.id;
    if (!this.vivo(q) || J.recibidos.has(clave) || !PODERES[a.k]) return false;
    J.recibidos.add(clave);
    const P = PODERES[a.k];
    J.aviso = { text: P.txt, color: P.color, t, sub: P.ayuda };
    if (a.k === 'robo') {
      // le quita los poderes a `q`; quien robó se queda con uno (si lo simulamos aquí)
      const robados = J.poderes.splice(0);
      const A = this.j[1 - q];
      if (robados.length && A && this.vivo(1 - q) && A.poderes.length < MAX_PODERES) A.poderes.push(robados[0]);
      return true;
    }
    J.efectos[a.k] = t + P.dur;
    if (a.k === 'cuerda') { J.roto = a.l; J.reparo = 0; }
    if (a.k === 'cruce') {
      const x = a.l >> 3, y = a.l & 7;
      J.cruce = x !== y && a.l >= 0 ? [x, y] : [0, 1];
    }
    if (a.k === 'dobles') {
      // la ventana de notas que se doblan; el ícono queda hasta que pasa la última
      J.dobles = [t + DOBLES_ANTES, t + DOBLES_ANTES + P.dur];
      J.efectos.dobles = J.dobles[1];
    }
    return true;
  }

  /* el carril que toca el traste `l` de `q` (con las teclas cruzadas, dos se intercambian) */
  cruzado(q, l, t) {
    const J = this.j[q];
    if (!(J.efectos.cruce > t) || !J.cruce) return l;
    return l === J.cruce[0] ? J.cruce[1] : l === J.cruce[1] ? J.cruce[0] : l;
  }

  // ¿el traste `l` de `q` está roto ahora?
  roto(q, l, t) { const J = this.j[q]; return J.efectos.cuerda > t && J.roto === l; }
  // una pulsación del traste roto: a las REPARA queda arreglada (devuelve true al arreglarla)
  pulsaRoto(q, t) {
    const J = this.j[q];
    if (!(J.efectos.cuerda > t)) return false;
    if (++J.reparo < REPARA) return false;
    delete J.efectos.cuerda; J.roto = -1; J.reparo = 0;
    J.aviso = { text: '¡CUERDA REPARADA!', color: '#9dff6f', t };
    return true;
  }

  // cada cuadro: vencen los efectos y el drenaje come vida
  tick(q, t, dt) {
    const J = this.j[q];
    for (const [k, fin] of Object.entries(J.efectos)) if (t >= fin) {
      delete J.efectos[k];
      if (k === 'cuerda') { J.roto = -1; J.reparo = 0; }
      if (k === 'cruce') J.cruce = null;
    }
    if (!this.vivo(q)) return;
    if (J.efectos.drenaje > t && dt > 0) {
      J.vida = Math.max(0, J.vida - VIDA.drenaje * Math.min(0.1, dt));
      if (J.vida <= 0) this._ko(q, t);
    }
  }

  _ko(q, t) {
    const J = this.j[q];
    if (J.ko) return;
    J.ko = true; J.koT = t; J.vida = 0;
    if (this.ganador === null) { this.ganador = 1 - q; this.motivo = 'ko'; this.finT = t; }
  }

  /* El rival en línea: su estado llega por la malla (`vista`) y se copia tal cual. Si dice K.O., terminó. */
  ponRemoto(q, v, t) {
    if (!v) return;
    const J = this.j[q];
    J.vida = Math.max(0, Math.min(1, (+v.v || 0) / 1000));
    J.poderes = (Array.isArray(v.p) ? v.p : []).filter((k) => PODERES[k]).slice(0, MAX_PODERES);
    J.efectos = {};
    for (const [k, s] of Object.entries(v.e || {})) if (PODERES[k] && s > 0) J.efectos[k] = t + Math.min(30, s);
    J.roto = Number.isInteger(v.r) ? v.r : -1; J.reparo = +v.rp || 0;
    J.cruce = Array.isArray(v.x) && v.x.length === 2 && v.x.every((l) => Number.isInteger(l) && l >= 0 && l < 8) ? v.x.slice() : null;
    // la ventana de sus notas dobles va en su hora de la canción, que es la tuya (empiezan juntas)
    J.dobles = Array.isArray(v.dn) && v.dn.length === 2 && v.dn.every(Number.isFinite) && v.dn[1] > v.dn[0] && v.dn[1] - v.dn[0] <= 30 ? v.dn.slice() : null;
    if (v.ko && !J.ko) this._ko(q, t);
  }

  /* Lo que sale en el estado de `q` hacia el rival: vida, poderes, efectos (segundos que les quedan), K.O.
     y los últimos ataques lanzados (se repiten: el canal pierde paquetes). */
  vista(q, t) {
    const J = this.j[q], e = {};
    for (const [k, fin] of Object.entries(J.efectos)) if (fin > t) e[k] = Math.round((fin - t) * 10) / 10;
    return {
      v: Math.round(J.vida * 1000), p: J.poderes.slice(), e, r: J.roto, rp: J.reparo, ko: J.ko ? 1 : 0, a: J.lanzados.map(({ id, k, l }) => [id, k, l]),
      ...(e.cruce && J.cruce ? { x: J.cruce } : {}), ...(J.dobles && J.dobles[1] > t ? { dn: J.dobles } : {}),
    };
  }

  /* La canción terminó con los dos en pie: gana más vida; si empatan, más puntaje (`puntajes` [a, b]). */
  cierra(t, puntajes = [0, 0]) {
    if (this.ganador !== null) return;
    const [a, b] = this.j.map((J) => J.vida);
    if (Math.abs(a - b) > 1e-9) { this.ganador = a > b ? 0 : 1; this.motivo = 'vida'; }
    else { this.ganador = (puntajes[0] || 0) >= (puntajes[1] || 0) ? 0 : 1; this.motivo = 'puntaje'; }
    this.finT = t;
  }

  /* Lo que pinta la autopista de `q` (render/highway.js): vida, poderes, efectos activos y el aviso */
  pintura(q, t) {
    const J = this.j[q], ef = (k) => J.efectos[k] > t;
    return {
      vida: J.vida, poderes: J.poderes, ko: J.ko, aviso: J.aviso && t - J.aviso.t < 2.2 && t >= J.aviso.t - 0.05 ? J.aviso : null,
      amp: ef('amp'), cruce: ef('cruce') ? J.cruce : null, dobles: ef('dobles'), apagon: ef('apagon'), drenaje: ef('drenaje'),
      roto: ef('cuerda') ? J.roto : -1, reparo: J.reparo, gano: this.ganador === null ? null : this.ganador === q,
      // cuánto le queda a cada ataque (1 → 0), para el anillo de su ícono
      quedan: Object.fromEntries(Object.entries(J.efectos).filter(([, fin]) => fin > t).map(([k, fin]) => [k, Math.min(1, (fin - t) / (PODERES[k].dur + (k === 'dobles' ? DOBLES_ANTES : 0)))])),
    };
  }
}
