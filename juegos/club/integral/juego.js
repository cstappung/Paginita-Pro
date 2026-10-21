/* Integrodle: la pantalla. El motor (motor.js) decide la integral del día,
   corrige cada intento y lleva la cuenta; aquí solo se dibuja la hoja, se
   escribe con el teclado y se guarda.

   Dos tipos de partida. El Diario es una integral al día, la misma para
   todos, que sale solo de la fecha de Chile: resolverla suma puntos y
   alarga la racha. La Práctica es al azar (de una técnica, si se elige) y
   no suma nada. Lo del diario vive en localStorage (por cuenta, con
   Club.storageKey) y, dentro de Juegos, también en la cuenta
   (Club.guardarPartida → users/<uid>/club/integral). */
(() => {
  "use strict";
  const M = window.IntegralMotor, X = M.X, Club = window.Club || null;
  const $ = id => document.getElementById(id);
  const clave = k => (Club ? Club.storageKey(k) : k);
  const lee = (k, def) => { try { const v = JSON.parse(localStorage.getItem(clave(k))); return v == null ? def : v; } catch (e) { return def; } };
  const guarda = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tactil = matchMedia("(pointer: coarse)").matches;
  const TOPE_TIEMPO = 604800000;   // lo que acepta la regla de soloRanks
  /* La nota del timbre, en escala chilena: a la primera un 7,0. */
  const NOTAS = ["7,0", "6,5", "6,0", "5,5", "5,0", "4,5"];

  /* KaTeX dibuja la matemática; si no cargó, se ve el LaTeX crudo. */
  function tex(s, grande) {
    if (window.katex) { try { return window.katex.renderToString(s, { throwOnError: false, displayMode: !!grande, strict: "ignore" }); } catch (e) { /* abajo */ } }
    return `<code>${esc(s)}</code>`;
  }

  let hoy = M.diaChile();
  let est = M.limpia(lee("integral.estado", null));
  let tipo = lee("integral.tipo", "diario") === "practica" ? "practica" : "diario";
  let tecnica = M.TECNICAS[lee("integral.tecnica", "")] ? lee("integral.tecnica", "") : "";
  let prac = null;             // {id, i: [intentos]} de la práctica, solo en memoria
  let animar = null;           // lo recién agregado, para animarlo una vez
  let borrador = { diario: "", practica: "" };
  let verF = false;            // en el celular: qué mitad del teclado se ve
  const graficos = new Set();  // los intentos con el gráfico abierto

  /* ---------- la forma de jugar (antitrampas) ----------
     Como en Electrodle: por cada intento, cuánto tiempo visible pasó desde
     el anterior (o desde que se abrió la hoja) y cuántas acciones de
     verdad lo armaron (teclas, toques, clics, texto). Un script que
     despacha eventos da isTrusted falso: eso se cuenta aparte (`u`), salvo
     que lo marque mando.js con un mando conectado de verdad (`mc`). */
  const mandoConectado = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (e) { return false; } };
  let visible = 0, desde = performance.now();
  const relojVisible = () => visible + (document.hidden ? 0 : performance.now() - desde);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) visible += performance.now() - desde; else desde = performance.now();
  });
  const sensor = { t0: 0, a: 0, u: 0, mc: 0, ultMando: -1e9 };
  for (const t of ["pointerdown", "keydown", "input", "click", "submit"]) document.addEventListener(t, ev => {
    if (ev.isTrusted) { if (t !== "submit") sensor.a++; return; }
    if (ev.__mando && mandoConectado()) { sensor.ultMando = performance.now(); if (t === "pointerdown") sensor.mc++; return; }
    /* Un `input` sintético no intenta nada por sí solo (correctores,
       autocompletar); para intentar hay que enviar, y eso sí se cuenta. */
    if (t === "input" || (t === "submit" && performance.now() - sensor.ultMando < 1000)) return;
    sensor.u++;
  }, true);
  function cortaSensor() {
    const ahora = relojVisible(), r = { dt: Math.round(ahora - sensor.t0), a: sensor.a + sensor.mc, u: sensor.u, mc: sensor.mc };
    sensor.t0 = ahora; sensor.a = sensor.u = sensor.mc = 0;
    return r;
  }

  /* ---------- estado ---------- */
  function asegurarHoy() { if (est.prog.fecha !== hoy) est.prog = { fecha: hoy, i: [], ms: 0 }; }
  const guardaLocal = () => guarda("integral.estado", est);
  const sube = () => { if (Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(est)); };
  const azar = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  function nuevaPractica() { prac = { id: M.objetivoAlAzar(azar, prac && prac.id, tecnica), i: [] }; graficos.clear(); return prac; }

  /* Lo que se está jugando: la integral, los intentos, si terminó, si se
     ganó y cuántos fallos lleva. Si el día ya está en `hist` (quizá
     terminado en otro dispositivo), manda eso. */
  function juego() {
    if (tipo === "practica") { const p = prac || nuevaPractica(); return Object.assign({ id: p.id, i: p.i }, M.estado(p.id, p.i)); }
    const id = M.objetivoDelDia(hoy), h = est.hist[hoy];
    if (h) return Object.assign({ id, i: h[4] }, M.estado(id, h[4]), { fin: true, gano: !!h[3], puntos: h[0] });
    asegurarHoy();
    return Object.assign({ id, i: est.prog.i }, M.estado(id, est.prog.i));
  }

  /* Lo de la cuenta se mezcla con lo de aquí; si aquí había algo que la
     cuenta no tenía, se sube. */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    if (!nube) { if (Object.keys(est.hist).length) sube(); return; }
    const junta = M.mezcla(est, nube);
    if (JSON.stringify(junta) !== JSON.stringify(est)) { est = junta; guardaLocal(); pinta(); }
    if (JSON.stringify(junta) !== JSON.stringify(M.limpia(nube))) sube();
  });

  /* ---------- intentar ---------- */
  function intenta() {
    const g = juego(), e = $("entrada");
    if (g.fin || !e) return;
    const txt = e.value.trim();
    const r = M.revisa(g.id, txt);
    if (r.error) return avisa(r.error, true);
    const can = X.canonica(txt);
    if (g.i.some(s => X.canonica(s) === can)) return avisa("Eso ya lo intentaste: prueba otra cosa.", true);
    const s0 = cortaSensor();
    if (tipo === "practica") prac.i.push(txt);
    else {
      asegurarHoy();
      const pr = est.prog;
      /* La forma va a la par de lo intentado; si se perdió (un día
         mezclado desde otro dispositivo), ese día queda sin ella. */
      if (pr.t !== null && (pr.t || []).length === pr.i.length) pr.t = (pr.t || []).concat([[s0.dt, s0.a]]);
      else pr.t = null;
      pr.u = (pr.u || 0) + s0.u; pr.mc = (pr.mc || 0) + s0.mc;
      pr.i.push(txt);
    }
    borrador[tipo] = "";
    const s = M.estado(g.id, tipo === "practica" ? prac.i : est.prog.i);
    animar = { tipo, n: g.i.length + 1, pista: !s.fin && (s.fallos === 1 || s.fallos === 3), fin: s.fin };
    if (s.fin && tipo === "diario") termina(s.gano);
    if (tipo === "diario") { guardaLocal(); sube(); }
    pinta();
    if (s.fin) { const c = document.querySelector(".cierre"); if (c) c.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); }
    else { const en = $("entrada"); if (en && !tactil) en.focus({ preventScroll: true }); }
  }

  /* El día terminado pasa a `hist`: a la cuenta de puntos y, si se
     resolvió, a la racha. Los dos van a la Clasificación con su prueba
     (M.prueba): los puntos, con todo el historial; la racha, con lo de
     hoy. Perder no suma, así que no hay récord que mandar. */
  function termina(gano) {
    const pr = est.prog;
    est = M.registra(est, hoy, pr.i, pr.ms, pr);
    if (!Club || !gano) return;
    const t = M.total(est);
    Club.result({ categoria: "club-integral-puntos", puntos: t.puntos, tiempo: Math.min(TOPE_TIEMPO, Math.max(1, t.ms)) }, M.prueba(est, hoy));
    Club.result({ categoria: "club-integral-racha", puntos: M.racha(est, hoy), tiempo: Math.min(TOPE_TIEMPO, Math.max(1, M.tiempoDia(est, hoy))) }, M.prueba(est, hoy, true));
  }

  /* ---------- el teclado ----------
     Cada tecla escribe texto en la línea (lo mismo que se podría teclear),
     donde está el cursor; si hay algo seleccionado, las funciones y la
     fracción lo envuelven. `[antes, después]`: el cursor queda entre los
     dos. */
  const FR = `<span class="fr"><i></i><b></b><i></i></span>`;
  const CAJA = `<span style="display:inline-block;width:.62em;height:.72em;border:1.3px solid currentColor;border-radius:2px;vertical-align:-.05em"></span>`;
  const TECLAS_F = [
    ["sin", "sin(", ")"], ["cos", "cos(", ")"], ["tan", "tan(", ")"], ["sec", "sec(", ")"], ["csc", "csc(", ")"],
    ["cot", "cot(", ")"], ["arcsin", "arcsin(", ")", "<small>arcsin</small>"], ["arccos", "arccos(", ")", "<small>arccos</small>"], ["arctan", "arctan(", ")", "<small>arctan</small>"], ["sinh", "sinh(", ")"],
    ["cosh", "cosh(", ")"], ["ln", "ln(", ")"], ["e^", "e^(", ")", `e<sup>${CAJA}</sup>`], ["abs", "|", "|", `|${CAJA}|`], ["raiz", "sqrt(", ")", `√${CAJA}`],
    ["frac", null, null, FR, "Fracción"], ["cuad", "^2", "", `${CAJA}<sup>2</sup>`, "Al cuadrado"], ["pot", "^(", ")", `${CAJA}<sup>n</sup>`, "Potencia"], ["pi", "π", "", "π"], ["e", "e", "", "e"]
  ];
  const TECLAS_N = [
    ["7"], ["8"], ["9"], ["(", "(", ")", "( )", "Paréntesis"], [")"],
    ["4"], ["5"], ["6"], ["*", "·", "", "×", "Por"], ["/", "/", "", "÷", "Dividido"],
    ["1"], ["2"], ["3"], ["+", "+", "", "+", "Más"], ["-", "-", "", "−", "Menos"],
    ["0"], [".", ".", "", ","], ["x", "x", "", "x"], ["esp", " ", "", "␣", "Espacio"], ["borra", null, null, "⌫", "Borrar"],
    ["izq", null, null, "←", "Mover a la izquierda"], ["der", null, null, "→", "Mover a la derecha"], ["limpia", null, null, "AC", "Borrar todo"], ["ok", null, null, "Revisar ✓", "Revisar"]
  ];
  function teclaHTML([k, , , html, nombre]) {
    const c = k === "ok" ? "ok" : k === "borra" || k === "limpia" ? "borra" : k === "x" ? "var" : /^[()*/+\-^]$|^(frac|cuad|pot|esp|izq|der|abs|raiz)$/.test(k) ? "op" : /^\d$|^\.$/.test(k) ? "" : "f";
    return `<button type="button" class="tecla ${c}" data-k="${esc(k)}"${nombre ? ` aria-label="${esc(nombre)}" title="${esc(nombre)}"` : ""}><span>${html || esc(k)}</span></button>`;
  }
  const TODAS = {};
  for (const t of [...TECLAS_F, ...TECLAS_N]) TODAS[t[0]] = t;
  function pulsa(k) {
    const e = $("entrada");
    if (!e) return;
    if (k === "ok") return intenta();
    const v = e.value, a = e.selectionStart == null ? v.length : e.selectionStart, b = e.selectionEnd == null ? a : e.selectionEnd;
    const pon = (texto, cursor) => { e.value = texto; e.setSelectionRange(cursor, cursor); cambia(); };
    if (k === "borra") { if (a !== b) pon(v.slice(0, a) + v.slice(b), a); else if (a > 0) pon(v.slice(0, a - 1) + v.slice(a), a - 1); return; }
    if (k === "limpia") return pon("", 0);
    if (k === "izq") { const c = a !== b ? a : Math.max(0, a - 1); e.setSelectionRange(c, c); return; }
    if (k === "der") { const c = a !== b ? b : Math.min(v.length, a + 1); e.setSelectionRange(c, c); return; }
    const sel = v.slice(a, b);
    if (k === "frac") {
      /* Con algo seleccionado, eso es el numerador y el cursor va al denominador. */
      const ins = sel ? `(${sel})/()` : "()/()";
      return pon(v.slice(0, a) + ins + v.slice(b), a + (sel ? ins.length - 1 : 1));
    }
    const t = TODAS[k], antes = t[1] == null ? k : t[1], despues = t[2] || "";
    const ins = antes + sel + despues;
    if (v.length - (b - a) + ins.length > X.LARGO_MAX) return avisa("Ya es demasiado larga.", true);
    pon(v.slice(0, a) + ins + v.slice(b), a + (sel ? ins.length : antes.length));
  }

  /* ---------- la vista previa ----------
     Mientras se escribe, la línea se lee y se dibuja como quedaría en el
     cuaderno; si todavía no se puede leer, se muestra tal cual. */
  function cambia() {
    const e = $("entrada"), p = $("previa");
    if (!e || !p) return;
    borrador[tipo] = e.value;
    e.classList.remove("malo");
    const g = juego(), q = M.ficha(g.id), txt = e.value.trim();
    if (!txt) { p.innerHTML = `<span class="vacia">${q.def ? "Escribe el valor exacto…" : "Escribe una primitiva…"}</span>`; avisa(""); return; }
    const l = X.lee(txt);
    if (l.error) { p.innerHTML = `<span class="crudo" translate="no">${esc(txt)}</span>`; avisa(l.error); return; }
    let s = X.latex(l.arbol), extra = "";
    if (q.def) {
      const v = X.evalua(l.arbol, 0);
      if (!X.usaX(l.arbol) && Number.isFinite(v) && !/^-?\d+(\.\d+)?$/.test(txt)) extra = `\\approx ${decimal(v)}`;
    } else if (!/C/i.test(txt)) s += " + C";
    p.innerHTML = tex(`${q.def ? "" : "\\displaystyle\\int f\\,dx ="} ${s} ${extra}`);
    avisa(q.def ? (X.usaX(l.arbol) ? "La respuesta es un número: sin x." : "") : X.usaX(l.arbol) ? "" : "Una primitiva depende de x.");
  }
  const decimal = v => (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0) ? v.toExponential(4) : (+v.toPrecision(6)).toString()).replace(".", "{,}");
  function avisa(t, malo) {
    const a = $("aviso"), e = $("entrada");
    if (!a) return;
    a.textContent = t;
    a.classList.toggle("malo", !!malo);
    if (malo && e) {
      e.classList.add("malo");
      const f = e.closest(".escribir");
      if (f && !reducido()) { f.classList.remove("temblor"); void f.offsetWidth; f.classList.add("temblor"); }
    }
  }

  /* ---------- el gráfico de un intento errado ----------
     El integrando contra la derivada de lo escrito: donde se separan las
     curvas está el error. */
  function grafico(id, arbol) {
    const c = M.curvas(id, arbol, 120), W = 460, H = 190, P = 14;
    const fs = c.f.filter(Number.isFinite).sort((a, b) => a - b);
    if (!fs.length) return "";
    let lo = fs[Math.floor(fs.length * 0.03)], hi = fs[Math.ceil(fs.length * 0.97) - 1];
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    /* La derivada también tiene que verse, pero sin aplastar el integrando. */
    const ds = (c.d || []).filter(Number.isFinite).sort((a, b) => a - b), span = hi - lo;
    if (ds.length) {
      lo = Math.max(lo - 2 * span, Math.min(lo, ds[Math.floor(ds.length * 0.05)]));
      hi = Math.min(hi + 2 * span, Math.max(hi, ds[Math.ceil(ds.length * 0.95) - 1]));
    }
    const m = (hi - lo) * 0.12; lo -= m; hi += m;
    if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
    if (hi < 0 && -hi < (hi - lo) * 0.6) hi = 0;
    const sx = x => P + (x - c.a) / (c.b - c.a) * (W - 2 * P), sy = y => H - P - (y - lo) / (hi - lo) * (H - 2 * P);
    const camino = ys => {
      let d = "", sigue = false;
      ys.forEach((y, k) => {
        if (!Number.isFinite(y) || y < lo - (hi - lo) || y > hi + (hi - lo)) { sigue = false; return; }
        d += `${sigue ? "L" : "M"}${sx(c.xs[k]).toFixed(1)} ${sy(Math.max(lo - 0.05 * (hi - lo), Math.min(hi + 0.05 * (hi - lo), y))).toFixed(1)}`;
        sigue = true;
      });
      return d;
    };
    const cero = lo < 0 && hi > 0 ? `<line x1="${P}" x2="${W - P}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}" stroke="#9fb0c9" stroke-width="1"/>` : "";
    const [la, lb] = M.ficha(id).r;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Integrando y derivada de tu respuesta en el tramo">
      <defs><clipPath id="cg"><rect x="${P}" y="${P - 4}" width="${W - 2 * P}" height="${H - 2 * P + 8}"/></clipPath></defs>
      <g stroke="#e3eaf4" stroke-width="1">${Array.from({ length: 9 }, (_, k) => `<line x1="${P + k * (W - 2 * P) / 8}" x2="${P + k * (W - 2 * P) / 8}" y1="${P}" y2="${H - P}"/>`).join("")}</g>
      ${cero}
      <g clip-path="url(#cg)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${camino(c.f)}" stroke="#1f3f7a" stroke-width="2.6"/>
        <path d="${camino(c.d)}" stroke="#c63a2f" stroke-width="2.2" stroke-dasharray="7 5"/>
      </g>
      <g font-family="JetBrains Mono,monospace" font-size="11" fill="#5b6272"><text x="${P}" y="${H - 2}">${esc(la)}</text><text x="${W - P}" y="${H - 2}" text-anchor="end">${esc(lb)}</text></g>
    </svg>
    <div class="leyenda"><span><i style="color:#1f3f7a"></i>f(x), el integrando</span><span><i style="color:#c63a2f;border-top-style:dashed"></i>la derivada de tu respuesta</span></div>`;
  }

  /* ---------- dibujo ---------- */
  const MARCA_BIEN = `<svg class="marca" viewBox="0 0 34 30" aria-hidden="true"><path d="M6 16l7 8L29 6"/></svg>`;
  const MARCA_MAL = `<svg class="marca" viewBox="0 0 34 30" aria-hidden="true"><path d="M9 6l17 18"/><path d="M26 6L9 24"/></svg>`;
  const fechaLarga = f => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(f + "T12:00:00Z"));
  const estrellas = d => `${"★".repeat(d)}<i>${"★".repeat(3 - d)}</i>`;
  const resultadoTex = id => (M.ficha(id).def ? `${M.latexIntegral(id)} = ${M.latexValor(id)}` : `${M.latexIntegral(id)} = ${M.latexPrimitiva(id)} + C`);

  function intentoHTML(g, txt, k) {
    const r = M.revisa(g.id, txt), q = M.ficha(g.id), nuevo = animar && animar.tipo === tipo && animar.n === k + 1;
    if (r.error) return "";
    let nota = "";
    if (!r.ok && q.def) {
      nota = Number.isFinite(r.valor)
        ? `<div class="nota-intento"><span>Tu valor ≈ <b translate="no">${esc(decimal(r.valor).replace("{,}", ","))}</b></span><span class="mano">${r.dir > 0 ? "↑ el correcto es mayor" : "↓ el correcto es menor"}</span></div>`
        : `<div class="nota-intento"><span class="mano">No da un número real</span></div>`;
    } else if (!r.ok) {
      const abierto = graficos.has(k);
      nota = `<div class="nota-intento"><span class="mano">Su derivada no es el integrando</span><button type="button" class="ver" data-graf="${k}" aria-expanded="${abierto}">${abierto ? "Ocultar gráfico" : "Ver dónde se separan"}</button></div>` +
        (abierto ? `<div class="grafico">${grafico(g.id, r.arbol)}</div>` : "");
    }
    const s = X.latex(r.arbol) + (!q.def && r.ok && !/C/i.test(txt) ? " + C" : "");
    return `<li class="intento ${r.ok ? "bien" : "mal"}${nuevo ? " nuevo" : ""}"><span class="n">${k + 1}</span>
      <div class="r" translate="no" title="${esc(txt)}">${tex("\\displaystyle " + s)}</div>${r.ok ? MARCA_BIEN : MARCA_MAL}${nota}</li>`;
  }

  function pistasHTML(g) {
    const q = M.ficha(g.id), t = M.TECNICAS[q.t], p = M.pistas(g.fin ? 99 : g.fallos);
    const nueva = n => animar && animar.tipo === tipo && animar.pista && g.fallos === n;
    const una = (abierta, titulo, cuerpo, falta, n) => `<div class="postit${abierta ? "" : " cerrado"}${abierta && nueva(n) ? " nuevo" : ""}">
      <h3>${titulo}</h3>${abierta ? cuerpo : `<p>${falta}</p>`}</div>`;
    return `<div class="pistas">
      ${una(p.tecnica, `${esc(t.c)} Técnica`, `<p><b>${esc(t.n)}</b>. ${esc(t.d)}</p>`, "Se destapa con el primer fallo.", 1)}
      ${una(p.paso, "✎ Paso clave", `<p translate="no">${tex("\\displaystyle " + q.p)}</p>`, "Se destapa con el tercer fallo.", 3)}
    </div>`;
  }

  function cierreHTML(g) {
    const q = M.ficha(g.id), t = M.TECNICAS[q.t], nuevo = animar && animar.tipo === tipo && animar.fin;
    const nota = g.gano ? NOTAS[g.n - 1] : "2,0";
    const pts = tipo === "diario" ? (g.puntos != null ? g.puntos : M.puntosDe(g.n, g.gano, q.d)) : 0;
    const sub = g.gano
      ? `${g.n === 1 ? "A la primera" : `En ${g.n} intentos`}${tipo === "diario" ? ` · +${pts} puntos · 🔥 ${M.racha(est, hoy)}` : " · práctica, sin puntos"}`
      : `Se acabaron los ${M.MAX_INTENTOS} intentos${tipo === "diario" ? " · la racha vuelve a cero" : ""}.`;
    const acciones = tipo === "diario"
      ? `<button type="button" class="boton prim" data-acc="compartir">Compartir resultado</button>
         <button type="button" class="boton" data-acc="practica">Practicar más</button>
         <span class="cuenta">Nueva integral en <b id="cuenta">--:--:--</b></span>`
      : `<button type="button" class="boton prim" data-acc="otra">Otra integral →</button>`;
    return `<section class="cierre ${g.gano ? "gano" : "perdio"}">
      <div class="timbre${nuevo ? " nuevo" : ""}" aria-label="Nota ${nota}">${nota}<small>${g.gano ? "BIEN" : "REPASAR"}</small></div>
      <h2>${g.gano ? "¡Resuelta!" : "Esta vez no"}</h2>
      <p class="sub">${sub}</p>
      <dl class="solucion">
        <div><dt>Técnica</dt><dd>${esc(t.c)} ${esc(t.n)}</dd></div>
        <div><dt>Paso clave</dt><dd translate="no">${tex("\\displaystyle " + q.p)}</dd></div>
        <div><dt>Resultado</dt><dd class="res" translate="no">${tex(resultadoTex(g.id), true)}</dd></div>
      </dl>
      <div class="acciones">${acciones}</div>
      <p class="aviso" id="avisoCierre"></p>
    </section>`;
  }

  function escribirHTML(g) {
    const q = M.ficha(g.id);
    return `<form class="escribir" id="escribir" autocomplete="off">
      <div class="previa" id="previa" translate="no" aria-live="polite"></div>
      <div class="linea">
        <input id="entrada" type="text" aria-label="${q.def ? "Valor de la integral" : "Una primitiva"}" placeholder="${q.def ? "p. ej. π/4 - ln(2)/2" : "p. ej. x sin(x) + cos(x)"}"
          spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="${X.LARGO_MAX}" translate="no"${tactil ? ' inputmode="none"' : ""}>
        <button type="submit" class="enviar">Revisar</button>
      </div>
      <p class="aviso" id="aviso"></p>
      <div class="pestanas" role="tablist"><button type="button" role="tab" data-pest="n" aria-selected="${!verF}">123 &nbsp;+ −</button><button type="button" role="tab" data-pest="f" aria-selected="${verF}">sin · ln · ½</button></div>
      <div class="teclado${verF ? " ver-f" : ""}" id="teclado">
        <div class="grupo fun">${TECLAS_F.map(teclaHTML).join("")}</div>
        <div class="grupo num">${TECLAS_N.map(teclaHTML).join("")}</div>
      </div>
    </form>`;
  }

  function pinta() {
    const nuevoDia = M.diaChile();
    if (nuevoDia !== hoy) { hoy = nuevoDia; graficos.clear(); }
    const g = juego(), q = M.ficha(g.id);
    for (const b of document.querySelectorAll("[data-tipo]")) b.setAttribute("aria-selected", String(b.dataset.tipo === tipo));
    $("fecha").textContent = tipo === "diario" ? fechaLarga(hoy) : "Práctica";
    $("numero").textContent = tipo === "diario" ? `#${M.numeroIntegral(hoy)}` : "—";
    $("racha").textContent = `🔥 ${M.racha(est, hoy)}`;
    $("puntos").innerHTML = `∫ ${M.total(est).puntos.toLocaleString("es-CL")} <small>pts</small>`;

    const fallos = g.fallos, casillas = Array.from({ length: M.MAX_INTENTOS }, (_, k) => {
      const usada = k < g.n && (k < fallos || g.gano);
      const bien = g.gano && k === g.n - 1;
      return `<span class="${bien ? "bien" : usada ? "mal" : ""}">${bien ? "✓" : usada ? "✗" : ""}</span>`;
    }).join("");
    const tecnicas = tipo === "practica"
      ? `<div class="tecnicas" role="group" aria-label="Practicar una técnica"><button type="button" data-tec="" aria-pressed="${!tecnica}">Todas</button>${Object.entries(M.TECNICAS).map(([k, t]) => `<button type="button" data-tec="${k}" aria-pressed="${tecnica === k}">${esc(t.c)} ${esc(t.n)}</button>`).join("")}</div>`
      : "";
    $("hoja").innerHTML = `${tecnicas}
      <div class="enunciado">
        <div class="rotulo"><mark>${tipo === "diario" ? `Integral N.º ${M.numeroIntegral(hoy)}` : "Ejercicio de práctica"}</mark><span class="estrellas" title="Dificultad ${q.d} de 3" aria-label="Dificultad ${q.d} de 3">${estrellas(q.d)}</span></div>
        <div class="integral" translate="no">${tex(M.latexIntegral(g.id), true)}</div>
        <div class="casillas" aria-label="${plural(fallos, "fallo", "fallos")} de ${M.MAX_INTENTOS}">Intentos ${casillas}</div>
      </div>
      ${pistasHTML(g)}
      ${g.i.length ? `<ol class="intentos">${g.i.map((t, k) => intentoHTML(g, t, k)).join("")}</ol>` : ""}
      ${g.fin ? cierreHTML(g) : escribirHTML(g)}`;
    const e = $("entrada");
    if (e) {
      e.value = borrador[tipo] || "";
      cambia();
    }
    animar = null;
    tic();
  }

  /* ---------- eventos de la hoja ---------- */
  const hoja = $("hoja");
  /* Las teclas no se llevan el foco: el cursor de la línea se queda donde estaba. */
  hoja.addEventListener("pointerdown", ev => { if (ev.target.closest(".tecla")) ev.preventDefault(); });
  hoja.addEventListener("click", ev => {
    const t = ev.target.closest(".tecla");
    if (t) { pulsa(t.dataset.k); if (!tactil && $("entrada")) $("entrada").focus({ preventScroll: true }); return; }
    const p = ev.target.closest("[data-pest]");
    if (p) { verF = p.dataset.pest === "f"; $("teclado").classList.toggle("ver-f", verF); for (const b of hoja.querySelectorAll("[data-pest]")) b.setAttribute("aria-selected", String(b === p)); return; }
    const gr = ev.target.closest("[data-graf]");
    if (gr) { const k = +gr.dataset.graf; if (graficos.has(k)) graficos.delete(k); else graficos.add(k); pinta(); return; }
    const tc = ev.target.closest("[data-tec]");
    if (tc) { tecnica = tc.dataset.tec; guarda("integral.tecnica", tecnica); cortaSensor(); borrador.practica = ""; nuevaPractica(); pinta(); return; }
    const ac = ev.target.closest("[data-acc]");
    if (!ac) return;
    if (ac.dataset.acc === "otra") { cortaSensor(); borrador.practica = ""; nuevaPractica(); pinta(); window.scrollTo({ top: 0, behavior: reducido() ? "auto" : "smooth" }); }
    else if (ac.dataset.acc === "practica") ponTipo("practica");
    else if (ac.dataset.acc === "compartir") comparte();
  });
  hoja.addEventListener("input", ev => { if (ev.target.id === "entrada") cambia(); });
  hoja.addEventListener("submit", ev => { ev.preventDefault(); intenta(); });

  function comparte() {
    const txt = M.resumen(est, hoy), a = $("avisoCierre");
    const listo = () => { if (a) a.textContent = "Copiado: pégalo donde quieras."; };
    const copia = () => {
      try { navigator.clipboard.writeText(txt).then(listo, () => { if (a) a.textContent = txt; }); }
      catch (e) { if (a) a.textContent = txt; }
    };
    if (navigator.share && tactil) navigator.share({ text: txt }).catch(copia); else copia();
  }

  function ponTipo(t) {
    tipo = t; guarda("integral.tipo", t); cortaSensor(); graficos.clear(); animar = null; pinta();
    window.scrollTo({ top: 0, behavior: reducido() ? "auto" : "smooth" });
  }
  for (const b of document.querySelectorAll("[data-tipo]")) b.onclick = () => ponTipo(b.dataset.tipo);

  /* ---------- estadísticas y ayuda ---------- */
  const dialogo = $("dialogo");
  function abre(html) {
    dialogo.innerHTML = `<div class="cuerpo"><button type="button" class="icono cerrar" aria-label="Cerrar" data-cerrar>✕</button>${html}</div>`;
    dialogo.querySelector("[data-cerrar]").onclick = () => dialogo.close();
    if (dialogo.showModal) dialogo.showModal(); else dialogo.setAttribute("open", "");
  }
  dialogo.addEventListener("click", ev => { if (ev.target === dialogo) dialogo.close(); });
  function estadisticas() {
    const s = M.estadisticas(est, hoy), max = Math.max(1, ...s.dist), h = est.hist[hoy];
    const hoyN = h && h[3] ? h[1] : 0;
    abre(`<h2 id="dialogoT">Estadísticas</h2>
      <div class="numeros"><div><b>${s.jugados}</b><span>jugadas</span></div><div><b>${s.jugados ? Math.round(s.ganados / s.jugados * 100) : 0}%</b><span>resueltas</span></div>
      <div><b>${s.racha}</b><span>racha</span></div><div><b>${s.mejor}</b><span>mejor racha</span></div></div>
      <p><b>${s.puntos.toLocaleString("es-CL")}</b> puntos en total.</p>
      <h3>En cuántos intentos</h3>
      <div class="dist">${s.dist.map((n, k) => `<div><b>${k + 1}</b><span class="${hoyN === k + 1 ? "hoy" : ""}" style="width:${Math.max(8, n / max * 100)}%">${n}</span></div>`).join("")}</div>`);
  }
  function ayuda() {
    const P = M.PUNTOS;
    abre(`<h2 id="dialogoT">Cómo se juega</h2>
      <p>Cada día hay <b>una integral</b>, la misma para todos; cambia a medianoche de Chile. Tienes <b>${M.MAX_INTENTOS} intentos</b> para resolverla.</p>
      <ul>
        <li>Si es <b>indefinida</b>, escribe una primitiva. Vale cualquier forma equivalente: se acepta si su derivada es el integrando (la constante da lo mismo, con o sin «+ C»).</li>
        <li>Si es <b>definida</b>, escribe el valor <b>exacto</b> (con fracciones, π, e, ln o raíces), no un decimal.</li>
        <li>Al primer fallo se destapa la <b>técnica</b>; al tercero, el <b>paso clave</b>. En un fallo verás también dónde se separa tu derivada del integrando, o si el valor correcto es mayor o menor.</li>
        <li>Resolver vale ${P.join(", ")} puntos según el intento, +10 por cada ★ de dificultad sobre la primera. La 🔥 racha cuenta los días seguidos resueltos.</li>
        <li><b>Práctica</b>: integrales al azar, de la técnica que elijas, sin puntos.</li>
      </ul>
      <h3>Cómo escribir</h3>
      <table><tr><th>Para</th><th>Escribe</th></tr>
        <tr><td>${tex("x\\sin x")}</td><td><code>x sin(x)</code> o <code>x*sin x</code></td></tr>
        <tr><td>${tex("\\frac{x+1}{x-1}")}</td><td><code>(x+1)/(x-1)</code> o la tecla de fracción</td></tr>
        <tr><td>${tex("\\sin^2 x")}</td><td><code>sin(x)^2</code> o <code>sin^2 x</code></td></tr>
        <tr><td>${tex("\\ln\\left|x-1\\right|")}</td><td><code>ln|x-1|</code></td></tr>
        <tr><td>${tex("e^{x^2}")}</td><td><code>e^(x^2)</code></td></tr>
        <tr><td>${tex("\\sqrt{1-x^2}")}</td><td><code>sqrt(1-x^2)</code> o <code>√(1-x^2)</code></td></tr>
        <tr><td>${tex("\\arctan x")}</td><td><code>arctan(x)</code> (también <code>atan</code>, <code>arctg</code>)</td></tr>
      </table>
      <p>La línea de arriba muestra cómo se lee lo que escribes antes de enviarlo. Ojo: <code>1/2x</code> es ${tex("\\tfrac{1}{2}x")}; para ${tex("\\tfrac{1}{2x}")} escribe <code>1/(2x)</code>. <code>ln</code> es el logaritmo natural y <code>log</code>, el de base 10.</p>`);
  }
  $("btnStats").onclick = estadisticas;
  $("btnAyuda").onclick = ayuda;

  /* ---------- el reloj ----------
     El tiempo del diario corre solo con la pestaña a la vista y la
     integral sin resolver; es el desempate de la Clasificación. Cada medio
     minuto se mira si en Chile ya es otro día. */
  let marca = performance.now();
  function tic() {
    const c = $("cuenta");
    if (!c) return;
    const s = Math.floor(M.faltaParaManana() / 1000);
    c.textContent = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  setInterval(() => {
    const ahora = performance.now();
    if (tipo === "diario" && !document.hidden && est.prog.fecha === hoy && !est.hist[hoy]) {
      est.prog.ms = Math.min(86400000, est.prog.ms + Math.min(5000, ahora - marca));
    }
    marca = ahora;
    tic();
  }, 1000);
  setInterval(() => { if (tipo === "diario") guardaLocal(); }, 5000);
  document.addEventListener("visibilitychange", () => { marca = performance.now(); if (document.hidden && tipo === "diario") guardaLocal(); });
  setInterval(() => { if (M.diaChile() !== hoy) { animar = null; borrador.diario = ""; pinta(); } }, 30000);

  $("nota").textContent = Club && document.documentElement.classList.contains("club-integrado")
    ? "Tus puntos y tu racha se guardan en este navegador y en tu cuenta, así que te siguen a otros dispositivos."
    : "Tus puntos y tu racha viven en este navegador. Para competir en la Clasificación, juega desde Juegos con tu sesión iniciada.";
  if (Club) Club.category("club-integral-puntos");
  pinta();
})();
