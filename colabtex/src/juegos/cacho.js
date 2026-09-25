/* Cacho — modalidad de dudo, de dos a ocho, normal o siciliana.
 *
 * Esta pantalla no decide nada: el reductor (`redCacho` en motor.js)
 * sabe de quién es el turno, qué apuesta vale, cuántos dados había y
 * quién pierde uno. Aquí se pinta eso y se mandan tres jugadas —
 * apostar, dudar y calzar— más una que nadie pulsa:
 *
 * - **La llave va sola.** Los dados de cada vaso salen de una cadena de
 *   hashes que solo conoce su dueño (`cadenaCacho`), y al destapar cada
 *   uno tiene que revelar la llave de la ronda para que los demás vean
 *   lo que tenía. Cuando el reductor la pide (`espera.k === "llaves"`)
 *   esta pestaña la manda sin preguntar. No hay dealer: cada navegador
 *   «agita» su propio vaso, y nadie más sabe lo que salió.
 * - **Los vasos se levantan de uno en uno.** El destape no se enseña de
 *   golpe: `est.ultimo` trae el orden (desde quien dudó o calzó, en el
 *   sentido de la ronda), y la pantalla alza un vaso cada `pasoMs`
 *   marcando los dados que cuentan, con el contador subiendo, antes de
 *   dar el veredicto. Tocar la mesa se lo salta.
 * - **Lo que suena sale del historial** (`nuevosDe`), como en Flip 7:
 *   así se oye también lo que hacen los demás, que es casi todo lo que
 *   uno espera.
 *
 * Con la pestaña detrás no se anima nada: el destape queda pendiente y
 * se cuenta al volver (`alVolver`), y el cartel de fin de partida espera
 * a que termine (`ocupado`).
 *
 * El repintado va por firmas, como en los demás juegos: reescribir el
 * innerHTML en cada tic reiniciaría las animaciones.
 */
import {
  CC_CADENA, PINTAS_CACHO_PL, textoApuesta, cadenaCacho, llaveCacho,
  dadosCacho, cuentaDado, minimoCacho
} from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const quieto = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* El latido que rescata relojes perdidos, el tope de una jugada que no
   vuelve, y a partir de cuándo se dice en voz alta a quién se espera. */
const LATIDO_MS = 2000;
const ENVIO_MAX = 12000;
const AVISO_LLAVES = 10000;
const AVISO_APUESTA = 25000;
/* El destape: lo que tarda en alzarse el primer vaso, cada uno de los
   siguientes (más rápido con mucha gente, o se hace eterno) y lo que se
   queda el veredicto a la vista antes de la ronda siguiente. */
const PRIMER_PASO = 700;
const pasoMs = n => n > 5 ? 650 : 850;
const VEREDICTO_MS = 2600;
const DESTAPE_MAX = 20000;

