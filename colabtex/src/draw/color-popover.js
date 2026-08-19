"use strict";
/* ============================================================
   ColabDraw — el cuadro de color

   Antes el panel derecho llevaba las quince muestras de relleno Y las
   quince de trazo siempre desplegadas: treinta botones ocupando media
   columna para elegir un color cada media hora, y con la sección de
   TRAZO empujada tan abajo que el grosor caía fuera de la vista. Ahora
   cada canal es UNA muestra que se pulsa, y todo lo demás vive aquí
   dentro.

   Decisiones que conviene no deshacer:

   - **El selector nativo se queda.** `<input type="color">` abre el mapa
     de colores del sistema, con cuentagotas incluido; nada de lo que se
     pueda dibujar aquí en un rato lo iguala.
   - **Se aplica al vuelo**, sin botón de aceptar: es lo que ya hacían
     las muestras, y con la figura seleccionada detrás se ve el efecto
     mientras se elige.
   - **Va en `position:fixed` y colgado del `<body>`**, no dentro del
     panel: el panel tiene `overflow:auto`, así que ahí dentro el cuadro
     quedaba recortado por el borde y con barra de desplazamiento propia.
   - **Un solo cuadro para los dos canales.** Abrir el de trazo cierra el
     de relleno por construcción, que es lo que se espera de un menú.
   ============================================================ */

import {
  DIRECCIONES, CENTROS, specPorDefecto, normStops, cssPaint, esGrad
} from "./paint.js";

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

const hex6 = v => /^#[0-9a-f]{6}$/i.test(String(v || "").trim());

/* Un color que `<input type="color">` pueda enseñar. Los nombres CSS y
   el «none» no le valen, y dejarle un valor que no entiende lo pone en
   negro sin avisar. */
