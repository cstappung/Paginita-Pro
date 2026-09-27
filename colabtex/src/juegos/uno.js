/* UNO — Clásico, No Mercy (con y sin expansión), All Wild y Liar's.
 *
 * Esta pantalla no decide nada: el reductor (`redUno` en motor.js)
 * sabe de quién es el turno, qué hay en el descarte, cuántas cartas
 * tiene cada uno y qué se está esperando. Pero el reductor **no sabe
 * qué cartas** tiene nadie —solo cuántas—, así que la mano propia se
 * saca aquí, repasando `est.ops` con el secreto de este navegador
 * (`manoUno`). Lo que se ve de los demás es solo el dorso.
 *
 * Cuatro jugadas las manda la pantalla sola, sin preguntar, porque
 * solo este navegador puede hacerlas y la mesa entera espera por ellas:
 *
 * - **La llave de arranque** (`k`): la parte de la mezcla que prometió
 *   la ficha. Con todas, sale la mezcla y se reparte.
 * - **Los sobres** de un cambio de manos (el 7 y el 0 del No Mercy, el
 *   Intercambio forzado del All Wild): la mano propia cifrada para
 *   quien la recibe.
 * - **La respuesta al reto del +4** (clásico): si tenía o no una carta
 *   del color de antes. La auditoría del final comprueba que fuera verdad.
 * - **La carta boca abajo** (Liar's) cuando alguien la duda o la destapa.
 *
 * Lo mismo que en Flip 7 y el cacho: un latido rescata relojes perdidos,
 * cada jugada tiene un tope de tiempo, y lo que suena sale del
 * historial, no del clic. El repintado va por firmas.
 */
import {
  MODOS_UNO, UNO_COLORES, UNO_NOMBRE_COLOR, UNO_TOPE, sha256hex, arrUno, salUno, tapaUno, cartaUno,
  dhCompartida, cierraSobreUno, manoUno, cuentaUno, robaHastaUno, auditaUno, jugableUno,
  anunciablesUno, colorUno, valorUno, esComodinUno, esMentiraUno, esNumeroUno, sinTilde, roboUno
} from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const LATIDO_MS = 2000;
const ENVIO_MAX = 12000;
const AVISO_AUTO = 10000;       // llaves, sobres, respuestas: lo manda una pantalla
const AVISO_TURNO = 20000;      // una decisión de alguien
const ESPERA_SEMILLAS = 6000;
const REENVIO_MS = 8000;

/* ---------- las cartas ---------- */
const SIMB = {
  S: "⊘", I: "⇄", T: "⊘⊘", D: "✕",
  N: "★", "N+2": "+2", "N+4": "+4", "N+6": "+6", "N+10": "+10", NI4: "⇄+4", NI8: "⇄+8",
  NC: "🎡", ND: "✕", NF: "⚔", NM: "☠", NS: "⊘", NI: "⇄", NS2: "⊘²", NT2: "◎+2", NW: "⇆", NL: "?"
};
const NOMBRE_VALOR = { S: "Salta", I: "Invierte", T: "Salta a todos", D: "Descarta el color" };
const NOMBRE_COMODIN = {
  N: "Comodín", "N+2": "Comodín +2", "N+4": "Comodín +4", "N+6": "Comodín +6", "N+10": "Comodín +10",
  NI4: "Invierte +4", NI8: "Invierte +8", NC: "Ruleta de color", ND: "Descarte total",
  NF: "Ataque final", NM: "Muerte súbita", NS: "Salta", NI: "Invierte", NS2: "Salta a dos",
  NT2: "Diana +2", NW: "Intercambio forzado", NL: "Reto del mentiroso"
};
const simbolo = c => { const v = valorUno(c); return SIMB[v] || v; };
function nombreCarta(c) {
  if (!c) return "";
  if (esComodinUno(c)) return NOMBRE_COMODIN[sinTilde(c)] || "Comodín";
  const v = valorUno(c), col = UNO_NOMBRE_COLOR[colorUno(c)] || "";
  return (NOMBRE_VALOR[v] || v) + " " + col;
}
const ORDEN_COLOR = { R: 0, A: 1, V: 2, Z: 3, "": 4 };
const ORDEN_VALOR = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "S", "I", "T", "D", "+2", "+4",
  "N", "NS", "NI", "NS2", "NW", "NL", "NC", "ND", "NF", "NM", "N+2", "NT2", "N+4", "NI4", "N+6", "NI8", "N+10"];
const rango = c => ORDEN_COLOR[colorUno(c)] * 100 + Math.max(0, ORDEN_VALOR.indexOf(valorUno(c))) + (esMentiraUno(c) ? 0.5 : 0);

function carta(c, cls = "", attrs = "") {
  const w = esComodinUno(c), s = simbolo(c);
  const col = w ? "N" : colorUno(c);
  return `<span class="jg-un-c c-${col}${esMentiraUno(c) ? " mentira" : ""}${cls ? " " + cls : ""}"${attrs} title="${esc(nombreCarta(c))}">`
    + `<i class="esq">${esc(s)}</i><b class="ov">${w ? `<span class="rueda"></span>` : ""}<em>${w && sinTilde(c) === "N" ? "" : esc(s)}</em></b>`
    + `<i class="esq b">${esc(s)}</i>${esMentiraUno(c) ? `<u title="Carta de mentiroso: se juega boca abajo">🎭</u>` : ""}</span>`;
}
const dorso = (cls = "", attrs = "") => `<span class="jg-un-c dorso${cls ? " " + cls : ""}"${attrs}><b class="ov"><em>UNO</em></b></span>`;
const punto = col => `<i class="jg-un-punto c-${col || "N"}"></i>`;
/* Cuánto gira cada carta al caer en el descarte: sale del índice del
   suceso, así las dos pantallas apilan el mismo montón torcido. */
const giroDe = i => ((i * 47) % 29) - 14;
const corrDe = i => [((i * 31) % 13) - 6, ((i * 17) % 11) - 5];
const quieto = () => document.hidden || !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* Qué sucesos del historial son nuevos (la misma cuenta que en Flip 7). */
function nuevosDe(prev, cur) {
  const a = prev.map(x => JSON.stringify(x)), b = cur.map(x => JSON.stringify(x));
  for (let d = 0; d <= a.length; d++) {
    const k = a.length - d;
    if (k > b.length) continue;
    let igual = true;
    for (let i = 0; i < k; i++) if (a[d + i] !== b[i]) { igual = false; break; }
    if (igual) return cur.slice(k);
  }
  return cur.slice();
}

const TRAMPA = {
  semilla: "su semilla no cuadra con la que prometió al entrar",
  carta: "jugó una carta que no tenía (o no la que acababa de robar)",
  roba: "robó mal: siguió robando con una carta que servía, o pasó teniendo que jugar",
  ruleta: "la ruleta no paró en el primer naipe del color",
  sobre: "el sobre de su mano no llevaba su mano",
  tapada: "puso boca abajo una carta que no tenía, o que no era de mentiroso",
  descarte: "descartó un número de cartas que no era el de su mano",
  reto: "respondió en falso al reto del +4",
  final: "enseñó una mano falsa en el ataque final"
};

