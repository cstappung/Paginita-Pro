import { ES_CLAVE } from "../../../juegos/hero/js/sitio/clave.js";
import { CAT_HERO, decodificaHero, resumenHero, aplicaHero, verificaHero } from "./hero-datos.js";
import { deMarca } from "./logros.js";
import { ambientar } from "./sonido.js";
import { monedasDe, economia, rocasDe, leeCopia } from "./monedas.js";
import { lookVisible, limpiaLook, PRECIO_CAJA, ROCK_SOLO_ADMIN, claveRock } from "./rock-datos.js";

/* PRO HERO — el cartero entre Juegos y el juego (`juegos/hero/`).

   El juego vive entero en su iframe (canvas, audio, mandos, las canciones
   de Firebase Storage) y no escribe nada en la base. Este módulo es el
   único que conoce la cuenta:

   - **Verifica cada canción terminada antes de guardarla.** El juego manda
     la prueba (cada acción con su instante, `juegos/hero/js/game/prueba.js`)
     y los bytes del chart; aquí se vuelve a tocar con el mismo motor y tiene
     que dar exactamente el mismo puntaje y las mismas estrellas. Un puntaje
     editado en la consola, o un bot que acierta todo a la hora exacta, no se
     guarda. Límite honesto: un cliente reescrito puede mandar un chart falso
     o fabricar una prueba válida; eso solo lo cierra un servidor.
   - **Estrellas.** Doradas son las de la dificultad más alta que tiene ese
     instrumento en la canción (Experto casi siempre); las demás, azules. De
     cada canción se guarda la mejor de cada color y el mejor puntaje en
     `heroMias/<uid>/<canción>`; el puntaje, además, en la tabla de la canción
     `heroCanciones/<canción>/<uid>` (el top bajo «Jugar»).
   - **La clasificación general** es una fila del club,
     `soloRanks/club-hero-estrellas/<uid>`: `puntos` = doradas·10 000 +
     Σ máx(doradas, azules) de cada canción (`codificaHero`), así la tabla del
     club ordena por doradas y desempata por azules sin campos nuevos, y el
     número solo sube. `h`/`h5` son las canciones con alguna dorada y con las
     cinco (los logros). Su prueba es el mapa de estrellas por canción.
   - **Monedas**: cada canción terminada es una partida del club
     (`clubJugadas/<uid>/hero`, 50, quince al día); las estrellas las paga la
     fila (monedas.js: 100 la dorada, 50 la azul, y pasar de azul a dorada
     paga la diferencia). */

/* ---------- lo que se comparte entre el juego solo y la sala ----------
   `ponHero(deps)` lo llama juegos-main.js una vez: la cuenta, la base y las
   funciones de la página que ya hacen esto mismo para el club. */
let deps = null;
export function ponHero(d) { deps = d; }

let miasCache = null, miasDe = "";
const tops = new Map();     // clave → Promise<filas> (en esta visita)
let cola = Promise.resolve();

function misEstrellas() {
  const u = deps?.usuario();
  if (!u) return Promise.resolve({});
  if (miasDe !== u.uid || !miasCache) {
    miasDe = u.uid;
    miasCache = deps.fb.leerHeroMias(u.uid).catch(e => { miasCache = null; throw e; });
  }
  return miasCache;
}
const limpiaMias = m => Object.fromEntries(Object.entries(m || {}).filter(([k]) => ES_CLAVE.test(k))
  .map(([k, v]) => [k, { g: Math.min(5, v?.g | 0), b: Math.min(5, v?.b | 0), s: Math.max(0, v?.s | 0) }]));

function filasTop(k) {
  if (!tops.has(k)) tops.set(k, deps.fb.leerHeroTop(k).catch(e => { tops.delete(k); throw e; }));
  return tops.get(k);
}
function topParaJuego(filas) {
  const yo = deps.usuario()?.uid;
  return filas.slice().sort((a, b) => (b.s | 0) - (a.s | 0) || String(a.uid).localeCompare(String(b.uid))).slice(0, 10)
    .map(f => ({ nombre: deps.nombreVivo ? deps.nombreVivo(f.uid, f.n) : f.n, s: f.s | 0, e: f.e | 0, oro: f.o === 1, p: f.p, d: f.d, yo: f.uid === yo }));
}

