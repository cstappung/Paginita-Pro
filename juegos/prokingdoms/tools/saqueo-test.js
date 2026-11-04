// Prueba de las partidas de saqueo de los reinos simulados (C6, pk-22), sin red: carga server/sim.js en el mismo
// proceso con una carpeta de datos temporal y adelanta el reloj a mano. Uso: node tools/saqueo-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-saq-'));
process.env.PK_TICK_PEREZOSO = '1';
const sim = require('../server/sim.js');
const D = +/D\.PROTO = (\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'))[1];
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };
const real = Date.now;
let corre = 0;
Date.now = () => real() + corre;

const j = sim.join({ proto: D, name: 'Prueba' }), p = sim.byToken(j.player.token);
p.snap = { era: 4, defense: 900, truce: false, army: 0, score: 0, res: {} };
sim.tickSaqueos();
ok(!p.saqueo && p.saqNext > Date.now(), 'la primera vez solo se agenda (no llega enseguida)');
corre += 2 * 3600e3; p.lastSeen = Date.now();
sim.tickSaqueos();
ok(p.saqueo && !p.saqueo.fin && p.inbox.some(i => i.type === 'saqueo'), 'después llega una partida, con aviso en el buzón', p.saqueo && p.saqueo.from + ' fuerza ' + p.saqueo.power);
let err = null;
try { sim.saqueo(p, { id: p.saqueo.id, accion: 'ayuda' }); } catch (e) { err = e.message; }
ok(err && /aliado/.test(err), 'sin aliados no se pide ayuda', err);
try { sim.saqueo(p, { id: 'otra', accion: 'pelear' }); err = null; } catch (e) { err = e.message; }
ok(!!err, 'no se elige por una partida que no es la tuya', err);
sim.saqueo(p, { id: p.saqueo.id, accion: 'pelear' });
corre += 200e3; p.lastSeen = Date.now();
sim.tickSaqueos();
const fin = p.inbox.filter(i => i.type === 'saqueo_fin').pop();
ok(p.saqueo.fin && fin && (fin.res === 'gano' ? fin.premio && fin.premio.gold > 0 : fin.pct === 0.08 && fin.tope > 0), 'al llegar, el servidor decide y lo avisa por el buzón', fin && fin.res + ' (' + fin.def + ' contra ' + fin.atk + ')');
// tributo
corre += 6 * 3600e3; p.lastSeen = Date.now();
sim.tickSaqueos();
ok(p.saqueo && !p.saqueo.fin, 'la siguiente partida llega horas después');
const r = sim.saqueo(p, { id: p.saqueo.id, accion: 'tributo' });
ok(p.saqueo.fin && r.inbox.some(i => i.type === 'saqueo_fin' && i.res === 'tributo'), 'el tributo las devuelve a casa en el acto');
try { sim.saqueo(p, { id: p.saqueo.id, accion: 'pelear' }); err = null; } catch (e) { err = e.message; }
ok(!!err, 'y ya no se puede cambiar de opinión', err);
// en tregua o antes de la Era IV, nada
const j2 = sim.join({ proto: D, name: 'Novata' }), q = sim.byToken(j2.player.token);
q.snap = { era: 3, defense: 100, truce: false }; q.saqNext = 1;
corre += 6 * 3600e3; q.lastSeen = Date.now();
sim.tickSaqueos();
ok(!q.saqueo, 'antes de la Era IV no hay saqueos');
console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
