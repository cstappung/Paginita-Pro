#!/usr/bin/env node
"use strict";
/* ============================================================
   Genera vendor/busytex/texlive-pgf.{data,js}: un data package
   de Emscripten con PGF/TikZ, que BusyTeX no incluye en ninguno
   de sus paquetes prearmados (en Debian/Ubuntu PGF vive en
   texlive-pictures, que no se distribuye compilado a wasm).

   Sin esto fallan tcolorbox, svg, transparent, pgfplots, tikz…
   con «File `pgf.sty' not found».

   Uso:
     1) curl -L -o pgf.tar.xz \
          https://mirrors.ctan.org/systems/texlive/tlnet/archive/pgf.tar.xz
     2) tar -xJf pgf.tar.xz tex/latex tex/generic tex/plain
     3) node scripts/build-pgf-package.js <ruta-al-dir-que-contiene-tex/>

   El .js reutiliza el cargador (boilerplate) de un paquete
   existente para garantizar compatibilidad exacta con el worker.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SRC = process.argv[2];
if (!SRC) {
  console.error("Uso: node scripts/build-pgf-package.js <dir-con-tex/>");
  process.exit(1);
}
const VENDOR = path.resolve(__dirname, "../../vendor/busytex");
const TEMPLATE = path.join(VENDOR, "ubuntu-texlive-science.js");
const OUT_NAME = "texlive-pgf";
const PREFIX = "/texmf/texmf-dist/";

/* ---------- recolectar archivos ---------- */
function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push({ abs: full, rel: path.relative(base, full).split(path.sep).join("/") });
  }
}

const texDir = path.join(SRC, "tex");
if (!fs.existsSync(texDir)) {
  console.error("No se encontró " + texDir + " (¿extrajiste el tar.xz ahí?)");
  process.exit(1);
}
const all = [];
walk(texDir, SRC, all);
// graphdrawing es Lua y solo funciona con LuaTeX; aquí se compila con
// pdfTeX, así que sobra (~2 MB de descarga para el usuario).
const files = all.filter(f => !f.rel.includes("/graphdrawing/"));
files.sort((a, b) => a.rel.localeCompare(b.rel));
console.log(`Archivos a empaquetar: ${files.length} (omitidos ${all.length - files.length} de graphdrawing/Lua)`);

/* ---------- construir el .data y la metadata ---------- */
const chunks = [];
const meta = [];
let offset = 0;
for (const f of files) {
  const buf = fs.readFileSync(f.abs);
  chunks.push(buf);
  meta.push({ filename: PREFIX + f.rel, start: offset, end: offset + buf.length });
  offset += buf.length;
}
const payloadData = Buffer.concat(chunks);

/* ---------- envoltura LZ4 de Emscripten ----------
   El cargador de BusyTeX solo tiene la ruta Module['LZ4'].loadPackage: los
   .data van troceados en chunks de CHUNK_SIZE. El array successes[] indica
   por chunk si está comprimido; con 0 el runtime copia el chunk tal cual,
   así que se puede publicar un paquete válido SIN comprimir nada.
   El .data termina con 2 búferes de caché (cachedIndexes/cachedChunks),
   de ahí los CHUNK_SIZE*2 bytes extra al final. */
const CHUNK_SIZE = 2048;
const N_CACHED = 2;
const offsets = [], sizes = [], successes = [];
for (let off = 0; off < payloadData.length; off += CHUNK_SIZE) {
  offsets.push(off);
  sizes.push(Math.min(CHUNK_SIZE, payloadData.length - off));
  successes.push(0);                       // 0 = chunk almacenado sin comprimir
}
const cachedOffset = payloadData.length;
const data = Buffer.concat([payloadData, Buffer.alloc(CHUNK_SIZE * N_CACHED)]);

const compressedData = {
  data: null,
  cachedOffset,
  cachedIndexes: new Array(N_CACHED).fill(-1),
  cachedChunks: new Array(N_CACHED).fill(null),
  offsets, sizes, successes
};

const uuid = "sha256-" + crypto.createHash("sha256").update(data).digest("hex");
fs.writeFileSync(path.join(VENDOR, OUT_NAME + ".data"), data);
console.log(`${OUT_NAME}.data → ${(data.length / 1048576).toFixed(1)} MB (${offsets.length} chunks sin comprimir)`);

