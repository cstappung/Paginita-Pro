"use strict";
/* ============================================================
   ColabDraw — geometría

   Todo lo de este módulo es PURO: entra y sale números, no toca el
   DOM ni el documento. Es lo que se puede verificar sin navegador.

   Una matriz es {a,b,c,d,e,f}, igual que SVGMatrix y que el atributo
   transform="matrix(a b c d e f)":

       | a  c  e |
       | b  d  f |
       | 0  0  1 |
   ============================================================ */

export const IDENT = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function matMul(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f
  };
}

export const matApply = (m, p) => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f
});

/* Solo el vector (sin traslación): para longitudes y direcciones. */
export const matApplyVec = (m, p) => ({
  x: m.a * p.x + m.c * p.y,
  y: m.b * p.x + m.d * p.y
});

export function matInvert(m) {
  const det = m.a * m.d - m.b * m.c;
  if (!det) return null;                   // matriz degenerada: no hay vuelta atrás
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det
  };
}

export const translate = (x, y) => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
export const scaleM = (sx, sy = sx) => ({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });

export function rotateM(deg, cx = 0, cy = 0) {
  const r = (deg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const m = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  if (!cx && !cy) return m;
  return matMul(translate(cx, cy), matMul(m, translate(-cx, -cy)));
}

/* Escalado alrededor de un punto fijo, que es como se comporta tirar de
   un tirador: la esquina opuesta no se mueve. */
export function scaleAbout(sx, sy, cx, cy) {
  return matMul(translate(cx, cy), matMul(scaleM(sx, sy), translate(-cx, -cy)));
}

export const isIdentity = m =>
  m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;

/* ---------- transform ⇄ texto ---------- */

const NUM = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?";
const FN_RE = new RegExp("(matrix|translate|scale|rotate|skewX|skewY)\\s*\\(([^)]*)\\)", "g");
const numsOf = s => (s.match(new RegExp(NUM, "g")) || []).map(Number);

/* Lee un atributo transform completo. Las funciones se aplican de
   izquierda a derecha, igual que en SVG. Lo que no se entiende se
   ignora en vez de reventar: un SVG ajeno puede traer cualquier cosa. */
export function parseTransform(str) {
  if (!str) return Object.assign({}, IDENT);
  let m = Object.assign({}, IDENT), match;
  FN_RE.lastIndex = 0;
  while ((match = FN_RE.exec(str))) {
    const n = numsOf(match[2]);
    let t = null;
    switch (match[1]) {
      case "matrix":
        if (n.length >= 6) t = { a: n[0], b: n[1], c: n[2], d: n[3], e: n[4], f: n[5] };
        break;
      case "translate":
        if (n.length >= 1) t = translate(n[0], n[1] || 0);
        break;
      case "scale":
        if (n.length >= 1) t = scaleM(n[0], n.length > 1 ? n[1] : n[0]);
        break;
      case "rotate":
        if (n.length >= 3) t = rotateM(n[0], n[1], n[2]);
        else if (n.length >= 1) t = rotateM(n[0]);
        break;
      case "skewX":
        if (n.length >= 1) t = { a: 1, b: 0, c: Math.tan((n[0] * Math.PI) / 180), d: 1, e: 0, f: 0 };
        break;
      case "skewY":
        if (n.length >= 1) t = { a: 1, b: Math.tan((n[0] * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 };
        break;
    }
    if (t) m = matMul(m, t);
  }
  return m;
}

/* Recorta la cola de ceros: 12.500000 → 12.5, y 12.0 → 12. Sin esto el
   SVG exportado se llena de ruido y los diffs son ilegibles. */
export function fmt(n, digits = 4) {
  if (!isFinite(n)) return "0";
  const s = n.toFixed(digits);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function matToString(m) {
  if (isIdentity(m)) return "";
  // una traslación pura se escribe como tal: es lo que se lee mejor
  if (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1)
    return `translate(${fmt(m.e)},${fmt(m.f)})`;
  return `matrix(${fmt(m.a, 6)},${fmt(m.b, 6)},${fmt(m.c, 6)},${fmt(m.d, 6)},${fmt(m.e)},${fmt(m.f)})`;
}

/* ---------- cajas ---------- */

export const boxOfPoints = pts => {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

export const boxCorners = b => [
  { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
  { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }
];

/* Caja envolvente (alineada a los ejes) de una caja ya transformada.
   Al rotar crece: es la caja de las cuatro esquinas giradas. */
export const transformBox = (b, m) => boxOfPoints(boxCorners(b).map(p => matApply(m, p)));

export function unionBox(boxes) {
  const real = boxes.filter(Boolean);
  if (!real.length) return null;
  const x0 = Math.min(...real.map(b => b.x));
  const y0 = Math.min(...real.map(b => b.y));
  const x1 = Math.max(...real.map(b => b.x + b.w));
  const y1 = Math.max(...real.map(b => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const boxCenter = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export const boxesOverlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const boxContains = (outer, inner) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/* Caja a partir de dos esquinas cualesquiera (arrastre en cualquier
   dirección), que es como se dibuja un rectángulo con el ratón. */
export const boxFromDrag = (p0, p1) => ({
  x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y),
  w: Math.abs(p1.x - p0.x), h: Math.abs(p1.y - p0.y)
});

/* ---------- imán ---------- */

export const snapValue = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
export const snapPoint = (p, step) => ({ x: snapValue(p.x, step), y: snapValue(p.y, step) });

/* Desplazamiento que hay que aplicar a la caja para que su borde más
   cercano caiga en la rejilla. Se ajusta la caja entera, no el ratón:
   así el objeto queda alineado aunque se agarrara por el medio. */
export function snapBoxDelta(box, step) {
  if (!(step > 0)) return { dx: 0, dy: 0 };
  const near = (a, b) => (Math.abs(snapValue(a, step) - a) <= Math.abs(snapValue(b, step) - b) ? a : b);
  const ax = near(box.x, box.x + box.w), ay = near(box.y, box.y + box.h);
  return { dx: snapValue(ax, step) - ax, dy: snapValue(ay, step) - ay };
}

/* ---------- alinear y distribuir ---------- */

/* Devuelve el desplazamiento de cada caja. `ref` es la caja contra la
   que se alinea (la envolvente de la selección, o la página). */
export function alignDeltas(boxes, mode, ref) {
  const R = ref || unionBox(boxes);
  if (!R) return boxes.map(() => ({ dx: 0, dy: 0 }));
  return boxes.map(b => {
    switch (mode) {
      case "left":    return { dx: R.x - b.x, dy: 0 };
      case "hcenter": return { dx: (R.x + R.w / 2) - (b.x + b.w / 2), dy: 0 };
      case "right":   return { dx: (R.x + R.w) - (b.x + b.w), dy: 0 };
      case "top":     return { dx: 0, dy: R.y - b.y };
      case "vcenter": return { dx: 0, dy: (R.y + R.h / 2) - (b.y + b.h / 2) };
      case "bottom":  return { dx: 0, dy: (R.y + R.h) - (b.y + b.h) };
      default:        return { dx: 0, dy: 0 };
    }
  });
}

/* Reparte el hueco sobrante a partes iguales entre los objetos, dejando
   los dos extremos donde están. Con menos de tres no hay nada que
   repartir. Devuelve los desplazamientos EN EL ORDEN DE ENTRADA. */
export function distributeDeltas(boxes, axis) {
  const n = boxes.length;
  const out = boxes.map(() => ({ dx: 0, dy: 0 }));
  if (n < 3) return out;
  const horiz = axis === "h";
  const pos = b => (horiz ? b.x : b.y);
  const len = b => (horiz ? b.w : b.h);

  const order = boxes.map((b, i) => i).sort((i, j) => pos(boxes[i]) - pos(boxes[j]));
  const first = boxes[order[0]], last = boxes[order[n - 1]];
  const span = (pos(last) + len(last)) - pos(first);
  const used = order.reduce((s, i) => s + len(boxes[i]), 0);
  const gap = (span - used) / (n - 1);

  let cursor = pos(first);
  for (const i of order) {
    const d = cursor - pos(boxes[i]);
    if (horiz) out[i].dx = d; else out[i].dy = d;
    cursor += len(boxes[i]) + gap;
  }
  return out;
}

/* ---------- varios ---------- */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/* Ángulo en grados del vector centro→punto, con 0 arriba y creciendo en
   el sentido de las agujas del reloj (el eje Y de SVG va hacia abajo). */
export const angleOf = (c, p) => (Math.atan2(p.x - c.x, c.y - p.y) * 180) / Math.PI;

/* ---------- polígonos y estrellas ----------

   Los vértices de un polígono de `lados` lados inscrito en la caja, y
   los de una estrella de `lados` puntas si se pide. Se inscribe en la
   CAJA y no en un círculo para que la figura se dibuje igual que la
   elipse —arrastrando de esquina a esquina— y para que un triángulo
   pueda salir alto y estrecho sin tener que escalarlo después.

   Empieza arriba (−90°) porque es donde se espera la punta de un
   triángulo: arrancando en 0° salía tumbado y parecía un error.

   La estrella intercala un vértice a `razon` del radio entre cada dos:
   con 5 puntas y 0,5 sale la estrella de toda la vida. */
export function polygonPoints(box, lados, { estrella = false, razon = 0.5 } = {}) {
  const n = Math.max(3, Math.min(Math.round(lados) || 3, 60));
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const rx = box.w / 2, ry = box.h / 2;
  const r2 = clamp(razon, 0.05, 0.95);
  const total = estrella ? n * 2 : n;
  const out = [];
  for (let i = 0; i < total; i++) {
    const a = (-Math.PI / 2) + (i * 2 * Math.PI) / total;
    const k = estrella && i % 2 ? r2 : 1;
    out.push({ x: cx + rx * k * Math.cos(a), y: cy + ry * k * Math.sin(a) });
  }
  return out;
}

/* Los mismos vértices en el formato que quiere el atributo `points`. */
export const pointsAttr = pts => pts.map(p => `${fmt(p.x)},${fmt(p.y)}`).join(" ");

/* ---------- curvas ----------

   Una curva es una línea que se abomba. Se guarda como un `<path>` con
   dos datos propios —`data-curva`, cuánto se abomba, y `data-ondas`, en
   cuántos arcos alternados se parte la cuerda— y el `d` se vuelve a
   calcular a partir de sus DOS EXTREMOS cada vez que se toca uno de los
   dos. Guardar la ficha y no solo el trazado es lo que deja corregir la
   curvatura de una flecha dibujada la semana pasada; los extremos no
   hace falta guardarlos aparte porque están en el propio `d`, y un
   segundo sitio donde dicen dónde empieza la curva es un segundo sitio
   que puede mentir.

   **La curvatura es la flecha del arco en tanto por ciento de la media
   cuerda**, así que 100 % es exactamente MEDIO CÍRCULO — que es el caso
   que la gente pide por su nombre— y el signo dice hacia qué lado.
   Con varias ondas cada arco se abomba al revés que el anterior: dos
   ondas son una S, tres una ese con cola.

   **Se dibuja con curvas de Bézier cúbicas, no con el comando `A`.** Dos
   razones, las dos de este repositorio:

     - al hornear el escalado (`reshape.js`) se reescribe el `d`, y ahí
       un arco bajo una escala desigual habría que recalcularlo desde la
       cónica —`transformPath` se niega, y con razón—; una cúbica se
       transforma moviendo sus cuatro puntos y ya está;
     - un semicírculo estirado tiene que salir elíptico, y transformar
       los cuatro puntos hace eso solo.

   Cada arco se parte en tramos de 90° o menos. Ahí la aproximación
   cúbica de un arco de circunferencia (el factor 4/3·tan(δ/4)) yerra
   menos de una diezmilésima del radio: a la vista, exacta. */
export const CURVA_ATTR = "data-curva";
export const ONDAS_ATTR = "data-ondas";
export const CURVA_MAX = 100;
export const ONDAS_MAX = 6;

export const esCurva = el =>
  !!el && el.nodeName === "path" && el.getAttribute &&
  el.getAttribute(CURVA_ATTR) != null;

/* Ficha de una curva ya dibujada, con los mismos límites que al
   crearla: un `data-curva` a mano en el archivo no puede meter en el
   panel un número que el panel no sepa volver a escribir. */
export function curvaSpec(el) {
  if (!esCurva(el)) return null;
  return normCurva({
    curvatura: el.getAttribute(CURVA_ATTR),
    ondas: el.getAttribute(ONDAS_ATTR)
  });
}

export function normCurva(spec) {
  const s = spec || {};
  const c = parseFloat(s.curvatura);
  const n = parseInt(s.ondas, 10);
  return {
    curvatura: isFinite(c) ? clamp(c, -CURVA_MAX, CURVA_MAX) : 40,
    ondas: isFinite(n) ? clamp(n, 1, ONDAS_MAX) : 1
  };
}

/* Los dos extremos que tiene ahora mismo un trazado NUESTRO. Se leen
   del `d`: como solo lleva `M`, `L` y `C` —nunca `A`, que trae banderas
   que no son coordenadas—, los dos primeros números son el principio y
   los dos últimos el final, y eso sigue siendo verdad después de
   hornear un escalado. */
export function curvaExtremos(d) {
  const n = String(d || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!n || n.length < 4) return null;
  return {
    a: { x: parseFloat(n[0]), y: parseFloat(n[1]) },
    b: { x: parseFloat(n[n.length - 2]), y: parseFloat(n[n.length - 1]) }
  };
}

/* El `d` de una curva entre dos puntos. */
export function curvaPath(a, b, spec) {
  const { curvatura, ondas } = normCurva(spec);
  const f = curvatura / 100;
  const ux = (b.x - a.x) / ondas, uy = (b.y - a.y) / ondas;
  const partes = [`M ${fmt(a.x)} ${fmt(a.y)}`];
  for (let i = 0; i < ondas; i++) {
    const p0 = { x: a.x + ux * i, y: a.y + uy * i };
    const p1 = { x: a.x + ux * (i + 1), y: a.y + uy * (i + 1) };
    partes.push(arcoCubicas(p0, p1, i % 2 ? -f : f));
  }
  return partes.join(" ");
}

/* Un arco de circunferencia de p0 a p1 cuya flecha es `f` veces la
   media cuerda, en comandos `C`. Con f = 0 sale la recta, que es lo que
   tiene que salir: una curva de curvatura cero es una línea. */
function arcoCubicas(p0, p1, f) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const L = Math.hypot(dx, dy);
  const s = (f * L) / 2;
  if (L < 1e-9 || Math.abs(s) < L * 1e-4) return `L ${fmt(p1.x)} ${fmt(p1.y)}`;

  // normal unitaria: con la cuerda hacia la derecha, la curvatura
  // positiva abomba hacia arriba
  const nx = dy / L, ny = -dx / L;
  const M = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const cima = { x: M.x + nx * s, y: M.y + ny * s };

  const R = (L * L / 4 + s * s) / (2 * Math.abs(s));
  const sg = s < 0 ? -1 : 1;
  const C = { x: M.x - nx * sg * (R - Math.abs(s)), y: M.y - ny * sg * (R - Math.abs(s)) };

  const a0 = Math.atan2(p0.y - C.y, p0.x - C.x);
  const delta = 2 * Math.asin(clamp(L / 2 / R, -1, 1));
  /* Con la flecha justo en la media cuerda el arco es medio círculo y
     las dos direcciones son igual de válidas por el ángulo: se elige
     mirando cuál de las dos pasa por la cima. */
  const enMedio = g => ({ x: C.x + R * Math.cos(a0 + g / 2), y: C.y + R * Math.sin(a0 + g / 2) });
  const barrido = dist(enMedio(delta), cima) <= dist(enMedio(-delta), cima) ? delta : -delta;

  const tramos = Math.max(1, Math.ceil(Math.abs(barrido) / (Math.PI / 2)));
  const paso = barrido / tramos;
  const k = (4 / 3) * Math.tan(paso / 4);
  let out = "";
  for (let i = 0; i < tramos; i++) {
    const t0 = a0 + paso * i, t1 = t0 + paso;
    const q0 = { x: C.x + R * Math.cos(t0), y: C.y + R * Math.sin(t0) };
    const q1 = { x: C.x + R * Math.cos(t1), y: C.y + R * Math.sin(t1) };
    const c0 = { x: q0.x - k * R * Math.sin(t0), y: q0.y + k * R * Math.cos(t0) };
    const c1 = { x: q1.x + k * R * Math.sin(t1), y: q1.y - k * R * Math.cos(t1) };
    out += ` C ${fmt(c0.x)} ${fmt(c0.y)} ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(q1.x)} ${fmt(q1.y)}`;
  }
  return out.trim();
}
