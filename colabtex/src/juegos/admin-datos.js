/* ============================================================
   El panel de administración (admin.js): la parte pura.

   Sin DOM ni Firebase, para que la use igual el panel en el navegador,
   el script de consola (scripts/auditar-club.cjs) y los tests
   (tests/admin.test.cjs). Cuatro cosas:

   - **La auditoría de las tablas del club**: las señales que no necesitan
     la prueba (partida con forma rara, marca inverosímil, marca anómala
     frente al resto de la tabla). Antes vivían solo en el script; ahora
     son una sola copia, así que el panel y la consola nunca discrepan.
   - **Qué pruebas hay que bajar**: una prueba pesa hasta 200 kB, así que
     el panel solo baja las de filas que nadie auditó todavía con esa
     misma partida (`auditados/<cat>/<uid>` = {p, ok, m}). Una prueba se
     escribe una vez y no cambia: lo ya visto no se vuelve a bajar.
   - **Las suspensiones**: cuánto dura una («30m», «2h», «3d», «1s») y si
     está vigente.
   - **Los ajustes de monedas**: qué cantidad vale y cuánto suma cada
     cuenta (`ajustesMonedas/<uid>/<id>` = {n, m, por, at}).
   ============================================================ */

/* ---------- la auditoría ---------- */

/* Tablas donde compite el tiempo (menos es mejor); en el resto, los puntos. */
export const POR_TIEMPO = /^club-(minas-|sortem-|sopa-(facil|medio|dificil)-|sudoku-(facil|medio|dificil|experto)$|tetris-sprint$)/;

// La mediana de una lista de números (el del medio, o el promedio de los dos del medio)
export const mediana = v => {
  const a = v.slice().sort((x, y) => x - y), m = a.length >> 1;   // copia ordenada y su mitad
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;             // impar: el del medio; par: promedio
};

/* Cuánto se aparta una fila de las demás de su tabla. Con menos de tres
   filas más no hay con qué comparar. Umbrales anchos a propósito: lo que
   marca es «mirar esto», no «es trampa». */
