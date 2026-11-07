"use strict";
/* ============================================================
   Ayudas de escritura del editor LaTeX:

   - Autocompletado: comandos tras «\», entornos tras «\begin{» (y su
     \end{…} se escribe solo), etiquetas tras «\ref{» y compañía, y claves
     de bibliografía tras «\cite{» (también después de una coma).
   - Esquema: las secciones de un archivo, para saltar a ellas.
   - Contador de palabras aproximado, sin comandos ni fórmulas.

   Las etiquetas y las claves se leen de TODOS los archivos de texto del
   proyecto (cada \label de cada .tex, cada @tipo{clave, de cada .bib),
   porque un capítulo cita lo que está en otro. La parte de arriba es
   aritmética pura (se prueba desde Node); solo `texCompletion` toca
   CodeMirror.
   ============================================================ */
import { autocompletion, snippetCompletion } from "@codemirror/autocomplete";

/* ---------- extracción (pura) ---------- */

const sinComentarios = t => String(t || "").replace(/(^|[^\\])%.*$/gm, "$1");

export function etiquetasDe(textos) {
  const out = new Set();
  for (const t of textos) for (const m of sinComentarios(t).matchAll(/\\label\s*\{([^}]+)\}/g)) out.add(m[1].trim());
  return [...out].sort();
}

export function clavesBib(textos) {
  const out = new Map();
  for (const t of textos) {
    const re = /@(\w+)\s*[{(]\s*([^,\s{}()]+)\s*,/g;
    let m;
    while ((m = re.exec(t))) {
      const tipo = m[1].toLowerCase();
      if (tipo === "comment" || tipo === "string" || tipo === "preamble") continue;
      // el título, si lo hay, sirve de pista en la lista
      const resto = t.slice(m.index, m.index + 1500);
      const titulo = /\btitle\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)")/i.exec(resto);
      const limpio = titulo ? (titulo[1] || titulo[2] || "").replace(/\\[a-zA-Z]+\s*/g, m => m.trim().slice(1)).replace(/[{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 90) : "";
      out.set(m[2], { tipo, titulo: limpio });
    }
  }
  return out;
}

const NIVELES = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5 };
export function esquemaDe(texto) {
  const out = [];
  const lineas = String(texto || "").split("\n");
  for (let i = 0; i < lineas.length; i++) {
    const l = sinComentarios(lineas[i]);
    const m = /\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[^\]]*\])?\s*\{(.*)/.exec(l);
    if (!m) continue;
    // el título hasta la llave que lo cierra (admite llaves dentro)
    let prof = 1, t = "";
    for (const c of m[2]) {
      if (c === "{") prof++;
      else if (c === "}" && !--prof) break;
      t += c;
    }
    out.push({ nivel: NIVELES[m[1]], tipo: m[1], titulo: t.replace(/\\[a-zA-Z]+\*?\s*/g, "").replace(/[{}$]/g, "").trim() || "(sin título)", linea: i + 1 });
  }
  return out;
}

/* Palabras del texto, sin preámbulo, comentarios, comandos ni fórmulas.
   Aproximado a propósito —como el de Overleaf—: sirve para saber si un
   resumen se pasa de 250, no para un recuento legal. */
export function contarPalabras(texto) {
  let t = sinComentarios(texto);
  const ini = t.search(/\\begin\s*\{document\}/);
  if (ini >= 0) t = t.slice(ini + 16);
  t = t.replace(/\\end\s*\{document\}[\s\S]*$/, "")
    .replace(/\\begin\s*\{(equation|align|gather|multline|eqnarray|displaymath|math|tikzpicture|figure|table|lstlisting|verbatim)\*?\}[\s\S]*?\\end\s*\{\1\*?\}/g, " ")
    .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, " ")
    .replace(/\\(?:label|ref|eqref|cite\w*|includegraphics|input|include|usepackage|begin|end|url|href)\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+\*?/g, " ")
    .replace(/[{}\[\]~&\\]/g, " ");
  const m = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

/* ---------- vocabulario ---------- */

const ENTORNOS = [
  "itemize", "enumerate", "description", "equation", "equation*", "align", "align*", "gather", "gather*",
  "multline", "cases", "matrix", "pmatrix", "bmatrix", "figure", "table", "tabular", "tabularx", "center",
  "flushleft", "flushright", "minipage", "quote", "quotation", "verbatim", "lstlisting", "abstract",
  "frame", "block", "columns", "column", "theorem", "lemma", "proof", "definition", "tikzpicture", "axis",
  "subfigure", "thebibliography", "array", "split", "aligned", "longtable"
];

