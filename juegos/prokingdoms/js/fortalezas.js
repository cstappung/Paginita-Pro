// Pro Kingdoms — fortalezas (plan de guerra, G6, pk-63). Solo cliente.
// Ocho fortalezas de bandidos, no-muertos o gigantes repartidas por el mapa, siempre en el centro de una parcela.
// Se sitian desde su ventana con el mismo asedio de tres etapas de la conquista (D.asedioPlan), pero contra
// monstruos: la fuerza es la de las expediciones (Exp.powerVs). Tomada, es tuya: da un bono a elección y un tributo
// diario, y cada 3 a 5 días una hueste viene a recuperarla y la defiendes tú. Si la pierdes, vuelve un nivel más
// fuerte. Como todo asedio, va por marcas de tiempo: recargar o volver después da el mismo final.
// Las fortalezas NO son lugares de W.pois (no entran en el despeje ni en su prueba): se calculan aparte, con su
// propio rng, del terreno y de dónde están los reinos, que nunca cambian.
(function () {
  'use strict';
  const PK = window.PK, D = PK.D, U = PK.U, W = PK.World;
  const F = (PK.Fort = {});
  const G = () => PK.Game, S = () => PK.Game.state, T = () => PK.Terr;
  const toast = (t, k, a) => PK.UI.toast(t, k, a);
  const DIA = 86400e3;

  // ---------- Dónde están ----------
  let lista = null;
  F.lista = function () {
    if (lista) return lista;
    const C = D.FORT, P = W.PW, PS = D.PARCEL, r = U.rng(D.SEED + 7127), cands = [];
    const casas = D.REALM_SLOTS.map((s, i) => W.homeParcel(i));
    // lo que ya había en el mapa al generarlo (W.ORIG: no depende de lo que se mudó después): ni lugares ni recursos debajo
    const ocupado = new Uint8Array(W.W * W.H), O = W.ORIG || { p: [], n: [] };
    O.p.forEach(([x0, y0], i) => { const q = W.pois[i]; for (let j = -1; j <= q.h; j++) for (let ii = -1; ii <= q.w; ii++) if (W.inb(x0 + ii, y0 + j)) ocupado[W.idx(x0 + ii, y0 + j)] = 1; });
    O.n.forEach(([x0, y0]) => { if (W.inb(x0, y0) && !ocupado[W.idx(x0, y0)]) ocupado[W.idx(x0, y0)] = 2; }); // 2: un recurso (solo estorba debajo de los muros)
    for (let k = 0; k < P * P; k++) {
      const px = k % P, py = Math.floor(k / P);
      if (W.terrCommon[k] || px < 1 || py < 1 || px > P - 2 || py > P - 2) continue;
      if (casas.some(h => Math.max(Math.abs(px - h % P), Math.abs(py - Math.floor(h / P))) <= D.TERR.core + 2)) continue; // lejos de todo reino
      const x = px * PS + Math.floor(PS / 2) - 1, y = py * PS + Math.floor(PS / 2) - 1;
      let seco = true;
      for (let j = -1; j < 4 && seco; j++) for (let i = -1; i < 4; i++) if (!W.inb(x + i, y + j) || W.terrain[W.idx(x + i, y + j)] === 4 || ocupado[W.idx(x + i, y + j)] === 1 || (ocupado[W.idx(x + i, y + j)] === 2 && i >= 0 && j >= 0 && i < 3 && j < 3)) { seco = false; break; }
      if (seco) cands.push([r(), k, x, y]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    lista = [];
    for (const [, k, x, y] of cands) {
      if (lista.length >= C.n) break;
      if (lista.some(o => Math.hypot(o.k % P - k % P, Math.floor(o.k / P) - Math.floor(k / P)) < C.separa)) continue;
      const id = lista.length;
      lista.push({ id, k, x, y, w: 3, h: 3, cx: x + 1.5, cy: y + 1.5, enemigo: C.enemigos[id % C.enemigos.length], base: 1 + (id % 3), nombre: C.nombres[id % C.nombres.length] });
    }
    return lista;
  };
  // G7 (pk-64): dónde está la Ciudadela del mundo: en la zona común más cerca del centro del mapa, en un lugar libre.
  let ciud;
  F.ciudadela = function () {
    if (ciud !== undefined) return ciud;
    const P = W.PW, PS = D.PARCEL, c = P / 2, O = W.ORIG || { p: [], n: [] }, ocupado = new Uint8Array(W.W * W.H);
    O.p.forEach(([x0, y0], i) => { const q = W.pois[i]; for (let j = -1; j <= q.h; j++) for (let ii = -1; ii <= q.w; ii++) if (W.inb(x0 + ii, y0 + j)) ocupado[W.idx(x0 + ii, y0 + j)] = 1; });
    O.n.forEach(([x0, y0]) => { if (W.inb(x0, y0)) ocupado[W.idx(x0, y0)] = 1; });
    const ks = [];
    for (let k = 0; k < P * P; k++) if (W.terrCommon[k]) ks.push(k);
    ks.sort((a, b) => Math.hypot(a % P - c, Math.floor(a / P) - c) - Math.hypot(b % P - c, Math.floor(b / P) - c));
    ciud = null;
    for (const k of ks) {
      const x0 = (k % P) * PS, y0 = Math.floor(k / P) * PS;
      for (let y = y0; y <= y0 + PS - 3 && !ciud; y++) for (let x = x0; x <= x0 + PS - 3 && !ciud; x++) {
        let ok = true;
        for (let j = 0; j < 3 && ok; j++) for (let i = 0; i < 3; i++) { const q = W.idx(x + i, y + j); if (W.terrain[q] === 4 || ocupado[q]) { ok = false; break; } }
        if (ok) ciud = { k, x, y, w: 3, h: 3, cx: x + 1.5, cy: y + 1.5 };
      }
      if (ciud) break;
    }
    return ciud;
  };
  // color del estandarte de un gremio (sale de su id: todos lo ven igual)
  F.colorGremio = gid => { let h = 0; for (const ch of String(gid || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [80 + (h % 160), 80 + ((h >> 8) % 160), 80 + ((h >> 16) % 160)]; };
  F.en = function (x, y) { for (const f of F.lista()) if (x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.h) return f; return null; };
  F.cerca = function (x, y, w, h) { const z = F.ciudadela(); if (z && x < z.x + z.w + 1 && x + w > z.x - 1 && y < z.y + z.h + 1 && y + h > z.y - 1) return z; for (const f of F.lista()) if (x < f.x + f.w + 1 && x + w > f.x - 1 && y < f.y + f.h + 1 && y + h > f.y - 1) return f; return null; };

  // ---------- Estado ----------
  F.ensure = function () {
    const st = S();
    if (!st.fort) st.fort = { f: {}, sitio: null, asalto: null };
    return st.fort;
  };
  F.de = function (id) {
    const o = F.lista()[id], e = F.ensure().f[id] || {};
    return Object.assign({ lvl: o.base, mia: false, bono: null, desde: 0, prox: 0, trib: 0 }, e);
  };
  const guarda = (id, cambios) => { const fs = F.ensure().f; fs[id] = Object.assign(F.de(id), cambios); return fs[id]; };
  F.fuerza = id => D.FORT.fuerza(F.de(id).lvl);
  // Las tres etapas de una fortaleza, en las mismas claves que una parcela: empalizada, torre del homenaje, estandarte.
  F.partes = function (fuerza) {
    const p = { era: Math.round(fuerza * 0.3), towers: Math.round(fuerza * 0.3), troops: 0, walls: 0, home: 0, around: 0 };
    p.troops = Math.round(fuerza) - p.era - p.towers; p.total = Math.round(fuerza);
    return p;
  };
  F.mias = () => F.lista().filter(o => F.de(o.id).mia);
  // Lo que suman las fortalezas tomadas a la recolección (dentro del tope de Vida.recoleccion) y al ánimo.
  F.bono = function (res, granja) {
    let s = 0;
    for (const o of F.mias()) { const b = D.FORT.bonos[F.de(o.id).bono]; if (b) s += granja ? b.granja || 0 : (b.res && b.res[res]) || 0; }
    return s;
  };
  F.animo = () => F.mias().reduce((s, o) => s + ((D.FORT.bonos[F.de(o.id).bono] || {}).animo || 0), 0);
  F.elegirBono = function (id, bono) {
    if (!F.de(id).mia || !D.FORT.bonos[bono]) return false;
    guarda(id, { bono });
    toast(F.lista()[id].nombre + ': ' + D.FORT.bonos[bono].nombre + '.', 'good');
    if (PK.Vida && PK.Vida.calcAnimo) PK.Vida.calcAnimo();
    return true;
  };

  // ---------- Sitiar ----------
  const enemigoDe = o => ({ [o.enemigo]: 1 });
  F.fuerzaContra = (id, units) => (PK.Exp ? PK.Exp.powerVs(units, enemigoDe(F.lista()[id])) : PK.Social.power(units));
  F.puedeSitiar = function (id) {
    const st = S(), fo = F.ensure();
    if (st.era < D.FORT.era) return 'Sitiar una fortaleza requiere la Era ' + U.roman(D.FORT.era) + '.';
    if (!G().countB('barracks')) return 'Necesitas un Cuartel.';
    if (F.de(id).mia) return 'Esa fortaleza ya es tuya.';
    if (fo.sitio) return 'Tus tropas ya están en otro sitio.';
    if (!PK.Terr.explored(F.lista()[id].k)) return 'Primero explora esa parcela.';
    return null;
  };
  F.sitiar = function (id, units) {
    const why = F.puedeSitiar(id), w = S().war, o = F.lista()[id];
    if (why) { toast(why, 'warn'); return false; }
    const total = Object.keys(units).reduce((s, u) => s + units[u], 0);
    if (!total) { toast('Elige tropas para el sitio.', 'warn'); return false; }
    for (const u in units) if (units[u] > w.army[u]) { toast('No tienes tantas tropas.', 'warn'); return false; }
    for (const u in units) w.army[u] -= units[u];
    const [hx, hy] = D.PLAYER_HOME, travel = 60 + U.dist(o.cx, o.cy, hx, hy) * 1.2;
    F.ensure().sitio = { id, units: Object.assign({}, units), power: F.fuerzaContra(id, units), travel, arrive: Date.now() + travel * 1000, phase: 'go', semilla: 1 + Math.floor(Math.random() * 2e9) };
    PK.Social.log('Tus tropas marchan a sitiar ' + o.nombre + ': llegan en ' + U.fmtTime(travel) + '.', 'info');
    toast('Tus tropas marchan a sitiar ' + o.nombre + '. Llegan en ' + U.fmtTime(travel) + '.', 'good');
    return true;
  };

  // ---------- Frentes (lo que leen frente.js y la interfaz, junto con los de terr.js) ----------
  F.frentes = function () {
    const st = S(), out = [];
    if (!st || !st.fort) return out;
    const s = st.fort.sitio, a = st.fort.asalto, me = D.MY_SLOT;
    if (s && s.phase === 'asedio' && s.plan) { const o = F.lista()[s.id]; out.push({ id: 'f' + s.id, k: o.k, de: me, a: -1, lado: s.lado || 0, ini: s.ini, plan: s.plan, units: s.units, mio: 'atk', fort: o, fuerza: s.power }); }
    if (a && a.plan) { const o = F.lista()[a.id]; out.push({ id: 'g' + a.id, k: o.k, de: -1, a: me, lado: a.lado || 0, ini: a.ini, plan: a.plan, units: null, mio: 'def', fort: o, fuerza: a.power }); }
    return out;
  };
  const registro = (o, role, won, plan, units, lado, fin) => PK.Terr.recordBattle({ role, k: o.k, vs: o.nombre, won, atk: plan.atk, def: plan.def, parts: plan.parts, rep: { plan, units, lado, de: role === 'atk' ? D.MY_SLOT : -1, a: role === 'atk' ? -1 : D.MY_SLOT } }, fin);
  const epilogo = (f, ganoAtk) => { if (PK.Frente && PK.Frente.final && !G().offline) PK.Frente.final(f, ganoAtk); };

  function terminaSitio(s) {
    const st = S(), o = F.lista()[s.id], plan = s.plan, fin = s.ini + plan.total * 1000, antes = Object.assign({}, s.units);
    for (const u in s.units) s.units[u] = Math.floor(s.units[u] * (1 - plan.bajas));
    s.phase = 'back'; s.back = fin + s.travel * 1000;
    const cause = registro(o, 'atk', plan.gano, plan, antes, s.lado || 0, fin);
    epilogo({ id: 'f' + s.id, k: o.k, de: D.MY_SLOT, a: -1, lado: s.lado || 0, ini: s.ini, plan, units: antes, mio: 'atk', fort: o }, plan.gano);
    if (plan.gano) {
      const lvl = F.de(s.id).lvl, loot = D.FORT.botin(st.era, lvl);
      guarda(s.id, { mia: true, bono: null, desde: fin, prox: fin + U.rand(D.FORT.contra[0], D.FORT.contra[1]) * DIA, trib: fin });
      G().give(loot);
      G().stat('fortalezas', 1); G().stat('asedios_ganados', 1);
      if (PK.Vida) PK.Vida.evento('asedio', { won: true, bajas: plan.bajas });
      const txt = '¡Tomaste ' + o.nombre + '! Botín: ' + Object.keys(loot).map(r => U.fmt(loot[r]) + ' ' + D.RES[r].name.toLowerCase()).join(', ') + '. Perdiste el ' + Math.round(plan.bajas * 100) + ' % de las tropas.';
      PK.Social.log(txt + ' ' + cause, 'good'); G().logNews('Tomaste ' + o.nombre + '.', 'good');
      toast(txt, 'epic', { label: 'Elegir bono', fn: () => PK.UI.openFort(s.id) });
      PK.Notify.now('¡Fortaleza tomada!', o.nombre + ' es tuya.');
    } else {
      const txt = o.nombre + ' resistió el sitio. Perdiste el ' + Math.round(plan.bajas * 100) + ' % de las tropas.';
      PK.Social.log(txt + ' ' + cause, 'bad'); toast(txt, 'bad'); G().logNews(o.nombre + ' resistió tu sitio.', 'bad');
    }
  }
  function terminaAsalto(a) {
    const st = S(), o = F.lista()[a.id], plan = a.plan, fin = a.ini + plan.total * 1000, e = F.de(a.id);
    const cause = registro(o, 'def', !plan.gano, plan, null, a.lado || 0, fin);
    epilogo({ id: 'g' + a.id, k: o.k, de: -1, a: D.MY_SLOT, lado: a.lado || 0, ini: a.ini, plan, units: null, mio: 'def', fort: o }, plan.gano);
    if (plan.gano) {
      guarda(a.id, { mia: false, bono: null, lvl: Math.min(D.FORT.maxLvl, e.lvl + 1) });
      const txt = 'Perdiste ' + o.nombre + ': vuelve a manos de ' + D.ENEMY[o.enemigo].name.toLowerCase() + ', un nivel más fuerte.';
      PK.Social.log(txt + ' ' + cause, 'bad'); toast(txt, 'bad'); G().logNews(txt, 'bad');
    } else {
      const gold = Math.round(D.FORT.tributo(st.era, e.lvl) * 1.5);
      G().give({ gold });
      guarda(a.id, { prox: fin + U.rand(D.FORT.contra[0], D.FORT.contra[1]) * DIA });
      G().stat('fortalezas_def', 1);
      PK.Terr.defensaGanada(plan);
      const txt = '¡' + o.nombre + ' resistió! Recuperaste ' + U.fmt(gold) + ' de oro de lo que dejaron.';
      PK.Social.log(txt + ' ' + cause, 'good'); toast(txt, 'good'); G().logNews(txt, 'good');
    }
    if (PK.Vida && PK.Vida.calcAnimo) PK.Vida.calcAnimo();
  }

  let tick = 0;
  F.update = function (dt, offline) {
    const st = S();
    if (!st || !st.terr) return;
    tick += dt;
    if (tick < 1) return;
    tick = 0;
    const fo = F.ensure(), now = Date.now(), s = fo.sitio;
    if (s) {
      const o = F.lista()[s.id];
      if (s.phase === 'go' && now >= s.arrive) {
        s.plan = D.asedioPlan({ atk: s.power, parts: F.partes(F.fuerza(s.id)), semilla: s.semilla, units: s.units });
        s.ini = s.arrive; s.lado = PK.Terr.ladoDe(o.k, D.MY_SLOT); s.phase = 'asedio';
        if (!offline && now < s.ini + s.plan.total * 1000) { toast('¡Empieza el sitio de ' + o.nombre + '!', 'epic', { label: 'Ver', fn: () => PK.Terr.verFrente('f' + s.id) }); if (PK.Sfx) PK.Sfx.play('cuerno'); }
      }
      if (s.phase === 'asedio' && now >= s.ini + s.plan.total * 1000) terminaSitio(s);
      if (s.phase === 'back' && now >= s.back) { for (const u in s.units) st.war.army[u] += s.units[u]; fo.sitio = null; PK.Social.log('Volvieron los sobrevivientes del sitio.', 'info'); }
    }
    for (const o of F.mias()) { const e = F.de(o.id); if (!e.semana && now - e.desde >= 7 * DIA) { guarda(o.id, { semana: true }); G().stat('fortaleza_semana', 1); } } // G8
    // tributo: una vez por día por fortaleza (como mucho 3 días juntos al volver)
    for (const o of F.mias()) {
      const e = F.de(o.id), dias = Math.min(3, Math.floor((now - e.trib) / DIA));
      if (dias < 1) continue;
      const gold = D.FORT.tributo(st.era, e.lvl) * dias;
      G().give({ gold });
      guarda(o.id, { trib: now - ((now - e.trib) % DIA) });
      PK.Social.log(o.nombre + ' pagó su tributo: ' + U.fmt(gold) + ' de oro.', 'good');
      if (!offline) toast(o.nombre + ' pagó su tributo: +' + U.fmt(gold) + ' de oro.', 'good');
    }
    // la hueste que viene a recuperarla: una a la vez; avisa 2 minutos antes si estás mirando
    if (!fo.asalto) {
      const o = F.mias().find(x => now >= F.de(x.id).prox);
      if (o) {
        const e = F.de(o.id);
        fo.asalto = { id: o.id, power: Math.round(D.FORT.fuerza(e.lvl + 1) * U.rand(0.45, 0.85)), at: offline ? e.prox : now + 120e3, semilla: 1 + Math.floor(Math.random() * 2e9) };
        if (!offline) { const txt = '¡Una hueste de ' + D.ENEMY[o.enemigo].name.toLowerCase() + ' marcha a recuperar ' + o.nombre + '! Llega en 2 minutos.'; toast(txt, 'bad', { label: 'Ver', fn: () => PK.UI.openFort(o.id) }); PK.Social.log(txt, 'bad'); PK.Notify.now('¡Atacan tu fortaleza!', txt); }
      }
    }
    const a = fo.asalto;
    if (a) {
      const o = F.lista()[a.id];
      if (!a.plan && now >= a.at) {
        a.plan = D.asedioPlan({ atk: a.power, parts: F.defensa(a.id), semilla: a.semilla });
        a.ini = a.at; a.lado = a.id % 4;
        if (!offline && now < a.ini + a.plan.total * 1000) { toast('¡Asedian ' + o.nombre + '!', 'bad', { label: 'Ver', fn: () => PK.Terr.verFrente('g' + a.id) }); if (PK.Sfx) PK.Sfx.play('cuerno'); }
      }
      if (a.plan && now >= a.ini + a.plan.total * 1000) { fo.asalto = null; terminaAsalto(a); }
    }
  };
  // Con qué defiendes una fortaleza tuya: sus muros (la mitad de su fuerza) y tu ejército en casa.
  F.defensa = function (id) {
    const f = F.fuerza(id) * 0.5, army = PK.Social.power(S().war.army);
    const p = { era: Math.round(f * 0.5), towers: Math.round(f * 0.5), troops: Math.round(army), walls: 0, home: 0, around: 0 };
    p.total = p.era + p.towers + p.troops;
    return p;
  };

  // ---------- Dibujo ----------
  F.collect = function (list, vis) {
    const R = PK.Render, Sp = PK.Sprites;
    for (const o of F.lista()) {
      if (!W.explored(Math.floor(o.cx), Math.floor(o.cy))) continue;
      const e = F.de(o.id), spr = Sp.building('fuerte', e.mia ? 'p' : 'fort' + (o.id % 3), Math.min(12, e.lvl * 3)), [px, py] = R.iso(o.x, o.y);
      const x = Math.round(px - spr.ox), y = Math.round(py - spr.oy);
      if (!vis(x, y, spr.c.width, spr.c.height)) continue;
      list.push({ d: o.x + o.y + 3, k: 'fort', o, spr, x, y });
    }
    const z = F.ciudadela();
    if (z && W.explored(Math.floor(z.cx), Math.floor(z.cy))) {
      const M = PK.Mundo, gid = M && M.ciud && M.ciud.gid, spr = Sp.building('fuerte', 'ciud', 15), [px, py] = R.iso(z.x, z.y), [fx, fy] = R.iso(z.cx, z.cy);
      const x = Math.round(px - spr.ox), y = Math.round(py - spr.oy);
      if (vis(x, y, spr.c.width, spr.c.height)) list.push({ d: z.x + z.y + 3, k: 'ciud', o: z, spr, x, y, after: gid ? ctx => { // el estandarte del gremio que la ocupa
        const col = F.colorGremio(gid), t = performance.now() / 400;
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(fx), Math.round(fy - 96), 2, 34);
        ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.fillRect(Math.round(fx + 2), Math.round(fy - 96 + Math.sin(t)), 16, 10);
      } : null });
    }
  };
  F.minimapa = function (ctx, toMM) {
    for (const o of F.lista()) {
      if (!W.explored(Math.floor(o.cx), Math.floor(o.cy))) continue;
      const [x, y] = toMM(o.cx, o.cy);
      ctx.fillStyle = F.de(o.id).mia ? '#7ab8ff' : '#c9c2b4'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 3);
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(x), Math.round(y) - 3, 1, 1);
    }
  };
  F.tituloCiudadela = () => { const M = PK.Mundo; return D.CIUDADELA.nombre + (M && M.ciud && M.ciud.gname ? ' · de ' + M.ciud.gname : ' · sin dueño'); };
  F.titulo = function (o) { const e = F.de(o.id); return o.nombre + ' · ' + (e.mia ? 'tuya' : D.ENEMY[o.enemigo].name.toLowerCase()) + ' · nivel ' + e.lvl; };
})();
