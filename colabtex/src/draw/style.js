"use strict";
/* ============================================================
   ColabDraw — panel de relleno, trazo y orden

   El panel se construye aquí en vez de en el HTML: son muchos
   controles muy repetitivos y así lo que se verifica es el módulo que
   de verdad los crea.

   Los valores se leen de la selección. Cuando las figuras
   seleccionadas no coinciden, el control se queda en blanco y muestra
   «varios»: mentir con el valor de la primera haría que tocar
   cualquier cosa pisara las demás sin querer.
   ============================================================ */

import { FONTS, DEFAULT_FONT, DEFAULT_SIZE, isText } from "./text.js";
import { CAPS, JOINS, DASHES, DEFAULT_CAP, DEFAULT_JOIN } from "./stroke.js";

export const PALETTE = [
  "none", "#000000", "#3d4c5e", "#8a97a3", "#ffffff",
  "#c0392b", "#e67e22", "#e2c08d", "#2e9e5b", "#0d9488",
  "#0f62fe", "#6cb6ff", "#6c4bb6", "#b58bf5", "#d6336c"
];

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ¿Está la persona escribiendo justo en este campo? Se usa para no
   pisarle lo que teclea al refrescar el panel. */
const enUso = n => document.activeElement === n;

/* Un campo de número aplica al confirmar (`change`, o sea al salir) Y
   sin salir, un poco después de dejar de teclear. Lo segundo no es
   comodidad: el sitio natural al que se sale de este panel es el
   dibujo, y el lienzo corta el pointerdown, así que el campo se quedaba
   con el foco, no confirmaba nunca y encima la selección ya se había
   vaciado — el cambio se perdía entero. Tools._soltarFoco() arregla ese
   camino; esto hace que ni siquiera haga falta recorrerlo. */
const alTeclear = (input, fn, ms = 350) => {
  let t = null;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(fn, ms); });
  input.addEventListener("change", () => { clearTimeout(t); fn(); });
};

/* Valor efectivo de una propiedad en un elemento: manda el `style`, luego
   el atributo. Leer solo el atributo era mentir — una figura importada
   lleva el color en `style="fill:#ff0000"` y el panel enseñaba negro
   encima de algo rojo, así que tocar cualquier control la repintaba sin
   avisar. */
export function attrOf(el, name) {
  if (!el || !el.getAttribute) return null;
  const st = el.getAttribute("style");
  if (st) {
    const m = String(st).match(new RegExp(`(?:^|;)\\s*${name.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+)`, "i"));
    if (m) return m[1].trim();
  }
  const v = el.getAttribute(name);
  return v == null || v === "" ? null : v;
}

/* Valor común de un atributo en la selección, o null si difieren. */
export function commonAttr(els, name, fallback = null) {
  if (!els.length) return fallback;
  let out;
  for (let i = 0; i < els.length; i++) {
    const v = attrOf(els[i], name);
    const norm = v == null ? fallback : v;
    if (i === 0) out = norm;
    else if (norm !== out) return null;
  }
  return out;
}

