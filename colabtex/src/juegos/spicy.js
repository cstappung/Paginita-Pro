/* ============================================================
   Spicy — la pantalla. Todo lo decide `redSpicy` en motor.js; aquí solo
   se pinta y se manda.

   Cada uno roba de un mazo propio (su semilla privada + la `mezcla` del
   arranque) y juega su carta **boca abajo**: lo que sube al registro es
   `tapaSp(carta, sal)`, un hash, junto con lo que dice que es. Si alguien
   duda, la pantalla del acusado destapa sola la carta prometida
   (`{t:"revela", c, s}`) — solo este navegador puede y la mesa entera lo
   espera —, igual que la llave del arranque y la semilla del final.

   Mismo latido (LATIDO_MS) y mismo tope por escritura (ENVIO_MAX) que
   UNO, Flip 7, el cacho y el Presidente, por las mismas razones.
   ============================================================ */
import {
  SP_NOMBRE, SP_MANO, sha256hex, numeroSp, especiaSp, anunciablesSp, verdadSp,
  arrSp, salSp, tapaSp, manoSp, ocultasSp, auditaSpicy
} from "./motor.js";
import { suena } from "./sonido.js";

const LATIDO_MS = 2000;
const ENVIO_MAX = 12000;
const REENVIO_MS = 8000;
const ESPERA_SEMILLAS = 6000;
/* Cuánto dura la ventana para dudar de la última carta antes de aceptarla sola. */
const ACEPTA_AUTO = 15000;
const SALTO = { turno: 30000, ultima: 25000 };

const ICONO = { a: "🌶", w: "🍃", p: "⚫" };
const COLOR = { a: "#e2412b", w: "#5dac3a", p: "#6b4a2b" };

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Una carta de Spicy. Sin código, el dorso. */
export function naipeSp(c, cls = "") {
  if (c == null) return `<span class="jg-un-c jg-sp-c dorso ${cls}"><b class="ov"><em>🌶</em></b></span>`;
  if (c === "CE") return `<span class="jg-un-c jg-sp-c comodin ${cls}" title="Comodín de especia: vale por cualquier especia"><i class="esq">?</i><b class="ov"><em>🌶🍃⚫</em></b><i class="esq b">?</i></span>`;
  if (c === "CN") return `<span class="jg-un-c jg-sp-c comodin num ${cls}" title="Comodín de número: vale por cualquier número"><i class="esq">★</i><b class="ov"><em>1‑10</em></b><i class="esq b">★</i></span>`;
  const n = numeroSp(c), e = especiaSp(c);
  return `<span class="jg-un-c jg-sp-c ${cls}" style="--sp:${COLOR[e]}" title="${n} de ${SP_NOMBRE[e]}"><i class="esq">${n}</i><b class="ov"><em>${ICONO[e]}</em></b><i class="esq b">${n}</i></span>`;
}
const anuncio = (num, esp) => `${num} ${ICONO[esp] || ""}`;

