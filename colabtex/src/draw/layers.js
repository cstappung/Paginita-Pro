"use strict";
/* ============================================================
   ColabDraw — panel de objetos (y capas)

   Es el «Objetos» de Inkscape: el árbol ENTERO del dibujo, no solo la
   lista de capas. Con una lista de capas a secas, un archivo de fuera
   —una figura de matplotlib, por ejemplo— aparece como una única fila
   y no hay forma de ver ni de tocar lo que lleva dentro, que es
   justamente donde está todo.

   Se lista de arriba abajo tal y como se ve: en cada nivel, el último
   hijo del documento es el que se pinta encima, así que la lista va al
   revés que el documento.

   Se dibujan solo las ramas desplegadas. Una figura de matplotlib trae
   miles de nodos y pintarlos todos en cada cambio dejaría el panel (y el
   lienzo, que comparte el mismo hilo) inservible.

   Las capas siguen siendo especiales en una cosa: lo que se dibuja va
   SIEMPRE a la capa activa.
   ============================================================ */
import { matMul, matInvert, matToString, parseTransform } from "./geom.js";
import { elChildren, indexOf, childrenOf } from "./doc.js";
import { esFormula } from "./latex.js";
import { readLines } from "./text.js";

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ---------- iconos ----------

   Dibujados, no emoji. Un 👁 y un 🔒 los pinta cada sistema a su manera
   —de colores, de otro tamaño y desalineados entre sí—, que es media
   razón por la que este panel se veía casero. Estos son SVG de trazo
   que heredan el color del texto, así que el ojo tachado se pone gris
   con su fila y el candado cerrado se pone ámbar sin más CSS. */
const ico = d =>
  `<svg viewBox="0 0 16 16" class="li" aria-hidden="true">${d}</svg>`;

const TRAZO = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';

const ICONOS = {
  desplegar: ico(`<path d="M6 3.5L10.5 8L6 12.5" ${TRAZO}/>`),
  ojo: ico(`<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" ${TRAZO}/><circle cx="8" cy="8" r="2" ${TRAZO}/>`),
  ojoTachado: ico(`<path d="M2.5 5.5C1.9 6.4 1.5 8 1.5 8S4 12.5 8 12.5c1 0 1.9-.2 2.7-.6M6.2 3.8C6.8 3.6 7.4 3.5 8 3.5c4 0 6.5 4.5 6.5 4.5s-.6 1.1-1.7 2.2" ${TRAZO}/><path d="M2 2l12 12" ${TRAZO}/>`),
  candadoAbierto: ico(`<rect x="3.5" y="7.5" width="9" height="6.5" rx="1.2" ${TRAZO}/><path d="M5.8 7.5V5.2a2.2 2.2 0 014.4-.3" ${TRAZO}/>`),
  candadoCerrado: ico(`<rect x="3.5" y="7.5" width="9" height="6.5" rx="1.2" ${TRAZO}/><path d="M5.8 7.5V5.2a2.2 2.2 0 014.4 0v2.3" ${TRAZO}/>`),
  capa: ico(`<path d="M8 1.8l6 3-6 3-6-3 6-3z" ${TRAZO}/><path d="M2.4 8.2L8 11l5.6-2.8M2.4 11.2L8 14l5.6-2.8" ${TRAZO}/>`),
  grupo: ico(`<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.6 2"/><rect x="4.2" y="4.2" width="4" height="4" rx=".6" ${TRAZO}/><rect x="8" y="8" width="4" height="4" rx=".6" ${TRAZO}/>`),
  rect: ico(`<rect x="2.5" y="3.5" width="11" height="9" rx="1" ${TRAZO}/>`),
  elipse: ico(`<ellipse cx="8" cy="8" rx="5.6" ry="4.4" ${TRAZO}/>`),
  linea: ico(`<path d="M3 13L13 3" ${TRAZO}/><circle cx="3" cy="13" r="1.4" ${TRAZO}/><circle cx="13" cy="3" r="1.4" ${TRAZO}/>`),
  curva: ico(`<path d="M2 12C4.5 4 11 12 14 4" ${TRAZO}/>`),
  imagen: ico(`<rect x="2" y="3" width="12" height="10" rx="1.2" ${TRAZO}/><circle cx="5.8" cy="6.4" r="1.1" ${TRAZO}/><path d="M3 12l3.4-3.2 2.3 2 2.2-2.3L14 11.4" ${TRAZO}/>`),
  otro: ico(`<circle cx="8" cy="8" r="3" ${TRAZO}/>`)
};

