"use strict";
/* ============================================================
   ColabDraw — barras de desplazamiento del lienzo

   El encuadre vive en un `transform` del <g> de la escena, no en el
   scroll de una caja del navegador: por eso el lienzo no traía barras y
   sólo se podía mover con la rueda o con la barra espaciadora. Estas
   son barras de verdad —se arrastran, se pincha en el carril— pero
   pintadas a mano, porque lo que mueven es la matriz de la escena.

   Dos decisiones que las hacen usables:

   - **El recorrido no es sólo el papel**: es el papel MÁS todo lo
     dibujado (una figura importada puede caer fuera de la hoja y, si no
     se cuenta, es inalcanzable), más un margen de un cuarto de su
     tamaño para poder apartarlo del centro, y siempre unido a lo que se
     ve — sin eso, al alejarse el pulgar se saldría del carril.
   - **Se ocultan cuando no hacen falta**: si todo el recorrido cabe en
     pantalla, la barra sobra y sólo quita sitio.
   ============================================================ */

const MIN_THUMB = 24;      // px: por debajo, el pulgar no se puede agarrar

const div = cls => { const n = document.createElement("div"); n.className = cls; return n; };

const union = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x, y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y
  };
};

/* `host` es la caja del lienzo (.canvas-wrap): las barras van encima,
   posicionadas, no dentro del <svg>. */
export function createScrollbars(host, canvas, { onScroll = null } = {}) {
  const barH = div("dw-sb dw-sb-h");
  const thumbH = div("dw-sb-thumb");
  barH.appendChild(thumbH);
  const barV = div("dw-sb dw-sb-v");
  const thumbV = div("dw-sb-thumb");
  barV.appendChild(thumbV);
  host.append(barH, barV);

  /* Lo que se tiene que poder alcanzar, en milímetros. */
  function extent(vis) {
    let b = null;
    const page = canvas.pageBox();
    if (page && page.w > 0 && page.h > 0) b = page;
    b = union(b, canvas.contentBox());
    if (!b) return vis;
    /* Margen proporcional al DIBUJO, no a la pantalla: un cuarto de su
       tamaño (mínimo 1 cm) para poder apartarlo del centro. Medido en
       pantallas, alejarse hacía crecer el recorrido a la vez que la
       vista, así que las barras seguían ahí cuando ya cabía todo. */
    const mx = Math.max(b.w * 0.25, 10), my = Math.max(b.h * 0.25, 10);
    return union({ x: b.x - mx, y: b.y - my, w: b.w + mx * 2, h: b.h + my * 2 }, vis);
  }

  /* El carril se mide DESPUÉS de enseñarlo: una caja con display:none
     mide 0, y con eso el pulgar salía del tamaño mínimo y pegado al
     principio cada vez que la barra volvía de estar oculta. */
  function paint(bar, thumb, horiz, visIni, visLargo, extIni, extLargo) {
    if (!(extLargo > 0) || !(visLargo > 0) || visLargo >= extLargo - 1e-6) {
      bar.style.display = "none";
      return;
    }
    /* «block», no cadena vacía: vaciar el estilo en línea devuelve el
       mando a la hoja, donde .dw-sb nace con display:none — y así la
       barra no aparecía nunca. */
    bar.style.display = "block";
    const largo = horiz ? bar.clientWidth : bar.clientHeight;
    if (!largo) return;
    const t = Math.max(MIN_THUMB, largo * (visLargo / extLargo));
    // el pulgar tiene ancho, así que recorre `largo - t`, no `largo`
    const frac = (visIni - extIni) / (extLargo - visLargo);
    const pos = Math.max(0, Math.min(1, frac)) * (largo - t);
    if (horiz) { thumb.style.left = pos + "px"; thumb.style.width = t + "px"; }
    else { thumb.style.top = pos + "px"; thumb.style.height = t + "px"; }
  }

  function refresh() {
    if (!canvas.drawing) { barH.style.display = "none"; barV.style.display = "none"; return; }
    const vis = canvas.visibleBox();
    const ext = extent(vis);
    paint(barH, thumbH, true, vis.x, vis.w, ext.x, ext.w);
    paint(barV, thumbV, false, vis.y, vis.h, ext.y, ext.h);
  }

  /* Arrastrar el pulgar: los píxeles recorridos se convierten a
     milímetros con la razón del carril, no con el zoom — así el
     recorrido completo del pulgar es el recorrido completo del dibujo. */
  function dragThumb(bar, thumb, eje) {
    thumb.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      const horiz = eje === "x";
      const vis0 = canvas.visibleBox();
      const ext = extent(vis0);
      const largo = horiz ? bar.clientWidth : bar.clientHeight;
      const t = horiz ? thumb.offsetWidth : thumb.offsetHeight;
      const libre = Math.max(1, largo - t);
      const visL = horiz ? vis0.w : vis0.h;
      const extL = horiz ? ext.w : ext.h;
      const ini0 = horiz ? vis0.x : vis0.y;
      const start = horiz ? e.clientX : e.clientY;
      thumb.classList.add("dw-sb-on");

      const extIni = horiz ? ext.x : ext.y;
      const tope = extIni + extL - visL;      // más allá no hay nada que ver
      const move = ev => {
        const d = (horiz ? ev.clientX : ev.clientY) - start;
        const mm = (d / libre) * (extL - visL);
        // el puntero puede irse lejos; el recorrido del pulgar no
        const dest = Math.max(extIni, Math.min(ini0 + mm, tope));
        if (horiz) canvas.scrollTo(dest, null); else canvas.scrollTo(null, dest);
        if (onScroll) onScroll();
      };
      const up = () => {
        thumb.releasePointerCapture(e.pointerId);
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", up);
        thumb.classList.remove("dw-sb-on");
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", up);
    });
  }

  /* Pinchar en el carril: una pantalla (90 %) hacia ese lado, como
     cualquier barra del sistema. */
  function pageJump(bar, eje) {
    bar.addEventListener("pointerdown", e => {
      if (e.target !== bar) return;
      e.preventDefault();
      const horiz = eje === "x";
      const vis = canvas.visibleBox();
      const r = bar.getBoundingClientRect();
      const pos = horiz ? e.clientX - r.left : e.clientY - r.top;
      const thumb = horiz ? thumbH : thumbV;
      const ini = horiz ? thumb.offsetLeft : thumb.offsetTop;
      const largo = horiz ? thumb.offsetWidth : thumb.offsetHeight;
      const signo = pos < ini ? -1 : (pos > ini + largo ? 1 : 0);
      if (!signo) return;
      const salto = signo * 0.9 * (horiz ? vis.w : vis.h);
      if (horiz) canvas.scrollTo(vis.x + salto, null);
      else canvas.scrollTo(null, vis.y + salto);
      if (onScroll) onScroll();
    });
  }

  dragThumb(barH, thumbH, "x");
  dragThumb(barV, thumbV, "y");
  pageJump(barH, "x");
  pageJump(barV, "y");

  const onResize = () => refresh();
  window.addEventListener("resize", onResize);

  refresh();
  return {
    refresh,
    destroy() {
      window.removeEventListener("resize", onResize);
      barH.remove(); barV.remove();
    }
  };
}
