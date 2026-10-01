/* El perfil público — marcos, fondos, vitrina y lo que se dice de alguien.
 *
 * Todo lo de este archivo es puro (ni DOM ni Firebase): sale de lo que ya
 * leen las pestañas de Clasificación y Logros (`fb.watchLogros`: ranks,
 * soloRanks y logros) más el perfil de `users/<uid>/perfil`. Por eso se
 * prueba en Node, y por eso no hizo falta ninguna regla nueva: el perfil
 * ya era del dueño, y lo demás ya se podía leer.
 *
 * Tres decisiones:
 *
 * 1. **Los marcos y los fondos son CSS, no imágenes.** Un catálogo de ids
 *    con su nombre y, si lo tiene, lo que cuesta. La clase `jg-marco-<id>`
 *    vive en juegos.html, así que un marco se ve igual en un círculo de 18
 *    píxeles que en uno de 112, y en tema claro y oscuro, sin subir nada.
 * 2. **Algunos se ganan.** Los que piden logros o un podio se miran contra
 *    las estadísticas de su dueño cada vez que se pintan (`marcoVisible`):
 *    quien se escriba a mano en la base el marco de campeón sin serlo lo ve
 *    guardado, pero los demás le ven el anillo de siempre.
 * 3. **La vitrina guarda claves, no copias.** `l:<juego>:<id>` es un logro,
 *    `r:<juego>` un puesto en la clasificación de una sala y
 *    `s:<categoría>` una marca del club. Se resuelven al pintar contra los
 *    datos vivos: el puesto que se exhibe es el de hoy, no el del día en que
 *    se eligió, y lo que se perdió (un récord que alguien superó del todo,
 *    una fila borrada) desaparece solo en vez de mentir.
 */
import { JUEGOS, ordenaRanks } from "./motor.js";
import { LOGROS, SOLO_PREFIJO, reparto } from "./logros.js";

export const LARGO_BIO = 120;
export const MAX_VITRINA = 6;

/* req: {logros: n} pide n logros; {podio: true} un puesto 1–3 en una tabla
   de al menos tres personas; {primero: true} el primer puesto en una así. */
export const MARCOS = [
  { id: "nada", n: "Sin marco" },
  { id: "anillo", n: "Anillo" },
  { id: "doble", n: "Doble anillo" },
  { id: "pixel", n: "Píxel" },
  { id: "neon", n: "Neón" },
  { id: "arcoiris", n: "Arcoíris" },
  { id: "corazones", n: "Corazones", req: { logros: 3 } },
  { id: "fuego", n: "Llamas", req: { logros: 8 } },
  { id: "escarcha", n: "Escarcha", req: { logros: 15 } },
  { id: "galaxia", n: "Galaxia", req: { logros: 30 } },
  { id: "laurel", n: "Laurel", req: { podio: true } },
  { id: "corona", n: "Corona", req: { primero: true } }
];

/* Los fondos son el `background` de la cabecera de la tarjeta y de la
   página. `oscuro` dice si encima va letra clara. `color` usa el tuyo. */
