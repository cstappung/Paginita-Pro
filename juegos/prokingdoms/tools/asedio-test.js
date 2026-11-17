// Prueba de los asedios entre jugadores (plan de guerra, G3), sin red: carga server/sim.js en el mismo proceso con
// una carpeta de datos temporal y adelanta el reloj a mano. Uso: node tools/asedio-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-ase-'));
process.env.PK_TICK_PEREZOSO = '1';
const sim = require('../server/sim.js');
const PROTO = +/D\.PROTO = (\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'))[1];
let fallas = 0;
const ok = (c, que, det) => { console.log((c ? '  ok    ' : '  FALLA ') + que + (det !== undefined ? '  → ' + det : '')); if (!c) fallas++; };
const real = Date.now;
let corre = 0;
Date.now = () => real() + corre;
const store = require('../server/store.js');

const A = sim.byToken(sim.join({ proto: PROTO, name: 'Ana' }).player.token), B = sim.byToken(sim.join({ proto: PROTO, name: 'Bruno' }).player.token);
const C = sim.byToken(sim.join({ proto: PROTO, name: 'Carla' }).player.token);
const w = store.get('worlds', A.world);
const foto = (p, army) => { p.snap = { era: 4, pop: 400, defense: 300, truce: false, army, score: 900, res: {}, walls: 0, walled: [], wallMult: 1, terrMult: 1 }; };
// una frontera: una parcela de Bruno pegada a una de Ana (se arma a mano en el mapa del mundo)
const PW = Math.round(Math.sqrt(w.terr.length));
let kA = -1, kB = -1;
for (let k = 0; k < w.terr.length && kB < 0; k++) {
  if (w.terr[k] !== 0 || (k % PW) >= PW - 1 || w.terr[k + 1] !== 0) continue;
  kA = k; kB = k + 1;
}
w.terr[kA] = A.slot + 1; w.terr[kB] = B.slot + 1;
const sync = (p, asv) => sim.sync(p, { asv });
const una = fuerza => {
  foto(A, 50000); foto(B, 300); foto(C, 0); w.tshield = {};
  w.terr[kB] = B.slot + 1;
  A.inbox = []; B.inbox = [];
  return sim.conquer(A, { k: kB, units: { militia: 200, spear: 200 }, power: fuerza });
};

let r = una(4000);
ok(r.ok && r.arrive > Date.now(), 'la campaña sale y tarda en llegar');
let err = null;
try { sim.conquer(C, { k: kB, units: { militia: 5 }, power: 10 }); } catch (e) { err = e.message; }
ok(!!err, 'nadie más ataca esa parcela mientras tanto', err);
ok(sync(B, -1).incoming.length === 1 && !sync(C, -1).asedios.length, 'en marcha: el defensor la ve venir y todavía no hay asedio');
corre += r.arrive - Date.now() + 2000;
sim.tickCamps();
const camp = store.all('camps')[0];
ok(camp && camp.plan && camp.ini === r.arrive && w.terr[kB] === B.slot + 1, 'al llegar empieza el asedio y la parcela sigue siendo del defensor');
ok(B.inbox.some(i => i.type === 'siege_start'), 'el defensor recibe el aviso de que empezó');
ok(!A.inbox.some(i => i.type === 'conquest_result'), 'el atacante todavía no recibe el resultado');
const v1 = sync(C, -1), a1 = v1.asedios[0];
ok(a1 && a1.k === kB && a1.de === A.slot && a1.a === B.slot && a1.plan.etapas.length === 1, 'un tercero lo ve, con una sola etapa', JSON.stringify(a1 && a1.plan.etapas.map(e => e.id)));
ok(camp.plan.etapas.length < 2 || (a1.plan.parcial && a1.plan.gano === undefined && a1.plan.atk === a1.plan.def && a1.plan.semilla !== camp.plan.semilla), 'sin el final: ni quién gana, ni la fuerza real, ni la semilla del plan');
ok(sync(C, v1.asv).asedios === undefined, 'si no cambió, la lista no viaja');
ok(!sync(B, -1).incoming.length, 'el aviso de «en camino» ya no sale');
// reinicio a mitad de asedio: el plan está guardado en la campaña
const guardado = JSON.stringify(store.get('camps', camp.id).plan);
// avanza etapa por etapa: la lista cambia y nunca trae etapas sin empezar
let cambios = 1, ant = v1.asv, limpio = true;
for (let s = 0; s < camp.plan.total + 5; s += 5) {
  corre += 5000; sim.tickCamps();
  const v = sync(C, ant);
  if (v.asedios) { cambios++; ant = v.asv; for (const a of v.asedios) { const t = (Date.now() - a.ini) / 1000; if (a.plan.etapas.some(e => e.t0 > t)) limpio = false; if (a.plan.parcial && a.plan.gano !== undefined) limpio = false; } }
}
ok(limpio, 'el sync nunca incluye etapas sin empezar ni el final antes de la última');
ok(cambios >= 2 && cambios <= camp.plan.etapas.length + 2, 'la lista cambia unas pocas veces por asedio', cambios);
ok(guardado === JSON.stringify(camp.plan), 'el plan no cambió durante la pelea');
const res = A.inbox.find(i => i.type === 'conquest_result');
ok(res && res.won === camp.plan.gano && res.plan && res.plan.bajas === camp.plan.bajas && res.rid === r.id, 'al terminar, el atacante recibe el resultado del plan, con el plan entero', res && res.won);
ok(!store.all('camps').length && (w.terr[kB] === (camp.plan.gano ? A.slot : B.slot) + 1), 'la parcela cambia de dueño solo si ganó');
ok(B.inbox.some(i => (i.type === (camp.plan.gano ? 'parcel_lost' : 'parcel_defended')) && i.plan), 'el defensor recibe el suyo, con el plan para la repetición');

// muchos asedios seguidos: gana quien el plan dice, y el plan sale de fuerza contra defensa
let gano = 0, N = 60;
for (let i = 0; i < N; i++) {
  r = una(300 + i * 150);
  const c = store.all('camps')[0];
  corre += 3600e3; sim.tickCamps(); // llegada (y si pasó todo el asedio, final)
  const c2 = store.get('camps', c.id);
  if (c2) { corre += 3600e3; sim.tickCamps(); }
  const it = A.inbox.find(x => x.type === 'conquest_result');
  if (it.won !== it.plan.gano) { fallas++; console.log('  FALLA el resultado no es el del plan'); break; }
  if (it.won) gano++;
}
ok(true, 'cada resultado es el del plan (' + N + ' asedios, ganó ' + gano + ')');
// máximo dos campañas contra el mismo defensor
foto(A, 50000); foto(B, 300); foto(C, 50000); w.tshield = {}; w.terr[kB] = B.slot + 1;
const kB2 = kB + 1 < w.terr.length && (kB + 1) % PW ? kB + 1 : kB - 2, kB3 = kB + PW;
for (const k of [kB2, kB3]) w.terr[k] = B.slot + 1;
w.terr[kB + PW - 1] = A.slot + 1;
sim.conquer(A, { k: kB, units: { militia: 50 }, power: 500 });
try { sim.conquer(A, { k: kB3, units: { militia: 50 }, power: 500 }); err = null; } catch (e) { err = e.message; }
ok(!err, 'se permite una segunda campaña contra el mismo reino', err);
w.terr[kB2 + PW] = C.slot + 1;
try { sim.conquer(C, { k: kB2, units: { militia: 50 }, power: 500 }); err = null; } catch (e) { err = e.message; }
ok(err && /dos campañas/.test(err), 'y la tercera se rechaza', err);

// ---------- G4: decisiones ----------
for (const c of store.all('camps')) store.del('camps', c.id);
const llegar = (fuerza, tactica) => {
  foto(A, 50000); foto(B, 300); w.tshield = {}; w.terr[kB] = B.slot + 1; A.inbox = []; B.inbox = [];
  const r = sim.conquer(A, { k: kB, units: { militia: 200, spear: 200 }, power: fuerza, tactica });
  corre += r.arrive - Date.now() + 3000; sim.tickCamps();
  return store.get('camps', r.id);
};
const falla = f => { try { f(); return null; } catch (e) { return e.message; } };
let c = llegar(900, 'asalto');
ok(c.plan.tac === 'asalto', 'la táctica elegida al lanzar llega al plan');
ok(/tuyo/.test(falla(() => sim.asedio(C, { id: c.id, accion: 'retirada' })) || ''), 'un tercero no decide en un asedio ajeno');
ok(!!falla(() => sim.asedio(B, { id: c.id, accion: 'retirada' })) && !!falla(() => sim.asedio(A, { id: c.id, accion: 'rendir' })), 'cada bando solo tiene sus decisiones');
const v0 = w.asv, t0 = c.plan.total;
sim.asedio(A, { id: c.id, accion: 'tactica', tactica: 'cerco' });
c = store.get('camps', c.id);
ok(c.plan.tac === 'cerco' && c.plan.total > t0 && w.asv > v0, 'cambiar a cerco alarga el asedio y avisa a todos');
ok(!!falla(() => sim.asedio(A, { id: c.id, accion: 'tactica', tactica: 'asalto' })), 'la táctica se cambia una sola vez');
const d0 = c.plan.def, ej = B.snap.army;
sim.asedio(B, { id: c.id, accion: 'salida' });
c = store.get('camps', c.id);
ok(c.plan.def > d0 && B.snap.army < ej, 'la salida suma resistencia y gasta ejército del defensor', Math.round(d0) + ' → ' + c.plan.def);
ok(!!falla(() => sim.asedio(B, { id: c.id, accion: 'salida' })), 'la salida es una por asedio');
const antes = A.snap.army;
const rr = sim.asedio(A, { id: c.id, accion: 'refuerzo', units: { militia: 100, spear: 100 }, power: 1e9 });
ok(rr.llega > Date.now() && A.snap.army < antes, 'los refuerzos salen del ejército de la foto (lo que pide de más se recorta)');
ok(!!falla(() => sim.asedio(A, { id: c.id, accion: 'refuerzo', units: { militia: 5 }, power: 10 })), 'una sola columna de refuerzos');
const a0 = c.plan.atk;
corre += rr.llega - Date.now() + 1000; sim.tickCamps();
c = store.get('camps', c.id);
ok(c && c.ref.ok && c.plan.atk > a0 && c.units.militia === 300, 'al llegar suman su fuerza y sus tropas', a0 + ' → ' + (c && c.plan.atk));
sim.asedio(A, { id: c.id, accion: 'retirada' });
c = store.get('camps', c.id);
ok(c.plan.fin === 'retirada' && !c.plan.gano && c.plan.bajas <= 0.5, 'la retirada corta el asedio', 'bajas ' + c.plan.bajas.toFixed(2));
corre += 5000; sim.tickCamps();
const fr = A.inbox.find(i => i.type === 'conquest_result');
ok(fr && !fr.won && fr.plan.fin === 'retirada' && w.terr[kB] === B.slot + 1 && !store.all('camps').length, 'y la parcela sigue siendo del defensor');
ok(!!falla(() => sim.asedio(A, { id: c.id, accion: 'tactica' })), 'terminado el asedio, ya no hay decisiones');
// rendición
c = llegar(900);
sim.asedio(B, { id: c.id, accion: 'rendir' });
corre += 5000; sim.tickCamps();
const fz = A.inbox.find(i => i.type === 'conquest_result');
ok(fz && fz.won && fz.plan.bajas === 0 && fz.plan.fin === 'rendir' && w.terr[kB] === A.slot + 1, 'rendir la parcela: cambia de dueño sin bajas');
// refuerzos que no alcanzan a llegar
c = llegar(900);
sim.asedio(A, { id: c.id, accion: 'refuerzo', units: { militia: 50 }, power: 300 });
sim.asedio(A, { id: c.id, accion: 'retirada' });
corre += 5000; sim.tickCamps();
ok(A.inbox.find(i => i.type === 'conquest_result').vuelve === true, 'si el asedio termina antes, los refuerzos vuelven a casa');
// lo que ve un tercero nunca trae con qué recalcular
c = llegar(900);
const vis = sim.sync(C, { asv: -1 }).asedios[0].plan;
ok(vis.res === undefined && vis.rb === undefined && vis.atkR === undefined && vis.semilla !== c.plan.semilla, 'la vista no trae las tiradas ni la semilla del plan');


// ---------- G5: el Fuerte fronterizo cuenta en la defensa de la parcela ----------
for (const x of store.all('camps')) store.del('camps', x.id);
c = llegar(900);
const sinFuerte = c.plan.parts.towers;
for (const x of store.all('camps')) store.del('camps', x.id);
B.buildings = [['fuerte', (kB % PW) * 8 + 2, Math.floor(kB / PW) * 8 + 2, 1, 1]];
c = llegar(900);
ok(sinFuerte === 0 && c.plan.parts.towers > 100, 'un Fuerte en la parcela suma a la etapa de las defensas', sinFuerte + ' → ' + c.plan.parts.towers);
B.buildings = [['fuerte', (kB % PW) * 8 + 2 + 14, Math.floor(kB / PW) * 8 + 2, 1, 1]];
for (const x of store.all('camps')) store.del('camps', x.id);
c = llegar(900);
ok(c.plan.parts.towers > 100, 'y también a casi 2 parcelas de distancia', c.plan.parts.towers);
B.buildings = [];

console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTodo bien.');
process.exit(fallas ? 1 : 0);
