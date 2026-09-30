"use strict";
/* ============================================================
   CSV Oscilloscope — engine
   Offline waveform viewer for CSV captures — Rigol-style
   ("Time(s),CH1(V),CH2(A),…"), Tektronix exports with their
   Model/Channel/Vertical Units preamble, and plain headerless
   number grids (see the parser worker). 100% in-browser.
   Views: Scope (main + zoom + quick spectrum), FFT/Harmonics
   (PLECS-style magnitude/phase per harmonic), XY.
   ============================================================ */
/* The design-doc runtime evaluates helmet <script> tags twice. Without this
   guard the second pass overwrote window.ScopeApp with a fresh, uninitialised
   module: the app kept working (the first instance owns the listeners) but
   `ready` stayed false forever and every applyOptions() from the host landed on
   an instance wired to nothing. */
window.ScopeApp = window.ScopeApp || (function () {

  // ---------- utilities ----------
  /* Trace colours follow the convention every bench scope uses — CH1 yellow,
     CH2 cyan, CH3 magenta, CH4 green — because that is the single strongest
     visual cue that this is an oscilloscope. Those hues are unreadable on a
     white screen, so there is a muted set for the light theme; channels keep
     an index instead of a fixed colour and are repainted when the theme
     changes, unless the user picked a colour by hand (autoColor = false). */
  const PALETTE_DARK = ["#ffd93d", "#3ad6f0", "#ff5fd2", "#5ce65c", "#ff9f45", "#a98bff", "#ff6b6b", "#8ad7ff"];
  /* The light set is the MATLAB/PLECS line order (blue, orange, yellow,
     purple, green, light blue, dark red, black): on a white plot it is what
     people who simulate power electronics are used to reading. */
  const PALETTE_LIGHT = ["#0072bd", "#d95319", "#edb120", "#7e2f8e", "#77ac30", "#4dbeee", "#a2142f", "#000000"];
  let paletteIdx = 0;
  const nextColorIdx = () => paletteIdx++;
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  function luminance(hex) {
    const m = String(hex).replace("#", "");
    if (m.length < 6) return 1;
    const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const screenIsDark = () => luminance((S.theme || THEME_LIGHT).scopeBg) < 0.5;
  const colorFor = (idx) => (screenIsDark() ? PALETTE_DARK : PALETTE_LIGHT)[idx % PALETTE_DARK.length];
  let uidN = 1;
  const nextId = () => "id" + (uidN++);

  function decadeSteps(min, max) {
    const steps = [], bases = [1, 2, 5];
    let exp = Math.floor(Math.log10(min)) - 1;
    for (let g = 0; g < 200; g++) {
      for (const b of bases) {
        const v = b * Math.pow(10, exp);
        if (v >= min * 0.999 && v <= max * 1.001) steps.push(v);
      }
      exp++;
      if (steps.length > 0 && Math.pow(10, exp) > max * 1.001) break;
      if (Math.pow(10, exp - 1) > max * 1.001 && exp > Math.log10(max) + 1) break;
    }
    return steps;
  }
  function nearestStep(steps, target) {
    let best = steps[0], bd = Infinity;
    for (const s of steps) { const d = Math.abs(s - target); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  const SI = [{ e: -12, s: "p" }, { e: -9, s: "n" }, { e: -6, s: "µ" }, { e: -3, s: "m" }, { e: 0, s: "" }, { e: 3, s: "k" }, { e: 6, s: "M" }, { e: 9, s: "G" }];
  function fmt(value, unit, digits) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    digits = digits === undefined ? 3 : digits;
    if (value === 0) return "0 " + unit;
    const av = Math.abs(value);
    let ch = { e: 0, s: "" };
    for (const p of SI) if (av >= Math.pow(10, p.e)) ch = p;
    return (value / Math.pow(10, ch.e)).toFixed(digits) + " " + ch.s + unit;
  }
  function fmtScale(value, unit) {
    const av = Math.abs(value);
    let ch = { e: 0, s: "" };
    for (const p of SI) if (av >= Math.pow(10, p.e)) ch = p;
    const scaled = Math.round((value / Math.pow(10, ch.e)) * 1000) / 1000;
    return scaled + " " + ch.s + unit;
  }
  const PREFIX_MULT = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  function parseScaleInput(text) {
    const m = String(text).trim().match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([a-zA-Zµ]*)$/);
    if (!m) return null;
    const num = parseFloat(m[1]);
    if (!isFinite(num)) return null;
    const suffix = m[2];
    const mult = suffix.length && PREFIX_MULT[suffix[0]] !== undefined ? PREFIX_MULT[suffix[0]] : 1;
    const val = num * mult;
    return isFinite(val) ? val : null;
  }
  function downloadText(name, text) {
    const blob = new Blob([text], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- CSV parser worker ----------
  /* A capture out of a real bench scope is not "one header line and then
     numbers". A Tektronix MSO/DPO writes a whole preamble first — Model, then
     Channel / Waveform Type / Vertical Units / Sample Interval / Record Length
     repeated once per channel in side-by-side blocks — a blank line and an
     ANALOG_Thumbnail row, and only then the real "TIME,CH1,…,CH6" header.
     Assuming line 1 is the header turned that file into one channel called
     "Model" full of zeros.
     So the header is not assumed: the *data* is located first — the first pair
     of consecutive lines that both parse as numbers with the same field count —
     and the nearest readable line above it supplies the names, if it has the
     same number of fields. A file with no header at all therefore also loads,
     with synthesised CH names, instead of eating its first sample.
     The preamble is not thrown away either: it is the only place the per
     channel units live ("Vertical Units,V" for CH1–CH4 and ",A" for CH5–CH6 in
     a Tek ALL export), and those units are what let a math channel multiply a
     volt by an amp and call the result a watt. Only the scan window
     (SCAN_LINES) is split into lines — splitting a 250 k-row file to find its
     header would allocate the whole capture twice over as strings. */
  const WORKER_SRC = `
var SCAN_LINES = 400;
/* Every separator/decimal pair worth trying, in order of preference. A comma
   file scanned with ";" yields a single field and fails isDataRow, so at most
   one of these ever matches — detection is by trial, not by counting. */
var CONFIGS = [{ d: ",", dec: "." }, { d: ";", dec: "." }, { d: ";", dec: "," }, { d: "\\t", dec: "." }, { d: "\\t", dec: "," }];
var META_KEYS = { "channel": 1, "source": 1, "vertical units": 1, "horizontal units": 1, "label": 1 };

function toNum(f, dec) {
  if (dec === ",") f = f.replace(",", ".");
  return +f;
}
function isNum(f, dec) {
  if (f === "") return false;
  var v = toNum(f, dec);
  return v === v && isFinite(v);
}
/* A data row: every non-empty field a number, at least two of them, and the
   first one — the time stamp — present. */
function isDataRow(fields, dec) {
  if (fields.length < 2) return false;
  if (!isNum(fields[0], dec)) return false;
  var n = 1;
  for (var i = 1; i < fields.length; i++) {
    var f = fields[i];
    if (f === "") continue;
    if (!isNum(f, dec)) return false;
    n++;
  }
  return n >= 2;
}
function takeLines(text, max) {
  var lines = [], offs = [], pos = 0, len = text.length;
  while (pos <= len && lines.length < max) {
    var nl = text.indexOf("\\n", pos);
    var end = nl === -1 ? len : nl;
    var line = text.slice(pos, end);
    if (line.length && line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
    lines.push(line); offs.push(pos);
    if (nl === -1) break;
    pos = end + 1;
  }
  return { lines: lines, offs: offs };
}
/* First line from which the file is numbers. Two consecutive rows are required
   so a stray numeric line inside the preamble (a bare "Record Length,250000"
   split some other way) cannot be mistaken for the capture. */
function findData(lines, cfg) {
  for (var i = 0; i < lines.length - 1; i++) {
    if (!lines[i]) continue;
    var a = lines[i].split(cfg.d);
    if (!isDataRow(a, cfg.dec)) continue;
    var j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    if (j >= lines.length) break;
    var b = lines[j].split(cfg.d);
    if (isDataRow(b, cfg.dec) && a.length === b.length) return { start: i, n: a.length };
  }
  for (var k = 0; k < lines.length; k++) {
    if (lines[k] && isDataRow(lines[k].split(cfg.d), cfg.dec)) return { start: k, n: lines[k].split(cfg.d).length };
  }
  return null;
}
/* The preamble, as key -> list of values in file order. The keys repeat once
   per channel across the same line ("Vertical Units,V,,Vertical Units,A"), so
   the position in the list is the channel index. */
function readMeta(lines, upTo, d) {
  var meta = {};
  for (var i = 0; i < upTo; i++) {
    var f = lines[i].split(d);
    for (var k = 0; k + 1 < f.length; k++) {
      var key = f[k].trim().toLowerCase();
      if (META_KEYS[key] !== 1) continue;
      var val = f[k + 1].trim();
      if (val === "") continue;
      (meta[key] || (meta[key] = [])).push(val);
    }
  }
  return meta;
}
var norm = function (s) { return String(s).trim().toLowerCase().replace(/[\\s_]/g, ""); };

self.onmessage = function(e) {
  const { id, buffer } = e.data;
  try {
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);   // Excel and some scopes write a BOM
    if (!text.length) { self.postMessage({ type: "error", id, message: "Empty file." }); return; }
    const scan = takeLines(text, SCAN_LINES);
    let cfg = null, found = null;
    for (const c of CONFIGS) {
      const f = findData(scan.lines, c);
      if (f && (!found || f.n > found.n)) { cfg = c; found = f; }
    }
    if (!found) { self.postMessage({ type: "error", id, message: "No numeric data found in the first " + SCAN_LINES + " lines." }); return; }
    const DELIM = cfg.d.charCodeAt(0), DEC = cfg.dec;

    /* Names: the nearest non-empty line above the data with the same field
       count. Searching upwards (not downwards from line 0) is what keeps a
       preamble row that happens to have the right width from winning over the
       real header sitting right on top of the numbers. */
    let headerIdx = -1;
    for (let i = found.start - 1; i >= 0; i--) {
      const line = scan.lines[i];
      if (!line.trim()) continue;
      const f = line.split(cfg.d);
      if (f.length === found.n && !isDataRow(f, DEC)) headerIdx = i;
      break;
    }
    const meta = readMeta(scan.lines, headerIdx === -1 ? found.start : headerIdx, cfg.d);
    const chNames = meta["channel"] || meta["source"] || [];
    const vUnits = meta["vertical units"] || [];
    const hUnit = meta["horizontal units"] ? meta["horizontal units"][0] : "";
    const raw = headerIdx === -1 ? [] : scan.lines[headerIdx].split(cfg.d);
    const cols = [];
    for (let c = 0; c < found.n; c++) {
      let name = (raw[c] || "").trim(), unit = "";
      const m = name.match(/^(.*?)\\(([^)]*)\\)\\s*$/);      // "CH1(V)", the Rigol style
      if (m) { name = m[1].trim(); unit = m[2].trim(); }
      if (!name) name = c === 0 ? "Time" : "CH" + c;
      if (!unit && c > 0) {
        /* Match the column to its preamble block by name when possible — the
           blocks are in file order but a header may not list every channel. */
        let idx = -1;
        for (let k = 0; k < chNames.length; k++) if (norm(chNames[k]) === norm(name)) { idx = k; break; }
        if (idx === -1) idx = c - 1;
        unit = vUnits[idx] || "";
      }
      if (!unit && c === 0) unit = hUnit;
      cols.push({ name: name, unit: unit });
    }

    const body = text.slice(scan.offs[found.start]);
    const len = body.length;
    const estRows = Math.max(16, Math.ceil(len / 8));
    const nCols = cols.length;
    const timeArr = new Float64Array(estRows);
    const valArrays = [];
    for (let c = 1; c < nCols; c++) valArrays.push(new Float32Array(estRows));
    let rowCount = 0, pos = 0, lastProg = 0;
    while (pos < len) {
      let nl = body.indexOf("\\n", pos);
      let lineEnd = nl === -1 ? len : nl;
      let line = body.slice(pos, lineEnd);
      if (line.length && line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      if (line.length > 0) {
        if (rowCount >= timeArr.length) { pos = lineEnd + 1; continue; }
        let start = 0, colIdx = 0, ok = true;
        const L = line.length;
        for (let k = 0; k <= L; k++) {
          if (k === L || line.charCodeAt(k) === DELIM) {
            const field = line.slice(start, k);
            const v = field === "" ? 0 : toNum(field, DEC);
            /* A line whose time stamp is not a number is not a sample: a
               footer, a repeated header of a concatenated export, a note. It
               is skipped rather than stored as row 0 s = 0 V. */
            if (colIdx === 0) { if (!(v === v && isFinite(v)) || field === "") { ok = false; break; } timeArr[rowCount] = v; }
            else if (colIdx - 1 < valArrays.length) valArrays[colIdx - 1][rowCount] = v;
            colIdx++; start = k + 1;
          }
        }
        if (ok && colIdx > 1) rowCount++;
      }
      pos = lineEnd + 1;
      if (rowCount - lastProg > 25000) {
        lastProg = rowCount;
        self.postMessage({ type: "progress", id, pct: Math.min(99, Math.round((pos / len) * 100)) });
      }
    }
    const finalTime = timeArr.length === rowCount ? timeArr : timeArr.slice(0, rowCount);
    const finalVals = valArrays.map(a => (a.length === rowCount ? a : a.slice(0, rowCount)));
    if (rowCount > 1) {
      const t0 = finalTime[0], t1 = finalTime[rowCount - 1];
      const dt = (t1 - t0) / (rowCount - 1);
      for (let i = 0; i < rowCount; i++) finalTime[i] = t0 + i * dt;
    }
    const transferList = [finalTime.buffer];
    for (const a of finalVals) transferList.push(a.buffer);
    self.postMessage({ type: "done", id, columns: cols.slice(1), rowCount, time: finalTime, values: finalVals }, transferList);
  } catch (err) {
    self.postMessage({ type: "error", id, message: String(err && err.message || err) });
  }
};`;
  let parserWorker = null;
  function getWorker() {
    if (!parserWorker) parserWorker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
    return parserWorker;
  }

  // ---------- theme ----------
  /* One theme object drives everything: the CSS custom properties of the
     chrome and the colours the canvases paint with. `--panel` and friends are
     written straight onto documentElement, so there is no need for the old
     trick of matching inline `style` attributes with CSS selectors. */
  /* Light is the default and looks like a PLECS scope window: grey chrome,
     white plots with a thin frame and dotted tick lines, black cursors. The
     dark theme is kept for whoever prefers a bench-scope screen. */
  const THEME_LIGHT = { app: "#eceef1", surface: "#ffffff", surface2: "#f5f6f8", border: "#c8cdd3", text: "#1b1f24", muted: "#5c6670", accent: "#0072bd", scopeBg: "#ffffff", gridMinor: "#dfe2e6", gridMajor: "#b9bec5", cursor: "#202020" };
  const THEME_DARK = { app: "#0b0f14", surface: "#141b23", surface2: "#10161d", border: "#26333f", text: "#dfe8f2", muted: "#7d8fa3", accent: "#2ea8ff", scopeBg: "#05090c", gridMinor: "#1e323f", gridMajor: "#3a5a6d", cursor: "#d7e6f5" };
  const CSS_VARS = { app: "chassis", surface: "panel", surface2: "panel2", border: "line", text: "text", muted: "dim", accent: "accent", scopeBg: "screen", gridMinor: "grid1", gridMajor: "grid2", cursor: "cursor" };
  const THEME_KEY = "csvscope_theme_v3";
  function hexA(hex, a) {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function themeCanvas(t) {
    const dark = luminance(t.scopeBg) < 0.5;
    return { scopeBg: t.scopeBg, gridMinor: t.gridMinor, gridMajor: t.gridMajor, gridTick: t.gridMajor,
      border: t.gridMajor, text: t.text, muted: t.muted, accent: t.accent, cursor: t.cursor,
      dark,
      // the figure around the plots, the plot frame and the legend box
      figBg: t.surface2,
      axis: dark ? t.gridMajor : "#7d848c",
      legendBg: dark ? "rgba(10,16,22,0.9)" : "rgba(255,255,255,0.92)",
      // on-screen legend bar, drawn over the graticule like a real DSO
      barBg: dark ? "rgba(8,14,19,0.82)" : "rgba(248,250,252,0.88)",
      barLine: hexA(t.gridMajor, 0.75),
      shade: hexA(t.accent, dark ? 0.12 : 0.08), shadeEdge: hexA(t.accent, dark ? 0.6 : 0.45) };
  }

  // ---------- state ----------
  const S = {
    opts: { scopeDark: false, traceWidth: 1.6, traceGlow: true, fundamental: 50, ratedCurrent: "" },
    files: [], channels: [],
    divsH: 10, divsV: 8,
    /* Plot layout: the screen is ONE canvas subdivided into rows×cols panes,
       not several canvases. Everything downstream (persistence buffer, drop
       zone, hit testing, screenshot, dpr handling) already assumes a single
       drawing surface, and 36 canvases would each carry their own backing
       store — at device-pixel-ratio 2 that is 36 extra bitmaps to allocate and
       composite every frame. Panes share the time base (see `paneRects`). */
    layout: { rows: 1, cols: 1 },
    /* Harmonic reconstruction overlay: rebuilds the wave from the harmonics
       the FFT tab measured, adding them one at a time. `k` is how many are
       summed so far. Lives here rather than in the FFT view because it is
       drawn over the trace it approximates, which is the whole point. */
    recon: { on: false, k: 1, components: false, playing: false, nHarm: 15 },
    timePerDiv: 10e-3, hOffset: 0, timeDivOptions: [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1],
    trigger: { sourceId: "", level: 0, slope: "rising" },
    cursors: { mode: "off", t1: 0, t2: 0, v1: 1, v2: -1, refId: "" },
    measureScope: "visible",
    zoomOn: false, zoomT: 0, zoomSpan: 0,
    splitOn: false,
    persistOn: false, persistDecay: 0.10,
    tab: "scope",
    dragging: null,
    glowOn: true,
    fft: null,          // last spectrum result
    harm: null,         // last harmonic analysis
    /* Channels analysed next to the source, in channel order. `series` is what
       the FFT tab draws: the source first, then each of those, every one with
       its own {ch, fft, harm}. S.fft/S.harm stay the source's, so everything
       that only ever looked at one channel (THD card, table, recon) is as it was. */
    fftCompare: [],
    series: [],
    fftMaxFreq: null,
    iL: null,           // rated demand current for TDD (rms, null = not set)
    xy: { xId: "", yId: "" },
    hoverHarm: -1,
    theme: null,
    /* Vertical scaling. "axis" is the PLECS way: every plot has a y axis with
       real tick labels and all its channels share it (S.axes[pane], auto or a
       fixed min/max). "div" is the bench-scope way this tool started with:
       each channel has its own V/div and position on an 8-division graticule.
       Touching a channel's V/div or position switches to "div", since that is
       unambiguously asking for it. */
    yMode: "axis",
    axes: [],
    /* The toolbar tool the left button does on the plot: "zoom" (rubber band,
       the PLECS default), "zoomx", "zoomy", "pan" or "pointer" (only grabs
       cursors, trigger and markers). */
    tool: "zoom",
    /* Zoom history, as PLECS' back/forward arrows: each entry is the whole
       view (time window + every axis), so undoing a Y zoom restores Y too. */
    hist: { back: [], fwd: [] },
    legendOn: true
  };
  const th = () => themeCanvas(S.theme || THEME_LIGHT);
  const curTheme = () => Object.assign({}, S.theme || THEME_LIGHT);

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  let R = {}; // refs
  const REF_IDS = [
    "fileInput", "btnLoad", "btnAutoset", "btnFit", "btnReset", "btnShot", "btnExportData",
    "tabScope", "tabFFT", "tabXY", "viewScope", "viewFFT", "viewXY",
    "sideScope", "sideFFT", "sideXY",
    "fileList", "loadStatus", "channelList", "mathA", "mathOp", "mathB", "btnMath",
    "timeDiv", "hOffsetIn", "btnPanL", "btnPanR", "btnZinH", "btnZoutH",
    "trigSource", "trigLevelIn", "trigSlope", "btnTrigPrev", "btnTrigNext",
    "cursorMode", "cursorRefRow", "cursorRef", "cursorReadout",
    "chkGlow", "chkZoom", "chkSplitFFT", "chkPersist", "persistDecay", "persistDecayRow",
    "layoutPick", "layoutLabel", "btnLayoutSpread",
    "chkRecon", "reconBody", "reconK", "reconKVal", "reconNharm", "btnReconPlay", "btnReconAll", "chkReconParts", "reconNote",
    "btnF0Auto", "chkF0Auto",
    "btnThemeLight", "btnThemeDark", "btnThemeReset",
    "thApp", "thSurface", "thText", "thAccent", "thScopeBg", "thGridMinor", "thGridMajor", "thCursor",
    "scopeWrap", "scopeCanvas", "hoverReadout", "zoomWrap", "zoomCanvas",
    "splitWrap", "splitCanvas", "splitReadout",
    "measureBody", "measureScopeSel", "btnExportMeas",
    "fftSource", "fftCompareList", "fftPhaseMode", "fftCmpCard", "fftCmpBody", "fftWindow", "fftScale", "fftRange", "fftMaxIn",
    "f0In", "nHarmIn", "multMode", "multKIn", "multKRow", "harmUnit",
    "ilIn", "btnIeee", "btnCompute", "btnExportHarm", "fftSummary",
    "specWrap", "specCanvas", "harmWrap", "harmCanvas", "phaseWrap", "phaseCanvas",
    "harmTableBody", "thdBig", "tddBig", "tddSub", "harmMeta",
    "tbPointer", "tbZoom", "tbZoomX", "tbZoomY", "tbPan", "tbFit", "tbFitY", "tbBack", "tbFwd",
    "tbCursors", "tbLegend", "tbYMode", "tbPng", "tbCsv", "tbInfo",
    "cursorCard", "cursorHead", "cursorBody",
    "tStartIn", "tEndIn", "yModeSel", "axPane", "axMin", "axMax", "axAuto",
    "xySrcX", "xySrcY", "xyRange", "btnXYFit", "xyWrap", "xyCanvas",
    "statusLeft", "statusRight"
  ];

  let dpr = 1;
  const CV = {}; // canvas contexts + sizes: {scope:{ctx,w,h}, ...}
  function bindCanvas(key, canvasId, wrapId) {
    CV[key] = { canvas: R[canvasId], ctx: R[canvasId].getContext("2d"), wrap: R[wrapId], w: 0, h: 0 };
  }
  function resizeCanvas(key) {
    const c = CV[key];
    const w = c.wrap.clientWidth, h = c.wrap.clientHeight;
    if (w === 0 || h === 0) return false;
    if (c.w === w && c.h === h && c.canvas.width === Math.round(w * dpr)) return true;
    c.w = w; c.h = h;
    if (key === "scope") invalidatePanes();   // pane rectangles are size-derived
    c.canvas.width = Math.round(w * dpr);
    c.canvas.height = Math.round(h * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  // ---------- injected CSS ----------
  /* The whole instrument skin lives here so there is exactly one place that
     decides how the app looks. Everything is expressed against the CSS custom
     properties written by applyTheme(), so switching or hand-tuning a theme
     never needs a rule change. */
  function injectCSS() {
    const css = `
    /* ===== shell ===== */
    .osc{height:100vh;display:flex;flex-direction:column;background:var(--chassis);color:var(--text);font-family:"IBM Plex Sans",sans-serif;overflow:hidden}
    .osc .body{flex:1;display:grid;grid-template-columns:250px 1fr 296px;min-height:0}
    .osc .grow{flex:1;min-width:0}
    .osc .push{margin-left:auto}
    .osc .stack{display:flex;flex-direction:column;gap:6px}
    .osc .sep{width:1px;height:20px;background:var(--line);flex-shrink:0}
    .osc ::-webkit-scrollbar{width:9px;height:9px}
    .osc ::-webkit-scrollbar-thumb{background:var(--line);border-radius:5px}
    .osc ::-webkit-scrollbar-thumb:hover{background:var(--dim)}
    .osc ::-webkit-scrollbar-track{background:transparent}

    /* ===== front panel ===== */
    .osc .hdr{display:flex;align-items:center;gap:11px;height:52px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel),var(--panel2));border-bottom:1px solid var(--line);box-shadow:0 1px 0 var(--shadow-1)}
    .osc .home{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--panel2);color:var(--dim);font-size:14px;text-decoration:none;flex-shrink:0}
    .osc .home:hover{border-color:var(--accent);color:var(--accent)}
    .osc .brand{display:flex;align-items:center;gap:8px;margin-right:4px;flex-shrink:0}
    .osc .pwr{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok);flex-shrink:0}
    .osc .mark{font-weight:700;font-size:14.5px;letter-spacing:.07em}
    .osc .model{font-size:10px;color:var(--dim);letter-spacing:.04em;white-space:nowrap}
    .osc .tools{display:flex;align-items:center;gap:6px;flex-shrink:0}
    @media (max-width:1320px){.osc .model{display:none}}

    /* ===== buttons ===== */
    .osc .btn{height:28px;padding:0 12px;border:1px solid var(--line);border-radius:6px;background:linear-gradient(180deg,var(--panel),var(--panel2));color:var(--text);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 0 var(--shadow-1),inset 0 1px 0 var(--sheen)}
    .osc .btn:hover{border-color:var(--accent);color:var(--accent)}
    .osc .btn:active{transform:translateY(1px);box-shadow:none}
    .osc .btn.pri{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
    .osc .btn.pri:hover{filter:brightness(1.1);color:var(--on-accent)}
    .osc .btn.xs{height:22px;padding:0 10px;font-size:10.5px}
    .osc .btn.key{flex:1;height:25px;padding:0 6px;font-size:10.5px}
    .osc .btn.wide{width:100%;height:27px}
    .osc .btn.tall{height:32px;font-size:12.5px}

    /* ===== softkey tabs ===== */
    .osc .tabs{display:flex;gap:3px;padding:3px;margin:0 auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px}
    .osc .tab{height:26px;padding:0 16px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dim);font:600 11.5px "IBM Plex Sans",sans-serif;cursor:pointer;white-space:nowrap}
    .osc .tab:hover{color:var(--text)}
    .osc .tab.on{background:var(--panel);border-color:var(--line);color:var(--accent);box-shadow:0 1px 3px var(--shadow-1)}

    /* ===== side racks ===== */
    .osc .side{background:var(--panel2);border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0;overflow-y:auto}
    .osc .side.r{border-right:none;border-left:1px solid var(--line)}
    .osc .rack{display:flex;flex-direction:column}
    .osc .grp{display:flex;flex-direction:column;gap:7px;padding:11px 12px;border-bottom:1px solid var(--line)}
    .osc .grp.fill{flex:1}
    .osc .grp.accent{background:var(--accent-a1);box-shadow:inset 3px 0 0 var(--accent)}
    .osc .grp.accent .ttl{color:var(--accent)}
    .osc .ttl{margin:0;font:700 10px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .osc .row{display:flex;align-items:center;gap:8px}
    .osc .row.pad{gap:6px}
    .osc .lab{width:66px;flex-shrink:0;font-size:11px;color:var(--dim)}
    .osc .lab.w{width:80px}
    .osc .chk{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text);cursor:pointer}
    .osc .hint{font-size:10.5px;color:var(--dim);line-height:1.55}
    .osc .note{font-size:10.5px;color:var(--accent);min-height:0}
    /* Layout picker: a 6x6 of cells that highlights the rectangle from the
       top-left to whatever is hovered, the way a table picker does. Choosing
       "3 rows by 2 columns" is then one gesture instead of two dropdowns. */
    .lgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;flex:1}
    .lgrid i{display:block;height:13px;border:1px solid var(--line);border-radius:2px;background:var(--panel2);cursor:pointer}
    .lgrid i.in{background:var(--accent);border-color:var(--accent)}
    .lgrid i.cur{box-shadow:0 0 0 1px var(--accent)}
    .osc .readout{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:6px 8px}
    .osc .swatches{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}
    .osc .thsw{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--dim);cursor:pointer}
    .osc .thsw input[type="color"]{width:22px;height:18px;border:1px solid var(--line);border-radius:4px;padding:0;background:none;cursor:pointer;flex-shrink:0}
    .osc .thsw input[type="color"]::-webkit-color-swatch-wrapper{padding:1px}
    .osc .thsw input[type="color"]::-webkit-color-swatch{border:none;border-radius:2px}

    /* ===== fields ===== */
    .osc .in,.osc-in{height:26px;padding:0 8px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);font:11px "IBM Plex Sans",sans-serif;min-width:0;box-sizing:border-box}
    .osc .in.mono,.osc-in{font-family:"IBM Plex Mono",monospace}
    .osc .in:focus,.osc-in:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-a2);outline:none}
    .osc-in.invalid{border-color:var(--bad);box-shadow:0 0 0 2px var(--bad-a)}
    .osc .in.op{width:44px;padding:0 4px;text-align:center;flex-shrink:0;font-family:"IBM Plex Mono",monospace}
    .osc .in.slope{width:56px;padding:0 4px;flex-shrink:0}
    .osc .in.xs{height:22px;padding:0 6px;font-size:10.5px}

    /* ===== screens ===== */
    .osc .center{display:flex;flex-direction:column;min-width:0;min-height:0;padding:10px;overflow-y:auto}
    .osc .view{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}
    .osc .view.fft{grid-template-columns:1fr 340px;gap:8px}
    .osc .fft-plots{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
    .osc .fft-rdo{display:flex;flex-direction:column;gap:8px;min-height:0}
    .osc .g4{flex:4}
    .osc .g3{flex:3}
    .osc .scr{position:relative;flex:1;min-height:150px;border-radius:7px;overflow:hidden;background:var(--screen);border:1px solid var(--line);box-shadow:var(--bezel)}
    .osc .scr>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .osc .scr.fixed{flex:none}
    .osc .h128{height:128px}
    .osc .h160{height:160px}
    .osc .hover{display:none;position:absolute;top:8px;right:8px;margin:0;padding:6px 9px;background:var(--panel);border:1px solid var(--line);border-radius:5px;font:10.5px "IBM Plex Mono",monospace;line-height:1.5;color:var(--text);pointer-events:none;z-index:2;box-shadow:0 4px 14px var(--shadow-2)}
    .osc .corner{position:absolute;right:8px;top:6px;font:10px "IBM Plex Mono",monospace;color:var(--dim);pointer-events:none}

    /* ===== cards & tables ===== */
    .osc .card{background:var(--panel);border:1px solid var(--line);border-radius:7px;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}
    .osc .card.fill{flex:1;min-height:0}
    .osc .card.scroll{overflow-y:auto}
    .osc .card.meas{height:150px;margin-top:8px}
    .osc .card-hd{display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid var(--line);background:var(--panel2);flex-shrink:0}
    .osc .card-bd{flex:1;overflow-y:auto;min-height:0}
    .osc .tbl{width:100%;border-collapse:collapse}
    .osc .tbl th{position:sticky;top:0;background:var(--panel2);text-align:left;padding:5px 8px;font:600 9.5px "IBM Plex Sans",sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line)}
    /* the harmonics table carries six numeric columns in a 340px rail */
    .osc .fft-rdo .tbl th{padding:5px 5px;letter-spacing:.03em}
    .osc .fft-rdo .tbl td{padding:3px 5px;font-size:10.5px}
    .osc .row.top{align-items:flex-start}
    .osc .cmp-list{display:flex;flex-direction:column;gap:4px;max-height:132px;overflow-y:auto;min-width:0}
    .osc .cmp-list .chk{gap:6px;font-size:11px}
    .osc .cmp-list .hint{padding-top:2px}
    .osc .dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;vertical-align:middle;margin-right:5px}
    .osc .card.cmp{max-height:170px;overflow-y:auto}
    .osc .card.cmp td:first-child{max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* ===== THD / TDD readout ===== */
    .osc .rdo{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}
    .osc .rdo .cell{background:var(--panel);padding:9px 11px;min-width:0}
    .osc .rdo .k{font:700 9.5px "IBM Plex Sans",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
    .osc .rdo .v{font:600 23px "IBM Plex Mono",monospace;line-height:1.3;color:var(--accent);overflow:hidden;text-overflow:ellipsis}
    .osc .rdo .v.alt{color:var(--ok)}
    .osc .rdo .s{font-size:9.5px;color:var(--dim);line-height:1.4}
    .osc .meta{padding:8px 11px;border-top:1px solid var(--line);font-size:10.5px;color:var(--dim);line-height:1.55}

    /* ===== status bar ===== */
    .osc .stat{display:flex;align-items:center;gap:12px;height:28px;padding:0 14px;flex-shrink:0;background:linear-gradient(180deg,var(--panel2),var(--panel));border-top:1px solid var(--line);font:10.5px "IBM Plex Mono",monospace;color:var(--dim)}
    .osc .stat span:last-child{margin-left:auto;opacity:.75}

    /* ===== widgets built by the engine ===== */
    .osc-file{display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);font-size:11px}
    .osc-file .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--text)}
    .osc-file .mt{color:var(--dim);font:10px "IBM Plex Mono",monospace;flex-shrink:0}
    .osc-file button{border:none;background:none;color:var(--dim);cursor:pointer;font-size:12px;padding:0 2px;line-height:1}
    .osc-file button:hover{color:var(--bad)}
    .osc-ch{border:1px solid var(--line);border-radius:7px;background:var(--panel);padding:7px 8px;display:flex;flex-direction:column;gap:6px;border-left:3px solid var(--ch-color,var(--line))}
    .osc-ch.off{opacity:.5}
    .osc-ch .hd{display:flex;align-items:center;gap:6px}
    .osc-ch .sw{width:14px;height:14px;border:none;border-radius:3px;padding:0;cursor:pointer;background:none;flex-shrink:0}
    .osc-ch .sw::-webkit-color-swatch-wrapper{padding:0}
    .osc-ch .sw::-webkit-color-swatch{border:1px solid var(--line);border-radius:3px}
    .osc-ch .lbl{flex:1;border:1px solid transparent;background:transparent;font:600 11.5px "IBM Plex Sans",sans-serif;color:var(--text);border-radius:4px;padding:2px 3px;min-width:0}
    .osc-ch .lbl:hover{border-color:var(--line)}
    .osc-ch .lbl:focus{border-color:var(--accent);outline:none;background:var(--panel2)}
    .osc-ch .eye,.osc-ch .rm{border:none;background:none;cursor:pointer;font-size:12px;padding:1px 3px;color:var(--dim);line-height:1;border-radius:3px}
    .osc-ch .eye:hover,.osc-ch .rm:hover{background:var(--panel2);color:var(--text)}
    .osc-ch .rm:hover{color:var(--bad)}
    .osc-ch .ctl{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    .osc-ch .fld{display:flex;flex-direction:column;gap:2px;min-width:0}
    .osc-ch .fld .osc-in{width:100%;height:24px;padding:0 6px}
    .osc-ch .fld span{font:9px "IBM Plex Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
    .osc-ch .ft{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--dim)}
    .osc-ch .ft label{display:flex;align-items:center;gap:4px;cursor:pointer}
    .osc-ch select.osc-in{font-family:"IBM Plex Sans",sans-serif}
    .osc-ch .ft.panes,.osc-ch .ft.per,.osc-ch .ft.fou{border-top:1px dashed var(--line);padding-top:5px}
    .osc-ch .ft .pl{font:9px "IBM Plex Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);flex-shrink:0}
    .pane-grid{display:grid;gap:2px;flex:1}
    .pane-cell{border:1px solid var(--line);background:var(--panel2);color:var(--dim);border-radius:3px;
      font:9px "IBM Plex Mono",monospace;line-height:1;padding:3px 0;cursor:pointer;min-width:0}
    .pane-cell:hover{border-color:var(--accent);color:var(--text)}
    .pane-cell.on{background:var(--ch-color,var(--accent));border-color:var(--ch-color,var(--accent));color:#0b1118;font-weight:700}
    .osc-ch .perVal{font:9.5px "IBM Plex Mono",monospace;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .osc-pos-pop{position:fixed;z-index:9999;background:var(--panel);border:1px solid var(--line);border-radius:7px;box-shadow:0 8px 24px var(--shadow-2);padding:9px 11px;min-width:190px}
    .osc-pos-pop .hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
    .osc-pos-pop .hd span:first-child{font:9px "IBM Plex Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
    .osc-pos-pop .hd span:last-child{font:600 11px "IBM Plex Mono",monospace;color:var(--text)}
    .osc-pos-pop input[type="range"]{width:100%;display:block}
    .osc-pos-pop .sc{display:flex;justify-content:space-between;font:9.5px "IBM Plex Mono",monospace;color:var(--dim);margin-top:2px}
    .osc-tr td{padding:3px 8px;border-bottom:1px solid var(--line);font:11px "IBM Plex Mono",monospace;color:var(--text);white-space:nowrap}
    .osc-tr td:first-child{font-family:"IBM Plex Sans",sans-serif;font-weight:600}
    .osc-tr .dim{color:var(--dim)}
    .osc-htr{cursor:default}
    .osc-htr:hover td{background:var(--accent-a1)}
    .osc-htr.fund td{background:var(--accent-a1)}
    .osc-htr.over td{color:var(--bad)}
    .osc-empty{color:var(--dim);font-size:11px;padding:6px 2px;line-height:1.5}

    /* Last, so it beats the display value of any layout class it is combined
       with. Deliberately not !important: the engine toggles these elements back
       on with an inline style, which still wins. */
    .osc .ptb{display:flex;flex-wrap:wrap;align-items:center;gap:2px;padding:3px 6px;background:var(--panel2);border:1px solid var(--line);border-bottom:none;border-radius:6px 6px 0 0}
    .osc .ptb button{min-width:28px;height:26px;padding:0 6px;border:1px solid transparent;background:transparent;color:var(--text);border-radius:4px;cursor:pointer;font:12px/1 system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:4px}
    .osc .ptb button:hover:not(:disabled){background:var(--panel);border-color:var(--line)}
    .osc .ptb button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
    .osc .ptb button:disabled{opacity:.35;cursor:default}
    .osc .ptb svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
    .osc .ptb .sep{width:1px;height:18px;background:var(--line);margin:0 4px}
    .osc .hover{right:16px;bottom:44px;top:auto}
    .osc .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:middle}
    .osc .hide{display:none}
    `;
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- file loading ----------
  function loadFile(file) {
    const reader = new FileReader();
    const id = nextId();
    R.loadStatus.textContent = "Reading " + file.name + "…";
    reader.onload = () => {
      const worker = getWorker();
      const onMsg = (e) => {
        const msg = e.data;
        if (msg.id !== id) return;
        if (msg.type === "progress") R.loadStatus.textContent = "Parsing " + file.name + "… " + msg.pct + "%";
        else if (msg.type === "error") {
          R.loadStatus.textContent = "Error in " + file.name + ": " + msg.message;
          worker.removeEventListener("message", onMsg);
        } else if (msg.type === "done") {
          worker.removeEventListener("message", onMsg);
          onFileParsed(file.name, msg);
          R.loadStatus.textContent = file.name + " loaded (" + msg.rowCount.toLocaleString() + " samples)";
          setTimeout(() => { if (R.loadStatus.textContent.indexOf(file.name) !== -1) R.loadStatus.textContent = ""; }, 4000);
        }
      };
      worker.addEventListener("message", onMsg);
      worker.postMessage({ id, buffer: reader.result }, [reader.result]);
    };
    reader.readAsArrayBuffer(file);
  }

  function onFileParsed(name, msg) {
    const t0 = msg.time.length ? msg.time[0] : 0;
    const t1 = msg.time.length ? msg.time[msg.time.length - 1] : 0;
    const dt = msg.rowCount > 1 ? (t1 - t0) / (msg.rowCount - 1) : 1;
    const values = {};
    msg.columns.forEach((c, idx) => { values[c.name] = msg.values[idx]; });
    const fileObj = { id: nextId(), name, rowCount: msg.rowCount, time: msg.time, t0, t1, dt, columns: msg.columns, values };
    S.files.push(fileObj);
    const shortLabel = name.replace(/\.csv$/i, "");
    msg.columns.forEach((c) => {
      const data = values[c.name];
      const stats = computeStats(data, 0, data.length - 1);
      const colorIdx = nextColorIdx();
      const ch = {
        id: nextId(), isMath: false, fileId: fileObj.id, key: c.name,
        label: shortLabel + ":" + c.name, unit: c.unit || "",
        colorIdx: colorIdx, color: colorFor(colorIdx), autoColor: true, visible: true, invert: false,
        voltsPerDiv: 1, position: 0, avgN: 1, hiresN: 1, tOffset: 0, fullStats: stats,
        panes: [0], periodic: false, periodMode: "auto", periodT: 0,
        reconOn: true, f0Mode: "auto", f0: 0
      };
      autoscaleChannel(ch);
      S.channels.push(ch);
    });
    rebuildFileList();
    rebuildChannelList();
    rebuildSelects();
    fillAutoF0(false);       // the box should already hold the right f₁ on arrival
    if (S.files.length === 1) fitAll(); else render();
    scheduleMeasure();
    scheduleSplit();
  }

  function computeStats(data, iStart, iEnd) {
    if (iEnd < iStart) return { min: 0, max: 0, mean: 0, rms: 0, n: 0 };
    let mn = Infinity, mx = -Infinity, sum = 0, sumSq = 0;
    for (let i = iStart; i <= iEnd; i++) {
      const v = data[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
      sum += v; sumSq += v * v;
    }
    const n = Math.max(1, iEnd - iStart + 1);
    const mean = sum / n;
    const rms = Math.sqrt(sumSq / n);
    return { min: mn, max: mx, mean, rms, n };
  }
  const getFile = (ch) => S.files.find(f => f.id === ch.fileId) || null;
  function getRawData(ch) { return ch.isMath ? ch.data : (getFile(ch) ? getFile(ch).values[ch.key] : null); }
  function movingAvg(data, n) {
    const N = data.length, out = new Float32Array(N);
    if (n <= 1 || N === 0) { out.set(data); return out; }
    const prefix = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) prefix[i + 1] = prefix[i] + data[i];
    const half = Math.floor(n / 2);
    for (let i = 0; i < N; i++) {
      let lo = i - half, hi = i + (n - half) - 1;
      if (lo < 0) lo = 0;
      if (hi > N - 1) hi = N - 1;
      out[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
    }
    return out;
  }
  function getAvgData(ch) {
    const raw = getRawData(ch);
    if (!raw) return null;
    if (!ch.avgN || ch.avgN <= 1) return raw;
    if (!ch.avgCache || ch.avgCache.n !== ch.avgN) ch.avgCache = { n: ch.avgN, data: movingAvg(raw, ch.avgN) };
    return ch.avgCache.data;
  }
  function getRawTime(ch) { return ch.isMath ? ch.time : (getFile(ch) ? getFile(ch).time : null); }
  // High Resolution mode: block-averages N consecutive samples into one (boxcar
  // decimation), like a scope's HiRes acquisition — gains ~log4(N) bits of
  // vertical resolution at the cost of sample rate. Independent of Avg.
  function ensureHiresCache(ch) {
    const n = ch.hiresN;
    if (ch.hiresCache && ch.hiresCache.n === n && ch.hiresCache.avgN === (ch.avgN || 1)) return ch.hiresCache;
    const data = getAvgData(ch), time = getRawTime(ch);
    if (!data || !time) return null;
    const N = Math.min(data.length, time.length), M = Math.floor(N / n);
    const od = new Float32Array(M), ot = new Float64Array(M);
    for (let b = 0; b < M; b++) {
      let sd = 0, st = 0;
      const base = b * n;
      for (let j = 0; j < n; j++) { sd += data[base + j]; st += time[base + j]; }
      od[b] = sd / n; ot[b] = st / n;
    }
    ch.hiresCache = { n, avgN: ch.avgN || 1, data: od, time: ot };
    return ch.hiresCache;
  }
  function getData(ch) {
    if (!ch.hiresN || ch.hiresN <= 1) return getAvgData(ch);
    const c = ensureHiresCache(ch);
    return c ? c.data : null;
  }
  function getTime(ch) {
    let t;
    if (!ch.hiresN || ch.hiresN <= 1) t = getRawTime(ch);
    else { const c = ensureHiresCache(ch); t = c ? c.time : null; }
    if (!t) return null;
    const off = ch.tOffset || 0;
    if (!off) return t;
    if (!ch.tOffCache || ch.tOffCache.src !== t || ch.tOffCache.off !== off) {
      const s = new Float64Array(t.length);
      for (let i = 0; i < t.length; i++) s[i] = t[i] + off;
      ch.tOffCache = { src: t, off, time: s };
    }
    return ch.tOffCache.time;
  }
  function autoscaleChannel(ch) {
    const span = Math.max(ch.fullStats.max - ch.fullStats.min, 1e-12);
    const target = span / (S.divsV - 2);
    const steps = decadeSteps(target / 20, target * 20);
    ch.voltsPerDiv = nearestStep(steps.length ? steps : [1], target);
    const mid = (ch.fullStats.max + ch.fullStats.min) / 2;
    ch.position = -(ch.invert ? -mid : mid) / ch.voltsPerDiv;
  }

  // ---------- left panel UI ----------
  function rebuildFileList() {
    R.fileList.innerHTML = "";
    if (S.files.length === 0) {
      R.fileList.innerHTML = '<div class="osc-empty">No files loaded. Click "Load CSV" or drop files onto the display.</div>';
      return;
    }
    S.files.forEach(f => {
      const div = document.createElement("div");
      div.className = "osc-file";
      div.innerHTML = '<span class="nm" title="' + f.name + '">' + f.name + '</span><span class="mt">' + f.rowCount.toLocaleString() + ' pts</span><button title="Remove">✕</button>';
      div.querySelector("button").addEventListener("click", () => removeFile(f.id));
      R.fileList.appendChild(div);
    });
  }
  function removeFile(fileId) {
    S.files = S.files.filter(f => f.id !== fileId);
    S.channels = S.channels.filter(ch => ch.isMath || ch.fileId !== fileId);
    S.channels = S.channels.filter(ch => !ch.isMath || (S.channels.some(c => c.id === ch.mathA) && S.channels.some(c => c.id === ch.mathB)));
    S.fft = null; S.harm = null; S.series = [];
    rebuildFileList(); rebuildChannelList(); rebuildSelects();
    render(); scheduleMeasure(); scheduleSplit(); renderFFTView(); renderXY();
  }

  // ---------- position slider popover ----------
  let posPopEl = null, posPopCh = null;
  function ensurePosPopover() {
    if (posPopEl) return posPopEl;
    posPopEl = document.createElement("div");
    posPopEl.className = "osc-pos-pop";
    posPopEl.style.display = "none";
    posPopEl.innerHTML = '<div class="hd"><span>Position (div)</span><span class="val">0.00</span></div>' +
      '<input type="range" min="-8" max="8" step="0.01">' +
      '<div class="sc"><span>-8</span><span>0</span><span>+8</span></div>';
    document.body.appendChild(posPopEl);
    const range = posPopEl.querySelector('input[type="range"]');
    range.addEventListener("input", () => {
      if (!posPopCh) return;
      if (S.yMode !== "div") { setYMode("div"); updateToolbar(); }
      posPopCh.position = clamp(parseFloat(range.value), -8, 8);
      posPopEl.querySelector(".val").textContent = posPopCh.position.toFixed(2);
      syncChannelCard(posPopCh);
      render();
    });
    document.addEventListener("mousedown", (e) => {
      if (posPopEl.style.display === "none") return;
      if (posPopEl.contains(e.target) || (e.target.classList && e.target.classList.contains("pos"))) return;
      posPopEl.style.display = "none";
      posPopCh = null;
    }, true);
    window.addEventListener("scroll", () => { posPopEl.style.display = "none"; posPopCh = null; }, true);
    return posPopEl;
  }
  function openPosPopover(ch, anchorEl) {
    const pop = ensurePosPopover();
    posPopCh = ch;
    pop.querySelector('input[type="range"]').value = ch.position;
    pop.querySelector(".val").textContent = ch.position.toFixed(2);
    const r = anchorEl.getBoundingClientRect();
    pop.style.display = "block";
    const popW = pop.offsetWidth || 190;
    let left = r.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = (r.bottom + 6) + "px";
  }

  const AVG_OPTS = [1, 2, 4, 8, 16, 32, 64, 128];
  const HIRES_OPTS = [[1, "Off"], [4, "+1 bit"], [16, "+2 bit"], [64, "+3 bit"], [256, "+4 bit"]];
  /* Which panes a channel is drawn in, shown as a miniature of the layout
     itself rather than as a list of numbers: with up to 36 panes, a
     multi-select of "Pane 23" is unreadable, whereas a 6×6 of little cells is
     the same shape as what is on screen. Hidden entirely at 1×1, where there
     is nothing to choose. */
  function panePickerHtml(ch) {
    if (!isGrid()) return "";
    const rows = clamp(S.layout.rows | 0, 1, MAX_GRID), cols = clamp(S.layout.cols | 0, 1, MAX_GRID);
    const on = panesOf(ch);
    let cells = "";
    for (let i = 0; i < rows * cols; i++) {
      cells += '<button class="pane-cell' + (on.indexOf(i) !== -1 ? " on" : "") + '" data-pane="' + i +
        '" title="Plot ' + (i + 1) + '">' + (i + 1) + "</button>";
    }
    return '<div class="ft panes"><span class="pl">Plot</span>' +
      '<div class="pane-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + cells + "</div></div>";
  }

  /* Periodic repeat. The resolved period is spelled out next to the control
     because "auto" is a measurement, and a number the user cannot see is a
     number they cannot check against their own expectation. */
  function periodicHtml(ch) {
    const modes = [["auto", "auto"], ["record", "record"], ["manual", "manual"]];
    const opts = modes.map(m => '<option value="' + m[0] + '"' + ((ch.periodMode || "auto") === m[0] ? " selected" : "") + ">" + m[1] + "</option>").join("");
    const T = ch.periodic ? resolvePeriod(ch) : null;
    const shown = ch.periodic ? (T ? fmtScale(T, "s") + (ch.periodMode === "auto" ? " (detected)" : "") : "no period found") : "";
    return '<div class="ft per">' +
      '<label title="Repeat the wave forwards and backwards without end, so the record can be scrolled past its own start and finish."><input type="checkbox" class="perOn"' + (ch.periodic ? " checked" : "") + '> Periodic</label>' +
      (ch.periodic
        ? '<select class="osc-in perMode" style="height:20px;padding:0 2px">' + opts + "</select>" +
          (ch.periodMode === "manual"
            ? '<input type="text" class="osc-in perT" style="height:20px;width:66px" value="' + fmtScale(ch.periodT || 0, "s") + '" title="e.g. 20m, 16.667m">'
            : '<span class="perVal">' + shown + "</span>")
        : "") +
      "</div>";
  }

  /* The Fourier row only appears while the overlay is on: it is the one
     control whose whole purpose is invisible otherwise, and three permanent
     extra rows per card pushed everything else off the panel. */
  function fourierHtml(ch) {
    if (!S.recon.on) return "";
    const auto = (ch.f0Mode || "auto") === "auto";
    const det = autoFundamental(ch);
    const f0 = channelF0(ch);
    const H = f0 ? ensureHarm(ch) : null;
    const bad = !f0 ? "no fundamental found" : (H && H.error ? H.error : "");
    return '<div class="ft fou">' +
      '<label title="Draw this channel\'s Fourier reconstruction over its trace."><input type="checkbox" class="recOn"' + (ch.reconOn === false ? "" : " checked") + '> Fourier</label>' +
      '<select class="osc-in f0Mode" style="height:20px;padding:0 2px"><option value="auto"' + (auto ? " selected" : "") + ">auto</option><option value=\"manual\"" + (auto ? "" : " selected") + ">manual</option></select>" +
      (auto
        ? '<span class="perVal" title="' + (bad ? bad.replace(/"/g, "&quot;") : "Detected from the zero crossings of the whole record") + '">' +
            (det ? fmtScale(det, "Hz") : "—") + "</span>"
        : '<input type="text" class="osc-in f0In2" style="height:20px;width:70px" value="' + fmtScale(ch.f0 || 0, "Hz") + '" title="e.g. 50, 60, 1k">') +
      (bad && !H ? '<span class="perVal" style="color:var(--bad)">!</span>' : "") +
      "</div>";
  }

  function rebuildChannelList() {
    R.channelList.innerHTML = "";
    if (S.channels.length === 0) {
      R.channelList.innerHTML = '<div class="osc-empty">Load a CSV to see its channels here.</div>';
      return;
    }
    S.channels.forEach(ch => {
      const card = document.createElement("div");
      card.className = "osc-ch" + (ch.visible ? "" : " off");
      card.style.setProperty("--ch-color", ch.color);  // colour rail down the left edge
      const avgHtml = AVG_OPTS.map(n => '<option value="' + n + '"' + (ch.avgN === n ? " selected" : "") + '>' + (n === 1 ? "Off" : n + "×") + "</option>").join("");
      const hiresHtml = HIRES_OPTS.map(o => '<option value="' + o[0] + '"' + (ch.hiresN === o[0] ? " selected" : "") + '>' + o[1] + "</option>").join("");
      card.innerHTML =
        '<div class="hd">' +
        '<input type="color" class="sw" value="' + ch.color + '" title="Trace color">' +
        '<input type="text" class="lbl" value="' + ch.label.replace(/"/g, "&quot;") + '">' +
        '<button class="eye" title="Show / hide">' + (ch.visible ? "👁" : "◡") + '</button>' +
        (ch.isMath ? '<button class="rm" title="Delete channel">✕</button>' : "") +
        '</div>' +
        '<div class="ctl">' +
        '<div class="fld"><span>Scale / div</span><input type="text" class="osc-in vdiv" value="' + fmtScale(ch.voltsPerDiv, ch.unit) + '"></div>' +
        '<div class="fld"><span>Position (div)</span><input type="text" class="osc-in pos" value="' + ch.position.toFixed(2) + '"></div>' +
        '<div class="fld"><span>Δt offset (s)</span><input type="text" class="osc-in toff" title="Horizontal time offset for this trace, e.g. 2m, -500u" value="' + fmtScale(ch.tOffset || 0, "s") + '"></div>' +
        '</div>' +
        '<div class="ft">' +
        '<label><input type="checkbox" class="inv"' + (ch.invert ? " checked" : "") + '> Invert</label>' +
        '<label>Avg <select class="osc-in avg" style="height:20px;padding:0 2px">' + avgHtml + '</select></label>' +
        '<label title="High Resolution: block-averages consecutive samples (boxcar decimation) for extra vertical resolution. Independent of Avg.">HiRes <select class="osc-in hires" style="height:20px;padding:0 2px">' + hiresHtml + '</select></label>' +
        '<span style="margin-left:auto;font:10px \'IBM Plex Mono\',monospace">' + (ch.unit || "·") + '</span>' +
        '</div>' +
        panePickerHtml(ch) +
        periodicHtml(ch) +
        fourierHtml(ch);
      card.querySelector(".sw").addEventListener("input", e => {
        ch.color = e.target.value;
        ch.autoColor = false;  // hand-picked: stop following the theme palette
        card.style.setProperty("--ch-color", ch.color);
        renderAll();
      });
      card.querySelector(".lbl").addEventListener("change", e => { ch.label = e.target.value; rebuildSelects(); renderAll(); });
      card.querySelector(".eye").addEventListener("click", () => { ch.visible = !ch.visible; rebuildChannelList(); renderAll(); scheduleMeasure(); });
      const vdiv = card.querySelector(".vdiv");
      vdiv.addEventListener("change", () => {
        const p = parseScaleInput(vdiv.value);
        if (p !== null && p > 0) { if (S.yMode !== "div") { setYMode("div"); updateToolbar(); } ch.voltsPerDiv = p; }
        else { vdiv.classList.add("invalid"); setTimeout(() => vdiv.classList.remove("invalid"), 700); }
        vdiv.value = fmtScale(ch.voltsPerDiv, ch.unit);
        render();
      });
      const pos = card.querySelector(".pos");
      pos.addEventListener("change", () => {
        const v = parseFloat(pos.value);
        if (isFinite(v)) { if (S.yMode !== "div") { setYMode("div"); updateToolbar(); } ch.position = clamp(v, -8, 8); }
        pos.value = ch.position.toFixed(2);
        if (posPopCh === ch) { ensurePosPopover().querySelector('input[type="range"]').value = ch.position; ensurePosPopover().querySelector(".val").textContent = ch.position.toFixed(2); }
        render();
      });
      pos.addEventListener("focus", () => openPosPopover(ch, pos));
      pos.addEventListener("click", () => openPosPopover(ch, pos));
      const toff = card.querySelector(".toff");
      toff.addEventListener("change", () => {
        const p = parseScaleInput(toff.value);
        if (p !== null) { ch.tOffset = p; ch.tOffCache = null; }
        else { toff.classList.add("invalid"); setTimeout(() => toff.classList.remove("invalid"), 700); }
        toff.value = fmtScale(ch.tOffset || 0, "s");
        renderAll(); scheduleMeasure();
      });
      [vdiv, pos, toff].forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); }));
      card.querySelector(".inv").addEventListener("change", e => { ch.invert = e.target.checked; renderAll(); scheduleMeasure(); });
      card.querySelector(".avg").addEventListener("change", e => { ch.avgN = parseInt(e.target.value, 10); renderAll(); scheduleMeasure(); });
      card.querySelector(".hires").addEventListener("change", e => { ch.hiresN = parseInt(e.target.value, 10); renderAll(); scheduleMeasure(); });
      card.querySelectorAll(".pane-cell").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = parseInt(btn.dataset.pane, 10);
          const cur = panesOf(ch).slice();
          const at = cur.indexOf(i);
          /* Refusing to remove the last one keeps the invariant panesOf()
             relies on: a visible channel is always drawn somewhere. */
          if (at === -1) cur.push(i);
          else if (cur.length > 1) cur.splice(at, 1);
          else return;
          ch.panes = cur.sort((a, b) => a - b);
          rebuildChannelList(); render();
        });
      });
      /* Periodic changes what the visible window contains, so the measurements
         have to be recomputed too — renderAll() alone only repaints. */
      const perOn = card.querySelector(".perOn");
      if (perOn) perOn.addEventListener("change", e => {
        ch.periodic = e.target.checked;
        ch.perCache = null;
        rebuildChannelList(); renderAll(); scheduleMeasure();
      });
      const perMode = card.querySelector(".perMode");
      if (perMode) perMode.addEventListener("change", e => {
        ch.periodMode = e.target.value;
        ch.perCache = null;
        if (ch.periodMode === "manual" && !(ch.periodT > 0)) ch.periodT = resolvePeriod(ch) || 0;
        rebuildChannelList(); renderAll(); scheduleMeasure();
      });
      const perT = card.querySelector(".perT");
      if (perT) {
        perT.addEventListener("change", () => {
          const p = parseScaleInput(perT.value);
          if (p !== null && p > 0) { ch.periodT = p; ch.perCache = null; }
          else { perT.classList.add("invalid"); setTimeout(() => perT.classList.remove("invalid"), 700); }
          perT.value = fmtScale(ch.periodT || 0, "s");
          renderAll(); scheduleMeasure();
        });
        perT.addEventListener("keydown", e => { if (e.key === "Enter") perT.blur(); });
      }
      const recOn = card.querySelector(".recOn");
      if (recOn) recOn.addEventListener("change", e => {
        ch.reconOn = e.target.checked;
        syncReconUI(); render();
      });
      const f0Mode = card.querySelector(".f0Mode");
      if (f0Mode) f0Mode.addEventListener("change", e => {
        ch.f0Mode = e.target.value;
        if (ch.f0Mode === "manual" && !(ch.f0 > 0)) ch.f0 = autoFundamental(ch) || 50;
        rebuildChannelList(); syncReconUI(); render();
      });
      const f0In2 = card.querySelector(".f0In2");
      if (f0In2) {
        f0In2.addEventListener("change", () => {
          const p = parseScaleInput(f0In2.value);
          if (p !== null && p > 0) ch.f0 = p;
          else { f0In2.classList.add("invalid"); setTimeout(() => f0In2.classList.remove("invalid"), 700); }
          f0In2.value = fmtScale(ch.f0 || 0, "Hz");
          syncReconUI(); render();
        });
        f0In2.addEventListener("keydown", e => { if (e.key === "Enter") f0In2.blur(); });
      }
      const rm = card.querySelector(".rm");
      if (rm) rm.addEventListener("click", () => removeChannel(ch.id));
      R.channelList.appendChild(card);
    });
  }
  function removeChannel(chId) {
    S.channels = S.channels.filter(c => c.id !== chId && !(c.isMath && (c.mathA === chId || c.mathB === chId)));
    rebuildChannelList(); rebuildSelects();
    renderAll(); scheduleMeasure();
  }
  function syncChannelCard(ch) {
    const cards = R.channelList.querySelectorAll(".osc-ch");
    const idx = S.channels.indexOf(ch);
    if (idx >= 0 && cards[idx]) {
      const pos = cards[idx].querySelector(".pos");
      if (pos && document.activeElement !== pos) pos.value = ch.position.toFixed(2);
    }
    if (posPopCh === ch && posPopEl && posPopEl.style.display !== "none") {
      posPopEl.querySelector('input[type="range"]').value = ch.position;
      posPopEl.querySelector(".val").textContent = ch.position.toFixed(2);
    }
  }

  function rebuildSelects() {
    const opts = S.channels.map(c => '<option value="' + c.id + '">' + c.label + '</option>').join("");
    const keep = (sel, prev, allowEmpty) => {
      if (S.channels.some(c => c.id === prev)) sel.value = prev;
      else if (!allowEmpty && S.channels.length) sel.value = S.channels[0].id;
    };
    const sels = [
      [R.trigSource, '<option value="">None</option>', true],
      [R.mathA, "", false], [R.mathB, "", false],
      [R.cursorRef, "", false],
      [R.fftSource, "", false],
      [R.xySrcX, "", false], [R.xySrcY, "", false]
    ];
    sels.forEach(([sel, extra, allowEmpty]) => {
      const prev = sel.value;
      sel.innerHTML = extra + opts;
      keep(sel, prev, allowEmpty);
    });
    if (S.channels.length > 1 && !S.channels.some(c => c.id === S.xy.yId)) R.xySrcY.value = S.channels[1].id;
    S.trigger.sourceId = R.trigSource.value;
    S.cursors.refId = R.cursorRef.value;
    S.xy.xId = R.xySrcX.value; S.xy.yId = R.xySrcY.value;
    buildCompareList();
  }

  /* One tick per channel other than the source, as many as wanted. The set is
     kept in S.fftCompare rather than read back from the DOM, so rebuilding the
     list (a rename, a new file) does not forget what was ticked; a channel that
     no longer exists, or has just become the source, drops out of it here. */
  function buildCompareList() {
    const src = R.fftSource.value;
    S.fftCompare = S.fftCompare.filter(id => id !== src && S.channels.some(c => c.id === id));
    S.series = S.series.filter(x => S.channels.includes(x.ch));
    const others = S.channels.filter(c => c.id !== src);
    R.fftCompareList.innerHTML = others.length ? "" : '<div class="hint">Load a second channel to compare spectra.</div>';
    others.forEach(ch => {
      const lab = document.createElement("label");
      lab.className = "chk";
      lab.title = "Overlay " + ch.label + " on the source's spectrum, magnitudes and phases";
      lab.innerHTML = '<input type="checkbox"' + (S.fftCompare.includes(ch.id) ? " checked" : "") + '><span class="dot"></span><span></span>';
      lab.querySelector(".dot").style.background = ch.color;
      lab.lastChild.textContent = ch.label;
      lab.querySelector("input").addEventListener("change", e => {
        const on = new Set(S.fftCompare);
        if (e.target.checked) on.add(ch.id); else on.delete(ch.id);
        S.fftCompare = S.channels.filter(c => on.has(c.id)).map(c => c.id);
        if (S.harm || S.fft) runAnalysis();
      });
      R.fftCompareList.appendChild(lab);
    });
  }

  // ---------- horizontal ----------
  function updateTimeDivOptions() {
    if (S.files.length === 0) return;
    const minDt = Math.min(...S.files.map(f => f.dt));
    const maxSpan = Math.max(...S.files.map(f => f.t1 - f.t0));
    const steps = decadeSteps(minDt * 4, Math.max(maxSpan, minDt * 40));
    S.timeDivOptions = steps.length ? steps : [1e-3];
    R.timeDiv.innerHTML = S.timeDivOptions.map(s => '<option value="' + s + '">' + fmt(s, "s", 0) + "/div</option>").join("");
  }
  function syncTimeDivUI() {
    const tpd = S.timePerDiv;
    let hit = S.timeDivOptions.find(v => Math.abs(v - tpd) <= tpd * 1e-9);
    const old = R.timeDiv.querySelector("option[data-custom]");
    if (old) old.remove();
    if (hit === undefined) {
      const o = document.createElement("option");
      o.value = String(tpd); o.dataset.custom = "1"; o.textContent = fmt(tpd, "s") + "/div";
      R.timeDiv.insertBefore(o, R.timeDiv.firstChild);
      hit = tpd;
    }
    R.timeDiv.value = String(hit);
    if (document.activeElement !== R.hOffsetIn) R.hOffsetIn.value = (S.hOffset * 1000).toPrecision(6);
    const w = viewWindow();
    if (R.tStartIn && document.activeElement !== R.tStartIn) R.tStartIn.value = String(+(w.tA * 1000).toPrecision(6));
    if (R.tEndIn && document.activeElement !== R.tEndIn) R.tEndIn.value = String(+(w.tB * 1000).toPrecision(6));
  }
  function zoomHStep(dir) {
    const steps = S.timeDivOptions;
    if (!steps.length) return;
    const tpd = S.timePerDiv;
    let next = dir > 0 ? steps.find(v => v > tpd * (1 + 1e-9)) : [...steps].reverse().find(v => v < tpd * (1 - 1e-9));
    if (next === undefined) return;
    pushHist();
    S.timePerDiv = next;
    afterView();
  }
  function fitTimeWin() {
    if (S.files.length === 0) return;
    const t0 = Math.min(...S.files.map(f => f.t0));
    const t1 = Math.max(...S.files.map(f => f.t1));
    updateTimeDivOptions();
    const span = Math.max(t1 - t0, 1e-9);
    S.timePerDiv = span / S.divsH;
    S.hOffset = (t0 + t1) / 2;
    S.zoomT = S.hOffset;
    S.zoomSpan = span / 10;
  }
  function fitAll() { fitTimeWin(); afterView(); }

  // ---------- pane layout ----------
  /* The plots of the grid, in reading order, as rectangles on the scope
     canvas. Each rectangle is the PLOT AREA only: like a PLECS scope, every
     plot carries its y axis (tick labels and unit) in a gutter to its left,
     and the time axis is labelled once, under the bottom row. A 1×1 layout is
     a single plot, and `fullPane()` is then that same rectangle.

     Plots share the time base by design: one window for the whole screen.
     Splitting the traces apart vertically is the point; making each plot
     show a different slice of time would break the one thing the grid is
     for, which is comparing them at the same instant. */
  const MAX_GRID = 6;
  let paneCache = null;
  function invalidatePanes() { paneCache = null; }
  /* Gutter sizes. The left one holds tick labels and the rotated unit title;
     narrower when there are many columns, so a 6-wide grid still has plots. */
  function gutters(cols, w) {
    const L = cols >= 4 || w / cols < 260 ? 46 : 62;
    return { L, R: 12, T: 10, B: 34, gapX: 10, gapY: 12 };
  }
  function paneRects() {
    const c = CV.scope;
    const rows = clamp(S.layout.rows | 0, 1, MAX_GRID), cols = clamp(S.layout.cols | 0, 1, MAX_GRID);
    if (paneCache && paneCache.w === c.w && paneCache.h === c.h && paneCache.rows === rows && paneCache.cols === cols)
      return paneCache.list;
    const g = gutters(cols, c.w);
    const pw = Math.max(10, (c.w - cols * g.L - (cols - 1) * g.gapX - g.R) / cols);
    const ph = Math.max(10, (c.h - g.T - g.B - (rows - 1) * g.gapY) / rows);
    const list = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      list.push({ i: r * cols + k, row: r, col: k,
        x: Math.round(g.L + k * (g.L + pw + g.gapX)), y: Math.round(g.T + r * (ph + g.gapY)),
        w: Math.floor(pw), h: Math.floor(ph), showX: r === rows - 1, gL: g.L, gB: g.B });
    }
    paneCache = { w: c.w, h: c.h, rows, cols, list };
    return list;
  }
  const paneCount = () => clamp(S.layout.rows | 0, 1, MAX_GRID) * clamp(S.layout.cols | 0, 1, MAX_GRID);
  const isGrid = () => paneCount() > 1;
  /* Pane 0 is the fallback everywhere: a channel must always be somewhere, or
     it would silently vanish from the screen with its "visible" eye still on. */
  function panesOf(ch) {
    const n = paneCount();
    const list = (ch.panes || []).filter(i => i >= 0 && i < n);
    return list.length ? list : [0];
  }
  function chansOfPane(p) {
    return S.channels.filter(ch => ch.visible && panesOf(ch).indexOf(p.i) !== -1);
  }
  /* Shrinking the grid (3×3 → 2×2) strands every channel assigned to a pane
     that no longer exists. Folding them back with a modulo keeps them on
     screen and keeps their relative spread, rather than dumping them all into
     pane 0 in a heap. */
  function remapPanes() {
    const n = paneCount();
    S.channels.forEach(ch => {
      const src = (ch.panes && ch.panes.length) ? ch.panes : [0];
      const out = [];
      src.forEach(i => { const j = i < n ? i : i % n; if (out.indexOf(j) === -1) out.push(j); });
      ch.panes = out.length ? out.sort((a, b) => a - b) : [0];
    });
  }
  const paneAt = (x, y) => paneRects().find(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || null;
  /* The axis bands around a plot are live too, as in PLECS: dragging the y
     axis pans that plot vertically, the wheel over it zooms it, and a
     double-click hands it back to auto-scale. The time axis under the bottom
     row does the same for time. */
  function gutterAt(x, y) {
    for (const P of paneRects()) {
      if (x >= P.x - P.gL && x < P.x && y >= P.y && y <= P.y + P.h) return { P, side: "y" };
      if (P.showX && x >= P.x && x <= P.x + P.w && y > P.y + P.h && y <= P.y + P.h + P.gB) return { P, side: "x" };
    }
    return null;
  }
  function fullPane() {
    const l = paneRects(), a = l[0], b = l[l.length - 1];
    if (!a) return { i: 0, row: 0, col: 0, x: 0, y: 0, w: CV.scope.w, h: CV.scope.h };
    return { i: 0, row: 0, col: 0, x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y, showX: true, gL: a.gL, gB: a.gB };
  }
  /* The visible time window. Shared by every pane, so it is a property of the
     time base alone — asking a canvas how wide it is would give the same
     answer and break when nothing has been laid out yet. */
  function viewWindow() {
    const span = S.timePerDiv * S.divsH;
    return { tA: S.hOffset - span / 2, tB: S.hOffset + span / 2 };
  }

  // ---------- y axes ----------
  /* "Nice" tick positions: 1, 2 or 5 times a power of ten, about `n` of them
     across the range — the same rule every plotting package uses, so the
     numbers read as round ones. */
  function niceStep(span, n) {
    const raw = Math.abs(span) / Math.max(1, n);
    if (!(raw > 0) || !isFinite(raw)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function niceTicks(min, max, n) {
    const step = niceStep(max - min, n);
    const out = [];
    const k0 = Math.ceil(min / step - 1e-9), k1 = Math.floor(max / step + 1e-9);
    for (let k = k0; k <= k1 && out.length < 200; k++) out.push(k * step);
    return { step, ticks: out };
  }
  /* One SI prefix for the whole axis, chosen by its largest magnitude, so the
     labels are short plain numbers and the prefix goes once into the title:
     "−200 … 200" under "[mV]", never "−200m, −100m, 0, 100m…". */
  function axisPrefix(min, max) {
    const av = Math.max(Math.abs(min), Math.abs(max));
    let ch = { e: 0, s: "" };
    if (av > 0) for (const p of SI) if (av >= Math.pow(10, p.e) * 0.999) ch = p;
    return { mult: Math.pow(10, ch.e), s: ch.s };
  }
  function tickLabel(v, step, mult) {
    const d = clamp(-Math.floor(Math.log10(step / mult) + 1e-9), 0, 6);
    const x = v / mult;
    const s = (Math.abs(x) < step / mult * 1e-6 ? 0 : x).toFixed(d);
    return s.replace("-", "−");
  }
  function axisOf(i) {
    if (!S.axes[i]) S.axes[i] = { auto: true, min: -1, max: 1 };
    return S.axes[i];
  }
  /* The displayed range of every channel in a plot, padded. Uses the whole
     record's statistics, not the window, so auto-scale does not breathe while
     panning — a y axis that rescales under the mouse is unreadable. Inverted
     channels contribute their mirrored range, since that is what is drawn. */
  function autoRange(i) {
    let lo = Infinity, hi = -Infinity;
    for (const ch of S.channels) {
      if (!ch.visible || panesOf(ch).indexOf(i) === -1 || !ch.fullStats) continue;
      const a = ch.invert ? -ch.fullStats.max : ch.fullStats.min;
      const b = ch.invert ? -ch.fullStats.min : ch.fullStats.max;
      if (isFinite(a) && a < lo) lo = a;
      if (isFinite(b) && b > hi) hi = b;
    }
    if (!(hi >= lo)) return { min: -1, max: 1 };
    let span = hi - lo;
    if (span <= Math.abs(hi) * 1e-9 || span === 0) {
      const m = Math.abs(hi) || 1;
      return { min: lo - m * 0.5, max: hi + m * 0.5 };
    }
    return { min: lo - span * 0.06, max: hi + span * 0.06 };
  }
  function yRange(i) {
    const ax = axisOf(i);
    if (ax.auto) return autoRange(i);
    return (ax.max > ax.min) ? ax : { min: ax.min - 1, max: ax.min + 1 };
  }
  /* Freezes a plot's axis where it currently is — the step before any manual
     Y zoom or pan, so the first drag starts from what is on screen. */
  function fixAxis(i) {
    const r = yRange(i), ax = axisOf(i);
    ax.min = r.min; ax.max = r.max; ax.auto = false;
    return ax;
  }

  // ---------- coordinates ----------
  /* All of them take the plot they are measured in. The default is the whole
     plot area, which is exactly the 1×1 case. */
  function timeToX(t, P) {
    P = P || fullPane();
    const span = S.timePerDiv * S.divsH;
    return P.x + ((t - (S.hOffset - span / 2)) / span) * P.w;
  }
  function xToTime(x, P) {
    P = P || fullPane();
    const span = S.timePerDiv * S.divsH;
    return (S.hOffset - span / 2) + ((x - P.x) / P.w) * span;
  }
  const pxPerDivV = (P) => (P || fullPane()).h / S.divsV;
  /* dispToY maps a DISPLAYED value (inversion already applied) — the space
     the axis, the trigger level and the reconstruction live in. valueToY
     takes a raw sample and applies the channel's inversion first. */
  function dispToY(ch, d, P) {
    P = P || fullPane();
    if (S.yMode === "axis") {
      const r = yRange(P.i);
      return P.y + P.h - (d - r.min) / (r.max - r.min) * P.h;
    }
    const ppd = P.h / S.divsV;
    return P.y + P.h / 2 - ch.position * ppd - (d / ch.voltsPerDiv) * ppd;
  }
  function yToDisp(ch, y, P) {
    P = P || fullPane();
    if (S.yMode === "axis") {
      const r = yRange(P.i);
      return r.min + (P.y + P.h - y) / P.h * (r.max - r.min);
    }
    const ppd = P.h / S.divsV;
    return -(y - (P.y + P.h / 2 - ch.position * ppd)) / ppd * ch.voltsPerDiv;
  }
  const valueToY = (ch, v, P) => dispToY(ch, ch.invert ? -v : v, P);
  function yToValue(ch, y, P) { const d = yToDisp(ch, y, P); return ch.invert ? -d : d; }
  /* The same mapping as valueToY with the axis range resolved once. The trace
     loop calls it per sample, and recomputing an auto range 100 000 times a
     frame would be the slowest thing on the screen. */
  function fastValueToY(ch, P) {
    const sg = ch.invert ? -1 : 1;
    if (S.yMode === "axis") {
      const r = yRange(P.i), k = P.h / (r.max - r.min), b = P.y + P.h + r.min * k;
      return (c, v) => b - sg * v * k;
    }
    const ppd = P.h / S.divsV, mid = P.y + P.h / 2 - ch.position * ppd, k = ppd / ch.voltsPerDiv;
    return (c, v) => mid - sg * v * k;
  }

  // ---------- drawing primitives ----------
  /* A bench-scope graticule, not a chart grid: dotted division lines, solid
     centre axes, and 5 fine ticks per division along both of them. */
  /* `P` is the rectangle to draw into; omitted means the whole canvas. The
     subdivision ticks are skipped on a small pane — at 6×6 they merge into a
     grey haze that reads as noise instead of as a scale. */
  function drawGrid(c, divsH, divsV, P) {
    const t = th();
    const ctx = c.ctx;
    const ox = P ? P.x : 0, oy = P ? P.y : 0;
    const w = P ? P.w : c.w, h = P ? P.h : c.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.clip();
    ctx.fillStyle = t.scopeBg;
    ctx.fillRect(ox, oy, w, h);
    if (t.dark) {
      // faint lift towards the centre, the way a real display looks lit
      const gr = ctx.createRadialGradient(ox + w / 2, oy + h / 2, 0, ox + w / 2, oy + h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, "rgba(120,190,255,0.045)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(ox, oy, w, h);
    }
    const stepX = w / divsH, stepY = h / divsV;
    const cx = Math.round(ox + w / 2) + 0.5, cy = Math.round(oy + h / 2) + 0.5;
    const ticks = Math.min(w / divsH, h / divsV) >= 22;   // room for 5 subdivisions?
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.gridMinor;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    for (let i = 1; i < divsH; i++) { const x = Math.round(ox + i * stepX) + 0.5; if (x === cx) continue; ctx.moveTo(x, oy); ctx.lineTo(x, oy + h); }
    for (let j = 1; j < divsV; j++) { const y = Math.round(oy + j * stepY) + 0.5; if (y === cy) continue; ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = t.gridMajor;
    ctx.beginPath();
    ctx.moveTo(cx, oy); ctx.lineTo(cx, oy + h);
    ctx.moveTo(ox, cy); ctx.lineTo(ox + w, cy);
    // subdivision ticks on the centre axes and along the outer frame
    if (ticks) {
      for (let i = 0; i < divsH; i++) for (let k = 1; k < 5; k++) {
        const x = Math.round(ox + i * stepX + k * stepX / 5) + 0.5;
        ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3);
        ctx.moveTo(x, oy); ctx.lineTo(x, oy + 3);
        ctx.moveTo(x, oy + h); ctx.lineTo(x, oy + h - 3);
      }
      for (let j = 0; j < divsV; j++) for (let k = 1; k < 5; k++) {
        const y = Math.round(oy + j * stepY + k * stepY / 5) + 0.5;
        ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y);
        ctx.moveTo(ox, y); ctx.lineTo(ox + 3, y);
        ctx.moveTo(ox + w, y); ctx.lineTo(ox + w - 3, y);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = t.border;
    ctx.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  /* The period one "Periodic" repetition is long, or null when the channel is
     not periodic or nothing usable could be measured. `auto` reuses the very
     same edge-to-edge estimator the Measurements table shows, so the two can
     never disagree; `record` repeats the capture end to end; `manual` is
     whatever was typed. Cached per channel because auto-detection walks the
     whole record and the renderer asks on every frame. */
  function resolvePeriod(ch) {
    if (!ch.periodic) return null;
    const mode = ch.periodMode || "auto";
    if (mode === "manual") return (ch.periodT > 0) ? ch.periodT : null;
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length < 2) return null;
    const span = time[time.length - 1] - time[0];
    if (mode === "record") return span > 0 ? span : null;
    const sig = (ch.avgN || 1) + "/" + (ch.hiresN || 1) + "/" + (ch.invert ? 1 : 0) + "/" + time.length;
    if (ch.perCache && ch.perCache.sig === sig) return ch.perCache.T;
    const st = ch.fullStats || computeStats(data, 0, data.length - 1);
    const r = findPeriod(data, time, 0, Math.min(data.length, time.length) - 1, st.mean, st.min, st.max, ch.invert);
    /* No detectable edge (a DC level, or fewer than two crossings) falls back
       to the record length instead of switching the feature off silently. */
    const T = (r && r.period > 0 && isFinite(r.period)) ? r.period : (span > 0 ? span : null);
    ch.perCache = { sig, T };
    return T;
  }
  const MAX_TILES = 4000;   // beyond this the repeats are sub-pixel: a solid band

  // draws a channel trace into arbitrary ctx given a time window and value mapping
  function traceInto(ctx2, ch, tA, tB, w, valToY, P) {
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length === 0) return;
    const N = time.length;
    const tStart = time[0], tEnd = time[N - 1];
    const dt = N > 1 ? (tEnd - tStart) / (N - 1) : 1;
    const x0 = P ? P.x : 0;
    const tToX = (tt) => x0 + ((tt - tA) / (tB - tA)) * w;
    const W = Math.max(1, Math.round(w));

    /* Periodic mode repeats ONE period, not the whole record: tiling the
       entire capture at a period shorter than it would stack overlapping
       copies on top of each other rather than continuing the wave.

       Each tile is clipped to the visible window IN INDEX SPACE, not just by
       the canvas clip rect. The decimator below spreads `count` samples over
       `pxCount` pixels, so handing it a whole period while only a sliver of
       that period is on screen squeezes the entire cycle into the sliver —
       which is exactly how the edge tiles came out compressed. One sample of
       padding keeps the line reaching the pane edge instead of stopping short
       of it. */
    const T = resolvePeriod(ch);
    let tiles;
    const clipTile = (lo, hi, shift, iMax) => {
      const a = Math.max(tA, lo), b = Math.min(tB, hi);
      if (b < a) return null;
      let i0 = Math.floor((a - shift - tStart) / dt) - 1;
      let i1 = Math.ceil((b - shift - tStart) / dt) + 1;
      i0 = clamp(i0, 0, iMax); i1 = clamp(i1, 0, iMax);
      return i1 - i0 + 1 > 1 ? { i0, i1, shift } : null;
    };
    if (T && T > 0) {
      const iLast = clamp(Math.round(T / dt), 1, N - 1);
      const tileLen = iLast * dt;                       // what one tile really spans
      const kA = Math.floor((tA - tStart - tileLen) / T), kB = Math.ceil((tB - tStart) / T);
      if (kB - kA > MAX_TILES) return;   // guard: nothing legible to draw anyway
      tiles = [];
      for (let k = kA; k <= kB; k++) {
        const sh = k * T;
        const tile = clipTile(tStart + sh, tStart + tileLen + sh, sh, iLast);
        if (tile) tiles.push(tile);
      }
      if (!tiles.length) return;
    } else {
      if (tB < tStart || tA > tEnd) return;
      const tile = clipTile(tStart, tEnd, 0, N - 1);
      if (!tile) return;
      tiles = [tile];
    }

    ctx2.save();
    if (P) { ctx2.beginPath(); ctx2.rect(P.x, P.y, P.w, P.h); ctx2.clip(); }
    ctx2.strokeStyle = ch.color;
    ctx2.lineWidth = S.opts.traceWidth;
    ctx2.lineJoin = "round";
    ctx2.lineCap = "round";
    // Phosphor bloom. One shadowed stroke over the whole path, so the cost is
    // the same whether the trace is 100 or 100 000 points.
    if (S.glowOn && th().dark) { ctx2.shadowColor = ch.color; ctx2.shadowBlur = 6; }
    ctx2.beginPath();
    for (const tile of tiles) {
      const { i0, i1, shift } = tile;
      const count = i1 - i0 + 1;
      if (count <= 1) continue;
      if (count <= W * 2) {
        for (let i = i0; i <= i1; i++) {
          const x = tToX(time[i] + shift), y = valToY(ch, data[i], P);
          if (i === i0) ctx2.moveTo(x, y); else ctx2.lineTo(x, y);
        }
      } else {
        /* min/max decimation: one vertical stroke per pixel column, so a
           100 000-point record costs the same as the screen is wide.
           These are NOT clamped to the pane: the index range was already
           clipped to the visible window, so the pixel span must be allowed to
           match it exactly — clamping here is what compressed the tile. The
           clip rect handles the sub-pixel overhang. */
        const xS = clamp(Math.floor(tToX(time[i0] + shift) - x0), 0, W);
        const xE = clamp(Math.ceil(tToX(time[i1] + shift) - x0), 0, W);
        const pxCount = Math.max(1, xE - xS);
        const perPixel = count / pxCount;
        let started = false;
        for (let pxi = 0; pxi < pxCount; pxi++) {
          const a = i0 + Math.floor(pxi * perPixel);
          let b = i0 + Math.floor((pxi + 1) * perPixel);
          if (b <= a) b = a + 1;
          if (b > i1 + 1) b = i1 + 1;
          let mn = Infinity, mx = -Infinity;
          for (let i = a; i < b; i++) { const v = data[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
          if (mn === Infinity) continue;
          const x = x0 + xS + pxi + 0.5;
          if (!started) { ctx2.moveTo(x, valToY(ch, mn, P)); started = true; }
          ctx2.lineTo(x, valToY(ch, mn, P));
          ctx2.lineTo(x, valToY(ch, mx, P));
        }
      }
    }
    ctx2.stroke();
    ctx2.restore();
  }

  // ---------- harmonic reconstruction ----------
  /* Rebuilds the wave out of the harmonics measured in the FFT tab, summing
     them one at a time: 1 harmonic is a bare sine, and as k climbs the curve
     folds itself into the shape of the capture underneath. It is drawn over
     the source channel's own trace, in the panes that channel lives in,
     because the comparison IS the feature.

     `computeHarmonics` already folded `invert` into its coefficients (it
     multiplies by `sgn`), so the series is in *displayed* value space. Passing
     it to valueToY, which inverts again, would flip it back — so the value is
     pre-multiplied by sgn to cancel that second inversion. Without it the
     reconstruction of an inverted channel appears mirrored about its own zero,
     which looks like a phase bug rather than a sign bug. */
  function reconValue(H, k, tt) {
    let v = H.dc;
    const w0 = 2 * Math.PI * H.f0, dtq = tt - H.t0;
    for (let i = 0; i < k && i < H.harms.length; i++) {
      const hh = H.harms[i];
      v += hh.mag * Math.cos(hh.n * w0 * dtq + hh.phase * Math.PI / 180);
    }
    return v;
  }
  /* Every channel carries its own harmonics, so every channel can show its own
     fundamental. The FFT tab still analyses one channel in depth (THD, TDD, the
     tables); this is the cheap per-channel version that feeds the overlay, and
     it is cached because the renderer asks on every frame. */
  function ensureHarm(ch) {
    const data = getData(ch);
    if (!data) return null;
    const f0 = channelF0(ch);
    if (!f0 || f0 <= 0) return null;
    const n = S.recon.nHarm;
    const sig = f0.toFixed(6) + "/" + n + "/" + (ch.avgN || 1) + "/" + (ch.hiresN || 1) +
      "/" + (ch.invert ? 1 : 0) + "/" + data.length;
    if (ch.harmCache && ch.harmCache.sig === sig) return ch.harmCache.H;
    /* Always the FULL record, never the visible window: the overlay would
       otherwise be recomputed on every pan and, worse, change shape as you
       scrolled, which makes it useless as a reference. */
    const H = computeHarmonics(ch, f0, n, "full", null);
    ch.harmCache = { sig, H };
    return H;
  }
  // the channels whose reconstruction is currently drawable
  function reconChannels(list) {
    if (!S.recon.on) return [];
    return (list || S.channels.filter(c => c.visible)).filter(ch => {
      if (ch.reconOn === false) return false;
      const H = ensureHarm(ch);
      return !!(H && !H.error && H.harms && H.harms.length);
    });
  }
  const reconMaxK = () => reconChannels().reduce((m, ch) => Math.max(m, ch.harmCache.H.harms.length), 0);
  // a lighter cast of the trace colour: same channel, plainly not the trace
  function lighten(hex, amt) {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    const mix = (c) => Math.round(c + (255 - c) * amt);
    return "rgb(" + mix(r) + "," + mix(g) + "," + mix(b) + ")";
  }
  function drawReconstruction(ctx, P, visCh, tA, tB) {
    const list = reconChannels(visCh);
    if (!list.length) return;
    const W = Math.max(2, Math.round(P.w));
    const t = th();
    let kShown = 0, kMaxShown = 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const ch of list) {
      const H = ch.harmCache.H;
      const kMax = H.harms.length;
      const k = clamp(Math.round(S.recon.k), 0, kMax);
      kShown = Math.max(kShown, k); kMaxShown = Math.max(kMaxShown, kMax);
      const sgn = ch.invert ? -1 : 1;
      /* Same hue as the trace so it is obvious WHICH channel is being
         reconstructed — with several on screen a single white curve is
         unattributable — but lightened and dashed so it is never mistaken for
         the measured wave underneath it. */
      const tint = lighten(ch.color, t.dark ? 0.55 : 0.0);
      const dim = lighten(ch.color, t.dark ? 0.35 : 0.45);

      /* The individual harmonics, faint and underneath: they explain where the
         shape comes from, but they must never compete with the sum. */
      if (S.recon.components && k > 0) {
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.30;
        ctx.strokeStyle = dim;
        for (let i = 0; i < k; i++) {
          const hh = H.harms[i];
          ctx.beginPath();
          for (let px = 0; px <= W; px++) {
            const tt = tA + (px / W) * (tB - tA);
            const v = hh.mag * Math.cos(hh.n * 2 * Math.PI * H.f0 * (tt - H.t0) + hh.phase * Math.PI / 180) + H.dc;
            const y = valueToY(ch, v * sgn, P);
            if (px === 0) ctx.moveTo(P.x, y); else ctx.lineTo(P.x + px, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // the partial sum
      ctx.lineWidth = Math.max(1.4, S.opts.traceWidth + 0.3);
      ctx.strokeStyle = tint;
      ctx.setLineDash([6, 3]);
      if (S.glowOn && t.dark) { ctx.shadowColor = tint; ctx.shadowBlur = 5; }
      ctx.beginPath();
      for (let px = 0; px <= W; px++) {
        const tt = tA + (px / W) * (tB - tA);
        const y = valueToY(ch, reconValue(H, k, tt) * sgn, P);
        if (px === 0) ctx.moveTo(P.x, y); else ctx.lineTo(P.x + px, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    if (P.h >= 90) {
      const order = kShown === 0 ? "DC only" : ("Σ n = 1…" + kShown + (kShown >= kMaxShown ? " (all)" : ""));
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = t.muted;
      ctx.textAlign = "left";
      ctx.fillText("RECON " + order, P.x + 8, P.y + P.h - 8);
    }
    ctx.restore();
  }

  // ---------- persistence buffer ----------
  let persistCanvas = null, persistCtx = null;
  function ensurePersist() {
    const c = CV.scope;
    if (!persistCanvas) { persistCanvas = document.createElement("canvas"); persistCtx = persistCanvas.getContext("2d"); }
    if (persistCanvas.width !== c.canvas.width || persistCanvas.height !== c.canvas.height) {
      persistCanvas.width = c.canvas.width;
      persistCanvas.height = c.canvas.height;
      persistCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function clearPersist() { if (persistCtx) persistCtx.clearRect(0, 0, persistCanvas.width, persistCanvas.height); }

  // ---------- main render ----------
  let renderQueued = false;
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderNow(); });
  }
  function renderAll() { render(); renderFFTView(); renderXY(); scheduleSplit(); }

  function renderNow() {
    const c = CV.scope;
    if (!resizeCanvas("scope")) { renderZoom(); updateStatus(); updateToolbar(); return; }
    const { ctx, w, h } = c;
    const t = th();
    const panes = paneRects();
    /* Every plot shows the same time window — the time base is shared — so it
       is computed once and handed to each plot's own x mapping. */
    const { tA, tB } = viewWindow();

    // the figure: a grey window with white plot areas in it, as in PLECS
    ctx.fillStyle = t.figBg;
    ctx.fillRect(0, 0, w, h);

    if (S.persistOn) {
      ensurePersist();
      // fade old content
      persistCtx.save();
      persistCtx.globalCompositeOperation = "destination-out";
      persistCtx.fillStyle = "rgba(0,0,0," + S.persistDecay + ")";
      persistCtx.fillRect(0, 0, c.w, c.h);
      persistCtx.restore();
    }

    for (const P of panes) {
      drawPlotBack(ctx, P, t, tA, tB);
      const visCh = chansOfPane(P);
      const target = S.persistOn ? persistCtx : ctx;
      target.save();
      target.beginPath(); target.rect(P.x, P.y, P.w, P.h); target.clip();
      visCh.forEach(ch => traceInto(target, ch, tA, tB, P.w, fastValueToY(ch, P), P));
      target.restore();
      if (S.persistOn) drawReconstruction(persistCtx, P, visCh, tA, tB);
    }
    if (S.persistOn) ctx.drawImage(persistCanvas, 0, 0, c.w, c.h);

    for (const P of panes) {
      const visCh = chansOfPane(P);
      if (!S.persistOn) drawReconstruction(ctx, P, visCh, tA, tB);
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      // zoom region shade
      if (S.zoomOn && S.files.length) {
        const x1 = timeToX(S.zoomT - S.zoomSpan / 2, P), x2 = timeToX(S.zoomT + S.zoomSpan / 2, P);
        ctx.fillStyle = t.shade;
        ctx.fillRect(x1, P.y, x2 - x1, P.h);
        ctx.strokeStyle = t.shadeEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(x1) + 0.5, P.y + 0.5, Math.round(x2 - x1) - 1, P.h - 1);
      }
      drawTrigger(ctx, P, visCh);
      drawCursors(ctx, P, visCh, t);
      drawLegend(ctx, P, t, visCh);
      drawBand(ctx, P, t);
      ctx.restore();
      drawPlotFrame(ctx, P, t, visCh, tA, tB);
    }

    if (S.files.length === 0) {
      const F = fullPane();
      ctx.fillStyle = t.muted;
      ctx.font = "13px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Drop CSV files here, or click Load CSV", F.x + F.w / 2, F.y + F.h / 2 - 10);
      ctx.font = "11px 'IBM Plex Sans', sans-serif";
      ctx.fillText("Expected format: Time(s), CH1(V), CH2(A), …", F.x + F.w / 2, F.y + F.h / 2 + 12);
      ctx.textAlign = "left";
    }

    updateCursorReadout();
    updateCursorTable();
    renderZoom();
    updateStatus();
    updateToolbar();
  }

  /* Tick density follows the plot's size, not a fixed division count: about
     one time label per 90 px and one value label per 38 px, which is what
     keeps a 6×6 grid readable and a single plot from looking empty. */
  const xTicks = (P, tA, tB) => niceTicks(tA, tB, Math.max(2, Math.floor(P.w / 90)));
  const yTicks = (P, r) => niceTicks(r.min, r.max, Math.max(2, Math.floor(P.h / 38)));
  const axisY = (P, r, v) => P.y + P.h - (v - r.min) / (r.max - r.min) * P.h;
  /* The unit a plot's y axis can honestly claim: the one all its channels
     share. Mixed units (V beside A) get no unit rather than the first one. */
  function paneUnit(visCh) {
    if (!visCh.length) return "";
    const u = visCh[0].unit || "";
    return visCh.every(ch => (ch.unit || "") === u) ? u : "";
  }

  /* White plot area and its grid. In axis mode the grid sits on the tick
     values, dotted and light, the way PLECS draws it; in div mode it is the
     8-division graticule with solid centre lines, which is what V/div and
     position are measured against. */
  function drawPlotBack(ctx, P, t, tA, tB) {
    ctx.save();
    ctx.fillStyle = t.scopeBg;
    ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.gridMinor;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    xTicks(P, tA, tB).ticks.forEach(tt => {
      const x = Math.round(timeToX(tt, P)) + 0.5;
      ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h);
    });
    if (S.yMode === "axis") {
      const r = yRange(P.i);
      yTicks(P, r).ticks.forEach(v => {
        const y = Math.round(axisY(P, r, v)) + 0.5;
        ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y);
      });
      ctx.stroke();
    } else {
      const step = P.h / S.divsV, cy = Math.round(P.y + P.h / 2) + 0.5;
      for (let j = 1; j < S.divsV; j++) {
        const y = Math.round(P.y + j * step) + 0.5;
        if (y === cy) continue;
        ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = t.gridMajor;
      ctx.beginPath();
      ctx.moveTo(P.x, cy); ctx.lineTo(P.x + P.w, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The frame, its inward ticks and every label outside the plot area: the y
     axis on the left of each plot, the time axis once under the bottom row. */
  function drawPlotFrame(ctx, P, t, visCh, tA, tB) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.axis;
    ctx.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);
    const X = xTicks(P, tA, tB);
    ctx.beginPath();
    X.ticks.forEach(tt => {
      const x = Math.round(timeToX(tt, P)) + 0.5;
      ctx.moveTo(x, P.y + P.h); ctx.lineTo(x, P.y + P.h - 4);
      ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + 4);
    });
    let r = null, Y = null;
    if (S.yMode === "axis") {
      r = yRange(P.i);
      Y = yTicks(P, r);
      Y.ticks.forEach(v => {
        const y = Math.round(axisY(P, r, v)) + 0.5;
        ctx.moveTo(P.x, y); ctx.lineTo(P.x + 4, y);
        ctx.moveTo(P.x + P.w, y); ctx.lineTo(P.x + P.w - 4, y);
      });
    }
    ctx.stroke();

    ctx.fillStyle = t.text;
    ctx.font = "10.5px 'IBM Plex Sans', sans-serif";
    if (Y) {
      const pre = axisPrefix(r.min, r.max);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      Y.ticks.forEach(v => {
        const y = axisY(P, r, v);
        ctx.fillText(tickLabel(v, Y.step, pre.mult), P.x - 5, clamp(y, P.y + 5, P.y + P.h - 5));
      });
      const u = paneUnit(visCh);
      if (P.gL >= 56 && P.h >= 70 && (pre.s || u)) {
        ctx.save();
        ctx.translate(P.x - P.gL + 9, P.y + P.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = t.muted;
        ctx.fillText("[" + pre.s + u + "]", 0, 0);
        ctx.restore();
      }
    } else {
      /* Div mode: each channel's ground as a numbered marker in the axis band,
         which is also the handle that drags its position. */
      ctx.font = "700 9px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      visCh.forEach(ch => {
        const y = clamp(dispToY(ch, 0, P), P.y + 6, P.y + P.h - 6);
        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.moveTo(P.x - 1, y); ctx.lineTo(P.x - 15, y - 6); ctx.lineTo(P.x - 15, y + 6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = luminance(ch.color) > 0.5 ? "#0b1118" : "#ffffff";
        ctx.fillText(String(S.channels.indexOf(ch) + 1), P.x - 9, y);
      });
    }

    if (P.showX) {
      const pre = axisPrefix(tA, tB);
      ctx.font = "10.5px 'IBM Plex Sans', sans-serif";
      ctx.fillStyle = t.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      let lastR = -Infinity;
      X.ticks.forEach(tt => {
        const x = timeToX(tt, P);
        const s = tickLabel(tt, X.step, pre.mult);
        const hw = ctx.measureText(s).width / 2;
        if (x - hw < lastR + 6 || x - hw < P.x - P.gL + 2 || x + hw > CV.scope.w - 2) return;
        ctx.fillText(s, x, P.y + P.h + 14);
        lastR = x + hw;
      });
      if (P.gB >= 30 && (P.col === 0 || P.w >= 200)) {
        ctx.fillStyle = t.muted;
        ctx.fillText("Time [" + pre.s + "s]", P.x + P.w / 2, P.y + P.h + 29);
      }
    }

    if (isGrid()) {
      ctx.font = "600 9px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = t.muted;
      ctx.fillText(String(P.i + 1), P.x + 4, P.y + 3);
    }
    ctx.restore();
  }

  /* The legend box in the top-right corner of each plot, one line per signal
     with a stroke of its colour, as PLECS draws it. It says what a colour is,
     which on a white plot with six traces is not optional; L hides it. */
  function drawLegend(ctx, P, t, visCh) {
    if (!S.legendOn || !visCh.length || P.h < 56 || P.w < 110) return;
    ctx.save();
    ctx.font = "10.5px 'IBM Plex Sans', sans-serif";
    const rowH = 15, pad = 6, sw = 16;
    const maxRows = Math.max(1, Math.floor((P.h - 24) / rowH));
    const items = visCh.map(ch => {
      let s = ch.label;
      if (ch.unit) s += " [" + ch.unit + "]";
      if (S.yMode === "div") s += "  " + fmtScale(ch.voltsPerDiv, ch.unit) + "/div";
      if (ch.periodic) s += "  ∞";
      if (ch.invert) s += "  inv";
      return { ch, s };
    });
    let shown = items, more = "";
    if (items.length > maxRows) { shown = items.slice(0, Math.max(1, maxRows - 1)); more = "+" + (items.length - shown.length) + " more"; }
    let tw = 0;
    shown.forEach(it => { tw = Math.max(tw, ctx.measureText(it.s).width); });
    if (more) tw = Math.max(tw, ctx.measureText(more).width);
    const bw = Math.min(P.w - 12, sw + 6 + tw + pad * 2);
    const bh = (shown.length + (more ? 1 : 0)) * rowH + pad * 2 - 4;
    const bx = Math.round(P.x + P.w - bw - 6), by = Math.round(P.y + 6);
    ctx.fillStyle = t.legendBg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = t.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    shown.forEach((it, k) => {
      const y = by + pad + k * rowH + rowH / 2 - 2;
      ctx.strokeStyle = it.ch.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + pad, y); ctx.lineTo(bx + pad + sw, y); ctx.stroke();
      ctx.fillStyle = t.text;
      ctx.fillText(it.s, bx + pad + sw + 6, y);
    });
    if (more) {
      ctx.fillStyle = t.muted;
      ctx.fillText(more, bx + pad + sw + 6, by + pad + shown.length * rowH + rowH / 2 - 2);
    }
    ctx.restore();
  }

  /* Trigger and cursors are drawn per plot, and only where they mean
     something: the trigger marker belongs in the plots that actually show its
     source channel. The level is a DISPLAYED value (findTriggerCrossing
     compares it against the inverted trace), hence dispToY. */
  function drawTrigger(ctx, P, visCh) {
    const ch = visCh.find(c => c.id === S.trigger.sourceId);
    if (!ch) return;
    const y = dispToY(ch, S.trigger.level, P);
    if (y < P.y - 10 || y > P.y + P.h + 10) return;
    const xR = P.x + P.w;
    ctx.strokeStyle = ch.color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(xR, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.moveTo(xR - 1, y); ctx.lineTo(xR - 11, y - 5); ctx.lineTo(xR - 11, y + 5);
    ctx.closePath(); ctx.fill();
    if (P.h < 90) return;                      // no room for the caption
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("T" + (S.trigger.slope === "rising" ? "↑" : "↓") + " " + fmt(S.trigger.level, ch.unit, 2), xR - 15, y - 6);
    ctx.textAlign = "left";
  }

  // a numbered cursor tab, the handle PLECS puts on each cursor line
  function cursorTab(ctx, t, x, y, n) {
    ctx.fillStyle = t.cursor;
    ctx.fillRect(Math.round(x) - 7, y, 14, 13);
    ctx.fillStyle = luminance(t.cursor) > 0.5 ? "#0b1118" : "#ffffff";
    ctx.font = "700 9px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), Math.round(x), y + 7);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  function drawCursors(ctx, P, visCh, t) {
    const cu = S.cursors, mode = cu.mode;
    if (mode === "time" || mode === "track") {
      ctx.strokeStyle = t.cursor;
      ctx.lineWidth = 1;
      [cu.t1, cu.t2].forEach((tt, i) => {
        const x = Math.round(timeToX(tt, P)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke();
        if (P.h >= 40) cursorTab(ctx, t, x, P.y, i + 1);
      });
      /* Where each cursor crosses each trace. Always drawn, not only in
         "track": that dot is what ties a row of the cursor table to the
         curve it describes. sampleAt returns the raw sample, and valueToY
         applies the channel's inversion itself. */
      visCh.forEach(ch => {
        [cu.t1, cu.t2].forEach(tt => {
          const v = sampleAt(ch, tt);
          if (v === null) return;
          const x = timeToX(tt, P), y = valueToY(ch, v, P);
          ctx.fillStyle = ch.color;
          ctx.beginPath(); ctx.arc(x, y, mode === "track" ? 3.5 : 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = t.scopeBg;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      });
    } else if (mode === "value") {
      const ref = visCh.find(ch => ch.id === cu.refId) || visCh[0];
      if (!ref) return;
      ctx.strokeStyle = t.cursor;
      ctx.lineWidth = 1;
      [cu.v1, cu.v2].forEach((v, i) => {
        const y = Math.round(dispToY(ref, v, P)) + 0.5;
        ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke();
        ctx.fillStyle = t.cursor;
        ctx.fillRect(P.x, y - 6, 14, 12);
        ctx.fillStyle = luminance(t.cursor) > 0.5 ? "#0b1118" : "#ffffff";
        ctx.font = "700 9px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), P.x + 7, y);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      });
    }
  }

  /* What a rubber band will zoom: both axes, or only one when the drag is
     nearly flat or nearly vertical — the same gesture PLECS reads as "zoom
     time only" / "zoom Y only". The Zoom X and Zoom Y tools force it. */
  function bandKind(d) {
    if (S.tool === "zoomx") return "x";
    if (S.tool === "zoomy") return "y";
    const dx = Math.abs(d.x1 - d.x0), dy = Math.abs(d.y1 - d.y0);
    if (dy < 10 && dx >= 10) return "x";
    if (dx < 10 && dy >= 10) return "y";
    return "xy";
  }
  function drawBand(ctx, P, t) {
    const d = S.dragging;
    if (!d || d.type !== "box" || d.P.i !== P.i || !d.moved) return;
    const k = bandKind(d);
    let x1 = Math.min(d.x0, d.x1), x2 = Math.max(d.x0, d.x1);
    let y1 = Math.min(d.y0, d.y1), y2 = Math.max(d.y0, d.y1);
    if (k === "x") { y1 = P.y; y2 = P.y + P.h; }
    if (k === "y") { x1 = P.x; x2 = P.x + P.w; }
    ctx.fillStyle = t.shade;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeStyle = t.shadeEdge;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.round(x1) + 0.5, Math.round(y1) + 0.5, Math.round(x2 - x1), Math.round(y2 - y1));
    ctx.setLineDash([]);
  }


  /* Reading a sample honours Periodic: once a channel repeats, the readout and
     the track cursors have to agree with the trace under them, or hovering
     over a repeated cycle would report "—" over a perfectly visible wave. */
  function sampleAt(ch, tt) {
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length === 0) return null;
    const N = time.length;
    const dt = N > 1 ? (time[N - 1] - time[0]) / (N - 1) : 1;
    const T = resolvePeriod(ch);
    let q = tt;
    if (T && T > 0) {
      const k = Math.floor((tt - time[0]) / T);
      q = tt - k * T;
    }
    const idx = Math.round((q - time[0]) / dt);
    if (idx < 0 || idx > N - 1) return null;
    return data[idx];
  }

  function updateCursorReadout() {
    const cu = S.cursors, mode = cu.mode;
    const el = R.cursorReadout;
    if (mode === "off") { el.innerHTML = ""; el.style.display = "none"; return; }
    el.style.display = "block";
    const mono = (s) => '<div style="font:11px \'IBM Plex Mono\',monospace;color:var(--text);padding:1px 0">' + s + "</div>";
    let html = "";
    if (mode === "time" || mode === "track") {
      const dt = cu.t2 - cu.t1;
      html += mono("t₁ = " + fmt(cu.t1, "s") + "&nbsp;&nbsp;t₂ = " + fmt(cu.t2, "s"));
      html += mono("Δt = " + fmt(dt, "s") + "&nbsp;&nbsp;1/Δt = " + (dt !== 0 ? fmt(1 / dt, "Hz") : "—"));
      if (mode === "track") {
        S.channels.filter(c => c.visible).forEach(ch => {
          const v1 = sampleAt(ch, cu.t1), v2 = sampleAt(ch, cu.t2);
          const s1 = v1 === null ? "—" : fmt(ch.invert ? -v1 : v1, ch.unit, 2);
          const s2 = v2 === null ? "—" : fmt(ch.invert ? -v2 : v2, ch.unit, 2);
          const dv = (v1 !== null && v2 !== null) ? fmt((ch.invert ? -v2 : v2) - (ch.invert ? -v1 : v1), ch.unit, 2) : "—";
          html += '<div style="font:11px \'IBM Plex Mono\',monospace;padding:1px 0"><span style="color:' + ch.color + ';font-weight:600">■</span> ' + s1 + " → " + s2 + "&nbsp;&nbsp;Δ " + dv + "</div>";
        });
      }
    } else if (mode === "value") {
      const ref = S.channels.find(ch => ch.id === cu.refId) || S.channels[0];
      const unit = ref ? ref.unit : "";
      html += mono("v₁ = " + fmt(cu.v1, unit) + "&nbsp;&nbsp;v₂ = " + fmt(cu.v2, unit));
      html += mono("Δv = " + fmt(cu.v1 - cu.v2, unit));
    }
    el.innerHTML = html;
  }

  // ---------- zoom window ----------
  function renderZoom() {
    if (!S.zoomOn) return;
    if (!resizeCanvas("zoom")) return;
    const c = CV.zoom;
    drawGrid(c, S.divsH, 4);
    const tA = S.zoomT - S.zoomSpan / 2, tB = S.zoomT + S.zoomSpan / 2;
    const visCh = S.channels.filter(ch => ch.visible);
    /* Same vertical mapping as the channel's first plot, stretched over the
       strip: a pane whose rectangle is the whole zoom canvas. */
    visCh.forEach(ch => {
      const Pz = { i: panesOf(ch)[0], x: 0, y: 0, w: c.w, h: c.h };
      traceInto(c.ctx, ch, tA, tB, c.w, fastValueToY(ch, Pz), Pz);
    });
    const t = th();
    c.ctx.fillStyle = t.muted;
    c.ctx.font = "10px 'IBM Plex Mono', monospace";
    c.ctx.fillText("ZOOM " + fmt(S.zoomSpan, "s", 1) + " @ " + fmt(S.zoomT, "s", 3) + "  (drag the highlighted region above · scroll here to widen/narrow)", 8, 13);
  }

  // ---------- measurements ----------
  let measureTimer = null;
  function scheduleMeasure() { clearTimeout(measureTimer); measureTimer = setTimeout(updateMeasurements, 120); }

  function findPeriod(data, time, iStart, iEnd, mean, min, max, invert) {
    const band = Math.max((max - min) * 0.15, 1e-12);
    const thH = mean + band, thL = mean - band;
    const first = data[iStart] * (invert ? -1 : 1);
    let st = first > thH ? "high" : (first < thL ? "low" : "mid");
    const crossings = [];
    for (let i = iStart + 1; i <= iEnd; i++) {
      const prev = data[i - 1] * (invert ? -1 : 1);
      const cur = data[i] * (invert ? -1 : 1);
      if (st !== "low" && cur < thL) st = "low";
      else if (st === "low" && cur > thH) {
        crossings.push(time[i - 1] + (time[i] - time[i - 1]) * ((thH - prev) / (cur - prev)));
        st = "high";
      }
    }
    if (crossings.length < 2) return { period: null, freq: null, crossings };
    const periods = [];
    for (let i = 1; i < crossings.length; i++) periods.push(crossings[i] - crossings[i - 1]);
    periods.sort((a, b) => a - b);
    const period = periods[Math.floor(periods.length / 2)];
    return { period, freq: 1 / period, crossings };
  }

  /* The fundamental, measured rather than typed. The median of the crossing
     intervals (what `findPeriod` reports, and the right choice for the
     Measurements column because it shrugs off one bad edge) is quantised to the
     sample rate: at 20 kS/s a 50 Hz period lands on 20.00 or 20.05 ms, a 0.25 %
     error. That is invisible in a table and ruinous in the reconstruction,
     where it accumulates into a visible phase drift by the far side of the
     screen. Spanning first-to-last crossing divides that error by the number of
     cycles instead. The spectrum is no help here: its resolution is 1/record,
     which over six cycles of 50 Hz is 8 Hz-wide bins. */
  function autoFundamental(ch) {
    const data = getData(ch), time = getTime(ch);
    if (!data || !time || data.length < 4) return null;
    const sig = (ch.avgN || 1) + "/" + (ch.hiresN || 1) + "/" + (ch.invert ? 1 : 0) + "/" + data.length;
    if (ch.f0Cache && ch.f0Cache.sig === sig) return ch.f0Cache.f;
    const st = ch.fullStats || computeStats(data, 0, data.length - 1);
    const r = findPeriod(data, time, 0, Math.min(data.length, time.length) - 1, st.mean, st.min, st.max, ch.invert);
    let f = null;
    const cr = r.crossings;
    if (cr && cr.length >= 2) {
      const span = cr[cr.length - 1] - cr[0];
      if (span > 0) f = (cr.length - 1) / span;
    }
    if (!f && r.freq && isFinite(r.freq)) f = r.freq;
    ch.f0Cache = { sig, f: (f && isFinite(f) && f > 0) ? f : null };
    return ch.f0Cache.f;
  }
  // what a channel's Fourier work should actually use
  function channelF0(ch) {
    if (ch.f0Mode === "manual" && ch.f0 > 0) return ch.f0;
    return autoFundamental(ch);
  }

  function visibleRange(ch) {
    const time = getTime(ch);
    if (!time || time.length === 0) return null;
    const N = time.length;
    let { tA: t0v, tB: t1v } = viewWindow();
    const tStart = time[0], tEnd = time[N - 1];
    const dt = N > 1 ? (tEnd - tStart) / (N - 1) : 1;
    /* A periodic channel is drawn outside its own record, so the window has to
       be folded back into it before measuring. Without this, scrolling into a
       repeated cycle left the measurements clamped to the single last sample
       and the table read Pk-Pk 0 V, Freq "—" under a wave plainly oscillating
       on screen. Whatever the window is, at least one whole period is
       measured, since that is what the repetition is made of. */
    const T = resolvePeriod(ch);
    if (T && T > 0 && (t0v > tEnd || t1v < tStart)) {
      const span = Math.min(Math.max(t1v - t0v, T), tEnd - tStart);
      t0v = tStart + ((t0v - tStart) % T + T) % T;
      t1v = t0v + span;
      if (t1v > tEnd) { t1v = tEnd; t0v = Math.max(tStart, tEnd - span); }
    }
    const iStart = clamp(Math.floor((Math.max(t0v, tStart) - tStart) / dt), 0, N - 1);
    const iEnd = clamp(Math.ceil((Math.min(t1v, tEnd) - tStart) / dt), 0, N - 1);
    if (iEnd < iStart) return null;
    return { iStart, iEnd };
  }

  let lastMeasureRows = [];
  function updateMeasurements() {
    R.measureBody.innerHTML = "";
    lastMeasureRows = [];
    S.channels.filter(c => c.visible).forEach(ch => {
      const data = getData(ch), time = getTime(ch);
      if (!data || !time) return;
      let iStart = 0, iEnd = data.length - 1;
      if (S.measureScope === "visible") {
        const r = visibleRange(ch);
        if (!r) return;
        iStart = r.iStart; iEnd = r.iEnd;
      }
      const st = computeStats(data, iStart, iEnd);
      const mean = ch.invert ? -st.mean : st.mean;
      const mn = ch.invert ? -st.max : st.min;
      const mx = ch.invert ? -st.min : st.max;
      const acrms = Math.sqrt(Math.max(0, st.rms * st.rms - st.mean * st.mean));
      const { period, freq } = findPeriod(data, time, iStart, iEnd, st.mean, st.min, st.max, ch.invert);
      const cells = [fmt(mn, ch.unit, 2), fmt(mx, ch.unit, 2), fmt(mx - mn, ch.unit, 2), fmt(mean, ch.unit, 2), fmt(st.rms, ch.unit, 2), fmt(acrms, ch.unit, 2), freq ? fmt(freq, "Hz", 2) : "—", period ? fmt(period, "s", 2) : "—"];
      lastMeasureRows.push([ch.label, mn, mx, mx - mn, mean, st.rms, acrms, freq || "", period || ""]);
      const tr = document.createElement("tr");
      tr.className = "osc-tr";
      tr.innerHTML = '<td style="color:' + ch.color + '">' + ch.label + "</td>" + cells.map(c => "<td>" + c + "</td>").join("");
      R.measureBody.appendChild(tr);
    });
  }

  function exportMeasurements() {
    if (!lastMeasureRows.length) return;
    let csv = "Channel,Min,Max,PkPk,Mean,RMS,AC_RMS,Freq_Hz,Period_s\n";
    lastMeasureRows.forEach(r => { csv += r.join(",") + "\n"; });
    downloadText("measurements.csv", csv);
  }

  function exportVisibleData() {
    if (!S.files.length) return;
    S.files.forEach(f => {
      const { tA: t0v, tB: t1v } = viewWindow();
      const N = f.rowCount;
      let iStart = clamp(Math.floor((Math.max(t0v, f.t0) - f.t0) / f.dt), 0, N - 1);
      let iEnd = clamp(Math.ceil((Math.min(t1v, f.t1) - f.t0) / f.dt), 0, N - 1);
      if (iEnd <= iStart) return;
      const colNames = f.columns.map(c => c.name + (c.unit ? "(" + c.unit + ")" : ""));
      let csv = "Time(s)," + colNames.join(",") + "\n";
      const parts = [];
      for (let i = iStart; i <= iEnd; i++) {
        const row = [f.time[i].toPrecision(9)];
        for (const c of f.columns) row.push(f.values[c.name][i]);
        parts.push(row.join(","));
      }
      csv += parts.join("\n");
      downloadText(f.name.replace(/\.csv$/i, "") + "_window.csv", csv);
    });
  }

  // ---------- math channels ----------
  function createMathChannel() {
    const a = S.channels.find(c => c.id === R.mathA.value);
    const b = S.channels.find(c => c.id === R.mathB.value);
    if (!a || !b) return;
    const da = getData(a), db = getData(b);
    const ta = getTime(a), tb = getTime(b);
    if (!da || !db) return;
    if (da.length !== db.length) { R.statusLeft.textContent = "Channels must have the same sample count."; return; }
    const op = R.mathOp.value;
    const sym = { "*": "×", "+": "+", "-": "−", "/": "÷" }[op];
    const out = new Float32Array(da.length);
    const sa = a.invert ? -1 : 1, sb = b.invert ? -1 : 1;
    for (let i = 0; i < da.length; i++) {
      const va = da[i] * sa, vb = db[i] * sb;
      out[i] = op === "*" ? va * vb : op === "+" ? va + vb : op === "-" ? va - vb : (vb !== 0 ? va / vb : 0);
    }
    let unit = "";
    if (op === "*") unit = ((a.unit === "V" && b.unit === "A") || (a.unit === "A" && b.unit === "V")) ? "W" : (a.unit || "u1") + "·" + (b.unit || "u2");
    else if (op === "/") unit = (a.unit || "u1") + "/" + (b.unit || "u2");
    else unit = a.unit === b.unit ? a.unit : (a.unit || "?") + sym + (b.unit || "?");
    const stats = computeStats(out, 0, out.length - 1);
    const colorIdx = nextColorIdx();
    const ch = {
      id: nextId(), isMath: true, mathA: a.id, mathB: b.id,
      label: a.label + " " + sym + " " + b.label, unit,
      colorIdx: colorIdx, color: colorFor(colorIdx), autoColor: true,
      visible: true, invert: false, voltsPerDiv: 1, position: 0, avgN: 1, hiresN: 1, tOffset: 0,
      data: out, time: ta.length === out.length ? ta : tb, fullStats: stats,
      // a derived channel starts where its operands are, not stranded in pane 1
      panes: Array.from(new Set(panesOf(a).concat(panesOf(b)))).sort((x, y) => x - y),
      periodic: false, periodMode: "auto", periodT: 0,
      reconOn: true, f0Mode: "auto", f0: 0
    };
    autoscaleChannel(ch);
    S.channels.push(ch);
    rebuildChannelList(); rebuildSelects();
    render(); scheduleMeasure();
  }

  // ---------- FFT ----------
  function fftRadix2(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < half; j++) {
          const ur = re[i + j], ui = im[i + j];
          const vr = re[i + j + half] * cr - im[i + j + half] * ci;
          const vi = re[i + j + half] * ci + im[i + j + half] * cr;
          re[i + j] = ur + vr; im[i + j] = ui + vi;
          re[i + j + half] = ur - vr; im[i + j + half] = ui - vi;
          const nr = cr * wr - ci * wi, ni = cr * wi + ci * wr;
          cr = nr; ci = ni;
        }
      }
    }
  }
  function windowCoherentGain(type) {
    return type === "hann" ? 0.5 : type === "hamming" ? 0.54 : type === "blackman" ? 0.42 : 1;
  }
  function applyWindowFn(data, off, n0, type) {
    const out = new Float64Array(n0);
    for (let i = 0; i < n0; i++) {
      let w = 1;
      if (type === "hann") w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n0 - 1));
      else if (type === "hamming") w = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n0 - 1));
      else if (type === "blackman") w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (n0 - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (n0 - 1));
      out[i] = data[off + i] * w;
    }
    return out;
  }
  const FFT_MAX_N = 1 << 20;
  function analysisRange(ch, rangeMode) {
    const data = getData(ch), time = getTime(ch);
    if (!data || !time) return null;
    let iStart = 0, iEnd = data.length - 1;
    if (rangeMode === "visible" && CV.scope.w > 0) {
      const r = visibleRange(ch);
      if (r) { iStart = r.iStart; iEnd = r.iEnd; }
    }
    return { data, time, iStart, iEnd };
  }
  function computeSpectrum(ch, windowType, rangeMode) {
    const r = analysisRange(ch, rangeMode);
    if (!r) return null;
    const n0 = r.iEnd - r.iStart + 1;
    if (n0 < 8) return null;
    const dt = (r.time[r.time.length - 1] - r.time[0]) / (r.time.length - 1);
    const fs = 1 / dt;
    let n = 1;
    while (n < n0 && n < FFT_MAX_N) n <<= 1;
    const usable = Math.min(n0, n);
    const windowed = applyWindowFn(r.data, r.iStart, usable, windowType);
    const re = new Float64Array(n), im = new Float64Array(n);
    re.set(windowed);
    fftRadix2(re, im);
    const half = n / 2;
    const mags = new Float64Array(half);
    const gain = windowCoherentGain(windowType);
    for (let i = 0; i < half; i++) mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (usable / 2) / gain;
    return { mags, freqStep: fs / n, fs, n, usable, channel: ch, windowType, invert: ch.invert };
  }

  // ---------- harmonic analysis (PLECS-style Fourier at n·f0) ----------
  function computeHarmonics(ch, f0, nHarm, rangeMode, iL) {
    const r = analysisRange(ch, rangeMode);
    if (!r || f0 <= 0) return null;
    const { data, time } = r;
    const dt = (time[time.length - 1] - time[0]) / (time.length - 1);
    const Tfund = 1 / f0;
    const dur = (r.iEnd - r.iStart) * dt;
    const P = Math.floor(dur / Tfund + 1e-9);
    if (P < 1) return { error: "Analysis window shorter than one fundamental period (" + fmt(Tfund, "s", 1) + " needed, " + fmt(dur, "s", 1) + " available)." };
    const M = Math.min(r.iEnd - r.iStart + 1, Math.round(P * Tfund / dt));
    if (M < 8) return { error: "Too few samples in the analysis window." };
    const sgn = ch.invert ? -1 : 1;
    const i0 = r.iStart;
    const t0 = time[i0];
    // DC
    let dc = 0;
    for (let i = 0; i < M; i++) dc += data[i0 + i];
    dc = dc * sgn / M;
    const fNyq = 1 / (2 * dt);
    let clipped = 0;
    const harms = [];
    const w0 = 2 * Math.PI * f0;
    for (let nH = 1; nH <= nHarm; nH++) {
      if (nH * f0 > fNyq) { clipped = nHarm - nH + 1; break; }
      let a = 0, b = 0;
      const wn = w0 * nH;
      // recurrence-based oscillator for speed
      const dphi = wn * dt;
      const cd = Math.cos(dphi), sd = Math.sin(dphi);
      let cs = 1, sn = 0; // cos/sin of wn*(t-t0), starting at 0
      for (let i = 0; i < M; i++) {
        const v = data[i0 + i];
        a += v * cs;
        b += v * sn;
        const nc = cs * cd - sn * sd;
        sn = sn * cd + cs * sd;
        cs = nc;
      }
      a = a * 2 * sgn / M;
      b = b * 2 * sgn / M;
      const mag = Math.sqrt(a * a + b * b);
      // d(t) ≈ Σ A_n cos(n·w0·(t−t0) + φ_n)
      const phase = Math.atan2(-b, a) * 180 / Math.PI;
      harms.push({ n: nH, f: nH * f0, mag, phase });
    }
    if (harms.length === 0) return { error: "Fundamental is above Nyquist (" + fmt(fNyq, "Hz", 1) + ") — HiRes/decimation lowered the effective sample rate." };
    const fund = harms[0].mag;
    let sumSq = 0;
    for (let i = 1; i < harms.length; i++) sumSq += harms[i].mag * harms[i].mag;
    const thd = fund > 0 ? Math.sqrt(sumSq) / fund : null;
    /* TDD (IEEE 519): the same harmonic content, but referred to the maximum
       demand load current I_L instead of to the fundamental. That is what makes
       it usable as an acceptance criterion — THD blows up when the converter
       runs lightly loaded even though the absolute harmonic current is tiny.
       `mag` here is a peak amplitude while I_L is an rms current, so the
       numerator is converted before dividing; skipping that would report a
       value √2 too large. */
    const harmRms = Math.sqrt(sumSq) / Math.SQRT2;
    const tdd = (iL && iL > 0) ? harmRms / iL : null;
    return { channel: ch, f0, nHarm, dc, harms, thd, tdd, iL: (iL && iL > 0) ? iL : null,
      harmRms, fundRms: fund / Math.SQRT2, periods: P, samples: M, t0, rangeMode, fNyq, clipped };
  }

  /* I_L is the rated / maximum demand load current of the converter. It is
     entered by hand because nothing in a CSV capture can tell us what the
     equipment is rated for — the record only shows what it happened to draw. */
  function readRatedCurrent() {
    const raw = String(R.ilIn.value || "").trim();
    if (!raw) { S.iL = null; R.ilIn.classList.remove("invalid"); return null; }
    const v = parseScaleInput(raw);
    if (v === null || v <= 0) {
      R.ilIn.classList.add("invalid");
      S.iL = null;
      return null;
    }
    R.ilIn.classList.remove("invalid");
    S.iL = v;
    return v;
  }

  function displayedHarms() {
    if (!S.harm || S.harm.error) return [];
    const mode = R.multMode.value;
    const k = Math.max(1, Math.round(parseFloat(R.multKIn.value) || 1));
    if (mode === "mult" && k > 1) return S.harm.harms.filter(h => h.n % k === 0);
    return S.harm.harms;
  }
  function harmDisplayMag(h, H) {
    H = H || S.harm;
    const u = R.harmUnit.value;
    if (!H) return h.mag;
    if (u === "rms") return h.mag / Math.SQRT2;
    if (u === "pct") { const f = H.harms[0].mag; return f > 0 ? (h.mag / f) * 100 : 0; }
    return h.mag;
  }

  // ---------- comparing channels ----------
  const wrap180 = (d) => ((d + 180) % 360 + 360) % 360 - 180;
  const harmAt = (H, n) => (H.harms[n - 1] && H.harms[n - 1].n === n) ? H.harms[n - 1] : null;
  const comparing = () => S.series.length > 1;
  /* Every series with a usable harmonic analysis, source first. */
  const harmSeries = () => S.series.filter(x => x.harm && !x.harm.error);
  /* What the phase panel draws. Δφ mode leaves the source out: against itself
     it is a row of zeros that only takes width from the channels that differ. */
  function phaseSeries() {
    const all = harmSeries();
    if (R.fftPhaseMode.value !== "rel" || !comparing()) return all;
    return all[0] && all[0].ref ? all.slice(1) : [];
  }
  /* The phase of harmonic `hh` of series `x` as the panel shows it: referred
     to the source's window start (`phaseRef`, see runAnalysis) and, in Δφ
     mode, minus the source's own phase at that order. null = too small to
     have a meaningful phase, on either side. */
  function shownPhase(x, hh) {
    const fund = x.harm.harms[0].mag;
    if (!(fund > 0 && hh.mag >= fund * 0.001)) return null;
    if (R.fftPhaseMode.value !== "rel" || !comparing() || x.ref) return comparing() ? hh.phaseRef : hh.phase;
    const src = S.series[0] && S.series[0].ref && S.series[0].harm && !S.series[0].harm.error ? S.series[0].harm : null;
    const r = src && harmAt(src, hh.n);
    if (!r || !(src.harms[0].mag > 0 && r.mag >= src.harms[0].mag * 0.001)) return null;
    return wrap180(hh.phaseRef - r.phaseRef);
  }
  /* Bars of one harmonic order side by side: the slot widens a little when
     there are several so each bar stays readable, and never eats the gap. */
  function slotGeometry(g, K) {
    const slot = K > 1 ? Math.min(g.step * 0.88, Math.max(g.bw, g.bw * 0.55 * K)) : g.bw;
    return { slot, sub: slot / Math.max(1, K) };
  }
  function seriesColor(x, t, i, n) {
    if (comparing()) return x.ch.color + (n === 1 ? "" : "cc");
    return i === "phase" ? "#1d9e4f" + (n === 1 ? "" : "aa") : (n === 1 ? t.accent : t.accent + "99");
  }
  function harmUnitLabel() {
    const u = R.harmUnit.value;
    const base = S.harm ? (S.harm.channel.unit || "") : "";
    return u === "pct" ? "%f₁" : u === "rms" ? base + " rms" : base + " pk";
  }

  // ---------- FFT view rendering ----------
  /* Writes the measured fundamental of the FFT source channel into the box.
     `force` runs even when the automatic mode is off (the Auto button), so the
     button is a one-shot "measure it for me" that does not change the mode. */
  function fillAutoF0(force) {
    if (!force && !R.chkF0Auto.checked) return false;
    const ch = S.channels.find(c => c.id === R.fftSource.value);
    if (!ch) return false;
    const f = autoFundamental(ch);
    if (!f || !isFinite(f) || f <= 0) {
      R.fftSummary.textContent = "Could not measure a fundamental on " + ch.label + " — type it in.";
      return false;
    }
    R.f0In.value = fmtScale(f, "");
    if (force) R.chkF0Auto.checked = true;
    return true;
  }

  function runAnalysis() {
    const ch = S.channels.find(c => c.id === R.fftSource.value);
    if (!ch) { R.fftSummary.textContent = "Load a CSV and pick a source channel."; return; }
    const f0 = parseScaleInput(R.f0In.value);
    if (!f0 || f0 <= 0) { R.fftSummary.textContent = "Enter a valid fundamental frequency."; return; }
    const nHarm = clamp(Math.round(parseFloat(R.nHarmIn.value) || 50), 1, 500);
    readRatedCurrent();
    R.fftSummary.textContent = "Computing…";
    setTimeout(() => {
      S.fft = computeSpectrum(ch, R.fftWindow.value, R.fftRange.value);
      S.harm = computeHarmonics(ch, f0, nHarm, R.fftRange.value, S.iL);
      /* The compared channels go through the very same f₁, window, range and
         harmonic count as the source: harmonic n must be the same frequency on
         every series or putting their bars side by side compares nothing. */
      S.series = [{ ch, fft: S.fft, harm: S.harm, ref: true }];
      S.fftCompare.forEach(id => {
        const c = S.channels.find(x => x.id === id);
        if (c && c.id !== ch.id) S.series.push({ ch: c, fft: computeSpectrum(c, R.fftWindow.value, R.fftRange.value), harm: computeHarmonics(c, f0, nHarm, R.fftRange.value, null) });
      });
      /* Each analysis measures phase against the start of ITS OWN window. Two
         files, or a channel whose visible slice starts a sample later, would
         then disagree by n·ω₁·Δt for no physical reason — so every phase is
         moved to the source's window start before anything compares them. */
      const t0ref = S.harm && !S.harm.error ? S.harm.t0 : null;
      S.series.forEach(x => {
        if (!x.harm || x.harm.error) return;
        const dt0 = t0ref === null ? 0 : x.harm.t0 - t0ref;
        x.harm.harms.forEach(hh => { hh.phaseRef = wrap180(hh.phase - 360 * hh.f * dt0); });
      });
      if (S.fft && !S.fftMaxFreq) S.fftMaxFreq = clamp(f0 * (nHarm + 2), S.fft.freqStep * 10, S.fft.fs / 2);
      if (S.fft) {
        const wanted = parseScaleInput(R.fftMaxIn.value);
        S.fftMaxFreq = wanted && wanted > 0 ? clamp(wanted, S.fft.freqStep * 10, S.fft.fs / 2) : clamp(f0 * (nHarm + 2), S.fft.freqStep * 10, S.fft.fs / 2);
        if (document.activeElement !== R.fftMaxIn) R.fftMaxIn.value = fmtScale(S.fftMaxFreq, "Hz");
      }
      renderFFTView();
      /* A fresh analysis changes how many harmonics exist, so the overlay's
         slider has to follow — and the overlay itself is on the scope tab,
         which is not the one being looked at when Compute is pressed. */
      syncReconUI();
      if (S.recon.on) render();
      // leaving "Computing…" on screen made a finished run look stuck
      R.fftSummary.textContent = S.fft
        ? "Done · " + (R.fftRange.value === "full" ? "full record" : "visible window") + " · "
          + S.fft.usable.toLocaleString() + " samples · Δf " + fmt(S.fft.freqStep, "Hz", 2)
          + " · Nyquist " + fmt(S.fft.fs / 2, "Hz", 1)
          + (comparing() ? " · " + S.series.length + " channels" : "")
          + S.series.filter(x => !x.ref && (!x.harm || x.harm.error)).map(x => " · ⚠ " + x.ch.label + ": " + (x.harm ? x.harm.error : "not enough samples")).join("")
        : "Not enough samples in the selected range.";
    }, 15);
  }

  let analysisTimer = null;
  function scheduleAnalysis() {
    if (!S.harm && !S.fft) return; // only auto-recompute after first manual run
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(runAnalysis, 250);
  }

  function renderFFTView() {
    if (S.tab !== "fft") return;
    drawSpectrumCanvas();
    drawHarmBars();
    drawPhaseBars();
    buildHarmTable();
    buildCompareTable();
  }

  function drawSpectrumCanvas() {
    if (!resizeCanvas("spec")) return;
    const c = CV.spec, t = th();
    drawGrid(c, 10, 4);
    const { ctx, w, h } = c;
    if (!S.fft) {
      ctx.fillStyle = t.muted;
      ctx.font = "12px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Press Compute to run the FFT + harmonic analysis", w / 2, h / 2);
      ctx.textAlign = "left";
      return;
    }
    const result = S.fft;
    const maxFreq = S.fftMaxFreq || result.fs / 2;
    const useDb = R.fftScale.value === "db";
    /* One vertical scale for every trace, set by the tallest of them: that is
       what makes "this one is 6 dB below that one" readable off the screen.
       Scaling each to its own peak would draw every spectrum the same height. */
    const specs = S.series.length ? S.series.filter(x => x.fft) : [{ ch: result.channel, fft: result }];
    let maxMag = 0;
    specs.forEach(x => {
      const m = x.fft.mags, top = Math.min(m.length - 1, Math.round(maxFreq / x.fft.freqStep));
      for (let i = 1; i <= top; i++) if (m[i] > maxMag) maxMag = m[i];
    });
    if (maxMag <= 0) maxMag = 1e-12;
    const yMin = useDb ? -100 : 0, yMax = useDb ? 0 : maxMag * 1.08;
    const fToX = (f) => (f / maxFreq) * w;
    const mToY = (m) => {
      const v = useDb ? (m > 0 ? 20 * Math.log10(m / maxMag) : yMin) : m;
      return h - ((clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * h;
    };
    // harmonic guide lines
    if (S.harm && !S.harm.error) {
      ctx.strokeStyle = t.shadeEdge;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      displayedHarms().forEach(hh => {
        if (hh.f > maxFreq) return;
        const x = fToX(hh.f);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    const W = Math.max(1, Math.round(w));
    // drawn last-to-first so the source ends up on top of what it is compared with
    specs.slice().reverse().forEach(x => {
      const res = x.fft, mags = res.mags;
      const idxMax = clamp(Math.round(maxFreq / res.freqStep), 1, mags.length - 1);
      ctx.save();
      ctx.strokeStyle = x.ch.color;
      ctx.lineWidth = x.ref || specs.length === 1 ? 1.2 : 1;
      if (specs.length > 1 && !x.ref) ctx.globalAlpha = 0.85;
      if (S.glowOn && t.dark) { ctx.shadowColor = x.ch.color; ctx.shadowBlur = 4; }
      ctx.beginPath();
      if (idxMax <= W * 2) {
        for (let i = 1; i <= idxMax; i++) {
          const px = fToX(i * res.freqStep), y = mToY(mags[i]);
          if (i === 1) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
      } else {
        // more bins than pixels: each column draws the largest bin it covers
        const fPer = maxFreq / W;
        for (let px = 0; px < W; px++) {
          const a = Math.max(1, Math.floor(px * fPer / res.freqStep));
          let b = Math.min(idxMax + 1, Math.floor((px + 1) * fPer / res.freqStep));
          if (b <= a) b = a + 1;
          let mx = 0;
          for (let i = a; i < b && i < mags.length; i++) if (mags[i] > mx) mx = mags[i];
          if (px === 0) ctx.moveTo(px + 0.5, mToY(mx)); else ctx.lineTo(px + 0.5, mToY(mx));
        }
      }
      ctx.stroke();
      ctx.restore();
    });
    // axis labels
    ctx.fillStyle = t.muted;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (let d = 1; d < 10; d += 1) {
      if (d % 2) continue;
      ctx.fillText(fmt((d / 10) * maxFreq, "Hz", 1), (d / 10) * w, h - 5);
    }
    const units = [...new Set(specs.map(x => x.ch.unit || ""))];
    ctx.textAlign = "right";
    ctx.fillText(useDb ? "0 dB" : fmt(yMax, units.length === 1 ? units[0] : "", 1), w - 5, 12);
    ctx.fillText(useDb ? "-100 dB" : "0", w - 5, h - 5);
    ctx.textAlign = "left";
    ctx.fillStyle = t.text;
    ctx.fillText("SPECTRUM — " + (specs.length > 1 ? specs.length + " channels" : result.channel.label) + "  ·  window: " + result.windowType + "  ·  Δf " + fmt(result.freqStep, "Hz", 2) + "  ·  Nyquist " + fmt(result.fs / 2, "Hz", 1), 8, 12);
    if (specs.length > 1) drawSpecLegend(ctx, t, specs, 8, 26, w - 60, units.length > 1 ? "units differ — pick “% of fundamental” to compare shapes" : "");
  }

  /* Colour swatch + name per series, in one row that wraps to the next when
     the canvas runs out of width. The source is marked, since in Δφ mode it is
     the zero every other phase is measured from. */
  function drawSpecLegend(ctx, t, list, x0, y0, maxX, note) {
    ctx.font = "10px 'IBM Plex Mono', monospace";
    let x = x0, y = y0;
    list.forEach(s => {
      const txt = s.ch.label + (s.ref ? " (src)" : "");
      const tw = ctx.measureText(txt).width + 22;
      if (x + tw > maxX && x > x0) { x = x0; y += 13; }
      ctx.fillStyle = s.ch.color;
      ctx.fillRect(x, y - 7, 10, 3);
      ctx.fillStyle = t.text;
      ctx.fillText(txt, x + 14, y);
      x += tw;
    });
    if (note) { ctx.fillStyle = t.muted; ctx.fillText(note, x0, y + 13); }
  }

  function barGeometry(c, list) {
    const padL = 48, padR = 10, padT = 18, padB = 20;  // room for 5-char axis labels
    const iw = c.w - padL - padR;
    const bw = Math.max(2, Math.min(34, iw / Math.max(1, list.length) * 0.62));
    const step = iw / Math.max(1, list.length);
    return { padL, padR, padT, padB, iw, ih: c.h - padT - padB, bw, step };
  }

  /* The hover box, one line per series. Shared by both bar panels. */
  function drawHarmTooltip(ctx, t, w, lines) {
    ctx.font = "10px 'IBM Plex Mono', monospace";
    const tw = Math.max(...lines.map(l => ctx.measureText(l.txt).width));
    const bx = w - tw - 20 - (lines.some(l => l.color) ? 12 : 0), bh = 6 + lines.length * 13;
    ctx.fillStyle = t.scopeBg === "#ffffff" ? "rgba(26,35,46,0.92)" : "rgba(240,244,250,0.94)";
    ctx.fillRect(bx, 18, w - bx - 8, bh);
    lines.forEach((l, i) => {
      const y = 29 + i * 13;
      let x = bx + 6;
      if (l.color) { ctx.fillStyle = l.color; ctx.fillRect(x, y - 7, 8, 8); x += 12; }
      ctx.fillStyle = t.scopeBg === "#ffffff" ? "#fff" : "#111";
      ctx.fillText(l.txt, x, y);
    });
  }

  function drawHarmBars() {
    if (!resizeCanvas("harm")) return;
    const c = CV.harm, t = th(), { ctx, w, h } = c;
    ctx.fillStyle = t.scopeBg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.border;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = t.text;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.fillText("HARMONIC MAGNITUDE (" + (S.harm && !S.harm.error ? harmUnitLabel() : "—") + ")", 8, 12);
    if (!S.harm) return;
    if (S.harm.error) {
      ctx.fillStyle = "#c23a3a";
      ctx.font = "11px 'IBM Plex Sans', sans-serif";
      ctx.fillText(S.harm.error, 8, 30);
      return;
    }
    const list = displayedHarms();
    if (!list.length) return;
    const g = barGeometry(c, list);
    const ser = S.series.length ? harmSeries() : [{ ch: S.harm.channel, harm: S.harm, ref: true }];
    const K = ser.length, sg = slotGeometry(g, K);
    let maxV = 0;
    list.forEach(hh => ser.forEach(x => {
      const o = harmAt(x.harm, hh.n);
      if (o) { const v = harmDisplayMag(o, x.harm); if (v > maxV) maxV = v; }
    }));
    if (maxV <= 0) maxV = 1;
    // y grid
    ctx.strokeStyle = t.gridMinor;
    ctx.fillStyle = t.muted;
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = g.padT + g.ih - (i / 4) * g.ih;
      ctx.beginPath(); ctx.moveTo(g.padL, Math.round(y) + 0.5); ctx.lineTo(w - g.padR, Math.round(y) + 0.5); ctx.stroke();
      ctx.fillText(R.harmUnit.value === "pct" ? ((i / 4) * maxV).toFixed(0) : fmt((i / 4) * maxV, "", 1), g.padL - 4, y + 3);
    }
    ctx.textAlign = "center";
    list.forEach((hh, i) => {
      const x0 = g.padL + i * g.step + (g.step - sg.slot) / 2;
      ser.forEach((x, k) => {
        const o = harmAt(x.harm, hh.n);
        if (!o) return;
        const bh = (harmDisplayMag(o, x.harm) / maxV) * g.ih;
        ctx.fillStyle = i === S.hoverHarm ? (K > 1 ? x.ch.color : "#e0821f") : seriesColor(x, t, "mag", hh.n);
        ctx.fillRect(x0 + k * sg.sub, g.padT + g.ih - bh, Math.max(1, sg.sub - (K > 1 && sg.sub > 3 ? 1 : 0)), Math.max(1, bh));
      });
      if (i === S.hoverHarm && K > 1) {
        ctx.strokeStyle = "#e0821f";
        ctx.strokeRect(Math.round(x0) - 1.5, g.padT - 0.5, Math.round(sg.slot) + 3, g.ih + 1);
      }
      if (g.step > 14) {
        ctx.fillStyle = t.muted;
        ctx.fillText(String(hh.n), x0 + sg.slot / 2, h - 7);
      }
    });
    ctx.textAlign = "left";
    // hover tooltip
    if (S.hoverHarm >= 0 && list[S.hoverHarm]) {
      const hh = list[S.hoverHarm], pct = R.harmUnit.value === "pct" ? "%" : "";
      const lines = K > 1
        ? [{ txt: "n=" + hh.n + "  " + fmt(hh.f, "Hz", 1) }].concat(ser.map(x => {
            const o = harmAt(x.harm, hh.n);
            return { color: x.ch.color, txt: x.ch.label + "  " + (o ? fmt(harmDisplayMag(o, x.harm), pct, 3) : "—") };
          }))
        : [{ txt: "n=" + hh.n + "  " + fmt(hh.f, "Hz", 1) + "  " + fmt(harmDisplayMag(hh), pct, 3) + "  φ " + hh.phase.toFixed(1) + "°" }];
      drawHarmTooltip(ctx, t, w, lines);
    }
  }

  function drawPhaseBars() {
    if (!resizeCanvas("phase")) return;
    const c = CV.phase, t = th(), { ctx, w, h } = c;
    ctx.fillStyle = t.scopeBg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.border;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = t.text;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    const rel = comparing() && R.fftPhaseMode.value === "rel";
    ctx.fillText(rel ? "HARMONIC PHASE Δφ (° · channel − source, same order)"
      : comparing() ? "HARMONIC PHASE (° · cos ref @ source window start)"
      : "HARMONIC PHASE (° · cos ref @ window start)", 8, 12);
    if (!S.harm || S.harm.error) return;
    const list = displayedHarms();
    if (!list.length) return;
    const g = barGeometry(c, list);
    const ser = S.series.length ? phaseSeries() : [{ ch: S.harm.channel, harm: S.harm, ref: true }];
    const K = Math.max(1, ser.length), sg = slotGeometry(g, K);
    const zeroY = g.padT + g.ih / 2;
    ctx.strokeStyle = t.gridMinor;
    [-180, -90, 0, 90, 180].forEach(deg => {
      const y = zeroY - (deg / 180) * (g.ih / 2);
      ctx.beginPath(); ctx.moveTo(g.padL, Math.round(y) + 0.5); ctx.lineTo(w - g.padR, Math.round(y) + 0.5); ctx.stroke();
      ctx.fillStyle = t.muted;
      ctx.textAlign = "right";
      ctx.fillText(String(deg), g.padL - 4, y + 3);
    });
    ctx.strokeStyle = t.gridMajor;
    ctx.beginPath(); ctx.moveTo(g.padL, Math.round(zeroY) + 0.5); ctx.lineTo(w - g.padR, Math.round(zeroY) + 0.5); ctx.stroke();
    ctx.textAlign = "center";
    list.forEach((hh, i) => {
      const x0 = g.padL + i * g.step + (g.step - sg.slot) / 2;
      ser.forEach((x, k) => {
        const o = harmAt(x.harm, hh.n);
        if (!o) return;
        const ph = shownPhase(x, o);
        const bx = x0 + k * sg.sub, bw = Math.max(1, sg.sub - (K > 1 && sg.sub > 3 ? 1 : 0));
        if (ph === null) {
          ctx.fillStyle = t.gridMajor;
          ctx.fillRect(bx, zeroY - 1, bw, 2);
          return;
        }
        const bh = (ph / 180) * (g.ih / 2);
        ctx.fillStyle = i === S.hoverHarm ? (K > 1 ? x.ch.color : "#e0821f") : seriesColor(x, t, "phase", hh.n);
        if (bh >= 0) ctx.fillRect(bx, zeroY - bh, bw, Math.max(1, bh));
        else ctx.fillRect(bx, zeroY, bw, Math.max(1, -bh));
      });
      if (i === S.hoverHarm && K > 1) {
        ctx.strokeStyle = "#e0821f";
        ctx.strokeRect(Math.round(x0) - 1.5, g.padT - 0.5, Math.round(sg.slot) + 3, g.ih + 1);
      }
      if (g.step > 14) {
        ctx.fillStyle = t.muted;
        ctx.fillText(String(hh.n), x0 + sg.slot / 2, h - 7);
      }
    });
    ctx.textAlign = "left";
    if (comparing() && S.hoverHarm >= 0 && list[S.hoverHarm]) {
      const hh = list[S.hoverHarm];
      drawHarmTooltip(ctx, t, w, [{ txt: "n=" + hh.n + (rel ? "  Δφ vs source" : "  φ") }].concat(ser.map(x => {
        const o = harmAt(x.harm, hh.n), ph = o ? shownPhase(x, o) : null;
        return { color: x.ch.color, txt: x.ch.label + "  " + (ph === null ? "—" : (ph >= 0 && rel ? "+" : "") + ph.toFixed(1) + "°") };
      })));
    } else if (rel && !ser.length) {
      ctx.fillStyle = t.muted;
      ctx.fillText("Tick a channel under Compare to see its phase against the source.", g.padL, g.padT + 12);
    }
  }

  const IL_PROMPT = "set I<sub>L</sub> to enable";
  function setDistortionReadout(H) {
    if (!H || H.error) {
      R.thdBig.textContent = "—";
      R.tddBig.textContent = "—";
      R.tddSub.innerHTML = S.iL ? "I<sub>L</sub> = " + fmt(S.iL, "A", 3) + " rms" : IL_PROMPT;
      return;
    }
    R.thdBig.textContent = H.thd !== null ? (H.thd * 100).toFixed(2) + " %" : "—";
    if (H.tdd !== null) {
      R.tddBig.textContent = (H.tdd * 100).toFixed(2) + " %";
      R.tddSub.innerHTML = "I<sub>L</sub> = " + fmt(H.iL, H.channel.unit || "A", 3) + " rms · n ≤ " + H.harms.length;
    } else {
      R.tddBig.textContent = "—";
      R.tddSub.innerHTML = IL_PROMPT;
    }
  }

  function buildHarmTable() {
    const el = R.harmTableBody;
    el.innerHTML = "";
    if (!S.harm) {
      setDistortionReadout(null);
      R.harmMeta.textContent = "Run Compute to analyze harmonics.";
      return;
    }
    if (S.harm.error) {
      setDistortionReadout(null);
      R.harmMeta.textContent = S.harm.error;
      return;
    }
    const H = S.harm;
    setDistortionReadout(H);
    const u = H.channel.unit;
    R.harmMeta.innerHTML = H.channel.label + " · f₁ = " + fmt(H.f0, "Hz", 1) + " · " + H.periods + " period" + (H.periods > 1 ? "s" : "") + " · " + H.samples.toLocaleString() + " samples"
      + "<br>DC = " + fmt(H.dc, u, 3) + " · fund = " + fmt(H.harms[0].mag, u, 3) + " pk (" + fmt(H.fundRms, u, 3) + " rms) ∠ " + H.harms[0].phase.toFixed(1) + "°"
      + "<br>harmonic content (n ≥ 2) = " + fmt(H.harmRms, u, 3) + " rms"
      + (H.clipped ? '<br><span style="color:var(--bad)">⚠ ' + H.clipped + " harmonic" + (H.clipped > 1 ? "s" : "") + " above Nyquist (" + fmt(H.fNyq, "Hz", 1) + ") skipped — HiRes reduces bandwidth</span>" : "")
      // I_L is a demand rating, so the measured fundamental should sit below it.
      // Above it, either the run is an overload or I_L was typed in peak amps.
      + (H.iL && H.fundRms > H.iL * 1.02
        ? '<br><span style="color:var(--bad)">⚠ the measured fundamental (' + fmt(H.fundRms, u, 3) + " rms) exceeds I<sub>L</sub> — check that I<sub>L</sub> is the rated current in rms, not peak</span>"
        : "");
    const list = displayedHarms();
    const fund = H.harms[0].mag;
    list.forEach((hh, i) => {
      const tr = document.createElement("tr");
      tr.className = "osc-tr osc-htr" + (hh.n === 1 ? " fund" : "");
      const pct = fund > 0 ? (hh.mag / fund * 100) : 0;
      // per-order distortion against I_L: the form IEEE 519 states its limits in
      const pctIL = H.iL ? (hh.mag / Math.SQRT2 / H.iL * 100) : null;
      const significant = fund > 0 && hh.mag >= fund * 0.001;
      tr.innerHTML =
        "<td>" + hh.n + "</td>" +
        "<td>" + fmt(hh.f, "Hz", 1) + "</td>" +
        "<td>" + fmt(harmDisplayMag(hh), R.harmUnit.value === "pct" ? "%" : "", 4) + "</td>" +
        "<td>" + pct.toFixed(2) + "</td>" +
        "<td" + (pctIL === null ? ' class="dim"' : "") + ">" + (pctIL === null ? "—" : pctIL.toFixed(2)) + "</td>" +
        "<td" + (significant ? "" : ' class="dim"') + ">" + hh.phase.toFixed(1) + "</td>";
      tr.addEventListener("mouseenter", () => { S.hoverHarm = i; drawHarmBars(); drawPhaseBars(); });
      tr.addEventListener("mouseleave", () => { S.hoverHarm = -1; drawHarmBars(); drawPhaseBars(); });
      el.appendChild(tr);
    });
  }

  /* One row per analysed channel: how its fundamental compares with the
     source's, in size and in phase, plus its own THD. Δφ₁ is the number people
     actually came for — voltage against current, input against output. */
  function buildCompareTable() {
    const on = comparing();
    R.fftCmpCard.style.display = on ? "flex" : "none";
    if (!on) return;
    const src = S.series[0].harm && !S.series[0].harm.error ? S.series[0].harm : null;
    const f1 = src ? src.harms[0] : null;
    R.fftCmpBody.innerHTML = "";
    S.series.forEach(x => {
      const tr = document.createElement("tr");
      tr.className = "osc-tr";
      const H = x.harm && !x.harm.error ? x.harm : null;
      const a = H ? H.harms[0] : null;
      const cells = !H ? ["—", "—", "—", "—"] : [
        fmt(a.mag, x.ch.unit, 3),
        x.ref ? "1" : (f1 && f1.mag > 0 ? (a.mag / f1.mag).toPrecision(3) : "—"),
        x.ref ? "0" : (f1 ? (d => (d >= 0 ? "+" : "") + d.toFixed(1))(wrap180(a.phaseRef - f1.phaseRef)) : "—"),
        H.thd !== null ? (H.thd * 100).toFixed(2) + " %" : "—"
      ];
      tr.innerHTML = '<td><span class="dot"></span></td>' + cells.map(v => "<td>" + v + "</td>").join("");
      tr.firstChild.querySelector(".dot").style.background = x.ch.color;
      tr.firstChild.appendChild(document.createTextNode(x.ch.label + (x.ref ? " · src" : "")));
      tr.firstChild.title = x.ch.label + (!H ? " — " + (x.harm ? x.harm.error : "not enough samples") : "");
      R.fftCmpBody.appendChild(tr);
    });
  }

  function exportHarmonics() {
    if (!S.harm || S.harm.error) return;
    const H = S.harm;
    let csv = "# channel," + H.channel.label + "\n# fundamental_Hz," + H.f0 + "\n# periods_used," + H.periods
      + "\n# harmonics_analyzed," + H.harms.length + "\n# DC," + H.dc
      + "\n# fundamental_rms," + H.fundRms + "\n# harmonic_rms_n_ge_2," + H.harmRms
      + "\n# THD_pct," + (H.thd !== null ? (H.thd * 100).toFixed(4) : "")
      + "\n# I_L_rms," + (H.iL !== null ? H.iL : "")
      + "\n# TDD_pct," + (H.tdd !== null ? (H.tdd * 100).toFixed(4) : "") + "\n";
    /* Compared channels get three columns each. Their phase is referred to the
       source's window start, so it can be subtracted from the source's
       phase_deg directly; dphase_deg is that subtraction, already wrapped. */
    const others = harmSeries().filter(x => !x.ref);
    const tag = (x) => x.ch.label.replace(/[^\w]+/g, "_");
    if (others.length) csv += "# compared_phase_reference,source window start\n";
    csv += "n,freq_Hz,mag_peak,mag_rms,pct_of_fundamental,pct_of_IL,phase_deg"
      + others.map(x => "," + tag(x) + "_mag_peak," + tag(x) + "_phase_deg," + tag(x) + "_dphase_deg").join("") + "\n";
    const fund = H.harms[0].mag;
    displayedHarms().forEach(hh => {
      csv += [hh.n, hh.f, hh.mag, hh.mag / Math.SQRT2,
        fund > 0 ? (hh.mag / fund * 100) : 0,
        H.iL ? (hh.mag / Math.SQRT2 / H.iL * 100) : "",
        hh.phase].concat(...others.map(x => {
          const o = harmAt(x.harm, hh.n);
          return o ? [o.mag, o.phaseRef, wrap180(o.phaseRef - hh.phaseRef)] : ["", "", ""];
        })).join(",") + "\n";
    });
    downloadText("harmonics_" + H.channel.label.replace(/[^\w]+/g, "_") + ".csv", csv);
  }

  // ---------- quick spectrum (split panel in scope view) ----------
  let splitTimer = null;
  function scheduleSplit() {
    if (!S.splitOn) return;
    clearTimeout(splitTimer);
    splitTimer = setTimeout(renderSplit, 180);
  }
  function renderSplit() {
    if (!S.splitOn) return;
    if (!resizeCanvas("split")) return;
    const c = CV.split, t = th();
    const ch = S.channels.find(x => x.id === R.fftSource.value) || S.channels.find(x => x.visible);
    drawGrid(c, 10, 4);
    const { ctx, w, h } = c;
    if (!ch) { R.splitReadout.textContent = ""; return; }
    const spec = computeSpectrum(ch, R.fftWindow.value, "visible");
    if (!spec) { R.splitReadout.textContent = "Not enough visible samples for a spectrum."; return; }
    const mags = spec.mags;
    let peakIdx = 1, peakMag = -1, maxMag = 0;
    for (let i = 1; i < mags.length; i++) { if (mags[i] > maxMag) maxMag = mags[i]; }
    if (maxMag <= 0) maxMag = 1e-12;
    // default range: 20x dominant peak
    for (let i = 1; i < mags.length; i++) if (mags[i] > peakMag) { peakMag = mags[i]; peakIdx = i; }
    const peakFreq = peakIdx * spec.freqStep;
    const maxFreq = clamp(Math.max(peakFreq * 20, spec.freqStep * 50), spec.freqStep * 10, spec.fs / 2);
    const idxMax = clamp(Math.round(maxFreq / spec.freqStep), 1, mags.length - 1);
    const mToY = (m) => h - (m / (maxMag * 1.1)) * h;
    ctx.save();
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 1.1;
    if (S.glowOn && t.dark) { ctx.shadowColor = ch.color; ctx.shadowBlur = 4; }
    ctx.beginPath();
    const W = Math.max(1, Math.round(w));
    const per = idxMax / W;
    for (let px = 0; px < W; px++) {
      const a = 1 + Math.floor(px * per);
      let b = 1 + Math.floor((px + 1) * per);
      if (b <= a) b = a + 1;
      let mx = 0;
      for (let i = a; i < b && i < mags.length; i++) if (mags[i] > mx) mx = mags[i];
      if (px === 0) ctx.moveTo(px + 0.5, mToY(mx)); else ctx.lineTo(px + 0.5, mToY(mx));
    }
    ctx.stroke();
    ctx.restore();
    const pX = (peakFreq / maxFreq) * w, pY = mToY(peakMag);
    ctx.fillStyle = t.cursor;
    ctx.beginPath(); ctx.arc(pX, pY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.muted;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (let d = 2; d < 10; d += 2) ctx.fillText(fmt((d / 10) * maxFreq, "Hz", 1), (d / 10) * w, h - 5);
    ctx.textAlign = "left";
    ctx.fillStyle = t.text;
    ctx.fillText("QUICK SPECTRUM — " + ch.label + " (visible window)", 8, 12);
    R.splitReadout.textContent = "Peak " + fmt(peakFreq, "Hz", 2) + " @ " + fmt(peakMag, ch.unit, 3) + " pk · Δf " + fmt(spec.freqStep, "Hz", 2);
  }

  // ---------- XY view ----------
  function renderXY() {
    if (S.tab !== "xy") return;
    if (!resizeCanvas("xy")) return;
    const c = CV.xy, t = th(), { ctx, w, h } = c;
    drawGrid(c, 10, 8);
    const chX = S.channels.find(x => x.id === R.xySrcX.value);
    const chY = S.channels.find(x => x.id === R.xySrcY.value);
    if (!chX || !chY) {
      ctx.fillStyle = t.muted;
      ctx.font = "12px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Pick X and Y channels in the panel on the right", w / 2, h / 2);
      ctx.textAlign = "left";
      return;
    }
    const dx = getData(chX), dy = getData(chY);
    const tx = getTime(chX), ty = getTime(chY);
    if (!dx || !dy) return;
    const N = Math.min(dx.length, dy.length);
    let iStart = 0, iEnd = N - 1;
    if (R.xyRange.value === "visible") {
      const r = visibleRange(chX);
      if (r) { iStart = Math.min(r.iStart, N - 1); iEnd = Math.min(r.iEnd, N - 1); }
    }
    const count = iEnd - iStart + 1;
    if (count < 2) return;
    const sx = chX.invert ? -1 : 1, sy = chY.invert ? -1 : 1;
    const xOf = (v) => w / 2 + ((v * sx / chX.voltsPerDiv) + chX.position) * (w / S.divsH);
    const yOf = (v) => h / 2 - ((v * sy / chY.voltsPerDiv) + chY.position) * (h / S.divsV);
    const step = Math.max(1, Math.floor(count / 60000));
    ctx.save();
    ctx.strokeStyle = chY.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1, S.opts.traceWidth - 0.3);
    ctx.lineJoin = "round";
    if (S.glowOn && t.dark) { ctx.shadowColor = chY.color; ctx.shadowBlur = 5; }
    ctx.beginPath();
    let started = false;
    for (let i = iStart; i <= iEnd; i += step) {
      const px = xOf(dx[i]), py = yOf(dy[i]);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = t.text;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.fillText("X: " + chX.label + " (" + fmtScale(chX.voltsPerDiv, chX.unit) + "/div)", 8, 14);
    ctx.fillText("Y: " + chY.label + " (" + fmtScale(chY.voltsPerDiv, chY.unit) + "/div)", 8, 28);
    ctx.fillStyle = t.muted;
    ctx.fillText(count.toLocaleString() + " pts" + (step > 1 ? " (decimated ×" + step + ")" : ""), 8, h - 8);
  }

  // ---------- interactions ----------
  /* Every hit is resolved inside the pane the pointer is over, and carries
     that pane along so the drag that follows keeps using the same mapping.
     A grab that started in pane 4 must not be interpreted against pane 0's
     rectangle halfway through. */
  // ---------- view changes: zoom, pan, history ----------
  const up125 = (x) => {
    const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
    return (m <= 1.0001 ? 1 : m <= 2.0001 ? 2 : m <= 5.0001 ? 5 : 10) * p;
  };
  /* Switching scale model keeps what is on screen as nearly as it can: going
     to divisions, each channel takes the V/div (rounded up to 1-2-5) that
     covers its plot's current axis, centred where the axis was centred. Going
     back to axes, every plot returns to auto — a fixed axis would have to be
     invented out of eight different channel scales. */
  function setYMode(mode) {
    if (mode !== "div") mode = "axis";
    if (mode === S.yMode) return;
    if (mode === "div") {
      S.channels.forEach(ch => {
        const r = yRange(panesOf(ch)[0]), span = r.max - r.min;
        if (!(span > 0) || !isFinite(span)) return;
        ch.voltsPerDiv = up125(span / S.divsV);
        ch.position = -((r.min + r.max) / 2) / ch.voltsPerDiv;
      });
    } else {
      S.axes.forEach(ax => { if (ax) ax.auto = true; });
    }
    S.yMode = mode;
    S.channels.forEach(syncChannelCard);
    syncAxisUI();
  }
  // everything that has to follow a change of the visible window
  function afterView() {
    if (S.persistOn) clearPersist();
    syncTimeDivUI(); syncAxisUI();
    render(); scheduleMeasure(); scheduleSplit();
  }
  function setTimeWindow(tA, tB) {
    const span = tB - tA;
    if (!(span > 0) || !isFinite(span)) return;
    S.timePerDiv = clamp(span, 1e-15, 1e12) / S.divsH;
    S.hOffset = (tA + tB) / 2;
  }
  /* Zoom history, PLECS' back/forward arrows. A snapshot is the whole view —
     time window, scale model, every plot's axis and every channel's V/div and
     position — so going back after a Y zoom restores Y as well. */
  function viewSnap() {
    return {
      tpd: S.timePerDiv, off: S.hOffset, yMode: S.yMode,
      axes: S.axes.map(a => a ? { auto: a.auto, min: a.min, max: a.max } : null),
      ch: S.channels.map(ch => [ch.id, ch.voltsPerDiv, ch.position])
    };
  }
  function pushHist() {
    const s = viewSnap(), b = S.hist.back;
    S.hist.fwd = [];
    if (!b.length || JSON.stringify(b[b.length - 1]) !== JSON.stringify(s)) {
      b.push(s);
      if (b.length > 100) b.shift();
    }
    updateToolbar();
  }
  function restoreView(v) {
    S.timePerDiv = v.tpd; S.hOffset = v.off; S.yMode = v.yMode;
    S.axes = v.axes.map(a => a ? Object.assign({}, a) : null);
    v.ch.forEach(([id, vpd, pos]) => {
      const ch = S.channels.find(c => c.id === id);
      if (ch) { ch.voltsPerDiv = vpd; ch.position = pos; }
    });
    S.channels.forEach(syncChannelCard);
  }
  function histGo(dir) {
    const from = dir < 0 ? S.hist.back : S.hist.fwd, to = dir < 0 ? S.hist.fwd : S.hist.back;
    if (!from.length) return;
    to.push(viewSnap());
    restoreView(from.pop());
    afterView();
  }
  /* A burst of wheel notches is one history step, not thirty: a new entry
     only when the wheel has been still for a moment. */
  let lastBurst = 0;
  function histBurst() {
    const now = performance.now();
    if (now - lastBurst > 600) pushHist();
    lastBurst = now;
  }
  // zoom time about the pointer: the instant under it stays under it
  function zoomTAt(P, mx, f) {
    const t = xToTime(mx, P), frac = (mx - P.x) / Math.max(1, P.w);
    const span = clamp(S.timePerDiv * S.divsH * f, 1e-15, 1e12);
    S.timePerDiv = span / S.divsH;
    S.hOffset = t - frac * span + span / 2;
  }
  function zoomYAt(P, y, f) {
    if (S.yMode === "axis") {
      const ax = fixAxis(P.i), v = yToDisp(null, y, P);
      ax.min = v - (v - ax.min) * f;
      ax.max = v + (ax.max - v) * f;
      return;
    }
    const ppd = P.h / S.divsV;
    chansOfPane(P).forEach(ch => {
      const d = yToDisp(ch, y, P);
      ch.voltsPerDiv *= f;
      ch.position = (P.y + P.h / 2 - y) / ppd - d / ch.voltsPerDiv;
      syncChannelCard(ch);
    });
  }
  function panY(P, dy) {
    if (S.yMode === "axis") {
      const ax = fixAxis(P.i), k = dy / P.h * (ax.max - ax.min);
      ax.min += k; ax.max += k;
      return;
    }
    const ppd = P.h / S.divsV;
    chansOfPane(P).forEach(ch => { ch.position -= dy / ppd; syncChannelCard(ch); });
  }
  const panT = (P, dx) => { S.hOffset -= dx / Math.max(1, P.w) * S.timePerDiv * S.divsH; };
  // Y back to auto: one plot, or all of them when P is null
  function autoY(P) {
    if (S.yMode === "axis") (P ? [P] : paneRects()).forEach(Q => { axisOf(Q.i).auto = true; });
    else S.channels.filter(ch => ch.visible && (!P || panesOf(ch).indexOf(P.i) !== -1))
      .forEach(ch => { autoscaleChannel(ch); syncChannelCard(ch); });
  }
  function applyBand(d) {
    const P = d.P, k = bandKind(d);
    const xa = Math.min(d.x0, d.x1), xb = Math.max(d.x0, d.x1);
    const yTop = Math.min(d.y0, d.y1), yBot = Math.max(d.y0, d.y1);
    if (k !== "y" && xb - xa < 3) { render(); return; }
    if (k !== "x" && yBot - yTop < 3) { render(); return; }
    pushHist();
    if (k !== "y") setTimeWindow(xToTime(xa, P), xToTime(xb, P));
    if (k !== "x") {
      if (S.yMode === "axis") {
        const lo = yToDisp(null, yBot, P), hi = yToDisp(null, yTop, P), ax = axisOf(P.i);
        ax.min = lo; ax.max = hi; ax.auto = false;
      } else chansOfPane(P).forEach(ch => {
        const lo = yToDisp(ch, yBot, P), hi = yToDisp(ch, yTop, P);
        ch.voltsPerDiv = (hi - lo) / S.divsV;
        ch.position = -(lo + hi) / 2 / ch.voltsPerDiv;
        syncChannelCard(ch);
      });
    }
    afterView();
  }

  // ---------- plot toolbar, axis panel, cursor table ----------
  const TOOL_BTN = { zoom: "tbZoom", zoomx: "tbZoomX", zoomy: "tbZoomY", pan: "tbPan", pointer: "tbPointer" };
  let tbSig = "";
  function updateToolbar() {
    if (!R.tbZoom) return;
    const sig = [S.tool, S.hist.back.length > 0, S.hist.fwd.length > 0, S.cursors.mode, S.legendOn, S.yMode].join("|");
    if (sig === tbSig) return;
    tbSig = sig;
    for (const k in TOOL_BTN) R[TOOL_BTN[k]].classList.toggle("on", S.tool === k);
    R.tbBack.disabled = !S.hist.back.length;
    R.tbFwd.disabled = !S.hist.fwd.length;
    R.tbCursors.classList.toggle("on", S.cursors.mode !== "off");
    R.tbLegend.classList.toggle("on", S.legendOn);
    R.tbYMode.classList.toggle("on", S.yMode === "div");
  }
  function setTool(tool) {
    S.tool = TOOL_BTN[tool] ? tool : "zoom";
    updateToolbar();
  }
  function syncAxisUI() {
    if (!R.axPane) return;
    const n = paneCount();
    if (R.axPane.options.length !== n) {
      const keep = +R.axPane.value || 0;
      R.axPane.innerHTML = Array.from({ length: n }, (_, i) => '<option value="' + i + '">Plot ' + (i + 1) + "</option>").join("");
      R.axPane.value = String(Math.min(keep, n - 1));
    }
    const i = +R.axPane.value || 0, div = S.yMode === "div";
    const r = yRange(i), ax = axisOf(i);
    const f = v => isFinite(v) ? String(+v.toPrecision(5)) : "";
    R.yModeSel.value = S.yMode;
    if (document.activeElement !== R.axMin) R.axMin.value = f(r.min);
    if (document.activeElement !== R.axMax) R.axMax.value = f(r.max);
    R.axAuto.checked = ax.auto;
    [R.axPane, R.axMin, R.axMax, R.axAuto].forEach(el => { el.disabled = div; });
  }
  const escHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /* Mean, RMS, min and max of the samples between the two cursors, in
     displayed values. A periodic channel is read through its repetition, so
     the numbers agree with a window that lies past the end of the record. */
  function statsBetween(ch, a, b) {
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length < 2) return null;
    const N = Math.min(time.length, data.length);
    const t0 = time[0], dt = (time[N - 1] - t0) / (N - 1);
    if (!(dt > 0)) return null;
    const sg = ch.invert ? -1 : 1;
    let n = 0, s = 0, q = 0, lo = Infinity, hi = -Infinity;
    const add = (v) => { v *= sg; n++; s += v; q += v * v; if (v < lo) lo = v; if (v > hi) hi = v; };
    const T = resolvePeriod(ch);
    if (T && T > 0) {
      const m = clamp(Math.round((b - a) / dt) + 1, 2, 200000), st = (b - a) / (m - 1);
      for (let k = 0; k < m; k++) {
        const t = a + k * st, tt = t - Math.floor((t - t0) / T) * T;
        const i = Math.round((tt - t0) / dt);
        if (i >= 0 && i < N) add(data[i]);
      }
    } else {
      const i0 = Math.max(0, Math.ceil((a - t0) / dt - 1e-9)), i1 = Math.min(N - 1, Math.floor((b - t0) / dt + 1e-9));
      for (let i = i0; i <= i1; i++) add(data[i]);
    }
    return n ? { mean: s / n, rms: Math.sqrt(q / n), min: lo, max: hi, n } : null;
  }
  /* The PLECS cursor table: one row per signal, its value at each cursor, the
     difference, and what the signal does between the two. Rebuilt only when
     something it shows changes, never per frame. */
  let curSig = "";
  function updateCursorTable() {
    if (!R.cursorCard) return;
    const cu = S.cursors;
    const on = (cu.mode === "time" || cu.mode === "track") && S.files.length > 0;
    R.cursorCard.classList.toggle("hide", !on);
    if (!on) { curSig = ""; return; }
    const vis = S.channels.filter(c => c.visible);
    const sig = cu.t1 + "|" + cu.t2 + "|" + vis.map(c => [c.id, c.label, c.color, c.unit, c.invert, (getData(c) || []).length, resolvePeriod(c), c.tOffset || 0].join(",")).join(";");
    if (sig === curSig) return;
    curSig = sig;
    const dt = cu.t2 - cu.t1;
    R.cursorHead.textContent = "Δt = " + fmt(dt, "s") + "   1/Δt = " + (dt !== 0 ? fmt(1 / Math.abs(dt), "Hz") : "—");
    const a = Math.min(cu.t1, cu.t2), b = Math.max(cu.t1, cu.t2);
    const cell = (v, u) => "<td>" + (v === null || v === undefined ? "—" : fmt(v, u, 3)) + "</td>";
    R.cursorBody.innerHTML = vis.map(ch => {
      const sg = ch.invert ? -1 : 1;
      const r1 = sampleAt(ch, cu.t1), r2 = sampleAt(ch, cu.t2);
      const v1 = r1 === null ? null : sg * r1, v2 = r2 === null ? null : sg * r2;
      const st = statsBetween(ch, a, b) || {};
      return '<tr><td class="sig"><span class="sw" style="background:' + ch.color + '"></span>' + escHtml(ch.label) + "</td>" +
        cell(v1, ch.unit) + cell(v2, ch.unit) + cell(v1 !== null && v2 !== null ? v2 - v1 : null, ch.unit) +
        cell(st.mean, ch.unit) + cell(st.rms, ch.unit) + cell(st.min, ch.unit) + cell(st.max, ch.unit) + "</tr>";
    }).join("") || '<tr><td colspan="8" class="osc-empty">No visible signals.</td></tr>';
  }

  /* What is under the pointer, most specific first: the axis bands (and, in
     div mode, the ground markers inside the y band), cursors, the trigger
     arrow, the zoom region. */
  function hitTest(mx, my) {
    const g = gutterAt(mx, my);
    if (g) {
      const P = g.P;
      if (g.side === "y" && S.yMode === "div" && mx >= P.x - 17) {
        for (const ch of chansOfPane(P)) {
          const y = clamp(dispToY(ch, 0, P), P.y + 6, P.y + P.h - 6);
          if (Math.abs(my - y) <= 7) return { type: "chpos", ch, P };
        }
      }
      return { type: g.side === "y" ? "gutterY" : "gutterX", P };
    }
    const P = paneAt(mx, my);
    if (!P) return null;
    const cu = S.cursors;
    const visCh = chansOfPane(P);
    if (cu.mode === "time" || cu.mode === "track") {
      for (const key of ["t1", "t2"]) {
        const x = timeToX(cu[key], P);
        if (Math.abs(mx - x) <= 6 || (P.h >= 40 && my <= P.y + 13 && Math.abs(mx - x) <= 8)) return { type: "cursorT", key, P };
      }
    }
    if (cu.mode === "value") {
      const ref = visCh.find(ch => ch.id === cu.refId) || visCh[0];
      if (ref) for (const key of ["v1", "v2"]) {
        if (Math.abs(my - dispToY(ref, cu[key], P)) <= 6) return { type: "cursorV", key, ref, P };
      }
    }
    const trig = visCh.find(c => c.id === S.trigger.sourceId);
    if (trig) {
      const y = dispToY(trig, S.trigger.level, P);
      if (mx >= P.x + P.w - 14 && Math.abs(my - y) <= 8) return { type: "trigger", ch: trig, P };
    }
    if (S.zoomOn) {
      const x1 = timeToX(S.zoomT - S.zoomSpan / 2, P), x2 = timeToX(S.zoomT + S.zoomSpan / 2, P);
      if (mx >= x1 && mx <= x2 && my >= P.y + P.h - 16) return { type: "zoomRegion", P };
    }
    return null;
  }

  const HIT_CURSOR = { cursorT: "ew-resize", cursorV: "ns-resize", chpos: "ns-resize", trigger: "ns-resize", zoomRegion: "grab", gutterY: "ns-resize", gutterX: "ew-resize" };
  function bindScopeInteractions() {
    const canvas = R.scopeCanvas;
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    /* Wheel zooms about the pointer, as in PLECS: time over a plot or the
       time axis, Y with Shift or over a y axis, both with Ctrl. Continuous,
       not stepped through the Time/div list — a trackpad sends slivers, and
       jumping a whole 1-2-5 step per sliver made it unusable. */
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (S.files.length === 0) return;
      const [mx, my] = at(e);
      const g = gutterAt(mx, my), P = g ? g.P : paneAt(mx, my);
      if (!P) return;
      const dl = (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      if (!dl) return;
      const f = Math.exp(clamp(dl, -300, 300) * 0.0015);
      const cx = clamp(mx, P.x, P.x + P.w), cy = clamp(my, P.y, P.y + P.h);
      histBurst();
      const doY = e.shiftKey || e.ctrlKey || (g && g.side === "y");
      const doT = !e.shiftKey && !(g && g.side === "y");
      if (doY) zoomYAt(P, cy, f);
      if (doT) zoomTAt(P, cx, f);
      afterView();
    }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2 || S.files.length === 0) return;
      const [mx, my] = at(e);
      const hit = hitTest(mx, my);
      const P = hit ? hit.P : paneAt(mx, my);
      if (!P) return;
      e.preventDefault();
      const base = { P, lastX: mx, lastY: my, histPushed: false };
      const onAxis = hit && (hit.type === "gutterY" || hit.type === "gutterX");
      if (onAxis) S.dragging = Object.assign(base, { type: hit.type === "gutterY" ? "panY" : "panT" });
      else if (e.button === 1) S.dragging = Object.assign(base, { type: "panxy" });
      else if (hit) S.dragging = Object.assign(base, hit, { startT: xToTime(mx, P), zoomT0: S.zoomT });
      else if (S.tool === "pan") S.dragging = Object.assign(base, { type: "panxy" });
      else if (S.tool === "pointer") S.dragging = Object.assign(base, { type: "panT" });
      else {
        const x = clamp(mx, P.x, P.x + P.w), y = clamp(my, P.y, P.y + P.h);
        S.dragging = Object.assign(base, { type: "box", x0: x, y0: y, x1: x, y1: y, moved: false });
      }
      if (S.dragging.type.indexOf("pan") === 0 && S.dragging.type !== "panY") canvas.style.cursor = "grabbing";
    });

    canvas.addEventListener("dblclick", (e) => {
      if (S.files.length === 0) return;
      const [mx, my] = at(e);
      const g = gutterAt(mx, my), P = paneAt(mx, my);
      if (!g && !P) return;
      pushHist();
      if (g && g.side === "y") autoY(g.P);
      else if (g) fitTimeWin();
      else { fitTimeWin(); autoY(null); }
      afterView();
    });

    window.addEventListener("mousemove", (e) => {
      const [mx, my] = at(e);
      const inside = mx >= 0 && mx <= CV.scope.w && my >= 0 && my <= CV.scope.h;

      if (S.dragging) {
        const d = S.dragging;
        const P = d.P || fullPane();
        const dx = mx - d.lastX, dy = my - d.lastY;
        d.lastX = mx; d.lastY = my;
        const once = () => { if (!d.histPushed) { pushHist(); d.histPushed = true; } };
        if (d.type === "box") {
          d.x1 = clamp(mx, P.x, P.x + P.w); d.y1 = clamp(my, P.y, P.y + P.h);
          if (!d.moved && Math.hypot(d.x1 - d.x0, d.y1 - d.y0) > 4) d.moved = true;
          render();
          return;
        }
        if (d.type === "panT" || d.type === "panY" || d.type === "panxy") {
          if (!dx && !dy) return;
          once();
          if (d.type !== "panY" && dx) panT(P, dx);
          if (d.type !== "panT" && dy) panY(P, dy);
          afterView();
          return;
        }
        if (d.type === "chpos") {
          once();
          d.ch.position = (P.y + P.h / 2 - my) / pxPerDivV(P);
          syncChannelCard(d.ch);
        } else if (d.type === "trigger") {
          S.trigger.level = yToDisp(d.ch, my, P);
          if (document.activeElement !== R.trigLevelIn) R.trigLevelIn.value = fmtScale(S.trigger.level, "");
        } else if (d.type === "cursorT") {
          S.cursors[d.key] = xToTime(clamp(mx, P.x, P.x + P.w), P);
        } else if (d.type === "cursorV") {
          S.cursors[d.key] = yToDisp(d.ref, clamp(my, P.y, P.y + P.h), P);
        } else if (d.type === "zoomRegion") {
          S.zoomT = d.zoomT0 + (xToTime(mx, P) - d.startT);
        }
        render();
        return;
      }

      if (!inside || S.files.length === 0 || S.tab !== "scope") { R.hoverReadout.style.display = "none"; return; }
      const hit = hitTest(mx, my);
      canvas.style.cursor = hit ? HIT_CURSOR[hit.type] : (S.tool === "pan" ? "grab" : S.tool === "pointer" ? "default" : "crosshair");
      const hoverPane = paneAt(mx, my);
      if (hoverPane) {
        const t = xToTime(mx, hoverPane);
        // only what is actually plotted in the plot under the pointer
        const lines = [(isGrid() ? "plot " + (hoverPane.i + 1) + "   " : "") + "t = " + fmt(t, "s")];
        chansOfPane(hoverPane).forEach(ch => {
          const v = sampleAt(ch, t);
          if (v !== null) lines.push(ch.label + " = " + fmt(ch.invert ? -v : v, ch.unit, 3));
        });
        R.hoverReadout.textContent = lines.join("\n");
        R.hoverReadout.style.display = "block";
      } else {
        R.hoverReadout.style.display = "none";
      }
    });
    window.addEventListener("mouseup", () => {
      const d = S.dragging;
      if (!d) return;
      S.dragging = null;
      if (d.type === "box") { if (d.moved) applyBand(d); else render(); }
      else if (d.type === "cursorT") scheduleMeasure();
      if (R.scopeCanvas.style.cursor === "grabbing") R.scopeCanvas.style.cursor = S.tool === "pan" ? "grab" : "crosshair";
    });
    canvas.addEventListener("mouseleave", () => { if (!S.dragging) R.hoverReadout.style.display = "none"; });

    R.zoomCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      S.zoomSpan = clamp(S.zoomSpan * (e.deltaY > 0 ? 1.25 : 0.8), 1e-12, S.timePerDiv * S.divsH);
      render();
    }, { passive: false });

    // drag inside zoom canvas to pan the zoom window
    let zoomDrag = null;
    R.zoomCanvas.addEventListener("mousedown", (e) => {
      zoomDrag = { startX: e.clientX, zoomT0: S.zoomT };
    });
    window.addEventListener("mousemove", (e) => {
      if (!zoomDrag) return;
      const dxPx = e.clientX - zoomDrag.startX;
      S.zoomT = zoomDrag.zoomT0 - (dxPx / CV.zoom.w) * S.zoomSpan;
      render();
    });
    window.addEventListener("mouseup", () => { zoomDrag = null; });
  }

  function findTriggerCrossing(dir) {
    const ch = S.channels.find(c => c.id === S.trigger.sourceId);
    if (!ch) { R.statusLeft.textContent = "Pick a trigger source first."; return; }
    const data = getData(ch), time = getTime(ch);
    if (!data) return;
    const level = S.trigger.level;
    const rising = S.trigger.slope === "rising";
    const center = S.hOffset;
    const eps = S.timePerDiv * 0.01;
    let best = null;
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1] * (ch.invert ? -1 : 1);
      const cur = data[i] * (ch.invert ? -1 : 1);
      const crossed = rising ? (prev < level && cur >= level) : (prev > level && cur <= level);
      if (!crossed) continue;
      const t = time[i - 1] + (time[i] - time[i - 1]) * ((level - prev) / (cur - prev));
      if (dir > 0 && t > center + eps) { best = t; break; }
      if (dir < 0 && t < center - eps) best = t; // keep last one before center
    }
    if (best !== null) {
      S.hOffset = best;
      if (S.persistOn) clearPersist();
      syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit();
    } else R.statusLeft.textContent = "No trigger crossing found in that direction.";
  }

  // ---------- theme application ----------
  const THEME_INPUTS = { thApp: "app", thSurface: "surface", thText: "text", thAccent: "accent", thScopeBg: "scopeBg", thGridMinor: "gridMinor", thGridMajor: "gridMajor", thCursor: "cursor" };
  function syncThemeInputs() {
    const t = curTheme();
    Object.keys(THEME_INPUTS).forEach(id => { if (R[id]) R[id].value = t[THEME_INPUTS[id]]; });
  }
  function applyTheme(t, save) {
    const wasDark = screenIsDark();
    S.theme = t;
    const st = document.documentElement.style;
    Object.keys(CSS_VARS).forEach(k => st.setProperty("--" + CSS_VARS[k], t[k]));
    // Derived tokens: readable text on the accent fill, tints for hovers and
    // highlights, and a bezel whose depth matches how dark the screen is.
    const dark = luminance(t.scopeBg) < 0.5;
    const panelDark = luminance(t.surface) < 0.5;
    st.setProperty("--on-accent", luminance(t.accent) > 0.55 ? "#0b1118" : "#ffffff");
    st.setProperty("--accent-a1", hexA(t.accent, panelDark ? 0.13 : 0.08));
    st.setProperty("--accent-a2", hexA(t.accent, 0.28));
    st.setProperty("--ok", panelDark ? "#3ddc7f" : "#0f7a4a");
    st.setProperty("--bad", panelDark ? "#ff6b6b" : "#d92b2b");
    st.setProperty("--bad-a", hexA(panelDark ? "#ff6b6b" : "#d92b2b", 0.25));
    st.setProperty("--sheen", panelDark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)");
    st.setProperty("--shadow-1", panelDark ? "rgba(0,0,0,.35)" : "rgba(16,30,54,.09)");
    st.setProperty("--shadow-2", panelDark ? "rgba(0,0,0,.5)" : "rgba(16,30,54,.18)");
    st.setProperty("--bezel", dark
      ? "inset 0 0 0 1px rgba(0,0,0,.6), inset 0 3px 26px rgba(0,0,0,.55)"
      : "inset 0 1px 4px rgba(16,30,54,.10)");
    // Traces the user never recoloured follow the theme, so the classic
    // yellow/cyan set does not end up invisible on a white screen.
    if (dark !== wasDark) {
      S.channels.forEach(ch => { if (ch.autoColor) ch.color = colorFor(ch.colorIdx); });
      rebuildChannelList();  // only on a real palette flip: this steals focus
    }
    if (save !== false) { try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch (e) { /* no storage */ } }
    syncThemeInputs();
    clearPersist();
    setTab(S.tab);
  }
  function resetTheme() {
    try { localStorage.removeItem(THEME_KEY); } catch (e) { /* no storage */ }
    applyTheme(Object.assign({}, S.opts.scopeDark === false ? THEME_LIGHT : THEME_DARK), false);
  }
  function wireTheme() {
    R.btnThemeLight.addEventListener("click", () => applyTheme(Object.assign({}, THEME_LIGHT)));
    R.btnThemeDark.addEventListener("click", () => applyTheme(Object.assign({}, THEME_DARK)));
    R.btnThemeReset.addEventListener("click", resetTheme);
    Object.keys(THEME_INPUTS).forEach(id => {
      R[id].addEventListener("input", () => {
        const t = curTheme();
        t[THEME_INPUTS[id]] = R[id].value;
        if (THEME_INPUTS[id] === "surface") t.surface2 = R[id].value;
        applyTheme(t);
      });
    });
  }

  // ---------- tabs ----------
  function setTab(tab) {
    S.tab = tab;
    const tabs = { scope: R.tabScope, fft: R.tabFFT, xy: R.tabXY };
    Object.entries(tabs).forEach(([k, btn]) => btn.classList.toggle("on", k === tab));
    R.viewScope.style.display = tab === "scope" ? "flex" : "none";
    R.viewFFT.style.display = tab === "fft" ? "grid" : "none";
    R.viewXY.style.display = tab === "xy" ? "flex" : "none";
    R.sideScope.style.display = tab === "scope" ? "flex" : "none";
    R.sideFFT.style.display = tab === "fft" ? "flex" : "none";
    R.sideXY.style.display = tab === "xy" ? "flex" : "none";
    requestAnimationFrame(() => {
      if (tab === "scope") { resizeCanvas("scope"); render(); scheduleSplit(); }
      else if (tab === "fft") renderFFTView();
      else renderXY();
    });
  }

  // ---------- status ----------
  function updateStatus() {
    const nCh = S.channels.filter(c => c.visible).length;
    const lay = isGrid() ? " · " + S.layout.rows + "x" + S.layout.cols + " grid" : "";
    R.statusLeft.textContent = S.files.length
      ? S.files.length + " file" + (S.files.length > 1 ? "s" : "") + " · " + nCh + " visible channel" + (nCh !== 1 ? "s" : "") + " · " + fmt(S.timePerDiv, "s", 0) + "/div" + lay
      : "No data loaded.";
    if (S.files.length) {
      const f = S.files[0];
      R.statusRight.textContent = "fs ≈ " + fmt(1 / f.dt, "Hz", 1) + " · " + f.rowCount.toLocaleString() + " pts · scroll = zoom · drag = pan · F = fit";
    } else {
      R.statusRight.textContent = "";
    }
  }

  // ---------- wiring ----------
  // ---------- plot layout UI ----------
  function buildLayoutPicker() {
    const g = R.layoutPick;
    g.innerHTML = "";
    for (let r = 0; r < MAX_GRID; r++) for (let k = 0; k < MAX_GRID; k++) {
      const cell = document.createElement("i");
      cell.dataset.r = r; cell.dataset.c = k;
      cell.addEventListener("mouseenter", () => paintLayoutPicker(r + 1, k + 1));
      cell.addEventListener("click", () => setLayout(r + 1, k + 1));
      g.appendChild(cell);
    }
    g.addEventListener("mouseleave", () => paintLayoutPicker());
    paintLayoutPicker();
  }
  /* Highlights the rectangle that would be chosen. With no argument it falls
     back to the layout in force, which is what makes the picker show the
     current state when the pointer leaves it. */
  function paintLayoutPicker(rows, cols) {
    const rr = rows || S.layout.rows, cc = cols || S.layout.cols;
    R.layoutPick.querySelectorAll("i").forEach(cell => {
      const r = +cell.dataset.r, k = +cell.dataset.c;
      cell.classList.toggle("in", r < rr && k < cc);
      cell.classList.toggle("cur", !rows && r === S.layout.rows - 1 && k === S.layout.cols - 1);
    });
    const n = rr * cc;
    R.layoutLabel.textContent = rr + " x " + cc + (n === 1 ? " — single plot" : " — " + n + " plots");
  }
  function setLayout(rows, cols) {
    S.layout.rows = clamp(rows, 1, MAX_GRID);
    S.layout.cols = clamp(cols, 1, MAX_GRID);
    invalidatePanes();
    remapPanes();
    if (S.persistOn) clearPersist();          // the old afterglow is in the wrong places now
    paintLayoutPicker();
    rebuildChannelList();
    syncAxisUI();
    render();
  }
  /* One channel per plot, in order. The obvious thing to want after choosing a
     grid, and doing it by hand is 36 clicks. */
  function spreadChannels() {
    const vis = S.channels.filter(c => c.visible);
    if (!vis.length) return;
    const n = paneCount();
    vis.forEach((ch, i) => { ch.panes = [i % n]; });
    rebuildChannelList();
    render();
  }

  // ---------- reconstruction UI ----------
  function syncReconUI() {
    R.chkRecon.checked = S.recon.on;
    R.reconBody.style.display = S.recon.on ? "block" : "none";
    R.chkReconParts.checked = S.recon.components;
    R.btnReconPlay.textContent = S.recon.playing ? "❚❚ Pause" : "▶ Build up";
    R.reconNharm.value = String(S.recon.nHarm);
    const list = reconChannels();
    const kMax = Math.max(1, reconMaxK());
    R.reconK.max = String(kMax);
    S.recon.k = clamp(Math.round(S.recon.k), 0, kMax);
    R.reconK.value = String(S.recon.k);
    R.reconKVal.textContent = String(S.recon.k);
    if (!S.recon.on) { R.reconNote.textContent = ""; return; }
    /* Silence would read as broken, so the note always says which channels are
       being reconstructed — or why none are. */
    if (!list.length) {
      const vis = S.channels.filter(c => c.visible);
      R.reconNote.textContent = !vis.length
        ? "No visible channels."
        : vis.every(c => c.reconOn === false)
          ? "No channel has Fourier ticked — enable it on a channel card."
          : "No fundamental could be measured. Set f₀ to manual on the channel card.";
      return;
    }
    R.reconNote.textContent = list.map(ch => ch.label + " f₀ " + fmt(ch.harmCache.H.f0, "Hz", 2)).join(" · ");
  }
  let reconTimer = null;
  function startReconPlay() {
    const kMax = reconMaxK();
    if (!kMax) return;
    stopReconPlay();
    S.recon.playing = true;
    if (S.recon.k >= kMax) S.recon.k = 0;   // replay from the start
    reconTimer = setInterval(() => {
      S.recon.k++;
      if (S.recon.k >= kMax) { S.recon.k = kMax; stopReconPlay(); }
      syncReconUI(); render();
    }, 320);
    syncReconUI();
  }
  function stopReconPlay() {
    clearInterval(reconTimer);
    reconTimer = null;
    S.recon.playing = false;
    R.btnReconPlay.textContent = "▶ Build up";
  }

  function wire() {
    bindScopeInteractions();
    R.btnLoad.addEventListener("click", () => R.fileInput.click());
    R.fileInput.addEventListener("change", () => {
      Array.from(R.fileInput.files || []).forEach(loadFile);
      R.fileInput.value = "";
    });
    ["dragover", "drop"].forEach(evt => {
      document.body.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === "drop") {
          Array.from(e.dataTransfer.files || []).filter(f => /\.csv$/i.test(f.name)).forEach(loadFile);
        }
      });
    });

    R.btnAutoset.addEventListener("click", () => {
      pushHist();
      S.channels.forEach(autoscaleChannel);
      S.axes.forEach(ax => { if (ax) ax.auto = true; });
      fitAll();
      rebuildChannelList();
    });
    R.btnFit.addEventListener("click", fitAll);
    R.btnReset.addEventListener("click", () => {
      S.channels.forEach(ch => {
        ch.invert = false; ch.avgN = 1; ch.avgCache = null; ch.hiresN = 1; ch.hiresCache = null;
        ch.tOffset = 0; ch.tOffCache = null;
        ch.panes = [0]; ch.periodic = false; ch.periodMode = "auto"; ch.periodT = 0; ch.perCache = null;
        ch.reconOn = true; ch.f0Mode = "auto"; ch.f0 = 0; ch.harmCache = null;
        autoscaleChannel(ch);
      });
      S.cursors.mode = "off"; R.cursorMode.value = "off";
      R.cursorRefRow.style.display = "none";
      S.trigger = { sourceId: "", level: 0, slope: "rising" };
      R.trigSource.value = "";
      S.persistOn = false; R.chkPersist.checked = false; R.persistDecayRow.style.display = "none";
      stopReconPlay();
      S.recon.on = false; S.recon.k = 1; S.recon.components = false;
      syncReconUI();
      clearPersist();
      setLayout(1, 1);
      S.yMode = "axis"; S.axes = []; S.hist = { back: [], fwd: [] }; S.tool = "zoom";
      fitAll();
      rebuildChannelList();
      updateToolbar();
    });
    R.btnShot.addEventListener("click", () => {
      const src = S.tab === "fft" ? CV.spec.canvas : S.tab === "xy" ? CV.xy.canvas : CV.scope.canvas;
      const a = document.createElement("a");
      a.download = "scope_" + S.tab + ".png";
      a.href = src.toDataURL("image/png");
      a.click();
    });
    R.btnExportData.addEventListener("click", exportVisibleData);
    R.btnExportMeas.addEventListener("click", exportMeasurements);

    R.tabScope.addEventListener("click", () => setTab("scope"));
    R.tabFFT.addEventListener("click", () => setTab("fft"));
    R.tabXY.addEventListener("click", () => setTab("xy"));

    R.timeDiv.addEventListener("change", () => {
      const v = parseFloat(R.timeDiv.value);
      if (!(v > 0)) return;
      pushHist();
      S.timePerDiv = v;
      afterView();
    });
    R.hOffsetIn.addEventListener("change", () => {
      const v = parseFloat(R.hOffsetIn.value);
      if (isFinite(v)) { S.hOffset = v / 1000; if (S.persistOn) clearPersist(); render(); scheduleMeasure(); scheduleSplit(); }
    });
    R.btnPanL.addEventListener("click", () => { S.hOffset -= S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit(); });
    R.btnPanR.addEventListener("click", () => { S.hOffset += S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit(); });
    R.btnZinH.addEventListener("click", () => { if (S.persistOn) clearPersist(); zoomHStep(-1); scheduleSplit(); });
    R.btnZoutH.addEventListener("click", () => { if (S.persistOn) clearPersist(); zoomHStep(1); scheduleSplit(); });

    // ----- PLECS-style plot toolbar -----
    ["pointer", "zoom", "zoomx", "zoomy", "pan"].forEach(t => R[TOOL_BTN[t]].addEventListener("click", () => setTool(t)));
    R.tbFit.addEventListener("click", () => { pushHist(); fitTimeWin(); autoY(null); afterView(); });
    R.tbFitY.addEventListener("click", () => { pushHist(); autoY(null); afterView(); });
    R.tbBack.addEventListener("click", () => histGo(-1));
    R.tbFwd.addEventListener("click", () => histGo(1));
    R.tbCursors.addEventListener("click", () => {
      R.cursorMode.value = S.cursors.mode === "off" ? "time" : "off";
      R.cursorMode.dispatchEvent(new Event("change"));
      updateToolbar();
    });
    R.tbLegend.addEventListener("click", () => { S.legendOn = !S.legendOn; updateToolbar(); render(); });
    R.tbYMode.addEventListener("click", () => { pushHist(); setYMode(S.yMode === "div" ? "axis" : "div"); afterView(); updateToolbar(); });
    R.tbPng.addEventListener("click", () => R.btnShot.click());
    R.tbCsv.addEventListener("click", () => R.btnExportData.click());
    R.tbInfo.addEventListener("click", () => {
      alert("Plot tools (PLECS style)\n\n" +
        "Zoom box: drag a rectangle · Zoom X / Zoom Y: drag a band · Pan: drag the view\n" +
        "Wheel: zoom time · Shift/Ctrl+wheel or wheel over the y axis: zoom Y\n" +
        "Drag the axis gutters to pan that axis · middle button: pan\n" +
        "Double-click: fit · Backspace / Alt+←: back · Alt+→: forward\n" +
        "Keys: Z zoom · X zoom X · Y zoom Y · H pan · Esc pointer · C cursors · L legend · A fit Y · F fit");
    });
    R.yModeSel.addEventListener("change", () => { pushHist(); setYMode(R.yModeSel.value); afterView(); updateToolbar(); });
    R.axPane.addEventListener("change", syncAxisUI);
    const axEdit = (lo) => {
      const i = +R.axPane.value || 0;
      const v = parseScaleInput((lo ? R.axMin : R.axMax).value);
      const r = yRange(i);
      if (v === null || (lo ? v >= r.max : v <= r.min)) { syncAxisUI(); return; }
      pushHist();
      const ax = fixAxis(i);
      if (lo) ax.min = v; else ax.max = v;
      afterView();
    };
    R.axMin.addEventListener("change", () => axEdit(true));
    R.axMax.addEventListener("change", () => axEdit(false));
    R.axAuto.addEventListener("change", () => {
      const i = +R.axPane.value || 0;
      pushHist();
      if (R.axAuto.checked) axisOf(i).auto = true; else fixAxis(i);
      afterView();
    });
    const tEdit = () => {
      const a = parseFloat(R.tStartIn.value), b = parseFloat(R.tEndIn.value);
      if (!(isFinite(a) && isFinite(b) && b > a)) { syncTimeDivUI(); return; }
      pushHist();
      setTimeWindow(a / 1000, b / 1000);
      afterView();
    };
    R.tStartIn.addEventListener("change", tEdit);
    R.tEndIn.addEventListener("change", tEdit);

    R.trigSource.addEventListener("change", () => { S.trigger.sourceId = R.trigSource.value; render(); });
    R.trigSlope.addEventListener("change", () => { S.trigger.slope = R.trigSlope.value; render(); });
    R.trigLevelIn.addEventListener("change", () => {
      const v = parseScaleInput(R.trigLevelIn.value);
      if (v !== null) { S.trigger.level = v; render(); }
    });
    R.btnTrigPrev.addEventListener("click", () => findTriggerCrossing(-1));
    R.btnTrigNext.addEventListener("click", () => findTriggerCrossing(1));

    R.cursorMode.addEventListener("change", () => {
      S.cursors.mode = R.cursorMode.value;
      R.cursorRefRow.style.display = S.cursors.mode === "value" ? "flex" : "none";
      if ((S.cursors.mode === "time" || S.cursors.mode === "track") && S.cursors.t1 === S.cursors.t2) {
        S.cursors.t1 = S.hOffset - S.timePerDiv;
        S.cursors.t2 = S.hOffset + S.timePerDiv;
      }
      if (S.cursors.mode === "value" && S.cursors.v1 === S.cursors.v2) {
        const ref = S.channels.find(ch => ch.id === S.cursors.refId) || S.channels[0];
        if (ref) { S.cursors.v1 = ref.fullStats.max * 0.8; S.cursors.v2 = ref.fullStats.min * 0.8; }
      }
      render();
    });
    R.cursorRef.addEventListener("change", () => { S.cursors.refId = R.cursorRef.value; render(); });

    R.chkGlow.addEventListener("change", () => {
      S.glowOn = R.chkGlow.checked;
      clearPersist();
      renderAll();
    });
    R.chkZoom.addEventListener("change", () => {
      S.zoomOn = R.chkZoom.checked;
      R.zoomWrap.style.display = S.zoomOn ? "block" : "none";
      if (S.zoomOn) {
        if (!S.zoomSpan || S.zoomSpan <= 0) {
          S.zoomT = S.hOffset;
          S.zoomSpan = S.timePerDiv * S.divsH / 10;
        }
      }
      requestAnimationFrame(() => { resizeCanvas("scope"); render(); });
    });
    R.chkSplitFFT.addEventListener("change", () => {
      S.splitOn = R.chkSplitFFT.checked;
      R.splitWrap.style.display = S.splitOn ? "block" : "none";
      requestAnimationFrame(() => { resizeCanvas("scope"); render(); if (S.splitOn) renderSplit(); });
    });
    R.chkPersist.addEventListener("change", () => {
      S.persistOn = R.chkPersist.checked;
      R.persistDecayRow.style.display = S.persistOn ? "flex" : "none";
      clearPersist();
      render();
    });
    R.persistDecay.addEventListener("input", () => {
      S.persistDecay = parseFloat(R.persistDecay.value);
    });

    buildLayoutPicker();
    R.btnLayoutSpread.addEventListener("click", spreadChannels);
    R.chkRecon.addEventListener("change", () => {
      S.recon.on = R.chkRecon.checked;
      if (!S.recon.on) stopReconPlay();
      // the Fourier row on each card only exists while the overlay is on
      rebuildChannelList(); syncReconUI(); render();
    });
    R.reconNharm.addEventListener("change", () => {
      S.recon.nHarm = clamp(Math.round(parseFloat(R.reconNharm.value) || 15), 1, 200);
      R.reconNharm.value = String(S.recon.nHarm);
      rebuildChannelList(); syncReconUI(); render();
    });
    R.reconK.addEventListener("input", () => {
      stopReconPlay();
      S.recon.k = parseInt(R.reconK.value, 10) || 0;
      R.reconKVal.textContent = String(S.recon.k);
      render();
    });
    R.chkReconParts.addEventListener("change", () => {
      S.recon.components = R.chkReconParts.checked;
      render();
    });
    R.btnReconPlay.addEventListener("click", () => { S.recon.playing ? stopReconPlay() : startReconPlay(); });
    R.btnReconAll.addEventListener("click", () => {
      stopReconPlay();
      S.recon.k = Math.max(1, reconMaxK());
      syncReconUI(); render();
    });

    R.btnMath.addEventListener("click", createMathChannel);

    R.btnCompute.addEventListener("click", runAnalysis);
    R.btnExportHarm.addEventListener("click", exportHarmonics);
    R.btnF0Auto.addEventListener("click", () => { if (fillAutoF0(true)) scheduleAnalysis(); });
    R.chkF0Auto.addEventListener("change", () => {
      if (R.chkF0Auto.checked && fillAutoF0(true)) scheduleAnalysis();
    });
    /* Typing a frequency is an override, so it turns the automatic mode off by
       itself: leaving it ticked would silently overwrite what was just typed
       the next time the source changed. */
    R.f0In.addEventListener("input", () => { R.chkF0Auto.checked = false; });
    R.fftSource.addEventListener("change", () => { buildCompareList(); fillAutoF0(false); });
    R.fftPhaseMode.addEventListener("change", () => drawPhaseBars());
    ["fftSource", "fftWindow", "fftRange", "f0In", "nHarmIn", "ilIn"].forEach(id => {
      R[id].addEventListener("change", scheduleAnalysis);
    });
    R.ilIn.addEventListener("keydown", e => { if (e.key === "Enter") R.ilIn.blur(); });
    R.btnIeee.addEventListener("click", () => {
      // IEEE 519 evaluates orders up to the 50th; TDD needs I_L, so ask for it
      // right away rather than silently reporting a dash.
      R.nHarmIn.value = "50";
      if (S.harm || S.fft) runAnalysis();
      if (!readRatedCurrent()) { R.ilIn.focus(); R.fftSummary.textContent = "Enter the rated demand current I_L to get TDD."; }
    });
    R.fftScale.addEventListener("change", () => drawSpectrumCanvas());
    R.fftMaxIn.addEventListener("change", () => {
      const v = parseScaleInput(R.fftMaxIn.value);
      if (v && v > 0 && S.fft) {
        S.fftMaxFreq = clamp(v, S.fft.freqStep * 10, S.fft.fs / 2);
        R.fftMaxIn.value = fmtScale(S.fftMaxFreq, "Hz");
        drawSpectrumCanvas();
      }
    });
    R.multMode.addEventListener("change", () => {
      R.multKRow.style.display = R.multMode.value === "mult" ? "flex" : "none";
      S.hoverHarm = -1;
      renderFFTView();
    });
    R.multKIn.addEventListener("change", () => { S.hoverHarm = -1; renderFFTView(); });
    R.harmUnit.addEventListener("change", renderFFTView);

    R.measureScopeSel.addEventListener("change", () => { S.measureScope = R.measureScopeSel.value; scheduleMeasure(); });

    ["xySrcX", "xySrcY", "xyRange"].forEach(id => R[id].addEventListener("change", () => {
      S.xy.xId = R.xySrcX.value; S.xy.yId = R.xySrcY.value;
      renderXY();
    }));
    R.btnXYFit.addEventListener("click", () => {
      [R.xySrcX.value, R.xySrcY.value].forEach(cid => {
        const ch = S.channels.find(c => c.id === cid);
        if (ch) { autoscaleChannel(ch); ch.position = 0; }
      });
      rebuildChannelList();
      renderXY();
    });

    // hover on harmonic bars
    [R.harmCanvas, R.phaseCanvas].forEach(cv => {
      cv.addEventListener("mousemove", (e) => {
        if (!S.harm || S.harm.error) return;
        const list = displayedHarms();
        if (!list.length) return;
        const key = cv === R.harmCanvas ? "harm" : "phase";
        const c = CV[key];
        const rect = cv.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const g = barGeometry(c, list);
        let idx = Math.floor((mx - g.padL) / g.step);
        if (mx < g.padL || idx < 0 || idx >= list.length) idx = -1;
        if (idx !== S.hoverHarm) { S.hoverHarm = idx; drawHarmBars(); drawPhaseBars(); }
      });
      cv.addEventListener("mouseleave", () => { if (S.hoverHarm !== -1) { S.hoverHarm = -1; drawHarmBars(); drawPhaseBars(); } });
    });

    window.addEventListener("keydown", (e) => {
      if (document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (S.files.length === 0 || S.tab !== "scope") return;
      if (e.key === "ArrowLeft" && !e.altKey) { S.hOffset -= S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); }
      else if (e.key === "ArrowRight") { S.hOffset += S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); }
      else if (e.key === "+" || e.key === "=") zoomHStep(-1);
      else if (e.key === "-" || e.key === "_") zoomHStep(1);
      else if (e.key.toLowerCase() === "f") { pushHist(); fitAll(); }
      else if (e.key === "Escape") setTool("pointer");
      else if (e.key === "Backspace" || (e.altKey && e.key === "ArrowLeft")) { e.preventDefault(); histGo(-1); }
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (e.key.toLowerCase() === "z") setTool("zoom");
      else if (e.key.toLowerCase() === "x") setTool("zoomx");
      else if (e.key.toLowerCase() === "y") setTool("zoomy");
      else if (e.key.toLowerCase() === "h") setTool("pan");
      else if (e.key.toLowerCase() === "c") R.tbCursors.click();
      else if (e.key.toLowerCase() === "l") R.tbLegend.click();
      else if (e.key.toLowerCase() === "a") R.tbFitY.click();
    });

    new ResizeObserver(() => {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      if (S.tab === "scope") { render(); scheduleSplit(); }
      else if (S.tab === "fft") renderFFTView();
      else renderXY();
    }).observe(R.scopeWrap.parentElement.parentElement);
  }

  // ---------- public API ----------
  let ready = false;
  // toolbar icons: inline strokes in currentColor, so .on repaints them
  const TB_ICON = {
    tbPointer: '<path d="M5 3l12 8-5 1 3 6-2 1-3-6-4 3z"/>',
    tbZoom: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M7 10h6M10 7v6"/>',
    tbZoomX: '<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    tbZoomY: '<path d="M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3"/>',
    tbPan: '<path d="M12 3v18M3 12h18M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M3 12l2-2M3 12l2 2M21 12l-2-2M21 12l-2 2"/>',
    tbFit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    tbFitY: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4M4 4h16M4 20h16"/>',
    tbBack: '<path d="M15 5l-7 7 7 7"/>',
    tbFwd: '<path d="M9 5l7 7-7 7"/>',
    tbCursors: '<path d="M8 3v18M16 3v18M5 7h6M13 17h6"/>',
    tbLegend: '<path d="M4 7h3M4 12h3M4 17h3M10 7h10M10 12h10M10 17h10"/>',
    tbYMode: '<rect x="3" y="4" width="18" height="16"/><path d="M3 8h18M3 12h18M3 16h18"/>',
    tbPng: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    tbCsv: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    tbInfo: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'
  };
  function init(opts) {
    if (ready) { applyOptions(opts); return; }
    Object.assign(S.opts, opts || {});
    REF_IDS.forEach(id => { R[id] = $(id); });
    const missing = REF_IDS.filter(id => !R[id]);
    if (missing.length) { console.error("ScopeApp: missing DOM ids:", missing); return; }
    dpr = Math.max(1, window.devicePixelRatio || 1);
    injectCSS();
    bindCanvas("scope", "scopeCanvas", "scopeWrap");
    bindCanvas("zoom", "zoomCanvas", "zoomWrap");
    bindCanvas("split", "splitCanvas", "splitWrap");
    bindCanvas("spec", "specCanvas", "specWrap");
    bindCanvas("harm", "harmCanvas", "harmWrap");
    bindCanvas("phase", "phaseCanvas", "phaseWrap");
    bindCanvas("xy", "xyCanvas", "xyWrap");
    R.f0In.value = String(S.opts.fundamental || 50);
    if (S.opts.ratedCurrent) R.ilIn.value = String(S.opts.ratedCurrent);
    S.glowOn = S.opts.traceGlow !== false;
    R.chkGlow.checked = S.glowOn;
    wire();
    wireTheme();
    let savedTheme = null;
    try { savedTheme = JSON.parse(localStorage.getItem(THEME_KEY)); } catch (e) { /* ignore */ }
    if (savedTheme && savedTheme.app && savedTheme.scopeBg) applyTheme(savedTheme, false);
    else applyTheme(Object.assign({}, S.opts.scopeDark === false ? THEME_LIGHT : THEME_DARK), false);
    readRatedCurrent();
    setDistortionReadout(null);
    rebuildFileList();
    rebuildChannelList();
    syncReconUI();
    for (const id in TB_ICON) R[id].innerHTML = '<svg viewBox="0 0 24 24">' + TB_ICON[id] + "</svg>";
    updateToolbar();
    syncAxisUI();
    setTab("scope");
    resizeCanvas("scope");
    render();
    ready = true;
    window.ScopeApp.ready = true;
  }
  function applyOptions(opts) {
    const prev = { f0: S.opts.fundamental, glow: S.opts.traceGlow, iL: S.opts.ratedCurrent };
    Object.assign(S.opts, opts || {});
    if (!ready) return;
    if (opts && opts.fundamental !== prev.f0 && document.activeElement !== R.f0In && !S.harm) {
      R.f0In.value = String(opts.fundamental);
    }
    if (opts && opts.traceGlow !== prev.glow) {
      S.glowOn = opts.traceGlow !== false;
      R.chkGlow.checked = S.glowOn;
    }
    if (opts && opts.ratedCurrent !== prev.iL && document.activeElement !== R.ilIn) {
      R.ilIn.value = String(opts.ratedCurrent || "");
      readRatedCurrent();
      setDistortionReadout(S.harm);
    }
    clearPersist();
    render(); renderFFTView(); renderXY(); scheduleSplit();
  }

  return { init, applyOptions, ready: false };
})();
