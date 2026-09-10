"use strict";
/* ============================================================
   Escondite — el paisaje, pintado

   `motor.js` decide *qué* piezas hay y dónde; aquí solo se trazan.
   Están separados por una razón práctica: el reparto de las piezas es
   lo único que las dos máquinas tienen que compartir, y es un número.
   Si el fondo fuera una imagen habría que subirla a algún sitio,
   servirla con CORS y esperar a que descargue antes de empezar; con
   esto el paisaje aparece en el primer fotograma y no hay servidor
   que valga.

   Las piezas se dibujan con trazos deliberadamente simples y con
   paletas de seis tonos: lo que hace difícil el escondite no es el
   detalle, es la repetición. Doscientos árboles casi iguales esconden
   a una persona mucho mejor que un bosque fotográfico.
   ============================================================ */
import { TEMAS } from "./motor.js";

/* Seis tonos por familia de pieza. El índice `c` de cada pieza elige
   uno; que sean parecidos entre sí es justo lo que se busca. */
const PAL = {
  verde:  ["#3f7a35", "#2f6b2b", "#4d8a3c", "#356e30", "#588f45", "#2a5f26"],
  tronco: ["#6b4a2f", "#5a3d27", "#7a5636", "#4e3521", "#82603d", "#63452b"],
  piedra: ["#8a8f94", "#767c82", "#9aa0a6", "#6a7076", "#a4aab0", "#7f858b"],
  flor:   ["#e05c7a", "#e8a33d", "#c86bd8", "#f0e05a", "#e8734a", "#f2a8c4"],
  arena:  ["#d9c08a", "#c9ad76", "#e3cd9c", "#bfa068", "#eddaae", "#d0b47f"],
  ciudad: ["#5d666f", "#4c545c", "#6d767f", "#414951", "#7c858e", "#565e66"],
  nieve:  ["#e8f0f6", "#d6e3ee", "#f2f7fb", "#c8d8e6", "#dfeaf3", "#eef4f9"],
  astro:  ["#6a5acd", "#c05a8f", "#4a8fd4", "#d4903a", "#5ab0a0", "#8f5ad4"],
  vivo:   ["#d64b3a", "#3a7fd6", "#d6a03a", "#3ad67f", "#d63a9f", "#7f3ad6"]
};

const p = (fam, i) => PAL[fam][i % 6];

/* ---------- las piezas ----------
   Cada una se dibuja alrededor del origen, mirando hacia arriba, con
   una unidad `u`. El giro, la posición y la escala los pone `pinta()`
   con la matriz del contexto, así que aquí no hay trigonometría. */

