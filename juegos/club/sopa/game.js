/* Sopa de letras — la pantalla. El motor (motor.js) decide la sopa y la
   racha; aquí solo se dibuja, se arrastra y se guarda.

   Dos modos. La diaria sale solo de la fecha de Chile y es la misma para
   todos; la libre es al azar con los selectores a la vista. La racha vive
   en localStorage (por cuenta, con Club.storageKey) y, dentro de Juegos,
   también en la cuenta (Club.guardarPartida → users/<uid>/club/sopa), de
   modo que sigue a la persona a otro dispositivo. */
(() => {
  "use strict";
  const M = window.SopaMotor, Club = window.Club || null;
  const $ = id => document.getElementById(id);
  const clave = k => (Club ? Club.storageKey(k) : k);
  const lee = (k, def) => { try { const v = JSON.parse(localStorage.getItem(clave(k))); return v == null ? def : v; } catch (e) { return def; } };
  const guarda = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ } };
  const reloj = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const dias = n => `${n} ${n === 1 ? "día" : "días"}`;

  let hoy = M.diaChile();
  let racha = M.limpiaRacha(lee("sopa.racha", null));
  let modo = lee("sopa.modo", "diaria") === "libre" ? "libre" : "diaria";
  let sopa = null, encontradas = new Set(), terminada = false;
  let ms = 0, corriendo = false, marca = 0, sel = null;
  /* La prueba de la partida (motor.js, `rehace`): de qué sopa se trata
     (`origen`) y cada palabra encontrada como [inicio, fin, Δt]. Una diaria
     retomada de una versión anterior, que no guardaba las jugadas, no se
     puede probar (`sinPrueba`): se juega y suma racha, pero no se manda. */
  let origen = null, jugadas = [], tUlt = 0, sinPrueba = false;
  /* La forma de cada gesto va también a la prueba: una mano arrastra con
     muchos pointermove y tarda; un script despacha eventos sintéticos
     (isTrusted = false) o salta del inicio al fin. Los eventos del mando
     (juegos/audio/mando.js) también son sintéticos, pero llevan `__mando`
     y solo valen con un mando conectado. */
  const mandoConectado = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (e) { return false; } };
  const bandera = e => (e.isTrusted ? 0 : e.__mando && mandoConectado() ? 2 : 1) | (document.hidden ? 4 : 0);
  /* Lleva el reloj hasta este instante: el intervalo solo lo hace cada
     250 ms, y la prueba quiere el momento justo de cada palabra. */
  function actualiza() {
    const ahora = performance.now();
    if (corriendo && !document.hidden) ms += ahora - marca;
    marca = ahora;
  }

  /* ---------- selectores ---------- */
  $("selTema").innerHTML = M.TEMAS.map(t => `<option value="${t.id}">${t.icono} ${t.nombre}</option>`).join("");
  const libre = lee("sopa.libre", {});
  if (M.TEMAS.some(t => t.id === libre.tema)) $("selTema").value = libre.tema;
  if (M.DIRECCIONES[libre.dif]) $("selDif").value = libre.dif;
  if (M.TAMANOS[libre.tam]) $("selTam").value = String(libre.tam);

  /* ---------- racha ---------- */
  function pintaRacha() {
    const n = M.rachaVisible(racha, hoy), b = $("racha");
    b.innerHTML = `🔥 ${dias(n)}${racha.mejor ? ` <small>· mejor ${racha.mejor}</small>` : ""}`;
    b.classList.toggle("cero", !n);
  }
  function subeRacha() { if (Club && Club.guardarPartida) Club.guardarPartida(JSON.stringify(racha)); }
  /* Lo de la cuenta se mezcla con lo de aquí: manda quien completó más tarde. */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    const junta = M.mezclaRacha(racha, nube), cambio = JSON.stringify(junta) !== JSON.stringify(racha);
    racha = junta; guarda("sopa.racha", racha); pintaRacha();
    // Si aquí había algo que la cuenta no tenía, se sube.
    if (JSON.stringify(junta) !== JSON.stringify(M.limpiaRacha(nube))) subeRacha();
    // Completada hoy en otro dispositivo: se muestra resuelta.
    if (cambio && modo === "diaria" && sopa && sopa.fecha === racha.ult && !terminada) cargaDiaria();
  });

  /* ---------- modos ---------- */
  function ponModo(m) {
    modo = m; guarda("sopa.modo", m);
    for (const b of document.querySelectorAll("[data-modo]")) b.setAttribute("aria-selected", String(b.dataset.modo === m));
    $("selectores").hidden = m !== "libre";
    if (m === "diaria") cargaDiaria(); else nuevaLibre();
  }
  function cargaDiaria() {
    hoy = M.diaChile();
    const s = M.sopaDiaria(hoy), t = M.TEMAS.find(x => x.id === s.tema);
    const prog = lee("sopa.diaria", null), hecha = racha.ult === hoy;
    const deHoy = !hecha && prog && prog.fecha === hoy;
    const enc = hecha ? s.palabras.map((_, i) => i)
      : deHoy && Array.isArray(prog.enc) ? prog.enc.filter(i => Number.isInteger(i) && i >= 0 && i < s.palabras.length) : [];
    /* Las jugadas guardadas tienen que dar justo las palabras guardadas;
       si no (progreso de antes de la prueba, o tocado a mano), esta diaria
       ya no se puede probar. */
    const j = deHoy && Array.isArray(prog.j) ? prog.j : [];
    const r = enc.length ? M.rehace({ v: M.PRUEBA_V, m: "d", f: hoy, j }) : null;
    const cuadra = !enc.length || (!r.error && r.encontradas === enc.length && enc.every(i => r.orden.includes(i)));
    empieza(s, enc, deHoy && Number.isFinite(prog.ms) ? prog.ms : 0, hecha, { v: M.PRUEBA_V, m: "d", f: hoy },
      cuadra ? j : [], cuadra && r ? r.tiempos[r.tiempos.length - 1] || 0 : 0, !cuadra);
    $("info").innerHTML = `Hoy: <b>${t.icono} ${t.nombre}</b> · ${s.tam}×${s.tam} · ${M.DIFICULTADES[s.dif]}${hecha ? " · <b>Ya la completaste hoy ✓</b>" : ""}`;
    if (hecha) aviso(`<strong>Ya la completaste hoy</strong>Vuelve mañana para mantener la racha: 🔥 ${dias(M.rachaVisible(racha, hoy))}.`);
    if (Club) Club.category("club-sopa-racha");
  }
  function nuevaLibre() {
    const tema = $("selTema").value, dif = $("selDif").value, tam = +$("selTam").value;
    guarda("sopa.libre", { tema, dif, tam });
    const semilla = crypto.getRandomValues(new Uint32Array(1))[0];
    empieza(M.generar({ tema, tam, dif, rng: M.mulberry32(semilla) }), [], 0, false, { v: M.PRUEBA_V, m: "l", s: semilla, t: tema, d: dif, n: tam }, [], 0, false);
    $("info").textContent = "Una sopa al azar, distinta cada vez. Cambia la temática, la dificultad o el tamaño cuando quieras.";
    if (Club) Club.category(`club-sopa-${dif}-${tam}`);
  }

  /* ---------- tablero ---------- */
  const color = i => `hsl(${Math.round(i * 360 / sopa.palabras.length + 210) % 360} 75% 55%)`;
  function empieza(s, enc, t, hecha, o, j, tu, sinP) {
    sopa = s; encontradas = new Set(enc); ms = t; terminada = hecha; sel = null;
    origen = o; jugadas = j.slice(); tUlt = tu; sinPrueba = sinP;
    corriendo = !hecha; marca = performance.now();
    $("grilla").style.setProperty("--n", s.tam);
    $("grilla").innerHTML = s.grilla.map(l => `<span>${l}</span>`).join("");
    $("trazos").setAttribute("viewBox", `0 0 ${s.tam} ${s.tam}`);
    $("tablero").classList.toggle("quieto", hecha);
    $("aviso").hidden = true;
    pinta();
  }
  const centro = c => [c % sopa.tam + 0.5, Math.floor(c / sopa.tam) + 0.5];
  function trazo(celdas, estilo) {
    const [x1, y1] = centro(celdas[0]), [x2, y2] = centro(celdas[celdas.length - 1]);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width=".78" stroke-linecap="round" style="${estilo}"/>`;
  }
  function pinta() {
    const n = sopa.palabras.length;
    let svg = "";
    for (const i of encontradas) svg += trazo(sopa.palabras[i].celdas, `stroke:${color(i)};stroke-opacity:.38`);
    if (sel && sel.celdas.length) svg += trazo(sel.celdas, "stroke:var(--sel);stroke-opacity:.3");
    $("trazos").innerHTML = svg;
    const marcadas = new Set(sel ? sel.celdas : []);
    [...$("grilla").children].forEach((el, c) => el.classList.toggle("en-sel", marcadas.has(c)));
    $("lista").innerHTML = sopa.palabras.map((p, i) =>
      `<li class="${encontradas.has(i) ? "hecha" : ""}" style="--c:${color(i)}"><i></i>${p.palabra}</li>`).join("");
    $("cuenta").textContent = `${encontradas.size} / ${n}`;
    $("reloj").textContent = reloj(ms);
  }

  /* ---------- arrastre ----------
     Pointer events para ratón y dedo; la línea se ajusta a la dirección
     más cercana de las ocho mientras se arrastra (M.linea). */
  function celdaDe(e) {
    const r = $("tablero").getBoundingClientRect(), t = sopa.tam;
    const x = Math.min(t - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * t)));
    const y = Math.min(t - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * t)));
    return [x, y];
  }
  $("tablero").addEventListener("pointerdown", e => {
    if (terminada || !sopa || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const [x, y] = celdaDe(e);
    sel = { x0: x, y0: y, celdas: [y * sopa.tam + x], t0: performance.now(), mov: 0, f: bandera(e) };
    $("tablero").setPointerCapture(e.pointerId);
    pinta();
  });
  $("tablero").addEventListener("pointermove", e => {
    if (!sel) return;
    sel.mov++; sel.f |= bandera(e);
    const [x, y] = celdaDe(e), celdas = M.linea(sopa.tam, sel.x0, sel.y0, x, y);
    if (celdas.join() !== sel.celdas.join()) { sel.celdas = celdas; pinta(); }
  });
  $("tablero").addEventListener("pointerup", e => {
    if (!sel) return;
    sel.f |= bandera(e);
    const i = M.palabraEn(sopa, sel.celdas, encontradas);
    if (i >= 0) {
      actualiza();
      const t = Math.round(ms);
      jugadas.push(sel.celdas[0], sel.celdas[sel.celdas.length - 1], Math.max(0, t - tUlt),
        Math.round(performance.now() - sel.t0), sel.mov, sel.f);
      tUlt = Math.max(tUlt, t);
    }
    sel = null;
    if (i >= 0) { encontradas.add(i); if (modo === "diaria") guardaProgreso(); }
    pinta();
    if (encontradas.size === sopa.palabras.length) completa();
  });
  $("tablero").addEventListener("pointercancel", () => { sel = null; pinta(); });

  function guardaProgreso() {
    if (modo === "diaria" && sopa && sopa.fecha && !terminada) guarda("sopa.diaria", { fecha: sopa.fecha, enc: [...encontradas], ms: Math.round(ms), j: sinPrueba ? [] : jugadas });
  }

  /* ---------- final ---------- */
  function aviso(html) { $("aviso").innerHTML = html; $("aviso").hidden = false; }
  function completa() {
    terminada = true; corriendo = false; $("tablero").classList.add("quieto");
    const tiempo = Math.max(1, Math.round(ms));
    const prueba = Object.assign({}, origen, { j: jugadas });
    if (modo === "diaria") {
      const antes = racha.ult;
      racha = M.registraDiaria(racha, sopa.fecha);
      guarda("sopa.racha", racha); guarda("sopa.diaria", { fecha: sopa.fecha, enc: [...encontradas], ms: tiempo });
      pintaRacha();
      if (racha.ult !== antes) {
        subeRacha();
        if (Club && !sinPrueba) Club.result({ categoria: "club-sopa-racha", puntos: racha.racha, tiempo }, prueba);
      }
      aviso(`<strong>¡Felicitaciones! 🎉</strong>Completaste la sopa del día en ${reloj(tiempo)}.<br>🔥 Racha: ${dias(racha.racha)} · mejor ${racha.mejor}. Vuelve mañana por la siguiente.` +
        (sinPrueba && Club ? "<br><small>Esta diaria se empezó con una versión anterior del juego: suma a tu racha, pero su tiempo no entra en la clasificación.</small>" : ""));
    } else {
      if (Club) Club.result({ categoria: `club-sopa-${sopa.dif}-${sopa.tam}`, puntos: sopa.palabras.length, tiempo }, prueba);
      aviso(`<strong>¡Felicitaciones! 🎉</strong>Encontraste las ${sopa.palabras.length} palabras en ${reloj(tiempo)}.<br><button type="button" class="boton primario" id="otra">Nueva sopa</button>`);
      $("otra").onclick = nuevaLibre;
    }
  }

  /* El reloj solo corre con la pestaña a la vista. Cada medio minuto se
     mira si en Chile ya es otro día: la racha visible cambia, y si la
     diaria estaba terminada o sin empezar, llega la nueva. */
  setInterval(() => { actualiza(); if (corriendo) $("reloj").textContent = reloj(ms); }, 250);
  setInterval(guardaProgreso, 5000);
  document.addEventListener("visibilitychange", () => { marca = performance.now(); if (document.hidden) guardaProgreso(); });
  setInterval(() => {
    const f = M.diaChile();
    if (f === hoy) return;
    hoy = f; pintaRacha();
    if (modo === "diaria" && (terminada || !encontradas.size)) cargaDiaria();
  }, 30000);

  for (const b of document.querySelectorAll("[data-modo]")) b.onclick = () => ponModo(b.dataset.modo);
  for (const id of ["selTema", "selDif", "selTam"]) $(id).onchange = nuevaLibre;
  $("nueva").onclick = nuevaLibre;
  if (Club && document.documentElement.classList.contains("club-integrado"))
    $("nota").textContent = "La racha cuenta solo la sopa diaria. Se guarda en este navegador y en tu cuenta, así que te sigue a otros dispositivos.";
  else
    $("nota").textContent = "La racha cuenta solo la sopa diaria y vive en este navegador. Para que te siga a otros dispositivos, juega desde Juegos con tu sesión iniciada.";
  pintaRacha();
  ponModo(modo);
})();
