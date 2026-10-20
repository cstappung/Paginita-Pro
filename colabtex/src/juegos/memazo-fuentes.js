/* Memazo — plantillas de afuera: Imgflip y GIPHY.
 *
 * - **Imgflip** (`api.imgflip.com/get_memes`) no pide clave y responde a
 *   cualquier origen: son las ~100 plantillas más usadas, con su imagen en
 *   `i.imgflip.com`. La lista se guarda un día en `localStorage`.
 * - **GIPHY** pide una clave. No va en el código: vive en `giphy/clave`,
 *   que cualquiera con sesión lee y nadie escribe desde la web (como el
 *   webhook de Discord), y se pega a mano en la consola. Sin clave, la
 *   sala de GIFs cae a las plantillas de la casa.
 *
 * Cada servicio da su lista a quien la pide, y no tiene por qué ser la
 * misma en dos pestañas: por eso la jugada lleva la imagen entera
 * (`u`, `w`, `h`) en vez de un número de la lista. El motor la valida
 * (`externoMemazo`). Nada de esto toca el estado de la partida; si una
 * llamada falla, el editor ofrece los dibujos.
 */
import { db } from "../firebase.js";
import { ref, get } from "firebase/database";

const DIA = 24 * 3600e3;
const CLAVE_CACHE = "jg.mz.imgflip";
const lee = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* Dónde va cada texto si el jugador no los mueve, según cuántos son. */
export function cajasPorDefecto(n) {
  n = Math.max(1, Math.min(5, n || 2));
  if (n === 1) return [[3, 3, 94, 22]];
  if (n === 2) return [[3, 3, 94, 22], [3, 75, 94, 22]];
  if (n === 3) return [[3, 3, 94, 20], [3, 40, 94, 20], [3, 77, 94, 20]];
  if (n === 4) return [[3, 3, 45, 22], [52, 3, 45, 22], [3, 75, 45, 22], [52, 75, 45, 22]];
  return [[3, 3, 94, 17], [3, 22, 94, 17], [3, 41, 94, 17], [3, 60, 94, 17], [3, 79, 94, 17]];
}

let imgflip = null;
/* [{p:"if", u, n, w, h, cajas}] — las plantillas de Imgflip. */
export function plantillasImgflip() {
  if (imgflip) return imgflip;
  const c = lee(CLAVE_CACHE);
  if (c && Date.now() - c.at < DIA && Array.isArray(c.l) && c.l.length) return (imgflip = Promise.resolve(c.l));
  imgflip = fetch("https://api.imgflip.com/get_memes").then(r => r.json()).then(d => {
    const l = ((d && d.data && d.data.memes) || []).map(m => ({
      p: "if", u: String(m.url || "").split("/").pop(), n: String(m.name || "").slice(0, 60),
      w: Number(m.width), h: Number(m.height), cajas: Math.max(1, Math.min(5, Number(m.box_count) || 2))
    })).filter(m => /^[A-Za-z0-9]{3,12}\.(jpg|png|gif)$/.test(m.u) && m.w >= 40 && m.h >= 40 && m.w / m.h <= 5 && m.h / m.w <= 5);
    if (!l.length) throw new Error("Imgflip no devolvió plantillas");
    guarda(CLAVE_CACHE, { at: Date.now(), l });
    return l;
  });
  imgflip.catch(() => { imgflip = null; });   // la próxima vez se reintenta
  return imgflip;
}

let clave = null;
const claveGiphy = () => clave || (clave = get(ref(db, "giphy/clave")).then(s => {
  const v = s.val();
  if (typeof v !== "string" || !/^[A-Za-z0-9]{10,64}$/.test(v)) throw new Error("sin clave de GIPHY");
  return v;
}).catch(e => { clave = null; throw e; }));

/* GIFs de GIPHY: los de moda, o los que respondan a `q`.

   Una clave de prueba de GIPHY da ~100 llamadas por hora **para todos los
   que la usan**, y al pasarse responde 429. Tres cosas lo cuidan, todas
   en `localStorage`, así que valen para todas las pestañas del navegador:

   - **Caché.** Los de moda duran `MODA_MS` (6 h) y cada búsqueda
     `BUSCA_MS` (1 día, las últimas `BUSCA_MAX`). Lo que está guardado no
     gasta nada, ni al recargar ni en la ronda siguiente.
   - **Tope por navegador.** `GIPHY_TOPE` llamadas por hora como mucho
     (`gasto`, las horas de las llamadas de la última hora). Con ocho
     jugadores el peor caso son 64, lejos de 100. Al llegar al tope el
     editor ofrece lo que ya tiene y dice cuánto falta.
   - **Freno tras un 429.** `FRENO_MS` (15 min) sin volver a llamar: si el
     cupo de la clave se acabó, insistir solo lo alarga.

   El buscador del editor solo llama al pulsar Enter o la lupa, nunca al
   teclear (`memazo.js`). Cualquier respuesta sin GIFs es un error con su
   motivo (`e.motivo`): antes un 429 se leía como «cero GIFs» y el editor
   se quedaba sin ofertas y sin caer a los dibujos. */
