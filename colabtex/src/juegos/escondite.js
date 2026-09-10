"use strict";
/* ============================================================
   Escondite — la pantalla

   Tres fases y ni una más: **esconder** (cada uno coloca su persona en
   su propio paisaje), **revelar** (los dos publican dónde) y **buscar**
   (se cruzan los paisajes y gana quien encuentre antes al otro).

   Por qué hay una fase de revelar y no se manda el sitio directamente:
   el que escribiera segundo vería el escondite del primero en la base
   antes de elegir el suyo. Así que primero se publica el hash del sitio
   con una sal (`compromiso`) y solo cuando los dos han publicado el suyo
   se sueltan las coordenadas. Nadie puede cambiar de sitio a la vista
   del otro.

   La frontera honesta, dicha aquí porque es aquí donde se ve: el
   navegador que busca tiene que poder juzgar el clic, así que las
   coordenadas del otro están en su memoria durante la búsqueda y quien
   abra las herramientas del navegador las verá. No hay forma de evitarlo
   sin un servidor que arbitre, y esto es un juego entre amigos.

   El sitio elegido se guarda además en `localStorage`: entre que se
   publica el compromiso y se revela, el único sitio del mundo donde
   están esas coordenadas es esta pestaña. Una recarga sin eso dejaba la
   partida colgada para siempre en «revelar», sin nadie capaz de abrirla.
   ============================================================ */
import {
  escena, semillaEscena, salAleatoria, compromiso, sitioValido,
  acierta, RADIO_ACIERTO, CASTIGO_FALLO
} from "./motor.js";
import { pinta, pintaPersona } from "./paisaje.js";

/* Lo que dura colocarse. Sesenta segundos son de sobra para elegir un
   escondite y demasiado poco para pensárselo, que es justo el punto. */
const TIEMPO_ESCONDER = 60000;

const clave = (pid, uid) => `jg.escondite.${pid}.${uid}`;

function guardaSecreto(pid, uid, s) {
  try { localStorage.setItem(clave(pid, uid), JSON.stringify(s)); } catch (e) {}
}
function leeSecreto(pid, uid) {
  try { return JSON.parse(localStorage.getItem(clave(pid, uid)) || "null"); } catch (e) { return null; }
}

