"use strict";
/* Decide, leyendo el código de cada juego, si se juega en el celular, en el
   PC o en los dos, y lo deja en src/juegos/controles-datos.js, que el salón
   lee para las etiquetas «Celular» y «PC». Corre en cada `npm run build`,
   así que un juego nuevo recibe sus etiquetas sin que nadie mantenga una
   lista a mano.

   Lo que se mira es con qué escucha el juego, no si su pantalla cabe en un
   teléfono (sortEm cabe entero y solo se mueve con flechas):

   - toque: `touchstart`/`touchmove`/`touchend`, `pointer:coarse` o
     `maxTouchPoints`. Quien escribe eso pensó en un dedo.
   - puntero: `pointerdown`/`pointerup`/`pointermove`/`mousedown`/`mouseup`,
     y clic: `click`/`onclick`. Un dedo los dispara igual que un ratón.
   - teclas de movimiento: flechas o WASD (`ArrowLeft`, `KeyW`,
     `keyCode` 37–40, `createCursorKeys`).
   - ratón de mira: `requestPointerLock`/`movementX`, el de un shooter en
     primera persona, que un dedo no puede dar.

   Las reglas, en orden:
   1. Un comentario `@controles: tactil raton teclado` (cualquier subconjunto)
      en el código del juego manda sobre todo lo demás. Es para cuando la
      lectura se equivoca: sortEm escucha `pointerdown`, pero solo para elegir
      el modo en la portada, y se juega con flechas y espacio.
   2. Con ratón de mira y sin señal de toque, no va en el celular: pide
      «teclado y ratón».
   3. Con teclas de movimiento, sin señal de toque y sin puntero (solo clics,
      que en esos juegos son los botones del menú), no va en el celular:
      pide «teclado».
   4. Si escucha toque, puntero o clic, va en el celular.
   En el PC va todo lo que escuche teclas, puntero o clic.

   Qué código es de cada juego sale de las mismas tablas que pintan el salón
   (`JUEGOS` en motor.js y `SOLOS` en salon-datos.js): el módulo
   `src/juegos/<id>.js` de un juego de sala más la carpeta que abra en un
   iframe (`juegos/<x>/index.html`), la carpeta `juegos/club/<x>/` de un juego
   del Club, o la carpeta de la `url` de una práctica con bots. Nunca entra lo
   compartido (`juegos/audio/mando.js` fabrica flechas para los mandos, y
   haría pasar a todos por juegos de teclado). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..", "..");
const SRC = path.join(__dirname, "..", "src", "juegos");
const SALIDA = path.join(SRC, "controles-datos.js");

/* Los módulos se cargan sin navegador, como en las pruebas: fuera los
   import y los export, y lo que interesa se saca por globalThis. */
function cargaTablas() {
  const sin = f => fs.readFileSync(f, "utf8").replace(/^import [\s\S]*?;$/mg, "").replace(/\bexport\s+/g, "");
  const ctx = { crypto: require("crypto").webcrypto };
  vm.createContext(ctx);
  vm.runInContext(sin(path.join(SRC, "motor.js")) + "\n;globalThis.__J=JUEGOS;", ctx);
  vm.runInContext(sin(path.join(SRC, "salon-datos.js")) + "\n;globalThis.__S=SOLOS;", ctx);
  return { JUEGOS: ctx.__J, SOLOS: ctx.__S };
}

/* Todo el JavaScript de una carpeta: los .js y los <script> sueltos de sus
   páginas. Las pruebas y lo minificado (bibliotecas de fuera) no cuentan. */
function codigoDeCarpeta(dir) {
  const trozos = [];
  const recorre = d => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, n.name);
      if (n.isDirectory()) { if (!/^(node_modules|vendor|assets|cards|img|imagenes|audio)$/.test(n.name)) recorre(f); continue; }
      if (/\.(test|spec)\.c?js$|\.min\.js$/.test(n.name)) continue;
      if (/\.(m?js)$/.test(n.name)) trozos.push(fs.readFileSync(f, "utf8"));
      else if (/\.html$/.test(n.name)) {
        const html = fs.readFileSync(f, "utf8");
        for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) trozos.push(m[1]);
      }
    }
  };
  if (fs.existsSync(dir)) recorre(dir);
  return trozos;
}

