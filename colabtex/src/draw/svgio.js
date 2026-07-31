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
import { newId } from "./doc.js";

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

/* Atributos de otros vocabularios (inkscape:*, sodipodi:*, y sus
   declaraciones xmlns:*). No se copian por dos razones: no significan
   nada para el editor, y al exportar saldrían con un prefijo que el
   archivo ya no declara — un SVG que ningún visor abre. Lo que sí
   importa de ellos (la capa, su nombre, si está oculta o bloqueada) se
   lee ANTES, en `layerInfo`, y se traduce a nuestros atributos. */
const KEEP_PREFIX = new Set(["xlink", "xml"]);
export function keepAttr(name) {
  const i = String(name).indexOf(":");
  if (i < 0) return true;
  return KEEP_PREFIX.has(name.slice(0, i).toLowerCase());
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
    if (!keepAttr(at.name)) continue;
    if (!isSafeAttr(at.name, at.value)) continue;
    el.setAttribute(at.name, at.value);
  }

  /* El nombre que se ve en el panel de objetos de Inkscape vive en
     inkscape:label. Se traduce a data-label antes de que el atributo
     original se pierda, porque el árbol de objetos lo enseña. */
  const etiqueta = node.getAttributeNS && node.getAttributeNS(INK_NS, "label");
  if (etiqueta && !node.getAttribute("data-label")) el.setAttribute("data-label", etiqueta);

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

/* ---------- capas de un archivo de fuera ----------

   Inkscape no tiene un tipo «capa»: una capa suya es un <g> normal
   marcado con inkscape:groupmode="layer", con el nombre en
   inkscape:label, oculto con style="display:none" y bloqueado con
   sodipodi:insensitive. Sin traducir eso, un dibujo de Inkscape entraba
   entero dentro de una única capa «Importado» y sus capas quedaban
   invisibles en el panel — que es exactamente lo que se veía. */
const INK_NS = "http://www.inkscape.org/namespaces/inkscape";
const SODI_NS = "http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd";

/* getAttributeNS es lo fiable en un documento XML; getAttribute solo
   acierta si el archivo usa justo el prefijo que esperamos. */
const attrNs = (node, ns, local) =>
  (node.getAttributeNS ? node.getAttributeNS(ns, local) : null) ||
  node.getAttribute(`${ns === INK_NS ? "inkscape" : "sodipodi"}:${local}`) || null;

