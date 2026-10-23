/* Fotos de las piezas de Batalla de Rock fuera del juego: el salón (últimos
   drops legendarios) y el mercado.

   Las saca un worker con la escena de rock en modo fotógrafo
   (juegos/hero/rock-trabajador.js, con su propio OffscreenCanvas): la página
   no arma ningún rockero ni espera a la tarjeta gráfica, que es lo que
   trababa todo cuando se hacían aquí. Hasta 2 fotos en camino; las que
   faltan esperan en `cola`, y el worker se apaga solo tras `OCIOSO` sin
   trabajo. Sin WebGL en un worker (Safari < 17) se piden a
   juegos/hero/rock-visor.html en un iframe escondido, que las hace en su
   hilo (más lento, pero solo ahí).

   Quedan en localStorage con la misma clave que usa el editor del juego
   (`claveMini`, mismo origen): una pieza ya fotografiada no se vuelve a
   pedir, aquí ni allá. */
import { claveMini, claveMiniId, limpiaMinisViejas } from "./rock-datos.js";

const V = "hero-19";
const TRABAJADOR = "juegos/hero/rock-trabajador.js?v=" + V;
const VISOR = "juegos/hero/rock-visor.html?v=" + V;
const OCIOSO = 20000;
const PREFIJO = claveMiniId("");

const fotos = new Map();      // clave → data URL
const avisar = new Map();     // clave → Set de funciones (clave, url)
const cola = [];              // piezas que faltan, en orden de pedido
const vuelo = new Map();      // id → pieza, las que el worker está sacando
let w = null, listo = false, falla = false, ocioso = 0, visor = null;

/* La foto de `v` si ya está (memoria o localStorage), o "". */
export function fotoRock(v) {
  const k = claveMini(v);
  if (fotos.has(k)) return fotos.get(k);
  let u = "";
  try { u = localStorage.getItem(k) || ""; } catch (e) {}
  if (u) fotos.set(k, u);
  return u;
}

/* Pide las fotos que falten de `vs`; `alLlegar(clave, url)` se llama con
   cada una cuando llega. Las primeras de la lista salen primero. */
export function pideFotosRock(vs, alLlegar) {
  limpiaMinisViejas();
  const nuevas = [];
  for (const v of vs) {
    if (!v || fotoRock(v)) continue;
    const k = claveMini(v);
    if (alLlegar) { if (!avisar.has(k)) avisar.set(k, new Set()); avisar.get(k).add(alLlegar); }
    if (cola.some(x => claveMini(x) === k) || vuelo.has(k.slice(PREFIJO.length))) continue;
    nuevas.push(v);
  }
  if (!nuevas.length) return;
  cola.unshift(...nuevas);
  manda();
}

function llega(k, url) {
  if (url) {
    fotos.set(k, url);
    try { localStorage.setItem(k, url); } catch (e) {}
  }
  const fs = avisar.get(k);
  avisar.delete(k);
  if (url && fs) for (const f of fs) try { f(k, url); } catch (e) { console.warn("[rock] foto", e); }
}

function manda() {
  if (!cola.length) return;
  if (falla) return mandaVisor();
  if (!w) return arranca();
  clearTimeout(ocioso);
  if (!listo) return;
  while (vuelo.size < 2 && cola.length) {
    const v = cola.shift(), k = claveMini(v);
    if (fotos.has(k)) continue;
    const id = k.slice(PREFIJO.length);
    vuelo.set(id, v);
    w.postMessage({ t: "foto", id, v });
  }
}

function arranca() {
  try {
    if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") throw new Error("sin OffscreenCanvas");
    w = new Worker(TRABAJADOR, { type: "module" });
    w.onmessage = e => {
      const d = e.data || {};
      if (d.t === "listo") { listo = true; manda(); }
      else if (d.t === "error") fallo(d.m);
      else if (d.t === "foto") recibe(d.id, d.blob);
    };
    w.onerror = e => { if (e.preventDefault) e.preventDefault(); fallo(e.message || "error"); };
    w.postMessage({ t: "fotografo" });
  } catch (err) { fallo(err && err.message || err); }
}

function fallo(m) {
  console.warn("[rock] las fotos van por el visor:", m);
  falla = true;
  if (w) w.terminate();
  w = null; listo = false;
  cola.unshift(...vuelo.values());   // lo que estaba en camino, al visor
  vuelo.clear();
  manda();
}

function recibe(id, blob) {
  const v = vuelo.get(id);
  if (!v) return;
  vuelo.delete(id);
  const k = claveMini(v);
  manda();
  if (!cola.length && !vuelo.size) {
    clearTimeout(ocioso);
    ocioso = setTimeout(() => { if (cola.length || vuelo.size || !w) return; w.terminate(); w = null; listo = false; }, OCIOSO);
  }
  if (!blob) return llega(k, "");
  const rd = new FileReader();
  rd.onload = () => llega(k, typeof rd.result === "string" && rd.result.startsWith("data:image/") ? rd.result : "");
  rd.onerror = () => llega(k, "");
  rd.readAsDataURL(blob);
}

/* sin worker: el iframe de rock-visor.html, todo lo que falta de una vez */
function mandaVisor() {
  const lista = cola.splice(0).filter(v => !fotos.has(claveMini(v)));
  if (!lista.length) return;
  const envia = l => visor.f.contentWindow.postMessage({ canal: "rock-visor-pide", lista: l }, location.origin);
  if (!visor) {
    const f = document.createElement("iframe");
    f.src = VISOR; f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.title = "";
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:220px;height:220px;border:0;opacity:0;pointer-events:none";
    visor = { f, listo: false, cola: [] };
    window.addEventListener("message", e => {
      if (e.origin !== location.origin || e.source !== f.contentWindow || !e.data || e.data.canal !== "rock-visor") return;
      if (e.data.listo) { visor.listo = true; if (visor.cola.length) envia(visor.cola.splice(0)); return; }
      for (const x of e.data.fotos || [])
        if (x && typeof x.id === "string" && typeof x.url === "string" && x.url.startsWith("data:image/")) llega(claveMiniId(x.id), x.url);
    });
    document.body.appendChild(f);
  }
  if (visor.listo) envia(lista); else visor.cola.push(...lista);
}
