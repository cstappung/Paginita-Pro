/* ============================================================
   Presidente — la pantalla. Todo lo decide `redPresidente` en motor.js;
   aquí solo se pinta y se manda.

   Buena parte de lo que pasa en la mesa lo manda la pantalla sola,
   porque solo este navegador puede mandarlo y la mesa entera lo espera:
   la llave de cada ronda acabada, el turno de barajar y el de quitar el
   candado en el reparto, las mejores cartas que el Culo y el Viceculo
   *deben* dar (no hay nada que decidir) y el «paso» cuando no se tiene
   con qué superar la mesa. Lo que sí es una decisión — qué jugar, qué
   devolver, levantarse, votar el final — espera al jugador.

   Mismo latido (LATIDO_MS) y mismo tope por escritura (ENVIO_MAX) que
   UNO, Flip 7 y el cacho, por las mismas razones: un temporizador
   perdido o una escritura sin red no pueden dejar la mesa parada.
   ============================================================ */
import {
  PR_CADENA, PR_RANGOS, PR_PALOS, PR_ROLES, rangoPr, paloPr, nombreCartaPr,
  barajaPr, llavesPr, mezclaPr, quitaPr, secretoPr, idSobrePr, sobrePr,
  ordenaPr, mejoresPr, cadenaPr, llavePr, manoPr, auditaPresidente
} from "./motor.js";
import { suena } from "./sonido.js";

const LATIDO_MS = 2000;
const ENVIO_MAX = 12000;
const REENVIO_MS = 8000;
const ESPERA_LLAVES = 6000;
const ESPERA_INICIO = 4000;
const DEVUELVE_AUTO = 40000;
const AUTOPASA = 1500;
/* Cuánto se espera a alguien dormido antes de ofrecer saltarlo. */
const SALTO = { reparto: 12000, da: 12000, devuelve: 50000, juego: 30000 };
const ICONO_ROL = { pres: "👑", vice: "🎩", pueblo: "", vculo: "🧹", culo: "💩" };

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Una carta francesa: blanca, con el palo en rojo o negro. */
export function cartaPr(id, cls = "") {
  if (id == null) return `<span class="jg-un-c jg-pr-c dorso ${cls}"><b class="ov"><em>♛</em></b></span>`;
  const r = PR_RANGOS[rangoPr(id)], s = PR_PALOS[paloPr(id)], roja = paloPr(id) === 1 || paloPr(id) === 2;
  return `<span class="jg-un-c jg-pr-c${roja ? " roja" : ""} ${cls}" title="${esc(nombreCartaPr(id))}">` +
    `<i class="esq">${r}<s>${s}</s></i><b class="ov"><em>${s}</em></b><i class="esq b">${r}<s>${s}</s></i></span>`;
}

