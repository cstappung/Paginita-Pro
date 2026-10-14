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
    // Los pedazos de 1 MB, como el disco alojado del fork: los últimos 48 en memoria y, si el juego lee en
    // orden (un escenario, un luchador), los 4 siguientes por adelantado.
    /* Lo ya bajado se guarda en este computador (Cache Storage, «bt3-disco:<tamaño>»): la segunda vez el menú,
       los luchadores y los escenarios que ya usaste salen de aquí, sin red. El juego nunca baja la ISO entera,
       solo los archivos que abre. Se pide el índice al Worker igual cada vez, así que quien sale de la lista
       deja de entrar aunque tenga pedazos guardados. Si el navegador no deja guardar, se sigue sin caché. */
    const almacen = await (async () => { try { return await caches.open("bt3-disco:" + size); } catch (e) { return null; } })();
    try { navigator.storage?.persist?.(); } catch (e) {}   // que el navegador no lo borre al primer apuro de espacio
    const trae = async i => {
      const url = base + "/pieza/" + String(i).padStart(5, "0") + ".bin";
      if (almacen) {
        try { const g = await almacen.match(url); if (g) return new Uint8Array(await g.arrayBuffer()); } catch (e) {}
      }
      for (let intento = 0; ; intento++) {
        const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
        if (res.status === 401 && intento < 2) { token = (await pideToken(true)) || token; continue; }   // el token dura una hora
        if (!res.ok) throw new Error("disco privado: HTTP " + res.status);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (almacen) almacen.put(url, new Response(bytes)).catch(() => {});
        return bytes;
      }
    };
    // al cambiar la ISO subida (otro tamaño), lo guardado de la anterior no sirve: se borra
    try { for (const k of await caches.keys()) if (k.startsWith("bt3-disco:") && k !== "bt3-disco:" + size) caches.delete(k); } catch (e) {}
    const guardados = new Map(), cuantas = Math.ceil(size / pieza);
    const pedazo = i => {
      let q = guardados.get(i);
      if (q) { guardados.delete(i); guardados.set(i, q); return q; }
      q = netRead(() => trae(i));                    // (reintentos y el aviso «Cargando» de la página)
      q.catch(() => guardados.delete(i));
      guardados.set(i, q);
      while (guardados.size > 48) guardados.delete(guardados.keys().next().value);
      return q;
    };
    let ultimo = -10, racha = 0;
    desdePrivado = true;
    const disco = { size, readAt: async (o, n) => {
      const out = new Uint8Array(n);
      if (n === 0) return out;
      // una lectura de 2 MB o más (un escenario, un luchador, una película): la insignia con su barra, si tarda
      const grande = n >= 2 * 1048576, estado = { hechos: 0, total: n };
      let reloj = 0;
      if (grande) reloj = setTimeout(() => { Progreso.lectura = estado; Progreso.insignia("Cargando del disco privado… " + MB(estado.hechos) + " de " + MB(n) + " MB", estado.hechos / n); }, 400);
      const a = Math.floor(o / pieza), z = Math.floor((o + n - 1) / pieza);
      racha = a >= ultimo && a <= ultimo + 2 ? racha + 1 : 0;
      ultimo = z;
      if (racha >= 2) for (let i = z + 1; i <= Math.min(cuantas - 1, z + 4); i++) if (!guardados.has(i)) pedazo(i).catch(() => {});
      for (let s = a; s <= z; s += 6) {
        const ids = [];
        for (let i = s; i <= Math.min(z, s + 5); i++) ids.push(i);
        const partes = await Promise.all(ids.map(pedazo));
        ids.forEach((i, k) => {
          const desde = Math.max(o, i * pieza), hasta = Math.min(o + n, (i + 1) * pieza);
          out.set(partes[k].subarray(desde - i * pieza, hasta - i * pieza), desde - o);
          estado.hechos += hasta - desde;
        });
        if (Progreso.lectura === estado) Progreso.insignia("Cargando del disco privado… " + MB(estado.hechos) + " de " + MB(n) + " MB", estado.hechos / n);
      }
      if (grande) { clearTimeout(reloj); if (Progreso.lectura === estado) { Progreso.lectura = null; $("net").classList.remove("on"); } }
      return out;
    } };
    $("pickLabel").hidden = true;
    if (SOLO) { listoParaJugar(() => go(disco), "Disco privado listo."); return true; }   // espera el «Jugar» (2b)
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
  function eligeModo() {
    try { localStorage.setItem("bt3.modo", modo); } catch (e) {}
    Module.entornoPendiente = deSala(modo) ? [] : [["BT3_WEB_MODO", modo]];
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

  // ---------------------------------------------------------------- 3. la sala
  const S = window.BT3Sala;
  if (!S || !S.activo) return;
  // La sala de prueba corre dos juegos en la misma pestaña: menos caché del disco por cada uno.
  if (S.prueba) Module.webCacheBudget = 192 * 1024 * 1024;

  let est = null, cuandoEmpiece = null, ronda = 0;
  S.alEstado(e => {
    est = e;
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

  // Lo que dice el programa de la sesión (gs/net.c): al terminar, la sala vuelve al vestíbulo.
  Module.onNetEvent = (que, txt) => {
    Module.keep("red: " + que + " " + txt);
    if (que === "arrived") aviso("");
    else if (que === "ended") aviso(txt || "La pelea terminó.");
    else if (que === "leave") { S.cierra(); S.avisa("termino", { por: txt || "" }); }
  };
  addEventListener("pagehide", () => S.cierra());
})();
