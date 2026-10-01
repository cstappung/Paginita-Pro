/* Electrodle: los tres retos que no son «adivina cuál es», puros.
   - Bandas: un Mastermind del código de colores de una resistencia.
   - Circuito: calcular una corriente, un voltaje o una resistencia
     equivalente de un circuito dibujado.
   - Conexiones: separar 16 fichas en cuatro grupos de cuatro.
   Cada reto sale de una semilla entera: la del día viene de la fecha y la
   de la práctica, del azar. Sin DOM, para comprobarlo desde Node
   (tests/electro.test.cjs). UMD: `ElectroRetos` en la página, `module.exports`
   en Node. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.ElectroRetos = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const elige = (l, rng) => l[Math.floor(rng() * l.length)];
  function baraja(lista, rng) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /* Tres cifras significativas, con coma decimal. */
  const num = x => Number(Number(x).toPrecision(3)).toLocaleString("es-CL", { maximumFractionDigits: 3 });
  function ohmios(r) {
    if (r >= 1e6) return `${num(r / 1e6)} MΩ`;
    if (r >= 1e3) return `${num(r / 1e3)} kΩ`;
    return `${num(r)} Ω`;
  }

  /* ================= Bandas =================
     Una resistencia de cuatro bandas: dos cifras, multiplicador y
     tolerancia. El código es una cadena de cuatro caracteres, cada uno el
     índice del color en base 12 («472a» = amarillo, violeta, rojo, dorado
     = 4,7 kΩ ±5 %). El objetivo siempre es de la serie E12. */
  const COLORES = [
    { n: "Negro", c: "#1b1b1b" }, { n: "Café", c: "#7a4a1e" }, { n: "Rojo", c: "#d32f2f" },
    { n: "Naranjo", c: "#f57c00" }, { n: "Amarillo", c: "#fbc02d" }, { n: "Verde", c: "#2e7d32" },
    { n: "Azul", c: "#1565c0" }, { n: "Violeta", c: "#7b1fa2" }, { n: "Gris", c: "#8d8d8d" },
    { n: "Blanco", c: "#f4f4f4" }, { n: "Dorado", c: "#c9a227" }, { n: "Plateado", c: "#b9c2cb" }
  ];
  const TOLERANCIA = { 1: 1, 2: 2, 10: 5, 11: 10 };   // color → ±%
  /* Los colores que admite cada banda. */
  const PERMITIDOS = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3, 4, 5, 6], [1, 2, 10, 11]];
  const NOMBRE_BANDA = ["1.ª cifra", "2.ª cifra", "Multiplicador", "Tolerancia"];
  const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  const INTENTOS_BANDAS = 6;
  const deCodigo = s => String(s).split("").map(ch => parseInt(ch, 12));
  const aCodigo = l => l.map(i => i.toString(12)).join("");
  const codigoValido = s => typeof s === "string" && s.length === 4 && deCodigo(s).every((c, i) => PERMITIDOS[i].includes(c));
  const valor = s => { const [a, b, m] = deCodigo(s); return (10 * a + b) * Math.pow(10, m); };
  const textoBandas = s => `${ohmios(valor(s))} ±${TOLERANCIA[deCodigo(s)[3]]} %`;
  function bandasDe(semilla) {
    const r = mulberry32(semilla), m = elige(E12, r);
    return aCodigo([Math.floor(m / 10), m % 10, Math.floor(r() * 6), elige(PERMITIDOS[3], r)]);
  }
  /* Como Wordle: verde en su lugar; amarillo, el color está en otra banda
     (contando cuántas veces está); gris, no está. La flecha compara solo
     el valor, sin la tolerancia. */
  function comparaBandas(intento, objetivo) {
    const a = deCodigo(intento), o = deCodigo(objetivo), e = ["no", "no", "no", "no"], resto = [];
    a.forEach((c, i) => { if (c === o[i]) e[i] = "si"; else resto.push(o[i]); });
    a.forEach((c, i) => { if (e[i] === "si") return; const k = resto.indexOf(c); if (k >= 0) { e[i] = "casi"; resto.splice(k, 1); } });
    const va = valor(intento), vo = valor(objetivo);
    return { e, flecha: vo > va ? "↑" : vo < va ? "↓" : "=" };
  }

  /* ================= Circuito =================
     Cinco topologías de resistencias con una fuente. Se pide la corriente
     de la fuente, la resistencia que ve la fuente o un voltaje. */
  const VALORES_R = [100, 150, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 6800, 10000];
  const FUENTES = [5, 9, 12, 15, 24];
  const INTENTOS_CIRCUITO = 6;
  const par = (a, b) => a * b / (a + b);
  const TOPOLOGIAS = {
    serieparalelo: { n: 3, req: R => R[0] + par(R[1], R[2]),
      v: (V, R) => ({ et: "V₂", val: V * par(R[1], R[2]) / (R[0] + par(R[1], R[2])), dice: "el voltaje en R2 y R3, que están en paralelo", como: "I · (R2 ∥ R3)" }),
      pasos: R => [`R2 ∥ R3 = ${ohmios(par(R[1], R[2]))}`, `Req = R1 + R2 ∥ R3 = ${ohmios(R[0] + par(R[1], R[2]))}`] },
    divisor: { n: 3, req: R => R[0] + par(R[1], R[2]),
      v: (V, R) => ({ et: "Vout", val: V * par(R[1], R[2]) / (R[0] + par(R[1], R[2])), dice: "Vout, el voltaje en la carga R3", como: "I · (R2 ∥ R3)" }),
      pasos: R => [`R2 ∥ R3 = ${ohmios(par(R[1], R[2]))}`, `Req = R1 + R2 ∥ R3 = ${ohmios(R[0] + par(R[1], R[2]))}`] },
    paralelo: { n: 3, req: R => 1 / (1 / R[0] + 1 / R[1] + 1 / R[2]),
      pasos: R => [`1/Req = 1/R1 + 1/R2 + 1/R3`, `Req = ${ohmios(1 / (1 / R[0] + 1 / R[1] + 1 / R[2]))}`] },
    escalera: { n: 4, req: R => R[0] + par(R[1], R[2] + R[3]),
      v: (V, R) => { const ra = par(R[1], R[2] + R[3]), va = V * ra / (R[0] + ra);
        return { et: "V₄", val: va * R[3] / (R[2] + R[3]), dice: "el voltaje en R4", como: `V₂ · R4 / (R3 + R4), con V₂ = I · (R2 ∥ (R3 + R4)) = ${num(va)} V` }; },
      pasos: R => [`R3 + R4 = ${ohmios(R[2] + R[3])}`, `R2 ∥ (R3 + R4) = ${ohmios(par(R[1], R[2] + R[3]))}`, `Req = R1 + R2 ∥ (R3 + R4) = ${ohmios(R[0] + par(R[1], R[2] + R[3]))}`] },
    serie: { n: 3, req: R => R[0] + R[1] + R[2],
      v: (V, R) => ({ et: "V₂", val: V * R[1] / (R[0] + R[1] + R[2]), dice: "el voltaje en R2", como: "I · R2" }),
      pasos: R => [`Req = R1 + R2 + R3 = ${ohmios(R[0] + R[1] + R[2])}`] }
  };
  function circuitoDe(semilla) {
    const r = mulberry32(semilla), topo = elige(Object.keys(TOPOLOGIAS), r), T = TOPOLOGIAS[topo];
    const R = Array.from({ length: T.n }, () => elige(VALORES_R, r)), V = elige(FUENTES, r);
    const req = T.req(R), opciones = ["I", "Req"].concat(T.v ? ["V"] : []);
    const pide = topo === "divisor" ? "V" : elige(opciones, r);
    let resp, unidad, et, dice, pasos = T.pasos(R);
    if (pide === "I") { resp = V / req * 1000; unidad = "mA"; et = "I"; dice = "la corriente que entrega la fuente"; pasos = pasos.concat(`I = V / Req = ${V} V / ${ohmios(req)} = ${num(resp)} mA`); }
    else if (pide === "Req") { unidad = req >= 1000 ? "kΩ" : "Ω"; resp = unidad === "kΩ" ? req / 1000 : req; et = "Req"; dice = "la resistencia equivalente que ve la fuente"; }
    else {
      const v = T.v(V, R); resp = v.val; unidad = "V"; et = v.et; dice = v.dice;
      pasos = pasos.concat(`I = V / Req = ${num(V / req * 1000)} mA`, `${et} = ${v.como} = ${num(resp)} V`);
    }
    return { topo, R, V, pide, et, dice, unidad, resp, pasos };
  }
  /* Un número escrito con coma o punto; nada más. */
  function leeNumero(s) {
    const t = String(s == null ? "" : s).trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t) || t.length > 14) return NaN;
    return parseFloat(t);
  }
  /* Verde a menos de 1,5 % (el redondeo de tres cifras cabe), amarillo a
     menos de 10 %; la flecha dice hacia dónde está la respuesta. */
  function evaluaCircuito(intento, resp) {
    const x = leeNumero(intento);
    if (!Number.isFinite(x)) return null;
    const err = (x - resp) / resp, a = Math.abs(err);
    return { e: a <= 0.015 ? "si" : a <= 0.10 ? "casi" : "no", flecha: a <= 0.015 ? "" : resp > x ? "↑" : "↓", err };
  }

  /* ================= Conexiones =================
     Cada día salen cuatro grupos, uno de cada nivel (1 fácil … 4 retorcido),
     y cuatro fichas de cada uno. Ninguna ficha se repite en todo el banco,
     así que la solución es única; `choca` separa grupos que el mismo día
     se prestarían a confusión (Ohm el apellido y Ohmio la unidad). */
  const GRUPOS = [
    { id: "unidades", nivel: 1, t: "Unidades del SI", f: ["Ohmio", "Voltio", "Amperio", "Faradio", "Henrio", "Vatio", "Hercio", "Culombio"], choca: ["apellidos"] },
    { id: "prefijos", nivel: 1, t: "Prefijos del SI", f: ["Kilo", "Mega", "Giga", "Mili", "Micro", "Nano", "Pico", "Tera"] },
    { id: "instrumentos", nivel: 1, t: "Instrumentos de medida", f: ["Multímetro", "Osciloscopio", "Amperímetro", "Voltímetro", "Óhmetro", "Vatímetro", "Frecuencímetro"] },
    { id: "renovables", nivel: 1, t: "Energías renovables", f: ["Solar", "Eólica", "Hidráulica", "Geotérmica", "Mareomotriz", "Biomasa"] },
    { id: "compuertas", nivel: 2, t: "Compuertas lógicas", f: ["AND", "OR", "NAND", "NOR", "XOR", "XNOR", "NOT"] },
    { id: "protocolos", nivel: 2, t: "Protocolos de comunicación", f: ["I2C", "SPI", "UART", "CAN", "USB", "Ethernet", "RS-232", "Bluetooth"], choca: ["familias"] },
    { id: "ondas", nivel: 2, t: "Formas de onda", f: ["Senoidal", "Cuadrada", "Triangular", "Diente de sierra", "Pulso"] },
    { id: "semiconductores", nivel: 2, t: "Materiales semiconductores", f: ["Silicio", "Germanio", "Arseniuro de galio", "Carburo de silicio", "Nitruro de galio"] },
    { id: "terminales", nivel: 3, t: "Terminales de un transistor", f: ["Base", "Colector", "Emisor", "Compuerta", "Drenador", "Surtidor"] },
    { id: "motor", nivel: 3, t: "Partes de un motor", f: ["Rotor", "Estator", "Escobillas", "Conmutador", "Devanado", "Entrehierro"] },
    { id: "metales", nivel: 3, t: "Metales conductores", f: ["Cobre", "Plata", "Oro", "Aluminio", "Latón"] },
    { id: "capacitores", nivel: 3, t: "Tipos de capacitor", f: ["Cerámico", "Electrolítico", "Tantalio", "Poliéster", "Mica"] },
    { id: "colores", nivel: 4, t: "Colores del código de resistencias", f: ["Café", "Naranjo", "Violeta", "Gris", "Dorado", "Plateado", "Amarillo"] },
    { id: "apellidos", nivel: 4, t: "Apellidos con ley propia", f: ["Ohm", "Kirchhoff", "Lenz", "Coulomb", "Faraday", "Joule", "Ampère"], choca: ["unidades"] },
    { id: "filtros", nivel: 4, t: "Respuestas de filtro", f: ["Butterworth", "Chebyshev", "Bessel", "Elíptico", "Gaussiano"] },
    { id: "familias", nivel: 4, t: "Familias lógicas", f: ["TTL", "CMOS", "ECL", "RTL", "DTL"], choca: ["protocolos"] }
  ];
  const MAX_ERRORES = 4;
  function conexionesDe(semilla) {
    const r = mulberry32(semilla);
    let grupos;
    for (let k = 0; k < 50; k++) {
      grupos = [1, 2, 3, 4].map(n => elige(GRUPOS.filter(g => g.nivel === n), r));
      if (!grupos.some(g => (g.choca || []).some(c => grupos.some(h => h.id === c)))) break;
    }
    const sel = grupos.map(g => ({ id: g.id, t: g.t, nivel: g.nivel, f: baraja(g.f, r).slice(0, 4) }));
    return { grupos: sel, fichas: baraja(sel.flatMap(g => g.f), r) };
  }
  /* Un intento son cuatro índices de ficha, ordenados: «0-3-7-12». */
  const intentoValido = s => typeof s === "string" && /^\d{1,2}(-\d{1,2}){3}$/.test(s) &&
    (l => new Set(l).size === 4 && l.every(i => i >= 0 && i < 16) && l.join("-") === s)(s.split("-").map(Number).sort((a, b) => a - b));
  const claveIntento = l => l.slice().sort((a, b) => a - b).join("-");
  /* Qué grupo es un intento (o −1) y cuántas fichas tiene del que más tiene. */
  function evaluaConexiones(c, intento) {
    const idx = intento.split("-").map(Number), nombres = idx.map(i => c.fichas[i]);
    let mejor = 0, grupo = -1;
    c.grupos.forEach((g, k) => { const n = nombres.filter(x => g.f.includes(x)).length; if (n > mejor) mejor = n; if (n === 4) grupo = k; });
    return { grupo, mejor };
  }
  function estadoConexiones(c, intentos) {
    const hallados = [], errores = [];
    for (const s of intentos) { const v = evaluaConexiones(c, s); if (v.grupo >= 0) { if (!hallados.includes(v.grupo)) hallados.push(v.grupo); } else errores.push(s); }
    return { hallados, errores: errores.length, gano: hallados.length === 4, perdio: errores.length >= MAX_ERRORES };
  }

  return {
    mulberry32, ohmios, num,
    COLORES, TOLERANCIA, PERMITIDOS, NOMBRE_BANDA, E12, INTENTOS_BANDAS, deCodigo, aCodigo, codigoValido, valor, textoBandas, bandasDe, comparaBandas,
    TOPOLOGIAS, INTENTOS_CIRCUITO, circuitoDe, leeNumero, evaluaCircuito,
    GRUPOS, MAX_ERRORES, conexionesDe, intentoValido, claveIntento, evaluaConexiones, estadoConexiones
  };
});
