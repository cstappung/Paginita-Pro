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
  /* Rótulo que todavía no existe: {pt, style, layer}. El <text> se crea al
     cerrar y solo si se escribió algo (ver Tools._createText). */
  let nuevo = null;

  const ta = document.createElement("textarea");
  ta.className = "dw-text-input";
  ta.spellcheck = false;
  ta.style.display = "none";
  canvas.host.appendChild(ta);

  /* ---------- barra de confirmar / descartar ----------

     Salir de la escritura era Esc, Ctrl+Intro o pinchar fuera, y
     ninguna de las tres se ve en ninguna parte: el informe lo decía tal
     cual («no hay cómo poner confirmar»). Con dos botones pegados a la
     caja, la salida se ve; los atajos siguen funcionando igual.

     El `pointerdown` se corta a propósito: si el <textarea> pierde el
     foco, su propio `blur` cierra el editor ANTES de que llegue el
     clic, y el botón acabaría pulsándose sobre algo que ya no existe
     —descartar habría guardado igual—. Cortándolo, el foco no se mueve
     y el clic llega entero. */
  const bar = document.createElement("div");
  bar.className = "dw-text-bar";
  bar.style.display = "none";
  for (const ev of ["pointerdown", "mousedown"]) bar.addEventListener(ev, e => e.preventDefault());

  const boton = (cls, texto, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dw-text-btn " + cls;
    b.textContent = texto;
    b.title = title;
    b.addEventListener("click", fn);
    bar.appendChild(b);
    return b;
  };
  boton("dw-text-ok", "✓ Listo", "Guardar el texto (Esc o Ctrl+Intro)", () => close());
  boton("dw-text-no", "✕", "Descartar los cambios", () => close({ guardar: false }));
  canvas.host.appendChild(bar);

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
  ta.addEventListener("blur", () => { if (target || nuevo) close(); });

  /* Dónde y con qué aspecto va la caja de escribir. La posición NO puede
     salir de los atributos x/y sin más: mover un rótulo se guarda en su
     `transform` (la x no se toca), y un SVG importado cuelga de una capa
     con `scale(...)`. Con solo x/y, el editor aparecía a 184 px del texto
     tras moverlo y a 674 px —fuera de la pantalla— en un archivo
     importado. La matriz de pantalla del propio nodo lo recoge todo:
     transform propio, capas de por medio, encuadre y zoom. */
  function place() {
    const spec = datos();
    if (!spec) return;
    const { x, y, fs, anchor, escala } = spec;
    const p = aPantalla(spec, x, y);
    const px = Math.max(9, fs * escala);
    const lineas = Math.max(1, ta.value.split("\n").length);

    ta.style.fontFamily = spec.family;
    ta.style.fontWeight = spec.weight;
    ta.style.fontStyle = spec.style;
    ta.style.fontSize = `${px}px`;
    ta.style.lineHeight = String(LINE_EM);
    ta.style.textAlign = anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";

    const box = target ? canvas.boxOf(target) : null;
    const ancho = Math.max(140, (box ? box.w * canvas.k : 0) + px * 2);
    ta.style.width = `${ancho}px`;
    ta.style.height = `${lineas * px * LINE_EM + 10}px`;
    // `y` es la línea BASE de la primera línea, no su borde de arriba
    const top = p.y - px * 0.85;
    const left = anchor === "middle" ? p.x - ancho / 2 : anchor === "end" ? p.x - ancho : p.x;
    ta.style.top = `${top}px`;
    ta.style.left = `${left}px`;

    /* La barra va encima de la caja; si ahí no cabe (un rótulo pegado al
       borde de arriba del lienzo), debajo. */
    const alto = lineas * px * LINE_EM + 10;
    bar.style.left = `${Math.max(2, left)}px`;
    bar.style.top = `${top - 28 > 2 ? top - 28 : top + alto + 6}px`;
  }

  const num = (v, porDefecto) => {
    const n = parseFloat(v);
    return isFinite(n) ? n : porDefecto;
  };

  /* Todo lo que place() necesita, venga de un <text> que ya existe o del
     rótulo que se está a punto de escribir. */
  function datos() {
    if (target) {
      const dom = canvas.yToDom ? canvas.yToDom.get(target) : null;
      const ctm = dom && dom.getScreenCTM ? dom.getScreenCTM() : null;
      return {
        dom, ctm,
        escala: ctm ? Math.hypot(ctm.a, ctm.b) || canvas.k : canvas.k,
        x: num(target.getAttribute("x"), 0),
        y: num(target.getAttribute("y"), 0),
        fs: num(target.getAttribute("font-size"), DEFAULT_SIZE),
        anchor: target.getAttribute("text-anchor") || "start",
        family: target.getAttribute("font-family") || DEFAULT_FONT,
        weight: target.getAttribute("font-weight") || "normal",
        style: target.getAttribute("font-style") || "normal"
      };
    }
    if (nuevo) {
      const st = nuevo.style || {};
      /* `pt` y el cuerpo de letra del rótulo pendiente vienen ya
         traducidos al espacio de SU CAPA (ver Tools._createText), que no
         es el del lienzo: para colocar la caja de escribir hacen falta
         los del documento, y esos viajan aparte en `vista`. */
      const v = nuevo.vista || null;
      return {
        dom: null, ctm: null, escala: canvas.k,
        x: v ? v.pt.x : nuevo.pt.x, y: v ? v.pt.y : nuevo.pt.y,
        fs: v ? v.fs : num(st["font-size"], DEFAULT_SIZE),
        anchor: st["text-anchor"] || "start",
        family: st["font-family"] || DEFAULT_FONT,
        weight: st["font-weight"] || "normal",
        style: st["font-style"] || "normal"
      };
    }
    return null;
  }

  /* Punto del espacio del texto → píxeles dentro del host del lienzo (que
     es donde flota el <textarea>). */
  function aPantalla(spec, x, y) {
    if (!spec.ctm) return canvas.toLocal({ x, y });
    const r = canvas.host.getBoundingClientRect();
    return {
      x: spec.ctm.a * x + spec.ctm.c * y + spec.ctm.e - r.left,
      y: spec.ctm.b * x + spec.ctm.d * y + spec.ctm.f - r.top
    };
  }

  function open(yEl) {
    if (!yEl || !canWrite()) return;
    if (target !== yEl || nuevo) close();
    nuevo = null;
    target = yEl;
    ta.value = readLines(yEl).join("\n");
    ta.style.display = "block";
    bar.style.display = "flex";
    place();
    ta.focus();
    ta.select();
  }

  /* Abre el editor para un rótulo que aún no existe. */
  function openNew(spec) {
    if (!spec || !spec.pt || !canWrite()) return;
    if (target || nuevo) close();
    target = null;
    nuevo = spec;
    ta.value = "";
    ta.style.display = "block";
    bar.style.display = "flex";
    place();
    ta.focus();
  }

  /* Cerrar guardando es lo normal (Esc, Ctrl+Intro, pinchar fuera o el
     botón ✓). Con `guardar: false` no se escribe nada: el rótulo nuevo
     no llega a existir y el que se estaba editando se queda como
     estaba. */
  function close({ guardar = true } = {}) {
    const el = target;
    const pend = nuevo;
    target = null; nuevo = null;   // antes de nada: el blur no debe reentrar
    ta.style.display = "none";
    bar.style.display = "none";
    if (!el && !pend) return;
    if (!guardar) { onDone(el || null); return; }
    const lines = ta.value.replace(/\r/g, "").split("\n");
    const vacio = !lines.some(l => l.trim());
    const d = getDrawing();
    let salida = vacio ? null : el;
    if (d) {
      if (pend) {
        // un rótulo en blanco sencillamente no llega a existir
        if (!vacio) {
          salida = d.edit(() => {
            const nel = addText(d, pend.layer || null, pend.pt, pend.style || {});
            if (nel) {
              // capa girada: el rótulo lleva la matriz de vuelta (ver
              // Tools._espacioDeCapa). Va dentro de la MISMA transacción
              // que su creación, o serían dos pasos de deshacer.
              if (pend.transform) nel.setAttribute("transform", pend.transform);
              writeLines(nel, lines);
            }
            return nel;
          });
        }
      } else if (vacio) {
        d.remove([el]);          // un texto sin texto no se ve ni se pincha
      } else {
        d.edit(() => writeLines(el, lines));
      }
    }
    onDone(salida || null);
  }

  return {
    open,
    openNew,
    close,
    isOpen: () => !!target || !!nuevo,
    target: () => target,
    reposition: place,
    destroy() {
      target = null; nuevo = null;
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
  };
}
