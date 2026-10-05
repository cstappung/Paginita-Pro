/*
 * El salón: las miniaturas de los juegos y su ficha.
 *
 * Una miniatura es la misma pieza para un juego de un jugador y para uno
 * multijugador; lo que la distingue a simple vista es la **insignia de
 * modo** de la portada (una persona y «1 jugador», o dos personas y
 * «2–10 jugadores», cada una en su color), no un diseño distinto. Debajo
 * de esa insignia van las etiquetas **«Celular»** y **«PC»**, según dónde
 * se pueda jugar (`plataformas`). Los datos (qué es nuevo, qué está
 * bloqueado, dónde se juega) los decide `salon-datos.js` —y lo último, el
 * código de cada juego leído en el build—; aquí solo se pinta y se toca.
 *
 * Cómo se toca, y por qué así:
 *
 * - **Tocar la tarjeta abre la ficha; nunca juega ni abre una sala.**
 *   Abrir una sala tiene consecuencias (aparece en la lista de todos y se
 *   anuncia en Discord), así que no puede ocurrir por un roce del pulgar
 *   al hacer scroll. La ficha trae todo lo que la tarjeta no cabe: las
 *   opciones, las salas que esperan de ese juego, el manual, el podio.
 * - **▶ juega ya**, y solo existe en los de un jugador: ahí no hay nada
 *   que decidir antes ni nada que se pueda romper. Es un enlace de
 *   verdad, así que el clic central o «abrir en otra pestaña» funcionan.
 * - **Mantener presionado abre la misma ficha** (con una vibración
 *   corta). No hay acciones escondidas detrás de un gesto: quien lo
 *   intenta por costumbre encuentra lo mismo que con un toque, y el
 *   navegador no saca su menú de «guardar imagen» sobre la portada.
 * - **En el móvil la ficha es una hoja que sube desde abajo** (modal, se
 *   cierra con ✕, tocando fuera o arrastrándola hacia abajo) y sus
 *   botones quedan al pie, donde llega el pulgar. **En el escritorio es
 *   un panel a la derecha que no tapa el catálogo**: se puede ir tocando
 *   tarjetas y la ficha cambia, y la tarjeta elegida queda marcada.
 *
 * `crearSalon(ctx)` devuelve `{tarjeta, enganchar, abre, cierra,
 * refresca, abiertaPara}`; `ctx` trae lo que vive en `juegos-main.js`
 * (el arte de las portadas, las salas abiertas, crear y entrar, el login).
 */
import { bloqueado, practicaDe } from "./salon-datos.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Los iconos de modo son SVG y no emoji: cada sistema pinta 👤 de un
   tamaño y color distinto, y la insignia tiene que leerse igual en todas. */
export const ICONO_SOLO = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="4.8" r="3" fill="currentColor"/><path d="M2.4 14.6c.6-3.3 2.8-5.2 5.6-5.2s5 1.9 5.6 5.2z" fill="currentColor"/></svg>';
export const ICONO_MULTI = '<svg viewBox="0 0 20 16" aria-hidden="true"><circle cx="13.6" cy="4.4" r="2.5" fill="currentColor" opacity=".7"/><path d="M11 9.6c3.4-1 7.1.6 7.6 4.9h-5.2z" fill="currentColor" opacity=".7"/><circle cx="7" cy="4.8" r="3" fill="currentColor"/><path d="M1.4 14.6c.6-3.3 2.8-5.2 5.6-5.2s5 1.9 5.6 5.2z" fill="currentColor"/></svg>';
const ICONO_BOTS = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="4.5" width="11" height="9" rx="2.5" fill="currentColor"/><circle cx="6" cy="9" r="1.3" fill="#fff"/><circle cx="10" cy="9" r="1.3" fill="#fff"/><path d="M8 4.5V2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="1.6" r="1.1" fill="currentColor"/></svg>';
/* Las etiquetas «Celular» y «PC»: un teléfono y una pantalla dibujados, por
   la misma razón que los iconos de modo (📱 cambia de forma y color en cada
   sistema). */
