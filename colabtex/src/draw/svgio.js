"use strict";
/* ============================================================
   ColabDraw — SVG de entrada y de salida

   Serializar: del árbol Yjs a un archivo .svg de texto.
   Importar:   de un archivo .svg al árbol Yjs, SANEANDO.

   Lo del saneado no es paranoia de manual: un SVG es un documento
   ejecutable. Si se inyecta tal cual, un <script>, un <foreignObject>
   con HTML, un manejador onload="" o un href="javascript:" corren en
   el origen de la página y con la sesión de Firebase abierta. Aquí se
   descartan siempre, aunque el archivo sea de la propia persona: no se
   sabe de dónde venía antes.
   ============================================================ */
import * as Y from "yjs";
import { fmt } from "./geom.js";

/* ---------- unidades ----------
   El documento trabaja en milímetros (ver doc.js). Todo lo que entra
   se convierte a mm para que las medidas del panel sean las del papel. */
const PX_PER_IN = 96;
const MM_PER_IN = 25.4;
const UNIT_MM = {
  mm: 1, cm: 10, q: 0.25,
  in: MM_PER_IN, pt: MM_PER_IN / 72, pc: MM_PER_IN / 6,
  px: MM_PER_IN / PX_PER_IN, "": MM_PER_IN / PX_PER_IN
};

export function lengthToMm(value) {
  if (value == null) return null;
  const m = String(value).trim().match(/^([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s*([a-z%]*)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  if (unit === "%") return null;            // relativo: no se puede resolver aquí
  const k = UNIT_MM[unit];
  return k == null ? null : n * k;
}

/* ---------- saneado ---------- */

/* Etiquetas que se copian. Todo lo que no esté aquí se descarta con su
   contenido; en particular script, foreignObject, animate* y handler. */
const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "symbol", "use", "title", "desc", "style",
  "rect", "circle", "ellipse", "line", "polyline", "polygon", "path",
  "text", "tspan", "textPath", "image", "a", "marker", "clipPath", "mask",
  "pattern", "linearGradient", "radialGradient", "stop", "switch"
]);

/* Se quitan por nombre aunque algún día alguien amplíe la lista de arriba. */
const FORBIDDEN_TAGS = new Set([
  "script", "foreignobject", "handler", "animate", "animatetransform",
  "animatemotion", "set", "iframe", "embed", "object", "audio", "video"
]);

const isSafeRef = v => {
  const s = String(v || "").trim();
  if (!s) return false;
  if (s.startsWith("#")) return true;                       // referencia interna
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(s)) return true;
  return false;                                             // http, file, javascript…
};

export function isSafeAttr(name, value) {
  const n = name.toLowerCase();
  if (n.startsWith("on")) return false;                     // onload, onclick…
  if (n === "href" || n === "xlink:href") return isSafeRef(value);
  // url(...) apuntando fuera: fuga de datos al abrir el dibujo
  if (/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(String(value || ""))) return false;
  if (/javascript\s*:/i.test(String(value || ""))) return false;
  return true;
}

/* El CSS de dentro de <style> no ejecuta JavaScript en un navegador
   actual, pero sí puede traerse recursos de fuera. */
export function sanitizeCss(css) {
  return String(css || "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*['"]?\s*(?:https?:)?\/\/[^)]*\)/gi, "none")
    .replace(/javascript\s*:/gi, "");
}

/* ---------- DOM → Yjs ---------- */

function domToY(node) {
  if (node.nodeType === 3) {                                // texto
    const s = node.nodeValue;
    if (!s || !s.trim()) return null;
    const t = new Y.XmlText();
    t.insert(0, s);
    return t;
  }
  if (node.nodeType !== 1) return null;                     // comentarios, PI…

  const tag = node.nodeName;
  const lower = tag.toLowerCase();
  if (FORBIDDEN_TAGS.has(lower)) return null;
  if (!ALLOWED_TAGS.has(tag) && !ALLOWED_TAGS.has(lower)) return null;

  const el = new Y.XmlElement(tag);
  for (const at of Array.from(node.attributes || [])) {
    if (!isSafeAttr(at.name, at.value)) continue;
    el.setAttribute(at.name, at.value);
  }

  if (lower === "style") {
    const css = sanitizeCss(node.textContent);
    if (css.trim()) {
      const t = new Y.XmlText();
      t.insert(0, css);
      el.insert(0, [t]);
    }
    return el;
  }

  const kids = [];
  for (const child of Array.from(node.childNodes)) {
    const y = domToY(child);
    if (y) kids.push(y);
  }
  if (kids.length) el.insert(0, kids);
  return el;
}

