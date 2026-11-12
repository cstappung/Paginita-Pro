/* ============================================================
   Las cacerías de récords en pantalla («Fichado»). Lo puro está en
   cazas.js; aquí:

   - el **cartel** con el top 5 de pozos, arriba del chat general en el
     riel (PC ancho) y como caja en el salón en pantallas angostas;
   - la ventana para **poner precio** a un n.º 1 del Solo Club;
   - la **entrada del buscado**: quien tiene precio sobre su récord lo ve
     al entrar (una vez por sesión, y otra vez si le ponen uno nuevo);
   - el aviso del **cobro** para quien se lleva la recompensa, y los toasts
     de lo que vuelve;
   - los **avisos del chat general** (rieles.js los intercala), que se ven
     más imponentes cuanto más grande el pozo;
   - el **reclamo automático**: la pestaña de quien supera una marca la
     reclama sola (`cazas/g`), y la economía decide quién cobra.

   Todo lo grande se ve según `nivelCaza` (cazas.js): cinco niveles, de
   «Encargo» a «Cacería legendaria», con la clase `n1`…`n5`.
   ============================================================ */
import { escapeHtml } from "../util.js";
import { avatarMarco } from "./perfil-vista.js";
import { mezcla } from "./perfil.js";
import { nombreHtml } from "./tintas.js";
import { nombreCategoria, valorMarca, juegoDeCategoria } from "./perfil-tarjeta.js";
import { CAZA_MIN, NIVELES_CAZA, nivelCaza, cazasAbiertas, porReclamar, avisosCaza, resultadosDe, primero, categoriaCazable } from "./cazas.js";

const esc = escapeHtml;
const fmt = n => Math.round(n || 0).toLocaleString("es-CL");
const MONEDA = "🪙";
const TOP = 5;
/* La ruta del juego de una categoría (`#solo/<juego>`). */
const RUTA = { tetrisclub: "tetris", typeraceclub: "typerace", boxheadclub: "boxhead" };
export const rutaDeCategoria = c => { const j = juegoDeCategoria(c); return j ? "#solo/" + (RUTA[j] || j) : "#"; };
const CLAVE_RES = "jg.cz.res", CLAVE_BUSCADO = "jg.cz.buscado";
const lee = (st, k) => { try { return st.getItem(k); } catch (e) { return null; } };
const pon = (st, k, v) => { try { st.setItem(k, v); } catch (e) { /* opcional */ } };
const esPermiso = e => /permission/i.test(String(e && (e.code || e.message) || e));
const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Monedas que caen o saltan: más cuanto más grande el pozo. Cada una lleva
   su posición y su retraso en variables CSS (sin azar en cada repintado:
   la semilla es la clave, así un repintado no las cambia de lugar). */
