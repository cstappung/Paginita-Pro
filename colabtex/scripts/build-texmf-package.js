#!/usr/bin/env node
"use strict";
/* ============================================================
   Genera un data package de Emscripten (.data + .js) con paquetes
   de TeX Live que BusyTeX no distribuye.

   BusyTeX solo publica basic / latex-base / latex-recommended /
   latex-extra / science / fonts-recommended. Falta entera la
   colección «pictures» de Debian/Ubuntu (texlive-pictures): PGF,
   TikZ, epic/eepic, pict2e, pgfplots, circuitikz… Sin ella
   fallan tcolorbox, svg, transparent, overpic, etc. con
   «File `pgf.sty' not found» / «File `epic.sty' not found».

   Uso:
     1) Descargar los .tar.xz de tlnet/archive y extraer «tex/»
        en un directorio de trabajo (ver README del script).
     2) node scripts/build-texmf-package.js <dir-con-tex/> <nombre>

   Detalles del formato (descubiertos a base de depurar):
   - El cargador solo tiene la ruta Module['LZ4'].loadPackage: el
     .data va en chunks de 2048 B. Con successes=0 el runtime copia
     el chunk sin descomprimir, así que no hace falta comprimir.
   - El .data lleva al final 2 búferes de caché (CHUNK_SIZE*2).
   - Hay que emitir las llamadas FS_createPath de NUESTROS
     directorios; si un archivo cae en uno inexistente, aborta.
   - Un archivo duplicado respecto a otro paquete rompe el FS, así
     que se deduplica contra los paquetes ya presentes.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SRC = process.argv[2];
const OUT_NAME = process.argv[3];
if (!SRC || !OUT_NAME) {
  console.error("Uso: node scripts/build-texmf-package.js <dir-con-tex/> <nombre-salida>");
  process.exit(1);
}
const VENDOR = path.resolve(__dirname, "../../vendor/busytex");
const TEMPLATE = path.join(VENDOR, "ubuntu-texlive-science.js");
const PREFIX = "/texmf/texmf-dist/";
const CHUNK_SIZE = 2048;
const N_CACHED = 2;

/* paquetes ya empaquetados por BusyTeX: sirven para deduplicar */
const EXISTING = [
  "texlive-basic.js", "ubuntu-texlive-latex-recommended.js",
  "ubuntu-texlive-latex-extra.js", "ubuntu-texlive-science.js",
  "ubuntu-texlive-fonts-recommended.js"
];

/* subárboles que se empaquetan: macros, estilos de bibliografía y lo que
   pdfTeX necesita de las fuentes (métricas, Type1, virtuales, codificaciones
   y mapas). Se excluye fonts/source (METAFONT: no se puede ejecutar aquí) y
   los formatos que pdfTeX no usa (opentype/truetype).

   bibtex/ estaba olvidado: sin él se empaquetaba IEEEtran.cls pero no
   IEEEtran.bst, y BibTeX moría con «I couldn't open style file» dejando
   todas las citas sin resolver. */
const KEEP_TREES = ["tex/", "bibtex/", "fonts/tfm/", "fonts/type1/", "fonts/vf/", "fonts/enc/", "fonts/map/"];

/* motores que aquí no se usan (se compila con pdfTeX) */
const SKIP_TREES = ["tex/context/", "tex/lualatex/"];
const SKIP_DIRS = ["/graphdrawing/"];          // Lua, solo LuaTeX

/* colecciones decorativas enormes (emojis, banderas, iconos, dibujos):
   ~55 MB que ningún documento académico necesita */
const SKIP_PKGS = [
  "utfsym", "worldflags", "openmoji", "twemojis", "byo-twemojis", "realhats",
  "bootstrapicons", "figchild", "pgf-periodictable", "pgfornament", "pgf-spectra",
  "lucide-icons", "circularglyphs", "vectorlogos", "coffeestains", "scsnowman",
  "tikzducks", "tikzlings", "tikzmarmots", "tikzpingus", "tikzpeople",
  "tikzbrickfigurines", "tikzbricks", "open-everyday-symbols", "sacsymb",
  "milsymb", "knitting", "knittingpattern", "pixelart", "byrne", "polyhedra",
  "tikz-among-us", "tikz-cookingsymbols", "tikz-decofonts", "bootstrapicons"
];

function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push({ abs: full, rel: path.relative(base, full).split(path.sep).join("/") });
  }
}

const all = [];
for (const tree of KEEP_TREES) {
  const dir = path.join(SRC, tree);
  if (fs.existsSync(dir)) walk(dir, SRC, all);
}
if (!all.length) { console.error("No se encontró ningún subárbol empaquetable en " + SRC); process.exit(1); }

/* ---------- filtrado ---------- */
const skipPkgRe = new RegExp("/(" + SKIP_PKGS.join("|") + ")/");
let dropTree = 0, dropDeco = 0, dropLua = 0;
let files = all.filter(f => {
  if (SKIP_TREES.some(t => f.rel.startsWith(t))) { dropTree++; return false; }
  if (SKIP_DIRS.some(d => f.rel.includes(d))) { dropLua++; return false; }
  if (skipPkgRe.test("/" + f.rel)) { dropDeco++; return false; }
  return true;
});

/* ---------- deduplicar contra los paquetes existentes ---------- */
const already = new Set();
for (const p of EXISTING) {
  const txt = fs.readFileSync(path.join(VENDOR, p), "utf8");
  const re = /"filename":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(txt))) already.add(m[1]);
}
const before = files.length;
files = files.filter(f => !already.has(PREFIX + f.rel));
const dropDup = before - files.length;

