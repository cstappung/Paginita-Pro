/* Monedas — lo que se pinta: la caja del top en el vestíbulo y la
   pestaña #monedas (tu saldo, de dónde sale, el top entero y la tabla de
   tarifas). El cálculo es de monedas.js; aquí solo se dibuja. */
import { JUEGOS } from "./motor.js";
import { avatarMarco, quien, marcoDeUid } from "./perfil-vista.js";
import {
  topMonedas, monedasDe, formatoMonedas, TARIFA, PESO, VALOR_NIVEL, NOMBRE_NIVEL,
  RECORD, diaChile, rachaHoy, pagoDia, PAGO_DIA, TOPE_DIA, PAGO_CLUB, TOPE_CLUB_DIA, TOPE_BBTAN_DIA, PODIO
} from "./monedas.js";
import { MOTOR } from "./prodrop-cartas.js";

/* La moneda se dibuja: el emoji de la moneda es de 2020 y en Windows 10 y en
   navegadores viejos sale como un cuadro vacío. */
export const MONEDA = '<svg class="jg-moneda" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f5b819" stroke="#9a6a08" stroke-width="1.6"/><circle cx="10" cy="10" r="5.6" fill="#ffd54a" stroke="#c98d10" stroke-width="1.2"/><path d="M8.6 7.2v5.6M11.4 7.2v5.6" stroke="#9a6a08" stroke-width="1.4" stroke-linecap="round"/><path d="M5.2 6.4a6.2 6.2 0 0 1 3.6-2.5" stroke="#fff7d6" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOMBRES_CLUB = { minas: "Mina Club", snake: "Snake Club", tetrisclub: "Tetris Club", sortem: "sortEm", bbtan: "BBTAN", sopa: "Sopa de letras", electro: "Electrodle", frontera: "Frontera Batalla", sudoku: "Sudoku Arcade", fanal: "FANAL", atasco: "Atasco", metrorush: "Metro Rush" };
const PARTES = [
  ["partidas", "🎮", "Partidas", `${TARIFA.partida} por partida de sala, por el peso del juego`],
  ["victorias", "🏆", "Victorias", `${TARIFA.victoria} por victoria y ${TARIFA.empate} por empate, por el peso`],
  ["records", "📈", "Récords", "una vez por modalidad del club con marca"],
  ["club", "🕹️", "Partidas del club", `de 15 a 25 por partida, hasta ${TOPE_CLUB_DIA} al día por juego`],
  ["podios", "👑", "Podios", "500 · 250 · 100 por quitarle el puesto a alguien"],
  ["logros", "🎖️", "Logros", "15 · 40 · 100 · 250 según dificultad"],
  ["dias", "🔥", "Recompensa diaria", `${pagoDia(1)} el primer día, +${PAGO_DIA} por día seguido hasta ${pagoDia(TOPE_DIA)}`]
];

function fila(f, i, uid, perfil, colorDe, chico, datos) {
  const q = quien(f.uid, perfil(f.uid), null, { nombre: f.nombre }, colorDe);
  const med = i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1);
  return `<li class="${f.uid === uid ? "jg-yo" : ""}"><b class="jg-mo-pos">${med}</b>${avatarMarco(q.foto, q.nombre, q.color, marcoDeUid(f.uid, perfil(f.uid), datos), chico ? 26 : 34, f.uid)}
    <span class="jg-mo-nom" data-perfil="${esc(f.uid)}" data-nombre="${esc(q.nombre)}">${esc(q.nombre)}</span>
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
    const juegos = Object.keys(PESO).sort((a, b) => PESO[b] - PESO[a] || a.localeCompare(b));
    host.innerHTML = `<section class="jg-mo">
      <header class="jg-mo-hero">
        <div><small>TUS MONEDAS</small><strong>${formatoMonedas(yo.saldo)} ${MONEDA}</strong>
          <p>${puesto ? `Puesto <b>${puesto}</b> de ${lista.length}` : "Todavía fuera del top"} · ${yo.logros} logros</p>
          ${yo.gastadas || yo.cobradas ? `<p class="jg-mo-gasto">Ganadas <b>${formatoMonedas(yo.total)}</b>${yo.cobradas ? ` · cobradas en el mercado <b>${formatoMonedas(yo.cobradas)}</b>` : ""} · gastadas en PRODROP <b>${formatoMonedas(yo.gastadas)}</b></p>` : ""}
          ${yo.parada ? `<p class="jg-mo-gasto">Una compra quedó sin fondos y no vale: hasta que ganes ${formatoMonedas(yo.falta)} monedas más, nada de lo que compres después cuenta.</p>` : ""}</div>
        <div class="jg-mo-racha-c">${rachaHtml(d, hoy)}</div>
      </header>
      <div class="jg-mo-partes">${PARTES.map(([k, i, t, s]) =>
        `<div><span>${i}</span><b>${formatoMonedas(yo.partes[k])}</b><small>${t}</small><em>${s}</em></div>`).join("")}</div>
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
          <p>Además, BBTAN paga ⌊n/4⌋ por cada ronda n hasta tu récord (llegar a la 5 da 2, a la 50 da 300, a la 100 da 1.225), sortEm paga los bloques de la modalidad más 2 por cada segundo bajo 3 s por bloque, la Sopa diaria y Electrodle 10 por cada día de tu mejor racha, y Electrodle 1 más por cada 50 puntos.</p>
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
