#!/usr/bin/env node
"use strict";
/* ============================================================
   Genera vendor/busytex/extra/pdftex.map

   pdfTeX solo incrusta una fuente Type1 si aparece en pdftex.map.
   Ese mapa lo genera updmap al instalar TeX Live, así que los
   paquetes de fuentes que añadimos después (bbold, dsfont…) no
   figuran en él: la macro carga, pero al compilar aparece
   «pdfTeX error: Font bbold10 at 600 not found».

   No se puede sustituir el pdftex.map del paquete base (los .data
   son de solo lectura y un duplicado rompería el FS virtual), pero
   texmf.cnf define:
       TEXFONTMAPS = $TEXMFDOTDIR;$TEXMF/fonts/map/...
   es decir, el directorio de trabajo va PRIMERO. Basta con inyectar
   un pdftex.map propio junto a los archivos del proyecto (lo hace
   LatexEngine.extraFiles) que contenga el mapa original más las
   entradas nuevas.

   Uso: node scripts/build-fontmap.js <dir-con-fonts/map/ de los paquetes nuevos>
   ============================================================ */
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
if (!SRC) { console.error("Uso: node scripts/build-fontmap.js <dir-con-fonts/map/>"); process.exit(1); }
const VENDOR = path.resolve(__dirname, "../../vendor/busytex");
const BASE_JS = path.join(VENDOR, "texlive-basic.js");
const BASE_DATA = path.join(VENDOR, "texlive-basic.data");
const CHUNK_SIZE = 2048;

/* ---------- decodificador de bloque LZ4 ----------
   Los .data de BusyTeX van troceados y comprimidos con el formato de
   bloque LZ4 de Emscripten; hay que descomprimir para leer un archivo. */
function lz4DecodeBlock(src, expectedSize) {
  const dst = Buffer.alloc(expectedSize);
  let ip = 0, op = 0;
  while (ip < src.length && op < expectedSize) {
    const token = src[ip++];
    let litLen = token >> 4;
    if (litLen === 15) { let b; do { b = src[ip++]; litLen += b; } while (b === 255); }
    for (let i = 0; i < litLen; i++) dst[op++] = src[ip++];
    if (ip >= src.length || op >= expectedSize) break;
    const offset = src[ip++] | (src[ip++] << 8);
    let matchLen = token & 15;
    if (matchLen === 15) { let b; do { b = src[ip++]; matchLen += b; } while (b === 255); }
    matchLen += 4;
    let mp = op - offset;
    for (let i = 0; i < matchLen && op < expectedSize; i++) dst[op++] = dst[mp++];
  }
  return dst;
}

/* lee un archivo del data package, descomprimiendo solo los chunks necesarios */
function readFromPackage(jsPath, dataPath, filename) {
  const js = fs.readFileSync(jsPath, "utf8");

  const cdAt = js.indexOf("var compressedData = ");
  const cdOpen = js.indexOf("{", cdAt);
  let depth = 0, cdEnd = -1, inStr = false, q = "";
  for (let i = cdOpen; i < js.length; i++) {
    const c = js[i];
    if (inStr) { if (c === "\\") i++; else if (c === q) inStr = false; }
    else if (c === '"' || c === "'") { inStr = true; q = c; }
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (!depth) { cdEnd = i + 1; break; } }
  }
  const cd = JSON.parse(js.slice(cdOpen, cdEnd));

  const meta = JSON.parse(js.slice(js.lastIndexOf("loadPackage(") + 12, js.lastIndexOf(");\n\n  })();")));
  const entry = meta.files.find(f => f.filename === filename || f.filename.endsWith("/" + filename));
  if (!entry) throw new Error("No se encontró " + filename + " en " + path.basename(jsPath));

  // OJO: cachedOffset es el tamaño COMPRIMIDO. El tamaño del flujo lógico
  // (descomprimido) es el final del último archivo de la metadata.
  const totalLogical = meta.files[meta.files.length - 1].end;

  const data = fs.readFileSync(dataPath);
  const first = Math.floor(entry.start / CHUNK_SIZE);
  const last = Math.floor((entry.end - 1) / CHUNK_SIZE);
  const parts = [];
  for (let i = first; i <= last; i++) {
    const cs = cd.offsets[i], sz = cd.sizes[i];
    const raw = data.subarray(cs, cs + sz);
    const plainSize = Math.min(CHUNK_SIZE, totalLogical - i * CHUNK_SIZE);
    const plain = cd.successes[i] ? lz4DecodeBlock(raw, plainSize) : raw;
    parts.push(plain);
  }
  const joined = Buffer.concat(parts);
  return joined.subarray(entry.start - first * CHUNK_SIZE, entry.end - first * CHUNK_SIZE);
}

console.log("Extrayendo pdftex.map del paquete base…");
const original = readFromPackage(BASE_JS, BASE_DATA, "pdftex.map").toString("latin1");
const origLines = original.split("\n").filter(l => l.trim() && !l.startsWith("%"));
console.log(`  mapa original: ${origLines.length} entradas`);
if (origLines.length < 100) { console.error("El mapa extraído parece incompleto; abortando."); process.exit(1); }
if (!/cmr10/.test(original)) { console.error("El mapa extraído no contiene cmr10; la descompresión falló."); process.exit(1); }

/* ---------- añadir los mapas de los paquetes nuevos ---------- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".map")) out.push(full);
  }
}
const maps = [];
walk(path.join(SRC, "fonts", "map"), maps);

const known = new Set(origLines.map(l => l.trim().split(/\s+/)[0]));
const added = [];
for (const m of maps) {
  for (const line of fs.readFileSync(m, "latin1").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("%") || t.startsWith("#")) continue;
    const name = t.split(/\s+/)[0];
    if (known.has(name)) continue;        // ya estaba: no duplicar
    known.add(name);
    added.push(t);
  }
}
console.log(`  mapas nuevos: ${maps.length} archivos → ${added.length} entradas añadidas`);
if (!added.length) console.warn("  (aviso: no se añadió ninguna entrada)");

const outDir = path.join(VENDOR, "extra");
fs.mkdirSync(outDir, { recursive: true });
const out = original.replace(/\s*$/, "") + "\n% --- entradas añadidas por ColabTeX (paquetes de fuentes extra) ---\n" +
  added.join("\n") + "\n";
fs.writeFileSync(path.join(outDir, "pdftex.map"), Buffer.from(out, "latin1"));
console.log(`extra/pdftex.map → ${(out.length / 1024).toFixed(0)} KB (${origLines.length + added.length} entradas)`);