export const FONDOS = [
  { id: "color", n: "Tu color", oscuro: true, css: c => `linear-gradient(135deg, ${c}, ${oscurece(c, .45)})` },
  { id: "aurora", n: "Aurora", oscuro: true, css: () => "radial-gradient(ellipse at 15% 0%, #3cffb677, transparent 60%), radial-gradient(ellipse at 85% 30%, #8b5cff88, transparent 55%), linear-gradient(160deg, #0b1d2b, #16324d)" },
  { id: "atardecer", n: "Atardecer", oscuro: true, css: () => "radial-gradient(circle at 75% 85%, #fff3b0 0 8%, transparent 9%), linear-gradient(170deg, #5b2a86 0%, #ff6f61 55%, #ffb347 100%)" },
  { id: "oceano", n: "Océano", oscuro: true, css: () => "radial-gradient(ellipse at 50% 120%, #90e0ef, transparent 60%), linear-gradient(180deg, #023e8a, #0096c7)" },
  { id: "bosque", n: "Bosque", oscuro: true, css: () => "linear-gradient(160deg, #0f3b2e, #2d6a4f 55%, #95d5b2)" },
  { id: "caramelo", n: "Caramelo", oscuro: false, css: () => "repeating-linear-gradient(45deg, #ffd1e8 0 14px, #fff0f7 14px 28px)" },
  { id: "fieltro", n: "Mesa de juego", oscuro: true, css: () => "radial-gradient(ellipse at center, #23874f, #0b3d24 75%)" },
  { id: "retro", n: "Retro", oscuro: true, css: () => "linear-gradient(#ff2fd733 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, #29e0ff33 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(180deg, #1a0633, #3b0a5c)" },
  { id: "papel", n: "Papel", oscuro: false, css: () => "repeating-linear-gradient(0deg, #e8e2d4 0 1px, transparent 1px 22px), #fbf8f1" },
  { id: "galaxia", n: "Galaxia", oscuro: true, req: { logros: 10 }, css: () => "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 80%, #fff, transparent), radial-gradient(1px 1px at 85% 20%, #fff, transparent), radial-gradient(ellipse at 30% 40%, #7b2ff766, transparent 60%), linear-gradient(160deg, #0b0320, #1c0b45)" },
  { id: "lava", n: "Lava", oscuro: true, req: { logros: 20 }, css: () => "radial-gradient(ellipse at 30% 110%, #ffb000, transparent 45%), radial-gradient(ellipse at 80% 100%, #ff4d00, transparent 50%), linear-gradient(180deg, #1a0500, #5a1400)" },
  { id: "oro", n: "Oro", oscuro: false, req: { podio: true }, css: () => "linear-gradient(120deg, #a86f10, #f4c542 40%, #fff6c4 50%, #f4c542 60%, #a86f10)" }
];

const NOMBRES_EXTRA = { minas: "Mina Club", snake: "Snake Club", tetrisclub: "Tetris Club", sortem: "sortEm", bbtan: "BBTAN", sopa: "Sopa de letras", electro: "Electrodle" };
export const nombreJuego = j => (JUEGOS[j] && JUEGOS[j].nombre) || NOMBRES_EXTRA[j] || j;