const styleProp = (node, prop) => {
  const m = String(node.getAttribute("style") || "").match(
    new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
};

/* Qué es un <g> de fuera: si es capa, cómo se llama y cómo está. Todo
   se lee del DOM de origen y se devuelve junto, porque después ya no hay
   dónde leerlo: el elemento Yjs recién convertido todavía no está
   integrado en ningún documento y NO devuelve sus atributos (la misma
   trampa que obliga a clonar leyendo del original en doc.js). */
export function layerInfo(node) {
  if (!node || node.nodeType !== 1 || node.nodeName.toLowerCase() !== "g") return null;
  const propio = node.getAttribute("data-layer");
  const st = String(node.getAttribute("style") || "");
  return {
    esCapa: (propio != null && propio !== "") || attrNs(node, INK_NS, "groupmode") === "layer",
    name: propio || attrNs(node, INK_NS, "label") || node.getAttribute("id") || "",
    oculta: node.getAttribute("display") === "none" || styleProp(node, "display") === "none",
    bloqueada: attrNs(node, SODI_NS, "insensitive") === "true" ||
      node.getAttribute("data-locked") === "1",
    id: node.getAttribute("id") || "",
    // el display se saca del estilo: su sitio es el atributo (ver markLayer)
    style: st.replace(/(?:^|;)\s*display\s*:[^;]*/gi, "").replace(/^;+|;+$/g, "").trim(),
    transform: node.getAttribute("transform") || ""
  };
}

/* Convierte un <g> ya pasado a Yjs en una capa nuestra. El `display` pasa
   a ser atributo (no estilo) porque es donde lo busca el panel y donde
   tiene que estar para que la capa salga oculta también al exportar; y la
   normalización a milímetros se antepone al transform que ya traía, en
   vez de envolverlo todo en un <g> de más. */
function markLayer(g, info, norm, nombre) {
  g.setAttribute("data-layer", nombre);
  g.setAttribute("id", info.id || newId("capa"));
  if (info.oculta) g.setAttribute("display", "none");
  if (info.bloqueada) g.setAttribute("data-locked", "1");
  if (info.style) g.setAttribute("style", info.style); else g.removeAttribute("style");
  const t = norm ? (info.transform ? `${norm} ${info.transform}` : norm) : info.transform;
  if (t) g.setAttribute("transform", t);
  return g;
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

  /* Del sistema de coordenadas de origen al nuestro: primero se lleva
     la esquina del viewBox al cero, luego se escala a milímetros. */
  const k = geo.scale;
  const parts = [];
  if (k !== 1) parts.push(`scale(${fmt(k, 6)})`);
  if (geo.vb.x || geo.vb.y) parts.push(`translate(${fmt(-geo.vb.x)},${fmt(-geo.vb.y)})`);
  const norm = parts.join(" ");

  /* Las capas del archivo se conservan COMO CAPAS. La conversión a
     milímetros no obliga a envolverlo todo en un <g> extra: basta con
     anteponerla al transform de cada capa, así que un dibujo de Inkscape
     entra con sus capas intactas aunque venga en otras unidades.

     Sin ninguna capa marcada valen dos casos: si en la raíz solo hay
     grupos, cada grupo pasa a ser una capa (es como se organiza un SVG
     de Illustrator); si hay figuras sueltas, todo va a una capa nueva. */
  const elemHijos = Array.from(src.childNodes).filter(n => n.nodeType === 1);
  const noDefs = elemHijos.filter(n => n.nodeName.toLowerCase() !== "defs");
  const hayCapas = noDefs.some(n => { const i = layerInfo(n); return i && i.esCapa; });
  const soloGrupos = noDefs.length > 0 && noDefs.every(n => n.nodeName.toLowerCase() === "g");
  const adoptar = hayCapas || soloGrupos;

  const capas = [];   // <g> que serán capas, en orden de pintado
  const sueltos = []; // lo que no cabe en ninguna: irá a una capa aparte
  let nCapa = 0;

  for (const child of Array.from(src.childNodes)) {
    /* <defs> del original: se funden con los nuestros copiando sus hijos
       UNO A UNO desde el DOM. Convertir el <defs> entero y leerlo después
       no vale — sin integrar, `toArray()` devuelve vacío y el contenido
       (degradados, marcadores) desaparecería sin avisar. */
    if (child.nodeType === 1 && child.nodeName.toLowerCase() === "defs") {
      const inner = [];
      for (const g of Array.from(child.childNodes)) {
        const y = domToY(g);
        if (y) inner.push(y);
      }
      if (inner.length) defs.insert(defs.length, inner);
      continue;
    }

    const y = domToY(child);
    if (!y) continue;
    const info = adoptar ? layerInfo(child) : null;
    if (info && (info.esCapa || !hayCapas)) {
      capas.push(markLayer(y, info, norm, info.name || `Capa ${++nCapa}`));
    } else {
      sueltos.push(y);
    }
  }

  if (sueltos.length || !capas.length) {
    const extra = new Y.XmlElement("g");
    extra.setAttribute("id", newId("capa"));
    extra.setAttribute("data-layer", capas.length ? "Suelto" : layerName);
    if (norm) extra.setAttribute("transform", norm);
    if (sueltos.length) extra.insert(0, sueltos);
    capas.push(extra);
  }

  svg.insert(0, [defs].concat(capas));
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

/* ---------- portapapeles ----------
   Copiar guarda TEXTO, no nodos de Yjs. Un clon sin integrar no se deja
   leer, así que un portapapeles de nodos solo serviría para pegar una
   vez; en texto se pega las veces que haga falta, en otro dibujo, en
   otra pestaña y hasta en Inkscape. */
export function nodesToText(nodes) {
  const out = [];
  for (const n of nodes || []) serializeNode(n, 0, out);
  return out.join("\n");
}

/* Devuelve el marcado dentro de un <svg> con el tamaño del dibujo, que es
   lo que esperan los programas de fuera al pegar. */
export function clipboardSvg(nodes, { w = 0, h = 0 } = {}) {
  const medida = w > 0 && h > 0
    ? ` width="${fmt(w)}mm" height="${fmt(h)}mm" viewBox="0 0 ${fmt(w)} ${fmt(h)}"`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${medida}>\n${nodesToText(nodes)}\n</svg>\n`;
}

const esBlanco = s => !String(s || "").trim();

/* Texto pegado → nodos de Yjs listos para insertar, SANEADOS igual que
   una importación: lo que llega del portapapeles es tan ajeno como un
   archivo. Con `freshIds` se renuevan los identificadores, porque dos
   figuras con el mismo id romperían la selección. */
export function textToNodes(text, { freshIds = true } = {}) {
  if (esBlanco(text)) return [];
  const bruto = String(text).trim();
  const envuelto = /^<svg[\s>]/i.test(bruto)
    ? bruto
    : `<svg xmlns="http://www.w3.org/2000/svg">${bruto}</svg>`;
  const doc = new DOMParser().parseFromString(envuelto, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length) return [];
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return [];

  /* Los id se cambian en el DOM, ANTES de convertir: un elemento de Yjs
     recién creado todavía no devuelve sus atributos al leerlos. */
  if (freshIds) {
    const mapa = new Map();
    for (const n of root.querySelectorAll("[id]")) {
      const viejo = n.getAttribute("id");
      const nuevo = newId();
      mapa.set(viejo, nuevo);
      n.setAttribute("id", nuevo);
    }
    // referencias internas (url(#x), href="#x") apuntando a lo copiado
    for (const n of root.querySelectorAll("*")) {
      for (const at of Array.from(n.attributes)) {
        const v = at.value;
        if (!v || v.indexOf("#") < 0) continue;
        const sust = v.replace(/#([\w:.-]+)/g, (m, id) => (mapa.has(id) ? "#" + mapa.get(id) : m));
        if (sust !== v) n.setAttribute(at.name, sust);
      }
    }
  }

  /* Junto a los nodos va una ficha de cada uno leída del DOM. Sin ella no
     habría forma de saber si lo pegado es una capa ni cuál era su
     transform: un elemento de Yjs sin integrar no devuelve nada. */
  const nodes = [], info = [];
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== 1) continue;
    if (child.nodeName.toLowerCase() === "defs") continue;
    const y = domToY(child);
    if (!(y instanceof Y.XmlElement)) continue;
    const capa = layerInfo(child);
    nodes.push(y);
    info.push({
      tag: child.nodeName,
      layer: !!(capa && capa.esCapa),
      label: (capa && capa.name) || child.getAttribute("data-label") || "",
      transform: child.getAttribute("transform") || ""
    });
  }
  return { nodes, info };
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
