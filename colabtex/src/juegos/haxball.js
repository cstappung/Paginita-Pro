import * as fb from "../fb-juegos.js";
import { crearMalla } from "./malla.js";
import { crearDirecto, OK_MS } from "./yemas-red.js";
import { escapeHtml } from "../util.js";
import { HB_CANCHAS, HB_MAX_NOMBRE, HB_METAS, HB_TIEMPOS } from "./motor.js";

/* HaxBall — el cartero entre la sala y el partido, hermano del de Boxhead.

   El partido vive entero en `juegos/haxball/` (un canvas, la física de los
   discos, su práctica contra bots) y entra aquí en un iframe. Este módulo no
   simula nada: traduce.

   - **El directo va de navegador a navegador** por la misma malla WebRTC
     que Yemas (`malla.js` + `yemas-red.js`, buzón en `vivo/<pid>/rtc`): el
     disco de cada uno y, en el estado de quien dirige, la pelota.
   - **Al registro va solo el gol**, `{t:"gol", e, n, por}`, escrito por quien
     dirige; `n` es el total que deja el gol, así un gol avisado dos veces (un
     cambio de director a medias) cuenta una sola.
   - **Antes del partido está el vestíbulo** (Rojo | Sin equipo | Azul),
     pintado aquí y no en el marco: elegir equipo, renombrar equipos y
     empezar son jugadas (`equipo`, `nomeq`, `empieza`, ver `redHaxball`).
     La configuración espera a que el anfitrión arranque, porque antes el
     marco no sabe quién juega en cada equipo; quien queda sin equipo mira. */
const PADRE = "haxball-padre", HIJO = "haxball-hijo";
const SRC = "juegos/haxball/index.html?modo=online&v=haxball-8";