/* [nombre, plantilla de snippet o null, descripción] */
const COMANDOS = [
  ["section", "\\section{${}}", "sección"], ["subsection", "\\subsection{${}}", "subsección"],
  ["subsubsection", "\\subsubsection{${}}", "subsubsección"], ["chapter", "\\chapter{${}}", "capítulo"],
  ["paragraph", "\\paragraph{${}}", "párrafo"], ["textbf", "\\textbf{${}}", "negrita"], ["textit", "\\textit{${}}", "cursiva"],
  ["emph", "\\emph{${}}", "énfasis"], ["underline", "\\underline{${}}", "subrayado"], ["texttt", "\\texttt{${}}", "máquina de escribir"],
  ["textsc", "\\textsc{${}}", "versalitas"], ["textcolor", "\\textcolor{${color}}{${}}", "color"], ["footnote", "\\footnote{${}}", "nota al pie"],
  ["label", "\\label{${}}", "etiqueta"], ["ref", "\\ref{${}}", "referencia"], ["eqref", "\\eqref{${}}", "referencia a ecuación"],
  ["pageref", "\\pageref{${}}", "página de una etiqueta"], ["cite", "\\cite{${}}", "cita"], ["citep", "\\citep{${}}", "cita (natbib)"],
  ["citet", "\\citet{${}}", "cita en texto (natbib)"], ["parencite", "\\parencite{${}}", "cita (biblatex)"], ["textcite", "\\textcite{${}}", "cita en texto (biblatex)"],
  ["begin", null, "abrir entorno"], ["item", null, "elemento de lista"], ["includegraphics", "\\includegraphics[width=${0.8}\\linewidth]{${}}", "imagen"],
  ["caption", "\\caption{${}}", "pie de figura o tabla"], ["centering", null, "centrar"], ["input", "\\input{${}}", "incluir archivo"],
  ["include", "\\include{${}}", "incluir capítulo"], ["usepackage", "\\usepackage{${}}", "cargar paquete"], ["documentclass", "\\documentclass{${article}}", "clase"],
  ["maketitle", null, "título"], ["tableofcontents", null, "índice"], ["listoffigures", null, "índice de figuras"], ["listoftables", null, "índice de tablas"],
  ["newpage", null, "página nueva"], ["clearpage", null, "vaciar flotantes y página nueva"], ["noindent", null, "sin sangría"], ["vspace", "\\vspace{${1em}}", "espacio vertical"],
  ["hspace", "\\hspace{${1em}}", "espacio horizontal"], ["url", "\\url{${}}", "dirección web"], ["href", "\\href{${url}}{${texto}}", "enlace"],
  ["frac", "\\frac{${}}{${}}", "fracción"], ["sqrt", "\\sqrt{${}}", "raíz"], ["sum", "\\sum_{${i=1}}^{${n}}", "sumatoria"], ["int", "\\int_{${a}}^{${b}}", "integral"],
  ["lim", "\\lim_{${x \\to 0}}", "límite"], ["prod", "\\prod_{${i=1}}^{${n}}", "productoria"], ["partial", null, "∂"], ["infty", null, "∞"], ["cdot", null, "·"],
  ["times", null, "×"], ["pm", null, "±"], ["leq", null, "≤"], ["geq", null, "≥"], ["neq", null, "≠"], ["approx", null, "≈"], ["equiv", null, "≡"],
  ["rightarrow", null, "→"], ["Rightarrow", null, "⇒"], ["leftrightarrow", null, "↔"], ["mathbb", "\\mathbb{${R}}", "conjuntos ℝ ℕ"], ["mathcal", "\\mathcal{${}}", "caligráfica"],
  ["mathrm", "\\mathrm{${}}", "recta en fórmula"], ["vec", "\\vec{${}}", "vector"], ["hat", "\\hat{${}}", "sombrero"], ["bar", "\\bar{${}}", "barra"], ["dot", "\\dot{${}}", "punto (derivada)"],
  ["left", null, "delimitador ajustable"], ["right", null, "delimitador ajustable"], ["text", "\\text{${}}", "texto en fórmula"], ["quad", null, "espacio"], ["qquad", null, "espacio doble"],
  ["alpha", null, "α"], ["beta", null, "β"], ["gamma", null, "γ"], ["delta", null, "δ"], ["epsilon", null, "ε"], ["varepsilon", null, "ε"], ["theta", null, "θ"],
  ["lambda", null, "λ"], ["mu", null, "μ"], ["nu", null, "ν"], ["pi", null, "π"], ["rho", null, "ρ"], ["sigma", null, "σ"], ["tau", null, "τ"], ["phi", null, "φ"],
  ["varphi", null, "φ"], ["omega", null, "ω"], ["Gamma", null, "Γ"], ["Delta", null, "Δ"], ["Theta", null, "Θ"], ["Lambda", null, "Λ"], ["Sigma", null, "Σ"],
  ["Phi", null, "Φ"], ["Omega", null, "Ω"], ["hline", null, "línea de tabla"], ["toprule", null, "línea superior (booktabs)"], ["midrule", null, "línea media (booktabs)"],
  ["bottomrule", null, "línea inferior (booktabs)"], ["multicolumn", "\\multicolumn{${2}}{${c}}{${}}", "celda de varias columnas"], ["SI", "\\SI{${}}{${}}", "magnitud (siunitx)"],
  ["si", "\\si{${}}", "unidad (siunitx)"], ["num", "\\num{${}}", "número (siunitx)"], ["today", null, "fecha"], ["title", "\\title{${}}", "título"], ["author", "\\author{${}}", "autoría"],
  ["date", "\\date{${}}", "fecha"], ["bibliography", "\\bibliography{${}}", "bibliografía (BibTeX)"], ["bibliographystyle", "\\bibliographystyle{${plain}}", "estilo de bibliografía"],
  ["printbibliography", null, "bibliografía (biblatex)"], ["addbibresource", "\\addbibresource{${}}", "archivo .bib (biblatex)"], ["frametitle", "\\frametitle{${}}", "título de diapositiva"],
  ["pause", null, "pausa (beamer)"], ["newcommand", "\\newcommand{\\${nombre}}{${}}", "comando nuevo"]
];

