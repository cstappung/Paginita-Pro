"use strict";
/* ============================================================
   ColabDraw — aplicación

   Tercera aplicación del sitio, hermana de ColabTeX: misma cuenta de
   Google, misma base de datos y el mismo proveedor de Yjs sobre
   Realtime Database. Un proyecto de dibujo es un proyecto normal con
   meta.kind = "draw", así que compartir, invitar, duplicar y borrar
   son EXACTAMENTE el mismo código y las reglas de seguridad no se
   tocan.

   Aquí solo está el pegamento: sesión, panel de proyectos, lista de
   dibujos y montaje del lienzo. El editor de verdad vive en draw/.
   ============================================================ */
import * as Y from "yjs";
import { watchAuth, loginGoogle, logout } from "./firebase.js";
import * as fb from "./fb-api.js";
import { RtdbProvider } from "./y-rtdb.js";
import { colorForUid, timeAgo, escapeHtml } from "./util.js";
import { DrawStore, Drawing, makeDrawing } from "./draw/doc.js";
import { svgToFragment } from "./draw/svgio.js";
import { Canvas } from "./draw/canvas.js";
import { Tools } from "./draw/tools.js";
import { createStylePanel } from "./draw/style.js";
import { createToolOptions } from "./draw/tool-options.js";
import { createObjectPanel } from "./draw/layers.js";
import { createTextEditor } from "./draw/text.js";
import { createFormulaEditor } from "./draw/formula-modal.js";
import { setMotorUrl } from "./draw/latex.js";
import { createAssetPreview, extOf } from "./draw/preview.js";
import { exportAll, download, outputName, exportSvg } from "./draw/export.js";
import { downloadProjectZip } from "./zip-export.js";
import { installErrorCapture } from "./reports.js";
import { createReportWidget } from "./report-widget.js";
import * as rep from "./fb-reports.js";

const $ = id => document.getElementById(id);

const state = {
  user: null,
  projects: [],
  filter: "all",
  search: "",
  project: null,
  token: null,
  role: null,
  ydoc: null,
  provider: null,
  store: null,
  path: null,          // dibujo abierto
  drawing: null,       // instancia Drawing
  canvas: null,
  tools: null,
  style: null,
  toolOpts: null,      // barra de opciones de la herramienta activa
  layers: null,        // árbol de objetos (creado en ensureEditorParts)
  textEd: null,        // editor de texto flotante
  formulaEd: null,     // cuadro de fórmulas LaTeX
  assetView: null,     // vista de un archivo generado
  openAsset: null,     // nombre del archivo que se está mirando
  activeLayerId: null, // capa donde va lo que se dibuje
  assets: [],
  membersUnsub: null,
  drawingsObserver: null,
  fragObserved: null,   // fragmento vigilado y su oyente, para poder soltarlos
  fragObserver: null,
  layerTimer: null,
  capture: null         // recogida de errores para el informe (reports.js)
};

const canWrite = () => state.role !== "view";

/* ================================================ enrutado */
function route() {
  const params = new URLSearchParams(location.search);
  const p = params.get("p");
  const t = params.get("t");
  if (p) openEditor(p, t);
  else showDashboard();
}

window.addEventListener("popstate", () => { teardownEditor(); route(); });

/* ================================================ sesión */
function showLogin() {
  $("viewDash").style.display = "none";
  $("viewEditor").style.display = "none";
  $("viewLogin").style.display = "grid";
  $("loginError").textContent = "";
}

async function doLogin() {
  $("loginError").textContent = "";
  try { await loginGoogle(); }
  catch (e) { $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message); }
}

/* ================================================ panel de proyectos */
async function showDashboard() {
  teardownEditor();
  $("viewLogin").style.display = "none";
  $("viewEditor").style.display = "none";
  $("viewDash").style.display = "flex";
  const u = state.user;
  $("dashUserName").textContent = u.name;
  const av = $("dashUserAvatar");
  if (u.photo) av.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">`;
  else { av.textContent = (u.name || "?").charAt(0).toUpperCase(); av.style.background = u.color; }

  $("projectRows").innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8a97a3">Cargando proyectos…</div>';
  try {
    const all = await fb.listProjects(u.uid);
    // cada aplicación enseña LOS SUYOS: mezclar .tex y dibujos confundiría
    state.projects = all.filter(p => p.kind === fb.KIND_DRAW);
  } catch (e) {
    state.projects = [];
    $("projectRows").innerHTML = `<div style="padding:16px;font-size:12.5px;color:#c0392b">Error al cargar proyectos: ${escapeHtml(e.message)}</div>`;
    return;
  }
  renderProjects();
}

