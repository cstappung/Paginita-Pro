// Prueba de la diplomacia (Fase 5, S1, pk-23), sin red: carga server/sim.js en el mismo proceso con una carpeta de
// datos temporal y adelanta el reloj a mano. Uso: node tools/diplo-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-dip-'));
process.env.PK_TICK_PEREZOSO = '1';
const sim = require('../server/sim.js');
const vm = require('vm'), ctx = vm.createContext({ window: {}, console });
for (const f of ['js/util.js', 'js/data.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const D = ctx.window.PK.D;
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };
const real = Date.now;
let corre = 0;
Date.now = () => real() + corre;
const err = fn => { try { fn(); return null; } catch (e) { return e.message; } };

// personalidades: cuatro de cada una, la misma en el servidor y en el cliente
const cuenta = {};
for (const s of D.REALM_SLOTS) cuenta[s.bot.pers] = (cuenta[s.bot.pers] || 0) + 1;
ok(D.PERS_ORDEN.every(k => cuenta[k] === 4), 'cuatro reinos de cada personalidad', JSON.stringify(cuenta));

const j = sim.join({ proto: D.PROTO, name: 'Diplo' }), p = sim.byToken(j.player.token);
p.snap = { era: 4, defense: 900, truce: false, army: 0, score: 0, pop: 30, res: { food: 50000, wood: 50000, stone: 50000, gold: 50000 } };
p.vera = 4;
const r0 = sim.sync(p, { snap: { era: 4, pop: 30, defense: 900, res: p.snap.res } });
ok(r0.diplo && Object.keys(r0.diplo.s).length === 15, 'el sync trae la diplomacia con los 15 reinos');
const r1 = sim.sync(p, { dv: r0.diplo.v, snap: { era: 4, pop: 30, defense: 900, res: p.snap.res } });
ok(r1.diplo === undefined, 'y no la repite si no cambió (S6)');
p.snap.defense = 900; // la foto sin edificios recortó la defensa; para medir la ayuda se fija a mano

const slots = Object.keys(r0.diplo.s).map(Number);
const de = pers => slots.filter(k => D.REALM_SLOTS[k].bot.pers === pers);
const com = de('comerciante')[0], conq = de('conquistador')[0], erm = de('ermitano')[0];
ok(r0.diplo.s[com].rel === D.PERSONALIDADES.comerciante.base && r0.diplo.s[conq].rel === D.PERSONALIDADES.conquistador.base, 'la relación parte de la base de cada personalidad');

// el Conquistador no firma comercio con relación baja; el Comerciante sí
let r = sim.diploPropose(p, { slot: conq, pacto: 'comercio' });
ok(r.ok === false && /pide/.test(r.motivo), 'el Conquistador rechaza un tratado con relación baja', r.motivo);
r = sim.diploPropose(p, { slot: com, pacto: 'comercio' });
ok(r.ok && r.diplo.s[com].tratado, 'el Comerciante acepta el tratado de comercio');

// regalos: suben la relación, tope por día
const antes = r.diplo.s[erm].rel;
r = sim.diploGift(p, { slot: erm, res: 'gold', n: 2000 });
ok(r.accepted === 2000 && r.diplo.s[erm].rel > antes, 'un regalo sube la relación', antes + ' → ' + r.diplo.s[erm].rel);
sim.diploGift(p, { slot: erm, res: 'gold', n: 100 }); sim.diploGift(p, { slot: erm, res: 'gold', n: 100 });
ok(/regalos hoy/.test(err(() => sim.diploGift(p, { slot: erm, res: 'gold', n: 100 })) || ''), 'como mucho ' + D.DIPLO.regalosDia + ' regalos por día a un reino');
ok(/no se regala/.test(err(() => sim.diploGift(p, { slot: com, res: 'machinery', n: 1 })) || ''), 'solo se regalan los recursos de la lista');

// alianza: con relación alta; el aliado ayuda contra un saqueo
p.diplo.s[com].rel = 70; p.diplo.v++;
r = sim.diploPropose(p, { slot: com, pacto: 'alianza' });
ok(r.ok && r.diplo.s[com].pacto === 'alianza', 'con relación 70 el Comerciante acepta la alianza');
ok(/aliados|Ya son/.test(err(() => sim.diploPropose(p, { slot: com, pacto: 'alianza' })) || sim.diploPropose(p, { slot: com, pacto: 'alianza' }).motivo), 'no se firma dos veces');

// saqueos: ningún aliado ni pacto manda partidas; con todos en paz, nadie viene
p.lastSeen = Date.now(); p.saqNext = 1;
for (let i = 0; i < 40; i++) { p.saqueo = null; p.saqNext = 1; sim.tickSaqueos(); if (p.saqueo && p.saqueo.slot === com) break; }
ok(!p.saqueo || p.saqueo.slot !== com, 'un aliado nunca manda una partida de saqueo');
// pedir ayuda: ahora se puede, y la defensa sube
p.saqueo = null; p.saqNext = 1; p.lastSeen = Date.now(); sim.tickSaqueos();
const q = p.saqueo;
ok(q && sim.saqueo(p, { id: q.id, accion: 'ayuda' }).saqueo.eleccion === 'ayuda', 'con un aliado se puede pedir ayuda', q && q.from);
corre += 200e3; p.lastSeen = Date.now(); sim.tickSaqueos();
const fin = p.inbox.filter(i => i.type === 'saqueo_fin').pop();
ok(fin && fin.ayuda && fin.aliados.length === 1, 'el aliado suma a la defensa y sale en el informe', fin && fin.aliados.join(', ') + ' · ' + fin.def + ' contra ' + fin.atk);

// un pacto que se firmó con relación alta se rompe solo si la relación cae mucho
p.diplo.s[erm].pacto = 'noAgresion'; p.diplo.s[erm].rel = -40; corre += 3600e3;
ok(sim.diploInfo(p).s[erm].pacto === null && p.inbox.some(i => /rompió/.test(i.text || '')), 'con la relación por el suelo, el reino rompe el pacto');
// pactos con todos: nadie saquea
for (const k of slots) { p.diplo.s[k].pacto = 'noAgresion'; p.diplo.s[k].rel = 100; }
p.saqueo = null; p.saqNext = 1; corre += 60e3; p.lastSeen = Date.now(); sim.tickSaqueos();
ok(!p.saqueo && p.saqNext > Date.now() + 3600e3, 'en paz con todos los vecinos no viene nadie', JSON.stringify(p.saqueo) + ' ' + (p.saqNext - Date.now()));

// el ritmo: un vecino Conquistador hostil acorta la espera
for (const k of slots) { p.diplo.s[k].pacto = 'noAgresion'; }
p.diplo.s[conq].pacto = null;
p.saqueo = null; p.saqNext = 1; p.lastSeen = Date.now(); const t0 = Date.now(); sim.tickSaqueos();
const espera = (p.saqNext - t0) / 3600e3;
ok(p.saqueo && p.saqueo.slot === conq && p.saqueo.pers === 'conquistador' && espera <= 5 * 0.6 + 0.01, 'solo queda el Conquistador: viene él y vuelve antes', espera.toFixed(2) + ' h');

// ultimátum: pagar lo calma; rechazarlo trae una partida enseguida
p.saqueo.fin = true; p.diplo.s[conq].rel = -30;
p.diplo.ev = null; p.diplo.evNext = 1;
for (let i = 0; i < 60 && !(p.diplo.ev && p.diplo.ev.tipo === 'ultimatum'); i++) { p.diplo.ev = null; p.diplo.evNext = 1; p.lastSeen = Date.now(); sim.tickDiplo(); }
const ev = p.diplo.ev;
ok(ev && ev.tipo === 'ultimatum' && ev.slot === conq && ev.pide.gold > 0, 'un Conquistador hostil manda un ultimátum', ev && ev.pide.gold + ' de oro');
r = sim.diploEvento(p, { id: ev.id, acc: 'rechazar' });
p.saqueo = null; p.lastSeen = Date.now(); sim.tickSaqueos();
ok(p.saqueo && p.saqueo.slot === conq, 'rechazarlo trae su partida enseguida');

// conquista: un pacto la impide
p.diplo.s[erm].pacto = 'noAgresion';
const w = sim.join({ proto: D.PROTO, token: p.token }).world;
ok(true, 'mundo ' + w.name);

// dos jugadores: propuesta y respuesta
const j2 = sim.join({ proto: D.PROTO, name: 'Vecina' }), o = sim.byToken(j2.player.token);
o.snap = { era: 3, defense: 300, truce: false, army: 0, score: 0, pop: 20, res: { food: 5000, wood: 5000, stone: 5000, gold: 5000 } }; o.vera = 3;
r = sim.diploPropose(p, { slot: o.slot, pacto: 'noAgresion' });
const prop = sim.diploInfo(o).prop[0];
ok(r.ok && prop && prop.pacto === 'noAgresion' && o.inbox.some(i => i.type === 'diplo'), 'a un jugador real la propuesta le llega por el buzón');
r = sim.diploAccept(o, { id: prop.id, si: true });
ok(sim.diploInfo(p).s[o.slot].pacto === 'noAgresion' && r.diplo.s[p.slot].pacto === 'noAgresion', 'al aceptarla, queda firmada para los dos');
const conqErr = err(() => sim.conquer(p, { k: 0, units: {}, power: 1 }));
ok(!!conqErr, 'conquistar sigue validando (parcela 0)', conqErr);
r = sim.diploGift(p, { slot: o.slot, res: 'food', n: 100 });
ok(r.accepted > 0 && o.inbox.some(i => i.type === 'res' && i.res.food), 'un regalo a un jugador le llega como recurso');

console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
