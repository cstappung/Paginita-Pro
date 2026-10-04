"use strict";
/* Junta los diccionarios de i18n/*.txt (una fila «es || en || it» por
   texto, «#» comenta) en i18n-datos.js, que i18n.js carga en cada página.
   Una fila repetida se queda con la última: así un archivo más específico
   puede corregir a uno general. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DIR = path.join(ROOT, "i18n");
const filas = new Map();
let malas = 0;

for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith(".txt")).sort()) {
  const lineas = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  lineas.forEach((l, i) => {
    if (!l.trim() || l.trimStart().startsWith("#")) return;
    const c = l.split(" || ").map((s) => s.replace(/\s+/g, " ").trim());
    if (c.length !== 3 || !c[0] || !c[1] || !c[2]) {
      console.error(`build-i18n: ${f}:${i + 1} no tiene tres columnas`);
      malas++;
      return;
    }
    filas.set(c[0], c.join("\t"));
  });
}

if (malas) process.exit(1);
const datos = [...filas.values()].join("\n");
fs.writeFileSync(path.join(ROOT, "i18n-datos.js"),
  "/* Generado por colabtex/scripts/build-i18n.js desde i18n/*.txt: no editar. */\n" +
  "window.I18N_DATOS = " + JSON.stringify(datos) + ";\n");
console.log(`build-i18n: ${filas.size} textos`);