function renderProjects() {
  const uid = state.user.uid;
  let list = state.projects;
  if (state.filter === "mine") list = list.filter(p => p.ownerId === uid);
  if (state.filter === "shared") list = list.filter(p => p.ownerId !== uid);
  if (state.search) list = list.filter(p => p.title.toLowerCase().includes(state.search.toLowerCase()));

  $("cntAll").textContent = state.projects.length;
  $("cntMine").textContent = state.projects.filter(p => p.ownerId === uid).length;
  $("cntShared").textContent = state.projects.filter(p => p.ownerId !== uid).length;
  for (const [id, f] of [["navAll", "all"], ["navMine", "mine"], ["navShared", "shared"]])
    $(id).classList.toggle("nav-active", state.filter === f);

  const rows = $("projectRows");
  rows.innerHTML = "";
  if (!list.length) {
    rows.innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8a97a3">Todavía no hay dibujos. Crea el primero con «Nuevo proyecto +».</div>';
  }
  for (const p of list) {
    const row = document.createElement("div");
    row.className = "proj-row";
    const shared = p.memberCount > 1 ? `<span class="proj-shared">⇄ ${p.memberCount - 1}</span>` : "";
    row.innerHTML = `
      <span class="proj-thumb">✎</span>
      <div class="proj-title-cell"><span class="proj-title">${escapeHtml(p.title)}</span>${shared}</div>
      <span class="proj-owner">${p.ownerId === uid ? "Tú" : escapeHtml(p.ownerName || "—")}</span>
      <span class="proj-modified">${timeAgo(p.updatedAt)}</span>
      <div class="proj-actions">
        <button class="icon-btn" data-act="zip" title="Descargar en .zip">⤓</button>
        <button class="icon-btn" data-act="dup" title="Duplicar">⧉</button>
        ${p.ownerId === uid ? '<button class="icon-btn" data-act="del" title="Eliminar">✕</button>' : ""}
      </div>`;
    row.querySelector(".proj-title").onclick = () => openProject(p.id);
    row.querySelector('[data-act="zip"]').onclick = e => {
      e.stopPropagation();
      zipProjectById(p, e.currentTarget);
    };
    row.querySelector('[data-act="dup"]').onclick = async e => {
      e.target.disabled = true;
      await fb.duplicateProject(p.id, { uid, userName: state.user.name });
      showDashboard();
    };
    const del = row.querySelector('[data-act="del"]');
    if (del) del.onclick = async () => {
      if (!confirm(`¿Eliminar el proyecto "${p.title}"? Esta acción no se puede deshacer.`)) return;
      await fb.deleteProject(p.id);
      showDashboard();
    };
    rows.appendChild(row);
  }
  $("projectCountLabel").textContent =
    `${list.length} proyecto${list.length === 1 ? "" : "s"} · dibujo vectorial en tu navegador`;
}

function openProject(id, token) {
  history.pushState({}, "", location.pathname + "?p=" + id + (token ? "&t=" + token : ""));
  openEditor(id, token);
}

async function newProject() {
  const title = prompt("Nombre del proyecto de dibujo:", "Figuras del artículo");
  if (!title) return;
  const pid = await fb.createProject({
    title, uid: state.user.uid, userName: state.user.name, kind: fb.KIND_DRAW,
    init: doc => { doc.getMap("drawings").set("figura1.svg", makeDrawing()); }
  });
  openProject(pid);
}

async function newProjectFromSvg(file) {
  if (!file) return;
  let frag;
  try { frag = svgToFragment(await file.text()); }
  catch (e) { alert("No se pudo importar el SVG: " + (e.message || e)); return; }
  const name = file.name.replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, "") || "importado.svg";
  const pid = await fb.createProject({
    title: name.replace(/\.svg$/i, ""), uid: state.user.uid, userName: state.user.name,
    kind: fb.KIND_DRAW,
    init: doc => { doc.getMap("drawings").set(name, frag); }
  });
  openProject(pid);
}