/* Lo que se le responde al juego a cada pedido (el del modo solo y el de la sala). */
export function atiendeHero(tipo, d, responde) {
  if (!deps) return false;
  if (tipo === "top-pedir") {
    const k = String(d.k || "");
    if (!ES_CLAVE.test(k)) return true;
    filasTop(k).then(f => responde("top", { k, filas: topParaJuego(f) }), () => responde("top", { k, filas: [], error: true }));
    return true;
  }
  if (tipo === "ranking-pedir") {
    deps.fb.leerSolo(CAT_HERO).then(filas => {
      const yo = deps.usuario()?.uid;
      const orden = filas.slice().sort((a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo || a.uid.localeCompare(b.uid));
      const fila = (f, i) => { const x = decodificaHero(f.puntos); return { puesto: i + 1, nombre: deps.nombreVivo ? deps.nombreVivo(f.uid, f.nombre) : f.nombre, g: x.g, m: x.m, h: f.h | 0, h5: f.h5 | 0, yo: f.uid === yo }; };
      const i = orden.findIndex(f => f.uid === yo);
      responde("ranking", { filas: orden.slice(0, 50).map(fila), propio: i >= 50 ? fila(orden[i], i) : null });
    }, () => responde("ranking", { filas: [], error: true }));
    return true;
  }
  if (tipo === "resultado") {
    cola = cola.then(() => guardaResultado(d, responde)).catch(e => console.warn("[hero] no se pudo guardar", e));
    return true;
  }
  return false;
}

/* Las estrellas de la cuenta, para pintar la lista de canciones. */
export function mandaCuenta(responde) {
  const u = deps?.usuario();
  if (!u) { responde("cuenta", { cuenta: null, mias: {} }); return; }
  misEstrellas().then(m => responde("cuenta", { cuenta: { uid: u.uid, nombre: u.name }, mias: limpiaMias(m) }),
    () => responde("cuenta", { cuenta: { uid: u.uid, nombre: u.name }, mias: {} }));
}

async function guardaResultado(d, responde) {
  const u = deps.usuario();
  if (!u) return;
  let v;
  try { v = verificaHero(d); }
  catch (err) {
    const motivo = String(err && err.message || err).slice(0, 200);
    console.warn("[hero] partida rechazada", motivo);
    responde("veredicto", { ok: false, motivo });
    deps.sospecha?.({ c: CAT_HERO, m: motivo, p: d?.stats?.score | 0, t: 1, d: "en vivo", vivo: false });
    return;
  }
  // terminar una canción paga (partida del club, quince al día)
  const pagada = await deps.marcaJugadaClub("hero", { silencio: true }).catch(() => 0);
  const mias = Object.assign({}, limpiaMias(await misEstrellas().catch(() => ({}))));
  const a = aplicaHero(mias[v.k], v);
  let guardada = false;
  if (a.cambia) {
    const fila = a.record ? { n: String(u.name || "Jugador").slice(0, 80), s: v.score, e: v.estrellas, o: v.oro ? 1 : 0, p: v.p, d: v.d, m: v.m } : null;
    try {
      await deps.fb.guardaHero(v.k, u.uid, a.nuevo, fila);
      guardada = true;
      mias[v.k] = a.nuevo;
      miasCache = Promise.resolve(mias);
      if (fila && tops.has(v.k)) {
        const t = (await tops.get(v.k).catch(() => [])).filter(f => f.uid !== u.uid).concat([{ ...fila, uid: u.uid }]);
        tops.set(v.k, Promise.resolve(t));
        responde("top", { k: v.k, filas: topParaJuego(t) });
      }
      responde("mias", { mias: limpiaMias(mias) });
    } catch (err) {
      console.warn("[hero] no se pudo guardar la canción", err);
      responde("veredicto", { ok: false, motivo: /permission/i.test(String(err && (err.code || err.message))) ? "La base todavía no acepta PRO HERO: faltan publicar las reglas de Firebase." : "No se pudo guardar; revisa tu conexión." });
      return;
    }
  }
  responde("veredicto", { ok: true, guardada, record: a.record && guardada, oro: guardada ? a.oro : 0, azul: guardada ? a.azul : 0, maxima: v.oro,
    monedasCancion: pagada || 0, monedasEstrellas: guardada ? a.monedas : 0, tope: !pagada });
  await subeResumen(u, mias);
}

/* La fila de la clasificación general: se reescribe solo si sube. Si la
   anterior no se pudo escribir (reglas sin publicar, sin red) se vuelve a
   intentar en la próxima canción, porque sale siempre de todas tus estrellas. */
async function subeResumen(u, mias) {
  const r = resumenHero(mias);
  if (r.puntos <= 0) return;
  const previa = await deps.fb.leerSolo(CAT_HERO).then(f => f.find(x => x.uid === u.uid) || null, () => null);
  if (previa && previa.puntos >= r.puntos) return;
  const partida = crypto.randomUUID();
  const prueba = { v: 1, c: Object.fromEntries(Object.entries(mias).filter(([, x]) => x.g || x.b).map(([k, x]) => [k, [x.g, x.b]])) };
  const dato = { nombre: String(u.name || "Jugador").slice(0, 80), puntos: r.puntos, tiempo: 1, partida, h: r.h, h5: r.h5 };
  try {
    await deps.guardaClub(CAT_HERO, u.uid, dato, prueba);
    const antes = new Set(previa ? deMarca("hero", Object.assign({ categoria: CAT_HERO }, previa)) : []);
    for (const id of deMarca("hero", Object.assign({ categoria: CAT_HERO }, dato))) if (!antes.has(id)) deps.celebra("hero", id);
  } catch (err) { console.warn("[hero] no se pudo subir la clasificación", err); }
}

/* ---------- Batalla de Rock (el fondo de PRO HERO; a prueba, solo administradores) ----------
   El juego no escribe nada: pide y aquí se comprueba contra la economía completa y se escribe
   (rock-datos.js). Se le manda `rock` = {admin, inv, look, looks} cada vez que la economía cambia:
   - `inv`: el saldo y las piezas de la cuenta (las de cajas, con su copia y si están a la venta);
   - `look`: tu rockero guardado (`rockLook/<uid>`), limpio y solo con lo que tienes y no vendes;
   - `looks`: los de los demás de la sala, leídos por clave, comprobados contra lo de cada uno.
   Un jugador que no es administrador no recibe nada, así que en su juego no existe. */
const adminDe = new Map();
function esAdminRock() {
  const u = deps?.usuario();
  if (!u) return Promise.resolve(false);
  if (!ROCK_SOLO_ADMIN || deps.esAdmin?.()) return Promise.resolve(true);
  if (!adminDe.has(u.uid)) adminDe.set(u.uid, deps.fb.esAdminJuegos(u.uid).catch(() => false));
  return adminDe.get(u.uid);
}
const MAX_PRECIO = 100000;
export function crearRockHero(enviar) {
  let d = null, off = null, crudo = null, activo = false, muerto = false, cola = Promise.resolve();
  const looks = {}, leyendo = new Set();
  const yo = () => deps?.usuario()?.uid || "";
  const eco = () => economia(d);
  /* lo que alguien puede ponerle a su rockero: lo suyo que no está a la venta */
  const propias = u => rocasDe(u, d).filter(x => !x.venta).map(x => ({ b: x.b, k: x.k, t: x.t, c: x.colores }));
  function inv() {
    const u = yo(), m = monedasDe(u, d), cajas = (eco().usuarios[u] || {}).cajasRock || [];
    return { coins: m.saldo, parada: m.parada, opened: cajas.length, last: cajas.slice(-10).reverse().map(z => z.v),
      own: rocasDe(u, d).map(x => ({ b: x.b, k: x.k, t: x.t, c: x.colores, leg: x.leg, copia: x.c, venta: x.venta || "" })) };
  }
  function manda() {
    if (!activo || muerto || !d || !d.completo) return;
    const lks = {};
    for (const [u, l] of Object.entries(looks)) lks[u] = l ? lookVisible(l, propias(u)) : null;
    enviar("rock", { admin: true, inv: inv(), look: crudo ? lookVisible(crudo, propias(yo())) : null, looks: lks });
  }
  async function inicia() {
    if (activo || muerto || !(await esAdminRock()) || muerto) return;
    activo = true;
    crudo = await deps.fb.leeRockLook(yo()).catch(() => null);
    off = deps.datos(x => { d = x; manda(); });
  }
  /* los rockeros de los demás de la sala (una lectura por cuenta y visita) */
  function ponLooks(uids) {
    if (!activo) return;
    for (const u of uids) {
      if (!u || u === yo() || leyendo.has(u)) continue;
      leyendo.add(u);
      deps.fb.leeRockLook(u).then(l => { looks[u] = l || null; manda(); });
    }
  }
  /* lo escrito tarda un instante en volver por la escucha: se espera a que la economía lo vea */
  async function esperaEco(ve, ms = 5000) {
    for (let t = 0; t < ms; t += 100) {
      const r = d && ve(eco());
      if (r) return r;
      await new Promise(ok => setTimeout(ok, 100));
    }
    return d && ve(eco());
  }
  function atiende(x) {
    const responde = (ok, dato, error) => enviar("rock-resp", { id: x.id, ok, dato, error });
    cola = cola.then(async () => {
      try {
        if (!activo) throw new Error("Batalla de Rock está a prueba: solo para administradores.");
        if (!d || !d.completo) throw new Error("Todavía se está cargando tu cuenta.");
        const u = yo(), m = monedasDe(u, d);
        if (x.accion === "caja") {
          const b = x.b === "f" ? "f" : "m";
          if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.");
          if (m.saldo < PRECIO_CAJA) throw new Error(`Una caja cuesta ${PRECIO_CAJA}: te faltan ${(PRECIO_CAJA - m.saldo).toLocaleString("es-CL")} monedas.`);
          const r = await deps.fb.comprarCajaRock(u, b);
          const caja = await esperaEco(z => ((z.usuarios[u] || {}).cajasRock || []).find(c => c.k === r.k));
          if (!caja) throw new Error("La caja no valió: otra pestaña gastó tus monedas a la vez.");
          manda();
          responde(true, { v: caja.v, dup: caja.dup, refund: caja.reembolso, c: caja.c || claveRock(u, r.k) });
        } else if (x.accion === "guarda") {
          const L = limpiaLook(x.look);
          if (!L) throw new Error("Ese rockero no se puede guardar.");
          const json = JSON.stringify(L);
          if (json.length > 4000) throw new Error("Ese rockero es demasiado grande para guardarlo.");
          await deps.fb.guardaRockLook(u, json);
          crudo = json;
          manda();
          responde(true, lookVisible(json, propias(u)));
        } else if (x.accion === "vende") {
          const p = Math.round(+x.p), q = leeCopia(x.c), e = eco();
          if (!q || q.tipo !== "rock" || e.dueno[x.c] !== u) throw new Error("Eso no es tuyo.");
          if (e.enVenta[x.c]) throw new Error("Ya está a la venta.");
          if (!(p >= 1 && p <= MAX_PRECIO)) throw new Error(`El precio va de 1 a ${MAX_PRECIO.toLocaleString("es-CL")} monedas.`);
          if (m.parada) throw new Error("Tu cuenta tiene una compra sin fondos: no puedes vender hasta ponerte al día.");
          const id = await deps.fb.publicarOferta(u, x.c, p);
          const fin = await esperaEco(z => z.ofertas[id]);
          if (fin && fin.estado !== "activa") {
            await deps.fb.retirarOferta(id).catch(() => {});
            throw new Error("Eso ya está a la venta o dejó de ser tuyo.");
          }
          manda();
          responde(true, id);
        } else if (x.accion === "mercado") {
          deps.ir?.("#mercado/rock");
          responde(true, null);
        } else throw new Error("Petición desconocida.");
      } catch (err) {
        const permiso = /permission|denied/i.test((err && (err.code || err.message)) || "");
        responde(false, null, permiso
          ? "La base todavía no acepta Batalla de Rock: falta publicar las reglas nuevas en la consola de Firebase."
          : (err && err.message) || "No se pudo.");
      }
    });
  }
  function destruir() { muerto = true; if (off) off(); off = null; }
  return { inicia, atiende, ponLooks, destruir };
}

/* ---------- el juego solo (la tarjeta del club, a ventana completa) ---------- */
const PADRE = "hero-padre", HIJO = "hero-hijo";
export function crearHero({ volver, enLinea }) {
  let host, frame, temaObs, muerto = false;
  const enviar = (tipo, datos = {}) => { if (!muerto) frame?.contentWindow?.postMessage({ canal: PADRE, tipo, ...datos }, location.origin); };
  const rock = crearRockHero(enviar);
  const tema = () => enviar("tema", { oscuro: document.documentElement.dataset.tema === "oscuro" });
  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { tema(); mandaCuenta(enviar); rock.inicia(); return; }
    if (d.tipo === "rock-pide") { rock.atiende(d); return; }
    if (d.tipo === "volver") { volver(); return; }
    if (d.tipo === "en-linea") { enLinea(); return; }
    atiendeHero(d.tipo, d, enviar);
  }
  function montar(el) {
    host = el; host.innerHTML = "";
    ambientar(null);   // la música es la de la canción
    frame = document.createElement("iframe");
    frame.title = "PRO HERO";
    frame.className = "jg-hero-frame";
    frame.allow = "autoplay; gamepad; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    temaObs = new MutationObserver(tema);
    temaObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    frame.src = "juegos/hero/index.html?v=hero-12";
    host.appendChild(frame);
    frame.addEventListener("load", () => frame.contentWindow?.focus());
  }
  function destruir() {
    muerto = true;
    rock.destruir();
    temaObs?.disconnect();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
    ambientar("");
  }
  return { montar, destruir };
}
