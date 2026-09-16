/* Perfil — el apodo, la foto y el color de cada quien.
 *
 * Tres decisiones que explican por qué esto es un archivo y no cuatro
 * campos más en la ficha de la partida:
 *
 * 1. **El perfil vive en `users/<uid>/perfil`, no en la partida.** La
 *    ficha (`partidas/<pid>/jugadores/<uid>`) se escribe una sola vez
 *    al entrar y las reglas no dejan reescribirla — a propósito, para
 *    que nadie se cambie el nombre a mitad de duelo. Guardar ahí el
 *    perfil habría significado que cambiar de apodo solo vale para las
 *    partidas siguientes. Así la ficha sigue congelada y el perfil vivo
 *    se superpone encima al pintar.
 * 2. **La foto se reduce aquí, en el navegador, antes de subir nada.**
 *    Una foto de móvil son tres megas, y esto no tiene Storage detrás:
 *    va como texto dentro de la base de datos, que es donde de verdad
 *    duele. `recorta` la deja en 96×96 recortada al centro y en JPEG,
 *    unos 10 kB — bastante para un círculo de 28 píxeles, y aún sobra
 *    para el de 44 de la clasificación.
 * 3. **Lo vacío y lo ausente no son lo mismo.** `nick: ""` y `foto`
 *    sin poner significan «usa lo de Google»; `foto: ""` significa
 *    «no quiero foto, pon la inicial». Sin esa distinción, quitarse la
 *    foto era imposible: al guardar volvía la de Google.
 */

/* Los mismos tonos que reparte `colorForUid`, más unos cuantos, para
   que un color elegido no desentone con los repartidos. */
export const COLORES = [
  "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c",
  "#ca8a04", "#65a30d", "#059669", "#0891b2", "#4f46e5", "#9333ea",
  "#be123c", "#b45309", "#475569", "#1e293b"
];

export const LARGO_NICK = 24;
const LADO_FOTO = 96;

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo que se pinta de alguien = su ficha con su perfil encima. Se usa
   en los cuatro juegos, en la cabecera y en la clasificación, y es la
   única función que hay que llamar para que un cambio de apodo se vea
   en todas partes a la vez. */
export function mezcla(ficha, perfil) {
  if (!perfil) return ficha;
  const r = Object.assign({}, ficha || {});
  if (perfil.nick) r.nombre = perfil.nick;
  if (perfil.foto !== undefined && perfil.foto !== null) r.foto = perfil.foto;
  if (perfil.color) r.color = perfil.color;
  return r;
}

/* Recorta al centro y reduce. El recorte «cover» es el que espera
   cualquiera que haya puesto una foto en cualquier sitio: la cara
   llena el círculo en vez de quedar con franjas a los lados. */