/* ================================================ editor */
async function openEditor(projectId, token) {
  $("viewLogin").style.display = "none";
  $("viewDash").style.display = "none";
  $("viewEditor").style.display = "flex";
  state.token = token || null;

  let project = null;
  try {
    if (token) await fb.joinWithToken(projectId, token, { uid: state.user.uid, userName: state.user.name });
    project = await fb.getProject(projectId, state.user.uid);
  } catch (e) { project = null; }

  if (!project || !project.role) {
    alert("No tienes acceso a este proyecto (o el enlace no es válido).");
    history.pushState({}, "", location.pathname);
    showDashboard();
    return;
  }
  if (project.kind !== fb.KIND_DRAW) {
    // un enlace de ColabTeX abierto aquí: se manda a su aplicación
    location.href = "colabtex.html?p=" + projectId + (token ? "&t=" + token : "");
    return;
  }

  state.project = project;
  state.role = project.role;
  const readOnly = !canWrite();

  $("edTitle").textContent = project.title;
  $("edTitle").title = readOnly ? project.title : "Clic para renombrar";
  $("readOnlyBadge").style.display = readOnly ? "" : "none";
  $("btnShare").style.display = readOnly ? "none" : "";
  $("btnNewDrawing").style.display = readOnly ? "none" : "";
  $("btnImportSvg").style.display = readOnly ? "none" : "";
  for (const id of ["btnLayerAdd", "btnLayerDel", "btnLayerUp", "btnLayerDown", "btnLayerMoveSel"])
    $(id).style.display = readOnly ? "none" : "";
  setSync("Conectando…", "#e2c08d");

  const ydoc = new Y.Doc();
  const provider = new RtdbProvider(projectId, ydoc, { readOnly });
  state.ydoc = ydoc;
  state.provider = provider;
  state.store = new DrawStore(ydoc, { readOnly });

  provider.awareness.setLocalStateField("user", {
    name: state.user.name, color: state.user.color, uid: state.user.uid
  });
  provider.on("status", ({ status }) =>
    setSync(status === "connected" ? "Guardado" : "Sin conexión", status === "connected" ? "#7ee0c2" : "#e57373"));
  provider.on("error", err => {
    setSync("✗ SIN GUARDAR en la nube", "#e57373");
    console.error("ColabDraw:", err);
  });
  provider.on("saved", () => {
    if ($("syncBadge").textContent.startsWith("✗")) return;
    setSync("Guardado", "#7ee0c2");
  });
  provider.awareness.on("change", renderPresence);

  let touchTimer = null;
  ydoc.on("update", (u, origin) => {
    if (origin !== provider) {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => fb.touchProject(projectId), 4000);
    }
  });

  ensureEditorParts();
  state.drawingsObserver = () => {
    renderFileList();
    // si el dibujo abierto lo borró otra persona, se salta al siguiente
    if (state.path && !state.store.has(state.path)) openDrawing(state.store.list()[0] || null);
  };
  state.store.map.observe(state.drawingsObserver);

  provider.once("synced", () => {
    renderFileList();
    openDrawing(state.path || state.store.list()[0] || null);
  });

  await refreshAssets();
  renderPresence();
}

function stopFragObserver() {
  if (state.fragObserved && state.fragObserver) {
    try { state.fragObserved.unobserveDeep(state.fragObserver); } catch (e) {}
  }
  clearTimeout(state.layerTimer);
  state.fragObserved = null;
  state.fragObserver = null;
}

function teardownEditor() {
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
  stopFragObserver();
  if (state.store && state.drawingsObserver) {
    try { state.store.map.unobserve(state.drawingsObserver); } catch (e) {}
  }
  state.drawingsObserver = null;
  if (state.assetView) state.assetView.hide();
  state.openAsset = null;
  if (state.canvas) state.canvas.detach();
  if (state.drawing) { state.drawing.destroy(); state.drawing = null; }
  if (state.provider) { state.provider.destroy(); state.provider = null; }
  if (state.ydoc) { state.ydoc.destroy(); state.ydoc = null; }
  state.store = null;
  state.path = null;
  state.project = null;
  state.role = null;
  state.assets = [];
}

/* Lienzo, herramientas y panel se crean UNA vez y se reutilizan entre
   proyectos: recrearlos dejaría oyentes de teclado sueltos. */
