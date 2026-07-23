"use strict";
/* ============================================================
   ColabTeX — comentarios sobre el texto (estilo Overleaf)

   Se selecciona un fragmento del .tex y se le adjunta un hilo de
   comentario que ven todos los colaboradores. Cualquiera puede
   responder o marcarlo como «resuelto».

   Dónde viven los datos: en el MISMO documento Yjs del proyecto,
   bajo el mapa «comments». Así se sincronizan por el proveedor RTDB
   que ya existe, sin canal ni reglas nuevas. Los invitados de solo
   lectura los ven pero no pueden escribir (el proveedor bloquea sus
   cambios y las reglas de Firebase también) → función solo en la nube.

   Cómo se ancla al texto: con POSICIONES RELATIVAS de Yjs. Guardar
   un desplazamiento (offset) numérico se rompería en cuanto alguien
   escribe más arriba; la posición relativa apunta al carácter lógico
   y sobrevive a las ediciones de todos, propias o remotas.

   Estructura de un hilo (Y.Map dentro del mapa «comments»):
     file       archivo al que pertenece (p. ej. "main.tex")
     anchor     posición relativa del inicio del fragmento (JSON)
     head       posición relativa del final del fragmento (JSON)
     quote      copia del texto seleccionado (para mostrar / respaldo)
     author     {uid, name, color}
     createdAt  ms
     resolved   bool
     resolvedBy {uid, name} | null
     messages   Y.Array de {id, author, text, createdAt}  (el 1º es el
                comentario inicial; los siguientes, respuestas)
   ============================================================ */
import * as Y from "yjs";
import { EditorView, Decoration } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { escapeHtml, timeAgo } from "./util.js";

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const QUOTE_MAX = 240;

/* Efecto para reemplazar el conjunto de resaltados del editor. Se
   dispara cuando cambian los hilos o cuando cambia el hilo enfocado. */
const setCommentDeco = StateEffect.define();

/* ---------- posiciones relativas ↔ offset ---------- */
function relFromIndex(ytext, index) {
  return Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(ytext, index));
}
function indexFromRel(ydoc, relJSON) {
  if (!relJSON) return null;
  try {
    const abs = Y.createAbsolutePositionFromRelativePosition(
      Y.createRelativePositionFromJSON(relJSON), ydoc);
    return abs ? abs.index : null;
  } catch (e) { return null; }
}

