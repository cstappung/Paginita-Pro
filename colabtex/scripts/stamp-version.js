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
  { html: "informes.html", bundle: "informes-app.js" },
  { html: "juegos.html", bundle: "juegos-app.js" }
];

const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12); // AAAAMMDDHHMM
let failed = false;

for (const page of PAGES) {
  const file = path.join(ROOT, page.html);
  const src = fs.readFileSync(file, "utf8");
  const nombre = page.bundle.replace(/\./g, "\\.");
  /* Se comprueba que la etiqueta ESTÉ, no que el texto cambie: dos
     compilaciones dentro del mismo minuto dan la misma marca, el
     reemplazo no altera nada y aquello se daba por «etiqueta no
     encontrada» — con lo que `npm run build` salía con error después de
     haber ido perfectamente. */
  if (!new RegExp(nombre).test(src)) {
    console.error(`stamp-version: no se encontró la etiqueta de ${page.bundle} en ${page.html}`);
    failed = true;
    continue;
  }
  const out = src.replace(new RegExp(nombre + '(\\?v=[^"]*)?'), `${page.bundle}?v=${v}`);
  if (out !== src) fs.writeFileSync(file, out);
  console.log(`stamp-version: ${page.bundle}?v=${v}`);
}

if (failed) process.exit(1);
