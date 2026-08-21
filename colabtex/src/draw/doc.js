"use strict";
/* ============================================================
   ColabDraw — el documento

   Un proyecto contiene varios dibujos. Cada dibujo es un
   Y.XmlFragment guardado en el Y.Map "drawings" (ruta → fragmento),
   y dentro del fragmento hay UN elemento <svg> que es el archivo tal
   cual: tamaño, <defs> y capas. Es decir, el árbol SVG *es* la
   estructura colaborativa; mover una figura o cambiar un color son
   operaciones CRDT y no un reemplazo de texto.

   Unidad de trabajo: el MILÍMETRO. El <svg> se declara
   width="160mm" height="120mm" viewBox="0 0 160 120", así que una
   unidad de usuario es un milímetro y lo que se dibuja mide en el
   papel exactamente lo que dice el panel. Para figuras de artículo es
   lo único que evita sorpresas al exportar.

   OJO con Yjs: un tipo ya integrado NO se puede reinsertar en otro
   sitio. Cambiar el orden Z, agrupar o mover entre capas obliga a
   CLONAR y borrar el original — por eso cada elemento lleva un `id`
   estable, que es lo que permite recuperar la selección después.
   ============================================================ */
import * as Y from "yjs";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const XLINK_NS = "http://www.w3.org/1999/xlink";

/* origen de las transacciones locales: lo usa el gestor de deshacer
   para no tragarse los cambios que llegan de otras personas */
export const LOCAL = "colabdraw-local";

export const DEFAULT_W = 160;   // mm
export const DEFAULT_H = 120;

/* Elementos que dibujan algo (los que se pueden seleccionar). */
export const SHAPE_TAGS = new Set([
  "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "path", "text", "image", "g", "use"
]);

/* Redondeo corto para el viewBox: sin esto un recorte deja
   «viewBox="12.000000000000002 …"» y el archivo se llena de ruido. */
const fmtNum = n => {
  const s = (Math.round(n * 10000) / 10000).toString();
  return s === "-0" ? "0" : s;
};

/* ---------- estilo ----------

   Un `style="fill:red"` gana SIEMPRE al atributo `fill`: es la cascada de
   CSS, no un capricho. Casi todo lo que llega de Inkscape o de matplotlib
   trae el color ahí, así que escribir el atributo y quedarse tan a gusto
   no repintaba nada — el fallo de «algunos objetos no se recolorean». */
export function dropStyleProp(el, prop) {
  const st = el.getAttribute("style");
  if (!st || st.toLowerCase().indexOf(prop.toLowerCase()) < 0) return;
  const re = new RegExp(`(?:^|;)\\s*${prop.replace(/[-]/g, "\\-")}\\s*:[^;]*`, "gi");
  const next = st.replace(re, ";").replace(/;{2,}/g, ";").replace(/^;+|;+$/g, "").trim();
  if (next) el.setAttribute("style", next); else el.removeAttribute("style");
}

/* Propiedades que un grupo pasa a sus hijos por herencia CSS. Al pintar
   un <g> hay que quitárselas a los descendientes que traigan la suya, o
   el color del grupo no se ve por ninguna parte; y al DESAGRUPAR hay que
   copiárselas a los hijos, o pierden el aspecto que tenían. */
export const HEREDABLES = new Set([
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray",
  "stroke-linecap", "stroke-linejoin", "stroke-opacity",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor"
]);

let idCounter = 0;
export function newId(prefix = "e") {
  const rnd = Math.random().toString(36).slice(2, 8);
  // el contador evita colisiones dentro de la misma milésima de segundo
  return `${prefix}${rnd}${(idCounter++ % 1296).toString(36)}`;
}

/* ---------- utilidades sobre Y.XmlElement ---------- */

export const isEl = n => n instanceof Y.XmlElement;
export const tagOf = n => (isEl(n) ? n.nodeName : null);

export const childrenOf = n => (n && n.toArray ? n.toArray() : []);

export const elChildren = n => childrenOf(n).filter(isEl);

/* Copia profunda de un elemento. Imprescindible: Yjs no deja mover un
   tipo ya integrado, así que "mover" siempre es clonar y borrar.

   Con `freshIds` se renuevan los identificadores al vuelo. Tiene que
   ser AQUÍ, mientras se leen los atributos del original (que sí está
   integrado): recorrer el clon después para cambiarlos no funciona,
   porque un elemento todavía sin integrar no devuelve sus atributos. */
