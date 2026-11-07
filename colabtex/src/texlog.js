"use strict";
/* ============================================================
   Extrae errores y advertencias del log de pdfLaTeX con su
   archivo y línea, para poder marcarlos en el editor.

   Se compila con --file-line-error, así que los errores salen así:

       ./main.tex:41: LaTeX Error: Command \bm already defined.

   …mucho más fiable que deducir el archivo del anidamiento de
   paréntesis del log, que se rompe con cualquier ruta con espacios.

   Las advertencias no llevan ese prefijo, pero muchas indican la
   línea al final:

       LaTeX Warning: Reference `fig:1' undefined on input line 88.
   ============================================================ */

/* «./main.tex:41: mensaje» */
const FILE_LINE = /^(?:\.\/)?([^:\n]+?):(\d+):\s*(.*)$/;

/* «LaTeX Warning: … on input line 88.» */
const WARN_LINE = /^(?:(LaTeX|Package|Class)\s+(?:(\S+)\s+)?Warning:\s*)(.*?)(?:\s*on input line (\d+))?\.?$/;

/* Errores de TeX sin prefijo de archivo, con la línea en «l.NNN» */
const BANG = /^!\s*(.*)$/;
const L_NUM = /^l\.(\d+)\s?(.*)$/;

export function parseTexLog(fullLog, mainFile = "main.tex") {
  const lines = (fullLog || "").split("\n");
  const items = [];
  const seen = new Set();

  const push = (severity, file, line, message, detail) => {
    message = (message || "").trim().replace(/\s+/g, " ");
    if (!message) return;
    const key = severity + "|" + file + "|" + line + "|" + message;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ severity, file, line: Math.max(1, line | 0), message, detail: (detail || "").trim() });
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;

    // ---- error con archivo y línea ----
    const fl = ln.match(FILE_LINE);
    if (fl && /(Error|Undefined|Missing|Extra|Runaway|not found|Emergency)/i.test(fl[3])) {
      // el detalle útil suele venir en las líneas siguientes, hasta «l.NNN»
      let detail = "";
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (L_NUM.test(lines[j])) { detail = lines[j]; break; }
        if (lines[j].trim()) detail += (detail ? " " : "") + lines[j].trim();
      }
      push("error", fl[1].trim(), +fl[2], fl[3], detail);
      continue;
    }

    // ---- error de TeX «! …» sin prefijo de archivo ----
    const bang = ln.match(BANG);
    if (bang && !/^!\s*$/.test(ln)) {
      let line = 0, detail = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const m = lines[j].match(L_NUM);
        if (m) { line = +m[1]; detail = lines[j]; break; }
      }
      if (line) push("error", mainFile, line, bang[1], detail);
      continue;
    }

    // ---- advertencias ----
    const w = ln.match(WARN_LINE);
    if (w && w[4]) {
      const who = w[2] ? `${w[1]} ${w[2]}` : w[1];
      push("warning", mainFile, +w[4], `${who}: ${w[3]}`, "");
    }
  }

  return items;
}

/* Agrupa por archivo: {archivo → [items]} */
export function groupByFile(items) {
  const byFile = new Map();
  for (const it of items) {
    const f = it.file.replace(/^\.\//, "");
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push(it);
  }
  return byFile;
}

/* ============================================================
   Pistas para lo que NO se puede arreglar desde el motor.

   El registro de pdfTeX dice qué falló, nunca por qué aquí no puede
   funcionar ni qué poner en su lugar. Estos son los casos que la
   batería de pruebas encontró y que dependen de programas que no
   existen en el navegador (XeTeX/LuaTeX, Biber, Pygments) o de un
   detalle de pdfLaTeX que nadie adivina. Cada pista sale UNA vez por
   compilación aunque el error se repita cien veces.
   ============================================================ */
const GRIEGAS = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta",
  "θ": "theta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi",
  "π": "pi", "ρ": "rho", "σ": "sigma", "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi",
  "ψ": "psi", "ω": "omega", "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda",
  "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega"
};

