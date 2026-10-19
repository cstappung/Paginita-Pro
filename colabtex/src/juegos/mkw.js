import * as fb from "../fb-juegos.js";
import { db, auth, storage } from "../firebase.js";
import { ref as sRef, getMetadata, getBytes, uploadBytes } from "firebase/storage";
import { ref, get, set, query, orderByChild, limitToFirst, limitToLast, serverTimestamp } from "firebase/database";
import { revisaBt3 } from "./bt3-amigos.js";
import { escapeHtml } from "../util.js";
import { MKW_CPU, MKW_SINCRO_MAX, MKW_MODOS, MKW_CARRERAS, MKW_CC, mkwCarrera, mkwPlaylist, mkwTabla } from "./motor.js";

/* Mario Kart Wii (+ Retro Rewind) — el cartero entre la sala y el juego.

   El juego entero vive en `juegos/mkw/` (Mario Kart Wii traducido a WebAssembly; su programa sale del Worker de
   amigos, `juegos/mkw/privado.json`) y entra aquí en un iframe, como BT3. Este módulo no toca la carrera:

   - **La carrera va de marco a marco**: cada marco abre su propia malla WebRTC (`juegos/mkw/web/navegador/malla.mjs`)
     y el servidor en línea del juego (un "WFC" escrito por nosotros) corre en el marco del ANFITRIÓN. Cada juego entra
     solo a «VS mundial» y ahí se encuentran: la sala del juego, la votación de pista y las carreras son las del juego.
     Lo único que pasa por aquí es la **presentación**: el buzón de Firebase (`fb.senalMalla`, `vivo/<pid>/rtc`)
     vive en esta página, que tiene la sesión, y el marco lo usa por postMessage (`senal`, el mismo protocolo de BT3).
   - **Con CPU de relleno y hasta 4 pilotos** la tanda es una **carrera sincronizada** (`juegos/mkw/web/navegador/
     lockstep.mjs`): cada marco corre la misma «copa a tu gusto» offline (12 karts: los pilotos y CPU) y la malla
     reparte los botones de cada cuadro. Los pilotos quedan fijos al empezar (`est.sincro`, en orden: puerto 1–4); la
     semilla y las 4 pistas salen de la sala y del número de tanda (`mkwCarrera`), así todos calculan lo mismo. Quien
     llega con la tanda andando espera a la siguiente. Con más de 4 pilotos se corre en línea, sin CPU. (Desde el
     2026-10-19 ya no se ofrece: el dueño pidió primero Retro WFC tal cual; una sala nueva parte sin CPU.)
   - **Los modos de la sala** (`est.estilo`, pedido del dueño): «Retro WFC» (el bucle del juego: votar, correr, VR, sin
     fin), «Modo copa» (`est.carreras` carreras con puntos) y «Modo playlist» (una cola de pistas). Los tres corren
     sobre el modo en línea del juego; el marco recibe `?estilo=…&carreras=…` y el juego entra DIRECTO (por código,
     `juegos/mkw/web/navegador/directo.mjs`), sin pantallas de por medio.
   - **Al registro va solo el vestíbulo** (`redMkw` en `motor.js`): la CPU de relleno, quién es el anfitrión,
     empezar y volver. Cada jugador tiene su nodo (su dirección en la red del juego, 10.77.0.<nodo>).
   - **El VR y los récords** de cada uno van a Firebase (`mkw/vr/<uid>`, `mkw/records/…`): este módulo arma los
     almacenes con la base del sitio y se los pasa al marco (misma página, mismo origen) apenas carga.
   - Quien entra con las carreras andando carga el juego y entra solo: el juego lo deja mirando y lo suma en la
     carrera siguiente. Quien mira la sala sin ser jugador no carga el juego.

   Controles del juego: teclado, mandos y táctil (con inclinación) — @controles: tactil teclado */
const PADRE = "mkw-padre", HIJO = "mkw-hijo";
const PAGINA = "juegos/mkw/web/navegador/index.html";

