"use strict";
/* Visor PDF basado en pdf.js: renderiza páginas en canvas,
   conserva la posición de scroll entre recompilaciones. */
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "colabtex-pdf-worker.js";

export class PdfViewer {
  constructor(container, { onPageInfo, onPointClick } = {}) {
    this.container = container;   // div scrollable
    this.onPageInfo = onPageInfo || (() => {});
    this.onPointClick = onPointClick || null;
    this.doc = null;
    this.scale = 1.0;
    this.numPages = 0;
    this.rendering = false;
    this.lastData = null;
    this.flashEl = null;
    container.addEventListener("scroll", () => this.reportPage());

    /* Doble clic sobre una página → avisar con la posición en PUNTOS desde
       la esquina superior izquierda, que es el sistema que usa SyncTeX. */
    container.addEventListener("dblclick", ev => {
      if (!this.onPointClick) return;
      const canvas = ev.target.closest("canvas[data-page]");
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const k = this.renderScale();
      this.onPointClick(+canvas.dataset.page, (ev.clientX - r.left) / k, (ev.clientY - r.top) / k);
    });
  }

  /* factor entre puntos PDF y píxeles CSS (pdf.js: 1 pt = 1 px a escala 1) */
  renderScale() { return this.scale * 1.4; }

  async load(uint8) {
    this.lastData = uint8;
    // pdf.js transfiere el buffer: pasar una copia
    const task = pdfjsLib.getDocument({ data: uint8.slice() });
    const doc = await task.promise;
    const oldTask = this.task;
    this.task = task;
    this.doc = doc;
    this.numPages = doc.numPages;
    await this.render(true);
    if (oldTask) Promise.resolve(oldTask.destroy()).catch(() => {});
  }

  async setScale(scale) {
    this.scale = Math.min(3, Math.max(0.4, scale));
    if (this.doc) await this.render(true);
    return this.scale;
  }

  async render(keepScroll) {
    if (!this.doc || this.rendering) return;
    this.rendering = true;
    const cont = this.container;
    const prevScrollTop = cont.scrollTop, prevScrollLeft = cont.scrollLeft;
    const frag = document.createDocumentFragment();
    const dpr = window.devicePixelRatio || 1;
    try {
      for (let i = 1; i <= this.doc.numPages; i++) {
        const page = await this.doc.getPage(i);
        const viewport = page.getViewport({ scale: this.scale * 1.4 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 14px";
        canvas.style.background = "#ffffff";
        canvas.style.boxShadow = "0 4px 18px rgba(0,0,0,0.35)";
        canvas.dataset.page = i;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
        frag.appendChild(canvas);
      }
      cont.replaceChildren(frag);
      if (keepScroll) { cont.scrollTop = prevScrollTop; cont.scrollLeft = prevScrollLeft; }
      this.reportPage();
    } finally {
      this.rendering = false;
    }
  }

  reportPage() {
    if (!this.numPages) return;
    const cont = this.container;
    const mid = cont.scrollTop + cont.clientHeight / 3;
    let current = 1, acc = 0;
    for (const c of cont.children) {
      const h = c.offsetHeight + 14;
      if (acc + h > mid) { current = +c.dataset.page || 1; break; }
      acc += h;
    }
    this.onPageInfo(current, this.numPages);
  }

  /* Desplaza hasta una posición dada en PUNTOS (desde la esquina superior
     izquierda de la página) y la señala con un destello. */
  scrollTo(page, xPt, yPt, wPt, hPt) {
    const canvas = this.container.querySelector(`canvas[data-page="${page}"]`);
    if (!canvas) return false;
    const k = this.renderScale();
    const cont = this.container;

    // posición del punto dentro del contenedor scrollable
    const top = canvas.offsetTop + yPt * k;
    const left = canvas.offsetLeft + xPt * k;
    // dejarlo a un tercio de la altura visible, no pegado al borde
    cont.scrollTo({ top: Math.max(0, top - cont.clientHeight / 3), behavior: "smooth" });
    if (left > cont.clientWidth) cont.scrollTo({ left: Math.max(0, left - cont.clientWidth / 2) });

    if (!this.flashEl) {
      this.flashEl = document.createElement("div");
      this.flashEl.className = "sync-flash";
      cont.appendChild(this.flashEl);
    }
    const el = this.flashEl;
    const w = Math.max(12, (wPt || 0) * k), h = Math.max(11, (hPt || 0) * k);
    el.style.left = left + "px";
    // y es la línea base: subir el alto de la caja para cubrir el texto
    el.style.top = (top - h * 0.85) + "px";
    el.style.width = w + "px";
    el.style.height = (h * 1.25) + "px";
    el.classList.remove("on");
    void el.offsetWidth;            // reinicia la animación CSS
    el.classList.add("on");
    return true;
  }

  download(filename) {
    if (!this.lastData) return;
    const blob = new Blob([this.lastData], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "documento.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
