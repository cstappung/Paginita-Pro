/* ============================================================
   Tetris — la sala multijugador. Cada navegador simula **su propio pozo**
   con el motor compartido (`juegos/club/tetris/motor.js`) y la semilla de
   la sala, así que todos reciben las mismas piezas en el mismo orden.
   Al registro solo sube lo que el resto necesita para decidir quién gana:
   `{t:"ataque", a, n}` cuando limpio líneas (basura para el siguiente
   vivo) y `{t:"cae", l, p}` cuando me sale el pozo por arriba.
   `redTetris` suma la basura que me mandaron; aquí se inyecta la que
   todavía no había recibido.

   Lo que se ve de los rivales viaja por `vivo/<pid>/t/<uid>` (el pozo en
   200 letras, cada ~250 ms): es desechable, nada se reconstruye con ello.
   El límite honesto: cada uno juega en su máquina y el servidor no lo
   arbitra, así que una consola puede mentir líneas. No hay forma de
   evitarlo sin un servidor, que es justo lo que este sitio no tiene.
   ============================================================ */
import TM from "../../../juegos/club/tetris/motor.js";
import TFX from "../../../juegos/club/tetris/fx.js";
import { blancoTetris } from "./motor.js";
import { salidaFx } from "./sonido.js";
import * as fb from "../fb-juegos.js";

