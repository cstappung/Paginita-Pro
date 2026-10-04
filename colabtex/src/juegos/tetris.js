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
import { blancoTetris } from "./motor.js";
import { suena } from "./sonido.js";
import * as fb from "../fb-juegos.js";

const CELDA = 26;
const VIVO_MS = 250;
const SUBE_CADA = 30000;

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function crearTetris(ctx) {
  const { uid, pid, jugar, terminar } = ctx;
  let raiz = null, p = null, est = null, s = null, muerto = false;
  let raf = 0, t0 = 0, vivoT = 0, aplicada = 0, caidaEnviada = false, finPedido = false;
  let vivos = {}, desVivo = null, visto = -1;
  const firmas = {};
  const W = TM.W, HV = TM.H - TM.OCULTAS;

  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const t = nombre(u); return t.charAt(0).toUpperCase() + t.slice(1); };
  const juego = () => !ctx.mirando && !!jugador(uid) && est && est.fase === "jugando" && !est.fuera[uid];
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
    if (ok && (a === "izq" || a === "der")) suena("clic");
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
  const alOcultar = () => { if (document.hidden) mando.suelta(); };

  function montar(host) {
    raiz = document.createElement("div");
    raiz.className = "jg-tt";
    raiz.innerHTML = `
      <div class="jg-barra"><span id="ttFase"></span><span class="jg-tt-ayuda"><span id="ttTeclasTxt"></span> <button type="button" id="ttTeclas" class="jg-btn-mini">⌨ Teclas</button></span></div>
      <div class="jg-tablero jg-tt-sala">
        <div class="jg-tt-yo">
          <div class="jg-tt-lado"><small>Guardada</small><canvas id="ttGuarda" width="96" height="72"></canvas><div id="ttDatos" class="jg-tt-datos"></div></div>
          <div class="jg-tt-pozo"><div id="ttBasura" class="jg-tt-basura"></div><canvas id="ttPozo" width="${W * CELDA}" height="${HV * CELDA}"></canvas><div id="ttAviso" class="jg-tt-aviso"></div></div>
          <div class="jg-tt-lado"><small>Siguientes</small><canvas id="ttCola" width="96" height="300"></canvas></div>
        </div>
        <div id="ttRivales" class="jg-tt-rivales"></div>
      </div>
      <div class="jg-tt-tactil" id="ttTactil">
        <button data-a="contragira">⟲</button><button data-a="izq">◀</button><button data-a="blando">▼</button><button data-a="der">▶</button><button data-a="gira">⟳</button><button data-a="caer">⤓</button><button data-a="guarda">⇄</button>
      </div>
      <div id="ttHist" class="jg-tt-hist"></div>`;
    host.appendChild(raiz);
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
        else { mando.lado = a === "izq" ? -1 : 1; mando.t = 0; mando.repite = false; if (TM.accion(s, a)) suena("clic"); }
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
    raf = requestAnimationFrame(bucle);
  }

  function arranca() {
    if (s || !est || est.fase === "espera") return;
    s = TM.crear({ semilla: est.semilla || 1, subeCada: SUBE_CADA });
    aplicada = 0;
  }

  /* ---------- el bucle ---------- */
  function bucle(ahora) {
    if (muerto) return;
    raf = requestAnimationFrame(bucle);
    const dt = Math.min(100, ahora - t0);
    t0 = ahora;
    if (!s || !est) return;
    if (juego() && !s.fin) {
      const deben = est.basura[uid] || 0;
      if (deben > aplicada) { TM.recibe(s, deben - aplicada); aplicada = deben; }
      mando.paso(dt);
      s.blando = mando.blando;
      TM.avanza(s, dt);
      eventos();
      if (s.salida > 0) {
        const n = Math.min(12, s.salida);
        s.salida = 0;
        const a = blancoTetris(est, uid);
        if (a) jugar({ t: "ataque", uid, a, n }).catch(() => {});
      }
      if (s.fin && !caidaEnviada) {
        caidaEnviada = true;
        suena("derrota");
        jugar({ t: "cae", uid, l: s.lineas, p: s.puntos }).catch(() => { caidaEnviada = false; });
      }
      if (ahora - vivoT > VIVO_MS) {
        vivoT = ahora;
        fb.tetrisVivo(pid, uid, { r: TM.resumen(s), l: s.lineas, p: s.puntos, n: s.nivel, f: s.fin ? 1 : 0 });
      }
    } else if (s && !s.fin && est.fuera[uid]) s.fin = true;
    dibuja();
  }

  function eventos() {
    const ev = s.eventos.splice(0);
    let fuerte = "";
    for (const e of ev) {
      if (e.e === "fija") {
        if (e.n >= 4 || e.ts) fuerte = "estalla";
        else if (e.n > 0 && fuerte !== "estalla") fuerte = "golpe";
        else if (!fuerte) fuerte = "ficha";
        if (e.n > 0 || e.ts) aviso(e);
      } else if (e.e === "basura" && !fuerte) fuerte = "martillo";
      else if (e.e === "nivel") suena("turno");
    }
    if (fuerte) suena(fuerte);
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
    el.classList.remove("ve"); void el.offsetWidth; el.classList.add("ve");
    clearTimeout(avisoT);
    avisoT = setTimeout(() => el.classList.remove("ve"), 1400);
  }

  function dibuja() {
    const cv = raiz.querySelector("#ttPozo");
    const c = cv.getContext("2d");
    TM.pintaPozo(c, s, { celda: CELDA });
    const g = raiz.querySelector("#ttGuarda").getContext("2d");
    g.clearRect(0, 0, 96, 72);
    TM.pintaPieza(g, s.guardada, 48, 36, 18, s.puedeGuardar ? 1 : 0.35);
    const q = raiz.querySelector("#ttCola").getContext("2d");
    q.clearRect(0, 0, 96, 300);
    s.cola.slice(0, 5).forEach((t, i) => TM.pintaPieza(q, t, 48, 30 + i * 60, i ? 14 : 18));
    const pend = TM.pendiente ? TM.pendiente(s) : 0;
    pon("ttBasura", `<i style="height:${Math.min(100, pend * 100 / HV)}%"></i>`);
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
    const n = est.hist.length ? est.hist[est.hist.length - 1].i : -1;
    if (visto >= 0 && n > visto) {
      for (const e of est.hist) if (e.i > visto && e.e === "ataque" && e.a === uid) suena("golpe");
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
    cancelAnimationFrame(raf);
    clearTimeout(avisoT);
    document.removeEventListener("keydown", teclaAbajo);
    document.removeEventListener("keyup", teclaArriba);
    if (window.Mando && cfgMando) window.Mando.libera(cfgMando);
    document.removeEventListener("visibilitychange", alOcultar);
    if (desVivo) desVivo();
    if (raiz) raiz.remove();
  }

  return { montar, actualizar, destruir, ocupado: () => false };
}
