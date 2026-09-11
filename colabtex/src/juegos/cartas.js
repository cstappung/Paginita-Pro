/* Cartas de los tres elementos — el duelo por rondas.
 *
 * Fuego quema la nieve, la nieve congela el agua, el agua apaga el fuego;
 * con el mismo elemento gana el número. Se ganan cartas y se gana la
 * partida con un trío: tres colores distintos y, o el mismo elemento, o
 * los tres. Es el CardJitsu del Club Penguin, que es donde esto se
 * aprendió.
 *
 * Tres decisiones que se ven raras hasta que se explican:
 *
 * 1. LA MANO DEL RIVAL NO SE PUEDE SABER, y eso costó cambiar el reparto
 *    entero. Pintarle un dorso encima no habría servido de nada: el mazo
 *    salía de la semilla de la partida, que es pública por fuerza, así
 *    que cualquiera con la consola del navegador abierta seguía pudiendo
 *    calcularlo — un secreto que se rompe con F12 no es un secreto, es
 *    una mentira que solo respeta quien no sabe mirar. Ahora cada jugador
 *    baraja con **su propia semilla**, guardada en
 *    `misPartidas/<uid>/<pid>/sec`, que las reglas solo dejan leer a su
 *    dueño. La mano del otro no está en ningún sitio al que se pueda
 *    llegar desde esta pestaña.
 *
 * 2. ENTONCES LA CARTA VIAJA ESCRITA, y hacen falta dos candados para que
 *    eso no sea una invitación a inventársela. El de la ronda: primero se
 *    manda el hash de `[i, e, c, v]` — la carta entera, no solo su sitio —
 *    y solo cuando los dos compromisos están puestos se revela carta y
 *    sal, así que nadie elige después de ver. El del mazo: al entrar se
 *    promete `hmazo` en la ficha (las reglas la dejan escribir una sola
 *    vez) y al acabar se revela la semilla, con la que el otro navegador
 *    rehace el mazo y comprueba que cada carta jugada estuviera de verdad
 *    donde dijo. Los dos los verifica `auditaCartas`, en las dos
 *    pantallas.
 *
 *    La frontera honesta: quien cierre la pestaña antes del final no
 *    revela su semilla y su mazo se queda sin auditar. No gana nada con
 *    ello — la victoria ya está escrita —, pero tampoco queda demostrado
 *    que jugara limpio.
 *
 * 3. LA CARTA ES UNA ILUSTRACIÓN, y el color va en el marco. Hay una
 *    imagen por elemento y valor (36 en total), pero el mazo son 216
 *    cartas porque cada una existe en seis colores, y el color decide el
 *    trío. Así que el dibujo dice elemento y número — que es lo que ya
 *    lleva pintado — y el marco, el anillo y la etiqueta dicen el color.
 *
 * El repintado va por firmas: volver a escribir el innerHTML en cada tic
 * reiniciaría las animaciones CSS y las cartas parpadearían eternamente.
 */
import {
  ELEMENTOS, HEX_CARTA, MANO, cartaDe, salAleatoria, compromiso, auditaCartas
} from "./motor.js";
import { suena } from "./sonido.js";

/* Lo que dura el choque en pantalla. Por debajo de dos segundos no da
   tiempo a leer quién ganó y por qué. */
const CHOQUE = 2600;

/* A partir de este valor la victoria de la ronda es un golpe: sale el
   estallido y suena distinto. Son las tres cartas altas de doce. */
const GOLPE = 10;

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

const dosCifras = v => (v < 10 ? "0" : "") + v;
const arteDe = c => `juegos/cartas/${c.e}/${c.e}_${dosCifras(c.v)}.png`;

/* Una carta: el dibujo, y el color de palo como variable CSS. El diseño
   entero vive en la hoja de estilo y aquí solo se dicen los datos. */
function htmlCarta(carta, clases, attrs) {
  if (!carta) return `<div class="jg-carta jg-dorso ${clases || ""}"><span>✦</span></div>`;
  const el = ELEMENTOS[carta.e] || ELEMENTOS.fuego;
  const alt = `${el.nombre} ${carta.v}, ${carta.c}`;
  return `<div ${attrs || ""} class="jg-carta jg-arte ${clases || ""}" title="${esc(alt)}"
      style="--el:${el.color};--elc:${el.claro};--col:${HEX_CARTA[carta.c] || "#888"}">
      <img class="jg-c-img" src="${arteDe(carta)}" alt="${esc(alt)}" draggable="false">
      <div class="jg-c-palo">${esc(carta.c)}</div>
    </div>`;
}

