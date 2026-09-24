/* Flip 7 — pedir carta o plantarse, de dos a seis, normal o con venganza.
 *
 * Esta pantalla no decide nada: el reductor (`redFlip7` en motor.js)
 * sabe de quién es el turno, qué carta salió y quién se pasó. Aquí se
 * pinta eso y se mandan tres clases de jugada — pedir, plantarse y
 * apuntar una acción — más una que nadie pulsa:
 *
 * - **El aporte al robo va solo.** Cada carta sale de dos aportes, el
 *   de quien la recibe y el del siguiente asiento, y los dos navegadores
 *   los publican en cuanto el reductor los pide (`espera.k === "roba"`).
 *   Pedir carta ya lleva el propio dentro, así que en un turno normal
 *   solo falta el del vecino. Se espera un momento antes de mandarlo —
 *   un reparto a la velocidad de la red son seis cartas en medio segundo,
 *   y lo que se quiere es verlas caer — y bastante más al empezar una
 *   ronda, para que dé tiempo a leer cómo acabó la anterior.
 * - **Al acabar se revela la semilla** (`{t:"s"}`) antes de `terminar`,
 *   porque la regla de la base rechaza cualquier jugada con `fin` escrito.
 *   `auditaFlip7` rehace entonces cada aporte, en todas las pantallas.
 *
 * El repintado va por firmas, como en los demás juegos: reescribir el
 * innerHTML en cada tic reiniciaría la animación de la última carta.
 */
import { mazoF7, aporteF7, auditaFlip7, F7_SIETE } from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo que se tarda en mandar el propio aporte: entre robos, y al empezar
   una ronda nueva (el resumen de la anterior tiene que poder leerse). */
const PAUSA_ROBO = 550;
const PAUSA_RONDA = 2600;
/* Cuánto se espera a que los demás revelen su semilla antes de cerrar
   la partida igualmente: quien ya cerró la pestaña no va a hacerlo. */
const ESPERA_SEMILLAS = 6000;

const ACCION = {
  congela: { n: "Congelar", i: "❄" },
  tres: { n: "Voltea tres", i: "③" },
  segunda: { n: "Segunda oportunidad", i: "♥" },
  cuatro: { n: "Voltea cuatro", i: "④" },
  otra: { n: "Solo una más", i: "☝" },
  cambia: { n: "Intercambio", i: "⇄" },
  roba: { n: "Robo", i: "✋" },
  tira: { n: "Descarte", i: "✕" }
};

/* Un tono por número, del frío al cálido, como en la caja: a la hora de
   buscar el repetido en una fila se mira el color antes que la cifra. */