export function cloneEl(el, freshIds = false) {
  if (el instanceof Y.XmlText) {
    const t = new Y.XmlText();
    t.insert(0, el.toString());
    return t;
  }
  const copy = new Y.XmlElement(el.nodeName);
  const attrs = el.getAttributes();
  for (const k of Object.keys(attrs)) {
    if (attrs[k] == null) continue;
    copy.setAttribute(k, k === "id" && freshIds ? newId() : String(attrs[k]));
  }
  const kids = childrenOf(el).map(k => cloneEl(k, freshIds));
  if (kids.length) copy.insert(0, kids);
  return copy;
}

/* Igual que cloneEl pero renovando los id, para duplicar de verdad
   (dos figuras con el mismo id romperían la selección y el SVG). */
export const cloneFresh = el => cloneEl(el, true);

/* Recorre el árbol en profundidad, sin incluir la raíz. */
export function* walk(node) {
  for (const child of childrenOf(node)) {
    if (!isEl(child)) continue;
    yield child;
    yield* walk(child);
  }
}

export function indexOf(parent, el) {
  const kids = childrenOf(parent);
  for (let i = 0; i < kids.length; i++) if (kids[i] === el) return i;
  return -1;
}

/* ---------- crear un dibujo vacío ---------- */

export function makeDrawing({ w = DEFAULT_W, h = DEFAULT_H, layerName = "Capa 1" } = {}) {
  const frag = new Y.XmlFragment();
  const svg = new Y.XmlElement("svg");
  svg.setAttribute("width", `${w}mm`);
  svg.setAttribute("height", `${h}mm`);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const defs = new Y.XmlElement("defs");
  const layer = new Y.XmlElement("g");
  layer.setAttribute("id", newId("capa"));
  layer.setAttribute("data-layer", layerName);

  svg.insert(0, [defs, layer]);
  frag.insert(0, [svg]);
  return frag;
}

/* ============================================================
   Un dibujo abierto
   ============================================================ */
export class Drawing {
  constructor(ydoc, frag, { readOnly = false } = {}) {
    this.ydoc = ydoc;
    this.frag = frag;
    this.readOnly = readOnly;
    /* captureTimeout 0 = un paso de deshacer por acción. Con el valor
       por defecto, dos acciones seguidas (dibujar una figura y pintarla
       acto seguido) se funden en una sola y deshacer se lleva las dos
       por delante. Eso vale para teclear, no para dibujar: aquí cada
       gesto ya viene agrupado en UNA transacción por Drawing.edit(). */
    this.undoMgr = readOnly
      ? null
      : new Y.UndoManager(frag, { trackedOrigins: new Set([LOCAL]), captureTimeout: 0 });
  }

  destroy() {
    if (this.undoMgr) this.undoMgr.destroy();
    this.undoMgr = null;
  }

  /* Todas las escrituras pasan por aquí: una sola transacción con el
     origen local, que es lo que hace que deshacer agrupe bien y que el
     proveedor de Firebase mande un único update. */
  edit(fn) {
    if (this.readOnly) return null;
    let out = null;
    this.ydoc.transact(() => { out = fn(); }, LOCAL);
    return out;
  }

  /* ---------- estructura ---------- */

  root() {
    for (const n of childrenOf(this.frag)) if (tagOf(n) === "svg") return n;
    return null;
  }

  defs() {
    const svg = this.root();
    if (!svg) return null;
    for (const n of childrenOf(svg)) if (tagOf(n) === "defs") return n;
    return this.edit(() => {
      const d = new Y.XmlElement("defs");
      svg.insert(0, [d]);
      return d;
    });
  }

  /* Capas = los <g data-layer> hijos directos del <svg>. Si un SVG
     importado no trae ninguna, el propio <svg> hace de lienzo. */
  layers() {
    const svg = this.root();
    if (!svg) return [];
    return elChildren(svg).filter(n => n.getAttribute("data-layer") != null);
  }

  layerNamed(name) {
    return this.layers().find(l => l.getAttribute("data-layer") === name) || null;
  }

