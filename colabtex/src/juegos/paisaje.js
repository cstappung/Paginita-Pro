"use strict";
/* ============================================================
   Escondite — el paisaje, pintado

   `motor.js` decide *qué* hay y dónde (un lugar compuesto: la playa, el
   mercado, la feria, la pista, el lago); aquí solo se traza. El reparto
   es lo único que las dos máquinas tienen que compartir, y es un número:
   con un fondo en imagen habría que subirla, servirla con CORS y
   esperar; con esto el paisaje aparece en el primer fotograma.

   Tres capas, siempre en este orden:
   - el **decorado** de cada tema (`FONDOS`), que lee `esc.zona`: el mar
     y su orilla, las fachadas, las montañas y el cable del telesilla, el
     lago con su muelle. Es lo que convierte la lámina en un sitio y da
     puntos de referencia para barrerla con orden;
   - las **piezas** (`HOJA`), de atrás hacia delante, más pequeñas cuanto
     más arriba;
   - la **gente** (`pintaPersona`), que lleva gorro, camiseta y accesorio
     de los mismos repertorios que el disfraz del escondido.

   La persona se dibuja con una unidad `u` que es su altura entera: los
   pies en 0, la coronilla en −u. Así una pose (sentada, nadando, en
   esquís) es una traslación o un recorte, no otro dibujo.
   ============================================================ */
import { GORROS, CAMISETAS, traje, vistePersona, poseEn } from "./motor.js";

const PAL = {
  verde:  ["#3f7a35", "#2f6b2b", "#4d8a3c", "#356e30", "#588f45", "#2a5f26"],
  tronco: ["#6b4a2f", "#5a3d27", "#7a5636", "#4e3521", "#82603d", "#63452b"],
  piedra: ["#8a8f94", "#767c82", "#9aa0a6", "#6a7076", "#a4aab0", "#7f858b"],
  flor:   ["#e05c7a", "#e8a33d", "#c86bd8", "#f0e05a", "#e8734a", "#f2a8c4"],
  vivo:   ["#d64b3a", "#3a7fd6", "#e0a531", "#35a86b", "#d63a9f", "#7f3ad6"],
  fruta:  ["#e0402f", "#f29a2e", "#f2d43a", "#7cc043", "#8e3b8f", "#d9574a"],
  fachada:["#e9c46a", "#e27b5a", "#f1a766", "#9dbb86", "#e8d8bb", "#d9a8a0"],
  piel:   ["#f1c9a5", "#e0ac7e", "#c68b5e", "#a26a42", "#7d4f30", "#f5d6bc"],
  pelo:   ["#2b1d14", "#5a3a22", "#8a5a2b", "#d9b56b", "#1c1c1c", "#a0522d"],
  pantalon:["#2f3e5c", "#3b3b40", "#6b5a45", "#274a6b", "#51453c", "#7a7f86"]
};
const p = (fam, i) => PAL[fam][((i % 6) + 6) % 6];

/* Un generador pequeño y propio para el decorado (olas, adoquines,
   nubes): tiene que salir igual en las dos máquinas, así que sale de la
   semilla de la escena, nunca de Math.random. */