export function crearPresidente(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;
  let host = null, muerto = false, p = null, est = null;
  let sec = null, secPedido = false, secListo = false, cad = null;
  let enviando = false, enviandoT = 0, latido = 0, relojFin = 0, finVisto = 0;
  let esperaFirma = "", esperaDesde = 0, arranqueDesde = 0, histPrev = -1, primera = true;
  let sel = [], selFirma = "", manoMemo = null, tramposos = [], audFirma = "", ocultas = [];
  const hechos = new Map(), hechasAud = {}, firmas = {}, temporizadores = new Set();

  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = id => host && host.querySelector("#" + id);

  function montar(el) {
    host = el;
    host.innerHTML = `<div class="jg-uno jg-pr">
      <div class="jg-barra"><div class="jg-fase" id="prFase"></div><div class="jg-grow"></div><div class="jg-un-modo" id="prModo"></div></div>
      <div id="prTrampa"></div>
      <div class="jg-un-escena">
        <div class="jg-un-sala" id="prSala">
          <div class="jg-un-fieltro"><i class="jg-un-aura"></i><div class="jg-un-mesa jg-pr-mesa" id="prMesa"></div></div>
          <div class="jg-un-asientos" id="prAsientos"></div>
        </div>
        <div class="jg-un-mano" id="prMano"></div>
        <div class="jg-pie jg-un-pie" id="prPie"></div>
      </div>
      <div class="jg-pr-control" id="prControl"></div>
      <div class="jg-pr-marcador" id="prMarcador"></div>
      <div class="jg-un-hist" id="prHist"></div>
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
      .then(() => { secListo = true; cad = null; if (!muerto && est) actualizar(p, est); });
  }

  /* ---------- quién es quién ---------- */
  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const s = nombre(u); return s.charAt(0).toUpperCase() + s.slice(1); };
  const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
  const nc = n => n === 1 ? "una carta" : n + " cartas";
  const juego = () => !ctx.mirando && !!jugador(uid) && !est.fuera[uid] && est.fase === "jugando";
  const enRonda = u => !!(est.R && est.R.orden.includes(u) && !est.R.idos[u]);
  const tope = () => est.R && est.R.D > 52 ? 8 : 4;

  /* Mi cadena de llaves, comprobada contra la promesa de mi ficha. */
  function miCad() {
    if (cad !== null) return cad;
    if (!secListo) return null;
    const f = jugador(uid);
    if (!f || !f.hcad || !sec || sec.sem == null) return (cad = false);
    const c = cadenaPr(sec.sem, sec.sal || "");
    return (cad = c[PR_CADENA] === f.hcad ? c : false);
  }

  function mia() {
    const c = miCad();
    if (!c || !est.R || !est.R.orden.includes(uid) || est.etapa === "reparto") return null;
    const k = est.rep + ":" + est.nmov;
    if (manoMemo && manoMemo.k === k) return manoMemo.v;
    let v = null;
    try { v = manoPr(est, uid, c); } catch (e) { console.warn("[presidente]", e); }
    manoMemo = { k, v };
    return v;
  }

  const miCambio = () => {
    if (est.etapa !== "cambio") return null;
    return est.R.cambios.find(c => c.de === uid && !c.hecho && !c.anulado) || null;
  };
  const devuelvoYa = c => c && c.tipo === "devuelve" &&
    est.R.cambios.some(x => x.tipo === "da" && x.de === c.a && x.a === uid && x.hecho);

  /* A quién espera la mesa ahora, y por qué (para el aviso y el salto). */
  function esperaA() {
    if (est.fase !== "jugando" || !est.R) return null;
    if (est.etapa === "reparto") return { u: est.reparto.uid, que: "reparto" };
    if (est.etapa === "juego") return { u: est.turno, que: "juego" };
    if (est.etapa === "cambio") {
      const c = est.R.cambios.find(c => !c.hecho && !c.anulado && c.tipo === "da") ||
        est.R.cambios.find(c => !c.hecho && !c.anulado && est.debe.includes(c.de));
      return c ? { u: c.de, que: c.tipo } : null;
    }
    return null;
  }

  /* Lo que se puede jugar sobre la mesa con esta mano. */
  function sirve(c, mano) {
    const m = est.mesa;
    if (!m) return true;
    const r = rangoPr(c);
    return r > m.r && mano.filter(x => rangoPr(x) === r).length >= m.n;
  }

  /* ---------- lo que manda la pantalla sola ---------- */
  function conTope(promesa) {
    let t;
    return Promise.race([promesa, new Promise((_, no) => { t = setTimeout(() => no(new Error("la jugada no vuelve")), ENVIO_MAX); })])
      .finally(() => clearTimeout(t));
  }
  async function manda(j) {
    if (enviando) return;
    enviando = true; enviandoT = Date.now(); pinta();
    try { await conTope(jugar(j)); } catch (err) { console.warn("[presidente]", err); }
    finally { enviando = false; sel = []; if (est) pinta(); }
  }
  function automata(clave, j) {
    const t = hechos.get(clave);
    if (t && Date.now() - t < REENVIO_MS) return;
    hechos.set(clave, Date.now());
    const reintenta = () => { if (!muerto && hechos.get(clave)) { hechos.delete(clave); luego(automatismos, 1500); } };
    conTope(jugar(j)).then(ok => { if (!ok) reintenta(); }).catch(err => { console.warn("[presidente]", err); reintenta(); });
  }

  /* Las llaves de las rondas acabadas que me faltan por revelar. */
  function llavesDebidas(u, c) {
    const acabadas = est.fase === "fin" && est.R && est.R.qui.length === est.R.n ? [...est.rondas, est.R] : est.rondas;
    const out = [];
    for (const r of acabadas) {
      if (!r.orden.includes(u) || (est.llaves[r.rep] || {})[u]) continue;
      out.push(c ? { t: "llave", uid: u, i: r.rep, c: c[PR_CADENA - 1 - (r.rep - est.desde[u])] } : r.rep);
    }
    return out;
  }

  function automatismos() {
    if (!est || ctx.mirando || !jugador(uid) || est.fuera[uid]) return;
    const c = miCad();
    if (c) for (const j of llavesDebidas(uid, c)) automata("l" + j.i, j);
    if (est.fase !== "jugando") return;
    if (est.etapa === "arranque") {
      if (!arranqueDesde) arranqueDesde = Date.now();
      if (p.anfitrion === uid || Date.now() - arranqueDesde > ESPERA_INICIO)
        automata("i", { t: "inicio", uid, q: est.jugadores.filter(j => !est.fuera[j.uid]).map(j => j.uid) });
      return;
    }
    if (!est.conocido[uid]) { automata("e", { t: "entra", uid }); return; }
    if (!c || !est.R) return;
    const X = est.R;
    if (est.etapa === "reparto" && est.reparto.uid === uid) {
      const rp = est.reparto, key = llavePr(est, uid, X.rep, c);
      if (rp.paso === "mezcla") {
        const v = mezclaPr(rp.prev || barajaPr(X.D), key, X.D);
        if (v) automata("m" + X.rep + ":" + rp.i, { t: "mezcla", uid, r: X.rep, v, pk: llavesPr(key, X.D).pk });
      } else {
        const v = quitaPr(rp.prev, key, X.D, X.n, X.orden.indexOf(uid));
        if (v) automata("q" + X.rep + ":" + rp.i, { t: "quita", uid, r: X.rep, v });
      }
      return;
    }
    const cb = miCambio();
    if (cb) {
      const m = mia();
      if (!m || m.rota) return;
      if (cb.tipo === "da") daCartas(cb, mejoresPr(m.mano, cb.n));
      else if (devuelvoYa(cb)) {
        const w = firmas.devuelve;
        if (!w || w.k !== X.rep) firmas.devuelve = { k: X.rep, t: Date.now() };
        else if (Date.now() - w.t > DEVUELVE_AUTO) daCartas(cb, ordenaPr(m.mano).slice(0, cb.n));
      }
      return;
    }
    if (est.etapa === "juego" && est.turno === uid && est.mesa) {
      const m = mia();
      if (m && !m.rota && !m.mano.some(x => sirve(x, m.mano))) {
        const k = "p" + X.rep + ":" + est.nmov;
        if (!hechos.has(k)) { hechos.set(k, 0); luego(() => { if (est.turno === uid && est.nmov + "" === k.split(":")[1]) { hechos.delete(k); automata(k, { t: "pasa", uid }); } }, AUTOPASA); }
      }
    }
  }

  function daCartas(cb, cs, aMano) {
    const X = est.R, c = miCad();
    if (!c || !X.pk[cb.a]) return;
    const key = llavePr(est, uid, X.rep, c);
    const j = { t: "da", uid, a: cb.a, v: sobrePr(secretoPr(key, X.pk[cb.a], X.D), idSobrePr(X.rep, uid, cb.a), cs) };
    if (aMano) manda(j); else automata("d" + X.rep + ":" + cb.a, j);
  }

  /* ---------- pintar ---------- */
  function pinta() {
    if (!host || !est) return;
    pintaCabeza(); pintaAsientos(); pintaMesa(); pintaMano(); pintaPie(); pintaControl(); pintaMarcador(); pintaHist(); pintaTrampa();
  }
  const pon = (id, html) => { const el = $(id); if (el && firmas[id] !== html) { firmas[id] = html; el.innerHTML = html; } };

  function pintaCabeza() {
    let f;
    if (est.fase === "fin") f = est.ganador ? "Fin · gana " + nombre(est.ganador) : "Fin de la partida";
    else if (est.etapa === "arranque") f = "Sentándose a la mesa…";
    else if (est.etapa === "espera") f = "Falta gente para repartir";
    else if (est.etapa === "reparto") f = "Barajando: " + nombre(est.reparto.uid);
    else if (est.etapa === "cambio") f = "Cambio de cartas";
    else f = est.turno === uid ? "Tu turno" : "Turno de " + nombre(est.turno);
    pon("prFase", esc(f));
    const n = est.R ? est.R.n : est.plantilla.length;
    pon("prModo", esc(`Ronda ${est.ronda} · ${n} en la mesa${est.R && est.R.D > 52 ? " · dos barajas" : ""}`));
  }

  function sentados() {
    const base = est.R ? est.R.orden : est.plantilla;
    const i = base.indexOf(uid);
    return i < 0 ? base.slice() : [...base.slice(i), ...base.slice(0, i)];
  }

  function pintaAsientos() {
    const us = sentados(), N = us.length, R = est.R;
    let h = "";
    us.forEach((u, k) => {
      const a = (90 + k * 360 / Math.max(1, N)) * Math.PI / 180;
      const x = (50 + 50 * Math.cos(a)).toFixed(1), y = (50 + 50 * Math.sin(a)).toFixed(1);
      const j = jugador(u) || {}, n = (est.mano || {})[u] || 0, rol = est.roles[u];
      const pos = R ? R.salidos.indexOf(u) : -1;
      const cls = ["jg-un-asiento", u === uid && "yo", est.turno === u && "turno", pos === 0 && "gana", (est.fuera[u] || (R && R.idos[u])) && "fuera"].filter(Boolean).join(" ");
      const foto = j.foto && /^(https?:|data:image\/)/.test(j.foto) ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
      const marcas = [];
      if (rol && rol !== "pueblo") marcas.push(`<span class="jg-un-marca jg-pr-rol">${ICONO_ROL[rol]} ${esc(PR_ROLES[rol])}</span>`);
      if (pos >= 0) marcas.push(`<span class="jg-un-marca">Nº ${pos + 1}</span>`);
      else if (R && R.pasados[u] && est.etapa === "juego") marcas.push(`<span class="jg-un-marca">pasó</span>`);
      if (est.saliendo[u]) marcas.push(`<span class="jg-un-marca">se levanta</span>`);
      if (est.cierre.includes(u)) marcas.push(`<span class="jg-un-marca">✋</span>`);
      const na = Math.min(12, n);
      h += `<div class="${cls}" data-asiento="${esc(u)}" style="--c:${esc(j.color || "#888")};--x:${x}%;--y:${y}%">
        ${u === uid ? "" : `<div class="jg-un-abanico" style="--n:${na}">${Array.from({ length: na }, (_, i) => `<i style="--k:${i}"></i>`).join("")}</div>`}
        <div class="jg-un-placa"><span class="jg-un-ava">${foto}</span><span class="jg-un-nom">${esc(u === uid ? "Tú" : j.nombre || "?")}</span><b class="jg-un-n">${R ? n : ""}</b>
        ${est.turno === u ? `<span class="jg-un-piensa"><i></i><i></i><i></i></span>` : ""}</div>
        <div class="jg-un-marcas">${marcas.join("")}</div></div>`;
    });
    const el = $("prAsientos");
    if (el) el.dataset.n = N;
    pon("prAsientos", h);
  }

  /* La baza en juego: los grupos desde la última vez que se limpió. */
  function baza() {
    const out = [];
    for (let i = est.hist.length - 1; i >= 0; i--) {
      const e = est.hist[i];
      if (e.e === "juega") out.unshift(e);
      else if (["limpia", "empieza", "reparto", "repartido", "ronda"].includes(e.e)) break;
      if (out.length >= 4) break;
    }
    return out;
  }

  function pintaMesa() {
    let h;
    if (est.fase === "fin") {
      const orden = Object.keys(est.puntos).sort((a, b) => est.puntos[b] - est.puntos[a]);
      h = `<div class="jg-pr-info"><b>Partida terminada</b>${orden.slice(0, 3).map((u, i) => `<span>${["🥇", "🥈", "🥉"][i]} ${esc(Nombre(u))} · ${est.puntos[u]} pts</span>`).join("")}</div>`;
    } else if (est.etapa === "arranque" || est.etapa === "espera") {
      h = `<div class="jg-pr-info"><b>${est.etapa === "espera" ? "Falta gente" : "Preparando la mesa"}</b><span>${est.etapa === "espera" ? "Hacen falta al menos tres para repartir." : "Se reparte en cuanto estén todos."}</span></div>`;
    } else if (est.etapa === "reparto") {
      const rp = est.reparto, n = est.R.n;
      const paso = (rp.paso === "mezcla" ? 0 : n) + rp.i + 1;
      h = `<div class="jg-un-baraja">${cartaPr(null)}${cartaPr(null)}</div><div class="jg-pr-info"><span>${rp.paso === "mezcla" ? "Baraja" : "Quita su candado"}: <b>${esc(Nombre(rp.uid))}</b></span><span>Paso ${paso} de ${2 * n}</span></div>`;
    } else if (est.etapa === "cambio") {
      h = `<div class="jg-pr-info"><b>Cambio de cartas</b><ul class="jg-pr-cambios">${est.R.cambios.map(c =>
        `<li class="${c.hecho ? "hecho" : c.anulado ? "anulado" : ""}">${esc(Nombre(c.de))} ${c.tipo === "da" ? "da sus " + (c.n === 1 ? "mejor carta" : c.n + " mejores") : "devuelve " + nc(c.n)} a ${esc(nombre(c.a))} ${c.hecho ? "✔" : c.anulado ? "✖" : "…"}</li>`).join("")}</ul></div>`;
    } else {
      const g = baza(), m = est.mesa;
      h = g.length ? `<div class="jg-pr-baza">${g.map((e, i) => `<div class="jg-pr-grupo${i < g.length - 1 ? " vieja" : ""}">${e.c.map(c => cartaPr(c, i === g.length - 1 ? "jg-pr-nueva" : "mini")).join("")}<small>${esc(Nombre(e.uid))}</small></div>`).join("")}</div>`
        : `<div class="jg-pr-info"><b>Mesa limpia</b><span>${est.turno === uid ? "Abres tú: lo que quieras" : esc(Nombre(est.turno)) + " abre"}</span></div>`;
      if (m) h += `<div class="jg-pr-info"><span>Hay que superar ${m.n === 1 ? "un" : m.n} <b>${PR_RANGOS[m.r]}</b>${m.n > 1 ? "" : ""}</span></div>`;
    }
    pon("prMesa", h);
  }

  function pintaMano() {
    const m = mia(), el = $("prMano");
    if (!el) return;
    if (!m) {
      const txt = ctx.mirando || !jugador(uid) ? "" : est.R && est.R.orden.includes(uid) && miCad() === false ? "Tu semilla no está en este navegador: no se puede ver tu mano." : "";
      pon("prMano", txt ? `<div class="jg-nota">${esc(txt)}</div>` : "");
      return;
    }
    if (m.rota) { pon("prMano", `<div class="jg-nota">No se pudo abrir tu mano (algún sobre no cuadra).</div>`); return; }
    const f = [est.rep, est.nmov, est.etapa].join(":");
    if (f !== selFirma) { selFirma = f; sel = sel.filter(c => m.mano.includes(c)); }
    const mano = ordenaPr(m.mano), n = mano.length, cb = miCambio();
    const puedo = est.etapa === "juego" && est.turno === uid;
    const devolver = cb && devuelvoYa(cb);
    const W = Math.min(900, (host.clientWidth || 700) - 20), cw = W < 520 ? 50 : 62;
    const g = n > 1 ? Math.max(-0.76 * cw, Math.min(8, (Math.max(120, W - 40) - n * cw) / (n - 1))) : 0;
    const paso = Math.min(5, 48 / Math.max(1, n));
    let h = `<div class="jg-un-mano-t"><b>Tu mano</b> <span>${nc(n)}${est.roles[uid] ? " · " + ICONO_ROL[est.roles[uid]] + " " + PR_ROLES[est.roles[uid]] : ""}</span></div><div class="jg-un-cartas" style="--n:${n}">`;
    mano.forEach((c, i) => {
      const r = (i - (n - 1) / 2) * paso, y = 420 * (1 - Math.cos(r * Math.PI / 180));
      const ok = (puedo && sirve(c, mano)) || devolver;
      const cls = ["jg-un-hueco", sel.includes(c) ? "sel" : ok ? "ok" : (puedo ? "no" : "")].filter(Boolean).join(" ");
      h += `<button class="${cls}" data-carta="${c}" ${ok ? "" : "disabled"} style="--r:${r.toFixed(2)}deg;--y:${y.toFixed(1)}px;margin-left:${i ? g.toFixed(1) : 0}px;z-index:${i + 1}">${cartaPr(c)}</button>`;
    });
    pon("prMano", h + "</div>");
  }

  function pintaPie() {
    let h = "";
    const w = esperaA();
    const cb = juego() ? miCambio() : null;
    if (juego() && est.etapa === "juego" && est.turno === uid) {
      const m = mia(), mesa = est.mesa;
      const nsel = sel.length;
      const vale = nsel && (!mesa || nsel === mesa.n);
      h += `<div class="jg-un-panel"><div class="jg-un-fila">
        <button class="jg-un-boton grande" id="prJugar" ${vale && !enviando ? "" : "disabled"}>Jugar ${nsel ? nc(nsel) : ""}</button>
        ${mesa ? `<button class="jg-un-boton suave" id="prPasa" ${enviando ? "disabled" : ""}>Paso</button>` : ""}
        ${!mesa && nsel ? `<button class="jg-un-boton suave" id="prTodas">Todas las de ese número</button>` : ""}
      </div><div class="jg-nota">${mesa ? `Toca ${mesa.n === 1 ? "una carta" : mesa.n + " cartas iguales"} mayor${mesa.n > 1 ? "es" : ""} que ${PR_RANGOS[mesa.r]}. El 2 limpia la mesa.` : "Mesa limpia: abre con una o varias cartas del mismo número."}${m && m.mano.length && !m.mano.some(x => sirve(x, m.mano)) ? " No tienes con qué: pasas solo." : ""}</div></div>`;
    } else if (cb && devuelvoYa(cb)) {
      h += `<div class="jg-un-panel"><div class="jg-un-fila"><button class="jg-un-boton grande" id="prDevuelve" ${sel.length === cb.n && !enviando ? "" : "disabled"}>Devolver ${nc(cb.n)} a ${esc(nombre(cb.a))}</button></div>
        <div class="jg-nota">Elige ${nc(cb.n)} de tu mano (las que quieras). Si no eliges, van las más bajas.</div></div>`;
    } else if (cb) {
      h += `<div class="jg-nota">Das tus ${cb.n === 1 ? "mejor carta" : cb.n + " mejores"} a ${esc(nombre(cb.a))}…</div>`;
    }
    if (w && w.u !== uid && juego()) {
      const f = w.que + ":" + w.u + ":" + est.nmov;
      if (f !== esperaFirma) { esperaFirma = f; esperaDesde = Date.now(); }
      const t = SALTO[w.que] || 30000;
      if (Date.now() - esperaDesde > t)
        h += `<div class="jg-un-fila"><span class="jg-nota">Se está esperando a ${esc(nombre(w.u))}.</span><button class="jg-un-boton malo" data-salta="${esc(w.u)}">Saltarle</button></div>`;
    }
    pon("prPie", h);
  }

  function pintaControl() {
    if (est.fase !== "jugando" || ctx.mirando || !jugador(uid) || est.fuera[uid] || est.etapa === "arranque") { pon("prControl", ""); return; }
    const yo = est.conocido[uid] && !est.retirado[uid];
    let h = `<div class="jg-un-fila">`;
    if (!yo) h += `<button class="jg-un-boton grande" data-acc="entra">Volver a la mesa</button>`;
    else if (est.saliendo[uid]) h += `<button class="jg-un-boton" data-acc="sigue">Me quedo</button><span class="jg-nota">Te levantas al acabar esta ronda.</span>`;
    else h += `<button class="jg-un-boton suave" data-acc="sale">Levantarme${enRonda(uid) && est.etapa !== "reparto" ? " al acabar la ronda" : ""}</button>`;
    if (yo) {
      const voto = est.cierre.includes(uid);
      h += `<button class="jg-un-boton ${voto ? "sel" : "suave"}" data-acc="${voto ? "nocierra" : "cierra"}">${voto ? "Retirar voto" : "✋ Acabar la partida"}</button><span class="jg-nota">${est.cierre.length} de ${est.cierreFalta} para acabar</span>`;
    }
    h += `</div>`;
    if (est.esperan.length) h += `<div class="jg-nota">Se sientan en la próxima ronda: ${est.esperan.map(u => esc(Nombre(u))).join(", ")}</div>`;
    pon("prControl", h);
  }

  function pintaMarcador() {
    const us = Object.keys(est.puntos).filter(u => est.conocido[u]).sort((a, b) => est.puntos[b] - est.puntos[a]);
    pon("prMarcador", `<div class="jg-un-hist-t">Puntos · ${est.rondas.length} ronda${est.rondas.length === 1 ? "" : "s"}</div>` + us.map(u =>
      `<div class="jg-pr-punto${est.retirado[u] || est.fuera[u] ? " ido" : ""}"><span>${ICONO_ROL[est.roles[u]] || ""} ${esc(Nombre(u))}</span><b>${est.puntos[u]}</b></div>`).join(""));
  }

  function texto(e) {
    switch (e.e) {
      case "inicio": return "Empieza la partida";
      case "reparto": return "Se baraja la ronda";
      case "repartido": return "Cartas repartidas";
      case "empieza": return verbo(e.uid, "Abres tú", "abre");
      case "da": return verbo(e.uid, e.tipo === "da" ? "Das" : "Devuelves", e.tipo === "da" ? "da" : "devuelve") + " " + nc(e.n) + " a " + (e.a === uid ? "ti" : nombre(e.a));
      case "juega": return verbo(e.uid, "Juegas", "juega") + " " + e.c.map(c => PR_RANGOS[rangoPr(c)] + PR_PALOS[paloPr(c)]).join(" ");
      case "pasa": return verbo(e.uid, "Pasas", "pasa");
      case "limpia": return verbo(e.uid, "Limpias", "limpia") + " la mesa";
      case "acaba": return verbo(e.uid, "Te quedas", "se queda") + " sin cartas: Nº " + e.pos;
      case "salta": return Nombre(e.por) + " salta a " + (e.uid === uid ? "ti" : nombre(e.uid));
      case "ronda": return "Fin de la ronda " + e.ronda;
      case "entra": return verbo(e.uid, "Te sientas", "se sienta");
      case "sigue": return verbo(e.uid, "Te quedas", "se queda");
      case "saldra": return verbo(e.uid, "Te levantarás", "se levantará") + " al acabar la ronda";
      case "retira": return verbo(e.uid, "Te levantas", "se levanta");
      case "cierra": return verbo(e.uid, "Votas", "vota") + " acabar la partida";
      case "abandona": return verbo(e.uid, "Te vas", e.expulsado ? "es expulsado" : "se va");
      case "fin": return "Fin de la partida";
      default: return "";
    }
  }
  function pintaHist() {
    const hs = est.hist.slice(-12).reverse().map(e => texto(e) && `<div class="jg-un-h h-${esc(e.e)}">${esc(texto(e))}</div>`).filter(Boolean);
    pon("prHist", `<div class="jg-un-hist-t">Lo último</div>${hs.join("")}`);
  }

  const TRAMPA = {
    clave: "su clave de los sobres no sale de su llave", mezcla: "barajó con trampa",
    quita: "al quitar su candado cambió las cartas de alguien", cambio: "en el cambio no dio las cartas que tocaban",
    carta: "jugó una carta que no tenía", llave: "reveló una llave que no es la suya"
  };
  function pintaTrampa() {
    let h = "";
    for (const t of tramposos) h += `<div class="jg-trampa">⚠ ${esc(Nombre(t.uid))} ${esc(TRAMPA[t.que] || "hizo trampa")} (ronda ${t.rep + 1}).</div>`;
    for (const f of est.falsas || []) h += `<div class="jg-trampa">⚠ La llave de ${esc(nombre(f.uid))} no encaja con su cadena: se le puede echar con ⏏.</div>`;
    if (est.fase === "fin" && ocultas.length) h += `<div class="jg-nota">No revelaron todas sus llaves: ${ocultas.map(u => esc(Nombre(u))).join(", ")}.</div>`;
    pon("prTrampa", h);
  }

  /* ---------- clics ---------- */
  function alClic(ev) {
    const b = ev.target.closest("button");
    if (!b || b.disabled || enviando || !est) return;
    if (b.dataset.acc) {
      const a = b.dataset.acc;
      const j = a === "entra" ? { t: "entra", uid } : a === "sale" ? { t: "sale", uid } : a === "sigue" ? { t: "sale", uid, no: true }
        : a === "cierra" ? { t: "cierra", uid } : { t: "cierra", uid, no: true };
      suena("clic"); manda(j); return;
    }
    if (b.dataset.salta) { manda({ t: "salta", uid, a: b.dataset.salta }); return; }
    if (!juego()) return;
    const m = mia();
    if (!m || m.rota) return;
    if (b.dataset.carta != null) {
      const c = +b.dataset.carta, r = rangoPr(c), cb = miCambio();
      if (cb && devuelvoYa(cb)) {
        sel = sel.includes(c) ? sel.filter(x => x !== c) : sel.length < cb.n ? [...sel, c] : sel;
      } else if (est.mesa) {
        /* Con mesa: el grupo justo del número tocado, de una vez. */
        const del = m.mano.filter(x => rangoPr(x) === r).slice(0, est.mesa.n);
        sel = sel.length && rangoPr(sel[0]) === r ? [] : del;
      } else if (sel.includes(c)) sel = sel.filter(x => x !== c);
      else sel = sel.length && rangoPr(sel[0]) === r && sel.length < tope() ? [...sel, c] : [c];
      suena("clic"); firmas.prMano = firmas.prPie = ""; pintaMano(); pintaPie(); return;
    }
    if (b.id === "prTodas" && sel.length) { const r = rangoPr(sel[0]); sel = m.mano.filter(x => rangoPr(x) === r).slice(0, tope()); pinta(); return; }
    if (b.id === "prJugar" && sel.length) { manda({ t: "juega", uid, c: sel.slice() }); return; }
    if (b.id === "prPasa") { manda({ t: "pasa", uid }); return; }
    if (b.id === "prDevuelve") { const cb = miCambio(); if (cb && sel.length === cb.n) daCartas(cb, sel.slice(), true); }
  }

  /* ---------- latido, fin y auditoría ---------- */
  function late() {
    if (!est || muerto) return;
    if (enviando && Date.now() - enviandoT > ENVIO_MAX + 2000) enviando = false;
    if (!sec && secListo && !ctx.mirando) { secPedido = false; secListo = false; pideSecreto(); }
    if (est.fase === "jugando") { automatismos(); firmas.prPie = ""; pintaPie(); }
    else if (est.fase === "fin") cierre();
  }
  function alVolver() { if (!document.hidden && est) { automatismos(); pinta(); if (est.fase === "fin") listo(); } }
  function listo() { if (!document.hidden && ctx.listo) ctx.listo(); }

  function cierre() {
    if (muerto || !est || est.fase !== "fin") return;
    if (!finVisto) finVisto = Date.now();
    automatismos();
    if (ctx.mirando || !jugador(uid)) return;
    const faltan = est.jugadores.some(j => !est.fuera[j.uid] && llavesDebidas(j.uid).length);
    if (!(p.fin && p.fin.at) && (!faltan || Date.now() - finVisto > ESPERA_LLAVES))
      Promise.resolve().then(() => {
        // Puede haberse desmontado la vista o revertido una jugada local.
        if (!muerto && est && est.fase === "fin" && !(p.fin && p.fin.at))
          return terminar(est.ganador, est.motivo);
      }).catch(() => {});
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    const f = est.rondas.length + ":" + Object.keys(est.llaves).length + ":" + (est.fase === "fin");
    if (f === audFirma) return;
    audFirma = f;
    try {
      const r = await auditaPresidente(est, hechasAud);
      if (muerto) return;
      tramposos = r.filter(x => x.que !== "oculta");
      ocultas = [...new Set(r.filter(x => x.que === "oculta").map(x => x.uid))];
      firmas.prTrampa = "";
      pintaTrampa();
    } catch (e) { console.warn("[presidente] auditoría", e); }
  }

  /* Lo que suena, del historial: solo lo más importante de cada tanda. */
  function sonido(nuevos) {
    if (!nuevos.length || document.hidden) return;
    const hay = e => nuevos.find(x => x.e === e);
    const r = hay("ronda");
    if (r) { suena(r.salidos && r.salidos[0] === uid ? "gana" : r.salidos && r.salidos[r.salidos.length - 1] === uid ? "pierde" : "ficha"); return; }
    for (const [e, s] of [["acaba", "planta"], ["salta", "golpe"], ["limpia", "golpe"], ["juega", "carta"], ["pasa", "madera"], ["repartido", "reparte"], ["da", "reparte"], ["entra", "entra"], ["cierra", "ficha"]])
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