/* Las caras de un dado en una rejilla de 3×3. */
const PIPS = [null, [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
function dado(v, cls = "") {
  const on = PIPS[v] || [];
  let h = "";
  for (let i = 0; i < 9; i++) h += on.includes(i) ? `<i class="on"></i>` : `<i></i>`;
  return `<span class="jg-cc-dado${cls ? " " + cls : ""}${v === 1 ? " as" : ""}" data-v="${v}">${h}</span>`;
}

/* Qué sucesos del historial son nuevos (la misma cuenta que en Flip 7:
   el historial es una cola, y lo que ya había casa con su principio). */
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

export function crearCacho(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let sec = null, secPedido = false, secListo = false;
  let cad = null;              // mi cadena: null sin calcular, false si no casa con la ficha
  let enviando = false, enviandoT = 0;
  let latido = null;
  let esperaFirma = "", esperaDesde = 0;
  let enviadoR = -1, enviadoKT = 0;   // ronda cuya llave ya salió, y cuándo
  let sel = { firma: "", p: 0, c: 1, s: 1, ob: false };
  let anim = null, gen = 0, pendiente = null, vistoR = 0, primera = true;
  let histPrev = [];
  let agitaHasta = 0, listoDado = false, cierreT = 0, relojFin = null;
  let firmaMesa = "";
  const firmas = {};
  const temporizadores = new Set();

  const ocupado = () => !!anim || !!pendiente;
  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = s => host && host.querySelector(s);

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-cc">
        <div class="jg-barra">
          <div class="jg-fase" id="ccFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-cc-modo" id="ccModo"></div>
        </div>
        <div id="ccTrampa"></div>
        <div class="jg-tablero jg-cc-tablero">
          <div class="jg-cc-mesa" id="ccMesa">
            <div class="jg-cc-pano"></div>
            <div class="jg-cc-centro" id="ccCentro"></div>
            <div id="ccAsientos"></div>
          </div>
        </div>
        <div class="jg-cc-mios" id="ccMios"></div>
        <div class="jg-pie" id="ccPie"></div>
        <div class="jg-cc-hist" id="ccHist"></div>
      </div>`;
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
  const juego = () => !!jugador(uid) && !(est.fuera || {})[uid] && (est.dados || {})[uid] > 0;
  /* La frase con el verbo en la persona que toca: «pierdes» o «Ana pierde». */
  const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
  const dd = n => n === 1 ? "un dado" : n + " dados";

  /* Mi cadena de llaves. Se calcula una vez (son 300 hashes) y se
     compara con la punta publicada en mi ficha: si no casa —una sala
     abierta en otro navegador, un secreto que se perdió— no hay forma
     de ver mis dados ni de revelarlos, y es mejor decirlo que inventar. */
  function miCadena() {
    if (cad !== null) return cad;
    if (!secListo || !est) return null;
    const y = jugador(uid);
    if (!sec || sec.sem == null || !y || !y.hcad) { cad = false; return cad; }
    const c = cadenaCacho(sec.sem >>> 0, sec.sal || "");
    cad = c[CC_CADENA] === y.hcad ? c : false;
    return cad;
  }

  function misDados() {
    const c = miCadena();
    const k = (est.enVaso || {})[uid] || 0;
    if (!c || !k || est.fase !== "jugando" || est.etapa === "arranque") return null;
    return dadosCacho(llaveCacho(c, est.ronda), est.mezcla, k);
  }

  /* ---------- pintado ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  /* Lo que el destape deja ver ahora mismo: mientras se anima, los vasos
     alzados hasta el paso `n`; al terminar la partida (y sin animación
     pendiente), la última ronda entera, que es la que la decidió. */
  function vista() {
    if (anim) return { u: anim.ult, n: anim.i, ver: anim.ver };
    const u = est.ultimo;
    if (est.fase === "fin" && !pendiente && u && u.r === est.ronda && est.motivo !== "abandono")
      return { u, n: u.orden.length, ver: true };
    return null;
  }

  function pinta() {
    if (!host || !est) return;
    const v = vista();
    pintaBarra();
    pintaTrampa();
    pintaAsientos(v);
    pintaCentro(v);
    pintaMios(v);
    pintaPie(v);
    pintaHist();
  }

  function pintaBarra() {
    let f;
    if (est.fase === "espera") f = "Esperando jugadores";
    else if (est.fase === "fin") f = est.ganador === uid ? "¡Ganaste!" : est.ganador ? "Ganó " + nombre(est.ganador) : "Empate";
    else if (anim || est.etapa === "destape") f = `Ronda ${est.ronda} · Destapando…`;
    else if (est.etapa === "arranque") f = "Agitando los vasos…";
    else f = `Ronda ${est.ronda} · ` + (est.turno === uid ? "Te toca" : "Turno de " + nombre(est.turno));
    set("ccFase", f, esc(f));
    const m = (est.sicil ? "Siciliana" : "Normal") + " · " + est.total + " dados";
    set("ccModo", m, esc(m));
  }

  function pintaTrampa() {
    const fs = est.falsas || [];
    const h = fs.map(f => `<div class="jg-trampa">La llave de ${esc(nombre(f.uid))} (ronda ${f.r}) no cuadra con su cadena: la mesa espera la buena, y se le puede echar con la votación.</div>`).join("");
    set("ccTrampa", h, h);
  }

  /* Los asientos, en círculo, conmigo abajo. Se rehacen solo cuando
     cambia quién se sienta; lo demás se repinta por dentro. */
  function pintaAsientos(v) {
    const js = est.jugadores;
    const N = js.length;
    const me = Math.max(0, js.findIndex(j => j.uid === uid));
    const llave = js.map(j => j.uid).join(",") + "|" + me;
    const mesa = $("#ccMesa");
    if (mesa) mesa.setAttribute("data-n", String(N));
    if (llave !== firmaMesa) {
      firmaMesa = llave;
      for (const k of Object.keys(firmas)) if (/^cc[ABVQP]\d/.test(k)) delete firmas[k];
      let h = "";
      js.forEach((j, i) => {
        const a = (90 + (i - me) * 360 / N) * Math.PI / 180;
        const x = 50 + 40 * Math.cos(a), y = 50 + 36 * Math.sin(a);
        h += `<div class="jg-cc-asiento" id="ccA${i}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">
          <div class="jg-cc-globo" id="ccB${i}"></div>
          <div class="jg-cc-vasito" id="ccV${i}"></div>
          <div class="jg-cc-quien" id="ccQ${i}"></div>
          <div class="jg-cc-pips" id="ccP${i}"></div>
        </div>`;
      });
      const cont = $("#ccAsientos");
      if (cont) cont.innerHTML = h;
    }

    const u = v && v.u;
    const alzados = u ? u.orden.slice(0, v.n) : [];
    const aps = est.apuestas || [];
    const ultAp = aps[aps.length - 1];
    const faltan = (est.espera && est.espera.k === "llaves" && est.espera.faltan) || [];
    const ahora = Date.now();
    const agita = est.fase === "jugando" && (est.etapa === "arranque" || ahora < agitaHasta);

    js.forEach((j, i) => {
      const w = j.uid;
      const fuera = !!(est.fuera || {})[w];
      const nd = (est.dados || {})[w] || 0;
      const el = $("#ccA" + i);
      if (el) {
        el.style.setProperty("--c", j.color || "#888");
        el.classList.toggle("turno", !v && est.fase === "jugando" && est.etapa === "apuesta" && est.turno === w);
        el.classList.toggle("fuera", fuera || (nd === 0 && !(u && (u.antes || {})[w])));
        el.classList.toggle("yo", w === uid);
        el.classList.toggle("pierde", !!(v && v.ver && u.pierde === w));
        el.classList.toggle("gana", !!(v && v.ver && (u.gana === w || (est.fase === "fin" && est.ganador === w))));
      }

      /* El globo: lo que dijo. */
      let g = "", gc = "";
      if (u) {
        if (w === u.quien && u.tipo !== "anula") { g = u.tipo === "dudo" ? "¡Dudo!" : "¡Calzo!"; gc = "grito"; }
        else if (w === u.contra && u.apuesta) { g = textoApuesta(u.apuesta.c, u.apuesta.p); gc = "ultima"; }
      } else if (est.fase === "jugando") {
        if (est.etapa === "destape" && est.destape && w === est.destape.quien && est.destape.tipo !== "anula") {
          g = est.destape.tipo === "dudo" ? "¡Dudo!" : "¡Calzo!"; gc = "grito";
        } else {
          let mia = null;
          for (let k = aps.length - 1; k >= 0; k--) if (aps[k].uid === w) { mia = aps[k]; break; }
          if (mia) { g = textoApuesta(mia.c, mia.p); gc = mia === ultAp ? "ultima" : ""; }
        }
      }
      set("ccB" + i, g + "|" + gc, g ? `<span class="${gc}">${esc(g)}</span>` : "");

      /* El vaso y, si está alzado, lo que tenía debajo. */
      const vasos = u ? u.vasos || {} : {};
      const alzado = alzados.includes(w);
      const tiene = u ? !!vasos[w] : ((est.enVaso || {})[w] || 0) > 0 || est.etapa === "arranque" && !fuera && nd > 0;
      let dh = "";
      if (alzado) {
        const pinta = u.apuesta ? u.apuesta.p : 0;
        dh = (vasos[w] || []).map(d => dado(d, pinta && cuentaDado(d, pinta, u.obligada) ? "cuenta" : "")).join("");
      }
      const cls = ["jg-cc-vasw", alzado ? "alzado" : "", !tiene ? "vacio" : "", tiene && !u && agita ? "agita" : ""].filter(Boolean).join(" ");
      set("ccV" + i, cls + "|" + dh + "|" + (u ? u.r : est.ronda),
        `<div class="${cls}"><div class="jg-cc-dados">${dh}</div><div class="jg-cc-vaso"><b></b></div></div>`);

      /* Nombre, foto y si se le espera. */
      const foto = j.foto && /^(https?:|data:image\/)/.test(j.foto)
        ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
      const espera = faltan.includes(w) && !u;
      set("ccQ" + i, [j.nombre, j.foto, espera, w === uid].join("|"),
        `<span class="jg-cc-ava">${foto}</span><span class="jg-cc-nom">${esc(w === uid ? "Tú" : j.nombre || "?")}</span>${espera ? `<span class="jg-cc-reloj" title="Falta su llave">⏳</span>` : ""}`);

      /* Los dados que le quedan, como cinco puntos. */
      let antes = nd, despues = nd;
      if (u) { antes = (u.antes || {})[w] || 0; despues = v.ver ? ((u.despues || {})[w] || 0) : antes; }
      let ph = "";
      for (let k = 0; k < 5; k++) {
        const c = k < Math.min(antes, despues) ? "on" : k < antes ? "cae" : k < despues ? "on gana" : "";
        ph += `<i class="${c}"></i>`;
      }
      set("ccP" + i, ph, ph);
    });
  }

  function pintaCentro(v) {
    let h = "";
    if (v) {
      const u = v.u;
      if (u.tipo === "anula") {
        h = `<div class="jg-cc-grito">Ronda anulada</div>
          <div class="jg-cc-sub">${esc(verbo(u.quien, "Te fuiste", "se fue"))} con sus dados en la mesa</div>`;
        if (v.ver) h += `<div class="jg-cc-veredicto">Nadie pierde</div>`;
      } else {
        const a = u.apuesta;
        let k = 0;
        for (const w of u.orden.slice(0, v.n)) for (const d of (u.vasos || {})[w] || []) if (cuentaDado(d, a.p, u.obligada)) k++;
        h = `<div class="jg-cc-grito">${u.tipo === "dudo" ? "¡Dudo!" : "¡Calzo!"}</div>
          <div class="jg-cc-sub">${esc(Nombre(u.quien))} → ${esc(nombre(u.contra))}</div>
          <div class="jg-cc-ap">${dado(a.p)} <b>${esc(textoApuesta(a.c, a.p))}</b></div>
          <div class="jg-cc-cuenta">Van <b>${k}</b> de ${a.c} <small>· ${v.n}/${u.orden.length} vasos</small></div>`;
        if (v.ver) h += `<div class="jg-cc-veredicto ${u.pierde === uid ? "malo" : (u.gana === uid || (u.pierde && u.pierde !== uid)) ? "bueno" : ""}">${esc(veredicto(u))}</div>`;
      }
    } else if (est.fase === "espera") {
      h = `<div class="jg-cc-sub">Esperando a que se sienten todos</div>`;
    } else if (est.fase === "fin") {
      h = `<div class="jg-cc-grito">${esc(est.ganador === uid ? "¡Ganaste!" : est.ganador ? "Ganó " + nombre(est.ganador) : "Empate")}</div>`;
    } else if (est.etapa === "arranque") {
      h = `<div class="jg-cc-grito">A agitar</div><div class="jg-cc-sub">Cada uno agita su vaso</div>`;
    } else if (est.etapa === "destape") {
      h = `<div class="jg-cc-grito">${est.destape && est.destape.tipo === "calzo" ? "¡Calzo!" : est.destape && est.destape.tipo === "anula" ? "Ronda anulada" : "¡Dudo!"}</div>
        <div class="jg-cc-sub">Levantando los vasos…</div>`;
    } else {
      const aps = est.apuestas || [];
      const ult = aps[aps.length - 1];
      h = ult
        ? `<div class="jg-cc-ap grande">${dado(ult.p)} <b>${esc(textoApuesta(ult.c, ult.p))}</b></div>
           <div class="jg-cc-sub">apuesta de ${esc(nombre(ult.uid))}</div>`
        : `<div class="jg-cc-sub">Abre ${esc(nombre(est.turno))}</div>`;
      h += `<div class="jg-cc-meta"><span>🎲 ${est.enMesa} en la mesa</span>
        <span>${est.sentido === 1 ? "⟳ Horario" : "⟲ Antihorario"}</span>
        ${est.obligada ? `<span class="jg-cc-ob">Obligada</span>` : ""}
        <span>Ronda ${est.ronda}</span></div>`;
    }
    set("ccCentro", h, h);
  }

  function veredicto(u) {
    const a = u.apuesta;
    const habia = "Había " + textoApuesta(u.cuenta, a.p);
    if (u.tipo === "dudo") {
      let s = `${habia}: ${verbo(u.pierde, "pierdes", "pierde")} ${dd(u.n)}`;
      if (u.sicil) s += " (siciliana)";
      if (u.pierde && u.despues[u.pierde] === 0) s += u.pierde === uid ? " y quedas fuera" : " y queda fuera";
      return s;
    }
    if (u.acierta) return "¡Calzo justo! " + (u.gana ? verbo(u.gana, "recuperas", "recupera") + " un dado" : "(ya tenía cinco)");
    let s = `${habia}: ${verbo(u.pierde, "pierdes", "pierde")} un dado`;
    if (u.pierde && u.despues[u.pierde] === 0) s += u.pierde === uid ? " y quedas fuera" : " y queda fuera";
    return s;
  }

  /* Mi bandeja: mis dados de esta ronda, que solo veo yo. */
  function pintaMios(v) {
    let h = "", clave;
    if (ctx.mirando || !jugador(uid) || est.fase !== "jugando") { clave = "nada"; h = ""; }
    else if (v) { clave = "anim"; h = `<div class="jg-cc-mios-t">Destapando la ronda…</div>`; }
    else if (!juego()) { clave = "fuera"; h = `<div class="jg-cc-mios-t">Te quedaste sin dados: ahora miras cómo acaba.</div>`; }
    else if (est.etapa === "arranque") { clave = "arr"; h = `<div class="jg-cc-mios-t">Agitando…</div>`; }
    else {
      const c = miCadena();
      if (c === null) { clave = "espera"; h = `<div class="jg-cc-mios-t">Mirando bajo el vaso…</div>`; }
      else if (c === false) { clave = "mala"; h = `<div class="jg-cc-mios-t malo">No encuentro la semilla de esta sala en este navegador: no puedo ver tus dados ni revelarlos.</div>`; }
      else {
        const ds = misDados() || [];
        const aps = est.apuestas || [];
        const mio = est.etapa === "apuesta" && est.turno === uid;
        const pin = mio && sel.p ? sel.p : aps.length ? aps[aps.length - 1].p : 0;
        const n = pin ? ds.filter(d => cuentaDado(d, pin, est.obligada)).length : 0;
        clave = est.ronda + "|" + ds.join("") + "|" + pin + "|" + est.obligada;
        h = `<div class="jg-cc-mios-t">Tu vaso</div>
          <div class="jg-cc-mios-d r${est.ronda % 2}">${ds.map((d, i) => dado(d, (pin && cuentaDado(d, pin, est.obligada) ? "cuenta" : "") + ` d${i}`)).join("")}</div>
          ${pin ? `<div class="jg-cc-mios-n">${n} ${n === 1 ? "cuenta" : "cuentan"} para ${esc(PINTAS_CACHO_PL[pin].toLowerCase())}</div>` : ""}`;
      }
    }
    set("ccMios", clave, h);
  }

  /* La apuesta que propone el panel al llegarme el turno: la de antes
     subida lo justo, o al abrir, la pinta de la que más tengo. */
  function preparaSel() {
    const aps = est.apuestas || [];
    const f = est.ronda + ":" + aps.length + ":" + (est.espera && est.espera.uid);
    if (sel.firma === f) return;
    const ant = aps[aps.length - 1] || null;
    const o = opciones(ant, false);
    sel = { firma: f, p: 0, c: 1, s: est.sentido || 1, ob: false };
    if (ant) {
      let pin = ant.p;
      if (minimoCacho(ant, pin, o) == null) for (let k = 1; k <= 6; k++) if (minimoCacho(ant, k, o) != null) { pin = k; break; }
      sel.p = pin;
      sel.c = Math.min(est.enMesa, minimoCacho(ant, pin, o) || 1);
    } else {
      const ds = misDados() || [];
      let mejor = 2, mn = -1;
      for (let k = 2; k <= 6; k++) {
        const n = ds.filter(d => cuentaDado(d, k, false)).length;
        if (n >= mn) { mn = n; mejor = k; }
      }
      sel.p = mejor;
      sel.c = Math.max(1, Math.min(est.enMesa, mn));
    }
  }
  const opciones = (ant, ob) => ({ obligada: est.obligada || (!ant && ob), unDado: (est.enVaso || {})[uid] === 1 });

  function pintaPie(v) {
    let h = "", clave;
    const w = est.espera;
    if (est.fase === "espera") { clave = "espera"; h = `<div class="jg-nota">La partida empieza cuando se sienten todos.</div>`; }
    else if (est.fase === "fin") { clave = "fin"; h = `<div class="jg-nota">Partida terminada.</div>`; }
    else if (v) { clave = "anim"; h = `<div class="jg-nota">Destapando… (toca la mesa para saltar)</div>`; }
    else if (ctx.mirando || !jugador(uid)) { clave = "mira"; h = `<div class="jg-nota">Estás mirando.</div>` + aviso(); }
    else if (w && w.k === "apuesta" && w.uid === uid && juego()) {
      preparaSel();
      const aps = est.apuestas || [];
      const ant = aps[aps.length - 1] || null;
      const o = opciones(ant, sel.ob);
      const tope = est.enMesa;
      const minP = minimoCacho(ant, sel.p, o);
      if (minP == null || minP > tope) {
        for (let k = 1; k <= 6; k++) { const m = minimoCacho(ant, k, o); if (m != null && m <= tope) { sel.p = k; break; } }
      }
      const min = minimoCacho(ant, sel.p, o);
      const puede = min != null && min <= tope;
      if (puede) sel.c = Math.max(min, Math.min(tope, sel.c));
      let pin = "";
      for (let k = 1; k <= 6; k++) {
        const m = minimoCacho(ant, k, o);
        const off = m == null || m > tope;
        pin += `<button class="jg-cc-pinta${sel.p === k ? " sel" : ""}" data-pinta="${k}"${off ? " disabled" : ""}>${dado(k)}<span>${esc(PINTAS_CACHO_PL[k])}</span></button>`;
      }
      const notas = [];
      if (est.sicil && aps.length === 1) notas.push("Siciliana: dudar la primera apuesta se juega dos dados.");
      if (est.obligada) notas.push("Ronda obligada: sin comodines y sin cambiar de pinta.");
      if (!ant && sel.ob) notas.push("Al obligar, los ases no son comodín y nadie cambia de pinta.");
      if (!ant && (est.enVaso || {})[uid] === 1) notas.push("Con un dado puedes abrir a ases.");
      if (!puede) notas.push("No se puede subir más: duda o calza.");
      clave = ["ap", sel.firma, sel.p, sel.c, sel.s, sel.ob, puede, enviando, est.calzo, est.obligar].join("|");
      h = `<div class="jg-cc-panel">
        <div class="jg-cc-pintas">${pin}</div>
        <div class="jg-cc-fila">
          <div class="jg-cc-paso">
            <button class="jg-cc-mm" data-mas="-1"${!puede || sel.c <= min ? " disabled" : ""}>−</button>
            <b>${puede ? sel.c : "—"}</b>
            <button class="jg-cc-mm" data-mas="1"${!puede || sel.c >= tope ? " disabled" : ""}>+</button>
          </div>
          ${!ant ? `<button class="jg-cc-tog" data-sentido>${sel.s === 1 ? "⟳ Horario" : "⟲ Antihorario"}</button>` : ""}
          ${!ant && est.obligar ? `<button class="jg-cc-tog${sel.ob ? " sel" : ""}" data-obliga>${sel.ob ? "✓ " : ""}Obligar</button>` : ""}
        </div>
        <div class="jg-cc-fila">
          <button class="jg-cc-boton jg-cc-apuesta" id="ccApuesta"${!puede || enviando ? " disabled" : ""}>Apostar ${puede ? esc(textoApuesta(sel.c, sel.p)) : ""}</button>
          ${ant ? `<button class="jg-cc-boton jg-cc-dudo" id="ccDudo"${enviando ? " disabled" : ""}>Dudo${est.sicil && aps.length === 1 ? " (se juegan 2)" : ""}</button>` : ""}
          ${est.calzo ? `<button class="jg-cc-boton jg-cc-calzo" id="ccCalzo"${enviando ? " disabled" : ""}>Calzo</button>` : ""}
        </div>
        ${notas.map(n => `<div class="jg-nota">${esc(n)}</div>`).join("")}
      </div>`;
    } else if (w && w.k === "apuesta") {
      clave = "turno" + w.uid; h = `<div class="jg-nota">Turno de ${esc(nombre(w.uid))}.</div>` + aviso();
    } else if (w && w.k === "llaves") {
      const c = miCadena();
      const mia = w.faltan.includes(uid);
      const t = mia && c === false
        ? "No encuentro la semilla de esta sala en este navegador, y sin ella no se puede revelar tu vaso."
        : w.r === 0 ? "Agitando…" : "Levantando los vasos…";
      clave = "llaves" + w.r + t; h = `<div class="jg-nota">${esc(t)}</div>` + aviso();
    } else { clave = "otro"; h = aviso(); }
    set("ccPie", clave + "|" + aviso(), h);
  }

  /* Tras un rato esperando a alguien, decir a quién, y que existe la
     votación para echarlo: una pestaña dormida no puede parar la mesa. */
  function aviso() {
    const w = est && est.espera;
    if (!w || est.fase !== "jugando" || anim) return "";
    const t = Date.now() - esperaDesde;
    let quien = [];
    if (w.k === "llaves" && t > AVISO_LLAVES) quien = w.faltan.filter(u => u !== uid);
    else if (w.k === "apuesta" && t > AVISO_APUESTA && w.uid !== uid) quien = [w.uid];
    if (!quien.length) return "";
    return `<div class="jg-nota">Se está esperando a ${esc(quien.map(nombre).join(", "))}. Si no vuelve, se le puede echar con ⏏ arriba.</div>`;
  }

  function textoSuceso(e) {
    const ap = a => a ? textoApuesta(a.c, a.p) : "";
    switch (e.e) {
      case "ronda": return `Ronda ${e.r}: abre ${nombre(e.uid)}`;
      case "ap": return `${Nombre(e.uid)}: ${textoApuesta(e.c, e.p)}${e.ob ? " (obligada)" : ""}${e.s ? (e.s === 1 ? " ⟳" : " ⟲") : ""}`;
      case "dudo": return verbo(e.uid, "Dudas", "duda") + (e.a ? " a " + nombre(e.a) : "");
      case "calzo": return verbo(e.uid, "Calzas", "calza");
      case "destape":
        if (e.tipo === "anula") return `Ronda ${e.r} anulada`;
        if (e.pierde) return `${verbo(e.pierde, "Pierdes", "pierde")} ${dd(e.n)}`;
        if (e.gana) return `${verbo(e.gana, "Recuperas", "recupera")} un dado`;
        return e.tipo === "calzo" ? "Calzo justo" : "";
      case "sale": return verbo(e.uid, "Te quedas", "se queda") + " sin dados";
      case "abandona": return verbo(e.uid, "Te vas", "se va") + " de la mesa";
      case "anula": return `${Nombre(e.uid)} se fue con la ronda en juego`;
      case "falsa": return `La llave de ${nombre(e.uid)} no cuadra`;
      default: return ap(null);
    }
  }

  function pintaHist() {
    /* Durante el destape, el resultado aún no se cuenta aquí. */
    let hs = (est.hist || []).slice();
    if (anim) {
      const k = hs.findIndex(e => e.e === "destape" && e.r === anim.ult.r);
      if (k >= 0) hs = hs.slice(0, k);
    }
    const ult = hs.slice(-12).reverse().map(e => ({ e, t: textoSuceso(e) })).filter(x => x.t);
    const firma = ult.map(x => x.e.i).join(",");
    set("ccHist", firma, ult.length ? `<div class="jg-cc-hist-t">Lo último</div>` +
      ult.map(x => `<div class="jg-cc-h h-${esc(x.e.e)}">${esc(x.t)}</div>`).join("") : "");
  }

  /* ---------- el destape, vaso a vaso ---------- */
  function empiezaAnim(u) {
    const g = ++gen;
    pendiente = null;
    anim = { ult: u, i: 0, ver: false, t: Date.now(), g };
    if (quieto() || !u.orden.length) { dictamen(g); return; }
    pinta();
    luego(() => paso(g), PRIMER_PASO);
  }
  function paso(g) {
    if (!anim || anim.g !== g) return;
    anim.i++;
    suena("dado");
    pinta();
    if (anim.i < anim.ult.orden.length) luego(() => paso(g), pasoMs(anim.ult.orden.length));
    else luego(() => dictamen(g), pasoMs(anim.ult.orden.length));
  }
  function dictamen(g) {
    if (!anim || anim.g !== g) return;
    anim.i = anim.ult.orden.length;
    anim.ver = true;
    const u = anim.ult;
    if (u.pierde) suena(u.pierde === uid ? "pierde" : "revienta");
    else if (u.gana) suena("gana");
    pinta();
    luego(() => acaba(g), VEREDICTO_MS);
  }
  function acaba(g) {
    if (!anim || (g != null && anim.g !== g)) return;
    anim = null;
    if (est && est.fase === "jugando") {
      agitaHasta = Date.now() + 1200;
      suena("cubilete");
      luego(pinta, 1300);
    }
    pinta();
    listoSiFin();
  }

  function listoSiFin() {
    if (listoDado || !est || est.fase !== "fin" || anim || pendiente || document.hidden) return;
    listoDado = true;
    if (ctx.listo) ctx.listo();
  }

  function alVolver() {
    if (document.hidden || muerto || !est) return;
    automatismos();
    const q = pendiente;
    if (q) { empiezaAnim(q); return; }
    pinta();
    listoSiFin();
  }

  /* ---------- interacción ---------- */
  function alClic(ev) {
    if (!est) return;
    if (anim && ev.target.closest("#ccMesa")) {
      if (anim.ver) acaba(anim.g);
      else dictamen(anim.g);
      return;
    }
    if (est.fase !== "jugando" || enviando || anim) return;
    const w = est.espera;
    if (!w || w.k !== "apuesta" || w.uid !== uid || !juego()) return;
    const b = ev.target.closest("button");
    if (!b || b.disabled) return;
    const aps = est.apuestas || [];
    const ant = aps[aps.length - 1] || null;
    if (b.hasAttribute("data-pinta")) {
      const k = Number(b.getAttribute("data-pinta"));
      const m = minimoCacho(ant, k, opciones(ant, sel.ob));
      if (m == null) return;
      /* Al cambiar de pinta se conserva la cantidad si todavía vale, y
         si no se sube a la mínima: bajar sola lo que uno eligió sorprende. */
      sel.p = k;
      sel.c = Math.max(m, sel.c);
      if (ant && sel.c > m && ant.p !== k) sel.c = m;
      suena("clic"); pinta(); return;
    }
    if (b.hasAttribute("data-mas")) { sel.c += Number(b.getAttribute("data-mas")); suena("clic"); pinta(); return; }
    if (b.hasAttribute("data-sentido")) { sel.s = -sel.s; suena("clic"); pinta(); return; }
    if (b.hasAttribute("data-obliga")) {
      sel.ob = !sel.ob;
      const m = minimoCacho(null, sel.p, opciones(null, sel.ob));
      if (m == null) sel.p = 2;
      suena("clic"); pinta(); return;
    }
    if (b.id === "ccApuesta") {
      const j = { t: "ap", uid, c: sel.c, p: sel.p };
      if (!ant) { j.s = sel.s; if (sel.ob) j.ob = true; }
      manda(j); return;
    }
    if (b.id === "ccDudo") { manda({ t: "dudo", uid }); return; }
    if (b.id === "ccCalzo") { manda({ t: "calzo", uid }); return; }
  }

  /* Una jugada con tope de tiempo: una transacción sin red no falla,
     espera, y mientras tanto los botones quedaban grises para siempre. */
  function conTope(promesa) {
    let t;
    return Promise.race([promesa, new Promise((_, no) => { t = setTimeout(() => no(new Error("la jugada no vuelve")), ENVIO_MAX); })])
      .finally(() => clearTimeout(t));
  }

  async function manda(j) {
    if (enviando) return;
    enviando = true; enviandoT = Date.now(); pinta();
    try { await conTope(jugar(j)); } catch (e) { console.warn("[cacho]", e); }
    finally { enviando = false; if (est) pinta(); }
  }

  /* Mi llave, en cuanto la mesa la pide. Si no entra (la red, una
     transacción perdida) se vuelve a intentar: la mesa entera espera
     por ella. */
  function automatismos() {
    const w = est && est.espera;
    if (!w || est.fase !== "jugando" || w.k !== "llaves" || !w.faltan.includes(uid)
        || ctx.mirando || !jugador(uid) || (est.fuera || {})[uid]) return;
    const c = miCadena();
    if (!c) return;
    if (enviadoR === w.r && Date.now() - enviadoKT < 8000) return;
    enviadoR = w.r; enviadoKT = Date.now();
    const r = w.r;
    conTope(jugar({ t: "k", uid, r, c: llaveCacho(c, r) }))
      .then(ok => { if (!ok && !muerto && enviadoR === r) { enviadoR = -1; luego(automatismos, 1500); } })
      .catch(e => { console.warn("[cacho]", e); if (!muerto && enviadoR === r) { enviadoR = -1; luego(automatismos, 1500); } });
  }

  function late() {
    if (muerto || !est) return;
    if (enviando && Date.now() - enviandoT > ENVIO_MAX + 3000) enviando = false;
    if (anim && Date.now() - anim.t > DESTAPE_MAX) acaba(anim.g);
    if (est.fase === "jugando") { automatismos(); pinta(); }
    else if (est.fase === "fin" && !(p.fin && p.fin.at) && Date.now() - cierreT > 3000) cierre();
  }

  /* Al acabar, cerrar la sala. Se sigue intentando hasta que `fin` está
     escrito: un `terminar` que falló no puede dejarla abierta. */
  function cierre() {
    cierreT = Date.now();
    if (ctx.mirando || !jugador(uid) || (p.fin && p.fin.at)) return;
    Promise.resolve().then(() => terminar(est.ganador, est.motivo)).catch(() => {});
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1500);
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    pideSecreto();
    const w = est.espera;
    const fe = !w || est.fase !== "jugando" ? "" : w.k === "llaves" ? "k" + w.r + ":" + w.faltan.join(",") : "a" + w.uid + ":" + (est.apuestas || []).length;
    if (fe !== esperaFirma) { esperaFirma = fe; esperaDesde = Date.now(); }

    const hist = est.hist || [];
    const nuevos = primera ? [] : nuevosDe(histPrev, hist).slice(-16);
    histPrev = hist.slice();
    const visible = !document.hidden;
    if (visible && nuevos.length) {
      if (nuevos.some(h => h.e === "dudo" || h.e === "calzo")) suena("golpe");
      else if (nuevos.some(h => h.e === "ap")) suena("madera");
      if (nuevos.some(h => h.e === "ronda") && !nuevos.some(h => h.e === "destape")) {
        agitaHasta = Date.now() + 1200;
        suena("cubilete");
        luego(pinta, 1300);
      }
    }

    pinta();

    const u = est.ultimo;
    if (primera) {
      primera = false;
      vistoR = u ? u.r : 0;
      if (est.fase === "fin") listoSiFin();
    } else if (u && u.r !== vistoR) {
      vistoR = u.r;
      if (!(est.fase === "fin" && est.motivo === "abandono")) {
        if (!visible) pendiente = u;
        else empiezaAnim(u);
      }
    } else if (est.fase === "fin") listoSiFin();

    automatismos();
    if (est.fase === "fin" && !(p.fin && p.fin.at)) cierre();
  }

  return { montar, actualizar, destruir, ocupado };
}
