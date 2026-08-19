"use strict";
/* ============================================================
   ColabDraw — pinturas: color plano y degradados

   Un `fill` o un `stroke` puede ser tres cosas, y aquí se describen las
   tres con la MISMA ficha para que el panel no tenga que saber en cuál
   está:

     { tipo: "none" }
     { tipo: "solid",  color: "#rrggbb" }
     { tipo: "linear", ang: 90,          stops: [{c,o}, …] }
     { tipo: "radial", cx: 50, cy: 50,   stops: [{c,o}, …] }

   `o` es la posición de la parada en tanto por ciento, `ang` el ángulo
   en grados y `cx`/`cy` el centro del radial, también en por ciento de
   la caja de la figura.

   Tres decisiones que sostienen el resto:

   - **`gradientUnits="objectBoundingBox"`**, que es el valor por
     defecto: las coordenadas van de 0 a 1 sobre la caja de la propia
     figura. Así el degradado no necesita saber cuánto mide nada, y
     sigue a la figura cuando se mueve, se escala o se gira — con
     coordenadas en milímetros habría que reescribir el `<defs>` en cada
     arrastre.
   - **El ángulo se guarda como vector**, no como atributo propio: el
     SVG solo entiende `x1,y1,x2,y2`, y un `data-ang` sería un segundo
     sitio donde apuntar lo mismo, listo para mentir en cuanto alguien
     tocara el archivo por fuera. Se recupera con `atan2` al leerlo.
   - **El radio del radial cubre la esquina más lejana**. Con `r = 0.5`
     (lo que trae SVG por defecto) un degradado centrado en una esquina
     dejaba la mitad de la figura del color de la última parada, y
     parecía que el editor no lo había aplicado del todo.

   Los degradados que crea el editor llevan `data-dw-grad`, y eso es lo
   que distingue el que se puede recoger cuando ya no lo usa nadie de
   uno que venía dentro de un SVG importado y no es nuestro para borrar.
   ============================================================ */

import { fmt } from "./geom.js";
import { textToNodes } from "./svgio.js";
import { newId, childrenOf, indexOf, isEl } from "./doc.js";

export const GRAD_MARK = "data-dw-grad";

/* Direcciones con nombre, en el orden en que se pintan los botones.
   0° es de izquierda a derecha y el ángulo crece en el sentido de las
   agujas del reloj, porque en SVG la y crece hacia abajo. */
export const DIRECCIONES = [
  { ang: 270, label: "↑", title: "De abajo arriba" },
  { ang: 315, label: "↗", title: "Hacia arriba y a la derecha" },
  { ang: 0, label: "→", title: "De izquierda a derecha" },
  { ang: 45, label: "↘", title: "Hacia abajo y a la derecha" },
  { ang: 90, label: "↓", title: "De arriba abajo" },
  { ang: 135, label: "↙", title: "Hacia abajo y a la izquierda" },
  { ang: 180, label: "←", title: "De derecha a izquierda" },
  { ang: 225, label: "↖", title: "Hacia arriba y a la izquierda" }
];

/* Centros con nombre para el radial: los mismos nueve sitios de una
   rejilla de tres por tres. */
export const CENTROS = [
  { cx: 25, cy: 25, label: "↖" }, { cx: 50, cy: 25, label: "↑" }, { cx: 75, cy: 25, label: "↗" },
  { cx: 25, cy: 50, label: "←" }, { cx: 50, cy: 50, label: "●" }, { cx: 75, cy: 50, label: "→" },
  { cx: 25, cy: 75, label: "↙" }, { cx: 50, cy: 75, label: "↓" }, { cx: 75, cy: 75, label: "↘" }
];

export const esGrad = spec => !!spec && (spec.tipo === "linear" || spec.tipo === "radial");

const num = (v, porDefecto) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : porDefecto;
};

const pct = v => Math.max(0, Math.min(100, num(v, 0)));

/* ---------- ángulo ↔ vector ---------- */

/* Los cuatro extremos del degradado lineal sobre la caja unidad. El
   vector pasa por el centro, así que el degradado siempre queda
   centrado sea cual sea el ángulo. */
