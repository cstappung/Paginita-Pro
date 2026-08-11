"use strict";
/* ============================================================
   ColabDraw — herramientas y selección

   Regla de oro del arrastre: mientras el ratón está abajo NO se toca
   el documento Yjs, solo el DOM del espejo. Al soltar se escribe UNA
   vez. Un mousemove escribe 60 veces por segundo, y cada escritura en
   Yjs es un envío a Realtime Database: mandar eso sería castigar la
   base de datos y llenar el historial de deshacer de basura. Quien
   colabora ve la figura moverse al soltar; su posición en vivo viaja
   por «presencia», que es efímera y no entra en el documento.
   ============================================================ */
import {
  parseTransform, matToString, matMul, matInvert, matApply, matApplyVec,
  translate, scaleAbout, rotateM, boxFromDrag, boxCorners, boxOfPoints,
  snapBoxDelta, snapValue, angleOf, dist, clamp, fmt
} from "./geom.js";
import { DEFAULT_CAP, DEFAULT_JOIN, capAttr, joinAttr } from "./stroke.js";
import { SVG_NS, newId } from "./doc.js";
import { addText, isText, TEXT_ATTRS, DEFAULT_FONT, DEFAULT_SIZE } from "./text.js";
import { esFormula } from "./latex.js";
import { clipboardSvg, textToNodes } from "./svgio.js";

const svgEl = tag => document.createElementNS(SVG_NS, tag);

/* Tiradores de escala: nombre → posición relativa dentro de la caja. */
const HANDLES = [
  ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0],
  ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1],
  ["sw", 0, 1], ["w", 0, 0.5]
];
const CURSORS = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize"
};

const MIN_SIZE = 0.2;      // mm: por debajo de esto un arrastre es un clic

/* Píxeles de PANTALLA que hay que recorrer para que un gesto cuente como
   arrastre. Sin este umbral, el imán se aplicaba ya en el primer
   mousemove: pinchar una figura que no estuviera sobre la rejilla la
   corría hasta ella —y lo escribía en el documento, o sea en la pantalla
   de todo el equipo y en el historial de deshacer— con solo seleccionarla.
   Se mide en píxeles y no en milímetros a propósito: el temblor de la
   mano es del mismo tamaño con cualquier zoom. */
const DRAG_PX = 3;

/* Lo mínimo que puede medir la página al recortarla. */
const MIN_PAGE = 5;        // mm

const casiCero = v => Math.abs(v) < 1e-6;
/* ¿La matriz lleva giro (o sesgo)? Si no, escalar en los ejes del
   documento y en los de la figura es lo mismo. */
const girada = m => !!m && (!casiCero(m.b) || !casiCero(m.c));
const casiIdentidad = m => !!m &&
  casiCero(m.a - 1) && casiCero(m.d - 1) && casiCero(m.b) && casiCero(m.c) &&
  casiCero(m.e) && casiCero(m.f);

export class Tools {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.getDrawing = opts.getDrawing || (() => null);
    this.onSelectionChange = opts.onSelectionChange || (() => {});
    this.onStatus = opts.onStatus || (() => {});
    this.onToolChange = opts.onToolChange || (() => {});
    this.canWrite = opts.canWrite || (() => true);
    /* Capa donde va lo que se dibuje. Sin panel de capas se deja en null
       y el modelo elige la de más arriba, como antes. */
    this.getLayer = opts.getLayer || (() => null);
    /* Escribir un texto es abrir el editor de texto, que vive fuera de
       aquí porque es un <textarea> encima del lienzo. */
    this.onEditText = opts.onEditText || (() => {});
    /* Una fórmula se escribe en su propio cuadro (draw-main lo abre):
       con elemento se corrige la que hay, sin él se pone una nueva. */
    this.onEditFormula = opts.onEditFormula || (() => {});
    this.style = Object.assign({
      fill: "#cfe3ff", stroke: "#1f2933", "stroke-width": 0.4, opacity: 1,
      "stroke-linecap": DEFAULT_CAP, "stroke-linejoin": DEFAULT_JOIN,
      "stroke-dasharray": ""
    }, opts.style || {});
    /* El texto lleva su propio estilo: su color es el RELLENO, y heredar
       el de las figuras haría que el primer rótulo saliera azul claro. */
    this.textStyle = Object.assign({
      "font-family": DEFAULT_FONT, "font-size": DEFAULT_SIZE, fill: "#1f2933"
    }, opts.textStyle || {});

    /* Opciones de DIBUJO, las que no son atributos del SVG y por eso no
       caben en `style`: el redondeo de esquina que llevará el próximo
       rectángulo y si la herramienta se queda en la mano al soltar.
       Las lleva la barra de opciones (tool-options.js). */
    this.crear = Object.assign({ rx: 0, mantener: false }, opts.crear || {});

    this.tool = "select";
    this.sel = [];
    this.drag = null;
    this._spaceDown = false;
    this._lastClick = null;   // para detectar el doble clic sin depender del DOM
    this.clip = null;         // portapapeles propio, por si el del sistema falla

    this._onDown = e => this._pointerDown(e);
    this._onMove = e => this._pointerMove(e);
    this._onUp = e => this._pointerUp(e);
    this._onWheel = e => this._wheel(e);
    this._onKey = e => this._keyDown(e);
    this._onKeyUp = e => { if (e.code === "Space") this._spaceDown = false; };
    this._onCtx = e => e.preventDefault();
    this._onCopy = e => this._clipWrite(e, false);
    this._onCut = e => this._clipWrite(e, true);
    this._onPaste = e => this._clipRead(e);

