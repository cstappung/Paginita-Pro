/* Pro BoxHead en Node: rehace una prueba del Solo Club con los mismos
   archivos del juego (sin-pantalla.js + datos.js + juego.js) en un contexto
   aparte. Lo usan tests/boxhead.test.cjs y scripts/auditar-club.cjs, que lo
   dejan en globalThis.BoxheadRehace para verifica/boxhead.js. Un contexto
   nuevo por llamada: rehacer no depende de lo que se rehízo antes. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ARCHIVOS = ['sin-pantalla.js', 'datos.js', 'juego.js'].map(f => [f, fs.readFileSync(path.join(__dirname, f), 'utf8')]);
function contexto() {
  const ctx = { console, Math, JSON, Date, Map, Set, Array, Object, Number, String, Boolean, Symbol, Proxy, Error, TypeError,
    Int32Array, Float32Array, Uint8Array, URLSearchParams, Infinity, NaN, isFinite, parseInt, parseFloat };
  vm.createContext(ctx);
  for (const [f, src] of ARCHIVOS) vm.runInContext(src, ctx, { filename: f });
  return ctx.__boxhead;
}
const rehace = p => contexto().rehace(JSON.parse(JSON.stringify(p)));
module.exports = { contexto, rehace };
