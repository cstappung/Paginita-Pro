"use strict";
/* Estampa ?v=<marca de tiempo> en la etiqueta <script> de cada página
   para que GitHub Pages / el navegador no sirvan un bundle viejo
   cacheado. Hay una entrada por aplicación web del sitio. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const PAGES = [
  { html: "colabtex.html", bundle: "colabtex-app.js" },
  { html: "colabdraw.html", bundle: "colabdraw-app.js" },
  { html: "informes.html", bundle: "informes-app.js" }
];

const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDHHMM
let failed = false;

for (const page of PAGES) {
  const file = path.join(ROOT, page.html);
  const src = fs.readFileSync(file, "utf8");
  const re = new RegExp(page.bundle.replace(/\./g, "\\.") + '(\\?v=[^"]*)?');
  const out = src.replace(re, `${page.bundle}?v=${v}`);
  if (out === src) {
    console.error(`stamp-version: no se encontró la etiqueta de ${page.bundle} en ${page.html}`);
    failed = true;
    continue;
  }
  fs.writeFileSync(file, out);
  console.log(`stamp-version: ${page.bundle}?v=${v}`);
}

if (failed) process.exit(1);