    const v = canvas.view;
    v.addEventListener("pointerdown", this._onDown);
    v.addEventListener("pointermove", this._onMove);
    v.addEventListener("pointerup", this._onUp);
    v.addEventListener("pointercancel", this._onUp);
    v.addEventListener("wheel", this._onWheel, { passive: false });
    v.addEventListener("contextmenu", this._onCtx);
    document.addEventListener("keydown", this._onKey);
    document.addEventListener("keyup", this._onKeyUp);
    /* Copiar y pegar se enganchan a los eventos del documento, no a
       Ctrl+C/Ctrl+V en el teclado. Así llega el portapapeles DE VERDAD
       sin pedir permisos (leerlo a mano exige autorización), y funciona
       con el menú del botón derecho, con Cmd en un Mac y entre pestañas
       o programas. */
    document.addEventListener("copy", this._onCopy);
    document.addEventListener("cut", this._onCut);
    document.addEventListener("paste", this._onPaste);
  }

  destroy() {
    const v = this.canvas.view;
    v.removeEventListener("pointerdown", this._onDown);
    v.removeEventListener("pointermove", this._onMove);
    v.removeEventListener("pointerup", this._onUp);
    v.removeEventListener("pointercancel", this._onUp);
    v.removeEventListener("wheel", this._onWheel);
    v.removeEventListener("contextmenu", this._onCtx);
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("copy", this._onCopy);
    document.removeEventListener("cut", this._onCut);
    document.removeEventListener("paste", this._onPaste);
  }

  /* ---------- portapapeles ----------
     Se guarda TEXTO, no nodos: un clon de Yjs sin integrar no se puede
     leer, así que un portapapeles de nodos solo valdría para pegar una
     vez. En texto se pega las veces que haga falta, en otro dibujo y en
     otra pestaña. */

  _enTexto(e) {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return true;
    /* Si hay texto de la página marcado con el ratón, copiar es copiar
       ESE texto: quedarnos el atajo se llevaría por delante algo tan
       normal como copiar el enlace para compartir. */
    const sel = window.getSelection && window.getSelection();
    return !!(sel && !sel.isCollapsed && String(sel).trim());
  }

  _clipWrite(e, cortar) {
    if (this._enTexto(e)) return;
    const d = this.getDrawing();
    if (!d) return;

    /* Sin nada elegido se copia la CAPA ACTIVA entera, que es la otra
       forma de copiar que se espera aquí. */
    let nodos = this.sel.filter(n => n && n.parent);
    const capa = !nodos.length ? this.getLayer() : null;
    if (capa) nodos = [capa];
    if (!nodos.length) return;

    const { w, h } = d.size();
    const texto = clipboardSvg(nodos, { w, h });
    this.clip = texto;
    if (e.clipboardData) {
      e.clipboardData.setData("text/plain", texto);
      e.clipboardData.setData("image/svg+xml", texto);
      e.preventDefault();
    }

    if (cortar && this.canWrite()) {
      if (capa) {
        if (!d.removeLayer(capa)) { this.onStatus("Un dibujo no puede quedarse sin capas."); return; }
      } else {
        d.remove(nodos);
      }
      this.clear();
    }
    this.onStatus(capa
      ? `Capa «${d.labelOf(capa)}» ${cortar ? "cortada" : "copiada"}.`
      : `${nodos.length} objeto${nodos.length === 1 ? "" : "s"} ${cortar ? "cortado" : "copiado"}${nodos.length === 1 ? "" : "s"}.`);
  }

  _clipRead(e) {
    if (this._enTexto(e) || !this.canWrite()) return;
    const dt = e.clipboardData;
    let texto = dt ? (dt.getData("image/svg+xml") || dt.getData("text/plain")) : "";
    // lo de fuera solo sirve si de verdad es marcado SVG
    if (!/<\s*(svg|g|path|rect|circle|ellipse|line|polyline|polygon|text|image|use)[\s>/]/i.test(texto))
      texto = this.clip || "";
    if (!texto) return;
    e.preventDefault();
    this.paste(texto);
  }

  /* Pega marcado SVG. Una capa entera se pega COMO capa; lo demás va a la
     capa activa, un poco desplazado para que se vea que hay dos. */
  paste(texto, { dx = 2, dy = 2 } = {}) {
    const d = this.getDrawing();
    if (!d || !this.canWrite()) return [];
    let nodes, info;
    try { ({ nodes, info } = textToNodes(texto)); }
    catch (err) { this.onStatus("Eso no se puede pegar aquí."); return []; }
    if (!nodes.length) { this.onStatus("No había nada que pegar."); return []; }

    if (info.every(i => i.layer)) {
      const puestas = d.pasteLayers(nodes, info.map(i => i.label));
      this.clear();
      this.onStatus(`${puestas.length} capa${puestas.length === 1 ? "" : "s"} pegada${puestas.length === 1 ? "" : "s"}.`);
      return puestas;
    }

    /* El desplazamiento se compone con el transform que ya traía, leído
       de la ficha: preguntárselo al nodo sin integrar no devuelve nada y
       se perdería su giro o su escala. */
    nodes.forEach((n, i) => {
      const previo = info[i].transform;
      const t = `translate(${fmt(dx)},${fmt(dy)}) ${previo}`.trim();
      if (dx || dy || previo) n.setAttribute("transform", t);
    });
    const puestos = d.insertNodes(this.getLayer(), nodes);
    this.select(puestos);
    this.onStatus(`${puestos.length} objeto${puestos.length === 1 ? "" : "s"} pegado${puestos.length === 1 ? "" : "s"}.`);
    return puestos;
  }

  /* ---------- selección ---------- */

  selection() { return this.sel.slice(); }

  setTool(name) {
    this.tool = name;
    this.canvas.view.style.cursor =
      name === "select" ? "default" : name === "text" ? "text"
        : name === "page" ? "move" : "crosshair";
    /* El recuadro de recorte del papel sustituye al de la selección
       mientras dure el modo, así que hay que repintar la capa de encima. */
    if (name === "page") this.clear();
    this.redrawOverlay();
    this.onToolChange(name);
  }

  select(els, { add = false } = {}) {
    const list = [].concat(els).filter(Boolean);
    if (add) {
      for (const el of list) {
        const i = this.sel.indexOf(el);
        if (i >= 0) this.sel.splice(i, 1); else this.sel.push(el);
      }
    } else {
      this.sel = list;
    }
    this.redrawOverlay();
    this.onSelectionChange(this.selection());
  }

  clear() { this.select([]); }

  /* Cuánto agranda el lienzo lo que hay elegido (1 = tal cual). Lo usa el
     panel para enseñar el grosor de trazo que de verdad se ve: escalar se
     guarda en el `transform`, no en `stroke-width`. Si la selección no se
     pone de acuerdo se devuelve 1 y no se traduce nada, que es mejor que
     inventarse un número. */
  selectionScale() {
    let k = null;
    for (const el of this.sel) {
      const m = this.canvas.selfMatrix(el);
      if (!m) continue;
      const s = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      if (k == null) k = s;
      else if (Math.abs(s - k) > k * 0.01) return 1;
    }
    return k || 1;
  }

  selectAll() {
    const d = this.getDrawing();
    if (d) this.select(d.shapes());
  }

  /* Tras clonar (orden Z, agrupar…) los elementos son otros: la
     selección se rehace por id, que es lo que sobrevive al clonado. */
  reselectByIds(ids) {
    const d = this.getDrawing();
    if (!d) return;
    this.select(ids.map(id => d.byId(id)).filter(Boolean));
  }

  /* ---------- dibujo del recuadro y los tiradores ----------

     El marco de UNA figura girada se dibuja girado con ella, no como la
     caja horizontal que la envuelve. No es cosmética: los tiradores
     marcan en qué direcciones se va a escalar, y con una caja horizontal
     alrededor de un rectángulo girado 30° tirar del lado derecho lo
     convertía en un romboide. Con el marco pegado a la figura, escalar
     ocurre en los ejes de la propia figura y sigue siendo un rectángulo.

     `_marco()` devuelve las cuatro esquinas EN COORDENADAS DEL DOCUMENTO,
     así que lo de abajo pinta igual en los dos casos. */

  _marco() {
    if (!this.sel.length) return null;
    if (this.sel.length === 1) {
      const el = this.sel[0];
      const dom = this.canvas.yToDom.get(el);
      const m = this.canvas.selfMatrix(el);
      if (dom && m && girada(m)) {
        const b = this.canvas.localBox(el);
        if (b) return { pts: boxCorners(b).map(p => matApply(m, p)), local: true, m, box: b };
      }
    }
    const box = this.canvas.boxOfMany(this.sel);
    return box ? { pts: boxCorners(box), local: false, box } : null;
  }

  /* Los ocho tiradores del marco, en coordenadas del documento. Un lado
     de longitud cero (una línea recta) se queda SIN sus dos tiradores
     perpendiculares: por ahí no se puede escalar —multiplicar cero por
     lo que sea sigue siendo cero— y unos tiradores que no hacen nada al
     tirar de ellos parecen la aplicación rota. */
  _tiradores(marco) {
    const [nw, ne, se, sw] = marco.pts;
    const med = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const anchoCero = dist(nw, ne) < 1e-4;
    const altoCero = dist(ne, se) < 1e-4;
    const out = [];
    if (!anchoCero && !altoCero) out.push(["nw", nw], ["ne", ne], ["se", se], ["sw", sw]);
    // n y s estiran en VERTICAL: hace falta que el marco tenga alto
    if (!altoCero) out.push(["n", med(nw, ne)], ["s", med(sw, se)]);
    // e y w estiran en HORIZONTAL: hace falta que tenga ancho
    if (!anchoCero) out.push(["e", med(ne, se)], ["w", med(sw, nw)]);
    return out;
  }

  redrawOverlay() {
    const ov = this.canvas.overlay;
    ov.textContent = "";
    if (this.tool === "page") { this._drawPageFrame(); return; }
    // se quitan de la selección los que ya no existen (los borró otra persona)
    this.sel = this.sel.filter(el => el && el.parent);
    if (!this.sel.length) return;

    const marco = this._marco();
    if (!marco) return;
    const pl = marco.pts.map(p => this.canvas.toLocal(p));

    if (this.sel.length > 1) {
      for (const el of this.sel) {
        const eb = this.canvas.boxOf(el);
        if (!eb) continue;
        const p0 = this.canvas.toLocal({ x: eb.x, y: eb.y });
        const p1 = this.canvas.toLocal({ x: eb.x + eb.w, y: eb.y + eb.h });
        const m = svgEl("rect");
        m.setAttribute("class", "dw-sel-item");
        m.setAttribute("x", Math.min(p0.x, p1.x)); m.setAttribute("y", Math.min(p0.y, p1.y));
        m.setAttribute("width", Math.abs(p1.x - p0.x)); m.setAttribute("height", Math.abs(p1.y - p0.y));
        ov.appendChild(m);
      }
    }

    const frame = svgEl("polygon");
    frame.setAttribute("class", "dw-sel-frame");
    frame.setAttribute("points", pl.map(p => `${fmt(p.x, 2)},${fmt(p.y, 2)}`).join(" "));
    ov.appendChild(frame);

    if (!this.canWrite()) return;

    /* El tirador de giro cuelga del lado de arriba del marco, o sea
       también girado: si no, en una figura de lado quedaría dentro. */
    const arriba = { x: (pl[0].x + pl[1].x) / 2, y: (pl[0].y + pl[1].y) / 2 };
    const centro = { x: (pl[0].x + pl[2].x) / 2, y: (pl[0].y + pl[2].y) / 2 };
    let nx = arriba.x - centro.x, ny = arriba.y - centro.y;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const rp = { x: arriba.x + nx * 22, y: arriba.y + ny * 22 };

    const stem = svgEl("line");
    stem.setAttribute("class", "dw-rot-stem");
    stem.setAttribute("x1", arriba.x); stem.setAttribute("y1", arriba.y);
    stem.setAttribute("x2", rp.x); stem.setAttribute("y2", rp.y);
    ov.appendChild(stem);

    const rot = svgEl("circle");
    rot.setAttribute("class", "dw-handle dw-handle-rot");
    rot.setAttribute("cx", rp.x); rot.setAttribute("cy", rp.y);
    rot.setAttribute("r", 5);
    rot.dataset.handle = "rotate";
    rot.style.cursor = "grab";
    ov.appendChild(rot);

    for (const [name, pt] of this._tiradores(marco)) {
      const p = this.canvas.toLocal(pt);
      const h = svgEl("rect");
      h.setAttribute("class", "dw-handle");
      h.setAttribute("x", p.x - 4); h.setAttribute("y", p.y - 4);
      h.setAttribute("width", 8); h.setAttribute("height", 8);
      h.dataset.handle = name;
      h.style.cursor = CURSORS[name];
      ov.appendChild(h);
    }
  }

  /* ---------- modo recorte de la página ----------
     Tirar de cualquiera de los cuatro bordes (o de las esquinas) mueve
     ese lado del papel, como el recorte de una foto; arrastrar por dentro
     mueve el papel entero bajo el dibujo. El dibujo NO se toca: lo que
     cambia es el viewBox, así que las figuras se quedan donde están y lo
     que entra o sale del papel es lo que se ve al exportar. */

  _drawPageFrame() {
    const d = this.getDrawing();
    if (!d) return;
    const ov = this.canvas.overlay;
    const box = (this.drag && this.drag.mode === "page" && this.drag.box) || d.size();
    const p0 = this.canvas.toLocal({ x: box.x || 0, y: box.y || 0 });
    const p1 = this.canvas.toLocal({ x: (box.x || 0) + box.w, y: (box.y || 0) + box.h });
    const r = { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };

    const marco = svgEl("rect");
    marco.setAttribute("class", "dw-page-frame");
    marco.setAttribute("x", r.x); marco.setAttribute("y", r.y);
    marco.setAttribute("width", r.w); marco.setAttribute("height", r.h);
    ov.appendChild(marco);

    if (!this.canWrite()) return;
    for (const [name, fx, fy] of HANDLES) {
      const h = svgEl("rect");
      h.setAttribute("class", "dw-handle dw-handle-page");
      h.setAttribute("x", r.x + fx * r.w - 5);
      h.setAttribute("y", r.y + fy * r.h - 5);
      h.setAttribute("width", 10); h.setAttribute("height", 10);
      h.dataset.pageHandle = name;
      h.style.cursor = CURSORS[name];
      ov.appendChild(h);
    }
  }

  /* Nueva caja de página al tirar de un tirador. Cada letra del nombre
     mueve su borde y deja quieto el de enfrente. */
  _pageBox(d, p) {
    const b = d.box;
    const h = d.handle;
    const step = this.canvas.snapStep();
    const q = step ? { x: snapValue(p.x, step), y: snapValue(p.y, step) } : p;
    let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    if (h.includes("w")) x0 = Math.min(q.x, x1 - MIN_PAGE);
    if (h.includes("e")) x1 = Math.max(q.x, x0 + MIN_PAGE);
    if (h.includes("n")) y0 = Math.min(q.y, y1 - MIN_PAGE);
    if (h.includes("s")) y1 = Math.max(q.y, y0 + MIN_PAGE);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- el espacio de la capa ----------

     Lo que se dibuja se mide en coordenadas del DOCUMENTO (las que
     devuelve `canvas.toDoc`), pero la figura no nace en el documento:
     nace DENTRO de una capa, y una capa tiene su propio `transform`.
     Las de un archivo importado lo llevan siempre — svgio antepone ahí
     la normalización a milímetros (`scale(0.2646…)` en un SVG en
     píxeles) — y cualquiera puede mover una capa entera.

     Escribir las coordenadas del documento tal cual dentro de esa capa
     es pedir que se vuelvan a transformar: la línea aparecía lejos de
     donde se había trazado y con otro tamaño, que es exactamente lo
     que describía el informe. Aquí se calcula la vuelta atrás.

     Devuelve null cuando no hay nada que corregir (una capa recién
     creada no tiene transform), y así el caso normal no paga nada. */
  _espacioDeCapa(capa) {
    if (!capa) return null;
    const m = this.canvas.selfMatrix(capa);
    if (!m || casiIdentidad(m)) return null;
    const inv = matInvert(m);
    if (!inv) return null;                  // capa degenerada (escala 0)
    return {
      inv,
      escala: Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1,
      /* Sin giro ni sesgo, los puntos se pueden llevar a los ejes de la
         capa y la figura queda limpia (un <rect> sigue siendo un <rect>
         derecho). Con giro no: un rectángulo derecho del documento no
         es un rectángulo derecho ahí dentro, así que se deja en
         coordenadas del documento y se le cuelga la matriz inversa. */
      mapear: !girada(m),
      tr: matToString(inv)
    };
  }

  /* ---------- transformaciones ----------
     Una transformación pensada en coordenadas del documento se lleva al
     espacio del padre del elemento: M' = P⁻¹ · T · P · M.

     Tanto `m0` (el transform que la figura tenía al empezar) como `pi0`
     (la inversa de la matriz de su padre) se capturan UNA vez, al pulsar,
     y no se vuelven a leer del DOM. Leerlos en cada movimiento del ratón
     era el fallo que hacía que las figuras salieran disparadas mientras
     se arrastraban: la vista previa se componía encima de la vista
     previa anterior, así que el gesto se aplicaba otra vez en cada
     mousemove (T·T·T…) y solo al soltar volvía a su sitio, porque el
     commit sí partía del original. */
  _matrixFor(item, T) {
    /* En «modo local» —una sola figura girada, escalándose— la
       transformación viene expresada en los ejes de la propia figura, así
       que se compone por la DERECHA: A' = A · T. Es lo que evita que un
       rectángulo girado se convierta en un romboide al estirarlo. */
    if (this.drag && this.drag.local) return matToString(matMul(item.m0, T));
    const M = item.pi0
      ? matMul(matMul(item.pi0, matMul(T, item.p0)), item.m0)
      : matMul(T, item.m0);
    return matToString(M);
  }

  /* Vista previa: se escribe en el DOM del espejo, no en el documento. */
  _preview(T) {
    for (const item of this.drag.items) {
      const s = this._matrixFor(item, T);
      if (s) item.dom.setAttribute("transform", s);
      else item.dom.removeAttribute("transform");
    }
  }

  /* Al soltar se escribe en Yjs de una vez, con la misma cuenta que la
     vista previa: lo que se guarda es exactamente lo que se veía. */
  _commit(T) {
    const d = this.getDrawing();
    if (!d) return;
    d.edit(() => {
      for (const item of this.drag.items) {
        const s = this._matrixFor(item, T);
        if (s) item.el.setAttribute("transform", s);
        else item.el.removeAttribute("transform");
      }
    });
  }

  _startTransform(mode, e, handle) {
    const items = this.sel.map(el => {
      const dom = this.canvas.yToDom.get(el);
      if (!dom) return null;
      const p0 = this.canvas.parentMatrix(el);
      const pi0 = p0 ? matInvert(p0) : null;
      if (p0 && !pi0) return null;          // padre degenerado (escala 0)
      return { el, dom, p0, pi0, m0: parseTransform(dom.getAttribute("transform")) };
    }).filter(Boolean);
    if (!items.length) return;
    const marco = this._marco();
    if (!marco) return;
    const local = mode === "scale" && marco.local;
    this.drag = {
      mode, handle, items,
      box: boxOfPoints(marco.pts),          // en coordenadas del documento
      local,
      boxL: local ? marco.box : null,       // en los ejes de la figura
      mInv: local ? matInvert(marco.m) : null,
      start: this.canvas.toDoc(e.clientX, e.clientY),
      startClient: { x: e.clientX, y: e.clientY },
      moved: false
    };
    if (local && !this.drag.mInv) { this.drag.local = false; this.drag.boxL = null; }
    this.canvas.view.setPointerCapture(e.pointerId);
  }

  /* ¿Se ha movido el ratón lo bastante como para que esto sea un arrastre
     y no un clic? Ver DRAG_PX. */
  _esArrastre(e) {
    const d = this.drag;
    if (!d || !d.startClient) return true;
    if (d.moved) return true;               // una vez arrancado, ya no se para
    return Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) >= DRAG_PX;
  }

  /* ---------- puntero ---------- */

  /* El doble clic se mide aquí en vez de escuchar «dblclick»: el
     pointerdown de la selección llama a preventDefault(), y eso puede
     dejar sin disparar los eventos de ratón derivados —entre ellos
     dblclick— según el navegador. Con el sello de tiempo no hay duda. */
  _isDoubleClick(e) {
    const t = e.timeStamp || Date.now();
    const prev = this._lastClick;
    const doble = !!prev && t - prev.t < 400 &&
      Math.abs(e.clientX - prev.x) < 5 && Math.abs(e.clientY - prev.y) < 5;
    this._lastClick = doble ? null : { t, x: e.clientX, y: e.clientY };
    return doble;
  }

  /* Escribir un rótulo abre el editor SIN crear todavía el <text>: el
     elemento nace al cerrar, y solo si se ha escrito algo. Antes se creaba
     al pinchar, así que arrepentirse dejaba un <text> vacío —invisible y
     sin caja, o sea imposible de volver a pinchar— al que un solo Ctrl+Z
     devolvía la vida. */
  _createText(p) {
    const d = this.getDrawing();
    if (!d) return;
    const step = this.canvas.snapStep();
    const pt = step ? { x: snapValue(p.x, step), y: snapValue(p.y, step) } : p;
    const capa = this.getLayer();
    const esp = this._espacioDeCapa(capa);
    const style = Object.assign({}, this.textStyle);
    const cuerpo = parseFloat(style["font-size"]) || DEFAULT_SIZE;
    // mismo problema que con las figuras: el rótulo nace dentro de la capa
    let punto = pt, tr = null;
    if (esp) {
      if (esp.mapear) {
        punto = matApply(esp.inv, pt);
        // NÚMERO, no texto: addText se lo pasa a fmt(), que llama a
        // toFixed y revienta con una cadena
        style["font-size"] = Math.round((cuerpo / esp.escala) * 1e5) / 1e5;
      } else tr = esp.tr;
    }
    this.setTool("select");
    this.onEditText(null, {
      pt: punto, style, layer: capa, transform: tr,
      /* La caja de escribir flota sobre el LIENZO, así que se coloca con
         las coordenadas del documento y el cuerpo de letra de verdad, no
         con los ya traducidos al espacio de la capa. */
      vista: { pt, fs: cuerpo }
    });
  }

  /* Antes de nada, si el foco está en un campo de los paneles se le
     quita. Parece un detalle y era EL fallo de «editar un texto ya
     puesto no hace nada»: los campos de número (Cuerpo, Grosor…)
     confirman con `change`, o sea al salir del campo, y el pointerdown
     del lienzo llama a preventDefault(), que impide justamente eso. Así
     que se escribía «12» en Cuerpo, se pinchaba en el dibujo para
     verlo… y el campo ni confirmaba (seguía teniendo el foco) ni servía
     ya de nada (la selección se acababa de vaciar): el rótulo se
     quedaba igual y el panel parecía roto.

     Soltar el foco aquí dispara su `change` MIENTRAS la selección sigue
     puesta, y de propina devuelve el teclado al lienzo: con el cursor
     dentro de un <input>, la S, la R o la L no llegaban a Tools. */
  _soltarFoco() {
    const a = document.activeElement;
    if (!a || a === document.body) return;
    const t = a.tagName;
    if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") a.blur();
  }

  _pointerDown(e) {
    this._soltarFoco();
    if (e.button === 1 || this._spaceDown || (e.button === 0 && this.tool === "pan")) {
      this.drag = { mode: "pan", lastX: e.clientX, lastY: e.clientY };
      this.canvas.view.setPointerCapture(e.pointerId);
      this.canvas.view.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    /* ---- modo recorte: los tiradores del papel mandan sobre todo ---- */
    if (this.tool === "page") {
      if (!this.canWrite()) return;
      const d = this.getDrawing();
      if (!d) return;
      e.preventDefault();
      const ph = e.target && e.target.dataset ? e.target.dataset.pageHandle : null;
      const box = d.size();
      const b0 = { x: box.x || 0, y: box.y || 0, w: box.w, h: box.h };
      const p = this.canvas.toDoc(e.clientX, e.clientY);
      const dentro = p.x >= b0.x && p.x <= b0.x + b0.w && p.y >= b0.y && p.y <= b0.y + b0.h;
      /* Pinchar FUERA del papel sale del recorte, como se sale de un
         recorte en cualquier visor de fotos. Antes el clic no hacía
         nada y para volver a la flecha había que ir al rail a buscarla,
         que es justo lo que pedía la sugerencia. */
      if (!ph && !dentro) { this.setTool("select"); this.onStatus(""); return; }
      this.drag = {
        mode: "page", handle: ph || "move", box: b0, box0: b0,
        start: p, startClient: { x: e.clientX, y: e.clientY }, moved: false
      };
      this.canvas.view.setPointerCapture(e.pointerId);
      return;
    }

    const handle = e.target && e.target.dataset ? e.target.dataset.handle : null;
    if (handle && this.canWrite()) {
      e.preventDefault();
      this._startTransform(handle === "rotate" ? "rotate" : "scale", e, handle);
      return;
    }

    if (this.tool === "text") {
      if (!this.canWrite()) return;
      e.preventDefault();
      this._createText(this.canvas.toDoc(e.clientX, e.clientY));
      return;
    }

    /* La fórmula, igual que el rótulo, no se crea al pulsar: se abre su
       cuadro y solo nace si se acepta con algo escrito. */
    if (this.tool === "formula") {
      if (!this.canWrite()) return;
      e.preventDefault();
      const p = this.canvas.toDoc(e.clientX, e.clientY);
      const step = this.canvas.snapStep();
      this.setTool("select");
      this.onEditFormula(null, { pt: step ? { x: snapValue(p.x, step), y: snapValue(p.y, step) } : p });
      return;
    }

    if (this.tool !== "select") {
      if (!this.canWrite()) return;
      e.preventDefault();
      const p = this.canvas.toDoc(e.clientX, e.clientY);
      const step = this.canvas.snapStep();
      this.drag = {
        mode: "create", tool: this.tool,
        start: step ? { x: snapValue(p.x, step), y: snapValue(p.y, step) } : p,
        moved: false
      };
      this.canvas.view.setPointerCapture(e.pointerId);
      return;
    }

    /* Selección al estilo de Inkscape:
         - clic normal   → la figura de más afuera (el grupo entero)
         - Ctrl+clic     → la figura concreta que hay bajo el puntero,
                           esté dentro de los grupos que esté
         - Alt+clic      → igual, y repetido va bajando por el montón de
                           figuras superpuestas
         - doble clic    → entra en el grupo (y en un texto, lo edita) */
    const profundo = e.ctrlKey || e.metaKey || e.altKey;
    const doble = this._isDoubleClick(e);
    let hit = profundo || doble
      ? this.canvas.hitTest(e.clientX, e.clientY, { deep: true })
      : this.canvas.hitTest(e.clientX, e.clientY);

    /* El navegador solo da por tocado un trazo si el puntero cae DENTRO de
       él, y un trazo de 0,4 mm mide menos de dos píxeles en pantalla: una
       línea recién dibujada era prácticamente imposible de volver a
       pinchar. Si no se ha acertado nada, se busca lo que pase cerca. */
    if (!hit) hit = this.canvas.hitNear(e.clientX, e.clientY, { deep: profundo || doble });

    if (e.altKey && hit) {
      const pila = this.canvas.hitStack(e.clientX, e.clientY);
      const i = pila.indexOf(hit);
      // ya estaba elegida: se pasa a la de debajo, y del final al principio
      if (i >= 0 && this.sel.includes(hit) && pila.length > 1)
        hit = pila[(i + 1) % pila.length];
    }

    /* Una capa bloqueada no se selecciona ni se arrastra; si no, el
       candado del panel no serviría de nada. (Las ocultas ni siquiera
       llegan aquí: `display:none` las saca del sorteo del puntero.) */
    if (hit) {
      const d = this.getDrawing();
      const preso = d && d.lockedAncestor(hit);
      if (preso) {
        this.onStatus(`«${d.labelOf(preso)}» está bloqueado.`);
        hit = null;
      }
    }
    const additive = e.shiftKey;
    if (hit) {
      if (doble && this.canWrite() && (isText(hit) || esFormula(hit))) {
        e.preventDefault();
        this.select(hit);
        if (esFormula(hit)) this.onEditFormula(hit); else this.onEditText(hit);
        return;
      }
      if (additive) this.select(hit, { add: true });
      else if (doble || profundo || !this.sel.includes(hit)) this.select(hit);
      if (this.canWrite() && this.sel.length) {
        e.preventDefault();
        this._startTransform("move", e);
      }
      return;
    }
    if (!additive) this.clear();
    const p = this.canvas.toDoc(e.clientX, e.clientY);
    this.drag = { mode: "marquee", start: p, additive, base: this.sel.slice(), moved: false };
    this.canvas.view.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  _pointerMove(e) {
    const d = this.drag;
    if (!d) return;

    if (d.mode === "pan") {
      this.canvas.panBy(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX; d.lastY = e.clientY;
      this.redrawOverlay();
      return;
    }

    const p = this.canvas.toDoc(e.clientX, e.clientY);
    const step = this.canvas.snapStep();

    if (d.mode === "page") {
      d.box = d.handle === "move"
        ? this._pageMoved(d, p, step)
        : this._pageBox(d, p);
      d.moved = this._esArrastre(e);
      this.canvas.previewPage(d.box);
      this.redrawOverlay();
      this.onStatus(`${fmt(d.box.w, 1)} × ${fmt(d.box.h, 1)} mm`);
      return;
    }

    if (d.mode === "move") {
      /* Hasta que el gesto no es un arrastre de verdad no se toca nada:
         ni vista previa, ni imán, ni `moved`. Es lo que hace que pinchar
         para seleccionar sea solo eso. */
      if (!this._esArrastre(e)) return;
      let dx = p.x - d.start.x, dy = p.y - d.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (step) {
        const s = snapBoxDelta({ x: d.box.x + dx, y: d.box.y + dy, w: d.box.w, h: d.box.h }, step);
        dx += s.dx; dy += s.dy;
      }
      d.moved = true;
      d.T = translate(dx, dy);
      this._preview(d.T);
      this.redrawOverlay();
      return;
    }

    if (d.mode === "scale") {
      if (!this._esArrastre(e)) return;
      d.T = this._scaleMatrix(d, p, e.shiftKey, step);
      d.moved = true;
      this._preview(d.T);
      this.redrawOverlay();
      return;
    }

    if (d.mode === "rotate") {
      if (!this._esArrastre(e)) return;
      const c = { x: d.box.x + d.box.w / 2, y: d.box.y + d.box.h / 2 };
      let ang = angleOf(c, p) - angleOf(c, d.start);
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      d.T = rotateM(ang, c.x, c.y);
      d.moved = true;
      this.onStatus(`${fmt(((ang % 360) + 360) % 360, 1)}°`);
      this._preview(d.T);
      this.redrawOverlay();
      return;
    }

    if (d.mode === "marquee") {
      d.box = boxFromDrag(d.start, p);
      d.moved = d.box.w > MIN_SIZE || d.box.h > MIN_SIZE;
      this._drawMarquee(d.box);
      return;
    }

    if (d.mode === "create") {
      const end = step ? { x: snapValue(p.x, step), y: snapValue(p.y, step) } : p;
      d.end = end;
      /* Las esquinas efectivas se guardan en el arrastre: lo que se cree
         al soltar tiene que ser EXACTAMENTE lo que se estaba viendo, y
         con las teclas de por medio ya no coincide con start/end. */
      const g = this._geoCrear(d, end, e);
      d.a = g.a; d.b = g.b;
      d.moved = dist(d.start, end) > MIN_SIZE;
      this._drawCreatePreview(d);
      if (d.tool === "line") {
        const ang = ((angleOf(g.a, g.b) % 360) + 360) % 360;
        this.onStatus(`${fmt(dist(g.a, g.b), 1)} mm · ${fmt(ang, 1)}°`);
      } else {
        const b = boxFromDrag(g.a, g.b);
        this.onStatus(`${fmt(b.w, 1)} × ${fmt(b.h, 1)} mm`);
      }
    }
  }

  /* Esquinas de lo que se está dibujando, ya con las teclas aplicadas:

       Mayús → cuadrado y círculo; en la línea, ángulos de 15°
       Alt    → desde el CENTRO en vez de desde una esquina

     Son las dos que tiene cualquier programa de dibujo y aquí no
     estaban: un círculo había que sacarlo a ojo mirando la medida de la
     barra de estado. */
  _geoCrear(d, p, e) {
    const c = d.start;
    if (d.tool === "line") {
      let b = p;
      if (e.shiftKey) {
        const r = dist(c, b);
        const rad = (Math.round(angleOf(c, b) / 15) * 15) * Math.PI / 180;
        b = { x: c.x + r * Math.sin(rad), y: c.y - r * Math.cos(rad) };
      }
      // desde el centro: el punto de partida pasa a ser el punto medio
      return e.altKey ? { a: { x: 2 * c.x - b.x, y: 2 * c.y - b.y }, b } : { a: c, b };
    }
    let dx = p.x - c.x, dy = p.y - c.y;
    if (e.shiftKey) {
      const s = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * s;
      dy = (dy < 0 ? -1 : 1) * s;
    }
    return e.altKey
      ? { a: { x: c.x - dx, y: c.y - dy }, b: { x: c.x + dx, y: c.y + dy } }
      : { a: c, b: { x: c.x + dx, y: c.y + dy } };
  }

  _pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    try { this.canvas.view.releasePointerCapture(e.pointerId); } catch (err) {}

    if (d.mode === "pan") {
      this.canvas.view.style.cursor = this.tool === "select" ? "default" : "crosshair";
      return;
    }
    if (d.mode === "page") {
      this.canvas.previewPage(null);
      this.onStatus("");
      const dw = this.getDrawing();
      if (d.moved && dw && d.box) dw.setBox(d.box.x, d.box.y, d.box.w, d.box.h);
      this.canvas.refreshPage();
      this.redrawOverlay();
      return;
    }
    if (d.mode === "marquee") {
      this.canvas.overlay.querySelectorAll(".dw-marquee").forEach(n => n.remove());
      if (d.moved) {
        const found = this.canvas.elementsIn(d.box);
        this.select(d.additive ? d.base.concat(found.filter(x => !d.base.includes(x))) : found);
      }
      return;
    }
    if (d.mode === "create") {
      this.canvas.overlay.querySelectorAll(".dw-preview,.dw-preview-guia").forEach(n => n.remove());
      this.onStatus("");
      if (d.moved && d.b) this._createShape(d.tool, d.a, d.b);
      return;
    }
    if (d.T && d.moved) {
      this.drag = d;              // _commit lee this.drag.items
      this._commit(d.T);
      this.drag = null;
      this.onStatus("");
      this.redrawOverlay();
    }
  }

  /* Desplazamiento del papel entero al arrastrarlo por dentro. */
  _pageMoved(d, p, step) {
    let dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (step) {
      dx = snapValue(d.box0.x + dx, step) - d.box0.x;
      dy = snapValue(d.box0.y + dy, step) - d.box0.y;
    }
    return { x: d.box0.x + dx, y: d.box0.y + dy, w: d.box0.w, h: d.box0.h };
  }

  _scaleMatrix(d, p, keepRatio, step) {
    /* Con la figura girada se trabaja en SUS ejes: el puntero se lleva a
       su espacio y la caja es la suya. El imán se queda fuera aquí a
       propósito — la rejilla está en milímetros del documento y ajustar a
       ella una coordenada girada daría saltos sin sentido. */
    const local = !!d.local;
    const b = local ? d.boxL : d.box;
    if (local) { p = matApply(d.mInv, p); step = 0; }
    const h = d.handle;
    const left = h.includes("w"), right = h.includes("e");
    const top = h.includes("n"), bottom = h.includes("s");

    // punto fijo: la esquina o el borde de enfrente
    const fx = left ? b.x + b.w : right ? b.x : b.x + b.w / 2;
    const fy = top ? b.y + b.h : bottom ? b.y : b.y + b.h / 2;

    let px = p.x, py = p.y;
    if (step) { px = snapValue(px, step); py = snapValue(py, step); }

    let sx = 1, sy = 1;
    if ((left || right) && b.w > 1e-6) sx = (px - fx) / ((left ? b.x : b.x + b.w) - fx);
    if ((top || bottom) && b.h > 1e-6) sy = (py - fy) / ((top ? b.y : b.y + b.h) - fy);

    if (keepRatio) {
      if (left || right) { if (top || bottom) { const s = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * s; sy = Math.sign(sy || 1) * s; } else sy = sx; }
      else if (top || bottom) sx = sy;
    }
    // no dejar que colapse a cero: un factor 0 es una matriz sin vuelta atrás
    const guard = v => (Math.abs(v) < 1e-3 ? (v < 0 ? -1e-3 : 1e-3) : v);
    return scaleAbout(guard(sx), guard(sy), fx, fy);
  }

  _drawMarquee(box) {
    const ov = this.canvas.overlay;
    ov.querySelectorAll(".dw-marquee").forEach(n => n.remove());
    const a = this.canvas.toLocal({ x: box.x, y: box.y });
    const b = this.canvas.toLocal({ x: box.x + box.w, y: box.y + box.h });
    const r = svgEl("rect");
    r.setAttribute("class", "dw-marquee");
    r.setAttribute("x", Math.min(a.x, b.x)); r.setAttribute("y", Math.min(a.y, b.y));
    r.setAttribute("width", Math.abs(b.x - a.x)); r.setAttribute("height", Math.abs(b.y - a.y));
    ov.appendChild(r);
  }

  /* Vista previa de lo que se está dibujando, CON SU ASPECTO REAL:
     relleno, color, grosor, guiones y extremos. Un contorno morado a
     rayas igual para las tres herramientas no decía lo que iba a salir
     —ni si la figura llevaba relleno—, y la sorpresa llegaba al soltar.

     Va en la capa de tiradores, que está en píxeles de pantalla y no
     escala con el zoom: por eso el grosor y los guiones se multiplican
     por `canvas.k` a mano. El estilo se escribe INLINE porque una clase
     de CSS gana siempre a un atributo de presentación. */
  _drawCreatePreview(d) {
    const ov = this.canvas.overlay;
    ov.querySelectorAll(".dw-preview,.dw-preview-guia").forEach(n => n.remove());
    const a = this.canvas.toLocal(d.a || d.start);
    const b = this.canvas.toLocal(d.b || d.end);
    const k = this.canvas.k || 1;
    const st = this.style;
    const caja = {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
    };

    let node;
    if (d.tool === "line") {
      node = svgEl("line");
      node.setAttribute("x1", a.x); node.setAttribute("y1", a.y);
      node.setAttribute("x2", b.x); node.setAttribute("y2", b.y);
    } else if (d.tool === "ellipse") {
      node = svgEl("ellipse");
      node.setAttribute("cx", (a.x + b.x) / 2); node.setAttribute("cy", (a.y + b.y) / 2);
      node.setAttribute("rx", caja.w / 2); node.setAttribute("ry", caja.h / 2);
      /* Con la elipse sí ayuda el rectángulo de guía: al dibujarla se
         está apuntando a dos esquinas que la propia elipse no toca. */
      const guia = svgEl("rect");
      guia.setAttribute("class", "dw-preview-guia");
      guia.setAttribute("x", caja.x); guia.setAttribute("y", caja.y);
      guia.setAttribute("width", caja.w); guia.setAttribute("height", caja.h);
      ov.appendChild(guia);
    } else {
      node = svgEl("rect");
      node.setAttribute("x", caja.x); node.setAttribute("y", caja.y);
      node.setAttribute("width", caja.w); node.setAttribute("height", caja.h);
      const r = parseFloat(this.crear.rx) || 0;
      if (r > 0) node.setAttribute("rx", Math.min(r * k, Math.min(caja.w, caja.h) / 2));
    }

    const grosor = Math.max(1, (parseFloat(st["stroke-width"]) || 0) * k);
    node.setAttribute("class", "dw-preview");
    node.style.fill = d.tool === "line" ? "none" : (st.fill || "none");
    node.style.stroke = st.stroke || "none";
    node.style.strokeWidth = String(grosor);
    node.style.strokeLinecap = st["stroke-linecap"] || DEFAULT_CAP;
    node.style.strokeLinejoin = st["stroke-linejoin"] || DEFAULT_JOIN;
    node.style.strokeDasharray = st["stroke-dasharray"]
      ? String(st["stroke-dasharray"]).split(/[\s,]+/).filter(Boolean).map(v => (parseFloat(v) || 0) * k).join(" ")
      : "none";
    node.style.opacity = "0.85";
    ov.appendChild(node);
  }

  _createShape(tool, p0, p1) {
    const d = this.getDrawing();
    if (!d) return;
    const capa = this.getLayer();
    const esp = this._espacioDeCapa(capa);
    const aCapa = p => (esp && esp.mapear ? matApply(esp.inv, p) : p);
    const q0 = aCapa(p0), q1 = aCapa(p1);
    const b = boxFromDrag(q0, q1);
    const st = this.style;

    /* El grosor vive en el mismo espacio que las coordenadas: en una
       capa escalada ×4, un atributo de 0,4 mm se ve de 1,6. Cuando la
       figura lleva la matriz inversa colgada (capa girada) la escala se
       cancela sola y no hay que tocar nada. */
    const kEsc = esp && esp.mapear ? esp.escala : 1;
    const largo = v => fmt((parseFloat(v) || 0) / kEsc, 5);
    // los guiones son longitudes como cualquier otra: en una capa
    // escalada, un «3,2» sin traducir sale de otro tamaño que en el panel
    const guiones = v => (!v ? null : String(v).split(/[\s,]+/).filter(Boolean).map(largo).join(","));

    const common = {
      fill: tool === "line" ? "none" : st.fill,
      stroke: st.stroke,
      "stroke-width": largo(st["stroke-width"]),
      "stroke-dasharray": guiones(st["stroke-dasharray"]),
      "stroke-linecap": capAttr(st["stroke-linecap"]),
      "stroke-linejoin": joinAttr(st["stroke-linejoin"]),
      transform: esp && !esp.mapear ? esp.tr : null
    };

    let el = null;
    if (tool === "rect") {
      // el redondeo de esquina se pide en mm de papel, como todo lo demás
      const r = parseFloat(this.crear.rx) || 0;
      el = d.add(capa, "rect", Object.assign({
        x: fmt(b.x), y: fmt(b.y), width: fmt(b.w), height: fmt(b.h),
        rx: r > 0 ? largo(Math.min(r, Math.min(b.w, b.h) * kEsc / 2)) : null
      }, common));
    } else if (tool === "ellipse") {
      el = d.add(capa, "ellipse", Object.assign({
        cx: fmt(b.x + b.w / 2), cy: fmt(b.y + b.h / 2), rx: fmt(b.w / 2), ry: fmt(b.h / 2)
      }, common));
    } else if (tool === "line") {
      el = d.add(capa, "line", Object.assign({
        x1: fmt(q0.x), y1: fmt(q0.y), x2: fmt(q1.x), y2: fmt(q1.y)
      }, common, { fill: null, "stroke-linejoin": null }));
    }
    if (el) {
      this.select(el);
      // con «seguir dibujando» la herramienta se queda en la mano, como
      // en Inkscape; sin ello se vuelve a la flecha, que era lo de antes
      if (!this.crear.mantener) this.setTool("select");
    }
  }

  _wheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // el pellizco del panel táctil llega justo así
      const factor = Math.pow(0.995, e.deltaY);
      this.canvas.zoomBy(factor, { x: e.clientX, y: e.clientY });
    } else if (e.shiftKey) {
      this.canvas.panBy(-e.deltaY - e.deltaX, 0);
    } else {
      this.canvas.panBy(-e.deltaX, -e.deltaY);
    }
    this.redrawOverlay();
  }

  /* ---------- acciones ---------- */

  deleteSelection() {
    const d = this.getDrawing();
    if (!d || !this.sel.length || !this.canWrite()) return;
    d.remove(this.sel);
    this.clear();
  }

  duplicateSelection() {
    const d = this.getDrawing();
    if (!d || !this.sel.length || !this.canWrite()) return;
    const copies = d.duplicate(this.sel);
    if (copies && copies.length) this.select(copies);
  }

  reorder(mode) {
    const d = this.getDrawing();
    if (!d || !this.sel.length || !this.canWrite()) return;
    const done = d.reorder(this.sel, mode);
    if (done && done.length) this.select(done);
  }

  group() {
    const d = this.getDrawing();
    if (!d || this.sel.length < 2 || !this.canWrite()) return;
    const g = d.group(this.sel);
    if (g) this.select(g);
    else this.onStatus("Solo se pueden agrupar figuras de la misma capa.");
  }

  ungroup() {
    const d = this.getDrawing();
    if (!d || !this.sel.length || !this.canWrite()) return;
    /* Una fórmula también es un <g>, pero desagruparla la convertiría en
       un montón de trazos sueltos y se llevaría por delante su LaTeX:
       dejaría de poder corregirse para siempre. */
    const grupos = this.sel.filter(e => e.nodeName === "g" && !esFormula(e));
    if (!grupos.length && this.sel.some(esFormula)) {
      this.onStatus("Una fórmula no se desagrupa: ábrela con doble clic para corregirla.");
      return;
    }
    const freed = d.ungroup(grupos);
    if (freed && freed.length) this.select(freed);
  }

  nudge(dx, dy) {
    const d = this.getDrawing();
    if (!d || !this.sel.length || !this.canWrite()) return;
    this.drag = {
      items: this.sel.map(el => {
        const dom = this.canvas.yToDom.get(el);
        return dom ? { el, dom, m0: parseTransform(dom.getAttribute("transform")) } : null;
      }).filter(Boolean)
    };
    this._commit(translate(dx, dy));
    this.drag = null;
    this.redrawOverlay();
  }

  /* Opciones de dibujo que no son atributos del SVG (ver this.crear). */
  setCrear(opts) { Object.assign(this.crear, opts || {}); }

  applyStyle(attrs) {
    const d = this.getDrawing();
    /* Los valores quedan de memoria para la próxima figura. Los de
       tipografía —y el color, cuando lo que hay elegido es un texto— van
       al estilo del texto; el resto, al de las figuras. */
    const hayTexto = this.sel.some(isText);
    for (const [k, v] of Object.entries(attrs)) {
      if (TEXT_ATTRS.has(k) || (k === "fill" && hayTexto)) this.textStyle[k] = v;
      else this.style[k] = v;
    }
    if (!d || !this.sel.length || !this.canWrite()) return;
    d.setAttrs(this.sel, attrs);
    this.redrawOverlay();
    // el panel enseña los valores de la selección: hay que repintarlo
    this.onSelectionChange(this.selection());
  }

  /* ---------- teclado ---------- */

  _keyDown(e) {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.code === "Space") { this._spaceDown = true; return; }

    const d = this.getDrawing();
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (d) { if (e.shiftKey) d.redo(); else d.undo(); this.redrawOverlay(); }
      return;
    }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (d) { d.redo(); this.redrawOverlay(); } return; }
    if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); this.selectAll(); return; }
    if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); this.duplicateSelection(); return; }
    if (mod && e.key.toLowerCase() === "g") {
      e.preventDefault();
      if (e.shiftKey) this.ungroup(); else this.group();
      return;
    }

    // con un texto (o una fórmula) elegido, Intro o F2 entra a escribirlo
    if ((e.key === "Enter" || e.key === "F2") && this.sel.length === 1 && this.canWrite() &&
        (isText(this.sel[0]) || esFormula(this.sel[0]))) {
      e.preventDefault();
      if (esFormula(this.sel[0])) this.onEditFormula(this.sel[0]);
      else this.onEditText(this.sel[0]);
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); this.deleteSelection(); return; }
    if (e.key === "Escape") { this.clear(); this.setTool("select"); return; }
    if (e.key === "PageUp") { e.preventDefault(); this.reorder(e.shiftKey ? "top" : "raise"); return; }
    if (e.key === "PageDown") { e.preventDefault(); this.reorder(e.shiftKey ? "bottom" : "lower"); return; }

    if (e.key.startsWith("Arrow")) {
      if (!this.sel.length) return;
      e.preventDefault();
      const step = e.shiftKey ? (this.canvas.grid.step || 5) : (mod ? 0.1 : 1);
      const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
      this.nudge(dx, dy);
      return;
    }

    // atajos de herramienta, como en Inkscape
    if (!mod && !e.altKey) {
      const map = { s: "select", r: "rect", e: "ellipse", l: "line", t: "text", f: "formula", p: "page" };
      const name = map[e.key.toLowerCase()];
      if (name) { this.setTool(name); return; }
      if (e.key === "3") { this.canvas.fitPage(); this.redrawOverlay(); }
    }
  }
}