function particulas(n, semilla, clase = "jg-cz-moneda") {
  let s = 0;
  for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => (s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296;
  let h = "";
  for (let i = 0; i < n; i++) h += `<i class="${clase}" style="--x:${(r() * 100).toFixed(1)}%;--y:${(r() * 100).toFixed(1)}%;--d:${(r() * 2.4).toFixed(2)}s;--v:${(0.8 + r() * 0.9).toFixed(2)};--g:${Math.round(r() * 360 - 180)}deg" aria-hidden="true"></i>`;
  return h;
}

/* La banda de alerta de las cacerías épicas y legendarias: un texto que
   corre entre dos franjas de peligro. */
function banda(texto) {
  const t = esc(texto);
  return `<p class="jg-cz-banda" aria-hidden="true"><span>${t} · ${t} · ${t} · ${t}</span></p>`;
}
const onda = `<i class="jg-cz-onda" aria-hidden="true"></i>`;
/* Los destellos ✦ que titilan sobre todo lo legendario. */
const destellos = (n, semilla) => particulas(n, "d" + semilla, "jg-cz-destello");
const ALERTA = { 4: "⚠ Alerta de cacería épica", 5: "👑 Cacería legendaria en curso" };

/* ctx = {fb, usuario() → {uid, name}|null, datos(fn) → apagar, perfil(uid),
   marco(uid), colorDe(uid), ir(hash), economia(d), monedasDe(uid, d),
   puedeMostrar() → si la vista admite una capa encima, suena(nombre),
   avisa(icono, título, detalle, monto)} */
export function crearCazas(ctx) {
  const { fb } = ctx;
  let d = null, eco = null, abiertas = [], muerto = false;
  const montados = new Set(), intentados = new Set();

  const quien = (uid, nombre) => {
    const p = mezcla({ nombre: nombre || "Jugador" }, ctx.perfil(uid));
    return { nombre: p.nombre || "Jugador", foto: p.foto, color: p.color || ctx.colorDe(uid) };
  };
  /* El nombre de una cuenta: su fila en esa tabla, o en cualquier otra
     (quien pone precio no siempre juega a eso), y encima su apodo. */
  const nombreEnDatos = uid => {
    for (const t of [...Object.values((d && d.solo) || {}), ...Object.values((d && d.ranks) || {})]) if (t && t[uid] && t[uid].nombre) return t[uid].nombre;
    return "";
  };
  const nombreDe = (uid, c) => { const f = c && d && d.solo && d.solo[c] && d.solo[c][uid]; return quien(uid, (f && f.nombre) || nombreEnDatos(uid)).nombre; };
  const nombreBtn = (uid, c) => { const n = nombreDe(uid, c); return `<b class="jg-cz-nm" translate="no" data-perfil="${esc(uid)}" data-nombre="${esc(n)}">${nombreHtml(uid, esc(n))}</b>`; };
  const marcaDe = o => valorMarca(o.c, { puntos: o.mp, tiempo: o.mt });

  /* ---------- el cartel ---------- */
  function filaHtml(o, i, yo) {
    const p = quien(o.q, nombreDe(o.q, o.c));
    const nv = o.nivel, tuyo = yo && o.q === yo;
    return `<li class="jg-cz-fila n${nv.n}${i === 0 ? " primera" : ""}${tuyo ? " tuya" : ""}">
      ${nv.n >= 3 ? `<span class="jg-cz-brillo" aria-hidden="true"></span>` : ""}${nv.n >= 5 ? destellos(7, o.k) : ""}
      <span class="jg-cz-pos" aria-hidden="true">${i + 1}</span>
      ${avatarMarco(p.foto, p.nombre, p.color, ctx.marco(o.q), nv.n >= 5 ? 46 : i === 0 ? 40 : 30, o.q)}
      <span class="jg-cz-que"><b translate="no" data-perfil="${esc(o.q)}" data-nombre="${esc(p.nombre)}">${nombreHtml(o.q, esc(p.nombre))}</b>
        <small>${esc(nombreCategoria(o.c))} · <span translate="no">${esc(marcaDe(o))}</span></small></span>
      <span class="jg-cz-pozo" title="${o.n} ${o.n === 1 ? "aporte" : "aportes"}"><em>${nv.icono} ${esc(nv.nombre)}</em><b><span class="cz-n">${fmt(o.pozo)}</span> ${MONEDA}</b>${o.n > 1 ? `<small>${o.n} cazadores ponen</small>` : ""}</span>
      <a class="jg-cz-ir" href="${rutaDeCategoria(o.c)}" title="${tuyo ? "Si te superas tú, te llevas la mitad" : `Supéralo en ${esc(nombreCategoria(o.c))}`}">▶ Jugar</a>
    </li>`;
  }
  function html() {
    const u = ctx.usuario();
    const cab = `<header class="jg-cz-cab"><span class="jg-cz-sello" aria-hidden="true">FICHADO</span>
      <span class="jg-cz-tit"><b>Récords fichados</b><small>Supéralos y te llevas el pozo</small></span>
      ${u ? `<button class="jg-cz-poner" type="button" data-cz-poner>🎯 Fichar</button>` : ""}</header>`;
    if (!u) return cab + `<p class="jg-cz-vacio">Inicia sesión para cazar récords fichados.</p>`;
    if (!d || !d.completo) return cab + `<p class="jg-cz-vacio">Buscando fichados…</p>`;
    if (!abiertas.length) return cab + `<p class="jg-cz-vacio">Nadie está fichado todavía. Ficha al n.º 1 que quieras ver caer.</p>`;
    const top = abiertas.slice(0, TOP), total = abiertas.reduce((a, o) => a + o.pozo, 0);
    const n1 = top[0].nivel.n;
    return cab + (n1 >= 4 ? banda(`${ALERTA[n1]} · ${fmt(top[0].pozo)} ${MONEDA} por ${nombreDe(top[0].q, top[0].c)}`) : "") + `<ol class="jg-cz-lista">${top.map((o, i) => filaHtml(o, i, u.uid)).join("")}</ol>
      <p class="jg-cz-pie">${abiertas.length} ${abiertas.length === 1 ? "récord fichado" : "récords fichados"} · <b>${fmt(total)} ${MONEDA}</b> en custodia</p>`;
  }
  let ultimoHtml = "";
  function pintaMontados() {
    const h = html();
    ultimoHtml = h;
    for (const el of montados) {
      if (!el.isConnected) { montados.delete(el); continue; }
      if (el._cz !== h) { el._cz = h; el.innerHTML = h; }
      el.classList.toggle("vacia", !abiertas.length);
      el.dataset.nivel = abiertas.length ? String(abiertas[0].nivel.n) : "0";
    }
  }
  function monta(el) { if (el) { montados.add(el); el._cz = ""; pintaMontados(); } }

  /* ---------- poner precio ---------- */
  let modal = null;
  function tablas() {
    const out = [];
    for (const [c, filas] of Object.entries((d && d.solo) || {})) {
      if (!categoriaCazable(c)) continue;
      const f = primero(filas);
      if (f) out.push({ c, f, nombre: nombreCategoria(c), pozo: abiertas.filter(o => o.c === c && o.q === f.uid && o.mp === f.puntos && o.mt === f.tiempo).reduce((a, o) => a + o.pozo, 0) });
    }
    return out.sort((a, b) => b.pozo - a.pozo || a.nombre.localeCompare(b.nombre, "es"));
  }
  function abrePoner(cat) {
    const u = ctx.usuario();
    if (!u || muerto) return;
    cierraPoner();
    const capa = document.createElement("div");
    capa.className = "jg-modal-capa jg-cz-capa-poner";
    capa.innerHTML = `<div class="jg-modal jg-cz-modal" role="dialog" aria-modal="true" aria-labelledby="jgCzT">
      <button class="jg-cz-x" type="button" aria-label="Cerrar">✕</button>
      <h2 id="jgCzT">🎯 Fichar un récord</h2>
      <p class="jg-cz-m-intro">Elige un n.º 1 del Solo Club y cuántas monedas pones. Quien lo supere primero se las lleva.</p>
      <div class="jg-cz-m-cuerpo"></div></div>`;
    document.body.appendChild(capa);
    modal = { capa, cat: cat || "", monto: 2000, filtro: "", confirma: false, enviando: false, error: "" };
    capa.addEventListener("click", ev => { if (ev.target === capa || ev.target.closest(".jg-cz-x")) cierraPoner(); });
    capa.addEventListener("input", ev => {
      if (ev.target.matches(".jg-cz-buscar")) { modal.filtro = ev.target.value; pintaPoner(true); }
      if (ev.target.matches(".jg-cz-monto")) { modal.monto = Math.floor(Number(ev.target.value) || 0); modal.confirma = false; pintaPoner(true); }
    });
    capa.addEventListener("click", ev => {
      const t = ev.target.closest("[data-cz-cat],[data-cz-monto],[data-cz-volver],[data-cz-publicar]");
      if (!t || !modal) return;
      if (t.dataset.czCat) { modal.cat = t.dataset.czCat; modal.confirma = false; modal.error = ""; pintaPoner(); }
      else if (t.dataset.czMonto) { modal.monto = Number(t.dataset.czMonto); modal.confirma = false; pintaPoner(); }
      else if ("czVolver" in t.dataset) { modal.cat = ""; modal.confirma = false; pintaPoner(); }
      else if ("czPublicar" in t.dataset) publica();
    });
    pintaPoner();
    const campo = capa.querySelector(".jg-cz-buscar");
    if (campo && !window.matchMedia("(pointer: coarse)").matches) campo.focus();
  }
  function cierraPoner() { if (modal) { modal.capa.remove(); modal = null; } }
  const teclaPoner = ev => { if (ev.key === "Escape" && modal) { ev.preventDefault(); cierraPoner(); } };
  document.addEventListener("keydown", teclaPoner);

  function saldo() {
    const u = ctx.usuario();
    if (!u || !d || !d.completo) return null;
    const m = ctx.monedasDe(u.uid, d);
    return { saldo: m.saldo, parada: !!m.parada };
  }
  function pintaPoner(soloDetalle) {
    if (!modal) return;
    const cuerpo = modal.capa.querySelector(".jg-cz-m-cuerpo"), u = ctx.usuario();
    if (!d || !d.completo) { cuerpo.innerHTML = `<p class="jg-nada">Cargando las tablas…</p>`; return; }
    const ts = tablas(), t = modal.cat && ts.find(x => x.c === modal.cat);
    if (!t) {
      const q = modal.filtro.trim().toLowerCase();
      void 0;
      const lista = ts.filter(x => !q || x.nombre.toLowerCase().includes(q) || nombreDe(x.f.uid, x.c).toLowerCase().includes(q)).slice(0, 80);
      const filas = lista.map(x => {
        const p = quien(x.f.uid, x.f.nombre);
        return `<button type="button" class="jg-cz-m-tabla" data-cz-cat="${esc(x.c)}">
          ${avatarMarco(p.foto, p.nombre, p.color, ctx.marco(x.f.uid), 26, x.f.uid)}
          <span><b>${esc(x.nombre)}</b><small><span translate="no">${esc(p.nombre)}</span> · <span translate="no">${esc(valorMarca(x.c, x.f))}</span></small></span>
          ${x.pozo ? `<em class="n${nivelCaza(x.pozo).n}">${fmt(x.pozo)} ${MONEDA}</em>` : ""}</button>`;
      }).join("");
      const html = filas || `<p class="jg-nada">Ninguna tabla coincide.</p>`;
      if (soloDetalle && cuerpo.querySelector(".jg-cz-m-lista")) { cuerpo.querySelector(".jg-cz-m-lista").innerHTML = html; return; }
      cuerpo.innerHTML = `<input class="inp jg-cz-buscar" type="search" placeholder="Busca un juego o a quién cazar…" aria-label="Buscar una tabla" value="${esc(modal.filtro)}">
        <div class="jg-cz-m-lista">${html}</div>`;
      return;
    }
    const s = saldo(), p = quien(t.f.uid, t.f.nombre), monto = modal.monto, nv = nivelCaza(Math.max(monto, CAZA_MIN));
    const tuyo = t.f.uid === u.uid;
    const falta = !s ? "Contando tus monedas…" : s.parada ? "Tu cuenta está parada: no puedes gastar." :
      !Number.isInteger(monto) || monto < CAZA_MIN ? `El mínimo es ${fmt(CAZA_MIN)} ${MONEDA}.` : monto > s.saldo ? `No te alcanza: tienes ${fmt(s.saldo)} ${MONEDA}.` : "";
    const detalle = `<div class="jg-cz-m-prev n${nv.n}">${nv.n >= 3 ? particulas(nv.n * 2, t.c + nv.n) : ""}
        <span class="jg-cz-m-niv">${nv.icono} ${esc(nv.nombre)}</span><b><span class="cz-n">${fmt(monto)}</span> ${MONEDA}</b>
        <small>${t.pozo ? `El pozo queda en ${fmt(t.pozo + Math.max(0, monto))} ${MONEDA}` : "Abre el pozo de este récord"}</small>
        ${(() => { const sig = NIVELES_CAZA.find(x => x.desde > t.pozo + monto); return sig ? `<em class="jg-cz-m-sube">Con ${fmt(sig.desde - t.pozo - monto)} ${MONEDA} más sube a ${sig.icono} ${esc(sig.nombre)}</em>` : `<em class="jg-cz-m-sube">Nivel máximo: la cacería más imponente</em>`; })()}</div>
      <ul class="jg-cz-m-reglas">${tuyo
        ? `<li>Es <b>tu</b> récord: si otro lo supera, se lleva todo.</li><li>Si lo superas tú, te vuelve todo.</li>`
        : `<li>Si otro lo supera, se lleva todo.</li><li>Si <b translate="no">${esc(p.nombre)}</b> se supera a sí mismo, se lleva la mitad y la otra mitad te vuelve.</li>`}
        <li><b>No se puede cancelar.</b> Las monedas quedan en custodia hasta que alguien lo supere.</li></ul>
      ${modal.error ? `<p class="jg-cz-m-error">${esc(modal.error)}</p>` : falta ? `<p class="jg-cz-m-error">${esc(falta)}</p>` : ""}`;
    if (soloDetalle && cuerpo.querySelector(".jg-cz-m-det")) {
      cuerpo.querySelector(".jg-cz-m-det").innerHTML = detalle;
      const b = cuerpo.querySelector("[data-cz-publicar]");
      if (b) { b.disabled = !!falta || modal.enviando; b.textContent = textoBoton(monto); b.className = `btn jg-cz-m-pub n${nv.n}${modal.confirma ? " confirma" : ""}`; }
      return;
    }
    cuerpo.innerHTML = `<button type="button" class="jg-cz-m-volver" data-cz-volver>← Otra tabla</button>
      <div class="jg-cz-m-elegida">${avatarMarco(p.foto, p.nombre, p.color, ctx.marco(t.f.uid), 48, t.f.uid)}
        <span><small>${esc(t.nombre)}</small><b translate="no">${esc(p.nombre)}</b><em translate="no">${esc(valorMarca(t.c, t.f))}</em></span></div>
      <label class="jg-cz-m-cuanto">¿Cuántas monedas pones?
        <input class="inp jg-cz-monto" type="number" inputmode="numeric" min="${CAZA_MIN}" step="100" value="${monto}"></label>
      <div class="jg-cz-m-chips">${[500, 2000, 10000, 25000, 50000].map(n => `<button type="button" data-cz-monto="${n}" class="n${nivelCaza(n).n}${n === monto ? " sel" : ""}"${s && n > s.saldo ? " disabled" : ""}>${fmt(n)}</button>`).join("")}</div>
      <div class="jg-cz-m-det">${detalle}</div>
      <button type="button" class="btn jg-cz-m-pub n${nv.n}${modal.confirma ? " confirma" : ""}" data-cz-publicar${falta || modal.enviando ? " disabled" : ""}>${textoBoton(monto)}</button>`;
  }
  const textoBoton = monto => modal && modal.enviando ? "Publicando…" : modal && modal.confirma ? `Sí, pagar ${fmt(monto)} ${MONEDA} (sin vuelta atrás)` : `Fichar · ${fmt(monto)} ${MONEDA}`;

  async function publica() {
    const u = ctx.usuario();
    if (!modal || !u || modal.enviando) return;
    const t = tablas().find(x => x.c === modal.cat), s = saldo();
    if (!t || !s || s.parada || modal.monto < CAZA_MIN || modal.monto > s.saldo) return;
    if (!modal.confirma) { modal.confirma = true; pintaPoner(); return; }
    modal.enviando = true; pintaPoner();
    try {
      await fb.publicaCaza(u.uid, { c: t.c, q: t.f.uid, p: modal.monto, mp: t.f.puntos, mt: t.f.tiempo });
      cierraPoner();
      if (ctx.suena) ctx.suena("gana");
    } catch (e) {
      if (!modal) return;
      modal.enviando = false; modal.confirma = false;
      modal.error = esPermiso(e) ? "No se pudo publicar: la marca cambió hace un momento, o las cacerías esperan que se publiquen las reglas de Firebase. No se cobró nada."
        : "No se pudo publicar. Revisa la conexión. No se cobró nada.";
      pintaPoner();
    }
  }

  /* ---------- las capas grandes: el buscado y el cobro ---------- */
  let capa = null, colaCapas = [];
  function muestraCapa(h, nivel, alSalir) {
    colaCapas.push({ h, nivel, alSalir });
    if (!capa) siguienteCapa();
  }
  function siguienteCapa() {
    const x = colaCapas.shift();
    // Sin más capas, lo que esperaba (los anuncios de arriba) sale ahora.
    if (!x || muerto) { capa = null; if (!muerto) setTimeout(revisa, 500); return; }
    capa = document.createElement("div");
    capa.className = `jg-cz-capa n${x.nivel}${reduce() ? " quieta" : ""}`;
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-modal", "true");
    capa.innerHTML = x.h;
    document.body.appendChild(capa);
    const fin = () => { if (!capa) return; capa.classList.add("sale"); const c = capa; setTimeout(() => { c.remove(); if (capa === c) siguienteCapa(); }, 350); };
    capa.addEventListener("click", ev => {
      const a = ev.target.closest("[data-cz-cierra],a[href]");
      if (ev.target === capa || a) { if (x.alSalir) x.alSalir(); fin(); }
    });
    cuentaArriba(capa.querySelector("[data-cz-cuenta]"));
    if (ctx.suena) ctx.suena(x.nivel >= 3 ? "gana" : "entra");
    if (x.nivel >= 5) lluvia();
    /* El foco va a la carta, sin desplazar: en «Ahora no» lo marcaba como
       elegido, y enfocar movía la capa (las monedas la hacen más alta). */
    const carta = capa.querySelector(".jg-cz-poster");
    if (carta) { carta.tabIndex = -1; setTimeout(() => carta.focus({ preventScroll: true }), 50); }
  }
  const teclaCapa = ev => { if (ev.key === "Escape" && capa && !modal) { const b = capa.querySelector("[data-cz-cierra]"); if (b) b.click(); } };
  document.addEventListener("keydown", teclaCapa);
  /* La cifra sube desde cero, más rato cuanto más grande. */
  function cuentaArriba(el) {
    if (!el) return;
    const fin = Number(el.dataset.czCuenta) || 0, dur = reduce() ? 0 : Math.min(2600, 700 + Math.log10(fin + 10) * 380), t0 = performance.now();
    const paso = ahora => {
      const k = dur ? Math.min(1, (ahora - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(fin * e);
      if (k < 1 && el.isConnected) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  function capaBuscado(mias, u) {
    const pozo = mias.reduce((a, o) => a + o.pozo, 0), nv = nivelCaza(pozo), p = quien(u.uid, nombreEnDatos(u.uid) || u.name);
    const cazadores = new Set(mias.flatMap(o => o.aportes.map(a => a.u)));
    return `${onda}${particulas(8 + nv.n * 7, "b" + u.uid + pozo)}<div class="jg-cz-poster">
      ${nv.n >= 4 ? banda(ALERTA[nv.n]) : ""}
      ${nv.n === 4 ? `<div class="jg-cz-llamas" aria-hidden="true"></div>` : ""}
      ${nv.n >= 5 ? destellos(12, u.uid) : ""}
      <p class="jg-cz-se">FICHADO</p>
      <div class="jg-cz-foto">${nv.n >= 5 ? `<span class="jg-cz-corona" aria-hidden="true">👑</span>` : ""}${avatarMarco(p.foto, p.nombre, p.color, ctx.marco(u.uid), 112, u.uid)}</div>
      <p class="jg-cz-quien" translate="no">${nombreHtml(u.uid, esc(p.nombre))}</p>
      <p class="jg-cz-por">${mias.length === 1 ? "por su récord en" : `por ${mias.length} récords:`}</p>
      <ul class="jg-cz-tablas">${mias.slice(0, 3).map(o => `<li>${esc(nombreCategoria(o.c))} · <span translate="no">${esc(marcaDe(o))}</span>${mias.length > 1 ? ` — <b>${fmt(o.pozo)} ${MONEDA}</b>` : ""}</li>`).join("")}${mias.length > 3 ? `<li>y ${mias.length - 3} más</li>` : ""}</ul>
      <p class="jg-cz-recompensa"><small>${nv.icono} ${esc(nv.nombre)} · recompensa</small><b><span class="cz-n" data-cz-cuenta="${pozo}">0</span> ${MONEDA}</b></p>
      <p class="jg-cz-nota">${cazadores.size} ${cazadores.size === 1 ? "cazador puso" : "cazadores pusieron"} precio a tu cabeza. Si alguien te supera, se lo lleva.
        Si te superas tú, te quedas con la mitad.</p>
      <p class="jg-cz-meta">Supera <b translate="no">${esc(marcaDe(mias[0]))}</b></p>
      <div class="jg-cz-botones"><a class="btn jg-cz-defiende" href="${rutaDeCategoria(mias[0].c)}">▶ Jugar</a>
        <button class="btn btn-ghost" type="button" data-cz-cierra>Ahora no</button></div>
    </div>`;
  }
  function capaCobro(r) {
    const nv = nivelCaza(r.mio);
    const titulo = r.tipo === "cobrada" ? "¡RECOMPENSA COBRADA!" : r.tipo === "defendida" ? "¡RÉCORD DEFENDIDO!" : "¡TU RÉCORD, MÁS ALTO!";
    const texto = r.tipo === "cobrada" ? `Superaste a ${nombreBtn(r.q, r.c)} en ${esc(nombreCategoria(r.c))}.`
      : r.tipo === "defendida" ? `Te superaste a ti mismo en ${esc(nombreCategoria(r.c))}: te llevas la mitad del precio que te pusieron.`
      : `Rompiste tu propio récord en ${esc(nombreCategoria(r.c))}: te vuelve lo que pusiste.`;
    return `${onda}${particulas(12 + nv.n * 8, "c" + r.id)}<div class="jg-cz-poster cobro">
      ${nv.n >= 4 ? banda(r.tipo === "cobrada" ? "💥 RECOMPENSA COBRADA" : "🛡️ RÉCORD DEFENDIDO") : ""}
      ${nv.n === 4 ? `<div class="jg-cz-llamas" aria-hidden="true"></div>` : ""}
      <p class="jg-cz-se">${titulo}</p>
      <p class="jg-cz-recompensa"><small>${nv.icono} ${esc(nv.nombre)}</small><b><span class="cz-n">+</span><span class="cz-n" data-cz-cuenta="${r.mio}">0</span> ${MONEDA}</b></p>
      <p class="jg-cz-nota">${texto}</p>
      <div class="jg-cz-botones"><button class="btn" type="button" data-cz-cierra>¡Genial!</button></div>
    </div>`;
  }

  /* ---------- con cada lectura ---------- */
  function alDatos(x) {
    if (muerto) return;
    d = x;
    const u = ctx.usuario();
    if (!d || !d.completo) { abiertas = []; pintaMontados(); return; }
    eco = ctx.economia(d);
    abiertas = cazasAbiertas(d, eco);
    pintaMontados();
    if (!u) return;
    /* El reclamo: lo que esta cuenta supera (o lo suyo que ya no tiene récord). */
    for (const id of porReclamar(d, eco, u.uid)) {
      if (intentados.has(id)) continue;
      intentados.add(id);
      fb.reclamaCaza(id, u.uid).catch(e => console.warn("[cazas] reclamo", id, e && e.code));
    }
    revisa();
  }
  /* Las capas grandes, solo en una vista que las admite (no encima de una
     partida ni de un juego del club): juegos-main la vuelve a llamar al
     cambiar de vista. */
  function revisa() {
    const u = ctx.usuario();
    if (muerto || !u || !d || !d.completo || !eco || (ctx.puedeMostrar && !ctx.puedeMostrar())) return;
    avisaResultados(u);
    avisaBuscado(u);
    anuncia(u);
  }
  function avisaResultados(u) {
    const ahora = fb.ahora(), k = CLAVE_RES + "." + u.uid;
    let visto = Number(lee(localStorage, k));
    if (!Number.isFinite(visto) || !visto) { visto = ahora - 2 * 24 * 3600 * 1000; pon(localStorage, k, String(visto)); }
    const rs = resultadosDe(d, eco, u.uid, visto);
    if (!rs.length) return;
    pon(localStorage, k, String(Math.max(...rs.map(r => r.at))));
    for (const r of rs) {
      const gane = r.w === u.uid && r.tipo !== "anulada" && r.tipo !== "recuperada";
      if (gane && r.mio) { muestraCapa(capaCobro(r), nivelCaza(r.mio).n); continue; }
      if (!ctx.avisa) continue;
      if (r.tipo === "recuperada") ctx.avisa("↩️", "Recuperaste tu cacería", `Superaste tú mismo a ${nombreDe(r.q, r.c)} en ${nombreCategoria(r.c)}.`, r.mio);
      else if (r.tipo === "anulada") ctx.avisa("↩️", "Te volvió una cacería", `El récord de ${nombreDe(r.q, r.c)} en ${nombreCategoria(r.c)} ya no está en la tabla.`, r.mio);
      else if (r.tipo === "defendida") ctx.avisa("🛡️", `${nombreDe(r.q, r.c)} defendió su récord`, `Se llevó la mitad; la otra mitad te vuelve.`, r.mio);
      else if (r.tipo === "cobrada") ctx.avisa("🎯", `${nombreDe(r.w, r.c)} cobró tu cacería`, `Superó a ${nombreDe(r.q, r.c)} en ${nombreCategoria(r.c)}.`, 0);
    }
  }
  /* El buscado lo ve al entrar: una vez por sesión, y otra vez si le
     ponen un precio nuevo. */
  function avisaBuscado(u) {
    const mias = abiertas.filter(o => o.q === u.uid);
    if (!mias.length) return;
    const firma = mias.flatMap(o => o.aportes.map(a => a.id)).sort().join(",");
    const k = CLAVE_BUSCADO + "." + u.uid, previa = lee(sessionStorage, k);
    if (previa === firma) return;
    const nuevos = previa ? firma.split(",").filter(id => !previa.split(",").includes(id)).length : 1;
    pon(sessionStorage, k, firma);
    if (nuevos) muestraCapa(capaBuscado(mias, u), nivelCaza(mias.reduce((a, o) => a + o.pozo, 0)).n);
  }

  /* ---------- los avisos del chat general ---------- */
  function partes(a) {
    const nv = a.nivel;
    const tabla = `${esc(nombreCategoria(a.c))} <span translate="no">(${esc(valorMarca(a.c, { puntos: a.mp, tiempo: a.mt }))})</span>`;
    const [cab, texto] = a.tipo === "pone" ? [`${nv.icono} ${esc(nv.nombre)}`, a.uid === a.q
        ? `${nombreBtn(a.uid, a.c)} le puso precio a <b>su propio</b> récord en ${tabla}. ¿Quién se atreve?`
        : `${nombreBtn(a.uid, a.c)} le puso precio al récord de ${nombreBtn(a.q, a.c)} en ${tabla}.`]
      : a.tipo === "cobrada" ? [`💥 ¡Recompensa cobrada!`, `${nombreBtn(a.uid, a.c)} superó a ${nombreBtn(a.q, a.c)} en ${tabla} y se llevó el pozo.`]
      : a.tipo === "recuperada" ? [`↩️ Cacería recuperada`, `${nombreBtn(a.uid, a.c)} superó él mismo el récord de ${nombreBtn(a.q, a.c)} en ${tabla} y recuperó lo que había puesto.`]
      : a.tipo === "defendida" ? [`🛡️ Récord defendido`, `${nombreBtn(a.q, a.c)} se superó a sí mismo en ${tabla} y se quedó con la mitad.`]
      : [`🏆 Récord propio roto`, `${nombreBtn(a.q, a.c)} rompió su propio récord en ${tabla} y recuperó lo puesto.`];
    const ir = a.tipo === "pone" ? `<a class="jg-cz-av-ir" href="${rutaDeCategoria(a.c)}">▶ Jugar</a>` : "";
    const alerta = nv.n >= 4 ? banda(a.tipo === "pone" ? ALERTA[nv.n] : a.tipo === "cobrada" ? "💥 RECOMPENSA COBRADA" : "🛡️ RÉCORD DEFENDIDO") : "";
    return { cab, texto, ir, alerta };
  }
  function avisoHtml(a, ahora) {
    const nv = a.nivel, edad = Math.max(0, (ahora - a.at) / 1000).toFixed(1), x = partes(a);
    return `<div class="jg-cz-av n${nv.n} t-${a.tipo}" style="--edad:${edad}s">
      ${onda}${nv.n >= 3 ? `<span class="jg-cz-brillo" aria-hidden="true"></span>` : ""}${nv.n >= 5 ? destellos(9, a.id) : ""}${particulas(nv.n * 5, a.id, "jg-cz-chispa")}
      ${x.alerta}
      <p class="jg-cz-av-cab"><span>${x.cab}</span><b><span class="cz-n">${fmt(a.p)}</span> ${MONEDA}</b></p>
      <p class="jg-cz-av-tx">${x.texto}</p>
      ${x.ir}
    </div>`;
  }

  /* ---------- el anuncio de arriba ----------
     Una cacería de Gran para arriba (o su cobro) baja como cartel por la
     parte de arriba de la pantalla, una vez por navegador y solo mientras
     es reciente; la legendaria trae además un destello y lluvia de monedas.
     El que cobra ya tiene su pantalla, y el buscado la suya. */
  const CLAVE_ANUNCIOS = "jg.cz.anuncios", ANUNCIO_FRESCO = 10 * 60 * 1000, ANUNCIO_MS = { 3: 6500, 4: 8500, 5: 14000 };
  let anuncio = null;
  const colaAnuncios = [];
  function anuncia(u) {
    if (capa) return;   // no encima de la pantalla del buscado o del cobro
    const ahora = fb.ahora();
    let vistos;
    try { vistos = JSON.parse(lee(localStorage, CLAVE_ANUNCIOS) || "[]"); } catch (e) { vistos = []; }
    if (!Array.isArray(vistos)) vistos = [];
    const nuevos = avisosCaza(d, eco, ahora).filter(a => a.nivel.n >= 3 && ahora - a.at < ANUNCIO_FRESCO && !vistos.includes(a.id) &&
      !(a.tipo !== "pone" && a.uid === u.uid) && !(a.tipo === "pone" && a.q === u.uid));
    if (!nuevos.length) return;
    pon(localStorage, CLAVE_ANUNCIOS, JSON.stringify(vistos.concat(nuevos.map(a => a.id)).slice(-60)));
    colaAnuncios.push(...nuevos.sort((x, y) => y.p - x.p).slice(0, 3));
    if (!anuncio) siguienteAnuncio();
  }
  function siguienteAnuncio() {
    const a = colaAnuncios.shift();
    if (!a || muerto) { anuncio = null; return; }
    const nv = a.nivel, x = partes(a);
    const el = anuncio = document.createElement("div");
    el.className = `jg-cz-anuncio n${nv.n}`;
    el.setAttribute("role", "status");
    /* La legendaria oscurece la página detrás, con luz dorada. */
    const velo = nv.n >= 5 ? document.createElement("div") : null;
    if (velo) { velo.className = "jg-cz-velo"; velo.setAttribute("aria-hidden", "true"); velo.innerHTML = destellos(26, "v" + a.id); document.body.appendChild(velo); }
    el.innerHTML = `<span class="jg-cz-brillo" aria-hidden="true"></span>${nv.n >= 5 ? destellos(10, a.id) : ""}${x.alerta || banda(`${nv.icono} ${nv.nombre.toUpperCase()}`)}
      <span class="jg-cz-an-ico" aria-hidden="true">${nv.icono}</span>
      <span class="jg-cz-an-tx"><small>${x.cab}</small>${x.texto}</span>
      <span class="jg-cz-an-der"><b><span class="cz-n" data-cz-cuenta="${a.p}">0</span> ${MONEDA}</b>${a.tipo === "pone" ? `<small class="jg-cz-meta">Supera <b translate="no">${esc(valorMarca(a.c, { puntos: a.mp, tiempo: a.mt }))}</b></small>` : ""}${x.ir}</span>`;
    document.body.appendChild(el);
    cuentaArriba(el.querySelector("[data-cz-cuenta]"));
    if (ctx.suena) ctx.suena(nv.n >= 4 ? "gana" : "entra");
    if (nv.n >= 5) lluvia();
    let t = 0;
    const fin = () => {
      clearTimeout(t);
      if (!el.isConnected) return;
      el.classList.add("sale");
      if (velo) velo.classList.add("sale");
      setTimeout(() => { el.remove(); if (velo) velo.remove(); if (anuncio === el) siguienteAnuncio(); }, 420);
    };
    if (velo) velo.addEventListener("click", fin);
    t = setTimeout(fin, ANUNCIO_MS[nv.n] || 6500);
    el.addEventListener("click", ev => { if (!ev.target.closest("[data-perfil]")) fin(); });
    el.addEventListener("mouseenter", () => clearTimeout(t));
    el.addEventListener("mouseleave", () => { clearTimeout(t); t = setTimeout(fin, 2500); });
  }
  /* La legendaria: destello de pantalla y monedas cayendo de arriba. */
  function lluvia() {
    if (reduce()) return;
    const l = document.createElement("div");
    l.className = "jg-cz-lluvia";
    l.setAttribute("aria-hidden", "true");
    l.innerHTML = particulas(44, "ll" + Date.now());
    if (capa) capa.insertBefore(l, capa.querySelector(".jg-cz-poster")); else document.body.appendChild(l);
    setTimeout(() => l.remove(), 5200);
  }
  function avisos() {
    if (!d || !d.completo || !eco) return [];
    const ahora = fb.ahora();
    return avisosCaza(d, eco, ahora).map(a => ({ id: a.id, at: a.at, firma: a.id + ":" + a.p + ":" + nombreDe(a.uid, a.c) + ":" + nombreDe(a.q, a.c), html: avisoHtml(a, ahora) }));
  }

  /* ---------- clics ---------- */
  const alClic = ev => {
    const b = ev.target.closest && ev.target.closest("[data-cz-poner]");
    if (b) { ev.preventDefault(); abrePoner(b.dataset.czPoner || ""); }
  };
  document.addEventListener("click", alClic);

  const offDatos = ctx.datos(alDatos);
  return {
    monta, html: () => ultimoHtml || html(), avisos, abrePoner, revisa,
    destruir() {
      muerto = true;
      if (offDatos) offDatos();
      document.removeEventListener("click", alClic);
      document.removeEventListener("keydown", teclaPoner);
      document.removeEventListener("keydown", teclaCapa);
      cierraPoner();
      if (capa) capa.remove();
      if (anuncio) anuncio.remove();
      document.querySelectorAll(".jg-cz-velo").forEach(v => v.remove());
      colaAnuncios.length = 0;
    }
  };
}

export { NIVELES_CAZA };
