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
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { stex } from "@codemirror/legacy-modes/mode/stex";

import { watchAuth, loginGoogle, logout } from "./firebase.js";
import * as fb from "./fb-api.js";
import { RtdbProvider } from "./y-rtdb.js";
import { colorForUid, colorLight, timeAgo, escapeHtml } from "./util.js";
import { LatexEngine, summarizeLog } from "./latex.js";
import { PdfViewer } from "./pdfview.js";
import { createAssistant } from "./ai-assistant.js";

const $ = id => document.getElementById(id);
const ROLE_LABEL = { owner: "Propietario", edit: "Puede editar", view: "Solo lectura" };

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
  collapsed: new Set(),  // carpetas plegadas (solo UI local)
  uploadPrefix: "",      // carpeta destino de la próxima subida
  activeFile: null,
  editorView: null,
  assets: [],
  assetCache: new Map(), // key+size → bytes (evita re-descargar al compilar)
  engine: null,
  pdfViewer: null,
  compiling: false,
  membersUnsub: null,
  assistant: null,       // panel de IA (creado en boot)
  lastCompile: null      // {ok, errors[], warnings[]} para el asistente
};

/* ================================================ enrutado */
function route() {
  const params = new URLSearchParams(location.search);
  const p = params.get("p");
  const t = params.get("t");
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
  $("projectRows").innerHTML = '<div style="padding:16px;font-size:12.5px;color:#8a97a3">Cargando proyectos…</div>';
  try {
    state.projects = await fb.listProjects(u.uid);
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
  });
  state.yFiles.observe(() => renderFileTree());
  state.yFolders.observe(() => renderFileTree());

  // ---- assets ----
  await refreshAssets();

  // ---- visor PDF ----
  if (!state.pdfViewer) {
    state.pdfViewer = new PdfViewer($("pdfScroll"), {
      onPageInfo: (cur, total) => { $("pageLabel").textContent = `Página ${cur} / ${total}`; }
    });
  }

  // ---- motor LaTeX ----
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

  renderPresence();
}

function teardownEditor() {
  if (state.membersUnsub) { state.membersUnsub(); state.membersUnsub = null; }
  if (state.editorView) { state.editorView.destroy(); state.editorView = null; }
  if (state.provider) { state.provider.destroy(); state.provider = null; }
  if (state.ydoc) { state.ydoc.destroy(); state.ydoc = null; }
  state.project = null; state.yFiles = null; state.yFolders = null; state.activeFile = null;
  state.assets = [];
  state.assetCache.clear();
  state.collapsed = new Set();
  state.uploadPrefix = "";
  state.lastCompile = null;
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
  return Array.from(state.yFiles ? state.yFiles.keys() : []).sort();
}

/* archivo .tex que se compilará: preferencia del proyecto → main.tex →
   primero con \documentclass */
