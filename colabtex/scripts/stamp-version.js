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
  { html: "juegos.html", bundle: "juegos-app.js" },
  /* Los motores de las herramientas .dc no pasan por esbuild, pero el
     problema de la caché es el mismo: la página se sirve fresca (trae la
     opción nueva) y el navegador reutiliza el motor viejo, que no la
     entiende. Quien edite uno de estos y no compile, que suba el ?v= a
     mano. */
  { html: "CSV Oscilloscope.dc.html", bundle: "scope-engine.js" },
  { html: "Filtros.dc.html", bundle: "filtros-engine.js" },
  { html: "Ajustes.dc.html", bundle: "ajuste-engine.js" }
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
  /* Anclado a src="…": en las páginas .dc el nombre del motor aparece antes
     en un comentario CSS, y «la primera aparición» sellaba el comentario y
     dejaba la etiqueta como estaba. */
  const patron = new RegExp('src="' + nombre + '(\\?v=[^"]*)?"');
  if (!patron.test(src)) {
    console.error(`stamp-version: no se encontró la etiqueta de ${page.bundle} en ${page.html}`);
    failed = true;
    continue;
  }
  const out = src.replace(patron, `src="${page.bundle}?v=${v}"`);
  if (out !== src) fs.writeFileSync(file, out);
  console.log(`stamp-version: ${page.bundle}?v=${v}`);
}

/* i18n.js y su diccionario (i18n-datos.js hereda este mismo ?v=) van en
   todas las páginas, también en las de los juegos que viven en un iframe,
   con la ruta relativa que les toque. */
const I18N_PAGINAS = [
  "Inicio.dc.html", "index.html", "colabtex.html", "colabdraw.html", "informes.html",
  "juegos.html", "CSV Oscilloscope.dc.html", "Filtros.dc.html", "Ajustes.dc.html",
  ...["juegos", "juegos/club"].flatMap((d) =>
    fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, d, e.name, "index.html")))
      .map((e) => d + "/" + e.name + "/index.html"))
];
for (const html of I18N_PAGINAS) {
  const file = path.join(ROOT, html);
  const src = fs.readFileSync(file, "utf8");
  const patron = /src="((?:\.\.\/)*)i18n\.js(\?v=[^"]*)?"/;
  if (!patron.test(src)) {
    console.error(`stamp-version: no se encontró la etiqueta de i18n.js en ${html}`);
    failed = true;
    continue;
  }
  const out = src.replace(patron, (_, pre) => `src="${pre}i18n.js?v=${v}"`);
  if (out !== src) fs.writeFileSync(file, out);
}
console.log(`stamp-version: i18n.js?v=${v} en ${I18N_PAGINAS.length} páginas`);

if (failed) process.exit(1);
