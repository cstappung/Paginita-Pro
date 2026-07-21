"use strict";
/* ============================================================
   Modo «Visual»: muestra el LaTeX ya representado mientras se
   edita — fórmulas con KaTeX, títulos con su tamaño real,
   negritas/cursivas aplicadas — igual que el editor visual de
   Overleaf.

   Idea clave (patrón «conceal» de CodeMirror): NO se modifica el
   documento, solo se DECORA. El texto fuente sigue intacto, así
   que Yjs, el guardado y la compilación no se enteran de nada.
   Cuando el cursor entra en un fragmento decorado, la decoración
   se retira y reaparece el código para poder editarlo.

   KaTeX se carga bajo demanda (vendor/katex) para no engordar el
   bundle de quien nunca use esta vista.
   ============================================================ */
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";

const KATEX_DIR = "vendor/katex/";
let katexPromise = null;

/* Carga KaTeX (JS + CSS) una sola vez. */
export function loadKatex() {
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve, reject) => {
    if (window.katex) return resolve(window.katex);
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = KATEX_DIR + "katex.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = KATEX_DIR + "katex.min.js";
    s.onload = () => resolve(window.katex);
    s.onerror = () => reject(new Error("No se pudo cargar KaTeX"));
    document.head.appendChild(s);
  });
  return katexPromise;
}

/* ---------- widget de fórmula ---------- */
class MathWidget extends WidgetType {
  constructor(tex, display) { super(); this.tex = tex; this.display = display; }
  eq(o) { return o.tex === this.tex && o.display === this.display; }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-mathWidget" + (this.display ? " cm-mathDisplay" : "");
    try {
      window.katex.render(this.tex, span, {
        displayMode: this.display,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: { "\\bm": "\\boldsymbol", "\\uni": "\\mathrm", "\\mn": "\\boldsymbol" }
      });
    } catch (e) {
      // fórmula que KaTeX no entiende: mostrar el fuente en rojo, no romper
      span.textContent = this.tex;
      span.classList.add("cm-mathError");
    }
    return span;
  }
  ignoreEvent() { return false; }
}

/* widget genérico de texto (viñetas, reglas…) */
class TextWidget extends WidgetType {
  constructor(text, cls) { super(); this.text = text; this.cls = cls || ""; }
  eq(o) { return o.text === this.text && o.cls === this.cls; }
  toDOM() {
    const s = document.createElement("span");
    s.className = this.cls;
    s.textContent = this.text;
    return s;
  }
}

/* ---------- reglas ----------
   Cada regla localiza un patrón y decide qué ocultar y qué destacar.
   `cmd` = \nombre{contenido}: se ocultan «\nombre{» y «}» y se aplica
   una clase al contenido.                                            */
