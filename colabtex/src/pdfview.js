"use strict";
/* Visor PDF basado en pdf.js: renderiza páginas en canvas,
   conserva la posición de scroll entre recompilaciones. */
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "colabtex-pdf-worker.js";

export class PdfViewer {
  constructor(container, { onPageInfo } = {}) {
    this.container = container;   // div scrollable
    this.onPageInfo = onPageInfo || (() => {});
    this.doc = null;
    this.scale = 1.0;
    this.numPages = 0;
    this.rendering = false;
    this.lastData = null;
    container.addEventListener("scroll", () => this.reportPage());
  }

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
