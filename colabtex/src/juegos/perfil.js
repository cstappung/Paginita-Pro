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
 *    duele. `recorta` la deja en 160×160 recortada al centro y en JPEG,
 *    unos 15 kB — lo justo para el retrato de 116 píxeles de la página
 *    del perfil en una pantalla de alta densidad.
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

import { MARCOS, FONDOS, LARGO_BIO, MAX_VITRINA, requisito, marcoDe, fondoDe, opcionesVitrina, limpiaPerfil } from "./perfil-tarjeta.js";
import { avatarMarco, tarjetaHtml, capaFondo } from "./perfil-vista.js";
import { PRECIO_TIENDA } from "./tienda.js";
import { capaMascota, opcionMascotaHtml } from "./perfil-mascota.js";
import { fotoDe, pideFotos } from "./visor-mascota.js";

export const LARGO_NICK = 24;
const LADO_FOTO = 160;

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
  if (perfil.marco) r.marco = perfil.marco;
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
   cuenta), `perfil` lo que hay guardado, `est` las estadísticas del dueño
   (para saber qué marcos y fondos tiene ganados y qué puede exhibir) y
   `onGuardar` recibe el objeto que hay que escribir. Cuatro pestañas —
   datos, marco, fondo y vitrina— y a un lado la tarjeta tal como la verán
   los demás, que se repinta con cada cambio. Devuelve una función para
   cerrarlo.
   La tienda vive aquí mismo: un marco o fondo de la tienda sin comprar se
   toca para comprarlo (`onComprar(id)`, que escribe la compra), y `saldo()`
   dice cuánto hay (null mientras la economía no ha llegado entera).
   `mascota` = {opciones: {mascotas, bailes} | null, vista(c, b, cb)}: lo que
   se puede elegir de Mascotas y cómo se ve (perfil-mascota.js). Sin
   opciones (la economía no llegó) la elegida se guarda tal como estaba. */
