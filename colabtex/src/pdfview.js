"use strict";
/* Visor PDF basado en pdf.js: renderiza páginas en canvas,
   conserva la posición de scroll entre recompilaciones. */
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "colabtex-pdf-worker.js";

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class PdfViewer {
  constructor(container, { onPageInfo, onPointClick, onZoom } = {}) {
    this.container = container;   // div scrollable
    this.onPageInfo = onPageInfo || (() => {});
    this.onPointClick = onPointClick || null;
    this.onZoom = onZoom || (() => {});
    this.doc = null;
    this.scale = 1.0;
    this.numPages = 0;
    this.rendering = false;
    this.pending = null;          // repintado pedido mientras había otro en marcha
    this.lastData = null;
    this.flashEl = null;
    this._zoomTimer = null;
    this._zoomAnchor = null;
    container.addEventListener("scroll", () => this.reportPage());

    /* Ctrl (o ⌘) + rueda = zoom, como en cualquier visor de PDF y como el
       pellizco del panel táctil, que llega al navegador exactamente así.
       Hay que llamar a preventDefault o el navegador hace SU zoom y
       agranda la página entera. */
    container.addEventListener("wheel", ev => this._wheel(ev), { passive: false });

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
    this.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    this.onZoom(this.scale);
    if (this.doc) await this.render(true);
    return this.scale;
  }

  /* ---------- zoom con la rueda ----------
     El número se actualiza al instante y el PDF se vuelve a pintar cuando
     la rueda para: repintar todas las páginas cuesta bastante y la rueda
     manda decenas de eventos por segundo. */
  _wheel(ev) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    if (!this.doc) return;
    /* Una muesca de rueda son 120 unidades: con 0,999 eso es un 13 %, que
       es un paso cómodo. Con una base más agresiva un solo golpe de rueda
       casi duplicaba el tamaño y no había forma de encuadrar nada. El
       pellizco del panel táctil manda incrementos pequeños y seguidos, así
       que con la misma fórmula sale suave. */
    const next = clamp(this.scale * Math.pow(0.999, ev.deltaY), MIN_SCALE, MAX_SCALE);
    if (next === this.scale) return;
    // el ancla es la del PRIMER evento de la ráfaga: es donde está mirando
    if (!this._zoomAnchor) this._zoomAnchor = { x: ev.clientX, y: ev.clientY, prev: this.scale };
    this.scale = next;
    this.onZoom(this.scale);
    clearTimeout(this._zoomTimer);
    this._zoomTimer = setTimeout(() => this._renderZoom(), 110);
  }

  /* Repinta manteniendo quieto el punto que hay bajo el puntero. */
  async _renderZoom() {
    const a = this._zoomAnchor;
    this._zoomAnchor = null;
    if (!a || !this.doc) return;
    const cont = this.container;
    const r = cont.getBoundingClientRect();
    const offX = a.x - r.left, offY = a.y - r.top;
    const antesX = cont.scrollLeft, antesY = cont.scrollTop;
    await this.render(true);
    const k = this.scale / (a.prev || 1);
    /* Aproximado, no exacto: los márgenes entre páginas van en píxeles y
       no crecen con el zoom. La diferencia son unos pocos píxeles y se
       nota muchísimo menos que saltar al principio del documento. */
    cont.scrollLeft = Math.max(0, (antesX + offX) * k - offX);
    cont.scrollTop = Math.max(0, (antesY + offY) * k - offY);
    this.reportPage();
  }

  async render(keepScroll) {
    if (!this.doc) return;
    /* Un repintado que llega con otro en marcha NO se puede tirar: era la
       forma de que un zoom pedido justo al terminar de compilar se
       perdiera sin dejar rastro. Se apunta y se hace al acabar. */
    if (this.rendering) { this.pending = keepScroll; return; }
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
    if (this.pending !== null) {
      const otra = this.pending;
      this.pending = null;
      await this.render(otra);
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
