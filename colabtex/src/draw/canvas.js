"use strict";
/* ============================================================
   ColabDraw — el lienzo

   Mantiene un espejo del árbol Yjs en SVG de verdad dentro del DOM, y
   lo va PARCHEANDO con los cambios en vez de repintarlo entero: durante
   un arrastre se repinta a 60 fps y rehacer el documento cada vez
   destruiría la selección y el rendimiento.

   Estructura:

     <svg class="dw-view">                    espacio de pantalla (px CSS)
       <g class="dw-scene" transform=…>       encuadre y zoom
         <rect class="dw-page"/>              el papel
         <g class="dw-grid"/>                 rejilla
         <g class="dw-content"/>              ESPEJO del <svg> del documento
       </g>
       <g class="dw-overlay"/>                tiradores, en px: no escalan
     </svg>

   Las medidas se sacan siempre del DOM real (getBBox + getScreenCTM),
   no de las cuentas propias: así un trazo con marcadores, un texto o un
   grupo girado dan la caja que de verdad se ve.
   ============================================================ */
import * as Y from "yjs";
import { SVG_NS, XLINK_NS, isEl, SHAPE_TAGS } from "./doc.js";
import { boxOfPoints, transformBox, clamp } from "./geom.js";

const MIN_ZOOM = 0.2;     // px de pantalla por mm
const MAX_ZOOM = 80;

const svgEl = tag => document.createElementNS(SVG_NS, tag);

export class Canvas {
  constructor(host, { onViewChange = null } = {}) {
    this.host = host;
    this.onViewChange = onViewChange;
    this.drawing = null;
    this.yToDom = new Map();
    this.domToY = new WeakMap();
    this._observer = null;
    this.grid = { show: true, step: 5, snap: true };
    this.k = 3;                       // zoom: px de pantalla por mm
    this.tx = 0;
    this.ty = 0;

    const view = svgEl("svg");
    view.setAttribute("class", "dw-view");
    view.setAttribute("width", "100%");
    view.setAttribute("height", "100%");

    this.scene = svgEl("g");
    this.scene.setAttribute("class", "dw-scene");

    this.pageShadow = svgEl("rect");
    this.pageShadow.setAttribute("class", "dw-page-shadow");
    this.page = svgEl("rect");
    this.page.setAttribute("class", "dw-page");
    this.gridG = svgEl("g");
    this.gridG.setAttribute("class", "dw-grid");
    this.content = svgEl("g");
    this.content.setAttribute("class", "dw-content");

    this.scene.append(this.pageShadow, this.page, this.gridG, this.content);

    this.overlay = svgEl("g");
    this.overlay.setAttribute("class", "dw-overlay");

    view.append(this.scene, this.overlay);
    this.view = view;
    host.appendChild(view);

    this._applyView();
  }

  /* ---------- ciclo de vida ---------- */

  attach(drawing) {
    this.detach();
    this.drawing = drawing;
    if (!drawing) return;
    this._rebuild();
    this._observer = events => this._onChange(events);
    drawing.frag.observeDeep(this._observer);
  }

  detach() {
    if (this.drawing && this._observer) this.drawing.frag.unobserveDeep(this._observer);
    this._observer = null;
    this.drawing = null;
    this.yToDom.clear();
    this.content.textContent = "";
    this.overlay.textContent = "";
  }

  destroy() {
    this.detach();
    if (this.view.parentNode) this.view.parentNode.removeChild(this.view);
  }

  /* ---------- espejo Yjs → DOM ---------- */

  _rebuild() {
    this.yToDom.clear();
    this.content.textContent = "";
    const root = this.drawing.root();
    if (!root) return;
    this.yToDom.set(root, this.content);
    this.domToY.set(this.content, root);
    for (const kid of root.toArray()) {
      const node = this._build(kid);
      if (node) this.content.appendChild(node);
    }
    this.refreshPage();
  }

  _build(yNode) {
    if (yNode instanceof Y.XmlText) {
      const t = document.createTextNode(yNode.toString());
      this.domToY.set(t, yNode);
      this.yToDom.set(yNode, t);
      return t;
    }
    if (!isEl(yNode)) return null;
    const el = svgEl(yNode.nodeName);
    const attrs = yNode.getAttributes();
    for (const [k, v] of Object.entries(attrs)) this._setAttr(el, k, v);
    this.yToDom.set(yNode, el);
    this.domToY.set(el, yNode);
    for (const kid of yNode.toArray()) {
      const child = this._build(kid);
      if (child) el.appendChild(child);
    }
    return el;
  }

  _setAttr(el, key, value) {
    if (value == null) { this._removeAttr(el, key); return; }
    const v = String(value);
    if (key === "xmlns" || key === "xmlns:xlink") return;   // los pone el documento exportado
    if (key.startsWith("xlink:")) { el.setAttributeNS(XLINK_NS, key, v); return; }
    try { el.setAttribute(key, v); } catch (e) { /* nombre inválido: se ignora */ }
  }

