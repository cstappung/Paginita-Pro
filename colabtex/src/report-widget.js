"use strict";
/* ============================================================
   Informes — el botón que está en todas partes

   Un solo botón discreto abajo a la derecha. Cerrado es un círculo de
   34 px al 45 % de opacidad; al pasar por encima se despliega con su
   rótulo. Está en la esquina y no en la barra superior porque la barra
   ya se quedó sin sitio una vez (de ahí el menú «✦ IA»), y porque un
   botón de «esto no funciona» tiene que poder pulsarse SIN salir de lo
   que se estaba haciendo.

   Todo su CSS y su marcado se crean aquí, no en las páginas: es la
   única forma de que las tres páginas lo tengan igual sin copiar nada
   y de que añadirlo a una cuarta sea una línea.

   Lo que se envía se le enseña a la persona antes de enviarlo. No es
   un detalle de cortesía: sin verlo, «adjuntar los errores técnicos»
   es pedir que confíe a ciegas, y la respuesta razonable a eso es no
   marcarlo nunca.
   ============================================================ */
import { APPS, aMarkdown, descargar, nombreArchivo, navegador } from "./reports.js";

const CSS = `
.rp-fab{position:fixed;right:16px;bottom:16px;z-index:900;display:flex;flex-direction:column;
  align-items:flex-end;gap:8px;font-family:'IBM Plex Sans',sans-serif}
.rp-fab-btn{display:flex;align-items:center;gap:0;height:34px;padding:0 9px;border:1px solid #ffffff2e;
  border-radius:99px;background:#1f2933ee;color:#fff;font-size:14px;cursor:pointer;opacity:.45;
  box-shadow:0 4px 14px #00000040;transition:opacity .15s,gap .15s,padding .15s}
.rp-fab:hover .rp-fab-btn,.rp-fab-btn:focus-visible{opacity:1;gap:7px;padding:0 13px 0 11px}
.rp-fab-btn span{max-width:0;overflow:hidden;white-space:nowrap;font-size:12.5px;font-weight:600;
  transition:max-width .18s}
.rp-fab:hover .rp-fab-btn span,.rp-fab-btn:focus-visible span{max-width:150px}
.rp-menu{display:none;flex-direction:column;min-width:212px;padding:5px;border:1px solid #ffffff24;
  border-radius:10px;background:#1f2933f7;box-shadow:0 14px 34px #00000059}
.rp-menu.rp-open{display:flex}
.rp-menu button,.rp-menu a{display:block;width:100%;padding:8px 10px;border:none;border-radius:6px;
  background:transparent;color:#e8eef5;font-family:inherit;font-size:12.5px;text-align:left;cursor:pointer;
  text-decoration:none}
.rp-menu button:hover,.rp-menu a:hover{background:#ffffff17;color:#fff}
.rp-menu small{display:block;margin-top:2px;font-size:10.5px;color:#9fb0c0;line-height:1.4;white-space:normal}
.rp-sep{height:1px;margin:4px 7px;background:#ffffff1f}

.rp-back{position:fixed;inset:0;z-index:950;display:none;place-items:center;background:#0b1219b8;
  font-family:'IBM Plex Sans',sans-serif}
.rp-back.rp-open{display:grid}
.rp-modal{width:520px;max-width:94vw;max-height:90vh;overflow:auto;padding:22px;border-radius:12px;
  background:#fff;color:#1f2933;box-shadow:0 26px 64px #00000073}
.rp-modal h2{margin:0 0 4px;font-size:17px;font-weight:600}
.rp-modal p.rp-sub{margin:0 0 16px;font-size:12.5px;color:#5a6772;line-height:1.5}
.rp-lbl{display:block;margin:12px 0 5px;font-size:10.5px;font-weight:600;letter-spacing:.05em;color:#8a97a3}
.rp-in,.rp-ta,.rp-sel{width:100%;padding:8px 10px;border:1px solid #d4dce2;border-radius:6px;
  font-family:inherit;font-size:13px;color:#1f2933;background:#fff}
.rp-in:focus,.rp-ta:focus,.rp-sel:focus{outline:none;border-color:#0d9488}
.rp-ta{min-height:84px;resize:vertical;line-height:1.5}
.rp-tabs{display:flex;gap:6px;margin-bottom:4px}
.rp-tab{flex:1;padding:9px;border:1px solid #d4dce2;border-radius:8px;background:#fff;font-family:inherit;
  font-size:12.5px;font-weight:600;color:#42505c;cursor:pointer}
.rp-tab.rp-on{border-color:#0d9488;background:#e9f4f2;color:#0d9488}
.rp-check{display:flex;align-items:flex-start;gap:8px;margin-top:14px;font-size:12px;color:#42505c;line-height:1.5}
.rp-check input{margin-top:2px;flex-shrink:0}
.rp-peek{margin-top:8px;max-height:130px;overflow:auto;padding:8px 10px;border:1px solid #e2e8ec;
  border-radius:6px;background:#f7f9fa;font-family:'IBM Plex Mono',monospace;font-size:10.5px;
  color:#5a6772;white-space:pre-wrap;line-height:1.5}
.rp-foot{display:flex;align-items:center;gap:10px;margin-top:18px}
.rp-msg{flex:1;font-size:12px;line-height:1.4}
.rp-btn{height:34px;padding:0 15px;border:none;border-radius:6px;background:#0d9488;color:#fff;
  font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.rp-btn:hover{background:#0f766e}
.rp-btn:disabled{opacity:.5;cursor:default}
.rp-btn2{height:34px;padding:0 13px;border:1px solid #d4dce2;border-radius:6px;background:#fff;color:#42505c;
  font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.rp-btn2:hover{border-color:#0d9488;color:#0d9488}
@media print{.rp-fab{display:none}}
`;