function resolveMainFile() {
  const texNames = texFileNames();
  if (state.project && state.project.mainFile && texNames.includes(state.project.mainFile)) return state.project.mainFile;
  if (texNames.includes("main.tex")) return "main.tex";
  for (const n of texNames) {
    if (n.endsWith(".tex") && state.yFiles.get(n).toString().includes("\\documentclass")) return n;
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
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return ["IMG", "#b58bf5"];
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
  if (!state.yFiles) return;
  const readOnly = state.role === "view";
  const parentOf = p => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";

  // carpetas explícitas (Y.Map "folders") + implícitas por las rutas
  const folders = new Set(state.yFolders ? Array.from(state.yFolders.keys()) : []);
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

  const fileEntry = (name, asset, depth) => {
    const [kind, color] = FILE_KIND(name);
    const base = name.split("/").pop();
    const canInsert = asset && !readOnly && INSERTABLE.includes(fileExt(name));
    const div = document.createElement("div");
    div.className = "file-entry" + (name === state.activeFile && !asset ? " file-active" : "");
    div.style.paddingLeft = (12 + depth * 14) + "px";
    div.title = name;
    div.innerHTML = `<span class="file-badge" style="color:${color};border-color:${color}">${kind}</span>
      <span class="file-name">${escapeHtml(base)}</span>
      ${canInsert ? '<button class="file-act" data-act="ins" title="Insertar en el archivo activo">⤷</button>' : ""}
      ${readOnly ? "" : '<button class="file-act file-del" data-act="del" title="Eliminar archivo">✕</button>'}`;
    div.onclick = () => { if (!asset) mountEditor(name); };
    const ins = div.querySelector('[data-act="ins"]');
    if (ins) ins.onclick = e => { e.stopPropagation(); insertAssetSnippet(asset); };
    const del = div.querySelector('[data-act="del"]');
    if (del) del.onclick = async e => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar "${name}" del proyecto?`)) return;
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
    const div = document.createElement("div");
    div.className = "file-entry folder-entry";
    div.style.paddingLeft = (12 + depth * 14) + "px";
    div.title = path;
    div.innerHTML = `<span class="folder-arrow">${collapsed ? "▸" : "▾"}</span>
      <span class="file-name">${escapeHtml(path.split("/").pop())}</span>
      ${readOnly ? "" : `<button class="file-act" data-act="new" title="Nuevo archivo aquí">＋</button>
      <button class="file-act" data-act="up" title="Subir archivos aquí">↑</button>
      <button class="file-act file-del" data-act="del" title="Eliminar carpeta">✕</button>`}`;
    div.onclick = () => {
      if (collapsed) state.collapsed.delete(path); else state.collapsed.add(path);
      renderFileTree();
    };
    const stop = (act, fn) => {
      const b = div.querySelector(`[data-act="${act}"]`);
      if (b) b.onclick = e => { e.stopPropagation(); fn(); };
    };
    stop("new", () => newFileIn(path + "/"));
    stop("up", () => { state.uploadPrefix = path + "/"; $("fileUploadInput").click(); });
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
  if (state.yFiles.has(name)) { alert("Ya existe un archivo con ese nombre."); return; }
  const t = new Y.Text();
  state.yFiles.set(name, t);
  mountEditor(name);
}

function newFolderIn(prefix) {
  let name = prompt("Nombre de la nueva carpeta (puede anidar: cap1/figuras):", "figuras");
  if (!name) return;
  name = cleanPath(prefix + name);
  if (!name) return;
  state.yFolders.set(name, true);
  state.collapsed.delete(name);
  renderFileTree();
}

async function deleteFolder(path) {
  const prefix = path + "/";
  const texToDelete = texFileNames().filter(n => n.startsWith(prefix));
  const assetsToDelete = state.assets.filter(a => a.name.startsWith(prefix));
  const total = texToDelete.length + assetsToDelete.length;
  if (!confirm(`¿Eliminar la carpeta "${path}"${total ? ` y los ${total} archivo(s) que contiene` : ""}?`)) return;
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

/* inserta \includegraphics del asset en el punto del cursor */
function insertAssetSnippet(asset) {
  if (state.role === "view") return;
  if (!state.editorView || !state.activeFile || !/\.(tex|sty|cls)$/i.test(state.activeFile)) {
    alert("Abre un archivo .tex para insertar la referencia.");
    return;
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
}

async function refreshAssets() {
  try {
    state.assets = await fb.listAssets(state.project.id);
  } catch (e) { state.assets = []; }
  renderFileTree();
}

/* ---------- puente para el asistente IA (edita el doc Yjs) ---------- */
function aiWriteFile(path, content) {
  path = cleanPath(path);
  if (!path) throw new Error("ruta inválida");
  if (!/\.(tex|bib|txt|sty|cls|md|csv|dat)$/i.test(path))
    throw new Error("solo se pueden escribir archivos de texto (.tex, .bib, .sty…)");
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
  const t = state.yFiles.get(path);
  if (!t) throw new Error("no existe el archivo de texto: " + path);
  const s = t.toString();
  const i = s.indexOf(oldStr);
  if (i < 0) throw new Error("no se encontró el texto a reemplazar en " + path);
  if (s.indexOf(oldStr, i + 1) >= 0) throw new Error("el texto aparece más de una vez; añade más contexto para que sea único");
  state.ydoc.transact(() => { t.delete(i, oldStr.length); t.insert(i, newStr); });
  return true;
}

function aiCreateFolder(path) {
  path = cleanPath(path);
  if (!path) throw new Error("ruta inválida");
  state.yFolders.set(path, true);
  state.collapsed.delete(path);
  renderFileTree();
  return true;
}

const aiApi = {
  isReadOnly: () => state.role === "view",
  getMainFile: () => resolveMainFile() || "(sin definir)",
  listFiles: () => ({ tex: texFileNames(), assets: state.assets.map(a => a.name) }),
  readFile: path => { const t = state.yFiles.get(cleanPath(path)); return t ? t.toString() : null; },
  writeFile: aiWriteFile,
  strReplace: aiStrReplace,
  createFolder: aiCreateFolder,
  getLastLog: () => state.lastCompile
};

/* ---------- CodeMirror ---------- */
const cmTheme = EditorView.theme({
  "&": { backgroundColor: "#141c24", color: "#d5dee8", fontSize: "12.5px", height: "100%" },
  ".cm-content": { fontFamily: "'IBM Plex Mono',monospace", caretColor: "#0d9488", lineHeight: "1.7" },
  ".cm-cursor": { borderLeftColor: "#2dd4bf" },
  ".cm-gutters": { backgroundColor: "#141c24", color: "#44546a", border: "none" },
  ".cm-activeLine": { backgroundColor: "rgba(36,50,68,0.5)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(36,50,68,0.5)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#2a3a4c !important" },
  ".cm-selectionMatch": { backgroundColor: "rgba(13,148,136,0.3)" }
}, { dark: true });

const cmHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "#5f7285", fontStyle: "italic" },
  { tag: tags.tagName, color: "#6cb6ff" },
  { tag: tags.keyword, color: "#6cb6ff" },
  { tag: tags.atom, color: "#7ee0c2" },
  { tag: tags.number, color: "#e2c08d" },
  { tag: tags.string, color: "#e2c08d" },
  { tag: tags.bracket, color: "#8fa3b8" }
]);

function mountEditor(fileName) {
  const ytext = state.yFiles.get(fileName);
  if (!ytext) return;
  state.activeFile = fileName;
  $("activeFileName").textContent = fileName;
  renderFileTree();

  const undoManager = new Y.UndoManager(ytext);
  const readOnly = state.role === "view";
  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    highlightSelectionMatches(),
    StreamLanguage.define(stex),
    syntaxHighlighting(cmHighlight),
    cmTheme,
    EditorView.lineWrapping,
    keymap.of([...yUndoManagerKeymap, ...defaultKeymap, ...searchKeymap]),
    yCollab(ytext, state.provider.awareness, { undoManager }),
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
  if (state.compiling || !state.yFiles) return;
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
    for (const name of texNames) files.push({ path: name, contents: state.yFiles.get(name).toString() });
    for (const a of state.assets) {
      const cacheKey = a.key + ":" + (a.size || 0);
      let bytes = state.assetCache.get(cacheKey);
      if (!bytes) {
        try {
          bytes = await fb.fetchAssetBytes(state.project.id, a);
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
      }
      files.push({ path: a.name, contents: bytes });
    }

    const result = await state.engine.compile(files, main);
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    const sum = summarizeLog(result);
    state.lastCompile = { ok: !!(result.pdf && result.pdf.length > 0), errors: sum.errors, warnings: sum.warnings };

    if (result.pdf && result.pdf.length > 0) {
      await state.pdfViewer.load(result.pdf);
      setStatus(`Compilado en ${secs} s`, "#7ee0c2");
      $("logSummary").innerHTML = `<span style="color:#7ee0c2;font-weight:500">✓ Compilación correcta — pdflatex · ${secs} s · ${sum.errors.length} errores · ${sum.warnings.length} advertencias</span>`;
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
  $("setTitle").value = state.project.title;
  $("setTitle").disabled = readOnly;

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
  $("searchInput").oninput = e => { state.search = e.target.value; renderProjects(); };
  $("navAll").onclick = () => { state.filter = "all"; renderProjects(); };
  $("navMine").onclick = () => { state.filter = "mine"; renderProjects(); };
  $("navShared").onclick = () => { state.filter = "shared"; renderProjects(); };

  // editor: header
  $("btnBackDash").onclick = () => { history.pushState({}, "", location.pathname); teardownEditor(); showDashboard(); };
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

  // editor: archivos y carpetas
  $("btnNewFile").onclick = () => newFileIn("");
  $("btnNewFolder").onclick = () => newFolderIn("");
  $("btnUploadFile").onclick = () => { state.uploadPrefix = ""; $("fileUploadInput").click(); };
  $("fileUploadInput").onchange = async e => {
    const TEXT_EXT = ["tex", "bib", "txt", "sty", "cls", "md", "csv", "dat"];
    const prefix = state.uploadPrefix || "";
    for (const f of e.target.files) {
      // espacios → _ : LaTeX no acepta espacios en \includegraphics
      const name = cleanPath(prefix + f.name.trim().replace(/\s+/g, "_"));
      if (!name) continue;
      const ext = fileExt(name);
      try {
        if (TEXT_EXT.includes(ext)) {
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

  // modal configuración
  $("btnSettings").onclick = openSettingsModal;
  $("settingsModal").onclick = e => { if (e.target === $("settingsModal")) closeSettingsModal(); };
  $("btnCloseSettings").onclick = closeSettingsModal;
  $("btnSaveSettings").onclick = saveSettings;

  window.addEventListener("beforeunload", () => { if (state.provider) state.provider.destroy(); });
}

/* ================================================ arranque */
(function boot() {
  wireEvents();
  watchAuth(async user => {
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
