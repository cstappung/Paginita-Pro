"use strict";
/* ============================================================
   CSV Oscilloscope — engine
   Offline waveform viewer for CSV files (Rigol-style:
   "Time(s),CH1(V),CH2(A),..."). 100% in-browser.
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
  const PALETTE_LIGHT = ["#a97c00", "#0e7490", "#be185d", "#15803d", "#c2410c", "#6d28d9", "#b91c1c", "#0369a1"];
  let paletteIdx = 0;
  const nextColorIdx = () => paletteIdx++;
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
  function luminance(hex) {
    const m = String(hex).replace("#", "");
    if (m.length < 6) return 1;
    const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const screenIsDark = () => luminance((S.theme || THEME_DARK).scopeBg) < 0.5;
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
  const WORKER_SRC = `
self.onmessage = function(e) {
  const { id, buffer } = e.data;
  try {
    const text = new TextDecoder("utf-8").decode(buffer);
    const firstNl = text.indexOf("\\n");
    if (firstNl === -1) { self.postMessage({ type: "error", id, message: "Empty file." }); return; }
    let headerLine = text.slice(0, firstNl);
    if (headerLine.endsWith("\\r")) headerLine = headerLine.slice(0, -1);
    const headers = headerLine.split(",");
    const cols = headers.map(h => {
      const m = h.trim().match(/^(.*?)\\(([^)]*)\\)\\s*$/);
      if (m) return { name: m[1].trim(), unit: m[2].trim() };
      return { name: h.trim(), unit: "" };
    });
    const body = text.slice(firstNl + 1);
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
        let start = 0, colIdx = 0;
        const L = line.length;
        for (let k = 0; k <= L; k++) {
          if (k === L || line.charCodeAt(k) === 44) {
            const field = line.slice(start, k);
            if (colIdx === 0) timeArr[rowCount] = +field;
            else if (colIdx - 1 < valArrays.length) valArrays[colIdx - 1][rowCount] = +field;
            colIdx++; start = k + 1;
          }
        }
        rowCount++;
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
  const THEME_LIGHT = { app: "#e7ecf1", surface: "#ffffff", surface2: "#f4f7fa", border: "#ccd6df", text: "#16202b", muted: "#61728a", accent: "#0f62fe", scopeBg: "#ffffff", gridMinor: "#e3e9ee", gridMajor: "#b9c6d2", cursor: "#3a4a5c" };
  const THEME_DARK = { app: "#0b0f14", surface: "#141b23", surface2: "#10161d", border: "#26333f", text: "#dfe8f2", muted: "#7d8fa3", accent: "#2ea8ff", scopeBg: "#05090c", gridMinor: "#1e323f", gridMajor: "#3a5a6d", cursor: "#d7e6f5" };
  const CSS_VARS = { app: "chassis", surface: "panel", surface2: "panel2", border: "line", text: "text", muted: "dim", accent: "accent", scopeBg: "screen", gridMinor: "grid1", gridMajor: "grid2", cursor: "cursor" };
  const THEME_KEY = "csvscope_theme_v2";
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
      // on-screen legend bar, drawn over the graticule like a real DSO
      barBg: dark ? "rgba(8,14,19,0.82)" : "rgba(248,250,252,0.88)",
      barLine: hexA(t.gridMajor, 0.75),
      shade: hexA(t.accent, dark ? 0.12 : 0.08), shadeEdge: hexA(t.accent, dark ? 0.6 : 0.45) };
  }

  // ---------- state ----------
  const S = {
    opts: { scopeDark: true, traceWidth: 1.6, traceGlow: true, fundamental: 50, ratedCurrent: "" },
    files: [], channels: [],
    divsH: 10, divsV: 8,
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
    fftMaxFreq: null,
    iL: null,           // rated demand current for TDD (rms, null = not set)
    xy: { xId: "", yId: "" },
    hoverHarm: -1,
    theme: null
  };
  const th = () => themeCanvas(S.theme || THEME_DARK);
  const curTheme = () => Object.assign({}, S.theme || THEME_DARK);

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
    "btnThemeLight", "btnThemeDark", "btnThemeReset",
    "thApp", "thSurface", "thText", "thAccent", "thScopeBg", "thGridMinor", "thGridMajor", "thCursor",
    "scopeWrap", "scopeCanvas", "hoverReadout", "zoomWrap", "zoomCanvas",
    "splitWrap", "splitCanvas", "splitReadout",
    "measureBody", "measureScopeSel", "btnExportMeas",
    "fftSource", "fftWindow", "fftScale", "fftRange", "fftMaxIn",
    "f0In", "nHarmIn", "multMode", "multKIn", "multKRow", "harmUnit",
    "ilIn", "btnIeee", "btnCompute", "btnExportHarm", "fftSummary",
    "specWrap", "specCanvas", "harmWrap", "harmCanvas", "phaseWrap", "phaseCanvas",
    "harmTableBody", "thdBig", "tddBig", "tddSub", "harmMeta",
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
        voltsPerDiv: 1, position: 0, avgN: 1, hiresN: 1, tOffset: 0, fullStats: stats
      };
      autoscaleChannel(ch);
      S.channels.push(ch);
    });
    rebuildFileList();
    rebuildChannelList();
    rebuildSelects();
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
    ch.position = -mid / ch.voltsPerDiv;
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
    S.fft = null; S.harm = null;
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
        '</div>';
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
        if (p !== null && p > 0) ch.voltsPerDiv = p;
        else { vdiv.classList.add("invalid"); setTimeout(() => vdiv.classList.remove("invalid"), 700); }
        vdiv.value = fmtScale(ch.voltsPerDiv, ch.unit);
        render();
      });
      const pos = card.querySelector(".pos");
      pos.addEventListener("change", () => {
        const v = parseFloat(pos.value);
        if (isFinite(v)) ch.position = clamp(v, -8, 8);
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
    let best = S.timeDivOptions[0], bd = Infinity;
    for (const s of S.timeDivOptions) { const d = Math.abs(s - S.timePerDiv); if (d < bd) { bd = d; best = s; } }
    R.timeDiv.value = String(best);
    if (document.activeElement !== R.hOffsetIn) R.hOffsetIn.value = (S.hOffset * 1000).toPrecision(6);
  }
  function zoomHStep(dir) {
    const steps = S.timeDivOptions;
    if (!steps.length) return;
    let idx = 0, bd = Infinity;
    for (let i = 0; i < steps.length; i++) { const d = Math.abs(steps[i] - S.timePerDiv); if (d < bd) { bd = d; idx = i; } }
    idx = clamp(idx + dir, 0, steps.length - 1);
    S.timePerDiv = steps[idx];
    syncTimeDivUI(); render(); scheduleMeasure();
  }
  function fitAll() {
    if (S.files.length === 0) return;
    const t0 = Math.min(...S.files.map(f => f.t0));
    const t1 = Math.max(...S.files.map(f => f.t1));
    updateTimeDivOptions();
    const span = Math.max(t1 - t0, 1e-9);
    S.timePerDiv = nearestStep(S.timeDivOptions, span / S.divsH) || span / S.divsH;
    while (S.timePerDiv * S.divsH < span) {
      const idx = S.timeDivOptions.indexOf(S.timePerDiv);
      if (idx >= 0 && idx < S.timeDivOptions.length - 1) S.timePerDiv = S.timeDivOptions[idx + 1];
      else { S.timePerDiv *= 2; break; }
    }
    S.hOffset = (t0 + t1) / 2;
    S.zoomT = S.hOffset;
    S.zoomSpan = S.timePerDiv * S.divsH / 10;
    syncTimeDivUI(); render(); scheduleMeasure();
  }

  // ---------- coordinates ----------
  function timeToX(t) {
    const span = S.timePerDiv * S.divsH;
    return ((t - (S.hOffset - span / 2)) / span) * CV.scope.w;
  }
  function xToTime(x) {
    const span = S.timePerDiv * S.divsH;
    return (S.hOffset - span / 2) + (x / CV.scope.w) * span;
  }
  const pxPerDivV = () => CV.scope.h / S.divsV;
  function valueToY(ch, v) {
    const midY = CV.scope.h / 2 - ch.position * pxPerDivV();
    return midY - ((ch.invert ? -v : v) / ch.voltsPerDiv) * pxPerDivV();
  }
  function yToValue(ch, y) {
    const midY = CV.scope.h / 2 - ch.position * pxPerDivV();
    const signed = -(y - midY) / pxPerDivV() * ch.voltsPerDiv;
    return ch.invert ? -signed : signed;
  }

  // ---------- drawing primitives ----------
  /* A bench-scope graticule, not a chart grid: dotted division lines, solid
     centre axes, and 5 fine ticks per division along both of them. */
  function drawGrid(c, divsH, divsV) {
    const t = th();
    const { ctx, w, h } = c;
    ctx.fillStyle = t.scopeBg;
    ctx.fillRect(0, 0, w, h);
    if (t.dark) {
      // faint lift towards the centre, the way a real display looks lit
      const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, "rgba(120,190,255,0.045)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
    const stepX = w / divsH, stepY = h / divsV;
    const cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.gridMinor;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    for (let i = 1; i < divsH; i++) { const x = Math.round(i * stepX) + 0.5; if (x === cx) continue; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let j = 1; j < divsV; j++) { const y = Math.round(j * stepY) + 0.5; if (y === cy) continue; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = t.gridMajor;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    // subdivision ticks on the centre axes and along the outer frame
    for (let i = 0; i < divsH; i++) for (let k = 1; k < 5; k++) {
      const x = Math.round(i * stepX + k * stepX / 5) + 0.5;
      ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3);
      ctx.moveTo(x, 0); ctx.lineTo(x, 3);
      ctx.moveTo(x, h); ctx.lineTo(x, h - 3);
    }
    for (let j = 0; j < divsV; j++) for (let k = 1; k < 5; k++) {
      const y = Math.round(j * stepY + k * stepY / 5) + 0.5;
      ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y);
      ctx.moveTo(0, y); ctx.lineTo(3, y);
      ctx.moveTo(w, y); ctx.lineTo(w - 3, y);
    }
    ctx.stroke();
    ctx.strokeStyle = t.border;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  // draws a channel trace into arbitrary ctx given a time window and value mapping
  function traceInto(ctx2, ch, tA, tB, w, valToY) {
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length === 0) return;
    const N = time.length;
    const tStart = time[0], tEnd = time[N - 1];
    const dt = N > 1 ? (tEnd - tStart) / (N - 1) : 1;
    if (tB < tStart || tA > tEnd) return;
    let iStart = clamp(Math.floor((Math.max(tA, tStart) - tStart) / dt), 0, N - 1);
    let iEnd = clamp(Math.ceil((Math.min(tB, tEnd) - tStart) / dt), 0, N - 1);
    const count = iEnd - iStart + 1;
    if (count <= 1) return;
    const tToX = (tt) => ((tt - tA) / (tB - tA)) * w;
    ctx2.save();
    ctx2.strokeStyle = ch.color;
    ctx2.lineWidth = S.opts.traceWidth;
    ctx2.lineJoin = "round";
    ctx2.lineCap = "round";
    // Phosphor bloom. One shadowed stroke over the whole path, so the cost is
    // the same whether the trace is 100 or 100 000 points.
    if (S.glowOn && th().dark) { ctx2.shadowColor = ch.color; ctx2.shadowBlur = 6; }
    ctx2.beginPath();
    const W = Math.max(1, Math.round(w));
    if (count <= W * 2) {
      for (let i = iStart; i <= iEnd; i++) {
        const x = tToX(time[i]), y = valToY(ch, data[i]);
        if (i === iStart) ctx2.moveTo(x, y); else ctx2.lineTo(x, y);
      }
    } else {
      const xS = clamp(Math.floor(tToX(time[iStart])), 0, W);
      const xE = clamp(Math.ceil(tToX(time[iEnd])), 0, W);
      const pxCount = Math.max(1, xE - xS);
      const perPixel = count / pxCount;
      let started = false;
      for (let pxi = 0; pxi < pxCount; pxi++) {
        const a = iStart + Math.floor(pxi * perPixel);
        let b = iStart + Math.floor((pxi + 1) * perPixel);
        if (b <= a) b = a + 1;
        if (b > iEnd + 1) b = iEnd + 1;
        let mn = Infinity, mx = -Infinity;
        for (let i = a; i < b; i++) { const v = data[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
        if (mn === Infinity) continue;
        const x = xS + pxi + 0.5;
        if (!started) { ctx2.moveTo(x, valToY(ch, mn)); started = true; }
        ctx2.lineTo(x, valToY(ch, mn));
        ctx2.lineTo(x, valToY(ch, mx));
      }
    }
    ctx2.stroke();
    ctx2.restore();
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
    if (!resizeCanvas("scope")) { renderZoom(); updateStatus(); return; }
    const { ctx, w, h } = c;
    const t = th();
    drawGrid(c, S.divsH, S.divsV);
    const tA = xToTime(0), tB = xToTime(w);
    const visCh = S.channels.filter(ch => ch.visible);

    if (S.persistOn) {
      ensurePersist();
      // fade old content
      persistCtx.save();
      persistCtx.globalCompositeOperation = "destination-out";
      persistCtx.fillStyle = "rgba(0,0,0," + S.persistDecay + ")";
      persistCtx.fillRect(0, 0, c.w, c.h);
      persistCtx.restore();
      visCh.forEach(ch => traceInto(persistCtx, ch, tA, tB, w, valueToY));
      ctx.drawImage(persistCanvas, 0, 0, c.w, c.h);
    } else {
      visCh.forEach(ch => traceInto(ctx, ch, tA, tB, w, valueToY));
    }

    // ground markers on the left rail, numbered like a bench scope
    ctx.font = "700 9px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    visCh.forEach(ch => {
      const y = valueToY(ch, 0);
      if (y < -8 || y > h + 8) return;
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.moveTo(1, y); ctx.lineTo(15, y - 6); ctx.lineTo(15, y + 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = luminance(ch.color) > 0.5 ? "#0b1118" : "#ffffff";
      ctx.fillText(String(S.channels.indexOf(ch) + 1), 10, y);
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // zoom region shade
    if (S.zoomOn && S.files.length) {
      const x1 = timeToX(S.zoomT - S.zoomSpan / 2), x2 = timeToX(S.zoomT + S.zoomSpan / 2);
      ctx.fillStyle = t.shade;
      ctx.fillRect(x1, 0, x2 - x1, h);
      ctx.strokeStyle = t.shadeEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x1) + 0.5, 0.5, Math.round(x2 - x1) - 1, h - 1);
    }

    drawTrigger(ctx, w, h);
    drawCursors(ctx, w, h);

    // time axis labels, kept clear of the legend bar
    ctx.fillStyle = t.muted;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (let d = 1; d < S.divsH; d += 2) {
      const tt = tA + (d / S.divsH) * (tB - tA);
      ctx.fillText(fmt(tt, "s", 2), (d / S.divsH) * w, h - LEGEND_H - 6);
    }
    ctx.textAlign = "left";

    drawLegendBar(ctx, w, h, t, visCh);

    if (S.files.length === 0) {
      ctx.fillStyle = t.muted;
      ctx.font = "13px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Drop CSV files here, or click Load CSV", w / 2, h / 2 - 10);
      ctx.font = "11px 'IBM Plex Sans', sans-serif";
      ctx.fillText("Expected format: Time(s), CH1(V), CH2(A), …", w / 2, h / 2 + 12);
      ctx.textAlign = "left";
    }

    updateCursorReadout();
    renderZoom();
    updateStatus();
  }

  /* Legend strip across the bottom of the graticule: the channel scales on the
     left and the horizontal + trigger settings on the right, exactly where a
     bench scope puts them. */
  const LEGEND_H = 22;
  function drawLegendBar(ctx, w, h, t, visCh) {
    const y0 = h - LEGEND_H;
    ctx.fillStyle = t.barBg;
    ctx.fillRect(0, y0, w, LEGEND_H);
    ctx.strokeStyle = t.barLine;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0 + 0.5); ctx.lineTo(w, y0 + 0.5); ctx.stroke();

    const mid = y0 + LEGEND_H / 2;
    ctx.textBaseline = "middle";

    // right side first, so the channel list knows where it must stop
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    let right = w - 8;
    const trigCh = S.channels.find(c => c.id === S.trigger.sourceId);
    if (trigCh) {
      const txt = "T " + (S.trigger.slope === "rising" ? "↗" : "↘") + " " + fmt(S.trigger.level, trigCh.unit, 2);
      ctx.fillStyle = trigCh.color;
      ctx.fillText(txt, right, mid);
      right -= ctx.measureText(txt).width + 14;
    }
    const hTxt = fmt(S.timePerDiv, "s", 0) + "/div  ⌖ " + fmt(S.hOffset, "s", 2);
    ctx.fillStyle = t.text;
    ctx.fillText(hTxt, right, mid);
    right -= ctx.measureText(hTxt).width + 14;

    // channel scales, left to right, truncated rather than overlapped
    ctx.textAlign = "left";
    let x = 8;
    for (const ch of visCh) {
      const txt = ch.label + "  " + fmtScale(ch.voltsPerDiv, ch.unit) + "/div";
      const tw = ctx.measureText(txt).width + 11;
      if (x + tw > right) { ctx.fillStyle = t.muted; ctx.fillText("…", x, mid); break; }
      ctx.fillStyle = ch.color;
      ctx.fillRect(x, mid - 5, 3, 10);
      ctx.fillStyle = t.text;
      ctx.fillText(txt, x + 8, mid);
      x += tw + 12;
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawTrigger(ctx, w, h) {
    const ch = S.channels.find(c => c.id === S.trigger.sourceId);
    if (!ch) return;
    const y = valueToY(ch, S.trigger.level);
    if (y < -10 || y > h + 10) return;
    ctx.strokeStyle = ch.color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.moveTo(w - 1, y); ctx.lineTo(w - 11, y - 5); ctx.lineTo(w - 11, y + 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = th().cursor;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("T" + (S.trigger.slope === "rising" ? "↑" : "↓") + " " + fmt(S.trigger.level, ch.unit, 2), w - 15, y - 6);
    ctx.textAlign = "left";
  }

  function drawCursors(ctx, w, h) {
    const t = th(), cu = S.cursors;
    const mode = cu.mode;
    if (mode === "time" || mode === "track") {
      ctx.strokeStyle = t.cursor;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      [cu.t1, cu.t2].forEach((tt, i) => {
        const x = timeToX(tt);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = t.cursor;
        ctx.font = "10px 'IBM Plex Mono', monospace";
        ctx.fillText(i === 0 ? "①" : "②", x + 4, 26);
        ctx.setLineDash([3, 3]);
      });
      ctx.setLineDash([]);
      if (mode === "track") {
        S.channels.filter(c => c.visible).forEach(ch => {
          [cu.t1, cu.t2].forEach(tt => {
            const v = sampleAt(ch, tt);
            if (v === null) return;
            const x = timeToX(tt), y = valueToY(ch, ch.invert ? -v : v);
            ctx.fillStyle = ch.color;
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = t.scopeBg;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          });
        });
      }
    } else if (mode === "value") {
      const ref = S.channels.find(ch => ch.id === cu.refId) || S.channels[0];
      if (ref) {
        ctx.strokeStyle = t.cursor;
        ctx.setLineDash([3, 3]);
        [cu.v1, cu.v2].forEach(v => {
          const y = valueToY(ref, v);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    }
  }

  function sampleAt(ch, tt) {
    const time = getTime(ch), data = getData(ch);
    if (!time || !data || time.length === 0) return null;
    const N = time.length;
    const dt = N > 1 ? (time[N - 1] - time[0]) / (N - 1) : 1;
    const idx = Math.round((tt - time[0]) / dt);
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
    // vertical mapping: same volts/div as main but 4 divisions → keep same value range around channel position
    const zoomValToY = (ch, v) => {
      const midY = c.h / 2 - ch.position * (c.h / S.divsV);
      return midY - ((ch.invert ? -v : v) / ch.voltsPerDiv) * (c.h / S.divsV);
    };
    visCh.forEach(ch => traceInto(c.ctx, ch, tA, tB, c.w, zoomValToY));
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
    if (crossings.length < 2) return { period: null, freq: null };
    const periods = [];
    for (let i = 1; i < crossings.length; i++) periods.push(crossings[i] - crossings[i - 1]);
    periods.sort((a, b) => a - b);
    const period = periods[Math.floor(periods.length / 2)];
    return { period, freq: 1 / period };
  }

  function visibleRange(ch) {
    const time = getTime(ch);
    if (!time || time.length === 0) return null;
    const N = time.length;
    const t0v = xToTime(0), t1v = xToTime(CV.scope.w);
    const tStart = time[0], tEnd = time[N - 1];
    const dt = N > 1 ? (tEnd - tStart) / (N - 1) : 1;
    let iStart = clamp(Math.floor((Math.max(t0v, tStart) - tStart) / dt), 0, N - 1);
    let iEnd = clamp(Math.ceil((Math.min(t1v, tEnd) - tStart) / dt), 0, N - 1);
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
      const t0v = xToTime(0), t1v = xToTime(CV.scope.w);
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
      data: out, time: ta.length === out.length ? ta : tb, fullStats: stats
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
  function harmDisplayMag(h) {
    const u = R.harmUnit.value;
    if (!S.harm) return h.mag;
    if (u === "rms") return h.mag / Math.SQRT2;
    if (u === "pct") { const f = S.harm.harms[0].mag; return f > 0 ? (h.mag / f) * 100 : 0; }
    return h.mag;
  }
  function harmUnitLabel() {
    const u = R.harmUnit.value;
    const base = S.harm ? (S.harm.channel.unit || "") : "";
    return u === "pct" ? "%f₁" : u === "rms" ? base + " rms" : base + " pk";
  }

  // ---------- FFT view rendering ----------
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
      if (S.fft && !S.fftMaxFreq) S.fftMaxFreq = clamp(f0 * (nHarm + 2), S.fft.freqStep * 10, S.fft.fs / 2);
      if (S.fft) {
        const wanted = parseScaleInput(R.fftMaxIn.value);
        S.fftMaxFreq = wanted && wanted > 0 ? clamp(wanted, S.fft.freqStep * 10, S.fft.fs / 2) : clamp(f0 * (nHarm + 2), S.fft.freqStep * 10, S.fft.fs / 2);
        if (document.activeElement !== R.fftMaxIn) R.fftMaxIn.value = fmtScale(S.fftMaxFreq, "Hz");
      }
      renderFFTView();
      // leaving "Computing…" on screen made a finished run look stuck
      R.fftSummary.textContent = S.fft
        ? "Done · " + (R.fftRange.value === "full" ? "full record" : "visible window") + " · "
          + S.fft.usable.toLocaleString() + " samples · Δf " + fmt(S.fft.freqStep, "Hz", 2)
          + " · Nyquist " + fmt(S.fft.fs / 2, "Hz", 1)
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
    const mags = result.mags;
    let maxMag = 0;
    for (let i = 1; i < mags.length; i++) if (mags[i] > maxMag) maxMag = mags[i];
    if (maxMag <= 0) maxMag = 1e-12;
    const idxMax = clamp(Math.round(maxFreq / result.freqStep), 1, mags.length - 1);
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
    ctx.save();
    ctx.strokeStyle = result.channel.color;
    ctx.lineWidth = 1.2;
    if (S.glowOn && t.dark) { ctx.shadowColor = result.channel.color; ctx.shadowBlur = 4; }
    ctx.beginPath();
    const W = Math.max(1, Math.round(w));
    if (idxMax <= W * 2) {
      for (let i = 1; i <= idxMax; i++) {
        const x = fToX(i * result.freqStep), y = mToY(mags[i]);
        if (i === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    } else {
      const per = idxMax / W;
      for (let px = 0; px < W; px++) {
        const a = 1 + Math.floor(px * per);
        let b = 1 + Math.floor((px + 1) * per);
        if (b <= a) b = a + 1;
        if (b > idxMax + 1) b = idxMax + 1;
        let mx = 0;
        for (let i = a; i < b && i < mags.length; i++) if (mags[i] > mx) mx = mags[i];
        const x = px + 0.5;
        if (px === 0) ctx.moveTo(x, mToY(mx)); else ctx.lineTo(x, mToY(mx));
      }
    }
    ctx.stroke();
    ctx.restore();
    // axis labels
    ctx.fillStyle = t.muted;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (let d = 1; d < 10; d += 1) {
      if (d % 2) continue;
      ctx.fillText(fmt((d / 10) * maxFreq, "Hz", 1), (d / 10) * w, h - 5);
    }
    ctx.textAlign = "right";
    ctx.fillText(useDb ? "0 dB" : fmt(yMax, result.channel.unit, 1), w - 5, 12);
    ctx.fillText(useDb ? "-100 dB" : "0", w - 5, h - 5);
    ctx.textAlign = "left";
    ctx.fillStyle = t.text;
    ctx.fillText("SPECTRUM — " + result.channel.label + "  ·  window: " + result.windowType + "  ·  Δf " + fmt(result.freqStep, "Hz", 2) + "  ·  Nyquist " + fmt(result.fs / 2, "Hz", 1), 8, 12);
  }

  function barGeometry(c, list) {
    const padL = 48, padR = 10, padT = 18, padB = 20;  // room for 5-char axis labels
    const iw = c.w - padL - padR;
    const bw = Math.max(2, Math.min(34, iw / Math.max(1, list.length) * 0.62));
    const step = iw / Math.max(1, list.length);
    return { padL, padR, padT, padB, iw, ih: c.h - padT - padB, bw, step };
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
    let maxV = 0;
    list.forEach(hh => { const v = harmDisplayMag(hh); if (v > maxV) maxV = v; });
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
    const accent = t.accent;
    list.forEach((hh, i) => {
      const v = harmDisplayMag(hh);
      const bh = (v / maxV) * g.ih;
      const x = g.padL + i * g.step + (g.step - g.bw) / 2;
      const y = g.padT + g.ih - bh;
      ctx.fillStyle = i === S.hoverHarm ? "#e0821f" : (hh.n === 1 ? accent : accent + "99");
      ctx.fillRect(x, y, g.bw, Math.max(1, bh));
      if (g.step > 14) {
        ctx.fillStyle = t.muted;
        ctx.fillText(String(hh.n), x + g.bw / 2, h - 7);
      }
    });
    ctx.textAlign = "left";
    // hover tooltip
    if (S.hoverHarm >= 0 && list[S.hoverHarm]) {
      const hh = list[S.hoverHarm];
      const txt = "n=" + hh.n + "  " + fmt(hh.f, "Hz", 1) + "  " + fmt(harmDisplayMag(hh), R.harmUnit.value === "pct" ? "%" : "", 3) + "  φ " + hh.phase.toFixed(1) + "°";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      const tw2 = ctx.measureText(txt).width;
      ctx.fillStyle = t.scopeBg === "#ffffff" ? "rgba(26,35,46,0.92)" : "rgba(240,244,250,0.94)";
      ctx.fillRect(w - tw2 - 20, 18, tw2 + 12, 16);
      ctx.fillStyle = t.scopeBg === "#ffffff" ? "#fff" : "#111";
      ctx.fillText(txt, w - tw2 - 14, 29);
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
    ctx.fillText("HARMONIC PHASE (° · cos ref @ window start)", 8, 12);
    if (!S.harm || S.harm.error) return;
    const list = displayedHarms();
    if (!list.length) return;
    const g = barGeometry(c, list);
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
    const fundMag = S.harm.harms[0].mag;
    ctx.textAlign = "center";
    list.forEach((hh, i) => {
      const x = g.padL + i * g.step + (g.step - g.bw) / 2;
      const significant = fundMag > 0 && hh.mag >= fundMag * 0.001;
      const bh = (hh.phase / 180) * (g.ih / 2);
      ctx.fillStyle = i === S.hoverHarm ? "#e0821f" : (significant ? "#1d9e4f" + (hh.n === 1 ? "" : "aa") : t.gridMajor);
      if (significant) {
        if (bh >= 0) ctx.fillRect(x, zeroY - bh, g.bw, Math.max(1, bh));
        else ctx.fillRect(x, zeroY, g.bw, Math.max(1, -bh));
      } else {
        ctx.fillRect(x, zeroY - 1, g.bw, 2);
      }
      if (g.step > 14) {
        ctx.fillStyle = t.muted;
        ctx.fillText(String(hh.n), x + g.bw / 2, h - 7);
      }
    });
    ctx.textAlign = "left";
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

  function exportHarmonics() {
    if (!S.harm || S.harm.error) return;
    const H = S.harm;
    let csv = "# channel," + H.channel.label + "\n# fundamental_Hz," + H.f0 + "\n# periods_used," + H.periods
      + "\n# harmonics_analyzed," + H.harms.length + "\n# DC," + H.dc
      + "\n# fundamental_rms," + H.fundRms + "\n# harmonic_rms_n_ge_2," + H.harmRms
      + "\n# THD_pct," + (H.thd !== null ? (H.thd * 100).toFixed(4) : "")
      + "\n# I_L_rms," + (H.iL !== null ? H.iL : "")
      + "\n# TDD_pct," + (H.tdd !== null ? (H.tdd * 100).toFixed(4) : "") + "\n";
    csv += "n,freq_Hz,mag_peak,mag_rms,pct_of_fundamental,pct_of_IL,phase_deg\n";
    const fund = H.harms[0].mag;
    displayedHarms().forEach(hh => {
      csv += [hh.n, hh.f, hh.mag, hh.mag / Math.SQRT2,
        fund > 0 ? (hh.mag / fund * 100) : 0,
        H.iL ? (hh.mag / Math.SQRT2 / H.iL * 100) : "",
        hh.phase].join(",") + "\n";
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
  function hitTest(mx, my) {
    const cu = S.cursors;
    if (cu.mode === "time" || cu.mode === "track") {
      for (const key of ["t1", "t2"]) {
        if (Math.abs(mx - timeToX(cu[key])) <= 6) return { type: "cursorT", key };
      }
    }
    if (cu.mode === "value") {
      const ref = S.channels.find(ch => ch.id === cu.refId) || S.channels[0];
      if (ref) for (const key of ["v1", "v2"]) {
        if (Math.abs(my - valueToY(ref, cu[key])) <= 6) return { type: "cursorV", key, ref };
      }
    }
    for (const ch of S.channels.filter(c => c.visible)) {
      const y = valueToY(ch, 0);
      if (mx >= 0 && mx <= 14 && Math.abs(my - y) <= 8) return { type: "chpos", ch };
    }
    const trig = S.channels.find(c => c.id === S.trigger.sourceId);
    if (trig) {
      const y = valueToY(trig, S.trigger.level);
      if (mx >= CV.scope.w - 14 && Math.abs(my - y) <= 8) return { type: "trigger", ch: trig };
    }
    if (S.zoomOn) {
      const x1 = timeToX(S.zoomT - S.zoomSpan / 2), x2 = timeToX(S.zoomT + S.zoomSpan / 2);
      if (mx >= x1 && mx <= x2) return { type: "zoomRegion" };
    }
    return null;
  }

  function bindScopeInteractions() {
    const canvas = R.scopeCanvas;
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (S.files.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const tAtMouse = xToTime(mx);
      const steps = S.timeDivOptions;
      if (steps.length) {
        let idx = 0, bd = Infinity;
        for (let i = 0; i < steps.length; i++) { const d = Math.abs(steps[i] - S.timePerDiv); if (d < bd) { bd = d; idx = i; } }
        idx = clamp(idx + (e.deltaY > 0 ? 1 : -1), 0, steps.length - 1);
        S.timePerDiv = steps[idx];
      }
      const newT0 = tAtMouse - (mx / CV.scope.w) * (S.timePerDiv * S.divsH);
      S.hOffset = newT0 + (S.timePerDiv * S.divsH) / 2;
      if (S.persistOn) clearPersist();
      syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit();
    }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit) S.dragging = { ...hit, startX: mx, startT: xToTime(mx), zoomT0: S.zoomT };
      else if (S.files.length > 0) S.dragging = { type: "pan", startX: mx, startTime: xToTime(mx) };
    });

    window.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const inside = mx >= 0 && mx <= CV.scope.w && my >= 0 && my <= CV.scope.h;

      if (S.dragging) {
        const d = S.dragging;
        if (d.type === "pan") {
          S.hOffset -= (xToTime(mx) - d.startTime);
          if (S.persistOn) clearPersist();
        } else if (d.type === "chpos") {
          d.ch.position = (CV.scope.h / 2 - my) / pxPerDivV();
          syncChannelCard(d.ch);
        } else if (d.type === "trigger") {
          S.trigger.level = yToValue(d.ch, my);
          if (document.activeElement !== R.trigLevelIn) R.trigLevelIn.value = fmtScale(S.trigger.level, "");
        } else if (d.type === "cursorT") {
          S.cursors[d.key] = xToTime(mx);
        } else if (d.type === "cursorV") {
          S.cursors[d.key] = yToValue(d.ref, my);
        } else if (d.type === "zoomRegion") {
          S.zoomT = d.zoomT0 + (xToTime(mx) - d.startT);
        }
        render();
        if (d.type === "pan" || d.type === "cursorT") scheduleMeasure();
        if (d.type === "pan") scheduleSplit();
        return;
      }

      if (inside && S.files.length > 0 && S.tab === "scope") {
        const hit = hitTest(mx, my);
        canvas.style.cursor = hit ? (hit.type === "cursorT" ? "ew-resize" : hit.type === "cursorV" ? "ns-resize" : hit.type === "zoomRegion" ? "grab" : "pointer") : "crosshair";
        const t = xToTime(mx);
        let lines = ["t = " + fmt(t, "s")];
        S.channels.filter(c => c.visible).forEach(ch => {
          const v = sampleAt(ch, t);
          if (v !== null) lines.push(ch.label + " = " + fmt(ch.invert ? -v : v, ch.unit, 2));
        });
        R.hoverReadout.textContent = lines.join("\n");
        R.hoverReadout.style.display = "block";
      } else {
        R.hoverReadout.style.display = "none";
      }
    });
    window.addEventListener("mouseup", () => { S.dragging = null; });

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
    R.statusLeft.textContent = S.files.length
      ? S.files.length + " file" + (S.files.length > 1 ? "s" : "") + " · " + nCh + " visible channel" + (nCh !== 1 ? "s" : "") + " · " + fmt(S.timePerDiv, "s", 0) + "/div"
      : "No data loaded.";
    if (S.files.length) {
      const f = S.files[0];
      R.statusRight.textContent = "fs ≈ " + fmt(1 / f.dt, "Hz", 1) + " · " + f.rowCount.toLocaleString() + " pts · scroll = zoom · drag = pan · F = fit";
    } else {
      R.statusRight.textContent = "";
    }
  }

  // ---------- wiring ----------
  function wire() {
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
      S.channels.forEach(autoscaleChannel);
      fitAll();
      rebuildChannelList();
    });
    R.btnFit.addEventListener("click", fitAll);
    R.btnReset.addEventListener("click", () => {
      S.channels.forEach(ch => { ch.invert = false; ch.avgN = 1; ch.avgCache = null; ch.hiresN = 1; ch.hiresCache = null; ch.tOffset = 0; ch.tOffCache = null; autoscaleChannel(ch); });
      S.cursors.mode = "off"; R.cursorMode.value = "off";
      R.cursorRefRow.style.display = "none";
      S.trigger = { sourceId: "", level: 0, slope: "rising" };
      R.trigSource.value = "";
      S.persistOn = false; R.chkPersist.checked = false; R.persistDecayRow.style.display = "none";
      clearPersist();
      fitAll();
      rebuildChannelList();
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
      S.timePerDiv = nearestStep(S.timeDivOptions, parseFloat(R.timeDiv.value));
      if (S.persistOn) clearPersist();
      syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit();
    });
    R.hOffsetIn.addEventListener("change", () => {
      const v = parseFloat(R.hOffsetIn.value);
      if (isFinite(v)) { S.hOffset = v / 1000; if (S.persistOn) clearPersist(); render(); scheduleMeasure(); scheduleSplit(); }
    });
    R.btnPanL.addEventListener("click", () => { S.hOffset -= S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit(); });
    R.btnPanR.addEventListener("click", () => { S.hOffset += S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); scheduleSplit(); });
    R.btnZinH.addEventListener("click", () => { if (S.persistOn) clearPersist(); zoomHStep(-1); scheduleSplit(); });
    R.btnZoutH.addEventListener("click", () => { if (S.persistOn) clearPersist(); zoomHStep(1); scheduleSplit(); });

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

    R.btnMath.addEventListener("click", createMathChannel);

    R.btnCompute.addEventListener("click", runAnalysis);
    R.btnExportHarm.addEventListener("click", exportHarmonics);
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
      if (e.key === "ArrowLeft") { S.hOffset -= S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); }
      else if (e.key === "ArrowRight") { S.hOffset += S.timePerDiv; if (S.persistOn) clearPersist(); syncTimeDivUI(); render(); scheduleMeasure(); }
      else if (e.key === "+" || e.key === "=") zoomHStep(-1);
      else if (e.key === "-" || e.key === "_") zoomHStep(1);
      else if (e.key.toLowerCase() === "f") fitAll();
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