let cssPuesto = false;
function ponCss() {
  if (cssPuesto || typeof document === "undefined") return;
  cssPuesto = true;
  const s = document.createElement("style");
  s.id = "rp-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Lo que se manda, en texto plano, tal cual se va a guardar. */
export function vistaPrevia(adjuntos) {
  if (!adjuntos || !adjuntos.length) return "(no se adjunta nada)";
  return adjuntos.map(a => `· ${a.donde ? a.donde + " → " : ""}${a.mensaje}`).join("\n");
}

/* ctx: { app, getUser, capture, ver, enviar(rec), urlInformes } */
export function createReportWidget(ctx) {
  ponCss();
  const app = ctx.app || "colabtex";
  const getUser = ctx.getUser || (() => null);
  const capture = ctx.capture || null;
  const ver = () => (typeof ctx.ver === "function" ? ctx.ver() : ctx.ver) || "";
  const urlInformes = ctx.urlInformes || "informes.html";

  /* ---------- botón y menú ---------- */
  const fab = el("div", "rp-fab");
  const btn = el("button", "rp-fab-btn", "⚑<span>Fallo o idea</span>");
  btn.type = "button";
  btn.title = "Contar un fallo, sugerir una mejora o ver el informe";
  btn.setAttribute("aria-label", "Contar un fallo o sugerir una mejora");
  const menu = el("div", "rp-menu");
  const bBug = el("button", null, "<b>⚠ Contar un fallo</b><small>Algo no funciona como debería.</small>");
  const bIdea = el("button", null, "<b>💡 Sugerir una mejora</b><small>Algo que falta o que se puede hacer mejor.</small>");
  const sep = el("div", "rp-sep");
  const aVer = el("a", null, "<b>📋 Ver el informe</b><small>Todo lo recogido, y cómo exportarlo.</small>");
  aVer.href = urlInformes;
  aVer.target = "_blank";
  aVer.rel = "noopener";
  menu.append(bBug, bIdea, sep, aVer);
  fab.append(menu, btn);
  document.body.appendChild(fab);

  const abierto = () => menu.classList.contains("rp-open");
  const abrirMenu = on => menu.classList.toggle("rp-open", !!on);
  btn.onclick = ev => { ev.stopPropagation(); abrirMenu(!abierto()); };
  document.addEventListener("click", ev => { if (abierto() && !fab.contains(ev.target)) abrirMenu(false); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && abierto()) abrirMenu(false); });

  /* ---------- modal ---------- */
  const back = el("div", "rp-back");
  const modal = el("div", "rp-modal");
  back.appendChild(modal);
  document.body.appendChild(back);
  back.onclick = ev => { if (ev.target === back) cerrar(); };

  const h2 = el("h2");
  const sub = el("p", "rp-sub");
  const tabs = el("div", "rp-tabs");
  const tBug = el("button", "rp-tab", "⚠ Un fallo");
  const tIdea = el("button", "rp-tab", "💡 Una idea");
  tabs.append(tBug, tIdea);

  const inTitulo = el("input", "rp-in");
  inTitulo.maxLength = 200;
  const taCuerpo = el("textarea", "rp-ta");
  taCuerpo.maxLength = 4000;
  const lblPasos = el("label", "rp-lbl", "PASOS PARA REPRODUCIRLO (opcional)");
  const taPasos = el("textarea", "rp-ta");
  taPasos.maxLength = 2000;
  taPasos.placeholder = "1. Abro un proyecto…\n2. Pulso…\n3. Pasa esto en vez de lo otro.";

  const selApp = el("select", "rp-sel");
  for (const [k, v] of Object.entries(APPS)) {
    if (k === "informes") continue;
    const o = document.createElement("option");
    o.value = k; o.textContent = v;
    selApp.appendChild(o);
  }
  selApp.value = app;

  const check = el("label", "rp-check");
  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.checked = true;
  check.append(chk, el("span", null,
    "Adjuntar los últimos errores técnicos de esta sesión. Es lo que permite reproducir el fallo; " +
    "<b>no se envía nada de tus documentos</b>, solo lo que ves aquí abajo."));
  const peek = el("div", "rp-peek");

  const foot = el("div", "rp-foot");
  const msg = el("div", "rp-msg");
  const bCancel = el("button", "rp-btn2", "Cancelar");
  const bEnviar = el("button", "rp-btn", "Enviar");
  foot.append(msg, bCancel, bEnviar);

  modal.append(h2, sub, tabs,
    el("label", "rp-lbl", "EN QUÉ APLICACIÓN"), selApp,
    el("label", "rp-lbl", "EN UNA LÍNEA"), inTitulo,
    el("label", "rp-lbl", "CUÉNTALO"), taCuerpo,
    lblPasos, taPasos, check, peek, foot);

  let tipo = "bug";
  const pintaTipo = () => {
    tBug.classList.toggle("rp-on", tipo === "bug");
    tIdea.classList.toggle("rp-on", tipo === "idea");
    h2.textContent = tipo === "bug" ? "Contar un fallo" : "Sugerir una mejora";
    sub.textContent = tipo === "bug"
      ? "Cuanto más concreto, antes se arregla. Lo verá todo el equipo en el informe."
      : "Qué te falta o qué harías de otra forma. Lo verá todo el equipo en el informe.";
    inTitulo.placeholder = tipo === "bug"
      ? "El PDF sale en blanco al compilar con figuras vinculadas"
      : "Poder duplicar una capa entera en ColabDraw";
    taCuerpo.placeholder = tipo === "bug"
      ? "Qué esperabas que pasara y qué pasó."
      : "Para qué te serviría y cómo te lo imaginas.";
    for (const n of [lblPasos, taPasos]) n.style.display = tipo === "bug" ? "" : "none";
    check.style.display = tipo === "bug" ? "" : "none";
    peek.style.display = tipo === "bug" && chk.checked ? "" : "none";
  };
  tBug.onclick = () => { tipo = "bug"; pintaTipo(); };
  tIdea.onclick = () => { tipo = "idea"; pintaTipo(); };
  chk.onchange = () => { peek.style.display = chk.checked && tipo === "bug" ? "" : "none"; };

  const adjuntosDe = () => {
    if (!capture || !capture.buffer) return [];
    return capture.buffer.list().slice(-6).map(e => ({ donde: e.donde, mensaje: e.mensaje }));
  };

  function abrir(cual) {
    tipo = cual === "idea" ? "idea" : "bug";
    inTitulo.value = ""; taCuerpo.value = ""; taPasos.value = "";
    msg.textContent = "";
    selApp.value = app;
    chk.checked = true;
    peek.textContent = vistaPrevia(adjuntosDe());
    pintaTipo();
    bEnviar.disabled = false;
    back.classList.add("rp-open");
    setTimeout(() => inTitulo.focus(), 30);
  }
  const cerrar = () => back.classList.remove("rp-open");
  bCancel.onclick = cerrar;
  bBug.onclick = () => { abrirMenu(false); abrir("bug"); };
  bIdea.onclick = () => { abrirMenu(false); abrir("idea"); };
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && back.classList.contains("rp-open")) cerrar();
  });

  bEnviar.onclick = async () => {
    const titulo = inTitulo.value.trim();
    if (!titulo) { msg.style.color = "#c0392b"; msg.textContent = "Falta la línea de arriba."; inTitulo.focus(); return; }
    const u = getUser();
    if (!u || !u.uid) {
      msg.style.color = "#c0392b";
      msg.textContent = "Hay que iniciar sesión para enviarlo. Puedes descargarlo abajo mientras tanto.";
      ofreceDescarga(titulo);
      return;
    }
    bEnviar.disabled = true;
    msg.style.color = "#5a6772";
    msg.textContent = "Enviando…";
    try {
      await ctx.enviar({
        tipo, app: selApp.value, titulo,
        cuerpo: taCuerpo.value.trim(),
        pasos: tipo === "bug" ? taPasos.value.trim() : "",
        adjuntos: tipo === "bug" && chk.checked ? adjuntosDe().map(a => `${a.donde ? a.donde + " → " : ""}${a.mensaje}`) : [],
        nav: navegador(navigator.userAgent), ver: ver()
      }, u);
      msg.style.color = "#0d9488";
      msg.textContent = "¡Enviado! Gracias.";
      setTimeout(cerrar, 1100);
    } catch (e) {
      bEnviar.disabled = false;
      msg.style.color = "#c0392b";
      /* Si las reglas nuevas no están publicadas, esto falla en seco. Se
         dice con su nombre y se ofrece la salida: bajarlo a un archivo. */
      msg.textContent = /permission|denied/i.test(e.message || "")
        ? "La base de datos aún no acepta informes (faltan las reglas). Descárgalo y pásalo a mano:"
        : "No se pudo enviar: " + (e.message || e);
      ofreceDescarga(titulo);
    }
  };

  /* Salida de emergencia: si no se puede enviar, que al menos no se
     pierda lo escrito. */
  function ofreceDescarga(titulo) {
    if (foot.querySelector(".rp-save")) return;
    const b = el("button", "rp-btn2 rp-save", "⤓ Descargar");
    b.onclick = () => {
      descargar(aMarkdown({
        feedback: [{
          tipo, app: selApp.value, titulo, cuerpo: taCuerpo.value.trim(),
          pasos: taPasos.value.trim(), adjuntos: adjuntosDe().map(a => `${a.donde ? a.donde + " → " : ""}${a.mensaje}`),
          userName: (getUser() || {}).name || "Sin sesión", nav: navegador(navigator.userAgent),
          ver: ver(), at: Date.now()
        }]
      }), nombreArchivo("md"));
      b.remove();
    };
    foot.insertBefore(b, bEnviar);
  }

  return { abrir, cerrar, destroy() { fab.remove(); back.remove(); } };
}
