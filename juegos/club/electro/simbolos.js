/* Electrodle: los símbolos esquemáticos del modo Símbolo, dibujados a mano
   en SVG sobre una caja de 120 × 80. Cada uno es trazo en `currentColor`,
   así que toma el color del tema. `foco` es el punto donde empieza el
   zoom: uno con trazo, para que el primer vistazo no sea un cuadro vacío,
   y lejos de las letras que lo regalarían (la M del motor).
   UMD: `ElectroSimbolos` en la página, `module.exports` en Node. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.ElectroSimbolos = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const r = n => Math.round(n * 100) / 100;
  const P = d => `<path d="${d}"/>`;
  const L = (x1, y1, x2, y2) => P(`M${x1} ${y1}L${x2} ${y2}`);
  const C = (cx, cy, rr) => `<circle cx="${cx}" cy="${cy}" r="${rr}"/>`;
  const PUNTO = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="2.4" fill="currentColor"/>`;
  const T = (x, y, t, s = 14) => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui,sans-serif" font-weight="700">${t}</text>`;
  /* Una flecha de (x1,y1) a (x2,y2) con la punta rellena en (x2,y2). */
  function F(x1, y1, x2, y2, punta = 6) {
    const a = Math.atan2(y2 - y1, x2 - x1), b = 0.45;
    const p1 = [x2 - punta * Math.cos(a - b), y2 - punta * Math.sin(a - b)];
    const p2 = [x2 - punta * Math.cos(a + b), y2 - punta * Math.sin(a + b)];
    return L(x1, y1, x2, y2) + `<path d="M${r(x2)} ${r(y2)}L${r(p1[0])} ${r(p1[1])}L${r(p2[0])} ${r(p2[1])}Z" fill="currentColor"/>`;
  }
  const ZIGZAG = "M30 40L35 30L45 50L55 30L65 50L75 30L85 50L90 40";
  const patas = (a, b) => L(5, 40, a, 40) + L(b, 40, 115, 40);
  const diodo = "M48 28L48 52L64 40Z";
  const RECT = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  /* Un transistor bipolar con el emisor saliendo (NPN), sin la pata de la
     base cuando la base es la luz. */
  const bipolar = conBase =>
    C(62, 40, 22) + L(52, 27, 52, 53) + (conBase ? L(5, 40, 52, 40) : "") +
    L(52, 34, 72, 22) + L(72, 22, 72, 4) + F(52, 46, 70, 57) + L(72, 58, 72, 76);

  const S = {
    resistencia: { foco: [58, 40], svg: patas(30, 90) + P(ZIGZAG) },
    potenciometro: { foco: [60, 50], svg: patas(30, 90) + P(ZIGZAG) + F(60, 78, 60, 54) },
    capacitor: { foco: [60, 40], svg: patas(55, 65) + L(55, 22, 55, 58) + L(65, 22, 65, 58) },
    electrolitico: { foco: [62, 40], svg: L(5, 40, 55, 40) + L(66, 40, 115, 40) + L(55, 22, 55, 58) + P("M71 22Q61 40 71 58") + T(45, 30, "+") },
    cvariable: { foco: [60, 40], svg: patas(55, 65) + L(55, 24, 55, 56) + L(65, 24, 65, 56) + F(40, 64, 82, 16) },
    inductor: { foco: [52, 36], svg: patas(30, 90) + P("M30 40a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0a7.5 7.5 0 0 1 15 0") },
    transformador: { foco: [56, 30], svg:
      P("M45 15a6.25 6.25 0 0 1 0 12.5a6.25 6.25 0 0 1 0 12.5a6.25 6.25 0 0 1 0 12.5a6.25 6.25 0 0 1 0 12.5") +
      P("M75 15a6.25 6.25 0 0 0 0 12.5a6.25 6.25 0 0 0 0 12.5a6.25 6.25 0 0 0 0 12.5a6.25 6.25 0 0 0 0 12.5") +
      L(57, 12, 57, 68) + L(63, 12, 63, 68) + L(10, 15, 45, 15) + L(10, 65, 45, 65) + L(75, 15, 110, 15) + L(75, 65, 110, 65) },
    cristal: { foco: [52, 40], svg: patas(45, 75) + L(45, 26, 45, 54) + L(75, 26, 75, 54) + RECT(51, 22, 18, 36) },
    fusible: { foco: [60, 40], svg: patas(35, 85) + RECT(35, 32, 50, 16) + L(35, 40, 85, 40) },
    varistor: { foco: [62, 38], svg: patas(35, 85) + RECT(35, 30, 50, 20) + P("M28 64L40 64L90 16") + T(98, 70, "U") },
    termistor: { foco: [62, 38], svg: patas(35, 85) + RECT(35, 30, 50, 20) + P("M28 64L40 64L90 16") + T(98, 70, "t°") },
    ldr: { foco: [58, 38], svg: patas(35, 85) + RECT(35, 30, 50, 20) + F(26, 4, 44, 24) + F(42, 2, 60, 22) },
    diodo: { foco: [56, 40], svg: patas(48, 64) + P(diodo) + L(64, 28, 64, 52) },
    zener: { foco: [62, 42], svg: patas(48, 64) + P(diodo) + P("M58 24L64 28L64 52L70 56") },
    led: { foco: [56, 40], svg: patas(48, 64) + P(diodo) + L(64, 28, 64, 52) + F(58, 22, 72, 8) + F(68, 24, 82, 10) },
    fotodiodo: { foco: [56, 40], svg: patas(48, 64) + P(diodo) + L(64, 28, 64, 52) + F(84, 6, 70, 20) + F(94, 12, 80, 26) },
    schottky: { foco: [64, 46], svg: patas(48, 64) + P(diodo) + P("M70 32L70 28L64 28L64 52L58 52L58 48") },
    bjt: { foco: [56, 40], svg: bipolar(true) },
    mosfet: { foco: [52, 40], svg: L(5, 54, 46, 54) + L(46, 26, 46, 54) + L(54, 22, 54, 32) + L(54, 35, 54, 45) + L(54, 48, 54, 58) +
      L(54, 28, 74, 28) + L(74, 28, 74, 4) + L(54, 52, 74, 52) + L(74, 52, 74, 76) + L(74, 40, 74, 52) + F(74, 40, 56, 40) },
    jfet: { foco: [54, 46], svg: L(54, 22, 54, 58) + L(54, 28, 78, 28) + L(78, 28, 78, 4) + L(54, 52, 78, 52) + L(78, 52, 78, 76) + F(5, 48, 53, 48) },
    igbt: { foco: [52, 40], svg: L(5, 54, 46, 54) + L(46, 26, 46, 54) + L(54, 22, 54, 58) + L(54, 30, 74, 20) + L(74, 20, 74, 4) +
      F(54, 50, 72, 59) + L(74, 60, 74, 76) },
    tiristor: { foco: [62, 46], svg: patas(48, 64) + P(diodo) + L(64, 28, 64, 52) + L(64, 46, 78, 62) + L(78, 62, 78, 78) },
    triac: { foco: [60, 40], svg: patas(48, 72) + L(48, 20, 48, 60) + L(72, 20, 72, 60) + P("M48 22L48 40L72 31Z") + P("M72 40L72 58L48 49Z") +
      L(72, 56, 84, 68) + L(84, 68, 84, 78) },
    diac: { foco: [60, 40], svg: patas(48, 72) + L(48, 20, 48, 60) + L(72, 20, 72, 60) + P("M48 22L48 40L72 31Z") + P("M72 40L72 58L48 49Z") },
    optoacoplador: { foco: [50, 40], svg: `<rect x="12" y="8" width="90" height="64" stroke-dasharray="4 3"/>` +
      L(32, 2, 32, 30) + P("M24 30L40 30L32 44Z") + L(24, 44, 40, 44) + L(32, 44, 32, 78) +
      F(44, 34, 58, 34) + F(44, 44, 58, 44) + L(66, 26, 66, 54) + L(66, 32, 86, 20) + L(86, 20, 86, 2) + F(66, 48, 84, 59) + L(86, 60, 86, 78) },
    fototransistor: { foco: [54, 34], svg: bipolar(false) + F(14, 6, 36, 26) + F(6, 20, 32, 36) },
    opamp: { foco: [40, 40], svg: P("M35 10L35 70L95 40Z") + L(5, 25, 35, 25) + L(5, 55, 35, 55) + L(95, 40, 115, 40) + T(43, 30, "−", 16) + T(43, 60, "+", 16) },
    nand: { foco: [78, 40], svg: P("M30 15L60 15A25 25 0 0 1 60 65L30 65Z") + C(90, 40, 5) + L(95, 40, 115, 40) + L(5, 28, 30, 28) + L(5, 52, 30, 52) },
    rele: { foco: [30, 40], svg: RECT(15, 25, 20, 30) + L(25, 5, 25, 25) + L(25, 55, 25, 75) + L(19, 50, 31, 30) +
      `<path d="M35 40L80 40" stroke-dasharray="4 3"/>` + PUNTO(70, 60) + L(70, 60, 70, 76) + L(70, 60, 90, 26) + L(94, 24, 112, 24) + L(94, 60, 112, 60) },
    interruptor: { foco: [56, 34], svg: patas(40, 80) + PUNTO(40, 40) + PUNTO(80, 40) + L(40, 40, 76, 20) },
    motor: { foco: [40, 32], svg: patas(40, 80) + C(60, 40, 20) + T(60, 47, "M", 20) },
    parlante: { foco: [54, 32], svg: L(5, 34, 40, 34) + L(5, 46, 40, 46) + RECT(40, 28, 12, 24) + P("M52 28L74 10L74 70L52 52") },
    microfono: { foco: [46, 32], svg: L(5, 40, 44, 40) + L(44, 22, 44, 58) + C(62, 40, 18) + L(62, 58, 62, 78) },
    bateria: { foco: [60, 40], svg: patas(40, 80) + L(40, 22, 40, 58) + L(48, 31, 48, 49) + L(56, 22, 56, 58) + L(64, 31, 64, 49) +
      L(72, 22, 72, 58) + L(80, 31, 80, 49) + T(34, 22, "+") },
    celdasolar: { foco: [60, 40], svg: patas(54, 66) + L(54, 24, 54, 56) + L(66, 32, 66, 48) + C(60, 40, 22) + F(12, 2, 36, 22) + F(28, 0, 48, 16) },
    termopar: { foco: [70, 52], svg: L(10, 16, 70, 52) + `<path d="M10 70L70 52" stroke-width="5"/>` + PUNTO(70, 52) + L(70, 52, 110, 52) },
    triodo: { foco: [60, 40], svg: C(60, 40, 30) + L(48, 22, 72, 22) + L(60, 22, 60, 2) + `<path d="M40 40L80 40" stroke-dasharray="4 4"/>` +
      L(5, 40, 30, 40) + P("M46 62L46 58L74 58") + L(60, 58, 60, 78) },
    antena: { foco: [60, 26], svg: L(60, 78, 60, 30) + P("M60 30L38 8L82 8Z") }
  };

  return { SIMBOLOS: S, ANCHO: 120, ALTO: 80 };
});
