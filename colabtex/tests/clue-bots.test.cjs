const test = require('node:test');
const assert = require('node:assert');
global.ClueMotor = require('../../juegos/clue/js/motor.js');
global.ClueBots = require('../../juegos/clue/js/bots.js');
require('../../juegos/clue/js/mesa.js');
const M = global.ClueMotor;
const B = global.ClueBots;

/* Un estado público mínimo para probar la cabeza del bot sin mesa. */
function estado(uids, sugerencias = [], acusaciones = []) {
  return {
    jugadores: uids.map(uid => ({ uid })), cr: { mesa: uids.slice() },
    sugerencias, acusaciones, fichas: M.SALIDAS.map(([x, y]) => M.pos(x, y)),
    paso: 'inicio', dados: [3, 4], puedeSugerir: false, turno: uids[0]
  };
}
const sug = (uid, s, a, l, pasaron, mostro, k) => ({ uid, s, a, l, pasaron, mostro, k: k || 'k' + Math.random() });

test('clue bots: con la mano y los tamaños cierra el sobre', () => {
  /* Dos jugadores: la mitad del resto cada uno (con cartas impares, el
     primer asiento se lleva una más). */
  const uids = ['a', 'b'];
  const sobre = [0, M.NS, M.NS + M.NA];
  const resto = Array.from({ length: M.NC }, (_, i) => i).filter(c => !sobre.includes(c));
  const mitad = Math.ceil(resto.length / 2);
  const mia = resto.slice(0, mitad), suya = resto.slice(mitad);
  const bot = B.crear({ uid: 'a', mano: mia, jugadores: uids });
  bot.observa(estado(uids), {});
  /* Sin más datos: quedan 3 candidatas por tipo salvo lo que él tenga. Le enseñan seis de las suyas. */
  const sugs = suya.slice(0, 6).map((c, i) => {
    const t = M.tipoCarta(c);
    const S = t === 's' ? c : 0, A = t === 'a' ? c - M.NS : 0, L = t === 'l' ? c - M.NS - M.NA : 0;
    return sug('a', S, A, L, [], 'b', 'v' + i);
  });
  const vistas = {};
  suya.slice(0, 6).forEach((c, i) => { vistas['v' + i] = c; });
  bot.observa(estado(uids, sugs), vistas);
  const sabe = bot.sabe();
  assert.ok(sabe.dueños.length === M.NC);
  /* Con 6 vistas, las que faltan de él son las que no están en el sobre ni en mi mano. */
  const desconocidas = resto.filter(c => !mia.includes(c) && !suya.slice(0, 6).includes(c));
  assert.equal(desconocidas.length, suya.length - 6);
  const candidatas = c => (sabe.dueños[c] & sabe.E) !== 0;
  assert.ok(candidatas(sobre[0]) && candidatas(sobre[1]) && candidatas(sobre[2]));
});

test('clue bots: quien pasa no tiene ninguna de las tres', () => {
  const uids = ['a', 'b', 'c'];
  const bot = B.crear({ uid: 'a', mano: [0, 1, 6, 7, 12, 13], jugadores: uids });
  bot.observa(estado(uids, [sug('a', 2, 2, 2, ['b', 'c'], '', 'x')]), {});
  const d = bot.sabe().dueños;
  const cartas = [2, M.NS + 2, M.NS + M.NA + 2];
  // b (bit 1) y c (bit 2) no las tienen: solo yo (bit 0) o el sobre (bit 3)
  for (const c of cartas) assert.equal(d[c] & 0b0110, 0);
});

test('clue bots: la restriccion "tiene una de estas" se resuelve sola', () => {
  const uids = ['a', 'b', 'c'];
  const bot = B.crear({ uid: 'a', mano: [0, 1, 6, 7, 12, 13], jugadores: uids });
  /* b pasa con (2, 8, 12): no tiene la 2 ni la 8. Luego b refuta (2, 8, 15) a c
     sin que yo lo vea: tiene que ser la 15 (lugar 3). */
  const s1 = sug('a', 2, 2, 0, ['b'], '', 's1');
  const s2 = sug('c', 2, 2, 3, [], 'b', 's2');
  bot.observa(estado(uids, [s1]), {});
  assert.notEqual(bot.sabe().dueños[M.NS + M.NA + 3], 1 << 1);
  bot.observa(estado(uids, [s1, s2]), {});
  assert.equal(bot.sabe().dueños[M.NS + M.NA + 3], 1 << 1);
});