function azar(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function oscuro(hex, k) {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = x => Math.max(0, Math.min(255, Math.round(x * (1 - k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function degradado(c, y0, y1, pares) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  pares.forEach((col, i) => g.addColorStop(i / (pares.length - 1), col));
  return g;
}
function nube(c, x, y, r) {
  c.beginPath();
  c.ellipse(x, y, r * 1.6, r * 0.55, 0, 0, 7);
  c.ellipse(x - r * 0.6, y - r * 0.25, r * 0.7, r * 0.55, 0, 0, 7);
  c.ellipse(x + r * 0.5, y - r * 0.35, r * 0.8, r * 0.65, 0, 0, 7);
  c.fill();
}
/* Una cuerda colgada entre dos puntos, con su comba. */
function comba(x0, y0, x1, y1, bolsa, t) {
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + bolsa * 4 * t * (1 - t)];
}

/* ============================================================
   El decorado de cada tema
   ============================================================ */
const FONDOS = {
  playa(c, W, H, esc) {
    const z = esc.zona, r = azar(esc.semilla ^ 0x51);
    const mar0 = z.mar[0] * H;
    c.fillStyle = degradado(c, 0, mar0, ["#7cc7ef", "#cdeefa"]); c.fillRect(0, 0, W, mar0 + 2);
    c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(W * (z.faro < 0.5 ? 0.82 : 0.18), H * 0.05, H * 0.035, 0, 7); c.fill();
    c.fillStyle = "#ffffffd0";
    for (let i = 0; i < 4; i++) nube(c, r() * W, H * (0.03 + r() * 0.06), H * (0.012 + r() * 0.012));
    // El mar, hasta la orilla ondulada que usa `poseEn`.
    const orilla = x => (z.mar[1] + 0.012 * Math.sin(x * 21)) * H;
    c.fillStyle = degradado(c, mar0, z.mar[1] * H, ["#2a6fa8", "#2f8fbf", "#4fc0cf"]);
    c.beginPath(); c.moveTo(0, mar0);
    c.lineTo(W, mar0);
    for (let x = W; x >= 0; x -= W / 60) c.lineTo(x, orilla(x / W));
    c.closePath(); c.fill();
    c.strokeStyle = "#ffffff50"; c.lineWidth = Math.max(1, H * 0.003);
    for (let fila = 0; fila < 14; fila++) {
      const y = mar0 + (z.mar[1] * H - mar0) * (fila + 0.5) / 14;
      const paso = W * (0.02 + fila * 0.003);
      for (let x = (r() * paso); x < W; x += paso * (1.4 + r())) {
        c.beginPath(); c.arc(x, y, paso * 0.35, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      }
    }
    // Arena mojada, espuma y arena seca.
    c.fillStyle = degradado(c, z.mar[1] * H - H * 0.02, z.paseo * H, ["#d6bd86", "#efdcaa", "#e8cf95"]);
    c.beginPath(); c.moveTo(0, H * z.paseo);
    for (let x = 0; x <= W; x += W / 60) c.lineTo(x, orilla(x / W));
    c.lineTo(W, H * z.paseo); c.closePath(); c.fill();
    c.strokeStyle = "#ffffffd8"; c.lineWidth = H * 0.006;
    c.beginPath(); for (let x = 0; x <= W; x += W / 60) c[x ? "lineTo" : "moveTo"](x, orilla(x / W) - H * 0.002); c.stroke();
    c.fillStyle = "#b8995e40";
    for (let i = 0; i < 260; i++) c.fillRect(r() * W, H * (z.mar[1] + 0.03 + r() * (z.paseo - z.mar[1] - 0.03)), 1.4, 1.4);
    // El paseo de tablas.
    c.fillStyle = "#b98a5a"; c.fillRect(0, z.paseo * H, W, H);
    c.strokeStyle = "#8d6440"; c.lineWidth = 1;
    for (let y = z.paseo * H + H * 0.018; y < H; y += H * 0.022) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.fillStyle = "#7a5334"; c.fillRect(0, z.paseo * H - H * 0.006, W, H * 0.008);
  },

  mercado(c, W, H, esc) {
    const z = esc.zona, r = azar(esc.semilla ^ 0x3a);
    const base = 0.38 * H;
    c.fillStyle = degradado(c, 0, H * 0.2, ["#a9d6f2", "#e3f2fb"]); c.fillRect(0, 0, W, base);
    for (const [x, w, ci, h, v] of z.fachadas) {
      const X = x * W, A = w * W + 1, top = base - (h + 0.1) * H;
      const col = p("fachada", ci);
      c.fillStyle = col; c.fillRect(X, top, A, base - top);
      c.fillStyle = oscuro(col, 0.25); c.fillRect(X, top, A, H * 0.012);
      c.fillStyle = "#00000018"; c.fillRect(X + A - 2, top, 2, base - top);
      // Ventanas con persianas, en dos o tres pisos.
      const cols = Math.max(2, Math.round(A / (W * 0.045)));
      const pisos = Math.max(2, Math.floor((base - top - H * 0.08) / (H * 0.07)));
      for (let f = 0; f < pisos; f++) for (let k = 0; k < cols; k++) {
        const wx = X + A * (k + 0.5) / cols, wy = top + H * 0.035 + f * H * 0.07;
        const vw = W * 0.012, vh = H * 0.035;
        c.fillStyle = "#3b4a5a"; c.fillRect(wx - vw / 2, wy, vw, vh);
        c.fillStyle = v > 0.5 ? "#3f7d5a" : "#5b7fa6";
        c.fillRect(wx - vw * 1.05, wy, vw * 0.5, vh); c.fillRect(wx + vw * 0.55, wy, vw * 0.5, vh);
        if ((f + k + ci) % 3 === 0) { c.strokeStyle = "#2e2e2e"; c.lineWidth = 1; c.strokeRect(wx - vw, wy + vh, vw * 2, H * 0.008); }
      }
      // Bajo con toldo y puerta.
      c.fillStyle = "#4a3426"; c.fillRect(X + A * 0.38, base - H * 0.06, A * 0.24, H * 0.06);
      c.fillStyle = p("vivo", ci + 2);
      for (let k = 0; k < 6; k++) { c.globalAlpha = k % 2 ? 0.6 : 1; c.fillRect(X + A * 0.1 + k * A * 0.13, base - H * 0.075, A * 0.13, H * 0.018); }
      c.globalAlpha = 1;
    }
    // Los adoquines, más grandes cuanto más cerca.
    c.fillStyle = "#cbb593"; c.fillRect(0, base, W, H - base);
    c.fillStyle = "#b9a17c";
    for (let y = base, fila = 0; y < H; fila++) {
      const alto = H * (0.008 + 0.016 * (y - base) / (H - base)), ancho = alto * 2.2;
      for (let x = (fila % 2) * ancho / 2 - ancho; x < W; x += ancho) {
        c.beginPath(); c.roundRect(x + 1, y + 1, ancho - 2, alto - 2, alto * 0.3); c.fill();
      }
      y += alto;
    }
    c.fillStyle = "#00000014"; c.fillRect(0, base, W, H * 0.02);
    // Los banderines de fiesta cruzando la plaza.
    for (let n = 0; n < 2; n++) {
      const y0 = H * (0.3 + n * 0.035), bolsa = H * 0.06;
      c.strokeStyle = "#5a4a3a"; c.lineWidth = 1;
      c.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const [x, y] = comba(0, y0, W, y0 + H * 0.02, bolsa, t); c[t ? "lineTo" : "moveTo"](x, y); } c.stroke();
      for (let t = 0.01, k = Math.floor(z.banderines[n] * 6); t < 1; t += 0.022, k++) {
        const [x, y] = comba(0, y0, W, y0 + H * 0.02, bolsa, t);
        c.fillStyle = p("vivo", k);
        c.beginPath(); c.moveTo(x - W * 0.007, y); c.lineTo(x + W * 0.007, y); c.lineTo(x, y + H * 0.022); c.closePath(); c.fill();
      }
    }
    void r;
  },

  feria(c, W, H, esc) {
    const r = azar(esc.semilla ^ 0x77);
    const hz = 0.3 * H;
    c.fillStyle = degradado(c, 0, hz, ["#2c2a5e", "#7b3f7f", "#e27d6a", "#f6b26b"]); c.fillRect(0, 0, W, hz + 2);
    c.fillStyle = "#fff8d0";
    for (let i = 0; i < 40; i++) c.fillRect(r() * W, r() * hz * 0.45, 1.3, 1.3);
    c.fillStyle = "#3a2b4d";
    c.beginPath(); c.moveTo(0, hz);
    for (let x = 0; x <= W; x += W / 30) c.lineTo(x, hz - H * (0.015 + 0.03 * r()));
    c.lineTo(W, hz); c.closePath(); c.fill();
    c.fillStyle = degradado(c, hz, H, ["#6b8f4e", "#5e8446", "#557a3f"]); c.fillRect(0, hz, W, H - hz);
    // Tierra pisada: los caminos por los que va la gente.
    c.strokeStyle = "#c9ad7a"; c.lineCap = "round";
    for (let j = 0; j < 2; j++) {
      c.lineWidth = H * (0.05 + j * 0.025);
      c.beginPath(); c.moveTo(-W * 0.05, H * (0.5 + j * 0.3));
      c.bezierCurveTo(W * 0.3, H * (0.38 + j * 0.3), W * 0.6, H * (0.66 + j * 0.2), W * 1.05, H * (0.48 + j * 0.3)); c.stroke();
    }
    c.fillStyle = "#b8986240";
    for (let i = 0; i < 200; i++) c.fillRect(r() * W, hz + r() * (H - hz), 1.5, 1.5);
  },

  nieve(c, W, H, esc) {
    const z = esc.zona, r = azar(esc.semilla ^ 0x19);
    c.fillStyle = degradado(c, 0, H * 0.22, ["#7fb6e6", "#dbeefa"]); c.fillRect(0, 0, W, H * 0.25);
    // Tres picos con su nieve; `montes` los corre un poco.
    const picos = z.montes.map((m, i) => [W * (0.15 + i * 0.35 + (m - 0.5) * 0.12), H * (0.02 + m * 0.05)]);
    c.fillStyle = "#8d9fb8";
    c.beginPath(); c.moveTo(0, H * 0.2);
    for (const [x, y] of picos) { c.lineTo(x - W * 0.12, H * 0.14); c.lineTo(x, y); c.lineTo(x + W * 0.12, H * 0.14); }
    c.lineTo(W, H * 0.2); c.lineTo(W, H * 0.24); c.lineTo(0, H * 0.24); c.closePath(); c.fill();
    c.fillStyle = "#f4f8fc";
    for (const [x, y] of picos) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - W * 0.045, y + H * 0.045); c.lineTo(x - W * 0.02, y + H * 0.038);
      c.lineTo(x, y + H * 0.05); c.lineTo(x + W * 0.025, y + H * 0.036); c.lineTo(x + W * 0.045, y + H * 0.045); c.closePath(); c.fill();
    }
    // La pista y la explanada del pie, con otro tono.
    c.fillStyle = degradado(c, H * 0.17, H * z.pista, ["#e6eff7", "#f7fafd", "#e3edf5"]);
    c.beginPath(); c.moveTo(0, H * 0.2); c.bezierCurveTo(W * 0.3, H * 0.15, W * 0.7, H * 0.2, W, H * 0.17);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.fillStyle = degradado(c, H * z.pista, H, ["#dfe7ee", "#eef2f5"]);
    c.beginPath(); c.moveTo(0, H * z.pista);
    c.bezierCurveTo(W * 0.3, H * (z.pista - 0.02), W * 0.7, H * (z.pista + 0.02), W, H * z.pista);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    // Huellas de esquí en eses.
    c.strokeStyle = "#c3d2e0"; c.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = H * (0.22 + r() * 0.5), a = W * (0.02 + r() * 0.03);
      c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + a, y + H * 0.04, x - a, y + H * 0.08, x + a * 0.5, y + H * 0.12); c.stroke();
    }
    // El cable del telesilla.
    const [x0, y0, x1, y1] = z.cable;
    c.strokeStyle = "#333b44"; c.lineWidth = Math.max(1, H * 0.0025);
    for (const d of [-0.004, 0.004]) { c.beginPath(); c.moveTo(x0 * W, (y0 + d) * H); c.lineTo(x1 * W, (y1 + d) * H); c.stroke(); }
  },

  lago(c, W, H, esc) {
    const z = esc.zona, r = azar(esc.semilla ^ 0x2c);
    c.fillStyle = degradado(c, 0, H * 0.18, ["#8fcaee", "#e3f3ea"]); c.fillRect(0, 0, W, H * 0.2);
    c.fillStyle = "#ffffffc8";
    for (let i = 0; i < 3; i++) nube(c, r() * W, H * (0.03 + r() * 0.05), H * 0.015);
    c.fillStyle = "#6d9a8a";
    c.beginPath(); c.moveTo(0, H * 0.19);
    for (let x = 0; x <= W; x += W / 12) c.quadraticCurveTo(x + W / 24, H * (0.1 + r() * 0.04), x + W / 12, H * 0.17);
    c.lineTo(W, H * 0.2); c.lineTo(0, H * 0.2); c.closePath(); c.fill();
    c.fillStyle = degradado(c, H * 0.17, H, ["#86b85c", "#6fa54c", "#5f9642"]); c.fillRect(0, H * 0.17, W, H);
    c.fillStyle = "#4f873a50";
    for (let i = 0; i < 300; i++) { const x = r() * W, y = H * (0.2 + r() * 0.8); c.fillRect(x, y, 1, 3); c.fillRect(x + 2, y + 1, 1, 2); }
    // El lago con su orilla de tierra, sus reflejos y su muelle.
    const [cx, cy, rx, ry] = z.lago;
    c.fillStyle = "#c9b27f";
    c.beginPath(); c.ellipse(cx * W, cy * H, rx * W * 1.05, ry * H * 1.12, 0, 0, 7); c.fill();
    const g = c.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, rx * W);
    g.addColorStop(0, "#2e7fb0"); g.addColorStop(1, "#5fb7d4");
    c.fillStyle = g;
    c.beginPath(); c.ellipse(cx * W, cy * H, rx * W, ry * H, 0, 0, 7); c.fill();
    c.strokeStyle = "#ffffff55"; c.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 0.85;
      const x = (cx + Math.cos(a) * rx * d) * W, y = (cy + Math.sin(a) * ry * d) * H;
      c.beginPath(); c.moveTo(x - W * 0.012, y); c.lineTo(x + W * 0.012, y); c.stroke();
    }
    const [mx, my] = z.muelle;
    c.fillStyle = "#8a6440";
    c.fillRect(mx * W - W * 0.013, (cy + ry * 0.25) * H, W * 0.026, (my - cy + ry * 0.9) * H);
    c.strokeStyle = "#6b4b2e"; c.lineWidth = 1;
    for (let y = (cy + ry * 0.25) * H; y < (my + ry * 0.9) * H; y += H * 0.012) {
      c.beginPath(); c.moveTo(mx * W - W * 0.013, y); c.lineTo(mx * W + W * 0.013, y); c.stroke();
    }
    // El claro de la hoguera y la senda hasta las tiendas.
    const hog = esc.piezas.find(q => q.k === "hoguera");
    if (hog) {
      c.fillStyle = "#b99d6a";
      c.beginPath(); c.ellipse(hog.x * W, hog.y * H, W * 0.1, H * 0.08, 0, 0, 7); c.fill();
      c.strokeStyle = "#b99d6a"; c.lineWidth = H * 0.03; c.lineCap = "round";
      c.beginPath(); c.moveTo(hog.x * W, hog.y * H); c.bezierCurveTo(W * 0.45, H * 0.9, W * 0.55, H * 0.7, W * 0.95, H * 0.82); c.stroke();
    }
  }
};

