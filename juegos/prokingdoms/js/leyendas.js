// Lugares legendarios (H6 del plan de la mega actualización, pk-17): las 12 maravillas naturales del mapa.
//
// Están en D.LEYENDAS (data.js) y las ubica world.js, 3 copias de cada una (el mapa es el mismo para todos, así
// que el servidor las ve igual). Se descubren explorando. Para activarlas, un héroe va a investigarlas: tarda el
// viaje más un rato, y vuelve con una página de historia, experiencia y a veces un mapa del tesoro. El bono es
// permanente y pequeño, y no se suma dos veces la misma maravilla (S.leyendas guarda los índices). Los bonos de
// recolección son de +5%: caben de sobra en el margen del servidor (LIM.slack 2,5; regla 4).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const L = (PK.Leyendas = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const H = () => PK.Heroes;
  const idx = id => D.LEYENDAS.findIndex(o => o.id === id);

  L.init = function (st) { st.leyendas = st.leyendas || {}; };
  L.tiene = id => !!(S() && S().leyendas && S().leyendas[idx(id)]);
  L.cuantas = () => Object.keys((S() && S().leyendas) || {}).length;

  // ---------- Bonos ----------
  // Los que pasan por G.perk (investigación y experiencia de tropas)
  L.perk = k => (k === 'researchP' && L.tiene('circulo') ? 0.05 : 0) + (k === 'xpBoost' && L.tiene('campo') ? 0.1 : 0);
  // recolección por recurso (game.js: gatherRate y farmRate)
  const MINERIA = ['stone', 'gold', 'ore', 'marble', 'gems'];
  L.recurso = res => (res === 'food' && L.tiene('cascada') ? 0.05 : 0) + (res === 'wood' && L.tiene('arbol') ? 0.05 : 0) +
    (MINERIA.includes(res) && L.tiene('mina') ? 0.05 : 0) + (res === 'gold' && L.tiene('estatua') ? 0.05 : 0);
  // fuerza contra un enemigo (Exp.powerVs): solo PvE
  L.contra = enemy => (L.tiene('dragones') && enemy && enemy.dragon ? 0.1 * enemy.dragon / Object.values(enemy).reduce((s, v) => s + v, 0) : 0);
  L.visionTorre = () => (L.tiene('faro') ? 3 : 0);
  L.fiestaK = () => (L.tiene('colmena') ? 0.8 : 1);
  L.reposo = () => (L.tiene('puerta') ? 0.85 : 1);
  L.rebrote = () => (L.tiene('arbol') ? 0.9 : 1);
  // Pozo: un deseo extra los días que son múltiplo de 3
  L.deseoExtra = () => L.tiene('pozo') && Math.floor(Date.now() / 86400000) % 3 === 0;

  // ---------- Investigar ----------
  L.de = p => D.LEYENDAS[p.ley];
  L.viaje = (p, h) => Math.round((90 + U.dist(p.x, p.y, D.PLAYER_HOME[0], D.PLAYER_HOME[1]) * 3) * (h ? H().viaje(h) : 1));
  L.porQueNo = function (p, h) {
    const st = G().poiState(p) || {};
    if (!st.f) return 'Todavía no lo descubres.';
    if (st.d) return 'Ya lo investigaste.';
    if (!H() || !H().taberna()) return 'Necesitas un héroe (Taberna).';
    if (H().lista().some(o => o.estado === 'investiga' && o.ley === p.id)) return 'Ya va un héroe en camino.';
    if (h && h.estado !== 'libre') return h.nombre + ' no está libre.';
    return null;
  };
  L.mandar = function (p, h) {
    const why = L.porQueNo(p, h);
    if (why || !h) { toast(why || 'Elige un héroe libre.', 'warn'); return false; }
    h.estado = 'investiga'; h.ley = p.id; h.hasta = Date.now() + L.viaje(p, h) * 1000;
    toast(h.nombre + ' sale a investigar ' + L.de(p).name + ' (' + U.fmtTime(L.viaje(p, h)) + ').', 'good');
    return true;
  };
  function terminar(h) {
    const st = S(), p = W.pois[h.ley], L0 = p && L.de(p);
    h.estado = 'libre'; h.ley = null;
    if (!L0) return;
    const ps = G().poiState(p) || (st.pois[p.id] = { f: 1 });
    ps.d = 1;
    const nueva = !st.leyendas[p.ley];
    st.leyendas[p.ley] = 1;
    st.flags['ley_' + L0.id] = 1; // la campaña pide 'ley_dragones' (capítulo VI)
    if (nueva) G().stat('legends', 1); // distintas: la misión pide las 12
    H().darXp(h, 40 + 10 * st.era);
    // a veces trae algo más: con semilla, para que recargar no cambie el resultado
    if (PK.Aventura && U.rng(p.id * 271 + (st.created || 0) % 991)() < 0.35) PK.Aventura.nuevoMapa('leyenda', p.id);
    toast(h.nombre + ' volvió de ' + L0.name + (nueva ? ': ' + L0.bono + ' para siempre.' : '. Ya conocías esta maravilla: no suma otra vez.'), 'epic', { label: 'Leer', fn: () => L.pagina(p.ley) });
    if (PK.Sfx) PK.Sfx.play('level');
  }

  // Biblioteca Hundida: 10 libros por día (al primer tick del día; también sin conexión)
  let t1 = 0;
  L.tick = function (dt) {
    const st = S();
    if (!st || !st.leyendas || (t1 += dt) < 2) return;
    t1 = 0;
    if (H()) for (const h of H().lista()) if (h.estado === 'investiga' && Date.now() >= h.hasta) terminar(h);
    if (L.tiene('biblioteca') && st.flags.libros_dia !== U.dayKey()) { st.flags.libros_dia = U.dayKey(); G().give({ books: 10 }); }
  };

  // ---------- Ventanas ----------
  L.pagina = function (i) {
    const L0 = D.LEYENDAS[i];
    PK.UI.modal('leyenda', L0.name, body => {
      body.append(el('div', { class: 'ley-pag' }, el('p', { class: 'ley-hist' }, L0.historia), el('p', { class: 'small' }, el('b', null, 'Bono para siempre: '), L0.bono + '.')));
    });
  };
  // Lo que muestra el panel del lugar (ui.js, poiPanel)
  L.panel = function (p, info) {
    const UI = PK.UI, L0 = L.de(p), st = G().poiState(p) || {}, sabe = S().leyendas[p.ley];
    info.firstChild.textContent = L0.name;
    info.append(el('p', { class: 'small' }, el('b', null, 'Al investigarla: '), L0.bono + (sabe && !st.d ? ' (ya lo tienes por otra igual)' : '') + '.'));
    const va = H() && H().lista().find(o => o.estado === 'investiga' && o.ley === p.id);
    if (st.d) { info.append(el('p', { class: 'small muted' }, 'Ya la investigaste. '), UI.btn('Leer su historia', () => L.pagina(p.ley), { small: true })); return; }
    if (va) { info.append(el('p', { class: 'small good-t' }, va.nombre + ' la investiga: vuelve en ' + U.fmtTime(Math.max(0, (va.hasta - Date.now()) / 1000)) + '.')); return; }
    const libres = H() ? H().libres() : [], why = L.porQueNo(p, libres[0]);
    if (!libres.length || why) { info.append(el('p', { class: 'small muted' }, why || 'No tienes héroes libres.')); return; }
    info.append(el('div', { class: 'row' }, libres.slice(0, 3).map(h => UI.btn('Mandar a ' + h.nombre, () => { L.mandar(p, h); UI.refreshPanel(true); }, { small: true, cls: 'gold', title: 'Viaje e investigación: ' + U.fmtTime(L.viaje(p, h)) }))));
  };
})();
