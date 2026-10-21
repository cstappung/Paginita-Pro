/* Los fondos de la tienda de Halloween: la escena que va encima del
 * degradado (`capaFondo` en perfil-vista.js la mete dentro de la capa
 * `.jg-fanim`, que es un contenedor de tamaño: todo se mide en cqw/cqh y
 * la misma escena sirve para la muestra del editor, la cabecera de la
 * tarjeta y la portada del perfil). El CSS está en juegos.html, bloque
 * «Fondos de Halloween» (clases `hwf-*`, keyframes `hf*`).
 *
 * Lo que se mueve son elementos HTML (luna, niebla, murciélagos,
 * fantasmas, cuervos, lluvia…), no piezas dentro de un SVG: así lo mueve la
 * tarjeta gráfica sin repintar el dibujo (ver «Lobby performance» en
 * docs/claude/juegos/salon.md). Los SVG son siluetas quietas que se anclan
 * abajo con `slice`. Las ventanas de la mansión son la excepción: un
 * parpadeo de opacidad, solo cuando ese fondo está a la vista.
 */

const sil = (vb, cuerpo, alin = "xMidYMax") => `<svg class="hwf-sil" viewBox="${vb}" preserveAspectRatio="${alin} slice" aria-hidden="true">${cuerpo}</svg>`;
const svg = (vb, cuerpo) => `<svg viewBox="${vb}" aria-hidden="true">${cuerpo}</svg>`;

const FANTASMA = svg("0 0 30 36", `<path d="M15 1C7 1 3 7 3 15v19l4-3 4 3 4-3 4 3 4-3 4 3V15C27 7 23 1 15 1z" fill="#f1f5f9" fill-opacity=".92"/><ellipse cx="11" cy="14" rx="2" ry="3" fill="#1e293b"/><ellipse cx="19" cy="14" rx="2" ry="3" fill="#1e293b"/><ellipse cx="15" cy="22" rx="2.2" ry="3" fill="#1e293b"/>`);
const MURCIELAGO = svg("0 0 40 20", `<path d="M20 9C16 3 9 2 1 5c3 1 4 3 3 6 3-1.5 5-1 6 1 2-2 4-2 6 0 1-1.5 2.5-2 4-2s3 .5 4 2c2-2 4-2 6 0 1-2 3-2.5 6-1-1-3 0-5 3-6-8-3-15-2-19 4z" fill="#0a0612"/><circle cx="18.6" cy="9" r=".7" fill="#facc15"/><circle cx="21.4" cy="9" r=".7" fill="#facc15"/>`);
const CUERVO = svg("0 0 40 20", `<path d="M20 11C16 5 10 2 1 3c5 2 8 4 10 7-3 0-5 1-6 3 4-1 8-1 11 0l4 3 4-3c3-1 7-1 11 0-1-2-3-3-6-3 2-3 5-5 10-7-9-1-15 2-19 8z" fill="#0c0000"/>`);
const CALABAZA = svg("0 0 40 34", `<path d="M19 6c0-3 1-5 4-6l1.4 1.6C22.6 2.4 21.6 4 21.6 6z" fill="#3f6212"/><ellipse cx="20" cy="20" rx="19" ry="13.5" fill="#ea580c"/><path d="M20 7c-5 3-5 23 0 26M20 7c5 3 5 23 0 26M9 9c-7 5-7 18 0 23M31 9c7 5 7 18 0 23" fill="none" stroke="#9a3412" stroke-width="1.2"/><path d="M10 17l4-5 4 5zM22 17l4-5 4 5zM9 22c4 6 18 6 22 0l-3 1.6-2 2.4-2.6-2-2.4 2-2.4-2-2.6 2-2-2.4z" fill="#fde047"/>`);
const BRUJA = svg("0 0 64 32", `<path d="M3 21.4L46 18l.4 1.8L3.4 23z" fill="#1a0b2e"/><path d="M45 15.4l15-4.4-2.6 6 4.4 3.4-15.4-1.2z" fill="#1a0b2e"/><path d="M47 13l12-2M47 19l13 1" stroke="#1a0b2e" stroke-width=".8"/><path d="M19 20c-1-6 1-11 6-13.4l4 .8c4 3 4 8.6 2 12.6z" fill="#1a0b2e"/><path d="M29 8c7 1.6 12 6.4 15 11.4L31 20z" fill="#1a0b2e"/><path d="M24 20l-3 6 3 .4 3-6zM29 20l1 6.4 2.6-.6-1-6.2z" fill="#1a0b2e"/><circle cx="24.6" cy="6.4" r="3" fill="#1a0b2e"/><path d="M18 5.4l14-1.2-3.4-1.6L23-6l.6 8.8z" fill="#1a0b2e"/><path d="M21.6 6.8l-3.2 1.4 3.4-.2z" fill="#1a0b2e"/>`);
const RAYO = svg("0 0 20 60", `<path d="M12 0L4 26h6L3 60l14-36h-6l7-24z" fill="#f8fafc"/>`);

