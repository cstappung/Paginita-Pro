/* El modo Halloween del salón: del 1 de octubre al 1 de noviembre (los
   dos incluidos, hora del que mira) y se apaga solo el 2 de noviembre.

   Todo cuelga de un atributo en <html>, `data-halloween`:
     - "on"  → temporada y decoración encendida;
     - "off" → temporada, pero la persona la apagó (`jg.halloween` = "no");
     - sin atributo → fuera de temporada: la página es la de siempre.
   El atributo lo pone primero un script en línea del <head> de
   juegos.html, antes de pintar (como el tema oscuro), y la piel entera
   está en el bloque «Modo Halloween» al final de su hoja, con todas las
   reglas bajo `html[data-halloween=on]`. Este módulo solo pone el
   decorado que necesita DOM (murciélagos, fantasmas, araña, el cementerio
   del fondo), la cinta del salón con la cuenta atrás, y vuelve a mirar el
   calendario a medianoche para que una pestaña abierta el 1 de noviembre
   se apague sola al pasar al 2.

   `?halloween=1` / `?halloween=0` en la URL lo fuerzan para verlo fuera
   de temporada (o quitarlo), sin guardar nada. El script del <head> repite
   `enTemporada` en una línea; `tests/halloween.test.cjs` comprueba que los
   dos digan lo mismo. */

const CLAVE = "jg.halloween";

/* Octubre entero y el 1 de noviembre (Día de Todos los Santos). */
export function enTemporada(fecha) {
  const m = fecha.getMonth(), d = fecha.getDate();
  return m === 9 || (m === 10 && d === 1);
}

/* La cuenta atrás de la cinta, en noches hasta el 31. */
export function cuentaHalloween(fecha) {
  const m = fecha.getMonth(), d = fecha.getDate();
  if (m === 10) return "Día de Todos los Santos: última noche del modo Halloween";
  if (d === 31) return "¡Esta noche es Halloween!";
  const n = 31 - d;
  return n === 1 ? "Mañana es Halloween: queda 1 noche" : `Faltan ${n} noches para Halloween`;
}

/* "on", "off" o "" a partir de la fecha, la elección guardada y la URL. */
export function estadoHalloween(fecha, guardado, busqueda) {
  const f = /[?&]halloween=([01])/.exec(busqueda || "");
  if (f) return f[1] === "1" ? (guardado === "no" ? "off" : "on") : "";
  if (!enTemporada(fecha)) return "";
  return guardado === "no" ? "off" : "on";
}

const leeGuardado = () => { try { return localStorage.getItem(CLAVE) || ""; } catch (e) { return ""; } };
const estadoAhora = () => estadoHalloween(new Date(), leeGuardado(), location.search);

function aplica(estado) {
  const r = document.documentElement;
  if (estado) r.dataset.halloween = estado;
  else delete r.dataset.halloween;
  /* El ícono de la pestaña se disfraza con la página (juegos.html). */
  for (const l of document.querySelectorAll("link[data-favicon-hw]"))
    l.href = l.getAttribute(estado === "on" ? "data-favicon-hw" : "data-favicon");
}

/* ---- Piezas en SVG ---- */
/* Las alas y las patas van cada una en su propio elemento HTML, que es el
   que se anima: un `transform` animado dentro de un SVG obliga a repintar
   el dibujo y a recomponer la página entera en cada cuadro; sobre un
   elemento HTML lo resuelve la tarjeta gráfica sin tocar nada más. */
const SVG_MURC = d => `<svg viewBox="0 0 64 32" aria-hidden="true">${d}</svg>`;
const MURCIELAGO =
  `<i class="hw-ala hw-ala-i">${SVG_MURC('<path d="M30 13C24 6 14 5 2 9c4 2 5 5 4 8 4-2 7-1 8 2 3-3 7-2 8 1 2-3 5-4 8-3z"/>')}</i>` +
  `<i class="hw-ala hw-ala-d">${SVG_MURC('<path d="M34 13c6-7 16-8 28-4-4 2-5 5-4 8-4-2-7-1-8 2-3-3-7-2-8 1-2-3-5-4-8-3z"/>')}</i>` +
  SVG_MURC('<path d="M29.3 10.5 30 7l1.6 2.6h.8L34 7l.7 3.5c.9 1 1.3 2.6 1.3 4.5 0 3.6-1.8 6-4 6s-4-2.4-4-6c0-1.9.4-3.5 1.3-4.5z"/><circle cx="30.6" cy="13" r=".9" class="hw-ojo"/><circle cx="33.4" cy="13" r=".9" class="hw-ojo"/>');

const FANTASMA = `<svg viewBox="0 0 60 72" aria-hidden="true"><path class="hw-sabana" d="M30 3C14.5 3 6 15 6 31v36l6-5 6 5 6-5 6 5 6-5 6 5 6-5 6 5V31C54 15 45.5 3 30 3z"/><ellipse cx="22" cy="30" rx="3.6" ry="5" class="hw-cara"/><ellipse cx="38" cy="30" rx="3.6" ry="5" class="hw-cara"/><ellipse cx="30" cy="44" rx="4" ry="5.5" class="hw-cara"/><ellipse cx="15" cy="38" rx="3" ry="1.6" class="hw-rubor"/><ellipse cx="45" cy="38" rx="3" ry="1.6" class="hw-rubor"/></svg>`;