/* ---------- cabecera \ProvidesPackage (la usa BusytexDataPackageResolver) ---------- */
const provides = new Set();
for (const f of files) {
  if (!/\.(sty|cls)$/.test(f.rel)) continue;
  const txt = fs.readFileSync(f.abs, "latin1");
  const m = txt.match(/\\ProvidesPackage\{(.+?)\}/);
  if (m) provides.add(m[1]);
  else provides.add(path.basename(f.rel).replace(/\.(sty|cls)$/, ""));
}
const header = Array.from(provides).sort().map(p => `// \\ProvidesPackage{${p}}`).join("\n") + "\n";
console.log(`Paquetes declarados: ${provides.size} (pgf, tikz, pgfcore…)`);

/* ---------- .js: reutilizar el cargador del paquete plantilla ---------- */
let tpl = fs.readFileSync(TEMPLATE, "utf8");
tpl = tpl.split("\n").filter(l => !l.startsWith("//")).join("\n");   // quitar su cabecera

const call = tpl.lastIndexOf("loadPackage(");
if (call < 0) { console.error("No se encontró la llamada loadPackage( en la plantilla"); process.exit(1); }
// reemplazo global: cubre PACKAGE_NAME, REMOTE_PACKAGE_BASE y los IDs
// de runDependency ('datafile_build/wasm/<nombre>.data'), que deben ser
// únicos por paquete y coherentes dentro del archivo.
let boiler = tpl.slice(0, call).split("ubuntu-texlive-science").join(OUT_NAME);

/* Los Module['FS_createPath'](...) de la plantilla crean SUS directorios.
   Hay que sustituirlos por los de este paquete: si un archivo aterriza en
   un directorio inexistente, el runtime aborta con «Assertion failed». */
const dirs = new Set();
for (const m of meta) {
  const parts = m.filename.split("/").slice(1, -1);   // sin "" inicial ni el archivo
  for (let i = 1; i <= parts.length; i++) dirs.add("/" + parts.slice(0, i).join("/"));
}
const createPaths = Array.from(dirs)
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
  .map(d => {
    const parent = d.slice(0, d.lastIndexOf("/")) || "/";
    const name = d.slice(d.lastIndexOf("/") + 1);
    return `Module['FS_createPath'](${JSON.stringify(parent)}, ${JSON.stringify(name)}, true, true);`;
  }).join("\n    ");

const firstCP = boiler.indexOf("Module['FS_createPath']");
const lastCP = boiler.lastIndexOf("Module['FS_createPath']");
if (firstCP < 0) { console.error("No se encontraron llamadas FS_createPath en la plantilla"); process.exit(1); }
const endLastCP = boiler.indexOf(";", lastCP) + 1;
boiler = boiler.slice(0, firstCP) + createPaths + boiler.slice(endLastCP);
console.log(`Directorios creados: ${dirs.size}`);

/* El literal `var compressedData = {...}` de la plantilla describe SUS chunks;
   hay que reemplazarlo por el nuestro o el runtime lee offsets ajenos y aborta
   con «Assertion failed».
   Se delimita emparejando llaves (un regex no sirve: el objeto no termina en
   «};» y se comería el resto del cargador, incluido LZ4.loadPackage). */
function matchBrace(src, open) {
  let depth = 0, inStr = false, quote = "";
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") { inStr = true; quote = c; }
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
const cdDecl = "var compressedData = ";
const cdAt = boiler.indexOf(cdDecl);
if (cdAt < 0) { console.error("No se encontró el literal compressedData en la plantilla"); process.exit(1); }
const cdOpen = boiler.indexOf("{", cdAt);
const cdEnd = matchBrace(boiler, cdOpen);
if (cdEnd < 0) { console.error("Literal compressedData mal formado en la plantilla"); process.exit(1); }
boiler = boiler.slice(0, cdOpen) + JSON.stringify(compressedData) + boiler.slice(cdEnd);

if (boiler.includes("ubuntu-texlive-science")) {
  console.error("Quedaron referencias al paquete plantilla; revisa los reemplazos.");
  process.exit(1);
}

// remote_package_size debe ser el tamaño REAL del .data (payload + búferes de caché)
const payload = JSON.stringify({ files: meta, remote_package_size: data.length, package_uuid: uuid });
const js = header + boiler + "loadPackage(" + payload + ");\n\n  })();\n";

// el .js se carga con importScripts en el worker: un error de sintaxis solo
// se vería como un fallo opaco en tiempo de ejecución, así que se valida aquí
try { new (require("vm").Script)(js, { filename: OUT_NAME + ".js" }); }
catch (e) { console.error("El .js generado no es sintácticamente válido: " + e.message); process.exit(1); }

fs.writeFileSync(path.join(VENDOR, OUT_NAME + ".js"), js);
console.log(`${OUT_NAME}.js   → ${(js.length / 1024).toFixed(0)} KB`);
console.log("\nListo. Añade \"" + OUT_NAME + ".js\" a ALL_PACKAGES en src/latex.js");
