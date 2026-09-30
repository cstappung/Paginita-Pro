/* Clue - la pantalla.
   Habla con una `conexion` (la mesa de práctica de mesa.js o la sala en
   línea de red.js) y no sabe con cuál: ese contrato está documentado en
   mesa.js. Aquí solo se dibuja lo que dice `est` (el estado del reductor)
   y se mandan las jugadas del jugador. Sin librerías y sin compilar. */
(function () {
  "use strict";
  const M = window.ClueMotor;
  const $ = id => document.getElementById(id);
  const S = 40;                       // píxeles por casilla en el SVG
  const LB = 34;                      // alto de la banda con el nombre de cada sala
  const ONLINE = new URLSearchParams(location.search).get("modo") === "online";

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function lsJson(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  const CA = window.ClueArmas || null;          // dibujos y escenas de las armas (armas.js)
  const ARTICULO_LUGAR = ["el", "el", "el", "el", "el", "la", "la", "el", "la"];
  const enLugar = l => "en " + ARTICULO_LUGAR[l] + " " + M.LUGARES[l].n;
  const conArma = a => "con " + M.ARMAS[a].art + " " + M.ARMAS[a].n;
  const iconoArma = (a, at) => CA ? CA.icono(a, at) : '<span class="fondo-emoji">' + M.ARMAS[a].i + "</span>";

  function esClaro(hex) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  }
  function inicial(nombre) {
    const partes = String(nombre || "?").replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  /* ---------- estado de la pantalla ---------- */
  let conn = null, desuscribir = null, opcionesPractica = null;
  let est = null, priv = null, prev = null;
  const ui = {
    candidato: "",   // personaje marcado en la eleccion, aun sin confirmar
    dlg: null, selS: null, selA: null, selL: null, tab: "hist",
    rolling: false, falsos: [1, 1], tirado: -1, busy: false,
    finCerrado: false, cola: [], vistasVistas: new Set(), primera: true, marcasV: 0
  };
  const anim = {};                    // ficha -> {x, y, id}: posicion mientras se anima
  let animId = 0;
  let marcas = {};                    // marcas manuales de la libreta
  let claveLibreta = "";
  const firmas = {};                  // ultima firma pintada de cada region
  let firmaPantalla = "", firmaModal = "";
  let toastT = null;

  const elenco = () => (conn && conn.elenco && conn.elenco.length ? conn.elenco : M.SOSPECHOSOS);
  const yo = () => conn.yo;
  const jugadorDe = uid => (est && est.jugadores.find(j => j.uid === uid)) || null;
  const nombreDe = uid => { const j = jugadorDe(uid); return j ? j.nombre : "Alguien"; };
  const asientoDe = uid => est ? est.jugadores.findIndex(j => j.uid === uid) : -1;
  const miAsiento = () => asientoDe(yo());
  function personaje(i) {
    const id = est && est.personajes[i];
    return elenco().find(e => e.id === id) || null;
  }
  const nomS = i => { const p = personaje(i); return p ? p.n : M.nombreCarta(i); };
  const nombresPuestos = () => M.COLORES.map((_, i) => nomS(i));
  const nombreCarta = c => M.nombreCarta(c, nombresPuestos());

  /* ---------- avatares y cartas ---------- */
  function avatarHtml(p, color, tam, texto) {
    const claro = esClaro(color);
    const st = tam === "lleno" ? "" : "width:" + tam + "px;height:" + tam + "px;font-size:" + Math.round(tam * 0.4) + "px;";
    const cls = "av" + (tam === "lleno" ? " lleno" : "");
    if (p && p.foto) return '<span class="' + cls + '" style="' + st + "--c:" + color + '"><img src="' + esc(p.foto) + '" alt=""></span>';
    return '<span class="' + cls + ' ini" style="' + st + "background:" + color + ";color:" + (claro ? "#1a1a1a" : "#fff") + '">' + esc(texto || inicial(p ? p.n : "?")) + "</span>";
  }
  const avatarPuesto = (i, tam) => avatarHtml(personaje(i), M.COLORES[i], tam, inicial(nomS(i)));
  const punto = i => '<i class="pt" style="background:' + M.COLORES[i] + '"></i>';
  const chipPuesto = i => punto(i) + esc(nomS(i));
  const chipJugador = uid => { const i = asientoDe(uid); return (i >= 0 ? punto(i) : "") + esc(nombreDe(uid)); };

  function fotoCarta(c) {
    const t = M.tipoCarta(c);
    if (t === "s") return avatarPuesto(c, "lleno");
    if (t === "a") return '<span class="arma-ico">' + iconoArma(c - M.NS) + "</span>";
    return '<img src="img/salas/' + M.LUGARES[c - M.NS - M.NA].img + '.webp" alt="">';
  }
  function cartaHtml(c, extra) {
    return '<div class="carta t-' + M.tipoCarta(c) + (extra ? " " + extra : "") + '"><div class="foto"' + (M.tipoCarta(c) === "a" ? ' data-arma="' + (c - M.NS) + '"' : "") + ">" + fotoCarta(c) + '</div><div class="pie">' + esc(nombreCarta(c)) + "</div></div>";
  }

  /* ============================================================
     Arranque: practica o sala en linea
     ============================================================ */
  function mensajePantalla(titulo, texto, extra) {
    $("juego").hidden = true;
    const p = $("pantalla");
    p.hidden = false;
    p.className = "pantalla centro";
    p.innerHTML = '<div class="caja"><h1 class="logo">CLUE</h1><h2>' + esc(titulo) + "</h2><p>" + esc(texto) + "</p>" + (extra || "") + "</div>";
    firmaPantalla = "";
  }

  function arranca() {
    if (!M) { mensajePantalla("No se pudo cargar el juego", "Falta el motor de reglas. Recarga la página."); return; }
    if (ONLINE) {
      mensajePantalla("Conectando con la sala...", "Un momento, estamos preparando la mesa.");
      if (!window.ClueRed || typeof window.ClueRed.conectar !== "function") {
        mensajePantalla("No hay conexión con la sala", "Este juego necesita el módulo de red y no se cargó. Vuelve a Juegos y reabre la sala.");
        return;
      }
      let p;
      try { p = window.ClueRed.conectar(); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(c => {
        if (!c) throw new Error("sin conexion");
        try { if (c.elenco && c.elenco.length) lsSet("clue.elenco", JSON.stringify(c.elenco)); } catch (e) { /* cupo lleno */ }
        adjunta(c);
      }).catch(e => {
        console.warn("[clue] conexion", e);
        mensajePantalla("No pudimos conectar", "No fue posible entrar a la sala (" + ((e && e.message) || "error") + "). Vuelve a Juegos e intenta de nuevo.");
      });
    } else pantallaInicio();
  }

  function pantallaInicio() {
    if (desuscribir) { try { desuscribir(); } catch (e) { /* nada */ } desuscribir = null; }
    if (conn && conn.destruir) { try { conn.destruir(); } catch (e) { /* nada */ } }
    conn = null; est = null; priv = null; prev = null;
    $("juego").hidden = true;
    const nombre = lsGet("clue.nombre") || "";
    const bots = Math.max(1, Math.min(5, Number(lsGet("clue.bots")) || 3));
    const p = $("pantalla");
    p.hidden = false;
    p.className = "pantalla inicio";
    p.innerHTML =
      '<a class="volver" href="../../juegos.html">&larr; Juegos</a>' +
      '<div class="caja">' +
      '<h1 class="logo">CLUE</h1><p class="sub">El caso del sobre en el patio</p>' +
      '<p class="lema">Alguien dejó un sobre en el centro del edificio. Descubre quién fue, con qué y dónde antes que los demás.</p>' +
      '<label class="campo">Tu nombre<input id="in-nombre" maxlength="16" autocomplete="off" value="' + esc(nombre) + '" placeholder="Detective"></label>' +
      '<div class="campo">Rivales (bots)<div id="in-bots" class="segmento">' +
      [1, 2, 3, 4, 5].map(n => '<button type="button" data-act="bots" data-n="' + n + '" class="' + (n === bots ? "on" : "") + '">' + n + "</button>").join("") +
      "</div></div>" +
      '<button id="in-jugar" class="btn primario grande" data-act="jugar-practica">Jugar</button>' +
      '<p class="nota">Práctica contra bots. Para jugar con amigos abre una sala de Clue en Juegos.</p>' +
      "</div>";
    firmaPantalla = "inicio";
    p.dataset.bots = String(bots);
  }

  function iniciaPractica(op) {
    opcionesPractica = op;
    if (desuscribir) { try { desuscribir(); } catch (e) { /* nada */ } desuscribir = null; }
    if (conn && conn.destruir) { try { conn.destruir(); } catch (e) { /* nada */ } }
    if (!window.ClueMesa) { mensajePantalla("No se pudo cargar el juego", "Falta la mesa de práctica."); return; }
    let el = lsJson("clue.elenco");
    if (!Array.isArray(el) || el.length < M.NS || !el.every(e => e && typeof e.id === "string" && typeof e.n === "string")) el = null;
    const c = window.ClueMesa.crearMesa({ bots: op.bots, nombre: op.nombre, elenco: el || undefined });
    adjunta(c);
  }

  function adjunta(c) {
    conn = c;
    est = null; priv = null; prev = null;
    Object.assign(ui, { dlg: null, selS: null, selA: null, selL: null, tab: "hist", rolling: false, tirado: -1, busy: false, finCerrado: false, cola: [], vistasVistas: new Set(), primera: true });
    for (const k in anim) delete anim[k];
    for (const k in firmas) delete firmas[k];
    firmaModal = ""; firmaPantalla = "";
    marcas = {}; claveLibreta = "";
    desuscribir = c.suscribir(v => alCambiar(v));
  }

  /* ============================================================
     Cada cambio de la mesa
     ============================================================ */
  function alCambiar(v) {
    try {
      prev = est;
      est = v.est;
      priv = v.priv || {};
      ui.busy = false;
      if (!claveLibreta) cargaLibreta();
      // lo que me ensenaron: una clave nueva en priv.vistas
      const vistas = priv.vistas || {};
      for (const k of Object.keys(vistas)) {
        if (ui.vistasVistas.has(k)) continue;
        ui.vistasVistas.add(k);
        if (!ui.primera) ui.cola.push({ k, carta: vistas[k] });
      }
      ui.primera = false;
      if (prev && prev.jugadores && (est.fase === "jugando" || est.fase === "fin")) {
        try { animaCambios(prev, est); } catch (e) { console.warn("[clue] animacion", e); }
      }
      if (est.fase === "fin" && !prev || (prev && prev.fase !== "fin" && est.fase === "fin")) ui.finCerrado = false;
      pinta();
      const sg = est.sug;
      if (prev && prev.jugadores && sg && (!prev.sug || prev.sug.k !== sg.k)) chispaArma(sg.a);
    } catch (e) {
      console.warn("[clue] pintar", e);
    }
  }

  /* Un destello sobre la arma nombrada en una sugerencia: así se ve que
     viaja a la sala. Va en la capa #fx, que pintaDinamico no borra. */
  function chispaArma(a) {
    const fx = $("fx");
    if (!CA || !fx || $("juego").hidden || !est || !est.armas) return;
    const p = distribuye(est).arm[a];
    if (!p) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ")");
    fx.appendChild(g);
    const h = CA.chispa(a, g, { r: p.s * 0.95 });
    setTimeout(() => { h.parar(); if (g.parentNode) g.parentNode.removeChild(g); }, 1400);
  }

  /* Escenas y chispas del dialogo abierto: se paran al cambiarlo o cerrarlo. */
  let escenasVivas = [], timersFx = [];
  function paraEscenas() {
    escenasVivas.forEach(h => { try { h.parar(); } catch (e) { /* nada */ } });
    timersFx.forEach(clearTimeout);
    escenasVivas = []; timersFx = [];
  }
  function arrancaEscenas() {
    if (!CA) return;
    document.querySelectorAll("#modal [data-escena]").forEach(h => {
      escenasVivas.push(CA.escena(Number(h.dataset.escena), h, { bucle: h.dataset.bucle === "1" }));
    });
    const foto = document.querySelector("#modal .giro .foto[data-arma]");
    if (foto) timersFx.push(setTimeout(() => { escenasVivas.push(CA.chispa(Number(foto.dataset.arma), foto)); }, 1450));
  }

  function pinta() {
    if (!est) return;
    if (est.fase === "elige") pintaEleccion();
    else if (est.fase === "reparto") pintaReparto();
    else {
      const p = $("pantalla");
      if (!p.hidden) { p.hidden = true; p.innerHTML = ""; firmaPantalla = ""; }
      $("juego").hidden = false;
      if (!firmas.tablero) { construyeTablero(); firmas.tablero = "ok"; }
      pintaAccion();
      pintaDinamico();
      pintaMano();
      pintaTabs();
      pintaHist();
      pintaLibreta();
    }
    pintaModal();
  }

  /* ============================================================
     Eleccion de personaje y reparto
     ============================================================ */
  function pintaEleccion() {
    $("juego").hidden = true;
    const tomados = est.eleccion || {};
    const mioYa = tomados[yo()] || "";
    /* El candidato se pierde si otro se lo lleva, o si ya confirmé. */
    if (ui.candidato && (mioYa || Object.values(tomados).includes(ui.candidato))) ui.candidato = "";
    const firma = JSON.stringify(["e", tomados, est.debe, conn.mirando, elenco().length, est.jugadores.length, ui.candidato]);
    if (firma === firmaPantalla) return;
    firmaPantalla = firma;
    const p = $("pantalla");
    p.hidden = false;
    p.className = "pantalla elige";
    const asiento = miAsiento();
    const yaElegi = !!tomados[yo()];
    /* Se puede tocar mientras dure la eleccion: sin personaje, tocar marca
       o desmarca un candidato; con personaje, tocar el propio lo suelta y
       tocar otro libre lo cambia. */
    const puedo = !conn.mirando && asiento >= 0;
    const quien = uid => Object.keys(tomados).find(u => tomados[u] === uid);
    const tarjetas = elenco().map(e => {
      const dueno = Object.keys(tomados).find(u => tomados[u] === e.id);
      const ocupado = !!dueno;
      const as = ocupado ? asientoDe(dueno) : -1;
      const col = as >= 0 ? M.COLORES[as] : "#5b6472";
      const mio = dueno === yo();
      const cand = ui.candidato === e.id;
      const bloqueado = !puedo || (ocupado && !mio);
      return '<button type="button" class="pers' + (ocupado ? " tomado" : "") + (mio ? " mio" : "") + (cand ? " cand" : "") + '" data-act="elige" data-id="' + esc(e.id) + '"' + (bloqueado ? " disabled" : "") + ' aria-pressed="' + (cand || mio) + '" style="--c:' + (cand ? M.COLORES[Math.max(0, asiento)] : col) + '">' +
        '<span class="pers-foto">' + avatarHtml(e, col, "lleno", inicial(e.n)) + "</span>" +
        '<span class="pers-nom">' + esc(e.n) + "</span>" +
        (e.d ? '<span class="pers-desc">' + esc(e.d) + "</span>" : "") +
        (ocupado ? '<span class="pers-etq">' + (mio ? "Tu personaje (toca para soltarlo)" : "Elegido por " + esc(nombreDe(dueno))) + "</span>" : "") +
        (cand ? '<span class="pers-etq">Marcado: confirma abajo</span>' : "") +
        "</button>";
    }).join("");
    const esperan = (est.debe || []).map(u => esc(nombreDe(u)));
    let estado;
    if (conn.mirando) estado = "Estás mirando: los jugadores están eligiendo personaje.";
    else if (yaElegi) estado = "Listo. Esperando a: " + (esperan.join(", ") || "nadie") + ". Hasta que todos elijan puedes cambiar de personaje o soltar el tuyo.";
    else estado = "Elige a quién vas a interpretar. Tu ficha será de color " + M.NOMBRE_COLOR[Math.max(0, asiento)] + ".";
    const chips = est.jugadores.map((j, i) => '<span class="chip-j' + (tomados[j.uid] ? " listo" : "") + '">' + punto(i) + esc(j.nombre) + (tomados[j.uid] ? " &#10003;" : " ...") + "</span>").join("");
    p.innerHTML =
      '<div class="cab-eleccion"><h1 class="logo chico">CLUE</h1><h2>Elige tu personaje</h2>' +
      '<p class="estado">' + estado + "</p>" +
      (asiento >= 0 && !conn.mirando ? '<p class="mi-color"><span class="ficha-demo" style="background:' + M.COLORES[asiento] + '"></span> Tu color: ' + M.NOMBRE_COLOR[asiento] + "</p>" : "") +
      '<div class="quienes">' + chips + "</div>" +
      (puedo && !yaElegi ? '<div class="confirma-pers"><button type="button" class="btn primario" data-act="confirma-pers"' + (ui.candidato ? "" : " disabled") + ">" +
        (ui.candidato ? "Confirmar a " + esc((elenco().find(e => e.id === ui.candidato) || {}).n || "") : "Marca un personaje") + "</button></div>" : "") +
      "</div>" +
      '<div class="rejilla-pers">' + tarjetas + "</div>";
    void quien;
  }

  function pintaReparto() {
    $("juego").hidden = true;
    const firma = JSON.stringify(["r", est.debe, priv && priv.aviso]);
    if (firma === firmaPantalla) return;
    firmaPantalla = firma;
    const p = $("pantalla");
    p.hidden = false;
    p.className = "pantalla centro";
    const esperan = (est.debe || []).map(u => esc(nombreDe(u)));
    p.innerHTML =
      '<div class="caja"><h1 class="logo">CLUE</h1><h2>Barajando y repartiendo con criptografía...</h2>' +
      '<div class="barajas"><i></i><i></i><i></i></div>' +
      '<p>Nadie puede ver las cartas de los demas ni el sobre: se reparten sin repartidor.</p>' +
      (priv && priv.aviso ? '<p class="aviso">' + esc(priv.aviso) + "</p>" : "") +
      (esperan.length ? '<p class="nota">Esperando a: ' + esperan.join(", ") + "</p>" : "") +
      "</div>";
  }

  /* ============================================================
     El tablero (SVG)
     ============================================================ */
  function construyeTablero() {
    const W = M.ANCHO * S, H = M.ALTO * S;
    let h = '<defs><clipPath id="clipTok" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5"/></clipPath>';
    const rect = l => {
      const [x0, y0, x1, y1] = M.RECT[l];
      return { x: x0 * S + 3, y: y0 * S + 3, w: (x1 - x0 + 1) * S - 6, h: (y1 - y0 + 1) * S - 6 };
    };
    M.RECT.forEach((_, l) => { const r = rect(l); h += '<clipPath id="cr' + l + '"><rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="10"/></clipPath>'; });
    const pr = { x: M.PATIO[0] * S + 3, y: M.PATIO[1] * S + 3, w: (M.PATIO[2] - M.PATIO[0] + 1) * S - 6, h: (M.PATIO[3] - M.PATIO[1] + 1) * S - 6 };
    h += '<clipPath id="crp"><rect x="' + pr.x + '" y="' + pr.y + '" width="' + pr.w + '" height="' + pr.h + '" rx="14"/></clipPath>';
    h += '<radialGradient id="vineta" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>';
    h += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0b0d11"/>';

    // suelo de los pasillos y huecos
    let a = "", b = "", hu = "";
    for (let y = 0; y < M.ALTO; y++) for (let x = 0; x < M.ANCHO; x++) {
      const c = M.celda(x, y), d = "M" + x * S + " " + y * S + "h" + S + "v" + S + "h-" + S + "z";
      if (c === M.PASILLO) { if ((x + y) % 2) a += d; else b += d; }
      else if (c === M.HUECO) hu += d;
    }
    h += '<path d="' + a + '" fill="#2a303b"/><path d="' + b + '" fill="#252a34"/>';
    h += '<path d="' + a + b + '" fill="none" stroke="#1a1e26" stroke-width="1"/>';
    h += '<path d="' + hu + '" fill="#14171d" stroke="#0e1014" stroke-width="2"/>';

    // salas
    M.RECT.forEach((_, l) => {
      const r = rect(l), L = M.LUGARES[l];
      const nombre = L.n;
      const fs = Math.max(11, Math.min(18, (r.w - 58) / (nombre.length * 0.54)));
      h += '<g class="sala" data-sala="' + l + '">' +
        '<image href="img/salas/' + L.img + '.webp" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#cr' + l + ')"/>' +
        '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="10" fill="rgba(8,10,14,.46)"/>' +
        '<g clip-path="url(#cr' + l + ')"><rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + LB + '" fill="rgba(6,8,12,.78)"/></g>' +
        '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="10" fill="none" stroke="#c9a15a" stroke-width="2.5"/>' +
        '<text class="sala-nom" x="' + (r.x + 10) + '" y="' + (r.y + 22) + '" style="font-size:' + fs.toFixed(1) + 'px">' + esc(nombre) + "</text>" +
        '<text class="piso" x="' + (r.x + r.w - 8) + '" y="' + (r.y + r.h - 8) + '" text-anchor="end">' + (L.piso === 2 ? "2º piso" : "1er piso") + "</text></g>";
    });
    // patio
    h += '<g class="patio"><image href="img/salas/patio.webp" x="' + pr.x + '" y="' + pr.y + '" width="' + pr.w + '" height="' + pr.h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#crp)"/>' +
      '<rect x="' + pr.x + '" y="' + pr.y + '" width="' + pr.w + '" height="' + pr.h + '" rx="14" fill="rgba(8,10,14,.5)"/>' +
      '<rect x="' + pr.x + '" y="' + pr.y + '" width="' + pr.w + '" height="' + pr.h + '" rx="14" fill="none" stroke="#c9a15a" stroke-width="3" stroke-dasharray="10 6"/>' +
      '<g transform="translate(' + (pr.x + pr.w / 2) + "," + (pr.y + pr.h / 2 - 10) + ')">' +
      '<rect x="-40" y="-26" width="80" height="52" rx="5" fill="#eadfc3" stroke="#7a5c26" stroke-width="3"/>' +
      '<path d="M-40 -26 L0 4 L40 -26" fill="none" stroke="#7a5c26" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="0" cy="6" r="7" fill="#a4302a" stroke="#6d1c17" stroke-width="2"/></g>' +
      '<text class="patio-nom" x="' + (pr.x + pr.w / 2) + '" y="' + (pr.y + pr.h / 2 + 58) + '" text-anchor="middle">EL SOBRE</text>' +
      '<text class="piso" x="' + (pr.x + pr.w / 2) + '" y="' + (pr.y + pr.h / 2 + 78) + '" text-anchor="middle">nadie entra al patio</text></g>';

    // puertas: una barra dorada en el borde entre la casilla y la sala
    M.PUERTAS.forEach(d => {
      const vec = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => M.celda(d.x + dx, d.y + dy) === d.l);
      if (!vec) return;
      const cx = (d.x + 0.5) * S, cy = (d.y + 0.5) * S, ex = cx + vec[0] * S / 2, ey = cy + vec[1] * S / 2;
      const px = -vec[1], py = vec[0];
      h += '<line x1="' + (ex + px * 15) + '" y1="' + (ey + py * 15) + '" x2="' + (ex - px * 15) + '" y2="' + (ey - py * 15) + '" stroke="#e6b85c" stroke-width="6" stroke-linecap="round"/>' +
        '<circle cx="' + (cx - vec[0] * 4) + '" cy="' + (cy - vec[1] * 4) + '" r="3.5" fill="#e6b85c" opacity=".7"/>';
    });

    // pasadizos: iconos en las dos salas que unen
    M.PASADIZOS.forEach((q, qi) => {
      [q.a, q.b].forEach(l => {
        const r = rect(l), cx = r.x + r.w - 20, cy = r.y + LB / 2;
        const glifo = qi === 0
          ? '<path d="M-8 7 h5 v-5 h5 v-5 h5 v-5" fill="none" stroke="#e6b85c" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
          : '<rect x="-7" y="-7" width="14" height="14" rx="2" fill="none" stroke="#e6b85c" stroke-width="2"/><path d="M-3 2 L0 -3 L3 2 M-3 -1 L0 4 L3 -1" fill="none" stroke="#e6b85c" stroke-width="1.4" transform="scale(.55) translate(0 0)"/>';
        h += '<g class="pasadizo" data-act="info-pasadizo" data-q="' + qi + '" transform="translate(' + cx + "," + cy + ')"><title>' + esc(q.n) + " (pasadizo secreto)</title>" +
          '<circle r="13" fill="rgba(0,0,0,.65)" stroke="#e6b85c" stroke-width="1.5"/>' + glifo + "</g>";
      });
    });
    h += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#vineta)" pointer-events="none"/>';
    $("estatico").innerHTML = h;
  }

  /* Donde va cada ficha y cada arma: en el pasillo, el centro de la casilla;
     en una sala, una cuadricula pequena bajo el nombre. */
  function distribuye(e) {
    const tok = [], arm = [], salas = {};
    e.fichas.forEach((p, i) => {
      if (M.enSala(p)) (salas[M.salaDe(p)] = salas[M.salaDe(p)] || []).push({ t: "p", i });
      else { const [x, y] = M.xy(p); tok[i] = { x: (x + 0.5) * S, y: (y + 0.5) * S, r: S * 0.43 }; }
    });
    e.armas.forEach((l, a) => (salas[l] = salas[l] || []).push({ t: "a", a }));
    Object.keys(salas).forEach(l => {
      const its = salas[l], [x0, y0, x1, y1] = M.RECT[l];
      const w = (x1 - x0 + 1) * S - 12, h = (y1 - y0 + 1) * S - 12 - LB, ox = x0 * S + 6, oy = y0 * S + 6 + LB;
      let step = S, cols = 1, rows = its.length;
      for (const f of [1, 0.9, 0.8, 0.7, 0.62]) {
        step = S * f; cols = Math.max(1, Math.floor(w / step)); rows = Math.ceil(its.length / cols);
        if (rows * step <= h) break;
      }
      its.forEach((it, k) => {
        const row = Math.floor(k / cols), col = k % cols;
        const enFila = row === rows - 1 ? its.length - row * cols : cols;
        const x = ox + (w - enFila * step) / 2 + col * step + step / 2;
        const y = oy + (h - rows * step) / 2 + row * step + step / 2;
        if (it.t === "p") tok[it.i] = { x, y, r: step * 0.43 };
        else arm[it.a] = { x, y, s: step * 0.8 };
      });
    });
    return { tok, arm };
  }

  function tokenSvg(i, x, y, r, activo) {
    const p = personaje(i), col = M.COLORES[i];
    const j = est.jugadores[i];
    const npc = !j;
    const muerto = j && (est.eliminados[j.uid] || est.fuera[j.uid]);
    let dentro;
    if (p && p.foto) dentro = '<image href="' + esc(p.foto) + '" x="' + -r + '" y="' + -r + '" width="' + 2 * r + '" height="' + 2 * r + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#clipTok)"/>';
    else dentro = '<text class="tok-ini" y="' + (r * 0.36) + '" text-anchor="middle" style="font-size:' + (r * 1.05).toFixed(1) + "px;fill:" + (esClaro(col) ? "#1a1a1a" : "#fff") + '">' + esc(inicial(nomS(i))) + "</text>";
    const fondo = (p && p.foto) ? "#12151b" : col;
    return '<g class="tok' + (activo ? " act" : "") + (npc ? " npc" : "") + (muerto ? " muerto" : "") + '" transform="translate(' + x.toFixed(1) + "," + y.toFixed(1) + ')">' +
      "<title>" + esc(nomS(i)) + (j ? " (" + esc(j.nombre) + ")" : "") + "</title>" +
      (activo ? '<circle class="halo" r="' + (r + 9) + '" fill="none" stroke="#fff" stroke-width="3"/>' : "") +
      '<circle r="' + (r + 3) + '" fill="' + col + '" stroke="#0b0d11" stroke-width="1.5"/>' +
      '<circle r="' + r + '" fill="' + fondo + '"/>' + dentro +
      '<circle r="' + r + '" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/></g>';
  }
  function armaSvg(a, x, y, s, clic) {
    const A = M.ARMAS[a], m = s / 2 - 1.5;
    const dentro = CA ? CA.icono(a, 'x="' + (-m).toFixed(1) + '" y="' + (-m).toFixed(1) + '" width="' + (2 * m).toFixed(1) + '" height="' + (2 * m).toFixed(1) + '"')
      : '<text y="' + (s * 0.22) + '" text-anchor="middle" style="font-size:' + (s * 0.62).toFixed(1) + 'px">' + A.i + "</text>";
    return '<g class="arma' + (clic ? " clic" : "") + '"' + (clic ? ' data-act="info-arma" data-a="' + a + '"' : "") + ' transform="translate(' + x.toFixed(1) + "," + y.toFixed(1) + ')"><title>' + esc(A.n) + "</title>" +
      '<rect x="' + -s / 2 + '" y="' + -s / 2 + '" width="' + s + '" height="' + s + '" rx="6" fill="#0c2540"/>' + dentro +
      '<rect x="' + -s / 2 + '" y="' + -s / 2 + '" width="' + s + '" height="' + s + '" rx="6" fill="none" stroke="#e6b85c" stroke-width="1.6"/></g>';
  }

  function tirado() { return est.turno === yo() && ui.tirado === est.nTurno; }
  function destinos() {
    if (!est || conn.mirando || est.fase !== "jugando" || est.turno !== yo() || est.paso !== "inicio" || !tirado() || !est.dados) return null;
    const f = miAsiento();
    if (f < 0) return null;
    try { return M.alcance(est.fichas, f, est.dados[0] + est.dados[1]); } catch (e) { return null; }
  }

  function pintaDinamico() {
    if (!est || !est.fichas || $("juego").hidden) return;
    const lay = distribuye(est);
    let h = "";
    const al = destinos();
    if (al) {
      al.casillas.forEach((_, p) => {
        const [x, y] = M.xy(p);
        h += '<rect class="dest" data-act="mover" data-a="' + p + '" x="' + (x * S + 3) + '" y="' + (y * S + 3) + '" width="' + (S - 6) + '" height="' + (S - 6) + '" rx="8"/>';
      });
      al.salas.forEach((_, l) => {
        const [x0, y0, x1, y1] = M.RECT[l];
        h += '<rect class="dest sala-d" data-act="mover" data-a="' + (M.SALA + l) + '" x="' + (x0 * S + 3) + '" y="' + (y0 * S + 3) + '" width="' + ((x1 - x0 + 1) * S - 6) + '" height="' + ((y1 - y0 + 1) * S - 6) + '" rx="10"/>';
      });
    }
    lay.arm.forEach((p, a) => { if (p) h += armaSvg(a, p.x, p.y, p.s, !al); });
    const turnoI = est.fase === "jugando" ? asientoDe(est.turno) : -1;
    // el turno activo va encima de los demas
    const orden = est.fichas.map((_, i) => i).sort((a, b) => (a === turnoI) - (b === turnoI));
    orden.forEach(i => {
      const p = anim[i] || lay.tok[i];
      if (p) h += tokenSvg(i, p.x, p.y, (lay.tok[i] || p).r || S * 0.43, i === turnoI);
    });
    $("dina").innerHTML = h;
  }

  /* Animar el recorrido de las fichas que cambiaron de sitio. */
  function animaCambios(a, b) {
    const layA = distribuye(a), layB = distribuye(b);
    const ult = (b.hist || [])[b.hist.length - 1];
    b.fichas.forEach((to, i) => {
      const from = a.fichas[i];
      if (from === to || !layA.tok[i] || !layB.tok[i]) return;
      const uid = b.jugadores[i] && b.jugadores[i].uid;
      let ruta = [];
      const porPasadizo = ult && ult.e === "mueve" && ult.v === "pasadizo" && ult.uid === uid;
      if (!porPasadizo && a.paso === "inicio" && a.turno === uid && a.dados) {
        try { ruta = M.camino(M.alcance(a.fichas, i, a.dados[0] + a.dados[1]), to); } catch (e) { ruta = []; }
      }
      const fin = layB.tok[i];
      const pts = [{ x: layA.tok[i].x, y: layA.tok[i].y }];
      if (ruta.length) ruta.forEach(p => {
        if (M.enSala(p)) pts.push({ x: fin.x, y: fin.y });
        else { const [x, y] = M.xy(p); pts.push({ x: (x + 0.5) * S, y: (y + 0.5) * S }); }
      });
      else pts.push({ x: fin.x, y: fin.y });
      mueveFicha(i, pts, ruta.length ? 115 : 420);
    });
  }
  function mueveFicha(i, pts, msTramo) {
    const id = ++animId;
    const tramos = [];
    let total = 0;
    for (let k = 1; k < pts.length; k++) {
      const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      const ms = pts.length > 2 ? msTramo : Math.max(msTramo, Math.min(650, d * 1.2));
      tramos.push({ a: pts[k - 1], b: pts[k], t0: total, t1: total + ms });
      total += ms;
    }
    if (!tramos.length) return;
    anim[i] = { x: pts[0].x, y: pts[0].y, id };
    const t0 = performance.now();
    const limpia = () => { if (anim[i] && anim[i].id === id) { delete anim[i]; try { pintaDinamico(); } catch (e) { /* nada */ } } };
    function paso(now) {
      if (!anim[i] || anim[i].id !== id) return;
      const t = now - t0;
      if (t >= total) { limpia(); return; }
      const tr = tramos.find(q => t < q.t1) || tramos[tramos.length - 1];
      const k = Math.max(0, Math.min(1, (t - tr.t0) / (tr.t1 - tr.t0)));
      anim[i].x = tr.a.x + (tr.b.x - tr.a.x) * k;
      anim[i].y = tr.a.y + (tr.b.y - tr.a.y) * k;
      pintaDinamico();
      requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
    setTimeout(limpia, total + 500);       // por si el navegador no anima (pestana oculta)
  }

  /* ============================================================
     El panel del turno
     ============================================================ */
  function dadoHtml(v, cls) {
    const pos = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v] || [];
    let c = "";
    for (let k = 0; k < 9; k++) c += "<i" + (pos.includes(k) ? ' class="p"' : "") + "></i>";
    return '<span class="dado ' + (cls || "") + '">' + c + "</span>";
  }

  function textoEstado() {
    const t = est.turno, n = esc(nombreDe(t));
    const yoTurno = t === yo() && !conn.mirando;
    switch (est.paso) {
      case "inicio":
        if (yoTurno) {
          if (tirado()) {
            const al = destinos();
            if (al && !al.casillas.size && !al.salas.size) return "No puedes llegar a ninguna parte con este tiro. Termina tu turno.";
            return "Elige una casilla o sala resaltada en el tablero.";
          }
          return est.puedeSugerir ? "Tu turno. Te llamaron a esta sala: puedes sugerir sin moverte, o tirar los dados." : "Tu turno: tira los dados.";
        }
        return n + " está por mover.";
      case "accion":
        return yoTurno ? (est.puedeSugerir ? "Estás en una sala: puedes sugerir, acusar o terminar el turno." : "Termina tu turno o haz una acusación.") : n + " está decidiendo.";
      case "refuta": {
        const e = est.sug && est.sug.espera;
        return e ? (e === yo() ? "Te toca refutar." : "Esperando que " + esc(nombreDe(e)) + " responda.") : "Comprobando la sugerencia.";
      }
      case "tras":
        return yoTurno ? "Puedes acusar o terminar tu turno." : n + " termina su turno.";
      case "abre":
        return "Abriendo el sobre para comprobar la acusación de " + n + "...";
      case "veredicto":
        return "Veredicto de la acusación de " + n + "...";
    }
    return "";
  }

  function bannerSugerencia() {
    const s = est.sug;
    if (!s || (est.paso !== "refuta" && est.paso !== "tras")) return "";
    let h = '<div class="sug"><div class="sug-tit">' + chipJugador(s.uid) + " sugiere:</div>" +
      '<div class="sug-cartas">' + [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)].map(c => cartaHtml(c, "mini")).join("") + "</div><ul class=\"sug-res\">";
    (s.pasaron || []).forEach(u => { h += '<li class="no">&#10005; ' + chipJugador(u) + " no tiene ninguna</li>"; });
    if (s.mostro) h += '<li class="si">&#10003; ' + chipJugador(s.mostro) + " le mostró una carta a " + chipJugador(s.uid) + "</li>";
    else if (s.espera) h += '<li class="espera">... ' + chipJugador(s.espera) + " está pensando</li>";
    else if (est.paso === "tras" || est.paso === "refuta") h += '<li class="nadie">Nadie pudo refutar</li>';
    return h + "</ul></div>";
  }

  function pintaAccion() {
    const A = $("accion");
    const f = miAsiento();
    const soyJ = !conn.mirando && f >= 0;
    const miTurno = soyJ && est.fase === "jugando" && est.turno === yo();
    const pasoLibre = est.paso === "inicio" || est.paso === "accion" || est.paso === "tras";
    const pas = miTurno && est.paso === "inicio" && f >= 0 && M.enSala(est.fichas[f]) ? M.pasadizoDe(M.salaDe(est.fichas[f])) : null;
    const dadosVis = est.dados && est.fase === "jugando" && (est.paso !== "inicio" || tirado());
    const firma = JSON.stringify([est.fase, est.turno, est.paso, est.puedeSugerir, est.dados, ui.rolling, ui.falsos, tirado(), ui.busy, est.debe, est.sug && [est.sug.espera, est.sug.mostro, est.sug.pasaron], Object.keys(est.eliminados), Object.keys(est.fuera), est.ganador, conn.mirando, f >= 0 ? est.fichas[f] : 0, est.personajes, ui.finCerrado, priv.mano && priv.mano.length]);
    if (firma === firmas.accion) return;
    firmas.accion = firma;

    let h = "";
    if (est.fase === "fin") {
      h += '<div class="turno fin"><h2>Fin de la partida</h2><p>' + esc(textoGanador()) + "</p></div>";
      h += '<div class="botones">';
      h += '<button class="btn" data-act="ver-fin">Ver el resultado</button>';
      if (!ONLINE) h += '<button class="btn primario" data-act="otra">Jugar otra vez</button>';
      h += "</div>";
    } else {
      const t = est.turno, ti = asientoDe(t);
      h += '<div class="turno' + (miTurno ? " mio" : "") + '">' +
        (ti >= 0 ? avatarPuesto(ti, 46) : "") +
        '<div class="turno-txt"><div class="quien">' + (miTurno ? "Tu turno" : "Turno de " + esc(nombreDe(t))) + "</div>" +
        '<div class="sub">' + (ti >= 0 ? esc(nomS(ti)) : "") + "</div></div>" +
        '<div class="dados">' + (ui.rolling ? dadoHtml(ui.falsos[0], "rueda") + dadoHtml(ui.falsos[1], "rueda")
          : dadosVis ? dadoHtml(est.dados[0]) + dadoHtml(est.dados[1]) : "") + "</div></div>";
      h += '<p class="estado">' + textoEstado() + "</p>";
      h += bannerSugerencia();
      if (soyJ) {
        const b = ui.busy;
        h += '<div class="botones">' +
          '<button class="btn primario" data-act="tirar"' + (miTurno && est.paso === "inicio" && !tirado() && !ui.rolling && !b ? "" : " disabled") + ">Tirar dados</button>" +
          '<button class="btn" data-act="pasadizo"' + (pas && !b ? "" : " disabled") + ">Usar pasadizo" + (pas ? " (" + esc(M.PASADIZOS.find(q => q.a === M.salaDe(est.fichas[f]) || q.b === M.salaDe(est.fichas[f])).n) + ")" : "") + "</button>" +
          '<button class="btn" data-act="abre-sug"' + (miTurno && est.puedeSugerir && !b ? "" : " disabled") + ">Sugerir</button>" +
          '<button class="btn peligro" data-act="abre-acu"' + (miTurno && pasoLibre && !b ? "" : " disabled") + ">Acusar</button>" +
          '<button class="btn" data-act="pasa"' + (miTurno && pasoLibre && !b ? "" : " disabled") + ">Terminar turno</button></div>";
        if (est.eliminados[yo()]) h += '<p class="nota">Fallaste tu acusación: sigues en la mesa para refutar, pero ya no juegas.</p>';
      } else if (conn.mirando) h += '<p class="nota">Estás mirando la partida.</p>';
    }
    // jugadores
    h += '<ul class="jugadores">' + est.jugadores.map((j, i) => {
      const estados = [];
      if (est.fase === "jugando" && est.turno === j.uid) estados.push('<b class="e-turno">turno</b>');
      if (est.eliminados[j.uid]) estados.push('<b class="e-elim">eliminado</b>');
      if (est.fuera[j.uid]) estados.push('<b class="e-elim">se fue</b>');
      if (est.debe.includes(j.uid) && est.paso === "refuta") estados.push("<b>pensando</b>");
      return '<li class="' + (j.uid === yo() ? "yo" : "") + '">' + avatarPuesto(i, 30) + '<span class="jn">' + esc(j.nombre) + (j.uid === yo() ? " (tú)" : "") + '<small>' + esc(nomS(i)) + "</small></span>" + estados.join("") + "</li>";
    }).join("") + "</ul>";
    A.innerHTML = h;
  }

  function textoGanador() {
    if (est.ganador) {
      const n = nombreDe(est.ganador);
      if (est.motivo === "acierto") return n + " resolvió el caso.";
      if (est.motivo === "ultimo") return n + " gana: todos los demás fallaron su acusación.";
      if (est.motivo === "abandono") return n + " gana porque los demás abandonaron.";
      return n + " gana.";
    }
    if (est.motivo === "anulada") return "Partida anulada: alguien se fue y el sobre quedó cerrado para siempre.";
    return "Nadie resolvió el caso.";
  }

  /* ============================================================
     Mano, historial y libreta
     ============================================================ */
  function pintaMano() {
    const el = $("mano");
    const firma = JSON.stringify([priv.mano, est.personajes, conn.mirando]);
    if (firma === firmas.mano) return;
    firmas.mano = firma;
    if (conn.mirando || !priv.mano) { el.innerHTML = '<h3>Mis cartas</h3><p class="nota">' + (conn.mirando ? "Mirando: no tienes cartas." : "Aún sin cartas.") + "</p>"; return; }
    const orden = priv.mano.slice().sort((a, b) => a - b);
    el.innerHTML = "<h3>Mis cartas <small>" + orden.length + "</small></h3><div class=\"mano\">" + orden.map(c => cartaHtml(c)).join("") + "</div>";
  }

  function pintaTabs() {
    document.querySelectorAll("#tabs .tab").forEach(b => b.classList.toggle("on", b.dataset.tab === ui.tab));
    $("hist").hidden = ui.tab !== "hist";
    $("libreta").hidden = ui.tab !== "lib";
  }

  function lineaHist(h) {
    const n = h.uid ? chipJugador(h.uid) : "";
    switch (h.e) {
      case "reparto": return "Se repartieron las cartas: empieza la partida.";
      case "mueve": {
        const dado = h.dados ? " <span class=\"dim\">(dados " + h.dados[0] + " + " + h.dados[1] + ")</span>" : "";
        if (h.a >= M.SALA) return n + (h.v === "pasadizo" ? " usa un pasadizo secreto hasta " : " entra en ") + esc(ARTICULO_LUGAR[h.a - M.SALA] + " " + M.LUGARES[h.a - M.SALA].n) + dado;
        return n + " avanza por el pasillo" + dado;
      }
      case "sugiere": return n + " sugiere: " + chipPuesto(h.s) + " " + esc(conArma(h.a)) + " " + esc(enLugar(h.l));
      case "paso": return n + " no tiene ninguna de las tres cartas";
      case "muestra": return n + " le mostró una carta a " + chipJugador(h.para) + (h.para === yo() ? " (la viste)" : "");
      case "nadie": return "Nadie pudo refutar la sugerencia de " + n;
      case "acusa": return n + " <b>acusa</b>: " + chipPuesto(h.s) + " " + esc(conArma(h.a)) + " " + esc(enLugar(h.l));
      case "veredicto": return h.ok ? "<b class=\"ok\">" + n + " acertó la acusación</b>" : "<b class=\"mal\">" + n + " falló y queda eliminado</b>";
      case "pasa": return n + " termina su turno";
      case "sale": return n + " abandona la partida";
    }
    return "";
  }

  function pintaHist() {
    const el = $("hist");
    const hs = est.hist || [];
    const firma = JSON.stringify([hs.length, hs[hs.length - 1], est.personajes]);
    if (firma === firmas.hist) return;
    firmas.hist = firma;
    const abajo = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.innerHTML = hs.length ? "<ol>" + hs.map(h => "<li class=\"h-" + esc(h.e) + "\">" + lineaHist(h) + "</li>").join("") + "</ol>" : '<p class="nota">Aún no ha pasado nada.</p>';
    if (abajo || !firmas.histVisto) el.scrollTop = el.scrollHeight;
    firmas.histVisto = true;
  }

  /* --- libreta --- */
  function cargaLibreta() {
    let id = conn.semilla;
    if (id == null) id = M.sha256hex((est.jugadores || []).map(j => j.uid).join("|")).slice(0, 12);
    claveLibreta = "clue.libreta." + yo() + "." + id;
    marcas = lsJson(claveLibreta) || {};
    if (typeof marcas !== "object" || Array.isArray(marcas)) marcas = {};
  }
  function marcasAuto() {
    const cols = est.jugadores.map(j => j.uid), auto = {};
    const si = (c, u) => {
      auto[c + "," + u] = "si";
      cols.forEach(v => { if (v !== u && auto[c + "," + v] !== "si") auto[c + "," + v] = "no"; });
      if (u !== "sobre") auto[c + ",sobre"] = "no";
    };
    const mano = priv.mano || [];
    mano.forEach(c => si(c, yo()));
    if (mano.length && !conn.mirando) for (let c = 0; c < M.NC; c++) if (!mano.includes(c) && !auto[c + "," + yo()]) auto[c + "," + yo()] = "no";
    const vistas = priv.vistas || {};
    Object.keys(vistas).forEach(k => {
      const s = est.sugerencias.find(x => x.k === k);
      if (s && s.mostro) si(vistas[k], s.mostro);
    });
    est.sugerencias.forEach(s => {
      (s.pasaron || []).forEach(u => [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)].forEach(c => { if (auto[c + "," + u] !== "si") auto[c + "," + u] = "no"; }));
    });
    const sobre = priv.sobre || (est.fase === "fin" ? est.solucion : null);
    if (sobre) sobre.forEach(c => { auto[c + ",sobre"] = "si"; cols.forEach(v => { auto[c + "," + v] = "no"; }); });
    return auto;
  }
  const GLIFO = { x: "✕", ok: "✓", q: "?" };
  function pintaLibreta() {
    const el = $("libreta");
    if (ui.tab !== "lib") return;
    const auto = marcasAuto();
    const firma = JSON.stringify([auto, marcas, est.personajes, est.jugadores.length]);
    if (firma === firmas.libreta) return;
    firmas.libreta = firma;
    const cols = est.jugadores;
    let h = '<div class="lib-scroll"><table class="lib"><thead><tr><th class="nom"></th>' +
      cols.map((j, i) => '<th title="' + esc(j.nombre) + '" style="--c:' + M.COLORES[i] + '">' + avatarPuesto(i, 24) + "<span>" + esc(j.nombre.split(/\s+/).pop().slice(0, 7)) + "</span></th>").join("") +
      '<th title="El sobre">Sobre</th></tr></thead><tbody>';
    const grupos = [["Sospechosos", 0, M.NS], ["Armas", M.NS, M.NS + M.NA], ["Lugares", M.NS + M.NA, M.NC]];
    grupos.forEach(([tit, a, b]) => {
      h += '<tr class="grupo"><td colspan="' + (cols.length + 2) + '">' + tit + "</td></tr>";
      for (let c = a; c < b; c++) {
        const uids = cols.map(j => j.uid).concat(["sobre"]);
        const resuelta = uids.some(u => auto[c + "," + u] === "si");
        h += '<tr class="' + (resuelta ? "res" : "") + '"><td class="nom">' + (c < M.NS ? punto(c) : "") + esc(nombreCarta(c)) + "</td>";
        uids.forEach(u => {
          const k = c + "," + u, m = marcas[k], au = auto[k];
          const glifo = m ? GLIFO[m] : au === "si" ? "✓" : au === "no" ? "✕" : "";
          h += '<td class="cel' + (au ? " a-" + au : "") + (m ? " m-" + m : "") + '" data-act="marca" data-k="' + k + '">' + glifo + "</td>";
        });
        h += "</tr>";
      }
    });
    h += '</tbody></table></div><p class="nota">Toca una casilla: vacía, &#10005;, &#10003;, ?. Lo automático (tus cartas, lo que te enseñaron y quiénes no pudieron refutar) sale en color.</p>';
    el.innerHTML = h;
  }
  function ciclaMarca(k) {
    const sig = { undefined: "x", x: "ok", ok: "q", q: undefined };
    const n = sig[marcas[k]];
    if (n) marcas[k] = n; else delete marcas[k];
    lsSet(claveLibreta, JSON.stringify(marcas));
    firmas.libreta = "";
    pintaLibreta();
  }

  /* ============================================================
     Dialogos
     ============================================================ */
  function pintaModal() {
    const M_ = $("modal");
    let d = null;
    if (est && est.fase !== "elige" && est.fase !== "reparto" && !conn.mirando) {
      const s = est.sug;
      if (est.paso === "refuta" && est.fase === "jugando" && s && s.espera === yo()) d = { k: "refuta" };
    }
    if (!d && ui.cola.length && est && est.fase !== "elige" && est.fase !== "reparto") d = { k: "revela", q: ui.cola[0] };
    if (!d && est && est.fase === "fin" && !ui.finCerrado && !ui.dlg) d = { k: "fin" };
    if (!d && ui.dlg && est && est.fase === "jugando") d = ui.dlg;
    if (!d && ui.dlg && est && est.fase === "fin") d = ui.dlg;
    if (!d) { paraEscenas(); if (!M_.hidden) { M_.hidden = true; M_.innerHTML = ""; } firmaModal = ""; return; }
    const firma = JSON.stringify([d, ui.selS, ui.selA, ui.selL, est.personajes, ui.busy, priv.mano, priv.problemas, priv.sobre]);
    if (firma === firmaModal) return;
    firmaModal = firma;
    paraEscenas();
    M_.hidden = false;
    M_.innerHTML = '<div class="velo" data-act="velo"><div class="dialogo d-' + d.k + '" role="dialog" aria-modal="true">' + contenidoModal(d) + "</div></div>";
    arrancaEscenas();
  }

  function contenidoModal(d) {
    switch (d.k) {
      case "refuta": return dlgRefuta();
      case "revela": return dlgRevela(d.q);
      case "sugiere": return dlgSugiere();
      case "acusa": return dlgAcusa();
      case "info": return dlgInfo(d.q);
      case "arma": return dlgArma(d.a);
      case "fin": return dlgFin();
    }
    return "";
  }

  function dlgRefuta() {
    const s = est.sug, pedidas = [M.cartaS(s.s), M.cartaA(s.a), M.cartaL(s.l)];
    const tengo = (priv.mano || []).filter(c => pedidas.includes(c));
    let h = "<h2>" + chipJugador(s.uid) + " sugiere</h2>" +
      '<p class="sub2">' + esc(nombreCarta(M.cartaS(s.s))) + " " + esc(conArma(s.a)) + " " + esc(enLugar(s.l)) + "</p>" +
      '<div class="cartas-fila">' + pedidas.map(c => cartaHtml(c, "mini")).join("") + "</div>";
    if (!tengo.length) {
      h += '<p class="aviso">No tienes ninguna de esas cartas. La mesa responde por ti.</p><div class="botones"><button class="btn primario" data-act="refutar" data-c="null">Continuar</button></div>';
    } else {
      h += "<p>Elige la carta que le vas a mostrar. Solo la verá " + esc(nombreDe(s.uid)) + ".</p>" +
        '<div class="cartas-fila elegibles">' + tengo.map(c => '<button type="button" class="opcion" data-act="refutar" data-c="' + c + '"' + (ui.busy ? " disabled" : "") + ">" + cartaHtml(c) + "</button>").join("") + "</div>";
    }
    return h;
  }

  function dlgRevela(q) {
    const s = est.sugerencias.find(x => x.k === q.k);
    const quien = s && s.mostro ? nombreDe(s.mostro) : "Alguien";
    return '<h2>' + esc(quien) + " te mostró una carta</h2>" +
      '<div class="giro"><div class="giro-in"><div class="cara dorso"><span>?</span></div><div class="cara frente">' + cartaHtml(q.carta, "grande") + "</div></div></div>" +
      '<p class="sub2">' + esc(nombreCarta(q.carta)) + " no está en el sobre.</p>" +
      '<div class="botones"><button class="btn primario" data-act="cierra-revela">Entendido</button></div>';
  }

  function opciones(tipo, sel, act) {
    let items;
    if (tipo === "s") items = [0, 1, 2, 3, 4, 5].map(i => M.cartaS(i));
    else if (tipo === "a") items = M.ARMAS.map((_, i) => M.cartaA(i));
    else items = M.LUGARES.map((_, i) => M.cartaL(i));
    return items.map(c => {
      const idx = tipo === "s" ? c : tipo === "a" ? c - M.NS : c - M.NS - M.NA;
      const mio = (priv.mano || []).includes(c);
      return '<button type="button" class="opcion' + (sel === idx ? " sel" : "") + '" data-act="' + act + '" data-i="' + idx + '">' + cartaHtml(c, "mini") + (mio ? '<span class="etq-mio">la tienes</span>' : "") + "</button>";
    }).join("");
  }

  function dlgSugiere() {
    const f = miAsiento(), l = M.salaDe(est.fichas[f]);
    const listo = ui.selS != null && ui.selA != null;
    return "<h2>Sugerir " + esc(enLugar(l)) + '</h2><p class="sub2">La sala es la que ocupas ahora. Elige sospechoso y arma.</p>' +
      "<h4>Sospechoso</h4><div class=\"grilla-op\">" + opciones("s", ui.selS, "sel-s") + "</div>" +
      "<h4>Arma</h4><div class=\"grilla-op\">" + opciones("a", ui.selA, "sel-a") + "</div>" +
      '<div class="botones"><button class="btn" data-act="cierra-dlg">Cancelar</button>' +
      '<button class="btn primario" data-act="envia-sug"' + (listo && !ui.busy ? "" : " disabled") + ">Sugerir</button></div>";
  }

  function dlgAcusa() {
    const listo = ui.selS != null && ui.selA != null && ui.selL != null;
    return "<h2>Acusación final</h2>" +
      '<div class="alerta">Si te equivocas quedas <b>eliminado</b>: ya no juegas, solo refutas. Si aciertas, ganas al instante.</div>' +
      "<h4>Sospechoso</h4><div class=\"grilla-op\">" + opciones("s", ui.selS, "sel-s") + "</div>" +
      "<h4>Arma</h4><div class=\"grilla-op\">" + opciones("a", ui.selA, "sel-a") + "</div>" +
      "<h4>Lugar</h4><div class=\"grilla-op\">" + opciones("l", ui.selL, "sel-l") + "</div>" +
      '<div class="botones"><button class="btn" data-act="cierra-dlg">Cancelar</button>' +
      '<button class="btn peligro" data-act="envia-acu"' + (listo && !ui.busy ? "" : " disabled") + ">Acusar</button></div>";
  }

  function dlgInfo(q) {
    const p = M.PASADIZOS[q];
    if (!p) return "";
    return "<h2>" + esc(p.n) + "</h2>" +
      (q === 0 ? '<div class="foto-info"><img src="img/salas/escalera.webp" alt="Escalera"></div>' : "") +
      "<p>Pasadizo secreto entre " + esc(M.LUGARES[p.a].n) + " y " + esc(M.LUGARES[p.b].n) + ". Al empezar tu turno, si estás en una de las dos salas, puedes usarlo en vez de tirar los dados.</p>" +
      '<div class="botones"><button class="btn primario" data-act="cierra-dlg">Cerrar</button></div>';
  }

  function dlgArma(a) {
    const A = M.ARMAS[a], D = CA && CA.DATOS[a];
    return "<h2>" + esc(A.n) + "</h2>" +
      (est && est.armas ? '<p class="sub2">Ahora está ' + esc(enLugar(est.armas[a])) + ".</p>" : "") +
      '<div class="arma-ficha"><span class="grande-ico">' + iconoArma(a) + "</span>" + (D ? "<p>" + esc(D.dato) + "</p>" : "") + "</div>" +
      (CA ? '<h4>Así se comete el crimen</h4><div class="escena-caja"><div class="escena-host" data-escena="' + a + '" data-bucle="1"></div></div>' : "") +
      '<div class="botones"><button class="btn primario" data-act="cierra-dlg">Cerrar</button></div>';
  }

  const QUE_PROBLEMA = {
    paso: "dijo que no tenía una carta que sí tenía", muestra: "mostró una carta que no era válida", mezcla: "no barajó como debía",
    revuelve: "alteró el reparto", quita: "alteró el reparto", veredicto: "dio un veredicto falso", oculta: "aún no reveló su semilla"
  };
  function dlgFin() {
    const sobre = priv.sobre || est.solucion;
    let h = '<h2>' + (est.ganador ? "Caso resuelto" : "Caso cerrado") + "</h2>";
    if (est.ganador) {
      const i = asientoDe(est.ganador);
      h += '<div class="ganador">' + (i >= 0 ? avatarPuesto(i, 64) : "") + "<div><b>" + esc(nombreDe(est.ganador)) + "</b><br><small>" + esc(textoGanador()) + "</small></div></div>";
    } else h += "<p>" + esc(textoGanador()) + "</p>";
    if (CA && sobre && sobre.length === 3) {
      const wi = sobre[1] - M.NS, D = CA.DATOS[wi];
      h += '<div class="escena-caja"><div class="escena-host" data-escena="' + wi + '"></div><p class="frase-arma">' + esc(D.frase) + '</p><p class="dato-arma">' + esc(D.dato) + "</p>" +
        '<button type="button" class="btn" data-act="repite-escena">&#8635; Repetir la escena</button></div>';
    }
    if (sobre && sobre.length === 3) {
      h += '<h4>Dentro del sobre estaba</h4><div class="cartas-fila grandes">' + sobre.map(c => cartaHtml(c, "grande")).join("") + "</div>";
      h += '<p class="sub2">' + esc(nombreCarta(sobre[0])) + " " + esc(conArma(sobre[1] - M.NS)) + " " + esc(enLugar(sobre[2] - M.NS - M.NA)) + "</p>";
    }
    const pr = priv.problemas;
    if (ONLINE && Array.isArray(pr)) {
      h += '<h4>Auditoría de la partida</h4>';
      const graves = pr.filter(x => x.que !== "oculta"), ocultas = pr.filter(x => x.que === "oculta");
      if (!pr.length) h += '<p class="ok">Todo en orden: nadie hizo trampa.</p>';
      else {
        h += '<ul class="auditoria">' + graves.map(x => '<li class="mal"><b>' + esc(nombreDe(x.uid)) + "</b> " + esc(QUE_PROBLEMA[x.que] || x.que) + "</li>").join("") +
          ocultas.map(x => '<li class="dim"><b>' + esc(nombreDe(x.uid)) + "</b> " + esc(QUE_PROBLEMA.oculta) + "</li>").join("") + "</ul>";
        if (ocultas.length) h += '<p class="nota">"Oculta" no es trampa: solo significa que esa persona todavía no reveló su semilla (por ejemplo, cerró la pestaña), así que no se la pudo auditar.</p>';
      }
    }
    h += '<div class="botones"><button class="btn" data-act="cierra-fin">Ver el tablero</button>' + (!ONLINE ? '<button class="btn primario" data-act="otra">Jugar otra vez</button>' : "") + "</div>";
    return h;
  }

  /* ============================================================
     Acciones
     ============================================================ */
  function toast(txt) {
    const t = $("toast");
    t.textContent = txt; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }
  function hacer(j) {
    if (ui.busy || !conn) return;
    ui.busy = true;
    firmas.accion = "";
    pinta();
    let p;
    try { p = conn.jugar(j); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(ok => { if (ok === false) { ui.busy = false; firmas.accion = ""; toast("La jugada no fue aceptada."); pinta(); } })
      .catch(e => { console.warn("[clue] jugada", e); ui.busy = false; firmas.accion = ""; toast("No se pudo enviar la jugada."); pinta(); });
    setTimeout(() => { if (ui.busy) { ui.busy = false; firmas.accion = ""; pinta(); } }, 4000);
  }
  function tirar() {
    if (ui.rolling || !est || est.turno !== yo() || est.paso !== "inicio") return;
    ui.rolling = true;
    let n = 0;
    const iv = setInterval(() => {
      ui.falsos = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      n++;
      if (n >= 11) {
        clearInterval(iv);
        ui.rolling = false;
        if (est) ui.tirado = est.nTurno;
      }
      try { pinta(); } catch (e) { console.warn("[clue] tirar", e); }
    }, 70);
    pinta();
  }

  document.addEventListener("click", ev => {
    const el = ev.target.closest && ev.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    try {
      switch (act) {
        case "bots": {
          document.querySelectorAll("#in-bots button").forEach(b => b.classList.toggle("on", b === el));
          $("pantalla").dataset.bots = el.dataset.n;
          return;
        }
        case "jugar-practica": {
          const nombre = ($("in-nombre").value || "").trim() || "Detective";
          const bots = Number($("pantalla").dataset.bots) || 3;
          lsSet("clue.nombre", nombre); lsSet("clue.bots", String(bots));
          iniciaPractica({ bots, nombre });
          return;
        }
        case "otra": if (opcionesPractica) iniciaPractica(opcionesPractica); else pantallaInicio(); return;
        case "elige": {
          if (el.disabled || !est || est.fase !== "elige") return;
          const id = el.dataset.id, mio = (est.eleccion || {})[yo()];
          if (mio === id) conn.jugar({ t: "suelta" });            // soltar el propio
          else if (mio) conn.jugar({ t: "elige", r: id });        // cambiar a otro libre
          else { ui.candidato = ui.candidato === id ? "" : id; firmaPantalla = ""; pintaEleccion(); }
          return;
        }
        case "confirma-pers":
          if (ui.candidato && est && est.fase === "elige") { conn.jugar({ t: "elige", r: ui.candidato }); ui.candidato = ""; }
          return;
        case "tab": ui.tab = el.dataset.tab; firmas.libreta = ""; pintaTabs(); pintaLibreta(); return;
        case "marca": ciclaMarca(el.dataset.k); return;
        case "tirar": tirar(); return;
        case "mover": hacer({ t: "mueve", a: Number(el.dataset.a), v: "dado" }); return;
        case "pasadizo": {
          const f = miAsiento(), q = M.pasadizoDe(M.salaDe(est.fichas[f]));
          if (q) hacer({ t: "mueve", a: M.SALA + q.a, v: "pasadizo" });
          return;
        }
        case "pasa": hacer({ t: "pasa" }); return;
        case "abre-sug": ui.dlg = { k: "sugiere" }; ui.selS = ui.selA = ui.selL = null; pintaModal(); return;
        case "abre-acu": ui.dlg = { k: "acusa" }; ui.selS = ui.selA = ui.selL = null; pintaModal(); return;
        case "sel-s": ui.selS = Number(el.dataset.i); pintaModal(); return;
        case "sel-a": ui.selA = Number(el.dataset.i); pintaModal(); return;
        case "sel-l": ui.selL = Number(el.dataset.i); pintaModal(); return;
        case "cierra-dlg": ui.dlg = null; pintaModal(); return;
        case "envia-sug":
          if (ui.selS == null || ui.selA == null) return;
          { const j = { t: "sugiere", s: ui.selS, a: ui.selA }; ui.dlg = null; hacer(j); }
          return;
        case "envia-acu":
          if (ui.selS == null || ui.selA == null || ui.selL == null) return;
          { const j = { t: "acusa", s: ui.selS, a: ui.selA, l: ui.selL }; ui.dlg = null; hacer(j); }
          return;
        case "refutar": {
          if (ui.busy) return;
          const c = el.dataset.c === "null" ? null : Number(el.dataset.c);
          ui.busy = true; firmaModal = ""; pintaModal();
          let p;
          try { p = conn.refutar(c); } catch (e) { p = Promise.reject(e); }
          Promise.resolve(p).then(ok => { if (ok === false) { ui.busy = false; firmaModal = ""; pintaModal(); } })
            .catch(e => { console.warn("[clue] refutar", e); ui.busy = false; firmaModal = ""; pintaModal(); });
          setTimeout(() => { if (ui.busy) { ui.busy = false; firmaModal = ""; pintaModal(); } }, 4000);
          return;
        }
        case "cierra-revela": ui.cola.shift(); firmaModal = ""; pintaModal(); return;
        case "info-arma": ui.dlg = { k: "arma", a: Number(el.dataset.a) }; pintaModal(); return;
        case "repite-escena": paraEscenas(); arrancaEscenas(); return;
        case "info-pasadizo": ui.dlg = { k: "info", q: Number(el.dataset.q) }; pintaModal(); return;
        case "ver-fin": ui.finCerrado = false; ui.dlg = null; firmaModal = ""; pintaModal(); return;
        case "cierra-fin": ui.finCerrado = true; ui.dlg = null; firmaModal = ""; pintaModal(); return;
        case "velo":
          if (ev.target === el && ui.dlg && (ui.dlg.k === "sugiere" || ui.dlg.k === "acusa" || ui.dlg.k === "info" || ui.dlg.k === "arma")) { ui.dlg = null; pintaModal(); }
          return;
      }
    } catch (e) { console.warn("[clue] accion", act, e); }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && ui.dlg && !$("modal").hidden) { ui.dlg = null; pintaModal(); }
    if (ev.key === "Enter" && ev.target && ev.target.id === "in-nombre") { const b = $("in-jugar"); if (b) b.click(); }
  });

  arranca();
})();