export function crearHaxball({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, vest, redEl, vestFirma = "", editando = "", ocupado = false, muerto = false, listo = false, configurado = false;
  let partida = null, est = null, borrado = false;
  let malla = null, reloj = null, pendiente = null, parado = false, rosterFirma = "", sinMalla = false;
  const directo = crearDirecto({
    uid,
    sano: u => !!malla?.sano(u),
    conectados: () => malla?.conectados() || [],
  });

  const enSala = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;
  const juego = () => enSala() && !!est?.equipos?.[uid];
  const esJugador = u => !!est?.equipos?.[u];
  const empezado = () => !!est && est.fase !== "equipos";
  const nombre = u => est?.jugadores?.find(j => j.uid === u)?.nombre || "Jugador";

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  function reenvia() {
    if (!listo || !partida || !est) return;
    if (!configurado) {
      if (!empezado()) return;
      configurado = true;
      enviar("config", {
        yo: uid, ronda: est.ronda || 0, mirando: !juego(), meta: est.meta, tiempo: est.tiempo || 0, sprint: est.sprint !== false, cancha: est.cancha, semilla: (partida.semilla >>> 0) || 1,
        equipos: est.equipos || {}, nombresEq: est.nombresEq || {},
        jugadores: est.jugadores.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Jugador", orden: i }))
          .filter(j => est.equipos?.[j.uid])
      });
      programa();
    }
    enviar("marcador", {
      goles: est.goles || { rojo: 0, azul: 0 }, equipos: est.equipos || {}, puntos: est.puntos || {}, nombresEq: est.nombresEq || {}, oro: !!est.oro, lider: soyAnfitrion(),
      fuera: Object.keys(est.fuera || {}), meta: est.meta,
      fin: est.fase === "fin" ? { ganador: est.ganador || "", motivo: est.motivo || "" } : null
    });
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (d.tipo === "vestibulo") { if (soyAnfitrion() && empezado() && !partida?.fin) vuelveAlVestibulo(); return; }
    if (partida?.fin || !juego()) return;   // un mirón no escribe
    const anota = j => jugar(j).catch(err => console.warn("[haxball] no se pudo anotar", j.t, err));
    if (d.tipo === "estado" && d.e && typeof d.e === "object") {
      malla?.envia(directo.sale(d.e));
    } else if (d.tipo === "tiempo" && Number.isInteger(d.n)) {
      anota({ t: "tiempo", uid, n: d.n });
    } else if (d.tipo === "gol" && (d.e === "rojo" || d.e === "azul")) {
      anota({ t: "gol", uid, e: d.e, n: Number.isInteger(d.n) ? d.n : 0, por: typeof d.por === "string" ? d.por.slice(0, 64) : "" });
    }
  }

  // ---------- el directo ----------
  const otros = () => (est?.jugadores || []).map(j => j.uid).filter(u => u !== uid && !est.fuera?.[u] && esJugador(u));

  function programa() {
    if (pendiente || parado) return;
    pendiente = setTimeout(() => {
      pendiente = null;
      if (configurado && !parado) enviar("vivo", { v: directo.mapa(otros()) });
    }, 16);
  }
  const anuncia = () => malla?.envia(directo.anuncio());

  function pintaRed() {
    if (!redEl) return;
    let txt = "";
    if (sinMalla) txt = "No se pudo entrar al directo de la partida: recarga la página.";
    else if (configurado && !parado) {
      const malos = directo.inalcanzables(otros()), estan = new Set(malla?.presentes() || []);
      const idos = malos.filter(u => !estan.has(u)), red = malos.filter(u => estan.has(u));
      const lista = us => us.map(nombre).join(", ");
      const partes = [];
      if (idos.length) partes.push(lista(idos) + (idos.length > 1 ? " no están" : " no está") + " en la partida ahora (cerró la pestaña o se quedó sin internet).");
      if (red.length) partes.push("Sin conexión con " + lista(red) +
        ": sus redes no dejan una conexión directa y no hay nadie en común que la reenvíe. Prueben otra red (los datos del celular suelen bloquearla).");
      txt = partes.join(" ");
    }
    redEl.hidden = !txt;
    if (redEl.textContent !== txt) redEl.textContent = txt;
  }

  function arrancaDirecto() {
    if (malla || parado) return;
    malla = crearMalla({
      uid, senal: fb.senalMalla(pid, uid),
      quiere: u => juego() || esJugador(u),
      alDatos: (u, d) => {
        const r = directo.recibe(u, d);
        if (r.reenvia) malla.envia(r.reenvia.d, r.reenvia.a);
        if (r.cambio) programa();
      },
      alCambiar: () => { anuncia(); programa(); },
    });
    malla.entrar().then(ok => { if (!ok && !parado) { sinMalla = true; pintaRed(); } },
      err => { console.warn("[haxball] malla", err); sinMalla = true; pintaRed(); });
    reloj = setInterval(() => { anuncia(); programa(); pintaRed(); }, OK_MS);
  }
  function paraDirecto() {
    parado = true;
    malla?.salir();
    clearInterval(reloj);
    clearTimeout(pendiente);
    pintaRed();
  }

  function pantallaCompleta() {
    const pide = frame?.requestFullscreen || frame?.webkitRequestFullscreen;
    if (!pide) return false;
    try {
      const r = pide.call(frame, { navigationUI: "hide" });
      r?.then?.(() => frame.contentWindow?.focus(), () => {});
    } catch { return false; }
    frame.contentWindow?.focus();
    return true;
  }

  // ---------- el vestíbulo de equipos ----------
  const COLUMNAS = [["rojo", "Rojo"], ["", "Sin equipo"], ["azul", "Azul"]];
  const soyAnfitrion = () => enSala() && est.anfitrion === uid;
  const presentes = () => (est?.jugadores || []).filter(j => !est.fuera?.[j.uid]);
  const equipoDe = u => est.equipos?.[u] || "";

  async function mueve(lista) {
    if (ocupado) return;
    ocupado = true;
    try { for (const [a, e] of lista) if (equipoDe(a) !== e) await jugar({ t: "equipo", uid, a, e }); }
    catch (err) { console.warn("[haxball] no se pudo mover", err); }
    finally { ocupado = false; pintaVestibulo(true); }
  }
  function reparte(lista) {
    const cuenta = { rojo: 0, azul: 0 };
    for (const j of presentes()) if (equipoDe(j.uid)) cuenta[equipoDe(j.uid)]++;
    return lista.map(u => { const e = cuenta.rojo <= cuenta.azul ? "rojo" : "azul"; cuenta[e]++; return [u, e]; });
  }
  const auto = () => mueve(reparte(presentes().filter(j => !equipoDe(j.uid)).map(j => j.uid)));
  function azar() {
    const us = presentes().map(j => j.uid);
    for (let i = us.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [us[i], us[k]] = [us[k], us[i]]; }
    mueve(us.map((u, i) => [u, i % 2 ? "azul" : "rojo"]));
  }
  const reinicia = () => mueve(presentes().map(j => [j.uid, ""]));
  async function empieza() {
    if (ocupado) return;
    ocupado = true;
    try {
      await jugar({ t: "empieza", uid });
      if (partida.estado === "esperando") await fb.setEstado(pid, "jugando");
    } catch (err) { console.warn("[haxball] no se pudo empezar", err); }
    finally { ocupado = false; }
  }
  async function ajusta(k, v) {
    try { await jugar({ t: "ajuste", uid, k, v }); }
    catch (err) { console.warn("[haxball] no se pudo ajustar", err); }
  }
  async function pasaLider(a) {
    const nombre = (presentes().find(j => j.uid === a) || {}).nombre || "ese jugador";
    if (!confirm("¿Pasarle el liderazgo de la sala a " + nombre + "? Dejarás de mandar en la sala.")) return;
    try { await jugar({ t: "lider", uid, a }); }
    catch (err) { console.warn("[haxball] no se pudo pasar el liderazgo", err); }
  }
  /* El líder corta el partido: todos vuelven al vestíbulo y la sala se
     reabre para que entre gente nueva. */
  async function vuelveAlVestibulo() {
    try {
      await jugar({ t: "vestibulo", uid });
      if (partida.estado !== "esperando") await fb.setEstado(pid, "esperando");
    } catch (err) { console.warn("[haxball] no se pudo volver al vestíbulo", err); }
  }
  // Partido cortado: el marco se recarga para que el siguiente empiece limpio.
  function reiniciaMarco() {
    configurado = false; listo = false;
    if (frame) frame.src = SRC + "&r=" + Date.now();
  }
  async function renombra(e, nombre) {
    if (!editando) return;
    editando = "";
    try { await jugar({ t: "nomeq", uid, e, nombre: String(nombre || "").slice(0, HB_MAX_NOMBRE) }); }
    catch (err) { console.warn("[haxball] no se pudo renombrar", err); }
    pintaVestibulo(true);
  }

  function filaJugador(j, e) {
    const yo = j.uid === uid, manda = soyAnfitrion();
    const i = COLUMNAS.findIndex(c => c[0] === e);
    const flecha = (paso, txt) => {
      const destino = COLUMNAS[i + paso];
      return destino && (manda || yo) ? `<button class="jg-hx-mv" data-a="${escapeHtml(j.uid)}" data-e="${destino[0]}" title="Mover a ${destino[1]}">${txt}</button>` : "";
    };
    return `<li class="${yo ? "yo" : ""}">${flecha(-1, "◀")}<span class="jg-hx-n" translate="no">${escapeHtml(j.nombre || "Jugador")}</span>` +
      `${j.uid === est.anfitrion ? ' <span title="Líder de la sala">👑</span>' : ""}${yo ? " <em>(tú)</em>" : ""}` +
      `${manda && !yo ? `<button class="jg-hx-mv jg-hx-corona" data-lider="${escapeHtml(j.uid)}" title="Pasarle el liderazgo">👑</button>` : ""}${flecha(1, "▶")}</li>`;
  }
  function pintaVestibulo(forzar) {
    if (!vest || !est) return;
    const ver = !empezado() && !partida?.fin;
    vest.hidden = !ver;
    if (!ver) return;
    const manda = soyAnfitrion(), js = presentes();
    const firma = JSON.stringify([js.map(j => [j.uid, j.nombre, equipoDe(j.uid)]), est.nombresEq, est.anfitrion, editando, manda, enSala(), est.meta, est.cancha, est.tiempo, est.sprint]);
    if (!forzar && firma === vestFirma) return;
    if (!forzar && editando && vest.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    vestFirma = firma;
    const cuantos = e => js.filter(j => equipoDe(j.uid) === e).length;
    const listo = cuantos("rojo") > 0 && cuantos("azul") > 0;
    const nombreAnf = (js.find(j => j.uid === est.anfitrion) || {}).nombre || "el anfitrión";
    const columnas = COLUMNAS.map(([e, def]) => {
      const nom = e ? (est.nombresEq?.[e] || def) : def;
      const cab = e && editando === e
        ? `<input class="inp jg-hx-ren" data-e="${e}" maxlength="${HB_MAX_NOMBRE}" value="${escapeHtml(nom)}" aria-label="Nombre del equipo">`
        : `<b translate="${e ? "no" : "yes"}">${escapeHtml(nom)}</b>${e && manda ? ` <button class="jg-hx-lapiz" data-e="${e}" title="Cambiar el nombre">✎</button>` : ""}`;
      const unirme = enSala() && equipoDe(uid) !== e
        ? `<button class="btn2 jg-hx-unir" data-e="${e}">${e ? "Unirme" : "Salir del equipo"}</button>` : "";
      return `<section class="jg-hx-col jg-hx-${e || "sin"}"><header>${cab}</header>${unirme}
        <ul>${js.filter(j => equipoDe(j.uid) === e).map(j => filaJugador(j, e)).join("") || '<li class="vacio">—</li>'}</ul></section>`;
    }).join("");
    vest.innerHTML = `
      <div class="jg-hx-cols">${columnas}</div>
      ${manda ? `<div class="jg-hx-herr"><button class="btn2" data-h="auto" title="Reparte a los que no tienen equipo">Auto</button>
        <button class="btn2" data-h="azar" title="Mezcla a todos en dos equipos">Al azar</button>
        <button class="btn2" data-h="reinicia" title="Todos a sin equipo">Reiniciar</button></div>` : ""}
      ${manda ? `<div class="jg-hx-ajustes">
        <label>Goles para ganar <select data-k="meta">${HB_METAS.map(v => `<option value="${v}" ${v === est.meta ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Tiempo límite <select data-k="tiempo">${HB_TIEMPOS.map(v => `<option value="${v}" ${v === est.tiempo ? "selected" : ""}>${v ? v + " min" : "Sin límite"}</option>`).join("")}</select></label>
        <label>Cancha <select data-k="mapa">${Object.keys(HB_CANCHAS).map(v => `<option value="${v}" ${v === est.cancha ? "selected" : ""}>${HB_CANCHAS[v]}</option>`).join("")}</select></label>
        <label class="jg-hx-check"><input type="checkbox" data-k="sprint" ${est.sprint === false ? "" : "checked"}> Sprint</label>
      </div>` : ""}
      <p class="jg-hx-info">A ${est.meta} goles${est.tiempo ? " o " + est.tiempo + " min" : ""} · Sprint ${est.sprint === false ? "no" : "sí"} · Cancha ${escapeHtml(HB_CANCHAS[est.cancha] || "Clásica")} · Tu nombre y dorsal se eligen en el menú de abajo.</p>
      ${manda ? `<button class="btn jg-hx-empieza" ${listo ? "" : "disabled"}>Empezar partido</button>
        ${listo ? "" : '<p class="jg-hx-info">Hace falta al menos uno en cada equipo.</p>'}`
        : `<p class="jg-hx-info">Empieza cuando lo diga <span translate="no">${escapeHtml(nombreAnf)}</span>.</p>`}`;
    vest.querySelectorAll(".jg-hx-mv").forEach(b => b.onclick = () => mueve([[b.dataset.a, b.dataset.e]]));
    vest.querySelectorAll(".jg-hx-unir").forEach(b => b.onclick = () => mueve([[uid, b.dataset.e]]));
    vest.querySelectorAll(".jg-hx-lapiz").forEach(b => b.onclick = () => {
      editando = b.dataset.e; pintaVestibulo(true);
      const inp = vest.querySelector(".jg-hx-ren"); inp?.focus(); inp?.select();
    });
    const ren = vest.querySelector(".jg-hx-ren");
    if (ren) {
      ren.onkeydown = ev => {
        if (ev.key === "Enter") renombra(ren.dataset.e, ren.value);
        if (ev.key === "Escape") { editando = ""; pintaVestibulo(true); }
      };
      ren.onblur = () => { if (editando) renombra(ren.dataset.e, ren.value); };
    }
    vest.querySelectorAll(".jg-hx-corona").forEach(b => b.onclick = () => pasaLider(b.dataset.lider));
    vest.querySelectorAll("select[data-k]").forEach(sel => sel.onchange = () =>
      ajusta(sel.dataset.k, sel.dataset.k === "mapa" ? sel.value : Number(sel.value)));
    vest.querySelectorAll("input[type=checkbox][data-k]").forEach(c => c.onchange = () => ajusta(c.dataset.k, c.checked ? 1 : 0));
    const herr = { auto, azar, reinicia };
    vest.querySelectorAll("[data-h]").forEach(b => b.onclick = () => herr[b.dataset.h]());
    const emp = vest.querySelector(".jg-hx-empieza");
    if (emp) emp.onclick = () => { emp.disabled = true; empieza(); };
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    vest = document.createElement("div");
    vest.className = "jg-hx-vest";
    vest.hidden = true;
    redEl = document.createElement("p");
    redEl.className = "jg-yemas-aviso jg-yemas-red";
    redEl.setAttribute("role", "status");
    redEl.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "HaxBall — partida en línea";
    frame.className = "jg-yemas-marco jg-haxball-marco";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = SRC;
    host.append(vest, redEl, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaVestibulo();
    if (configurado && !empezado()) reiniciaMarco();
    if (!p.fin && empezado()) {
      arrancaDirecto();
      const firma = est.jugadores.map(j => j.uid).join() + "|" + Object.keys(est.fuera || {}).join() + "|" + JSON.stringify(est.equipos);
      if (firma !== rosterFirma) { rosterFirma = firma; malla?.revisa(); }
    }
    reenvia();
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !parado) paraDirecto();
    if (p.fin && !borrado && juego()) {
      borrado = true;
      fb.borraYemasVivo(pid);
    }
  }

  function destruir() {
    muerto = true;
    paraDirecto();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
