"use strict";
/* ============================================================
   ColabTeX — vista previa de recursos binarios
   ------------------------------------------------------------
   Al pulsar una imagen o un PDF en el árbol de archivos, el panel
   del código se sustituye por este visor (como hace Overleaf), en
   vez de no hacer nada. El editor de CodeMirror no se destruye:
   solo se oculta, así que cerrar la vista previa lo devuelve tal
   como estaba, con su historial de deshacer intacto.

   Las imágenes van a un <img> con una URL de blob; los PDF se
   pintan con el mismo PdfViewer que usa la salida de la
   compilación. Los formatos que el navegador no sabe dibujar
   (.eps, .tiff…) muestran la ficha del archivo con su botón de
   descarga: siguen siendo válidos para pdfTeX aunque no se vean.
   ============================================================ */
import { PdfViewer } from "./pdfview.js";

const $ = id => document.getElementById(id);

/* extensiones que un <img> sabe pintar */
const IMG_MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp",
  avif: "image/avif", ico: "image/x-icon"
};

const extOf = name => {
  const base = String(name).split("/").pop();
  return base.includes(".") ? base.split(".").pop().toLowerCase() : "";
};

export const isImageAsset = name => !!IMG_MIME[extOf(name)];
export const isPdfAsset = name => extOf(name) === "pdf";
/* si se puede ver dentro de la página (los demás caen en la ficha) */
export const canPreview = name => isImageAsset(name) || isPdfAsset(name);

const fmtBytes = n => {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " kB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
};

const MIN_ZOOM = 0.05, MAX_ZOOM = 8;

/* Medidas declaradas de un SVG. No sirve naturalWidth: a un SVG sin width ni
   height Chrome le atribuye 300×150, que no es una medida del archivo sino su
   tamaño por omisión, y anunciarla engaña. Lo que importa —y lo que usa
   \includegraphics— es lo que declara la etiqueta raíz. */
function svgDims(bytes) {
  let head;
  try { head = new TextDecoder().decode(bytes.slice(0, 4096)); } catch (e) { return ""; }
  const tag = (head.match(/<svg\b[^>]*>/i) || [""])[0];
  if (!tag) return "";
  const attr = n => {
    const m = tag.match(new RegExp(n + "\\s*=\\s*(\"[^\"]*\"|'[^']*')", "i"));
    return m ? m[1].slice(1, -1).trim() : "";
  };
  const len = v => {
    // solo medidas absolutas en píxeles: «50%» depende de dónde se coloque
    if (!/^[+-]?[\d.]+(px)?$/i.test(v)) return 0;
    const f = parseFloat(v);
    return isFinite(f) && f > 0 ? f : 0;
  };
  const w = len(attr("width")), h = len(attr("height"));
  if (w && h) return `${Math.round(w)} × ${Math.round(h)} px`;
  const vb = attr("viewBox").split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return `viewBox ${Math.round(vb[2])} × ${Math.round(vb[3])}`;
  return "";
}

export class AssetPreview {
  /*
    fetchBytes(asset)  → Promise<Uint8Array>
    canInsert(name)    → bool, si cabe ofrecer «Insertar»
    onInsert(asset)    → inserta \includegraphics en el .tex activo
    onRequestClose()   → el usuario pulsó ✕ (main decide qué mostrar después)
  */
  constructor({ fetchBytes, canInsert, onInsert, onRequestClose }) {
    this.fetchBytes = fetchBytes;
    this.canInsert = canInsert || (() => false);
    this.onInsert = onInsert || (() => {});
    this.onRequestClose = onRequestClose || (() => {});

    this.asset = null;      // el recurso que se está viendo, o null
    this.bytes = null;
    this.url = null;        // URL de blob de la imagen (hay que revocarla)
    this.img = null;
    this.pdf = null;
    this.natural = null;    // tamaño real de la imagen en píxeles
    this.zoom = 1;
    this.fit = true;        // «Ajustar»: la imagen se encoge para caber
    this.token = 0;         // descarta descargas de un recurso ya cerrado

    this._wire();
  }

  isOpen() { return !!this.asset; }
  name() { return this.asset ? this.asset.name : null; }

  /* ---------- apertura ---------- */

