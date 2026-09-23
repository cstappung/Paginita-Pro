/* Reacción en cadena — Chain Reaction, de dos a seis jugadores.
 *
 * Cada uno pone por turno un orbe en una celda vacía o en una suya.
 * Cuando una celda junta tantos orbes como vecinas tiene (dos en la
 * esquina, tres en el borde, cuatro en el centro) estalla: reparte un
 * orbe a cada vecina y se las queda, y si alguna de ellas llega a su vez
 * a su masa crítica, estalla también. Gana quien deja a los demás sin
 * un solo orbe.
 *
 * Las reglas viven en `motor.js` (`redCadena`); esta pantalla solo las
 * cuenta. Cuatro decisiones:
 *
 * - **La jugada se vuelve a representar onda a onda.** El reductor deja
 *   en `ultima` el tablero de antes y la lista de ondas, y aquí se
 *   repasan con el mismo `crOnda` que usó el motor: no hay una segunda
 *   física que pueda discrepar, solo la misma aritmética enseñada
 *   despacio. Cada onda dura menos que la anterior, así que una cadena
 *   larga acelera en vez de hacerse eterna, y a partir de `MAX_ONDAS`
 *   (o con la pestaña escondida, donde los temporizadores se duermen) se
 *   salta al tablero final.
 * - **El color es el del asiento, no el del jugador.** `colorForUid`
 *   puede dar dos tonos casi iguales, y aquí todo el juego es ver de un
 *   vistazo de quién es cada celda. Seis colores de neón fijos, uno por
 *   puesto, y el color propio de cada uno sigue en el borde del marcador.
 * - **Un orbe es cuatro grupos anidados** (posición → aparece → tiembla
 *   → gira), porque una animación CSS de `transform` pisa el atributo
 *   `transform` del mismo elemento: con uno solo, el orbe que gira
 *   saltaría a la esquina del tablero.
 * - **La pantalla dice cuándo ha terminado de contar** (`ocupado()` y
 *   `ctx.listo`): la jugada que gana la partida es la cadena más larga
 *   de todas, y tapar su animación con el cartel de victoria sería
 *   enseñar el final antes que la jugada.
 */
import { crCritica, crVecinas, crOnda, crCuenta } from "./motor.js";
import { suena } from "./sonido.js";

const S = 100;          // lado de la celda, en unidades del viewBox
const M = 12;           // margen
const R = 17;           // radio de un orbe
const MAX_ONDAS = 60;   // a partir de aquí se salta al final
const MAX_CHISPAS = 260;

const PALETA = ["#ff3d7f", "#27c8ff", "#ffc53d", "#5dff8a", "#b36bff", "#ff7a2e"];
const GRIS = "#8a97a3";

/* Dónde va cada orbe dentro de la celda según cuántos hay. Pasado el
   cuatro (solo lo alcanza una celda cargada en mitad de una cadena) se
   pintan cuatro y el número. */
