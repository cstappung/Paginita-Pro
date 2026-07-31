"use strict";
/* ============================================================
   ColabDraw — texto

   Un texto es un <text> con un <tspan> por línea. Cada tspan repite la
   `x` del <text> (si no, las líneas se escalonan una detrás de otra: en
   SVG el texto no vuelve solo al margen) y baja con `dy` en **em**, no
   en milímetros, para que cambiar el cuerpo de letra no descoloque el
   interlineado.

   Se escribe en el documento AL CERRAR el editor, no a cada tecla:
   misma regla que el arrastre. Cada escritura en Yjs es un envío a
   Realtime Database y un paso de deshacer, y teclear una frase serían
   cuarenta de cada.
   ============================================================ */
import * as Y from "yjs";
import { fmt } from "./geom.js";

export const DEFAULT_FONT = "sans-serif";
export const DEFAULT_SIZE = 5;      // mm ≈ 14 pt, un pie de figura normal
export const LINE_EM = 1.2;

/* Solo las tres familias genéricas. No es pereza: al exportar a PDF sin
   incrustar tipografías únicamente existen las catorce fuentes estándar,
   y estas tres son las que tienen equivalente seguro (Helvetica, Times y
   Courier). Con cualquier otra, el PDF no se parecería a la pantalla. */
export const FONTS = [
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" }
];

export const TEXT_ATTRS = new Set([
  "font-family", "font-size", "font-weight", "font-style", "text-anchor"
]);

export const isText = el => !!el && el.nodeName === "text";

/* ---------- contenido ---------- */

/* Cuántas líneas baja un dy. Una línea en blanco no se guarda como un
   tspan vacío (un tspan sin caracteres no desplaza nada), sino como un
   dy doble en la siguiente. */
export function dyToLines(dy) {
  if (dy == null || dy === "") return 0;
  const em = String(dy).trim().match(/^([-+]?[\d.]+)\s*em$/i);
  const n = em ? parseFloat(em[1]) : parseFloat(dy);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round((em ? n : n / DEFAULT_SIZE) / LINE_EM));
}

function plainText(node) {
  let s = "";
  for (const k of (node && node.toArray ? node.toArray() : [])) {
    if (k instanceof Y.XmlText) s += k.toString();
    else if (k instanceof Y.XmlElement) s += plainText(k);
  }
  return s;
}

/* El texto de un <text> como líneas sueltas, listo para el editor. */
export function readLines(yText) {
  if (!yText) return [];
  const kids = yText.toArray ? yText.toArray() : [];
  const spans = kids.filter(k => k instanceof Y.XmlElement && k.nodeName === "tspan");
  if (!spans.length) return [plainText(yText)];
  const out = [];
  spans.forEach((sp, i) => {
    const salto = i === 0 ? 1 : Math.max(1, dyToLines(sp.getAttribute("dy")));
    for (let n = 1; n < salto; n++) out.push("");
    out.push(plainText(sp));
  });
  return out;
}

/* Reescribe el contenido del <text>. Debe llamarse dentro de un
   Drawing.edit(): toca varios nodos y tiene que ser una transacción. */
export function writeLines(yText, lines) {
  if (!yText) return;
  const x = yText.getAttribute("x") || "0";
  if (yText.length) yText.delete(0, yText.length);
  const spans = [];
  let saltos = 0;
  for (const line of lines) {
    if (!line) { saltos++; continue; }
    const sp = new Y.XmlElement("tspan");
    sp.setAttribute("x", x);
    if (spans.length) sp.setAttribute("dy", `${fmt(LINE_EM * (1 + saltos), 3)}em`);
    const t = new Y.XmlText();
    t.insert(0, line);
    sp.insert(0, [t]);
    spans.push(sp);
    saltos = 0;
  }
  if (spans.length) yText.insert(0, spans);
}

/* Crea un <text> vacío en la capa indicada. Sale sin contenido a
   propósito: lo pone el editor, que se abre justo encima. */
