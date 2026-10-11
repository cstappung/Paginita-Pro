/* Pokelike — la pantalla. Toda decisión de juego la toma motor.js; aquí solo
   se pinta, se anima la lista de eventos de cada turno y se guarda la run en
   localStorage después de cada cambio, así una recarga sigue donde estaba. */
(() => {
  'use strict';
  const M = window.PokelikeMotor, D = M.D, ESP = M.ESP, S = window.PokelikeSonido;
  const $ = id => document.getElementById(id);
  const K_RUN = 'pokelike.run', K_OPC = 'pokelike.opc';
  const lee = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } };

  let run = lee(K_RUN);
  if (!run || run.v !== 2) run = null;
  const opc = Object.assign({ auto: true, vel: 1, debug: false, inmortal: true, desde: 0 }, lee(K_OPC));
  if (/[?&]debug=1/.test(location.search)) opc.debug = true;
  const guardaRun = () => guarda(K_RUN, run);
  const guardaOpc = () => guarda(K_OPC, opc);

  // ── Utilidades de pintura ───────────────────────────────────────────
  const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  const urlSprite = (e, { espalda = false, animado = false } = {}) => animado
    ? `${SPR}versions/generation-v/black-white/animated/${espalda ? 'back/' : ''}${e}.gif`
    : `${SPR}${espalda ? 'back/' : ''}${e}.png`;
  function ponImg(img, e, o = {}) {
    img.onerror = o.animado ? () => { img.onerror = null; img.src = urlSprite(e, { espalda: o.espalda }); } : null;
    img.src = urlSprite(e, o);
  }
  // Las <img data-spr="id"> que se pintan por innerHTML.
  const ponSprites = raiz => raiz.querySelectorAll('img[data-spr]').forEach(i => ponImg(i, Number(i.dataset.spr)));
  const urlEntrenador = s => `https://play.pokemonshowdown.com/sprites/trainers/${s}.png`;
  // Showdown no tiene todos los sprites con el mismo nombre: se prueba id, id-gen3, id-gen4.
  function ponEntrenador(img, s) {
    const prueba = [s, s + '-gen3', s + '-gen4'];
    img.hidden = false;
    img.onerror = () => { prueba.shift(); if (prueba.length) img.src = urlEntrenador(prueba[0]); else img.hidden = true; };
    img.src = urlEntrenador(prueba[0]);
  }
  const tramo = () => D.TRAMOS[run.tramo];
  const MEDALLAS = D.TRAMOS.slice(0, 8).map(t => t.jefes[0]);
  const filaMedallas = () => `<div class="medallas" aria-label="Medallas">${MEDALLAS.map((j, i) =>
    `<i class="medalla-mini${i < run.medallas ? ' tiene' : ''}" style="--c:${j.color}" title="${j.medalla}"></i>`).join('')}</div>`;

  const nombre = e => ESP[e].n;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const chipsTipo = e => ESP[e].t.map(t => `<span class="tipo" style="background:${D.COLOR_TIPO[t]}">${t}</span>`).join('');
  const pct = (a, b) => Math.max(0, Math.min(100, a / b * 100));
  function barraPs(i, p) { i.style.width = p + '%'; i.className = p <= 20 ? 'bajo' : p <= 50 ? 'medio' : ''; }
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const primerVivo = () => run.equipo.findIndex(p => p.ps > 0);

  const VISTAS = ['vTitulo', 'vInicial', 'vMapa', 'vCombate'];
  function muestra(v) {
    VISTAS.forEach(x => { $(x).hidden = x !== v; });
    $('btnInicio').hidden = v === 'vTitulo';
    if (v !== 'vCombate') gen++; // corta cualquier combate que se estuviera animando
    window.scrollTo(0, 0);
  }

  // ── Capa (captura, centro, fin) ─────────────────────────────────────
  function abreCapa(tit, txt, cuerpo, botones) {
    $('capaTit').textContent = tit;
    $('capaTxt').textContent = txt;
    $('capaCuerpo').innerHTML = cuerpo;
    ponSprites($('capaCuerpo'));
    const bs = $('capaBotones');
    bs.innerHTML = ''; bs.classList.remove('columna');
    for (const b of botones) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'boton ' + (b.cls || ''); el.textContent = b.txt;
      el.onclick = () => { S.clic(); b.fn(); };
      bs.appendChild(el);
    }
    $('capa').hidden = false;
  }
  const cierraCapa = () => { $('capa').hidden = true; };

  function cartaPokemon(p, i) {
    const ms = M.movimientos(p.e, p.nv).map(m => `<li>${esc(m.nombre)} · ${m.poder}</li>`).join('');
    return `<button type="button" class="carta" data-i="${i}">
      <img alt="" data-spr="${p.e}"><div class="nombre" translate="no">${nombre(p.e)}</div>
      <div>Nv ${p.nv}</div><div class="tipos">${chipsTipo(p.e)}</div><ul>${ms}</ul></button>`;
  }
  const miniEquipo = () => `<div class="mini-equipo">${run.equipo.map(p =>
    `<figure><img alt="" data-spr="${p.e}"><figcaption translate="no">${nombre(p.e)} · Nv ${p.nv}</figcaption></figure>`).join('')}</div>`;

  // ── Título e inicial ────────────────────────────────────────────────
  function pintaTitulo() {
    muestra('vTitulo'); cierraCapa();
    $('zona').textContent = '';
    const hay = run && run.fase !== 'fin';
    $('btnContinuar').hidden = !hay;
    $('tituloNota').textContent = hay ? `Partida en curso (${run.medallas} medallas): ` + run.equipo.map(p => `${nombre(p.e)} Nv ${p.nv}`).join(', ') : '';
    pintaPrueba();
  }

  // ── Modo prueba ─────────────────────────────────────────────────────
  const NOMBRES_TRAMO = D.TRAMOS.map((t, i) => t.liga ? 'Liga Pokémon' : `${i + 1}. ${t.jefes[0].nombre}`);
  function pintaPrueba() {
    $('chkPrueba').checked = opc.debug;
    $('pruebaOpc').hidden = !opc.debug;
    $('chkInmortal').checked = opc.inmortal;
    $('selDesde').innerHTML = NOMBRES_TRAMO.map((n, i) => `<option value="${i}"${i === opc.desde ? ' selected' : ''}>${n}</option>`).join('');
    $('btnPrueba').hidden = !opc.debug;
    $('marcaPrueba').hidden = !(run && run.debug);
  }
  $('chkPrueba').onchange = () => { opc.debug = $('chkPrueba').checked; guardaOpc(); pintaPrueba(); };
  $('chkInmortal').onchange = () => { opc.inmortal = $('chkInmortal').checked; guardaOpc(); };
  $('selDesde').onchange = () => { opc.desde = Number($('selDesde').value); guardaOpc(); };
  const inmortal = () => opc.debug && opc.inmortal;

  // Panel 🐞 de la barra: atajos según dónde estés.
  $('btnPrueba').onclick = () => {
    S.clic();
    const enCombate = !$('vCombate').hidden && run && run.combate;
    const b = [];
    if (enCombate) b.push({ txt: '⚡ Ganar este combate', fn: () => { gen++; M.debugGanar(run); M.terminarCombate(run); guardaRun(); reanuda(); } });
    if (run && run.fase !== 'fin' && $('vTitulo').hidden) {
      b.push({ txt: '🏆 Ir al jefe', fn: () => { M.debugIrAlJefe(run); guardaRun(); reanuda(); } });
      b.push({ txt: tramo().liga ? '⏭ Ganar la Liga' : '⏭ Saltar gimnasio (+medalla)', fn: () => { M.debugSaltarTramo(run); guardaRun(); reanuda(); } });
      b.push({ txt: '⬆ +5 niveles al equipo', fn: () => { M.debugSubirNiveles(run, 5); guardaRun(); reanuda(); } });
    }
    b.push({ txt: 'Cerrar', cls: 'secundario', fn: () => { cierraCapa(); if (!enCombate && $('vTitulo').hidden) reanuda(); } });
    abreCapa('🐞 Modo prueba', 'Todo lo que hagas aquí marca la partida como de prueba.',
      `<label class="interruptor-fila"><input type="checkbox" id="chkInmortal2"${opc.inmortal ? ' checked' : ''}> Inmortal: perder cuenta como ganar</label>`, b);
    $('chkInmortal2').onchange = ev => { opc.inmortal = ev.target.checked; guardaOpc(); pintaPrueba(); };
    $('capaCuerpo').onclick = null;
    $('capaBotones').classList.add('columna');
  };
  $('btnContinuar').onclick = () => { S.clic(); reanuda(); };
  $('btnNueva').onclick = () => {
    if (run && run.fase !== 'fin' && !confirm('¿Empezar de nuevo? Se pierde la partida en curso.')) return;
    S.clic(); pintaIniciales();
  };
  $('btnInicio').onclick = () => { S.clic(); pintaTitulo(); };

  function pintaIniciales() {
    muestra('vInicial'); cierraCapa();
    const cont = $('iniciales');
    cont.innerHTML = D.INICIALES.map(e => cartaPokemon({ e, nv: D.NIVEL_INICIAL }, e)).join('');
    ponSprites(cont);
    cont.onclick = ev => {
      const c = ev.target.closest('.carta'); if (!c) return;
      S.clic();
      const semilla = (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0; // solo la semilla; lo demás sale de ella
      run = opc.debug && opc.desde > 0
        ? M.debugEmpezarEn(semilla, Number(c.dataset.i), opc.desde)
        : M.nuevaRun(semilla, Number(c.dataset.i));
      run.inicio = Date.now();
      guardaRun();
      pintaMapa();
    };
  }

  // ── Mapa y equipo ───────────────────────────────────────────────────
  const ICONO = { inicio: '🏠', salvaje: '🌿', captura: '◓', entrenador: '👤', centro: '✚', jefe: '🏆' };
  const NOMBRE_NODO = { inicio: 'Inicio', salvaje: 'Pokémon salvaje', captura: 'Captura', entrenador: 'Entrenador', centro: 'Centro Pokémon' };
  const nombreNodo = n => n.tipo === 'jefe' ? `${tramo().jefes[n.jefe || 0].nombre} · ${tramo().jefes[n.jefe || 0].titulo}` : NOMBRE_NODO[n.tipo];

  function pintaMapa() {
    muestra('vMapa');
    const capas = run.mapa.capas, W = 420, ALTO = 74, H = (capas.length - 1) * ALTO + 64;
    const xy = n => [24 + n.x * (W - 48), 32 + n.capa * ALTO];
    const libres = new Set(run.fase === 'mapa' ? M.siguientes(run) : []);
    const visit = new Set(run.visitados);
    const hechas = new Set(run.visitados.slice(1).map((id, i) => run.visitados[i] + '>' + id));
    const capaActual = M.nodo(run, run.pos).capa;
    let s = '';
    for (const [d, a] of run.mapa.aristas) {
      const [x1, y1] = xy(M.nodo(run, d)), [x2, y2] = xy(M.nodo(run, a));
      s += `<line class="arista${hechas.has(d + '>' + a) ? ' hecha' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    for (const capa of capas) for (const n of capa) {
      const [x, y] = xy(n);
      const cls = ['nodo', n.tipo, n.id === run.pos ? 'actual' : '', visit.has(n.id) ? 'visitado' : '',
        libres.has(n.id) ? 'libre' : (!visit.has(n.id) && n.capa <= capaActual ? 'bloqueado' : '')].join(' ');
      const r = n.tipo === 'jefe' ? 26 : 20;
      s += `<g class="${cls}" data-id="${n.id}"${libres.has(n.id) ? ' tabindex="0" role="button"' : ''}>
        <title>${esc(nombreNodo(n))}</title><circle cx="${x}" cy="${y}" r="${r}"/>
        <text x="${x}" y="${y + 1}">${ICONO[n.tipo]}</text></g>`;
    }
    const svg = $('mapa');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    const elige = el => { const g = el.closest('.nodo.libre'); if (g) entrarNodo(g.dataset.id); };
    svg.onclick = ev => elige(ev.target);
    svg.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elige(ev.target); } };
    pintaZona();
    pintaEquipo();
    const sig = svg.querySelector('.nodo.libre');
    if (sig && window.innerWidth <= 760) sig.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function pintaZona() {
    const t = tramo();
    $('zona').textContent = `${t.liga ? 'Liga Pokémon' : 'Rumbo a ' + t.jefes[0].nombre} · ${M.zonaDe(run, M.nodo(run, run.pos)).nombre}`;
    $('medallasPanel').innerHTML = filaMedallas();
    pintaPrueba();
  }

  function pintaEquipo() {
    const f = primerVivo(), puede = run.fase === 'mapa';
    $('nEquipo').textContent = `${run.equipo.length}/${M.MAX_EQUIPO}`;
    const ol = $('equipo');
    ol.innerHTML = run.equipo.map((p, i) => {
      const st = M.stats(p.e, p.nv), movs = M.movimientos(p.e, p.nv).map(m => `${m.nombre} (${m.tipo} ${m.poder})`).join(', ');
      return `<li class="miembro${i === f ? ' frente' : ''}${p.ps <= 0 ? ' caido' : ''}" title="${esc(movs)}">
        <img alt="" data-spr="${p.e}">
        <div><div class="linea"><b translate="no">${nombre(p.e)}</b><span>Nv ${p.nv}</span></div>
          <div class="barra-ps"><i style="width:${pct(p.ps, st.ps)}%" class="${pct(p.ps, st.ps) <= 20 ? 'bajo' : pct(p.ps, st.ps) <= 50 ? 'medio' : ''}"></i></div>
          <div class="linea chico"><span translate="no">${p.ps}/${st.ps} PS</span><span class="tipos">${chipsTipo(p.e)}</span></div>
          <div class="barra-xp"><i style="width:${pct(p.xp, M.xpParaSubir(p.nv))}%"></i></div></div>
        <div class="flechas"><button type="button" data-mueve="${i}" data-dir="-1" aria-label="Subir" ${!puede || i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-mueve="${i}" data-dir="1" aria-label="Bajar" ${!puede || i === run.equipo.length - 1 ? 'disabled' : ''}>▼</button></div></li>`;
    }).join('');
    ponSprites(ol);
    ol.onclick = ev => {
      const b = ev.target.closest('[data-mueve]'); if (!b) return;
      if (M.moverEnEquipo(run, Number(b.dataset.mueve), Number(b.dataset.dir))) { S.clic(); guardaRun(); pintaEquipo(); }
    };
  }

  function entrarNodo(id) {
    if (!M.entrar(run, id)) return;
    S.clic(); guardaRun(); reanuda();
  }

  function reanuda() {
    if (!run) return pintaTitulo();
    if (run.fase === 'combate') return empiezaCombate();
    pintaMapa();
    if (run.fase === 'captura') pintaCaptura();
    else if (run.fase === 'centro') pintaCentro();
    else if (run.fase === 'fin') pintaFin();
    else if (run.fase === 'medalla') pintaMedalla();
    else cierraCapa();
  }

  // ── Captura y centro ────────────────────────────────────────────────
  function pintaCaptura() {
    abreCapa('¡Pokémon a la vista!', `Elige uno para tu equipo (${run.equipo.length}/${M.MAX_EQUIPO}).`,
      `<div class="cartas">${run.oferta.map(cartaPokemon).join('')}</div>`,
      [{ txt: 'No capturar', cls: 'secundario', fn: () => { M.capturar(run, null); guardaRun(); reanuda(); } }]);
    $('capaCuerpo').onclick = ev => {
      const c = ev.target.closest('.carta'); if (!c) return;
      const i = Number(c.dataset.i);
      S.cura();
      if (run.equipo.length >= M.MAX_EQUIPO) return pintaSoltar(i);
      M.capturar(run, i); guardaRun(); reanuda();
    };
  }
  function pintaSoltar(i) {
    abreCapa('Equipo lleno', `¿A quién liberas para que entre ${nombre(run.oferta[i].e)}?`,
      `<div class="cartas">${run.equipo.map(cartaPokemon).join('')}</div>`,
      [{ txt: '← Volver', cls: 'secundario', fn: pintaCaptura }]);
    $('capaCuerpo').onclick = ev => {
      const c = ev.target.closest('.carta'); if (!c) return;
      M.capturar(run, i, Number(c.dataset.i)); guardaRun(); reanuda();
    };
  }
  function pintaCentro() {
    abreCapa('Centro Pokémon', '¡Hola! Te devolveremos a tus Pokémon en perfecto estado.', miniEquipo(),
      [{ txt: '✚ Curar equipo', fn: () => { M.salirCentro(run); S.cura(); guardaRun(); reanuda(); } }]);
    $('capaCuerpo').onclick = null;
  }

  // ── Medalla y fin de run ────────────────────────────────────────────
  function pintaMedalla() {
    const j = tramo().jefes[0], sig = D.TRAMOS[run.tramo + 1];
    S.victoria();
    abreCapa(`¡${j.medalla}!`, `Venciste a ${j.nombre}. Tu equipo descansa antes de seguir.`,
      `<div class="medalla" style="--c:${j.color}" aria-hidden="true"></div>${filaMedallas()}${miniEquipo()}`,
      [{ txt: sig.liga ? '▶ Rumbo a la Liga Pokémon' : `▶ Rumbo a ${sig.jefes[0].lugar}`, fn: () => { M.siguienteTramo(run); guardaRun(); reanuda(); } }]);
    $('capaCuerpo').onclick = null;
  }

  function pintaFin() {
    if (!run.fin) { run.fin = Date.now(); guardaRun(); }
    const seg = Math.round((run.fin - (run.inicio || run.fin)) / 1000);
    const tiempo = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
    const gano = run.resultado === 'victoria';
    const donde = tramo().liga ? 'la Liga Pokémon' : tramo().jefes[0].lugar;
    abreCapa(gano ? '¡Campeón de la Liga Pokémon!' : 'Fin del camino',
      (gano ? `Venciste al Alto Mando y a ${tramo().jefes[4].nombre} en ${tiempo}.` : `Tu equipo cayó camino a ${donde}, con ${run.medallas} medallas, tras ${tiempo}.`)
        + (run.debug ? ' (partida de prueba)' : ''),
      (gano ? '<div class="medalla campeon" aria-hidden="true"></div>' : '') + filaMedallas() + miniEquipo(),
      [{ txt: '✦ Nueva partida', fn: pintaIniciales }, { txt: 'Título', cls: 'secundario', fn: pintaTitulo }]);
    $('capaCuerpo').onclick = null;
  }

  // ── Combate ─────────────────────────────────────────────────────────
  let gen = 0;               // sube al salir del combate; las animaciones viejas se cortan
  let resolverEleccion = null;
  const vista = { j: null, e: null };
  const especieDe = new Map(); // uid → especie, para nombrar bien durante la animación

  function ponLado(lado, p) {
    const antes = vista[lado];
    const st = M.stats(p.e, p.nv);
    vista[lado] = { uid: p.uid, e: p.e, nv: p.nv, ps: p.ps, max: st.ps, xp: p.xp };
    const img = $(lado === 'j' ? 'spJ' : 'spE');
    if (!antes || antes.e !== p.e || antes.uid !== p.uid || img.classList.contains('cae')) {
      img.className = 'sprite' + (lado === 'j' ? ' espalda' : '');
      ponImg(img, p.e, { espalda: lado === 'j', animado: true });
    }
    pintaFicha(lado);
  }
  function pintaFicha(lado) {
    const v = vista[lado], J = lado === 'j';
    $(J ? 'nomJ' : 'nomE').textContent = nombre(v.e);
    $(J ? 'nvJ' : 'nvE').textContent = 'Nv ' + v.nv;
    barraPs($(J ? 'psJ' : 'psE'), pct(v.ps, v.max));
    if (J) {
      $('psJt').textContent = `${v.ps}/${v.max}`;
      $('xpJ').style.width = pct(v.xp, M.xpParaSubir(v.nv)) + '%';
    }
  }
  function anima(lado, clase) {
    const img = $(lado === 'j' ? 'spJ' : 'spE');
    img.classList.remove(clase); void img.offsetWidth; img.classList.add(clase);
  }
  const texto = t => { $('texto').textContent = t; };

  function pintaMovs(elegido = -1) {
    const v = vista.j, rival = vista.e;
    const ms = M.movimientos(v.e, v.nv);
    $('movs').innerHTML = ms.map((m, i) => {
      const ef = rival ? M.efectividad(m.tipo, ESP[rival.e].t) : 1;
      const pista = ef === 0 ? 'x0' : ef > 1 ? `x${ef}` : ef < 1 ? `x${ef}` : '';
      return `<button type="button" class="mov${i === elegido ? ' elegido' : ''}" data-i="${i}" style="background:${D.COLOR_TIPO[m.tipo]}"
        ${resolverEleccion ? '' : 'disabled'}><span>${esc(m.nombre)}</span><small>${m.poder}${pista ? ' · ' + pista : ''}</small></button>`;
    }).join('');
  }
  $('movs').onclick = ev => {
    const b = ev.target.closest('.mov'); if (!b || !resolverEleccion) return;
    S.clic();
    const r = resolverEleccion; resolverEleccion = null; r(Number(b.dataset.i));
  };
  const pideEleccion = () => new Promise(r => { resolverEleccion = r; pintaMovs(); texto(`¿Qué hará ${nombre(vista.j.e)}?`); });

  function pintaOpciones() {
    $('btnAuto').setAttribute('aria-pressed', String(opc.auto));
    $('btnVel').textContent = '×' + opc.vel;
  }
  $('btnAuto').onclick = () => {
    opc.auto = !opc.auto; guardaOpc(); pintaOpciones(); S.clic();
    if (opc.auto && resolverEleccion) { const r = resolverEleccion; resolverEleccion = null; pintaMovs(); r(null); }
  };
  $('btnVel').onclick = () => { opc.vel = opc.vel === 1 ? 2 : opc.vel === 2 ? 4 : 1; guardaOpc(); pintaOpciones(); S.clic(); };

  const nombreEnemigo = e => run.combate && run.combate.tipo === 'salvaje' ? `${nombre(e)} salvaje` : `${nombre(e)} enemigo`;

  // Fondo de la arena según la zona.
  const ARENA = { 'Bosque Verde': 'bosque', 'Zona Safari': 'bosque', 'Ruta 24': 'bosque', 'Mt. Moon': 'cueva', 'Cueva Diglett': 'cueva',
    'Túnel Roca': 'cueva', 'Calle Victoria': 'cueva', 'Torre Pokémon': 'torre', 'Mansión Pokémon': 'torre', 'Silph S.A.': 'torre',
    'Ruta 19': 'mar', 'Ruta 21': 'mar', 'Islas Espuma': 'mar', 'Isla Canela': 'mar' };

  async function empiezaCombate() {
    muestra('vCombate'); cierraCapa();
    const g = gen, cb = run.combate;
    const zona = M.zonaDe(run, M.nodo(run, run.pos)).nombre;
    const jefe = cb.tipo === 'jefe' ? tramo().jefes[cb.rival.jefe || 0] : null;
    $('zona').textContent = jefe ? jefe.lugar : zona;
    $('arena').className = 'arena' + (jefe ? (tramo().liga ? ' liga' : ' gimnasio') : ARENA[zona] ? ' ' + ARENA[zona] : '');
    $('btnSeguir').hidden = true;
    resolverEleccion = null;
    vista.j = vista.e = null;
    especieDe.clear();
    ponLado('j', run.equipo[cb.ij]);
    ponLado('e', cb.enemigos[cb.ie]);
    pintaMovs(); pintaOpciones();
    if (cb.turno === 0) {
      if (cb.rival.sprite) {
        ponEntrenador($('spRival'), cb.rival.sprite);
        $('introTxt').textContent = cb.tipo === 'jefe'
          ? `¡${cb.rival.nombre}, ${cb.rival.titulo}, te desafía!` : `¡${cb.rival.nombre} quiere luchar!`;
        $('intro').hidden = false;
        texto(`${cb.rival.nombre} sacó a ${nombre(cb.enemigos[0].e)}.`);
        await espera(1600 / opc.vel);
        $('intro').hidden = true;
      } else {
        texto(`¡Un ${nombre(cb.enemigos[0].e)} salvaje apareció!`);
        await espera(1100 / opc.vel);
      }
      if (g !== gen) return;
      texto(`¡Adelante, ${nombre(run.equipo[cb.ij].e)}!`);
      await espera(700 / opc.vel);
    }
    bucle(g);
  }

  async function bucle(g) {
    while (g === gen && run.combate && !run.combate.fin) {
      let eleccion = null;
      if (!opc.auto) {
        eleccion = await pideEleccion();
        if (g !== gen) return;
      }
      for (const p of run.equipo) especieDe.set(p.uid, p.e);
      const ev = M.pasoCombate(run, eleccion);
      guardaRun();
      await reproduce(ev, g);
      if (g !== gen) return;
      // Re-sincroniza con el estado real por si la animación se desvió.
      if (run.combate && !run.combate.fin) { ponLado('j', run.equipo[run.combate.ij]); pintaMovs(); }
    }
    if (g === gen && run.combate && run.combate.fin) finCombate(g);
  }

  async function reproduce(eventos, g) {
    const T = ms => espera(ms / opc.vel);
    const nom = uid => nombre(especieDe.get(uid));
    for (const x of eventos) {
      if (g !== gen) return;
      const v = x.lado ? vista[x.lado] : null;
      switch (x.t) {
        case 'ataque': {
          texto(x.lado === 'j' ? `¡${nombre(v.e)} usó ${x.mov}!` : `¡${nombreEnemigo(v.e)} usó ${x.mov}!`);
          if (x.lado === 'j') pintaMovs(M.movimientos(v.e, v.nv).findIndex(m => m.nombre === x.mov));
          anima(x.lado, 'embiste');
          await T(600); break;
        }
        case 'falla': texto('¡Pero falló!'); await T(700); break;
        case 'dano': {
          v.ps = x.ps;
          if (x.ef > 1) S.superEficaz(); else if (x.ef > 0 && x.ef < 1) S.flojo(); else if (x.ef > 0) S.golpe();
          if (x.ef > 0) anima(x.lado, 'golpe');
          pintaFicha(x.lado);
          await T(550);
          if (x.crit) { texto('¡Un golpe crítico!'); await T(650); }
          if (x.ef > 1) { texto('¡Es súper eficaz!'); await T(700); }
          else if (x.ef === 0) { texto(`No afecta a ${nombre(v.e)}…`); await T(800); }
          else if (x.ef < 1) { texto('No es muy eficaz…'); await T(700); }
          break;
        }
        case 'debilitado': {
          $(x.lado === 'j' ? 'spJ' : 'spE').classList.add('cae'); S.cae();
          texto(x.lado === 'j' ? `¡${nombre(x.e)} se debilitó!` : `¡${nombreEnemigo(x.e)} se debilitó!`);
          await T(1000); break;
        }
        case 'xp': {
          if (vista.j && x.uid === vista.j.uid) {
            vista.j.xp += x.cant; pintaFicha('j');
            texto(`${nom(x.uid)} ganó ${x.cant} puntos de experiencia.`);
            await T(800);
          }
          break;
        }
        case 'nivel': {
          S.nivel();
          if (vista.j && x.uid === vista.j.uid) {
            const j = vista.j;
            j.xp -= M.xpParaSubir(j.nv); j.nv = x.nv;
            const max = M.stats(j.e, j.nv).ps; j.ps += max - j.max; j.max = max;
            pintaFicha('j');
          }
          texto(`¡${nom(x.uid)} subió al nivel ${x.nv}!`);
          await T(900); break;
        }
        case 'evoluciona': {
          texto(`¿Eh? ¡${nombre(x.de)} está evolucionando!`);
          const activo = vista.j && x.uid === vista.j.uid;
          if (activo) anima('j', 'brilla');
          await T(1100);
          especieDe.set(x.uid, x.a);
          if (activo) {
            const j = vista.j, max = M.stats(x.a, j.nv).ps;
            j.ps += max - j.max; j.max = max; j.e = x.a;
            ponImg($('spJ'), x.a, { espalda: true, animado: true });
            pintaFicha('j');
          }
          S.evoluciona();
          texto(`¡Felicidades! ¡${nombre(x.de)} evolucionó a ${nombre(x.a)}!`);
          await T(1500); break;
        }
        case 'aprende': texto(`${nom(x.uid)} aprendió ${x.mov}.`); await T(900); break;
        case 'sale': {
          if (x.lado === 'e') {
            ponLado('e', run.combate.enemigos[run.combate.ie]);
            texto(`${run.combate.rival.nombre} sacó a ${nombre(x.e)}.`);
          } else {
            ponLado('j', run.equipo.find(p => p.uid === x.uid));
            texto(`¡Adelante, ${nombre(x.e)}!`);
          }
          pintaMovs();
          await T(1000); break;
        }
        case 'fin': {
          const cb = run.combate;
          if (x.resultado === 'gana') {
            S.victoria();
            texto(cb.tipo === 'salvaje' ? '¡Ganaste el combate!' : `¡Derrotaste a ${cb.rival.nombre}!`);
          } else if (inmortal()) {
            S.derrota();
            texto('🐞 Inmortal: tu equipo se recupera y sigues como si hubieras ganado.');
          } else {
            S.derrota();
            texto('No te quedan Pokémon en pie… Todo se vuelve negro.');
          }
          await T(900); break;
        }
      }
    }
  }

  function finCombate(g) {
    pintaMovs();
    const b = $('btnSeguir');
    b.hidden = false; b.focus({ preventScroll: true });
    const gana = run.combate.fin === 'gana' || inmortal();
    // En automático, una victoria sigue sola: el ritmo idle.
    if (gana && opc.auto) setTimeout(() => { if (g === gen && !b.hidden) b.click(); }, 1500 / opc.vel);
  }
  $('btnSeguir').onclick = () => {
    $('btnSeguir').hidden = true;
    S.clic();
    M.terminarCombate(run, { inmortal: inmortal() }); guardaRun(); reanuda();
  };

  // Teclado: 1–4 movimientos, A automático, V velocidad.
  document.addEventListener('keydown', ev => {
    if ($('vCombate').hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^[1-4]$/.test(ev.key) && resolverEleccion) $('movs').querySelectorAll('.mov')[Number(ev.key) - 1]?.click();
    else if (ev.key === 'a' || ev.key === 'A') $('btnAuto').click();
    else if (ev.key === 'v' || ev.key === 'V') $('btnVel').click();
  });

  pintaTitulo();
})();
