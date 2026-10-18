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

/* GIFs de GIPHY: los de moda, o los que respondan a `q`. */
export async function gifsGiphy(q = "") {
  const k = await claveGiphy();
  const u = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${k}&q=${encodeURIComponent(q.trim().slice(0, 50))}&limit=24&rating=pg-13&lang=es`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${k}&limit=40&rating=pg-13`;
  const d = await (await fetch(u)).json();
  return ((d && d.data) || []).map(g => {
    const o = (g.images && g.images.original) || {};
    return { p: "gif", u: String(g.id || ""), n: String(g.title || "").slice(0, 60), w: Number(o.width), h: Number(o.height), cajas: 2 };
  }).filter(g => /^[A-Za-z0-9]{6,40}$/.test(g.u) && g.w >= 40 && g.h >= 40 && g.w / g.h <= 5 && g.h / g.w <= 5);
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
