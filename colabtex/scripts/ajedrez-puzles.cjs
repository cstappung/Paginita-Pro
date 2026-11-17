/* Genera juegos/club/ajedrez/puzles.js, los puzles de Ajedrez Club, a partir
   de la base de puzles de lichess (dominio público, CC0:
   https://database.lichess.org/#puzzles). La base pesa cientos de MB y no va
   al repo: se baja aparte, se descomprime (basta un trozo, el orden de la
   base es al azar) y se le pasa a este script.

     node scripts/ajedrez-puzles.cjs ruta/lichess_db_puzzle.csv

   Cada puzle se comprueba con el MISMO motor del juego antes de escribirlo:
   todas las jugadas legales, y en los de mate, mate de verdad al final. Si
   alguno no pasa, se descarta (y se dice). La elección es determinista: los
   candidatos de cada grupo se ordenan por dificultad y se toman a
   intervalos parejos, así que el mismo CSV da siempre el mismo archivo.

   Cambiar la lista cambia lo que valen las pruebas guardadas: un puzle que
   desaparece deja de contar en la tabla. Los ids de lichess sirven de
   clave, así que agregar puzles al final o reordenar no rompe nada. */
const fs = require('node:fs'), path = require('node:path');
const M = require('../../juegos/club/ajedrez/motor.js');

const GRUPOS = [
  { id: 'mate1', nombre: 'Mate en 1', n: 15, min: 400, max: 1300, ok: t => t.has('mateIn1') },
  { id: 'mate2', nombre: 'Mate en 2', n: 15, min: 800, max: 1650, ok: t => t.has('mateIn2') },
  { id: 'tactica', nombre: 'Gana material', n: 15, min: 900, max: 1750,
    ok: t => !t.has('mate') && t.has('short') && (t.has('advantage') || t.has('crushing')) && ['fork', 'pin', 'skewer', 'hangingPiece', 'discoveredAttack', 'doubleAttack'].some(x => t.has(x)) },
  { id: 'mate3', nombre: 'Mate en 3', n: 10, min: 1200, max: 1950, ok: t => t.has('mateIn3') },
  { id: 'desafio', nombre: 'Desafío', n: 5, min: 1500, max: 2300, ok: t => t.has('mateIn4') || t.has('mateIn5') }
];
/* El nombre del motivo, que el juego muestra al resolver (antes sería
   regalar la pista). El primero que aparezca en los temas del puzle. */
const MOTIVOS = [
  ['smotheredMate', 'Mate de la coz'], ['backRankMate', 'Mate del pasillo'], ['anastasiaMate', 'Mate de Anastasia'],
  ['arabianMate', 'Mate árabe'], ['bodenMate', 'Mate de Boden'], ['doubleBishopMate', 'Mate de los dos alfiles'],
  ['hookMate', 'Mate del gancho'], ['dovetailMate', 'Mate de la cola de golondrina'], ['killBoxMate', 'Mate de la caja'],
  ['vukovicMate', 'Mate de Vukovic'], ['operaMate', 'Mate de la ópera'], ['balestraMate', 'Mate de Balestra'],
  ['fork', 'Horquilla'], ['pin', 'Clavada'], ['skewer', 'Ensartada'], ['discoveredAttack', 'Ataque descubierto'],
  ['doubleAttack', 'Ataque doble'], ['hangingPiece', 'Pieza colgando'], ['deflection', 'Desviación'],
  ['attraction', 'Atracción'], ['sacrifice', 'Sacrificio'], ['promotion', 'Coronación'], ['quietMove', 'Jugada tranquila']
];

const csv = process.argv[2];
if (!csv) { console.error('Uso: node scripts/ajedrez-puzles.cjs lichess_db_puzzle.csv'); process.exit(1); }
const filas = fs.readFileSync(csv, 'utf8').split('\n').slice(1);

function comprueba(fen, l, mate) {
  const p = M.desdeFEN(fen);
  if (!p) return 'FEN ilegible';
  for (const s of l) { const m = M.deUci(p, s); if (!m) return 'jugada ilegal ' + s; M.hacer(p, m); }
  if (mate && M.fin(p) !== 'mate') return 'no termina en mate';
  return null;
}

const candidatos = GRUPOS.map(() => []);
for (const f of filas) {
  const c = f.split(',');
  if (c.length < 8) continue;
  const [id, fen, movs, rating, desv, pop, jugadas, temas] = c;
  if (+pop < 90 || +jugadas < 2000 || +desv > 80) continue;
  const t = new Set(temas.split(' '));
  GRUPOS.forEach((g, i) => { if (+rating >= g.min && +rating <= g.max && g.ok(t)) candidatos[i].push({ id, fen, l: movs.split(' '), r: +rating, t }); });
}

const usados = new Set(), salida = [];
GRUPOS.forEach((g, i) => {
  const lista = candidatos[i].sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : 1));
  const elegidos = [];
  for (let k = 0; k < g.n && lista.length; k++) {
    let j = Math.floor((k + 0.5) * lista.length / g.n);
    while (j < lista.length && (usados.has(lista[j].id) || comprueba(lista[j].fen, lista[j].l, g.id !== 'tactica'))) {
      if (!usados.has(lista[j].id)) console.warn('descartado', lista[j].id, comprueba(lista[j].fen, lista[j].l, g.id !== 'tactica'));
      j++;
    }
    if (j >= lista.length) continue;
    usados.add(lista[j].id);
    const motivo = (MOTIVOS.find(([k]) => lista[j].t.has(k)) || [])[1] || '';
    elegidos.push({ id: lista[j].id, fen: lista[j].fen, l: lista[j].l, r: lista[j].r, m: motivo });
  }
  console.log(g.nombre + ':', elegidos.length, 'de', lista.length, 'candidatos');
  salida.push({ id: g.id, nombre: g.nombre, puzles: elegidos });
});

const texto = `/* Generado por colabtex/scripts/ajedrez-puzles.cjs: no editar a mano.
   Los puzles salen de la base de puzles de lichess.org (dominio público,
   CC0). Cada uno: id de lichess, la posición antes de la jugada del rival,
   las jugadas en UCI (l[0] la del rival, después se alternan), su rating en
   lichess y el motivo que se muestra al resolverlo. */
(function (root) {
  const GRUPOS = ${JSON.stringify(salida)};
  const api = { GRUPOS, TODOS: GRUPOS.flatMap(g => g.puzles.map(p => Object.assign({ grupo: g.id }, p))) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AjedrezPuzles = api;
})(this);
`;
fs.writeFileSync(path.join(__dirname, '../../juegos/club/ajedrez/puzles.js'), texto);
console.log('escrito puzles.js:', salida.reduce((s, g) => s + g.puzles.length, 0), 'puzles');
