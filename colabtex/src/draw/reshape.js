"use strict";
/* ============================================================
   ColabDraw — hornear el escalado en la figura

   Estirar una figura se guardaba SIEMPRE como un `transform`, y un
   `scale(3, 1)` no escala solo la geometría: escala también el trazo, en
   cada eje por su lado. El resultado es un rectángulo cuyos lados
   verticales salen tres veces más gruesos que los horizontales, con las
   esquinas redondeadas convertidas en óvalos y los guiones estirados
   solo en una dirección. Eso es lo que se veía como «la figura se
   deforma al cambiarle la forma», y no hay atributo de SVG que lo
   arregle: un trazo tiene un único grosor.

   La salida es cambiar de sitio el escalado — de la matriz a las
   COORDENADAS de la figura, que es lo que hace Inkscape cuando guarda
   las transformaciones «optimizadas»—. Un rectángulo estirado pasa a
   tener otro `width`, no un `scale`; y entonces su trazo vuelve a ser
   uno solo.

   Tres reglas que sostienen el resto:

   - **Solo se hornea una matriz SIN giro ni sesgo** (`esRecta`). Con
     giro, la figura estirada ya no es un rectángulo recto y sus
     coordenadas no pueden describirla; ahí se deja el `transform` como
     estaba, que es exactamente el caso que `Tools._marco()` ya resuelve
     escalando en los ejes de la propia figura.
   - **El CONTORNO no se escala**: un trazo de 1 mm sigue midiendo 1 mm
     cuando la figura se hace grande, y lo mismo sus guiones. Es lo que
     se pidió, y es lo que hacen los programas de dibujo cuando se les
     apaga «escalar el grosor». Ojo: eso no quiere decir que a
     `bakeTrazo` se le pase siempre 1. La matriz que se hornea puede
     traer un escalado ANTERIOR (una figura importada con `scale(…)`
     propio), y ese sí tiene que acabar en el número, o al soltar el
     trazo daría un salto: quien llama pasa el factor que ya estaba
     puesto, no el del gesto. Cuando lo hay, escala ISÓTROPO —por la
     raíz del determinante—, porque un grosor es un solo número y no
     puede estirarse en un eje.
   - **El redondeo de esquina sí escala**, isótropo también: es
     geometría, forma parte de la figura y no de la tinta con la que se
     dibuja. Isótropo y no por ejes, o un rectángulo alargado acabaría
     con las esquinas ovaladas.
   - **Solo se hornea cuando hace falta**, es decir, cuando el escalado
     es desigual. Un `scale(2,2)` no deforma nada, y reescribir por
     gusto la `d` de un trazado de mil puntos en cada arrastre llenaría
     la base de datos de actualizaciones enormes para no arreglar nada.

   Todo lo de este archivo es aritmética pura: se puede comprobar en
   Node sin navegador.
   ============================================================ */

import { fmt, matApply } from "./geom.js";

/* Sin giro ni sesgo: la matriz solo escala y traslada en los ejes. */
export const esRecta = m =>
  !!m && Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 &&
  isFinite(m.a) && isFinite(m.d) && isFinite(m.e) && isFinite(m.f);

/* Cuánto agranda la matriz un trazo, de media: la raíz del área. Es lo
   único que puede escalar un grosor, que es un solo número. */
export const expansion = m => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;

/* ¿Estira más en un eje que en el otro? Si no, no hay nada que arreglar:
   el `transform` de siempre ya da el resultado correcto. */
export const esDesigual = (m, tol = 1e-4) =>
  esRecta(m) && Math.abs(Math.abs(m.a) - Math.abs(m.d)) > tol * Math.max(Math.abs(m.a), Math.abs(m.d), 1);

/* Figuras cuyas coordenadas describen la forma entera. Un <text> se
   queda fuera a propósito: el cuerpo de letra es un solo número y no
   puede estirarse en un eje, así que un rótulo estirado NECESITA la
   matriz. Una fórmula también, y además su tamaño se lee justo de ahí
   (draw/latex.js: `tamañoDe`). */
export const HORNEABLES = new Set([
  "rect", "circle", "ellipse", "line", "polyline", "polygon", "path"
]);

/* Un trazado enorme no se reescribe: una figura de matplotlib puede
   llevar decenas de miles de caracteres en su `d`, y reescribirla en
   cada arrastre mandaría esa actualización entera por la red. Se queda
   con su matriz, como antes. */
