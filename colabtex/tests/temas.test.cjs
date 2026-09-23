/* El cancionero: que cada tema se lea entero. `pista` descarta en silencio
   una ficha que no entiende (una nota mal escrita, un acorde que no está en
   la tabla), así que un error de tecleo no rompe nada: simplemente esa nota
   no suena. Estas pruebas son el único sitio donde eso se ve. */
const test = require("node:test");
const assert = require("node:assert/strict");
const Chip = require("../../juegos/audio/chip.js");
const Temas = require("../../juegos/audio/temas.js");

const fichas = (txt, tipo) => {
  if (!txt) return [];
  if (tipo === "bat") return String(txt).replace(/\s+/g, "").split("");
  const out = [];
  for (const f of String(txt).trim().split(/\s+/)) {
    const m = /^(.+)\*(\d+)$/.exec(f);
    if (!m) { out.push(f); continue; }
    out.push(m[1]); for (let i = 1; i < +m[2]; i++) out.push(m[1] === "." ? "." : "-");
  }
  return out;
};
const sonoras = (txt, tipo) => fichas(txt, tipo).filter(f => f !== "-" && f !== ".").length;

test("temas: están los de cada juego y todos compilan", () => {
  for (const id of ["orbita", "cartas", "cuadritos", "reversi", "minas", "snake", "worms-menu", "worms-combate"])
    assert.ok(Temas.temas[id], "falta el tema " + id);
  for (const [id, c] of Object.entries(Temas.temas)) {
    assert.ok(c.bpm >= 60 && c.bpm <= 220, id + ": bpm " + c.bpm);
    const orden = Chip.compila(c);
    assert.ok(orden.length >= 1, id + ": orden vacío");
    const nombres = String(c.orden || Object.keys(c.secciones).join(" ")).trim().split(/\s+/);
    assert.equal(orden.length, nombres.length, id + ": el orden nombra una sección que no existe");
  }
});

test("temas: secciones de compases enteros y pistas que encajan", () => {
  for (const [id, c] of Object.entries(Temas.temas))
    for (const [nombre, s] of Object.entries(c.secciones)) {
      const donde = id + "/" + nombre;
      const largos = { lead: fichas(s.lead, "mel").length, bajo: fichas(s.bajo, "mel").length,
                       arp: fichas(s.arp, "arp").length, bat: fichas(s.bat, "bat").length };
      const largo = Math.max(s.pasos || 0, ...Object.values(largos));
      assert.equal(largo % 16, 0, donde + ": " + largo + " pasos no son compases enteros");
      /* Una pista más corta se repite: tiene que caber un número entero de
         veces, o su último pase se corta a mitad de figura. */
      for (const [canal, l] of Object.entries(largos))
        if (l) assert.equal(largo % l, 0, donde + "." + canal + " (" + l + ") no divide " + largo);
    }
});

test("temas: ninguna nota, acorde o golpe se pierde por mal escrito", () => {
  const oct = c => (c.arp && c.arp.oct) || 4;
  for (const [id, c] of Object.entries(Temas.temas))
    for (const [nombre, s] of Object.entries(c.secciones)) {
      const donde = id + "/" + nombre;
      for (const canal of ["lead", "bajo"])
        assert.equal(Chip.pista(s[canal], "mel").ev.length, sonoras(s[canal], "mel"), donde + "." + canal);
      assert.equal(Chip.pista(s.arp, "arp", oct(c)).ev.length, sonoras(s.arp, "arp"), donde + ".arp");
      for (const g of fichas(s.bat, "bat"))
        assert.ok("kshoxtT-.".includes(g), donde + ".bat: golpe desconocido «" + g + "»");
      for (const e of Chip.pista(s.lead, "mel").ev)
        assert.ok(e.v >= 36 && e.v <= 100, donde + ".lead: nota fuera de rango " + e.v);
    }
});
