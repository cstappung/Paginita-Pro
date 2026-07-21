"use strict";
/* ============================================================
   ColabTeX — importación de proyectos .zip (p. ej. export de
   Overleaf: «Menu → Download → Source»).
   Separa el contenido en archivos de texto (a Yjs) y recursos
   binarios (a Storage / respaldo RTDB), conservando carpetas.
   ============================================================ */
import { unzip } from "fflate";

/* extensiones que viven en el documento Yjs como texto */
export const TEXT_EXT = ["tex", "bib", "txt", "sty", "cls", "md", "csv", "dat", "bst", "cfg", "clo", "def"];

/* basura de compilación de Overleaf/LaTeX que no aporta nada */
const SKIP_EXT = ["aux", "log", "out", "toc", "lof", "lot", "bbl", "blg", "fls", "fdb_latexmk", "synctex", "gz", "nav", "snm", "vrb", "run", "xml"];
const SKIP_NAME = /(^|\/)(__MACOSX\/|\.DS_Store$|\.git\/|Thumbs\.db$)/i;

const extOf = name => {
  const base = name.split("/").pop();
  return base.includes(".") ? base.split(".").pop().toLowerCase() : "";
};

/* rutas seguras: sin ../, sin barras iniciales */
function cleanZipPath(name) {
  return String(name).replace(/\\/g, "/").split("/")
    .map(p => p.trim()).filter(p => p && p !== "." && p !== "..").join("/");
}

/* Overleaf a veces empaqueta todo dentro de una carpeta raíz única.
   Si TODOS los archivos comparten el mismo primer segmento, se quita. */
function stripCommonRoot(paths) {
  if (paths.length < 2) return null;
  const first = paths[0].split("/")[0];
  if (!paths[0].includes("/")) return null;
  return paths.every(p => p.split("/")[0] === first) ? first : null;
}

/**
 * Lee un File/Blob .zip y devuelve {texts:{path:string}, assets:[{path,bytes}], skipped:[]}
 */
export async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise((resolve, reject) => {
    unzip(buf, (err, data) => err ? reject(new Error("El archivo no es un .zip válido: " + err.message)) : resolve(data));
  });

  // rutas candidatas (ignorando directorios y basura)
  const usable = [];
  for (const raw of Object.keys(entries)) {
    if (raw.endsWith("/")) continue;                 // directorio
    if (SKIP_NAME.test(raw)) continue;
    const path = cleanZipPath(raw);
    if (!path) continue;
    usable.push({ raw, path });
  }

  const root = stripCommonRoot(usable.map(u => u.path));
  const texts = {}, assets = [], skipped = [];

  for (const { raw, path: p0 } of usable) {
    const path = root ? p0.slice(root.length + 1) : p0;
    if (!path) continue;
    const ext = extOf(path);
    if (SKIP_EXT.includes(ext)) { skipped.push(path); continue; }
    const bytes = entries[raw];
    if (TEXT_EXT.includes(ext)) {
      try { texts[path] = new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
      catch (e) { skipped.push(path); }
    } else {
      // LaTeX no acepta espacios en \includegraphics
      assets.push({ path: path.replace(/ /g, "_"), bytes });
    }
  }
  return { texts, assets, skipped };
}

/* carpetas implícitas a partir de las rutas (para el árbol) */
export function foldersOf(paths) {
  const out = new Set();
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) out.add(parts.slice(0, i).join("/"));
  }
  return out;
}

/* nombre de proyecto sugerido a partir del nombre del zip */
export const titleFromZip = fileName =>
  fileName.replace(/\.zip$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 140) || "Proyecto importado";
