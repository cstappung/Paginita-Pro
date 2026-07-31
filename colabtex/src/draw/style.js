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

export const PALETTE = [
  "none", "#000000", "#3d4c5e", "#8a97a3", "#ffffff",
  "#c0392b", "#e67e22", "#e2c08d", "#2e9e5b", "#0d9488",
  "#0f62fe", "#6cb6ff", "#6c4bb6", "#b58bf5", "#d6336c"
];

const DASHES = [
  { label: "———", value: "" },
  { label: "– – –", value: "3,2" },
  { label: "· · ·", value: "0.6,1.6" },
  { label: "–·–·", value: "4,1.5,0.8,1.5" }
];

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Valor común de un atributo en la selección, o null si difieren. */
export function commonAttr(els, name, fallback = null) {
  if (!els.length) return fallback;
  let out;
  for (let i = 0; i < els.length; i++) {
    const v = els[i].getAttribute(name);
    const norm = v == null || v === "" ? fallback : v;
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
  widthInput.onchange = () => {
    const v = parseFloat(widthInput.value);
    if (isFinite(v) && v >= 0) apply({ "stroke-width": v });
  };
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

  secStroke.append(strokeRow, swatches("stroke", c => apply({ stroke: c === "none" ? "none" : c })), widthRow, dashRow);

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
  pw.onchange = commitPage; ph.onchange = commitPage;
  pageRow.append(pw, el("span", "dw-unit", "×"), ph, el("span", "dw-unit", "mm"));
  secPage.appendChild(pageRow);

  host.append(secFill, secStroke, secOp, secOrder, secPage);

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
    for (const n of [fillInput, strokeInput, widthInput, dashSel, opInput, pw, ph])
      n.disabled = ro;
    host.querySelectorAll(".dw-swatch,.dw-btn").forEach(b => { b.disabled = ro; });

    const fill = sel.length ? commonAttr(sel, "fill", "#000000") : st.fill;
    const stroke = sel.length ? commonAttr(sel, "stroke", "none") : st.stroke;
    const width = sel.length ? commonAttr(sel, "stroke-width", "1") : st["stroke-width"];
    const dash = sel.length ? commonAttr(sel, "stroke-dasharray", "") : "";
    const op = sel.length ? commonAttr(sel, "opacity", "1") : 1;

    paintColor(fillInput, fillLabel, fill);
    paintColor(strokeInput, strokeLabel, stroke);
    widthInput.value = width == null ? "" : String(parseFloat(width) || 0);
    widthInput.placeholder = width == null ? "varios" : "";
    dashSel.value = dash == null ? "" : String(dash);
    const pct = op == null ? 100 : Math.round(parseFloat(op) * 100);
    opInput.value = String(isFinite(pct) ? pct : 100);
    opLabel.textContent = op == null ? "varios" : `${isFinite(pct) ? pct : 100}%`;

    const page = getPage();
    if (document.activeElement !== pw) pw.value = String(Math.round(page.w * 10) / 10 || "");
    if (document.activeElement !== ph) ph.value = String(Math.round(page.h * 10) / 10 || "");
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