export function crearUno(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let sec = null, secPedido = false, secListo = false, secOk = null;
  let enviando = false, enviandoT = 0;
  let latido = null, relojFin = null;
  let esperaFirma = "", esperaDesde = 0;
  let histPrev = [], primera = true;
  let manoMemo = { k: "", v: null };
  let orden = [];                 // la mano tal como se pintó (para los clics)
  let sel = null, selFirma = "";  // la carta que se está jugando y lo que falta decidir
  let tapaSel = -1;
  let digoUno = false;
  let listoDado = false, cierreT = 0, finVisto = 0, cerrando = false;
  let auditando = false, firmaAudit = "", tramposos = [];
  /* La mesa animada: cuántas cartas van por el aire, si el descarte
     espera a la que está volando, y de dónde salió la que jugué yo. */
  let capa = null, vuelos = 0, topeTapado = false, golpeHasta = 0;
  let clicMio = null, manoAntes = [], animarMano = false, angAcum = null;
  let rafTam = 0;
  const hechos = new Map();       // automatismos ya mandados → cuándo
  const firmas = {};
  const temporizadores = new Set();

  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = s => host && host.querySelector(s);

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-uno">
        <div class="jg-barra">
          <div class="jg-fase" id="unFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-un-modo" id="unModo"></div>
        </div>
        <div id="unTrampa"></div>
        <div class="jg-un-escena">
          <div class="jg-un-sala" id="unSala">
            <div class="jg-un-fieltro">
              <i class="jg-un-aura"></i>
              <div class="jg-un-giro" aria-hidden="true"><svg viewBox="-180 -180 360 360"><circle r="155"/>${[0, 120, 240].map(a =>
                `<g transform="rotate(${a})"><polygon transform="translate(155 0)" points="-7,-6 7,-6 0,8"/></g>`).join("")}</svg></div>
              <div class="jg-un-foco off" id="unFoco" aria-hidden="true"><i></i></div>
              <div class="jg-un-mesa" id="unMesa"></div>
            </div>
            <div class="jg-un-asientos" id="unAsientos"></div>
          </div>
          <div class="jg-un-mano" id="unMano"></div>
          <div class="jg-pie jg-un-pie" id="unPie"></div>
        </div>
        <div class="jg-un-hist" id="unHist"></div>
      </div>`;
    /* Las cartas en vuelo van en una capa fija sobre toda la página:
       dentro de la mesa las cortaría el `overflow` al cruzar al asiento. */
    capa = document.createElement("div");
    capa.className = "jg-un-vuelos";
    document.body.appendChild(capa);
    window.addEventListener("resize", alMedir);
    host.addEventListener("click", alClic);
    document.addEventListener("visibilitychange", alVolver);
    latido = setInterval(late, LATIDO_MS);
    pideSecreto();
  }

  function destruir() {
    muerto = true;
    clearTimeout(relojFin);
    clearInterval(latido);
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    document.removeEventListener("visibilitychange", alVolver);
    window.removeEventListener("resize", alMedir);
    cancelAnimationFrame(rafTam);
    if (capa) capa.remove();
    capa = null;
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
  /* Tras preposición «tú» es «ti»: «duda de ti», no «duda de tú». */
  const ati = u => u === uid ? "ti" : nombre(u);
  const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
  const nc = n => n === 1 ? "una carta" : n + " cartas";
  const activo = u => !!jugador(u) && !(est.fuera || {})[u] && !(est.elim || {})[u];
  const juego = () => !ctx.mirando && activo(uid) && est.fase === "jugando";

  /* Mi secreto, comprobado contra la promesa de mi ficha: una sala
     abierta en otro navegador no tiene aquí su semilla, y es mejor
     decirlo que pintar una mano inventada. */
  function miSec() {
    if (secOk !== null) return secOk;
    if (!secListo || !est) return null;
    const y = jugador(uid);
    if (!sec || sec.sem == null || !y || !y.hcad) { secOk = false; return secOk; }
    secOk = sha256hex(arrUno(sec.sem, sec.sal || "")) === y.hcad ? { sem: sec.sem, sal: sec.sal || "" } : false;
    return secOk;
  }

  /* La mano propia, repasando las operaciones con mi secreto. Solo
     cambia cuando crece `ops`, así que se guarda. */
  function mia() {
    const s = miSec();
    if (!s || !est.mezcla) return null;
    const k = (est.ops || []).length + ":" + est.mezcla;
    if (manoMemo.k !== k) manoMemo = { k, v: manoUno(est, uid, s) };
    return manoMemo.v;
  }
  const mano = () => { const m = mia(); return m ? m.mano : []; };

  const esp = () => (est && est.fase === "jugando" && est.espera) || null;
  const turnoMio = () => { const w = esp(); return juego() && !!w && (w.k === "turno" || w.k === "pena") && w.uid === uid; };
  const trasMio = () => { const w = esp(); return juego() && !!w && (w.k === "tras" || w.k === "hasta") && w.uid === uid; };
  const e = () => ({ modo: est.modo, tope: est.tope, pena: est.pena });
  /* La última carta robada: tras robar solo se puede jugar esa. */
  function ultimaRobada() {
    const s = miSec();
    if (!s) return "";
    const k = cuentaUno(est, uid).robadas;
    return k ? cartaUno(est.modo, s.sem, s.sal, est.mezcla, k - 1) : "";
  }

  /* ¿Se puede jugar esta carta de mi mano ahora? */
  function sirve(c) {
    if (turnoMio()) {
      if (esMentiraUno(c)) return est.modo === "liar" && !est.pena
        && anunciablesUno().some(d => jugableUno(d, e()));
      return jugableUno(c, e());
    }
    if (trasMio()) return !esMentiraUno(c) && c === ultimaRobada() && jugableUno(c, e());
    return false;
  }

  /* A quién espera la mesa, contando lo que mandan las pantallas solas. */
  function esperaA(w) {
    const x = esp();
    if (!x) return false;
    if ((est.debe || []).includes(w)) return true;
    if (x.k === "llaves") return x.faltan.includes(w);
    if (x.k === "sobres") return x.faltan.some(f => f.de === w);
    if (x.k === "resp" || x.k === "revela") return x.uid === w;
    return false;
  }

  /* ---------- pintado ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  function pinta() {
    if (!host || !est) return;
    const f = [(est.ops || []).length, est.jugadas, esp() && esp().k].join(":");
    if (f !== selFirma) { selFirma = f; sel = null; tapaSel = -1; }
    pintaBarra();
    pintaTrampa();
    pintaAsientos();
    pintaMesa();
    pintaMano();
    pintaPie();
    pintaHist();
    apunta();
  }

  function pintaBarra() {
    let f;
    const w = esp();
    if (est.fase === "espera") f = "Esperando jugadores";
    else if (est.fase === "fin") f = est.ganador === uid ? "¡Ganaste!" : est.ganador ? "Ganó " + nombre(est.ganador) : "Sin ganador";
    else if (est.etapa === "arranque") f = "Barajando…";
    else if (est.etapa === "monedas") f = "Cada uno elige su moneda";
    else if (!w) f = "";
    else if (w.k === "sobres") f = "Cambiando manos…";
    else if (w.k === "duda") f = `¿${Nombre(w.de)} miente?`;
    else if (w.k === "tapas" || w.k === "destapa" || (w.k === "revela" && w.por === "tapa")) f = "Reto del mentiroso";
    else if ((est.debe || []).length === 1) f = est.debe[0] === uid ? "Te toca" : "Turno de " + nombre(est.debe[0]);
    else f = "Turno de " + nombre(w.uid);
    set("unFase", f, esc(f));
    const m = (MODOS_UNO[est.modo] || "UNO") + (est.fase === "jugando" && est.tope ? " · " + (est.dir === 1 ? "→ sentido normal" : "← sentido inverso") : "");
    set("unModo", m, esc(m));
  }

  function pintaTrampa() {
    let h = "";
    for (const f of est.falsas || []) {
      h += f.que === "llave"
        ? `<div class="jg-trampa">La llave de arranque de ${esc(nombre(f.uid))} no cuadra con su ficha: la mesa espera la buena, y se le puede echar con la votación.</div>`
        : `<div class="jg-trampa">${esc(Nombre(f.uid))} destapó una carta que no es la que puso boca abajo: la mesa espera la buena, y se le puede echar con la votación.</div>`;
    }
    const duras = tramposos.filter(t => t.que !== "oculta");
    const blandas = tramposos.filter(t => t.que === "oculta" && !(est.fuera || {})[t.uid]);
    if (duras.length) h += `<div class="jg-trampa">${duras.map(t => `${esc(Nombre(t.uid))}: ${esc(TRAMPA[t.que] || t.que)}.`).join("<br>")} La partida ya no vale.</div>`;
    if (blandas.length && est.fase === "fin" && p && p.fin)
      h += `<div class="jg-nota">${esc(blandas.map(t => nombre(t.uid)).join(", "))} no ${blandas.length === 1 ? "reveló su" : "revelaron su"} semilla: sus manos no se han podido comprobar.</div>`;
    set("unTrampa", h, h);
  }

  /* Los asientos van en elipse alrededor del fieltro, yo abajo y los
     demás en el orden de la mesa: con el sentido normal el turno corre
     como las agujas del reloj, que es hacia donde gira el anillo. */
  function pintaAsientos() {
    const js = est.jugadores;
    const me = Math.max(0, js.findIndex(j => j.uid === uid));
    const rot = js.slice(me).concat(js.slice(0, me));
    const N = rot.length;
    const w = esp();
    const d = w && (w.k === "tapas" || w.k === "destapa") ? w : w && w.k === "revela" && w.por === "tapa" ? w.d : null;
    const sigTurno = w && (w.k === "turno" || w.k === "pena") ? siguienteDe(w.uid) : "";
    const mono = est.monedas || {};
    let h = "";
    rot.forEach((j, k) => {
      const u = j.uid;
      const n = (est.cartas || {})[u] || 0;
      const fuera = !!(est.fuera || {})[u], elim = !!(est.elim || {})[u];
      const turno = est.fase === "jugando" && esperaA(u);
      const cls = ["jg-un-asiento", u === uid ? "yo" : "", turno ? "turno" : "", fuera ? "fuera" : "", elim ? "elim" : "",
        est.fase === "fin" && est.ganador === u ? "gana" : "", n === 1 && !fuera && !elim ? "uno" : ""].filter(Boolean).join(" ");
      const foto = j.foto && /^(https?:|data:image\/)/.test(j.foto)
        ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
      const a = (90 + k * 360 / N) * Math.PI / 180;
      const x = (50 + 50 * Math.cos(a)).toFixed(2), y = (50 + 50 * Math.sin(a)).toFixed(2);
      const na = fuera || elim ? 0 : Math.min(n, 10);
      let abanico = "";
      if (u !== uid) {
        for (let i = 0; i < na; i++) abanico += `<i style="--k:${i}"></i>`;
        abanico = `<div class="jg-un-abanico" style="--n:${na}">${abanico}</div>`;
      }
      const marcas = [];
      if (sigTurno === u && !turno) marcas.push(`<span class="jg-un-marca sig">siguiente</span>`);
      if (n === 1 && est.fase === "jugando" && !fuera && !elim && est.olvido !== u) marcas.push(`<span class="jg-un-marca uno">¡UNO!</span>`);
      if (est.olvido === u && est.fase === "jugando") {
        marcas.push(`<span class="jg-un-marca olvido">no dijo UNO</span>`);
        if (u !== uid && juego()) marcas.push(`<button class="jg-un-pilla" data-pilla="${esc(u)}"${enviando ? " disabled" : ""}>¡Pillado!</button>`);
      }
      if (elim) marcas.push(`<span class="jg-un-marca elim">fuera: ${UNO_TOPE} cartas</span>`);
      if (fuera) marcas.push(`<span class="jg-un-marca">se fue</span>`);
      if (mono[u]) marcas.push(`<span class="jg-un-marca moneda${mono[u].usada ? " usada" : ""}" title="${mono[u].lado === "mercy" ? "Moneda de piedad" : "Moneda sin piedad"}">${mono[u].lado === "mercy" ? "🕊" : "💀"}</span>`);
      let tapa = "";
      if (d && d.tapas && d.tapas[u]) {
        const ab = d.abiertas && d.abiertas[u];
        tapa = `<div class="jg-un-tapa">${ab ? carta(ab.c, "mini") + `<b class="${ab.v ? "ok" : "no"}">${ab.v ? "✓" : "✗"}</b>` : dorso("mini")}</div>`;
      }
      h += `<div class="${cls}" data-asiento="${esc(u)}" style="--c:${esc(j.color || "#888")};--x:${x}%;--y:${y}%">
        ${abanico}
        <div class="jg-un-placa"><span class="jg-un-ava">${foto}</span><span class="jg-un-nom">${esc(u === uid ? "Tú" : j.nombre || "?")}</span><b class="jg-un-n" title="${elim || fuera ? "" : esc(nc(n))}">${elim || fuera ? "—" : n}</b>${turno ? `<span class="jg-un-piensa"><i></i><i></i><i></i></span>` : ""}</div>
        ${marcas.length ? `<div class="jg-un-marcas">${marcas.join("")}</div>` : ""}
        ${tapa}
      </div>`;
    });
    const cont = $("#unAsientos");
    if (cont) cont.dataset.n = N;
    set("unAsientos", h, h);
  }

  /* El siguiente que sigue en juego, en el sentido de la mesa. */
  function siguienteDe(u) {
    const ids = est.jugadores.map(j => j.uid), N = ids.length;
    const i = ids.indexOf(u);
    for (let k = 1; k <= N; k++) {
      const c = ids[(((i + est.dir * k) % N) + N) % N];
      if (activo(c)) return c;
    }
    return u;
  }

  function pintaMesa() {
    let h;
    const t = est.tope;
    const sala = $("#unSala");
    if (sala) {
      sala.classList.toggle("inv", est.dir === -1);
      sala.classList.toggle("pena", !!est.pena);
      sala.classList.toggle("juega", est.fase === "jugando" && !!t);
      sala.dataset.tinte = t && t.col ? t.col : t && est.modo === "allwild" ? "N" : "";
    }
    const escena = $(".jg-un-escena");
    if (escena) escena.classList.toggle("mia", turnoMio() || trasMio());
    if (est.fase === "espera") h = `<div class="jg-un-aviso">Esperando a que se sienten todos</div>`;
    else if (!t) h = `<div class="jg-un-aviso"><span class="jg-un-baraja">${dorso("tope")}${dorso("tope")}</span>Barajando…</div>`;
    else {
      const puedeRobar = turnoMio() && !est.pena && est.modo !== "allwild" && !enviando;
      /* El montón de debajo sale del historial: las últimas cartas
         jugadas, cada una con su giro, y encima la que manda. */
      const ev = (est.hist || []).filter(x => (x.e === "juega" && x.c) || x.e === "miente");
      const ult = ev[ev.length - 1];
      const encima = !!ult && (ult.c || ult.di) === t.c;
      const bajo = encima ? ev.slice(-6, -1) : ev.slice(-5);
      const pila = bajo.map(x => {
        const [dx, dy] = corrDe(x.i);
        return carta(x.c || x.di, "tope pila", ` style="--g:${giroDe(x.i)}deg;--dx:${dx}px;--dy:${dy}px"`);
      }).join("");
      const cls = "tope arriba" + (t.col ? " anillo-" + t.col : "") + (t.oculta ? " oculta" : "")
        + (topeTapado && !quieto() ? " llega" : "") + (Date.now() < golpeHasta ? " golpe" : "");
      const top = carta(t.c, cls, ` style="--g:${encima ? giroDe(ult.i) : 0}deg"`);
      const color = t.col ? `<span class="jg-un-color c-${t.col}">${punto(t.col)} ${esc(UNO_NOMBRE_COLOR[t.col])}</span>`
        : est.modo === "allwild" ? `<span class="jg-un-color">todo vale</span>` : "";
      h = `<div class="jg-un-pilas">
          <button class="jg-un-mazo${puedeRobar ? " vivo" : ""}" data-roba${puedeRobar ? "" : " disabled"} title="${puedeRobar ? (est.nm ? "Robar hasta poder jugar" : "Robar una carta") : "Mazo"}">${dorso("tope m3")}${dorso("tope m2")}${dorso("tope m1")}${puedeRobar ? `<span class="jg-un-roba-t">Robar</span>` : ""}</button>
          <div class="jg-un-descarte">${pila}${top}</div>
        </div>
        <div class="jg-un-info">
          ${color}
          ${t.oculta ? `<span class="jg-un-color">🎭 boca abajo, dice…</span>` : ""}
          ${est.pena ? `<span class="jg-un-pena">+${est.pena.n} acumulado <small>(apila un +${est.pena.min} o más)</small></span>` : ""}
        </div>`;
    }
    set("unMesa", h, h);
  }

  /* La mano en abanico: las cartas se solapan lo justo para caber y
     cada una gira un poco alrededor de un centro bajo la mesa. */
  const anchoCarta = () => window.innerWidth <= 720 ? 50 : 62;
  const anchoTope = () => window.innerWidth <= 720 ? 76 : 92;

  function pintaMano() {
    let h = "", clave, cartas = null;
    if (ctx.mirando || !jugador(uid)) { clave = "mira"; h = ""; }
    else if (est.fase === "espera") { clave = "espera"; h = ""; }
    else if ((est.elim || {})[uid]) { clave = "elim"; h = `<div class="jg-nota">Llegaste a ${UNO_TOPE} cartas: fuera de la partida. Ahora miras cómo acaba.</div>`; }
    else if ((est.fuera || {})[uid]) { clave = "fuera"; h = ""; }
    else {
      const s = miSec();
      if (s === null) { clave = "cargando"; h = `<div class="jg-nota">Mirando tu mano…</div>`; }
      else if (s === false) { clave = "mala"; h = `<div class="jg-trampa">No encuentro la semilla de esta sala en este navegador: no puedo ver tu mano ni jugarla.</div>`; }
      else if (!est.mezcla) { clave = "sin"; h = `<div class="jg-nota">Barajando…</div>`; }
      else {
        const m = mia();
        cartas = (m ? m.mano : []).slice().sort((a, b) => rango(a) - rango(b));
        orden = cartas;
        const w = esp();
        const tapando = juego() && w && w.k === "tapas" && w.faltan.includes(uid);
        const ok = cartas.map(c => !enviando && (tapando || sirve(c)));
        const hayTurno = turnoMio() || trasMio();
        const esc0 = $(".jg-un-escena");
        const W = Math.max(200, (esc0 ? esc0.clientWidth : 600) - 32);
        const cw = anchoCarta(), n = cartas.length;
        const g = n > 1 ? Math.max(-0.76 * cw, Math.min(8, (Math.max(120, W - 40) - n * cw) / (n - 1))) : 0;
        const paso = n ? Math.min(5, 48 / n) : 0;
        /* Las que no estaban en la mano pintada antes: son las que llegan. */
        const nuevas = new Set();
        if (animarMano) {
          const cuenta = new Map();
          for (const c of manoAntes) cuenta.set(c, (cuenta.get(c) || 0) + 1);
          cartas.forEach((c, i) => { const k = cuenta.get(c) || 0; if (k) cuenta.set(c, k - 1); else nuevas.add(i); });
        }
        const vistas = new Map();
        let cs = "";
        cartas.forEach((c, i) => {
          const occ = vistas.get(c) || 0;
          vistas.set(c, occ + 1);
          const cls = ["jg-un-hueco", hayTurno || tapando ? (ok[i] ? "ok" : "no") : "", sel && sel.i === i ? "sel" : "", tapaSel === i ? "sel" : ""].filter(Boolean).join(" ");
          const r = (i - (n - 1) / 2) * paso;
          const y = 420 * (1 - Math.cos(r * Math.PI / 180));
          cs += `<button class="${cls}" data-i="${i}" data-k="${esc(c)}#${occ}"${ok[i] ? "" : " disabled"} style="--r:${r.toFixed(2)}deg;--y:${y.toFixed(1)}px;${i ? `margin-left:${g.toFixed(1)}px;` : ""}z-index:${i + 1}">${carta(c, nuevas.has(i) ? "nueva" : "")}</button>`;
        });
        const avisos = [];
        if (m && m.ilegibles && m.ilegibles.length)
          avisos.push(`<div class="jg-trampa">No pude abrir el sobre de ${esc(m.ilegibles.map(nombre).join(", "))}: tu mano ya no se puede saber.</div>`);
        if (est.nm && cartas.length >= UNO_TOPE - 5)
          avisos.push(`<div class="jg-nota">Llevas ${cartas.length}: con ${UNO_TOPE} quedas fuera.</div>`);
        const unoBtn = puedeDecirUno(cartas)
          ? `<button class="jg-un-uno${digoUno ? " on" : ""}" id="unDigo" title="Dilo antes de jugar la penúltima, o te pueden pillar">${digoUno ? "✓ ¡UNO!" : "¿Decir ¡UNO!?"}</button>` : "";
        clave = [cartas.join(","), ok.join(""), sel ? sel.i : -1, tapaSel, digoUno, unoBtn ? 1 : 0, avisos.length, hayTurno, enviando, W, cw].join("|");
        h = `<div class="jg-un-mano-t"><b>Tu mano</b> <span>${nc(cartas.length)}</span>${unoBtn}</div>
          <div class="jg-un-cartas" style="--n:${cartas.length}">${cs}</div>${avisos.join("")}`;
      }
    }
    setMano(clave, h, cartas);
  }

  /* Repintar la mano sin que salte: cada carta recuerda dónde estaba
     (por su código y su repetición) y se desliza desde ahí. */
  function setMano(clave, h, cartas) {
    if (firmas.unMano === clave) return;
    firmas.unMano = clave;
    if (cartas) manoAntes = cartas.slice();
    const el = $("#unMano");
    if (!el) return;
    const antes = new Map();
    if (!quieto()) for (const b of el.querySelectorAll(".jg-un-hueco[data-k]")) antes.set(b.dataset.k, b.getBoundingClientRect());
    el.innerHTML = h;
    el.classList.toggle("vacia", !h);
    if (!antes.size) return;
    for (const b of el.querySelectorAll(".jg-un-hueco[data-k]")) {
      const r0 = antes.get(b.dataset.k), sp = b.firstElementChild;
      if (!r0 || !sp || !sp.animate) continue;
      const r1 = b.getBoundingClientRect();
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      sp.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }

  /* ¿Alguna jugada posible me dejaría con una carta? Entonces toca
     poder decir UNO. Se ofrece como interruptor y no se dice solo:
     olvidarse es parte del juego. */
  function puedeDecirUno(cartas) {
    if (!(turnoMio() || trasMio())) return false;
    return cartas.some((c, i) => {
      if (!sirve(c)) return false;
      const resto = cartas.filter((_, k) => k !== i);
      if (valorUno(c) === "D") return resto.length - resto.filter(x => colorUno(x) === colorUno(c)).length === 1;
      if (sinTilde(c) === "ND") return UNO_COLORES.some(col => resto.length - resto.filter(x => colorUno(x) === col).length === 1);
      return resto.length === 1;
    });
  }

  /* ---------- la carta que se está jugando ---------- */
  const resto = () => orden.filter((_, k) => k !== sel.i);
  const pideObj = c => (est.nm && valorUno(c) === "7" && resto().length > 0) || (sinTilde(c) === "NW" && resto().length > 0) || sinTilde(c) === "NT2";
  const puedeMoneda = c => {
    const mo = (est.monedas || {})[uid];
    return !!(est.nm && mo && mo.lado === "nomercy" && !mo.usada && roboUno(c) > 0);
  };
  function falta() {
    if (!sel) return "";
    const c = sel.c;
    if (esMentiraUno(c)) {
      if (!sel.di) return "anuncio";
      if (esComodinUno(sel.di) && !sel.col) return "color";
      return "";
    }
    if (esComodinUno(c) && est.modo !== "allwild" && !sel.col) return "color";
    if (pideObj(c) && !sel.obj) return "obj";
    return "";
  }
  function jugadaDeSel() {
    const c = sel.c, s = miSec();
    let j;
    if (esMentiraUno(c)) {
      j = { t: "miente", uid, di: sel.di, h: tapaUno(c, salUno(s.sem, s.sal, cuentaUno(est, uid).ocultas)) };
      if (esComodinUno(sel.di)) j.col = sel.col;
    } else {
      j = { t: "juega", uid, c };
      if (sel.col && esComodinUno(c) && est.modo !== "allwild") j.col = sel.col;
      if (sel.obj && pideObj(c)) j.obj = sel.obj;
      const r = resto();
      if (valorUno(c) === "D") j.n = r.filter(x => colorUno(x) === colorUno(c)).length;
      if (c === "ND") j.n = r.filter(x => colorUno(x) === sel.col).length;
      if (c === "NF") j.mano = r;
      if (sel.moneda && puedeMoneda(c)) j.moneda = true;
    }
    if (digoUno) j.uno = true;
    return j;
  }
  function quizaManda() {
    if (!sel || falta()) { pinta(); return; }
    if (!esMentiraUno(sel.c) && puedeMoneda(sel.c)) { pinta(); return; }   // se confirma a mano
    mandaSel();
  }
  function mandaSel() {
    const j = jugadaDeSel();
    /* De dónde sale volando: de su sitio en la mano, no del montón. */
    const b = host && host.querySelector(`.jg-un-cartas .jg-un-hueco[data-i="${sel.i}"] .jg-un-c`);
    clicMio = b ? { c: sel.c, r: b.getBoundingClientRect() } : null;
    sel = null;
    manda(j).then(() => { digoUno = false; });
  }

  /* ---------- la mesa en movimiento ---------- */

  /* El foco: un haz de luz desde el centro del fieltro hacia quien tiene
     que mover. El ángulo se acumula por el camino corto, así al pasar de
     un asiento al siguiente gira un poco y no da la vuelta entera. */
  function apunta() {
    const f = $("#unFoco");
    if (!f || !est) return;
    const w = esp(), debe = est.debe || [];
    let actor = "";
    if (est.fase === "jugando") {
      if (debe.length === 1) actor = debe[0];
      else if (w && ["turno", "pena", "tras", "hasta", "reto", "ruleta"].includes(w.k)) actor = w.uid;
    }
    const a = actor && asiento(actor);
    const placa = a && a.querySelector(".jg-un-placa");
    if (!placa || !f.offsetParent) { f.classList.add("off"); return; }
    const r0 = f.getBoundingClientRect(), r1 = placa.getBoundingClientRect();
    const dx = r1.left + r1.width / 2 - r0.left, dy = r1.top + r1.height / 2 - r0.top;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    angAcum = angAcum === null ? ang : angAcum + ((((ang - angAcum) % 360) + 540) % 360 - 180);
    f.style.setProperty("--a", angAcum.toFixed(1) + "deg");
    f.style.setProperty("--l", Math.max(20, Math.hypot(dx, dy) - 30).toFixed(0) + "px");
    f.style.setProperty("--c", (jugador(actor) || {}).color || "#ffd76a");
    f.classList.remove("off");
  }

  function alMedir() {
    cancelAnimationFrame(rafTam);
    rafTam = requestAnimationFrame(() => { if (!muerto && est && host) { pintaMano(); apunta(); } });
  }

  const asiento = u => host && host.querySelector(`.jg-un-asiento[data-asiento="${CSS.escape(u)}"]`);
  const rectDe = s => { const el = $(s); return el ? el.getBoundingClientRect() : null; };
  const centro = r => [r.left + r.width / 2, r.top + r.height / 2];
  /* Hacia dónde vuelan las cartas de alguien: a su abanico, o a su placa. */
  function rAsiento(u) {
    if (u === uid && !ctx.mirando) { const m = rectDe("#unMano .jg-un-cartas"); if (m && m.width) return m; }
    const a = asiento(u);
    if (!a) return null;
    const x = a.querySelector(".jg-un-abanico") || a.querySelector(".jg-un-placa") || a;
    return x.getBoundingClientRect();
  }

  /* Cuenta una animación como «vuelo» hasta que acaba (o hasta un tope,
     por si el navegador la cancela sin avisar), y cuando no queda
     ninguna, la mesa está quieta y el cartel del final puede salir. */
  function sigue(anim, ms, fin) {
    vuelos++;
    let hecho = false;
    const acaba = () => {
      if (hecho) return;
      hecho = true;
      if (fin && !muerto) fin();
      vuelos = Math.max(0, vuelos - 1);
      if (!vuelos) trasVuelos();
    };
    if (anim) { anim.onfinish = acaba; anim.oncancel = acaba; }
    setTimeout(acaba, ms + 1500);
  }

  /* Una carta que vuela en arco de `a` a `b` (dos rectángulos de pantalla). */
  function vuela(html, a, b, o = {}) {
    if (!capa || !a || !b) { if (o.fin) o.fin(); return; }
    const [x0, y0] = centro(a), [x1, y1] = centro(b);
    const el = document.createElement("div");
    el.className = "jg-un-vuelo";
    el.style.left = x0 + "px";
    el.style.top = y0 + "px";
    el.innerHTML = html;
    capa.appendChild(el);
    const dx = x1 - x0, dy = y1 - y0, alto = Math.min(90, 30 + Math.hypot(dx, dy) * 0.18);
    const r0 = o.r0 || 0, r1 = o.r1 || 0, s0 = o.s0 == null ? 1 : o.s0, s1 = o.s1 == null ? 1 : o.s1;
    const tr = (x, y, r, sc) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    const dur = o.dur || 520, retraso = o.retraso || 0;
    const anim = el.animate([
      { offset: 0, opacity: 0, transform: tr(0, 0, r0, s0) },
      { offset: 0.12, opacity: 1 },
      { offset: 0.5, opacity: 1, transform: tr(dx / 2, dy / 2 - alto, (r0 + r1) / 2, (s0 + s1) / 2 * 1.08) },
      { offset: 1, opacity: 1, transform: tr(dx, dy, r1, s1) }
    ], { duration: dur, delay: retraso, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" });
    sigue(anim, retraso + dur, () => { el.remove(); if (o.fin) o.fin(); });
  }

  /* Un grito sobre el asiento: ¡UNO!, ¡Pillado!, +4… No retiene el final. */
  function grito(u, txt, tipo = "", retraso = 0) {
    const a = asiento(u), pl = a && a.querySelector(".jg-un-placa");
    if (!capa || !pl) return;
    const r = pl.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "jg-un-grito" + (tipo ? " " + tipo : "");
    el.textContent = txt;
    el.style.left = (r.left + r.width / 2) + "px";
    el.style.top = r.top + "px";
    capa.appendChild(el);
    const an = el.animate([
      { offset: 0, opacity: 0, transform: "translate(-50%,-40%) scale(.4)" },
      { offset: 0.18, opacity: 1, transform: "translate(-50%,-95%) scale(1.15)" },
      { offset: 0.3, opacity: 1, transform: "translate(-50%,-100%) scale(1)" },
      { offset: 0.8, opacity: 1, transform: "translate(-50%,-115%) scale(1)" },
      { offset: 1, opacity: 0, transform: "translate(-50%,-165%) scale(.96)" }
    ], { duration: 1500, delay: retraso, easing: "ease-out", fill: "both" });
    an.onfinish = () => el.remove();
    setTimeout(() => el.remove(), retraso + 2500);
  }

  /* Una onda del color pedido al caer un comodín. */
  function onda(col) {
    const r = rectDe(".jg-un-descarte");
    if (!capa || !r) return;
    const el = document.createElement("div");
    el.className = "jg-un-onda c-" + (col || "N");
    const [x, y] = centro(r);
    el.style.left = x + "px";
    el.style.top = y + "px";
    capa.appendChild(el);
    const an = el.animate([
      { opacity: 0.9, transform: "translate(-50%,-50%) scale(.5)" },
      { opacity: 0, transform: "translate(-50%,-50%) scale(3.2)" }
    ], { duration: 900, easing: "cubic-bezier(.2,.7,.3,1)" });
    an.onfinish = () => el.remove();
    setTimeout(() => el.remove(), 1500);
  }

  function sacude(u, retraso = 0) {
    const a = asiento(u), pl = a && a.querySelector(".jg-un-placa");
    if (!pl || !pl.animate) return;
    pl.animate([{ transform: "none" }, { transform: "translateX(-7px) rotate(-2deg)" }, { transform: "translateX(6px) rotate(2deg)" },
      { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "none" }], { duration: 520, delay: retraso });
  }

  /* La carta de arriba del descarte estaba escondida mientras volaba:
     al llegar se enseña con un golpe seco. */
  function aterriza() {
    topeTapado = false;
    golpeHasta = Date.now() + 650;
    firmas.unMesa = null;
    if (est && host) pintaMesa();
  }
  const trasVuelos = () => listoSiFin();

  /* Lo nuevo del historial, contado con cartas: cada suceso lanza sus
     vuelos y sus gritos en una línea de tiempo `t`, uno detrás de otro. */
  function animaSucesos(nuevos) {
    if (!capa || !host) return;
    let t = 0, origenMano = null, tMano = 0;
    const mazo = () => rectDe(".jg-un-mazo");
    const desc = () => rectDe(".jg-un-descarte");
    const manoR = () => rectDe("#unMano .jg-un-cartas");
    const soy = u => u === uid && !ctx.mirando;
    const ultPila = nuevos.slice().reverse().find(x => (x.e === "juega" && x.c) || x.e === "miente" || x.e === "empieza");
    const sT = anchoTope();
    for (const x of nuevos) {
      const u = x.uid;
      switch (x.e) {
        case "juega": case "miente": {
          if (x.e === "juega" && !x.c) break;
          const html = x.e === "juega" ? carta(x.c, "tope") : dorso("tope");
          let a, s0;
          if (soy(u) && clicMio && clicMio.r && (x.e === "miente" || clicMio.c === x.c)) { a = clicMio.r; s0 = clicMio.r.width / sT; clicMio = null; }
          else if (soy(u)) { a = manoR(); s0 = anchoCarta() / sT; }
          else { a = rAsiento(u); s0 = 0.34; }
          const comodin = x.e === "juega" && esComodinUno(x.c);
          const fin = () => { if (x === ultPila) aterriza(); if (comodin) onda(x.col); };
          vuela(html, a, desc(), { retraso: t, dur: 520, r0: soy(u) ? 0 : -20, r1: giroDe(x.i), s0, s1: 1, fin });
          t += 300;
          break;
        }
        case "roba": {
          const n = Math.max(1, x.n || 1);
          if (soy(u)) { if (!origenMano) { origenMano = mazo(); tMano = t; } }
          else {
            const k = Math.min(n, 6), dst = rAsiento(u);
            for (let i = 0; i < k; i++) vuela(dorso("tope"), mazo(), dst, { retraso: t + i * 85, dur: 460, s1: 0.34, r1: 12 });
            t += k * 85 + 120;
          }
          if (n >= 4) grito(u, "+" + n, "malo", t);
          break;
        }
        case "cambio": {
          for (const pr of x.pares || []) {
            if (soy(pr.a)) { origenMano = rAsiento(pr.de); tMano = t; }
            else if (soy(pr.de)) { const src = manoR(), dst = rAsiento(pr.a); for (let i = 0; i < 3; i++) vuela(dorso("tope"), src, dst, { retraso: t + i * 85, s0: 0.6, s1: 0.34 }); }
            else for (let i = 0; i < 3; i++) vuela(dorso("tope"), rAsiento(pr.de), rAsiento(pr.a), { retraso: t + i * 85, s0: 0.34, s1: 0.34 });
          }
          t += 400;
          break;
        }
        case "descarta": {
          const k = Math.min(x.n || 1, 5), src = soy(u) ? manoR() : rAsiento(u);
          for (let i = 0; i < k; i++) vuela(dorso("tope"), src, desc(), { retraso: t + i * 90, dur: 480, s0: soy(u) ? 0.6 : 0.34, s1: 0.9, r1: giroDe(x.i + i) });
          t += k * 90 + 150;
          break;
        }
        case "empieza": {
          const otros = est.jugadores.filter(j => activo(j.uid) && !soy(j.uid));
          for (let r = 0; r < 3; r++) for (const j of otros) { vuela(dorso("tope"), mazo(), rAsiento(j.uid), { retraso: t, dur: 420, s1: 0.34, r1: 10 }); t += 60; }
          if (!origenMano && activo(uid) && !ctx.mirando) { origenMano = mazo(); tMano = 0; }
          if (est.tope) vuela(carta(est.tope.c, "tope"), mazo(), desc(), { retraso: t, dur: 560, r0: 180, fin: x === ultPila ? aterriza : null });
          t += 300;
          break;
        }
        case "uno": grito(u, "¡UNO!", "oro", t); break;
        case "pilla": grito(x.a, "¡Pillado!", "malo", t); sacude(x.a, t); break;
        case "duda": grito(u, "¡Mientes!", "malo", t); break;
        case "cree": grito(u, "Te creo", "", t); break;
        case "mentira": grito(u, "¡Mentira!", "malo", t); sacude(u, t); break;
        case "verdad": grito(u, "¡Verdad!", "bien", t); break;
        case "reta": grito(u, "¡Reto!", "malo", t); break;
        case "resp": grito(u, x.legal ? "Legal" : "Ilegal", x.legal ? "bien" : "malo", t); break;
        case "elimina": grito(u, "💀 Fuera", "malo", t); sacude(u, t); break;
        case "gana": grito(u, "🏆 ¡Gana!", "oro", t); break;
        case "final": grito(u, "⚔ Ataque final", "malo", t); break;
        case "ruleta": grito(u, "🎡 " + (UNO_NOMBRE_COLOR[x.col] || ""), "", t); break;
        case "usamoneda": grito(u, x.lado === "mercy" ? "🕊 Piedad" : "💀 ×2", "", t); break;
        case "pasa": grito(u, "Paso", "suave", t); break;
        default: break;
      }
    }
    const w = esp();
    if (w && (w.k === "turno" || w.k === "pena") && w.uid === uid && juego()) grito(uid, "Tu turno", "turno", t + 150);
    /* Las cartas que me llegan salen del mazo (o de quien me pasó su
       mano) y se colocan en su sitio del abanico, una detrás de otra. */
    if (origenMano) {
      const [x0, y0] = centro(origenMano);
      host.querySelectorAll("#unMano .jg-un-cartas .jg-un-c.nueva").forEach((sp, i) => {
        if (!sp.animate) return;
        const r1 = sp.getBoundingClientRect();
        const [x1, y1] = centro(r1);
        const dur = 560, retraso = tMano + i * 85;
        const an = sp.animate([
          { offset: 0, opacity: 0, transform: `translate(${x0 - x1}px,${y0 - y1}px) rotate(-12deg) scale(.8)` },
          { offset: 0.15, opacity: 1 },
          { offset: 1, opacity: 1, transform: "none" }
        ], { duration: dur, delay: retraso, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" });
        sigue(an, retraso + dur);
      });
    }
  }

  /* ---------- el pie: lo que me toca decidir ---------- */
  function pintaPie() {
    let h = "", clave;
    const w = esp();
    const off = enviando ? " disabled" : "";
    const botonesColor = (attr, extra = "") => UNO_COLORES.map(col =>
      `<button class="jg-un-bcol c-${col}${extra === col ? " sel" : ""}" ${attr}="${col}"${off}>${esc(UNO_NOMBRE_COLOR[col])}</button>`).join("");
    const otros = () => est.jugadores.filter(j => j.uid !== uid && activo(j.uid));

    if (est.fase === "espera") { clave = "espera"; h = `<div class="jg-nota">La partida empieza cuando se sienten todos.</div>`; }
    else if (est.fase === "fin") { clave = "fin"; h = `<div class="jg-nota">Partida terminada.</div>`; }
    else if (!juego()) { clave = "mira" + (w ? w.k : ""); h = `<div class="jg-nota">${jugador(uid) && !ctx.mirando ? "Ya no juegas esta partida." : "Estás mirando."}</div>` + aviso(); }
    else if (!w) { clave = "nada"; h = aviso(); }
    else if (est.olvido === uid) {
      clave = "olvido" + enviando;
      h = `<div class="jg-un-panel"><div class="jg-nota">¡Te queda una y no dijiste UNO! Dilo antes de que te pillen (o antes de que juegue el siguiente).</div>
        <div class="jg-un-fila"><button class="jg-un-boton grande" id="unUno"${off}>¡UNO!</button></div></div>`;
    }
    else if (sel) {
      const c = sel.c, fa = falta();
      let cuerpo = "";
      if (fa === "anuncio") {
        const opciones = anunciablesUno().filter(d => jugableUno(d, e()));
        cuerpo = `<div class="jg-nota">Juegas boca abajo. ¿Qué dices que es? La verdadera es ${esc(nombreCarta(sinTilde(c)))}${opciones.includes(sinTilde(c)) ? "" : " (y no se puede anunciar aquí)"}.</div>
          <div class="jg-un-anuncios">${opciones.map(d => `<button class="jg-un-hueco${d === sinTilde(c) ? " verdad" : ""}" data-di="${d}"${off}>${carta(d, "mini")}</button>`).join("")}</div>`;
      } else if (fa === "color") {
        cuerpo = `<div class="jg-nota">¿Qué color pides?</div><div class="jg-un-fila">${botonesColor("data-col")}</div>`;
      } else if (fa === "obj") {
        const t = sinTilde(c) === "NT2" ? "¿Quién roba dos?" : "¿Con quién cambias la mano?";
        cuerpo = `<div class="jg-nota">${t}</div><div class="jg-un-fila">${otros().map(j =>
          `<button class="jg-un-boton" data-obj="${esc(j.uid)}"${off}>${esc(j.nombre || "?")} <small>(${nc(est.cartas[j.uid] || 0)})</small></button>`).join("")}</div>`;
      } else if (puedeMoneda(c)) {
        cuerpo = `<div class="jg-un-fila">
          <button class="jg-un-boton${sel.moneda ? " sel" : ""}" id="unMoneda"${off}>💀 ${sel.moneda ? "✓ " : ""}Doblar con la moneda sin piedad</button>
          <button class="jg-un-boton grande" id="unJugar"${off}>Jugar ${esc(nombreCarta(c))}${sel.moneda ? " ×2" : ""}</button></div>`;
      }
      clave = ["sel", sel.i, c, fa, sel.di, sel.col, sel.obj, sel.moneda, enviando].join("|");
      h = `<div class="jg-un-panel"><div class="jg-un-fila"><span class="jg-un-lbl">Juegas</span>${carta(c, "mini")}
        <button class="jg-un-boton suave" id="unCancela">Cancelar</button></div>${cuerpo}</div>`;
    }
    else if (w.k === "monedas") {
      if (w.faltan.includes(uid)) {
        clave = "monedas" + enviando;
        h = `<div class="jg-un-panel"><div class="jg-nota">Expansión: antes de empezar cada uno elige una moneda, que se usa una sola vez.</div>
          <div class="jg-un-fila">
            <button class="jg-un-boton moneda" data-moneda="mercy"${off}>🕊 Piedad<small>en tu turno tiras la mano (y lo acumulado) y robas 7 nuevas</small></button>
            <button class="jg-un-boton moneda" data-moneda="nomercy"${off}>💀 Sin piedad<small>doblas una carta de robar al jugarla</small></button>
          </div></div>`;
      } else { clave = "monedas-ya"; h = `<div class="jg-nota">Esperando a que ${esc(w.faltan.map(nombre).join(", "))} ${w.faltan.length === 1 ? "elija" : "elijan"} moneda.</div>` + aviso(); }
    }
    else if ((w.k === "turno" || w.k === "pena") && w.uid === uid) {
      const mo = (est.monedas || {})[uid];
      const merced = mo && mo.lado === "mercy" && !mo.usada
        ? `<button class="jg-un-boton" id="unMerced"${off}>🕊 Moneda de piedad: mano nueva</button>` : "";
      const notas = [];
      let botones = "";
      if (w.k === "pena") {
        botones = `<button class="jg-un-boton grande malo" id="unCarga"${off}>Cargar ${est.pena.n}</button>`;
        notas.push(`Te llega un +${est.pena.n}. Apila una carta de robar de +${est.pena.min} o más para pasárselo al siguiente, o cárgalo.`);
      } else if (est.modo === "allwild") {
        notas.push("Todo es comodín: juega la que quieras.");
      } else {
        botones = `<button class="jg-un-boton" id="unRoba"${off}>${est.nm ? "Robar hasta poder jugar" : "Robar una"}</button>`;
        const alguna = orden.some(sirve);
        notas.push(alguna ? "Juega una carta que coincida en color o en número/símbolo." : est.nm ? "No tienes jugada: robas hasta sacar una que sirva." : "No tienes jugada: roba una.");
        if (est.modo === "liar") notas.push("Las cartas 🎭 se juegan boca abajo anunciando lo que quieras: el siguiente te cree o te duda.");
      }
      clave = ["mio", w.k, est.pena ? est.pena.n : 0, !!merced, enviando, orden.join(",")].join("|");
      h = `<div class="jg-un-panel"><div class="jg-un-fila">${botones}${merced}</div>${notas.map(n => `<div class="jg-nota">${esc(n)}</div>`).join("")}</div>`;
    }
    else if ((w.k === "tras" || w.k === "hasta") && w.uid === uid) {
      const u = ultimaRobada();
      const vale = u && sirve(u);
      const t = vale ? `Robaste ${nombreCarta(u)}: puedes jugarla${w.k === "hasta" ? " (y tienes que hacerlo)" : ""}.`
        : `Robaste ${nombreCarta(u) || "una carta"}: no sirve, pasa el turno.`;
      clave = ["tras", w.k, u, vale, enviando].join("|");
      h = `<div class="jg-un-panel"><div class="jg-nota">${esc(t)}</div>
        ${w.k === "tras" || !vale ? `<div class="jg-un-fila"><button class="jg-un-boton" id="unPasa"${off}>Pasar</button></div>` : ""}</div>`;
    }
    else if (w.k === "reto" && w.uid === uid) {
      clave = "reto" + enviando;
      h = `<div class="jg-un-panel"><div class="jg-nota">${esc(Nombre(w.de))} te echó un +4. Solo es legal si no tenía ninguna carta ${esc(UNO_NOMBRE_COLOR[w.prev] || "del color")}. Si lo retas y era ilegal, roba 4 él; si era legal, robas 6 tú.</div>
        <div class="jg-un-fila"><button class="jg-un-boton malo" id="unCarga"${off}>Robar 4</button><button class="jg-un-boton grande" id="unReta"${off}>¡Reto!</button></div></div>`;
    }
    else if (w.k === "ruleta" && w.uid === uid) {
      clave = "ruleta" + enviando;
      h = `<div class="jg-un-panel"><div class="jg-nota">Ruleta de color: elige un color y robas hasta que salga una carta de ese color (que se queda en tu mano).</div>
        <div class="jg-un-fila">${botonesColor("data-ruleta")}</div></div>`;
    }
    else if (w.k === "duda") {
      const puedoDudar = w.de !== uid, creo = w.sig === uid;
      clave = ["duda", w.n, w.de, puedoDudar, creo, enviando].join("|");
      const di = nombreCarta(w.di) + (esComodinUno(w.di) && w.col ? " (pide " + UNO_NOMBRE_COLOR[w.col] + ")" : "");
      h = `<div class="jg-un-panel"><div class="jg-nota">${esc(verbo(w.de, "Jugaste", "jugó"))} boca abajo y ${w.de === uid ? "dices" : "dice"} que es <b>${esc(di)}</b>.
        ${creo ? "Te toca: créele o dúdale. Si dudas y decía la verdad, robas tú una; si mentía, se la lleva de vuelta y roba otra." : puedoDudar ? `Cualquiera puede dudar; ${esc(nombre(w.sig))} decide si le cree.` : "Esperando a ver si te creen…"}</div>
        <div class="jg-un-fila">${puedoDudar ? `<button class="jg-un-boton grande malo" id="unDuda"${off}>¡Mientes!</button>` : ""}${creo ? `<button class="jg-un-boton" id="unCree"${off}>Te creo</button>` : ""}</div></div>`;
    }
    else if (w.k === "tapas") {
      if (w.faltan.includes(uid)) {
        clave = ["tapas", w.col, tapaSel, enviando].join("|");
        h = `<div class="jg-un-panel"><div class="jg-nota">${esc(Nombre(w.de))} lanzó el reto del mentiroso: pide <b>${esc(UNO_NOMBRE_COLOR[w.col] || "")}</b>. Pon una carta boca abajo, del color si tienes; si no, farolea.</div>
          <div class="jg-un-fila"><button class="jg-un-boton grande" id="unTapa"${tapaSel < 0 || enviando ? " disabled" : ""}>${tapaSel < 0 ? "Elige una carta de tu mano" : "Poner boca abajo"}</button></div></div>`;
      } else { clave = "tapas-ya" + w.faltan.join(","); h = `<div class="jg-nota">Esperando las cartas boca abajo de ${esc(w.faltan.map(nombre).join(", "))}.</div>` + aviso(); }
    }
    else if (w.k === "destapa") {
      if (w.de === uid) {
        const quedan = Object.keys(w.tapas).filter(u => activo(u) && !w.abiertas[u]);
        clave = ["destapa", quedan.join(","), enviando].join("|");
        h = `<div class="jg-un-panel"><div class="jg-nota">Destapa las que creas que no son ${esc(UNO_NOMBRE_COLOR[w.col] || "")}: cada mentira vuelve a su dueño con una de castigo, y la primera verdad cierra el reto.</div>
          <div class="jg-un-fila">${quedan.map(u => `<button class="jg-un-boton" data-destapa="${esc(u)}"${off}>Destapar a ${esc(nombre(u))}</button>`).join("")}
          <button class="jg-un-boton suave" id="unBasta"${off}>Basta</button></div></div>`;
      } else { clave = "destapa-ya"; h = `<div class="jg-nota">${esc(Nombre(w.de))} decide qué cartas destapar.</div>` + aviso(); }
    }
    else {
      clave = "otro" + w.k + (w.uid || "");
      const t = w.k === "sobres" ? "Pasando las manos en sobres cerrados…"
        : w.k === "resp" ? `${Nombre(w.uid)} responde al reto…`
        : w.k === "revela" ? `${Nombre(w.uid)} destapa su carta…`
        : w.k === "llaves" ? "Barajando…"
        : (est.debe || []).length ? `Turno de ${nombre(est.debe[0])}.` : "";
      h = (t ? `<div class="jg-nota">${esc(t)}</div>` : "") + aviso();
    }
    set("unPie", clave + "|" + aviso(), h);
  }

  function aviso() {
    const w = esp();
    if (!w) return "";
    const t = Date.now() - esperaDesde;
    let quien = [];
    const auto = w.k === "llaves" ? w.faltan : w.k === "sobres" ? w.faltan.map(f => f.de)
      : (w.k === "resp" || w.k === "revela") ? [w.uid] : [];
    if (auto.length && t > AVISO_AUTO) quien = auto;
    else if (!auto.length && t > AVISO_TURNO) quien = est.debe || [];
    quien = [...new Set(quien)].filter(u => u !== uid);
    if (!quien.length) return "";
    return `<div class="jg-nota">Se está esperando a ${esc(quien.map(nombre).join(", "))}. Si no vuelve, se le puede echar con ⏏ arriba.</div>`;
  }

  /* ---------- el historial ---------- */
  function textoSuceso(x) {
    const col = c => UNO_NOMBRE_COLOR[c] || "";
    switch (x.e) {
      case "empieza": return `Empieza ${nombre(x.uid)}`;
      case "moneda": return `${verbo(x.uid, "Eliges", "elige")} la moneda ${x.lado === "mercy" ? "de piedad" : "sin piedad"}`;
      case "usamoneda": return x.lado === "mercy" ? `${verbo(x.uid, "Usas", "usa")} la moneda de piedad` : `${verbo(x.uid, "Doblas", "dobla")} con la moneda sin piedad`;
      case "juega": return `${Nombre(x.uid)}: ${nombreCarta(x.c)}${esComodinUno(x.c) && x.col ? " → " + col(x.col) : ""}${x.obj ? " a " + ati(x.obj) : ""}${x.moneda ? " ×2" : ""}`;
      case "miente": return `${verbo(x.uid, "Juegas", "juega")} boca abajo: «${nombreCarta(x.di)}»${esComodinUno(x.di) && x.col ? " → " + col(x.col) : ""}`;
      case "roba": {
        const n = x.n;
        const s = { turno: "", hasta: " hasta poder jugar", carta: "", diana: " (diana)", final: " (ataque final)",
          muerte: " (muerte súbita)", reto: " por el reto", ruleta: " en la ruleta", uno: " por no decir UNO",
          merced: " (mano nueva)", duda: " por dudar", mentira: " por mentir" }[x.por] || "";
        if (x.por === "pena") return `${verbo(x.uid, "Cargas", "carga")} ${nc(n)}`;
        return `${verbo(x.uid, "Robas", "roba")} ${nc(n)}${s}`;
      }
      case "gana": return `${verbo(x.uid, "Ganas", "gana")} la partida`;
      case "elimina": return `${verbo(x.uid, "Llegas", "llega")} a ${x.n} cartas: fuera`;
      case "cambio": {
        if (x.por === "0") return "El 0: todas las manos pasan al siguiente";
        const a = (x.pares || [])[0];
        return a ? `${Nombre(a.de)} y ${nombre(a.a)} cambian de mano` : "Cambio de manos";
      }
      case "descarta": return `${verbo(x.uid, "Descartas", "descarta")} ${x.n} ${x.n === 1 ? "carta" : "cartas"} ${col(x.col)}`;
      case "final": return `Ataque final de ${ati(x.uid)} contra ${ati(x.a)}: ${x.n >= 7 ? "¡siete o más acciones!" : x.n + (x.n === 1 ? " acción" : " acciones")}`;
      case "tapas": return `Se cierra el reto de ${ati(x.uid)}`;
      case "abandona": return `${verbo(x.uid, "Te vas", "se va")} de la mesa`;
      case "falsa": return `Algo de ${ati(x.uid)} no cuadra`;
      case "uno": return `${Nombre(x.uid)}: ¡UNO!`;
      case "pilla": return x.a === uid ? `${Nombre(x.uid)} te pilla sin decir UNO` : `${verbo(x.uid, "Pillas", "pilla")} a ${nombre(x.a)} sin decir UNO`;
      case "pasa": return `${verbo(x.uid, "Pasas", "pasa")}`;
      case "reta": return `${verbo(x.uid, "Retas", "reta")} el +4 de ${ati(x.a)}`;
      case "resp": return `${x.uid === uid ? "Tu +4" : "El +4 de " + nombre(x.uid)} era ${x.legal ? "legal" : "ilegal"}`;
      case "ruleta": return `${verbo(x.uid, "Pides", "pide")} ${col(x.col)} a la ruleta: ${nc(x.n)}`;
      case "cree": return x.a === uid ? `${Nombre(x.uid)} te cree` : `${verbo(x.uid, "Crees", "cree")} a ${nombre(x.a)}`;
      case "duda": return `${verbo(x.uid, "Dudas", "duda")} de ${ati(x.a)}`;
      case "verdad": return `${verbo(x.uid, "Destapas", "destapa")} ${nombreCarta(x.c)}: ${x.tapa ? "es del color" : "decía la verdad"}`;
      case "mentira": return `${verbo(x.uid, "Destapas", "destapa")} ${nombreCarta(x.c)}: ${x.tapa ? "no era del color" : "¡mentía!"}`;
      case "tapa": return `${verbo(x.uid, "Pones", "pone")} una carta boca abajo`;
      case "destapa": return `${verbo(x.uid, "Destapas", "destapa")} ${x.a === uid ? "la tuya" : "la de " + nombre(x.a)}`;
      default: return "";
    }
  }

  function pintaHist() {
    const ult = (est.hist || []).slice(-12).reverse().map(x => ({ x, t: textoSuceso(x) })).filter(y => y.t);
    const firma = ult.map(y => y.x.i).join(",");
    set("unHist", firma, ult.length ? `<div class="jg-un-hist-t">Lo último</div>` +
      ult.map(y => `<div class="jg-un-h h-${esc(y.x.e)}">${esc(y.t)}</div>`).join("") : "");
  }

  /* ---------- interacción ---------- */
  function alClic(ev) {
    if (!est) return;
    const b = ev.target.closest("button");
    if (!b || b.disabled || enviando) return;
    if (!juego()) return;
    const w = esp();

    if (b.hasAttribute("data-pilla")) { manda({ t: "pilla", uid, a: b.getAttribute("data-pilla") }); return; }
    if (b.id === "unUno") { manda({ t: "uno", uid }); return; }
    if (b.id === "unDigo") { digoUno = !digoUno; suena("clic"); pinta(); return; }
    if (b.hasAttribute("data-moneda")) { manda({ t: "moneda", uid, lado: b.getAttribute("data-moneda") }); return; }

    if (b.hasAttribute("data-i")) {
      const i = Number(b.getAttribute("data-i")), c = orden[i];
      if (!c) return;
      if (w && w.k === "tapas" && w.faltan.includes(uid)) { tapaSel = tapaSel === i ? -1 : i; suena("clic"); pinta(); return; }
      if (!sirve(c)) return;
      if (sel && sel.i === i) { sel = null; pinta(); return; }
      sel = { i, c, col: "", obj: "", di: "", moneda: false };
      suena("clic");
      quizaManda();
      return;
    }
    if (b.id === "unCancela") { sel = null; pinta(); return; }
    if (sel) {
      if (b.hasAttribute("data-di")) { sel.di = b.getAttribute("data-di"); quizaManda(); return; }
      if (b.hasAttribute("data-col")) { sel.col = b.getAttribute("data-col"); quizaManda(); return; }
      if (b.hasAttribute("data-obj")) { sel.obj = b.getAttribute("data-obj"); quizaManda(); return; }
      if (b.id === "unMoneda") { sel.moneda = !sel.moneda; suena("clic"); pinta(); return; }
      if (b.id === "unJugar" && !falta()) { mandaSel(); return; }
    }
    const s = miSec();
    if (b.hasAttribute("data-roba") || b.id === "unRoba") {
      if (!turnoMio() || est.pena || est.modo === "allwild") return;
      if (!est.nm) { manda({ t: "roba", uid }); return; }
      if (!s) return;
      manda({ t: "roba", uid, n: robaHastaUno(est, s, uid, mano(), c => jugableUno(c, { modo: est.modo, tope: est.tope })) });
      return;
    }
    if (b.id === "unPasa") { manda({ t: "pasa", uid }); return; }
    if (b.id === "unCarga") { manda({ t: "carga", uid }); return; }
    if (b.id === "unReta") { manda({ t: "reta", uid }); return; }
    if (b.id === "unMerced") { manda({ t: "merced", uid }); return; }
    if (b.hasAttribute("data-ruleta") && s) {
      const col = b.getAttribute("data-ruleta");
      manda({ t: "ruleta", uid, col, n: robaHastaUno(est, s, uid, mano(), c => colorUno(c) === col) });
      return;
    }
    if (b.id === "unDuda") { manda({ t: "duda", uid }); return; }
    if (b.id === "unCree") { manda({ t: "cree", uid }); return; }
    if (b.id === "unTapa" && tapaSel >= 0 && s) {
      const c = orden[tapaSel];
      tapaSel = -1;
      manda({ t: "tapa", uid, h: tapaUno(c, salUno(s.sem, s.sal, cuentaUno(est, uid).ocultas)) });
      return;
    }
    if (b.hasAttribute("data-destapa")) { manda({ t: "destapa", uid, a: b.getAttribute("data-destapa") }); return; }
    if (b.id === "unBasta") { manda({ t: "basta", uid }); return; }
  }

  function conTope(promesa) {
    let t;
    return Promise.race([promesa, new Promise((_, no) => { t = setTimeout(() => no(new Error("la jugada no vuelve")), ENVIO_MAX); })])
      .finally(() => clearTimeout(t));
  }

  async function manda(j) {
    if (enviando) return;
    enviando = true; enviandoT = Date.now(); pinta();
    try { await conTope(jugar(j)); } catch (err) { console.warn("[uno]", err); }
    finally { enviando = false; if (est) pinta(); }
  }

  /* ---------- lo que manda la pantalla sola ---------- */
  function automata(clave, j) {
    const t = hechos.get(clave);
    if (t && Date.now() - t < REENVIO_MS) return;
    hechos.set(clave, Date.now());
    const reintenta = () => { if (!muerto && hechos.get(clave)) { hechos.delete(clave); luego(automatismos, 1500); } };
    conTope(jugar(j)).then(ok => { if (!ok) reintenta(); }).catch(err => { console.warn("[uno]", err); reintenta(); });
  }

  function automatismos() {
    const w = esp();
    if (!w || ctx.mirando || !activo(uid) || est.fase !== "jugando") return;
    const s = miSec();
    if (!s) return;
    if (w.k === "llaves") {
      if (w.faltan.includes(uid)) automata("k", { t: "k", uid, c: arrUno(s.sem, s.sal) });
      return;
    }
    if (w.k === "sobres") {
      const m = mia();
      if (!m) return;
      for (const f of w.faltan) {
        if (f.de !== uid) continue;
        const clave = dhCompartida(s.sem, s.sal, (jugador(f.a) || {}).pk);
        if (!clave) continue;
        automata("s" + w.id + ">" + f.a, { t: "sobre", uid, a: f.a, enc: cierraSobreUno(clave, w.id, m.mano) });
      }
      return;
    }
    if (w.k === "resp" && w.uid === uid) {
      const m = mia();
      if (!m) return;
      automata("r" + (est.ops || []).length, { t: "resp", uid, ok: !m.mano.some(c => colorUno(c) === w.prev) });
      return;
    }
    if (w.k === "revela" && w.uid === uid) {
      const m = mia();
      const c = m && m.tapadas[w.n];
      if (!c) return;
      automata("v" + w.n, { t: "revela", uid, c, s: salUno(s.sem, s.sal, w.n) });
    }
  }

  function late() {
    if (muerto || !est) return;
    if (enviando && Date.now() - enviandoT > ENVIO_MAX + 3000) enviando = false;
    /* Red: si la carta que volaba al descarte se perdió, que se vea igual. */
    if (topeTapado && !vuelos) { topeTapado = false; firmas.unMesa = null; pintaMesa(); }
    if (est.fase === "jugando") { automatismos(); pinta(); }
    else if (est.fase === "fin" && !(p.fin && p.fin.at) && Date.now() - cierreT > 3000) cierre();
  }

  function listoSiFin() {
    if (listoDado || !est || est.fase !== "fin" || document.hidden || vuelos > 0) return;
    listoDado = true;
    if (ctx.listo) ctx.listo();
  }

  function alVolver() {
    if (document.hidden || muerto || !est) return;
    automatismos();
    pinta();
    listoSiFin();
  }

  /* Al acabar: publicar la semilla (para que la auditoría pueda rehacer
     todas las manos) y cerrar la sala, como en Flip 7. Se sigue
     intentando hasta que `fin` está escrito. */
  function cierre() {
    cierreT = Date.now();
    if (!finVisto) finVisto = Date.now();
    if (ctx.mirando || !jugador(uid)) return;
    if (!cerrando && !(est.semillas || {})[uid] && secListo) {
      cerrando = true;
      const s = sec;
      if (s && s.sem != null) jugar({ t: "s", uid, sem: s.sem, sal: s.sal || "" }).catch(() => {});
    }
    const faltan = est.jugadores.filter(j => !(est.fuera || {})[j.uid] && !(est.semillas || {})[j.uid]);
    if (!(p.fin && p.fin.at) && (!faltan.length || Date.now() - finVisto > ESPERA_SEMILLAS))
      Promise.resolve().then(() => terminar(est.ganador, est.motivo)).catch(() => {});
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    if (auditando || !p || !est) return;
    const firma = Object.keys(p.jugadas || {}).length + "|" + !!p.fin;
    if (firma === firmaAudit || (!p.fin && !Object.keys(est.semillas || {}).length)) return;
    auditando = true;
    try {
      const malas = await auditaUno(p, est);
      firmaAudit = firma;
      if (JSON.stringify(malas) !== JSON.stringify(tramposos)) { tramposos = malas; firmas.unTrampa = null; pinta(); }
    } catch (err) { /* una auditoría que falla no puede tumbar la mesa */ }
    finally { auditando = false; }
  }

  /* Lo que suena, del historial: solo lo más importante de cada tanda. */
  const SONIDO = [
    ["gana", x => x.uid === uid ? "gana" : "pierde"], ["elimina", () => "revienta"], ["final", () => "estalla"],
    ["mentira", () => "revienta"], ["verdad", () => "gana"], ["pilla", () => "golpe"],
    ["duda", () => "golpe"], ["reta", () => "golpe"], ["ruleta", () => "estalla"],
    ["descarta", () => "reparte"], ["cambio", () => "reparte"], ["uno", () => "ficha"],
    ["usamoneda", () => "entra"], ["juega", () => "carta"], ["miente", () => "carta"],
    ["tapa", () => "carta"], ["roba", () => "reparte"], ["pasa", () => "madera"], ["moneda", () => "ficha"]
  ];

  function actualizar(partida, estado) {
    p = partida; est = estado;
    pideSecreto();
    const w = esp();
    const fe = !w ? "" : [w.k, w.uid || "", (est.ops || []).length, (est.debe || []).join(",")].join(":");
    if (fe !== esperaFirma) { esperaFirma = fe; esperaDesde = Date.now(); }

    const hist = est.hist || [];
    const nuevos = primera ? [] : nuevosDe(histPrev, hist).slice(-16);
    histPrev = hist.slice();
    primera = false;
    if (!document.hidden && nuevos.length) {
      for (const [k, f] of SONIDO) {
        const x = nuevos.find(y => y.e === k);
        if (x) { if (!(k === "gana")) suena(f(x)); break; }
      }
      /* Me toca ahora (y no me tocaba): un aviso corto. */
      if ((est.debe || []).includes(uid) && nuevos.some(y => y.e !== "moneda")) luego(() => suena("turno"), 250);
    }

    /* Si hay algo nuevo que contar, la carta de arriba del descarte se
       esconde hasta que llegue volando, y la mano marca las que entran. */
    const animar = !!(nuevos.length && !quieto() && host);
    if (animar && nuevos.some(x => (x.e === "juega" && x.c) || x.e === "miente" || x.e === "empieza")) topeTapado = true;
    animarMano = animar;
    pinta();
    animarMano = false;
    if (animar) animaSucesos(nuevos);
    automatismos();
    audita();
    if (est.fase === "fin") { listoSiFin(); if (!(p.fin && p.fin.at)) cierre(); }
  }

  return { montar, actualizar, destruir, ocupado: () => vuelos > 0 };
}
