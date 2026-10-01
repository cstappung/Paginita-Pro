/* El perfil, a la vista: el avatar con su marco, la mini tarjeta que se abre
 * al tocar la foto de cualquiera y la página entera (`#perfil/<uid>`).
 *
 * La mini tarjeta es la que se ve más: sale de cualquier elemento con
 * `data-perfil="<uid>"` (la cabecera, las fichas de la sala, el chat, la
 * clasificación), anclada a él en el escritorio y como hoja desde abajo en
 * el móvil, donde un globo junto al dedo queda debajo del dedo. Enseña lo
 * justo para decidir si mirar más: el fondo, la foto con su marco, la bio,
 * tres números y las tres primeras piezas de la vitrina. El botón lleva a
 * la página, que es donde está todo.
 *
 * Los datos los da `ctx.datos(cb)` (la misma escucha que la pestaña de
 * logros, compartida), así que abrir diez tarjetas no son diez lecturas.
 */
import { estadisticas, marcoVisible, fondoVisible, vitrinaDe, nombreJuego, nombreCategoria, oscurece } from "./perfil-tarjeta.js";
import { LOGROS } from "./logros.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* La foto con su marco. Vale para cualquier tamaño: el marco es CSS y
   lee `--t` (el lado) y `--c` (el color de la persona). */
export function avatarMarco(foto, nombre, color, marco, tam, uid) {
  const dentro = foto
    ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer">`
    : `<i>${esc((nombre || "?").charAt(0).toUpperCase())}</i>`;
  return `<span class="jg-av jg-marco-${esc(marco || "anillo")}" style="--c:${esc(color || "#0d9488")};--t:${tam}px"${uid ? ` data-perfil="${esc(uid)}" data-nombre="${esc(nombre || "")}"` : ""}>${dentro}</span>`;
}

/* Quién es, con lo que haya: su perfil manda, luego lo que trae quien
   pregunta (la ficha que se tocó, la cuenta de Google si es uno mismo),
   luego lo que dicen las tablas. */
export function quien(uid, p, est, pista, colorDe) {
  p = p || {}; pista = pista || {};
  const foto = p.foto !== undefined && p.foto !== null ? p.foto : (pista.foto || (est && est.foto) || "");
  return {
    nombre: p.nick || pista.nombre || (est && est.nombre) || "Jugador",
    foto, color: p.color || pista.color || (colorDe ? colorDe(uid) : "#0d9488"),
    bio: p.bio || ""
  };
}

function pieza(v, grande) {
  return `<div class="jg-vit${grande ? " grande" : ""} t-${v.tipo}" title="${esc(v.s + " · " + v.t)}">
    <span class="jg-vit-i">${esc(v.i)}</span>
    <span class="jg-vit-tx"><b>${esc(v.t)}</b><small>${esc(v.s)}</small>${grande && v.x ? `<em>${esc(v.x)}</em>` : ""}</span>
  </div>`;
}

/* La tarjeta: la misma para el globo y para la vista previa del editor. */
export function tarjetaHtml({ uid, p, est, pista, colorDe, yo, editor }) {
  const q = quien(uid, p, est, pista, colorDe);
  const f = fondoVisible(p, est), marco = marcoVisible(p, est);
  const vit = est ? vitrinaDe(p, est, 3) : [];
  const n = est ? [
    [est.nLogros, est.nLogros === 1 ? "logro" : "logros"],
    [est.victorias, est.victorias === 1 ? "victoria" : "victorias"],
    [est.mejorPuesto ? "#" + est.mejorPuesto : "—", "mejor puesto"]
  ] : [["…", "logros"], ["…", "victorias"], ["…", "mejor puesto"]];
  return `
    <div class="jg-mini-fondo${f.oscuro ? " oscuro" : ""}" style="background:${esc(f.css(q.color))}"></div>
    <div class="jg-mini-cab">
      ${avatarMarco(q.foto, q.nombre, q.color, marco, 76)}
      <div class="jg-mini-id"><b>${esc(q.nombre)}</b>${uid === yo ? "<small>tú</small>" : ""}</div>
    </div>
    ${q.bio ? `<p class="jg-mini-bio">${esc(q.bio)}</p>` : `<p class="jg-mini-bio jg-nada">${uid === yo ? "Aún no escribes nada sobre ti." : "Sin descripción."}</p>`}
    <div class="jg-mini-num">${n.map(([a, b]) => `<span><b>${esc(a)}</b>${esc(b)}</span>`).join("")}</div>
    <div class="jg-mini-vit">${vit.length ? vit.map(v => pieza(v)).join("") : `<p class="jg-nada">${est ? "Todavía nada que exhibir." : "Cargando…"}</p>`}</div>
    ${editor ? "" : `<div class="jg-mini-btns">
      <button class="btn" data-ir-perfil="${esc(uid)}">Ver perfil</button>
      ${uid === yo ? `<button class="btn2" data-editar-perfil>✎ Personalizar</button>` : ""}
    </div>`}`;
}

