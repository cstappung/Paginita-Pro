/* Pokelike — la pantalla. Toda decisión de juego la toma motor.js; aquí solo
   se pinta, se anima la lista de eventos de cada turno y se guarda la run en
   localStorage después de cada cambio, así una recarga sigue donde estaba. */
(() => {
  'use strict';
  const M = window.PokelikeMotor, D = M.D, ESP = M.ESP, S = window.PokelikeSonido, DEX = window.PokelikeDex, MED = window.PokelikeMedallas, IC = window.PokelikeIconos;
  const $ = id => document.getElementById(id);
  /* El Club (juegos/club/conexion.js): la cuenta con que se juega y la
     tabla. La run se guarda por cuenta, porque su prueba solo vale para la
     cuenta que la jugó (va mezclada en la semilla). */
  const Club = window.Club || null;
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const CAT_PUNTOS = 'club-pokelike-puntos', CAT_POKEDEX = 'club-pokelike-pokedex';
  const K_RUN = Club && Club.storageKey ? Club.storageKey('pokelike.run') : 'pokelike.run', K_OPC = 'pokelike.opc';
  const lee = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } };

  let run = lee(K_RUN);
  if (!run || run.v !== 2) run = null;
  const opc = Object.assign({ auto: true, vel: 1, debug: false, inmortal: true, desde: 0 }, lee(K_OPC));
  /* El modo prueba es solo para desarrollar: existe en local (localhost) y
     en producción ni se ve ni se puede encender, aunque quede guardado en
     el navegador o venga `?debug=1`. */
  const EN_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(location.hostname);
  if (!EN_LOCAL) opc.debug = false;
  else if (/[?&]debug=1/.test(location.search)) opc.debug = true;
  const guardaRun = () => { cuentaReloj(); guarda(K_RUN, run); DEX.registraRun(run); };

  /* Dos relojes del tiempo jugado (performance.now y Date.now), que solo
     corren con la pestaña a la vista y viajan en la prueba: si alguien
     acelera el juego, dejan de coincidir. Se guardan en la run. */
  let relojDesde = null;
  function cuentaReloj() {
    if (!run) { relojDesde = null; return; }
    const ahora = [performance.now(), Date.now()];
    if (relojDesde && run.fase !== 'fin') {
      run.relA = (run.relA || 0) + ahora[0] - relojDesde[0];
      run.relW = (run.relW || 0) + ahora[1] - relojDesde[1];
    }
    relojDesde = document.visibilityState === 'visible' ? ahora : null;
  }
  document.addEventListener('visibilitychange', () => { cuentaReloj(); if (run) guarda(K_RUN, run); });

  /* Manda la run a las dos tablas del Club con su prueba (semilla, cuenta,
     inicial, decisiones y relojes): docs/antitrampas/pokelike.md. Una run
     de prueba, sin registro o de otra cuenta no se manda. Una vez por cada
     estado distinto de la run (al ganar la Liga y otra vez al terminar la
     Ruta Infinita). */
  function enviaClub() {
    if (!Club || !run || run.debug || !Array.isArray(run.log) || run.u !== CUENTA) return;
    if (run.enviadoEn === run.log.length) return;
    cuentaReloj();
    const tiempo = Math.max(1, Math.round(run.relA || 0));
    const prueba = { v: 1, s: run.nonce, u: run.u, i: run.inicial, d: run.log.join(' '), a: tiempo, w: Math.round(run.relW || 0) };
    const puntos = M.puntaje(run), especies = M.atrapados(run);
    if (puntos >= 1) Club.result({ categoria: CAT_PUNTOS, puntos, tiempo }, prueba);
    if (especies >= 1) Club.result({ categoria: CAT_POKEDEX, puntos: especies, tiempo }, prueba);
    run.enviadoEn = run.log.length;
    guarda(K_RUN, run);
  }

  /* Quién juega: chico (Rojo) o chica (Hoja), sprites de Rojo Fuego /
     Verde Hoja. El nombre es el apodo de Juegos si hay sesión; si no,
     «Entrenador» o «Entrenadora». */
  const K_PERFIL = 'pokelike.perfil';
  let perfil = lee(K_PERFIL);
  if (!perfil || !['h', 'm'].includes(perfil.genero)) perfil = null;
  const SPRITE_YO = { h: 'red-gen3', m: 'leaf-gen3' };
  const esChica = () => !!perfil && perfil.genero === 'm';
  const nombreYo = () => { const u = DEX.cuenta().usuario; return u ? u.nombre : esChica() ? 'Entrenadora' : 'Entrenador'; };
  const bienvenid = () => esChica() ? 'Bienvenida' : 'Bienvenido';
  const spriteYo = () => SPRITE_YO[(perfil && perfil.genero) || 'h'];
  // Tu entrenador con su título (pantalla de campeón y fin de la Ruta Infinita).
  const fichaYo = titulo => `<div class="ficha-yo"><img alt="" data-entrenador="${spriteYo()}">
    <div><small>${titulo}</small><b translate="no">${esc(nombreYo())}</b></div></div>`;
  const ponFichaYo = raiz => raiz.querySelectorAll('.ficha-yo img[data-entrenador]').forEach(img => ponEntrenador(img, img.dataset.entrenador));
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
  const filaMedallas = () => `<div class="medallas" aria-label="Medallas: ${run.medallas} de 8">${MEDALLAS.map((j, i) =>
    `<span class="medalla-mini" title="${j.medalla}">${MED.svg(i, i < run.medallas ? '' : 'sombra')}</span>`).join('')}</div>`;
  /* El estuche de medallas: las ganadas en su casilla, la recién ganada
     entra con brillo (`nueva`) y las que faltan son su sombra. */
  const estuche = (nueva = -1) => `<div class="estuche" aria-label="Medallas: ${run.medallas} de 8">${MEDALLAS.map((j, i) =>
    `<div class="casilla${i === nueva ? ' nueva' : ''}" title="${j.medalla}">${MED.svg(i, i < run.medallas ? '' : 'sombra')}
      ${i === nueva ? '<i class="destello"></i>' : ''}</div>`).join('')}</div>`;

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

  const MARCA_DEX = ['✦ ¡Nuevo en tu Pokédex!', '👁 Visto, sin capturar', '◓ Ya está en tu Pokédex'];
  function cartaPokemon(p, i, enDex = null) {
    const ms = M.movimientos(p.e, p.nv).map(m => `<li>${esc(m.nombre)} · ${m.poder}</li>`).join('');
    const marca = enDex === null ? '' : `<div class="dex-marca dex-${enDex}">${MARCA_DEX[enDex]}</div>`;
    return `<button type="button" class="carta" data-i="${i}">
      <img alt="" data-spr="${p.e}"><div class="nombre" translate="no">${nombre(p.e)}</div>
      <div>Nv ${p.nv}</div><div class="tipos">${chipsTipo(p.e)}</div><ul>${ms}</ul>${marca}</button>`;
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
    pintaBotonDex();
    $('btnFama').hidden = !leeFama().length;
  }

  // ── Modo prueba ─────────────────────────────────────────────────────
  const NOMBRES_TRAMO = D.TRAMOS.map((t, i) => t.liga ? 'Liga Pokémon' : `${i + 1}. ${t.jefes[0].nombre}`);
  function pintaPrueba() {
    $('zonaPrueba').hidden = !EN_LOCAL;
    $('chkPrueba').checked = opc.debug;
    $('pruebaOpc').hidden = !opc.debug;
    $('chkInmortal').checked = opc.inmortal;
    $('selDesde').innerHTML = NOMBRES_TRAMO.map((n, i) => `<option value="${i}"${i === opc.desde ? ' selected' : ''}>${n}</option>`).join('');
    $('btnPrueba').hidden = !opc.debug;
    $('marcaPrueba').hidden = !(run && run.debug);
  }
  $('chkPrueba').onchange = () => { opc.debug = EN_LOCAL && $('chkPrueba').checked; guardaOpc(); pintaPrueba(); };
  $('chkInmortal').onchange = () => { opc.inmortal = $('chkInmortal').checked; guardaOpc(); };
  $('selDesde').onchange = () => { opc.desde = Number($('selDesde').value); guardaOpc(); };
  const inmortal = () => opc.debug && opc.inmortal;

  // Panel 🐞 de la barra: atajos según dónde estés.
  $('btnPrueba').onclick = () => {
    if (!EN_LOCAL) return;
    S.clic();
    const enCombate = !$('vCombate').hidden && run && run.combate;
    const b = [];
    if (enCombate) b.push({ txt: '⚡ Ganar este combate', fn: () => { gen++; M.debugGanar(run); M.terminarCombate(run); guardaRun(); reanuda(); } });
    if (run && run.fase !== 'fin' && $('vTitulo').hidden && !run.infinito) {
      b.push({ txt: '🏆 Ir al jefe', fn: () => { M.debugIrAlJefe(run); guardaRun(); reanuda(); } });
      b.push({ txt: tramo().liga ? '⏭ Ganar la Liga' : '⏭ Saltar gimnasio (+medalla)', fn: () => { M.debugSaltarTramo(run); guardaRun(); reanuda(); } });
      b.push({ txt: '⬆ +5 niveles al equipo', fn: () => { M.debugSubirNiveles(run, 5); guardaRun(); reanuda(); } });
    }
    if (run) b.push({ txt: `🔄 Reiniciar partida (con ${nombre(run.inicial)})`, fn: () => empiezaPartida(run.inicial) });
    const inicialPrueba = run ? run.inicial : D.INICIALES[1];
    b.push({ txt: '🏁 A la Liga con equipo Nv 55', fn: () => empiezaPrueba(M.debugLigaFuerte, inicialPrueba) });
    b.push({ txt: '♾ A la Ruta Infinita con equipo Nv 75', fn: () => empiezaPrueba(M.debugInfinito, inicialPrueba) });
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
    S.clic();
    if (!perfil) return pintaPerfil(pintaIniciales);
    pintaIniciales();
  };

  function pintaPerfil(luego) {
    const u = DEX.cuenta().usuario;
    abreCapa('¿Quién eres?', u ? `Te reconozco por tu cuenta: te llamaré «${u.nombre}».`
      : 'Sin sesión iniciada te llamaré «Entrenador» o «Entrenadora». Con sesión, uso tu apodo de Juegos.',
      `<div class="cartas generos">
        <button type="button" class="carta genero${perfil && perfil.genero === 'h' ? ' elegida' : ''}" data-g="h"><img alt="" data-yo="h"><div class="nombre">Chico</div></button>
        <button type="button" class="carta genero${esChica() ? ' elegida' : ''}" data-g="m"><img alt="" data-yo="m"><div class="nombre">Chica</div></button></div>`,
      [{ txt: 'Volver', cls: 'secundario', fn: pintaTitulo }]);
    $('capaCuerpo').querySelectorAll('img[data-yo]').forEach(img => ponEntrenador(img, SPRITE_YO[img.dataset.yo]));
    $('capaCuerpo').onclick = ev => {
      const c = ev.target.closest('[data-g]'); if (!c) return;
      S.clic();
      perfil = { genero: c.dataset.g };
      guarda(K_PERFIL, perfil);
      cierraCapa();
      luego();
    };
  }
  $('btnInicio').onclick = () => { S.clic(); pintaTitulo(); };
  // Reinicio rápido: mismo inicial, mapa nuevo. Solo pregunta si ya hay medallas que perder.
  $('btnReiniciar').onclick = () => {
    if (run.medallas > 0 && !confirm(`¿Empezar de nuevo? Pierdes la partida en curso y sus ${run.medallas} medallas.`)) return;
    S.clic(); empiezaPartida(run.inicial);
  };

  /* El Profesor Oak acompaña la elección: saluda y después va dando
     consejos solos (o al tocar su globo). */
  const CONSEJOS_OAK = [
    '¡Hola! Bienvenido al mundo de los Pokémon. Soy el Profesor Oak.',
    'Para empezar tu viaje necesitas un compañero. Elige uno de estos tres.',
    'Squirtle es la opción más tranquila: el agua le gana a los Pokémon roca de Brock.',
    'Bulbasaur también le gana a Brock con sus ataques de planta. Un buen comienzo.',
    'Charmander lo pasa mal contra Brock… pero si aguanta, se vuelve un Charizard temible.',
    'En el mapa, las pokébolas son capturas: arma un equipo con tipos variados.',
    'Antes de un líder, toca el ojo para ver su equipo y ordena el tuyo arrastrando.',
    'El primero de tu equipo sale a pelear. Pon adelante a quien tenga ventaja de tipo.',
    'Los Centros Pokémon curan a todo tu equipo. Pasa por uno antes del líder.',
    'Si el camino no te convence, puedes empezar de nuevo con el mismo compañero.',
  ];
  let oakGen = 0;
  async function hablaOak(desde = 0) {
    const g = ++oakGen;
    for (let i = desde; g === oakGen && !$('vInicial').hidden; i++) {
      const linea = i % CONSEJOS_OAK.length === 0
        ? `¡Hola, ${nombreYo()}! ${bienvenid()} al mundo de los Pokémon. Soy el Profesor Oak.` : CONSEJOS_OAK[i % CONSEJOS_OAK.length];
      $('oakGlobo').onclick = () => { S.clic(); hablaOak(i + 1); };
      for (let k = 1; k <= linea.length; k++) {
        if (g !== oakGen || $('vInicial').hidden) return;
        $('oakTxt').textContent = linea.slice(0, k);
        await espera(22);
      }
      await espera(i < 2 ? 3200 : 5200);
    }
  }

  function pintaIniciales() {
    muestra('vInicial'); cierraCapa();
    ponEntrenador($('oakSprite'), 'oak');
    hablaOak();
    $('btnCambiarYo').innerHTML = `<img alt="" id="yoMini"> ${esc(nombreYo())} · cambiar`;
    ponEntrenador($('yoMini'), SPRITE_YO[(perfil && perfil.genero) || 'h']);
    $('btnCambiarYo').onclick = () => { S.clic(); pintaPerfil(pintaIniciales); };
    const cont = $('iniciales');
    cont.innerHTML = D.INICIALES.map(e => cartaPokemon({ e, nv: D.NIVEL_INICIAL }, e)).join('');
    ponSprites(cont);
    cont.onclick = ev => {
      const c = ev.target.closest('.carta'); if (!c) return;
      S.clic();
      empiezaPartida(Number(c.dataset.i));
    };
  }

  function empiezaPrueba(crear, inicial) {
    gen++;
    run = crear((Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0, inicial);
    run.inicio = Date.now();
    relojDesde = null;
    guardaRun(); cierraCapa(); pintaMapa();
  }

  function empiezaPartida(inicial) {
    const semilla = (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) | 0; // solo la semilla; lo demás sale de ella
    run = opc.debug && opc.desde > 0
      ? M.debugEmpezarEn(semilla, inicial, opc.desde)
      : M.nuevaRun(semilla >>> 0, inicial, CUENTA);
    run.inicio = Date.now();
    relojDesde = null;
    guardaRun();
    cierraCapa();
    pintaMapa();
  }

  // ── Mapa y equipo ───────────────────────────────────────────────────
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
        ${iconoNodo(n, x, y, r)}</g>`;
      if (n.tipo === 'jefe' && !visit.has(n.id)) {
        s += `<g class="ver" data-ver="${n.id}" tabindex="0" role="button" aria-label="Ver el equipo de ${esc(nombreNodo(n))}">
          <title>Ver su equipo</title><circle cx="${x + r * 0.85}" cy="${y - r * 0.85}" r="12"/>
          <svg class="ico-ver" x="${x + r * 0.85 - 9}" y="${y - r * 0.85 - 9}" width="18" height="18" viewBox="0 0 100 100">${IC.cuerpo('ojo')}</svg></g>`;
      }
    }
    const svg = $('mapa');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    svg.querySelectorAll('image[data-entrenador]').forEach(img => ponEntrenadorSvg(img, img.dataset.entrenador));
    const elige = el => {
      const v = el.closest('[data-ver]'); if (v) return verEquipoNodo(v.dataset.ver);
      const g = el.closest('.nodo.libre'); if (g) entrarNodo(g.dataset.id);
    };
    svg.onclick = ev => elige(ev.target);
    svg.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elige(ev.target); } };
    pintaZona();
    pintaEquipo();
    centraMapa();
  }

  /* El mapa se desplaza dentro de su caja (la página no): se centra en los
     caminos que se pueden elegir o, si no hay, en el nodo actual. */
  function centraMapa() {
    const caja = $('mapa').parentElement;
    const nodos = [...$('mapa').querySelectorAll('.nodo.libre')];
    if (!nodos.length) nodos.push(...$('mapa').querySelectorAll('.nodo.actual'));
    if (!nodos.length || !caja.clientHeight) return;
    const arriba = caja.getBoundingClientRect().top - caja.scrollTop;
    const rects = nodos.map(n => n.getBoundingClientRect());
    const centro = (Math.min(...rects.map(r => r.top)) + Math.max(...rects.map(r => r.bottom))) / 2 - arriba;
    const suave = document.visibilityState === 'visible' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    caja.scrollTo({ top: centro - caja.clientHeight / 2, behavior: suave ? 'smooth' : 'auto' });
  }

  function pintaZonaInfinita() {
    const I = run.infinito, d = M.dificultad(run), falta = M.INF_CADA - I.victorias % M.INF_CADA;
    $('zona').textContent = `Ruta Infinita · Piso ${I.piso}`;
    $('medallasPanel').innerHTML = filaMedallas() + `<div class="inf-panel">
      <b>♾ Ruta Infinita · Piso ${I.piso}</b>
      <span>Dificultad <b>${d}</b> · rivales Nv ~${M.nivelInfinito(run)}</span>
      <span>${I.victorias} victorias · sube en ${falta} ${falta === 1 ? 'combate' : 'combates'}</span>
      <span>Puntaje <b>${M.puntaje(run)}</b></span></div>`;
    pintaPrueba();
  }

  /* El dibujo de cada nodo: la medalla que da el líder, la cara de quien
     espera en la Liga, o el ícono del tipo de nodo. */
  function iconoNodo(n, x, y, r) {
    if (n.tipo === 'jefe') {
      const t = tramo();
      if (!t.liga) {
        const k = r * 1.35;
        return `<svg class="ico-nodo" x="${x - k / 2}" y="${y - k / 2}" width="${k}" height="${k}" viewBox="0 0 100 100">${MED.cuerpo(run.tramo)}</svg>`;
      }
      const cara = `cara-${n.id}`;
      return `<clipPath id="${cara}"><circle cx="${x}" cy="${y}" r="${r - 3}"/></clipPath>
        <image data-entrenador="${t.jefes[n.jefe || 0].sprite}" x="${x - r * 2}" y="${y - r * 1.15}" width="${r * 4}" height="${r * 4}"
          clip-path="url(#${cara})" preserveAspectRatio="xMidYMin meet" style="image-rendering:pixelated"/>`;
    }
    const k = r * 1.45;
    return `<svg class="ico-nodo" x="${x - k / 2}" y="${y - k / 2}" width="${k}" height="${k}" viewBox="0 0 100 100">${IC.cuerpo(n.tipo)}</svg>`;
  }
  function ponEntrenadorSvg(img, s) {
    const prueba = [s, s + '-gen3', s + '-gen4'];
    const pon = () => img.setAttribute('href', urlEntrenador(prueba[0]));
    img.addEventListener('error', () => { prueba.shift(); if (prueba.length) pon(); });
    pon();
  }

  function pintaZona() {
    if (run.infinito) return pintaZonaInfinita();
    const t = tramo();
    $('zona').textContent = `${t.liga ? 'Liga Pokémon' : 'Rumbo a ' + t.jefes[0].nombre} · ${M.zonaDe(run, M.nodo(run, run.pos)).nombre}`;
    $('medallasPanel').innerHTML = filaMedallas();
    pintaPrueba();
  }

  function pintaEquipo() {
    const f = primerVivo(), puede = run.fase === 'mapa';
    $('nEquipo').textContent = `${run.equipo.length}/${M.MAX_EQUIPO}`;
    $('btnReiniciar').textContent = `🔄 Empezar de nuevo con ${nombre(run.inicial)}`;
    const ol = $('equipo');
    ol.innerHTML = run.equipo.map((p, i) => {
      const st = M.stats(p.e, p.nv), movs = M.movimientos(p.e, p.nv).map(m => `${m.nombre} (${m.tipo} ${m.poder})`).join(', ');
      return `<li class="miembro${i === f ? ' frente' : ''}${p.ps <= 0 ? ' caido' : ''}" data-i="${i}" title="${esc(movs)}">
        <button type="button" class="asa" data-asa="${i}" aria-label="Mover a ${esc(nombre(p.e))} (arrastra o usa ↑↓)" ${!puede || run.equipo.length < 2 ? 'disabled' : ''}><i></i></button>
        <img alt="" data-spr="${p.e}">
        <div><div class="linea"><b translate="no">${nombre(p.e)}</b><span>Nv ${p.nv}</span></div>
          <div class="barra-ps"><i style="width:${pct(p.ps, st.ps)}%" class="${pct(p.ps, st.ps) <= 20 ? 'bajo' : pct(p.ps, st.ps) <= 50 ? 'medio' : ''}"></i></div>
          <div class="linea chico"><span translate="no">${p.ps}/${st.ps} PS</span><span class="tipos">${chipsTipo(p.e)}</span></div>
          <div class="barra-xp"><i style="width:${pct(p.xp, M.xpParaSubir(p.nv))}%"></i></div></div></li>`;
    }).join('');
    ponSprites(ol);
    ol.onpointerdown = arrastraMiembro;
    ol.onkeydown = ev => {
      const asa = ev.target.closest('.asa');
      const dir = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
      if (!asa || !dir) return;
      ev.preventDefault();
      const de = Number(asa.dataset.asa);
      if (mueveMiembro(de, de + dir)) $('equipo').querySelector(`[data-asa="${de + dir}"]`).focus();
    };
  }

  // Lleva al miembro `de` a la posición `a`, de a un paso con el motor.
  function mueveMiembro(de, a) {
    a = Math.max(0, Math.min(run.equipo.length - 1, a));
    if (de === a) return false;
    const dir = a > de ? 1 : -1;
    for (let i = de; i !== a; i += dir) if (!M.moverEnEquipo(run, i, dir)) return false;
    S.clic(); guardaRun(); pintaEquipo();
    return true;
  }

  /* Arrastrar desde el asa (ratón o dedo): el miembro sigue al puntero y
     se suelta sobre el lugar que ocupará. Sirve igual en la columna de
     escritorio y en la grilla de dos columnas del celular. */
  function arrastraMiembro(ev) {
    const asa = ev.target.closest('.asa');
    if (!asa || asa.disabled || ev.button > 0) return;
    ev.preventDefault();
    const ol = $('equipo'), li = asa.closest('.miembro'), de = Number(li.dataset.i);
    const items = [...ol.querySelectorAll('.miembro')];
    const centros = items.map(el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const x0 = ev.clientX, y0 = ev.clientY;
    let destino = de;
    asa.setPointerCapture(ev.pointerId);
    li.classList.add('arrastrando'); ol.classList.add('ordenando');
    const mueve = e => {
      li.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px)`;
      const d = centros.map(([cx, cy]) => Math.hypot(e.clientX - cx, e.clientY - cy));
      destino = d.indexOf(Math.min(...d));
      items.forEach((el, k) => el.classList.toggle('destino', k === destino && k !== de));
    };
    const suelta = () => {
      asa.removeEventListener('pointermove', mueve);
      asa.removeEventListener('pointerup', suelta);
      asa.removeEventListener('pointercancel', suelta);
      li.style.transform = '';
      li.classList.remove('arrastrando'); ol.classList.remove('ordenando');
      items.forEach(el => el.classList.remove('destino'));
      mueveMiembro(de, destino);
    };
    asa.addEventListener('pointermove', mueve);
    asa.addEventListener('pointerup', suelta);
    asa.addEventListener('pointercancel', suelta);
  }

  function entrarNodo(id) {
    if (!M.entrar(run, id)) return;
    S.clic(); guardaRun(); reanuda();
  }

  // ── Equipo del rival (👁) ───────────────────────────────────────────
  const TIPOS = Object.keys(D.TABLA);
  function listaRival(eq, estados = null) {
    return `<ol class="rival-lista">${eq.map((p, k) => {
      const debil = TIPOS.filter(t => M.efectividad(t, ESP[p.e].t) > 1);
      const [cls, txt] = estados ? estados[k] : ['', ''];
      return `<li class="${cls}"><span class="orden">${k + 1}</span><img alt="" data-spr="${p.e}">
        <div><div><b translate="no">${nombre(p.e)}</b> <span>Nv ${p.nv}</span> <span class="tipos">${chipsTipo(p.e)}</span></div>
          <small>Débil a: ${debil.map(t => `<span class="tipo" style="background:${D.COLOR_TIPO[t]}">${t}</span>`).join(' ') || '—'}</small></div>
        ${txt ? `<em>${txt}</em>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  // Solo líderes, Alto Mando y Campeón: su equipo es fijo y se puede mostrar antes.
  function verEquipoNodo(id) {
    const n = M.nodo(run, id);
    if (run.fase !== 'mapa' || n.tipo !== 'jefe') return;
    const j = tramo().jefes[n.jefe || 0];
    const titulo = `${j.nombre} · ${j.titulo}`;
    const eq = M.equipoJefe(run, n.jefe || 0).map(([e, nv]) => ({ e, nv }));
    S.clic();
    abreCapa(`Equipo de ${titulo}`, `${eq.length} Pokémon, en el orden en que salen.`, listaRival(eq),
      [{ txt: 'Cerrar', cls: 'secundario', fn: cierraCapa }]);
    $('capaCuerpo').onclick = null;
  }
  function verEquipoCombate() {
    const cb = run.combate; if (!cb || cb.tipo !== 'jefe') return;
    const estados = rivalVivos.quedan.map((vivo, k) => !vivo ? ['caido', 'Debilitado'] : k === rivalVivos.i ? ['activo', 'Peleando'] : ['', 'Por salir']);
    S.clic();
    abreCapa(`Equipo de ${cb.rival.nombre}`, 'En el orden en que salen.', listaRival(cb.enemigos, estados),
      [{ txt: 'Cerrar', cls: 'secundario', fn: cierraCapa }]);
    $('capaCuerpo').onclick = null;
  }
  $('btnVerRival').onclick = verEquipoCombate;

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
    const enDex = run.oferta.map(p => DEX.estado(p.e));
    if (!run.debug) run.oferta.forEach(p => DEX.ve(p.e));
    pintaOferta(enDex, null);
  }
  /* La oferta arriba y el equipo abajo. Con el equipo lleno, elegir una
     carta enciende las casillas del equipo: tocar una la reemplaza. */
  function pintaOferta(enDex, elegida) {
    const lleno = run.equipo.length >= M.MAX_EQUIPO;
    const reemplazo = lleno && elegida !== null;
    const txt = !lleno ? `Elige uno para tu equipo (${run.equipo.length}/${M.MAX_EQUIPO}).`
      : reemplazo ? `¿A quién reemplaza ${nombre(run.oferta[elegida].e)}? Toca uno de tu equipo.`
        : 'Tu equipo está lleno: elige uno y luego a quién reemplaza.';
    const cartas = run.oferta.map((p, i) => cartaPokemon(p, i, enDex[i]).replace('class="carta"', `class="carta${i === elegida ? ' elegida' : ''}"`)).join('');
    const equipo = run.equipo.map((p, j) => {
      const max = M.stats(p.e, p.nv).ps;
      return `<button type="button" class="cap-miembro" data-sale="${j}" ${reemplazo ? '' : 'disabled'}>
        <img alt="" data-spr="${p.e}"><span class="cap-datos"><b translate="no">${nombre(p.e)}</b> <span>Nv ${p.nv}</span>
        <span class="tipos">${chipsTipo(p.e)}</span><small translate="no">${p.ps}/${max} PS</small></span>
        ${reemplazo ? '<em>↔ Reemplazar</em>' : ''}</button>`;
    }).join('');
    abreCapa('¡Pokémon a la vista!', txt,
      `<div class="cartas">${cartas}</div>
       <h3 class="cap-tit">Tu equipo <small>${run.equipo.length}/${M.MAX_EQUIPO}</small></h3>
       <div class="cap-equipo${reemplazo ? ' reemplazo' : ''}">${equipo}</div>`,
      [{ txt: 'No capturar', cls: 'secundario', fn: () => { M.capturar(run, null); guardaRun(); reanuda(); } }]);
    $('capaCuerpo').onclick = ev => {
      const sale = ev.target.closest('[data-sale]');
      if (sale && reemplazo) { S.cura(); M.capturar(run, elegida, Number(sale.dataset.sale)); guardaRun(); return reanuda(); }
      const c = ev.target.closest('.carta'); if (!c) return;
      const i = Number(c.dataset.i);
      if (!lleno) { S.cura(); M.capturar(run, i); guardaRun(); return reanuda(); }
      S.clic(); pintaOferta(enDex, i === elegida ? null : i);
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
    const frase = (MED.DIALOGOS[j.nombre] || {}).despues;
    S.victoria();
    setTimeout(() => S.evoluciona(), 1300);
    abreCapa(`¡${j.medalla}!`, `Venciste a ${j.nombre}. Tu equipo descansa antes de seguir.`,
      (frase ? `<div class="globo-jefe"><img alt="" id="globoSprite"><p><b translate="no">${esc(j.nombre)}:</b> ${esc(frase)}</p></div>` : '')
        + estuche(run.medallas - 1) + miniEquipo(),
      [{ txt: sig.liga ? '▶ Rumbo a la Liga Pokémon' : `▶ Rumbo a ${sig.jefes[0].lugar}`, fn: () => { M.siguienteTramo(run); guardaRun(); reanuda(); } }]);
    $('capaCuerpo').onclick = null;
    if (frase) ponEntrenador($('globoSprite'), j.sprite);
  }

  function pintaFin() {
    enviaClub();
    if (run.infinito) return pintaFinInfinito();
    if (!run.fin) { run.fin = Date.now(); guardaRun(); }
    const seg = Math.round((run.fin - (run.inicio || run.fin)) / 1000);
    const gano = run.resultado === 'victoria';
    if (gano && !run.famaVista) return paseoFama(() => { run.famaVista = true; guardaRun(); pintaFin(); });
    if (gano && !run.enFama) { guardaFama(run, seg); run.enFama = true; guardaRun(); }
    const donde = tramo().liga ? 'la Liga Pokémon' : tramo().jefes[0].lugar;
    const campeon = tramo().jefes[4];
    const frase = gano ? (MED.DIALOGOS[campeon.nombre] || {}).despues?.replace('el nuevo Campeón', esChica() ? 'la nueva Campeona' : 'el nuevo Campeón') : null;
    const puntos = `<p class="puntaje">Puntaje: <b>${M.puntaje(run)}</b></p>`;
    abreCapa(gano ? `¡${esChica() ? 'Campeona' : 'Campeón'} de la Liga Pokémon!` : 'Fin del camino',
      (gano ? `Venciste al Alto Mando y a ${campeon.nombre} en ${reloj(seg)}.` : `Tu equipo cayó camino a ${donde}, con ${run.medallas} medallas, tras ${reloj(seg)}.`)
        + (run.debug ? ' (partida de prueba)' : ''),
      (gano ? (frase ? `<div class="globo-jefe"><img alt="" id="globoSprite"><p><b translate="no">${esc(campeon.nombre)}:</b> ${esc(frase)}</p></div>` : '')
        + fichaYo(esChica() ? 'Campeona de la Liga Pokémon' : 'Campeón de la Liga Pokémon') + estuche() + puntos
        + '<p class="chico">Tu equipo campeón quedó en el Salón de la Fama. ¿Te atreves con la Ruta Infinita? Ahí puedes seguir subiendo tu puntaje peleando con entrenadores cada vez más fuertes, sin final, o seguir completando tu Pokédex con las capturas del camino.</p>'
        : filaMedallas() + puntos) + miniEquipo(),
      gano ? [{ txt: '♾ Seguir a la Ruta Infinita', fn: () => { M.empezarInfinito(run); guardaRun(); reanuda(); } },
        { txt: '✦ Nueva partida', cls: 'secundario', fn: pintaIniciales }, { txt: 'Título', cls: 'secundario', fn: pintaTitulo }]
        : [{ txt: '✦ Nueva partida', fn: pintaIniciales }, { txt: 'Título', cls: 'secundario', fn: pintaTitulo }]);
    $('capaCuerpo').onclick = null;
    if (frase) ponEntrenador($('globoSprite'), campeon.sprite);
    ponFichaYo($('capaCuerpo'));
  }

  function pintaFinInfinito() {
    const I = run.infinito;
    if (!run.enFamaInf) { actualizaFama(run); run.enFamaInf = true; guardaRun(); }
    abreCapa('Fin de la Ruta Infinita', `Llegaste al piso ${I.piso} con ${I.victorias} victorias (dificultad ${M.dificultad(run)}).`
      + (run.debug ? ' (partida de prueba)' : ''),
      `${fichaYo(`Piso ${I.piso} de la Ruta Infinita`)}<p class="puntaje">Puntaje final: <b>${M.puntaje(run)}</b></p>${estuche()}${miniEquipo()}`,
      [{ txt: '✦ Nueva partida', fn: pintaIniciales }, { txt: 'Título', cls: 'secundario', fn: pintaTitulo }]);
    $('capaCuerpo').onclick = null;
    ponFichaYo($('capaCuerpo'));
  }

  /* El desfile del Salón de la Fama, como en los juegos: cada Pokémon del
     equipo campeón pasa solo por la pantalla y al final, todos juntos. Se
     avanza solo o tocando. */
  function paseoFama(alTerminar) {
    const el = $('paseo');
    cierraCapa();
    el.hidden = false;
    S.victoria();
    let i = -1, reloj1 = null;
    const tecla = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); avanza(); } };
    function avanza() {
      clearTimeout(reloj1);
      i++;
      if (i < run.equipo.length) {
        const p = run.equipo[i];
        el.classList.remove('final');
        ponImg($('paseoSpr'), p.e, { animado: true });
        $('paseoNum').textContent = '#' + String(p.e).padStart(3, '0');
        $('paseoNom').textContent = nombre(p.e);
        $('paseoNv').textContent = `Nv ${p.nv}`;
        $('paseoTipos').innerHTML = chipsTipo(p.e);
        $('paseoCuenta').textContent = `${i + 1} de ${run.equipo.length}`;
        const c = $('paseoCarta'); c.classList.remove('entra'); void c.offsetWidth; c.classList.add('entra');
        S.nivel();
        reloj1 = setTimeout(avanza, 2600);
      } else if (i === run.equipo.length) {
        el.classList.add('final');
        $('paseoTit').textContent = `¡${bienvenid()} al Salón de la Fama, ${nombreYo()}!`;
        ponEntrenador($('paseoYo'), spriteYo());
        $('paseoTodos').innerHTML = run.equipo.map(p => `<figure><img alt="" data-spr="${p.e}"><figcaption translate="no">${nombre(p.e)}<br>Nv ${p.nv}</figcaption></figure>`).join('');
        ponSprites($('paseoTodos'));
        S.evoluciona();
        reloj1 = setTimeout(avanza, 4500);
      } else {
        el.hidden = true; el.onclick = null;
        document.removeEventListener('keydown', tecla);
        alTerminar();
      }
    }
    el.onclick = () => { S.clic(); avanza(); };
    document.addEventListener('keydown', tecla);
    avanza();
  }

  // ── Salón de la Fama ────────────────────────────────────────────────
  /* Cada Liga ganada guarda el equipo con el que se venció al Campeón (la
     última pelea). Por ahora en este navegador; cuando haya clasificación
     del Club (Fase 2), cada fila del ranking llevará este mismo `equipo`. */
  const K_FAMA = 'pokelike.fama', MAX_FAMA = 30;
  const leeFama = () => { const f = lee(K_FAMA); return Array.isArray(f) ? f : []; };
  function guardaFama(r, seg) {
    const fila = { id: r.semilla, at: r.fin, inicial: r.inicial, seg, debug: !!r.debug, puntaje: M.puntaje(r),
      nombre: nombreYo(), genero: (perfil && perfil.genero) || 'h', dex: DEX.resumen().capturados,
      equipo: r.equipo.map(p => ({ e: p.e, nv: p.nv, vivo: p.ps > 0 })) };
    guarda(K_FAMA, [fila, ...leeFama()].slice(0, MAX_FAMA));
  }
  // Al terminar la Ruta Infinita, la fila de esa Liga suma lo que se logró.
  function actualizaFama(r) {
    const filas = leeFama(), f = filas.find(x => x.id === r.semilla);
    if (!f) return;
    f.puntaje = M.puntaje(r);
    f.infinito = { victorias: r.infinito.victorias, piso: r.infinito.piso };
    f.dex = DEX.resumen().capturados;
    guarda(K_FAMA, filas);
  }
  const reloj = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  function abreFama() {
    const filas = leeFama();
    S.clic();
    abreCapa('🏆 Salón de la Fama', filas.length ? 'Los equipos con los que venciste a la Liga Pokémon.' : 'Todavía no hay campeones. ¡Gana la Liga para entrar!',
      `<ol class="fama">${filas.map(f => `<li><div class="fama-cab"><img alt="" class="fama-yo" data-entrenador="${SPRITE_YO[f.genero] || SPRITE_YO.h}">${f.nombre ? `<b translate="no">${esc(f.nombre)}</b> ·` : ''} <b>${new Date(f.at).toLocaleDateString()}</b>
        <span>con ${nombre(f.inicial)} · ${reloj(f.seg)}</span>${f.puntaje ? `<span>· <b>${f.puntaje}</b> pts</span>` : ''}
        ${f.infinito ? `<span>· ♾ ${f.infinito.victorias} victorias (piso ${f.infinito.piso})</span>` : ''}${f.dex != null ? `<span>· 📕 ${f.dex}/${DEX.N}</span>` : ''}${f.debug ? '<span class="marca-prueba">PRUEBA</span>' : ''}</div>
        <div class="mini-equipo">${f.equipo.map(p => `<figure class="${p.vivo ? '' : 'caido'}"><img alt="" data-spr="${p.e}">
          <figcaption translate="no">${nombre(p.e)} · Nv ${p.nv}</figcaption></figure>`).join('')}</div></li>`).join('')}</ol>`,
      [{ txt: 'Cerrar', cls: 'secundario', fn: cierraCapa }]);
    $('capaCuerpo').onclick = null;
    $('capaCuerpo').querySelectorAll('img.fama-yo').forEach(img => ponEntrenador(img, img.dataset.entrenador));
  }
  $('btnFama').onclick = abreFama;

  // ── Pokédex ─────────────────────────────────────────────────────────
  let filtroDex = 'todos';
  const numDex = e => '#' + String(e).padStart(3, '0');
  function pintaCuentaDex() {
    const c = DEX.cuenta(), el = $('dexCuenta');
    if (!c.disponible || c.estado === 'cargando') { el.innerHTML = '💾 Guardada en este navegador.'; return; }
    if (!c.usuario) {
      el.innerHTML = '💾 Guardada solo en este navegador. <button type="button" class="mini" data-dex="entrar">Iniciar sesión</button> para tenerla en tu cuenta y en cualquier dispositivo.';
      return;
    }
    const estado = { sincronizando: 'sincronizando…', 'al-dia': 'al día', error: 'no se pudo sincronizar, se reintenta con el próximo cambio' }[c.estado] || '';
    el.innerHTML = `☁ En la cuenta de <b translate="no">${esc(c.usuario.nombre)}</b> · ${estado}
      <button type="button" class="mini" data-dex="salir">Cerrar sesión</button>`;
  }
  function pintaPokedex() {
    const r = DEX.resumen();
    $('dexResumen').innerHTML = `<span><b>${r.vistos}</b> vistos</span><span><b>${r.capturados}</b> capturados</span><span>de ${r.total}</span>
      <span>Récord: <b>${r.liga ? '🏆 Campeón' : r.medallas + (r.medallas === 1 ? ' medalla' : ' medallas')}</b></span>`;
    $('dexFiltro').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtroDex)));
    let html = '';
    for (let e = 1; e <= DEX.N; e++) {
      const st = DEX.estado(e);
      if (filtroDex === 'capturados' && st < 2) continue;
      if (filtroDex === 'faltan' && st === 2) continue;
      html += `<li class="dex-item dex-${st}" title="${st ? esc(nombre(e)) : '???'}">
        <img alt="" loading="lazy" src="${urlSprite(e)}"><small>${numDex(e)}</small>
        <span translate="no">${st ? esc(nombre(e)) : '???'}</span>${st === 2 ? '<i class="dex-bola" aria-label="Capturado">◓</i>' : ''}</li>`;
    }
    $('dexLista').innerHTML = html || '<li class="chico dex-vacia">Nada por aquí todavía.</li>';
    pintaCuentaDex();
  }
  function abrePokedex() {
    S.clic();
    pintaPokedex();
    $('dexCapa').hidden = false;
    $('dexCerrar').focus({ preventScroll: true });
  }
  const cierraPokedex = () => { $('dexCapa').hidden = true; };
  $('btnPokedex').onclick = abrePokedex;
  $('btnPokedexTitulo').onclick = abrePokedex;
  $('dexCerrar').onclick = cierraPokedex;
  $('dexCapa').onclick = ev => {
    if (ev.target === $('dexCapa')) return cierraPokedex();
    const f = ev.target.closest('[data-filtro]');
    if (f) { filtroDex = f.dataset.filtro; S.clic(); pintaPokedex(); return; }
    const a = ev.target.closest('[data-dex]');
    if (a) { S.clic(); a.dataset.dex === 'entrar' ? DEX.entrar() : DEX.salir(); }
  };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('dexCapa').hidden) cierraPokedex(); });
  DEX.alCambiar(() => {
    if (!$('dexCapa').hidden) pintaCuentaDex();
    if (!$('vTitulo').hidden) pintaBotonDex();
  });
  function pintaBotonDex() {
    const r = DEX.resumen();
    $('btnPokedexTitulo').textContent = `📕 Pokédex ${r.capturados}/${r.total}`;
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
    if (lado === 'e' && !run.debug) DEX.ve(p.e);
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
      pintaEquipoCombate();
    }
  }

  /* Resumen del equipo al lado del combate (solo para mirar). `run` ya va un
     turno adelantado mientras se anima, así que el que está peleando se
     pinta con lo que muestra la animación (`vista.j`). */
  function pintaEquipoCombate() {
    const activo = vista.j;
    const filas = run.equipo.map(p => p.uid === activo.uid ? { ...p, e: activo.e, nv: activo.nv, ps: activo.ps, max: activo.max } : { ...p, max: M.stats(p.e, p.nv).ps });
    const siguiente = filas.find(p => p.uid !== activo.uid && p.ps > 0);
    const vivos = filas.filter(p => p.ps > 0).length;
    $('ecResumen').textContent = `${vivos}/${filas.length} en pie`;
    $('ecLista').innerHTML = filas.map(p => {
      const [cls, estado] = p.uid === activo.uid && p.ps > 0 ? ['activo', 'Peleando']
        : p.ps <= 0 ? ['caido', 'Debilitado'] : p === siguiente ? ['siguiente', 'Sale después'] : ['', 'En espera'];
      const porc = pct(p.ps, p.max);
      return `<li class="ec-item ${cls}"><img alt="" src="${urlSprite(p.e)}">
        <div class="ec-datos"><div class="linea"><b translate="no">${nombre(p.e)}</b><span>Nv ${p.nv}</span></div>
          <div class="barra-ps"><i style="width:${porc}%" class="${porc <= 20 ? 'bajo' : porc <= 50 ? 'medio' : ''}"></i></div>
          <div class="linea chico"><span translate="no">${p.ps}/${p.max} PS</span><em>${estado}</em></div></div></li>`;
    }).join('');
  }
  function anima(lado, clase) {
    const img = $(lado === 'j' ? 'spJ' : 'spE');
    img.classList.remove(clase); void img.offsetWidth; img.classList.add(clase);
  }
  const texto = t => { $('texto').textContent = t; };

  // Pokébolas del rival: cuántos Pokémon tiene y cuántos le quedan en pie.
  const rivalVivos = { quedan: [], i: 0 };
  function pintaRivalVivos() {
    const cb = run.combate, el = $('rivalVivos');
    el.hidden = !cb || !cb.rival;
    $('btnVerRival').hidden = cb?.tipo !== 'jefe';
    if (el.hidden) return;
    const n = rivalVivos.quedan.filter(Boolean).length;
    el.innerHTML = rivalVivos.quedan.map(v => `<i class="${v ? 'viva' : 'caida'}"></i>`).join('')
      + `<span>${n}/${rivalVivos.quedan.length}</span>`;
    el.title = `${cb.rival.nombre}: le quedan ${n} de ${rivalVivos.quedan.length} Pokémon`;
  }

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
    const g = ++gen, cb = run.combate; // corta un combate anterior que siguiera animándose
    const zona = M.zonaDe(run, M.nodo(run, run.pos)).nombre;
    const jefe = cb.tipo === 'jefe' ? tramo().jefes[cb.rival.jefe || 0] : null;
    $('zona').textContent = jefe ? jefe.lugar : zona;
    $('arena').className = 'arena' + (run.infinito ? ' liga' : jefe ? (tramo().liga ? ' liga' : ' gimnasio') : ARENA[zona] ? ' ' + ARENA[zona] : '');
    $('btnSeguir').hidden = true;
    resolverEleccion = null;
    $('spYo').hidden = true; $('bolaVuela').hidden = true; $('destelloBola').hidden = true;
    $('arena').style.setProperty('--vel', opc.vel);
    vista.j = vista.e = null;
    especieDe.clear();
    ponLado('j', run.equipo[cb.ij]);
    ponLado('e', cb.enemigos[cb.ie]);
    rivalVivos.quedan = cb.enemigos.map(p => p.ps > 0); rivalVivos.i = cb.ie;
    pintaRivalVivos();
    pintaMovs(); pintaOpciones();
    if (cb.turno === 0) {
      if (cb.rival.sprite) {
        ponEntrenador($('spRival'), cb.rival.sprite);
        $('introTxt').textContent = cb.tipo === 'jefe'
          ? `¡${cb.rival.nombre}, ${cb.rival.titulo}, te desafía!` : `¡${cb.rival.nombre} quiere luchar!`;
        $('introN').textContent = cb.enemigos.length === 1 ? 'Tiene 1 Pokémon' : `Tiene ${cb.enemigos.length} Pokémon`;
        $('intro').hidden = false;
        if (jefe) {
          texto(tramo().liga && !cb.rival.jefe ? 'Tu equipo descansó antes del Alto Mando: ¡todos curados!' : `${cb.rival.nombre} quiere pelear.`);
          await dialogoJefe(jefe, g);
          if (g !== gen) return;
          texto(`${cb.rival.nombre} sacó a ${nombre(cb.enemigos[0].e)}.`);
        } else {
          texto(`${cb.rival.nombre} sacó a ${nombre(cb.enemigos[0].e)}.`);
          await espera(1600 / opc.vel);
        }
        $('intro').hidden = true;
      } else {
        texto(`¡Un ${nombre(cb.enemigos[0].e)} salvaje apareció!`);
        await espera(1100 / opc.vel);
      }
      if (g !== gen) return;
      await lanzaBola(g, true, nombre(run.equipo[cb.ij].e));
      await espera(300 / opc.vel);
    }
    bucle(g);
  }

  /* Tu entrenador entra, lanza la pokébola en arco, se abre con un destello
     y sale el Pokémon. Sin entrenador (`conEntrenador` falso) es solo la
     pokébola, para el que entra cuando cae otro. */
  async function lanzaBola(g, conEntrenador, nom) {
    if (g !== gen) return;
    const yo = $('spYo'), bola = $('bolaVuela'), luz = $('destelloBola'), spJ = $('spJ');
    const T = ms => espera(ms / opc.vel);
    const reinicia = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    $('arena').style.setProperty('--vel', opc.vel);
    spJ.classList.remove('sale-bola');
    spJ.classList.add('guardado');
    if (conEntrenador) {
      ponEntrenador(yo, SPRITE_YO[(perfil && perfil.genero) || 'h']);
      yo.className = 'yo'; yo.hidden = false; reinicia(yo, 'entra');
      await T(450);
      if (g !== gen) return;
      yo.classList.add('lanza');
    }
    texto(`¡Adelante, ${nom}!`);
    bola.hidden = false; reinicia(bola, 'vuela'); S.clic();
    await T(600);
    if (g !== gen) return;
    bola.hidden = true;
    luz.hidden = false; reinicia(luz, 'abre');
    spJ.classList.remove('guardado'); reinicia(spJ, 'sale-bola');
    S.cura();
    if (conEntrenador) reinicia(yo, 'sale');
    await T(500);
    yo.hidden = true; luz.hidden = true;
    spJ.classList.remove('sale-bola');
  }

  /* Líderes, Alto Mando y Campeón hablan antes de pelear. El texto se
     escribe solo; tocar la pantalla (o Enter/Espacio) lo salta y empieza. */
  function dialogoJefe(j, g) {
    const lineas = (MED.DIALOGOS[j.nombre] || {}).antes;
    if (!lineas) return espera(1600 / opc.vel);
    const intro = $('intro');
    $('dlgNombre').textContent = j.nombre;
    $('dlgTxt').textContent = '';
    $('dlgSigue').textContent = 'Toca para saltar ▶';
    $('dialogo').hidden = false;
    intro.classList.add('con-dialogo');
    return new Promise(resolve => {
      let listo = false;
      const tecla = ev => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); termina(); } };
      const vigila = setInterval(() => { if (g !== gen) termina(); }, 200);
      function termina() {
        if (listo) return;
        listo = true;
        clearInterval(vigila);
        intro.onclick = null;
        document.removeEventListener('keydown', tecla);
        $('dialogo').hidden = true;
        intro.classList.remove('con-dialogo');
        resolve();
      }
      intro.onclick = () => { S.clic(); termina(); };
      document.addEventListener('keydown', tecla);
      (async () => {
        let dicho = '';
        for (const linea of lineas) {
          for (let k = 1; k <= linea.length; k++) {
            if (listo) return;
            $('dlgTxt').textContent = dicho + linea.slice(0, k);
            await espera(24);
          }
          dicho += linea + '\n';
          await espera(700);
        }
        if (!listo) $('dlgSigue').textContent = 'Toca para empezar el combate ▶';
      })();
    });
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
          if (x.lado === 'e') { rivalVivos.quedan[rivalVivos.i] = false; pintaRivalVivos(); }
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
            rivalVivos.i = run.combate.ie;
            texto(`${run.combate.rival.nombre} sacó a ${nombre(x.e)}.`);
          } else {
            ponLado('j', run.equipo.find(p => p.uid === x.uid));
            await lanzaBola(g, false, nombre(x.e));
          }
          pintaMovs();
          await T(x.lado === 'e' ? 1000 : 400); break;
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
    const cb = run.combate;
    const deLaLiga = cb && cb.tipo === 'jefe' && tramo().liga ? tramo().jefes[cb.rival.jefe || 0] : null;
    M.terminarCombate(run, { inmortal: inmortal() }); guardaRun();
    if (deLaLiga && !deLaLiga.campeon && run.fase === 'mapa') return pintaAltoMandoVencido(deLaLiga);
    reanuda();
  };

  /* Vencer a un miembro del Alto Mando es un hito: dice unas palabras y
     cuenta cuántos quedan antes del Campeón. */
  function pintaAltoMandoVencido(j) {
    pintaMapa();
    const frase = (MED.DIALOGOS[j.nombre] || {}).despues;
    const quedan = 4 - (run.ligaVencidos || 0);
    S.victoria();
    abreCapa(`¡Venciste a ${j.nombre}!`,
      quedan > 0 ? `Quedan ${quedan} del Alto Mando. Tu equipo se recupera.` : '¡Venciste a todo el Alto Mando! Solo queda el Campeón.',
      (frase ? `<div class="globo-jefe"><img alt="" id="globoSprite"><p><b translate="no">${esc(j.nombre)}:</b> ${esc(frase)}</p></div>` : '') + miniEquipo(),
      [{ txt: quedan > 0 ? '▶ Seguir' : '▶ Al Campeón', fn: reanuda }]);
    $('capaCuerpo').onclick = null;
    if (frase) ponEntrenador($('globoSprite'), j.sprite);
  }

  // Teclado: 1–4 movimientos, A automático, V velocidad.
  document.addEventListener('keydown', ev => {
    if ($('vCombate').hidden || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^[1-4]$/.test(ev.key) && resolverEleccion) $('movs').querySelectorAll('.mov')[Number(ev.key) - 1]?.click();
    else if (ev.key === 'a' || ev.key === 'A') $('btnAuto').click();
    else if (ev.key === 'v' || ev.key === 'V') $('btnVel').click();
  });

  $('leyenda').innerHTML = [['salvaje', 'Salvaje'], ['captura', 'Captura'], ['entrenador', 'Entrenador'], ['centro', 'Centro'], ['gimnasio', 'Líder']]
    .map(([t, txt]) => `<span>${IC.svg(t)} ${txt}</span>`).join('');
  $('btnVerRival').innerHTML = `${IC.svg('ojo')} Ver`;
  if (Club) Club.category(CAT_PUNTOS);
  cuentaReloj();
  $('bolaVuela').innerHTML = IC.svg('captura', 'bola-svg');

  pintaTitulo();
})();