  /* Capa donde va lo que se dibuje ahora. Si no hay ninguna se crea:
     nunca se dibuja suelto dentro del <svg>. */
  activeLayer(preferId) {
    const ls = this.layers();
    if (preferId) {
      const hit = ls.find(l => l.getAttribute("id") === preferId);
      if (hit) return hit;
    }
    if (ls.length) return ls[ls.length - 1];
    const svg = this.root();
    if (!svg) return null;
    return this.edit(() => {
      const g = new Y.XmlElement("g");
      g.setAttribute("id", newId("capa"));
      g.setAttribute("data-layer", "Capa 1");
      svg.insert(childrenOf(svg).length, [g]);
      return g;
    });
  }

  addLayer(name) {
    const svg = this.root();
    if (!svg) return null;
    return this.edit(() => {
      const g = new Y.XmlElement("g");
      g.setAttribute("id", newId("capa"));
      g.setAttribute("data-layer", name || `Capa ${this.layers().length + 1}`);
      svg.insert(childrenOf(svg).length, [g]);
      return g;
    });
  }

  renameLayer(layer, name) {
    const n = String(name || "").trim();
    if (!layer || !n) return;
    this.edit(() => layer.setAttribute("data-layer", n));
  }

  /* Ocultar usa el atributo `display`, no un estilo aparte: así la capa
     sale oculta también en el SVG exportado, como en Inkscape. */
  layerVisible(layer) {
    return !layer || layer.getAttribute("display") !== "none";
  }

  setLayerVisible(layer, on) {
    if (!layer) return;
    this.edit(() => {
      if (on) layer.removeAttribute("display");
      else layer.setAttribute("display", "none");
    });
  }

  layerLocked(layer) {
    return !!layer && layer.getAttribute("data-locked") === "1";
  }

  /* La invisibilidad se hereda igual que el candado: si la capa está
     oculta, lo de dentro tampoco se ve aunque su propio `display` no
     diga nada. Devuelve QUIÉN lo impone, que es lo que el panel de
     objetos necesita para poder decirlo con nombre y apellidos. */
  hiddenAncestor(el) {
    let n = el;
    while (n && typeof n.getAttribute === "function") {
      if (n.getAttribute("display") === "none") return n;
      n = n.parent;
    }
    return null;
  }

  /* El candado se hereda: bloquear un grupo bloquea lo que lleva dentro,
     como en Inkscape. Devuelve el nodo que lo impone, para poder decir
     cuál es. */
  lockedAncestor(el) {
    let n = el;
    while (n && typeof n.getAttribute === "function") {
      if (n.getAttribute("data-locked") === "1") return n;
      n = n.parent;
    }
    return null;
  }

  /* Nombre visible de un elemento en el árbol de objetos. `data-label` es
     donde se guarda el de Inkscape (inkscape:label) al importar; si no
     hay, el id, que es como los nombra también Inkscape. */
  labelOf(el) {
    if (!el || !el.getAttribute) return "";
    return el.getAttribute("data-label") || el.getAttribute("data-layer") ||
      el.getAttribute("id") || el.nodeName || "";
  }

  setLabel(el, name) {
    const n = String(name || "").trim();
    if (!el || !n) return;
    this.edit(() => {
      if (el.getAttribute("data-layer") != null) el.setAttribute("data-layer", n);
      else el.setAttribute("data-label", n);
    });
  }

  setLayerLocked(layer, on) {
    if (!layer) return;
    this.edit(() => {
      if (on) layer.setAttribute("data-locked", "1");
      else layer.removeAttribute("data-locked");
    });
  }

  /* La última capa de la lista es la que se pinta encima, así que subir
     una capa en el panel es moverla hacia el final del <svg>. Un tipo de
     Yjs ya integrado no se puede reinsertar, así que se clona y se borra
     el original (igual que el orden Z de las figuras). */
  moveLayer(layer, dir) {
    const svg = this.root();
    if (!svg || !layer) return null;
    const ls = this.layers();
    const i = ls.indexOf(layer);
    const j = i + (dir === "up" ? 1 : -1);
    if (i < 0 || j < 0 || j >= ls.length) return null;
    return this.edit(() => {
      const at = indexOf(svg, layer);
      const target = indexOf(svg, ls[j]);
      if (at < 0 || target < 0) return null;
      const copy = cloneEl(layer);
      svg.delete(at, 1);
      svg.insert(target, [copy]);
      return copy;
    });
  }

  removeLayer(layer) {
    const svg = this.root();
    if (!svg || !layer) return false;
    if (this.layers().length <= 1) return false;   // nunca dejar el dibujo sin capa
    const at = indexOf(svg, layer);
    if (at < 0) return false;
    this.edit(() => svg.delete(at, 1));
    return true;
  }

