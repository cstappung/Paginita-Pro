// Modo batalla 1 contra 1, como en Guitar Hero III: no hay Star Power, cada frase de estrellas completa te
// da un poder (hasta MAX_PODERES) y el botón de Star Power se lo lanza al rival. Cada uno tiene una barra de
// vida que sube con los aciertos y baja con los fallos: el primero que llega a cero pierde por K.O.; si la
// canción termina con los dos en pie, gana el que tiene más vida (y si empatan, el puntaje).
//
// Puro (sin DOM ni motor): lo usa la sesión (game/session.js) y lo prueban tests/hero.test.cjs. Cada jugador
// es un «puesto» (0 y 1). En una sala en línea solo se simula el tuyo; el del rival llega por la malla con su
// estado (`vista`) y tus ataques le llegan a él en tu estado (`ataques`).
export const PODERES = {
  amp: { n: 'Amplificador saturado', ic: '🔊', dur: 7, color: '#ffb21e', txt: '¡AMPLIFICADOR SATURADO!', ayuda: 'La pista tiembla y las notas parpadean' },
  cuerda: { n: 'Cuerda rota', ic: '✂️', dur: 14, color: '#ff4a4a', txt: '¡CUERDA ROTA!', ayuda: 'Pulsa ese traste varias veces para repararla' },
  zurdo: { n: 'Zurdo', ic: '🔄', dur: 8, color: '#c79bff', txt: '¡PISTA AL REVÉS!', ayuda: 'Los colores quedan al revés en la pista' },
  apagon: { n: 'Apagón', ic: '🌑', dur: 7, color: '#6a8aff', txt: '¡APAGÓN!', ayuda: 'Las notas se apagan antes de llegar' },
  drenaje: { n: 'Drenaje', ic: '🩸', dur: 6, color: '#ff3a6a', txt: '¡DRENAJE!', ayuda: 'La vida baja sola unos segundos' },
  robo: { n: 'Robo', ic: '🦝', dur: 0, color: '#9dff6f', txt: '¡TE ROBARON LOS PODERES!', ayuda: 'Le quitas los poderes al rival y te quedas uno' },
};
export const TIPOS = Object.keys(PODERES);
export const MAX_PODERES = 3;
export const REPARA = 6;   // pulsaciones del traste roto para arreglar la cuerda
export const VIDA = { inicio: 0.6, acierto: 0.012, fallo: 0.045, drenaje: 0.05 };
// cuánto dura el «¡K.O.!» antes de terminar la canción
export const FIN_KO = 3;

const nuevo = () => ({ vida: VIDA.inicio, poderes: [], efectos: {}, roto: -1, reparo: 0, ko: false, koT: null, aviso: null, recibidos: new Set(), lanzados: [] });

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

  // una frase de estrellas completa: un poder al azar (si cabe)
  gana(q, t) {
    const J = this.j[q];
    if (!this.vivo(q) || J.poderes.length >= MAX_PODERES) return null;
    const k = TIPOS[Math.floor(this.rnd() * TIPOS.length)];
    J.poderes.push(k);
    J.aviso = { text: `${PODERES[k].ic} ${PODERES[k].n}`, color: PODERES[k].color, t };
    return k;
  }

  /* `q` lanza su poder más viejo. `lanes`: cuántos carriles tiene la pista del rival (para la cuerda).
     Devuelve el ataque {id, k, l, de} (ya aplicado si el rival se simula aquí) o null. */
  lanza(q, t, lanes = 5) {
    const J = this.j[q];
    if (!this.vivo(q) || !J.poderes.length) return null;
    const k = J.poderes.shift();
    const a = { id: this.sig++, k, l: k === 'cuerda' ? Math.floor(this.rnd() * lanes) : -1, de: q };
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
    return true;
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
    for (const [k, fin] of Object.entries(J.efectos)) if (t >= fin) { delete J.efectos[k]; if (k === 'cuerda') { J.roto = -1; J.reparo = 0; } }
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
    if (v.ko && !J.ko) this._ko(q, t);
  }

  /* Lo que sale en el estado de `q` hacia el rival: vida, poderes, efectos (segundos que les quedan), K.O.
     y los últimos ataques lanzados (se repiten: el canal pierde paquetes). */
  vista(q, t) {
    const J = this.j[q], e = {};
    for (const [k, fin] of Object.entries(J.efectos)) if (fin > t) e[k] = Math.round((fin - t) * 10) / 10;
    return { v: Math.round(J.vida * 1000), p: J.poderes.slice(), e, r: J.roto, rp: J.reparo, ko: J.ko ? 1 : 0, a: J.lanzados.map(({ id, k, l }) => [id, k, l]) };
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
      amp: ef('amp'), zurdo: ef('zurdo'), apagon: ef('apagon'), drenaje: ef('drenaje'),
      roto: ef('cuerda') ? J.roto : -1, reparo: J.reparo, gano: this.ganador === null ? null : this.ganador === q,
    };
  }
}
