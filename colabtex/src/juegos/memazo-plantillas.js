/* Memazo — las plantillas.
 *
 * Son dibujos propios, no fotos de memes: cada una recuerda un formato
 * conocido (el sí y el no, los dos botones, el cerebro que crece…) con
 * figuras planas y emojis, que el sistema de cada uno ya trae. Nada que
 * alojar, nada con derechos de otro, y nítido a cualquier tamaño.
 *
 * Una plantilla es `{nombre, w, h, arte, cajas}`: `arte` es el cuerpo de
 * un SVG de `w`×`h` y cada caja es un rectángulo en % del meme, con su
 * estilo `e`:
 *   imp  blanco con contorno negro, en mayúsculas (el de siempre)
 *   neg  negro sobre claro       bur  negro, dentro de un globo
 *   bla  blanco sin contorno     fin  negro con serifa, en cursiva
 * `t` es el tamaño máximo de la letra (en % del ancho del meme); se
 * achica hasta que el texto quepa (`ajustaTextos`). Una caja con `de: i`
 * repite el texto i: en «El plan» el cuarto cuadro es el tercero.
 *
 * Cuántos textos lleva cada una lo dice también `MZ_PLANTILLAS` en
 * motor.js, que es quien valida la jugada; el test comprueba que coincidan.
 */
const FE = `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"`;
const n1 = x => Math.round(x * 10) / 10;
/* Un emoji centrado en (x,y); `v` lo voltea, `g` lo gira. */
const E = (x, y, s, ch, { v = false, g = 0 } = {}) =>
  `<g transform="translate(${n1(x)} ${n1(y)})${g ? ` rotate(${g})` : ""}${v ? " scale(-1 1)" : ""}"><text ${FE} font-size="${s}" text-anchor="middle" dominant-baseline="central">${ch}</text></g>`;
