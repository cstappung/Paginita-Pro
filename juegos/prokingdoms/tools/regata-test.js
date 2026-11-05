// Prueba de la Regata de la Bruma y los duelos navales (Fase 9 «d», pk-30), sin red: carga server/sim.js en el mismo
// proceso con una carpeta de datos temporal y adelanta el reloj a mano. Uso: node tools/regata-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-reg-'));
process.env.PK_TICK_PEREZOSO = '1';
const sim = require('../server/sim.js');
const D = +/D\.PROTO = (\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'))[1];
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };
const falla = fn => { try { fn(); return null; } catch (e) { return e.message; } };
const real = Date.now;
let corre = 0;
Date.now = () => real() + corre;

const nuevo = n => sim.byToken(sim.join({ proto: D, name: n }).player.token);
const a = nuevo('Ana'), b = nuevo('Beto'), c = nuevo('Cata');
sim.tickRegata(); // el servidor lo llama cada 5 s: la primera vez solo anota la semana
// regata
let r = sim.regata(a, { ruta: 'canal', barco: { casco: 0, velas: 0, timon: 0 } });
ok(r.tiempo > 30 && r.tiempo < 120 && r.record && r.mejor === r.tiempo, 'la primera regata da un tiempo y es récord', r.tiempo + ' s');
ok(!!falla(() => sim.regata(a, { ruta: 'atajo' })), 'no hay rutas inventadas');
r = sim.regata(a, { ruta: 'altamar', barco: { casco: 10, velas: 10, timon: 10 } });
ok(r.barcoUsado.velas === 1 && r.barcoUsado.casco === 1, 'el barco no salta de 0 a 10: sube de a poco', JSON.stringify(r.barcoUsado));
corre += 3 * 3600e3;
r = sim.regata(a, { ruta: 'altamar', barco: { casco: 10, velas: 10, timon: 10 } });
ok(r.barcoUsado.velas === 8, 'con horas de por medio sube más (1 + 2 por hora)', r.barcoUsado.velas);
const err = falla(() => sim.regata(a, { ruta: 'canal' }));
ok(err && /3 regatas/.test(err), 'tres regatas por día', err);
ok(r.mejor <= r.tiempo && r.puesto === 1, 'guarda el mejor tiempo de la semana y el puesto en su liga', r.mejor + ' s, puesto ' + r.puesto);
const rk = sim.ranking(a, { cat: 'regata' });
ok(rk.length === 1 && rk[0].v === Math.round(1e5 / r.mejor), 'aparece en el ranking «Regata»', rk[0] && rk[0].v);
// el tiempo lo calcula el servidor con la misma fórmula que el cliente
const t0 = Date.now();
const DD = (() => { const vm = require('vm'), ctx = vm.createContext({ window: {}, console }); for (const f of ['js/util.js', 'js/data.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx); return ctx.window.PK.D; })();
const lento = DD.regataTiempo({}, 'altamar', t0, 1), rapido = DD.regataTiempo({ casco: 10, velas: 10, timon: 10 }, 'altamar', t0, 1);
ok(rapido < lento * 0.75, 'un barco mejorado es mucho más rápido', lento + ' → ' + rapido);
// la liga: el lunes, los mejores ascienden
corre += 1; sim.regata(b, { ruta: 'canal', barco: {} }); sim.regata(c, { ruta: 'canal', barco: {} });
corre += 7 * 864e5; sim.tickRegata();
ok(a.reg.liga === 1 && a.inbox.some(i => i.type === 'res' && /Asciendes/.test(i.text)), 'el primero de la liga asciende y cobra', a.reg.liga);
ok(c.inbox.some(i => i.type === 'res' && i.res.coins > 0), 'todos los que corrieron cobran algo');
sim.tickRegata();
ok(a.reg.liga === 1, 'una sola vez por semana');
// duelos
ok(/anota/.test(falla(() => sim.duelo(a, { id: b.id })) || ''), 'sin flota de duelo no hay duelo');
sim.flotaMar(a, { units: { fragata: 10, infanteria: 20 } });
ok(!!falla(() => sim.flotaMar(b, { units: { galeon: 999 } })), 'una flota no lleva más de ' + 120 + ' barcos');
sim.flotaMar(b, { units: { balandra: 10 } });
const e2 = falla(() => sim.flotaMar(b, { units: { galeon: 100 } }));
ok(e2 && /rápido/.test(e2), 'la flota no crece de golpe', e2);
let info = sim.duelosInfo(a);
ok(info.rivales.some(o => o.id === b.id) && info.trofeos === 100, 've rivales con flota y empieza con 100 trofeos');
let ganadas = 0;
for (let i = 0; i < 5; i++) { const x = sim.duelo(a, { id: b.id }); if (x.resultado.gano) ganadas++; }
ok(ganadas >= 3, 'una flota mucho más fuerte gana casi siempre', ganadas + ' de 5');
ok(/5 duelos/.test(falla(() => sim.duelo(a, { id: b.id })) || ''), 'cinco duelos por día');
ok(b.inbox.some(i => /Duelo naval/.test(i.text)) && b.duelo.hist.length === 5, 'el rival se entera por el buzón y en su historial');
console.log(fallas ? '\n' + fallas + ' fallas.' : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
