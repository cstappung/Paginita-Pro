/* Ajedrez — el de siempre, entre dos y por turnos.
 *
 * Las reglas viven en `motor.js` (`redAjedrez`); esta pantalla solo
 * pinta la posición que sale de repasar el registro y manda jugadas que
 * el reductor ya sabe que son legales, porque las saca de `est.legales`.
 *
 * Decisiones de la pantalla:
 *
 * - **Las piezas se dibujan, no se escriben.** Los caracteres ♚♛♜ son
 *   emoji en algunos móviles (el peón negro sale de color en iOS) y cada
 *   sistema los pinta de un tamaño; como trazos SVG son iguales en todas
 *   partes y se pueden teñir.
 * - **Se mueve con dos toques o arrastrando**, las dos cosas sobre el
 *   mismo estado `sel`. Tocar una pieza propia marca a dónde puede ir
 *   (punto en vacío, aro en captura); tocar el destino juega. Arrastrar
 *   es lo mismo con la pieza pegada al dedo.
 * - **Tu color va abajo.** Quien mira ve las blancas abajo; ⇅ gira el
 *   tablero para cualquiera.
 * - **La coronación pregunta.** Un peón que llega a la última fila abre
 *   un selector con las cuatro piezas; el reductor rechaza una
 *   coronación sin pieza elegida, así que no hay «dama por defecto».
 * - **La pieza que movió el otro se desliza** desde su casilla de
 *   origen. La animación va en un `<g>` interior: un `transform` de CSS
 *   reemplaza al atributo `transform`, y si fuera el mismo grupo la
 *   pieza saltaría a la esquina del tablero.
 */
import { ajNombre, ajColor } from "./motor.js";
import { suena } from "./sonido.js";

const S = 100;

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- las piezas ----------
   Cada una en una caja de 100×100 con la base en y = 86. `d` son los
   detalles: trazos sin relleno en el color contrario. */
const BASE = '<path d="M24 86V82a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v4z"/>';
const FORMAS = {
  P: '<circle cx="50" cy="30" r="11"/><path d="M41 41h18l-3 6c6 4 10 14 12 31H32c2-17 6-27 12-31z"/>' + BASE,
  R: '<path d="M30 18h8v7h6v-7h12v7h6v-7h8v15l-6 5v34H36V38l-6-5z"/>' + BASE + '<path class="d" d="M36 38h28M36 72h28"/>',
  B: '<circle cx="50" cy="15" r="5"/><path d="M50 20c-12 9-14 21-10 30h20c4-9 2-21-10-30z"/><path d="M38 50h24l2 6H36z"/><path d="M38 56c-2 10-4 16-6 22h36c-2-6-4-12-6-22z"/>' + BASE + '<path class="d" d="M55 29l-9 11"/>',
  N: '<path d="M34 78c0-12 5-18 12-24-6 0-11 4-17 4-6-2-7-8-3-12 6-6 12-12 14-20l-2-10c6 2 10 6 12 8 13 0 22 12 22 30 0 10-2 18-4 24z"/>' + BASE + '<circle class="d" cx="42" cy="33" r="2.4"/><path class="d" d="M57 34c4 6 5 14 4 22"/>',
  Q: '<circle cx="23" cy="27" r="5"/><circle cx="36" cy="19" r="5"/><circle cx="50" cy="14" r="5"/><circle cx="64" cy="19" r="5"/><circle cx="77" cy="27" r="5"/>' +
     '<path d="M24 31l9 29h34l9-29-14 15 1-22-9 19-4-23-4 23-9-19 1 22z"/><path d="M33 60h34l3 18H30z"/>' + BASE + '<path class="d" d="M34 66h32"/>',
  K: '<path d="M47 7h6v6h6v6h-6v8h-6v-8h-6v-6h6z"/><path d="M50 30c-10-4-24 0-22 14 2 8 8 12 8 16h28c0-4 6-8 8-16 2-14-12-18-22-14z"/><path d="M36 60h28l4 18H32z"/>' + BASE + '<path class="d" d="M36 66h28M50 31v28"/>'
};
const TINTE = {
  w: { fill: "#fbf7ee", stroke: "#1e1d22", d: "#1e1d22" },
  b: { fill: "#2a2a30", stroke: "#0b0b0e", d: "#d8d2c4" }
};
export function piezaSvg(x) {
  const c = ajColor(x), t = TINTE[c], f = FORMAS[x.toUpperCase()];
  return `<g transform="translate(5 7) scale(.9)" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">` +
    f.replace(/class="d"/g, `fill="none" stroke="${t.d}"`) + "</g>";
}
const mini = x => `<svg class="jg-aj-mini" viewBox="10 4 80 86" aria-hidden="true">${piezaSvg(x)}</svg>`;