/* Lo que se repite: el cielo con estrellas va en ::before (CSS). */
const luna = cls => `<i class="hwf-luna ${cls || ""}"></i>`;
const niebla = `<i class="hwf-niebla"></i><i class="hwf-niebla n2"></i>`;
const lucecitas = (n, cls) => Array.from({ length: n }, (_, i) =>
  `<i class="${cls}" style="--x:${(i * 37 + 9) % 96}%;--y:${18 + (i * 23) % 62}%;--d:${(5 + (i % 4) * 1.3).toFixed(1)}s;--r:-${(i * 1.7 % 6).toFixed(1)}s"></i>`).join("");

const TUMBAS = `<path d="M0 78C60 70 120 74 200 72S330 66 400 74V100H0Z"/>` +
  `<path d="M40 80v-14a8 8 0 0 1 16 0v14zM80 82v-10a6 6 0 0 1 12 0v10zM250 80v-16a9 9 0 0 1 18 0v16zM330 82v-11a6.5 6.5 0 0 1 13 0v11zM372 80v-9a5 5 0 0 1 10 0v9z"/>` +
  `<path d="M120 82h4v-16h6v-4h-6v-6h-4v6h-6v4h6zM292 81h3.4v-13h5v-3.4h-5v-5h-3.4v5h-5v3.4h5z"/>` +
  `<path d="M176 76c2-14 1-26-4-36l-9-6 2-2 7 4c-1-6-4-11-9-14l3-2c6 4 9 9 10 16 2-7 6-12 12-15l1 3c-5 3-8 8-9 14 3-3 7-5 11-6l1 2c-5 2-9 5-11 9 3 10 3 22 2 33z"/>` +
  `<path d="M200 84V70l2-3 2 3v14zM212 84V70l2-3 2 3v14zM224 84V70l2-3 2 3v14zM236 84V70l2-3 2 3v14zM198 74h42v2h-42z"/>`;

const CAMPO = `<path d="M0 74C50 62 100 68 160 64S290 58 400 68V100H0Z"/>` +
  `<path d="M318 74V40h3v34zM300 48h40v3h-40zM310 47h19l-2.4 17h-14z"/><circle cx="319.5" cy="38" r="5"/><path d="M310 35h19l-4.6-2-2-8h-6l-2 8z"/>` +
  `<path d="M300 51l-4 6M340 51l4 6M313 64l-3 8M326 64l3 8" stroke="#000" stroke-width="1.4"/>` +
  `<path d="M120 78V64l2-2 2 2v14zM140 78V64l2-2 2 2v14zM160 78V64l2-2 2 2v14zM118 68h48v2h-48z"/>`;

const CASTILLO = `<path d="M0 84C70 78 150 80 230 76S350 70 400 74V100H0Z"/>` +
  `<path d="M262 76V46h8v-6h4v6h6V36h-4l8-14 8 14h-4v10h10V30h-4l9-18 9 18h-4v16h6v-6h4v6h8v30z"/>` +
  `<path d="M70 82V62l-5-6 5 3V50l-4-5 5 3 1-8 2 9 3-3-3 6v8l5-4-5 7v19zM110 84V68l-4-5 4 2v-7l-3-4 4 3 1-6 1 7 3-2-3 5v6l4-3-4 5v14z"/>`;

