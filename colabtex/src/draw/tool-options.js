"use strict";
/* ============================================================
   ColabDraw — barra de opciones de la herramienta

   La franja que aparece sobre el lienzo cuando hay una herramienta de
   dibujo en la mano. Antes no había nada: se elegía «rectángulo» en el
   rail y a partir de ahí el único sitio donde mirar era el panel de la
   derecha, que enseña el estilo de LO QUE ESTÁ SELECCIONADO y con una
   herramienta en la mano no hay nada seleccionado. O sea que se
   dibujaba a ciegas y se corregía después.

   Aquí está lo que hace falta ANTES de arrastrar —de qué color, de qué
   grosor, con qué esquinas— y, sobre todo, lo que la herramienta sabe
   hacer y no se veía por ningún lado: cuadrado con Mayús, desde el
   centro con Alt, seguir dibujando sin volver a la flecha.

   La barra se reconstruye solo al CAMBIAR de herramienta; mientras es
   la misma únicamente se refrescan los valores, y saltándose el control
   que tenga el foco: si no, escribir «0.5» en el grosor se perdía a
   medias en cuanto el primer «0» disparaba un refresco.
   ============================================================ */

import { FONTS, DEFAULT_FONT, DEFAULT_SIZE } from "./text.js";
import { CAPS, DASHES, DEFAULT_CAP } from "./stroke.js";
import { PUNTAS, TIPOS_PUNTA, normPunta, readArrow, atributosPunta } from "./paint.js";

/* Herramientas que tienen algo que decir aquí. Con la flecha la barra
   se esconde: para transformar ya está el panel de la derecha, y una
   franja permanente encima del dibujo sería una franja de menos. */
const CON_BARRA = {
  rect: { icono: "▭", nombre: "Rectángulo" },
  ellipse: { icono: "◯", nombre: "Elipse" },
  line: { icono: "╱", nombre: "Línea" },
  curve: { icono: "⌒", nombre: "Curva" },
  poly: { icono: "△", nombre: "Polígono" },
  text: { icono: "T", nombre: "Texto" },
  formula: { icono: "∑", nombre: "Fórmula" },
  page: { icono: "⛶", nombre: "Papel" }
};

const FIGURAS = new Set(["rect", "ellipse", "line", "curve", "poly"]);

/* Línea y curva se arrastran de un extremo a otro: comparten relleno
   (ninguno), extremos de trazo, puntas de flecha y teclas. */
const esLineal = t => t === "line" || t === "curve";

const el = (tag, cls, texto) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (texto != null) n.textContent = texto;
  return n;
};