export function createComments(ctx) {
  /* ctx expone el estado vivo de main.js sin acoplar módulos:
     getYComments, getYdoc, getYFiles, getActiveFile, getView,
     getUser, canWrite, openFile(name), isCloud  */

  let observer = null;      // handler de observeDeep sobre el mapa
  let boundMap = null;      // mapa observado actualmente
  let activeThread = null;  // hilo abierto/enfocado en el panel
  let filter = "open";      // "open" | "all"
  let bubble = null;        // botón flotante «Comentar» sobre la selección
  /* Borradores en curso, para que un cambio remoto (que repinta el panel)
     no borre lo que estás escribiendo. */
  let pendingDraft = null;          // comentario nuevo {file,anchor,head,quote,text}
  const replyDrafts = new Map();    // id de hilo → texto de respuesta a medio escribir

  /* ------------------------------------------------ acceso a datos */
  function threads() {
    const m = ctx.getYComments();
    if (!m) return [];
    const out = [];
    m.forEach((t, id) => out.push({ id, t }));
    // primero los abiertos, y dentro por antigüedad
    out.sort((a, b) => {
      const ra = a.t.get("resolved") ? 1 : 0, rb = b.t.get("resolved") ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return (a.t.get("createdAt") || 0) - (b.t.get("createdAt") || 0);
    });
    return out;
  }

  /* rango [from,to] del hilo en el archivo activo, o null si no aplica
     al archivo actual o el ancla ya no se puede resolver */
  function rangeOf(t) {
    if (t.get("file") !== ctx.getActiveFile()) return null;
    const ydoc = ctx.getYdoc();
    const a = indexFromRel(ydoc, t.get("anchor"));
    const b = indexFromRel(ydoc, t.get("head"));
    if (a == null || b == null) return null;
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  /* ------------------------------------------------ resaltado (CodeMirror) */
  function buildDeco(docLen) {
    const m = ctx.getYComments();
    if (!m) return Decoration.none;
    const ranges = [];
    for (const { id, t } of threads()) {
      if (t.get("resolved")) continue;              // resueltos: sin resalte
      const r = rangeOf(t);
      if (!r || r.from === r.to) continue;          // ancla perdida o colapsada
      const to = Math.min(r.to, docLen);
      if (to <= r.from) continue;
      ranges.push(Decoration.mark({
        class: id === (activeThread && activeThread.id) ? "cm-comment cm-comment-active" : "cm-comment",
        attributes: { "data-thread": id }
      }).range(r.from, to));
    }
    return Decoration.set(ranges, true);   // true = que CodeMirror los ordene
  }

  const field = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
      deco = deco.map(tr.changes);   // sigue al texto entre recálculos
      for (const e of tr.effects) if (e.is(setCommentDeco)) return e.value;
      return deco;
    },
    provide: f => EditorView.decorations.from(f)
  });

  /* recalcula el resaltado del editor a partir de los hilos actuales */
  function refreshDeco() {
    const view = ctx.getView();
    if (!view) return;
    view.dispatch({ effects: setCommentDeco.of(buildDeco(view.state.doc.length)) });
  }

  /* clic en un fragmento resaltado → abrir su hilo */
  const clickHandler = EditorView.domEventHandlers({
    mousedown(ev) {
      const el = ev.target.closest && ev.target.closest(".cm-comment");
      if (!el) return false;
      const id = el.getAttribute("data-thread");
      if (id) { openPanel(); focusThread(id); }
      return false;
    }
  });

  /* la burbuja «Comentar» aparece/desaparece según la selección */
  const selectionWatch = EditorView.updateListener.of(u => {
    if (u.selectionSet || u.docChanged || u.geometryChanged) positionBubble(u.view);
  });

  function editorExtension() {
    return [field, clickHandler, selectionWatch];
  }

  /* ------------------------------------------------ burbuja «Comentar» */
  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement("button");
    bubble.className = "comment-bubble";
    bubble.textContent = "💬 Comentar";
    bubble.title = "Comentar el texto seleccionado";
    bubble.style.display = "none";
    bubble.addEventListener("mousedown", e => e.preventDefault()); // no perder la selección
    bubble.addEventListener("click", () => startCommentOnSelection());
    document.body.appendChild(bubble);
    return bubble;
  }

  function hideBubble() { if (bubble) bubble.style.display = "none"; }

  function positionBubble(view) {
    if (!ctx.isCloud() || !ctx.canWrite()) return hideBubble();
    const sel = view.state.selection.main;
    if (sel.empty) return hideBubble();
    const coords = view.coordsAtPos(sel.from);
    const end = view.coordsAtPos(sel.to);
    if (!coords || !end) return hideBubble();
    const b = ensureBubble();
    b.style.display = "";
    // encima del inicio de la selección, sin salirse de la ventana
    const top = Math.max(6, coords.top - 34);
    const left = Math.min(Math.max(6, coords.left), window.innerWidth - b.offsetWidth - 6);
    b.style.top = top + "px";
    b.style.left = left + "px";
  }

  /* ------------------------------------------------ crear hilo */
  function startCommentOnSelection() {
    const view = ctx.getView();
    if (!view || !ctx.isCloud() || !ctx.canWrite()) return;
    const sel = view.state.selection.main;
    if (sel.empty) return;
    const file = ctx.getActiveFile();
    const ytext = ctx.getYFiles() && ctx.getYFiles().get(file);
    if (!ytext) return;
    hideBubble();

    const quote = view.state.sliceDoc(sel.from, sel.to).slice(0, QUOTE_MAX);
    // hilo «en preparación»: se materializa al escribir el primer comentario
    pendingDraft = {
      file,
      anchor: relFromIndex(ytext, sel.from),
      head: relFromIndex(ytext, sel.to),
      quote,
      text: ""
    };
    activeThread = null;
    openPanel();
    const input = $("commentDraftInput");
    if (input) input.focus();
  }

  function commitNewThread(text) {
    const pending = pendingDraft;
    const ydoc = ctx.getYdoc();
    const m = ctx.getYComments();
    const user = ctx.getUser();
    if (!pending || !ydoc || !m || !text.trim()) return;
    pendingDraft = null;
    const id = uid();
    ydoc.transact(() => {
      // integrar el mapa en el documento ANTES de añadirle hijos anidados
      const t = m.set(id, new Y.Map());
      t.set("file", pending.file);
      t.set("anchor", pending.anchor);
      t.set("head", pending.head);
      t.set("quote", pending.quote);
      t.set("author", authorOf(user));
      t.set("createdAt", Date.now());
      t.set("resolved", false);
      t.set("resolvedBy", null);
      const msgs = t.set("messages", new Y.Array());
      msgs.push([{ id: uid(), author: authorOf(user), text: text.trim(), createdAt: Date.now() }]);
    });
    activeThread = { id };
    // el observeDeep repinta; enfocamos el hilo recién creado
    focusThread(id);
  }

  function authorOf(user) {
    return { uid: user.uid, name: user.name, color: user.color };
  }

  /* ------------------------------------------------ acciones sobre hilos */
  function reply(id, text) {
    const m = ctx.getYComments();
    const t = m && m.get(id);
    if (!t || !text.trim()) return;
    const user = ctx.getUser();
    replyDrafts.delete(id);
    t.get("messages").push([{ id: uid(), author: authorOf(user), text: text.trim(), createdAt: Date.now() }]);
  }

  function toggleResolved(id) {
    const m = ctx.getYComments();
    const t = m && m.get(id);
    if (!t) return;
    const user = ctx.getUser();
    const now = !t.get("resolved");
    ctx.getYdoc().transact(() => {
      t.set("resolved", now);
      t.set("resolvedBy", now ? { uid: user.uid, name: user.name } : null);
    });
  }

  function deleteThread(id) {
    const m = ctx.getYComments();
    if (!m || !m.has(id)) return;
    if (!confirm("¿Eliminar este comentario y todas sus respuestas?")) return;
    m.delete(id);
    if (activeThread && activeThread.id === id) activeThread = null;
  }

  /* ¿puede el usuario borrar el hilo? autor del hilo o propietario */
  function canDelete(t) {
    const user = ctx.getUser();
    const author = t.get("author") || {};
    return ctx.canWrite() && (author.uid === user.uid || ctx.isOwner());
  }

  /* ------------------------------------------------ panel lateral */
  function focusThread(id) {
    activeThread = { id };
    render();
    refreshDeco();
    // llevar el editor al fragmento comentado
    const m = ctx.getYComments();
    const t = m && m.get(id);
    const view = ctx.getView();
    if (!t || !view) return;
    if (t.get("file") !== ctx.getActiveFile()) ctx.openFile(t.get("file"));
    const r = rangeOf(m.get(id));
    if (r) {
      const pos = Math.min(r.from, view.state.doc.length);
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    }
    // desplazar el panel a la tarjeta
    const card = document.querySelector(`.comment-card[data-thread="${id}"]`);
    if (card) card.scrollIntoView({ block: "nearest" });
  }

  function threadMsgHtml(msg) {
    const a = msg.author || {};
    return `
      <div class="comment-msg">
        <span class="comment-avatar" style="background:${a.color || "#888"}">${escapeHtml((a.name || "?").charAt(0).toUpperCase())}</span>
        <div class="comment-msg-body">
          <div class="comment-msg-head"><b>${escapeHtml(a.name || "—")}</b><span>${timeAgo(msg.createdAt)}</span></div>
          <div class="comment-msg-text">${escapeHtml(msg.text)}</div>
        </div>
      </div>`;
  }

  function threadCardHtml({ id, t }) {
    const resolved = !!t.get("resolved");
    const msgs = (t.get("messages") && t.get("messages").toArray()) || [];
    const active = activeThread && activeThread.id === id;
    const lost = rangeOf(t) == null && t.get("file") === ctx.getActiveFile();
    const rb = t.get("resolvedBy");
    return `
      <div class="comment-card${active ? " comment-card-active" : ""}${resolved ? " comment-card-resolved" : ""}" data-thread="${id}">
        <div class="comment-quote" title="Ir al fragmento">
          <span class="comment-file">${escapeHtml(t.get("file") || "")}</span>
          ${lost ? '<span class="comment-lost" title="El texto original se editó o borró">fragmento cambiado</span>' : ""}
          <span class="comment-quote-text">“${escapeHtml(t.get("quote") || "")}”</span>
        </div>
        <div class="comment-msgs">${msgs.map(threadMsgHtml).join("")}</div>
        ${resolved ? `<div class="comment-resolved-tag">✓ Resuelto${rb && rb.name ? " por " + escapeHtml(rb.name) : ""}</div>` : ""}
        ${ctx.canWrite() ? `
          <div class="comment-actions">
            <input class="comment-reply-input" data-thread="${id}" placeholder="Responder…" value="${escapeHtml(replyDrafts.get(id) || "")}">
            <button class="comment-mini comment-resolve" data-thread="${id}">${resolved ? "Reabrir" : "Resolver"}</button>
            ${canDelete(t) ? `<button class="comment-mini comment-del" data-thread="${id}" title="Eliminar hilo">🗑</button>` : ""}
          </div>` : ""}
      </div>`;
  }

  function draftHtml() {
    return `
      <div class="comment-card comment-card-active comment-draft">
        <div class="comment-quote">
          <span class="comment-file">${escapeHtml(pendingDraft.file)}</span>
          <span class="comment-quote-text">“${escapeHtml(pendingDraft.quote)}”</span>
        </div>
        <div class="comment-actions comment-actions-col">
          <textarea id="commentDraftInput" class="comment-draft-input" rows="2" placeholder="Escribe un comentario… (Ctrl+Enter para enviar)">${escapeHtml(pendingDraft.text || "")}</textarea>
          <div class="comment-draft-btns">
            <button id="commentDraftCancel" class="comment-mini">Cancelar</button>
            <button id="commentDraftSave" class="comment-mini comment-primary">Comentar</button>
          </div>
        </div>
      </div>`;
  }

  /* pinta el panel completo. Un cambio remoto lo repinta, pero los
     borradores (pendingDraft / replyDrafts) sobreviven al repintado. */
  function render() {
    const body = $("commentsBody");
    if (!body) return;
    const all = threads();
    const shown = filter === "open" ? all.filter(x => !x.t.get("resolved")) : all;
    const openCount = all.filter(x => !x.t.get("resolved")).length;

    const badge = $("commentsCount");
    if (badge) {
      badge.textContent = openCount || "";
      badge.style.display = openCount ? "" : "none";
    }
    const fOpen = $("commentsFilterOpen"), fAll = $("commentsFilterAll");
    if (fOpen) fOpen.classList.toggle("on", filter === "open");
    if (fAll) fAll.classList.toggle("on", filter === "all");

    let html = pendingDraft ? draftHtml() : "";
    if (shown.length === 0 && !pendingDraft) {
      html += `<div class="comments-empty">${all.length
        ? "No hay comentarios sin resolver."
        : "Aún no hay comentarios. Selecciona texto en el editor y pulsa «💬 Comentar»."}</div>`;
    } else {
      html += shown.map(threadCardHtml).join("");
    }
    body.innerHTML = html;
    wireBody();
  }

  function cancelDraft() { pendingDraft = null; render(); refreshDeco(); }

  /* cablea los controles recién pintados (delegar sería más limpio, pero
     así queda cada input con su hilo sin buscar en el DOM padre) */
  function wireBody() {
    if (pendingDraft) {
      const save = $("commentDraftSave"), cancel = $("commentDraftCancel"), inp = $("commentDraftInput");
      if (inp) inp.oninput = () => { if (pendingDraft) pendingDraft.text = inp.value; };
      if (save) save.onclick = () => commitNewThread(inp.value);
      if (cancel) cancel.onclick = cancelDraft;
      if (inp) inp.onkeydown = e => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitNewThread(inp.value); }
      };
    }
    const body = $("commentsBody");
    body.querySelectorAll(".comment-quote").forEach(q => {
      const card = q.closest(".comment-card");
      const id = card && card.getAttribute("data-thread");
      if (id && !card.classList.contains("comment-draft")) q.onclick = () => focusThread(id);
    });
    body.querySelectorAll(".comment-resolve").forEach(b =>
      b.onclick = () => toggleResolved(b.getAttribute("data-thread")));
    body.querySelectorAll(".comment-del").forEach(b =>
      b.onclick = () => deleteThread(b.getAttribute("data-thread")));
    body.querySelectorAll(".comment-reply-input").forEach(inp => {
      const id = inp.getAttribute("data-thread");
      inp.oninput = () => replyDrafts.set(id, inp.value);
      inp.onkeydown = e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (inp.value.trim()) { reply(id, inp.value); }
        }
      };
    });
  }

  /* ------------------------------------------------ panel abrir/cerrar */
  const panel = () => $("commentsPanel");
  const split = () => $("splitComments");
  function openPanel() {
    panel().style.display = "flex";
    if (split()) split().style.display = "";
    window.dispatchEvent(new Event("resize"));
    render();
  }
  function closePanel() {
    panel().style.display = "none";
    if (split()) split().style.display = "none";
    window.dispatchEvent(new Event("resize"));
  }
  function toggle() {
    (panel().style.display === "none" || !panel().style.display) ? openPanel() : closePanel();
  }
  const isOpen = () => panel().style.display === "flex";

  /* ------------------------------------------------ ciclo de vida */
  function mount() {
    const m = ctx.getYComments();
    if (!m) return;
    unmount();               // por si quedaba algo de un proyecto anterior
    boundMap = m;
    observer = () => { render(); refreshDeco(); };
    m.observeDeep(observer);
    render();
    refreshDeco();
    // botones fijos del panel (una sola vez por proyecto)
    const fOpen = $("commentsFilterOpen"), fAll = $("commentsFilterAll"), close = $("commentsClose");
    if (fOpen) fOpen.onclick = () => { filter = "open"; render(); };
    if (fAll) fAll.onclick = () => { filter = "all"; render(); };
    if (close) close.onclick = () => closePanel();
  }

  function unmount() {
    if (observer && boundMap) { try { boundMap.unobserveDeep(observer); } catch (e) {} }
    observer = null; boundMap = null; activeThread = null;
    hideBubble();
    closePanel();
  }

  /* al cambiar de archivo activo: repintar resalte y ocultar burbuja */
  function onFileChanged() { hideBubble(); refreshDeco(); }

  return {
    editorExtension,
    mount, unmount, onFileChanged,
    toggle, open: openPanel, close: closePanel, isOpen,
    startCommentOnSelection,
    refreshBadge: () => render(),
  };
}