const CMD_STYLES = [
  { re: /\\chapter\*?\s*\{/g, cls: "cm-vChapter" },
  { re: /\\section\*?\s*\{/g, cls: "cm-vSection" },
  { re: /\\subsection\*?\s*\{/g, cls: "cm-vSubsection" },
  { re: /\\subsubsection\*?\s*\{/g, cls: "cm-vSubsubsection" },
  { re: /\\title\s*\{/g, cls: "cm-vTitle" },
  { re: /\\textbf\s*\{/g, cls: "cm-vBold" },
  { re: /\\textit\s*\{/g, cls: "cm-vItalic" },
  { re: /\\emph\s*\{/g, cls: "cm-vItalic" },
  { re: /\\underline\s*\{/g, cls: "cm-vUnderline" },
  { re: /\\texttt\s*\{/g, cls: "cm-vMono" }
];

/* entornos matemáticos que se representan como bloque */
const MATH_ENVS = ["equation", "equation*", "align", "align*", "gather", "gather*",
  "multline", "multline*", "eqnarray", "eqnarray*", "displaymath"];

/* Busca la llave que cierra la abierta en `open` (índice de «{»). */
function closingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") { i++; continue; }           // \{ escapada
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (!depth) return i; }
  }
  return -1;
}

/* ¿el cursor está dentro (o pegado) al rango? → mostrar el fuente */
function cursorTouches(state, from, to) {
  for (const r of state.selection.ranges)
    if (r.from <= to && r.to >= from) return true;
  return false;
}

function buildDecorations(state) {
  const b = [];
  const doc = state.doc;
  const text = doc.toString();
  const ready = !!window.katex;

  const hide = (from, to) => { if (to > from) b.push({ from, to, deco: Decoration.replace({}) }); };
  const mark = (from, to, cls) => { if (to > from) b.push({ from, to, deco: Decoration.mark({ class: cls }) }); };

  /* -- 1. comandos con un argumento -- */
  for (const rule of CMD_STYLES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      const open = m.index + m[0].length - 1;
      const close = closingBrace(text, open);
      if (close < 0) continue;
      if (cursorTouches(state, m.index, close + 1)) continue;
      hide(m.index, open + 1);
      mark(open + 1, close, rule.cls);
      hide(close, close + 1);
    }
  }

  /* -- 2. matemáticas en línea: $...$ y \(...\) -- */
  if (ready) {
    const inline = /(?<!\\)\$([^$\n]+?)(?<!\\)\$|\\\(([\s\S]*?)\\\)/g;
    let m;
    while ((m = inline.exec(text))) {
      const tex = m[1] !== undefined ? m[1] : m[2];
      if (!tex || !tex.trim()) continue;
      const from = m.index, to = m.index + m[0].length;
      if (cursorTouches(state, from, to)) continue;
      b.push({ from, to, deco: Decoration.replace({ widget: new MathWidget(tex, false) }) });
    }

    /* -- 3. matemáticas en bloque: \[...\] y entornos -- */
    const dollars = /\\\[([\s\S]*?)\\\]/g;
    while ((m = dollars.exec(text))) {
      const from = m.index, to = m.index + m[0].length;
      if (cursorTouches(state, from, to)) continue;
      b.push({ from, to, deco: Decoration.replace({ widget: new MathWidget(m[1], true), block: false }) });
    }

    for (const env of MATH_ENVS) {
      const esc = env.replace(/\*/g, "\\*");
      const re = new RegExp("\\\\begin\\{" + esc + "\\}([\\s\\S]*?)\\\\end\\{" + esc + "\\}", "g");
      while ((m = re.exec(text))) {
        const from = m.index, to = m.index + m[0].length;
        if (cursorTouches(state, from, to)) continue;
        // se conserva el entorno para que KaTeX numere/alinee igual
        const body = env.startsWith("equation") ? m[1] : m[0];
        b.push({ from, to, deco: Decoration.replace({ widget: new MathWidget(body, true) }) });
      }
    }
  }

  /* -- 4. \item → viñeta -- */
  const items = /^([ \t]*)\\item\b[ \t]*/gm;
  let m2;
  while ((m2 = items.exec(text))) {
    const from = m2.index + m2[1].length, to = m2.index + m2[0].length;
    if (cursorTouches(state, from, to)) continue;
    b.push({ from, to, deco: Decoration.replace({ widget: new TextWidget("• ", "cm-vBullet") }) });
  }

  /* -- 5. \begin/\end de entornos no matemáticos: atenuar -- */
  const envLine = /^[ \t]*\\(?:begin|end)\{[^}]+\}(?:\[[^\]]*\]|\{[^}]*\})*[ \t]*$/gm;
  while ((m2 = envLine.exec(text))) {
    const from = m2.index, to = m2.index + m2[0].length;
    if (cursorTouches(state, from, to)) continue;
    mark(from, to, "cm-vEnvLine");
  }

  /* CodeMirror exige los rangos ordenados; además hay que descartar los
     solapados (p. ej. un \textbf dentro de una fórmula ya sustituida). */
  b.sort((x, y) => x.from - y.from || y.to - x.to);
  const builder = new RangeSetBuilder();
  let last = -1;
  for (const r of b) {
    if (r.from < last) continue;              // se solapa con uno ya emitido
    builder.add(r.from, r.to, r.deco);
    if (r.deco.spec && r.deco.spec.widget !== undefined) last = r.to;
    else last = Math.max(last, r.from);       // las marcas sí pueden anidarse
  }
  return builder.finish();
}

/* Las decoraciones van en un StateField, no en un ViewPlugin: una fórmula
   en bloque (\[…\], equation, align…) abarca varias líneas, y CodeMirror
   prohíbe que un plugin sustituya rangos que cruzan saltos de línea
   («Decorations that replace line breaks may not be specified via plugins»).
   Un campo de estado sí puede, a cambio de recalcular sobre todo el
   documento en vez de solo el viewport. */
const visualField = StateField.define({
  create: state => buildDecorations(state),
  update(deco, tr) {
    if (!tr.docChanged && !tr.selection) return deco;
    return buildDecorations(tr.state);
  },
  provide: f => EditorView.decorations.from(f)
});

/* Estilos del modo visual (van dentro del editor, no en el CSS global) */
const visualTheme = EditorView.theme({
  ".cm-vChapter": { fontSize: "1.8em", fontWeight: "700", lineHeight: "1.35" },
  ".cm-vTitle": { fontSize: "1.7em", fontWeight: "700", lineHeight: "1.35" },
  ".cm-vSection": { fontSize: "1.45em", fontWeight: "700", lineHeight: "1.4" },
  ".cm-vSubsection": { fontSize: "1.22em", fontWeight: "600", lineHeight: "1.45" },
  ".cm-vSubsubsection": { fontSize: "1.08em", fontWeight: "600" },
  ".cm-vBold": { fontWeight: "700" },
  ".cm-vItalic": { fontStyle: "italic" },
  ".cm-vUnderline": { textDecoration: "underline" },
  ".cm-vMono": { fontFamily: "'IBM Plex Mono',monospace" },
  ".cm-vBullet": { opacity: "0.75" },
  ".cm-vEnvLine": { opacity: "0.42", fontSize: "0.92em" },
  ".cm-mathWidget": { padding: "0 1px" },
  ".cm-mathDisplay": { display: "block", textAlign: "center", margin: "0.4em 0" },
  ".cm-mathError": { color: "#e57373", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.95em" },
  ".cm-content": { fontFamily: "'IBM Plex Sans',sans-serif" },
  ".cm-line": { lineHeight: "1.75" }
});

export function visualExtensions() {
  return [visualField, visualTheme];
}
