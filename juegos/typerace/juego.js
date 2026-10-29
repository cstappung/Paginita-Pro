/* Type Race — la práctica de un jugador. Sin cuenta y sin red: los
   ajustes y el récord de cada combinación quedan en este navegador
   (`localStorage`), que es lo único que hace falta para practicar.
   El reloj arranca con la primera letra, como en Monkeytype.
   Dentro de Juegos (juegos/club/typerace/, con `Club`) las palabras al azar
   en inglés con un largo fijo clasifican: la carrera viaja con su registro
   y el verificador (colabtex/src/juegos/solo/verifica/typerace.js) la rehace.
   @controles: tactil teclado */
(function () {
  "use strict";
  const M = window.TypeRaceMotor, V = window.TypeRaceVista;
  const $ = id => document.getElementById(id);
  const lee = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* `Club` solo existe en la página de Juegos (conexion.js): la práctica suelta no clasifica. */
  const Club = window.Club || null;
  const CUENTA = Club ? Club.storageKey("").replace(/^\.cuenta\./, "") : "local";
  const invitado = /[?&]invitado=1/.test(location.search);

  let aj = M.ajustes(lee("tr.ajustes", {}));
  let semilla = 0, s = null, muestras = [], reloj = 0, tabPulsado = 0, terminado = false;
  // la tabla de esta combinación (o null), el registro de la carrera para rehacerla y sus relojes
  let rank = null, tabla = "", reg = [], ult = 0, t1 = 0, w1 = 0;

  /* ---------- sonido ---------- */
  let son = null;
  const sonar = (k, a) => {
    try {
      if (!son) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ac = new AC(); son = V.crearSonido(ac, ac.destination); }
      son[k](a);
    } catch (e) {}
  };

  const vista = V.crear($("caja"), {
    M,
    ahora: () => Math.round(performance.now()),   // enteros: el verificador rehace la carrera con los mismos ms
    registra: (tipo, valor, t, confiable) => {
      if (!rank) return;
      if (!reg.length) { t1 = performance.now(); w1 = Date.now(); }
      const e = [tipo, valor, reg.length ? Math.max(0, t - ult) : 0];
      if (!confiable) e.push("x");
      reg.push(e); ult = t;
    },
    puede: () => !terminado,
    alarga: st => { if (st.pal.length - st.i < 60) { st.pal = M.palabras(aj, semilla, st.pal.length + 100); } },
    alTecla: ev => {
      sonar("tecla", ev);
      if (!reloj && s.t0) arrancaReloj();
      if (ev === "fin") acaba();
      else pintaVivo();
    },
    alTab: () => { tabPulsado = performance.now(); },
    alEnter: () => { if (performance.now() - tabPulsado < 1500) nueva(); }
  });

  /* ---------- ajustes ---------- */
  function pintaAjustes() {
    for (const g of document.querySelectorAll(".tr-grupo")) {
      const k = g.dataset.k;
      const v = k === "acentos" ? (aj.acentos ? "1" : "0") : String(aj[k]);
      for (const b of g.querySelectorAll("button")) b.classList.toggle("si", b.dataset.v === v);
    }
    document.querySelector('[data-k="acentos"]').hidden = aj.idioma !== "es";
    document.querySelector('[data-k="tiempo"]').hidden = aj.largo !== 0;
    eligeTabla();
  }
  /* La clasificación de esta combinación: se muestra solo cuando existe. */
  function eligeTabla() {
    rank = M.categoria(aj);
    document.documentElement.classList.toggle("tr-sin-tabla", !rank);
    if (Club && rank && rank !== tabla) { tabla = rank; Club.category(rank); }
  }
  document.querySelector(".tr-ajustes").addEventListener("click", e => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    const k = b.closest(".tr-grupo").dataset.k;
    const o = Object.assign({}, aj, { [k]: b.dataset.v });
    if (k === "largo" && b.dataset.v !== "0" && aj.largo === 0) o.final = "todos";
    aj = M.ajustes(o);
    guarda("tr.ajustes", { idioma: aj.idioma, acentos: aj.acentos ? 1 : 0, texto: aj.texto, largo: aj.largo, tiempo: aj.tiempo });
    pintaAjustes();
    nueva();
  });

  /* ---------- la carrera ---------- */
  function nueva(mismo) {
    clearInterval(reloj); reloj = 0;
    terminado = false;
    if (!mismo) semilla = (Math.random() * 4294967296) >>> 0;
    eligeTabla();
    reg = []; ult = 0;
    s = M.crear(rank ? M.textoClasif(semilla, CUENTA, aj.largo) : M.palabras(aj, semilla, M.inicial(aj)), aj.largo === 0);
    muestras = [];
    $("rClasif").hidden = true;
    vista.pon(s);
    vista.quieta(false);
    $("res").hidden = true;
    document.querySelector(".tr-pista-solo").hidden = false;
    pintaVivo();
    vista.enfoca();
  }
  function arrancaReloj() {
    let ultErr = 0;
    reloj = setInterval(() => {
      const t = performance.now(), c = M.cuentas(s, t);
      muestras.push({ seg: Math.round(c.ms / 1000), ppm: c.ppm, err: c.e - ultErr });
      ultErr = c.e;
      if (aj.largo === 0 && c.ms >= aj.tiempo * 1000) { s.fin = true; s.tFin = s.t0 + aj.tiempo * 1000; acaba(); return; }
      pintaVivo();
    }, 1000);
  }
  function pintaVivo() {
    const c = M.cuentas(s, performance.now());
    if (aj.largo === 0) {
      const falta = s.t0 ? Math.max(0, aj.tiempo - Math.floor(c.ms / 1000)) : aj.tiempo;
      $("cuenta").textContent = falta + " s";
    } else $("cuenta").textContent = Math.min(s.i, s.pal.length) + "/" + s.pal.length;
    $("ppmVivo").textContent = s.t0 ? c.ppm : 0;
    $("precVivo").textContent = c.prec;
  }
  function acaba() {
    if (terminado) return;
    terminado = true;
    clearInterval(reloj); reloj = 0;
    vista.quieta(true); vista.suelta();
    if (!s.fin) { s.fin = true; s.tFin = performance.now(); }
    const c = M.cuentas(s, s.tFin);
    if (!muestras.length || muestras[muestras.length - 1].seg < Math.round(c.ms / 1000)) muestras.push({ seg: Math.max(1, Math.round(c.ms / 1000)), ppm: c.ppm, err: 0 });
    sonar("tecla", "fin");
    const clave = "tr.record." + [aj.idioma, aj.acentos ? 1 : 0, aj.texto, aj.largo || "t" + aj.tiempo].join(".");
    const prev = lee(clave, 0);
    const nuevo = c.ppm > prev && c.prec >= 75 && c.ms > 3000;
    if (nuevo) guarda(clave, c.ppm);
    $("rPpm").textContent = c.ppm;
    $("rPrec").textContent = c.prec + "%";
    $("rBrutas").textContent = c.brutas;
    $("rPal").textContent = c.p;
    $("rErr").textContent = c.e;
    $("rT").textContent = (c.ms / 1000).toFixed(1) + " s";
    $("rRec").textContent = Math.max(prev, nuevo ? c.ppm : 0) || "—";
    $("rNuevo").hidden = !(nuevo && prev);
    clasifica(c);
    grafico();
    document.querySelector(".tr-pista-solo").hidden = true;
    $("res").hidden = false;
    $("otra2").focus();
  }
  /* La carrera a la clasificación (solo las que tienen tabla, dentro de Juegos y con cuenta). */
  function dice(texto) { const p = $("rClasif"); p.textContent = texto; p.hidden = !texto; }
  function clasifica(c) {
    if (!rank) return dice("Esta combinación se practica, pero no clasifica: las tablas son de palabras en inglés con 10, 25, 50, 100 o 200 palabras.");
    if (!Club) return dice("Esta combinación clasifica: ábrela desde Juegos, con tu cuenta, para entrar a la tabla.");
    if (invitado) return dice("Modo invitado: inicia sesión en Juegos para que esta carrera entre en la clasificación.");
    if (c.prec < 75) return dice("Con menos de 75 % de precisión no entra en la clasificación.");
    const res = M.rehace(semilla, CUENTA, aj.largo, reg);
    if (res.error || !res.c || res.c.ppm < 1 || res.c.ms < 1) return dice("Esta carrera no se pudo registrar para la clasificación.");
    Club.result({ categoria: rank, puntos: res.c.ppm, tiempo: res.c.ms },
      { v: 1, u: CUENTA, s: semilla, e: reg, a: Math.max(1, Math.round(performance.now() - t1)), w: Math.max(1, Date.now() - w1) });
    dice("Enviada a la clasificación (" + res.c.ppm + " ppm).");
  }
  addEventListener("club-rechazo", e => { if (e.detail && e.detail.categoria === rank) dice("Esta carrera no entró en la clasificación: " + (e.detail.motivo || "")); });

  /* Las ppm de cada segundo, con los errores de ese segundo como puntos
     rojos abajo. */
  function grafico() {
    const svg = $("grafico"), W = 600, H = 140, P = 18;
    const m = muestras.length ? muestras : [{ seg: 1, ppm: 0, err: 0 }];
    const tope = Math.max(20, ...m.map(x => x.ppm)) * 1.15;
    const ult = Math.max(1, m[m.length - 1].seg);
    const X = sg => P + (W - 2 * P) * (m.length === 1 ? 1 : (sg - m[0].seg) / Math.max(1, ult - m[0].seg));
    const Y = v => H - P - (H - 2 * P) * v / tope;
    const pts = m.map(x => `${X(x.seg).toFixed(1)},${Y(x.ppm).toFixed(1)}`);
    const area = `M${X(m[0].seg)},${H - P} L${pts.join(" L")} L${X(m[m.length - 1].seg)},${H - P} Z`;
    svg.innerHTML = `<line class="eje" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/>`
      + `<path class="area" d="${area}"/><polyline class="linea" points="${pts.join(" ")}"/>`
      + m.filter(x => x.err > 0).map(x => `<circle class="err" cx="${X(x.seg).toFixed(1)}" cy="${H - P - 4}" r="${Math.min(5, 2 + x.err)}"/>`).join("")
      + `<text x="${P}" y="12">${Math.round(tope)} ppm</text>`;
  }
  $("otra").addEventListener("click", () => nueva());
  $("otra2").addEventListener("click", () => nueva());
  $("repite").addEventListener("click", () => nueva(true));
  document.addEventListener("keydown", e => {
    if (e.key === "Tab") { e.preventDefault(); tabPulsado = performance.now(); }
    else if (e.key === "Enter" && performance.now() - tabPulsado < 1500) { e.preventDefault(); nueva(); }
  });

  /* ---------- tema ---------- */
  const raiz = document.documentElement;
  const pintaTema = () => { $("tema").textContent = raiz.dataset.tema === "oscuro" ? "☀" : "☾"; };
  $("tema").addEventListener("click", () => {
    raiz.dataset.tema = raiz.dataset.tema === "oscuro" ? "claro" : "oscuro";
    try { localStorage.setItem("jg.tema", raiz.dataset.tema); } catch (e) {}
    pintaTema();
  });
  pintaTema();

  pintaAjustes();
  nueva();
})();
