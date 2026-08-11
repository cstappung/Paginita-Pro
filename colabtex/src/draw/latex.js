"use strict";
/* ============================================================
   ColabDraw — fórmulas LaTeX

   Una fórmula es un <g data-latex="…"> con los trazos que devuelve
   MathJax. NO es una imagen ni un texto: son <path> de verdad, así que
   se mueve, se gira, se pinta, se exporta a SVG y a PNG y entra en un
   PDF como cualquier otra figura. Y como el TeX original viaja en
   `data-latex`, la fórmula se puede volver a abrir y corregir — que es
   lo que no tendría una captura de pantalla pegada.

   Dos números que lo sostienen todo:

   - **1 em = 1000 unidades del viewBox** de MathJax (comprobado, no
     supuesto: `\rule{1em}{1em}` sale con viewBox de 1000×1000). Así que
     `scale(mm/1000)` deja la fórmula midiendo exactamente los
     milímetros que se piden, igual que el «Cuerpo» de un rótulo.
   - **La línea base cae en y=0**, porque el contenido de MathJax ya
     viene con su `scale(1,-1)`. Por eso basta un `translate(x,y)` para
     que la fórmula se apoye donde se pulsó, con el mismo criterio que
     la `x`/`y` de un <text>.

   El TAMAÑO no se guarda en ningún atributo: se lee del propio
   `transform`. Si se guardara, escalar la fórmula con los tiradores lo
   dejaría mintiendo, y el cuadro de edición enseñaría un número que no
   es el que se ve.
   ============================================================ */
import { parseTransform, matMul, matToString, matApply, scaleM, fmt } from "./geom.js";
import { textToNodes } from "./svgio.js";
import { indexOf, childrenOf, newId } from "./doc.js";

export const DEFAULT_TAM = 5;      // mm por «em», como DEFAULT_SIZE del texto

/* Dónde está el motor. Es un archivo APARTE (colabdraw-math.js, ~1,6 MB:
   MathJax con sus tipografías) que no entra en el paquete de la
   aplicación y solo se descarga la primera vez que alguien escribe una
   fórmula. draw-main le pone la misma versión que lleva la página, para
   que no se sirva de la caché una copia vieja. */
let URL_MOTOR = "colabdraw-math.js";
export function setMotorUrl(url) { if (url) URL_MOTOR = url; }

let cargando = null;

/* Carga el motor una sola vez. Varias llamadas a la vez comparten la
   misma promesa: la vista previa dispara una por tecla. */