/* Un glifo para lo que se nombra mejor con una letra que con un dibujo. */
const glifo = txt => `<span class="li-glifo">${txt}</span>`;

const POR_ETIQUETA = {
  rect: ICONOS.rect, circle: ICONOS.elipse, ellipse: ICONOS.elipse,
  line: ICONOS.linea, polyline: ICONOS.curva, polygon: ICONOS.curva,
  path: ICONOS.curva, image: ICONOS.imagen, use: ICONOS.otro
};

function iconoDe(node, esCapa) {
  if (esCapa) return ICONOS.capa;
  if (esFormula(node)) return glifo("∑");
  const t = node.nodeName;
  if (t === "text") return glifo("T");
  if (t === "g") return ICONOS.grupo;
  return POR_ETIQUETA[t] || ICONOS.otro;
}

/* ---------- cómo se llama cada fila ----------

   `labelOf` acaba cayendo en el `id`, y un id es «ewxwgvzb»: una lista
   de eso no dice absolutamente nada de lo que hay en el dibujo. Aquí se
   nombra por lo que la cosa ES —«Rectángulo», «Grupo (3)»— y, cuando
   tiene contenido, POR SU CONTENIDO: un rótulo se llama como lo que
   pone en él y una fórmula como su LaTeX, que es como los enseña
   Inkscape y como se buscan con la vista. */
const NOMBRES = {
  rect: "Rectángulo", circle: "Círculo", ellipse: "Elipse", line: "Línea",
  polyline: "Polilínea", polygon: "Polígono", path: "Trazado",
  image: "Imagen", use: "Copia", svg: "Dibujo"
};

const recorta = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function nombreDe(node, esCapa) {
  const propio = node.getAttribute("data-layer") || node.getAttribute("data-label");
  if (propio) return esCapa ? propio : recorta(propio, 30);
  const t = node.nodeName;
  if (t === "text") {
    const texto = readLines(node).join(" ").trim();
    return texto ? recorta(texto, 30) : "Texto vacío";
  }
  if (t === "g") {
    const n = hijosDe(node).length;
    return `Grupo (${n})`;
  }
  return NOMBRES[t] || t;
}

/* Lo que no se dibuja no sale en el árbol: definiciones, estilos y
   metadatos llenarían la lista de filas que no se pueden ni ver ni
   seleccionar. */
const OCULTOS = new Set([
  "defs", "style", "title", "desc", "metadata", "clipPath", "mask",
  "marker", "linearGradient", "radialGradient", "pattern", "symbol",
  // un <tspan> es una línea de un rótulo, no un objeto que se pueda
  // elegir ni mover: en la lista solo era una fila muerta por línea
  "tspan", "textPath"
]);

const pintable = n => n && n.nodeName && !OCULTOS.has(n.nodeName);

/* Hay cosas que se cuentan como UNA. Una fórmula son decenas de <path>
   y de grupos que MathJax organiza a su manera, y un rótulo son sus
   líneas: abrir eso en el árbol es enterrar el dibujo entero bajo la
   tripa de una sola figura, y ahí dentro no hay nada que se pueda
   seleccionar por su cuenta. */
const esHoja = n => !n || n.nodeName === "text" || esFormula(n);

const hijosDe = node => (esHoja(node) ? [] : elChildren(node).filter(pintable));

/* Clave estable de un nodo, para recordar qué ramas están desplegadas.
   El id es lo mejor (sobrevive a los clonados que hacen falta para
   reordenar); sin él se usa la posición dentro del árbol. */
export function claveDe(node) {
  if (!node || !node.getAttribute) return "";
  const id = node.getAttribute("id");
  if (id) return "#" + id;
  const p = node.parent;
  return `${p ? claveDe(p) : ""}/${p ? indexOf(p, node) : 0}`;
}