const CELDA = 26;
const VIVO_MS = 250;
const SUBE_CADA = 30000;
const MISIL_MS = 520;
const quieto = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function crearTetris(ctx) {
  const { uid, pid, jugar, terminar } = ctx;
  let raiz = null, p = null, est = null, s = null, muerto = false;
  let raf = 0, t0 = 0, vivoT = 0, aplicada = 0, finPedido = false, fondoT = 0;
  let caidaSonada = false, caidaEnVuelo = false, caidaOtra = 0;
  let vivos = {}, desVivo = null, visto = -1;
  const firmas = {};
  const W = TM.W, HV = TM.H - TM.OCULTAS;
  /* Efectos y sonido de fx.js. El sonido sale por el bus de efectos de la
     página (`salidaFx`), así que el 🔊 y el deslizador lo gobiernan. */
  let fx = TFX.crearEfectos({ TM, celda: CELDA }), sonM = null, latidoT = 0;
  const son = (k, ...a) => {
    const o = salidaFx();
    if (!o) return;
    if (!sonM || sonM.ctx !== o.ctx) sonM = TFX.crearSonido(o.ctx, o.destino);
    if (sonM[k]) sonM[k](...a);
  };

  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const t = nombre(u); return t.charAt(0).toUpperCase() + t.slice(1); };
  const juego = () => !ctx.mirando && !!jugador(uid) && est && est.fase === "jugando" && !est.fuera[uid];
  /* Modo celular: mientras se juega, la sala ocupa toda la pantalla, con los
     datos en una barra fina arriba, los pozos rivales en una columna estrecha
     a la derecha y la franja de botones abajo (juegos.html, html.jg-tt-inm).
     Solo en un teléfono en vertical; en el PC nada cambia. */
  const celular = () => {
    try { return matchMedia("(pointer:coarse)").matches && Math.min(innerWidth, innerHeight) <= 600 && innerHeight > innerWidth; }
    catch { return false; }
  };
  const inmersivo = v => document.documentElement.classList.toggle("jg-tt-inm", !!v);
  const alGirar = () => inmersivo(!muerto && juego() && celular());
  const pon = (id, html) => {
    if (firmas[id] === html) return;
    firmas[id] = html;
    const el = raiz && raiz.querySelector("#" + id);
    if (el) el.innerHTML = html;
  };

  const mando = TM.crearMando(a => {
    if (!s || !juego() || s.fin) return;
    if (a === "pausa") return;
    const ok = TM.accion(s, a);
    if (ok && (a === "izq" || a === "der")) son("mueve", s.p && s.p.x);
  });
  let configurando = false;
  const teclaAbajo = e => {
    if (!juego() || configurando) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    mando.baja(e);
  };
  const teclaArriba = e => mando.sube(e);
  // Mando de consola (juegos/audio/mando.js): botones → las mismas teclas.
  let cfgMando = null;
  const ponMando = t => {
    if (!window.Mando) return;
    cfgMando = Object.assign(TM.mandoTetris(t), { menu: () => !juego() || configurando || !s || s.fin, zonas: [{ sel: "#ttTeclasTxt" }] });
    window.Mando.configura(cfgMando);
  };
  /* Una pestaña oculta no recibe `requestAnimationFrame`, y antes eso
     congelaba su pozo: quien cambiaba de pestaña no perdía nunca y la sala
     no se acababa. En una partida a la vez el pozo sigue cayendo: oculta,
     la avanza un temporizador (el navegador lo frena a uno por segundo, y
     `paso` trocea lo que pasó en tramos de 100 ms). */
  const alOcultar = () => {
    clearInterval(fondoT); fondoT = 0;
    if (!document.hidden) { t0 = performance.now(); return; }
    mando.suelta();
    fondoT = setInterval(() => {
      const ahora = performance.now();
      let falta = Math.min(60000, ahora - t0);
      t0 = ahora;
      while (falta > 0 && !muerto) { const d = Math.min(100, falta); falta -= d; paso(ahora, d); }
    }, 1000);
  };

  function montar(host) {
    raiz = document.createElement("div");
    raiz.className = "jg-tt";
    raiz.innerHTML = `
      <div class="jg-barra"><span id="ttFase"></span><span class="jg-tt-ayuda"><span id="ttTeclasTxt"></span> <button type="button" id="ttTeclas" class="jg-btn-mini">⌨ Teclas</button></span></div>
      <div class="jg-tablero jg-tt-sala">
        <div class="jg-tt-yo">
          <div class="jg-tt-lado"><small>Guardada</small><canvas id="ttGuarda" width="96" height="72"></canvas><div id="ttDatos" class="jg-tt-datos"></div></div>
          <div class="jg-tt-pozo"><div id="ttBasura" class="jg-tt-basura"></div><canvas id="ttPozo" width="${W * CELDA}" height="${HV * CELDA}"></canvas><div id="ttAviso" class="jg-tt-aviso"></div><div id="ttAlerta" class="jg-tt-alerta"></div></div>
          <div class="jg-tt-lado"><small>Siguientes</small><canvas id="ttCola" width="96" height="300"></canvas></div>
        </div>
        <div id="ttRivales" class="jg-tt-rivales"></div>
      </div>
      <div class="jg-tt-tactil" id="ttTactil">
        <button data-a="contragira">⟲</button><button data-a="izq">◀</button><button data-a="blando">▼</button><button data-a="der">▶</button><button data-a="gira">⟳</button><button data-a="caer">⤓</button><button data-a="guarda">⇄</button>
      </div>
      <div id="ttHist" class="jg-tt-hist"></div>`;
    host.appendChild(raiz);
    window.addEventListener("resize", alGirar);
    const pintaTeclas = () => { raiz.querySelector("#ttTeclasTxt").textContent = TM.textoTeclas(); };
    pintaTeclas(); ponMando();
    raiz.querySelector("#ttTeclas").addEventListener("click", () => {
      configurando = true; mando.suelta();
      TM.panelTeclas(document, t => { mando.recarga(t); pintaTeclas(); ponMando(t); }, () => { configurando = false; });
    });
    raiz.querySelector("#ttTactil").addEventListener("pointerdown", e => {
      const b = e.target.closest("button[data-a]");
      if (!b || !juego()) return;
      e.preventDefault();
      const a = b.dataset.a;
      /* ▼ y ◀ ▶ se mantienen, como en el Club: los laterales usan el mismo
         autorrepetido (DAS) que el teclado. Sin `pointercancel` un dedo que
         se desliza fuera dejaba la pieza bajando o corriendo sola. */
      if (a === "blando" || a === "izq" || a === "der") {
        if (a === "blando") mando.blando = true;
        else { mando.lado = a === "izq" ? -1 : 1; mando.t = 0; mando.repite = false; if (TM.accion(s, a)) son("mueve", s.p && s.p.x); }
        /* iOS: si una pulsación larga abría el menú, el pointerup no llegaba
           nunca; touchend y blur sueltan igual. */
        const EVS = ["pointerup", "pointercancel", "touchend", "touchcancel", "blur"];
        const off = () => {
          if (a === "blando") mando.blando = false; else mando.lado = 0;
          for (const ev of EVS) removeEventListener(ev, off);
        };
        for (const ev of EVS) addEventListener(ev, off);
        return;
      }
      TM.accion(s, a);
    });
    const tactil = raiz.querySelector("#ttTactil");
    tactil.addEventListener("touchstart", e => { if (e.target.closest("button[data-a]")) e.preventDefault(); }, { passive: false });
    tactil.addEventListener("contextmenu", e => e.preventDefault());
    tactil.addEventListener("selectstart", e => e.preventDefault());
    document.addEventListener("keydown", teclaAbajo);
    document.addEventListener("keyup", teclaArriba);
    document.addEventListener("visibilitychange", alOcultar);
    desVivo = fb.watchTetrisVivo(pid, v => { vivos = v || {}; pintaRivales(); });
    t0 = performance.now();
    alOcultar();
    raf = requestAnimationFrame(bucle);
  }

  function arranca() {
    if (s || !est || est.fase === "espera") return;
    s = TM.crear({ semilla: est.semilla || 1, subeCada: SUBE_CADA });
    fx = TFX.crearEfectos({ TM, celda: CELDA });
    aplicada = 0;
  }

  /* ---------- el bucle ---------- */
  function bucle(ahora) {
    if (muerto) return;
    raf = requestAnimationFrame(bucle);
    const dt = Math.min(100, ahora - t0);
    t0 = ahora;
    if (!s || !est) return;
    fx.paso(dt);
    paso(ahora, dt);
    dibuja();
  }

  /* Un tramo de partida. Fuera del `!s.fin` a propósito: casi siempre se
     pierde con una tecla (caída instantánea o un giro que ya no cabe), y
     las teclas corren fuera del bucle. Antes el aviso de que me ahogué
     solo salía si el pozo se llenaba por gravedad dentro de este tramo;
     perdiendo con una tecla, el tramo siguiente veía `s.fin` y se lo
     saltaba entero, así que el `cae` no se escribía nunca y la sala seguía
     diciendo que todos estaban en pie. */
  function paso(ahora, dt) {
    if (!s || !est) return;
    if (juego()) {
      if (!s.fin) {
        const deben = est.basura[uid] || 0;
        if (deben > aplicada) { const n = deben - aplicada; TM.recibe(s, n); aplicada = deben; if (s.tiempo > 500) { fx.amenaza(n); son("alarma", n); } }
        mando.paso(dt);
        s.blando = mando.blando;
        TM.avanza(s, dt);
      }
      eventos();
      if (s.salida > 0) {
        const n = Math.min(12, s.salida);
        s.salida = 0;
        const a = blancoTetris(est, uid);
        if (a) { jugar({ t: "ataque", uid, a, n }).catch(() => {}); son("envia", n); misil(uid, a, n); }
      }
      if (!s.fin) latido(dt);
      else avisaCaida();
      if (ahora - vivoT > VIVO_MS) {
        vivoT = ahora;
        fb.tetrisVivo(pid, uid, { r: TM.resumen(s), l: s.lineas, p: s.puntos, n: s.nivel, f: s.fin ? 1 : 0 });
      }
    } else if (s && !s.fin && est.fuera[uid]) s.fin = true;
  }

  /* El `cae` se insiste hasta que el reductor me cuente fuera (entonces
     `juego()` deja de llamar aquí): una escritura que falla o que `jugar`
     abandona devuelve false sin lanzar, y antes eso dejaba la caída sin
     escribir para siempre. Un `cae` repetido no hace nada en el reductor. */
  function avisaCaida() {
    const t = performance.now();
    if (caidaEnVuelo || t < caidaOtra) return;
    if (!caidaSonada) { caidaSonada = true; son("fin"); }
    caidaEnVuelo = true;
    Promise.resolve(jugar({ t: "cae", uid, l: s.lineas, p: s.puntos }))
      .then(ok => { caidaOtra = performance.now() + (ok ? 3000 : 1500); },
        () => { caidaOtra = performance.now() + 1500; })
      .then(() => { caidaEnVuelo = false; });
  }

  function eventos() {
    let seco = false;
    for (const e of s.eventos.splice(0)) {
      fx.evento(e);
      if (e.e === "gira") son("gira", s.p && s.p.t, s.p && s.p.x);
      else if (e.e === "guarda") son("guarda");
      else if (e.e === "seco") { seco = true; son("seco", e.a - e.de, e.celdas[0][0]); }
      else if (e.e === "basura") { son("impacto", e.n); alerta(raiz && raiz.querySelector(".jg-tt-pozo"), "atacado"); }
      else if (e.e === "nivel") son("nivel");
      else if (e.e === "fija") {
        if (e.n || e.ts) { son("linea", e.n, e.combo, e.ts, e.pc, e.b2b); aviso(e); }
        else if (!seco) son("fija", Math.min(1, TFX.altura(s) / 20), e.bloq && e.bloq[0] && e.bloq[0][0]);
      }
    }
  }
  /* Con la pila a cinco filas del techo late un corazón, y más deprisa si
     además viene basura en camino. */
  function latido(dt) {
    const a = TFX.altura(s), pend = TM.pendiente(s);
    if (a < 15 && !(a >= 11 && pend >= 3)) { latidoT = 0; return; }
    latidoT -= dt;
    if (latidoT <= 0) {
      const k = Math.min(1, Math.max(0, (a - 12) / 8) + pend * 0.06);
      son("latido", k); latidoT = 900 - k * 420;
    }
  }
  /* Una clase que se reinicia, para que la animación vuelva a empezar. */
  const reinicios = new WeakMap();
  function alerta(el, cls, ms = 600) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    clearTimeout(reinicios.get(el));
    reinicios.set(el, setTimeout(() => el.classList.remove(cls), ms));
  }
  /* El ataque se ve viajar: un proyectil del color de quien lo manda, del
     pozo que limpia al que lo recibe. Va por el DOM (WAAPI, el compositor
     lo mueve) y se borra al llegar. */
  const elDe = u => {
    if (!raiz) return null;
    if (u === uid && jugador(uid) && !ctx.mirando) return raiz.querySelector("#ttPozo");
    return raiz.querySelector(`.jg-tt-rival[data-u="${CSS.escape(u)}"] canvas`);
  };
  const colorDe = u => { const c = (jugador(u) || {}).color; return /^#[0-9a-f]{6}$/i.test(c || "") ? c : "#ff4a3a"; };
  function misil(de, a, n) {
    const o = elDe(de), d = elDe(a);
    if (!o || !d || quieto() || document.hidden) return;
    const r0 = o.getBoundingClientRect(), r1 = d.getBoundingClientRect();
    if (!r0.width || !r1.width) return;
    const x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height * 0.35, x1 = r1.left + r1.width / 2, y1 = r1.top + r1.height * 0.5;
    const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 60 - Math.min(120, Math.abs(x1 - x0) * 0.25);
    const tam = Math.min(2.2, 1 + n * 0.12);
    for (let i = 0; i < 3; i++) {
      const b = document.createElement("i");
      b.className = "jg-tt-misil";
      b.style.setProperty("--c", colorDe(de));
      document.body.appendChild(b);
      const k = tam * (1 - i * 0.28);
      const an = b.animate([
        { transform: `translate(${x0}px,${y0}px) scale(${k * 0.4})`, opacity: 0 },
        { transform: `translate(${mx}px,${my}px) scale(${k})`, opacity: 1 - i * 0.3, offset: 0.5 },
        { transform: `translate(${x1}px,${y1}px) scale(${k * 1.3})`, opacity: 1 - i * 0.3 }
      ], { duration: MISIL_MS, delay: i * 45, easing: "cubic-bezier(.45,0,.75,.6)", fill: "both" });
      an.onfinish = an.oncancel = () => b.remove();
    }
    setTimeout(() => {
      if (muerto) return;
      if (a === uid) alerta(raiz && raiz.querySelector(".jg-tt-pozo"), "atacado");
      else alerta(d.closest(".jg-tt-rival"), "golpe", 450);
    }, MISIL_MS + 60);
  }
  let alertaT = 0;
  function avisaAtaque(de, n) {
    const el = raiz && raiz.querySelector("#ttAlerta");
    if (!el) return;
    el.innerHTML = `<span style="--c:${colorDe(de)}">⚠ <b translate="no">${esc(Nombre(de))}</b> te manda ${n}</span>`;
    el.classList.remove("ve"); void el.offsetWidth; el.classList.add("ve");
    clearTimeout(alertaT);
    alertaT = setTimeout(() => el.classList.remove("ve"), 1700);
  }
  let avisoT = 0;
  function aviso(e) {
    const nom = ["", "Simple", "Doble", "Triple", "¡TETRIS!"][e.n] || "";
    const partes = [];
    if (e.ts) partes.push("T-Spin");
    if (nom) partes.push(nom);
    if (e.pc) partes.push("Limpieza total");
    if (e.b2b) partes.push("B2B");
    if (e.combo > 0) partes.push("Combo ×" + e.combo);
    if (e.atq) partes.push("+" + e.atq + " ⇢");
    const el = raiz && raiz.querySelector("#ttAviso");
    if (!el) return;
    el.textContent = partes.join(" · ");
    el.dataset.k = e.pc ? "pc" : e.n >= 4 ? "tetris" : e.ts ? "ts" : "combo";
    el.classList.remove("ve"); void el.offsetWidth; el.classList.add("ve");
    clearTimeout(avisoT);
    avisoT = setTimeout(() => el.classList.remove("ve"), 1400);
  }

  function dibuja() {
    const cv = raiz.querySelector("#ttPozo");
    const c = cv.getContext("2d");
    const pend = TM.pendiente ? TM.pendiente(s) : 0;
    fx.pinta(c, s, { pendiente: s.fin ? 0 : pend });
    fx.sacude(cv);
    const g = raiz.querySelector("#ttGuarda").getContext("2d");
    g.clearRect(0, 0, 96, 72);
    TFX.pintaPieza(g, TM, s.guardada, 48, 36, 18, s.puedeGuardar ? 1 : 0.35);
    const q = raiz.querySelector("#ttCola").getContext("2d");
    q.clearRect(0, 0, 96, 300);
    s.cola.slice(0, 5).forEach((t, i) => TFX.pintaPieza(q, TM, t, 48, 30 + i * 60, i ? 14 : 18));
    pon("ttBasura", `<i class="${pend >= 4 ? "carga peligro" : pend ? "carga" : ""}" style="height:${Math.min(100, pend * 100 / HV)}%"></i>`);
    pon("ttDatos", `<p><small>Líneas</small><b>${s.lineas}</b></p><p><small>Puntos</small><b>${s.puntos}</b></p><p><small>Nivel</small><b>${s.nivel}</b></p>`);
  }

  function pintaRivales() {
    if (!raiz || !est) return;
    const cont = raiz.querySelector("#ttRivales");
    const otros = est.jugadores.filter(j => j.uid !== uid || ctx.mirando || !jugador(uid));
    const firma = otros.map(j => j.uid + (est.fuera[j.uid] ? "x" : "")).join(",");
    if (firmas.ttRivales !== firma) {
      firmas.ttRivales = firma;
      cont.innerHTML = otros.map(j => `
        <div class="jg-tt-rival${est.fuera[j.uid] ? " fuera" : ""}${est.ganador === j.uid ? " gana" : ""}" data-u="${esc(j.uid)}">
          <canvas width="${W * 9}" height="${HV * 9}"></canvas>
          <span class="nom" style="--c:${esc(j.color || "#888")}">${esc(j.nombre || "")}</span>
          <small class="dat"></small>
        </div>`).join("");
    }
    for (const j of otros) {
      const el = cont.querySelector(`[data-u="${CSS.escape(j.uid)}"]`);
      if (!el) continue;
      const v = vivos[j.uid] || {};
      TM.pintaResumen(el.querySelector("canvas").getContext("2d"), v.r || "", { celda: 9, muerto: !!est.fuera[j.uid] });
      const l = est.fuera[j.uid] ? est.lineas[j.uid] : (v.l || 0);
      el.querySelector(".dat").textContent = `${l} líneas · ${est.enviadas[j.uid] || 0} enviadas${est.fuera[j.uid] ? " · fuera" : ""}`;
    }
  }

  function pintaHist() {
    const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
    const txt = e => {
      if (e.e === "ataque") return verbo(e.uid, "Mandas", "manda") + ` ${e.n} de basura a ${e.a === uid ? "ti" : nombre(e.a)}`;
      if (e.e === "cae") return verbo(e.uid, "Te sale el pozo por arriba", "queda fuera");
      if (e.e === "abandona") return verbo(e.uid, "Abandonas", "abandona");
      if (e.e === "gana") return e.uid === uid ? "¡Ganas la sala!" : Nombre(e.uid) + " gana la sala";
      return "";
    };
    pon("ttHist", est.hist.slice(-6).reverse().map(e => `<p>${esc(txt(e))}</p>`).join(""));
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    arranca();
    let f;
    if (est.fase === "espera") f = "Esperando jugadores";
    else if (est.fase === "fin") f = est.ganador === uid ? "¡Ganaste!" : est.ganador ? Nombre(est.ganador) + " gana" : "Fin";
    else if (ctx.mirando || !jugador(uid)) f = "Mirando · " + est.vivos.length + " en pie";
    else if (est.fuera[uid]) f = "Fuera · quedan " + est.vivos.length;
    else f = "Quedan " + est.vivos.length + " en pie";
    pon("ttFase", esc(f));
    raiz.classList.toggle("mirando", !juego());
    alGirar();
    const n = est.hist.length ? est.hist[est.hist.length - 1].i : -1;
    if (visto >= 0 && n > visto) {
      for (const e of est.hist) {
        if (e.i <= visto || e.e !== "ataque") continue;
        if (e.a === uid && e.uid !== uid) { avisaAtaque(e.uid, e.n); misil(e.uid, uid, e.n); }
        else if (e.uid !== uid) misil(e.uid, e.a, e.n);
      }
    }
    visto = n;
    pintaHist();
    pintaRivales();
    if (est.fase === "fin") {
      if (s) s.fin = true;
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
    window.removeEventListener("resize", alGirar);
    inmersivo(false);
    cancelAnimationFrame(raf);
    clearTimeout(avisoT); clearTimeout(alertaT); clearInterval(fondoT);
    document.removeEventListener("keydown", teclaAbajo);
    document.removeEventListener("keyup", teclaArriba);
    if (window.Mando && cfgMando) window.Mando.libera(cfgMando);
    document.removeEventListener("visibilitychange", alOcultar);
    if (desVivo) desVivo();
    if (raiz) raiz.remove();
  }

  return { montar, actualizar, destruir, ocupado: () => false };
}
