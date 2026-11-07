"use strict";
/* ============================================================
   Compilador LaTeX en el navegador (BusyTeX / pdfTeX WASM).
   El worker vive en vendor/busytex/busytex_worker.js; aquí solo
   se orquesta: init una vez → compile(files) → {pdf, log}.
   ============================================================ */

const BUSYTEX_DIR = "vendor/busytex/";
/* Súbelo al tocar busytex_worker.js o busytex_pipeline.js: el worker y el
   pipeline se cachean aparte del bundle, y sin esto un navegador que ya
   compiló seguiría usando el motor anterior. */
const ENGINE_VERSION = "6";
const ALL_PACKAGES = [
  "texlive-basic.js",
  "ubuntu-texlive-latex-recommended.js",
  "ubuntu-texlive-latex-extra.js",
  "ubuntu-texlive-science.js",
  "ubuntu-texlive-fonts-recommended.js",
  // Colección «pictures» completa (PGF/TikZ, epic/eepic, pict2e, pgfplots,
  // circuitikz, tkz-*, …): BusyTeX no la distribuye porque en Ubuntu vive en
  // texlive-pictures, que no está compilado a wasm. Sin ella fallan tcolorbox,
  // svg, transparent y overpic con «File `pgf.sty'/`epic.sty' not found».
  // Se genera con scripts/build-texmf-package.js
  "texlive-pictures.js",
  // Huecos sueltos de fonts-extra/publishers: fuentes matemáticas (bbold,
  // bbm, dsfont, newtx, fourier…), biblatex y clases de revista (IEEEtran,
  // elsarticle, revtex, acmart). Incluye métricas y Type1 para pdfTeX.
  "texlive-extra.js",
  // Estilos de bibliografía (.bst) de las clases de revista: BusyTeX trae 69
  // .bst pero no IEEEtran.bst —solo IEEEtranM/MN—, y el generador de paquetes
  // omitía el subárbol bibtex/. Sin esto BibTeX aborta con «I couldn't open
  // style file» y TODAS las citas quedan sin resolver.
  "texlive-bst.js",
  // Iconos de los CV (fontawesome, fontawesome5) y tikzfill, que tcolorbox
  // pide con la biblioteca «skins» (File `tikzfill.image.sty' not found).
  "texlive-iconos.js",
  // biblatex.bst (sin él biblatex no resolvía NINGUNA cita), binhex.tex
  // (newtxtext/newtxmath), simplekv (chemfig), apa7 y biblatex-apa.
  // 0,7 MB. Libertine se quedó fuera a propósito: serían 20 MB más en la
  // primera descarga de todo el mundo para una fuente poco usada.
  "texlive-revistas.js"
];

export class LatexEngine {
  constructor({ onStatus } = {}) {
    this.onStatus = onStatus || (() => {});
    this.worker = null;
    this.ready = null;      // promesa de inicialización
    this.busy = false;
  }

  /* Tira el worker y olvida la promesa de arranque.

     Sin esto, un motor que se ha caído se queda caído para toda la
     pestaña, y eso es justo lo que contaba el informe: el
     «memory access out of bounds» del wasm aparece 13 y 2 veces
     seguidas: no son 15 documentos distintos, es el MISMO worker
     envenenado respondiendo lo mismo a cada intento. Cuando el wasm
     aborta, su montón queda en un estado que él mismo ya no sabe
     describir, pero `this.worker` seguía ahí y `this.ready` seguía
     resuelta, así que cada «▶ Compilar» posterior volvía a entrar en la
     misma instancia rota. La única salida era recargar la página, cosa
     que nadie adivina.

     Volver a arrancar no vuelve a descargar los ~260 MB: los paquetes y
     el .wasm los sirve la caché HTTP del navegador, así que cuesta unos
     segundos. */
  _descartarMotor() {
    if (this.worker) { try { this.worker.terminate(); } catch (err) {} }
    this.worker = null;
    this.ready = null;
  }