export function pistasDeError(fullLog) {
  const log = String(fullLog || "");
  const out = [];
  const di = (cond, texto) => { if (cond && !out.includes(texto)) out.push(texto); };

  di(/fontspec[\s\S]{0,200}(cannot-use-pdftex|requires either XeTeX or LuaTeX)|Fatal Package fontspec Error/.test(log),
    "fontspec (y unicode-math o polyglossia con fuentes del sistema) solo funciona con XeLaTeX o LuaLaTeX, " +
    "y ColabTeX compila con pdfLaTeX. Quita \\usepackage{fontspec} y usa \\usepackage[T1]{fontenc} con " +
    "\\usepackage{lmodern}, o una familia como \\usepackage{newtxtext,newtxmath} o \\usepackage{mathpazo}.");

  di(/minted[\s\S]{0,120}(shell-escape|pygmentize)/i.test(log),
    "minted necesita ejecutar Pygments (-shell-escape), que no existe en el navegador. Usa listings: " +
    "\\usepackage{listings} y \\begin{lstlisting}[language=Python] … \\end{lstlisting}.");

  di(/Biber backend (is )?required|requires? (the )?['`]?biber/i.test(log),
    "Este estilo de biblatex (por ejemplo apa) solo funciona con Biber, que no existe en el navegador. " +
    "Para APA usa \\usepackage{natbib} con \\bibliographystyle{apalike}, o la clase apa7 con natbib.");

  const uni = new Set();
  for (const m of log.matchAll(/Unicode character (\S) \(U\+([0-9A-F]{4,6})\)/g)) uni.add(m[1]);
  if (uni.size) {
    const g = [...uni].filter(c => GRIEGAS[c]);
    const otros = [...uni].filter(c => !GRIEGAS[c]);
    if (g.length) di(true, `pdfLaTeX no conoce ${g.map(c => `«${c}»`).join(", ")} ${g.length > 1 ? "escritos" : "escrito"} directamente en el texto. ` +
      `Usa ${g.slice(0, 3).map(c => `$\\${GRIEGAS[c]}$`).join(", ")}${g.length > 3 ? "…" : ""} o añade \\usepackage{textgreek} al preámbulo.`);
    if (otros.length) di(true, `pdfLaTeX no sabe pintar ${otros.slice(0, 4).map(c => `«${c}»`).join(", ")}. ` +
      `Defínelo en el preámbulo con \\usepackage{newunicodechar} y \\newunicodechar{${otros[0]}}{…}, o escríbelo con un comando de LaTeX.`);
  }

  for (const m of log.matchAll(/File [`']([^'`]+)\.(sty|cls)' not found/g)) {
    const nombre = m[1];
    if (nombre === "libertine" || nombre === "libertinus")
      di(true, `La fuente ${nombre} no está en el motor de ColabTeX (pesa ~20 MB y casi nadie la usa). ` +
        "Alternativas parecidas que sí están: \\usepackage{newtxtext,newtxmath} o \\usepackage{mathpazo}.");
    else
      di(true, `El ${m[2] === "cls" ? "documento usa la clase" : "paquete"} «${nombre}», que no está en el motor de ColabTeX. ` +
        "Si lo necesitas, repórtalo con el botón ⚑ (abajo a la derecha) para que se añada.");
  }

  di(/Font bbm\w* at \d+ not found/.test(log),
    "bbm solo existe como fuente METAFONT, que no se puede ejecutar en el navegador. " +
    "Para el 1 de doble trazo usa \\usepackage{dsfont} y $\\mathds{1}$ (o \\usepackage{bbold} y $\\mathbb{1}$).");

  di(/Font (?!bbm)\S+ at \d+ not found/.test(log),
    "Falta una fuente en el motor de ColabTeX. Repórtalo con el botón ⚑; mientras, \\usepackage{lmodern} suele evitarlo.");

  return out;
}
