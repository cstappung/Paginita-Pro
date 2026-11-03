// Batallas en vivo: cuando una expedición llega a un campamento de bandidos o a una mazmorra (y estás jugando),
// la pelea se simula de verdad en un campo aparte. Cada figura representa a varios soldados; tus tropas y los
// enemigos se buscan, se acercan, se golpean o disparan, los clérigos curan y el dragón escupe fuego. Lo que
// pasa ahí decide el resultado y las bajas, y se puede mirar en tiempo real («Ver batalla») y dirigir con
// órdenes: cargar, mantener la línea, dispersarse, a quién atacar primero o retirarse.
// Sin ti (cálculo offline, partida recargada en medio de la pelea, encargos del tablón) se resuelve como antes,
// por la proporción de fuerzas (expeditions.js). Nada de la pelea se guarda ni lo ve el servidor.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, Sp = PK.Sprites;
  const B = (PK.Batalla = { lista: [] });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const sfx = n => PK.Sfx && PK.Sfx.play(n);

  // Campo: «u» va de tu lado (0) al enemigo (LU); «v» lo cruza (0..LV). En pantalla se acuesta o se para según
  // la forma de la ventana (en el celular vertical tus tropas quedan abajo).
  const LU = 30, LV = 14, TILE = 16;
  const HPK = 10, DPSK = 0.33;     // vida y daño por punto de fuerza: a fuerzas iguales, unos 30-40 s de pelea
  const LIMITE = 150;              // si nadie cae del todo, gana el que conserve más vida
  const MAX_MIOS = 18, COL_MIOS = D.PLAYER_COLOR;

  // Cómo pelea cada tropa tuya (la fuerza y los multiplicadores contra cada enemigo vienen de D.ARMY).
  const TROPA = {
    militia: { hp: 1, dps: 1, alcance: 0.9, vel: 1.6, fila: 6.5, herr: 'hammer' },
    spear: { hp: 1.1, dps: 0.95, alcance: 1.3, vel: 1.5, fila: 6.8, herr: 'spear', linea: 1.35 },
    knight: { hp: 1.3, dps: 1.05, alcance: 0.9, vel: 2.4, fila: 7.2, herr: 'sword' },
    archer: { hp: 0.7, dps: 1, alcance: 6, vel: 1.5, fila: 3.4, dispara: 'flecha' },
    cleric: { hp: 0.8, dps: 0.8, alcance: 3.5, vel: 1.3, fila: 4.4, dispara: 'luz', cura: 0.22 },
    catapult: { hp: 0.6, dps: 1, alcance: 9.5, vel: 0.8, fila: 1.6, dispara: 'piedra', area: 1.3, cd: 3 },
  };
  // Enemigos por tipo (D.ENEMY): peso dentro del tipo, vida y daño relativos, alcance, velocidad y maña.
  const ENEMIGOS = {
    beast: [
      { id: 'lobo', nombre: 'Lobo gigante', peso: 1, hp: 0.9, dps: 1.05, alcance: 0.9, vel: 2.7, flanco: true, spr: 'lobo' },
      { id: 'oso', nombre: 'Oso', peso: 0.45, hp: 2, dps: 1.2, alcance: 1, vel: 1.4, spr: 'oso' },
    ],
    bandit: [
      { id: 'forajido', nombre: 'Forajido', peso: 1, hp: 1, dps: 1, alcance: 0.9, vel: 1.7, spr: 'bandido' },
      { id: 'tirador', nombre: 'Tirador', peso: 0.6, hp: 0.7, dps: 0.95, alcance: 5.5, vel: 1.4, dispara: 'flecha', spr: 'tirador' },
    ],
    undead: [
      { id: 'esqueleto', nombre: 'Esqueleto', peso: 1, hp: 1.15, dps: 0.85, alcance: 0.9, vel: 1.1, spr: 'esqueleto' },
      { id: 'espectro', nombre: 'Espectro', peso: 0.4, hp: 0.8, dps: 1.1, alcance: 4, vel: 1.4, dispara: 'sombra', spr: 'espectro' },
    ],
    golem: [{ id: 'golem', nombre: 'Gólem', peso: 1, hp: 2.6, dps: 1, alcance: 1.1, vel: 0.8, spr: 'golem' }],
    dragon: [{ id: 'dragon', nombre: 'Dragón', peso: 1, hp: 1, dps: 0.55, alcance: 5, vel: 1.2, fuego: 1.7, jefe: true, spr: 'dragon' }],
  };
  B.ORDENES = {
    cargar: { nombre: 'Cargar', desc: 'todos al ataque' },
    linea: { nombre: 'Mantener línea', desc: 'esperan firmes: los lanceros frenan cargas (x1,35)' },
    dispersar: { nombre: 'Dispersarse', desc: 'se abren: el fuego y las rocas golpean a menos' },
  };
  // Qué conviene contra cada enemigo (se ve en la batalla, junto a las órdenes).
  B.CONSEJO = {
    beast: 'Bestias: rápidas y van por tus arqueros. Mantén la línea con lanceros al frente.',
    bandit: 'Bandidos: sus tiradores pegan de lejos. Carga con caballeros; tus arqueros tumban a los suyos.',
    undead: 'No-muertos: lentos y duros. Los clérigos los deshacen; mantén a tus tiradores atrás.',
    golem: 'Gólems: las flechas rebotan. Mantén la línea y que peguen catapultas y caballeros.',
    dragon: 'Dragón: su fuego quema a todos los que estén juntos. ¡Dispérsate!',
  };
  const TERRENO = {
    camp: { suelo: [118, 96, 62], tono: 18, deco: 'carpa' },
    cave: { suelo: [58, 62, 78], tono: 14, deco: 'cristal' },
    lair: { suelo: [78, 62, 44], tono: 16, deco: 'hueso' },
    crypt: { suelo: [82, 84, 88], tono: 12, deco: 'lapida' },
    crater: { suelo: [64, 48, 44], tono: 18, deco: 'estrella' },
    nest: { suelo: [96, 70, 48], tono: 18, deco: 'oro' },
    campo: { suelo: [86, 126, 58], tono: 16, deco: 'pasto' },
  };

  // ---------- Armar la batalla ----------
  const porUnidad = k => PK.Exp.powerVs({ [k]: 1 }, {}); // fuerza de un soldado con veteranía, era y bonos
  function lugarDe(r) {
    if (r.camp !== undefined) return 'camp';
    const p = r.poi !== undefined ? PK.World.pois[r.poi] : null;
    return p && TERRENO[p.kind] ? p.kind : 'campo';
  }
  // Qué tan adentro: 0 en el primer piso (o el campamento más cercano), 1 en el último (o el más lejano).
  // El escenario se vuelve más espectacular con eso (escenarios.js).
  function nivelDe(r) {
    if (r.camp !== undefined) { const p = PK.World.pois[r.camp]; return p ? G().poiTier(p) / 6 : 0; }
    const p = r.poi !== undefined ? PK.World.pois[r.poi] : null, d = p && D.DUNGEON[p.kind];
    return d && r.floor ? U.clamp((r.floor - 1) / Math.max(1, d.floors - 1), 0, 1) : 0;
  }
  B.empezar = function (r) {
    if (B.lista.some(b => b.id === r.id)) return true;
    const tipos = Object.keys(r.units).filter(k => r.units[k] > 0 && TROPA[k]);
    if (!tipos.length) return false;
    const tac = PK.Exp.TACTICS[r.tactic] || PK.Exp.TACTICS.normal;
    const b = {
      id: r.id, nombre: r.name, lugar: lugarDe(r), nivel: nivelDe(r), piso: r.floor || 0, t: 0, fin: null, orden: r.tactic === 'cauto' ? 'linea' : 'cargar', foco: null, vel: 1,
      tac, suerte: U.rand(0.8, 1.2), mios: [], suyos: [], tiros: [], efectos: [], textos: [], enviados: Object.assign({}, r.units), enemigo: r.enemy || { bandit: 1 },
    };
    // tus figuras: repartidas según la compañía (al menos una por tipo)
    const total = tipos.reduce((s, k) => s + r.units[k], 0), nFig = Math.min(MAX_MIOS, total);
    let quedan = nFig;
    const figuras = {};
    for (const k of tipos) { figuras[k] = 1; quedan--; }
    for (const k of tipos.slice().sort((a, c) => r.units[c] - r.units[a])) { const extra = Math.max(0, Math.round((r.units[k] / total) * nFig) - 1); const n = Math.min(extra, quedan); figuras[k] += n; quedan -= n; }
    for (const k of tipos) {
      const st = TROPA[k], n = figuras[k], cuantos = r.units[k];
      for (let i = 0; i < n; i++) {
        const rep = Math.floor(cuantos / n) + (i < cuantos % n ? 1 : 0);
        if (!rep) continue;
        // la vida también sale de cuánto rinde esa tropa contra este enemigo: así la «fuerza contra» del planificador
        // (Exp.powerVs) es la que pelea (vida x daño crecen igual que la fuerza al cuadrado de los dos lados)
        const pow = rep * porUnidad(k), f = figura('p', k, st, pow, rep, st.fila + (Math.random() - 0.5) * 0.6, 0);
        f.max = f.hp = f.hp * PK.Exp.vsFactor(k, b.enemigo);
        b.mios.push(f);
      }
    }
    // los enemigos: la fuerza que pedía la expedición, repartida según su mezcla
    const nEn = U.clamp(Math.round(5 + Math.log2(Math.max(1, r.need / 40)) * 1.6), 4, 16);
    const mezcla = [];
    for (const kind in b.enemigo) for (const a of ENEMIGOS[kind] || ENEMIGOS.bandit) mezcla.push({ kind, a, w: b.enemigo[kind] * a.peso });
    const wTot = mezcla.reduce((s, m) => s + m.w, 0);
    for (const m of mezcla) {
      const share = (m.w / wTot) * r.need;
      const n = m.a.jefe ? 1 : Math.max(1, Math.round((m.w / wTot) * nEn));
      for (let i = 0; i < n; i++) b.suyos.push(figura('e', m.a.id, m.a, (share / n) * b.suerte, 0, LU - 6 + (m.a.dispara ? 2.2 : 0) + (Math.random() - 0.5) * 0.8, 0, m.kind));
    }
    acomodar(b.mios); acomodar(b.suyos);
    b.fuerza0 = [vida(b.mios), vida(b.suyos)];
    B.lista.push(b);
    r.phase = 'battle';
    r.battleAt = Date.now();
    return true;
  };
  function figura(lado, tipo, st, pow, rep, u, v, kind) {
    const hp = pow * HPK * st.hp;
    return { lado, tipo, kind, st, pow, rep, hp, max: hp, dps: pow * DPSK * st.dps, u, v, u0: u, cd: Math.random() * 0.8, anim: Math.random() * 3, flip: lado === 'e', modo: 'idle', muerto: 0, golpe: 0, objetivo: null };
  }
  function acomodar(list) { // en filas, repartidos a lo ancho
    const grupos = {};
    for (const f of list) (grupos[f.tipo] = grupos[f.tipo] || []).push(f);
    for (const k in grupos) grupos[k].forEach((f, i, a) => { f.v = ((i + 0.5) / a.length) * (LV - 2) + 1 + (Math.random() - 0.5) * 0.4; });
  }
  const vida = list => list.reduce((s, f) => s + (f.muerto ? 0 : Math.max(0, f.hp)), 0);
  B.tiene = id => B.lista.some(b => b.id === id);
  B.de = id => B.lista.find(b => b.id === id);

  // ---------- Simulación ----------
  B.update = function (dt) {
    for (const b of B.lista.slice()) {
      if (b.fin) { b.t += dt; continue; }
      const pasos = b.vel;
      for (let i = 0; i < pasos && !b.fin; i++) paso(b, dt);
    }
  };
  // Sin mirar ni esperar (cálculo offline): se juega hasta el final de una vez.
  B.adelantar = function (id) {
    const b = B.de(id);
    let n = 0;
    while (b && !b.fin && n++ < 4000) paso(b, 0.1);
  };
  const cerca = (a, c) => Math.hypot(a.u - c.u, a.v - c.v);
  function paso(b, dt) {
    b.t += dt;
    const mios = b.mios.filter(f => !f.muerto), suyos = b.suyos.filter(f => !f.muerto);
    for (const f of b.mios.concat(b.suyos)) { f.anim += dt; f.golpe = Math.max(0, f.golpe - dt); if (f.muerto) f.muerto += dt; }
    for (const f of mios) actuar(b, f, suyos, mios, dt);
    for (const f of suyos) actuar(b, f, mios, suyos, dt);
    separar(mios, b.orden === 'dispersar' ? 1.35 : 0.7, dt);
    separar(suyos, 0.7, dt);
    tiros(b, dt);
    for (const e of b.efectos.slice()) { e.t += dt; if (e.t > e.dur) b.efectos.splice(b.efectos.indexOf(e), 1); }
    for (const x of b.textos.slice()) { x.t += dt; if (x.t > 1.2) b.textos.splice(b.textos.indexOf(x), 1); }
    const vm = vida(b.mios), vs = vida(b.suyos);
    if (vs <= 0) terminar(b, true);
    else if (vm <= 0) terminar(b, false);
    // con menos de un cuarto de la vida, los tuyos se retiran solos: perder no es morir todos
    else if (vm < b.fuerza0[0] * 0.2 && vs > b.fuerza0[1] * 0.35) terminar(b, false, true, true);
    else if (b.t >= LIMITE) terminar(b, vm / b.fuerza0[0] >= vs / b.fuerza0[1]);
  }
  function elegir(b, f, rivales) {
    let mejor = null, md = 1e9;
    for (const o of rivales) {
      let d = cerca(f, o);
      if (f.lado === 'p' && b.foco && o.kind === b.foco) d -= 8;          // la orden de foco manda
      if (f.lado === 'e' && f.st.flanco && o.st.dispara) d -= 4;          // los lobos buscan a los de atrás
      if (f.lado === 'p' && f.st.dispara && o.st.dispara) d -= 1.5;       // tus tiradores, contra los suyos
      if (d < md) { md = d; mejor = o; }
    }
    return mejor;
  }
  function actuar(b, f, rivales, aliados, dt) {
    const st = f.st;
    f.cd -= dt;
    // los clérigos curan primero al más herido cerca
    if (st.cura) {
      let her = null, hv = 0.85;
      for (const a of aliados) { const k = a.hp / a.max; if (a !== f && k < hv && cerca(a, f) < 3.5) { hv = k; her = a; } }
      if (her) { her.hp = Math.min(her.max, her.hp + f.pow * HPK * st.cura * dt * 0.1); if (Math.random() < dt * 2) { b.efectos.push({ tipo: 'cura', u: her.u, v: her.v, t: 0, dur: 0.6 }); fxCura(b, f, her); } }
    }
    if (!rivales.length) { f.modo = 'idle'; return; }
    if (!f.objetivo || f.objetivo.muerto || Math.random() < dt * 0.6) f.objetivo = elegir(b, f, rivales);
    const o = f.objetivo;
    const d = cerca(f, o), alcance = st.alcance;
    f.flip = o.u < f.u;
    // mantener la línea: tus cuerpo a cuerpo no salen de su fila hasta que el enemigo se acerca
    const quieto = f.lado === 'p' && b.orden === 'linea' && !st.dispara && d > 2.6 && f.u >= f.u0 - 0.5;
    if (d > alcance) {
      if (quieto) { f.modo = 'idle'; return; }
      const sp = st.vel * (f.lado === 'p' && b.orden === 'cargar' ? 1.1 : 1) * dt;
      f.u += ((o.u - f.u) / d) * sp; f.v += ((o.v - f.v) / d) * sp;
      f.modo = 'walk';
      return;
    }
    // los tiradores retroceden si se les vienen encima (salvo con «cargar»)
    if (st.dispara && d < 1.3 && !(f.lado === 'p' && b.orden === 'cargar')) {
      const sp = st.vel * 0.8 * dt, hacia = f.lado === 'p' ? -1 : 1;
      f.u = U.clamp(f.u + hacia * sp, 0.5, LU - 0.5); f.modo = 'walk';
    } else f.modo = 'work';
    if (f.cd > 0) return;
    f.cd = st.cd || (st.dispara ? 1.2 : 1);
    const dmg = f.dps * f.cd * mult(b, f, o);
    f.atk = st.dispara || st.fuego ? 0.16 : 0.24; // el amague del golpe (solo se dibuja)
    if (st.fuego) { // aliento de fuego: a todos los que estén cerca del objetivo
      b.efectos.push({ tipo: 'fuego', u0: f.u, v0: f.v, u: o.u, v: o.v, t: 0, dur: 0.7 });
      fxFuego(b, f, o);
      for (const r of rivales) { const k = cerca(r, o); if (k < st.fuego) herir(b, r, dmg * (k < 0.3 ? 1 : 0.4) * (1 - k / (st.fuego * 1.6)) * (b.orden === 'dispersar' ? 0.7 : 1), f); }
      sfx('hit');
    } else if (st.dispara) {
      b.tiros.push({ tipo: st.dispara, u0: f.u, v0: f.v, u: f.u, v: f.v, o, dmg, t: 0, dur: Math.max(0.2, d / (st.dispara === 'piedra' ? 7 : 12)), area: st.area, de: f });
      if (st.dispara === 'flecha' && Math.random() < 0.4) sfx('arrow');
    } else { herir(b, o, dmg, f); fxGolpe(b, o, f, dmg > o.max * 0.15); if (Math.random() < 0.3) sfx(Math.random() < 0.5 ? 'espada' : 'hit'); }
  }
  // Multiplicadores: tropa contra tipo de enemigo (D.ARMY.vs), táctica, la línea de lanceros, los lobos con los de atrás.
  function mult(b, f, o) {
    if (f.lado === 'p') {
      let m = (D.ARMY[f.tipo].vs || {})[o.kind] || 1;
      m *= b.tac.pow;
      if (b.orden === 'linea' && f.st.linea && (o.st.vel >= 2 || o.st.jefe)) m *= f.st.linea;
      return m;
    }
    let m = b.tac.loss >= 1 ? 1 + (b.tac.loss - 1) * 0.3 : 1 - (1 - b.tac.loss) * 0.4; // asalto expone más; cauteloso, menos
    if (f.st.flanco && o.st.dispara) m *= 1.25;
    return m;
  }
  function herir(b, o, dmg, de) {
    if (o.muerto || dmg <= 0) return;
    o.hp -= dmg; o.golpe = 0.18;
    // retroceso al recibir el golpe (solo se dibuja): se aleja de quien pegó
    if (de) { const d = cerca(o, de) || 1; o.kb = 0.2; o.kbU = (o.u - de.u) / d; o.kbV = (o.v - de.v) / d; }
    const fuerte = dmg > o.max * 0.2; // los golpes grandes se ven más grandes
    if (fuerte || Math.random() < 0.25) b.textos.push({ u: o.u, v: o.v, t: 0, txt: '-' + Math.max(1, Math.round(dmg / HPK)) + (fuerte ? '!' : ''), col: fuerte ? '#ffb040' : o.lado === 'p' ? '#ff8a70' : '#ffe27a', grande: fuerte });
    if (o.hp <= 0) {
      o.hp = 0; o.muerto = 0.001; o.caida = Math.random() < 0.5 ? -1 : 1;
      b.efectos.push({ tipo: 'polvo', u: o.u, v: o.v, t: 0, dur: 0.8 });
      fxMuerte(b, o);
      if (de && de.objetivo === o) de.objetivo = null;
    }
  }
  function tiros(b, dt) {
    for (const p of b.tiros.slice()) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.u = p.u0 + (p.o.u - p.u0) * k; p.v = p.v0 + (p.o.v - p.v0) * k;
      if (k < 1) continue;
      b.tiros.splice(b.tiros.indexOf(p), 1);
      if (p.area) { // piedra de catapulta
        const rivales = p.de.lado === 'p' ? b.suyos : b.mios;
        for (const r of rivales) { if (r.muerto) continue; const d = cerca(r, p.o); if (d < p.area) herir(b, r, p.dmg * (1 - d / (p.area * 1.5)), p.de); }
        b.efectos.push({ tipo: 'polvo', u: p.o.u, v: p.o.v, t: 0, dur: 0.6 });
        sfx('boom');
      } else herir(b, p.o, p.dmg, p.de);
      fxImpacto(b, p);
    }
  }
  function separar(list, r, dt) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j], dx = c.u - a.u, dy = c.v - a.v, d = Math.hypot(dx, dy) || 0.01;
      if (d >= r) continue;
      const push = ((r - d) / 2) * Math.min(1, dt * 8);
      a.u -= (dx / d) * push; a.v -= (dy / d) * push; c.u += (dx / d) * push; c.v += (dy / d) * push;
    }
    for (const f of list) { f.u = U.clamp(f.u, 0.5, LU - 0.5); f.v = U.clamp(f.v, 0.6, LV - 0.4); }
  }

  // ---------- Final ----------
  // Bajas: las figuras que cayeron (todos sus soldados) y parte de los heridos. Retirarse salva a los que quedan.
  function bajas(b, retirada) {
    const lost = {};
    for (const f of b.mios) {
      let n = f.muerto ? f.rep : Math.round(f.rep * (1 - f.hp / f.max) * (retirada ? 0.2 : 0.3));
      n = Math.min(f.rep, n);
      if (n) lost[f.tipo] = (lost[f.tipo] || 0) + n;
    }
    return lost;
  }
  function terminar(b, gano, retirada, sola) {
    if (b.fin) return;
    b.fin = { gano, retirada: !!retirada, sola: !!sola, lost: bajas(b, retirada), t: 0 };
    b.t = 0;
    sfx(gano ? 'victoria' : 'derrota');
    fxFinal(b);
    const r = S().exp.runs.find(o => o.id === b.id);
    if (r) PK.Exp.finishBattle(r, { won: gano, lost: b.fin.lost, live: true, retreat: !!retirada });
    if (vista && vista.b === b) pintarControles();
    // si nadie la mira, se borra enseguida; si la están mirando, queda el cartel hasta que la cierren
    if (!vista || vista.b !== b) B.lista.splice(B.lista.indexOf(b), 1);
  }
  B.retirada = function (id) { const b = B.de(id); if (b && !b.fin) { grito(b, '¡Retirada!'); terminar(b, false, true); } };
  const GRITOS = { cargar: '¡A la carga!', linea: '¡Mantengan la línea!', dispersar: '¡Dispérsense!' };
  B.ordenar = function (id, orden) { const b = B.de(id); if (b && B.ORDENES[orden]) { if (b.orden !== orden) grito(b, GRITOS[orden]); b.orden = orden; } };
  B.enfocar = function (id, kind) { const b = B.de(id); if (b) { b.foco = b.foco === kind ? null : kind; if (b.foco) grito(b, '¡A por ' + (A_POR[kind] || 'ellos') + '!'); } };
  const A_POR = { beast: 'las bestias', bandit: 'los bandidos', undead: 'los no-muertos', golem: 'los gólems', dragon: 'el dragón' };

  // ---------- Efectos (solo dibujo) ----------
  // Lo que se ve de cada golpe, disparo y caída: chispas, zarpazos, polvo, lascas de roca, llamas, marcas en el
  // suelo, luces que iluminan la cueva, sacudidas de cámara, gritos de orden y fuegos artificiales al ganar.
  // Viven en la vista (no en la batalla): sin nadie mirando, no se crean, y la pelea da lo mismo.
  const FX_MAX = 900;
  const fxDe = b => (vista && vista.b === b ? vista : null);
  function part(v, p) { if (v.fx.length < FX_MAX) v.fx.push(Object.assign({ t: 0, vx: 0, vy: 0, g: 0, life: 0.6, size: 2, crece: 0, a: 1, add: false, drag: 0 }, p)); }
  function sacudir(v, k) { v.shake = Math.min(9, Math.max(v.shake, k)); }
  function luzTemp(v, x, y, r, col, dur) { v.luces.push({ x, y, r, col, t: 0, dur }); }
  function marca(v, x, y, tipo) { v.marcas.push({ x, y, tipo, t: 0, rot: Math.random() * 6.3 }); if (v.marcas.length > 70) v.marcas.shift(); }
  function grito(b, txt) { const v = fxDe(b); if (v) v.banner = { txt, t: 0, dur: 1.3, chico: true }; }
  const rnd = (a, c) => a + Math.random() * (c - a);
  function fxGolpe(b, o, de, fuerte) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(o.u, o.v), [ax, ay] = aPx(de.u, de.v), d = Math.hypot(x - ax, y - ay) || 1, nx = (x - ax) / d, ny = (y - ay) / d, ang = Math.atan2(ny, nx);
    const spr = de.st.spr;
    if (spr === 'lobo' || spr === 'oso') v.cortes.push({ x, y: y - 9, ang: ang + rnd(-0.6, 0.6), t: 0, col: [255, 120, 100] });
    else if (de.lado === 'p' && de.tipo === 'knight' || fuerte) v.cortes.push({ x, y: y - 9, ang: ang + Math.PI / 2 + rnd(-0.4, 0.4), t: 0, col: [255, 250, 220] });
    const n = fuerte ? 10 : 5;
    for (let i = 0; i < n; i++) { const a = ang + rnd(-1, 1), sp = rnd(50, 120); part(v, { x: x - nx * 3, y: y - 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 260, life: rnd(0.18, 0.4), size: 1, col: Math.random() < 0.6 ? [255, 244, 200] : [255, 180, 70], add: true, linea: true }); }
    if (spr === 'golem' || spr === 'oso' || fuerte) sacudir(v, spr === 'golem' ? 3 : 1.6);
    if (spr === 'golem') for (let i = 0; i < 6; i++) part(v, { x, y: y - 8, vx: rnd(-60, 60), vy: rnd(-90, -30), g: 300, life: rnd(0.4, 0.7), size: 2, col: [130, 126, 120] });
    if (o.st.spr === 'golem') for (let i = 0; i < 4; i++) part(v, { x, y: y - 10, vx: rnd(-50, 50), vy: rnd(-80, -20), g: 300, life: rnd(0.4, 0.7), size: 2, col: Math.random() < 0.5 ? [110, 106, 100] : [122, 240, 255], add: Math.random() < 0.3 });
  }
  function fxFuego(b, f, o) {
    const v = fxDe(b); if (!v) return;
    v.llamas.push({ f, u: o.u, v: o.v, t: 0, dur: 0.75 });
    sacudir(v, 3.5); v.flash = Math.max(v.flash, 0.12); sfx('fuego');
  }
  function bocaDragon(f) { const [x, y] = aPx(f.u, f.v); return [x + (f.flip ? -30 : 30), y - 44]; }
  function fxCura(b, f, her) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(her.u, her.v);
    for (let i = 0; i < 6; i++) part(v, { x: x + rnd(-6, 6), y: y - rnd(2, 14), vy: rnd(-26, -12), life: rnd(0.6, 1), size: 1, col: [150, 255, 170], add: true, cruz: Math.random() < 0.4 });
    v.anillos.push({ x, y, t: 0, dur: 0.6, col: [140, 255, 170], r: 10 });
    const [cx, cy] = aPx(f.u, f.v);
    v.rayos.push({ x0: cx, y0: cy - 14, x1: x, y1: y - 10, t: 0, dur: 0.35, col: [190, 255, 200] });
    if (Math.random() < 0.3) sfx('magia');
  }
  function fxImpacto(b, p) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(p.o.u, p.o.v);
    if (p.tipo === 'piedra') {
      sacudir(v, 5); v.flash = Math.max(v.flash, 0.06);
      for (let i = 0; i < 16; i++) { const a = rnd(Math.PI, Math.PI * 2), sp = rnd(40, 140); part(v, { x, y: y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 340, life: rnd(0.4, 0.9), size: rnd(1, 3) | 0, col: Math.random() < 0.5 ? [120, 104, 80] : [150, 140, 120] }); }
      for (let i = 0; i < 10; i++) part(v, { x: x + rnd(-6, 6), y: y - rnd(0, 6), vx: rnd(-30, 30), vy: rnd(-24, -4), drag: 2, life: rnd(0.7, 1.3), size: 3, crece: 9, a: 0.45, col: [196, 178, 140] });
      v.anillos.push({ x, y, t: 0, dur: 0.5, col: [255, 220, 160], r: 26, suelo: true });
      luzTemp(v, x, y, 46, [255, 190, 110], 0.4);
      marca(v, x, y, 'crater');
    } else if (p.tipo === 'luz') {
      for (let i = 0; i < 10; i++) { const a = rnd(0, 6.3), sp = rnd(30, 80); part(v, { x, y: y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: rnd(0.3, 0.6), size: 1, col: [255, 248, 170], add: true }); }
      v.anillos.push({ x, y: y - 8, t: 0, dur: 0.4, col: [255, 245, 160], r: 14 });
      luzTemp(v, x, y - 8, 34, [255, 240, 150], 0.35);
    } else if (p.tipo === 'sombra') {
      for (let i = 0; i < 10; i++) { const a = rnd(0, 6.3), sp = rnd(20, 70); part(v, { x, y: y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, drag: 2, life: rnd(0.4, 0.8), size: 2, col: Math.random() < 0.5 ? [150, 90, 220] : [60, 20, 90], add: Math.random() < 0.5 }); }
      luzTemp(v, x, y - 8, 30, [170, 90, 255], 0.4);
    } else { // flecha: astillas
      for (let i = 0; i < 3; i++) part(v, { x, y: y - 10, vx: rnd(-40, 40), vy: rnd(-60, -10), g: 260, life: 0.3, size: 1, col: [232, 220, 192] });
    }
  }
  function fxMuerte(b, o) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(o.u, o.v), spr = o.st.spr;
    for (let i = 0; i < 10; i++) part(v, { x: x + rnd(-5, 5), y: y - rnd(0, 4), vx: rnd(-28, 28), vy: rnd(-20, -2), drag: 2.5, life: rnd(0.6, 1.1), size: 3, crece: 7, a: 0.4, col: [190, 172, 136] });
    if (spr === 'esqueleto') { for (let i = 0; i < 8; i++) part(v, { x, y: y - 10, vx: rnd(-70, 70), vy: rnd(-110, -40), g: 320, life: rnd(0.5, 0.8), size: 2, col: [232, 228, 210] }); marca(v, x, y, 'huesos'); sfx('pick'); }
    else if (spr === 'espectro') { for (let i = 0; i < 14; i++) part(v, { x: x + rnd(-5, 5), y: y - rnd(4, 18), vy: rnd(-40, -15), vx: rnd(-8, 8), life: rnd(0.7, 1.3), size: 2, col: [170, 120, 240], add: true }); luzTemp(v, x, y - 10, 30, [160, 100, 255], 0.6); }
    else if (spr === 'golem') { sacudir(v, 6); for (let i = 0; i < 18; i++) part(v, { x, y: y - 10, vx: rnd(-90, 90), vy: rnd(-150, -40), g: 340, life: rnd(0.6, 1), size: rnd(2, 4) | 0, col: Math.random() < 0.7 ? [116, 110, 104] : [122, 240, 255], add: false }); marca(v, x, y, 'rocas'); sfx('boom'); }
    else if (spr === 'dragon') {
      sacudir(v, 9); v.flash = 0.5; sfx('boom');
      for (let i = 0; i < 60; i++) { const a = rnd(0, 6.3), sp = rnd(40, 200); part(v, { x, y: y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 120, drag: 1, life: rnd(0.6, 1.6), size: rnd(2, 4) | 0, col: Math.random() < 0.5 ? [255, 200, 80] : [255, 110, 40], add: true }); }
      luzTemp(v, x, y - 30, 120, [255, 160, 70], 1.4);
      marca(v, x, y, 'quemado');
    } else marca(v, x, y, o.lado === 'p' ? 'caido' : 'mancha');
  }
  function fxFinal(b) {
    const v = fxDe(b); if (!v) return;
    v.final = { t: 0, gano: b.fin.gano };
    if (b.fin.gano) v.fuegos = 9;
  }
  // los fuegos artificiales de la victoria y las llamas del dragón se emiten cuadro a cuadro
  function emitir(v, dt, esc) {
    for (const l of v.llamas.slice()) {
      l.t += dt;
      if (l.t > l.dur) { v.llamas.splice(v.llamas.indexOf(l), 1); continue; }
      const [mx, my] = bocaDragon(l.f), [tx, ty] = aPx(l.u, l.v), dx = tx - mx, dy = ty - 6 - my, T = 0.32;
      if (l.t < l.dur * 0.75) for (let i = 0; i < 7; i++) part(v, { x: mx + rnd(-2, 2), y: my + rnd(-2, 2), vx: dx / T + rnd(-30, 30), vy: dy / T + rnd(-30, 30), drag: 0.6, life: rnd(0.32, 0.5), size: 2, crece: 10, col: [255, rnd(150, 230) | 0, rnd(40, 90) | 0], add: true, fuego: true });
      if (Math.random() < dt * 14) part(v, { x: tx + rnd(-10, 10), y: ty - rnd(0, 6), vy: rnd(-30, -10), drag: 1, life: rnd(0.8, 1.4), size: 4, crece: 10, a: 0.35, col: [60, 50, 50] });
      if (l.t < 0.05 + dt) { marca(v, tx, ty, 'quemado'); }
      luzTemp(v, tx, ty - 6, 70, [255, 140, 50], 0.12);
      luzTemp(v, mx, my, 40, [255, 180, 80], 0.12);
    }
    if (v.fuegos > 0 && Math.random() < dt * 3) {
      v.fuegos--;
      const x = rnd(esc.W * 0.15, esc.W * 0.85) - esc.mx, y = rnd(esc.H * 0.12, esc.H * 0.45) - esc.my;
      const col = [[255, 220, 90], [255, 110, 120], [120, 200, 255], [150, 255, 140], [230, 140, 255]][Math.floor(Math.random() * 5)];
      for (let i = 0; i < 44; i++) { const a = (i / 44) * 6.3, sp = rnd(60, 110); part(v, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 50, drag: 1.3, life: rnd(1, 1.6), size: i % 3 ? 1 : 2, col, add: true, linea: i % 3 > 0 }); }
      for (let i = 0; i < 10; i++) part(v, { x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: rnd(-20, 20), vy: rnd(-20, 20), drag: 2, life: 0.5, size: 3, crece: 3, col: [255, 255, 230], add: true });
      luzTemp(v, x, y, 90, col, 0.6);
      sfx('boom');
    }
  }
  // un aro de viñeta para cada tamaño de escenario (los bordes, más oscuros: se lee mejor el centro)
  function vineta(esc) {
    if (esc.vin) return esc.vin;
    const c = document.createElement('canvas'); c.width = esc.W; c.height = esc.H;
    const x = c.getContext('2d'), r = Math.hypot(esc.W, esc.H) / 2, g = x.createRadialGradient(esc.W / 2, esc.H / 2, r * 0.45, esc.W / 2, esc.H / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = g; x.fillRect(0, 0, esc.W, esc.H);
    return (esc.vin = c);
  }

  // ---------- Vista: otro mapa, a pantalla completa ----------
  let vista = null;
  B.abierta = () => !!vista;
  B.abrir = function (id) {
    const b = B.de(id);
    if (!b) { PK.UI.toast('Esa batalla ya terminó.', 'info'); return; }
    B.cerrar();
    if (PK.UI.closeModal) PK.UI.closeModal();
    const cv = el('canvas', { class: 'bt-cv' });
    const top = el('div', { class: 'bt-top' }), ctl = el('div', { class: 'bt-ctl' });
    const root = el('div', { id: 'batalla', role: 'dialog', 'aria-label': 'Batalla: ' + b.nombre }, top, el('div', { class: 'bt-campo' }, cv), ctl);
    document.body.append(root);
    vista = { b, root, cv, ctx: cv.getContext('2d'), top, ctl, fondo: null, key: '', fx: [], marcas: [], cortes: [], luces: [], anillos: [], rayos: [], llamas: [], shake: 0, flash: 0, fuegos: 0, final: null,
      banner: b.t < 4 && !b.fin ? { txt: b.nivel >= 1 && b.piso ? '¡Último piso!' : '¡A la batalla!', sub: b.nombre, t: 0, dur: 2.4 } : null };
    if (b.t < 4 && !b.fin) sfx('cuerno');
    pintarControles();
    window.addEventListener('resize', medir);
    medir();
    onKey = e => { if (e.key === 'Escape') B.cerrar(); };
    window.addEventListener('keydown', onKey);
    // se dibuja una vez por cuadro (la simulación corre en G.update, aunque nadie mire)
    const bucle = () => { if (!vista) return; try { dibujar(); } catch (e) { console.error(e); } requestAnimationFrame(bucle); };
    requestAnimationFrame(bucle);
  };
  let onKey = null;
  B.cerrar = function () {
    if (!vista) return;
    const b = vista.b;
    vista.root.remove();
    window.removeEventListener('resize', medir);
    if (onKey) window.removeEventListener('keydown', onKey);
    vista = null;
    if (b.fin) { const i = B.lista.indexOf(b); if (i >= 0) B.lista.splice(i, 1); }
  };
  function medir() {
    if (!vista) return;
    const box = vista.cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    vista.cv.width = Math.max(10, Math.floor(box.width * dpr)); vista.cv.height = Math.max(10, Math.floor(box.height * dpr));
    vista.cv.style.width = '100%'; vista.cv.style.height = '100%'; // el CSS lo estira; el tamaño real se revisa en cada cuadro
    vista.parado = box.height > box.width * 1.1; // celular vertical: tus tropas abajo
    vista.fondo = null;
  }
  // (u, v) del campo → píxeles del lienzo de mundo (sin escalar)
  const aPx = (u, v) => (vista.parado ? [v * TILE, (LU - u) * TILE] : [u * TILE, v * TILE]);
  function pintarControles() {
    const v = vista, b = v.b, btn = (t, fn, o) => PK.UI.btn(t, fn, o);
    v.ctl.innerHTML = '';
    if (b.fin) {
      const f = b.fin, lost = Object.keys(f.lost).filter(k => f.lost[k]).map(k => f.lost[k] + ' ' + D.ARMY[k].name.toLowerCase() + (f.lost[k] > 1 ? 's' : '')).join(', ') || 'ninguna';
      v.ctl.append(el('div', { class: 'bt-fin ' + (f.gano ? 'gano' : 'perdio') }, el('b', null, f.sola ? 'Se retiran' : f.retirada ? 'Retirada' : f.gano ? '¡Victoria!' : 'Derrota'),
        el('span', null, ' Bajas: ' + lost + '. ' + (f.gano ? 'Vuelven con el botín.' : 'Los que quedan vuelven a casa.')),
        el('div', { class: 'row' }, btn('Volver al reino', () => B.cerrar(), { cls: 'gold' }))));
      return;
    }
    const kinds = Object.keys(b.enemigo);
    const ord = el('div', { class: 'bt-ord', role: 'group', 'aria-label': 'Órdenes' }, Object.keys(B.ORDENES).map(k => btn(B.ORDENES[k].nombre, () => { B.ordenar(b.id, k); pintarControles(); }, { small: true, cls: b.orden === k ? 'gold' : '', title: B.ORDENES[k].desc })));
    const foco = kinds.length > 1 ? el('div', { class: 'bt-ord', role: 'group', 'aria-label': 'Atacar primero' }, el('span', { class: 'small' }, 'Atacar primero: '),
      kinds.map(k => btn(D.ENEMY[k].name, () => { B.enfocar(b.id, k); pintarControles(); }, { small: true, cls: b.foco === k ? 'gold' : '', title: D.ENEMY[k].desc }))) : '';
    const consejo = el('p', { class: 'small bt-tip' }, kinds.map(k => B.CONSEJO[k] || D.ENEMY[k].desc).join(' '));
    v.ctl.append(ord, foco, consejo,
      el('div', { class: 'row' }, btn('x' + (b.vel === 1 ? 2 : 1), () => { b.vel = b.vel === 1 ? 2 : 1; pintarControles(); }, { small: true, title: 'Velocidad de la batalla' }),
        btn('Retirada', () => { B.retirada(b.id); }, { small: true, cls: 'danger', title: 'Pierdes la pelea, pero se salvan más soldados' }),
        btn('Volver al reino', () => B.cerrar(), { small: true, title: 'La batalla sigue aunque no la mires' })));
  }
  function pintarArriba() {
    const v = vista, b = v.b, vm = vida(b.mios), vs = vida(b.suyos);
    const key = Math.round(vm) + '|' + Math.round(vs) + '|' + Math.floor(b.t) + '|' + !!b.fin;
    if (key === v.key) return;
    v.key = key;
    const pm = U.clamp(vm / b.fuerza0[0], 0, 1), ps = U.clamp(vs / b.fuerza0[1], 0, 1);
    const n = l => l.filter(f => !f.muerto).length;
    v.top.innerHTML = '';
    v.top.append(el('b', { class: 'bt-nombre' }, '⚔ ' + b.nombre),
      el('div', { class: 'bt-bars' },
        el('div', { class: 'bt-bar mio' }, el('i', { style: { width: pm * 100 + '%' } }), el('span', null, 'Tus tropas · ' + n(b.mios) + (n(b.mios) === 1 ? ' grupo' : ' grupos'))),
        el('div', { class: 'bt-bar suyo' }, el('i', { style: { width: ps * 100 + '%' } }), el('span', null, Object.keys(b.enemigo).map(k => D.ENEMY[k].name).join(' y ') + ' · ' + n(b.suyos)))),
      el('span', { class: 'bt-t' }, b.fin ? '' : U.fmtTime(Math.max(0, LIMITE - b.t))));
  }

  // ---------- Dibujo ----------
  // Tamaño del escenario: el campo más un margen, estirado a la forma de la pantalla (sin franjas negras).
  function escenario(b, cv) {
    const fw = (vista.parado ? LV : LU) * TILE, fh = (vista.parado ? LU : LV) * TILE, A = cv.width / cv.height, pad = 30;
    let W = fw + pad * 2, H = fh + pad * 2;
    if (W / H > A) H = W / A; else W = H * A;
    W = Math.ceil(W); H = Math.ceil(H);
    const mx = Math.round((W - fw) / 2), my = Math.round((H - fh) / 2);
    const esc = PK.Escenarios.crear(b.lugar, { W, H, fw, fh, mx, my, parado: vista.parado, seed: Math.floor(b.id * 131) % 100000 + 7, LU, LV, nivel: b.nivel || 0 });
    esc.mx = mx; esc.my = my;
    esc.frente.getContext('2d').drawImage(vineta(esc), 0, 0); // la viñeta va pegada al frente: una capa menos por cuadro
    return esc;
  }
  // Dragón: pixel art de 36x26 con dos cuadros de aleteo (alas arriba y abajo), mirando a la derecha.
  const dragonSpr = [0, 1].map(fr => {
    const c = document.createElement('canvas'); c.width = 36; c.height = 26;
    const x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a, b2, w, h); };
    // triángulo relleno por filas (para las alas)
    const tri = (ax, ay, bx, by, cx, cy, col) => {
      const y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
      for (let y = y0; y <= y1; y++) {
        const xs = [];
        for (const [p1, p2] of [[[ax, ay], [bx, by]], [[bx, by], [cx, cy]], [[cx, cy], [ax, ay]]]) {
          if ((y >= Math.min(p1[1], p2[1])) && (y <= Math.max(p1[1], p2[1])) && p1[1] !== p2[1]) xs.push(p1[0] + ((y - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]));
        }
        if (xs.length >= 2) r(Math.round(Math.min(...xs)), y, Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs))), 1, col);
      }
    };
    const ROJO = '#a8281c', CLARO = '#d0402a', OSC = '#6a140e', VIENTRE = '#f0a050', ALA = '#c8402a', ALA2 = '#e8703a', HUESO = '#e8dcc0';
    // ala de atrás (más oscura)
    if (fr) tri(13, 12, 9, 1, 19, 3, OSC); else tri(13, 12, 7, 20, 17, 18, OSC);
    // cola con púas
    for (let k = 0; k < 10; k++) { r(10 - k, 15 + Math.floor(k / 3), 2, 2, k % 2 ? ROJO : OSC); if (k % 3 === 0) r(10 - k, 14 + Math.floor(k / 3), 1, 1, HUESO); }
    r(0, 18, 2, 2, OSC);
    // cuerpo
    for (let y = 0; y < 8; y++) { const w = [10, 14, 16, 17, 17, 16, 14, 10][y], x0 = 17 - w / 2; r(x0, 10 + y, w, 1, y < 2 ? CLARO : ROJO); }
    r(11, 16, 13, 2, VIENTRE); for (let k = 12; k < 24; k += 2) r(k, 16, 1, 2, '#c87a38');
    for (let k = 10; k < 24; k += 3) r(k, 10, 1, 1, HUESO); // púas del lomo
    // patas con garras
    r(12, 18, 3, 4, OSC); r(11, 22, 4, 1, HUESO); r(21, 18, 3, 4, OSC); r(21, 22, 4, 1, HUESO);
    // cuello y cabeza
    for (let k = 0; k < 6; k++) r(23 + k, 11 - k, 3, 3, k % 2 ? ROJO : CLARO);
    r(28, 3, 6, 4, ROJO); r(32, 5, 4, 2, ROJO); r(29, 7, 6, 1, VIENTRE);  // cabeza, hocico y mandíbula
    r(28, 3, 6, 1, CLARO); r(30, 4, 1, 1, '#ffe27a'); r(30, 4, 1, 1, '#ffe27a'); r(35, 5, 1, 1, '#2a0806'); // ojo y nariz
    r(28, 1, 1, 2, HUESO); r(30, 0, 1, 3, HUESO);                           // cuernos
    r(33, 7, 1, 1, '#fff'); r(35, 7, 1, 1, '#fff');                         // colmillos
    // ala de adelante
    if (fr) { tri(17, 11, 13, 0, 25, 2, ALA); tri(17, 11, 18, 2, 24, 3, ALA2); r(17, 1, 1, 10, OSC); r(13, 0, 12, 1, OSC); }
    else { tri(17, 12, 11, 22, 23, 20, ALA); tri(17, 12, 14, 20, 21, 19, ALA2); r(11, 21, 12, 1, OSC); }
    return c;
  });
  const PALIDO = [176, 176, 164], BANDIDO = [70, 44, 40];
  function sprite(f, frame) {
    const a = f.st, modo = f.modo;
    if (f.lado === 'p') return f.tipo === 'catapult' ? Sp.cart(COL_MIOS, 'stone', f.flip, frame % 4, modo === 'walk') : Sp.troop(f.tipo, COL_MIOS, modo, frame, f.flip, false, modo === 'work' ? TROPA[f.tipo].herr || null : null, f.rep);
    if (a.spr === 'lobo' || a.spr === 'oso') return Sp.wolf[f.flip ? 1 : 0][frame % 2];
    if (a.spr === 'golem') return Sp.rocks.stone[2][0];
    // los enemigos nunca usan el dibujo de tus tropas (se confundían los arqueros): ropa de bandido o de hueso
    if (a.spr === 'tirador') return Sp.villager(BANDIDO, 2, 1, modo, frame % 4, null, f.flip, modo === 'work' ? 'hammer' : null);
    if (a.spr === 'espectro') return Sp.villager(PALIDO, 3, 0, modo === 'walk' ? 'walk' : 'idle', frame % 4, null, f.flip, null);
    if (a.spr === 'dragon') return null;
    return Sp.villager(a.spr === 'esqueleto' ? PALIDO : BANDIDO, 1, a.spr === 'esqueleto' ? 0 : 2, modo, frame % 4, null, f.flip, modo === 'work' ? 'knife' : null);
  }
  // marcas que quedan en el suelo: cráteres, quemaduras, huesos, rocas, caídos
  function dibujarMarca(ctx, m) {
    const a = m.t < 10 ? 1 : Math.max(0, 1 - (m.t - 10) / 4), x = Math.round(m.x), y = Math.round(m.y), r = m.rot;
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    // mancha suave y achatada (en perspectiva), sin bordes de caja
    const blot = (r0, col) => { ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.42); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r0); g.addColorStop(0, col + '0.55)'); g.addColorStop(0.6, col + '0.35)'); g.addColorStop(1, col + '0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r0, 0, 6.3); ctx.fill(); ctx.restore(); };
    if (m.tipo === 'crater') { blot(9, 'rgba(34,24,16,'); px(-6, -3, 3, 1, 'rgba(200,180,140,0.35)'); px(4, 1, 3, 1, 'rgba(200,180,140,0.3)'); px(-1, 2, 2, 1, 'rgba(200,180,140,0.3)'); }
    else if (m.tipo === 'quemado') {
      blot(14, 'rgba(18,10,6,');
      if (m.t < 4) { ctx.globalCompositeOperation = 'lighter'; const k = (1 - m.t / 4) * (0.6 + 0.4 * Math.sin(m.t * 12 + r)); for (let i = 0; i < 5; i++) px(Math.round(Math.cos(r + i * 1.7) * 7), Math.round(Math.sin(r * 2 + i) * 2.5), 1, 1, 'rgba(255,' + (120 + i * 20) + ',40,' + k + ')'); ctx.globalCompositeOperation = 'source-over'; }
    } else if (m.tipo === 'huesos') { for (let i = 0; i < 5; i++) px(Math.round(Math.cos(r + i * 1.3) * 5), Math.round(Math.sin(r + i * 2.1) * 2), i % 2 ? 3 : 2, 1, '#e4dcc8'); px(-1, -1, 3, 2, '#d8d0bc'); px(0, -1, 1, 1, '#2a2420'); }
    else if (m.tipo === 'rocas') { for (let i = 0; i < 6; i++) px(Math.round(Math.cos(r + i) * 7), Math.round(Math.sin(r + i * 1.9) * 3), 3, 2, i % 3 ? '#76706a' : '#5a5650'); px(-1, -1, 2, 1, '#7af0ff'); }
    else if (m.tipo === 'caido') { blot(6, 'rgba(30,20,14,'); px(-2, -1, 3, 2, '#3a64b8'); px(2, 0, 4, 1, '#c8c8d0'); }
    else { blot(6, 'rgba(70,22,16,'); }
    ctx.globalAlpha = 1;
  }
  const vecPx = (du, dv) => (vista.parado ? [dv, -du] : [du, dv]);
  function dibujar() {
    const v = vista, b = v.b, ctx = v.ctx, cv = v.cv;
    pintarArriba();
    // la barra de arriba y los controles cambian de alto (al llenarse, al terminar): el lienzo se vuelve a medir
    const box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (Math.abs(box.width * dpr - cv.width) > 2 || Math.abs(box.height * dpr - cv.height) > 2) medir();
    // el escenario (escenarios.js) cubre toda la pantalla; el campo de la pelea queda en el medio, en (mx, my)
    if (!v.fondo) v.fondo = escenario(b, cv);
    const esc = v.fondo, s = cv.width / esc.W, now = performance.now(), dt = Math.min(0.1, (now - (v.last || now)) / 1000);
    v.last = now;
    // sacudida de cámara (golpes de gólem, rocas de catapulta, el fuego y la caída del dragón)
    v.shake = Math.max(0, v.shake - dt * 16);
    const ox = v.shake ? rnd(-1, 1) * v.shake : 0, oy = v.shake ? rnd(-1, 1) * v.shake * 0.7 : 0;
    emitir(v, dt, esc);
    for (const l of v.luces.slice()) { l.t += dt; if (l.t > l.dur) v.luces.splice(v.luces.indexOf(l), 1); }
    // las luces del combate entran al pase de oscuridad del escenario: el fuego ilumina la cueva
    esc.extra = v.luces.map(l => ({ x: l.x + esc.mx, y: l.y + esc.my, r: l.r * (1 - 0.4 * (l.t / l.dur)), col: l.col }));
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);
    ctx.drawImage(esc.c, 0, 0);
    PK.Escenarios.animar(ctx, esc, dt);
    PK.Escenarios.luz(ctx, esc);
    ctx.setTransform(s, 0, 0, s, (esc.mx + ox) * s, (esc.my + oy) * s);
    // suelo: marcas y aros de impacto
    for (const m of v.marcas) { m.t += dt; dibujarMarca(ctx, m); }
    if (v.marcas.length && v.marcas[0].t > 14) v.marcas = v.marcas.filter(m => m.t < 14);
    for (const e of b.efectos) {
      const [px, py] = aPx(e.u, e.v), k = e.t / e.dur;
      if (e.tipo === 'polvo') { ctx.fillStyle = 'rgba(200,180,140,' + (0.35 * (1 - k)) + ')'; ctx.beginPath(); ctx.ellipse(px, py - 2, 3 + k * 10, 2 + k * 4, 0, 0, 6.3); ctx.fill(); }
    }
    // con la pelea terminada la simulación ya no corre: los que venían cayendo terminan de caer aquí
    if (b.fin) for (const f of b.mios.concat(b.suyos)) { if (f.muerto) f.muerto += dt; f.anim += dt; f.golpe = Math.max(0, f.golpe - dt); }
    // figuras, de atrás hacia adelante
    const todos = b.mios.concat(b.suyos).filter(f => !f.muerto || f.muerto < (f.st.spr === 'golem' ? 0.3 : f.st.spr === 'espectro' ? 0.6 : 1.6));
    todos.sort((a, c) => aPx(a.u, a.v)[1] - aPx(c.u, c.v)[1]);
    for (const f of todos) {
      let [px, py] = aPx(f.u, f.v);
      const frame = f.modo === 'work' ? Math.floor(f.anim * 5) % 4 : f.modo === 'walk' ? Math.floor(f.anim * 9) % 6 : 0;
      // amague hacia el objetivo al pegar, y retroceso al recibir
      if (f.atk > 0 && f.objetivo && !f.muerto) {
        f.atk = Math.max(0, f.atk - dt);
        const [tx, ty] = aPx(f.objetivo.u, f.objetivo.v), d = Math.hypot(tx - px, ty - py) || 1, k = Math.sin((1 - f.atk / 0.24) * Math.PI) * (f.st.dispara ? -1.5 : 4);
        px += ((tx - px) / d) * k; py += ((ty - py) / d) * k;
      }
      if (f.kb > 0) { f.kb = Math.max(0, f.kb - dt); const [kx, ky] = vecPx(f.kbU, f.kbV), k = (f.kb / 0.2) * 3; px += kx * k; py += ky * k; }
      // polvo de los pies al correr
      if (f.modo === 'walk' && !f.muerto && (f._p = (f._p || 0) - dt) < 0) { f._p = rnd(0.16, 0.3); part(v, { x: px + rnd(-3, 3), y: py, vx: rnd(-8, 8), vy: rnd(-8, -2), drag: 3, life: rnd(0.4, 0.6), size: 2, crece: 4, a: 0.3, col: [196, 178, 140] }); }
      const m = f.muerto, spr0 = f.st.spr;
      let alpha = m ? (m < 0.9 ? 1 : Math.max(0, 1 - (m - 0.9) / 0.7)) : spr0 === 'espectro' ? 0.75 : 1;
      if (m && spr0 === 'espectro') { alpha = Math.max(0, 0.75 - m / 0.6 * 0.75); py -= m * 20; }
      if (m && spr0 === 'golem') alpha = Math.max(0, 1 - m / 0.3);
      ctx.globalAlpha = alpha;
      // sombra y aro de bando
      if (!m) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(px - 5), Math.round(py - 1), 10, 3); ctx.fillRect(Math.round(px - 3), Math.round(py - 2), 6, 5);
        ctx.fillStyle = f.lado === 'p' ? 'rgba(80,140,255,0.6)' : 'rgba(255,80,60,0.55)'; ctx.fillRect(Math.round(px - 4), Math.round(py + 1), 8, 1);
      }
      ctx.save();
      ctx.translate(Math.round(px), Math.round(py));
      // al caer se tumban de costado (el dragón se hunde)
      if (m && spr0 !== 'dragon' && spr0 !== 'espectro' && spr0 !== 'golem') ctx.rotate(f.caida * Math.min(1, m / 0.28) * Math.PI / 2 * 0.9);
      if (m && spr0 === 'dragon') ctx.translate(0, Math.min(1, m / 1.2) * 14);
      if (spr0 === 'dragon') {
        const d = dragonSpr[Math.floor(f.anim * (m ? 1 : 4)) % 2];
        // vuela: sube y baja con el aleteo
        const vuelo = m ? 0 : Math.sin(f.anim * 4 * Math.PI / 2) * 3 - 4;
        if (f.flip) ctx.scale(-1, 1); // el dibujo mira a la derecha
        ctx.drawImage(d, -40, -56 + vuelo, 72, 52);
        if (f.golpe > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * (f.golpe / 0.18) * 0.7; ctx.drawImage(d, -40, -56 + vuelo, 72, 52); ctx.globalCompositeOperation = 'source-over'; }
      } else {
        const spr = sprite(f, frame);
        if (spr) {
          const big = spr0 === 'oso' ? 1.5 : spr0 === 'golem' ? 1.2 : 1;
          const w = (spr.k ? spr.w : spr.c.width) * big, h = (spr.k ? spr.h : spr.c.height) * big, x0 = Math.round(-spr.ax * big), y0 = Math.round(-spr.ay * big);
          ctx.drawImage(spr.c, x0, y0, w, h);
          // destello blanco del golpe recibido
          if (f.golpe > 0 && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (f.golpe / 0.18) * 0.8; ctx.drawImage(spr.c, x0, y0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; }
          if (spr0 === 'golem') { const k = 0.6 + 0.4 * Math.sin(f.anim * 3); ctx.fillStyle = 'rgba(122,240,255,' + k + ')'; ctx.fillRect(-3, -10, 2, 1); ctx.fillRect(1, -10, 2, 1); }
          if (spr0 === 'espectro' && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,90,230,0.18)'; ctx.fillRect(-6, -18, 12, 18); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // vida y cuántos son
      if (!m) {
        const k = U.clamp(f.hp / f.max, 0, 1), top = spr0 === 'dragon' ? 62 : 24;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(px - 7), Math.round(py - top), 14, 3);
        ctx.fillStyle = k < 0.3 ? '#ff7040' : f.lado === 'p' ? '#5ab0ff' : '#e05040'; ctx.fillRect(Math.round(px - 6), Math.round(py - top + 1), Math.round(12 * k), 1);
        if (f.lado === 'p' && f.rep > 1) { ctx.font = '7px "PK Num", "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('x' + f.rep, Math.round(px) + 1, Math.round(py - top - 1) + 1); ctx.fillStyle = '#cfe4ff'; ctx.fillText('x' + f.rep, Math.round(px), Math.round(py - top - 1)); }
        if (spr0 === 'dragon') { ctx.font = 'bold 8px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('DRAGÓN', Math.round(px) + 1, Math.round(py - top - 2) + 1); ctx.fillStyle = '#ffb070'; ctx.fillText('DRAGÓN', Math.round(px), Math.round(py - top - 2)); }
      }
    }
    // tiros: flechas que apuntan a donde van, rocas con sombra y arco, bolas de luz y de sombra con estela
    for (const p of b.tiros) {
      const k = Math.min(1, p.t / p.dur), H = p.tipo === 'piedra' ? 26 : p.tipo === 'flecha' ? 7 : 3;
      const [px, py] = aPx(p.u, p.v), [x0, y0] = aPx(p.u0, p.v0), [x1, y1] = aPx(p.o.u, p.o.v);
      const arc = Math.sin(k * Math.PI) * H, y = py - 10 - arc;
      const vx = (x1 - x0), vy = (y1 - y0) - Math.cos(k * Math.PI) * Math.PI * H, a = Math.atan2(vy, vx);
      if (p.tipo === 'piedra') {
        ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + 0.2 * (1 - arc / H)) + ')'; ctx.fillRect(Math.round(px - 2 - (1 - arc / H) * 1), Math.round(py - 1), Math.round(4 + (1 - arc / H) * 2), 2);
        ctx.save(); ctx.translate(Math.round(px), Math.round(y)); ctx.rotate(p.t * 9);
        ctx.fillStyle = '#6e685c'; ctx.fillRect(-2, -2, 4, 4); ctx.fillStyle = '#9a9284'; ctx.fillRect(-2, -2, 2, 2); ctx.restore();
        if (Math.random() < 0.5) part(v, { x: px, y, vx: rnd(-6, 6), vy: rnd(-4, 4), drag: 2, life: 0.35, size: 1, crece: 2, a: 0.35, col: [170, 160, 140] });
      } else if (p.tipo === 'flecha') {
        const cx = Math.cos(a), sy = Math.sin(a);
        ctx.strokeStyle = 'rgba(232,220,192,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - cx * 12, y - sy * 12); ctx.lineTo(px - cx * 6, y - sy * 6); ctx.stroke();
        ctx.strokeStyle = '#d8c8a0'; ctx.beginPath(); ctx.moveTo(px - cx * 6, y - sy * 6); ctx.lineTo(px, y); ctx.stroke();
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 2, 2);
      } else {
        const col = p.tipo === 'luz' ? [255, 246, 160] : [160, 90, 230];
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(px, y, 0, px, y, 9); g.addColorStop(0, 'rgba(' + col + ',0.7)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g; ctx.fillRect(px - 9, y - 9, 18, 18);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = p.tipo === 'luz' ? '#fffbe0' : '#2a1040'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 3, 3);
        part(v, { x: px + rnd(-1, 1), y: y + rnd(-1, 1), vx: rnd(-6, 6), vy: rnd(-6, 6), life: 0.3, size: 1, col, add: true });
        luzTemp(v, px, y, 22, col, 0.05);
      }
    }
    // rayos de los clérigos
    ctx.globalCompositeOperation = 'lighter';
    for (const r of v.rayos.slice()) {
      r.t += dt; if (r.t > r.dur) { v.rayos.splice(v.rayos.indexOf(r), 1); continue; }
      const k = 1 - r.t / r.dur; ctx.strokeStyle = 'rgba(' + r.col + ',' + 0.5 * k + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x0, r.y0); ctx.lineTo(r.x1, r.y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + 0.6 * k + ')'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // partículas: primero las opacas (polvo, rocas, humo), después las que brillan (chispas, fuego, magia)
    for (const q of v.fx) { q.t += dt; q.vx *= 1 - q.drag * dt; q.vy = q.vy * (1 - q.drag * dt) + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    v.fx = v.fx.filter(q => q.t < q.life);
    for (const pass of [false, true]) {
      if (pass) ctx.globalCompositeOperation = 'lighter';
      for (const q of v.fx) {
        if (q.add !== pass) continue;
        const k = q.t / q.life, al = q.a * (1 - k), sz = q.size + q.crece * k;
        if (q.fuego) { const c = k < 0.4 ? q.col : k < 0.7 ? [255, 90, 30] : [120, 40, 20]; ctx.fillStyle = 'rgba(' + c + ',' + al + ')'; }
        else ctx.fillStyle = 'rgba(' + q.col + ',' + al + ')';
        if (q.linea) { const sp = Math.hypot(q.vx, q.vy) || 1, L = Math.min(5, sp * 0.03) + 1; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - (q.vx / sp) * L, q.y - (q.vy / sp) * L); ctx.stroke(); }
        else if (q.cruz) { ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y), 3, 1); ctx.fillRect(Math.round(q.x), Math.round(q.y) - 1, 1, 3); }
        else ctx.fillRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), Math.max(1, Math.round(sz)), Math.max(1, Math.round(sz)));
      }
    }
    // zarpazos y tajos
    for (const c of v.cortes.slice()) {
      c.t += dt; if (c.t > 0.22) { v.cortes.splice(v.cortes.indexOf(c), 1); continue; }
      const k = c.t / 0.22, L = 9;
      ctx.strokeStyle = 'rgba(' + c.col + ',' + (1 - k) + ')'; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { const off = i * 2.5, nx = -Math.sin(c.ang) * off, ny = Math.cos(c.ang) * off, ext = L * (0.4 + k); ctx.beginPath(); ctx.moveTo(c.x + nx - Math.cos(c.ang) * ext, c.y + ny - Math.sin(c.ang) * ext); ctx.lineTo(c.x + nx + Math.cos(c.ang) * ext, c.y + ny + Math.sin(c.ang) * ext); ctx.stroke(); }
    }
    // aros (impactos y curas)
    for (const r of v.anillos.slice()) {
      r.t += dt; if (r.t > r.dur) { v.anillos.splice(v.anillos.indexOf(r), 1); continue; }
      const k = r.t / r.dur; ctx.strokeStyle = 'rgba(' + r.col + ',' + 0.7 * (1 - k) + ')'; ctx.lineWidth = r.suelo ? 2 : 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * k + 2, (r.r * k + 2) * (r.suelo ? 0.45 : 1), 0, 0, 6.3); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // números: los golpes grandes, más grandes y con un salto
    ctx.textAlign = 'center';
    for (const x of b.textos) {
      const [px, py] = aPx(x.u, x.v), pop = x.grande && x.t < 0.15 ? 1.6 - x.t * 4 : 1, fs = Math.round((x.grande ? 11 : 8) * pop);
      ctx.font = 'bold ' + fs + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.globalAlpha = 1 - x.t / 1.2; ctx.fillStyle = '#000'; ctx.fillText(x.txt, Math.round(px) + 1, Math.round(py - 26 - x.t * 12) + 1); ctx.fillStyle = x.col; ctx.fillText(x.txt, Math.round(px), Math.round(py - 26 - x.t * 12));
    }
    ctx.globalAlpha = 1;
    // lo que va adelante de las figuras: estalactitas, raíces, y las partículas (brasas, gotas, niebla)
    ctx.setTransform(s, 0, 0, s, ox * s, oy * s);
    ctx.drawImage(esc.frente, 0, 0);
    PK.Escenarios.particulas(ctx, esc, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (v.flash > 0) { ctx.fillStyle = 'rgba(255,240,210,' + Math.min(0.6, v.flash) + ')'; ctx.fillRect(0, 0, cv.width, cv.height); v.flash = Math.max(0, v.flash - dt * 1.6); }
    const W = cv.width, Hh = cv.height, base = Math.min(W, Hh);
    // carteles: el comienzo («¡A la batalla!») y los gritos de cada orden
    if (v.banner && !b.fin) {
      const bn = v.banner; bn.t += dt;
      if (bn.t > bn.dur) v.banner = null;
      else {
        const kin = Math.min(1, bn.t / 0.25), kout = bn.t > bn.dur - 0.4 ? (bn.dur - bn.t) / 0.4 : 1, sc = 1 + (1 - kin) * 0.8, fs = Math.round(base / (bn.chico ? 14 : 9) * sc);
        const y = bn.chico ? Hh * 0.3 : Hh * 0.42;
        ctx.globalAlpha = kin * kout;
        if (!bn.chico) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y - fs * 1.1, W, fs * (bn.sub ? 2.1 : 1.5)); }
        ctx.font = 'bold ' + fs + 'px "Pixelify Sans", monospace'; ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(2, fs / 10); ctx.strokeStyle = '#2a1206'; ctx.strokeText(bn.txt, W / 2, y); ctx.fillStyle = bn.chico ? '#ffe9b0' : '#ffd770'; ctx.fillText(bn.txt, W / 2, y);
        if (bn.sub) { ctx.font = Math.round(fs * 0.42) + 'px "Pixelify Sans", monospace'; ctx.fillStyle = '#f0e0c0'; ctx.fillText(bn.sub, W / 2, y + fs * 0.7); }
        ctx.globalAlpha = 1;
      }
    }
    if (b.fin) {
      const fi = v.final || (v.final = { t: 1, gano: b.fin.gano });
      fi.t += dt;
      ctx.fillStyle = fi.gano ? 'rgba(0,0,0,0.3)' : 'rgba(40,0,0,0.42)'; ctx.fillRect(0, 0, W, Hh);
      const t = b.fin.retirada ? 'Retirada' : b.fin.gano ? '¡Victoria!' : 'Derrota', kin = Math.min(1, fi.t / 0.35), fs = Math.round(base / 7 * (1 + (1 - kin) * 1.2));
      // rayos de luz detrás del cartel de victoria
      if (fi.gano) {
        ctx.save(); ctx.translate(W / 2, Hh / 2); ctx.rotate(fi.t * 0.25); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = 'rgba(255,210,90,' + 0.05 * kin + ')'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(base * 0.9, -base * 0.07); ctx.lineTo(base * 0.9, base * 0.07); ctx.fill(); }
        ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = kin;
      ctx.font = 'bold ' + fs + 'px "Pixelify Sans", monospace'; ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(3, fs / 9); ctx.strokeStyle = '#1a0a04'; ctx.strokeText(t, W / 2, Hh / 2);
      ctx.fillStyle = fi.gano ? '#ffe27a' : '#ff8a70'; ctx.fillText(t, W / 2, Hh / 2);
      ctx.globalAlpha = 1;
    }
  }
})();