  async open(asset) {
    const my = ++this.token;
    this._releaseBody();
    this.asset = asset;
    this.bytes = null;
    this.natural = null;
    this.zoom = 1;
    this.fit = true;

    $("edCodeBar").style.display = "none";
    $("cmHost").style.display = "none";
    $("assetView").style.display = "flex";

    const ext = extOf(asset.name);
    const badge = $("assetBadge");
    badge.textContent = isPdfAsset(asset.name) ? "PDF" : (isImageAsset(asset.name) ? "IMG" : (ext || "BIN").toUpperCase().slice(0, 4));
    const color = isPdfAsset(asset.name) ? "#e57373" : (isImageAsset(asset.name) ? "#b58bf5" : "#8fa3b8");
    badge.style.color = color;
    badge.style.borderColor = color;
    $("assetName").textContent = asset.name;
    $("assetName").title = asset.name;
    this._setMeta("");
    $("assetInsert").style.display = this.canInsert(asset.name) ? "" : "none";
    this._showZoomControls(false);
    this._message("Cargando…");

    let bytes;
    try {
      bytes = await this.fetchBytes(asset);
    } catch (err) {
      if (my !== this.token) return;
      this._message("No se pudo abrir el archivo.\n" + (err.message || err), true);
      return;
    }
    if (my !== this.token) return;
    if (!bytes || !bytes.length) {
      this._message("El archivo está vacío.");
      return;
    }
    this.bytes = bytes;
    this._setMeta(fmtBytes(bytes.length));

    if (isImageAsset(asset.name)) this._showImage(ext);
    else if (isPdfAsset(asset.name)) await this._showPdf(my);
    else this._showFileCard(ext);
  }

  /* ---------- imágenes ---------- */

  _showImage(ext) {
    this.url = URL.createObjectURL(new Blob([this.bytes], { type: IMG_MIME[ext] }));
    const img = document.createElement("img");
    img.className = "asset-img";
    img.alt = this.asset.name;
    img.draggable = false;
    img.onload = () => {
      // tamaño con el que el navegador la dibuja al 100 %: base del zoom
      this.natural = img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null;
      const dims = ext === "svg"
        ? svgDims(this.bytes)
        : (img.naturalWidth ? `${img.naturalWidth} × ${img.naturalHeight} px` : "");
      this._setMeta(fmtBytes(this.bytes.length) + (dims ? " · " + dims : ""));
      this._showZoomControls(true);
      this._applyImageZoom();
    };
    img.onerror = () => {
      this._showZoomControls(false);
      this._message("El navegador no pudo decodificar esta imagen. Puede que el archivo esté dañado.", true);
    };
    img.src = this.url;
    this._setBody(img);
    this.img = img;
  }

  _applyImageZoom() {
    const img = this.img;
    if (!img) return;
    if (this.fit) {
      img.style.width = "";
      img.style.height = "";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "100%";
    } else {
      img.style.maxWidth = "none";
      img.style.maxHeight = "none";
      if (this.natural) {
        img.style.width = Math.max(1, Math.round(this.natural.w * this.zoom)) + "px";
        img.style.height = "auto";
      }
    }
    this._updateZoomLabel();
  }

  _updateZoomLabel() {
    const el = $("assetZoom");
    if (this.pdf) { el.textContent = Math.round(this.pdf.scale * 100) + "%"; return; }
    if (!this.img) { el.textContent = "—"; return; }
    if (this.fit) {
      // porcentaje real al que ha quedado tras encogerse
      const shown = this.img.clientWidth;
      el.textContent = this.natural && shown ? Math.round(shown / this.natural.w * 100) + "%" : "Ajuste";
    } else {
      el.textContent = Math.round(this.zoom * 100) + "%";
    }
  }

  /* escala visible ahora mismo, para que el primer paso de zoom continúe
     desde lo que se ve y no salte al 100 % */
  _currentImageScale() {
    if (!this.fit) return this.zoom;
    if (this.img && this.natural && this.img.clientWidth) return this.img.clientWidth / this.natural.w;
    return 1;
  }

