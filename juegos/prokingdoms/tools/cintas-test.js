// Prueba de las cintas y los aspectos que ven los vecinos (pk-80), sin red: carga server/sim.js en el mismo proceso
// con una carpeta de datos temporal. Uso: node tools/cintas-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-cin-'));
process.env.PK_TICK_PEREZOSO = '1';
const sim = require('../server/sim.js');
const vm = require('vm'), ctx = vm.createContext({ window: {}, console });
for (const f of ['js/util.js', 'js/data.js', 'js/pase.js', 'js/world.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const PK = ctx.window.PK, D = PK.D, W = PK.World;
D.setupRealms(-1, null);
W.generate(D.SEED);
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };

const snapDe = extra => Object.assign({ era: 4, pop: 30, defense: 100, res: { food: 100, wood: 100, stone: 100, gold: 100 } }, extra);
const ja = sim.join({ proto: D.PROTO, name: 'Cintera' }), a = sim.byToken(ja.player.token);
const jb = sim.join({ proto: D.PROTO, name: 'Vecina' }), b = sim.byToken(jb.player.token);
ok(a.world === b.world, 'los dos jugadores están en el mismo mundo');
// casillas de la parcela de A (el reparto inicial del mapa) y una de afuera
const propias = [], ajena = [];
for (let k = 0; k < D.MAP * D.MAP && (propias.length < 3 || !ajena.length); k++) {
  const t = W.terrStart[W.parcel(k % D.MAP, Math.floor(k / D.MAP))];
  if (t === a.slot + 1) propias.push(k); else if (t === b.slot + 1) ajena.push(k);
}
const asp = Object.keys(D.PASE_TEMAS).map(t => t + ':edificio').find(id => { const x = D.aspecto(id); return x && x.o && x.o.b; });
const tipoAsp = D.aspecto(asp).o.b;

sim.sync(a, { snap: snapDe({
  cintas: { v: 'c1', t: [[propias[0], 'c', 0, 3, 2], [ajena[0], 'c', 0, 3, 2], [propias[1], 'zz', 0, 1, 0], [propias[2], 'u', 1, 9, 99]] },
  cf: { v: 'f1', s: 'a.<b' },
  asp: { v: 'a1', b: { [tipoAsp]: asp, tc: 'no:existe' }, o: { '10,12': asp, 'x': asp }, c: [300, 20, 40] },
}) });
let r = sim.sync(b, { snap: snapDe({}) });
let va = r.players.find(o => o.id === a.id);
ok(va && Array.isArray(va.cintas), 'la vecina recibe las cintas');
ok(va.cintas.length === 2 && va.cintas[0][0] === propias[0] && va.cintas[1][0] === propias[2], 'solo las piezas válidas de su parcela', JSON.stringify(va.cintas));
ok(va.cintas[1][3] === 5 && va.cintas[1][4] === 15, 'nivel y dato extra recortados a su rango', JSON.stringify(va.cintas[1]));
ok(va.cf === 'ab', 'lo que corre queda alineado con las piezas que pasaron (y sin caracteres raros)', va.cf);
ok(va.asp && va.asp.b[tipoAsp] === asp && !va.asp.b.tc, 'los aspectos que existen pasan; los inventados no', JSON.stringify(va.asp.b));
ok(va.asp.o['10,12'] === asp && !va.asp.o.x, 'el aspecto propio de un edificio va por su casilla', JSON.stringify(va.asp.o));
ok(va.asp.c[0] === 255 && va.asp.c[1] === 20, 'el color de banderas se recorta a 0..255', JSON.stringify(va.asp.c));

const ck1 = va.ck;
r = sim.sync(b, { snap: snapDe({}), ck: { [a.id]: va.ck, [a.id + ':f']: va.cfv }, av: { [a.id]: va.av } });
va = r.players.find(o => o.id === a.id);
ok(va.cintas === undefined && va.cf === undefined && va.asp === undefined, 'si ya los tiene, no vuelven a viajar');

sim.sync(a, { snap: snapDe({ cf: { v: 'f2', s: '..' } }) });
r = sim.sync(b, { snap: snapDe({}), ck: { [a.id]: ck1 }, av: {} });
va = r.players.find(o => o.id === a.id);
ok(va.cintas === undefined && va.cf === '..', 'si cambia solo lo que corre, viaja solo eso', va.cf);

a.lastSeen = Date.now() - 10 * 60 * 1000; // A se desconecta
r = sim.sync(b, { snap: snapDe({}), ck: {}, av: {} });
va = r.players.find(o => o.id === a.id);
ok(!va.online && Array.isArray(va.cintas) && va.cf === undefined, 'desconectada: se ven sus cintas, pero nada corre por ellas');

console.log(fallas ? fallas + ' FALLAS' : 'todo bien');
process.exit(fallas ? 1 : 0);