export const GIPHY_TOPE = 8;
const HORA = 3600e3, MODA_MS = 6 * HORA, BUSCA_MS = 24 * HORA, BUSCA_MAX = 40, FRENO_MS = 15 * 60e3;
const CLAVE_MODA = "jg.mz.giphy", CLAVE_BUSCA = "jg.mz.giphy.busca", CLAVE_GASTO = "jg.mz.giphy.gasto", CLAVE_FRENO = "jg.mz.giphy.freno";
const falla = (corto, motivo) => { const x = new Error(corto); x.motivo = motivo; return x; };
const minutos = ms => Math.max(1, Math.ceil(ms / 60e3));
function motivoGiphy(st) {
  if (st === 429) return "GIPHY llegó a su límite de llamadas por hora (la clave es de prueba)";
  if (st === 401 || st === 403) return "GIPHY no acepta la clave guardada en la base";
  return "GIPHY respondió con un error" + (st ? " (" + st + ")" : "");
}
/* Lo que se gastó en la última hora y si se puede llamar otra vez ahora. */
export function cupoGiphy(t = Date.now()) {
  const gasto = (lee(CLAVE_GASTO) || []).filter(x => typeof x === "number" && t - x < HORA && x <= t);
  const freno = Number(lee(CLAVE_FRENO)) || 0;
  if (freno > t) return { puede: false, quedan: 0, espera: freno - t, motivo: "GIPHY pidió una pausa: se puede volver a buscar en " + minutos(freno - t) + " min" };
  if (gasto.length >= GIPHY_TOPE) {
    const espera = Math.min(...gasto) + HORA - t;
    return { puede: false, quedan: 0, espera, motivo: "Ya hiciste las " + GIPHY_TOPE + " búsquedas de GIFs de esta hora: vuelve a buscar en " + minutos(espera) + " min" };
  }
  return { puede: true, quedan: GIPHY_TOPE - gasto.length, espera: 0, gasto };
}
const normaliza = q => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
export async function gifsGiphy(q = "") {
  q = normaliza(q);
  const t = Date.now();
  if (!q) {
    const c = lee(CLAVE_MODA);
    if (c && t - c.at < MODA_MS && Array.isArray(c.l) && c.l.length) return c.l;
  } else {
    const b = (lee(CLAVE_BUSCA) || {})[q];
    if (b && t - b.at < BUSCA_MS && Array.isArray(b.l)) return b.l;
  }
  const cupo = cupoGiphy(t);
  if (!cupo.puede) throw falla("sin cupo", cupo.motivo);
  let k;
  try { k = await claveGiphy(); }
  catch (e) { throw falla("sin clave", "Falta la clave de GIPHY en la base (giphy/clave)"); }
  const u = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${k}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=es`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${k}&limit=50&rating=pg-13`;
  guarda(CLAVE_GASTO, [...cupo.gasto, t]);   // se cuenta antes de llamar: una que falla también gastó
  let r, d;
  try { r = await fetch(u); d = await r.json().catch(() => null); }
  catch (e) { throw falla("sin red", "No se pudo llegar a GIPHY (¿sin conexión?)"); }
  const st = (d && d.meta && Number(d.meta.status)) || r.status;
  if (!r.ok || (st && st !== 200) || !d || !Array.isArray(d.data)) {
    if (st === 429) guarda(CLAVE_FRENO, t + FRENO_MS);
    throw falla("GIPHY " + st, motivoGiphy(st));
  }
  const l = d.data.map(g => {
    const o = (g.images && g.images.original) || {};
    return { p: "gif", u: String(g.id || ""), n: String(g.title || "").slice(0, 60), w: Number(o.width), h: Number(o.height), cajas: 2 };
  }).filter(g => /^[A-Za-z0-9]{6,40}$/.test(g.u) && g.w >= 40 && g.h >= 40 && g.w / g.h <= 5 && g.h / g.w <= 5);
  if (!q) {
    if (!l.length) throw falla("GIPHY vacío", "GIPHY no devolvió GIFs");
    guarda(CLAVE_MODA, { at: t, l });
  } else {
    const todas = lee(CLAVE_BUSCA) || {};
    todas[q] = { at: t, l };
    const claves = Object.keys(todas).sort((a, b) => todas[b].at - todas[a].at).slice(0, BUSCA_MAX);
    guarda(CLAVE_BUSCA, Object.fromEntries(claves.map(c => [c, todas[c]])));
  }
  return l;
}

/* Tres de una lista para el asiento `i` en la ronda `r`, más `vuelta`
   tandas de otras tres si pidió cambiar. Sembrado para que recargar la
   página no le cambie la oferta. */
export function eligeTres(lista, sem, r, i, vuelta = 0) {
  if (!lista.length) return [];
  let s = ((sem >>> 0) ^ Math.imul(r * 97 + i * 13 + 7, 0x9E3779B1)) >>> 0;
  const az = () => ((s = (s + 0x6D2B79F5) >>> 0), (Math.imul(s ^ (s >>> 15), s | 1) >>> 0) / 4294967296);
  const idx = lista.map((_, k) => k);
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(az() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  const desde = (vuelta * 3) % lista.length;
  return [0, 1, 2].map(k => lista[idx[(desde + k) % lista.length]]).filter((x, k, a) => a.indexOf(x) === k);
}
