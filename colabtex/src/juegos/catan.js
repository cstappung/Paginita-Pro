/* Catan — la isla, de dos a seis, con Navegantes y variantes.
 *
 * Esta pantalla no decide nada: el reductor (`redCatan` en motor.js)
 * sabe de quién es el turno, qué se puede construir y dónde, qué salió
 * en los dados y quién tiene la ruta más larga. Aquí se pinta eso y se
 * mandan las jugadas, más tres que nadie pulsa:
 *
 * - **Las llaves van solas.** El arranque pide la primera llave de
 *   todos, y cada tirada o robo pide la de alguien que no sea quien
 *   tira (`espera.k === "azar"`). El designado —el siguiente en la mesa,
 *   o la víctima— la manda en cuanto la ve; los demás esperan
 *   `SUPLENCIA_MS` más `SUPLENCIA_PASO` por puesto, por si el designado
 *   se ha dormido. Con la pestaña detrás no se espera nada: nadie mira
 *   la animación.
 * - **Los puntos ocultos se revelan solos** cuando bastan para ganar: una
 *   carta de punto de victoria no sirve para otra cosa.
 * - **Al acabar**, la semilla se publica para la auditoría y se cierra la
 *   sala, como en el UNO.
 *
 * El tablero es un SVG en capas: el fondo (mar, terrenos, fichas y
 * puertos) se pinta una vez; los caminos, barcos y edificios se repintan
 * por firma y lo recién construido cae con una animación; el ladrón y el
 * pirata son elementos fijos que se deslizan con una transición CSS. Los
 * iconos son `<symbol>` dibujados aquí, no emoji: cada sistema pinta los
 * emoji a su manera, y un icono en SVG hereda el color y escala limpio.
 *
 * Lo que suena y lo que se anima sale del historial (`est.hist`), no del
 * clic: así se ve y se oye también lo que hacen los demás.
 */
import {
  CT_CADENA, CT_RECURSOS, CT_COSTE, CT_TOPE, CT_CARTAS, CT_PRODUCE, cadenaCatan, llaveCatan, cartaCatan,
  sitiosCatan, hexesLadronCatan, victimasCatan, ratiosCatan, alcanzaCatan, cartasEnMano, piezasCatan,
  barcosMoviblesCatan, auditaCatan
} from "./motor.js";
import { suena } from "./sonido.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const quieto = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVGNS = "http://www.w3.org/2000/svg";

const LATIDO_MS = 2000;
const ENVIO_MAX = 12000;
const AVISO_ESPERA = 20000;
const SUPLENCIA_MS = 6000;
const SUPLENCIA_PASO = 2000;
const SALTO_MS = 25000;
const ESPERA_SEMILLAS = 6000;
const DADOS_MS = 900;

/* El hexágono: R del centro a la punta. Las coordenadas enteras del
   motor se pasan a píxeles con estas dos escalas. */
const R = 44, UX = R * Math.sqrt(3) / 2, UY = R / 2;
const f1 = n => Math.round(n * 10) / 10;

/* Color por asiento, como en la reacción en cadena: dos colores de
   perfil casi iguales en el mismo tablero no se distinguirían. Son los
   de la caja (rojo, azul, blanco, naranja) más verde y morado. */
const PALETA = ["#d8412f", "#2f6fd6", "#f3efe3", "#f08a1c", "#2f9e57", "#8b5cc9"];
const NOMBRE_RES = { madera: "Madera", arcilla: "Arcilla", lana: "Lana", trigo: "Trigo", mineral: "Mineral" };
const RES_DE = { bosque: "madera", colinas: "arcilla", pasto: "lana", campo: "trigo", montana: "mineral", oro: "oro" };
const TERRENO = { bosque: "Bosque", colinas: "Colinas", pasto: "Pastos", campo: "Campos", montana: "Montañas", desierto: "Desierto", oro: "Río de oro", mar: "Mar" };
const DESC = {
  caballero: "Mueve el ladrón y roba una carta",
  punto: "Un punto de victoria, en secreto",
  carreteras: "Dos caminos o barcos gratis",
  abundancia: "Dos recursos de la banca",
  monopolio: "Todos te dan un recurso"
};
const GRADIENTES = {
  bosque: ["#4f9a4f", "#2c6a36"], colinas: ["#e08a55", "#b0532b"], pasto: ["#a8d970", "#6daa45"],
  campo: ["#f3d56e", "#d4a136"], montana: ["#a9b1bc", "#727b88"], desierto: ["#f0dcaa", "#d6b776"],
  oro: ["#f8dc68", "#cf9c1c"], mar: ["#3f95d3", "#2a6aa8"]
};

/* ---------- Los iconos ---------- */
const grano = (x, y, a) => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="1.3" ry="2.4" transform="rotate(${a} ${f1(x)} ${f1(y)})"/>`;
function espiga(cx, top, lean) {
  let s = grano(cx + lean * 1.4, top - 2.3, lean * 12);
  for (let k = 0; k < 4; k++) { const y = top + k * 2.7, x = cx + lean * k * 0.5; s += grano(x - 1.5, y, -28 + lean * 10) + grano(x + 1.5, y, 28 + lean * 10); }
  return s;
}
const SIMBOLOS = `
<symbol id="ct-r-madera" viewBox="-12 -12 24 24">
  <path d="M-3 -11 L4 -2 H1.5 L6 5 H-12 L-7.5 -2 H-10 Z" fill="#2f7d3b" stroke="#1d5226" stroke-width=".7" stroke-linejoin="round"/>
  <rect x="-4.3" y="5" width="2.6" height="5.5" rx=".6" fill="#7a4a24"/>
  <path d="M7.5 -5 L11.8 1 H9.8 L12 6 H3 L5.2 1 H3.2 Z" fill="#46a052" stroke="#1d5226" stroke-width=".6" stroke-linejoin="round"/>
  <rect x="6.7" y="6" width="1.6" height="4.5" fill="#7a4a24"/>
</symbol>
<symbol id="ct-r-arcilla" viewBox="-12 -12 24 24">
  <g stroke="#6e2a12" stroke-width=".9">
    <rect x="-5.5" y="-7" width="11" height="5" rx=".8" fill="#e07a45"/>
    <rect x="-11" y="-1" width="10.5" height="5" rx=".8" fill="#c9562c"/>
    <rect x=".5" y="-1" width="10.5" height="5" rx=".8" fill="#d8683a"/>
    <rect x="-11" y="5" width="22" height="5" rx=".8" fill="#b84a24"/>
  </g>
  <path d="M-4 -5.5h3M2 .5h4M-8 6.5h5" stroke="#f3a37a" stroke-width=".9" stroke-linecap="round"/>
</symbol>
<symbol id="ct-r-lana" viewBox="-12 -12 24 24">
  <path d="M-4 5.5v5M3 5.5v5" stroke="#34302b" stroke-width="1.9" stroke-linecap="round"/>
  <g fill="#fbfaf4" stroke="#8d927f" stroke-width=".8">
    <circle cx="-5.5" cy="0" r="4.6"/><circle cx="0" cy="-3" r="5"/><circle cx="4.5" cy=".5" r="4.4"/><circle cx="-1" cy="3" r="4.6"/>
  </g>
  <ellipse cx="8.6" cy="-2.6" rx="3.3" ry="2.7" fill="#34302b"/>
  <circle cx="9.5" cy="-3.3" r=".7" fill="#fff"/>
</symbol>
<symbol id="ct-r-trigo" viewBox="-12 -12 24 24">
  <g stroke="#9c6f1c" stroke-width="1.1" stroke-linecap="round" fill="none"><path d="M0 11V-6M0 11L-6 -2M0 11L6 -2"/></g>
  <g fill="#eab94a" stroke="#a8751f" stroke-width=".55">${espiga(0, -7, 0)}${espiga(-6.2, -3, -1)}${espiga(6.2, -3, 1)}</g>
  <path d="M-3.5 7 H3.5" stroke="#7a5214" stroke-width="1.8" stroke-linecap="round"/>
</symbol>
<symbol id="ct-r-mineral" viewBox="-12 -12 24 24">
  <path d="M-11 9 L-7 -2 L-1 -7 L5 -3 L11 9 Z" fill="#7b8491" stroke="#4e5560" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M-7 -2 L-1 -7 L0 2 Z" fill="#a6aebb"/><path d="M0 2 L-1 -7 L5 -3 Z" fill="#8e97a4"/>
  <path d="M-3 9 L0 2 L6 5 L7 9 Z" fill="#5f6673"/>
  <path d="M4 -1 L6.5 -7 L9 -1 L6.5 3 Z" fill="#7fd0f0" stroke="#2f86ad" stroke-width=".6"/>
</symbol>
<symbol id="ct-r-oro" viewBox="-12 -12 24 24">
  <path d="M-10 6 L-6 -1 L0 -2 L3 3 L0 8 L-7 9 Z" fill="#f2c233" stroke="#a87a10" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M2 -4 L7 -7 L11 -2 L8 3 L3 1 Z" fill="#f7d65a" stroke="#a87a10" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M-6 0 L-3 -1 M4 -3 L6 -5" stroke="#fff6c2" stroke-width="1" stroke-linecap="round"/>
  <path class="ct-chispa" d="M-4 -9 l1 2.5 l2.5 1 l-2.5 1 l-1 2.5 l-1 -2.5 l-2.5 -1 l2.5 -1z" fill="#fffbe0"/>
</symbol>
<symbol id="ct-t-desierto" viewBox="-12 -12 24 24">
  <circle cx="6.5" cy="-6" r="3.4" fill="#f7c948"/>
  <path d="M-12 7 C-7 1 -3 1 2 6 C5 3 9 3 12 6 V10 H-12 Z" fill="#cfa95b"/>
  <path d="M-4 6 V-5 M-4 -1 H-7 V-5 M-4 1 H-1 V-3" stroke="#4f8a3f" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>
<symbol id="ct-d-caballero" viewBox="-12 -12 24 24">
  <path d="M0 -11 L9 -7.5 V1 C9 6 5 9.5 0 11.5 C-5 9.5 -9 6 -9 1 V-7.5 Z" fill="#9a2a3a" stroke="#4d1219" stroke-width="1"/>
  <path d="M0 -8 V8 M-5 -2 H5" stroke="#f4d58d" stroke-width="2.2" stroke-linecap="round"/>
</symbol>
<symbol id="ct-d-punto" viewBox="-12 -12 24 24">
  <path d="M-6.5 -10 H6.5 V-4 C6.5 1 3.5 3.2 0 3.2 C-3.5 3.2 -6.5 1 -6.5 -4 Z" fill="#e8b33a" stroke="#9a6d12" stroke-width=".8"/>
  <path d="M-6.5 -8 H-10 C-10 -3 -7.5 -2 -6 -2 M6.5 -8 H10 C10 -3 7.5 -2 6 -2" fill="none" stroke="#e8b33a" stroke-width="1.7"/>
  <rect x="-1.5" y="3" width="3" height="4" fill="#c9912a"/><rect x="-6.5" y="7" width="13" height="3.6" rx="1" fill="#8a5a1a"/>
  <path d="M0 -8 l1.2 2.4 2.6 .4 -1.9 1.8 .5 2.6 -2.4 -1.3 -2.4 1.3 .5 -2.6 -1.9 -1.8 2.6 -.4z" fill="#fff4c4"/>
</symbol>
<symbol id="ct-d-carreteras" viewBox="-12 -12 24 24">
  <path d="M-11 10 L-4 -10 H4 L11 10 Z" fill="#8a7358"/>
  <path d="M0 -8 V-5 M0 -2 V1.5 M0 4.5 V8.5" stroke="#f6e7b8" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M-11 10 L-4 -10 M11 10 L4 -10" stroke="#5c4a36" stroke-width="1"/>