  init() {
    /* Solo se reaprovecha un arranque VIVO. Una promesa rechazada
       también es una promesa, así que antes bastaba un corte de red en
       el primer arranque para dejar el motor muerto el resto de la
       sesión, repitiendo el error de aquella vez a cada compilación; es
       `_descartarMotor` quien vacía esto al fallar, y por eso aquí ya no
       puede quedar un rechazo guardado. */
    if (this.ready) return this.ready;
    this.onStatus("Descargando motor LaTeX (solo la primera vez)…");
    this.worker = new Worker(BUSYTEX_DIR + "busytex_worker.js?v=" + ENGINE_VERSION);
    this.ready = new Promise((resolve, reject) => {
      const onmsg = ({ data }) => {
        if (data.print) this.onStatus(data.print);
        if (data.initialized) { this.worker.removeEventListener("message", onmsg); resolve(data.initialized); }
        if (data.exception) { this._descartarMotor(); reject(new Error(data.exception)); }
      };
      this.worker.addEventListener("message", onmsg);
      this.worker.onerror = e => { this._descartarMotor(); reject(new Error(e.message || "el motor LaTeX no arrancó")); };
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

  /* Archivos que no vienen en los paquetes TeXLive de BusyTeX: se inyectan
     en el directorio del proyecto (siempre, o si el documento los usa).

     pdftex.map va siempre: pdfTeX solo incrusta una fuente Type1 si figura
     en ese mapa, y el del paquete base no incluye las fuentes que añadimos
     después (bbold, dsfont…) → «Font bbold10 at 600 not found». Como
     texmf.cnf pone $TEXMFDOTDIR primero en TEXFONTMAPS, el del directorio
     de trabajo tiene prioridad. Se genera con scripts/build-fontmap.js */
  async extraFiles(files) {
    const EXTRA = [
      { name: "pdftex.map", url: BUSYTEX_DIR + "extra/pdftex.map", always: true },
      { name: "spanish.ldf", url: BUSYTEX_DIR + "extra/spanish.ldf", trigger: /\\usepackage\s*\[[^\]]*spanish[^\]]*\]\s*\{babel\}/ }
    ];
    const out = [];
    for (const ex of EXTRA) {
      if (files.some(f => f.path === ex.name || f.path.endsWith("/" + ex.name))) continue;
      const used = ex.always || files.some(f => typeof f.contents === "string" && ex.trigger.test(f.contents));
      if (!used) continue;
      if (!this._extraCache) this._extraCache = {};
      if (!this._extraCache[ex.name]) this._extraCache[ex.name] = ex.contents != null ? ex.contents : await (await fetch(ex.url)).text();
      out.push({ path: ex.name, contents: this._extraCache[ex.name] });
    }
    return out;
  }

  /* files: [{path, contents: string|Uint8Array}]
     clean: olvidar los auxiliares guardados (.aux, .toc, .bbl…) y compilar
     desde cero, como el «Recompilar desde cero» de Overleaf. Sin él, el
     worker repone los de la vez anterior y suele bastar UNA pasada
     (ver compile_pdftex_incremental en busytex_pipeline.js).
     rapida: compilar con el preámbulo precompilado (mylatexformat); si
     no se puede, el worker compila normal por su cuenta. */
  async compile(files, mainTexPath, { clean = false, rapida = false } = {}) {
    if (this.busy) throw new Error("Ya hay una compilación en curso");
    this.busy = true;
    try {
      await this.init();
      files = files.concat(await this.extraFiles(files));
      return await new Promise((resolve, reject) => {
        const onmsg = ({ data }) => {
          if (data.print) { this.onStatus(data.print); return; }
          if (data.exception) {
            /* El wasm que ha abortado no vuelve a servir: se tira para
               que el siguiente intento arranque uno limpio en vez de
               repetir el mismo fallo hasta que alguien recargue. */
            this._descartarMotor();
            reject(new Error(data.exception));
            return;
          }
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
          data_packages_js: null,
          clean,
          rapida
        });
      });
    } finally {
      this.busy = false;
    }
  }
}

/* Lo que pesan los paquetes de datos del motor (los .data), para la barra
   de descarga: Emscripten informa «Downloading data... (cargado/total)»
   sumando los paquetes a medida que empiezan, así que el total crece
   durante la descarga y al principio llega incluso disparatado. Se divide
   por este valor salvo que el informado sea mayor y razonable. Si cambian
   los paquetes basta con que sea aproximado: solo mueve una barra. */
export const DATOS_MOTOR_BYTES = 229e6;

/* «./main.tex:41: Undefined control sequence.» (--file-line-error) */
const FILE_LINE_ERR = /^(?:\.\/)?[^\s:][^:\n]*\.[A-Za-z]{1,8}:\d+:\s/;

/* Resumen legible del log de compilación */
export function summarizeLog(result) {
  const logs = result.logs || [];
  /* Solo la ÚLTIMA pasada de pdflatex (más los registros de BibTeX): las
     anteriores avisan de «Citation undefined» o «Label(s) may have
     changed» justo porque aún no estaba resuelto, y sumarlas duplicaba
     cada error y advertencia. */
  const latex = logs.filter(l => /^pdflatex\b/.test(l.cmd || ""));
  const ultima = latex[latex.length - 1];
  // (solo BibTeX además: la precompilación del preámbulo deja su propio
  // registro, «prefmt …», que no es del documento)
  const usados = ultima ? logs.filter(l => l === ultima || /^bibtex/.test(l.cmd || "")) : logs;
  const full = usados.map(l => l.log || "").join("\n");
  const lines = full.split("\n");
  const errors = [], warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    /* Con --file-line-error los errores salen como «./main.tex:41: …», no
       con «!». Mirar solo «!» hacía que un documento con errores se
       anunciara como «✓ Compilación correcta» (los marcaba el editor,
       pero el resumen no). */
    if (ln.startsWith("!") || FILE_LINE_ERR.test(ln)) {
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
  return { errors, warnings, pages: pagesMatch ? +pagesMatch[1] : 0, full, pasadas: result.pasadas || latex.length || 1, bibtex: !!result.bibtex_corrio };
}
