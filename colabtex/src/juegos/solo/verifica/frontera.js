/* Verificador antitrampas de la Frontera Batalla (ver
   docs/antitrampas/frontera.md).

   La Frontera no pasa por el iframe del club: la pantalla
   (`juegos/frontera.js`) llama a `verificaClub` antes de subir una marca.
   Como todo combate sale de la semilla de la racha, la prueba es la
   receta —el equipo y las elecciones de cada combate ganado— y aquí se
   vuelven a jugar todos con el simulador de Showdown: la racha vale si
   cada combate se gana. Lo que se comprueba vive en el propio motor
   (`PokeMotor.frontera.compruebaPrueba`, pokemon/frontera-motor.js), el
   mismo que arma la prueba, así que juego y verificador no pueden decir
   cosas distintas.

   **En el navegador se rehace en un Worker con su propia copia del
   motor.** El simulador de la página es un objeto global
   (`globalThis.PokeMotor`): una línea en la consola le cambia la
   potencia a un movimiento, las estadísticas de una especie o la cabeza
   de la IA, y un verificador que usara ese mismo objeto jugaría con las
   mismas cartas marcadas. El Worker carga `juegos-pokemon.js` de cero
   para cada comprobación y se cierra al terminar; las piezas con que se
   le habla (Worker, Blob, postMessage…) se guardan al cargar el bundle,
   antes de que nadie pueda tocarlas desde la consola. En Node (las
   pruebas, la auditoría) no hay Worker: se usa el `globalThis.PokeMotor`
   que haya cargado quien llama.

   Rehacer cuesta (≈10–30 ms por combate), y una racha se comprueba
   entera en cada récord nuevo: por eso se recuerda, en esta sesión, hasta
   qué combate ya se rehizo cada racha (`hechas`), y el siguiente récord
   solo juega los combates nuevos. */
import { urlMotor } from "../../pokemon/carga.js";

/* Versión de la prueba: desde la 1, una marca sin prueba se rechaza. */
export const PRUEBA = 1;

const MAL = "No se pudo comprobar la partida: ";
const NAVEGADOR = typeof window !== "undefined" && typeof document !== "undefined";
const NAT = (() => {
  if (!NAVEGADOR || typeof Worker !== "function" || typeof Blob !== "function") return null;
  try {
    const W = Worker, P = W.prototype, des = n => (Object.getOwnPropertyDescriptor(P, n) || {}).set || null;
    return {
      Worker: W, Blob, apply: Reflect.apply, post: P.postMessage, termina: P.terminate,
      onmsg: des("onmessage"), onerr: des("onerror"),
      crea: URL.createObjectURL.bind(URL), suelta: URL.revokeObjectURL.bind(URL),
      espera: setTimeout.bind(globalThis), corta: clearTimeout.bind(globalThis)
    };
  } catch (e) { return null; }
})();

/* El código del Worker: carga el motor y responde una sola pregunta. */
const fuente = url => `"use strict";
var cargado = true;
try { importScripts(${JSON.stringify(url)}); } catch (e) { cargado = false; }
onmessage = function (e) {
  var d = e.data, r;
  if (!cargado || typeof PokeMotor === "undefined") r = { m: ${JSON.stringify(MAL + "no cargó el motor de Pokémon.")} };
  else try { var m = PokeMotor.frontera.compruebaPrueba(d.dato, d.prueba, d.desde); r = m ? { m: String(m) } : { ok: 1 }; }
  catch (err) { r = { m: ${JSON.stringify(MAL)} + (err && err.message || err) }; }
  postMessage(r);
};`;

function enWorker(dato, prueba, desde, ms) {
  return new Promise(ok => {
    let w = null, url = null, t = 0, hecho = false;
    const fin = m => {
      if (hecho) return;
      hecho = true;
      NAT.corta(t);
      try { if (w) NAT.apply(NAT.termina, w, []); } catch (e) { /* ya estaba cerrado */ }
      try { if (url) NAT.suelta(url); } catch (e) { /* nada que soltar */ }
      ok(m);
    };
    try {
      url = NAT.crea(new NAT.Blob([fuente(urlMotor())], { type: "text/javascript" }));
      w = new NAT.Worker(url);
      const alMsg = e => { const d = e && e.data; fin(d && d.ok === 1 ? null : d && typeof d.m === "string" ? d.m : MAL + "respuesta ilegible."); };
      const alErr = () => fin(MAL + "el verificador no arrancó.");
      if (NAT.onmsg) NAT.apply(NAT.onmsg, w, [alMsg]); else w.onmessage = alMsg;
      if (NAT.onerr) NAT.apply(NAT.onerr, w, [alErr]); else w.onerror = alErr;
      t = NAT.espera(() => fin(MAL + "tardó demasiado."), ms);
      NAT.apply(NAT.post, w, [{ dato, prueba, desde }]);
    } catch (e) { fin(MAL + (e && e.message || e)); }
  });
}

