"use strict";
/* ============================================================
   ColabDraw — panel de capas

   Las capas ya existían en el modelo (`<g data-layer="…">` hijos del
   <svg>) pero no había forma de verlas ni de manejarlas, que es la
   mitad de cómo se trabaja en Inkscape.

   Se listan de arriba abajo como se ven en el dibujo: la última del
   documento se pinta encima, así que la lista va al revés que
   `drawing.layers()`.

   Lo que se dibuja va SIEMPRE a la capa activa. Esa es la razón de ser
   del panel, más que el ojo o el candado.
   ============================================================ */
import { matMul, matInvert, matToString, parseTransform } from "./geom.js";

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

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

export function createLayersPanel(host, ctx) {
  const {
    getDrawing, getActiveId, setActiveId, canWrite,
    getSelection, getCanvas, onChange, onStatus = () => {}
  } = ctx;

  const list = el("div", "layer-list");
  host.appendChild(list);

  function drawingOrNull() {
    const d = getDrawing();
    return d && d.root() ? d : null;
  }

  function render() {
    list.innerHTML = "";
    const d = drawingOrNull();
    if (!d) return;
    const layers = d.layers();
    const active = d.activeLayer(getActiveId());
    const rw = canWrite();

    // de arriba abajo tal y como se apilan en el dibujo
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const visible = d.layerVisible(L);
      const locked = d.layerLocked(L);
      const row = el("div", "layer-row" + (L === active ? " layer-active" : ""));

      const eye = el("button", "layer-ico", visible ? "👁" : "🚫");
      eye.title = visible ? "Ocultar la capa" : "Mostrar la capa";
      eye.disabled = !rw;
      eye.onclick = ev => { ev.stopPropagation(); d.setLayerVisible(L, !visible); onChange(); };

      const lock = el("button", "layer-ico", locked ? "🔒" : "🔓");
      lock.title = locked ? "Desbloquear la capa" : "Bloquear la capa";
      lock.disabled = !rw;
      lock.onclick = ev => { ev.stopPropagation(); d.setLayerLocked(L, !locked); onChange(); };

      const name = el("span", "layer-name");
      name.textContent = L.getAttribute("data-layer") || "Capa";
      name.title = "Doble clic para renombrar";
      name.ondblclick = ev => {
        ev.stopPropagation();
        if (!rw) return;
        const v = prompt("Nombre de la capa:", name.textContent);
        if (v == null) return;
        d.renameLayer(L, v);
        onChange();
      };

      row.appendChild(eye);
      row.appendChild(lock);
      row.appendChild(name);
      row.onclick = () => { setActiveId(L.getAttribute("id")); render(); };
      list.appendChild(row);
    }
  }

  /* ---------- botones de la cabecera ---------- */
  function add() {
    const d = drawingOrNull();
    if (!d || !canWrite()) return;
    const g = d.addLayer();
    if (g) setActiveId(g.getAttribute("id"));
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
    const nombre = L.getAttribute("data-layer") || "Capa";
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
    onStatus(moved.length ? `${moved.length} figura${moved.length === 1 ? "" : "s"} a «${L.getAttribute("data-layer")}».` : "");
  }

  return { render, add, move, removeActive, moveSelection };
}
