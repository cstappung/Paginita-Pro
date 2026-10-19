// Sala de UNO de verdad en el emulador: GUGU GAGA, Emma, Santi y Jesús. El motor y el robot son
// los de colabtex/tests/uno.test.cjs; cada jugada se escribe en partidas/<pid>/jugadas como la
// escribiría la pantalla de ese jugador.
const fs = require('node:fs'), vm = require('node:vm');
const db = require('./db.cjs');
const code = fs.readFileSync(require('path').resolve(__dirname, '../..') + '/colabtex/src/juegos/motor.js', 'utf8').replace(/\bexport\s+/g, '');
const C = { crypto: require('node:crypto').webcrypto, TextEncoder }; vm.createContext(C);
vm.runInContext(code + ';Object.assign(this,{UNO_COLORES,esComodinUno,colorUno,valorUno,roboUno,anunciablesUno,arrUno,salUno,tapaUno,sinTilde,esMentiraUno});', C);
const { reducir, compromiso, jugableUno, roboUno, colorUno, valorUno, esComodinUno, esMentiraUno, sinTilde, arrUno, salUno, tapaUno,
  cartaUno, dhPublica, dhCompartida, cierraSobreUno, manoUno, cuentaUno, robaHastaUno, sacaRuletaUno, anunciablesUno, sha256hex, UNO_COLORES } = C;

const azar = s => { let x = s >>> 0 || 1; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); };
const elige = (k, a) => a[Math.floor(k() * a.length)];

function robot(est, u, s, k) {
  const e = est.espera, modo = est.modo, nm = est.nm;
  const { mano } = manoUno(est, u, s);
  const activos = est.jugadores.map(j => j.uid).filter(o => !est.fuera[o] && !est.elim[o]);
  const pk = {}; for (const j of est.jugadores) pk[j.uid] = j.pk;
  if (!e) return null;
  if (e.k === 'llaves') return e.faltan.includes(u) ? { t: 'k', uid: u, c: arrUno(s.sem, s.sal) } : null;
  if (e.k === 'monedas') return e.faltan.includes(u) ? { t: 'moneda', uid: u, lado: k() < 0.5 ? 'mercy' : 'nomercy' } : null;
  if (e.k === 'sobres') { const x = e.faltan.find(x => x.de === u); return x ? { t: 'sobre', uid: u, a: x.a, enc: cierraSobreUno(dhCompartida(s.sem, s.sal, pk[x.a]), e.id, mano) } : null; }
  if (e.k === 'resp' && e.uid === u) return { t: 'resp', uid: u, ok: !mano.some(c => colorUno(c) === e.prev) };
  if (e.k === 'revela' && e.uid === u) { const sal = salUno(s.sem, s.sal, e.n), c = manoUno(est, u, s).tapadas[e.n]; return { t: 'revela', uid: u, c, s: sal }; }
  if (e.k === 'duda') { if (e.de === u) return null; if (k() < 0.25) return { t: 'duda', uid: u }; return e.sig === u ? { t: 'cree', uid: u } : null; }
  if (e.k === 'tapas') { if (!e.faltan.includes(u)) return null; const c = elige(k, mano), sal = salUno(s.sem, s.sal, cuentaUno(est, u).ocultas); return { t: 'tapa', uid: u, h: tapaUno(c, sal) }; }
  if (e.k === 'destapa' && e.de === u) { const q = Object.keys(e.tapas).filter(o => !e.abiertas[o] && activos.includes(o)); return q.length && k() < 0.8 ? { t: 'destapa', uid: u, a: elige(k, q) } : { t: 'basta', uid: u }; }
  if (e.k === 'reto' && e.uid === u) return { t: k() < 0.4 ? 'reta' : 'carga', uid: u };
  if (e.k === 'ruleta' && e.uid === u) { if (!e.col) return { t: 'ruleta', uid: u, col: elige(k, UNO_COLORES) }; return { ...sacaRuletaUno(est, s, u), k: e.n }; }
  const ctx = { modo, tope: est.tope, pena: est.pena };
  const tras = (e.k === 'tras' || e.k === 'hasta') && e.uid === u;
  const miTurno = (e.k === 'turno' || e.k === 'pena') && e.uid === u;
  if (!tras && !miTurno) return null;
  if (miTurno && est.monedas[u] && est.monedas[u].lado === 'mercy' && !est.monedas[u].usada && mano.length >= 16 && k() < 0.7) return { t: 'merced', uid: u };
  let jugables = mano.filter(c => !esMentiraUno(c) && jugableUno(c, ctx));
  if (tras) { const ult = cartaUno(modo, s.sem, s.sal, est.mezcla, cuentaUno(est, u).robadas - 1); jugables = jugables.includes(ult) ? [ult] : []; }
  if (!jugables.length) {
    if (tras) return { t: 'pasa', uid: u };
    if (est.pena) return { t: 'carga', uid: u };
    if (nm) return { t: 'roba', uid: u, n: robaHastaUno(est, s, u, mano, c => jugableUno(c, { modo, tope: est.tope })) };
    return { t: 'roba', uid: u };
  }
  // juega lo más vistoso que tenga: comodines y robos primero
  jugables.sort((a, b) => (roboUno(b) ? 2 : esComodinUno(b) ? 1 : 0) - (roboUno(a) ? 2 : esComodinUno(a) ? 1 : 0));
  const c = k() < 0.6 ? jugables[0] : elige(k, jugables), resto = mano.slice(); resto.splice(resto.indexOf(c), 1);
  const j = { t: 'juega', uid: u, c };
  const otros = activos.filter(o => o !== u);
  if (esComodinUno(c) && modo !== 'allwild' && c !== 'NC') j.col = elige(k, UNO_COLORES);
  if ((nm && valorUno(c) === '7') || c === 'NW' || c === 'NT2') j.obj = elige(k, otros);
  if (valorUno(c) === 'D' || c === 'ND') { const col = c === 'ND' ? j.col : colorUno(c); j.n = resto.filter(x => colorUno(x) === col).length; }
  if (c === 'NF') j.mano = resto;
  if (roboUno(c) && est.monedas[u] && est.monedas[u].lado === 'nomercy' && !est.monedas[u].usada && k() < 0.5) j.moneda = true;
  j.uno = k() < 0.9;
  return j;
}

