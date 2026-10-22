/* Los rieles del salón: en un PC ancho, a la izquierda las mejores
   partidas del día de cuatro juegos del club, en bucle, con quien las
   jugó (cuáles cuatro cambia cada día: `alineacionDelDia`, los más
   jugados casi siempre y el resto rotando); a la derecha el chat general. En una pantalla más angosta (y en
   el celular) las repeticiones no salen y el chat es un botón 💬 que
   abre un panel (una hoja desde abajo en el celular). Lo puro está en
   rieles-datos.js y las repeticiones en repeticion.js.

   Cuelgan de <body> y se muestran por CSS: `html.jg-rieles` (lo pone
   `pon(true)` en las vistas de menú) más el ancho (`@media` en
   juegos.html, el mismo corte que `ANCHO`). Fuera de esas vistas —una
   partida, un juego del club, los sobres— no hay riel de repeticiones,
   pero **el chat general sigue**: es la burbuja 💬 de abajo, con su
   cuenta roja de lo no leído (`html.jg-cg-flota`, que pone esto cuando el
   chat no va acoplado al riel). La pantalla completa de un juego la
   esconde por CSS (`jg-inm`, `jg-club-inm`, `jg-club-pleno`…).

   **Los super chats** (rieles-datos.js, `SUPER_CHAT`) se compran con
   monedas desde el mismo formulario (✦): duran más y llevan un contorno
   propio. La economía los cobra; `ctx.superPagado` dice si el de un
   mensaje se pudo pagar.

   **Lo que se reproduce se comprueba antes.** Cada prueba pasa por el
   mismo verificador antitrampas que la aceptó al guardarla
   (`verificaClub`, con el uid de su dueño): una fila escrita a mano en la
   base, con una prueba que no cuadra, no llega a la pantalla del salón y
   se prueba con la siguiente. Si hoy (ni nunca) se guardó ninguna, el
   riel repite el récord histórico de la tabla del club, cuya prueba ya
   vive en `soloPruebas`. */
import { escapeHtml } from "../util.js";
import { avatarMarco } from "./perfil-vista.js";
import { mezcla } from "./perfil.js";
import { verificaClub } from "./solo/verifica.js";
import { crearRepro } from "./repeticion.js";
import {
  alineacionDelDia, etiquetaDia, PAUSA_FINAL_MS, formatoMarca,
  CHAT_VENTANA_MS, CHAT_LARGO, CHAT_MAX, CHAT_VIEJO_MS, chatVisibles, esperaChat, limpiaChat, sinLeer,
  SUPER_CHAT, SUPER_MAX_MS, nivelSuper, quedaSuper
} from "./rieles-datos.js";
import { nombreHtml } from "./tintas.js";

/* Alto / ancho de cada escena (repeticion.js: `aspecto`), para repartir el
   riel antes de que llegue la partida. */
const ASPECTO = { tetris: 1.01, snake: 0.89, sortem: 0.65, minas: 0.95, dosmil: 1.22 };
/* El corte de «PC ancho». Debe coincidir con el `@media` de juegos.html. */
export const ANCHO = "(min-width: 1400px)";
const CUADRO_MS = 33, PIE_MS = 400, RELEE_CHAT_MS = 10 * 60 * 1000, REPINTA_CHAT_MS = 15000;
const CLAVE_VISTO = "jg.chatG.visto";

const leeVisto = () => { try { return Number(localStorage.getItem(CLAVE_VISTO)) || 0; } catch (e) { return 0; } };
const ponVisto = v => { try { localStorage.setItem(CLAVE_VISTO, String(v)); } catch (e) { /* opcional */ } };
const esPermiso = e => /permission/i.test(String(e && (e.code || e.message) || e));

/* ctx = {fb, usuario() → {uid, name}|null, perfil(uid), marco(uid),
   colorDe(uid), dia() → día de Chile de hoy, popular() → juego → cuánto
   se juega, saldo() → {saldo, parada}|null, superPagado(uid, clave) →
   true/false/null (aún no se sabe), alDatos(fn) → apagar: avisa cuando
   cambia la economía} */
