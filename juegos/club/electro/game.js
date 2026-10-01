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

  /* Lo que se está jugando ahora en `m`: objetivo, intentos y si terminó. */
  function juego(m = modo) {
    if (tipo === "practica") {
      const p = prac[m] || nuevaPractica(m);
      return { obj: p.obj, i: p.i, fin: p.i.includes(p.obj) };
    }
    asegurarHoy();
    const obj = M.objetivoDelDia(m, hoy), pr = est.prog.m[m] || { i: [], ms: 0 };
    return { obj, i: pr.i, fin: M.hecho(est, hoy, m) || pr.i.includes(obj), ms: pr.ms };
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
  function intenta(id) {
    const g = juego();
    if (g.fin || !M.item(modo, id) || g.i.includes(id)) return;
    if (tipo === "practica") prac[modo].i.push(id);
    else {
      asegurarHoy();
      const pr = est.prog.m[modo] || (est.prog.m[modo] = { i: [], ms: 0 });
      pr.i.push(id);
    }
    animar = { modo, tipo, n: g.i.length + 1 };
    if (id === g.obj) { celebrar = true; if (tipo === "diario") termina(); }
    if (tipo === "diario") { guardaLocal(); sube(); }
    pinta();
    const e = $("entrada");
    if (e && !juego().fin) e.focus({ preventScroll: true });
    else { const v = document.querySelector(".victoria"); if (v) v.scrollIntoView({ block: "nearest", behavior: reducido() ? "auto" : "smooth" }); }
  }

  /* Un modo del diario acertado: pasa a la cuenta de puntos y, si era el
     cuarto del día, a la racha. Los dos van a la Clasificación. */
  function termina() {
    const pr = est.prog.m[modo], completoAntes = M.diaCompleto(est, hoy);
    est = M.registra(est, hoy, modo, pr.i.length, pr.ms);
    if (!Club) return;
    const t = M.total(est);
    Club.result({ categoria: "club-electro-puntos", puntos: t.puntos, tiempo: Math.min(TOPE_TIEMPO, Math.max(1, t.ms)) });
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

  /* ---------- dibujo: victoria ---------- */
  function siguienteSinHacer() { return M.MODOS.find(x => x.id !== modo && !juego(x.id).fin); }
  function victoriaHTML(m, g) {
    const o = M.item(m, g.obj), n = g.i.length || (est.hist[hoy] && est.hist[hoy][m] ? est.hist[hoy][m][1] : 1);
    const pts = tipo === "diario" && est.hist[hoy] && est.hist[hoy][m] ? est.hist[hoy][m][0] : 0;
    const sig = siguienteSinHacer();
    let botones = "";
    if (tipo === "practica") botones = `<button type="button" class="boton primario" data-accion="otra">Otro al azar ↻</button>`;
    else if (sig) botones = `<button type="button" class="boton primario" data-accion="ir" data-modo="${sig.id}">Siguiente: ${sig.icono} ${esc(sig.nombre)} →</button>`;
    else botones = `<button type="button" class="boton primario" data-accion="copiar">📋 Copiar resultado</button>`;
    if (tipo === "diario") botones += `<span class="cuenta" id="cuenta"></span>`;
    const extra = m === "cien" ? ` <small>(${o.nace}-${o.muere})</small>` : "";
    return `<div class="victoria">${celebrar && !reducido() ? `<div class="chispas" aria-hidden="true">${Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * 360 / 14}deg"></i>`).join("")}</div>` : ""}
      <h2><span>✓</span> ${tipo === "practica" ? "¡Bien!" : "¡Correcto!"} Era <b>${esc(o.n)}</b>${extra}</h2>
      <p>${esc(o.d)}</p>
      <p class="meta">${plural(n, "intento", "intentos")}${pts ? ` · +${pts} pts` : tipo === "practica" ? " · práctica, sin puntos" : ""}</p>
      <div class="botones">${botones}</div></div>`;
  }

  /* ---------- pintar ---------- */
  function pintaCabecera() {
    const r = M.racha(est, hoy), t = M.total(est), mejor = M.mejorRacha(est);
    $("racha").innerHTML = `🔥 ${r}${mejor > r ? ` <small>· mejor ${mejor}</small>` : ""}`;
    $("racha").classList.toggle("cero", !r);
    $("puntos").innerHTML = `⚡ ${t.puntos.toLocaleString("es-CL")} <small>pts</small>`;
    for (const b of document.querySelectorAll("[data-tipo]")) b.setAttribute("aria-selected", String(b.dataset.tipo === tipo));
    $("modos").innerHTML = M.MODOS.map(x => {
      const g = juego(x.id), hist = tipo === "diario" && est.hist[hoy] && est.hist[hoy][x.id];
      const estado = g.fin ? (hist ? `✓ ${hist[1]} · +${hist[0]}` : "✓ resuelto") : g.i.length ? plural(g.i.length, "intento", "intentos") : "sin jugar";
      return `<button type="button" role="tab" class="modo${g.fin ? " ok" : ""}" data-modo="${x.id}" aria-selected="${x.id === modo}"><span class="ico" aria-hidden="true">${x.icono}</span><b>${esc(x.nombre)}</b><i>${estado}</i></button>`;
    }).join("");
  }
  function pinta() {
    hoy = M.diaChile();
    pintaCabecera();
    const m = M.MODO[modo], g = juego(), fallos = g.i.filter(id => id !== g.obj).length;
    const recien = animar && animar.modo === modo && animar.tipo === tipo && animar.n === g.i.length;
    let visual = "";
    if (m.tipo === "formula") visual = `<div class="visual">${formulaHTML(g.obj, fallos, g.fin, recien)}</div>`;
    if (m.tipo === "simbolo") visual = `<div class="visual">${simboloHTML(g.obj, fallos, g.fin)}</div>`;
    const pistas = g.fin ? [] : M.pistas(modo, g.obj, fallos);
    $("panel").innerHTML = `
      <p class="consigna">${tipo === "practica" ? "<b>Práctica:</b> uno al azar, sin puntos. " : ""}${esc(m.consigna)}</p>
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
    enganchaPanel();
    pintaAyer();
    tic();
    celebrar = false;
  }
  function pintaAyer() {
    if (tipo !== "diario") { $("ayer").textContent = ""; return; }
    const f = M.diaAnterior(hoy);
    $("ayer").innerHTML = "Ayer eran: " + M.MODOS.map(x => `${x.icono} <b>${esc(M.item(x.id, M.objetivoDelDia(x.id, f)).n)}</b>`).join(" · ");
  }

  /* ---------- buscador ---------- */
  function enganchaPanel() {
    for (const b of document.querySelectorAll("[data-accion]")) b.onclick = () => {
      const a = b.dataset.accion;
      if (a === "otra") { nuevaPractica(modo); pinta(); const e = $("entrada"); if (e) e.focus(); }
      if (a === "ir") ponModo(b.dataset.modo);
      if (a === "copiar") {
        const txt = M.resumen(est, hoy), ok = () => { b.textContent = "¡Copiado! ✓"; setTimeout(() => { if (b.isConnected) b.textContent = "📋 Copiar resultado"; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => prompt("Copia tu resultado:", txt));
        else prompt("Copia tu resultado:", txt);
      }
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
