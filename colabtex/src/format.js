"use strict";
/* ============================================================
   ColabTeX — formato del texto seleccionado (estilo Overleaf)

   Negrita, cursiva, subrayado y color, desde los botones de la
   barra del editor o con Ctrl+B / Ctrl+I / Ctrl+U.

   Los botones ALTERNAN, como en Overleaf: si lo seleccionado ya
   está dentro de un \textbf{…}, se le quita el comando en vez de
   envolverlo otra vez (de otro modo bastarían dos clics para
   dejar \textbf{\textbf{texto}}).

   No hay ningún estado oculto: la verdad está siempre en el .tex.
   Todo se hace con transacciones normales de CodeMirror, así que
   Yjs las propaga a los colaboradores y el deshacer las trata
   como cualquier otra edición.

   El subrayado usa \underline, que es de LaTeX y no necesita
   paquete. El color usa \textcolor, que sí necesita xcolor: de
   añadirlo al preámbulo se encarga main.js (ctx.ensureColorPackage).
   ============================================================ */
import { EditorSelection, ChangeSet } from "@codemirror/state";
import { closingBrace } from "./util.js";

const $ = id => document.getElementById(id);
const LAST_COLOR_KEY = "colabtex_fmt_color";

/* ---------- colores ----------
   Equivalencias CSS de los colores con nombre de xcolor, para pintar
   la paleta y la vista visual con el mismo tono que saldrá en el PDF. */
const NAMED_CSS = {
  black: "#000000", white: "#ffffff", gray: "#808080", darkgray: "#404040",
  lightgray: "#bfbfbf", red: "#ff0000", green: "#00ff00", blue: "#0000ff",
  cyan: "#00ffff", magenta: "#ff00ff", yellow: "#ffff00", orange: "#ff8000",
  brown: "#bf8040", lime: "#bfff00", olive: "#808000", pink: "#ffbfbf",
  purple: "#bf0040", teal: "#008080", violet: "#800080"
};

/* los que se ofrecen en el menú (los demás se reconocen, pero no se proponen) */
export const TEX_COLORS = [
  { name: "black", label: "Negro" },
  { name: "gray", label: "Gris" },
  { name: "red", label: "Rojo" },
  { name: "orange", label: "Naranja" },
  { name: "brown", label: "Marrón" },
  { name: "olive", label: "Oliva" },
  { name: "green", label: "Verde" },
  { name: "teal", label: "Verde azulado" },
  { name: "cyan", label: "Cian" },
  { name: "blue", label: "Azul" },
  { name: "violet", label: "Violeta" },
  { name: "purple", label: "Púrpura" },
  { name: "magenta", label: "Magenta" },
  { name: "pink", label: "Rosa" }
].map(c => ({ ...c, css: NAMED_CSS[c.name] }));

/* Color CSS de un \textcolor. Devuelve "" para los modelos que no sabemos
   traducir (rgb, cmyk, gray…): ahí es mejor no pintar nada que mentir. */
export function cssOfTexColor(model, value) {
  const v = String(value || "").trim();
  const m = String(model || "").trim();
  if (!m) return NAMED_CSS[v] || "";
  if (/^(HTML|Hex)$/i.test(m)) return /^[0-9a-f]{6}$/i.test(v) ? "#" + v : "";
  return "";
}

/* ------------------------------------------------------------------
   \textcolor necesita el paquete xcolor. Esto calcula qué habría que
   cambiar en el preámbulo para que el documento siga compilando:
   devuelve {from, to, insert, replaced} o null si no hace falta tocar
   nada. Quien lo aplica es main.js, que sabe si el archivo está en Yjs
   o en el disco.
   ------------------------------------------------------------------ */
export function xcolorPatch(text) {
  const end = text.indexOf("\\begin{document}");
  const pre = end < 0 ? text : text.slice(0, end);

  // una \usepackage comentada no carga nada: no cuenta
  const commented = idx => {
    const ls = pre.lastIndexOf("\n", idx) + 1;
    return /(^|[^\\])%/.test(pre.slice(ls, idx));
  };
  /* salta el fin de línea que sigue a `at`, para escribir en la línea
     siguiente en vez de partir la actual */
  const afterLine = at => {
    if (pre[at] === "\r") at++;
    if (pre[at] === "\n") at++;
    return at;
  };

  const uses = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  let m, last = null, colorAt = null;
  while ((m = uses.exec(pre))) {
    if (commented(m.index)) continue;
    const list = m[1].split(",").map(s => s.trim());
    if (list.includes("xcolor")) return null;         // ya está cargado
    if (colorAt == null && list.includes("color")) {
      const argStart = m.index + m[0].lastIndexOf("{") + 1;
      colorAt = argStart + m[1].search(/\bcolor\b/);
    }
    last = m;
  }

  /* xcolor es un superconjunto de color y los dos juntos dan error, así que
     se sustituye en vez de añadirse. */
  if (colorAt != null) return { from: colorAt, to: colorAt + 5, insert: "xcolor", replaced: true };

  let at;
  if (last) at = afterLine(last.index + last[0].length);
  else {
    const dc = pre.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/);
    if (!dc) return null;                             // preámbulo irreconocible: mejor no tocar
    at = afterLine(dc.index + dc[0].length);
  }
  return { from: at, to: at, insert: "\\usepackage{xcolor}\n", replaced: false };
}

