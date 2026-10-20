/* Pool — el dibujo: la mesa, las bolas con volumen y el taco.
 *
 * Todo se pinta con canvas 2D, sin imágenes que alojar, y las tres piezas
 * que hacen que parezca un billar y no un esquema son éstas:
 *
 * - **La mesa es una capa que se pinta una vez** (`dibujaMesa`) y se copia
 *   en cada cuadro: madera con veta, bandas de goma con sus puntas, paño con
 *   fibra y luz cenital, troneras con su aro y los diamantes de nácar. Se
 *   rehace solo al cambiar de tamaño. Se dibuja directamente en milímetros
 *   (la transformación del canvas pasa de mm a píxeles y gira el eje `y`
 *   hacia arriba, como en el motor), así que las coordenadas de la física y
 *   las del dibujo son las mismas.
 * - **Cada bola es una esfera de verdad** (`pintaBola`): para cada píxel se
 *   calcula la normal, se lleva al marco propio de la bola con su matriz de
 *   orientación y se decide ahí si toca color, banda blanca, círculo del
 *   número o punto de la blanca; luego se ilumina (difusa, brillo
 *   especular y un reflejo ancho). Como la orientación se integra con la
 *   velocidad angular que simula el motor, las bolas ruedan de verdad: la
 *   raya gira, el número se va, y una blanca con efecto lateral se ve
 *   girar sobre sí misma. La orientación es solo visual: no entra en la
 *   física y por eso puede usar trigonometría.
 * - **El taco** es un sólido con gradiente de cilindro: punta con tiza,
 *   férula, fuste de arce, unión de latón y mango oscuro con aros.
 */
import { PL, PL_BOLSILLOS } from "./motor.js";

export const MARCO = 130;                                  // madera + banda alrededor del paño (mm)
export const MUNDO = { w: PL.L + 2 * MARCO, h: PL.W + 2 * MARCO };
const BANDA = 54;                                          // grosor de la goma de la banda (mm)

/* Azar con semilla: la veta de la madera y el grano del paño son los mismos
   en cada repintado. */
function azar(sem) {
  let s = (sem >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}

/* ---------- colores de las bolas ---------- */
const PALETA = {
  1: [247, 198, 18], 2: [20, 82, 196], 3: [216, 40, 40], 4: [102, 44, 146],
  5: [240, 120, 24], 6: [14, 126, 66], 7: [132, 30, 38], 8: [20, 20, 24]
};
const base = id => PALETA[id <= 8 ? id : id - 8];
export const colorBola = id => (id === 0 ? "#f4f0e6" : "rgb(" + base(id).join(",") + ")");

/* ---------- matrices 3×3 (fila por fila): mundo = Q · local ---------- */
export const matId = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
function matMul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
/* Gira Q un ángulo |ω|·dt alrededor del eje ω (Rodrigues). */
export function rota(Q, wx, wy, wz, dt) {
  const w = Math.sqrt(wx * wx + wy * wy + wz * wz), ang = w * dt;
  if (ang < 1e-7) return Q;
  const ax = wx / w, ay = wy / w, az = wz / w, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const R = [
    t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
    t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
    t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c
  ];
  const r = matMul(R, Q);
  // un poco de Gram-Schmidt para que muchas vueltas no deformen la matriz
  const n0 = Math.hypot(r[0], r[3], r[6]) || 1;
  return r.map((x, i) => (i % 3 === 0 ? x / n0 : x));
}
/* Orientación de salida: la cara del número hacia arriba (para quien mira)
   y girada en el plano de forma distinta para cada bola. */
export function oriInicial(id) {
  const M0 = [0, 0, -1, 0, 1, 0, 1, 0, 0];
  const r = azar(id * 7919 + 13), th = r() * 6.2832;
  const c = Math.cos(th), s = Math.sin(th);
  let Q = matMul([c, -s, 0, s, c, 0, 0, 0, 1], M0);
  if (id === 0) Q = rota(rota(Q, 1, 0, 0, 0.7), 0, 1, 0, 1.9);
  else Q = rota(rota(Q, 1, 0, 0, (r() - 0.5) * 0.5), 0, 1, 0, (r() - 0.5) * 0.4);
  return Q;
}

/* ---------- texturas de los números ---------- */
const texNum = {};
function textura(n) {
  if (texNum[n]) return texNum[n];
  const T = 64, cv = document.createElement("canvas");
  cv.width = cv.height = T;
  const g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, T, T);
  g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "bold " + (n > 9 ? 36 : 46) + "px Arial, Helvetica, sans-serif";
  g.fillText(String(n), T / 2, T / 2 + 2);
  if (n === 6 || n === 9) { g.fillRect(T / 2 - 9, T / 2 + 22, 18, 4); }   // el subrayado que distingue 6 y 9
  const d = g.getImageData(0, 0, T, T).data, a = new Uint8Array(T * T);
  for (let i = 0; i < T * T; i++) a[i] = d[i * 4];
  return (texNum[n] = { a, T });
}
function muestra(tx, u, v) {            // u, v en −1…1; devuelve 0 (tinta) … 1 (blanco)
  const T = tx.T, x = (u * 0.5 + 0.5) * (T - 1), y = (v * 0.5 + 0.5) * (T - 1);
  if (x < 0 || y < 0 || x > T - 1 || y > T - 1) return 1;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(T - 1, x0 + 1), y1 = Math.min(T - 1, y0 + 1);
  const fx = x - x0, fy = y - y0, A = tx.a;
  const a = A[y0 * T + x0] * (1 - fx) + A[y0 * T + x1] * fx, b = A[y1 * T + x0] * (1 - fx) + A[y1 * T + x1] * fx;
  return (a * (1 - fy) + b * fy) / 255;
}

