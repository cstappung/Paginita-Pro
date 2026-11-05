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
  const HERO_TROPAS = 0.6;

  // Cómo pelea cada tropa tuya (la fuerza y los multiplicadores contra cada enemigo vienen de D.ARMY).
  const TROPA = {
    militia: { hp: 1, dps: 1, alcance: 0.9, vel: 1.6, fila: 6.5, herr: 'hammer' },
    spear: { hp: 1.1, dps: 0.95, alcance: 1.3, vel: 1.5, fila: 6.8, herr: 'spear', linea: 1.35 },
    knight: { hp: 1.3, dps: 1.05, alcance: 0.9, vel: 2.4, fila: 7.2, herr: 'sword' },
    archer: { hp: 0.7, dps: 1, alcance: 6, vel: 1.5, fila: 3.4, dispara: 'flecha' },
    cleric: { hp: 0.8, dps: 0.8, alcance: 3.5, vel: 1.3, fila: 4.4, dispara: 'luz', cura: 0.22 },
    catapult: { hp: 0.6, dps: 1, alcance: 9.5, vel: 0.8, fila: 1.6, dispara: 'piedra', area: 1.3, cd: 3 },
    // Fase 4 (pk-21). flanco: busca a los tiradores enemigos, como los lobos; cura: los monjes curan poco y de cerca.
    rider: { hp: 1.15, dps: 1.05, alcance: 0.9, vel: 3, fila: 7.4, herr: 'spear', flanco: true },
    crossbow: { hp: 0.8, dps: 1, alcance: 7, vel: 1.1, fila: 2.8, dispara: 'virote', cd: 1.6, pesado: 1.6 },
    monk: { hp: 1.1, dps: 0.95, alcance: 0.9, vel: 1.5, fila: 6.2, herr: 'hammer', cura: 0.08, radio: 1.8 },
    mage: { hp: 0.65, dps: 1, alcance: 7.5, vel: 1.1, fila: 2.2, dispara: 'arcano', area: 1.1, cd: 2.4 },
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
    // H4 (pk-17). maldice: su tiro frena al que toca; aplasta: el golpe alcanza a los que estén cerca; agarra: el
    // que recibe el golpe no puede moverse un rato.
    arcane: [
      { id: 'bruja', nombre: 'Bruja', peso: 0.7, hp: 0.8, dps: 1, alcance: 4.5, vel: 1.2, dispara: 'sombra', maldice: true, spr: 'bruja' },
      { id: 'fatuo', nombre: 'Fuego fatuo', peso: 1, hp: 0.6, dps: 0.95, alcance: 0.9, vel: 2.6, flanco: true, spr: 'fatuo' },
    ],
    giant: [{ id: 'gigante', nombre: 'Gigante', peso: 1, hp: 3, dps: 1.05, alcance: 1.5, vel: 0.7, aplasta: 1.5, spr: 'gigante', escala: 1.8 }],
    abyss: [
      { id: 'tentaculo', nombre: 'Tentáculo', peso: 1, hp: 1.3, dps: 0.9, alcance: 1.3, vel: 1, agarra: true, spr: 'tentaculo' },
      { id: 'sirena', nombre: 'Sirena', peso: 0.6, hp: 0.75, dps: 1, alcance: 5, vel: 1.3, dispara: 'luz', spr: 'sirena' },
    ],
  };
  // C4 (pk-21): enemigos con rol. Cualquier figura común puede llevar uno (se ve una marca sobre la cabeza y se
  // nombra «Lobo chamán», «Forajido escudero»…). extra: cuánto más vale la pelea con él; el resto de los enemigos
  // pierde esa vida para que la fuerza total siga siendo la que pedía la expedición (Exp.powerVs, regla 8).
  B.ROLES = {
    chaman: { nombre: 'chamán', col: '#7aff70', extra: 0.06, desc: 'cura a los suyos', cura: 0.2, atras: 1.6 },
    escudero: { nombre: 'escudero', col: '#c8d0e0', extra: 0.03, desc: 'para las flechas de frente y cubre a los de atrás', hp: 1.6, dps: 0.6 },
    jefebanda: { nombre: 'jefe de banda', col: '#ffb040', extra: 0.06, desc: 'los suyos cerca pegan +20%', hp: 1.3, aura: 1.2 },
    invocador: { nombre: 'invocador', col: '#c08aff', extra: 0.08, desc: 'llama refuerzos cada 14 s', atras: 1.2 },
    elite: { nombre: 'élite', col: '#ffe060', extra: 0.05, desc: 'más vida y más daño', hp: 1.7, dps: 1.15 },
  };
  const NOMBRES_ELITE = ['Garra Negra', 'Ojo de Hierro', 'el Tuerto', 'Sangre Vieja', 'Diente Roto', 'la Sombra', 'Cuervo', 'Mano de Piedra', 'el Mudo', 'Ceniza'];
  // cuántos roles según la fuerza pedida: ninguno en las primeras peleas
  B.cuantosRoles = need => (need < 140 ? 0 : need < 600 ? 1 : need < 2500 ? 2 : 3);
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
    arcane: 'Arcanos: las brujas maldicen y frenan a los tuyos. Carga con caballeros; los clérigos acortan la maldición.',
    giant: 'Gigantes: lentos, pero su golpe alcanza a varios. Dispérsate y que peguen las catapultas y los arqueros.',
    abyss: 'Abisales: los tentáculos agarran a los de adelante. Arqueros atrás y clérigos.',
  };
  B.CONSEJO_ROL = {
    chaman: 'El chamán cura a los suyos: tus tiradores, «Atacar primero» al chamán.',
    escudero: 'El escudero para las flechas de frente: los jinetes lo rodean y los magos y catapultas le pegan igual.',
    jefebanda: 'El jefe de banda hace pegar más a los que tiene cerca: tumbarlo primero calma a todos.',
    invocador: 'El invocador llama refuerzos cada 14 s: cuanto antes caiga, menos llegan.',
    elite: 'La élite tiene mucha vida: «Mantener línea» y que la desgasten los tiradores.',
  };
  const TERRENO = {
    camp: { suelo: [118, 96, 62], tono: 18, deco: 'carpa' },
    cave: { suelo: [58, 62, 78], tono: 14, deco: 'cristal' },
    lair: { suelo: [78, 62, 44], tono: 16, deco: 'hueso' },
    crypt: { suelo: [82, 84, 88], tono: 12, deco: 'lapida' },
    crater: { suelo: [64, 48, 44], tono: 18, deco: 'estrella' },
    nest: { suelo: [96, 70, 48], tono: 18, deco: 'oro' },
    swamp: { suelo: [60, 76, 50], tono: 16, deco: 'pasto' },
    giants: { suelo: [104, 96, 84], tono: 14, deco: 'hueso' },
    temple: { suelo: [62, 84, 92], tono: 12, deco: 'lapida' },
    campo: { suelo: [86, 126, 58], tono: 16, deco: 'pasto' },
  };

  // C1 (pk-22): terreno del lugar. rocas: tapan a los tiradores de las flechas que vienen del otro lado y no se
  // pueden atravesar; puente: un río que solo se cruza por el medio; loma: los tiradores encima tiran +1,5 más lejos.
  // Fase 9 «c» (pk-29, armada.js): las tablas quedan a la vista para que el mar agregue sus barcos, enemigos y
  // jefes, y estos ganchos dejan que dibuje sus figuras, arme las baterías y mueva a sus jefes.
  B.TROPA = TROPA; B.ENEMIGOS = ENEMIGOS; B.TERRENO = TERRENO;
  B.ext = { sprite: null, alArmar: null, jefePaso: {} };
  TERRENO.mar = { suelo: [40, 92, 130], tono: 10, deco: 'olas' };
  const OBST = { camp: ['rocas', 'loma'], cave: ['rocas'], lair: ['rocas'], crypt: ['rocas'], crater: ['loma', 'rocas'], nest: ['loma'], swamp: ['puente'], giants: ['rocas'], temple: ['puente'], campo: ['loma'] };
  B.OBST_TXT = { rocas: 'Rocas: cubren de las flechas a quien esté detrás.', puente: 'Un río: solo se cruza por el puente del medio.', loma: 'Una loma: tus tiradores encima disparan más lejos.' };
  function terreno(b, r) {
    const rng = U.rng(5113 + (r.id || 0) * 17), tipos = OBST[b.lugar] || [], o = { rocas: [], rio: null, loma: null, tipos };
    for (const t of tipos) {
      if (t === 'rocas') for (let i = 0; i < 3; i++) o.rocas.push({ u: 11 + rng() * 8, v: 2 + rng() * (LV - 4), r: 0.7 + rng() * 0.4, s: Math.floor(rng() * 1e6) });
      if (t === 'puente') o.rio = { u0: 14, u1: 16, v0: LV / 2 - 1.6, v1: LV / 2 + 1.6 };
      if (t === 'loma') o.loma = { u: 3.2, v: rng() < 0.5 ? LV * 0.28 : LV * 0.72, r: 2.4 };
    }
    return o;
  }
  // ¿la piedra tapa al blanco del tirador? (la roca está entre los dos y pegada al blanco)
  function cubierto(b, de, o) {
    const ob = b.obst;
    if (!ob || !ob.rocas.length) return false;
    for (const k of ob.rocas) {
      if (Math.hypot(o.u - k.u, o.v - k.v) > k.r + 1.3) continue;
      const du = o.u - de.u, dv = o.v - de.v, L2 = du * du + dv * dv || 1, t = U.clamp(((k.u - de.u) * du + (k.v - de.v) * dv) / L2, 0, 1);
      if (t > 0.05 && t < 1 && Math.hypot(de.u + du * t - k.u, de.v + dv * t - k.v) < k.r) return true;
    }
    return false;
  }
  const enLoma = (b, f) => !!(b.obst && b.obst.loma && Math.hypot(f.u - b.obst.loma.u, f.v - b.obst.loma.v) < b.obst.loma.r);
  // nadie atraviesa una roca, y el río solo se cruza por el puente
  function obstaculos(b, list) {
    const ob = b.obst;
    if (!ob) return;
    for (const f of list) {
      for (const k of ob.rocas) { const du = f.u - k.u, dv = f.v - k.v, d = Math.hypot(du, dv) || 0.01; if (d < k.r + 0.25) { f.u = k.u + (du / d) * (k.r + 0.25); f.v = k.v + (dv / d) * (k.r + 0.25); } }
      const rio = ob.rio;
      if (rio && f.u > rio.u0 && f.u < rio.u1 && (f.v < rio.v0 || f.v > rio.v1)) {
        // empuja hacia el borde más cercano del río, o hacia el puente si ya está casi en él
        const aOrilla = Math.min(f.u - rio.u0, rio.u1 - f.u), aPuente = f.v < rio.v0 ? rio.v0 - f.v : f.v - rio.v1;
        if (aPuente < aOrilla + 0.4) f.v = U.clamp(f.v, rio.v0, rio.v1); else f.u = f.u - rio.u0 < rio.u1 - f.u ? rio.u0 : rio.u1;
      }
    }
  }
  // al caminar hacia alguien al otro lado del río, primero hacia el puente
  function rumboRio(b, f, o) {
    const rio = b.obst && b.obst.rio;
    if (!rio) return o;
    const cruza = (f.u < rio.u0 && o.u > rio.u0) || (f.u > rio.u1 && o.u < rio.u1);
    if (!cruza || (f.v >= rio.v0 && f.v <= rio.v1 && Math.abs(f.u - (rio.u0 + rio.u1) / 2) < 2.5)) return o;
    return { u: f.u < rio.u0 ? rio.u0 - 0.3 : rio.u1 + 0.3, v: U.clamp(f.v, rio.v0 + 0.4, rio.v1 - 0.4) };
  }

  // ---------- Armar la batalla ----------
  const porUnidad = k => PK.Exp.powerVs({ [k]: 1 }, {}); // fuerza de un soldado con veteranía, era y bonos
  function lugarDe(r) {
    if (D.temaActivo === 'mar') return 'mar'; // en el archipiélago todo se pelea en el agua (pk-29)
    if (r.camp !== undefined) return 'camp';
    if (r.cap) { const c = D.CAPITULOS[r.cap - 1]; return (c && c.lugar && c.lugar.terreno) || 'campo'; }
    const p = r.poi !== undefined ? PK.World.pois[r.poi] : null;
    return p && TERRENO[p.kind] ? p.kind : 'campo';
  }
  // Qué tan adentro: 0 en el primer piso (o el campamento más cercano), 1 en el último (o el más lejano).
  // El escenario se vuelve más espectacular con eso (escenarios.js).
  function nivelDe(r) {
    if (r.nivel !== undefined) return r.nivel; // los del mar lo traen puesto (armada.js)
    if (r.cap) return 0.6;
    if (r.camp !== undefined) { const p = PK.World.pois[r.camp]; return p ? G().poiTier(p) / 6 : 0; }
    const p = r.poi !== undefined ? PK.World.pois[r.poi] : null, d = p && D.DUNGEON[p.kind];
    return d && r.floor ? U.clamp((r.floor - 1) / Math.max(1, d.floors - 1), 0, 1) : 0;
  }
  // C1 (pk-21): la formación elegida en el planificador (r.form.filas[tipo] = 'f' | 'm' | 'a'). La fila por
  // defecto de cada tropa es la de siempre (TROPA.fila), así que sin tocar nada la pelea es la misma.
  const FILAS = { f: 7.2, m: 4.8, a: 2.4 };
  B.FILAS = { f: 'Frente', m: 'Medio', a: 'Atrás' };
  B.filaPorDefecto = k => (TROPA[k].fila >= 6 ? 'f' : TROPA[k].fila >= 3.6 ? 'm' : 'a');
  const filaDe = (r, k) => { const x = r.form && r.form.filas && r.form.filas[k]; return x && FILAS[x] && x !== B.filaPorDefecto(k) ? FILAS[x] : TROPA[k].fila; };
  B.empezar = function (r) {
    if (B.lista.some(b => b.id === r.id)) return true;
    const tipos = Object.keys(r.units).filter(k => r.units[k] > 0 && TROPA[k]);
    if (!tipos.length && !(r.baterias > 0)) return false; // un asalto pirata se puede pelear solo con las baterías
    const tac = PK.Exp.TACTICS[r.tactic] || PK.Exp.TACTICS.normal;
    // El héroe sube la fuerza de la compañía (Exp.heroMult, lo que dice el planificador). En la batalla en vivo las
    // tropas reciben solo una parte (HERO_TROPAS) y el resto lo pone su habilidad, que se usa sola si nadie mira:
    // así el resultado medio en vivo se parece al del cálculo por proporción (regla 8). Medido con B.adelantar.
    const hm = 1 + (PK.Exp.heroMult(r.heroe, r.enemy || { bandit: 1 }) - 1) * HERO_TROPAS;
    const b = {
      id: r.id, nombre: r.name, lugar: lugarDe(r), nivel: nivelDe(r), piso: r.floor || 0, t: 0, fin: null, orden: r.tactic === 'cauto' ? 'linea' : 'cargar', foco: null, vel: 1,
      tac, suerte: U.rand(0.8, 1.2), mios: [], suyos: [], tiros: [], efectos: [], textos: [], enviados: Object.assign({}, r.units), enemigo: r.enemy || { bandit: 1 },
      dano: {}, flanco: (r.form && r.form.flanco) || 'c',
    };
    const xp = (S().exp && S().exp.xp) || {};
    // tus figuras: repartidas según la compañía (al menos una por tipo)
    const total = Math.max(1, tipos.reduce((s, k) => s + r.units[k], 0)), nFig = Math.min(MAX_MIOS, total);
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
        const pow = rep * porUnidad(k) * hm, f = figura('p', k, st, pow, rep, filaDe(r, k) + (Math.random() - 0.5) * 0.6, 0);
        f.max = f.hp = f.hp * PK.Exp.vsFactor(k, b.enemigo);
        f.rango = D.rankOf(xp[k] || 0); // C8: estrellas sobre la figura (solo se dibujan)
        b.mios.push(f);
      }
    }
    // los enemigos: la fuerza que pedía la expedición, repartida según su mezcla
    const nEn = U.clamp(Math.round(5 + Math.log2(Math.max(1, r.need / 40)) * 1.6), 4, 16);
    const mezcla = [];
    for (const kind in b.enemigo) for (const a of ENEMIGOS[kind] || ENEMIGOS.bandit) mezcla.push({ kind, a, w: b.enemigo[kind] * a.peso });
    const wTot = mezcla.reduce((s, m) => s + m.w, 0);
    // jefe de mazmorra (incursion.js): se lleva el 55% de la fuerza; el resto, su escolta
    const jf = r.jefe && JEFE[r.jefe];
    if (jf) {
      const f = figura('e', jf.id, jf, r.need * 0.55 * b.suerte, 0, LU - 5, 0, jf.kind);
      f.v = LV / 2; f.esJefe = true;
      b.suyos.push(f); b.jefeF = f; b.jefeT = { a: 6, b: 4, c: 12 };
    }
    for (const m of mezcla) {
      const share = (m.w / wTot) * r.need * (jf ? 0.45 : 1);
      const n = m.a.jefe ? 1 : Math.max(1, Math.round((m.w / wTot) * nEn));
      for (let i = 0; i < n; i++) b.suyos.push(figura('e', m.a.id, m.a, (share / n) * b.suerte, 0, LU - 6 + (m.a.dispara ? 2.2 : 0) + (Math.random() - 0.5) * 0.8, 0, m.kind));
    }
    acomodar(b.mios); acomodar(b.suyos.filter(f => !f.esJefe));
    ponerRoles(b, r);
    b.obst = terreno(b, r);
    // afijos de la semana (incursion.js)
    b.af = r.inc ? r.inc.afijos.slice() : [];
    if (b.af.includes('doble')) for (const f of b.suyos) f.max = f.hp = f.hp * 1.3;
    if (b.af.includes('sinluna')) b.nivel = Math.min(1, b.nivel + 0.35);
    b.peligros = [];
    if (B.ext.alArmar) B.ext.alArmar(b, r);
    b.fuerza0 = [vida(b.mios), vida(b.suyos)];
    if (r.heroe && PK.Heroes) armarHeroe(b, PK.Heroes.de(r.heroe));
    B.lista.push(b);
    r.phase = 'battle';
    r.battleAt = Date.now();
    return true;
  };
  // Fase 4 (pk-21): un enemigo común no puede valer más de TOPE_EN veces su fuerza (vida x daño). Los gólems, osos y
  // gigantes tenían 2,4 a 3,2 y a fuerzas iguales nadie les ganaba sin catapultas (el pendiente de pk-15). Los
  // jefes (JEFE) quedan como se midieron.
  const TOPE_EN = 1.6;
  function figura(lado, tipo, st, pow, rep, u, v, kind) {
    const k = lado === 'e' && !st.jefe ? Math.max(1, Math.sqrt((st.hp * st.dps) / TOPE_EN)) : 1;
    const hp = (pow * HPK * st.hp) / k;
    return { lado, tipo, kind, st, pow, rep, hp, max: hp, dps: (pow * DPSK * st.dps) / k, u, v, u0: u, cd: Math.random() * 0.8, anim: Math.random() * 3, flip: lado === 'e', modo: 'idle', muerto: 0, golpe: 0, objetivo: null };
  }
  function ponerRoles(b, r) {
    const n = B.cuantosRoles(r.need || 0);
    if (!n) return;
    const rng = U.rng(9137 + (r.id || 0) * 31 + (r.floor || 0) * 7), comunes = b.suyos.filter(f => !f.esJefe && !f.st.jefe);
    if (comunes.length < 3) return;
    const ids = Object.keys(B.ROLES), usados = [];
    let extra = 0;
    for (let i = 0; i < n && comunes.length > 2; i++) {
      const f = comunes.splice(Math.floor(rng() * comunes.length), 1)[0];
      let id = ids[Math.floor(rng() * ids.length)];
      if (usados.includes(id)) id = ids.find(x => !usados.includes(x));
      usados.push(id);
      const R = B.ROLES[id];
      f.rol = id; f.nombreRol = id === 'elite' ? U.pick(NOMBRES_ELITE, rng) : null;
      f.max = f.hp = f.hp * (R.hp || 1); f.dps *= R.dps || 1;
      if (R.atras) f.u = Math.min(LU - 0.6, f.u + R.atras);
      if (id === 'invocador') f.llama = 6 + rng() * 4;
      extra += R.extra;
    }
    // la fuerza total no cambia: lo que suman los roles lo pierden todos en vida (y la vida de los que valen más, igual)
    const k = 1 / (1 + extra);
    for (const f of b.suyos) if (!f.esJefe) f.max = f.hp = f.hp * k;
    b.roles = usados;
  }
  const nombreDe = f => (f.nombreRol ? f.nombreRol : f.st.nombre + (f.rol ? ' ' + B.ROLES[f.rol].nombre : ''));
  B.nombreDe = nombreDe;
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
      if (b.pausa) continue; // pausa táctica (C3): las órdenes se pueden dar igual
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
    for (const f of b.mios.concat(b.suyos)) { f.anim += dt; f.golpe = Math.max(0, f.golpe - dt); if (f.muerto) f.muerto += dt; if (f.lento > 0) f.lento -= dt; if (f.atado > 0) f.atado -= dt; if (f.encantado > 0) f.encantado -= dt; }
    b.auras = b.roles ? suyos.filter(f => f.rol === 'jefebanda') : null;
    if (b.roles && b.roles.includes('invocador')) invocar(b, dt);
    for (const f of mios) actuar(b, f, suyos, mios, dt);
    for (const f of suyos) actuar(b, f, mios, suyos, dt);
    if (b.heroe) heroePaso(b, mios, suyos, dt);
    if (b.arenga > 0) b.arenga -= dt;
    if (b.jefeF) jefePaso(b, mios, suyos, dt);
    if (b.peligros.length) peligros(b, dt);
    separar(mios, b.orden === 'dispersar' ? 1.35 : 0.7, dt);
    separar(suyos, 0.7, dt);
    obstaculos(b, mios); obstaculos(b, suyos);
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
  const enFoco = (b, o) => (b.foco === 'jefe' ? o.esJefe : b.foco.indexOf('rol:') === 0 ? o.rol === b.foco.slice(4) : o.kind === b.foco);
  function elegir(b, f, rivales) {
    let mejor = null, md = 1e9;
    for (const o of rivales) {
      let d = cerca(f, o);
      // la orden de foco manda (también «Al jefe»); el cuerpo a cuerpo igual responde al que lo muerde de cerca
      if (f.lado === 'p' && b.foco && enFoco(b, o)) d -= f.st.dispara ? 8 : 3;
      if (f.st.flanco && o.st.dispara) d -= 4;                            // lobos y jinetes buscan a los de atrás
      if (f.lado === 'p' && f.st.dispara && o.st.dispara) d -= 1.5;       // tus tiradores, contra los suyos
      if (d < md) { md = d; mejor = o; }
    }
    return mejor;
  }
  function actuar(b, f, rivales, aliados, dt) {
    const st = f.st;
    f.cd -= dt;
    // los clérigos curan primero al más herido cerca
    const cura = st.cura || (f.rol === 'chaman' ? B.ROLES.chaman.cura : 0);
    if (cura && !(f.lado === 'p' && b.af.includes('plaga'))) {
      let her = null, hv = 0.85;
      for (const a of aliados) { const k = a.hp / a.max; if (a !== f && k < hv && cerca(a, f) < (st.radio || 3.5)) { hv = k; her = a; } }
      if (her) { her.hp = Math.min(her.max, her.hp + f.pow * HPK * cura * dt * 0.1); if (Math.random() < dt * 2) { b.efectos.push({ tipo: 'cura', u: her.u, v: her.v, t: 0, dur: 0.6 }); fxCura(b, f, her); } }
    }
    if (!rivales.length) { f.modo = 'idle'; return; }
    if (f.encantado > 0) { f.modo = 'idle'; return; } // la Voz del Abismo (H4)
    if (!f.objetivo || f.objetivo.muerto || Math.random() < dt * 0.6) f.objetivo = elegir(b, f, rivales);
    const o = f.objetivo;
    const d = cerca(f, o), alcance = st.alcance * (f.lado === 'p' && st.dispara && b.af.includes('niebla') ? 0.6 : 1) + (st.dispara && enLoma(b, f) ? 1.5 : 0);
    f.flip = o.u < f.u;
    // mantener la línea: tus cuerpo a cuerpo no salen de su fila hasta que el enemigo se acerca
    const quieto = f.lado === 'p' && b.orden === 'linea' && !st.dispara && d > 2.6 && f.u >= f.u0 - 0.5;
    if (d > alcance) {
      if (quieto || f.atado > 0 || st.fija) { f.modo = 'idle'; return; }
      const ir = rumboRio(b, f, o), di = Math.hypot(ir.u - f.u, ir.v - f.v) || 0.01;
      const sp = st.vel * (f.lado === 'p' && b.orden === 'cargar' ? 1.1 : 1) * (f.lado === 'p' && b.cancion > 0 ? 1.25 : 1) * (b.af.includes('helado') ? 0.8 : 1) * (f.lento > 0 ? 0.55 : 1) * aFavor(b, f, 1.15, 0.92) * dt;
      f.u += ((ir.u - f.u) / di) * sp; f.v += ((ir.v - f.v) / di) * sp;
      f.modo = 'walk';
      return;
    }
    // los tiradores retroceden si se les vienen encima (salvo con «cargar»)
    if (st.dispara && !st.fija && d < 1.3 && !(f.lado === 'p' && b.orden === 'cargar')) {
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
      b.tiros.push({ tipo: st.dispara, u0: f.u, v0: f.v, u: f.u, v: f.v, o, dmg, t: 0, dur: Math.max(0.2, d / (st.dispara === 'piedra' ? 7 : st.dispara === 'virote' || st.dispara === 'arpon' ? 16 : st.dispara === 'bala' ? 10 : 12)), area: st.area, de: f });
      if ((st.dispara === 'flecha' || st.dispara === 'virote' || st.dispara === 'arpon') && Math.random() < 0.4) sfx('arrow');
      if (st.dispara === 'bala') { if (Math.random() < 0.5) sfx('boom'); fxCanon(b, f, o); }
    } else if (st.explota) { // brulote (pk-29): se mete entre ellos y estalla; se pierde con la explosión
      // daña lo que habría hecho viviendo la pelea entera; su vida sale de la cuenta (si no, estallar contaba como
      // perder y los brulotes disparaban la retirada sola de los suyos)
      for (const r of rivales) { const k = cerca(r, o); if (k < st.explota) herir(b, r, f.pow * HPK * 1.5 * mult(b, f, r) * (1 - k / (st.explota * 1.6)), f); }
      if (f.lado === 'p') b.fuerza0[0] = Math.max(1, b.fuerza0[0] - f.max);
      f.hp = 0; f.muerto = 0.001; f.caida = 1; f.objetivo = null; f.estallo = true;
      fxJefe(b, 'meteoro', f); grito(b, '¡Brulote!');
    } else if (st.aplasta) { // gigantes: el golpe alcanza a los que estén cerca del objetivo («Dispersarse» los separa)
      herir(b, o, dmg, f); fxGolpe(b, o, f, true);
      for (const r of rivales) { if (r === o) continue; const k = cerca(r, o); if (k < st.aplasta) herir(b, r, dmg * 0.5 * (1 - k / (st.aplasta * 1.4)) * (b.orden === 'dispersar' ? 0.6 : 1), f); }
      const v = fxDe(b); if (v) sacudir(v, 2);
    } else {
      herir(b, o, dmg, f); fxGolpe(b, o, f, dmg > o.max * 0.15); if (Math.random() < 0.3) sfx(Math.random() < 0.5 ? 'espada' : 'hit');
      if (st.agarra && o.lado === 'p') o.atado = 1.6;
    }
  }
  // Multiplicadores: tropa contra tipo de enemigo (D.ARMY.vs), táctica, la línea de lanceros, los lobos con los de atrás.
  function mult(b, f, o) {
    if (f.lado === 'p') {
      let m = ((D.ARMY[f.tipo] && D.ARMY[f.tipo].vs) || {})[o.kind] || 1;
      m *= aFavor(b, f, 1.1, 0.95);
      if (o.st.caparazon && f.st.dispara && !f.st.rompe) m *= 0.6; // cangrejos: las balas chicas rebotan
      if (o.esJefe && b.jefeMult) m *= b.jefeMult(f, o);
      m *= b.tac.pow;
      if (b.orden === 'linea' && f.st.linea && (o.st.vel >= 2 || o.st.jefe)) m *= f.st.linea;
      if (f.st.pesado && o.st.hp >= 2) m *= f.st.pesado; // el virote pesado contra los grandes (gólems, osos, gigantes)
      if (b.cancion > 0) m *= 1.25;
      if (b.corrientes > 0 && f.tipo === 'infanteria') m *= 1.4; // la Corsaria: los abordajes
      // Ignivor en el aire: solo le llegan las flechas y los lanceros en línea
      if (o.esJefe && b.vuela && !(f.st.dispara === 'flecha' || f.st.dispara === 'virote' || (f.tipo === 'spear' && b.orden === 'linea'))) m *= 0.15;
      if (o.esJefe && b.escudo) m *= 0.15; // el escudo de Brunilda
      return m;
    }
    let m = b.tac.loss >= 1 ? 1 + (b.tac.loss - 1) * 0.3 : 1 - (1 - b.tac.loss) * 0.4; // asalto expone más; cauteloso, menos
    if (f.st.flanco && o.st.dispara) m *= 1.25;
    if (f.st.hunde && o.st.chico) m *= f.st.hunde; // tiburones contra las balandras
    m *= aFavor(b, f, 1.1, 0.95);
    if (b.auras && b.auras.some(j => cerca(j, f) < 3)) m *= B.ROLES.jefebanda.aura; // C4: jefe de banda
    if (b.muro > 0) m *= 0.5;
    if (b.af.includes('furia')) m *= 1.2;
    if (b.arenga > 0) m *= b.orden === 'linea' ? 1.05 : 1.35;
    return m;
  }
  // el viento (pk-29): los barcos del lado que lo tiene a favor navegan y disparan mejor
  function aFavor(b, f, si, no) { return b.viento && f.st.barco ? (b.viento * (f.lado === 'p' ? 1 : -1) > 0 ? si : no) : 1; }
  function herir(b, o, dmg, de) {
    if (o.muerto || dmg <= 0) return;
    if (de && de.lado === 'p' && o.lado === 'e' && D.ARMY[de.tipo]) b.dano[de.tipo] = (b.dano[de.tipo] || 0) + Math.min(dmg, Math.max(0, o.hp)) / HPK; // C7: para el informe
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
      if (o.rol && vista && vista.b === b) pintarControles(); // se va su botón de «Atacar primero»
      // afijo «Aliados espectrales»: un enemigo caído deja un espectro (uno por figura)
      if (o.lado === 'e' && b.af && b.af.includes('espectral') && o.st.spr !== 'espectro' && !o.esJefe) {
        const e = figura('e', 'espectro', ENEMIGOS.undead[1], o.pow * 0.3, 0, o.u, o.v, 'undead');
        e.v = o.v; b.suyos.push(e);
      }
    }
  }
  function tiros(b, dt) {
    for (const p of b.tiros.slice()) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.u = p.u0 + (p.o.u - p.u0) * k; p.v = p.v0 + (p.o.v - p.v0) * k;
      if (k < 1) continue;
      b.tiros.splice(b.tiros.indexOf(p), 1);
      if (p.area) { // piedra de catapulta o bola del mago
        const rivales = p.de.lado === 'p' ? b.suyos : b.mios;
        for (const r of rivales) { if (r.muerto) continue; const d = cerca(r, p.o); if (d < p.area) herir(b, r, p.dmg * (1 - d / (p.area * 1.5)), p.de); }
        if (p.tipo === 'piedra') b.efectos.push({ tipo: 'polvo', u: p.o.u, v: p.o.v, t: 0, dur: 0.6 });
        sfx(p.tipo === 'piedra' ? 'boom' : 'hit');
      } else {
        // el virote no se pierde: si su blanco ya cayó, sigue hasta el enemigo más cercano (los tiros lentos y pesados
        // se desperdiciaban todos en el mismo cuerpo)
        if ((p.tipo === 'virote' || p.tipo === 'arpon' || p.tipo === 'bala') && p.o.muerto) { const rv = (p.de.lado === 'p' ? b.suyos : b.mios).filter(o => !o.muerto && cerca(o, p.o) < 2.5).sort((a, c) => cerca(a, p.o) - cerca(c, p.o))[0]; if (rv) p.o = rv; }
        herir(b, p.o, p.dmg * (p.de && p.de.lado === 'p' && (p.tipo === 'flecha' || p.tipo === 'virote') ? escudo(b, p.o, p.de) : 1) * (p.de && cubierto(b, p.de, p.o) ? 0.6 : 1), p.de);
        // brujas (H4): la maldición frena; con clérigos dura la mitad
        if (p.de && p.de.st.frena && !p.o.muerto) p.o.lento = Math.max(p.o.lento || 0, p.de.st.frena); // el arpón (pk-29)
        if (p.de && p.de.st.maldice && p.o.lado === 'p') p.o.lento = Math.max(p.o.lento || 0, hayClerigo(b, b.mios.filter(f => !f.muerto)) ? 1.2 : 2.5);
      }
      fxImpacto(b, p);
    }
  }
  // C4: el escudero para las flechas y virotes que le llegan de frente, y cubre un poco a los que tiene detrás
  function escudo(b, o, de) {
    if (o.rol === 'escudero' && de.u < o.u) return 0.3;
    for (const e of b.suyos) if (e.rol === 'escudero' && !e.muerto && e !== o && Math.abs(e.v - o.v) < 1.4 && o.u > e.u && o.u - e.u < 2.5 && de.u < e.u) return 0.6;
    return 1;
  }
  // C4: el invocador llama dos de los suyos cada 14 s (tres veces como mucho)
  function invocar(b, dt) {
    for (const f of b.suyos) {
      if (f.rol !== 'invocador' || f.muerto || (f.invoco || 0) >= 3) continue;
      f.llama -= dt;
      if (f.llama > 0) continue;
      f.llama = 14; f.invoco = (f.invoco || 0) + 1;
      const base = (ENEMIGOS[f.kind] || ENEMIGOS.bandit).find(a => !a.jefe) || f.st;
      for (let i = 0; i < 2; i++) { const w = figura('e', base.id, base, f.pow * 0.2, 0, f.u + 0.8, 0, f.kind); w.v = U.clamp(f.v + (i ? 1.2 : -1.2), 1, LV - 1); b.suyos.push(w); }
      grito(b, '¡El ' + nombreDe(f) + ' llama refuerzos!');
      const v = fxDe(b); if (v) { const [x, y] = aPx(f.u, f.v); v.anillos.push({ x, y, t: 0, dur: 0.6, col: [192, 138, 255], r: 20, suelo: true }); }
    }
  }
  function separar(list, r, dt) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], c = list[j], dx = c.u - a.u, dy = c.v - a.v, d = Math.hypot(dx, dy) || 0.01;
      if (d >= r) continue;
      const push = ((r - d) / 2) * Math.min(1, dt * 8);
      if (!a.st.fija) { a.u -= (dx / d) * push; a.v -= (dy / d) * push; }
      if (!c.st.fija) { c.u += (dx / d) * push; c.v += (dy / d) * push; }
    }
    for (const f of list) { f.u = U.clamp(f.u, 0.5, LU - 0.5); f.v = U.clamp(f.v, 0.6, LV - 0.4); }
  }

  // ---------- Jefes de mazmorra (H3 del plan, Anexo A2) ----------
  // Uno por tipo de mazmorra, en el último piso de cada bloque de 5 (incursion.js). Cada uno tiene una mecánica
  // que se gana con la orden o la tropa correcta (B.CONSEJO_JEFE) y se pierde ignorándola. escala: tamaño del dibujo.
  const JEFE = {
    cave: { id: 'corazon', nombre: 'Corazón de Cristal', kind: 'golem', hp: 2.8, dps: 1, alcance: 1.4, vel: 0.6, spr: 'golem', escala: 2, jefe: true },
    lair: { id: 'matriarca', nombre: 'Matriarca Colmillo', kind: 'beast', hp: 1.05, dps: 0.95, alcance: 1.1, vel: 2.2, spr: 'lobo', escala: 1.9, jefe: true },
    crypt: { id: 'liche', nombre: 'El Liche Sin Nombre', kind: 'undead', hp: 1.3, dps: 0.85, alcance: 5, vel: 0.9, dispara: 'sombra', spr: 'liche', escala: 1.6, jefe: true },
    crater: { id: 'heraldo', nombre: 'Heraldo Estelar', kind: 'golem', hp: 1.7, dps: 0.8, alcance: 4.5, vel: 0.8, dispara: 'luz', spr: 'golem', escala: 1.8, jefe: true, tinte: [255, 190, 90] },
    nest: { id: 'ignivor', nombre: 'Ignivor el Antiguo', kind: 'dragon', hp: 1.25, dps: 0.6, alcance: 5, vel: 1.2, fuego: 1.9, spr: 'dragon', escala: 1.3, jefe: true },
    swamp: { id: 'morgana', nombre: 'Morgana del Pantano', kind: 'arcane', hp: 1.2, dps: 0.85, alcance: 4.5, vel: 1, dispara: 'sombra', maldice: true, spr: 'bruja', escala: 1.7, jefe: true },
    giants: { id: 'ymrok', nombre: 'Ymrok, Rey de los Gigantes', kind: 'giant', hp: 1.5, dps: 0.7, alcance: 1.7, vel: 0.6, aplasta: 1.3, spr: 'gigante', escala: 2.6, jefe: true },
    // jefes de la campaña (H5, campana.js): no son de una mazmorra
    valdes: { id: 'valdes', nombre: 'Tuerto Valdés', kind: 'bandit', hp: 1.1, dps: 0.9, alcance: 1, vel: 1.6, spr: 'bandido', escala: 1.5, jefe: true },
    reybandido: { id: 'reybandido', nombre: 'El Rey Bandido', kind: 'bandit', hp: 1.2, dps: 0.85, alcance: 1, vel: 1.5, spr: 'rey', escala: 1.7, jefe: true },
    brunilda: { id: 'brunilda', nombre: 'La reina Brunilda', kind: 'bandit', hp: 1.3, dps: 0.85, alcance: 1.1, vel: 1.3, spr: 'reina', escala: 1.7, jefe: true },
    cria: { id: 'cria', nombre: 'Cría de dragón', kind: 'dragon', hp: 1.1, dps: 0.6, alcance: 4.5, vel: 1.3, fuego: 1.5, spr: 'dragon', escala: 0.85, jefe: true },
    temple: { id: 'voz', nombre: 'La Voz del Abismo', kind: 'abyss', hp: 0.85, dps: 0.6, alcance: 5, vel: 0.9, dispara: 'luz', spr: 'sirena', escala: 1.9, jefe: true },
  };
  B.JEFE = JEFE;
  // lo que necesitan los jefes del mar (armada.js) para moverse como los de aquí
  B.H = { figura: (...a) => figura(...a), herir: (...a) => herir(...a), grito: (...a) => grito(...a), fxJefe: (...a) => fxJefe(...a), cerca, LU, LV, HPK, DPSK };
  B.CONSEJO_JEFE = {
    cave: 'Corazón de Cristal: «Al jefe» con caballeros y catapultas, y «Dispersarse» antes de que se parta (a media vida).',
    lair: 'Matriarca Colmillo: llama lobos cada 20 s mientras viva. «Cargar» y «Al jefe» para callarla rápido.',
    crypt: 'El Liche levanta a sus muertos si no quedan clérigos: llévalos y cuídalos.',
    crater: 'Heraldo Estelar: cuando marque el suelo, «Dispersarse» antes de que caigan los meteoros.',
    nest: 'Ignivor: en el aire solo le pegan arqueros y lanceros en línea. «Dispersarse» contra su fuego.',
    swamp: 'Morgana maldice a todos cada 10 s y llama fuegos fatuos: «Cargar», «Al jefe» y clérigos para acortar la maldición.',
    giants: 'Ymrok: cuando levante el mazo, «Dispersarse». Catapultas y arqueros le pegan sin acercarse.',
    valdes: 'Tuerto Valdés silba y llegan más bandidos cada 16 s: «Al jefe» con caballeros para callarlo pronto.',
    reybandido: 'El Rey Bandido arenga a los suyos (pegan más fuerte unos segundos): «Mantener línea» mientras grita y «Al jefe» después.',
    brunilda: 'Brunilda alza el escudo y casi no le entra nada: mientras lo tenga, pega a su guardia; cuando lo baje, «Al jefe».',
    cria: 'La cría escupe fuego como su madre: «Dispersarse», y arqueros y lanceros.',
    temple: 'La Voz del Abismo encanta a tus soldados de cuerpo a cuerpo: lleva clérigos y «Cargar» contra su escolta; ir directo a ella cuesta caro.',
  };
  const hayClerigo = (b, mios) => mios.some(f => f.tipo === 'cleric') || !!(b.heroe && b.heroe.clase === 'clerigo');
  function jefePaso(b, mios, suyos, dt) {
    const J = b.jefeF, t = b.jefeT, id = J.st.id;
    if (!mios.length) return;
    t.a -= dt; t.b -= dt; t.c -= dt;
    if (B.ext.jefePaso[id]) { B.ext.jefePaso[id](b, J, t, mios, suyos, dt); return; }
    if (id === 'corazon') {
      // con media vida se parte en tres gólems
      if (!J.muerto && !b.partido && J.hp < J.max * 0.5) {
        b.partido = true;
        J.hp = 0; J.muerto = 0.001; J.caida = 1;
        // la onda al partirse golpea a los que estén cerca («Dispersarse» la reduce)
        for (const f of mios) if (cerca(f, J) < 2.6) herir(b, f, J.pow * DPSK * 4 * (b.orden === 'dispersar' ? 0.4 : 1), null);
        for (let i = 0; i < 3; i++) { const g = figura('e', 'golem', ENEMIGOS.golem[0], J.pow * 0.22, 0, J.u + (i - 1) * 0.6, 0, 'golem'); g.v = U.clamp(J.v + (i - 1) * 1.8, 1, LV - 1); g.parte = true; b.suyos.push(g); }
        grito(b, '¡Se parte en tres!'); fxJefe(b, 'parte', J);
      }
      // cristales en el suelo que explotan si alguien se queda encima
      if (t.a <= 0) { t.a = 7; for (let i = 0; i < 2; i++) { const o = U.pick(mios); b.peligros.push({ u: o.u, v: o.v, r: 1.2, t: 2.5, dur: 2.5, dmg: J.pow * DPSK * 3.2, tipo: 'cristal' }); } }
    } else if (id === 'matriarca' && !J.muerto) {
      if (t.c <= 0) { // aúlla y llama tres lobos que van por los tiradores
        t.c = 20;
        for (let i = 0; i < 3; i++) { const w = figura('e', 'lobo', ENEMIGOS.beast[0], J.pow * 0.06, 0, J.u + 0.8, 0, 'beast'); w.v = U.clamp(J.v + (i - 1) * 2, 1, LV - 1); b.suyos.push(w); }
        grito(b, '¡Aúlla la Matriarca!'); fxJefe(b, 'aullido', J);
      }
    } else if (id === 'liche' && !J.muerto) {
      if (t.c <= 0) { // levanta a sus esqueletos caídos si no hay clérigos
        t.c = 9;
        if (!hayClerigo(b, mios)) {
          const caidos = b.suyos.filter(f => f.muerto && f.st.spr === 'esqueleto').slice(0, 2);
          for (const f of caidos) { f.muerto = 0; f.hp = f.max * 0.5; f.modo = 'idle'; fxJefe(b, 'revive', f); }
          if (caidos.length) grito(b, '¡El Liche levanta a sus muertos!');
        }
      }
    } else if (id === 'heraldo' && !J.muerto) {
      if (t.c <= 0) { // marca el suelo: 3 s después caen meteoros
        t.c = 9;
        for (const o of mios.slice().sort(() => Math.random() - 0.5).slice(0, 3)) b.peligros.push({ u: o.u, v: o.v, r: 1.4, t: 3, dur: 3, dmg: J.pow * DPSK * 1.5, tipo: 'meteoro' });
        grito(b, '¡El cielo se abre!');
      }
    } else if (id === 'valdes' && !J.muerto) {
      if (t.c <= 0) { // silba: llegan tres bandidos más
        t.c = 16;
        for (let i = 0; i < 3; i++) { const w = figura('e', 'forajido', ENEMIGOS.bandit[0], J.pow * 0.07, 0, LU - 1, 0, 'bandit'); w.v = U.clamp(J.v + (i - 1) * 2, 1, LV - 1); b.suyos.push(w); }
        grito(b, '¡Valdés llama a su banda!'); fxJefe(b, 'aullido', J);
      }
    } else if (id === 'reybandido' && !J.muerto) {
      if (t.c <= 0) { t.c = 12; b.arenga = 5; grito(b, '¡El Rey arenga a los suyos!'); fxJefe(b, 'aullido', J); }
    } else if (id === 'brunilda' && !J.muerto) {
      if (t.c <= 0) { b.escudo = !b.escudo; t.c = b.escudo ? 5 : 9; grito(b, b.escudo ? '¡Brunilda alza el escudo!' : 'Brunilda baja el escudo.'); }
    } else if (id === 'morgana' && !J.muerto) {
      if (t.a <= 0) { // maldición a todos: más corta si hay clérigos
        t.a = 10;
        const d = hayClerigo(b, mios) ? 2 : 4;
        for (const f of mios) f.lento = Math.max(f.lento || 0, d);
        grito(b, '¡Morgana los maldice!'); fxJefe(b, 'maldicion', J);
      }
      if (t.c <= 0) { // fuegos fatuos que van por los de atrás
        t.c = 15;
        for (let i = 0; i < 3; i++) { const w = figura('e', 'fatuo', ENEMIGOS.arcane[1], J.pow * 0.05, 0, J.u + 0.8, 0, 'arcane'); w.v = U.clamp(J.v + (i - 1) * 2, 1, LV - 1); b.suyos.push(w); }
      }
    } else if (id === 'ymrok' && !J.muerto) {
      if (t.c <= 0) { // levanta el mazo: 2 s después aplasta un círculo grande donde están los tuyos
        t.c = 8;
        const o = mios.slice().sort((a, c) => cerca(a, J) - cerca(c, J))[0];
        b.peligros.push({ u: o.u, v: o.v, r: 2.3, t: 2, dur: 2, dmg: J.pow * DPSK * 1.6, tipo: 'mazo' });
        grito(b, '¡Ymrok levanta el mazo!');
      }
    } else if (id === 'voz' && !J.muerto) {
      if (t.c <= 0) { // canto: tus soldados de cuerpo a cuerpo se quedan quietos (con clérigos, casi nada)
        t.c = 13;
        const cl = hayClerigo(b, mios);
        for (const f of mios.filter(o => !o.st.dispara).sort(() => Math.random() - 0.5).slice(0, cl ? 2 : 5)) f.encantado = cl ? 0.6 : 4.5;
        grito(b, '¡Canta la Voz del Abismo!'); fxJefe(b, 'canto', J);
      }
      if (t.a <= 0) { // tentáculos que salen junto a tus tiradores
        t.a = 12;
        for (const o of mios.filter(f => f.st.dispara).slice(0, 2)) { const w = figura('e', 'tentaculo', ENEMIGOS.abyss[0], J.pow * 0.045, 0, o.u + 1, 0, 'abyss'); w.v = o.v; b.suyos.push(w); }
      }
    } else if (id === 'ignivor' && !J.muerto) {
      // 9 s en el aire cada 22 s
      if (t.c <= 0) { b.vuela = !b.vuela; t.c = b.vuela ? 9 : 13; grito(b, b.vuela ? '¡Ignivor alza el vuelo!' : '¡Ignivor baja a tierra!'); }
    }
  }
  // círculos en el suelo: al terminar la cuenta, dañan a los tuyos que estén adentro («Dispersarse» reduce el golpe)
  function peligros(b, dt) {
    for (const p of b.peligros.slice()) {
      p.t -= dt;
      if (p.t > 0) continue;
      b.peligros.splice(b.peligros.indexOf(p), 1);
      for (const f of b.mios) if (!f.muerto && cerca(f, p) < p.r) herir(b, f, p.dmg * (b.orden === 'dispersar' ? 0.45 : 1) * (1 - cerca(f, p) / (p.r * 1.6)), null);
      fxJefe(b, p.tipo, p);
    }
  }
  function fxJefe(b, tipo, o) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(o.u, o.v);
    if (tipo === 'parte' || tipo === 'cristal') {
      sacudir(v, tipo === 'parte' ? 8 : 4); sfx('boom');
      for (let i = 0; i < (tipo === 'parte' ? 40 : 18); i++) { const a = rnd(0, 6.3), sp = rnd(50, 160); part(v, { x, y: y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, life: rnd(0.4, 0.9), size: rnd(1, 3) | 0, col: Math.random() < 0.6 ? [122, 240, 255] : [200, 250, 255], add: true }); }
      luzTemp(v, x, y - 6, 60, [120, 230, 255], 0.5); marca(v, x, y, 'rocas');
    } else if (tipo === 'meteoro') {
      sacudir(v, 6); v.flash = Math.max(v.flash, 0.15); sfx('boom');
      for (let i = 0; i < 30; i++) { const a = rnd(Math.PI, Math.PI * 2), sp = rnd(60, 180); part(v, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rnd(0.4, 0.9), size: rnd(1, 3) | 0, col: Math.random() < 0.5 ? [255, 200, 90] : [255, 120, 50], add: true }); }
      luzTemp(v, x, y, 80, [255, 170, 80], 0.6); marca(v, x, y, 'quemado');
    } else if (tipo === 'mazo') {
      sacudir(v, 9); v.flash = Math.max(v.flash, 0.1); sfx('boom');
      for (let i = 0; i < 26; i++) { const a = rnd(Math.PI, Math.PI * 2), sp = rnd(50, 150); part(v, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, life: rnd(0.4, 0.9), size: rnd(2, 4) | 0, col: Math.random() < 0.6 ? [120, 104, 86] : [170, 160, 140] }); }
      marca(v, x, y, 'rocas');
    } else if (tipo === 'maldicion' || tipo === 'canto') {
      const col = tipo === 'canto' ? [90, 230, 220] : [150, 255, 110];
      for (let k = 0; k < 3; k++) v.anillos.push({ x, y: y - 10, t: -k * 0.2, dur: 1, col, r: 50 + k * 16 });
      luzTemp(v, x, y - 10, 70, col, 0.6); sfx('cuerno');
    } else if (tipo === 'aullido') {
      for (let k = 0; k < 3; k++) v.anillos.push({ x, y: y - 10, t: -k * 0.15, dur: 0.8, col: [255, 120, 100], r: 30 + k * 10 });
      sacudir(v, 3); sfx('cuerno');
    } else if (tipo === 'revive') {
      v.rayos.push({ x0: x, y0: y - 30, x1: x, y1: y, t: 0, dur: 0.6, col: [120, 255, 140] });
      for (let i = 0; i < 12; i++) part(v, { x: x + rnd(-6, 6), y: y - rnd(0, 10), vy: rnd(-40, -15), life: rnd(0.6, 1), size: 2, col: [130, 255, 150], add: true });
      luzTemp(v, x, y - 8, 40, [120, 255, 140], 0.6);
    }
  }

  // ---------- El héroe (C2 del plan) ----------
  // Va detrás de la primera línea, no recibe golpes y no cuenta en la vida de la compañía: su fuerza ya está en
  // la de las tropas (Exp.heroMult). Lo que agrega es su habilidad, con recarga. Si nadie la pide, se usa sola
  // con una regla simple, así que la batalla da lo mismo mirándola o no (B.adelantar).
  function armarHeroe(b, h) {
    if (!h) return;
    const c = PK.Heroes.CLASES[h.clase], H = PK.Heroes;
    b.heroeId = h.id;
    b.heroe = { id: h.id, nombre: h.nombre, clase: h.clase, hab: c.hab, cd: 4, cdMax: c.hab.cd * (1 - H.efecto(h, 'cd')), pot: 1 + H.efecto(h, 'pot'), auto: true, pedir: false, usos: 0,
      fig: { lado: 'p', tipo: 'heroe', st: { spr: 'heroe', hp: 1 }, look: c.look, col: c.col, pow: 0, rep: 1, hp: 1, max: 1, dps: 0, u: 1.5, v: LV / 2, u0: 1.5, cd: 0, anim: 0, flip: false, modo: 'idle', muerto: 0, golpe: 0, objetivo: null } };
    b.muro = 0; b.cancion = 0;
  }
  function heroePaso(b, mios, suyos, dt) {
    const h = b.heroe, f = h.fig;
    h.cd = Math.max(0, h.cd - dt); b.muro = Math.max(0, b.muro - dt); b.cancion = Math.max(0, b.cancion - dt);
    if (b.corrientes > 0 && (b.corrientes -= dt) <= 0 && b.vientoAntes !== undefined) { b.viento = b.vientoAntes; b.vientoAntes = undefined; if (vista && vista.b === b) pintarControles(); } // vuelve el viento de antes
    f.anim += dt;
    // se para un par de pasos detrás del más adelantado de los suyos
    // C1: el flanco elegido (izquierda, centro o derecha): sigue al más adelantado de esa franja
    let front = null;
    const enFranja = o => b.flanco === 'i' ? o.v < LV * 0.4 : b.flanco === 'd' ? o.v > LV * 0.6 : true;
    for (const o of mios) if (enFranja(o) && (!front || o.u > front.u)) front = o;
    if (!front) for (const o of mios) if (!front || o.u > front.u) front = o;
    const tu = front ? U.clamp(front.u - 2.2, 0.8, LU - 3) : f.u, tv = front ? U.clamp(front.v, 1, LV - 1) : f.v, d = Math.hypot(tu - f.u, tv - f.v);
    if (d > 0.4) { const sp = Math.min(d, 1.8 * dt); f.u += ((tu - f.u) / d) * sp; f.v += ((tv - f.v) / d) * sp; f.modo = 'walk'; } else f.modo = f.lanza > 0 ? 'work' : 'idle';
    f.lanza = Math.max(0, (f.lanza || 0) - dt);
    if (h.cd > 0 || !suyos.length || !mios.length) { h.pedir = false; return; }
    if (h.pedir || (h.auto && conviene(b, h, mios, suyos))) lanzar(b, h, mios, suyos);
    h.pedir = false;
  }
  // el grupo de enemigos más apretado (para la lluvia de flechas)
  function racimo(suyos, r) {
    let mejor = null, n = 0;
    for (const o of suyos) { const k = suyos.filter(x => cerca(x, o) < r).length; if (k > n) { n = k; mejor = o; } }
    return [mejor, n];
  }
  function conviene(b, h, mios, suyos) {
    const id = h.hab.id;
    if (id === 'muro') return suyos.filter(o => mios.some(m => cerca(m, o) < 1.6)).length >= 3 || vida(mios) < b.fuerza0[0] * 0.7;
    if (id === 'lluvia') return racimo(suyos, 3.2)[1] >= Math.min(3, suyos.length) || b.t > 12;
    if (id === 'plegaria') { const mx = mios.reduce((s, o) => s + o.max, 0); return mx && 1 - vida(mios) / mx >= 0.3; }
    if (id === 'bombarda') return suyos.some(o => cerca(o, h.fig) < 10);
    if (id === 'rayo') return suyos.length >= 3 || b.t > 10;
    if (id === 'cancion') return suyos.some(o => mios.some(m => cerca(m, o) < 2));
    if (id === 'corrientes') return b.viento < 0 || suyos.some(o => mios.some(m => cerca(m, o) < 2.5));
    return false;
  }
  function lanzar(b, h, mios, suyos) {
    if (PK.Game.stat) PK.Game.stat('habilidades', 1); // retos del Pase del Reino
    const id = h.hab.id, base = mios.reduce((s, o) => s + o.dps, 0) * h.pot, blancos = [];
    if (id === 'muro') b.muro = (h.hab.dur || 8) * (0.5 + 0.5 * h.pot);
    else if (id === 'cancion') b.cancion = (h.hab.dur || 10) * (0.5 + 0.5 * h.pot);
    else if (id === 'corrientes') { b.corrientes = (h.hab.dur || 12) * (0.5 + 0.5 * h.pot); b.vientoAntes = b.vientoAntes === undefined ? b.viento : b.vientoAntes; b.viento = b.viento ? 1 : 0; grito(b, '¡Viento a favor!'); if (vista && vista.b === b) pintarControles(); } // la Corsaria (pk-30)
    else if (id === 'plegaria') for (const a of mios) { a.hp = Math.min(a.max, a.hp + a.max * 0.3 * h.pot); blancos.push(a); }
    else if (id === 'lluvia') {
      const [c] = racimo(suyos, 3.2);
      if (c) { blancos.push(c); for (const o of suyos) { const d = cerca(o, c); if (d < 3.2) herir(b, o, base * 1.6 * (1 - d / 5), null); } }
    } else if (id === 'bombarda') {
      const o = suyos.reduce((m, x) => (x.hp > m.hp ? x : m), suyos[0]);
      blancos.push(o); herir(b, o, base * 4 * (o.kind === 'golem' || o.kind === 'giant' ? 3 : 1), null);
    } else if (id === 'rayo') {
      let o = suyos.reduce((m, x) => (cerca(x, h.fig) < cerca(m, h.fig) ? x : m), suyos[0]);
      const tocados = new Set();
      for (let i = 0; i < 5 && o; i++) {
        tocados.add(o); blancos.push(o); herir(b, o, base * 1.3 * Math.pow(0.85, i), null);
        let sig = null;
        for (const x of suyos) if (!tocados.has(x) && !x.muerto && (!sig || cerca(x, o) < cerca(sig, o))) sig = x;
        o = sig;
      }
    }
    h.cd = h.cdMax;
    h.usos++;
    h.fig.lanza = 0.5;
    fxHab(b, h, blancos, mios);
  }
  function fxHab(b, h, blancos, mios) {
    const v = fxDe(b); if (!v) return;
    v.banner = { txt: h.hab.name + '!', sub: h.nombre, t: 0, dur: 1.4, chico: true };
    const [hx, hy] = aPx(h.fig.u, h.fig.v), id = h.hab.id;
    luzTemp(v, hx, hy - 12, 50, [255, 230, 140], 0.5);
    sfx('magia');
    if (id === 'muro' || id === 'cancion') for (const a of mios) {
      const [x, y] = aPx(a.u, a.v);
      v.anillos.push({ x, y: y - 6, t: 0, dur: 0.7, col: id === 'muro' ? [120, 180, 255] : [255, 210, 90], r: 14 });
      for (let i = 0; i < 4; i++) part(v, { x: x + rnd(-6, 6), y: y - rnd(6, 16), vy: rnd(-30, -10), life: rnd(0.6, 1), size: 2, col: id === 'muro' ? [150, 200, 255] : [255, 220, 110], add: true });
    } else if (id === 'plegaria') for (const a of blancos) {
      const [x, y] = aPx(a.u, a.v);
      for (let i = 0; i < 6; i++) part(v, { x: x + rnd(-6, 6), y: y - rnd(2, 14), vy: rnd(-30, -12), life: rnd(0.7, 1.1), size: 1, col: [150, 255, 170], add: true, cruz: Math.random() < 0.5 });
      v.anillos.push({ x, y, t: 0, dur: 0.6, col: [140, 255, 170], r: 12 });
    } else if (id === 'lluvia' && blancos[0]) {
      const [x, y] = aPx(blancos[0].u, blancos[0].v);
      for (let i = 0; i < 40; i++) part(v, { x: x + rnd(-36, 36), y: y - rnd(40, 90), vx: rnd(-10, 10), vy: rnd(160, 240), life: rnd(0.25, 0.45), size: 1, col: [232, 220, 192], linea: true });
      v.anillos.push({ x, y, t: 0, dur: 0.6, col: [255, 230, 170], r: 40, suelo: true });
      sacudir(v, 2); sfx('arrow');
    } else if (id === 'bombarda' && blancos[0]) {
      const [x, y] = aPx(blancos[0].u, blancos[0].v);
      sacudir(v, 7); v.flash = Math.max(v.flash, 0.2); sfx('boom');
      for (let i = 0; i < 30; i++) { const a = rnd(0, 6.3), sp = rnd(50, 170); part(v, { x, y: y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 200, drag: 1, life: rnd(0.4, 0.9), size: rnd(1, 3) | 0, col: Math.random() < 0.5 ? [255, 200, 80] : [255, 120, 40], add: true }); }
      luzTemp(v, x, y - 8, 90, [255, 170, 80], 0.6); marca(v, x, y, 'quemado');
    } else if (id === 'rayo') {
      let [px, py] = [hx, hy - 16];
      for (const o of blancos) { const [x, y] = aPx(o.u, o.v); v.rayos.push({ x0: px, y0: py, x1: x, y1: y - 10, t: 0, dur: 0.45, col: [190, 160, 255] }); luzTemp(v, x, y - 10, 36, [170, 130, 255], 0.4); px = x; py = y - 10; }
    }
  }

  // ---------- Final ----------
  // Bajas: las figuras que cayeron (todos sus soldados) y parte de los heridos. Retirarse salva a los que quedan.
  function bajas(b, retirada) {
    const lost = {}, hb = b.heroeId ? 1 - PK.Exp.heroBajas({ heroe: b.heroeId }) : 1;
    for (const f of b.mios) {
      if (!D.ARMY[f.tipo]) continue; // las baterías del asalto pirata no son tropas
      let n = Math.round((f.muerto ? f.rep : f.rep * (1 - f.hp / f.max) * (retirada ? 0.2 : 0.3)) * hb);
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
    if (r && b.heroe) r.habUsos = b.heroe.usos;
    if (r) PK.Exp.finishBattle(r, { won: gano, lost: b.fin.lost, live: true, retreat: !!retirada, dano: b.dano });
    if (vista && vista.b === b) pintarControles();
    // si nadie la mira, se borra enseguida; si la están mirando, queda el cartel hasta que la cierren
    if (!vista || vista.b !== b) B.lista.splice(B.lista.indexOf(b), 1);
  }
  B.retirada = function (id) { const b = B.de(id); if (b && !b.fin) { grito(b, '¡Retirada!'); terminar(b, false, true); } };
  const GRITOS = { cargar: '¡A la carga!', linea: '¡Mantengan la línea!', dispersar: '¡Dispérsense!' };
  B.ordenar = function (id, orden) { const b = B.de(id); if (b && B.ORDENES[orden]) { if (b.orden !== orden) grito(b, GRITOS[orden]); b.orden = orden; } };
  B.enfocar = function (id, kind) { const b = B.de(id); if (b) { b.foco = b.foco === kind ? null : kind; if (b.foco) grito(b, '¡A por ' + (A_POR[kind] || (kind.indexOf('rol:') === 0 ? 'el ' + B.ROLES[kind.slice(4)].nombre : 'ellos')) + '!'); } };
  B.pausar = function (id) { const b = B.de(id); if (b && !b.fin) b.pausa = !b.pausa; };
  // incursión que sigue: el botón para elegir la próxima sala desde el cartel del final
  function siguienteSala(b) {
    const r = S().exp.runs.find(o => o.id === b.id);
    return r && r.inc && r.phase === 'sala' ? PK.UI.btn('Siguiente sala →', () => { B.cerrar(); PK.Inc.open(r.id); }, { cls: 'gold' }) : null;
  }
  B.habilidad = function (id) { const b = B.de(id); if (b && b.heroe && !b.fin) b.heroe.pedir = true; };
  B.autoHab = function (id, on) { const b = B.de(id); if (b && b.heroe) b.heroe.auto = !!on; };
  const A_POR = { jefe: 'el jefe', beast: 'las bestias', bandit: 'los bandidos', undead: 'los no-muertos', golem: 'los gólems', dragon: 'el dragón', arcane: 'las brujas', giant: 'los gigantes', abyss: 'los abisales' };

  // ---------- Efectos (solo dibujo) ----------
  // Lo que se ve de cada golpe, disparo y caída: chispas, zarpazos, polvo, lascas de roca, llamas, marcas en el
  // suelo, luces que iluminan la cueva, sacudidas de cámara, gritos de orden y fuegos artificiales al ganar.
  // Viven en la vista (no en la batalla): sin nadie mirando, no se crean, y la pelea da lo mismo.
  const FX_MAX = 900;
  const fxDe = b => (vista && vista.b === b ? vista : null);
  function part(v, p) { if (v.fx.length < FX_MAX) v.fx.push(Object.assign({ t: 0, vx: 0, vy: 0, g: 0, life: 0.6, size: 2, crece: 0, a: 1, add: false, drag: 0 }, p)); }
  function sacudir(v, k) { if (PK.menosMov) return; v.shake = Math.min(9, Math.max(v.shake, k)); } // U6: «menos movimiento»
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
  // el fogonazo de una andanada (pk-29): humo blanco al costado del barco que dispara
  function fxCanon(b, f, o) {
    const v = fxDe(b); if (!v) return;
    const [x, y] = aPx(f.u, f.v), [tx] = aPx(o.u, o.v), lado = tx > x ? 1 : -1;
    for (let i = 0; i < 6; i++) part(v, { x: x + lado * rnd(4, 9), y: y - rnd(6, 11), vx: lado * rnd(10, 30), vy: rnd(-10, 2), drag: 1.5, life: rnd(0.7, 1.2), size: 2, crece: 7, a: 0.5, col: [236, 236, 240] });
    part(v, { x: x + lado * 6, y: y - 9, life: 0.1, size: 3, col: [255, 220, 120], add: true });
    luzTemp(v, x + lado * 6, y - 9, 22, [255, 200, 110], 0.12);
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
    } else if (p.tipo === 'arcano') { // la bola del mago: estalla en un anillo violeta
      sacudir(v, 2);
      for (let i = 0; i < 14; i++) { const a = rnd(0, 6.3), sp = rnd(40, 110); part(v, { x, y: y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, drag: 3, life: rnd(0.3, 0.7), size: rnd(1, 3) | 0, col: Math.random() < 0.5 ? [190, 120, 255] : [120, 220, 255], add: true }); }
      v.anillos.push({ x, y, t: 0, dur: 0.45, col: [200, 140, 255], r: 22, suelo: true });
      luzTemp(v, x, y - 6, 44, [180, 120, 255], 0.4);
      marca(v, x, y, 'quemado');
    } else if (p.tipo === 'sombra') {
      for (let i = 0; i < 10; i++) { const a = rnd(0, 6.3), sp = rnd(20, 70); part(v, { x, y: y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, drag: 2, life: rnd(0.4, 0.8), size: 2, col: Math.random() < 0.5 ? [150, 90, 220] : [60, 20, 90], add: Math.random() < 0.5 }); }
      luzTemp(v, x, y - 8, 30, [170, 90, 255], 0.4);
    } else if (p.tipo === 'bala') { // astillas del casco y un chorro de agua
      sacudir(v, 1.5);
      for (let i = 0; i < 8; i++) part(v, { x, y: y - 8, vx: rnd(-60, 60), vy: rnd(-90, -30), g: 300, life: rnd(0.3, 0.6), size: 1, col: Math.random() < 0.5 ? [140, 100, 60] : [220, 236, 250] });
      for (let i = 0; i < 6; i++) part(v, { x: x + rnd(-4, 4), y: y - 2, vx: rnd(-14, 14), vy: rnd(-50, -20), g: 160, life: rnd(0.4, 0.7), size: 2, col: [210, 232, 250], a: 0.8 });
      luzTemp(v, x, y - 6, 26, [255, 190, 110], 0.2);
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
  B.vistaActual = () => (vista ? vista.b : null); // la música mira si hay jefe
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
    onKey = e => { if (e.key === 'Escape') B.cerrar(); else if (e.key === ' ' && vista && !vista.b.fin) { e.preventDefault(); B.pausar(vista.b.id); pintarControles(); } };
    window.addEventListener('keydown', onKey);
    // se dibuja una vez por cuadro (la simulación corre en G.update, aunque nadie mire)
    const bucle = () => { if (!vista) return; try { dibujar(); } catch (e) { console.error(e); } requestAnimationFrame(bucle); };
    requestAnimationFrame(bucle);
  };
  let onKey = null;
  B.cerrar = function () {
    if (!vista) return;
    const b = vista.b;
    b.pausa = false; // sin nadie mirando, una pausa la dejaría quieta para siempre
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
        el('div', { class: 'row' }, siguienteSala(b), btn('Volver al reino', () => B.cerrar(), { cls: siguienteSala(b) ? '' : 'gold' }))));
      return;
    }
    const kinds = Object.keys(b.enemigo);
    const ord = el('div', { class: 'bt-ord', role: 'group', 'aria-label': 'Órdenes' }, Object.keys(B.ORDENES).map(k => btn(B.ORDENES[k].nombre, () => { B.ordenar(b.id, k); pintarControles(); }, { small: true, cls: b.orden === k ? 'gold' : '', title: B.ORDENES[k].desc })));
    // C4: los enemigos con rol que siguen en pie también se pueden enfocar
    const conRol = b.suyos.filter(f => f.rol && !f.muerto);
    const foco = kinds.length > 1 || b.jefeF || conRol.length ? el('div', { class: 'bt-ord', role: 'group', 'aria-label': 'Atacar primero' }, el('span', { class: 'small' }, 'Atacar primero: '),
      b.jefeF ? btn('Al jefe', () => { B.enfocar(b.id, 'jefe'); pintarControles(); }, { small: true, cls: b.foco === 'jefe' ? 'gold' : '', title: 'Todos contra ' + b.jefeF.st.nombre }) : '',
      kinds.length > 1 ? kinds.map(k => btn(D.ENEMY[k].name, () => { B.enfocar(b.id, k); pintarControles(); }, { small: true, cls: b.foco === k ? 'gold' : '', title: D.ENEMY[k].desc })) : '',
      [...new Set(conRol.map(f => f.rol))].map(id => btn(el('span', null, el('i', { class: 'bt-rol', style: { background: B.ROLES[id].col } }), (id === 'elite' ? 'A la ' : 'Al ') + B.ROLES[id].nombre), () => { B.enfocar(b.id, 'rol:' + id); pintarControles(); }, { small: true, cls: b.foco === 'rol:' + id ? 'gold' : '', title: nombreDe(conRol.find(f => f.rol === id)) + ': ' + B.ROLES[id].desc }))) : '';
    const jf = b.jefeF && Object.keys(JEFE).find(k => JEFE[k] === b.jefeF.st);
    const consejo = el('p', { class: 'small bt-tip' }, jf ? B.CONSEJO_JEFE[jf] : kinds.map(k => B.CONSEJO[k] || D.ENEMY[k].desc).join(' '),
      conRol.length ? ' ' + [...new Set(conRol.map(f => f.rol))].map(id => B.CONSEJO_ROL[id]).join(' ') : '',
      b.obst && b.obst.tipos.length ? ' ' + b.obst.tipos.map(t => B.OBST_TXT[t]).join(' ') : '',
      b.viento ? el('b', { class: b.viento > 0 ? 'good-t' : 'warn-t' }, ' ' + (b.viento > 0 ? '⛵ Viento a favor: tus barcos navegan y disparan mejor.' : '⛵ Viento en contra: los suyos navegan y disparan mejor.')) : '');
    // el héroe: su retrato, la habilidad con la recarga a la vista (un toque) y «sola» para que la use él
    let heroeRow = '';
    v.habBtn = null;
    if (b.heroe && PK.Heroes) {
      const hh = PK.Heroes.de(b.heroe.id), hb = b.heroe;
      v.habBtn = btn(hb.hab.name, () => { B.habilidad(b.id); }, { small: true, cls: 'gold', title: hb.hab.desc });
      heroeRow = el('div', { class: 'bt-heroe' }, hh ? PK.Heroes.retratoEl(hh) : '', el('b', { translate: 'no' }, hb.nombre), v.habBtn,
        el('label', { class: 'chk small' }, el('input', { type: 'checkbox', checked: hb.auto, onchange: e => B.autoHab(b.id, e.target.checked) }), ' sola'));
      v.habKey = '';
    }
    v.ctl.append(heroeRow, ord, foco, consejo,
      el('div', { class: 'row' }, btn(b.pausa ? '▶ Seguir' : '❚❚ Pausa', () => { B.pausar(b.id); pintarControles(); }, { small: true, cls: b.pausa ? 'gold' : '', title: 'Pausa táctica (barra espaciadora): las órdenes se pueden dar igual' }),
        btn('x' + (b.vel === 1 ? 2 : b.vel === 2 ? 4 : 1), () => { b.vel = b.vel === 1 ? 2 : b.vel === 2 ? 4 : 1; pintarControles(); }, { small: true, title: 'Velocidad de la batalla' }),
        btn('Retirada', () => { B.retirada(b.id); }, { small: true, cls: 'danger', title: 'Pierdes la pelea, pero se salvan más soldados' }),
        btn('Volver al reino', () => B.cerrar(), { small: true, title: 'La batalla sigue aunque no la mires' })));
  }
  function pintarArriba() {
    const v = vista, b = v.b, vm = vida(b.mios), vs = vida(b.suyos);
    if (v.habBtn && b.heroe) { // la recarga de la habilidad, sin rehacer los controles
      const cd = Math.ceil(b.heroe.cd), k = cd + '|' + !!b.fin;
      if (k !== v.habKey) { v.habKey = k; v.habBtn.textContent = b.heroe.hab.name + (cd > 0 ? ' · ' + cd + ' s' : ''); v.habBtn.disabled = cd > 0 || !!b.fin; }
    }
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
  // Gólem y oso dibujados aparte (C3): el gólem era una roca y el oso, un lobo grande. Dos cuadros, mirando a la
  // derecha, y su espejo. cr: color de los cristales (el Heraldo Estelar los tiene de fuego).
  const espejo = c => { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const x = m.getContext('2d'); x.scale(-1, 1); x.drawImage(c, -c.width, 0); return m; };
  function mkGolem(fr, C, C2) {
    const c = document.createElement('canvas'); c.width = 20; c.height = 22;
    const x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a, b2, w, h); };
    const P = '#7a7268', P2 = '#5e5850', P3 = '#9a9286', K = '#2e2a26';
    r(5, 17, 4, 5, P2); r(11, 17, 4, 5, P2); r(4, 21, 5, 1, K); r(11, 21, 5, 1, K);
    r(3, 7, 14, 11, P); r(3, 7, 14, 2, P3); r(4, 16, 12, 2, P2); r(8, 10, 1, 4, P2); r(12, 12, 2, 1, P2);
    r(7, 2, 7, 6, P); r(7, 2, 7, 1, P3); r(9, 4, 1, 1, C2); r(12, 4, 1, 1, C2);
    const ay = fr ? 6 : 9;
    r(0, ay, 4, 9, P2); r(0, ay + 8, 4, 3, P3); r(16, ay, 4, 9, P2); r(16, ay + 8, 4, 3, P3);
    r(4, 4, 2, 4, C); r(5, 3, 1, 2, C2); r(15, 3, 2, 5, C); r(16, 2, 1, 2, C2); r(10, 11, 2, 3, C); r(10, 11, 1, 1, C2);
    return c;
  }
  function mkOso(fr) {
    const c = document.createElement('canvas'); c.width = 26; c.height = 16;
    const x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a, b2, w, h); };
    const B = '#6a4426', B2 = '#4a2e18', B3 = '#8a5a34', K = '#1a100a';
    const d = fr ? 1 : 0;
    r(4 + d, 11, 3, 5, B2); r(9 - d, 11, 3, 5, B2); r(14 + d, 11, 3, 5, B2); r(18 - d, 11, 3, 5, B2);
    r(3, 4, 18, 8, B); r(3, 4, 18, 2, B3); r(2, 6, 2, 4, B); r(5, 10, 14, 2, B2);
    r(19, 3, 6, 6, B); r(19, 3, 6, 1, B3); r(23, 6, 3, 2, B3); r(25, 6, 1, 1, K); r(22, 4, 1, 1, K); r(19, 2, 2, 1, B2); r(23, 2, 2, 1, B2);
    return c;
  }
  const spr2 = (cs, ax, ay) => [cs.map(c => ({ c, ax, ay })), cs.map(c => ({ c: espejo(c), ax: c.width - ax, ay }))];
  let GOLEM = null, GOLEM_F = null, OSO = null;
  const golemDe = fuego => (fuego ? (GOLEM_F = GOLEM_F || spr2([0, 1].map(fr => mkGolem(fr, '#ffb040', '#fff0a0')), 10, 22)) : (GOLEM = GOLEM || spr2([0, 1].map(fr => mkGolem(fr, '#7af0ff', '#c8fbff')), 10, 22)));
  const osoDe = () => (OSO = OSO || spr2([0, 1].map(mkOso), 13, 16));
  // H4: fuego fatuo (una llama verde que flota) y tentáculo (sale del suelo y se mece)
  function mkFatuo(fr) {
    const c = document.createElement('canvas'); c.width = 10; c.height = 14;
    const x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a, b2, w, h); };
    const o = fr ? 1 : 0;
    r(3, 5 + o, 4, 5, '#5aff8a'); r(2, 7 + o, 6, 3, '#5aff8a'); r(4, 2 + o, 2, 3, '#9affb8'); r(4, 6 + o, 2, 3, '#e8fff0'); r(3 + o, 1 + o, 1, 2, '#9affb8');
    r(3, 11, 1, 1, '#3aa860'); r(6, 12, 1, 1, '#3aa860');
    return c;
  }
  function mkTentaculo(fr) {
    const c = document.createElement('canvas'); c.width = 14; c.height = 22;
    const x = c.getContext('2d'), r = (a, b2, w, h, col) => { x.fillStyle = col; x.fillRect(a, b2, w, h); };
    const T = '#3a7a8a', T2 = '#24525e', V = '#c86aa8';
    r(2, 19, 10, 3, '#1a2a30');
    const pts = fr ? [[5, 17], [6, 14], [7, 11], [8, 8], [8, 5], [7, 3], [5, 2]] : [[5, 17], [5, 14], [5, 11], [6, 8], [7, 5], [9, 3], [11, 3]];
    pts.forEach(([a, b2], i) => { const w = Math.max(2, 5 - Math.floor(i / 2)); r(a - 1, b2, w, 3, T); r(a - 1, b2, 1, 3, T2); if (i % 2) r(a + w - 2, b2 + 1, 1, 1, V); });
    return c;
  }
  let FATUO = null, TENT = null;
  const fatuoDe = () => (FATUO = FATUO || spr2([0, 1].map(mkFatuo), 5, 14));
  const tentDe = () => (TENT = TENT || spr2([0, 1].map(mkTentaculo), 7, 22));
  const PALIDO = [176, 176, 164], BANDIDO = [70, 44, 40];
  function sprite(f, frame) {
    const a = f.st, modo = f.modo;
    if (B.ext.sprite && (a.barco || a.mar)) { const s2 = B.ext.sprite(f, frame); if (s2) return s2; }
    if (f.tipo === 'heroe' && D.temaActivo === 'mar' && B.ext.heroe) { const s2 = B.ext.heroe(f, frame); if (s2) return s2; }
    if (f.tipo === 'heroe') return Sp.villager(f.col, 1, 1, modo, frame, null, f.flip, modo === 'work' ? (f.look === 'archer' ? null : 'sword') : null, false, false, null, f.look);
    if (f.lado === 'p') return f.tipo === 'catapult' ? Sp.cart(COL_MIOS, 'stone', f.flip, frame % 4, modo === 'walk') : Sp.troop(f.tipo, COL_MIOS, modo, frame, f.flip, false, modo === 'work' ? TROPA[f.tipo].herr || null : null, f.rep);
    if (a.spr === 'lobo') return Sp.wolf[f.flip ? 1 : 0][frame % 2];
    if (a.spr === 'oso') return osoDe()[f.flip ? 1 : 0][Math.floor(f.anim * (modo === 'walk' ? 5 : 1)) % 2];
    if (a.spr === 'golem') return golemDe(!!a.tinte)[f.flip ? 1 : 0][Math.floor(f.anim * (modo === 'idle' ? 1 : 3)) % 2];
    if (a.spr === 'liche') return Sp.villager([96, 50, 140], 3, 0, modo === 'walk' ? 'walk' : 'idle', frame % 4, null, f.flip, null);
    if (a.spr === 'rey') return Sp.villager([150, 110, 30], 2, 1, modo, frame % 4, null, f.flip, modo === 'work' ? 'sword' : null);
    if (a.spr === 'reina') return Sp.villager([150, 40, 60], 0, 1, modo, frame % 4, null, f.flip, modo === 'work' ? 'sword' : null, false, false, null, 'knight');
    if (a.spr === 'bruja') return Sp.villager([48, 70, 40], 3, 0, modo === 'walk' ? 'walk' : 'idle', frame % 4, null, f.flip, null);
    if (a.spr === 'fatuo') return fatuoDe()[f.flip ? 1 : 0][Math.floor(f.anim * 4) % 2];
    if (a.spr === 'gigante') return Sp.villager([104, 84, 60], 2, 2, modo, frame % 4, null, f.flip, modo === 'work' ? 'hammer' : null);
    if (a.spr === 'tentaculo') return tentDe()[f.flip ? 1 : 0][Math.floor(f.anim * 2) % 2];
    if (a.spr === 'sirena') return Sp.villager([40, 130, 140], 1, 0, modo === 'walk' ? 'walk' : 'idle', frame % 4, null, f.flip, null);
    // los enemigos nunca usan el dibujo de tus tropas (se confundían los arqueros): ropa de bandido o de hueso
    if (a.spr === 'tirador') return Sp.villager(BANDIDO, 2, 1, modo, frame % 4, null, f.flip, modo === 'work' ? 'hammer' : null);
    if (a.spr === 'espectro') return Sp.villager(PALIDO, 3, 0, modo === 'walk' ? 'walk' : 'idle', frame % 4, null, f.flip, null);
    if (a.spr === 'dragon') return null;
    return Sp.villager(a.spr === 'esqueleto' ? PALIDO : BANDIDO, 1, a.spr === 'esqueleto' ? 0 : 2, modo, frame % 4, null, f.flip, modo === 'work' ? 'knife' : null);
  }
  // C1: el terreno, dibujado sobre el suelo y debajo de las figuras
  function dibujarTerreno(ctx, ob, now) {
    if (ob.loma) {
      const [x, y] = aPx(ob.loma.u, ob.loma.v), R = ob.loma.r * TILE;
      ctx.fillStyle = 'rgba(255,240,190,0.10)'; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.62, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.08)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 3, R * 0.7, R * 0.42, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.ellipse(x + 3, y + R * 0.45, R * 0.9, R * 0.2, 0, 0, 6.3); ctx.fill();
    }
    if (ob.rio) {
      const rio = ob.rio, caja = (u0, v0, u1, v1) => { const [a, c] = aPx(u0, v0), [e, f] = aPx(u1, v1); return [Math.min(a, e), Math.min(c, f), Math.abs(e - a), Math.abs(f - c)]; };
      for (const [v0, v1] of [[0, rio.v0], [rio.v1, LV]]) {
        const [x, y, w, h] = caja(rio.u0, v0, rio.u1, v1);
        ctx.fillStyle = '#2a5a78'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(160,210,240,0.35)';
        for (let i = 0; i < 8; i++) { const k = ((now / 900 + i * 0.37) % 1); ctx.fillRect(Math.round(x + (w > h ? k * w : (i % 3) * w / 3 + 2)), Math.round(y + (w > h ? (i % 3) * h / 3 + 2 : k * h)), 4, 1); }
      }
      const [x, y, w, h] = caja(rio.u0 - 0.2, rio.v0, rio.u1 + 0.2, rio.v1);
      ctx.fillStyle = '#7a5a36'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5a3e22'; if (w > h) for (let i = 0; i < w; i += 4) ctx.fillRect(x + i, y, 1, h); else for (let i = 0; i < h; i += 4) ctx.fillRect(x, y + i, w, 1);
    }
    for (const k of ob.rocas) {
      const [x, y] = aPx(k.u, k.v), R = k.r * TILE, rr = U.rng(k.s);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, R, R * 0.45, 0, 0, 6.3); ctx.fill();
      for (let i = 0; i < 5; i++) {
        const dx = (rr() - 0.5) * R, dy = (rr() - 0.7) * R * 0.6, w = R * (0.6 + rr() * 0.5), h = R * (0.5 + rr() * 0.4);
        ctx.fillStyle = i % 2 ? '#6e6a62' : '#837e74'; ctx.fillRect(Math.round(x + dx - w / 2), Math.round(y + dy - h), Math.round(w), Math.round(h));
        ctx.fillStyle = '#a19b8e'; ctx.fillRect(Math.round(x + dx - w / 2), Math.round(y + dy - h), Math.round(w), 2);
      }
    }
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
    // cámara (C3): se acerca a donde están las figuras, así con pocos grupos no se ven como puntos
    const cam = v.cam || (v.cam = { z: 1, x: esc.W / 2, y: esc.H / 2 });
    {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const f of b.mios.concat(b.suyos, b.heroe ? [b.heroe.fig] : [])) { if (f.muerto) continue; const [px, py] = aPx(f.u, f.v); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py - 30 * (f.st.escala || 1)); y1 = Math.max(y1, py); }
      if (x1 > x0) {
        const bw = x1 - x0 + 90, bh = y1 - y0 + 70, zt = U.clamp(Math.min(esc.W / bw, esc.H / bh), 1, 1.6), k = Math.min(1, dt * 1.5);
        cam.z += (zt - cam.z) * k; cam.x += ((x0 + x1) / 2 + esc.mx - cam.x) * k; cam.y += ((y0 + y1) / 2 + esc.my - cam.y) * k;
      }
      const hx = esc.W / (2 * cam.z), hy = esc.H / (2 * cam.z);
      cam.x = U.clamp(cam.x, hx, esc.W - hx); cam.y = U.clamp(cam.y, hy, esc.H - hy);
    }
    const kz = s * cam.z, ex = cv.width / 2 - cam.x * kz, ey = cv.height / 2 - cam.y * kz;
    const T = (dx, dy) => ctx.setTransform(kz, 0, 0, kz, ex + dx * kz, ey + dy * kz);
    T(ox, oy);
    ctx.drawImage(esc.c, 0, 0);
    PK.Escenarios.animar(ctx, esc, dt);
    PK.Escenarios.luz(ctx, esc);
    T(esc.mx + ox, esc.my + oy);
    // suelo: marcas y aros de impacto
    for (const m of v.marcas) { m.t += dt; dibujarMarca(ctx, m); }
    if (b.obst) dibujarTerreno(ctx, b.obst, now);
    if (v.marcas.length && v.marcas[0].t > 14) v.marcas = v.marcas.filter(m => m.t < 14);
    // círculos de los jefes: se llenan hasta que estallan (meteoros, cristales)
    for (const p of b.peligros || []) {
      const [px, py] = aPx(p.u, p.v), k = 1 - p.t / p.dur, R = p.r * TILE, col = p.tipo === 'cristal' ? '122,240,255' : p.tipo === 'mazo' ? '230,190,120' : '255,90,40', pul = 0.5 + 0.5 * Math.sin(now / 90);
      ctx.fillStyle = 'rgba(' + col + ',' + (0.12 + 0.25 * k) + ')'; ctx.beginPath(); ctx.ellipse(px, py, R * k, R * k * 0.5, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.5 + 0.4 * pul) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, py, R, R * 0.5, 0, 0, 6.3); ctx.stroke();
    }
    for (const e of b.efectos) {
      const [px, py] = aPx(e.u, e.v), k = e.t / e.dur;
      if (e.tipo === 'polvo') { ctx.fillStyle = 'rgba(200,180,140,' + (0.35 * (1 - k)) + ')'; ctx.beginPath(); ctx.ellipse(px, py - 2, 3 + k * 10, 2 + k * 4, 0, 0, 6.3); ctx.fill(); }
    }
    // con la pelea terminada la simulación ya no corre: los que venían cayendo terminan de caer aquí
    if (b.fin) for (const f of b.mios.concat(b.suyos)) { if (f.muerto) f.muerto += dt; f.anim += dt; f.golpe = Math.max(0, f.golpe - dt); }
    // figuras, de atrás hacia adelante
    const todos = b.mios.concat(b.suyos, b.heroe ? [b.heroe.fig] : []).filter(f => !f.muerto || f.muerto < (f.st.spr === 'golem' ? 0.3 : f.st.spr === 'espectro' ? 0.6 : 1.6));
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
      const agua = f.st.barco || f.st.mar;
      if (f.modo === 'walk' && !f.muerto && (f._p = (f._p || 0) - dt) < 0) { f._p = rnd(0.16, 0.3); part(v, agua ? { x: px + (f.flip ? 6 : -6) + rnd(-2, 2), y: py, vx: (f.flip ? 14 : -14) + rnd(-6, 6), vy: rnd(-3, 3), drag: 2, life: rnd(0.5, 0.9), size: 2, crece: 3, a: 0.55, col: [226, 240, 250] } : { x: px + rnd(-3, 3), y: py, vx: rnd(-8, 8), vy: rnd(-8, -2), drag: 3, life: rnd(0.4, 0.6), size: 2, crece: 4, a: 0.3, col: [196, 178, 140] }); }
      const m = f.muerto, spr0 = f.st.spr;
      let alpha = m ? (m < 0.9 ? 1 : Math.max(0, 1 - (m - 0.9) / 0.7)) : spr0 === 'espectro' ? 0.75 : 1;
      if (m && spr0 === 'espectro') { alpha = Math.max(0, 0.75 - m / 0.6 * 0.75); py -= m * 20; }
      if (m && spr0 === 'golem') alpha = Math.max(0, 1 - m / 0.3);
      ctx.globalAlpha = alpha;
      // sombra y aro de bando
      if (!m && agua) { // en el agua: espuma alrededor del casco en vez de sombra
        const wv = Math.sin(f.anim * 3) * 0.5, ww = Math.round(12 * (f.st.escala || 1));
        ctx.fillStyle = 'rgba(230,245,255,' + (0.35 + 0.15 * wv) + ')'; ctx.fillRect(Math.round(px - ww), Math.round(py - 1), ww * 2, 2);
        ctx.fillStyle = f.lado === 'p' ? 'rgba(80,140,255,0.6)' : 'rgba(255,80,60,0.55)'; ctx.fillRect(Math.round(px - 4), Math.round(py + 2), 8, 1);
      } else if (!m) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(px - 5), Math.round(py - 1), 10, 3); ctx.fillRect(Math.round(px - 3), Math.round(py - 2), 6, 5);
        ctx.fillStyle = f.lado === 'p' ? 'rgba(80,140,255,0.6)' : 'rgba(255,80,60,0.55)'; ctx.fillRect(Math.round(px - 4), Math.round(py + 1), 8, 1);
      }
      ctx.save();
      ctx.translate(Math.round(px), Math.round(py));
      // al caer se tumban de costado (el dragón se hunde)
      if (m && agua) { ctx.translate(0, Math.min(1, m / 1.4) * 12); ctx.rotate((f.caida || 1) * Math.min(1, m / 1.4) * 0.35); } // los barcos se hunden escorando
      else if (m && spr0 !== 'dragon' && spr0 !== 'espectro' && spr0 !== 'golem') ctx.rotate(f.caida * Math.min(1, m / 0.28) * Math.PI / 2 * 0.9);
      if (m && spr0 === 'dragon') ctx.translate(0, Math.min(1, m / 1.2) * 14);
      if (spr0 === 'dragon') {
        const d = dragonSpr[Math.floor(f.anim * (m ? 1 : 4)) % 2];
        // vuela: sube y baja con el aleteo
        const vuelo = m ? 0 : Math.sin(f.anim * 4 * Math.PI / 2) * 3 - 4 - (f.esJefe && b.vuela ? 22 : 0);
        if (f.st.escala) ctx.scale(f.st.escala, f.st.escala);
        if (f.flip) ctx.scale(-1, 1); // el dibujo mira a la derecha
        ctx.drawImage(d, -40, -56 + vuelo, 72, 52);
        if (f.golpe > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * (f.golpe / 0.18) * 0.7; ctx.drawImage(d, -40, -56 + vuelo, 72, 52); ctx.globalCompositeOperation = 'source-over'; }
      } else {
        const spr = sprite(f, frame);
        if (spr) {
          const big = f.st.escala || (spr0 === 'oso' ? 1.2 : spr0 === 'golem' ? 1.1 : spr0 === 'heroe' ? 1.25 : 1);
          const w = (spr.k ? spr.w : spr.c.width) * big, h = (spr.k ? spr.h : spr.c.height) * big, x0 = Math.round(-spr.ax * big), y0 = Math.round(-spr.ay * big);
          ctx.drawImage(spr.c, x0, y0, w, h);
          // destello blanco del golpe recibido
          if (f.golpe > 0 && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (f.golpe / 0.18) * 0.8; ctx.drawImage(spr.c, x0, y0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; }
          // ojos que brillan: los del gólem (en su dibujo, en x 9 y 12, y 4) y un halo verde para el Liche
          if (spr0 === 'golem' && !m) { const k = 0.6 + 0.4 * Math.sin(f.anim * 3), ex = f.flip ? 20 - 13 : 9; ctx.fillStyle = (f.st.tinte ? 'rgba(255,200,90,' : 'rgba(122,240,255,') + k + ')'; ctx.fillRect(Math.round(x0 + ex * big), Math.round(y0 + 4 * big), Math.ceil(big), Math.ceil(big)); ctx.fillRect(Math.round(x0 + (ex + 3) * big), Math.round(y0 + 4 * big), Math.ceil(big), Math.ceil(big)); }
          if (spr0 === 'liche' && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,255,140,' + (0.12 + 0.08 * Math.sin(f.anim * 4)) + ')'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 2); ctx.globalCompositeOperation = 'source-over'; }
          if ((spr0 === 'fatuo' || spr0 === 'bruja' || spr0 === 'sirena') && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = spr0 === 'sirena' ? 'rgba(90,230,220,0.14)' : 'rgba(110,255,140,' + (spr0 === 'fatuo' ? 0.3 : 0.12) + ')'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 2); ctx.globalCompositeOperation = 'source-over'; }
          // maldecidos, agarrados o encantados: una marca sobre la cabeza
          if (!m && (f.lento > 0 || f.atado > 0 || f.encantado > 0)) { ctx.fillStyle = f.encantado > 0 ? '#5ae8e0' : f.atado > 0 ? '#c86aa8' : '#7aff70'; ctx.fillRect(-1, y0 - 4, 3, 2); }
          if (spr0 === 'espectro' && !m) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(150,90,230,0.18)'; ctx.fillRect(-6, -18, 12, 18); ctx.globalCompositeOperation = 'source-over'; }
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // vida y cuántos son
      if (!m && spr0 === 'heroe') { // el héroe: una estrella y su nombre en vez de barra de vida
        const nm = b.heroe.nombre;
        ctx.font = 'bold 7px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('★ ' + nm, Math.round(px) + 1, Math.round(py - 30) + 1); ctx.fillStyle = '#ffd860'; ctx.fillText('★ ' + nm, Math.round(px), Math.round(py - 30));
      } else if (!m) {
        const k = U.clamp(f.hp / f.max, 0, 1), top = Math.round((spr0 === 'dragon' ? 62 : f.tipo === 'rider' ? 30 : 24) * (f.st.escala || 1)) + (f.esJefe && b.vuela ? 22 : 0);
        if (f.lado === 'p' && (b.muro > 0 || b.cancion > 0)) { ctx.fillStyle = b.muro > 0 ? '#7ab8ff' : '#ffd060'; ctx.fillRect(Math.round(px - 10), Math.round(py - top - 1), 3, 4); }
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(px - 7), Math.round(py - top), 14, 3);
        ctx.fillStyle = k < 0.3 ? '#ff7040' : f.lado === 'p' ? '#5ab0ff' : '#e05040'; ctx.fillRect(Math.round(px - 6), Math.round(py - top + 1), Math.round(12 * k), 1);
        if (f.lado === 'p' && f.rep > 1) { ctx.font = '7px "PK Num", "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('x' + f.rep, Math.round(px) + 1, Math.round(py - top - 1) + 1); ctx.fillStyle = '#cfe4ff'; ctx.fillText('x' + f.rep, Math.round(px), Math.round(py - top - 1)); }
        // C8: la veteranía, una estrella chica cada dos rangos (D.RANKS) bajo la barra
        if (f.lado === 'p' && f.rango > 0) { ctx.fillStyle = '#ffd860'; const n = Math.min(5, Math.ceil(f.rango / 2)); for (let i = 0; i < n; i++) { const sx = Math.round(px - n * 1.5 + i * 3), sy = Math.round(py - top + 4); ctx.fillRect(sx, sy, 2, 1); ctx.fillRect(sx + 0.5 | 0, sy - 1, 1, 3); } }
        // C4: el rol, un rombo de su color y el nombre corto encima
        if (f.rol) {
          const R = B.ROLES[f.rol], y = Math.round(py - top - 4), x = Math.round(px);
          ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = R.col; ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillRect(x - 2, y - 1, 5, 3);
          { const lb = f.nombreRol || R.nombre; ctx.font = '6px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(lb, x + 1, y - 3); ctx.fillStyle = R.col; ctx.fillText(lb, x, y - 4); }
        }
        if (spr0 === 'dragon' || f.esJefe) { const lb = f.esJefe ? f.st.nombre.toUpperCase() : 'DRAGÓN'; ctx.font = 'bold 8px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(lb, Math.round(px) + 1, Math.round(py - top - 2) + 1); ctx.fillStyle = '#ffb070'; ctx.fillText(lb, Math.round(px), Math.round(py - top - 2)); }
      }
    }
    // tiros: flechas que apuntan a donde van, rocas con sombra y arco, bolas de luz y de sombra con estela
    for (const p of b.tiros) {
      const k = Math.min(1, p.t / p.dur), H = p.tipo === 'piedra' ? 26 : p.tipo === 'bala' ? 9 : p.tipo === 'flecha' ? 7 : p.tipo === 'virote' ? 3 : p.tipo === 'arcano' ? 10 : 3;
      const [px, py] = aPx(p.u, p.v), [x0, y0] = aPx(p.u0, p.v0), [x1, y1] = aPx(p.o.u, p.o.v);
      const arc = Math.sin(k * Math.PI) * H, y = py - 10 - arc;
      const vx = (x1 - x0), vy = (y1 - y0) - Math.cos(k * Math.PI) * Math.PI * H, a = Math.atan2(vy, vx);
      if (p.tipo === 'piedra') {
        ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + 0.2 * (1 - arc / H)) + ')'; ctx.fillRect(Math.round(px - 2 - (1 - arc / H) * 1), Math.round(py - 1), Math.round(4 + (1 - arc / H) * 2), 2);
        ctx.save(); ctx.translate(Math.round(px), Math.round(y)); ctx.rotate(p.t * 9);
        ctx.fillStyle = '#6e685c'; ctx.fillRect(-2, -2, 4, 4); ctx.fillStyle = '#9a9284'; ctx.fillRect(-2, -2, 2, 2); ctx.restore();
        if (Math.random() < 0.5) part(v, { x: px, y, vx: rnd(-6, 6), vy: rnd(-4, 4), drag: 2, life: 0.35, size: 1, crece: 2, a: 0.35, col: [170, 160, 140] });
      } else if (p.tipo === 'bala') { // bala de cañón: negra, con una estela de humo
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(Math.round(px - 1), Math.round(py - 1), 3, 1);
        ctx.fillStyle = '#1c1c22'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 3, 3); ctx.fillStyle = '#6a6a74'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 1, 1);
        if (Math.random() < 0.6) part(v, { x: px, y, vx: rnd(-5, 5), vy: rnd(-5, 2), drag: 2, life: 0.4, size: 1, crece: 3, a: 0.35, col: [200, 200, 205] });
      } else if (p.tipo === 'arpon') { // largo, con la cuerda detrás
        const cx = Math.cos(a), sy = Math.sin(a), [qx, qy] = aPx(p.u0, p.v0);
        ctx.strokeStyle = 'rgba(210,190,140,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(qx, qy - 10); ctx.lineTo(px - cx * 7, y - sy * 7); ctx.stroke();
        ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - cx * 8, y - sy * 8); ctx.lineTo(px, y); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#e0e4ea'; ctx.fillRect(Math.round(px + cx * 1) - 1, Math.round(y + sy * 1) - 1, 3, 2);
      } else if (p.tipo === 'virote') { // corto, grueso y casi recto
        const cx = Math.cos(a), sy = Math.sin(a);
        ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - cx * 5, y - sy * 5); ctx.lineTo(px, y); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#d8dce4'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 2, 2);
      } else if (p.tipo === 'flecha') {
        const cx = Math.cos(a), sy = Math.sin(a);
        ctx.strokeStyle = 'rgba(232,220,192,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - cx * 12, y - sy * 12); ctx.lineTo(px - cx * 6, y - sy * 6); ctx.stroke();
        ctx.strokeStyle = '#d8c8a0'; ctx.beginPath(); ctx.moveTo(px - cx * 6, y - sy * 6); ctx.lineTo(px, y); ctx.stroke();
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(Math.round(px) - 1, Math.round(y) - 1, 2, 2);
      } else {
        const col = p.tipo === 'luz' ? [255, 246, 160] : p.tipo === 'arcano' ? [180, 130, 255] : [160, 90, 230];
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
      if (r.t < 0) continue; // los aros en cadena (maldición, canto) empiezan con t negativo: todavía no salen
      const k = r.t / r.dur; ctx.strokeStyle = 'rgba(' + r.col + ',' + 0.7 * (1 - k) + ')'; ctx.lineWidth = r.suelo ? 2 : 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * k + 2, (r.r * k + 2) * (r.suelo ? 0.45 : 1), 0, 0, 6.3); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // números: los golpes grandes, más grandes y con un salto
    ctx.textAlign = 'center';
    for (const x of b.textos) {
      const [px, py] = aPx(x.u, x.v), pop = x.grande && x.t < 0.15 ? 1.6 - x.t * 4 : 1, fs = Math.round((x.grande ? 13 : 9) * pop), ty = Math.round(py - 26 - x.t * 12);
      ctx.font = 'bold ' + fs + 'px "PK Num", "Pixelify Sans", monospace';
      ctx.globalAlpha = 1 - x.t / 1.2; ctx.lineWidth = 2; ctx.strokeStyle = '#140804'; ctx.strokeText(x.txt, Math.round(px), ty); ctx.fillStyle = x.col; ctx.fillText(x.txt, Math.round(px), ty);
    }
    ctx.globalAlpha = 1;
    // lo que va adelante de las figuras: estalactitas, raíces, y las partículas (brasas, gotas, niebla)
    T(ox, oy);
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
    // barra grande del jefe (C3): su vida y la de sus partes, con el nombre
    if (b.jefeF && !b.fin) {
      const J = b.jefeF, partes = b.suyos.filter(f => f.parte), hp = (J.muerto ? 0 : J.hp) + partes.reduce((a, f) => a + (f.muerto ? 0 : f.hp), 0), mx = b.partido ? J.max * 0.5 + 0.0001 : J.max;
      const k = U.clamp(b.partido ? hp / Math.max(1, partes.reduce((a, f) => a + f.max, 0)) * 0.5 : hp / mx, 0, 1);
      const bw = Math.round(W * 0.5), bx = Math.round((W - bw) / 2), by = Math.round(Hh * 0.05), bh = Math.max(6, Math.round(base / 60));
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#5a1a12'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = b.vuela ? '#ffb050' : '#e04030'; ctx.fillRect(bx, by, Math.round(bw * k), bh);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, Math.round(bw * k), Math.max(1, Math.round(bh / 3)));
      const fs = Math.max(10, Math.round(base / 40));
      ctx.font = 'bold ' + fs + 'px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0a04';
      const nm = '☠ ' + J.st.nombre + (b.vuela ? ' · en el aire' : '');
      ctx.strokeText(nm, W / 2, by + bh + fs + 2); ctx.fillStyle = '#ffd8a0'; ctx.fillText(nm, W / 2, by + bh + fs + 2);
    }
    if (b.pausa && !b.fin) {
      const fs = Math.round(base / 12); ctx.font = 'bold ' + fs + 'px "Pixelify Sans", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, Hh);
      ctx.lineWidth = 3; ctx.strokeStyle = '#1a0a04'; ctx.strokeText('Pausa', W / 2, Hh * 0.45); ctx.fillStyle = '#ffe9b0'; ctx.fillText('Pausa', W / 2, Hh * 0.45);
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
