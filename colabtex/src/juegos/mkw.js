import * as fb from "../fb-juegos.js";
import { db, auth, storage } from "../firebase.js";
import { ref as sRef, getMetadata, getBytes, uploadBytes } from "firebase/storage";
import { ref, get, set, query, orderByChild, limitToFirst, limitToLast, serverTimestamp } from "firebase/database";
import { revisaBt3 } from "./bt3-amigos.js";
import { escapeHtml } from "../util.js";
import { MKW_SINCRO_MAX, MKW_MODOS, MKW_CC, mkwCarrera, mkwTabla } from "./motor.js";

/* Mario Kart Wii (+ Retro Rewind) — el cartero entre la sala y el juego.

   El juego entero vive en `juegos/mkw/` (Mario Kart Wii traducido a WebAssembly; su programa sale del Worker de
   amigos, `juegos/mkw/privado.json`) y entra aquí en un iframe, como BT3. Este módulo no toca la carrera:

   - **Sin el Wi-Fi del juego** (el dueño, 2026-10-19: «no te conectes a Retro WFC»; nada de sus pantallas). Hasta 4
     pilotos (`est.sincro`, en orden: puerto 1–4) corren la **carrera sincronizada** (`juegos/mkw/web/navegador/
     lockstep.mjs`): cada marco corre la MISMA carrera, con los pilotos como jugadores de verdad y la CPU de un Grand
     Prix completando los 12 lugares, y la malla WebRTC (abierta dentro de cada marco) reparte los botones de cada
     cuadro. La semilla sale de la sala y del número de tanda (`mkwCarrera`), así todos calculan lo mismo.
   - **Dentro del juego** (`sala-carrera.mjs`, abierto directo por código, sin menús): en la copa el anfitrión elige
     una de las copas del juego con el selector de la página; en la playlist arma una lista (hasta 32 pistas) y los
     demás le sugieren (§74); cada uno elige personaje y vehículo con las pantallas del juego (45 s) y se corren las
     carreras; al final el marco del anfitrión
     manda la tabla (`fin`) y todos vuelven al vestíbulo. Si alguien se corta tiene 30 s para volver.
   - Lo único que pasa por aquí es la **presentación**: el buzón de Firebase (`fb.senalMalla`, `vivo/<pid>/rtc`) vive
     en esta página, que tiene la sesión, y el marco lo usa por postMessage (`senal`, el mismo protocolo de BT3). Y se
     le avisa al marco los nombres de los pilotos y, si el anfitrión se va, quién manda ahora (`nombres`, `anfitrion`).
   - **Al registro va solo el vestíbulo** (`redMkw` en `motor.js`): el modo (copa o playlist), la cilindrada, quién
     es el anfitrión, empezar y volver.
   - **El VR y los récords** de cada uno van a Firebase (`mkw/vr/<uid>`, `mkw/records/…`): este módulo arma los
     almacenes con la base del sitio y se los pasa al marco (misma página, mismo origen) apenas carga.
   - Quien entra con la copa andando espera a la siguiente tanda. Quien mira la sala sin ser jugador no carga el juego.

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

/* La dirección del marco para este jugador: la malla de esta sala, su nodo y la copa de esta tanda. Todos los marcos
   corren la sala nueva del juego (`modo=sala`, juegos/mkw/web/navegador/sala-carrera.mjs: sin Retro WFC): `sincro` =
   los pilotos en orden (puerto 1–4), `jefe` = quien arma la copa (el anfitrión al empezar; si se va, se le avisa al
   marco quién sigue), la semilla de la tanda (la misma carrera en todos), el modo y la cilindrada. §74: la copa es
   una copa existente (4 carreras: el anfitrión la elige en el juego) y la playlist es una lista que el anfitrión arma
   en el juego con las sugerencias de los demás (`carreras` = hasta cuántas llena su 🎲). Los nombres no van en la
   dirección: se le mandan al marco. */
