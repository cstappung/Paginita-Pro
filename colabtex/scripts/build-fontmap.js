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

   --- De dónde salen las entradas nuevas ---

   De los propios .data de BusyTeX, no de un directorio del disco.
   Esto es lo que faltaba y lo que costó el fallo «Font umvs at 600
   not found» (umvs es marvosym): la fuente estaba empaquetada entera
   —umvs.tfm, umvs.fd y marvosym.pfb— y hasta su marvosym.map viajaba
   dentro de ubuntu-texlive-fonts-recommended.data, pero pdfTeX NO lee
   los .map de cada paquete, solo el pdftex.map ya ensamblado. Y el
   ensamblado lo hace updmap con las líneas de updmap.cfg, que aquí
   son diecisiete: las de TeX Live basic. Todo lo que vino después en
   los paquetes de Ubuntu quedó fuera del mapa, aunque estuviera en
   el sistema de archivos virtual.

   Así que se recorren los .data, se sacan de dentro los .map de
   fonts/map/ y se añaden sus líneas. Marvosym era solo el que tocó
   reportar: por el mismo agujero se caían eurosym, wasy, stmaryrd,
   esint, manfnt y mflogo.

   Una línea solo entra si los archivos que cita (.pfb, .enc…) están
   de verdad en algún paquete. Sin esa comprobación, una entrada
   huérfana cambia el error «Font X at 600 not found» por «cannot
   open file for reading», que es igual de roto y más difícil de
   entender.

   Uso: node scripts/build-fontmap.js [dir-con-fonts/map/ adicional]
   ============================================================ */
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2] || null;   // opcional: un árbol suelto en el disco
const VENDOR = path.resolve(__dirname, "../../vendor/busytex");
const BASE = "texlive-basic";
const MAPA_BASE = "pdftex.map";
const CHUNK_SIZE = 2048;
/* Extensiones que una línea del mapa puede citar con «<». Si el archivo
   no está en ningún paquete, la línea no sirve para nada. */
const CITABLES = /\.(pfb|pfa|ttf|otf|enc|cmap)$/i;

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

/* Lee la metadata de un data package SIN tocar el .data (son hasta 100 MB;
   para saber qué hay dentro basta el .js, que ronda el mega). */
function abreManifiesto(nombre) {
  const jsPath = path.join(VENDOR, nombre + ".js");
  const dataPath = path.join(VENDOR, nombre + ".data");
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

  // OJO: cachedOffset es el tamaño COMPRIMIDO. El tamaño del flujo lógico
  // (descomprimido) es el final del último archivo de la metadata.
  const totalLogical = meta.files[meta.files.length - 1].end;
  return { nombre, dataPath, cd, meta, totalLogical };
}

/* Saca un archivo del .data descomprimiendo solo los chunks que lo cubren, y
   leyendo del disco solo esos bytes: cargar el .data entero por cada .map
   serían gigabytes de lectura para unos pocos kilobytes de mapa. */
function leeEntrada(man, entry) {
  const fd = fs.openSync(man.dataPath, "r");
  try {
    const first = Math.floor(entry.start / CHUNK_SIZE);
    const last = Math.floor((entry.end - 1) / CHUNK_SIZE);
    const parts = [];
    for (let i = first; i <= last; i++) {
      const cs = man.cd.offsets[i], sz = man.cd.sizes[i];
      const raw = Buffer.alloc(sz);
      fs.readSync(fd, raw, 0, sz, cs);
      const plainSize = Math.min(CHUNK_SIZE, man.totalLogical - i * CHUNK_SIZE);
      parts.push(man.cd.successes[i] ? lz4DecodeBlock(raw, plainSize) : raw);
    }
    const joined = Buffer.concat(parts);
    return joined.subarray(entry.start - first * CHUNK_SIZE, entry.end - first * CHUNK_SIZE);
  } finally {
    fs.closeSync(fd);
  }
}

const base = (m, f) => (f.filename.split("/").pop());

/* ---------- 1. el mapa original, del paquete base ---------- */
console.log("Extrayendo pdftex.map del paquete base…");
const manifiestos = fs.readdirSync(VENDOR)
  .filter(f => f.endsWith(".data"))
  .map(f => f.slice(0, -5))
  .sort((a, b) => (a === BASE ? -1 : b === BASE ? 1 : a.localeCompare(b)))
  .map(abreManifiesto);