const R = (x, y, w, h, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const T = (x, y, s, t, fill = "#fff", extra = "") =>
  `<text x="${x}" y="${y}" font-size="${s}" fill="${fill}" text-anchor="middle" font-family="Anton,Impact,'Arial Black',sans-serif" ${extra}>${t}</text>`;
const globo = (cx, cy, rx, ry, px, py) =>
  `<path d="M${cx - rx * .3} ${cy + ry * .8} L${px} ${py} L${cx + rx * .15} ${cy + ry * .9}Z" fill="#fff" stroke="#111" stroke-width="4"/>` +
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="#111" stroke-width="4"/>` +
  `<path d="M${cx - rx * .3} ${cy + ry * .78} L${cx + rx * .15} ${cy + ry * .88}" stroke="#fff" stroke-width="6"/>`;
const linea = (x1, y1, x2, y2, c = "#111", w = 6) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const estrellas = (n, w, h, sem) => {
  let s = sem, out = "";
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) out += `<circle cx="${n1(r() * w)}" cy="${n1(r() * h)}" r="${n1(.8 + r() * 2.2)}" fill="#fff" opacity="${n1(.4 + r() * .6)}"/>`;
  return out;
};
const llamas = (xs, y, s) => xs.map((x, i) => E(x, y - (i % 2) * s * .25, s * (1 - (i % 3) * .12), "🔥")).join("");
const rayas = (x, y, n, c = "#fff8") => Array.from({ length: n }, (_, i) => linea(x, y + i * 18, x - 60 - i * 10, y + i * 18, c, 5)).join("");

export const PLANTILLAS = {
  sino: {
    nombre: "Sí y no", w: 600, h: 600,
    arte: R(0, 0, 600, 600, "#fff") + R(0, 0, 240, 300, "#f6c75a") + R(0, 300, 240, 300, "#8fd1b0") +
      E(120, 150, 150, "🙅") + E(95, 450, 140, "😏") + E(195, 485, 80, "👉") + linea(0, 300, 600, 300, "#222", 4) + linea(240, 0, 240, 600, "#222", 4),
    cajas: [
      { x: 42, y: 3, w: 55, h: 44, e: "neg" },
      { x: 42, y: 53, w: 55, h: 44, e: "neg" }
    ]
  },
  botones: {
    nombre: "Dos botones", w: 600, h: 720,
    arte: R(0, 0, 600, 440, "#d9e3ee") + R(60, 210, 480, 200, "#56606e", `rx="18"`) + R(70, 220, 460, 180, "#6d7887", `rx="14"`) +
      [[180, 300], [420, 290]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 16}" rx="80" ry="40" fill="#7a1010"/><ellipse cx="${x}" cy="${y}" rx="80" ry="40" fill="#e52a2a"/><ellipse cx="${x - 22}" cy="${y - 12}" rx="26" ry="10" fill="#fff" opacity=".45"/>`).join("") +
      R(24, 40, 250, 110, "#fff", `rx="8" stroke="#333" stroke-width="3" transform="rotate(-4 149 95)"`) + R(320, 26, 250, 110, "#fff", `rx="8" stroke="#333" stroke-width="3" transform="rotate(3 445 81)"`) +
      E(300, 170, 80, "👆", { g: 10 }) + R(0, 440, 600, 280, "#f3d9c0") + E(300, 585, 210, "😰") + E(420, 500, 60, "💦"),
    cajas: [
      { x: 6, y: 7, w: 38, h: 12, e: "neg", t: 7 },
      { x: 55, y: 5, w: 38, h: 12, e: "neg", t: 7 },
      { x: 3, y: 86, w: 94, h: 12, e: "imp" }
    ]
  },
  cerebro: {
    nombre: "Cerebro que crece", w: 600, h: 800,
    arte: R(0, 0, 600, 800, "#fff") + [["#d6d6d6", 70, ""], ["#8ab4f8", 92, "✨"], ["#7b5cff", 112, "⚡"], ["#ffdd55", 132, "🌌"]].map(([c, s, x], k) =>
      R(310, k * 200, 290, 200, c) + (k === 3 ? `<circle cx="455" cy="700" r="95" fill="#fff" opacity=".55"/>` : "") +
      E(455, k * 200 + 100, s, "🧠") + (x ? E(375, k * 200 + 40, 44, x) + E(545, k * 200 + 160, 40, x) : "")).join("") +
      [200, 400, 600].map(y => linea(0, y, 600, y, "#222", 4)).join("") + linea(310, 0, 310, 800, "#222", 4),
    cajas: [
      { x: 2, y: 1, w: 48, h: 23, e: "neg", t: 7 },
      { x: 2, y: 26, w: 48, h: 23, e: "neg", t: 7 },
      { x: 2, y: 51, w: 48, h: 23, e: "neg", t: 7 },
      { x: 2, y: 76, w: 48, h: 23, e: "neg", t: 7 }
    ]
  },
  todobien: {
    nombre: "Todo bien", w: 640, h: 460,
    arte: R(0, 0, 640, 460, "#e89a3c") + R(0, 330, 640, 130, "#a8562a") + `<ellipse cx="200" cy="80" rx="160" ry="50" fill="#5b4a44" opacity=".55"/><ellipse cx="470" cy="60" rx="150" ry="40" fill="#5b4a44" opacity=".45"/>` +
      llamas([40, 120, 560, 610], 300, 110) + llamas([90, 520], 400, 80) + R(250, 300, 200, 22, "#6b3b1f") + R(270, 320, 14, 90, "#6b3b1f") + R(416, 320, 14, 90, "#6b3b1f") +
      E(330, 240, 150, "🐶") + E(415, 280, 60, "☕"),
    cajas: [
      { x: 3, y: 3, w: 94, h: 22, e: "imp" },
      { x: 3, y: 77, w: 94, h: 20, e: "imp" }
    ]
  },
  distraido: {
    nombre: "El distraído", w: 720, h: 480,
    arte: R(0, 0, 720, 480, "#b9d7ea") + R(0, 60, 150, 280, "#9aaab8") + R(170, 20, 120, 320, "#a7b5c2") + R(560, 40, 160, 300, "#98a7b5") + R(0, 340, 720, 140, "#c9c2b4") +
      E(150, 300, 230, "💃") + E(390, 270, 210, "😍", { v: true }) + E(600, 280, 190, "😠"),
    cajas: [
      { x: 3, y: 74, w: 34, h: 22, e: "imp" },
      { x: 38, y: 74, w: 25, h: 22, e: "imp" },
      { x: 66, y: 74, w: 31, h: 22, e: "imp" }
    ]
  },
  gritogato: {
    nombre: "Grito y gato", w: 800, h: 400,
    arte: R(0, 0, 400, 400, "#cdb48c") + R(0, 290, 400, 110, "#a98d63") + E(150, 250, 190, "😭") + E(300, 290, 100, "👉") +
      R(400, 0, 400, 400, "#eef0f2") + R(470, 290, 260, 110, "#fff", `rx="20" stroke="#ccc" stroke-width="4"`) + E(600, 230, 180, "😾") + E(690, 330, 70, "🥗") +
      linea(400, 0, 400, 400, "#222", 5),
    cajas: [
      { x: 2, y: 3, w: 46, h: 26, e: "imp" },
      { x: 52, y: 3, w: 46, h: 26, e: "imp" }
    ]
  },
  mariposa: {
    nombre: "¿Esto es…?", w: 700, h: 500,
    arte: `<defs><linearGradient id="mzMar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa3d8"/><stop offset="1" stop-color="#d7ecf7"/></linearGradient></defs>` +
      R(0, 0, 700, 500, "url(#mzMar)") + R(0, 420, 700, 80, "#7fb77e") + E(170, 300, 260, "🧑") + E(330, 230, 110, "👉", { g: -25 }) + E(530, 130, 130, "🦋"),
    cajas: [
      { x: 3, y: 56, w: 44, h: 16, e: "imp" },
      { x: 56, y: 32, w: 40, h: 16, e: "imp" },
      { x: 4, y: 80, w: 92, h: 17, e: "imp" }
    ]
  },
  plan: {
    nombre: "El plan", w: 800, h: 600,
    arte: [[0, 0], [400, 0], [0, 300], [400, 300]].map(([x, y], k) =>
      R(x, y, 400, 300, "#e9e4d8") + R(x + 14, y + 20, 230, 190, "#fff", `stroke="#8a7f6a" stroke-width="5"`) + linea(x + 60, y + 210, x + 40, y + 290, "#8a7f6a", 6) + linea(x + 200, y + 210, x + 220, y + 290, "#8a7f6a", 6) +
      E(x + 320, y + 170, 150, k === 3 ? "😨" : "🦹") + (k < 3 ? E(x + 250, y + 120, 54, "👉") : E(x + 330, y + 60, 50, "❗"))).join("") +
      linea(400, 0, 400, 600, "#222", 5) + linea(0, 300, 800, 300, "#222", 5),
    cajas: [
      { x: 3, y: 8, w: 27, h: 30, e: "neg", t: 6 },
      { x: 53, y: 8, w: 27, h: 30, e: "neg", t: 6 },
      { x: 3, y: 58, w: 27, h: 30, e: "neg", t: 6 },
      { x: 53, y: 58, w: 27, h: 30, e: "neg", t: 6, de: 2 }
    ]
  },
  cachetada: {
    nombre: "La cachetada", w: 600, h: 600,
    arte: R(0, 0, 600, 600, "#f7d64a") + `<g opacity=".18">${Array.from({ length: 100 }, (_, i) => `<circle cx="${(i % 10) * 64 + 20}" cy="${Math.floor(i / 10) * 64 + 20}" r="12" fill="#c0392b"/>`).join("")}</g>` +
      globo(140, 100, 125, 85, 150, 290) + globo(440, 110, 145, 95, 420, 320) +
      E(160, 430, 170, "😮") + E(430, 430, 210, "🦸") + E(280, 390, 110, "✋", { g: -30 }) + E(250, 330, 80, "💥"),
    cajas: [
      { x: 6, y: 7, w: 35, h: 20, e: "bur", t: 7 },
      { x: 52, y: 7, w: 42, h: 22, e: "bur", t: 7 }
    ]
  },
  uno25: {
    nombre: "Haz esto o roba 25", w: 720, h: 500,
    arte: R(0, 0, 720, 500, "#2d6a4f") + R(30, 30, 300, 440, "#fff", `rx="26"`) + R(48, 48, 264, 404, "#d62828", `rx="18"`) +
      `<ellipse cx="180" cy="225" rx="105" ry="150" fill="#fff" transform="rotate(20 180 225)"/>` + T(180, 432, 36, "O ROBA 25", "#fff") +
      E(560, 270, 220, "😐") + Array.from({ length: 9 }, (_, i) => R(430 + i * 26, 360 - Math.abs(i - 4) * 8, 60, 90, ["#d62828", "#1d4ed8", "#16a34a", "#eab308"][i % 4], `rx="8" stroke="#fff" stroke-width="4" transform="rotate(${(i - 4) * 7} ${460 + i * 26} 400)"`)).join(""),
    cajas: [
      { x: 10, y: 18, w: 30, h: 50, e: "neg", t: 6 },
      { x: 52, y: 4, w: 45, h: 20, e: "imp" }
    ]
  },
  senalan: {
    nombre: "Se señalan", w: 720, h: 460,
    arte: R(0, 0, 720, 460, "#36597a") + R(0, 330, 720, 130, "#2a3f55") + R(80, 40, 160, 120, "#4d7397") + R(480, 40, 160, 120, "#4d7397") +
      E(190, 270, 200, "😳") + E(330, 250, 110, "👉") + E(530, 270, 200, "😳", { v: true }) + E(390, 250, 110, "👈"),
    cajas: [
      { x: 3, y: 74, w: 44, h: 22, e: "imp" },
      { x: 53, y: 74, w: 44, h: 22, e: "imp" }
    ]
  },
  sorpresa: {
    nombre: "Cara de sorpresa", w: 600, h: 620,
    arte: R(0, 0, 600, 620, "#fff") + R(0, 290, 600, 330, "#ffe066") + E(300, 460, 270, "😮"),
    cajas: [
      { x: 4, y: 3, w: 92, h: 42, e: "neg" }
    ]
  },
  dolor: {
    nombre: "Ocultando el dolor", w: 600, h: 600,
    arte: R(0, 0, 600, 600, "#cfd8dc") + R(40, 60, 220, 160, "#90a4ae") + R(0, 430, 600, 170, "#8d6e63") + E(300, 320, 280, "🧓") + E(470, 420, 100, "☕"),
    cajas: [
      { x: 3, y: 3, w: 94, h: 20, e: "imp" },
      { x: 3, y: 78, w: 94, h: 19, e: "imp" }
    ]
  },
  exito: {
    nombre: "Niño exitoso", w: 600, h: 600,
    arte: R(0, 0, 600, 600, "#8fd3f4") + R(0, 330, 600, 90, "#2f8fcf") + R(0, 420, 600, 180, "#f1d9a4") + E(300, 360, 260, "👶") + E(430, 440, 120, "✊"),
    cajas: [
      { x: 3, y: 3, w: 94, h: 20, e: "imp" },
      { x: 3, y: 78, w: 94, h: 19, e: "imp" }
    ]
  },
  piensa: {
    nombre: "Piénsalo", w: 640, h: 520,
    arte: R(0, 0, 640, 520, "#2b2d42") + R(0, 0, 640, 520, "#8d99ae", `opacity=".15"`) + E(320, 280, 270, "😏") + E(455, 180, 110, "☝️", { g: -20 }),
    cajas: [
      { x: 3, y: 3, w: 94, h: 19, e: "imp" },
      { x: 3, y: 79, w: 94, h: 18, e: "imp" }
    ]
  },
  mono: {
    nombre: "Mirar para otro lado", w: 760, h: 420,
    arte: R(0, 0, 380, 420, "#b9875f") + R(380, 0, 380, 420, "#b9875f") + R(0, 330, 760, 90, "#7a5a40") +
      E(190, 270, 200, "🐵") + E(570, 270, 200, "🐵", { v: true }) + E(520, 250, 70, "👀") + linea(380, 0, 380, 420, "#222", 5),
    cajas: [
      { x: 3, y: 3, w: 94, h: 24, e: "imp" }
    ]
  },
  incendio: {
    nombre: "La del incendio", w: 640, h: 500,
    arte: R(0, 0, 640, 500, "#4a3b3b") + `<ellipse cx="320" cy="60" rx="320" ry="80" fill="#2a2222"/>` + E(430, 230, 230, "🏠") + llamas([330, 420, 520, 590], 180, 110) +
      R(0, 410, 640, 90, "#3a4a2a") + E(150, 350, 210, "👧"),
    cajas: [
      { x: 3, y: 3, w: 94, h: 20, e: "imp" },
      { x: 3, y: 78, w: 94, h: 19, e: "imp" }
    ]
  },
  panico: {
    nombre: "Pánico, calma, pánico", w: 600, h: 750,
    arte: R(0, 0, 600, 750, "#fff") + [["#ef5350", "😱"], ["#64b5f6", "😌"], ["#e53935", "😱"]].map(([c, e], k) =>
      R(340, k * 250, 260, 250, c) + E(470, k * 250 + 125, k === 2 ? 190 : 160, e)).join("") +
      linea(0, 250, 600, 250, "#222", 4) + linea(0, 500, 600, 500, "#222", 4) + linea(340, 0, 340, 750, "#222", 4),
    cajas: [
      { x: 2, y: 2, w: 53, h: 29, e: "neg", t: 7 },
      { x: 2, y: 35.4, w: 53, h: 29, e: "neg", t: 7 },
      { x: 2, y: 68.8, w: 53, h: 29, e: "neg", t: 7 }
    ]
  },
  trato: {
    nombre: "Oferta comercial", w: 720, h: 500,
    arte: R(0, 0, 360, 500, "#264653") + R(360, 0, 360, 500, "#2a9d8f") + T(360, 70, 54, "OFERTA", "#ffd166", `stroke="#111" stroke-width="3" paint-order="stroke"`) +
      T(120, 135, 40, "YO RECIBO", "#fff") + T(600, 135, 40, "TÚ RECIBES", "#fff") + E(360, 340, 220, "🧑‍💼") + E(360, 460, 80, "🤝"),
    cajas: [
      { x: 3, y: 31, w: 30, h: 55, e: "imp", t: 7 },
      { x: 67, y: 31, w: 30, h: 55, e: "imp", t: 7 }
    ]
  },
  siempre: {
    nombre: "Siempre lo fue", w: 720, h: 460,
    arte: R(0, 0, 720, 460, "#0b1026") + estrellas(70, 720, 460, 7) + E(130, 300, 300, "🌍") + E(400, 330, 150, "🧑‍🚀", { v: true }) + E(600, 340, 150, "🧑‍🚀", { v: true }) + E(520, 330, 70, "🔫", { v: true }) +
      globo(400, 85, 130, 72, 400, 250) + globo(600, 190, 110, 60, 600, 270),
    cajas: [
      { x: 41, y: 7, w: 30, h: 24, e: "bur", t: 6 },
      { x: 71, y: 34, w: 25, h: 18, e: "bur", t: 6 }
    ]
  },
  perros: {
    nombre: "Antes y ahora", w: 800, h: 500,
    arte: R(0, 0, 400, 500, "#f4a261") + R(400, 0, 400, 500, "#a8dadc") + E(200, 250, 210, "🐕") + E(85, 230, 100, "💪", { v: true }) + E(315, 230, 100, "💪") +
      E(600, 290, 120, "🐕") + E(650, 210, 50, "🥺") + linea(400, 0, 400, 500, "#222", 5),
    cajas: [
      { x: 3, y: 3, w: 44, h: 13, e: "imp", t: 6 },
      { x: 3, y: 70, w: 44, h: 27, e: "imp", t: 6 },
      { x: 53, y: 3, w: 44, h: 13, e: "imp", t: 6 },
      { x: 53, y: 70, w: 44, h: 27, e: "imp", t: 6 }
    ]
  },
  bici: {
    nombre: "Me boicoteo", w: 800, h: 420,
    arte: R(0, 0, 800, 420, "#9fd4a3") + R(0, 320, 800, 100, "#8d8d8d") + E(200, 250, 200, "🚴") + linea(120, 140, 230, 330, "#7a4b22", 10) +
      E(610, 330, 120, "🚲", { g: 80 }) + E(560, 300, 150, "🤕") + linea(400, 0, 400, 420, "#222", 5),
    cajas: [
      { x: 3, y: 4, w: 44, h: 22, e: "imp" },
      { x: 53, y: 4, w: 44, h: 22, e: "imp" }
    ]
  },
  salida: {
    nombre: "La salida", w: 720, h: 560,
    arte: R(0, 0, 720, 560, "#86c5f0") + R(0, 300, 720, 260, "#5a9e4b") + `<path d="M220 560 L340 300 L380 300 L500 560Z" fill="#555"/><path d="M360 300 L360 560" stroke="#fff" stroke-width="5" stroke-dasharray="26 22"/><path d="M380 300 Q520 360 720 380 L720 460 Q520 430 470 560 L430 560Z" fill="#555"/>` +
      linea(150, 180, 150, 330, "#666", 10) + linea(570, 180, 570, 330, "#666", 10) + R(60, 20, 600, 170, "#1b7a3a", `rx="12" stroke="#fff" stroke-width="5"`) +
      linea(360, 30, 360, 180, "#fff", 4) + E(560, 460, 120, "🚗", { g: -20 }) + rayas(510, 450, 3),
    cajas: [
      { x: 10, y: 6, w: 38, h: 24, e: "bla", t: 6 },
      { x: 52, y: 6, w: 38, h: 24, e: "bla", t: 6 },
      { x: 3, y: 79, w: 52, h: 18, e: "imp", t: 7 }
    ]
  },
  quien: {
    nombre: "¿Quién ganaría?", w: 720, h: 520,
    arte: R(0, 0, 720, 520, "#1d1b2f") + T(360, 70, 56, "¿QUIÉN GANARÍA?", "#fff", `stroke="#111" stroke-width="3" paint-order="stroke"`) +
      R(30, 105, 290, 390, "#e63946", `rx="14" stroke="#fff" stroke-width="6"`) + R(400, 105, 290, 390, "#457b9d", `rx="14" stroke="#fff" stroke-width="6"`) +
      E(175, 420, 70, "🥊") + E(545, 420, 70, "🥊", { v: true }) + T(360, 320, 64, "VS", "#ffd166", `stroke="#111" stroke-width="4" paint-order="stroke"`),
    cajas: [
      { x: 6, y: 24, w: 37, h: 50, e: "imp" },
      { x: 57, y: 24, w: 37, h: 50, e: "imp" }
    ]
  },
  elegante: {
    nombre: "Con elegancia", w: 600, h: 600,
    arte: R(0, 0, 600, 600, "#fff") + R(0, 0, 240, 300, "#f2e3c6") + R(0, 300, 240, 300, "#e8d3a8") +
      E(120, 160, 160, "🐻") + E(120, 460, 160, "🐻") + E(120, 370, 80, "🎩") + E(120, 545, 50, "🎀") + linea(0, 300, 600, 300, "#222", 4) + linea(240, 0, 240, 600, "#222", 4),
    cajas: [
      { x: 42, y: 3, w: 55, h: 44, e: "neg" },
      { x: 42, y: 53, w: 55, h: 44, e: "fin" }
    ]
  },
  cartel: {
    nombre: "Cámbiame la opinión", w: 720, h: 500,
    arte: R(0, 0, 720, 500, "#a7d3f2") + R(0, 250, 720, 250, "#6fb05a") + `<circle cx="90" cy="200" r="80" fill="#3f8a3a"/><circle cx="640" cy="180" r="90" fill="#3f8a3a"/>` +
      E(360, 210, 190, "🧔") + E(520, 255, 60, "☕") + R(160, 270, 400, 30, "#8b5a2b") + R(185, 300, 350, 150, "#fff", `stroke="#444" stroke-width="4"`) + R(180, 300, 14, 190, "#6b4220") + R(526, 300, 14, 190, "#6b4220"),
    cajas: [
      { x: 27, y: 61, w: 46, h: 28, e: "neg", t: 6 }
    ]
  },
  noticia: {
    nombre: "Última hora", w: 800, h: 450,
    arte: `<defs><linearGradient id="mzTv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d3b66"/><stop offset="1" stop-color="#1a659e"/></linearGradient></defs>` +
      R(0, 0, 800, 450, "url(#mzTv)") + R(40, 40, 330, 210, "#0a2540", `rx="10" stroke="#9cc3e6" stroke-width="4"`) + E(205, 145, 110, "🗞️") + E(600, 220, 230, "🧑‍💼") +
      R(0, 290, 800, 100, "#d62828") + R(0, 290, 230, 30, "#ffd166") + T(115, 314, 24, "ÚLTIMA HORA", "#111") + R(0, 390, 800, 60, "#111"),
    cajas: [
      { x: 2, y: 72, w: 96, h: 14, e: "bla", t: 6 },
      { x: 2, y: 87.5, w: 96, h: 11, e: "bla", t: 4.5 }
    ]
  }
};

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Las cajas que se escriben (sin las que repiten otra), en orden. */
export const cajasDe = id => (PLANTILLAS[id] ? PLANTILLAS[id].cajas.filter(c => c.de == null) : []);