</symbol>
<symbol id="ct-d-abundancia" viewBox="-12 -12 24 24">
  <path d="M-11 -7 C-3 -9 6 -5 9 5 C4 2 -2 0 -11 -2 Z" fill="#c98b3a" stroke="#7a4f16" stroke-width=".8"/>
  <path d="M-8 -6.5 C-7 -4 -7 -3 -8 -2" stroke="#7a4f16" stroke-width=".8" fill="none"/>
  <circle cx="7" cy="7" r="3.2" fill="#d8412f"/><circle cx="2.5" cy="8.5" r="2.6" fill="#eab94a"/><circle cx="10.2" cy="2.6" r="2.3" fill="#6ab04c"/>
</symbol>
<symbol id="ct-d-monopolio" viewBox="-12 -12 24 24">
  <path d="M-10 6 L-9.5 -6 L-4.5 0 L0 -9 L4.5 0 L9.5 -6 L10 6 Z" fill="#e8b33a" stroke="#9a6d12" stroke-width=".9" stroke-linejoin="round"/>
  <rect x="-10" y="6" width="20" height="4" rx="1" fill="#c9912a"/>
  <circle cx="0" cy="2" r="1.8" fill="#d8412f"/><circle cx="-5.5" cy="3" r="1.2" fill="#2f6fd6"/><circle cx="5.5" cy="3" r="1.2" fill="#2f9e57"/>
</symbol>
<symbol id="ct-d-dorso" viewBox="-12 -12 24 24">
  <rect x="-8" y="-11" width="16" height="22" rx="2.5" fill="#6a3a1c" stroke="#f0c46a" stroke-width=".8"/>
  <path d="M0 -6 L5 -3 V3 L0 6 L-5 3 V-3 Z" fill="none" stroke="#f0c46a" stroke-width="1.4"/>
</symbol>
<symbol id="ct-c-carta" viewBox="-12 -12 24 24">
  <rect x="-7" y="-10" width="14" height="20" rx="2.2" fill="#fbf4df" stroke="#8a7a5a" stroke-width="1"/>
  <rect x="-4" y="-7" width="8" height="8" rx="1" fill="#e9d9b0"/>
</symbol>
<symbol id="ct-p-poblado" viewBox="-12 -12 24 24">
  <path d="M-8 9 V-1 L0 -9 L8 -1 V9 Z" fill="currentColor" stroke="#1d1a17" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="-2" y="3" width="4" height="6" fill="#1d1a17" opacity=".5"/>
  <path d="M-8 -1 L0 -9 L8 -1" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
</symbol>
<symbol id="ct-p-ciudad" viewBox="-12 -12 24 24">
  <path d="M-11 10 V-2 L-5.5 -9 L0 -2 V1 H11 V10 Z" fill="currentColor" stroke="#1d1a17" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="-7.5" y="1.5" width="3.8" height="4.5" fill="#1d1a17" opacity=".45"/>
  <rect x="3" y="4" width="3.2" height="3.2" fill="#1d1a17" opacity=".45"/>
  <path d="M-11 -2 L-5.5 -9 L0 -2" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
</symbol>
<symbol id="ct-p-camino" viewBox="-12 -12 24 24">
  <rect x="-11" y="-3" width="22" height="6" rx="2" fill="currentColor" stroke="#1d1a17" stroke-width="1.4" transform="rotate(-30)"/>
</symbol>
<symbol id="ct-p-barco" viewBox="-12 -12 24 24">
  <path d="M-10.5 2 H10.5 L7 8.5 H-7 Z" fill="#8a5a2c" stroke="#3b220f" stroke-width="1" stroke-linejoin="round"/>
  <path d="M0 2 V-11" stroke="#3b220f" stroke-width="1.3"/>
  <path d="M1 -10.5 L8.5 0.5 H1 Z" fill="currentColor" stroke="#1d1a17" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M-1 -8 L-7.5 0.5 H-1 Z" fill="currentColor" stroke="#1d1a17" stroke-width=".9" stroke-linejoin="round"/>
</symbol>
<symbol id="ct-b-largo" viewBox="-12 -12 24 24">
  <path d="M-10 8 C-4 8 -8 -2 0 -2 C8 -2 4 -10 10 -10" fill="none" stroke="#7a5b3a" stroke-width="5" stroke-linecap="round"/>
  <path d="M-10 8 C-4 8 -8 -2 0 -2 C8 -2 4 -10 10 -10" fill="none" stroke="#f3e2b0" stroke-width="1" stroke-dasharray="2 2.5"/>
</symbol>
<symbol id="ct-b-ejercito" viewBox="-12 -12 24 24">
  <g stroke="#dfe3ea" stroke-width="2.4" stroke-linecap="round"><path d="M-9 -9 L6 6 M9 -9 L-6 6"/></g>
  <g stroke="#b0781f" stroke-width="2.8" stroke-linecap="round"><path d="M3 10 L10 3 M-3 10 L-10 3"/></g>
</symbol>
<symbol id="ct-b-puerto" viewBox="-12 -12 24 24">
  <g fill="none" stroke="#3b8fd0" stroke-width="2.1" stroke-linecap="round"><circle cx="0" cy="-8" r="2.6"/><path d="M0 -5.5 V10 M-5 -2 H5 M-9 3 C-8 9 -3 10 0 10 C3 10 8 9 9 3"/></g>
</symbol>
<symbol id="ct-b-isla" viewBox="-12 -12 24 24">
  <ellipse cx="0" cy="8" rx="10.5" ry="3.6" fill="#e8cf8c"/>
  <path d="M0 8 C0 2 1 -3 3 -7" stroke="#7a4a24" stroke-width="1.8" fill="none"/>
  <path d="M3 -7 C-2 -10 -6 -8 -8 -4 M3 -7 C6 -11 10 -9 11 -6 M3 -7 C1 -3 -2 -2 -4 0 M3 -7 C7 -5 9 -2 9 1" stroke="#2f8a3f" stroke-width="2" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="ct-ladron" viewBox="-14 -20 28 38">
  <ellipse cx="0" cy="15" rx="10" ry="3" fill="#000" opacity=".3"/>
  <path d="M-9 15 C-10 3 -6 -3 0 -3 C6 -3 10 3 9 15 Z" fill="#34323f" stroke="#15141b" stroke-width="1"/>
  <circle cx="0" cy="-8.5" r="6.8" fill="#34323f" stroke="#15141b" stroke-width="1"/>
  <rect x="-5.8" y="-10.6" width="11.6" height="3.4" rx="1.7" fill="#0f0f15"/>
  <circle cx="-2.4" cy="-8.9" r="1.05" fill="#ffd166"/><circle cx="2.4" cy="-8.9" r="1.05" fill="#ffd166"/>
  <path d="M-5 2 Q0 5 5 2" stroke="#4a4758" stroke-width="1.2" fill="none"/>
</symbol>
<symbol id="ct-pirata" viewBox="-16 -16 32 32">
  <path d="M-14 3 H14 L10 11 H-10 Z" fill="#22202a" stroke="#0e0d12" stroke-width="1"/>
  <path d="M-2 3 V-14" stroke="#0e0d12" stroke-width="1.6"/>
  <path d="M-1 -13.5 L11 -8 L-1 -2.5 Z" fill="#2c2a35" stroke="#0e0d12" stroke-width=".9"/>
  <circle cx="3.5" cy="-8.4" r="2" fill="#eee"/><path d="M2 -6.2 H5" stroke="#eee" stroke-width="1"/>
  <path d="M-3 -12 L-12 -1 H-3 Z" fill="#3a3744" stroke="#0e0d12" stroke-width=".9"/>
  <path d="M-8 7 H8" stroke="#b33" stroke-width="1.2"/>
