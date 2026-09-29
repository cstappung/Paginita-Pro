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
  acierta, RADIO_ACIERTO, CASTIGO_FALLO,
  TEMAS, GORROS, CAMISETAS, ACCESORIOS, traje as decodifica, codigoTraje, describeTraje
} from "./motor.js";
import { pinta, pintaExplorador, pintaCobertura, pintaCartel } from "./paisaje.js";
import { suena } from "./sonido.js";

/* La última jugada del registro, en crudo. El reductor no guarda quién
   la hizo —no le hace falta para dibujar— y el sonido sí: un disparo
   propio y uno ajeno no pueden sonar igual. */
function ultimaJugada(partida) {
  const js = (partida && partida.jugadas) || {};
  const ks = Object.keys(js).sort();
  return ks.length ? js[ks[ks.length - 1]] : null;
}

/* Lo que dura colocarse. Sesenta segundos son de sobra para elegir un
   escondite y demasiado poco para pensárselo, que es justo el punto. */
const TIEMPO_ESCONDER = 90000;

/* A los cuarenta segundos de búsqueda aparece un cerco flojo alrededor
   del escondite. Es justo, aunque suene a trampa: `arranque` viene del
   registro y las dos máquinas lo leen igual, así que la ayuda llega a
   los dos en el mismo instante — y quien ya haya encontrado al otro
   antes no la ve nunca. Sin ella, dos personas cabezotas se quedaban
   veinte minutos pinchando un bosque. */
