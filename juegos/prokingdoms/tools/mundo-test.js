// Prueba del mundo vivo (Fase 5, S2 a S5, pk-24): caravanas, jefe semanal del gremio, visitas y rankings con
// títulos. Sin red: carga server/sim.js en el mismo proceso y adelanta el reloj a mano. Uso: node tools/mundo-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.PK_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-mun-'));
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
const silencio = console.warn; console.warn = () => {}; console.log2 = console.log;
const nuevo = (name, era) => {
  const j = sim.join({ proto: D.PROTO, name }), p = sim.byToken(j.player.token);
  p.snap = { era, defense: 900, truce: false, army: 5000, score: 0, pop: 60, total: 0, res: { food: 90000, wood: 90000, stone: 90000, gold: 90000 } }; p.vera = era;
  return p;
};
const p = nuevo('Mercader', 4);
sim.diploInfo(p);
const slots = Object.keys(p.diplo.s).map(Number);

// S2. Caravanas
ok(/tratado/.test(err(() => sim.caravana(p, { slot: slots[0] })) || ''), 'sin tratado de comercio no sale la caravana');
p.diplo.s[slots[0]].tratado = true; p.diplo.s[slots[0]].rel = 50; p.diplo.s[slots[1]].tratado = true; p.diplo.s[slots[1]].rel = 50; p.diplo.s[slots[2]].tratado = true; p.diplo.s[slots[2]].rel = 50;
let r = sim.caravana(p, { slot: slots[0] });
ok(r.caravanas.length === 1 && r.caravanas[0].oro > 0 && !r.paga, 'con tratado sale una caravana, sin pagar nada', r.caravanas[0].oro + ' de oro, riesgo ' + Math.round(r.caravanas[0].riesgo * 100) + '%');
r = sim.caravana(p, { slot: slots[1], escolta: true });
const conEsc = r.caravanas[1];
ok(r.paga && r.paga.food > 0 && conEsc.riesgo < D.caravanaRiesgo(D.distReinos(p.slot, slots[1]), false, false), 'con escolta se paga y baja el riesgo', Math.round(conEsc.riesgo * 100) + '%');
ok(/en camino/.test(err(() => sim.caravana(p, { slot: slots[2] })) || ''), 'como mucho ' + D.CARAVANA.max + ' a la vez');
corre += 3 * 3600e3; sim.tickCaravanas();
const vueltas = p.inbox.filter(i => i.type === 'caravana');
ok(vueltas.length === 2 && vueltas.every(i => i.res.gold > 0) && !p.caravanas.length, 'al volver, el oro llega por el buzón', vueltas.map(i => i.res.gold + (i.asalto ? ' (asaltada)' : '')).join(', '));
// riesgo: con muchas caravanas lejanas sin escolta, alguna es asaltada; nunca más del tope
let asaltos = 0, n = 0;
for (let i = 0; i < 400; i++) { p.caravanas = []; p.day = null; p.diplo.s[slots[14]].tratado = true; p.diplo.s[slots[14]].rel = 80; sim.caravana(p, { slot: slots[14] }); corre += 3 * 3600e3; sim.tickCaravanas(); n++; if (p.inbox.filter(x => x.type === 'caravana').pop().asalto) asaltos++; }
const esp = D.caravanaRiesgo(D.distReinos(p.slot, slots[14]), false, false);
ok(Math.abs(asaltos / n - esp) < 4 * Math.sqrt((esp * (1 - esp)) / n), 'los asaltos siguen el riesgo de la ruta (4 desviaciones)', Math.round((asaltos / n) * 100) + '% contra ' + Math.round(esp * 100) + '% esperado');