function ensureEditorParts() {
  if (state.canvas) return;
  state.canvas = new Canvas($("canvasHost"), { onViewChange: onViewChange });
  state.textEd = createTextEditor(state.canvas, {
    getDrawing: () => state.drawing,
    canWrite,
    /* Al cerrar, el <text> puede haber desaparecido (se quedó vacío) o
       haber cambiado de tamaño: hay que rehacer el recuadro. */
    onDone: el => {
      if (!state.tools) return;
      if (el) state.tools.select(el); else state.tools.clear();
      state.tools.redrawOverlay();
      state.style.refresh();
    }
  });
  /* El cuadro de fórmulas necesita saber en qué espacio nace la figura
     (la capa activa puede venir escalada de un SVG importado), y de eso
     ya sabe Tools: se le pregunta a él en vez de repetir la cuenta. */
  state.formulaEd = createFormulaEditor({
    getDrawing: () => state.drawing,
    getLayer: () => (state.drawing ? state.drawing.activeLayer(state.activeLayerId) : null),
    getEspacio: () => (state.tools
      ? state.tools._espacioDeCapa(state.drawing ? state.drawing.activeLayer(state.activeLayerId) : null)
      : null),
    getFill: () => (state.tools ? state.tools.textStyle.fill : null),
    canWrite,
    onDone: el => {
      if (!state.tools) return;
      if (el) state.tools.select(el); else state.tools.redrawOverlay();
      state.style.refresh();
      state.layers.render();
    }
  });
  state.tools = new Tools(state.canvas, {
    getDrawing: () => state.drawing,
    canWrite,
    /* El árbol marca lo elegido y despliega la rama donde está, así que
       también tiene que enterarse de lo que se selecciona en el lienzo. */
    onSelectionChange: () => {
      if (state.style) state.style.refresh();
      // pintar algo también cambia lo que usará la próxima figura
      if (state.toolOpts) state.toolOpts.render();
      if (state.layers) state.layers.render();
    },
    getLayer: () => (state.drawing ? state.drawing.activeLayer(state.activeLayerId) : null),
    /* Con elemento se edita ese rótulo; sin él viene la ficha de uno que
       todavía no existe y que solo nacerá si se escribe algo. */
    onEditText: (el, spec) => (el ? state.textEd.open(el) : state.textEd.openNew(spec)),
    onEditFormula: (el, spec) => (el ? state.formulaEd.open(el) : state.formulaEd.openNew(spec)),
    onStatus: msg => { $("statusMsg").textContent = msg || ""; },
    onToolChange: name => {
      document.querySelectorAll("#toolRail [data-tool]").forEach(b =>
        b.classList.toggle("tool-active", b.dataset.tool === name));
      // la sección TEXTO del panel aparece con la herramienta en la mano
      if (state.style) state.style.refresh();
      /* Lo que antes se explicaba en la barra de estado lo dice ahora la
         barra de opciones, que está donde se mira: encima del lienzo. */
      if (state.toolOpts) state.toolOpts.render();
      $("statusMsg").textContent = "";
    }
  });
  state.style = createStylePanel($("stylePanel"), {
    getSelection: () => (state.tools ? state.tools.selection() : []),
    getStyle: () => (state.tools ? state.tools.style : {}),
    getTextStyle: () => (state.tools ? state.tools.textStyle : {}),
    getScale: () => (state.tools ? state.tools.selectionScale() : 1),
    isTextTool: () => !!state.tools && state.tools.tool === "text",
    getPage: () => (state.drawing ? state.drawing.size() : { w: 0, h: 0 }),
    canWrite,
    onApply: attrs => state.tools.applyStyle(attrs),
    onOrder: mode => state.tools.reorder(mode),
    onPage: setPageSize
  });
  /* La barra de la herramienta activa: flota sobre el lienzo y solo
     aparece con una herramienta de dibujo en la mano. */
  state.toolOpts = createToolOptions($("toolOptions"), {
    getTool: () => (state.tools ? state.tools.tool : "select"),
    getStyle: () => (state.tools ? state.tools.style : {}),
    getTextStyle: () => (state.tools ? state.tools.textStyle : {}),
    getCrear: () => (state.tools ? state.tools.crear : {}),
    setCrear: o => { if (state.tools) state.tools.setCrear(o); },
    getScale: () => (state.tools ? state.tools.selectionScale() : 1),
    canWrite,
    onApply: attrs => state.tools.applyStyle(attrs),
    getPage: () => (state.drawing ? state.drawing.size() : { w: 0, h: 0 }),
    onPage: setPageSize,
    onExit: () => { if (state.tools) state.tools.setTool("select"); }
  });
  state.assetView = createAssetPreview($("canvasHost").parentNode, {
    onClose: () => { state.openAsset = null; renderFileList(); },
    onDownload: a => download(a.bytes, a.name)
  });
  state.layers = createObjectPanel($("layerPanel"), {
    getDrawing: () => state.drawing,
    getActiveId: () => state.activeLayerId,
    setActiveId: id => { state.activeLayerId = id; },
    canWrite,
    getSelection: () => (state.tools ? state.tools.selection() : []),
    setSelection: els => { if (state.tools) state.tools.select(els); },
    getCanvas: () => state.canvas,
    onStatus: msg => { $("statusMsg").textContent = msg || ""; },
    /* Las operaciones de capa clonan y borran, así que la selección
       apunta a nodos que ya no existen: se rehace por id igual que en
       el orden Z. */
    onChange: ids => {
      if (state.tools) {
        if (ids && ids.length) state.tools.reselectByIds(ids);
        else state.tools.clear();
      }
      state.layers.render();
      state.style.refresh();
    }
  });
}

/* El tamaño del papel se pide desde dos sitios (el panel de la derecha y
   la barra de la herramienta ⛶) y las dos tienen que enterarse. */
function setPageSize(w, h) {
  if (!state.drawing) return;
  state.drawing.setSize(w, h);
  state.canvas.refreshPage();
  state.tools.redrawOverlay();       // el marco de recorte sigue al papel
  state.style.refresh();
  if (state.toolOpts) state.toolOpts.render();
}

function onViewChange() {
  if (state.canvas) $("zoomLabel").textContent = Math.round(state.canvas.k / 3.7795 * 100) + "%";
  // el editor de texto flota en píxeles: con el zoom o el encuadre se mueve
  if (state.textEd && state.textEd.isOpen()) state.textEd.reposition();
  paintUndoButtons();
}

function paintUndoButtons() {
  const d = state.drawing;
  $("btnUndo").disabled = !d || !d.canUndo();
  $("btnRedo").disabled = !d || !d.canRedo();
}

function setSync(text, color) {
  const b = $("syncBadge");
  b.textContent = text;
  b.style.color = color;
}

/* ---------- lista de archivos del proyecto ----------
   Los dibujos y lo exportado van en la MISMA lista: un PNG generado es
   un archivo del proyecto igual que el .svg del que salió, y tenerlo
   apartado en una esquina obligaba a buscarlo. */
