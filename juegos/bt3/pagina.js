/* Lo que el sitio le agrega a la página del port (`index.html`, armada por fuente/pagina.py). Se carga
   después del script de la página, así que usa sus nombres globales: Module, ENV, FS, go, fileDisc, say,
   audioUnlock, start.

   Resumen, en tres partes:
   1. **La ISO recordada.** Donde el navegador tiene File System Access (Chrome, Edge), la ISO se elige con
      su selector y su «asa» se guarda en IndexedDB: la próxima vez basta un clic («Usar …»), sin buscarla.
      El archivo nunca se copia ni se sube: el asa solo deja volver a leerlo, con permiso del jugador.
   2. **La barra** de arriba a la derecha: el volumen del sitio (`volumen.js`), «Ajustes» (la ventana F1 del
      juego, abierta en Controls: qué mando usa cada jugador y sus botones), el mando que ve el navegador y
      el log del programa (con ?log=1, o solo si el juego se detiene).
   3. **La sala** (`?modo=online`, dentro de Juegos): al elegir la ISO se avisa a la sala, se espera a que el
      anfitrión empiece, se conecta con el rival por la malla del marco (`red.js`) y recién ahí arranca el
      programa como sesión en línea. El entorno de la sesión (anfitrión o no, reglas) lo pone el programa con
      setenv al empezar el juego (Module.entornoPendiente): ENV ya no sirve una vez cargado el runtime.
   @controles: teclado */