const HOJA = {
  arbol(c, u, i, v) {
    c.fillStyle = p("tronco", i + 2);
    c.fillRect(-u * 0.09, -u * 0.5, u * 0.18, u * 0.5);
    c.fillStyle = p("verde", i);
    const n = 2 + Math.floor(v * 3);
    for (let k = 0; k < n; k++) {
      const y = -u * (0.5 + k * 0.42), r = u * (0.62 - k * 0.13);
      c.beginPath(); c.moveTo(-r, y); c.lineTo(r, y); c.lineTo(0, y - u * 0.62); c.closePath(); c.fill();
    }
  },
  pino(c, u, i, v) {
    c.fillStyle = p("tronco", i + 1);
    c.fillRect(-u * 0.08, -u * 0.45, u * 0.16, u * 0.45);
    c.fillStyle = p("verde", i + 3);
    for (let k = 0; k < 3; k++) {
      const y = -u * (0.45 + k * 0.34), r = u * (0.5 - k * 0.11);
      c.beginPath(); c.moveTo(-r, y); c.lineTo(r, y); c.lineTo(0, y - u * 0.55); c.closePath(); c.fill();
    }
    c.fillStyle = "#ffffff88";
    c.beginPath(); c.moveTo(-u * 0.2, -u * 1.1); c.lineTo(u * 0.2, -u * 1.1); c.lineTo(0, -u * 1.4); c.closePath(); c.fill();
  },
  mata(c, u, i, v) {
    c.fillStyle = p("verde", i + 1);
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.ellipse((k - 1) * u * 0.3, -u * (0.12 + v * 0.1), u * (0.3 + v * 0.1), u * (0.22 + v * 0.1), 0, 0, 7);
      c.fill();
    }
  },
  arbusto(c, u, i, v) { HOJA.mata(c, u, i + 2, v); },
  roca(c, u, i, v) {
    c.fillStyle = p("piedra", i);
    c.beginPath();
    c.moveTo(-u * 0.45, 0); c.lineTo(-u * (0.28 + v * 0.1), -u * 0.36);
    c.lineTo(u * 0.1, -u * 0.44); c.lineTo(u * 0.42, -u * 0.14); c.lineTo(u * 0.36, 0);
    c.closePath(); c.fill();
    c.fillStyle = "#ffffff20";
    c.beginPath(); c.moveTo(-u * 0.2, -u * 0.3); c.lineTo(u * 0.05, -u * 0.4); c.lineTo(0, -u * 0.2); c.closePath(); c.fill();
  },
  flor(c, u, i, v) {
    c.strokeStyle = p("verde", i); c.lineWidth = Math.max(1, u * 0.05);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.38); c.stroke();
    c.fillStyle = p("flor", i);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.2566;
      c.beginPath(); c.ellipse(Math.cos(a) * u * 0.13, -u * 0.38 + Math.sin(a) * u * 0.13, u * 0.1, u * 0.1, 0, 0, 7); c.fill();
    }
    c.fillStyle = "#f7e07a";
    c.beginPath(); c.ellipse(0, -u * 0.38, u * 0.07, u * 0.07, 0, 0, 7); c.fill();
  },
  tronco(c, u, i, v) {
    c.fillStyle = p("tronco", i);
    c.beginPath(); c.roundRect(-u * 0.5, -u * 0.18, u, u * 0.24, u * 0.1); c.fill();
    c.fillStyle = "#00000030";
    c.beginPath(); c.ellipse(u * 0.46, -u * 0.06, u * 0.06, u * 0.11, 0, 0, 7); c.fill();
  },
  seta(c, u, i, v) {
    c.fillStyle = "#f0e6d2";
    c.fillRect(-u * 0.07, -u * 0.24, u * 0.14, u * 0.24);
    c.fillStyle = p("flor", i);
    c.beginPath(); c.ellipse(0, -u * 0.24, u * 0.22, u * 0.16, 0, Math.PI, 0); c.fill();
  },
  palmera(c, u, i, v) {
    c.strokeStyle = p("tronco", i); c.lineWidth = u * 0.12; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(u * 0.12, -u * 0.6, u * (0.05 + v * 0.2), -u * 1.15); c.stroke();
    c.strokeStyle = p("verde", i + 2); c.lineWidth = u * 0.09;
    const bx = u * (0.05 + v * 0.2), by = -u * 1.15;
    for (let k = 0; k < 6; k++) {
      const a = -0.4 + k * 0.58;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + Math.cos(a) * u * 0.4, by + Math.sin(a) * u * 0.35 - u * 0.2,
                         bx + Math.cos(a) * u * 0.7, by + Math.sin(a) * u * 0.55);
      c.stroke();
    }
  },
  sombrilla(c, u, i, v) {
    c.strokeStyle = "#9a9a9a"; c.lineWidth = u * 0.06;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.75); c.stroke();
    for (let k = 0; k < 6; k++) {
      c.fillStyle = k % 2 ? "#ffffff" : p("flor", i);
      c.beginPath(); c.moveTo(0, -u * 0.78);
      c.arc(0, -u * 0.78, u * 0.55, Math.PI + k * 0.5236, Math.PI + (k + 1) * 0.5236);
      c.closePath(); c.fill();
    }
  },
  concha(c, u, i, v) {
    c.fillStyle = p("arena", i + 3);
    c.beginPath(); c.arc(0, 0, u * 0.2, Math.PI, 0); c.closePath(); c.fill();
    c.strokeStyle = "#00000025"; c.lineWidth = Math.max(0.6, u * 0.03);
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(-u * 0.2 + k * u * 0.1, -u * 0.19); c.stroke(); }
  },
  cangrejo(c, u, i, v) {
    c.fillStyle = p("vivo", i);
    c.beginPath(); c.ellipse(0, -u * 0.14, u * 0.22, u * 0.15, 0, 0, 7); c.fill();
    c.strokeStyle = p("vivo", i); c.lineWidth = u * 0.05;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * u * 0.2, -u * 0.16); c.lineTo(s * u * 0.36, -u * 0.3); c.stroke();
      c.beginPath(); c.moveTo(s * u * 0.16, -u * 0.05); c.lineTo(s * u * 0.3, u * 0.02); c.stroke();
    }
  },
  edificio(c, u, i, v) {
    const w = u * (0.5 + v * 0.4), h = u * (1 + v * 1.4);
    c.fillStyle = p("ciudad", i);
    c.fillRect(-w / 2, -h, w, h);
    c.fillStyle = "#f5e6a8aa";
    const fil = Math.max(2, Math.floor(h / (u * 0.3))), col = Math.max(1, Math.floor(w / (u * 0.24)));
    for (let a = 0; a < fil; a++) for (let b = 0; b < col; b++)
      if ((a * 7 + b * 3 + i) % 3) c.fillRect(-w / 2 + u * 0.08 + b * u * 0.24, -h + u * 0.1 + a * u * 0.3, u * 0.1, u * 0.16);
  },
  farola(c, u, i, v) {
    c.strokeStyle = "#3f474e"; c.lineWidth = u * 0.06;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.95); c.stroke();
    c.fillStyle = "#f7e9a0";
    c.beginPath(); c.ellipse(0, -u, u * 0.13, u * 0.09, 0, 0, 7); c.fill();
  },
  coche(c, u, i, v) {
    c.fillStyle = p("vivo", i);
    c.beginPath(); c.roundRect(-u * 0.45, -u * 0.3, u * 0.9, u * 0.3, u * 0.06); c.fill();
    c.beginPath(); c.roundRect(-u * 0.26, -u * 0.5, u * 0.5, u * 0.22, u * 0.07); c.fill();
    c.fillStyle = "#2b2f33";
    for (const x of [-u * 0.26, u * 0.26]) { c.beginPath(); c.arc(x, 0, u * 0.1, 0, 7); c.fill(); }
  },
  banco(c, u, i, v) {
    c.fillStyle = p("tronco", i + 4);
    c.fillRect(-u * 0.35, -u * 0.22, u * 0.7, u * 0.08);
    c.fillRect(-u * 0.35, -u * 0.42, u * 0.7, u * 0.07);
    c.fillStyle = "#4a5057";
    c.fillRect(-u * 0.32, -u * 0.22, u * 0.05, u * 0.22);
    c.fillRect(u * 0.27, -u * 0.22, u * 0.05, u * 0.22);
  },
  senal(c, u, i, v) {
    c.strokeStyle = "#8b9199"; c.lineWidth = u * 0.05;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.6); c.stroke();
    c.fillStyle = p("vivo", i + 1);
    c.beginPath(); c.arc(0, -u * 0.7, u * 0.16, 0, 7); c.fill();
  },
  muneco(c, u, i, v) {
    c.fillStyle = "#f4f9fc";
    c.beginPath(); c.arc(0, -u * 0.16, u * 0.2, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -u * 0.44, u * 0.14, 0, 7); c.fill();
    c.fillStyle = "#2b2f33";
    c.beginPath(); c.arc(-u * 0.05, -u * 0.47, u * 0.02, 0, 7); c.fill();
    c.beginPath(); c.arc(u * 0.05, -u * 0.47, u * 0.02, 0, 7); c.fill();
  },
  valla(c, u, i, v) {
    c.fillStyle = p("tronco", i + 3);
    for (let k = -1; k <= 1; k++) c.fillRect(k * u * 0.22 - u * 0.04, -u * 0.4, u * 0.08, u * 0.4);
    c.fillRect(-u * 0.3, -u * 0.3, u * 0.6, u * 0.06);
  },
  planeta(c, u, i, v) {
    c.fillStyle = p("astro", i);
    c.beginPath(); c.arc(0, -u * 0.2, u * (0.18 + v * 0.2), 0, 7); c.fill();
    if (v > 0.6) {
      c.strokeStyle = "#ffffff55"; c.lineWidth = u * 0.05;
      c.beginPath(); c.ellipse(0, -u * 0.2, u * 0.42, u * 0.11, -0.35, 0, 7); c.stroke();
    }
  },
  estrella(c, u, i, v) {
    c.fillStyle = "#fdf6c8";
    const r = u * (0.06 + v * 0.08);
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, rr = k % 2 ? r * 0.4 : r;
      c[k ? "lineTo" : "moveTo"](Math.cos(a) * rr, -u * 0.2 + Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
  },
  cohete(c, u, i, v) {
    c.fillStyle = "#dfe6ec";
    c.beginPath(); c.moveTo(0, -u * 0.55); c.lineTo(u * 0.13, -u * 0.2); c.lineTo(-u * 0.13, -u * 0.2); c.closePath(); c.fill();
    c.fillStyle = p("vivo", i);
    c.fillRect(-u * 0.13, -u * 0.22, u * 0.26, u * 0.2);
    c.fillStyle = "#f0a13a";
    c.beginPath(); c.moveTo(-u * 0.08, 0); c.lineTo(u * 0.08, 0); c.lineTo(0, u * 0.16); c.closePath(); c.fill();
  },
  cristal(c, u, i, v) {
    c.fillStyle = p("astro", i + 2);
    c.beginPath(); c.moveTo(0, -u * 0.5); c.lineTo(u * 0.16, -u * 0.12); c.lineTo(0, 0); c.lineTo(-u * 0.16, -u * 0.12); c.closePath(); c.fill();
    c.fillStyle = "#ffffff33";
    c.beginPath(); c.moveTo(0, -u * 0.5); c.lineTo(u * 0.16, -u * 0.12); c.lineTo(0, -u * 0.1); c.closePath(); c.fill();
  },
  antena(c, u, i, v) {
    c.strokeStyle = "#9aa3ac"; c.lineWidth = u * 0.05;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.5); c.stroke();
    c.beginPath(); c.arc(0, -u * 0.55, u * 0.16, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
};

/* ---------- el paisaje entero ---------- */

export function pinta(c, esc, W, H) {
  const t = TEMAS[esc.tema];
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, t.cielo[0]); g.addColorStop(1, t.cielo[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  /* Suelo con un horizonte alto: casi todo el lienzo es terreno, que
     es donde se puede esconder algo. */
  const hz = H * 0.17;
  const g2 = c.createLinearGradient(0, hz, 0, H);
  g2.addColorStop(0, t.suelo); g2.addColorStop(1, sombra(t.suelo, 0.22));
  c.fillStyle = g2; c.fillRect(0, hz, W, H - hz);

  const u0 = W / 900 * 30;
  for (const pz of esc.piezas) {
    const f = HOJA[pz.k]; if (!f) continue;
    /* Las de arriba se dibujan más pequeñas: da profundidad y, de
       paso, hace que el fondo tenga piezas de todos los tamaños, que
       es lo que impide fijarse solo en las grandes. */
    const prof = 0.45 + pz.y * 0.85;
    c.save();
    c.translate(pz.x * W, pz.y * H);
    c.rotate(pz.g * 0.35);
    c.globalAlpha = 0.92 + pz.v * 0.08;
    f(c, u0 * pz.s * prof, pz.c, pz.v);
    c.restore();
  }
  c.globalAlpha = 1;
}

function sombra(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = x => Math.max(0, Math.round(x * (1 - k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ---------- la persona ----------
   Pequeña a propósito: unos 22 px de alto en un lienzo de 900, que es
   más o menos lo que ocupa un árbol de los del fondo. Más grande se ve
   a la primera; más pequeña deja de ser observación y pasa a ser
   barrer la pantalla con el ratón. */
export const ALTO_PERSONA = 0.042;       // fracción del alto del lienzo

export function pintaPersona(c, x, y, W, H, color, fantasma) {
  const u = H * ALTO_PERSONA;
  c.save();
  c.translate(x * W, y * H);
  c.globalAlpha = fantasma ? 0.45 : 1;
  c.fillStyle = "#00000022";
  c.beginPath(); c.ellipse(0, 0, u * 0.3, u * 0.09, 0, 0, 7); c.fill();
  c.strokeStyle = "#2e2a26"; c.lineWidth = Math.max(1, u * 0.1); c.lineCap = "round";
  c.beginPath(); c.moveTo(-u * 0.16, 0); c.lineTo(0, -u * 0.42); c.lineTo(u * 0.16, 0); c.stroke();
  c.fillStyle = color;
  c.beginPath(); c.roundRect(-u * 0.17, -u * 0.74, u * 0.34, u * 0.36, u * 0.1); c.fill();
  c.strokeStyle = color;
  c.beginPath(); c.moveTo(-u * 0.17, -u * 0.66); c.lineTo(-u * 0.32, -u * 0.4); c.stroke();
  c.beginPath(); c.moveTo(u * 0.17, -u * 0.66); c.lineTo(u * 0.32, -u * 0.4); c.stroke();
  c.fillStyle = "#e8b98d";
  c.beginPath(); c.arc(0, -u * 0.86, u * 0.15, 0, 7); c.fill();
  c.fillStyle = "#3a2f28";
  c.beginPath(); c.arc(0, -u * 0.92, u * 0.15, Math.PI, 0); c.fill();
  c.restore();
}
