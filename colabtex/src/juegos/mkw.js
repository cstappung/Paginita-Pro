import * as fb from "../fb-juegos.js";
import { db, auth, storage } from "../firebase.js";
import { ref as sRef, getMetadata, getBytes, uploadBytes } from "firebase/storage";
import { ref, get, set, query, orderByChild, limitToFirst, limitToLast, serverTimestamp } from "firebase/database";
import { revisaBt3, relevoBt3 } from "./bt3-amigos.js";
import { escapeHtml } from "../util.js";
import { MKW_SINCRO_MAX, MKW_MODOS, MKW_CC, MKW_NIVEL, mkwCarrera, mkwTabla } from "./motor.js";

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
     El VR se mueve con cada carrera de la sala (el marco lo calcula y lo guarda, `vr-sala.mjs`, §82): el marco
     avisa el suyo (`vr`) y, al terminar la copa (`fin`), el vestíbulo vuelve a leer el de los demás.
   - Quien entra con la copa andando espera a la siguiente tanda. Quien mira la sala sin ser jugador no carga el juego.

   Controles del juego: teclado y mandos (los celulares quedaron fuera del lanzamiento: el táctil del juego queda, pero
   no se ofrece) — @controles: teclado */
const PADRE = "mkw-padre", HIJO = "mkw-hijo";
const PAGINA = "juegos/mkw/web/navegador/index.html";

/* De dónde sale el programa del juego (el Worker de amigos): `juegos/mkw/privado.json` = { "url": "https://…" }.
   Vacío = todavía no publicado (la sala lo dice en vez de abrir un marco que no puede cargar nada). */
let privado = null;
const urlPrivada = () => privado || (privado = fetch("juegos/mkw/privado.json", { cache: "no-cache" })
  .then(r => r.ok ? r.json() : {}).then(c => String(c.url || "").replace(/\/+$/, ""), () => ""));

/* Los almacenes de Firebase que usa el juego (vr.mjs, records.mjs: mio, guardar, top), sobre la base del sitio. Los
   récords llevan además los fantasmas de la Contrarreloj (juegos/mkw/web/navegador/fantasma-pagina.mjs): el .rkg del
   récord de cada uno en Storage, mkw/fantasmas/<pista>-<categoría>/<uid>.rkg (firebase/storage.rules: lo leen todos los
   que tienen sesión, lo escribe solo su dueño); la Contrarreloj corre contra el del mejor de la tabla. */
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
  async fantasmaSubir(k, u, bytes) {
    const datos = new Uint8Array(bytes.byteLength); datos.set(bytes);     // (copia: el Uint8Array del marco es de otro reino)
    await uploadBytes(sRef(storage, `mkw/fantasmas/${k}/${u}.rkg`), datos, { contentType: "application/octet-stream", customMetadata: { uid: u } });
  },
  async fantasmaBajar(k, u) {
    try { return new Uint8Array(await getBytes(sRef(storage, `mkw/fantasmas/${k}/${u}.rkg`))); }
    catch (e) { if (e?.code === "storage/object-not-found") return null; throw new Error(e?.code || String(e)); }
  },
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
   en el juego con las sugerencias de los demás (`carreras` = hasta cuántas llena su 🎲). M20: `cpu` = el nivel de la
   CPU que eligió el anfitrión (MKW_NIVEL), aparte de la cilindrada. Los nombres no van en la dirección: se le mandan
   al marco. */