/* ---------- la bola ---------- */
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const LUZ = nrm(-0.42, 0.55, 0.72);
const MEDIA = nrm(LUZ[0], LUZ[1], LUZ[2] + 1);
const LUZ2 = nrm(0.55, -0.2, 0.8);
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const imgs = {};

/* Pinta la bola `id` con orientación `Q` en un canvas de `S`×`S` píxeles
   (el disco ocupa el centro, con un píxel de margen para el borde suave). */
export function pintaBola(cv, id, Q, S) {
  const g = cv.getContext("2d");
  const img = imgs[S] || (imgs[S] = g.createImageData(S, S)), d = img.data;
  const rad = S / 2 - 1, cx = S / 2;
  const rayada = id > 8, num = id === 0 ? 0 : id <= 8 ? id : id - 8;
  const col = id === 0 ? [246, 243, 234] : base(id);
  const tx = id === 0 ? null : textura(id);
  const blanco = [247, 245, 238];
  const q0 = Q[0], q1 = Q[1], q2 = Q[2], q3 = Q[3], q4 = Q[4], q5 = Q[5], q6 = Q[6], q7 = Q[7], q8 = Q[8];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const k = (py * S + px) * 4;
    const x0 = (px + 0.5 - cx) / rad, y0 = (py + 0.5 - cx) / rad;
    const d2 = x0 * x0 + y0 * y0;
    if (d2 > 1.15) { d[k + 3] = 0; continue; }
    const dist = Math.sqrt(d2);
    const cov = Math.max(0, Math.min(1, (1 - dist) * rad + 0.5));
    if (cov <= 0) { d[k + 3] = 0; continue; }
    let nx = x0, ny = -y0, nz;
    if (d2 >= 1) { nx /= dist; ny /= dist; nz = 0; } else nz = Math.sqrt(1 - d2);
    // marco propio de la bola
    const lx = q0 * nx + q3 * ny + q6 * nz, ly = q1 * nx + q4 * ny + q7 * nz, lz = q2 * nx + q5 * ny + q8 * nz;
    let r = col[0], gg = col[1], b = col[2];
    if (id === 0) {
      // los puntos de la blanca: se ve cómo gira
      const m = Math.max(Math.abs(lx), Math.abs(ly), Math.abs(lz));
      const p = suave(0.975, 0.985, m);
      r += (196 - r) * p; gg += (44 - gg) * p; b += (44 - b) * p;
    } else {
      const bandaBlanca = rayada ? suave(0.52, 0.565, Math.abs(ly)) : 0;       // fuera de la franja: blanco
      r += (blanco[0] - r) * bandaBlanca; gg += (blanco[1] - gg) * bandaBlanca; b += (blanco[2] - b) * bandaBlanca;
      const ax = Math.abs(lx);
      const circ = suave(0.89, 0.905, ax);                                      // los dos círculos del número
      if (circ > 0) {
        const s = lx > 0 ? 1 : -1;
        const tinta = muestra(tx, (s * lz) / 0.44, -ly / 0.44);
        const v = 247 * tinta + 14 * (1 - tinta);
        r += (v - r) * circ; gg += (v - gg) * circ; b += (v - b) * circ;
      }
    }
    // iluminación
    const ndl = Math.max(0, nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]);
    const ndl2 = Math.max(0, nx * LUZ2[0] + ny * LUZ2[1] + nz * LUZ2[2]);
    let dif = 0.3 + 0.78 * ndl + 0.1 * ndl2;
    dif *= 0.78 + 0.22 * nz;
    const ndh = Math.max(0, nx * MEDIA[0] + ny * MEDIA[1] + nz * MEDIA[2]);
    let e = ndh * ndh; e *= e; e *= e; const e16 = e; e *= e; e *= e;           // ndh^64 (y ndh^16 por el camino)
    const brillo = e * 0.95 + e16 * 0.13;
    const rebote = (1 - nz) * (1 - nz) * 14 * Math.max(0, nx * 0.4 - ny * 0.8);   // luz verde que sube del paño
    r = r * dif + brillo * 255 + rebote * 0.3;
    gg = gg * dif + brillo * 255 + rebote * 0.9;
    b = b * dif + brillo * 255 + rebote * 0.35;
    d[k] = r > 255 ? 255 : r; d[k + 1] = gg > 255 ? 255 : gg; d[k + 2] = b > 255 ? 255 : b;
    d[k + 3] = cov * 255;
  }
  g.putImageData(img, 0, 0);
}