function renderFileList() {
  const host = $("fileList");
  host.innerHTML = "";
  if (!state.store) return;
  const readOnly = !canWrite();
  const list = state.store.list();
  if (!list.length) {
    host.innerHTML = '<div style="padding:10px;font-size:11.5px;color:#8a97a3">No hay dibujos todavía.</div>';
  }
  for (const path of list) {
    const div = document.createElement("div");
    div.className = "dw-item" + (path === state.path && !state.openAsset ? " dw-item-active" : "");
    div.title = path;
    div.innerHTML = `<span class="dw-ico">✎</span>
      <span class="dw-item-name">${escapeHtml(path)}</span>
      ${readOnly ? "" : `<button class="file-act" data-act="ren" title="Renombrar">✎</button>
      <button class="file-act" data-act="dup" title="Duplicar">⧉</button>
      <button class="file-act file-del" data-act="del" title="Eliminar">✕</button>`}`;
    div.onclick = () => openDrawing(path);
    const act = (name, fn) => {
      const b = div.querySelector(`[data-act="${name}"]`);
      if (b) b.onclick = e => { e.stopPropagation(); fn(); };
    };
    act("ren", () => {
      const next = normalizeName(prompt("Nuevo nombre del dibujo:", path));
      if (!next || next === path) return;
      if (state.store.has(next)) { alert("Ya existe un dibujo con ese nombre."); return; }
      const wasOpen = state.path === path;
      if (state.store.rename(path, next) && wasOpen) openDrawing(next);
      renderFileList();
    });
    act("dup", () => {
      const name = state.store.duplicate(path);
      if (name) openDrawing(name);
    });
    act("del", () => {
      if (!confirm(`¿Eliminar el dibujo "${path}"? Esta acción no se puede deshacer.`)) return;
      state.store.delete(path);
      if (state.path === path) openDrawing(state.store.list()[0] || null);
      renderFileList();
    });
    host.appendChild(div);
  }

  if (!state.assets.length) return;
  const sep = document.createElement("div");
  sep.className = "dw-sep";
  sep.textContent = "GENERADOS";
  host.appendChild(sep);

  for (const a of state.assets) {
    const div = document.createElement("div");
    div.className = "dw-item" + (state.openAsset === a.name ? " dw-item-active" : "");
    div.title = `${a.name} — pulsa para verlo`;
    div.innerHTML = `<span class="dw-ico">${ICONO[extOf(a.name)] || "📄"}</span>
      <span class="dw-item-name">${escapeHtml(a.name)}</span>
      <span class="dw-size">${Math.max(1, Math.round((a.size || 0) / 1024))} kB</span>
      ${readOnly ? "" : '<button class="file-act file-del" data-act="del" title="Eliminar">✕</button>'}`;
    div.onclick = () => showAsset(a);
    const del = div.querySelector('[data-act="del"]');
    if (del) del.onclick = async e => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar "${a.name}" del proyecto?`)) return;
      try { await fb.deleteAsset(state.project.id, a); } catch (err) { alert("No se pudo eliminar: " + (err.message || err)); }
      if (state.openAsset === a.name) state.assetView.hide();
      await refreshAssets();
    };
    host.appendChild(div);
  }
}

const ICONO = { png: "🖼", jpg: "🖼", jpeg: "🖼", svg: "◇", pdf: "📕" };

/* Mirar un archivo generado en el sitio del lienzo, en vez de bajarlo a
   ciegas: la descarga es un botón de la propia vista. */
async function showAsset(a) {
  if (!state.project) return;
  $("statusMsg").textContent = `Abriendo ${a.name}…`;
  try {
    const bytes = await fb.fetchAssetBytes(state.project.id, a);
    state.openAsset = a.name;
    state.assetView.show({ name: a.name, bytes });
    renderFileList();
    $("statusMsg").textContent = "";
  } catch (e) {
    $("statusMsg").textContent = "";
    alert("No se pudo abrir: " + (e.message || e));
  }
}

const normalizeName = raw => {
  const s = String(raw || "").trim().replace(/[\\/]/g, "-");
  if (!s || s.startsWith(".")) return "";
  return /\.svg$/i.test(s) ? s : s + ".svg";
};

function openDrawing(path) {
  // lo que se estuviera escribiendo se guarda en SU dibujo, no en el otro
  if (state.textEd && state.textEd.isOpen()) state.textEd.close();
  if (state.formulaEd && state.formulaEd.isOpen()) state.formulaEd.close();
  if (state.assetView) state.assetView.hide();     // vuelve a verse el lienzo
  if (state.layers) state.layers.reset();          // otro dibujo, otro árbol
  stopFragObserver();
  if (state.drawing) { state.drawing.destroy(); state.drawing = null; }
  state.path = path;
  if (!path || !state.store || !state.store.has(path)) {
    state.canvas.detach();
    $("emptyCanvas").style.display = "grid";
    renderFileList();
    paintUndoButtons();
    return;
  }
  $("emptyCanvas").style.display = "none";
  state.drawing = new Drawing(state.ydoc, state.store.get(path), { readOnly: !canWrite() });
  state.canvas.attach(state.drawing);
  state.canvas.fitPage();
  state.tools.clear();
  state.tools.setTool("select");
  if (state.drawing.undoMgr) state.drawing.undoMgr.on("stack-item-added", paintUndoButtons);
  /* Si otra persona añade, renombra u oculta una capa, el panel tiene
     que enterarse igual que el lienzo. Se guarda para poder quitarlo:
     `drawing.destroy()` solo cierra el deshacer, así que sin esto cada
     apertura dejaba un observador vivo sobre el MISMO fragmento y el
     panel se repintaba una vez por dibujo abierto en toda la sesión. */
  state.fragObserved = state.drawing.frag;
  state.fragObserver = () => {
    clearTimeout(state.layerTimer);
    state.layerTimer = setTimeout(() => state.layers.render(), 80);
  };
  state.fragObserved.observeDeep(state.fragObserver);
  renderFileList();
  state.activeLayerId = null;      // cada dibujo trae sus propias capas
  state.layers.render();
  state.style.refresh();
  state.toolOpts.render();         // el papel de este dibujo, no el del anterior
  paintUndoButtons();
}

function newDrawing() {
  if (!state.store || !canWrite()) return;
  let n = state.store.list().length + 1;
  let name = `figura${n}.svg`;
  while (state.store.has(name)) name = `figura${++n}.svg`;
  const next = normalizeName(prompt("Nombre del nuevo dibujo:", name));
  if (!next) return;
  if (state.store.has(next)) { alert("Ya existe un dibujo con ese nombre."); return; }
  state.store.create(next);
  openDrawing(next);
}

async function importSvgAsDrawing(file) {
  if (!file || !state.store || !canWrite()) return;
  let frag;
  try { frag = svgToFragment(await file.text()); }
  catch (e) { alert("No se pudo importar el SVG: " + (e.message || e)); return; }
  let name = normalizeName(file.name) || "importado.svg";
  let n = 2;
  while (state.store.has(name)) name = normalizeName(file.name.replace(/\.svg$/i, "") + ` (${n++})`);
  state.store.put(name, frag);
  openDrawing(name);
}

/* ---------- presencia ---------- */
function renderPresence() {
  const host = $("presenceAvatars");
  if (!host || !state.provider) return;
  host.innerHTML = "";
  const seen = new Set();
  for (const [, st] of state.provider.awareness.getStates()) {
    const u = st && st.user;
    if (!u || !u.uid || seen.has(u.uid)) continue;
    seen.add(u.uid);
    const dot = document.createElement("span");
    dot.className = "pres-dot";
    dot.style.background = u.color || "#6c4bb6";
    dot.textContent = (u.name || "?").charAt(0).toUpperCase();
    dot.title = u.name || "";
    host.appendChild(dot);
  }
}

/* ---------- recursos generados ---------- */
async function refreshAssets() {
  if (!state.project) return;
  try { state.assets = await fb.listAssets(state.project.id); }
  catch (e) { state.assets = []; }
  renderFileList();
}

/* Descargar un proyecto SIN abrirlo, desde el panel. Su documento no
   está cargado, así que se levanta uno de usar y tirar con el mismo
   proveedor de siempre y se cierra al terminar: escribir un lector
   aparte del formato de Yjs en Realtime Database sería copiar
   y-rtdb.js entero. */
async function zipProjectById(p, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  const ydoc = new Y.Doc();
  const provider = new RtdbProvider(p.id, ydoc, { readOnly: true });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("el proyecto tardó demasiado en cargar")), 25000);
      provider.once("synced", () => { clearTimeout(t); resolve(); });
      provider.on("error", err => { clearTimeout(t); reject(err); });
    });
    const store = new DrawStore(ydoc, { readOnly: true });
    const assets = await fb.listAssets(p.id).catch(() => []);
    await downloadProjectZip(p.title, async () => {
      const entries = [];
      for (const path of store.list()) {
        const d = new Drawing(ydoc, store.get(path), { readOnly: true });
        try { entries.push({ path, bytes: exportSvg(d) }); } catch (e) {}
        d.destroy();
      }
      for (const a of assets) {
        try { entries.push({ path: "generados/" + a.name, bytes: await fb.fetchAssetBytes(p.id, a) }); }
        catch (e) { console.warn("ColabDraw: no se pudo empaquetar " + a.name, e); }
      }
      return entries;
    });
  } catch (e) {
    alert("No se pudo descargar el proyecto: " + (e.message || e));
  } finally {
    provider.destroy();
    ydoc.destroy();
    if (btn) { btn.disabled = false; btn.textContent = "⤓"; }
  }
}

/* ---------- todo el proyecto en un .zip ----------
   Los dibujos se serializan en el momento (el .svg de verdad no existe
   hasta que se pide) y lo generado se baja de Storage uno a uno. */
async function zipProject() {
  if (!state.store) return;
  const btn = $("btnZipProject");
  btn.disabled = true;
  try {
    const r = await downloadProjectZip(state.project.title, async () => {
      const entries = [];
      for (const path of state.store.list()) {
        const d = new Drawing(state.ydoc, state.store.get(path), { readOnly: true });
        try { entries.push({ path, bytes: exportSvg(d) }); } catch (e) {}
        d.destroy();
      }
      for (const a of state.assets) {
        try { entries.push({ path: "generados/" + a.name, bytes: await fb.fetchAssetBytes(state.project.id, a) }); }
        catch (e) { console.warn("ColabDraw: no se pudo empaquetar " + a.name, e); }
      }
      return entries;
    }, { onStep: m => { $("statusMsg").textContent = m; } });
    $("statusMsg").textContent = `${r.count} archivos en el .zip.`;
  } catch (e) {
    $("statusMsg").textContent = "";
    alert("No se pudo crear el .zip: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

/* ---------- exportar ---------- */
function openExportModal() {
  if (!state.drawing) { alert("Abre un dibujo primero."); return; }
  $("expName").textContent = `Dibujo: ${state.path}`;
  $("expMsg").textContent = "";
  $("expModal").classList.add("open");
}

async function doExport() {
  const btn = $("btnExportDo");
  const msg = $("expMsg");
  const formats = [];
  if ($("expSvg").checked) formats.push("svg");
  if ($("expPng").checked) formats.push("png");
  if (!formats.length) { msg.style.color = "#c0392b"; msg.textContent = "Elige al menos un formato."; return; }
  const save = $("expSave").checked && canWrite();
  const grab = $("expDownload").checked;
  if (!save && !grab) { msg.style.color = "#c0392b"; msg.textContent = "Elige un destino: el proyecto, tu equipo, o los dos."; return; }

  btn.disabled = true;
  msg.style.color = "#5a6772";
  msg.textContent = "Exportando…";
  try {
    const out = await exportAll(state.drawing, state.path, {
      formats,
      dpi: parseInt($("expDpi").value, 10) || 300,
      /* Sin fondo, un PNG con rótulos negros desaparece sobre cualquier
         diapositiva oscura; en un artículo da igual, pero el que se lleva
         la sorpresa no lo sabe hasta que la ve. */
      background: $("expWhite").checked ? "#ffffff" : null,
      // que el .svg generado no se llame igual que el dibujo del que sale
      avoid: new Set(state.store ? state.store.list() : []),
      upload: save ? ((name, bytes) => fb.uploadAsset(state.project.id, name, bytes)) : null
    });
    if (grab) for (const f of out) download(f.bytes, f.name);
    if (save) await refreshAssets();
    msg.style.color = "#0d9488";
    msg.textContent = `Listo: ${out.map(f => f.name).join(", ")}.`;
    /* Se enseña lo recién generado sin tener que ir a buscarlo: es lo
       primero que se quiere ver después de exportar. */
    if (save && out.length) {
      $("expModal").classList.remove("open");
      state.openAsset = out[0].name;
      state.assetView.show({ name: out[0].name, bytes: out[0].bytes });
      renderFileList();
    }
  } catch (e) {
    msg.style.color = "#c0392b";
    msg.textContent = "No se pudo exportar: " + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- compartir ---------- */
const shareLink = token => `${location.origin}${location.pathname}?p=${state.project.id}&t=${token}`;

function openShareModal() {
  const t = state.project.tokens;
  if (!t) return;
  $("shareEditLink").value = shareLink(t.edit);
  $("shareViewLink").value = shareLink(t.view);
  $("shareModal").classList.add("open");
  if (state.membersUnsub) state.membersUnsub();
  state.membersUnsub = fb.watchMembers(state.project.id, members => {
    const host = $("shareMembers");
    host.innerHTML = "";
    for (const m of members) {
      const row = document.createElement("div");
      row.className = "member-row";
      const role = m.role === "owner" ? "Propietario" : m.role === "edit" ? "Puede editar" : "Solo lectura";
      row.innerHTML = `<span style="flex:1">${escapeHtml(m.name || "—")}</span>
        <span style="font-size:11.5px;color:#8a97a3">${role}</span>`;
      host.appendChild(row);
    }
  });
}

function closeShareModal() {
  $("shareModal").classList.remove("open");
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = old; }, 1400);
  }).catch(() => {});
}

/* ================================================ cableado */
function wireEvents() {
  $("btnGoogleLogin").onclick = doLogin;
  $("btnLogout").onclick = () => logout();
  $("btnBackDash").onclick = () => {
    history.pushState({}, "", location.pathname);
    teardownEditor();
    showDashboard();
  };
  $("btnNewProject").onclick = () => newProject().catch(e => alert("No se pudo crear: " + (e.message || e)));
  $("btnNewFromSvg").onclick = () => $("svgNewInput").click();
  $("svgNewInput").onchange = e => {
    const f = e.target.files[0];
    e.target.value = "";
    newProjectFromSvg(f).catch(err => alert("No se pudo importar: " + (err.message || err)));
  };
  $("searchInput").oninput = e => { state.search = e.target.value; renderProjects(); };
  for (const [id, f] of [["navAll", "all"], ["navMine", "mine"], ["navShared", "shared"]])
    $(id).onclick = () => { state.filter = f; renderProjects(); };

  $("edTitle").onclick = async () => {
    if (!canWrite()) return;
    const next = prompt("Nombre del proyecto:", state.project.title);
    if (!next || next === state.project.title) return;
    await fb.renameProject(state.project.id, next);
    state.project.title = next;
    $("edTitle").textContent = next;
  };

  document.querySelectorAll("#toolRail [data-tool]").forEach(b => {
    b.onclick = () => state.tools && state.tools.setTool(b.dataset.tool);
  });
  $("btnGroup").onclick = () => state.tools && state.tools.group();
  $("btnUngroup").onclick = () => state.tools && state.tools.ungroup();
  $("btnDuplicate").onclick = () => state.tools && state.tools.duplicateSelection();
  $("btnDelete").onclick = () => state.tools && state.tools.deleteSelection();
  $("btnZoomFit").onclick = () => { if (state.canvas) { state.canvas.fitPage(); state.tools.redrawOverlay(); } };
  $("btnUndo").onclick = () => { if (state.drawing) { state.drawing.undo(); state.tools.redrawOverlay(); paintUndoButtons(); } };
  $("btnRedo").onclick = () => { if (state.drawing) { state.drawing.redo(); state.tools.redrawOverlay(); paintUndoButtons(); } };

  $("btnNewDrawing").onclick = newDrawing;
  $("btnZipProject").onclick = zipProject;
  $("btnLayerAdd").onclick = () => state.layers.add();
  $("btnLayerDel").onclick = () => state.layers.removeActive();
  $("btnLayerUp").onclick = () => state.layers.move("up");
  $("btnLayerDown").onclick = () => state.layers.move("down");
  $("btnLayerMoveSel").onclick = () => state.layers.moveSelection();
  $("btnImportSvg").onclick = () => $("svgImportInput").click();
  $("svgImportInput").onchange = e => {
    const f = e.target.files[0];
    e.target.value = "";
    importSvgAsDrawing(f);
  };

  $("gridToggle").onchange = e => state.canvas && state.canvas.setGrid({ show: e.target.checked });
  $("snapToggle").onchange = e => state.canvas && state.canvas.setGrid({ snap: e.target.checked });
  $("gridStep").onchange = e => {
    const v = parseFloat(e.target.value);
    if (v > 0 && state.canvas) state.canvas.setGrid({ step: v });
  };

  $("btnExport").onclick = openExportModal;
  $("btnExportDo").onclick = doExport;
  $("btnExportClose").onclick = () => $("expModal").classList.remove("open");
  $("expModal").onclick = e => { if (e.target === $("expModal")) $("expModal").classList.remove("open"); };

  $("btnShare").onclick = openShareModal;
  $("btnShareClose").onclick = closeShareModal;
  $("shareModal").onclick = e => { if (e.target === $("shareModal")) closeShareModal(); };
  $("btnCopyEdit").onclick = e => copyToClipboard($("shareEditLink").value, e.target);
  $("btnCopyView").onclick = e => copyToClipboard($("shareViewLink").value, e.target);

  window.addEventListener("resize", () => { if (state.tools) state.tools.redrawOverlay(); });
  window.addEventListener("pagehide", e => {
    if (!e.persisted && state.provider) state.provider.destroy();
  });
}

/* ================================================ informes */
const VER_PAGINA = (document.currentScript && document.currentScript.src.split("?v=")[1]) || "";

/* Qué se estaba haciendo cuando algo se rompió: es lo que permite
   reproducirlo, más que la pila de un paquete minificado. */
function dondeEstamos() {
  if (!state.project) return "el panel de proyectos";
  const t = state.tools ? state.tools.tool : "";
  return `dibujar (${state.path || "sin dibujo"}${t ? ", herramienta " + t : ""})`;
}

/* ================================================ arranque */
(function boot() {
  /* El motor de fórmulas se sirve con la MISMA versión que la página:
     es un archivo generado por la misma compilación, así que un `?v=`
     distinto solo conseguiría que el navegador se guardara dos copias
     —y una de ellas, vieja. */
  setMotorUrl("colabdraw-math.js" + (VER_PAGINA ? "?v=" + VER_PAGINA : ""));

  state.capture = installErrorCapture({
    app: "colabdraw", ver: VER_PAGINA, getDonde: dondeEstamos,
    publicar: rec => { if (state.user) rep.publishError(rec, state.user.uid).catch(() => {}); }
  });
  createReportWidget({
    app: "colabdraw", ver: VER_PAGINA, capture: state.capture,
    getUser: () => state.user,
    enviar: (r, u) => rep.sendFeedback(r, { uid: u.uid, userName: u.name })
  });

  wireEvents();
  watchAuth(async user => {
    if (!user) { state.user = null; showLogin(); return; }
    state.user = {
      uid: user.uid,
      name: user.displayName || user.email || "Usuario",
      photo: user.photoURL || "",
      color: colorForUid(user.uid)
    };
    try { await fb.ensureUserRecord(user, state.user.color); } catch (e) {}
    route();
  });
})();
