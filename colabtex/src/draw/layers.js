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

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Lo que no se dibuja no sale en el árbol: definiciones, estilos y
   metadatos llenarían la lista de filas que no se pueden ni ver ni
   seleccionar. */
const OCULTOS = new Set([
  "defs", "style", "title", "desc", "metadata", "clipPath", "mask",
  "marker", "linearGradient", "radialGradient", "pattern", "symbol"
]);

const pintable = n => n && n.nodeName && !OCULTOS.has(n.nodeName);

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

export function createObjectPanel(host, ctx) {
  const {
    getDrawing, getActiveId, setActiveId, canWrite,
    getSelection, setSelection, getCanvas, onChange, onStatus = () => {}
  } = ctx;

  const list = el("div", "layer-list");
  host.appendChild(list);

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

  function fila(node, nivel, estado) {
    const { d, sel, activa, rw } = estado;
    const clave = claveDe(node);
    const hijos = elChildren(node).filter(pintable);
    const abierto = abiertos.has(clave);
    const esCapa = node.getAttribute("data-layer") != null;
    const elegido = sel.has(node);

    const row = el("div", "layer-row" +
      (esCapa && node === activa ? " layer-active" : "") +
      (elegido ? " layer-sel" : ""));
    row.style.paddingLeft = `${6 + nivel * 13}px`;
    if (elegido && !estado.primera) estado.primera = row;

    const exp = el("button", "layer-ico layer-exp", hijos.length ? (abierto ? "▾" : "▸") : "");
    exp.title = hijos.length ? (abierto ? "Plegar" : "Desplegar") : "";
    exp.disabled = !hijos.length;
    exp.onclick = ev => {
      ev.stopPropagation();
      if (abierto) abiertos.delete(clave); else abiertos.add(clave);
      render();
    };

    const visible = d.layerVisible(node);
    const eye = el("button", "layer-ico", visible ? "👁" : "🚫");
    eye.title = visible ? "Ocultar" : "Mostrar";
    eye.disabled = !rw;
    eye.onclick = ev => { ev.stopPropagation(); d.setLayerVisible(node, !visible); onChange(); };

    const bloq = d.layerLocked(node);
    const lock = el("button", "layer-ico", bloq ? "🔒" : "🔓");
    lock.title = bloq ? "Desbloquear" : "Bloquear";
    lock.disabled = !rw;
    lock.onclick = ev => { ev.stopPropagation(); d.setLayerLocked(node, !bloq); onChange(); };

    const name = el("span", "layer-name" + (esCapa ? " layer-name-capa" : ""));
    name.textContent = d.labelOf(node);
    name.title = `<${node.nodeName}> — doble clic para renombrar`;
    name.ondblclick = ev => {
      ev.stopPropagation();
      if (!rw) return;
      const v = prompt("Nombre:", name.textContent);
      if (v == null) return;
      d.setLabel(node, v);
      onChange();
    };

    row.append(exp, eye, lock, name);
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
    if (rw) arrastrable(row, node, esCapa, estado);
    list.appendChild(row);

    if (abierto) for (let i = hijos.length - 1; i >= 0; i--) fila(hijos[i], nivel + 1, estado);
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
    return parent.nodeName === "g" || parent.nodeName === "svg";
  }

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
      const contenedor = esCapa || node.nodeName === "g";
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
      const contenedor = esCapa || node.nodeName === "g";
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
