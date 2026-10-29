/* ============================================================
   Type Race — la sala. Todos escriben el mismo texto (la semilla de la
   sala y los ajustes que eligió el anfitrión, con
   `juegos/typerace/motor.js`) y arriba corre una pista con la cara de
   cada uno, que avanza con lo que lleva escrito.

   El tecleo es de cada navegador: aquí solo se cuenta. La pista de los
   demás viaja por `vivo/<pid>/t/<uid>` (`fb.tetrisVivo`, el mismo nodo
   desechable del Tetris), unas dos veces por segundo y solo si cambió.
   Al registro van `arranca`, mi `meta` y el `corta` de cierre (ver
   `redTyperace` en motor.js); los dos de reloj, en relevo como en el
   Momazo, para que una sala de diez no escriba diez veces lo mismo.

   Se escribe en un <input> (vista.js), así que en el celular sale su
   teclado; el lector de controles no lo ve por sí solo:
   @controles: tactil teclado
   ============================================================ */
import TRM from "../../../juegos/typerace/motor.js";
import TRV from "../../../juegos/typerace/vista.js";
import { TR_HOLGURA_MS, TR_TEXTOS, TR_FINALES } from "./motor.js";
import { salidaFx } from "./sonido.js";
import * as fb from "../fb-juegos.js";

const RELEVO_MS = 1800;
const VIVO_MS = 450;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fotoSola = j => j.foto && /^(https?:|data:image\/)/.test(j.foto)
  ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0).toUpperCase());
const MEDALLA = ["🥇", "🥈", "🥉"];