/* De dónde sale el programa del juego (el Worker de amigos): `juegos/mkw/privado.json` = { "url": "https://…" }.
   Vacío = todavía no publicado (la sala lo dice en vez de abrir un marco que no puede cargar nada). */
let privado = null;
const urlPrivada = () => privado || (privado = fetch("juegos/mkw/privado.json", { cache: "no-cache" })
  .then(r => r.ok ? r.json() : {}).then(c => String(c.url || "").replace(/\/+$/, ""), () => ""));

/* Los almacenes de Firebase que usa el juego (vr.mjs, records.mjs: mio, guardar, top), sobre la base del sitio. */
const filas = s => { const l = []; s.forEach(h => { l.push(h.val()); }); return l; };
const almacenVr = {
  async mio(u) { const s = await get(ref(db, `mkw/vr/${u}`)); return s.exists() ? s.val() : null; },
  async guardar(u, dato) { await set(ref(db, `mkw/vr/${u}`), { ...dato, at: serverTimestamp() }); },
  async top(n) { return filas(await get(query(ref(db, "mkw/vr"), orderByChild("vr"), limitToLast(n)))).reverse(); },
};
const almacenRecords = {
  async mio(k, u) { const s = await get(ref(db, `mkw/records/${k}/${u}`)); return s.exists() ? s.val() : null; },
  async guardar(k, u, dato) { await set(ref(db, `mkw/records/${k}/${u}`), { ...dato, at: serverTimestamp() }); },
  async top(k, n) { return filas(await get(query(ref(db, `mkw/records/${k}`), orderByChild("ms"), limitToFirst(n)))); },
};

/* Las partidas de cada uno en la nube (juegos/mkw/web/navegador/nube.mjs): un paquete por cuenta en Storage,
   mkw/<uid>/partidas.mkwp (firebase/storage.rules: solo su dueño lo lee y lo escribe). El marco decide qué subir o
   bajar; esto solo habla con Firebase. Lo que va y viene se copia: los Uint8Array del marco son de otro "reino" de
   JavaScript y el SDK de Firebase los rechaza (revisa instanceof). */
const almacenPartidas = {
  async meta(ruta) {
    try {
      const m = await getMetadata(sRef(storage, ruta));
      const c = m.customMetadata || {};
      return { huella: c.huella || "", actualizado: Number(c.actualizado) || 0, jugado: Number(c.jugado) || 0,
               version: c.version || "", tam: m.size };
    } catch (e) {
      if (e?.code === "storage/object-not-found") return null;      // todavía no sube nada
      throw new Error(e?.code || String(e));
    }
  },
  async bajar(ruta) { return new Uint8Array(await getBytes(sRef(storage, ruta))); },
  async subir(ruta, bytes, meta) {
    const datos = new Uint8Array(bytes.byteLength); datos.set(bytes);
    const customMetadata = {};
    for (const k of ["uid", "huella", "actualizado", "jugado", "version"]) if (meta?.[k] != null) customMetadata[k] = String(meta[k]);
    await uploadBytes(sRef(storage, ruta), datos, { contentType: "application/octet-stream", customMetadata });
  },
};

/* La dirección del marco para este jugador: la malla de esta sala, su nodo, si corre el servidor, la CPU de relleno.
   Con `sincro` (los pilotos de la carrera sincronizada): la copa con su semilla y sus pistas, sin servidor en línea. */
export function srcMkw({ pid, uid, nodo, anfitrion, cpu, privado, ronda, sincro, estilo = "wfc", carreras = 4, cc = "c150" }) {
  const q = new URLSearchParams({ auto: "1", red: "malla", senal: "padre", sala: pid, uid, nodo: String(nodo) });
  if (sincro) {
    const { semilla, pistas } = mkwCarrera(pid, ronda);
    q.set("modo", "copa"); q.set("sincro", sincro.join(",")); q.set("semilla", String(semilla));
    q.set("pistas", pistas.map(t => `${t.copa}.${t.fila}`).join(",")); q.set("cpu", cpu);
  } else {
    q.set("modo", "enlinea"); q.set("relleno", cpu);
    q.set("estilo", estilo);
    // copa: cuántas carreras; playlist: la cola sorteada (igual en cada navegador); las dos: la cilindrada del anfitrión
    if (estilo === "copa") q.set("carreras", String(carreras));
    if (estilo === "playlist") q.set("pistas", mkwPlaylist(pid, ronda, carreras).map(t => `${t.copa}.${t.fila}`).join(","));
    if (estilo !== "wfc") q.set("cc", cc);
  }
  if (anfitrion && !sincro) q.set("anfitrion", "1");
  if (privado) q.set("privado", privado);
  q.set("r", String(ronda));
  return PAGINA + "?" + q.toString();
}