(() => {
  const $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  const SOLO = Q.get("modo") !== "online";   // la página suelta («un jugador»), no el marco de una sala

  // ---------------------------------------------------------------- 0a. el sonido para los que miran
  /* Los que miran una pelea en la sala la ven y la oyen (bt3-directo.js): el emisor manda también el sonido del
     juego. Se toma ANTES del volumen de quien juega (volumen.js le pone al contexto un `destination` con su
     volumen): todo lo que el juego conecta «al parlante» pasa primero por `pre`, y de ahí al volumen de este
     jugador y, cuando alguien mira, a una salida de flujo. Así, si el que juega se silencia, los demás lo siguen
     oyendo; cada uno tiene su propio volumen en su pantalla. */
  (() => {
    const Base = window.AudioContext || window.webkitAudioContext;
    if (!Base) return;
    class ConToma extends Base {
      constructor(...args) {
        super(...args);
        try {
          const vol = this.destination, pre = this.createGain();
          pre.connect(vol);
          for (const p of ["maxChannelCount", "numberOfInputs"]) if (!(p in pre)) Object.defineProperty(pre, p, { get: () => vol[p] });
          Object.defineProperty(this, "destination", { configurable: true, get: () => pre });
          this.__toma = { pre, salida: null };
        } catch (e) { /* el juego suena igual; solo no se puede mandar */ }
      }
    }
    try { window.AudioContext = ConToma; if (window.webkitAudioContext) window.webkitAudioContext = ConToma; } catch (e) {}
    // (el contexto del juego es el de SDL; otro contexto de la página, si lo hubiera, no cuenta)
    Module.audioJuego = () => {
      const ctx = Module.SDL3 && Module.SDL3.audioContext, t = ctx && ctx.__toma;
      if (!t || ctx.state === "closed") return null;
      if (!t.salida) { t.salida = ctx.createMediaStreamDestination(); t.pre.connect(t.salida); }
      return t.salida.stream.getAudioTracks()[0] || null;
    };
  })();

  // ---------------------------------------------------------------- 0. el progreso
  /* Ninguna espera muda: la tarjeta de inicio muestra cuánto falta del programa (3,6 MB), y durante el juego
     una insignia arriba al centro muestra lo que se está cargando del disco privado. */
  const MB = b => (b / 1048576).toLocaleString("es", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const Progreso = window.Progreso = {
    tarjeta(txt, frac) {                     // frac null = sin total conocido (barra que va y viene)
      const el = $("progreso");
      if (!el) return;
      el.hidden = false;
      el.classList.toggle("indef", frac == null);
      el.querySelector("i").style.width = frac == null ? "" : Math.round(Math.min(1, frac) * 100) + "%";
      el.querySelector("span").textContent = txt;
    },
    sinTarjeta() { const el = $("progreso"); if (el) el.hidden = true; },
    // la insignia: una lectura grande con su total, o (sin total) lo que lleva bajado
    insignia(txt, frac) {
      const n = $("net");
      if (!n.querySelector(".pista")) n.innerHTML = '<span></span><div class="pista"><i></i></div>';
      n.querySelector("span").textContent = txt;
      n.classList.toggle("indef", frac == null);
      n.querySelector("i").style.width = frac == null ? "" : Math.round(Math.min(1, frac) * 100) + "%";
      n.classList.add("on");
    },
    lectura: null,                           // {hechos, total} de la lectura grande en curso
    red(bytes) {                             // (lo llama la página del port cuando una lectura tarda)
      if (Progreso.lectura) return;
      Progreso.insignia(desdePrivado ? "Cargando del disco privado…" : "Cargando… " + MB(bytes) + " MB", null);
    },
  };
  let desdePrivado = false;

  /* El programa: el .wasm se baja aquí con su barra y se le entrega al programa ya bajado (locateFile apunta a
     la copia en memoria). Si algo falla, se carga como siempre. */
  (async () => {
    const url = Module.locateFile ? Module.locateFile("bt3-jspi.wasm", "") : "bt3-jspi.wasm";
    /* Ya bajado antes (esta misma versión): sin barra, directo de la caché del navegador. Así Chrome además
       reusa el código ya compilado (lo guarda solo para un .wasm cargado de su dirección, no de un blob), y el
       juego arranca en un momento en vez de recompilar 3,6 MB cada vez. */
    const yaBajado = "bt3.wasm." + url;
    let bajadoAntes = false;
    try { bajadoAntes = localStorage.getItem(yaBajado) === "1"; } catch (e) {}
    if (!bajadoAntes) try {
      Progreso.tarjeta("Descargando el juego…", 0);
      const r = await fetch(url);
      if (!r.ok || !r.body) throw new Error("HTTP " + r.status);
      const total = window.BT3_TAM_WASM || Number(r.headers.get("content-length")) || 0;
      const lector = r.body.getReader(), trozos = [];
      let llevo = 0;
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        trozos.push(value);
        llevo += value.length;
        Progreso.tarjeta(total ? "Descargando el juego… " + MB(llevo) + " de " + MB(total) + " MB" : "Descargando el juego… " + MB(llevo) + " MB",
          total ? llevo / total : null);
      }
      const enMemoria = URL.createObjectURL(new Blob(trozos, { type: "application/wasm" }));
      const original = Module.locateFile;
      Module.locateFile = (f, base) => f.endsWith(".wasm") ? enMemoria : (original ? original(f, base) : base + f);
      try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith("bt3.wasm.")) localStorage.removeItem(k); }
            localStorage.setItem(yaBajado, "1"); } catch (e) {}
    } catch (e) {
      Module.keep && Module.keep("descarga con barra: " + (e.message || e) + " (se carga sin barra)");
    }
    Progreso.tarjeta("Preparando el juego…", null);
    const listo = Module.onRuntimeInitialized;
    Module.onRuntimeInitialized = () => { Progreso.sinTarjeta(); listo && listo(); };
    window.cargaPrograma && window.cargaPrograma();
  })();

  // ---------------------------------------------------------------- 1. la ISO recordada
  const BD = "bt3-iso", TIENDA = "asa";
  const abre = () => new Promise((ok, mal) => {
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TIENDA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  const tienda = async modo => (await abre()).transaction(TIENDA, modo).objectStore(TIENDA);
  const pide = q => new Promise((ok, mal) => { q.onsuccess = () => ok(q.result); q.onerror = () => mal(q.error); });
  const guarda = async h => { try { await pide((await tienda("readwrite")).put(h, "iso")); } catch (e) {} };
  const leeAsa = async () => { try { return await pide((await tienda("readonly")).get("iso")); } catch (e) { return null; } };
  const olvida = async () => { try { await pide((await tienda("readwrite")).delete("iso")); } catch (e) {} };
  window.Disco = { olvida };

  /* El selector que recuerda el archivo solo donde de verdad se puede usar: en el sitio la página está sola
     o dentro de Juegos (mismo origen). Dentro de un marco de otro sitio (un artifact, sandbox) el navegador lo
     rechaza, y abrir el <input> después ya no vale: el clic se gastó y no se abría nada. Ahí, el <input> directo. */
  const mismoSitio = (() => { try { return window.top === window || !!window.top.location.href; } catch (e) { return false; } })();
  const conSelector = typeof window.showOpenFilePicker === "function" && mismoSitio;
  // Elegir con el selector del navegador (para poder recordar el archivo); sin él, el <input> de siempre.
  $("pickLabel").addEventListener("click", async e => {
    if (!conSelector) return;
    e.preventDefault();
    audioUnlock();
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: "Imagen de disco", accept: { "application/octet-stream": [".iso"] } }] });
      const f = await h.getFile();
      await guarda(h);
      go(fileDisc(f));
    } catch (err) {
      if (err && err.name === "AbortError") return;   // cerró el selector sin elegir
      // Un marco que no deja usar el selector (sandbox): el <input> de siempre, sin recordar el archivo.
      if (err && (err.name === "SecurityError" || err.name === "NotAllowedError" || err.name === "TypeError")) { $("iso").click(); return; }
      say("No se pudo abrir el archivo: " + (err.message || err), true);
    }
  });
  /* La ISO de la última vez. Si el navegador todavía deja leerla (Chrome y Edge, después de «Permitir en cada
     visita»), se usa sola: el jugador la elige una vez y nunca más, ni en las peleas de una sala. Si el permiso
     venció, queda un botón «Usar …» que lo vuelve a pedir con un clic (pedirlo exige un clic del jugador). */
  const recordada = () => leeAsa().then(async h => {
    if (!h || !$("recordada")) return;
    const b = $("recordada");
    try {
      // (fuera de una sala no arranca sola: primero se elige el modo y se aprieta, 2b)
      if (!SOLO && await h.queryPermission({ mode: "read" }) === "granted") {
        const f = await h.getFile();                 // (falla si la movieron o la borraron: cae al botón)
        say("Usando " + h.name + "…");
        go(fileDisc(f));
        return;
      }
    } catch (err) {}
    b.textContent = "Usar " + h.name;
    b.hidden = false;
    b.onclick = async () => {
      audioUnlock();
      try {
        let p = await h.queryPermission({ mode: "read" });
        if (p !== "granted") p = await h.requestPermission({ mode: "read" });
        if (p !== "granted") { say("Sin permiso para leer " + h.name + ". Elígela de nuevo.", true); return; }
        go(fileDisc(await h.getFile()));
      } catch (err) {
        await olvida();   // movida o borrada: no se ofrece más
        b.hidden = true;
        say("No se encontró " + h.name + ". Elígela de nuevo.", true);
      }
    };
  });

  /* ------------------------------------------------ 1b. el disco privado (solo los amigos de la lista)
     Si el sitio tiene uno (`disco-privado.json` trae la dirección del Worker, juegos/bt3/fuente/disco/) y esta
     página está dentro de Juegos, se le pide a Juegos el token de Firebase de quien inició sesión y con él el
     índice al Worker. Si responde, el juego arranca leyendo de ahí y no se pide ninguna ISO; si no (no es de la
     lista, sin sesión, sin disco privado), sigue todo como siempre: la ISO recordada o elegir una. */
  const pideToken = nuevo => new Promise(ok => {
    if (window.parent === window) return ok(null);    // la página suelta, fuera de Juegos: sin sesión
    const fin = v => { clearTimeout(reloj); removeEventListener("message", oye); ok(v); };
    const oye = e => { if (e.source === window.parent && e.origin === location.origin && e.data?.canal === "bt3-padre" && e.data.tipo === "token") fin(e.data.token || null); };
    const reloj = setTimeout(() => fin(null), 4000);
    addEventListener("message", oye);
    window.parent.postMessage({ canal: "bt3-hijo", tipo: "token", nuevo: !!nuevo }, location.origin);
  });
  /* ---------- el disco privado, rápido ----------
     El disco está en el R2 del dueño cortado en pedazos de 1 MB (fuente/disco/worker.js). Para que no se espere:
     - **Una cola** con hasta 10 pedidos a la vez: lo que el juego espera ahora («alta») pasa antes que lo que se
       baja por adelantado («baja»), y un pedazo pedido por adelantado que el juego ya necesita sube a «alta».
       Una lectura grande pide todos sus pedazos de una vez (no de a 6 esperando al más lento).
     - **Lo bajado se guarda** en este computador (Cache Storage, «bt3-disco:<tamaño>») y la próxima vez sale de
       ahí. El Worker le dice al navegador `no-store`, para que no quede guardado dos veces.
     - **El arranque, por adelantado**: la primera vez se anota qué pedazos (y qué archivos) lee el juego hasta
       la primera pelea; esa lista se comparte en el Worker (`/arranque.json`) y, al abrir la página, se bajan esos
       pedazos mientras el jugador todavía elige el modo. En este computador, además, esos archivos se copian a la
       memoria del juego en paralelo justo antes de arrancarlo (`precopia`).
     - **Lo esencial** (opcional, un botón): menús, escenarios y luchadores (forma base) para no esperar después.
     - **Las voces de los elegidos**: al salir de la selección (parche: Module.onElegidos) se bajan las frases de
       los luchadores elegidos, para que la primera vez que hablan en la pelea el juego no se detenga a buscarlas.
     - **Siempre se ve** cuando el juego espera algo de la red: la insignia de arriba dice cuánto lleva y a qué
       velocidad, y la primera vez avisa que lo bajado queda guardado. */
  const P = { base: "", token: "", size: 0, pieza: 0, cuantas: 0, almacen: null, guardadas: new Set(), primeraVez: false };
  const Cola = { activos: 0, max: 10, alta: [], baja: [] };
  function despacha() {
    for (;;) {
      let t = null;
      if (Cola.alta.length && Cola.activos < Cola.max) t = Cola.alta.shift();
      else if (!Cola.alta.length && Cola.baja.length && Cola.activos < 6) t = Cola.baja.shift();
      if (!t) return;
      Cola.activos++;
      t.corre();
    }
  }
  // la red: cuánto se bajó en esta sesión y a qué velocidad (los últimos 3 s)
  const Red = { bytes: 0, ventana: [], esperando: 0, reloj: 0, tic: 0 };
  const anotaRed = n => { const t = performance.now(); Red.bytes += n; Red.ventana.push([t, n]); while (Red.ventana.length && t - Red.ventana[0][0] > 3000) Red.ventana.shift(); };
  const velocidad = () => {
    const t = performance.now(), v = Red.ventana.filter(x => t - x[0] <= 3000);
    return v.length ? v.reduce((a, x) => a + x[1], 0) / Math.max(0.5, (t - v[0][0]) / 1000) : 0;
  };
  function muestraRed() {
    const vel = velocidad(), v = vel > 0 ? " · " + MB(vel) + " MB/s" : "";
    const nota = P.primeraVez ? " · la primera vez tarda más: lo que se baja queda guardado" : "";
    if (Progreso.lectura) {
      const e = Progreso.lectura;
      Progreso.insignia("Cargando del disco privado… " + MB(e.hechos) + " de " + MB(e.total) + " MB" + v + nota, e.hechos / e.total);
    } else Progreso.insignia("↓ Disco privado · " + MB(Red.bytes) + " MB bajados" + v + nota, null);
  }
  // el juego espera algo de la red: a los 0,4 s se muestra, y se va un momento después de que llega
  function esperaRed(mas) {
    Red.esperando += mas;
    if (Red.esperando > 0 && !Red.reloj && !Red.tic) Red.reloj = setTimeout(() => { Red.reloj = 0; muestraRed(); Red.tic = setInterval(muestraRed, 300); }, 400);
    if (Red.esperando === 0) {
      clearTimeout(Red.reloj); Red.reloj = 0;
      setTimeout(() => { if (Red.esperando === 0 && !Progreso.lectura) { clearInterval(Red.tic); Red.tic = 0; $("net").classList.remove("on"); } }, 350);
    }
  }
  const urlPieza = i => P.base + "/pieza/" + String(i).padStart(5, "0") + ".bin";
  // un pedazo desde la red (con reintentos: el token dura una hora, y una red de celular a veces corta)
  async function deRed(i, alta) {
    for (let intento = 0; ; intento++) {
      try {
        const res = await fetch(urlPieza(i), { headers: { Authorization: "Bearer " + P.token }, priority: alta ? "high" : "low" });
        if (res.status === 401 && intento < 2) { P.token = (await pideToken(true)) || P.token; continue; }
        if (!res.ok) throw new Error("disco privado: HTTP " + res.status);
        const bytes = new Uint8Array(await res.arrayBuffer());
        anotaRed(bytes.length);
        if (P.almacen) { P.guardadas.add(i); P.almacen.put(urlPieza(i), new Response(bytes)).catch(() => P.guardadas.delete(i)); }
        return bytes;
      } catch (e) {
        if (intento >= (alta ? 6 : 3)) throw e;
        Module.keep && Module.keep("disco privado: pedazo " + i + " falló (" + (e.message || e) + "), de nuevo");
        await new Promise(ok => setTimeout(ok, 300 * 2 ** intento));
      }
    }
  }
  // los pedazos en memoria (los últimos 64) y los que están en camino
  const enMemoria = new Map(), enCamino = new Map();
  function pedazo(i, alta) {
    let q = enMemoria.get(i);
    if (q) { enMemoria.delete(i); enMemoria.set(i, q); return q; }
    const c = enCamino.get(i);
    if (c) {
      if (alta && c.tarea && Cola.baja.includes(c.tarea)) { Cola.baja.splice(Cola.baja.indexOf(c.tarea), 1); Cola.alta.push(c.tarea); despacha(); }
      if (alta && !c.alta) { c.alta = true; esperaRed(1); const fin = () => esperaRed(-1); c.q.then(fin, fin); }
      return c.q;
    }
    const camino = { alta, tarea: null, q: null };
    camino.q = (async () => {
      if (P.almacen && P.guardadas.has(i)) {
        try { const g = await P.almacen.match(urlPieza(i)); if (g) return new Uint8Array(await g.arrayBuffer()); } catch (e) {}
      }
      return await new Promise((ok, mal) => {
        camino.tarea = { corre: () => { camino.tarea = null; deRed(i, camino.alta).then(ok, mal).finally(() => { Cola.activos--; despacha(); }); } };
        (alta ? Cola.alta : Cola.baja).push(camino.tarea);
        despacha();
      });
    })();
    if (alta) { esperaRed(1); const fin = () => esperaRed(-1); camino.q.then(fin, fin); }
    enCamino.set(i, camino);
    camino.q.then(() => {
      enCamino.delete(i);
      enMemoria.set(i, camino.q);
      while (enMemoria.size > 64) enMemoria.delete(enMemoria.keys().next().value);
    }, () => enCamino.delete(i));
    return camino.q;
  }
  // bajar por adelantado (sin esperar ni mostrar nada): los que no estén guardados todavía
  const adelanta = ids => ids.filter(i => i >= 0 && i < P.cuantas && !P.guardadas.has(i) && !enMemoria.has(i)).map(i => pedazo(i, false).catch(() => {}));

  /* ---------- el arranque ---------- */
  const Arranque = { grabando: true, piezas: new Set(), archivos: new Set(), clave: "" };
  const archivosArranque = () => { try { return JSON.parse(localStorage.getItem("bt3.arranque." + P.size) || "{}"); } catch (e) { return {}; } };
  async function prebajaArranque() {
    let lista = [];
    try { const r = await fetch(P.base + "/arranque.json", { headers: { Authorization: "Bearer " + P.token } }); if (r.ok) lista = await r.json(); } catch (e) {}
    const local = archivosArranque();
    const todos = [...new Set([...(Array.isArray(lista) ? lista : []), ...(Array.isArray(local.piezas) ? local.piezas : [])])];
    const faltan = todos.filter(i => Number.isInteger(i) && !P.guardadas.has(i));
    if (!faltan.length) return;
    const total = faltan.length;
    let hechos = 0;
    Bajando.pon("arranque", "⬇ Adelantando el arranque…", 0);
    await Promise.all(adelanta(faltan).map(q => q.then(() => { hechos++; Bajando.pon("arranque", "⬇ Adelantando el arranque · " + hechos + " de " + total + " MB", hechos / total); })));
    Bajando.quita("arranque");
  }
  // la primera pelea empezó: lo leído hasta aquí es el arranque (se guarda aquí y se suma a la lista del Worker)
  function terminaArranque() {
    if (!Arranque.grabando) return;
    Arranque.grabando = false;
    const piezas = [...Arranque.piezas].sort((a, b) => a - b).slice(0, 1500), archivos = [...Arranque.archivos].slice(0, 3000);
    try { localStorage.setItem("bt3.arranque." + P.size, JSON.stringify({ piezas, archivos })); } catch (e) {}
    const enviado = "bt3.arranque.enviado." + P.size;
    let ya = false;
    try { ya = localStorage.getItem(enviado) === "1"; } catch (e) {}
    if (ya || !piezas.length) return;
    fetch(P.base + "/arranque.json", { method: "PUT", headers: { Authorization: "Bearer " + P.token, "Content-Type": "application/json" }, body: JSON.stringify(piezas) })
      .then(r => { if (r.ok) try { localStorage.setItem(enviado, "1"); } catch (e) {} }).catch(() => {});
  }
  // antes de arrancar el programa: los archivos del arranque, copiados a la memoria del juego de a 8 a la vez
  async function precopia() {
    const lista = (archivosArranque().archivos || []).filter(x => typeof x === "string" && Module.webIndex && Module.webIndex[x.replace(/^\/?gamedata\//, "")]);
    if (!lista.length || !Module.webDiscEnsure) return;
    let hechos = 0, siguiente = 0;
    const uno = async () => { while (siguiente < lista.length) { const p = lista[siguiente++]; try { await Module.webDiscEnsure(p); } catch (e) {} hechos++; if (hechos % 8 === 0) Progreso.insignia("Preparando el juego… " + hechos + " de " + lista.length + " archivos", hechos / lista.length); } };
    await Promise.all(Array.from({ length: 8 }, uno));
    if (!Progreso.lectura && !Red.tic) $("net").classList.remove("on");
  }
  // anota lo que el juego abre (y qué pedazos lee) hasta la primera pelea
  function grabaArchivos() {
    const original = Module.webDiscEnsure;
    if (!original || original.grabando) return;
    Module.webDiscEnsure = async function (path) { if (Arranque.grabando) Arranque.archivos.add(path); return original(path); };
    Module.webDiscEnsure.grabando = true;
  }

  /* ---------- lo esencial y las voces: qué archivos ----------
     Cada archivo del juego tiene un número (docs del port, files_and_assets.md): `pzs3us1` lleva del 1 al 0xD47 y
     `pzs3us2` del 0xD48 en adelante. Lo esencial: los comunes (2..5), los parámetros de cada luchador
     (8 + chara·2 + lado), los bancos de sonido (0x14A, 0x14B, del escenario 0x14E..), los escenarios (0x171..),
     las pantallas de carga (0x3C1..), y de cada luchador su modelo (0x590 + chara·10), sus animaciones (+8, +9)
     y su banco de voz (0xBDA / 0xC7B + chara). Las frases de voz: chara·100 + frase + 0x8D4E (o + 0xCC32). */
  const rutaDe = id => id <= 0 ? "pzs3us0/" + String(id).padStart(5, "0") + ".bin"
    : id <= 0xD47 ? "pzs3us1/" + String(id - 1).padStart(5, "0") + ".bin" : "pzs3us2/" + String(id - 0xD48).padStart(5, "0") + ".bin";
  function idsEsenciales() {
    const ids = [2, 3, 4, 5, 0x14A, 0x14B, 0x3C1, 0x3C2, 0x3C3];
    for (let i = 8; i < 8 + 161 * 2; i++) ids.push(i);
    for (let i = 0x14E; i <= 0x197; i++) ids.push(i);
    for (let c = 0; c <= 160; c++) ids.push(0x590 + c * 10, 0x598 + c * 10, 0x599 + c * 10, 0xBDA + c, 0xC7B + c);
    return ids;
  }
  const idsLuchador = c => {
    const ids = [8 + c * 2, 9 + c * 2, 0xBDA + c, 0xC7B + c];
    for (let k = 0; k < 10; k++) ids.push(0x590 + c * 10 + k);
    for (let l = 0; l < 100; l++) ids.push(c * 100 + l + 0x8D4E, c * 100 + l + 0xCC32);
    return ids;
  };
  // los pedazos de esos archivos, con el índice de los archivos del disco (el del juego, o uno leído aquí)
  function piezasDe(ids, indice) {
    const out = new Set();
    for (const id of ids) {
      const e = indice[rutaDe(id)];
      if (!e || !e[1]) continue;
      for (let i = Math.floor(e[0] / P.pieza); i <= Math.floor((e[0] + e[1] - 1) / P.pieza); i++) out.add(i);
    }
    return [...out];
  }
  // el índice de los archivos del disco, como lo arma el juego (web_pre.js): directorio ISO 9660 y las tablas AFS
  async function leeIndice(disco) {
    const u32 = (b, o) => b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] * 16777216;
    const pvd = await disco.readAt(16 * 2048, 2048), afs = {};
    const camina = async (lba, tam, pre) => {
      const dir = await disco.readAt(lba * 2048, tam);
      for (let o = 0; o < dir.length;) {
        const largo = dir[o];
        if (largo === 0) { o = (Math.floor(o / 2048) + 1) * 2048; continue; }
        const ext = u32(dir, o + 2), sz = u32(dir, o + 10), flags = dir[o + 25], nl = dir[o + 32], crudo = dir.subarray(o + 33, o + 33 + nl);
        o += largo;
        if (nl === 1 && (crudo[0] === 0 || crudo[0] === 1)) continue;
        const nombre = String.fromCharCode(...crudo).replace(/;1$/, "");
        if (flags & 2) { if (pre === "" && nombre === "DATA") await camina(ext, sz, "DATA/"); }
        else if (/^DATA\/PZS3US[012]\.AFS$/.test(pre + nombre)) afs[nombre[6]] = ext * 2048;
      }
    };
    await camina(u32(pvd, 158), u32(pvd, 166), "");
    const indice = {};
    for (const n of ["0", "1", "2"]) {
      if (afs[n] === undefined) continue;
      const cab = await disco.readAt(afs[n], 8), cuantos = u32(cab, 4), tabla = await disco.readAt(afs[n] + 8, cuantos * 8);
      for (let i = 0; i < cuantos; i++) indice["pzs3us" + n + "/" + String(i).padStart(5, "0") + ".bin"] = [afs[n] + u32(tabla, i * 8), u32(tabla, i * 8 + 4)];
    }
    return indice;
  }

  /* ---------- la barrita de lo que se baja por detrás (en la barra de arriba) ---------- */
  const Bajando = {
    el: null, cosas: new Map(),
    pon(k, txt, frac, alClic) {
      if (!this.el) {
        this.el = document.createElement("button");
        this.el.type = "button"; this.el.id = "bajando";
        $("barra").insertBefore(this.el, $("barra").querySelector("[data-volumen]"));
        this.el.onclick = () => { const c = [...this.cosas.values()].pop(); c && c.alClic && c.alClic(); };
      }
      this.cosas.set(k, { txt, frac, alClic });
      this.pinta();
    },
    quita(k) { this.cosas.delete(k); this.pinta(); },
    pinta() {
      if (!this.el) return;
      const c = [...this.cosas.values()].pop();
      this.el.hidden = !c;
      if (!c) return;
      this.el.textContent = c.txt;
      this.el.style.setProperty("--f", c.frac == null ? "0" : String(Math.min(1, c.frac)));
      this.el.classList.toggle("clic", !!c.alClic);
    },
  };

  /* ---------- lo esencial (opcional) ---------- */
  const Esencial = { piezas: null, corriendo: false, pausa: false };
  async function preparaEsencial(disco) {
    try {
      const indice = await leeIndice(disco);
      Esencial.piezas = piezasDe(idsEsenciales(), indice);
    } catch (e) { return; }
    pintaEsencial();
  }
  function pintaEsencial() {
    const ps = Esencial.piezas;
    if (!ps || !ps.length) return;
    const faltan = ps.filter(i => !P.guardadas.has(i)).length, tot = ps.length;
    let boton = $("esencial");
    if (!boton && SOLO && $("start") && $("serverDisc")) {   // en la tarjeta de inicio, bajo «Jugar»
      boton = document.createElement("button");
      boton.id = "esencial"; boton.type = "button"; boton.className = "pick alt";
      $("serverDisc").after(boton);
      boton.onclick = () => alternaEsencial();
    }
    if (!faltan) {
      Bajando.quita("esencial");
      if (boton) { boton.textContent = "✓ Lo esencial ya está guardado en este computador"; boton.disabled = true; }
      return;
    }
    const txt = Esencial.corriendo
      ? (Esencial.pausa ? "⏸ Lo esencial, en pausa · " : "⬇ Bajando lo esencial · ") + Math.round((tot - faltan) / tot * 100) + "% (" + (tot - faltan) + " de " + tot + " MB)"
      : "⬇ Bajar lo esencial · " + faltan + " MB" + (faltan < tot ? " (" + Math.round((tot - faltan) / tot * 100) + "% ya guardado)" : "");
    if (boton) { boton.textContent = txt; boton.title = "Menús, escenarios y los luchadores en su forma base: para no esperar después. Se puede jugar mientras baja."; }
    Bajando.pon("esencial", txt, (tot - faltan) / tot, alternaEsencial);
  }
  async function alternaEsencial() {
    if (Esencial.corriendo) { Esencial.pausa = !Esencial.pausa; pintaEsencial(); return; }
    Esencial.corriendo = true;
    pintaEsencial();
    const pendientes = Esencial.piezas.filter(i => !P.guardadas.has(i));
    let k = 0;
    const uno = async () => {
      while (k < pendientes.length) {
        while (Esencial.pausa) await new Promise(ok => setTimeout(ok, 500));
        const i = pendientes[k++];
        if (!P.guardadas.has(i)) await pedazo(i, false).catch(() => {});
        pintaEsencial();
      }
    };
    await Promise.all(Array.from({ length: 4 }, uno));   // (la cola deja pasar antes lo que el juego espera)
    Esencial.corriendo = false;
    pintaEsencial();
  }

  /* ---------- las voces y los modelos de los elegidos ---------- */
  Module.onElegidos = charas => {
    if (!Module.webIndex || !P.size) return;
    const ids = [...new Set(charas.filter(c => Number.isInteger(c) && c >= 0 && c <= 160))].flatMap(idsLuchador);
    const rutas = ids.map(rutaDe).filter(r => Module.webIndex[r]);
    adelanta(piezasDe(ids, Module.webIndex));
    // y las frases, ya copiadas a la memoria del juego (de a 3, sin apuro)
    const frases = rutas.filter(r => r.startsWith("pzs3us2/"));
    let k = 0;
    const uno = async () => { while (k < frases.length) { const r = frases[k++]; try { await Module.webDiscEnsure("/gamedata/" + r); } catch (e) {} } };
    for (let n = 0; n < 3; n++) uno();
  };

  async function discoPrivado() {
    let base = "";
    try { base = String((await (await fetch("disco-privado.json", { cache: "no-store" })).json()).url || "").replace(/\/+$/, ""); } catch (e) {}
    if (!base) return false;
    let token = await pideToken(false);
    if (!token) return false;
    let r;
    try { r = await fetch(base + "/indice.json", { headers: { Authorization: "Bearer " + token } }); } catch (e) { return false; }
    if (r.status === 403) {   // con sesión, pero fuera de la lista: su código, para pasárselo al dueño del disco
      let uid = "";
      try { uid = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub; } catch (e) {}
      say("Disco privado: no estás en la lista (tu código: " + uid + "). Mientras, elige tu ISO.");
      return false;
    }
    if (!r.ok) return false;
    const { size, pieza } = await r.json();
    Object.assign(P, { base, token, size, pieza, cuantas: Math.ceil(size / pieza) });
    P.almacen = await (async () => { try { return await caches.open("bt3-disco:" + size); } catch (e) { return null; } })();
    try { navigator.storage?.persist?.(); } catch (e) {}   // que el navegador no lo borre al primer apuro de espacio
    // al cambiar la ISO subida (otro tamaño), lo guardado de la anterior no sirve: se borra
    try { for (const k of await caches.keys()) if (k.startsWith("bt3-disco:") && k !== "bt3-disco:" + size) caches.delete(k); } catch (e) {}
    // qué pedazos ya están guardados aquí (para no pedirlos, y para saber si es la primera vez)
    if (P.almacen) try {
      for (const q of await P.almacen.keys()) { const m = /\/pieza\/(\d{5})\.bin$/.exec(q.url); if (m) P.guardadas.add(Number(m[1])); }
    } catch (e) {}
    // la primera vez: este computador nunca llegó a una pelea (no tiene anotado el arranque) y casi no tiene nada
    P.primeraVez = !(archivosArranque().archivos || []).length && P.guardadas.size < 40;
    if (P.primeraVez) say("La primera vez tarda un poco más: lo que se baja del disco privado queda guardado en este computador, y la próxima vez sale de aquí.");
    let ultimo = -10, racha = 0;
    desdePrivado = true;
    const disco = { size, readAt: async (o, n) => {
      const out = new Uint8Array(n);
      if (n === 0) return out;
      // una lectura de 2 MB o más (un escenario, un luchador): la insignia con su barra y la velocidad, si tarda
      const grande = n >= 2 * 1048576, estado = { hechos: 0, total: n };
      const a = Math.floor(o / pieza), z = Math.floor((o + n - 1) / pieza);
      if (Arranque.grabando) for (let i = a; i <= z; i++) Arranque.piezas.add(i);
      racha = a >= ultimo && a <= ultimo + 2 ? racha + 1 : 0;
      ultimo = z;
      if (racha >= 2) adelanta([z + 1, z + 2, z + 3, z + 4]);   // lee en orden: los 4 siguientes por adelantado
      if (grande) Progreso.lectura = estado;
      const ids = [];
      for (let i = a; i <= z; i++) ids.push(i);
      await Promise.all(ids.map(i => pedazo(i, true).then(b => {
        const desde = Math.max(o, i * pieza), hasta = Math.min(o + n, (i + 1) * pieza);
        out.set(b.subarray(desde - i * pieza, hasta - i * pieza), desde - o);
        estado.hechos += hasta - desde;
      })));
      if (grande && Progreso.lectura === estado) { Progreso.lectura = null; if (!Red.tic) $("net").classList.remove("on"); }
      return out;
    } };
    $("pickLabel").hidden = true;
    prebajaArranque();          // mientras se elige el modo
    preparaEsencial(disco);     // (calcula cuánto es lo esencial y ofrece el botón)
    if (SOLO) { listoParaJugar(() => go(disco), P.primeraVez ? "Disco privado listo. La primera vez tarda un poco más: lo que se baja queda guardado." : "Disco privado listo."); return true; }   // espera el «Jugar» (2b)
    say("Usando el disco privado…");
    go(disco);
    return true;
  }
  // Primero el disco privado; si no hay, la ISO recordada; si tampoco, el jugador elige.
  discoPrivado().then(ok => { if (!ok) recordada(); }, () => recordada());

  // ---------------------------------------------------------------- 2. la barra
  const registro = $("registro");
  const pinta = () => { registro.textContent = (Module.log || []).slice(-200).join("\n"); registro.scrollTop = registro.scrollHeight; };
  let relojLog = 0;
  const abreLog = () => { registro.classList.add("on"); pinta(); clearInterval(relojLog); relojLog = setInterval(pinta, 1000); };
  $("verLog").hidden = Q.get("log") !== "1";
  $("verLog").onclick = () => registro.classList.contains("on") ? (registro.classList.remove("on"), clearInterval(relojLog)) : abreLog();
  // Si el programa termina o se cae, el log se abre solo: es lo que hay que mandar para arreglarlo.
  const abortaba = Module.onAbort;
  Module.onAbort = what => { abortaba && abortaba(what); $("verLog").hidden = false; abreLog(); };
  Module.onExit = code => { Module.keep("el programa terminó con el código " + code); $("verLog").hidden = false; abreLog(); };

  // Ajustes: la ventana del juego en la pestaña Controls (3). Solo cuando el juego ya arrancó.
  const ajustes = $("ajustes");
  const verAjustes = setInterval(() => { if (document.body.classList.contains("started")) { ajustes.hidden = false; clearInterval(verAjustes); } }, 500);
  ajustes.onclick = () => {
    if (Module._Web_Settings) Module._Web_Settings(3);   // segundo clic: la cierra
    Module.canvas.focus();                                 // teclado y mando de vuelta al juego
  };

  // El mando: el juego lo lee solo (SDL3 y la Gamepad API); aquí solo se muestra cuál ve el navegador.
  const mando = $("mando");
  const mandos = () => {
    let l;
    try { l = navigator.getGamepads ? navigator.getGamepads() : null; }
    catch (e) { mando.textContent = "Mandos bloqueados aquí"; mando.className = "mal"; return false; }
    if (!l) { mando.textContent = "Sin soporte de mandos"; mando.className = "mal"; return false; }
    const on = [...l].filter(Boolean);
    mando.textContent = on.length ? "Mando: " + on.map(g => g.id.replace(/\s*\(.*$/, "")).join(", ") : "Mando: aprieta un botón";
    mando.className = on.length ? "ok" : "";
    return true;
  };
  if (mandos()) setInterval(mandos, 1000);
  mando.style.cursor = "pointer";
  mando.onclick = () => { if (!ajustes.hidden) ajustes.onclick(); };

  // El menú «Dragon Net Battle» del juego abría el juego en línea del fork (su servidor): aquí se juega en una sala.
  Module.onNetMenu = () => {
    aviso("Para jugar en línea abre una sala de Budokai Tenkaichi 3 en Juegos: elijan anfitrión y peleen.", 6000);
    try { Module._Web_NetMenuClosed && Module._Web_NetMenuClosed(); } catch (e) {}
  };

  const caja = $("sala");
  let relojAviso = 0;
  function aviso(txt, ms, gira) {          // gira: algo está en curso (esperar, conectar): el indicador que gira
    clearTimeout(relojAviso);
    caja.textContent = txt;
    caja.classList.toggle("on", !!txt);
    caja.classList.toggle("gira", !!gira);
    if (ms) relojAviso = setTimeout(() => caja.classList.remove("on"), ms);
  }

  // ---------------------------------------------------------------- 2b. un jugador: el modo
  /* Como el selector de Snake Club: junto a la tarjeta de inicio, una tarjeta por modo (ícono, nombre, qué es y
     un círculo marcado en el elegido), y el botón de la tarjeta hace lo que dice el modo elegido:
     - Entrenamiento y Contra la CPU se juegan aquí: el programa entra directo a ese modo (BT3_WEB_MODO,
       parche.diff: headless.c). Nada arranca solo: el disco privado y la ISO recordada esperan el «Jugar», que
       además es el clic que deja sonar el juego. Elegir una ISO también es apretar: arranca con el modo elegido.
     - Duelo y Torneo se juegan en una sala: el botón le pide a Juegos que abra una (bt3.js, `alPedirSalaBt3`).
     El modo se recuerda (`bt3.modo`); ?juego=entrenamiento|cpu|duelo|torneo lo elige de entrada. */
  /* Cada modo con su emblema, como el parche del gi en Dragon Ball: un círculo blanco con un kanji (亀 la escuela
     de la tortuga, donde se entrena; 機 máquina; 闘 pelea; 天 de 天下一武道会, el Tenkaichi Budokai). Dibujados
     aquí, sin nada del juego: lo del disco no se publica (ver CLAUDE.md). */
  const MODOS = [
    ["entrenamiento", "亀", "Entrenamiento", "Las lecciones del juego y la práctica libre."],
    ["cpu", "機", "Contra la CPU", "Eliges personajes y peleas contra la máquina."],
    ["duelo", "闘", "Duelo", "Uno contra uno en línea, con revancha."],
    ["torneo", "天", "Torneo", "Eliminación directa con tus amigos, hasta ocho."],
  ];
  const deSala = m => m === "duelo" || m === "torneo";
  const enJuegos = (() => { try { return window.parent !== window && !!window.parent.location.href; } catch (e) { return false; } })();
  let modo = "cpu", jugar = null, lista = null;
  try { modo = localStorage.getItem("bt3.modo") || "cpu"; } catch (e) {}
  if (MODOS.some(x => x[0] === Q.get("juego"))) modo = Q.get("juego");
  if (!MODOS.some(x => x[0] === modo)) modo = "cpu";

  // El disco quedó listo (privado o recordado): el botón «Jugar» lo arranca con el modo elegido.
  function listoParaJugar(f, txt) {
    jugar = f;
    say(txt);
    pintaModo();
  }
  function pintaModo() {
    const st = $("start");
    if (!st || !lista) return;
    st.classList.toggle("en-sala", deSala(modo));
    lista.querySelectorAll("[data-m]").forEach(b => { const si = b.dataset.m === modo; b.classList.toggle("activo", si); b.setAttribute("aria-pressed", String(si)); });
    $("abreSala").textContent = enJuegos ? (modo === "duelo" ? "Abrir sala de duelo" : "Abrir sala de torneo") : "Ir a Juegos para jugar en línea";
    if (jugar) { const b = $("serverDisc"); b.hidden = false; b.textContent = "Jugar · " + MODOS.find(x => x[0] === modo)[2]; }
  }
  if (SOLO && $("start")) {
    lista = document.createElement("aside");
    lista.className = "modos-lista";
    lista.setAttribute("aria-label", "Modo de juego");
    lista.innerHTML = `<div class="modos-tit"><h2>Elige el modo</h2><span>01—04</span></div>` + MODOS.map(([k, ico, t, d], i) =>
      `<button type="button" class="modo" data-m="${k}" aria-pressed="false"><span class="ico ico-${k}" aria-hidden="true"><b translate="no">${ico}</b></span>
        <span><strong>${t}${deSala(k) ? " <em>EN LÍNEA</em>" : ""}</strong><small>${d}</small></span><span class="radio" aria-hidden="true"></span></button>`).join("");
    $("start").classList.add("con-modos");
    $("start").append(lista);
    const sala = document.createElement("button");
    sala.id = "abreSala"; sala.type = "button"; sala.className = "pick";
    $("serverDisc").before(sala);
    sala.onclick = () => {
      if (!enJuegos) { window.open("../../juegos.html", "_top"); return; }
      sala.disabled = true;
      window.parent.postMessage({ canal: "bt3-hijo", tipo: "sala", cupo: modo === "duelo" ? 2 : 8 }, location.origin);
      say("Abriendo la sala…");
    };
    lista.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
      modo = b.dataset.m;
      try { localStorage.setItem("bt3.modo", modo); } catch (e) {}
      pintaModo();
    });
    $("serverDisc").onclick = () => { if (!jugar) return; try { audioUnlock(); } catch (e) {} const f = jugar; jugar = null; f(); };
    pintaModo();
  }
  // Al arrancar el programa: el modo elegido (los de sala nunca llegan aquí: su botón abre la sala).
  async function eligeModo() {
    try { localStorage.setItem("bt3.modo", modo); } catch (e) {}
    Module.entornoPendiente = deSala(modo) ? [] : [["BT3_WEB_MODO", modo]];
    if (desdePrivado) { grabaArchivos(); await precopia(); }   // (el arranque, ya en memoria: ver «el disco privado, rápido»)
  }
  // (los mismos ganchos que usa la sala: el entorno de partida, leído al cargar el programa, y antes de arrancarlo)
  if (SOLO) window.Sala = { entorno: () => ({ BT3_NOMOVIE: "1" }), antesDeEmpezar: eligeModo };

  /* Volver al menú de modos: el botón «← Modos» de la barra (con el juego andando), y también si el jugador sale
     del modo desde el propio juego (atrás hasta el menú principal: el parche lo avisa, Module.onFueraDelModo).
     Así no se llega al resto del juego por la puerta de atrás: siempre se vuelve a elegir aquí. */
  const aModos = aviso => {
    try { if (aviso) sessionStorage.setItem("bt3.volvio", "1"); } catch (e) {}
    location.reload();
  };
  if (SOLO) {
    Module.onFueraDelModo = () => aModos(true);
    const b = document.createElement("button");
    b.id = "volverModos"; b.type = "button"; b.textContent = "← Modos"; b.title = "Volver al menú de modos";
    $("barra").prepend(b);
    b.onclick = () => { if (!document.body.classList.contains("started") || confirm("¿Volver al menú de modos? Lo que no hayas guardado en el juego se pierde.")) aModos(false); };
    try { if (sessionStorage.getItem("bt3.volvio")) { sessionStorage.removeItem("bt3.volvio"); say("Volviste al menú de modos: elige otro o vuelve a jugar."); } } catch (e) {}
  }

  // ---------------------------------------------------------------- 2c. «◀ Atrás» en los menús
  /* Con el mouse no había cómo volver atrás en los menús del juego: este botón aprieta el Triángulo del jugador 1
     (el «atrás» de todos los menús de BT3: PADG_TRIANGLE 0x400 en el juego, PAD_TRIANGLE 0x1000 en el mando) por la
     misma entrada que los controles táctiles (Web_TouchSet). Solo se ve en los menús (el parche avisa con
     Module.onMenus): en la pelea el Triángulo es un golpe. */
  const atras = document.createElement("button");
  atras.id = "atras"; atras.type = "button"; atras.textContent = "◀ Atrás";
  atras.title = "Volver atrás en el menú del juego (lo mismo que el Triángulo; en el teclado, la I)";
  $("barra").insertBefore(atras, $("barra").querySelector("[data-volumen]"));
  atras.onclick = () => {
    atras.blur();   // (el foco vuelve al juego: las teclas siguen andando)
    if (!Module._Web_TouchSet) return;
    const T = window.BT3Touch || {}, bits = T.bits || 0, lx = T.lx ?? 128, ly = T.ly ?? 128;
    Module._Web_TouchSet(bits | 0x1000, lx, ly);
    setTimeout(() => Module._Web_TouchSet(bits, lx, ly), 120);
  };
  Module.onMenus = si => {
    document.body.classList.toggle("en-menus", !!si);
    if (!si && desdePrivado) terminaArranque();   // la primera pelea: lo leído hasta aquí es el arranque
  };

  // ---------------------------------------------------------------- 3. la sala
  const S = window.BT3Sala;
  if (!S || !S.activo) return;

  /* «← Sala»: salir de la pelea y volver al vestíbulo de la sala cuando se quiera (la pelea se corta y no cuenta).
     Lo mismo que salir del modo desde el propio juego (Module.onFueraDelModo, más abajo). */
  const aSala = document.createElement("button");
  aSala.id = "volverSala"; aSala.type = "button"; aSala.textContent = "← Sala"; aSala.title = "Volver a la sala (esta pelea se corta)";
  $("barra").prepend(aSala);
  aSala.onclick = () => {
    if (!confirm("¿Volver a la sala? Esta pelea se corta y no cuenta.")) return;
    aviso("Volviendo a la sala…");
    S.cierra();
    S.avisa("termino", { por: "menu" });
  };

  /* Los vetados, a la vista: mientras está abierta la selección de personajes (el parche avisa con
     Module.onSeleccion), un panel al costado dice cuáles no se pueden elegir según la regla de la sala, con el
     nombre que tienen en el juego. Se pliega con un clic (se recuerda) y nunca está en la pelea. En la selección
     misma, los vetados salen con el candado de los personajes sin desbloquear (parche: ChrGrid_Build). */
  const panel = document.createElement("aside");
  panel.id = "vetos"; panel.hidden = true; panel.setAttribute("aria-label", "Personajes vetados");
  document.body.append(panel);
  let plegado = false, enSeleccion = false, listaVetos = [], reglaVetos = "";
  try { plegado = localStorage.getItem("bt3.vetosPlegado") === "1"; } catch (e) {}
  const pintaVetos = () => {
    panel.hidden = !(enSeleccion && listaVetos.length);
    if (panel.hidden) return;
    panel.classList.toggle("plegado", plegado);
    panel.replaceChildren();
    const tit = document.createElement("button");
    tit.type = "button"; tit.className = "tit"; tit.setAttribute("aria-expanded", String(!plegado));
    tit.innerHTML = `<span>🚫 Vetados · ${reglaVetos === "noop" ? "No OP" : "Sólo malos"}</span><b></b><i>${plegado ? "▸" : "▾"}</i>`;
    tit.querySelector("b").textContent = listaVetos.length;
    tit.onclick = () => { plegado = !plegado; try { localStorage.setItem("bt3.vetosPlegado", plegado ? "1" : "0"); } catch (e) {} pintaVetos(); };
    panel.append(tit);
    if (plegado) return;
    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo";
    const nota = document.createElement("p");
    nota.textContent = "En la selección salen con candado, como los que no están desbloqueados, y tampoco se puede transformar o fusionar en ellos.";
    cuerpo.append(nota);
    const tiers = [...new Set(listaVetos.map(x => x[0]))];
    for (const t of tiers) {
      const g = document.createElement("section");
      const h = document.createElement("h3"); h.textContent = t; g.append(h);
      const ul = document.createElement("ul"); ul.translate = false;
      for (const [, n] of listaVetos.filter(x => x[0] === t)) { const li = document.createElement("li"); li.textContent = n; ul.append(li); }
      g.append(ul); cuerpo.append(g);
    }
    panel.append(cuerpo);
  };
  Module.onSeleccion = abierta => { enSeleccion = !!abierta; pintaVetos(); };
  // La sala de prueba corre dos juegos en la misma pestaña: menos caché del disco por cada uno.
  if (S.prueba) Module.webCacheBudget = 192 * 1024 * 1024;

  let est = null, cuandoEmpiece = null, ronda = 0;
  /* Las reglas de personajes de la sala (No OP / Sólo malos, bt3-tiers.js en la sala): al abrir la selección de
     personajes, el programa manda los nombres que trae el disco (Web_Catalogo, parche.diff) y la sala devuelve
     qué ids quedan fuera (`estado.vetados`). El programa los lee de Module.vetados al elegir (web_vetado): un
     vetado suena a error y nunca sale al azar. */
  /* Los vetados se calculan aquí (S.vetadosDe, bt3-tiers.js en red.js) con los nombres del disco: los recordados de
     la vez anterior (`bt3.catalogo`, el mismo que guarda la sala) y, al abrir la selección, los que manda el juego.
     Esa llamada es sincrónica a propósito: el juego arma su grilla al volver de ella, y los vetados tienen que estar
     en Module.vetados para que salgan con candado. */
  let catalogo = null;
  try { catalogo = JSON.parse(localStorage.getItem("bt3.catalogo") || "null"); } catch (e) {}
  const ponVetados = e => {
    const r = S.vetadosDe ? S.vetadosDe(catalogo, e && e.veto) : { ids: [], lista: [] };
    const v = [];
    for (const id of r.ids) v[id] = 1;
    Module.vetados = v;
    reglaVetos = (e && e.veto) || "";
    listaVetos = r.lista;
    pintaVetos();
  };
  Module.onCatalogo = lista => {
    catalogo = lista;
    try { localStorage.setItem("bt3.catalogo", JSON.stringify(lista)); } catch (e) {}
    ponVetados(est);
    window.parent.postMessage({ canal: "bt3-hijo", tipo: "catalogo", lista }, location.origin);   // (la sala muestra la misma lista)
  };
  S.alEstado(e => {
    est = e;
    ponVetados(e);
    if (e.mirando) {   // un mirón no carga nada: la pelea se ve en la pantalla de cada jugador
      $("start") && $("start").remove();
      aviso("Estás mirando esta sala. La pelea se juega en las pantallas de los dos jugadores.");
      return;
    }
    if (e.fase === "jugando" && cuandoEmpiece && e.rival) { const f = cuandoEmpiece; cuandoEmpiece = null; f(e); }
  });
  S.avisa("listo");

  window.Sala = {
    // El entorno de la sesión: lo mismo que el fork pone para una pelea en línea (gs/net.c, BT3_NET_*).
    entorno: () => ({ BT3_NOMOVIE: "1" }),
    async antesDeEmpezar() {
      S.avisa("disco");   // la ISO ya pasó la prueba: la sala lo anota
      // mientras se espera la pelea, el arranque ya va a la memoria del juego (disco privado)
      const listoArranque = desdePrivado ? (grabaArchivos(), precopia()) : Promise.resolve();
      aviso(est && est.torneo ? "Disco listo. Esperando tu pelea del torneo…" : "Disco listo. Esperando a que el anfitrión empiece la pelea…", 0, true);
      const e = est && est.fase === "jugando" && est.rival ? est : await new Promise(ok => { cuandoEmpiece = ok; });
      ronda = e.ronda;
      const equipo = (e.reglas >> 12 & 15) || 0;   // 3 = el Team 3 vs 3 (motor.js, reglasBt3)
      if (e.rival.cpu) {
        /* Una pelea del torneo contra la CPU: se juega aquí solo, sin red. El juego entra al versus 1P vs COM con
           las reglas de la sala, la CPU con su nivel y su luchador (o equipo) al azar (BT3_WEB_*, parche.diff). */
        Module.entornoPendiente = Object.entries(Object.assign({
          BT3_WEB_MODO: "cpu", BT3_WEB_REGLAS: String(e.reglas), BT3_WEB_CPU: String(e.rival.nivel ?? 2), BT3_WEB_AZAR: "1", BT3_NOMOVIE: "1"
        }, equipo ? { BT3_WEB_EQUIPO: String(equipo) } : {}));
        if (e.emite) S.emite(Module.canvas);   // los demás de la sala pueden mirarla en vivo
        await listoArranque;
        aviso("Tu pelea contra " + e.rival.nombre + " (" + ["muy fácil", "fácil", "normal", "difícil", "muy difícil"][e.rival.nivel ?? 2] + "): elige tu luchador.", 6000);
        return;
      }
      aviso("Conectando con " + e.rival.nombre + "…", 0, true);
      const ok = await S.conecta(e.yo, e.rival.uid);
      if (!ok) {
        aviso("No se pudo conectar con " + e.rival.nombre + ": sus redes no dejan una conexión directa. " +
          "Prueben otra red (los datos del celular a veces la bloquean). Vuelvan al vestíbulo e intenten de nuevo.");
        S.avisa("termino", { por: "sin-conexion" });
        return new Promise(() => {});   // el programa no arranca; la sala recarga este marco al volver
      }
      // Los paquetes del juego, por la malla del marco (gs/net.c: Module.netSend / netRecv, como UDP).
      Module.netSend = bytes => S.envia(bytes);
      Module.netRecv = () => S.recibe();
      Module.netHas = () => S.hay();
      /* Las variables de la sesión. No sirve tocar ENV a esta altura (el runtime ya lo copió al cargar): las
         pone el programa mismo con setenv al empezar el juego (__wrap_Game_Main, parche.diff). */
      Module.entornoPendiente = Object.entries(Object.assign({
        BT3_NET_SESSION: "1", BT3_NET_NAME: e.nombre.slice(0, 16), BT3_NET_DELAY: "auto", BT3_NOMOVIE: "1", BT3_SOUND_TICKS: "1",
        BT3_SAVES: "/net_session", BT3_UNLOCK_ALL: "0",   // la sesión desbloquea todo sola, igual en los dos lados
      }, e.rol === "host" ? { BT3_NET_HOST: "1", BT3_NET_RULES: String(e.reglas) } : { BT3_NET_JOIN: "127.0.0.1:1" },
      equipo ? { BT3_WEB_EQUIPO: String(equipo) } : {}));   // (el tope de equipo no viaja en la sesión: lo ponen los dos)
      try { FS.mkdir("/net_session"); } catch (err) {}
      if (e.emite) S.emite(Module.canvas);   // los demás de la sala pueden mirarla en vivo (bt3-directo.js)
      await listoArranque;
      aviso("Preparando la pelea contra " + e.rival.nombre + "…", 6000, true);
    },
  };

  /* El fin de cada pelea (__wrap_BattleResult_Finish en el programa): quién ganó, para la sala. Los dos marcos
     cuentan lo mismo porque calculan la misma pelea; la sala lo anota cuando coinciden (marcador del duelo, o
     el ganador de una pelea del torneo). `b` es cuál pelea de esta sesión (el versus sigue pelea tras pelea). */
  let batallas = 0;
  Module.onFinBatalla = bits => {
    Module.keep("pelea terminada: " + (bits & 4 ? "empate" : bits & 1 ? "ganó el jugador 1" : bits & 2 ? "ganó el jugador 2" : "sin ganador") + " (" + bits + ")");
    S.avisa("resultado", { bits, b: batallas++ });
  };

  // Salió de la pelea contra la CPU al menú del juego (parche: headless.c): la sala corta la pelea y lo devuelve.
  Module.onFueraDelModo = () => { aviso("Saliste de la pelea: vuelves a la sala."); S.avisa("termino", { por: "menu" }); };

  /* Lo que dice el programa de la sesión (gs/net.c). Si el rival deja de contestar en plena pelea, el juego se
     detiene a esperarlo hasta 25 s (parche: una red de casa a veces se corta unos segundos) y aquí se ve la cuenta;
     si vuelve, sigue la pelea donde iba. Si no, la pelea se corta («corte») y la sala la vuelve a empezar sola
     cuando estén los dos (motor.js, `reanudar`): una copia del juego que se recargó no puede volver a una pelea a
     la mitad (cada una arranca de cero). */
  let cuenta = 0, cortada = false;
  Module.onNetEvent = (que, txt) => {
    Module.keep("red: " + que + " " + txt);
    if (que === "arrived") aviso("");
    else if (que === "espera") {
      const hasta = Date.now() + (Number(txt) || 25) * 1000, quien = (est && est.rival && est.rival.nombre) || "tu rival";
      clearInterval(cuenta);
      const pinta = () => {
        const s = Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
        aviso("⚡ Se cortó la conexión con " + quien + ". La pelea está en pausa: esperándolo " + s + " s… (si no vuelve, la pelea empieza de nuevo cuando estén los dos)", 0, true);
      };
      pinta();
      cuenta = setInterval(pinta, 500);
    } else if (que === "sigue") {
      clearInterval(cuenta);
      aviso("¡Volvió la conexión! La pelea sigue.", 2500);
    } else if (que === "ended") {
      clearInterval(cuenta);
      cortada = !/different version/i.test(txt || "");
      aviso(txt ? "La pelea se cortó: " + (/lost|did not answer|left/i.test(txt) ? "se perdió la conexión con tu rival" : txt) + ". Vuelve a empezar sola cuando estén los dos." : "La pelea terminó.");
    } else if (que === "leave") {
      clearInterval(cuenta);
      S.cierra();
      S.avisa("termino", { por: cortada ? "corte" : (txt || "") });
    }
  };
  addEventListener("pagehide", () => S.cierra());
})();
