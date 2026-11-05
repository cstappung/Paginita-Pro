// Expediciones: el ejército sale del Cuartel a mazmorras del mapa (por pisos) o a encargos del tablón y
// vuelve con recursos especiales. Cada tropa rinde distinto contra cada tipo de enemigo y gana veteranía.
// También viven aquí la Fuente de los Deseos y los efectos de las estructuras de las Leyendas.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Exp = (PK.Exp = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const log = (t, k) => PK.Social.log(t, k);
  const BOARD_MS = 4 * 3600e3;

  Exp.init = function (st) {
    st.exp = st.exp || { runs: [], board: { at: 0, list: [] }, sites: {}, xp: {}, wish: { day: '', offer: [], buff: null }, rid: 1 };
    for (const k in D.ARMY) st.exp.xp[k] = st.exp.xp[k] || 0;
    st.war.reports = st.war.reports || []; // informes de batalla (los últimos 12) para la Crónica del Cuartel
  };

  // ---------- Efectos de las estructuras ----------
  Exp.bonus = key => D.LEGEND_B.reduce((s, t) => s + G().best(t, key), 0) + (G().perk ? G().perk(key) : 0);
  Exp.wishMult = function (k) {
    const st = S(), b = st && st.exp && st.exp.wish.buff;
    return b && b.k === k && b.until > Date.now() ? 1 + b.p : 1;
  };
  Exp.unitMult = type => 1 + 0.04 * D.rankOf(S().exp.xp[type]);
  // Taberna, Faro Abisal y decretos: hasta −60% del viaje (sin tope, todo junto llegaba a −85%)
  Exp.velViaje = () => 1 - Math.min(0.6, Exp.bonus('expSpeed'));
  Exp.armyMult = () => (1 + Exp.bonus('armyPower')) * Exp.wishMult('army');
  // Los lobos no se acercan a la Casa de Fieras.
  Exp.warded = function (x, y) {
    for (const b of G().buildings) if (b.owner === 'p' && b.done && b.type === 'beasthouse' && U.dist(x, y, b.cx, b.cy) < G().bst(b).wolfWard) return true;
    return false;
  };

  // ---------- Fuerza contra un tipo de enemigo ----------
  // enemy = { beast: 0.6, golem: 0.4 }: mezcla de enemigos; cada tropa rinde según su multiplicador.
  Exp.vsFactor = function (type, enemy) {
    const vs = D.ARMY[type].vs || {};
    let f = 0, tot = 0;
    for (const e in enemy) { f += enemy[e] * (vs[e] || 1); tot += enemy[e]; }
    return tot ? f / tot : 1;
  };
  // heroe: id de un héroe que va con la compañía (js/heroes.js): multiplica la fuerza contra ese enemigo.
  Exp.powerVs = function (units, enemy, heroe) {
    let p = 0;
    const vb = G().bono || (() => 0), drag = enemy && enemy.dragon ? (vb('dragon') * enemy.dragon) / Math.max(1, Object.values(enemy).reduce((s, v) => s + v, 0)) : 0;
    // árbol y cartas (Fase 3): fuerza contra monstruos por tropa, solo aquí (PvE). Social.power no la cuenta (regla 4).
    for (const k in units) p += (units[k] || 0) * D.ARMY[k].power * Exp.unitMult(k) * Exp.vsFactor(k, enemy) * (1 + vb('pve_all') + vb('pve_' + k));
    return p * (1 + drag) * (1 + 0.15 * G().lvl('tactics')) * G().eraMult() * Exp.armyMult() * Exp.heroMult(heroe, enemy) * (PK.Leyendas && S().leyendas ? 1 + PK.Leyendas.contra(enemy) : 1);
  };
  Exp.heroMult = (id, enemy) => (id && PK.Heroes ? PK.Heroes.mult(PK.Heroes.de(id), enemy) : 1);
  Exp.heal = units => Math.min(0.45, Object.keys(units).reduce((s, k) => s + (units[k] || 0) * (D.ARMY[k].heal || 0), 0));
  // Probabilidad de victoria según la proporción de fuerzas: 1:1 es 50%, 1,5:1 ya es casi seguro.
  Exp.chance = ratio => U.clamp(0.5 + (ratio - 1) * 0.9, 0.03, 0.97);
  // Compañía recomendada: lo mejor que tienes en casa contra ese enemigo, hasta superar la fuerza pedida x1,4.
  Exp.recommend = function (enemy, need) {
    const army = S().war.army, out = {};
    // primero los especialistas contra ese enemigo, después los más fuertes
    const order = Object.keys(D.ARMY).filter(k => army[k] > 0 && (!D.ARMY[k].heal || Exp.vsFactor(k, enemy) > 1)).sort((a, b) => (Exp.vsFactor(b, enemy) - Exp.vsFactor(a, enemy)) || (D.ARMY[b].power - D.ARMY[a].power));
    const target = need * 1.4;
    for (const k of order) {
      out[k] = 0;
      while (out[k] < army[k] && Exp.powerVs(out, enemy) < target) out[k]++;
      if (Exp.powerVs(out, enemy) >= target) break;
    }
    // un par de clérigos siempre ayudan a volver con vida
    if (army.cleric && !out.cleric) out.cleric = Math.min(army.cleric, 3);
    return out;
  };

  // ---------- Mazmorras ----------
  Exp.found = function (p) {
    G().stat('dungeons_found', 1);
    const d = D.DUNGEON[p.kind];
    toast('¡' + d.name + '! ' + (S().era < d.era ? 'Hará falta la Era ' + U.roman(d.era) + ' para entrar.' : 'Manda una expedición desde el Cuartel.'), 'epic');
  };
  Exp.sites = function () {
    const st = S(), [hx, hy] = D.PLAYER_HOME;
    return W.pois.filter(p => D.DUNGEON[p.kind] && st.pois[p.id] && st.pois[p.id].f)
      .sort((a, b) => U.dist(a.x, a.y, hx, hy) - U.dist(b.x, b.y, hx, hy));
  };
  Exp.site = id => S().exp.sites[id] || (S().exp.sites[id] = { best: 0, rest: 0 });
  Exp.travel = function (p) {
    const [hx, hy] = D.PLAYER_HOME;
    return Math.round((60 + U.dist(p.x, p.y, hx, hy) * 2) * Exp.velViaje());
  };
  // El Observatorio marca en el mapa las mazmorras dentro de su radio, aunque estén en la niebla.
  function scan() {
    const r = G().best('observatory', 'scan');
    if (!r) return;
    const st = S(), [hx, hy] = D.PLAYER_HOME;
    for (const p of W.pois) {
      if (!D.DUNGEON[p.kind] || (st.pois[p.id] && st.pois[p.id].f)) continue;
      if (U.dist(p.x, p.y, hx, hy) > r) continue;
      st.pois[p.id] = { f: 1, scan: 1 };
      Exp.found(p);
    }
  }

  // ---------- Encargos ----------
  Exp.board = function () {
    const st = S(), b = st.exp.board, n = 3 + Exp.bonus('missions') + (PK.Heroes && st.heroes ? Math.floor(PK.Heroes.pasiva('missions')) : 0);
    if (Date.now() - b.at > BOARD_MS || !b.at) {
      b.at = Date.now();
      const pool = D.MISSIONS.filter(m => st.era >= m.era), rng = U.rng(Math.floor(Date.now() / BOARD_MS) * 7 + st.created % 997);
      b.list = [];
      for (let i = 0; i < n && pool.length; i++) b.list.push(makeMission(pool.splice(Math.floor(rng() * pool.length), 1)[0], i));
    }
    while (b.list.length < n && st.era >= 2) { // la Taberna suma encargos sin esperar a la renovación
      const pool = D.MISSIONS.filter(m => st.era >= m.era && !b.list.some(o => o.tpl === m.id));
      if (!pool.length) break;
      b.list.push(makeMission(U.pick(pool), b.list.length));
    }
    return b.list;
  };
  function makeMission(m, i) {
    const k = D.missionScale(S().era), loot = {};
    for (const r in m.loot) loot[r] = Math.round(m.loot[r] * k);
    loot[m.sp] = Math.round(m.spN * Math.sqrt(k));
    return { uid: Date.now().toString(36) + i, tpl: m.id, power: Math.round(m.base * k), loot, time: m.time };
  }
  Exp.boardLeft = () => Math.max(0, BOARD_MS - (Date.now() - S().exp.board.at));

  // ---------- Enviar ----------
  // target: { poi, floor } (mazmorra) o { mission: uid } (encargo).
  Exp.campTravel = p => Math.round((30 + U.dist(p.x, p.y, D.PLAYER_HOME[0], D.PLAYER_HOME[1]) * 1.5) * Exp.velViaje());
  Exp.preview = function (target) {
    // un jefe del mar (pk-29, armada.js): la primera victoria paga «loot», las siguientes «rep»
    if (target.jefeMar) {
      const J = D.JEFES_MAR && D.JEFES_MAR[target.jefeMar];
      if (!J) return null;
      const ya = ((S().jefesMar || {})[target.jefeMar] || {}).n;
      return { name: J.name, enemy: J.enemy, power: J.power, loot: Object.assign({}, ya ? J.rep : J.loot), travel: Math.round(J.travel * Exp.velViaje()), jefe: target.jefeMar };
    }
    // el lugar de un capítulo de la campaña (campana.js, H5)
    if (target.cap) {
      const C = PK.Campana, c = C && C.cap(target.cap), l = c && C.lugar(target.cap);
      if (!l || !c.lugar) return null;
      return { name: c.lugar.name, enemy: c.lugar.enemy, power: C.fuerza(target.cap), loot: C.botin(target.cap), travel: Exp.campTravel(l) };
    }
    if (target.camp !== undefined) {
      const p = W.pois[target.camp];
      if (!p) return null;
      const tier = G().poiTier(p);
      return { name: 'Campamento de bandidos ' + U.roman(tier + 1), enemy: { bandit: 1 }, power: D.campPower(tier), loot: D.campLoot(tier), travel: Exp.campTravel(p) };
    }
    if (target.mission) {
      const m = S().exp.board.list.find(o => o.uid === target.mission);
      if (!m) return null;
      const tpl = D.MISSIONS.find(o => o.id === m.tpl);
      return { name: tpl.name, enemy: tpl.enemy, power: m.power, loot: misLoot(m.loot), travel: Math.round((m.time / 2) * Exp.velViaje()) };
    }
    const p = W.pois[target.poi], d = D.DUNGEON[p.kind], site = Exp.site(p.id);
    // Mazmorras 2.0: una incursión por un bloque de 5 pisos (incursion.js); la fuerza es la del primer piso
    if (PK.Inc) { const fin = PK.Inc.finDe(p.kind, target.floor); return { name: d.name + ' · pisos ' + target.floor + '–' + fin, enemy: d.enemy, power: D.dungeonPower(p.kind, target.floor), loot: PK.Inc.botinBloque(p.kind, target.floor), travel: Exp.travel(p), incursion: true, fin }; }
    return { name: d.name + ' · piso ' + target.floor, enemy: d.enemy, power: D.dungeonPower(p.kind, target.floor), loot: D.dungeonLoot(p.kind, target.floor, target.floor > site.best), travel: Exp.travel(p) };
  };
  // Diplomacia (árbol 2.0): +20% de premio en los encargos (sin tocar las monedas)
  const misLoot = l => { const k = G().bono ? G().bono('misiones') : 0; if (!k) return l; const o = {}; for (const r in l) o[r] = r === 'coins' ? l[r] : Math.round(l[r] * (1 + k)); return o; };
  Exp.canSend = function (target) {
    const st = S();
    if (!G().countB('barracks')) return 'Necesitas ' + (D.temaActivo === 'mar' ? 'una ' : 'un ') + D.BUILD.barracks.name + '.';
    if (target.jefeMar) {
      const J = D.JEFES_MAR[target.jefeMar], j = (st.jefesMar || {})[target.jefeMar] || {};
      if (st.era < J.era) return 'Requiere la Era ' + U.roman(J.era) + '.';
      if (j.vuelve > Date.now()) return J.name + ' vuelve en ' + U.fmtTime((j.vuelve - Date.now()) / 1000) + '.';
      if (st.exp.runs.some(r => r.jefeMar === target.jefeMar)) return 'Tu flota ya va hacia ' + J.name + '.';
    }
    if (target.cap) {
      const C = PK.Campana;
      if (!C || !C.abierto(target.cap) || !C.lugar(target.cap)) return 'Ese capítulo no está abierto.';
      if (st.exp.runs.some(r => r.cap === target.cap)) return 'Ya hay tropas en camino.';
    }
    if (target.camp !== undefined) {
      const p = W.pois[target.camp], ps = p && G().poiState(p);
      if (!ps || !ps.f) return 'Todavía no descubres ese campamento.';
      if (ps.d) return 'Ese campamento ya fue destruido.';
      if (st.exp.runs.some(r => r.camp === target.camp) || st.war.exps.some(e => e.camp === target.camp)) return 'Ya hay tropas en camino a ese campamento.';
    }
    if (target.poi !== undefined) {
      const p = W.pois[target.poi], d = D.DUNGEON[p.kind], site = Exp.site(p.id);
      if (st.era < d.era) return 'Requiere la Era ' + U.roman(d.era) + '.';
      if (target.floor > site.best + 1) return 'Primero limpia el piso ' + (site.best + 1) + '.';
      if (PK.Inc && (target.floor - 1) % PK.Inc.BLOQUE) return 'Las incursiones empiezan en los pisos 1, 6, 11…';
      if (target.floor > d.floors) return 'Esa mazmorra no tiene más pisos.';
      if (site.rest > Date.now()) return 'La mazmorra se está reponiendo: ' + U.fmtTime((site.rest - Date.now()) / 1000) + '.';
      if (st.exp.runs.some(r => r.poi === p.id)) return 'Ya hay una expedición en esa mazmorra.';
    }
    return null;
  };
  // form (C1, pk-21): { filas: { tipo: 'f' | 'm' | 'a' }, flanco: 'i' | 'c' | 'd' } para la batalla en vivo.
  Exp.send = function (target, units, heroeId, form) {
    const why = Exp.canSend(target), st = S(), army = st.war.army;
    if (why) { toast(why, 'warn'); return false; }
    const heroe = heroeId && PK.Heroes ? PK.Heroes.de(heroeId) : null;
    if (heroeId && (!heroe || heroe.estado !== 'libre')) { toast('Ese héroe no está disponible.', 'warn'); return false; }
    let total = 0;
    for (const k in units) { units[k] = Math.max(0, Math.floor(units[k] || 0)); if (units[k] > army[k]) { toast('No tienes tantas tropas.', 'warn'); return false; } total += units[k]; }
    if (!total) { toast('Elige tropas para la expedición.', 'warn'); return false; }
    const pv = Exp.preview(target);
    if (!pv) return false;
    if (heroe) pv.travel = Math.round(pv.travel * PK.Heroes.viaje(heroe));
    for (const k in units) army[k] -= units[k];
    // el mar (pk-29): con tormenta la flota tarda más y llega con las velas rotas (D.tormenta, del reloj real)
    const temp = D.temaActivo === 'mar' && D.tormenta && D.tormenta();
    if (temp) pv.travel = Math.round(pv.travel * D.TORMENTA.viaje);
    const run = { id: st.exp.rid++, heroe: heroe ? heroe.id : undefined, poi: target.poi, camp: target.camp, cap: target.cap, floor: target.floor, jefeMar: target.jefeMar, tormenta: temp ? 1 : undefined, mission: target.mission ? st.exp.board.list.find(o => o.uid === target.mission) : null, name: pv.name, enemy: pv.enemy, need: pv.power, power: Math.round(Exp.powerVs(units, pv.enemy, heroe && heroe.id)), heal: Exp.heal(units), units: Object.assign({}, units), loot: pv.loot, phase: 'go', arrive: Date.now() + pv.travel * 1000, travel: pv.travel };
    if (run.mission) st.exp.board.list.splice(st.exp.board.list.indexOf(run.mission), 1);
    else run.target = { poi: target.poi, floor: target.floor, camp: target.camp, cap: target.cap, jefeMar: target.jefeMar }; // para «Repetir» (C7)
    if (temp) run.power = Math.round(run.power * D.TORMENTA.fuerza);
    if (target.jefeMar) { run.jefe = target.jefeMar; run.nivel = D.JEFES_MAR[target.jefeMar].nivel; }
    else if (D.temaActivo === 'mar') run.nivel = U.clamp(0.1 + 0.08 * (st.era - 2), 0, 0.45);
    if (form) { run.form = form; st.formaciones = st.formaciones || {}; st.formaciones.ult = form; }
    st.exp.runs.push(run);
    if (run.poi !== undefined && PK.Inc) PK.Inc.preparar(run, W.pois[run.poi]);
    if (run.cap) run.jefe = D.CAPITULOS[run.cap - 1].lugar.jefe; // con su jefe (batalla.js)
    if (heroe) PK.Heroes.salir(heroe, run);
    run.chance = Exp.chance(run.power / Math.max(1, pv.power));
    log('Expedición a ' + pv.name + ': fuerza ' + U.fmt(run.power) + ' contra aprox. ' + U.fmt(pv.power) + '. Llegan en ' + U.fmtTime(pv.travel) + '.', 'info');
    const to = PK.Troops ? PK.Troops.targetOf(run) : null;
    toast('¡En marcha! ' + PK.Troops.total(units) + ' soldados salen del Cuartel hacia ' + pv.name + ' (llegan en ' + U.fmtTime(pv.travel) + ').', 'good',
      to && run.mission === null ? { label: 'Seguirlos', fn: () => { const b = G().buildings.find(o => o.owner === 'p' && o.type === 'barracks' && o.done); if (b) PK.Render.centerOn(b.cx, b.cy); else PK.Render.centerOn(to[0], to[1]); } } : null);
    if (PK.Sfx) PK.Sfx.play('event');
    return true;
  };

  // ---------- Tácticas ----------
  // Una decisión mientras marchan (playtest: el combate era solo esperar una barra). Se cambia hasta que llegan.
  Exp.TACTICS = {
    asalto: { name: 'Asalto', desc: '+15% de fuerza, más bajas', pow: 1.15, loss: 1.35 },
    normal: { name: 'Normal', desc: 'sin cambios', pow: 1, loss: 1 },
    cauto: { name: 'Cauteloso', desc: '−10% de fuerza, muchas menos bajas', pow: 0.9, loss: 0.6 },
  };
  const tactic = r => Exp.TACTICS[r.tactic] || Exp.TACTICS.normal;
  Exp.setTactic = function (id, k) {
    const r = S().exp.runs.find(o => o.id === id);
    if (!r || r.phase !== 'go' || !Exp.TACTICS[k]) return;
    r.tactic = k;
    r.chance = Exp.chance((r.power * tactic(r).pow) / Math.max(1, r.need));
  };

  // ---------- Resolver ----------
  // res (batalla en vivo, batalla.js): quién ganó y cuántos cayeron de cada tropa. Sin res, por la proporción de fuerzas.
  function resolve(r, res) {
    // en una incursión (incursion.js) los afijos de la semana hacen más dura la cuenta por proporción
    const st = S(), tc = tactic(r), ratio = (r.power * tc.pow) / Math.max(1, r.need * (r.inc ? PK.Inc.dureza(r) : 1));
    r.lost = {};
    if (res) {
      r.won = !!res.won;
      if (res.dano) { r.dano = r.dano || {}; for (const k in res.dano) r.dano[k] = (r.dano[k] || 0) + res.dano[k]; } // C7, suma las salas de una incursión
      for (const k in r.units) { const l = Math.min(r.units[k], res.lost[k] || 0); r.lost[k] = l; r.units[k] -= l; }
    } else {
      r.won = Math.random() < Exp.chance(ratio);
      const loss = Math.min(0.95, (r.won ? U.clamp(0.32 / ratio, 0.03, 0.4) : 0.55 + Math.random() * 0.2) * (1 - r.heal) * tc.loss * (1 - heroBajas(r)) * (1 - Math.min(0.4, G().bono ? G().bono('bajas') : 0)));
      for (const k in r.units) { const l = Math.round(r.units[k] * loss * U.rand(0.8, 1.2)); r.lost[k] = Math.min(r.units[k], l); r.units[k] -= r.lost[k]; }
    }
    // veteranía para quienes vuelven (también se aprende perdiendo, menos)
    const xp = Math.max(4, r.need / 8) * (r.won ? 1 : 0.4) * (1 + Exp.bonus('xpBoost'));
    for (const k in r.units) if (r.units[k] > 0) st.exp.xp[k] += xp;
    if (r.heroe && PK.Heroes) PK.Heroes.resultado(r);
    // desafíos (Fase 3, V7): cada pelea, con quiénes fueron y cómo salió
    if (r.won) { if (r.inc) G().stat('floors', 1); if (r.mission) G().stat('missions_done', 1); }
    if (PK.Vida && PK.Vida.evento) { const u = Object.assign({}, r.units); for (const k in r.lost) u[k] = (u[k] || 0) + r.lost[k]; PK.Vida.evento('batalla', { won: r.won, units: u, lost: r.lost, chance: Exp.chance(ratio), heroe: r.heroe, poi: r.poi, piso: r.inc ? r.inc.piso : r.floor || 0 }); }
    // incursión: si ganó y quedan pisos, sigue adentro (a elegir la próxima sala)
    if (r.inc && PK.Inc.tras(r)) return;
    cerrar(r, res, ratio);
  }
  // Fin de una expedición (o de una incursión entera): informe, aviso y de vuelta a casa.
  function cerrar(r, res, ratio) {
    const st = S(), sent = r.inc ? r.inc.enviados : Object.assign({}, r.units);
    if (!r.inc) for (const k in r.lost || {}) sent[k] = (sent[k] || 0) + r.lost[k];
    if (r.poi !== undefined && r.inc) Exp.site(r.poi).rest = Date.now() + D.DUNGEON[W.pois[r.poi].kind].rest * 1000 * reposo();
    if (r.poi !== undefined && !r.inc) {
      const p = W.pois[r.poi], site = Exp.site(p.id);
      site.rest = Date.now() + D.DUNGEON[p.kind].rest * 1000 * reposo();
      if (r.won && r.floor > site.best) {
        site.best = r.floor;
        st.stats['floor_' + p.kind] = Math.max(st.stats['floor_' + p.kind] || 0, r.floor);
        st.stats.floor_max = Math.max(st.stats.floor_max || 0, r.floor);
      }
    }
    if (r.cap && r.won && PK.Campana) PK.Campana.ganar(r.cap);
    if (r.jefeMar && r.won) { // pk-29: el jefe del mar se va a descansar y vuelve más tarde
      const J = D.JEFES_MAR[r.jefeMar], jm = (st.jefesMar = st.jefesMar || {}), j = (jm[r.jefeMar] = jm[r.jefeMar] || { n: 0 });
      j.n++; j.vuelve = Date.now() + J.descanso * 1000;
      G().stat('jefe_' + r.jefeMar, 1);
    }
    if (r.asalto && PK.Armada) PK.Armada.finAsalto(r);
    if (r.camp !== undefined && r.won) {
      const p = W.pois[r.camp], ps = p && G().poiState(p);
      if (ps && !ps.d) { ps.d = 1; W.poiFree(p); G().stat('camps_cleared', 1); }
    }
    r.phase = 'back';
    r.back = Date.now() + r.travel * 1000;
    log(r.won ? 'Victoria en ' + r.name + '. Bajas: ' + lostText(r.lost) + '. Vuelven con el botín.' : 'Derrota en ' + r.name + '. Bajas: ' + lostText(r.lost) + '.', r.won ? 'good' : 'bad');
    const rep = { id: r.id, at: Date.now(), name: r.name, won: r.won, power: r.power, need: r.need, chance: r.chance || Exp.chance(ratio || 1), sent, lost: r.lost, inc: r.inc ? { log: r.inc.log.slice(-12), fin: r.incFin, afijos: r.inc.afijos } : undefined, loot: r.won || r.inc ? r.loot : null, enemy: r.enemy, live: !!(res && res.live), retreat: !!(res && res.retreat), heroe: heroName(r), heroeId: r.heroe, hab: r.habUsos, enc: r.encLog, dano: r.dano, target: r.target, form: r.form };
    st.war.reports = st.war.reports || [];
    st.war.reports.unshift(rep);
    if (st.war.reports.length > 12) st.war.reports.length = 12;
    const to = PK.Troops ? PK.Troops.targetOf(r) : null;
    if (to && !r.mission && PK.Troops && !res) PK.Troops.fight(to[0], to[1], { won: r.won, units: sent, enemy: r.enemy });
    // si la estabas mirando, el cartel de la batalla ya lo dice
    if (!(res && PK.Batalla && PK.Batalla.abierta())) toast(r.won ? '¡Victoria en ' + r.name + '! Tus tropas vuelven con el botín.' : (res && res.retreat ? 'Retirada en ' : 'Derrota en ') + r.name + '. Los que quedaron vuelven a casa.', r.won ? 'good' : 'bad',
      { label: 'Ver informe', fn: () => PK.UI.openReport(rep) });
  }
  Exp.finishBattle = (r, res) => { if (r.phase === 'battle') resolve(r, res); };
  Exp.cerrar = r => cerrar(r, null, 0);
  const reposo = () => (PK.Leyendas && S().leyendas ? PK.Leyendas.reposo() : 1); // Puerta de las Estrellas (H6)
  const lostText = l => Object.keys(l).filter(k => l[k]).map(k => l[k] + ' ' + D.ARMY[k].name.toLowerCase() + (l[k] > 1 ? 's' : '')).join(', ') || 'ninguna';
  // Menos bajas con el héroe (armadura, rasgo Prudente, talentos). Valiente puede subirlas.
  const heroBajas = r => (r.heroe && PK.Heroes ? U.clamp(PK.Heroes.efecto(PK.Heroes.de(r.heroe), 'bajas'), -0.2, 0.5) : 0);
  Exp.heroBajas = heroBajas;
  const heroName = r => { const h = r.heroe && PK.Heroes ? PK.Heroes.de(r.heroe) : null; return h ? h.nombre : undefined; };
  function arrive(r) {
    const st = S(), g = G();
    for (const k in r.units) st.war.army[k] += r.units[k];
    if (r.heroe && PK.Heroes) PK.Heroes.volver(r);
    if (r.inc && PK.Inc) PK.Inc.volver(r);
    if (PK.Aventura) PK.Aventura.volver(r);
    // una incursión perdida vuelve con la mitad de lo juntado (incursion.js)
    const mitad = !r.won && r.inc && Object.keys(r.loot || {}).some(k => r.loot[k] > 0);
    if (r.won || mitad) {
      const h = r.heroe && PK.Heroes ? PK.Heroes.de(r.heroe) : null, bot = h ? PK.Heroes.efecto(h, 'botin') : 0;
      if (bot) for (const k in r.loot) if (k !== 'coins') r.loot[k] = Math.round(r.loot[k] * (1 + bot));
      g.give(r.loot);
      for (const k of D.SPECIAL) if (r.loot[k]) g.stat('sp_' + k, r.loot[k]);
      if (r.won) g.stat('exp_won', 1);
      log('Botín de ' + r.name + ': ' + Object.keys(r.loot).map(k => U.fmt(r.loot[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', ') + '.', 'good');
      toast('Tus tropas volvieron de ' + r.name + ' con el botín: ' + Object.keys(r.loot).map(k => '+' + U.fmt(r.loot[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', ') + '.', 'epic');
      if (PK.Sfx) PK.Sfx.play('coin');
    } else if (PK.Troops.total(r.units)) toast('Los sobrevivientes de ' + r.name + ' volvieron al Cuartel.', 'info');
    st.exp.runs.splice(st.exp.runs.indexOf(r), 1);
  }

  // ---------- Fuente de los Deseos ----------
  // Tres bendiciones al día (las mismas todo el día); se elige una.
  Exp.wishOffer = function () {
    const w = S().exp.wish, day = U.dayKey();
    // Pozo de los Deseos Antiguo (H6): un deseo más cada 3 días, con otras tres bendiciones
    const extra = w.day === day && w.extra !== day && PK.Leyendas && S().leyendas && PK.Leyendas.deseoExtra();
    if (w.day === day && !extra) return [];
    const pool = D.WISHES.map(o => o.k), rng = U.rng(U.strHash(day + (extra ? ':x:' : ':') + S().created)), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return out;
  };
  Exp.makeWish = function (k) {
    const w = S().exp.wish, b = G().buildings.find(o => o.owner === 'p' && o.done && o.type === 'wishwell');
    if (!b || !Exp.wishOffer().includes(k)) return;
    const s = G().bst(b), def = D.WISHES.find(o => o.k === k);
    if (w.day === U.dayKey()) w.extra = U.dayKey();
    w.day = U.dayKey();
    G().stat('wishes', 1);
    if (def.instant) {
      const gold = Math.round(300 * S().era * (1 + s.wishPower * 4));
      G().give({ gold });
      toast('Lluvia de monedas: +' + U.fmt(gold) + ' de oro.', 'epic');
    } else {
      w.buff = { k, p: s.wishPower, until: Date.now() + s.wishTime * 1000 };
      toast(def.name + ': +' + Math.round(s.wishPower * 100) + '% de ' + def.desc + ' por ' + U.fmtTime(s.wishTime) + '.', 'epic');
    }
    if (PK.Sfx) PK.Sfx.play('coin');
  };

  // ---------- Bucle ----------
  let t1 = 0;
  Exp.update = function (dt, offline) {
    const st = S();
    if (!st || !st.exp) return;
    t1 += dt;
    if (t1 < 1) return;
    const sec = t1;
    t1 = 0;
    const now = Date.now();
    for (const r of st.exp.runs.slice()) {
      // aviso antes de llegar: para elegir táctica y entrar a mirar la batalla
      if (!offline && r.phase === 'go' && !r.warned && (!r.mission || D.temaActivo === 'mar') && !r.asalto && r.travel > 40 && r.arrive - now <= 20000 && r.arrive > now) {
        r.warned = true;
        toast('Tus tropas llegan a ' + r.name + ' en ' + U.fmtTime((r.arrive - now) / 1000) + '. ¿Quieres dirigir la batalla?', 'info',
          { label: 'Ver batalla', fn: () => { r.watch = true; } });
      }
      // batalla en vivo (batalla.js). Si la partida se recargó en medio, se resuelve como antes; sin ti, se juega de una vez.
      // incursión: eligiendo sala, o terminada entre salas (retirada)
      if (r.phase === 'sala') { PK.Inc.update(r, offline); continue; }
      if (r.phase === 'fin') { cerrar(r, null, 0); continue; }
      if (r.phase === 'battle') {
        if (!PK.Batalla || !PK.Batalla.tiene(r.id)) resolve(r);
        else if (offline) PK.Batalla.adelantar(r.id);
        continue;
      }
      // encuentros en el camino (aventura.js, H2): solo con héroe y de ida
      if (r.phase === 'go' && PK.Aventura) PK.Aventura.update(r, offline);
      if (r.phase === 'go' && now >= r.arrive && r.inc && !r.inc.llego) { r.inc.llego = true; PK.Inc.llegar(r); if (r.watch && !offline) PK.Inc.open(r.id); continue; }
      if (r.phase === 'go' && now >= r.arrive) {
        if (!offline && (!r.mission || D.temaActivo === 'mar') && PK.Batalla && PK.Batalla.empezar(r)) { // en el mar los encargos también se pelean en vivo
          if (r.watch) PK.Batalla.abrir(r.id);
          else toast('¡Empieza la batalla en ' + r.name + '!', 'bad', { label: 'Ver batalla', fn: () => PK.Batalla.abrir(r.id) });
          if (PK.Sfx) PK.Sfx.play('event');
          continue;
        }
        resolve(r);
      }
      else if (r.phase === 'back' && now >= r.back) arrive(r);
    }
    // la Arena entrena a las tropas que están en casa
    const xpH = Exp.bonus('armyXp');
    if (xpH) for (const k in st.war.army) if (st.war.army[k] > 0) st.exp.xp[k] += (xpH * sec) / 3600;
    if (!offline) scan();
  };

  // Para el panel del Observatorio: cuánto falta para los lobos y el próximo evento.
  Exp.forecast = () => (PK.Life && PK.Life.timers ? PK.Life.timers() : null);
})();