  _removeAttr(el, key) {
    if (key.startsWith("xlink:")) el.removeAttributeNS(XLINK_NS, key.slice(6));
    else el.removeAttribute(key);
  }

  _onChange(events) {
    let pageDirty = false;
    const root = this.drawing && this.drawing.root();
    try {
      for (const ev of events) {
        const target = ev.target;
        if (target === root) pageDirty = true;

        if (target instanceof Y.XmlText && ev.delta) {
          const dom = this.yToDom.get(target);
          if (dom) dom.nodeValue = target.toString();
          continue;
        }

        const dom = this.yToDom.get(target);
        if (!dom) continue;

        if (ev.attributesChanged && ev.attributesChanged.size) {
          for (const key of ev.attributesChanged) {
            const v = target.getAttribute(key);
            if (v === undefined || v === null) this._removeAttr(dom, key);
            else this._setAttr(dom, key, v);
          }
        }
        if (ev.changes && ev.changes.delta && ev.changes.delta.length)
          this._applyDelta(dom, ev.changes.delta);
      }
    } catch (err) {
      // el espejo no puede quedar a medias: ante cualquier sorpresa, se rehace
      console.error("ColabDraw: espejo desincronizado, se reconstruye", err);
      this._rebuild();
      this._emit();
      return;
    }
    if (pageDirty) this.refreshPage();
    this._emit();
  }

  _applyDelta(domParent, delta) {
    let i = 0;
    for (const op of delta) {
      if (op.retain) { i += op.retain; continue; }
      if (op.insert) {
        const ref = domParent.childNodes[i] || null;
        for (const yNode of op.insert) {
          const node = this._build(yNode);
          if (!node) continue;
          domParent.insertBefore(node, ref);
          i++;
        }
        continue;
      }
      if (op.delete) {
        for (let n = 0; n < op.delete; n++) {
          const node = domParent.childNodes[i];
          if (!node) break;
          this._forget(node);
          domParent.removeChild(node);
        }
      }
    }
  }

  _forget(node) {
    const y = this.domToY.get(node);
    if (y) this.yToDom.delete(y);
    for (const child of Array.from(node.childNodes || [])) this._forget(child);
  }

  /* ---------- página y rejilla ---------- */

  refreshPage() {
    if (!this.drawing) return;
    const { w, h } = this.drawing.size();
    for (const r of [this.page, this.pageShadow]) {
      r.setAttribute("x", 0); r.setAttribute("y", 0);
      r.setAttribute("width", w); r.setAttribute("height", h);
    }
    this.pageShadow.setAttribute("x", 0.6);
    this.pageShadow.setAttribute("y", 0.6);
    this._drawGrid(w, h);
  }

  setGrid(opts) {
    Object.assign(this.grid, opts);
    if (this.drawing) {
      const { w, h } = this.drawing.size();
      this._drawGrid(w, h);
    }
  }

  _drawGrid(w, h) {
    this.gridG.textContent = "";
    const step = this.grid.step;
    if (!this.grid.show || !(step > 0)) return;
    // a poco zoom la rejilla fina es una mancha gris: se salta
    const fine = this.k * step >= 4;
    const minor = [], major = [];
    for (let i = 0, x = 0; x <= w + 1e-6; i++, x = i * step) {
      (i % 5 === 0 ? major : minor).push(`M${x} 0V${h}`);
    }
    for (let i = 0, y = 0; y <= h + 1e-6; i++, y = i * step) {
      (i % 5 === 0 ? major : minor).push(`M0 ${y}H${w}`);
    }
    if (fine && minor.length) {
      const p = svgEl("path");
      p.setAttribute("class", "dw-grid-minor");
      p.setAttribute("d", minor.join(""));
      this.gridG.appendChild(p);
    }
    const p2 = svgEl("path");
    p2.setAttribute("class", "dw-grid-major");
    p2.setAttribute("d", major.join(""));
    this.gridG.appendChild(p2);
  }

  snapStep() { return this.grid.snap ? this.grid.step : 0; }

  /* ---------- encuadre y zoom ---------- */

  _applyView() {
    this.scene.setAttribute("transform", `translate(${this.tx},${this.ty}) scale(${this.k})`);
    if (this.grid.show && this.drawing) {
      const { w, h } = this.drawing.size();
      this._drawGrid(w, h);
    }
  }

  _emit() { if (this.onViewChange) this.onViewChange(); }

  rect() { return this.view.getBoundingClientRect(); }

  /* Punto de pantalla → coordenadas del documento (mm). Se usa la matriz
     real del DOM: recoge el zoom del navegador y cualquier transformación
     CSS de por medio sin tener que adivinarla. */
  toDoc(clientX, clientY) {
    const ctm = this.scene.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    return { x: inv.a * clientX + inv.c * clientY + inv.e, y: inv.b * clientX + inv.d * clientY + inv.f };
  }

  /* Coordenadas del documento → espacio del <svg> exterior (px), que es
     donde viven los tiradores para no crecer con el zoom. */
  toLocal(pt) {
    return { x: pt.x * this.k + this.tx, y: pt.y * this.k + this.ty };
  }

