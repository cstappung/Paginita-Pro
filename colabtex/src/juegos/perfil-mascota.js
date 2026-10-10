/* La mascota del perfil (de Mascotas), en la mini tarjeta, en la página
   del perfil y en el editor.

   `users/<uid>/perfil/mascota` = {m: copia `ma:…`, b?: baile `ob:…` o
   `start-dance-<id>`}. Al pintar se re-chequea contra la economía
   (`mascotaVisible`): si esa cuenta ya no es dueña de la mascota, o la puso
   a la venta, no sale; un baile que ya no tiene, tampoco. La etapa, el
   nombre y lo que lleva puesto salen de su estado guardado
   (`mascotasEstado/<dueño>/<clave>`, leído por clave). Lo leído se usa al
   tiro y, si tiene más de `FRESCO_MS`, se vuelve a leer por detrás: así un
   cambio de ropa llega sin recargar y sin escuchar el nodo. Lo que guarda
   el propio juego en esta pestaña entra directo (`pon`).
   Solo los adultos bailan, y en bucle.

   Lo 3D lo dibuja el visor (visor-mascota.js), en una capa que **no** se
   repinta con la tarjeta: la tarjeta rehace su innerHTML cada vez que llegan
   datos, y un iframe que sale del documento se recarga. */
import { economia } from "./monedas.js";
import { mascotaVisible, fichaMascota, pedidoMascota, puestoDe, opcionesMascotaPerfil } from "./mascotas-datos.js";
import { montaVisor, fotoDe, pideFotos } from "./visor-mascota.js";

const FRESCO_MS = 120000;
const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* `lee(uid, k)` → Promise del estado guardado (fb.leeEstadoMascota). */
export function crearMascotasPerfil(lee) {
  const estados = new Map(), esperan = new Map();   // id -> {v, t}

  /* El estado de una mascota: el objeto (o null si no tiene), o undefined
     mientras se lee la primera vez. `cb` se llama cuando llegue, y también
     cuando una relectura traiga algo distinto. */
  function estado(uid, k, cb) {
    const id = uid + "/" + k, ya = estados.get(id);
    if (ya && Date.now() - ya.t < FRESCO_MS) return ya.v;
    const nueva = !esperan.has(id);
    if (nueva) esperan.set(id, new Set());
    if (cb) esperan.get(id).add(cb);
    if (nueva) Promise.resolve().then(() => lee(uid, k)).catch(() => undefined).then(x => {
      const l = esperan.get(id) || [];
      esperan.delete(id);
      /* Sin red, lo viejo sigue valiendo (se reintenta en la próxima pintada). */
      if (x === undefined && ya) return;
      const v = x || null, cambio = !ya || JSON.stringify(ya.v) !== JSON.stringify(v);
      estados.set(id, { v, t: Date.now() });
      if (cambio) for (const f of l) try { f(); } catch (e) { console.warn("[perfil]", e); }
    });
    return ya ? ya.v : undefined;
  }

  /* Cómo se ve una mascota de `uid`: {c, nombre, sub, emoji, pedido}, o
     undefined mientras llega su estado. */
  function vista(uid, c, m, baile, d, cb) {
    const est = estado(uid, c.slice(3), cb);
    if (est === undefined) return undefined;
    const f = fichaMascota(m.e, est && est.e), adulta = f.etapaId === "adult";
    return {
      c, nombre: (est && est.n) || f.especie, emoji: f.emoji, adulta,
      sub: `${f.especie} · ${adulta ? "adulto" : f.etapa.toLowerCase()}`,
      pedido: pedidoMascota(c, m, est, puestoDe(est, uid, economia(d)), adulta ? baile : null)
    };
  }

  return {
    estado, vista,
    /* La del perfil de `uid`, re-chequeada: null si no hay ninguna que mostrar. */
    deUid(uid, perfil, d, cb) {
      const v = mascotaVisible(uid, perfil, d);
      return v ? vista(uid, v.c, v.m, v.baile, d, cb) : null;
    },
    opciones: (uid, d) => opcionesMascotaPerfil(uid, d),
    /* Lo que el juego acaba de guardar en esta pestaña (null: se despidió). */
    pon(uid, k, v) { estados.set(uid + "/" + k, { v: v || null, t: Date.now() }); }
  };
}

/* La capa en vivo sobre una tarjeta o el hero del perfil. `pon(v)` con lo
   que devuelve `vista`/`deUid` (o null para quitarla). Se monta una sola
   vez por tarjeta y sobrevive a sus repintados; `cierra()` la libera. */
export function capaMascota(caja, clase) {
  const cerca = /en-mini/.test(clase || "") ? 2 : 1;
  const el = document.createElement("div");
  el.className = "jg-masc " + (clase || "");
  el.hidden = true;
  el.innerHTML = `<div class="jg-masc-vis"></div><span class="jg-masc-n" translate="no"></span>`;
  caja.appendChild(el);
  const vis = el.querySelector(".jg-masc-vis"), nom = el.querySelector(".jg-masc-n");
  let visor = null, clave = "";
  const foto = v => {
    const f = fotoDe(v.pedido.key);
    vis.style.backgroundImage = f && f.src ? `url("${f.src}")` : "";
    vis.setAttribute("data-emoji", f && f.src ? "" : v.emoji);
  };
  return {
    el,
    pon(v) {
      if (!v) {
        el.hidden = true; clave = "";
        if (visor) { visor.cierra(); visor = null; }
        return;
      }
      el.hidden = false;
      nom.textContent = v.nombre;
      el.title = `${v.nombre} · ${v.sub}`;
      if (v.pedido.key === clave) return;
      clave = v.pedido.key;
      foto(v);
      /* La foto quieta mientras carga el visor (o si no hay WebGL). */
      if (!fotoDe(v.pedido.key)) pideFotos([v.pedido], () => { if (clave === v.pedido.key) foto(v); });
      const vivo = Object.assign({ cerca }, v.pedido);
      if (visor) visor.cambia(vivo);
      else visor = montaVisor(vis, vivo);
    },
    /* Cuando la tarjeta se rehace entera y la capa tiene que ir a otro sitio. */
    mueve(destino) { if (el.parentNode !== destino) destino.appendChild(el); },
    cierra() { if (visor) { visor.cierra(); visor = null; } el.remove(); }
  };
}

/* La ficha de una mascota en el editor (una opción para elegir). */
export function opcionMascotaHtml(v, on) {
  const f = v && fotoDe(v.pedido.key);
  return `<button type="button" class="jg-ped-op jg-ped-masc${on ? " on" : ""}" data-masc="${esc(v.c)}">
    <span class="jg-ped-masc-f"${f && f.src ? ` style="background-image:url('${esc(f.src)}')"` : ""}>${f && f.src ? "" : esc(v.emoji)}</span>
    <b translate="no">${esc(v.nombre)}</b><small>${esc(v.sub)}</small></button>`;
}
