/* Monedas — lo que se pinta: la caja del top en el vestíbulo y la
   pestaña #monedas (tu saldo, de dónde sale, el top entero y la tabla de
   tarifas). El cálculo es de monedas.js; aquí solo se dibuja. */
import { JUEGOS } from "./motor.js";
import { avatarMarco, quien } from "./perfil-vista.js";
import {
  topMonedas, monedasDe, formatoMonedas, TARIFA, PESO, VALOR_NIVEL, NOMBRE_NIVEL,
  RECORD, diaChile, rachaHoy, pagoDia
} from "./monedas.js";
import { MOTOR } from "./prodrop-cartas.js";

/* La moneda se dibuja: el emoji de la moneda es de 2020 y en Windows 10 y en
   navegadores viejos sale como un cuadro vacío. */
export const MONEDA = '<svg class="jg-moneda" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f5b819" stroke="#9a6a08" stroke-width="1.6"/><circle cx="10" cy="10" r="5.6" fill="#ffd54a" stroke="#c98d10" stroke-width="1.2"/><path d="M8.6 7.2v5.6M11.4 7.2v5.6" stroke="#9a6a08" stroke-width="1.4" stroke-linecap="round"/><path d="M5.2 6.4a6.2 6.2 0 0 1 3.6-2.5" stroke="#fff7d6" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOMBRES_CLUB = { minas: "Mina Club", snake: "Snake Club", tetrisclub: "Tetris Club", sortem: "sortEm", bbtan: "BBTAN", sopa: "Sopa de letras", electro: "Electrodle" };
const PARTES = [
  ["partidas", "🎮", "Partidas", "5 por partida de sala, por el peso del juego"],
  ["victorias", "🏆", "Victorias", "15 por victoria y 5 por empate, por el peso"],
  ["records", "📈", "Récords", "una vez por modalidad del club con marca"],
  ["logros", "🎖️", "Logros", "15 · 40 · 100 · 250 según dificultad"],
  ["dias", "🔥", "Días seguidos", "10 por día jugado, +5 por día de racha"]
];

function fila(f, i, uid, perfil, colorDe, chico) {
  const q = quien(f.uid, perfil(f.uid), null, { nombre: f.nombre }, colorDe);
  const med = i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1);
  return `<li class="${f.uid === uid ? "jg-yo" : ""}"><b class="jg-mo-pos">${med}</b>${avatarMarco(q.foto, q.nombre, q.color, "anillo", chico ? 26 : 34, f.uid)}
    <span class="jg-mo-nom" data-perfil="${esc(f.uid)}" data-nombre="${esc(q.nombre)}">${esc(q.nombre)}</span>
    <strong class="jg-mo-cant">${formatoMonedas(f.total)} ${MONEDA}</strong></li>`;
}

/* La caja del vestíbulo: los cinco primeros y, si no estás, tu puesto. */
export function topHtml(datos, uid, perfil, colorDe) {
  const lista = topMonedas(datos), mio = lista.findIndex(f => f.uid === uid);
  if (!lista.length) return `<p class="jg-nada">Nadie tiene monedas todavía. Termina una partida y estrena el top.</p>`;
  let html = `<ol class="jg-mo-top chico">${lista.slice(0, 5).map((f, i) => fila(f, i, uid, perfil, colorDe, true)).join("")}</ol>`;
  if (mio >= 5) html += `<ol class="jg-mo-top chico jg-mo-tuyo" start="${mio + 1}">${fila(lista[mio], mio, uid, perfil, colorDe, true)}</ol>`;
  return html + `<a class="jg-mo-ver" href="#monedas">Ver el top y cómo se ganan →</a>`;
}

/* Lo que dice la racha de días hoy. */
function rachaTexto(d, hoy) {
  const r = rachaHoy(d, hoy);
  if (d && d.dia === hoy) return `🔥 <b>${r} ${r === 1 ? "día" : "días"}</b> seguidos · hoy ya contó. Mañana paga ${pagoDia(r + 1)} ${MONEDA}.`;
  if (r) return `🔥 <b>${r} ${r === 1 ? "día" : "días"}</b> seguidos · termina una partida hoy para seguir (+${pagoDia(r + 1)} ${MONEDA}).`;
  return `Termina una partida hoy para empezar una racha de días (+${pagoDia(1)} ${MONEDA}).`;
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
          ${yo.gastadas ? `<p class="jg-mo-gasto">Ganadas <b>${formatoMonedas(yo.total)}</b> · gastadas en PRODROP <b>${formatoMonedas(yo.gastadas)}</b></p>` : ""}</div>
        <p class="jg-mo-racha">${rachaTexto(d, hoy)}</p>
      </header>
      <div class="jg-mo-partes">${PARTES.map(([k, i, t, s]) =>
        `<div><span>${i}</span><b>${formatoMonedas(yo.partes[k])}</b><small>${t}</small><em>${s}</em></div>`).join("")}</div>
      <div class="jg-mo-cols">
        <section class="jg-mo-caja"><h2>Top de monedas</h2>
          ${lista.length ? `<ol class="jg-mo-top">${lista.slice(0, 50).map((f, i) => fila(f, i, uid, perfil, colorDe, false)).join("")}</ol>`
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
          <p>Además, BBTAN paga 1 por cada 2 rondas de tu récord, la Sopa diaria y Electrodle 10 por cada día de tu mejor racha, y Electrodle 1 más por cada 50 puntos.</p>
          <h3>Días seguidos</h3>
          <p>Cada día en que terminas una partida (de sala o del club) paga ${pagoDia(1)}, y la racha suma 5 por día hasta ${pagoDia(9)} desde el noveno. Si un día no juegas, vuelve a ${pagoDia(1)}. El día cambia a medianoche de Chile.</p>
          <h3>En qué se gastan</h3>
          <ul class="jg-mo-pesos">
            <li><span><a href="#cartas">Sobre de PRODROP</a></span><b>${Date.now() < MOTOR.PRECIO.promoHasta ? `<s>${MOTOR.PRECIO.normal}</s> ` : ""}${MOTOR.precioSobre(Date.now())} ${MONEDA}</b></li>
            <li><span>Graduar una carta</span><b>${MOTOR.PRECIO.gradua} ${MONEDA}</b></li>
          </ul>
          <p>El top cuenta lo ganado, no lo que te queda: abrir sobres no te baja de puesto.</p>
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