export function createToolOptions(host, opts = {}) {
  const getTool = opts.getTool || (() => "select");
  const getStyle = opts.getStyle || (() => ({}));
  const getTextStyle = opts.getTextStyle || (() => ({}));
  const getCrear = opts.getCrear || (() => ({}));
  const setCrear = opts.setCrear || (() => {});
  const onApply = opts.onApply || (() => {});
  const onExit = opts.onExit || (() => {});
  const getPage = opts.getPage || (() => ({ w: 0, h: 0 }));
  const onPage = opts.onPage || (() => {});
  const canWrite = opts.canWrite || (() => true);
  /* Igual que en el panel de la derecha: el grosor se pide y se enseña
     TAL COMO SE VE. Escalar se guarda en el transform (el de la figura o
     el de su capa), así que 0,5 mm de atributo dentro de una capa al
     doble se ven de 1 mm. */
  const getScale = opts.getScale || (() => 1);
  /* La punta de flecha es un <marker> del <defs> del dibujo, que esta
     barra no conoce: se le pide a quien la creó, igual que el panel de
     la derecha hace con los degradados. */
  const getArrowRef = opts.getArrowRef || (() => null);
  /* La curvatura no es un atributo del SVG (hay que recalcular el
     trazado a partir de los extremos de CADA curva), así que va por su
     propio camino en vez de por `onApply`. */
  const onCurva = opts.onCurva || (c => setCrear(c));

  host.classList.add("to-bar");
  let herramienta = null;      // la que está montada ahora mismo
  let sincronizar = null;      // cómo refrescar sus valores

  /* ---------- piezas ---------- */

  const grupo = () => el("div", "to-group");

  const etiqueta = texto => el("span", "to-lbl", texto);

  const pista = texto => el("span", "to-hint", texto);

  /* Un color con su botón de «sin color» al lado. El <input type=color>
     no sabe decir «none», y para una figura sin relleno no hay otra
     forma de pedirlo. */
  function color(attr, conNinguno) {
    const caja = el("div", "to-color-box");
    const inp = document.createElement("input");
    inp.type = "color";
    inp.className = "to-color";
    inp.oninput = () => onApply({ [attr]: inp.value });
    caja.appendChild(inp);
    let cero = null;
    if (conNinguno) {
      cero = el("button", "to-none", "∅");
      cero.type = "button";
      cero.title = "Sin color";
      cero.onclick = () => onApply({ [attr]: "none" });
      caja.appendChild(cero);
    }
    return {
      nodo: caja,
      sync(v) {
        const s = String(v == null ? "" : v).trim();
        const vacio = s === "none" || s === "";
        if (/^#[0-9a-f]{6}$/i.test(s)) inp.value = s;
        else if (/^#[0-9a-f]{3}$/i.test(s)) inp.value = "#" + s.slice(1).split("").map(c => c + c).join("");
        caja.classList.toggle("to-color-vacio", vacio);
        if (cero) cero.classList.toggle("to-on", vacio);
        inp.disabled = !canWrite();
        if (cero) cero.disabled = !canWrite();
      }
    };
  }

  function numero({ min = 0, max = null, step = 0.1, ancho = 54, unidad = "mm", onChange }) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "to-num";
    inp.min = String(min);
    if (max != null) inp.max = String(max);
    inp.step = String(step);
    inp.style.width = `${ancho}px`;
    /* Aplica al confirmar y también sola, poco después de dejar de
       teclear: de este panel se sale pinchando en el dibujo, y por ahí
       el `change` no llegaba nunca (ver style.js). */
    const commit = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= min && (max == null || v <= max)) onChange(v);
    };
    let temporizador = null;
    inp.addEventListener("input", () => { clearTimeout(temporizador); temporizador = setTimeout(commit, 350); });
    inp.addEventListener("change", () => { clearTimeout(temporizador); commit(); });
    const caja = el("span", "to-num-box");
    caja.appendChild(inp);
    if (unidad) caja.appendChild(el("span", "to-unit", unidad));
    return {
      nodo: caja,
      sync(v) {
        // nunca se pisa lo que se está escribiendo
        if (document.activeElement !== inp) inp.value = String(v);
        inp.disabled = !canWrite();
      }
    };
  }

  function lista(items, onChange, title) {
    const sel = el("select", "to-sel");
    if (title) sel.title = title;
    for (const o of items) {
      const op = document.createElement("option");
      op.value = o.value; op.textContent = o.label;
      if (o.title) op.title = o.title;
      sel.appendChild(op);
    }
    sel.onchange = () => onChange(sel.value);
    return {
      nodo: sel,
      sync(v) {
        sel.value = String(v == null ? "" : v);
        sel.disabled = !canWrite();
      }
    };
  }

  function casilla(texto, title, onChange) {
    const lab = el("label", "to-chk");
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.onchange = () => onChange(inp.checked);
    lab.title = title;
    lab.append(inp, el("span", null, texto));
    return {
      nodo: lab,
      sync(v) { inp.checked = !!v; inp.disabled = !canWrite(); }
    };
  }

  /* ---------- montaje por herramienta ---------- */

  function build(tool) {
    host.textContent = "";
    const info = CON_BARRA[tool];
    const titulo = el("span", "to-tool");
    titulo.append(el("span", "to-tool-ico", info.icono), el("span", null, info.nombre));
    host.appendChild(titulo);

    const partes = [];
    const add = (...nodos) => {
      const g = grupo();
      for (const n of nodos) g.appendChild(n.nodo || n);
      host.appendChild(g);
      return g;
    };

    if (tool === "page") {
      const w = numero({ min: 5, step: 1, onChange: v => onPage(v, getPage().h) });
      const h = numero({ min: 5, step: 1, onChange: v => onPage(getPage().w, v) });
      add(etiqueta("Tamaño"), w, el("span", "to-unit", "×"), h);
      const listo = el("button", "to-done", "✓ Listo");
      listo.type = "button";
      listo.title = "Salir del recorte (Esc, o un clic fuera del papel)";
      listo.onclick = () => onExit();
      add(listo);
      host.appendChild(pista("Arrastra los bordes para recortar · por dentro, mueve el papel"));
      partes.push(() => {
        const p = getPage();
        w.sync(Math.round(p.w * 10) / 10);
        h.sync(Math.round(p.h * 10) / 10);
      });
      return partes;
    }

    if (tool === "formula") {
      host.appendChild(pista("Pulsa en el lienzo y escribe la fórmula en LaTeX · doble clic sobre una fórmula puesta para corregirla"));
      return partes;
    }

    if (tool === "text") {
      const relleno = color("fill", false);
      add(etiqueta("Color"), relleno);
      const fuente = lista(FONTS, v => onApply({ "font-family": v }));
      const cuerpo = numero({ min: 0.5, step: 0.5, onChange: v => onApply({ "font-size": v }) });
      add(etiqueta("Fuente"), fuente, cuerpo);
      host.appendChild(pista("Pulsa en el lienzo y escribe · ✓ Listo o Ctrl+Intro"));
      partes.push(() => {
        const ts = getTextStyle();
        relleno.sync(ts.fill);
        fuente.sync(ts["font-family"] || DEFAULT_FONT);
        cuerpo.sync(parseFloat(ts["font-size"]) || DEFAULT_SIZE);
      });
      return partes;
    }

    /* --- figuras: rectángulo, elipse, línea y polígono --- */
    const relleno = esLineal(tool) ? null : color("fill", true);
    if (relleno) add(etiqueta("Relleno"), relleno);

    const trazo = color("stroke", true);
    const grosor = numero({
      min: 0, step: 0.1,
      onChange: v => onApply({ "stroke-width": Math.round((v / (getScale() || 1)) * 10000) / 10000 })
    });
    add(etiqueta("Trazo"), trazo, grosor);

    const guiones = lista(DASHES, v => onApply({ "stroke-dasharray": v || null }), "Tipo de línea");
    const extremos = esLineal(tool)
      ? lista(CAPS, v => onApply({ "stroke-linecap": v }), "Extremos de la línea")
      : null;
    if (extremos) add(guiones, extremos);
    else add(guiones);

    /* La punta va con la línea y no en el panel de la derecha porque es
       de las que hay que decidir ANTES de arrastrar: una flecha se
       dibuja en el sentido en que se quiere que apunte.

       El tipo y el tamaño se guardan en las opciones de dibujo
       (`Tools.crear`) y no en el estilo: sin punta puesta no hay ningún
       atributo donde apuntarlos, y sin eso elegir «rombo de 5 mm»,
       quitar la punta y volver a ponerla devolvía el triángulo de
       siempre. */
    let puntas = null, tipoPta = null, tamPta = null;
    if (esLineal(tool)) {
      const ficha = () => {
        const cr = getCrear();
        return { tipo: cr.flechaTipo, tamaño: cr.flechaTam };
      };
      const rehacer = () => {
        const modo = readArrow(getStyle()["marker-start"], getStyle()["marker-end"]);
        if (modo) onApply(atributosPunta(modo, getArrowRef(ficha())));
      };
      puntas = lista(PUNTAS, v => onApply(atributosPunta(v, v ? getArrowRef(ficha()) : null)),
        "Puntas de flecha");
      tipoPta = lista(TIPOS_PUNTA, v => { setCrear({ flechaTipo: v }); rehacer(); }, "Tipo de punta");
      tamPta = numero({
        min: 0.3, step: 0.5, ancho: 50,
        onChange: v => { setCrear({ flechaTam: v }); rehacer(); }
      });
      add(etiqueta("Punta"), puntas, tipoPta, tamPta);
    }

    /* La curvatura y las ondas se eligen antes de arrastrar, como los
       lados del polígono, pero a diferencia de aquellos siguen siendo
       corregibles después: `onCurva` se las pasa también a la curva que
       haya elegida (ver `Tools.setCurva`), que es lo que hace falta con
       «seguir dibujando» puesto. */
    let curvatura = null, ondas = null;
    if (tool === "curve") {
      curvatura = numero({
        min: -100, max: 100, step: 5, ancho: 56, unidad: "%",
        onChange: v => onCurva({ curvatura: v })
      });
      add(etiqueta("Curvatura"), curvatura);
      ondas = numero({
        min: 1, max: 6, step: 1, ancho: 44, unidad: "",
        onChange: v => onCurva({ ondas: Math.round(v) })
      });
      add(etiqueta("Curvas"), ondas);
    }

    let esquinas = null;
    if (tool === "rect") {
      esquinas = numero({ min: 0, step: 0.5, onChange: v => setCrear({ rx: v }) });
      add(etiqueta("Esquinas"), esquinas);
    }

    /* El polígono lleva sus lados AQUÍ, que es donde se decide cuántos
       tiene la que se va a dibujar: en el panel de la derecha llegaría
       tarde, porque los vértices ya estarían escritos. */
    let lados = null, estrella = null, punta = null;
    if (tool === "poly") {
      lados = numero({
        min: 3, step: 1, ancho: 46, unidad: "",
        onChange: v => setCrear({ lados: Math.max(3, Math.round(v)) })
      });
      add(etiqueta("Lados"), lados);
      estrella = casilla("Estrella", "Intercala un vértice más cerca del centro entre cada dos",
        v => setCrear({ estrella: v }));
      punta = numero({
        min: 5, step: 5, ancho: 46, unidad: "%",
        onChange: v => setCrear({ punta: Math.max(0.05, Math.min(v / 100, 0.95)) })
      });
      add(estrella, punta);
    }

    const seguir = casilla("Seguir dibujando",
      "Al soltar, la herramienta se queda en la mano en vez de volver a la flecha",
      v => setCrear({ mantener: v }));
    add(seguir);

    const REGULAR = { rect: "cuadrado", ellipse: "círculo", poly: "regular" };
    host.appendChild(pista(tool === "curve"
      ? "100 % es medio círculo · signo negativo, hacia el otro lado · Mayús: ángulos de 15° · Alt: desde el centro"
      : tool === "line"
        ? "Mayús: ángulos de 15° · Alt: desde el centro"
        : `Mayús: ${REGULAR[tool]} · Alt: desde el centro`));

    partes.push(() => {
      const st = getStyle();
      if (relleno) relleno.sync(st.fill);
      trazo.sync(st.stroke);
      grosor.sync(Math.round((parseFloat(st["stroke-width"]) || 0) * (getScale() || 1) * 100) / 100);
      guiones.sync(st["stroke-dasharray"] || "");
      if (extremos) extremos.sync(st["stroke-linecap"] || DEFAULT_CAP);
      if (puntas) puntas.sync(readArrow(st["marker-start"], st["marker-end"]));
      const cr = getCrear();
      if (curvatura) { curvatura.sync(cr.curvatura); ondas.sync(cr.ondas); }
      if (tipoPta) {
        const p = normPunta({ tipo: cr.flechaTipo, tamaño: cr.flechaTam });
        tipoPta.sync(p.tipo);
        tamPta.sync(p.tamaño);
        // sin punta no hay nada que afinar
        const hay = !!readArrow(st["marker-start"], st["marker-end"]);
        tipoPta.nodo.style.display = hay ? "" : "none";
        tamPta.nodo.style.display = hay ? "" : "none";
      }
      if (esquinas) esquinas.sync(parseFloat(cr.rx) || 0);
      if (lados) lados.sync(Math.max(3, Math.round(cr.lados) || 3));
      if (estrella) estrella.sync(!!cr.estrella);
      if (punta) {
        punta.sync(Math.round((cr.punta == null ? 0.5 : cr.punta) * 100));
        punta.nodo.style.display = cr.estrella ? "" : "none";
      }
      seguir.sync(cr.mantener);
    });
    return partes;
  }

  /* ---------- fuera ---------- */

  function render() {
    const tool = getTool();
    if (!CON_BARRA[tool]) {
      host.style.display = "none";
      host.textContent = "";
      herramienta = null;
      sincronizar = null;
      return;
    }
    host.style.display = "flex";
    if (tool !== herramienta) {
      sincronizar = build(tool);
      herramienta = tool;
    }
    if (sincronizar) for (const fn of sincronizar) fn();
  }

  render();
  return { render, host };
}
