/* PRO HERO, la parte pura (sin DOM ni Firebase, se prueba en Node con
   tests/hero.test.cjs): cómo se cuentan las estrellas, lo que pagan y la
   verificación de una canción terminada. El cartero es hero.js. */
import { leeCancion } from "../../../juegos/hero/js/core/leer.js";
import { rehace, pareceBot } from "../../../juegos/hero/js/game/prueba.js";
import { claveCancion, dificultadMaxima, ES_CLAVE } from "../../../juegos/hero/js/sitio/clave.js";

export const CAT_HERO = "club-hero-estrellas";
const SEP = 10000;
export const codificaHero = (G, M) => G * SEP + Math.min(M, SEP - 1);
export const decodificaHero = p => ({ g: Math.floor((+p || 0) / SEP), m: (+p || 0) % SEP });
// Lo que pagan las estrellas de una canción: 100 cada dorada y 50 cada azul
// que no esté ya cubierta por una dorada (= 50·(g + máx(g, b))).
export const monedasCancionHero = r => 50 * ((r.g | 0) + Math.max(r.g | 0, r.b | 0));

/* El resumen de todas tus canciones: lo que va a la fila de la clasificación. */
export function resumenHero(mias) {
  let G = 0, M = 0, h = 0, h5 = 0;
  for (const r of Object.values(mias || {})) {
    const g = Math.min(5, r.g | 0), b = Math.min(5, r.b | 0);
    G += g; M += Math.max(g, b);
    if (g > 0) h++;
    if (g >= 5) h5++;
  }
  return { G, M, h, h5, puntos: codificaHero(G, M) };
}

/* Lo nuevo de una canción terminada sobre lo que ya tenías. */
export function aplicaHero(prev, v) {
  const p = { g: prev?.g | 0, b: prev?.b | 0, s: prev?.s | 0 };
  const e = Math.min(5, v.estrellas | 0);
  const n = { g: v.oro ? Math.max(p.g, e) : p.g, b: v.oro ? p.b : Math.max(p.b, e), s: Math.max(p.s, v.score | 0) };
  return { prev: p, nuevo: n, cambia: n.g !== p.g || n.b !== p.b || n.s !== p.s, record: n.s > p.s,
    monedas: monedasCancionHero(n) - monedasCancionHero(p),
    oro: n.g - p.g, azul: Math.max(0, Math.max(0, n.b - n.g) - Math.max(0, p.b - p.g)) };
}

/* Vuelve a tocar lo que mandó el juego. Devuelve el resultado verificado o
   lanza con el motivo. */
export function verificaHero(d) {
  if (!d || typeof d.id !== "string" || !d.id || d.id.length > 300) throw new Error("canción desconocida");
  const k = claveCancion(d.id);
  if (d.k !== k || !ES_CLAVE.test(k)) throw new Error("la clave de la canción no cuadra");
  if (!(d.chart instanceof ArrayBuffer) || d.chart.byteLength > 4e6 || typeof d.chartFile !== "string") throw new Error("sin chart");
  const song = leeCancion(d.chartFile, d.chart, d.ini instanceof ArrayBuffer ? d.ini : null);
  const r = rehace(song, d.prueba);
  const c = r.cab;
  if (c.id !== d.id || c.p !== d.part || c.d !== d.diff) throw new Error("la prueba es de otra canción o de otra parte");
  if (!r.completa) throw new Error("la canción no se tocó entera");
  const st = d.stats || {};
  if (r.stats.score !== st.score || r.stats.stars !== st.stars) throw new Error(`el puntaje no cuadra al repetir la partida (${r.stats.score} y no ${st.score})`);
  if (pareceBot(r.desvios)) throw new Error("los aciertos caen todos a la hora exacta: parece un bot");
  if (r.stats.score > 1e8) throw new Error("puntaje imposible");
  return { k, id: d.id, score: r.stats.score, estrellas: Math.min(5, r.stats.stars), oro: c.d === dificultadMaxima(song, c.p), p: c.p, d: c.d, m: c.m, stats: r.stats };
}

