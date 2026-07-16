"use strict";
/* ============================================================
   Compilador LaTeX en el navegador (BusyTeX / pdfTeX WASM).
   El worker vive en vendor/busytex/busytex_worker.js; aquí solo
   se orquesta: init una vez → compile(files) → {pdf, log}.
   ============================================================ */

const BUSYTEX_DIR = "vendor/busytex/";
const ALL_PACKAGES = [
  "texlive-basic.js",
  "ubuntu-texlive-latex-recommended.js",
  "ubuntu-texlive-latex-extra.js",
  "ubuntu-texlive-science.js",
  "ubuntu-texlive-fonts-recommended.js"
];

export class LatexEngine {
  constructor({ onStatus } = {}) {
    this.onStatus = onStatus || (() => {});
    this.worker = null;
    this.ready = null;      // promesa de inicialización
    this.busy = false;
  }

  init() {
    if (this.ready) return this.ready;
    this.onStatus("Descargando motor LaTeX (solo la primera vez)…");
    this.worker = new Worker(BUSYTEX_DIR + "busytex_worker.js");
    this.ready = new Promise((resolve, reject) => {
      const onmsg = ({ data }) => {
        if (data.print) this.onStatus(data.print);
        if (data.initialized) { this.worker.removeEventListener("message", onmsg); resolve(data.initialized); }
        if (data.exception) { this.worker.removeEventListener("message", onmsg); reject(new Error(data.exception)); }
      };
      this.worker.addEventListener("message", onmsg);
      this.worker.postMessage({
        busytex_js: "busytex.js",
        busytex_wasm: "busytex.wasm",
        preload_data_packages_js: ALL_PACKAGES,
        data_packages_js: ALL_PACKAGES,
        texmf_local: [],
        preload: true,
        verbose: "silent",
        driver: "pdftex_bibtex8"
      });
    });
    return this.ready;
  }

  /* Archivos de idioma que no vienen en los paquetes TeXLive de BusyTeX:
     se inyectan en el directorio del proyecto cuando el documento los usa. */
  async extraFiles(files) {
    const EXTRA = [{ name: "spanish.ldf", url: BUSYTEX_DIR + "extra/spanish.ldf", trigger: /\\usepackage\s*\[[^\]]*spanish[^\]]*\]\s*\{babel\}/ }];
    const out = [];
    for (const ex of EXTRA) {
      if (files.some(f => f.path === ex.name || f.path.endsWith("/" + ex.name))) continue;
      const used = files.some(f => typeof f.contents === "string" && ex.trigger.test(f.contents));
      if (!used) continue;
      if (!this._extraCache) this._extraCache = {};
      if (!this._extraCache[ex.name]) this._extraCache[ex.name] = await (await fetch(ex.url)).text();
      out.push({ path: ex.name, contents: this._extraCache[ex.name] });
    }
    return out;
  }

  /* files: [{path, contents: string|Uint8Array}] */
  async compile(files, mainTexPath) {
    if (this.busy) throw new Error("Ya hay una compilación en curso");
    this.busy = true;
    try {
      await this.init();
      files = files.concat(await this.extraFiles(files));
      return await new Promise((resolve, reject) => {
        const onmsg = ({ data }) => {
          if (data.print) { this.onStatus(data.print); return; }
          if (data.exception) { this.worker.removeEventListener("message", onmsg); reject(new Error(data.exception)); return; }
          if (data.logs !== undefined || data.pdf !== undefined) {
            this.worker.removeEventListener("message", onmsg);
            resolve(data);
          }
        };
        this.worker.addEventListener("message", onmsg);
        this.worker.postMessage({
          files,
          main_tex_path: mainTexPath,
          bibtex: null,
          verbose: "silent",
          driver: "pdftex_bibtex8",
          data_packages_js: null
        });
      });
    } finally {
      this.busy = false;
    }
  }
}

/* Resumen legible del log de compilación */
export function summarizeLog(result) {
  const logs = result.logs || [];
  const full = logs.map(l => l.log || "").join("\n");
  const lines = full.split("\n");
  const errors = [], warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith("!")) {
      let ctx = ln;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (/^l\.\d+/.test(lines[j])) { ctx += "\n" + lines[j]; break; }
      }
      errors.push(ctx);
    } else if (/^(LaTeX|Package|Class).*Warning/.test(ln) || ln.startsWith("Overfull") || ln.startsWith("Underfull")) {
      warnings.push(ln);
    }
  }
  const pagesMatch = full.match(/Output written on .*?\((\d+) pages?, (\d+) bytes\)/);
  return { errors, warnings, pages: pagesMatch ? +pagesMatch[1] : 0, full };
}
