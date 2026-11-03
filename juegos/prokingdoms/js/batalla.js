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
  B.empezar = function (r) {
    if (B.lista.some(b => b.id === r.id)) return true;
    const tipos = Object.keys(r.units).filter(k => r.units[k] > 0 && TROPA[k]);
    if (!tipos.length) return false;
    const tac = PK.Exp.TACTICS[r.tactic] || PK.Exp.TACTICS.normal;
    const b = {
      id: r.id, nombre: r.name, lugar: lugarDe(r), t: 0, fin: null, orden: r.tactic === 'cauto' ? 'linea' : 'cargar', foco: null, vel: 1,
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
      if (her) { her.hp = Math.min(her.max, her.hp + f.pow * HPK * st.cura * dt * 0.1); if (Math.random() < dt * 2) b.efectos.push({ tipo: 'cura', u: her.u, v: her.v, t: 0, dur: 0.6 }); }
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
    if (st.fuego) { // aliento de fuego: a todos los que estén cerca del objetivo
      b.efectos.push({ tipo: 'fuego', u0: f.u, v0: f.v, u: o.u, v: o.v, t: 0, dur: 0.7 });
      for (const r of rivales) { const k = cerca(r, o); if (k < st.fuego) herir(b, r, dmg * (k < 0.3 ? 1 : 0.4) * (1 - k / (st.fuego * 1.6)) * (b.orden === 'dispersar' ? 0.7 : 1), f); }
      sfx('hit');
    } else if (st.dispara) {
      b.tiros.push({ tipo: st.dispara, u0: f.u, v0: f.v, u: f.u, v: f.v, o, dmg, t: 0, dur: Math.max(0.2, d / (st.dispara === 'piedra' ? 7 : 12)), area: st.area, de: f });
      if (st.dispara === 'flecha' && Math.random() < 0.4) sfx('arrow');
    } else { herir(b, o, dmg, f); if (Math.random() < 0.3) sfx(Math.random() < 0.5 ? 'hit' : 'pick'); }
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
    if (Math.random() < 0.25) b.textos.push({ u: o.u, v: o.v, t: 0, txt: '-' + Math.max(1, Math.round(dmg / HPK)), col: o.lado === 'p' ? '#ff8a70' : '#ffe27a' });
    if (o.hp <= 0) {
      o.hp = 0; o.muerto = 0.001;
      b.efectos.push({ tipo: 'polvo', u: o.u, v: o.v, t: 0, dur: 0.8 });
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
        sfx('hit');
      } else herir(b, p.o, p.dmg, p.de);
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
    sfx(gano ? 'level' : 'hit');
    const r = S().exp.runs.find(o => o.id === b.id);
    if (r) PK.Exp.finishBattle(r, { won: gano, lost: b.fin.lost, live: true, retreat: !!retirada });
    if (vista && vista.b === b) pintarControles();
    // si nadie la mira, se borra enseguida; si la están mirando, queda el cartel hasta que la cierren
    if (!vista || vista.b !== b) B.lista.splice(B.lista.indexOf(b), 1);
  }
  B.retirada = function (id) { const b = B.de(id); if (b && !b.fin) terminar(b, false, true); };
  B.ordenar = function (id, orden) { const b = B.de(id); if (b && B.ORDENES[orden]) b.orden = orden; };
  B.enfocar = function (id, kind) { const b = B.de(id); if (b) b.foco = b.foco === kind ? null : kind; };

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
    vista = { b, root, cv, ctx: cv.getContext('2d'), top, ctl, fondo: null, key: '' };
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
        el('div', { class: 'bt-bar mio' }, el('i', { style: { width: pm * 100 + '%' } }), el('span', null, 'Tus tropas · ' + n(b.mios) + ' grupos')),
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
    const esc = PK.Escenarios.crear(b.lugar, { W, H, fw, fh, mx, my, parado: vista.parado, seed: Math.floor(b.id * 131) % 100000 + 7, LU, LV });
    esc.mx = mx; esc.my = my;
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
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(esc.c, 0, 0);
    PK.Escenarios.animar(ctx, esc, dt);
    PK.Escenarios.luz(ctx, esc);
    ctx.setTransform(s, 0, 0, s, esc.mx * s, esc.my * s);
    // efectos de suelo
    for (const e of b.efectos) {
      const [px, py] = aPx(e.u, e.v), k = e.t / e.dur;
      if (e.tipo === 'cura') { ctx.fillStyle = 'rgba(140,255,170,' + (0.7 * (1 - k)) + ')'; ctx.fillRect(px - 1, py - 14 - k * 8, 2, 4); ctx.fillRect(px - 2, py - 13 - k * 8, 4, 2); }
      if (e.tipo === 'polvo') { ctx.fillStyle = 'rgba(200,180,140,' + (0.5 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(px, py - 3, 3 + k * 8, 0, 6.3); ctx.fill(); }
      if (e.tipo === 'fuego') {
        const [x0, y0] = aPx(e.u0, e.v0);
        for (let i = 0; i < 8; i++) { const q = (i / 8) * Math.min(1, k * 2); ctx.fillStyle = i % 2 ? 'rgba(255,200,80,' + (1 - k) + ')' : 'rgba(255,110,40,' + (1 - k) + ')'; ctx.fillRect(x0 + (px - x0) * q - 2 + Math.sin(i * 3 + e.t * 20) * 2, y0 - 10 + (py - 6 - y0 + 10) * q - 2, 5, 5); }
        ctx.fillStyle = 'rgba(255,120,40,' + 0.35 * (1 - k) + ')'; ctx.beginPath(); ctx.arc(px, py - 4, 16, 0, 6.3); ctx.fill();
      }
    }
    // figuras, de atrás hacia adelante
    const todos = b.mios.concat(b.suyos).filter(f => !f.muerto || f.muerto < 0.8);
    todos.sort((a, c) => aPx(a.u, a.v)[1] - aPx(c.u, c.v)[1]);
    for (const f of todos) {
      const [px, py] = aPx(f.u, f.v), frame = f.modo === 'work' ? Math.floor(f.anim * 5) % 4 : f.modo === 'walk' ? Math.floor(f.anim * 9) % 6 : 0;
      ctx.globalAlpha = f.muerto ? Math.max(0, 1 - f.muerto / 0.8) : f.st.spr === 'espectro' ? 0.75 : 1;
      // sombra y aro de bando
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(Math.round(px - 5), Math.round(py - 1), 10, 3);
      ctx.fillStyle = f.lado === 'p' ? 'rgba(80,140,255,0.55)' : 'rgba(255,80,60,0.5)'; ctx.fillRect(Math.round(px - 4), Math.round(py + 1), 8, 1);
      if (f.st.spr === 'dragon') {
        const d = dragonSpr[Math.floor(f.anim * 4) % 2];
        ctx.save(); ctx.translate(Math.round(px), Math.round(py)); if (f.flip) ctx.scale(-1, 1); // el dibujo mira a la derecha
        ctx.drawImage(d, -40, -56, 72, 52); ctx.restore(); // el dragón, bien grande
      } else {
        const spr = sprite(f, frame);
        if (spr) {
          const big = f.st.spr === 'oso' ? 1.5 : f.st.spr === 'golem' ? 1.2 : 1;
          const w = (spr.k ? spr.w : spr.c.width) * big, h = (spr.k ? spr.h : spr.c.height) * big;
          ctx.drawImage(spr.c, Math.round(px - spr.ax * big), Math.round(py - spr.ay * big), w, h);
          if (f.st.spr === 'golem') { ctx.fillStyle = '#7af0ff'; ctx.fillRect(Math.round(px - 3), Math.round(py - 10), 2, 1); ctx.fillRect(Math.round(px + 1), Math.round(py - 10), 2, 1); }
        }
      }
      if (f.golpe > 0 && !f.muerto) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(Math.round(px - 4), Math.round(py - 14), 8, 2); }
      ctx.globalAlpha = 1;
      // vida y cuántos son
      if (!f.muerto) {
        const k = U.clamp(f.hp / f.max, 0, 1), top = f.st.spr === 'dragon' ? 58 : 24;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(px - 7), Math.round(py - top), 14, 3);
        ctx.fillStyle = f.lado === 'p' ? '#5ab0ff' : '#e05040'; ctx.fillRect(Math.round(px - 6), Math.round(py - top + 1), Math.round(12 * k), 1);
        if (f.lado === 'p' && f.rep > 1) { ctx.font = '7px "PK Num", "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('x' + f.rep, Math.round(px) + 1, Math.round(py - top - 1) + 1); ctx.fillStyle = '#cfe4ff'; ctx.fillText('x' + f.rep, Math.round(px), Math.round(py - top - 1)); }
      }
    }
    // tiros
    for (const p of b.tiros) {
      const [px, py] = aPx(p.u, p.v), arc = p.tipo === 'piedra' ? Math.sin((p.t / p.dur) * Math.PI) * 18 : 0;
      ctx.fillStyle = p.tipo === 'piedra' ? '#8a8478' : p.tipo === 'luz' ? '#fff4a0' : p.tipo === 'sombra' ? '#8a5ac8' : '#e8dcc0';
      ctx.fillRect(Math.round(px - 1), Math.round(py - 10 - arc), p.tipo === 'piedra' ? 3 : 2, p.tipo === 'piedra' ? 3 : 2);
    }
    // números
    ctx.font = 'bold 8px "PK Num", "Pixelify Sans", monospace'; ctx.textAlign = 'center';
    for (const x of b.textos) { const [px, py] = aPx(x.u, x.v); ctx.globalAlpha = 1 - x.t / 1.2; ctx.fillStyle = '#000'; ctx.fillText(x.txt, Math.round(px) + 1, Math.round(py - 26 - x.t * 10) + 1); ctx.fillStyle = x.col; ctx.fillText(x.txt, Math.round(px), Math.round(py - 26 - x.t * 10)); }
    ctx.globalAlpha = 1;
    // lo que va adelante de las figuras: estalactitas, raíces, y las partículas (brasas, gotas, niebla)
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(esc.frente, 0, 0);
    PK.Escenarios.particulas(ctx, esc, dt);
    if (b.fin) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, cv.width, cv.height);
      const t = b.fin.retirada ? 'Retirada' : b.fin.gano ? '¡Victoria!' : 'Derrota', fs = Math.round(Math.min(cv.width, cv.height) / 8);
      ctx.font = 'bold ' + fs + 'px "Pixelify Sans", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(t, cv.width / 2 + 3, cv.height / 2 + 3);
      ctx.fillStyle = b.fin.gano ? '#ffe27a' : '#ff8a70'; ctx.fillText(t, cv.width / 2, cv.height / 2);
    }
  }
})();
