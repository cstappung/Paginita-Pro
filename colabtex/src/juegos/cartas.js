/* Cartas de los tres elementos — el duelo por rondas.
 *
 * Fuego quema la nieve, la nieve congela el agua, el agua apaga el fuego;
 * con el mismo elemento gana el número. Se ganan cartas y se gana la
 * partida con un trío: tres colores distintos y, o el mismo elemento, o
 * los tres. Es el CardJitsu del Club Penguin, que es donde esto se
 * aprendió.
 *
 * Dos decisiones que se ven raras hasta que se explican:
 *
 * 1. LAS DOS MANOS ESTÁN BOCA ARRIBA, a propósito. El mazo de cada uno
 *    sale de la semilla de la partida, que es pública, así que cualquiera
 *    con la consola del navegador abierta puede calcular el mazo del otro.
 *    Un secreto que se rompe con F12 no es un secreto: es una mentira que
 *    solo respeta quien no sabe mirar. Enseñando las dos manos el juego
 *    pasa a ser «adivina cuál de esas cinco va a echar», que con el
 *    compromiso de abajo es un juego mejor, no peor.
 *
 * 2. LO QUE VIAJA ES EL ÍNDICE, NUNCA LA CARTA. Primero se manda el hash
 *    del índice (compromiso) y solo cuando los dos han mandado el suyo se
 *    revela índice y sal. Así nadie elige después de ver, y como la carta
 *    se saca del mazo por su índice, tampoco puede revelarse una carta que
 *    no se tenía. Que el índice revelado sea el prometido lo comprueba
 *    `auditaCartas` en los dos navegadores.
 *
 * El repintado va por firmas: volver a escribir el innerHTML en cada tic
 * reiniciaría las animaciones CSS y las cartas parpadearían eternamente.
 */
import {
  ELEMENTOS, HEX_CARTA, MANO, cartaDe, salAleatoria, compromiso, auditaCartas
} from "./motor.js";

/* Lo que dura el choque en pantalla. Por debajo de dos segundos no da
   tiempo a leer quién ganó y por qué. */
const CHOQUE = 2600;

const clave = (pid, uid, ronda) => `jg.cartas.${pid}.${uid}.${ronda}`;

function guardaSecreto(pid, uid, ronda, s) {
  try { localStorage.setItem(clave(pid, uid, ronda), JSON.stringify(s)); } catch (e) {}
}
function leeSecreto(pid, uid, ronda) {
  try { return JSON.parse(localStorage.getItem(clave(pid, uid, ronda)) || "null"); }
  catch (e) { return null; }
}

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Una carta, con su elemento y su color de fondo como variables CSS: el
   diseño entero vive en la hoja de estilo y aquí solo se dicen los datos. */
function htmlCarta(carta, clases, attrs) {
  if (!carta) return `<div class="jg-carta jg-dorso ${clases || ""}"><span>✦</span></div>`;
  const el = ELEMENTOS[carta.e] || ELEMENTOS.fuego;
  return `<div ${attrs || ""} class="jg-carta ${clases || ""}" style="--el:${el.color};--elc:${el.claro};--col:${HEX_CARTA[carta.c] || "#888"}">
      <div class="jg-c-borde"></div>
      <div class="jg-c-icono">${el.icono}</div>
      <div class="jg-c-valor">${carta.v}</div>
      <div class="jg-c-pie">${esc(carta.c)}</div>
    </div>`;
}

