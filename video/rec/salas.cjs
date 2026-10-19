// Salas reales en el emulador para filmarlas como espectador. Cada partida se juega entera en Node con
// los robots de colabtex/tests/<juego>.test.cjs (se cargan en un vm; sus funciones quedan a mano), y
// después se escribe en partidas/<pid> hasta la mitad y el resto jugada a jugada mientras se graba.
// Los uids de los jugadores son los de los tests ('a', 'b'…); solo cambian los nombres y colores.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const db = require('./db.cjs');
const COLAB = require('path').resolve(__dirname, '../..') + '/colabtex';
const GENTE = [['GUGU GAGA', '#0d9488'], ['Emma', '#e8467c'], ['Santi', '#3f8cff'], ['Jesús', '#22b07d']];

function cargaTest(nombre) {
  const src = fs.readFileSync(`${COLAB}/tests/${nombre}.test.cjs`, 'utf8');
  const req = m => m === 'node:test' ? { test() {} } : m === 'esbuild' ? require(COLAB + '/node_modules/esbuild') : require(m);
  const ctx = { require: req, console, process, Buffer, TextEncoder, setTimeout, __dirname: COLAB + '/tests', module: {}, exports: {} };
  vm.createContext(ctx);
  const antes = process.cwd(); process.chdir(COLAB);
  const saca = ['ofertasMemazo', 'MZ_PLANTILLAS', 'reducir', 'azar', 'rondas', 'PM', 'mover', 'sala', 'pon', 'memeDe', 'tic'].map(n => `globalThis.${n} = typeof ${n} !== 'undefined' ? ${n} : undefined;`).join('');
  try { vm.runInContext(src + '\n;' + saca, ctx, { filename: nombre + '.test.cjs' }); } finally { process.chdir(antes); }
  return ctx;
}
const lista = p => Object.keys(p.jugadas).sort().map(k => p.jugadas[k]);

const GENERA = {
  async ajedrez() {
    // La «partida de la ópera» (Morphy, 1858): termina en mate
    const jug = 'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 f1c4 g8f6 f3b3 d8e7 b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 b3b8 d7b8 d1d8'.split(' ');
    const T = cargaTest('ajedrez');
    const p = { juego: 'ajedrez', semilla: 2, color: 'blancas', estado: 'jugando', anfitrion: 'a', cupo: 2, jugadores: { a: { nombre: 'A', orden: 0 }, b: { nombre: 'B', orden: 1 } }, jugadas: {} };
    const e = T.partida(p, jug); console.log('ajedrez', e.fase, e.motivo || '', e.ganador || '');
    return p;
  },
  async flip7() { const T = cargaTest('flip7'); const { p } = await T.juega('venganza', 4, 31); return p; },
  async cacho() { const T = cargaTest('cacho'); const r = T.juega(4, 7); return r.p || r; },
  async catan() { const T = cargaTest('catan'); const { p } = await T.juega(4, 21); return p; },
  async presidente() {
    const T = cargaTest('presidente'); const { p, sec } = T.sala(4, 3), k = T.azar(11);
    T.juega(p, sec, T.reducir(p), k, T.rondas(3)); return p;
  },
  async pokemon() { const T = cargaTest('pokemon'); const r = T.azar(5); const { p } = T.juega('gen9randombattle', null, req => { const o = T.PM.opciones(req); return o[Math.floor(r() * o.length)].c; }); return p; },
};

async function prepara(juego) {
  const f = path.join(__dirname, 'salas', juego + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const p = await GENERA[juego](); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(p)); return p;
}
// Escribe la sala con las primeras `n` jugadas; devuelve { pid, resto } para seguir jugando
async function abre(juego, n, extra = {}) {
  const p = await prepara(juego), todas = lista(p), pid = '-Trailer' + juego[0].toUpperCase() + juego.slice(1);
  const q = JSON.parse(JSON.stringify(p));
  Object.keys(q.jugadores).forEach((u, i) => Object.assign(q.jugadores[u], { nombre: GENTE[i % 4][0], color: GENTE[i % 4][1], at: Date.now() - 60000 }));
  q.jugadas = {}; todas.slice(0, n).forEach((j, i) => { q.jugadas[String(i).padStart(4, '0')] = j; });
  Object.assign(q, { anfitrion: q.anfitrion || 'a', nombre: 'GUGU', at: Date.now() - 600000, toque: Date.now() }, extra);
  await db.put('partidas/' + pid, q);
  let i = n;
  return { pid, total: todas.length, siguiente: async () => { if (i >= todas.length) return null; const j = todas[i]; await db.put(`partidas/${pid}/jugadas/${String(i).padStart(4, '0')}`, j); i++; return j; }, get i() { return i; } };
}
module.exports = { prepara, abre, lista, cargaTest };
if (require.main === module) (async () => {
  for (const j of process.argv.slice(2)) { const p = await prepara(j); const l = lista(p); console.log(j, l.length, 'jugadas;', [...new Set(l.map(x => x.t))].join(',')); }
})().catch(e => { console.error(e); process.exit(1); });