export function recorta(file) {
  return new Promise((ok, mal) => {
    if (!file || !/^image\//.test(file.type || "")) {
      mal(new Error("Eso no es una imagen."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const lienzo = document.createElement("canvas");
        lienzo.width = lienzo.height = LADO_FOTO;
        const g = lienzo.getContext("2d");
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - lado) / 2, sy = (img.naturalHeight - lado) / 2;
        g.drawImage(img, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
        ok(lienzo.toDataURL("image/jpeg", 0.82));
      } catch (e) { mal(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

function avatar(foto, nombre, color) {
  return foto
    ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer">`
    : `<i style="background:${esc(color || "#0d9488")}">${esc((nombre || "?").charAt(0).toUpperCase())}</i>`;
}

/* El editor. `base` es lo que dice Google (el nombre y la foto de la
   cuenta), `perfil` lo que hay guardado, y `onGuardar` recibe el
   objeto que hay que escribir. Devuelve una función para cerrarlo. */
export function abrePerfil({ base, perfil, onGuardar }) {
  const vieja = document.getElementById("jgPerfil");
  if (vieja) vieja.remove();

  const p = perfil || {};
  /* `foto` puede ser tres cosas y hay que conservar cuál: sin poner
     (la de Google), una cadena vacía (ninguna) o una data URL. */
  let foto = p.foto === undefined || p.foto === null ? null : p.foto;
  let color = p.color || (base && base.color) || COLORES[0];
  let nick = p.nick || "";

  const capa = document.createElement("div");
  capa.id = "jgPerfil";
  capa.className = "jg-modal-capa";
  capa.innerHTML = `
    <div class="jg-modal jg-perfil">
      <button class="jg-fin-x" title="Cerrar">✕</button>
      <div class="jg-modal-t">Tu perfil</div>
      <p class="jg-modal-s">Así te ven los demás en las salas, en el tablero y en la
        clasificación. Se guarda en tu cuenta, no en cada partida, así que al cambiarlo
        cambia también en las partidas de ayer.</p>

      <div class="jg-perfil-cuerpo">
        <div class="jg-perfil-foto">
          <div class="jg-perfil-av" id="pfAv"></div>
          <button class="btn2" id="pfSubir">Cambiar foto</button>
          <button class="btn-ghost" id="pfGoogle">Usar la de Google</button>
          <button class="btn-ghost" id="pfQuitar">Quitar la foto</button>
          <input type="file" id="pfArchivo" accept="image/*" hidden>
        </div>
        <div class="jg-perfil-campos">
          <label class="jg-campo">
            <span>Apodo</span>
            <input type="text" id="pfNick" maxlength="${LARGO_NICK}" placeholder="${esc((base && base.nombre) || "Tu nombre")}">
          </label>
          <div class="jg-campo">
            <span>Color</span>
            <div class="jg-colores" id="pfColores"></div>
            <label class="jg-color-libre">
              <input type="color" id="pfColor"> otro color
            </label>
          </div>
        </div>
      </div>

      <div class="jg-modal-err" id="pfErr"></div>
      <div class="jg-fin-btns">
        <button class="btn" id="pfGuardar">Guardar</button>
        <button class="btn2" id="pfCancelar">Cancelar</button>
      </div>
    </div>`;

  const $ = s => capa.querySelector(s);
  const cierra = () => capa.remove();

  function pinta() {
    const nom = nick || (base && base.nombre) || "?";
    const f = foto === null ? (base && base.foto) || "" : foto;
    $("#pfAv").innerHTML = avatar(f, nom, color);
    $("#pfColores").innerHTML = COLORES.map(c =>
      `<button class="jg-color${c.toLowerCase() === color.toLowerCase() ? " on" : ""}"
         data-color="${c}" style="background:${c}" title="${c}"></button>`).join("");
    $("#pfColor").value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#0d9488";
    $("#pfGoogle").style.display = (base && base.foto) ? "" : "none";
    $("#pfQuitar").style.display = (foto === "" ) ? "none" : "";
  }

  function falla(t) { $("#pfErr").textContent = t || ""; }

  $("#pfNick").value = nick;
  $("#pfNick").oninput = e => { nick = e.target.value.slice(0, LARGO_NICK); pinta(); };
  $("#pfColores").onclick = e => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    color = b.getAttribute("data-color"); pinta();
  };
  $("#pfColor").oninput = e => { color = e.target.value; pinta(); };
  $("#pfSubir").onclick = () => $("#pfArchivo").click();
  $("#pfGoogle").onclick = () => { foto = null; falla(""); pinta(); };
  $("#pfQuitar").onclick = () => { foto = ""; falla(""); pinta(); };
  $("#pfArchivo").onchange = async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    falla("");
    try { foto = await recorta(f); pinta(); }
    catch (err) { falla(err && err.message ? err.message : String(err)); }
  };

  $(".jg-fin-x").onclick = cierra;
  $("#pfCancelar").onclick = cierra;
  capa.onclick = e => { if (e.target === capa) cierra(); };

  $("#pfGuardar").onclick = async e => {
    const b = e.currentTarget;
    b.disabled = true; falla("");
    const salida = { nick: nick.trim().slice(0, LARGO_NICK), color };
    if (foto !== null) salida.foto = foto;
    try { await onGuardar(salida); cierra(); }
    catch (err) {
      b.disabled = false;
      falla(err && (err.code || err.message) ? String(err.code || err.message) : String(err));
    }
  };

  pinta();
  document.body.appendChild(capa);
  setTimeout(() => { try { $("#pfNick").focus(); } catch (e) {} }, 30);
  return cierra;
}