test('clue bots: una acusación fallida descarta esa tripleta', () => {
  const uids = ['a', 'b', 'c'];
  const bot = B.crear({ uid: 'a', mano: [1, 2, 6, 7, 12, 13], jugadores: uids });
  /* Sé que el sobre tiene sospechoso 0 y arma 2 (si me pasan sus dueños); aquí solo compruebo que no explota. */
  bot.observa(estado(uids, [], [{ uid: 'b', s: 0, a: 2, l: 4, ok: false, k: 'z' }]), {});
  const sabe = bot.sabe();
  assert.ok(!(sabe.sobre && sabe.sobre[0] === 0 && sabe.sobre[1] === M.NS + 2 && sabe.sobre[2] === M.NS + M.NA + 4));
});

test('clue bots: refuta con la carta que ya enseñó a ese jugador', () => {
  const uids = ['a', 'b', 'c'];
  const mano = [0, M.NS, M.NS + M.NA, 1, 2, 3];
  const bot = B.crear({ uid: 'a', mano, jugadores: uids });
  const primera = bot.refuta({ uid: 'b', s: 0, a: 0, l: 0, k: 'p' }, estado(uids));
  assert.ok([0, M.NS, M.NS + M.NA].includes(primera));
  for (let i = 0; i < 10; i++) assert.equal(bot.refuta({ uid: 'b', s: 0, a: 0, l: 0, k: 'q' + i }, estado(uids)), primera);
  assert.equal(bot.refuta({ uid: 'b', s: 5, a: 5, l: 8, k: 'r' }, estado(uids)), null);
});

test('clue bots: decide siempre una jugada legal del paso', () => {
  const uids = ['a', 'b', 'c'];
  const bot = B.crear({ uid: 'a', mano: [0, 1, 6, 7, 12, 13], jugadores: uids });
  const e = estado(uids);
  const j = bot.decide(e, {});
  assert.equal(j.t, 'mueve');
  assert.ok(M.destinoValido(e.fichas, 0, 7, j.a));
  e.paso = 'tras';
  assert.equal(bot.decide(e, {}).t, 'pasa');
});

/* ---- partidas enteras, sin cabeza, con la mesa de práctica ---- */

const espera = ms => new Promise(r => setTimeout(r, ms));

/* Juega una partida: el asiento "yo" lo lleva esta función con otro bot. */
async function partida(nBots, semilla, nivelYo) {
  const m = global.ClueMesa.crearMesa({ bots: nBots, ritmo: 1000, semilla });
  const uids = m.jugadores.map(j => j.uid);
  let yo = null, intentos = { clave: '', n: 0 }, ultimo = null, fin = null;
  const salida = new Promise(res => { fin = res; });
  const cabo = Date.now() + 30000;
  let ultimaJugada = Date.now(), aceptadasVistas = -1;

  function mueve(v) {
    const est = v.est, priv = v.priv;
    if (est.fase === 'fin') { fin({ est, m }); return; }
    if (Date.now() > cabo || est.nTurno > 3000) { fin({ est, m, tope: true }); return; }
    if (est.aceptadas !== aceptadasVistas) { aceptadasVistas = est.aceptadas; ultimaJugada = Date.now(); }
    else if (Date.now() - ultimaJugada > 4000) { fin({ est, m, atascada: true }); return; }
    if (est.fase === 'elige') {
      if (!est.eleccion.yo) m.jugar({ t: 'elige', r: 'carmin' });
      return;
    }
    if (!yo) yo = B.crear({ uid: 'yo', mano: priv.mano, jugadores: uids, nivel: nivelYo });
    if (!est.debe.includes('yo')) return;
    if (est.paso === 'refuta') {
      const pedidas = [M.cartaS(est.sug.s), M.cartaA(est.sug.a), M.cartaL(est.sug.l)];
      const mias = priv.mano.filter(c => pedidas.includes(c));
      if (mias.length) m.refutar(yo.refuta(est.sug, est) || mias[0]);
      return;
    }
    if (est.turno !== 'yo' || !['inicio', 'accion', 'tras'].includes(est.paso)) return;
    const clave = est.aceptadas + '|' + est.paso;
    if (intentos.clave === clave) intentos.n++; else intentos = { clave, n: 0 };
    let j = null;
    try { j = yo.decide(est, priv.vistas); } catch (e) { j = null; }
    if (!j || intentos.n > 0) j = { t: 'pasa' };
    m.jugar(j);
  }
  /* Dentro de un callback de la mesa no se escribe: se agenda. */
  const desuscribe = m.suscribir(v => { ultimo = v; setTimeout(() => mueve(ultimo), 0); });
  const r = await salida;
  desuscribe();
  m.destruir();
  return r;
}