/* ============================================================
   Las piezas. Cada una alrededor del origen, con la base en y = 0 y
   creciendo hacia arriba, en una unidad `u`. `m` trae W y H por si una
   pieza tiene que llegar a algo del decorado (la silla al cable).
   ============================================================ */
const HOJA = {
  arbol(c, u, i, v) {
    c.fillStyle = p("tronco", i + 2);
    c.fillRect(-u * 0.09, -u * 0.5, u * 0.18, u * 0.5);
    c.fillStyle = p("verde", i);
    c.beginPath(); c.arc(0, -u * 0.95, u * (0.45 + v * 0.1), 0, 7); c.fill();
    c.beginPath(); c.arc(-u * 0.3, -u * 0.7, u * 0.3, 0, 7); c.arc(u * 0.3, -u * 0.72, u * 0.32, 0, 7); c.fill();
    c.fillStyle = "#ffffff1c";
    c.beginPath(); c.arc(-u * 0.12, -u * 1.1, u * 0.2, 0, 7); c.fill();
  },
  pino(c, u, i, v) {
    c.fillStyle = p("tronco", i + 1);
    c.fillRect(-u * 0.08, -u * 0.45, u * 0.16, u * 0.45);
    c.fillStyle = p("verde", i + 3);
    for (let k = 0; k < 3; k++) {
      const y = -u * (0.35 + k * 0.38), r = u * (0.55 - k * 0.12);
      c.beginPath(); c.moveTo(-r, y); c.lineTo(r, y); c.lineTo(0, y - u * 0.62); c.closePath(); c.fill();
    }
    c.fillStyle = "#ffffffaa";
    c.beginPath(); c.moveTo(-u * 0.18, -u * 1.35); c.lineTo(u * 0.18, -u * 1.35); c.lineTo(0, -u * 1.73); c.closePath(); c.fill();
  },
  mata(c, u, i, v) {
    c.fillStyle = p("verde", i + 1);
    for (let k = 0; k < 3; k++) {
      c.beginPath(); c.ellipse((k - 1) * u * 0.3, -u * (0.14 + v * 0.1), u * (0.3 + v * 0.1), u * (0.22 + v * 0.1), 0, 0, 7); c.fill();
    }
  },
  roca(c, u, i, v) {
    c.fillStyle = p("piedra", i);
    c.beginPath();
    c.moveTo(-u * 0.45, 0); c.lineTo(-u * (0.28 + v * 0.1), -u * 0.36);
    c.lineTo(u * 0.1, -u * 0.44); c.lineTo(u * 0.42, -u * 0.14); c.lineTo(u * 0.36, 0);
    c.closePath(); c.fill();
    c.fillStyle = "#ffffff25";
    c.beginPath(); c.moveTo(-u * 0.2, -u * 0.3); c.lineTo(u * 0.05, -u * 0.4); c.lineTo(0, -u * 0.2); c.closePath(); c.fill();
  },
  flor(c, u, i) {
    c.strokeStyle = p("verde", i); c.lineWidth = Math.max(1, u * 0.05);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.3); c.stroke();
    c.fillStyle = p("flor", i);
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.arc(Math.cos(a) * u * 0.1, -u * 0.3 + Math.sin(a) * u * 0.1, u * 0.08, 0, 7); c.fill(); }
  },

  /* --- la playa --- */
  faro(c, u) {
    c.fillStyle = "#7d858c";
    c.beginPath(); c.ellipse(0, 0, u * 0.7, u * 0.22, 0, 0, 7); c.fill();
    const h = u * 2.2;
    for (let k = 0; k < 5; k++) {
      const y0 = -k * h / 5, y1 = -(k + 1) * h / 5;
      const w0 = u * (0.3 - k * 0.025), w1 = u * (0.3 - (k + 1) * 0.025);
      c.fillStyle = k % 2 ? "#f4f1ea" : "#d0362f";
      c.beginPath(); c.moveTo(-w0, y0); c.lineTo(w0, y0); c.lineTo(w1, y1); c.lineTo(-w1, y1); c.closePath(); c.fill();
    }
    c.fillStyle = "#2e3338"; c.fillRect(-u * 0.24, -h - u * 0.05, u * 0.48, u * 0.06);
    c.fillStyle = "#fff0a0"; c.fillRect(-u * 0.14, -h - u * 0.32, u * 0.28, u * 0.27);
    c.fillStyle = "#2e3338";
    c.beginPath(); c.moveTo(-u * 0.2, -h - u * 0.32); c.lineTo(u * 0.2, -h - u * 0.32); c.lineTo(0, -h - u * 0.5); c.closePath(); c.fill();
    c.fillStyle = "#fff4b040";
    c.beginPath(); c.moveTo(0, -h - u * 0.2); c.lineTo(u * 2.2, -h - u * 0.55); c.lineTo(u * 2.2, -h + u * 0.1); c.closePath(); c.fill();
  },
  velero(c, u, i) {
    c.fillStyle = "#ffffff";
    c.beginPath(); c.moveTo(-u * 0.4, -u * 0.12); c.lineTo(u * 0.45, -u * 0.12); c.lineTo(u * 0.3, 0); c.lineTo(-u * 0.3, 0); c.closePath(); c.fill();
    c.fillStyle = p("vivo", i);
    c.fillRect(-u * 0.4, -u * 0.12, u * 0.85, u * 0.03);
    c.strokeStyle = "#555"; c.lineWidth = Math.max(1, u * 0.03);
    c.beginPath(); c.moveTo(0, -u * 0.12); c.lineTo(0, -u * 0.95); c.stroke();
    c.fillStyle = "#fbfbf6";
    c.beginPath(); c.moveTo(u * 0.03, -u * 0.92); c.lineTo(u * 0.4, -u * 0.18); c.lineTo(u * 0.03, -u * 0.18); c.closePath(); c.fill();
    c.fillStyle = p("vivo", i + 2);
    c.beginPath(); c.moveTo(-u * 0.03, -u * 0.8); c.lineTo(-u * 0.3, -u * 0.2); c.lineTo(-u * 0.03, -u * 0.2); c.closePath(); c.fill();
  },
  boya(c, u) {
    c.fillStyle = "#e0402f"; c.beginPath(); c.arc(0, -u * 0.05, u * 0.14, Math.PI, 0); c.fill();
    c.fillStyle = "#ffffff"; c.fillRect(-u * 0.14, -u * 0.08, u * 0.28, u * 0.04);
  },
  gaviota(c, u) {
    c.strokeStyle = "#f4f4f4"; c.lineWidth = Math.max(1.2, u * 0.06); c.lineCap = "round";
    c.beginPath(); c.moveTo(-u * 0.25, -u * 0.05); c.quadraticCurveTo(-u * 0.12, -u * 0.18, 0, -u * 0.04);
    c.quadraticCurveTo(u * 0.12, -u * 0.18, u * 0.25, -u * 0.05); c.stroke();
  },
  socorrista(c, u) {
    c.strokeStyle = "#f4f1ea"; c.lineWidth = u * 0.07;
    c.beginPath(); c.moveTo(-u * 0.3, 0); c.lineTo(-u * 0.18, -u * 0.9); c.moveTo(u * 0.3, 0); c.lineTo(u * 0.18, -u * 0.9);
    c.moveTo(-u * 0.26, -u * 0.35); c.lineTo(u * 0.26, -u * 0.35); c.stroke();
    c.fillStyle = "#d0362f"; c.fillRect(-u * 0.26, -u * 1.02, u * 0.52, u * 0.14);
    c.fillStyle = "#f4f1ea"; c.fillRect(-u * 0.22, -u * 1.3, u * 0.08, u * 0.3);
    c.strokeStyle = "#555"; c.lineWidth = Math.max(1, u * 0.03);
    c.beginPath(); c.moveTo(u * 0.22, -u * 1.02); c.lineTo(u * 0.22, -u * 1.6); c.stroke();
    c.fillStyle = "#e0402f"; c.fillRect(u * 0.22, -u * 1.6, u * 0.25, u * 0.16);
    c.fillStyle = "#f2d43a"; c.fillRect(u * 0.22, -u * 1.52, u * 0.25, u * 0.08);
  },
  toalla(c, u, i, v) {
    c.save(); c.transform(1, 0, -0.35, 1, 0, 0);
    c.fillStyle = p("vivo", i); c.fillRect(-u * 0.45, -u * 0.22, u * 0.9, u * 0.34);
    c.fillStyle = v > 0.5 ? "#ffffff" : p("vivo", i + 3);
    for (let k = 0; k < 3; k++) c.fillRect(-u * 0.45 + k * u * 0.3 + u * 0.1, -u * 0.22, u * 0.08, u * 0.34);
    c.restore();
  },
  sombrilla(c, u, i) {
    c.strokeStyle = "#9a9a9a"; c.lineWidth = u * 0.05;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.95); c.stroke();
    for (let k = 0; k < 6; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : p("vivo", i);
      c.beginPath(); c.moveTo(0, -u * 0.98);
      c.ellipse(0, -u * 0.98, u * 0.6, u * 0.3, 0, Math.PI + k * 0.5236, Math.PI + (k + 1) * 0.5236);
      c.closePath(); c.fill();
    }
  },
  castillo(c, u) {
    c.fillStyle = "#d9b774";
    c.fillRect(-u * 0.35, -u * 0.3, u * 0.7, u * 0.3);
    for (const x of [-0.3, 0.3]) {
      c.fillRect(u * (x - 0.1), -u * 0.52, u * 0.2, u * 0.52);
      for (let k = 0; k < 2; k++) c.fillRect(u * (x - 0.1 + k * 0.13), -u * 0.6, u * 0.07, u * 0.08);
    }
    c.fillStyle = "#c29e5c"; c.fillRect(-u * 0.07, -u * 0.18, u * 0.14, u * 0.18);
    c.strokeStyle = "#555"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(u * 0.3, -u * 0.6); c.lineTo(u * 0.3, -u * 0.85); c.stroke();
    c.fillStyle = "#e0402f"; c.fillRect(u * 0.3, -u * 0.85, u * 0.14, u * 0.09);
  },
  pelota(c, u) {
    const r = u * 0.16;
    ["#e0402f", "#f2d43a", "#2d5fc4", "#ffffff"].forEach((col, k) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, -r); c.arc(0, -r, r, k * 1.5708, (k + 1) * 1.5708); c.closePath(); c.fill();
    });
  },
  nevera(c, u) {
    c.fillStyle = "#2d78c4"; c.fillRect(-u * 0.18, -u * 0.24, u * 0.36, u * 0.24);
    c.fillStyle = "#f4f4f4"; c.fillRect(-u * 0.2, -u * 0.3, u * 0.4, u * 0.07);
  },
  heladeria(c, u) {
    c.fillStyle = "#f7f1e4"; c.fillRect(-u * 0.6, -u * 0.55, u * 1.2, u * 0.55);
    c.fillStyle = "#9fd6e0"; c.fillRect(-u * 0.5, -u * 0.5, u * 1.0, u * 0.18);
    c.strokeStyle = "#e38fb0"; c.lineWidth = u * 0.04; c.strokeRect(-u * 0.6, -u * 0.55, u * 1.2, u * 0.55);
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : "#e8739c";
      c.beginPath(); c.moveTo(-u * 0.7 + k * u * 0.175, -u * 0.95); c.lineTo(-u * 0.7 + (k + 1) * u * 0.175, -u * 0.95);
      c.lineTo(-u * 0.7 + (k + 1) * u * 0.175, -u * 0.72); c.arc(-u * 0.7 + (k + 0.5) * u * 0.175, -u * 0.72, u * 0.0875, 0, Math.PI); c.closePath(); c.fill();
    }
    c.fillStyle = "#e0b36b";
    c.beginPath(); c.moveTo(-u * 0.08, -u * 1.0); c.lineTo(u * 0.08, -u * 1.0); c.lineTo(0, -u * 0.68); c.closePath(); c.fill();
    c.fillStyle = "#f2a8c4"; c.beginPath(); c.arc(0, -u * 1.08, u * 0.12, 0, 7); c.fill();
    c.fillStyle = "#fbf2d0"; c.beginPath(); c.arc(u * 0.02, -u * 1.2, u * 0.08, 0, 7); c.fill();
  },
  farola(c, u) {
    c.strokeStyle = "#343c43"; c.lineWidth = u * 0.06;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 1.25); c.quadraticCurveTo(0, -u * 1.4, u * 0.18, -u * 1.38); c.stroke();
    c.fillStyle = "#343c43"; c.fillRect(-u * 0.1, -u * 0.08, u * 0.2, u * 0.08);
    c.fillStyle = "#f7e9a0"; c.beginPath(); c.ellipse(u * 0.2, -u * 1.3, u * 0.09, u * 0.07, 0, 0, 7); c.fill();
  },
  banco(c, u, i) {
    c.fillStyle = p("tronco", i + 4);
    c.fillRect(-u * 0.4, -u * 0.22, u * 0.8, u * 0.07);
    c.fillRect(-u * 0.4, -u * 0.44, u * 0.8, u * 0.07);
    c.fillStyle = "#3f454b";
    c.fillRect(-u * 0.36, -u * 0.22, u * 0.05, u * 0.22); c.fillRect(u * 0.31, -u * 0.22, u * 0.05, u * 0.22);
  },

  /* --- el mercado --- */
  fuente(c, u) {
    c.fillStyle = "#a7a39a"; c.beginPath(); c.ellipse(0, -u * 0.1, u * 0.95, u * 0.3, 0, 0, 7); c.fill();
    c.fillStyle = "#5fa9cf"; c.beginPath(); c.ellipse(0, -u * 0.14, u * 0.82, u * 0.22, 0, 0, 7); c.fill();
    c.fillStyle = "#bdb8ad"; c.fillRect(-u * 0.08, -u * 0.8, u * 0.16, u * 0.66);
    c.beginPath(); c.ellipse(0, -u * 0.8, u * 0.32, u * 0.09, 0, 0, 7); c.fill();
    c.strokeStyle = "#cdeefc"; c.lineWidth = Math.max(1, u * 0.035);
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(0, -u * 0.95); c.quadraticCurveTo(s * u * 0.35, -u * 1.2, s * u * 0.55, -u * 0.2); c.stroke();
    }
    c.beginPath(); c.moveTo(0, -u * 0.82); c.lineTo(0, -u * 1.1); c.stroke();
  },
  palomas(c, u, i, v) {
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * u * 0.18 + (v - 0.5) * u * 0.2, y = ((k * 7) % 3) * u * 0.06;
      c.fillStyle = k % 2 ? "#8b8f99" : "#6f7480";
      c.beginPath(); c.ellipse(x, y - u * 0.05, u * 0.07, u * 0.045, 0, 0, 7); c.fill();
      c.beginPath(); c.arc(x + u * 0.06, y - u * 0.09, u * 0.03, 0, 7); c.fill();
    }
  },
  puesto(c, u, i) {
    c.strokeStyle = "#5a4330"; c.lineWidth = u * 0.05;
    c.beginPath(); c.moveTo(-u * 0.6, 0); c.lineTo(-u * 0.6, -u * 1.05); c.moveTo(u * 0.6, 0); c.lineTo(u * 0.6, -u * 1.05); c.stroke();
    c.fillStyle = "#8a6440"; c.fillRect(-u * 0.66, -u * 0.42, u * 1.32, u * 0.24);
    c.fillStyle = "#6b4b2e"; c.fillRect(-u * 0.66, -u * 0.18, u * 1.32, u * 0.05);
    for (let k = 0; k < 11; k++) {
      c.fillStyle = p("fruta", i + (k % 3));
      c.beginPath(); c.arc(-u * 0.55 + k * u * 0.11, -u * 0.45, u * 0.055, 0, 7); c.fill();
    }
    for (let k = 0; k < 7; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : p("vivo", i);
      c.beginPath(); c.moveTo(-u * 0.72 + k * u * 0.206, -u * 1.1); c.lineTo(-u * 0.72 + (k + 1) * u * 0.206, -u * 1.1);
      c.lineTo(-u * 0.72 + (k + 1) * u * 0.206, -u * 0.9); c.arc(-u * 0.72 + (k + 0.5) * u * 0.206, -u * 0.9, u * 0.103, 0, Math.PI); c.closePath(); c.fill();
    }
  },
  cajas(c, u, i) {
    for (const [x, y] of [[-0.14, 0], [0.14, 0], [0, -0.22]]) {
      c.fillStyle = "#b8894f"; c.fillRect(u * (x - 0.13), u * (y - 0.22), u * 0.26, u * 0.22);
      c.strokeStyle = "#8a6134"; c.lineWidth = 1; c.strokeRect(u * (x - 0.13), u * (y - 0.22), u * 0.26, u * 0.22);
      c.fillStyle = p("fruta", i + x * 10);
      c.beginPath(); c.arc(u * (x - 0.05), u * (y - 0.23), u * 0.05, 0, 7); c.arc(u * (x + 0.05), u * (y - 0.23), u * 0.05, 0, 7); c.fill();
    }
  },
  carro(c, u, i) {
    c.fillStyle = "#9a6d3f"; c.fillRect(-u * 0.4, -u * 0.42, u * 0.8, u * 0.2);
    for (let k = 0; k < 6; k++) { c.fillStyle = p("fruta", i + k); c.beginPath(); c.arc(-u * 0.3 + k * u * 0.12, -u * 0.46, u * 0.07, 0, 7); c.fill(); }
    c.strokeStyle = "#5a4330"; c.lineWidth = u * 0.04;
    c.beginPath(); c.moveTo(u * 0.4, -u * 0.35); c.lineTo(u * 0.75, -u * 0.5); c.stroke();
    c.fillStyle = "#3e3226";
    for (const x of [-0.22, 0.22]) { c.beginPath(); c.arc(u * x, -u * 0.12, u * 0.12, 0, 7); c.fill(); }
  },

  /* --- la feria --- */
  noria(c, u, i, v) {
    const cy = -u * 1.9, R = u * 1.5;
    c.strokeStyle = "#4b4f63"; c.lineWidth = u * 0.07;
    c.beginPath(); c.moveTo(-u * 0.8, 0); c.lineTo(0, cy); c.lineTo(u * 0.8, 0); c.stroke();
    c.strokeStyle = "#e9e3d0"; c.lineWidth = u * 0.05;
    c.beginPath(); c.arc(0, cy, R, 0, 7); c.stroke();
    c.lineWidth = u * 0.02;
    c.beginPath(); c.arc(0, cy, R * 0.92, 0, 7); c.stroke();
    const n = 12, a0 = v * 6.28;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 6.283 / n;
      c.beginPath(); c.moveTo(0, cy); c.lineTo(Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
    }
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 6.283 / n, x = Math.cos(a) * R, y = cy + Math.sin(a) * R;
      c.fillStyle = p("vivo", k);
      c.beginPath(); c.roundRect(x - u * 0.13, y, u * 0.26, u * 0.2, u * 0.05); c.fill();
      c.fillStyle = "#fff6c0"; c.beginPath(); c.arc(x, y, u * 0.03, 0, 7); c.fill();
    }
    c.fillStyle = "#f2d43a"; c.beginPath(); c.arc(0, cy, u * 0.12, 0, 7); c.fill();
  },
  carrusel(c, u) {
    c.fillStyle = "#7b3f7f"; c.beginPath(); c.ellipse(0, -u * 0.08, u * 0.85, u * 0.2, 0, 0, 7); c.fill();
    c.fillStyle = "#f2d43a"; c.fillRect(-u * 0.85, -u * 0.1, u * 1.7, u * 0.05);
    c.strokeStyle = "#d9c38a"; c.lineWidth = u * 0.03;
    for (let k = 0; k < 7; k++) { const x = -u * 0.7 + k * u * 0.233; c.beginPath(); c.moveTo(x, -u * 0.12); c.lineTo(x, -u * 0.9); c.stroke(); }
    for (let k = 0; k < 4; k++) {
      const x = -u * 0.58 + k * u * 0.4, y = -u * (0.4 + (k % 2) * 0.12);
      c.fillStyle = k % 2 ? "#f4f1ea" : "#c9895a";
      c.beginPath(); c.ellipse(x, y, u * 0.13, u * 0.06, 0, 0, 7); c.fill();
      c.fillRect(x + u * 0.08, y - u * 0.12, u * 0.05, u * 0.12);
    }
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : "#d0362f";
      c.beginPath(); c.moveTo(0, -u * 1.45); c.lineTo(-u * 0.95 + k * u * 0.2375, -u * 0.9); c.lineTo(-u * 0.95 + (k + 1) * u * 0.2375, -u * 0.9); c.closePath(); c.fill();
    }
    c.fillStyle = "#f2d43a"; c.beginPath(); c.arc(0, -u * 1.48, u * 0.06, 0, 7); c.fill();
  },
  carpa(c, u, i) {
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 2 ? "#f7f1e4" : p("vivo", i === 1 ? 0 : i);
      c.beginPath(); c.moveTo(0, -u * 1.3); c.lineTo(-u * 0.9 + k * u * 0.225, 0); c.lineTo(-u * 0.9 + (k + 1) * u * 0.225, 0); c.closePath(); c.fill();
    }
    c.fillStyle = "#2b2230"; c.beginPath(); c.moveTo(-u * 0.15, 0); c.lineTo(0, -u * 0.4); c.lineTo(u * 0.15, 0); c.closePath(); c.fill();
    c.strokeStyle = "#444"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -u * 1.3); c.lineTo(0, -u * 1.55); c.stroke();
    c.fillStyle = "#f2d43a"; c.fillRect(0, -u * 1.55, u * 0.18, u * 0.1);
  },
  caseta(c, u, i) {
    c.fillStyle = "#f4ead0"; c.fillRect(-u * 0.5, -u * 0.8, u, u * 0.8);
    c.fillStyle = "#3a2b2a"; c.fillRect(-u * 0.42, -u * 0.72, u * 0.84, u * 0.36);
    for (let k = 0; k < 6; k++) { c.fillStyle = p("vivo", i + k); c.beginPath(); c.arc(-u * 0.32 + k * u * 0.13, -u * 0.6, u * 0.05, 0, 7); c.fill(); }
    c.fillStyle = p("vivo", i + 1); c.fillRect(-u * 0.55, -u * 0.36, u * 1.1, u * 0.1);
    for (let k = 0; k < 5; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : p("vivo", i);
      c.beginPath(); c.moveTo(-u * 0.55 + k * u * 0.22, -u * 0.8); c.lineTo(-u * 0.55 + (k + 1) * u * 0.22, -u * 0.8);
      c.lineTo(-u * 0.45 + k * u * 0.22 + u * 0.22 * 0.5, -u * 1.1); c.closePath(); c.fill();
    }
    c.fillStyle = "#fff6c0";
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-u * 0.45 + k * u * 0.225, -u * 0.8, u * 0.03, 0, 7); c.fill(); }
  },
  globos(c, u, i) {
    const pies = [-u * 0.3, -u * 0.5];
    for (let k = 0; k < 7; k++) {
      const x = (k - 3) * u * 0.1 + ((k * 5) % 3 - 1) * u * 0.04, y = -u * (1.1 + ((k * 3) % 4) * 0.08);
      c.strokeStyle = "#666"; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(pies[0], pies[1]); c.lineTo(x, y); c.stroke();
      c.fillStyle = p("vivo", i + k); c.beginPath(); c.ellipse(x, y - u * 0.08, u * 0.08, u * 0.1, 0, 0, 7); c.fill();
    }
  },

  /* --- la nieve --- */
  silla(c, u, i, v, m) {
    const alto = 0.035 * m.H;
    c.strokeStyle = "#333b44"; c.lineWidth = Math.max(1, u * 0.04);
    c.beginPath(); c.moveTo(0, -alto); c.lineTo(0, -u * 0.35); c.stroke();
    c.fillStyle = p("vivo", i); c.fillRect(-u * 0.25, -u * 0.35, u * 0.5, u * 0.08);
    c.fillRect(-u * 0.25, -u * 0.35, u * 0.06, u * 0.3);
    c.fillStyle = "#333b44"; c.fillRect(-u * 0.25, -u * 0.08, u * 0.5, u * 0.04);
  },
  poste(c, u, i, v, m) {
    const alto = 0.03 * m.H + u * 0.1;
    c.fillStyle = "#6b7580"; c.fillRect(-u * 0.06, -alto, u * 0.12, alto);
    c.fillRect(-u * 0.3, -alto, u * 0.6, u * 0.07);
  },
  muneco(c, u) {
    c.fillStyle = "#f7fbfd";
    c.beginPath(); c.arc(0, -u * 0.2, u * 0.22, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -u * 0.52, u * 0.15, 0, 7); c.fill();
    c.fillStyle = "#d0362f"; c.fillRect(-u * 0.14, -u * 0.4, u * 0.28, u * 0.05);
    c.fillStyle = "#2b2f33"; c.fillRect(-u * 0.12, -u * 0.72, u * 0.24, u * 0.06); c.fillRect(-u * 0.08, -u * 0.86, u * 0.16, u * 0.15);
    c.fillStyle = "#f08a2b"; c.beginPath(); c.moveTo(0, -u * 0.53); c.lineTo(u * 0.14, -u * 0.51); c.lineTo(0, -u * 0.49); c.fill();
  },
  trineo(c, u) {
    c.fillStyle = "#b5462f"; c.fillRect(-u * 0.3, -u * 0.16, u * 0.6, u * 0.08);
    c.strokeStyle = "#333"; c.lineWidth = Math.max(1, u * 0.03);
    c.beginPath(); c.moveTo(-u * 0.32, -u * 0.02); c.lineTo(u * 0.3, -u * 0.02); c.quadraticCurveTo(u * 0.42, -u * 0.02, u * 0.4, -u * 0.14); c.stroke();
  },
  cabana(c, u) {
    c.fillStyle = "#8a5a36"; c.fillRect(-u * 0.9, -u * 0.8, u * 1.8, u * 0.8);
    c.strokeStyle = "#6b4226"; c.lineWidth = 1;
    for (let y = -u * 0.1; y > -u * 0.8; y -= u * 0.1) { c.beginPath(); c.moveTo(-u * 0.9, y); c.lineTo(u * 0.9, y); c.stroke(); }
    c.fillStyle = "#5a3a22";
    c.beginPath(); c.moveTo(-u * 1.05, -u * 0.78); c.lineTo(0, -u * 1.5); c.lineTo(u * 1.05, -u * 0.78); c.closePath(); c.fill();
    c.fillStyle = "#f7fbfd";
    c.beginPath(); c.moveTo(-u * 1.05, -u * 0.78); c.lineTo(0, -u * 1.5); c.lineTo(u * 1.05, -u * 0.78); c.lineTo(u * 0.9, -u * 0.86); c.lineTo(0, -u * 1.38); c.lineTo(-u * 0.9, -u * 0.86); c.closePath(); c.fill();
    c.fillStyle = "#ffd87a";
    for (const x of [-0.6, 0.35]) c.fillRect(u * x, -u * 0.6, u * 0.25, u * 0.22);
    c.fillStyle = "#3a2616"; c.fillRect(-u * 0.12, -u * 0.45, u * 0.24, u * 0.45);
    c.fillStyle = "#5a5a5a"; c.fillRect(u * 0.5, -u * 1.45, u * 0.14, u * 0.35);
    c.fillStyle = "#e6eef580";
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(u * (0.6 + k * 0.1), -u * (1.55 + k * 0.15), u * (0.08 + k * 0.03), 0, 7); c.fill(); }
  },

  /* --- el lago --- */
  canoa(c, u, i) {
    c.fillStyle = p("vivo", i);
    c.beginPath(); c.moveTo(-u * 0.55, -u * 0.12); c.quadraticCurveTo(0, u * 0.12, u * 0.55, -u * 0.12); c.quadraticCurveTo(0, -u * 0.04, -u * 0.55, -u * 0.12); c.fill();
    c.strokeStyle = "#ffffff70"; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, u * 0.7, u * 0.08, 0, 0, 7); c.stroke();
  },
  hoguera(c, u) {
    const g = c.createRadialGradient(0, -u * 0.2, 0, 0, -u * 0.2, u * 1.2);
    g.addColorStop(0, "#ffd06a70"); g.addColorStop(1, "#ffd06a00");
    c.fillStyle = g; c.beginPath(); c.arc(0, -u * 0.2, u * 1.2, 0, 7); c.fill();
    c.strokeStyle = "#5a3a22"; c.lineWidth = u * 0.09; c.lineCap = "round";
    c.beginPath(); c.moveTo(-u * 0.3, 0); c.lineTo(u * 0.3, -u * 0.12); c.moveTo(u * 0.3, 0); c.lineTo(-u * 0.3, -u * 0.12); c.stroke();
    c.fillStyle = "#f07a2b";
    c.beginPath(); c.moveTo(-u * 0.2, -u * 0.08); c.quadraticCurveTo(-u * 0.2, -u * 0.4, 0, -u * 0.62); c.quadraticCurveTo(u * 0.2, -u * 0.4, u * 0.2, -u * 0.08); c.closePath(); c.fill();
    c.fillStyle = "#ffd84a";
    c.beginPath(); c.moveTo(-u * 0.1, -u * 0.08); c.quadraticCurveTo(-u * 0.1, -u * 0.28, 0, -u * 0.4); c.quadraticCurveTo(u * 0.1, -u * 0.28, u * 0.1, -u * 0.08); c.closePath(); c.fill();
  },
  tienda(c, u, i) {
    c.fillStyle = p("vivo", i);
    c.beginPath(); c.moveTo(-u * 0.5, 0); c.lineTo(0, -u * 0.6); c.lineTo(u * 0.5, 0); c.closePath(); c.fill();
    c.fillStyle = oscuro(p("vivo", i), 0.35);
    c.beginPath(); c.moveTo(-u * 0.12, 0); c.lineTo(0, -u * 0.45); c.lineTo(u * 0.12, 0); c.closePath(); c.fill();
    c.fillStyle = "#ffffff30";
    c.beginPath(); c.moveTo(0, -u * 0.6); c.lineTo(u * 0.5, 0); c.lineTo(u * 0.3, 0); c.closePath(); c.fill();
  }
};

