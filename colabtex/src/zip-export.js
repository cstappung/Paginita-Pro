"use strict";
/* ============================================================
   Descargar un proyecto entero en un .zip

   Lo usan las dos aplicaciones: ColabTeX empaqueta los archivos de
   texto más los recursos, y ColabDraw los dibujos (serializados a .svg)
   más lo que se haya exportado. Es la copia de seguridad que se puede
   guardar fuera, y también la forma de llevarse el proyecto a Overleaf o
   a Inkscape de escritorio.

   Se comprime con fflate, que ya estaba en el proyecto para LEER los
   .zip de Overleaf (zip-import.js). El nivel 6 es el término medio de
   siempre: un .tex baja muchísimo y un PNG, que ya viene comprimido, no
   se pelea por unos bytes.
   ============================================================ */
import { zip } from "fflate";

export const textBytes = s => new TextEncoder().encode(String(s));

/* Nombre de archivo aceptable en Windows, macOS y Linux a la vez. */
export function safeFileName(title, ext = "zip") {
  const base = String(title || "proyecto")
    .replace(/[\\/:*?"<>|]/g, "-")      // prohibidos en Windows
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")                // un nombre que empieza por punto se esconde
    .slice(0, 80) || "proyecto";
  return `${base}.${ext}`;
}

/* Rutas de dentro del .zip: siempre con / y sin salirse hacia arriba, que
   es como se cuela un archivo fuera de la carpeta al descomprimir. */
export function safeEntryPath(path) {
  return String(path).replace(/\\/g, "/").split("/")
    .map(p => p.trim()).filter(p => p && p !== "." && p !== "..").join("/");
}

/**
 * entries: [{ path, bytes }] — `bytes` puede ser Uint8Array o texto.
 * Devuelve los bytes del .zip.
 */
export function makeZip(entries, { level = 6 } = {}) {
  const tree = {};
  const usados = new Set();
  for (const e of entries) {
    if (!e) continue;
    let path = safeEntryPath(e.path);
    if (!path) continue;
    // dos archivos con la misma ruta: el segundo se renombra en vez de perderse
    if (usados.has(path)) {
      const m = path.match(/^(.*?)(\.[^./]*)?$/);
      let n = 2, alt;
      do { alt = `${m[1]} (${n++})${m[2] || ""}`; } while (usados.has(alt));
      path = alt;
    }
    usados.add(path);
    const bytes = typeof e.bytes === "string" ? textBytes(e.bytes) : new Uint8Array(e.bytes);
    tree[path] = [bytes, { level }];
  }
  if (!Object.keys(tree).length) return Promise.reject(new Error("El proyecto está vacío."));
  return new Promise((resolve, reject) => {
    zip(tree, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export function downloadBytes(bytes, filename, type = "application/zip") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Junta, comprime y descarga. `collect` devuelve las entradas (puede ser
 * asíncrono: los binarios hay que bajarlos de Storage uno a uno).
 */
export async function downloadProjectZip(title, collect, { onStep = () => {} } = {}) {
  onStep("Reuniendo archivos…");
  const entries = await collect();
  onStep("Comprimiendo…");
  const bytes = await makeZip(entries);
  downloadBytes(bytes, safeFileName(title));
  onStep("");
  return { count: entries.length, size: bytes.length };
}