const POS = [[], [[0, 0]], [[-13, 0], [13, 0]], [[-13, 9], [13, 9], [0, -14]],
  [[-13, -13], [13, -13], [-13, 13], [13, 13]]];

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Oscurece un #rrggbb multiplicando cada canal: el borde del orbe. */
function oscuro(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}
/* Y lo aclara mezclando con blanco: el núcleo del destello. */
function claro(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const m = v => Math.round(v + (255 - v) * k);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

export function crearCadena(ctx) {
  const { uid, jugar, terminar } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let enviando = false, animando = false;
  let vistos = -1;            // cuántas jugadas llevaba el tablero la última vez
  let gen = 0;                // cada animación nueva deja obsoletas las anteriores
  let malla = "";             // filas×cols con que se construyó el SVG
  let claves = [];            // lo que pinta cada celda ahora mismo ("u:n")
  let mostrado = null;        // el tablero que se está enseñando (a mitad de cadena, uno intermedio)
  let raf = 0, tComb = 0, tAviso = 0;
  const timers = new Set();
  const firmas = {};

  /* ---------- montaje ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-cr">
        <div class="jg-barra">
          <div class="jg-fase" id="crFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-marcador" id="crMarcador"></div>
        </div>
        <div class="jg-tablero">
          <div class="jg-cr-marco" id="crMarco">
            <div class="jg-cr-lienzo" id="crLienzo"></div>
            <div class="jg-cr-combo" id="crCombo"></div>
            <div class="jg-cr-aviso" id="crAviso"></div>
          </div>
        </div>
        <div class="jg-pie" id="crPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
  }

  function destruir() {
    muerto = true; gen++;
    corta();
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function corta() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
    if (raf) cancelAnimationFrame(raf);
    raf = 0; animando = false;
    const fx = q(".jg-cr-fx");
    if (fx) fx.innerHTML = "";
  }

  const q = s => host && host.querySelector(s);
  const espera = ms => new Promise(res => {
    const t = setTimeout(() => { timers.delete(t); res(); }, ms);
    timers.add(t);
  });

  /* ---------- quién es quién ---------- */
  const jugadorDe = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return j ? j.nombre : "alguien"; };
  const asiento = u => (est ? est.jugadores.findIndex(x => x.uid === u) : -1);
  const colorDe = u => { const k = asiento(u); return k >= 0 ? PALETA[k % PALETA.length] : GRIS; };
  const gradDe = u => { const k = asiento(u); return k >= 0 ? `url(#crg${k % PALETA.length})` : GRIS; };

  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = q("#" + id);
    if (el) el.innerHTML = html;
  }

  /* ---------- el tablero ---------- */
  const cx = i => M + (i % est.cols) * S + S / 2;
  const cy = i => M + Math.floor(i / est.cols) * S + S / 2;

  function construye() {
    const { filas, cols } = est;
    const W = M * 2 + cols * S, H = M * 2 + filas * S;
    const grads = PALETA.map((c, k) =>
      `<radialGradient id="crg${k}" cx="38%" cy="32%" r="72%">
        <stop stop-color="#fff"/><stop offset=".22" stop-color="${claro(c, 0.45)}"/>
        <stop offset=".62" stop-color="${c}"/><stop offset="1" stop-color="${oscuro(c, 0.45)}"/></radialGradient>`).join("");
    let rej = "";
    for (let c = 0; c <= cols; c++) rej += `M${M + c * S} ${M}V${M + filas * S}`;
    for (let f = 0; f <= filas; f++) rej += `M${M} ${M + f * S}H${M + cols * S}`;
    const celdas = [];
    for (let i = 0; i < filas * cols; i++) {
      celdas.push(`<g class="jg-cr-celda" data-i="${i}" transform="translate(${cx(i)} ${cy(i)})">
        <rect class="jg-cr-cas" x="${-S / 2}" y="${-S / 2}" width="${S}" height="${S}"></rect>
        <g class="jg-cr-orbes"></g></g>`);
    }
    q("#crLienzo").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="jg-cr-svg" id="crSvg">
        <defs>${grads}</defs>
        <rect class="jg-cr-fondo" x="0" y="0" width="${W}" height="${H}" rx="14"></rect>
        <rect class="jg-cr-ult" x="0" y="0" width="${S - 8}" height="${S - 8}" rx="10" style="display:none"></rect>
        ${celdas.join("")}
        <path class="jg-cr-rejilla" d="${rej}"></path>
        <g class="jg-cr-fx"></g>
      </svg>`;
    malla = filas + "x" + cols;
    claves = new Array(filas * cols).fill("");
  }

  function orbesHTML(i, o, pop) {
    const crit = crCritica(i, est.filas, est.cols);
    const n = o.n;
    const dur = n >= crit ? 0.5 : n === crit - 1 ? 0.9 : n >= 3 ? 2.4 : n === 2 ? 3.2 : 0;
    const pos = POS[Math.min(n, 4)];
    const esferas = pos.map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="${R}" fill="${gradDe(o.u)}" stroke="${oscuro(colorDe(o.u), 0.35)}" stroke-width="1.5"></circle>`).join("");
    const giro = dur
      ? ` style="animation-duration:${dur}s;animation-delay:-${((i * 0.37) % 1 * dur).toFixed(2)}s;animation-direction:${i % 2 ? "reverse" : "normal"}"`
      : "";
    const num = n > 4 ? `<text class="jg-cr-num" x="0" y="0">${n}</text>` : "";
    return `<g class="${pop ? "jg-cr-pop" : ""}">
      <circle class="jg-cr-halo" r="${n > 1 ? 40 : 28}" fill="${colorDe(o.u)}"></circle>
      <g class="${n >= crit - 1 && crit > 1 ? "jg-cr-tiembla" : ""}"${n >= crit ? ' style="animation-duration:.12s"' : ""}>
        <g class="${dur ? "jg-cr-gira" : ""}"${giro}>${esferas}</g>
      </g>${num}</g>`;
  }

  /* Pinta un tablero celda a celda, tocando solo las que cambiaron: con
     96 celdas y una cadena de treinta ondas, rehacer el SVG entero en
     cada una reiniciaría todos los giros y se vería a saltos. */
  function pintaTab(tab, pops) {
    if (!host || !est) return;
    if (malla !== est.filas + "x" + est.cols || !q("#crSvg")) construye();
    const celdas = host.querySelectorAll(".jg-cr-celda");
    for (let i = 0; i < tab.length; i++) {
      const o = tab[i], k = o ? o.u + ":" + o.n : "";
      const pop = !!(pops && pops.has(i));
      if (k === claves[i] && !pop) continue;
      claves[i] = k;
      const g = celdas[i];
      if (!g) continue;
      g.classList.toggle("jg-cr-ajena", !!o && o.u !== uid);
      g.querySelector(".jg-cr-orbes").innerHTML = o ? orbesHTML(i, o, pop) : "";
    }
    mostrado = tab;
    pintaMarcador();
  }

  function marcaUlt() {
    const r = q(".jg-cr-ult");
    if (!r) return;
    const u = est.ultima;
    if (!u || animando) { r.style.display = "none"; return; }
    r.setAttribute("x", cx(u.i) - S / 2 + 4);
    r.setAttribute("y", cy(u.i) - S / 2 + 4);
    r.style.stroke = colorDe(u.uid);
    r.style.display = "";
  }

  function tiñe(u) {
    const svg = q("#crSvg");
    if (svg) svg.style.setProperty("--t", u ? colorDe(u) : GRIS);
  }

  /* ---------- efectos ---------- */
  function destello(i, color) {
    const fx = q(".jg-cr-fx");
    if (!fx) return;
    const ns = "http://www.w3.org/2000/svg";
    const hecho = [["jg-cr-flash", S * 0.42, "fill", claro(color, 0.6)], ["jg-cr-onda", S * 0.5, "stroke", color]]
      .map(([clase, r, prop, val]) => {
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("class", clase);
        c.setAttribute("cx", cx(i)); c.setAttribute("cy", cy(i)); c.setAttribute("r", r);
        c.setAttribute(prop, val);
        fx.appendChild(c);
        return c;
      });
    const t = setTimeout(() => { timers.delete(t); hecho.forEach(c => c.remove()); }, 520);
    timers.add(t);
  }

  /* Los orbes salen volando del centro a cada vecina. Por
     requestAnimationFrame y no por CSS: son cientos de destinos
     distintos y una regla por destino no cabe en una hoja de estilos. */
  function vuela(estallan, u, dur) {
    const fx = q(".jg-cr-fx");
    if (!fx) return Promise.resolve();
    const ns = "http://www.w3.org/2000/svg";
    const bolas = [];
    for (const i of estallan) {
      for (const v of crVecinas(i, est.filas, est.cols)) {
        if (bolas.length >= MAX_CHISPAS) break;
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("r", R * 0.8);
        c.setAttribute("fill", gradDe(u));
        c.setAttribute("class", "jg-cr-chispa");
        fx.appendChild(c);
        bolas.push({ c, x0: cx(i), y0: cy(i), x1: cx(v), y1: cy(v) });
      }
    }
    return new Promise(res => {
      const t0 = performance.now();
      let hecho = false;
      const acaba = () => {
        if (hecho) return;
        hecho = true;
        for (const b of bolas) b.c.remove();
        res();
      };
      const paso = ahora => {
        if (hecho) return;
        const k = Math.min(1, (ahora - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        for (const b of bolas) {
          b.c.setAttribute("cx", b.x0 + (b.x1 - b.x0) * e);
          b.c.setAttribute("cy", b.y0 + (b.y1 - b.y0) * e);
          b.c.setAttribute("opacity", k < 0.85 ? 1 : (1 - k) / 0.15);
        }
        if (k >= 1) { raf = 0; acaba(); } else raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
      /* Si el navegador deja de dar fotogramas (pestaña al fondo), el
         temporizador garantiza que la cadena no se queda colgada. */
      const t = setTimeout(() => { timers.delete(t); acaba(); }, dur + 250);
      timers.add(t);
    });
  }

  function combo(n, color) {
    const el = q("#crCombo");
    if (!el) return;
    el.textContent = n > 1 ? `Cadena ×${n}` : "¡Boom!";
    el.style.setProperty("--c", color);
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    clearTimeout(tComb);
    tComb = setTimeout(() => el.classList.remove("on"), 900);
  }

  function sacude(fuerza) {
    const el = q("#crMarco");
    if (!el) return;
    el.style.setProperty("--s", Math.min(9, 2 + fuerza) + "px");
    el.classList.remove("jg-cr-sacude"); void el.offsetWidth; el.classList.add("jg-cr-sacude");
  }

  function aviso(texto, color) {
    const el = q("#crAviso");
    if (!el) return;
    el.textContent = texto;
    el.style.setProperty("--c", color);
    el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    clearTimeout(tAviso);
    tAviso = setTimeout(() => el.classList.remove("on"), 2200);
  }

  /* ---------- la jugada, contada despacio ---------- */
  async function anima(ult) {
    const g = ++gen;
    corta();
    animando = true;
    pintaTab(ult.antes);
    marcaUlt();
    tiñe(ult.uid);
    pinta();
    const color = colorDe(ult.uid);
    await espera(120);
    if (g !== gen) return;

    let t = ult.antes.slice();
    t[ult.i] = { u: ult.uid, n: (t[ult.i] ? t[ult.i].n : 0) + 1 };
    pintaTab(t, new Set([ult.i]));
    suena("orbe");

    const ondas = ult.ondas || [];
    let saltar = ondas.length > MAX_ONDAS;
    if (ondas.length) await espera(260);
    for (let w = 0; w < ondas.length && !saltar; w++) {
      if (g !== gen) return;
      if (document.hidden) { saltar = true; break; }
      const estallan = ondas[w];
      const dur = Math.max(110, 300 - w * 14);
      /* Primero se vacían las que estallan… */
      const vacio = t.slice();
      for (const i of estallan) {
        const n = vacio[i].n - crCritica(i, est.filas, est.cols);
        vacio[i] = n > 0 ? { u: vacio[i].u, n } : null;
      }
      pintaTab(vacio);
      for (const i of estallan) destello(i, color);
      combo(w + 1, color);
      if (w >= 2 || estallan.length >= 4) sacude(Math.min(w, 6) + (estallan.length >= 4 ? 2 : 0));
      suena("estalla", w);
      /* …los orbes vuelan… */
      await vuela(estallan, ult.uid, dur);
      if (g !== gen) return;
      /* …y aterrizan. */
      t = crOnda(t, estallan, ult.uid, est.filas, est.cols);
      const destinos = new Set();
      for (const i of estallan) for (const v of crVecinas(i, est.filas, est.cols)) destinos.add(v);
      pintaTab(t, destinos);
      await espera(Math.max(40, 120 - w * 6));
    }
    if (g !== gen) return;

    corta();
    pintaTab(est.tab);
    marcaUlt();
    tiñe(est.turno);
    if (ult.caen && ult.caen.length) {
      const nom = ult.caen.map(u => (u === uid ? "Tú" : nombreDe(u)));
      const quien = nom.length === 1
        ? (ult.caen[0] === uid ? "Tú quedas" : `${nom[0]} queda`)
        : `${nom.slice(0, -1).join(", ")} y ${nom[nom.length - 1]} quedan`;
      aviso(`💥 ${quien} fuera`, colorDe(ult.caen[0]));
      suena("golpe");
    }
    pinta();
    if (ctx.listo) ctx.listo();
  }

  /* ---------- el resto de la pantalla ---------- */
  function pinta() {
    if (!host || !est) return;
    if (!mostrado || malla !== est.filas + "x" + est.cols) pintaTab(est.tab);

    let fase;
    if (est.fase === "espera") fase = "Esperando a que entren los demás…";
    else if (est.fase === "fin") {
      if (est.motivo === "abandono") fase = est.ganador === uid ? "¡Ganas! Los demás se fueron." : "La partida terminó por abandono.";
      else fase = est.ganador === uid ? "🏆 Tu reacción se lo tragó todo." : `Gana ${nombreDe(est.ganador)}.`;
    } else if (est.fuera[uid] || est.caidos[uid]) fase = `Estás fuera. Le toca a ${nombreDe(est.turno)}`;
    else fase = est.turno === uid ? "Te toca: pon un orbe en una celda vacía o tuya" : `Le toca a ${nombreDe(est.turno)}`;
    set("crFase", fase + "|" + est.turno, `<span class="jg-punto-t jg-cr-punto"
      style="background:${esc(est.turno ? colorDe(est.turno) : GRIS)}"></span>${esc(fase)}`);

    const svg = q("#crSvg");
    const activo = !animando && est.fase === "jugando" && est.turno === uid;
    if (svg) svg.classList.toggle("jg-cr-activo", activo);
    if (!animando) tiñe(est.turno);
    pintaMarcador();

    let pie;
    if (est.fase === "espera") pie = "Pásale el enlace de la sala a quien quieras; con dos ya se puede empezar.";
    else if (est.fase === "fin") pie = "Partida terminada.";
    else if (activo) pie = "Las esquinas estallan con 2, los bordes con 3 y el centro con 4. Lo que tiembla está a punto.";
    else if (est.ultima && est.ultima.ondas.length) {
      const u = est.ultima, n = u.ondas.length;
      pie = `${u.uid === uid ? "Tu" : "La"} última jugada${u.uid === uid ? "" : " de " + nombreDe(u.uid)}: ${n} onda${n === 1 ? "" : "s"}` +
        (u.capturadas ? `, ${u.capturadas} celda${u.capturadas === 1 ? "" : "s"} conquistada${u.capturadas === 1 ? "" : "s"}.` : ".");
    } else pie = "Carga tus celdas sin dejar que el vecino estalle antes.";
    set("crPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
  }

  /* El marcador cuenta lo que se está viendo, no lo que dice el final:
     a mitad de cadena los números suben y bajan con cada onda. */
  function pintaMarcador() {
    if (!est) return;
    const { orbes } = crCuenta(mostrado || est.tab);
    const filas = est.jugadores.map(j => {
      const out = est.fuera[j.uid] || est.caidos[j.uid];
      const n = orbes[j.uid] || 0;
      return { j, n, out, turno: est.turno === j.uid };
    });
    set("crMarcador", filas.map(f => f.j.uid + ":" + f.n + (f.out ? "x" : "") + (f.turno ? "*" : "") + ":" + f.j.nombre).join("/"),
      filas.map(f => `<span class="jg-m${f.turno ? " jg-m-turno" : ""}${f.out ? " jg-m-fuera" : ""}" style="--c:${esc(f.j.color || GRIS)}">
        <span class="jg-cr-chip" style="--o:${colorDe(f.j.uid)}"></span>
        <b>${f.n}</b><span>${esc(f.j.uid === uid ? "tú" : f.j.nombre)}</span></span>`).join(""));
  }

  async function alClic(ev) {
    const g = ev.target.closest(".jg-cr-celda");
    if (!g || !est || enviando || animando) return;
    if (est.fase !== "jugando" || est.turno !== uid) return;
    const i = Number(g.getAttribute("data-i"));
    const o = est.tab[i];
    if (o && o.u !== uid) return;
    enviando = true;
    suena("clic");
    try { await jugar({ t: "p", uid, f: Math.floor(i / est.cols), c: i % est.cols }); }
    finally { if (!muerto) enviando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (!host) return;
    const nuevo = vistos >= 0 && est.movs > vistos && est.ultima;
    vistos = est.movs;
    if (nuevo && !document.hidden) anima(est.ultima);
    else if (nuevo || !animando) {
      if (animando) { gen++; corta(); }
      pintaTab(est.tab);
      marcaUlt();
    }
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir, ocupado: () => animando };
}