export const ICONO_MOVIL = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.2" y="1.4" width="7.6" height="13.2" rx="1.9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.8 3.4h2.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="12.1" r=".95" fill="currentColor"/></svg>';
export const ICONO_PC = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.6" y="2.6" width="12.8" height="8.4" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 13.6h5M8 11v2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
export const CANDADO = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.8" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';

/* Dónde se juega, en una sola píldora: «Celular · PC» si va en los dos, o
   solo «PC» cuando pide teclado. La lee también la tarjeta de Novedades. Lo
   decide `CONTROLES` (generado leyendo el código de cada juego), no esta
   vista. */
export function plataformas(e) {
  if (!e.movil && !e.pc) return "";
  return `<span class="jg-mn-plat" aria-hidden="true" title="${esc(dondeSeJuega(e))}">` +
    (e.movil ? `<i class="cel">${ICONO_MOVIL}Celular</i>` : "") +
    (e.pc ? `<i class="pc">${ICONO_PC}PC</i>` : "") + "</span>";
}
/* Lo mismo en una frase, para lectores de pantalla y la ficha. */
export const dondeSeJuega = e => e.movil && e.pc ? "Se juega en el celular y en el PC"
  : e.movil ? "Se juega en el celular" : e.pc ? "Solo en PC" : "";

/* Lo que dice la insignia, corto en la portada y largo para el lector de
   pantalla, que no ve los colores. */
/* `pal` es la palabra que sobra en una tarjeta estrecha: con el icono de dos
   personas, «2–10» ya se lee como jugadores, y entero no cabía junto a ★. */
const insignia = e => e.modo === "multi"
  ? { ico: ICONO_MULTI, corto: e.cupo, pal: "jugadores", largo: `Multijugador, ${e.cupo.replace("–", " a ")} jugadores` }
  : e.modo === "bots"
    ? { ico: ICONO_BOTS, corto: "Contra bots", largo: "Un jugador, contra bots" }
    : { ico: ICONO_SOLO, corto: "1 jugador", largo: "Un jugador" };

