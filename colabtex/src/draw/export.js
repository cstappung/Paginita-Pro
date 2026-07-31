"use strict";
/* ============================================================
   ColabDraw — exportación

   Salidas de esta fase: SVG y PNG. El PDF vectorial llega en la
   siguiente (svg2pdf + jsPDF); aquí se deja preparada la forma de
   `exportAll` para que añadirlo no cambie a quien la llama.

   Lo exportado se guarda como recurso NORMAL del proyecto
   (assetsIndex + Storage), o sea con el mismo `uploadAsset` que usa
   ColabTeX. Ese es justo el gancho que luego permite vincular las
   figuras desde un proyecto de LaTeX sin inventar nada nuevo.
   ============================================================ */
import { serialize } from "./svgio.js";
import { fmt } from "./geom.js";

const MM_PER_IN = 25.4;

/* ---------- SVG ---------- */

export function exportSvg(drawing) {
  const root = drawing && drawing.root();
  if (!root) throw new Error("El dibujo está vacío.");
  return serialize(root);
}

/* Variante para rasterizar: el tamaño en píxeles va explícito. Un <img>
   con width="160mm" lo resuelve el navegador a 96 ppp y saldría un PNG
   de 604 px pidiéramos lo que pidiéramos. */
function svgForRaster(drawing, wPx, hPx) {
  const root = drawing.root();
  const { w, h, x = 0, y = 0 } = drawing.size();
  const text = serialize(root, { header: false });
  return text.replace(
    /^<svg[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${fmt(wPx)}" height="${fmt(hPx)}" viewBox="${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)}">`
  );
}

/* base64 de una cadena UTF-8. btoa() sola revienta con cualquier tilde,
   y los dibujos llevan texto en español. */
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const pxFromMm = (mm, dpi) => Math.max(1, Math.round((mm / MM_PER_IN) * dpi));

/* ---------- PNG ---------- */

/* Se pinta el SVG en un <canvas>. Va por data: y no por blob: a
   propósito: una URL de datos es del mismo origen con toda seguridad y
   el lienzo no queda «manchado», que impediría leer el PNG de vuelta. */
export function exportPng(drawing, { dpi = 300, background = null } = {}) {
  const { w, h } = drawing.size();
  const wPx = pxFromMm(w, dpi), hPx = pxFromMm(h, dpi);
  const svgText = svgForRaster(drawing, wPx, hPx);
  const url = "data:image/svg+xml;base64," + utf8ToBase64(svgText);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = wPx; canvas.height = hPx;
        const ctx = canvas.getContext("2d");
        if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, wPx, hPx); }
        ctx.drawImage(img, 0, 0, wPx, hPx);
        canvas.toBlob(b => {
          if (b) resolve({ blob: b, width: wPx, height: hPx });
          else reject(new Error("El navegador no pudo generar el PNG."));
        }, "image/png");
      } catch (err) {
        reject(new Error("No se pudo rasterizar el dibujo: " + (err.message || err)));
      }
    };
    img.onerror = () => reject(new Error(
      "El navegador no pudo dibujar el SVG. Suele pasar con una imagen incrustada rota."));
    img.src = url;
  });
}

/* ---------- utilidades ---------- */

export const bytesOfString = str => new TextEncoder().encode(str);

export async function bytesOfBlob(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

/* Descarga directa al disco, sin pasar por la nube. */
export function download(blobOrBytes, filename) {
  const blob = blobOrBytes instanceof Blob
    ? blobOrBytes
    : new Blob([blobOrBytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Nombre del archivo generado a partir del del dibujo:
   «diagrama.svg» + png → «diagrama.png». */
export const outputName = (drawingPath, ext) =>
  String(drawingPath).replace(/\.svg$/i, "") + "." + ext;

/* ---------- guardar en el proyecto ----------
   `upload` es fb.uploadAsset; se pasa desde fuera para que este módulo
   no dependa de Firebase y se pueda probar sin red. */
export async function exportAll(drawing, path, { formats = ["svg", "png"], dpi = 300, upload = null } = {}) {
  const done = [];
  for (const f of formats) {
    let bytes, name;
    if (f === "svg") {
      name = outputName(path, "svg");
      bytes = bytesOfString(exportSvg(drawing));
    } else if (f === "png") {
      name = outputName(path, "png");
      const { blob } = await exportPng(drawing, { dpi });
      bytes = await bytesOfBlob(blob);
    } else {
      continue;   // pdf: siguiente fase
    }
    if (upload) await upload(name, bytes);
    done.push({ name, bytes, format: f });
  }
  return done;
}
