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
export const SOMBRA_MARK = "data-dw-shadow";
export const FLECHA_MARK = "data-dw-arrow";

/* Marcas de lo que ha puesto el editor en el <defs>. Solo esto se
   recoge cuando deja de usarse: un degradado o un filtro que venían
   dentro de un SVG importado no son nuestros para borrarlos. */
const MARCAS = [GRAD_MARK, SOMBRA_MARK, FLECHA_MARK];

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
   Sombras

   Una sombra es un `<filter>` con un solo `feDropShadow` en el <defs>,
   y `filter="url(#…)"` en la figura. Se eligió esa primitiva y no la
   receta larga (`feGaussianBlur` + `feOffset` + `feFlood` + `feMerge`)
   porque hace exactamente lo mismo en un nodo, la entienden todos los
   navegadores actuales y —lo que importa aquí— se vuelve a LEER sin
   tener que reconocer una cadena de cinco primitivas para saber qué
   desenfoque tenía.

   Los valores van en las unidades de la figura, que aquí son
   milímetros: `dx`, `dy` y `stdDeviation` se miden en el espacio de
   usuario (es lo que hace `primitiveUnits` por defecto), no en la caja.

   **La REGIÓN del filtro NO puede ir en tanto por ciento de la caja**, y
   ahí estaba el fallo de «a la línea le pongo sombra y desaparece». La
   caja de una línea horizontal mide 70 × 0: con `objectBoundingBox`,
   cualquier porcentaje de esa altura sigue siendo 0, la región queda
   vacía y el navegador no dibuja NADA — ni la sombra ni la línea (así lo
   manda la especificación y así se comprobó en Chrome: 0 píxeles de
   tinta). Le pasa a cualquier figura sin área: una línea o un trazado
   recto, vertical u horizontal, y un grupo que solo contenga eso.

   Por eso la región va en `userSpaceOnUse` y es fija y enorme. Tres
   cosas la hacen segura:

   - Se lee en el espacio del PROPIO elemento (comprobado: una figura con
     `transform="translate(60,0)"` se sale de una región escrita para su
     geometría sin desplazar y aun así se pinta entera). O sea que mover,
     girar o escalar con la matriz nunca la deja obsoleta.
   - Es lo bastante grande para cualquier dibujo y para las capas
     importadas, que traen su propia escala y numeran sus coordenadas en
     píxeles.
   - No cuesta nada: Chrome recorta la región a lo que se ve. Medido con
     40 figuras con sombra, la región gigante pinta igual de rápido que
     la de siempre (10,9 ms por cuadro contra 16,6).
   ============================================================ */

export const SOMBRA_POR_DEFECTO = { dx: 0.8, dy: 0.8, blur: 0.8, color: "#000000", op: 35 };

/* Media región, en unidades del elemento. Cien mil milímetros son cien
   metros: más que cualquier dibujo, y más que las coordenadas en píxeles
   de una figura importada dentro de una capa con escala. */
const REGION = 100000;

const REGION_ATTRS = `filterUnits="userSpaceOnUse" ` +
  `x="${-REGION}" y="${-REGION}" width="${REGION * 2}" height="${REGION * 2}"`;

export function sombraMarkup(spec, id) {
  const s = normSombra(spec);
  return `<filter id="${esc(id)}" ${SOMBRA_MARK}="1" ${REGION_ATTRS}>` +
    `<feDropShadow dx="${fmt(s.dx)}" dy="${fmt(s.dy)}" stdDeviation="${fmt(s.blur)}" ` +
    `flood-color="${esc(s.color)}" flood-opacity="${fmt(s.op / 100)}"/></filter>`;
}

/* Los dibujos hechos antes de esto llevan filtros con la región en
   porcentaje, o sea con las líneas invisibles. Arreglarlos al abrir
   cuesta una transacción y evita que haya que desmarcar y volver a
   marcar «Con sombra» en cada figura — sabiendo que la figura que hay
   que buscar para eso no se ve.

   Va con origen propio para que no ocupe un paso de deshacer: el primer
   Ctrl+Z tiene que deshacer lo que ha hecho quien dibuja, no una
   reparación que no ha pedido. */