  /* Mueve figuras a otra capa conservando dónde se ven. `fixups` trae el
     transform ya recalculado por quien sí conoce las matrices del lienzo
     (mover entre capas con transform distinto cambiaría la posición). */
  moveToLayer(els, layer, fixups = null) {
    if (!layer || !els.length) return [];
    return this.edit(() => {
      const out = [];
      for (const el of els) {
        const parent = el.parent;
        const at = parent ? indexOf(parent, el) : -1;
        if (at < 0 || parent === layer) continue;
        const copy = cloneEl(el);
        const t = fixups && fixups.get(el);
        if (t != null) {
          if (t) copy.setAttribute("transform", t);
          else copy.removeAttribute("transform");
        }
        parent.delete(at, 1);
        layer.insert(childrenOf(layer).length, [copy]);
        out.push(copy);
      }
      return out;
    });
  }

  /* ¿`node` está dentro de `ancestro` (o es él)? Hace falta antes de
     mover nada: meter un grupo dentro de sí mismo rompe el árbol. */
  contains(ancestro, node) {
    for (let n = node; n; n = n.parent) if (n === ancestro) return true;
    return false;
  }

  /* Nombre de capa que no choque con otro. */
  freeLayerName(base) {
    const usados = new Set(this.layers().map(l => l.getAttribute("data-layer")));
    const raiz = String(base || "Capa").replace(/ \(copia( \d+)?\)$/, "");
    if (!usados.has(raiz)) return raiz;
    let n = 2, nombre = `${raiz} (copia)`;
    while (usados.has(nombre)) nombre = `${raiz} (copia ${n++})`;
    return nombre;
  }

  /* ---------- insertar y mover ---------- */

  /* Mete nodos recién construidos (los de svgio.textToNodes) en una capa
     o grupo. Devuelve los ya integrados, que son los que sirven para
     seleccionar. */
  insertNodes(parent, nodes, index = null) {
    const host = parent || this.activeLayer();
    if (!host || !nodes || !nodes.length) return [];
    return this.edit(() => {
      const n = childrenOf(host).length;
      const at = index == null ? n : Math.max(0, Math.min(index, n));
      host.insert(at, nodes);
      return childrenOf(host).slice(at, at + nodes.length);
    });
  }

  /* Pega capas enteras al final del <svg>: cada una con nombre libre e id
     nuevo. Los nombres llegan de fuera porque un elemento sin integrar
     todavía no devuelve sus atributos. */
  pasteLayers(nodes, names = []) {
    const svg = this.root();
    if (!svg || !nodes || !nodes.length) return [];
    return this.edit(() => {
      nodes.forEach((n, i) => {
        n.setAttribute("data-layer", this.freeLayerName(names[i]));
        n.setAttribute("id", newId("capa"));
      });
      const at = childrenOf(svg).length;
      svg.insert(at, nodes);
      return childrenOf(svg).slice(at);
    });
  }

  /* Un .svg de fuera dentro de ESTE dibujo: sus definiciones al <defs> y
     sus capas al final, en UNA sola transacción. Si fueran dos, deshacer
     una importación dejaría los degradados metidos y las figuras fuera —
     y un Ctrl+Z tiene que devolver el dibujo a como estaba.

     Las piezas llegan de `svgio.svgToPieces`, ya normalizadas a
     milímetros y con los id renovados; los nombres van aparte porque un
     nodo sin integrar todavía no devuelve sus atributos. */
  importPieces({ defs = [], capas = [], nombres = [] } = {}) {
    if (!capas.length) return [];
    return this.edit(() => {
      if (defs.length) {
        const dst = this.defs();
        if (dst) dst.insert(childrenOf(dst).length, defs);
      }
      return this.pasteLayers(capas, nombres);
    }) || [];
  }

  /* Cambia un nodo de padre y/o de posición conservando dónde se ve.
     Clona y borra, como todo lo que «mueve» en Yjs; `transform` llega ya
     recalculado por quien conoce las matrices del lienzo. */
  reparent(node, parent, index, transform) {
    if (!node || !parent || this.contains(node, parent)) return null;
    const from = node.parent;
    if (!from) return null;
    return this.edit(() => {
      const at = indexOf(from, node);
      if (at < 0) return null;
      const copy = cloneEl(node);
      if (transform !== undefined) {
        if (transform) copy.setAttribute("transform", transform);
        else copy.removeAttribute("transform");
      }
      let target = Math.max(0, Math.min(index, childrenOf(parent).length));
      from.delete(at, 1);
      // al quitarlo, todo lo que venía detrás en ESE padre se corre uno
      if (from === parent && at < target) target--;
      parent.insert(Math.max(0, Math.min(target, childrenOf(parent).length)), [copy]);
      return copy;
    });
  }