/* «Un jugador» dentro de Juegos (`#solo/mkw`): la página del juego a pantalla completa en un marco de ESTA página,
   como crearBt3Solo, para que le pida el token de quien inició sesión y saque lo privado del Worker de amigos. Abre
   con el menú de inicio «JloKart Wii» (juegos/mkw/web/navegador/inicio.mjs): su imagen también es privada (muestra a
   una persona real) y solo la entrega el Worker, a la lista AMIGOS. Solo para esa lista (revisaBt3, la misma de BT3):
   a los demás, «Este juego es privado». Lo que avisa el marco: `token` (se le contesta el de Firebase; nuevo = el
   anterior venció), `volver` (su «← Juegos») y `salas` (Multiplayer → Online: las salas de Mario Kart). Sus partidas y
   récords van a la cuenta, como en la sala (el VR no: solo se mueve en línea). */
export const srcMkwSolo = origen => PAGINA + "?" + new URLSearchParams({ senal: "padre", privado: origen }).toString();
export function crearMkwSolo({ volver, enLinea, revisar = revisaBt3, privadoUrl = urlPrivada }) {
  let host = null, frame = null, muerto = false, conecta = 0;
  const oye = e => {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "token") {
      const w = frame.contentWindow;
      Promise.resolve(auth.currentUser?.getIdToken(!!d.nuevo)).catch(() => null)
        .then(token => { if (!muerto && frame?.contentWindow === w) w.postMessage({ canal: PADRE, tipo: "token", token: token || null }, location.origin); });
    } else if (d.tipo === "volver") volver();
    else if (d.tipo === "salas") enLinea();
  };
  /* Apenas el marco carga: sus partidas (la página las espera hasta 4 s con senal=padre) y sus récords */
  function conectar() {
    clearInterval(conecta);
    let vueltas = 0;
    conecta = setInterval(() => {
      const w = frame?.contentWindow, u = auth.currentUser;
      if (muerto || !w || !u || ++vueltas > 120) { clearInterval(conecta); return; }
      if (typeof w.mkwConectarRecords !== "function") return;
      clearInterval(conecta);
      try {
        if (typeof w.mkwConectarNube === "function") w.mkwConectarNube({ almacen: almacenPartidas, uid: u.uid }).catch(() => {});
        w.mkwConectarRecords({ almacen: almacenRecords, uid: u.uid, nombre: String(u.displayName || "Piloto").slice(0, 20) });
      } catch (err) { console.warn("[mkw] no pude pasarle la nube al marco", err); }
    }, 250);
  }
  const aviso = texto => '<p class="jg-bt3-info' + (texto.privado ? ' jg-bt3-privado' : '') + '">' + texto.t + ' <a class="btn2" href="#">← Juegos</a></p>';
  return {
    montar(el) {
      host = el;
      host.innerHTML = '<p class="jg-bt3-info">Abriendo Mario Kart Wii…</p>';
      Promise.all([revisar(), privadoUrl()]).then(([amigo, origen]) => {
        if (muerto) return;
        if (!amigo) { host.innerHTML = aviso({ t: "Este juego es privado.", privado: true }); return; }
        if (!origen) { host.innerHTML = aviso({ t: "Mario Kart Wii todavía no está publicado." }); return; }
        frame = document.createElement("iframe");
        frame.className = "jg-bt3-solo";
        frame.title = "Mario Kart Wii";
        frame.allow = "fullscreen; gamepad";
        frame.setAttribute("allowfullscreen", "");
        window.addEventListener("message", oye);           // antes de cargarlo: lo primero que hace es pedir el token
        frame.src = srcMkwSolo(origen);
        host.innerHTML = "";
        host.append(frame);
        frame.focus();
        conectar();
      });
    },
    destruir() {
      muerto = true;
      clearInterval(conecta);
      window.removeEventListener("message", oye);
      frame?.remove();
      if (host) host.innerHTML = "";
    },
  };
}