async function lote(nBots, nPartidas, nivelYo) {
  const res = await Promise.all(Array.from({ length: nPartidas }, (_, i) => partida(nBots, 1000 * nBots + i * 7919 + 13, nivelYo)));
  const st = { partidas: nPartidas, terminadas: 0, aciertos: 0, ultimo: 0, erroneas: 0, turnos: 0, rondas: 0, maxTurnos: 0, atascadas: 0, malSobre: 0 };
  for (const r of res) {
    const est = r.est;
    if (r.atascada) st.atascadas++;
    if (est.fase !== 'fin') continue;
    st.terminadas++;
    st.erroneas += est.acusaciones.filter(a => !a.ok).length;
    st.turnos += est.nTurno;
    st.rondas += est.nTurno / (nBots + 1);
    st.maxTurnos = Math.max(st.maxTurnos, est.nTurno);
    if (est.motivo === 'acierto') {
      st.aciertos++;
      const sobre = r.m.depura().sobre;
      const a = est.acusaciones[est.acusaciones.length - 1];
      if (!(a.ok && M.cartaS(a.s) === sobre[0] && M.cartaA(a.a) === sobre[1] && M.cartaL(a.l) === sobre[2])) st.malSobre++;
    } else st.ultimo++;
  }
  return st;
}

const informe = (n, st) => console.log(
  `[clue bots] ${n} bots: ${st.terminadas}/${st.partidas} terminadas, ${st.aciertos} por acierto, ` +
  `turnos medios ${(st.turnos / Math.max(1, st.terminadas)).toFixed(1)} (${(st.rondas / Math.max(1, st.terminadas)).toFixed(1)} por jugador), ` +
  `max ${st.maxTurnos}, acusaciones erroneas ${st.erroneas}`
);

for (const n of [2, 3, 5]) {
  test(`clue bots: 30 partidas con ${n} bots terminan y aciertan el sobre`, { timeout: 60000 }, async () => {
    const st = await lote(n, 30, 'normal');
    informe(n, st);
    assert.equal(st.atascadas, 0, 'ninguna mesa se atasca');
    assert.equal(st.terminadas, st.partidas, 'todas terminan');
    assert.equal(st.malSobre, 0, 'quien gana acusando acierta el sobre');
    assert.equal(st.erroneas, 0, 'a nivel normal nadie acusa mal');
    assert.equal(st.aciertos, st.partidas);
    assert.ok(st.maxTurnos < 1500, 'termina en un número acotado de turnos');
  });
}

test('clue bots: el nivel facil tambien termina (puede acusar antes de tiempo)', { timeout: 60000 }, async () => {
  const st = await lote(3, 20, 'facil');
  informe('3 (yo facil)', st);
  assert.equal(st.atascadas, 0);
  assert.equal(st.terminadas, st.partidas);
  assert.equal(st.malSobre, 0);
});