/* Las 36 imágenes, traídas de fondo y de una en una. Sin esto la
   primera carta de cada elemento y valor aparece en blanco justo en el
   choque, que dura dos segundos y medio y es lo único que se mira.
   Escalonadas para no pelear con la partida por el ancho de banda. */
let precargado = false;
function precarga() {
  if (precargado || typeof Image === "undefined") return;
  precargado = true;
  const lista = [];
  for (const e of Object.keys(ELEMENTOS))
    for (let v = 1; v <= 12; v++) lista.push(`juegos/cartas/${e}/${e}_${dosCifras(v)}.png`);
  let k = 0;
  const siguiente = () => {
    if (k >= lista.length) return;
    const im = new Image();
    im.onload = im.onerror = () => setTimeout(siguiente, 60);
    im.src = lista[k++];
  };
  setTimeout(siguiente, 1200);
}

export function crearCartas(ctx) {
  const { uid, pid, jugar, terminar, ahora, secreto } = ctx;

  let host = null, tic = null, muerto = false;
  let p = null, est = null;
  let elegida = null;          // índice señalado en la mano, aún sin comprometer
  let mandadaEn = -1;          // ronda cuya carta ya se echó desde esta pestaña
  let enviando = false;
  let vistas = 0;              // rondas que ya se han animado
  let tChoque = 0;
  let tramposos = [];
  let auditando = false;
  let sec = null;              // {sem, sal} — la semilla privada del mazo
  let secPedido = false;
  let cerrando = false;
  let sonoFin = false;
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
    precarga();
    pideSecreto();
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

  /* La semilla privada se pide una vez y se recuerda. Mientras no
     llegue no hay mano que pintar, que es un instante y se dice. */
  function pideSecreto() {
    if (secPedido || !secreto) return;
    secPedido = true;
    Promise.resolve()
      .then(() => secreto())
      .then(s => { if (!muerto) { sec = s || null; pinta(); } })
      .catch(() => { if (!muerto) pinta(); });
  }

  /* ---------- quién es quién ---------- */
  const yo = () => (est ? est.jugadores.find(j => j.uid === uid) : null);
  const otro = () => (est ? est.jugadores.find(j => j.uid !== uid) : null);

  /* De dónde sale *mi* mazo. Lo normal es la semilla privada; una sala
     abierta antes de que esto existiera no tiene ninguna guardada, y
     ahí se cae a la de la partida con el orden de siempre para no dejar
     esas partidas a medias. Su ficha tampoco lleva `hmazo`, así que la
     auditoría del mazo se salta sola. */
  function siembra() {
    if (sec && sec.sem != null) return { sem: sec.sem >>> 0, orden: 0 };
    const y = yo();
    if (!p || p.semilla == null || !y) return null;
    return { sem: p.semilla >>> 0, orden: y.orden || 0 };
  }

  /* Mi mano: las primeras MANO cartas del mazo que aún no he jugado.
     El mazo son 216 cartas y una partida no pasa de unas pocas rondas,
     así que nunca se acaba. */
  function miMano() {
    const s = siembra();
    if (!s || !est) return [];
    const usadas = (est.usadas && est.usadas[uid]) || [];
    const m = [];
    for (let i = 0; m.length < MANO; i++) {
      const c = cartaDe(s.sem, s.orden, i);
      if (!c) break;
      if (usadas.indexOf(i) < 0) m.push({ i, carta: c });
    }
    return m;
  }

  const cartaEn = i => {
    const s = siembra();
    return s ? cartaDe(s.sem, s.orden, i) : null;
  };

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
       guardaría otra carta sobre el secreto de la ronda y la auditoría
       —la propia, en la propia pantalla— lo cantaría como tramposo. */
    const yaMande = !!(est.comp && est.comp[uid]) || mandadaEn === est.ronda;
    const mY = miMano();

    /* barra */
    let fase = "";
    if (est.fase === "espera") fase = "Esperando a que entre alguien…";
    else if (est.fase === "fin") {
      if (est.motivo === "abandono") fase = est.ganador === uid ? "¡Ganas! El otro se fue." : "Abandonaste la partida.";
      else fase = est.ganador === uid ? "¡Trío! Ganas la partida." : "Trío del rival. Pierdes.";
    } else if (!mY.length) fase = "Repartiendo tu mazo…";
    else if (yaMande) fase = "Carta echada. Esperando al rival…";
    else fase = elegida === null ? "Elige una carta" : "Pulsa «Echar carta»";
    set("caFase", fase, esc(fase));
    set("caRonda", "r" + est.ronda, est.fase === "fin" ? "" : "Ronda " + (est.ronda + 1));

    /* aviso de compromiso roto */
    set("caTrampa", tramposos.map(t => t.uid + ":" + t.que + t.ronda).join(","), avisoTrampa());

    /* jugadores */
    set("caQuienYo", "y" + (y ? y.uid : ""), y ? etiqueta(y, true) : "");
    set("caQuienOtro", "o" + (o ? o.uid : ""), o ? etiqueta(o, false) : "");

    /* manos. La del rival son dorsos y nada más: sus cartas no están
       en esta máquina ni se pueden calcular desde aquí. */
    const puedo = est.fase === "jugando" && !yaMande && !enChoque && mY.length > 0;
    set("caManoYo",
      mY.map(x => x.i + ":" + x.carta.e + x.carta.c + x.carta.v).join(",") + "|" + elegida + "|" + puedo,
      mY.length
        ? mY.map(x => htmlCarta(x.carta,
            "jg-jugable" + (x.i === elegida ? " jg-elegida" : "") + (puedo ? "" : " jg-quieta"),
            `data-i="${x.i}"`)).join("")
        : Array.from({ length: MANO }, () => htmlCarta(null, "jg-tenue")).join(""));
    const otroMando = yaMandeOtro();
    set("caManoOtro", "dorsos|" + otroMando,
      Array.from({ length: otroMando ? MANO - 1 : MANO },
        () => htmlCarta(null, "jg-pequena")).join(""));

    pintaDuelo(y, o, enChoque);
    pintaTrofeos(y, o);
    pintaPie(mY, puedo);
  }

  const yaMandeOtro = () => { const o = otro(); return !!(o && est.comp && est.comp[o.uid]); };
  const nombre = u => {
    const j = est && est.jugadores.find(x => x.uid === u);
    return j ? j.nombre : "el rival";
  };

  /* Los dos candados fallan por motivos distintos y se cuentan
     distinto: uno es «esa no es la carta que prometías esta ronda» y el
     otro «ese mazo no es el que prometías al empezar». Un fallo de mazo
     no tiene ronda (`ronda: -1`), y darle una diría «en la ronda 0». */
  function avisoTrampa() {
    if (!tramposos.length) return "";
    const t = tramposos[0];
    const quien = esc(nombre(t.uid));
    return `<div class="jg-trampa">${t.que === "mazo"
      ? `El mazo que reveló ${quien} al acabar no es el que había prometido al entrar.`
      : `La carta que reveló ${quien} en la ronda ${t.ronda + 1} no es la que había prometido.`
      } La partida ya no vale.</div>`;
  }

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
      /* La carta que se lleva la ronda; con un 10, 11 o 12 el choque
         estalla en el color de su elemento. El empate no tiene carta
         ganadora y saca humo, que es lo que queda cuando chocan dos
         que no se pueden. */
      const cg = ult.gana === uid ? cy : ult.gana === "" ? null : co;
      const golpe = !!(cg && cg.v >= GOLPE);
      firma = "choque" + ult.n;
      html = `<div class="jg-choque jg-${res}${golpe ? " jg-golpea" : ""}">
          ${golpe ? efectoGolpe(cg) : ""}
          ${res === "empate" ? efectoHumo() : ""}
          ${htmlCarta(co, "jg-vuela-arriba")}
          <div class="jg-veredicto">${res === "gana" ? "¡Te la llevas!" : res === "empate" ? "Empate" : "Se la lleva"}${
            golpe ? `<span class="jg-golpe-t">¡${cg.v}!</span>` : ""}</div>
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

  /* Los rayos y las volutas se escriben aquí y no en la hoja de estilo
     porque cada uno lleva su ángulo y su retardo: doce reglas CSS
     escritas a mano para lo mismo se desincronizan en cuanto se toca
     una. El color sale del elemento de la carta que golpea. */
  function efectoGolpe(c) {
    const el = ELEMENTOS[c.e] || ELEMENTOS.fuego;
    const rayos = Array.from({ length: 12 }, (_, k) =>
      `<i style="--a:${k * 30}deg;--r:${k % 2 ? 0.72 : 1}"></i>`).join("");
    return `<div class="jg-estallido" style="--el:${el.color};--elc:${el.claro}">
        <div class="jg-onda"></div><div class="jg-rayos">${rayos}</div>
      </div>`;
  }

  function efectoHumo() {
    const puffs = Array.from({ length: 7 }, (_, k) =>
      `<i style="--x:${(k - 3) * 17}px;--d:${k * 90}ms;--s:${0.7 + (k % 3) * 0.25}"></i>`).join("");
    return `<div class="jg-humo">${puffs}</div>`;
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
      firma = "elige" + elegida + "|" + mY.length;
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
      suena("clic");
      pinta();
      return;
    }
    if (ev.target.closest("#caEchar")) echar();
  }

  async function echar() {
    if (elegida === null || enviando || !est || est.fase !== "jugando") return;
    if (est.comp[uid] || mandadaEn === est.ronda) return;
    const i = elegida, c = cartaEn(i);
    if (!c) return;
    enviando = true;
    mandadaEn = est.ronda;
    try {
      const sal = salAleatoria();
      /* El compromiso es sobre la carta entera, no sobre su índice: el
         mazo es privado, así que el índice por sí solo no dice qué
         carta es y comprometerse a él no compromete a nada. Es un
         array y no un objeto porque así su JSON es el mismo en las dos
         máquinas, sin depender del orden de las claves. */
      const h = await compromiso([i, c.e, c.c, c.v], sal);
      /* El secreto va al almacén antes que a la base: entre el
         compromiso y la revelación la única copia está en esta
         pestaña, y recargar sin ella dejaría la ronda colgada. */
      guardaSecreto(pid, uid, est.ronda, { i, sal, e: c.e, c: c.c, v: c.v });
      await jugar({ t: "c", uid, h });
      elegida = null;
      suena("carta");
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
    try { await jugar({ t: "r", uid, i: s.i, sal: s.sal, e: s.e, c: s.c, v: s.v }); }
    finally { enviando = false; }
  }

  /* Al acabar, la semilla del mazo. Va **antes** que `terminar` a
     propósito: la regla de la base rechaza cualquier jugada en cuanto
     `fin` existe, así que revelarla después es revelarla nunca. */
  async function cierre() {
    if (cerrando) return;
    cerrando = true;
    const s = sec;
    if (s && est && !(est.semillas || {})[uid]) {
      try { await jugar({ t: "s", uid, sem: s.sem, sal: s.sal }); } catch (e) {}
    }
    terminar(est.ganador, est.motivo);
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

  /* El sonido de una ronda lo decide la carta que la gana: con un 10,
     11 o 12 es un golpe, y el empate es el siseo del humo. */
  function suenaRonda(ult) {
    if (!ult) return;
    const cg = ult.gana === uid ? ult.cartas[uid]
      : ult.gana === "" ? null
      : ult.cartas[ult.gana];
    if (ult.gana === "") suena("empate");
    else if (cg && cg.v >= GOLPE) suena("golpe");
    else suena(ult.gana === uid ? "gana" : "pierde");
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    pideSecreto();
    if (est.rondas.length > vistas) {
      vistas = est.rondas.length; tChoque = ahora(); elegida = null;
      suenaRonda(est.rondas[est.rondas.length - 1]);
    }
    if (est.fase === "fin" && !sonoFin) {
      sonoFin = true;
      setTimeout(() => suena(est.ganador === uid ? "victoria" : "derrota"), 500);
    }
    pinta();
    automatismos();
    audita();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) cierre();
  }

  return { montar, actualizar, destruir };
}
