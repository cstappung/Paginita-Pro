// Campaña «La Crónica del Reino» (H5 del plan de la mega actualización, pk-17). Datos en data.js: D.CAPITULOS,
// D.ESCENAS y D.PERSONAJES; misiones c<N>_… en la rama Crónica.
//
// Un capítulo se abre al llegar a su era con el anterior cerrado. Al abrirse: su escena (con el retrato del que
// habla) y su lugar único, que aparece cerca de tu reino (S.campana.lugares[n], con semilla: recargar no lo mueve).
// El lugar se ataca desde el Cuartel como un campamento ({ cap: n } en expeditions.js) y tiene su jefe (JEFE de
// batalla.js). Al ganar se cierra el capítulo (S.campana.hechos[n], lo que pide la misión c<N>_fin) y queda una
// elección pendiente que cambia el premio. No tiene plazo: se elige cuando el jugador vuelve, así que sin
// conexión no se decide nada por él. El capítulo III se puede cerrar antes de pelear, pagando un tratado.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const C = (PK.Campana = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && !G().offline && PK.UI.toast(t, k, act);
  const H = () => PK.Heroes;

  C.init = function (st) {
    const c = (st.campana = st.campana || {});
    for (const k of ['hechos', 'vistos', 'elec', 'lugares', 'rel']) c[k] = c[k] || {};
    c.galeon = c.galeon || [];
  };
  C.cap = n => D.CAPITULOS[n - 1];
  C.hecho = n => !!S().campana.hechos[n];
  C.abierto = n => !!C.cap(n) && S().era >= C.cap(n).era && (n === 1 || C.hecho(n - 1)) && !C.hecho(n);
  // el capítulo en curso (0 si no hay ninguno abierto)
  C.actual = function () {
    for (let n = 1; n <= D.CAPITULOS.length; n++) if (!C.hecho(n)) return C.abierto(n) ? n : 0;
    return 0;
  };
  C.fuerza = n => D.capPower(C.cap(n).era, C.cap(n).lugar.k);
  C.botin = n => { const e = C.cap(n).era, k = Math.pow(1.8, e - 2); return { gold: Math.round(300 * k), gems: 5 * e }; };

  // ---------- El lugar único ----------
  C.lugar = n => S().campana.lugares[n] || null;
  function crearLugar(n) {
    const st = S(), [hx, hy] = D.PLAYER_HOME, rng = U.rng(U.strHash('cap' + n + ':' + (st.created || 0)));
    for (let t = 0; t < 400; t++) {
      const a = rng() * Math.PI * 2, d = 14 + rng() * 14, x = Math.round(hx + Math.cos(a) * d), y = Math.round(hy + Math.sin(a) * d);
      if (!W.inb(x, y) || !W.passable(x, y) || W.poiAt[W.idx(x, y)] >= 0 || W.bAt[W.idx(x, y)] >= 0) continue;
      st.campana.lugares[n] = { x, y };
      G().revealAt(x + 0.5, y + 0.5, 3);
      return st.campana.lugares[n];
    }
    // sin lugar libre (no debería pasar): junto al Centro Urbano
    return (st.campana.lugares[n] = { x: hx + 6, y: hy + 6 });
  }
  C.lugarEn = function (x, y) {
    const n = C.actual(), l = n && C.lugar(n);
    return l && Math.abs(l.x - x) <= 1 && Math.abs(l.y - y) <= 1 ? n : 0;
  };
  C.atacar = n => PK.UI.openBarracks('exp', { cap: n });
  // al tocar el lugar en el mapa
  C.openLugar = function (n) {
    const c = C.cap(n);
    PK.UI.modal('lugar', c.lugar ? c.lugar.name : c.titulo, body => { body.append(el('p', null, 'Capítulo ' + U.roman(n) + ': ' + c.titulo + '.'), C.caja(n)); });
  };

  // ---------- Ganar, elegir ----------
  // Lo llama expeditions.js (cerrar) al ganar en el lugar del capítulo.
  C.ganar = function (n) {
    const st = S(), c = C.cap(n);
    if (!c || C.hecho(n)) return;
    st.campana.hechos[n] = 1;
    G().stat('chapters', 1);
    if (c.galeon) st.campana.galeon.push(c.galeon);
    if (c.eleccion) st.campana.pend = n;
    else st.campana.finPend = n;
    toast('¡Capítulo ' + U.roman(n) + ' cerrado: ' + c.titulo + '!' + (c.eleccion ? ' Te espera una decisión.' : ''), 'epic', c.eleccion ? { label: 'Decidir', fn: () => C.openEleccion(n) } : null);
  };
  C.elegir = function (n, i) {
    const st = S(), c = C.cap(n), op = c && c.eleccion && c.eleccion.ops[i];
    if (!op || st.campana.elec[n] !== undefined || !C.hecho(n)) return false;
    st.campana.elec[n] = i;
    aplicar(op);
    st.campana.pend = null;
    st.campana.finPend = n;
    return true;
  };
  function aplicar(op) {
    const st = S();
    if (op.res) G().give(op.res);
    if (op.militia) st.war.army.militia = (st.war.army.militia || 0) + op.militia;
    if (op.perk) { const p = (st.perks = st.perks || {}); for (const k in op.perk) p[k] = (p[k] || 0) + op.perk[k]; toast('Mejora permanente: ' + D.perkText(op.perk) + '.', 'epic'); }
    if (op.heroe && H()) unirse(op.heroe);
  }
  // un personaje de la campaña se une como héroe (el Rey Bandido, capítulo II)
  function unirse(id) {
    const P = D.PERSONAJES[id], e = S().heroes;
    const h = { id: e.nid++, clase: P.clase, nombre: P.name.replace(/^El |^La /, ''), mujer: !!P.mujer, semilla: P.semilla, rasgo: 'valiente', nivel: Math.min(H().tope(), 5 + 2 * S().era), xp: 0, talentos: [], equipo: {}, estado: 'libre', hasta: 0, gobierna: null };
    e.lista.push(h);
    G().stat('heroes_hired', 1);
    toast(h.nombre + ' se une a tu reino como ' + H().CLASES[h.clase].name.toLowerCase() + '.', 'epic', { label: 'Ver', fn: () => H().open('heroes', h.id) });
  }
  // Capítulo III: el tratado (se paga y se cierra sin pelear) o la batalla
  C.antes = function (n, i) {
    const st = S(), c = C.cap(n), op = c && c.antes && c.antes.ops[i];
    if (!op || C.hecho(n)) return false;
    if (op.costo && !G().canAfford(op.costo)) { toast('Te falta para el tratado.', 'warn'); return false; }
    if (op.costo) G().pay(op.costo);
    st.campana.rel[n] = op.rel;
    if (op.cierra) { C.ganar(n); st.campana.finPend = n; }
    return true;
  };

  // ---------- Bucle ----------
  let t1 = 0;
  C.tick = function (dt) {
    const st = S();
    if (!st || !st.campana || (t1 += dt) < 2) return;
    t1 = 0;
    const n = C.actual(), c = n && C.cap(n);
    if (c && c.lugar && !C.lugar(n)) { crearLugar(n); toast('Capítulo ' + U.roman(n) + ': apareció ' + c.lugar.name + ' cerca de tu reino.', 'quest', { label: 'Ver', fn: () => C.ir(n) }); }
    // el último capítulo no tiene batalla: se cierra cuando se cumple su misión
    if (c && !c.lugar && PK.Quests) { const q = D.QUESTS.find(o => o.id === 'c' + n + '_1'); if (q && ['ready', 'claimed'].includes(PK.Quests.status(q))) { C.ganar(n); st.flags.leyenda = 1; } }
    // escenas y decisiones: solo con el jugador mirando y sin otra ventana abierta
    if (G().offline || !PK.UI || PK.UI.modalKey() || (PK.Batalla && PK.Batalla.abierta && PK.Batalla.abierta())) return;
    if (c && !st.campana.vistos[c.ini]) { st.campana.vistos[c.ini] = 1; C.escena(c.ini); return; }
    // capítulo III: tratado o batalla, una vez después de la escena (después, desde el libro de misiones)
    if (c && c.antes && !st.campana.rel[n] && !st.campana.vistos['antes' + n]) { st.campana.vistos['antes' + n] = 1; C.openAntes(n); return; }
    if (st.campana.pend) { C.openEleccion(st.campana.pend); return; }
    const f = st.campana.finPend, cf = f && C.cap(f);
    if (cf && !st.campana.vistos[cf.fin]) { st.campana.vistos[cf.fin] = 1; st.campana.finPend = null; C.escena(cf.fin); }
  };

  // ---------- Ventanas ----------
  C.retrato = id => { const P = D.PERSONAJES[id]; return H() ? H().retratoEl({ clase: P.clase, semilla: P.semilla, mujer: !!P.mujer }, 'grande') : ''; };
  C.escena = function (id, luego) {
    const E = D.ESCENAS[id], P = D.PERSONAJES[E.quien];
    PK.UI.modal('escena', 'La Crónica del Reino', body => {
      body.append(el('div', { class: 'esc' }, el('div', { class: 'esc-ret' }, C.retrato(E.quien)),
        el('div', { class: 'esc-txt' }, el('div', { class: 'esc-quien' }, P.name), E.lineas.map(l => el('p', { class: 'esc-linea' }, '«' + l + '»')))));
      body.append(el('div', { class: 'row end' }, PK.UI.btn('Continuar', () => { PK.UI.closeModal(); if (luego) luego(); }, { cls: 'gold' })));
    });
  };
  C.ir = function (n) {
    const l = C.lugar(n);
    if (!l) return;
    PK.UI.closeModal();
    PK.Render.centerOn(l.x + 0.5, l.y + 0.5);
  };
  C.openEleccion = function (n) {
    const c = C.cap(n), st = S();
    PK.UI.modal('eleccion', 'Capítulo ' + U.roman(n) + ': ' + c.titulo, body => {
      body.append(el('p', null, c.eleccion.txt));
      body.append(el('div', { class: 'esc-ops' }, c.eleccion.ops.map((op, i) => el('div', { class: 'esc-op' }, el('b', null, op.label), el('span', { class: 'small' }, op.txt),
        op.res ? PK.UI.costEl(op.res, 1, true) : '',
        PK.UI.btn('Elegir', () => { if (C.elegir(n, i)) PK.UI.closeModal(); }, { small: true, cls: 'gold', disabled: st.campana.elec[n] !== undefined })))));
    }, { wide: true });
  };
  C.openAntes = function (n) {
    const c = C.cap(n);
    PK.UI.modal('antes', 'Capítulo ' + U.roman(n) + ': ' + c.titulo, body => {
      body.append(el('p', null, c.antes.txt));
      body.append(el('div', { class: 'esc-ops' }, c.antes.ops.map((op, i) => el('div', { class: 'esc-op' }, el('b', null, op.label), el('span', { class: 'small' }, op.txt),
        op.costo ? PK.UI.costEl(op.costo) : '',
        PK.UI.btn('Elegir', () => { if (C.antes(n, i)) { PK.UI.closeModal(); if (!op.cierra) C.ir(n); } }, { small: true, cls: 'gold', disabled: !!(op.costo && !G().canAfford(op.costo)) })))));
    }, { wide: true });
  };
  // La caja del capítulo en el libro de misiones (quests.js, en la misión c<N>_fin)
  C.caja = function (n) {
    const c = C.cap(n), st = S(), UI = PK.UI, box = el('div', { class: 'cap-box' });
    if (!c) return box;
    box.append(el('p', { class: 'small muted' }, 'Capítulo ' + U.roman(n) + ' de ' + D.CAPITULOS.length + ' · Era ' + U.roman(c.era)));
    const row = el('div', { class: 'row' });
    if (st.campana.vistos[c.ini]) row.append(UI.btn('Ver la escena', () => C.escena(c.ini), { small: true }));
    if (C.hecho(n) && st.campana.vistos[c.fin]) row.append(UI.btn('Epílogo', () => C.escena(c.fin), { small: true }));
    if (st.campana.pend === n) row.append(UI.btn('Decidir', () => C.openEleccion(n), { small: true, cls: 'gold' }));
    if (c.antes && !C.hecho(n) && !st.campana.rel[n] && C.abierto(n)) row.append(UI.btn('Tratado o batalla', () => C.openAntes(n), { small: true, cls: 'gold' }));
    if (c.lugar && C.abierto(n) && C.lugar(n)) {
      box.append(el('p', { class: 'small' }, el('b', null, c.lugar.name), ': ' + UI.enemyText(c.lugar.enemy) + ', fuerza aprox. ' + U.fmt(C.fuerza(n)) + '. Conviene llevar ' + (UI.bestVs(c.lugar.enemy) || 'de todo') + '.'));
      row.append(UI.btn('Ver en el mapa', () => C.ir(n), { small: true }), G().countB('barracks') ? UI.btn('Atacar', () => C.atacar(n), { small: true, cls: 'gold' }) : '');
    }
    if (C.hecho(n) && st.campana.elec[n] !== undefined && c.eleccion) box.append(el('p', { class: 'small good-t' }, 'Elegiste: ' + c.eleccion.ops[st.campana.elec[n]].label + '.'));
    box.append(row);
    return box;
  };
})();