files.sort((a, b) => a.rel.localeCompare(b.rel));
console.log(`Archivos: ${files.length} incluidos`);
console.log(`  descartados: ${dropTree} (context/lualatex), ${dropLua} (graphdrawing/Lua), ${dropDeco} (decorativos), ${dropDup} (ya presentes en otro paquete)`);
if (!files.length) { console.error("No queda ningún archivo que empaquetar"); process.exit(1); }

/* ---------- .data + metadata ---------- */
const chunks = [], meta = [];
let offset = 0;
for (const f of files) {
  const buf = fs.readFileSync(f.abs);
  chunks.push(buf);
  meta.push({ filename: PREFIX + f.rel, start: offset, end: offset + buf.length });
  offset += buf.length;
}
const payloadData = Buffer.concat(chunks);

const offsets = [], sizes = [], successes = [];
for (let off = 0; off < payloadData.length; off += CHUNK_SIZE) {
  offsets.push(off);
  sizes.push(Math.min(CHUNK_SIZE, payloadData.length - off));
  successes.push(0);                       // 0 = chunk almacenado sin comprimir
}
const compressedData = {
  data: null,
  cachedOffset: payloadData.length,
  cachedIndexes: new Array(N_CACHED).fill(-1),
  cachedChunks: new Array(N_CACHED).fill(null),
  offsets, sizes, successes
};
const data = Buffer.concat([payloadData, Buffer.alloc(CHUNK_SIZE * N_CACHED)]);
const uuid = "sha256-" + crypto.createHash("sha256").update(data).digest("hex");
fs.writeFileSync(path.join(VENDOR, OUT_NAME + ".data"), data);
console.log(`${OUT_NAME}.data → ${(data.length / 1048576).toFixed(1)} MB (${offsets.length} chunks)`);

/* ---------- cabecera \ProvidesPackage (la lee BusytexDataPackageResolver) ---------- */
const provides = new Set();
for (const f of files) {
  if (!/\.(sty|cls)$/.test(f.rel)) continue;
  const txt = fs.readFileSync(f.abs, "latin1");
  const m = txt.match(/\\ProvidesPackage\{(.+?)\}/);
  provides.add(m ? m[1] : path.basename(f.rel).replace(/\.(sty|cls)$/, ""));
}
const header = Array.from(provides).sort().map(p => `// \\ProvidesPackage{${p}}`).join("\n") + "\n";
console.log(`Paquetes declarados: ${provides.size}`);

/* ---------- .js: reutilizar el cargador de un paquete existente ---------- */
let tpl = fs.readFileSync(TEMPLATE, "utf8").split("\n").filter(l => !l.startsWith("//")).join("\n");
const call = tpl.lastIndexOf("loadPackage(");
if (call < 0) { console.error("No se encontró loadPackage( en la plantilla"); process.exit(1); }
let boiler = tpl.slice(0, call).split("ubuntu-texlive-science").join(OUT_NAME);

/* nuestros directorios */
const dirs = new Set();
for (const m of meta) {
  const parts = m.filename.split("/").slice(1, -1);
  for (let i = 1; i <= parts.length; i++) dirs.add("/" + parts.slice(0, i).join("/"));
}
const createPaths = Array.from(dirs)
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
  .map(d => {
    const parent = d.slice(0, d.lastIndexOf("/")) || "/";
    return `Module['FS_createPath'](${JSON.stringify(parent)}, ${JSON.stringify(d.slice(d.lastIndexOf("/") + 1))}, true, true);`;
  }).join("\n    ");

const firstCP = boiler.indexOf("Module['FS_createPath']");
const lastCP = boiler.lastIndexOf("Module['FS_createPath']");
if (firstCP < 0) { console.error("Sin llamadas FS_createPath en la plantilla"); process.exit(1); }
boiler = boiler.slice(0, firstCP) + createPaths + boiler.slice(boiler.indexOf(";", lastCP) + 1);
console.log(`Directorios creados: ${dirs.size}`);

/* el literal compressedData: delimitar emparejando llaves (no termina en «};») */
function matchBrace(src, open) {
  let depth = 0, inStr = false, quote = "";
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === "\\") i++; else if (c === quote) inStr = false; }
    else if (c === '"' || c === "'") { inStr = true; quote = c; }
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (!depth) return i + 1; }
  }
  return -1;
}
const cdAt = boiler.indexOf("var compressedData = ");
if (cdAt < 0) { console.error("Sin literal compressedData en la plantilla"); process.exit(1); }
const cdOpen = boiler.indexOf("{", cdAt);
const cdEnd = matchBrace(boiler, cdOpen);
if (cdEnd < 0) { console.error("Literal compressedData mal formado"); process.exit(1); }
boiler = boiler.slice(0, cdOpen) + JSON.stringify(compressedData) + boiler.slice(cdEnd);

if (boiler.includes("ubuntu-texlive-science")) { console.error("Quedaron referencias a la plantilla"); process.exit(1); }

const payload = JSON.stringify({ files: meta, remote_package_size: data.length, package_uuid: uuid });
const js = header + boiler + "loadPackage(" + payload + ");\n\n  })();\n";

// se carga con importScripts: un error de sintaxis solo se vería como un
// fallo opaco en tiempo de ejecución, así que se valida aquí
try { new (require("vm").Script)(js, { filename: OUT_NAME + ".js" }); }
catch (e) { console.error("El .js generado no es válido: " + e.message); process.exit(1); }

fs.writeFileSync(path.join(VENDOR, OUT_NAME + ".js"), js);
console.log(`${OUT_NAME}.js   → ${(js.length / 1024).toFixed(0)} KB`);
console.log(`\nListo. Añade "${OUT_NAME}.js" a ALL_PACKAGES en src/latex.js`);
