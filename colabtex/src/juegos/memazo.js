/* Memazo — escribe el meme, califica el de los demás.
 *
 * El reductor (`redMemazo` en motor.js) decide todo; esta pantalla lo
 * dibuja y escribe sola las jugadas que solo dependen del reloj. Cuatro
 * decisiones:
 *
 * - **Lo que se ve depende de la hora, no solo del registro.** Al
 *   cerrarse un meme el siguiente empieza enseguida, pero durante
 *   `MZ_REVELA_MS` se enseña la nota del anterior (y durante
 *   `MZ_RESUMEN_MS` el podio de la ronda antes de escribir la siguiente):
 *   el plazo del motor ya cuenta ese rato. Un tic de 250 ms recalcula la
 *   «vista» y solo repinta cuando cambia; el resto del tic es el reloj.
 * - **Las jugadas del reloj van en relevo.** `arranca` y `cierra` las
 *   escribe la pantalla del primer asiento que sigue en la sala en cuanto
 *   tocan; las demás esperan 1,8 s más por cada asiento, por si esa
 *   pestaña se durmió. El reductor ignora las que llegan sobrando.
 * - **El editor no se repinta al llegar jugadas.** Lo que se escribe vive
 *   en `borrador` (por plantilla, para que cambiar de plantilla no borre
 *   nada) y la vista previa se toca a mano al teclear: un `innerHTML` por
 *   firma se llevaría el cursor y lo escrito.
 * - **Mientras se vota no se dice quién falta.** El autor del meme es el
 *   único que no califica, así que marcar quién ya votó lo delataría; se
 *   cuenta cuántos, no quiénes. El registro sí lo lleva (cada jugada va
 *   firmada): quien abra las herramientas del navegador lo verá, que es
 *   el mismo límite honesto que el resto de los juegos.
 */
import { MZ_NOTAS, MZ_LARGO, MZ_REVELA_MS, MZ_RESUMEN_MS, ofertasMemazo } from "./motor.js";
import { PLANTILLAS, cajasDe, memeHtml, ajustaTextos, ponTexto } from "./memazo-plantillas.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOMBRE_NOTA = { 1: "Tomatazo", 2: "Meh", 3: "Bueno", 4: "Jajaja", 5: "¡Fuego!" };
const RELEVO_MS = 1800;

