"use strict";
/* ============================================================
   ColabDraw — formas del trazo

   Los extremos y las uniones de una línea son tres módulos: aquí se
   crean las figuras (tools.js), aquí se cambian a lo que ya está
   dibujado (style.js) y aquí se eligen antes de dibujar
   (tool-options.js). Una sola tabla para los tres, porque el fallo que
   hubo fue justo el contrario: `stroke-linecap: "round"` escrito a mano
   dentro de tools.js, sin ningún control en ninguna parte que lo
   cambiara, así que TODAS las líneas salían redondeadas para siempre.

   Los valores por defecto son los de SVG, no los que apetezcan: si un
   dibujo no dice nada, el navegador pinta `butt` y `miter`, y el panel
   tiene que enseñar eso mismo o estaría mintiendo.
   ============================================================ */

export const DEFAULT_CAP = "butt";
export const DEFAULT_JOIN = "miter";

export const CAPS = [
  { label: "Plano", value: "butt", title: "El trazo acaba justo en el punto" },
  { label: "Redondo", value: "round", title: "Media circunferencia en cada punta" },
  { label: "Cuadrado", value: "square", title: "Un cuadradito de más en cada punta" }
];

export const JOINS = [
  { label: "En pico", value: "miter", title: "Las esquinas terminan en punta" },
  { label: "Redonda", value: "round", title: "Esquinas redondeadas" },
  { label: "Bisel", value: "bevel", title: "Esquinas cortadas en recto" }
];

/* Las etiquetas son el dibujo del guion, no su nombre: caben en la barra
   de la herramienta, que va sobre el lienzo y no puede robarle sitio. */
export const DASHES = [
  { label: "———", value: "", title: "Continua" },
  { label: "– – –", value: "3,2", title: "Guiones" },
  { label: "· · ·", value: "0.6,1.6", title: "Puntos" },
  { label: "–·–·", value: "4,1.5,0.8,1.5", title: "Raya y punto" }
];

/* Lo que se escribe en la figura: un valor que ya es el de SVG se deja
   SIN escribir, para no llenar el archivo de atributos que no cambian
   nada. Devuelve null, que es como `Drawing.add`/`setAttrs` entienden
   «quita este atributo». */
export const capAttr = v => (!v || v === DEFAULT_CAP ? null : v);
export const joinAttr = v => (!v || v === DEFAULT_JOIN ? null : v);