export function repararSombras(drawing) {
  const raiz = drawing && !drawing.readOnly && drawing.root();
  if (!raiz) return 0;
  /* El <defs> que YA haya, sin crearlo: `drawing.defs()` lo añade cuando
     falta, y esto se llama al abrir cada dibujo — un dibujo importado sin
     <defs> se habría encontrado con una escritura, y con un paso de
     deshacer, sin que nadie hubiera tocado nada. */
  const defs = childrenOf(raiz).find(n => isEl(n) && n.nodeName === "defs");
  if (!defs) return 0;
  const viejos = childrenOf(defs).filter(n =>
    isEl(n) && n.getAttribute(SOMBRA_MARK) != null &&
    n.getAttribute("filterUnits") !== "userSpaceOnUse");
  if (!viejos.length) return 0;
  drawing.edit(() => {
    for (const f of viejos) {
      f.setAttribute("filterUnits", "userSpaceOnUse");
      f.setAttribute("x", String(-REGION));
      f.setAttribute("y", String(-REGION));
      f.setAttribute("width", String(REGION * 2));
      f.setAttribute("height", String(REGION * 2));
    }
  }, "reparar");
  return viejos.length;
}

export function normSombra(spec) {
  const s = spec || {};
  const lim = (v, d, max) => {
    const n = parseFloat(v);
    return isFinite(n) ? Math.max(-max, Math.min(n, max)) : d;
  };
  return {
    dx: lim(s.dx, SOMBRA_POR_DEFECTO.dx, 40),
    dy: lim(s.dy, SOMBRA_POR_DEFECTO.dy, 40),
    blur: Math.max(0, lim(s.blur, SOMBRA_POR_DEFECTO.blur, 40)),
    color: /^#[0-9a-f]{6}$/i.test(String(s.color || "")) ? String(s.color) : SOMBRA_POR_DEFECTO.color,
    op: Math.max(0, Math.min(100, lim(s.op, SOMBRA_POR_DEFECTO.op, 100)))
  };
}

/* Ficha de un `<filter>` NUESTRO. Devuelve null para cualquier otro
   filtro: uno importado puede ser un desenfoque, un mapa de color o
   media docena de primitivas encadenadas, y enseñarlo como si fuera
   una sombra invitaría a machacarlo sin saberlo. */
export function sombraSpec(el, hijos) {
  if (!el || !el.getAttribute) return null;
  if (String(el.nodeName || "").toLowerCase() !== "filter") return null;
  if (el.getAttribute(SOMBRA_MARK) == null) return null;
  const fe = (hijos || []).find(n => String(n.nodeName || "").toLowerCase() === "fedropshadow");
  if (!fe) return null;
  return normSombra({
    dx: fe.getAttribute("dx"),
    dy: fe.getAttribute("dy"),
    blur: fe.getAttribute("stdDeviation"),
    color: fe.getAttribute("flood-color"),
    op: num(fe.getAttribute("flood-opacity"), 1) * 100
  });
}

/* ============================================================
   Puntas de flecha

   Una flecha es una línea con `marker-start` / `marker-end` apuntando a
   un `<marker>` del <defs>. Tres decisiones:

   - **Un solo marcador por dibujo.** La punta no tiene ajustes que
     valga la pena inventar: `markerUnits="strokeWidth"` la hace crecer
     con el grosor de la línea y `context-stroke` la pinta del color del
     trazo, así que dos flechas distintas siguen necesitando la MISMA
     definición. Una por línea habría llenado el <defs> de copias
     idénticas.
   - **`orient="auto-start-reverse"`**, que es lo que hace que la punta
     del principio mire hacia fuera. Con el `auto` de toda la vida, la
     flecha del extremo inicial apuntaba hacia dentro de la línea.
   - **`context-stroke`** en vez de un color escrito: si se guardara el
     color, cambiar el del trazo dejaría la punta del color de antes, y
     habría que reescribir el <defs> desde el panel de estilo.
   ============================================================ */

export const PUNTAS = [
  { value: "", label: "Sin punta" },
  { value: "end", label: "Flecha al final" },
  { value: "start", label: "Flecha al principio" },
  { value: "both", label: "Flecha en los dos" }
];

/* Los dos atributos de la punta, y a qué figuras se les ponen.

   Solo a las ABIERTAS. En un rectángulo o en un rótulo el atributo no
   pinta nada y se queda ahí de adorno; en un polígono sí pinta —SVG
   coloca la punta en el primer y el último vértice— y aparece una
   flecha suelta en una esquina de la figura, que es peor que nada.
   Como el color y el grosor pasan por el mismo camino que las puntas
   (`Tools.applyStyle`), sin esta lista elegir «flecha» con un polígono
   todavía seleccionado se lo marcaba a él. */
export const PUNTA_ATTRS = ["marker-start", "marker-end"];
const MARCABLES = new Set(["line", "polyline", "path"]);
export const esMarcable = el => !!el && MARCABLES.has(el.nodeName);

