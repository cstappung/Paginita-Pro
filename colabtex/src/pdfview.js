"use strict";
/* Visor PDF basado en pdf.js: renderiza páginas en canvas,
   conserva la posición de scroll entre recompilaciones.

   Cada página es un <div class="pdf-page"> con tres capas:
   - el <canvas> con el dibujo;
   - la capa de TEXTO de pdf.js (spans transparentes encima del dibujo),
     que es lo que permite seleccionar y copiar texto del PDF y que el
     Ctrl+F del navegador lo encuentre;
   - la capa de ENLACES: los \ref, \cite y el índice de hyperref saltan
     dentro del documento, y los \url se abren en otra pestaña.

   Las páginas se pintan SOLO cuando se acercan a la vista
   (IntersectionObserver) y se liberan al alejarse. Antes se pintaban
   todas, una detrás de otra, en cada compilación y en cada zoom: con un
   documento de 60 páginas eso eran varios segundos de espera tras cada
   compilación y cientos de MB en canvas que nadie miraba. Al recompilar
   se pintan primero las páginas que estabas viendo y solo entonces se
   cambia el contenido, así que no hay parpadeo. */
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = "colabtex-pdf-worker.js";

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const GAP = 14;                       // separación entre páginas (px)
const MAX_CANVAS_PIXELS = 2 ** 24;    // tope por canvas: zoom 500 % en pantalla retina pasaba de 300 MB
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* Estilos de las capas. Van aquí y no en colabtex.html porque el mismo
   visor lo usa la vista previa de PDFs del árbol de archivos. La capa de
   texto es la de pdf_viewer.css de pdf.js 6, recortada a lo que hace
   falta para seleccionar: depende de --total-scale-factor, que pone
   cada página. */
const CSS = `
.pdf-page{position:relative;margin:0 auto ${GAP}px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.35);--scale-round-x:1px;--scale-round-y:1px}
.pdf-page>canvas{position:absolute;inset:0;display:block}
.pdf-page .textLayer{position:absolute;text-align:initial;inset:0;overflow:clip;opacity:1;line-height:1;letter-spacing:normal;word-spacing:normal;
  -webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:0;caret-color:CanvasText;
  --min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor) * var(--min-font-size));--min-font-size-inv:calc(1 / var(--min-font-size))}
.pdf-page .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%;-webkit-user-select:text;user-select:text}
.pdf-page .textLayer > :not(.markedContent),.pdf-page .textLayer .markedContent span:not(.markedContent){z-index:1;--font-height:0;
  font-size:calc(var(--text-scale-factor) * var(--font-height));--scale-x:1;--rotate:0deg;
  transform:rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))}
.pdf-page .textLayer .markedContent{display:contents}
.pdf-page .textLayer span[role="img"]{-webkit-user-select:none;user-select:none;cursor:default}
.pdf-page .textLayer ::selection{background:rgba(0,100,255,.28);color:transparent}
.pdf-page .textLayer br::selection{background:transparent}
.pdf-page .linkLayer{position:absolute;inset:0;z-index:3;pointer-events:none}
.pdf-page .linkLayer a{position:absolute;pointer-events:auto;cursor:pointer;border-radius:2px}
.pdf-page .linkLayer a:hover{background:rgba(255,200,0,.22)}
`;
let cssPuesto = false;
function ponerCss() {
  if (cssPuesto || typeof document === "undefined") return;
  cssPuesto = true;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
}