export function parseSvgDom(text) {
  const doc = new DOMParser().parseFromString(String(text), "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error("El archivo no es un SVG válido.");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg")
    throw new Error("El archivo no empieza por <svg>.");
  return svg;
}

/* Tamaño en milímetros y caja de coordenadas de un <svg> de fuera.
   Con viewBox se respeta su sistema; sin él, las coordenadas son px y
   hay que escalarlas para que el dibujo mida lo mismo en el papel. */
export function svgGeometry(svgEl) {
  const vbRaw = (svgEl.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const vb = vbRaw.length === 4 && vbRaw.every(isFinite) && vbRaw[2] > 0 && vbRaw[3] > 0
    ? { x: vbRaw[0], y: vbRaw[1], w: vbRaw[2], h: vbRaw[3] }
    : null;

  let wmm = lengthToMm(svgEl.getAttribute("width"));
  let hmm = lengthToMm(svgEl.getAttribute("height"));

  if (!vb) {
    // sin viewBox las unidades son px; si tampoco hay tamaño, 300×200 px
    const wpx = parseFloat(svgEl.getAttribute("width")) || 300;
    const hpx = parseFloat(svgEl.getAttribute("height")) || 200;
    if (wmm == null) wmm = wpx * UNIT_MM.px;
    if (hmm == null) hmm = hpx * UNIT_MM.px;
    return { vb: { x: 0, y: 0, w: wpx, h: hpx }, wmm, hmm, scale: wmm / wpx };
  }
  if (wmm == null || hmm == null) {
    // viewBox sin tamaño físico: se interpretan las unidades como px
    wmm = vb.w * UNIT_MM.px;
    hmm = vb.h * UNIT_MM.px;
  }
  return { vb, wmm, hmm, scale: wmm / vb.w };
}

/* Un archivo .svg entero → fragmento listo para guardar como dibujo.
   Se normaliza a milímetros: el <svg> resultante siempre cumple
   1 unidad de usuario = 1 mm, que es lo que espera el resto del editor.

   El fragmento vuelve SIN INTEGRAR en ningún Y.Doc, así que todavía no
   se puede leer (toArray() daría vacío y Yjs se queja por consola).
   Hay que guardarlo antes con DrawStore.put(), que devuelve la versión
   ya integrada. */
export function svgToFragment(text, { layerName = "Importado" } = {}) {
  const src = parseSvgDom(text);
  const geo = svgGeometry(src);
  const wmm = Math.max(1, geo.wmm), hmm = Math.max(1, geo.hmm);

  const frag = new Y.XmlFragment();
  const svg = new Y.XmlElement("svg");
  svg.setAttribute("width", `${fmt(wmm)}mm`);
  svg.setAttribute("height", `${fmt(hmm)}mm`);
  svg.setAttribute("viewBox", `0 0 ${fmt(wmm)} ${fmt(hmm)}`);

  const defs = new Y.XmlElement("defs");
  const layer = new Y.XmlElement("g");
  layer.setAttribute("data-layer", layerName);

  /* Del sistema de coordenadas de origen al nuestro: primero se lleva
     la esquina del viewBox al cero, luego se escala a milímetros. */
  const k = geo.scale;
  const parts = [];
  if (k !== 1) parts.push(`scale(${fmt(k, 6)})`);
  if (geo.vb.x || geo.vb.y) parts.push(`translate(${fmt(-geo.vb.x)},${fmt(-geo.vb.y)})`);
  if (parts.length) layer.setAttribute("transform", parts.join(" "));

  /* Un archivo que YA viene organizado en capas y en nuestras
     coordenadas se adopta tal cual, sin envolverlo. Es el caso de un
     SVG exportado por ColabDraw: sin esto, exportar y volver a importar
     iría metiendo una capa «Importado» dentro de otra cada vez. */
  const elemHijos = Array.from(src.childNodes).filter(n => n.nodeType === 1);
  const noDefs = elemHijos.filter(n => n.nodeName.toLowerCase() !== "defs");
  const adoptar = !parts.length && noDefs.length > 0 &&
    noDefs.every(n => n.nodeName.toLowerCase() === "g" && n.hasAttribute("data-layer"));

  const capas = [];
  const kids = [];
  for (const child of Array.from(src.childNodes)) {
    const y = domToY(child);
    if (!y) continue;
    // <defs> del original se funden con los nuestros
    if (y instanceof Y.XmlElement && y.nodeName.toLowerCase() === "defs") {
      const inner = y.toArray();
      if (inner.length) defs.insert(defs.length, inner);
      continue;
    }
    if (adoptar) capas.push(y); else kids.push(y);
  }

  if (adoptar) {
    svg.insert(0, [defs].concat(capas));
  } else {
    if (kids.length) layer.insert(0, kids);
    svg.insert(0, [defs, layer]);
  }
  frag.insert(0, [svg]);
  return frag;
}

/* ---------- Yjs → texto ---------- */

const escAttr = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const escText = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Sin hijos se cierra en la propia etiqueta. <text> nunca: un
   <text></text> vacío y un <text/> se comportan igual, pero los
   visores se llevan mejor con la forma larga en los contenedores. */
const VOIDABLE = new Set([
  "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "path", "image", "use", "stop"
]);

function serializeNode(node, indent, out) {
  if (node instanceof Y.XmlText) {
    const s = node.toString();
    if (s.trim()) out.push(escText(s));
    return;
  }
  if (!(node instanceof Y.XmlElement)) return;

  const tag = node.nodeName;
  const attrs = node.getAttributes();
  const keys = Object.keys(attrs).filter(k => attrs[k] != null && attrs[k] !== "");
  // orden estable: dos exportaciones del mismo dibujo dan el mismo texto
  keys.sort((a, b) => (a === "id" ? -1 : b === "id" ? 1 : a.localeCompare(b)));
  const attrStr = keys.map(k => ` ${k}="${escAttr(attrs[k])}"`).join("");

  const kids = node.toArray();
  const pad = "  ".repeat(indent);

  if (!kids.length) {
    out.push(`${pad}<${tag}${attrStr}${VOIDABLE.has(tag) ? "/>" : `></${tag}>`}`);
    return;
  }
  // si solo lleva texto, todo en una línea (importa en <text>: los saltos
  // de línea dentro de <text> se ven como espacios al pintar)
  const onlyText = kids.every(k => k instanceof Y.XmlText);
  if (onlyText) {
    const inner = kids.map(k => escText(k.toString())).join("");
    out.push(`${pad}<${tag}${attrStr}>${inner}</${tag}>`);
    return;
  }
  out.push(`${pad}<${tag}${attrStr}>`);
  for (const k of kids) {
    if (k instanceof Y.XmlText) {
      const s = k.toString();
      if (s.trim()) out.push("  ".repeat(indent + 1) + escText(s));
    } else {
      serializeNode(k, indent + 1, out);
    }
  }
  out.push(`${pad}</${tag}>`);
}

/* Texto .svg completo de un dibujo. `root` es el <svg> Y.XmlElement.

   Los atributos de la etiqueta de apertura se juntan en un objeto
   normal, NO en un Y.XmlElement de apoyo: un tipo Yjs sin integrar en
   ningún documento no devuelve nada al leerlo, y el <svg> salía pelado
   —sin tamaño y sin xmlns—, que es un archivo que no abre en ningún
   sitio. */
export function serialize(root, { header = true } = {}) {
  if (!root) return "";
  const out = [];
  const attrs = Object.assign({}, root.getAttributes());
  attrs.xmlns = "http://www.w3.org/2000/svg";
  if (usesXlink(root)) attrs["xmlns:xlink"] = "http://www.w3.org/1999/xlink";

  const keys = Object.keys(attrs).filter(k => attrs[k] != null && attrs[k] !== "");
  keys.sort((a, b) => rankAttr(a) - rankAttr(b) || a.localeCompare(b));
  const attrStr = keys.map(k => ` ${k}="${escAttr(attrs[k])}"`).join("");

  if (header) out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(`<svg${attrStr}>`);
  for (const kid of root.toArray()) serializeNode(kid, 1, out);
  out.push("</svg>");
  return out.join("\n") + "\n";
}

const ATTR_RANK = { xmlns: 0, "xmlns:xlink": 1, width: 2, height: 3, viewBox: 4 };
const rankAttr = k => (k in ATTR_RANK ? ATTR_RANK[k] : 10);

function usesXlink(node) {
  if (node instanceof Y.XmlElement) {
    if (Object.keys(node.getAttributes()).some(k => k.startsWith("xlink:"))) return true;
    for (const k of node.toArray()) if (usesXlink(k)) return true;
  }
  return false;
}
