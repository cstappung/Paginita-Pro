"use strict";
/* ============================================================
   Temas de color preestablecidos del editor.

   Cada tema define solo una paleta; a partir de ella se generan
   el tema de CodeMirror, el resaltado de sintaxis y las variables
   CSS que usa el resto de la interfaz. Añadir un tema = añadir
   una entrada aquí, nada más.
   ============================================================ */
import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/* bg      fondo del editor        fg      texto normal
   gutter  números de línea        active  línea activa
   sel     selección               caret   cursor
   cmd     \comandos               math    $ y entornos
   str     argumentos {…}          num     números
   com     comentarios %           accent  color de marca (botones, bordes)
   panel   fondo de paneles        panelFg texto de paneles
   border  bordes                  pdfBg   fondo del visor PDF
   header  barra superior          headerFg texto de la barra
   hover   fondo al pasar el ratón muted   texto secundario              */
export const THEMES = {
  "colabtex-oscuro": {
    label: "ColabTeX oscuro", dark: true,
    bg: "#141c24", fg: "#d5dee8", gutter: "#44546a", active: "rgba(36,50,68,0.5)",
    sel: "#2a3a4c", caret: "#2dd4bf",
    cmd: "#6cb6ff", math: "#7ee0c2", str: "#e2c08d", num: "#e2c08d", com: "#5f7285",
    accent: "#0d9488", panel: "#182430", panelFg: "#c7d3e0", border: "#223140", pdfBg: "#26303b",
    header: "#10201f", headerFg: "#e8f0ef", hover: "#223140", muted: "#7488a0"
  },
  "noche-suave": {
    label: "Noche suave", dark: true,
    bg: "#1a1b26", fg: "#c0caf5", gutter: "#3b4261", active: "rgba(41,46,66,0.6)",
    sel: "#33467c", caret: "#7aa2f7",
    cmd: "#7aa2f7", math: "#9ece6a", str: "#e0af68", num: "#ff9e64", com: "#565f89",
    accent: "#7aa2f7", panel: "#16161e", panelFg: "#a9b1d6", border: "#292e42", pdfBg: "#20212e",
    header: "#13131a", headerFg: "#c0caf5", hover: "#292e42", muted: "#787c99"
  },
  "bosque": {
    label: "Bosque", dark: true,
    bg: "#1b2420", fg: "#cfe0d5", gutter: "#4a5f52", active: "rgba(40,58,48,0.6)",
    sel: "#2f4a3a", caret: "#6ee7a8",
    cmd: "#82d9a6", math: "#a3e635", str: "#e3c07b", num: "#f0a868", com: "#5a7263",
    accent: "#3f9c6a", panel: "#161e1a", panelFg: "#bcd0c3", border: "#26332c", pdfBg: "#222d27",
    header: "#121815", headerFg: "#d6e6db", hover: "#26332c", muted: "#7d9187"
  },
  "solarizado-oscuro": {
    label: "Solarizado oscuro", dark: true,
    bg: "#002b36", fg: "#93a1a1", gutter: "#586e75", active: "rgba(7,54,66,0.8)",
    sel: "#073642", caret: "#2aa198",
    cmd: "#268bd2", math: "#2aa198", str: "#b58900", num: "#cb4b16", com: "#586e75",
    accent: "#2aa198", panel: "#00212b", panelFg: "#93a1a1", border: "#0b3c49", pdfBg: "#00353f",
    header: "#001f27", headerFg: "#93a1a1", hover: "#073642", muted: "#657b83"
  },
  "papel": {
    label: "Papel (claro)", dark: false,
    bg: "#fbfbf8", fg: "#2f3337", gutter: "#a9b2bb", active: "rgba(0,0,0,0.045)",
    sel: "#cfe3f5", caret: "#0d7d72",
    cmd: "#1f6feb", math: "#0f766e", str: "#a4501a", num: "#a4501a", com: "#8a949e",
    accent: "#0d9488", panel: "#f2f2ee", panelFg: "#3a4046", border: "#dcdcd4", pdfBg: "#e2e2da",
    header: "#0d3b38", headerFg: "#eaf3f1", hover: "#e6e6df", muted: "#6b7278"
  },
  "solarizado-claro": {
    label: "Solarizado claro", dark: false,
    bg: "#fdf6e3", fg: "#586e75", gutter: "#93a1a1", active: "rgba(238,232,213,0.7)",
    sel: "#eee8d5", caret: "#2aa198",
    cmd: "#268bd2", math: "#2aa198", str: "#b58900", num: "#cb4b16", com: "#93a1a1",
    accent: "#2aa198", panel: "#f4ecd8", panelFg: "#586e75", border: "#e3dcc4", pdfBg: "#e8e0cb",
    header: "#0e4b52", headerFg: "#eee8d5", hover: "#eee8d5", muted: "#93a1a1"
  },
  "alto-contraste": {
    label: "Alto contraste", dark: true,
    bg: "#000000", fg: "#ffffff", gutter: "#9aa0a6", active: "rgba(255,255,255,0.09)",
    sel: "#264f78", caret: "#00ffd0",
    cmd: "#4fc3ff", math: "#00e5a0", str: "#ffd54f", num: "#ffab40", com: "#9aa0a6",
    accent: "#00bfa5", panel: "#0a0a0a", panelFg: "#e8e8e8", border: "#3f3f3f", pdfBg: "#111111",
    header: "#000000", headerFg: "#ffffff", hover: "#242424", muted: "#b0b0b0"
  }
};