export function srcMkw({ pid, uid, nodo, privado, ronda, sincro, jefe, estilo = "copa", carreras = 4, cc = "c150", nivel = "maximo" }) {
  const q = new URLSearchParams({ auto: "1", red: "malla", senal: "padre", sala: pid, uid, nodo: String(nodo) });
  const { semilla } = mkwCarrera(pid, ronda);
  q.set("modo", "sala"); q.set("sincro", sincro.join(",")); q.set("jefe", jefe || sincro[0]); q.set("semilla", String(semilla));
  q.set("estilo", estilo === "playlist" ? "playlist" : "copa"); q.set("carreras", estilo === "playlist" ? String(carreras) : "4"); q.set("cc", cc);
  q.set("cpu", MKW_NIVEL[nivel] ? nivel : "maximo");
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
   récords van a la cuenta, como en la sala (el VR no: solo se mueve en las carreras de la sala, §82). */
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

export function crearMkw({ uid, pid, jugar, terminar, mirando, salir, chat, avatar, inmersivo }) {
  let host = null, escena = null, vest = null, frame = null, partida = null, est = null;
  let permitido = false, muerto = false, firmaVest = "", firmaMarco = "", origen = null, borrado = false, jefeMarco = "", avisado = "";
  let senal = null, offP = null, offM = null, conecta = 0, esperaSala = 0;
  /* §99 (crítico de la red, H2): si al anfitrión se le corta internet o se le cuelga Chrome, nadie escribe «abandona» y
     la copa quedaba colgada (solo él la hace avanzar). Con la copa andando, cada página mira su presencia en el buzón de
     la sala (Firebase la borra sola al desconectarse): si falta más de 15 s, todas eligen al mismo reemplazo —el primero
     de la copa que sigue presente— y se lo avisan a su juego (la sala del juego ya sabe seguir con otro anfitrión) */
  let jefeForzado = "", jefeSitio = "", offVig = null, vigJefe = 0, ausenteDesde = 0, presencia = {};
  const vrs = {};                                     // uid → VR (de mkw/vr), para mostrarlo en el vestíbulo
  const abierto = { cambiar: false, menu: "", tabla: false };   // M21: lo abierto en el vestíbulo (va en su firma)
  let faseJuego = null;                               // M22: la fase que manda el marco (copa, elegir, carrera, descanso)
  /* M22 (modelo «Modo consola»): si la persona lo pidió en el vestíbulo («Pantalla completa al empezar», apagado por
     omisión: el dueño, por el lag), al empezar la copa la sala pasa sola al modo inmersivo del sitio y el marco llena la
     pantalla; al volver al vestíbulo, sale. Una vez por copa: si sale con Esc o «Salir», no se le vuelve a poner.
     inmAuto = la ronda en que se puso solo; inmPref = lo que eligió (en este navegador) */
  let inmAuto = null;
  const CLAVE_INM = "mkw.inmersivoAlEmpezar";
  let inmPref = (() => { try { return localStorage.getItem(CLAVE_INM) === "1"; } catch { return false; } })();
  /* M22: la PRECARGA en el vestíbulo. Mientras se conversa, un marco escondido abre la página del juego con
     `precarga=1`: baja el programa y lo que el juego lee al arrancar y en la primera carrera, y lo deja guardado en este
     navegador sin arrancar el juego (juegos/mkw/web/navegador/mkw.mjs, precargarTodo). Cuánto lleva cada piloto va en
     su presencia del buzón de la sala (`vivo/<pid>/rtc/en/<uid>`, hasta 16 letras: «~40», «~listo»; la malla del juego
     no toma esas como sesiones) y el vestíbulo lo muestra en su fila: «⬇ 40 %», «● listo». */
  let marcoPre = null, preHecha = false, offPre = null, preEnviado = "";
  const preDe = {};                                   // uid → "listo" | "40" (lo que escribió en su presencia)

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
    if (!muerto && marcoPre && e.source === marcoPre.contentWindow && e.origin === location.origin && e.data?.canal === HIJO) { mensajePre(e.data); return; }
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
    /* El VR de quien juega cambió con una carrera de la sala (juegos/mkw/web/navegador/vr-sala.mjs, §82: el marco ya lo
       guardó en mkw/vr/<uid>): el vestíbulo lo muestra al volver. */
    if (d.tipo === "vr" && Number.isInteger(d.vr) && d.vr >= 1 && d.vr <= 1000000) { vrs[uid] = d.vr; pintaVestibulo(true); }
    /* M22: en qué fase está la sala del juego, para que la tira diga la verdad («Carrera 2 de 4», «Descanso») */
    if (d.tipo === "fase" && typeof d.fase === "string") {
      faseJuego = { fase: d.fase.slice(0, 12), carrera: Math.max(0, d.carrera | 0), carreras: Math.max(0, d.carreras | 0) };
      pintaVestibulo(true);
    }
    if (d.tipo === "fin") {
      /* los VR de los demás también se movieron: se vuelven a leer (una vez cada uno) */
      for (const j of presentes()) if (j.uid !== uid) delete vrs[j.uid];
      pideVrs();
    }
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
      if (inmAuto !== null) { inmAuto = null; try { inmersivo?.(false); } catch {} }
      return;
    }
    if (inmersivo && inmPref && inmAuto !== est.ronda) { inmAuto = est.ronda; try { inmersivo(true); } catch {} }
    const nodo = est.nodos?.[uid];
    const firma = `${est.ronda}|${nodo}|${(est.sincro || []).join(",")}`;
    if (firma === firmaMarco) { frame.hidden = false; avisaMarco(); return; }
    firmaMarco = firma; jefeMarco = est.anfitrion; avisado = ""; faseJuego = null;
    if (origen === null) origen = await urlPrivada();
    if (muerto || firma !== firmaMarco) return;
    frame.hidden = false;
    verMarco();
    frame.src = srcMkw({ pid, uid, nodo, privado: origen, ronda: est.ronda, sincro: est.sincro, jefe: jefeMarco,
                         estilo: est.estilo, carreras: est.carreras, cc: est.cc, nivel: est.nivel });
    frame.focus();
    conectarNube();
    // apenas la sala del juego exista (el marco la arma al cargar), los nombres y el anfitrión
    clearInterval(esperaSala);
    let vueltas = 0;
    esperaSala = setInterval(() => {
      if (muerto || ++vueltas > 240) { clearInterval(esperaSala); return; }
      if (frame?.contentWindow?.mkwSala) {
        clearInterval(esperaSala); avisado = ""; avisaMarco();
        /* §99 (crítico de la red, H1): el TURN de Cloudflare (el Worker de amigos lo entrega en /turn, el mismo de BT3):
           sin él, dos PC detrás de redes difíciles (NAT simétrico, datos móviles, universidad) no se conectan nunca. ICE lo
           usa solo si nada directo funciona. Siempre, sin que el anfitrión lo active: con 66 pares nadie adivina cuál falla */
        const w = frame.contentWindow;
        relevoBt3().then(ice => { if (!muerto && frame?.contentWindow === w && ice.length) enviar("turn", { iceServers: ice }); }, () => {});
      }
    }, 500);
  }
  /* M22: la precarga (ver arriba): el marco escondido mientras se está en el vestíbulo (una vez por visita: ya bajado,
     queda en la caché del navegador), y escuchar lo que escribió cada piloto */
  function precarga() {
    const enVest = permitido && !muerto && !mirando && enSala() && !corriendo() && !!host;
    const quiere = enVest && !preHecha && !!origen;
    if (quiere && !marcoPre) {
      marcoPre = document.createElement("iframe");
      marcoPre.title = "Mario Kart Wii — preparando el juego";
      marcoPre.hidden = true;
      marcoPre.tabIndex = -1;
      marcoPre.setAttribute("aria-hidden", "true");
      marcoPre.src = PAGINA + "?" + new URLSearchParams({ precarga: "1", senal: "padre", privado: origen }).toString();
      host.append(marcoPre);
    } else if (!quiere && marcoPre) { marcoPre.remove(); marcoPre = null; }
    if (enVest && !offPre) {
      if (!senal) senal = fb.senalMalla(pid, uid);
      offPre = senal.alPresentes(v => {
        let cambio = false;
        for (const u of Object.keys(preDe)) if (u !== uid && !(typeof v[u] === "string" && v[u].startsWith("~"))) { delete preDe[u]; cambio = true; }
        for (const [u, s] of Object.entries(v || {})) {
          if (u === uid || typeof s !== "string" || !s.startsWith("~")) continue;
          const t = s === "~listo" ? "listo" : /^~\d{1,3}$/.test(s) ? s.slice(1) : "";
          if (t && preDe[u] !== t) { preDe[u] = t; cambio = true; }
        }
        if (cambio) pintaVestibulo(true);
      });
      if (preHecha) publicaPre("listo");
    } else if (!enVest && offPre) { offPre(); offPre = null; preEnviado = ""; }
  }
  function publicaPre(t) {
    if (!enSala() || corriendo() || t === preEnviado) return;
    preEnviado = t; preDe[uid] = t;
    if (!senal) senal = fb.senalMalla(pid, uid);
    senal.entra("~" + t).catch(() => {});
    pintaVestibulo(true);
  }
  function mensajePre(d) {
    if (d.tipo === "token") {
      const w = marcoPre.contentWindow;
      Promise.resolve(auth.currentUser?.getIdToken(!!d.nuevo)).catch(() => null)
        .then(token => { if (!muerto && marcoPre?.contentWindow === w) w.postMessage({ canal: PADRE, tipo: "token", token: token || null }, location.origin); });
      return;
    }
    if (d.tipo !== "precarga") return;
    if (d.error) { preHecha = true; precarga(); return; }             // (sin permiso o sin programa: no se insiste)
    if (d.listo) { preHecha = true; publicaPre("listo"); precarga(); return; }
    const pct = Math.max(0, Math.min(99, Math.floor((d.pct | 0) / 10) * 10));   // (de a 10 %: pocas escrituras)
    publicaPre(String(pct));
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
  function vigilarAnfitrion() {
    const quiere = permitido && !muerto && enSala() && corriendo() && !!est?.sincro;
    if (est && est.anfitrion !== jefeSitio) { jefeSitio = est.anfitrion; jefeForzado = ""; }   // (el sitio cambió de anfitrión: manda ese)
    if (quiere && !offVig) {
      if (!senal) senal = fb.senalMalla(pid, uid);
      offVig = senal.alPresentes(v => { presencia = v || {}; });
      vigJefe = setInterval(revisarJefe, 2000);
    } else if (!quiere && offVig) { offVig(); offVig = null; clearInterval(vigJefe); ausenteDesde = 0; jefeForzado = ""; }
  }
  function revisarJefe() {
    if (!est?.sincro) return;
    const jefe = jefeForzado || est.anfitrion, presente = u => typeof presencia[u] === "string";
    if (!jefe || jefe === uid || presente(jefe)) { ausenteDesde = 0; return; }
    ausenteDesde ||= Date.now();
    if (Date.now() - ausenteDesde < 15000) return;
    const nuevo = est.sincro.find(u => !est.fuera?.[u] && (u === uid || presente(u)));
    if (!nuevo || nuevo === jefe) return;
    jefeForzado = nuevo; ausenteDesde = 0; jefeMarco = nuevo;
    enviar("anfitrion", { uid: nuevo });
    if (nuevo === uid) anota({ t: "toma", uid, de: jefe });     // (y lo anota en la sala: así cierra la copa y guarda la tabla)
  }
  function avisaMarco() {
    if (!frame?.contentWindow?.mkwSala || !est?.sincro) return;      // (la sala del juego todavía no escucha)
    const nombres = Object.fromEntries(est.sincro.map(u => [u, nombre(u).slice(0, 20)]));
    // (§87: y los pilotos de la copa que ya no están —se fueron, los echó el anfitrión o la votación—: el juego los
    // corta de la carrera en curso al momento y la sala no los espera en la siguiente)
    const salieron = est.sincro.filter(u => est.fuera?.[u]);
    const firma = JSON.stringify([nombres, est.anfitrion, salieron]);
    if (firma === avisado) return;
    avisado = firma;
    enviar("nombres", { nombres });
    if (salieron.length) enviar("fuera", { uids: salieron });
    const jefe = jefeForzado || est.anfitrion;            // (§99: el que eligieron las páginas si el del sitio desapareció)
    if (jefe && jefe !== jefeMarco && est.sincro.includes(jefe)) { jefeMarco = jefe; enviar("anfitrion", { uid: jefe }); }
  }

  /* El VR de quienes están en la sala (mkw/vr/<uid>): una lectura por jugador, una vez. */
  function pideVrs() {
    for (const j of presentes()) {
      if (j.uid in vrs) continue;
      vrs[j.uid] = null;
      // (M22: sin VR guardado = 0, «nuevo»: empieza en 5000; null = todavía no llegó la respuesta)
      almacenVr.mio(j.uid).then(v => { vrs[j.uid] = v?.vr || 0; pintaVestibulo(true); }, () => {});
    }
  }

  /* El vestíbulo (M21, la propuesta D que eligió el dueño: «la mezcla del crítico»; maquetas y crítica en la bitácora
     §97 del kit). De arriba abajo:
     - la «ficha de carrera»: lo que se corre en grande («Copa · 150cc · CPU máximo», con la letra de la portada) y, a
       la derecha, «¡A correr!» para el anfitrión o lo que espera el invitado: se ve sin bajar la página;
     - «✎ Cambiar» (solo el anfitrión): abre las tres opciones (modo, cilindrada, CPU) con la ayuda de la elegida;
     - la última copa (los tres primeros y «Ver tabla»);
     - los pilotos: «N de 12» con 12 puntitos (llenos = personas, huecos = CPU), una fila por piloto (su foto del
       sitio, el nombre, la corona del anfitrión y el VR a la derecha; para el anfitrión, un «⋯» con «Pasar anfitrión»
       y «Echar») y una sola fila para la CPU que completa los 12;
     - con la copa andando, la misma ficha en una tira: el titular, las fichas de los pilotos (el anfitrión puede echar
       desde ahí) y «Volver al vestíbulo».
     El panel se rehace entero cuando cambia algo; lo abierto (Cambiar, el «⋯», la tabla) va en la firma y el foco del
     teclado vuelve al mismo botón (data-foco). Los estilos son del módulo (ponEstiloVest): juegos.html no se toca. */
  function pintaVestibulo(forzar) {
    if (!vest || !est || !permitido) return;
    const js = presentes(), manda = soyAnfitrion(), corre = corriendo();
    const tira = corre && enSala();
    if (!manda || corre) abierto.cambiar = false;
    if (abierto.menu && (!manda || !js.some(j => j.uid === abierto.menu && j.uid !== uid))) abierto.menu = "";
    const firma = JSON.stringify([js.map(j => [j.uid, j.nombre, j.color, j.foto]), est.anfitrion, est.estilo, est.carreras, est.cc, est.nivel, est.ultimaTabla,
      est.fase, est.ronda, origen, vrs, manda, est.sincro, est.fuera, est.cupo, abierto, preDe]);
    if (!forzar && firma === firmaVest) return;
    firmaVest = firma;
    ponEstiloVest();
    vest.hidden = false;
    vest.classList.add("jg-mkw2");
    vest.classList.toggle("jugando", tira);
    const estilo = est.estilo === "playlist" ? "playlist" : "copa", cc = MKW_CC[est.cc] ? est.cc : "c150", nivel = MKW_NIVEL[est.nivel] ? est.nivel : "maximo";
    const puede = manda && !corre, cupo = Math.min(est.cupo || MKW_SINCRO_MAX, MKW_SINCRO_MAX), cpus = Math.max(0, MKW_SINCRO_MAX - js.length);
    const titular = `${MODO_CORTO[estilo]} · ${escapeHtml(MKW_CC[cc])} · CPU ${escapeHtml(MKW_NIVEL[nivel].toLowerCase())}`;
    const nom = j => escapeHtml(j.nombre || "Piloto");
    const cara = (j, tam) => avatar ? avatar(j, tam) : `<span class="jg2-inicial" style="width:${tam}px;height:${tam}px" aria-hidden="true">${escapeHtml((j.nombre || "?").charAt(0).toUpperCase())}</span>`;
    // el «⋯» de cada piloto, para el anfitrión y en las filas de los otros (con la copa andando, solo «Echar»)
    const menuDe = j => {
      if (!(manda && j.uid !== uid)) return "";
      const u = escapeHtml(j.uid), abre = abierto.menu === j.uid;
      return `<button type="button" class="jg2-mas" data-menu="${u}" data-foco="menu-${u}" aria-haspopup="menu" aria-expanded="${abre}" aria-label="Opciones de ${nom(j)}">⋯</button>` +
        (abre ? `<div class="jg2-menu" role="menu">${!corre ? `<button type="button" class="jg-mkw-dar" role="menuitem" data-a="${u}" data-foco="dar-${u}">Pasar anfitrión</button>` : ""}` +
          `<button type="button" class="jg-mkw-echa" role="menuitem" data-e="${u}" data-foco="echa-${u}">Echar de la sala</button></div>` : "");
    };
    const corona = j => j.uid === est.anfitrion ? CORONA : "";
    // M22: cómo va la precarga de cada uno (lo que escribió en su presencia)
    const preDeJ = j => { const t = preDe[j.uid]; return !t ? "" : t === "listo" ? `<span class="jg2-pre listo" title="El juego ya está bajado en su navegador">● listo</span>`
      : `<span class="jg2-pre" title="Bajando el juego">⬇ ${escapeHtml(t)} %</span>`; };
    const vrDe = j => `<span class="jg2-vr">VR <b>${vrs[j.uid] ? Number(vrs[j.uid]).toLocaleString("es") : vrs[j.uid] === 0 ? "5000" : "—"}</b>${vrs[j.uid] === 0 ? " <small>nuevo</small>" : ""}</span>`;
    // lo que dice el panel según quién mira (los mismos avisos de antes)
    const sinPrograma = origen === "";
    const sacado = (est.hist || []).filter(h => (h.e === "echado" || h.e === "expulsado") && h.uid === uid).pop();
    const espera = !enSala() ? "" : corre ? "" : manda ? "" : `Esperando a que <b translate="no">${escapeHtml(nombre(est.anfitrion))}</b> abra las carreras`;
    const nota = !enSala() ? (sacado ? (sacado.e === "echado" ? "El anfitrión te sacó de esta sala." : "Te sacaron de esta sala por votación.")
        : corre ? "Están corriendo. Solo los jugadores de la sala ven la carrera." : "Mirando la sala.")
      : corre && est.sincro ? (est.sincro.includes(uid) ? notaFase(manda, estilo)
        : "Esta copa empezó sin ti: entras en la siguiente.")
      : manda && sinPrograma ? "El programa del juego todavía no está publicado." : "";
    const foco = vest.contains(document.activeElement) ? document.activeElement.getAttribute("data-foco") : null;
    const salirBtn = sacado ? `<button type="button" class="jg2-salir" data-salir data-foco="salir">← Volver a Juegos</button>` : "";

    if (tira) {
      const ficha = j => `<span class="jg2-ficha${j.uid === uid ? " yo" : ""}">${cara(j, 22)}<b translate="no" title="${nom(j)}">${nom(j)}</b>${corona(j)}${menuDe(j)}</span>`;
      vest.innerHTML = `<div class="jg2-tira">
          <span class="jg2-ttit">${titular}</span>
          <span class="jg2-tcuenta">${js.length} de ${cupo}</span>
          <div class="jg2-fichas">${js.map(ficha).join("")}${cpus ? `<span class="jg2-ficha cpu">+ ${cpus} CPU</span>` : ""}</div>
          ${manda ? `<button type="button" class="jg-mkw-vuelve jg2-vuelve" data-foco="vuelve">Terminar la copa para todos</button>` : ""}
          ${nota ? `<p class="jg-mkw-nota jg2-nota" role="status">${nota}</p>` : ""}
        </div>`;
    } else {
      const seg = (k, cual, lista, dato) => `<div class="jg2-seg" role="group" aria-label="${{ modo: "Modo", cc: "Cilindrada" }[k] || k}">${Object.entries(lista).map(([v, txt]) =>
        `<button type="button" ${dato(v)} data-foco="${k}-${v}" aria-pressed="${cual === v}">${escapeHtml(txt)}</button>`).join("")}</div>`;
      const opciones = puede && abierto.cambiar ? `<div class="jg2-opciones" id="jg2-opciones">
          <div class="jg2-op"><span>Modo</span>${seg("modo", estilo, MODO_CORTO, v => `class="jg-mkw-modo" data-e="${v}"`)}</div>
          <div class="jg2-op"><span>Cilindrada</span>${seg("cc", cc, MKW_CC, v => `data-cc="${v}"`)}<small>${AYUDA_CC[cc]}</small></div>
          <div class="jg2-op"><span>CPU</span><div class="jg2-seg" role="group" aria-label="CPU">${Object.entries(MKW_NIVEL).map(([k, txt]) =>
            `<button type="button" data-nivel="${k}" data-foco="cpu-${k}" aria-pressed="${nivel === k}">${escapeHtml(txt)}</button>`).join("")}</div><small>${AYUDA_NIVEL[nivel]}</small></div>
          <button type="button" class="jg2-cerrar" data-cerrar data-foco="cerrar">Cerrar</button>
        </div>` : "";
      const ult = est.ultimaTabla;
      const ultima = ult?.tabla?.length ? `<div class="jg2-ultima"><b>${ult.estilo === "playlist" ? "Última playlist" : "Última copa"}</b>
          <span class="jg2-podio">${ult.tabla.slice(0, 3).map((f, i) => `<span>${i + 1}.º <span translate="no">${escapeHtml(f.nombre)}</span> <i>${Number(f.puntos)}</i></span>`).join("")}</span>
          ${ult.tabla.length > 3 ? `<button type="button" class="jg2-vertabla" data-tabla data-foco="tabla" aria-expanded="${abierto.tabla}">${abierto.tabla ? "Ocultar tabla" : "Ver tabla"}</button>` : ""}
        </div>${abierto.tabla && ult.tabla.length > 3 ? `<ol class="jg2-tabla">${ult.tabla.map((f, i) => `<li><i>${i + 1}.º</i><span translate="no">${escapeHtml(f.nombre)}</span><b>${Number(f.puntos)}</b></li>`).join("")}</ol>` : ""}` : "";
      const fila = j => `<li class="jg2-fila${j.uid === uid ? " yo" : ""}">${cara(j, 30)}<span class="jg2-nombre"><b translate="no" title="${nom(j)}">${nom(j)}</b>${corona(j)}${j.uid === uid ? "<small>tú</small>" : ""}</span>${preDeJ(j)}${vrDe(j)}${menuDe(j)}</li>`;
      const accion = manda && !corre
        ? `<button type="button" class="jg-mkw-empieza jg2-largar" data-foco="empieza" ${sinPrograma ? "disabled" : ""}>¡A correr!</button>`
        : espera ? `<p class="jg2-espera" role="status"><i class="jg2-punto" aria-hidden="true"></i><span>${espera}</span></p>` : "";
      vest.innerHTML = `
        <div class="jg2-boleto">
          <div class="jg2-que">
            <div class="jg2-ojo">Mario Kart Wii · lo que se corre</div>
            <p class="jg2-titular">${titular}</p>
            <div class="jg2-ayuda">${AYUDA_MODO[estilo]}</div>
          </div>
          ${accion ? `<div class="jg2-accion">${accion}</div>` : ""}
          ${puede ? `<button type="button" class="jg2-cambiar" data-cambiar data-foco="cambiar" aria-expanded="${abierto.cambiar}" aria-controls="jg2-opciones">✎ Cambiar</button>` : ""}
        </div>
        ${opciones}
        ${nota ? `<p class="jg-mkw-nota jg2-nota" role="status">${nota}</p>` : ""}
        ${salirBtn}
        ${enSala() && inmersivo ? `<button type="button" class="jg2-inm" data-inm data-foco="inm" aria-pressed="${inmPref}" title="Al empezar la copa, la sala pasa a pantalla completa (sales con Esc). Puede ir más lento en computadores modestos.">Pantalla completa al empezar</button>` : ""}
        ${ultima}
        <div class="jg2-pcab"><b>Pilotos</b><span>${js.length} de ${cupo}</span><span class="jg2-puntos" aria-hidden="true">${Array.from({ length: cupo }, (_, i) => `<i class="${i < js.length ? "si" : ""}"></i>`).join("")}</span></div>
        <ul class="jg2-lista">${js.map(fila).join("")}${cpus ? `<li class="jg2-cpu"><span class="jg2-inicial cpu" aria-hidden="true">CPU</span><span>+ ${cpus} CPU · ${escapeHtml(MKW_NIVEL[nivel])}</span></li>` : ""}</ul>`;
    }
    if (foco) vest.querySelector(`[data-foco="${CSS.escape(foco)}"]`)?.focus();
  }
  /* Los botones del vestíbulo (uno solo para todos: el panel se rehace entero). Las jugadas son las de siempre. */
  function clicVest(ev) {
    const b = ev.target.closest("button");
    if (!b || !vest?.contains(b) || b.disabled) return;
    if (b.hasAttribute("data-cambiar")) { abierto.cambiar = !abierto.cambiar; pintaVestibulo(true); return; }
    if (b.hasAttribute("data-cerrar")) { abierto.cambiar = false; pintaVestibulo(true); vest.querySelector('[data-foco="cambiar"]')?.focus(); return; }
    if (b.hasAttribute("data-tabla")) { abierto.tabla = !abierto.tabla; pintaVestibulo(true); return; }
    // M22: la pantalla completa al empezar, de cada uno (en este navegador; apagada por omisión)
    if (b.hasAttribute("data-inm")) { inmPref = !inmPref; try { localStorage.setItem(CLAVE_INM, inmPref ? "1" : "0"); } catch {} pintaVestibulo(true); return; }
    if (b.dataset.menu) { abierto.menu = abierto.menu === b.dataset.menu ? "" : b.dataset.menu; pintaVestibulo(true); if (abierto.menu) vest.querySelector(".jg2-menu button")?.focus(); return; }
    const elegido = b.getAttribute("aria-pressed") === "true";
    if (b.classList.contains("jg-mkw-modo")) { if (!elegido) anota({ t: "ajuste", uid, k: "estilo", v: b.dataset.e }); return; }
    if (b.dataset.cc) { if (!elegido) anota({ t: "ajuste", uid, k: "cc", v: b.dataset.cc }); return; }
    if (b.dataset.nivel) { if (!elegido) anota({ t: "ajuste", uid, k: "nivel", v: b.dataset.nivel }); return; }
    if (b.classList.contains("jg-mkw-dar")) { b.disabled = true; abierto.menu = ""; anota({ t: "anfitrion", uid, a: b.dataset.a }); return; }
    // §87: echar (el anfitrión): sale al momento y no vuelve a esta sala; con la copa andando su kart sigue sin nadie
    if (b.classList.contains("jg-mkw-echa")) {
      if (!confirm(`¿Echar a ${nombre(b.dataset.e)} de la sala? Sale al momento${corriendo() ? " (su kart sigue la carrera sin nadie)" : ""} y no puede volver a esta sala.`)) return;
      b.disabled = true; abierto.menu = "";
      anota({ t: "echa", uid, a: b.dataset.e });
      return;
    }
    if (b.classList.contains("jg-mkw-empieza")) { b.disabled = true; abierto.cambiar = false; anota({ t: "empieza", uid }); return; }
    // (M22, el crítico: un clic cerraba la copa de todos, sin tabla; ahora pregunta)
    if (b.classList.contains("jg-mkw-vuelve")) {
      if (!confirm("¿Terminar la copa para todos? Se cierra el juego de todos y vuelven al vestíbulo, sin la tabla de esta copa.")) return;
      b.disabled = true; anota({ t: "vuelve", uid });
      return;
    }
    if (b.hasAttribute("data-salir")) { salir?.(); }
  }
  /* M22: lo que dice la tira con la copa andando, según la fase que manda el marco (sin ella, algo que siempre es cierto) */
  function notaFase(manda, estilo) {
    const f = faseJuego, jefe = escapeHtml(nombre(est.anfitrion));
    if (f?.fase === "copa") return manda ? (estilo === "copa" ? "Elige la copa en el juego." : "Arma la lista en el juego; los demás te pueden sugerir pistas.")
      : `${jefe} está ${estilo === "copa" ? "eligiendo la copa" : "armando la lista"}. Mientras, ya puedes elegir personaje y vehículo.`;
    if (f?.fase === "elegir") return "Cada uno elige personaje y vehículo en el juego.";
    if (f?.fase === "carrera") return `Carrera ${f.carrera}${f.carreras ? ` de ${f.carreras}` : ""} en curso.`;
    if (f?.fase === "descanso") return `Descanso: la carrera ${f.carrera + 1} empieza en unos segundos.`;
    if (f?.fase === "fin") return "La copa terminó.";
    return "Todos corren la misma carrera y la CPU completa los 12. Si recargas la página, vuelves en la carrera siguiente.";
  }
  /* Escape cierra el «⋯» o «Cambiar»; un clic fuera del menú lo cierra */
  function teclaVest(ev) {
    if (ev.key !== "Escape" || (!abierto.menu && !abierto.cambiar)) return;
    const volver = abierto.menu ? `menu-${abierto.menu}` : "cambiar";
    abierto.menu = ""; abierto.cambiar = false;
    pintaVestibulo(true);
    vest?.querySelector(`[data-foco="${CSS.escape(volver)}"]`)?.focus();
  }
  function clicFuera(ev) {
    if (!abierto.menu || ev.target.closest?.(".jg2-menu, [data-menu]")) return;
    abierto.menu = "";
    pintaVestibulo(true);
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
    vest.addEventListener("click", clicVest);
    vest.addEventListener("keydown", teclaVest);
    document.addEventListener("click", clicFuera);
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
      precarga(); cargaMarco(); pideVrs(); pintaVestibulo(true);
    });
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    vigilarAnfitrion();
    precarga();
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
    marcoPre?.remove(); marcoPre = null; offPre?.(); offPre = null;
    offVig?.(); offVig = null; clearInterval(vigJefe);
    if (inmAuto !== null) { inmAuto = null; try { inmersivo?.(false); } catch {} }
    clearInterval(conecta); clearInterval(esperaSala);
    document.removeEventListener("click", clicFuera);
    offP?.(); offM?.();
    senal?.sale();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}