const TONO = ["#8a97a3", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#d946ef", "#8b5cf6", "#6366f1"];

function nombreCarta(c) {
  if (!c) return "";
  if (c.k === "n") return c.cero ? "el Cero" : c.gafe ? "el 7 gafe" : c.suerte ? "el 13 de la suerte" : "un " + c.v;
  if (c.k === "m") return c.doble ? "×2" : c.mitad ? "÷2" : (c.v > 0 ? "+" : "−") + Math.abs(c.v);
  return "«" + ACCION[c.a].n + "»";
}

function htmlCarta(c, clases, attrs) {
  if (!c) return `<div class="jg-f7-c jg-f7-dorso ${clases || ""}"><span>7</span></div>`;
  let cara, tipo, estilo = "", titulo = nombreCarta(c);
  if (c.k === "n") {
    tipo = "num" + (c.cero ? " jg-f7-cero" : c.gafe ? " jg-f7-gafe" : c.suerte ? " jg-f7-suerte" : "");
    estilo = `--t:${TONO[c.v] || TONO[0]}`;
    cara = `<b>${c.cero ? "∅" : c.v}</b>${c.gafe ? "<i>gafe</i>" : c.suerte ? "<i>suerte</i>" : c.cero ? "<i>cero</i>" : ""}`;
  } else if (c.k === "m") {
    tipo = "mod" + (c.v < 0 || c.mitad ? " jg-f7-neg" : "");
    cara = `<b>${c.doble ? "×2" : c.mitad ? "÷2" : (c.v > 0 ? "+" : "−") + Math.abs(c.v)}</b>`;
  } else {
    tipo = "acc jg-f7-" + c.a;
    cara = `<b>${ACCION[c.a].i}</b><i>${esc(ACCION[c.a].n)}</i>`;
  }
  return `<div ${attrs || ""} class="jg-f7-c jg-f7-${tipo} ${clases || ""}" style="${estilo}" title="${esc(titulo)}">${cara}</div>`;
}

export function crearFlip7(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;

  let host = null, muerto = false;
  let p = null, est = null, M = null;
  let sec = null, secPedido = false, secListo = false;
  let enviando = false;
  let enviadoN = -1;           // robo cuyo aporte ya salió de esta pestaña
  let reloj = null, relojN = -1;
  let rondaVista = 0, tRonda = 0;
  let sel1 = null;             // primera carta del intercambio, aún sin pareja
  let ultimaVista = -1, histVisto = "";
  let tramposos = [], auditando = false, firmaAudit = "";
  let cerrando = false, finVisto = 0, relojFin = null;
  const firmas = {};

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-f7">
        <div class="jg-barra">
          <div class="jg-fase" id="f7Fase"></div>
          <div class="jg-grow"></div>
          <div class="jg-f7-modo" id="f7Modo"></div>
        </div>
        <div id="f7Trampa"></div>
        <div class="jg-tablero jg-f7-tablero">
          <div class="jg-f7-centro" id="f7Centro"></div>
          <div class="jg-f7-resumen" id="f7Resumen"></div>
          <div class="jg-f7-mesa" id="f7Mesa"></div>
        </div>
        <div class="jg-pie" id="f7Pie"></div>
        <div class="jg-f7-hist" id="f7Hist"></div>
      </div>`;
    host.addEventListener("click", alClic);
    pideSecreto();
  }

  function destruir() {
    muerto = true;
    clearTimeout(reloj); clearTimeout(relojFin);
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function pideSecreto() {
    if (secPedido || !secreto) return;
    secPedido = true;
    Promise.resolve().then(() => secreto())
      .then(s => { sec = s || null; })
      .catch(() => { sec = null; })
      .then(() => { secListo = true; if (!muerto && est) actualizar(p, est); });
  }

  /* ---------- quién es quién ---------- */
  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const s = nombre(u); return s.charAt(0).toUpperCase() + s.slice(1); };
  const juego = () => !!jugador(uid) && !(est.fuera || {})[uid];

  /* La semilla con la que aporto. Una sala sin secreto guardado (abierta
     a mano en la base, o antes de que esto existiera) cae a una que sale
     de la pública: se puede jugar, y la auditoría dirá que no cuadra con
     la ficha, que es la verdad. */
  function miSemilla() {
    if (sec && sec.sem != null) return { sem: sec.sem >>> 0, sal: sec.sal || "" };
    const y = jugador(uid);
    if (!p || !y) return null;
    return { sem: ((p.semilla >>> 0) ^ Math.imul((y.orden || 0) + 1, 0x9E3779B1)) >>> 0, sal: "" };
  }

  const carta = id => (M && id != null ? M[id] : null);

  /* ---------- pintado ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  function pinta() {
    if (!host || !est) return;
    set("f7Fase", textoFase(), esc(textoFase()));
    const modo = est.modo === "venganza" ? "Con venganza" : "Normal";
    set("f7Modo", modo + est.ronda, `<span class="jg-f7-etq${est.modo === "venganza" ? " jg-f7-v" : ""}">${modo}</span>
      ${est.ronda ? `<span class="jg-nota">Ronda ${est.ronda} · a ${est.meta}</span>` : ""}`);
    set("f7Trampa", tramposos.map(t => t.uid + t.que).join(","), avisoTrampa());
    pintaCentro();
    pintaResumen();
    pintaMesa();
    pintaPie();
    pintaHist();
  }

  function textoFase() {
    if (est.fase === "espera") return "Esperando a que empiece la partida…";
    if (est.fase === "fin") {
      if (est.motivo === "abandono") return est.ganador === uid ? "¡Ganas! Los demás se fueron." : "Partida terminada por abandono.";
      return est.ganador === uid ? `¡Ganas con ${est.puntos[uid]} puntos!` : `Gana ${nombre(est.ganador)} con ${est.puntos[est.ganador]}.`;
    }
    const w = est.espera;
    if (!w) return "…";
    if (w.k === "decide") return w.uid === uid ? "Te toca: ¿pides o te plantas?" : `Le toca a ${nombre(w.uid)}.`;
    if (w.k === "elige") return w.quien === uid ? `Tienes ${nombreCarta(carta(w.id))}: elige.` : `${Nombre(w.quien)} decide qué hacer con ${nombreCarta(carta(w.id))}.`;
    if (w.de === "reparto") return `Repartiendo a ${nombre(w.para)}…`;
    if (w.serie) return `${Nombre(w.para)} voltea: ${w.serie.total - w.serie.quedan} de ${w.serie.total}…`;
    return `Carta para ${nombre(w.para)}…`;
  }

  function avisoTrampa() {
    const graves = tramposos.filter(t => t.que !== "oculta");
    if (graves.length) {
      const t = graves[0];
      return `<div class="jg-trampa">${t.que === "semilla"
        ? `La semilla que reveló ${esc(nombre(t.uid))} al acabar no es la que prometía al entrar.`
        : `Un aporte de ${esc(nombre(t.uid))} (carta ${t.n + 1}) no sale de su semilla: escogió la carta.`} La partida ya no vale.</div>`;
    }
    const ocultas = tramposos.filter(t => t.que === "oculta");
    if (!ocultas.length) return "";
    return `<div class="jg-f7-aviso">${ocultas.map(t => esc(Nombre(t.uid))).join(", ")} no ${ocultas.length === 1 ? "reveló su semilla" : "revelaron su semilla"} al acabar
      (¿pestaña cerrada?), así que sus aportes no se han podido comprobar.</div>`;
  }

  /* El centro: el montón, la última carta que salió y para quién. */
  function pintaCentro() {
    const u = est.ultima;
    const c = u ? carta(u.id) : null;
    const firma = [est.fase, est.monton, est.descarte, u ? u.n : -1].join("|");
    set("f7Centro", firma, `
      <div class="jg-f7-monton">${htmlCarta(null)}<span>${est.monton ?? 0} en el mazo · ${est.descarte ?? 0} descartadas</span></div>
      <div class="jg-f7-ultima">${c ? htmlCarta(c, "jg-f7-grande jg-f7-sale") + `<span>para <b>${esc(nombre(u.para))}</b></span>` : `<span class="jg-nota">Aún no ha salido ninguna carta.</span>`}</div>`);
  }

  function pintaResumen() {
    const f = est.finRonda;
    if (!f) { set("f7Resumen", "-", ""); return; }
    const filas = est.jugadores.map(j => {
      const l = f.lineas[j.uid] || {};
      const extra = l.f7 ? " · Flip 7" : l.estado === "pasa" ? " · se pasó" : l.estado === "fuera" ? " · fuera" : "";
      return `<span class="jg-m" style="--c:${esc(j.color || "#888")}"><b>+${f.pts[j.uid] || 0}</b><span>${esc(nombre(j.uid))}${extra}</span></span>`;
    }).join("");
    set("f7Resumen", "r" + f.r, `<div class="jg-f7-res-t">Ronda ${f.r}${f.f7 ? ` · ¡Flip 7 de ${esc(nombre(f.f7))}!` : ""}</div><div class="jg-marcador">${filas}</div>`);
  }

  /* Qué cartas de la mesa se pueden tocar ahora mismo: solo cuando me
     toca elegir una carta (robo, descarte o intercambio). */
  function elegibles() {
    const w = est.espera;
    if (est.fase !== "jugando" || !w || w.k !== "elige" || w.quien !== uid || w.op.tipo === "a") return null;
    const o = {};
    for (const u in w.op.cartas) {
      if (sel1 && w.op.tipo === "2" && u === sel1.u) continue;
      o[u] = w.op.cartas[u];
    }
    return o;
  }

  function pintaMesa() {
    const w = est.espera, el = elegibles();
    const apuntables = w && w.k === "elige" && w.quien === uid && w.op.tipo === "a" ? w.op.uids : [];
    const html = [], firma = [];
    for (const j of est.jugadores) {
      const l = est.lineas[j.uid] || { nums: [], mods: [], estado: "fuera" };
      const turno = w && ((w.k === "decide" && w.uid === j.uid) || (w.k === "elige" && w.quien === j.uid) || (w.k === "roba" && w.para === j.uid));
      const puede = el && el[j.uid] ? el[j.uid] : [];
      const apunta = apuntables.includes(j.uid);
      const estado = (est.fuera || {})[j.uid] ? "fuera"
        : l.f7 ? "¡Flip 7!"
        : l.estado === "pasa" ? "se pasó"
        : l.congelado ? "congelado"
        : l.estado === "planta" ? "plantado"
        : est.ronda ? "en juego" : "";
      const cls = "jg-f7-jug" + (turno ? " jg-f7-turno" : "") + (l.estado === "pasa" ? " jg-f7-pasado" : "")
        + (l.estado === "planta" ? " jg-f7-plantado" : "") + (l.f7 ? " jg-f7-siete" : "") + (apunta ? " jg-f7-apuntable" : "")
        + ((est.fuera || {})[j.uid] ? " jg-f7-fuera" : "");
      const pts = est.puntos[j.uid] || 0;
      const cartas = ids => ids.map(id => {
        const ok = puede.includes(id), s = sel1 && sel1.id === id && sel1.u === j.uid;
        return htmlCarta(carta(id), (ok ? "jg-f7-elegible" : "") + (s ? " jg-f7-sel" : ""), ok || s ? `data-u="${esc(j.uid)}" data-id="${id}"` : "");
      }).join("");
      const nNums = l.nums.length;
      firma.push([j.uid, j.nombre, j.color, l.nums.join(","), l.mods.join(","), l.seg, l.estado, l.f7, l.congelado, pts,
        est.valor[j.uid], turno, apunta, puede.join(","), sel1 && sel1.u === j.uid ? sel1.id : ""].join(":"));
      html.push(`<div class="${cls}" style="--c:${esc(j.color || "#888")}" ${apunta ? `data-apunta="${esc(j.uid)}"` : ""}>
        <div class="jg-f7-cab">
          <span class="jg-punto" style="background:${esc(j.color || "#888")}"></span>
          <b>${esc(j.uid === uid ? "Tú" : j.nombre)}</b>
          <span class="jg-f7-est">${esc(estado)}</span>
          <span class="jg-grow"></span>
          <span class="jg-f7-total" title="Puntos de la partida"><b>${pts}</b>/${est.meta}</span>
        </div>
        <div class="jg-f7-barra"><i style="width:${Math.min(100, pts / est.meta * 100)}%"></i></div>
        <div class="jg-f7-fila">${cartas(l.nums) || '<span class="jg-nota">sin cartas</span>'}</div>
        ${l.mods.length || l.seg != null ? `<div class="jg-f7-fila jg-f7-mods">${cartas(l.mods)}${l.seg != null ? htmlCarta(carta(l.seg), "jg-f7-guardada") : ""}</div>` : ""}
        <div class="jg-f7-pie-j">
          <span title="Números distintos">${nNums}/${F7_SIETE}</span>
          <span class="jg-f7-siete-p">${Array.from({ length: F7_SIETE }, (_, k) => `<i class="${k < nNums ? "on" : ""}"></i>`).join("")}</span>
          <span class="jg-grow"></span>
          <span title="Lo que se lleva si la ronda acabara ahora">vale <b>${est.valor[j.uid] || 0}</b></span>
        </div>
        ${apunta ? `<button class="jg-btn jg-f7-apunta" data-apunta="${esc(j.uid)}">${j.uid === uid ? "A mí" : "A " + esc(j.nombre)}</button>` : ""}
      </div>`);
    }
    set("f7Mesa", firma.join("|"), html.join(""));
  }

  function pintaPie() {
    const w = est.espera;
    let firma, html;
    if (est.fase === "espera") { firma = "esp"; html = `<span class="jg-nota">Pásale el enlace de la sala a quien quieras; empieza cuando quien la abrió lo diga.</span>`; }
    else if (est.fase === "fin") { firma = "fin"; html = `<span class="jg-nota">Partida terminada.</span>`; }
    else if (!juego()) { firma = "mira"; html = `<span class="jg-nota">${jugador(uid) ? "Has abandonado esta partida." : "Estás mirando."}</span>`; }
    else if (w && w.k === "decide" && w.uid === uid) {
      const listo = secListo && !enviando;
      firma = "dec" + w.cero + listo + est.valor[uid];
      html = `<button class="jg-btn" id="f7Pide"${listo ? "" : " disabled"}>Pedir carta</button>
        <button class="jg-btn jg-f7-planta" id="f7Planta"${w.cero || !listo ? " disabled" : ""}>Plantarme con ${est.valor[uid] || 0}</button>
        <span class="jg-nota">${w.cero ? "Tienes el Cero: no puedes plantarte. O haces Flip 7, o esta ronda no suma." : "Si repites un número te pasas y la ronda no te da nada."}</span>`;
    } else if (w && w.k === "elige" && w.quien === uid) {
      const c = carta(w.id);
      firma = "eli" + w.id + (sel1 ? sel1.u + sel1.id : "");
      html = `${htmlCarta(c, "jg-f7-mini")}<span class="jg-nota">${esc(textoEleccion(c, w.op))}</span>
        ${sel1 ? `<button class="jg-btn jg-f7-planta" id="f7Anula">Cambiar la primera</button>` : ""}`;
    } else {
      firma = "otro";
      html = `<span class="jg-nota">Pide carta cuando sea tu turno. Siete números distintos cierran la ronda con +15; un repetido y te quedas sin nada.</span>`;
    }
    set("f7Pie", firma, html);
  }

  function textoEleccion(c, op) {
    if (c.k === "m") return `¿A quién le pones ${nombreCarta(c)}?`;
    if (op.tipo === "2") return sel1 ? "Ahora una carta de otro jugador para intercambiarlas." : "Elige dos cartas de dos jugadores distintos para intercambiarlas.";
    return {
      congela: "¿A quién congelas? Se planta con lo que tiene.",
      tres: "¿Quién voltea tres cartas seguidas?",
      cuatro: "¿Quién voltea cuatro cartas seguidas?",
      segunda: "¿A quién le regalas la segunda oportunidad?",
      otra: "¿Quién voltea una más y se planta?",
      roba: "Elige la carta de otro jugador que te quedas.",
      tira: "Elige la carta de la mesa que se descarta."
    }[c.a] || "Elige.";
  }

  /* El historial va en tercera persona: con «tú» cada verbo tendría que
     conjugarse aparte, y «Tú pide carta» es lo que salía. */
  function textoSuceso(h) {
    const c = h.id != null ? nombreCarta(carta(h.id)) : "";
    const nombre = u => ((jugador(u) || {}).nombre || "alguien") + (u === uid ? " (tú)" : "");
    const Nombre = nombre, mismo = h.a === h.uid;
    switch (h.e) {
      case "ronda": return `— Ronda ${h.r}, reparte ${nombre(h.uid)} —`;
      case "carta": return `${Nombre(h.uid)}: ${c}.`;
      case "pide": return `${Nombre(h.uid)} pide carta.`;
      case "planta": return `${Nombre(h.uid)} se planta.`;
      case "pasa": return `${Nombre(h.uid)} se pasa${c ? ` con ${c}` : ""}.`;
      case "salva": return `${Nombre(h.uid)} gasta la segunda oportunidad contra ${c}.`;
      case "f7": return `¡${Nombre(h.uid)} hace Flip 7! +15`;
      case "gafe": return `El 7 gafe deja a ${nombre(h.uid)} solo con el 7.`;
      case "aparta": return `${Nombre(h.uid)} aparta ${c} hasta acabar la serie.`;
      case "da": return mismo ? `${Nombre(h.uid)} se queda ${c}.` : `${Nombre(h.uid)} le pone ${c} a ${nombre(h.a)}.`;
      case "congela": return mismo ? `${Nombre(h.uid)} se congela.` : `${Nombre(h.uid)} congela a ${nombre(h.a)}.`;
      case "tres": case "cuatro": return mismo ? `${Nombre(h.uid)} voltea ${h.e} cartas.` : `${Nombre(h.uid)} hace voltear ${h.e} a ${nombre(h.a)}.`;
      case "regala": return `${Nombre(h.uid)} le da la segunda oportunidad a ${nombre(h.a)}.`;
      case "otra": return mismo ? `${Nombre(h.uid)} voltea una más y se planta.` : `${Nombre(h.uid)}: ${nombre(h.a)} voltea una más y se planta.`;
      case "roba": return `${Nombre(h.uid)} le roba ${c} a ${nombre(h.a)}.`;
      case "tira": return mismo ? `${Nombre(h.uid)} descarta ${c} de su propia fila.` : `${Nombre(h.uid)} descarta ${c} de ${nombre(h.a)}.`;
      case "cambia": return `${Nombre(h.uid)} cambia ${nombreCarta(carta(h.c))} de ${nombre(h.a)} por ${nombreCarta(carta(h.d))} de ${nombre(h.b)}.`;
      case "nada": return `${c.charAt(0).toUpperCase() + c.slice(1)} de ${nombre(h.uid)} no tiene a quién ir.`;
      case "baraja": return "Se baraja el descarte.";
      case "cierra": return `Fin de la ronda ${h.r}.`;
      case "abandona": return `${Nombre(h.uid)} abandona.`;
    }
    return "";
  }

  function pintaHist() {
    const h = (est.hist || []).slice(-12).reverse();
    set("f7Hist", JSON.stringify(h), h.length
      ? `<div class="jg-f7-hist-t">Lo último</div>` + h.map(x => `<div class="jg-f7-h jg-f7-h-${x.e}">${esc(textoSuceso(x))}</div>`).join("")
      : "");
  }

  /* ---------- sonido: por lo que cuenta el registro ---------- */
  function suenaNuevo() {
    const h = est.hist || [];
    const claves = h.map(x => JSON.stringify(x));
    let nuevos = [];
    if (histVisto) {
      const i = claves.lastIndexOf(histVisto);
      nuevos = i >= 0 ? h.slice(i + 1) : h.slice(-3);
    }
    histVisto = claves[claves.length - 1] || "";
    if (!nuevos.length) return;
    if (nuevos.some(x => x.e === "f7")) suena("gana");
    else if (nuevos.some(x => x.e === "pasa")) suena("pierde");
    else if (nuevos.some(x => x.e === "congela" || x.e === "roba" || x.e === "cambia" || x.e === "tira")) suena("golpe");
    else if (est.ultima && est.ultima.n !== ultimaVista) suena("carta");
    else if (nuevos.some(x => x.e === "planta")) suena("ficha");
    if (est.ultima) ultimaVista = est.ultima.n;
  }

  /* ---------- interacción ---------- */
  function alClic(ev) {
    if (!est || est.fase !== "jugando" || enviando) return;
    const w = est.espera;
    if (ev.target.closest("#f7Pide")) { pide(); return; }
    if (ev.target.closest("#f7Planta")) { manda({ t: "planta", uid }); return; }
    if (ev.target.closest("#f7Anula")) { sel1 = null; pinta(); return; }
    if (!w || w.k !== "elige" || w.quien !== uid) return;
    const a = ev.target.closest("[data-apunta]");
    if (a && w.op.tipo === "a") { manda({ t: "apunta", uid, a: a.getAttribute("data-apunta") }); return; }
    const c = ev.target.closest(".jg-f7-c[data-id]");
    if (!c) return;
    const u = c.getAttribute("data-u"), id = Number(c.getAttribute("data-id"));
    if (w.op.tipo === "c") { manda({ t: "apunta", uid, a: u, c: id }); return; }
    if (w.op.tipo === "2") {
      if (sel1 && sel1.u === u && sel1.id === id) { sel1 = null; pinta(); return; }
      if (!sel1) { sel1 = { u, id }; suena("clic"); pinta(); return; }
      const par = sel1; sel1 = null;
      manda({ t: "apunta", uid, a: par.u, c: par.id, b: u, d: id });
    }
  }

  async function manda(j) {
    if (enviando) return;
    enviando = true; pinta();
    try { await jugar(j); } catch (e) { console.warn("[flip7]", e); }
    finally { enviando = false; if (est) pinta(); }
  }

  async function pide() {
    const s = miSemilla();
    if (!s || !est || est.espera.k !== "decide" || est.espera.uid !== uid) return;
    const n = est.n;
    enviando = true; pinta();
    try {
      const v = await aporteF7(s.sem, s.sal, n);
      await jugar({ t: "pide", uid, n, v });
    } catch (e) { console.warn("[flip7]", e); }
    finally { enviando = false; if (est) pinta(); }
  }

  /* Mi aporte al robo pendiente, con su pausa. El reloj se rearma si el
     robo que espera cambia; si no, se deja correr. */
  function automatismos() {
    const w = est && est.espera;
    if (!w || est.fase !== "jugando" || w.k !== "roba" || !juego() || !secListo
        || !w.faltan.includes(uid) || enviadoN === w.n) {
      if (reloj && (!w || w.k !== "roba" || w.n !== relojN)) { clearTimeout(reloj); reloj = null; relojN = -1; }
      return;
    }
    if (reloj && relojN === w.n) return;
    clearTimeout(reloj);
    relojN = w.n;
    const falta = Math.max(PAUSA_ROBO, PAUSA_RONDA - (Date.now() - tRonda) * (w.de === "reparto" ? 1 : 99));
    reloj = setTimeout(async () => {
      reloj = null;
      const x = est && est.espera;
      if (muerto || !x || x.k !== "roba" || x.n !== relojN || !x.faltan.includes(uid) || enviadoN === x.n) return;
      const s = miSemilla();
      if (!s) return;
      enviadoN = x.n;
      try {
        const v = await aporteF7(s.sem, s.sal, x.n);
        await jugar({ t: "r", uid, n: x.n, v });
      } catch (e) { enviadoN = -1; console.warn("[flip7]", e); if (est) automatismos(); }
    }, falta);
  }

  /* Al acabar: revelar la semilla y, cuando la hayan revelado todos los
     que siguen en la mesa (o haya pasado un rato), cerrar la partida. */
  function cierre() {
    if (!finVisto) finVisto = Date.now();
    if (!cerrando && jugador(uid) && !(est.semillas || {})[uid] && secListo) {
      cerrando = true;
      const s = miSemilla();
      if (s) jugar({ t: "s", uid, sem: s.sem, sal: s.sal }).catch(() => {});
    }
    const faltan = est.jugadores.filter(j => !(est.fuera || {})[j.uid] && !(est.semillas || {})[j.uid]);
    if (!faltan.length || Date.now() - finVisto > ESPERA_SEMILLAS) { terminar(est.ganador, est.motivo); return; }
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    if (auditando || !p || !est) return;
    const firma = Object.keys(p.jugadas || {}).length + "|" + !!p.fin;
    if (firma === firmaAudit || (!p.fin && !Object.keys(est.semillas || {}).length)) return;
    auditando = true;
    try {
      const malas = await auditaFlip7(p, est);
      firmaAudit = firma;
      if (JSON.stringify(malas) !== JSON.stringify(tramposos)) { tramposos = malas; pinta(); }
    } catch (e) { /* una auditoría que falla no puede tumbar la partida */ }
    finally { auditando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    M = mazoF7(est.modo || "normal");
    pideSecreto();
    if (est.ronda !== rondaVista) {
      if (rondaVista) tRonda = Date.now();
      rondaVista = est.ronda;
    }
    const w = est.espera;
    if (sel1 && !(w && w.k === "elige" && w.quien === uid && w.op.tipo === "2")) sel1 = null;
    suenaNuevo();
    pinta();
    automatismos();
    audita();
    if (est.fase === "fin" && !(p.fin && p.fin.at)) cierre();
  }

  return { montar, actualizar, destruir };
}