const MAX_PATH = 20000;

const num = (v, porDefecto = 0) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : porDefecto;
};

/* ---------- longitudes que acompañan al trazo ---------- */

/* El grosor, los guiones y su desfase: todos son longitudes, y todos
   escalan por el mismo factor isótropo. Devuelve solo lo que hay que
   escribir; un valor que no existe no se inventa.

   `k` NO es el escalado del gesto —el contorno no crece con la figura,
   ver arriba—, sino el que la matriz ya traía y que la geometría se
   acaba de tragar. Con la identidad, que es el caso normal, esto
   devuelve un objeto vacío y no escribe nada. */
export function bakeTrazo(get, k) {
  const out = {};
  if (!(k > 0) || Math.abs(k - 1) < 1e-6) return out;
  const w = get("stroke-width");
  if (w != null && w !== "") {
    const n = parseFloat(w);
    if (isFinite(n)) out["stroke-width"] = fmt(n * k, 5);
  }
  const dash = get("stroke-dasharray");
  if (dash && String(dash).trim() && String(dash).trim() !== "none") {
    out["stroke-dasharray"] = String(dash).trim().split(/[\s,]+/).filter(Boolean)
      .map(v => fmt(num(v) * k, 5)).join(",");
  }
  const off = get("stroke-dashoffset");
  if (off != null && off !== "") {
    const n = parseFloat(off);
    if (isFinite(n)) out["stroke-dashoffset"] = fmt(n * k, 5);
  }
  return out;
}

/* ---------- trazados ---------- */

const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;

/* La `d` de un <path> pasada por una matriz RECTA. Devuelve null si hay
   algo que no se puede convertir con garantías —un arco girado con
   escalado desigual—, y entonces quien llama se queda con la matriz.

   El primer comando tiene que ser un «moveto»: una `d` que empieza por
   otra cosa no es válida y no se toca. */
export function transformPath(d, K) {
  const texto = String(d || "").trim();
  if (!texto || !esRecta(K) || texto.length > MAX_PATH) return null;

  const tokens = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(texto))) tokens.push(m[1] || parseFloat(m[2]));
  if (!tokens.length || typeof tokens[0] !== "string") return null;

  const ax = Math.abs(K.a), ay = Math.abs(K.d);
  const P = p => matApply(K, p);                  // punto absoluto
  const V = p => ({ x: K.a * p.x, y: K.d * p.y }); // desplazamiento relativo

  const out = [];
  let i = 0, cmd = null;
  while (i < tokens.length) {
    if (typeof tokens[i] === "string") { cmd = tokens[i++]; }
    else if (!cmd) return null;
    else if (cmd === "M") cmd = "L";               // los pares sueltos tras M son L
    else if (cmd === "m") cmd = "l";

    const clave = cmd.toLowerCase();
    const n = ARGS[clave];
    if (n == null) return null;
    const rel = cmd !== cmd.toUpperCase();
    const a = tokens.slice(i, i + n);
    if (a.length < n || a.some(v => typeof v !== "number")) return null;
    i += n;

    const pares = [];
    if (clave === "z") { out.push("Z"); continue; }
    if (clave === "h") {
      // una horizontal sigue siendo horizontal: la matriz es recta
      out.push((rel ? "h" : "H") + " " + fmt(rel ? K.a * a[0] : K.a * a[0] + K.e));
      continue;
    }
    if (clave === "v") {
      out.push((rel ? "v" : "V") + " " + fmt(rel ? K.d * a[0] : K.d * a[0] + K.f));
      continue;
    }
    if (clave === "a") {
      const [rx, ry, giro, grande, barrido, x, y] = a;
      /* Un arco girado bajo un escalado desigual deja de ser una elipse
         con esos radios: habría que recalcular los tres parámetros a
         partir de la cónica. Ahí no se hornea. */
      if (Math.abs(giro % 180) > 1e-9 && Math.abs(ax - ay) > 1e-9) return null;
      const p = rel ? V({ x, y }) : P({ x, y });
      // reflejar un eje invierte el sentido del barrido
      const b = K.a * K.d < 0 ? (barrido ? 0 : 1) : barrido;
      out.push([rel ? "a" : "A", fmt(rx * ax), fmt(ry * ay), fmt(giro), grande ? 1 : 0, b,
        fmt(p.x), fmt(p.y)].join(" "));
      continue;
    }
    for (let j = 0; j < n; j += 2) {
      const p = rel ? V({ x: a[j], y: a[j + 1] }) : P({ x: a[j], y: a[j + 1] });
      pares.push(fmt(p.x), fmt(p.y));
    }
    out.push(cmd + " " + pares.join(" "));
  }
  return out.join(" ");
}

