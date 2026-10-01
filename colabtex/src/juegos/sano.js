"use strict";
/* Lo que llega de la base sobre otra persona — su color, su foto, su
   marco — se pinta dentro de HTML armado como texto (`style="--c:…"`,
   `<img src="…">`). Las reglas ya lo validan, pero las reglas se publican
   a mano y los datos viejos siguen ahí: un color `"><img onerror=…>`
   escrito antes de publicarlas sería código corriendo en la pestaña de
   todo el que mire la sala. Así que se limpia también al leer, en la capa
   de datos (fb-juegos.js), una vez, en vez de confiar en que cada uno de
   los cien sitios que pintan un color se acuerde de escaparlo.

   Puro: sin DOM ni Firebase, verificable desde Node. */

export const colorSano = c =>
  typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "";

/* Una URL https sin nada que pueda cerrar un atributo o un `url(...)`,
   o —solo si `datos`— una foto subida como data URL de imagen. */
export function fotoSana(f, datos) {
  if (typeof f !== "string" || !f) return "";
  if (/^https:\/\/[^\s"'<>()\\]+$/.test(f) && f.length <= 2000) return f;
  if (datos && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= 60000) return f;
  return "";
}

const idSano = x => (typeof x === "string" && /^[a-z]{1,20}$/.test(x) ? x : "");

/* Una ficha de jugador, una fila de clasificación o un perfil: arregla
   en su sitio los campos que se pintan sin escapar y devuelve el objeto.
   Un color inválido se borra (quien pinta cae a `colorDe(uid)`), no se
   reemplaza por uno fijo: así dos jugadores no salen del mismo tono. */
export function sanea(o, datos) {
  if (!o || typeof o !== "object") return o;
  if ("color" in o) { const c = colorSano(o.color); if (c) o.color = c; else delete o.color; }
  if ("foto" in o && o.foto !== null) o.foto = fotoSana(o.foto, datos);
  if ("marco" in o) { const m = idSano(o.marco); if (m) o.marco = m; else delete o.marco; }
  if ("fondo" in o) { const m = idSano(o.fondo); if (m) o.fondo = m; else delete o.fondo; }
  return o;
}

/* Una partida entera: cada ficha de `jugadores`. */
export function saneaPartida(p) {
  if (p && p.jugadores && typeof p.jugadores === "object")
    for (const j of Object.values(p.jugadores)) sanea(j, false);
  return p;
}