/* ---------- El vestíbulo de la sala (M21, la propuesta D) ---------- */
/* Los textos del vestíbulo: el modo en corto (el titular) y una línea de ayuda por opción */
const MODO_CORTO = { copa: "Copa", playlist: "Playlist" };
const AYUDA_MODO = { copa: "Una copa del juego: 4 pistas, con puntos.", playlist: "Una lista de pistas que arma el anfitrión; los demás sugieren." };
const AYUDA_CC = { c150: "La velocidad de siempre.", espejo: "A 150cc, con las pistas dadas vuelta.",
  c100: "Mucho más rápido. Hay que frenar antes de las curvas.", azar: "Cada carrera sortea la suya: 150cc, espejo o 200cc." };
const AYUDA_NIVEL = { facil: "Para practicar o para quien recién empieza.", normal: "Corren como las de un Gran Premio difícil.",
  dificil: "Más rápidas, y persiguen al que va primero.", maximo: "Todo al tope: el kart más rápido, sin frenarse nunca." };
const CORONA = '<svg class="jg2-corona" viewBox="0 0 16 16" role="img" aria-label="anfitrión"><title>Anfitrión</title><path fill="currentColor" d="M1 4.5l3.6 3.1L8 2l3.4 5.6L15 4.5 13.6 13H2.4z"/></svg>';
/* Los estilos del vestíbulo nuevo: van aquí y no en juegos.html (ese archivo no se toca), en un <style> que se agrega
   una sola vez. Todo cuelga de `.jg-mkw-vest.jg-mkw2`, que pesa más que las reglas viejas `.jg-mkw-*` de juegos.html
   (el fondo azul, el borde y el color de letra del panel se quedan de ahí). Los cambios de ancho miran el panel
   (@container), no la ventana: el panel comparte la fila con el chat. */
