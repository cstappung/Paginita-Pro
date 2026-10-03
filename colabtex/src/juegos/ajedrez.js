/* Ajedrez — el de siempre, entre dos y por turnos (o a reloj).
 *
 * Las reglas y el reloj viven en `motor.js` (`redAjedrez`); esta
 * pantalla pinta la posición que sale de repasar el registro y manda
 * jugadas que el reductor ya sabe que son legales, porque las saca de
 * `est.legales`.
 *
 * Decisiones de la pantalla:
 *
 * - **Las piezas son archivos SVG de juegos de piezas libres**
 *   (`juegos/ajedrez/piezas/<juego>/wK.svg`, licencias en `LICENCIAS.md`
 *   de esa carpeta), puestos con `<image>`. No se incrustan: varios
 *   traen su propio `<style>` con ids, que chocarían entre sí dentro de
 *   un mismo SVG, y así tampoco engordan el bundle. Cada uno elige el
 *   suyo (`jg.ajPiezas` en localStorage) y se precargan al montar.
 * - **Se mueve con dos toques o arrastrando**, las dos cosas sobre el
 *   mismo estado `sel`. Tocar una pieza propia marca a dónde puede ir
 *   (punto en vacío, aro en captura); tocar el destino juega.
 * - **Premovimiento.** Con el turno del rival, lo mismo deja una jugada
 *   apuntada (`pre`): sus destinos son los geométricos de la pieza
 *   (las piezas propias tapan, las ajenas no, porque pueden moverse) y
 *   en cuanto llega el turno se manda si es legal en la posición nueva,
 *   o se descarta con un aviso. Clic derecho o tocar fuera la anula. Es
 *   solo de esta pantalla: el registro no sabe nada de premovimientos.
 * - **El reloj se pinta, no se decide.** El tiempo que queda sale del
 *   reductor (`est.reloj`) y aquí solo se le resta lo que lleva el turno
 *   que corre, con `ctx.ahora()` (la hora del servidor). Cuando la aguja
 *   cae, cualquiera de los dos manda `{t:"tiempo"}` y el reductor lo
 *   comprueba; se reintenta cada segundo y medio por si llega antes de
 *   tiempo por un desfase de reloj.
 * - **Tu color va abajo.** Quien mira ve las blancas abajo; ⇅ gira.
 * - **La coronación pregunta**, también en un premovimiento.
 * - **La pieza que movió el otro se desliza** desde su origen, en un
 *   `<g>` interior: un `transform` de CSS reemplaza al atributo.
 */
import { ajNombre, ajColor } from "./motor.js";
import { suena } from "./sonido.js";

const S = 100;

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- las piezas ---------- */
export const JUEGOS_PIEZAS = { cburnett: "Clásicas", chessnut: "Chessnut", fantasy: "Fantasía", celtic: "Celtas" };
let juegoPiezas = "cburnett";
try { const g = localStorage.getItem("jg.ajPiezas"); if (JUEGOS_PIEZAS[g]) juegoPiezas = g; } catch (e) { /* sin almacenamiento */ }

const urlPieza = (x, j = juegoPiezas) => `juegos/ajedrez/piezas/${j}/${ajColor(x)}${x.toUpperCase()}.svg`;
/* Una pieza en una caja de 100×100, para meter dentro de un SVG. */
export const piezaSvg = x => `<image href="${urlPieza(x)}" width="100" height="100"/>`;
const mini = x => `<img class="jg-aj-mini" src="${urlPieza(x)}" alt="" aria-hidden="true">`;
function precarga(j) {
  for (const c of "wb") for (const t of "KQRBNP") { const im = new Image(); im.src = urlPieza(c === "w" ? t : t.toLowerCase(), j); }
}