export function abrePerfil({ base, perfil, est, uid, colorDe, pestana, onGuardar, onComprar, saldo, mascota: mp }) {
  const vieja = document.getElementById("jgPerfil");
  if (vieja) vieja.remove();

  const p = perfil || {};
  /* `foto` puede ser tres cosas y hay que conservar cuál: sin poner
     (la de Google), una cadena vacía (ninguna) o una data URL. */
  let foto = p.foto === undefined || p.foto === null ? null : p.foto;
  let color = p.color || (base && base.color) || COLORES[0];
  let nick = p.nick || "";
  let bio = p.bio || "";
  let marco = marcoDe(p.marco) ? p.marco : "anillo";
  let fondo = fondoDe(p.fondo) ? p.fondo : "color";
  const guardada = Array.isArray(p.vitrina) ? p.vitrina : p.vitrina && typeof p.vitrina === "object" ? Object.values(p.vitrina) : [];
  let vitrina = guardada.slice(0, MAX_VITRINA);
  const opM = mp && mp.opciones;
  let mascota = p.mascota && typeof p.mascota.m === "string" ? { m: p.mascota.m, b: p.mascota.b || "" } : null;
  /* Lo que ya no es suyo (la vendió, o vendió el baile) no se ofrece. */
  if (opM && mascota && !opM.mascotas.some(x => x.c === mascota.m)) mascota = null;
  if (opM && mascota && mascota.b && !opM.bailes.some(x => x.b === mascota.b)) mascota.b = "";
  let tab = ["datos", "marco", "fondo", "vitrina", "mascota"].includes(pestana) ? pestana : "datos";
  let comprando = false;
  const miles = n => Math.round(n).toLocaleString("es-CL");

  const capa = document.createElement("div");
  capa.id = "jgPerfil";
  capa.className = "jg-modal-capa";
  capa.innerHTML = `
    <div class="jg-modal jg-perfil jg-perfil-ed" role="dialog" aria-label="Personaliza tu perfil">
      <button class="jg-fin-x" title="Cerrar">✕</button>
      <div class="jg-modal-t">Personaliza tu perfil</div>
      <p class="jg-modal-s">Así te ven los demás al tocar tu foto. Se guarda en tu cuenta, así
        que cambia también en las partidas de ayer.</p>
      <div class="jg-ped">
        <aside class="jg-ped-prev"><small>Vista previa</small><div class="jg-mini jg-mini-quieta" id="pfPrev"><div id="pfPrevC"></div></div></aside>
        <div class="jg-ped-main">
          <div class="jg-ped-tabs" role="tablist">
            ${[["datos", "Datos"], ["marco", "Marco"], ["fondo", "Fondo"], ["vitrina", "Vitrina"], ["mascota", "Mascota"]].map(([k, t]) =>
              `<button role="tab" data-tab="${k}">${t}</button>`).join("")}
          </div>
          <div class="jg-ped-panel" data-panel="datos">
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
                <label class="jg-campo">
                  <span>Sobre ti <small id="pfBioN"></small></span>
                  <textarea id="pfBio" maxlength="${LARGO_BIO}" rows="2" placeholder="Una frase: tu juego favorito, tu grito de guerra…"></textarea>
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
          </div>
          <div class="jg-ped-panel" data-panel="marco"><div class="jg-ped-rejilla" id="pfMarcos"></div></div>
          <div class="jg-ped-panel" data-panel="fondo"><div class="jg-ped-rejilla fondos" id="pfFondos"></div></div>
          <div class="jg-ped-panel" data-panel="vitrina">
            <p class="jg-ped-nota" id="pfVitNota"></p>
            <div class="jg-ped-vit" id="pfVit"></div>
          </div>
          <div class="jg-ped-panel" data-panel="mascota">
            <p class="jg-ped-nota" id="pfMascNota"></p>
            <div class="jg-ped-rejilla" id="pfMascotas"></div>
            <h4 class="jg-ped-grupo">Baile · solo bailan los adultos</h4>
            <div class="jg-ped-bailes" id="pfBailes"></div>
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
  const prevMasc = mp ? capaMascota($("#pfPrev"), "en-mini") : null;
  let cerrado = false;
  const cierra = () => { cerrado = true; if (prevMasc) prevMasc.cierra(); capa.remove(); };
  const borrador = () => Object.assign({ nick, color, bio, marco, fondo, vitrina }, foto !== null ? { foto } : {});
  const ops = opcionesVitrina(est);
  const repinta = () => { if (!cerrado) pinta(); };
  /* La vista de la mascota elegida (undefined mientras llega su estado). */
  const vistaElegida = () => mascota && mp ? mp.vista(mascota.m, mascota.b, repinta) : null;

  function pintaPrevia() {
    $("#pfPrevC").innerHTML = tarjetaHtml({ uid, p: borrador(), est, pista: base, colorDe, yo: uid, editor: true });
    if (prevMasc) {
      const v = vistaElegida() || null;
      $("#pfPrev").classList.toggle("con-mascota", !!v);
      prevMasc.pon(v);
    }
  }

  function pintaMascota() {
    if (!mp) return;
    const nota = $("#pfMascNota");
    if (!opM) {
      nota.textContent = "Cargando tus mascotas…";
      $("#pfMascotas").innerHTML = $("#pfBailes").innerHTML = "";
      return;
    }
    if (!opM.mascotas.length) {
      nota.innerHTML = `Todavía no tienes mascotas. Adopta la primera (gratis) en <a href="#mascotas" data-ir-mascotas>🐣 Mascotas</a>.`;
      $("#pfMascotas").innerHTML = $("#pfBailes").innerHTML = "";
      return;
    }
    nota.textContent = "Sale en tu tarjeta y en tu perfil, en 3D. Las que están a la venta no se pueden elegir.";
    const vistas = opM.mascotas.map(x => mp.vista(x.c, "", repinta)).filter(Boolean);
    pideFotos(vistas.map(v => v.pedido).filter(q => !fotoDe(q.key)), repinta);
    $("#pfMascotas").innerHTML = `<button type="button" class="jg-ped-op jg-ped-masc${mascota ? "" : " on"}" data-masc=""><span class="jg-ped-masc-f">—</span><b>Ninguna</b><small>sin mascota</small></button>` +
      opM.mascotas.map(x => {
        const v = mp.vista(x.c, "", repinta);
        return v ? opcionMascotaHtml(v, mascota && mascota.m === x.c)
          : `<button type="button" class="jg-ped-op jg-ped-masc${mascota && mascota.m === x.c ? " on" : ""}" data-masc="${esc(x.c)}"><span class="jg-ped-masc-f">…</span><b>…</b><small>cargando</small></button>`;
      }).join("");
    const b = mascota ? mascota.b : "";
    $("#pfBailes").innerHTML = [`<button type="button" class="jg-ped-baile${b ? "" : " on"}" data-baile=""${mascota ? "" : " disabled"}>Sin baile</button>`,
      ...opM.bailes.map(x => `<button type="button" class="jg-ped-baile${b === x.b ? " on" : ""}${x.leg ? " leg" : ""}" data-baile="${esc(x.b)}"${mascota ? "" : " disabled"}>${esc(x.ficha.emoji)} ${esc(x.ficha.nombre)}${x.leg ? " ★" : ""}</button>`)].join("");
  }

  function pinta() {
    const nom = nick || (base && base.nombre) || "?";
    const f = foto === null ? (base && base.foto) || "" : foto;
    for (const b of capa.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === tab));
    for (const d of capa.querySelectorAll("[data-panel]")) d.hidden = d.getAttribute("data-panel") !== tab;
    $("#pfAv").innerHTML = avatar(f, nom, color);
    $("#pfColores").innerHTML = COLORES.map(c =>
      `<button class="jg-color${c.toLowerCase() === color.toLowerCase() ? " on" : ""}"
         data-color="${c}" style="background:${c}" title="${c}"></button>`).join("");
    $("#pfColor").value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#0d9488";
    $("#pfGoogle").style.display = (base && base.foto) ? "" : "none";
    $("#pfQuitar").style.display = (foto === "" ) ? "none" : "";
    $("#pfBioN").textContent = `${bio.length}/${LARGO_BIO}`;
    /* Tres grupos: los de siempre, la tienda y los de campeón (los que
       ya tienes, primero). Un cerrado de la tienda no es un candado: es
       un botón de compra. */
    const op = (it, actual, attr, dentro) => {
      const r = requisito(it, est), venta = !r.ok && r.tienda;
      return `<button class="jg-ped-op${attr === "fondo" ? " fondo" : ""}${it.id === actual ? " on" : ""}${r.ok ? "" : " cerrado"}${venta ? " venta" : ""}" data-${attr}="${it.id}" ${r.ok || venta ? "" : "aria-disabled=\"true\""} title="${esc(r.ok ? it.n : venta ? `Comprar «${it.n}» por ${miles(PRECIO_TIENDA)} monedas` : "Se gana: " + r.falta)}">
        ${dentro}<b>${esc(it.n)}</b>${r.ok ? (it.req && it.req.tienda ? `<small class="jg-ped-tuyo">✓ Comprado</small>` : "") : venta ? `<small class="jg-ped-precio">🪙 ${miles(PRECIO_TIENDA)} · tocar para comprar</small>` : `<small>🔒 ${esc(r.falta)}</small>`}</button>`;
    };
    const grupos = (lista, actual, attr, dentro) => [
      ["", lista.filter(it => !it.req || !(it.req.tienda || it.req.top))],
      [`Tienda · 🪙 ${miles(PRECIO_TIENDA)} cada uno`, lista.filter(it => it.req && it.req.tienda)],
      ["Campeones · solo para el n.º 1 de cada juego", lista.filter(it => it.req && it.req.top).sort((a, b) => requisito(b, est).ok - requisito(a, est).ok)]
    ].filter(([, l]) => l.length).map(([t, l]) => (t ? `<h4 class="jg-ped-grupo">${t}</h4>` : "") + l.map(it => op(it, actual, attr, dentro(it))).join("")).join("");
    $("#pfMarcos").innerHTML = grupos(MARCOS, marco, "marco", m => avatarMarco(f, nom, color, m.id, 54));
    $("#pfFondos").innerHTML = grupos(FONDOS, fondo, "fondo", o => `<span class="jg-ped-muestra" style="background:${esc(o.css(color))}">${capaFondo(o)}</span>`);
    $("#pfVitNota").innerHTML = !est ? "Cargando tu historial…"
      : !ops.length ? "Todavía no tienes logros ni puestos. Juega una partida y vuelve."
      : vitrina.length ? `Elegidas <b>${vitrina.length}</b> de ${MAX_VITRINA}. Se muestran en este orden; las tres primeras salen en la tarjeta. <button class="btn2" id="pfVitAuto">Volver a automática</button>`
      : `Automática: se muestran tus mejores puestos y tus logros más raros. Marca hasta ${MAX_VITRINA} para elegirlas tú.`;
    $("#pfVit").innerHTML = ops.map(o => {
      const k = vitrina.indexOf(o.clave);
      return `<label class="jg-ped-vop${k >= 0 ? " on" : ""}"><input type="checkbox" data-vit="${esc(o.clave)}" ${k >= 0 ? "checked" : ""} ${k < 0 && vitrina.length >= MAX_VITRINA ? "disabled" : ""}>
        <span class="jg-vit-i">${esc(o.i)}</span><span><b>${esc(o.t)}</b><small>${esc(o.s)}${o.x ? " · " + esc(o.x) : ""}</small></span>${k >= 0 ? `<em>${k + 1}</em>` : ""}</label>`;
    }).join("");
    const auto = $("#pfVitAuto");
    if (auto) auto.onclick = e => { e.preventDefault(); vitrina = []; pinta(); };
    pintaMascota();
    pintaPrevia();
  }

  function falla(t) { $("#pfErr").textContent = t || ""; }

  $("#pfNick").value = nick;
  $("#pfNick").oninput = e => { nick = e.target.value.slice(0, LARGO_NICK); pinta(); };
  $("#pfBio").value = bio;
  $("#pfBio").oninput = e => { bio = e.target.value.slice(0, LARGO_BIO); $("#pfBioN").textContent = `${bio.length}/${LARGO_BIO}`; pintaPrevia(); };
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
  capa.querySelector(".jg-ped-tabs").onclick = e => {
    const b = e.target.closest("[data-tab]");
    if (b) { tab = b.getAttribute("data-tab"); pinta(); }
  };
  /* Comprar en la tienda: se mira el saldo antes de escribir (la economía
     anularía una compra sin fondos, pero mejor no hacerla), se pregunta
     una vez y, hecha, se da por tuyo aquí mismo sin esperar a la lectura. */
  async function compra(it, alHacerla) {
    if (comprando) return;
    if (!onComprar) { falla("La tienda no está disponible aquí."); return; }
    const s = saldo ? saldo() : null;
    if (s === null || s === undefined) { falla("Todavía se están contando tus monedas; prueba en unos segundos."); return; }
    if (s < PRECIO_TIENDA) { falla(`«${it.n}» cuesta ${miles(PRECIO_TIENDA)} 🪙 y tienes ${miles(s)}: te faltan ${miles(PRECIO_TIENDA - s)}.`); return; }
    if (!confirm(`¿Comprar «${it.n}» por ${miles(PRECIO_TIENDA)} monedas?\nTe quedarán ${miles(s - PRECIO_TIENDA)}. Es para siempre.`)) return;
    comprando = true; falla("");
    try {
      await onComprar(it.id);
      est = Object.assign({}, est, { compras: Object.assign({}, est && est.compras, { [it.id]: { p: PRECIO_TIENDA } }) });
      alHacerla(); pinta();
    } catch (err) {
      falla("No se pudo comprar: " + (err && (err.code || err.message) ? String(err.code || err.message) : String(err)));
    } finally { comprando = false; }
  }
  $("#pfMarcos").onclick = e => {
    const b = e.target.closest("[data-marco]");
    if (!b) return;
    const id = b.getAttribute("data-marco");
    if (b.classList.contains("venta")) return compra(marcoDe(id), () => { marco = id; });
    if (b.classList.contains("cerrado")) return;
    marco = id; pinta();
  };
  $("#pfFondos").onclick = e => {
    const b = e.target.closest("[data-fondo]");
    if (!b) return;
    const id = b.getAttribute("data-fondo");
    if (b.classList.contains("venta")) return compra(fondoDe(id), () => { fondo = id; });
    if (b.classList.contains("cerrado")) return;
    fondo = id; pinta();
  };
  $("#pfVit").onchange = e => {
    const c = e.target.closest("[data-vit]");
    if (!c) return;
    const k = c.getAttribute("data-vit");
    vitrina = c.checked ? [...vitrina.filter(x => x !== k), k].slice(0, MAX_VITRINA) : vitrina.filter(x => x !== k);
    pinta();
  };

  if (mp) {
    $("#pfMascotas").onclick = e => {
      const b = e.target.closest("[data-masc]");
      if (!b) return;
      const c = b.getAttribute("data-masc");
      mascota = c ? { m: c, b: (mascota && mascota.b) || "" } : null;
      pinta();
    };
    $("#pfBailes").onclick = e => {
      const b = e.target.closest("[data-baile]");
      if (!b || !mascota) return;
      mascota.b = b.getAttribute("data-baile");
      pinta();
    };
    $("#pfMascNota").onclick = e => { if (e.target.closest("[data-ir-mascotas]")) cierra(); };
  }

  $(".jg-fin-x").onclick = cierra;
  $("#pfCancelar").onclick = cierra;
  capa.onclick = e => { if (e.target === capa) cierra(); };

  $("#pfGuardar").onclick = async e => {
    const b = e.currentTarget;
    b.disabled = true; falla("");
    const salida = Object.assign({ nick: nick.trim().slice(0, LARGO_NICK), color },
      limpiaPerfil({ marco, fondo, bio, vitrina, mascota }));
    if (foto !== null) salida.foto = foto;
    try { await onGuardar(salida); cierra(); }
    catch (err) {
      b.disabled = false;
      falla(err && (err.code || err.message) ? String(err.code || err.message) : String(err));
    }
  };

  pinta();
  document.body.appendChild(capa);
  setTimeout(() => { try { (tab === "datos" ? $("#pfNick") : capa.querySelector(`[data-tab="${tab}"]`)).focus(); } catch (e) {} }, 30);
  return cierra;
}
