/* Los rieles del salón: en un PC ancho, a la izquierda un carrusel con
   las mejores partidas del día de los juegos del club que más se juegan,
   con quien las jugó; a la derecha el chat general. En una pantalla más
   angosta (y en el celular) las repeticiones no salen y el chat es un
   botón 💬 que abre un panel (una hoja desde abajo en el celular). Lo
   puro está en rieles-datos.js y las repeticiones en repeticion.js.

   Cuelgan de <body> y se muestran por CSS: `html.jg-rieles` (lo pone
   `pon(true)` en las vistas de menú) más el ancho (`@media` en
   juegos.html, el mismo corte que `ANCHO`). Fuera de esas vistas —una
   partida, un juego del club, los sobres— no hay riel ni escucha: el
   juego es de la pantalla entera.

   **El carrusel.** Cada día sale una alineación de `POR_DIA` juegos
   (`alineacionDelDia`: los más jugados casi siempre, el resto rotando).
   Arriba se ve una partida a la vez, grande, y pasa sola a la siguiente
   cuando termina (una partida larga muestra su último tramo, `TRAMO_MS`);
   debajo, la alineación de hoy con quién tiene la mejor partida de cada
   juego, para saltar a cualquiera. Con el ratón encima o el foco dentro,
   la partida vuelve a empezar en vez de pasar; con «reducir movimiento»
   no pasa sola y se queda en el tablero final.

   **Lo que se reproduce se comprueba antes.** Cada prueba pasa por el
   mismo verificador antitrampas que la aceptó al guardarla
   (`verificaClub`, con el uid de su dueño): una fila escrita a mano en la
   base, con una prueba que no cuadra, no llega a la pantalla del salón y
   se prueba con la siguiente. Si hoy (ni nunca) se guardó ninguna, el
   carrusel repite el récord histórico de la tabla del club, cuya prueba
   ya vive en `soloPruebas`. */
import { escapeHtml } from "../util.js";
import { avatarMarco } from "./perfil-vista.js";
import { mezcla } from "./perfil.js";
import { verificaClub } from "./solo/verifica.js";
import { crearRepro } from "./repeticion.js";
import { COLOR_SOLO } from "./salon-datos.js";
import {
  alineacionDelDia, etiquetaDia, PAUSA_FINAL_MS, VACIA_MS, desdeRep, formatoMarca,
  CHAT_VENTANA_MS, CHAT_LARGO, CHAT_MAX, CHAT_VIEJO_MS, chatVisibles, esperaChat, limpiaChat, sinLeer
} from "./rieles-datos.js";

/* El corte de «PC ancho». Debe coincidir con el `@media` de juegos.html. */
export const ANCHO = "(min-width: 1400px)";
const CUADRO_MS = 33, PIE_MS = 400, RELEE_CHAT_MS = 10 * 60 * 1000, REPINTA_CHAT_MS = 15000;
const CLAVE_VISTO = "jg.chatG.visto";
const colorDeJuego = j => COLOR_SOLO[j === "tetris" ? "tetrisclub" : j] || "#8b5cf6";

const leeVisto = () => { try { return Number(localStorage.getItem(CLAVE_VISTO)) || 0; } catch (e) { return 0; } };
const ponVisto = v => { try { localStorage.setItem(CLAVE_VISTO, String(v)); } catch (e) { /* opcional */ } };
const esPermiso = e => /permission/i.test(String(e && (e.code || e.message) || e));

/* ctx = {fb, usuario() → {uid, name}|null, perfil(uid), marco(uid),
   colorDe(uid), dia() → día de Chile de hoy, popular() → juego → cuánto
   se juega} */