export function anomalia(categoria, uid, filas) {
  const yo = filas[uid];                                                        // la fila que se revisa
  const otros = Object.entries(filas).filter(([u]) => u !== uid).map(([, f]) => f);   // el resto de la tabla
  if (!yo) return null;
  if (yo.tiempo < 1000 && POR_TIEMPO.test(categoria)) return `terminada en ${yo.tiempo} ms`;
  if (otros.length < 3) return null;                                           // sin con quién comparar
  if (POR_TIEMPO.test(categoria)) {
    /* Además de la mediana, el mejor de los demás (sin contar marcas de
       menos de un segundo): tres personas buenas juntas son un grupo, no
       una anomalía. */
    const m = mediana(otros.map(f => f.tiempo));
    const buenos = otros.map(f => f.tiempo).filter(t => t >= 1000);
    const mejor = buenos.length ? Math.min(...buenos) : Infinity;
    return yo.tiempo * 2.5 < m && yo.tiempo * 1.6 < mejor
      ? `${(m / yo.tiempo).toFixed(1)}× más rápida que la mediana de los demás (${(m / 1000).toFixed(1)} s; el mejor de ellos, ${(mejor / 1000).toFixed(1)} s)` : null;
  }
  if (/-racha$/.test(categoria)) return null;                                  // una racha no tiene ritmo
  const ritmo = f => f.puntos / Math.max(1, f.tiempo);                         // puntos por milisegundo
  const mr = mediana(otros.map(ritmo));
  const max = Math.max(...otros.map(f => f.puntos));
  if (ritmo(yo) > 4 * mr && yo.puntos > 1.6 * max) return `ritmo ${(ritmo(yo) / mr).toFixed(1)}× el de la mediana de los demás`;
  return yo.puntos > 2.5 * max ? `${(yo.puntos / max).toFixed(1)}× la mejor marca de los demás` : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* La forma de `partida` que escribe cada camino legítimo. */
export function partidaRara(categoria, partida) {
  if (typeof partida !== "string") return "sin partida";
  if (categoria.startsWith("yemas-zombis-")) return /^[-_A-Za-z0-9]{6,40}$/.test(partida) ? null : "partida con forma rara";
  if (categoria.startsWith("club-frontera-")) return /^(frv?-|[-_A-Za-z0-9]+-\d+v?$)/.test(partida) ? null : "partida con forma rara para la Frontera";
  return UUID.test(partida) ? null : "partida que no es un UUID: escrita fuera del juego";
}

/* Las señales de una fila que no piden bajar su prueba. `sospechaFila`
   viene de solo/verifica.js (se pasa para no arrastrar los motores a
   quien no los necesita). Devuelve la lista de motivos, vacía si nada. */
export function senalesFila(categoria, uid, filas, sospechaFila) {
  const fila = filas[uid], motivos = [];
  const rara = partidaRara(categoria, fila && fila.partida);
  if (rara) motivos.push(rara);
  const s = sospechaFila ? sospechaFila(categoria, fila) : null;
  if (s) motivos.push("inverosímil: " + s);
  const a = anomalia(categoria, uid, filas);
  if (a) motivos.push("anómala: " + a);
  return motivos;
}

/* Recorre todas las tablas y junta lo que llama la atención sin bajar
   ninguna prueba. `vetados`: {uid: …}, para marcar quién ya lo está.
   Cada hallazgo: {categoria, uid, nombre, puntos, tiempo, partida,
   vetado, motivos}. */
export function auditaSenales(solo, sospechaFila, vetados = {}, filtro = null) {
  const out = [];
  for (const [categoria, filas] of Object.entries(solo || {})) {
    if (filtro && categoria !== filtro) continue;
    for (const [uid, fila] of Object.entries(filas || {})) {
      if (!fila) continue;
      const motivos = senalesFila(categoria, uid, filas, sospechaFila);
      if (motivos.length) out.push(hallazgo(categoria, uid, fila, motivos, vetados));
    }
  }
  return out;
}

// Un hallazgo con todo lo que el panel y la consola pintan
export const hallazgo = (categoria, uid, fila, motivos, vetados = {}) => ({
  categoria, uid, nombre: fila.nombre, puntos: fila.puntos, tiempo: fila.tiempo,
  partida: fila.partida, vetado: !!(vetados && vetados[uid]), motivos
});

/* La versión de la auditoría. Se sube cuando los verificadores aprenden a
   ver algo nuevo (la forma de jugar: octubre de 2026, v2): lo auditado
   con otra versión vuelve a la cola, salvo lo que un administrador
   revisó a mano (`h`), que ya tiene su veredicto. */
export const AUDITORIA_V = 2;

/* Las filas cuya prueba hay que bajar y verificar: las de un juego con
   verificador (`juegoDe(cat)` no nulo) que nadie auditó todavía con esa
   misma partida y esta versión. Lo auditado es
   `auditados[cat][uid] = {p, ok, m, vv, h}`. */
export function pruebasPendientes(solo, auditados, juegoDe) {
  const out = [];
  for (const [categoria, filas] of Object.entries(solo || {})) {
    const juego = juegoDe(categoria);
    if (!juego) continue;                                                       // Yemas zombis: sin prueba
    for (const [uid, fila] of Object.entries(filas || {})) {
      if (!fila || typeof fila.partida !== "string") continue;
      const a = ((auditados || {})[categoria] || {})[uid];
      if (a && a.p === fila.partida && (a.h || a.vv === AUDITORIA_V)) continue;   // ya auditada esta misma partida
      out.push({ categoria, uid, juego, fila });
    }
  }
  return out;
}

/* Lo que ya se auditó y salió mal, para mostrarlo sin volver a bajar la
   prueba: la fila sigue siendo la misma partida y el veredicto fue malo. */
export function auditadosMalos(solo, auditados, vetados = {}) {
  const out = [];
  for (const [categoria, porUid] of Object.entries(auditados || {}))
    for (const [uid, a] of Object.entries(porUid || {})) {
      const fila = ((solo || {})[categoria] || {})[uid];
      if (!fila || !a || a.ok || a.p !== fila.partida) continue;
      out.push(hallazgo(categoria, uid, fila, ["la prueba no cuadra: " + (a.m || "?")], vetados));
    }
  return out;
}

/* Junta hallazgos de la misma fila (señales + prueba) en uno solo. */
export function juntaHallazgos(...listas) {
  const m = new Map();
  for (const l of listas) for (const h of l || []) {
    const k = h.categoria + "|" + h.uid;                                         // una fila por categoría y cuenta
    const prev = m.get(k);
    if (prev) { for (const x of h.motivos) if (!prev.motivos.includes(x)) prev.motivos.push(x); }
    else m.set(k, Object.assign({}, h, { motivos: h.motivos.slice() }));
  }
  /* Lo más grave primero: la prueba que no cuadra, después lo inverosímil. */
  const peso = h => (h.motivos.some(x => /^la prueba/.test(x)) ? 0 : h.motivos.some(x => /^inverosímil|UUID|forma rara/.test(x)) ? 1 : 2);
  return [...m.values()].sort((a, b) => peso(a) - peso(b) || a.categoria.localeCompare(b.categoria) || a.uid.localeCompare(b.uid));
}

/* ---------- los récords por revisar ----------
   `revisiones/<cat>/<uid>` = {p, pts, t, l, n, at}: la escribe el propio
   jugador al subir al podio (1.º a 3.º) de una tabla del club, y la borra
   el administrador al decidir. Se aplana a una lista, la más nueva arriba,
   y se descarta lo que ya no corresponde a la fila actual (la cuenta
   mejoró otra vez, o la fila se borró). */
export function listaRevisiones(rev, solo) {
  const out = [];
  for (const [categoria, porUid] of Object.entries(rev || {}))
    for (const [uid, r] of Object.entries(porUid || {})) {
      if (!r) continue;
      const fila = ((solo || {})[categoria] || {})[uid];
      out.push({
        categoria, uid, partida: r.p, puntos: r.pts, tiempo: r.t, lugar: r.l, nombre: r.n || (fila && fila.nombre) || "",
        at: r.at || 0,
        vigente: !!(fila && fila.partida === r.p)                                 // ¿la fila sigue siendo esta partida?
      });
    }
  return out.sort((a, b) => b.at - a.at);
}

/* ¿Merece revisión este récord? El mismo criterio que paga el podio:
   una tabla del club, y subir a un puesto del 1 al 3 que antes no tenía. */
export const merecesRevision = (categoria, puesto, previo) =>
  /^club-/.test(String(categoria || "")) && puesto >= 1 && puesto <= 3 && (!previo || puesto < previo);

/* ---------- las suspensiones ---------- */
const UNIDAD = { m: 60000, h: 3600000, d: 86400000, s: 7 * 86400000 };    // minutos, horas, días, semanas
export const SUSPENSION_MAX = 365 * 86400000;                                // un año, como mucho

/* «30m», «2h», «3d», «1s» (semana), o varias juntas («1d 12h»). Devuelve
   los ms, o 0 si no se entiende o se pasa del máximo. */
export function duracionMs(texto) {
  const t = String(texto || "").trim().toLowerCase();
  if (!t) return 0;
  let ms = 0, resto = t;
  const re = /(\d+(?:[.,]\d+)?)\s*([mhds])/g;
  let x;
  while ((x = re.exec(t))) {
    ms += parseFloat(x[1].replace(",", ".")) * UNIDAD[x[2]];                    // número × unidad
    resto = resto.replace(x[0], "");
  }
  if (resto.trim() || !(ms > 0) || ms > SUSPENSION_MAX) return 0;               // sobra texto, o fuera de rango
  return Math.round(ms);
}

/* Lo que falta, legible: «2 d 03:04:05», «03:04:05» o «04:05». */
export function formatoDuracion(ms) {
  if (!(ms > 0)) return "";
  const s = Math.ceil(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600);
  const mm = String(Math.floor(s % 3600 / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
  if (d) return `${d} d ${String(h).padStart(2, "0")}:${mm}:${ss}`;
  return h ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* La duración dicha en palabras, para confirmar: «3 días», «1 día y 12 horas». */
export function duracionTexto(ms) {
  if (!(ms > 0)) return "";
  const partes = [], n = (x, uno, varios) => x ? partes.push(x + " " + (x === 1 ? uno : varios)) : 0;
  let m = Math.round(ms / 60000);                                              // en minutos
  n(Math.floor(m / 1440), "día", "días"); m %= 1440;
  n(Math.floor(m / 60), "hora", "horas"); m %= 60;
  n(m, "minuto", "minutos");
  return partes.length > 1 ? partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1] : partes[0] || "menos de un minuto";
}

/* Hasta cuándo dura una suspensión guardada; 0 si no hay o ya pasó. */
export const suspensionHasta = (v, ahora) =>
  v && Number.isFinite(v.hasta) && v.hasta > ahora ? v.hasta : 0;

/* Las suspensiones en curso, la que termina antes primero. */
export function listaSuspensiones(todas, ahora) {
  return Object.entries(todas || {})
    .filter(([, v]) => suspensionHasta(v, ahora))
    .map(([uid, v]) => ({ uid, hasta: v.hasta, m: v.m || "", por: v.por || "", at: v.at || 0 }))
    .sort((a, b) => a.hasta - b.hasta);
}

/* ---------- los ajustes de monedas ---------- */
export const AJUSTE_MAX = 10000000;   // la regla pide lo mismo

/* ¿Vale esta cantidad? Entera, distinta de cero y dentro del tope. */
export const ajusteValido = n => Number.isInteger(n) && n !== 0 && Math.abs(n) <= AJUSTE_MAX;

/* Lo que suman los ajustes de una cuenta. */
export function sumaAjustes(ajustes, uid) {
  let t = 0;
  for (const a of Object.values(((ajustes || {})[uid]) || {}))
    if (a && Number.isInteger(a.n) && Math.abs(a.n) <= AJUSTE_MAX) t += a.n;     // lo que no cumple la regla no cuenta
  return t;
}

/* Los ajustes de una cuenta, el más nuevo primero. */
export const listaAjustes = (ajustes, uid) =>
  Object.entries(((ajustes || {})[uid]) || {}).map(([id, a]) => Object.assign({ id }, a)).sort((a, b) => (b.at || 0) - (a.at || 0));