const CMD_REF = /\\(?:ref|eqref|pageref|autoref|cref|Cref|nameref|vref)\{([^}]*)$/;
const CMD_CITE = /\\(?:cite|citep|citet|citealp|citeauthor|citeyear|parencite|textcite|autocite|footcite|nocite)\*?(?:\[[^\]]*\]){0,2}\{([^}]*)$/;
const CMD_BEGIN = /\\begin\{([a-zA-Z*]*)$/;

/* ---------- CodeMirror ---------- */

/* getTextos(): {tex: [string], bib: [string]} de todo el proyecto. */
export function texCompletion(getTextos) {
  const fuente = ctx => {
    const linea = ctx.state.doc.lineAt(ctx.pos);
    const antes = linea.text.slice(0, ctx.pos - linea.from);

    let m = CMD_REF.exec(antes);
    if (m) {
      const desde = ctx.pos - (m[1].length - m[1].lastIndexOf(",") - 1);
      return { from: desde, options: etiquetasDe(getTextos().tex).map(l => ({ label: l, type: "variable" })), validFor: /^[^},]*$/ };
    }
    m = CMD_CITE.exec(antes);
    if (m) {
      const trozo = m[1].slice(m[1].lastIndexOf(",") + 1);
      const desde = ctx.pos - trozo.replace(/^\s+/, "").length;
      const claves = clavesBib(getTextos().bib);
      return { from: desde, options: [...claves].map(([k, v]) => ({ label: k, type: "text", detail: v.tipo, info: v.titulo || undefined })), validFor: /^[^},\s]*$/ };
    }
    m = CMD_BEGIN.exec(antes);
    if (m) {
      return {
        from: ctx.pos - m[1].length,
        options: ENTORNOS.map(env => ({
          label: env, type: "type",
          /* El \end{…} se escribe solo y el cursor queda dentro. Si ya
             hay una «}» justo después (la cierra el autocierre de
             llaves), se reemplaza en vez de duplicarla. */
          apply(view, comp, from, to) {
            const tras = view.state.doc.sliceString(to, to + 1) === "}" ? to + 1 : to;
            const sangria = /^\s*/.exec(view.state.doc.lineAt(from).text)[0];
            const cuerpo = env === "itemize" || env === "enumerate" ? "\\item " : "";
            const texto = `${env}}\n${sangria}  ${cuerpo}\n${sangria}\\end{${env}}`;
            view.dispatch({ changes: { from, to: tras, insert: texto }, selection: { anchor: from + env.length + 2 + sangria.length + 2 + cuerpo.length } });
          }
        })),
        validFor: /^[a-zA-Z*]*$/
      };
    }
    const w = ctx.matchBefore(/\\[a-zA-Z]*/);
    if (!w || (w.from === w.to && !ctx.explicit)) return null;
    return {
      from: w.from,
      options: COMANDOS.map(([n, plantilla, info]) => plantilla
        ? snippetCompletion(plantilla, { label: "\\" + n, detail: info, type: "keyword" })
        : { label: "\\" + n, detail: info, type: "keyword" }),
      validFor: /^\\[a-zA-Z]*$/
    };
  };
  return autocompletion({ override: [fuente], icons: false, activateOnTyping: true, maxRenderedOptions: 60 });
}
