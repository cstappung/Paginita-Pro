// Incursiones de bandidos: desde la Era II, cada tanto una banda acampa a la vista de tu pueblo, avisa con un
// cuerno y después marcha hacia tu almacén más cercano. El Centro Urbano y las Torres les disparan, las tropas
// que estén en casa salen del Cuartel a cortarles el paso y, si llegan, saquean un poco de comida, madera,
// piedra y oro y huyen con los sacos (matarlos mientras huyen devuelve lo robado). Rechazarlos da un botín.
// Como los lobos, solo pasa mientras juegas: nada de esto corre sin ti ni lo ve el servidor. Lo único que se
// guarda es el reloj hasta la próxima (state.inc), para que recargar no la adelante ni la borre del todo.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const Inc = (PK.Incursiones = { banda: null, defensores: [] });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
  const sfx = n => PK.Sfx && PK.Sfx.play(n);

  const PRIMERA = 240;            // la primera llega 4 min (de juego) después de entrar a la Era II
  const ENTRE = [420, 660];       // después, cada 7 a 11 min de juego
  const SAQUEO = 5;               // segundos que pasan saqueando antes de huir
  const ASEDIO = 25;              // si las murallas les cierran el paso, golpean un rato y se van
  const COLOR = [70, 44, 40];     // el mismo pardo de los bandidos de troops.js
  const HERRAMIENTA = { militia: 'hammer', spear: 'spear', knight: 'sword', cleric: 'hammer' };
  const RES_BOTIN = ['food', 'wood', 'stone', 'gold'];
  const OLA = [0.7, 0.85, 1.1], ENTRE_OLAS = 30; // fuerza de cada oleada de un asedio (C5)
  let nid = 1;

  Inc.init = function (st) {
    st.inc = Object.assign({ t: PRIMERA, n: 0, ganadas: 0, perdidas: 0 }, st.inc);
    Inc.banda = null; Inc.defensores = [];
  };

  // ---------- Fuerza y premio ----------
  // la primera es más chica (0,7): llega cuando quizá aún no tienes Cuartel, y debe poder ganarse con torres
  Inc.fuerza = (era, n) => Math.round((30 + 35 * (era - 1)) * (0.7 + 0.15 * Math.min(n, 10)));
  Inc.premio = function (era) {
    const r10 = v => Math.round(v / 10) * 10;
    return { gold: r10(90 * Math.pow(1.7, era - 1)), gems: 2 * era, coins: 2 + era };
  };
  const vivos = () => (Inc.banda ? Inc.banda.bandidos.filter(b => b.hp > 0) : []);
  Inc.activa = () => !!Inc.banda;

  // Rumbo visto en la pantalla (arriba es el norte): «del noreste».
  function rumbo(dx, dy) {
    const sx = dx - dy, sy = (dx + dy) / 2, a = Math.atan2(-sy, sx), i = Math.round(a / (Math.PI / 4));
    return ['del este', 'del noreste', 'del norte', 'del noroeste', 'del oeste', 'del suroeste', 'del sur', 'del sureste'][(i + 8) % 8];
  }

  // ---------- Elegir de dónde vienen y adónde van ----------
  function almacenes() {
    return G().buildings.filter(b => b.owner === 'p' && b.done && (b.type === 'tc' || b.type === 'warehouse' || b.type === 'granary'));
  }
  function buscarOrigen() {
    const g = G(), tc = g.buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done);
    const [hx, hy] = tc ? [tc.cx, tc.cy] : D.PLAYER_HOME, propios = g.buildings.filter(b => b.owner === 'p');
    let caminos = 0;
    for (let k = 0; k < 160 && caminos < 6; k++) {
      const a = Math.random() * Math.PI * 2, r = k < 100 ? 15 + Math.random() * 8 : 10 + Math.random() * 6;
      const x = Math.floor(hx + Math.cos(a) * r), y = Math.floor(hy + Math.sin(a) * r);
      if (!W.explored(x, y) || !W.passable(x, y)) continue;
      if (k < 100 && W.ownerAt(x, y) === 'p') continue; // mejor desde afuera de tus tierras
      if (propios.some(b => U.dist(b.cx, b.cy, x, y) < 7)) continue;
      if (PK.Def.isInside(x, y)) continue;
      const dest = almacenes().sort((p, q) => U.dist(p.cx, p.cy, x, y) - U.dist(q.cx, q.cy, x, y))[0];
      if (!dest) return null;
      caminos++;
      const res = W.findPath(x, y, { x0: dest.x, y0: dest.y, x1: dest.x + dest.w - 1, y1: dest.y + dest.h - 1, adj: true }, 20000, true);
      // sin camino completo, solo sirve si las murallas los frenan cerca del pueblo (si no, era un rodeo imposible)
      const fin = res.path.length ? res.path[res.path.length - 1] : [x, y];
      if (!res.ok && U.dist(fin[0], fin[1], dest.cx, dest.cy) > 14) continue;
      if (res.path.length < 4) continue;
      return { x, y, dest, path: res.path, muro: !res.ok, hx, hy };
    }
    return null;
  }

  // ---------- Inicio: aviso con el campamento a la vista ----------
  function empezar() {
    const st = S(), g = G(), o = buscarOrigen();
    if (!o) return false;
    // C5 (pk-22): desde la Era III, una de cada tres es un asedio de 3 oleadas con 30 s entre una y otra
    const era = st.era, n = st.inc.n, olas = era >= 3 && n % 3 === 2 ? 3 : 1, fuerza = Math.round(Inc.fuerza(era, n) * (olas > 1 ? OLA[0] : 1));
    const cuantos = U.clamp(3 + Math.floor((era - 1) / 2) + Math.floor(n / 3), 3, 8), hp = Math.round((fuerza * 3) / cuantos);
    const bandidos = banda(o.x + 0.5, o.y + 0.5, cuantos, hp);
    const aviso = n < 2 ? 75 : olas > 1 ? 60 : 50;
    Inc.banda = { fase: 'aviso', t: 0, aviso, ox: o.x + 0.5, oy: o.y + 0.5, dest: o.dest.id, path: o.path, muro: o.muro, fuerza, bandidos, n0: cuantos, botin: {}, escaparon: 0, recuperado: {}, dano: 0, pool: 0, pool0: 0, salida: false, lado: rumbo(o.x - o.hx, o.y - o.hy), total: 0, ola: 1, olas };
    st.inc.n++;
    const def = PK.Social.defense();
    if (olas > 1) toast('¡Asedio ' + Inc.banda.lado + '! Llegan ' + olas + ' oleadas de bandidos, la primera de ' + cuantos + ' (fuerza aprox. ' + U.fmt(fuerza) + '), en ' + U.fmtTime(aviso) + '. Los aldeanos se refugiarán en el Centro Urbano. Tu defensa: ' + U.fmt(def) + '.', 'bad', { label: 'Ver', fn: () => Inc.ver() });
    else toast('¡Bandidos ' + Inc.banda.lado + '! Una banda de ' + cuantos + ' (fuerza aprox. ' + U.fmt(fuerza) + ') acampa a la vista y atacará en ' + U.fmtTime(aviso) + '. Tu defensa: ' + U.fmt(def) + '.', 'bad', { label: 'Ver', fn: () => Inc.ver() });
    Inc.banda.explicar = n === 0; // la primera vez, cómo se defiende (en otro aviso: uno solo no cabía en el celular)
    sfx('cuerno');
    g.stat('raids', 1);
    return true;
  }

  function banda(x, y, cuantos, hp) {
    const out = [];
    for (let i = 0; i < cuantos; i++) {
      const ang = (i / cuantos) * Math.PI * 2;
      out.push({ id: nid++, x: x + Math.cos(ang) * 0.9, y: y + Math.sin(ang) * 0.9, hp, max: hp, path: [], anim: Math.random(), flip: i % 2 === 1, back: false, i, hair: i % 4, saco: 0, espera: i * 0.55, eng: null, fuera: false });
    }
    return out;
  }
  // C5: la oleada siguiente de un asedio acampa donde la primera y ataca 30 s después
  function siguienteOla() {
    const bd = Inc.banda, st = S(), era = st.era;
    bd.ola++;
    const fuerza = Math.round(Inc.fuerza(era, st.inc.n - 1) * OLA[bd.ola - 1]);
    const cuantos = U.clamp(3 + Math.floor((era - 1) / 2) + Math.floor((st.inc.n - 1) / 3) + bd.ola - 1, 3, 9), hp = Math.round((fuerza * 3) / cuantos);
    bd.bandidos = bd.bandidos.concat(banda(bd.ox, bd.oy, cuantos, hp));
    bd.fuerza = fuerza; bd.n0 = cuantos; bd.fase = 'aviso'; bd.t = 0; bd.aviso = ENTRE_OLAS; bd.total = 0; bd.botin = {}; bd.recuperado = {}; bd.salida = false;
    toast('¡Oleada ' + bd.ola + ' de ' + bd.olas + '! ' + cuantos + ' bandidos más (fuerza aprox. ' + U.fmt(fuerza) + ') atacan en ' + ENTRE_OLAS + ' s.', 'bad', { label: 'Ver', fn: () => Inc.ver() });
    sfx('cuerno');
  }
  // en un asedio, los aldeanos corren al Centro Urbano
  function refugio() {
    const g = G();
    if (PK.Life.scare) for (const u of g.units) if (u.owner === 'p' && u.kind === 'v' && !u.inside && !(u.scared > 0)) PK.Life.scare(u, 'El asedio');
  }

  // ---------- Bucle ----------
  Inc.update = function (dt) {
    const g = G(), st = S();
    if (!st || !st.inc || g.offline || g.noSave) return;
    if (!Inc.banda) {
      if (st.era < 2 || g.villagerCount() < 6) return;
      st.inc.t -= dt;
      if (st.inc.t <= 0) st.inc.t = empezar() ? U.rand(ENTRE[0], ENTRE[1]) : 60;
    } else actualizar(dt);
    actualizarDefensores(dt);
    disparos(dt);
  };

  function paso(o, sp, dt) {
    let move = sp * dt;
    while (move > 0 && o.path.length) {
      const cx = o.path[0][0] + 0.5, cy = o.path[0][1] + 0.5, dx = cx - o.x, dy = cy - o.y, d = Math.hypot(dx, dy);
      if (d > 0.02) { o.flip = dx - dy < 0; o.back = dx + dy < 0; }
      if (d <= move) { o.x = cx; o.y = cy; o.path.shift(); move -= d; } else { o.x += (dx / d) * move; o.y += (dy / d) * move; move = 0; }
    }
    return !o.path.length;
  }
  const mirar = (o, tx, ty) => { const dx = tx - o.x, dy = ty - o.y; if (Math.abs(dx) + Math.abs(dy) > 0.01) { o.flip = dx - dy < 0; o.back = dx + dy < 0; } };

  function actualizar(dt) {
    const bd = Inc.banda, g = G();
    bd.t += dt; bd.total += dt;
    for (const b of bd.bandidos) b.anim += dt;
    const dest = g.bById.get(bd.dest);
    if (bd.fase === 'aviso') {
      if (bd.explicar && bd.t >= 7) {
        bd.explicar = false;
        toast('Los bandidos no respetan treguas. Tu Centro Urbano y tus Torres les disparan, y las tropas del Cuartel salen a cortarles el paso. Si llegan, roban parte de tus bodegas.', 'info');
      }
      if (bd.t >= bd.aviso) {
        bd.fase = 'marcha'; bd.t = 0;
        for (const b of bd.bandidos) b.path = bd.path.slice();
        toast(bd.olas > 1 ? '¡Oleada ' + bd.ola + ' de ' + bd.olas + ': marchan sobre tu pueblo!' : '¡Los bandidos ' + bd.lado + ' marchan sobre tu pueblo!', 'bad', { label: 'Ver', fn: () => Inc.ver() });
        sfx('cuerno');
        if (bd.olas > 1) refugio();
        salir();
      }
      return;
    }
    for (const b of bd.bandidos) {
      if (b.hp <= 0 || b.fuera) continue;
      if (b.lento > 0) b.lento -= dt;
      // trabados con un soldado: pelean y no avanzan
      const rival = Inc.defensores.find(d => d.cuerpo && U.dist(d.x, d.y, b.x, b.y) < 0.95);
      b.eng = rival || null;
      if (rival) { mirar(b, rival.x, rival.y); if (bd.pool > 0) bd.dano += (bd.fuerza / bd.n0) * 0.15 * dt; continue; }
      if (b.espera > 0) { b.espera -= dt; continue; }
      if (bd.fase === 'marcha' || (bd.fase !== 'huida' && b.path.length)) {
        const tr = PK.Asedios && PK.Asedios.pisar(b); // trampas (C5)
        if (tr && tr.lento) b.lento = tr.lento;
        if (tr && tr.dano) herir(b, b.max * tr.dano);
        if (b.hp <= 0) continue;
        if (paso(b, 1.35 * (b.lento > 0 ? 0.5 : 1), dt) && !b.llego) {
          b.llego = true;
          if (bd.fase === 'marcha') { bd.fase = bd.muro ? 'asedio' : 'saqueo'; bd.t = 0; if (!bd.muro) toast('¡Los bandidos están saqueando tus bodegas!', 'bad', { label: 'Ver', fn: () => Inc.ver() }); }
        }
        if (b.llego && dest) mirar(b, dest.cx, dest.cy);
      } else if (bd.fase === 'huida') {
        if (paso(b, 1.7 * (b.lento > 0 ? 0.5 : 1), dt)) escapa(b);
      }
      // los aldeanos que se cruzan con ellos salen corriendo al Centro Urbano
      if (PK.Life.scare) for (const u of g.units) if (u.owner === 'p' && u.kind === 'v' && !u.inside && !(u.scared > 0) && U.dist(u.x, u.y, b.x, b.y) < 1.2) PK.Life.scare(u, 'Los bandidos');
    }
    // humo y golpes donde saquean (o contra la muralla)
    if ((bd.fase === 'saqueo' || bd.fase === 'asedio') && Math.random() < dt * 6) {
      const b = U.pick(vivos().filter(o => o.llego));
      if (b) { const [px, py] = PK.Render.iso(b.x, b.y); PK.Render.particles.push({ x: px + (Math.random() - 0.5) * 8, y: py - 8, vx: (Math.random() - 0.5) * 10, vy: -8, life: 0, max: 0.9, s: 1, puff: [120, 100, 80] }); if (Math.random() < 0.3) sfx('hit'); }
    }
    if (bd.fase === 'saqueo' && bd.t >= SAQUEO) robar(dest);
    if (bd.fase === 'asedio' && bd.t >= ASEDIO) huir('Tus murallas les cerraron el paso: los bandidos se cansaron de golpear y se van.');
    if (bd.fase === 'marcha' && bd.t > 150) huir(null); // se perdieron por el camino
    if (!vivos().some(b => !b.fuera)) { if (bd.ola < bd.olas) siguienteOla(); else terminar(); }
    else if (bd.total > 420) { for (const b of vivos()) if (!b.fuera) escapa(b); if (bd.ola < bd.olas) siguienteOla(); else terminar(); }
  }

  // Se llevan hasta un 12% de cada recurso (menos si llegaron pocos), con un tope según la era.
  function robar(dest) {
    const bd = Inc.banda, st = S(), era = st.era, aqui = vivos().filter(b => b.llego);
    if (!aqui.length || !dest) { huir(null); return; }
    const frac = 0.12 * (aqui.length / bd.n0), tope = Math.round(250 * Math.pow(1.8, era - 1));
    const txt = [];
    for (const r of RES_BOTIN) {
      const n = Math.floor(Math.min((st.res[r] || 0) * frac, tope));
      if (n <= 0) continue;
      st.res[r] -= n; bd.botin[r] = n;
      txt.push(U.fmt(n) + ' de ' + D.RES[r].name.toLowerCase());
    }
    for (const b of aqui) b.saco = 1 / aqui.length;
    bd.cargaRes = Object.keys(bd.botin)[0] || null;
    huir(txt.length ? '¡Te robaron ' + txt.join(', ') + '! Si los alcanzas antes de que escapen, lo recuperas.' : null);
  }
  function huir(msg) {
    const bd = Inc.banda;
    bd.fase = 'huida'; bd.t = 0;
    for (const b of vivos()) {
      b.espera = 0;
      // los que llegaron vuelven por donde vinieron (sin otro A* de 20.000 pasos por bandido)
      if (b.llego && !bd.muro) { b.path = bd.path.slice().reverse().concat([[Math.floor(bd.ox), Math.floor(bd.oy)]]); continue; }
      const r = W.findPath(Math.floor(b.x), Math.floor(b.y), { x0: Math.floor(bd.ox), y0: Math.floor(bd.oy), x1: Math.floor(bd.ox), y1: Math.floor(bd.oy) }, 20000, true);
      b.path = r.path.length ? r.path : [[Math.floor(bd.ox), Math.floor(bd.oy)]];
    }
    if (msg) toast(msg, 'bad', { label: 'Ver', fn: () => Inc.ver() });
  }
  function escapa(b) {
    const bd = Inc.banda;
    b.fuera = true;
    if (b.saco) bd.escaparon += b.saco;
  }

  // Un bandido cae: suelta su saco (vuelve a tus bodegas) y deja unas monedas de oro.
  function herir(b, dmg) {
    if (!b || b.hp <= 0 || b.fuera) return;
    b.hp -= dmg;
    if (b.hp > 0) return;
    const bd = Inc.banda, era = S().era, oro = 10 * era;
    G().addRes('gold', oro);
    if (PK.Render.float) PK.Render.float(b.x, b.y, '+' + oro, 'gold');
    if (PK.Render.burst) PK.Render.burst(b.x, b.y, [150, 110, 90], 12);
    sfx('hit');
    if (b.saco && bd) {
      const back = {};
      for (const r in bd.botin) { const n = Math.floor(bd.botin[r] * b.saco); if (n > 0) { back[r] = n; bd.recuperado[r] = (bd.recuperado[r] || 0) + n; } }
      G().give(back);
      b.saco = 0;
      if (Object.keys(back).length && PK.Render.float) PK.Render.float(b.x, b.y - 0.6, 'recuperado', back.food ? 'food' : back.wood ? 'wood' : back.gold ? 'gold' : 'stone');
    }
    G().stat('bandits_killed', 1);
  }

  function terminar() {
    const bd = Inc.banda, st = S(), g = G();
    if (!bd) return;
    Inc.banda = null;
    const muertos = bd.bandidos.filter(b => b.hp <= 0).length, x = bd.ox, y = bd.oy;
    const bajas = perdidas(bd);
    const robo = Object.keys(bd.botin).filter(r => bd.botin[r] - (bd.recuperado[r] || 0) > 0).map(r => U.fmt(bd.botin[r] - (bd.recuperado[r] || 0)) + ' de ' + D.RES[r].name.toLowerCase());
    if (muertos >= bd.bandidos.length) {
      const p = Inc.premio(st.era);
      if (bd.olas > 1) { for (const k in p) p[k] *= 2; g.stat('asedios_ganados', 1); } // C5: el asedio paga doble
      g.give(p);
      st.inc.ganadas++;
      g.stat('raids_won', 1); g.stat('defenses_won', 1);
      if (!robo.length) g.stat('defensa_limpia', 1);
      if (PK.Vida && PK.Vida.evento) PK.Vida.evento('incursion', { won: true, robo: robo.length });
      if (PK.Vida && PK.Vida.animoEv) PK.Vida.animoEv(8, 1800, 'Rechazaron a los bandidos');
      const txt = Object.keys(p).map(k => '+' + U.fmt(p[k]) + ' ' + (k === 'coins' ? 'monedas' : D.RES[k].name.toLowerCase())).join(', ');
      toast('¡Rechazaste la incursión! Botín de los bandidos: ' + txt + '.' + (bajas ? ' Bajas: ' + bajas + '.' : ''), 'epic');
      if (PK.Troops) PK.Troops.texts.push({ x, y, t: 0, text: '¡Pueblo a salvo!', col: '#ffe27a' });
      const dest = g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
      if (dest && PK.Render.burst) for (let k = 0; k < 3; k++) PK.Render.burst(dest.cx + (Math.random() - 0.5) * 4, dest.cy + (Math.random() - 0.5) * 4, null, 40);
      sfx('level');
      if (PK.Social.log) PK.Social.log('Rechazaste una incursión de bandidos: ' + txt + '.', 'good');
      g.logNews('Rechazaste una incursión de bandidos.', 'good');
    } else {
      st.inc.perdidas++;
      g.stat('raids_lost', 1);
      if (PK.Vida && PK.Vida.animoEv && robo.length) PK.Vida.animoEv(-15, 1800, 'Los bandidos saquearon el pueblo');
      const msg = robo.length ? 'Los bandidos escaparon con ' + robo.join(', ') + '.' : 'Los bandidos se fueron sin llevarse nada.';
      toast(msg + (muertos ? ' Cayeron ' + muertos + ' de ' + bd.n0 + '.' : '') + ' Sube tus Torres y entrena tropas en el Cuartel para la próxima.' + (bajas ? ' Bajas: ' + bajas + '.' : ''), robo.length ? 'warn' : 'info');
      if (PK.Social.log) PK.Social.log(msg, robo.length ? 'bad' : 'info');
      g.logNews(msg, robo.length ? 'bad' : 'info');
    }
  }

  // ---------- Tropas que salen a defender ----------
  // Las figuras representan a todo el ejército en casa: el daño sale de su fuerza total (PK.Social.power), y lo
  // que reciben se descuenta de una reserva (fuerza x4). Al final, bajas según cuánto aguantaron.
  function enCasa() {
    const army = S().war.army, out = {};
    for (const k in army) if (army[k] > 0 && k !== 'catapult') out[k] = army[k];
    return out;
  }
  function salir() {
    const bd = Inc.banda, g = G(), units = enCasa();
    if (!PK.Troops || !PK.Troops.total(units)) return;
    const bars = g.buildings.filter(b => b.owner === 'p' && b.done && b.type === 'barracks');
    const casa = bars.sort((a, b) => U.dist(a.cx, a.cy, bd.ox, bd.oy) - U.dist(b.cx, b.cy, bd.ox, bd.oy))[0] || g.buildings.find(b => b.owner === 'p' && b.type === 'tc');
    if (!casa) return;
    const p = W.freeAround(casa.x, casa.y, casa.x + casa.w - 1, casa.y + casa.h - 1, Math.floor(bd.ox), Math.floor(bd.oy));
    const tipos = PK.Troops.pickTypes(units, Math.min(8, PK.Troops.total(units)));
    bd.poder = PK.Social.power(units);
    bd.pool = bd.pool0 = bd.poder * 4;
    bd.salida = true;
    Inc.defensores = tipos.map((tipo, i) => ({ id: i, tipo, x: p[0] + 0.5 + (i % 3) * 0.3 - 0.3, y: p[1] + 0.5 + Math.floor(i / 3) * 0.3, cx: p[0] + 0.5, cy: p[1] + 0.5, path: [], rt: i * 0.15, cd: 0, anim: Math.random(), flip: false, back: false, cuerpo: tipo !== 'archer', modo: 'walk' }));
    toast('Tus tropas salen del ' + (casa.type === 'barracks' ? 'Cuartel' : 'Centro Urbano') + ' a cortarles el paso (fuerza ' + U.fmt(bd.poder) + ').', 'info');
  }
  function perdidas(bd) {
    if (!bd.salida || !bd.dano) return '';
    const army = S().war.army, units = enCasa(), tot = PK.Troops.total(units);
    let n = Math.min(tot, Math.floor(tot * Math.min(0.25, (bd.dano / Math.max(1, bd.pool0)) * 0.4)));
    if (bd.pool <= 0) n = Math.max(n, Math.ceil(tot * 0.25));
    const out = {};
    for (let i = 0; i < n; i++) {
      const ks = Object.keys(units).filter(k => army[k] > 0);
      if (!ks.length) break;
      const k = ks.sort((a, b) => D.ARMY[a].power - D.ARMY[b].power)[0]; // caen primero los más baratos
      army[k]--; units[k]--;
      out[k] = (out[k] || 0) + 1;
    }
    return Object.keys(out).map(k => out[k] + ' ' + D.ARMY[k].name.toLowerCase() + (out[k] > 1 ? 's' : '')).join(', ');
  }
  function actualizarDefensores(dt) {
    const bd = Inc.banda, list = Inc.defensores;
    if (!list.length) return;
    const activos = bd && bd.fase !== 'aviso' && bd.pool > 0, objetivos = activos ? vivos().filter(b => !b.fuera && b.espera <= 0) : [];
    const dps = bd && bd.poder ? (bd.poder * 0.25) / list.length : 0;
    if (bd && bd.pool > 0 && bd.dano >= bd.pool) {
      bd.pool = 0;
      toast('Tus tropas no pudieron con los bandidos y se repliegan al Cuartel.', 'bad');
    }
    const marcados = new Map();
    for (const d of list.slice()) {
      d.anim += dt; d.rt -= dt; d.cd -= dt;
      // el más cercano, pero repartidos: cada soldado que ya va por un bandido lo hace menos atractivo
      let tgt = null, bdist = 1e9, best = 1e9;
      for (const b of objetivos) {
        const k = U.dist(d.x, d.y, b.x, b.y), sc = k + 2.5 * (marcados.get(b) || 0);
        if (sc < best) { best = sc; bdist = k; tgt = b; }
      }
      if (tgt) marcados.set(tgt, (marcados.get(tgt) || 0) + 1);
      if (!tgt) { // vuelven a formar frente al Cuartel y desaparecen en la guarnición
        d.modo = 'walk';
        if (!d.casa) { d.casa = true; d.path = []; }
        if (!d.path.length) d.path = W.findPath(Math.floor(d.x), Math.floor(d.y), { x0: Math.floor(d.cx), y0: Math.floor(d.cy), x1: Math.floor(d.cx), y1: Math.floor(d.cy) }, 6000).path;
        // al llegar (o si no hay camino de vuelta) se suman a la guarnición
        if (paso(d, 1.8, dt)) list.splice(list.indexOf(d), 1);
        continue;
      }
      if (d.casa) { d.casa = false; d.path = []; d.rt = 0; }
      const alcance = d.cuerpo ? 0.8 : 3.2;
      if (bdist <= alcance) {
        d.path = []; d.modo = 'work';
        mirar(d, tgt.x, tgt.y);
        if (d.cuerpo) herir(tgt, dps * dt);
        else if (d.cd <= 0) { // los arqueros disparan de lejos
          d.cd = 1.1;
          const dmg = dps * 1.1;
          PK.Life.arrows.push({ x0: d.x, y0: d.y, z0: 14, w: tgt, t: 0, dur: Math.max(0.15, bdist / 12), dmg, fn: a => herir(a.w, a.dmg) });
          sfx('arrow');
        }
        continue;
      }
      d.modo = 'walk';
      if (bdist < 1.8) { d.path = [[Math.floor(tgt.x), Math.floor(tgt.y)]]; }
      else if (d.rt <= 0 || !d.path.length) {
        d.rt = 1;
        const tx = Math.floor(tgt.x), ty = Math.floor(tgt.y);
        d.path = W.findPath(Math.floor(d.x), Math.floor(d.y), { x0: tx, y0: ty, x1: tx, y1: ty, adj: true }, 4000).path;
      }
      if (d.path.length === 1 && bdist < 1.8) { // el último tramo, directo hacia un costado del bandido (no todos encima)
        const ang = d.id * 2.4, gx = tgt.x + Math.cos(ang) * 0.55, gy = tgt.y + Math.sin(ang) * 0.55;
        const dx = gx - d.x, dy = gy - d.y, l = Math.hypot(dx, dy) || 1, mv = Math.min(l, 1.9 * dt);
        if (mv > 0.001) { d.x += (dx / l) * mv; d.y += (dy / l) * mv; }
        mirar(d, tgt.x, tgt.y);
      } else paso(d, 1.9, dt);
    }
  }

  // ---------- Torres y Centro Urbano ----------
  function disparos(dt) {
    const bd = Inc.banda;
    if (!bd || bd.fase === 'aviso') return;
    const g = G(), muros = (1 + 0.2 * g.lvl('walls')) * Math.max(0.5, 1 + (g.bono ? g.bono('raidDef') : 0)), blancos = vivos().filter(b => !b.fuera);
    if (!blancos.length) return;
    for (const b of g.buildings) {
      if (b.owner !== 'p' || !b.done || (b.type !== 'tower' && b.type !== 'tc')) continue;
      b.cdInc = (b.cdInc || 0) - dt;
      if (b.cdInc > 0) continue;
      const base = (b.type === 'tower' ? 5 + 2.5 * (b.lvl - 1) : 4 + 1.5 * (b.lvl - 1)) * muros;
      // C5: la rama de la torre (asedios.js) cambia el ritmo, el daño, el alcance, el área y el freno
      const tr = b.type === 'tower' && PK.Asedios ? PK.Asedios.tiro(b, base) : { cd: 1.4, dmg: base, alcance: 7.5 };
      let best = null, bdist = tr.alcance;
      for (const o of blancos) { const k = U.dist(b.cx, b.cy, o.x, o.y); if (k < bdist) { bdist = k; best = o; } }
      if (!best) continue;
      b.cdInc = tr.cd;
      const dmg = tr.dmg;
      PK.Life.arrows.push({ x0: b.cx, y0: b.cy, z0: b.type === 'tower' ? 36 : 30, w: best, t: 0, dur: Math.max(0.15, bdist / (tr.rama === 'balista' ? 18 : 12)), dmg, col: tr.col, fn: a => {
        if (tr.area) { for (const o of vivos()) if (!o.fuera && U.dist(o.x, o.y, a.w.x, a.w.y) < tr.area) herir(o, a.dmg); if (PK.Render.burst) PK.Render.burst(a.w.x, a.w.y, [255, 160, 60], 14); }
        else herir(a.w, a.dmg);
        if (tr.lento && a.w.hp > 0) a.w.lento = Math.max(a.w.lento || 0, tr.lento);
      } });
      sfx('arrow');
    }
  }

  // ---------- Dibujo ----------
  Inc.ver = function () {
    const bd = Inc.banda;
    if (!bd) return;
    const v = vivos().filter(b => !b.fuera), p = v.length ? v[0] : { x: bd.ox, y: bd.oy };
    PK.Render.centerOn(p.x, p.y);
  };
  function barra(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 1, y - 1, 16, 4);
    ctx.fillStyle = '#e05040'; ctx.fillRect(x, y, Math.round(14 * U.clamp(t, 0, 1)), 2);
  }
  Inc.collect = function (list, dt, vis) {
    const bd = Inc.banda;
    const push = it => { const w = it.spr.k ? it.spr.w : it.spr.c.width, h = it.spr.k ? it.spr.h : it.spr.c.height; if (vis(it.x, it.y, w, h)) list.push(it); };
    if (bd) {
      // fogata y estandarte del campamento mientras esperan
      if (bd.fase === 'aviso' && Math.random() < dt * 5) {
        const [px, py] = PK.Render.iso(bd.ox, bd.oy);
        PK.Render.particles.push({ x: px + (Math.random() - 0.5) * 3, y: py - 3, vx: 2, vy: -9, life: 0, max: 1.8, s: 1, c: 80 });
        if (Math.random() < 0.6) PK.Render.particles.push({ x: px + (Math.random() - 0.5) * 4, y: py - 2, vx: (Math.random() - 0.5) * 6, vy: -12, life: 0, max: 0.6, s: 1, rgb: [255, 150, 60] });
      }
      for (const b of bd.bandidos) {
        if (b.hp <= 0 || b.fuera) continue;
        const pelea = !!b.eng || ((bd.fase === 'saqueo' || bd.fase === 'asedio') && b.llego), anda = !pelea && bd.fase !== 'aviso' && b.espera <= 0 && b.path.length > 0;
        const modo = pelea ? 'work' : anda ? 'walk' : 'idle', frame = pelea ? Math.floor(b.anim * 5 + b.i) % 4 : anda ? Math.floor(b.anim * 9) % 6 : 0;
        const spr = Sp.villager(COLOR, 1 + (b.i % 2), b.i % 3 === 0 ? 0 : 2, modo, frame, b.saco && bd.cargaRes ? bd.cargaRes : null, b.flip, pelea ? (bd.fase === 'asedio' && !b.eng ? 'hammer' : 'knife') : null, false, b.back && modo !== 'idle', null);
        const [px, py] = PK.Render.iso(b.x, b.y);
        const it = { d: b.x + b.y, k: 'troop', o: { enemy: true }, spr, x: px - spr.ax, y: py - spr.ay, px, py };
        const lider = b.i === 0;
        it.after = ctx => {
          if (lider && bd.fase === 'aviso') { // bandera de la banda
            const x = Math.round(px + (b.flip ? -6 : 5)), y = Math.round(py);
            ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y - 30, 1, 20);
            const wave = Math.floor(performance.now() / 180) % 2;
            ctx.fillStyle = '#7a1010'; ctx.fillRect(b.flip ? x - 7 : x + 1, y - 30 + wave, 7, 5);
            ctx.fillStyle = '#111'; ctx.fillRect(b.flip ? x - 5 : x + 3, y - 29 + wave, 3, 2);
          }
          if (b.hp < b.max) barra(ctx, px - 7, it.y - 3, b.hp / b.max);
        };
        push(it);
      }
    }
    if (PK.Troops && PK.Troops.soldierItem) for (const d of Inc.defensores) {
      const frame = d.modo === 'work' ? Math.floor((d.anim * 1.4 + d.id * 0.3) * 4) % 4 : Math.floor(d.anim * 9 + d.id) % 6;
      push(PK.Troops.soldierItem(d.tipo, d.x, d.y, d.modo, frame, d.flip, d.back && d.modo === 'walk', d.modo === 'work' && d.cuerpo ? HERRAMIENTA[d.tipo] || 'sword' : null, d.id, { defensa: true }));
    }
  };

  // Márgenes (en px de CSS) que tapan la interfaz: arriba, derecha y abajo. Se miden una vez por segundo.
  let libre = null, libreT = 0;
  function zonaLibre() {
    const now = performance.now();
    if (libre && now - libreT < 1000) return libre;
    libreT = now;
    const top = document.getElementById('topbar'), menu = document.getElementById('menu'), W0 = window.innerWidth;
    const t = top ? top.getBoundingClientRect().bottom : 0, m = menu ? menu.getBoundingClientRect() : null;
    const barra = m && m.width > m.height * 2; // U4: en el celular vertical el menú es la barra de abajo
    const der = m && m.width && !barra && m.left > W0 / 2 ? W0 - m.left : 0;
    libre = [t + 40, der + 34, barra ? Math.max(70, window.innerHeight - m.top + 16) : 70, 34];
    return libre;
  }
  // Flecha roja en el borde de la pantalla cuando la banda no se ve, con el tiempo que falta.
  Inc.dibujarPantalla = function (ctx, s, ox, oy, dpr) {
    const bd = Inc.banda;
    if (!bd) return;
    const v = vivos().filter(b => !b.fuera);
    let x = bd.ox, y = bd.oy;
    if (v.length && bd.fase !== 'aviso') { x = v.reduce((a, b) => a + b.x, 0) / v.length; y = v.reduce((a, b) => a + b.y, 0) / v.length; }
    const [wx, wy] = PK.Render.iso(x, y), sx = wx * s + ox, sy = (wy - 12) * s + oy, cv = ctx.canvas;
    // el rectángulo libre del mapa: sin la barra de arriba ni el menú de la derecha (que tapaban la flecha)
    const r = zonaLibre(), x0 = r[3] * dpr, y0 = r[0] * dpr, x1 = cv.width - r[1] * dpr, y1 = cv.height - r[2] * dpr;
    if (sx > x0 && sy > y0 && sx < x1 && sy < y1) return;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((x1 - x0) / 2 / Math.max(1, Math.abs(dx)), (y1 - y0) / 2 / Math.max(1, Math.abs(dy)));
    const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx), pul = 0.75 + 0.25 * Math.sin(performance.now() / 160);
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.globalAlpha = pul;
    ctx.fillStyle = '#2a0a06';
    ctx.beginPath(); ctx.moveTo(16 * dpr, 0); ctx.lineTo(-10 * dpr, -13 * dpr); ctx.lineTo(-10 * dpr, 13 * dpr); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e04030';
    ctx.beginPath(); ctx.moveTo(12 * dpr, 0); ctx.lineTo(-7 * dpr, -9 * dpr); ctx.lineTo(-7 * dpr, 9 * dpr); ctx.closePath(); ctx.fill();
    ctx.restore();
    const txt = bd.fase === 'aviso' ? U.fmtTime(Math.max(0, bd.aviso - bd.t)) : bd.fase === 'huida' ? 'huyen' : '¡ataque!';
    ctx.font = 'bold ' + 12 * dpr + 'px "PK Num", "Pixelify Sans", monospace';
    ctx.textAlign = 'center';
    const tx = ax - Math.cos(ang) * 26 * dpr, ty = ay - Math.sin(ang) * 22 * dpr + 4 * dpr;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(txt, tx + dpr, ty + dpr);
    ctx.fillStyle = '#ffb0a0'; ctx.fillText(txt, tx, ty);
  };
  // Puntos rojos que titilan en el minimapa.
  Inc.minimapa = function (ctx, toMM) {
    const bd = Inc.banda;
    if (!bd || Math.floor(performance.now() / 300) % 2) return;
    ctx.fillStyle = '#ff4030';
    const v = vivos().filter(b => !b.fuera), pts = bd.fase === 'aviso' || !v.length ? [{ x: bd.ox, y: bd.oy }] : v;
    for (const p of pts) { const [x, y] = toMM(p.x, p.y); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
  };
  // Fila para la tira de cola (ui.js): siempre arriba mientras dure.
  Inc.fila = function () {
    const bd = Inc.banda;
    if (!bd) return null;
    const v = vivos().filter(b => !b.fuera).length;
    if (bd.fase === 'aviso') return { k: 'inc-aviso' + bd.ola, name: bd.olas > 1 ? 'Asedio: oleada ' + bd.ola + ' de ' + bd.olas : 'Bandidos ' + bd.lado, left: bd.aviso - bd.t, pct: bd.t / bd.aviso };
    if (bd.fase === 'marcha') return { k: 'inc-marcha' + v, name: 'Bandidos en camino (' + v + ')', left: null, pct: 1 - v / bd.n0 };
    if (bd.fase === 'saqueo') return { k: 'inc-saqueo', name: '¡Saqueando tus bodegas!', left: SAQUEO - bd.t, pct: bd.t / SAQUEO };
    if (bd.fase === 'asedio') return { k: 'inc-asedio', name: 'Golpean tus murallas', left: ASEDIO - bd.t, pct: bd.t / ASEDIO };
    return { k: 'inc-huida' + v, name: 'Huyen con el botín (' + v + ')', left: null, pct: 1 - v / bd.n0 };
  };
  Inc.debug = { ya: () => { if (!Inc.banda) S().inc.t = 0.01; }, atacar: () => { if (Inc.banda && Inc.banda.fase === 'aviso') Inc.banda.t = Inc.banda.aviso; } };
})();
