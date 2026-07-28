"use strict";
/* ============================================================
   ColabTeX — mover y renombrar archivos del proyecto

   La RUTA es la identidad de un archivo: el Y.Map «files» va de ruta
   a texto, y el índice de imágenes guarda la ruta como nombre. Por eso
   renombrar y arrastrar a otra carpeta son la misma operación —cambiar
   la ruta— y comparten todo el camino.

   Aquí vive solo la parte que no depende del estado ni de la nube, que
   es la que puede equivocarse en silencio: qué ruta resulta, si el
   movimiento es legal y qué referencias del .tex hay que reescribir.
   main.js se encarga de aplicarlo a Yjs, a Firebase o al disco.
   ============================================================ */

export const baseName = p => p.split("/").pop();
export const parentOf = p => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
export const joinPath = (folder, base) => (folder ? folder + "/" + base : base);

/* ¿`path` es la carpeta `folder` o algo que cuelga de ella? */
export function isInside(path, folder) {
  return path === folder || path.startsWith(folder + "/");
}

/* Ruta que le toca a `path` cuando la carpeta (o archivo) `oldRoot` pasa a
   llamarse `newRoot`. Para el propio oldRoot devuelve newRoot. */
export function movedPath(path, oldRoot, newRoot) {
  return path === oldRoot ? newRoot : newRoot + path.slice(oldRoot.length);
}

/* Motivo por el que el movimiento NO puede hacerse, o "" si puede.
   `taken(ruta)` responde si esa ruta ya está ocupada por un archivo, una
   imagen o una carpeta. El caso «no cambia nada» lo resuelve quien llama. */
export function moveProblem(oldPath, newPath, isFolder, taken) {
  if (!newPath) return "El nombre no puede quedar vacío.";
  if (baseName(newPath).startsWith(".")) return "El nombre no puede empezar por un punto.";
  /* Meter una carpeta dentro de sí misma dejaría los archivos en una ruta
     que ya no existe: es la única forma de perder datos arrastrando. */
  if (isFolder && isInside(newPath, oldPath))
    return `No se puede meter la carpeta «${oldPath}» dentro de sí misma.`;
  if (taken(newPath)) return `Ya existe «${newPath}» en el proyecto.`;
  return "";
}

/* ------------------------------------------------------------------
   Arrastrar y soltar en el árbol

   El módulo se queda con lo que se está arrastrando porque el
   DataTransfer del navegador solo se puede leer AL SOLTAR: durante el
   dragover está vacío por seguridad, y sin saber qué viaja no se podría
   decidir si esta carpeta es un destino válido ni pintarla.
   ------------------------------------------------------------------ */

/* ¿tiene sentido soltar `drag` en `folder`? No en la carpeta donde ya está
   (no cambiaría nada) ni dentro de sí misma (dejaría los archivos en una
   ruta que deja de existir: la única forma de perder datos arrastrando). */
export function canDropIn(drag, folder) {
  if (!drag) return false;
  if (parentOf(drag.path) === folder) return false;
  return !(drag.isFolder && isInside(folder, drag.path));
}

export function createTreeDnD(onMove) {
  let drag = null;

  const clearMarks = root => {
    if (!root) return;
    for (const el of root.querySelectorAll(".drag-over")) el.classList.remove("drag-over");
    root.classList.remove("drag-over-root");
  };

  /* Hace arrastrable una fila del árbol. */
  function draggable(div, path, isFolder, root) {
    div.draggable = true;
    div.ondragstart = e => {
      drag = { path, isFolder };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", path); } catch (err) { /* navegador quisquilloso */ }
      }
      div.classList.add("dragging");
    };
    div.ondragend = () => { drag = null; div.classList.remove("dragging"); clearMarks(root); };
  }

  /* Hace de `div` un destino: lo que se suelte encima acaba en `folder`. */
  function dropTarget(div, folder, isRoot) {
    const mark = isRoot ? "drag-over-root" : "drag-over";
    div.ondragover = e => {
      /* Se corta la propagación aunque se rechace el destino: si no, pasar
         por encima de un hermano acabaría contando como soltar en la raíz. */
      if (!isRoot) e.stopPropagation();
      if (!canDropIn(drag, folder)) return;
      e.preventDefault();                       // sin esto no hay «soltar»
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      div.classList.add(mark);
    };
    div.ondragleave = e => {
      // pasar a un hijo también dispara dragleave: ahí no se apaga la marca
      if (!div.contains(e.relatedTarget)) div.classList.remove(mark);
    };
    div.ondrop = e => {
      if (!isRoot) e.stopPropagation();
      div.classList.remove(mark);
      /* Solo se olvida lo que se arrastra si de verdad se suelta aquí; si no,
         el arrastre sigue vivo hasta el dragend, que siempre llega. */
      if (!canDropIn(drag, folder)) return;
      const d = drag;
      drag = null;
      e.preventDefault();
      onMove(d.path, joinPath(folder, baseName(d.path)), d.isFolder);
    };
  }

  /* Deja un elemento como estaba (al pasar a un proyecto de solo lectura). */
  function unwire(div) {
    div.draggable = false;
    div.ondragstart = div.ondragend = div.ondragover = div.ondragleave = div.ondrop = null;
  }

  return { draggable, dropTarget, unwire, dragging: () => drag };
}

/* ------------------------------------------------------------------
   Referencias dentro del LaTeX

   Comandos cuyo argumento es una ruta del proyecto. Se reescriben solo
   las coincidencias EXACTAS con la ruta vieja (con extensión o sin
   ella, porque \includegraphics y \input se suelen escribir sin), que
   es lo que genera el propio botón «Insertar» del árbol. No se intenta
   resolver rutas relativas al archivo que las escribe: adivinar ahí
   estropearía documentos que sí compilaban.
   ------------------------------------------------------------------ */
const REF_CMD = /\\(includegraphics|input|include|subfile|subfileinclude|lstinputlisting|verbatiminput|bibliography|addbibresource|usepackage|documentclass)\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g;

const noExt = p => p.replace(/\.[^./]+$/, "");

/* Devuelve {text, count} con las referencias a `from` apuntando ya a `to`. */
export function rewriteReferences(text, from, to) {
  const fromNoExt = noExt(from), toNoExt = noExt(to);
  let count = 0;
  const out = text.replace(REF_CMD, (m, cmd, opt, arg) => {
    let hit = false;
    // \bibliography{a,b} admite lista: se mira entrada por entrada
    const next = arg.split(",").map(part => {
      const t = part.trim();
      if (t === from) { hit = true; return part.replace(t, to); }
      if (t === fromNoExt) { hit = true; return part.replace(t, toNoExt); }
      return part;
    });
    if (!hit) return m;
    count++;
    return `\\${cmd}${opt || ""}{${next.join(",")}}`;
  });
  return { text: out, count };
}