// S3. Jefe semanal del gremio
const g = sim.createGuild(p, { name: 'Prueba' });
let gi = sim.listGuilds(p).mine.jefe;
ok(gi && gi.hp === gi.max && gi.max > 0, 'el gremio tiene su jefe de la semana', gi.name + ', vida ' + gi.max);
p.snap.army = 5000;
r = sim.guildBoss(p, { units: { spear: 40, archer: 20 }, power: 4000 });
ok(r.dano > 0 && r.guilds.mine.jefe.mio === r.dano && r.bajas > 0, 'atacar resta vida y queda anotado', r.dano + ' de daño');
p.snap.army = 5000; sim.guildBoss(p, { units: { spear: 40 }, power: 4000 }); p.snap.army = 5000; sim.guildBoss(p, { units: { spear: 40 }, power: 4000 });
ok(/veces hoy/.test(err(() => { p.snap.army = 5000; sim.guildBoss(p, { units: { spear: 40 }, power: 4000 }); }) || ''), D.JEFE_GREMIO.ataquesDia + ' ataques por día');
const antes = sim.listGuilds(p).mine.jefe.hp;
p.snap.army = 10; p.day = null;
r = sim.guildBoss(p, { units: { spear: 40 }, power: 1e9 });
ok(r.dano < 200, 'la fuerza la valida el servidor (no se pega con un número inventado)', r.dano + ' de daño con fuerza pedida 1e9');
// tramos: llevarlo hasta el final a mano
const G = require('../server/store.js').all('guilds').find(x => x.name === 'Prueba');
const premiosAntes = p.inbox.filter(i => i.type === 'jefe_gremio').length;
p.day = null; p.snap.army = 1e7;
for (let i = 0; i < 3 && G.jefe.hp > 0; i++) { p.snap.army = 1e7; try { sim.guildBoss(p, { units: { knight: 60 }, power: 1e7 }); } catch (e) { break; } }
if (G.jefe.hp > 0) { G.jefe.dano[p.id] += G.jefe.hp - 1; G.jefe.hp = 1; p.day = null; p.snap.army = 1e5; sim.guildBoss(p, { units: { knight: 60 }, power: 1e5 }); }
const premios = p.inbox.filter(i => i.type === 'jefe_gremio');
ok(G.jefe.hp === 0 && premios.length === D.JEFE_GREMIO.tramos.length && p.jefes === 1, 'al caer, un premio por tramo y cuenta para el ranking', premios.length + ' premios (' + premiosAntes + ' antes del último golpe)');
corre += 7 * 864e5; sim.tickJefes();
ok(sim.listGuilds(p).mine.jefe.hp > 0 && sim.listGuilds(p).mine.jefe.name !== gi.name, 'la semana siguiente llega otro jefe', sim.listGuilds(p).mine.jefe.name);

// S4. Visitas
const o = nuevo('Visitada', 3);
o.buildings = [['tc', 10, 10, 1, 3], ['house', 14, 10, 1, 2]];
r = sim.visita(p, { id: o.id });
ok(r.buildings.length === 2 && r.visitas === 1, 'la visita muestra sus edificios y cuenta una vez');
sim.visita(p, { id: o.id });
ok(sim.visita(p, { id: o.id }).visitas === 1, 'el mismo visitante cuenta una vez por día');
r = sim.visitaLike(p, { id: o.id });
ok(r.likes === 1 && r.yaLike && /me gusta/.test(err(() => sim.visitaLike(p, { id: o.id })) || ''), 'un «me gusta» por día');
r = sim.visitaRegalo(p, { id: o.id });
ok(r.paga && r.paga.gold > 0 && o.inbox.some(i => i.type === 'res' && i.res.gold === r.paga.gold), 'el regalo le llega por el buzón');
ok(/no existe/.test(err(() => sim.visita(p, { id: p.id })) || ''), 'no te visitas a ti mismo');

// S5. Rankings: la foto sube despacio y los títulos salen el lunes
sim.tickTitulos(); // la primera vez solo anota la semana
sim.sync(p, { snap: { era: 4, pop: 60, defense: 900, res: p.snap.res, rk: { wonder: 50, floor: 15, def: 40 } } });
ok(p.rk.wonder <= 3 && p.rk.floor <= 5 && p.rk.def <= 3, 'la foto no puede saltar en el ranking', JSON.stringify(p.rk));
for (let i = 0; i < 6; i++) sim.sync(p, { snap: { era: 4, pop: 60, defense: 900, res: p.snap.res, rk: { wonder: 12, floor: 15, def: 40 } } });
ok(p.rk.wonder === 12 && p.rk.floor === 15, 'pero llega con varias fotos', JSON.stringify(p.rk));
const rk = sim.ranking(p, { cat: 'piso' });
ok(rk[0].name === 'Mercader' && rk[0].v === 15, 'ranking por piso más profundo');
ok(sim.ranking(p, { cat: 'visitas' })[0].name === 'Visitada', 'ranking de más visitados');
corre += 7 * 864e5; p.lastSeen = Date.now(); o.lastSeen = Date.now();
sim.tickTitulos();
ok(p.inbox.some(i => i.type === 'titulo') && sim.ranking(p, { cat: 'piso' })[0].titulo, 'el lunes, títulos de la semana', sim.ranking(p, { cat: 'piso' })[0].titulo);

console.warn = silencio;
console.log(fallas ? '\n' + fallas + ' FALLAS' : '\nTodo en orden.');
process.exit(fallas ? 1 : 0);