/* ---------- figuras ---------- */

/* Los puntos de una polilínea o un polígono. */
function transformPoints(v, K) {
  const nums = String(v || "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length < 4 || nums.length % 2 || nums.some(n => !isFinite(n))) return null;
  const out = [];
  for (let i = 0; i < nums.length; i += 2) {
    const p = matApply(K, { x: nums[i], y: nums[i + 1] });
    out.push(`${fmt(p.x)},${fmt(p.y)}`);
  }
  return out.join(" ");
}

/* Los atributos nuevos de una figura a la que se le hornea `K`, o null
   si esa figura no puede absorberla. `get(nombre)` devuelve el valor
   actual: sirve igual un elemento de Yjs que uno del DOM.

   Ojo con `null` en la respuesta: significa «no se puede», no «sin
   cambios». Un objeto vacío sí sería «nada que escribir». */
export function bakeShape(tag, get, K) {
  if (!esRecta(K)) return null;
  const t = String(tag || "").toLowerCase();
  if (!HORNEABLES.has(t)) return null;

  const ax = Math.abs(K.a), ay = Math.abs(K.d);
  if (!(ax > 0) || !(ay > 0)) return null;
  const k = expansion(K);

  if (t === "rect") {
    const x = num(get("x")), y = num(get("y"));
    const w = num(get("width")), h = num(get("height"));
    if (!(w > 0) || !(h > 0)) return null;
    const p1 = matApply(K, { x, y }), p2 = matApply(K, { x: x + w, y: y + h });
    const nw = Math.abs(p2.x - p1.x), nh = Math.abs(p2.y - p1.y);
    const out = {
      x: fmt(Math.min(p1.x, p2.x)), y: fmt(Math.min(p1.y, p2.y)),
      width: fmt(nw), height: fmt(nh)
    };
    /* El redondeo de esquina NO se estira: crece isótropo como el trazo,
       o un rectángulo alargado acaba con las esquinas ovaladas — que es
       la mitad de lo que se veía deformado. El tope es el que impone
       SVG: media figura. */
    const rxRaw = get("rx"), ryRaw = get("ry");
    if (rxRaw != null || ryRaw != null) {
      const rx = num(rxRaw, num(ryRaw)), ry = num(ryRaw, num(rxRaw));
      const r = Math.max(rx, ry) * k;
      const tope = Math.min(nw, nh) / 2;
      const v = fmt(Math.min(r, tope), 5);
      out.rx = v;
      if (ryRaw != null) out.ry = v;
    }
    return out;
  }

  if (t === "circle") {
    const c = matApply(K, { x: num(get("cx")), y: num(get("cy")) });
    const r = num(get("r"));
    if (!(r > 0)) return null;
    /* Un círculo estirado es una elipse, y una etiqueta no se puede
       cambiar sobre la marcha en Yjs (habría que clonar y borrar, y con
       ello se iría la selección). Con escalado desigual se queda con su
       matriz. */
    if (Math.abs(ax - ay) > 1e-9) return null;
    return { cx: fmt(c.x), cy: fmt(c.y), r: fmt(r * ax) };
  }

  if (t === "ellipse") {
    const c = matApply(K, { x: num(get("cx")), y: num(get("cy")) });
    const rx = num(get("rx")), ry = num(get("ry"));
    if (!(rx > 0) || !(ry > 0)) return null;
    return { cx: fmt(c.x), cy: fmt(c.y), rx: fmt(rx * ax), ry: fmt(ry * ay) };
  }

  if (t === "line") {
    const a = matApply(K, { x: num(get("x1")), y: num(get("y1")) });
    const b = matApply(K, { x: num(get("x2")), y: num(get("y2")) });
    return { x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) };
  }

  if (t === "polyline" || t === "polygon") {
    const pts = transformPoints(get("points"), K);
    return pts ? { points: pts } : null;
  }

  const d = transformPath(get("d"), K);
  return d ? { d } : null;
}