  /* ---------- tamaño de la página ---------- */

  size() {
    const svg = this.root();
    if (!svg) return { w: DEFAULT_W, h: DEFAULT_H };
    const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb.every(n => isFinite(n)) && vb[2] > 0 && vb[3] > 0)
      return { w: vb[2], h: vb[3], x: vb[0], y: vb[1] };
    return { w: DEFAULT_W, h: DEFAULT_H, x: 0, y: 0 };
  }

  setSize(w, h) {
    const { x = 0, y = 0 } = this.size();
    this.setBox(x, y, w, h);
  }

  /* Recorte: mueve y redimensiona el PAPEL sin tocar el dibujo. Las
     figuras se quedan en sus coordenadas y lo que cambia es qué trozo
     queda dentro, igual que el recorte de una foto. */
  setBox(x, y, w, h) {
    const svg = this.root();
    if (!svg || !(w > 0) || !(h > 0)) return;
    const X = isFinite(x) ? x : 0, Y = isFinite(y) ? y : 0;
    this.edit(() => {
      svg.setAttribute("width", `${fmtNum(w)}mm`);
      svg.setAttribute("height", `${fmtNum(h)}mm`);
      svg.setAttribute("viewBox", `${fmtNum(X)} ${fmtNum(Y)} ${fmtNum(w)} ${fmtNum(h)}`);
    });
  }

  /* ---------- buscar ---------- */

  byId(id) {
    if (!id) return null;
    for (const el of walk(this.frag)) if (el.getAttribute("id") === id) return el;
    return null;
  }

  /* Elementos dibujables de todas las capas, en orden de pintado. */
  shapes() {
    const out = [];
    const layers = this.layers();
    const roots = layers.length ? layers : [this.root()].filter(Boolean);
    for (const layer of roots) {
      for (const el of elChildren(layer)) if (SHAPE_TAGS.has(el.nodeName)) out.push(el);
    }
    return out;
  }

  /* Capa (o raíz) que contiene a un elemento, subiendo desde él. */
  layerOf(el) {
    let n = el;
    while (n && n.parent) {
      if (isEl(n) && n.getAttribute && n.getAttribute("data-layer") != null) return n;
      n = n.parent;
    }
    return null;
  }

  /* ---------- crear y borrar ---------- */

  add(parent, tag, attrs = {}) {
    const host = parent || this.activeLayer();
    if (!host) return null;
    return this.edit(() => {
      const el = new Y.XmlElement(tag);
      if (!attrs.id) el.setAttribute("id", newId());
      for (const [k, v] of Object.entries(attrs)) {
        if (v != null && v !== "") el.setAttribute(k, String(v));
      }
      host.insert(childrenOf(host).length, [el]);
      return el;
    });
  }

  remove(els) {
    const list = [].concat(els).filter(Boolean);
    this.edit(() => {
      for (const el of list) {
        const parent = el.parent;
        if (!parent) continue;
        const i = indexOf(parent, el);
        if (i >= 0) parent.delete(i, 1);
      }
    });
  }

  /* Duplica en el mismo sitio, un poco desplazado, y devuelve las
     copias (con id nuevos) para poder seleccionarlas. */
  duplicate(els, dx = 2, dy = 2) {
    const list = [].concat(els).filter(Boolean);
    return this.edit(() => {
      const copies = [];
      for (const el of list) {
        const parent = el.parent;
        if (!parent) continue;
        const copy = cloneFresh(el);
        parent.insert(indexOf(parent, el) + 1, [copy]);
        copies.push(copy);
      }
      if (dx || dy) for (const c of copies) nudge(c, dx, dy);
      return copies;
    });
  }

  /* ---------- atributos ---------- */

  setAttrs(els, attrs) {
    const list = [].concat(els).filter(Boolean);
    this.edit(() => {
      for (const el of list) {
        for (const [k, v] of Object.entries(attrs)) {
          if (v == null) el.removeAttribute(k);
          else el.setAttribute(k, String(v));
          // el style del propio elemento taparía lo que acabamos de poner
          dropStyleProp(el, k);
          /* Pintar un grupo tiene que pintar lo que lleva dentro. Como el
             clic normal selecciona el grupo entero (igual que Inkscape),
             este es el caso HABITUAL, no el raro: sin esto, elegir una
             figura importada y darle un color no hacía absolutamente
             nada. Se les quita a los descendientes su valor propio para
             que herede el del grupo; un Ctrl+Z lo devuelve todo, porque
             va dentro de la misma transacción. */
          if (HEREDABLES.has(k) && el.nodeName === "g") {
            for (const kid of walk(el)) {
              kid.removeAttribute(k);
              dropStyleProp(kid, k);
            }
          }
        }
      }
    });
  }

  /* ---------- orden Z ----------
     Clonar y borrar, porque Yjs no reinserta un tipo integrado. Se
     devuelven los clones para que quien llamó rehaga su selección. */
  reorder(els, mode) {
    const list = [].concat(els).filter(Boolean);
    if (!list.length) return [];
    return this.edit(() => {
      const done = [];
      // de arriba abajo o al revés según el sentido, para no pisarse
      const byDepth = list.slice().sort((a, b) => indexOf(a.parent, a) - indexOf(b.parent, b));
      const order = (mode === "raise" || mode === "top") ? byDepth.reverse() : byDepth;
      for (const el of order) {
        const parent = el.parent;
        if (!parent) continue;
        const n = childrenOf(parent).length;
        const i = indexOf(parent, el);
        if (i < 0) continue;
        let target;
        if (mode === "top") target = n - 1;
        else if (mode === "bottom") target = 0;
        else if (mode === "raise") target = Math.min(i + 1, n - 1);
        else target = Math.max(i - 1, 0);
        if (target === i) { done.push(el); continue; }
        const copy = cloneEl(el);
        parent.delete(i, 1);
        parent.insert(target, [copy]);
        done.push(copy);
      }
      return done;
    });
  }

  /* ---------- agrupar ---------- */

  group(els) {
    const list = [].concat(els).filter(Boolean);
    if (list.length < 2) return null;
    return this.edit(() => {
      const parent = list[0].parent;
      // solo se agrupa lo que comparte padre: agrupar entre capas movería
      // figuras de capa a escondidas, que es justo lo que confunde
      const same = list.filter(e => e.parent === parent);
      if (same.length < 2) return null;
      const idx = same.map(e => indexOf(parent, e)).sort((a, b) => a - b);
      const at = idx[0];
      const clones = same
        .slice()
        .sort((a, b) => indexOf(parent, a) - indexOf(parent, b))
        .map(cloneEl);
      // borrar de mayor a menor índice para que los índices no se muevan
      for (const i of idx.slice().sort((a, b) => b - a)) parent.delete(i, 1);
      const g = new Y.XmlElement("g");
      g.setAttribute("id", newId("g"));
      g.insert(0, clones);
      parent.insert(Math.min(at, childrenOf(parent).length), [g]);
      return g;
    });
  }

  /* Deshace el grupo llevando su transform a cada hijo, para que nada
     se mueva de sitio al desagrupar. */
  ungroup(els) {
    const list = [].concat(els).filter(g => isEl(g) && g.nodeName === "g");
    if (!list.length) return [];
    return this.edit(() => {
      const freed = [];
      for (const g of list) {
        const parent = g.parent;
        if (!parent) continue;
        const at = indexOf(parent, g);
        if (at < 0) continue;
        const gt = g.getAttribute("transform");
        const gAttrs = g.getAttributes();
        /* El transform propio de cada hijo hay que leerlo del ORIGINAL,
           que está integrado: el clon todavía no devuelve sus atributos,
           y preguntárselo a él dejaría al hijo solo con el del grupo,
           perdiendo su giro o su escala. */
        const originales = elChildren(g);
        const kids = originales.map(k => cloneEl(k));
        originales.forEach((orig, i) => {
          if (gt) {
            const own = orig.getAttribute("transform");
            kids[i].setAttribute("transform", own ? `${gt} ${own}` : gt);
          }
          /* Lo que el grupo daba por herencia se lo queda cada hijo que
             no traiga lo suyo; si no, desagrupar cambiaba el aspecto del
             dibujo (un grupo al 30 % de opacidad soltaba hijos opacos). */
          for (const k of HEREDABLES) {
            if (gAttrs[k] == null) continue;
            if (orig.getAttribute(k) != null) continue;
            kids[i].setAttribute(k, String(gAttrs[k]));
          }
          /* La opacidad del grupo NO se hereda: se multiplica. */
          if (gAttrs.opacity != null) {
            const propia = parseFloat(orig.getAttribute("opacity"));
            const base = parseFloat(gAttrs.opacity);
            const total = (isFinite(base) ? base : 1) * (isFinite(propia) ? propia : 1);
            kids[i].setAttribute("opacity", String(Math.round(total * 1000) / 1000));
          }
          // un recorte del grupo vale igual aplicado a cada hijo
          if (gAttrs["clip-path"] != null && orig.getAttribute("clip-path") == null)
            kids[i].setAttribute("clip-path", String(gAttrs["clip-path"]));
        });
        parent.delete(at, 1);
        if (kids.length) parent.insert(at, kids);
        freed.push(...kids);
      }
      return freed;
    });
  }

  /* ---------- deshacer ---------- */
  undo() { if (this.undoMgr) this.undoMgr.undo(); }
  redo() { if (this.undoMgr) this.undoMgr.redo(); }
  canUndo() { return !!this.undoMgr && this.undoMgr.canUndo(); }
  canRedo() { return !!this.undoMgr && this.undoMgr.canRedo(); }
}