const CLARA = "#eed9b4", OSCURA = "#b58863";
const NOMBRE_PIEZA = { q: "Dama", r: "Torre", b: "Alfil", n: "Caballo" };
const MOTIVO = {
  mate: "Jaque mate.", ahogado: "Tablas por rey ahogado.", material: "Tablas: no queda material para dar mate.",
  repeticion: "Tablas por triple repetición.", cincuenta: "Tablas por la regla de los cincuenta movimientos.",
  acuerdo: "Tablas de mutuo acuerdo.", rendicion: "Abandono: se rindió.", abandono: "Partida abandonada.",
  tiempo: "Sin tiempo.", tiempomaterial: "Tablas: se acabó el tiempo, pero el rival no tenía con qué dar mate."
};
const SALTOS = [[-1, -2], [1, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [-1, 2], [1, 2]];
const RAYOS = { B: [[1, 1], [1, -1], [-1, 1], [-1, -1]], R: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
RAYOS.Q = [...RAYOS.B, ...RAYOS.R];

/* El tiempo como se lee en un reloj de ajedrez: m:ss, y con décimas
   por debajo de diez segundos, que es cuando importan. */
function formato(ms) {
  ms = Math.max(0, ms);
  if (ms < 10000) return "0:0" + (Math.floor(ms / 100) / 10).toFixed(1);
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function crearAjedrez(ctx) {
  const { uid, jugar, terminar } = ctx;
  const mirando = !!ctx.mirando;
  const ahora = ctx.ahora || Date.now;

  let host = null, muerto = false;
  let p = null, est = null;
  let sel = -1;                 // casilla seleccionada
  let pre = null;               // premovimiento apuntado {de, a, pr}
  let corona = null;            // {de, a, pre} mientras se elige pieza
  let girado = false;           // ⇅ a mano
  let enviando = false;
  let vistos = -1;              // movimientos vistos la última vez
  let animar = null;            // {de, a} que se desliza en la próxima pintada
  let propia = -1;              // índice de la jugada mía que no hay que animar
  let rindeHasta = 0, rindeReloj = 0;
  let arr = null;               // arrastre en curso
  let nota = "", notaHasta = 0; // aviso pasajero en el pie
  let reclamado = 0;            // última vez que se reclamó el tiempo
  let avisoPoco = false;        // ya sonó el aviso de poco tiempo
  let latido = 0;
  const firmas = {};

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-aj">
        <div class="jg-barra">
          <div class="jg-fase" id="ajFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-aj-btns" id="ajBtns"></div>
        </div>
        <div class="jg-tablero jg-aj-mesa">
          <div class="jg-aj-col">
            <div class="jg-aj-placa" id="ajArriba"></div>
            <div class="jg-aj-tab" id="ajTab"></div>
            <div class="jg-aj-placa" id="ajAbajo"></div>
          </div>
          <div class="jg-aj-lado">
            <div id="ajOferta"></div>
            <div class="jg-aj-hoja"><div class="jg-aj-hoja-t" id="ajRitmo">Jugadas</div><ol class="jg-aj-movs" id="ajMovs"></ol></div>
            <label class="jg-aj-piezas"><span>Piezas</span><select id="ajPiezas">${Object.entries(JUEGOS_PIEZAS).map(([k, t]) =>
              `<option value="${k}"${k === juegoPiezas ? " selected" : ""}>${t}</option>`).join("")}</select></label>
          </div>
        </div>
        <div class="jg-pie" id="ajPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
    host.addEventListener("pointerdown", alPulsar);
    host.addEventListener("contextmenu", alMenu);
    host.addEventListener("change", alCambiar);
    precarga(juegoPiezas);
    latido = setInterval(tic, 100);
  }

  function destruir() {
    muerto = true;
    clearTimeout(rindeReloj);
    clearInterval(latido);
    soltarArrastre();
    if (host) {
      host.removeEventListener("click", alClic);
      host.removeEventListener("pointerdown", alPulsar);
      host.removeEventListener("contextmenu", alMenu);
      host.removeEventListener("change", alCambiar);
      host.innerHTML = "";
    }
    host = null;
  }

  const jugadorDe = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return j ? j.nombre : "el rival"; };
  const miColor = () => (est && uid === est.blancas ? "w" : est && uid === est.negras ? "b" : "");
  const juego = () => !mirando && est && est.fase === "jugando" && !!miColor();
  const meToca = () => juego() && est.turno === uid;
  const abajo = () => { const c = miColor() || "w"; return girado ? (c === "w" ? "b" : "w") : c; };
  const avisa = t => { nota = t; notaHasta = Date.now() + 4000; };

  function set(id, firma, html) {
    if (firmas[id] === firma) return false;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
    return true;
  }

  /* Casilla → posición en pantalla según quién va abajo. */
  const pos = i => abajo() === "w" ? { x: (i & 7) * S, y: (i >> 3) * S } : { x: (7 - (i & 7)) * S, y: (7 - (i >> 3)) * S };

  /* A dónde puede ir la pieza de `de`: las legales si es tu turno, las
     de un premovimiento si es el del otro. Para el premovimiento valen
     las casillas que la pieza alcanza por geometría: una pieza propia
     tapa (no se va a mover mientras juega el rival), una ajena no
     (puede irse, o ser justo la que se captura). El enroque se ofrece
     siempre desde la casilla del rey; si ya no vale, se descarta. */
  function destinos(de) {
    if (meToca()) return (est.legales || []).filter(m => m.de === de);
    const tab = est.tab, x = tab[de], col = miColor(), out = [];
    if (!x || x === "." || ajColor(x) !== col) return out;
    const t = x.toUpperCase(), f = de >> 3, c = de & 7;
    const mia = i => tab[i] !== "." && ajColor(tab[i]) === col;
    const ult = col === "w" ? 0 : 7;
    const pon = (ff, cc) => {
      if (ff < 0 || ff > 7 || cc < 0 || cc > 7) return false;
      const a = ff * 8 + cc;
      if (mia(a)) return false;
      out.push({ de, a, cap: tab[a] !== ".", pr: t === "P" && ff === ult ? "q" : "" });
      return true;
    };
    if (t === "P") {
      const d = col === "w" ? -1 : 1;
      pon(f + d, c);
      if (f === (col === "w" ? 6 : 1) && !mia((f + d) * 8 + c)) pon(f + 2 * d, c);
      pon(f + d, c - 1); pon(f + d, c + 1);
    } else if (t === "N") for (const [dc, df] of SALTOS) pon(f + df, c + dc);
    else if (t === "K") {
      for (const [dc, df] of RAYOS.Q) pon(f + df, c + dc);
      if (f === (ult ^ 7) && c === 4) { pon(f, 6); pon(f, 2); }
    } else for (const [dc, df] of RAYOS[t]) {
      for (let k = 1; k < 8; k++) if (!pon(f + df * k, c + dc * k)) break;
    }
    return out;
  }

  /* ---------- el tablero ---------- */
  function tablero() {
    const out = [`<svg viewBox="0 0 800 800" class="jg-svg jg-aj-svg" id="ajSvg" role="img" aria-label="Tablero de ajedrez">`];
    const ult = est.ultima;
    const reyEnJaque = est.jaque ? est.tab.indexOf(est.color === "w" ? "K" : "k") : -1;
    for (let i = 0; i < 64; i++) {
      const { x, y } = pos(i), clara = ((i >> 3) + (i & 7)) % 2 === 0;
      out.push(`<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${clara ? CLARA : OSCURA}"/>`);
      if (ult && (i === ult.de || i === ult.a)) out.push(`<rect class="jg-aj-ult" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      if (pre && (i === pre.de || i === pre.a)) out.push(`<rect class="jg-aj-pre" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      if (i === sel) out.push(`<rect class="jg-aj-sel${meToca() ? "" : " pre"}" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      if (i === reyEnJaque) out.push(`<circle class="jg-aj-jaque" cx="${x + 50}" cy="${y + 50}" r="50"/>`);
    }
    /* Coordenadas dentro del tablero, como en los de madera: las filas
       en la columna de la izquierda y las letras en la fila de abajo, del
       color de la casilla contraria para que se lean. */
    for (let k = 0; k < 8; k++) {
      const iz = abajo() === "w" ? k * 8 : (7 - k) * 8 + 7;
      const cl = ((iz >> 3) + (iz & 7)) % 2 === 0;
      out.push(`<text class="jg-aj-coord" x="5" y="${k * S + 21}" fill="${cl ? OSCURA : CLARA}">${ajNombre(iz)[1]}</text>`);
      const ab = abajo() === "w" ? 56 + k : 7 - k;
      const cl2 = ((ab >> 3) + (ab & 7)) % 2 === 0;
      out.push(`<text class="jg-aj-coord" x="${k * S + 95}" y="795" text-anchor="end" fill="${cl2 ? OSCURA : CLARA}">${ajNombre(ab)[0]}</text>`);
    }
    for (let i = 0; i < 64; i++) {
      const x = est.tab[i];
      if (x === ".") continue;
      const { x: px, y: py } = pos(i);
      let dentro = "";
      if (animar && animar.a === i) {
        const o = pos(animar.de);
        dentro = ` class="jg-aj-llega" style="--dx:${o.x - px}px;--dy:${o.y - py}px"`;
      }
      const mia = juego() && ajColor(x) === miColor();
      out.push(`<g transform="translate(${px},${py})" class="jg-aj-pz${mia ? " jg-aj-mia" : ""}" data-i="${i}"><g${dentro}>${piezaSvg(x)}</g></g>`);
    }
    if (sel >= 0) for (const m of destinos(sel)) {
      if (m.pr && m.pr !== "q") continue;
      const { x, y } = pos(m.a), cl = meToca() ? "" : " pre";
      out.push(m.cap
        ? `<circle class="jg-aj-cap${cl}" cx="${x + 50}" cy="${y + 50}" r="44"/>`
        : `<circle class="jg-aj-punto${cl}" cx="${x + 50}" cy="${y + 50}" r="15"/>`);
    }
    out.push("</svg>");
    if (corona) {
      const c = miColor();
      out.push(`<div class="jg-aj-corona" role="dialog" aria-label="Elige la pieza de la coronación">
        <div>${corona.pre ? "Premovimiento: coronar" : "Coronar"} en ${ajNombre(corona.a)}</div>
        <div class="jg-aj-corona-ops">${"qrbn".split("").map(t =>
          `<button class="jg-aj-op" data-pr="${t}" title="${NOMBRE_PIEZA[t]}"><svg viewBox="0 0 100 100">${piezaSvg(c === "w" ? t.toUpperCase() : t)}</svg></button>`).join("")}</div>
        <button class="btn2 jg-aj-op-no" data-pr="">Cancelar</button>
      </div>`);
    }
    return out.join("");
  }

  /* La placa de un jugador: nombre, lo que lleva capturado, la ventaja
     de material y su reloj. El número del reloj no entra en la firma:
     lo cambia `tic` sin repintar la placa. */
  function placa(color) {
    const u = color === "w" ? est.blancas : est.negras;
    const j = jugadorDe(u);
    if (!j) return { firma: "-", html: `<span class="jg-nota">Esperando rival…</span>` };
    const lleva = (est.perdidas || { w: [], b: [] })[color === "w" ? "b" : "w"];
    const ventaja = (est.material[color] || 0) - (est.material[color === "w" ? "b" : "w"] || 0);
    const turno = est.fase === "jugando" && est.turno === u;
    const foto = j.foto ? `<img src="${esc(j.foto)}" alt="">` : esc((j.nombre || "?").slice(0, 1).toUpperCase());
    const reloj = est.reloj ? `<span class="jg-aj-reloj ${color}" data-c="${color}" role="timer" aria-label="Tiempo de ${color === "w" ? "blancas" : "negras"}">${formato(est.reloj[color])}</span>` : "";
    const html = `${ctx.avatar ? `<span class="jg-aj-av jg-con-marco">${ctx.avatar(j, 34)}</span>` : `<span class="jg-aj-av" style="--c:${esc(j.color || "#888")}">${foto}</span>`}
      <span class="jg-aj-quien"><b>${esc(u === uid ? "Tú" : j.nombre)}</b>
        <span class="jg-aj-caps">${lleva.map(t => mini(color === "w" ? t.toLowerCase() : t)).join("")}${ventaja > 0 ? `<em>+${ventaja}</em>` : ""}</span></span>
      <span class="jg-grow"></span>
      <span class="jg-aj-bando ${color}${turno ? " on" : ""}">${turno ? (u === uid ? "Te toca · " : "Le toca · ") : ""}${color === "w" ? "Blancas" : "Negras"}</span>
      ${reloj}`;
    return { firma: [u, j.nombre, j.foto, j.marco, j.color, lleva.join(""), ventaja, turno, !!est.reloj, juegoPiezas].join("|"), html };
  }

  function hoja() {
    const filas = [];
    for (let k = 0; k < est.movs.length; k += 2) {
      const a = est.movs[k], b = est.movs[k + 1];
      const ultimo = n => n === est.movs.length - 1 ? ' class="on"' : "";
      filas.push(`<li><span class="n">${k / 2 + 1}.</span><span${ultimo(k)}>${esc(a.san)}</span><span${ultimo(k + 1)}>${b ? esc(b.san) : ""}</span></li>`);
    }
    return filas.join("") || `<li class="jg-aj-vacia">Aún no se ha movido nada.</li>`;
  }

  function botones() {
    if (!juego()) return `<button class="btn2" data-acc="girar" title="Girar el tablero">⇅</button>`;
    const yaOferta = est.oferta || (est.ofrecio || {})[uid] === est.movs.length;
    const seguro = Date.now() < rindeHasta;
    return `<button class="btn2" data-acc="girar" title="Girar el tablero">⇅</button>
      <button class="btn2" data-acc="tablas" ${yaOferta || enviando ? "disabled" : ""} title="Ofrecer tablas">½ Tablas</button>
      <button class="btn2${seguro ? " jg-aj-peligro" : ""}" data-acc="rinde" ${enviando ? "disabled" : ""}>${seguro ? "¿Seguro? Rendirse" : "Rendirse"}</button>`;
  }

  function pinta() {
    if (!host || !est) return;
    let fase;
    if (est.fase === "espera") fase = "Esperando a que entre el otro…";
    else if (est.fase === "fin") {
      const m = MOTIVO[est.motivo] || "";
      if (!est.ganador) fase = m || "Tablas.";
      else if (est.ganador === uid) fase = "🏆 Ganas. " + (est.motivo === "tiempo" ? "Al rival se le acabó el tiempo." : m);
      else if (miColor() && !mirando) fase = "Pierdes. " + (est.motivo === "tiempo" ? "Se te acabó el tiempo." : m);
      else fase = `Gana ${nombreDe(est.ganador)}. ${m}`;
    } else if (meToca()) fase = est.jaque ? "¡Jaque! Te toca salir de él" : "Te toca mover";
    else fase = `Le toca a ${nombreDe(est.turno)}` + (est.jaque ? " (en jaque)" : "");
    const punto = est.fase === "jugando" ? (est.color === "w" ? "#fbf7ee" : "#2a2a30") : "#8a97a3";
    set("ajFase", fase + punto, `<span class="jg-punto-t jg-aj-punto-t" style="background:${punto}"></span>${esc(fase)}`);

    const ab = abajo(), ar = ab === "w" ? "b" : "w";
    const pa = placa(ar), pb = placa(ab);
    set("ajArriba", pa.firma, pa.html);
    set("ajAbajo", pb.firma, pb.html);

    const firmaTab = [est.tab.join(""), sel, pre ? pre.de + "-" + pre.a : "", est.ultima ? est.ultima.de + "-" + est.ultima.a : "",
      est.jaque, ab, est.turno, est.fase, corona ? corona.de + "-" + corona.a : "", juego(), juegoPiezas].join("|");
    if (set("ajTab", firmaTab, tablero())) animar = null;

    if (set("ajMovs", String(est.movs.length), hoja())) {
      const ol = host.querySelector("#ajMovs");
      if (ol) ol.scrollTop = ol.scrollHeight;
    }
    const r = est.reloj;
    set("ajRitmo", r ? r.base + "+" + r.inc : "", r ? `Jugadas · ${r.base / 60000}+${r.inc / 1000}` : "Jugadas · sin reloj");

    let oferta = "";
    const rival = uid === est.blancas ? est.negras : est.blancas;
    if (est.oferta && juego()) oferta = est.oferta === uid
      ? `<div class="jg-aj-aviso">Has ofrecido tablas. Si ${esc(nombreDe(rival))} mueve, la rechaza.</div>`
      : `<div class="jg-aj-aviso on"><b>${esc(nombreDe(est.oferta))} ofrece tablas.</b>
          <span><button class="btn" data-acc="acepta">Aceptar</button><button class="btn2" data-acc="rechaza">Rechazar</button></span></div>`;
    else if (est.oferta) oferta = `<div class="jg-aj-aviso">${esc(nombreDe(est.oferta))} ha ofrecido tablas.</div>`;
    set("ajOferta", est.oferta + "|" + juego(), oferta);

    set("ajBtns", [juego(), est.oferta, (est.ofrecio || {})[uid], est.movs.length, enviando, Date.now() < rindeHasta].join("|"), botones());

    let pie;
    if (Date.now() < notaHasta) pie = nota;
    else if (est.fase === "espera") pie = "Pásale el enlace de la sala a quien quieras y empezáis.";
    else if (est.fase === "fin") { const n = Math.ceil(est.movs.length / 2); pie = `Partida terminada en ${n} jugada${n === 1 ? "" : "s"}.`; }
    else if (mirando || !miColor()) pie = "Estás mirando la partida.";
    else if (meToca()) pie = sel >= 0 ? "Toca la casilla de destino, o arrastra la pieza." : "Toca una pieza tuya para ver a dónde puede ir, o arrástrala.";
    else if (pre) pie = `Premovimiento apuntado: ${ajNombre(pre.de)}–${ajNombre(pre.a)}. Sale solo en cuanto te toque, si es legal. Clic derecho o toca fuera para anularlo.`;
    else pie = `Juegas con ${miColor() === "w" ? "blancas" : "negras"}. Mientras ${nombreDe(est.turno)} piensa, puedes dejar un premovimiento.`;
    if (est.fase === "jugando" && r && !r.corre && est.movs.length < 2 && !(Date.now() < notaHasta)) pie += " El reloj empieza cuando cada uno haya hecho su primera jugada.";
    if (est.fase === "jugando" && est.medio >= 80) pie += ` Quedan ${Math.ceil((100 - est.medio) / 2)} jugadas para tablas por la regla de los cincuenta movimientos.`;
    set("ajPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
    tic();
  }

  /* ---------- el reloj ---------- */
  const queda = c => {
    const r = est && est.reloj;
    if (!r) return 0;
    return Math.max(0, r[c] - (r.corre === c ? Math.max(0, ahora() - r.desde) : 0));
  };
  function tic() {
    if (!host || !est || !est.reloj) return;
    const r = est.reloj, poco = Math.min(20000, Math.max(10000, r.base / 10));
    for (const el of host.querySelectorAll(".jg-aj-reloj")) {
      const c = el.getAttribute("data-c"), t = queda(c);
      const txt = formato(t);
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle("on", r.corre === c);
      el.classList.toggle("poco", t < poco && est.fase === "jugando");
    }
    if (est.fase !== "jugando" || !r.corre) return;
    const t = queda(r.corre);
    if (juego() && r.corre === miColor() && t < 10000 && !avisoPoco) { avisoPoco = true; suena("turno"); }
    /* La aguja cayó: se reclama. El reductor solo lo acepta si de verdad
       pasó el tiempo; si el reloj de este navegador iba adelantado, se
       vuelve a intentar en un momento. */
    if (t <= 0 && juego() && Date.now() - reclamado > 1500) {
      reclamado = Date.now();
      jugar({ t: "tiempo", uid, at: ahora() });
    }
  }

  /* ---------- jugar ---------- */
  async function envia(j) {
    if (enviando) return false;
    enviando = true;
    pinta();
    try { await jugar(Object.assign({ uid, at: ahora() }, j)); }
    finally {
      if (!muerto) {
        enviando = false;
        if (pre && meToca()) ejecutaPre();
        pinta();
      }
    }
    return true;
  }

  const mueve = (de, a, pr) => {
    propia = est.movs.length;
    envia(Object.assign({ t: "m", de: ajNombre(de), a: ajNombre(a) }, pr ? { pr } : {}));
  };

  /* El premovimiento sale en cuanto llega el turno, si es legal en la
     posición nueva; si no, se descarta y se dice. */
  function ejecutaPre() {
    if (!pre || !meToca() || enviando) return;
    const q = pre;
    pre = null;
    const m = (est.legales || []).find(x => x.de === q.de && x.a === q.a && (x.pr || "") === (q.pr || ""));
    if (m) mueve(m.de, m.a, m.pr);
    else avisa("El premovimiento ya no era legal y se anuló.");
  }

  function intenta(de, a) {
    const ms = destinos(de).filter(m => m.a === a);
    if (!ms.length) return false;
    sel = -1;
    const conPieza = ms.some(m => m.pr);
    if (!meToca()) {
      if (conPieza) corona = { de, a, pre: true };
      else pre = { de, a };
      pinta();
      return true;
    }
    if (conPieza) { corona = { de, a }; pinta(); return true; }
    mueve(de, a);
    pinta();
    return true;
  }

  function tocar(i) {
    if (!juego() || corona) return;
    if (sel >= 0 && i !== sel && intenta(sel, i)) return;
    const x = est.tab[i];
    const otra = x !== "." && ajColor(x) === miColor() && i !== sel && destinos(i).length;
    if (!otra && !meToca()) pre = null;          // tocar fuera anula el premovimiento
    sel = otra ? i : -1;
    pinta();
  }

  /* De un punto de la pantalla a la casilla que hay debajo. */
  function casillaEn(ev) {
    const svg = host && host.querySelector("#ajSvg");
    if (!svg) return -1;
    const r = svg.getBoundingClientRect();
    const cx = Math.floor((ev.clientX - r.left) / r.width * 8), cy = Math.floor((ev.clientY - r.top) / r.height * 8);
    if (cx < 0 || cx > 7 || cy < 0 || cy > 7) return -1;
    return abajo() === "w" ? cy * 8 + cx : (7 - cy) * 8 + (7 - cx);
  }

  function alClic(ev) {
    const b = ev.target.closest("[data-acc],[data-pr]");
    if (!b || !host.contains(b)) return;
    if (b.hasAttribute("data-pr")) {
      const pr = b.getAttribute("data-pr"), c = corona;
      corona = null;
      if (pr && c) {
        if (c.pre) { pre = { de: c.de, a: c.a, pr }; if (meToca()) ejecutaPre(); }
        else if (meToca()) mueve(c.de, c.a, pr);
      }
      pinta();
      return;
    }
    const acc = b.getAttribute("data-acc");
    if (acc === "girar") { girado = !girado; sel = -1; pinta(); return; }
    if (!juego()) return;
    if (acc === "tablas") envia({ t: "tablas" });
    else if (acc === "acepta") envia({ t: "acepta" });
    else if (acc === "rechaza") envia({ t: "rechaza" });
    else if (acc === "rinde") {
      if (Date.now() < rindeHasta) { rindeHasta = 0; envia({ t: "rinde" }); }
      else {
        rindeHasta = Date.now() + 3000;
        clearTimeout(rindeReloj);
        rindeReloj = setTimeout(() => { if (!muerto) pinta(); }, 3100);
        pinta();
      }
    }
  }

  function alMenu(ev) {
    if (!ev.target.closest("#ajSvg")) return;
    ev.preventDefault();
    if (pre || sel >= 0) { pre = null; sel = -1; soltarArrastre(); firmas.ajTab = ""; pinta(); }
  }

  function alCambiar(ev) {
    if (ev.target.id !== "ajPiezas") return;
    const j = ev.target.value;
    if (!JUEGOS_PIEZAS[j]) return;
    juegoPiezas = j;
    try { localStorage.setItem("jg.ajPiezas", j); } catch (e) { /* sin almacenamiento */ }
    precarga(j);
    pinta();
  }

  /* El arrastre. Se decide al soltar: si el puntero no se movió, fue un
     toque; si se movió, la pieza va a la casilla de debajo (jugada o
     premovimiento) o vuelve a la suya. Mientras tanto la pieza real se
     atenúa y una copia sigue al puntero. */
  function alPulsar(ev) {
    if (ev.button > 0 || !est || corona) return;
    if (!ev.target.closest("#ajSvg")) return;
    const i = casillaEn(ev);
    if (i < 0 || !juego()) return;
    ev.preventDefault();
    const x = est.tab[i];
    const propiaPieza = x !== "." && ajColor(x) === miColor() && destinos(i).length;
    if (!propiaPieza) { tocar(i); return; }
    arr = { de: i, x0: ev.clientX, y0: ev.clientY, mueve: false, era: sel, id: ev.pointerId, fant: null };
    if (sel !== i) { sel = i; pinta(); }
    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", soltarArrastre);
  }

  function alMover(ev) {
    if (!arr || ev.pointerId !== arr.id) return;
    if (!arr.mueve && Math.hypot(ev.clientX - arr.x0, ev.clientY - arr.y0) < 6) return;
    const svg = host && host.querySelector("#ajSvg");
    if (!svg) return;
    const r = svg.getBoundingClientRect(), k = 800 / r.width;
    const vx = (ev.clientX - r.left) * k - 50, vy = (ev.clientY - r.top) * k - 55;
    if (!arr.mueve) {
      arr.mueve = true;
      const g = svg.querySelector(`.jg-aj-pz[data-i="${arr.de}"]`);
      if (g) g.style.opacity = "0.25";
      arr.fant = document.createElementNS("http://www.w3.org/2000/svg", "g");
      arr.fant.setAttribute("class", "jg-aj-fant");
      arr.fant.innerHTML = piezaSvg(est.tab[arr.de]);
      svg.appendChild(arr.fant);
    }
    arr.fant.setAttribute("transform", `translate(${vx},${vy}) scale(1.1)`);
  }

  function alSoltar(ev) {
    if (!arr || ev.pointerId !== arr.id) return;
    const a = arr;
    soltarArrastre();
    const i = casillaEn(ev);
    if (!a.mueve) {
      /* Un toque sobre la pieza ya seleccionada la suelta. */
      if (a.era === a.de) { sel = -1; pinta(); }
      return;
    }
    firmas.ajTab = "";              // la copia y la opacidad tienen que irse
    if (i >= 0 && i !== a.de && intenta(a.de, i)) return;
    pinta();
  }

  function soltarArrastre() {
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerup", alSoltar);
    window.removeEventListener("pointercancel", soltarArrastre);
    if (arr && arr.fant) arr.fant.remove();
    arr = null;
  }

  /* Lo que suena: la madera al mover, un golpe al capturar, la campana
     del turno con un jaque. El mate lo pone la fanfarria del cartel. */
  function suenaJugada(m) {
    if (!m || m.mate) return;
    if (m.jaque) suena("turno");
    else if (m.cap) suena("martillo");
    else suena("madera");
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    const n = est.movs.length;
    if (vistos >= 0 && n > vistos) {
      const m = est.movs[n - 1];
      suenaJugada(m);
      /* Mi jugada ya la vi moverse; la suya se desliza. */
      if (n - 1 !== propia && !document.hidden) animar = { de: m.de, a: m.a };
      sel = -1;
      if (corona && !corona.pre) corona = null;
      if (est.reloj && est.reloj.corre === miColor() && queda(miColor()) >= 10000) avisoPoco = false;
    }
    vistos = n;
    if (!juego()) { sel = -1; corona = null; pre = null; }
    if (pre && meToca()) ejecutaPre();
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