const UNIDAD = W => W / 900 * 30;
const prof = y => 0.7 + 0.45 * y;

function pintaPieza(c, pz, W, H, sombra) {
  const f = HOJA[pz.k]; if (!f) return;
  const pr = prof(pz.y);
  c.save();
  c.translate(pz.x * W, pz.y * H);
  if (sombra) { c.shadowColor = "#10201a30"; c.shadowBlur = 2 * pr; c.shadowOffsetY = 1.5 * pr; }
  f(c, UNIDAD(W) * pz.s * pr, pz.c, pz.v, { W, H });
  c.restore();
}

/* ============================================================
   El paisaje entero. `obj` es el disfraz buscado (ya decodificado):
   quien de la multitud coincida en las tres prendas cambia de
   accesorio, en las dos pantallas por igual.
   ============================================================ */
export function pinta(c, esc, W, H, obj) {
  (FONDOS[esc.tema] || FONDOS.lago)(c, W, H, esc);
  for (const pz of esc.piezas) {
    if (pz.k === "persona") pintaPersona(c, vistePersona(pz, obj), W, H);
    else pintaPieza(c, pz, W, H, true);
  }
  // Una luz cálida arriba y una viñeta suave: une las capas en una lámina.
  const g = c.createRadialGradient(W * 0.5, H * 0.45, H * 0.3, W * 0.5, H * 0.5, W * 0.75);
  g.addColorStop(0, "#00000000"); g.addColorStop(1, "#00000038");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

/* ============================================================
   La persona. Pequeña a propósito: unos 22 px en un lienzo de 900, lo
   que ocupa un árbol del fondo. Más grande se ve a la primera; más
   pequeña deja de ser observación y pasa a ser barrer con el ratón.
   ============================================================ */
export const ALTO_PERSONA = 0.042;
const GLOBO = "#e8475f";

/* `pz`: {x, y, c: camiseta, h: gorro (−1 sin), a: accesorio, o: pose,
   m: hacia dónde mira, v: piel y pelo}. `u` se puede forzar (el cartel). */
export function pintaPersona(c, pz, W, H, u) {
  u = u || H * ALTO_PERSONA * (0.8 + 0.35 * pz.y);
  c.save();
  c.translate(pz.x * W, pz.y * H);
  figura(c, pz, u);
  c.restore();
}

function figura(c, pz, u) {
  const m = pz.m < 0 ? -1 : 1, o = pz.o || 0;
  const cam = CAMISETAS[pz.c] || CAMISETAS[0];
  const vi = Math.floor((pz.v || 0) * 36);
  const piel = p("piel", vi), pelo = p("pelo", vi >> 1), pant = p("pantalon", vi >> 2);
  const lw = Math.max(1, u * 0.11);
  c.lineCap = "round"; c.lineJoin = "round";

  if (o === 4) {
    // Nadando: la figura hundida hasta el pecho, recortada en la línea del agua.
    c.fillStyle = "#ffffff55";
    c.beginPath(); c.ellipse(0, 0, u * 0.36, u * 0.08, 0, 0, 7); c.fill();
    if (pz.a === 3) palo(c, m * u * 0.3, u * 0.05, m * u * 0.3, -u * 0.42, u);
    c.save();
    c.beginPath(); c.rect(-u, -u * 2, u * 2, u * 2); c.clip();
    c.translate(0, u * 0.5);
    torso(c, pz, u, m, cam, piel, pelo, 0, true);
    c.restore();
    if (pz.a === 2) globo(c, m * u * 0.26, -u * 0.05, u);
    c.strokeStyle = "#ffffffa0"; c.lineWidth = Math.max(1, u * 0.04);
    c.beginPath(); c.ellipse(0, 0, u * 0.3, u * 0.06, 0, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
    return;
  }

  c.fillStyle = "#00000026";
  c.beginPath(); c.ellipse(0, 0, u * 0.3, u * 0.08, 0, 0, 7); c.fill();

  if (o === 5) {
    // En esquís: un poco inclinado hacia delante, tablas y bastones.
    c.strokeStyle = p("vivo", vi); c.lineWidth = Math.max(1, u * 0.06);
    c.beginPath(); c.moveTo(-m * u * 0.4, 0); c.lineTo(m * u * 0.42, 0); c.lineTo(m * u * 0.5, -u * 0.06); c.stroke();
    c.strokeStyle = "#9aa3ad"; c.lineWidth = Math.max(0.8, u * 0.03);
    c.beginPath(); c.moveTo(m * u * 0.25, -u * 0.42); c.lineTo(-m * u * 0.05, 0); c.moveTo(-m * u * 0.18, -u * 0.42); c.lineTo(-m * u * 0.42, 0); c.stroke();
    c.save(); c.rotate(m * 0.12);
    piernas(c, u, pant, lw, 0.1, 0.1);
    torso(c, pz, u, m, cam, piel, pelo, 0, false);
    c.restore();
    return;
  }

  if (o === 3) {
    // Sentado: las piernas hacia delante y el cuerpo más bajo.
    c.strokeStyle = pant; c.lineWidth = lw;
    c.beginPath(); c.moveTo(-u * 0.05, -u * 0.14); c.lineTo(m * u * 0.26, -u * 0.12); c.lineTo(m * u * 0.3, 0);
    c.moveTo(u * 0.05, -u * 0.14); c.lineTo(m * u * 0.32, -u * 0.1); c.lineTo(m * u * 0.36, 0); c.stroke();
    c.save(); c.translate(0, u * 0.26);
    torso(c, pz, u, m, cam, piel, pelo, 0, false, true);
    c.restore();
    return;
  }

  const paso = o === 1 ? 0.15 : 0.07;
  piernas(c, u, pant, lw, paso, paso);
  torso(c, pz, u, m, cam, piel, pelo, o, false);
}

function piernas(c, u, pant, lw, a, b) {
  c.strokeStyle = pant; c.lineWidth = lw;
  c.beginPath(); c.moveTo(-u * a, 0); c.lineTo(-u * 0.04, -u * 0.4); c.moveTo(u * b, 0); c.lineTo(u * 0.04, -u * 0.4); c.stroke();
  c.fillStyle = "#2a2522";
  c.beginPath(); c.ellipse(-u * a, -u * 0.01, u * 0.06, u * 0.035, 0, 0, 7); c.ellipse(u * b, -u * 0.01, u * 0.06, u * 0.035, 0, 0, 7); c.fill();
}

/* Tronco, brazos, cabeza, gorro y accesorio. `sentado` baja el bastón
   al suelo desde más cerca; `agua` omite lo que quedaría sumergido. */
function torso(c, pz, u, m, cam, piel, pelo, o, agua, sentado) {
  const lw = Math.max(1, u * 0.1);
  // La mochila va detrás: asoma por el lado de la espalda.
  if (pz.a === 1) {
    c.fillStyle = "#7a4e2a";
    c.beginPath(); c.roundRect(-m * u * 0.3, -u * 0.74, u * 0.2, u * 0.32, u * 0.05); c.fill();
    c.fillStyle = "#5c3a1e"; c.fillRect(-m * u * 0.3, -u * 0.6, u * 0.2, u * 0.04);
  }
  // El tronco, con rayas si las lleva.
  c.fillStyle = cam.c;
  c.beginPath(); c.roundRect(-u * 0.17, -u * 0.74, u * 0.34, u * 0.36, u * 0.08); c.fill();
  if (cam.r) {
    c.save(); c.beginPath(); c.roundRect(-u * 0.17, -u * 0.74, u * 0.34, u * 0.36, u * 0.08); c.clip();
    c.fillStyle = cam.r;
    for (let k = 0; k < 4; k++) c.fillRect(-u * 0.2, -u * 0.7 + k * u * 0.09, u * 0.4, u * 0.045);
    c.restore();
  }
  if (pz.a === 1) { c.strokeStyle = "#5c3a1e"; c.lineWidth = Math.max(0.8, u * 0.035); c.beginPath(); c.moveTo(-m * u * 0.05, -u * 0.73); c.lineTo(m * u * 0.02, -u * 0.46); c.stroke(); }
  // Los brazos: manga del color de la camiseta y la mano en piel.
  let mano = [m * u * 0.25, -u * 0.42], otra = [-m * u * 0.25, -u * 0.42];
  if (o === 1) { mano = [m * u * 0.3, -u * 0.46]; otra = [-m * u * 0.2, -u * 0.44]; }
  if (o === 2) mano = [m * u * 0.3, -u * 1.0];
  if (pz.a === 2 && o !== 2) mano = [m * u * 0.3, -u * 0.62];
  if (!agua) {
    c.strokeStyle = cam.c; c.lineWidth = lw;
    c.beginPath(); c.moveTo(m * u * 0.14, -u * 0.68); c.lineTo(mano[0], mano[1]);
    c.moveTo(-m * u * 0.14, -u * 0.68); c.lineTo(otra[0], otra[1]); c.stroke();
    c.fillStyle = piel;
    c.beginPath(); c.arc(mano[0], mano[1], u * 0.055, 0, 7); c.arc(otra[0], otra[1], u * 0.055, 0, 7); c.fill();
  }
  // La cabeza, el pelo y, si lo lleva, el gorro de pompón.
  c.fillStyle = piel; c.beginPath(); c.arc(0, -u * 0.86, u * 0.14, 0, 7); c.fill();
  c.fillStyle = pelo;
  c.beginPath(); c.arc(-m * u * 0.02, -u * 0.9, u * 0.145, Math.PI * 0.95, Math.PI * 2.05); c.fill();
  c.fillStyle = "#2a2522"; c.beginPath(); c.arc(m * u * 0.07, -u * 0.86, Math.max(0.6, u * 0.02), 0, 7); c.fill();
  if (pz.h >= 0) {
    const g = GORROS[pz.h];
    c.fillStyle = g.c;
    c.beginPath(); c.ellipse(0, -u * 0.93, u * 0.15, u * 0.14, 0, Math.PI, 0); c.fill();
    c.fillStyle = oscuro(g.c, 0.22); c.fillRect(-u * 0.16, -u * 0.95, u * 0.32, u * 0.06);
    c.fillStyle = pz.h === 4 ? "#d6392f" : "#fbfaf4";
    c.beginPath(); c.arc(0, -u * 1.09, u * 0.055, 0, 7); c.fill();
  }
  if (pz.a === 2 && !agua) globo(c, mano[0], mano[1], u);
  if (pz.a === 3 && !agua) palo(c, otra[0], otra[1], -m * u * 0.32, sentado ? -u * 0.26 : 0, u);
}

function globo(c, x, y, u) {
  c.strokeStyle = "#555"; c.lineWidth = Math.max(0.6, u * 0.02);
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + u * 0.08, y - u * 0.35, x + u * 0.05, y - u * 0.62); c.stroke();
  c.fillStyle = GLOBO; c.beginPath(); c.ellipse(x + u * 0.05, y - u * 0.74, u * 0.12, u * 0.14, 0, 0, 7); c.fill();
  c.fillStyle = "#ffffff70"; c.beginPath(); c.arc(x + u * 0.01, y - u * 0.79, u * 0.035, 0, 7); c.fill();
}
function palo(c, x0, y0, x1, y1, u) {
  c.strokeStyle = "#6b3f1f"; c.lineWidth = Math.max(1, u * 0.05);
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x0, y0 - u * 0.02);
  c.arc(x0 + (x1 < x0 ? 0.05 : -0.05) * u, y0 - u * 0.02, u * 0.05, Math.PI, 0, x1 < x0); c.stroke();
}

