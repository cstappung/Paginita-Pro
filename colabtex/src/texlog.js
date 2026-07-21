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
