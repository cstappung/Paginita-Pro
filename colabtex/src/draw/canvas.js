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
const MAX_HOJAS = 600;    // nodos que se revisan al pinchar cerca (ver hitNear)

const svgEl = tag => document.createElementNS(SVG_NS, tag);

export class Canvas {
  constructor(host, { onViewChange = null } = {}) {
    this.host = host;
    this.onViewChange = onViewChange;
    this.drawing = null;
    this.yToDom = new Map();
    this.domToY = new WeakMap();
    this._observer = null;
    /* Paso de 1 mm, no de 5. Con 5 el imán no afinaba: era un molde. Un
       rectángulo de 12×7 salía de 10×5, una línea a (90,62) salía
       horizontal y no se podía ajustar nada por debajo de medio
       centímetro. Quien quiera media rejilla gruesa la escribe. */
    this.grid = { show: true, step: 1, snap: true };
    this.pagePreview = null;          // caja del recorte mientras se arrastra
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

  /* Caja del papel. Con el recorte, el viewBox puede no empezar en (0,0):
     el papel se mueve por debajo del dibujo y las figuras no se tocan. */
  pageBox() {
    if (!this.drawing) return { x: 0, y: 0, w: 0, h: 0 };
    const s = this.drawing.size();
    return { x: s.x || 0, y: s.y || 0, w: s.w, h: s.h };
  }

  /* Recorte en curso: se pinta sin escribir en el documento, igual que la
     vista previa de un arrastre. */
  previewPage(box) {
    this.pagePreview = box || null;
    this.refreshPage();
  }

  refreshPage() {
    if (!this.drawing) return;
    const b = this.pagePreview || this.pageBox();
    for (const r of [this.page, this.pageShadow]) {
      r.setAttribute("x", b.x); r.setAttribute("y", b.y);
      r.setAttribute("width", b.w); r.setAttribute("height", b.h);
    }
    this.pageShadow.setAttribute("x", b.x + 0.6);
    this.pageShadow.setAttribute("y", b.y + 0.6);
    this._drawGrid(b);
  }

  setGrid(opts) {
    Object.assign(this.grid, opts);
    if (this.drawing) this._drawGrid(this.pagePreview || this.pageBox());
  }

  _drawGrid(box) {
    this.gridG.textContent = "";
    const step = this.grid.step;
    if (!this.grid.show || !(step > 0)) return;
    const { x: x0 = 0, y: y0 = 0, w, h } = box || this.pageBox();
    const x1 = x0 + w, y1 = y0 + h;
    // a poco zoom la rejilla fina es una mancha gris: se salta
    const fine = this.k * step >= 4;
    const minor = [], major = [];
    for (let i = 0, x = x0; x <= x1 + 1e-6; i++, x = x0 + i * step) {
      (i % 5 === 0 ? major : minor).push(`M${x} ${y0}V${y1}`);
    }
    for (let i = 0, y = y0; y <= y1 + 1e-6; i++, y = y0 + i * step) {
      (i % 5 === 0 ? major : minor).push(`M${x0} ${y}H${x1}`);
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
    if (this.grid.show && this.drawing) this._drawGrid(this.pagePreview || this.pageBox());
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
    this.fitBox(this.pageBox());
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

  /* Caja de un elemento EN SUS PROPIAS coordenadas (sin aplicar su
     transform). Es lo que hace falta para escalar una figura girada en
     sus ejes en vez de en los del documento. */
  localBox(yEl) {
    const dom = this.yToDom.get(yEl);
    if (!dom || !dom.getBBox) return null;
    try {
      const b = dom.getBBox();
      if (!b) return null;
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    } catch (e) { return null; }
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

  /* La del propio elemento. Hace falta para meter una figura DENTRO de
     otro nodo (cambiarla de capa): ahí el espacio de destino es el del
     nodo, no el de su padre. */
  selfMatrix(yEl) {
    const dom = this.yToDom.get(yEl);
    if (!dom) return null;
    return this._matrixToContent(dom);
  }

  /* ---------- selección por puntero ---------- */

  /* Elemento de más arriba bajo el punto. Se sube desde lo que hay bajo
     el puntero hasta el hijo directo de la capa, para que pinchar dentro
     de un grupo seleccione el grupo entero, como en Inkscape.

     La subida PARA en la capa: una capa también es un <g>, así que sin
     este corte se acabaría seleccionando la capa entera y arrastrar una
     figura movería el dibujo completo. */
  hitTest(clientX, clientY, { deep = false } = {}) {
    return this._pick(document.elementFromPoint(clientX, clientY), deep);
  }

  /* Sube desde un nodo del DOM hasta la capa, quedándose con la figura
     que toque: la de más afuera (el grupo entero) o, con `deep`, la
     hoja concreta que hay bajo el puntero. */
  _pick(el, deep) {
    if (!el) return null;
    let node = el, fuera = null, dentro = null, topped = false;
    while (node && node !== this.content) {
      const y = this.domToY.get(node);
      if (y && isEl(y)) {
        if (y.getAttribute("data-layer") != null) { topped = true; break; }
        if (SHAPE_TAGS.has(y.nodeName)) { if (!dentro) dentro = y; fuera = y; }
      }
      node = node.parentNode;
    }
    // sin capa (SVG importado suelto) hay que haber llegado al contenido
    if (!topped && node !== this.content) return null;
    return deep ? dentro : fuera;
  }

  /* ---------- pinchar cerca ----------

     `elementFromPoint` exige caer DENTRO del trazo, y un trazo de 0,4 mm
     mide menos de dos píxeles en pantalla: una línea recién dibujada era
     casi imposible de volver a seleccionar. Aquí se busca lo que pase
     cerca, en dos pasos para que salga barato incluso en una figura de
     matplotlib con miles de nodos:

       1. se descartan por su caja las figuras que ni de lejos tocan;
       2. a las que quedan se les pregunta a ellas mismas, con
          `isPointInStroke` sobre un trazo ensanchado a la tolerancia.

     El segundo paso es lo que evita el falso positivo de una diagonal
     larga, cuya caja envolvente ocupa media pantalla. */
  hitNear(clientX, clientY, { deep = false, tolPx = 5 } = {}) {
    if (!this.drawing) return null;
    const p = this.toDoc(clientX, clientY);
    const tol = tolPx / (this.k || 1);
    let mejor = null;
    for (const el of this.drawing.shapes()) {          // en orden de pintado
      const b = this.boxOf(el);
      if (!b) continue;
      if (p.x < b.x - tol || p.x > b.x + b.w + tol) continue;
      if (p.y < b.y - tol || p.y > b.y + b.h + tol) continue;
      const hoja = this._hojaCerca(this.yToDom.get(el), clientX, clientY, tolPx);
      if (hoja) mejor = deep ? (this.domToY.get(hoja) || el) : el;
    }
    return mejor;
  }

  /* Primera hoja dibujable de `dom` cuyo trazo (ensanchado) pilla el
     punto. Devuelve el nodo del DOM espejo, o null. */
  _hojaCerca(dom, clientX, clientY, tolPx) {
    if (!dom) return null;
    const nodos = dom.isPointInStroke
      ? [dom]
      // el tope es por si es un grupo importado con miles de nodos: un
      // clic en el vacío no puede costar un repaso al archivo entero
      : Array.from(dom.querySelectorAll("*")).slice(0, MAX_HOJAS);
    for (const n of nodos) {
      if (!n.isPointInStroke || !n.getScreenCTM) continue;
      // sin trazo no hay nada cerca de lo que estar
      const trazo = getComputedStyle(n).stroke;
      if (!trazo || trazo === "none") continue;
      const ctm = n.getScreenCTM();
      if (!ctm) continue;
      let pt;
      try { pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse()); }
      catch (e) { continue; }
      const escala = Math.hypot(ctm.a, ctm.b) || 1;
      const previo = n.style.strokeWidth;
      n.style.strokeWidth = String((tolPx * 2) / escala);
      let dentro = false;
      try { dentro = n.isPointInStroke(pt); } catch (e) {}
      if (previo) n.style.strokeWidth = previo; else n.style.removeProperty("stroke-width");
      if (dentro) return n;
    }
    return null;
  }

  /* Todas las figuras bajo el punto, de la de encima a la del fondo. La
     usa el alt+clic para ir bajando por el montón, como en Inkscape. */
  hitStack(clientX, clientY, { deep = true } = {}) {
    const out = [];
    const nodes = document.elementsFromPoint
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)];
    for (const n of nodes) {
      const y = this._pick(n, deep);
      if (y && !out.includes(y)) out.push(y);
    }
    return out;
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