export function crearCartas(ctx) {
  const { uid, pid, jugar, terminar, ahora } = ctx;

  let host = null, tic = null, muerto = false;
  let p = null, est = null;
  let elegida = null;          // índice señalado en la mano, aún sin comprometer
  let mandadaEn = -1;          // ronda cuya carta ya se echó desde esta pestaña
  let enviando = false;
  let vistas = 0;              // rondas que ya se han animado
  let tChoque = 0;
  let tramposos = [];
  let auditando = false;
  const firmas = {};           // región → última firma pintada

  /* ---------- estructura ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-cartas">
        <div class="jg-barra">
          <div class="jg-fase" id="caFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-ronda" id="caRonda"></div>
        </div>
        <div id="caTrampa"></div>
        <div class="jg-mesa">
          <div class="jg-lado">
            <div class="jg-quien" id="caQuienOtro"></div>
            <div class="jg-mano jg-mano-otro" id="caManoOtro"></div>
          </div>
          <div class="jg-duelo" id="caDuelo"></div>
          <div class="jg-lado">
            <div class="jg-mano" id="caManoYo"></div>
            <div class="jg-quien" id="caQuienYo"></div>
          </div>
        </div>
        <div class="jg-trofeos">
          <div class="jg-trofeo" id="caGanYo"></div>
          <div class="jg-trofeo" id="caGanOtro"></div>
        </div>
        <div class="jg-pie" id="caPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
    /* El choque se apaga solo: nadie va a mandar nada por la base de
       datos para avisar de que la animación terminó. */
    tic = setInterval(() => { if (!muerto) pinta(); }, 200);
  }

  function destruir() {
    muerto = true;
    if (tic) { clearInterval(tic); tic = null; }
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  /* ---------- quién es quién ---------- */
  const yo = () => (est ? est.jugadores.find(j => j.uid === uid) : null);
  const otro = () => (est ? est.jugadores.find(j => j.uid !== uid) : null);

  /* La mano son las primeras MANO cartas del mazo que aún no se han
     jugado: el mazo es infinito para lo que dura una partida y se roba
     por el orden en que está barajado. */
  function mano(j) {
    if (!j || !p) return [];
    const usadas = (est.usadas && est.usadas[j.uid]) || [];
    const m = [];
    for (let i = 0; m.length < MANO; i++) {
      const c = cartaDe(p.semilla, j.orden || 0, i);
      if (!c) break;
      if (usadas.indexOf(i) < 0) m.push({ i, carta: c });
    }
    return m;
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
    const y = yo(), o = otro();
    const enChoque = ahora() - tChoque < CHOQUE;
    /* Cuenta como echada en cuanto se pulsa, sin esperar a que la base
       devuelva el compromiso: si no, el segundo clic del impaciente
       guardaría otro índice sobre el secreto de la ronda y la auditoría
       —la propia, en la propia pantalla— lo cantaría como tramposo. */
    const yaMande = !!(est.comp && est.comp[uid]) || mandadaEn === est.ronda;

    /* barra */
    let fase = "";
    if (est.fase === "espera") fase = "Esperando a que entre alguien…";
    else if (est.fase === "fin") {
      if (est.motivo === "abandono") fase = est.ganador === uid ? "¡Ganas! El otro se fue." : "Abandonaste la partida.";
      else fase = est.ganador === uid ? "¡Trío! Ganas la partida." : "Trío del rival. Pierdes.";
    } else if (yaMande) fase = "Carta echada. Esperando al rival…";
    else fase = elegida === null ? "Elige una carta" : "Pulsa «Echar carta»";
    set("caFase", fase, esc(fase));
    set("caRonda", "r" + est.ronda, est.fase === "fin" ? "" : "Ronda " + (est.ronda + 1));

    /* aviso de compromiso roto */
    const firmaT = tramposos.map(t => t.uid + t.ronda).join(",");
    set("caTrampa", firmaT, tramposos.length
      ? `<div class="jg-trampa">La carta que reveló ${esc(nombre(tramposos[0].uid))} en la ronda
         ${tramposos[0].ronda + 1} no es la que había prometido. La partida ya no vale.</div>` : "");

    /* jugadores */
    set("caQuienYo", "y" + (y ? y.uid : ""), y ? etiqueta(y, true) : "");
    set("caQuienOtro", "o" + (o ? o.uid : ""), o ? etiqueta(o, false) : "");

    /* manos */
    const mY = mano(y), mO = mano(o);
    const puedo = est.fase === "jugando" && !yaMande && !enChoque;
    set("caManoYo",
      mY.map(x => x.i).join(",") + "|" + elegida + "|" + puedo,
      mY.map(x => htmlCarta(x.carta,
        "jg-jugable" + (x.i === elegida ? " jg-elegida" : "") + (puedo ? "" : " jg-quieta"),
        `data-i="${x.i}"`)).join(""));
    set("caManoOtro", mO.map(x => x.i).join(",") + "|" + yaMandeOtro(),
      mO.map(x => htmlCarta(x.carta, "jg-pequena")).join(""));

    pintaDuelo(y, o, enChoque);
    pintaTrofeos(y, o);
    pintaPie(mY, puedo);
  }

  const yaMandeOtro = () => { const o = otro(); return !!(o && est.comp && est.comp[o.uid]); };
  const nombre = u => {
    const j = est && est.jugadores.find(x => x.uid === u);
    return j ? j.nombre : "el rival";
  };

  function etiqueta(j, esMio) {
    const n = (est.ganadas && est.ganadas[j.uid] || []).length;
    return `<span class="jg-punto" style="background:${esc(j.color || "#888")}"></span>
      <b>${esc(esMio ? "Tú" : j.nombre)}</b>
      <span class="jg-cuenta">${n} carta${n === 1 ? "" : "s"} ganada${n === 1 ? "" : "s"}</span>`;
  }

  /* El centro enseña, por este orden: el choque recién resuelto mientras
     dura la animación, si no las cartas que ya estén reveladas, y si no
     el hueco con lo que falta por pasar. */
  function pintaDuelo(y, o, enChoque) {
    const ult = est.rondas[est.rondas.length - 1];
    let firma, html;
    if (enChoque && ult) {
      const cy = ult.cartas[uid], co = o ? ult.cartas[o.uid] : null;
      const res = ult.gana === uid ? "gana" : ult.gana === "" ? "empate" : "pierde";
      firma = "choque" + ult.n;
      html = `<div class="jg-choque jg-${res}">
          ${htmlCarta(co, "jg-vuela-arriba")}
          <div class="jg-veredicto">${res === "gana" ? "¡Te la llevas!" : res === "empate" ? "Empate" : "Se la lleva"}</div>
          ${htmlCarta(cy, "jg-vuela-abajo")}
        </div>`;
    } else if (est.fase === "fin") {
      firma = "fin" + est.ganador;
      html = `<div class="jg-remate ${est.ganador === uid ? "jg-gana" : "jg-pierde"}">
          <div class="jg-remate-t">${est.ganador === uid ? "🏆 Ganas" : "Pierdes"}</div>
          <div class="jg-remate-trio">${(est.trio || []).map(c => htmlCarta(c, "jg-pequena jg-brilla")).join("")}</div>
        </div>`;
    } else {
      const comp = est.comp || {};
      firma = "espera" + est.ronda + (comp[uid] ? "1" : "0") + (o && comp[o.uid] ? "1" : "0");
      html = `<div class="jg-espera">
          ${htmlCarta(null, (o && comp[o.uid]) ? "jg-lista" : "jg-tenue")}
          <div class="jg-vs">VS</div>
          ${htmlCarta(null, comp[uid] ? "jg-lista" : "jg-tenue")}
        </div>`;
    }
    set("caDuelo", firma, html);
  }

  /* Las cartas ganadas se agrupan por elemento porque el trío se busca
     mirando colores dentro de un elemento: amontonadas por orden de
     llegada hay que recorrerlas con el dedo. */
  function pintaTrofeos(y, o) {
    for (const [id, j, mio] of [["caGanYo", y, true], ["caGanOtro", o, false]]) {
      if (!j) { set(id, "-", ""); continue; }
      const g = (est.ganadas && est.ganadas[j.uid]) || [];
      const enTrio = est.ganador === j.uid && est.trio ? est.trio : [];
      const dentro = c => enTrio.some(t => t.e === c.e && t.c === c.c && t.v === c.v);
      const grupos = Object.keys(ELEMENTOS).map(e => {
        const cs = g.filter(c => c.e === e);
        if (!cs.length) return "";
        return `<div class="jg-grupo">${cs.map(c => htmlCarta(c, "jg-mini" + (dentro(c) ? " jg-brilla" : ""))).join("")}</div>`;
      }).join("");
      set(id, j.uid + "|" + g.map(c => c.e + c.c + c.v).join(",") + "|" + enTrio.length,
        `<div class="jg-trofeo-t">${esc(mio ? "Tus cartas" : "Cartas de " + j.nombre)}</div>
         <div class="jg-grupos">${grupos || '<span class="jg-nada">todavía ninguna</span>'}</div>`);
    }
  }

  function pintaPie(mY, puedo) {
    let firma, html;
    if (est.fase === "espera") { firma = "esp"; html = `<span class="jg-nota">Pásale el enlace de la sala a quien quieras y empezáis.</span>`; }
    else if (est.fase === "fin") { firma = "fin"; html = `<span class="jg-nota">Partida terminada.</span>`; }
    else if (est.comp && est.comp[uid]) { firma = "mandada"; html = `<span class="jg-nota">Tu carta está echada boca abajo. Se dan la vuelta cuando el rival eche la suya.</span>`; }
    else {
      firma = "elige" + elegida;
      const c = elegida !== null ? (mY.find(x => x.i === elegida) || {}).carta : null;
      html = `<button class="jg-btn" id="caEchar"${elegida === null || !puedo ? " disabled" : ""}>Echar carta</button>
        <span class="jg-nota">${c
          ? `${ELEMENTOS[c.e].icono} ${esc(c.e)} · ${esc(c.c)} · ${c.v} — el elemento manda, y a igual elemento manda el número.`
          : "Fuego quema la nieve · la nieve congela el agua · el agua apaga el fuego."}</span>`;
    }
    set("caPie", firma, html);
  }

  /* ---------- interacción ---------- */
  function alClic(ev) {
    /* Con la partida cerrada no se toca nada. El portón de
       `juegos-main.js` ya impide la escritura, pero sin esto la carta se
       seleccionaba y el pie invitaba a echarla: la pantalla decía que
       quedaba jugada donde no queda ninguna. */
    if (est && est.fase === "fin") return;
    const carta = ev.target.closest(".jg-carta.jg-jugable");
    if (carta && !carta.classList.contains("jg-quieta")) {
      elegida = Number(carta.getAttribute("data-i"));
      pinta();
      return;
    }
    if (ev.target.closest("#caEchar")) echar();
  }

  async function echar() {
    if (elegida === null || enviando || !est || est.fase !== "jugando") return;
    if (est.comp[uid] || mandadaEn === est.ronda) return;
    enviando = true;
    mandadaEn = est.ronda;
    try {
      const i = elegida, sal = salAleatoria();
      const h = await compromiso(i, sal);
      /* El secreto va al almacén antes que a la base: entre el
         compromiso y la revelación la única copia del índice está en
         esta pestaña, y recargar sin ella dejaría la ronda colgada. */
      guardaSecreto(pid, uid, est.ronda, { i, sal });
      await jugar({ t: "c", uid, h });
      elegida = null;
    } catch (e) {
      mandadaEn = -1;          // no llegó: que se pueda volver a intentar
      throw e;
    } finally { enviando = false; pinta(); }
  }

  /* Revelar no lo decide nadie: en cuanto los dos compromisos están en
     el registro, cada navegador destapa el suyo. */
  async function automatismos() {
    if (!est || est.fase !== "jugando" || enviando) return;
    const o = otro();
    if (!o || !est.comp[uid] || !est.comp[o.uid] || est.rev[uid]) return;
    const s = leeSecreto(pid, uid, est.ronda);
    if (!s) return;                       // lo tiene otra pestaña; que lo revele ella
    enviando = true;
    try { await jugar({ t: "r", uid, i: s.i, sal: s.sal }); }
    finally { enviando = false; }
  }

  /* La auditoría es aparte del reductor porque SHA-256 es asíncrono y el
     reductor corre en cada pintada. La hacen los dos navegadores, así que
     el tramposo sale nombrado en las dos pantallas. */
  async function audita() {
    if (auditando || !p || !est || !est.rondas.length) return;
    auditando = true;
    try {
      const malas = await auditaCartas(p, est);
      if (malas.length !== tramposos.length) { tramposos = malas; pinta(); }
    } catch (e) { /* una auditoría que falla no puede tumbar la partida */ }
    finally { auditando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (est.rondas.length > vistas) { vistas = est.rondas.length; tChoque = ahora(); elegida = null; }
    pinta();
    automatismos();
    audita();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