export class PdfViewer {
  constructor(container, { onPageInfo, onPointClick, onZoom } = {}) {
    ponerCss();
    this.container = container;   // div scrollable
    // offsetTop de las páginas (enlaces, SyncTeX) se mide contra él
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    this.onPageInfo = onPageInfo || (() => {});
    this.onPointClick = onPointClick || null;
    this.onZoom = onZoom || (() => {});
    this.doc = null;
    this.scale = 1.0;
    this.numPages = 0;
    this.pages = [];              // [{num, div, viewport, estado, tareas}]
    this.gen = 0;                 // cada render() nuevo invalida los anteriores
    this.lastData = null;
    this.flashEl = null;
    this._zoomTimer = null;
    this._zoomAnchor = null;
    this._obsVer = null;
    this._obsSoltar = null;
    container.addEventListener("scroll", () => this.reportPage());

    /* Ctrl (o ⌘) + rueda = zoom, como en cualquier visor de PDF y como el
       pellizco del panel táctil, que llega al navegador exactamente así.
       Hay que llamar a preventDefault o el navegador hace SU zoom y
       agranda la página entera. */
    container.addEventListener("wheel", ev => this._wheel(ev), { passive: false });

    /* Doble clic sobre una página → avisar con la posición en PUNTOS desde
       la esquina superior izquierda, que es el sistema que usa SyncTeX.
       Sobre un enlace no: ese clic ya ha saltado a otra parte. */
    container.addEventListener("dblclick", ev => {
      if (!this.onPointClick || ev.target.closest(".linkLayer a")) return;
      const pageEl = ev.target.closest(".pdf-page[data-page]");
      if (!pageEl) return;
      const r = pageEl.getBoundingClientRect();
      const k = this.renderScale();
      this.onPointClick(+pageEl.dataset.page, (ev.clientX - r.left) / k, (ev.clientY - r.top) / k);
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

  /* Zoom para que la página ocupe el ancho del panel. */
  async fitWidth() {
    if (!this.doc) return this.scale;
    const page = await this.doc.getPage(1);
    const w = page.getViewport({ scale: 1 }).width;
    const cs = getComputedStyle(this.container);
    const libre = this.container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
    return this.setScale(libre / (w * 1.4));
  }

  /* ---------- zoom con la rueda ----------
     El número se actualiza al instante y el PDF se vuelve a pintar cuando
     la rueda para: repintar cuesta y la rueda manda decenas de eventos
     por segundo. */
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
    const k = this.scale / (a.prev || 1);
    /* Aproximado, no exacto: los márgenes entre páginas van en píxeles y
       no crecen con el zoom. La diferencia son unos pocos píxeles y se
       nota muchísimo menos que saltar al principio del documento. */
    await this.render(false, {
      left: Math.max(0, (antesX + offX) * k - offX),
      top: Math.max(0, (antesY + offY) * k - offY)
    });
  }

  /* Monta las páginas del documento actual. `keepScroll` conserva el
     desplazamiento; `scrollA` fuerza uno concreto (zoom con ancla).

     Un render que llega con otro en marcha lo sustituye: el viejo nota
     que `gen` ha cambiado y se retira sin tocar la página. Antes había
     que encolarlos para no perder un zoom pedido justo al terminar de
     compilar; ahora el último pedido es el que gana, que es lo mismo. */
  async render(keepScroll, scrollA = null) {
    if (!this.doc) return;
    const gen = ++this.gen;
    const doc = this.doc;
    const cont = this.container;
    const k = this.renderScale();
    const destino = scrollA || (keepScroll ? { top: cont.scrollTop, left: cont.scrollLeft } : { top: 0, left: 0 });

    // tamaños de todas las páginas (barato: no pinta nada)
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (gen !== this.gen) return;
      const viewport = page.getViewport({ scale: k });
      const div = document.createElement("div");
      div.className = "pdf-page";
      div.dataset.page = i;
      div.style.width = Math.floor(viewport.width) + "px";
      div.style.height = Math.floor(viewport.height) + "px";
      div.style.setProperty("--total-scale-factor", String(k));
      pages.push({ num: i, page, div, viewport, gen, estado: "vacia", tareas: [] });
    }

    // pintar ANTES de cambiar lo que se ve: las páginas que quedarán a la vista
    const padTop = parseFloat(getComputedStyle(cont).paddingTop) || 0;
    const alto = cont.clientHeight || 800;
    let y = padTop;
    const visibles = [];
    for (const p of pages) {
      const h = Math.floor(p.viewport.height);
      if (y + h >= destino.top - 100 && y <= destino.top + alto + 100) visibles.push(p);
      y += h + GAP;
    }
    await Promise.all(visibles.map(p => this._pintar(p).catch(() => {})));
    if (gen !== this.gen) { for (const p of visibles) this._soltar(p); return; }

    // cambio de documento: soltar las páginas viejas y montar las nuevas
    for (const p of this.pages) this._soltar(p);
    this.pages = pages;
    const frag = document.createDocumentFragment();
    for (const p of pages) frag.appendChild(p.div);
    cont.replaceChildren(frag);
    cont.scrollTop = destino.top;
    cont.scrollLeft = destino.left;
    this._observar();
    this.reportPage();
  }

  /* Pinta las páginas que entran cerca de la vista y suelta las que se
     van lejos. Dos observadores con márgenes distintos para que no haya
     un borde exacto donde una página se pinte y se suelte una y otra vez. */
  _observar() {
    if (this._obsVer) this._obsVer.disconnect();
    if (this._obsSoltar) this._obsSoltar.disconnect();
    if (typeof IntersectionObserver === "undefined") {
      for (const p of this.pages) this._pintar(p).catch(() => {});
      return;
    }
    const porDiv = new Map(this.pages.map(p => [p.div, p]));
    this._obsVer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { const p = porDiv.get(e.target); if (p) this._pintar(p).catch(() => {}); }
    }, { root: this.container, rootMargin: "600px 200px" });
    this._obsSoltar = new IntersectionObserver(entries => {
      for (const e of entries) if (!e.isIntersecting) { const p = porDiv.get(e.target); if (p) this._soltar(p); }
    }, { root: this.container, rootMargin: "3000px 1000px" });
    for (const p of this.pages) { this._obsVer.observe(p.div); this._obsSoltar.observe(p.div); }
  }

  async _pintar(p) {
    if (p.estado !== "vacia") return;
    p.estado = "pintando";
    const { page, viewport, div } = p;
    const dpr = window.devicePixelRatio || 1;
    const px = viewport.width * viewport.height;
    const ratio = Math.min(dpr, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, px)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    const tarea = page.render({
      canvasContext: canvas.getContext("2d"), viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
    });
    p.tareas.push(tarea);
    try {
      await tarea.promise;
    } catch (err) {
      if (p.estado === "pintando") p.estado = "vacia";
      throw err;
    }
    if (p.estado !== "pintando") return;          // se soltó mientras tanto
    div.prepend(canvas);
    p.estado = "pintada";
    // texto y enlaces no retrasan el dibujo: van detrás
    this._capaTexto(p).catch(() => {});
    this._capaEnlaces(p).catch(() => {});
  }

  _soltar(p) {
    if (p.estado === "vacia") return;
    for (const t of p.tareas) { try { t.cancel(); } catch (e) {} }
    p.tareas = [];
    p.estado = "vacia";
    for (const c of p.div.querySelectorAll("canvas")) { c.width = 0; c.height = 0; }
    p.div.replaceChildren();
  }

  async _capaTexto(p) {
    const div = document.createElement("div");
    div.className = "textLayer";
    const tl = new pdfjsLib.TextLayer({ textContentSource: p.page.streamTextContent(), container: div, viewport: p.viewport });
    p.tareas.push(tl);
    await tl.render();
    if (p.estado !== "pintada") return;
    p.div.appendChild(div);
  }

  async _capaEnlaces(p) {
    const anots = await p.page.getAnnotations({ intent: "display" });
    const links = anots.filter(a => a.subtype === "Link" && (a.url || a.dest));
    if (!links.length || p.estado !== "pintada") return;
    const capa = document.createElement("div");
    capa.className = "linkLayer";
    for (const a of links) {
      // (pdf.js 6 ya no trae convertToViewportRectangle: dos esquinas)
      const [x1, y1] = p.viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
      const [x2, y2] = p.viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
      const el = document.createElement("a");
      el.style.left = Math.min(x1, x2) + "px";
      el.style.top = Math.min(y1, y2) + "px";
      el.style.width = Math.abs(x2 - x1) + "px";
      el.style.height = Math.abs(y2 - y1) + "px";
      if (a.url) {
        el.href = a.url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.title = a.url;
      } else {
        el.href = "#";
        el.addEventListener("click", ev => { ev.preventDefault(); this._irADestino(a.dest).catch(() => {}); });
      }
      capa.appendChild(el);
    }
    p.div.appendChild(capa);
  }

  /* Destino interno de hyperref: con nombre («section.2») o explícito
     ([ref de página, {name:"XYZ"}, x, y, zoom]). */
  async _irADestino(dest) {
    const doc = this.doc;
    if (!doc) return;
    const explicito = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicito) || !explicito.length) return;
    const ref = explicito[0];
    const idx = typeof ref === "number" ? ref : await doc.getPageIndex(ref);
    const p = this.pages[idx];
    if (!p) return;
    let top = 0;
    const tipo = explicito[1] && explicito[1].name;
    if ((tipo === "XYZ" || tipo === "FitH" || tipo === "FitBH") && explicito[tipo === "XYZ" ? 3 : 2] != null) {
      const yPdf = explicito[tipo === "XYZ" ? 3 : 2];
      top = p.viewport.convertToViewportPoint(0, yPdf)[1];
    }
    this.container.scrollTo({ top: Math.max(0, p.div.offsetTop + top - 12), behavior: "smooth" });
  }

  reportPage() {
    if (!this.numPages || !this.pages.length) return;
    const cont = this.container;
    const mid = cont.scrollTop + cont.clientHeight / 3;
    let current = 1;
    for (const p of this.pages) {
      if (p.div.offsetTop <= mid) current = p.num;
      else break;
    }
    this.onPageInfo(current, this.numPages);
  }

  /* Desplaza hasta una posición dada en PUNTOS (desde la esquina superior
     izquierda de la página) y la señala con un destello. */
  scrollTo(page, xPt, yPt, wPt, hPt) {
    const p = this.pages[page - 1];
    if (!p) return false;
    const pageEl = p.div;
    const k = this.renderScale();
    const cont = this.container;

    // posición del punto dentro del contenedor scrollable
    const top = pageEl.offsetTop + yPt * k;
    const left = pageEl.offsetLeft + xPt * k;
    // dejarlo a un tercio de la altura visible, no pegado al borde
    cont.scrollTo({ top: Math.max(0, top - cont.clientHeight / 3), behavior: "smooth" });
    if (left > cont.clientWidth) cont.scrollTo({ left: Math.max(0, left - cont.clientWidth / 2) });

    /* Tras recompilar, replaceChildren se lleva el destello por delante:
       hay que volver a colgarlo, o el salto código→PDF dejaba de
       señalar nada después de la primera compilación. */
    if (!this.flashEl) {
      this.flashEl = document.createElement("div");
      this.flashEl.className = "sync-flash";
    }
    if (!this.flashEl.isConnected) cont.appendChild(this.flashEl);
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