const ESTILO_VEST = `
.jg-mkw-vest.jg-mkw2{container-type:inline-size;gap:12px}
.jg-mkw2 .jg2-boleto{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 18px;align-items:center;background:#00000038;border-radius:16px;padding:22px 18px 14px}
.jg-mkw2 .jg2-boleto::before{content:"";position:absolute;inset:0 0 auto 0;height:8px;background:repeating-conic-gradient(#eef2ff 0 25%,#0f1c3a 0 50%) 0 0/8px 8px;opacity:.9}
.jg-mkw2 .jg2-que{min-width:0}
.jg-mkw2 .jg2-ojo{font:600 .72rem/1.2 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#b9c4e6}
.jg-mkw2 .jg2-titular{margin:4px 0 0;font:italic 900 clamp(1.4rem,4.2cqi,2.1rem)/1.08 system-ui,sans-serif;color:#fff;text-shadow:0 3px 0 #c81d25,0 6px 10px #0008;text-wrap:balance}
.jg-mkw2 .jg2-ayuda{color:#b9c4e6;font-size:.9rem;margin-top:6px}
.jg-mkw2 .jg2-accion{display:grid;justify-items:end}
.jg-mkw2 .jg2-largar{border:0;border-radius:14px;padding:15px 30px;background:#e4202e;color:#fff;font:900 1.2rem system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #8f1018}
.jg-mkw2 .jg2-largar:active{transform:translateY(2px);box-shadow:0 1px 0 #8f1018}
.jg-mkw2 .jg2-largar:disabled{opacity:.5;cursor:default;transform:none}
.jg-mkw2 .jg2-espera{margin:0;display:flex;align-items:center;gap:8px;color:#b9c4e6;max-width:260px;text-align:right;font-size:.95rem}
.jg-mkw2 .jg2-espera b{color:#eef2ff}
.jg-mkw2 .jg2-punto{width:9px;height:9px;border-radius:50%;background:#5ad18a;flex:none}
@media (prefers-reduced-motion:no-preference){.jg-mkw2 .jg2-punto{animation:jg2-latido 1.6s ease-in-out infinite}}
@keyframes jg2-latido{50%{opacity:.35;transform:scale(.8)}}
.jg-mkw2 .jg2-cambiar{justify-self:start;border:1px solid #ffffff26;background:transparent;color:#b9c4e6;border-radius:9px;padding:4px 10px;font:inherit;font-size:.85rem;cursor:pointer}
.jg-mkw2 .jg2-cambiar:hover,.jg-mkw2 .jg2-cambiar[aria-expanded=true]{color:#eef2ff;border-color:#ffffff55}
.jg-mkw2 .jg2-opciones{display:grid;gap:12px;border:1px solid #ffffff26;border-radius:14px;padding:14px;background:#ffffff08}
.jg-mkw2 .jg2-op{display:grid;grid-template-columns:96px minmax(0,1fr);gap:4px 12px;align-items:center}
.jg-mkw2 .jg2-op>span{color:#b9c4e6;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}
.jg-mkw2 .jg2-op small{grid-column:2;color:#b9c4e6;font-size:.84rem}
.jg-mkw2 .jg2-seg{justify-self:start;display:inline-flex;flex-wrap:wrap;gap:4px;background:#00000033;border-radius:12px;padding:4px}
.jg-mkw2 .jg2-seg button{display:inline-block;border:0;box-shadow:none;background:transparent;color:#eef2ff;border-radius:9px;padding:6px 12px;font:inherit;cursor:pointer;text-align:center}
.jg-mkw2 .jg2-seg button:hover{background:#ffffff14}
.jg-mkw2 .jg2-seg button[aria-pressed=true]{background:#ffd34d;color:#1b1400;font-weight:700;box-shadow:none;border:0}
.jg-mkw2 .jg2-seg button[data-cc=azar]{margin-left:10px}
.jg-mkw2 .jg2-cerrar{justify-self:end;border:1px solid #ffffff26;background:transparent;color:#eef2ff;border-radius:9px;padding:4px 12px;font:inherit;cursor:pointer}
.jg-mkw2 .jg2-nota{margin:0}
.jg-mkw2 .jg2-ultima{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;border:1px solid #ffd34d40;background:#ffd34d0f;border-radius:12px;padding:8px 12px;font-size:.92rem}
.jg-mkw2 .jg2-ultima>b{color:#ffd34d;font-size:.76rem;text-transform:uppercase;letter-spacing:.08em}
.jg-mkw2 .jg2-podio{display:flex;flex-wrap:wrap;gap:4px 14px;min-width:0}
.jg-mkw2 .jg2-podio i,.jg-mkw2 .jg2-tabla b{font:600 .85rem "IBM Plex Mono",ui-monospace,monospace;font-style:normal;color:#eef2ff}
.jg-mkw2 .jg2-vertabla{margin-left:auto;border:0;background:transparent;color:#b9c4e6;text-decoration:underline;font:inherit;cursor:pointer;padding:0}
.jg-mkw2 .jg2-tabla{list-style:none;margin:0;padding:0;display:grid;gap:2px 18px;font-size:.9rem}
@container (min-width:640px){.jg-mkw2 .jg2-tabla{grid-template-columns:1fr 1fr}}
.jg-mkw2 .jg2-tabla li{display:flex;gap:8px;padding:3px 4px;border-bottom:1px solid #ffffff12}
.jg-mkw2 .jg2-tabla li i{font-style:normal;color:#b9c4e6;min-width:2.2em}
.jg-mkw2 .jg2-tabla li b{margin-left:auto}
.jg-mkw2 .jg2-pcab{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.jg-mkw2 .jg2-pcab>b{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#b9c4e6}
.jg-mkw2 .jg2-pcab>span:not(.jg2-puntos){font:600 .9rem "IBM Plex Mono",ui-monospace,monospace}
.jg-mkw2 .jg2-puntos{display:inline-flex;gap:4px}
.jg-mkw2 .jg2-puntos i{width:9px;height:9px;border-radius:50%;border:1.5px solid #8ea0d6}
.jg-mkw2 .jg2-puntos i.si{background:#eef2ff;border-color:#eef2ff}
.jg-mkw2 .jg2-lista{list-style:none;margin:0;padding:0;display:grid;gap:4px 14px}
@container (min-width:640px){.jg-mkw2 .jg2-lista{grid-template-columns:1fr 1fr}}
.jg-mkw2 .jg2-fila{position:relative;display:flex;align-items:center;gap:10px;min-height:40px;padding:4px 6px;border-radius:10px;min-width:0}
.jg-mkw2 .jg2-fila:hover{background:#ffffff0a}
.jg-mkw2 .jg2-fila.yo{background:#ffffff0d}
.jg-mkw2 .jg2-nombre{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.jg-mkw2 .jg2-nombre b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jg-mkw2 .jg2-nombre small{color:#b9c4e6;font-size:.78rem}
.jg-mkw2 .jg2-corona{width:15px;height:15px;flex:none;color:#ffd34d}
.jg-mkw2 .jg2-vr{font:600 .85rem "IBM Plex Mono",ui-monospace,monospace;color:#b9c4e6;white-space:nowrap}
.jg-mkw2 .jg2-vr b{color:#eef2ff;font-weight:600}
.jg-mkw2 .jg2-mas{flex:none;border:1px solid transparent;background:transparent;color:#b9c4e6;border-radius:8px;width:30px;height:28px;font:inherit;cursor:pointer;line-height:1}
.jg-mkw2 .jg2-mas:hover,.jg-mkw2 .jg2-mas[aria-expanded=true]{border-color:#ffffff26;color:#eef2ff}
.jg-mkw2 .jg2-menu{position:absolute;right:4px;top:38px;z-index:5;display:grid;min-width:170px;background:#0b1530;border:1px solid #ffffff26;border-radius:10px;padding:4px;box-shadow:0 8px 24px #0008}
.jg-mkw2 .jg2-menu button{border:0;background:transparent;color:#eef2ff;text-align:left;padding:7px 10px;border-radius:7px;font:inherit;cursor:pointer;margin:0;align-self:auto}
.jg-mkw2 .jg2-menu button:hover{background:#ffffff12}
.jg-mkw2 .jg2-menu .jg-mkw-echa{color:#ff9a9a}
.jg-mkw2 .jg2-cpu{display:flex;align-items:center;gap:10px;min-height:40px;padding:4px 6px;border:1.5px dashed #8ea0d655;border-radius:10px;color:#8ea0d6}
.jg-mkw2 .jg2-inicial{display:inline-grid;place-items:center;flex:none;border-radius:50%;background:#2f4f8f;color:#fff;font-weight:800;font-size:.8rem}
.jg-mkw2 .jg2-inicial.cpu{width:30px;height:30px;background:transparent;border:1.5px dashed #8ea0d6;color:#8ea0d6;font-size:.6rem;letter-spacing:.04em}
.jg-mkw-vest.jg-mkw2.jugando{padding:10px 14px}
.jg-mkw2>.jg2-tira{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;min-width:0}
.jg-mkw2 .jg2-ttit{font:italic 900 1rem system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #c81d25}
.jg-mkw2 .jg2-tcuenta{font:600 .85rem "IBM Plex Mono",ui-monospace,monospace;color:#b9c4e6}
.jg-mkw2 .jg2-fichas{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 300px;min-width:0}
.jg-mkw2 .jg2-ficha{position:relative;display:inline-flex;align-items:center;gap:6px;background:#ffffff10;border:1px solid #ffffff26;border-radius:999px;padding:3px 6px 3px 3px;max-width:100%}
.jg-mkw2 .jg2-ficha b{font-size:.85rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jg-mkw2 .jg2-ficha.cpu{border-style:dashed;color:#8ea0d6;padding:3px 10px}
.jg-mkw2 .jg2-ficha .jg2-mas{width:24px;height:22px}
.jg-mkw2 .jg2-ficha .jg2-menu{top:30px;right:0}
.jg-mkw2 .jg2-vuelve{border:0;border-radius:10px;padding:8px 14px;background:#ffffff1f;color:#eef2ff;font:700 .95rem system-ui,sans-serif;cursor:pointer}
.jg-mkw2 .jg2-salir{justify-self:start;border:0;border-radius:10px;padding:9px 16px;background:#ffffff1f;color:#eef2ff;font:700 .95rem system-ui,sans-serif;cursor:pointer}
.jg-mkw2 .jg2-vr small{color:#8ea0d6;font-family:system-ui,sans-serif;font-size:.75rem}
.jg-mkw2 .jg2-pre{font:600 .75rem system-ui,sans-serif;color:#8ea0d6;white-space:nowrap}
.jg-mkw2 .jg2-pre.listo{color:#7ee2a8}
.jg-mkw2 .jg2-tira .jg2-nota{flex:1 1 100%;color:#d8def5;font-size:.9rem}
.jg-mkw2 button:focus-visible{outline:2px solid #ffd34d;outline-offset:2px}
@container (max-width:560px){.jg-mkw2 .jg2-boleto{grid-template-columns:1fr}.jg-mkw2 .jg2-accion{justify-items:stretch}.jg-mkw2 .jg2-largar{width:100%}.jg-mkw2 .jg2-espera{text-align:left;max-width:none}.jg-mkw2 .jg2-op{grid-template-columns:1fr}.jg-mkw2 .jg2-op small{grid-column:1}}
/* M22: en el modo inmersivo (si la persona lo pidió) el marco llena la pantalla y la tira del vestíbulo se va (vuelve al
   salir con Esc o «Salir»). Encima del juego, nada difuminado: el difuminado del fondo (backdrop-filter) de la cabecera
   y del botón del chat se recalcula sobre la imagen del juego en cada cuadro (lag) */
html.jg-inm .jg-mkw-marco{height:calc(100dvh - 84px);min-height:0;border-radius:12px}
html.jg-inm .jg-mkw-vest.jugando{display:none}
html.jg-inm:has(.jg-mkw-marco:not([hidden])) .jg-cab,html.jg-inm:has(.jg-mkw-marco:not([hidden])) .jg-chat-abre{backdrop-filter:none;-webkit-backdrop-filter:none}
html.jg-inm:has(.jg-mkw-marco:not([hidden])) .jg-cab{background:#f5f4fa}
html[data-tema=oscuro].jg-inm:has(.jg-mkw-marco:not([hidden])) .jg-cab{background:var(--os-fondo)}
html.jg-inm:has(.jg-mkw-marco:not([hidden])) .jg-chat-abre{background:#000000b3}
.jg-mkw2 .jg2-inm{justify-self:start;display:inline-flex;align-items:center;gap:9px;border:0;background:none;padding:2px 0;color:#d8def5;font:600 .88rem system-ui,sans-serif;cursor:pointer}
.jg-mkw2 .jg2-inm::before{content:"";flex:none;width:30px;height:17px;border-radius:999px;background:#ffffff26 radial-gradient(circle at 8.5px 50%,#eef2ff 6px,transparent 6.5px);transition:background .15s}
.jg-mkw2 .jg2-inm[aria-pressed=true]::before{background:#ffd34d radial-gradient(circle at 21.5px 50%,#1b1440 6px,transparent 6.5px)}
`;
function ponEstiloVest() {
  if (document.getElementById("jg-mkw2-estilo")) return;
  const s = document.createElement("style");
  s.id = "jg-mkw2-estilo";
  s.textContent = ESTILO_VEST;
  document.head.append(s);
}