/* Suma una traslación al transform de un elemento (sin tocar el resto
   de la transformación, que puede llevar giro o escala). */
export function nudge(el, dx, dy) {
  const cur = el.getAttribute("transform") || "";
  el.setAttribute("transform", `translate(${dx},${dy}) ${cur}`.trim());
}

/* ============================================================
   El conjunto de dibujos de un proyecto
   ============================================================ */
export class DrawStore {
  constructor(ydoc, { readOnly = false } = {}) {
    this.ydoc = ydoc;
    this.readOnly = readOnly;
    this.map = ydoc.getMap("drawings");
  }

  list() {
    return Array.from(this.map.keys()).sort((a, b) => a.localeCompare(b));
  }

  has(path) { return this.map.has(path); }
  get(path) { return this.map.get(path) || null; }

  create(path, opts) {
    if (this.readOnly || this.map.has(path)) return null;
    let frag = null;
    this.ydoc.transact(() => {
      frag = makeDrawing(opts);
      this.map.set(path, frag);
    }, LOCAL);
    return frag;
  }

  delete(path) {
    if (this.readOnly) return;
    this.ydoc.transact(() => this.map.delete(path), LOCAL);
  }

  /* Renombrar rehace el fragmento: igual que un Y.Text, un
     Y.XmlFragment ya integrado no se puede reinsertar bajo otra clave.
     Se pierde el historial de deshacer del dibujo, no su contenido. */
  rename(path, next) {
    if (this.readOnly || !this.map.has(path) || this.map.has(next)) return false;
    const old = this.map.get(path);
    this.ydoc.transact(() => {
      const frag = new Y.XmlFragment();
      const kids = childrenOf(old).map(cloneEl);
      if (kids.length) frag.insert(0, kids);
      this.map.set(next, frag);
      this.map.delete(path);
    }, LOCAL);
    return true;
  }

  /* Guarda un fragmento recién creado (p. ej. el que devuelve
     svgToFragment). OJO: hasta que no está dentro del Y.Doc, un
     fragmento no se puede leer — `toArray()` devuelve vacío y Yjs
     avisa por consola. Por eso se integra aquí y se devuelve YA la
     versión de dentro del documento, que es la que sirve para todo. */
  put(path, frag) {
    if (this.readOnly || this.map.has(path)) return null;
    this.ydoc.transact(() => this.map.set(path, frag), LOCAL);
    return this.map.get(path);
  }

  duplicate(path) {
    if (this.readOnly || !this.map.has(path)) return null;
    const base = path.replace(/\.svg$/i, "");
    let name = `${base} (copia).svg`;
    let n = 2;
    while (this.map.has(name)) name = `${base} (copia ${n++}).svg`;
    const old = this.map.get(path);
    this.ydoc.transact(() => {
      const frag = new Y.XmlFragment();
      const kids = childrenOf(old).map(cloneFresh);
      if (kids.length) frag.insert(0, kids);
      this.map.set(name, frag);
    }, LOCAL);
    return name;
  }
}