  async _step(mult) {
    if (this.pdf) {
      await this.pdf.setScale(this.pdf.scale * mult);
      this._updateZoomLabel();
      return;
    }
    if (!this.img) return;
    if (!this.natural) return;            // SVG sin tamaño: solo modo ajuste
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this._currentImageScale() * mult));
    this.fit = false;
    this._applyImageZoom();
  }

  async _doFit() {
    if (this.pdf) { await this._fitPdf(); return; }
    this.fit = true;
    this._applyImageZoom();
  }

  /* ---------- PDF ---------- */

  async _showPdf(my) {
    const scroll = document.createElement("div");
    scroll.className = "asset-pdf";
    this._setBody(scroll);
    const viewer = new PdfViewer(scroll, {
      onPageInfo: (cur, total) => {
        if (this.pdf === viewer) this._setMeta(`${fmtBytes(this.bytes.length)} · página ${cur} / ${total}`);
      }
    });
    viewer.scale = 1;
    this.pdf = viewer;
    try {
      await viewer.load(this.bytes);      // PdfViewer ya copia el buffer
    } catch (err) {
      if (my !== this.token) return;
      this.pdf = null;
      this._message("No se pudo leer el PDF.\n" + (err.message || err), true);
      return;
    }
    if (my !== this.token) return;
    this._showZoomControls(true);
    await this._fitPdf();
  }

  async _fitPdf() {
    const v = this.pdf;
    if (!v) return;
    const canvas = v.container.querySelector("canvas");
    if (!canvas) return;
    const avail = v.container.clientWidth - 36;   // margen del panel
    const shown = canvas.getBoundingClientRect().width;
    if (avail > 0 && shown > 0) await v.setScale(v.scale * avail / shown);
    this._updateZoomLabel();
  }

  /* ---------- formatos sin vista previa ---------- */

  _showFileCard(ext) {
    this._message(
      `No hay vista previa para los archivos .${ext || "?"}, pero el archivo está en el proyecto ` +
      `y pdfTeX puede usarlo si el paquete adecuado lo admite.\n` +
      `Descárgalo para verlo con otro programa.`
    );
  }

  /* ---------- utilidades de la vista ---------- */

  _setBody(node) {
    const body = $("assetBody");
    if (typeof node === "string") body.innerHTML = node;
    else body.replaceChildren(node);
  }

  _message(text, isError) {
    const div = document.createElement("div");
    div.className = "asset-msg" + (isError ? " asset-msg-err" : "");
    div.textContent = text;
    this._setBody(div);
  }

  _setMeta(text) { $("assetMeta").textContent = text; }

  _showZoomControls(on) {
    for (const id of ["assetZoomOut", "assetZoom", "assetZoomIn", "assetFit"])
      $(id).style.display = on ? "" : "none";
    if (on) this._updateZoomLabel();
  }

  _download() {
    if (!this.bytes || !this.asset) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([this.bytes]));
    a.download = this.asset.name.split("/").pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* suelta la imagen y el documento PDF del visor actual */
  _releaseBody() {
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    this.img = null;
    if (this.pdf) {
      const task = this.pdf.task;
      this.pdf = null;
      if (task) Promise.resolve(task.destroy()).catch(() => {});
    }
  }

  /* ---------- cierre ---------- */

  close() {
    if (!this.asset) return;
    this.token++;
    this._releaseBody();
    this.asset = null;
    this.bytes = null;
    this.natural = null;
    $("assetBody").replaceChildren();
    $("assetView").style.display = "none";
    $("cmHost").style.display = "";
    $("edCodeBar").style.display = "";
  }

  /* ---------- eventos ---------- */

  _wire() {
    $("assetClose").onclick = () => this.onRequestClose();
    $("assetDownload").onclick = () => this._download();
    $("assetInsert").onclick = () => { if (this.asset) this.onInsert(this.asset); };
    $("assetZoomIn").onclick = () => this._step(1.25);
    $("assetZoomOut").onclick = () => this._step(1 / 1.25);
    $("assetFit").onclick = () => this._doFit();

    /* Ctrl+rueda hace zoom, como en cualquier visor; la rueda sola sigue
       desplazando el panel. */
    $("assetBody").addEventListener("wheel", ev => {
      if (!ev.ctrlKey || !this.isOpen()) return;
      ev.preventDefault();
      this._step(ev.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    /* al recolocar los paneles, «Ajustar» deja de estar ajustado */
    window.addEventListener("resize", () => {
      if (this.isOpen() && this.fit) this._updateZoomLabel();
    });
  }
}
