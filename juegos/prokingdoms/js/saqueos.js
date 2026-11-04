// Partidas de saqueo de los reinos simulados (Fase 4, C6, pk-22). Las decide server/sim.js (tickSaqueos): aquí
// solo se dibuja la columna que marcha desde ese reino hasta tu Centro Urbano, se ofrecen las tres opciones y se
// aplica lo que llega por el buzón (net.js: «saqueo» y «saqueo_fin»). Sin servidor (modo local) no hay saqueos.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, Sp = PK.Sprites;
  const Sq = (PK.Saqueos = { info: null, off: 0 });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
  const ahora = () => Date.now() + Sq.off; // reloj del servidor

  // sync (net.js): el saqueo en curso y la diferencia de reloj con el servidor
  Sq.desdeSync = function (r) {
    Sq.off = (r.now || Date.now()) - Date.now();
    const antes = Sq.info;
    Sq.info = r.saqueo || null;
    if (Sq.info && (!antes || antes.id !== Sq.info.id) && PK.UI && PK.UI.rerender) PK.UI.rerender();
  };
  const quedan = () => (Sq.info ? Math.max(0, (Sq.info.arrive - ahora()) / 1000) : 0);
  const home = slot => { const s = D.REALM_SLOTS[slot]; return s ? s.home : D.PLAYER_HOME; };
  const tc = () => G().buildings.find(b => b.owner === 'p' && b.type === 'tc' && b.done);

  // ---------- Buzón ----------
  Sq.aviso = function (it) {
    const left = (it.arrive - ahora()) / 1000;
    if (left <= 0) return;
    toast(it.text + ' Fuerza aprox. ' + U.fmt(it.power) + ', llega en ' + U.fmtTime(left) + '.', 'bad', { label: 'Decidir', fn: () => Sq.abrir() });
    if (PK.Notify) PK.Notify.now('¡Partida de saqueo!', it.text);
    if (PK.Sfx) PK.Sfx.play('cuerno');
  };
  Sq.fin = function (it) {
    const g = G(), st = S();
    Sq.info = null;
    if (it.res === 'tributo') {
      const t = D.saqTributo(st.era), pago = {};
      for (const k in t) pago[k] = Math.min(t[k], Math.floor(st.res[k] || 0));
      g.pay(pago);
      toast(it.text, 'info');
      if (PK.Social.log) PK.Social.log(it.text, 'info');
      return;
    }
    const det = ' (tu defensa ' + U.fmt(it.def) + (it.ayuda ? ', con tu gremio' : '') + ' contra ' + U.fmt(it.atk) + ')';
    if (it.res === 'gano') {
      g.give(it.premio || {});
      g.stat('defenses_won', 1); g.stat('saqueos_rechazados', 1);
      if (PK.Vida && PK.Vida.animoEv) PK.Vida.animoEv(6, 1800, 'Rechazaron a los saqueadores');
      toast(it.text + det + ' Botín: ' + Object.keys(it.premio || {}).map(k => '+' + U.fmt(it.premio[k]) + ' ' + D.RES[k].name.toLowerCase()).join(', ') + '.', 'epic');
      if (PK.Social.log) PK.Social.log(it.text + det, 'good');
    } else {
      const robo = {};
      for (const k of ['food', 'wood', 'stone', 'gold']) { const n = Math.floor(Math.min((st.res[k] || 0) * (it.pct || 0.08), it.tope || 1e9)); if (n > 0) { robo[k] = n; st.res[k] -= n; } }
      if (PK.Vida && PK.Vida.animoEv) PK.Vida.animoEv(-10, 1800, 'Nos saquearon');
      const txt = it.text + det + ' Se llevaron ' + (Object.keys(robo).map(k => U.fmt(robo[k]) + ' de ' + D.RES[k].name.toLowerCase()).join(', ') || 'casi nada') + '.';
      toast(txt + ' Sube tus torres o pide ayuda a tu gremio la próxima vez.', 'bad');
      if (PK.Social.log) PK.Social.log(txt, 'bad');
    }
    g.logNews(it.text, it.res === 'gano' ? 'good' : 'bad');
  };

  // ---------- Elegir ----------
  Sq.elegir = async function (accion) {
    const q = Sq.info;
    if (!q) return;
    try {
      const r = await PK.Net.api('POST', '/api/saqueo', { id: q.id, accion });
      Sq.info = r.saqueo || null;
      if (r.inbox && PK.Net.applyInbox) PK.Net.applyInbox(r.inbox);
      if (accion === 'pelear') toast('Tus torres y tus soldados los esperan.', 'info');
      if (accion === 'ayuda') toast('Tu gremio manda refuerzos: +30% a tu defensa contra esta partida.', 'good');
    } catch (e) { toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn'); }
    if (PK.UI.closeModal) PK.UI.closeModal();
  };
  Sq.abrir = function () {
    const q = Sq.info;
    if (!q) return;
    PK.UI.modal('saqueo', 'Partida de saqueo', body => {
      const st = S(), def = PK.Social.defense(), t = D.saqTributo(st.era), alcanza = G().canAfford(t);
      body.append(el('div', { class: 'sq' },
        el('p', null, el('b', { translate: 'no' }, q.from), q.conq ? ' (conquistador: ataca seguido)' : '', ' marcha contra tu pueblo con una fuerza de aprox. ', el('b', null, U.fmt(q.power)), '. Llega en ' + U.fmtTime(quedan()) + '.'),
        el('p', { class: 'small' }, 'Tu defensa: ' + U.fmt(def) + ' (torres, Centro Urbano, murallas y soldados en casa). Si no eliges, se pelea.'),
        q.eleccion && q.eleccion !== 'tributo' ? el('p', { class: 'small good-t' }, q.eleccion === 'ayuda' ? 'Tu gremio ya viene en camino.' : 'Elegiste pelear.') : null,
        el('div', { class: 'sq-op' },
          el('div', null, el('b', null, 'Pagar tributo'), el('p', { class: 'small' }, 'Se vuelven sin pelear.'), PK.UI.costEl(t), PK.UI.btn('Pagar', () => Sq.elegir('tributo'), { small: true, disabled: !alcanza, title: alcanza ? '' : 'No te alcanza' })),
          el('div', null, el('b', null, 'Pelear'), el('p', { class: 'small' }, 'Si ganas, botín y gemas; si pierdes, se llevan hasta un 8% de tus bodegas.'), PK.UI.btn('Pelear', () => Sq.elegir('pelear'), { small: true, cls: 'gold' })),
          el('div', null, el('b', null, 'Pedir ayuda'), el('p', { class: 'small' }, q.ayuda ? 'Tu gremio suma un 30% a tu defensa.' : 'Necesitas estar en un gremio.'), PK.UI.btn('Pedir ayuda', () => Sq.elegir('ayuda'), { small: true, disabled: !q.ayuda })))));
    });
  };
  // fila para la tira de cola (ui.js)
  Sq.fila = function () {
    const q = Sq.info;
    if (!q) return null;
    const l = quedan(), tot = Math.max(1, (q.arrive - q.at) / 1000);
    return { k: 'saq' + q.id, name: 'Saqueo de ' + q.from, left: l, pct: 1 - l / tot, raid: true, go: () => Sq.abrir() };
  };

  // ---------- Dibujo: la columna con el color de ese reino ----------
  Sq.dibujar = function (ctx, R) {
    const q = Sq.info, b = tc();
    if (!q || !b) return;
    const tot = Math.max(1, q.arrive - q.at), f = U.clamp((ahora() - q.at) / tot, 0, 1), [hx, hy] = home(q.slot);
    const col = (D.REALM_SLOTS[q.slot] || {}).color || [150, 40, 40], dx = b.cx - hx, dy = b.cy - hy, L = Math.hypot(dx, dy) || 1;
    const now = performance.now() / 1000, flip = dx - dy < 0, back = dx + dy < 0;
    for (let i = 0; i < 6; i++) {
      const k = Math.max(0, f - i * (0.7 / L)), x = hx + dx * k + (i % 2 ? 0.25 : -0.25) * (dy / L), y = hy + dy * k - (i % 2 ? 0.25 : -0.25) * (dx / L);
      if (!PK.World.explored(Math.floor(x), Math.floor(y))) continue;
      const spr = Sp.troop(i % 3 === 0 ? 'knight' : i % 3 === 1 ? 'spear' : 'archer', col, 'walk', Math.floor(now * 9 + i) % 6, flip, back, null, i), [px, py] = R.iso(x, y);
      ctx.drawImage(spr.c, Math.round(px - spr.ax), Math.round(py - spr.ay), spr.k ? spr.w : spr.c.width, spr.k ? spr.h : spr.c.height);
      if (!i) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(px + 4), Math.round(py - 30), 1, 20); ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.fillRect(Math.round(px + 5), Math.round(py - 30), 7, 5); }
    }
  };
  Sq.minimapa = function (ctx, toMM) {
    const q = Sq.info, b = tc();
    if (!q || !b || Math.floor(performance.now() / 300) % 2) return;
    const tot = Math.max(1, q.arrive - q.at), f = U.clamp((ahora() - q.at) / tot, 0, 1), [hx, hy] = home(q.slot), [x, y] = toMM(hx + (b.cx - hx) * f, hy + (b.cy - hy) * f);
    ctx.fillStyle = '#ff8030'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  };
})();