/* ---------- los cuatro formatos ----------
   `re` casa el comando entero hasta la llave de su argumento de texto,
   de modo que la última «{» del match es donde empieza el contenido. */
const KINDS = {
  bold: {
    re: () => /\\textbf\s*\{/g,
    prefix: () => "\\textbf{"
  },
  italic: {
    // se reconocen los dos, pero se escribe \textit (el de Overleaf)
    re: () => /\\(?:textit|emph)\s*\{/g,
    prefix: () => "\\textit{"
  },
  underline: {
    re: () => /\\underline\s*\{/g,
    prefix: () => "\\underline{"
  },
  color: {
    re: () => /\\textcolor\s*(?:\[[^\]\n]*\])?\s*\{[^{}\n]*\}\s*\{/g,
    prefix: spec => spec.model
      ? `\\textcolor[${spec.model}]{${spec.value}}{`
      : `\\textcolor{${spec.value}}{`
  }
};

/* Grupo \comando{…} MÁS INTERNO que contiene por completo [from,to],
   o null si el fragmento no tiene ese formato. */
function findWrapper(text, from, to, kind) {
  const re = KINDS[kind].re();
  let best = null, m;
  while ((m = re.exec(text))) {
    if (m.index > from) break;          // los que vienen ya empiezan detrás
    const open = m.index + m[0].length - 1;
    const close = closingBrace(text, open);
    if (close < 0) continue;            // llave sin cerrar: no es un grupo
    if (open + 1 <= from && to <= close && (!best || m.index > best.start))
      best = { start: m.index, open, close, head: m[0] };
  }
  return best;
}

/* modelo y valor del color de un «\textcolor[HTML]{FF8800}{» ya encontrado */
function colorOfHead(head) {
  const m = head.match(/\\textcolor\s*(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/);
  return m ? { model: (m[1] || "").trim(), value: (m[2] || "").trim() } : null;
}

/* ------------------------------------------------------------------
   Aplica (o quita) un formato en todas las selecciones del editor.
   kind: "bold" | "italic" | "underline" | "color"
   spec: solo para el color — {value, model} · sin spec, el color se quita.
   Devuelve si hubo algún cambio.
   ------------------------------------------------------------------ */
export function applyFormat(view, kind, spec) {
  if (!view || !KINDS[kind] || view.state.readOnly) return false;
  const text = view.state.doc.toString();
  const changes = [];
  const marks = [];   // dónde dejar cada cursor/selección después

  for (const r of view.state.selection.ranges) {
    let from = r.from, to = r.to;
    /* los espacios de los extremos se quedan fuera del comando: al
       seleccionar una palabra con doble clic suele venir uno pegado, y
       \textbf{palabra } subraya/ennegrece también ese hueco */
    while (to > from && /\s/.test(text[to - 1])) to--;
    while (from < to && /\s/.test(text[from])) from++;

    const w = findWrapper(text, from, to, kind);

    if (w && kind === "color" && spec) {
      const cur = colorOfHead(w.head) || {};
      if (cur.value !== spec.value || (cur.model || "") !== (spec.model || "")) {
        // mismo \textcolor, otro color: se cambia solo su argumento
        changes.push({ from: w.start, to: w.open + 1, insert: KINDS.color.prefix(spec) });
        marks.push({ from, to });
        continue;
      }
    }
    if (w) {
      // ya tenía el formato → quitarlo (el botón alterna)
      changes.push({ from: w.start, to: w.open + 1, insert: "" });
      changes.push({ from: w.close, to: w.close + 1, insert: "" });
      marks.push({ from, to });
    } else if (kind === "color" && !spec) {
      continue;                       // «quitar color» sobre texto sin color
    } else if (from === to) {
      // sin selección: se deja el comando escrito y el cursor dentro
      const pre = KINDS[kind].prefix(spec);
      changes.push({ from, to, insert: pre + "}" });
      marks.push({ from, to: from, cursor: pre.length });
    } else {
      const pre = KINDS[kind].prefix(spec);
      changes.push({ from, to: from, insert: pre });   // dos inserciones, no un
      changes.push({ from: to, to, insert: "}" });     // reemplazo: así el texto
      marks.push({ from, to });                        // sigue seleccionado
    }
  }
  if (!changes.length) return false;

  /* Las posiciones guardadas en `marks` son del documento ANTERIOR: se
     trasladan con el propio conjunto de cambios. Los extremos usan
     asociación contraria para quedar por dentro de lo insertado. */
  const cs = ChangeSet.of(changes, text.length);
  const ranges = marks.map(mk => mk.cursor != null
    ? EditorSelection.cursor(cs.mapPos(mk.from, -1) + mk.cursor)
    : EditorSelection.range(cs.mapPos(mk.from, 1), cs.mapPos(mk.to, -1)));

  view.dispatch({
    changes: cs,
    selection: EditorSelection.create(ranges, Math.min(view.state.selection.mainIndex, ranges.length - 1)),
    scrollIntoView: true,
    userEvent: "input.format"
  });
  view.focus();
  return true;
}

/* ------------------------------------------------------------------
   Barra de botones + menú de color.

   ctx: getView(), canWrite(), isTexFile(), ensureColorPackage()
   ------------------------------------------------------------------ */
export function createFormatBar(ctx) {
  let menuBuilt = false;
  let lastColor = readLastColor();

  function readLastColor() {
    try {
      const raw = localStorage.getItem(LAST_COLOR_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (c && c.value) return c;
      }
    } catch (e) {}
    return { value: "red", model: "" };
  }

  function rememberColor(spec) {
    lastColor = spec;
    try { localStorage.setItem(LAST_COLOR_KEY, JSON.stringify(spec)); } catch (e) {}
    paintChip();
  }

  function paintChip() {
    const chip = $("fmtColorChip");
    if (chip) chip.style.background = cssOfTexColor(lastColor.model, lastColor.value) || "#888";
  }

  /* ¿se puede dar formato ahora mismo? Solo en un archivo LaTeX y con
     permiso de escritura; si no, los botones ni siquiera aparecen. */
  function enabled() {
    return !!ctx.getView() && ctx.canWrite() && ctx.isTexFile();
  }

  function run(kind, spec) {
    if (!enabled()) return false;
    const done = applyFormat(ctx.getView(), kind, spec);
    // el paquete se añade DESPUÉS: así el formato se calcula sobre el
    // documento que el usuario está viendo, sin líneas nuevas de por medio
    if (done && kind === "color" && spec) ctx.ensureColorPackage();
    return done;
  }

  /* ---------- menú de color ---------- */
  function buildMenu() {
    if (menuBuilt) return;
    menuBuilt = true;
    const sw = $("fmtSwatches");
    if (!sw) return;
    for (const c of TEX_COLORS) {
      const b = document.createElement("button");
      b.className = "fmt-sw";
      b.style.background = c.css;
      b.title = `${c.label} — \\textcolor{${c.name}}`;
      b.addEventListener("mousedown", e => e.preventDefault());   // no perder la selección
      b.onclick = () => {
        const spec = { value: c.name, model: "" };
        rememberColor(spec);
        hideMenu();
        run("color", spec);
      };
      sw.appendChild(b);
    }
    const custom = $("fmtColorCustom");
    if (custom) {
      custom.onchange = () => {
        const spec = { value: custom.value.replace("#", "").toUpperCase(), model: "HTML" };
        rememberColor(spec);
        hideMenu();
        run("color", spec);
      };
    }
    const clear = $("fmtColorClear");
    if (clear) {
      clear.addEventListener("mousedown", e => e.preventDefault());
      clear.onclick = () => { hideMenu(); run("color", null); };
    }
  }

  function menuVisible() {
    const m = $("fmtColorMenu");
    return !!m && m.style.display === "block";
  }

  function hideMenu() {
    const m = $("fmtColorMenu");
    if (m) m.style.display = "none";
  }

  function showMenu() {
    buildMenu();
    const m = $("fmtColorMenu"), btn = $("fmtColor");
    if (!m || !btn) return;
    m.style.display = "block";
    // debajo del botón, sin salirse por la derecha de la ventana
    const r = btn.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 6) + "px";
    m.style.left = Math.round(Math.max(6, Math.min(r.left, window.innerWidth - m.offsetWidth - 8))) + "px";
  }

  /* Muestra u oculta el grupo entero según el archivo y el rol. Se llama al
     abrir un archivo, al entrar en un proyecto y al cambiar de vista. */
  function refresh() {
    const g = $("fmtGroup");
    if (!g) return;
    const on = enabled();
    g.style.display = on ? "" : "none";
    if (!on) hideMenu();
    paintChip();
  }

  function wire() {
    const b = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("mousedown", e => e.preventDefault());   // el editor conserva la selección
      el.onclick = fn;
    };
    b("fmtBold", () => run("bold"));
    b("fmtItalic", () => run("italic"));
    b("fmtUnder", () => run("underline"));
    b("fmtColor", () => (menuVisible() ? hideMenu() : showMenu()));

    document.addEventListener("mousedown", e => {
      if (!menuVisible()) return;
      const m = $("fmtColorMenu");
      if (m.contains(e.target) || $("fmtColor").contains(e.target)) return;
      hideMenu();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hideMenu(); });
    paintChip();
  }

  /* `run` lo usan también los atajos Ctrl+B/I/U, declarados en main.js
     junto a los demás del editor. */
  return { wire, refresh, run };
}