export function crearSalon(ctx) {
  let capa = null, ficha = null, actual = null, origen = null, cerrando = 0;
  const elegidas = new Map();   // juego → opciones elegidas en su ficha (dura la visita)
  const movil = () => matchMedia("(max-width: 720px)").matches;

  /* ---------- la miniatura ---------- */

  /* El arte de la portada: los multijugador y las prácticas usan el de su
     juego (`arteJuego` en juegos-main.js); los del club, su fondo de
     siempre (`.sp-e-<id>`) con el nombre escrito con su tipografía. */
  function arte(e, pista = "") {
    const p = pista ? `<span class="jg-mn-pista">${esc(pista)}</span>` : "";
    if (e.modo === "multi") return `<span class="jg-mn-arte jg-portada jg-portada-${e.id}" aria-hidden="true">${ctx.arteMulti(e.id)}${p}</span>`;
    if (e.modo === "bots") return `<span class="jg-mn-arte jg-portada jg-portada-${e.juego}" aria-hidden="true">${ctx.arteMulti(e.juego)}${p}</span>`;
    return `<span class="jg-mn-arte jg-mn-sp sp-e-${e.id}" aria-hidden="true"><strong>${esc(e.nombre)} <span>${esc(e.icono)}</span></strong>${p}</span>`;
  }

  /* `f` son las marcas de este momento: nuevo, más jugado, salas que
     esperan, invitado. La tarjeta no guarda estado: se repinta entera. */
  function tarjeta(e, f = {}) {
    const bloq = bloqueado(e, f.invitado), ins = insignia(e);
    const meta = e.modo === "multi"
      ? `<span>${esc(e.genero)}</span>${f.salas ? `<span class="jg-mn-vivo"><i aria-hidden="true"></i>${f.salas} ${f.salas === 1 ? "sala" : "salas"}</span>` : `<span>${e.grupo ? "En grupo" : "Duelo"}</span>`}`
      : `<span>${esc(e.genero)}</span><span>${e.modo === "bots" ? "Sin ranking" : e.diario ? "📅 Reto diario" : "🏆 Ranking"}</span>`;
    const clases = ["jg-mn", f.nuevo ? "nuevo" : "", bloq ? "bloq" : "", f.top ? "top" : "", actual && actual.id === e.id ? "sel" : ""].filter(Boolean).join(" ");
    const etiqueta = `${e.nombre}. ${ins.largo}.${e.movil || e.pc ? " " + dondeSeJuega(e) + "." : ""}${bloq ? " Requiere cuenta." : ""}${f.nuevo ? " Nuevo." : ""} Ver detalles`;
    return `
      <article class="${clases}" data-id="${esc(e.id)}" data-modo="${e.modo}" data-movil="${e.movil ? 1 : 0}" data-grupo="${e.modo === "multi" ? (e.grupo ? "grupo" : "duelo") : ""}" style="--c:${esc(e.color)}">
        <button class="jg-mn-abre" type="button" aria-haspopup="dialog" aria-expanded="${!!(actual && actual.id === e.id)}" aria-label="${esc(etiqueta)}">
          ${arte(e, !bloq && e.modo === "multi" ? "Ver opciones y abrir sala →" : "")}
          <span class="jg-mn-txt"><b class="jg-mn-nombre">${esc(e.nombre)}</b><span class="jg-mn-meta">${meta}</span></span>
        </button>
        <span class="jg-mn-modo m-${e.modo}" aria-hidden="true">${ins.ico}${esc(ins.corto)}${ins.pal ? `<span class="jg-mn-pal">${ins.pal}</span>` : ""}</span>
        ${plataformas(e)}
        ${f.nuevo ? '<span class="jg-mn-etq" aria-hidden="true">Nuevo</span>' : f.top ? '<span class="jg-mn-etq top" aria-hidden="true">★<span> Más jugado</span></span>' : ""}
        ${bloq ? `<span class="jg-mn-candado" aria-hidden="true">${CANDADO}<b>Requiere cuenta</b></span>` : ""}
        ${e.modo !== "multi" ? `<a class="jg-mn-ya" href="${esc(e.ruta || e.url)}" aria-label="Jugar ya a ${esc(e.nombre)}" title="Jugar ya"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6c0 .5.6.8 1 .5l7.2-4.8a.6.6 0 0 0 0-1L6 2.7c-.4-.3-1 0-1 .5z" fill="currentColor"/></svg></a>` : ""}
      </article>`;
  }

  /* ---------- tocar ---------- */

  /* Un solo escuchador por raíz: las tarjetas se repintan enteras y no
     hay que volver a enganchar nada. */
  function enganchar(raiz) {
    let pulsado = null, reloj = 0, x0 = 0, y0 = 0, largo = false;
    const suelta = () => { clearTimeout(reloj); pulsado = null; };
    raiz.addEventListener("pointerdown", ev => {
      const b = ev.target.closest(".jg-mn-abre");
      if (!b || ev.pointerType === "mouse") return;
      pulsado = b; largo = false; x0 = ev.clientX; y0 = ev.clientY;
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        if (!pulsado) return;
        largo = true;
        try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* sin vibración */ }
        abre(pulsado.closest(".jg-mn").dataset.id, pulsado);
        suelta();
      }, 450);
    });
    /* Moverse más de unos píxeles es hacer scroll, no mantener presionado. */
    raiz.addEventListener("pointermove", ev => { if (pulsado && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) suelta(); });
    raiz.addEventListener("pointerup", suelta);
    raiz.addEventListener("pointercancel", suelta);
    raiz.addEventListener("contextmenu", ev => { if (ev.target.closest(".jg-mn") && matchMedia("(pointer: coarse)").matches) ev.preventDefault(); });
    raiz.addEventListener("click", ev => {
      const b = ev.target.closest(".jg-mn-abre");
      if (!b) return;
      /* El clic que llega al soltar después de mantener presionado ya
         abrió la ficha: no la vuelve a cerrar y abrir. */
      if (largo) { largo = false; return; }
      const id = b.closest(".jg-mn").dataset.id;
      if (actual && actual.id === id && !movil()) { cierra(); return; }
      abre(id, b);
    });
  }

  /* ---------- la ficha ---------- */

  function construye() {
    capa = document.createElement("div");
    capa.className = "jg-hoja-capa";
    capa.hidden = true;
    capa.innerHTML = '<section class="jg-hoja" role="dialog" aria-labelledby="jgFichaT" tabindex="-1"></section>';
    document.body.appendChild(capa);
    ficha = capa.firstElementChild;
    /* Tocar el fondo cierra (solo existe en el móvil). */
    capa.addEventListener("click", ev => { if (ev.target === capa) cierra(); });
    ficha.addEventListener("click", alClic);
    ficha.addEventListener("change", ev => { if (ev.target.matches("select[data-op]")) recuerda(); });
    arrastre();
  }

  /* Los escuchadores del documento se ponen una vez por salón, no por
     ficha construida, y no hacen nada mientras no haya ficha abierta. */
  const abierta = () => !!(capa && !capa.hidden && actual);
  document.addEventListener("keydown", ev => {
    if (!abierta()) return;
    /* Escape lo atiende primero el manual si está abierto encima. */
    if (ev.key === "Escape" && !document.querySelector(".jg-reglas-capa")) { ev.preventDefault(); cierra(); return; }
    if (ev.key === "Tab" && movil()) atrapa(ev);
  });
  /* En el escritorio el panel no es modal: un clic fuera de él y fuera
     de una tarjeta (que lo cambiaría) lo cierra. */
  document.addEventListener("pointerdown", ev => {
    if (!abierta() || movil() || ficha.contains(ev.target) || ev.target.closest(".jg-mn, .jg-reglas-capa, .jg-modal-capa, .jg-fin-capa, .rp-fab, .rp-modal")) return;
    cierra(false);
  });

  /* El foco no sale de la hoja mientras es modal. */
  function atrapa(ev) {
    const f = [...ficha.querySelectorAll("button:not([disabled]), a[href], select, [tabindex]:not([tabindex='-1'])")].filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (ev.shiftKey && (document.activeElement === a || document.activeElement === ficha)) { ev.preventDefault(); z.focus(); }
    else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
  }

  /* Arrastrar la hoja hacia abajo desde su cabecera la cierra, como
     cualquier hoja del sistema; soltarla antes de 90 px la devuelve. */
  function arrastre() {
    let y0 = null, dy = 0;
    ficha.addEventListener("pointerdown", ev => {
      if (!movil() || !ev.target.closest(".jg-hoja-asa, .jg-hoja-arte")) return;
      y0 = ev.clientY; dy = 0;
      ficha.setPointerCapture(ev.pointerId);
      ficha.classList.add("arrastra");
    });
    ficha.addEventListener("pointermove", ev => {
      if (y0 == null) return;
      dy = Math.max(0, ev.clientY - y0);
      ficha.style.transform = `translateY(${dy}px)`;
    });
    const fin = () => {
      if (y0 == null) return;
      y0 = null;
      ficha.classList.remove("arrastra");
      ficha.style.transform = "";
      if (dy > 90) cierra();
    };
    ficha.addEventListener("pointerup", fin);
    ficha.addEventListener("pointercancel", fin);
  }

  function recuerda() {
    if (!actual || actual.modo !== "multi") return;
    elegidas.set(actual.id, leeOps());
  }
  function leeOps() {
    const o = {};
    for (const s of ficha.querySelectorAll("select[data-op]")) {
      /* Casi todo es un número, pero hay nombres (el mapa de worms): un
         `Number("alpine")` escribiría NaN y la base rechazaría la sala. */
      const n = Number(s.value);
      o[s.dataset.op] = Number.isFinite(n) ? n : s.value;
    }
    return o;
  }

  /* Las opciones de la sala, ya desplegadas: en la ficha hay sitio, y
     plegarlas otra vez detrás de un «Opciones» sería un paso de más. */
  function opcionesHtml(e) {
    const ops = ctx.opciones(e.id);
    if (!ops.length) return "";
    const antes = elegidas.get(e.id) || {};
    return `<div class="jg-hoja-ops"><h3>Opciones de la sala</h3>${ops.map(o => {
      const def = antes[o.clave] != null ? antes[o.clave] : (o.por || o.valores[0].v);
      return `<label><span>${esc(o.etiqueta)}</span><select data-op="${esc(o.clave)}">${o.valores.map(v =>
        `<option value="${esc(v.v)}"${String(v.v) === String(def) ? " selected" : ""}>${esc(v.t)}</option>`).join("")}</select></label>`;
    }).join("")}</div>`;
  }

  /* Las salas que esperan de este juego: unirse a una es la forma más
     rápida de jugar, así que va antes que abrir otra. */
  function salasHtml(e) {
    if (e.modo !== "multi" || ctx.invitado()) return "";
    const l = ctx.salasDe(e.id);
    if (!l.length) return `<p class="jg-hoja-salas vacia">Nadie espera ahora en ${esc(e.nombre)}. Abre la sala y pasa el enlace.</p>`;
    const s = l[0];
    return `<div class="jg-hoja-salas"><span><i aria-hidden="true"></i><b>${l.length} ${l.length === 1 ? "sala espera" : "salas esperan"}</b> · la de <span translate="no">${esc(s.nombre || "alguien")}</span> lleva más rato</span>
      <button class="btn2" type="button" data-f="unirse" data-pid="${esc(s.id)}">Unirme</button></div>`;
  }

  function cuerpo(e) {
    const ins = insignia(e), bloq = bloqueado(e, ctx.invitado()), inv = ctx.invitado();
    const chips = `<span class="jg-mn-modo m-${e.modo}">${ins.ico}${esc(ins.largo)}</span>` +
      (e.genero ? `<span class="jg-hoja-chip">${esc(e.genero)}</span>` : "") +
      (ctx.esNuevo(e.id) ? '<span class="jg-hoja-chip nuevo">Nuevo</span>' : "") +
      (e.diario ? '<span class="jg-hoja-chip">📅 Reto diario</span>' : "") +
      /* En la ficha se dice también lo contrario: quien la abre desde un
         teléfono tiene que saber antes de entrar que ahí no se puede jugar. */
      (e.movil ? `<span class="jg-hoja-chip movil">${ICONO_MOVIL}${e.pc ? ICONO_PC : ""}${dondeSeJuega(e)}</span>`
        : e.pc ? `<span class="jg-hoja-chip pc">${ICONO_PC}Solo en PC${e.pide ? ": se juega con " + esc(e.pide) : ""}</span>` : "");
    const p = e.modo === "multi" ? practicaDe(e.id) : null;
    let medio = "", pie = "";
    const reglas = `<button class="btn2" type="button" data-f="reglas" title="Cómo se juega">📖 Reglas</button>`;
    if (bloq) {
      /* El choque del invitado con un multijugador: qué necesita, por qué,
         y dos salidas que no lo dejan con las manos vacías. */
      medio = `<div class="jg-hoja-cuenta">
        <span class="jg-hoja-candado" aria-hidden="true">${CANDADO}</span>
        <h3>Este juego es multijugador y necesita una cuenta</h3>
        <p>Con tu cuenta de Google abres salas, invitas a tus amigos con un enlace y sumas puntos en la clasificación, logros y monedas. Es gratis y tarda un clic.</p>
        ${p ? `<a class="jg-hoja-alt" href="${esc(p.url)}">${ICONO_BOTS} Mientras tanto, practícalo solo contra bots →</a>` : ""}
        <button class="jg-hoja-alt" type="button" data-f="cierra">Seguir como invitado</button>
      </div>`;
      pie = `${reglas}<button class="btn jg-hoja-ya" type="button" data-f="login">Iniciar sesión y jugar</button>`;
    } else if (e.modo === "multi") {
      medio = salasHtml(e) + opcionesHtml(e) + `<div class="jg-hoja-podio" data-podio></div>` +
        (p ? `<p class="jg-hoja-nota">¿Quieres probar antes? <a href="${esc(p.url)}">Practica solo contra bots →</a></p>` : "");
      pie = `${reglas}${e.id === "pokemon" ? '<button class="btn2" type="button" data-f="equipos" title="Mis equipos">📋 Equipos</button>' : ""}
        <button class="btn jg-hoja-ya" type="button" data-f="sala">Abrir sala e invitar <span aria-hidden="true">→</span></button>`;
    } else {
      medio = `<ul class="jg-hoja-modos" aria-label="Qué trae">${(e.modos || []).map(m => `<li>${esc(m)}</li>`).join("")}</ul>` +
        `<p class="jg-hoja-nota">${inv
          ? (e.modo === "bots" ? "Práctica contra la máquina: no se guarda ni puntúa, con o sin cuenta." : "Modo invitado: juegas igual, pero tu récord no se guarda ni entra en la clasificación. <button type=\"button\" class=\"jg-enlace-btn\" data-f=\"login\">Iniciar sesión</button>")
          : (e.modo === "bots" ? "Práctica contra la máquina: no puntúa en la clasificación." : e.diario ? "Un reto nuevo cada día, igual para todos. Tu racha y tus récords quedan en tu cuenta." : "Cada modalidad tiene su clasificación. Tus récords quedan en tu cuenta.")}</p>`;
      pie = `${reglas}<a class="btn jg-hoja-ya" href="${esc(e.ruta || e.url)}" data-f="juega">▶ ${e.modo === "bots" ? "Practicar" : "Jugar"}</a>`;
    }
    return `
      <div class="jg-hoja-asa" aria-hidden="true"><i></i></div>
      <button class="jg-hoja-x" type="button" data-f="cierra" aria-label="Cerrar">✕</button>
      ${arte(e).replace("jg-mn-arte", "jg-mn-arte jg-hoja-arte")}
      <div class="jg-hoja-cuerpo">
        <div class="jg-hoja-chips">${chips}</div>
        <h2 id="jgFichaT">${esc(e.nombre)}</h2>
        <p class="jg-hoja-lema">${esc(e.lema)}</p>
        ${medio}
      </div>
      <footer class="jg-hoja-pie">${pie}</footer>`;
  }

  function alClic(ev) {
    const b = ev.target.closest("[data-f]");
    if (!b || !actual) return;
    const e = actual, f = b.dataset.f;
    if (f === "cierra") { cierra(); return; }
    if (f === "reglas") { ctx.reglas(e, e.modo === "multi" ? leeOps() : {}); return; }
    if (f === "equipos") { ctx.equipos(leeOps()); return; }
    if (f === "login") { ctx.login(e.id); return; }
    if (f === "unirse") { cierra(false); ctx.entrarSala(b.dataset.pid); return; }
    if (f === "sala") { recuerda(); const o = leeOps(); cierra(false); ctx.crearSala(e.id, o); return; }
    /* «Jugar» es un enlace: navega solo. La ficha se cierra para que al
       volver al salón no siga abierta encima. */
    if (f === "juega") cierra(false);
  }

  function marca(id) {
    for (const c of document.querySelectorAll(".jg-mn")) {
      const si = c.dataset.id === id;
      c.classList.toggle("sel", si);
      const b = c.querySelector(".jg-mn-abre");
      if (b) b.setAttribute("aria-expanded", String(si));
    }
  }

  /* Abre (o cambia) la ficha del juego `id`. `desde` es el botón que la
     abrió: al cerrar, el foco vuelve ahí. */
  function abre(id, desde) {
    const e = ctx.entrada(id);
    if (!e) return;
    if (!capa) construye();
    clearTimeout(cerrando);
    if (actual && actual.modo === "multi") recuerda();
    actual = e;
    origen = desde || origen;
    ficha.style.setProperty("--c", e.color);
    ficha.dataset.modo = e.modo;
    ficha.classList.toggle("bloq", bloqueado(e, ctx.invitado()));
    ficha.setAttribute("aria-modal", String(movil()));
    ficha.innerHTML = cuerpo(e);
    ficha.dataset.salas = salasHtml(e).trim();
    ficha.scrollTop = 0;
    refresca();
    const nueva = capa.hidden;
    capa.hidden = false;
    capa.classList.remove("cerrando");
    document.documentElement.classList.toggle("jg-hoja-modal", movil());
    document.documentElement.classList.add("jg-hoja-abierta");
    /* Recién mostrada, la clase espera un cuadro para que la entrada se
       anime; si se estaba cerrando (230 ms), vuelve en el acto: sin eso
       quedaba visible la capa y la hoja fuera de la pantalla. */
    if (nueva) requestAnimationFrame(() => { if (actual) capa.classList.add("abierta"); });
    else capa.classList.add("abierta");
    marca(id);
    /* El foco entra en la ficha para que el teclado y el lector de
       pantalla la encuentren; en el escritorio, al botón principal. */
    const foco = ficha.querySelector(".jg-hoja-ya") || ficha;
    try { foco.focus({ preventScroll: true }); } catch (err) { foco.focus(); }
    ctx.alAbrir && ctx.alAbrir(e);
  }

  function cierra(devolverFoco = true) {
    if (!capa || capa.hidden) return;
    /* Mientras sale (230 ms) no recibe toques: si no, el fondo invisible
       se tragaba el de la tarjeta siguiente. */
    capa.classList.remove("abierta");
    capa.classList.add("cerrando");
    document.documentElement.classList.remove("jg-hoja-modal", "jg-hoja-abierta");
    const volver = origen;
    actual = null; origen = null;
    marca("");
    clearTimeout(cerrando);
    cerrando = setTimeout(() => { if (!actual) capa.hidden = true; }, 230);
    if (devolverFoco && volver && document.contains(volver)) { try { volver.focus({ preventScroll: true }); } catch (err) { /* ya no está */ } }
  }

  /* Lo que cambia solo mientras la ficha está abierta (alguien abre una
     sala de ese juego, llega el podio). Las opciones no se tocan: son lo
     que la persona está eligiendo. */
  function refresca() {
    if (!actual || !ficha) return;
    /* Se compara con lo último que se pintó, no con `outerHTML`, que el
       navegador normaliza a su manera: así un «Unirme» enfocado no se
       repinta (ni pierde el foco) mientras no cambie nada. */
    const s = ficha.querySelector(".jg-hoja-salas");
    if (s) { const html = salasHtml(actual).trim(); if (ficha.dataset.salas !== html) { ficha.dataset.salas = html; s.outerHTML = html; } }
    const p = ficha.querySelector("[data-podio]");
    if (p) { const html = ctx.podioDe ? ctx.podioDe(actual.id) : ""; if (p.innerHTML !== html) p.innerHTML = html; p.hidden = !html; }
  }

  /* Se llama al salir del vestíbulo: la ficha cuelga de <body> y, si no,
     seguiría flotando sobre una partida. */
  function destruir() {
    cierra(false);
    if (capa) { clearTimeout(cerrando); capa.remove(); capa = null; ficha = null; }
  }

  return { tarjeta, enganchar, abre, cierra, refresca, destruir, abiertaPara: () => actual ? actual.id : "" };
}