export function cargarMotor() {
  if (window.ColabDrawMath) return Promise.resolve(window.ColabDrawMath);
  if (cargando) return cargando;
  cargando = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = URL_MOTOR;
    s.async = true;
    s.onload = () => {
      if (window.ColabDrawMath) resolve(window.ColabDrawMath);
      else reject(new Error("El motor de fórmulas se cargó pero no se registró."));
    };
    s.onerror = () => {
      cargando = null;      // si falló la red, que se pueda reintentar
      reject(new Error("No se pudo descargar el motor de fórmulas (colabdraw-math.js)."));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/* ---------- reconocer una fórmula ---------- */

export const esFormula = el =>
  !!el && el.nodeName === "g" && el.getAttribute && el.getAttribute("data-latex") != null;

export const latexDe = el => (esFormula(el) ? el.getAttribute("data-latex") || "" : "");

/* Milímetros por «em» que mide AHORA mismo, sacados de su transform:
   1000 unidades de MathJax son una em. Sirve igual si la han escalado o
   girado a mano, que es de lo que se trata. */
export function tamañoDe(el) {
  if (!esFormula(el)) return DEFAULT_TAM;
  const m = parseTransform(el.getAttribute("transform"));
  const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const mm = k * 1000;
  return mm > 0.01 ? Math.round(mm * 1000) / 1000 : DEFAULT_TAM;
}

/* ---------- construir el dibujo ---------- */

const parser = new DOMParser();

/* TeX → un <svg> del que solo interesa lo de dentro. Si MathJax no
   entiende algo no lanza: devuelve el error DIBUJADO en rojo dentro del
   propio SVG (`data-mjx-error`). Meter eso en el dibujo sería meter un
   cartel de error como si fuera una fórmula, así que se convierte en
   una excepción de verdad con el mensaje que trae. */
export async function renderSvg(tex) {
  const motor = await cargarMotor();
  const texto = String(tex || "").trim();
  if (!texto) throw new Error("La fórmula está vacía.");
  const bruto = motor.tex2svg(texto);
  const doc = parser.parseFromString(bruto, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length)
    throw new Error("El motor devolvió algo que no es un SVG.");
  const malo = svg.querySelector("[data-mjx-error]");
  if (malo) throw new Error(malo.getAttribute("data-mjx-error") || "La fórmula no compila.");
  return svg;
}

/* MathJax pinta con `currentColor`, que NO hereda del `fill` del padre
   sino de la propiedad `color`. Dejándolo, la fórmula salía siempre
   negra y el panel de relleno no la tocaba. Se le quitan esos dos
   atributos y entonces el color del grupo cae por herencia, que es como
   se pinta cualquier otra figura de aquí. */
function quitarCurrentColor(nodo) {
  for (const n of [nodo].concat(Array.from(nodo.querySelectorAll("*")))) {
    for (const at of ["fill", "stroke"]) {
      if ((n.getAttribute(at) || "").toLowerCase() === "currentcolor") n.removeAttribute(at);
    }
  }
}

/* El <g> completo, listo para insertarlo. Se construye con el DOM y no
   pegando cadenas: el TeX lleva comillas, `<` y `&` a puñados y
   escaparlos a mano es pedir un archivo roto. */
function envolver(svg, { tex, transform }) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-latex", tex);
  g.setAttribute("data-label", resumen(tex));
  if (transform) g.setAttribute("transform", transform);
  for (const kid of Array.from(svg.childNodes)) {
    const copia = kid.cloneNode(true);
    if (copia.nodeType === 1) quitarCurrentColor(copia);
    g.appendChild(copia);
  }
  return new XMLSerializer().serializeToString(g);
}

/* Nombre corto para el árbol de objetos: su propio LaTeX recortado. El
   panel enseña `data-label`, así que una fórmula se reconoce en la
   lista sin ir pinchando figuras. Sin ningún adorno delante: la fila ya
   lleva el icono ∑ y ponerlo también aquí lo enseñaba dos veces. */
export function resumen(tex) {
  const s = String(tex || "").replace(/\s+/g, " ").trim();
  return s.length > 28 ? s.slice(0, 27) + "…" : s;
}

/* Crea la fórmula en la capa indicada. `espacio` es lo que devuelve
   Tools._espacioDeCapa: sin él, una fórmula puesta en una capa
   importada aparecería en otro sitio y de otro tamaño, exactamente
   igual que le pasaba a las líneas. */
export async function insertar(drawing, capa, { tex, tam = DEFAULT_TAM, pt, fill, espacio = null }) {
  const svg = await renderSvg(tex);
  let punto = pt, escala = tam, extra = "";
  if (espacio) {
    if (espacio.mapear) { punto = matApply(espacio.inv, pt); escala = tam / espacio.escala; }
    else extra = espacio.tr + " ";
  }
  const marcado = envolver(svg, {
    tex,
    transform: `${extra}translate(${fmt(punto.x)},${fmt(punto.y)}) scale(${fmt(escala / 1000, 8)})`
  });
  const { nodes } = textToNodes(marcado);
  if (!nodes.length) throw new Error("La fórmula no se pudo convertir en figura.");
  // se puede ESCRIBIR en un nodo sin integrar; leerlo es lo que no vale.
  // El id no es adorno: la selección y el árbol de objetos van por él, y
  // reescribir la fórmula sustituye el nodo entero.
  nodes[0].setAttribute("id", newId("fx"));
  if (fill) nodes[0].setAttribute("fill", fill);
  const puestos = drawing.insertNodes(capa, nodes);
  return puestos[0] || null;
}

/* Reescribe una fórmula que ya está puesta. Se conserva su transform
   —puede haber sido movida, girada o escalada— y solo se corrige la
   escala si se ha pedido otro tamaño: T' = T · scale(nuevo/actual), que
   agranda alrededor de su propia línea base y funciona igual con la
   fórmula girada. */
export async function actualizar(drawing, el, { tex, tam }) {
  if (!esFormula(el)) return null;
  const svg = await renderSvg(tex);
  const actual = tamañoDe(el);
  const razon = tam && actual > 0 ? tam / actual : 1;
  const T = parseTransform(el.getAttribute("transform"));
  const T2 = razon === 1 ? T : matMul(T, scaleM(razon));

  /* El <g> se cambia ENTERO en vez de reescribirle los hijos: los
     trazos nuevos vienen sin integrar en el documento y de un nodo sin
     integrar no se puede leer nada, ni siquiera su lista de hijos. Es
     el mismo «clonar y borrar» que usan el orden Z y las capas. Se le
     pasan el id y el color del viejo para que la selección, el árbol de
     objetos y el aspecto sobrevivan al cambiazo. */
  const marcado = envolver(svg, { tex, transform: matToString(T2) });
  const { nodes } = textToNodes(marcado);
  const nuevo = nodes[0];
  if (!nuevo) throw new Error("La fórmula no se pudo convertir en figura.");
  nuevo.setAttribute("id", el.getAttribute("id") || newId("fx"));
  for (const at of ["fill", "opacity", "display", "data-locked"]) {
    const v = el.getAttribute(at);
    if (v != null) nuevo.setAttribute(at, String(v));
  }

  const padre = el.parent;
  if (!padre) return null;
  return drawing.edit(() => {
    const at = indexOf(padre, el);
    if (at < 0) return null;
    padre.delete(at, 1);
    padre.insert(at, [nuevo]);
    return childrenOf(padre)[at] || null;
  });
}

/* Atajos del cuadro de edición: lo que se escribe una y otra vez en el
   pie de una figura. El `|` marca dónde queda el cursor. */
export const ATAJOS = [
  { label: "x²", frag: "^{|}" },
  { label: "x₁", frag: "_{|}" },
  { label: "a/b", frag: "\\frac{|}{}" },
  { label: "√", frag: "\\sqrt{|}" },
  { label: "∑", frag: "\\sum_{|}^{}" },
  { label: "∫", frag: "\\int_{|}^{}" },
  { label: "α", frag: "\\alpha|" },
  { label: "→", frag: "\\rightarrow |" },
  { label: "±", frag: "\\pm |" },
  { label: "≤", frag: "\\le |" },
  { label: "×10ⁿ", frag: "\\times 10^{|}" },
  { label: "texto", frag: "\\text{|}" }
];