/* Al pasar una figura de una capa a otra hay que compensar la diferencia
   entre las matrices de las dos capas, o la figura se vería desplazada:
   M' = Pdestino⁻¹ · Porigen · M. Con capas sin transform (las que crea
   ColabDraw) esto sale la identidad y no toca nada; importar un SVG sí
   deja capas con escala, y ahí importa. */
export function relocateTransform(canvas, elm, targetLayer) {
  if (!canvas) return undefined;
  const from = canvas.parentMatrix(elm);       // espacio donde está ahora
  const to = canvas.selfMatrix(targetLayer);   // espacio donde va a estar
  if (!from || !to) return undefined;          // sin datos: mejor no tocar
  const ti = matInvert(to);
  if (!ti) return undefined;
  const m0 = parseTransform(elm.getAttribute("transform"));
  return matToString(matMul(matMul(ti, from), m0));
}

/* ---------- menú del botón derecho ----------

   Cuelga del <body> y no del panel: el panel lleva `overflow:auto` y
   recortaría el menú de una fila que esté abajo del todo, que es
   exactamente donde más falta hace. Misma razón que el cuadro de color.

   Se cierra solo con cualquier cosa que lo deje sin sentido: pulsar
   fuera, Escape, la rueda o cambiar el tamaño de la ventana. Sin eso, un
   menú abierto sobre un panel que se desplaza queda flotando sobre filas
   que ya no son las suyas. */
function crearMenu() {
  const caja = el("div", "dw-menu");
  caja.style.display = "none";
  document.body.appendChild(caja);
  let abierto = false;

  const cerrar = () => {
    if (!abierto) return;
    abierto = false;
    caja.style.display = "none";
    caja.textContent = "";
  };

  const abrir = (x, y, opciones) => {
    caja.textContent = "";
    for (const op of opciones) {
      if (op.separador) { caja.appendChild(el("div", "dw-menu-sep")); continue; }
      const b = el("button", "dw-menu-op", op.label);
      b.disabled = !!op.off;
      if (op.hint) b.appendChild(el("span", "dw-menu-hint", op.hint));
      b.onclick = () => { cerrar(); op.fn(); };
      caja.appendChild(b);
    }
    caja.style.display = "block";
    abierto = true;
    /* Colocado DESPUÉS de enseñarlo: una caja con display:none mide 0 y
       cabría siempre, así que el menú se salía por abajo. */
    const r = caja.getBoundingClientRect();
    caja.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + "px";
    caja.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + "px";
  };

  const fuera = ev => { if (!caja.contains(ev.target)) cerrar(); };
  document.addEventListener("pointerdown", fuera, true);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") cerrar(); });
  window.addEventListener("resize", cerrar);
  window.addEventListener("wheel", cerrar, true);

  return { abrir, cerrar };
}