const ARANA =
  `<i class="hw-patas"><svg viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M16 18 7 12 3 15M16 21H5l-3 4M17 24l-8 6-1 5M18 26l-4 9"/><path d="M24 18l9-6 4 3M24 21h11l3 4M23 24l8 6 1 5M22 26l4 9"/></g></svg></i>` +
  `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="25" rx="6.5" ry="7.5"/><circle cx="20" cy="15.5" r="4.5"/><circle cx="18.3" cy="15" r="1.1" class="hw-ojo"/><circle cx="21.7" cy="15" r="1.1" class="hw-ojo"/></svg>`;

/* El cementerio del fondo: colinas, lápidas, un árbol seco y la casa
   embrujada con las ventanas encendidas. Va en `slice` contra el borde
   de abajo, así que en un teléfono se ve el centro (la casa). En una
   pantalla ancha la caja guarda la proporción del dibujo (CSS), porque
   con una altura fija el `slice` recortaba arriba el árbol, la chimenea
   y la colina lejana, y ese borde plano se veía como una línea que
   cruzaba la página. La colina lejana se desvanece hacia arriba por lo
   mismo: su borde duro, con el resplandor naranja detrás, era otra línea. */
const CEMENTERIO = `<svg class="hw-cem" viewBox="0 30 1600 230" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs><linearGradient id="hwColina" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="190"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
<path class="hw-colina2" fill="url(#hwColina)" d="M0 170C180 120 330 150 470 128s300-60 470-18 260 40 380 6 200-20 280-6v160H0z"/>
<g class="hw-silueta">
<path d="M0 205c160-30 300-20 470-6s330 24 520 2 330-26 610-4v63H0z"/>
<path d="M752 205V122l-22 8 64-62 64 62-22-8v83z"/><path d="M786 70V40h14v42z"/><path d="M836 205v-60h-8l40-40 40 40h-8v60z"/>
<path d="M140 205v-46c0-12 9-20 20-20s20 8 20 20v46zM230 210v-32c0-8 6-14 14-14s14 6 14 14v32zM1260 208v-40c0-10 8-18 18-18s18 8 18 18v40zM1360 212v-28c0-7 5-12 12-12s12 5 12 12v28z"/>
<path d="M300 212h8v-38h-14v-8h14v-12h8v12h14v8h-14v38h8z"/><path d="M1180 210h7v-30h-11v-7h11v-10h7v10h11v7h-11v30h7z"/>
<path d="M1460 212c4-50 2-90-10-120l8 2c-2-16-12-30-24-38l10-1c10 6 18 18 22 32 4-18 14-30 28-36l4 6c-12 8-20 22-22 38l10-14 6 4-16 22c6 28 6 66 4 105z"/>
<path d="M420 214c3-34 2-62-6-84l-14-12 4-4 12 9c-2-12-8-22-16-28l5-3c10 7 16 18 18 32 3-12 10-20 20-24l2 5c-9 5-14 14-16 25 8 22 9 52 6 84z"/>
</g>
<g class="hw-ventanas"><rect x="770" y="128" width="12" height="16" rx="2"/><rect x="806" y="128" width="12" height="16" rx="2"/><rect x="788" y="160" width="12" height="18" rx="2"/><rect x="858" y="160" width="10" height="14" rx="2"/><circle cx="794" cy="102" r="6"/></g>
<g class="hw-calabazas"><ellipse cx="520" cy="212" rx="18" ry="14"/><ellipse cx="1080" cy="214" rx="15" ry="12"/><ellipse cx="1112" cy="216" rx="10" ry="8"/></g>
<g class="hw-caras"><path d="M512 208l4-5 4 5zM524 208l4-5 4 5zM512 216q8 6 16 0l-4 3-4-2-4 2zM1074 210l3-4 3 4zM1084 210l3-4 3 4zM1073 217q7 5 14 0z"/></g>
</svg>`;

/* Cada murciélago con su altura, duración, retraso y tamaño. */
const MURCIELAGOS = [
  { y: 14, d: 19, r: -2, s: 1 }, { y: 28, d: 25, r: -11, s: .7 }, { y: 9, d: 31, r: -20, s: .55 },
  { y: 40, d: 23, r: -15, s: .85 }, { y: 20, d: 37, r: -29, s: .6 },
];
const ESTRELLAS = Array.from({ length: 26 }, (_, i) => {
  /* Fijas (no aleatorias): el cielo no salta de una visita a otra. */
  const x = (i * 37 + 11) % 100, y = (i * 53 + 7) % 46, t = 1.2 + (i % 4) * .6;
  return `<i style="left:${x}%;top:${y}%;--t:${t}s;--r:-${(i * .7) % 3}s"></i>`;
}).join("");

