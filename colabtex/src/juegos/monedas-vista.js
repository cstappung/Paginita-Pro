/* Monedas — lo que se pinta: la caja del top en el vestíbulo y la
   pestaña #monedas (tu saldo, de dónde sale, el top entero y la tabla de
   tarifas). El cálculo es de monedas.js; aquí solo se dibuja. */
import { juegoOculto } from "./ocultos.js";
import { JUEGOS } from "./motor.js";
import { avatarMarco, quien, marcoDeUid } from "./perfil-vista.js";
import {
  topMonedas, monedasDe, formatoMonedas, TARIFA, PESO, VALOR_NIVEL, NOMBRE_NIVEL,
  RECORD, diaChile, rachaHoy, pagoDia, PAGO_DIA, TOPE_DIA, PAGO_CLUB, TOPE_CLUB_DIA, TOPE_BBTAN_DIA, PODIO
} from "./monedas.js";
import { MOTOR } from "./prodrop-cartas.js";
import { TIENDA, PRECIO_TIENDA } from "./tienda.js";
import { PREMIO_REFERIDO } from "./referidos.js";
import { nombreHtml } from "./tintas.js";

/* La moneda se dibuja: el emoji de la moneda es de 2020 y en Windows 10 y en
   navegadores viejos sale como un cuadro vacío. */
export const MONEDA = '<svg class="jg-moneda" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f5b819" stroke="#9a6a08" stroke-width="1.6"/><circle cx="10" cy="10" r="5.6" fill="#ffd54a" stroke="#c98d10" stroke-width="1.2"/><path d="M8.6 7.2v5.6M11.4 7.2v5.6" stroke="#9a6a08" stroke-width="1.4" stroke-linecap="round"/><path d="M5.2 6.4a6.2 6.2 0 0 1 3.6-2.5" stroke="#fff7d6" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOMBRES_CLUB = { minas: "Mina Club", snake: "Snake Club", tetrisclub: "Tetris Club", sortem: "sortEm", bbtan: "BBTAN", sopa: "Sopa de letras", electro: "Electrodle", frontera: "Frontera Batalla", sudoku: "Sudoku Arcade", fanal: "FANAL", atasco: "Atasco", aleteo: "ALETEO", dosmil: "2048", trigon: "Trigon", protiles: "PRO TILES", pokelike: "Pokelike", metrorush: "Metro Rush", hero: "PRO HERO", prodefender: "PRO DEFENDER", propac: "PRO PACMAN" };
const PARTES = [
  ["partidas", "🎮", "Partidas", `${TARIFA.partida} por partida de sala, por el peso del juego`],
  ["victorias", "🏆", "Victorias", `${TARIFA.victoria} por victoria y ${TARIFA.empate} por empate, por el peso`],
  ["records", "📈", "Récords", "una vez por modalidad del club con marca"],
  ["club", "🕹️", "Partidas del club", `de 15 a 25 por partida, hasta ${TOPE_CLUB_DIA} al día por juego`],
  ["podios", "👑", "Podios", "500 · 250 · 100 por quitarle el puesto a alguien"],
  ["logros", "🎖️", "Logros", "15 · 40 · 100 · 250 según dificultad"],
  ["dias", "🔥", "Recompensa diaria", `${pagoDia(1)} el primer día, +${PAGO_DIA} por día seguido hasta ${pagoDia(TOPE_DIA)}`],
  ["referidos", "🤝", "Referidos", "5000 por el código que usaste y 5000 por cada persona que usó el tuyo"],
  ["ajustes", "🛡️", "Ajustes", "lo que un administrador sumó o restó a mano"]
];

/* ---------- el detalle de tus monedas ---------- */
const NOMBRES_CASINO = { a: "el Avión", p: "el Pingüinito", r: "la Ruleta", b: "el Blackjack", v: "el Póker", l: "el Plinko" };
const nombreJuego = j => (JUEGOS[j] && JUEGOS[j].nombre) || NOMBRES_CLUB[j] || (j === "otros" ? "Otros" : j);
const pct = (a, b) => (b > 0 ? Math.round(100 * a / b) : 0);
const signo = n => (n > 0 ? "+" : n < 0 ? "−" : "") + formatoMonedas(Math.abs(n));
/* Una lista de barras: [{i, t, n, s?}] de mayor a menor; la barra es
   relativa a la mayor y el % al total. */