export function crearEscondite(ctx) {
  const { uid, pid, jugar, terminar, ahora } = ctx;

  let host = null, lienzo = null, c2d = null, ro = null, tic = null;
  let p = null, est = null;
  let escCache = { semilla: -1, esc: null };
  let propuesta = null;            // {x,y} colocada pero sin confirmar
  let enviando = false;            // evita mandar el mismo compromiso dos veces
  let bloqueoHasta = 0;            // castigo por fallar
  let vistaW = 0, vistaH = 0;      // tamaño en píxeles CSS, no del búfer
  let muerto = false;

  /* ---------- estructura ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-esc">
        <div class="jg-barra">
          <div class="jg-fase" id="escFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-reloj" id="escReloj"></div>
        </div>
        <div class="jg-lienzo" id="escLienzo"><canvas id="escCanvas"></canvas>
          <div class="jg-capa" id="escCapa"></div>
        </div>
        <div class="jg-pie" id="escPie"></div>
      </div>`;
    lienzo = host.querySelector("#escCanvas");
    c2d = lienzo.getContext("2d");
    lienzo.addEventListener("click", alClic);
    ro = new ResizeObserver(() => { medir(); pintar(); });
    ro.observe(host.querySelector("#escLienzo"));
    /* Un tic por segundo: la cuenta atrás y el cronómetro no dependen de
       que llegue nada de la base, y el castigo por fallar tiene que
       levantarse solo. */
    tic = setInterval(() => { if (!muerto) { render(); pintar(); } }, 250);
    medir();
  }

  function medir() {
    if (!lienzo) return;
    const caja = lienzo.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(320, Math.round(caja.width)), H = Math.round(W * 0.62);
    vistaW = W; vistaH = H;
    lienzo.style.height = H + "px";
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function destruir() {
    muerto = true;
    if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; }
    if (tic) { clearInterval(tic); tic = null; }
    if (host) host.innerHTML = "";
    host = lienzo = c2d = null;
  }

  /* ---------- quién es quién ---------- */
  const yo = () => (est ? est.jugadores.find(j => j.uid === uid) : null);
  const otro = () => (est ? est.jugadores.find(j => j.uid !== uid) : null);

  /* En «esconder» miro mi paisaje; en «buscar», el suyo. Cada paisaje
     sale de la semilla de la partida y del orden de entrada, así que los
     dos clientes generan los dos sin mandarse un solo píxel. */
  function escenaActual() {
    if (!p || !est) return null;
    const quien = est.fase === "buscar" || est.fase === "fin" ? otro() : yo();
    if (!quien) return null;
    const s = semillaEscena(p.semilla, quien.orden || 0);
    if (escCache.semilla !== s) escCache = { semilla: s, esc: escena(s) };
    return escCache.esc;
  }

  /* ---------- pintar ---------- */
  function pintar() {
    if (!c2d || !lienzo) return;
    const W = vistaW, H = vistaH;
    if (!W || !H) return;
    const esc = escenaActual();
    if (!esc) { c2d.fillStyle = "#dde5ea"; c2d.fillRect(0, 0, W, H); return; }
    pinta(c2d, esc, W, H);

    const f = est ? est.fase : "espera";
    const mi = yo(), su = otro();

    if (f === "esconder" || f === "revelar") {
      const s = est.sitios[uid] || leeSecreto(pid, uid) || propuesta;
      if (s) pintaPersona(c2d, s.x, s.y, W, H, (mi && mi.color) || "#e0653a", !est.compromisos[uid]);
      if (propuesta && !est.compromisos[uid]) marco(c2d, propuesta.x * W, propuesta.y * H, W, "#ffffff");
    } else if (f === "buscar" || f === "fin") {
      for (const t of (est.intentos[uid] || [])) if (!t.ok) cruz(c2d, t.x * W, t.y * H, W);
      const blanco = su ? est.sitios[su.uid] : null;
      const visto = est.fase === "fin" || (est.intentos[uid] || []).some(t => t.ok);
      if (blanco && visto) {
        pintaPersona(c2d, blanco.x, blanco.y, W, H, (su && su.color) || "#0f62fe", false);
        marco(c2d, blanco.x * W, blanco.y * H, W, "#ffe066");
      }
    }
    if (ahora() < bloqueoHasta) {
      c2d.fillStyle = "rgba(12,16,22,0.45)"; c2d.fillRect(0, 0, W, H);
    }
  }

  function marco(c, x, y, W, color) {
    c.save();
    c.strokeStyle = color; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.beginPath(); c.arc(x, y, RADIO_ACIERTO * W, 0, 7); c.stroke();
    c.restore();
  }
  function cruz(c, x, y, W) {
    const r = W * 0.011;
    c.save();
    c.strokeStyle = "#c0392b"; c.lineWidth = 2.4; c.lineCap = "round"; c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r);
    c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke();
    c.restore();
  }

  /* ---------- texto ---------- */
  function render() {
    if (!host || !est) return;
    const f = est.fase, mi = yo(), su = otro();
    const fase = host.querySelector("#escFase");
    const reloj = host.querySelector("#escReloj");
    const pie = host.querySelector("#escPie");
    const capa = host.querySelector("#escCapa");
    if (!fase) return;

    const restante = f === "esconder" ? Math.max(0, quedaEsconder()) : 0;
    const seg = n => String(Math.ceil(n / 1000));

    if (f === "espera") {
      fase.innerHTML = `<b>Esperando</b> a que entre alguien`;
      reloj.textContent = "";
      pie.innerHTML = `<span class="jg-nota">Comparte el enlace de la sala o espera en el vestíbulo.</span>`;
    } else if (f === "esconder") {
      const listo = !!est.compromisos[uid];
      fase.innerHTML = listo
        ? `<b>Escondido.</b> Esperando a ${escapa(su ? su.nombre : "el otro")}`
        : `<b>Esconde a tu persona</b> — pincha en el paisaje`;
      reloj.textContent = seg(restante) + " s";
      reloj.className = "jg-reloj" + (restante < 10000 ? " urge" : "");
      pie.innerHTML = listo
        ? `<span class="jg-nota">Tu sitio ya está sellado: nadie puede verlo hasta que los dos hayáis terminado.</span>`
        : `<button class="jg-btn" id="escOk"${propuesta ? "" : " disabled"}>Esconder aquí</button>
           <span class="jg-nota">${propuesta ? "¿Seguro? No se podrá mover." : "Pincha donde quieras esconderte. Cuanto más se confunda con el fondo, mejor."}</span>`;
      const b = host.querySelector("#escOk");
      if (b) b.onclick = confirmar;
    } else if (f === "revelar") {
      fase.innerHTML = `<b>Cruzando los paisajes…</b>`;
      reloj.textContent = "";
      pie.innerHTML = `<span class="jg-nota">Los dos habéis escondido. Se están destapando los sitios.</span>`;
    } else if (f === "buscar") {
      const desde = est.arranque || ahora();
      fase.innerHTML = `<b>Busca a ${escapa(su ? su.nombre : "el otro")}</b> en su paisaje`;
      reloj.textContent = seg(Math.max(0, ahora() - desde)) + " s";
      reloj.className = "jg-reloj";
      const espera = Math.max(0, bloqueoHasta - ahora());
      const fallos = (est.intentos[uid] || []).filter(t => !t.ok).length;
      pie.innerHTML = espera
        ? `<span class="jg-castigo">Fallaste — espera ${seg(espera)} s</span>`
        : `<span class="jg-nota">${fallos ? fallos + (fallos === 1 ? " fallo" : " fallos") + " · " : ""}Cada fallo cuesta ${CASTIGO_FALLO / 1000} s. Gana quien encuentre primero.</span>`;
    } else if (f === "fin") {
      const gane = est.ganador === uid;
      fase.innerHTML = gane ? `<b class="jg-gana">¡Le encontraste!</b>` : `<b class="jg-pierde">Te encontró ${escapa(su ? su.nombre : "el otro")}</b>`;
      reloj.textContent = "";
      pie.innerHTML = `<span class="jg-nota">${est.motivo === "abandono"
        ? "La partida terminó porque alguien se fue."
        : "El escondite del otro queda marcado en amarillo."}</span>`;
    }
    capa.style.display = "none";
  }

  const escapa = s => String(s || "").replace(/[&<>"]/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]));

  /* Cuándo empezó la fase de esconder: cuando entró el segundo. Los `at`
     de las fichas los pone cada navegador con su reloj, así que esto es
     aproximado — y puede serlo, porque de que se acabe el tiempo solo
     depende que se coloque un escondite al azar, no quién gana. */
  function quedaEsconder() {
    const ats = (est ? est.jugadores : []).map(j => j.at || 0).filter(Boolean);
    if (ats.length < 2) return TIEMPO_ESCONDER;
    return Math.max(...ats) + TIEMPO_ESCONDER - ahora();
  }

  /* ---------- clics ---------- */
  function coords(ev) {
    const r = lienzo.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  }

  async function alClic(ev) {
    if (!est) return;
    const q = coords(ev);
    if (est.fase === "esconder" && !est.compromisos[uid]) {
      if (!sitioValido(q)) return;
      propuesta = q; render(); pintar();
      return;
    }
    if (est.fase === "buscar") {
      if (ahora() < bloqueoHasta) return;
      const su = otro(); if (!su) return;
      const blanco = est.sitios[su.uid];
      const ok = !!blanco && acierta(q, blanco);
      /* El castigo se aplica aquí y ya, sin esperar a que la jugada
         llegue a la base: si no, dos clics seguidos se colaban antes de
         que el registro dijera nada. */
      if (!ok) bloqueoHasta = ahora() + CASTIGO_FALLO;
      render(); pintar();
      await jugar({ t: "b", uid, x: q.x, y: q.y, at: ahora() });
    }
  }

  async function confirmar() {
    if (!propuesta || enviando || !est || est.compromisos[uid]) return;
    enviando = true;
    try {
      const sitio = { x: +propuesta.x.toFixed(4), y: +propuesta.y.toFixed(4) };
      const sal = salAleatoria();
      const h = await compromiso(sitio, sal);
      guardaSecreto(pid, uid, { x: sitio.x, y: sitio.y, sal });
      await jugar({ t: "c", uid, h });
    } finally { enviando = false; }
  }

  /* ---------- lo que se hace solo ---------- */
  async function automatismos() {
    if (!est || !p) return;
    if (est.fase === "esconder" && !est.compromisos[uid] && !enviando) {
      /* Se acabó el tiempo sin colocarse: se coloca solo. Dejar la
         partida bloqueada porque alguien se fue a por café es peor que
         un escondite mediocre. */
      if (quedaEsconder() <= 0) {
        propuesta = propuesta || { x: 0.1 + Math.random() * 0.8, y: 0.3 + Math.random() * 0.6 };
        await confirmar();
      }
      return;
    }
    if (est.fase === "revelar" && !est.sitios[uid] && !enviando) {
      const s = leeSecreto(pid, uid);
      if (!s) return;                        // otra pestaña lo tiene; ella lo revelará
      enviando = true;
      try { await jugar({ t: "r", uid, x: s.x, y: s.y, sal: s.sal, at: ahora() }); }
      finally { enviando = false; }
    }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    if (est && est.fase !== "esconder") propuesta = null;
    render(); pintar();
    automatismos();
    if (est && est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