/* ---------- El globo ---------- */
let abierta = null;
export function cierraMini() { if (abierta) { abierta.cierra(); abierta = null; } }

export function abreMini(uid, ancla, ctx, pista) {
  cierraMini();
  const caja = document.createElement("div");
  caja.className = "jg-mini";
  caja.setAttribute("role", "dialog");
  caja.tabIndex = -1;
  let est = null;
  const pinta = () => {
    caja.innerHTML = `<button class="jg-mini-x" title="Cerrar" aria-label="Cerrar">✕</button>` +
      tarjetaHtml({ uid, p: ctx.perfil(uid), est, pista, colorDe: ctx.colorDe, yo: ctx.yo() });
    caja.setAttribute("aria-label", "Perfil de " + quien(uid, ctx.perfil(uid), est, pista).nombre);
    caja.querySelector(".jg-mini-x").onclick = cierraMini;
    const v = caja.querySelector("[data-ir-perfil]");
    if (v) v.onclick = () => { cierraMini(); ctx.ir("#perfil/" + uid); };
    const e = caja.querySelector("[data-editar-perfil]");
    if (e) e.onclick = () => { cierraMini(); ctx.editar(); };
  };
  pinta();
  document.body.appendChild(caja);
  const coloca = () => {
    if (window.matchMedia("(max-width: 600px)").matches || !ancla || !ancla.isConnected) { caja.classList.add("hoja"); return; }
    caja.classList.remove("hoja");
    const r = ancla.getBoundingClientRect(), w = caja.offsetWidth, h = caja.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 10);
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    caja.style.left = x + "px"; caja.style.top = y + "px";
  };
  coloca();
  const off = ctx.datos(d => { est = estadisticas(uid, d); pinta(); coloca(); });
  const fuera = e => { if (!caja.contains(e.target) && !(ancla && ancla.contains(e.target))) cierraMini(); };
  const tecla = e => { if (e.key === "Escape") cierraMini(); };
  setTimeout(() => { document.addEventListener("pointerdown", fuera, true); document.addEventListener("keydown", tecla); }, 0);
  window.addEventListener("resize", coloca);
  abierta = {
    uid,
    cierra() {
      off && off();
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", coloca);
      caja.remove();
    },
    refresca: pinta
  };
  try { caja.focus({ preventScroll: true }); } catch (e) { /* nada */ }
}
export const miniAbierta = () => abierta;