export function crearRieles(ctx) {
  const { fb } = ctx;
  const ancho = window.matchMedia(ANCHO);
  let activo = false, quien = "", raf = 0, ultimoCuadro = 0, ultimoPie = 0, muerto = false;

  /* ---------- el armado ---------- */
  const izq = document.createElement("aside");
  izq.className = "jg-riel jg-riel-izq";
  izq.setAttribute("aria-label", "Mejores partidas del día");
  izq.innerHTML = `<header class="jg-riel-cab"><span class="jg-vivo" aria-hidden="true"></span><h2>Mejores partidas</h2><small>del día · cambian cada día</small></header>
    <div class="jg-rp-car">
      <article class="jg-rp cargando" aria-roledescription="carrusel" aria-label="Repetición">
        <div class="jg-rp-cab"><a href="#" class="jg-rp-juego"><b></b><span></span></a><span class="jg-rp-quien"></span></div>
        <div class="jg-rp-lienzo" title="Pausar o seguir"><canvas aria-hidden="true"></canvas>
          <button class="jg-rp-pausa" type="button" aria-label="Seguir la repetición">▶</button>
          <p class="jg-rp-msg"></p></div>
        <div class="jg-rp-pie"><span class="jg-rp-origen"></span>
          <span class="jg-rp-ctl"><button type="button" data-paso="-1" aria-label="Partida anterior">‹</button><button type="button" class="jg-rp-pp" aria-label="Pausar la repetición">❚❚</button><button type="button" data-paso="1" aria-label="Partida siguiente">›</button></span></div>
        <div class="jg-rp-barra" aria-hidden="true"><i></i></div>
      </article>
      <p class="jg-rp-hoy">Hoy en el carrusel</p>
      <ol class="jg-rp-linea"></ol>
    </div>`;
  const esc = izq.querySelector(".jg-rp"), canvas = esc.querySelector("canvas"), caja = esc.querySelector(".jg-rp-lienzo");
  const escJuego = esc.querySelector(".jg-rp-juego"), escQuien = esc.querySelector(".jg-rp-quien"), escMsg = esc.querySelector(".jg-rp-msg");
  const escOrigen = esc.querySelector(".jg-rp-origen"), escBarra = esc.querySelector(".jg-rp-barra i"), ppBtn = esc.querySelector(".jg-rp-pp");
  const linea = izq.querySelector(".jg-rp-linea");

  const chat = document.createElement("aside");
  chat.className = "jg-riel jg-riel-der jg-cg";
  chat.id = "jgChatG";
  chat.setAttribute("aria-label", "Chat general");
  chat.innerHTML = `<header class="jg-riel-cab"><span class="jg-vivo" aria-hidden="true"></span><h2>Chat general</h2><small>últimos 15 min</small>
      <button class="jg-cg-cierra" type="button" aria-label="Cerrar el chat">✕</button></header>
    <div class="jg-cg-lista" translate="no" aria-live="polite"></div>
    <p class="jg-cg-nota" aria-live="polite"></p>
    <form class="jg-cg-form" autocomplete="off">
      <input class="inp" maxlength="${CHAT_LARGO}" placeholder="Escribe a todo el salón…" aria-label="Mensaje para el chat general">
      <button class="btn" type="submit">Enviar</button>
    </form>`;
  const chatLista = chat.querySelector(".jg-cg-lista"), chatNota = chat.querySelector(".jg-cg-nota");
  const chatForm = chat.querySelector(".jg-cg-form"), chatCampo = chatForm.querySelector("input"), chatBtn = chatForm.querySelector("button");

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

  /* ---------- la alineación del día ----------
     Una «tarjeta» por juego de hoy: su escucha de `repeticiones`, la
     partida elegida y ya comprobada, y su fila en la lista. Cambia sola
     al cambiar el día (o si la popularidad que llegó reordena la lista). */
  let tarjetas = [], firmaLinea = "", actual = 0;
  const comprobadas = new Map();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  /* Lo que se está viendo arriba: desde qué instante y cuándo empezó
     (`t0`), la pausa, y desde cuándo espera una tabla sin partida. */
  const vista = { t: null, firma: "", t0: 0, desde: 0, pausado: false, enPausa: 0, espera: 0, w: 0, h: 0, dpr: 0, pieFirma: "" };
  let retenido = false;

  function armaLinea() {
    const reps = alineacionDelDia(ctx.dia(), ctx.popular ? ctx.popular() : null);
    const firma = reps.map(r => r.cat).join(",");
    if (firma === firmaLinea) return false;
    const antes = tarjetas[actual] && tarjetas[actual].rep.cat;
    for (const t of tarjetas) { if (t.off) t.off(); t.gen++; }
    firmaLinea = firma;
    linea.innerHTML = "";
    tarjetas = reps.map((rep, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" style="--c:${colorDeJuego(rep.juego)}"><i class="jg-rp-punto" aria-hidden="true"></i><b>${escapeHtml(rep.titulo)}</b><span class="jg-rp-l-quien"></span><span class="jg-rp-l-marca"></span><i class="jg-rp-l-barra" aria-hidden="true"></i></button>`;
      const btn = li.querySelector("button");
      btn.onclick = () => ve(i, true);
      linea.appendChild(li);
      return { rep, li, btn, quienEl: li.querySelector(".jg-rp-l-quien"), marcaEl: li.querySelector(".jg-rp-l-marca"),
        off: null, gen: 0, repro: null, entrada: null, origen: "", estado: "cargando", error: null, filaFirma: "" };
    });
    const sigue = tarjetas.findIndex(t => t.rep.cat === antes);
    actual = sigue >= 0 ? sigue : 0;
    vista.t = null;
    for (const t of tarjetas) pintaFila(t);
    return true;
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
    const filas = (await fb.leerSolo(rep.cat)).sort((a, b) => rep.menor
      ? a.tiempo - b.tiempo || a.uid.localeCompare(b.uid)
      : b.puntos - a.puntos || a.tiempo - b.tiempo || a.uid.localeCompare(b.uid));
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
      t.repro = null; t.entrada = null; t.estado = "vacia"; t.error = error || null;
      pintaFila(t);
      if (t === tarjetas[actual]) muestra();
      return;
    }
    const { fila, prueba } = elegida;
    const firma = `${fila.uid}:${fila.p}:${fila.t}:${fila.o || ""}`;
    t.estado = "lista";
    t.origen = origen === "record" ? "Récord histórico" : etiquetaDia(fila.dia, ctx.dia());
    if (!(t.entrada && t.entrada.firma === firma && t.repro)) {
      t.repro = crearRepro(t.rep.juego, prueba);
      t.entrada = { uid: fila.uid, n: fila.n, p: fila.p, t: fila.t, firma };
    }
    pintaFila(t);
    if (t === tarjetas[actual]) muestra();
  }

  /* ---------- lo que se ve arriba ---------- */
  const nombreDe = e => mezcla({ nombre: e.n || "Jugador" }, ctx.perfil(e.uid)).nombre || "Jugador";
  const marcaDe = t => formatoMarca(t.rep, t.entrada.p, t.entrada.t);

  /* Pone arriba la partida de la tarjeta `actual`. Si es la misma que ya
     estaba (llegó otra vez la misma fila), no la reinicia. */
  function muestra() {
    const t = tarjetas[actual];
    if (!t) return;
    const firma = t.rep.cat + "|" + (t.entrada ? t.entrada.firma : t.estado);
    if (vista.t === t && vista.firma === firma) return;
    const otroJuego = vista.t !== t;
    vista.t = t; vista.firma = firma; vista.pieFirma = ""; vista.espera = performance.now();
    esc.style.setProperty("--c", colorDeJuego(t.rep.juego));
    escJuego.href = t.rep.ruta;
    escJuego.title = `Jugar a ${t.rep.titulo}`;
    escJuego.querySelector("b").textContent = t.rep.titulo;
    escJuego.querySelector("span").textContent = t.rep.modo;
    for (const x of tarjetas) {
      x.btn.classList.toggle("activa", x === t);
      if (x === t) x.btn.setAttribute("aria-current", "true"); else x.btn.removeAttribute("aria-current");
      x.btn.style.setProperty("--p", "0");
    }
    esc.classList.toggle("cargando", t.estado === "cargando");
    esc.classList.toggle("vacia", t.estado === "vacia");
    if (otroJuego) { esc.classList.remove("entra"); void esc.offsetWidth; esc.classList.add("entra"); }
    if (!t.repro) {
      escQuien.innerHTML = ""; escOrigen.textContent = "";
      escMsg.innerHTML = t.estado === "cargando" ? "Buscando la mejor partida…"
        : (t.error && esPermiso(t.error) ? "Las repeticiones esperan que se publiquen las reglas de Firebase." : "Nadie ha jugado todavía. ¡Estrena la tabla!") +
          `<a class="jg-rp-jugar" href="${t.rep.ruta}">Jugar ahora →</a>`;
      limpiaLienzo();
      vista.pausado = false;
      ponPausa(false);
      return;
    }
    escMsg.textContent = "";
    vista.desde = desdeRep(t.repro.dur);
    vista.t0 = performance.now() - vista.desde;
    vista.pausado = false;
    // Con «reducir movimiento» se queda quieta en el tablero final; ▶ la pone en marcha.
    if (reduce.matches) { vista.t0 -= t.repro.dur - vista.desde; ponPausa(true); }
    else ponPausa(false);
    pintaEscena(performance.now(), true);
  }

  function ponPausa(si) {
    const ahora = performance.now();
    if (si !== vista.pausado) {
      if (si) vista.enPausa = ahora; else vista.t0 += ahora - vista.enPausa;
    }
    vista.pausado = si;
    esc.classList.toggle("pausada", si && !!(vista.t && vista.t.repro));
    ppBtn.textContent = si ? "▶" : "❚❚";
    ppBtn.setAttribute("aria-label", si ? "Seguir la repetición" : "Pausar la repetición");
  }

  function ve(i, aMano) {
    if (!tarjetas.length) return;
    actual = (i + tarjetas.length) % tarjetas.length;
    vista.t = null;
    muestra();
    if (aMano) arranca();
  }

  function limpiaLienzo() {
    const g = canvas.getContext("2d");
    if (g) g.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* El instante de la partida que toca ahora: la partida (o su último
     tramo), a su velocidad real, más una pausa con el tablero final.
     Devuelve null cuando ya terminó la vuelta y toca pasar a la siguiente. */
  function instante(ahora) {
    const r = vista.t.repro, reloj = (vista.pausado ? vista.enPausa : ahora) - vista.t0;
    if (reloj >= r.dur + PAUSA_FINAL_MS) {
      if (!retenido && !reduce.matches && tarjetas.length > 1) return null;
      vista.t0 = ahora - vista.desde;
      return vista.desde;
    }
    return Math.min(r.dur, reloj);
  }

  function pintaEscena(ahora, pie) {
    const t = vista.t;
    if (!t || !t.repro) return;
    const w = caja.clientWidth, h = caja.clientHeight;
    if (!w || !h) return;
    const ms = instante(ahora);
    if (ms === null) { ve(actual + 1, false); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (vista.w !== w || vista.h !== h || vista.dpr !== dpr) {
      vista.w = w; vista.h = h; vista.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
    }
    t.repro.en(ms);
    const g = canvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Lo que en el juego se mueve solo (la cuadrícula de sortEm, la fruta
    // que late, el ala) sigue moviéndose con la repetición en pausa.
    t.repro.pinta(g, w, h, ahora / 1000);
    const p = Math.max(0, Math.min(1, (ms - vista.desde) / Math.max(1, t.repro.dur - vista.desde)));
    escBarra.style.transform = `scaleX(${p})`;
    t.btn.style.setProperty("--p", p.toFixed(3));
    if (pie) pintaPie();
  }

  /* Arriba de la escena, quién la jugó; debajo, de dónde viene (hoy, ayer,
     récord) y su marca final. */
  function pintaPie() {
    const t = vista.t, e = t && t.entrada;
    if (!e) return;
    const p = mezcla({ nombre: e.n || "Jugador" }, ctx.perfil(e.uid));
    const nombre = p.nombre || "Jugador", final = marcaDe(t);
    const firma = [nombre, p.foto, p.color, ctx.marco(e.uid), final, t.origen].join("|");
    if (firma === vista.pieFirma) return;
    vista.pieFirma = firma;
    escQuien.title = `${t.origen}: ${nombre} · ${final}`;
    escQuien.innerHTML = `${avatarMarco(p.foto, nombre, p.color || ctx.colorDe(e.uid), ctx.marco(e.uid), 18, e.uid)}<b translate="no" data-perfil="${escapeHtml(e.uid)}" data-nombre="${escapeHtml(nombre)}">${escapeHtml(nombre)}</b>`;
    escOrigen.innerHTML = `<span>${escapeHtml(t.origen)}</span> · <b>${escapeHtml(final)}</b>`;
  }

  /* La fila de cada juego en la lista de hoy: quién y su marca. */
  function pintaFila(t) {
    const e = t.entrada;
    const quienTxt = e ? nombreDe(e) : t.estado === "vacia" ? "Sin partidas" : "…";
    const marca = e ? marcaDe(t) : "";
    const firma = quienTxt + "|" + marca + "|" + t.estado;
    if (firma === t.filaFirma) return;
    t.filaFirma = firma;
    t.quienEl.setAttribute("translate", e ? "no" : "yes");
    t.quienEl.textContent = quienTxt;
    t.quienEl.classList.toggle("nadie", !e);
    t.marcaEl.textContent = marca;
    t.btn.setAttribute("aria-label", `${t.rep.titulo}: ${e ? `${quienTxt}, ${marca}` : quienTxt}`);
  }

  function cuadro(ahora) {
    raf = 0;
    if (muerto || !activo || !ancho.matches || document.hidden) return;
    raf = requestAnimationFrame(cuadro);
    if (ahora - ultimoCuadro < CUADRO_MS) return;
    ultimoCuadro = ahora;
    const pie = ahora - ultimoPie > PIE_MS;
    if (pie) ultimoPie = ahora;
    const t = vista.t;
    if (!t) { muestra(); return; }
    if (t.repro) pintaEscena(ahora, pie);
    // Una tabla sin partida (o que tarda en llegar) no se queda en pantalla.
    else if (!retenido && !reduce.matches && tarjetas.length > 1 && ahora - vista.espera > (t.estado === "vacia" ? VACIA_MS : 2 * VACIA_MS)) ve(actual + 1, false);
    if (pie) for (const x of tarjetas) if (x.entrada) pintaFila(x);
  }
  const arranca = () => { if (!raf && activo && ancho.matches && !document.hidden) raf = requestAnimationFrame(cuadro); };

  function engancha() {
    armaLinea();
    for (const t of tarjetas) {
      if (t.off) continue;
      t.off = fb.watchRepeticiones(t.rep.cat, (filas, error) => { elige(t, filas, error); });
    }
    muestra();
    arranca();
  }
  function suelta() {
    for (const t of tarjetas) { if (t.off) { t.off(); t.off = null; } t.gen++; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* Pausar: el botón, o un clic en la escena. Las flechas y la lista saltan. */
  ppBtn.onclick = () => { if (vista.t && vista.t.repro) ponPausa(!vista.pausado); };
  esc.querySelector(".jg-rp-pausa").onclick = () => ponPausa(false);
  caja.addEventListener("click", ev => { if (ev.target === canvas && vista.t && vista.t.repro) ponPausa(!vista.pausado); });
  for (const b of esc.querySelectorAll("[data-paso]")) b.onclick = () => ve(actual + Number(b.dataset.paso), true);
  /* Mirando de cerca (ratón encima o foco dentro) la partida no se va. */
  const carrusel = izq.querySelector(".jg-rp-car");
  const retiene = () => { retenido = carrusel.matches(":hover") || carrusel.contains(document.activeElement); };
  carrusel.addEventListener("pointerenter", () => { retenido = true; });
  carrusel.addEventListener("pointerleave", () => setTimeout(retiene, 0));
  carrusel.addEventListener("focusin", () => { retenido = true; });
  carrusel.addEventListener("focusout", () => setTimeout(retiene, 0));

  /* ---------- el chat general ---------- */
  let offChat = null, chatMsgs = [], chatFirma = "", relee = 0, repinta = 0, ultimoMio = null, abierto = false, barrido = false, cuenta = 0, enviando = false;

  function enganchaChat() {
    const u = ctx.usuario();
    if (!u || offChat) return;
    const escucha = () => {
      if (offChat) offChat();
      offChat = fb.watchChatGeneral(fb.ahora() - CHAT_VENTANA_MS, CHAT_MAX, (v, err) => {
        chatMsgs = v || [];
        if (err) nota(esPermiso(err) ? "El chat general espera que se publiquen las reglas de Firebase." : "No se pudo leer el chat.");
        pintaChat();
      });
    };
    escucha();
    relee = setInterval(escucha, RELEE_CHAT_MS);
    repinta = setInterval(pintaChat, REPINTA_CHAT_MS);
    fb.leerUltimoChatGeneral(u.uid).then(x => { if (x && Number.isFinite(x.at)) { ultimoMio = x.at; espera(); } }, () => {});
    if (!barrido) { barrido = true; fb.barreChatGeneral(fb.ahora() - CHAT_VIEJO_MS - 60000, 25).catch(() => {}); }
  }
  function sueltaChat() {
    if (offChat) { offChat(); offChat = null; }
    clearInterval(relee); clearInterval(repinta); clearInterval(cuenta);
    relee = repinta = cuenta = 0;
    chatMsgs = []; chatFirma = "";
  }

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
    const ahora = fb.ahora(), vis = chatVisibles(chatMsgs, ahora);
    const filas = vis.map(m => {
      const p = mezcla({ nombre: m.n || "Jugador" }, ctx.perfil(m.uid));
      return { m, nombre: p.nombre || "Jugador", foto: p.foto, color: p.color || ctx.colorDe(m.uid), cuando: haceCuanto(ahora - m.at) };
    });
    const firma = u.uid + "|" + filas.map(f => [f.m.id, f.nombre, f.foto, f.color, f.cuando, ctx.marco(f.m.uid)].join(",")).join("|");
    if (firma !== chatFirma) {
      chatFirma = firma;
      const abajo = chatLista.scrollHeight - chatLista.scrollTop - chatLista.clientHeight < 40;
      chatLista.innerHTML = filas.length ? filas.map(f => `
        <div class="jg-cg-msg${f.m.uid === u.uid ? " mio" : ""}" style="--c:${escapeHtml(f.color)}">
          ${avatarMarco(f.foto, f.nombre, f.color, ctx.marco(f.m.uid), 24, f.m.uid)}
          <div><p><b data-perfil="${escapeHtml(f.m.uid)}" data-nombre="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</b><time>${escapeHtml(f.cuando)}</time></p>
          <span>${escapeHtml(f.m.t)}</span></div>
        </div>`).join("")
        : `<div class="vacio">Nadie ha escrito en los últimos 15 minutos. ¡Saluda!</div>`;
      if (abajo || !chatLista.dataset.listo) chatLista.scrollTop = chatLista.scrollHeight;
      chatLista.dataset.listo = "1";
    }
    // Lo nuevo de otros: cuenta en el botón mientras el chat no se ve.
    const visible = abierto || (ancho.matches && activo);
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
      chatBtn.textContent = falta > 0 ? `${Math.ceil(falta / 1000)} s` : "Enviar";
      chatBtn.title = falta > 0 ? "Se puede escribir un mensaje cada 20 segundos" : "";
      if (!falta && cuenta) { clearInterval(cuenta); cuenta = 0; }
    };
    tic();
    if (esperaChat(ultimoMio, fb.ahora()) > 0) cuenta = setInterval(tic, 250);
  }

  chatForm.onsubmit = async ev => {
    ev.preventDefault();
    const u = ctx.usuario();
    const texto = limpiaChat(chatCampo.value);
    if (!u || !texto || enviando || esperaChat(ultimoMio, fb.ahora()) > 0) return;
    enviando = true;
    espera();
    chatCampo.value = "";
    try {
      await fb.mandaChatGeneral({ uid: u.uid, nombre: u.name }, texto, CHAT_LARGO);
      ultimoMio = fb.ahora();
      nota("");
    } catch (e) {
      /* Lo que no salió vuelve al campo: perder una frase es peor que no
         mandarla. Un PERMISSION_DENIED es la espera de la regla (otra
         pestaña escribió hace poco) o las reglas sin publicar. */
      if (!chatCampo.value) chatCampo.value = texto;
      const x = await fb.leerUltimoChatGeneral(u.uid).catch(() => null);
      if (x && Number.isFinite(x.at)) ultimoMio = x.at;
      nota(esPermiso(e)
        ? (esperaChat(ultimoMio, fb.ahora()) > 0 ? "Espera unos segundos: se puede escribir un mensaje cada 20 s." : "No se pudo enviar: el chat general espera que se publiquen las reglas de Firebase.")
        : "No se pudo enviar. Revisa la conexión e inténtalo otra vez.");
    }
    enviando = false;
    espera();
    if (!window.matchMedia("(pointer: coarse)").matches) chatCampo.focus();
  };

  function abre(si) {
    abierto = !!si;
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
  const tecla = ev => { if (ev.key === "Escape" && abierto) { ev.preventDefault(); abre(false); } };
  document.addEventListener("keydown", tecla);

  /* ---------- encender y apagar ---------- */
  const alAncho = () => {
    if (ancho.matches && abierto) abre(false);
    if (activo && ancho.matches && ctx.usuario()) engancha(); else suelta();
    vista.w = 0;
    chatFirma = "";
    pintaChat();
    arranca();
  };
  ancho.addEventListener("change", alAncho);
  const alVer = () => { if (!document.hidden) { vista.w = 0; arranca(); } };
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
     actual lleva rieles. Barato si nada cambió. */
  function pon(si) {
    if (muerto) return;
    const u = ctx.usuario(), uid = u ? u.uid : "";
    const cambio = si !== activo || uid !== quien;
    activo = !!si;
    document.documentElement.classList.toggle("jg-rieles", activo);
    if (activo) ponScroll();
    if (!activo && abierto) abre(false);
    if (cambio) {
      if (uid !== quien) {
        sueltaChat(); suelta(); comprobadas.clear(); ultimoMio = null;
        for (const t of tarjetas) { t.repro = null; t.entrada = null; t.estado = "cargando"; t.filaFirma = ""; pintaFila(t); }
        vista.t = null;
      }
      quien = uid;
      pintaPuertaIzq(!u);
      if (activo && u) { enganchaChat(); if (ancho.matches) engancha(); }
      else { sueltaChat(); suelta(); }
      chatFirma = "";
      pintaChat();
      espera();
    } else if (activo) {
      // Otro día (o la popularidad que llegó reordena la alineación).
      if (u && ancho.matches && armaLinea()) engancha();
      // Un perfil que llegó (apodo, foto, marco): los pies y el chat lo recogen.
      vista.pieFirma = "";
      pintaPie();
      for (const t of tarjetas) { t.filaFirma = ""; pintaFila(t); }
      pintaChat();
    }
    arranca();
  }

  function destruir() {
    muerto = true;
    suelta(); sueltaChat();
    ancho.removeEventListener("change", alAncho);
    document.removeEventListener("visibilitychange", alVer);
    document.removeEventListener("keydown", tecla);
    window.removeEventListener("scroll", alScroll);
    document.documentElement.classList.remove("jg-rieles", "jg-cg-abierto");
    izq.remove(); chat.remove(); fondo.remove(); fab.remove();
  }

  return { pon, destruir, abre };
}