/* Por racha (categoría, semilla y equipo de partida): cuántos combates
   ya se rehicieron y cuáles eran. Solo se salta lo que coincide letra a
   letra con lo ya comprobado. */
const hechas = new Map();

export async function verifica(dato, prueba) {
  if (!prueba || typeof prueba !== "object") return "La partida llegó sin prueba.";
  let desde = 0, clave = null;
  if (dato && dato.categoria !== "club-frontera-victorias" && Array.isArray(prueba.b)) {
    clave = [dato.categoria, prueba.s, prueba.e || "", prueba.t || ""].join("|");
    const h = hechas.get(clave);
    if (h && h.n <= prueba.b.length && JSON.stringify(prueba.b.slice(0, h.n)) === h.texto) desde = h.n;
  }
  const combates = clave ? prueba.b.length - desde : Array.isArray(prueba.l) ? prueba.l.length : 0;
  let m;
  if (NAT) m = await enWorker(dato, prueba, desde, 30000 + 2000 * Math.max(0, combates));
  else {
    const PM = globalThis.PokeMotor;
    if (!PM || !PM.frontera || typeof PM.frontera.compruebaPrueba !== "function") return MAL + "falta el motor de Pokémon.";
    m = PM.frontera.compruebaPrueba(dato, prueba, desde);
  }
  if (!m && clave) {
    hechas.set(clave, { n: prueba.b.length, texto: JSON.stringify(prueba.b) });
    if (hechas.size > 24) hechas.delete(hechas.keys().next().value);
  }
  return m || null;
}

/* Una fila ya guardada, sin prueba. Lo que la pantalla escribió siempre:
   - racha: `partida` = `<semilla>-<n>` (o `fr-<inst>-<nivel>-<n>-<uid>`
     al reparar), con n = la marca; la de ahora, igual que la primera.
   - victorias: `<semilla>-<n>v`, `frv-<total>-<uid>` o, desde la
     prueba, `fv-<ordinal>`.
   Y un combate nunca suma menos de un segundo (`cierraPelea`, desde la
   primera versión), así que la racha no puede durar menos que eso. Para
   el total se da un margen de cuatro: `victorias` puede subir con la
   tabla (otro aparato) sin que suba el tiempo guardado aquí. */
const SEM = "[0-9a-f]{12}";
export function sospecha(categoria, fila) {
  if (!fila) return null;
  const p = Math.floor(+fila.puntos), t = +fila.tiempo, partida = String(fila.partida || "");
  if (!Number.isFinite(p) || p < 1) return null;
  if (categoria === "club-frontera-victorias") {
    const m = /^frv-(\d+)-[A-Za-z0-9]{1,8}$/.exec(partida);
    const forma = new RegExp(`^${SEM}-\\d+v$`).test(partida) || /^fv-[1-9]\d*$/.test(partida) || (m && +m[1] === p);
    if (!forma) return "la partida no tiene la forma que escribe la Frontera (¿escrita a mano?)";
    if (Number.isFinite(t) && t < 250 * p) return `${p} victorias en ${Math.round(t / 1000)} s: menos de un cuarto de segundo por combate`;
    return null;
  }
  const kk = categoria.replace(/^club-frontera-/, "");
  const a = new RegExp(`^${SEM}-(\\d+)$`).exec(partida), b = new RegExp(`^fr-${kk}-(\\d+)-[A-Za-z0-9]{1,8}$`).exec(partida);
  if (!a && !b) return "la partida no tiene la forma que escribe la Frontera (¿escrita a mano?)";
  if (+(a || b)[1] !== p) return `la partida dice ${(a || b)[1]} combates y la marca ${p}`;
  if (Number.isFinite(t) && t < 1000 * p) return `${p} combates en ${Math.round(t / 1000)} s: la Frontera cuenta al menos un segundo por combate`;
  return null;
}