function barras(l, total, clase = "") {
  const max = Math.max(1, ...l.map(x => x.n));
  return `<ul class="jg-mo-barras ${clase}">${l.map(x => `<li${x.n ? "" : ' class="cero"'}>
    <span class="i">${x.i}</span><span class="t"><b>${x.t}</b>${x.s ? `<small>${x.s}</small>` : ""}</span>
    <span class="v"><b>${formatoMonedas(x.n)}</b><small>${pct(x.n, total)} %</small></span>
    <i class="b"><i style="width:${Math.max(x.n ? 2 : 0, Math.round(100 * x.n / max))}%"></i></i></li>`).join("")}</ul>`;
}
/* Lo que más paga, por cada vez: para saber dónde conviene jugar. */
function loQueMasPaga() {
  const salaTop = Object.keys(PESO).filter(j => !juegoOculto(j)).sort((a, b) => PESO[b] - PESO[a])[0];
  const recTop = Object.entries(RECORD).sort((a, b) => b[1] - a[1])[0];
  const clubTop = Object.entries(PAGO_CLUB).sort((a, b) => b[1] - a[1])[0];
  return [
    { i: "🤝", t: "Traer a alguien con tu código", s: "y otras tantas para quien entra", n: PREMIO_REFERIDO },
    { i: "🔥", t: "Recompensa diaria", s: `desde el ${TOPE_DIA}.º día seguido`, n: pagoDia(TOPE_DIA) },
    { i: "👑", t: "Quitarle el 1.er puesto a alguien", s: `en una tabla del club · 2.º ${PODIO[2]}, 3.º ${PODIO[3]}`, n: PODIO[1] },
    { i: "🎖️", t: "Un logro legendario", s: `difícil ${VALOR_NIVEL[3]}, medio ${VALOR_NIVEL[2]}, fácil ${VALOR_NIVEL[1]}`, n: VALOR_NIVEL[4] },
    { i: "🏆", t: `Ganar una partida de ${nombreJuego(salaTop)}`, s: `el juego de sala que más pesa (×${PESO[salaTop]})`, n: (TARIFA.partida + TARIFA.victoria) * PESO[salaTop] },
    { i: "📈", t: `Tu primer récord en ${nombreJuego(recTop[0])}`, s: "una vez por modalidad", n: recTop[1] },
    { i: "🕹️", t: `Una partida de ${nombreJuego(clubTop[0])}`, s: `la partida del club que más paga · hasta ${TOPE_CLUB_DIA} al día`, n: clubTop[1] }
  ].sort((a, b) => b.n - a.n);
}
/* Cada movimiento con hora, del más nuevo al más viejo; las apuestas
   seguidas en un mismo juego del casino van en una sola fila. */
