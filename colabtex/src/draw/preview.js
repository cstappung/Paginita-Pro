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
  const zoomBox = el("div", "asset-zoom");
  const btnMenos = el("button", "icon-btn", "−");
  btnMenos.title = "Alejar";
  const lblZoom = el("button", "asset-pct", "100%");
  lblZoom.title = "Ajustar a la ventana";
  const btnMas = el("button", "icon-btn", "+");
  btnMas.title = "Acercar";
  zoomBox.append(btnMenos, lblZoom, btnMas);
  const btnDown = el("button", "btn-secondary", "⤓ Descargar");
  const btnClose = el("button", "icon-btn", "✕");
  btnClose.title = "Cerrar y volver al dibujo";
  bar.append(title, zoomBox, btnDown, btnClose);

  const body = el("div", "asset-body");
  wrap.append(bar, body);
  host.appendChild(wrap);

  let url = null;      // objeto URL en uso
  let actual = null;   // { name, bytes }
  let img = null;      // la imagen, cuando lo que se ve es una
  let k = 1, tx = 0, ty = 0;   // zoom y encuadre de la imagen

  const soltar = () => {
    if (url) { URL.revokeObjectURL(url); url = null; }
    body.textContent = "";
    img = null;
  };

  btnClose.onclick = () => hide();
  btnDown.onclick = () => { if (actual) onDownload(actual); };

  /* ---------- zoom de la imagen ----------
     El PDF trae el zoom de su propio visor, así que los botones solo
     salen con una imagen: dos zooms encima del mismo documento se
     estorban. La imagen se mueve con transform, sin tocar el tamaño,
     que es lo único que no obliga a redibujarla a cada paso. */
  const MIN_K = 0.05, MAX_K = 40;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  function pinta() {
    if (!img) return;
    img.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    lblZoom.textContent = Math.round(k * 100) + "%";
  }

  /* «Ajustar» = tamaño natural sin pasarse de la ventana, que es de
     donde parte la vista. */
  function ajustar() {
    if (!img) return;
    const r = body.getBoundingClientRect();
    const w = img.naturalWidth || img.width || 1;
    const h = img.naturalHeight || img.height || 1;
    k = Math.min(1, Math.min((r.width - 36) / w, (r.height - 36) / h)) || 1;
    tx = 0; ty = 0;
    pinta();
  }

  /* Acercar dejando quieto el punto que hay bajo el puntero. */
  function zoomA(next, anclaCliente) {
    if (!img) return;
    const nk = clamp(next, MIN_K, MAX_K);
    if (nk === k) return;
    const r = img.getBoundingClientRect();
    const cx = anclaCliente ? anclaCliente.x : r.left + r.width / 2;
    const cy = anclaCliente ? anclaCliente.y : r.top + r.height / 2;
    // posición del punto dentro de la imagen, en unidades sin escalar
    const px = (cx - r.left) / k, py = (cy - r.top) / k;
    tx += px * (k - nk);
    ty += py * (k - nk);
    k = nk;
    pinta();
  }

  btnMas.onclick = () => zoomA(k * 1.25, null);
  btnMenos.onclick = () => zoomA(k / 1.25, null);
  lblZoom.onclick = () => ajustar();

  body.addEventListener("wheel", ev => {
    if (!img) return;
    ev.preventDefault();
    zoomA(k * Math.pow(0.9987, ev.deltaY), { x: ev.clientX, y: ev.clientY });
  }, { passive: false });

  let mov = null;
  body.addEventListener("pointerdown", ev => {
    if (!img || ev.button !== 0) return;
    mov = { x: ev.clientX, y: ev.clientY };
    body.setPointerCapture(ev.pointerId);
    body.style.cursor = "grabbing";
  });
  body.addEventListener("pointermove", ev => {
    if (!mov) return;
    tx += ev.clientX - mov.x;
    ty += ev.clientY - mov.y;
    mov = { x: ev.clientX, y: ev.clientY };
    pinta();
  });
  const soltarRaton = ev => {
    if (!mov) return;
    mov = null;
    try { body.releasePointerCapture(ev.pointerId); } catch (e) {}
    body.style.cursor = "";
  };
  body.addEventListener("pointerup", soltarRaton);
  body.addEventListener("pointercancel", soltarRaton);

  function show({ name, bytes }) {
    soltar();
    actual = { name, bytes };
    title.textContent = name;
    const tipo = viewKind(name);
    url = URL.createObjectURL(new Blob([bytes], { type: mimeOf(name) }));

    zoomBox.style.display = tipo === "image" ? "" : "none";
    if (tipo === "image") {
      img = el("img", "asset-img");
      img.alt = name;
      img.draggable = false;
      k = 1; tx = 0; ty = 0;
      img.onload = () => ajustar();
      img.src = url;
      body.appendChild(img);
      pinta();
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
    show, hide, zoomIn: () => zoomA(k * 1.25, null), zoomOut: () => zoomA(k / 1.25, null),
    fit: ajustar, zoom: () => k,
    isOpen: () => wrap.style.display !== "none",
    current: () => actual,
    destroy() { soltar(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
  };
}