export function crearMemazo(ctx) {
  const { uid, jugar, terminar, ahora, mirando } = ctx;
  let host = null, muerto = false, est = null, p = null;
  let tic = null, tAuto = null, hecho = "", hechoEn = 0, enviando = false, votando = false;
  let vistaVista = "", antes = null, ocupadoAntes = false;
  const firmas = {};
  /* Lo que llevo escrito en la ronda: la plantilla elegida y los textos de cada una. */
  let borrador = { r: 0, p: "", x: {} };
  let enviado = "";   // lo último que mandé, para avisar de cambios sin enviar
  let sonadaR = 0;    // la ronda cuyas plantillas ya sonaron al repartirse

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-memazo">
        <div class="jg-barra">
          <div class="jg-fase" id="mzFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-mz-reloj" id="mzReloj"></div>
        </div>
        <div class="jg-mz-escenario">
          <div class="jg-mz-asientos" id="mzAsientos"></div>
          <div class="jg-mz-escena" id="mzEscena"></div>
        </div>
        <div class="jg-pie" id="mzPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
    host.addEventListener("input", alEscribir);
    tic = setInterval(alTic, 250);
    /* Anton llega de Google Fonts después del primer ajuste: con la letra
       de reserva los textos se habrían medido más estrechos. */
    try { document.fonts && document.fonts.load("1em Anton").then(() => { if (host) ajustaTextos(host); }, () => {}); } catch (e) {}
  }

  function destruir() {
    muerto = true;
    clearInterval(tic); clearTimeout(tAuto);
    if (host) { host.removeEventListener("click", alClic); host.removeEventListener("input", alEscribir); host.innerHTML = ""; }
    host = null;
  }

  const jugadorDe = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return u === uid ? "Tú" : j ? j.nombre : "Alguien"; };
  const soy = () => !mirando && !!jugadorDe(uid);
  const activos = () => est.jugadores.filter(j => !est.fuera[j.uid]).map(j => j.uid);

  function set(id, firma, html, despues) {
    if (firmas[id] === firma) return false;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (!el) return false;
    el.innerHTML = html;
    if (despues) despues(el);
    return true;
  }

  /* Qué se enseña ahora: depende de la etapa y de cuánto hace que empezó. */
  function vista() {
    if (!est) return "espera";
    const t = ahora();
    if (est.fase === "espera") return "espera";
    if (est.fase === "fin") {
      const ult = est.historial[est.historial.length - 1];
      if (est.motivo !== "abandono" && est.cierre && ult && ult.memes.length && t < est.cierre + MZ_REVELA_MS) return "revela";
      return "fin";
    }
    if (est.etapa === "arranque") return "arranque";
    if (est.etapa === "escribir") return est.r > 1 && t < est.desde + MZ_RESUMEN_MS && est.historial.length ? "resumen" : "escribir";
    if (est.etapa === "votar") return est.m > 0 && t < est.desde + MZ_REVELA_MS ? "revela" : "votar";
    return "espera";
  }
  /* El meme cuya nota se está enseñando. */
  function revelado() {
    if (est.fase === "fin") { const h = est.historial[est.historial.length - 1]; return h && h.memes[h.memes.length - 1]; }
    return est.memes[est.m - 1];
  }

  /* ---------- las piezas ---------- */
  function chip(j, extra = "") {
    const fuera = est.fuera[j.uid];
    return `<span class="jg-mz-chip${fuera ? " fuera" : ""}${j.uid === uid ? " yo" : ""}" style="--c:${esc(j.color || "#888")}">
      <span class="jg-mz-ava jg-con-marco">${ctx.avatar ? ctx.avatar(j, 26) : ""}</span>
      <span class="jg-mz-nom" translate="no">${esc(j.uid === uid ? "Tú" : j.nombre || "?")}</span>
      <b>${est.puntos[j.uid] || 0}</b>${extra}</span>`;
  }

  function asientos(v) {
    const listos = new Set(est.listosYa || []);
    const firma = [v, est.r, est.jugadores.map(j => j.uid + (est.fuera[j.uid] ? "x" : "") + (est.puntos[j.uid] || 0) + (listos.has(j.uid) ? "l" : "")).join(",")].join("|");
    set("mzAsientos", firma, est.jugadores.map(j => {
      let extra = "";
      if (v === "escribir" && !est.fuera[j.uid]) extra = listos.has(j.uid) ? `<i class="ok" title="Ya mandó su meme">✓</i>` : `<i class="esc" title="Escribiendo">✎</i>`;
      return chip(j, extra);
    }).join(""));
  }

  function ofertas() { return ofertasMemazo(p.semilla, est.r, est.jugadores.findIndex(j => j.uid === uid)); }

  function preparaBorrador() {
    const ofs = ofertas();
    if (borrador.r !== est.r) { borrador = { r: est.r, p: ofs[0], x: {} }; enviado = ""; }
    if (!ofs.includes(borrador.p)) borrador.p = ofs[0];
  }

  function editor() {
    const ofs = ofertas();
    const id = borrador.p, textos = borrador.x[id] || (borrador.x[id] = cajasDe(id).map(() => ""));
    return `<div class="jg-mz-editor">
      <div class="jg-mz-lienzo">${memeHtml(id, textos, { vacias: true, clase: "jg-mz-vacias" })}</div>
      <div class="jg-mz-panel">
        <div class="jg-mz-tit">Elige plantilla</div>
        <div class="jg-mz-ofertas">${ofs.map(o => `<button class="jg-mz-oferta${o === id ? " sel" : ""}" data-oferta="${o}" title="${esc(PLANTILLAS[o].nombre)}">
          ${memeHtml(o, borrador.x[o] || [])}<span>${esc(PLANTILLAS[o].nombre)}</span></button>`).join("")}</div>
        <div class="jg-mz-tit">Escribe</div>
        <div class="jg-mz-campos">${textos.map((t, k) => `<label><span>Texto ${k + 1}</span>
          <textarea data-k="${k}" maxlength="${MZ_LARGO}" rows="2" placeholder="${k ? "…y aquí" : "Escribe algo gracioso"}" translate="no">${esc(t)}</textarea></label>`).join("")}</div>
        <div class="jg-mz-envio"><button class="btn" id="mzEnviar">¡Listo!</button><span class="jg-mz-estado" id="mzEstado"></span></div>
      </div>
    </div>`;
  }

  function estadoEnvio() {
    const el = host && host.querySelector("#mzEstado"), btn = host && host.querySelector("#mzEnviar");
    if (!el || !btn) return;
    const ya = (est.listosYa || []).includes(uid);
    const ahoraVa = JSON.stringify([borrador.p, borrador.x[borrador.p] || []]);
    const hay = (borrador.x[borrador.p] || []).some(t => t.trim());
    btn.disabled = enviando || !hay;
    btn.textContent = ya ? "Actualizar" : "¡Listo!";
    el.textContent = !ya ? (hay ? "" : "Escribe al menos un texto.")
      : ahoraVa === enviado ? "✓ Enviado. Puedes corregirlo hasta que se acabe el tiempo." : "Tienes cambios sin enviar.";
  }

  function notas(mm) {
    return Object.values(mm.notas).sort((a, b) => b - a).map(v => `<i title="${NOMBRE_NOTA[v]}">${MZ_NOTAS[v]}</i>`).join("");
  }

  function revela() {
    const mm = revelado();
    if (!mm) return { firma: "nada", html: "" };
    const j = jugadorDe(mm.uid) || { nombre: "?", uid: mm.uid };
    const n = Object.keys(mm.notas).length, media = n ? mm.total / n : 0;
    return {
      firma: "revela|" + est.r + "|" + est.m + "|" + mm.uid,
      html: `<div class="jg-mz-revela${media >= 4 ? " top" : ""}">
        <div class="jg-mz-grande">${memeHtml(mm.p, mm.x)}</div>
        <div class="jg-mz-autor">
          <div class="jg-mz-de">Era de</div>
          <div class="jg-mz-quien" style="--c:${esc(j.color || "#888")}"><span class="jg-con-marco">${ctx.avatar ? ctx.avatar(j, 44) : ""}</span><b translate="no">${esc(nombreDe(mm.uid))}</b></div>
          <div class="jg-mz-notas-vistas">${notas(mm) || "<em>Nadie lo calificó</em>"}</div>
          <div class="jg-mz-suma">+${mm.total}</div>
        </div>
      </div>`,
      sonido: () => suena(media >= 4.5 ? "estalla" : media >= 3 ? "capta" : "pierde", media >= 4.5 ? 8 : Math.round(media))
    };
  }

  function votacion() {
    const mm = est.memes[est.m];
    const autor = mm.uid === uid, mia = mm.notas[uid];
    const voy = activos().filter(u => u !== mm.uid).length, ya = Object.keys(mm.notas).length;
    let abajo;
    if (!soy()) abajo = `<div class="jg-mz-aviso">Los jugadores están calificando este meme.</div>`;
    else if (autor) abajo = `<div class="jg-mz-aviso">🤫 Es el tuyo. Pon cara de póker mientras los demás lo califican.</div>`;
    else if (mia) abajo = `<div class="jg-mz-aviso">Le pusiste ${MZ_NOTAS[mia]} ${NOMBRE_NOTA[mia]}. Esperando a los demás…</div>`;
    else abajo = `<div class="jg-mz-botones">${[1, 2, 3, 4, 5].map(v => `<button class="jg-mz-nota" data-nota="${v}" title="${NOMBRE_NOTA[v]}"><i>${MZ_NOTAS[v]}</i><span>${NOMBRE_NOTA[v]}</span></button>`).join("")}</div>`;
    return {
      firma: ["votar", est.r, est.m, autor, mia || 0, ya, voy, soy()].join("|"),
      html: `<div class="jg-mz-voto">
        <div class="jg-mz-cuenta">Meme ${est.m + 1} de ${est.total} · Ronda ${est.r} de ${est.rondas}</div>
        <div class="jg-mz-grande">${memeHtml(mm.p, mm.x)}</div>
        ${abajo}
        <div class="jg-mz-faltan">${ya} de ${voy} ya calificaron</div>
      </div>`
    };
  }

  function tarjeta(mm, grande) {
    const j = jugadorDe(mm.uid) || { color: "#888" };
    return `<figure class="jg-mz-tarjeta${grande ? " grande" : ""}">${memeHtml(mm.p, mm.x)}
      <figcaption style="--c:${esc(j.color || "#888")}"><span translate="no">${esc(nombreDe(mm.uid))}</span><b>${mm.total}</b><s>${notas(mm)}</s></figcaption></figure>`;
  }
  const ordenados = h => h.memes.slice().sort((a, b) => b.total - a.total);

  function resumen() {
    const h = est.historial[est.historial.length - 1];
    const o = ordenados(h);
    return {
      firma: "resumen|" + h.r,
      html: `<div class="jg-mz-resumen">
        <div class="jg-mz-cuenta">Así quedó la ronda ${h.r}</div>
        ${o.length ? `<div class="jg-mz-podio">${tarjeta(o[0], true)}<div class="jg-mz-resto">${o.slice(1).map(mm => tarjeta(mm)).join("")}</div></div>`
          : `<div class="jg-mz-aviso">Nadie mandó un meme en esta ronda.</div>`}
        <div class="jg-mz-faltan">Ahora viene la ronda ${est.r} de ${est.rondas}…</div>
      </div>`,
      sonido: () => suena("cosecha")
    };
  }

  function galeria() {
    const todos = est.historial.flatMap(h => h.memes);
    const mejor = todos.slice().sort((a, b) => b.total - a.total)[0];
    return {
      firma: "fin|" + est.historial.length + "|" + todos.length,
      html: `<div class="jg-mz-galeria">
        ${mejor ? `<div class="jg-mz-cuenta">🏆 El meme de la partida</div><div class="jg-mz-podio">${tarjeta(mejor, true)}</div>` : `<div class="jg-mz-aviso">Esta partida se quedó sin memes.</div>`}
        ${est.historial.filter(h => h.memes.length).map(h => `<div class="jg-mz-cuenta">Ronda ${h.r}</div><div class="jg-mz-resto">${ordenados(h).map(mm => tarjeta(mm)).join("")}</div>`).join("")}
      </div>`
    };
  }

  /* ---------- pintar ---------- */
  function pinta() {
    if (!host || !est) return;
    const v = vista();
    vistaVista = v;
    let fase;
    if (v === "espera") fase = "Esperando a que entre la gente…";
    else if (v === "arranque") fase = "Repartiendo plantillas…";
    else if (v === "resumen") fase = `Fin de la ronda ${est.r - 1}`;
    else if (v === "escribir") fase = !soy() ? `Ronda ${est.r}: están escribiendo` : (est.listosYa || []).includes(uid) ? `Ronda ${est.r}: meme enviado` : `Ronda ${est.r}: ¡haz tu meme!`;
    else if (v === "votar") fase = soy() && est.memes[est.m].uid !== uid && !est.memes[est.m].notas[uid] ? "¡Califica este meme!" : "Calificando…";
    else if (v === "revela") fase = "¿De quién era?";
    else fase = est.motivo === "abandono" ? "Partida terminada por abandono" : est.ganador ? (est.ganador === uid ? "🏆 ¡Ganaste con tus memes!" : "Ganó " + nombreDe(est.ganador)) : "Empate de risas";
    set("mzFase", fase, `<span class="jg-mz-fase">${esc(fase)}</span>`);
    if (v !== "espera") asientos(v); else set("mzAsientos", "espera", "");

    let pieza = null;
    if (v === "espera") pieza = { firma: "espera", html: `<div class="jg-mz-aviso grande">🖼️ Memazo<br><small>Cuando entren todos empieza la primera ronda.</small></div>` };
    else if (v === "arranque") pieza = { firma: "arranque", html: `<div class="jg-mz-aviso grande">🎲 Barajando plantillas…</div>` };
    else if (v === "escribir" && soy()) {
      preparaBorrador();
      pieza = { firma: "escribir|" + est.r + "|" + borrador.p, html: editor(), sonido: () => { if (sonadaR !== est.r) { sonadaR = est.r; suena("reparte"); } } };
    } else if (v === "escribir") pieza =
      { firma: "mira|" + est.r, html: `<div class="jg-mz-aviso grande">✍️ Están escribiendo sus memes…<br><small>Los verás uno por uno cuando acaben.</small></div>` };
    else if (v === "votar") pieza = votacion();
    else if (v === "revela") pieza = revela();
    else if (v === "resumen") pieza = resumen();
    else pieza = galeria();
    const cambio = set("mzEscena", pieza.firma, pieza.html, el => ajustaTextos(el));
    if (cambio && pieza.sonido && antes !== null) pieza.sonido();
    if (v === "escribir" && soy()) estadoEnvio();

    let pie;
    if (v === "espera") pie = "Pásale el enlace de la sala a tus amigos: de 2 a 10, y cuantos más, mejor.";
    else if (v === "escribir") pie = "Elige una de tus tres plantillas y ponle texto. Cuando todos manden el suyo, o se acabe el tiempo, se vota.";
    else if (v === "votar" || v === "revela") pie = "🍅 1 · 😐 2 · 🙂 3 · 😂 4 · 🔥 5 puntos para el autor. No se sabe de quién es hasta que todos califican.";
    else if (v === "resumen") pie = "Los puntos de cada meme ya están en el marcador de arriba.";
    else if (v === "fin") pie = "Gana quien sumó más puntos con sus memes; a igualdad, quien sacó más 🔥.";
    else pie = "";
    set("mzPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
    reloj();
  }

  /* El número de arriba a la derecha: lo que le queda a la etapa (sin el
     rato del podio o de la nota, que no es tiempo de nadie). */
  function reloj() {
    const el = host && host.querySelector("#mzReloj");
    if (!el || !est) return;
    const v = vistaVista;
    let s = "";
    if ((v === "escribir" || v === "votar") && est.plazo) {
      const q = Math.max(0, Math.ceil((est.plazo - ahora()) / 1000));
      s = (v === "escribir" ? "✍️ " : "🗳️ ") + q + " s";
      el.classList.toggle("urge", q <= 10);
    }
    if (el.textContent !== s) el.textContent = s;
  }

  function alTic() {
    if (!est || muerto) return;
    const v = vista();
    if (v !== vistaVista) pinta(); else reloj();
    const oc = ocupado();
    if (ocupadoAntes && !oc && ctx.listo) ctx.listo();
    ocupadoAntes = oc;
  }

  /* ---------- las jugadas del reloj ---------- */
  function programa() {
    clearTimeout(tAuto);
    if (!soy() || !est || est.fase !== "jugando") return;
    const slot = activos().indexOf(uid);
    if (slot < 0) return;
    let clave, jug, cuando;
    if (est.etapa === "arranque") { clave = "arranca"; jug = { t: "arranca" }; cuando = 0; }
    else if (est.etapa === "escribir" || est.etapa === "votar") {
      clave = [est.etapa, est.r, est.m].join(".");
      jug = { t: "cierra", r: est.r, e: est.etapa, m: est.m };
      cuando = est.completa ? 0 : est.plazo + 400;
    } else return;
    /* Si mi jugada no movió nada (llegó con la hora un pelo antes del
       plazo), se reintenta pasado un rato. */
    if (hecho === clave && Date.now() - hechoEn < 5000) return;
    const espera = Math.max(0, cuando - ahora()) + slot * RELEVO_MS;
    tAuto = setTimeout(async () => {
      if (muerto || !est || est.fase !== "jugando") return;
      const ahoraClave = est.etapa === "arranque" ? "arranca" : [est.etapa, est.r, est.m].join(".");
      if (ahoraClave !== clave) return;
      hecho = clave; hechoEn = Date.now();
      try { await jugar({ ...jug, uid, at: ahora() }); } catch (e) { hecho = ""; }
      if (!muerto) setTimeout(() => { if (!muerto) programa(); }, 5200);
    }, espera);
  }

  /* ---------- lo que hace la gente ---------- */
  function alEscribir(ev) {
    const ta = ev.target.closest && ev.target.closest(".jg-mz-campos textarea");
    if (!ta || !est || borrador.r !== est.r) return;
    const k = Number(ta.getAttribute("data-k"));
    const lista = borrador.x[borrador.p] || (borrador.x[borrador.p] = []);
    lista[k] = ta.value.replace(/\n/g, " ").slice(0, MZ_LARGO);
    ponTexto(host.querySelector(".jg-mz-lienzo .jg-mz-meme"), k, lista[k]);
    const mini = host.querySelector(`.jg-mz-oferta[data-oferta="${borrador.p}"] .jg-mz-meme`);
    if (mini) ponTexto(mini, k, lista[k]);
    estadoEnvio();
  }

  async function alClic(ev) {
    if (!est || est.fase !== "jugando") return;
    const of = ev.target.closest(".jg-mz-oferta");
    if (of && vistaVista === "escribir") {
      borrador.p = of.getAttribute("data-oferta");
      suena("clic");
      pinta();
      return;
    }
    if (ev.target.closest("#mzEnviar") && vistaVista === "escribir" && !enviando) {
      const x = (borrador.x[borrador.p] || []).map(t => (t || "").trim());
      if (!x.some(t => t)) return;
      enviando = true; estadoEnvio();
      try {
        if (await jugar({ t: "meme", uid, r: est.r, p: borrador.p, x, at: ahora() })) {
          enviado = JSON.stringify([borrador.p, borrador.x[borrador.p] || []]);
          suena("entra");
        }
      } finally { if (!muerto) { enviando = false; estadoEnvio(); } }
      return;
    }
    const b = ev.target.closest(".jg-mz-nota");
    if (b && vistaVista === "votar" && !votando) {
      const mm = est.memes[est.m];
      if (!mm || mm.uid === uid || mm.notas[uid]) return;
      votando = true;
      const v = Number(b.getAttribute("data-nota"));
      suena(v >= 4 ? "capta" : "clic", v);
      try { await jugar({ t: "nota", uid, r: est.r, m: est.m, v, at: ahora() }); }
      finally { if (!muerto) votando = false; }
    }
  }

  /* El cartel del final espera a que se vea la nota del último meme. */
  function ocupado() { return !!est && est.fase === "fin" && vista() === "revela"; }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (antes) {
      const nuevos = (est.listosYa || []).filter(u => !(antes.listosYa || []).includes(u) && u !== uid).length;
      if (nuevos && est.etapa === "escribir") suena("ficha");
      if (est.etapa === "votar" && antes.etapa === "votar" && est.m === antes.m && est.memes[est.m] && antes.memes[antes.m]
        && Object.keys(est.memes[est.m].notas).length > Object.keys(antes.memes[antes.m].notas).length) suena("madera");
    }
    pinta();
    antes = est;
    programa();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) terminar(est.ganador, est.motivo);
  }

  return { montar, actualizar, destruir, ocupado };
}