export function createStylePanel(host, opts = {}) {
  const getSel = opts.getSelection || (() => []);
  const getStyle = opts.getStyle || (() => ({}));
  const onApply = opts.onApply || (() => {});
  const onOrder = opts.onOrder || (() => {});
  const onPage = opts.onPage || (() => {});
  const getPage = opts.getPage || (() => ({ w: 0, h: 0 }));
  const canWrite = opts.canWrite || (() => true);
  const getTextStyle = opts.getTextStyle || (() => ({}));
  const isTextTool = opts.isTextTool || (() => false);
  /* Cuánto agranda el lienzo lo que hay elegido. Escalar una figura se
     guarda en su `transform`, así que un trazo de 0,5 mm escalado al
     doble se ve de 1 mm mientras el atributo sigue diciendo 0,5: el panel
     enseña y acepta lo que se VE, y aquí se traduce. */
  const getScale = opts.getScale || (() => 1);

  host.textContent = "";
  host.classList.add("dw-style");

  /* ---------- muestrario reutilizable ---------- */
  const swatches = (name, onPick) => {
    const wrap = el("div", "dw-swatches");
    for (const c of PALETTE) {
      const b = el("button", "dw-swatch" + (c === "none" ? " dw-swatch-none" : ""));
      b.type = "button";
      b.dataset.color = c;
      b.dataset.for = name;
      b.title = c === "none" ? "Sin color" : c;
      if (c !== "none") b.style.background = c;
      b.onclick = () => onPick(c);
      wrap.appendChild(b);
    }
    return wrap;
  };

  const section = (title) => {
    const s = el("div", "dw-sec");
    s.appendChild(el("div", "dw-sec-title", title));
    return s;
  };

  /* ---------- relleno ---------- */
  const secFill = section("RELLENO");
  const fillRow = el("div", "dw-row");
  const fillInput = el("input", "dw-color");
  fillInput.type = "color";
  fillInput.id = "dwFillColor";
  const fillLabel = el("span", "dw-val");
  fillLabel.id = "dwFillLabel";
  fillRow.append(fillInput, fillLabel);
  secFill.append(fillRow, swatches("fill", c => apply({ fill: c === "none" ? "none" : c })));
  fillInput.oninput = () => apply({ fill: fillInput.value });

  /* ---------- trazo ---------- */
  const secStroke = section("TRAZO");
  const strokeRow = el("div", "dw-row");
  const strokeInput = el("input", "dw-color");
  strokeInput.type = "color";
  strokeInput.id = "dwStrokeColor";
  const strokeLabel = el("span", "dw-val");
  strokeLabel.id = "dwStrokeLabel";
  strokeRow.append(strokeInput, strokeLabel);
  strokeInput.oninput = () => apply({ stroke: strokeInput.value });

  const widthRow = el("div", "dw-row");
  widthRow.appendChild(el("label", "dw-lbl", "Grosor"));
  const widthInput = el("input", "dw-num");
  widthInput.type = "number";
  widthInput.id = "dwStrokeWidth";
  widthInput.min = "0"; widthInput.step = "0.1";
  alTeclear(widthInput, () => {
    const v = parseFloat(widthInput.value);
    if (!isFinite(v) || v < 0) return;
    const k = getScale() || 1;
    apply({ "stroke-width": Math.round((v / k) * 10000) / 10000 });
  });
  widthRow.append(widthInput, el("span", "dw-unit", "mm"));

  const dashRow = el("div", "dw-row");
  dashRow.appendChild(el("label", "dw-lbl", "Guiones"));
  const dashSel = el("select", "dw-sel");
  dashSel.id = "dwDash";
  for (const d of DASHES) {
    const o = document.createElement("option");
    o.value = d.value; o.textContent = d.label;
    dashSel.appendChild(o);
  }
  dashSel.onchange = () => apply({ "stroke-dasharray": dashSel.value || null });
  dashRow.appendChild(dashSel);

  /* Extremos y uniones. Faltaban por completo, y como tools.js escribía
     `stroke-linecap: round` a mano al crear una línea, todas salían
     redondeadas y no había forma de cambiarlo desde ningún sitio.

     Aquí SÍ se escribe el valor por defecto («plano», «en pico») en vez
     de quitar el atributo: lo que hay elegido puede estar heredando un
     `round` de su grupo o venir así de un archivo importado, y quitar el
     atributo dejaría el redondeo puesto. */
  const opciones = (id, lista, attr, etiqueta) => {
    const row = el("div", "dw-row");
    row.appendChild(el("label", "dw-lbl", etiqueta));
    const sel = el("select", "dw-sel");
    sel.id = id;
    for (const o of lista) {
      const op = document.createElement("option");
      op.value = o.value; op.textContent = o.label;
      if (o.title) op.title = o.title;
      sel.appendChild(op);
    }
    sel.onchange = () => apply({ [attr]: sel.value });
    row.appendChild(sel);
    return { row, sel };
  };
  const cap = opciones("dwLinecap", CAPS, "stroke-linecap", "Extremos");
  const join = opciones("dwLinejoin", JOINS, "stroke-linejoin", "Uniones");

  secStroke.append(strokeRow, swatches("stroke", c => apply({ stroke: c === "none" ? "none" : c })),
    widthRow, dashRow, cap.row, join.row);

  /* ---------- texto ----------
     Solo aparece cuando hay un texto elegido (o cuando se va a escribir
     uno): son cinco controles que no dicen nada sobre un rectángulo. */
  const secText = section("TEXTO");
  const fontRow = el("div", "dw-row");
  fontRow.appendChild(el("label", "dw-lbl", "Fuente"));
  const fontSel = el("select", "dw-sel");
  fontSel.id = "dwFont";
  for (const f of FONTS) {
    const o = document.createElement("option");
    o.value = f.value; o.textContent = f.label;
    o.style.fontFamily = f.value;
    fontSel.appendChild(o);
  }
  fontSel.onchange = () => apply({ "font-family": fontSel.value });
  fontRow.appendChild(fontSel);

  const sizeRow = el("div", "dw-row");
  sizeRow.appendChild(el("label", "dw-lbl", "Cuerpo"));
  const sizeInput = el("input", "dw-num");
  sizeInput.type = "number";
  sizeInput.id = "dwFontSize";
  sizeInput.min = "0.5"; sizeInput.step = "0.5";
  alTeclear(sizeInput, () => {
    const v = parseFloat(sizeInput.value);
    if (isFinite(v) && v > 0) apply({ "font-size": v });
  });
  sizeRow.append(sizeInput, el("span", "dw-unit", "mm"));

  const fxRow = el("div", "dw-btns");
  const mkToggle = (label, title, attr, on, off) => {
    const b = el("button", "dw-btn", label);
    b.type = "button";
    b.title = title;
    b.dataset.text = attr;
    b.onclick = () => {
      const activo = b.classList.contains("dw-btn-on");
      apply({ [attr]: activo ? off : on });
    };
    return b;
  };
  const boldBtn = mkToggle("<b>N</b>", "Negrita", "font-weight", "bold", null);
  const italBtn = mkToggle("<i>C</i>", "Cursiva", "font-style", "italic", null);
  const alignBtns = [
    ["start", "⇤", "Alinear a la izquierda"],
    ["middle", "↔", "Centrar"],
    ["end", "⇥", "Alinear a la derecha"]
  ].map(([v, label, title]) => {
    const b = el("button", "dw-btn", label);
    b.type = "button";
    b.title = title;
    b.dataset.anchor = v;
    b.onclick = () => apply({ "text-anchor": v === "start" ? null : v });
    return b;
  });
  fxRow.append(boldBtn, italBtn, ...alignBtns);
  secText.append(fontRow, sizeRow, fxRow);

  /* ---------- opacidad ---------- */
  const secOp = section("OPACIDAD");
  const opRow = el("div", "dw-row");
  const opInput = el("input", "dw-range");
  opInput.type = "range";
  opInput.id = "dwOpacity";
  opInput.min = "0"; opInput.max = "100"; opInput.step = "1"; opInput.value = "100";
  const opLabel = el("span", "dw-val", "100%");
  opLabel.id = "dwOpacityLabel";
  opInput.oninput = () => { opLabel.textContent = opInput.value + "%"; };
  opInput.onchange = () => apply({ opacity: (parseInt(opInput.value, 10) / 100) });
  opRow.append(opInput, opLabel);
  secOp.appendChild(opRow);

  /* ---------- orden ---------- */
  const secOrder = section("ORDEN");
  const orderRow = el("div", "dw-btns");
  for (const [mode, label, title] of [
    ["top", "⤒", "Traer al frente (Mayús+RePág)"],
    ["raise", "↑", "Subir (RePág)"],
    ["lower", "↓", "Bajar (AvPág)"],
    ["bottom", "⤓", "Enviar al fondo (Mayús+AvPág)"]
  ]) {
    const b = el("button", "dw-btn", label);
    b.type = "button";
    b.title = title;
    b.dataset.order = mode;
    b.onclick = () => onOrder(mode);
    orderRow.appendChild(b);
  }
  secOrder.appendChild(orderRow);

  /* ---------- página ---------- */
  const secPage = section("PÁGINA");
  const pageRow = el("div", "dw-row");
  const pw = el("input", "dw-num"); pw.type = "number"; pw.id = "dwPageW"; pw.min = "1"; pw.step = "1";
  const ph = el("input", "dw-num"); ph.type = "number"; ph.id = "dwPageH"; ph.min = "1"; ph.step = "1";
  const commitPage = () => {
    const w = parseFloat(pw.value), h = parseFloat(ph.value);
    if (w > 0 && h > 0) onPage(w, h);
  };
  alTeclear(pw, commitPage); alTeclear(ph, commitPage);
  pageRow.append(pw, el("span", "dw-unit", "×"), ph, el("span", "dw-unit", "mm"));
  secPage.appendChild(pageRow);

  host.append(secFill, secStroke, secText, secOp, secOrder, secPage);

  function apply(attrs) {
    if (!canWrite()) return;
    onApply(attrs);
    refresh();
  }

  /* ---------- refrescar desde la selección ---------- */
  function refresh() {
    const sel = getSel();
    const st = getStyle();
    const ro = !canWrite();
    for (const n of [fillInput, strokeInput, widthInput, dashSel, cap.sel, join.sel, opInput, pw, ph])
      n.disabled = ro;
    host.querySelectorAll(".dw-swatch,.dw-btn").forEach(b => { b.disabled = ro; });

    const fill = sel.length ? commonAttr(sel, "fill", "#000000") : st.fill;
    const stroke = sel.length ? commonAttr(sel, "stroke", "none") : st.stroke;
    const width = sel.length ? commonAttr(sel, "stroke-width", "1") : st["stroke-width"];
    const dash = sel.length ? commonAttr(sel, "stroke-dasharray", "") : "";
    const op = sel.length ? commonAttr(sel, "opacity", "1") : 1;

    paintColor(fillInput, fillLabel, fill);
    paintColor(strokeInput, strokeLabel, stroke);
    const k = sel.length ? (getScale() || 1) : 1;
    // nunca se le pisa a nadie lo que está escribiendo
    if (!enUso(widthInput))
      widthInput.value = width == null ? "" : String(Math.round((parseFloat(width) || 0) * k * 100) / 100);
    widthInput.placeholder = width == null ? "varios" : "";
    dashSel.value = dash == null ? "" : String(dash);
    // «varios»: ninguna opción marcada, en vez de mentir con la primera
    const punta = sel.length ? commonAttr(sel, "stroke-linecap", DEFAULT_CAP) : (st["stroke-linecap"] || DEFAULT_CAP);
    const union = sel.length ? commonAttr(sel, "stroke-linejoin", DEFAULT_JOIN) : (st["stroke-linejoin"] || DEFAULT_JOIN);
    cap.sel.value = punta == null ? "" : String(punta);
    if (!cap.sel.value) cap.sel.selectedIndex = -1;
    join.sel.value = union == null ? "" : String(union);
    if (!join.sel.value) join.sel.selectedIndex = -1;
    const pct = op == null ? 100 : Math.round(parseFloat(op) * 100);
    opInput.value = String(isFinite(pct) ? pct : 100);
    opLabel.textContent = op == null ? "varios" : `${isFinite(pct) ? pct : 100}%`;

    refreshText(sel, ro);

    const page = getPage();
    if (!enUso(pw)) pw.value = String(Math.round(page.w * 10) / 10 || "");
    if (!enUso(ph)) ph.value = String(Math.round(page.h * 10) / 10 || "");
  }

  function refreshText(sel, ro) {
    const textos = sel.filter(isText);
    // con la herramienta de texto en la mano el panel también sirve:
    // ahí enseña lo que se va a usar al escribir el siguiente
    const mostrar = textos.length > 0 || isTextTool();
    secText.style.display = mostrar ? "" : "none";
    if (!mostrar) return;

    const ts = getTextStyle();
    const val = (name, porDefecto) =>
      (textos.length ? commonAttr(textos, name, porDefecto)
        : (ts[name] == null ? porDefecto : String(ts[name])));

    const fam = val("font-family", DEFAULT_FONT);
    fontSel.value = fam == null ? "" : String(fam);
    if (!fontSel.value) fontSel.selectedIndex = -1;      // «varios»: ninguna marcada

    const size = val("font-size", String(DEFAULT_SIZE));
    if (!enUso(sizeInput))
      sizeInput.value = size == null ? "" : String(parseFloat(size) || DEFAULT_SIZE);
    sizeInput.placeholder = size == null ? "varios" : "";

    const peso = val("font-weight", "normal");
    const estilo = val("font-style", "normal");
    const anclaje = val("text-anchor", "start");
    boldBtn.classList.toggle("dw-btn-on", peso === "bold" || peso === "700");
    italBtn.classList.toggle("dw-btn-on", estilo === "italic" || estilo === "oblique");
    for (const b of alignBtns) b.classList.toggle("dw-btn-on", b.dataset.anchor === anclaje);

    for (const n of [fontSel, sizeInput]) n.disabled = ro;
    for (const b of [boldBtn, italBtn, ...alignBtns]) b.disabled = ro;
  }

  /* Un <input type=color> solo entiende #rrggbb: «none» y los colores
     con nombre se enseñan en la etiqueta de al lado. */
  function paintColor(input, label, value) {
    if (value == null) { label.textContent = "varios"; return; }
    const v = String(value).trim();
    if (v === "none" || v === "") { label.textContent = "sin color"; return; }
    label.textContent = v;
    if (/^#[0-9a-f]{6}$/i.test(v)) input.value = v;
    else if (/^#[0-9a-f]{3}$/i.test(v))
      input.value = "#" + v.slice(1).split("").map(c => c + c).join("");
  }

  refresh();
  return { refresh, host };
}