export function flechaMarkup(id) {
  return `<marker id="${esc(id)}" ${FLECHA_MARK}="1" viewBox="0 0 10 10" ` +
    `refX="9" refY="5" markerWidth="6" markerHeight="6" ` +
    `markerUnits="strokeWidth" orient="auto-start-reverse">` +
    `<path d="M0 0 L10 5 L0 10 z" fill="context-stroke"/></marker>`;
}

/* Qué punta tiene una figura, leído de sus dos atributos. */
export function readArrow(inicio, fin) {
  const hay = v => !!refId(v);
  const a = hay(inicio), b = hay(fin);
  if (a && b) return "both";
  if (b) return "end";
  if (a) return "start";
  return "";
}

/* Los dos atributos que hay que escribir para un modo dado. `ref` es lo
   que devuelve `flechaRef`. */
export function atributosPunta(modo, ref) {
  const usa = lado => (modo === lado || modo === "both") && ref ? ref : null;
  return { "marker-start": usa("start"), "marker-end": usa("end") };
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

/* Mete un marcado en el <defs> del dibujo y devuelve su «url(#…)», o
   null si no se pudo. Es el camino común del degradado y de la sombra:
   los dos son una definición con nombre a la que apunta la figura. */
function ponerEnDefs(drawing, marcado, id) {
  const defs = drawing && drawing.defs();
  if (!defs) return null;
  const { nodes } = textToNodes(marcado, { freshIds: false });
  if (!nodes.length) return null;
  drawing.edit(() => defs.insert(childrenOf(defs).length, [nodes[0]]));
  return `url(#${id})`;
}

/* Ficha → valor que se escribe en `fill`/`stroke`. Un degradado deja de
   paso su definición en el <defs> del dibujo. */
export function paintValue(drawing, spec) {
  if (!spec || spec.tipo === "none") return "none";
  if (spec.tipo === "solid") return spec.color;
  const id = newId("grad");
  // si algo falla, al menos el primer color: mejor eso que dejarla negra
  return ponerEnDefs(drawing, gradMarkup(spec, id), id) || normStops(spec.stops)[0].c;
}

/* Ficha de sombra → valor de `filter`. Sin ficha, «none», que es lo que
   quita la sombra sin dejar el atributo apuntando a un filtro vacío. */
export function shadowValue(drawing, spec) {
  if (!spec) return null;
  const id = newId("som");
  return ponerEnDefs(drawing, sombraMarkup(spec, id), id);
}

/* Lo que dice un `filter`: la ficha si es una sombra nuestra, null si no
   hay filtro, y la cadena «ajeno» si el archivo trae uno suyo — que no
   es lo mismo y el panel tiene que poder decirlo. */
export function readShadow(drawing, value) {
  const v = String(value == null ? "" : value).trim();
  if (!v || v === "none") return null;
  const id = refId(v);
  if (!id) return "ajeno";
  const f = defById(drawing, id);
  if (!f) return "ajeno";
  return sombraSpec(f, childrenOf(f)) || "ajeno";
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
  const g = defById(drawing, id);
  return g ? gradSpec(g, childrenOf(g)) : null;
}

/* El marcador de flecha del dibujo, creándolo la primera vez. Se
   REUTILIZA el que ya haya: ver el porqué arriba. */
export function flechaRef(drawing) {
  const defs = drawing && drawing.defs();
  if (!defs) return null;
  for (const n of childrenOf(defs)) {
    if (isEl(n) && n.getAttribute(FLECHA_MARK) != null) {
      const id = n.getAttribute("id");
      if (id) return `url(#${id})`;
    }
  }
  const id = newId("fle");
  return ponerEnDefs(drawing, flechaMarkup(id), id);
}

export function defById(drawing, id) {
  const defs = drawing && drawing.defs();
  if (!defs) return null;
  for (const n of childrenOf(defs)) {
    if (isEl(n) && n.getAttribute("id") === id) return n;
  }
  return null;
}

/* Recoge las definiciones NUESTRAS (degradados y sombras) que ya no
   usa nadie. Cada cambio de
   color crea uno nuevo, así que sin esto el <defs> crecería una entrada
   por tecleo. No se tocan los que venían dentro de un SVG importado: no
   llevan la marca y no son nuestros para borrarlos.

   `enUso` son valores que todavía no están en ninguna figura pero
   tampoco sobran: el color que espera la SIGUIENTE figura que se
   dibuje. Sin ellos, elegir un degradado sin nada seleccionado lo
   borraba en el mismo gesto y la figura nacía apuntando a un <defs>
   vacío, es decir, negra. */
export function gcDefs(drawing, enUso = []) {
  const defs = drawing && drawing.defs();
  if (!defs) return;
  const mios = childrenOf(defs).filter(n => isEl(n) && MARCAS.some(m => n.getAttribute(m) != null));
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