/* Las fuentes de un juego, y de dónde salieron (para el informe). */
function fuentesDe(e) {
  const archivos = [], trozos = [];
  const modulo = id => {
    const f = path.join(SRC, id + ".js");
    if (!fs.existsSync(f)) return;
    const t = fs.readFileSync(f, "utf8");
    archivos.push(path.relative(RAIZ, f)); trozos.push(t);
    for (const m of t.matchAll(/["'`]juegos\/([\w-]+(?:\/[\w-]+)?)\/index\.html/g)) carpeta("juegos/" + m[1]);
  };
  const carpeta = rel => {
    const dir = path.join(RAIZ, rel);
    if (!fs.existsSync(dir) || archivos.includes(rel + "/")) return;
    archivos.push(rel + "/"); trozos.push(...codigoDeCarpeta(dir));
  };
  if (e.sala) modulo(e.id);
  else if (e.tipo === "bots") carpeta(path.dirname(e.url.split("?")[0]));
  else {
    const x = (/^#solo\/([\w-]+)$/.exec(e.ruta || "") || [])[1] || e.id;
    if (fs.existsSync(path.join(RAIZ, "juegos", "club", x))) carpeta("juegos/club/" + x);
    else modulo(x);
  }
  return { archivos, codigo: trozos.join("\n;\n") };
}

const SENALES = {
  toque: /\btouch(?:start|move|end)\b|pointer\s*:\s*coarse|\bmaxTouchPoints\b|\bontouchstart\b/,
  puntero: /\b(?:pointerdown|pointerup|pointermove|mousedown|mouseup)\b/,
  clic: /["'`]click["'`]|\.onclick\b|\bonclick\s*=/,
  teclas: /\bkey(?:down|up)\b/,
  mueve: /\b(?:ArrowLeft|ArrowRight|ArrowUp|ArrowDown|KeyW|KeyA|KeyS|KeyD)\b|keyCode\s*={2,3}\s*3[7-9]\b|\bcreateCursorKeys\b/,
  mira: /\brequestPointerLock\b|\bmovementX\b/
};
const NOMBRES = ["tactil", "raton", "teclado"];

/* La regla, pura: del código a {movil, pc, pide, por}. */
function clasifica(codigo) {
  const s = {};
  for (const k in SENALES) s[k] = SENALES[k].test(codigo);
  const marca = /@controles:\s*([a-zñ ,]+)/i.exec(codigo);
  if (marca) {
    const c = marca[1].toLowerCase().split(/[\s,]+/).filter(x => NOMBRES.includes(x));
    const movil = c.includes("tactil");
    return { movil, pc: c.includes("raton") || c.includes("teclado"),
      pide: movil ? "" : c.includes("raton") ? "teclado y ratón" : "teclado", por: "@controles: " + c.join(" ") };
  }
  const pc = s.teclas || s.puntero || s.clic;
  if (s.mira && !s.toque) return { movil: false, pc, pide: "teclado y ratón", por: "ratón de mira sin toque" };
  if (s.teclas && s.mueve && !s.toque && !s.puntero) return { movil: false, pc, pide: "teclado", por: "flechas o WASD sin toque ni puntero" };
  if (s.toque || s.puntero || s.clic) return { movil: true, pc, pide: "", por: s.toque ? "escucha toques" : s.puntero ? "escucha el puntero" : "escucha clics" };
  return { movil: false, pc, pide: "teclado", por: "no escucha toques ni clics" };
}

/* Todas las entradas del salón, con su clasificación. */
function detecta() {
  const { JUEGOS, SOLOS } = cargaTablas();
  const out = {};
  for (const id of Object.keys(JUEGOS)) out[id] = Object.assign(clasifica(fuentesDe({ id, sala: true }).codigo), { fuentes: fuentesDe({ id, sala: true }).archivos });
  for (const s of SOLOS) { const f = fuentesDe(s); out[s.id] = Object.assign(clasifica(f.codigo), { fuentes: f.archivos }); }
  return out;
}

function texto(tabla) {
  const filas = Object.keys(tabla).sort().map(id => {
    const { movil, pc, pide, por } = tabla[id];
    return `  ${JSON.stringify(id)}: ${JSON.stringify({ movil, pc, pide, por })}`;
  });
  return "/* Generado por colabtex/scripts/build-controles.js a partir del código de\n" +
    "   cada juego: no editar a mano (para corregir uno, `@controles:` en su\n" +
    "   código). `movil`: se juega con el dedo; `pc`: con teclado o ratón;\n" +
    "   `pide`: qué hace falta si no va en el celular; `por`: la señal que decidió. */\n" +
    "export const CONTROLES = {\n" + filas.join(",\n") + "\n};\n";
}

module.exports = { clasifica, detecta, fuentesDe, texto, SALIDA };

if (require.main === module) {
  const tabla = detecta();
  const vacios = Object.keys(tabla).filter(id => !tabla[id].fuentes.length);
  if (vacios.length) { console.error("build-controles: no encuentro el código de " + vacios.join(", ")); process.exit(1); }
  fs.writeFileSync(SALIDA, texto(tabla));
  const n = Object.values(tabla);
  console.log(`build-controles: ${n.length} juegos, ${n.filter(x => x.movil).length} en el celular, ${n.filter(x => x.pc).length} en el PC` +
    (process.argv.includes("-v") ? "\n" + Object.keys(tabla).sort().map(id => `  ${id.padEnd(14)} ${tabla[id].movil ? "celular" : "-------"} ${tabla[id].pc ? "pc" : "--"}  ${tabla[id].por}  [${tabla[id].fuentes.join(" ")}]`).join("\n") : ""));
}