export function crearMkw({ uid, pid, jugar, terminar, mirando, salir, chat }) {
  let host = null, escena = null, vest = null, frame = null, partida = null, est = null;
  let permitido = false, muerto = false, firmaVest = "", firmaMarco = "", origen = null, borrado = false;
  let senal = null, offP = null, offM = null, conecta = 0;
  const vrs = {};                                     // uid → VR (de mkw/vr), para mostrarlo en el vestíbulo

  const enSala = () => !mirando && !!est?.jugadores?.some(j => j.uid === uid) && !est?.fuera?.[uid];
  const presentes = () => (est?.jugadores || []).filter(j => !est.fuera?.[j.uid]);
  const nombre = u => (est?.jugadores || []).find(j => j.uid === u)?.nombre || "Piloto";
  const soyAnfitrion = () => enSala() && est.anfitrion === uid;
  const corriendo = () => !!est && est.fase === "jugando";

  async function anota(j) {
    try { await jugar(j); } catch (err) { console.warn("[mkw] no se pudo anotar", j.t, err); }
  }
  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  /* ---------- el buzón, prestado al marco (igual que bt3.js) ---------- */
  function senalOp(d) {
    if (!enSala()) return;
    if (!senal) senal = fb.senalMalla(pid, uid);
    if (d.op === "mensajes") {
      offM?.();
      offM = d.on ? senal.alMensajes((de, m) => enviar("senal-mensaje", { de, m })) : null;
    } else if (d.op === "presentes") {
      offP?.();
      offP = d.on ? senal.alPresentes(v => enviar("senal-presentes", { v })) : null;
    } else if (d.op === "entra") {
      senal.entra(String(d.s || "").slice(0, 16)).then(() => enviar("senal-entro", { id: d.id, ok: true }),
        () => enviar("senal-entro", { id: d.id, ok: false }));
    } else if (d.op === "sale") {
      offP?.(); offM?.(); offP = offM = null;
      senal.sale();
    } else if (d.op === "envia" && typeof d.para === "string" && d.m && typeof d.m === "object") {
      senal.envia(d.para, d.m);
    }
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "senal") { senalOp(d); return; }
    /* El token de Firebase de quien juega, para el Worker de amigos (lo privado del juego: juegos/mkw/web/navegador/
       privado.mjs). Igual que el marco de BT3: solo a este marco (misma página, mismo origen). nuevo = el anterior venció. */
    if (d.tipo === "token") {
      const w = frame.contentWindow;
      Promise.resolve(auth.currentUser?.getIdToken(!!d.nuevo)).catch(() => null)
        .then(token => { if (!muerto && frame?.contentWindow === w) w.postMessage({ canal: PADRE, tipo: "token", token: token || null }, location.origin); });
      return;
    }
    if (d.tipo === "salir") { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (err) {} salir?.(); }
    /* Fin de la copa o de la playlist (juegos/mkw/web/navegador/modos.mjs): el marco del anfitrión manda la tabla final
       y todos vuelven al vestíbulo, donde queda como «la última». Los demás marcos también avisan: no hacen nada. */
    if (d.tipo === "fin" && soyAnfitrion() && corriendo() && est.estilo !== "wfc") {
      const tabla = mkwTabla(d.tabla);
      anota(tabla ? { t: "vuelve", uid, tabla } : { t: "vuelve", uid });
    }
  }

  /* Apenas el marco carga, le pasa los almacenes de Firebase (partidas, VR y récords) con el nombre de quien juega:
     el juego pone al día sus partidas con la cuenta antes de leerlas y lee el VR ANTES de entrar en línea (el piloto
     tarda más que esto en llegar a «VS mundial»). */
  function conectarNube() {
    clearInterval(conecta);
    let vueltas = 0;
    conecta = setInterval(() => {
      const w = frame?.contentWindow;
      if (muerto || !w || ++vueltas > 120) { clearInterval(conecta); return; }
      if (typeof w.mkwConectarVr !== "function" || typeof w.mkwConectarRecords !== "function") return;
      clearInterval(conecta);
      const quien = { uid, nombre: nombre(uid).slice(0, 20) };
      try {
        // las partidas primero: el juego las espera antes de leerlas (hasta 4 s)
        if (typeof w.mkwConectarNube === "function") w.mkwConectarNube({ almacen: almacenPartidas, uid }).catch(() => {});
        w.mkwConectarRecords({ almacen: almacenRecords, ...quien });
        w.mkwConectarVr({ almacen: almacenVr, ...quien }).then(r => { if (r?.vr) { vrs[uid] = r.vr; pintaVestibulo(true); } }, () => {});
      } catch (err) { console.warn("[mkw] no pude pasarle la nube al marco", err); }
    }, 250);
  }

  /* El marco solo existe mientras corren y solo para quien juega. Su dirección cambia si cambia la tanda, el
     anfitrión o el nodo: entonces se recarga (el juego arranca de cero en la red nueva). */
  async function cargaMarco() {
    if (!frame || !permitido) return;
    // en la carrera sincronizada solo juegan los que estaban al empezar (el que llega espera a la tanda siguiente)
    const quiere = corriendo() && enSala() && (!est.sincro || est.sincro.includes(uid));
    if (!quiere) {
      frame.hidden = true;
      if (frame.getAttribute("src")) { frame.removeAttribute("src"); frame.src = "about:blank"; firmaMarco = ""; }
      return;
    }
    const nodo = est.nodos?.[uid];
    const firma = `${est.ronda}|${est.anfitrion}|${nodo}|${(est.sincro || []).join(",")}`;
    if (firma === firmaMarco) { frame.hidden = false; return; }
    firmaMarco = firma;
    if (origen === null) origen = await urlPrivada();
    if (muerto || firma !== firmaMarco) return;
    frame.hidden = false;
    frame.src = srcMkw({ pid, uid, nodo, anfitrion: est.anfitrion === uid, cpu: est.cpu, privado: origen, ronda: est.ronda, sincro: est.sincro,
                         estilo: est.estilo, carreras: est.carreras, cc: est.cc });
    frame.focus();
    conectarNube();
  }

  /* El VR de quienes están en la sala (mkw/vr/<uid>): una lectura por jugador, una vez. */
  function pideVrs() {
    for (const j of presentes()) {
      if (j.uid in vrs) continue;
      vrs[j.uid] = null;
      almacenVr.mio(j.uid).then(v => { if (v?.vr) { vrs[j.uid] = v.vr; pintaVestibulo(true); } }, () => {});
    }
  }

  function pintaVestibulo(forzar) {
    if (!vest || !est || !permitido) return;
    const js = presentes(), manda = soyAnfitrion(), corre = corriendo();
    const firma = JSON.stringify([js.map(j => j.uid), est.anfitrion, est.cpu, est.estilo, est.carreras, est.cc, est.ultimaTabla, est.fase, est.ronda, origen, vrs, manda, est.sincro]);
    if (!forzar && firma === firmaVest) return;
    firmaVest = firma;
    vest.hidden = false;
    vest.classList.toggle("jugando", corre && enSala());
    const fila = j => `<li class="jg-mkw-piloto${j.uid === est.anfitrion ? " anf" : ""}">
        <b translate="no">${escapeHtml(j.nombre || "Piloto")}</b>
        <small>${j.uid === est.anfitrion ? "anfitrión · " : ""}${vrs[j.uid] ? "VR " + Number(vrs[j.uid]).toLocaleString("es") : "VR —"}</small>
        ${manda && !corre && j.uid !== uid ? `<button class="jg-mkw-dar" data-a="${escapeHtml(j.uid)}" title="Que sea el anfitrión">Pasar anfitrión</button>` : ""}
      </li>`;
    // los tres modos (tarjetas: el anfitrión elige, los demás ven cuál) y, en la copa, cuántas carreras
    const estilo = est.estilo || "wfc", puede = manda && !corre ? "" : "disabled";
    const QUE = { wfc: "Como en Retro WFC: votan la pista, corren y suben o bajan VR. Sin fin.",
      copa: `${est.carreras || 4} carreras con puntos (15, 12, 10…): gana quien sume más.`,
      playlist: `Una cola de ${est.carreras || 4} pistas sorteadas: cada carrera es la siguiente de la cola.` };
    const modos = Object.entries(MKW_MODOS).map(([k, t]) =>
      `<button class="jg-mkw-modo" data-e="${k}" aria-pressed="${estilo === k}" ${puede}><b>${t}</b><small>${QUE[k]}</small></button>`).join("");
    // copa y playlist: cuántas carreras (o pistas en la cola) y la cilindrada
    const carrerasFichas = estilo === "wfc" ? "" : `<div class="jg-mkw-cpu"><span>${estilo === "copa" ? "Carreras" : "Pistas"}</span>${MKW_CARRERAS.map(n =>
      `<button class="jg-mkw-ficha" data-c="${n}" aria-pressed="${(est.carreras || 4) === n}" ${puede}>${n}</button>`).join("")}</div>
      <div class="jg-mkw-cpu"><span>Cilindrada</span>${Object.entries(MKW_CC).map(([k, txt]) =>
      `<button class="jg-mkw-ficha" data-cc="${k}" aria-pressed="${(est.cc || "c150") === k}" ${puede}>${txt}</button>`).join("")}</div>`;
    // la tabla de la última copa o playlist (la mandó el marco del anfitrión al terminar)
    const ult = est.ultimaTabla;
    const ultima = !corre && ult?.tabla?.length ? `<div class="jg-mkw-ultima"><b>${ult.estilo === "playlist" ? "🏁 Última playlist" : "🏆 Última copa"}</b>
      <ol>${ult.tabla.map(f => `<li><span translate="no">${escapeHtml(f.nombre)}</span><b>${Number(f.puntos)}</b></li>`).join("")}</ol></div>` : "";
    const sinPrograma = origen === "";
    const conCpu = est.cpu !== "ninguna", muchos = js.length > MKW_SINCRO_MAX;
    const nota = !enSala() ? (corre ? "Están corriendo. Solo los jugadores de la sala ven la carrera." : "Mirando la sala.")
      : corre && est.sincro ? (est.sincro.includes(uid) ? "Copa de 4 pistas con CPU: todos corren la misma carrera. Si alguien se va, su kart sigue solo."
        : "Esta copa empezó sin ti: entras en la siguiente.")
      : corre ? (manda ? "Tu pestaña es el servidor de la sala: si la cierras, las carreras se cortan para todos." : "El juego entra directo en línea; si llegaste tarde, te suma en la carrera siguiente.")
      : manda && conCpu && muchos ? `Con más de ${MKW_SINCRO_MAX} pilotos no caben CPU: se corre en línea, sin relleno.`
      : manda ? (sinPrograma ? "El programa del juego todavía no está publicado." : "Cuando estén listos, abre las carreras.")
      : `Esperando a que ${escapeHtml(nombre(est.anfitrion))} abra las carreras.`;
    vest.innerHTML = `
      <div class="jg-mkw-cab"><b>🏁 Mario Kart Wii</b><span>${js.length} de ${est.cupo || 12} · ${escapeHtml(MKW_MODOS[estilo])}${estilo !== "wfc" ? " · " + escapeHtml(MKW_CC[est.cc || "c150"]) : ""}${conCpu ? " · " + escapeHtml(MKW_CPU[est.cpu] || "") : ""}</span></div>
      <ul class="jg-mkw-pilotos">${js.map(fila).join("")}</ul>
      ${ultima}
      ${corre ? "" : `<div class="jg-mkw-modos" role="group" aria-label="Modo de la sala">${modos}</div>${carrerasFichas}`}
      <div class="jg-mkw-pie">
        ${manda && !corre ? `<button class="jg-mkw-empieza" ${sinPrograma ? "disabled" : ""}>¡A correr!</button>` : ""}
        ${manda && corre ? `<button class="jg-mkw-vuelve">Volver al vestíbulo</button>` : ""}
        <p class="jg-mkw-nota" role="status">${nota}</p>
      </div>`;
    vest.querySelectorAll(".jg-mkw-modo").forEach(b => b.onclick = () => { if (b.getAttribute("aria-pressed") !== "true") anota({ t: "ajuste", uid, k: "estilo", v: b.dataset.e }); });
    vest.querySelectorAll(".jg-mkw-ficha[data-c]").forEach(b => b.onclick = () => { if (b.getAttribute("aria-pressed") !== "true") anota({ t: "ajuste", uid, k: "carreras", v: Number(b.dataset.c) }); });
    vest.querySelectorAll(".jg-mkw-ficha[data-cc]").forEach(b => b.onclick = () => { if (b.getAttribute("aria-pressed") !== "true") anota({ t: "ajuste", uid, k: "cc", v: b.dataset.cc }); });
    vest.querySelectorAll(".jg-mkw-dar").forEach(b => b.onclick = () => { b.disabled = true; anota({ t: "anfitrion", uid, a: b.dataset.a }); });
    const emp = vest.querySelector(".jg-mkw-empieza");
    if (emp) emp.onclick = () => { emp.disabled = true; anota({ t: "empieza", uid }); };
    const vue = vest.querySelector(".jg-mkw-vuelve");
    if (vue) vue.onclick = () => { vue.disabled = true; anota({ t: "vuelve", uid }); };
  }

  function pantallaCompleta() {
    const pide = frame?.requestFullscreen || frame?.webkitRequestFullscreen;
    if (!pide || frame.hidden) return false;
    try { pide.call(frame, { navigationUI: "hide" })?.then?.(() => frame.contentWindow?.focus(), () => {}); }
    catch { return false; }
    frame.contentWindow?.focus();
    return true;
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    escena = document.createElement("div");
    escena.className = "jg-mkw-escena";
    vest = document.createElement("div");
    vest.className = "jg-mkw-vest";
    vest.hidden = true;
    escena.append(vest);
    frame = document.createElement("iframe");
    frame.title = "Mario Kart Wii — carreras en línea";
    frame.className = "jg-yemas-marco jg-mkw-marco";
    frame.allow = "fullscreen; gamepad; accelerometer; gyroscope";   // (el celular dirige inclinando el teléfono)
    frame.setAttribute("allowfullscreen", "");
    frame.hidden = true;
    window.addEventListener("message", mensaje);
    host.append(escena, frame);
    /* Solo los amigos de la lista del Worker (bt3-amigos.js, la misma de BT3): a cualquier otro, ni el vestíbulo ni
       el juego, aunque haya llegado con el enlace de la sala. */
    revisaBt3().then(async ok => {
      if (muerto) return;
      if (!ok) { escena.remove(); frame.remove(); vest = frame = escena = null; host.innerHTML = '<p class="jg-bt3-info jg-bt3-privado">Esta sala es privada.</p>'; return; }
      permitido = true;
      origen = await urlPrivada();
      if (muerto) return;
      cargaMarco(); pideVrs(); pintaVestibulo(true);
    });
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    cargaMarco();
    pideVrs();
    pintaVestibulo();
    if (est.fase === "fin" && !p.fin && enSala()) terminar(est.ganador, est.motivo);
    if (p.fin && !borrado && enSala()) {
      borrado = true;
      offP?.(); offM?.();
      fb.borraYemasVivo(pid);   // (borra `vivo/<pid>/rtc`, el buzón de esta sala)
    }
  }

  function destruir() {
    muerto = true;
    clearInterval(conecta);
    offP?.(); offM?.();
    senal?.sale();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