const PISTA_MS = 40000;
const RADIO_PISTA = 0.16;

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
  let vistas = -1;                 // cuántas jugadas llevaba el registro
  let sonoBuscar = false;
  let vistaW = 0, vistaH = 0;      // tamaño en píxeles CSS, no del búfer
  let muerto = false, zoom = 1, buscando = false, cursorTeclado = null;
  let fondo = null, firmaFondo = "", reintentarDesde = 0;
  /* El disfraz se elige por prendas: gorro, camiseta y accesorio. El
     código que viaja (`traje`) es la combinación, 144 posibles, y la
     escena garantiza que nadie de la multitud la repite entera. */
  let vest = { h: 0, s: 0, a: 0 }, traje = 0;
  let lupa = null, lupaPedida = false, firmaCartel = "";

  /* ---------- estructura ---------- */
  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-esc esc-rework">
        <div class="esc-editorial"><div class="esc-titular"><span id="escTema">DUELO DE OBSERVACIÓN</span><h2>Perdidos entre la multitud.</h2><p id="escObjetivo">Vístete, mézclate con la gente y confirma tu escondite.</p></div>
          <figure class="esc-cartel"><figcaption id="escCartelTit">SE BUSCA</figcaption><canvas id="escCartel"></canvas><small id="escCartelTxt"></small></figure></div>
        <div class="esc-herramientas">
          <div class="esc-prendas" id="escPrendas">
            <div class="esc-fila"><b>Gorro</b>${GORROS.map((g, i) => `<button class="esc-chip" data-p="h" data-i="${i}" title="Gorro ${g.n}" style="--c:${g.c}"></button>`).join("")}</div>
            <div class="esc-fila"><b>Camiseta</b>${CAMISETAS.slice(0, 6).map((t, i) => `<button class="esc-chip${t.r ? " rayas" : ""}" data-p="s" data-i="${i}" title="Camiseta ${t.n}" style="--c:${t.c};--r:${t.r || t.c}"></button>`).join("")}</div>
            <div class="esc-fila"><b>Lleva</b>${["Nada", "Mochila", "Globo", "Bastón"].map((t, i) => `<button class="esc-chip txt" data-p="a" data-i="${i}" title="${ACCESORIOS[i]}">${t}</button>`).join("")}</div>
          </div>
          <label>Explorar <select id="escZoom"><option value="1">Vista completa</option><option value="1.5">Zoom 1,5×</option><option value="2">Zoom 2×</option><option value="3">Zoom 3×</option></select></label>
        </div>
        <div class="jg-barra">
          <div class="jg-fase" id="escFase"></div>
          <div class="jg-grow"></div>
          <span class="esc-rival" id="escRival"></span>
          <div class="jg-reloj" id="escReloj"></div>
        </div>
        <div class="esc-visor"><div class="jg-lienzo" id="escLienzo"><canvas id="escCanvas" tabindex="0" aria-label="Paisaje interactivo. Usa las flechas para mover el cursor y Enter para elegir." ></canvas>
          <div class="jg-capa" id="escCapa"></div>
        </div>
        </div><div class="jg-pie" id="escPie" aria-live="polite"></div>
        <details class="esc-ayuda"><summary>Cómo jugar</summary><p>Tienes 90 segundos para vestirte —gorro, camiseta y lo que llevas en la mano— y esconderte en tu escena. Tu combinación es única: nadie de la multitud la lleva entera, pero muchos comparten dos de las tres prendas. Lo que tengas justo delante tapa tus piernas, nunca la cabeza; en el agua solo asoman cabeza y hombros. Después buscas a tu rival en la suya, con su cartel de SE BUSCA a la vista. Con ratón, la lupa amplía lo que tienes debajo; también puedes hacer zoom y desplazarte. Cada fallo bloquea los intentos durante dos segundos, y a los 40 segundos aparece una pista.</p><p>Teclado: flechas para mover el cursor, Enter para colocar o buscar. Música: Midnight Pulse · pista aportada por el creador · reproducción en bucle.</p></details>
      </div>`;
    lienzo = host.querySelector("#escCanvas");
    c2d = lienzo.getContext("2d");
    lienzo.addEventListener("click", alClic);
    host.querySelector("#escPrendas").onclick = e => {
      const b = e.target.closest(".esc-chip");
      if (!b || b.disabled) return;
      vest = { ...vest, [b.dataset.p]: Number(b.dataset.i) };
      traje = codigoTraje(vest);
      render(); pintar();
    };
    /* La lupa: solo con ratón. En táctil ya está el zoom, y el dedo
       taparía justo lo que se amplía. Como mucho un repintado por
       fotograma. */
    lienzo.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = lienzo.getBoundingClientRect();
      lupa = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!lupaPedida) { lupaPedida = true; requestAnimationFrame(() => { lupaPedida = false; pintar(); }); }
    });
    lienzo.addEventListener("pointerleave", () => { lupa = null; pintar(); });
    host.querySelector("#escZoom").onchange = e => {
      zoom = Number(e.target.value); host.querySelector("#escLienzo").style.width = (zoom*100)+"%"; medir(); pintar();
    };
    let cursor = {x:.5,y:.5};
    lienzo.addEventListener("keydown", e => {
      const dirs = {ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};
      if (dirs[e.key]) {e.preventDefault(); cursor.x=Math.max(.03,Math.min(.97,cursor.x+dirs[e.key][0])); cursor.y=Math.max(.2,Math.min(.97,cursor.y+dirs[e.key][1])); cursorTeclado = {...cursor}; pintar();}
      else if (e.key === "Enter") {e.preventDefault(); const r=lienzo.getBoundingClientRect();alClic({clientX:r.left+cursor.x*r.width,clientY:r.top+cursor.y*r.height});}
    });
    ro = new ResizeObserver(() => { medir(); pintar(); });
    ro.observe(host.querySelector("#escLienzo"));
    /* Un tic por segundo: la cuenta atrás y el cronómetro no dependen de
       que llegue nada de la base, y el castigo por fallar tiene que
       levantarse solo. */
    tic = setInterval(() => { if (!muerto) { render(); pintar(); automatismos().catch(muestraError); } }, 250);
    medir();
  }

  function medir() {
    if (!lienzo) return;
    const caja = lienzo.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(240, Math.round(caja.width)), H = Math.round(W * 0.62);
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
    /* La multitud depende del disfraz buscado: quien coincida en las tres
       prendas cambia de accesorio. Por eso el disfraz entra en la firma. */
    const t = trajeBuscado();
    const obj = decodifica(t);
    const firma = `${esc.semilla}:${W}:${H}:${t}`;
    if (firma !== firmaFondo) {
      fondo = document.createElement("canvas"); fondo.width = lienzo.width; fondo.height = lienzo.height;
      const c = fondo.getContext("2d"); c.scale(fondo.width/W, fondo.height/H); pinta(c, esc, W, H, obj); firmaFondo = firma;
    }
    c2d.drawImage(fondo, 0, 0, W, H);
    encima(c2d, esc, W, H);
    /* La lupa repinta la escena de verdad, no amplía el mapa de bits: a
       2,5× un mapa de bits es un borrón, y lo que se busca es un gorro de
       tres píxeles. */
    if (lupa && est && (est.fase === "buscar" || est.fase === "esconder")) {
      const r = Math.min(W * 0.11, 120), k = 2.5;
      c2d.save();
      c2d.beginPath(); c2d.arc(lupa.x, lupa.y, r, 0, 7); c2d.clip();
      c2d.translate(lupa.x, lupa.y); c2d.scale(k, k); c2d.translate(-lupa.x, -lupa.y);
      pinta(c2d, esc, W, H, obj);
      encima(c2d, esc, W, H);
      c2d.restore();
      c2d.save();
      c2d.strokeStyle = "#1d2a26"; c2d.lineWidth = 4;
      c2d.beginPath(); c2d.arc(lupa.x, lupa.y, r, 0, 7); c2d.stroke();
      c2d.strokeStyle = "#f3edd9"; c2d.lineWidth = 1.5;
      c2d.beginPath(); c2d.arc(lupa.x, lupa.y, r - 2.5, 0, 7); c2d.stroke();
      c2d.restore();
    }
    if (cursorTeclado) marco(c2d,cursorTeclado.x*W,cursorTeclado.y*H,W,"#fff");
    if (ahora() < bloqueoHasta) {
      c2d.fillStyle = "rgba(12,16,22,0.45)"; c2d.fillRect(0, 0, W, H);
    }
  }

  /* El disfraz que la escena en pantalla esconde: el mío mientras me
     escondo (lo que verá el otro), el del rival mientras le busco. */
  function trajeBuscado() {
    if (!est) return traje;
    const f = est.fase;
    if (f === "buscar" || f === "fin") {
      const su = otro(), s = su && est.sitios[su.uid];
      return s ? (s.traje || 0) : 0;
    }
    return trajePropio();
  }
  function trajePropio() {
    if (!est || !est.compromisos[uid]) return traje;
    const s = est.sitios[uid] || leeSecreto(pid, uid);
    return s ? (s.traje || 0) : traje;
  }

  /* Lo que va encima del fondo: el escondido, lo que le tapa, las cruces
     y el foco final. Separado para que la lupa lo repinte igual. */
  function encima(c2d, esc, W, H) {
    const f = est ? est.fase : "espera";
    const su = otro();

    if (f === "esconder" || f === "revelar") {
      const s = est.sitios[uid] || propuesta || leeSecreto(pid, uid);
      if (s) { const vestido = {...s, traje: est.compromisos[uid] ? s.traje : traje}; pintaExplorador(c2d, vestido, W, H, esc); pintaCobertura(c2d, esc, vestido, W, H); }
      if (propuesta && !est.compromisos[uid]) marco(c2d, propuesta.x * W, propuesta.y * H, W, "#ffffff");
    } else if (f === "buscar" || f === "fin") {
      /* **El personaje se dibuja desde el primer segundo.** Antes solo
         aparecía al encontrarlo o al acabar la partida, y eso no era un
         escondite: era buscar algo que no estaba en la pantalla. Se
         probó con un amigo y el veredicto fue exacto — «es invisible e
         imposible de encontrar, y no estaba donde lo puso» —, porque en
         efecto no estaba en ningún sitio hasta que el reloj lo decidía.
         Dibujado, el juego es lo que prometía: una figura pequeña entre
         doscientas piezas parecidas, difícil pero honesta. */
      const blanco = su ? est.sitios[su.uid] : null;
      const visto = est.fase === "fin" || (est.intentos[uid] || []).some(t => t.ok);
      if (blanco && f === "buscar" && !visto && ahora() - (est.arranque || 0) > PISTA_MS) {
        cerco(c2d, blanco.x * W, blanco.y * H, W);
      }
      if (blanco) { pintaExplorador(c2d, blanco, W, H, esc); pintaCobertura(c2d, esc, blanco, W, H); }
      /* Las cruces van encima del personaje: son lo que ya se ha
         descartado, y taparlas con la figura sería esconder la única
         cuenta que lleva quien busca. */
      for (const t of (est.intentos[uid] || [])) if (!t.ok) cruz(c2d, t.x * W, t.y * H, W);
      if (blanco && visto) foco(c2d, blanco.x * W, blanco.y * H, W, H);
    }
  }

  /* El foco del final: todo se apaga menos el escondite. Es el momento
     «¡ahí estaba!» del libro, y un círculo punteado solo no lo daba. */
  function foco(c, x, y, W, H) {
    const r = RADIO_ACIERTO * W * 1.6;
    c.save();
    c.fillStyle = "rgba(8,10,16,0.55)";
    c.beginPath(); c.rect(0, 0, W, H); c.arc(x, y, r, 0, 7); c.fill("evenodd");
    c.strokeStyle = "#ffe066"; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.restore();
  }

  function marco(c, x, y, W, color) {
    c.save();
    c.strokeStyle = color; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.beginPath(); c.arc(x, y, RADIO_ACIERTO * W, 0, 7); c.stroke();
    c.restore();
  }
  /* El cerco de la pista: ancho, flojo y sin borde duro, para que diga
     «por aquí» y no «aquí». */
  function cerco(c, x, y, W) {
    const r = RADIO_PISTA * W;
    c.save();
    const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, "rgba(255,224,102,0.30)");
    g.addColorStop(1, "rgba(255,224,102,0)");
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
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
    const focoConfirmar = document.activeElement?.id === "escOk";
    const f = est.fase, mi = yo(), su = otro();
    const cerrado = f !== "esconder" || !!est.compromisos[uid];
    const puesto = decodifica(trajePropio());
    host.querySelectorAll(".esc-chip").forEach(b => {
      b.disabled = cerrado;
      b.classList.toggle("sel", Number(b.dataset.i) === puesto[b.dataset.p]);
    });
    host.querySelector("#escPrendas").classList.toggle("fijo", cerrado);
    const esc = escenaActual();
    host.querySelector("#escTema").textContent = esc ? `${TEMAS[esc.tema].nombre.toUpperCase()} · DUELO DE OBSERVACIÓN` : "DUELO DE OBSERVACIÓN";
    const cazando = f === "buscar" || f === "fin";
    const objetivo = su && est.sitios[su.uid];
    host.querySelector("#escObjetivo").textContent = cazando && objetivo
      ? "Busca a quien lleve " + describeTraje(objetivo.traje || 0) + "."
      : "Vístete, mézclate con la gente y confirma tu escondite.";
    cartel(cazando, objetivo, su);
    rival(cazando, su);
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
      const cal = calor(su);
      pie.innerHTML = espera
        ? `<span class="jg-castigo">Fallaste — espera ${seg(espera)} s${cal ? " · " + escapa(cal.texto) : ""}</span>`
        : `<span class="jg-nota">${cal ? `<b class="jg-calor jg-calor-${cal.clase}">${escapa(cal.texto)}</b> · ` : ""}${fallos ? fallos + (fallos === 1 ? " fallo" : " fallos") + " · " : ""}Cada fallo cuesta ${CASTIGO_FALLO / 1000} s. Gana quien encuentre primero.</span>`;
    } else if (f === "fin") {
      const gane = est.ganador === uid;
      fase.innerHTML = gane ? `<b class="jg-gana">¡Le encontraste!</b>` : `<b class="jg-pierde">Te encontró ${escapa(su ? su.nombre : "el otro")}</b>`;
      reloj.textContent = "";
      pie.innerHTML = `<span class="jg-nota">${est.motivo === "abandono"
        ? "La partida terminó porque alguien se fue."
        : "El escondite queda cercado en amarillo."}</span>`;
    }
    capa.style.display = "none";
    if (focoConfirmar) host.querySelector("#escOk")?.focus({preventScroll:true});
  }

  /* Lo caliente o frío del último fallo. La distancia se mide con la
     misma corrección de aspecto que `acierta` (el lienzo es más ancho
     que alto), o «caliente» querría decir una cosa a lo ancho y otra a
     lo alto. Es información que el navegador ya tiene — las coordenadas
     del otro están en su memoria para poder juzgar el clic —, así que
     decirla en voz alta no revela nada nuevo y convierte el juego en
     una búsqueda que converge. */
  function calor(su, quien = uid) {
    if (!est || !su) return null;
    const blanco = est.sitios[su.uid];
    const t = (est.intentos[quien] || []).filter(x => !x.ok).slice(-1)[0];
    if (!blanco || !t) return null;
    const d = Math.hypot(t.x - blanco.x, (t.y - blanco.y) * 0.62);
    if (d < 0.08) return { clase: "casi", texto: "¡Casi!" };
    if (d < 0.18) return { clase: "caliente", texto: "Caliente" };
    if (d < 0.32) return { clase: "templado", texto: "Templado" };
    return { clase: "frio", texto: "Frío" };
  }

  /* El cartel: el disfraz en grande, como la lámina de Wally al principio
     del libro. Mientras me escondo es el mío («así te buscarán»); luego,
     el del rival. Se repinta solo si cambia lo que muestra. */
  function cartel(cazando, objetivo, su) {
    const cv = host.querySelector("#escCartel");
    if (!cv) return;
    const t = cazando ? (objetivo ? objetivo.traje || 0 : -1) : trajePropio();
    host.querySelector("#escCartelTit").textContent = cazando ? "SE BUSCA" : "ASÍ TE BUSCARÁN";
    host.querySelector("#escCartelTxt").textContent = t < 0 ? "Aún no se sabe" : (cazando && su ? su.nombre + " · " : "") + describeTraje(t);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 84, H = 104;
    const firma = `${t}:${dpr}`;
    if (firma === firmaCartel) return;
    firmaCartel = firma;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (t < 0) { c.clearRect(0, 0, W, H); c.fillStyle = "#8a7a5a"; c.font = "bold 40px Georgia,serif"; c.textAlign = "center"; c.fillText("?", W / 2, H * 0.62); return; }
    pintaCartel(c, t, W, H);
  }

  /* Cómo le va al otro buscándome: sus fallos y lo cerca que pasó el
     último. Un duelo en el que no se ve al rival es un solitario. */
  function rival(cazando, su) {
    const el = host.querySelector("#escRival");
    if (!el) return;
    if (!cazando || !su || est.fase !== "buscar") { el.innerHTML = ""; return; }
    const n = (est.intentos[su.uid] || []).filter(t => !t.ok).length;
    const cal = calor(yo(), su.uid);
    el.innerHTML = `${escapa(su.nombre)}: ${n ? n + (n === 1 ? " fallo" : " fallos") : "aún no ha pinchado"}${cal ? ` · <b class="jg-calor jg-calor-${cal.clase}">${escapa(cal.texto)}</b>` : ""}`;
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
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) return;
    if (est.fase === "esconder" && !est.compromisos[uid]) {
      if (!sitioValido(q)) return;
      propuesta = q; render(); pintar();
      return;
    }
    if (est.fase === "buscar") {
      if (ahora() < bloqueoHasta || buscando) return;
      const su = otro(); if (!su) return;
      const blanco = est.sitios[su.uid];
      const ok = !!blanco && acierta(q, blanco);
      /* El castigo se aplica aquí y ya, sin esperar a que la jugada
         llegue a la base: si no, dos clics seguidos se colaban antes de
         que el registro dijera nada. */
      if (!ok) bloqueoHasta = ahora() + CASTIGO_FALLO;
      render(); pintar();
      buscando = true;
      try { await jugar({ t: "b", uid, x: q.x, y: q.y, at: ahora() }); }
      catch (e) { bloqueoHasta = 0; muestraError(e); } finally { buscando = false; }
    }
  }

  async function confirmar() {
    if (!propuesta || enviando || !est || est.compromisos[uid]) return;
    enviando = true;
    try {
      const sitio = { x: +propuesta.x.toFixed(4), y: +propuesta.y.toFixed(4), traje };
      const sal = salAleatoria();
      const h = await compromiso(sitio, sal);
      guardaSecreto(pid, uid, { ...sitio, sal });
      await jugar({ t: "c", uid, h });
    } catch (e) { muestraError(e); } finally { enviando = false; }
  }

  /* ---------- lo que se hace solo ---------- */
  async function automatismos() {
    if (!est || !p || muerto || ahora() < reintentarDesde) return;
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
      try { await jugar({ t: "r", uid, x: s.x, y: s.y, traje: s.traje || 0, sal: s.sal, at: ahora() }); }
      finally { enviando = false; }
    }
  }

  /* El sonido va por el registro, no por el clic: así también se oye lo
     que hace el otro, que en un escondite es justo lo que no se ve. */
  function suenaJugada(partida) {
    const j = ultimaJugada(partida);
    if (!j) return;
    if (j.t === "c") { suena("clic"); return; }
    if (j.t !== "b") return;
    const dio = est && est.ganador === j.uid;
    suena(dio ? (j.uid === uid ? "gana" : "pierde") : "ficha");
  }

  function muestraError(e) {
    reintentarDesde = ahora() + 5000;
    if (host) host.querySelector("#escPie").textContent = "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
  }
  function actualizar(partida, estado) {
    p = partida; est = estado;
    const ultimoFallo = (est?.intentos?.[uid] || []).filter(t=>!t.ok).at(-1);
    if (ultimoFallo) bloqueoHasta = Math.max(bloqueoHasta, ultimoFallo.at + CASTIGO_FALLO);
    if (est && est.fase !== "esconder") propuesta = null;
    const n = Object.keys((partida && partida.jugadas) || {}).length;
    if (vistas >= 0 && n > vistas) suenaJugada(partida);
    vistas = n;
    if (est && est.fase === "buscar" && !sonoBuscar) { sonoBuscar = true; suena("entra"); }
    render(); pintar();
    automatismos().catch(muestraError);
    if (est && est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
