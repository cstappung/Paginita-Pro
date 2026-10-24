/* El modo Halloween del salón (src/juegos/halloween.js): cuándo se enciende,
   la cuenta atrás de la cinta, y que el script en línea del <head> de
   juegos.html —que lo pone antes de pintar— diga lo mismo que el módulo
   todos los días del año. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const sin = f => fs.readFileSync(f, "utf8").replace(/^import [\s\S]*?;$/mg, "").replace(/\bexport\s+/g, "");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(sin("src/juegos/halloween.js") + "\n;globalThis.__H={enTemporada,cuentaHalloween,estadoHalloween};", ctx);
const H = ctx.__H;
const fecha = (m, d, h = 12) => new Date(2026, m - 1, d, h);

test("halloween: del 1 de octubre al 1 de noviembre, los dos incluidos", () => {
  assert.equal(H.enTemporada(fecha(9, 30, 23)), false);
  assert.equal(H.enTemporada(fecha(10, 1, 0)), true);
  assert.equal(H.enTemporada(fecha(10, 19)), true);
  assert.equal(H.enTemporada(fecha(10, 31, 23)), true);
  assert.equal(H.enTemporada(fecha(11, 1, 23)), true);
  assert.equal(H.enTemporada(fecha(11, 2, 0)), false, "el 2 de noviembre se apaga solo");
  assert.equal(H.enTemporada(fecha(12, 25)), false);
  assert.equal(H.enTemporada(fecha(1, 1)), false);
});

test("halloween: la elección guardada y la URL", () => {
  assert.equal(H.estadoHalloween(fecha(10, 10), "", ""), "on");
  assert.equal(H.estadoHalloween(fecha(10, 10), "no", ""), "off");
  assert.equal(H.estadoHalloween(fecha(10, 10), "si", ""), "on");
  assert.equal(H.estadoHalloween(fecha(6, 10), "", ""), "");
  assert.equal(H.estadoHalloween(fecha(6, 10), "", "?halloween=1"), "on");
  assert.equal(H.estadoHalloween(fecha(10, 10), "", "?x=2&halloween=0"), "");
});

test("halloween: la cuenta atrás", () => {
  assert.equal(H.cuentaHalloween(fecha(10, 19)), "Faltan 12 noches para Halloween");
  assert.equal(H.cuentaHalloween(fecha(10, 30)), "Mañana es Halloween: queda 1 noche");
  assert.match(H.cuentaHalloween(fecha(10, 31)), /Esta noche es Halloween/);
  assert.match(H.cuentaHalloween(fecha(11, 1)), /Todos los Santos/);
});

test("halloween: el script del <head> dice lo mismo que el módulo", () => {
  const html = fs.readFileSync("../juegos.html", "utf8");
  const m = /\(function \(\) \{ var f = \/\[\?&\]halloween[\s\S]*?\}\)\(\);/.exec(html);
  assert.ok(m, "no encuentro el script del modo Halloween en juegos.html");
  const corre = (f, guardado, busqueda) => {
    const raiz = { dataset: {} };
    /* El ícono de la pestaña: se cambia solo con el modo encendido. */
    const icono = { href: "marca/favicon-32.png", getAttribute: () => "marca/favicon-halloween-32.png" };
    const RealDate = Date;
    const c = {
      location: { search: busqueda },
      localStorage: { getItem: () => guardado || null },
      document: { documentElement: raiz, querySelectorAll: () => [icono] },
      Date: function () { return new RealDate(f.getTime()); },
    };
    vm.runInNewContext(m[0], c);
    assert.equal(icono.href.includes("halloween"), raiz.dataset.halloween === "on", "el favicon sigue al modo");
    return raiz.dataset.halloween || "";
  };
  for (let d = new Date(2026, 0, 1, 12); d.getFullYear() === 2026; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12))
    for (const g of ["", "no"])
      for (const q of ["", "?halloween=1", "?halloween=0"])
        assert.equal(corre(d, g, q), H.estadoHalloween(d, g, q), d.toDateString() + " " + g + " " + q);
});

/* Los selectores de una regla, separados por las comas de fuera de un `:is()`. */
const partes = sel => {
  const out = []; let n = 0, ini = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === "(") n++; else if (sel[i] === ")") n--;
    else if (sel[i] === "," && !n) { out.push(sel.slice(ini, i)); ini = i + 1; }
  }
  return out.concat(sel.slice(ini));
};

test("halloween: toda la piel cuelga del atributo (fuera de temporada no cambia nada)", () => {
  const html = fs.readFileSync("../juegos.html", "utf8");
  const ini = html.indexOf("Modo Halloween (juegos/halloween.js)");
  assert.ok(ini > 0);
  const bloque = html.slice(html.indexOf("*/", ini) + 2, html.indexOf("</style>", ini)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\("[^"]*"\)/g, "url()");
  /* Cada regla tiene que exigir `data-halloween` o ser una pieza propia
     del modo (`.jg-hw*`, `.hw-*`), que fuera de temporada no existe. */
  const reglas = bloque.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "").replace(/@media[^{]*\{/g, "").match(/[^{}]+(?=\{)/g);
  for (const sel of reglas.map(s => s.trim()).filter(Boolean))
    for (const parte of partes(sel))
      assert.match(parte.trim(), /data-halloween|^\.jg-hw|^\.hw-|^html\[data-tema=oscuro\] \.hw-|^html\.jg-rieles \.hw-/, "regla sin el atributo: " + parte.trim());
});