</symbol>`;

/* Un `<use>` sin tamaño ocupa el 100 % del viewBox empezando en (0,0), y
   con el viewBox centrado en el origen eso dejaba ver solo un cuarto del
   icono: por eso lleva siempre posición y tamaño. */
const USO = `x="-12" y="-12" width="24" height="24"`;
const ico = (id, cls = "") => `<svg class="jg-ct-ico${cls ? " " + cls : ""}" viewBox="-12 -12 24 24" aria-hidden="true"><use href="#${id}" ${USO}/></svg>`;
const icoRes = r => ico("ct-r-" + r);

/* Una cuenta de recursos en iconos: «2 🪵 1 🐑». */
function recursosHtml(o) {
  const partes = CT_RECURSOS.filter(r => o && o[r] > 0).map(r =>
    `<span class="jg-ct-cuenta" title="${esc(o[r] + " " + NOMBRE_RES[r].toLowerCase())}">${o[r] > 1 ? `<b>${o[r]}</b>` : ""}${icoRes(r)}</span>`);
  return partes.length ? partes.join("") : "—";
}
const textoRecursos = o => CT_RECURSOS.filter(r => o && o[r] > 0).map(r => `${o[r]} ${NOMBRE_RES[r].toLowerCase()}`).join(", ") || "nada";

/* Un dado en una rejilla de 3×3, como el del cacho. */
const PIPS = [null, [4], [2, 6], [2, 4, 6], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
function dado(v, cls = "") {
  const on = PIPS[v] || [];
  let h = "";
  for (let i = 0; i < 9; i++) h += on.includes(i) ? `<i class="on"></i>` : `<i></i>`;
  return `<span class="jg-ct-dado${cls ? " " + cls : ""}">${h}</span>`;
}

export function crearCatan(ctx) {
  const { uid, jugar, terminar, secreto } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let sec = null, secPedido = false, secListo = false, cad = null;
  let enviando = false, enviandoT = 0, latido = null;
  let esperaFirma = "", esperaDesde = 0;
  let modo = "", mueveDe = -1, victimas = null, redTipo = "camino";
  let comercio = "", selFirma = "";
  const sel = { des: {}, oro: {}, da: {}, pide: {}, bDa: "", bPide: "", abund: {}, carta: -1 };
  let histVisto = -1, primera = true, vistos = null, manoPrev = null;
  let dadosAnim = null, animHasta = 0, listoDado = false;
  let azarVisto = "", azarDesde = 0, azarEnviado = "", azarEnviadoT = 0, azarT = 0;
  let llaveT = 0, reveloT = 0;
  let cierreT = 0, relojFin = null, cerrando = false, finVisto = 0;
  let auditando = false, firmaAudit = "", tramposos = [];
  let fondoFirma = "", vb = { x: 0, y: 0, w: 1, h: 1 };
  const firmas = {};
  const temporizadores = new Set();

  const luego = (f, ms) => { const t = setTimeout(() => { temporizadores.delete(t); if (!muerto) f(); }, ms); temporizadores.add(t); return t; };
  const $ = s => host && host.querySelector(s);
  const ocupado = () => Date.now() < animHasta;

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-ct">
        <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SIMBOLOS}</defs></svg>
        <div class="jg-barra">
          <div class="jg-fase" id="ctFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-ct-chips" id="ctChips"></div>
        </div>
        <div id="ctTrampa"></div>
        <div class="jg-tablero jg-ct-tablero">
          <div class="jg-ct-mesa">
            <div class="jg-ct-isla" id="ctIsla">
              <div class="jg-ct-scroll"><div class="jg-ct-lienzo">
              <svg class="jg-ct-svg" id="ctSvg" viewBox="0 0 10 10" role="img" aria-label="El tablero de Catan">
                <defs>${Object.entries(GRADIENTES).map(([k, [a, b]]) =>
                  `<linearGradient id="ctG${k}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join("")}
                  <radialGradient id="ctGbrillo" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
                </defs>
                <g id="ctFondo"></g><g id="ctRed"></g><g id="ctEdif"></g><g id="ctFichas"></g><g id="ctSitios"></g>
              </svg>
              <div class="jg-ct-fx" id="ctFx"></div>
              </div></div>
              <div class="jg-ct-dados" id="ctDados"></div>
              <div class="jg-ct-banner" id="ctBanner"></div>
              <div class="jg-ct-toasts" id="ctToasts" aria-live="polite"></div>
            </div>
            <div class="jg-ct-lado" id="ctLado"></div>
          </div>
        </div>
        <div class="jg-ct-mano" id="ctMano"></div>
        <div class="jg-pie" id="ctPie"></div>
        <div class="jg-ct-hist" id="ctHist"></div>
      </div>`;
    host.addEventListener("click", alClic);
    document.addEventListener("visibilitychange", alVolver);
    latido = setInterval(late, LATIDO_MS);
    pideSecreto();
  }

  function destruir() {
    muerto = true;
    clearTimeout(relojFin);
    clearInterval(latido);
    for (const t of temporizadores) clearTimeout(t);
    temporizadores.clear();
    document.removeEventListener("visibilitychange", alVolver);
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function pideSecreto() {
    if (secPedido || !secreto) return;
    secPedido = true;
    Promise.resolve().then(() => secreto())
      .then(s => { sec = s || null; })
      .catch(() => { sec = null; })
      .then(() => { secListo = true; if (!muerto && est) actualizar(p, est); });
  }

  /* ---------- quién es quién ---------- */
  const ids = () => (est ? est.jugadores.map(j => j.uid) : []);
  const jugador = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombre = u => u === uid ? "tú" : ((jugador(u) || {}).nombre || "alguien");
  const Nombre = u => { const s = nombre(u); return s.charAt(0).toUpperCase() + s.slice(1); };
  const verbo = (u, tu, el) => u === uid ? tu : Nombre(u) + " " + el;
  const colorDe = u => PALETA[Math.max(0, ids().indexOf(u)) % PALETA.length];
  const juego = () => !ctx.mirando && !!jugador(uid) && !(est.fuera || {})[uid];
  const miTurno = () => juego() && est.fase === "jugando" && est.turno === uid;

  /* Mi cadena de llaves (800 hashes, una vez) comparada con la punta de
     mi ficha: si no casa —la sala se abrió en otro navegador— no puedo
     tirar ni ayudar, y es mejor decirlo que mandar llaves que no valen. */
  function miCadena() {
    if (cad !== null) return cad;
    if (!secListo || !est) return null;
    const y = jugador(uid);
    if (!sec || sec.sem == null || !y || !y.hcad) { cad = false; return cad; }
    const c = cadenaCatan(sec.sem >>> 0, sec.sal || "");
    cad = c[CT_CADENA] === y.hcad ? c : false;
    return cad;
  }
  function miLlave() {
    const c = miCadena();
    return c ? llaveCatan(c, (est.aportes || {})[uid] || 0) : null;
  }

  /* Mis cartas de desarrollo: solo las ve quien tiene la semilla. */
  function misCartas() {
    const d = (est.des || {})[uid];
    if (!d || !sec || sec.sem == null || !est.mezcla) return [];
    const out = [];
    for (let k = 0; k < d.n; k++) {
      const tipo = cartaCatan(sec.sem >>> 0, sec.sal || "", est.mezcla, k, est.T.grande);
      const usada = !!d.usadas[k], revelada = (d.puntos || []).includes(k), nueva = !(d.t[k] < est.turnoN);
      const jugable = !usada && !revelada && tipo !== "punto" && !nueva && miTurno() && !est.jugoDes && !est.azar
        && (est.etapa === "tirar" || est.etapa === "accion") && !enviando;
      out.push({ k, tipo, usada, revelada, nueva, jugable });
    }
    return out;
  }

  /* ---------- geometría ---------- */
  const vert = v => [v.x * UX, v.y * UY];
  const centro = h => [h.x * UX, 3 * h.f * UY];
  const pct = (x, y) => [((x - vb.x) / vb.w) * 100, ((y - vb.y) / vb.h) * 100];

  /* ---------- pintado ---------- */
  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  function pinta() {
    if (!host || !est || !est.T) return;
    pintaFondo();
    pintaPiezas();
    pintaLadron();
    pintaSitios();
    pintaDados();
    pintaBarra();
    pintaTrampa();
    pintaLado();
    pintaMano();
    pintaPie();
    pintaHist();
  }

  /* El fondo: mar, terrenos con su dibujo, fichas y puertos. No cambia
     en toda la partida, así que se pinta una vez. */
  function pintaFondo() {
    const T = est.T;
    const firma = p.semilla + ":" + T.H.length + T.mar + T.grande;
    if (fondoFirma === firma) return;
    fondoFirma = firma;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of T.V) { const [x, y] = vert(v); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const m = 6;
    vb = { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
    const svg = $("#ctSvg");
    svg.setAttribute("viewBox", `${f1(vb.x)} ${f1(vb.y)} ${f1(vb.w)} ${f1(vb.h)}`);
    host.querySelector(".jg-ct-isla").classList.toggle("ancha", vb.w / vb.h > 1.35);
    let s = "";
    for (const h of T.H) if (h.isla < 0) s += hexSvg(h);
    for (const h of T.H) if (h.isla >= 0) s += hexSvg(h);
    for (const pt of T.puertos) s += puertoSvg(pt);
    $("#ctFondo").innerHTML = s;
    firmas.robado = "";
    /* En el móvil la isla se desplaza de lado: que empiece por el centro. */
    const sc = host.querySelector(".jg-ct-scroll");
    if (sc) requestAnimationFrame(() => { if (sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; });
  }

  function hexSvg(h) {
    const T = est.T, [cx, cy] = centro(h);
    const pts = h.v.map(i => vert(T.V[i]).map(f1).join(",")).join(" ");
    const dentro = h.v.map(i => { const [x, y] = vert(T.V[i]); return f1(cx + (x - cx) * 0.9) + "," + f1(cy + (y - cy) * 0.9); }).join(" ");
    if (h.isla < 0) {
      return `<g class="ct-hex ct-mar-h" data-hx="${h.i}"><polygon points="${pts}" fill="url(#ctGmar)" class="ct-losa"/>
        <path class="ct-ola" d="M${f1(cx - 16)} ${f1(cy - 5)} q4 -3.5 8 0 t8 0 t8 0 t8 0"/>
        <path class="ct-ola b" d="M${f1(cx - 12)} ${f1(cy + 10)} q4 -3.5 8 0 t8 0 t8 0"/></g>`;
    }
    const r = RES_DE[h.t];
    const deco = h.t === "desierto"
      ? `<use href="#ct-t-desierto" x="${f1(cx - 18)}" y="${f1(cy - 22)}" width="36" height="36"/>`
      : `<use href="#ct-r-${r}" x="${f1(cx - 12.5)}" y="${f1(cy - 32)}" width="25" height="25"/>
         <use href="#ct-r-${r}" class="ct-deco" x="${f1(cx - 31)}" y="${f1(cy - 8)}" width="14" height="14"/>
         <use href="#ct-r-${r}" class="ct-deco" x="${f1(cx + 17)}" y="${f1(cy - 8)}" width="14" height="14"/>`;
    return `<g class="ct-hex ct-t-${h.t}" data-hx="${h.i}"><title>${esc(TERRENO[h.t] || "")}${h.n ? " · " + h.n : ""}</title>
      <polygon points="${pts}" fill="url(#ctG${h.t})" class="ct-losa"/>
      <polygon points="${dentro}" fill="url(#ctGbrillo)" class="ct-bisel"/>
      ${deco}${h.n ? fichaSvg(cx, cy + 11, h.n) : ""}</g>`;
  }

  function fichaSvg(x, y, n) {
    const pips = 6 - Math.abs(7 - n), roja = n === 6 || n === 8;
    let pp = "";
    for (let k = 0; k < pips; k++) pp += `<circle cx="${f1(x + (k - (pips - 1) / 2) * 3.1)}" cy="${f1(y + 7)}" r="1.1"/>`;
    return `<g class="ct-ficha${roja ? " roja" : ""}"><circle cx="${f1(x)}" cy="${f1(y)}" r="12.5"/>
      <text x="${f1(x)}" y="${f1(y + 3.4)}">${n}</text><g class="ct-pips">${pp}</g></g>`;
  }

  function puertoSvg(pt) {
    const T = est.T, E = T.E[pt.e], [ax, ay] = vert(T.V[E.a]), [bx, by] = vert(T.V[E.b]), [cx, cy] = centro(T.H[pt.h]);
    const mx = (ax + bx) / 2, my = (ay + by) / 2, qx = mx + (cx - mx) * 0.62, qy = my + (cy - my) * 0.62;
    const hacia = (x, y) => `M${f1(x)} ${f1(y)} L${f1(x + (qx - x) * 0.72)} ${f1(y + (qy - y) * 0.72)}`;
    const tres = pt.tipo === "3";
    return `<g class="ct-puerto"><title>${tres ? "Puerto 3:1 — cualquier recurso" : "Puerto 2:1 — " + esc(NOMBRE_RES[pt.tipo] || "")}</title>
      <path class="ct-muelle" d="${hacia(ax, ay)} ${hacia(bx, by)}"/>
      <circle cx="${f1(qx)}" cy="${f1(qy)}" r="12" class="ct-puerto-c${tres ? "" : " r"}"/>
      ${tres ? `<text x="${f1(qx)}" y="${f1(qy + 3)}" class="ct-puerto-t">3:1</text>`
        : `<use href="#ct-r-${pt.tipo}" x="${f1(qx - 7)}" y="${f1(qy - 10.5)}" width="14" height="14"/><text x="${f1(qx)}" y="${f1(qy + 8.6)}" class="ct-puerto-t2">2:1</text>`}</g>`;
  }

  /* Caminos, barcos y edificios. Lo que no estaba la última vez cae (o se
     traza) con una animación; con la pestaña detrás, sin animar. */
  function pintaPiezas() {
    const firma = JSON.stringify([est.cam, est.bar, est.edif]);
    if (firmas.piezas === firma) return;
    firmas.piezas = firma;
    const T = est.T, anima = !!vistos && !document.hidden && !quieto();
    let red = "", edif = "";
    for (const k in est.cam) {
      const E = T.E[k], [ax, ay] = vert(T.V[E.a]), [bx, by] = vert(T.V[E.b]), q = 0.17;
      const c = [ax + (bx - ax) * q, ay + (by - ay) * q, bx - (bx - ax) * q, by - (by - ay) * q].map(f1);
      const nuevo = anima && !vistos.cam.has(+k);
      red += `<g class="ct-camino${nuevo ? " ct-nuevo" : ""}">
        <line x1="${c[0]}" y1="${c[1]}" x2="${c[2]}" y2="${c[3]}" class="ct-camino-b" pathLength="1"/>
        <line x1="${c[0]}" y1="${c[1]}" x2="${c[2]}" y2="${c[3]}" class="ct-camino-c" style="stroke:${colorDe(est.cam[k])}" pathLength="1"/></g>`;
    }
    for (const k in est.bar) {
      const E = T.E[k], [ax, ay] = vert(T.V[E.a]), [bx, by] = vert(T.V[E.b]);
      let ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const nuevo = anima && !vistos.bar.has(+k);
      red += `<g transform="translate(${f1((ax + bx) / 2)} ${f1((ay + by) / 2)}) rotate(${f1(ang)})"><g class="ct-flota"><g class="ct-pieza${nuevo ? " ct-nuevo" : ""}">
        <use href="#ct-p-barco" x="-12" y="-15" width="24" height="24" style="color:${colorDe(est.bar[k])}"/></g></g></g>`;
    }
    for (const k in est.edif) {
      const b = est.edif[k], [x, y] = vert(T.V[k]), s = b.c === 2 ? 27 : 21;
      const nuevo = anima && vistos.edif.get(+k) !== b.c;
      edif += `<g transform="translate(${f1(x)} ${f1(y)})"><g class="ct-pieza${nuevo ? " ct-nuevo" : ""}">
        <use href="#ct-p-${b.c === 2 ? "ciudad" : "poblado"}" x="${-s / 2}" y="${-s / 2 - 2}" width="${s}" height="${s}" style="color:${colorDe(b.u)}"/></g></g>`;
    }
    $("#ctRed").innerHTML = red;
    $("#ctEdif").innerHTML = edif;
    vistos = {
      cam: new Set(Object.keys(est.cam).map(Number)), bar: new Set(Object.keys(est.bar).map(Number)),
      edif: new Map(Object.entries(est.edif).map(([k, b]) => [+k, b.c]))
    };
  }

  /* El ladrón y el pirata son siempre el mismo elemento: moverlos es
     cambiarles el `transform`, y la transición CSS los hace saltar. */
  function pintaLadron() {
    const T = est.T;
    const pon = (id, h, sym, w, hh, dx, dy) => {
      let g = host.querySelector("#" + id);
      if (h == null || h < 0) { if (g) g.style.display = "none"; return; }
      const [cx, cy] = centro(T.H[h]), tr = `translate(${f1(cx + dx)}px, ${f1(cy + dy)}px)`;
      if (!g) {
        g = document.createElementNS(SVGNS, "g");
        g.id = id;
        g.setAttribute("class", "ct-mueble");
        g.innerHTML = `<g class="ct-mueble-i"><use href="#${sym}" x="${-w / 2}" y="${-hh / 2}" width="${w}" height="${hh}"/></g>`;
        g.style.transform = tr;
        $("#ctFichas").appendChild(g);
      } else if (g.style.transform !== tr) {
        g.style.transform = tr;
        if (!document.hidden && !quieto()) { g.classList.remove("salta"); void g.getBBox(); g.classList.add("salta"); }
      }
      g.style.display = "";
    };
    pon("ctLadronG", est.ladron, "ct-ladron", 26, 36, 19, -4);
    if (T.mar) pon("ctPirataG", est.pirata, "ct-pirata", 36, 36, 0, 0);
    const firma = est.ladron + ":" + est.pirata;
    if (firmas.robado === firma) return;
    firmas.robado = firma;
    for (const g of host.querySelectorAll(".ct-hex.robado")) g.classList.remove("robado");
    const g = host.querySelector(`.ct-hex[data-hx="${est.ladron}"]`);
    if (g) g.classList.add("robado");
  }

  /* Lo que se puede tocar ahora mismo en el tablero, según la etapa y el
     modo elegido abajo. Todo sale de las mismas funciones que usa el
     reductor, así que lo iluminado es exactamente lo que entrará. */
  function sitios() {
    if (!juego() || est.fase !== "jugando" || enviando || est.azar) return null;
    const et = est.etapa;
    if (et === "colocacion") {
      if (est.turno !== uid) return null;
      if (est.sub === "poblado") return { v: sitiosCatan(est, uid, "poblado", { inicial: true }) };
      const es = sitiosCatan(est, uid, "camino", { desde: est.ultPob });
      const bs = est.T.mar ? sitiosCatan(est, uid, "barco", { desde: est.ultPob }) : [];
      if (redTipo === "barco" && bs.length) return { e: bs, tipo: "barco" };
      return es.length ? { e: es, tipo: "camino" } : { e: bs, tipo: "barco" };
    }
    if (et === "ladron" && est.turno === uid) return victimas ? { h: [victimas.x], fijo: true } : { h: hexesLadronCatan(est, uid) };
    if (!puedoConstruir() || !modo) return null;
    if (modo === "camino" || modo === "barco") return { e: sitiosCatan(est, uid, modo), tipo: modo };
    if (modo === "poblado" || modo === "ciudad") return { v: sitiosCatan(est, uid, modo) };
    if (modo === "mueve") return mueveDe < 0 ? { de: barcosMoviblesCatan(est, uid) } : { e: sitiosCatan(est, uid, "barco", { sin: mueveDe }), tipo: "mueve" };
    return null;
  }
  const puedoConstruir = () => juego() && est.fase === "jugando" && !est.azar && (
    (est.turno === uid && (est.etapa === "accion" || (est.gratis > 0 && est.etapa === "tirar")))
    || (est.etapa === "especial" && est.esp && est.esp.uid === uid));

  function pintaSitios() {
    const s = sitios();
    const firma = JSON.stringify(s);
    if (firmas.sitios === firma) return;
    firmas.sitios = firma;
    const T = est.T;
    let h = "";
    if (s) {
      for (const v of s.v || []) {
        const [x, y] = vert(T.V[v]).map(f1);
        h += `<g class="ct-sitio-v" data-v="${v}"><circle class="ct-hit" cx="${x}" cy="${y}" r="13"/><circle class="ct-anillo" cx="${x}" cy="${y}" r="7.5"/></g>`;
      }
      const linea = (e, cls, attr) => {
        const E = T.E[e], [ax, ay] = vert(T.V[E.a]).map(f1), [bx, by] = vert(T.V[E.b]).map(f1);
        return `<g class="${cls}" ${attr}="${e}"><line class="ct-hit" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><line class="ct-anillo" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/></g>`;
      };
      for (const e of s.e || []) h += linea(e, "ct-sitio-e" + (s.tipo === "barco" || s.tipo === "mueve" ? " agua" : ""), "data-e");
      for (const e of s.de || []) h += linea(e, "ct-sitio-e agua de", "data-de");
      if (s.de && mueveDe >= 0) h += linea(mueveDe, "ct-sitio-e elegido", "data-de");
      for (const x of s.h || []) {
        const H = T.H[x];
        h += `<polygon class="ct-sitio-h${s.fijo ? " fijo" : ""}${H.isla < 0 ? " agua" : ""}" data-x="${x}" points="${H.v.map(i => vert(T.V[i]).map(f1).join(",")).join(" ")}"/>`;
      }
    }
    $("#ctSitios").innerHTML = h;
    host.querySelector(".jg-ct-isla").classList.toggle("eligiendo", !!s);
  }

  /* Los dados: ruedan mientras falta la segunda llave, caen al llegar el
     resultado y se quedan mostrando la última tirada. */
  function pintaDados() {
    const w = est.espera, rodando = est.fase === "jugando" && w && w.k === "azar" && w.tipo === "dados";
    let h = "", firma;
    if (rodando) { firma = "rueda" + w.id; h = `<div class="jg-ct-par rodando">${dado(5)}${dado(2, "b")}</div><small>${esc(Nombre(w.por))} tira…</small>`; }
    else if (dadosAnim && Date.now() < dadosAnim.hasta) {
      firma = "cae" + dadosAnim.i;
      h = `<div class="jg-ct-par cae">${dado(dadosAnim.d1)}${dado(dadosAnim.d2, "b")}</div>`;
    } else if (est.ultima) {
      const u = est.ultima;
      firma = "fija" + u.d1 + u.d2 + u.n;
      h = `<div class="jg-ct-par">${dado(u.d1)}${dado(u.d2, "b")}</div><b class="${u.s === 7 ? "siete" : ""}">${u.s}</b>`;
    } else firma = "nada";
    set("ctDados", firma, h);
  }

  function pintaBarra() {
    const w = est.espera, O = est.O;
    let t = "";
    if (est.fase === "fin") t = est.ganador ? `<b>${esc(Nombre(est.ganador))}</b> ${est.ganador === uid ? "ganas" : "gana"} con ${est.vp[est.ganador]} puntos` : "Se acabó";
    else if (!w) t = "Esperando…";
    else if (w.k === "llaves") t = "Preparando la isla…";
    else if (est.etapa === "colocacion") t = `Colocación · <b>${esc(Nombre(est.turno))}</b>`;
    else if (w.k === "especial") t = `Fase especial · <b>${esc(Nombre(w.uid))}</b> construye`;
    else t = `Turno ${est.turnoN} · <b>${esc(Nombre(est.turno))}</b>`;
    const chips = [`<span class="jg-ct-chip meta" title="Puntos para ganar">🏁 ${est.meta} puntos</span>`];
    if (O.mar) chips.push(`<span class="jg-ct-chip mar">Navegantes</span>`);
    if (est.T.grande) chips.push(`<span class="jg-ct-chip" title="Tras cada turno, los demás pueden construir">5–6 · fase especial</span>`);
    if (O.baraja) chips.push(`<span class="jg-ct-chip" title="Cartas que quedan antes de rebarajar">Baraja · ${est.restantes}</span>`);
    if (O.amable) chips.push(`<span class="jg-ct-chip">Ladrón amistoso</span>`);
    if (O.puerto) chips.push(`<span class="jg-ct-chip">Maestro del puerto</span>`);
    set("ctFase", t, t);
    set("ctChips", chips.join(""), chips.join(""));
  }

  function pintaTrampa() {
    const falsas = est.falsas || [];
    const duras = tramposos.filter(t => t.que !== "oculta"), blandas = tramposos.filter(t => t.que === "oculta");
    let h = "";
    if (falsas.length) h += `<div class="jg-trampa">La llave de ${esc(falsas.map(nombre).join(", "))} no encaja con su cadena: esa jugada no ha contado, y se le puede echar con la votación.</div>`;
    if (duras.length) h += `<div class="jg-trampa">${duras.map(t => `${esc(Nombre(t.uid))}: ${t.que === "carta" ? "jugó una carta de desarrollo que no tenía" : "su semilla no es la que prometió"}`).join("<br>")}. La partida ya no vale.</div>`;
    if (blandas.length && est.fase === "fin") h += `<div class="jg-nota">${esc(blandas.map(t => nombre(t.uid)).join(", "))} no ${blandas.length === 1 ? "reveló su" : "revelaron su"} semilla: sus cartas no se han podido comprobar.</div>`;
    if (juego() && secListo && miCadena() === false) h += `<div class="jg-trampa">No encuentro la semilla de esta sala en este navegador: no puedes tirar los dados ni ver tus cartas de desarrollo desde aquí.</div>`;
    set("ctTrampa", h, h);
  }

  /* ---------- los jugadores ---------- */
  function pintaLado() {
    const filas = est.jugadores.map(j => {
      const u = j.uid, fuera = (est.fuera || {})[u];
      const turno = est.fase === "jugando" && ((est.espera && est.espera.k === "especial") ? est.esp && est.esp.uid === u : est.turno === u);
      let estado = "";
      if (est.descartar && est.descartar[u]) estado = `Descarta ${est.descartar[u]}…`;
      else if (est.oro && est.oro[u]) estado = `Elige ${est.oro[u]} de oro…`;
      else if (est.oferta && est.oferta.si[u]) estado = "Acepta el trato";
      else if (est.propuestas && est.propuestas[u]) estado = "Propone un trato";
      const ins = [];
      if (est.largoDe === u) ins.push(`<span class="jg-ct-ins" title="Ruta comercial más larga (+2)">${ico("ct-b-largo")}${est.rutas[u]}</span>`);
      if (est.ejercito === u) ins.push(`<span class="jg-ct-ins" title="Mayor ejército (+2)">${ico("ct-b-ejercito")}${est.caballeros[u]}</span>`);
      if (est.puertoDe === u) ins.push(`<span class="jg-ct-ins" title="Maestro del puerto (+2)">${ico("ct-b-puerto")}</span>`);
      const islas = Object.keys((est.islas || {})[u] || {}).length;
      if (islas) ins.push(`<span class="jg-ct-ins" title="Islas colonizadas (+2 cada una)">${ico("ct-b-isla")}×${islas}</span>`);
      const lleno = Math.min(100, Math.round(100 * (est.vp[u] || 0) / est.meta));
      return { firma: [u, j.nombre, j.foto, fuera, turno, est.vp[u], est.cartas[u], est.desN[u], est.caballeros[u], est.rutas[u], estado, ins.length, est.largoDe, est.ejercito, islas].join("|"),
        html: `<div class="jg-ct-jug${turno ? " on" : ""}${fuera ? " fuera" : ""}${u === uid ? " yo" : ""}" style="--c:${colorDe(u)}">
          <div class="jg-ct-cab">
            <span class="jg-ct-av">${j.foto ? `<img src="${esc(j.foto)}" alt="" referrerpolicy="no-referrer">` : esc((j.nombre || "?").charAt(0))}</span>
            <b>${esc(j.nombre || "Alguien")}${u === uid ? " <small>(tú)</small>" : ""}</b>
            <span class="jg-ct-vp" title="Puntos de victoria a la vista">${est.vp[u] || 0}</span>
          </div>
          <div class="jg-ct-meta"><i style="width:${lleno}%"></i></div>
          <div class="jg-ct-cifras">
            <span title="Cartas de recurso">${ico("ct-c-carta")}${est.cartas[u] || 0}</span>
            <span title="Cartas de desarrollo sin jugar">${ico("ct-d-dorso")}${est.desN[u] || 0}</span>
            <span title="Caballeros jugados">${ico("ct-d-caballero")}${est.caballeros[u] || 0}</span>
            <span title="Ruta más larga">${ico("ct-p-camino", "col")}${est.rutas[u] || 0}</span>
          </div>
          ${ins.length ? `<div class="jg-ct-insignias">${ins.join("")}</div>` : ""}
          ${estado ? `<div class="jg-ct-estado">${esc(estado)}</div>` : ""}
        </div>` };
    });
    set("ctLado", filas.map(f => f.firma).join("#"), filas.map(f => f.html).join(""));
  }

  /* ---------- mi mano ---------- */
  function pintaMano() {
    if (!juego() && !(jugador(uid) && est.fase === "fin")) { set("ctMano", "nada", ""); host.querySelector("#ctMano").hidden = true; return; }
    host.querySelector("#ctMano").hidden = false;
    const m = est.mano[uid] || {}, cartas = misCartas();
    const sube = manoPrev ? CT_RECURSOS.filter(r => (m[r] || 0) > (manoPrev[r] || 0)) : [];
    const firma = JSON.stringify([m, cartas, sube, enviando, sel.carta]);
    if (firmas.ctMano === firma) return;
    firmas.ctMano = firma;
    manoPrev = { ...m };
    const recursos = CT_RECURSOS.map(r => `
      <div class="jg-ct-carta r-${r}${m[r] ? "" : " cero"}${sube.includes(r) && !document.hidden ? " pop" : ""}" title="${NOMBRE_RES[r]}">
        ${icoRes(r)}<b>${m[r] || 0}</b><small>${NOMBRE_RES[r]}</small></div>`).join("");
    const vivas = cartas.filter(c => !c.usada && !c.revelada);
    const des = vivas.map(c => `
      <div class="jg-ct-des c-${c.tipo}${c.nueva ? " nueva" : ""}${sel.carta === c.k ? " sel" : ""}">
        ${ico("ct-d-" + c.tipo)}<div><b>${esc(CT_CARTAS[c.tipo])}</b><small>${esc(c.nueva ? "Recién comprada: se juega en otro turno" : DESC[c.tipo])}</small></div>
        ${c.jugable ? `<button class="jg-ct-jugar" data-juega="${c.k}">Jugar</button>` : c.tipo === "punto" ? `<span class="jg-ct-oculto">oculta</span>` : ""}
      </div>`).join("");
    host.querySelector("#ctMano").innerHTML = `
      <div class="jg-ct-mano-t">Tu mano <small>${cartasEnMano(m)} cartas</small></div>
      <div class="jg-ct-cartas">${recursos}</div>
      ${vivas.length ? `<div class="jg-ct-mano-t">Desarrollo</div><div class="jg-ct-deses">${des}</div>` : ""}`;
  }

  /* ---------- las acciones ---------- */
  const costeHtml = c => `<span class="jg-ct-coste">${CT_RECURSOS.flatMap(r => Array((c[r] || 0)).fill(icoRes(r))).join("")}</span>`;

  function barraConstruir(especial) {
    const m = est.mano[uid], n = piezasCatan(est, uid), T = est.T, gratis = !especial ? est.gratis : 0;
    const items = [
      ["camino", "Camino", CT_COSTE.camino, "ct-p-camino"],
      ...(T.mar ? [["barco", "Barco", CT_COSTE.barco, "ct-p-barco"]] : []),
      ["poblado", "Poblado", CT_COSTE.poblado, "ct-p-poblado"],
      ["ciudad", "Ciudad", CT_COSTE.ciudad, "ct-p-ciudad"]
    ];
    const botones = items.map(([k, t, c, s]) => {
      const libre = (k === "camino" || k === "barco") && gratis > 0;
      const quedan = CT_TOPE[k] - n[k];
      const puede = (libre || alcanzaCatan(m, c)) && quedan > 0 && sitiosCatan(est, uid, k).length > 0 && (est.etapa !== "tirar" || libre);
      return `<button class="jg-ct-accion${modo === k ? " on" : ""}" data-modo="${k}"${puede && !enviando ? "" : " disabled"} title="Quedan ${quedan}">
        <svg class="jg-ct-ico pieza" viewBox="-12 -12 24 24" style="color:${colorDe(uid)}"><use href="#${s}" ${USO}/></svg>
        <span>${t}<small>${libre ? `gratis · ${gratis}` : costeHtml(c)}</small></span></button>`;
    });
    if (est.etapa !== "tirar") {
      botones.push(`<button class="jg-ct-accion" data-compra${alcanzaCatan(m, CT_COSTE.desarrollo) && !enviando ? "" : " disabled"}>
        ${ico("ct-d-dorso", "pieza")}<span>Carta<small>${costeHtml(CT_COSTE.desarrollo)}</small></span></button>`);
      if (T.mar && !especial) {
        const mv = barcosMoviblesCatan(est, uid);
        botones.push(`<button class="jg-ct-accion${modo === "mueve" ? " on" : ""}" data-modo="mueve"${mv.length && !enviando ? "" : " disabled"} title="Un barco abierto, una vez por turno">
          <svg class="jg-ct-ico pieza" viewBox="-12 -12 24 24" style="color:${colorDe(uid)}"><use href="#ct-p-barco" ${USO}/></svg><span>Mover barco<small>${est.movioBarco ? "ya movido" : "gratis"}</small></span></button>`);
      }
    }
    let ayuda = "";
    if (modo === "mueve") ayuda = mueveDe < 0 ? "Toca el barco que quieres mover." : "Toca dónde lo llevas.";
    else if (modo) ayuda = modo === "ciudad" ? "Toca uno de tus poblados." : "Toca un sitio iluminado en el tablero.";
    return `<div class="jg-ct-acciones">${botones.join("")}</div>${ayuda ? `<div class="jg-nota">${esc(ayuda)} <button class="jg-ct-link" data-cancela>Cancelar</button></div>` : ""}`;
  }

  /* Un selector de recursos con + y −, para descartar, elegir oro o el
     año de la abundancia, y para componer un trato. */
  function contador(grupo, maxDe, total) {
    const o = sel[grupo], suma = cartasEnMano(o);
    return `<div class="jg-ct-contadores">${CT_RECURSOS.map(r => {
      const max = maxDe ? maxDe[r] || 0 : 99, n = o[r] || 0;
      return `<div class="jg-ct-contador r-${r}${n ? " con" : ""}${max ? "" : " sin"}">
        ${icoRes(r)}<button data-mas="${grupo}:${r}:-1"${n > 0 ? "" : " disabled"} aria-label="Menos ${NOMBRE_RES[r]}">−</button><b>${n}</b>
        <button data-mas="${grupo}:${r}:1"${n < max && (total == null || suma < total) ? "" : " disabled"} aria-label="Más ${NOMBRE_RES[r]}">+</button></div>`;
    }).join("")}</div>`;
  }

  function pintaPie() {
    const w = est.espera;
    let h = "", clave;
    const off = enviando ? " disabled" : "";
    if (est.fase === "fin") { clave = "fin"; h = `<div class="jg-nota">La partida ha terminado.</div>`; }
    else if (!juego()) {
      clave = "mira" + (w && w.k);
      h = `<div class="jg-nota">${ctx.mirando || !jugador(uid) ? "Estás mirando." : "Te fuiste de la isla."} ${esc(textoEspera())}</div>`;
    }
    else if (!w) { clave = "nada"; h = ""; }
    else if (w.k === "llaves") {
      clave = "llaves" + w.faltan.join(",");
      h = `<div class="jg-nota">Preparando la isla: cada navegador pone su llave para decidir quién empieza…</div>`;
    }
    else if (w.k === "azar") {
      clave = "azar" + w.id;
      h = `<div class="jg-nota">${esc(w.tipo === "dados" ? `${Nombre(w.por)} ${w.por === uid ? "tiras" : "tira"} los dados…` : `${verbo(w.por, "Robas", "roba")} una carta a ${nombre(w.v)}…`)}</div>`;
    }
    else if (est.etapa === "colocacion") {
      if (est.turno === uid) {
        const segunda = Object.values(est.edif).filter(b => b.u === uid).length > (est.sub === "poblado" ? 0 : 1);
        if (est.sub === "poblado") { clave = "col-p" + segunda; h = `<div class="jg-ct-guia"><b>Coloca tu ${segunda ? "segundo" : "primer"} poblado.</b> Toca un cruce iluminado.${segunda ? " Recibes una carta de cada terreno que toque." : ""}</div>`; }
        else {
          const bs = est.T.mar ? sitiosCatan(est, uid, "barco", { desde: est.ultPob }) : [];
          const es = sitiosCatan(est, uid, "camino", { desde: est.ultPob });
          clave = "col-c" + redTipo + bs.length + es.length;
          h = `<div class="jg-ct-guia"><b>Y ahora su ${redTipo === "barco" && bs.length ? "barco" : "camino"}.</b> Toca un tramo iluminado junto al poblado.</div>
            ${bs.length && es.length ? `<div class="jg-ct-fila"><button class="jg-ct-tog${redTipo !== "barco" ? " sel" : ""}" data-red="camino">Camino</button><button class="jg-ct-tog${redTipo === "barco" ? " sel" : ""}" data-red="barco">Barco</button></div>` : ""}`;
        }
      } else { clave = "col-o" + est.turno + est.sub; h = `<div class="jg-nota">${esc(Nombre(est.turno))} coloca su ${est.sub === "poblado" ? "poblado" : "camino"}…</div>`; }
    }
    else if (w.k === "descarte") {
      const n = (est.descartar || {})[uid];
      if (n) {
        clave = "des" + JSON.stringify(sel.des) + enviando;
        const listo = cartasEnMano(sel.des) === n;
        h = `<div class="jg-ct-guia"><b>¡Siete! Tienes más de 7 cartas: descarta ${n}.</b></div>
          ${contador("des", est.mano[uid], n)}
          <div class="jg-ct-fila"><button class="jg-btn" data-descarta${listo && !enviando ? "" : " disabled"}>Descartar ${cartasEnMano(sel.des)}/${n}</button></div>`;
      } else { clave = "des-o" + Object.keys(est.descartar).join(","); h = `<div class="jg-nota">Descartando: ${esc(Object.keys(est.descartar).map(u => `${nombre(u)} (${est.descartar[u]})`).join(", "))}…</div>`; }
    }
    else if (w.k === "oro") {
      const n = (est.oro || {})[uid];
      if (n) {
        clave = "oro" + JSON.stringify(sel.oro) + enviando;
        const listo = cartasEnMano(sel.oro) === n;
        h = `<div class="jg-ct-guia"><b>El río de oro te da ${n} ${n === 1 ? "recurso" : "recursos"}:</b> elige cuáles.</div>
          ${contador("oro", null, n)}
          <div class="jg-ct-fila"><button class="jg-btn" data-oro${listo && !enviando ? "" : " disabled"}>Tomar ${cartasEnMano(sel.oro)}/${n}</button></div>`;
      } else { clave = "oro-o"; h = `<div class="jg-nota">Eligiendo oro: ${esc(Object.keys(est.oro).map(nombre).join(", "))}…</div>`; }
    }
    else if (est.etapa === "ladron") {
      if (est.turno === uid) {
        if (victimas) {
          clave = "vict" + victimas.x + enviando;
          h = `<div class="jg-ct-guia"><b>¿A quién le robas?</b></div><div class="jg-ct-fila">${victimas.vs.map(v =>
            `<button class="jg-ct-victima" data-victima="${esc(v)}" style="--c:${colorDe(v)}"${off}>${esc(Nombre(v))} <small>${est.cartas[v]} cartas</small></button>`).join("")}
            <button class="jg-ct-link" data-cancela>Otro hexágono</button></div>`;
        } else {
          clave = "lad";
          h = `<div class="jg-ct-guia"><b>Mueve el ladrón${est.T.mar ? " (o el pirata, tocando el mar)" : ""}.</b> Toca un hexágono iluminado: roba una carta a quien tenga ${est.T.mar ? "un edificio o un barco" : "un edificio"} al lado.</div>`;
        }
      } else { clave = "lad-o" + est.turno; h = `<div class="jg-nota">${esc(Nombre(est.turno))} mueve el ladrón…</div>`; }
    }
    else if (w.k === "especial") {
      if (w.uid === uid) {
        clave = "esp" + modo + mueveDe + enviando + JSON.stringify(est.mano[uid]);
        h = `<div class="jg-ct-guia"><b>Fase especial:</b> puedes construir o comprar con lo que tienes (sin comerciar).</div>
          ${barraConstruir(true)}<div class="jg-ct-fila"><button class="jg-btn" data-pasa${off}>Pasar</button></div>`;
      } else {
        const salto = Date.now() - esperaDesde > SALTO_MS;
        clave = "esp-o" + w.uid + salto;
        h = `<div class="jg-nota">Fase especial: ${esc(Nombre(w.uid))} puede construir…</div>
          ${salto ? `<div class="jg-ct-fila"><button class="btn2" data-salta${off}>Saltarle el turno de construir</button></div>` : ""}`;
      }
    }
    else if (est.turno === uid && est.etapa === "tirar") {
      clave = "tirar" + enviando + est.gratis + modo + (miCadena() ? 1 : 0);
      h = `<div class="jg-ct-fila"><button class="jg-ct-tirar" data-tirar${enviando || !miCadena() ? " disabled" : ""}>${dado(3)}${dado(5, "b")}<span>Tirar los dados</span></button>
        <span class="jg-nota">Antes de tirar puedes jugar un caballero.</span></div>
        ${est.gratis > 0 ? barraConstruir(false) : ""}`;
    }
    else if (est.turno === uid && est.etapa === "accion") {
      clave = "acc" + [modo, mueveDe, comercio, JSON.stringify(sel), enviando, JSON.stringify(est.oferta), JSON.stringify(est.propuestas), JSON.stringify(est.mano[uid]), est.gratis, est.movioBarco].join("|");
      h = barraConstruir(false) + panelCarta() + panelComercio() + `
        <div class="jg-ct-fila jg-ct-fin"><button class="jg-btn" data-fin${off}>Terminar el turno</button></div>`;
    }
    else {
      clave = "otro" + [est.turno, est.etapa, JSON.stringify(est.oferta), JSON.stringify(est.propuestas), JSON.stringify(sel.da), JSON.stringify(sel.pide), comercio, enviando, JSON.stringify(est.mano[uid])].join("|");
      h = `<div class="jg-nota">Turno de ${esc(Nombre(est.turno))}.</div>` + (est.etapa === "accion" ? panelRespuesta() : "");
    }
    const av = aviso();
    set("ctPie", clave + "|" + av, h + av);
  }

  /* Año de la abundancia y monopolio piden algo más antes de jugarse. */
  function panelCarta() {
    if (sel.carta < 0) return "";
    const c = misCartas().find(x => x.k === sel.carta);
    if (!c || !c.jugable) return "";
    if (c.tipo === "abundancia") {
      const listo = cartasEnMano(sel.abund) === 2;
      return `<div class="jg-ct-panel"><b>Año de la abundancia:</b> elige dos recursos.${contador("abund", null, 2)}
        <div class="jg-ct-fila"><button class="jg-btn" data-abund${listo && !enviando ? "" : " disabled"}>Tomarlos</button><button class="jg-ct-link" data-cancela>Cancelar</button></div></div>`;
    }
    if (c.tipo === "monopolio") {
      return `<div class="jg-ct-panel"><b>Monopolio:</b> ¿qué recurso te dan todos?<div class="jg-ct-fila">${CT_RECURSOS.map(r =>
        `<button class="jg-ct-res" data-mono="${r}"${enviando ? " disabled" : ""}>${icoRes(r)}${NOMBRE_RES[r]}</button>`).join("")}
        <button class="jg-ct-link" data-cancela>Cancelar</button></div></div>`;
    }
    return "";
  }

  /* El comercio de quien tiene el turno: con la banca (según sus puertos)
     o con la mesa (una oferta que los demás aceptan o no). */
  function panelComercio() {
    const m = est.mano[uid], o = est.oferta, props = est.propuestas || {};
    const tabs = `<div class="jg-ct-tabs"><button class="jg-ct-tab${comercio === "banco" ? " on" : ""}" data-comercio="banco">⚓ Banca y puertos</button>
      <button class="jg-ct-tab${comercio === "mesa" ? " on" : ""}" data-comercio="mesa">🤝 Con la mesa${o || Object.keys(props).length ? " •" : ""}</button></div>`;
    let cuerpo = "";
    if (comercio === "banco") {
      const rt = ratiosCatan(est, uid);
      cuerpo = `<div class="jg-ct-trato-f"><span class="jg-ct-lbl">Das</span>${CT_RECURSOS.map(r =>
        `<button class="jg-ct-res${sel.bDa === r ? " sel" : ""}" data-bda="${r}"${m[r] >= rt[r] ? "" : " disabled"}>${icoRes(r)}<small>${rt[r]}:1</small></button>`).join("")}</div>
        <div class="jg-ct-trato-f"><span class="jg-ct-lbl">Recibes</span>${CT_RECURSOS.map(r =>
        `<button class="jg-ct-res${sel.bPide === r ? " sel" : ""}" data-bpide="${r}"${r === sel.bDa ? " disabled" : ""}>${icoRes(r)}</button>`).join("")}</div>
        <div class="jg-ct-fila"><button class="jg-btn" data-banco${sel.bDa && sel.bPide && sel.bDa !== sel.bPide && !enviando ? "" : " disabled"}>${
          sel.bDa && sel.bPide ? `Cambiar ${rt[sel.bDa]} ${esc(NOMBRE_RES[sel.bDa].toLowerCase())} por 1 ${esc(NOMBRE_RES[sel.bPide].toLowerCase())}` : "Elige qué das y qué recibes"}</button></div>`;
    } else if (comercio === "mesa") {
      const otros = est.jugadores.map(j => j.uid).filter(u => u !== uid && !(est.fuera || {})[u]);
      if (o) {
        cuerpo = `<div class="jg-ct-trato"><div>Ofreces ${recursosHtml(o.da)} <span class="jg-ct-flecha">⇄</span> pides ${recursosHtml(o.pide)}</div>
          <div class="jg-ct-fila">${otros.map(u => o.si[u] ? `<button class="jg-btn" data-cierra="${esc(u)}|${esc(o.id)}"${enviando ? " disabled" : ""}>Cambiar con ${esc(Nombre(u))}</button>`
            : `<span class="jg-ct-resp${o.no[u] ? " no" : ""}">${esc(Nombre(u))}: ${o.no[u] ? "no" : "pensando…"}</span>`).join("")}
          <button class="jg-ct-link" data-retira>Retirar la oferta</button></div></div>`;
      } else {
        const listo = cartasEnMano(sel.da) > 0 && cartasEnMano(sel.pide) > 0 && CT_RECURSOS.every(r => !(sel.da[r] && sel.pide[r]));
        cuerpo = `<div class="jg-ct-trato-f"><span class="jg-ct-lbl">Das</span>${contador("da", m)}</div>
          <div class="jg-ct-trato-f"><span class="jg-ct-lbl">Pides</span>${contador("pide", null)}</div>
          <div class="jg-ct-fila"><button class="jg-btn" data-ofrece${listo && !enviando ? "" : " disabled"}>Ofrecer a la mesa</button></div>`;
      }
      const ps = Object.keys(props);
      if (ps.length) cuerpo += `<div class="jg-ct-props">${ps.map(u => {
        const q = props[u], puedo = alcanzaCatan(m, q.pide);
        return `<div class="jg-ct-trato"><div><b>${esc(Nombre(u))}</b> te da ${recursosHtml(q.da)} <span class="jg-ct-flecha">⇄</span> por ${recursosHtml(q.pide)}</div>
          <button class="jg-btn" data-cierra="${esc(u)}|${esc(q.id)}"${puedo && !enviando ? "" : " disabled"}>Aceptar</button></div>`;
      }).join("")}</div>`;
    }
    return `<div class="jg-ct-comercio">${tabs}${cuerpo}</div>`;
  }

  /* Lo que ve quien no tiene el turno: la oferta en la mesa y la
     posibilidad de proponer otra. */
  function panelRespuesta() {
    const m = est.mano[uid], o = est.oferta, mia = (est.propuestas || {})[uid];
    let h = "";
    if (o) {
      const puedo = alcanzaCatan(m, o.pide);
      h += `<div class="jg-ct-trato entra"><div><b>${esc(Nombre(o.uid))}</b> ofrece ${recursosHtml(o.da)} <span class="jg-ct-flecha">⇄</span> por ${recursosHtml(o.pide)}</div>
        <div class="jg-ct-fila">${o.si[uid] ? `<span class="jg-ct-resp si">Aceptada: esperando a ${esc(nombre(o.uid))}</span>`
          : `<button class="jg-btn" data-acepta="${esc(o.id)}"${puedo && !enviando ? "" : " disabled"}>${puedo ? "Aceptar" : "No te llega"}</button>`}
        ${o.no[uid] ? `<span class="jg-ct-resp no">Rechazada</span>` : `<button class="btn2" data-rechaza="${esc(o.id)}"${enviando ? " disabled" : ""}>No, gracias</button>`}</div></div>`;
    }
    if (mia) {
      h += `<div class="jg-ct-trato"><div>Propones ${recursosHtml(mia.da)} <span class="jg-ct-flecha">⇄</span> por ${recursosHtml(mia.pide)}</div>
        <button class="jg-ct-link" data-retira>Retirar</button></div>`;
    } else if (comercio === "contra") {
      const listo = cartasEnMano(sel.da) > 0 && cartasEnMano(sel.pide) > 0 && CT_RECURSOS.every(r => !(sel.da[r] && sel.pide[r]));
      h += `<div class="jg-ct-panel"><b>Proponer un trato a ${esc(nombre(est.turno))}</b>
        <div class="jg-ct-trato-f"><span class="jg-ct-lbl">Das</span>${contador("da", m)}</div>
        <div class="jg-ct-trato-f"><span class="jg-ct-lbl">Pides</span>${contador("pide", null)}</div>
        <div class="jg-ct-fila"><button class="jg-btn" data-contra${listo && !enviando ? "" : " disabled"}>Proponer</button><button class="jg-ct-link" data-comercio="">Cancelar</button></div></div>`;
    } else h += `<div class="jg-ct-fila"><button class="btn2" data-comercio="contra">🤝 Proponer un trato</button></div>`;
    return h;
  }

  function textoEspera() {
    const w = est.espera;
    if (!w) return "";
    if (w.k === "especial") return `${Nombre(w.uid)} construye en la fase especial.`;
    if (est.turno) return `Turno de ${nombre(est.turno)}.`;
    return "";
  }

  /* Tras un rato esperando a alguien, decir a quién, y que existe la
     votación para echarlo: una pestaña dormida no puede parar la isla. */
  function aviso() {
    const w = est && est.espera;
    if (!w || est.fase !== "jugando") return "";
    if (Date.now() - esperaDesde < AVISO_ESPERA) return "";
    let quien = [];
    if (w.k === "llaves") quien = w.faltan;
    else if (w.k === "azar") quien = [];
    else quien = (est.debe || []).slice();
    quien = quien.filter(u => u !== uid);
    if (!quien.length) return "";
    return `<div class="jg-nota">Se está esperando a ${esc(quien.map(nombre).join(", "))}. Si no vuelve, se le puede echar con ⏏ arriba.</div>`;
  }

  /* ---------- el historial ---------- */
  function textoSuceso(e) {
    switch (e.e) {
      case "orden": return `Empieza ${nombre(e.uid)}`;
      case "turno": return `Turno ${e.n}: ${nombre(e.uid)}`;
      case "tirada": return `${Nombre(e.uid)}: ${e.d1} + ${e.d2} = ${e.s}${e.s === 7 ? " ¡siete!" : ""}`;
      case "descarta": return `${verbo(e.uid, "Descartas", "descarta")} ${e.n}`;
      case "ladron": return `${verbo(e.uid, "Mueves", "mueve")} ${e.pir ? "el pirata" : "el ladrón"}`;
      case "roba":
        if (!e.r) return `${Nombre(e.v)} no tenía nada`;
        if (e.uid === uid) return `Robas 1 ${NOMBRE_RES[e.r].toLowerCase()} a ${nombre(e.v)}`;
        if (e.v === uid) return `${Nombre(e.uid)} te roba 1 ${NOMBRE_RES[e.r].toLowerCase()}`;
        return `${Nombre(e.uid)} roba una carta a ${nombre(e.v)}`;
      case "poblado": return `${verbo(e.uid, "Fundas", "funda")} un poblado`;
      case "ciudad": return `${verbo(e.uid, "Levantas", "levanta")} una ciudad`;
      case "camino": return `${verbo(e.uid, "Construyes", "construye")} un camino${e.gratis ? " (gratis)" : ""}`;
      case "barco": return `${verbo(e.uid, "Botas", "bota")} un barco${e.gratis ? " (gratis)" : ""}`;
      case "mueve": return `${verbo(e.uid, "Mueves", "mueve")} un barco`;
      case "compra": return `${verbo(e.uid, "Compras", "compra")} una carta de desarrollo`;
      case "juega":
        if (e.c === "monopolio") return `${verbo(e.uid, "Juegas", "juega")} Monopolio: ${e.n} de ${NOMBRE_RES[e.res].toLowerCase()}`;
        if (e.c === "abundancia") return `${verbo(e.uid, "Juegas", "juega")} Año de la abundancia: ${textoRecursos(e.r)}`;
        return `${verbo(e.uid, "Juegas", "juega")} ${CT_CARTAS[e.c] || e.c}`;
      case "revela": return `${verbo(e.uid, "Revelas", "revela")} ${e.n === 1 ? "un punto" : e.n + " puntos"} de victoria`;
      case "banco": return `${verbo(e.uid, "Cambias", "cambia")} ${textoRecursos(e.da)} por ${textoRecursos(e.pide)}`;
      case "comercio": return `${Nombre(e.uid)} y ${nombre(e.con)} cambian ${textoRecursos(e.da)} por ${textoRecursos(e.pide)}`;
      case "oferta": return `${verbo(e.uid, "Ofreces", "ofrece")} un trato`;
      case "contra": return `${verbo(e.uid, "Propones", "propone")} un trato`;
      case "largo": return e.uid ? `${verbo(e.uid, "Tienes", "tiene")} la ruta más larga (${e.n})` : "Nadie tiene ya la ruta más larga";
      case "ejercito": return `${verbo(e.uid, "Tienes", "tiene")} el mayor ejército`;
      case "puerto": return `${verbo(e.uid, "Eres", "es")} maestro del puerto`;
      case "isla": return `${verbo(e.uid, "Colonizas", "coloniza")} una isla nueva (+2)`;
      case "oro": return `${verbo(e.uid, "Sacas", "saca")} ${textoRecursos(e.r)} del río de oro`;
      case "salta": return `Se salta la fase especial de ${nombre(e.uid)}`;
      case "abandona": return `${verbo(e.uid, "Te vas", "se va")} de la isla`;
      case "falsa": return `La llave de ${nombre(e.uid)} no cuadra`;
      case "gana": return `${verbo(e.uid, "Llegas", "llega")} a ${e.n} puntos`;
      case "baraja": return "Se rebaraja el mazo de eventos";
      default: return "";
    }
  }

  function pintaHist() {
    const ult = (est.hist || []).filter(e => e.e !== "agita" && e.e !== "acepta" && e.e !== "especial").slice(-12).reverse()
      .map(e => ({ e, t: textoSuceso(e) })).filter(x => x.t);
    set("ctHist", ult.map(x => x.e.i).join(","), ult.length ? `<div class="jg-ct-hist-t">Lo último</div>` +
      ult.map(x => `<div class="jg-ct-h h-${esc(x.e.e)}"${x.e.uid ? ` style="--c:${colorDe(x.e.uid)}"` : ""}>${esc(x.t)}</div>`).join("") : "");
  }

  /* ---------- los efectos ---------- */
  function toast(t) {
    const caja = $("#ctToasts");
    if (!caja || document.hidden) return;
    const el = document.createElement("div");
    el.className = "jg-ct-toast";
    el.textContent = t;
    caja.appendChild(el);
    while (caja.children.length > 3) caja.firstChild.remove();
    luego(() => el.remove(), 3600);
  }
  function banner(t, cls = "") {
    const caja = $("#ctBanner");
    if (!caja || document.hidden || quieto()) return;
    caja.innerHTML = `<div class="jg-ct-banner-t ${cls}">${t}</div>`;
    const el = caja.firstChild;
    luego(() => { if (caja.firstChild === el) caja.innerHTML = ""; }, 1900);
  }
  /* Las fichas que suben de cada hexágono que produce, del color de quien
     cobra, y el hexágono que brilla. */
  function produce(e) {
    const T = est.T, fx = $("#ctFx");
    if (!fx || document.hidden) return;
    for (const i of e.hx || []) {
      const h = T.H[i], g = host.querySelector(`.ct-hex[data-hx="${i}"]`);
      if (g && !quieto()) { g.classList.remove("brilla"); void g.getBBox(); g.classList.add("brilla"); }
      const r = RES_DE[h.t];
      h.v.forEach((v, k) => {
        const b = est.edif[v];
        if (!b || (est.fuera || {})[b.u]) return;
        const [x, y] = vert(T.V[v]), [cx, cy] = centro(h), [px, py] = pct(x + (cx - x) * 0.35, y + (cy - y) * 0.35);
        const el = document.createElement("span");
        el.className = "jg-ct-flota";
        el.style.cssText = `left:${px}%;top:${py}%;--c:${colorDe(b.u)};animation-delay:${k * 60}ms`;
        el.innerHTML = `${ico("ct-r-" + r)}+${b.c}${h.t === "oro" ? "?" : ""}`;
        fx.appendChild(el);
        luego(() => el.remove(), 2400);
      });
    }
    const mio = (e.prod || {})[uid] || (e.oro || {})[uid];
    if (mio) suena("cosecha");
  }
  function animaDados(e) {
    dadosAnim = { d1: e.d1, d2: e.d2, i: e.i, hasta: Date.now() + DADOS_MS };
    animHasta = Date.now() + DADOS_MS + 900;
    suena("dado");
    pintaDados();
    luego(() => {
      pintaDados();
      produce(e);
      if (e.s === 7) { banner("¡Siete!", "siete"); suena("ladron"); }
      listoSiFin();
    }, DADOS_MS);
  }

  function efectos(nuevos) {
    let sonido = "";
    for (const e of nuevos) {
      switch (e.e) {
        case "agita": suena("cubilete"); break;
        case "tirada": animaDados(e); break;
        case "poblado": case "ciudad": case "camino": case "barco": case "mueve": sonido = sonido || "martillo"; break;
        case "compra": sonido = "entra"; break;
        case "ladron": suena("ladron"); break;
        case "roba":
          if (e.r && (e.uid === uid || e.v === uid)) toast(textoSuceso(e));
          sonido = "reparte";
          break;
        case "juega": banner(`${ico("ct-d-" + e.c, "grande")}<span>${esc(CT_CARTAS[e.c] || "")}</span><small>${esc(Nombre(e.uid))}</small>`, "carta"); sonido = "ficha"; break;
        case "banco": case "comercio": sonido = "reparte"; if (e.e === "comercio" && (e.uid === uid || e.con === uid)) toast(textoSuceso(e)); break;
        case "oferta": case "contra": sonido = "ficha"; if (e.uid !== uid) toast(textoSuceso(e)); break;
        case "largo": case "ejercito": case "puerto": case "isla":
          if (e.uid) { banner(`${ico(e.e === "largo" ? "ct-b-largo" : e.e === "ejercito" ? "ct-b-ejercito" : e.e === "puerto" ? "ct-b-puerto" : "ct-b-isla", "grande")}<span>${esc(textoSuceso(e))}</span>`, "logro"); sonido = e.uid === uid ? "gana" : "ficha"; }
          break;
        case "turno": if (e.uid === uid && nuevos.length < 8) banner("Tu turno", "turno"); break;
      }
    }
    if (sonido) suena(sonido);
  }

  function listoSiFin() {
    if (listoDado || !est || est.fase !== "fin" || ocupado() || document.hidden) return;
    listoDado = true;
    if (ctx.listo) ctx.listo();
  }

  function alVolver() {
    if (document.hidden || muerto || !est) return;
    automatismos();
    pinta();
    listoSiFin();
  }

  /* ---------- interacción ---------- */
  function limpiaSel() {
    modo = ""; mueveDe = -1; victimas = null; sel.carta = -1;
    sel.des = {}; sel.oro = {}; sel.abund = {}; sel.bDa = ""; sel.bPide = "";
  }

  function alClic(ev) {
    if (!est || est.fase !== "jugando" || !juego()) return;
    const t = ev.target;
    const nodo = sel => t.closest && t.closest(sel);
    const hv = nodo("[data-v]"), he = nodo("[data-e]"), hx = nodo("[data-x]"), hd = nodo("[data-de]");
    if (hv || he || hx || hd) {
      if (enviando) return;
      if (hv) return clicVertice(Number(hv.getAttribute("data-v")));
      if (he) return clicArista(Number(he.getAttribute("data-e")));
      if (hd) { mueveDe = Number(hd.getAttribute("data-de")); suena("clic"); return pinta(); }
      if (hx) return clicHex(Number(hx.getAttribute("data-x")));
    }
    const b = t.closest && t.closest("button");
    if (!b || b.disabled) return;
    const a = n => b.getAttribute(n), tiene = n => b.hasAttribute(n);
    if (tiene("data-modo")) { const m = a("data-modo"); modo = modo === m ? "" : m; mueveDe = -1; suena("clic"); return pinta(); }
    if (tiene("data-cancela")) { limpiaSel(); suena("clic"); return pinta(); }
    if (tiene("data-red")) { redTipo = a("data-red"); suena("clic"); return pinta(); }
    if (tiene("data-comercio")) { const c = a("data-comercio"); comercio = comercio === c ? "" : c; sel.da = {}; sel.pide = {}; suena("clic"); return pinta(); }
    if (tiene("data-mas")) {
      const [g, r, d] = a("data-mas").split(":");
      const o = sel[g];
      o[r] = Math.max(0, (o[r] || 0) + Number(d));
      if (!o[r]) delete o[r];
      /* En un trato, lo que das no puede ser lo que pides. */
      if (g === "da" && o[r]) delete sel.pide[r];
      if (g === "pide" && o[r]) delete sel.da[r];
      suena("clic"); return pinta();
    }
    if (tiene("data-bda")) { sel.bDa = a("data-bda"); if (sel.bPide === sel.bDa) sel.bPide = ""; suena("clic"); return pinta(); }
    if (tiene("data-bpide")) { sel.bPide = a("data-bpide"); suena("clic"); return pinta(); }
    if (tiene("data-tirar")) { const c = miLlave(); if (c) manda({ t: "tira", uid, c }); return; }
    if (tiene("data-compra")) { manda({ t: "compra", uid }); return; }
    if (tiene("data-fin")) { limpiaSel(); comercio = ""; manda({ t: "fin", uid }); return; }
    if (tiene("data-pasa")) { limpiaSel(); manda({ t: "pasa", uid }); return; }
    if (tiene("data-salta")) { manda({ t: "salta", uid }); return; }
    if (tiene("data-descarta")) { const r = { ...sel.des }; sel.des = {}; manda({ t: "descarta", uid, r }); return; }
    if (tiene("data-oro")) { const r = { ...sel.oro }; sel.oro = {}; manda({ t: "oro", uid, r }); return; }
    if (tiene("data-banco")) {
      const rt = ratiosCatan(est, uid), da = sel.bDa, pide = sel.bPide;
      manda({ t: "banco", uid, da: { [da]: rt[da] }, pide: { [pide]: 1 } });
      if ((est.mano[uid][da] || 0) - rt[da] < rt[da]) sel.bDa = "";
      return;
    }
    if (tiene("data-ofrece")) { manda({ t: "oferta", uid, da: { ...sel.da }, pide: { ...sel.pide } }); sel.da = {}; sel.pide = {}; return; }
    if (tiene("data-contra")) { manda({ t: "contra", uid, da: { ...sel.da }, pide: { ...sel.pide } }); sel.da = {}; sel.pide = {}; comercio = ""; return; }
    if (tiene("data-retira")) { manda({ t: "retira", uid }); return; }
    if (tiene("data-cierra")) { const [con, o] = a("data-cierra").split("|"); manda({ t: "cierra", uid, con, o }); return; }
    if (tiene("data-acepta")) { manda({ t: "acepta", uid, o: a("data-acepta") }); return; }
    if (tiene("data-rechaza")) { manda({ t: "rechaza", uid, o: a("data-rechaza") }); return; }
    if (tiene("data-victima")) { if (victimas) mandaLadron(victimas.x, a("data-victima")); return; }
    if (tiene("data-juega")) {
      const k = Number(a("data-juega")), c = misCartas().find(x => x.k === k);
      if (!c || !c.jugable) return;
      if (c.tipo === "abundancia" || c.tipo === "monopolio") { sel.carta = sel.carta === k ? -1 : k; sel.abund = {}; suena("clic"); return pinta(); }
      manda({ t: "juega", uid, k, c: c.tipo });
      if (c.tipo === "carreteras") modo = "camino";
      return;
    }
    if (tiene("data-abund")) { manda({ t: "juega", uid, k: sel.carta, c: "abundancia", r: { ...sel.abund } }); sel.carta = -1; sel.abund = {}; return; }
    if (tiene("data-mono")) { manda({ t: "juega", uid, k: sel.carta, c: "monopolio", res: a("data-mono") }); sel.carta = -1; return; }
  }

  function clicVertice(v) {
    if (est.etapa === "colocacion" && est.turno === uid && est.sub === "poblado") return manda({ t: "poblado", uid, v });
    if (modo === "poblado" || modo === "ciudad") { const m = modo; modo = ""; return manda({ t: m, uid, v }); }
  }
  function clicArista(e) {
    if (est.etapa === "colocacion" && est.turno === uid) {
      const s = sitios();
      return manda({ t: s && s.tipo === "barco" ? "barco" : "camino", uid, e });
    }
    if (modo === "mueve" && mueveDe >= 0) { const de = mueveDe; modo = ""; mueveDe = -1; return manda({ t: "mueve", uid, de, a: e }); }
    if (modo === "camino" || modo === "barco") {
      const m = modo;
      /* Con caminos gratis el modo sigue puesto: suelen ser dos seguidos. */
      if (!(est.gratis > 1)) modo = "";
      return manda({ t: m, uid, e });
    }
  }
  function clicHex(x) {
    if (est.etapa !== "ladron" || est.turno !== uid) return;
    if (victimas) { if (victimas.x === x) return; victimas = null; }
    const vs = victimasCatan(est, uid, x);
    if (vs.length > 1) { victimas = { x, vs }; suena("clic"); return pinta(); }
    mandaLadron(x, vs[0] || "");
  }
  function mandaLadron(x, v) {
    const j = { t: "ladron", uid, x };
    if (v) { const c = miLlave(); if (!c) return; j.v = v; j.c = c; }
    victimas = null;
    manda(j);
  }

  /* Una jugada con tope de tiempo: una transacción sin red no falla,
     espera, y mientras tanto los botones quedaban grises para siempre.
     Van de una en una: muchas llevan una llave, y dos a la vez gastarían
     la misma. */
  function conTope(promesa) {
    let t;
    return Promise.race([promesa, new Promise((_, no) => { t = setTimeout(() => no(new Error("la jugada no vuelve")), ENVIO_MAX); })])
      .finally(() => clearTimeout(t));
  }
  async function manda(j) {
    if (enviando || !juego()) return false;
    enviando = true; enviandoT = Date.now();
    if (est) pinta();
    let ok = false;
    try { ok = await conTope(jugar(j)); } catch (e) { console.warn("[catan]", e); }
    finally { enviando = false; if (est && !muerto) { pinta(); automatismos(); } }
    return ok;
  }

  /* El orden en que los demás ayudan a una tirada o un robo: primero el
     designado y después, por turno de mesa, los suplentes. */
  function ordenAyuda(w) {
    const xs = ids(), i0 = xs.indexOf(w.por), activos = [];
    for (let k = 1; k < xs.length; k++) { const u = xs[(i0 + k) % xs.length]; if (!(est.fuera || {})[u]) activos.push(u); }
    const pref = activos.includes(w.pref) ? w.pref : activos[0];
    return [pref].concat(activos.filter(u => u !== pref));
  }

  function automatismos() {
    if (!est || est.fase !== "jugando" || !juego() || enviando || muerto) return;
    const w = est.espera;
    if (!w) return;
    if (w.k === "llaves" && w.faltan.includes(uid)) {
      const c = miLlave();
      if (!c || Date.now() - llaveT < 6000) return;
      llaveT = Date.now();
      manda({ t: "k", uid, a: "0", c });
      return;
    }
    if (w.k === "azar" && w.por !== uid) {
      const orden = ordenAyuda(w), r = orden.indexOf(uid);
      if (r < 0 || !miCadena()) return;
      const hace = Date.now() - azarDesde;
      const toca = r === 0 ? (document.hidden ? 0 : 450) : SUPLENCIA_MS + (r - 1) * SUPLENCIA_PASO;
      if (hace < toca) { clearTimeout(azarT); azarT = luego(automatismos, toca - hace + 60); return; }
      if (azarEnviado === w.id && Date.now() - azarEnviadoT < 6000) return;
      azarEnviado = w.id; azarEnviadoT = Date.now();
      manda({ t: "k", uid, a: w.id, c: miLlave() });
      return;
    }
    /* Las cartas de punto solo sirven para ganar: en cuanto bastan, fuera. */
    if (est.turno === uid && !est.azar && (est.etapa === "tirar" || est.etapa === "accion")) {
      const ocultos = misCartas().filter(x => x.tipo === "punto" && !x.revelada && !x.usada).map(x => x.k);
      if (ocultos.length && (est.vp[uid] || 0) + ocultos.length >= est.meta && Date.now() - reveloT > 6000) {
        reveloT = Date.now();
        manda({ t: "revela", uid, ks: ocultos });
      }
    }
  }

  function late() {
    if (muerto || !est) return;
    if (enviando && Date.now() - enviandoT > ENVIO_MAX + 3000) enviando = false;
    /* El pie lleva en su firma el aviso de espera y el botón de saltar,
       que dependen del reloj: repintar basta para que aparezcan. */
    if (est.fase === "jugando") { automatismos(); pinta(); }
    else if (est.fase === "fin" && !(p.fin && p.fin.at) && Date.now() - cierreT > 3000) cierre();
  }

  /* Al acabar: publicar la semilla (la auditoría la necesita) y cerrar la
     sala. Se sigue intentando hasta que `fin` está escrito. */
  function cierre() {
    cierreT = Date.now();
    if (!finVisto) finVisto = Date.now();
    if (ctx.mirando || !jugador(uid)) return;
    if (!cerrando && !(est.semillas || {})[uid] && secListo) {
      cerrando = true;
      if (sec && sec.sem != null) jugar({ t: "s", uid, sem: sec.sem, sal: sec.sal || "" }).catch(() => {});
    }
    const faltan = est.jugadores.filter(j => !(est.fuera || {})[j.uid] && !(est.semillas || {})[j.uid]);
    if (!(p.fin && p.fin.at) && (!faltan.length || Date.now() - finVisto > ESPERA_SEMILLAS))
      Promise.resolve().then(() => terminar(est.ganador, est.motivo)).catch(() => {});
    clearTimeout(relojFin);
    relojFin = setTimeout(() => { if (!muerto && est && !(p.fin && p.fin.at)) cierre(); }, 1000);
  }

  async function audita() {
    if (auditando || !p || !est) return;
    const firma = Object.keys(p.jugadas || {}).length + "|" + !!p.fin;
    if (firma === firmaAudit || (!p.fin && !Object.keys(est.semillas || {}).length)) return;
    auditando = true;
    try {
      const malas = await auditaCatan(p, est);
      firmaAudit = firma;
      if (JSON.stringify(malas) !== JSON.stringify(tramposos)) { tramposos = malas; firmas.ctTrampa = null; pinta(); }
    } catch (err) { /* una auditoría que falla no puede tumbar la mesa */ }
    finally { auditando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    pideSecreto();
    if (!est.T) return;
    const w = est.espera;
    const fe = !w || est.fase !== "jugando" ? "" : [w.k, w.uid || "", w.id || "", (est.debe || []).join(","), est.etapa].join(":");
    if (fe !== esperaFirma) { esperaFirma = fe; esperaDesde = Date.now(); }
    if (w && w.k === "azar" && w.id !== azarVisto) { azarVisto = w.id; azarDesde = Date.now(); }

    /* Lo que ya no vale se suelta: un modo de construir fuera del turno,
       una víctima de un ladrón que ya se movió, un trato de otro turno. */
    const sf = [est.turno, est.etapa, est.turnoN, (est.esp || {}).uid].join("|");
    if (sf !== selFirma) { selFirma = sf; limpiaSel(); if (est.etapa !== "accion") comercio = ""; }
    if (modo && !puedoConstruir()) modo = "";

    const hs = est.hist || [];
    const nuevos = primera ? [] : hs.filter(e => e.i > histVisto);
    if (hs.length) histVisto = Math.max(histVisto, hs[hs.length - 1].i);
    primera = false;
    if (nuevos.length && !document.hidden) efectos(nuevos.slice(-20));

    pinta();
    automatismos();
    audita();
    if (est.fase === "fin") { listoSiFin(); if (!(p.fin && p.fin.at)) cierre(); }
  }

  return { montar, actualizar, destruir, ocupado };
}
