"use strict";
/* ============================================================
   ColabDraw — vista de los archivos generados

   Un PNG o un PDF exportado se mira aquí, en el sitio del lienzo, y se
   descarga desde el botón. Antes se descargaba de golpe al pulsarlo, que
   obliga a salir del navegador para ver si la figura quedó bien.

   El lienzo no se destruye, solo se tapa: rehacerlo perdería el encuadre,
   la selección y el espejo del documento (mismo criterio que la vista
   previa de recursos de ColabTeX).
   ============================================================ */

const MIMES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  pdf: "application/pdf"
};

export const extOf = name => (String(name).match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
export const mimeOf = name => MIMES[extOf(name)] || "application/octet-stream";

/* Qué se puede enseñar y cómo. El PDF va en un <iframe> con el visor del
   propio navegador: traer pdf.js aquí sumaría más de un mega al paquete
   para enseñar una figura de una página. */
export function viewKind(name) {
  const e = extOf(name);
  if (e === "pdf") return "pdf";
  if (MIMES[e] && MIMES[e].startsWith("image/")) return "image";
  return "file";
}

const el = (tag, cls, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

export function createAssetPreview(host, { onClose = () => {}, onDownload = () => {} } = {}) {
  const wrap = el("div", "asset-view");
  wrap.style.display = "none";

  const bar = el("div", "asset-bar");
  const title = el("span", "asset-name");
  const btnDown = el("button", "btn-secondary", "⤓ Descargar");
  const btnClose = el("button", "icon-btn", "✕");
  btnClose.title = "Cerrar y volver al dibujo";
  bar.append(title, btnDown, btnClose);

  const body = el("div", "asset-body");
  wrap.append(bar, body);
  host.appendChild(wrap);

  let url = null;      // objeto URL en uso
  let actual = null;   // { name, bytes }

  const soltar = () => {
    if (url) { URL.revokeObjectURL(url); url = null; }
    body.textContent = "";
  };

  btnClose.onclick = () => hide();
  btnDown.onclick = () => { if (actual) onDownload(actual); };

  function show({ name, bytes }) {
    soltar();
    actual = { name, bytes };
    title.textContent = name;
    const tipo = viewKind(name);
    url = URL.createObjectURL(new Blob([bytes], { type: mimeOf(name) }));

    if (tipo === "image") {
      const img = el("img", "asset-img");
      img.alt = name;
      img.src = url;
      body.appendChild(img);
    } else if (tipo === "pdf") {
      const f = document.createElement("iframe");
      f.className = "asset-frame";
      f.src = url;
      f.title = name;
      body.appendChild(f);
    } else {
      const card = el("div", "asset-card");
      card.append(
        el("div", null, name),
        el("div", "asset-hint", "Este formato no se puede mostrar aquí. Descárgalo para abrirlo.")
      );
      body.appendChild(card);
    }
    wrap.style.display = "flex";
  }

  function hide() {
    if (wrap.style.display === "none") return;
    wrap.style.display = "none";
    soltar();
    actual = null;
    onClose();
  }

  return {
    show, hide,
    isOpen: () => wrap.style.display !== "none",
    current: () => actual,
    destroy() { soltar(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
  };
}