export function vectorDe(ang) {
  const r = (num(ang, 0) * Math.PI) / 180;
  const dx = Math.cos(r) / 2, dy = Math.sin(r) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

export function angDe({ x1, y1, x2, y2 }) {
  const a = (Math.atan2(num(y2, 0.5) - num(y1, 0.5), num(x2, 1) - num(x1, 0)) * 180) / Math.PI;
  return Math.round(((a % 360) + 360) % 360);
}

/* Radio que alcanza la esquina más lejana desde el centro dado (en
   fracción de la caja). Con el centro en medio da 0,707. */
export function radioDe(cx, cy) {
  const x = pct(cx) / 100, y = pct(cy) / 100;
  let r = 0;
  for (const [ex, ey] of [[0, 0], [1, 0], [0, 1], [1, 1]])
    r = Math.max(r, Math.hypot(ex - x, ey - y));
  return r;
}

/* ---------- paradas ---------- */

const normStop = s => ({ c: String((s && s.c) || "#000000"), o: pct(s && s.o) });

/* Ordenadas y con al menos dos: un degradado de una sola parada es un
   color plano disfrazado, y el editor no sabría qué enseñar. */
export function normStops(stops) {
  const l = (Array.isArray(stops) ? stops : []).map(normStop);
  while (l.length < 2) l.push({ c: l.length ? l[l.length - 1].c : "#ffffff", o: l.length ? 100 : 0 });
  return l.sort((a, b) => a.o - b.o);
}

export function specPorDefecto(tipo, base) {
  const c = /^#[0-9a-f]{6}$/i.test(String(base || "")) ? String(base) : "#6c4bb6";
  const stops = [{ c, o: 0 }, { c: "#ffffff", o: 100 }];
  return tipo === "radial"
    ? { tipo: "radial", cx: 50, cy: 50, stops }
    : { tipo: "linear", ang: 90, stops };
}

/* ---------- ficha → marcado SVG ---------- */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* El `<linearGradient>`/`<radialGradient>` listo para meter en <defs>.
   Se devuelve como TEXTO porque el camino de entrada al documento es
   `textToNodes`, el mismo que sanea todo lo demás. */
export function gradMarkup(spec, id) {
  const stops = normStops(spec.stops)
    .map(s => `<stop offset="${fmt(s.o / 100)}" stop-color="${esc(s.c)}"/>`)
    .join("");
  if (spec.tipo === "radial") {
    const cx = pct(spec.cx) / 100, cy = pct(spec.cy) / 100;
    return `<radialGradient id="${esc(id)}" ${GRAD_MARK}="1" ` +
      `cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radioDe(spec.cx, spec.cy))}">${stops}</radialGradient>`;
  }
  const v = vectorDe(spec.ang);
  return `<linearGradient id="${esc(id)}" ${GRAD_MARK}="1" ` +
    `x1="${fmt(v.x1)}" y1="${fmt(v.y1)}" x2="${fmt(v.x2)}" y2="${fmt(v.y2)}">${stops}</linearGradient>`;
}

/* Un `offset` viene «0.5» o «50%»; las dos cosas son la mitad. */
function offsetPct(v) {
  const t = String(v == null ? "" : v).trim();
  const n = num(t, 0);
  return pct(t.endsWith("%") ? n : n * 100);
}

/* ---------- marcado → ficha ----------
   `el` es cualquier cosa con getAttribute y una lista de hijos: sirve
   igual un Y.XmlElement que un nodo del DOM, que es lo que permite
   leer un degradado importado sin duplicar el código. */
export function gradSpec(el, hijos) {
  if (!el || !el.getAttribute) return null;
  const tag = String(el.nodeName || "").toLowerCase();
  if (tag !== "lineargradient" && tag !== "radialgradient") return null;
  const stops = (hijos || [])
    .filter(n => String(n.nodeName || "").toLowerCase() === "stop")
    .map(n => ({ c: n.getAttribute("stop-color") || "#000000", o: offsetPct(n.getAttribute("offset")) }));
  if (tag === "radialgradient") {
    return {
      tipo: "radial",
      cx: num(el.getAttribute("cx"), 0.5) * 100,
      cy: num(el.getAttribute("cy"), 0.5) * 100,
      stops: normStops(stops)
    };
  }
  return {
    tipo: "linear",
    ang: angDe({
      x1: el.getAttribute("x1"), y1: el.getAttribute("y1"),
      x2: el.getAttribute("x2"), y2: el.getAttribute("y2")
    }),
    stops: normStops(stops)
  };
}

/* ---------- valor del atributo ---------- */

/* «url(#loquesea)» → «loquesea». Devuelve null si no es una referencia. */
export function refId(value) {
  const m = /^\s*url\(\s*['"]?#([^)'"]+)['"]?\s*\)/.exec(String(value || ""));
  return m ? m[1] : null;
}

/* ---------- vista previa ---------- */

/* El mismo degradado, pero en CSS, para pintar la muestra del panel.
   Los ángulos de CSS se miden desde arriba y en sentido horario, y los
   de aquí desde la izquierda: de ahí el +90. */
export function cssPaint(spec) {
  if (!spec || spec.tipo === "none") return null;
  if (spec.tipo === "solid") return spec.color;
  const paradas = normStops(spec.stops).map(s => `${s.c} ${fmt(s.o)}%`).join(", ");
  if (spec.tipo === "radial") {
    /* «elipse», no «círculo»: en CSS un círculo no admite tamaño en
       tanto por ciento (la regla entera se descarta y la muestra sale
       en blanco), y además el radial de SVG en unidades de la caja es
       justamente una elipse estirada con ella. */
    const r = fmt(radioDe(spec.cx, spec.cy) * 100);
    return `radial-gradient(ellipse ${r}% ${r}% at ${fmt(pct(spec.cx))}% ${fmt(pct(spec.cy))}%, ${paradas})`;
  }
  return `linear-gradient(${fmt((num(spec.ang, 0) + 90) % 360)}deg, ${paradas})`;
}

/* Cómo se llama la pintura en una línea, para la etiqueta de al lado de
   la muestra. */
export function etiquetaPaint(spec) {
  if (!spec) return "varios";
  if (spec.tipo === "none") return "sin color";
  if (spec.tipo === "solid") return spec.color;
  const n = normStops(spec.stops).length;
  return spec.tipo === "radial" ? `radial · ${n} colores` : `lineal ${Math.round(num(spec.ang, 0))}° · ${n} colores`;
}


/* ============================================================
   Lo de aquí abajo SÍ toca el documento: todo lo anterior es
   aritmética y se puede comprobar en Node sin navegador.
   ============================================================ */

/* Todas las referencias «url(#x)» de un valor, esté donde esté: el
   atributo `fill` las lleva al principio, pero un `style="fill:url(#x)"`
   importado las lleva en medio, y la recogida de basura no puede
   borrar un degradado que ese estilo sigue usando. */
function refsEn(value, out) {
  const re = /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(String(value || "")))) out.add(m[1]);
}