const CLARA = "#eed9b4", OSCURA = "#b58863";
const NOMBRE_PIEZA = { q: "Dama", r: "Torre", b: "Alfil", n: "Caballo" };
const MOTIVO = {
  mate: "Jaque mate.", ahogado: "Tablas por rey ahogado.", material: "Tablas: no queda material para dar mate.",
  repeticion: "Tablas por triple repetición.", cincuenta: "Tablas por la regla de los cincuenta movimientos.",
  acuerdo: "Tablas de mutuo acuerdo.", rendicion: "Abandono: se rindió.", abandono: "Partida abandonada."
};

export function crearAjedrez(ctx) {
  const { uid, jugar, terminar } = ctx;
  const mirando = !!ctx.mirando;

  let host = null, muerto = false;
  let p = null, est = null;
  let sel = -1;                 // casilla seleccionada
  let corona = null;            // {de, a} mientras se elige pieza
  let girado = false;           // ⇅ a mano
  let enviando = false;
  let vistos = -1;              // movimientos vistos la última vez
  let animar = null;            // {de, a} que se desliza en la próxima pintada
  let propia = -1;              // índice de la jugada mía que no hay que animar
  let rindeHasta = 0, rindeReloj = 0;
  let arr = null;               // arrastre en curso
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
            <div class="jg-aj-hoja"><div class="jg-aj-hoja-t">Jugadas</div><ol class="jg-aj-movs" id="ajMovs"></ol></div>
          </div>
        </div>
        <div class="jg-pie" id="ajPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
    host.addEventListener("pointerdown", alPulsar);
  }

  function destruir() {
    muerto = true;
    clearTimeout(rindeReloj);
    soltarArrastre();
    if (host) {
      host.removeEventListener("click", alClic);
      host.removeEventListener("pointerdown", alPulsar);
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

  function set(id, firma, html) {
    if (firmas[id] === firma) return false;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
    return true;
  }

  /* Casilla → posición en pantalla según quién va abajo. */
  const pos = i => abajo() === "w" ? { x: (i & 7) * S, y: (i >> 3) * S } : { x: (7 - (i & 7)) * S, y: (7 - (i >> 3)) * S };
  const destinos = de => (est.legales || []).filter(m => m.de === de);

  /* ---------- el tablero ---------- */
  function tablero() {
    const out = [`<svg viewBox="0 0 800 800" class="jg-svg jg-aj-svg" id="ajSvg" role="img" aria-label="Tablero de ajedrez">`];
    const ult = est.ultima;
    const reyEnJaque = est.jaque ? est.tab.indexOf(est.color === "w" ? "K" : "k") : -1;
    for (let i = 0; i < 64; i++) {
      const { x, y } = pos(i), clara = ((i >> 3) + (i & 7)) % 2 === 0;
      out.push(`<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${clara ? CLARA : OSCURA}"/>`);
      if (ult && (i === ult.de || i === ult.a)) out.push(`<rect class="jg-aj-ult" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      if (i === sel) out.push(`<rect class="jg-aj-sel" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      if (i === reyEnJaque) out.push(`<circle class="jg-aj-jaque" cx="${x + 50}" cy="${y + 50}" r="50"/>`);
    }
    /* Coordenadas dentro del tablero, como en los tableros de madera:
       las filas en la columna de la izquierda, las letras en la fila de
       abajo, del color de la casilla contraria para que se lean. */
    for (let k = 0; k < 8; k++) {
      const iz = abajo() === "w" ? k * 8 : (7 - k) * 8 + 7;
      const fil = ajNombre(iz)[1], cl = ((iz >> 3) + (iz & 7)) % 2 === 0;
      out.push(`<text class="jg-aj-coord" x="5" y="${k * S + 20}" fill="${cl ? OSCURA : CLARA}">${fil}</text>`);
      const ab = abajo() === "w" ? 56 + k : 7 - k;
      const col = ajNombre(ab)[0], cl2 = ((ab >> 3) + (ab & 7)) % 2 === 0;
      out.push(`<text class="jg-aj-coord" x="${k * S + 94}" y="795" text-anchor="end" fill="${cl2 ? OSCURA : CLARA}">${col}</text>`);
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
      const { x, y } = pos(m.a);
      out.push(m.cap
        ? `<circle class="jg-aj-cap" cx="${x + 50}" cy="${y + 50}" r="44"/>`
        : `<circle class="jg-aj-punto" cx="${x + 50}" cy="${y + 50}" r="15"/>`);
    }
    out.push("</svg>");
    if (corona) {
      const c = miColor();
      out.push(`<div class="jg-aj-corona" role="dialog" aria-label="Elige la pieza de la coronación">
        <div>Coronar en ${ajNombre(corona.a)}</div>
        <div class="jg-aj-corona-ops">${"qrbn".split("").map(t =>
          `<button class="jg-aj-op" data-pr="${t}" title="${NOMBRE_PIEZA[t]}"><svg viewBox="10 4 80 86">${piezaSvg(c === "w" ? t.toUpperCase() : t)}</svg></button>`).join("")}</div>
        <button class="btn2 jg-aj-op-no" data-pr="">Cancelar</button>
      </div>`);
    }
    return out.join("");
  }

  /* La placa de un jugador: nombre, bando, lo que lleva capturado y la
     ventaja de material, que es lo que se mira para saber cómo va. */
  function placa(color) {
    const u = color === "w" ? est.blancas : est.negras;
    const j = jugadorDe(u);
    if (!j) return { firma: "-", html: `<span class="jg-nota">Esperando rival…</span>` };
    const lleva = (est.perdidas || { w: [], b: [] })[color === "w" ? "b" : "w"];
    const ventaja = (est.material[color] || 0) - (est.material[color === "w" ? "b" : "w"] || 0);
    const turno = est.fase === "jugando" && est.turno === u;
    const foto = j.foto ? `<img src="${esc(j.foto)}" alt="">` : esc((j.nombre || "?").slice(0, 1).toUpperCase());
    const html = `<span class="jg-aj-av" style="--c:${esc(j.color || "#888")}">${foto}</span>
      <span class="jg-aj-quien"><b>${esc(u === uid ? "Tú" : j.nombre)}</b>
        <span class="jg-aj-caps">${lleva.map(t => mini(color === "w" ? t.toLowerCase() : t)).join("")}${ventaja > 0 ? `<em>+${ventaja}</em>` : ""}</span></span>
      <span class="jg-grow"></span>
      <span class="jg-aj-bando ${color}${turno ? " on" : ""}">${turno ? (u === uid ? "Te toca · " : "Le toca · ") : ""}${color === "w" ? "Blancas" : "Negras"}</span>`;
    return { firma: [u, j.nombre, j.foto, j.color, lleva.join(""), ventaja, turno].join("|"), html };
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
      else if (est.ganador === uid) fase = "🏆 Ganas. " + m;
      else if (miColor() && !mirando) fase = "Pierdes. " + m;
      else fase = `Gana ${nombreDe(est.ganador)}. ${m}`;
    } else if (meToca()) fase = est.jaque ? "¡Jaque! Te toca salir de él" : "Te toca mover";
    else fase = `Le toca a ${nombreDe(est.turno)}` + (est.jaque ? " (en jaque)" : "");
    const punto = est.fase === "jugando" ? (est.color === "w" ? "#fbf7ee" : "#2a2a30") : "#8a97a3";
    set("ajFase", fase + punto, `<span class="jg-punto-t jg-aj-punto-t" style="background:${punto}"></span>${esc(fase)}`);

    const ab = abajo(), ar = ab === "w" ? "b" : "w";
    const pa = placa(ar), pb = placa(ab);
    set("ajArriba", pa.firma, pa.html);
    set("ajAbajo", pb.firma, pb.html);

    const firmaTab = [est.tab.join(""), sel, est.ultima ? est.ultima.de + "-" + est.ultima.a : "", est.jaque, ab,
      est.turno, est.fase, corona ? corona.de + "-" + corona.a : "", juego()].join("|");
    if (set("ajTab", firmaTab, tablero())) animar = null;

    if (set("ajMovs", String(est.movs.length), hoja())) {
      const ol = host.querySelector("#ajMovs");
      if (ol) ol.scrollTop = ol.scrollHeight;
    }

    let oferta = "";
    if (est.oferta && juego()) oferta = est.oferta === uid
      ? `<div class="jg-aj-aviso">Has ofrecido tablas. Si ${esc(nombreDe(est.turno === uid ? (uid === est.blancas ? est.negras : est.blancas) : est.turno))} mueve, la rechaza.</div>`
      : `<div class="jg-aj-aviso on"><b>${esc(nombreDe(est.oferta))} ofrece tablas.</b>
          <span><button class="btn" data-acc="acepta">Aceptar</button><button class="btn2" data-acc="rechaza">Rechazar</button></span></div>`;
    else if (est.oferta) oferta = `<div class="jg-aj-aviso">${esc(nombreDe(est.oferta))} ha ofrecido tablas.</div>`;
    set("ajOferta", est.oferta + "|" + juego(), oferta);

    set("ajBtns", [juego(), est.oferta, (est.ofrecio || {})[uid], est.movs.length, enviando, Date.now() < rindeHasta].join("|"), botones());

    let pie;
    if (est.fase === "espera") pie = "Pásale el enlace de la sala a quien quieras y empezáis.";
    else if (est.fase === "fin") pie = `Partida terminada en ${Math.ceil(est.movs.length / 2)} jugadas.`;
    else if (mirando || !miColor()) pie = "Estás mirando la partida.";
    else if (meToca()) pie = sel >= 0 ? "Toca la casilla de destino, o arrastra la pieza." : "Toca una pieza tuya para ver a dónde puede ir, o arrástrala.";
    else pie = `Juegas con ${miColor() === "w" ? "blancas" : "negras"}. Espera la jugada de ${nombreDe(est.turno)}.`;
    if (est.fase === "jugando" && est.medio >= 80) pie += ` Quedan ${Math.ceil((100 - est.medio) / 2)} jugadas para tablas por la regla de los cincuenta movimientos.`;
    set("ajPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
  }

  /* ---------- jugar ---------- */
  async function envia(j) {
    if (enviando) return;
    enviando = true;
    pinta();
    try { await jugar(Object.assign({ uid }, j)); }
    finally { if (!muerto) { enviando = false; pinta(); } }
  }

  function intenta(de, a) {
    const ms = destinos(de).filter(m => m.a === a);
    if (!ms.length) return false;
    sel = -1;
    if (ms.some(m => m.pr)) { corona = { de, a }; pinta(); return true; }
    propia = est.movs.length;
    envia({ t: "m", de: ajNombre(de), a: ajNombre(a) });
    pinta();
    return true;
  }

  function tocar(i) {
    if (!meToca() || corona) return;
    if (sel >= 0 && i !== sel && intenta(sel, i)) return;
    const x = est.tab[i];
    sel = (x !== "." && ajColor(x) === miColor() && i !== sel && destinos(i).length) ? i : -1;
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
    if (b && host.contains(b)) {
      if (b.hasAttribute("data-pr")) {
        const pr = b.getAttribute("data-pr"), c = corona;
        corona = null;
        if (pr && c) { propia = est.movs.length; envia({ t: "m", de: ajNombre(c.de), a: ajNombre(c.a), pr }); }
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
  }

  /* El arrastre. Se decide al soltar: si el puntero no se movió, fue
     un toque (lo que haría el clic); si se movió, la pieza va a la
     casilla de debajo o vuelve a la suya. Mientras tanto la pieza real
     se esconde y una copia sigue al puntero. */
  function alPulsar(ev) {
    if (ev.button > 0 || !est || corona) return;
    if (!ev.target.closest("#ajSvg")) return;
    const i = casillaEn(ev);
    if (i < 0 || !meToca()) return;
    ev.preventDefault();
    const x = est.tab[i];
    const propiaPieza = x !== "." && ajColor(x) === miColor() && destinos(i).length;
    if (!propiaPieza) { tocar(i); return; }
    const svg = host.querySelector("#ajSvg");
    arr = { de: i, x0: ev.clientX, y0: ev.clientY, mueve: false, era: sel, id: ev.pointerId, svg, fant: null };
    if (sel !== i) { sel = i; pinta(); arr.svg = host.querySelector("#ajSvg"); }
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
    arr.fant.setAttribute("transform", `translate(${vx},${vy}) scale(1.08)`);
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
      /* Mi jugada ya la vi moverse con el dedo; la suya se desliza. */
      if (n - 1 !== propia && !document.hidden) animar = { de: m.de, a: m.a };
      sel = -1; corona = null;
    }
    vistos = n;
    if (!meToca()) { sel = -1; corona = null; }
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
