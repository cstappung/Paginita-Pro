"use strict";
/* ============================================================
   ColabTeX — aplicación cliente (100% estática + Firebase)
   Login con Google + dashboard + editor colaborativo
   (Yjs sobre Realtime Database) + compilación LaTeX en el
   navegador (BusyTeX WASM) + visor PDF.
   ============================================================ */
import * as Y from "yjs";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { setDiagnostics, lintGutter } from "@codemirror/lint";
import { defaultKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";

import { watchAuth, loginGoogle, logout } from "./firebase.js";
import * as fb from "./fb-api.js";
import { RtdbProvider } from "./y-rtdb.js";
import { colorForUid, colorLight, timeAgo, escapeHtml, minimalDiff } from "./util.js";
import { LatexEngine, summarizeLog } from "./latex.js";
import { PdfViewer } from "./pdfview.js";
import { createAssistant } from "./ai-assistant.js";
import { createComments } from "./comments.js";
import { readZip, foldersOf, titleFromZip, TEXT_EXT } from "./zip-import.js";
import { downloadProjectZip } from "./zip-export.js";
import { createLinks, linkedAssets, ensureAccess, isLinked, slugTitle, LINK_DIR } from "./draw-link.js";
import { initLayout } from "./layout.js";
import * as lfs from "./local-fs.js";
import { SyncTex } from "./synctex.js";
import { parseTexLog, groupByFile } from "./texlog.js";
import { THEMES, themeName, saveThemeName, cmThemeFor, cmHighlightFor, applyCssVars } from "./themes.js";
import { loadKatex, visualExtensions } from "./visual.js";
import { createBridge, vscodeUrl, applyTextToY } from "./bridge.js";
import { baseName, parentOf, joinPath, isInside, movedPath, moveProblem, rewriteReferences, createTreeDnD } from "./file-move.js";
import { AssetPreview } from "./asset-preview.js";
import { createFormatBar, xcolorPatch } from "./format.js";

const $ = id => document.getElementById(id);
const ROLE_LABEL = { owner: "Propietario", edit: "Puede editar", view: "Solo lectura" };
/* preferencia de archivo principal por carpeta local (no hay nube donde guardarla) */
const LOCAL_MAIN_PREFIX = "colabtex_local_main_";

/* ---------- plantilla de proyecto nuevo ---------- */
const TEMPLATE_MAIN = `% Creado con ColabTeX
\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[spanish]{babel}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{TITLE}
\\author{AUTHOR}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Escribe aquí el resumen del documento.
\\end{abstract}

\\section{Introducción}
Bienvenido a ColabTeX. Este documento se compila con pdfTeX
ejecutándose íntegramente en tu navegador.

La distorsión armónica total (THD) se define como
\\begin{equation}
  \\mathrm{THD} = \\frac{\\sqrt{\\sum_{h=2}^{N} V_h^2}}{V_1}
  \\label{eq:thd}
\\end{equation}
donde $V_h$ es el valor eficaz del armónico $h$-ésimo.

\\section{Metodología}
Edita este archivo e invita a colaboradores con el botón
\\textbf{Compartir}. Los cambios se sincronizan en tiempo real.

\\end{document}
`;

const TEMPLATE_BIB = `@article{ejemplo2026,
  author  = {Apellido, Nombre},
  title   = {Un artículo de ejemplo},
  journal = {Revista de Ejemplos},
  year    = {2026},
  volume  = {1},
  pages   = {1--10}
}
`;

/* ------------------------------------------------ estado global */
const state = {
  user: null,           // {uid, name, color, photo}
  projects: [],
  filter: "all",
  search: "",
  // editor
  project: null,
  token: null,
  role: null,
  ydoc: null,
  provider: null,
  yFiles: null,
  yFolders: null,        // Y.Map: ruta de carpeta → true (carpetas vacías)
  yComments: null,       // Y.Map: id → hilo de comentario (solo nube)
  comments: null,        // panel/gestor de comentarios (creado en boot)
  collapsed: new Set(),  // carpetas plegadas (solo UI local)
  dnd: null,             // arrastrar y soltar del árbol (creado en boot)
  uploadPrefix: "",      // carpeta destino de la próxima subida
  activeFile: null,
  editorView: null,
  assets: [],           // propios + los de los proyectos de dibujo vinculados
  ownAssets: [],        // solo los de ESTE proyecto
  linked: [],           // solo los vinculados (loc: "link")
  linkedInfo: [],       // los vínculos a los que de verdad hay acceso
  links: null,          // Y.Map de vínculos (draw-link.js)
  linksUnobserve: null,
  linkWatchers: [],     // para dejar de escuchar los índices vinculados
  assetCache: new Map(), // key+size → bytes (evita re-descargar al compilar)
  preview: null,         // vista previa de imágenes/PDF (creada en boot)
  format: null,          // barra de negrita/cursiva/subrayado/color (creada en boot)
  engine: null,
  pdfViewer: null,
  compiling: false,
  membersUnsub: null,
  assistant: null,       // panel de IA (creado en boot)
  bridge: null,          // puente con una carpeta del disco (botón «VS Code»)
  lastCompile: null,     // {ok, errors[], warnings[]} para el asistente
  // ---- modo LOCAL (carpeta del disco, sin nube) ----
  mode: "cloud",         // "cloud" | "local"
  dirHandle: null,       // FileSystemDirectoryHandle de la carpeta abierta
  localContent: new Map(), // ruta → texto (espejo en memoria del disco)
  localHandles: new Map(), // ruta → FileSystemFileHandle (archivos de texto)
  localFolders: new Set(),
  dirty: new Set(),      // rutas pendientes de escribir a disco
  saveTimer: null,
  // ---- sincronía código ↔ PDF y diagnósticos ----
  syncTex: null,         // instancia de SyncTex de la última compilación
  diagnostics: null,     // Map archivo → [items] del último log
  suppressSync: false    // evita que el salto PDF→código dispare el inverso
};

/* ================================================ enrutado */
function route() {
  const params = new URLSearchParams(location.search);
  const p = params.get("p");
  const t = params.get("t");
  // ?local=1 solo es válido con una carpeta ya abierta (los handles no viven en la URL)
  if (params.get("local")) {
    if (state.mode === "local" && state.dirHandle) return;
    history.replaceState({}, "", location.pathname);
    showDashboard();
    return;
  }
  if (p) openEditor(p, t);
  else showDashboard();
}

window.addEventListener("popstate", () => { teardownEditor(); route(); });

/* ================================================ login */
function showLogin() {
  $("viewDash").style.display = "none";
  $("viewEditor").style.display = "none";
  $("viewLogin").style.display = "grid";
  $("loginError").textContent = "";
  if (!lfs.isSupported()) {
    $("btnLocalNoAccount").disabled = true;
    $("localLoginNote").textContent = "Abrir carpetas locales requiere Chrome, Edge u Opera de escritorio (tu navegador no lo permite).";
  }
}

async function doLogin() {
  $("loginError").textContent = "";
  try {
    await loginGoogle();
    // watchAuth se encarga del resto
  } catch (e) {
    $("loginError").textContent = "No se pudo iniciar sesión: " + (e.code || e.message);
  }
}

/* ================================================ dashboard */
async function showDashboard() {
  teardownEditor();
  $("viewLogin").style.display = "none";
  $("viewEditor").style.display = "none";
  $("viewDash").style.display = "flex";
  const u = state.user;
  $("dashUserName").textContent = u.name;
  const av = $("dashUserAvatar");
  if (u.photo) av.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  else { av.textContent = (u.name || "?").charAt(0).toUpperCase(); av.style.background = u.color; }
  renderLocalRecents();
  $("projectRows").innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8a97a3">Cargando proyectos…</div>';
  try {
    // cada aplicación lista los suyos: los dibujos viven en ColabDraw
    const all = await fb.listProjects(u.uid);
    state.projects = all.filter(p => p.kind !== fb.KIND_DRAW);
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
  for (const [id, f] of [["navAll", "all"], ["navMine", "mine"], ["navShared", "shared"]]) {
    $(id).classList.toggle("nav-active", state.filter === f);
  }

  const rows = $("projectRows");
  rows.innerHTML = "";
  if (list.length === 0) {
    rows.innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8a97a3">No hay proyectos todavía. Crea el primero con «Nuevo proyecto +».</div>';
  }
  for (const p of list) {
    const row = document.createElement("div");
    row.className = "proj-row";
    const sharedBadge = p.memberCount > 1 ? `<span class="proj-shared" title="Compartido">⇄ ${p.memberCount - 1}</span>` : "";
    row.innerHTML = `
      <span></span>
      <div class="proj-title-cell">
        <span class="proj-title">${escapeHtml(p.title)}</span>${sharedBadge}
      </div>
      <span class="proj-owner">${p.ownerId === uid ? "Tú" : escapeHtml(p.ownerName || "—")}</span>
      <span class="proj-modified">${timeAgo(p.updatedAt)}</span>
      <div class="proj-actions">
        <button class="icon-btn" data-act="dup" title="Duplicar">⧉</button>
        ${p.ownerId === uid ? '<button class="icon-btn" data-act="del" title="Eliminar">✕</button>' : ""}
      </div>`;
    row.querySelector(".proj-title").onclick = () => openProject(p.id);
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
  $("projectCountLabel").textContent = `${list.length} proyecto${list.length === 1 ? "" : "s"} · Firebase + compilación en tu navegador`;
}

function openProject(id, token) {
  const q = "?p=" + id + (token ? "&t=" + token : "");
  history.pushState({}, "", location.pathname + q);
  openEditor(id, token);
}

/* ================================================ editor */
async function openEditor(projectId, token) {
  $("viewLogin").style.display = "none";
  $("viewDash").style.display = "none";
  $("viewEditor").style.display = "flex";
  state.token = token || null;

  let project = null;
  try {
    if (token) {
      await fb.joinWithToken(projectId, token, { uid: state.user.uid, userName: state.user.name });
    }
    project = await fb.getProject(projectId, state.user.uid);
  } catch (e) {
    project = null;
  }
  if (!project || !project.role) {
    alert("No tienes acceso a este proyecto (o el enlace no es válido).");
    history.pushState({}, "", location.pathname);
    showDashboard();
    return;
  }
  if (project.kind === fb.KIND_DRAW) {
    // un enlace compartido de ColabDraw abierto aquí: a su aplicación
    location.href = "colabdraw.html?p=" + projectId + (token ? "&t=" + token : "");
    return;
  }
  state.project = project;
  state.role = project.role;
  const readOnly = state.role === "view";

  $("edTitle").textContent = project.title;
  $("edTitle").title = readOnly ? project.title : "Clic para renombrar";
  $("readOnlyBadge").style.display = readOnly ? "" : "none";
  $("btnShare").style.display = readOnly ? "none" : "";
  $("btnNewFile").style.display = readOnly ? "none" : "";
  $("btnNewFolder").style.display = readOnly ? "none" : "";
  $("btnUploadFile").style.display = readOnly ? "none" : "";
  $("btnImportZip").style.display = readOnly ? "none" : "";
  // el vínculo con ColabDraw solo tiene sentido en la nube
  $("btnLinkDraw").style.display = "";
  $("btnReloadLocal").style.display = "none";
  $("btnVsCode").style.display = lfs.isSupported() ? "" : "none";
  $("btnCommentsToggle").style.display = "";   // comentarios: disponible en la nube
  paintVsCodeButton();
  state.lastCompile = null;
  if (state.assistant) state.assistant.reset();
  setSyncBadge("Conectando…", "#e2c08d");

  // ---- Yjs sobre Firebase RTDB ----
  const ydoc = new Y.Doc();
  const provider = new RtdbProvider(projectId, ydoc, { readOnly });
  state.ydoc = ydoc;
  state.provider = provider;
  state.yFiles = ydoc.getMap("files");
  state.yFolders = ydoc.getMap("folders");
  state.yComments = ydoc.getMap("comments");
  state.links = createLinks(ydoc);
  state.collapsed = new Set();
  state.uploadPrefix = "";

  provider.awareness.setLocalStateField("user", {
    name: state.user.name,
    color: state.user.color,
    colorLight: colorLight(state.user.color),
    uid: state.user.uid
  });

  provider.on("status", ({ status }) => {
    if (status === "connected") setSyncBadge("Guardado", "#7ee0c2");
    else setSyncBadge("Sin conexión", "#e57373");
  });
  /* Perder la nube en silencio es lo peor que puede pasar: se edita
     tranquilo durante una hora y al recargar no queda nada. */
  provider.on("error", err => {
    setSyncBadge("✗ SIN GUARDAR en la nube", "#e57373");
    appendLog("✗ No se pudo guardar en la nube: " + ((err && err.message) || err));
  });
  provider.on("saved", () => {
    if ($("syncBadge").textContent.startsWith("✗")) return;   // no tapar un error
    setSyncBadge("Guardado", "#7ee0c2");
  });
  let touchTimer = null;
  ydoc.on("update", (u, origin) => {
    if (origin !== provider) {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => fb.touchProject(projectId), 4000);
    }
  });
  provider.awareness.on("change", renderPresence);

  provider.once("synced", () => {
    const names = texFileNames();
    state.activeFile = names.includes("main.tex") ? "main.tex" : (names[0] || null);
    renderFileTree();
    if (state.activeFile) mountEditor(state.activeFile);
    if (state.comments) state.comments.mount();   // comentarios (solo nube)
    refreshLinks();                                // figuras de ColabDraw
  });
  /* Si otra persona vincula o desvincula un proyecto, el árbol de todos
     tiene que enterarse: el vínculo viaja por el documento. */
  state.linksUnobserve = state.links.observe(() => refreshLinks());
  state.yFiles.observe(() => renderFileTree());
  state.yFolders.observe(() => renderFileTree());

  // ---- assets ----
  await refreshAssets();

  ensureViewerAndEngine();
  renderPresence();
}

/* visor PDF + motor LaTeX (compartidos por el modo nube y el local) */
function ensureViewerAndEngine() {
  if (!state.pdfViewer) {
    state.pdfViewer = new PdfViewer($("pdfScroll"), {
      onPageInfo: (cur, total) => { $("pageLabel").textContent = `Página ${cur} / ${total}`; },
      // doble clic en el PDF → llevar el cursor a esa línea del código
      onPointClick: (page, x, y) => syncPdfToCode(page, x, y)
    });
  }
  if (!state.engine) {
    state.engine = new LatexEngine({ onStatus: engineStatus });
    state.engine.init().then(() => {
      setStatus("Motor LaTeX listo — pulsa Compilar", "#7ee0c2");
    }).catch(err => {
      setStatus("Error al cargar el motor LaTeX", "#e57373");
      appendLog("✗ " + err.message);
    });
    setStatus("Cargando motor LaTeX en tu navegador…", "#e2c08d");
  }
}

function teardownEditor() {
  // el puente apunta al Y.Doc que estamos a punto de destruir
  if (state.bridge && state.bridge.running) state.bridge.stop();
  if (state.comments) state.comments.unmount();
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
  if (state.preview) state.preview.close();
  if (state.editorView) { state.editorView.destroy(); state.editorView = null; }
  if (state.format) state.format.refresh();   // sin editor no hay nada que dar formato
  if (state.provider) { state.provider.destroy(); state.provider = null; }
  if (state.ydoc) { state.ydoc.destroy(); state.ydoc = null; }
  if (state.linksUnobserve) { state.linksUnobserve(); state.linksUnobserve = null; }
  stopLinkWatchers();
  state.links = null;
  state.linked = [];
  state.ownAssets = [];
  state.linkedInfo = [];
  state.project = null; state.yFiles = null; state.yFolders = null; state.yComments = null; state.activeFile = null;
  state.assets = [];
  state.assetCache.clear();
  state.collapsed = new Set();
  state.uploadPrefix = "";
  state.lastCompile = null;
  // modo local
  clearTimeout(state.saveTimer);
  state.mode = "cloud";
  state.dirHandle = null;
  state.localContent = new Map();
  state.localHandles = new Map();
  state.localFolders = new Set();
  state.dirty = new Set();
  $("btnSettings").style.display = "";
  if (state.assistant) state.assistant.close();
  $("logPanel").style.display = "none";
}

function setSyncBadge(text, color) {
  const b = $("syncBadge");
  b.textContent = text;
  b.style.color = color;
}

function setStatus(text, color) {
  $("statusText").textContent = "● " + text;
  $("statusText").style.color = color || "#7ee0c2";
}

/* ---------- árbol de archivos ---------- */
function texFileNames() {
  if (state.mode === "local") return Array.from(state.localContent.keys()).sort();
  return Array.from(state.yFiles ? state.yFiles.keys() : []).sort();
}

/* contenido de un archivo de texto, sea nube (Yjs) o local (disco) */
function fileText(name) {
  if (state.mode === "local") {
    return state.localContent.has(name) ? state.localContent.get(name) : null;
  }
  const t = state.yFiles ? state.yFiles.get(name) : null;
  return t ? t.toString() : null;
}

/* archivo .tex que se compilará: preferencia del proyecto → main.tex →
   primero con \documentclass */
function resolveMainFile() {
  const texNames = texFileNames();
  if (state.project && state.project.mainFile && texNames.includes(state.project.mainFile)) return state.project.mainFile;
  if (texNames.includes("main.tex")) return "main.tex";
  for (const n of texNames) {
    if (n.endsWith(".tex") && (fileText(n) || "").includes("\\documentclass")) return n;
  }
  return null;
}

const fileExt = name => {
  const base = name.split("/").pop();
  return base.includes(".") ? base.split(".").pop().toLowerCase() : "";
};

const FILE_KIND = name => {
  const ext = fileExt(name);
  if (ext === "tex" || ext === "sty" || ext === "cls") return ["TEX", "#6cb6ff"];
  if (ext === "bib") return ["BIB", "#e2c08d"];
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif"].includes(ext)) return ["IMG", "#b58bf5"];
  if (ext === "pdf") return ["PDF", "#e57373"];
  return ["TXT", "#8fa3b8"];
};

/* extensiones que pdfTeX puede insertar con \includegraphics */
const INSERTABLE = ["png", "jpg", "jpeg", "pdf"];

/* nombres válidos: sin ./.. ni barras sobrantes */
function cleanPath(name) {
  const parts = String(name).trim().replace(/\\/g, "/").split("/")
    .map(p => p.trim()).filter(p => p && p !== "." && p !== "..");
  return parts.join("/");
}

function renderFileTree() {
  const tree = $("fileTree");
  tree.innerHTML = "";
  if (state.mode === "cloud" && !state.yFiles) return;
  const readOnly = state.role === "view";

  // el recurso en vista previa se resalta como si fuera el archivo abierto;
  // si ha desaparecido (lo borró otro), la vista se cierra sola
  if (state.preview && state.preview.isOpen() && !state.assets.some(a => a.name === state.preview.name()))
    state.preview.close();
  const previewing = state.preview && state.preview.isOpen() ? state.preview.name() : null;

  // carpetas explícitas (Y.Map "folders" o disco) + implícitas por las rutas
  const folders = state.mode === "local"
    ? new Set(state.localFolders)
    : new Set(state.yFolders ? Array.from(state.yFolders.keys()) : []);
  const addImplicit = name => {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  };
  const texNames = texFileNames();
  for (const n of texNames) addImplicit(n);
  for (const a of state.assets) addImplicit(a.name);

  // hijos por carpeta ("" = raíz)
  const childFolders = new Map(), childFiles = new Map();
  const pushTo = (map, key, v) => { if (!map.has(key)) map.set(key, []); map.get(key).push(v); };
  for (const f of folders) pushTo(childFolders, parentOf(f), f);
  for (const n of texNames) pushTo(childFiles, parentOf(n), { name: n, asset: null });
  for (const a of state.assets) pushTo(childFiles, parentOf(a.name), { name: a.name, asset: a });

  /* ---- arrastrar y soltar (el cableado vive en src/file-move.js) ----
     Se arrastran archivos y carpetas; se sueltan sobre una carpeta (entra
     dentro), sobre un archivo (entra en la carpeta que lo contiene, que es
     lo que hacen los exploradores y perdona la puntería) o sobre el hueco
     del árbol, que saca a la raíz. */
  const makeDraggable = (div, path, isFolder) => {
    if (!readOnly) state.dnd.draggable(div, path, isFolder, tree);
  };
  const makeDropTarget = (div, folder) => {
    if (!readOnly) state.dnd.dropTarget(div, folder, false);
  };
  // el árbol no se recrea entre proyectos: hay que desarmarlo si son de solo lectura
  if (readOnly) state.dnd.unwire(tree);
  else state.dnd.dropTarget(tree, "", true);

  const fileEntry = (name, asset, depth) => {
    const [kind, color] = FILE_KIND(name);
    const base = name.split("/").pop();
    const canInsert = asset && !readOnly && INSERTABLE.includes(fileExt(name));
    const active = asset ? previewing === name : (!previewing && name === state.activeFile);
    /* Una figura vinculada vive en OTRO proyecto: aquí solo se mira y se
       inserta. Renombrarla o borrarla desde el .tex tocaría un proyecto
       que no es este, así que ni se ofrece. */
    const vinculado = isLinked(asset);
    const editable = !readOnly && !vinculado;
    const div = document.createElement("div");
    div.className = "file-entry" + (active ? " file-active" : "") + (vinculado ? " file-linked" : "");
    div.style.paddingLeft = (12 + depth * 14) + "px";
    div.title = vinculado
      ? `${name} — figura de «${asset.linkTitle}» en ColabDraw`
      : (asset ? name + " — pulsa para verlo" : name) + (readOnly ? "" : " · arrástralo para moverlo");
    div.innerHTML = `<span class="file-badge" style="color:${color};border-color:${color}">${kind}</span>
      <span class="file-name">${escapeHtml(base)}</span>
      ${vinculado ? '<span class="file-link-mark" title="Vinculada desde ColabDraw">🔗</span>' : ""}
      ${canInsert ? '<button class="file-act" data-act="ins" title="Insertar en el archivo activo">⤷</button>' : ""}
      ${editable ? `<button class="file-act" data-act="ren" title="Renombrar o mover">✎</button>
      <button class="file-act file-del" data-act="del" title="Eliminar archivo">✕</button>` : ""}`;
    div.onclick = () => { if (asset) openAssetPreview(asset); else mountEditor(name); };
    if (!vinculado) makeDraggable(div, name, false);
    makeDropTarget(div, parentOf(name));   // soltar sobre un archivo = su carpeta
    const ins = div.querySelector('[data-act="ins"]');
    if (ins) ins.onclick = e => { e.stopPropagation(); insertAssetSnippet(asset); };
    const ren = div.querySelector('[data-act="ren"]');
    if (ren) ren.onclick = e => { e.stopPropagation(); renameEntry(name, false); };
    const del = div.querySelector('[data-act="del"]');
    if (del) del.onclick = async e => {
      e.stopPropagation();
      if (!confirm(state.mode === "local"
        ? `¿Eliminar "${name}" del DISCO? Esta acción no se puede deshacer.`
        : `¿Eliminar "${name}" del proyecto?`)) return;
      if (state.mode === "local") {
        try { await lfs.deleteEntry(state.dirHandle, name); }
        catch (err) { alert("No se pudo eliminar: " + (err.message || err)); return; }
        state.localContent.delete(name);
        state.localHandles.delete(name);
        state.dirty.delete(name);
        state.assets = state.assets.filter(a => a.name !== name);
        if (state.activeFile === name) {
          const names = texFileNames();
          state.activeFile = names[0] || null;
          if (state.activeFile) mountEditor(state.activeFile);
          else if (state.editorView) { state.editorView.destroy(); state.editorView = null; $("activeFileName").textContent = "—"; }
        }
        renderFileTree();
        return;
      }
      if (asset) {
        await fb.deleteAsset(state.project.id, asset);
        await refreshAssets();
      } else {
        state.yFiles.delete(name);
        if (state.activeFile === name) {
          const names = texFileNames();
          state.activeFile = names[0] || null;
          if (state.activeFile) mountEditor(state.activeFile);
          else if (state.editorView) { state.editorView.destroy(); state.editorView = null; $("activeFileName").textContent = "—"; }
        }
      }
      renderFileTree();
    };
    return div;
  };

  const folderEntry = (path, depth) => {
    const collapsed = state.collapsed.has(path);
    /* Una carpeta que solo contiene figuras vinculadas no es de este
       proyecto: no se renombra, no se borra y no se le sueltan cosas. */
    const dentro = state.assets.filter(x => isInside(x.name, path));
    const soloVinculadas = dentro.length > 0 && dentro.every(isLinked) &&
      !texFileNames().some(n => isInside(n, path));
    const div = document.createElement("div");
    div.className = "file-entry folder-entry" + (soloVinculadas ? " file-linked" : "");
    div.style.paddingLeft = (12 + depth * 14) + "px";
    div.title = path + (readOnly ? "" : " · suelta archivos aquí para meterlos dentro");
    div.innerHTML = `<span class="folder-arrow">${collapsed ? "▸" : "▾"}</span>
      <span class="file-name">${escapeHtml(path.split("/").pop())}</span>
      ${readOnly || soloVinculadas ? "" : `<button class="file-act" data-act="new" title="Nuevo archivo aquí">＋</button>
      <button class="file-act" data-act="up" title="Subir archivos aquí">↑</button>
      <button class="file-act" data-act="ren" title="Renombrar o mover">✎</button>
      <button class="file-act file-del" data-act="del" title="Eliminar carpeta">✕</button>`}`;
    div.onclick = () => {
      if (collapsed) state.collapsed.delete(path); else state.collapsed.add(path);
      renderFileTree();
    };
    if (!soloVinculadas) makeDraggable(div, path, true);
    makeDropTarget(div, path);
    const stop = (act, fn) => {
      const b = div.querySelector(`[data-act="${act}"]`);
      if (b) b.onclick = e => { e.stopPropagation(); fn(); };
    };
    stop("new", () => newFileIn(path + "/"));
    stop("up", () => { state.uploadPrefix = path + "/"; $("fileUploadInput").click(); });
    stop("ren", () => renameEntry(path, true));
    stop("del", () => deleteFolder(path));
    return div;
  };

  const renderLevel = (folder, depth) => {
    for (const f of (childFolders.get(folder) || []).sort((a, b) => a.localeCompare(b))) {
      tree.appendChild(folderEntry(f, depth));
      if (!state.collapsed.has(f)) renderLevel(f, depth + 1);
    }
    for (const it of (childFiles.get(folder) || []).sort((a, b) => a.name.localeCompare(b.name)))
      tree.appendChild(fileEntry(it.name, it.asset, depth));
  };
  renderLevel("", 0);
}

function newFileIn(prefix) {
  let name = prompt("Nombre del nuevo archivo (p. ej. seccion1.tex):", "nuevo.tex");
  if (!name) return;
  name = cleanPath(prefix + name);
  if (!name) return;
  if (state.mode === "local") {
    if (state.localContent.has(name)) { alert("Ya existe un archivo con ese nombre."); return; }
    state.localContent.set(name, "");
    scheduleLocalSave(name);
    renderFileTree();
    mountEditor(name);
    return;
  }
  if (state.yFiles.has(name)) { alert("Ya existe un archivo con ese nombre."); return; }
  const t = new Y.Text();
  state.yFiles.set(name, t);
  mountEditor(name);
}

async function newFolderIn(prefix) {
  let name = prompt("Nombre de la nueva carpeta (puede anidar: cap1/figuras):", "figuras");
  if (!name) return;
  name = cleanPath(prefix + name);
  if (!name) return;
  if (state.mode === "local") {
    try { await lfs.makeFolder(state.dirHandle, name); }
    catch (e) { alert("No se pudo crear la carpeta: " + (e.message || e)); return; }
    state.localFolders.add(name);
    state.collapsed.delete(name);
    renderFileTree();
    return;
  }
  state.yFolders.set(name, true);
  state.collapsed.delete(name);
  renderFileTree();
}

async function deleteFolder(path) {
  const prefix = path + "/";
  const texToDelete = texFileNames().filter(n => n.startsWith(prefix));
  /* Las figuras vinculadas viven en otro proyecto: borrar aquí una
     carpeta no puede llevárselas por delante. */
  const assetsToDelete = state.assets.filter(a => !isLinked(a) && a.name.startsWith(prefix));
  const total = texToDelete.length + assetsToDelete.length;
  if (!confirm(state.mode === "local"
    ? `¿Eliminar del DISCO la carpeta "${path}"${total ? ` y los ${total} archivo(s) que contiene` : ""}? No se puede deshacer.`
    : `¿Eliminar la carpeta "${path}"${total ? ` y los ${total} archivo(s) que contiene` : ""}?`)) return;

  if (state.mode === "local") {
    try { await lfs.deleteEntry(state.dirHandle, path, true); }
    catch (e) { alert("No se pudo eliminar la carpeta: " + (e.message || e)); return; }
    for (const n of texToDelete) { state.localContent.delete(n); state.localHandles.delete(n); }
    state.assets = state.assets.filter(a => !a.name.startsWith(prefix));
    for (const f of Array.from(state.localFolders))
      if (f === path || f.startsWith(prefix)) state.localFolders.delete(f);
    if (state.activeFile && state.activeFile.startsWith(prefix)) {
      const names = texFileNames();
      state.activeFile = names[0] || null;
      if (state.activeFile) mountEditor(state.activeFile);
      else if (state.editorView) { state.editorView.destroy(); state.editorView = null; $("activeFileName").textContent = "—"; }
    }
    renderFileTree();
    return;
  }

  state.ydoc.transact(() => {
    for (const n of texToDelete) state.yFiles.delete(n);
    for (const k of Array.from(state.yFolders.keys()))
      if (k === path || k.startsWith(prefix)) state.yFolders.delete(k);
  });
  for (const a of assetsToDelete) {
    try { await fb.deleteAsset(state.project.id, a); } catch (e) {}
  }
  if (state.activeFile && state.activeFile.startsWith(prefix)) {
    const names = texFileNames();
    state.activeFile = names[0] || null;
    if (state.activeFile) mountEditor(state.activeFile);
    else if (state.editorView) { state.editorView.destroy(); state.editorView = null; $("activeFileName").textContent = "—"; }
  }
  await refreshAssets();
}

/* ============================================================
   Mover y renombrar (src/file-move.js)

   La ruta ES la identidad del archivo, así que renombrar y arrastrar a
   otra carpeta son la misma operación. Vale para los dos modos: en la
   nube se rehacen las claves del Y.Doc y el índice de Firebase; en local
   se copia y se borra, porque el disco no ofrece «renombrar».
   ============================================================ */

/* ¿ya hay algo con esa ruta? Archivo, imagen o carpeta, y también las
   carpetas implícitas (las que existen solo porque algo cuelga de ellas). */
function pathTaken(p) {
  if (texFileNames().includes(p)) return true;
  if (state.assets.some(a => a.name === p)) return true;
  const folders = state.mode === "local"
    ? state.localFolders
    : new Set(state.yFolders ? state.yFolders.keys() : []);
  if (folders.has(p)) return true;
  const pre = p + "/";
  return texFileNames().some(n => n.startsWith(pre)) || state.assets.some(a => a.name.startsWith(pre));
}

/* Sustituye el contenido de un archivo de texto tocando solo lo que cambia:
   en la nube para no pisar lo que otros escriben a la vez, y en local para
   no mover el cursor de quien lo tenga abierto. */
function setFileText(name, next) {
  const cur = fileText(name);
  if (cur == null || cur === next) return;
  if (state.mode === "local") {
    const d = minimalDiff(cur, next);
    patchTextFile(name, d.from, d.to, d.insert);
    return;
  }
  const t = state.yFiles.get(name);
  // origen null (no el del puente): así baja al disco y se puede deshacer
  if (t) applyTextToY(t, next, null);
}

/* Reescribe en los .tex las referencias a las rutas que acaban de moverse.
   Devuelve cuántas cambiaron. */
function rewriteRefsFor(pairs) {
  let total = 0;
  for (const name of texFileNames()) {
    if (!/\.(tex|sty|cls)$/i.test(name)) continue;
    let text = fileText(name);
    if (text == null) continue;
    let hits = 0;
    for (const [from, to] of pairs) {
      const r = rewriteReferences(text, from, to);
      text = r.text;
      hits += r.count;
    }
    if (!hits) continue;
    setFileText(name, text);
    total += hits;
  }
  return total;
}

/* el archivo principal se sigue llamando igual aunque cambie de sitio */
async function setMainFilePath(name) {
  state.project.mainFile = name;
  if (state.mode === "local") {
    if (state.dirHandle) localStorage.setItem(LOCAL_MAIN_PREFIX + state.dirHandle.name, name);
    return;
  }
  try { await fb.updateProjectMeta(state.project.id, { mainFile: name }); } catch (e) {}
}

async function moveInCloud(texts, assets, oldPath, newPath, isFolder) {
  /* Un Y.Text no se puede reinsertar bajo otra clave: hay que crear uno nuevo
     con el mismo contenido. Con el viejo se irían las anclas de los
     comentarios, así que se apuntan antes y se rehacen después. */
  const anchors = [];
  if (state.comments)
    for (const n of texts)
      anchors.push({ file: movedPath(n, oldPath, newPath), list: state.comments.captureAnchors(n) });

  state.ydoc.transact(() => {
    for (const n of texts) {
      const old = state.yFiles.get(n);
      if (!old) continue;
      // integrar el Y.Text en el documento ANTES de escribir dentro
      const t = state.yFiles.set(movedPath(n, oldPath, newPath), new Y.Text());
      t.insert(0, old.toString());
      state.yFiles.delete(n);
    }
    for (const k of Array.from(state.yFolders.keys())) {
      if (!isInside(k, oldPath)) continue;
      state.yFolders.delete(k);
      state.yFolders.set(movedPath(k, oldPath, newPath), true);
    }
    if (isFolder) state.yFolders.set(newPath, true);   // por si era implícita
  });
  for (const a of anchors) state.comments.reanchor(a.file, a.list);

  for (const a of assets) await fb.renameAsset(state.project.id, a, movedPath(a.name, oldPath, newPath));
  if (assets.length) await refreshAssets();
}

async function moveOnDisk(pairs, oldPath, newPath, isFolder) {
  for (const [from, to] of pairs) {
    /* Windows no distingue mayúsculas: al cambiar solo la caja del nombre,
       escribir primero y borrar después borraría el archivo recién escrito.
       Con el contenido ya en memoria, ahí se borra antes. */
    const sameFile = from.toLowerCase() === to.toLowerCase();
    if (state.localContent.has(from)) {
      const text = state.localContent.get(from);
      if (sameFile) await lfs.deleteEntry(state.dirHandle, from);
      const h = await lfs.writeText(state.dirHandle, to, text);
      state.localContent.set(to, text);
      state.localHandles.set(to, h);
      state.localContent.delete(from);
      state.localHandles.delete(from);
      state.dirty.delete(from);
    } else {
      const a = state.assets.find(x => x.name === from);
      if (!a) continue;
      const bytes = await lfs.readBytes(a.handle);
      if (sameFile) await lfs.deleteEntry(state.dirHandle, from);
      const h = await lfs.writeBytes(state.dirHandle, to, bytes);
      a.name = to; a.key = to; a.handle = h;
    }
    if (!sameFile) await lfs.deleteEntry(state.dirHandle, from);
  }
  if (isFolder) {
    // lo que quedara dentro (subcarpetas vacías) se va con el borrado
    try { await lfs.deleteEntry(state.dirHandle, oldPath, true); } catch (e) {}
    for (const f of Array.from(state.localFolders)) {
      if (!isInside(f, oldPath)) continue;
      state.localFolders.delete(f);
      state.localFolders.add(movedPath(f, oldPath, newPath));
    }
    try { await lfs.makeFolder(state.dirHandle, newPath); } catch (e) {}
  }
}

/* Mueve una entrada del árbol (y todo lo que cuelga de ella si es carpeta)
   a `newPath`, y deja apuntando bien las referencias de los .tex. */
async function moveEntry(oldPath, newPath, isFolder) {
  if (state.role === "view" || !oldPath) return;
  newPath = cleanPath(newPath);
  if (!newPath || newPath === oldPath) return;
  const problem = moveProblem(oldPath, newPath, isFolder, pathTaken);
  if (problem) { alert(problem); return; }
  /* Cambiar la extensión no convierte un binario en texto ni al revés: una
     imagen llamada «.tex» no se podría abrir ni compilar. */
  if (!isFolder && texFileNames().includes(oldPath) !== TEXT_EXT.includes(fileExt(newPath))) {
    alert(`«${baseName(oldPath)}» y «${baseName(newPath)}» no son del mismo tipo: ` +
      "cambiar entre archivo de texto e imagen dejaría el archivo inservible.");
    return;
  }

  const texts = texFileNames().filter(n => (isFolder ? isInside(n, oldPath) : n === oldPath));
  const assets = state.assets.filter(a => !isLinked(a) && (isFolder ? isInside(a.name, oldPath) : a.name === oldPath));
  const pairs = texts.concat(assets.map(a => a.name)).map(p => [p, movedPath(p, oldPath, newPath)]);
  if (!isFolder && !pairs.length) return;          // no era ni archivo ni imagen

  const wasActive = !!state.activeFile &&
    (isFolder ? isInside(state.activeFile, oldPath) : state.activeFile === oldPath);
  const previewing = state.preview && state.preview.isOpen() ? state.preview.name() : null;
  setStatus(`Moviendo «${oldPath}»…`, "#e2c08d");

  try {
    if (state.mode === "local") await moveOnDisk(pairs, oldPath, newPath, isFolder);
    else await moveInCloud(texts, assets, oldPath, newPath, isFolder);
  } catch (e) {
    alert("No se pudo mover: " + (e.message || e));
    await refreshAssets();                          // deja el árbol como esté de verdad
    return;
  }

  // las carpetas plegadas siguen plegadas donde hayan quedado
  for (const f of Array.from(state.collapsed)) {
    if (!isInside(f, oldPath)) continue;
    state.collapsed.delete(f);
    state.collapsed.add(movedPath(f, oldPath, newPath));
  }
  const mainPair = pairs.find(([from]) => from === (state.project && state.project.mainFile));
  if (mainPair) await setMainFilePath(mainPair[1]);

  const refs = rewriteRefsFor(pairs);

  if (wasActive) {
    const next = movedPath(state.activeFile, oldPath, newPath);
    state.activeFile = null;                        // el Y.Text de antes ya no existe
    mountEditor(next);
  }
  renderFileTree();
  if (previewing) {
    const moved = pairs.find(([from]) => from === previewing);
    const a = moved && state.assets.find(x => x.name === moved[1]);
    if (a) openAssetPreview(a);
    else if (moved) closeAssetPreview();
  }
  setStatus(`«${oldPath}» → «${newPath}»` +
    (refs ? ` · ${refs} referencia(s) actualizada(s)` : ""), "#7ee0c2");
}

/* Renombrar es mover dentro de la misma carpeta. Si escriben barras, se
   admite: es la forma rápida de mandarlo a otra carpeta sin arrastrar. */
function renameEntry(path, isFolder) {
  const typed = prompt(isFolder
    ? "Nuevo nombre de la carpeta (puede llevar ruta):"
    : "Nuevo nombre del archivo (puede llevar ruta):", baseName(path));
  if (typed == null) return;
  const next = cleanPath(joinPath(parentOf(path), typed.trim()));
  if (!next || next === path) return;
  moveEntry(path, next, isFolder).catch(err => alert("No se pudo renombrar: " + (err.message || err)));
}

/* inserta \includegraphics del asset en el punto del cursor; devuelve si pudo */
function insertAssetSnippet(asset) {
  if (state.role === "view") return false;
  if (!state.editorView || !state.activeFile || !/\.(tex|sty|cls)$/i.test(state.activeFile)) {
    alert("Abre un archivo .tex para insertar la referencia.");
    return false;
  }
  const ext = fileExt(asset.name);
  let snippet;
  if (ext === "pdf") {
    snippet = `\\includegraphics[page=1,width=\\linewidth]{${asset.name}}\n`;
  } else {
    const label = asset.name.split("/").pop().replace(/\.[^.]+$/, "").replace(/[^\w-]/g, "");
    snippet = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${asset.name}}\n  \\caption{Descripción de la figura}\n  \\label{fig:${label}}\n\\end{figure}\n`;
  }
  state.editorView.dispatch(state.editorView.state.replaceSelection(snippet));
  state.editorView.focus();
  return true;
}

/* Escribe un trozo de un archivo de texto, esté abierto o no y sea cual sea el
   modo. En local con el archivo abierto se pasa por el editor: cambiar
   state.localContent por debajo dejaría a CodeMirror con la versión vieja y la
   siguiente tecla borraría lo escrito aquí. */
function patchTextFile(name, from, to, insert) {
  if (state.mode === "local") {
    if (name === state.activeFile && state.editorView) {
      state.editorView.dispatch({ changes: { from, to, insert } });
      return;
    }
    const cur = state.localContent.get(name);
    if (cur == null) return;
    state.localContent.set(name, cur.slice(0, from) + insert + cur.slice(to));
    scheduleLocalSave(name);
    return;
  }
  const t = state.yFiles && state.yFiles.get(name);
  if (!t) return;
  state.ydoc.transact(() => {
    if (to > from) t.delete(from, to - from);
    if (insert) t.insert(from, insert);
  });
}

/* \textcolor necesita el paquete xcolor. Se carga en el preámbulo del archivo
   principal la primera vez que se usa un color, para que el documento siga
   compilando sin que nadie tenga que acordarse de añadirlo. */
function ensureColorPackage() {
  const main = resolveMainFile();
  if (!main) return;
  const text = fileText(main);
  if (text == null) return;
  const p = xcolorPatch(text);
  if (!p) return;                       // xcolor ya estaba
  patchTextFile(main, p.from, p.to, p.insert);
  setStatus(p.replaced
    ? `En ${main} se cambió «color» por «xcolor» (lo necesita \\textcolor)`
    : `Se añadió \\usepackage{xcolor} a ${main} (lo necesita \\textcolor)`,
    p.replaced ? "#e2c08d" : "#7ee0c2");
}

/* Bytes de un recurso binario: del disco en modo local, de Firebase con caché
   en la nube. Lo usan la compilación y la vista previa, así que el aviso de
   CORS —el fallo más habitual al empezar— se escribe en un solo sitio. */
async function assetBytes(a) {
  if (a.loc === "local") {
    // modo local: se lee del disco, sin caché ni red
    try { return await lfs.readBytes(a.handle); }
    catch (err) { throw new Error(`No se pudo leer "${a.name}" del disco: ${err.message || err}`); }
  }
  const cacheKey = a.key + ":" + (a.size || 0);
  const hit = state.assetCache.get(cacheKey);
  if (hit) return hit;
  let bytes;
  try {
    /* Una figura vinculada se baja de SU proyecto, no de este. Por eso
       el vínculo da acceso de verdad al proyecto de dibujo: sin eso las
       reglas negarían la lectura a media plantilla. */
    bytes = isLinked(a)
      ? await fb.fetchAssetBytes(a.pid, a.asset)
      : await fb.fetchAssetBytes(state.project.id, a);
  } catch (err) {
    const code = err.code || err.message || "";
    // CORS/red: XHR bloqueado antes de recibir cabeceras → sin código útil
    const isCors = /cors|network|retry-limit|unknown|Failed to fetch/i.test(code) || !err.code;
    if (isCors && a.loc === "storage") {
      throw new Error(`No se pudo descargar "${a.name}" de Firebase Storage (bloqueo CORS). ` +
        "Falta autorizar tu dominio en el bucket: sigue el paso «2b. CORS de Storage» " +
        "de firebase/CONFIGURAR-FIREBASE.md (una sola vez).");
    }
    throw new Error(`No se pudo descargar "${a.name}" (${code}). ` +
      "Revisa las reglas de Storage en la consola de Firebase.");
  }
  state.assetCache.set(cacheKey, bytes);
  return bytes;
}

/* Todo el proyecto en un .zip: los .tex tal cual están en el documento
   —incluido lo que no se haya llegado a compilar— y los binarios. Vale
   como copia de seguridad y como forma de llevárselo a Overleaf, que
   importa justo este formato. */
async function zipProject() {
  const btn = $("btnZipProject");
  btn.disabled = true;
  try {
    const titulo = state.mode === "local"
      ? (state.dirHandle && state.dirHandle.name) || "proyecto"
      : (state.project && state.project.title) || "proyecto";
    const r = await downloadProjectZip(titulo, async () => {
      const entries = [];
      for (const name of texFileNames()) entries.push({ path: name, bytes: fileText(name) || "" });
      for (const a of state.assets) {
        try { entries.push({ path: a.name, bytes: await assetBytes(a) }); }
        catch (e) { console.warn("ColabTeX: no se pudo empaquetar " + a.name, e); }
      }
      return entries;
    }, { onStep: m => { if (m) setStatus(m, "#e2c08d"); } });
    setStatus(`${r.count} archivos en el .zip`, "#7ee0c2");
  } catch (e) {
    setStatus("No se pudo crear el .zip", "#e57373");
    alert("No se pudo crear el .zip: " + (e.message || e));
  } finally {
    btn.disabled = false;
  }
}

/* clic en una imagen o un PDF del árbol → verlo sin salir del editor */
function openAssetPreview(asset) {
  if (!state.preview) return;
  state.preview.open(asset).catch(err => console.error(err));
  renderFileTree();
}

function closeAssetPreview() {
  if (!state.preview || !state.preview.isOpen()) return;
  state.preview.close();   // el editor sigue montado debajo: basta con volver a mostrarlo
  renderFileTree();
}

async function refreshAssets() {
  if (state.mode === "local") { renderFileTree(); return; }
  try {
    state.ownAssets = await fb.listAssets(state.project.id);
  } catch (e) { state.ownAssets = []; }
  mergeAssets();
}

/* Los recursos propios y los de los proyectos de dibujo vinculados van
   en la MISMA lista: a partir de aquí nada distingue unos de otros, y
   por eso la vista previa, insertar, compilar y el .zip funcionan con
   las figuras vinculadas sin tocar una línea. */
function mergeAssets() {
  state.assets = (state.ownAssets || []).concat(state.linked || []);
  renderFileTree();
}

/* ============================================================
   FIGURAS VINCULADAS (proyectos de ColabDraw)
   ============================================================ */

function stopLinkWatchers() {
  for (const off of state.linkWatchers) { try { off(); } catch (e) {} }
  state.linkWatchers = [];
}

/* Se apunta al equipo a los proyectos vinculados y trae sus figuras.
   Cada vínculo se escucha en vivo: al exportar un PNG nuevo desde
   ColabDraw aparece aquí sin recargar. */
async function refreshLinks() {
  if (state.mode !== "cloud" || !state.links || !state.project) return;
  stopLinkWatchers();
  const links = state.links.list();
  if (!links.length) {
    state.linked = [];
    mergeAssets();
    return;
  }
  const { ok, fallos } = await ensureAccess(links, { uid: state.user.uid, userName: state.user.name },
    { getProject: fb.getProject, joinWithToken: fb.joinWithToken });
  for (const f of fallos) console.warn(`ColabTeX: sin acceso al proyecto de dibujo «${f.title}»:`, f.error);
  state.linkedInfo = ok;

  const porProyecto = new Map();
  const recomponer = () => {
    state.linked = [].concat(...ok.map(l => porProyecto.get(l.pid) || []));
    mergeAssets();
  };
  for (const link of ok) {
    state.linkWatchers.push(fb.watchAssets(link.pid, assets => {
      porProyecto.set(link.pid, linkedAssets(link, assets));
      recomponer();
    }));
  }
  recomponer();
}

async function linkDrawProject(pid, title, role) {
  const p = await fb.getProject(pid, state.user.uid);
  if (!p) throw new Error("Ese proyecto de dibujo ya no existe.");
  /* Se guarda el token de invitación: es lo que deja que cada
     colaborador del artículo se apunte solo al abrir el proyecto. */
  const token = p.tokens ? (role === "view" ? p.tokens.view : p.tokens.edit) : "";
  if (!token) throw new Error("Necesitas ser propietario o editor del proyecto de dibujo para vincularlo.");
  state.links.add(pid, { title: p.title || title, token, role });
  await refreshLinks();
}

function unlinkDrawProject(pid) {
  if (!state.links) return;
  state.links.remove(pid);
  refreshLinks();
}

/* ---------- el modal ---------- */

async function openLinkModal() {
  if (state.mode !== "cloud") { alert("Las figuras vinculadas son cosa de los proyectos en la nube."); return; }
  $("linkMsg").textContent = "";
  $("linkModal").classList.add("open");
  renderLinkList();
  const picker = $("linkPicker");
  picker.innerHTML = '<option value="">Cargando…</option>';
  try {
    const todos = await fb.listProjects(state.user.uid);
    const dibujos = todos.filter(p => p.kind === fb.KIND_DRAW && !state.links.has(p.id));
    picker.innerHTML = dibujos.length
      ? dibujos.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join("")
      : '<option value="">No tienes proyectos de dibujo sin vincular</option>';
    $("btnDoLink").disabled = !dibujos.length || state.role === "view";
  } catch (e) {
    picker.innerHTML = '<option value="">No se pudo cargar la lista</option>';
    $("btnDoLink").disabled = true;
  }
}

function renderLinkList() {
  const host = $("linkList");
  host.innerHTML = "";
  const links = state.links ? state.links.list() : [];
  if (!links.length) {
    host.innerHTML = '<div class="modal-note">Todavía no hay ninguno.</div>';
    return;
  }
  for (const l of links) {
    const n = (state.linked || []).filter(a => a.pid === l.pid).length;
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML = `<span class="link-title">${escapeHtml(l.title)}</span>
      <span class="link-count">${n} figura${n === 1 ? "" : "s"}</span>
      <a href="colabdraw.html?p=${encodeURIComponent(l.pid)}" target="_blank" rel="noopener">Abrir</a>
      ${state.role === "view" ? "" : '<button data-act="off" title="Desvincular">✕</button>'}`;
    const off = row.querySelector('[data-act="off"]');
    if (off) off.onclick = () => {
      if (!confirm(`¿Desvincular «${l.title}»? Sus figuras dejarán de aparecer en el árbol ` +
        "(el proyecto de dibujo no se toca).")) return;
      unlinkDrawProject(l.pid);
      renderLinkList();
    };
    host.appendChild(row);
  }
}

async function doLink() {
  const pid = $("linkPicker").value;
  if (!pid) return;
  const btn = $("btnDoLink");
  const msg = $("linkMsg");
  btn.disabled = true;
  msg.style.color = "#5a6772";
  msg.textContent = "Vinculando…";
  try {
    await linkDrawProject(pid, $("linkPicker").selectedOptions[0].textContent, $("linkRole").value);
    msg.style.color = "#0d9488";
    msg.textContent = "Listo: sus figuras ya están en el árbol de archivos.";
    renderLinkList();
    openLinkModal();          // el vinculado sale de la lista de candidatos
  } catch (e) {
    msg.style.color = "#c0392b";
    msg.textContent = "No se pudo vincular: " + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
   MODO LOCAL — editar una carpeta del disco (sin nube)
   ============================================================ */

/* abre el selector de carpeta y entra al editor en modo local */
async function openLocalFolder(handle) {
  if (!lfs.isSupported()) {
    alert("Tu navegador no permite abrir carpetas locales.\n\n" +
      "Esta función usa la File System Access API, disponible en Chrome, Edge y Opera de escritorio. " +
      "Firefox y Safari todavía no la implementan.");
    return;
  }
  let dir = handle;
  try {
    if (!dir) dir = await lfs.pickDirectory();
  } catch (e) { return; }               // el usuario canceló el selector
  if (!dir) return;

  if (!(await lfs.ensurePermission(dir, "readwrite"))) {
    alert("Sin permiso de lectura/escritura sobre la carpeta, no se puede editar.");
    return;
  }

  let scan;
  try { scan = await lfs.scanDirectory(dir); }
  catch (e) { alert("No se pudo leer la carpeta: " + (e.message || e)); return; }

  if (scan.contents.size === 0 && scan.assets.length === 0) {
    if (!confirm(`La carpeta "${dir.name}" está vacía o no tiene archivos reconocibles.\n\n¿Abrirla de todos modos?`)) return;
  }

  teardownEditor();
  lfs.saveRecent(dir).catch(() => {});

  state.mode = "local";
  state.dirHandle = dir;
  state.localContent = scan.contents;
  state.localHandles = scan.textHandles;
  state.localFolders = scan.folders;
  state.dirty = new Set();
  state.collapsed = new Set();
  state.assets = scan.assets.map(a => ({ name: a.name, key: a.name, size: a.size || 0, loc: "local", handle: a.handle }));
  state.role = "owner";
  // recuperar el .tex principal elegido la última vez para esta carpeta
  const savedMain = localStorage.getItem(LOCAL_MAIN_PREFIX + dir.name);
  state.project = {
    id: null, title: dir.name, ownerId: null,
    mainFile: savedMain && scan.contents.has(savedMain) ? savedMain : null,
    role: "owner", members: []
  };
  state.lastCompile = null;

  $("viewLogin").style.display = "none";
  $("viewDash").style.display = "none";
  $("viewEditor").style.display = "flex";
  history.pushState({}, "", location.pathname + "?local=1");

  $("edTitle").textContent = "📂 " + dir.name;
  $("edTitle").title = "Carpeta local (el nombre no se puede cambiar aquí)";
  $("readOnlyBadge").style.display = "none";
  // en local no hay colaboración, pero sí configuración (archivo principal)
  $("btnShare").style.display = "none";
  $("btnSettings").style.display = "";
  $("btnNewFile").style.display = "";
  $("btnNewFolder").style.display = "";
  $("btnUploadFile").style.display = "";
  $("btnImportZip").style.display = "";
  $("btnLinkDraw").style.display = "none";         // vínculos: solo en la nube
  $("btnCommentsToggle").style.display = "none";   // comentarios: solo en la nube
  setSyncBadge("Local · en tu disco", "#7ee0c2");
  $("btnReloadLocal").style.display = "";
  // en modo local ya se edita el disco directamente: el puente no pinta nada
  $("btnVsCode").style.display = "none";
  $("presenceAvatars").innerHTML = "";
  $("onlineCount").textContent = "modo local (sin colaboración)";
  if (state.assistant) state.assistant.reset();

  renderFileTree();
  const main = resolveMainFile();
  state.activeFile = main || texFileNames()[0] || null;
  if (state.activeFile) mountEditor(state.activeFile);
  else if (state.editorView) { state.editorView.destroy(); state.editorView = null; $("activeFileName").textContent = "—"; }

  ensureViewerAndEngine();
}

/* guardado en disco con retardo (autosave) */
function scheduleLocalSave(path) {
  state.dirty.add(path);
  clearTimeout(state.saveTimer);
  setSyncBadge("Guardando…", "#e2c08d");
  state.saveTimer = setTimeout(flushLocalSaves, 700);
}

async function flushLocalSaves() {
  if (state.mode !== "local" || !state.dirHandle) return;
  const paths = Array.from(state.dirty);
  state.dirty.clear();
  try {
    for (const p of paths) {
      const h = await lfs.writeText(state.dirHandle, p, state.localContent.get(p) || "");
      state.localHandles.set(p, h);
    }
    setSyncBadge("Guardado en disco", "#7ee0c2");
  } catch (e) {
    for (const p of paths) state.dirty.add(p);
    setSyncBadge("Error al guardar", "#e57373");
    appendLog("✗ No se pudo guardar en disco: " + (e.message || e));
  }
}

/* recarga desde disco (por si editaste con otro programa) */
async function reloadLocalFolder() {
  if (state.mode !== "local" || !state.dirHandle) return;
  await flushLocalSaves();
  try {
    const scan = await lfs.scanDirectory(state.dirHandle);
    state.localContent = scan.contents;
    state.localHandles = scan.textHandles;
    state.localFolders = scan.folders;
    state.assets = scan.assets.map(a => ({ name: a.name, key: a.name, size: a.size || 0, loc: "local", handle: a.handle }));
    renderFileTree();
    if (state.activeFile && state.localContent.has(state.activeFile)) mountEditor(state.activeFile);
    setSyncBadge("Recargado desde disco", "#7ee0c2");
  } catch (e) { alert("No se pudo recargar: " + (e.message || e)); }
}

/* lista de carpetas recientes en el dashboard */
async function renderLocalRecents() {
  const cont = $("localRecents");
  if (!cont) return;
  if (!lfs.isSupported()) {
    cont.innerHTML = '<div class="local-note">Tu navegador no soporta abrir carpetas locales (usa Chrome, Edge u Opera de escritorio).</div>';
    $("btnOpenLocal").disabled = true;
    return;
  }
  let recents = [];
  try { recents = await lfs.listRecents(); } catch (e) {}
  cont.innerHTML = "";
  for (const r of recents.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "local-recent";
    row.innerHTML = `<span class="local-recent-name" title="${escapeHtml(r.name)}">📂 ${escapeHtml(r.name)}</span>
      <button class="local-recent-x" title="Quitar de recientes">✕</button>`;
    row.querySelector(".local-recent-name").onclick = () => openLocalFolder(r.handle);
    row.querySelector(".local-recent-x").onclick = async e => {
      e.stopPropagation();
      await lfs.removeRecent(r.id);
      renderLocalRecents();
    };
    cont.appendChild(row);
  }
}

/* ============================================================
   PUENTE CON VS CODE — proyecto de la nube ↔ carpeta del disco
   ============================================================ */

function ensureBridge() {
  if (state.bridge) return state.bridge;
  state.bridge = createBridge({
    onStatus: (t, c) => setSyncBadge(t, c),
    onLog: m => appendLog(m),
    onTree: () => renderFileTree(),
    canWrite: () => state.role !== "view",
    newYText: () => new Y.Text()
  });
  return state.bridge;
}

function paintVsCodeButton() {
  const b = $("btnVsCode");
  if (!b) return;
  const on = state.bridge && state.bridge.running;
  b.textContent = on ? "💻 VS Code ●" : "💻 VS Code";
  b.title = on
    ? `Sincronizando con la carpeta «${state.bridge.folder}». Clic para abrir VS Code o detener.`
    : "Sincronizar este proyecto con una carpeta de tu PC y editarlo en VS Code";
  b.style.color = on ? "#7ee0c2" : "";
}

/* El navegador no revela la ruta absoluta de una carpeta (por diseño:
   sería una fuga de datos sobre el disco del usuario). Para poder lanzar
   vscode://file/… hay que preguntarla una vez; queda guardada junto al
   handle. Quien no quiera pegarla tiene el .bat que dejamos en la carpeta. */
async function askAbsPath(folderName, current) {
  const p = prompt(
    "¿Cuál es la ruta completa de la carpeta en tu PC?\n\n" +
    "El navegador no puede averiguarla por seguridad, así que hace falta\n" +
    "indicarla una sola vez. En el Explorador: clic derecho sobre la\n" +
    "carpeta → «Copiar como ruta», y pégala aquí.\n\n" +
    "Si prefieres saltarte esto, dentro de la carpeta te dejé\n" +
    "«abrir-en-vscode.bat»: doble clic y VS Code se abre igual.",
    current || ("D:\\ruta\\a\\" + folderName));
  return p ? p.trim() : "";
}

function launchVsCode() {
  const br = state.bridge;
  if (!br || !br.running) return;
  if (!br.absPath) {
    appendLog("ℹ Sin ruta configurada: abre «abrir-en-vscode.bat» dentro de la carpeta " +
      `«${br.folder}» o vuelve a pulsar el botón para indicarla.`);
    return;
  }
  /* El protocolo se lanza desde un iframe oculto, NO con location.href.
     Asignar location.href inicia una navegación de primer nivel: el
     navegador la cancela al ver que es un protocolo externo, pero para
     entonces ya ha disparado beforeunload, que cerraba el proveedor de
     Firebase. La sesión seguía editándose en memoria —editor y disco
     perfectos— pero sin guardar nada en la nube. Un <a>.click() tiene el
     mismo problema; el iframe navega en su propio contexto y no toca el
     documento principal. */
  const f = document.createElement("iframe");
  f.style.display = "none";
  f.src = vscodeUrl(br.absPath);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 2000);
}

async function linkVsCodeFolder() {
  if (!lfs.isSupported()) {
    alert("Tu navegador no permite enlazar carpetas del disco.\n\n" +
      "Esta función usa la File System Access API, disponible en Chrome, Edge y " +
      "Opera de escritorio. Firefox y Safari todavía no la implementan.");
    return;
  }
  const br = ensureBridge();

  /* ¿había ya una carpeta enlazada para este proyecto? El permiso se puede
     volver a pedir aquí porque seguimos dentro del clic del usuario. */
  let dir = null, path = "";
  const saved = await lfs.getBridge(state.project.id);
  if (saved) {
    if (await lfs.ensurePermission(saved.handle, "readwrite")) {
      dir = saved.handle;
      path = saved.absPath || "";
    }
  }

  if (!dir) {
    alert("Elige (o crea) una carpeta vacía en tu PC.\n\n" +
      "ColabTeX copiará ahí el proyecto y mantendrá las dos copias iguales:\n" +
      "lo que guardes en VS Code aparece en la web y en la de tus colaboradores,\n" +
      "y al revés — mientras esta pestaña siga abierta.");
    try { dir = await lfs.pickDirectory(); }
    catch (e) { return; }                       // el usuario canceló
    if (!dir) return;
    if (!(await lfs.ensurePermission(dir, "readwrite"))) {
      alert("Sin permiso de lectura/escritura sobre la carpeta no se puede sincronizar.");
      return;
    }
  }

  /* Aviso si la carpeta ya tenía archivos: el espejo inicial va de la nube
     al disco, así que sobrescribiría lo que hubiera con el mismo nombre. */
  try {
    const info = await br.inspect(dir);
    if (info.existing.length) {
      const lista = info.existing.slice(0, 6).join(", ") + (info.existing.length > 6 ? "…" : "");
      if (!confirm(`La carpeta «${dir.name}» ya contiene ${info.existing.length} archivo(s) de texto:\n${lista}\n\n` +
        "Se van a SOBRESCRIBIR con la versión de la nube.\n\n¿Continuar?")) return;
    }
  } catch (e) { /* si no se puede inspeccionar, seguimos igual */ }

  if (!path) path = await askAbsPath(dir.name, "");

  setSyncBadge("Copiando al disco…", "#e2c08d");
  try {
    await br.start({
      dirHandle: dir,
      yFiles: state.yFiles,
      id: state.project.id,
      path,
      getAssets: () => state.assets,
      fetchAsset: assetBytes
    });
  } catch (e) {
    setSyncBadge("Error al enlazar", "#e57373");
    alert("No se pudo enlazar la carpeta: " + (e.message || e));
    return;
  }

  paintVsCodeButton();
  if (state.role === "view") {
    appendLog("ℹ Tienes permiso de solo lectura: los cambios bajan al disco, pero lo que edites ahí no sube.");
  }
  launchVsCode();
}

async function unlinkVsCode() {
  if (!state.bridge) return;
  const name = state.bridge.folder;
  await state.bridge.stop();
  if (state.project && state.project.id) lfs.removeBridge(state.project.id).catch(() => {});
  paintVsCodeButton();
  setSyncBadge("Sincronizado", "#7ee0c2");
  appendLog(`💻 Sincronización con «${name}» detenida. Los archivos siguen en tu disco.`);
}

async function onVsCodeClick() {
  if (state.mode !== "cloud" || !state.project || !state.yFiles) return;
  const br = state.bridge;
  if (br && br.running) {
    const seguir = confirm(
      `Este proyecto está sincronizado con la carpeta «${br.folder}».\n\n` +
      "«Aceptar» abre VS Code.\n" +
      "«Cancelar» detiene la sincronización.");
    if (seguir) {
      if (!br.absPath) br.setPath(await askAbsPath(br.folder, ""));
      launchVsCode();
    } else {
      await unlinkVsCode();
    }
    return;
  }
  await linkVsCodeFolder();
}

/* ---------- importar .zip (export de Overleaf) ---------- */

/* elige el .tex principal de un conjunto importado */
function pickMainFrom(texts) {
  const names = Object.keys(texts);
  if (names.includes("main.tex")) return "main.tex";
  const withClass = names.filter(n => n.endsWith(".tex") && texts[n].includes("\\documentclass"));
  if (withClass.length) return withClass.sort((a, b) => a.split("/").length - b.split("/").length)[0];
  return names.find(n => n.endsWith(".tex")) || null;
}

/* importa dentro del proyecto abierto */
async function importZipIntoProject(file) {
  if (state.role === "view" || !state.yFiles) return;
  let z;
  try { z = await readZip(file); }
  catch (e) { alert(e.message); return; }

  const textNames = Object.keys(z.texts);
  if (!textNames.length && !z.assets.length) {
    alert("El .zip no contiene archivos utilizables (¿es un export de código fuente de Overleaf?).");
    return;
  }
  const existing = new Set(texFileNames());
  const clashes = textNames.filter(n => existing.has(n));
  if (clashes.length && !confirm(
    `Se sobrescribirán ${clashes.length} archivo(s) ya existente(s):\n\n` +
    clashes.slice(0, 12).join("\n") + (clashes.length > 12 ? `\n…y ${clashes.length - 12} más` : "") +
    "\n\n¿Continuar con la importación?")) return;

  setStatus(`Importando ${file.name}…`, "#e2c08d");
  state.ydoc.transact(() => {
    for (const [path, content] of Object.entries(z.texts)) {
      let t = state.yFiles.get(path);
      if (t) { t.delete(0, t.length); t.insert(0, content); }
      else { t = new Y.Text(); t.insert(0, content); state.yFiles.set(path, t); }
    }
    for (const f of foldersOf([...textNames, ...z.assets.map(a => a.path)])) state.yFolders.set(f, true);
  });

  const failed = [];
  for (const a of z.assets) {
    try { await fb.uploadAsset(state.project.id, a.path, a.bytes); }
    catch (e) { failed.push(a.path + " — " + (e.message || e.code)); }
  }
  await refreshAssets();

  const main = pickMainFrom(z.texts);
  if (main && state.yFiles.get(main)) mountEditor(main);

  const parts = [`${textNames.length} archivo(s) de texto`, `${z.assets.length - failed.length} recurso(s)`];
  setStatus(`Importado: ${parts.join(" · ")}`, "#7ee0c2");
  if (failed.length) alert("No se pudieron subir estos recursos:\n\n" + failed.slice(0, 10).join("\n"));
}

/* crea un proyecto nuevo a partir de un .zip (desde el dashboard) */
async function createProjectFromZip(file, btn) {
  let z;
  try { z = await readZip(file); }
  catch (e) { alert(e.message); return; }

  const textNames = Object.keys(z.texts);
  if (!textNames.length) {
    alert("El .zip no contiene archivos .tex. Descarga de Overleaf el «Source» del proyecto, no el PDF.");
    return;
  }
  const title = prompt("Nombre del proyecto:", titleFromZip(file.name));
  if (!title) return;

  const orig = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Importando…"; }
  try {
    const pid = await fb.createProject({
      title: title.slice(0, 140), uid: state.user.uid, userName: state.user.name, files: z.texts
    });
    const failed = [];
    for (const a of z.assets) {
      try { await fb.uploadAsset(pid, a.path, a.bytes); }
      catch (e) { failed.push(a.path); }
    }
    const main = pickMainFrom(z.texts);
    if (main && main !== "main.tex") {
      try { await fb.updateProjectMeta(pid, { mainFile: main }); } catch (e) {}
    }
    if (failed.length) alert(`El proyecto se creó, pero ${failed.length} recurso(s) no se pudieron subir:\n\n` + failed.slice(0, 10).join("\n"));
    openProject(pid);
  } catch (e) {
    alert("No se pudo crear el proyecto desde el .zip: " + (e.message || e.code));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

/* ---------- puente para el asistente IA (edita el doc Yjs) ---------- */
function aiWriteFile(path, content) {
  path = cleanPath(path);
  if (!path) throw new Error("ruta inválida");
  if (!/\.(tex|bib|txt|sty|cls|md|csv|dat)$/i.test(path))
    throw new Error("solo se pueden escribir archivos de texto (.tex, .bib, .sty…)");
  if (state.mode === "local") {
    state.localContent.set(path, content);
    scheduleLocalSave(path);
    renderFileTree();
    if (path === state.activeFile) mountEditor(path);
    return true;
  }
  let t = state.yFiles.get(path);
  state.ydoc.transact(() => {
    if (!t) { t = new Y.Text(); t.insert(0, content); state.yFiles.set(path, t); }
    else { t.delete(0, t.length); t.insert(0, content); }
  });
  renderFileTree();
  if (path === state.activeFile) mountEditor(path);
  return true;
}

function aiStrReplace(path, oldStr, newStr) {
  path = cleanPath(path);
  const s = fileText(path);
  if (s == null) throw new Error("no existe el archivo de texto: " + path);
  const i = s.indexOf(oldStr);
  if (i < 0) throw new Error("no se encontró el texto a reemplazar en " + path);
  if (s.indexOf(oldStr, i + 1) >= 0) throw new Error("el texto aparece más de una vez; añade más contexto para que sea único");
  if (state.mode === "local") {
    state.localContent.set(path, s.slice(0, i) + newStr + s.slice(i + oldStr.length));
    scheduleLocalSave(path);
    if (path === state.activeFile) mountEditor(path);
    return true;
  }
  const t = state.yFiles.get(path);
  state.ydoc.transact(() => { t.delete(i, oldStr.length); t.insert(i, newStr); });
  return true;
}

function aiCreateFolder(path) {
  path = cleanPath(path);
  if (!path) throw new Error("ruta inválida");
  if (state.mode === "local") {
    lfs.makeFolder(state.dirHandle, path).catch(() => {});
    state.localFolders.add(path);
    state.collapsed.delete(path);
    renderFileTree();
    return true;
  }
  state.yFolders.set(path, true);
  state.collapsed.delete(path);
  renderFileTree();
  return true;
}

const aiApi = {
  isReadOnly: () => state.role === "view",
  getMainFile: () => resolveMainFile() || "(sin definir)",
  listFiles: () => ({ tex: texFileNames(), assets: state.assets.map(a => a.name) }),
  readFile: path => fileText(cleanPath(path)),
  writeFile: aiWriteFile,
  strReplace: aiStrReplace,
  createFolder: aiCreateFolder,
  getLastLog: () => state.lastCompile
};

/* ---------- CodeMirror ---------- */
/* El tema vive en un «compartment» para poder cambiarlo en caliente sin
   recrear el editor (y sin perder el estado ni la conexión de Yjs). */
const themeComp = new Compartment();
const visualComp = new Compartment();

function themeExtensions(name) {
  const p = THEMES[name] || THEMES[themeName()];
  return [cmThemeFor(p), syntaxHighlighting(cmHighlightFor(p))];
}

/* ---- resalte temporal de una línea (al saltar desde el PDF) ---- */
const setSyncLine = StateEffect.define();
const syncLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setSyncLine)) {
        if (e.value == null) return Decoration.none;
        const line = tr.state.doc.line(Math.min(e.value, tr.state.doc.lines));
        deco = Decoration.set([
          Decoration.line({ class: "cm-syncLine" }).range(line.from)
        ]);
      }
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f)
});

/* Extensiones comunes a los dos modos (nube y local). */
function commonExtensions() {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    highlightSelectionMatches(),
    StreamLanguage.define(stex),
    lintGutter(),            // icono en el margen junto a la línea con error
    themeComp.of(themeExtensions(themeName())),
    visualComp.of([]),
    syncLineField,
    EditorView.lineWrapping,
    /* doble clic en el código → ir a esa parte del PDF (funcionalidad 4) */
    EditorView.domEventHandlers({
      dblclick(ev, view) {
        const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY });
        if (pos == null) return false;
        syncCodeToPdf(view.state.doc.lineAt(pos).number);
        return false;   // no se cancela: el doble clic sigue seleccionando la palabra
      }
    })
  ];
}

/* Atajos propios. Ctrl+S compila en vez de guardar la página (funcionalidad 2)
   y Ctrl+Alt+J salta al PDF, como en TeXstudio/Overleaf. */
const colabKeymap = [
  { key: "Mod-s", preventDefault: true, run: () => { compile(); return true; } },
  { key: "Mod-Alt-j", preventDefault: true, run: view => {
      syncCodeToPdf(view.state.doc.lineAt(view.state.selection.main.head).number);
      return true;
    } },
  { key: "Mod-Alt-m", preventDefault: true, run: () => {
      if (state.comments) state.comments.startCommentOnSelection();
      return true;
    } },
  /* formato del texto seleccionado, con los atajos de siempre (src/format.js).
     Van los primeros del keymap, así que ganan a cualquier otro uso. */
  { key: "Mod-b", preventDefault: true, run: () => !!state.format && state.format.run("bold") },
  { key: "Mod-i", preventDefault: true, run: () => !!state.format && state.format.run("italic") },
  { key: "Mod-u", preventDefault: true, run: () => !!state.format && state.format.run("underline") }
];

/* editor local: CodeMirror plano + autoguardado en disco */
function mountLocalEditor(fileName) {
  if (!state.localContent.has(fileName)) return;
  if (state.preview) state.preview.close();   // abrir un .tex tapa la vista previa
  state.activeFile = fileName;
  $("activeFileName").textContent = fileName;
  renderFileTree();

  const extensions = [
    ...commonExtensions(),
    keymap.of([...colabKeymap, ...defaultKeymap, ...searchKeymap]),
    EditorView.updateListener.of(u => {
      if (u.docChanged) {
        state.localContent.set(fileName, u.state.doc.toString());
        scheduleLocalSave(fileName);
      }
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        $("lnCol").textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
      }
    })
  ];
  const stateCM = EditorState.create({ doc: state.localContent.get(fileName), extensions });
  if (state.editorView) state.editorView.setState(stateCM);
  else state.editorView = new EditorView({ state: stateCM, parent: $("cmHost") });
  applyDiagnostics();
  applyVisualMode();
  if (state.format) state.format.refresh();
}

function mountEditor(fileName) {
  if (state.mode === "local") return mountLocalEditor(fileName);
  const ytext = state.yFiles.get(fileName);
  if (!ytext) return;
  if (state.preview) state.preview.close();   // abrir un .tex tapa la vista previa
  state.activeFile = fileName;
  $("activeFileName").textContent = fileName;
  renderFileTree();

  const undoManager = new Y.UndoManager(ytext);
  const readOnly = state.role === "view";
  const extensions = [
    ...commonExtensions(),
    keymap.of([...colabKeymap, ...yUndoManagerKeymap, ...defaultKeymap, ...searchKeymap]),
    yCollab(ytext, state.provider.awareness, { undoManager }),
    ...(state.comments ? [state.comments.editorExtension()] : []),
    EditorView.updateListener.of(u => {
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        $("lnCol").textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
      }
    })
  ];
  if (readOnly) extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));

  const stateCM = EditorState.create({ doc: ytext.toString(), extensions });
  if (state.editorView) state.editorView.setState(stateCM);
  else state.editorView = new EditorView({ state: stateCM, parent: $("cmHost") });
  applyDiagnostics();
  applyVisualMode();
  if (state.format) state.format.refresh();
  if (state.comments) state.comments.onFileChanged();   // repinta el resalte del archivo nuevo
}

/* ============================================================
   Sincronía código ↔ PDF (SyncTeX)
   ============================================================ */

/* código → PDF: dónde queda en el documento la línea indicada */
function syncCodeToPdf(line, quiet) {
  if (!state.syncTex || !state.syncTex.ok) {
    if (!quiet) setStatus("Compila primero para poder sincronizar con el PDF", "#e2c08d");
    return false;
  }
  const pos = state.syncTex.forward(state.activeFile, line);
  if (!pos) {
    if (!quiet) setStatus(`«${state.activeFile}» no aparece en el PDF compilado`, "#e2c08d");
    return false;
  }
  const done = state.pdfViewer && state.pdfViewer.scrollTo(pos.page, pos.x, pos.y, pos.w, pos.h);
  if (done && !quiet) {
    setStatus(pos.exact
      ? `Línea ${line} → página ${pos.page}`
      : `Línea ${line} (sin marca exacta) → página ${pos.page}`, "#7ee0c2");
  }
  return done;
}

/* PDF → código: qué línea generó el punto donde se hizo doble clic */
async function syncPdfToCode(page, xPt, yPt) {
  if (!state.syncTex || !state.syncTex.ok) return;
  const hit = state.syncTex.inverse(page, xPt, yPt);
  if (!hit) return;

  // si el fragmento pertenece a otro archivo del proyecto, abrirlo antes
  if (hit.file !== state.activeFile) {
    const exists = state.mode === "local"
      ? state.localContent.has(hit.file)
      : (state.yFiles && state.yFiles.has(hit.file));
    if (!exists) { setStatus(`El PDF apunta a «${hit.file}», que no está en el proyecto`, "#e2c08d"); return; }
    mountEditor(hit.file);
  }

  const view = state.editorView;
  if (!view) return;
  const n = Math.min(Math.max(1, hit.line), view.state.doc.lines);
  const lineObj = view.state.doc.line(n);
  view.dispatch({
    selection: { anchor: lineObj.from },
    effects: [EditorView.scrollIntoView(lineObj.from, { y: "center" }), setSyncLine.of(n)]
  });
  view.focus();
  setStatus(`Página ${page} → ${hit.file}:${n}`, "#7ee0c2");
  // el resalte se quita solo cuando acaba la animación
  setTimeout(() => {
    if (state.editorView === view) view.dispatch({ effects: setSyncLine.of(null) });
  }, 1700);
}

/* ============================================================
   Errores de compilación marcados en el editor
   ============================================================ */
function applyDiagnostics() {
  const view = state.editorView;
  if (!view) return;
  const items = (state.diagnostics && state.diagnostics.get(state.activeFile)) || [];
  const doc = view.state.doc;

  const diags = [];
  for (const it of items) {
    const n = Math.min(Math.max(1, it.line), doc.lines);
    const line = doc.line(n);
    // subrayar el texto real de la línea, no el sangrado
    const from = line.from + (line.text.match(/^\s*/) || [""])[0].length;
    diags.push({
      from: Math.min(from, line.to),
      to: line.to,
      severity: it.severity,
      message: it.message + (it.detail ? "\n\n" + it.detail : "")
    });
  }
  diags.sort((a, b) => a.from - b.from);
  view.dispatch(setDiagnostics(view.state, diags));
}

/* Contador de errores en la barra del editor */
function renderDiagChip() {
  const chip = $("diagChip");
  if (!state.diagnostics) { chip.style.display = "none"; return; }
  let err = 0, warn = 0;
  for (const arr of state.diagnostics.values())
    for (const it of arr) (it.severity === "error" ? err++ : warn++);
  if (!err && !warn) { chip.style.display = "none"; return; }
  chip.style.display = "";
  chip.className = "diag-chip " + (err ? "has-err" : "has-warn");
  chip.textContent = err ? `${err} ✗${warn ? "  " + warn + " ⚠" : ""}` : `${warn} ⚠`;
  chip.title = "Ir al primer problema";
  chip.onclick = () => gotoFirstDiagnostic();
}

/* Salta al primer error, abriendo el archivo que lo contiene */
function gotoFirstDiagnostic() {
  if (!state.diagnostics) return;
  let target = null;
  for (const [file, arr] of state.diagnostics) {
    for (const it of arr) {
      if (it.severity !== "error") continue;
      if (!target) target = { file, it };
    }
  }
  if (!target) {
    for (const [file, arr] of state.diagnostics) { if (arr.length) { target = { file, it: arr[0] }; break; } }
  }
  if (!target) return;

  const exists = state.mode === "local"
    ? state.localContent.has(target.file)
    : (state.yFiles && state.yFiles.has(target.file));
  if (exists && target.file !== state.activeFile) mountEditor(target.file);

  const view = state.editorView;
  if (!view) return;
  const n = Math.min(Math.max(1, target.it.line), view.state.doc.lines);
  const line = view.state.doc.line(n);
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: "center" })
  });
  view.focus();
}

/* ============================================================
   Modo Visual (funcionalidad 1)
   ============================================================ */
const VISUAL_KEY = "colabtex_visual";

function visualOn() { return localStorage.getItem(VISUAL_KEY) === "1"; }

async function setVisualMode(on) {
  localStorage.setItem(VISUAL_KEY, on ? "1" : "0");
  $("tabCode").classList.toggle("code-tab-on", !on);
  $("tabVisual").classList.toggle("code-tab-on", on);
  if (on) {
    try {
      setStatus("Preparando la vista visual…", "#e2c08d");
      await loadKatex();
      setStatus("Vista visual activa", "#7ee0c2");
    } catch (e) {
      setStatus("No se pudo cargar KaTeX; se mantiene la vista de código", "#e57373");
      localStorage.setItem(VISUAL_KEY, "0");
      $("tabCode").classList.add("code-tab-on");
      $("tabVisual").classList.remove("code-tab-on");
      return;
    }
  }
  applyVisualMode();
}

function applyVisualMode() {
  const on = visualOn();
  $("tabCode").classList.toggle("code-tab-on", !on);
  $("tabVisual").classList.toggle("code-tab-on", on);
  if (!state.editorView) return;
  // solo tiene sentido en archivos LaTeX
  const isTex = /\.tex$/i.test(state.activeFile || "");
  state.editorView.dispatch({
    effects: visualComp.reconfigure(on && isTex && window.katex ? visualExtensions() : [])
  });
}

/* ============================================================
   Temas
   ============================================================ */
function applyTheme(name) {
  saveThemeName(name);
  const p = THEMES[name];
  applyCssVars(p);
  if (state.editorView)
    state.editorView.dispatch({ effects: themeComp.reconfigure(themeExtensions(name)) });
}

function initThemeSelector() {
  const sel = $("themeSelect");
  if (!sel) return;
  sel.innerHTML = "";
  for (const k in THEMES) {
    const o = document.createElement("option");
    o.value = k; o.textContent = THEMES[k].label;
    sel.appendChild(o);
  }
  sel.value = themeName();
  sel.onchange = () => applyTheme(sel.value);
  applyCssVars(THEMES[themeName()]);
}

/* ---------- presencia ---------- */
function renderPresence() {
  if (!state.provider) return;
  const states = Array.from(state.provider.awareness.getStates().values());
  const seen = new Map();
  for (const s of states) {
    if (s.user && s.user.uid && !seen.has(s.user.uid)) seen.set(s.user.uid, s.user);
  }
  const cont = $("presenceAvatars");
  cont.innerHTML = "";
  let i = 0;
  for (const u of seen.values()) {
    if (i >= 6) break;
    const el = document.createElement("span");
    el.className = "presence-avatar";
    el.style.background = u.color || "#0d9488";
    el.style.marginLeft = i > 0 ? "-7px" : "0";
    el.title = u.uid === state.user.uid ? "Tú" : u.name;
    el.textContent = (u.name || "?").charAt(0).toUpperCase();
    cont.appendChild(el);
    i++;
  }
  const others = Math.max(0, seen.size - 1);
  $("onlineCount").textContent = others === 0 ? "solo tú en línea" : `${others} colaborador${others === 1 ? "" : "es"} más en línea`;
}

/* ---------- compilación ---------- */
function engineStatus(msg) {
  if (/Descargando|Preparando|downloads complete/i.test(msg)) appendLog(msg);
}

function appendLog(line) {
  const el = $("logContent");
  el.textContent += line + "\n";
  el.scrollTop = el.scrollHeight;
}

async function compile() {
  if (state.compiling) return;
  if (state.mode === "cloud" && !state.yFiles) return;
  if (state.mode === "local") await flushLocalSaves();
  const texNames = texFileNames();
  const main = resolveMainFile();
  if (!main) { alert("No hay ningún archivo .tex con \\documentclass en el proyecto."); return; }

  state.compiling = true;
  $("btnCompile").textContent = "Compilando…";
  setStatus("Compilando…", "#e2c08d");
  $("logContent").textContent = "";
  const t0 = performance.now();

  try {
    const files = [];
    for (const name of texNames) files.push({ path: name, contents: fileText(name) || "" });
    for (const a of state.assets) files.push({ path: a.name, contents: await assetBytes(a) });

    const result = await state.engine.compile(files, main);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const sum = summarizeLog(result);
    state.lastCompile = { ok: !!(result.pdf && result.pdf.length > 0), errors: sum.errors, warnings: sum.warnings };

    // mapa de sincronía y errores por archivo/línea de esta compilación
    state.syncTex = new SyncTex(result.synctex || "");
    state.diagnostics = groupByFile(parseTexLog(sum.full, main));
    applyDiagnostics();
    renderDiagChip();

    if (result.pdf && result.pdf.length > 0) {
      await state.pdfViewer.load(result.pdf);
      const nErr = sum.errors.length;
      if (nErr) {
        // sin --halt-on-error hay PDF aunque haya fallos: se avisa igualmente
        setStatus(`Compilado con ${nErr} error${nErr === 1 ? "" : "es"} (${secs} s)`, "#e2c08d");
        $("logSummary").innerHTML = `<span style="color:#e2c08d;font-weight:500">⚠ PDF generado, pero con ${nErr} error${nErr === 1 ? "" : "es"} — pdflatex · ${secs} s · ${sum.warnings.length} advertencias</span>`;
      } else {
        setStatus(`Compilado en ${secs} s`, "#7ee0c2");
        $("logSummary").innerHTML = `<span style="color:#7ee0c2;font-weight:500">✓ Compilación correcta — pdflatex · ${secs} s · 0 errores · ${sum.warnings.length} advertencias</span>`;
      }
    } else {
      setStatus("Error de compilación", "#e57373");
      $("logSummary").innerHTML = `<span style="color:#e57373;font-weight:500">✗ La compilación falló — revisa el registro (${sum.errors.length} error${sum.errors.length === 1 ? "" : "es"})</span>`;
      $("logPanel").style.display = "flex";
    }
    const parts = [];
    for (const e of sum.errors) parts.push("✗ " + e);
    for (const w of sum.warnings) parts.push("⚠ " + w);
    $("logContent").textContent = parts.join("\n") + (parts.length ? "\n\n" : "") + "── registro completo ──\n" + sum.full.slice(-8000);
    $("btnToggleLog").textContent = `Registro · ${sum.errors.length ? sum.errors.length + "✗ " : ""}${sum.warnings.length}⚠`;
  } catch (err) {
    setStatus("Error de compilación", "#e57373");
    appendLog("✗ " + err.message);
    $("logPanel").style.display = "flex";
    state.lastCompile = { ok: false, errors: [err.message], warnings: [] };
  } finally {
    state.compiling = false;
    $("btnCompile").textContent = "▶ Compilar";
  }
}

/* ---------- compartir ---------- */
function shareLink(token) {
  return location.origin + location.pathname + "?p=" + state.project.id + "&t=" + token;
}

async function openShareModal() {
  $("shareModal").style.display = "grid";
  try {
    state.project = await fb.getProject(state.project.id, state.user.uid) || state.project;
  } catch (e) {}
  const tokens = state.project.tokens || {};
  $("btnCopyEdit").onclick = () => copyToClipboard(shareLink(tokens.edit), $("btnCopyEdit"));
  $("btnCopyView").onclick = () => copyToClipboard(shareLink(tokens.view), $("btnCopyView"));
  // miembros en vivo mientras el modal está abierto
  if (state.membersUnsub) state.membersUnsub();
  state.membersUnsub = fb.watchMembers(state.project.id, members => {
    state.project.members = members;
    renderMembers();
  });
}

function closeShareModal() {
  $("shareModal").style.display = "none";
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
}

function renderMembers() {
  const cont = $("membersList");
  cont.innerHTML = "";
  const online = new Set();
  if (state.provider) {
    for (const s of state.provider.awareness.getStates().values())
      if (s.user && s.user.uid) online.add(s.user.uid);
  }
  for (const m of state.project.members || []) {
    const div = document.createElement("div");
    div.className = "member-row";
    div.innerHTML = `
      <span class="member-avatar" style="background:${colorForUid(m.uid)}">${escapeHtml((m.name || "?").charAt(0).toUpperCase())}</span>
      <div class="member-info">
        <span class="member-name">${escapeHtml(m.name)}${m.uid === state.user.uid ? " (tú)" : ""}</span>
        <span class="member-status">${online.has(m.uid) ? '<span style="color:#0d9488">● en línea</span>' : "desconectado"}</span>
      </div>
      <span class="member-role">${ROLE_LABEL[m.role] || m.role}</span>`;
    cont.appendChild(div);
  }
}

/* ---------- configuración del proyecto ---------- */
function openSettingsModal() {
  $("settingsModal").style.display = "grid";
  const readOnly = state.role === "view";
  const isLocal = state.mode === "local";
  $("setTitle").value = state.project.title;
  // en local el "título" es el nombre de la carpeta en disco: no se renombra aquí
  $("setTitle").disabled = readOnly || isLocal;

  const sel = $("setMainFile");
  sel.innerHTML = "";
  const texs = texFileNames().filter(n => n.endsWith(".tex"));
  const auto = document.createElement("option");
  auto.value = "";
  auto.textContent = "Automático (main.tex o el primero con \\documentclass)";
  sel.appendChild(auto);
  for (const n of texs) {
    const o = document.createElement("option");
    o.value = n; o.textContent = n;
    sel.appendChild(o);
  }
  sel.value = state.project.mainFile && texs.includes(state.project.mainFile) ? state.project.mainFile : "";
  sel.disabled = readOnly;
  $("btnSaveSettings").style.display = readOnly ? "none" : "";
  $("setSavedMsg").textContent = "";

  // en modo local no hay miembros ni proyecto en la nube que borrar
  for (const id of ["setMembersLabel", "setMembersList", "setDangerLabel", "setDanger"])
    $(id).style.display = isLocal ? "none" : "";
  if (isLocal) return;

  if (state.membersUnsub) state.membersUnsub();
  state.membersUnsub = fb.watchMembers(state.project.id, members => {
    state.project.members = members;
    renderSettingsMembers();
  });
  renderSettingsMembers();
  renderDangerZone();
}

function closeSettingsModal() {
  $("settingsModal").style.display = "none";
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
}

async function saveSettings() {
  const title = $("setTitle").value.trim().slice(0, 140) || state.project.title;
  const mainFile = $("setMainFile").value || null;

  // local: no hay nube; la preferencia se guarda en este navegador
  if (state.mode === "local") {
    state.project.mainFile = mainFile;
    const key = LOCAL_MAIN_PREFIX + state.dirHandle.name;
    if (mainFile) localStorage.setItem(key, mainFile);
    else localStorage.removeItem(key);
    $("setSavedMsg").textContent = "✓ Archivo principal: " + (mainFile || "automático");
    $("setSavedMsg").style.color = "#0d9488";
    setTimeout(() => { $("setSavedMsg").textContent = ""; }, 2500);
    return;
  }

  try {
    await fb.updateProjectMeta(state.project.id, { title, mainFile });
  } catch (e) {
    $("setSavedMsg").textContent = "No se pudo guardar: " + (e.code || e.message);
    $("setSavedMsg").style.color = "#c0392b";
    return;
  }
  state.project.title = title;
  state.project.mainFile = mainFile;
  $("edTitle").textContent = title;
  $("setSavedMsg").textContent = "✓ Cambios guardados";
  $("setSavedMsg").style.color = "#0d9488";
  setTimeout(() => { $("setSavedMsg").textContent = ""; }, 2500);
}

function renderSettingsMembers() {
  const cont = $("setMembersList");
  if (!cont || $("settingsModal").style.display === "none") return;
  cont.innerHTML = "";
  const iAmOwner = state.role === "owner";
  for (const m of state.project.members || []) {
    const row = document.createElement("div");
    row.className = "member-row";
    const manageable = iAmOwner && m.role !== "owner";
    row.innerHTML = `
      <span class="member-avatar" style="background:${colorForUid(m.uid)}">${escapeHtml((m.name || "?").charAt(0).toUpperCase())}</span>
      <div class="member-info">
        <span class="member-name">${escapeHtml(m.name)}${m.uid === state.user.uid ? " (tú)" : ""}</span>
      </div>
      ${manageable
        ? `<select class="set-role">
             <option value="edit"${m.role === "edit" ? " selected" : ""}>Puede editar</option>
             <option value="view"${m.role === "view" ? " selected" : ""}>Solo lectura</option>
           </select>
           <button class="mini-btn set-kick">Quitar</button>`
        : `<span class="member-role">${ROLE_LABEL[m.role] || m.role}</span>`}`;
    const roleSel = row.querySelector(".set-role");
    if (roleSel) roleSel.onchange = async () => {
      try { await fb.setMemberRole(state.project.id, m.uid, roleSel.value); }
      catch (e) { alert("No se pudo cambiar el rol: " + (e.code || e.message)); roleSel.value = m.role; }
    };
    const kick = row.querySelector(".set-kick");
    if (kick) kick.onclick = async () => {
      if (!confirm(`¿Quitar a ${m.name} del proyecto?`)) return;
      try { await fb.removeMember(state.project.id, m.uid); }
      catch (e) { alert("No se pudo quitar al miembro: " + (e.code || e.message)); }
    };
    cont.appendChild(row);
  }
}

function renderDangerZone() {
  const cont = $("setDanger");
  cont.innerHTML = "";
  const btn = document.createElement("button");
  btn.className = "btn-danger";
  if (state.role === "owner") {
    btn.textContent = "Eliminar proyecto";
    btn.onclick = async () => {
      if (!confirm(`¿Eliminar el proyecto "${state.project.title}"? Esta acción no se puede deshacer.`)) return;
      const pid = state.project.id;
      closeSettingsModal();
      try { await fb.deleteProject(pid); }
      catch (e) { alert("No se pudo eliminar: " + (e.code || e.message)); return; }
      history.pushState({}, "", location.pathname);
      teardownEditor();
      showDashboard();
    };
    cont.appendChild(btn);
  } else {
    btn.textContent = "Abandonar proyecto";
    btn.onclick = async () => {
      if (!confirm(`¿Salir del proyecto "${state.project.title}"? Perderás el acceso (podrás volver si te comparten un enlace).`)) return;
      const pid = state.project.id;
      closeSettingsModal();
      try { await fb.leaveProject(pid, state.user.uid); }
      catch (e) { alert("No se pudo abandonar el proyecto: " + (e.code || e.message)); return; }
      history.pushState({}, "", location.pathname);
      teardownEditor();
      showDashboard();
    };
    cont.appendChild(btn);
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

async function invite() {
  const email = $("inviteEmail").value.trim();
  const role = $("inviteRole").value;
  const inv = await fb.createInvite(state.project.id, { email, role });
  const link = shareLink(inv.token);
  const list = $("inviteList");
  const div = document.createElement("div");
  div.className = "invite-row";
  div.innerHTML = `
    <div class="invite-info">
      <span class="invite-email">${escapeHtml(email || "Enlace de invitación")}</span>
      <span class="invite-role">${inv.role === "edit" ? "Puede editar" : "Solo lectura"} · pendiente</span>
    </div>
    <button class="mini-btn" data-act="copy">Copiar enlace</button>
    ${email ? '<button class="mini-btn" data-act="mail">Enviar correo</button>' : ""}`;
  div.querySelector('[data-act="copy"]').onclick = e => copyToClipboard(link, e.target);
  const mail = div.querySelector('[data-act="mail"]');
  if (mail) mail.onclick = () => {
    const subject = encodeURIComponent(`Invitación a colaborar: ${state.project.title}`);
    const body = encodeURIComponent(`Hola,\n\n${state.user.name} te ha invitado a colaborar en el proyecto "${state.project.title}" en ColabTeX.\n\nAbre este enlace para unirte (inicia sesión con Google):\n${link}\n`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };
  list.prepend(div);
  $("inviteEmail").value = "";
}

/* ================================================ eventos UI */
function wireEvents() {
  $("btnGoogleLogin").onclick = doLogin;
  $("btnLocalNoAccount").onclick = () => openLocalFolder(null);
  $("btnLogout").onclick = async () => { teardownEditor(); await logout(); };

  // dashboard
  $("btnNewProject").onclick = async () => {
    const title = prompt("Nombre del nuevo proyecto:", "Nuevo documento");
    if (!title) return;
    const safeTitle = title.slice(0, 140);
    const main = TEMPLATE_MAIN
      .replace("TITLE", safeTitle.replace(/([\\{}$&#^_%~])/g, "\\$1"))
      .replace("AUTHOR", state.user.name || "Autor");
    const pid = await fb.createProject({
      title: safeTitle, uid: state.user.uid, userName: state.user.name,
      files: { "main.tex": main, "referencias.bib": TEMPLATE_BIB }
    });
    openProject(pid);
  };
  $("btnOpenLocal").onclick = () => openLocalFolder(null);
  $("btnReloadLocal").onclick = reloadLocalFolder;
  $("btnVsCode").onclick = onVsCodeClick;
  $("btnNewFromZip").onclick = () => $("zipNewInput").click();
  $("zipNewInput").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) await createProjectFromZip(f, $("btnNewFromZip"));
  };
  $("searchInput").oninput = e => { state.search = e.target.value; renderProjects(); };
  $("navAll").onclick = () => { state.filter = "all"; renderProjects(); };
  $("navMine").onclick = () => { state.filter = "mine"; renderProjects(); };
  $("navShared").onclick = () => { state.filter = "shared"; renderProjects(); };

  // editor: header
  $("btnBackDash").onclick = () => {
    history.pushState({}, "", location.pathname);
    teardownEditor();
    // en modo local se puede entrar sin cuenta: volver al login si no hay sesión
    if (state.user) showDashboard(); else showLogin();
  };
  $("edTitle").onclick = async () => {
    if (!state.project || state.role === "view") return;
    const t = prompt("Renombrar proyecto:", state.project.title);
    if (!t || t === state.project.title) return;
    await fb.renameProject(state.project.id, t.slice(0, 140));
    state.project.title = t.slice(0, 140);
    $("edTitle").textContent = state.project.title;
  };
  $("btnCompile").onclick = compile;
  $("btnRecompile").onclick = compile;
  $("btnShare").onclick = openShareModal;
  $("btnSyncToPdf").onclick = () => {
    const v = state.editorView;
    if (v) syncCodeToPdf(v.state.doc.lineAt(v.state.selection.main.head).number);
  };
  $("tabCode").onclick = () => setVisualMode(false);
  $("tabVisual").onclick = () => setVisualMode(true);
  initThemeSelector();

  /* Ctrl+S compila (funcionalidad 2). El atajo de CodeMirror solo actúa con el
     foco en el editor; este captura el resto de la página (PDF, árbol, etc.). */
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S")) {
      if ($("viewEditor").style.display === "none") return;   // fuera del editor, no tocar
      e.preventDefault();
      compile();
    }
  });

  // editor: archivos y carpetas
  $("btnNewFile").onclick = () => newFileIn("");
  $("btnNewFolder").onclick = () => newFolderIn("");
  $("btnUploadFile").onclick = () => { state.uploadPrefix = ""; $("fileUploadInput").click(); };
  $("btnImportZip").onclick = () => $("zipUploadInput").click();
  $("btnZipProject").onclick = zipProject;
  $("btnLinkDraw").onclick = () => openLinkModal();
  $("btnCloseLink").onclick = () => $("linkModal").classList.remove("open");
  $("linkModal").onclick = e => { if (e.target === $("linkModal")) $("linkModal").classList.remove("open"); };
  $("btnDoLink").onclick = doLink;
  $("zipUploadInput").onchange = async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) await importZipIntoProject(f);
  };
  $("fileUploadInput").onchange = async e => {
    const prefix = state.uploadPrefix || "";
    for (const f of e.target.files) {
      // espacios → _ : LaTeX no acepta espacios en \includegraphics
      const name = cleanPath(prefix + f.name.trim().replace(/\s+/g, "_"));
      if (!name) continue;
      const ext = fileExt(name);
      try {
        if (state.mode === "local") {
          if (TEXT_EXT.includes(ext)) {
            const text = await f.text();
            state.localContent.set(name, text);
            const h = await lfs.writeText(state.dirHandle, name, text);
            state.localHandles.set(name, h);
          } else {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const h = await lfs.writeBytes(state.dirHandle, name, bytes);
            state.assets = state.assets.filter(a => a.name !== name)
              .concat([{ name, key: name, size: bytes.length, loc: "local", handle: h }]);
          }
        } else if (TEXT_EXT.includes(ext)) {
          const text = await f.text();
          const t = new Y.Text();
          t.insert(0, text);
          state.yFiles.set(name, t);
        } else {
          await fb.uploadAsset(state.project.id, name, await f.arrayBuffer());
        }
      } catch (err) {
        alert("Error al subir " + name + ": " + err.message);
      }
    }
    e.target.value = "";
    state.uploadPrefix = "";
    await refreshAssets();
  };

  // visor PDF
  $("btnZoomIn").onclick = async () => { const s = await state.pdfViewer.setScale(state.pdfViewer.scale + 0.1); $("zoomLabel").textContent = Math.round(s * 100) + "%"; };
  $("btnZoomOut").onclick = async () => { const s = await state.pdfViewer.setScale(state.pdfViewer.scale - 0.1); $("zoomLabel").textContent = Math.round(s * 100) + "%"; };
  $("btnDownloadPdf").onclick = () => state.pdfViewer && state.pdfViewer.download((state.project ? state.project.title.replace(/[^\w\- ]+/g, "") : "documento") + ".pdf");
  $("btnToggleLog").onclick = () => {
    const p = $("logPanel");
    p.style.display = p.style.display === "none" || !p.style.display ? "flex" : "none";
  };

  // modal compartir
  $("shareModal").onclick = e => { if (e.target === $("shareModal")) closeShareModal(); };
  $("btnCloseShare").onclick = closeShareModal;
  $("btnInvite").onclick = () => invite().catch(err => alert(err.message));

  // asistente IA
  state.assistant = createAssistant(aiApi);
  $("btnAiToggle").onclick = () => state.assistant.toggle();

  // comentarios sobre el texto (solo proyectos en la nube)
  state.comments = createComments({
    getYComments: () => state.yComments,
    getYdoc: () => state.ydoc,
    getYFiles: () => state.yFiles,
    getActiveFile: () => state.activeFile,
    getView: () => state.editorView,
    getUser: () => state.user,
    canWrite: () => state.role !== "view",
    isOwner: () => state.role === "owner",
    isCloud: () => state.mode === "cloud",
    openFile: name => { if (name && name !== state.activeFile) mountEditor(name); }
  });
  $("btnCommentsToggle").onclick = () => state.comments.toggle();

  // arrastrar archivos y carpetas dentro del árbol
  state.dnd = createTreeDnD((from, to, isFolder) =>
    moveEntry(from, to, isFolder).catch(err => alert("No se pudo mover: " + (err.message || err))));

  /* formato del texto seleccionado: negrita, cursiva, subrayado y color.
     Los botones solo aparecen sobre un archivo LaTeX y con permiso de
     escritura; los atajos viven en colabKeymap. */
  state.format = createFormatBar({
    getView: () => state.editorView,
    canWrite: () => state.role !== "view",
    isTexFile: () => /\.(tex|sty|cls)$/i.test(state.activeFile || ""),
    ensureColorPackage
  });
  state.format.wire();

  // vista previa de imágenes y PDF del árbol de archivos
  state.preview = new AssetPreview({
    fetchBytes: assetBytes,
    canInsert: name => state.role !== "view" && INSERTABLE.includes(fileExt(name)),
    // el editor está oculto tras la vista previa: primero insertar, luego
    // volver a él y devolverle el foco para seguir escribiendo
    onInsert: asset => {
      if (!insertAssetSnippet(asset)) return;
      closeAssetPreview();
      state.editorView.focus();
    },
    onRequestClose: closeAssetPreview
  });

  // modal configuración
  $("btnSettings").onclick = openSettingsModal;
  $("settingsModal").onclick = e => { if (e.target === $("settingsModal")) closeSettingsModal(); };
  $("btnCloseSettings").onclick = closeSettingsModal;
  $("btnSaveSettings").onclick = saveSettings;

  /* beforeunload se dispara también en navegaciones que el navegador acaba
     CANCELANDO (protocolos externos como vscode://, descargas, enlaces
     bloqueados). Cerrar aquí el proveedor dejaba la pestaña editando en
     memoria pero sin guardar en la nube, y sin ningún aviso. Aquí solo se
     avisa de lo que falta por escribir en disco. */
  window.addEventListener("beforeunload", e => {
    if (state.mode === "local" && state.dirty.size) {
      flushLocalSaves();
      e.preventDefault();
      e.returnValue = "";        // hay cambios sin escribir en disco
    }
  });

  /* La descarga real de la página sí cierra el proveedor, para que los
     colaboradores te vean salir en el acto. Con persisted=true la página
     va a la caché de retroceso y volverá a usarse: ahí no se toca. */
  window.addEventListener("pagehide", e => {
    if (!e.persisted && state.provider) state.provider.destroy();
  });
}

/* ================================================ arranque */
(function boot() {
  wireEvents();
  initLayout();
  // si la vista visual quedó activa, ir cargando KaTeX desde ya
  if (visualOn()) loadKatex().then(applyVisualMode).catch(() => {});
  watchAuth(async user => {
    // si se está editando una carpeta local, no cambiar de vista por auth
    if (state.mode === "local" && state.dirHandle) {
      state.user = user ? { uid: user.uid, name: user.displayName || user.email || "Usuario", photo: user.photoURL || "", color: colorForUid(user.uid) } : null;
      return;
    }
    if (!user) {
      state.user = null;
      showLogin();
      return;
    }
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
