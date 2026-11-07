// El Pase del Reino en el juego (Fase 8): la ventana, el botón de la barra de arriba, los premios que llegan por el
// buzón y los aspectos. Los datos están en js/pase.js; los puntos y los premios los decide el servidor (sim.js),
// así que sin conexión el pase dice «Requiere conexión». Comprar la pista dorada lo hace la página de Juegos
// (sitio.js → cartero → pkPase/<uid>/<período>); aquí solo se pide y después se le avisa al servidor.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const el = (...a) => U.el(...a);
  const P = (PK.Pase = { info: null });
  let doradoVisto = false;

  P.dorado = () => !!(P.info && P.info.dorado && P.info.n === D.paseDe(Date.now()));
  P.online = () => !!(PK.Net && PK.Net.online && P.info);
  // la pista dorada cambia bonos de tiempo (vida.js): se recalculan cuando cambia
  P.revisar = function () { const d = P.dorado(); if (d !== doradoVisto) { doradoVisto = d; if (PK.Vida) PK.Vida.invalidar(); } };

  // ---------- Premios del buzón ----------
  P.recibir = function (it) {
    const st = S(), g = G(), pr = it.pase || {}, H = PK.Heroes;
    if (it.res) g.give(it.res);
    if (pr.gemas) g.give({ gems: pr.gemas });
    if (pr.esencia && st.heroes) st.heroes.esencia = (st.heroes.esencia || 0) + pr.esencia;
    if (pr.especial) { const sp = D.SPECIAL.slice().sort((a, b) => (st.res[a] || 0) - (st.res[b] || 0))[0]; g.give({ [sp]: pr.especial }); }
    if (pr.objeto && H && st.heroes) for (let i = 0; i < (pr.objeto >= 3 ? 1 : 1); i++) { const o = H.crearObjeto(0.5 + st.era / 20, pr.objeto - 1); if (o.r < pr.objeto - 1) o.r = pr.objeto - 1; H.guardarObjeto(o); }
    if ((pr.curar || pr.pocion) && H && st.heroes) for (const h of H.lista()) if (h.estado === 'herido') { h.estado = 'libre'; h.hasta = 0; if (pr.pocion) break; }
    for (const a of [pr.aspecto, pr.aspecto2]) if (a) P.darAspecto(a);
    g.stat('pase_premios', 1);
    UI.toast('👑 ' + it.text, 'epic');
  };
  // un aspecto repetido (el tema volvió al año) se cambia por esencia y gemas del mismo valor
  P.darAspecto = function (id) {
    const st = S();
    st.aspectos = st.aspectos || {};
    if (st.aspectos[id]) { G().give({ gems: 25 }); if (st.heroes) st.heroes.esencia = (st.heroes.esencia || 0) + 40; UI.toast('Ya tenías ese aspecto: te llegan 25 gemas y 40 de esencia en su lugar.', 'info'); return; }
    st.aspectos[id] = Date.now();
    const a = D.aspecto(id);
    // los de edificio, tropa y decoración se ponen solos la primera vez; el resto, si no usabas otro
    // (el estandarte y el marco no le quitan el lugar a uno de la tienda). Se cambian en Reino → Aspectos.
    if (a && ['edificio', 'tropa', 'deco'].includes(a.tipo) && a.o) st.flags['asp_' + (a.o.b || a.o.t)] = id;
    const t = st.tienda || {};
    if (a && a.tipo === 'estandarte' && !t.color) st.flags.aspEstandarte = id;
    if (a && a.tipo === 'marco' && !t.marco && !st.flags.aspMarco) st.flags.aspMarco = id;
    if (a && a.tipo === 'efecto' && !st.flags.aspEfecto) st.flags.aspEfecto = id;
    if (a && a.tipo === 'barco' && !st.flags.aspBarco) st.flags.aspBarco = id;
    P.aplicar();
    if (a && a.tipo !== 'heroe' && a.tipo !== 'heroe2') UI.toast('✦ Nuevo aspecto: ' + P.nombre(id) + '. Elige dónde usarlo en Reino → Aspectos.', 'info', { label: 'Aspectos', fn: () => UI.openAspectos && UI.openAspectos() });
  };

  // ---------- Aspectos: cómo se ven ----------
  // edificio/deco: Sp.aspectoEdificio(tipo, {col, techo}); tropa: Sp.colorTropa; estandarte: el color del reino.
  P.aplicar = function () {
    const st = S();
    if (!st || !Sp.aspectoEdificio) return;
    const tipos = {};
    for (const k in st.flags) if (k.startsWith('asp_') && st.flags[k]) { const a = D.aspecto(st.flags[k]); if (a && a.o) tipos[k.slice(4)] = a; }
    for (const t in D.BUILD) { const a = tipos[t]; Sp.aspectoEdificio(t, a && (a.tipo === 'edificio' || a.tipo === 'deco') ? { col: a.o.col || a.T.col, techo: a.o.techo || null, id: st.flags['asp_' + t] } : null); }
    for (const t in D.ARMY) { const a = tipos[t]; Sp.colorTropa(t, a && a.tipo === 'tropa' ? a.o.col : null); }
    const e = st.flags.aspEstandarte && D.aspecto(st.flags.aspEstandarte);
    if (e && !(st.tienda && st.tienda.color) && Sp.colorPropio) Sp.colorPropio(e.T.col);
    // pk-36: el marco de los retratos (si no usas uno de la tienda) y las velas de tus barcos
    const m = st.flags.aspMarco && D.aspecto(st.flags.aspMarco);
    if (!(st.tienda && st.tienda.marco) && typeof document !== 'undefined' && document.documentElement) document.documentElement.style.setProperty('--marco', m ? P.marcoCss(m) : 'transparent');
    const bc = st.flags.aspBarco && D.aspecto(st.flags.aspBarco);
    if (PK.Armada && PK.Armada.aspecto) PK.Armada.aspecto(bc ? bc.T.col : null, bc ? st.flags.aspBarco : null);
  };
  // el marco del Pase es el color del tema aclarado, como los de las escaleras (datos-vida.js)
  P.marcoCss = a => 'rgb(' + a.T.col.map(v => Math.min(255, Math.round(v * 1.35 + 30))).join(',') + ')';
  // el color del efecto de habilidad en uso (batalla.js), en [r, g, b]
  P.efectoCol = function () {
    const st = S(), a = st && st.flags && st.flags.aspEfecto && D.aspecto(st.flags.aspEfecto);
    const h = a && a.o && /^#([0-9a-f]{6})$/i.exec(a.o.col || '');
    return h ? [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)) : null;
  };
  P.nombre = function (id) {
    const a = D.aspecto(id);
    if (!a) return id;
    // «Estandarte del Carnaval», «Marco de Invierno»; los que no empiezan con «De» van entre comillas: «Imperial»
    const n = a.T.name, de = /^De(l)? /.test(n) ? n[0].toLowerCase() + n.slice(1) : '«' + n + '»';
    return a.tipo === 'marco' ? 'Marco ' + de : a.tipo === 'estandarte' ? 'Estandarte ' + de : a.tipo === 'heroe2' ? a.o.name + ' (variante)' : a.o ? a.o.name : n;
  };
  P.aspectosDe = tipo => Object.keys(S().aspectos || {}).filter(id => { const a = D.aspecto(id); return a && (a.tipo === tipo || (tipo === 'heroe' && a.tipo === 'heroe2')); });

  // ---------- Pedidos al servidor ----------
  async function pide(ruta, body) {
    try {
      const r = await PK.Net.api('POST', ruta, body || {});
      if (r.pase) P.info = r.pase;
      if (r.inbox && PK.Net.applyInbox) PK.Net.applyInbox(r.inbox);
      P.revisar();
      UI.rerender();
      return r;
    } catch (e) { UI.toast((e && e.message) || 'No se pudo hablar con el servidor.', 'warn'); return null; }
  }
  P.reclamar = (nivel, pista) => pide('/api/pase/claim', { nivel, pista });
  P.refrescar = () => pide('/api/pase/refresh');
  P.comprar = async function () {
    if (!PK.Platform.comprarPase) { UI.toast('La pista dorada se compra desde Juegos, con tu cuenta.', 'warn'); return; }
    const ok = await PK.Platform.comprarPase(D.paseDe(Date.now()));
    if (!ok) return;
    UI.toast('¡Pista dorada desbloqueada! Avisando al servidor…', 'epic');
    // la compra tarda un momento en estar en la base: se reintenta un par de veces
    for (let i = 0; i < 4 && !P.dorado(); i++) { await pide('/api/pase/refresh'); if (!P.dorado()) await new Promise(r => setTimeout(r, 1500)); }
  };

  // ---------- Barra de arriba ----------
  P.barEl = function () {
    const b = el('button', { class: 'res pase-btn', onclick: () => P.open() });
    const pinta = () => {
      const i = P.info;
      b.textContent = '👑 ' + (i ? i.nivel + '/30' : 'Pase');
      b.classList.toggle('dorado', P.dorado());
      const listos = i ? reclamables().length : 0;
      b.classList.toggle('listo', listos > 0);
      b.title = i ? 'Pase del Reino: nivel ' + i.nivel + ' de 30' + (listos ? ' · ' + listos + ' premios para reclamar' : '') : 'Pase del Reino (requiere conexión)';
      P.revisar();
    };
    pinta();
    setInterval(pinta, 3000);
    return b;
  };
  function reclamables() {
    const i = P.info, out = [];
    if (!i) return out;
    for (let n = 1; n <= 30; n++) {
      if (i.nivel >= n && !i.cg[n]) out.push([n, 'g']);
      if (i.dorado && i.nivel >= n && !i.cd[n]) out.push([n, 'd']);
    }
    if (i.dorado) for (let k = 1; k <= i.extras; k++) if (!i.cd[30 + k]) out.push([30 + k, 'd']);
    return out;
  }

  // ---------- Ventana ----------
  P.open = function () {
    UI.modal('pase', 'Pase del Reino', body => {
      const i = P.info, st = S();
      if (!PK.Net || !PK.Net.online || !i) {
        body.append(el('p', null, 'El Pase del Reino requiere conexión con el mundo compartido: los puntos y los premios los lleva el servidor.'), el('p', { class: 'small muted' }, 'Entra desde Juegos con tu cuenta para jugarlo.'));
        return;
      }
      const T = D.PASE_TEMAS[i.tema], falta = Math.max(0, (i.fin - Date.now()) / 1000);
      const sig = i.nivel >= 30 ? null : (i.nivel + 1) * D.PASE.pp;
      body.append(el('div', { class: 'pase-top' + (P.dorado() ? ' dorado' : '') },
        el('div', null, el('b', null, 'Pase ' + (T ? '«' + T.name + '»' : '') + ' · nivel ' + i.nivel + ' de 30'),
          el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: (sig ? ((i.pp % D.PASE.pp) / D.PASE.pp) * 100 : 100) + '%' } }), el('span', null, U.fmt(i.pp) + ' PP' + (sig ? ' · faltan ' + (sig - i.pp) + ' para el ' + (i.nivel + 1) : ''))),
          el('p', { class: 'small muted' }, 'Termina en ' + U.fmtTime(falta) + '. Hoy llevas ' + i.ppHoy + ' de ' + i.tope + ' PP posibles. Lo ganado y no reclamado se entrega solo al terminar.')),
        P.dorado() ? el('span', { class: 'pase-oro' }, '★ Pista dorada') : UI.btn('Desbloquear pista dorada (2.500 monedas de Juegos)', () => P.comprar(), { cls: 'gold' })));
      if (!P.dorado()) body.append(el('p', { class: 'small' }, 'La pista dorada da premios mejores, los aspectos del tema y, durante el pase: mejoras e investigación 15% más rápidas, +1 en la cola del Mayordomo y heridas de héroe 30% más cortas. No da puntos, niveles, fuerza ni recolección.'));
      const rc = reclamables();
      if (rc.length) body.append(UI.btn('Reclamar todo (' + rc.length + ')', async () => { for (const [n, p] of rc) await P.reclamar(n, p); }, { cls: 'gold' }));
      // las dos pistas
      const pista = el('div', { class: 'pase-pistas' });
      for (let n = 1; n <= 30; n++) pista.append(nivelEl(n));
      if (i.dorado) for (let k = 1; k <= D.PASE.extraMax; k++) pista.append(nivelEl(30 + k));
      body.append(pista);
      // retos
      body.append(el('h3', null, 'Retos de hoy'), el('div', { class: 'pase-retos' }, i.diarios.map(retoEl)));
      body.append(el('h3', null, 'Retos del pase'), el('div', { class: 'pase-retos' }, i.retos.map(retoEl)));
      body.append(el('p', { class: 'small muted' }, 'También suman puntos (con tope por día): 5 por mejora de edificio, 10 por expedición ganada y 2 por aldeano entrenado.'));
      // aspectos
      const mios = Object.keys(st.aspectos || {});
      body.append(el('h3', null, 'Tus aspectos (' + mios.length + ')'), mios.length ? el('div', { class: 'row wrap' }, mios.map(id => aspectoEl(id))) : el('p', { class: 'small muted' }, 'Los aspectos del tema salen en la pista dorada. Cada tema vuelve una vez al año, en la misma quincena.'));
      if (mios.length && UI.openAspectos) body.append(el('div', { class: 'row' }, UI.btn('Administrar aspectos', () => UI.openAspectos(), { cls: 'gold' }), el('span', { class: 'small muted' }, 'Elige cuáles usar, por tipo o edificio por edificio. También en Reino → Aspectos.')));
    }, { wide: true });
    function nivelEl(n) {
      const i = P.info, ok = n <= 30 ? i.nivel >= n : i.extras >= n - 30;
      const pg = n <= 30 ? D.pasePremio(n, 'g', S().era, i.tema) : null, pd = D.pasePremio(n, 'd', S().era, i.tema);
      const celda = (pr, pista, tiene) => {
        if (!pr) return el('div', { class: 'pase-c vacia' });
        const hecho = (pista === 'd' ? i.cd : i.cg)[n], puede = ok && !hecho && (pista === 'g' || i.dorado);
        return el('div', { class: 'pase-c ' + pista + (hecho ? ' hecho' : puede ? ' listo' : '') + (pista === 'd' && !i.dorado ? ' cerrada' : '') },
          el('span', { class: 'small' }, (pr.aspecto ? '✦ ' : '') + pr.txt), hecho ? el('span', { class: 'small' }, '✓') : puede ? UI.btn('Reclamar', () => P.reclamar(n, pista), { small: true, cls: 'gold' }) : tiene);
      };
      return el('div', { class: 'pase-n' + (ok ? ' ok' : '') }, el('b', null, n <= 30 ? String(n) : '30+' + (n - 30)), celda(pg, 'g', ''), celda(pd, 'd', !i.dorado ? el('span', { class: 'small muted' }, '🔒') : ''));
    }
    function retoEl(r) { return el('div', { class: 'quest' + (r.ok ? ' done' : '') }, el('b', null, (r.ok ? '✓ ' : '') + r.txt), el('span', { class: 'small' }, ' +' + r.pp + ' PP'), el('div', { class: 'bar' }, el('div', { class: 'fill gold', style: { width: Math.min(100, (r.v / r.n) * 100) + '%' } }), el('span', null, U.fmt(Math.min(r.v, r.n)) + ' / ' + U.fmt(r.n)))); }
    function aspectoEl(id) {
      const a = D.aspecto(id);
      if (!a) return '';
      return el('span', { class: 'asp-chip', style: { borderColor: 'rgb(' + a.T.col.join(',') + ')' }, title: a.tipo }, P.nombre(id));
    }
  };
})();