export function srcMkw({ pid, uid, nodo, privado, ronda, sincro, jefe, estilo = "copa", carreras = 4, cc = "c150" }) {
  const q = new URLSearchParams({ auto: "1", red: "malla", senal: "padre", sala: pid, uid, nodo: String(nodo) });
  const { semilla } = mkwCarrera(pid, ronda);
  q.set("modo", "sala"); q.set("sincro", sincro.join(",")); q.set("jefe", jefe || sincro[0]); q.set("semilla", String(semilla));
  q.set("estilo", estilo === "playlist" ? "playlist" : "copa"); q.set("carreras", estilo === "playlist" ? String(carreras) : "4"); q.set("cc", cc);
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
  let permitido = false, muerto = false, firmaVest = "", firmaMarco = "", origen = null, borrado = false, jefeMarco = "", avisado = "";
  let senal = null, offP = null, offM = null, conecta = 0, esperaSala = 0;
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
    /* El juego abrió un selector de la sala (la copa, la playlist, sugerir, lo que viene): su panel va pegado abajo del
       marco, así que se acomoda la página para que el marco se vea entero (solo si hace falta). */
    if (d.tipo === "mirame") verMarco();
    /* Fin de la copa o de la playlist (juegos/mkw/web/navegador/modos.mjs): el marco del anfitrión manda la tabla final
       y todos vuelven al vestíbulo, donde queda como «la última». Los demás marcos también avisan: no hacen nada. */
    if (d.tipo === "fin" && soyAnfitrion() && corriendo()) {
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

  /* El marco solo existe mientras corren y solo para quien juega. Su dirección cambia si cambia la tanda o el nodo:
     entonces se recarga (el juego arranca de cero). Si el anfitrión cambia a mitad de la copa NO se recarga: se le
     avisa al marco quién manda ahora (la sala del juego sigue con él). */
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
    const firma = `${est.ronda}|${nodo}|${(est.sincro || []).join(",")}`;
    if (firma === firmaMarco) { frame.hidden = false; avisaMarco(); return; }
    firmaMarco = firma; jefeMarco = est.anfitrion; avisado = "";
    if (origen === null) origen = await urlPrivada();
    if (muerto || firma !== firmaMarco) return;
    frame.hidden = false;
    verMarco();
    frame.src = srcMkw({ pid, uid, nodo, privado: origen, ronda: est.ronda, sincro: est.sincro, jefe: jefeMarco,
                         estilo: est.estilo, carreras: est.carreras, cc: est.cc });
    frame.focus();
    conectarNube();
    // apenas la sala del juego exista (el marco la arma al cargar), los nombres y el anfitrión
    clearInterval(esperaSala);
    let vueltas = 0;
    esperaSala = setInterval(() => {
      if (muerto || ++vueltas > 240) { clearInterval(esperaSala); return; }
      if (frame?.contentWindow?.mkwSala) { clearInterval(esperaSala); avisado = ""; avisaMarco(); }
    }, 500);
  }
  /* El marco mide 100vh − 120 px y aparece debajo del vestíbulo, más abajo del borde de la ventana: al aparecer (y
     cuando el juego lo pide, «mirame») se desplaza la página lo justo para verlo entero. Sin esto el panel de la copa
     («Jugar la Copa N»), pegado abajo del marco, quedaba fuera de la vista. */
  function verMarco() {
    if (!frame || frame.hidden) return;
    try { frame.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (err) {}
  }
  /* Lo que el marco sabe por mensaje (no por la dirección): los nombres de los pilotos (para la tabla de la copa) y,
     si el anfitrión cambió, quién manda ahora. Se repite cada vez que cambia algo (el marco puede no haber cargado). */
  function avisaMarco() {
    if (!frame?.contentWindow?.mkwSala || !est?.sincro) return;      // (la sala del juego todavía no escucha)
    const nombres = Object.fromEntries(est.sincro.map(u => [u, nombre(u).slice(0, 20)]));
    const firma = JSON.stringify([nombres, est.anfitrion]);
    if (firma === avisado) return;
    avisado = firma;
    enviar("nombres", { nombres });
    if (est.anfitrion && est.anfitrion !== jefeMarco && est.sincro.includes(est.anfitrion)) enviar("anfitrion", { uid: est.anfitrion });
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
    // los dos modos (tarjetas: el anfitrión elige, los demás ven cuál). §74: la copa es una de las copas del juego (sus
    // 4 pistas) y la playlist una lista que se arma en el juego: el vestíbulo ya no pregunta cuántas carreras
    const estilo = est.estilo || "copa", puede = manda && !corre ? "" : "disabled";
    const QUE = { copa: "El anfitrión elige una copa del juego y se corren sus 4 pistas, con puntos (15, 12, 10…).",
      playlist: "El anfitrión arma una lista de pistas (hasta 32) y los demás le sugieren; entre carrera y carrera se pueden agregar más." };
    const modos = Object.entries(MKW_MODOS).map(([k, t]) =>
      `<button class="jg-mkw-modo" data-e="${k}" aria-pressed="${estilo === k}" ${puede}><b>${t}</b><small>${QUE[k]}</small></button>`).join("");
    // la cilindrada (para los dos modos)
    const carrerasFichas = `<div class="jg-mkw-cpu"><span>Cilindrada</span>${Object.entries(MKW_CC).map(([k, txt]) =>
      `<button class="jg-mkw-ficha" data-cc="${k}" aria-pressed="${(est.cc || "c150") === k}" ${puede}>${txt}</button>`).join("")}</div>`;
    // la tabla de la última copa o playlist (la mandó el marco del anfitrión al terminar)
    const ult = est.ultimaTabla;
    const ultima = !corre && ult?.tabla?.length ? `<div class="jg-mkw-ultima"><b>${ult.estilo === "playlist" ? "🏁 Última playlist" : "🏆 Última copa"}</b>
      <ol>${ult.tabla.map(f => `<li><span translate="no">${escapeHtml(f.nombre)}</span><b>${Number(f.puntos)}</b></li>`).join("")}</ol></div>` : "";
    const sinPrograma = origen === "";
    const nota = !enSala() ? (corre ? "Están corriendo. Solo los jugadores de la sala ven la carrera." : "Mirando la sala.")
      : corre && est.sincro ? (est.sincro.includes(uid)
        ? (est.anfitrion === uid ? (estilo === "copa" ? "Elige la copa en el juego; después cada uno elige personaje y vehículo. Todos corren la misma carrera y la CPU completa los 12."
            : "Arma la lista en el juego (los demás te pueden sugerir pistas); después cada uno elige personaje y vehículo.")
          : estilo === "playlist" ? "Sugiere pistas en el juego mientras el anfitrión arma la lista. Si se te corta la conexión, tienes 30 s para volver."
          : "Todos corren la misma carrera y la CPU completa los 12. Si se te corta la conexión, tienes 30 s para volver.")
        : "Esta copa empezó sin ti: entras en la siguiente.")
      : manda ? (sinPrograma ? "El programa del juego todavía no está publicado." : "Cuando estén listos, abre las carreras.")
      : `Esperando a que ${escapeHtml(nombre(est.anfitrion))} abra las carreras.`;
    vest.innerHTML = `
      <div class="jg-mkw-cab"><b>🏁 Mario Kart Wii</b><span>${js.length} de ${Math.min(est.cupo || MKW_SINCRO_MAX, MKW_SINCRO_MAX)} · ${escapeHtml(MKW_MODOS[estilo] || MKW_MODOS.copa)} · ${escapeHtml(MKW_CC[est.cc || "c150"])}</span></div>
      <ul class="jg-mkw-pilotos">${js.map(fila).join("")}</ul>
      ${ultima}
      ${corre ? "" : `<div class="jg-mkw-modos" role="group" aria-label="Modo de la sala">${modos}</div>${carrerasFichas}`}
      <div class="jg-mkw-pie">
        ${manda && !corre ? `<button class="jg-mkw-empieza" ${sinPrograma ? "disabled" : ""}>¡A correr!</button>` : ""}
        ${manda && corre ? `<button class="jg-mkw-vuelve">Volver al vestíbulo</button>` : ""}
        <p class="jg-mkw-nota" role="status">${nota}</p>
      </div>`;
    vest.querySelectorAll(".jg-mkw-modo").forEach(b => b.onclick = () => { if (b.getAttribute("aria-pressed") !== "true") anota({ t: "ajuste", uid, k: "estilo", v: b.dataset.e }); });
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
    clearInterval(conecta); clearInterval(esperaSala);
    offP?.(); offM?.();
    senal?.sale();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