/* El escondido: su disfraz, en la pose que le toca donde está. */
export function comoPersona(sitio, esc) {
  const d = traje(sitio.traje || 0);
  return { k: "persona", x: sitio.x, y: sitio.y, s: 1, c: d.s, h: d.h, a: d.a, o: poseEn(esc, sitio.x, sitio.y), m: 1, v: 0.37 };
}
export function pintaExplorador(c, sitio, W, H, esc) {
  pintaPersona(c, comoPersona(sitio, esc), W, H);
}

/* El cartel de «SE BUSCA»: la figura en grande, de pie y de frente. */
export function pintaCartel(c, t, W, H) {
  const d = traje(t);
  c.clearRect(0, 0, W, H);
  pintaPersona(c, { x: 0.5, y: 0.93, c: d.s, h: d.h, a: d.a, o: 0, m: 1, v: 0.37 }, W, H, H * 0.62);
}

/* Cobertura parcial: lo que está justo delante tapa las piernas, nunca
   la cabeza. */
export function pintaCobertura(c, esc, sitio, W, H) {
  const u = H * ALTO_PERSONA * (0.8 + 0.35 * sitio.y);
  c.save(); c.beginPath(); c.rect(sitio.x * W - u * 0.6, sitio.y * H - u * 0.36, u * 1.2, u * 0.5); c.clip();
  for (const pz of esc.piezas) {
    if (pz.k === "persona" || pz.y < sitio.y || pz.y - sitio.y > 0.06 || Math.abs(pz.x - sitio.x) > 0.06) continue;
    if (pz.k === "noria" || pz.k === "cabana" || pz.k === "faro") continue;
    pintaPieza(c, pz, W, H, false);
  }
  c.restore();
}
