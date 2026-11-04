// Defensa 2.0 (Fase 4, C5, pk-22): ramas de torre y trampas. Las oleadas de los asedios viven en incursiones.js.
// Todo esto solo cuenta contra las incursiones y los asedios en vivo (como los lobos): nunca sin conexión ni en el
// servidor, y no cambia la defensa del reino que ven los demás (Social.defense), así que sim.js no se toca.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const A = (PK.Asedios = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const toast = (t, k) => PK.UI && PK.UI.toast(t, k);
  const costo = c => Object.keys(c).map(k => U.fmt(c[k]) + ' de ' + D.RES[k].name.toLowerCase()).join(', ');

  // ---------- Ramas de torre ----------
  // Al llegar a nivel 5, cada torre elige una (b.rama, se guarda con el edificio). cd: segundos entre tiros;
  // dmg: por tiro, sobre el de siempre; alcance: casillas de más; area: radio del golpe; lento: segundos de freno.
  A.RAMA_NIVEL = 5;
  A.RAMAS = {
    arquera: { name: 'Torre Arquera', desc: 'Dispara el doble de seguido, flechas más livianas.', cd: 0.5, dmg: 0.62, alcance: 0, col: '#e8d8a8' },
    balista: { name: 'Balista', desc: 'Un virote enorme cada 2 s: mucho daño y más alcance.', cd: 2.2, dmg: 3, alcance: 2, col: '#c0c8d8' },
    aceite: { name: 'Aceite hirviendo', desc: 'Corto alcance, pero quema a todos los que estén juntos.', cd: 2, dmg: 1.1, alcance: -2.5, area: 1.6, col: '#ffb040' },
    mistica: { name: 'Torre Mística', desc: 'Su rayo frena a los bandidos 3 s.', cd: 1.1, dmg: 0.85, alcance: 0.5, lento: 3, col: '#b080ff' },
  };
  A.puedeRama = b => b && b.owner === 'p' && b.type === 'tower' && b.done && b.lvl >= A.RAMA_NIVEL && S().era >= 3;
  A.elegirRama = function (b, id) {
    if (!A.puedeRama(b) || !A.RAMAS[id]) return false;
    if (b.rama && b.rama !== id) { const c = A.cambio(); if (!G().canAfford(c)) { toast('Cambiar de rama cuesta ' + costo(c) + '.', 'warn'); return false; } G().pay(c); }
    b.rama = id;
    G().blockVer++;
    toast(A.RAMAS[id].name + ': lista para el próximo ataque.', 'good');
    return true;
  };
  A.cambio = () => ({ stone: 150 * S().era, gold: 60 * S().era });
  // la parte del panel de la torre (ui.js)
  A.panelTorre = function (b) {
    const el = U.el;
    if (b.type !== 'tower' || b.owner !== 'p' || !b.done) return '';
    if (!A.puedeRama(b)) return el('p', { class: 'small muted' }, 'En nivel ' + A.RAMA_NIVEL + ' (desde la Era III) eliges una rama: arquera, balista, aceite o mística.');
    const r = b.rama && A.RAMAS[b.rama];
    return el('div', { class: 'tw-ramas' }, el('p', { class: 'small' }, el('b', null, r ? r.name : 'Elige una rama'), r ? ' · ' + r.desc : ' (contra incursiones y asedios)'),
      el('div', { class: 'row' }, Object.keys(A.RAMAS).map(id => PK.UI.btn(A.RAMAS[id].name, () => { if (A.elegirRama(b, id)) PK.UI.refreshPanel(true); },
        { small: true, cls: b.rama === id ? 'gold' : '', disabled: b.rama === id, title: A.RAMAS[id].desc + (b.rama && b.rama !== id ? ' Cambiar cuesta ' + costo(A.cambio()) + '.' : '') }))));
  };
  // un tiro de torre según su rama (incursiones.js lo llama en vez del de siempre)
  A.tiro = function (b, base) {
    const r = b.rama && A.RAMAS[b.rama];
    if (!r) return { cd: 1, dmg: base, alcance: 6 + 0.6 * b.lvl };
    return { cd: r.cd, dmg: base * r.dmg, alcance: 6 + 0.6 * b.lvl + r.alcance, area: r.area, lento: r.lento, col: r.col, rama: b.rama };
  };

  // ---------- Trampas ----------
  // Se ponen como las murallas, de a una casilla, en tu territorio y en suelo libre (S.trampas). No estorban a
  // nadie más: solo se activan cuando un bandido las pisa, y se gastan.
  A.TRAMPAS = {
    pinchos: { name: 'Pinchos', desc: 'Hieren al bandido que los pisa (3 veces).', cost: { wood: 60, stone: 40 }, usos: 3, era: 3 },
    brea: { name: 'Brea', desc: 'Frena 4 s a los que la pisan (5 veces).', cost: { wood: 40, gold: 30 }, usos: 5, era: 3 },
  };
  A.MAX_TRAMPAS = 16;
  A.lista = () => (S().trampas = S().trampas || []);
  A.trampaEn = (x, y) => A.lista().find(t => t.x === x && t.y === y);
  A.porQueNo = function (tipo, x, y) {
    const t = A.TRAMPAS[tipo], st = S();
    if (!t) return 'Esa trampa no existe.';
    if (st.era < t.era) return 'Las trampas llegan en la Era ' + U.roman(t.era) + '.';
    if (!W.inb(x, y) || W.ownerAt(x, y) !== 'p') return 'Solo en tu territorio.';
    if (!W.passable(x, y) || W.bAt[W.idx(x, y)] >= 0 || (W.wall && W.wall[W.idx(x, y)])) return 'Tiene que ser suelo libre.';
    if (A.lista().length >= A.MAX_TRAMPAS) return 'Ya tienes ' + A.MAX_TRAMPAS + ' trampas.';
    if (!G().canAfford(t.cost)) return 'Te falta: ' + costo(t.cost) + '.';
    return null;
  };
  A.poner = function (tipo, x, y) {
    const hay = A.trampaEn(x, y);
    if (hay) { A.lista().splice(A.lista().indexOf(hay), 1); toast('Trampa quitada (no se devuelve lo que costó).', 'info'); return 'quitada'; }
    const why = A.porQueNo(tipo, x, y);
    if (why) { toast(why, 'warn'); return null; }
    G().pay(A.TRAMPAS[tipo].cost);
    A.lista().push({ x, y, t: tipo, u: A.TRAMPAS[tipo].usos });
    return 'puesta';
  };
  // un bandido en (x, y): ¿pisó una trampa? Devuelve el daño (fracción de su vida) o el freno.
  A.pisar = function (o) {
    const l = S().trampas;
    if (!l || !l.length) return null;
    const x = Math.floor(o.x), y = Math.floor(o.y);
    if (o.tx === x && o.ty === y) return null; // la misma casilla no lo vuelve a herir
    o.tx = x; o.ty = y;
    const t = l.find(k => k.x === x && k.y === y);
    if (!t) return null;
    t.u--;
    if (t.u <= 0) l.splice(l.indexOf(t), 1);
    if (PK.Render.burst) PK.Render.burst(o.x, o.y, t.t === 'brea' ? [30, 24, 20] : [190, 190, 200], 8);
    if (PK.Sfx) PK.Sfx.play('hit');
    return t.t === 'brea' ? { lento: 4 } : { dano: 0.35 };
  };
  A.dibujar = function (ctx, R) {
    const l = S() && S().trampas;
    if (!l) return;
    for (const t of l) {
      if (!W.explored(t.x, t.y)) continue;
      const [px, py] = R.iso(t.x + 0.5, t.y + 0.5), x = Math.round(px), y = Math.round(py);
      if (t.t === 'brea') { ctx.fillStyle = 'rgba(20,14,10,0.75)'; ctx.fillRect(x - 6, y - 1, 12, 3); ctx.fillRect(x - 4, y - 2, 8, 5); ctx.fillStyle = 'rgba(120,110,90,0.5)'; ctx.fillRect(x - 2, y - 1, 2, 1); }
      else { ctx.fillStyle = '#5a4a36'; ctx.fillRect(x - 6, y, 12, 2); ctx.fillStyle = '#d8dce4'; for (let i = -5; i <= 5; i += 2) ctx.fillRect(x + i, y - 3 + (i % 4 ? 1 : 0), 1, 3); }
    }
  };

  // Herramienta: el próximo toque en el mapa pone (o quita) una trampa del tipo elegido. Sigue activa hasta Esc.
  A.herramienta = null;
  A.empezar = function (tipo) {
    if (PK.Input.cancelTool) PK.Input.cancelTool();
    A.herramienta = tipo;
    toast('Toca casillas libres de tu territorio para poner ' + A.TRAMPAS[tipo].name.toLowerCase() + ' (' + PK.UI.hint('clic derecho o Esc', 'toca de nuevo el botón') + ' para terminar). Tocar una trampa la quita.', 'info');
  };
  A.click = function (tx, ty) { A.poner(A.herramienta, Math.floor(tx), Math.floor(ty)); };
  A.cancelar = () => { A.herramienta = null; };

  // Para la pestaña de murallas del Cuartel
  A.panelTrampas = function () {
    const el = U.el, st = S(), l = A.lista();
    const cuenta = {}; for (const t of l) cuenta[t.t] = (cuenta[t.t] || 0) + 1;
    return el('div', { class: 'tr-trampas' }, el('h3', null, 'Trampas (' + l.length + '/' + A.MAX_TRAMPAS + ')'),
      el('p', { class: 'small muted' }, 'Solo las pisan los bandidos de las incursiones y los asedios. Se ponen de a una casilla en tu territorio.'),
      Object.keys(A.TRAMPAS).map(k => { const t = A.TRAMPAS[k];
        return el('div', { class: 'row' }, el('b', null, t.name + (cuenta[k] ? ' (' + cuenta[k] + ')' : '')), el('span', { class: 'small' }, t.desc), PK.UI.costEl(t.cost),
          PK.UI.btn(A.herramienta === k ? 'Terminar' : 'Poner', () => { if (A.herramienta === k) A.cancelar(); else { A.empezar(k); PK.UI.closeModal(); } }, { small: true, cls: 'gold', disabled: st.era < t.era, title: st.era < t.era ? 'Era ' + U.roman(t.era) : '' })); }));
  };
})();
