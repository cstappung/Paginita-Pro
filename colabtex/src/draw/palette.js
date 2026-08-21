"use strict";
/* ============================================================
   ColabDraw — la paleta guardada del proyecto

   Un degradado son ocho decisiones (tipo, ángulo o centro, y una lista
   de paradas con su color y su posición). Volver a componerlo figura por
   figura es lo que hacía que la gente acabara copiando y pegando una
   figura entera solo para heredarle el relleno. Aquí se guarda la FICHA
   —la misma de paint.js— y se vuelve a aplicar de un clic.

   Tres decisiones:

   - **La paleta es del PROYECTO, no del navegador.** Vive en el mismo
     Y.Doc que los dibujos (`Y.Array "paleta"`), así que se sincroniza
     con el equipo, viaja con el proyecto y entra en el historial de
     deshacer sin código nuevo. En `localStorage` se habría quedado en un
     ordenador, que es justo donde no sirve cuando el trabajo es de
     cuatro personas. Al ir dentro del documento, tampoco hace falta
     tocar `database.rules.json`: las reglas ya gobiernan quién escribe
     en el documento.
   - **Se guarda la ficha, no el `url(#…)`.** Una referencia al <defs> de
     un dibujo no significa nada en otro, y el recolector de
     definiciones sin usar (`gcDefs`) se llevaría por delante el
     degradado guardado en cuanto nadie lo estuviera usando. De la ficha
     se vuelve a crear la definición donde haga falta, que es lo que ya
     hace `paintValue`.
   - **No se guarda dos veces lo mismo.** Repetir el mismo color es la
     forma más rápida de que la paleta deje de servir para nada; al
     intentarlo se devuelve el que ya estaba.
   ============================================================ */

import { normStops, esGrad, etiquetaPaint } from "./paint.js";
import { newId } from "./doc.js";

/* Un tope generoso: la paleta es para los colores del artículo, no un
   archivo de todo lo que se ha probado. */
export const MAX_PALETA = 60;

const hex = v => String(v || "").trim();

/* La ficha, limpia y con solo lo que hace falta para volver a pintarla.
   Guardar el objeto tal cual metería en el documento lo que traiga
   pegado quien la construyó. */
export function normPaint(spec) {
  if (!spec || spec.tipo === "none") return null;   // «sin color» no es un color que guardar
  if (spec.tipo === "solid") {
    const c = hex(spec.color);
    return c && c !== "none" ? { tipo: "solid", color: c } : null;
  }
  if (!esGrad(spec)) return null;
  const stops = normStops(spec.stops).map(s => ({ c: hex(s.c), o: Math.round(s.o * 100) / 100 }));
  return spec.tipo === "radial"
    ? { tipo: "radial", cx: Math.round(spec.cx * 100) / 100, cy: Math.round(spec.cy * 100) / 100, stops }
    : { tipo: "linear", ang: Math.round(spec.ang || 0), stops };
}

/* ¿Son la misma pintura? Se comparan las fichas normalizadas, que es lo
   que hace que «#FFF» guardado dos veces no ocupe dos huecos. */
export function mismaPaint(a, b) {
  const x = normPaint(a), y = normPaint(b);
  if (!x || !y) return false;
  return JSON.stringify(x).toLowerCase() === JSON.stringify(y).toLowerCase();
}

export const nombrePorDefecto = spec => etiquetaPaint(spec);

export class DrawPalette {
  constructor(ydoc, { readOnly = false } = {}) {
    this.ydoc = ydoc;
    this.readOnly = readOnly;
    this.arr = ydoc.getArray("paleta");
  }

  list() {
    return this.arr.toArray()
      .filter(e => e && normPaint(e.spec))
      .map(e => ({ id: String(e.id || ""), nombre: String(e.nombre || ""), spec: e.spec }));
  }

  /* Devuelve la entrada, sea la nueva o la que ya estaba con ese mismo
     color: quien llama quiere señalarla, no saber si hubo suerte. */
  add(spec, nombre) {
    const limpio = normPaint(spec);
    if (!limpio || this.readOnly) return null;
    const ya = this.list().find(e => mismaPaint(e.spec, limpio));
    if (ya) return ya;
    if (this.arr.length >= MAX_PALETA) return null;
    const entrada = {
      id: newId("pal"),
      nombre: String(nombre || nombrePorDefecto(limpio)).slice(0, 40),
      spec: limpio
    };
    this.arr.push([entrada]);
    return entrada;
  }

  remove(id) {
    if (this.readOnly || !id) return false;
    const i = this.arr.toArray().findIndex(e => e && e.id === id);
    if (i < 0) return false;
    this.arr.delete(i, 1);
    return true;
  }

  /* Devuelve la función para dejar de escuchar: la paleta vive tanto como
     el proyecto abierto, y al cambiar de proyecto hay un Y.Doc nuevo. */
  observe(fn) {
    const h = () => fn(this.list());
    this.arr.observe(h);
    return () => this.arr.unobserve(h);
  }
}
