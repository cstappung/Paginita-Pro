"use strict";
/* ============================================================
   Informes — la página

   Cuarta página del sitio, la más pequeña: sesión, dos listas y los
   botones de exportar. Usa la misma cuenta de Google y la misma base
   que ColabTeX y ColabDraw, así que no hay nada que configurar aparte.

   Se escuchan los dos nodos en vivo (`onValue`): dos personas mirando
   el informe mientras una tercera reporta algo tienen que verlo
   aparecer, igual que en el resto del sitio.
   ============================================================ */
import { watchAuth, loginGoogle, logout } from "./firebase.js";
import * as rep from "./fb-reports.js";
import { escapeHtml, timeAgo, colorForUid } from "./util.js";
import { APPS, TIPOS, aMarkdown, aJson, descargar, nombreArchivo } from "./reports.js";
import { createReportWidget } from "./report-widget.js";

const $ = id => document.getElementById(id);

const state = {
  user: null,
  errores: [],
  feedback: [],
  tab: "err",
  app: "",
  busca: "",
  offErr: null,
  offFb: null,
  fallo: null      // por qué no se puede leer (reglas sin publicar, normalmente)
};

const VER = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

/* ---------- sesión ---------- */
function pintaUsuario() {
  const u = state.user;
  $("userName").textContent = u ? u.name : "";
  const av = $("userAvatar");
  if (!u) { av.textContent = ""; return; }
  if (u.photo) av.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">`;
  else { av.textContent = (u.name || "?").charAt(0).toUpperCase(); av.style.background = u.color; }
}

function mostrar(dentro) {
  $("viewLogin").style.display = dentro ? "none" : "grid";
  $("viewMain").style.display = dentro ? "" : "none";
  $("userName").style.display = dentro ? "" : "none";
  $("userAvatar").style.display = dentro ? "" : "none";
  $("btnLogout").style.display = dentro ? "" : "none";
}

/* ---------- datos ---------- */
function escuchar() {
  parar();
  state.offErr = rep.watchErrors((lista, err) => {
    if (err) { state.fallo = err; }
    else { state.errores = lista; state.fallo = null; }
    render();
  });
  state.offFb = rep.watchFeedback((lista, err) => {
    if (err) state.fallo = err;
    else state.feedback = lista;
    render();
  });
}
function parar() {
  for (const k of ["offErr", "offFb"]) { if (state[k]) { try { state[k](); } catch (e) {} state[k] = null; } }
}

/* ---------- pintado ---------- */
const pillApp = a => `<span class="pill ${a === "colabdraw" ? "p-draw" : "p-tex"}">${escapeHtml(APPS[a] || a)}</span>`;

function filtra(lista, campos) {
  const q = state.busca.trim().toLowerCase();
  return lista.filter(x => {
    if (state.app && x.app !== state.app) return false;
    if (!q) return true;
    return campos.some(c => String(x[c] || "").toLowerCase().includes(q));
  });
}

function render() {
  $("nErr").textContent = state.errores.length;
  $("nFb").textContent = state.feedback.length;
  $("tabErr").classList.toggle("on", state.tab === "err");
  $("tabFb").classList.toggle("on", state.tab === "fb");

  const av = $("aviso");
  if (state.fallo) {
    av.innerHTML = `<div class="aviso"><b>La base de datos todavía no acepta informes.</b><br>
      Faltan por publicar las reglas nuevas (<code>errors</code> y <code>feedback</code>) en la consola de
      Firebase — están en <code>firebase/database.rules.json</code> y el paso está explicado en
      <code>firebase/CONFIGURAR-FIREBASE.md</code>. Mientras tanto, cada error se sigue guardando en tu
      navegador y el botón ⚑ te deja descargar lo que escribas.<br>
      <span style="opacity:.7">Detalle: ${escapeHtml(state.fallo.message || String(state.fallo))}</span></div>`;
  } else av.innerHTML = "";

  const host = $("lista");
  host.innerHTML = "";
  if (state.tab === "err") pintaErrores(host); else pintaFeedback(host);

  $("nota").innerHTML = state.tab === "err"
    ? "De cada error se guarda el mensaje, en qué estaba la aplicación, tres líneas de la pila y la familia " +
      "del navegador. <b>No se guarda nada del contenido de tus documentos</b>, y las erratas de LaTeX " +
      "(un comando mal escrito, una llave que falta) se descartan a propósito: son del documento, no de la " +
      "aplicación, y llenarían el informe sin decir nada de lo que hay que arreglar."
    : "Cualquiera puede marcar algo como resuelto; borrarlo, solo quien lo escribió.";
}

