"use strict";
/* Servidor estático SOLO para desarrollo local.
   En producción el sitio se sirve desde GitHub Pages y todos los
   datos (usuarios, proyectos, colaboración) viven en Firebase. */
const path = require("path");
const express = require("express");

const ROOT = path.join(__dirname, "..", "..");
const PORT = process.env.PORT || 8123;

const app = express();
app.use(express.static(ROOT, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
    if (filePath.endsWith(".data")) res.setHeader("Content-Type", "application/octet-stream");
  }
}));

app.listen(PORT, () => {
  console.log("Vista previa local: http://localhost:" + PORT + "/Inicio.dc.html");
});