/* ---------- La página ---------- */
export function crearPaginaPerfil({ uid, ctx }) {
  let host = null, est = null, off = null, firma = "";

  function pinta() {
    if (!host) return;
    const p = ctx.perfil(uid) || {}, yo = ctx.yo();
    const pista = uid === yo ? ctx.propio() : null;
    const f2 = JSON.stringify([p, est && [est.nLogros, est.tablas, est.victorias], yo]);
    if (f2 === firma) return;
    firma = f2;
    const q = quien(uid, p, est, pista, ctx.colorDe);
    const fondo = fondoVisible(p, est), marco = marcoVisible(p, est);
    const vit = est ? vitrinaDe(p, est) : [];
    const propio = uid === yo;
    const pc = est && est.partidas ? Math.round(est.victorias * 100 / est.partidas) : 0;
    const numeros = est ? [
      [est.partidas, "partidas"], [est.victorias, "victorias"], [pc + " %", "de victorias"],
      [`${est.nLogros}<small>/${est.totalLogros}</small>`, "logros"], [est.podios, est.podios === 1 ? "podio" : "podios"]
    ] : [];
    host.innerHTML = `
    <div class="jg-pf" style="--c:${esc(q.color)};--c2:${esc(oscurece(q.color, .35))}">
      <div class="jg-pf-barra"><button class="btn2" data-volver>← Volver</button>
        <span class="grow"></span>
        <button class="btn2" data-copiar>🔗 Copiar enlace</button>
        ${propio ? `<button class="btn" data-editar>✎ Personalizar</button>` : ""}</div>
      <section class="jg-pf-hero${fondo.oscuro ? " oscuro" : ""}" style="background:${esc(fondo.css(q.color))}">
        <div class="jg-pf-hero-in">
          ${avatarMarco(q.foto, q.nombre, q.color, marco, 116)}
          <div class="jg-pf-id">
            <h1>${esc(q.nombre)}</h1>
            ${q.bio ? `<p>${esc(q.bio)}</p>` : propio ? `<p class="jg-nada">Escribe algo sobre ti en «Personalizar».</p>` : ""}
          </div>
        </div>
      </section>
      ${est ? `<div class="jg-pf-num">${numeros.map(([a, b]) => `<div><b>${a}</b><span>${esc(b)}</span></div>`).join("")}</div>` : `<div class="jg-nada jg-pf-carga">Cargando su historial…</div>`}
      ${est ? `
      <section class="jg-pf-sec">
        <header><h2>Vitrina</h2>${propio ? `<button class="btn2" data-editar="vitrina">Elegir qué mostrar</button>` : ""}</header>
        ${vit.length ? `<div class="jg-pf-vit">${vit.map(v => pieza(v, true)).join("")}</div>`
          : `<p class="jg-nada">${propio ? "Juega una partida o saca un logro y podrás exhibirlo aquí." : "Todavía no tiene nada que exhibir."}</p>`}
      </section>
      <section class="jg-pf-sec">
        <header><h2>Clasificaciones</h2><small>${est.tablas.length} ${est.tablas.length === 1 ? "tabla" : "tablas"}</small></header>
        ${est.tablas.length ? `<ol class="jg-pf-tablas">${est.tablas.map(t => `
          <li class="${t.puesto <= 3 ? "top p" + t.puesto : ""}">
            <span class="jg-pf-puesto">${t.puesto <= 3 ? ["🥇", "🥈", "🥉"][t.puesto - 1] : "#" + t.puesto}</span>
            <span class="jg-pf-tn"><b>${esc(t.tipo === "r" ? nombreJuego(t.j) : nombreCategoria(t.c))}</b>
              <small>puesto ${t.puesto} de ${t.de}</small></span>
            <span class="jg-pf-tv">${esc(t.tipo === "r" ? `${t.puntos} pts · ${t.ganadas}/${t.jugadas}` : t.valor)}</span>
          </li>`).join("")}</ol>` : `<p class="jg-nada">Aún no aparece en ninguna tabla.</p>`}
      </section>
      <section class="jg-pf-sec">
        <header><h2>Logros</h2><small>${est.nLogros} de ${est.totalLogros}</small></header>
        ${logrosHtml(est)}
      </section>` : ""}
    </div>`;
    host.querySelector("[data-volver]").onclick = () => { if (history.length > 1) history.back(); else ctx.ir(""); };
    host.querySelector("[data-copiar]").onclick = e => {
      const url = location.origin + location.pathname + "#perfil/" + uid, b = e.currentTarget;
      const ok = () => { b.textContent = "✓ Copiado"; setTimeout(() => { b.textContent = "🔗 Copiar enlace"; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => prompt("Copia el enlace:", url));
      else prompt("Copia el enlace:", url);
    };
    for (const b of host.querySelectorAll("[data-editar]")) b.onclick = () => ctx.editar(b.getAttribute("data-editar") || "");
  }

  function logrosHtml(est) {
    const por = {};
    for (const l of est.logros) (por[l.j] = por[l.j] || []).push(l);
    const juegos = Object.keys(por).sort((a, b) => por[b].length - por[a].length);
    if (!juegos.length) return `<p class="jg-nada">Todavía ninguno.</p>`;
    return `<div class="jg-pf-logros">${juegos.map(j => `
      <div class="jg-pf-lj"><header><b>${esc(nombreJuego(j))}</b><small>${por[j].length}/${LOGROS[j].length}</small></header>
        <div class="jg-pf-lchips">${por[j].map(l => `<span class="jg-pf-lchip${l.pct && l.pct <= 10 ? " raro" : ""}" title="${esc(l.d)}${l.pct ? ` · lo tiene el ${l.pct} %` : ""}"><i>${esc(l.i)}</i>${esc(l.n)}</span>`).join("")}</div>
      </div>`).join("")}</div>`;
  }

  return {
    montar(h) {
      host = h;
      off = ctx.datos(d => { est = estadisticas(uid, d); pinta(); });
      pinta();
    },
    refresca() { firma = ""; pinta(); },
    estadisticas: () => est,
    destruir() { off && off(); host = null; }
  };
}