const JUGADORES = [[JSON.parse(fs.readFileSync(__dirname + '/semilla.json', 'utf8')).uid, 'GUGU GAGA', '#0d9488'], ['emma7', 'Emma', '#e8467c'], ['santi9', 'Santi', '#3f8cff'], ['jesus3', 'Jesús', '#22b07d']];
let p = null, sec = {}, k = null, est = null, pid = null;

async function crea(modo = 'nomercy', semilla = 4242) {
  pid = '-TrailerUno' + semilla;
  p = { juego: 'uno', modo, estado: 'jugando', anfitrion: JUGADORES[0][0], nombre: 'GUGU', semilla, lado: 6, cupo: 4, at: Date.now() - 60000, jugadores: {}, jugadas: {} };
  for (let i = 0; i < JUGADORES.length; i++) {
    const [u, nombre, color] = JUGADORES[i], sem = (semilla * 7919 + i * 104729) >>> 0 || 1, sal = 'sal' + semilla + i;
    sec[u] = { sem, sal };
    p.jugadores[u] = { nombre, color, orden: i, hmazo: await compromiso(sem, sal), hcad: sha256hex(arrUno(sem, sal)), pk: dhPublica(sem, sal), at: Date.now() - 60000 };
    await db.put(`misPartidas/${u}/${pid}`, { juego: 'uno', at: Date.now() - 60000, sec: { sem, sal } });
  }
  k = azar(semilla * 31 + 7);
  est = reducir(p);
  await db.put(`partidas/${pid}`, p);
  return pid;
}
function siguienteJugada() {
  const orden = JUGADORES.map(j => j[0]).sort(() => k() - 0.5);
  if (est.olvido && k() < 0.5 && !(est.espera && est.espera.k === 'sobres')) {
    const quien = orden.find(o => o !== est.olvido && !est.fuera[o] && !est.elim[o]);
    if (quien) return { t: 'pilla', uid: quien, a: est.olvido };
  }
  for (const u of orden) { if (est.fuera[u] || est.elim[u]) continue; const j = robot(est, u, sec[u], k); if (j) return j; }
  return null;
}
async function paso() {
  if (est.fase === 'fin') return null;
  const j = siguienteJugada(); if (!j) return null;
  const n = String(Object.keys(p.jugadas).length).padStart(4, '0');
  p.jugadas[n] = j; est = reducir(p);
  await db.put(`partidas/${pid}/jugadas/${n}`, j);
  return j;
}
// Avanza hasta que la partida esté en juego y cada uno haya jugado unas cuantas cartas
async function prepara(jugadasPrevias = 18) {
  let juegas = 0;
  while (juegas < jugadasPrevias) { const j = await paso(); if (!j) break; if (j.t === 'juega') juegas++; }
  return { pid, fase: est.fase, espera: est.espera && est.espera.k };
}
module.exports = { crea, prepara, paso, estado: () => est };
if (require.main === module) (async () => { await crea(); console.log(await prepara()); })().catch(e => { console.error(e); process.exit(1); });
