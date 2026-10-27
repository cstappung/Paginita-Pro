/* El visor de Mascotas en la página: three.js no entra en juegos-app.js.
   Todo lo 3D de objetos y mascotas (las miniaturas del mercado y del salón,
   el detalle de una oferta, la mascota del perfil) lo dibuja
   `juegos/mascotas/visor.html`, que carga el mismo paquete del juego (ya en
   caché si se jugó) en un iframe, por postMessage.

   - **Fotos**: un iframe invisible, el fotógrafo, recibe pedidos y devuelve
     una imagen de cada uno. Se guardan en memoria y en localStorage (las
     últimas `MAX_GUARDADAS`, por versión del visor), y el fotógrafo se
     cierra solo tras un rato sin pedidos (libera su WebGL). El iframe es del
     mismo origen, así que **trabaja en el hilo de la página**: cada foto es
     una tarea de 100–700 ms que no se puede partir. Por eso se le piden de a
     una, cuando la página está ociosa y nadie hace scroll desde hace
     `CALMA_MS`; antes iban todas juntas, en sessionStorage (cada pestaña
     nueva las rehacía), y la tira de Mascotas del salón trababa el scroll
     durante un minuto.
   - **En vivo**: un solo iframe a la vez (`montaVisor`): montar otra
     vista apaga la anterior, y cerrarla se la devuelve. Va a 12 fps, se pausa fuera de pantalla o con la
     pestaña oculta, y se libera al cerrarla. Con movimiento reducido la
     dibuja quieta el propio visor. */
const VERSION = "mc-8";
const RUTA = "juegos/mascotas/visor.html?v=" + VERSION;
const CANAL_PADRE = "visor-parent", CANAL_HIJO = "visor-child";
const ESPERA_CIERRE = 20000;
const PREFIJO = "mc.foto." + VERSION + ".", INDICE = "mc.fotos", MAX_GUARDADAS = 48, CALMA_MS = 600;

/* ---------- fotos ---------- */
const fotos = new Map();          // key -> {src, colores}
const avisar = new Map();         // key -> Set(cb)
let fotografo = null, fotografoListo = false, pendientes = [], cierre = 0;
let enCurso = null, turno = 0, ultimoScroll = 0;

const leeGuardada = k => { try { const v = localStorage.getItem(PREFIJO + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
/* Guarda una foto (~25 kB) y lleva la lista en orden de llegada: pasadas
   las `MAX_GUARDADAS`, o si localStorage se llena, se van las más viejas.
   Lo de otra versión del visor (y las fotos de antes, en sessionStorage,
   que mueren con la pestaña) no se vuelve a leer. */
let indice = null;
function guarda(k, v) {
  try {
    if (!indice) {
      try { indice = JSON.parse(localStorage.getItem(INDICE) || "[]"); } catch (e) { indice = []; }
      if (!Array.isArray(indice)) indice = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const c = localStorage.key(i);
        if (c && c.startsWith("mc.foto.") && !c.startsWith(PREFIJO)) localStorage.removeItem(c);
      }
      indice = indice.filter(x => typeof x === "string" && localStorage.getItem(PREFIJO + x) !== null);
    }
    indice = indice.filter(x => x !== k);
    indice.push(k);
    const sobra = n => { for (const x of indice.splice(0, n)) localStorage.removeItem(PREFIJO + x); };
    if (indice.length > MAX_GUARDADAS) sobra(indice.length - MAX_GUARDADAS);
    const txt = JSON.stringify(v);
    try { localStorage.setItem(PREFIJO + k, txt); }
    catch (e) { sobra(Math.ceil((indice.length - 1) / 2)); localStorage.setItem(PREFIJO + k, txt); }
    localStorage.setItem(INDICE, JSON.stringify(indice));
  } catch (e) { /* sin almacenamiento o lleno: queda en memoria */ }
}

/* La foto ya hecha de un pedido, o null. */
export function fotoDe(key) {
  if (fotos.has(key)) return fotos.get(key);
  const s = leeGuardada(key);
  if (s) fotos.set(key, s);
  return s;
}

addEventListener("scroll", () => { ultimoScroll = performance.now(); }, { passive: true, capture: true });
/* La próxima foto: de a una, con la página ociosa y quieta. Abrir el
   fotógrafo también espera: cargar el juego y three.js es lo más pesado. */
function siguiente() {
  if (turno || enCurso || (fotografo && !fotografoListo) || !pendientes.length) return;
  const espera = CALMA_MS - (performance.now() - ultimoScroll);
  const listo = () => {
    turno = 0;
    if (enCurso || !pendientes.length) return;
    if (performance.now() - ultimoScroll < CALMA_MS) { siguiente(); return; }
    if (!fotografo) { abreFotografo(); return; }   // al estar listo vuelve aquí
    if (!fotografoListo) return;
    clearTimeout(cierre);
    cierre = setTimeout(cierraFotografo, ESPERA_CIERRE);
    enCurso = pendientes[0].key;
    mandaA(fotografo, { tipo: "fotos", pedidos: [pendientes[0]] });
  };
  turno = setTimeout(() => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(listo, { timeout: 2000 });
    else listo();
  }, Math.max(0, espera));
}

function mandaA(frame, x) { if (frame && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ canal: CANAL_PADRE }, x), location.origin); }

