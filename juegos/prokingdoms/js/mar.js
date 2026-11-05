// El Nuevo Mundo (Fase 9, pk-25): el Galeón del Alba, la travesía y el motor de dos mundos.
//
// Un mundo vivo a la vez. La partida guardada es la del mundo activo y lleva dentro la del otro (`S.otro`), con su
// tema (`S.tema`: 'tierra' o 'mar'). Viajar guarda todo, intercambia los dos estados, los sube a la nube y recarga
// la página con el otro mundo: así cada sistema arranca limpio con su mapa (W.generate con tema). El mundo que se
// deja de mirar avanza al volver con el cálculo sin conexión de siempre (main.js mide el tiempo desde su lastSeen),
// así que el informe «Mientras no estabas» cuenta lo que pasó en la tierra mientras navegabas.
// Lo que es del jugador y no del mapa (el buzón del servidor) pasa de un estado al otro (COMPARTIDO).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const Mar = (PK.Mar = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);
  const COMPARTIDO = ['inboxAck', 'slot'];
  const VIAJE = 'pk_viaje';

  Mar.enMar = () => W.tema === 'mar';
  Mar.tema = () => W.tema || 'tierra';
  // el estado de la tierra: el activo, o el que espera dentro del archipiélago
  const tierra = () => (Mar.enMar() ? S().otro || null : S());
  Mar.piezas = () => { const t = tierra(); return (t && t.campana && t.campana.galeon) || []; };
  Mar.cronica = () => { const t = tierra(); return !!(t && t.campana && t.campana.hechos && t.campana.hechos[D.GALEON.ultimo]); };
  Mar.listo = () => D.GALEON.piezas.every(p => Mar.piezas().includes(p.id)) && Mar.cronica();
  Mar.conocido = () => !!(S().otro || S().flags.galeonDev);
  // el Galeón aparece en la Era VII, con el capítulo 6 abierto (o cuando ya tienes alguna pieza)
  Mar.visible = function () {
    if (Mar.enMar()) return true;
    const st = S(), c = st.campana;
    return !!(st.flags.galeonDev || Mar.piezas().length || (c && c.hechos && c.hechos[D.GALEON.aparece - 1] && st.era >= D.CAPITULOS[D.GALEON.aparece - 1].era) || st.otro);
  };

  // ---------- Dónde está ----------
  let lugar = null, lugarDe = null;
  // En la tierra: encallado en la orilla del lago grande más cercano a tu hogar. En el mar: fondeado frente a tu isla.
  Mar.lugar = function () {
    const clave = Mar.tema() + D.MY_SLOT;
    if (lugar && lugarDe === clave) return lugar;
    const [hx, hy] = D.PLAYER_HOME;
    let mejor = null, bd = 1e9;
    const orilla = (x, y) => W.inb(x, y) && W.terrain[W.idx(x, y)] !== 4 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W.inb(x + dx, y + dy) && W.terrain[W.idx(x + dx, y + dy)] === 4);
    if (Mar.enMar()) {
      // agua junto a la playa de tu isla, del lado más cercano al este
      for (let y = hy - 22; y <= hy + 22; y++) for (let x = hx - 22; x <= hx + 22; x++) {
        if (!W.inb(x, y) || W.terrain[W.idx(x, y)] !== 4 || !W.inb(x - 1, y) || W.terrain[W.idx(x - 1, y)] === 4) continue;
        const d = Math.hypot(x - (hx + 20), y - hy);
        if (d < bd) { bd = d; mejor = { x: x + 1.5, y: y + 0.5 }; }
      }
    } else {
      const lagos = (D.LAKES || []).map(L => ({ L, d: Math.hypot(L.x - hx, L.y - hy) - L.r * 6 })).sort((a, b) => a.d - b.d);
      const L = lagos.length ? lagos[0].L : null;
      if (L) for (let y = Math.floor(L.y - L.r * 2 - 3); y <= L.y + L.r * 2 + 3; y++) for (let x = Math.floor(L.x - L.r * 2 - 3); x <= L.x + L.r * 2 + 3; x++) {
        if (!orilla(x, y)) continue;
        const d = Math.hypot(x - hx, y - hy);
        if (d < bd) { bd = d; mejor = { x: x + 0.5, y: y + 0.5 }; }
      }
    }
    lugar = mejor || { x: hx + 8, y: hy + 8 };
    lugarDe = clave;
    return lugar;
  };
  Mar.en = (x, y) => { const l = Mar.visible() && Mar.lugar(); return !!l && Math.hypot(x - l.x, y - l.y) < 3; };

  // ---------- Dibujo ----------
  // Va a la lista de render.js (k: 'galeon'), así se ordena por profundidad y se toca como cualquier cosa del mapa.
  Mar.item = function (R, seen) {
    if (!Mar.visible()) return null;
    const l = Mar.lugar();
    if (!seen(l.x, l.y)) return null;
    const spr = Sp.galeon(Mar.enMar() || Mar.listo(), Mar.piezas()), [px, py] = R.iso(l.x, l.y);
    const bob = Mar.enMar() ? Math.round(Math.sin(performance.now() / 700) * 1.5) : 0;
    return { d: l.x + l.y + 2, k: 'galeon', o: {}, spr, x: Math.round(px - spr.ax), y: Math.round(py - spr.ay + bob) };
  };
  Mar.minimapa = function (ctx, toMM) {
    if (!Mar.visible()) return;
    const l = Mar.lugar(), i = W.idx(Math.floor(l.x), Math.floor(l.y));
    if (!W.fog[i]) return;
    const [x, y] = toMM(l.x, l.y);
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 3);
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 4, 1);
  };

  // ---------- Al cargar ----------
  // Llamado desde main.js después de UI.init: avisa de la llegada, descubre el Galeón la primera vez y, en el mar,
  // pone el cartel con el botón para volver.
  Mar.iniciar = function (viaje) {
    const st = S();
    const ll = st.flags.llegada;
    if (ll) { // lo que trajo el Galeón (pk-30)
      delete st.flags.llegada;
      const txt = Object.keys(ll.carga || {}).map(r => '+' + U.fmt(ll.carga[r]) + ' ' + D.RES[r].name.toLowerCase());
      setTimeout(() => toast('El Galeón descargó' + (txt.length ? ': ' + txt.join(', ') : '') + (ll.heroes && ll.heroes.length ? (txt.length ? '. ' : ' a ') + ll.heroes.join(' y ') + (ll.heroes.length > 1 ? ' bajan' : ' baja') + ' en ' + U.fmtTime(D.TRAVESIA_HEROE) + '.' : '.'), 'epic'), 1500);
    }
    if (Mar.enMar()) {
      document.body.classList.add('en-mar');
      // el agua alrededor de tu isla y el Galeón fondeado se ven desde el primer día
      const [hx, hy] = D.PLAYER_HOME, l = Mar.lugar();
      if (!st.flags.marRevelado) { st.flags.marRevelado = 1; G().revealAt(hx, hy, 26); }
      G().revealAt(l.x, l.y, 4);
      const hud = document.getElementById('hud');
      if (hud && !document.getElementById('mar-cartel')) hud.append(el('div', { id: 'mar-cartel' }, el('b', null, D.TEMAS.mar.name), el('span', { class: 'small', id: 'mar-cartel-era' }, ' · ' + D.eraName(st.era)),
        el('button', { class: 'btn small gold', onclick: () => Mar.abrir() }, el('img', { class: 'ico', src: Sp.icon('ancla'), alt: '' }), ' Galeón')));
      if (viaje && !st.flags.marVisto) {
        st.flags.marVisto = 1;
        toast('Llegaste al ' + D.TEMAS.mar.name + '. Aquí se pesca, se cortan teca y palmas, el coral sale con la marea baja y las otras islas se colonizan desde el Embarcadero. La Crónica del Mar te guía; el Galeón te espera para volver.', 'epic');
      } else if (viaje) toast('De vuelta en tu isla del ' + D.TEMAS.mar.name + '.', 'info');
      return;
    }
    document.body.classList.remove('en-mar');
    if (Mar.visible() && !st.flags.galeonVisto) {
      st.flags.galeonVisto = 1;
      const l = Mar.lugar();
      G().revealAt(l.x, l.y, 5);
      toast('Un galeón gigante encalló en la orilla del lago. Dicen que viene de las islas más allá de la bruma.', 'epic', { label: 'Ver', fn: () => { PK.Render.centerOn(l.x, l.y); Mar.abrir(); } });
    }
    if (viaje) toast('Volviste a tu reino.', 'info');
  };

  // ---------- Ventana ----------
  // Un adelanto del archipiélago, pintado por código: mar, islas con palmeras y bancos de bruma.
  function adelanto() {
    const c = el('canvas', { class: 'mar-adelanto', width: 320, height: 120 }), x = c.getContext('2d'), r = U.rng(4243);
    const g = x.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#9fd0e8'); g.addColorStop(0.35, '#4a9ac0'); g.addColorStop(1, '#1d5a84');
    x.fillStyle = g; x.fillRect(0, 0, 320, 120);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(Math.floor(r() * 320), 40 + Math.floor(r() * 80), 3 + Math.floor(r() * 5), 1); }
    for (const [ix, iy, ir] of [[70, 82, 34], [190, 70, 22], [270, 96, 26], [140, 104, 14]]) {
      x.fillStyle = '#e8d49a'; x.beginPath(); x.ellipse(ix, iy, ir, ir * 0.32, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#4e8a3a'; x.beginPath(); x.ellipse(ix, iy - 2, ir * 0.72, ir * 0.22, 0, 0, Math.PI * 2); x.fill();
      for (let k = 0; k < ir / 6; k++) { const px = ix - ir * 0.5 + r() * ir, py = iy - 4; x.fillStyle = '#7a5230'; x.fillRect(px, py - 9, 1, 9); x.fillStyle = '#3e8a34'; x.fillRect(px - 4, py - 10, 9, 2); }
    }
    x.fillStyle = 'rgba(230,236,240,0.45)';
    for (const [bx, by, bw] of [[20, 50, 120], [200, 40, 110], [110, 112, 140]]) { x.beginPath(); x.ellipse(bx + bw / 2, by, bw / 2, 6, 0, 0, Math.PI * 2); x.fill(); }
    const spr = Sp.galeon(true);
    x.imageSmoothingEnabled = false;
    x.drawImage(spr.c, 220, 18, spr.c.width * 0.75, spr.c.height * 0.75);
    return c;
  }
  Mar.abrir = function () {
    PK.UI.modal('galeon', 'El Galeón del Alba', body => {
      const piezas = Mar.piezas(), listo = Mar.listo(), enMar = Mar.enMar();
      body.append(el('div', { class: 'mar-top' }, adelanto(),
        el('p', { class: 'small' }, enMar ? 'Estás en tu isla del ' + D.TEMAS.mar.name + '. Tu reino de la tierra sigue ahí: cuando vuelvas, se calcula lo que pasó mientras navegabas.'
          : 'Un galeón de las islas más allá de la bruma. Los capítulos 6 a 9 de la Crónica dan sus piezas; con la Crónica completa, zarpa hacia el ' + D.TEMAS.mar.name + ': una segunda base en el mar, con otras islas, otra economía y barcos.')));
      body.append(el('h3', null, 'Piezas'), el('div', { class: 'mar-piezas' }, D.GALEON.piezas.map(p => {
        const ok = piezas.includes(p.id);
        return el('div', { class: 'mar-pieza' + (ok ? ' ok' : '') }, el('b', null, (ok ? '✓ ' : '') + p.name), el('span', { class: 'small muted' }, ok ? 'reparado' : 'capítulo ' + p.cap + ' de la Crónica'));
      }), el('div', { class: 'mar-pieza' + (Mar.cronica() ? ' ok' : '') }, el('b', null, (Mar.cronica() ? '✓ ' : '') + 'La Crónica completa'), el('span', { class: 'small muted' }, 'capítulo ' + D.GALEON.ultimo))));
      if (enMar || listo || S().flags.galeonDev) body.append(bodegaEl(), abordoEl());
      if (enMar) body.append(el('div', { class: 'row' }, PK.UI.btn('Volver al reino', () => Mar.viajar('tierra'), { cls: 'gold' })));
      else if (listo || S().flags.galeonDev) body.append(el('div', { class: 'row' }, PK.UI.btn(S().otro ? 'Zarpar a tu isla' : 'Zarpar al ' + D.TEMAS.mar.name, () => Mar.viajar('mar'), { cls: 'gold' }),
        !listo ? el('span', { class: 'small muted' }, ' (modo de prueba)') : ''));
      else body.append(el('p', { class: 'muted' }, 'Faltan ' + (D.GALEON.piezas.filter(p => !piezas.includes(p.id)).length + (Mar.cronica() ? 0 : 1)) + ' de 5. La travesía se abre al terminar la Crónica.'));
    }, { wide: true });
  };

  // ---------- La bodega y los héroes a bordo (pk-30) ----------
  // Lo que se elige aquí viaja en el próximo zarpe: se descuenta de este mundo y aparece en el otro al llegar.
  Mar.carga = {};
  Mar.abordo = [];
  const capLibre = () => D.CARGA.cap - Object.values(Mar.carga).reduce((s, v) => s + (v || 0), 0);
  function bodegaEl() {
    const st = S(), desde = D.CARGA.desde[Mar.tema()], box = el('div', { class: 'mar-bodega' });
    for (const r of Object.keys(Mar.carga)) if (!desde.includes(r)) delete Mar.carga[r];
    box.append(el('h3', null, 'Bodega del Galeón'), el('p', { class: 'small' }, Mar.enMar()
      ? 'Lleva a tu reino lo que solo da el archipiélago: la Maravilla pide especias y pólvora desde el nivel 20.'
      : 'Lleva al archipiélago lo que allá no se fabrica: acero para los galeones de guerra, herramientas y maquinaria para el Astillero del Maestro de Ribera.'),
    el('div', { class: 'small muted' }, 'Entran ' + D.CARGA.cap + ' unidades por viaje; quedan ' + capLibre() + '.'));
    for (const r of desde) {
      const tiene = Math.floor(st.res[r] || 0), v = Mar.carga[r] || 0;
      const pon = n => { Mar.carga[r] = U.clamp(n, 0, Math.min(tiene, v + capLibre())); PK.UI.rerender(); };
      box.append(el('div', { class: 'carga-fila' }, PK.UI.resIcon(r), el('b', null, D.RES[r].name), el('span', { class: 'small muted' }, 'tienes ' + U.fmt(tiene)),
        PK.UI.btn('−10', () => pon(v - 10), { small: true, disabled: !v }), el('b', { class: 'cm-n' }, String(v)), PK.UI.btn('+10', () => pon(v + 10), { small: true, disabled: v >= tiene || !capLibre() }),
        PK.UI.btn('Todo', () => pon(tiene), { small: true, disabled: v >= tiene || !capLibre() })));
    }
    return box;
  }
  function abordoEl() {
    const H = PK.Heroes, box = el('div', { class: 'mar-bodega' });
    const libres = H ? H.lista().filter(h => h.estado === 'libre') : [];
    Mar.abordo = Mar.abordo.filter(id => libres.some(h => h.id === id));
    box.append(el('h3', null, 'Héroes a bordo'), el('p', { class: 'small' }, 'Hasta ' + D.HEROES_ABORDO + ' héroes libres viajan contigo, con su equipo. Al llegar tardan ' + U.fmtTime(D.TRAVESIA_HEROE) + ' en bajar del Galeón. Cada héroe está en un solo mundo a la vez.'));
    if (!libres.length) { box.append(el('p', { class: 'small muted' }, 'No hay héroes libres en este mundo.')); return box; }
    box.append(el('div', { class: 'row' }, libres.map(h => {
      const on = Mar.abordo.includes(h.id);
      return PK.UI.btn((on ? '✓ ' : '') + h.nombre + ' (' + H.CLASES[h.clase].name + ')', () => {
        if (on) Mar.abordo = Mar.abordo.filter(x => x !== h.id); else if (Mar.abordo.length < D.HEROES_ABORDO) Mar.abordo.push(h.id); else toast('Caben ' + D.HEROES_ABORDO + ' héroes por viaje.', 'warn');
        PK.UI.rerender();
      }, { small: true, cls: on ? 'gold' : '' });
    })));
    return box;
  }
  function moverCarga(actual, otro) {
    const desde = D.CARGA.desde[actual.tema] || [], out = {};
    let tot = 0;
    for (const r in Mar.carga) {
      if (!desde.includes(r)) continue;
      const n = Math.min(Math.floor(Mar.carga[r] || 0), Math.floor(actual.res[r] || 0), D.CARGA.cap - tot);
      if (n <= 0) continue;
      actual.res[r] -= n; otro.res[r] = (otro.res[r] || 0) + n; out[r] = n; tot += n;
    }
    return out;
  }
  function moverHeroes(actual, otro) {
    const de = actual.heroes, out = [];
    if (!de || !Mar.abordo.length) return out;
    const a = (otro.heroes = otro.heroes || {});
    a.lista = a.lista || []; a.inv = a.inv || []; a.esencia = a.esencia || 0; a.tab = a.tab || { dia: '', tomados: [] }; a.nid = a.nid || 1;
    for (const id of Mar.abordo.slice(0, D.HEROES_ABORDO)) {
      const i = de.lista.findIndex(h => h.id === id && h.estado === 'libre');
      if (i < 0 || a.lista.length >= PK.Heroes.MAX) continue;
      const h = de.lista.splice(i, 1)[0], equipo = {};
      // su equipo viaja con él; los ids se rehacen en el otro mundo (cada uno numera los suyos)
      for (const ran in h.equipo || {}) { const j = de.inv.findIndex(it => it.id === h.equipo[ran]); if (j >= 0) { const it = de.inv.splice(j, 1)[0]; it.id = a.nid++; a.inv.push(it); equipo[ran] = it.id; } }
      Object.assign(h, { id: a.nid++, equipo, gobierna: null, run: null, estado: 'travesia', hasta: Date.now() + D.TRAVESIA_HEROE * 1000 });
      a.lista.push(h);
      out.push(h.nombre);
    }
    return out;
  }

  // ---------- La travesía ----------
  Mar.viajar = async function (destino) {
    const g = G();
    if (destino === Mar.tema()) return;
    if (PK.Batalla && PK.Batalla.abierta && PK.Batalla.abierta()) { toast('Termina la batalla antes de zarpar.', 'warn'); return; }
    if (destino === 'mar' && !Mar.listo() && !S().flags.galeonDev) { toast('El Galeón todavía no está listo.', 'warn'); return; }
    const actual = JSON.parse(g.serialize());
    let otro = actual.otro || null;
    delete actual.otro;
    actual.tema = Mar.tema();
    if (!otro) otro = nuevoMundo(destino);
    for (const k of COMPARTIDO) otro[k] = actual[k];
    // pk-30: la bodega y los héroes a bordo
    const carga = moverCarga(actual, otro), heroes = moverHeroes(actual, otro);
    if (Object.keys(carga).length || heroes.length) { otro.flags = otro.flags || {}; otro.flags.llegada = { carga, heroes }; }
    Mar.carga = {}; Mar.abordo = [];
    otro.tema = destino;
    otro.otro = actual;
    otro.at = Date.now();
    g.noSave = true; // que el «al cerrar» no pise lo que se guarda aquí
    PK.UI.closeModal();
    g.guardarObjeto(otro);
    if (PK.Net && PK.Net.online) { toast('Guardando los dos mundos…', 'info'); await PK.Net.saveCloudObj(otro); }
    try { sessionStorage.setItem(VIAJE, destino); } catch (e) { /* sin sessionStorage solo falta el aviso */ }
    location.reload();
  };
  // Un mundo del archipiélago nuevo: un estado de partida con su tema y sus recursos de inicio. La isla, el Centro
  // Urbano y los primeros colonos los pone G.init al cargarlo (setupPlayer, porque no tiene edificios).
  function nuevoMundo(tema) {
    const o = G().newState();
    o.tema = tema;
    if (D.TEMAS[tema] && D.TEMAS[tema].inicio) Object.assign(o.res, D.TEMAS[tema].inicio);
    return o;
  }
  // main.js: ¿esta carga viene de una travesía? (para el aviso de llegada)
  Mar.viaje = function () { try { const v = sessionStorage.getItem(VIAJE); sessionStorage.removeItem(VIAJE); return v; } catch (e) { return null; } };
})();