export function crearTyperace(ctx) {
  const { uid, pid, jugar, terminar, ahora } = ctx;
  let raiz = null, p = null, est = null, muerto = false;
  let s = null, clave = "", vista = null, tick = 0, vivoT = 0, vivoFirma = "";
  let vivos = {}, desVivo = null, finPedido = false;
  let metaEnVuelo = false, metaOtra = 0, relevoT = 0, relevoClave = "", cuentaVista = -1, sonFin = false;
  const firmas = {};

  /* ---------- sonido: el bus de efectos de la página ---------- */
  let son = null;
  const sonar = (k, a) => {
    const o = salidaFx();
    if (!o) return;
    if (!son || son.ctx !== o.ctx) son = TRV.crearSonido(o.ctx, o.destino);
    son[k](a);
  };

  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const juego = () => !ctx.mirando && !!jugador(uid) && est && est.fase === "jugando" && !est.fuera[uid];
  const activos = () => est ? est.jugadores.map(j => j.uid).filter(u => !est.fuera[u]) : [];
  const libre = () => est && est.aj.largo === 0;
  /* Se puede escribir entre la largada y el corte, y mientras no haya
     mandado mi meta. */
  const corteLocal = () => est ? (est.corte || est.plazo || 0) : 0;
  const puede = () => {
    if (!juego() || !s || s.fin || est.metas[uid] || est.etapa === "arranque" || !est.salida) return false;
    const t = ahora();
    if (t < est.salida) return false;
    const c = corteLocal();
    return !(c && t >= c);
  };
  const pon = (id, html) => {
    if (firmas[id] === html) return;
    firmas[id] = html;
    const el = raiz && raiz.querySelector("#" + id);
    if (el) el.innerHTML = html;
  };

  function montar(host) {
    raiz = document.createElement("div");
    raiz.className = "jg-tr";
    raiz.innerHTML = `
      <div class="jg-barra"><span id="trFase"></span><span id="trAjustes" class="jg-tr-ajustes"></span><b id="trReloj" class="jg-tr-reloj"></b></div>
      <div class="jg-tablero jg-tr-sala">
        <div id="trPista" class="jg-tr-pista"></div>
        <div class="jg-tr-zona">
          <div id="trVivo" class="jg-tr-vivo"></div>
          <div id="trCaja" class="jg-tr-caja"></div>
          <div id="trCartel" class="jg-tr-cartel" aria-live="polite"></div>
        </div>
      </div>`;
    host.appendChild(raiz);
    vista = TRV.crear(raiz.querySelector("#trCaja"), {
      M: TRM, ahora, puede,
      aviso: "Toca aquí o pulsa una tecla para escribir",
      alarga: st => { if (st.pal.length - st.i < 60) st.pal = TRM.palabras(est.aj, p.semilla, st.pal.length + 100); },
      alTecla: ev => {
        sonar("tecla", ev);
        if (ev === "fin") mandaMeta();
        pintaVivo();
      }
    });
    desVivo = fb.watchTetrisVivo(pid, v => { vivos = v || {}; pintaPista(); });
    tick = setInterval(paso, 100);
  }

  /* El texto se arma una vez por sala (y por ajustes: no cambian después
     de abrirla, pero una revancha trae semilla nueva). */
  function arma() {
    const k = (p.semilla >>> 0) + "|" + JSON.stringify(est.aj);
    if (k === clave && s) return;
    clave = k;
    s = TRM.crear(TRM.palabras(est.aj, p.semilla, TRM.inicial(est.aj)), libre());
    vista.pon(s);
  }

  /* ---------- el reloj de la pantalla ---------- */
  function paso() {
    if (muerto || !est || !s) return;
    const t = ahora();
    if (est.salida && est.etapa !== "fin") {
      /* La cuenta atrás de la largada: 3, 2, 1 y ¡YA! */
      const falta = est.salida - t;
      const n = falta > 0 ? Math.ceil(falta / 1000) : (falta > -700 ? 0 : -1);
      if (n !== cuentaVista && n <= 3) {
        cuentaVista = n;
        if (n >= 0 && !document.hidden && juego()) sonar("cuenta", n);
        pon("trCartel", n > 0 ? `<b class="n">${n}</b>` : n === 0 ? `<b class="ya">¡YA!</b>` : "");
        if (n === 0 && juego()) { if (!s.t0) s.t0 = est.salida; vista.enfoca(); }
      }
      if (n < 0 && juego() && s && !s.t0 && t >= est.salida) s.t0 = est.salida;
      /* El corte: se acabó el tiempo o alguien ya ganó. Lo que llevo
         escrito sale como mi meta, sin terminar. */
      const c = corteLocal();
      if (juego() && !est.metas[uid] && c && t >= c) {
        if (!s.fin) { s.fin = true; s.tFin = Math.min(t, c); }
        mandaMeta();
      }
    }
    if (juego() && !est.metas[uid] && s.fin) mandaMeta();
    vista.quieta(!puede());
    raiz.classList.toggle("cuenta", !!est.salida && t < est.salida);
    if (t - vivoT > VIVO_MS && juego() && est.salida && t >= est.salida) {
      vivoT = t;
      const k = TRM.cuentas(s, s.fin ? s.tFin : t);
      const d = { a: Math.round(k.avance * 1000), w: k.ppm, c: k.c, p: k.p };
      const f = JSON.stringify(d);
      if (f !== vivoFirma) { vivoFirma = f; fb.tetrisVivo(pid, uid, d); }
    }
    pintaVivo();
    pintaReloj();
    pintaPista();
    pintaFase();
    relevo();
  }

  /* Mi meta se insiste hasta que el reductor la cuente (un `jugar` que se
     rinde devuelve false sin lanzar). */
  function mandaMeta() {
    if (!juego() || est.metas[uid] || metaEnVuelo || Date.now() < metaOtra) return;
    const fin = s.fin ? s.tFin : ahora();
    const k = TRM.cuentas(s, fin);
    const ok = s.fin && !libre() && s.i >= s.pal.length ? 1 : 0;
    if (ok && !sonFin) { sonFin = true; sonar("tecla", "fin"); }
    metaEnVuelo = true;
    Promise.resolve(jugar({ t: "meta", uid, at: ahora(), ok, c: k.c, e: k.e, p: k.p, ms: Math.max(1, Math.round(fin - est.salida)) }))
      .then(r => { metaOtra = Date.now() + (r ? 2500 : 1200); }, () => { metaOtra = Date.now() + 1200; })
      .then(() => { metaEnVuelo = false; });
  }

  /* Las jugadas de reloj, en relevo: el primer asiento activo escribe en
     cuanto toca y cada uno de los demás espera 1,8 s más. */
  function relevo() {
    if (!juego() || est.fase !== "jugando") return;
    const slot = activos().indexOf(uid);
    if (slot < 0) return;
    let k, jug, cuando;
    if (est.etapa === "arranque") { k = "arranca"; jug = { t: "arranca" }; cuando = 0; }
    else {
      const c = corteLocal();
      if (!c) return;
      k = "corta" + c; jug = { t: "corta" }; cuando = c + TR_HOLGURA_MS + 300;
    }
    if (relevoClave === k) return;
    relevoClave = k;
    clearTimeout(relevoT);
    relevoT = setTimeout(async () => {
      if (muerto || !est || est.fase !== "jugando") return;
      try { await jugar({ ...jug, uid, at: ahora() }); } catch (e) { /* lo reintenta otro asiento */ }
      setTimeout(() => { if (!muerto) relevoClave = ""; }, 4000);
    }, Math.max(0, cuando - ahora()) + slot * RELEVO_MS);
  }

  /* ---------- pintar ---------- */
  function pintaReloj() {
    const t = ahora();
    let txt = "";
    if (est.etapa === "fin" || !est.salida) txt = "";
    else if (est.plazo) txt = fmt(Math.max(0, est.plazo - Math.max(t, est.salida)));
    else if (t >= est.salida) txt = fmt(t - est.salida);
    pon("trReloj", txt);
    const el = raiz.querySelector("#trReloj");
    if (el) el.classList.toggle("urge", !!est.plazo && est.plazo - t < 10000 && t < est.plazo);
  }
  const fmt = ms => { const sg = Math.floor(ms / 1000); return Math.floor(sg / 60) + ":" + String(sg % 60).padStart(2, "0"); };

  function pintaVivo() {
    if (!juego() && !(est && est.metas[uid])) { pon("trVivo", ""); return; }
    const m = est.metas[uid];
    if (m) {
      const pos = est.orden.indexOf(uid);
      const ppm = Math.min(400, Math.round((m.c / 5) / (m.ms / 60000)));
      pon("trVivo", `<span class="jg-tr-hecho">${m.ok ? "¡Terminaste!" : "Hasta aquí llegaste"} · <b>${ppm}</b> ppm · ${m.e} errores${m.ok && pos >= 0 ? ` · ${MEDALLA[pos] || "#" + (pos + 1)}` : ""}</span>${est.etapa !== "fin" && est.debe.length ? `<small>Esperando a ${est.debe.length === 1 ? esc(nombre(est.debe[0])) : est.debe.length + " más"}…</small>` : ""}`);
      return;
    }
    const k = TRM.cuentas(s, s.fin ? s.tFin : ahora());
    const cuenta = libre() ? `${k.p} palabras` : `${Math.min(s.i, s.pal.length)}/${s.pal.length}`;
    pon("trVivo", `<span><b>${cuenta}</b></span><span><b>${s.t0 ? k.ppm : 0}</b> ppm</span><span><b>${k.prec}</b>%</span>`);
  }

  /* La pista: un carril por jugador, con su cara avanzando. En el libre no
     hay final, así que va relativo a quien más lleva escrito. */
  function pintaPista() {
    if (!raiz || !est) return;
    const cont = raiz.querySelector("#trPista");
    const js = est.jugadores;
    const firma = js.map(j => j.uid + (j.foto || "").length + j.nombre + j.color + (est.fuera[j.uid] ? "x" : "")).join(",");
    if (firmas.trPista !== firma) {
      firmas.trPista = firma;
      cont.innerHTML = js.map(j => `
        <div class="jg-tr-carril${j.uid === uid && !ctx.mirando ? " yo" : ""}${est.fuera[j.uid] ? " fuera" : ""}" data-u="${esc(j.uid)}" style="--c:${esc(j.color || "#888")}">
          <span class="nom" translate="no">${esc(j.uid === uid ? "Tú" : j.nombre || "")}</span>
          <span class="via"><span class="auto"><span class="cara">${fotoSola(j)}</span><i class="humo"></i></span><span class="meta">🏁</span></span>
          <span class="dat"></span>
        </div>`).join("");
    }
    const datos = {};
    for (const j of js) {
      const u = j.uid, m = est.metas[u];
      if (u === uid && juego() && !m && s) {
        const k = TRM.cuentas(s, s.fin ? s.tFin : ahora());
        datos[u] = { a: k.avance, w: s.t0 ? k.ppm : 0, c: k.c };
      } else if (m) datos[u] = { a: m.ok ? 1 : null, w: Math.min(400, Math.round((m.c / 5) / (m.ms / 60000))), c: m.c, m };
      else { const v = vivos[u] || {}; datos[u] = { a: (v.a || 0) / 1000, w: v.w || 0, c: v.c || 0 }; }
    }
    const lider = Math.max(1, ...Object.values(datos).map(d => d.c || 0));
    for (const j of js) {
      const el = cont.querySelector(`[data-u="${CSS.escape(j.uid)}"]`);
      if (!el) continue;
      const d = datos[j.uid];
      let a = d.a;
      if (libre() || a == null) a = Math.min(0.97, (d.c || 0) / lider * 0.92);
      el.style.setProperty("--a", Math.max(0, Math.min(1, a)).toFixed(4));
      const pos = est.orden.indexOf(j.uid);
      const lugar = d.m && (d.m.ok || est.etapa === "fin") ? (MEDALLA[pos] || "#" + (pos + 1)) + " " : "";
      const txt = est.fuera[j.uid] ? "se fue" : `${lugar}${d.w} ppm`;
      const dat = el.querySelector(".dat");
      if (dat.textContent !== txt) dat.textContent = txt;
      el.classList.toggle("llego", !!(d.m && d.m.ok));
      el.classList.toggle("corre", !d.m && est.salida > 0 && ahora() >= est.salida && est.etapa !== "fin" && d.w > 0);
    }
  }

  function pintaFase() {
    let f;
    const n = activos().length;
    if (est.fase === "espera") f = est.cupo > 1 && est.jugadores.length < 2 ? "Esperando corredores (o empieza solo)" : "Esperando corredores";
    else if (est.fase === "fin") f = est.ganador === uid ? "¡Ganaste la carrera!" : est.ganador ? (jugador(est.ganador) || {}).nombre + " gana" : "Fin";
    else if (est.etapa === "arranque" || ahora() < est.salida) f = "¡Preparados!";
    else if (ctx.mirando || !jugador(uid)) f = "Mirando · " + n + " en carrera";
    else if (est.etapa === "cierre") f = est.plazo && est.corte === est.plazo ? "¡Tiempo!" : "¡Alguien llegó a la meta!";
    else f = n > 1 ? n + " en carrera" : "Contra el reloj";
    pon("trFase", esc(f));
  }

  function pintaAjustes() {
    const a = est.aj;
    const partes = [a.idioma === "en" ? "English" : "Español"];
    if (a.idioma === "es") partes.push(a.acentos ? "con tildes" : "sin tildes");
    partes.push(TR_TEXTOS[a.texto].toLowerCase());
    partes.push(a.largo ? a.largo + " palabras" : "libre");
    if (a.final === "tiempo") partes.push(a.tiempo < 60 ? a.tiempo + " s" : a.tiempo / 60 + " min");
    else partes.push(TR_FINALES[a.final].toLowerCase());
    pon("trAjustes", partes.map(x => `<span>${esc(x)}</span>`).join(""));
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (!raiz) return;
    arma();
    pintaAjustes();
    pintaFase();
    raiz.classList.toggle("mirando", !juego());
    raiz.classList.toggle("espera", est.fase === "espera" || est.etapa === "arranque");
    if (est.fase === "espera") pon("trCartel", `<span class="esp">${est.jugadores.length > 1 ? "Cuando el anfitrión empiece, aparece el texto aquí." : "El anfitrión puede empezar solo o esperar a más corredores."}</span>`);
    else if (firmas.trCartel && firmas.trCartel.includes("esp")) pon("trCartel", "");
    paso();
    if (est.fase === "fin") {
      vista.quieta(true);
      if (!finPedido && !ctx.mirando && jugador(uid) && !(p.fin && p.fin.at)) {
        finPedido = true;
        Promise.resolve(terminar(est.ganador, est.motivo)).catch(() => { finPedido = false; })
          .then(() => fb.borraVivo(pid));
      }
      if (ctx.listo) ctx.listo();
    }
  }

  function destruir() {
    muerto = true;
    clearInterval(tick); clearTimeout(relevoT);
    if (desVivo) desVivo();
    if (vista) vista.destruir();
    if (raiz) raiz.remove();
  }

  return { montar, actualizar, destruir, ocupado: () => false };
}
