/* Type Race — la práctica de un jugador. Sin cuenta y sin red: los
   ajustes y el récord de cada combinación quedan en este navegador
   (`localStorage`), que es lo único que hace falta para practicar.
   El reloj arranca con la primera letra, como en Monkeytype.
   @controles: tactil teclado */
(function () {
  "use strict";
  const M = window.TypeRaceMotor, V = window.TypeRaceVista;
  const $ = id => document.getElementById(id);
  const lee = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let aj = M.ajustes(lee("tr.ajustes", {}));
  let semilla = 0, s = null, muestras = [], reloj = 0, tabPulsado = 0, terminado = false;

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
    ahora: () => performance.now(),
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
    s = M.crear(M.palabras(aj, semilla, M.inicial(aj)), aj.largo === 0);
    muestras = [];
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
    grafico();
    document.querySelector(".tr-pista-solo").hidden = true;
    $("res").hidden = false;
    $("otra2").focus();
  }
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