const MANSION = `<path d="M0 88C80 82 160 86 240 82S360 80 400 84V100H0Z"/><path d="M190 92C240 70 330 64 400 70V100H190Z"/>` +
  `<path d="M262 76V46h76v30zM258 47L300 24l42 23zM266 48V30h14v18zM263 31L273 12l10 19zM322 50V22h14v28zM319 23L329 4l10 19zM300 30V16h6v16z"/>` +
  `<path d="M286 76V64a6 6 0 0 1 12 0v12z" fill="#05070f"/>` +
  `<path d="M210 86V64l-5-7 5 3V52l-3-5 4 3 1-9 2 10 3-3-3 6v7l6-4-6 7v21zM160 88V74l-4-4 4 1v-6l-3-3 4 2 1-6 1 7 3-2-3 4v5l4-2-4 4v12z"/>`;
const VENTANAS = `<g class="hwf-vent"><rect x="270" y="36" width="5" height="7" rx="1"/><rect x="328" y="30" width="5" height="7" rx="1"/><rect x="272" y="54" width="7" height="8" rx="1"/><rect x="306" y="54" width="7" height="8" rx="1"/><rect x="321" y="54" width="7" height="8" rx="1"/><circle cx="300" cy="40" r="3"/></g>`;

const BOSQUE = (() => {
  const arbol = (x, k) => `<path transform="translate(${x} 84) scale(${k})" d="M-2 0V-34l-7-9 7 5V-50l-5-7 6 5 1-14 2 15 5-5-5 10v11l8-7-8 12V0z"/>`;
  return `<path d="M0 84C90 78 200 82 300 78S380 80 400 80V100H0Z"/>` + [[20, 1], [60, .7], [150, 1.2], [215, .8], [290, 1.1], [350, .75], [385, .9]].map(([x, k]) => arbol(x, k)).join("");
})();

/* Una por fondo. */
export const ESCENAS_HW = {
  cementerio: luna("l-cem") + `<i class="hwf-murc m1">${MURCIELAGO}</i>` +
    `<i class="hwf-fant f1">${FANTASMA}</i><i class="hwf-fant f2">${FANTASMA}</i>` +
    sil("0 0 400 100", `<g fill="#07051a">${TUMBAS}</g>`) + niebla,
  calabazar: lucecitas(9, "hwf-luc") +
    sil("0 0 400 100", `<g fill="#170617">${CAMPO}</g>`) +
    [[6, 4, 30], [24, 2, 20], [47, 6, 34], [66, 1, 22], [84, 5, 28]].map(([x, y, s], i) =>
      `<i class="hwf-cal" style="left:${x}%;bottom:${y}%;--s:${s}cqh;--r:-${(i * .7).toFixed(1)}s"><b></b>${CALABAZA}</i>`).join(""),
  aquelarre: luna("l-bruja") + `<i class="hwf-bruja">${BRUJA}</i>` +
    `<i class="hwf-murc m2">${MURCIELAGO}</i><i class="hwf-murc m3">${MURCIELAGO}</i>` +
    sil("0 0 400 100", `<g fill="#0b0218">${CASTILLO}</g>`),
  mansion: `<i class="hwf-nubes"></i><i class="hwf-lluvia"></i><i class="hwf-rayo">${RAYO}</i>` +
    sil("0 0 400 100", `<g fill="#03050b">${MANSION}</g><g fill="#fde68a">${VENTANAS}</g>`, "xMaxYMax") +
    `<i class="hwf-destello"></i>`,
  lunasangre: luna("l-sangre") + `<i class="hwf-bruma"></i>` +
    [1, 2, 3].map(i => `<i class="hwf-cuervo c${i}">${CUERVO}</i>`).join("") +
    sil("0 0 400 100", `<g fill="#0f0000">${BOSQUE}</g>`) + lucecitas(8, "hwf-brasa"),
  nocheeterna: `<i class="hwf-aurora"></i><i class="hwf-aurora a2"></i>` + luna("l-eterna") +
    [[12, 0], [30, -3], [55, -6.5], [72, -1.5], [90, -4.5]].map(([x, r], i) => `<i class="hwf-farol" style="left:${x}%;--r:${r}s;--d:${11 + i}s">${CALABAZA}</i>`).join("") +
    `<i class="hwf-fant f3">${FANTASMA}</i>` +
    sil("0 0 400 100", `<g fill="#03010f">${CASTILLO}</g>`)
};
