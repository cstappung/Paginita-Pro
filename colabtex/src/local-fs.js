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

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx(mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
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