/* El meme como HTML: el dibujo y encima los textos, cada uno en su caja.
   `vacias` pinta el hueco de las cajas sin texto (el editor). */
export function memeHtml(id, textos = [], { vacias = false, clase = "" } = {}) {
  const pl = PLANTILLAS[id];
  if (!pl) return "";
  let k = 0;
  const cajas = pl.cajas.map(c => {
    const i = c.de != null ? c.de : k++;
    const t = textos[i] || "";
    return `<div class="jg-mz-caja jg-mz-c-${c.e}${!t && vacias ? " vacia" : ""}" data-k="${i}" data-n="Texto ${i + 1}"
      style="left:${c.x}%;top:${c.y}%;width:${c.w}%;height:${c.h}%;--t:${c.t || 9}"><span translate="no">${esc(t)}</span></div>`;
  }).join("");
  // Los ids de degradado se repiten si hay dos memes iguales en pantalla; dan el mismo color, así que no importa.
  return `<div class="jg-mz-meme ${clase}" data-p="${id}" style="aspect-ratio:${pl.w}/${pl.h}">
    <svg viewBox="0 0 ${pl.w} ${pl.h}" preserveAspectRatio="none" aria-hidden="true">${pl.arte}</svg>${cajas}</div>`;
}

/* Achica cada texto hasta que quepa en su caja. El tamaño va en `cqw`
   (relativo al ancho del meme), así que lo que cabe en la miniatura cabe
   igual en grande: el ajuste se hace una vez y vale a cualquier tamaño.
   Las palabras no se parten mientras se mide (una palabra larga desborda
   a lo ancho y eso también achica); solo si ni al mínimo cabe se deja
   partirla (`.parte`), que es mejor que cortarla. */
export function ajustaTextos(raiz) {
  if (!raiz) return;
  for (const caja of raiz.querySelectorAll(".jg-mz-caja")) {
    const span = caja.firstElementChild;
    if (!span) continue;
    let f = Number(caja.style.getPropertyValue("--t")) || 9;
    caja.style.setProperty("--f", f);
    caja.classList.remove("parte");
    if (!span.textContent || !caja.clientHeight) continue;
    const sobra = () => span.offsetHeight > caja.clientHeight + 1 || span.scrollWidth > caja.clientWidth + 1;
    for (let i = 0; i < 22 && f > 1.6 && sobra(); i++) {
      f *= .9;
      caja.style.setProperty("--f", n1(f * 10) / 10);
    }
    if (sobra()) caja.classList.add("parte");
  }
}

/* Escribe un texto en una caja ya pintada (el editor, al teclear). */
export function ponTexto(raiz, k, t) {
  if (!raiz) return;
  for (const caja of raiz.querySelectorAll(`.jg-mz-caja[data-k="${k}"]`)) {
    caja.firstElementChild.textContent = t;
    caja.classList.toggle("vacia", !t && raiz.classList.contains("jg-mz-vacias"));
  }
  ajustaTextos(raiz);
}