/* Las partes de una categoría del club, para decirla en palabras. */
const PARTES = {
  easy: "Fácil", medium: "Medio", hard: "Difícil", maraton: "Maratón", sprint: "Sprint 40", ultra: "Ultra 2 min",
  rondas: "Ronda máxima", "10": "Del 1 al 10", "20": "Del 1 al 20", classic: "Clásico", arcade: "Arcade",
  portals: "Portales", reloj: "Contrarreloj", espejo: "Espejo", laberinto: "Laberinto", chico: "mapa chico",
  mediano: "mapa mediano", grande: "mapa grande", gigante: "mapa gigante",
  racha: "Racha diaria", puntos: "Puntos totales", facil: "Fácil", medio: "Medio", dificil: "Difícil", "8": "8×8", "12": "12×12", "15": "15×15"
};
export const juegoDeCategoria = c => Object.keys(SOLO_PREFIJO).find(k => String(c).startsWith(SOLO_PREFIJO[k])) || "";
export function nombreCategoria(c) {
  const j = juegoDeCategoria(c);
  if (!j) return String(c);
  const resto = String(c).slice(SOLO_PREFIJO[j].length).split("-").map(p => PARTES[p] || p);
  return `${nombreJuego(j)} · ${resto.join(", ")}`;
}
/* Cómo se dice una marca del club: las que se ganan por tiempo, en tiempo. */
const porTiempo = c => /^club-(minas|sortem)-/.test(c) || c === "club-tetris-sprint" || (/^club-sopa-/.test(c) && c !== "club-sopa-racha");
export function valorMarca(c, f) {
  if (!f) return "";
  if (porTiempo(c)) return `${((f.tiempo || 0) / 1000).toFixed(2)} s`;
  if (String(c).startsWith("club-bbtan-")) return `ronda ${f.puntos || 0}`;
  if (c === "club-sopa-racha" || c === "club-electro-racha") return `${f.puntos || 0} ${f.puntos === 1 ? "día" : "días"}`;
  return `${f.puntos || 0} pts`;
}
// El mismo orden que la tabla del club (discord.js: ordenSolo).
const ordenMarca = (a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo || String(a.uid).localeCompare(String(b.uid));

/* Lo que se sabe de alguien a partir de las tres lecturas: sus logros,
   cada tabla en la que aparece con su puesto, y los totales. */
export function estadisticas(uid, datos) {
  const d = datos || {};
  const { tiene, gente } = reparto(d.ranks, d.solo, d.logros);
  const logros = [];
  for (const j of Object.keys(LOGROS)) for (const x of LOGROS[j]) {
    if (!tiene[j][x.id].has(uid)) continue;
    const g = gente[j].size;
    logros.push({ j, id: x.id, n: x.n, d: x.d, i: x.i, pct: g ? Math.round(tiene[j][x.id].size * 100 / g) : 0 });
  }
  const tablas = [];
  let nombre = "", foto = "", partidas = 0, victorias = 0;
  for (const [j, filas] of Object.entries(d.ranks || {})) {
    const mia = filas && filas[uid];
    if (!mia) continue;
    const orden = ordenaRanks(Object.entries(filas).map(([u, f]) => Object.assign({ uid: u }, f)));
    const i = orden.findIndex(f => f.uid === uid);
    tablas.push({ clave: "r:" + j, tipo: "r", j, puesto: i + 1, de: orden.length, puntos: mia.puntos || 0, ganadas: mia.ganadas || 0, jugadas: mia.jugadas || 0 });
    partidas += mia.jugadas || 0; victorias += mia.ganadas || 0;
    if (mia.nombre && !nombre) nombre = mia.nombre;
    if (mia.foto && !foto) foto = mia.foto;
  }
  for (const [c, filas] of Object.entries(d.solo || {})) {
    const mia = filas && filas[uid];
    const j = juegoDeCategoria(c);
    if (!mia || !j) continue;
    const orden = Object.entries(filas).map(([u, f]) => Object.assign({ uid: u, puntos: 0, tiempo: 0 }, f)).sort(ordenMarca);
    const i = orden.findIndex(f => f.uid === uid);
    tablas.push({ clave: "s:" + c, tipo: "s", j, c, puesto: i + 1, de: orden.length, valor: valorMarca(c, mia) });
    if (mia.nombre && !nombre) nombre = mia.nombre;
  }
  tablas.sort((a, b) => a.puesto - b.puesto || b.de - a.de);
  const serias = tablas.filter(t => t.de >= 3);
  return {
    uid, nombre, foto, logros, tablas, partidas, victorias,
    nLogros: logros.length,
    totalLogros: Object.values(LOGROS).reduce((t, l) => t + l.length, 0),
    podios: serias.filter(t => t.puesto <= 3).length,
    primeros: serias.filter(t => t.puesto === 1).length,
    mejorPuesto: tablas.length ? tablas[0].puesto : 0
  };
}

/* ¿Puede usarlo? Devuelve {ok, falta}: `falta` dice qué le queda. */
export function requisito(item, est) {
  const r = item && item.req;
  if (!r) return { ok: true, falta: "" };
  if (!est) return { ok: false, falta: "Cargando…" };
  if (r.logros) return est.nLogros >= r.logros ? { ok: true, falta: "" } : { ok: false, falta: `${r.logros} logros (llevas ${est.nLogros})` };
  if (r.primero) return est.primeros > 0 ? { ok: true, falta: "" } : { ok: false, falta: "Sé el n.º 1 de una clasificación de 3 o más" };
  if (r.podio) return est.podios > 0 ? { ok: true, falta: "" } : { ok: false, falta: "Sube al podio de una clasificación de 3 o más" };
  return { ok: false, falta: "" };
}

export const marcoDe = id => MARCOS.find(m => m.id === id) || null;
export const fondoDe = id => FONDOS.find(f => f.id === id) || null;
/* El marco que se ve: el elegido si se puede, si no el anillo. Sin
   estadísticas todavía (una ficha, un chip) se confía en lo guardado. */
export function marcoVisible(perfil, est) {
  const m = marcoDe(perfil && perfil.marco) || marcoDe("anillo");
  return !est || requisito(m, est).ok ? m.id : "anillo";
}
export function fondoVisible(perfil, est) {
  const f = fondoDe(perfil && perfil.fondo) || fondoDe("color");
  return !est || requisito(f, est).ok ? f : fondoDe("color");
}

/* Todo lo que se puede exhibir, ya resuelto y con su texto. */
export function opcionesVitrina(est) {
  if (!est) return [];
  const out = [];
  for (const t of est.tablas) {
    out.push(t.tipo === "r"
      ? { clave: t.clave, tipo: "r", i: t.puesto <= 3 ? ["🥇", "🥈", "🥉"][t.puesto - 1] : "🏅", t: `#${t.puesto} de ${t.de}`, s: nombreJuego(t.j), x: `${t.puntos} pts · ${t.ganadas} victorias`, puesto: t.puesto, de: t.de }
      : { clave: t.clave, tipo: "s", i: t.puesto <= 3 ? ["🥇", "🥈", "🥉"][t.puesto - 1] : "🏅", t: `#${t.puesto} de ${t.de}`, s: nombreCategoria(t.c), x: t.valor, puesto: t.puesto, de: t.de });
  }
  for (const l of est.logros)
    out.push({ clave: `l:${l.j}:${l.id}`, tipo: "l", i: l.i, t: l.n, s: nombreJuego(l.j), x: l.pct ? `lo tiene el ${l.pct} %` : l.d, pct: l.pct });
  return out;
}

/* La vitrina que se ve: lo elegido que todavía existe, en su orden; y si no
   eligió nada, lo mejor que tiene (sus puestos más altos y sus logros más
   raros), para que nadie tenga una vitrina vacía sin haberlo decidido. */
export function vitrinaDe(perfil, est, max = MAX_VITRINA) {
  const ops = opcionesVitrina(est), por = new Map(ops.map(o => [o.clave, o]));
  const elegidas = Array.isArray(perfil && perfil.vitrina) ? perfil.vitrina
    : perfil && perfil.vitrina && typeof perfil.vitrina === "object" ? Object.values(perfil.vitrina) : null;
  if (elegidas && elegidas.length) return elegidas.map(k => por.get(k)).filter(Boolean).slice(0, max);
  const puestos = ops.filter(o => o.tipo !== "l" && o.de >= 2).sort((a, b) => a.puesto - b.puesto || b.de - a.de).slice(0, 2);
  const raros = ops.filter(o => o.tipo === "l").sort((a, b) => a.pct - b.pct).slice(0, max - puestos.length);
  return [...puestos, ...raros].slice(0, max);
}

/* Lo que se guarda, limpio: ids que existen, una bio corta y una vitrina
   de claves sin repetir. Lo desconocido no pasa. */
export function limpiaPerfil(p) {
  const out = {};
  if (p.marco && marcoDe(p.marco)) out.marco = p.marco;
  if (p.fondo && fondoDe(p.fondo)) out.fondo = p.fondo;
  if (typeof p.bio === "string") out.bio = p.bio.replace(/\s+/g, " ").trim().slice(0, LARGO_BIO);
  if (Array.isArray(p.vitrina)) out.vitrina = [...new Set(p.vitrina.filter(k => /^(l:[a-z0-9]+:[a-z0-9]+|r:[a-z0-9]+|s:club-[a-z0-9-]+)$/.test(k)))].slice(0, MAX_VITRINA);
  return out;
}

/* Un color #rrggbb, más oscuro (f de 0 a 1). */
export function oscurece(c, f) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c || ""));
  if (!m) return "#1e293b";
  const n = parseInt(m[1], 16), k = 1 - f;
  return "#" + [16, 8, 0].map(s => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, "0")).join("");
}