const paraInput = v => {
  const s = String(v || "").trim();
  if (hex6(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + s.slice(1).split("").map(c => c + c).join("");
  return null;
};

/* ============================================================
   Una muestra pulsable: el botón que sustituye a la parrilla.
   ============================================================ */

export function createChip(onOpen) {
  const b = el("button", "dw-chip");
  b.type = "button";
  const cara = el("span", "dw-chip-cara");
  b.appendChild(cara);
  b.onclick = () => onOpen(b);

  /* `spec` null significa que la selección no se pone de acuerdo: se
     pinta a rayas en vez de mentir con el color del primero. */
  b.pintar = (spec, texto) => {
    cara.className = "dw-chip-cara";
    cara.style.background = "";
    if (!spec) { cara.classList.add("dw-chip-varios"); }
    else if (spec.tipo === "none") { cara.classList.add("dw-chip-none"); }
    else cara.style.background = cssPaint(spec);
    b.title = texto || "";
  };
  return b;
}

/* ============================================================
   El cuadro. Uno solo para toda la aplicación.
   ============================================================ */

export function createColorPopover() {
  const pop = el("div", "dw-pop");
  pop.style.display = "none";
  document.body.appendChild(pop);

  let spec = { tipo: "none" };
  let onChange = () => {};
  let ancla = null;
  let abierto = false;

  /* ---------- pestañas ---------- */
  const tabs = el("div", "dw-pop-tabs");
  const tabPlano = el("button", "dw-pop-tab", "Plano");
  const tabGrad = el("button", "dw-pop-tab", "Degradado");
  for (const t of [tabPlano, tabGrad]) t.type = "button";
  tabs.append(tabPlano, tabGrad);

  const cuerpoPlano = el("div", "dw-pop-body");
  const cuerpoGrad = el("div", "dw-pop-body");
  pop.append(tabs, cuerpoPlano, cuerpoGrad);

  /* ---------- plano ---------- */
  const parrilla = el("div", "dw-swatches");
  for (const c of PALETTE) {
    const b = el("button", "dw-swatch" + (c === "none" ? " dw-swatch-none" : ""));
    b.type = "button";
    b.dataset.color = c;
    b.title = c === "none" ? "Sin color" : c;
    if (c !== "none") b.style.background = c;
    b.onclick = () => emitir(c === "none" ? { tipo: "none" } : { tipo: "solid", color: c });
    parrilla.appendChild(b);
  }

  const mapaRow = el("div", "dw-pop-row");
  const mapa = el("input", "dw-color");
  mapa.type = "color";
  mapa.title = "Abrir el mapa de colores del sistema";
  const hex = el("input", "dw-hex");
  hex.type = "text";
  hex.spellcheck = false;
  hex.placeholder = "#rrggbb";
  mapaRow.append(mapa, hex);
  mapa.oninput = () => emitir({ tipo: "solid", color: mapa.value });
  hex.onchange = () => {
    const v = paraInput(hex.value.trim().replace(/^(?!#)/, "#"));
    if (v) emitir({ tipo: "solid", color: v });
    else pintar();
  };
  cuerpoPlano.append(parrilla, mapaRow);

  /* ---------- degradado ---------- */
  const tipoRow = el("div", "dw-pop-row");
  const btnLineal = el("button", "dw-btn", "Lineal");
  const btnRadial = el("button", "dw-btn", "Radial");
  for (const b of [btnLineal, btnRadial]) b.type = "button";
  btnLineal.onclick = () => cambiarTipo("linear");
  btnRadial.onclick = () => cambiarTipo("radial");
  tipoRow.append(btnLineal, btnRadial);

  /* Dirección (lineal): ocho botones alrededor del ángulo escrito. Las
     flechas son para decidir sin pensar; el número, para repetir el
     mismo ángulo en dos figuras. */
  const dirWrap = el("div", "dw-pop-sub");
  dirWrap.appendChild(el("div", "dw-pop-lbl", "Dirección"));
  const dirPad = el("div", "dw-dirs");
  const dirBtns = DIRECCIONES.map(d => {
    const b = el("button", "dw-dir", d.label);
    b.type = "button";
    b.title = d.title;
    b.dataset.ang = String(d.ang);
    b.onclick = () => emitir({ ...spec, tipo: "linear", ang: d.ang });
    return b;
  });
  // en la rejilla de 3×3 el hueco del medio no es una dirección
  dirPad.append(dirBtns[7], dirBtns[0], dirBtns[1], dirBtns[6],
    el("span", "dw-dir-hueco"), dirBtns[2], dirBtns[5], dirBtns[4], dirBtns[3]);
  const angRow = el("div", "dw-pop-row");
  angRow.appendChild(el("label", "dw-pop-lbl", "Ángulo"));
  const angInput = el("input", "dw-num");
  angInput.type = "number"; angInput.min = "0"; angInput.max = "359"; angInput.step = "15";
  angInput.oninput = () => {
    const v = parseFloat(angInput.value);
    if (isFinite(v)) emitir({ ...spec, tipo: "linear", ang: ((v % 360) + 360) % 360 }, true);
  };
  angRow.append(angInput, el("span", "dw-unit", "°"));
  dirWrap.append(dirPad, angRow);

  /* Centro (radial): la misma rejilla, pero aquí el centro SÍ es una
     opción y es además la normal. */
  const cenWrap = el("div", "dw-pop-sub");
  cenWrap.appendChild(el("div", "dw-pop-lbl", "Centro"));
  const cenPad = el("div", "dw-dirs");
  const cenBtns = CENTROS.map(c => {
    const b = el("button", "dw-dir", c.label);
    b.type = "button";
    b.title = `Centro en ${c.cx} %, ${c.cy} %`;
    b.dataset.cx = String(c.cx); b.dataset.cy = String(c.cy);
    b.onclick = () => emitir({ ...spec, tipo: "radial", cx: c.cx, cy: c.cy });
    return b;
  });
  cenPad.append(...cenBtns);
  cenWrap.appendChild(cenPad);

  /* Paradas: una fila por color, con su posición y su aspa. */
  const stopsWrap = el("div", "dw-pop-sub");
  stopsWrap.appendChild(el("div", "dw-pop-lbl", "Colores"));
  const stopsList = el("div", "dw-stops");
  const btnAdd = el("button", "dw-btn dw-btn-wide", "＋ Añadir color");
  btnAdd.type = "button";
  btnAdd.onclick = () => {
    const l = normStops(spec.stops);
    const ult = l[l.length - 1], pen = l[l.length - 2];
    // el nuevo cae en medio de los dos últimos, que es donde hay sitio
    emitir({ ...spec, stops: l.concat([{ c: ult.c, o: Math.round((pen.o + ult.o) / 2) }]) });
  };
  const btnInv = el("button", "dw-btn dw-btn-wide", "⇄ Invertir");
  btnInv.type = "button";
  btnInv.onclick = () => {
    const l = normStops(spec.stops).map(s => ({ c: s.c, o: 100 - s.o }));
    emitir({ ...spec, stops: l });
  };
  const accRow = el("div", "dw-pop-row");
  accRow.append(btnAdd, btnInv);
  stopsWrap.append(stopsList, accRow);

  const barra = el("div", "dw-grad-prev");
  cuerpoGrad.append(barra, tipoRow, dirWrap, cenWrap, stopsWrap);

  /* ---------- pintar las paradas ----------
     Se reconstruyen enteras en cada cambio, pero NO mientras se está
     usando un control: rehacer la lista con el ratón apretado en un
     campo de color le quitaría el elemento debajo y cortaría el gesto. */
  function pintarStops() {
    /* Solo frena un CAMPO con el foco: si frenara también con un botón
       (el aspa se queda con el foco al pulsarla), quitar un color no
       repintaría la lista y el color seguiría ahí a la vista. */
    const foco = document.activeElement;
    if (foco && foco.tagName === "INPUT" && stopsList.contains(foco)) return;
    stopsList.textContent = "";
    const l = normStops(spec.stops);
    l.forEach((s, i) => {
      const row = el("div", "dw-stop");
      const c = el("input", "dw-color dw-color-sm");
      c.type = "color";
      c.value = paraInput(s.c) || "#000000";
      c.oninput = () => {
        const copia = normStops(spec.stops);
        copia[i] = { c: c.value, o: copia[i].o };
        emitir({ ...spec, stops: copia }, true);
      };
      const p = el("input", "dw-num dw-num-sm");
      p.type = "number"; p.min = "0"; p.max = "100"; p.step = "5";
      p.value = String(Math.round(s.o));
      p.oninput = () => {
        const v = parseFloat(p.value);
        if (!isFinite(v)) return;
        const copia = normStops(spec.stops);
        copia[i] = { c: copia[i].c, o: Math.max(0, Math.min(100, v)) };
        emitir({ ...spec, stops: copia }, true);
      };
      const x = el("button", "dw-stop-x", "✕");
      x.type = "button";
      x.title = "Quitar este color";
      // con dos paradas ya no es un degradado: el aspa se apaga, no se esconde
      x.disabled = l.length <= 2;
      x.onclick = () => emitir({ ...spec, stops: l.filter((_, j) => j !== i) });
      row.append(c, p, el("span", "dw-unit", "%"), x);
      stopsList.appendChild(row);
    });
  }

  /* Pasar de lineal a radial no puede perder los colores, pero tampoco
     puede quedarse sin centro: se parte de la ficha por defecto del
     tipo nuevo y encima va lo que ya había. Sin esto, el radial nacía
     con cx=cy=0 (la esquina) porque la ficha lineal no trae centro. */
  function cambiarTipo(tipo) {
    if (!esGrad(spec)) {
      emitir(specPorDefecto(tipo, spec.tipo === "solid" ? spec.color : null));
      return;
    }
    emitir({ ...specPorDefecto(tipo), ...spec, tipo });
  }

  /* `suave` evita rehacer los campos numéricos mientras se teclea o se
     arrastra un deslizador: solo se refresca lo que no tiene el foco. */
  function emitir(next, suave = false) {
    spec = next;
    onChange(spec);
    pintar(suave);
  }

  function pintar(suave = false) {
    const grad = esGrad(spec);
    tabPlano.classList.toggle("dw-pop-tab-on", !grad);
    tabGrad.classList.toggle("dw-pop-tab-on", grad);
    cuerpoPlano.style.display = grad ? "none" : "";
    cuerpoGrad.style.display = grad ? "" : "none";

    if (!grad) {
      const v = spec.tipo === "solid" ? paraInput(spec.color) : null;
      if (v && document.activeElement !== mapa) mapa.value = v;
      if (document.activeElement !== hex) hex.value = spec.tipo === "none" ? "" : String(spec.color || "");
      hex.placeholder = spec.tipo === "none" ? "sin color" : "#rrggbb";
      for (const b of parrilla.children)
        b.classList.toggle("dw-swatch-on",
          (spec.tipo === "none" && b.dataset.color === "none") ||
          (spec.tipo === "solid" && b.dataset.color.toLowerCase() === String(spec.color).toLowerCase()));
      return;
    }

    barra.style.background = cssPaint(spec);
    const lineal = spec.tipo === "linear";
    btnLineal.classList.toggle("dw-btn-on", lineal);
    btnRadial.classList.toggle("dw-btn-on", !lineal);
    dirWrap.style.display = lineal ? "" : "none";
    cenWrap.style.display = lineal ? "none" : "";
    if (lineal) {
      const a = Math.round(spec.ang || 0);
      for (const b of dirBtns) b.classList.toggle("dw-dir-on", Number(b.dataset.ang) === a);
      if (!suave || document.activeElement !== angInput) angInput.value = String(a);
    } else {
      for (const b of cenBtns)
        b.classList.toggle("dw-dir-on",
          Number(b.dataset.cx) === Math.round(spec.cx) && Number(b.dataset.cy) === Math.round(spec.cy));
    }
    if (!suave) pintarStops();
    else {
      // al arrastrar un color, la lista se queda; solo se repinta la barra
      const cs = stopsList.querySelectorAll(".dw-stop");
      if (cs.length !== normStops(spec.stops).length) pintarStops();
    }
  }

  /* ---------- colocar ---------- */

  /* Debajo del botón y dentro de la ventana. Se mide DESPUÉS de
     enseñarlo: con display:none el cuadro no tiene alto y siempre
     cabría, así que al abrirlo abajo del todo se salía por el pie. */
  function colocar() {
    const r = ancla.getBoundingClientRect();
    pop.style.visibility = "hidden";
    pop.style.display = "block";
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const margen = 8;
    let left = r.right - w;
    left = Math.max(margen, Math.min(left, window.innerWidth - w - margen));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - margen) top = Math.max(margen, r.top - h - 6);
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
    pop.style.visibility = "";
  }

  const fuera = e => {
    if (!abierto) return;
    if (pop.contains(e.target) || (ancla && ancla.contains(e.target))) return;
    close();
  };
  const tecla = e => { if (abierto && e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("pointerdown", fuera, true);
  document.addEventListener("keydown", tecla, true);
  window.addEventListener("resize", () => { if (abierto) colocar(); });

  function open(botón, inicial, cb, { titulo = "" } = {}) {
    onChange = cb || (() => {});
    ancla = botón;
    spec = inicial || { tipo: "none" };
    pop.dataset.titulo = titulo;
    abierto = true;
    pintarStops();
    pintar();
    colocar();
    if (ancla) ancla.classList.add("dw-chip-abierto");
  }

  function close() {
    abierto = false;
    pop.style.display = "none";
    if (ancla) ancla.classList.remove("dw-chip-abierto");
    ancla = null;
    onChange = () => {};
  }

  tabPlano.onclick = () => {
    if (!esGrad(spec)) return;
    const primero = normStops(spec.stops)[0];
    emitir({ tipo: "solid", color: primero.c });
  };
  tabGrad.onclick = () => { if (!esGrad(spec)) cambiarTipo("linear"); };

  return {
    open,
    close,
    isOpen: () => abierto,
    anchorIs: b => ancla === b,
    /* Refrescar sin tocar el ancla: la usa el panel cuando el documento
       cambia por debajo (otra persona, o un deshacer). */
    setSpec(next) { if (!abierto) return; spec = next || { tipo: "none" }; pintar(); }
  };
}
