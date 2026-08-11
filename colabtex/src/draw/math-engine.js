"use strict";
/* ============================================================
   ColabDraw — motor de fórmulas (paquete APARTE)

   Esto NO va dentro de colabdraw-app.js: es MathJax entero, y pesa más
   que el editor completo. Se compila a `colabdraw-math.js` y solo se
   descarga la primera vez que alguien escribe una fórmula (ver
   draw/latex.js). Quien nunca ponga una fórmula no lo baja nunca.

   Salida SVG y no HTML porque el resultado tiene que ser un dibujo:
   trazos de verdad que se puedan mover, pintar, exportar a SVG y a PNG
   y meter en un PDF. KaTeX —que ya está en el proyecto para ColabTeX—
   solo produce HTML posicionado con CSS, y eso dentro de un SVG exige
   un <foreignObject>, que es justo lo que el saneador tira (y con
   razón: es HTML ejecutable dentro del dibujo).

   `fontCache: "none"` dibuja cada signo como un <path> completo en vez
   de referenciar un <use> a unos <defs> compartidos. Ocupa algo más,
   pero cada fórmula es entonces AUTOSUFICIENTE: se copia, se pega, se
   duplica y se exporta suelta sin arrastrar definiciones ni chocar dos
   fórmulas por el mismo id.
   ============================================================ */
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
/* Los paquetes de TeX se piden UNO A UNO en vez de con AllPackages:
   aquello arrastra desde física hasta química y engorda el archivo un
   40 % para comandos que en el rótulo de una figura no se escriben
   jamás. Estos son los de las fórmulas de un artículo. */
import "mathjax-full/js/input/tex/base/BaseConfiguration.js";
import "mathjax-full/js/input/tex/ams/AmsConfiguration.js";
import "mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js";
import "mathjax-full/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "mathjax-full/js/input/tex/color/ColorConfiguration.js";
import "mathjax-full/js/input/tex/unicode/UnicodeConfiguration.js";

const PAQUETES = ["base", "ams", "boldsymbol", "newcommand", "textmacros", "color", "unicode"];

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

/* El documento se crea una vez: construirlo por fórmula volvería a
   cargar los paquetes de TeX en cada tecla de la vista previa. */
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: PAQUETES }),
  OutputJax: new SVG({ fontCache: "none" })
});

/* TeX → marcado <svg>. Lanza si la fórmula no compila; el mensaje es el
   de MathJax, que dice qué comando no existe y es lo único útil. */
function tex2svg(tex, { display = true } = {}) {
  const nodo = doc.convert(String(tex || ""), { display: !!display, em: 16, ex: 8 });
  const html = adaptor.innerHTML(adaptor.body(doc.document));
  // convert() devuelve un <mjx-container>; lo que sirve es el <svg> de dentro
  const svg = adaptor.outerHTML(nodo).match(/<svg[\s\S]*<\/svg>/);
  if (!svg) throw new Error("MathJax no devolvió ningún SVG.");
  void html;
  return svg[0];
}

window.ColabDrawMath = { tex2svg };
