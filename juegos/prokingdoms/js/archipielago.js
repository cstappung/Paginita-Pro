// El Archipiélago de Bruma en juego (Fase 9, entrega «b», pk-28): colonias en las otras islas, la Casa de comercio y
// la marea en la barra de arriba. Solo hace algo en el mar (G.enMar()); en la tierra sus funciones no se llaman.
//
// Colonias: el Embarcadero de colonos arma un barco que lleva colonos (aldeanos que dejan tu isla) y materiales a
// una isla con rasgo. La travesía tarda según la distancia y se cuenta por la hora real (S.colonias[].llega), así que
// también termina sin conexión. Al llegar: la isla se descubre, pasa a ser tu territorio (sus parcelas, que se
// reponen en cada carga desde S.colonias porque el mapa se rearma) y aparece el Muelle de la colonia, el acopio de
// esa isla. Los aldeanos de cada isla dejan lo que juntan en un acopio de su misma isla (G.findDrop usa islaDe).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const A = (PK.Arch = {});
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const toast = (t, k, act) => PK.UI && PK.UI.toast(t, k, act);

  // ---------- Islas ----------
  // índice de la isla (en W.islas) que contiene ese punto, o -1 en el agua lejos de todo
  A.islaDe = function (x, y) {
    const L = W.islas;
    if (!L) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < L.length; i++) {
      const I = L[i], d = Math.hypot(x - I.x, y - I.y);
      if (d < I.r * 1.6 + 2 && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  A.islas = () => (W.islas || []).map((I, i) => ({ i, I, def: D.ISLAS[I.k] || null })).filter(o => o.def);
  A.colonia = i => (S().colonias || []).find(c => c.isla === i);
  A.coloniasHechas = () => (S().colonias || []).filter(c => c.ok).length;
  A.maxColonias = () => G().best('embarcadero', 'colonias') || 0;
  const embarcadero = () => G().buildings.find(b => b.owner === 'p' && b.type === 'embarcadero' && b.done);

  A.init = function (st) {
    if (!G().enMar()) return;
    st.colonias = st.colonias || [];
    // el Capataz reparte entre los recursos del mar (con sus nombres de acá)
    const Au = PK.Auto;
    Au.RES = ['food', 'wood', 'stone', 'gold', 'fibra', 'salitre', 'especias'];
    for (const k of ['ore', 'marble', 'gems', 'dig']) delete Au.JOBS[k];
    for (const r of Au.RES) Au.JOBS[r] = Object.assign({}, Au.JOBS[r], { name: D.RES[r].name, icon: r });
    Au.JOBS.food.hint = 'cabañas de pescadores libres o almejas';
    Au.JOBS.salitre.hint = 'salinas libres o salitrales';
    const w = st.auto.w;
    if (w.fibra === undefined) Object.assign(w, { fibra: 2, salitre: 1, especias: 0, ore: 0, marble: 0, gems: 0 });
    for (const c of st.colonias) if (c.ok) territorio(c.isla);
  };
  function territorio(i) {
    const I = W.islas && W.islas[i];
    if (!I || !W.terr) return;
    const P = W.PW, R = I.r + 3;
    for (let py = 0; py < P; py++) for (let px = 0; px < P; px++) {
      const cx = (px + 0.5) * D.PARCEL, cy = (py + 0.5) * D.PARCEL;
      if (Math.hypot(cx - I.x, cy - I.y) <= R + D.PARCEL * 0.5) W.terr[py * P + px] = D.MY_SLOT + 1;
    }
    W.terrVer++;
  }

  // ---------- Fundar ----------
  A.porQueNo = function (i) {
    const st = S(), I = W.islas[i], e = embarcadero();
    if (!e) return 'Construye el Embarcadero de colonos.';
    if (A.colonia(i)) return A.colonia(i).ok ? 'Ya es tu colonia.' : 'El barco ya va en camino.';
    if ((st.colonias || []).length >= A.maxColonias()) return 'Tu Embarcadero admite ' + A.maxColonias() + (A.maxColonias() === 1 ? ' colonia' : ' colonias') + ': súbelo de nivel para fundar más.';
    if (A.colonos().length < D.colonia.colonos + 2) return 'Necesitas al menos ' + (D.colonia.colonos + 2) + ' colonos en tu isla (se van ' + D.colonia.colonos + ').';
    if (!G().canAfford(A.costo())) return 'Te faltan materiales para el barco.';
    return I ? null : 'Esa isla no existe.';
  };
  A.costo = () => D.colonia.costo((S().colonias || []).length);
  A.viaje = i => { const I = W.islas[i], [hx, hy] = D.PLAYER_HOME; return D.colonia.viaje(Math.hypot(I.x - hx, I.y - hy)); };
  // los colonos salen de tu isla (la de casa): primero los que no hacen nada
  A.colonos = () => G().units.filter(u => u.owner === 'p' && u.kind === 'v' && !u.inside && A.islaDe(u.x, u.y) === 0)
    .sort((a, b) => (a.task ? 1 : 0) - (b.task ? 1 : 0));
  A.fundar = function (i) {
    const why = A.porQueNo(i);
    if (why) { toast(why, 'warn'); return false; }
    const g = G(), st = S(), costo = A.costo();
    if (!g.pay(costo)) return false;
    const van = A.colonos().slice(0, D.colonia.colonos);
    for (const u of van) g.removeUnit(u);
    const ahora = Date.now();
    st.colonias.push({ isla: i, k: W.islas[i].k, n: van.length, sale: ahora, llega: ahora + A.viaje(i) * 1000, ok: false });
    toast('Zarpó el barco de colonos hacia la ' + D.ISLAS[W.islas[i].k].name + '. Llega en ' + U.fmtTime(A.viaje(i)) + '.', 'good');
    return true;
  };
  function llegar(c) {
    const g = G(), I = W.islas[c.isla];
    c.ok = true;
    g.revealAt(I.x, I.y, I.r + 6);
    territorio(c.isla);
    // el muelle de la colonia va en la playa, mirando hacia tu isla
    const [hx, hy] = D.PLAYER_HOME, ang = Math.atan2(hy - I.y, hx - I.x);
    let p = null;
    for (let d = I.r * 0.75; d >= 0 && !p; d -= 1) p = W.findFreeRect(I.x + Math.cos(ang) * d - 1, I.y + Math.sin(ang) * d - 1, 2, 2, 3, true);
    const b = p ? g.addBuilding('colonia', 'p', p[0], p[1], true) : null;
    if (b) for (let k = 0; k < c.n; k++) g.spawnVillager(b);
    g.stat('colonias', 1);
    toast('¡Fundaste una colonia en la ' + D.ISLAS[c.k].name + '! Tus colonos ya trabajan ahí (' + D.ISLAS[c.k].rasgo + ').', 'epic', b ? { label: 'Ver', fn: () => PK.Render.centerOn(b.cx, b.cy) } : null);
  }
  // Más colonos para una colonia que ya existe: dos por viaje, por comida.
  A.REFUERZO = { n: 2, costo: { food: 150, wood: 60 } };
  A.reforzar = function (i) {
    const c = A.colonia(i), g = G();
    if (!c || !c.ok) return false;
    if (c.refuerzo && c.refuerzo > Date.now()) { toast('Ya va un barco con colonos a esa isla.', 'info'); return false; }
    if (A.colonos().length < A.REFUERZO.n + 2) { toast('Te quedan pocos colonos en tu isla.', 'warn'); return false; }
    if (!g.pay(A.REFUERZO.costo)) { toast('Te falta comida o teca para el viaje.', 'warn'); return false; }
    for (const u of A.colonos().slice(0, A.REFUERZO.n)) g.removeUnit(u);
    c.refuerzo = Date.now() + A.viaje(i) * 1000;
    c.refN = A.REFUERZO.n;
    toast('Zarpó un barco con ' + A.REFUERZO.n + ' colonos más.', 'good');
    return true;
  };

  // ---------- Cada cuadro (solo en el mar) ----------
  let tUI = 0;
  A.tick = function (dt) {
    const st = S(), ahora = Date.now();
    for (const c of st.colonias || []) {
      if (!c.ok && ahora >= c.llega) llegar(c);
      if (c.refuerzo && ahora >= c.refuerzo) {
        const b = G().buildings.find(o => o.owner === 'p' && o.type === 'colonia' && A.islaDe(o.cx, o.cy) === c.isla);
        if (b) for (let k = 0; k < (c.refN || 0); k++) G().spawnVillager(b);
        c.refuerzo = 0; c.refN = 0;
      }
    }
    if ((tUI -= dt) <= 0) {
      tUI = 1; pintarMarea();
      const ce = document.getElementById('mar-cartel-era');
      if (ce) ce.textContent = ' · ' + D.eraName(S().era);
    }
  };

  // ---------- La marea en la barra ----------
  let mareaEl = null;
  function pintarMarea() {
    if (!mareaEl) {
      const bar = document.getElementById('topbar');
      if (!bar) return;
      mareaEl = el('button', { class: 'marea', title: 'La marea', onclick: () => A.abrirMarea() });
      const era = bar.querySelector('.era');
      if (era && era.nextSibling) bar.insertBefore(mareaEl, era.nextSibling); else bar.append(mareaEl);
    }
    const m = D.marea(), baja = D.mareaBaja(), falta = D.mareaCambia();
    mareaEl.className = 'marea ' + (baja ? 'baja' : 'alta');
    mareaEl.innerHTML = '';
    mareaEl.append(el('span', { class: 'ola', style: { '--m': m.toFixed(2) } }), el('span', null, baja ? 'Bajamar' : m > 0.75 ? 'Pleamar' : 'Marea alta'), el('small', null, (baja ? 'sube en ' : 'baja en ') + U.fmtTime(falta)));
  }
  A.abrirMarea = function () {
    PK.UI.modal('marea', 'La marea', body => {
      const m = D.marea(), baja = D.mareaBaja();
      body.append(el('p', null, 'Ahora: ', el('b', null, baja ? 'bajamar' : 'marea alta'), ' (' + Math.round(m * 100) + '%). ', (baja ? 'Sube' : 'Baja') + ' en ' + U.fmtTime(D.mareaCambia()) + '.'),
        el('ul', { class: 'small' },
          el('li', null, 'Con la marea baja asoman los arrecifes: tus colonos sacan coral. Con la alta lo esperan al lado.'),
          el('li', null, 'La pesca sigue al agua: con pleamar rinde hasta un 25% más y con bajamar, un 25% menos.'),
          el('li', null, 'Un ciclo dura ' + U.fmtTime(D.MAREA_MS / 1000) + ' y sale del reloj real: es igual en vivo, sin conexión y para todos.')));
      const c = el('canvas', { class: 'marea-curva', width: 300, height: 70 }), x = c.getContext('2d'), t0 = Date.now();
      x.fillStyle = '#0e2a3a'; x.fillRect(0, 0, 300, 70);
      x.fillStyle = 'rgba(232,184,74,0.18)'; x.fillRect(0, 70 - D.MAREA_BAJA * 60 - 5, 300, D.MAREA_BAJA * 60 + 5);
      x.strokeStyle = '#7ac8f0'; x.lineWidth = 2; x.beginPath();
      for (let i = 0; i <= 300; i++) { const v = D.marea(t0 + (i / 300) * D.MAREA_MS * 1.5); const y = 65 - v * 60; if (i) x.lineTo(i, y); else x.moveTo(i, y); }
      x.stroke();
      x.fillStyle = '#fff'; x.fillRect(0, 65 - m * 60 - 2, 4, 4);
      body.append(c, el('p', { class: 'small muted' }, 'Las próximas ' + U.fmtTime(D.MAREA_MS * 1.5 / 1000) + '. La franja dorada es la bajamar.'));
    });
  };

  // ---------- Ventanas ----------
  A.abrirEmbarcadero = function () {
    PK.UI.modal('embarcadero', 'Embarcadero de colonos', body => {
      const e = embarcadero(), st = S(), costo = A.costo();
      body.append(el('p', null, 'Cada colonia es una isla nueva para tu reino: llevan ' + D.colonia.colonos + ' colonos de tu isla y fundan su propio muelle. Colonias: ',
        el('b', null, A.coloniasHechas() + ' de ' + A.maxColonias()), (e ? '' : ' (construye el Embarcadero).')));
      body.append(el('div', { class: 'row small' }, el('b', null, 'El próximo barco: '), PK.UI.costEl(costo)));
      const lista = el('div', { class: 'islas-lista' });
      for (const { i, I, def } of A.islas()) {
        const c = A.colonia(i), why = A.porQueNo(i), [hx, hy] = D.PLAYER_HOME;
        const estado = c ? (c.ok ? el('span', { class: 'ok small' }, '✓ Tu colonia') : el('span', { class: 'small' }, '⛵ Llega en ' + U.fmtTime(Math.max(0, (c.llega - Date.now()) / 1000)))) : '';
        lista.append(el('div', { class: 'isla-fila' + (c && c.ok ? ' tuya' : '') },
          el('img', { class: 'ico', src: Sp.icon(def.icon), alt: '' }),
          el('div', null, el('b', null, def.name), el('div', { class: 'small muted' }, 'Rasgo: ' + def.rasgo + ' · a ' + Math.round(Math.hypot(I.x - hx, I.y - hy)) + ' casillas · viaje ' + U.fmtTime(A.viaje(i)))),
          estado || PK.UI.btn('Fundar', () => { A.fundar(i); PK.UI.rerender(); }, { small: true, cls: 'gold', disabled: !!why, title: why || 'Zarpar con los colonos' }),
          c && c.ok ? PK.UI.btn('+' + A.REFUERZO.n + ' colonos', () => { A.reforzar(i); PK.UI.rerender(); }, { small: true, title: 'Cuesta ' + A.REFUERZO.costo.food + ' de pescado y ' + A.REFUERZO.costo.wood + ' de teca', disabled: !!(c.refuerzo && c.refuerzo > Date.now()) }) : '',
          c && c.ok ? PK.UI.btn('Ver', () => { PK.UI.closeModal(); PK.Render.centerOn(I.x, I.y); }, { small: true }) : ''));
        if (!c && why) lista.lastChild.append(el('div', { class: 'small warn-t isla-por' }, why));
      }
      body.append(lista);
    }, { wide: true });
  };

  A.abrirComercio = function () {
    PK.UI.modal('comercio', 'Casa de comercio', body => {
      const b = G().buildings.find(o => o.owner === 'p' && o.type === 'comercio' && o.done), st = S();
      if (!b) { body.append(el('p', null, 'Construye la Casa de comercio (Era III).')); return; }
      const s = G().bst(b);
      body.append(el('p', null, 'Compra y vende lo de las islas por oro. Comprar cuesta ' + Math.round(s.buy * 100) + '% del precio y vender paga ' + Math.round(s.sell * 100) + '% (mejora con el nivel). Las especias valen mucho.'));
      const t = el('div', { class: 'comercio-mar' });
      for (const r in D.COMERCIO_MAR) {
        const base = D.COMERCIO_MAR[r], compra = Math.max(1, Math.round(base * s.buy * 10)), venta = Math.max(1, Math.floor(base * s.sell * 10));
        t.append(el('div', { class: 'cm-fila' }, el('img', { class: 'ico', src: Sp.icon(r), alt: '' }), el('b', null, D.RES[r].name), el('span', { class: 'small muted' }, 'tienes ' + U.fmt(st.res[r] || 0)),
          PK.UI.btn('Vender 10 (+' + venta + ' oro)', () => { A.tratar(r, -10); PK.UI.rerender(); }, { small: true, disabled: (st.res[r] || 0) < 10 }),
          PK.UI.btn('Comprar 10 (−' + compra + ' oro)', () => { A.tratar(r, 10); PK.UI.rerender(); }, { small: true, disabled: (st.res.gold || 0) < compra })));
      }
      body.append(t);
    }, { wide: true });
  };
  // n > 0 compra, n < 0 vende (de a 10). Todo entra entero, aunque pase la bodega (la regla de los tratos).
  A.tratar = function (r, n) {
    const b = G().buildings.find(o => o.owner === 'p' && o.type === 'comercio' && o.done), st = S();
    if (!b || !D.COMERCIO_MAR[r] || Math.abs(n) !== 10) return false;
    const s = G().bst(b), base = D.COMERCIO_MAR[r];
    if (n > 0) {
      const p = Math.max(1, Math.round(base * s.buy * 10));
      if ((st.res.gold || 0) < p) return false;
      st.res.gold -= p; st.res[r] = (st.res[r] || 0) + 10;
    } else {
      if ((st.res[r] || 0) < 10) return false;
      st.res[r] -= 10; st.res.gold = (st.res.gold || 0) + Math.max(1, Math.floor(base * s.sell * 10));
    }
    G().stat('comercio_mar', 1);
    return true;
  };

  // ---------- Dibujo: barcos de colonos en camino ----------
  A.items = function (R, seen) {
    if (!G().enMar()) return [];
    const out = [], ahora = Date.now(), [hx, hy] = D.PLAYER_HOME, col = Sp.ownerColor('p');
    for (const c of S().colonias || []) {
      const I = W.islas[c.isla];
      for (const [a, z] of [[c.ok ? 0 : c.sale, c.ok ? 0 : c.llega], [c.refuerzo ? c.refuerzo - A.viaje(c.isla) * 1000 : 0, c.refuerzo || 0]]) {
        if (!z || ahora >= z) continue;
        const f = U.clamp((ahora - a) / (z - a), 0, 1), x = hx + (I.x - hx) * f, y = hy + (I.y - hy) * f;
        if (!seen(x, y)) continue;
        const spr = Sp.barcoColonos(col, I.x < hx), [px, py] = R.iso(x, y), bob = Math.round(Math.sin(ahora / 600 + c.isla) * 1.5);
        out.push({ d: x + y + 1, k: 'barco', o: {}, spr, x: Math.round(px - spr.ax), y: Math.round(py - spr.ay + bob) });
      }
    }
    return out;
  };
})();