function movimientosHtml(movs) {
  const l = movs.slice().sort((a, b) => b.at - a.at), filas = [];
  for (const m of l) {
    const casino = m.c === "apuesta" || m.c === "premio", ult = filas[filas.length - 1];
    if (casino && ult && ult.casino && ult.d === m.d && ult.desde - m.at < 3 * 3600 * 1000) {
      ult.n += m.p; ult.desde = m.at; if (m.c === "apuesta") ult.ap++; else ult.pr += m.p; continue;
    }
    if (filas.length >= 30) break;
    filas.push({ at: m.at, desde: m.at, c: m.c, d: m.d, n: m.p, casino, ap: m.c === "apuesta" ? 1 : 0, pr: m.c === "premio" ? m.p : 0 });
  }
  if (!filas.length) return `<p class="jg-nada">Todavía no has gastado ni cobrado nada. Lo que compres en PRODROP, la tienda, Mascotas, el mercado o el casino aparecerá aquí.</p>`;
  const tipo = { carta: "una carta", mascota: "una mascota", objeto: "un objeto" };
  const texto = f => ({
    sobre: ["🃏", "Sobre de PRODROP"], graduar: ["⭐", "Graduaste una carta"], adopcion: ["🐣", "Adoptaste una mascota"],
    regalo: ["🎁", "Regalo de Mascotas"], comida: ["🍖", `Comida para tus mascotas${f.d ? ` ×${f.d}` : ""}`], pocion: ["🧪", "Poción para una mascota"],
    fondoMascota: ["🏞️", "Fondo para tus mascotas"], mercado: ["🛒", `Compraste ${tipo[f.d] || "algo"} en el mercado`],
    venta: ["💰", `Vendiste ${tipo[f.d] || "algo"} en el mercado`], tienda: ["🛍️", `Tienda del perfil · ${TIENDA[f.d] === "marco" ? "marco" : "fondo"} «${f.d}»`]
  }[f.c] || ["🪙", f.c]);
  const cuando = at => new Date(at).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `<ul class="jg-mo-movs">${filas.map(f => {
    const [i, t] = f.casino ? ["🎰", `${f.ap ? `${f.ap} ${f.ap === 1 ? "apuesta" : "apuestas"} en ${NOMBRES_CASINO[f.d] || "el casino"}` : `Premio en ${NOMBRES_CASINO[f.d] || "el casino"}`}${f.ap && f.pr ? ` · premios +${formatoMonedas(f.pr)}` : ""}`] : texto(f);
    return `<li><span class="i">${i}</span><span class="t"><b>${t}</b><small>${cuando(f.at)}</small></span><b class="n ${f.n >= 0 ? "mas" : "menos"}">${signo(f.n)}</b></li>`;
  }).join("")}</ul>`;
}
function detalleHtml(yo) {
  const P = yo.partes, entra = yo.total + yo.cobradas + yo.premios, sale = yo.gastadas;
  const g = yo.gasto || {}, n = yo.cuenta || {}, cas = yo.casino || { apostado: 0, pagado: 0, rondas: 0, porJuego: {} };
  const ventas = (yo.movs || []).filter(m => m.c === "venta"), nVentas = ventas.length;
  /* De dónde salen */
  const fuentes = [
    ...PARTES.filter(([k]) => k !== "ajustes" || P.ajustes).map(([k, i, t, s]) => ({ i, t, s, n: Math.max(0, P[k] || 0) })),
    { i: "💰", t: "Ventas en el mercado", s: `${nVentas} ${nVentas === 1 ? "venta" : "ventas"}`, n: yo.cobradas || 0 },
    { i: "🎰", t: "Premios del casino", s: "lo que te pagaron las apuestas ganadas", n: yo.premios || 0 }
  ].sort((a, b) => b.n - a.n);
  /* Por juego */
  const juegos = Object.entries(yo.porJuego || {}).filter(([j]) => !juegoOculto(j))
    .map(([j, x]) => ({ j, x, n: Object.values(x).reduce((a, b) => a + b, 0) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const ETQ = { partidas: "partidas", victorias: "victorias", records: "récords", club: "partidas del club", podios: "podios", logros: "logros" };
  const desglose = x => Object.entries(ETQ).filter(([k]) => x[k]).map(([k, t]) => `${t} ${formatoMonedas(x[k])}`).join(" · ");
  const totalJuegos = juegos.reduce((a, b) => a + b.n, 0);
  /* En qué gastaste */
  const veces = (k, uno, varios) => n[k] ? `${n[k]} ${n[k] === 1 ? uno : varios}` : "";
  const grupos = [
    { i: "🃏", t: "PRODROP", ir: "#cartas", n: (g.sobre || 0) + (g.graduar || 0),
      s: [veces("sobre", "sobre", "sobres"), veces("graduar", "graduación", "graduaciones"), n.sobreGratis ? `${n.sobreGratis} gratis` : ""].filter(Boolean).join(" · ") },
    { i: "🎰", t: "Casino · apuestas", ir: "#casino", n: g.apuesta || 0,
      s: cas.rondas ? `${cas.rondas} ${cas.rondas === 1 ? "ronda" : "rondas"} · te devolvió ${formatoMonedas(cas.pagado)} · neto ${signo(Math.round(cas.pagado - cas.apostado))}` : "" },
    { i: "🐾", t: "Mascotas", ir: "#mascotas", n: (g.adopcion || 0) + (g.regalo || 0) + (g.comida || 0) + (g.pocion || 0) + (g.fondoMascota || 0),
      s: [veces("adopcion", "adopción", "adopciones"), veces("regalo", "regalo", "regalos"), veces("comida", "compra de comida", "compras de comida"), veces("pocion", "poción", "pociones"), veces("fondoMascota", "fondo", "fondos")].filter(Boolean).join(" · ") },
    { i: "🛍️", t: "Tienda del perfil", n: g.tienda || 0, s: veces("tienda", `artículo (${formatoMonedas(PRECIO_TIENDA)} c/u)`, `artículos (${formatoMonedas(PRECIO_TIENDA)} c/u)`) },
    { i: "🎱", t: "Pool · cofres de tacos", n: g.cofre || 0, s: veces("cofre", "cofre", "cofres") },
    { i: "🛒", t: "Compras en el mercado", ir: "#mercado", n: g.mercado || 0, s: veces("mercado", "compra", "compras") }
  ].sort((a, b) => b.n - a.n);
  const casino = Object.entries(cas.porJuego || {}).filter(([, z]) => z.rondas || z.apostado)
    .map(([j, z]) => ({ j, z, neto: Math.round(z.pagado - z.apostado) })).sort((a, b) => b.z.apostado - a.z.apostado);
  return `
    <div class="jg-mo-balance">
      <div><small>Entraron</small><b class="mas">+${formatoMonedas(entra)}</b></div>
      <div class="jg-mo-bal-barra" aria-hidden="true"><i class="mas" style="flex:${Math.max(1, entra)}"></i><i class="menos" style="flex:${Math.max(sale ? 1 : 0, sale)}"></i></div>
      <div><small>Salieron</small><b class="menos">−${formatoMonedas(sale)}</b></div>
      <div><small>Te quedan</small><b>${formatoMonedas(yo.saldo)} ${MONEDA}</b></div>
    </div>
    <div class="jg-mo-cols jg-mo-det">
      <section class="jg-mo-caja"><h2>📊 De dónde salen tus monedas</h2>
        <p class="jg-mo-nota">Todo lo que te ha entrado, de la fuente que más te dio a la que menos. El % es sobre ${formatoMonedas(entra)}.</p>
        ${barras(fuentes, entra)}
      </section>
      <section class="jg-mo-caja"><h2>🎮 Los juegos que más te han pagado</h2>
        ${juegos.length ? `<p class="jg-mo-nota">Partidas, victorias, récords, logros y podios de cada juego. Lo diario, los referidos y lo del mercado o el casino no son de un juego y no salen aquí.</p>
          ${barras(juegos.slice(0, 10).map(x => ({ i: "", t: esc(nombreJuego(x.j)), s: desglose(x.x), n: x.n })), totalJuegos, "juegos")}
          ${juegos.length > 10 ? `<details class="jg-mo-mas"><summary>Ver los ${juegos.length} juegos</summary>${barras(juegos.slice(10).map(x => ({ i: "", t: esc(nombreJuego(x.j)), s: desglose(x.x), n: x.n })), totalJuegos, "juegos")}</details>` : ""}`
          : `<p class="jg-nada">Todavía no te ha pagado ningún juego. ¡Juega una partida!</p>`}
      </section>
      <section class="jg-mo-caja"><h2>🛒 En qué gastaste</h2>
        ${sale ? `<p class="jg-mo-nota">${formatoMonedas(sale)} monedas en total. El % es sobre eso.</p>
          ${barras(grupos.map(x => ({ i: x.i, t: x.ir ? `<a href="${x.ir}">${x.t}</a>` : x.t, s: x.s, n: x.n })), sale, "gastos")}`
          : `<p class="jg-nada">No has gastado nada todavía.</p>`}
        ${casino.length ? `<h3>🎰 Tus apuestas, juego por juego</h3>
          <table class="jg-mo-casino"><thead><tr><th>Juego</th><th>Rondas</th><th>Apostado</th><th>Premios</th><th>Neto</th></tr></thead><tbody>
          ${casino.map(({ j, z, neto }) => `<tr><td>${esc((NOMBRES_CASINO[j] || j).replace(/^(el|la) /, "").replace(/^./, c => c.toUpperCase()))}</td><td>${z.rondas}</td><td>${formatoMonedas(z.apostado)}</td><td>${formatoMonedas(z.pagado)}</td><td class="${neto >= 0 ? "mas" : "menos"}">${signo(neto)}</td></tr>`).join("")}
          </tbody></table>` : ""}
      </section>
      <section class="jg-mo-caja"><h2>🧾 Tus movimientos recientes</h2>
        <p class="jg-mo-nota">Lo que gastaste y cobraste, del más nuevo al más viejo.</p>
        ${movimientosHtml(yo.movs || [])}
      </section>
    </div>
    <section class="jg-mo-caja jg-mo-paga"><h2>💡 Lo que más paga, cada vez</h2>
      <div class="jg-mo-paga-l">${loQueMasPaga().map(x => `<div><span class="i">${x.i}</span><b>${formatoMonedas(x.n)} ${MONEDA}</b><span>${esc(x.t)}</span><small>${esc(x.s)}</small></div>`).join("")}</div>
    </section>`;
}

function fila(f, i, uid, perfil, colorDe, chico, datos) {
  const q = quien(f.uid, perfil(f.uid), null, { nombre: f.nombre, foto: f.foto }, colorDe);
  const med = i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1);
  return `<li class="${f.uid === uid ? "jg-yo" : ""}"><b class="jg-mo-pos">${med}</b>${avatarMarco(q.foto, q.nombre, q.color, marcoDeUid(f.uid, perfil(f.uid), datos), chico ? 26 : 34, f.uid)}
    <span class="jg-mo-nom" data-perfil="${esc(f.uid)}" data-nombre="${esc(q.nombre)}" translate="no">${nombreHtml(f.uid, esc(q.nombre))}</span>
    <strong class="jg-mo-cant">${formatoMonedas(f.saldo)} ${MONEDA}</strong></li>`;
}

/* La caja del vestíbulo: los cinco primeros y, si no estás, tu puesto. */
export function topHtml(datos, uid, perfil, colorDe) {
  const lista = topMonedas(datos), mio = lista.findIndex(f => f.uid === uid);
  const racha = rachaHtml((datos.diario || {})[uid], diaChile());
  if (!lista.length) return racha + `<p class="jg-nada">Nadie tiene monedas todavía. Termina una partida y estrena el top.</p>`;
  let html = racha + `<ol class="jg-mo-top chico">${lista.slice(0, 5).map((f, i) => fila(f, i, uid, perfil, colorDe, true, datos)).join("")}</ol>`;
  if (mio >= 5) html += `<ol class="jg-mo-top chico jg-mo-tuyo" start="${mio + 1}">${fila(lista[mio], mio, uid, perfil, colorDe, true, datos)}</ol>`;
  return html + `<a class="jg-mo-ver" href="#monedas">Ver el top y cómo se ganan →</a>`;
}

/* La recompensa diaria, bien a la vista en el vestíbulo, sobre el top: un
   botón que se aprieta una vez por día de Chile. Paga 250 el primer día de
   racha y 250 más por cada día seguido, hasta 1000 desde el cuarto. Los
   cuatro peldaños se ven, encendidos los que ya llevas. El clic lo atiende
   juegos-main.js (`data-reclama-dia`). */
export function rachaHtml(d, hoy) {
  const r = rachaHoy(d, hoy), contado = !!(d && d.dia === hoy);
  const sig = contado ? r : r + 1;   // el día de racha que se cobra (o se cobró) hoy
  const pelda = Array.from({ length: TOPE_DIA }, (_, i) => {
    const n = i + 1, on = n <= Math.min(r, TOPE_DIA), hoyEs = !contado && n === Math.min(sig, TOPE_DIA);
    return `<i class="${on ? "on" : ""}${hoyEs ? " hoy" : ""}">${formatoMonedas(pagoDia(n))}</i>`;
  }).join("");
  const titulo = r ? `${r} ${r === 1 ? "día seguido" : "días seguidos"}` : "Recompensa diaria";
  const sub = contado ? `Mañana +${formatoMonedas(pagoDia(r + 1))} ${MONEDA} si vuelves`
    : r ? `¡Reclámala hoy para no perder la racha!`
    : `Cada día seguido paga ${PAGO_DIA} más, hasta ${formatoMonedas(pagoDia(TOPE_DIA))}`;
  const boton = contado
    ? `<button type="button" class="jg-racha-btn hecho" disabled>✓ Cobrada hoy · +${formatoMonedas(pagoDia(r))}</button>`
    : `<button type="button" class="jg-racha-btn" data-reclama-dia>Reclamar +${formatoMonedas(pagoDia(sig))} ${MONEDA}</button>`;
  return `<div class="jg-racha${contado ? " lista" : r ? " peligro" : ""}" title="Un clic al día. Cada día seguido paga más, hasta ${formatoMonedas(pagoDia(TOPE_DIA))} por día">
    <span class="jg-racha-fuego" aria-hidden="true">🔥</span>
    <span class="jg-racha-tx"><b>${titulo}</b><small>${sub}</small></span>
    ${boton}
    <span class="jg-racha-dias" aria-hidden="true">${pelda}</span></div>`;
}

export function crearMonedas({ uid, datos, perfil, colorDe }) {
  let host = null, off = null, ultimo = null;
  function pinta() {
    if (!host) return;
    if (!ultimo) { host.innerHTML = `<section class="jg-mo"><p class="jg-nada">Contando monedas…</p></section>`; return; }
    const lista = topMonedas(ultimo), yo = monedasDe(uid, ultimo), puesto = lista.findIndex(f => f.uid === uid) + 1;
    const hoy = diaChile(), d = (ultimo.diario || {})[uid];
    const juegos = Object.keys(PESO).filter(j => !juegoOculto(j)).sort((a, b) => PESO[b] - PESO[a] || a.localeCompare(b));
    host.innerHTML = `<section class="jg-mo">
      <header class="jg-mo-hero">
        <div><small>TUS MONEDAS</small><strong>${formatoMonedas(yo.saldo)} ${MONEDA}</strong>
          <p>${puesto ? `Puesto <b>${puesto}</b> de ${lista.length}` : "Todavía fuera del top"} · ${yo.logros} logros</p>
          ${yo.gastadas || yo.cobradas || yo.premios ? `<p class="jg-mo-gasto">Ganadas <b>${formatoMonedas(yo.total)}</b>${yo.cobradas ? ` · cobradas en el mercado <b>${formatoMonedas(yo.cobradas)}</b>` : ""}${yo.premios ? ` · premios del casino <b>${formatoMonedas(yo.premios)}</b>` : ""} · gastadas en PRODROP, la tienda, mascotas y apuestas <b>${formatoMonedas(yo.gastadas)}</b></p>` : ""}
          ${yo.parada ? `<p class="jg-mo-gasto">Una compra quedó sin fondos y no vale: hasta que ganes ${formatoMonedas(yo.falta)} monedas más, nada de lo que compres después cuenta.</p>` : ""}</div>
        <div class="jg-mo-racha-c">${rachaHtml(d, hoy)}</div>
      </header>
      ${detalleHtml(yo)}
      <div class="jg-mo-cols">
        <section class="jg-mo-caja"><h2>Top de monedas</h2>
          ${lista.length ? `<ol class="jg-mo-top">${lista.slice(0, 50).map((f, i) => fila(f, i, uid, perfil, colorDe, false, ultimo)).join("")}</ol>`
            : `<p class="jg-nada">Nadie tiene monedas todavía.</p>`}
        </section>
        <section class="jg-mo-caja jg-mo-reglas"><h2>Cómo se ganan</h2>
          <p>Las monedas no se guardan: se cuentan a partir de tus partidas, récords y logros, así que nadie puede inventárselas y todo lo que hiciste antes ya cuenta.</p>
          <h3>Partidas de sala</h3>
          <p>${TARIFA.partida} por partida, ${TARIFA.victoria} por victoria y ${TARIFA.empate} por empate, multiplicado por lo que pesa el juego:</p>
          <ul class="jg-mo-pesos">${juegos.map(j => `<li><span>${esc((JUEGOS[j] && JUEGOS[j].nombre) || j)}</span><b>×${PESO[j]}</b></li>`).join("")}</ul>
          <h3>Logros</h3>
          <ul class="jg-mo-pesos">${[1, 2, 3, 4].map(n => `<li><span>${NOMBRE_NIVEL[n]}</span><b>${VALOR_NIVEL[n]} ${MONEDA}</b></li>`).join("")}</ul>
          <h3>Récords del club</h3>
          <p>Una vez por cada modalidad en la que tengas marca (mejorarla no vuelve a pagar):</p>
          <ul class="jg-mo-pesos">${Object.entries(RECORD).map(([j, v]) => `<li><span>${NOMBRES_CLUB[j] || j}</span><b>${v} ${MONEDA}</b></li>`).join("")}</ul>
          <p>Además, BBTAN paga ⌊n/4⌋ por cada ronda n hasta tu récord (llegar a la 5 da 2, a la 50 da 300, a la 100 da 1.225; desde la 450 cada ronda paga 112 y pasada la 600 ya no suma), sortEm paga los bloques de la modalidad más 2 por cada segundo bajo 3 s por bloque, la Sopa diaria y Electrodle 10 por cada día de tu mejor racha, y Electrodle 1 más por cada 50 puntos.</p>
          <h3>Partidas del club</h3>
          <p>Cada partida de un juego individual que termina con resultado paga según lo que dura, hasta ${TOPE_CLUB_DIA} partidas al día por juego (BBTAN, ${TOPE_BBTAN_DIA}: lo suyo lo paga el récord):</p>
          <ul class="jg-mo-pesos">${Object.entries(PAGO_CLUB).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([j, v]) => `<li><span>${NOMBRES_CLUB[j] || j}</span><b>${v} ${MONEDA}</b></li>`).join("")}</ul>
          <h3>Podios</h3>
          <p>Quitarle a otra persona un puesto del podio de una tabla del club (o de Yemas zombis) paga, cada vez:</p>
          <ul class="jg-mo-pesos">${[1, 2, 3].map(n => `<li><span>${["", "🥇 Primer", "🥈 Segundo", "🥉 Tercer"][n]} puesto</span><b>${PODIO[n]} ${MONEDA}</b></li>`).join("")}</ul>
          <h3>🔥 Recompensa diaria</h3>
          <p>Se reclama con el botón de arriba del top de monedas, una vez al día. El primer día paga ${pagoDia(1)}, y cada día seguido ${PAGO_DIA} más: ${[1, 2, 3, 4].map(n => formatoMonedas(pagoDia(n))).join(", ")} y desde ahí ${formatoMonedas(pagoDia(TOPE_DIA))} cada día. Si un día no la reclamas, vuelve a ${pagoDia(1)}. El día cambia a medianoche de Chile.</p>
          <h3>En qué se gastan</h3>
          <ul class="jg-mo-pesos">
            <li><span><a href="#cartas">Sobre de PRODROP</a></span><b>${Date.now() < MOTOR.PRECIO.promoHasta ? `<s>${MOTOR.PRECIO.normal}</s> ` : ""}${MOTOR.precioSobre(Date.now())} ${MONEDA}</b></li>
            <li><span>Graduar una carta</span><b>${MOTOR.PRECIO.gradua} ${MONEDA}</b></li>
            <li><span>Sobre gratis</span><b>cada 6 horas</b></li>
            <li><span>Cartas de otros en el mercado</span><b>el precio que pongan</b></li>
          </ul>
          <p>El top muestra las monedas que cada uno tiene ahora. Tu saldo nunca baja de cero: una compra que no alcanzas a pagar no vale (ni su sobre existe) hasta que ganes lo que falta. Lo que vendes en el mercado se suma a tu saldo.</p>
        </section>
      </div>
    </section>`;
  }
  return {
    montar(el) { host = el; pinta(); off = datos(d => { ultimo = d; pinta(); }); },
    refresca: pinta,
    destruir() { if (off) off(); off = null; if (host) host.innerHTML = ""; host = null; }
  };
}