/* La sombra de una bola (un disco difuso) para no recalcularla. */
export function sombraBola(S) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d"), r = S / 2;
  const gr = g.createRadialGradient(r, r, r * 0.25, r, r, r);
  gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(0.55, "rgba(0,0,0,.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return cv;
}

/* ---------- la mesa ---------- */
function rrect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

/* Dibuja la mesa entera en `cv` (de MUNDO·s píxeles). */
export function dibujaMesa(cv, s) {
  const c = cv.getContext("2d");
  const { L, W } = PL;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, -s, MARCO * s, (MARCO + W) * s);
  const r = azar(2468);

  // — madera —
  const marco = { x: -MARCO, y: -MARCO, w: L + 2 * MARCO, h: W + 2 * MARCO };
  let gr = c.createLinearGradient(-MARCO, W + MARCO, L + MARCO, -MARCO);
  gr.addColorStop(0, "#7a4423"); gr.addColorStop(0.35, "#5a2e15"); gr.addColorStop(0.7, "#4b2511"); gr.addColorStop(1, "#6a3a1c");
  c.fillStyle = gr; rrect(c, marco.x, marco.y, marco.w, marco.h, 46); c.fill();
  c.save();
  rrect(c, marco.x, marco.y, marco.w, marco.h, 46); c.clip();
  for (let i = 0; i < 340; i++) {
    const y = marco.y + r() * marco.h, x0 = marco.x + r() * marco.w * 0.6, len = 300 + r() * 1700, amp = 2 + r() * 7, fase = r() * 6;
    c.beginPath(); c.moveTo(x0, y);
    for (let k = 1; k <= 12; k++) c.lineTo(x0 + (len * k) / 12, y + Math.sin(fase + k * 0.55) * amp);
    c.strokeStyle = r() < 0.55 ? "rgba(20,8,0," + (0.05 + r() * 0.1).toFixed(3) + ")" : "rgba(255,205,150," + (0.02 + r() * 0.05).toFixed(3) + ")";
    c.lineWidth = 1 + r() * 4; c.stroke();
  }
  for (let i = 0; i < 160; i++) {            // veta de los lados cortos, en vertical
    const x = marco.x + r() * marco.w, y0 = marco.y + r() * marco.h * 0.5, len = 200 + r() * 900;
    c.beginPath(); c.moveTo(x, y0);
    for (let k = 1; k <= 8; k++) c.lineTo(x + Math.sin(k * 0.8 + r()) * 3, y0 + (len * k) / 8);
    c.strokeStyle = "rgba(25,10,0," + (0.04 + r() * 0.07).toFixed(3) + ")"; c.lineWidth = 1 + r() * 3; c.stroke();
  }
  // brillo del barniz: una franja diagonal suave
  gr = c.createLinearGradient(-MARCO, W + MARCO, L * 0.55, -MARCO);
  gr.addColorStop(0, "rgba(255,225,180,.16)"); gr.addColorStop(0.5, "rgba(255,225,180,0)"); gr.addColorStop(1, "rgba(0,0,0,.18)");
  c.fillStyle = gr; c.fillRect(marco.x, marco.y, marco.w, marco.h);
  c.restore();
  // bisel del marco
  c.lineWidth = 5; c.strokeStyle = "rgba(255,215,165,.28)"; rrect(c, marco.x + 6, marco.y + 6, marco.w - 12, marco.h - 12, 42); c.stroke();
  c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.6)"; rrect(c, marco.x, marco.y, marco.w, marco.h, 46); c.stroke();
  // canto interior de la madera, alrededor de las bandas
  c.lineWidth = 5; c.strokeStyle = "rgba(0,0,0,.55)"; c.strokeRect(-BANDA - 6, -BANDA - 6, L + 2 * BANDA + 12, W + 2 * BANDA + 12);

  // — diamantes de nácar sobre la madera —
  const dist = (MARCO + BANDA) / 2 + 2, rombo = (x, y) => {
    c.save(); c.translate(x, y);
    const g = c.createLinearGradient(-14, -14, 14, 14);
    g.addColorStop(0, "#fffbee"); g.addColorStop(0.5, "#e3d6b4"); g.addColorStop(1, "#a8976b");
    c.beginPath(); c.moveTo(0, 17); c.lineTo(12, 0); c.lineTo(0, -17); c.lineTo(-12, 0); c.closePath();
    c.fillStyle = g; c.fill(); c.lineWidth = 2.2; c.strokeStyle = "rgba(60,35,10,.8)"; c.stroke();
    c.restore();
  };
  for (const k of [1, 2, 3, 5, 6, 7]) { rombo((L * k) / 8, -dist); rombo((L * k) / 8, W + dist); }
  for (const k of [1, 2, 3]) { rombo(-dist, (W * k) / 4); rombo(L + dist, (W * k) / 4); }

  // — paño —
  gr = c.createRadialGradient(L / 2, W / 2, 60, L / 2, W / 2, L * 0.62);
  gr.addColorStop(0, "#2f9d5d"); gr.addColorStop(0.55, "#238549"); gr.addColorStop(1, "#16613a");
  c.fillStyle = gr; c.fillRect(-4, -4, L + 8, W + 8);
  // fibra del paño: ruido fino en píxeles de pantalla, recortado a la mesa
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  const pr = azar(777), ruido = document.createElement("canvas"); ruido.width = ruido.height = 128;
  const rg = ruido.getContext("2d"), ri = rg.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = pr() < 0.5 ? 0 : 255; ri.data[i * 4] = ri.data[i * 4 + 1] = ri.data[i * 4 + 2] = v; ri.data[i * 4 + 3] = 7 + pr() * 14; }
  rg.putImageData(ri, 0, 0);
  c.fillStyle = c.createPattern(ruido, "repeat");
  c.fillRect(MARCO * s - 4, MARCO * s - 4, L * s + 8, W * s + 8);
  c.restore();
  // luz de la lámpara y sombra junto a las bandas
  gr = c.createRadialGradient(L * 0.5, W * 0.5, 40, L * 0.5, W * 0.5, L * 0.58);
  gr.addColorStop(0, "rgba(255,255,205,.13)"); gr.addColorStop(1, "rgba(0,20,10,.2)");
  c.fillStyle = gr; c.fillRect(0, 0, L, W);
  const sombra = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,12,6,.42)"); g.addColorStop(1, "rgba(0,12,6,0)");
    c.fillStyle = g; c.fillRect(rx, ry, rw, rh);
  };
  sombra(0, 0, 0, 46, 0, 0, L, 46); sombra(0, W, 0, W - 46, 0, W - 46, L, 46);
  sombra(0, 46, 46, 46, 0, 46, 46, W - 92); sombra(L, 46, L - 46, 46, L - 46, 46, 46, W - 92);

  // — marcas del paño —
  c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = 2.4; c.setLineDash([22, 14]);
  c.beginPath(); c.moveTo(L / 4, 6); c.lineTo(L / 4, W - 6); c.stroke(); c.setLineDash([]);
  for (const [x, y] of [[L / 4, W / 2], [L / 2, W / 2], [L * 0.75, W / 2]]) {
    c.beginPath(); c.arc(x, y, 5.5, 0, 6.2832); c.fillStyle = "rgba(0,35,15,.55)"; c.fill();
  }
  c.save(); c.translate(L * 0.5, W * 0.5); c.scale(1, -1);
  c.fillStyle = "rgba(255,255,255,.055)"; c.font = "bold 70px Georgia, 'Times New Roman', serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("PAGINITA PRO", 0, 0);
  c.restore();

  // — troneras: el aro de cuero, el hueco y el borde de latón —
  const tronera = (p, ox, oy, rh) => {
    const x = p.x + ox, y = p.y + oy;
    let g = c.createRadialGradient(x, y, rh * 0.5, x, y, rh * 1.75);
    g.addColorStop(0, "#241209"); g.addColorStop(0.6, "#3a2112"); g.addColorStop(1, "rgba(58,33,18,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rh * 1.75, 0, 6.2832); c.fill();
    g = c.createRadialGradient(x - rh * 0.25, y + rh * 0.25, rh * 0.2, x, y, rh * 1.25);
    g.addColorStop(0, "#d8dde3"); g.addColorStop(0.55, "#8e959e"); g.addColorStop(1, "#4a4f57");
    c.strokeStyle = g; c.lineWidth = 9; c.beginPath(); c.arc(x, y, rh * 1.14, 0, 6.2832); c.stroke();
    g = c.createRadialGradient(x, y, 0, x, y, rh);
    g.addColorStop(0, "#000"); g.addColorStop(0.7, "#050504"); g.addColorStop(1, "#1a1009");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rh, 0, 6.2832); c.fill();
  };
  for (const p of PL_BOLSILLOS) {
    const lado = p.r < 70;
    const ox = lado ? 0 : p.x === 0 ? -16 : 16, oy = p.y === 0 ? -16 : 16;
    tronera(p, ox, lado ? oy * 1.1 : oy, lado ? 54 : 60);
  }

  // — bandas de goma —
  const trapecio = (xa, ya, xb, yb, nx, ny) => {
    // (xa,ya)→(xb,yb) es la nariz; (nx,ny) apunta hacia fuera. Los extremos abren a 45°.
    const ux = (xb - xa), uy = (yb - ya), l = Math.hypot(ux, uy), tx = ux / l, ty = uy / l;
    const ext = BANDA * 0.85;
    c.beginPath();
    c.moveTo(xa, ya); c.lineTo(xb, yb);
    c.lineTo(xb + tx * ext + nx * BANDA, yb + ty * ext + ny * BANDA);
    c.lineTo(xa - tx * ext + nx * BANDA, ya - ty * ext + ny * BANDA);
    c.closePath();
    const g = c.createLinearGradient(xa, ya, xa + nx * BANDA, ya + ny * BANDA);
    g.addColorStop(0, "#2fa862"); g.addColorStop(0.18, "#1f8a4e"); g.addColorStop(1, "#0f4f2e");
    c.fillStyle = g; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = "rgba(0,0,0,.5)"; c.stroke();
    // reflejo en el borde de la nariz
    c.beginPath(); c.moveTo(xa, ya); c.lineTo(xb, yb);
    c.lineWidth = 3; c.strokeStyle = "rgba(190,255,215,.35)"; c.stroke();
    // puntas redondeadas junto a las troneras
    for (const [x, y] of [[xa, ya], [xb, yb]]) { c.beginPath(); c.arc(x, y, PL.R_JAULA + 1.5, 0, 6.2832); c.fillStyle = "#2a9a58"; c.fill(); }
  };
  const { GC, GS } = PL;
  trapecio(GC, 0, L / 2 - GS, 0, 0, -1); trapecio(L / 2 + GS, 0, L - GC, 0, 0, -1);
  trapecio(GC, W, L / 2 - GS, W, 0, 1); trapecio(L / 2 + GS, W, L - GC, W, 0, 1);
  trapecio(0, GC, 0, W - GC, -1, 0); trapecio(L, GC, L, W - GC, 1, 0);
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/* ---------- el taco ----------
   Dibuja el taco con la punta en `(tx, ty)` (mm, ejes de la mesa) y
   apuntando hacia `ang` (radianes: la dirección en la que pegaría). `s` es
   la escala de la mesa. Se llama con la transformación de `dibujaMesa`. */