export function crearRieles(ctx) {
  const { fb } = ctx;
  const ancho = window.matchMedia(ANCHO);
  let activo = false, chatActivo = false, quien = "", raf = 0, ultimoCuadro = 0, ultimoPie = 0, muerto = false;

  /* ---------- el armado ---------- */
  const izq = document.createElement("aside");
  izq.className = "jg-riel jg-riel-izq";
  izq.setAttribute("aria-label", "Mejores partidas del día");
  izq.innerHTML = `<header class="jg-riel-cab"><span class="jg-vivo" aria-hidden="true"></span><h2>Mejores partidas</h2><small>del día · en bucle</small></header>
    <div class="jg-rp-lista"></div>`;
  const lista = izq.querySelector(".jg-rp-lista");

  const chat = document.createElement("aside");
  chat.className = "jg-riel jg-riel-der jg-cg";
  chat.id = "jgChatG";
  chat.setAttribute("aria-label", "Chat general");
  chat.innerHTML = `<header class="jg-riel-cab"><span class="jg-vivo" aria-hidden="true"></span><h2>Chat general</h2><small>últimos 15 min</small>
      <button class="jg-cg-cierra" type="button" aria-label="Cerrar el chat">✕</button></header>
    <div class="jg-cg-lista" translate="no" aria-live="polite"></div>
    <p class="jg-cg-nota" aria-live="polite"></p>
    <div class="jg-cg-super" role="radiogroup" aria-label="Tipo de mensaje" hidden></div>
    <form class="jg-cg-form" autocomplete="off">
      <button class="jg-cg-sbtn" type="button" aria-expanded="false" aria-label="Super chat: un mensaje que dura más y se ve distinto" title="Super chat">✦</button>
      <input class="inp" maxlength="${CHAT_LARGO}" placeholder="Escribe a todo el salón…" aria-label="Mensaje para el chat general">
      <button class="btn jg-cg-enviar" type="submit">Enviar</button>
    </form>`;
  const chatLista = chat.querySelector(".jg-cg-lista"), chatNota = chat.querySelector(".jg-cg-nota");
  const chatForm = chat.querySelector(".jg-cg-form"), chatCampo = chatForm.querySelector("input"), chatBtn = chatForm.querySelector(".jg-cg-enviar");
  const superCaja = chat.querySelector(".jg-cg-super"), superBtn = chatForm.querySelector(".jg-cg-sbtn");

  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "jg-cg-fab";
  fab.setAttribute("aria-label", "Abrir el chat general");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor"/></svg><b class="jg-cg-n" hidden></b>`;
  const fabN = fab.querySelector(".jg-cg-n");
  const fondo = document.createElement("div");
  fondo.className = "jg-cg-fondo";

  document.body.append(izq, chat, fondo, fab);

  /* ---------- las repeticiones ----------
     Los cuatro juegos de hoy. La lista se rehace sola al cambiar el día
     (o si la popularidad que llegó reordena la alineación). */
  let tarjetas = [], firmaLinea = "";
  function armaLinea() {
    const reps = alineacionDelDia(ctx.dia(), ctx.popular ? ctx.popular() : null);
    const firma = reps.map(r => r.cat).join(",");
    if (firma === firmaLinea) return false;
    for (const t of tarjetas) { if (t.off) t.off(); t.gen++; }
    firmaLinea = firma;
    lista.innerHTML = "";
    tarjetas = reps.map(tarjeta);
    return true;
  }
  function tarjeta(rep) {
    const el = document.createElement("article");
    el.className = "jg-rp cargando";
    el.dataset.cat = rep.cat;
    el.style.flexGrow = String(ASPECTO[rep.juego] || 1);
    el.innerHTML = `<div class="jg-rp-cab"><a href="${rep.ruta}" title="Jugar a ${escapeHtml(rep.titulo)}"><b>${escapeHtml(rep.titulo)}</b><span>${escapeHtml(rep.modo)}</span></a><span class="jg-rp-quien"></span></div>
      <div class="jg-rp-lienzo" title="Pausar o seguir"><canvas aria-hidden="true"></canvas>
        <button class="jg-rp-pausa" type="button" aria-label="Seguir la repetición">▶</button>
        <p class="jg-rp-msg">Buscando la mejor partida…</p></div>`;
    lista.appendChild(el);
    const t = {
      rep, el, canvas: el.querySelector("canvas"), msg: el.querySelector(".jg-rp-msg"), quien: el.querySelector(".jg-rp-quien"),
      pausaBtn: el.querySelector(".jg-rp-pausa"), origen: "",
      off: null, gen: 0, repro: null, entrada: null, v: 1, t0: 0, pausado: false, enPausa: 0, pieFirma: "", w: 0, h: 0
    };
    t.pausaBtn.onclick = () => pausa(t, !t.pausado);
    el.querySelector(".jg-rp-lienzo").addEventListener("click", ev => { if (ev.target === t.canvas) pausa(t, !t.pausado); });
    return t;
  }
  /* Lo comprobado no se vuelve a comprobar: la misma fila llega en cada
     cambio de la consulta. */
  const comprobadas = new Map();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function pausa(t, si) {
    if (!t.repro || t.pausado === si) return;
    const ahora = performance.now();
    if (si) t.enPausa = ahora; else t.t0 += ahora - t.enPausa;
    t.pausado = si;
    t.el.classList.toggle("pausada", si);
    pintaTarjeta(t, ahora, true);
  }

  async function valida(rep, fila) {
    const clave = `${rep.cat}:${fila.uid}:${fila.o ?? fila.partida}:${fila.p}:${fila.t}`;
    if (comprobadas.has(clave)) return comprobadas.get(clave);
    let prueba = null;
    try { prueba = JSON.parse(fila.d); } catch (e) { prueba = null; }
    let ok = null;
    if (prueba) {
      const motivo = await verificaClub(rep.juego, { categoria: rep.cat, puntos: fila.p, tiempo: fila.t, partida: "repeticion" }, prueba, { uid: fila.uid });
      if (!motivo) ok = crearRepro(rep.juego, prueba) ? prueba : null;
      else console.warn("[rieles] repetición descartada", rep.cat, fila.uid, motivo);
    }
    comprobadas.set(clave, ok);
    return ok;
  }

  /* El récord de siempre, cuando nadie guardó todavía una partida del día
     (o antes de publicar las reglas de `repeticiones`). */
  async function historico(rep) {
    const filas = (await fb.leerSolo(rep.cat)).sort((a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo || a.uid.localeCompare(b.uid));
    for (const f of filas.slice(0, 3)) {
      if (!f.partida) continue;
      const pr = await fb.leerPruebaSolo(rep.cat, f.uid, f.partida).catch(() => null);
      if (!pr || typeof pr.d !== "string") continue;
      const fila = { uid: f.uid, n: f.nombre, p: f.puntos, t: f.tiempo, d: pr.d, partida: f.partida };
      const prueba = await valida(rep, fila);
      if (prueba) return { fila, prueba };
    }
    return null;
  }

  async function elige(t, filas, error) {
    const gen = ++t.gen;
    let elegida = null, origen = "dia";
    for (const f of filas || []) {
      const prueba = await valida(t.rep, f);
      if (gen !== t.gen) return;
      if (prueba) { elegida = { fila: f, prueba }; break; }
    }
    if (!elegida) {
      origen = "record";
      elegida = await historico(t.rep).catch(() => null);
      if (gen !== t.gen) return;
    }
    if (!elegida) {
      t.repro = null; t.entrada = null;
      t.el.classList.remove("cargando");
      t.el.classList.add("vacia");
      t.msg.innerHTML = (error && esPermiso(error) ? "Las repeticiones esperan que se publiquen las reglas de Firebase." : "Nadie ha jugado todavía. ¡Estrena la tabla!") +
        `<a class="jg-rp-jugar" href="${t.rep.ruta}">Jugar ahora →</a>`;
      t.quien.innerHTML = "";
      t.pieFirma = "";
      limpiaLienzo(t);
      return;
    }
    const { fila, prueba } = elegida;
    const firma = `${fila.uid}:${fila.p}:${fila.t}:${fila.o || ""}`;
    t.el.classList.remove("cargando", "vacia");
    t.msg.textContent = "";
    t.origen = origen === "record" ? "Récord histórico" : etiquetaDia(fila.dia, ctx.dia());
    if (t.entrada && t.entrada.firma === firma && t.repro) return;
    t.repro = crearRepro(t.rep.juego, prueba);
    t.entrada = { uid: fila.uid, n: fila.n, p: fila.p, t: fila.t, firma };
    t.el.style.flexGrow = String(t.repro.aspecto);
    t.t0 = performance.now();
    t.pieFirma = "";
    /* Con «reducir movimiento» la tarjeta se queda quieta en el tablero
       final; ▶ la pone en marcha. */
    if (reduce.matches || t.pausado) {
      t.enPausa = t.t0; t.t0 -= t.repro.dur; t.pausado = true;
      t.el.classList.add("pausada");
    }
    pintaTarjeta(t, performance.now(), true);
  }

  function limpiaLienzo(t) {
    const g = t.canvas.getContext("2d");
    if (g) g.clearRect(0, 0, t.canvas.width, t.canvas.height);
  }

  /* El instante de la partida que toca ahora: el bucle es la partida,
     a su velocidad real, más una pausa con el tablero final. */
  function instante(t, ahora) {
    const reloj = (t.pausado ? t.enPausa : ahora) - t.t0;
    const vuelta = t.repro.dur + PAUSA_FINAL_MS;
    if (reloj >= vuelta) { t.t0 += Math.floor(reloj / vuelta) * vuelta; return instante(t, ahora); }
    return Math.min(t.repro.dur, reloj);
  }

  function pintaTarjeta(t, ahora, pie) {
    if (!t.repro) return;
    const caja = t.canvas.parentElement;
    const w = caja.clientWidth, h = caja.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (t.w !== w || t.h !== h || t.dpr !== dpr) {
      t.w = w; t.h = h; t.dpr = dpr;
      t.canvas.width = Math.round(w * dpr); t.canvas.height = Math.round(h * dpr);
      t.canvas.style.width = w + "px"; t.canvas.style.height = h + "px";
    }
    const ms = instante(t, ahora);
    t.repro.en(ms);
    const g = t.canvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, t.canvas.width, t.canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Lo que en el juego se mueve solo (la cuadrícula de sortEm, la fruta
    // que late) sigue moviéndose con la repetición en pausa.
    t.repro.pinta(g, w, h, ahora / 1000);
    if (pie) pintaPie(t);
  }

  /* Arriba de la escena, quién la jugó y su marca final; el «hoy, ayer,
     récord» va en el título, para no cargar la línea. */
  function pintaPie(t) {
    const e = t.entrada;
    const p = mezcla({ nombre: e.n || "Jugador" }, ctx.perfil(e.uid));
    const nombre = p.nombre || "Jugador";
    const final = formatoMarca(t.rep, e.p, e.t);
    const firma = [nombre, p.foto, p.color, ctx.marco(e.uid), final, t.origen].join("|");
    if (firma === t.pieFirma) return;
    t.pieFirma = firma;
    t.quien.title = `${t.origen}: ${nombre} · ${final}`;
    t.quien.innerHTML = `${avatarMarco(p.foto, nombre, p.color || ctx.colorDe(e.uid), ctx.marco(e.uid), 18, e.uid)}<b translate="no" data-perfil="${escapeHtml(e.uid)}" data-nombre="${escapeHtml(nombre)}">${nombreHtml(e.uid, escapeHtml(nombre))}</b>`;
  }

  function cuadro(ahora) {
    raf = 0;
    if (muerto || !activo || !ancho.matches || document.hidden) return;
    raf = requestAnimationFrame(cuadro);
    if (ahora - ultimoCuadro < CUADRO_MS) return;
    ultimoCuadro = ahora;
    const pie = ahora - ultimoPie > PIE_MS;
    if (pie) ultimoPie = ahora;
    for (const t of tarjetas) if (t.repro) pintaTarjeta(t, ahora, pie);
  }
  const arranca = () => { if (!raf && activo && ancho.matches && !document.hidden) raf = requestAnimationFrame(cuadro); };

  function engancha() {
    armaLinea();
    for (const t of tarjetas) {
      if (t.off) continue;
      t.el.classList.add("cargando");
      t.off = fb.watchRepeticiones(t.rep.cat, (filas, error) => { elige(t, filas, error); });
    }
    arranca();
  }
  function suelta() {
    for (const t of tarjetas) { if (t.off) { t.off(); t.off = null; } t.gen++; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* ---------- el chat general ---------- */
  let offChat = null, offSuper = null, offDatos = null, chatMsgs = [], superMsgs = [], chatFirma = "", relee = 0, repinta = 0, ultimoMio = null, abierto = false, barrido = false, cuenta = 0, enviando = false;
  /* El super chat elegido para el próximo mensaje (su precio; 0: normal). */
  let elegido = 0, superAbierto = false;

  function enganchaChat() {
    const u = ctx.usuario();
    if (!u || offChat) return;
    const escucha = () => {
      if (offChat) offChat();
      if (offSuper) offSuper();
      offChat = fb.watchChatGeneral(fb.ahora() - CHAT_VENTANA_MS, CHAT_MAX, (v, err) => {
        chatMsgs = v || [];
        if (err) nota(esPermiso(err) ? "El chat general espera que se publiquen las reglas de Firebase." : "No se pudo leer el chat.");
        pintaChat();
      });
      /* Los super que siguen vivos van por otra escucha: duran más que la
         ventana de 15 minutos. */
      offSuper = fb.watchSuperChats(fb.ahora() - SUPER_MAX_MS, 60, (v, err) => {
        superMsgs = err ? [] : (v || []);
        pintaChat();
      });
    };
    escucha();
    if (ctx.alDatos && !offDatos) offDatos = ctx.alDatos(() => { pintaChat(); if (superAbierto) pintaSuper(); });
    relee = setInterval(escucha, RELEE_CHAT_MS);
    repinta = setInterval(pintaChat, REPINTA_CHAT_MS);
    fb.leerUltimoChatGeneral(u.uid).then(x => { if (x && Number.isFinite(x.at)) { ultimoMio = x.at; espera(); } }, () => {});
    if (!barrido) { barrido = true; fb.barreChatGeneral(fb.ahora() - CHAT_VIEJO_MS - 60000, 25).catch(() => {}); }
  }
  function sueltaChat() {
    if (offChat) { offChat(); offChat = null; }
    if (offSuper) { offSuper(); offSuper = null; }
    if (offDatos) { offDatos(); offDatos = null; }
    clearInterval(relee); clearInterval(repinta); clearInterval(cuenta);
    relee = repinta = cuenta = 0;
    chatMsgs = []; superMsgs = []; chatFirma = "";
  }
  /* ¿Se pudo pagar el super de este mensaje? Lo que no es super, o lo que
     la economía aún no sabe, no se pone en duda. */
  const pagado = m => nivelSuper(m.s) && ctx.superPagado ? ctx.superPagado(m.uid, m.id) : null;

  function nota(texto) { chatNota.textContent = texto || ""; chatNota.hidden = !texto; }

  const haceCuanto = ms => {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 45 ? "ahora" : s < 3600 ? `hace ${Math.max(1, Math.round(s / 60))} min` : "hace un rato";
  };

  function pintaChat() {
    const u = ctx.usuario();
    chat.classList.toggle("invitado", !u);
    if (!u) {
      const firma = "invitado";
      if (chatFirma !== firma) {
        chatFirma = firma;
        chatLista.innerHTML = `<div class="jg-riel-puerta"><p>Inicia sesión para leer y escribir en el chat general.</p><button class="btn" type="button" data-login>Iniciar sesión</button></div>`;
      }
      chatForm.hidden = true;
      fabN.hidden = true;
      return;
    }
    chatForm.hidden = false;
    const ahora = fb.ahora(), vis = chatVisibles(chatMsgs.concat(superMsgs), ahora, pagado);
    const filas = vis.map(m => {
      const p = mezcla({ nombre: m.n || "Jugador" }, ctx.perfil(m.uid));
      const sup = pagado(m) !== false ? nivelSuper(m.s) : null;
      return { m, sup, queda: sup ? quedaSuper(m, ahora) : "", nombre: p.nombre || "Jugador", foto: p.foto, color: p.color || ctx.colorDe(m.uid), cuando: haceCuanto(ahora - m.at) };
    });
    const firma = u.uid + "|" + filas.map(f => [f.m.id, f.nombre, f.foto, f.color, f.cuando, ctx.marco(f.m.uid), f.sup ? f.sup.id : "", f.queda].join(",")).join("|");
    if (firma !== chatFirma) {
      chatFirma = firma;
      const abajo = chatLista.scrollHeight - chatLista.scrollTop - chatLista.clientHeight < 40;
      chatLista.innerHTML = filas.length ? filas.map(f => `
        <div class="jg-cg-msg${f.m.uid === u.uid ? " mio" : ""}${f.sup ? ` super s-${f.sup.id}` : ""}" style="--c:${escapeHtml(f.color)}">
          ${f.sup ? `<em class="jg-cg-sup" translate="yes">${f.sup.icono} ${escapeHtml(f.sup.nombre)} · ${f.sup.p} 🪙<small>${escapeHtml(f.queda)}</small></em>` : ""}
          ${avatarMarco(f.foto, f.nombre, f.color, ctx.marco(f.m.uid), 24, f.m.uid)}
          <div><p><b data-perfil="${escapeHtml(f.m.uid)}" data-nombre="${escapeHtml(f.nombre)}">${nombreHtml(f.m.uid, escapeHtml(f.nombre))}</b><time>${escapeHtml(f.cuando)}</time></p>
          <span>${escapeHtml(f.m.t)}</span></div>
        </div>`).join("")
        : `<div class="vacio">Nadie ha escrito en los últimos 15 minutos. ¡Saluda!</div>`;
      if (abajo || !chatLista.dataset.listo) chatLista.scrollTop = chatLista.scrollHeight;
      chatLista.dataset.listo = "1";
    }
    // Lo nuevo de otros: cuenta en el botón mientras el chat no se ve.
    const visible = abierto || acoplado();
    if (visible && vis.length) ponVisto(Math.max(leeVisto(), vis[vis.length - 1].at));
    const n = visible ? 0 : sinLeer(vis, leeVisto(), u.uid);
    fabN.hidden = !n;
    fabN.textContent = n > 9 ? "9+" : String(n);
    fab.setAttribute("aria-label", n ? `Abrir el chat general (${n} sin leer)` : "Abrir el chat general");
  }

  /* El botón dice cuánto falta para poder escribir otra vez: la regla no
     deja antes, así que la página tampoco lo intenta. */
  function espera() {
    clearInterval(cuenta);
    cuenta = 0;
    const tic = () => {
      const falta = esperaChat(ultimoMio, fb.ahora());
      chatBtn.disabled = enviando || falta > 0;
      const n = nivelSuper(elegido);
      chatBtn.textContent = falta > 0 ? `${Math.ceil(falta / 1000)} s` : n ? `${n.icono} ${n.p} 🪙` : "Enviar";
      chatBtn.classList.toggle("super", !!n);
      chatBtn.title = falta > 0 ? "Se puede escribir un mensaje cada 20 segundos" : "";
      if (!falta && cuenta) { clearInterval(cuenta); cuenta = 0; }
    };
    tic();
    if (esperaChat(ultimoMio, fb.ahora()) > 0) cuenta = setInterval(tic, 250);
  }

  /* ---------- el selector de super chat ----------
     Normal o uno de los niveles; el que no se puede pagar sale apagado.
     Lo elegido vale para el próximo mensaje y después vuelve a normal. */
  function puedePagar(p) {
    const s = ctx.saldo ? ctx.saldo() : null;
    return !!s && !s.parada && s.saldo >= p;
  }
  function pintaSuper() {
    const s = ctx.saldo ? ctx.saldo() : null;
    if (elegido && !puedePagar(elegido)) elegido = 0;
    const op = (p, icono, nombre, detalle, clase) => {
      const ok = !p || puedePagar(p);
      return `<button type="button" role="radio" class="jg-cg-op ${clase}${elegido === p ? " sel" : ""}" data-super="${p}" aria-checked="${elegido === p}"${ok ? "" : " disabled"}>
        <b>${icono} ${nombre}</b><small>${detalle}</small></button>`;
    };
    superCaja.innerHTML = `<p><b>✦ Super chat</b> <span>${s ? `Tienes ${s.saldo.toLocaleString("es-CL")} 🪙${s.parada ? " · cuenta parada" : ""}` : "Cargando tus monedas…"}</span></p>
      <div class="jg-cg-ops">${op(0, "💬", "Normal", "gratis · 15 min", "s-normal")}${SUPER_CHAT.map(n =>
        op(n.p, n.icono, n.nombre, `${n.p} 🪙 · ${n.ms >= 3600000 ? `${n.ms / 3600000} h` : `${n.ms / 60000} min`}`, "s-" + n.id)).join("")}</div>`;
    espera();
  }
  function abreSuper(si) {
    superAbierto = !!si;
    superCaja.hidden = !superAbierto;
    superBtn.setAttribute("aria-expanded", String(superAbierto));
    superBtn.classList.toggle("activo", superAbierto || !!elegido);
    if (superAbierto) pintaSuper();
  }
  superBtn.onclick = () => abreSuper(!superAbierto);
  superCaja.addEventListener("click", ev => {
    const b = ev.target.closest("[data-super]");
    if (!b || b.disabled) return;
    elegido = Number(b.dataset.super) || 0;
    pintaSuper();
    superBtn.classList.toggle("activo", true);
    if (!window.matchMedia("(pointer: coarse)").matches) chatCampo.focus();
  });

  chatForm.onsubmit = async ev => {
    ev.preventDefault();
    const u = ctx.usuario();
    const texto = limpiaChat(chatCampo.value);
    if (!u || !texto || enviando || esperaChat(ultimoMio, fb.ahora()) > 0) return;
    const sup = nivelSuper(elegido);
    if (sup && !puedePagar(sup.p)) { nota(`No te alcanza: un super chat ${sup.nombre} cuesta ${sup.p} 🪙.`); pintaSuper(); return; }
    enviando = true;
    espera();
    chatCampo.value = "";
    try {
      await fb.mandaChatGeneral({ uid: u.uid, nombre: u.name }, texto, CHAT_LARGO, sup ? sup.p : 0);
      ultimoMio = fb.ahora();
      nota(sup ? `${sup.icono} Tu super chat queda a la vista ${sup.ms / 3600000 >= 1 ? `${sup.ms / 3600000} h` : `${sup.ms / 60000} min`}.` : "");
      if (sup) { elegido = 0; abreSuper(false); }
    } catch (e) {
      /* Lo que no salió vuelve al campo: perder una frase es peor que no
         mandarla. Un PERMISSION_DENIED es la espera de la regla (otra
         pestaña escribió hace poco) o las reglas sin publicar. */
      if (!chatCampo.value) chatCampo.value = texto;
      const x = await fb.leerUltimoChatGeneral(u.uid).catch(() => null);
      if (x && Number.isFinite(x.at)) ultimoMio = x.at;
      nota(esPermiso(e)
        ? (esperaChat(ultimoMio, fb.ahora()) > 0 ? "Espera unos segundos: se puede escribir un mensaje cada 20 s."
          : sup ? "No se pudo enviar el super chat: espera que se publiquen las reglas de Firebase. No se cobró nada." : "No se pudo enviar: el chat general espera que se publiquen las reglas de Firebase.")
        : "No se pudo enviar. Revisa la conexión e inténtalo otra vez.");
    }
    enviando = false;
    espera();
    if (!window.matchMedia("(pointer: coarse)").matches) chatCampo.focus();
  };

  /* El chat va en el riel (PC ancho, vista de menú) o flota como burbuja. */
  const acoplado = () => ancho.matches && activo;
  function ponFlota() {
    const flota = chatActivo && !acoplado();
    document.documentElement.classList.toggle("jg-cg-flota", flota);
    if (!flota && abierto) abre(false);
  }
  function abre(si) {
    abierto = !!si && chatActivo;
    document.documentElement.classList.toggle("jg-cg-abierto", abierto);
    fab.setAttribute("aria-expanded", String(abierto));
    if (abierto) {
      chatFirma = "";
      pintaChat();
      chatLista.scrollTop = chatLista.scrollHeight;
      if (!window.matchMedia("(pointer: coarse)").matches) setTimeout(() => chatCampo.focus(), 60);
    } else if (chat.contains(document.activeElement)) fab.focus();
  }
  fab.onclick = () => abre(!abierto);
  fondo.onclick = () => abre(false);
  chat.querySelector(".jg-cg-cierra").onclick = () => abre(false);
  const tecla = ev => {
    if (ev.key !== "Escape") return;
    if (superAbierto && chat.contains(document.activeElement)) { ev.preventDefault(); abreSuper(false); return; }
    if (abierto) { ev.preventDefault(); abre(false); }
  };
  document.addEventListener("keydown", tecla);

  /* ---------- encender y apagar ---------- */
  const alAncho = () => {
    ponFlota();
    if (activo && ancho.matches && ctx.usuario()) engancha(); else suelta();
    for (const t of tarjetas) t.w = 0;
    chatFirma = "";
    pintaChat();
    arranca();
  };
  ancho.addEventListener("change", alAncho);
  const alVer = () => { if (!document.hidden) { for (const t of tarjetas) t.w = 0; arranca(); } };
  document.addEventListener("visibilitychange", alVer);
  /* La cabecera del sitio no es fija: mientras se ve, los rieles empiezan
     debajo de ella, y al bajar suben hasta el borde (`--jg-scroll`). */
  let scrollPend = false;
  const ponScroll = () => { scrollPend = false; document.documentElement.style.setProperty("--jg-scroll", Math.min(80, Math.max(0, Math.round(window.scrollY))) + "px"); };
  const alScroll = () => { if (activo && !scrollPend) { scrollPend = true; requestAnimationFrame(ponScroll); } };
  window.addEventListener("scroll", alScroll, { passive: true });

  function pintaPuertaIzq(invitado) {
    izq.classList.toggle("invitado", invitado);
    let puerta = izq.querySelector(".jg-riel-puerta");
    if (invitado && !puerta) {
      puerta = document.createElement("div");
      puerta.className = "jg-riel-puerta";
      puerta.innerHTML = `<p>Las mejores partidas del día de los juegos del club que más se juegan, repetidas jugada por jugada. Cada día, otra alineación.</p><p>Inicia sesión para verlas.</p><button class="btn" type="button" data-login>Iniciar sesión</button>`;
      izq.appendChild(puerta);
    } else if (!invitado && puerta) puerta.remove();
  }

  /* Se llama en cada repintado de juegos-main: `si` dice si la vista
     actual lleva rieles, y `conChat` si lleva el chat general (todas
     menos el castigo y la puerta de entrada: en una partida o un juego del
     club va como burbuja). Barato si nada cambió. */
  function pon(si, conChat = si) {
    if (muerto) return;
    const u = ctx.usuario(), uid = u ? u.uid : "";
    const cambio = !!si !== activo || !!conChat !== chatActivo || uid !== quien;
    activo = !!si;
    chatActivo = !!(si || conChat);
    document.documentElement.classList.toggle("jg-rieles", activo);
    document.documentElement.classList.toggle("jg-cg-si", chatActivo);
    if (activo) ponScroll();
    ponFlota();
    if (cambio) {
      if (uid !== quien) { sueltaChat(); suelta(); comprobadas.clear(); ultimoMio = null; elegido = 0; abreSuper(false); for (const t of tarjetas) { t.repro = null; t.entrada = null; t.pausado = false; t.el.classList.remove("pausada"); } }
      quien = uid;
      pintaPuertaIzq(!u);
      if (chatActivo && u) enganchaChat(); else sueltaChat();
      if (activo && u && ancho.matches) engancha(); else suelta();
      chatFirma = "";
      pintaChat();
      espera();
    } else if (activo) {
      // Otro día (o la popularidad que llegó reordena la alineación).
      if (u && ancho.matches && armaLinea()) engancha();
      // Un perfil que llegó (apodo, foto, marco): los pies y el chat lo recogen.
      for (const t of tarjetas) if (t.repro) pintaPie(t);
      pintaChat();
    } else if (chatActivo) pintaChat();
    arranca();
  }

  function destruir() {
    muerto = true;
    suelta(); sueltaChat();
    ancho.removeEventListener("change", alAncho);
    document.removeEventListener("visibilitychange", alVer);
    document.removeEventListener("keydown", tecla);
    window.removeEventListener("scroll", alScroll);
    document.documentElement.classList.remove("jg-rieles", "jg-cg-abierto", "jg-cg-si", "jg-cg-flota");
    izq.remove(); chat.remove(); fondo.remove(); fab.remove();
  }

  return { pon, destruir, abre };
}