/* Ficha → valor que se escribe en `fill`/`stroke`. Un degradado deja de
   paso su definición en el <defs> del dibujo. */
export function paintValue(drawing, spec) {
  if (!spec || spec.tipo === "none") return "none";
  if (spec.tipo === "solid") return spec.color;
  const primero = normStops(spec.stops)[0].c;     // si algo falla, al menos un color
  if (!drawing) return primero;
  const defs = drawing.defs();
  if (!defs) return primero;
  const id = newId("grad");
  const { nodes } = textToNodes(gradMarkup(spec, id), { freshIds: false });
  if (!nodes.length) return primero;
  drawing.edit(() => defs.insert(childrenOf(defs).length, [nodes[0]]));
  return `url(#${id})`;
}

/* Ficha que describe lo que dice un atributo, mirando el <defs> si es
   una referencia. Devuelve null cuando apunta a algo que no sabemos
   leer (un patrón, por ejemplo): el panel lo enseña como «varios» en
   vez de fingir que es un color. */
export function readPaint(drawing, value) {
  const v = String(value == null ? "" : value).trim();
  if (!v || v === "none") return { tipo: "none" };
  const id = refId(v);
  if (!id) return { tipo: "solid", color: v };
  const g = gradById(drawing, id);
  return g ? gradSpec(g, childrenOf(g)) : null;
}

export function gradById(drawing, id) {
  const defs = drawing && drawing.defs();
  if (!defs) return null;
  for (const n of childrenOf(defs)) {
    if (isEl(n) && n.getAttribute("id") === id) return n;
  }
  return null;
}

/* Recoge los degradados NUESTROS que ya no usa nadie. Cada cambio de
   color crea uno nuevo, así que sin esto el <defs> crecería una entrada
   por tecleo. No se tocan los que venían dentro de un SVG importado: no
   llevan la marca y no son nuestros para borrarlos.

   `enUso` son valores que todavía no están en ninguna figura pero
   tampoco sobran: el color que espera la SIGUIENTE figura que se
   dibuje. Sin ellos, elegir un degradado sin nada seleccionado lo
   borraba en el mismo gesto y la figura nacía apuntando a un <defs>
   vacío, es decir, negra. */
export function gcGradients(drawing, enUso = []) {
  const defs = drawing && drawing.defs();
  if (!defs) return;
  const mios = childrenOf(defs).filter(n => isEl(n) && n.getAttribute(GRAD_MARK) != null);
  if (!mios.length) return;
  const usados = new Set();
  for (const v of [].concat(enUso)) refsEn(v, usados);
  const mirar = nodo => {
    if (!isEl(nodo)) return;
    const at = nodo.getAttributes ? nodo.getAttributes() : {};
    for (const k of Object.keys(at)) refsEn(at[k], usados);
    for (const kid of childrenOf(nodo)) mirar(kid);
  };
  mirar(drawing.root());
  const sobran = mios.filter(g => !usados.has(g.getAttribute("id")));
  if (!sobran.length) return;
  drawing.edit(() => {
    for (const g of sobran) {
      const at = indexOf(defs, g);
      if (at >= 0) defs.delete(at, 1);
    }
  });
}