function pintaErrores(host) {
  const lista = filtra(state.errores, ["mensaje", "donde", "nav"])
    .sort((a, b) => (b.veces || 1) - (a.veces || 1) || (b.at || 0) - (a.at || 0));
  if (!lista.length) {
    host.innerHTML = `<div class="vacio">${state.errores.length
      ? "Nada que coincida con el filtro."
      : "Ningún error recogido. Buena señal."}</div>`;
    return;
  }
  for (const e of lista) {
    const row = document.createElement("div");
    row.className = "row";
    const veces = (e.veces || 1) > 1 ? `<span class="pill p-veces">×${e.veces}</span>` : "";
    const gente = e.personas > 1 ? ` · ${e.personas} personas` : "";
    row.innerHTML = `
      <div class="row-top">
        ${pillApp(e.app)}${veces}
        <div class="row-title">${escapeHtml(e.mensaje)}</div>
        <div class="row-acts"><button class="mini del" title="Quitar del informe">✕</button></div>
      </div>
      <div class="row-meta">
        ${e.donde ? "Al " + escapeHtml(e.donde) + " · " : ""}${escapeHtml(e.nav || "")}
        ${e.ver ? " · página " + escapeHtml(e.ver) : ""} · última vez ${escapeHtml(timeAgo(e.at))}${gente}
        ${e.ctx ? "<br>" + escapeHtml(Object.entries(e.ctx).map(([k, v]) => `${k}=${v}`).join(" · ")) : ""}
      </div>
      ${e.pila && e.pila.length ? `<div class="row-pre">${escapeHtml(e.pila.join("\n"))}</div>` : ""}`;
    row.querySelector(".del").onclick = async () => {
      if (!confirm("¿Quitar este error del informe? Volverá a aparecer si se repite.")) return;
      try { await rep.deleteError(e.id); } catch (err) { alert("No se pudo: " + (err.message || err)); }
    };
    host.appendChild(row);
  }
}

function pintaFeedback(host) {
  const lista = filtra(state.feedback, ["titulo", "cuerpo", "pasos", "userName"])
    .sort((a, b) => (a.estado === "hecho" ? 1 : 0) - (b.estado === "hecho" ? 1 : 0) || (b.at || 0) - (a.at || 0));
  if (!lista.length) {
    host.innerHTML = `<div class="vacio">${state.feedback.length
      ? "Nada que coincida con el filtro."
      : "Todavía no hay nada. Usa el botón ⚑ de abajo a la derecha, aquí o en cualquier página."}</div>`;
    return;
  }
  for (const f of lista) {
    const mio = state.user && f.uid === state.user.uid;
    const hecho = f.estado === "hecho";
    const row = document.createElement("div");
    row.className = "row" + (hecho ? " hecho" : "");
    row.innerHTML = `
      <div class="row-top">
        <span class="pill ${f.tipo === "idea" ? "p-idea" : "p-bug"}">${escapeHtml(TIPOS[f.tipo] || f.tipo)}</span>
        ${pillApp(f.app)}${hecho ? '<span class="pill p-done">HECHO</span>' : ""}
        <div class="row-title">${escapeHtml(f.titulo)}</div>
        <div class="row-acts">
          <button class="mini ok" title="${hecho ? "Volver a abrirlo" : "Marcar como resuelto"}">${hecho ? "↺" : "✓"}</button>
          ${mio ? '<button class="mini del" title="Borrar">✕</button>' : ""}
        </div>
      </div>
      <div class="row-meta">${escapeHtml(f.userName || "?")} · ${escapeHtml(timeAgo(f.at))}${f.nav ? " · " + escapeHtml(f.nav) : ""}</div>
      ${f.cuerpo ? `<div class="row-body">${escapeHtml(f.cuerpo)}</div>` : ""}
      ${f.pasos ? `<div class="row-body"><b>Pasos:</b>\n${escapeHtml(f.pasos)}</div>` : ""}
      ${f.adjuntos && f.adjuntos.length ? `<div class="row-pre">${escapeHtml(f.adjuntos.join("\n"))}</div>` : ""}`;
    row.querySelector(".ok").onclick = async () => {
      try { await rep.setFeedbackState(f.id, hecho ? "abierto" : "hecho"); }
      catch (err) { alert("No se pudo: " + (err.message || err)); }
    };
    const del = row.querySelector(".del");
    if (del) del.onclick = async () => {
      if (!confirm(`¿Borrar «${f.titulo}»?`)) return;
      try { await rep.deleteFeedback(f.id); } catch (err) { alert("No se pudo: " + (err.message || err)); }
    };
    host.appendChild(row);
  }
}

/* ---------- exportar ---------- */
function exportar(formato) {
  const datos = { errores: state.errores, feedback: state.feedback, generado: Date.now() };
  if (formato === "json") descargar(aJson(datos), nombreArchivo("json"), "application/json;charset=utf-8");
  else descargar(aMarkdown(datos), nombreArchivo("md"));
}

/* ---------- arranque ---------- */
function wire() {
  $("btnLogin").onclick = () => loginGoogle().catch(e => {
    $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message);
  });
  $("btnLogout").onclick = () => logout();
  $("tabErr").onclick = () => { state.tab = "err"; render(); };
  $("tabFb").onclick = () => { state.tab = "fb"; render(); };
  $("filtroApp").onchange = e => { state.app = e.target.value; render(); };
  $("buscar").oninput = e => { state.busca = e.target.value; render(); };
  $("btnMd").onclick = () => exportar("md");
  $("btnJson").onclick = () => exportar("json");
}

(function boot() {
  wire();
  /* El botón ⚑ también aquí: quien está mirando el informe es justo
     quien más a mano tiene otra cosa que contar. */
  createReportWidget({
    app: "colabtex", ver: VER, urlInformes: "informes.html",
    getUser: () => state.user,
    enviar: (r, u) => rep.sendFeedback(r, { uid: u.uid, userName: u.name })
  });
  watchAuth(user => {
    if (!user) {
      state.user = null; parar(); mostrar(false); pintaUsuario();
      return;
    }
    state.user = {
      uid: user.uid,
      name: user.displayName || user.email || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    pintaUsuario();
    mostrar(true);
    escuchar();
    render();
  });
})();