export function createObjectPanel(host, ctx) {
  const {
    getDrawing, getActiveId, setActiveId, canWrite,
    getSelection, setSelection, getCanvas, onChange, onStatus = () => {},
    /* Copiar y pegar son lo único del menú que no puede resolverse aquí:
       el portapapeles vive en las herramientas, que son las que saben
       traducir figuras a marcado SVG y al revés. */
    copiar = () => null, pegar = () => [], hayCopia = () => false
  } = ctx;

  const list = el("div", "layer-list");
  host.appendChild(list);
  const menu = crearMenu();

  const abiertos = new Set();   // ramas desplegadas
  let sembrado = false;         // ¿ya se abrieron las capas de este dibujo?
  let arrastrado = null;        // nodo que se está arrastrando por el árbol

  function drawingOrNull() {
    const d = getDrawing();
    return d && d.root() ? d : null;
  }

  /* Al abrir otro dibujo el árbol es otro. */
  function reset() {
    abiertos.clear();
    sembrado = false;
  }

  function render() {
    const d = drawingOrNull();
    list.innerHTML = "";
    if (!d) return;

    const capas = d.layers();
    if (!sembrado) {
      // las capas empiezan desplegadas: lo demás, cerrado
      for (const c of capas) abiertos.add(claveDe(c));
      sembrado = true;
    }

    const sel = new Set(getSelection());
    // lo elegido se ve aunque esté dentro de grupos cerrados
    for (const s of sel) {
      let n = s.parent;
      while (n && n.getAttribute) { abiertos.add(claveDe(n)); n = n.parent; }
    }

    const estado = { d, sel, activa: d.activeLayer(getActiveId()), rw: canWrite(), primera: null };
    for (let i = capas.length - 1; i >= 0; i--) fila(capas[i], 0, estado);
    if (estado.primera) estado.primera.scrollIntoView({ block: "nearest" });
  }

  /* Una fila, al estilo del panel «Objetos» de Inkscape:

       [sangría][▸][icono] Nombre ......................... [👁][🔒]

     Lo que se ve tiene que decir el estado COMPLETO, no solo el propio:
     una figura dentro de una capa oculta no se ve, y una dentro de un
     grupo bloqueado no se puede tocar, aunque ellas no tengan puesto
     nada. Antes esas filas se pintaban como cualquier otra y la única
     manera de enterarse era pinchar y ver que no pasaba nada. Ahora el
     icono heredado sale a media tinta y dice de quién viene. */
  function fila(node, nivel, estado) {
    const { d, sel, activa, rw } = estado;
    const clave = claveDe(node);
    const hijos = hijosDe(node);
    const abierto = abiertos.has(clave);
    const esCapa = node.getAttribute("data-layer") != null;
    const elegido = sel.has(node);

    const oculto = !d.layerVisible(node);
    const bloq = d.layerLocked(node);
    const ocultaOtro = oculto ? null : d.hiddenAncestor(node.parent);
    const bloqueaOtro = bloq ? null : d.lockedAncestor(node.parent);

    const row = el("div", "layer-row" +
      (esCapa ? " layer-capa" : "") +
      (esCapa && node === activa ? " layer-active" : "") +
      (elegido ? " layer-sel" : "") +
      /* El estado PROPIO se marca fuerte y el heredado flojo: si no,
         una capa bloqueada con veinte figuras dentro pinta veintiuna
         filas a rayas y ya no se distingue quién manda. */
      (oculto ? " layer-oculto" : ocultaOtro ? " layer-oculto-h" : "") +
      (bloq ? " layer-bloqueado" : bloqueaOtro ? " layer-bloqueado-h" : ""));
    row.style.paddingLeft = `${4 + nivel * 14}px`;
    if (elegido && !estado.primera) estado.primera = row;

    const exp = el("button", "layer-exp" + (abierto ? " abierto" : ""),
      hijos.length ? ICONOS.desplegar : "");
    exp.title = hijos.length ? (abierto ? "Plegar" : "Desplegar") : "";
    exp.disabled = !hijos.length;
    exp.onclick = ev => {
      ev.stopPropagation();
      if (abierto) abiertos.delete(clave); else abiertos.add(clave);
      render();
    };

    const tipo = el("span", "layer-tipo", iconoDe(node, esCapa));
    tipo.title = esCapa ? "Capa" : `<${node.nodeName}>`;

    const name = el("span", "layer-name" + (esCapa ? " layer-name-capa" : ""));
    name.textContent = nombreDe(node, esCapa);
    name.title = `<${node.nodeName}> — doble clic para renombrar`;
    name.ondblclick = ev => {
      ev.stopPropagation();
      renombrar(node, name.textContent);
    };

    /* Marca de la capa donde caerá lo próximo que se dibuje. Va FUERA
       del nombre: dentro se pegaba a él («Anotacionesactiva») y encima
       se lo comía el recorte por puntos suspensivos. */
    let chip = null;
    if (esCapa && node === activa) {
      chip = el("span", "layer-activa-chip", "activa");
      chip.title = "Lo que dibujes irá a esta capa";
    }

    const eye = el("button", "layer-ico layer-ojo" +
      (oculto ? " apagado" : "") + (ocultaOtro ? " heredado" : ""),
      oculto || ocultaOtro ? ICONOS.ojoTachado : ICONOS.ojo);
    eye.title = oculto ? "Está oculto — pulsa para mostrarlo"
      : ocultaOtro ? `No se ve: «${nombreDe(ocultaOtro)}» está oculta`
        : "Ocultar";
    eye.disabled = !rw;
    eye.onclick = ev => { ev.stopPropagation(); d.setLayerVisible(node, oculto); onChange(); };

    const lock = el("button", "layer-ico layer-candado" +
      (bloq ? " echado" : "") + (bloqueaOtro ? " heredado" : ""),
      bloq || bloqueaOtro ? ICONOS.candadoCerrado : ICONOS.candadoAbierto);
    lock.title = bloq ? "Está bloqueado — pulsa para desbloquearlo"
      : bloqueaOtro ? `Bloqueado por «${nombreDe(bloqueaOtro)}»`
        : "Bloquear";
    lock.disabled = !rw;
    lock.onclick = ev => { ev.stopPropagation(); d.setLayerLocked(node, !bloq); onChange(); };

    row.append(exp, tipo, name);
    if (chip) row.appendChild(chip);
    row.append(eye, lock);
    /* Pulsar una capa la hace la activa (es donde irá lo que se dibuje);
       pulsar cualquier otra cosa la selecciona en el lienzo. */
    row.onclick = ev => {
      if (esCapa) {
        setActiveId(node.getAttribute("id"));
        if (!ev.shiftKey) setSelection([]);
        render();
        return;
      }
      const capa = d.layerOf(node);
      if (capa) setActiveId(capa.getAttribute("id"));
      const actual = getSelection();
      setSelection(ev.shiftKey && !actual.includes(node) ? actual.concat([node]) : [node]);
      render();
    };
    /* Botón derecho: lo mismo que ofrece cualquier explorador. Antes,
       renombrar era un doble clic que nadie encuentra y borrar una capa
       solo se podía hacer con el botón de la cabecera, y solo a la
       activa. */
    row.oncontextmenu = ev => {
      ev.preventDefault();
      // el menú actúa sobre la fila pulsada, así que primero se elige
      if (!elegido) row.onclick(ev);
      menu.abrir(ev.clientX, ev.clientY, opcionesDe(node, esCapa));
    };
    if (rw) arrastrable(row, node, esCapa, estado);
    list.appendChild(row);

    if (abierto) for (let i = hijos.length - 1; i >= 0; i--) fila(hijos[i], nivel + 1, estado);
  }

  /* ---------- lo que ofrece el botón derecho ----------
     Las mismas cinco acciones para una capa y para una figura, con la
     diferencia de que en una capa se aplican a ELLA (y a lo que lleva
     dentro), mientras que en una figura se aplican a toda la selección
     si la fila pulsada forma parte de ella: es lo que se espera después
     de haber elegido tres cosas con Mayús. */
  function dianas(node) {
    const sel = getSelection();
    return sel.length > 1 && sel.includes(node) ? sel : [node];
  }

  function opcionesDe(node, esCapa) {
    const d = drawingOrNull();
    const rw = canWrite();
    if (!d) return [];
    const objetivos = esCapa ? [node] : dianas(node);
    const varios = objetivos.length > 1;
    const qué = esCapa ? "la capa" : varios ? `${objetivos.length} objetos` : "el objeto";
    return [
      { label: "Renombrar…", off: !rw || varios, fn: () => renombrar(node, nombreDe(node, esCapa)) },
      { label: "Duplicar", hint: "Ctrl+D", off: !rw, fn: () => duplicarNodos(node, esCapa, objetivos) },
      { separador: true },
      { label: "Copiar", hint: "Ctrl+C", fn: () => copiarNodos(objetivos, qué) },
      { label: "Pegar", hint: "Ctrl+V", off: !rw || !hayCopia(), fn: () => pegarEn(node, esCapa) },
      { separador: true },
      { label: "Eliminar", hint: "Supr", off: !rw, fn: () => eliminarNodos(node, esCapa, objetivos) }
    ];
  }

  function renombrar(node, actual) {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const v = prompt("Nombre:", actual);
    if (v == null) return;
    d.setLabel(node, v);
    onChange();
  }

  function duplicarNodos(node, esCapa, objetivos) {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    if (esCapa) {
      const copia = d.duplicateLayer(node);
      if (!copia) return;
      setActiveId(copia.getAttribute("id"));
      abiertos.add(claveDe(copia));
      onChange([]);                       // una capa no se selecciona como figura
      onStatus(`Capa «${d.labelOf(copia)}» duplicada.`);
      return;
    }
    const copias = d.duplicate(objetivos) || [];
    // las copias son otros nodos: la selección se rehace por id
    onChange(copias.map(c => c.getAttribute("id")).filter(Boolean));
    onStatus(copias.length ? `${copias.length} objeto${copias.length === 1 ? "" : "s"} duplicado${copias.length === 1 ? "" : "s"}.` : "");
  }

  function copiarNodos(objetivos, qué) {
    onStatus(copiar(objetivos) ? `Copiado ${qué}.` : "No se pudo copiar.");
  }

  /* Pegar «sobre» una fila es pegar en SU capa: lo que se pegue tiene que
     acabar donde se ha pulsado, no en la capa que estuviera activa de
     antes. Una capa entera pegada se pone al final, mande quien mande la
     fila, porque una capa no cabe dentro de otra. */
  function pegarEn(node, esCapa) {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const capa = esCapa ? node : d.layerOf(node);
    if (capa) setActiveId(capa.getAttribute("id"));
    const puestos = pegar() || [];
    if (puestos.length) abiertos.add(claveDe(capa || node));
  }

  function eliminarNodos(node, esCapa, objetivos) {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    if (esCapa) {
      if (d.layers().length <= 1) { onStatus("Un dibujo no puede quedarse sin capas."); return; }
      if (!confirm(`¿Eliminar la capa «${d.labelOf(node)}» y todo lo que contiene?`)) return;
      d.removeLayer(node);
      setActiveId(null);
      onChange([]);
      return;
    }
    d.remove(objetivos);
    onChange([]);
    onStatus(`${objetivos.length} objeto${objetivos.length === 1 ? "" : "s"} eliminado${objetivos.length === 1 ? "" : "s"}.`);
  }

  /* ---------- arrastrar dentro del árbol ----------
     Tres zonas por fila, como en cualquier explorador: el borde de
     arriba y el de abajo colocan al lado, y el centro mete DENTRO del
     grupo. Ojo con el orden: la lista va al revés que el documento
     (arriba se pinta encima), así que soltar «encima de» es insertar
     DESPUÉS en el documento. */
  function zonaDe(ev, row, destinoAdmiteDentro) {
    const r = row.getBoundingClientRect();
    const f = (ev.clientY - r.top) / (r.height || 1);
    if (!destinoAdmiteDentro) return f < 0.5 ? "antes" : "despues";
    if (f < 0.3) return "antes";
    if (f > 0.7) return "despues";
    return "dentro";
  }

  /* Una capa solo vive colgando del <svg>; una figura, solo dentro de una
     capa o de un grupo. Mezclarlo daría un SVG que no sabríamos pintar. */
  function admite(d, node, parent) {
    if (!parent || d.contains(node, parent)) return false;
    const raiz = d.root();
    const esCapaOrigen = node.getAttribute("data-layer") != null;
    if (esCapaOrigen) return parent === raiz;
    if (parent === raiz) return false;
    if (esFormula(parent)) return false;      // ver admiteHijos
    return parent.nodeName === "g" || parent.nodeName === "svg";
  }

  /* Una fórmula ES un <g>, pero por dentro es de MathJax: meterle algo
     ahí lo borraría la próxima vez que se corrija el LaTeX, porque
     reescribirla sustituye el grupo entero. Se trata como una figura
     cerrada, igual que en el árbol. */
  const admiteHijos = (node, esCapa) =>
    esCapa || (node.nodeName === "g" && !esFormula(node));

  function arrastrable(row, node, esCapa, estado) {
    const { d } = estado;
    row.draggable = true;

    row.addEventListener("dragstart", ev => {
      arrastrado = node;
      ev.dataTransfer.effectAllowed = "move";
      // algún navegador no arranca el arrastre sin datos
      try { ev.dataTransfer.setData("text/plain", d.labelOf(node)); } catch (e) {}
      row.classList.add("layer-dragging");
    });
    row.addEventListener("dragend", () => {
      arrastrado = null;
      list.querySelectorAll(".layer-row").forEach(r =>
        r.classList.remove("layer-dragging", "drop-antes", "drop-despues", "drop-dentro"));
    });

    row.addEventListener("dragover", ev => {
      if (!arrastrado || arrastrado === node) return;
      const contenedor = admiteHijos(node, esCapa);
      const zona = zonaDe(ev, row, contenedor);
      const parent = zona === "dentro" ? node : node.parent;
      if (!admite(d, arrastrado, parent)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      row.classList.remove("drop-antes", "drop-despues", "drop-dentro");
      row.classList.add("drop-" + zona);
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-antes", "drop-despues", "drop-dentro");
    });

    row.addEventListener("drop", ev => {
      ev.preventDefault();
      row.classList.remove("drop-antes", "drop-despues", "drop-dentro");
      const movido = arrastrado;
      arrastrado = null;
      if (!movido || movido === node) return;
      const contenedor = admiteHijos(node, esCapa);
      const zona = zonaDe(ev, row, contenedor);
      const parent = zona === "dentro" ? node : node.parent;
      if (!admite(d, movido, parent)) return;

      let indice;
      if (zona === "dentro") indice = childrenOf(node).length;      // encima de todo
      else {
        const at = indexOf(parent, node);
        indice = zona === "antes" ? at + 1 : at;                    // lista al revés
      }

      /* Cambiar de padre cambia el sistema de coordenadas: se recompone
         el transform o la figura saltaría de sitio. */
      const t = parent === movido.parent ? undefined : relocateTransform(getCanvas(), movido, parent);
      const copia = d.reparent(movido, parent, indice, t);
      if (!copia) { onStatus("Ahí no se puede soltar."); return; }
      const eraCapa = copia.getAttribute("data-layer") != null;
      if (eraCapa) setActiveId(copia.getAttribute("id"));
      abiertos.add(claveDe(parent));
      // una capa no se «selecciona» como figura: solo pasa a ser la activa
      onChange(eraCapa ? [] : [copia.getAttribute("id")].filter(Boolean));
      onStatus(`«${d.labelOf(copia)}» movido.`);
    });
  }

  /* ---------- botones de la cabecera ---------- */
  function add() {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const g = d.addLayer();
    if (g) { setActiveId(g.getAttribute("id")); abiertos.add(claveDe(g)); }
    onChange();
  }

  function move(dir) {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const L = d.activeLayer(getActiveId());
    const copy = d.moveLayer(L, dir);
    /* moveLayer clona y borra, así que el id sigue siendo el mismo pero
       el objeto no: se vuelve a fijar el activo por id. */
    if (copy) setActiveId(copy.getAttribute("id"));
    onChange();
  }

  function removeActive() {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const L = d.activeLayer(getActiveId());
    if (!L) return;
    if (d.layers().length <= 1) {
      onStatus("Un dibujo no puede quedarse sin capas.");
      return;
    }
    const nombre = d.labelOf(L);
    if (!confirm(`¿Eliminar la capa «${nombre}» y todo lo que contiene?`)) return;
    d.removeLayer(L);
    setActiveId(null);
    onChange();
  }

  /* Mueve la selección a la capa activa, que es como Inkscape reparte
     figuras entre capas (allí es «Capa → Mover a la capa…»). */
  function moveSelection() {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const sel = getSelection();
    if (!sel.length) { onStatus("Selecciona algo primero."); return; }
    const L = d.activeLayer(getActiveId());
    if (!L) return;
    const canvas = getCanvas();
    const fixups = new Map();
    for (const s of sel) {
      const t = relocateTransform(canvas, s, L);
      if (t !== undefined) fixups.set(s, t);
    }
    const moved = d.moveToLayer(sel, L, fixups);
    onChange(moved.map(m => m.getAttribute("id")));
    onStatus(moved.length ? `${moved.length} figura${moved.length === 1 ? "" : "s"} a «${d.labelOf(L)}».` : "");
  }

  return { render, reset, add, move, removeActive, moveSelection };
}