  clientToLocal(clientX, clientY) {
    const r = this.rect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  panBy(dxPx, dyPx) {
    this.tx += dxPx; this.ty += dyPx;
    this._applyView(); this._emit();
  }

  /* Zoom manteniendo quieto el punto de pantalla que se indique (el
     puntero): es lo que hace que la rueda no despiste. */
  zoomTo(k, anchorClient) {
    const next = clamp(k, MIN_ZOOM, MAX_ZOOM);
    if (next === this.k) return;
    if (anchorClient) {
      const before = this.toDoc(anchorClient.x, anchorClient.y);
      this.k = next;
      this._applyView();
      const after = this.toDoc(anchorClient.x, anchorClient.y);
      this.tx += (after.x - before.x) * this.k;
      this.ty += (after.y - before.y) * this.k;
    } else {
      const r = this.rect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const before = this.toDoc(c.x, c.y);
      this.k = next;
      this._applyView();
      const after = this.toDoc(c.x, c.y);
      this.tx += (after.x - before.x) * this.k;
      this.ty += (after.y - before.y) * this.k;
    }
    this._applyView();
    this._emit();
  }

  zoomBy(factor, anchorClient) { this.zoomTo(this.k * factor, anchorClient); }

  fitBox(box, margin = 24) {
    const r = this.rect();
    if (!box || !r.width || !box.w || !box.h) return;
    const k = clamp(Math.min((r.width - margin * 2) / box.w, (r.height - margin * 2) / box.h),
      MIN_ZOOM, MAX_ZOOM);
    this.k = k;
    this.tx = r.width / 2 - (box.x + box.w / 2) * k;
    this.ty = r.height / 2 - (box.y + box.h / 2) * k;
    this._applyView();
    this._emit();
  }

  fitPage() {
    if (!this.drawing) return;
    const { w, h } = this.drawing.size();
    this.fitBox({ x: 0, y: 0, w, h });
  }

  /* ---------- medidas ---------- */

  /* Caja de un elemento en coordenadas del documento. */
  boxOf(yEl) {
    const dom = this.yToDom.get(yEl);
    if (!dom || !dom.getBBox) return null;
    let b;
    // getBBox revienta con lo que no se está pintando (un grupo vacío,
    // algo con display:none): ahí simplemente no hay caja que dar
    try { b = dom.getBBox(); } catch (e) { return null; }
    if (!b) return null;
    const m = this._matrixToContent(dom);
    const box = { x: b.x, y: b.y, w: b.width, h: b.height };
    return m ? transformBox(box, m) : box;
  }

  boxOfMany(yEls) {
    const boxes = yEls.map(e => this.boxOf(e)).filter(Boolean);
    if (!boxes.length) return null;
    return boxOfPoints(boxes.flatMap(b => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]));
  }

  /* Matriz del espacio de usuario de un nodo al del contenido. */
  _matrixToContent(dom) {
    try {
      const a = this.content.getScreenCTM();
      const b = dom.getScreenCTM();
      if (!a || !b) return null;
      const m = a.inverse().multiply(b);
      return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
    } catch (e) { return null; }
  }

  /* Matriz del espacio del padre de un elemento al del contenido: es la
     que hay que invertir para convertir un desplazamiento del ratón en
     el desplazamiento que toca escribir en su transform. */
  parentMatrix(yEl) {
    const dom = this.yToDom.get(yEl);
    if (!dom || !dom.parentNode) return null;
    return this._matrixToContent(dom.parentNode);
  }

  /* ---------- selección por puntero ---------- */

  /* Elemento de más arriba bajo el punto. Se sube desde lo que hay bajo
     el puntero hasta el hijo directo de la capa, para que pinchar dentro
     de un grupo seleccione el grupo entero, como en Inkscape.

     La subida PARA en la capa: una capa también es un <g>, así que sin
     este corte se acabaría seleccionando la capa entera y arrastrar una
     figura movería el dibujo completo. */
  hitTest(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    let node = el;
    let best = null;
    let topped = false;
    while (node && node !== this.content) {
      const y = this.domToY.get(node);
      if (y && isEl(y)) {
        if (y.getAttribute("data-layer") != null) { topped = true; break; }
        if (SHAPE_TAGS.has(y.nodeName)) best = y;
      }
      node = node.parentNode;
    }
    // sin capa (SVG importado suelto) hay que haber llegado al contenido
    if (!topped && node !== this.content) return null;
    return best;
  }

  /* Figuras cuya caja toca (o queda dentro de) el rectángulo dado. */
  elementsIn(box, { contained = false } = {}) {
    if (!this.drawing) return [];
    const out = [];
    for (const el of this.drawing.shapes()) {
      const b = this.boxOf(el);
      if (!b) continue;
      const hit = contained
        ? b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h
        : b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h;
      if (hit) out.push(el);
    }
    return out;
  }
}

export { MIN_ZOOM, MAX_ZOOM };