function abreFotografo() {
  clearTimeout(cierre);
  cierre = setTimeout(cierraFotografo, ESPERA_CIERRE);
  if (fotografo) return;
  fotografoListo = false;
  enCurso = null;
  fotografo = document.createElement("iframe");
  fotografo.title = "Fotos de Mascotas";
  fotografo.setAttribute("aria-hidden", "true");
  fotografo.tabIndex = -1;
  fotografo.style.cssText = "position:fixed;left:0;bottom:0;width:4px;height:4px;opacity:0;pointer-events:none;border:0;z-index:-1";
  fotografo.src = RUTA;
  document.body.appendChild(fotografo);
}
function cierraFotografo() {
  if (pendientes.length) { cierre = setTimeout(cierraFotografo, ESPERA_CIERRE); return; }
  if (fotografo) fotografo.remove();
  fotografo = null; fotografoListo = false; enCurso = null;
}

/* Pide fotos. `cb(key, foto)` se llama con cada una que llegue (las que ya
   estaban, no: esas se leen con `fotoDe`). */
export function pideFotos(pedidos, cb) {
  const nuevos = [];
  for (const p of pedidos) {
    if (!p || !p.key || fotoDe(p.key)) continue;
    if (cb) { if (!avisar.has(p.key)) avisar.set(p.key, new Set()); avisar.get(p.key).add(cb); }
    if (!pendientes.some(x => x.key === p.key)) { pendientes.push(p); nuevos.push(p); }
  }
  if (!nuevos.length) return;
  siguiente();
}

/* ---------- en vivo ----------
   Un solo iframe a la vez, pero varios montajes: la tarjeta abierta sobre
   la página del perfil tapa a la de la página, y al cerrarla esta vuelve.
   `montajes` va del más viejo al más nuevo; solo el último tiene iframe. */
const montajes = [];
let vivo = null;                  // {frame, m, listo}

function apaga() {
  if (!vivo) return;
  vivo.io.disconnect();
  document.removeEventListener("visibilitychange", vivo.pausa);
  vivo.frame.remove();
  vivo = null;
}
function enciende() {
  while (montajes.length && !montajes[montajes.length - 1].host.isConnected) montajes.pop();
  const m = montajes[montajes.length - 1];
  if (!m || (vivo && vivo.m === m)) return;
  apaga();
  const frame = document.createElement("iframe");
  frame.className = "jg-visor";
  frame.title = "Vista 3D";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.src = RUTA;
  m.host.appendChild(frame);
  const v = { frame, m, listo: false, visible: true };
  v.pausa = () => { if (v.listo) mandaA(frame, { tipo: "pausa", on: !v.visible || document.hidden }); };
  v.io = new IntersectionObserver(es => {
    for (const x of es) v.visible = x.isIntersecting;
    if (!m.host.isConnected) { m.cierra(); return; }
    v.pausa();
  });
  v.io.observe(m.host);
  document.addEventListener("visibilitychange", v.pausa);
  vivo = v;
}

/* El montaje más nuevo cierra el iframe de los anteriores (sin olvidarlos). */
export function montaVisor(host, pedido) {
  const m = {
    host, pedido,
    cambia(p) { m.pedido = p; if (vivo && vivo.m === m && vivo.listo) mandaA(vivo.frame, { tipo: "muestra", pedido: p }); },
    cierra() {
      const i = montajes.indexOf(m);
      if (i < 0) return;
      montajes.splice(i, 1);
      host.classList.remove("visor-listo");
      if (vivo && vivo.m === m) { apaga(); enciende(); }
    }
  };
  montajes.push(m);
  if (vivo) vivo.m.host.classList.remove("visor-listo");
  enciende();
  return m;
}
/* Cierra el montaje de arriba (el que se ve). */
export function cierraVisor() { if (montajes.length) montajes[montajes.length - 1].cierra(); }

/* ---------- mensajes ---------- */
window.addEventListener("message", e => {
  const x = e.data;
  if (!x || x.canal !== CANAL_HIJO || e.origin !== location.origin) return;
  if (fotografo && e.source === fotografo.contentWindow) {
    if (x.tipo === "listo") {
      fotografoListo = true;
      siguiente();
    } else if (x.tipo === "foto") {
      const f = { src: x.src || null, colores: Array.isArray(x.colores) ? x.colores : [] };
      fotos.set(x.key, f);
      if (f.src) guarda(x.key, f);
      pendientes = pendientes.filter(p => p.key !== x.key);
      if (enCurso === x.key) enCurso = null;
      siguiente();
      for (const cb of avisar.get(x.key) || []) try { cb(x.key, f); } catch (err) { console.warn("[visor]", err); }
      avisar.delete(x.key);
      clearTimeout(cierre);
      cierre = setTimeout(cierraFotografo, ESPERA_CIERRE);
    }
    return;
  }
  if (vivo && e.source === vivo.frame.contentWindow && x.tipo === "listo") {
    vivo.listo = true;
    mandaA(vivo.frame, { tipo: "muestra", pedido: vivo.m.pedido });
    vivo.pausa();
    vivo.m.host.classList.add("visor-listo");
  }
});