function fondoHtml() {
  return `<div class="hw-luna"><i></i><i></i><i></i></div><div class="hw-cielo">${ESTRELLAS}</div>` +
    `${CEMENTERIO}<div class="hw-niebla"><i></i><i></i></div>`;
}
function frenteHtml() {
  const bats = MURCIELAGOS.map(b => `<div class="hw-murc" style="--y:${b.y}vh;--d:${b.d}s;--r:${b.r}s;--s:${b.s}"><div class="hw-murc-v">${MURCIELAGO}</div></div>`).join("");
  return bats +
    `<div class="hw-fant hw-fant-i">${FANTASMA}</div><div class="hw-fant hw-fant-d">${FANTASMA}</div>` +
    `<div class="hw-arana"><i class="hw-hilo"></i><span class="hw-arana-c">${ARANA}</span></div>` +
    `<div class="hw-tela hw-tela-i"></div><div class="hw-tela hw-tela-d"></div>`;
}

/* La calabaza de la cinta: se toca y sale un fantasma «¡Bu!». */
const CALABAZA = `<svg viewBox="0 0 48 44" aria-hidden="true"><path class="hw-tallo" d="M22 9c0-4 1-7 4-8l2 2c-2 1-3 3-3 6z"/><path class="hw-hoja" d="M26 6c4-3 9-3 12 0-4 2-8 2-12 0z"/><ellipse cx="24" cy="26" rx="21" ry="16" class="hw-piel"/><path class="hw-gajo" d="M24 10c-6 4-6 28 0 32M24 10c6 4 6 28 0 32M12 13c-8 6-8 22 0 28M36 13c8 6 8 22 0 28"/><g class="hw-luz"><path d="M13 23l5-6 4 6zM26 23l5-6 4 6zM12 29c4 6 20 6 24 0l-4 2-2 3-3-3-3 3-3-3-3 3-2-3z"/></g></svg>`;

/* La cinta del salón. Se escribe siempre que es temporada (también
   apagada) y el CSS elige qué cara enseñar, así el botón no necesita
   volver a pintar el salón. */
export function halloweenHtml(fecha = new Date()) {
  if (!document.documentElement.dataset.halloween) return "";
  return `<div class="jg-hw-cinta" role="note">
    <button type="button" class="jg-hw-calabaza" data-hw-bu title="¿Truco o trato?" aria-label="Calabaza: tócala">${CALABAZA}</button>
    <span class="jg-hw-txt"><b>Temporada de Halloween</b><span>${cuentaHalloween(fecha)}</span></span>
    <button type="button" class="jg-hw-cambia" data-hw-cambia><span class="hw-si">Apagar decoración</span><span class="hw-no">🎃 Encender Halloween</span></button>
  </div>`;
}

/* El fantasma que cruza la pantalla al tocar la calabaza. */
function bu() {
  if (matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const g = document.createElement("div");
  g.className = "hw-bu";
  g.setAttribute("aria-hidden", "true");
  g.innerHTML = FANTASMA + "<b>¡Bu!</b>";
  document.body.appendChild(g);
  g.addEventListener("animationend", () => g.remove(), { once: true });
  setTimeout(() => g.remove(), 4000);
}

let montado = false;
/* Pone las capas (una detrás del contenido y otra delante, las dos sin
   recibir toques) y engancha la cinta. Llamarla más de una vez no hace nada. */
export function montaHalloween() {
  if (montado || typeof document === "undefined") return;
  montado = true;
  aplica(estadoAhora());
  const fondo = document.createElement("div");
  fondo.className = "jg-hw-fondo";
  fondo.setAttribute("aria-hidden", "true");
  const frente = document.createElement("div");
  frente.className = "jg-hw";
  frente.setAttribute("aria-hidden", "true");
  /* El SVG se escribe solo cuando hace falta: fuera de temporada las
     capas quedan vacías y no cuestan nada. */
  const llena = () => {
    if (document.documentElement.dataset.halloween === "on" && !fondo.firstChild) {
      fondo.innerHTML = fondoHtml();
      frente.innerHTML = frenteHtml();
    }
  };
  llena();
  document.body.prepend(fondo);
  document.body.appendChild(frente);

  document.addEventListener("click", ev => {
    const t = ev.target.closest && ev.target.closest("[data-hw-bu],[data-hw-cambia]");
    if (!t) return;
    if (t.hasAttribute("data-hw-bu")) { bu(); return; }
    const apagar = document.documentElement.dataset.halloween === "on";
    try { localStorage.setItem(CLAVE, apagar ? "no" : "si"); } catch (e) { /* sin almacenamiento: vale para esta visita */ }
    aplica(apagar ? "off" : "on");
    llena();
  });

  /* A medianoche se vuelve a mirar el calendario: el 2 de noviembre se
     apaga sola aunque la pestaña siga abierta (y el 1 de octubre se
     enciende). Si sale de temporada, la cinta se quita también. */
  const programa = () => {
    const ahora = new Date();
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 5);
    setTimeout(() => {
      aplica(estadoAhora());
      llena();
      if (!document.documentElement.dataset.halloween) document.querySelectorAll(".jg-hw-cinta").forEach(c => c.remove());
      programa();
    }, Math.min(manana - ahora, 2147483000));
  };
  programa();
}
