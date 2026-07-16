"use strict";
/* Estampa ?v=<marca de tiempo> en la etiqueta <script> de colabtex.html
   para que GitHub Pages / el navegador no sirvan un bundle viejo cacheado. */
const fs = require("fs");
const path = require("path");

const html = path.join(__dirname, "..", "..", "colabtex.html");
const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDHHMM
const src = fs.readFileSync(html, "utf8");
const out = src.replace(/colabtex-app\.js(\?v=[^"]*)?/, `colabtex-app.js?v=${v}`);
if (out === src) {
  console.error("stamp-version: no se encontró la etiqueta de colabtex-app.js en colabtex.html");
  process.exit(1);
}
fs.writeFileSync(html, out);
console.log(`stamp-version: colabtex-app.js?v=${v}`);