export function crearSpicy(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;
  let host = null, muerto = false, p = null, est = null;
  let sec = null, secPedido = false, secListo = false, secOk = null;
  let enviando = false, enviandoT = 0, latido = 0, relojFin = 0, finVisto = 0;
  let esperaFirma = "", esperaDesde = 0, histPrev = -1, primera = true;
  let sel = null, selFirma = "", manoMemo = null, tramposos = [], ocultas = [], audFirma = "";
  let ultimaFirma = "", ultimaDesde = 0;
  const hechos = new Map(), firmas = {}, temporizadores = new Set();

  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = id => host && host.querySelector("#" + id);

  function montar(el) {
    host = el;
    host.innerHTML = `<div class="jg-uno jg-pr jg-sp">
      <div class="jg-barra"><div class="jg-fase" id="spFase"></div><div class="jg-grow"></div><div class="jg-un-modo" id="spModo"></div></div>
      <div id="spTrampa"></div>
      <div class="jg-un-escena">
        <div class="jg-un-sala" id="spSala">
          <div class="jg-un-fieltro"><i class="jg-un-aura"></i><div class="jg-un-mesa jg-pr-mesa" id="spMesa"></div></div>
          <div class="jg-un-asientos" id="spAsientos"></div>
        </div>
        <div class="jg-un-mano" id="spMano"></div>
        <div class="jg-pie jg-un-pie" id="spPie"></div>
      </div>
      <div class="jg-pr-marcador" id="spMarcador"></div>
      <div class="jg-un-hist" id="spHist"></div>
    </div>`;
    host.addEventListener("click", alClic);
    document.addEventListener("visibilitychange", alVolver);
    latido = setInterval(late, LATIDO_MS);
    pideSecreto();
  }

  function destruir() {
    muerto = true;
    clearInterval(latido); clearTimeout(relojFin);
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
      .then(() => { secListo = true; secOk = null; if (!muerto && est) actualizar(p, est); });
  }

  /* ---------- quién es quién ---------- */
  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const s = nombre(u); return s.charAt(0).toUpperCase() + s.slice(1); };
  const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
  const nc = n => n === 1 ? "una carta" : n + " cartas";
  const juego = () => !ctx.mirando && !!jugador(uid) && !est.fuera[uid] && est.fase === "jugando";

  /* Mi semilla, comprobada contra la promesa de mi ficha. */
  function miSec() {
    if (secOk !== null) return secOk;
    if (!secListo) return null;
    const f = jugador(uid);
    if (!f || !f.hcad || !sec || sec.sem == null) return (secOk = false);
    return (secOk = sha256hex(arrSp(sec.sem, sec.sal || "")) === f.hcad ? sec : false);
  }
  function mia() {
    const s = miSec();
    if (!s || !est.mezcla) return null;
    const k = est.nmov + ":" + est.ops.length;
    if (manoMemo && manoMemo.k === k) return manoMemo.v;
    let v = null;
    try { v = manoSp(est, uid, { sem: s.sem, sal: s.sal || "" }); } catch (e) { console.warn("[spicy]", e); }
    manoMemo = { k, v };
    return v;
  }

  /* A quién espera la mesa ahora (para el aviso y el salto). */
  function esperaA() {
    const e = est.espera;
    if (est.fase !== "jugando" || !e) return null;
    if (e.k === "turno") return { u: e.uid, que: "turno" };
    if (e.k === "ultima") { const u = est.debe.find(x => x !== uid); return u ? { u, que: "ultima" } : null; }
    return null;
  }
  const puedoDudar = () => {
    const t = est.tope, e = est.espera;
    return juego() && est.etapa === "juego" && t && t.uid !== uid && !est.fuera[t.uid] && !(e && e.k === "revela");
  };

  /* ---------- lo que manda la pantalla sola ---------- */
  function conTope(promesa) {
    let t;
    return Promise.race([promesa, new Promise((_, no) => { t = setTimeout(() => no(new Error("la jugada no vuelve")), ENVIO_MAX); })])
      .finally(() => clearTimeout(t));
  }
  async function manda(j) {
    if (enviando) return;
    enviando = true; enviandoT = Date.now(); pinta();
    try { await conTope(jugar(j)); } catch (err) { console.warn("[spicy]", err); }
    finally { enviando = false; sel = null; if (est) pinta(); }
  }
  function automata(clave, j) {
    const t = hechos.get(clave);
    if (t && Date.now() - t < REENVIO_MS) return;
    hechos.set(clave, Date.now());
    const reintenta = () => { if (!muerto && hechos.get(clave)) { hechos.delete(clave); luego(automatismos, 1500); } };
    conTope(jugar(j)).then(ok => { if (!ok) reintenta(); }).catch(err => { console.warn("[spicy]", err); reintenta(); });
  }

  function automatismos() {
    if (!est || ctx.mirando || !jugador(uid) || est.fuera[uid]) return;
    const s = miSec();
    if (!s) return;
    if (est.fase === "fin") {
      if (!est.semillas[uid]) automata("s", { t: "s", uid, sem: s.sem, sal: s.sal || "" });
      return;
    }
    if (est.fase !== "jugando") return;
    const e = est.espera;
    if (est.etapa === "arranque") {
      if (e && e.faltan.includes(uid)) automata("k", { t: "k", uid, c: arrSp(s.sem, s.sal || "") });
      return;
    }
    if (e && e.k === "revela" && e.uid === uid) {
      const m = mia(), c = m && m.tapadas[e.n];
      if (c) automata("r" + e.id, { t: "revela", uid, c, s: salSp(s.sem, s.sal || "", e.n) });
      return;
    }
    /* La última carta de otro: si nadie duda, se acepta sola al rato. */
    if (e && e.k === "ultima" && e.uid !== uid && est.debe.includes(uid)) {
      const f = "u" + e.id;
      if (f !== ultimaFirma) { ultimaFirma = f; ultimaDesde = Date.now(); }
      else if (Date.now() - ultimaDesde > ACEPTA_AUTO) automata(f, { t: "acepta", uid, c: e.id });
    }
  }

  /* ---------- pintar ---------- */
  function pinta() {
    if (!host || !est) return;
    pintaCabeza(); pintaAsientos(); pintaMesa(); pintaMano(); pintaPie(); pintaMarcador(); pintaHist(); pintaTrampa();
  }
  const pon = (id, html) => { const el = $(id); if (el && firmas[id] !== html) { firmas[id] = html; el.innerHTML = html; } };

  function pintaCabeza() {
    const e = est.espera;
    let f;
    if (est.fase === "fin") f = est.ganador ? "Fin · gana " + nombre(est.ganador) : "Fin · empate";
    else if (est.fase !== "jugando") f = "Esperando jugadores";
    else if (est.etapa === "arranque") f = "Barajando los mazos…";
    else if (e && e.k === "revela") f = Nombre(e.dudon) + " duda de " + nombre(e.uid) + ": se destapa";
    else if (e && e.k === "ultima") f = e.uid === uid ? "Tu última carta: ¿alguien duda?" : "Última carta de " + nombre(e.uid) + ": ¿dudas?";
    else f = est.turno === uid ? "Tu turno" : "Turno de " + nombre(est.turno);
    pon("spFase", esc(f));
    const quedan = Math.max(0, est.limite - est.robos);
    pon("spModo", esc(`🏆 ${est.libres} trofeo${est.libres === 1 ? "" : "s"} · 🌍 quedan ${quedan} por robar`));
  }

  function sentados() {
    const base = est.jugadores.map(j => j.uid);
    const i = base.indexOf(uid);
    return i < 0 ? base : [...base.slice(i), ...base.slice(0, i)];
  }

  function pintaAsientos() {
    const us = sentados(), N = us.length, e = est.espera;
    let h = "";
    us.forEach((u, k) => {
      const a = (90 + k * 360 / Math.max(1, N)) * Math.PI / 180;
      const x = (50 + 50 * Math.cos(a)).toFixed(1), y = (50 + 50 * Math.sin(a)).toFixed(1);
      const j = jugador(u) || {}, n = est.cartas[u] || 0;
      const piensa = est.debe.includes(u);
      const cls = ["jg-un-asiento", u === uid && "yo", piensa && "turno", est.ganador === u && "gana", est.fuera[u] && "fuera"].filter(Boolean).join(" ");
      const foto = j.foto && /^(https?:|data:image\/)/.test(j.foto) ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
      const marcas = [];
      if (est.trofeos[u]) marcas.push(`<span class="jg-un-marca jg-pr-rol">${"🏆".repeat(est.trofeos[u])}</span>`);
      if (est.ganadas[u]) marcas.push(`<span class="jg-un-marca">${est.ganadas[u]} ganadas</span>`);
      if (e && e.k === "ultima" && e.uid === u) marcas.push(`<span class="jg-un-marca">¡última!</span>`);
      if (e && e.k === "ultima" && e.ok && e.ok[u]) marcas.push(`<span class="jg-un-marca">acepta</span>`);
      const na = Math.min(12, n);
      h += `<div class="${cls}" data-asiento="${esc(u)}" style="--c:${esc(j.color || "#888")};--x:${x}%;--y:${y}%">
        ${u === uid ? "" : `<div class="jg-un-abanico" style="--n:${na}">${Array.from({ length: na }, (_, i) => `<i style="--k:${i}"></i>`).join("")}</div>`}
        <div class="jg-un-placa">${ctx.avatar ? `<span class="jg-un-ava jg-con-marco">${ctx.avatar(j, 28)}</span>` : `<span class="jg-un-ava">${foto}</span>`}<span class="jg-un-nom">${esc(u === uid ? "Tú" : j.nombre || "?")}</span><b class="jg-un-n">${est.etapa === "juego" ? n : ""}</b>
        ${piensa ? `<span class="jg-un-piensa"><i></i><i></i><i></i></span>` : ""}</div>
        <div class="jg-un-marcas">${marcas.join("")}</div></div>`;
    });
    const el = $("spAsientos");
    if (el) el.dataset.n = N;
    pon("spAsientos", h);
  }

  /* El último destape, mientras nadie haya jugado encima. */
  function destape() {
    for (let i = est.hist.length - 1; i >= 0; i--) {
      const e = est.hist[i];
      if (e.e === "destapa") return e;
      if (e.e === "juega" || e.e === "empieza") return null;
    }
    return null;
  }

  function pintaMesa() {
    let h;
    if (est.fase === "fin") {
      const orden = Object.keys(est.puntos).sort((a, b) => est.puntos[b] - est.puntos[a]);
      const por = { trofeos: "por dos trofeos", mundo: "por el Fin del Mundo", abandono: "porque los demás se fueron", empate: "" }[est.motivo] || "";
      h = `<div class="jg-pr-info"><b>${est.ganador ? esc(Nombre(est.ganador)) + " gana " + por : "Empate en lo más alto"}</b>${orden.slice(0, 3).map((u, i) => `<span>${["🥇", "🥈", "🥉"][i]} ${esc(Nombre(u))} · ${est.puntos[u]} pts</span>`).join("")}</div>`;
    } else if (est.etapa !== "juego") {
      h = `<div class="jg-un-baraja">${naipeSp(null)}${naipeSp(null)}</div><div class="jg-pr-info"><b>Preparando la mesa</b><span>Cada uno recibe ${SP_MANO} cartas en cuanto estén todos.</span></div>`;
    } else {
      const t = est.tope, n = est.pila.length, d = destape();
      h = "";
      if (d) {
        const gana = d.gana === uid ? "te llevas" : Nombre(d.gana) + " se lleva";
        h += `<div class="jg-sp-destape ${d.verdad ? "verdad" : "mentira"}">${naipeSp(d.c || null, "jg-pr-nueva")}<div class="jg-pr-info"><b>${d.c ? (d.verdad ? "¡Era verdad!" : "¡Mentira!") : "Sin destapar"}</b><span>Decía ${anuncio(d.num, d.esp)} · ${esc(gana)} ${nc(d.n)}</span></div></div>`;
      }
      if (t) {
        h += `<div class="jg-sp-pila" style="--n:${Math.min(6, n)}">${Array.from({ length: Math.min(6, n) }, (_, i) => naipeSp(null, i === Math.min(6, n) - 1 ? "jg-pr-nueva" : "mini")).join("")}</div>
          <div class="jg-sp-dice" style="--sp:${COLOR[t.esp]}"><small>${esc(Nombre(t.uid))} dice</small><b>${t.num}</b><em>${ICONO[t.esp]} ${SP_NOMBRE[t.esp]}</em></div>
          <div class="jg-pr-info"><span>Pila: ${nc(n)}</span></div>`;
      } else if (!d) {
        h += `<div class="jg-pr-info"><b>Pila vacía</b><span>${est.turno === uid ? "Abres tú: del 1 al 3, de la especia que quieras" : esc(Nombre(est.turno)) + " abre"}</span></div>`;
      }
    }
    pon("spMesa", h);
  }

  function pintaMano() {
    const m = mia(), el = $("spMano");
    if (!el) return;
    if (!m) {
      const txt = ctx.mirando || !jugador(uid) || est.etapa !== "juego" ? "" : miSec() === false ? "Tu semilla no está en este navegador: no se puede ver tu mano." : "";
      pon("spMano", txt ? `<div class="jg-nota">${esc(txt)}</div>` : "");
      return;
    }
    const f = est.nmov + ":" + m.mano.length;
    if (f !== selFirma) { selFirma = f; if (sel != null && !(sel < m.mano.length)) sel = null; }
    const mano = m.mano, n = mano.length;
    const puedo = juego() && !!est.espera && est.espera.k === "turno" && est.turno === uid;
    const W = Math.min(900, (host.clientWidth || 700) - 20), cw = W < 520 ? 50 : 62;
    const g = n > 1 ? Math.max(-0.76 * cw, Math.min(8, (Math.max(120, W - 40) - n * cw) / (n - 1))) : 0;
    const paso = Math.min(5, 48 / Math.max(1, n));
    let h = `<div class="jg-un-mano-t"><b>Tu mano</b> <span>${nc(n)}</span></div><div class="jg-un-cartas" style="--n:${n}">`;
    mano.forEach((c, i) => {
      const r = (i - (n - 1) / 2) * paso, y = 420 * (1 - Math.cos(r * Math.PI / 180));
      const cls = ["jg-un-hueco", sel === i ? "sel" : puedo ? "ok" : ""].filter(Boolean).join(" ");
      h += `<button class="${cls}" data-carta="${i}" ${puedo ? "" : "disabled"} style="--r:${r.toFixed(2)}deg;--y:${y.toFixed(1)}px;margin-left:${i ? g.toFixed(1) : 0}px;z-index:${i + 1}">${naipeSp(c)}</button>`;
    });
    pon("spMano", h + "</div>");
  }

  function pintaPie() {
    let h = "";
    const e = est.espera, t = est.tope;
    if (juego() && est.etapa === "juego" && est.turno === uid && e && e.k === "turno") {
      const m = mia(), c = m && sel != null ? m.mano[sel] : null;
      const opciones = anunciablesSp(t);
      if (c == null) {
        h += `<div class="jg-un-panel"><div class="jg-nota">${t ? `Hay que jugar un número mayor que ${t.num} de ${SP_NOMBRE[t.esp]}${t.num === 10 ? " (tras el 10 se vuelve a empezar del 1 al 3)" : ""}.` : "Abres la pila: di un 1, 2 o 3 de la especia que quieras."} Toca una carta de tu mano y luego di qué es — puedes mentir.</div>
          <div class="jg-un-fila"><button class="jg-un-boton suave" id="spPasa" ${enviando ? "disabled" : ""}>Paso (robo una)</button></div></div>`;
      } else {
        h += `<div class="jg-un-panel"><div class="jg-nota">¿Qué dices que es? Las marcadas en verde son verdad.</div><div class="jg-un-fila jg-sp-anuncios">` +
          opciones.map(o => {
            const v = verdadSp(c, o.num, o.esp, "num") && verdadSp(c, o.num, o.esp, "esp");
            return `<button class="jg-un-boton ${v ? "sel" : "suave"}" data-num="${o.num}" data-esp="${o.esp}" ${enviando ? "disabled" : ""} style="--sp:${COLOR[o.esp]}">${anuncio(o.num, o.esp)}</button>`;
          }).join("") +
          `</div><div class="jg-un-fila"><button class="jg-un-boton suave" id="spOtra">Otra carta</button><button class="jg-un-boton suave" id="spPasa" ${enviando ? "disabled" : ""}>Paso (robo una)</button></div></div>`;
      }
    }
    if (puedoDudar()) {
      const ult = e && e.k === "ultima" && e.id === t.id;
      h += `<div class="jg-un-panel"><div class="jg-nota">${esc(Nombre(t.uid))} dice ${anuncio(t.num, t.esp)}.${ult ? " Es su última carta: si nadie duda, se lleva un trofeo." : ""} ¿Mentira? Si dudas y aciertas, te llevas la pila; si fallas, robas dos.</div><div class="jg-un-fila">
        <button class="jg-un-boton malo" data-duda="num" ${enviando ? "disabled" : ""}>Dudar del número</button>
        <button class="jg-un-boton malo" data-duda="esp" ${enviando ? "disabled" : ""}>Dudar de la especia</button>
        ${ult && est.debe.includes(uid) ? `<button class="jg-un-boton" id="spAcepta" ${enviando ? "disabled" : ""}>Aceptar</button>` : ""}
      </div></div>`;
    }
    const w = esperaA();
    if (w && w.u !== uid && juego()) {
      const f = w.que + ":" + w.u + ":" + est.nmov;
      if (f !== esperaFirma) { esperaFirma = f; esperaDesde = Date.now(); }
      if (Date.now() - esperaDesde > (SALTO[w.que] || 30000))
        h += `<div class="jg-un-fila"><span class="jg-nota">Se está esperando a ${esc(nombre(w.u))}.</span><button class="jg-un-boton malo" data-salta="${esc(w.u)}">Saltarle</button></div>`;
    }
    pon("spPie", h);
  }

  function pintaMarcador() {
    const us = Object.keys(est.puntos).sort((a, b) => est.puntos[b] - est.puntos[a]);
    const pct = Math.min(100, Math.round(100 * est.robos / Math.max(1, est.limite)));
    pon("spMarcador", `<div class="jg-un-hist-t">Puntos · 🌍 Fin del Mundo al ${pct} %</div>` + us.map(u =>
      `<div class="jg-pr-punto${est.fuera[u] ? " ido" : ""}"><span>${"🏆".repeat(est.trofeos[u] || 0)} ${esc(Nombre(u))}</span><b title="${est.ganadas[u]} ganadas + ${10 * est.trofeos[u]} por trofeos − ${est.cartas[u]} en mano">${est.puntos[u]}</b></div>`).join(""));
  }

  function texto(e) {
    const a = u => u === uid ? "ti" : nombre(u);
    switch (e.e) {
      case "empieza": return verbo(e.uid, "Abres tú", "abre");
      case "juega": return verbo(e.uid, "Juegas", "juega") + " «" + e.num + " de " + SP_NOMBRE[e.esp] + "»" + (e.ultima ? " — ¡su última!" : "");
      case "pasa": return verbo(e.uid, "Pasas", "pasa");
      case "roba": return e.por === "pasa" ? "" : verbo(e.uid, "Robas", "roba") + " " + nc(e.n);
      case "duda": return verbo(e.uid, "Dudas", "duda") + (e.que === "num" ? " del número" : " de la especia") + " de " + a(e.a);
      case "destapa": return (e.verdad ? "Era verdad" : "Era mentira") + (e.c ? ": " + (e.c === "CE" ? "comodín de especia" : e.c === "CN" ? "comodín de número" : numeroSp(e.c) + " de " + SP_NOMBRE[especiaSp(e.c)]) : "") + " · " + verbo(e.gana, "te llevas", "se lleva") + " " + nc(e.n);
      case "trofeo": return verbo(e.uid, "Ganas", "gana") + " un trofeo 🏆";
      case "limpia": return "Nadie duda de la última carta de " + a(e.uid);
      case "salta": return Nombre(e.por) + " salta a " + a(e.uid);
      case "mundo": return "🌍 ¡Fin del Mundo!";
      case "gana": return e.uid ? verbo(e.uid, "Ganas la partida", "gana la partida") : "Empate";
      case "abandona": return verbo(e.uid, "Te vas", e.expulsado ? "es expulsado" : "se va");
      case "falsa": return verbo(e.uid, "Tu llave no cuadra", "manda algo que no cuadra");
      default: return "";
    }
  }
  function pintaHist() {
    const hs = est.hist.slice(-12).reverse().map(e => texto(e) && `<div class="jg-un-h h-${esc(e.e)}">${esc(texto(e))}</div>`).filter(Boolean);
    pon("spHist", `<div class="jg-un-hist-t">Lo último</div>${hs.join("")}`);
  }

  function pintaTrampa() {
    let h = "";
    for (const t of tramposos) h += `<div class="jg-trampa">⚠ ${esc(Nombre(t.uid))} ${t.que === "carta" ? "jugó una carta que no tenía" : "reveló una semilla que no es la suya"}.</div>`;
    for (const f of est.falsas || []) h += `<div class="jg-trampa">⚠ ${esc(Nombre(f.uid))} ${f.que === "llave" ? "mandó una llave que no encaja" : "destapó una carta que no es la que jugó"}: se le puede echar con ⏏.</div>`;
    if (est.fase === "fin" && ocultas.length) h += `<div class="jg-nota">No revelaron su semilla: ${ocultas.map(u => esc(Nombre(u))).join(", ")}.</div>`;
    pon("spTrampa", h);
  }

  /* ---------- clics ---------- */
  function alClic(ev) {
    const b = ev.target.closest("button");
    if (!b || b.disabled || enviando || !est) return;
    if (b.dataset.salta) {
      const e = est.espera;
      manda(e && e.k === "ultima" ? { t: "salta", uid, a: b.dataset.salta, c: e.id } : { t: "salta", uid, a: b.dataset.salta });
      return;
    }
    if (!juego()) return;
    if (b.dataset.duda && est.tope) { suena("golpe"); manda({ t: "duda", uid, c: est.tope.id, que: b.dataset.duda }); return; }
    if (b.id === "spAcepta" && est.espera && est.espera.k === "ultima") { manda({ t: "acepta", uid, c: est.espera.id }); return; }
    if (b.id === "spPasa") { manda({ t: "pasa", uid }); return; }
    if (b.id === "spOtra") { sel = null; firmas.spMano = firmas.spPie = ""; pintaMano(); pintaPie(); return; }
    if (b.dataset.carta != null) {
      const i = +b.dataset.carta;
      sel = sel === i ? null : i;
      suena("clic"); firmas.spMano = firmas.spPie = ""; pintaMano(); pintaPie(); return;
    }
    if (b.dataset.num) {
      const m = mia(), s = miSec(), c = m && sel != null ? m.mano[sel] : null;
      if (c == null || !s) return;
      const h = tapaSp(c, salSp(s.sem, s.sal || "", ocultasSp(est, uid)));
      manda({ t: "juega", uid, h, num: +b.dataset.num, esp: b.dataset.esp });
    }
  }

  /* ---------- latido, fin y auditoría ---------- */
  function late() {
    if (!est || muerto) return;
    if (enviando && Date.now() - enviandoT > ENVIO_MAX + 2000) enviando = false;
    if (!sec && secListo && !ctx.mirando) { secPedido = false; secListo = false; pideSecreto(); }
    if (est.fase === "jugando") { automatismos(); firmas.spPie = ""; pintaPie(); }
    else if (est.fase === "fin") cierre();
  }
  function alVolver() { if (!document.hidden && est) { automatismos(); pinta(); if (est.fase === "fin") listo(); } }
  function listo() { if (!document.hidden && ctx.listo) ctx.listo(); }

  function cierre() {
    if (muerto || !est || est.fase !== "fin") return;
    if (!finVisto) finVisto = Date.now();
    automatismos();
    if (ctx.mirando || !jugador(uid)) return;
    const faltan = est.jugadores.some(j => !est.fuera[j.uid] && !est.semillas[j.uid]);
    if (!(p.fin && p.fin.at) && (!faltan || Date.now() - finVisto > ESPERA_SEMILLAS))
      Promise.resolve().then(() => {
        if (!muerto && est && est.fase === "fin" && !(p.fin && p.fin.at)) return terminar(est.ganador, est.motivo);
      }).catch(() => {});
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    if (est.fase !== "fin") return;
    const f = Object.keys(est.semillas).length + ":" + est.nmov;
    if (f === audFirma) return;
    audFirma = f;
    try {
      const r = await auditaSpicy(p, est);
      if (muerto) return;
      tramposos = r.filter(x => x.que !== "oculta");
      ocultas = [...new Set(r.filter(x => x.que === "oculta").map(x => x.uid))];
      firmas.spTrampa = "";
      pintaTrampa();
    } catch (e) { console.warn("[spicy] auditoría", e); }
  }

  function sonido(nuevos) {
    if (!nuevos.length || document.hidden) return;
    const hay = e => nuevos.find(x => x.e === e);
    const g = hay("gana");
    if (g) { suena(g.uid === uid ? "gana" : g.tops && g.tops.includes(uid) ? "ficha" : "pierde"); return; }
    const d = hay("destapa");
    if (d) { suena(d.gana === uid ? "planta" : "golpe"); return; }
    for (const [e, s] of [["trofeo", "gana"], ["mundo", "golpe"], ["duda", "golpe"], ["juega", "carta"], ["pasa", "madera"], ["empieza", "reparte"], ["salta", "golpe"]])
      if (hay(e)) { suena(s); return; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (est.fase !== "fin") { clearTimeout(relojFin); relojFin = 0; finVisto = 0; }
    if (!host) return;
    const ult = est.hist.length ? est.hist[est.hist.length - 1].i : -1;
    const nuevos = primera ? [] : est.hist.filter(e => e.i > histPrev).slice(-16);
    histPrev = ult;
    if (!primera) {
      sonido(nuevos);
      if (est.debe.includes(uid) && nuevos.length && document.hidden) luego(() => suena("turno"), 250);
    }
    primera = false;
    pinta();
    automatismos();
    audita();
    if (est.fase === "fin") { listo(); if (!(p.fin && p.fin.at)) cierre(); }
  }

  return { montar, actualizar, destruir, ocupado: () => false };
}