export function addText(drawing, layer, pt, style = {}) {
  if (!drawing) return null;
  return drawing.add(layer, "text", {
    x: fmt(pt.x), y: fmt(pt.y),
    "font-family": style["font-family"] || DEFAULT_FONT,
    "font-size": fmt(style["font-size"] || DEFAULT_SIZE),
    "font-weight": style["font-weight"] || null,
    "font-style": style["font-style"] || null,
    "text-anchor": style["text-anchor"] || null,
    fill: style.fill || "#1f2933"
  });
}

/* ---------- editor ----------

   Un <textarea> colocado encima del lienzo, no edición dentro del SVG:
   contentEditable sobre un <text> depende del navegador, no sabe de
   selección ni de acentos muertos, y encima habría que traducir cada
   pulsación a tspans. Así se escribe en una caja de texto de verdad y
   el documento recibe el resultado. */
export function createTextEditor(canvas, ctx = {}) {
  const getDrawing = ctx.getDrawing || (() => null);
  const canWrite = ctx.canWrite || (() => true);
  const onDone = ctx.onDone || (() => {});

  let target = null;

  const ta = document.createElement("textarea");
  ta.className = "dw-text-input";
  ta.spellcheck = false;
  ta.style.display = "none";
  canvas.host.appendChild(ta);

  /* Los atajos del lienzo (Supr, flechas, S/R/E/L…) no deben llegar
     mientras se escribe. Tools ya ignora los eventos que vienen de un
     TEXTAREA, pero cortarlos aquí lo deja fuera de toda duda. */
  ta.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      close();
    }
  });
  ta.addEventListener("input", place);
  ta.addEventListener("blur", () => { if (target) close(); });

  function place() {
    if (!target) return;
    const fs = parseFloat(target.getAttribute("font-size")) || DEFAULT_SIZE;
    const x = parseFloat(target.getAttribute("x")) || 0;
    const y = parseFloat(target.getAttribute("y")) || 0;
    const p = canvas.toLocal({ x, y });
    const px = Math.max(9, fs * canvas.k);
    const lineas = Math.max(1, ta.value.split("\n").length);
    const anchor = target.getAttribute("text-anchor");

    ta.style.fontFamily = target.getAttribute("font-family") || DEFAULT_FONT;
    ta.style.fontWeight = target.getAttribute("font-weight") || "normal";
    ta.style.fontStyle = target.getAttribute("font-style") || "normal";
    ta.style.fontSize = `${px}px`;
    ta.style.lineHeight = String(LINE_EM);
    ta.style.textAlign = anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";

    const box = canvas.boxOf(target);
    const ancho = Math.max(140, (box ? box.w * canvas.k : 0) + px * 2);
    ta.style.width = `${ancho}px`;
    ta.style.height = `${lineas * px * LINE_EM + 10}px`;
    // `y` es la línea BASE de la primera línea, no su borde de arriba
    ta.style.top = `${p.y - px * 0.85}px`;
    ta.style.left = `${anchor === "middle" ? p.x - ancho / 2 : anchor === "end" ? p.x - ancho : p.x}px`;
  }

  function open(yEl) {
    if (!yEl || !canWrite()) return;
    if (target && target !== yEl) close();
    target = yEl;
    ta.value = readLines(yEl).join("\n");
    ta.style.display = "block";
    place();
    ta.focus();
    ta.select();
  }

  function close() {
    const el = target;
    target = null;              // antes de nada: el blur no debe reentrar
    ta.style.display = "none";
    if (!el) return;
    const lines = ta.value.replace(/\r/g, "").split("\n");
    const vacio = !lines.some(l => l.trim());
    const d = getDrawing();
    if (d) {
      // un texto sin texto no se ve ni se puede volver a pinchar
      if (vacio) d.remove([el]);
      else d.edit(() => writeLines(el, lines));
    }
    onDone(vacio ? null : el);
  }

  return {
    open,
    close,
    isOpen: () => !!target,
    target: () => target,
    reposition: place,
    destroy() { target = null; if (ta.parentNode) ta.parentNode.removeChild(ta); }
  };
}
