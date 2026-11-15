// La guía de bienvenida (pedido del dueño): un personaje presenta el juego y lleva al jugador nuevo de la mano por los
// primeros pasos. Cada paso dice literalmente qué hacer, oscurece todo menos el lugar exacto donde hay que tocar (un
// aro dorado y una mano que tapea) y espera a que el jugador lo haga. Solo se puede tocar dentro del hueco.
//
// - Empieza sola en una partida nueva (main.js → Guia.empezar); el paso va en st.flags.guia, así que al recargar sigue
//   donde quedó; al terminar o saltarla queda en 'fin'. No corre en el mar, en ?timelapse ni con el piloto.
// - Los blancos se buscan por atributos que no se traducen (data-guia, data-mid, data-g, data-b), nunca por el texto
//   del botón (i18n: el texto puede estar traducido).
// - Un blanco del mapa (el Centro Urbano, un aldeano, un árbol, el lugar de la casa) se sigue en cada cuadro: si el
//   jugador mueve la cámara, el hueco va con él.
// - Si un blanco no aparece en 8 s, el diálogo ofrece «Hazlo por mí», que hace ese paso (nadie queda trabado).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World;
  const Gu = (PK.Guia = {});
  const G = () => PK.Game, S = () => PK.Game.state, R = () => PK.Render, UI = () => PK.UI;
  const el = (...a) => U.el(...a);
  const tactil = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hint = (pc, cel) => (tactil() ? cel : pc);

  D.PERSONAJES.mayordomo = D.PERSONAJES.mayordomo || { name: 'Tobías, el mayordomo del reino', clase: 'juglar', semilla: 2718,
    rasgos: { monoculo: true, edad: 'viejo', peinado: 'calvo', pelo: [214, 210, 204], barba: 'bigote', boca: 'sonrisa', cejas: 'alzada', cara: 'redonda', piel: 1, iris: 0, sombrero: false } };

  // ---------- Ayudas para los pasos ----------
  const tc = () => G().buildings.find(b => b.owner === 'p' && b.type === 'tc');
  const aldeanos = () => G().units.filter(u => u.owner === 'p' && u.kind === 'v');
  const casas = () => G().buildings.filter(b => b.owner === 'p' && b.type === 'house').length;
  const elegidos = () => (G().sel && G().sel.type === 'units' ? G().sel.ids : []);
  const iso = (tx, ty) => { const [wx, wy] = R().iso(tx, ty); return R().worldToScreen(wx, wy); };
  // un rectángulo de pantalla alrededor de un punto del mapa (en casillas), del tamaño que se ve con el zoom actual
  function rectMapa(tx, ty, w, h, alto) {
    const [x, y] = iso(tx, ty), z = R().cam.z;
    return { x: x - (w * z) / 2, y: y - (h + (alto || 0)) * z / 2 - (alto || 0) * z / 2, w: w * z, h: (h + (alto || 0)) * z };
  }
  const rectDe = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
  const q = sel => { const e = document.querySelector(sel); return e && e.offsetParent !== null ? e : null; };
  const qf = sel => { const e = document.querySelector(sel); return e && e.style.display !== 'none' && e.getClientRects().length ? e : null; }; // los fijos no tienen offsetParent
  // el lugar de la casa: libre, a unas casillas del Centro Urbano, del lado que se ve
  function lugarCasa() {
    const b = tc();
    if (!b) return null;
    if (Gu.casaEn && G().placeWhy('house', Gu.casaEn[0], Gu.casaEn[1]) === null) return Gu.casaEn;
    for (let r = 3; r < 14; r++) for (const [dx, dy] of [[r, 0], [0, r], [r, r], [-r, r], [r, -r], [-r, 0], [0, -r], [-r, -r]]) {
      const x = Math.round(b.cx + dx - 1), y = Math.round(b.cy + dy - 1);
      if (G().placeWhy('house', x, y) === null) return (Gu.casaEn = [x, y]);
    }
    return null;
  }
  // el aldeano de la lección y su árbol: uno que no esté cargando, y el árbol más cercano dentro del radio
  function aldeanoGuia() {
    let u = Gu.uid !== undefined && G().units.find(o => o.id === Gu.uid && o.owner === 'p');
    if (!u) { u = aldeanos().sort((a, b) => (a.carry || 0) - (b.carry || 0))[0]; if (u) Gu.uid = u.id; }
    return u || null;
  }
  function arbolGuia() {
    const u = aldeanoGuia(), b = tc();
    if (!u || !b) return null;
    let n = Gu.nid !== undefined && W.nodes[Gu.nid];
    if (n && !n.dead && !n.gone) return n;
    let mejor = null, md = Infinity;
    for (const o of W.nodes) {
      if (o.kind !== 'tree' || o.dead || o.gone || o.temp || !W.canUse(o, 'p') || !G().enRadio(b, o.x, o.y)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < md) { md = d; mejor = o; }
    }
    if (mejor) Gu.nid = mejor.id;
    return mejor;
  }
  const grupoAbierto = id => { const s = document.getElementById('submenu'); return !!(s && s.classList.contains('on') && s.querySelector('[data-mid="' + id + '"]')); };

  // el lugar del campamento maderero: libre, cerca del Centro Urbano, con la mayor cantidad de árboles en su radio
  function lugarCampo() {
    const b = tc();
    if (!b) return null;
    if (Gu.campoEn && G().placeWhy('lumber', Gu.campoEn[0], Gu.campoEn[1]) === null) return Gu.campoEn;
    const r = G().BASES && G().BASES.lumber ? G().BASES.lumber.r(1) : 6, arboles = W.nodes.filter(o => o.kind === 'tree' && !o.dead && !o.gone && !o.temp && W.canUse(o, 'p'));
    let mejor = null, mp = -1;
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
      const x = Math.round(b.cx + dx - 1), y = Math.round(b.cy + dy - 1), d = Math.hypot(dx, dy);
      if (d < 4 || d > 14 || G().placeWhy('lumber', x, y) !== null) continue;
      let n = 0;
      for (const o of arboles) if (Math.hypot(o.x + 0.5 - (x + 1), o.y + 0.5 - (y + 1)) <= r) n++;
      const p = n - d * 0.6; // que valga la pena, pero no lejísimos
      if (p > mp) { mp = p; mejor = [x, y]; }
    }
    return (Gu.campoEn = mejor);
  }
  const cuenta = t => G().buildings.filter(b => b.owner === 'p' && b.type === t).length;
  const ultimo = t => G().buildings.filter(b => b.owner === 'p' && b.type === t).sort((a, c) => c.id - a.id)[0] || null;
  // la batalla de la guía: no es una expedición (no está en S.exp.runs), así que no deja bajas ni botín propio
  const BID = 990000001, BOTIN = { food: 60 };
  const batalla = () => (PK.Batalla ? PK.Batalla.de(BID) : null);
  function armarBatalla() {
    const B = PK.Batalla;
    if (!B) return null;
    let b = B.de(BID);
    if (!b) {
      const units = { militia: 6 }, enemy = { beast: 1 }, fuerza = PK.Exp.powerVs(units, enemy);
      if (!B.empezar({ id: BID, name: 'La manada del bosque', units, enemy, need: Math.max(4, fuerza * 0.3), tactic: 'cauto' })) return null;
      b = B.de(BID);
      for (const f of b.mios) f.max = f.hp = f.hp * 2; // se gana siempre (un tercio de la fuerza y el doble de vida)
      b.pausa = true; // quietos hasta que el jugador dé la orden
    }
    if (!B.abierta()) B.abrir(BID);
    return b;
  }
  // los pasos que se repiten: abrir Reino, tocar Construir, elegir la tarjeta y ubicar el edificio
  function pasoReino() {
    return { txt: () => hint('Haga clic en «Reino»', 'Toque «Reino»') + ' para construir.',
      blanco: () => rectDe(q('.mbtn.grupo[data-g="reino"]')),
      listo: () => grupoAbierto('build') || UI().modalKey() === 'build',
      porMi: () => { const e = q('.mbtn.grupo[data-g="reino"]'); if (e) e.click(); } };
  }
  function pasoConstruir() {
    return { txt: () => hint('Haga clic en «Construir».', 'Toque «Construir».'),
      antes: () => { if (!grupoAbierto('build') && UI().modalKey() !== 'build') { const e = q('.mbtn.grupo[data-g="reino"]'); if (e) e.click(); } },
      blanco: () => rectDe(q('#submenu.on [data-mid="build"]')),
      listo: () => UI().modalKey() === 'build',
      porMi: () => UI().openBuild() };
  }
  function pasoTarjeta(tipo, texto) {
    return { txt: () => texto,
      antes: () => {
        // si no le alcanza (gastó en otra cosa), Tobías le presta lo que falta: la guía no se traba
        const c = G().buildCost(tipo), falta = {};
        for (const k in c) if ((S().res[k] || 0) < c[k]) falta[k] = Math.ceil(c[k] - (S().res[k] || 0));
        if (Object.keys(falta).length) { G().give(falta); UI().toast('Tobías le presta lo que falta para ' + D.BUILD[tipo].name + '.', 'info'); }
        if (UI().modalKey() !== 'build') UI().openBuild();
        setTimeout(() => { const e = q('.bcard[data-b="' + tipo + '"]'); if (e) e.scrollIntoView({ block: 'nearest' }); }, 50);
      },
      blanco: () => rectDe(q('.bcard[data-b="' + tipo + '"]')),
      listo: () => !!(G().placing && G().placing.type === tipo),
      porMi: () => { UI().closeModal(); PK.Input.startPlacing(tipo); } };
  }
  // Ubicar: con el mouse, un clic en el lugar marcado. Con el dedo, el edificio ya aparece ahí (arrastrable) y se
  // resaltan él y sus botones ✓ ✕ (input.js).
  function pasoColocar(tipo, lugar, pc, cel, cuantos) {
    const centro = () => { const p = lugar(), d = D.BUILD[tipo]; return p && { x: p[0] + d.w / 2, y: p[1] + d.h / 2 }; };
    return { txt: () => hint(pc, cel), centrar: centro,
      antes: () => {
        if (!G().placing || G().placing.type !== tipo) PK.Input.startPlacing(tipo);
        const p = lugar();
        if (p) setTimeout(() => PK.Input.ponerFantasma(p[0], p[1]), 30); // ya se ve ahí (con el mouse, hasta que lo mueva)
      },
      blanco: () => {
        if (tactil()) {
          const a = PK.Input.rectFantasma(), c = rectDe(qf('#colocar'));
          if (!a) return null;
          if (!c) return a;
          const x0 = Math.min(a.x, c.x), y0 = Math.min(a.y, c.y), x1 = Math.max(a.x + a.w, c.x + c.w), y1 = Math.max(a.y + a.h, c.y + c.h);
          return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
        const p = lugar(), d = D.BUILD[tipo];
        return p && rectMapa(p[0] + d.w / 2, p[1] + d.h / 2, 20 * (d.w + d.h), 12 * (d.w + d.h), 0);
      },
      base: () => cuenta(cuantos),
      listo: b => cuenta(cuantos) > b,
      porMi: () => { const p = lugar(); if (p && G().place) { G().place(tipo, p[0], p[1]); G().placing = null; R().ghost = null; UI().refreshPanel(true); } } };
  }

  // ---------- Los pasos ----------
  // habla: solo diálogo con «Continuar». blanco(): rectángulo a resaltar (o null). listo(base): ¿ya lo hizo?
  // base: lo que había al empezar el paso (para «entrenó uno más», «puso una casa»). porMi: hace el paso.
  const PASOS = [
    { habla: ['¡Bienvenido, mi señor! Soy Tobías, el mayordomo de estas tierras.', 'Le voy a enseñar a gobernar su reino. Es fácil: solo haga lo que le voy señalando.'] },
    { habla: ['Arriba están sus recursos: comida, madera, piedra y oro. Con ellos se paga todo lo que construya y entrene.'], blanco: () => rectDe(q('#topbar .res')) && (() => { const rs = [...document.querySelectorAll('#topbar .res:not(.pop):not(.builders):not(.asesor):not(.coins)')].slice(0, 4).map(rectDe).filter(Boolean); if (!rs.length) return null; const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y)), x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; })(), mirar: true },
    { txt: () => 'Este es su Centro Urbano, el corazón del pueblo. ' + hint('Haga clic en él.', 'Tóquelo.'), centrar: () => tc(),
      blanco: () => { const b = tc(); return b && rectMapa(b.cx, b.cy, 70, 40, 44); },
      listo: () => G().sel && G().sel.type === 'building' && G().sel.id === (tc() || {}).id,
      porMi: () => { const b = tc(); G().sel = { type: 'building', id: b.id }; UI().refreshPanel(true); } },
    { txt: () => 'Para crecer necesita gente. ' + hint('Haga clic en «Aldeano»', 'Toque «Aldeano»') + ' para entrenar uno: cuesta un poco de comida.',
      antes: () => { const b = tc(); if (b && !(G().sel && G().sel.id === b.id)) { G().sel = { type: 'building', id: b.id }; UI().refreshPanel(true); } setTimeout(() => { const e = q('[data-guia="aldeano"]'); if (e) e.scrollIntoView({ block: 'nearest' }); }, 50); },
      blanco: () => rectDe(q('[data-guia="aldeano"]')),
      base: () => aldeanos().length + (tc() ? tc().queue.length : 0),
      listo: b => aldeanos().length + (tc() ? tc().queue.length : 0) > b,
      porMi: () => { G().train(tc(), 1); UI().refreshPanel(true); } },
    { habla: ['¡Eso es! Cuando sale, el aldeano se pone a trabajar solo: junta madera, comida y piedra dentro del círculo de su Centro Urbano y lo trae aquí.'], blanco: () => { const b = tc(); return b && rectMapa(b.cx, b.cy, 70, 40, 44); }, mirar: true },
    { txt: () => 'Ahora le enseño a dar una orden. ' + hint('Haga clic en este aldeano.', 'Toque a este aldeano.'), centrar: () => aldeanoGuia(),
      blanco: () => { const u = aldeanoGuia(); return u && rectMapa(u.x, u.y, 30, 26, 10); },
      listo: () => { const u = aldeanoGuia(); return !!u && elegidos().includes(u.id); },
      porMi: () => { const u = aldeanoGuia(); G().sel = { type: 'units', ids: [u.id] }; UI().refreshPanel(true); } },
    { txt: () => hint('Ahora haga clic derecho en este árbol', 'Ahora toque este árbol') + ' para mandarlo a cortar leña.', centrar: () => arbolGuia(),
      antes: () => { const u = aldeanoGuia(); if (u && !elegidos().includes(u.id)) { G().sel = { type: 'units', ids: [u.id] }; UI().refreshPanel(true); } },
      blanco: () => { const n = arbolGuia(); return n && rectMapa(n.x + 0.5, n.y + 0.5, 30, 22, 26); },
      listo: () => { const u = aldeanoGuia(); return !!(u && u.task && u.task.t === 'gather' && u.task.m && u.task.res === 'wood'); },
      porMi: () => { const u = aldeanoGuia(), n = arbolGuia(); G().command([u], { kind: 'node', obj: n }); } },
    { habla: ['¡Así se da una orden! Si no les dice nada, el Capataz reparte a su gente solo: usted decide cuando quiere.'] },
    Object.assign(pasoReino(), { txt: () => 'Su gente necesita casas. ' + hint('Haga clic en «Reino»', 'Toque «Reino»') + ': ahí se construye.', antes: () => { G().sel = null; UI().refreshPanel(true); } }),
    pasoConstruir(),
    pasoTarjeta('house', 'Elija la Casa: da lugar para más aldeanos.'),
    pasoColocar('house', () => lugarCasa(), 'Haga clic aquí para ubicarla.', 'Así quedará su casa. Puede arrastrarla con el dedo; cuando esté en verde, toque ✓ para construirla.', 'house'),
    { habla: ['¡Perfecto! Los edificios se levantan solos, sin quitarle aldeanos. Cuando esté lista, tendrá lugar para más gente.'] },
    // pk-49: el campamento maderero (el radio de trabajo)
    { habla: ['Los árboles junto al Centro Urbano se acaban pronto. Conviene llevar a los leñadores al bosque.', 'Un Campamento Maderero junto a los árboles les deja cortar y descargar allí mismo. Vamos a poner uno.'] },
    pasoReino(),
    pasoConstruir(),
    pasoTarjeta('lumber', 'Elija el Campamento Maderero.'),
    pasoColocar('lumber', () => lugarCampo(), 'Haga clic aquí, junto al bosque, para ubicarlo.', 'Así quedará, junto al bosque. Puede arrastrarlo con el dedo; toque ✓ para construirlo.', 'lumber'),
    { habla: ['¡Muy bien! El círculo dorado que vio es su radio de trabajo: sus leñadores cortan los árboles que quedan adentro.', 'Cuando un radio se queda sin árboles, se puede mover el campamento a otro bosque.'],
      blanco: () => { const b = ultimo('lumber'); return b && rectMapa(b.cx, b.cy, 56, 32, 30); }, mirar: true },
    // pk-49: la primera batalla, que se gana siempre (la guardia del castillo contra unos lobos flacos)
    { habla: ['¡Mi señor, malas noticias! Una manada de lobos bajó del bosque y asusta a los leñadores.', 'Hoy le acompaña la guardia del castillo: seis milicianos. Vamos a echarlos.'], boton: '¡A defender el pueblo!' },
    { txt: () => 'Sus soldados esperan firmes en la línea. ' + hint('Haga clic en «Cargar»', 'Toque «Cargar»') + ' para lanzarlos al ataque.',
      antes: () => armarBatalla(),
      blanco: () => { if (!batalla()) armarBatalla(); else if (!PK.Batalla.abierta()) PK.Batalla.abrir(BID); return rectDe(q('#batalla [data-guia="bt-cargar"]')); },
      listo: () => { const b = batalla(); return !b || b.orden === 'cargar'; },
      porMi: () => { PK.Batalla.ordenar(BID, 'cargar'); PK.Batalla.repintar(); } },
    { txt: () => '¡A la carga! Ahora pelean solos. Arriba, la barra verde es su tropa y la roja, los lobos. ' + hint('Con «x2»', 'Tocando «x2»') + ' va más rápido.', libre: true,
      antes: () => { const b = batalla() || armarBatalla(); if (b) { b.pausa = false; b.orden = 'cargar'; PK.Batalla.repintar(); } }, // al recargar se arma de nuevo
      listo: () => { const b = batalla(); return !b || !!b.fin; } },
    { txt: () => '¡Victoria! Los lobos huyen al bosque. ' + hint('Haga clic en «Volver al reino».', 'Toque «Volver al reino».'),
      antes: () => { if (!S().flags.guiaBotin) { S().flags.guiaBotin = 1; G().give(BOTIN); UI().toast('Botín de la manada: +' + BOTIN.food + ' comida.', 'good'); } },
      blanco: () => rectDe(q('#batalla [data-guia="bt-volver"]')),
      listo: () => !PK.Batalla.abierta(),
      porMi: () => PK.Batalla.cerrar() },
    { habla: ['Hoy peleó la guardia del castillo. En la Era II podrá levantar un Cuartel y entrenar su propio ejército.', 'Con él saldrá de expedición contra campamentos de bandidos y mazmorras, a buscar botín. Y cuidado: a usted también le pueden atacar.'] },
    { txt: () => 'Lo último: sus misiones. ' + hint('Haga clic en «Libro».', 'Toque «Libro».'),
      antes: () => { G().sel = null; UI().refreshPanel(true); },
      blanco: () => rectDe(q('.mbtn.grupo[data-g="libro"]')),
      listo: () => grupoAbierto('book') || UI().modalKey() === 'book',
      porMi: () => { const e = q('.mbtn.grupo[data-g="libro"]'); if (e) e.click(); } },
    { txt: () => hint('Haga clic en «Misiones».', 'Toque «Misiones».'),
      antes: () => { if (!grupoAbierto('book') && UI().modalKey() !== 'book') { const e = q('.mbtn.grupo[data-g="libro"]'); if (e) e.click(); } },
      blanco: () => rectDe(q('#submenu.on [data-mid="book"]')),
      listo: () => UI().modalKey() === 'book',
      porMi: () => PK.Quests.openBook('main') },
    { habla: ['Aquí están sus misiones: cada una le dice qué hacer y le da un premio al cumplirla.', 'Y cuando no tenga nada elegido, el panel «¿Qué hago ahora?» le dice siempre la próxima. ¡Le dejo un regalo para empezar! Mucha suerte, mi señor.'], fin: true },
  ];
  Gu.PASOS = PASOS;
  const REGALO = { food: 100, wood: 100 };

  // ---------- Dibujo: velo con hueco, aro, mano y diálogo ----------
  let raiz = null, velos = [], aro = null, mano = null, dlg = null, paso = -1, base = 0, t0 = 0, raf = 0, ultimoTxt = '';
  function armar() {
    if (raiz) return;
    raiz = el('div', { id: 'guia', 'aria-live': 'polite' });
    velos = [0, 1, 2, 3].map(() => el('div', { class: 'gu-velo', onclick: e => { e.stopPropagation(); latido(); } }));
    aro = el('div', { class: 'gu-aro' });
    mano = el('img', { class: 'gu-mano', src: manoPx(), alt: '' });
    dlg = el('div', { class: 'gu-dlg' });
    raiz.append(...velos, aro, mano, dlg);
    for (const v of velos) for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'contextmenu', 'wheel']) v.addEventListener(ev, e => { e.stopPropagation(); if (ev !== 'wheel') e.preventDefault(); }, { passive: false });
    document.body.append(raiz);
  }
  function latido() { if (!aro) return; aro.classList.remove('gu-late'); void aro.offsetWidth; aro.classList.add('gu-late'); }
  // una mano de pixel art (índice que señala), dibujada en código como todo el arte del juego
  let MANO = null;
  function manoPx() {
    if (MANO) return MANO;
    const fil = [
      '....oo......',
      '...owwo.....',
      '...owwo.....',
      '...owwo.....',
      '...owwooo...',
      '...owwowwoo.',
      '.ooowwowwowo',
      'owwowwwwwwwo',
      'owwwwwwwwwwo',
      '.owwwwwwwwwo',
      '..owwwwwwwo.',
      '..owwwwwwwo.',
      '...owwwwwo..',
      '...ooooooo..',
    ];
    const s = 3, c = document.createElement('canvas'); c.width = 12 * s; c.height = fil.length * s;
    const x = c.getContext('2d');
    fil.forEach((f, j) => [...f].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = ch === 'o' ? '#2a1c12' : j > 8 ? '#f0d2a8' : '#fbe4c2'; x.fillRect(i * s, j * s, s, s); }));
    return (MANO = c.toDataURL());
  }
  function ponerHueco(r) {
    const Wv = window.innerWidth, Hv = window.innerHeight;
    if (!r) { // todo oscuro
      Object.assign(velos[0].style, { left: '0px', top: '0px', width: Wv + 'px', height: Hv + 'px', display: 'block' });
      for (let i = 1; i < 4; i++) velos[i].style.display = 'none';
      aro.style.display = 'none'; mano.style.display = 'none';
      return;
    }
    const m = 6, x0 = Math.max(0, Math.round(r.x - m)), y0 = Math.max(0, Math.round(r.y - m)), x1 = Math.min(Wv, Math.round(r.x + r.w + m)), y1 = Math.min(Hv, Math.round(r.y + r.h + m));
    const pon = (v, l, t, w, h) => Object.assign(v.style, { left: l + 'px', top: t + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px', display: 'block' });
    pon(velos[0], 0, 0, Wv, y0);              // arriba
    pon(velos[1], 0, y1, Wv, Hv - y1);        // abajo
    pon(velos[2], 0, y0, x0, y1 - y0);        // izquierda
    pon(velos[3], x1, y0, Wv - x1, y1 - y0);  // derecha
    Object.assign(aro.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px', display: 'block' });
    // la mano: abajo a la derecha del hueco, señalando su centro (arriba si no entra)
    const cx = (x0 + x1) / 2, abajo = y1 + 44 < Hv;
    Object.assign(mano.style, { display: 'block', left: Math.min(Wv - 40, Math.max(0, cx - 6)) + 'px', top: (abajo ? y1 - 10 : y0 - 34) + 'px', transform: abajo ? '' : 'scaleY(-1)' });
    return { cy: (y0 + y1) / 2 };
  }
  function pintarDialogo(P, faltaBlanco) {
    const lineas = P.habla || [P.txt()];
    const clave = paso + '|' + lineas.join('') + (faltaBlanco ? '!' : '');
    if (clave === ultimoTxt) return;
    ultimoTxt = clave;
    dlg.innerHTML = '';
    const pers = D.PERSONAJES.mayordomo;
    const yo = { clase: pers.clase, semilla: pers.semilla, rasgos: pers.rasgos };
    const ret = PK.Heroes && PK.Heroes.retratoEl ? PK.Heroes.parpadear(PK.Heroes.retratoEl(yo, 'grande'), yo) : '';
    const pie = el('div', { class: 'gu-pie' },
      el('span', { class: 'small gu-n' }, 'Paso ' + (paso + 1) + ' de ' + PASOS.length),
      el('button', { class: 'gu-saltar', onclick: () => saltar() }, 'Saltar guía'),
      P.habla ? el('button', { class: 'btn gold', onclick: () => siguiente() }, P.fin ? '¡A gobernar!' : P.boton || 'Continuar') : '',
      !P.habla && faltaBlanco && P.porMi ? el('button', { class: 'btn small', onclick: () => { try { P.porMi(); } catch (e) { console.error('guia', e); } } }, 'Hazlo por mí') : '');
    dlg.append(el('div', { class: 'gu-cuerpo' }, el('div', { class: 'gu-ret' }, ret),
      el('div', { class: 'gu-txt' }, el('b', { class: 'gu-quien' }, pers.name), ...lineas.map(l => el('p', null, l)))), pie);
  }
  function cuadro() {
    raf = requestAnimationFrame(cuadro);
    const P = PASOS[paso];
    if (!P || !raiz) return;
    // si se abrió otra ventana (una carta, un aviso) que no es parte del paso, la guía espera debajo
    const k = UI().modalKey(), propia = k === 'build' || k === 'book';
    if (k && !propia) { raiz.style.display = 'none'; return; }
    raiz.style.display = '';
    if (!P.habla && P.listo && P.listo(base)) { siguiente(); return; }
    let r = null;
    try { r = P.blanco ? P.blanco() : null; } catch (e) { r = null; }
    const falta = !P.habla && !P.libre && !r && performance.now() - t0 > 8000;
    // libre: nada tapa la pantalla (mirar la batalla); solo el diálogo, chico y arriba
    raiz.classList.toggle('gu-libre', !!P.libre);
    dlg.classList.toggle('gu-fuera', !!P.libre && performance.now() - t0 > 7000); // después se aparta: hay que ver la pelea
    const h = P.libre ? (velos.forEach(v => { v.style.display = 'none'; }), aro.style.display = 'none', mano.style.display = 'none', { cy: window.innerHeight }) : ponerHueco(r);
    pintarDialogo(P, falta);
    // el diálogo va del lado opuesto al hueco
    const arriba = h && h.cy > window.innerHeight * 0.5;
    dlg.classList.toggle('gu-arriba', !!arriba);
    // en los pasos de solo hablar el hueco se ve pero no se toca
    raiz.classList.toggle('gu-mira', !!P.habla);
    if (P.habla && r) { aro.style.display = 'block'; mano.style.display = 'none'; }
  }
  function entrar(i) {
    paso = i; ultimoTxt = ''; t0 = performance.now();
    const st = S();
    st.flags.guia = i;
    const P = PASOS[i];
    if (!P) return terminar(false);
    try { if (P.antes) P.antes(); } catch (e) { console.error('guia', e); }
    try { const c = P.centrar && P.centrar(); if (c) centrar(c.cx !== undefined ? c.cx : c.x, c.cy !== undefined ? c.cy : c.y); } catch (e) { /* sin blanco aún */ }
    base = P.base ? P.base() : 0;
  }
  // centra el punto en lo que se ve del mapa (sin el panel, el menú ni el diálogo), no en el medio de la ventana
  function centrar(tx, ty) {
    const r = R();
    r.centerOn(tx, ty);
    const a = PK.Input.areaLibre ? PK.Input.areaLibre() : null;
    if (!a) return;
    r.cam.x -= ((a.x0 + a.x1) / 2 - window.innerWidth / 2) / r.cam.z;
    r.cam.y -= (a.y0 + (a.y1 - a.y0) * 0.45 - window.innerHeight / 2) / r.cam.z;
    r.clampCam();
  }
  function siguiente() {
    const P = PASOS[paso];
    if (P && P.fin) { if (UI().modalKey() === 'book') UI().closeModal(); terminar(true); return; }
    if (PK.Sfx && P && !P.habla) PK.Sfx.play('coin');
    entrar(paso + 1);
  }
  function saltar() {
    if (!confirm('¿Saltar la guía? Puedes volver a verla desde Opciones.')) return;
    terminar(false);
  }
  function terminar(completa) {
    cancelAnimationFrame(raf); raf = 0;
    if (raiz) raiz.remove();
    raiz = null; paso = -1;
    const st = S();
    st.flags.guia = 'fin';
    if (completa && !st.flags.guiaRegalo) {
      st.flags.guiaRegalo = 1;
      G().give(REGALO);
      UI().toast('Regalo de Tobías: +' + REGALO.food + ' comida y +' + REGALO.wood + ' madera. El panel «¿Qué hago ahora?» le dice la próxima misión.', 'epic');
    }
    UI().refreshPanel(true);
  }

  // ---------- Entrada ----------
  Gu.activa = () => paso >= 0;
  Gu.puede = () => !(G().enMar && G().enMar()) && !/[?&](timelapse|piloto)\b/.test(location.search);
  // partida nueva: desde el principio
  Gu.empezar = function () {
    if (!Gu.puede()) return;
    armar(); entrar(0);
    if (!raf) cuadro();
  };
  // al cargar: si quedó a medias, sigue (los pasos que ya se cumplieron pasan solos)
  Gu.reanudar = function () {
    const g = S().flags.guia;
    if (typeof g !== 'number' || !Gu.puede()) return false;
    armar(); entrar(Math.max(0, Math.min(PASOS.length - 1, g)));
    if (!raf) cuadro();
    return true;
  };
  // desde Opciones
  Gu.repetir = function () {
    UI().closeModal();
    Gu.casaEn = null; Gu.campoEn = null; Gu.uid = undefined; Gu.nid = undefined;
    Gu.empezar();
  };
})();
