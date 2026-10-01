/* Electrodle: la pantalla. El motor (motor.js) decide el objetivo del día,
   compara los intentos y lleva la cuenta; aquí solo se dibuja, se escribe y
   se guarda.

   Dos tipos de partida. El Diario son cuatro desafíos (componente,
   científico, fórmula y símbolo) que salen solo de la fecha de Chile y son
   los mismos para todos; cada uno acertado suma puntos, y completar los
   cuatro alarga la racha. La Práctica es al azar y no suma nada. Lo del
   diario vive en localStorage (por cuenta, con Club.storageKey) y, dentro
   de Juegos, también en la cuenta (Club.guardarPartida → users/<uid>/club/
   electro), así que sigue a la persona a otro dispositivo. */
(() => {
  "use strict";
  const M = window.ElectroMotor, SIM = window.ElectroSimbolos.SIMBOLOS, Club = window.Club || null;
  const $ = id => document.getElementById(id);
  const clave = k => (Club ? Club.storageKey(k) : k);
  const lee = (k, def) => { try { const v = JSON.parse(localStorage.getItem(clave(k))); return v == null ? def : v; } catch (e) { return def; } };
  const guarda = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOPE_TIEMPO = 604800000;   // lo que acepta la regla de soloRanks

  let hoy = M.diaChile();
  let est = M.limpia(lee("electro.estado", null));
  let tipo = lee("electro.tipo", "diario") === "practica" ? "practica" : "diario";
  let modo = M.MODO[lee("electro.modo", "comp")] ? lee("electro.modo", "comp") : "comp";
  const prac = {};          // modo → {obj, i: [ids]} de la práctica, solo en memoria
  let animar = null;        // la fila (o el chip) recién agregada, para animarla una vez
  let celebrar = false;     // chispas en la próxima victoria pintada
  let vistaPrevia = null;   // el último viewBox del símbolo, para el zoom suave
  let sugs = [], activa = -1;

  /* ---------- estado ---------- */
  function asegurarHoy() { if (est.prog.fecha !== hoy) est.prog = { fecha: hoy, m: {} }; }
  const guardaLocal = () => guarda("electro.estado", est);
  const sube = () => { if (Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(est)); };
  const azar = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  function nuevaPractica(m) { prac[m] = { obj: M.objetivoAlAzar(m, azar, prac[m] && prac[m].obj), i: [] }; return prac[m]; }

  /* Lo que se está jugando ahora en `m`: objetivo, intentos, si terminó,
     si ganó y cuántos fallos lleva (M.estado). Si el diario ya está en la
     cuenta como terminado, manda eso. */
  function juego(m = modo) {
    let obj, i, ms = 0;
    if (tipo === "practica") { const p = prac[m] || nuevaPractica(m); obj = p.obj; i = p.i; }
    else {
      asegurarHoy();
      const pr = est.prog.m[m] || { i: [], ms: 0 };
      obj = M.objetivoDelDia(m, hoy); i = pr.i; ms = pr.ms;
    }
    const s = M.estado(m, obj, i), h = tipo === "diario" && est.hist[hoy] && est.hist[hoy][m];
    return Object.assign({ obj, i, ms }, s, h ? { fin: true, gano: !!h[3] } : {});
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

  /* ---------- intentar ----------
     `x` es un id (clásicos), un código de bandas, un número o cuatro
     fichas; M.valida dice si tiene la forma de su modo. */
  function intenta(x) {
    const g = juego();
    if (g.fin || !M.valida(modo, x) || g.i.includes(x)) return false;
    if (tipo === "practica") prac[modo].i.push(x);
    else {
      asegurarHoy();
      const pr = est.prog.m[modo] || (est.prog.m[modo] = { i: [], ms: 0 });
      pr.i.push(x);
    }
    animar = { modo, tipo, n: g.i.length + 1 };
    const s = M.estado(modo, g.obj, juego().i);
    if (s.fin) { celebrar = s.gano; if (tipo === "diario") termina(s.gano); }
    if (tipo === "diario") { guardaLocal(); sube(); }
    pinta();
    const e = $("entrada");
    if (e && !s.fin) e.focus({ preventScroll: true });
    else if (s.fin) { const v = document.querySelector(".victoria"); if (v) v.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); }
    return true;
  }

  /* Un modo del diario terminado: pasa a la cuenta de puntos y, si era el
     cuarto clásico del día, a la racha. Los dos van a la Clasificación; un
     desafío perdido no suma, así que no hay récord que mandar. */
  function termina(gano) {
    const pr = est.prog.m[modo], completoAntes = M.diaCompleto(est, hoy);
    est = M.registra(est, hoy, modo, pr.i.length, pr.ms, gano);
    if (!Club) return;
    const t = M.total(est);
    if (gano) Club.result({ categoria: "club-electro-puntos", puntos: t.puntos, tiempo: Math.min(TOPE_TIEMPO, Math.max(1, t.ms)) });
    if (!completoAntes && M.diaCompleto(est, hoy))
      Club.result({ categoria: "club-electro-racha", puntos: M.racha(est, hoy), tiempo: Math.min(TOPE_TIEMPO, Math.max(1, M.tiempoDia(est, hoy))) });
  }

  /* ---------- dibujo: fórmula ---------- */
  function ficha(t, abiertas, nuevas) {
    if (typeof t === "string") {
      if (t.startsWith("!")) { const [txt, sub] = t.slice(1).split("_"); return `<span class="lit">${esc(txt)}${sub ? `<sub>${esc(sub)}</sub>` : ""}</span>`; }
      if (M.esVariable(t)) {
        const k = M.clave(t), [base, exp] = t.split("^"), [sym, sub] = base.split("_");
        const tapada = abiertas !== true && !abiertas.has(k);
        const cuerpo = tapada ? `<span class="tapa">?</span>` : `<i>${esc(sym)}</i>${sub ? `<sub>${esc(sub)}</sub>` : ""}`;
        return `<span class="var${!tapada && nuevas.has(k) ? " nueva" : ""}">${cuerpo}${exp ? `<sup>${esc(exp)}</sup>` : ""}</span>`;
      }
      return `<span class="${/^[=+−>×·]$/.test(t) ? "op" : "num"}">${esc(t)}</span>`;
    }
    const l = x => x.map(y => ficha(y, abiertas, nuevas)).join("");
    if (t.fr) return `<span class="frac"><span>${l(t.fr[0])}</span><span>${l(t.fr[1])}</span></span>`;
    if (t.rz) return `<span class="raiz"><span class="rz-s">√</span><span class="rz-r">${l(t.rz)}</span></span>`;
    if (t.sup) return `<sup class="exp">${l(t.sup)}</sup>`;
    return "";
  }
  function formulaHTML(id, fallos, fin, recien) {
    const fm = M.item("form", id), abiertas = fin ? true : M.destapadas(id, fallos);
    const nuevas = recien && !fin ? new Set([...abiertas].filter(k => !M.destapadas(id, fallos - 1).has(k))) : new Set();
    const tapadas = fin ? 0 : M.variables(fm.f).length - abiertas.size;
    return `<div class="formula" role="img" aria-label="${fin ? esc(fm.n) : `Fórmula con ${plural(tapadas, "variable tapada", "variables tapadas")}`}">${fm.f.map(t => ficha(t, abiertas, nuevas)).join("")}</div>`;
  }

  /* ---------- dibujo: símbolo ---------- */
  function simboloHTML(id, fallos, fin) {
    const v = M.vista(id, fin ? 99 : fallos);
    return `<span class="zoom">×${String(v.zoom).replace(".", ",")}</span>` +
      `<svg class="simbolo" id="simbolo" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" role="img" aria-label="${fin ? "Símbolo de " + esc(M.item("simb", id).n) : "Un trozo de un símbolo esquemático, ampliado ×" + v.zoom}"><g class="trazo">${SIM[id].svg}</g></svg>`;
  }
  /* El zoom se aleja suave desde donde estaba. */
  function animaZoom(id, fallos, fin) {
    const svg = $("simbolo"), v = M.vista(id, fin ? 99 : fallos), clave = modo + tipo + id;
    const prev = vistaPrevia && vistaPrevia.clave === clave ? vistaPrevia.v : null;
    vistaPrevia = { clave, v };
    if (!svg || !prev || reducido() || (prev.x === v.x && prev.y === v.y && prev.w === v.w)) return;
    const t0 = performance.now(), dur = 650, ease = t => 1 - Math.pow(1 - t, 3);
    const paso = ahora => {
      const t = Math.min(1, (ahora - t0) / dur), k = ease(t), m = (a, b) => (a + (b - a) * k).toFixed(2);
      svg.setAttribute("viewBox", `${m(prev.x, v.x)} ${m(prev.y, v.y)} ${m(prev.w, v.w)} ${m(prev.h, v.h)}`);
      if (t < 1 && svg.isConnected) requestAnimationFrame(paso);
    };
    svg.setAttribute("viewBox", `${prev.x} ${prev.y} ${prev.w} ${prev.h}`);
    requestAnimationFrame(paso);
  }

  /* ---------- dibujo: intentos ----------
     Las celdas son angostas: cada elemento de una lista va en su línea y
     las palabras largas llevan dónde cortarse (el navegador cortaba
     «Electrome-cánico»). */
  const CORTES = { "Electromecánico": "Electro&shy;mecánico", "Semiconductor": "Semi&shy;conductor",
    "Electromagnetismo": "Electro&shy;magne&shy;tismo", "Electroquímica": "Electro&shy;química", "Electrostática": "Electros&shy;tática",
    "Telecomunicaciones": "Tele&shy;comunicaciones", "Termodinámica": "Termo&shy;dinámica", "Computación": "Compu&shy;tación" };
  const celdaTexto = t => t.split(", ").map(p => CORTES[p] || esc(p)).join("<br>");

  function tablaHTML(m, g) {
    const cols = M.MODO[m].columnas, filas = g.i.slice().reverse();
    const nueva = animar && animar.modo === m && animar.tipo === tipo && animar.n === g.i.length;
    return `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>${m === "comp" ? "Componente" : "Persona"}</th>${cols.map(c => `<th${c.largo ? ` title="${esc(c.largo)}"` : ""}>${esc(c.t)}</th>`).join("")}</tr></thead><tbody>${
      filas.map((id, k) => {
        const celdas = M.compara(m, id, g.obj);
        return `<tr class="${k === 0 && nueva ? "nueva" : ""}"><td><div class="celda nombre" style="--i:0"><span>${esc(M.item(m, id).n)}</span></div></td>${
          celdas.map((c, i) => `<td><div class="celda ${c.e}" style="--i:${i + 1}" title="${esc(c.t)}: ${esc(c.texto)}${c.e === "casi" ? " (algo en común)" : ""}${c.flecha ? (c.flecha === "↑" ? " (es mayor)" : " (es menor)") : ""}">${c.flecha ? `<b class="fl" aria-hidden="true">${c.flecha}</b>` : ""}<span>${celdaTexto(c.texto)}</span></div></td>`).join("")}</tr>`;
      }).join("")}</tbody></table></div>
      <div class="leyenda"><span><i style="background:var(--si)"></i>Igual</span><span><i style="background:var(--casi)"></i>Algo en común</span><span><i style="background:var(--no)"></i>Distinto</span><span>↑ ↓ el correcto es mayor o menor</span></div>`;
  }
  function fallosHTML(m, g) {
    if (!g.i.length) return "";
    const nueva = animar && animar.modo === m && animar.tipo === tipo && animar.n === g.i.length;
    return `<ul class="fallos" aria-label="Tus intentos">${g.i.slice().reverse().map((id, k) =>
      `<li class="${id === g.obj ? "bien" : ""}${k === 0 && nueva && id !== g.obj ? " nueva" : ""}">${id === g.obj ? "✓" : "✗"} ${esc(M.item(m, id).n)}</li>`).join("")}</ul>`;
  }

  /* ---------- dibujo: final ---------- */
  function siguienteSinHacer() { return M.MODOS.find(x => x.id !== modo && !juego(x.id).fin); }
  function botonesFin() {
    const sig = siguienteSinHacer();
    let b = "";
    if (tipo === "practica") b = `<button type="button" class="boton primario" data-accion="otra">Otro al azar ↻</button>`;
    else if (sig) b = `<button type="button" class="boton primario" data-accion="ir" data-modo="${sig.id}">Siguiente: ${sig.icono} ${esc(sig.nombre)} →</button>`;
    else b = `<button type="button" class="boton primario" data-accion="copiar">📋 Copiar resultado</button>`;
    return b + (tipo === "diario" ? `<span class="cuenta" id="cuenta"></span>` : "");
  }
  /* La tarjeta del final: verde si ganó, roja si se acabaron los intentos. */
  function finHTML(m, g, titulo, cuerpo) {
    const h = est.hist[hoy] && est.hist[hoy][m], n = g.i.length || (h ? h[1] : 1);
    const pts = tipo === "diario" && h ? h[0] : 0;
    const meta = m === "conx" ? plural(g.fallos, "error", "errores") : plural(n, "intento", "intentos");
    return `<div class="victoria${g.gano ? "" : " perdio"}">${celebrar && !reducido() ? `<div class="chispas" aria-hidden="true">${Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * 360 / 14}deg"></i>`).join("")}</div>` : ""}
      <h2><span>${g.gano ? "✓" : "✗"}</span> ${titulo}</h2>
      ${cuerpo}
      <p class="meta">${meta}${pts ? ` · +${pts} pts` : tipo === "practica" ? " · práctica, sin puntos" : g.gano ? "" : " · 0 pts"}</p>
      <div class="botones">${botonesFin()}</div></div>`;
  }
  function victoriaHTML(m, g) {
    const o = M.item(m, g.obj), extra = m === "cien" ? ` <small>(${o.nace}-${o.muere})</small>` : "";
    return finHTML(m, g, `${tipo === "practica" ? "¡Bien!" : "¡Correcto!"} Era <b>${esc(o.n)}</b>${extra}`, `<p>${esc(o.d)}</p>`);
  }

  /* ---------- dibujo: desafíos ---------- */
  const X = M.X;
  let banda = { obj: "", sel: [1, 0, 2, 10], activa: 0 };
  let conx = { obj: "", orden: [], sel: new Set() };
  let aviso = "";
  const MULT = ["×1", "×10", "×100", "×1 k", "×10 k", "×100 k", "×1 M"];
  const sentido = (i, k) => i < 2 ? String(k) : i === 2 ? MULT[k] : `±${X.TOLERANCIA[k]} %`;
  /* Una resistencia con sus cuatro bandas y, si es un intento, la marca de
     cada banda debajo. */
  function resistorSVG(code, fb, activa, clase) {
    const c = X.deCodigo(code), xs = [80, 104, 128, 168], alto = fb ? 80 : 72;
    return `<svg class="${clase}" viewBox="0 0 248 ${alto}" role="img" aria-label="Resistencia ${c.map(k => X.COLORES[k].n).join(", ")}${fb ? ": " + fb.map(e => e === "si" ? "verde" : e === "casi" ? "amarillo" : "gris").join(", ") : ""}">
      <line x1="0" y1="36" x2="248" y2="36" class="pata"/><rect x="50" y="12" width="148" height="48" rx="22" class="cuerpo"/>
      ${c.map((k, i) => `<rect x="${xs[i] - 7}" y="12" width="14" height="48" fill="${X.COLORES[k].c}" class="bnd${activa === i ? " activa" : ""}" data-banda="${i}"/>`).join("")}
      ${fb ? fb.map((e, i) => `<circle cx="${xs[i]}" cy="72" r="6" class="fb-${e}"/>`).join("") : ""}</svg>`;
  }
  function bandasHTML(g) {
    const t = M.reto("band", g.obj);
    if (banda.obj !== g.obj) banda = { obj: g.obj, sel: g.i.length ? X.deCodigo(g.i[g.i.length - 1]) : [1, 0, 2, 10], activa: 0 };
    const code = X.aCodigo(banda.sel), nueva = animar && animar.modo === "band" && animar.tipo === tipo && animar.n === g.i.length;
    const editor = g.fin ? "" : `<div class="visual banda-editor">${resistorSVG(code, null, banda.activa, "res grande")}</div>
      <div class="banda-tabs" role="tablist" aria-label="Banda">${X.NOMBRE_BANDA.map((nb, i) => `<button type="button" role="tab" data-banda="${i}" aria-selected="${banda.activa === i}"><i style="background:${X.COLORES[banda.sel[i]].c}"></i>${nb}</button>`).join("")}</div>
      <div class="paleta" aria-label="Colores para ${X.NOMBRE_BANDA[banda.activa]}">${X.PERMITIDOS[banda.activa].map(k => `<button type="button" data-color="${k}" aria-pressed="${banda.sel[banda.activa] === k}"><i style="background:${X.COLORES[k].c}"></i>${X.COLORES[k].n}<small>${sentido(banda.activa, k)}</small></button>`).join("")}</div>
      <div class="banda-acc"><span>Tu resistencia: <b>${X.textoBandas(code)}</b></span><button type="button" class="boton primario" data-accion="probar-banda">Probar</button></div>
      <p class="aviso" role="status">${esc(aviso)}</p>`;
    const filas = g.i.slice().reverse().map((x, k) => {
      const v = X.comparaBandas(x, t);
      return `<li class="${k === 0 && nueva ? "nueva" : ""}">${resistorSVG(x, v.e, -1, "res mini")}<span>${X.textoBandas(x)}</span><b class="fl-res">${v.flecha === "=" ? "= valor" : v.flecha + (v.flecha === "↑" ? " mayor" : " menor")}</b></li>`;
    }).join("");
    return editor + (filas ? `<ul class="filas-banda">${filas}</ul><div class="leyenda"><span><i style="background:var(--si)"></i>En su banda</span><span><i style="background:var(--casi)"></i>En otra banda</span><span><i style="background:var(--muted)"></i>No está</span><span>↑ ↓ el valor real es mayor o menor</span></div>` : "");
  }
  function finBandas(g) {
    const t = M.reto("band", g.obj);
    return finHTML("band", g, g.gano ? `${tipo === "practica" ? "¡Bien!" : "¡Correcto!"} Era <b>${X.textoBandas(t)}</b>` : `Se acabaron los intentos. Era <b>${X.textoBandas(t)}</b>`,
      `<div class="fin-res">${resistorSVG(t, null, -1, "res")}<p>${X.deCodigo(t).map(k => X.COLORES[k].n).join(" · ")}</p></div>`);
  }

  /* El circuito, dibujado: fuente a la izquierda, rieles arriba y abajo. */
  function circuitoSVG(c) {
    const R = c.R.map((v, i) => [`R${i + 1}`, X.ohmios(v)]);
    const L = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`, P = (x, y) => `<circle cx="${x}" cy="${y}" r="3" class="nodo"/>`;
    const T = (x, y, t, a = "middle", cl = "") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${cl}">${t}</text>`;
    const rh = (a, b, y, [n, v]) => { const m = (a + b) / 2, s = m - 24;
      return L(a, y, s, y) + `<path d="M${s} ${y}l4 -8l8 16l8 -16l8 16l8 -16l8 16l4 -8"/>` + L(s + 48, y, b, y) + T(m, y - 16, n, "middle", "rn") + T(m, y + 26, v, "middle", "rv"); };
    const rv = (x, y1, y2, [n, v]) => { const m = (y1 + y2) / 2, s = m - 24;
      return L(x, y1, x, s) + `<path d="M${x} ${s}l-8 4l16 8l-16 8l16 8l-16 8l16 8l-8 4"/>` + L(x, s + 48, x, y2) + T(x - 14, m - 2, n, "end", "rn") + T(x - 14, m + 13, v, "end", "rv"); };
    const marcaV = (x, et) => T(x + 14, 72, "+", "start", "pol") + T(x + 14, 106, et, "start", "pide") + T(x + 14, 142, "−", "start", "pol");
    let d = `<circle cx="50" cy="100" r="17"/>` + T(50, 95, "+", "middle", "pol") + T(50, 113, "−", "middle", "pol") + T(26, 104, `${c.V} V`, "end", "rv") +
      L(50, 40, 50, 83) + L(50, 117, 50, 160) + L(50, 160, 330, 160);
    if (c.topo === "serie") d += L(50, 40, 90, 40) + rh(90, 170, 40, R[0]) + L(170, 40, 190, 40) + rh(190, 270, 40, R[1]) + L(270, 40, 330, 40) + rv(330, 40, 160, R[2]);
    else if (c.topo === "paralelo") d += L(50, 40, 330, 40) + rv(170, 40, 160, R[0]) + rv(250, 40, 160, R[1]) + rv(330, 40, 160, R[2]) + P(170, 40) + P(170, 160) + P(250, 40) + P(250, 160);
    else if (c.topo === "escalera") d += L(50, 40, 75, 40) + rh(75, 155, 40, R[0]) + L(155, 40, 205, 40) + rv(185, 40, 160, R[1]) + rh(205, 285, 40, R[2]) + L(285, 40, 330, 40) + rv(330, 40, 160, R[3]) + P(185, 40) + P(185, 160);
    else d += L(50, 40, 90, 40) + rh(90, 170, 40, R[0]) + L(170, 40, 330, 40) + rv(250, 40, 160, R[1]) + rv(330, 40, 160, R[2]) + P(250, 40) + P(250, 160);
    if (c.pide === "I") d += `<path d="M64 76L64 50" class="flecha-i"/><path d="M64 46l-5 9h10z" class="punta"/>` + T(70, 82, "I = ?", "start", "pide");
    else if (c.pide === "Req") d += T(26, 140, "Req = ?", "end", "pide");
    else if (c.topo === "serie") d += T(196, 90, "+", "middle", "pol") + T(230, 94, "V₂ = ?", "middle", "pide") + T(264, 90, "−", "middle", "pol");
    /* En serie-paralelo, R2 y R3 comparten nodos: V₂ se marca en R3, donde hay espacio. */
    else d += marcaV(330, c.et + " = ?");
    return `<svg class="circuito" viewBox="-40 0 456 196" role="img" aria-label="Circuito con una fuente de ${c.V} V y ${c.R.length} resistencias">${d}</svg>`;
  }
  function circuitoHTML(g) {
    const c = M.reto("circ", g.obj), nueva = animar && animar.modo === "circ" && animar.tipo === tipo && animar.n === g.i.length;
    const pregunta = `¿Cuánto vale <b>${esc(c.et)}</b>, ${esc(c.dice)}? Responde en <b>${esc(c.unidad)}</b>.`;
    const form = g.fin ? "" : `<form class="adivina" id="adivina-num" autocomplete="off"><input id="entrada" type="text" inputmode="decimal" placeholder="Tu respuesta en ${esc(c.unidad)}" aria-label="Tu respuesta en ${esc(c.unidad)}"><span class="unidad">${esc(c.unidad)}</span><button type="submit" class="boton primario">Probar</button></form>`;
    const filas = g.i.slice().reverse().map((x, k) => {
      const v = X.evaluaCircuito(x, c.resp);
      return `<li class="${v.e}${k === 0 && nueva ? " nueva" : ""}"><b>${esc(X.num(X.leeNumero(x)))} ${esc(c.unidad)}</b><span>${v.e === "si" ? "¡exacto!" : `${v.err > 0 ? "+" : "−"}${X.num(Math.abs(v.err) * 100)} % ${v.flecha}`}</span></li>`;
    }).join("");
    return `<div class="visual">${circuitoSVG(c)}</div><p class="pregunta">${pregunta}</p>${form}<p class="aviso" role="status">${esc(aviso)}</p>${filas ? `<ul class="filas-circ">${filas}</ul>` : ""}`;
  }
  function finCircuito(g) {
    const c = M.reto("circ", g.obj);
    return finHTML("circ", g, `${g.gano ? (tipo === "practica" ? "¡Bien!" : "¡Correcto!") : "Se acabaron los intentos."} ${esc(c.et)} = <b>${X.num(c.resp)} ${esc(c.unidad)}</b>`,
      `<ol class="pasos">${c.pasos.map(p => `<li>${esc(p)}</li>`).join("")}</ol>`);
  }

  const grupoHTML = (gr, revelado) => `<div class="conx-grupo n${gr.nivel}${revelado ? " revelado" : ""}"><b>${esc(gr.t)}</b><span>${gr.f.map(esc).join(" · ")}</span></div>`;
  function conexionesHTML(g) {
    const c = M.reto("conx", g.obj), hall = g.hallados || M.estado("conx", g.obj, g.i).hallados;
    if (conx.obj !== g.obj) conx = { obj: g.obj, orden: [...Array(16).keys()], sel: new Set() };
    const usadas = new Set(hall.flatMap(k => c.grupos[k].f));
    const filas = hall.map(k => grupoHTML(c.grupos[k], false));
    if (g.fin && !g.gano) c.grupos.forEach((gr, k) => { if (!hall.includes(k)) filas.push(grupoHTML(gr, true)); });
    const resto = conx.orden.filter(i => !usadas.has(c.fichas[i]));
    for (const i of [...conx.sel]) if (usadas.has(c.fichas[i])) conx.sel.delete(i);
    const quedan = X.MAX_ERRORES - g.fallos;
    const tablero = g.fin ? "" : `<div class="conx-grid">${resto.map(i => `<button type="button" class="ficha${conx.sel.has(i) ? " sel" : ""}" data-ficha="${i}" aria-pressed="${conx.sel.has(i)}">${esc(c.fichas[i])}</button>`).join("")}</div>
      <div class="conx-pie"><span class="errores" aria-label="Te quedan ${plural(quedan, "error", "errores")}">Errores: ${"●".repeat(quedan)}${"○".repeat(X.MAX_ERRORES - quedan)}</span>
      <button type="button" class="boton" data-accion="mezclar">Mezclar</button><button type="button" class="boton" data-accion="limpiar"${conx.sel.size ? "" : " disabled"}>Deseleccionar</button>
      <button type="button" class="boton primario" data-accion="enviar"${conx.sel.size === 4 ? "" : " disabled"}>Enviar</button></div>`;
    return `<div class="conx">${filas.join("")}${tablero}</div><p class="aviso" role="status">${esc(aviso)}</p>`;
  }
  function finConexiones(g) {
    return finHTML("conx", g, g.gano ? `${tipo === "practica" ? "¡Bien!" : "¡Los cuatro grupos!"}` : "Se acabaron los errores", g.gano ? "" : `<p>Arriba quedaron los grupos que faltaban.</p>`);
  }
  function contadorReto(m, g) {
    if (g.fin) return "";
    const n = g.i.length;
    if (m === "conx") return tipo === "diario" ? `<p class="contador">Ganar ahora vale ${M.puntos("conx", 4 + g.fallos, true)} pts.</p>` : "";
    const max = m === "band" ? X.INTENTOS_BANDAS : X.INTENTOS_CIRCUITO;
    return `<p class="contador">Intento ${n + 1} de ${max}${tipo === "diario" ? ` · acertar ahora vale ${M.puntos(m, n + 1, true)} pts` : ""}</p>`;
  }

  /* ---------- pintar ---------- */
  function pintaCabecera() {
    const r = M.racha(est, hoy), t = M.total(est), mejor = M.mejorRacha(est);
    $("racha").innerHTML = `🔥 ${r}${mejor > r ? ` <small>· mejor ${mejor}</small>` : ""}`;
    $("racha").classList.toggle("cero", !r);
    $("puntos").innerHTML = `⚡ ${t.puntos.toLocaleString("es-CL")} <small>pts</small>`;
    for (const b of document.querySelectorAll("[data-tipo]")) b.setAttribute("aria-selected", String(b.dataset.tipo === tipo));
    const boton = x => {
      const g = juego(x.id), h = tipo === "diario" && est.hist[hoy] && est.hist[hoy][x.id];
      const estado = g.fin ? (!g.gano ? "✗ sin acertar" : h ? `✓ ${h[1]} · +${h[0]}` : "✓ resuelto") : g.i.length ? plural(g.i.length, "intento", "intentos") : "sin jugar";
      return `<button type="button" role="tab" class="modo${g.fin ? (g.gano ? " ok" : " mal") : ""}" data-modo="${x.id}" aria-selected="${x.id === modo}"><span class="ico" aria-hidden="true">${x.icono}</span><b>${esc(x.nombre)}</b><i>${estado}</i></button>`;
    };
    $("modos").innerHTML = `<p class="modos-t">Adivina · cuentan para la 🔥 racha</p>${M.MODOS.filter(x => !x.reto).map(boton).join("")}` +
      `<p class="modos-t">Desafíos · puntos extra</p>${M.MODOS.filter(x => x.reto).map(boton).join("")}`;
  }
  function pinta() {
    hoy = M.diaChile();
    pintaCabecera();
    const m = M.MODO[modo], g = juego();
    const practica = tipo === "practica" ? `<b>Práctica:</b> ${m.reto ? "un reto al azar" : "uno al azar"}, sin puntos. ` : "";
    if (m.reto) {
      const cuerpo = modo === "band" ? bandasHTML(g) : modo === "circ" ? circuitoHTML(g) : conexionesHTML(g);
      const fin = g.fin ? (modo === "band" ? finBandas(g) : modo === "circ" ? finCircuito(g) : finConexiones(g)) : "";
      $("panel").innerHTML = `<p class="consigna">${practica}${esc(m.consigna)}</p>${modo === "conx" ? cuerpo + fin : fin + cuerpo}${contadorReto(modo, g)}`;
    } else pintaClasico(m, g, practica);
    enganchaPanel();
    pintaAyer();
    tic();
    celebrar = false;
    aviso = "";
  }
  function pintaClasico(m, g, practica) {
    const fallos = g.fallos, recien = animar && animar.modo === modo && animar.tipo === tipo && animar.n === g.i.length;
    let visual = "";
    if (m.tipo === "formula") visual = `<div class="visual">${formulaHTML(g.obj, fallos, g.fin, recien)}</div>`;
    if (m.tipo === "simbolo") visual = `<div class="visual">${simboloHTML(g.obj, fallos, g.fin)}</div>`;
    const pistas = g.fin ? [] : M.pistas(modo, g.obj, fallos);
    $("panel").innerHTML = `
      <p class="consigna">${practica}${esc(m.consigna)}</p>
      ${visual}
      ${pistas.length ? `<div class="pistas">${pistas.map(p => p.abierta ? `<span class="pista abierta">💡 ${esc(p.t)}</span>`
        : `<span class="pista">🔒 Pista en ${plural(p.n - fallos, "intento", "intentos")}</span>`).join("")}</div>` : ""}
      ${g.fin ? victoriaHTML(modo, g) : `<form class="adivina" id="adivina" autocomplete="off">
        <input id="entrada" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sugs"
          placeholder="${m.id === "cien" ? "Escribe un nombre…" : m.id === "form" ? "Escribe el nombre de la fórmula…" : "Escribe un componente…"}" aria-label="Tu intento">
        <button type="submit" class="boton primario">Probar</button>
        <ul id="sugs" class="sugs" role="listbox" hidden></ul></form>`}
      ${g.i.length ? `<p class="contador">${plural(g.i.length, "intento", "intentos")}${tipo === "diario" && !g.fin ? ` · ahora vale ${M.puntosDe(g.i.length + 1)} pts` : ""}</p>` : tipo === "diario" ? `<p class="contador">A la primera vale 100 pts; cada intento más resta 10.</p>` : ""}
      ${m.tipo === "tabla" ? (g.i.length ? tablaHTML(modo, g) : "") : fallosHTML(modo, g)}`;
    if (m.tipo === "simbolo") animaZoom(g.obj, fallos, g.fin);
  }
  /* Lo de ayer: los cuatro clásicos, la resistencia y la respuesta del circuito. */
  function pintaAyer() {
    if (tipo !== "diario") { $("ayer").textContent = ""; return; }
    const f = M.diaAnterior(hoy), c = M.reto("circ", M.objetivoDelDia("circ", f));
    $("ayer").innerHTML = "Ayer eran: " + M.MODOS.filter(x => !x.reto).map(x => `${x.icono} <b>${esc(M.item(x.id, M.objetivoDelDia(x.id, f)).n)}</b>`).join(" · ") +
      ` · 🎨 <b>${esc(X.textoBandas(M.reto("band", M.objetivoDelDia("band", f))))}</b> · 🔋 <b>${esc(c.et)} = ${esc(X.num(c.resp))} ${esc(c.unidad)}</b>`;
  }

  /* ---------- buscador ---------- */
  function enganchaPanel() {
    for (const b of document.querySelectorAll("[data-accion]")) b.onclick = () => {
      const a = b.dataset.accion;
      if (a === "otra") { nuevaPractica(modo); pinta(); const e = $("entrada"); if (e) e.focus(); }
      if (a === "probar-banda") { const c = X.aCodigo(banda.sel); if (juego().i.includes(c)) { aviso = "Ya probaste esa resistencia."; pinta(); } else intenta(c); }
      if (a === "mezclar") { conx.orden = conx.orden.map(i => [Math.random(), i]).sort((x, y) => x[0] - y[0]).map(x => x[1]); pinta(); }
      if (a === "limpiar") { conx.sel.clear(); pinta(); }
      if (a === "enviar" && conx.sel.size === 4) {
        const k = X.claveIntento([...conx.sel]), g = juego(), v = X.evaluaConexiones(M.reto("conx", g.obj), k);
        if (g.i.includes(k)) { aviso = "Ya probaste esa combinación."; pinta(); return; }
        aviso = v.grupo >= 0 ? "¡Grupo encontrado!" : v.mejor === 3 ? "¡A una de un grupo!" : "No es un grupo.";
        if (v.grupo >= 0) conx.sel.clear();
        intenta(k);
      }
      if (a === "ir") ponModo(b.dataset.modo);
      if (a === "copiar") {
        const txt = M.resumen(est, hoy), ok = () => { b.textContent = "¡Copiado! ✓"; setTimeout(() => { if (b.isConnected) b.textContent = "📋 Copiar resultado"; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => prompt("Copia tu resultado:", txt));
        else prompt("Copia tu resultado:", txt);
      }
    };
    /* Bandas: elegir la banda y su color (y saltar a la siguiente). */
    for (const b of document.querySelectorAll("#panel [data-banda]")) b.onclick = () => { banda.activa = +b.dataset.banda; pinta(); };
    for (const b of document.querySelectorAll("#panel [data-color]")) b.onclick = () => {
      banda.sel[banda.activa] = +b.dataset.color; banda.activa = Math.min(3, banda.activa + 1); pinta();
    };
    /* Conexiones: hasta cuatro fichas marcadas. */
    for (const b of document.querySelectorAll("#panel [data-ficha]")) b.onclick = () => {
      const i = +b.dataset.ficha;
      if (conx.sel.has(i)) conx.sel.delete(i); else if (conx.sel.size < 4) conx.sel.add(i);
      pinta();
    };
    /* Circuito: un número. Se guarda tal cual lo lee leeNumero, así que
       «3,9» y «3.90» son el mismo intento. */
    const fnum = $("adivina-num");
    if (fnum) fnum.onsubmit = ev => {
      ev.preventDefault();
      const x = X.leeNumero($("entrada").value);
      if (!Number.isFinite(x) || x <= 0) { aviso = "Escribe solo un número, como 3,9."; pinta(); return; }
      if (!intenta(String(x))) { aviso = "Ya probaste ese valor."; pinta(); }
    };
    const form = $("adivina");
    if (!form) return;
    const e = $("entrada");
    e.oninput = () => { sugs = M.sugerencias(modo, e.value, juego().i); activa = sugs.length ? 0 : -1; pintaSugs(); };
    e.onkeydown = ev => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        if (!sugs.length) return;
        ev.preventDefault();
        activa = (activa + (ev.key === "ArrowDown" ? 1 : -1) + sugs.length) % sugs.length;
        pintaSugs();
      } else if (ev.key === "Escape") { sugs = []; activa = -1; pintaSugs(); }
    };
    e.onblur = () => setTimeout(() => { if (document.activeElement !== e) { sugs = []; pintaSugs(); } }, 150);
    form.onsubmit = ev => {
      ev.preventDefault();
      let x = sugs[activa] || sugs[0];
      if (!x) { const q = M.normaliza(e.value); x = M.MODO[modo].lista.find(y => M.normaliza(y.n) === q && !juego().i.includes(y.id)); }
      if (x) { sugs = []; activa = -1; intenta(x.id); }
    };
  }
  function detalle(m, x) {
    return m === "comp" || m === "simb" ? x.f : m === "cien" ? `${x.nace}-${x.muere}` : x.a;
  }
  function pintaSugs() {
    const ul = $("sugs"), e = $("entrada");
    if (!ul || !e) return;
    const hay = e.value.trim() !== "";
    ul.hidden = !hay;
    e.setAttribute("aria-expanded", String(hay));
    if (!hay) { ul.innerHTML = ""; e.removeAttribute("aria-activedescendant"); return; }
    ul.innerHTML = sugs.length ? sugs.map((x, i) => `<li role="option" id="sug${i}" data-id="${esc(x.id)}" aria-selected="${i === activa}"><span>${esc(x.n)}${x.por ? ` <small>· ${esc(x.por)}</small>` : ""}</span><small>${esc(detalle(modo, x))}</small></li>`).join("")
      : `<li class="vacia" role="option" aria-disabled="true">Nada con ese nombre (o ya lo probaste)</li>`;
    if (activa >= 0) e.setAttribute("aria-activedescendant", "sug" + activa); else e.removeAttribute("aria-activedescendant");
    for (const li of ul.querySelectorAll("[data-id]")) {
      li.onpointerdown = ev => ev.preventDefault();   // que el input no pierda el foco antes del clic
      li.onclick = () => { sugs = []; activa = -1; intenta(li.dataset.id); };
    }
    const sel = ul.querySelector("[aria-selected=true]");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  /* ---------- tipos y modos ---------- */
  function ponModo(m) { modo = m; guarda("electro.modo", m); animar = null; sugs = []; pinta(); }
  function ponTipo(t) { tipo = t; guarda("electro.tipo", t); animar = null; sugs = []; pinta(); }
  $("modos").addEventListener("click", ev => { const b = ev.target.closest("[data-modo]"); if (b) ponModo(b.dataset.modo); });
  for (const b of document.querySelectorAll("[data-tipo]")) b.onclick = () => ponTipo(b.dataset.tipo);

  /* ---------- el reloj ----------
     El tiempo de cada modo del diario corre solo con la pestaña a la vista
     y ese modo abierto; es el desempate de la Clasificación. Cada medio
     minuto se mira si en Chile ya es otro día. */
  let marca = performance.now();
  function tic() {
    const c = $("cuenta");
    if (c) {
      const s = Math.floor(M.faltaParaManana() / 1000);
      c.textContent = `Nuevo Electrodle en ${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }
  }
  setInterval(() => {
    const ahora = performance.now();
    if (tipo === "diario" && !document.hidden && est.prog.fecha === hoy) {
      const g = juego();
      if (!g.fin && g.i.length < 999) {
        const pr = est.prog.m[modo] || (est.prog.m[modo] = { i: [], ms: 0 });
        pr.ms = Math.min(86400000, pr.ms + Math.min(5000, ahora - marca));
      }
    }
    marca = ahora;
    tic();
  }, 1000);
  setInterval(() => { if (tipo === "diario") guardaLocal(); }, 5000);
  document.addEventListener("visibilitychange", () => { marca = performance.now(); if (document.hidden && tipo === "diario") guardaLocal(); });
  setInterval(() => { if (M.diaChile() !== hoy) { animar = null; pinta(); } }, 30000);

  $("nota").textContent = Club && document.documentElement.classList.contains("club-integrado")
    ? "Tus puntos y tu racha se guardan en este navegador y en tu cuenta, así que te siguen a otros dispositivos."
    : "Tus puntos y tu racha viven en este navegador. Para competir en la Clasificación, juega desde Juegos con tu sesión iniciada.";
  if (Club) Club.category("club-electro-puntos");
  pinta();
})();
