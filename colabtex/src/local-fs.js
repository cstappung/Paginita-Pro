"use strict";
/* ============================================================
   ColabTeX — modo LOCAL (File System Access API)
   Permite abrir una carpeta del disco del usuario y editar el
   proyecto ahí mismo: los cambios se escriben en los archivos
   reales, sin nube. Compilación y visor PDF siguen igual.

   Soporte: Chrome/Edge/Opera de escritorio (contexto seguro).
   Firefox y Safari NO implementan showDirectoryPicker.
   ============================================================ */
import { TEXT_EXT } from "./zip-import.js";

export const isSupported = () => typeof window.showDirectoryPicker === "function";

/* basura que no tiene sentido mostrar en el árbol */
const SKIP_EXT = ["aux", "log", "out", "toc", "lof", "lot", "bbl", "blg", "fls", "fdb_latexmk", "synctex", "nav", "snm", "vrb"];
const SKIP_DIR = ["node_modules", ".git", ".vscode", "__MACOSX"];

const extOf = name => {
  const base = name.split("/").pop();
  return base.includes(".") ? base.split(".").pop().toLowerCase() : "";
};

/* ---------- selección y permisos ---------- */
export async function pickDirectory() {
  return window.showDirectoryPicker({ mode: "readwrite" });
}

export async function ensurePermission(handle, mode = "readwrite") {
  if (!handle || !handle.queryPermission) return false;
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/* ---------- recorrido de la carpeta ---------- */
async function walk(dir, prefix, out) {
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".")) continue;
    const path = prefix ? prefix + "/" + name : name;
    if (handle.kind === "directory") {
      if (SKIP_DIR.includes(name)) continue;
      out.folders.add(path);
      await walk(handle, path, out);
    } else {
      const ext = extOf(name);
      if (SKIP_EXT.includes(ext) || name.endsWith(".synctex.gz")) continue;
      if (TEXT_EXT.includes(ext)) out.textHandles.set(path, handle);
      else out.assets.push({ name: path, handle });
    }
  }
}

/**
 * Escanea la carpeta y devuelve
 * {textHandles: Map(path→handle), contents: Map(path→string), assets:[{name,handle,size}], folders:Set}
 * Los textos se leen completos por adelantado (proyectos LaTeX son pequeños).
 */
export async function scanDirectory(dirHandle) {
  const out = { textHandles: new Map(), contents: new Map(), assets: [], folders: new Set() };
  await walk(dirHandle, "", out);
  for (const [path, h] of out.textHandles) {
    try { out.contents.set(path, await (await h.getFile()).text()); }
    catch (e) { out.contents.set(path, ""); }
  }
  for (const a of out.assets) {
    try { a.size = (await a.handle.getFile()).size; } catch (e) { a.size = 0; }
  }
  return out;
}

/**
 * Escaneo BARATO: recorre la carpeta y devuelve solo los metadatos
 * (mtime y tamaño) de cada archivo de texto, SIN leer su contenido.
 * Lo usa el puente con VS Code, que sondea cada segundo: leer entero
 * un proyecto de 30 archivos a ese ritmo sería un derroche, así que
 * primero se mira la fecha y solo se lee lo que cambió.
 */
export async function scanTextMeta(dirHandle) {
  const out = { textHandles: new Map(), contents: new Map(), assets: [], folders: new Set() };
  await walk(dirHandle, "", out);              // walk() no lee contenidos
  const meta = new Map();
  for (const [path, h] of out.textHandles) {
    try {
      const f = await h.getFile();
      meta.set(path, { handle: h, mtime: f.lastModified, size: f.size });
    } catch (e) { /* archivo borrado entre el recorrido y la lectura */ }
  }
  return { meta, folders: out.folders, assets: out.assets };
}

export async function readText(handle) {
  return (await handle.getFile()).text();
}

export async function readBytes(handle) {
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

/* ---------- escritura ---------- */
async function dirFor(root, path, create) {
  const parts = path.split("/");
  parts.pop();
  let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create });
  return d;
}

export async function writeText(root, path, content) {
  const d = await dirFor(root, path, true);
  const fh = await d.getFileHandle(path.split("/").pop(), { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
  return fh;
}

export async function writeBytes(root, path, bytes) {
  const d = await dirFor(root, path, true);
  const fh = await d.getFileHandle(path.split("/").pop(), { create: true });
  const w = await fh.createWritable();
  await w.write(bytes);
  await w.close();
  return fh;
}

export async function makeFolder(root, path) {
  let d = root;
  for (const p of path.split("/")) d = await d.getDirectoryHandle(p, { create: true });
  return d;
}

export async function deleteEntry(root, path, recursive = false) {
  const d = await dirFor(root, path, false);
  await d.removeEntry(path.split("/").pop(), { recursive });
}

/* ---------- carpetas recientes (IndexedDB guarda los handles) ---------- */
const DB_NAME = "colabtex-local", STORE = "dirs";
/* carpetas enlazadas a un proyecto de la nube (puente con VS Code), por id de
   proyecto. Van en su propio almacén para no mezclarse con las «recientes»
   del modo local, que son otra cosa. */
const BRIDGE_STORE = "bridges";

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BRIDGE_STORE)) db.createObjectStore(BRIDGE_STORE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx(mode, fn, store = STORE) {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  } catch (e) { return null; }
}

export async function saveRecent(handle) {
  return tx("readwrite", s => s.put({ id: handle.name, name: handle.name, handle, at: Date.now() }));
}

export async function listRecents() {
  const r = await tx("readonly", s => s.getAll());
  const arr = Array.isArray(r) ? r : [];
  return arr.sort((a, b) => b.at - a.at);
}

export async function removeRecent(id) {
  return tx("readwrite", s => s.delete(id));
}

/* ---------- carpeta enlazada a un proyecto de la nube ---------- */
export async function saveBridge(projectId, handle, absPath) {
  return tx("readwrite", s => s.put({ id: projectId, handle, absPath: absPath || "", at: Date.now() }), BRIDGE_STORE);
}

export async function getBridge(projectId) {
  const r = await tx("readonly", s => s.get(projectId), BRIDGE_STORE);
  // tx() devuelve la propia IDBRequest cuando result es undefined (no hay fila)
  return r && r.handle ? r : null;
}

export async function removeBridge(projectId) {
  return tx("readwrite", s => s.delete(projectId), BRIDGE_STORE);
}