const manBase = manifiestos.find(m => m.nombre === BASE);
const entradaBase = manBase.meta.files.find(f => base(manBase, f) === MAPA_BASE);
if (!entradaBase) { console.error("No se encontró pdftex.map en " + BASE); process.exit(1); }
const original = leeEntrada(manBase, entradaBase).toString("latin1");
const origLines = original.split("\n").filter(l => l.trim() && !l.startsWith("%"));
console.log(`  mapa original: ${origLines.length} entradas`);
if (origLines.length < 100) { console.error("El mapa extraído parece incompleto; abortando."); process.exit(1); }
if (!/cmr10/.test(original)) { console.error("El mapa extraído no contiene cmr10; la descompresión falló."); process.exit(1); }

/* ---------- 2. inventario de archivos y de mapas de TODOS los paquetes ---------- */
const disponibles = new Set();   // nombres de archivo que existen en el FS virtual
const mapasEnPaquete = [];       // {man, entry, ruta}
for (const man of manifiestos) {
  for (const f of man.meta.files) {
    const nombre = base(man, f);
    disponibles.add(nombre.toLowerCase());
    if (nombre === MAPA_BASE) continue;                 // el ya ensamblado, no un fragmento
    if (!nombre.endsWith(".map")) continue;
    if (!f.filename.includes("/fonts/map/")) continue;
    mapasEnPaquete.push({ man, entry: f, ruta: f.filename });
  }
}
console.log(`  paquetes: ${manifiestos.length} → ${disponibles.size} archivos, ${mapasEnPaquete.length} mapas dentro`);

/* ---------- 3. mapas sueltos del disco (opcional) ---------- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".map")) out.push(full);
  }
}
const mapasEnDisco = [];
if (SRC) walk(path.join(SRC, "fonts", "map"), mapasEnDisco);

/* ---------- 4. fundir ---------- */
const known = new Set(origLines.map(l => l.trim().split(/\s+/)[0]));
const added = [];
let huerfanas = 0;
const sinFuente = new Set();

function absorbe(texto, etiqueta) {
  let n = 0;
  for (const line of texto.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("%") || t.startsWith("#")) continue;
    const campos = t.split(/\s+/);
    const name = campos[0];
    if (known.has(name)) continue;        // ya estaba: no duplicar
    /* Una entrada que cita archivos que no viajan en ningún paquete no
       arregla nada: cambia un error por otro. Fuera. */
    const faltan = campos
      .filter(c => c.startsWith("<"))
      .map(c => c.replace(/^<+/, ""))
      .filter(c => CITABLES.test(c) && !disponibles.has(c.toLowerCase()));
    if (faltan.length) { huerfanas++; faltan.forEach(f => sinFuente.add(f)); continue; }
    known.add(name);
    added.push(t);
    n++;
  }
  return n;
}

for (const m of mapasEnPaquete) absorbe(leeEntrada(m.man, m.entry).toString("latin1"), m.ruta);
for (const m of mapasEnDisco)   absorbe(fs.readFileSync(m, "latin1"), m);

console.log(`  mapas leídos: ${mapasEnPaquete.length} de los .data` +
  (SRC ? ` + ${mapasEnDisco.length} del disco` : "") + ` → ${added.length} entradas añadidas`);
if (huerfanas) console.log(`  descartadas ${huerfanas} entradas por citar archivos que no están: ${[...sinFuente].slice(0, 8).join(" ")}${sinFuente.size > 8 ? " …" : ""}`);
if (!added.length) console.warn("  (aviso: no se añadió ninguna entrada)");

const outDir = path.join(VENDOR, "extra");
fs.mkdirSync(outDir, { recursive: true });
const out = original.replace(/\s*$/, "") + "\n% --- entradas añadidas por ColabTeX (paquetes de fuentes extra) ---\n" +
  added.join("\n") + "\n";
fs.writeFileSync(path.join(outDir, MAPA_BASE), Buffer.from(out, "latin1"));
console.log(`extra/pdftex.map → ${(out.length / 1024).toFixed(0)} KB (${origLines.length + added.length} entradas)`);
