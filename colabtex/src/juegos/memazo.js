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
import { MZ_NOTAS, MZ_LARGO, MZ_REVELA_MS, MZ_RESUMEN_MS, ofertasMemazo, jugadaExternaMemazo } from "./motor.js";
import { PLANTILLAS, cajasDe, memeDe, ajustaTextos, ponTexto } from "./memazo-plantillas.js";
import { plantillasImgflip, gifsGiphy, eligeTres, cajasPorDefecto } from "./memazo-fuentes.js";
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
  /* Lo que llevo escrito en la ronda: la plantilla elegida (su clave: el id
     de un dibujo, o `if:…`/`gif:…`), los textos de cada una y, para las de
     afuera, la imagen con las cajas donde las dejé. */
  let borrador = { r: 0, p: "", x: {}, ext: {}, vuelta: 0, q: "" };
  /* Las plantillas de afuera de esta sala: `{estado: cargando|listo|error, lista}`,
     y la búsqueda en curso. `vistas` guarda cada plantilla ofrecida por su clave. */
  let fuente = { estado: "", lista: [] }, busqueda = { q: "", estado: "", lista: [] }, tBusca = null;
  const vistas = {};
  let arrastre = null;
  let enviado = "";   // lo último que mandé, para avisar de cambios sin enviar
  let sonadaR = 0;    // la ronda cuyas plantillas ya sonaron al repartirse
  /* Por qué no entró el último envío. Sin esto un rechazo de la base
     (PERMISSION_DENIED) dejaba el botón mudo y nadie sabía que no se mandó. */
  let fallo = "";

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
    host.addEventListener("pointerdown", alAgarrar);
    tic = setInterval(alTic, 250);
    /* Anton llega de Google Fonts después del primer ajuste: con la letra
       de reserva los textos se habrían medido más estrechos. */
    try { document.fonts && document.fonts.load("1em Anton").then(() => { if (host) ajustaTextos(host); }, () => {}); } catch (e) {}
  }

  function destruir() {
    muerto = true;
    clearInterval(tic); clearTimeout(tAuto); clearTimeout(tBusca);
    sueltaArrastre();
    if (host) { host.removeEventListener("click", alClic); host.removeEventListener("input", alEscribir); host.removeEventListener("pointerdown", alAgarrar); host.innerHTML = ""; }
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

  const miAsiento = () => est.jugadores.findIndex(j => j.uid === uid);
  const esExterna = k => /^(if|gif):/.test(k || "");
  /* La plantilla de una clave: `{p}` para un dibujo, la imagen con sus cajas para las de afuera. */
  const planDe = k => esExterna(k) ? borrador.ext[k] : { p: k };
  const nCajas = k => esExterna(k) ? (borrador.ext[k] ? borrador.ext[k].c.length : 0) : cajasDe(k).length;
  const textosDe = k => {
    const n = nCajas(k), t = borrador.x[k] || (borrador.x[k] = []);
    while (t.length < n) t.push("");
    t.length = n;
    return t;
  };
  const claveDe = pl => PLANTILLAS[pl.p] ? pl.p : pl.p + ":" + pl.u;

  /* Las tres de dibujo que me tocan (también el plan B si la API falla). */
  const ofertasDibujo = () => ofertasMemazo(p.semilla, est.r, miAsiento()).map(id => ({ p: id, n: PLANTILLAS[id].nombre }));

  function cargaFuente() {
    if (est.fuente === "dibujos" || fuente.estado) return;
    fuente = { estado: "cargando", lista: [] };
    const pide = est.fuente === "gif" ? gifsGiphy() : plantillasImgflip();
    pide.then(l => { fuente = { estado: "listo", lista: l }; }, e => { console.warn("[memazo] plantillas de afuera", e); fuente = { estado: "error", lista: [] }; })
      .then(() => { if (!muerto) pinta(); });
  }

  /* Lo que se ofrece ahora: el resultado de la búsqueda, tres de la
     fuente de la sala, o tres dibujos si esa fuente no respondió. */
  function ofertas() {
    if (borrador.q.trim() && busqueda.q === borrador.q.trim() && busqueda.estado === "listo") return busqueda.lista.slice(0, 9);
    if (est.fuente === "dibujos" || fuente.estado === "error") return ofertasDibujo();
    if (fuente.estado !== "listo") return [];
    return eligeTres(fuente.lista, Number(p.semilla) || 0, est.r, miAsiento(), borrador.vuelta);
  }

  function elige(pl) {
    const k = claveDe(pl);
    if (esExterna(k) && !borrador.ext[k]) borrador.ext[k] = { p: pl.p, u: pl.u, w: pl.w, h: pl.h, n: pl.n, c: cajasPorDefecto(pl.cajas) };
    borrador.p = k;
  }

  function preparaBorrador() {
    if (borrador.r !== est.r) { borrador = { r: est.r, p: "", x: {}, ext: {}, vuelta: 0, q: "" }; enviado = ""; fallo = ""; }
    cargaFuente();
    if (!borrador.p || (!esExterna(borrador.p) && !PLANTILLAS[borrador.p])) {
      const o = ofertas();
      if (o.length) elige(o[0]);
    }
  }

  function editor() {
    const k = borrador.p;
    const afuera = est.fuente !== "dibujos" && fuente.estado !== "error";
    const lienzo = k ? memeDe(planDe(k), textosDe(k), { vacias: true, clase: "jg-mz-vacias" + (esExterna(k) ? " jg-mz-movible" : ""), editable: esExterna(k) })
      : `<div class="jg-mz-aviso grande">⏳ Trayendo plantillas…</div>`;
    const credito = est.fuente === "gif" && fuente.estado !== "error" ? "Powered by GIPHY"
      : est.fuente === "reales" && fuente.estado !== "error" ? "Plantillas de Imgflip" : "";
    const falla = est.fuente !== "dibujos" && fuente.estado === "error"
      ? `<div class="jg-mz-falla">${est.fuente === "gif" ? "No se pudo hablar con GIPHY (¿falta la clave en la base?)" : "No se pudo traer la lista de Imgflip"}: te tocan plantillas de la casa.</div>` : "";
    return `<div class="jg-mz-editor">
      <div class="jg-mz-lienzo">${lienzo}</div>
      <div class="jg-mz-panel">
        <div class="jg-mz-tit">Elige plantilla <button class="jg-mz-mini" data-otras="1" title="Otras tres">🔀 Otras</button></div>
        ${falla}
        ${afuera ? `<input class="jg-mz-busca" id="mzBusca" type="search" maxlength="50" value="${esc(borrador.q)}" placeholder="${est.fuente === "gif" ? "Busca un GIF…" : "Busca una plantilla (en inglés: drake, cat…)"}" autocomplete="off">` : ""}
        <div class="jg-mz-ofertas" id="mzOfertas"></div>
        ${credito ? `<div class="jg-mz-credito">${credito}</div>` : ""}
        <div class="jg-mz-tit">Escribe${esExterna(k) ? ` <span class="jg-mz-cajas"><button class="jg-mz-mini" data-cajas="-1" title="Un texto menos">−</button><button class="jg-mz-mini" data-cajas="1" title="Un texto más">＋</button></span>` : ""}</div>
        <div class="jg-mz-campos">${k ? textosDe(k).map((t, i) => `<label><span>Texto ${i + 1}</span>
          <textarea data-k="${i}" maxlength="${MZ_LARGO}" rows="2" placeholder="${i ? "…y aquí" : "Escribe algo gracioso"}" translate="no">${esc(t)}</textarea></label>`).join("") : ""}</div>
        ${esExterna(k) ? `<div class="jg-mz-ayuda">Arrastra cada texto sobre la imagen para ponerlo donde quieras; la esquina de abajo lo agranda.</div>` : ""}
        <div class="jg-mz-envio"><button class="btn" id="mzEnviar">¡Listo!</button><span class="jg-mz-estado" id="mzEstado"></span></div>
      </div>
    </div>`;
  }

  /* Las miniaturas de la oferta van aparte del editor: la búsqueda las
     cambia sin tocar lo escrito. */
  function pintaOfertas() {
    const el = host && host.querySelector("#mzOfertas");
    if (!el) return;
    const o = ofertas();
    const buscando = borrador.q.trim() && (busqueda.q !== borrador.q.trim() || busqueda.estado === "cargando");
    const firma = [borrador.p, buscando, busqueda.estado, fuente.estado, o.map(claveDe).join(",")].join("|");
    if (el.dataset.firma === firma) return;
    el.dataset.firma = firma;
    for (const pl of o) vistas[claveDe(pl)] = pl;
    el.innerHTML = buscando ? `<div class="jg-mz-nada">Buscando…</div>`
      : borrador.q.trim() && busqueda.estado === "error" ? `<div class="jg-mz-nada">La búsqueda falló.</div>`
      : !o.length ? `<div class="jg-mz-nada">${fuente.estado === "cargando" ? "Cargando…" : "Nada por aquí."}</div>`
      : o.map(pl => {
        const k = claveDe(pl);
        const vista = esExterna(k) ? (borrador.ext[k] || { ...pl, c: cajasPorDefecto(pl.cajas) }) : pl;
        return `<button class="jg-mz-oferta${k === borrador.p ? " sel" : ""}" data-oferta="${esc(k)}" title="${esc(pl.n || "")}">
          ${memeDe(vista, borrador.x[k] || [], { mini: true })}<span translate="no">${esc(pl.n || "")}</span></button>`;
      }).join("");
    ajustaTextos(el);
  }

  /* Lo que mandaría ahora: la plantilla y sus textos (y la imagen con sus cajas). */
  function jugadaMeme() {
    const k = borrador.p;
    if (!k) return null;
    const x = textosDe(k).map(t => (t || "").trim());
    if (!esExterna(k)) return { p: k, x };
    return jugadaExternaMemazo(borrador.ext[k], x);
  }

  function estadoEnvio() {
    const el = host && host.querySelector("#mzEstado"), btn = host && host.querySelector("#mzEnviar");
    if (!el || !btn) return;
    const ya = (est.listosYa || []).includes(uid);
    const j = jugadaMeme();
    const hay = !!j && j.x.some(t => t);
    btn.disabled = enviando || !hay;
    btn.textContent = ya ? "Actualizar" : "¡Listo!";
    el.classList.toggle("mal", !!fallo);
    el.textContent = fallo ? fallo : !ya ? (hay ? "" : "Escribe al menos un texto.")
      : JSON.stringify(j) === enviado ? "✓ Enviado. Puedes corregirlo hasta que se acabe el tiempo." : "Tienes cambios sin enviar.";
  }

  /* ---------- mover y agrandar los textos (plantillas de afuera) ---------- */
  function alAgarrar(ev) {
    const caja = ev.target.closest(".jg-mz-lienzo .jg-mz-movible .jg-mz-caja");
    if (!caja || vistaVista !== "escribir" || !esExterna(borrador.p)) return;
    const meme = caja.closest(".jg-mz-meme"), r = meme.getBoundingClientRect();
    const k = Number(caja.getAttribute("data-k")), b = borrador.ext[borrador.p].c[k];
    if (!b) return;
    ev.preventDefault();
    arrastre = { k, caja, meme, r, b0: b.slice(), x0: ev.clientX, y0: ev.clientY, tam: !!ev.target.closest(".jg-mz-asa") };
    caja.classList.add("agarrada");
    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", sueltaArrastre);
    window.addEventListener("pointercancel", sueltaArrastre);
  }
  function alMover(ev) {
    const a = arrastre;
    if (!a) return;
    const dx = (ev.clientX - a.x0) / a.r.width * 100, dy = (ev.clientY - a.y0) / a.r.height * 100;
    const c = borrador.ext[borrador.p] && borrador.ext[borrador.p].c;
    if (!c || !c[a.k]) return;
    let [x, y, w, h] = a.b0;
    if (a.tam) { w = Math.max(8, Math.min(100 - x, w + dx)); h = Math.max(6, Math.min(100 - y, h + dy)); }
    else { x = Math.max(0, Math.min(100 - w, x + dx)); y = Math.max(0, Math.min(100 - h, y + dy)); }
    c[a.k] = [x, y, w, h];
    Object.assign(a.caja.style, { left: x + "%", top: y + "%", width: w + "%", height: h + "%" });
    if (a.tam) ajustaTextos(a.meme);
  }
  function sueltaArrastre() {
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerup", sueltaArrastre);
    window.removeEventListener("pointercancel", sueltaArrastre);
    if (!arrastre) return;
    arrastre.caja.classList.remove("agarrada");
    ajustaTextos(arrastre.meme);
    arrastre = null;
    const k = borrador.p, mini = host && host.querySelector(`.jg-mz-oferta[data-oferta="${CSS.escape(k)}"]`);
    if (mini && esExterna(k)) { mini.querySelector(".jg-mz-meme").outerHTML = memeDe(borrador.ext[k], textosDe(k), { mini: true }); ajustaTextos(mini); }
    estadoEnvio();
  }

  /* Buscar: en Imgflip se filtra la lista que ya está; en GIPHY se pregunta. */
  function busca() {
    const q = borrador.q.trim();
    clearTimeout(tBusca);
    if (!q) { busqueda = { q: "", estado: "", lista: [] }; pintaOfertas(); return; }
    if (est.fuente === "reales") {
      const n = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      busqueda = { q, estado: "listo", lista: fuente.lista.filter(m => n(m.n).includes(n(q))) };
      pintaOfertas();
      return;
    }
    busqueda = { q, estado: "cargando", lista: [] };
    pintaOfertas();
    tBusca = setTimeout(() => {
      gifsGiphy(q).then(l => ({ q, estado: "listo", lista: l }), () => ({ q, estado: "error", lista: [] }))
        .then(b => { if (!muerto && borrador.q.trim() === q) { busqueda = b; pintaOfertas(); } });
    }, 450);
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
        <div class="jg-mz-grande">${memeDe(mm)}</div>
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
        <div class="jg-mz-grande">${memeDe(mm)}</div>
        ${abajo}
        <div class="jg-mz-faltan">${ya} de ${voy} ya calificaron</div>
      </div>`
    };
  }

  function tarjeta(mm, grande) {
    const j = jugadorDe(mm.uid) || { color: "#888" };
    return `<figure class="jg-mz-tarjeta${grande ? " grande" : ""}">${memeDe(mm, mm.x, { mini: !grande })}
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
      pieza = { firma: ["escribir", est.r, borrador.p, nCajas(borrador.p), fuente.estado].join("|"), html: editor(), sonido: () => { if (sonadaR !== est.r) { sonadaR = est.r; suena("reparte"); } } };
    } else if (v === "escribir") pieza =
      { firma: "mira|" + est.r, html: `<div class="jg-mz-aviso grande">✍️ Están escribiendo sus memes…<br><small>Los verás uno por uno cuando acaben.</small></div>` };
    else if (v === "votar") pieza = votacion();
    else if (v === "revela") pieza = revela();
    else if (v === "resumen") pieza = resumen();
    else pieza = galeria();
    const cambio = set("mzEscena", pieza.firma, pieza.html, el => ajustaTextos(el));
    if (cambio && pieza.sonido && antes !== null) pieza.sonido();
    if (v === "escribir" && soy()) { pintaOfertas(); estadoEnvio(); }

    let pie;
    if (v === "espera") pie = "Pásale el enlace de la sala a tus amigos: de 2 a 10, y cuantos más, mejor.";
    else if (v === "escribir") pie = "Elige una plantilla y ponle texto. Cuando todos manden el suyo, o se acabe el tiempo, se vota.";
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
    if (!est || borrador.r !== est.r) return;
    if (ev.target.id === "mzBusca") { borrador.q = ev.target.value.slice(0, 50); busca(); return; }
    const ta = ev.target.closest && ev.target.closest(".jg-mz-campos textarea");
    if (!ta || !borrador.p) return;
    const k = Number(ta.getAttribute("data-k"));
    const lista = textosDe(borrador.p);
    lista[k] = ta.value.replace(/\n/g, " ").slice(0, MZ_LARGO);
    ponTexto(host.querySelector(".jg-mz-lienzo .jg-mz-meme"), k, lista[k]);
    const mini = host.querySelector(`.jg-mz-oferta[data-oferta="${CSS.escape(borrador.p)}"] .jg-mz-meme`);
    if (mini) ponTexto(mini, k, lista[k]);
    estadoEnvio();
  }

  async function alClic(ev) {
    if (!est || est.fase !== "jugando") return;
    const of = ev.target.closest(".jg-mz-oferta");
    if (of && vistaVista === "escribir") {
      const pl = vistas[of.getAttribute("data-oferta")];
      if (pl) { elige(pl); suena("clic"); pinta(); }
      return;
    }
    if (ev.target.closest("[data-otras]") && vistaVista === "escribir") {
      borrador.vuelta++; borrador.q = "";
      const b = host.querySelector("#mzBusca");
      if (b) b.value = "";
      busqueda = { q: "", estado: "", lista: [] };
      suena("reparte");
      pintaOfertas();
      return;
    }
    const cj = ev.target.closest("[data-cajas]");
    if (cj && vistaVista === "escribir" && esExterna(borrador.p)) {
      const c = borrador.ext[borrador.p].c, d = Number(cj.getAttribute("data-cajas"));
      if (d > 0 && c.length < 5) c.push([20, 40, 60, 18]);
      if (d < 0 && c.length > 1) c.pop();
      pinta();
      return;
    }
    if (ev.target.closest("#mzEnviar") && vistaVista === "escribir" && !enviando) {
      const j = jugadaMeme();
      if (!j || !j.x.some(t => t)) return;
      enviando = true; fallo = ""; estadoEnvio();
      try {
        if (await jugar({ t: "meme", uid, r: est.r, ...j, at: ahora() })) {
          enviado = JSON.stringify(j);
          suena("entra");
        } else fallo = "No se pudo mandar. Prueba otra vez.";
      } catch (e) {
        console.warn("[memazo] no se pudo mandar el meme", e);
        fallo = /permission/i.test(String(e && (e.code || e.message))) ? "La base rechazó el meme (¿reglas sin publicar?)." : "No se pudo mandar: " + ((e && e.message) || e);
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
      catch (e) { console.warn("[memazo] no se pudo calificar", e); }
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