export function dibujaTaco(c, tx, ty, ang, alfa) {
  c.save();
  c.globalAlpha = alfa;
  c.translate(tx, ty); c.rotate(ang); c.scale(1, 1.35);
  const cil = (x0, x1, h0, h1, cols) => {
    const g = c.createLinearGradient(0, h1, 0, -h1);
    cols.forEach(([p, col]) => g.addColorStop(p, col));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0, h0); c.lineTo(x1, h1); c.lineTo(x1, -h1); c.lineTo(x0, -h0); c.closePath(); c.fill();
  };
  // sombra del conjunto (una sola silueta, para que no se acumule)
  c.save();
  c.shadowColor = "rgba(0,0,0,.42)"; c.shadowBlur = 9; c.shadowOffsetX = 5; c.shadowOffsetY = -9;
  c.fillStyle = "#c9a064";
  c.beginPath(); c.moveTo(0, 5.5); c.lineTo(-760, 9); c.lineTo(-1500, 13.5); c.lineTo(-1500, -13.5); c.lineTo(-760, -9); c.lineTo(0, -5.5); c.closePath(); c.fill();
  c.restore();
  const maple = [[0, "#8a6a3a"], [0.25, "#f1d9a6"], [0.55, "#e0b87a"], [1, "#8c6430"]];
  const oscuro = [[0, "#150a05"], [0.25, "#6b3a22"], [0.55, "#3f1f10"], [1, "#0e0603"]];
  cil(-760, -32, 9, 6, maple);                                  // fuste
  cil(-32, -12, 6, 5.8, [[0, "#999"], [0.3, "#fff"], [0.6, "#dcdcdc"], [1, "#8a8a8a"]]);   // férula
  cil(-12, 0, 5.8, 5.2, [[0, "#1e3f8a"], [0.3, "#5b8ef0"], [0.6, "#3a68c8"], [1, "#16306b"]]);   // tiza
  cil(-770, -760, 9.4, 9.2, [[0, "#6a5420"], [0.3, "#f2d98a"], [0.6, "#c8a84a"], [1, "#5a4618"]]);   // unión de latón
  cil(-1500, -770, 13.5, 9.4, oscuro);                          // mango
  cil(-1220, -980, 11.6, 10.8, [[0, "#000"], [0.3, "#3a3a3a"], [0.6, "#161616"], [1, "#000"]]);   // la envoltura
  for (let x = -1010; x > -1210; x -= 26) { c.fillStyle = "rgba(255,255,255,.1)"; c.fillRect(x, -11, 3, 22); }
  cil(-1500, -1470, 13.6, 13.6, [[0, "#000"], [0.4, "#333"], [1, "#000"]]);   // el tope de goma
  for (const x of [-1240, -1236]) cil(x - 6, x, 12.1, 12, [[0, "#6a5420"], [0.3, "#f2d98a"], [1, "#5a4618"]]);
  c.restore();
}

export { azar };