export const DEFAULT_THEME = "colabtex-oscuro";
const STORE_KEY = "colabtex_theme";

export function themeName() {
  const n = localStorage.getItem(STORE_KEY);
  return THEMES[n] ? n : DEFAULT_THEME;
}
export function saveThemeName(n) {
  if (THEMES[n]) localStorage.setItem(STORE_KEY, n);
}

/* --- tema de CodeMirror a partir de la paleta --- */
export function cmThemeFor(p) {
  return EditorView.theme({
    "&": { backgroundColor: p.bg, color: p.fg, fontSize: "12.5px", height: "100%" },
    ".cm-content": { fontFamily: "'IBM Plex Mono',monospace", caretColor: p.caret, lineHeight: "1.7" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: p.caret },
    ".cm-gutters": { backgroundColor: p.bg, color: p.gutter, border: "none" },
    ".cm-activeLine": { backgroundColor: p.active },
    ".cm-activeLineGutter": { backgroundColor: p.active, color: p.fg },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: p.sel + " !important" },
    ".cm-selectionMatch": { backgroundColor: p.accent + "55" },
    ".cm-searchMatch": { backgroundColor: p.accent + "44", outline: "1px solid " + p.accent },
    ".cm-panels": { backgroundColor: p.panel, color: p.panelFg },
    ".cm-panels input, .cm-panels button": { backgroundColor: p.bg, color: p.fg, border: "1px solid " + p.border },
    ".cm-tooltip": { backgroundColor: p.panel, color: p.panelFg, border: "1px solid " + p.border },
    ".cm-tooltip .cm-tooltip-arrow:after": { borderTopColor: p.panel, borderBottomColor: p.panel }
  }, { dark: p.dark });
}

export function cmHighlightFor(p) {
  return HighlightStyle.define([
    { tag: tags.comment, color: p.com, fontStyle: "italic" },
    { tag: tags.tagName, color: p.cmd },
    { tag: tags.keyword, color: p.cmd },
    { tag: tags.atom, color: p.math },
    { tag: tags.number, color: p.num },
    { tag: tags.string, color: p.str },
    { tag: tags.bracket, color: p.fg }
  ]);
}

/* Aplica la paleta a las variables CSS de la interfaz.
   Los nombres coinciden con los que ya usa colabtex.html. */
export function applyCssVars(p) {
  const r = document.documentElement.style;
  const set = {
    "--ed-bg": p.bg, "--ed-fg": p.fg, "--ed-panel": p.panel, "--ed-panel-fg": p.panelFg,
    "--ed-border": p.border, "--ed-accent": p.accent, "--ed-pdf-bg": p.pdfBg,
    "--ed-gutter": p.gutter, "--ed-header": p.header, "--ed-header-fg": p.headerFg,
    "--ed-hover": p.hover, "--ed-muted": p.muted, "--ed-sel": p.sel,
    "--ed-cmd": p.cmd, "--ed-math": p.math, "--ed-str": p.str, "--ed-com": p.com
  };
  for (const k in set) r.setProperty(k, set[k]);
  document.documentElement.dataset.themeDark = p.dark ? "1" : "0";
}
