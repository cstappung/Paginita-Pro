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
   @controles: tactil teclado */
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

  // ---------------------------------------------------------------- 0b. la imagen para los que miran
  /* El que transmite la pelea (bt3-directo.js) copia cada cuadro del lienzo del juego. WebGL, por omisión, puede
     borrar el lienzo apenas el navegador lo muestra (preserveDrawingBuffer: false), y la copia salía NEGRA con la
     pestaña al frente (en segundo plano no se muestra nada y no se borra: ahí sí se veía). Así que el marco que va a
     transmitir (la sala lo dice antes de arrancar el programa: Module.conservaCuadro) crea su contexto conservando el
     último cuadro. Solo ese: conservarlo cuesta una copia por cuadro, y los demás no la necesitan. */
  (() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, opciones) {
      if (this === Module.canvas && Module.conservaCuadro && /^(webgl2?|experimental-webgl)$/.test(tipo))
        opciones = Object.assign({}, opciones, { preserveDrawingBuffer: true });
      return original.call(this, tipo, opciones);
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
     la copia en memoria). Si algo falla, se carga como siempre.
     Nada se baja antes de jugar: en «un jugador» se pide recién cuando arranca el juego (`go` en la página del
     port llama a `pidePrograma`: «Jugar», o elegir la ISO); en una sala, al abrirla, que ya es jugar. Se pide
     una sola vez (la promesa queda guardada). */
  let programa = null;
  const pidePrograma = window.pidePrograma = () => programa || (programa = (async () => {
    if (!window.cargaPrograma) return;   // (sin JSPI, como en el iPhone: aquí el juego no corre, no se baja nada)
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
  })());
  if (!SOLO) pidePrograma();

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
    const todos = [...new Set([...(Array.isArray(lista) ? lista : []), ...(Array.isArray(local.piezas) ? local.piezas : [])])].slice(0, 300);   // (300 MB como mucho)
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
    const piezas = [...Arranque.piezas].sort((a, b) => a - b).slice(0, 300), archivos = [...Arranque.archivos].slice(0, 3000);
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
  const Esencial = { disco: null, piezas: null, corriendo: false, pausa: false };
  // (solo ofrece el botón: cuánto es se calcula al apretarlo, porque para saberlo hay que leer las tablas del disco)
  function preparaEsencial(disco) {
    Esencial.disco = disco;
    pintaEsencial();
  }
  function pintaEsencial() {
    const ps = Esencial.piezas;
    if (!Esencial.disco || (ps && !ps.length)) return;
    const faltan = ps ? ps.filter(i => !P.guardadas.has(i)).length : 1, tot = ps ? ps.length : 1;
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
    const txt = !ps ? (Esencial.corriendo ? "⬇ Calculando lo esencial…" : "⬇ Bajar lo esencial (menús, escenarios y luchadores)")
      : Esencial.corriendo
      ? (Esencial.pausa ? "⏸ Lo esencial, en pausa · " : "⬇ Bajando lo esencial · ") + Math.round((tot - faltan) / tot * 100) + "% (" + (tot - faltan) + " de " + tot + " MB)"
      : "⬇ Bajar lo esencial · " + faltan + " MB" + (faltan < tot ? " (" + Math.round((tot - faltan) / tot * 100) + "% ya guardado)" : "");
    if (boton) { boton.textContent = txt; boton.title = "Menús, escenarios y los luchadores en su forma base: para no esperar después. Se puede jugar mientras baja."; }
    if (ps) Bajando.pon("esencial", txt, (tot - faltan) / tot, alternaEsencial);
  }
  async function alternaEsencial() {
    if (Esencial.corriendo) { Esencial.pausa = !Esencial.pausa; pintaEsencial(); return; }
    Esencial.corriendo = true;
    pintaEsencial();
    if (!Esencial.piezas) {
      try { Esencial.piezas = piezasDe(idsEsenciales(), await leeIndice(Esencial.disco)); }
      catch (e) { Esencial.corriendo = false; pintaEsencial(); return; }
    }
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
    /* Suelta (sin Juegos alrededor: un enlace viejo, un favorito) no hay sesión, y sin sesión no hay disco privado:
       se abre dentro de Juegos (#solo/bt3, bt3.js crearBt3Solo), que se la da. ?suelta=1 la deja suelta (pruebas). */
    if (SOLO && window.parent === window && !Q.get("suelta")) { location.replace("../../juegos.html#solo/bt3"); return true; }
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
    /* Nada se baja antes de jugar: en «un jugador», el arranque empieza con «Jugar» (en paralelo, mientras el
       programa arranca), y lo esencial solo si el jugador aprieta su botón. En una sala ya se está jugando: el
       arranque se baja al entrar, mientras se espera la pelea; lo esencial no se ofrece ahí (una bajada grande
       en plena pelea en línea le quitaría red a la conexión con el rival). */
    if (SOLO) {
      preparaEsencial(disco);   // (solo calcula cuánto es y ofrece el botón: no baja nada)
      listoParaJugar(() => { prebajaArranque(); go(disco); }, P.primeraVez ? "Disco privado listo. La primera vez tarda un poco más: lo que se baja queda guardado." : "Disco privado listo.");
      return true;   // espera el «Jugar» (2b)
    }
    prebajaArranque();
    say("Usando el disco privado…");
    go(disco);
    return true;
  }
  // Primero el disco privado; si no hay, la ISO recordada; si tampoco, el jugador elige.
  discoPrivado().then(ok => { if (!ok) recordada(); }, () => recordada());

  // ---------------------------------------------------------------- 2. la barra
  /* Con el juego andando, la barra de arriba (volumen, Ajustes, el mando, «← Modos» / «← Sala», «◀ Atrás») tapaba
     el juego: ahí va la vida del jugador 2. Se oculta sola (CSS: body.started sin .barra-viva) y vuelve al mover el
     mouse, 2,5 s, o mientras el mouse está encima o tiene el foco; al empezar se ve unos segundos para que se sepa. */
  let relojBarra = 0, sobreBarra = false;
  const vivaBarra = (ms = 2500) => {
    document.body.classList.add("barra-viva");
    clearTimeout(relojBarra);
    relojBarra = setTimeout(() => { if (!sobreBarra && !$("barra").contains(document.activeElement)) document.body.classList.remove("barra-viva"); }, ms);
  };
  addEventListener("pointermove", e => { if (e.pointerType === "mouse") vivaBarra(); }, { passive: true });
  $("barra").addEventListener("pointerenter", () => { sobreBarra = true; vivaBarra(); });
  $("barra").addEventListener("pointerleave", () => { sobreBarra = false; vivaBarra(); });
  $("barra").addEventListener("focusin", () => vivaBarra(6000));
  const alEmpezar = setInterval(() => { if (document.body.classList.contains("started")) { clearInterval(alEmpezar); vivaBarra(4000); } }, 300);
  try { localStorage.removeItem("bt3.hud"); } catch (e) {}   // (el contador de las pruebas ya no existe: ?hud=1 del fork sigue)

  /* ---------------------------------------------------------------- 2a. el autoajuste (como en los juegos de celular)
     Los cuadros por segundo NO los toca: son los que eligió el jugador (30 por omisión, como la consola; 60 o más con el
     «Smooth motion» de Ajustes, que dibuja imágenes intermedias: la pelea se calcula a 30 igual, así que en línea da lo
     mismo que el otro tenga más). Lo que baja es lo que cuesta cada cuadro: si el juego no llega a su meta (30, o 60
     con el movimiento suave; un 7% menos) durante 3 s seguidos, un escalón menos (sin desenfoque lejano → sin brillo → menos resolución interna → sin neblina
     → sin contorno); si sobra durante 15 s, uno más, hasta lo que el jugador eligió en Ajustes (F1). Si al subir
     vuelve a no llegar, la próxima subida espera el doble (no queda subiendo y bajando). No se guarda: los Ajustes del
     jugador quedan como estaban. No cuenta los segundos en que el juego espera el disco (una carga no es falta de
     máquina). Module._Web_Calidad / _Web_EscalaElegida / _Web_FxElegidos: parche, gs_draw.c. */
  (() => {
    let niveles = null, nivel = 0, malos = 0, buenos = 0, calma = 0, paciencia = 15, subioEn = -1e9, visto = 0;
    /* Solo en la pelea, y no en sus primeros 6 s ni mientras el juego lee el disco: en la selección de personajes y
       de escenario el juego carga modelos y vistas previas, los cuadros bajan un momento, y el autoajuste lo tomaba
       por falta de máquina; cambiaba la resolución (el juego rehace sus imágenes de trabajo: un tirón) y después la
       volvía a subir (otro). Toda lectura del disco cuenta (también la ISO del jugador, no solo el disco privado). */
    let enPeleaDesde = 0, ultimaLectura = -1e9;
    const mideDisco = () => {
      const d = Module.webDisc;
      if (!d || d.__mide) return;
      const leer = d.readAt;
      d.readAt = (o, n) => { ultimaLectura = performance.now(); return leer.call(d, o, n); };
      d.__mide = true;
    };
    const arma = () => {
      const s0 = Module._Web_EscalaElegida(), f0 = Module._Web_FxElegidos();
      const l = [[s0, f0], [s0, f0 | 16], [s0, f0 | 24], [Math.max(1, s0 - 1), f0 | 24], [1, f0 | 28], [1, f0 | 29]];
      niveles = l.filter((x, i) => !i || x[0] !== l[i - 1][0] || x[1] !== l[i - 1][1]);
    };
    const pon = (n, por) => {
      nivel = n; malos = buenos = 0; calma = 4;
      const [s, f] = niveles[n];
      try { Module._Web_Calidad(s, f); } catch (e) { return; }
      Module.keep && Module.keep(`autoajuste: nivel ${n} (escala ${s}, efectos apagados ${f}) por ${por}`);
    };
    setInterval(() => {
      const s = Module.webStats;
      if (!s || s.at === visto || !Module._Web_Calidad || !document.body.classList.contains("started") || document.hidden) return;
      visto = s.at;
      mideDisco();
      const ahora = performance.now();
      if (document.body.classList.contains("en-menus")) { enPeleaDesde = 0; malos = buenos = 0; return; }   // (menús: nada)
      if (!enPeleaDesde) enPeleaDesde = ahora;
      if (ahora - enPeleaDesde < 6000 || ahora - ultimaLectura < 1500) { malos = buenos = 0; return; }   // (cargando)
      if (!niveles) { try { arma(); } catch (e) { return; } }
      if (calma > 0) { calma--; return; }   // (recién cambiado: que se note antes de medir)
      if (Red.esperando > 0 || Progreso.lectura) { malos = buenos = 0; return; }   // (esperando el disco: no es la máquina)
      // la meta: 30, o 60 con el movimiento suave (con 120 o 240 igual 60: más que eso, casi ninguna pantalla lo muestra)
      const meta = Math.min(60, 30 * Math.pow(2, Module._Web_Suave ? Module._Web_Suave() : 0));
      if (s.fps < meta * 0.93) {
        buenos = 0;
        if (++malos >= 3 && nivel < niveles.length - 1) {
          if (performance.now() - subioEn < 20000) paciencia = Math.min(240, paciencia * 2);   // (subió y no aguantó)
          pon(nivel + 1, Math.round(s.fps) + " fps");
        }
      } else {
        malos = 0;
        if (s.fps >= meta * 0.983 && s.busy < 0.75 && ++buenos >= paciencia && nivel > 0) { subioEn = performance.now(); pon(nivel - 1, "margen"); }
      }
    }, 250);
  })();
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
    mando.textContent = on.length ? "🎮 " + on.map(g => g.id.replace(/\s*\(.*$/, "")).join(", ") : "🎮 aprieta un botón";
    mando.title = on.length ? on.map(g => g.id).join("\n") : "Ningún mando todavía: aprieta un botón del mando";
    mando.className = on.length ? "ok" : "";
    return true;
  };
  if (mandos()) setInterval(mandos, 1000);
  /* Juegos (la página de arriba) carga juegos/audio/mando.js: sin juego que lo configure, el mando maneja ahí un
     cursor (el círculo blanco) y su A hace clic donde esté, encima de la pelea. Aquí mando.js no se carga (el
     juego lee el mando solo, ver CLAUDE.md), así que avisamos nosotros lo que su copia avisaría: «este marco es
     un hijo con mando». Mientras el marco se ve, arriba se apartan (sin cursor ni clics); al esconderlo vuelven. */
  const avisaHijo = () => {
    try { if (parent !== window && parent.Mando && parent.Mando._hijo) { parent.Mando._hijo(window); return true; } }
    catch (e) {}
    return false;
  };
  if (!avisaHijo()) { let n = 0; const t = setInterval(() => { if (avisaHijo() || ++n > 40) clearInterval(t); }, 250); }
  mando.style.cursor = "pointer";

  /* ---- En el celular (Chrome de Android: los controles táctiles del fork, body.coarse) ----
     Sin mouse, la barra (que vuelve al mover el mouse) quedaba escondida para siempre: sin ← Modos, ni volumen, ni
     Ajustes. Y la pantalla completa se volvía a pedir en cada toque, así que no había cómo salir. Aquí:
     - ☰ (arriba al centro, tenue): muestra la barra unos segundos;
     - ⛶ en la barra: entra o sale de la pantalla completa. Sola se pide UNA vez, al primer toque con el juego andando;
       si el jugador sale (⛶ o el gesto de atrás), no se vuelve a pedir;
     - 🎮 en la barra: el tamaño y la transparencia de los controles táctiles (`--esc` y `--opa` en #pad, ver
       pagina.py; se recuerdan en este celular);
     - si el sonido del juego no está andando (el navegador lo deja mudo hasta un toque que valga), un botón grande
       «🔊 Activar el sonido»: un toque de verdad sobre un botón, que el navegador siempre acepta. */
  if (document.body.classList.contains("coarse")) {
    const andando = () => document.body.classList.contains("started");
    const completa = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const ponCompleta = si => {
      try {
        if (si) { const r = document.documentElement, f = r.requestFullscreen || r.webkitRequestFullscreen; f && Promise.resolve(f.call(r, { navigationUI: "hide" })).catch(() => {}); }
        else { const f = document.exitFullscreen || document.webkitExitFullscreen; f && Promise.resolve(f.call(document)).catch(() => {}); }
      } catch (e) {}
    };
    let yaPidio = false;
    addEventListener("pointerup", () => { if (yaPidio || !andando() || completa()) return; yaPidio = true; ponCompleta(true); }, true);

    const boton = (id, txt, titulo) => { const b = document.createElement("button"); b.id = id; b.type = "button"; b.textContent = txt; b.title = titulo; b.setAttribute("aria-label", titulo); return b; };
    // ☰: la barra a la vista
    const menu = boton("menuTactil", "☰", "Mostrar el menú");
    menu.onclick = () => vivaBarra(6000);
    document.body.append(menu);
    // ⛶ en la barra
    const pc = boton("completa", "⛶", "Pantalla completa");
    const pintaPc = () => { const si = completa(); pc.textContent = si ? "⛶ Salir" : "⛶"; pc.title = si ? "Salir de la pantalla completa" : "Pantalla completa"; };
    pc.onclick = () => { yaPidio = true; ponCompleta(!completa()); vivaBarra(3000); };
    document.addEventListener("fullscreenchange", pintaPc);
    document.addEventListener("webkitfullscreenchange", pintaPc);
    pintaPc();
    $("barra").insertBefore(pc, $("barra").querySelector("[data-volumen]"));

    // 🎮: el tamaño y la transparencia de los controles
    const pad = $("pad");
    const lee = (k, d) => { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : d; } catch (e) { return d; } };
    let esc = lee("bt3.pad.tamano", 100), opa = lee("bt3.pad.opacidad", 100);
    const aplica = () => {
      pad.style.setProperty("--esc", String(esc / 100));
      pad.style.setProperty("--opa", String(opa / 100));
      try { localStorage.setItem("bt3.pad.tamano", String(esc)); localStorage.setItem("bt3.pad.opacidad", String(opa)); } catch (e) {}
      try { if (typeof relayout === "function") relayout(); } catch (e) {}   // (las zonas de toque se miden de nuevo)
    };
    aplica();
    const panel = document.createElement("div");
    panel.id = "ajustePad"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Ajustar los controles táctiles");
    panel.innerHTML = '<b>Controles en pantalla</b>' +
      '<label>Tamaño <input type="range" min="70" max="120" step="5" data-k="esc"><output></output></label>' +
      '<label>Opacidad <input type="range" min="25" max="100" step="5" data-k="opa"><output></output></label>' +
      '<p>En horizontal crecen hasta 110 % (más, la cruceta tocaría el stick). «Hide» los esconde del todo.</p>' +
      '<div><button type="button" data-x="normal">Como venían</button><button type="button" data-x="listo">Listo</button></div>';
    const pintaPanel = () => panel.querySelectorAll("input").forEach(i => { i.value = i.dataset.k === "esc" ? esc : opa; i.nextElementSibling.textContent = i.value + "%"; });
    panel.addEventListener("input", e => { const i = e.target; if (!i.dataset.k) return; if (i.dataset.k === "esc") esc = +i.value; else opa = +i.value; aplica(); pintaPanel(); });
    panel.addEventListener("click", e => {
      const x = e.target.dataset && e.target.dataset.x;
      if (x === "normal") { esc = 100; opa = 100; aplica(); pintaPanel(); }
      if (x === "listo") panel.hidden = true;
    });
    document.body.append(panel);
    const ctl = boton("ajustarPad", "🎮", "Ajustar los controles táctiles (tamaño y opacidad)");
    ctl.onclick = () => { pintaPanel(); panel.hidden = !panel.hidden; if (!panel.hidden && !document.body.classList.contains("touch") && typeof setTouch === "function") setTouch(true); };
    $("barra").insertBefore(ctl, $("barra").querySelector("[data-volumen]"));

    // 🔊: el sonido, si el navegador lo dejó mudo
    const son = boton("activaSonido", "🔊 Activar el sonido", "El navegador dejó el juego sin sonido: tócalo para activarlo");
    son.hidden = true;
    son.onclick = () => { try { if (typeof audioUnlock === "function") audioUnlock(); } catch (e) {} setTimeout(revisaSonido, 400); };
    document.body.append(son);
    function revisaSonido() {
      const ctx = Module.SDL3 && Module.SDL3.audioContext;
      son.hidden = !andando() || !ctx || ctx.state === "running";
    }
    setInterval(revisaSonido, 1000);
  }
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
  /* La dificultad de «Contra la CPU»: los cinco niveles de la regla «CPU» del juego (0..4 = sus niveles internos 0, 6,
     13, 21, 29; los mismos del torneo, motor.js BT3_NIVELES). Entrar directo a la selección de personajes se salta
     el menú de reglas del juego, así que se elige aquí y va como BT3_WEB_CPU (parche: headless.c, la escribe en la
     regla después de cargar la partida guardada). Se recuerda en «bt3.cpuNivel». */
  const NIVELES = ["Muy fácil", "Fácil", "Normal", "Difícil", "Muy difícil"];
  let nivel = 2;
  try { const n = Number(localStorage.getItem("bt3.cpuNivel")); if (Number.isInteger(n) && n >= 0 && n <= 4) nivel = n; } catch (e) {}
  /* La modalidad y el tiempo por round, igual que en una sala (motor.js BT3_BATALLAS / BT3_TIEMPOS): van como la
     palabra de reglas del torneo contra la CPU (BT3_WEB_REGLAS: tipo | DP << 4 | índice del tiempo << 8 | 3 << 12 en
     el 3 vs 3, como reglasBt3) y, en el 3 vs 3, BT3_WEB_EQUIPO=3. Se recuerdan en «bt3.cpuBatalla» / «bt3.cpuTiempo». */
  const BATALLAS = [["single", "Single"], ["team3", "3 vs 3"], ["team", "Team"], ["dp10", "DP 10"], ["dp15", "DP 15"], ["dp20", "DP 20"]];
  const TIEMPOS = [60, 90, 180, 240, 0];   // segundos por round; 0 = sin límite (el orden es el del juego)
  let batalla = "single", tiempo = 240;
  try {
    const b = localStorage.getItem("bt3.cpuBatalla"); if (BATALLAS.some(x => x[0] === b)) batalla = b;
    const s = Number(localStorage.getItem("bt3.cpuTiempo")); if (localStorage.getItem("bt3.cpuTiempo") !== null && TIEMPOS.includes(s)) tiempo = s;
  } catch (e) {}
  const reglasCpu = () => {
    const tipo = batalla === "single" ? 0 : batalla === "team" || batalla === "team3" ? 1 : 2, dp = batalla === "dp15" ? 1 : batalla === "dp20" ? 2 : 0;
    return tipo | dp << 4 | TIEMPOS.indexOf(tiempo) << 8 | (batalla === "team3" ? 3 : 0) << 12;
  };

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
    const nv = lista.querySelector(".nivel-cpu");
    if (nv) {
      nv.hidden = modo !== "cpu";
      nv.querySelectorAll("[data-n]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.n) === nivel)));
      nv.querySelectorAll("[data-b]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.b === batalla)));
      nv.querySelectorAll("[data-t]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.t) === tiempo)));
    }
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
    const nv = document.createElement("div");
    nv.className = "nivel-cpu"; nv.setAttribute("role", "group"); nv.setAttribute("aria-label", "La pelea contra la CPU");
    nv.innerHTML = `<span>Modalidad</span><div>${BATALLAS.map(([k, x]) => `<button type="button" data-b="${k}" aria-pressed="false">${x}</button>`).join("")}</div>
      <span>Tiempo por round</span><div>${TIEMPOS.map(s => `<button type="button" data-t="${s}" aria-pressed="false">${s ? s + " s" : "∞"}</button>`).join("")}</div>
      <span>Dificultad de la CPU</span><div>${NIVELES.map((x, k) => `<button type="button" data-n="${k}" aria-pressed="false">${x}</button>`).join("")}</div>`;
    const guardaCpu = () => { try { localStorage.setItem("bt3.cpuNivel", String(nivel)); localStorage.setItem("bt3.cpuBatalla", batalla); localStorage.setItem("bt3.cpuTiempo", String(tiempo)); } catch (e) {} pintaModo(); };
    nv.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { nivel = Number(b.dataset.n); guardaCpu(); });
    nv.querySelectorAll("[data-b]").forEach(b => b.onclick = () => { batalla = b.dataset.b; guardaCpu(); });
    nv.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tiempo = Number(b.dataset.t); guardaCpu(); });
    lista.append(nv);
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
    Module.entornoPendiente = deSala(modo) ? [] : [["BT3_SEED", semillaLocal()], ["BT3_WEB_MODO", modo], ...(modo === "cpu"
      ? [["BT3_WEB_CPU", String(nivel)], ["BT3_WEB_REGLAS", String(reglasCpu())], ...(batalla === "team3" ? [["BT3_WEB_EQUIPO", "3"]] : [])] : [])];
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
    /* Con el juego andando, dos clics: el primero pregunta en el botón mismo (confirm() lo bloquea un marco con sandbox,
       como el del banco de pruebas, y el botón parecía muerto); a los 4 s vuelve a ser «← Modos». */
    let seguro = 0;
    b.onclick = () => {
      if (!document.body.classList.contains("started") || seguro) { aModos(false); return; }
      b.textContent = "¿Salir? Lo no guardado se pierde"; b.classList.add("seguro");
      seguro = setTimeout(() => { seguro = 0; b.textContent = "← Modos"; b.classList.remove("seguro"); }, 4000);
    };
    /* Dentro de Juegos (#solo/bt3) el juego ocupa la ventana: «← Juegos», en el menú de modos, vuelve al salón. */
    if (enJuegos) {
      const j = document.createElement("button");
      j.id = "volverJuegos"; j.type = "button"; j.textContent = "← Juegos"; j.title = "Volver a Juegos";
      $("barra").prepend(j);
      j.onclick = () => window.parent.postMessage({ canal: "bt3-hijo", tipo: "volver" }, location.origin);
    }
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

  // ---------------------------------------------------------------- 2d. la música de pelea
  /* Por defecto suena la música del juego (pedido del dueño). Con el ♪ («bt3.musica» = "cancion"), durante las peleas
     suena en su lugar una canción de PRO HERO: «chinchonchin». El parche avisa
     cuándo empieza una pelea y cuándo se sale de ella (Module.onMusicaPelea, plat_mem.c); mientras la canción de aquí
     suena, la música del juego calla (Web_BgmPropia, src/sys/adx.c) y lo demás (golpes, voces, el escenario) sigue.
     - La canción sale de la biblioteca de PRO HERO en Firebase Storage, con su mismo código (juegos/hero/js: la
       sesión de Google es la del sitio) y su misma caché: si ya la jugaste en PRO HERO, no se baja de nuevo. Solo
       se busca al empezar la primera pelea (library.json, ~260 KB, una vez: la canción encontrada se recuerda).
     - Las pistas (stems) suenan juntas en el contexto de audio del juego, hacia su `destination` (0a): pasan por el
       volumen de la página, por el «Music» de Ajustes (Web_MusicaPorcentaje) y les llegan a los que miran.
     - Si no se puede (sin sesión, sin la canción, otro navegador), suena la música del juego, como siempre.
     - Cada uno elige la suya (♪ en la barra, «bt3.musica» = "juego" para la del juego): la pelea es la misma. */
  (() => {
    const CLAVE = "bt3.musica", BUSCA = "chinchonchin", BASE = 0.6;
    const quiere = () => { try { return localStorage.getItem(CLAVE) === "cancion"; } catch (e) { return false; } };   // (por defecto, la del juego: a pedido del dueño)
    const norma = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let pistas = null, fallo = "", enPelea = false, sonando = null, hallada = null;   // fallo: por qué no suena (se ve en el ♪)

    // las pistas de la canción, ya decodificadas (una vez por página)
    async function bajaCancion(ctx) {
      // (el banco de pruebas no tiene la biblioteca: su página da unas pistas de prueba)
      let prueba = null;
      try { prueba = window.parent !== window && window.parent.BT3_MUSICA_PRUEBA; } catch (e) {}
      if (prueba) {
        const r = await prueba(), lista = Array.isArray(r) ? r : r.pistas;
        if (r.nombre) hallada = { nombre: r.nombre, artista: r.artista || "", corto: r.corto || "" };
        return Promise.all(lista.map(b => ctx.decodeAudioData(b)));
      }
      const [{ downloadPath, currentUser }, { SITE }, { cacheGet, cachePut }] = await Promise.all([
        import("../hero/js/cloud.js"), import("../hero/js/site.js"), import("../hero/js/songCache.js")]);
      if (!await currentUser()) throw new Error("sin sesión de Google");
      const busca = async () => {
        const lib = JSON.parse(new TextDecoder().decode(await downloadPath(`${SITE.storageRoot}/library.json`)));
        /* Lo que PRO HERO muestra de cada canción: su título y su artista (meta.name, meta.artist), más su carpeta. Se
           comparan sin mayúsculas, tildes, espacios ni signos: «Chin Chon Chín», «chin-chon-chin» y «ChinChonChin» son
           la misma. Primero por título; si ninguna, por artista o carpeta. */
        const songs = lib.songs || [], tiene = (x, ks) => ks.some(k => norma(k(x)).includes(BUSCA));
        const s = songs.find(x => tiene(x, [y => y.meta?.name])) || songs.find(x => tiene(x, [y => y.meta?.artist, y => y.folder, y => y.id]));
        if (!s) throw new Error("no encontré «" + BUSCA + "» en la biblioteca de PRO HERO (" + songs.length + " canciones)");
        const e = { folder: s.folder, v: s.v || "", audio: Object.values(s.audio || {}).filter(Boolean), nombre: s.meta?.name || "", artista: s.meta?.artist || "" };
        try { localStorage.setItem(CLAVE + ".cancion", JSON.stringify(e)); } catch (x) {}
        return e;
      };
      let e = null;
      try { e = JSON.parse(localStorage.getItem(CLAVE + ".cancion") || "null"); } catch (x) {}
      // cada pista, de la caché de PRO HERO (la misma clave que fetchSongFile en juegos/hero/js/library.js) o de Storage
      const pista = async f => {
        const k = `${e.folder}/${f}?v=${e.v}`;
        let b = await cacheGet(k);
        if (!b) { b = await downloadPath(`${SITE.storageRoot}/${e.folder}/${f}`); await cachePut(k, b, SITE.cacheMB * 1024 * 1024); }
        return ctx.decodeAudioData(b.slice(0));   // (decodificar se queda con el buffer: va una copia)
      };
      if (!e) e = await busca();
      let r;
      try { r = await Promise.all(e.audio.map(pista)); }
      catch (x) { e = await busca(); r = await Promise.all(e.audio.map(pista)); }   // (la recordada cambió de lugar o de versión)
      hallada = e;
      return r;
    }

    const volumen = () => BASE * Math.max(0, Math.min(100, Module._Web_MusicaPorcentaje ? Module._Web_MusicaPorcentaje() : 100)) / 100;
    async function empieza() {
      const ctx = Module.SDL3 && Module.SDL3.audioContext;
      if (!ctx || !quiere() || fallo || sonando) return;
      if (!pistas) pistas = bajaCancion(ctx).catch(e => {
        fallo = String(e.message || e);
        console.warn("[bt3] música de pelea: suena la del juego —", fallo);
        pistas = null; pintaBoton(); return null;
      });
      const bufs = await pistas;
      if (!bufs || !bufs.length || !enPelea || sonando || !quiere()) return;
      const gan = ctx.createGain(), t = ctx.currentTime + 0.05, largo = Math.min(...bufs.map(b => b.duration));
      gan.connect(ctx.destination);
      gan.gain.setValueAtTime(0, t);
      gan.gain.linearRampToValueAtTime(volumen(), t + 1.5);
      // todas las pistas a la vez y en vuelta, cortadas al largo de la más corta para que no se desfasen
      const fuentes = bufs.map(b => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = 0; s.loopEnd = largo; s.connect(gan); s.start(t); return s; });
      const mide = setInterval(() => { if (sonando) gan.gain.setTargetAtTime(volumen(), ctx.currentTime, 0.2); }, 1000);
      sonando = { fuentes, gan, mide };
      Module._Web_BgmPropia && Module._Web_BgmPropia(1);   // la música del juego calla (solo mientras dura la pelea)
      pintaBoton();
    }
    function para() {
      if (!sonando) return;
      const { fuentes, gan, mide } = sonando;
      sonando = null;
      clearInterval(mide);
      try { Module._Web_BgmPropia && Module._Web_BgmPropia(0); } catch (e) {}
      const t = gan.context.currentTime;
      gan.gain.cancelScheduledValues(t); gan.gain.setValueAtTime(gan.gain.value, t); gan.gain.linearRampToValueAtTime(0, t + 1.2);
      setTimeout(() => { for (const s of fuentes) try { s.stop(); } catch (e) {} gan.disconnect(); }, 1400);
      pintaBoton();
    }
    // (se responde fuera de la llamada del juego: no se vuelve a entrar al programa desde su propio aviso)
    Module.onMusicaPelea = on => { enPelea = !!on; setTimeout(() => (enPelea ? empieza() : para()), 0); };

    // ♪ en la barra: la canción o la música del juego (para cada uno; se puede cambiar en plena pelea)
    const boton = document.createElement("button");
    boton.id = "musica"; boton.type = "button";
    const chico = document.body.classList.contains("coarse");
    function pintaBoton() {
      const si = quiere(), cual = hallada && hallada.nombre ? `«${hallada.nombre}»${hallada.artista ? " de " + hallada.artista : ""}` : "«chinchonchin»";
      // (si no se pudo, el botón lo dice: así se sabe por qué suena la del juego)
      boton.textContent = !si ? (chico ? "♪ Juego" : "♪ Música del juego") : fallo ? "♪ ⚠" + (chico ? "" : " Chinchonchin")
        : chico ? "♪" : "♪ " + (hallada && hallada.corto || "Chinchonchin");   // (en el celular, corto: la barra va entre los botones)
      boton.title = !si ? "En las peleas suena la música del juego. Clic: «chinchonchin» (de PRO HERO)"
        : fallo ? `No suena ${cual}: ${fallo}. Suena la música del juego. Clic: elegir la música del juego`
        : `En las peleas suena ${cual}, de PRO HERO. Clic: la música del juego`;
      boton.setAttribute("aria-pressed", String(si));
    }
    boton.onclick = () => {
      try { localStorage.setItem(CLAVE, quiere() ? "juego" : "cancion"); } catch (e) {}
      if (quiere()) { fallo = ""; if (enPelea) empieza(); } else para();
      pintaBoton();
    };
    pintaBoton();
    $("barra").insertBefore(boton, $("barra").querySelector("[data-volumen]"));
  })();

  // ---------------------------------------------------------------- 2e. el azar: semilla nueva y 🎲
  /* La semilla. El port siembra el azar del juego una sola vez, al arrancar, con un número FIJO (0x12345678,
     plat_sys.c: así una corrida se puede repetir), y cada vuelta a los modos arranca el programa de cero: el
     «aleatorio» de la selección (y el luchador al azar de la CPU) repetía siempre los mismos personajes. El parche
     lee BT3_SEED si está (Vu0_Init corre dentro de Game_Main, después de que la página pone el entorno):
     - jugando solo o contra la CPU del torneo: una semilla al azar cada vez (`semillaLocal`);
     - en una pelea en línea las dos copias del juego tienen que sacar LO MISMO (cada una calcula la pelea entera):
       la semilla sale de lo que las dos ven igual: la sala (de la dirección de Juegos, #p/<sala>, que tiene hasta
       una pestaña vieja), los dos jugadores, el número de pelea y las reglas (`semillaSala`). Cambia en cada pelea
       y en cada sala, y no depende de qué versión de Juegos tenga abierta cada uno. */
  const semillaLocal = () => {
    const a = new Uint32Array(1);
    try { crypto.getRandomValues(a); } catch (e) { a[0] = (Math.random() * 4294967296) >>> 0; }
    return String((a[0] & 0x7fffffff) || 1);   // (31 bits: el parche la lee con strtol, y un long de wasm32 es de 32 bits con signo)
  };
  const semillaSala = e => {
    let sala = "";
    try { sala = (String(window.parent.location.hash).match(/#p\/([^/?&]+)/) || [])[1] || ""; } catch (x) {}
    const quienes = [e.yo, e.rival && e.rival.uid].filter(Boolean).sort().join(",");
    const txt = [sala, quienes, e.torneo ? "t" : "d", e.ronda || 0, e.reglas || 0].join("|");
    let h = 0x811c9dc5;   // FNV-1a de 32 bits: el mismo número en los dos navegadores
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return String((h & 0x7fffffff) || 1);
  };
  window.BT3Semilla = { local: semillaLocal, sala: semillaSala };

  /* 🎲 Aleatorio. En la grilla de personajes, R3 (el parche: CharSel_WebRuleta) lleva el cursor a un personaje al
     azar —respetando la regla de la sala— sin elegirlo: se ve quién salió, se confirma con ✕ o se vuelve a tirar.
     Va por el mando, así que en una pelea en línea las dos copias tiran igual. Además del R3 del mando y del de la
     pantalla táctil, una tecla de la página lo aprieta (R por defecto; se cambia con ⌨ en la barra, «bt3.tecla.azar»)
     y el botón 🎲 de la barra, que solo se ve con la selección abierta (Module.onSeleccion). */
  const Seleccion = { abierta: false, oyentes: [] };
  Module.onSeleccion = a => { Seleccion.abierta = !!a; for (const f of Seleccion.oyentes) { try { f(Seleccion.abierta); } catch (e) {} } };
  window.BT3Seleccion = Seleccion;
  const CLAVE_TECLA = "bt3.tecla.azar";
  let tecla = "KeyR";
  try { tecla = localStorage.getItem(CLAVE_TECLA) || tecla; } catch (e) {}
  const nombreTecla = c => String(c).replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ").replace(/^Arrow/, "Flecha ");
  const tira = () => {
    if (!Module._Web_TouchSet || !Seleccion.abierta) return false;
    const T = window.BT3Touch || {}, bits = T.bits || 0, lx = T.lx ?? 128, ly = T.ly ?? 128;
    Module._Web_TouchSet(bits | 0x4, lx, ly);   // PAD_R3 (include/sys/pad.h)
    setTimeout(() => Module._Web_TouchSet(bits, lx, ly), 120);
    return true;
  };
  const dado = document.createElement("button");
  dado.id = "dado"; dado.type = "button"; dado.hidden = true;
  const cambia = document.createElement("button");
  cambia.id = "dadoTecla"; cambia.type = "button"; cambia.hidden = true; cambia.textContent = "⌨";
  cambia.title = "Cambiar la tecla del aleatorio"; cambia.setAttribute("aria-label", cambia.title);
  let esperando = false;
  const pintaDado = () => {
    dado.hidden = cambia.hidden = !Seleccion.abierta;
    dado.textContent = esperando ? "Aprieta una tecla… (Esc cancela)" : "🎲 " + nombreTecla(tecla);
    dado.title = "Aleatorio: el cursor a un personaje al azar (tecla " + nombreTecla(tecla) + ", o R3 en el mando). Vuelve a tirar o confirma con ✕.";
  };
  dado.onclick = () => { dado.blur(); if (esperando) return; tira(); };
  cambia.onclick = () => { cambia.blur(); esperando = true; pintaDado(); };
  addEventListener("keydown", e => {
    if (esperando) {
      e.preventDefault(); e.stopPropagation();
      if (e.code !== "Escape" && e.code) { tecla = e.code; try { localStorage.setItem(CLAVE_TECLA, tecla); } catch (x) {} }
      esperando = false; pintaDado();
      return;
    }
    if (e.code === tecla && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) tira();
  }, true);
  Seleccion.oyentes.push(() => { if (!Seleccion.abierta) esperando = false; pintaDado(); });
  /* Los atajos, a la vista: la primera vez que se abre la selección en esta página, las tres primeras veces en este
     computador (en el celular no hay teclado: ahí está el ☰). */
  let atajosVistos = false;
  Seleccion.oyentes.push(abierta => {
    if (!abierta || atajosVistos || document.body.classList.contains("coarse")) return;
    atajosVistos = true;
    let n = 0;
    try { n = Number(localStorage.getItem("bt3.atajos")) || 0; } catch (e) {}
    if (n >= 3) return;
    try { localStorage.setItem("bt3.atajos", String(n + 1)); } catch (e) {}
    aviso("Atajos: " + nombreTecla(tecla) + " = 🎲 aleatorio · F1 = Ajustes y controles · I = atrás en los menús", 6000);
  });
  pintaDado();
  $("barra").insertBefore(cambia, $("barra").firstChild);
  $("barra").insertBefore(dado, cambia);

  // ---------------------------------------------------------------- 3. la sala
  const S = window.BT3Sala;
  if (!S || !S.activo) return;

  /* El botón de salida del marco, en dos tiempos según lo que esté pasando:
     - en plena pelea, «← Sala»: corta la pelea (no cuenta) y vuelve al vestíbulo de la sala o a la llave. Lo mismo
       que salir del modo desde el propio juego (Module.onFueraDelModo, más abajo).
     - esperando (el disco ya cargó y el juego espera a que empiece la pelea), «← Salir del duelo / del torneo»: sale
       de la sala, como «← Vestíbulo» de la cabecera (que a pantalla completa no se ve). Antes aquí también mandaba
       «termino», que fuera de una pelea la sala ignora: el segundo clic no hacía nada.
     `enPeleaSala` lo pone `antesDeEmpezar` cuando empieza la pelea (el marco se recarga después de cada una). */
  let est = null, cuandoEmpiece = null, ronda = 0;
  let enPeleaSala = false;
  const aSala = document.createElement("button");
  aSala.id = "volverSala"; aSala.type = "button";
  const textoSala = () => enPeleaSala ? "← Sala" : est && est.torneo ? "← Salir del torneo" : "← Salir del duelo";
  const pintaSala = () => {
    if (seguroSala) return;   // (a mitad de confirmar: no se le cambia el texto)
    aSala.textContent = textoSala();
    aSala.title = enPeleaSala ? "Volver a la sala (esta pelea se corta)" : "Salir de la sala y volver a Juegos";
  };
  $("barra").prepend(aSala);
  let seguroSala = 0;   // (dos clics, como «← Modos»: confirm() no sirve en un marco con sandbox)
  pintaSala();
  aSala.onclick = () => {
    if (!seguroSala) {
      aSala.textContent = enPeleaSala ? "¿Salir? La pelea se corta" : "¿Salir de la sala?"; aSala.classList.add("seguro");
      seguroSala = setTimeout(() => { seguroSala = 0; aSala.classList.remove("seguro"); pintaSala(); }, 4000);
      return;
    }
    clearTimeout(seguroSala); seguroSala = 0; aSala.classList.remove("seguro"); pintaSala();
    if (!enPeleaSala) { aviso("Saliendo de la sala…"); S.cierra(); S.avisa("salir"); return; }
    aviso("Volviendo a la sala…");
    S.cierra();
    S.avisa("termino", { por: "menu" });
  };

  /* Los vetados, a la vista: mientras está abierta la selección de personajes (el parche avisa con
     Module.onSeleccion), un panel al costado dice qué se puede elegir según la regla de la sala, con el nombre que
     tienen en el juego: la lista más corta de las dos (con «No OP» los vetados; con «Sólo malos» o «Sólo gigantes»,
     los permitidos). Se pliega con un clic (se recuerda) y nunca está en la pelea. En la selección
     misma, los vetados salen con el candado de los personajes sin desbloquear (parche: ChrGrid_Build). */
  const panel = document.createElement("aside");
  panel.id = "vetos"; panel.hidden = true; panel.setAttribute("aria-label", "Personajes vetados");
  document.body.append(panel);
  let plegado = false, enSeleccion = false, listaVetos = [], listaSi = [], reglaVetos = "";
  const NOMBRE_REGLA = { noop: "No OP", malos: "Sólo malos", gigantes: "Sólo gigantes" };
  try { plegado = localStorage.getItem("bt3.vetosPlegado") === "1"; } catch (e) {}
  const pintaVetos = () => {
    panel.hidden = !(enSeleccion && listaVetos.length);
    if (panel.hidden) return;
    panel.classList.toggle("plegado", plegado);
    panel.replaceChildren();
    const tit = document.createElement("button");
    tit.type = "button"; tit.className = "tit"; tit.setAttribute("aria-expanded", String(!plegado));
    const muestraSi = listaSi.length && listaSi.length < listaVetos.length, lista = muestraSi ? listaSi : listaVetos;
    tit.innerHTML = `<span>${muestraSi ? "✅ Permitidos" : "🚫 Vetados"} · ${NOMBRE_REGLA[reglaVetos] || ""}</span><b></b><i>${plegado ? "▸" : "▾"}</i>`;
    tit.querySelector("b").textContent = lista.length;
    tit.onclick = () => { plegado = !plegado; try { localStorage.setItem("bt3.vetosPlegado", plegado ? "1" : "0"); } catch (e) {} pintaVetos(); };
    panel.append(tit);
    if (plegado) return;
    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo";
    const nota = document.createElement("p");
    nota.textContent = muestraSi ? "Solo estos se pueden elegir: los demás salen con candado, y tampoco se puede transformar o fusionar en ellos."
      : "En la selección salen con candado, como los que no están desbloqueados, y tampoco se puede transformar o fusionar en ellos.";
    cuerpo.append(nota);
    const tiers = [...new Set(lista.map(x => x[0]))];
    for (const t of tiers) {
      const g = document.createElement("section");
      const h = document.createElement("h3"); h.textContent = t === "?" ? "Sin tier en la lista" : t; g.append(h);
      const ul = document.createElement("ul"); ul.translate = false;
      for (const [, n] of lista.filter(x => x[0] === t)) { const li = document.createElement("li"); li.textContent = n; ul.append(li); }
      g.append(ul); cuerpo.append(g);
    }
    panel.append(cuerpo);
  };
  Seleccion.oyentes.push(abierta => { enSeleccion = !!abierta; pintaVetos(); });   // (Module.onSeleccion: 2e)
  /* (Aquí el banco de pruebas bajaba la memoria para archivos del disco a 192 MB, de cuando corría dos juegos en una
     pestaña. Con uno por pestaña sobraba el recorte y faltaba memoria: en plena pelea, al cargar algo nuevo, el juego
     botaba archivos que todavía usaba y los volvía a leer del disco en cada cuadro: 2 fps, 99% ocupado sin dibujar.
     Ahora el banco usa los 768 MB del sitio.) */

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
    const r = S.vetadosDe ? S.vetadosDe(catalogo, e && e.veto) : { ids: [], lista: [], permitidos: [] };
    const v = [];
    for (const id of r.ids) v[id] = 1;
    Module.vetados = v;
    reglaVetos = (e && e.veto) || "";
    listaVetos = r.lista; listaSi = r.permitidos || [];
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
    pintaSala();
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
      enPeleaSala = true; pintaSala();   // (desde aquí «← Sala» corta la pelea)
      const equipo = (e.reglas >> 12 & 15) || 0;   // 3 = el Team 3 vs 3 (motor.js, reglasBt3)
      if (e.rival.cpu) {
        /* Una pelea del torneo contra la CPU: se juega aquí solo, sin red. El juego entra al versus 1P vs COM con
           las reglas de la sala, la CPU con su nivel y su luchador (o equipo) al azar (BT3_WEB_*, parche.diff). */
        Module.entornoPendiente = Object.entries(Object.assign({
          BT3_SEED: semillaLocal(),   // (contra la CPU se juega aquí solo: azar de verdad, 2e)
          BT3_WEB_MODO: "cpu", BT3_WEB_REGLAS: String(e.reglas), BT3_WEB_CPU: String(e.rival.nivel ?? 2), BT3_WEB_AZAR: "1", BT3_NOMOVIE: "1"
        }, equipo ? { BT3_WEB_EQUIPO: String(equipo) } : {}));
        if (e.emite) { Module.conservaCuadro = true; S.emite(Module.canvas); }   // los demás de la sala pueden mirarla en vivo
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
        BT3_SEED: semillaSala(e),   // (la misma en las dos copias: 2e)
        BT3_NET_SESSION: "1", BT3_NET_NAME: e.nombre.slice(0, 16), BT3_NET_DELAY: "auto", BT3_NOMOVIE: "1", BT3_SOUND_TICKS: "1",
        BT3_SAVES: "/net_session", BT3_UNLOCK_ALL: "0",   // la sesión desbloquea todo sola, igual en los dos lados
      }, e.rol === "host" ? { BT3_NET_HOST: "1", BT3_NET_RULES: String(e.reglas) } : { BT3_NET_JOIN: "127.0.0.1:1" },
      equipo ? { BT3_WEB_EQUIPO: String(equipo) } : {}));   // (el tope de equipo no viaja en la sesión: lo ponen los dos)
      try { FS.mkdir("/net_session"); } catch (err) {}
      if (e.emite) { Module.conservaCuadro = true; S.emite(Module.canvas); }   // los demás de la sala pueden mirarla en vivo (bt3-directo.js; 0b)
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

  // Se terminó de mostrar el final (K.O., pose y frase del ganador; parche: btl_seq.c → Web_MenuFin): la sala recién ahí
  // recarga este marco, para que la celebración se vea entera (el resultado ya se anotó en el K.O.).
  Module.onMenuFin = () => S.avisa("menufin");

  // Salió de la pelea contra la CPU al menú del juego (parche: headless.c): la sala corta la pelea y lo devuelve.
  Module.onFueraDelModo = () => { aviso("Saliste de la pelea: vuelves a la sala."); S.avisa("termino", { por: "menu" }); };

  /* Lo que dice el programa de la sesión (gs/net.c). Si el rival deja de contestar en plena pelea, el juego se
     detiene a esperarlo hasta 25 s (parche: una red de casa a veces se corta unos segundos) y aquí se ve la cuenta;
     si vuelve, sigue la pelea donde iba. Si no, la pelea se corta («corte») y la sala la vuelve a empezar sola
     cuando estén los dos (motor.js, `reanudar`): una copia del juego que se recargó no puede volver a una pelea a
     la mitad (cada una arranca de cero). */
  let cuenta = 0, cortada = false;
  /* Un pitido corto por cada segundo de la cuenta (más agudo los últimos cinco): una pausa por corte se nota aunque
     no se esté mirando la pantalla. Va por el contexto de audio del juego, así que lo gobierna el volumen de la página. */
  function pitido(hz) {
    try {
      const ctx = Module.SDL3 && Module.SDL3.audioContext;
      if (!ctx || ctx.state !== "running") return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = "sine"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.14);
    } catch (e) {}
  }
  window.BT3Pitido = pitido;   // (el banco lo prueba)
  Module.onNetEvent = (que, txt) => {
    Module.keep("red: " + que + " " + txt);
    if (que === "arrived") aviso("");
    else if (que === "espera") {
      const hasta = Date.now() + (Number(txt) || 25) * 1000, quien = (est && est.rival && est.rival.nombre) || "tu rival";
      clearInterval(cuenta);
      let ultimo = -1;
      const pinta = () => {
        const s = Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
        aviso("⚡ Se cortó la conexión con " + quien + ". La pelea está en pausa: esperándolo " + s + " s… (si no vuelve, la pelea empieza de nuevo cuando estén los dos)", 0, true);
        if (s !== ultimo) { ultimo = s; pitido(s <= 5 ? 1320 : 880); }   // (también se oye: quizás no se mira la pantalla)
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
