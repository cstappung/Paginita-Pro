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
import { esFormula, latexDe } from "./latex.js";
import { createChip, createColorPopover } from "./color-popover.js";
import { esCurva, curvaSpec, CURVA_MAX, ONDAS_MAX } from "./geom.js";
import { etiquetaPaint, esGrad, SOMBRA_POR_DEFECTO, normSombra,
  PUNTAS, TIPOS_PUNTA, normPunta, readArrow, atributosPunta, esMarcable } from "./paint.js";

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
  const onEditFormula = opts.onEditFormula || (() => {});
  /* El degradado necesita el documento: su definición vive en el <defs>
     del dibujo. El panel no lo conoce, así que traduce la ficha a valor
     de atributo (y al revés) a través de quien lo creó. */
  const resolvePaint = opts.resolvePaint || (spec => (spec && spec.tipo === "solid" ? spec.color : "none"));
  const readPaint = opts.readPaint || (v => (v == null || v === "none" ? { tipo: "none" } : { tipo: "solid", color: v }));
  /* La sombra es un <filter> del <defs>, igual que el degradado: el
     panel maneja la ficha y quien lo creó la traduce. */
  const resolveShadow = opts.resolveShadow || (() => null);
  const readShadow = opts.readShadow || (() => null);
  const resolveArrow = opts.resolveArrow || (() => null);
  const readArrowSpec = opts.readArrowSpec || (() => null);
  /* Cuánto agranda el lienzo lo que hay elegido. Escalar una figura se
     guarda en su `transform`, así que un trazo de 0,5 mm escalado al
     doble se ve de 1 mm mientras el atributo sigue diciendo 0,5: el panel
     enseña y acepta lo que se VE, y aquí se traduce. */
  const getScale = opts.getScale || (() => 1);
  /* Volver a curvar no es escribir un atributo: hay que recalcular el
     trazado a partir de los extremos de CADA curva, así que va por su
     propio camino (`Tools.setCurva`) y no por `apply`. */
  const onCurva = opts.onCurva || (() => {});

  host.textContent = "";
  host.classList.add("dw-style");

  /* ---------- el cuadro de color ----------
     Uno para los dos canales: abrir el de trazo cierra el de relleno
     sin tener que acordarse de hacerlo. */
  const pop = createColorPopover({
    /* La paleta guardada del proyecto. Se pide al vuelo porque cambia
       con el proyecto abierto, y el panel se construye una sola vez. */
    getPaleta: opts.getPaleta || (() => null),
    canWrite
  });

  /* Una muestra pulsable por canal. Al abrirla se le pasa la ficha que
     describe lo que hay ahora, y cada cambio se aplica al vuelo. */
  const canal = (attr, porDefecto) => {
    const chip = createChip(botón => {
      const sel = getSel();
      const bruto = sel.length ? commonAttr(sel, attr, porDefecto) : (getStyle()[attr] || porDefecto);
      pop.open(botón, bruto == null ? { tipo: "none" } : readPaint(bruto),
        spec => apply({ [attr]: resolvePaint(spec) }));
    });
    const label = el("span", "dw-val");
    const row = el("div", "dw-row dw-row-color");
    row.append(chip, label);
    return { chip, label, row };
  };

  const section = (title) => {
    const s = el("div", "dw-sec");
    s.appendChild(el("div", "dw-sec-title", title));
    return s;
  };

  /* ---------- relleno ---------- */
  const secFill = section("RELLENO");
  const fill = canal("fill", "#000000");
  fill.chip.id = "dwFillColor";
  fill.label.id = "dwFillLabel";
  secFill.append(fill.row);

  /* ---------- trazo ---------- */
  const secStroke = section("TRAZO");
  const stroke = canal("stroke", "none");
  stroke.chip.id = "dwStrokeColor";
  stroke.label.id = "dwStrokeLabel";

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

  /* Puntas de flecha. Van en TRAZO porque son parte de la línea, y aquí
     además se le pueden poner (o quitar) a una que ya está dibujada —
     la barra de la herramienta solo decide la que viene. */
  const puntaRow = el("div", "dw-row");
  puntaRow.appendChild(el("label", "dw-lbl", "Puntas"));
  const puntaSel = el("select", "dw-sel");
  puntaSel.id = "dwArrow";
  for (const o of PUNTAS) {
    const op = document.createElement("option");
    op.value = o.value; op.textContent = o.label;
    puntaSel.appendChild(op);
  }
  puntaRow.appendChild(puntaSel);

  /* Tipo y tamaño de la punta. Solo aparecen cuando hay punta: son dos
     filas más en un panel que ya va justo, y sin flecha no dicen nada.

     El tamaño va aparte del grosor a propósito — es justo lo que no se
     podía hacer antes— y por eso NO pasa por `getScale()` como el
     grosor: el marcador se comparte entre figuras que pueden estar en
     capas con escalas distintas, así que se guarda y se enseña en
     unidades del dibujo. */
  const tipoRow = el("div", "dw-row");
  tipoRow.appendChild(el("label", "dw-lbl", "Tipo"));
  const tipoSel = el("select", "dw-sel");
  tipoSel.id = "dwArrowType";
  for (const t of TIPOS_PUNTA) {
    const op = document.createElement("option");
    op.value = t.value; op.textContent = t.label;
    tipoSel.appendChild(op);
  }
  tipoRow.appendChild(tipoSel);

  const tamRow = el("div", "dw-row");
  tamRow.appendChild(el("label", "dw-lbl", "Tamaño"));
  const tamInput = el("input", "dw-num");
  tamInput.type = "number";
  tamInput.id = "dwArrowSize";
  tamInput.min = "0.3"; tamInput.step = "0.5";
  tamRow.append(tamInput, el("span", "dw-unit", "mm"));

  const verPunta = modo => {
    tipoRow.style.display = modo ? "" : "none";
    tamRow.style.display = modo ? "" : "none";
  };

  /* La ficha que enseñan los dos controles. Cuando la selección no tiene
     punta todavía, valen como memoria de lo último elegido: poner
     «flecha al final» usa el tipo y el tamaño que se estén viendo. */
  const puntaSpec = () => normPunta({ tipo: tipoSel.value, tamaño: tamInput.value });
  const aplicarPunta = () => {
    const modo = puntaSel.value;
    apply(atributosPunta(modo, modo ? resolveArrow(puntaSpec()) : null));
    verPunta(modo);
  };
  puntaSel.onchange = aplicarPunta;
  tipoSel.onchange = aplicarPunta;
  // el tamaño se confirma solo poco después de teclear, como el grosor
  alTeclear(tamInput, () => { if (puntaSel.value) aplicarPunta(); });

  secStroke.append(stroke.row, widthRow, dashRow, cap.row, join.row, puntaRow, tipoRow, tamRow);

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

  /* ---------- fórmula ----------
     Una fórmula ya se corregía con doble clic o con Intro, pero eso no
     se ve por ninguna parte: quien la había puesto hacía días la daba
     por intocable. Aquí queda el botón, con su propio LaTeX debajo para
     saber cuál de las tres se va a abrir. */
  const secFx = section("FÓRMULA");
  const fxTex = el("div", "dw-fx-tex");
  const fxBtn = el("button", "dw-btn dw-btn-wide", "✎ Editar fórmula");
  fxBtn.type = "button";
  fxBtn.title = "Corregir el LaTeX (también: doble clic sobre ella, o Intro)";
  fxBtn.onclick = () => {
    const f = getSel().filter(esFormula);
    if (f.length === 1 && canWrite()) onEditFormula(f[0]);
  };
  secFx.append(fxTex, fxBtn);

  /* ---------- sombra ----------
     Un `<filter>` con un feDropShadow. La casilla es la que manda: al
     marcarla nace con los valores por defecto, y al quitarla se borra
     el atributo entero en vez de dejar una sombra de cero, que sigue
     costando un filtro por figura al dibujar y al exportar. */
  const secShadow = section("SOMBRA");
  const shOn = el("input");
  shOn.type = "checkbox";
  const shLabel = el("label", "dw-check");
  shLabel.append(shOn, el("span", null, "Con sombra"));
  const shBody = el("div", "dw-sh-body");
  const shAviso = el("div", "dw-sh-aviso", "El archivo trae su propio filtro; marcar la casilla lo sustituye.");

  /* Ficha actual, para poder cambiar un campo sin perder los demás. */
  let shSpec = { ...SOMBRA_POR_DEFECTO };

  const shNum = (etiqueta, campo, min, max, unidad) => {
    const row = el("div", "dw-row");
    row.appendChild(el("label", "dw-lbl", etiqueta));
    const inp = el("input", "dw-num");
    inp.type = "number";
    inp.min = String(min); inp.max = String(max); inp.step = "0.2";
    alTeclear(inp, () => {
      const v = parseFloat(inp.value);
      if (isFinite(v)) aplicarSombra({ [campo]: v });
    });
    row.append(inp, el("span", "dw-unit", unidad));
    shBody.appendChild(row);
    return inp;
  };
  const shX = shNum("Despl. X", "dx", -40, 40, "mm");
  const shY = shNum("Despl. Y", "dy", -40, 40, "mm");
  const shBlur = shNum("Difuminado", "blur", 0, 40, "mm");

  const shColorRow = el("div", "dw-row");
  shColorRow.appendChild(el("label", "dw-lbl", "Color"));
  const shColor = el("input", "dw-color");
  shColor.type = "color";
  shColor.oninput = () => aplicarSombra({ color: shColor.value });
  shColorRow.appendChild(shColor);
  shBody.appendChild(shColorRow);

  const shOpRow = el("div", "dw-row");
  shOpRow.appendChild(el("label", "dw-lbl", "Opacidad"));
  const shOp = el("input", "dw-range");
  shOp.type = "range"; shOp.min = "0"; shOp.max = "100"; shOp.step = "1";
  const shOpVal = el("span", "dw-val");
  shOp.oninput = () => { shOpVal.textContent = shOp.value + "%"; };
  shOp.onchange = () => aplicarSombra({ op: parseInt(shOp.value, 10) });
  shOpRow.append(shOp, shOpVal);
  shBody.appendChild(shOpRow);

  shOn.onchange = () => {
    if (!canWrite()) return;
    if (!shOn.checked) { apply({ filter: null }); return; }
    aplicarSombra({});
  };
  secShadow.append(shLabel, shAviso, shBody);

  function aplicarSombra(cambios) {
    if (!canWrite()) return;
    shSpec = normSombra({ ...shSpec, ...cambios });
    apply({ filter: resolveShadow(shSpec, getScale() || 1) });
  }

  /* ---------- rectángulo ----------
     El radio de las esquinas se podía elegir ANTES de dibujar y nunca
     después: una vez puesto el rectángulo, no había forma de
     redondearlo ni de volver a dejarlo en pico. */
  const secRect = section("RECTÁNGULO");
  const rxRow = el("div", "dw-row");
  rxRow.appendChild(el("label", "dw-lbl", "Esquinas"));
  const rxInput = el("input", "dw-num");
  rxInput.type = "number";
  rxInput.min = "0"; rxInput.step = "0.5";
  rxInput.title = "Radio de las esquinas; 0 las deja en pico";
  alTeclear(rxInput, () => {
    const v = parseFloat(rxInput.value);
    if (!isFinite(v) || v < 0) return;
    // el radio vive en las coordenadas de la figura, como el grosor
    const k = getScale() || 1;
    apply({ rx: v > 0 ? Math.round((v / k) * 10000) / 10000 : null });
  });
  rxRow.append(rxInput, el("span", "dw-unit", "mm"));
  secRect.appendChild(rxRow);

  /* ---------- curva ----------
     Lo mismo que las esquinas del rectángulo: la curvatura se elegía
     antes de arrastrar y ya no se podía tocar. Y es justo lo que se
     quiere tocar después — una flecha se dibuja apuntando a donde tiene
     que apuntar, y solo entonces se ve cuánto le falta de vuelo. */
  const secCurve = section("CURVA");
  const curvaNum = (etiqueta, titulo, campo, min, max, step) => {
    const row = el("div", "dw-row");
    row.appendChild(el("label", "dw-lbl", etiqueta));
    const inp = el("input", "dw-num");
    inp.type = "number";
    inp.min = String(min); inp.max = String(max); inp.step = String(step);
    inp.title = titulo;
    inp.id = campo === "curvatura" ? "dwCurva" : "dwOndas";
    alTeclear(inp, () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= min && v <= max) onCurva({ [campo]: v });
    });
    row.appendChild(inp);
    secCurve.appendChild(row);
    return inp;
  };
  const curvaInput = curvaNum("Curvatura", "Lo que se abomba, en % de la media cuerda: 100 % es medio círculo y el signo cambia de lado", "curvatura", -CURVA_MAX, CURVA_MAX, 5);
  curvaInput.parentNode.appendChild(el("span", "dw-unit", "%"));
  const ondasInput = curvaNum("Curvas", "En cuántos arcos alternados se parte: 2 hace una ese", "ondas", 1, ONDAS_MAX, 1);

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

  host.append(secFill, secStroke, secText, secFx, secRect, secCurve, secShadow, secOp, secOrder, secPage);

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
    for (const n of [widthInput, dashSel, cap.sel, join.sel, puntaSel, tipoSel, tamInput,
      curvaInput, ondasInput, opInput, pw, ph]) n.disabled = ro;
    host.querySelectorAll(".dw-chip,.dw-btn").forEach(b => { b.disabled = ro; });

    const fillV = sel.length ? commonAttr(sel, "fill", "#000000") : st.fill;
    const strokeV = sel.length ? commonAttr(sel, "stroke", "none") : st.stroke;
    const width = sel.length ? commonAttr(sel, "stroke-width", "1") : st["stroke-width"];
    const dash = sel.length ? commonAttr(sel, "stroke-dasharray", "") : "";
    const op = sel.length ? commonAttr(sel, "opacity", "1") : 1;

    pintarCanal(fill, fillV);
    pintarCanal(stroke, strokeV);
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
    /* La fila de puntas solo aparece con figuras que puedan enseñarlas:
       en un rectángulo la lista no haría nada y en un polígono haría
       algo indeseado (ver `esMarcable`).

       «varios» en cualquiera de los dos extremos deja la lista sin
       marcar, igual que los demás controles: elegir algo entonces se lo
       pone a todo, que es lo que se espera al tocarla a propósito. */
    const marcables = sel.filter(esMarcable);
    puntaRow.style.display = marcables.length ? "" : "none";
    verPunta(false);
    if (marcables.length) {
      const mi = commonAttr(marcables, "marker-start", "");
      const mf = commonAttr(marcables, "marker-end", "");
      const modo = mi == null || mf == null ? null : readArrow(mi, mf);
      puntaSel.value = modo == null ? "" : modo;
      if (modo == null) puntaSel.selectedIndex = -1;
      /* El tipo y el tamaño se leen del marcador al que apunta la
         figura. Si la selección no se pone de acuerdo se dejan como
         están: son la memoria de lo último elegido, y borrarlos haría
         que tocar la lista de puntas pusiera cualquier cosa. */
      verPunta(!!modo);
      const spec = readArrowSpec(modo === "start" ? mi : mf);
      if (spec) {
        if (document.activeElement !== tipoSel) tipoSel.value = spec.tipo;
        if (document.activeElement !== tamInput) tamInput.value = String(spec.tamaño);
      }
    }

    const pct = op == null ? 100 : Math.round(parseFloat(op) * 100);
    opInput.value = String(isFinite(pct) ? pct : 100);
    opLabel.textContent = op == null ? "varios" : `${isFinite(pct) ? pct : 100}%`;

    refreshText(sel, ro);
    refreshFormula(sel, ro);
    refreshRect(sel, ro);
    refreshCurva(sel, ro);
    refreshShadow(sel, ro);

    const page = getPage();
    if (!enUso(pw)) pw.value = String(Math.round(page.w * 10) / 10 || "");
    if (!enUso(ph)) ph.value = String(Math.round(page.h * 10) / 10 || "");
  }

  /* El radio solo tiene sentido si TODO lo elegido son rectángulos: con
     un círculo de por medio, escribir un número le pondría un atributo
     que no pinta nada y el panel estaría mintiendo. */
  function refreshRect(sel, ro) {
    const rects = sel.filter(n => n && n.nodeName === "rect");
    const mostrar = sel.length > 0 && rects.length === sel.length;
    secRect.style.display = mostrar ? "" : "none";
    if (!mostrar) return;
    const k = getScale() || 1;
    const r = commonAttr(rects, "rx", "0");
    if (!enUso(rxInput))
      rxInput.value = r == null ? "" : String(Math.round((parseFloat(r) || 0) * k * 100) / 100);
    rxInput.placeholder = r == null ? "varios" : "";
    rxInput.disabled = ro;
  }

  /* Igual que el rectángulo: solo si TODO lo elegido son curvas
     nuestras. Un `<path>` importado no tiene ficha que enseñar, y
     escribirle una curvatura le borraría el trazado que trae. */
  function refreshCurva(sel, ro) {
    const curvas = sel.filter(esCurva);
    const mostrar = sel.length > 0 && curvas.length === sel.length;
    secCurve.style.display = mostrar ? "" : "none";
    if (!mostrar) return;
    const fichas = curvas.map(curvaSpec);
    const igual = campo => fichas.every(f => f[campo] === fichas[0][campo]) ? fichas[0][campo] : null;
    for (const [inp, v] of [[curvaInput, igual("curvatura")], [ondasInput, igual("ondas")]]) {
      if (!enUso(inp)) inp.value = v == null ? "" : String(v);
      inp.placeholder = v == null ? "varios" : "";
      inp.disabled = ro;
    }
  }

  /* La sombra se enseña con algo elegido y nada más: sin selección no
     hay a qué ponérsela, y a diferencia del color no se guarda para la
     siguiente figura. */
  function refreshShadow(sel, ro) {
    secShadow.style.display = sel.length ? "" : "none";
    if (!sel.length) return;
    const v = commonAttr(sel, "filter", "none");
    // «varios» (v == null) se trata como sin sombra: marcar la casilla
    // se la pone a todas, que es lo que se esperaría al pulsarla
    // los valores del filtro están en el espacio de la figura, no en
    // milímetros de papel: ver la cabecera de las sombras en paint.js
    const spec = v == null ? null : readShadow(v, getScale() || 1);
    const ajeno = spec === "ajeno";
    const activa = !!spec && !ajeno;
    shOn.checked = activa;
    shOn.disabled = ro;
    shAviso.style.display = ajeno ? "" : "none";
    shBody.style.display = activa ? "" : "none";
    if (!activa) return;
    shSpec = spec;
    for (const [inp, val] of [[shX, spec.dx], [shY, spec.dy], [shBlur, spec.blur]]) {
      if (!enUso(inp)) inp.value = String(Math.round(val * 100) / 100);
      inp.disabled = ro;
    }
    if (!enUso(shColor)) shColor.value = spec.color;
    if (!enUso(shOp)) shOp.value = String(Math.round(spec.op));
    shOpVal.textContent = Math.round(spec.op) + "%";
    shColor.disabled = ro;
    shOp.disabled = ro;
  }

  /* Sólo con UNA fórmula elegida: con dos, el botón tendría que decidir
     cuál abre, y con un rectángulo no dice nada. */
  function refreshFormula(sel, ro) {
    const f = sel.filter(esFormula);
    const mostrar = f.length === 1 && sel.length === 1;
    secFx.style.display = mostrar ? "" : "none";
    if (!mostrar) return;
    const tex = latexDe(f[0]);
    fxTex.textContent = tex.length > 60 ? tex.slice(0, 59) + "…" : tex;
    fxTex.title = tex;
    fxBtn.disabled = ro;
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

  /* La muestra y su rótulo. Un valor null es «la selección no coincide»,
     y entonces la muestra va a rayas: enseñar el color del primero
     invitaba a pulsar y pisar el de los demás sin querer.

     Si el cuadro está abierto sobre esta muestra también se le pasa la
     ficha nueva: el documento puede haber cambiado por debajo (otra
     persona, o un Ctrl+Z) y el cuadro estaría enseñando lo de antes. */
  function pintarCanal(c, value) {
    const spec = value == null ? null : readPaint(value);
    c.chip.pintar(spec, spec ? etiquetaPaint(spec) : "varios");
    c.label.textContent = etiquetaPaint(spec);
    c.label.classList.toggle("dw-val-grad", !!spec && esGrad(spec));
    if (pop.isOpen() && pop.anchorIs(c.chip) && spec) pop.setSpec(spec);
  }

  refresh();
  return { refresh, host };
}
