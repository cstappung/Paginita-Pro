/* Los marcos animados: los de campeón (uno por juego, para quien es el n.º 1
 * de cualquiera de sus tablas) y los cinco de la tienda.
 *
 * Cada uno es un SVG de 140×140 que se monta encima del avatar
 * (`<b class="jg-av-ad">`, inset −20 %): el centro es (70, 70) y la foto
 * llega al radio 50, así que el adorno vive entre 50 y 70 (y en las
 * esquinas, hasta ~95). El movimiento es CSS (juegos.html, `.jg-av-ad`):
 *
 *   .g / .gr   gira entero alrededor del centro (horario / antihorario)
 *   .l pulso · .f flota · .t titila · .b vaivén · .p aparece y se va
 *   .s gira sobre sí · .v voltea (scaleX) · .rv ficha de reversi
 *   .su sube y se apaga · .dr cae · .z tiembla · .hop salta · .ft pisada
 *   .hx destello · .wg aletea · .pp parpadea · .fl trazo que fluye
 *   .dw se dibuja y se borra (pathLength 100) · .ex onda que se expande
 *
 * Reglas que lo sostienen:
 * - Nada lleva `id` ni `url(#…)`: el mismo marco sale veinte veces en una
 *   tabla y dos degradados con el mismo id se pisan.
 * - **Nunca se anima un elemento que tenga atributo `transform`**: la
 *   animación CSS lo reemplaza y la pieza saltaría a la esquina. Por eso
 *   `en()` posiciona con un `<g transform>` y lo que se mueve va dentro.
 * - Los locales (`.l`, `.s`…) usan `transform-box: fill-box`, así que giran
 *   y laten sobre su propio centro esté donde esté.
 * - Dentro de `en(r, a, …, a)` el eje −y apunta hacia afuera del anillo y
 *   +x en el sentido del reloj: `.f` y `.su` mueven hacia afuera.
 */

const n1 = x => Math.round(x * 10) / 10;
/* Ángulo 0 arriba, en el sentido del reloj. */
const pt = (r, a) => { const t = a * Math.PI / 180; return [n1(70 + r * Math.sin(t)), n1(70 - r * Math.cos(t))]; };
const en = (r, a, cuerpo, rot) => {
  const [x, y] = pt(r, a);
  return `<g transform="translate(${x} ${y})${rot != null ? ` rotate(${n1(rot)})` : ""}">${cuerpo}</g>`;
};
const cada = (n, f) => Array.from({ length: n }, (_, i) => f(i, i * 360 / n)).join("");
const aro = (r, c, w, extra = "") => `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const arco = (r, a1, a2) => {
  const [x1, y1] = pt(r, a1), [x2, y2] = pt(r, a2);
  const g = ((a2 - a1) % 360 + 360) % 360;
  return `M${x1} ${y1}A${r} ${r} 0 ${g > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};
const trazo = (r, a1, a2, c, w, extra = "") => `<path d="${arco(r, a1, a2)}" fill="none" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const gira = (d, cuerpo, rev) => `<g class="${rev ? "gr" : "g"}" style="--d:${d}s">${cuerpo}</g>`;
const an = (cls, d, cuerpo, ret) => `<g class="${cls}" style="--d:${d}s${ret ? `;animation-delay:${ret}s` : ""}">${cuerpo}</g>`;
const tx = (t, tam, c, extra = "") => `<text x="0" y="0" font-size="${tam}" font-weight="800" font-family="system-ui,sans-serif" text-anchor="middle" dominant-baseline="central" fill="${c}" ${extra}>${t}</text>`;
/* Destello de cuatro puntas. */
const chispa = (s, c = "#fff") => `<path d="M0 ${-s}Q${s * .18} ${-s * .18} ${s} 0Q${s * .18} ${s * .18} 0 ${s}Q${-s * .18} ${s * .18} ${-s} 0Q${-s * .18} ${-s * .18} 0 ${-s}Z" fill="${c}"/>`;
const chispas = (lista, c) => lista.map(([r, a, s, d, ret]) => en(r, a, an("t", d, chispa(s, c), ret))).join("");
const llama = (c, k = 1) => `<path d="M0 ${4 * k}C${-4 * k} ${k} ${-3 * k} ${-3 * k} 0 ${-7 * k}C${3 * k} ${-3 * k} ${4 * k} ${k} 0 ${4 * k}Z" fill="${c}"/>`;
const rect = (w, h, rx, fill, extra = "") => `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;

/* ---------- Campeones ---------- */

function snake() {
  const cabeza = `<ellipse rx="7.5" ry="6" fill="#4ade80" stroke="#166534" stroke-width="1"/>
    <circle cx="2.5" cy="-3" r="1.9" fill="#fff"/><circle cx="2.5" cy="3" r="1.9" fill="#fff"/>
    <circle cx="3.2" cy="-3" r="1" fill="#111"/><circle cx="3.2" cy="3" r="1" fill="#111"/>
    ${an("t", .45, `<path d="M7 0h4.5m0 0l2-1.6m-2 1.6l2 1.6" stroke="#e11d48" stroke-width="1.1" fill="none" stroke-linecap="round"/>`)}`;
  const cuerpo = trazo(60, 22, 248, "#22c55e", 10, `stroke-linecap="round"`) +
    trazo(60, 22, 248, "#15803d", 10, `stroke-dasharray="1.6 5.4" opacity=".55"`) +
    trazo(60, 22, 248, "#bbf7d0", 2, `stroke-dasharray="3 9" opacity=".7"`) +
    trazo(60, 4, 24, "#22c55e", 5.5, `stroke-linecap="round"`) +
    en(60, 254, cabeza, 254);
  const manzana = `<circle r="5" fill="#ef4444" stroke="#7f1d1d" stroke-width=".8"/><path d="M0-5q1-3 3.5-3" stroke="#166534" stroke-width="1.2" fill="none"/><ellipse cx="2.6" cy="-6.6" rx="2" ry="1" fill="#22c55e"/><circle cx="-1.6" cy="-1.8" r="1.2" fill="#fff" opacity=".7"/>`;
  return aro(53, "#14532d", 3) + aro(67.5, "#14532d", 1, `stroke-dasharray="2 4" opacity=".6"`) +
    gira(6, cuerpo) + en(66, 135, an("l", 1.1, manzana));
}

function minas() {
  const num = ["", "1", "", "2", "", "", "3", "", "1", "", "2", "", "", "1", "", ""];
  const col = { 1: "#2563eb", 2: "#16a34a", 3: "#dc2626" };
  const fichas = cada(16, (i, a) => {
    const abierta = num[i] !== "" || i % 5 === 2;
    const f = abierta
      ? rect(11.5, 11.5, 1.2, "#e5e7eb", `stroke="#9ca3af" stroke-width=".7"`) + (num[i] ? tx(num[i], 8, col[num[i]]) : "")
      : rect(11.5, 11.5, 1.2, "#9ca3af", `stroke="#6b7280" stroke-width=".7"`) + `<path d="M-5.2 4.6V-5.2H4.6" stroke="#f3f4f6" stroke-width="1.2" fill="none"/>`;
    return i === 0 || i === 8 ? "" : en(60, a, f, a);
  });
  const bandera = rect(11.5, 11.5, 1.2, "#9ca3af", `stroke="#6b7280" stroke-width=".7"`) +
    `<path d="M-1.5 4.5V-5" stroke="#111" stroke-width="1"/><rect x="-4" y="3.6" width="6" height="1.4" fill="#111"/>` +
    an("b", 1.4, `<path d="M-1.4-5L4.5-2.6L-1.4-.4Z" fill="#ef4444"/>`);
  const mina = `<circle r="3.8" fill="#111"/>` + an("s", 3, cada(8, (i, a) => `<path d="M0 0L0-6" transform="rotate(${a})" stroke="#111" stroke-width="1.3"/>`)) + `<circle cx="-1.2" cy="-1.2" r="1.1" fill="#fff"/>`;
  const boom = an("p", 2.6, cada(10, (i, a) => `<path d="M0 0L0-${i % 2 ? 6 : 9}" transform="rotate(${a})" stroke="${i % 2 ? "#fde047" : "#f97316"}" stroke-width="2" stroke-linecap="round"/>`), -1.2);
  return aro(53, "#4b5563", 2.5) + fichas + en(60, 0, bandera) +
    en(60, 180, rect(11.5, 11.5, 1.2, "#fecaca", `stroke="#ef4444" stroke-width=".8"`) + an("l", 1.3, `<circle r="7" fill="#ef4444" opacity=".35"/>`) + mina) +
    en(68, 200, boom);
}

function tetris() {
  const P = [
    ["#22d3ee", [[0, 0], [1, 0], [2, 0], [3, 0]]], ["#facc15", [[0, 0], [1, 0], [0, 1], [1, 1]]],
    ["#a855f7", [[0, 0], [1, 0], [2, 0], [1, 1]]], ["#22c55e", [[1, 0], [2, 0], [0, 1], [1, 1]]],
    ["#ef4444", [[0, 0], [1, 0], [1, 1], [2, 1]]], ["#3b82f6", [[0, 0], [0, 1], [1, 1], [2, 1]]],
    ["#f97316", [[2, 0], [0, 1], [1, 1], [2, 1]]]
  ];
  const L = 4.6;
  const pieza = ([c, cs]) => {
    const w = Math.max(...cs.map(q => q[0])) + 1, h = Math.max(...cs.map(q => q[1])) + 1;
    return cs.map(([x, y]) => {
      const X = n1((x - w / 2) * L), Y = n1((y - h / 2) * L);
      return `<rect x="${X}" y="${Y}" width="${L}" height="${L}" fill="${c}" stroke="#0008" stroke-width=".5"/><path d="M${X + .6} ${n1(Y + L - .6)}V${Y + .6}H${n1(X + L - .6)}" stroke="#fff8" stroke-width=".7" fill="none"/>`;
    }).join("");
  };
  return aro(60, "#0f172a", 19) + an("hx", 2.4, aro(60, "#fff", 18, `opacity=".9"`)) +
    aro(50.6, "#334155", 1.2) + aro(69.4, "#334155", 1.2) +
    `<g class="g paso" style="--d:12s">${P.map((p, i) => en(60, i * 360 / 7, pieza(p), i * 360 / 7)).join("")}</g>`;
}

function sortem() {
  const bloques = cada(10, (i, a) => en(61, a, an("f", 1.6, rect(11, 11, 2.2, `hsl(${i * 36} 85% 55%)`, `stroke="hsl(${i * 36} 80% 30%)" stroke-width=".8"`) + tx(i + 1, 6.5, "#fff"), n1(-i * .16)), a));
  return aro(53, "#334155", 2.5) + aro(60.5, "#1e293b", 14, `opacity=".35"`) + gira(40, bloques);
}

function bbtan() {
  const C = ["#ff3b6b", "#ffb800", "#3bd6ff", "#9b5cff", "#4dff88", "#ff3b6b", "#3bd6ff", "#ffb800", "#9b5cff"];
  const bloques = C.map((c, i) => {
    const a = i * 40 + 10;
    return en(63, a, an("hx", 2, `<rect x="-4.5" y="-4.5" width="9" height="9" fill="none" stroke="${c}" stroke-width="1.6"/>` + tx(((i * 7) % 9) + 1, 5.5, c, `font-family="monospace"`), n1(-i * .23)), a);
  }).join("");
  const mas = (o, k) => `<path d="M-1 -3h2v2h2v2h-2v2h-2v-2h-2v-2h2z" fill="#fff" opacity="${o}" transform="scale(${k})"/>`;
  const bola = en(54.5, 0, mas(1, 1)) + en(54.5, -8, mas(.5, .8)) + en(54.5, -15, mas(.25, .6)) + en(54.5, -21, mas(.12, .45));
  return aro(60, "#0a0a12", 20) + aro(51, "#ff3b6b", 1.2, `stroke-dasharray="3 3"`) + aro(69, "#3bd6ff", 1.2, `stroke-dasharray="3 3"`) +
    bloques + gira(2.6, bola);
}

function sopa() {
  const letras = "SOPA·DE·LETRAS·ABC·".split("");
  const n = letras.length;
  const ls = letras.map((l, i) => { const a = i * 360 / n; return en(60, a, tx(l, 8.5, "#334155", `font-family="monospace"`), a); }).join("");
  return aro(60, "#fdf6e3", 18) + aro(51, "#d6c7a1", 1) + aro(69, "#d6c7a1", 1) +
    gira(14, trazo(60, 10, 70, "#fde047", 10, `stroke-linecap="round" opacity=".75"`)) +
    gira(18, trazo(60, 160, 215, "#86efac", 10, `stroke-linecap="round" opacity=".75"`), true) +
    ls;
}

function electro() {
  const resistencia = rect(11, 4.2, 1.6, "#e7d3a8", `stroke="#8a6d3b" stroke-width=".5"`) +
    ["#a52a2a", "#111", "#f97316", "#d4a017"].map((c, i) => `<rect x="${-3.4 + i * 2}" y="-2.1" width="1" height="4.2" fill="${c}"/>`).join("");
  const led = (c, ret) => `<circle r="3.6" fill="#0008"/>` + an("t", .9, `<circle r="2.8" fill="${c}"/><circle r="5" fill="${c}" opacity=".35"/>`, ret);
  const rayo = `<path d="M1-7L-3 1h3L-1 7L4-1H1Z" fill="#fde047" stroke="#a16207" stroke-width=".6"/>`;
  return aro(60, "#0b3d2e", 19) + aro(56, "#c08a3e", 1.4) + aro(64, "#c08a3e", 1.4) +
    `<g class="fl" style="--d:1.2s">${aro(56, "#fde047", 1.8, `stroke-dasharray="2 10" stroke-linecap="round"`)}</g>` +
    `<g class="fl fr" style="--d:1.6s">${aro(64, "#67e8f9", 1.8, `stroke-dasharray="2 10" stroke-linecap="round"`)}</g>` +
    [45, 135, 225, 315].map(a => en(60, a, resistencia, a)).join("") +
    [90, 180, 270].map((a, i) => en(60, a, led(["#ef4444", "#22c55e", "#3b82f6"][i], -i * .3))).join("") +
    cada(12, (i, a) => en(60, a + 15, `<circle r="1.1" fill="#d4a017"/>`)) +
    en(64, 0, an("p", 2.2, rayo));
}

/* Sudoku Arcade: un anillo de neón rosa con cuatro mini cuadrículas de
   3×3 (una casilla de cada una se enciende en cian por turnos), una
   corona de dígitos que gira despacio y un trazo cian que fluye. */
function sudoku() {
  // Una mini cuadrícula de 3×3 (12×12, casillas de 4): marco rosa, líneas
  // finas y una casilla `luz` que titila en cian con su propio retraso.
  const mini = (luz, ret) => rect(12, 12, 1.4, "#1a0620", `stroke="#ff2fb4" stroke-width="1"`) +
    `<path d="M-2-6V6M2-6V6M-6-2H6M-6 2H6" stroke="#ff2fb4" stroke-width=".45" opacity=".75"/>` +
    // La casilla encendida: su centro está en (−4, 0 o 4) según la posición 0..8.
    `<g transform="translate(${(luz % 3 - 1) * 4} ${(Math.floor(luz / 3) - 1) * 4})">` +
    an("t", 1.1, `<rect x="-1.8" y="-1.8" width="3.6" height="3.6" rx=".6" fill="#22e6ff"/>`, ret) + `</g>`;
  // Los nueve dígitos de la corona, en rosa y cian alternados.
  const corona = cada(9, (i, ang) => en(60, ang + 20, tx(String(i + 1), 6.5, i % 2 ? "#22e6ff" : "#ff8ad8"), ang + 20));
  return aro(60, "#14041c", 18) +                                       // la banda oscura del anillo
    aro(51.5, "#ff2fb4", 1.4) + aro(68.5, "#ff2fb4", 1.4) +             // los dos bordes de neón rosa
    `<g class="fl" style="--d:1.4s">${aro(68.5, "#22e6ff", 1.6, `stroke-dasharray="3 9" stroke-linecap="round"`)}</g>` + // trazo cian que corre
    gira(30, corona) +                                                  // la corona de dígitos gira despacio
    [0, 90, 180, 270].map((ang, i) => en(60, ang, mini([4, 0, 8, 2][i], n1(-i * .35)), ang)).join("") + // cuatro mini cuadrículas
    chispas([[66, 45, 2.4, 1.6, 0], [66, 225, 2.4, 1.6, -.8]], "#ffe3f4"); // dos destellos sueltos
}

/* FANAL: un anillo de noche índigo con estrellas que titilan, un farol
   abajo con su llama viva y tres polillas que dan vueltas hacia la luz. */
function fanal() {
  // Una polilla vista desde arriba, con las alas que aletean.
  const polilla = c => an("wg", .38, `<path d="M0 3.4L-1.2 .2L-5.6-3.4L-6.6 1.8L-1.4 2.4ZM0 3.4L1.2 .2L5.6-3.4L6.6 1.8L1.4 2.4Z" fill="${c}"/>`) +
    `<path d="M0-3.6V3.6" stroke="#3a2a22" stroke-width="1.6" stroke-linecap="round"/>`;
  // El farol: cuerpo de vidrio con marco de bronce, la llama y la barca.
  const farol = `<path d="M-8 9H8L6 12H-6Z" fill="#6b4a32"/>` +
    rect(9, 11, 1.4, "#2a1a10", `stroke="#d9a85b" stroke-width="1.3"`) +
    `<path d="M-5.5-6.5H5.5M-2.5-9H2.5" stroke="#d9a85b" stroke-width="1.5" stroke-linecap="round"/>` +
    an("t", .6, llama("#ffcf6b", .85)) + an("l", 1.3, `<circle r="2.2" cy="1" fill="#fff6d8"/>`);
  return aro(60, "#0b0a1c", 18) +                                        // la banda de noche
    aro(51.5, "#d9a85b", 1.2) + aro(68.5, "#6b4a32", 1.4) +              // bordes de bronce y madera
    `<g class="fl" style="--d:2.2s">${aro(68.5, "#ffcf6b", 1.3, `stroke-dasharray="2 10" stroke-linecap="round"`)}</g>` + // la luz que corre por el borde
    chispas([[60, 300, 2.2, 1.6, 0], [61, 330, 1.6, 2.1, -.6], [59, 20, 2, 1.8, -1.1], [60, 55, 1.5, 2.4, -.3], [61, 90, 1.8, 1.7, -1.5]], "#ffe8c2") +
    gira(9, [0, 120, 240].map((a, i) => en(60, a, polilla(["#b8a088", "#c47a3c", "#9a4a62"][i]), a + 90)).join("")) + // las polillas giran
    en(61, 180, farol);                                                  // el farol, abajo
}

/* Atasco: una pista de asfalto alrededor de la foto con su línea
   discontinua que corre, el auto rojo dando la vuelta, un semáforo arriba
   que pasa de rojo a amarillo a verde y el cartel azul de «P» abajo. */
function atasco() {
  // El auto rojo visto desde arriba (14×8): carrocería, parabrisas, techo y franjas.
  const auto = rect(14, 8, 2.6, "#e8322f", `stroke="#1d2330" stroke-width="1"`) +
    `<rect x="2" y="-3" width="2" height="6" rx=".6" fill="#9fd6ff"/><rect x="-3.5" y="-2.6" width="5.2" height="5.2" rx="1" fill="#b71f1d"/>` +
    `<path d="M-6.5-.9H6.5M-6.5 .9H6.5" stroke="#fff" stroke-width=".6" opacity=".85"/>`;
  // El semáforo: caja oscura y tres luces que se encienden por turnos.
  const luz = (y, c, ret) => an("t", 2.4, `<circle cy="${y}" r="2.1" fill="${c}"/>`, ret);
  const semaforo = rect(7, 19, 2, "#1d2330", `stroke="#f5b700" stroke-width=".9"`) +
    `<circle cy="-5.6" r="2.1" fill="#3a2020"/><circle r="2.1" fill="#3a3420"/><circle cy="5.6" r="2.1" fill="#1e3a26"/>` +
    luz(-5.6, "#ff4d4d", 0) + luz(0, "#ffd84d", -1.6) + luz(5.6, "#4dff8a", -.8);
  // El cartel de estacionamiento.
  const cartel = rect(12, 12, 2.4, "#2f6fde", `stroke="#fff" stroke-width="1.2"`) + tx("P", 9, "#fff");
  return aro(60, "#474c56", 18) +                                       // la pista de asfalto
    aro(51.5, "#f5b700", 1.4) + aro(68.5, "#f5b700", 1.4) +             // los bordes amarillos del cordón
    `<g class="fl" style="--d:1.6s">${aro(60, "#ffffffcc", 1.2, `stroke-dasharray="4 5"`)}</g>` + // la línea del carril que corre
    gira(5, en(60, 0, auto, 90)) +                                       // el auto rojo da la vuelta
    en(61, 0, semaforo) + en(61, 180, cartel) +                          // el semáforo arriba y la «P» abajo
    chispas([[66, 70, 2, 1.6, 0], [66, 290, 2, 1.9, -.7]], "#fff3b0");  // dos destellos de faros
}

/* ALETEO: un anillo de cielo que se oscurece de día a noche, dos tubos
   verdes con su boca, y el pajarito amarillo que da la vuelta aleteando;
   una luna roja abajo y dos plumas que caen. */
function aleteo() {
  const pajaro = `<ellipse rx="6.5" ry="5.2" fill="#ffd23f" stroke="#3a2a0a" stroke-width=".9"/>` +
    `<ellipse cx="1" cy="1.8" rx="3.6" ry="2.3" fill="#fff4c2"/>` +
    an("wg", .35, `<ellipse cx="-2.4" cy="-.4" rx="3.2" ry="2.1" fill="#ffae12" stroke="#3a2a0a" stroke-width=".6"/>`) +
    `<circle cx="2.6" cy="-2" r="1.9" fill="#fff"/><circle cx="3.2" cy="-2" r=".9" fill="#111"/>` +
    `<path d="M5.4 -.4L9.6 .6L5.4 1.8Z" fill="#ff7a1a" stroke="#3a2a0a" stroke-width=".5"/>`;
  const tubo = rect(10, 18, 1, "#6fd04b", `stroke="#24451a" stroke-width="1"`) +
    `<rect x="-6.5" y="-9" width="13" height="4.5" rx="1" fill="#86e05c" stroke="#24451a" stroke-width="1"/>` +
    `<rect x="-3" y="-4" width="2" height="12" fill="#c2f58a" opacity=".7"/>`;
  const pluma = `<path d="M0-3C2-1 2 1 0 3C-2 1-2-1 0-3Z" fill="#fff4c2" stroke="#9e7a2a" stroke-width=".4"/>`;
  return trazo(60, 270, 90, "#3fb6f5", 16) + trazo(60, 90, 270, "#1b244f", 16) +
    aro(51.5, "#24451a", 1.2) + aro(68.5, "#24451a", 1.2) +
    en(60, 0, an("l", 2.6, `<circle r="4.5" fill="#ffe46b"/>`)) +
    en(60, 180, an("l", 1.9, `<circle r="4.3" fill="#ff2b2b"/><circle cx="1.6" cy="-1" r="3.4" fill="#4c0a13"/>`)) +
    en(60, 60, tubo, 0) + en(60, 240, tubo, 180) +
    en(66, 125, an("dr", 2.8, pluma)) + en(64, 300, an("dr", 3.4, pluma, -1.2)) +
    gira(6, en(60, 0, an("f", .7, pajaro), 90)) +
    chispas([[66, 30, 2, 1.7, 0], [67, 210, 1.8, 2.1, -.8]], "#ffffff");
}

/* 2048: un anillo de fichas del tablero, del 2 al 2048 en sus colores,
   que da la vuelta despacio, con la ficha dorada latiendo arriba. */
function dosmil() {
  const cols = ["#eee4da", "#ede0c8", "#f2b179", "#f59563", "#f67c5f", "#f65e3b", "#edcf72", "#edcc61", "#edc850", "#edc53f", "#edc22e", "#b784d6"];
  const fichas = cada(12, (i, a) => en(60, a, rect(13, 13, 2, cols[i], `stroke="#8f7a66" stroke-width=".8"`), a));
  return gira(24, fichas) +
    en(60, 0, an("l", 1.6, `<rect x="-9" y="-9" width="18" height="18" rx="3" fill="#edc22e" stroke="#c9a21a" stroke-width="1.2"/><text y="2.6" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="6.5" fill="#fff">2048</text>`)) +
    chispas([[66, 40, 2, 1.7, 0], [66, 220, 1.8, 2.1, -.8]], "#fff3b0");
}

/* Trigon: un anillo de triángulos de la grilla, alternando punta arriba y
   punta abajo en los colores de las piezas, que gira despacio, con un
   hexágono (el tablero) latiendo arriba y dos destellos sueltos. */
function trigon() {
  // Los colores de las piezas, uno por triángulo, repetidos en el anillo.
  const cols = ["#ff5d73", "#ffb84d", "#ffe45c", "#5ee38a", "#4dc3ff", "#a77bff"];
  // Doce triángulos en el radio 60: los pares apuntan hacia afuera y los
  // impares hacia adentro, como quedan en una grilla triangular.
  const tri = i => `<path d="${i % 2 ? "M-7-6H7L0 6Z" : "M-7 6H7L0-6Z"}" fill="${cols[i % 6]}" stroke="#1d2340" stroke-width=".8" stroke-linejoin="round"/>`;
  const anillo = cada(12, (i, a) => en(60, a, tri(i), a));
  // El tablero: un hexágono con sus tres diagonales, que late arriba.
  const hexa = `<path d="M0-8L7-4V4L0 8L-7 4V-4Z" fill="#1d2340" stroke="#ffe45c" stroke-width="1.2"/>` +
    `<path d="M0-8V8M7-4L-7 4M-7-4L7 4" stroke="#ffe45c" stroke-width=".5" opacity=".7"/>`;
  return gira(26, anillo) +                                              // el anillo gira despacio
    en(60, 0, an("l", 1.6, hexa)) +                                      // el hexágono late arriba
    chispas([[66, 50, 2, 1.7, 0], [66, 230, 1.8, 2.1, -.8]], "#fff3b0"); // dos destellos sueltos
}

/* Metro Rush: un anillo de vía (balasto, durmientes de madera y dos rieles
   de acero) por el que da vueltas un trencito naranja, visto desde arriba,
   con los focos encendidos, persiguiendo una moneda dorada que gira; un
   brillo corre por el riel y salta un destello suelto. */
function metrorush() {
  // Los durmientes: tablas atravesadas bajo los dos rieles (el eje y del
  // dibujo es el radio, así que una tabla alta queda de través).
  const durmientes = cada(24, (i, a) => en(60, a, rect(3.2, 16, .6, "#8a5e3c", `stroke="#4a3020" stroke-width=".5"`), a));
  // Un foco que late; la posición va en un <g transform> aparte porque lo
  // animado no puede llevar su propio transform.
  const foco = y => `<g transform="translate(9.6 ${y})">${an("l", .8, `<circle r="1.4" fill="#fff6c2"/>`)}</g>`;
  // La locomotora: cuerpo naranja, techo claro con rejillas, el parabrisas
  // adelante (+x, que es el sentido en que gira), los dos focos y su haz.
  const loco = rect(20, 11, 2.6, "#ff6a3d", `stroke="#8a2a10" stroke-width=".8"`) +
    `<rect x="-8" y="-3" width="12" height="6" rx="1.2" fill="#ffb08f"/>` +
    `<path d="M-5.5-3V3M-2-3V3" stroke="#c94a24" stroke-width=".6"/>` +
    `<rect x="5.2" y="-4" width="3" height="8" rx="1" fill="#1f2a3a"/>` +
    foco(-3.4) + foco(3.4) +
    an("hx", 1, `<path d="M10.4-3.4L17-6.4V-.8ZM10.4 3.4L17 .8V6.4Z" fill="#fff6c2" opacity=".4"/>`);
  // El vagón de atrás, un poco más corto, con su enganche.
  const vagon = rect(17, 10, 2, "#e85a30", `stroke="#8a2a10" stroke-width=".8"`) +
    `<rect x="-6.5" y="-2.6" width="13" height="5.2" rx="1" fill="#ffd0bd"/>` +
    `<path d="M-2.2-2.6V2.6M2.2-2.6V2.6" stroke="#e85a30" stroke-width=".6"/>` +
    `<path d="M8.5 0H11" stroke="#4a3020" stroke-width="1.4"/>`;
  // La moneda: dorada, con su canto claro y una raya, girando sobre sí.
  const moneda = an("v", 1.2, `<circle r="4.6" fill="#ffc83d" stroke="#b07a10" stroke-width="1"/>` +
    `<circle r="2.9" fill="none" stroke="#fff1b8" stroke-width=".7"/><rect x="-.8" y="-2.2" width="1.6" height="4.4" fill="#d99a1c"/>`);
  return aro(60, "#2a2622", 19) +                                         // el balasto, gris oscuro
    durmientes +                                                          // los durmientes de madera
    aro(55, "#b8bec8", 1.8) + aro(65, "#b8bec8", 1.8) +                   // los dos rieles de acero
    aro(55, "#ffffff", .5, `opacity=".5"`) + aro(65, "#ffffff", .5, `opacity=".5"`) + // su filo brillante
    `<g class="fl" style="--d:1.6s">${aro(65, "#ffffff", 1, `stroke-dasharray="2 10" stroke-linecap="round" opacity=".8"`)}</g>` + // un brillo que corre por el riel
    aro(50.5, "#3a2a20", 1.2) + aro(69.5, "#ff6a3d", 1.3) +               // borde de adentro oscuro, el de afuera naranja
    gira(9, en(60, 0, loco, 0) + en(60, -20, vagon, -20) + en(60, 30, moneda)) + // el tren persigue a la moneda
    chispas([[66, 150, 2.6, 1.5, 0], [64, 255, 2, 1.9, -.7]], "#fff4d6"); // los destellos
}

function frontera() {
  const sim = [
    `<path d="M0-2.8L.8-.8L2.8-.8L1.2.5L1.8 2.6L0 1.3L-1.8 2.6L-1.2.5L-2.8-.8L-.8-.8Z"/>`,
    `<path d="M0-3L3 0L0 3L-3 0Z"/>`, `<path d="M0-3L2.8 2.4H-2.8Z"/>`,
    `<circle r="2.6"/>`, `<path d="M-2.6-1.5L0-3L2.6-1.5V1.5L0 3L-2.6 1.5Z"/>`,
    `<path d="M-1-3H1V-1H3V1H1V3H-1V1H-3V-1H-1Z"/>`, `<path d="M0 2.8L-2.8 0A1.6 1.6 0 0 1 0-2A1.6 1.6 0 0 1 2.8 0Z"/>`
  ];
  const medalla = (s, i) => `<circle r="6.2" fill="#f4c542" stroke="#8a5a0a" stroke-width="1"/><circle r="4.6" fill="none" stroke="#fff3b0" stroke-width=".6"/><g fill="#8a5a0a">${s}</g>` +
    an("hx", 2.8, `<circle r="6.2" fill="#fff" opacity=".55"/>`, n1(-i * .4));
  const torre = `<path d="M-4 7V-3L-5-3V-6H5V-3L4-3V7Z" fill="#1e3a8a" stroke="#f4c542" stroke-width=".8"/><path d="M-5-6V-8H-3V-6M-1-6V-8H1V-6M3-6V-8H5V-6" fill="#1e3a8a" stroke="#f4c542" stroke-width=".6"/>` +
    an("t", 1.4, `<rect x="-1.2" y="-1.5" width="2.4" height="3.2" fill="#fde047"/>`);
  return aro(54, "#1e3a8a", 5) + aro(60, "#0f1d4a", 8, `opacity=".45"`) + aro(66.5, "#f4c542", 1.6) +
    gira(24, sim.map((s, i) => en(60, i * 360 / 7 + 26, medalla(s, i))).join("")) + en(64, 0, torre);
}

function pokemon() {
  const anillo = trazo(60, 270, 90, "#ef4444", 15) + trazo(60, 90, 270, "#f8fafc", 15) +
    en(60, 90, rect(15, 2.4, 0, "#111"), 90) + en(60, 270, rect(15, 2.4, 0, "#111"), 270) +
    en(60, 90, `<circle r="5.6" fill="#f8fafc" stroke="#111" stroke-width="1.6"/>` + an("l", 1.2, `<circle r="2.6" fill="#e5e7eb" stroke="#111" stroke-width=".6"/>`)) +
    en(60, 270, `<circle r="5.6" fill="#f8fafc" stroke="#111" stroke-width="1.6"/><circle r="2.6" fill="#e5e7eb" stroke="#111" stroke-width=".6"/>`);
  const mini = `<path d="M-4 0A4 4 0 0 1 4 0Z" fill="#ef4444"/><path d="M-4 0A4 4 0 0 0 4 0Z" fill="#fff"/><circle r="4" fill="none" stroke="#111" stroke-width=".8"/><path d="M-4 0H4" stroke="#111" stroke-width=".8"/><circle r="1.2" fill="#fff" stroke="#111" stroke-width=".6"/>`;
  return aro(52.2, "#111", 1.8) + aro(67.8, "#111", 1.8) + gira(16, anillo) +
    gira(4.5, en(60, 0, an("s", 1.2, mini)) + en(60, 180, an("s", 1.2, mini)), true) +
    chispas([[69, 30, 3, 1.6, 0], [69, 150, 2.4, 1.9, -.5], [69, 220, 3, 1.4, -.9], [69, 320, 2.4, 2.1, -.3]], "#fde047");
}

function escondite() {
  const arbusto = (c) => `<circle cx="-4.5" cy="1" r="5" fill="${c}"/><circle cx="4.5" cy="1" r="5" fill="${c}"/><circle cx="0" cy="-2.5" r="6" fill="${c}"/><circle cx="-2" cy="-4" r="2" fill="#fff" opacity=".18"/>`;
  const ojos = (ret) => an("pp", 3.2, `<ellipse cx="-2" cy="-.5" rx="1.6" ry="2" fill="#fff"/><ellipse cx="2" cy="-.5" rx="1.6" ry="2" fill="#fff"/><circle cx="-1.6" cy="-.2" r=".9" fill="#111"/><circle cx="2.4" cy="-.2" r=".9" fill="#111"/>`, ret);
  const tonos = ["#3f7d20", "#4d8f2a", "#2f6b1a"];
  const matas = cada(9, (i, a) => en(61, a, arbusto(tonos[i % 3]) + (i % 3 === 1 ? ojos(n1(-i * .37)) : ""), a));
  const binoculares = `<circle cx="-3" r="3.4" fill="#1f2937"/><circle cx="3" r="3.4" fill="#1f2937"/><rect x="-1.2" y="-1.4" width="2.4" height="2.8" fill="#374151"/><circle cx="-3" r="2" fill="#60a5fa"/><circle cx="3" r="2" fill="#60a5fa"/><circle cx="-3.6" cy="-.7" r=".7" fill="#fff"/><circle cx="2.4" cy="-.7" r=".7" fill="#fff"/>`;
  return aro(53, "#365314", 3) + aro(61, "#a3e635", 16, `opacity=".25"`) + matas + gira(9, en(68, 20, binoculares, 20));
}

function cartas() {
  const fuego = an("l", .6, llama("#f97316", 1.1) + llama("#fde047", .55));
  const gota = an("f", 1.4, `<path d="M0-6C3-2 4 0 4 2A4 4 0 0 1-4 2C-4 0-3-2 0-6Z" fill="#bfdbfe" stroke="#1e40af" stroke-width=".8"/>`);
  const copo = an("s", 4, cada(3, (i, a) => `<path d="M0-6V6M-1.8-4.2L0-2.4L1.8-4.2M-1.8 4.2L0 2.4L1.8 4.2" transform="rotate(${a})" stroke="#0369a1" stroke-width="1" fill="none" stroke-linecap="round"/>`));
  const anillo = trazo(60, 2, 118, "#ef4444", 13, `stroke-linecap="round"`) +
    trazo(60, 122, 238, "#3b82f6", 13, `stroke-linecap="round"`) +
    trazo(60, 242, 358, "#bae6fd", 13, `stroke-linecap="round"`) +
    en(60, 60, `<circle r="7.5" fill="#7f1d1d"/>` + fuego) +
    en(60, 180, `<circle r="7.5" fill="#1e3a8a"/>` + gota) +
    en(60, 300, `<circle r="7.5" fill="#f0f9ff"/>` + copo);
  return aro(52.5, "#111827", 2) + aro(67.5, "#111827", 2) + gira(14, anillo);
}

function cuadritos() {
  const lado = [8, 30, 52, 74, 96, 118, 140].map(v => v - 4);
  const puntos = lado.flatMap(x => lado.map(y => (x === lado[0] || x === lado[6] || y === lado[0] || y === lado[6]) ? `<circle cx="${x}" cy="${y}" r="2" fill="#334155"/>` : "")).join("");
  const a = lado[0], b = lado[6];
  const cajas = [[a, a, "#ef4444"], [b - 22, a, "#3b82f6"], [b - 22, b - 22, "#22c55e"], [a, b - 22, "#f59e0b"]]
    .map(([x, y, c], i) => `<g class="p" style="--d:4s;animation-delay:${-i}s"><rect x="${x + 2}" y="${y + 2}" width="18" height="18" rx="2" fill="${c}" opacity=".85"/></g>`).join("");
  return `<rect x="${a}" y="${a}" width="${b - a}" height="${b - a}" rx="4" fill="#f8fafc" opacity=".14"/>` + cajas +
    `<g class="dw" style="--d:4s"><rect x="${a}" y="${a}" width="${b - a}" height="${b - a}" fill="none" stroke="#6366f1" stroke-width="2.4" stroke-linecap="round" pathLength="100" stroke-dasharray="100 100"/></g>` +
    puntos + aro(52.5, "#334155", 2);
}

function reversi() {
  const fichas = cada(12, (i, a) => en(60, a, `<circle r="6" fill="#0006"/><circle class="rv" style="--d:4.8s;animation-delay:${n1(-i * .4)}s" r="5.3" fill="#111" stroke="#000" stroke-width=".6"/>`));
  return aro(60, "#166534", 20) + aro(50.5, "#052e16", 1.4) + aro(69.5, "#052e16", 1.4) +
    cada(12, (i, a) => en(60, a + 15, `<path d="M0-10V10" stroke="#052e16" stroke-width=".8"/>`, a + 15)) + fichas;
}

function orbita() {
  const estrellas = chispas([[67, 20, 1.8, 1.3, 0], [68, 80, 1.4, 1.7, -.4], [66, 140, 2, 2.1, -.8], [68, 200, 1.4, 1.5, -.2], [67, 260, 1.8, 1.9, -1], [68, 320, 1.4, 1.2, -.6]], "#fef9c3");
  const sonda = en(60, 0, `<path d="M-2.5-2L3 0L-2.5 2Z" fill="#e5e7eb"/><rect x="-5" y="-.5" width="3" height="1" fill="#93c5fd"/>`, 0) +
    trazo(60, -38, -4, "#e5e7eb", 1.2, `stroke-linecap="round" opacity=".5" stroke-dasharray="1 2"`);
  return aro(60, "#0b1026", 20) + aro(55, "#ffffff", .6, `opacity=".3" stroke-dasharray="1.5 2.5"`) + aro(65, "#ffffff", .6, `opacity=".3" stroke-dasharray="1.5 2.5"`) +
    aro(52, "#fbbf24", 2.5, `opacity=".8"`) + estrellas +
    gira(5, en(55, 0, `<circle r="3" fill="#60a5fa"/><circle cx="-.8" cy="-.8" r="1" fill="#fff" opacity=".6"/>`)) +
    gira(9, en(65, 120, `<circle r="4" fill="#f87171"/><ellipse rx="7" ry="1.6" fill="none" stroke="#fde68a" stroke-width=".9" transform="rotate(-25)"/>`)) +
    gira(13, en(65, 300, `<circle r="2.4" fill="#a78bfa"/>`), true) +
    gira(3.2, sonda);
}

function cadena() {
  const C = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"];
  const grupo = (c, k, i) => {
    const pos = [[[0, 0]], [[-2.2, 0], [2.2, 0]], [[0, -2.4], [-2.2, 1.4], [2.2, 1.4]]][k];
    return an("z", .3 + k * .1, an("s", 3 - k * .7, pos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}"/><circle cx="${x - .8}" cy="${y - .8}" r=".8" fill="#fff" opacity=".7"/>`).join("")), n1(-i * .1));
  };
  return aro(60, "#111827", 20) +
    cada(12, (i, a) => en(60, a + 15, `<path d="M0-10V10" stroke="#374151" stroke-width=".8"/>`, a + 15)) +
    aro(60, "#374151", .8) +
    cada(6, (i, a) => en(60, a + 30, an("ex", 2.4, `<circle r="5" fill="none" stroke="${C[i]}" stroke-width="1.6"/>`, n1(-i * .4)))) +
    cada(6, (i, a) => en(60, a, grupo(C[i], i % 3, i))) +
    aro(50.4, C[0], 1.2, `opacity=".8"`);
}

function flip() {
  const naipe = (k, i) => {
    const c = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#0ea5e9", "#ec4899"][i];
    return an("v", 2.4, rect(9.5, 13, 1.6, "#fff", `stroke="${c}" stroke-width="1.1"`) + tx(k, 7, c), n1(-i * .34));
  };
  const siete = tx("7", 17, "#fde047", `stroke="#7c2d12" stroke-width="1.2" paint-order="stroke" font-family="Georgia,serif"`);
  return aro(59, "#0f5132", 17) + aro(67.5, "#d4a017", 1.6) + aro(50.6, "#d4a017", 1.2) +
    gira(16, cada(7, (i, a) => en(59, a, naipe([1, 3, 5, 8, 10, 12, 2][i], i), a))) +
    en(65, 0, an("l", 1.4, `<circle r="9" fill="#fde047" opacity=".25"/>` + siete));
}

function cacho() {
  const pips = { 1: [[0, 0]], 2: [[-2, -2], [2, 2]], 3: [[-2, -2], [0, 0], [2, 2]], 4: [[-2, -2], [2, -2], [-2, 2], [2, 2]], 5: [[-2, -2], [2, -2], [0, 0], [-2, 2], [2, 2]], 6: [[-2, -2.2], [2, -2.2], [-2, 0], [2, 0], [-2, 2.2], [2, 2.2]] };
  const dado = (k) => rect(9, 9, 2, "#fff", `stroke="#78350f" stroke-width=".7"`) + pips[k].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${k === 1 ? 1.5 : .95}" fill="${k === 1 ? "#dc2626" : "#111"}"/>`).join("");
  const dados = [1, 5, 3, 6, 2, 4].map((k, i) => {
    const a = 30 + i * 50;
    return en(60, a, an("f", 1.8, an("s", 2.6 + i * .5, dado(k), n1(-i * .6)), n1(-i * .3)));
  }).join("");
  const cubilete = `<path d="M-6-7H6L4.6 7H-4.6Z" fill="#3b1d0b" stroke="#d6a76c" stroke-width=".8"/><rect x="-6.8" y="-8.6" width="13.6" height="2.4" rx="1" fill="#5c2d0e" stroke="#d6a76c" stroke-width=".6"/><path d="M-5-2.5H5" stroke="#d6a76c" stroke-width=".5" stroke-dasharray="1 1"/>`;
  return aro(60, "#7c4a1e", 19) + aro(54, "#f5deb3", .8, `stroke-dasharray="2.5 2"`) + aro(66, "#f5deb3", .8, `stroke-dasharray="2.5 2"`) +
    dados + en(62, 0, an("b", 1.6, cubilete));
}

function uno() {
  const cuarto = [["#ef4444", 315], ["#3b82f6", 45], ["#facc15", 135], ["#22c55e", 225]];
  const anillo = cuarto.map(([c, a]) => trazo(60, a, a + 90, c, 18)).join("") +
    cada(4, (i, a) => en(60, a + 45, rect(18, 1.6, 0, "#111"), a + 45));
  const flecha = `<path d="M-2-3L2 0L-2 3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const carta = (c, t, i) => an("b", 2, rect(10, 14, 1.8, "#fff", `stroke="#111" stroke-width=".6"`) + rect(7.6, 11.6, 1.2, c) +
    `<ellipse rx="3.2" ry="4.8" fill="#fff" transform="rotate(25)"/>` + tx(t, 5, c), n1(-i * .5));
  return aro(52, "#111", 2) + aro(68, "#111", 2) + gira(30, anillo) + gira(5, cada(10, (i, a) => en(60, a, flecha, a))) +
    en(70, 45, carta("#ef4444", "+2", 0), 45) + en(70, 135, carta("#3b82f6", "↺", 1), 135) +
    en(70, 225, carta("#facc15", "7", 2), 225) + en(70, 315, carta("#22c55e", "+4", 3), 315);
}

function catan() {
  const T = ["#2f7d32", "#8bc34a", "#f2c94c", "#c0613b", "#8d99a6", "#e9d8a6"];
  const hex = (c) => `<path d="M0-7L6.1-3.5V3.5L0 7L-6.1 3.5V-3.5Z" fill="${c}" stroke="#f5e6c8" stroke-width=".9"/>`;
  const fichas = { 1: 6, 4: 8, 7: 5, 10: 9 };
  const hexes = cada(12, (i, a) => en(60, a, an("hx", 3.6, hex(T[i % 6]), n1(-i * .3)) + (fichas[i] ? `<circle r="2.8" fill="#fdf6e3" stroke="#78350f" stroke-width=".4"/>` + tx(fichas[i], 3.4, fichas[i] === 6 || fichas[i] === 8 ? "#dc2626" : "#111") : ""), a));
  const ladron = `<circle cy="-5" r="2.4" fill="#374151"/><path d="M-3.4 5C-3.4 0-2-2.6 0-2.6S3.4 0 3.4 5Z" fill="#374151"/><rect x="-4" y="4.4" width="8" height="1.6" rx=".6" fill="#1f2937"/>`;
  return aro(60, "#1d6fa5", 21) + aro(60, "#7dd3fc", .6, `opacity=".5" stroke-dasharray="1 4"`) + hexes + en(67, 0, an("f", 1.6, ladron));
}

function presidente() {
  const corona = `<path d="M-8 4L-9-5L-4-1L0-7L4-1L9-5L8 4Z" fill="#fde047" stroke="#a16207" stroke-width=".9" stroke-linejoin="round"/><circle cx="0" cy="1" r="1.4" fill="#dc2626"/><circle cx="-4.6" cy="1.6" r="1" fill="#2563eb"/><circle cx="4.6" cy="1.6" r="1" fill="#2563eb"/>`;
  const abanico = [-30, -15, 0, 15, 30].map((g, i) => `<g transform="rotate(${g})"><rect x="-3.6" y="-12" width="7.2" height="10" rx="1" fill="#fff" stroke="#4c1d95" stroke-width=".6"/><text x="0" y="-7" font-size="4.4" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="${i % 2 ? "#111" : "#dc2626"}">${["2", "A", "K", "Q", "J"][i]}</text></g>`).join("");
  return aro(60, "#5b21b6", 14) + aro(52.5, "#d4a017", 1.8) + aro(67.5, "#d4a017", 1.8) +
    gira(20, cada(16, (i, a) => en(60, a, `<circle r=".9" fill="#fde68a"/>`))) +
    en(65, 0, an("f", 1.8, corona)) + en(68, 180, an("b", 2.2, abanico)) +
    chispas([[64, 60, 3, 1.4, 0], [64, 120, 2.4, 1.8, -.5], [64, 240, 2.4, 1.6, -.8], [64, 300, 3, 2, -.2]], "#fde68a");
}

function spicy() {
  const llamas = cada(14, (i, a) => en(57, a, an("su", 1.3 + (i % 3) * .2, llama(["#ef4444", "#f97316", "#fde047"][i % 3], 1.2), n1(-i * .19)), a));
  const aji = `<path d="M-7 1C-4 6 4 5 8-2C5 1 0 2-6-1Z" fill="#dc2626" stroke="#7f1d1d" stroke-width=".7"/><path d="M-7 1C-8 0-9-1-9-3" stroke="#15803d" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M-3 1.6C0 2.6 3 2 5-.4" stroke="#fca5a5" stroke-width=".8" fill="none"/>`;
  const wasabi = `<path d="M-6 3C-7-1-3-5 0-4C3-6 7-2 6 3Z" fill="#84cc16" stroke="#3f6212" stroke-width=".7"/><circle cx="-1.5" cy="-1.5" r="1" fill="#ecfccb"/>`;
  return llamas + an("hx", 1.2, aro(55, "#fb923c", 9, `opacity=".45"`)) + aro(53, "#7f1d1d", 4) +
    en(67, 45, an("b", .7, aji)) + en(67, 315, an("l", 1.3, wasabi));
}

function worms() {
  const tierra = trazo(62, 108, 252, "#8b5a2b", 14) + trazo(68.4, 108, 252, "#4ade80", 2.2) + trazo(57, 120, 240, "#6b4423", 3, `stroke-dasharray="2 3"`);
  const gusano = `<path d="M-6 6C-6 0-3-1-1-1C2-1 2-6 2-8" stroke="#f9a8d4" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M-.4-7.4H4.6" stroke="#dc2626" stroke-width="1.6"/><circle cx="2.8" cy="-8.6" r="1" fill="#fff"/><circle cx="3.1" cy="-8.6" r=".5" fill="#111"/>`;
  const misil = `<rect x="-5" y="-1.6" width="9" height="3.2" rx="1.2" fill="#9ca3af"/><path d="M4-1.6L7 0L4 1.6Z" fill="#ef4444"/><path d="M-5-1.6L-7-3.2V3.2L-5 1.6Z" fill="#4b5563"/>` +
    an("t", .2, `<path d="M-7-1.4L-11 0L-7 1.4Z" fill="#fb923c"/>`);
  const humo = cada(4, (i) => en(60, -9 - i * 6, an("su", 1, `<circle r="${2 + i * .5}" fill="#d1d5db" opacity=".6"/>`, n1(-i * .25))));
  const boom = an("p", 2.4, `<circle r="6" fill="#f97316"/><circle r="3.4" fill="#fde047"/>` + cada(8, (i, a) => `<path d="M0-5V-9" transform="rotate(${a})" stroke="#f97316" stroke-width="1.6" stroke-linecap="round"/>`));
  return aro(53, "#1e3a8a", 2.5) + tierra + en(64, 180, an("f", 1.4, gusano)) +
    gira(4, en(60, 0, misil, 0) + humo) + en(64, 140, boom) + en(64, 220, an("p", 2.4, `<circle r="5" fill="#f97316"/><circle r="2.8" fill="#fde047"/>`, -1.2));
}

function yemas() {
  const huevo = (c, i) => an("f", 1.5, `<ellipse rx="4.6" ry="6" fill="${c}" stroke="#0004" stroke-width=".6"/><ellipse cx="-1.4" cy="-2.2" rx="1.2" ry="1.8" fill="#fff" opacity=".6"/>`, n1(-i * .3));
  const mira = an("l", 1, `<circle r="5.6" fill="none" stroke="#ef4444" stroke-width="1.3"/><path d="M0-8.5V-3M0 3V8.5M-8.5 0H-3M3 0H8.5" stroke="#ef4444" stroke-width="1.3"/><circle r="1" fill="#ef4444"/>`);
  const frito = `<path d="M-8 1C-9-4-4-7 0-6C5-8 9-3 8 1C9 5 3 8-1 6C-5 8-9 5-8 1Z" fill="#fff" stroke="#e5e7eb" stroke-width=".5"/>` + an("l", 1.8, `<circle cx="1" r="3.4" fill="#f59e0b"/><circle cx="0" cy="-1" r="1" fill="#fde68a"/>`);
  const C = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b"];
  return aro(53, "#f59e0b", 3) + aro(61, "#fef3c7", 14, `opacity=".3"`) +
    C.map((c, i) => en(62, 72 + i * 54, huevo(c, i))).join("") + en(64, 0, frito) + gira(7, en(60, 40, mira));
}

/* Boxhead: cabezas cuadradas en el anillo, un barril que tiembla y
   casquillos que caen. */
function gato() {
  // Una pizarra en anillo con equis y círculos de tiza que se dibujan y se borran.
  const tiza = "#f1efe6";
  const x = `<path d="M-4.5-4.5L4.5 4.5M4.5-4.5L-4.5 4.5" stroke="${tiza}" stroke-width="1.6" stroke-linecap="round" fill="none" pathLength="100" stroke-dasharray="100 100"/>`;
  const o = `<circle r="4.6" stroke="#ffe08a" stroke-width="1.6" fill="none" pathLength="100" stroke-dasharray="100 100"/>`;
  const marcas = cada(8, (i, a) => en(60, a + 22.5, an("dw", 4, i % 2 ? o : x, n1(-i * .5))));
  const rejas = cada(8, (i, a) => en(60, a, `<path d="M0-8V8" stroke="${tiza}" stroke-width=".9" opacity=".55" stroke-linecap="round"/>`, a));
  return aro(60, "#2b4a3a", 20) + aro(50.5, "#7a4e2a", 2.4) + aro(69.5, "#7a4e2a", 2.4) + rejas + marcas;
}

function boxhead() {
  const cabeza = (c, i) => an("hop", 1.4, `<rect x="-5" y="-5" width="10" height="10" rx="1" fill="${c}" stroke="#3b2a12" stroke-width=".8"/><rect x="-3" y="-1.6" width="1.6" height="1.6" fill="#111"/><rect x="1.4" y="-1.6" width="1.6" height="1.6" fill="#111"/><rect x="-2" y="2" width="4" height=".9" fill="#3b2a12"/>`, n1(-i * .25));
  const barril = an("z", .5, `<rect x="-4" y="-6" width="8" height="12" rx="1.6" fill="#b91c1c" stroke="#450a0a" stroke-width=".8"/><path d="M-4-2H4M-4 2H4" stroke="#450a0a" stroke-width=".7"/>`);
  const casquillo = ret => an("dr", 1.6, `<rect x="-.7" y="-1.6" width="1.4" height="3.2" rx=".4" fill="#f2c14e"/>`, ret);
  const C = ["#e8c9a0", "#7fb069", "#d94b3d", "#e8c9a0"];
  return aro(53, "#c8892f", 3) + aro(60, "#2a2112", 10, `opacity=".5"`) + aro(66, "#f2c14e", 1.4, `stroke-dasharray="3 3"`) +
    C.map((c, i) => en(61, 45 + i * 70, cabeza(c, i))).join("") + en(62, 0, barril) +
    gira(9, en(67, 20, casquillo(0)) + en(67, 140, casquillo(-.6)) + en(67, 260, casquillo(-1.1)));
}

/* Tulones: calzoncillos que dan la vuelta al anillo y cabezas que se asoman. */
function tulones() {
  const calzon = (c, i) => an("hop", 1.6, `<path d="M-5-3H5L4.6 1Q2 2 1 4.4H-1Q-2 2-4.6 1Z" fill="${c}" stroke="#2a1e18" stroke-width=".8"/>`, n1(-i * .3));
  const cabeza = i => an("pp", 2.4, `<circle r="4" fill="#f6d2b8" stroke="#2a1e18" stroke-width=".8"/><circle cx="-1.4" cy="-.6" r=".6" fill="#2a1e18"/><circle cx="1.4" cy="-.6" r=".6" fill="#2a1e18"/>`, n1(-i * .4));
  const C = ["#f4f2ec", "#e2483d", "#3a6fd8", "#f2c230"];
  return aro(60, "#63b8ee", 16, `opacity=".5"`) + aro(52, "#2a1e18", 1.6) + aro(68, "#2a1e18", 1.6) +
    gira(14, C.map((c, i) => en(60, i * 90, calzon(c, i))).join("")) +
    [0, 1, 2, 3].map(i => en(60, 45 + i * 90, cabeza(i))).join("");
}

function zombis() {
  const gota = (ret) => an("dr", 2, `<path d="M0-2.4C1.6 0 2 1 2 2A2 2 0 0 1-2 2C-2 1-1.6 0 0-2.4Z" fill="#4ade80"/>`, ret);
  const mano = `<path d="M-3 7V0L-4.4-4.6L-3.2-5L-2-1V-6.4L-.8-6.6L-.4-1.4V-7L.8-7.1L1.2-1.4V-6.2L2.4-6L2.6-.6L4-3L5-2.4L3 3V7Z" fill="#65a30d" stroke="#1a2e05" stroke-width=".6"/>`;
  const ojos = (ret) => an("pp", 2.8, `<ellipse cx="-2" rx="1.4" ry=".9" fill="#ef4444"/><ellipse cx="2" rx="1.4" ry=".9" fill="#ef4444"/>`, ret);
  const frito = `<path d="M-8 1C-9-4-4-7 0-6C5-8 9-3 8 1C9 5 3 8-1 6C-5 8-9 5-8 1Z" fill="#a3e635" stroke="#3f6212" stroke-width=".6"/>` + an("l", 1.6, `<circle cx="1" r="3.2" fill="#f97316"/>`);
  return aro(60, "#0b0f0b", 20) + an("hx", 1.8, aro(51.5, "#4ade80", 2)) + aro(68.8, "#14532d", 1.4) +
    trazo(58, 120, 240, "#4ade80", 2.4, `stroke-dasharray="1 6" stroke-linecap="round" opacity=".7"`) +
    [140, 165, 195, 220].map((a, i) => en(64, a, gota(n1(-i * .5)))).join("") +
    en(63, 250, an("f", 1.8, mano), 250) + en(63, 110, an("f", 2.2, mano, -.7), 110) +
    en(62, 55, ojos(0), 55) + en(62, 305, ojos(-1.3), 305) + en(62, 180, ojos(-.6), 180) +
    en(64, 0, frito);
}

function clue() {
  const pisadas = cada(14, (i, a) => en(i % 2 ? 57 : 63, a, an("ft", 4.2, `<ellipse rx="2.4" ry="1.5" fill="#5b4636"/><circle cx="2.6" cy="-1" r=".6" fill="#5b4636"/><circle cx="2.6" cy="1" r=".6" fill="#5b4636"/>`, n1(i * .3 - 4.2)), a));
  const lupa = `<path d="M3.6 3.6L8.6 8.6" stroke="#7c4a1e" stroke-width="2.4" stroke-linecap="round"/><circle r="5" fill="#bae6fd" fill-opacity=".45" stroke="#374151" stroke-width="1.6"/><path d="M-2.6-1.6A3 3 0 0 1-1-3" stroke="#fff" stroke-width="1" fill="none"/>`;
  return aro(60, "#e8d5a3", 18) + aro(51, "#5b4636", 1.4) + aro(69, "#5b4636", 1.4) + pisadas +
    gira(10, en(60, 90, lupa)) + en(64, 0, an("l", 1.4, tx("?", 13, "#b91c1c", `font-family="Georgia,serif" stroke="#fde68a" stroke-width="1" paint-order="stroke"`)));
}

function ajedrez() {
  const c = 2 * Math.PI * 60 / 24;
  const caballo = `<path d="M-5 7H5L4 3C4.4 0 3.6-2.6 2-4.4C2.6-6 1.6-8-.4-8.4L-1.4-6.4C-4-5.6-6-2.6-6-.4L-3.6-.2L-1.6-1.6L-3.6 3Z" fill="#fde047" stroke="#8a5a0a" stroke-width=".9" stroke-linejoin="round"/><circle cx="-.4" cy="-4.6" r=".7" fill="#8a5a0a"/><rect x="-6" y="6.4" width="12" height="2" rx=".8" fill="#d4a017" stroke="#8a5a0a" stroke-width=".6"/>`;
  return aro(60, "#1f2937", 16) + gira(40, aro(60, "#f5f5f4", 16, `stroke-dasharray="${n1(c)} ${n1(c)}"`)) +
    aro(51.5, "#d4a017", 1.8) + aro(68.5, "#d4a017", 1.8) +
    en(64, 0, `<circle r="9" fill="#1f2937"/>` + an("hop", 1.6, caballo));
}

function monedas() {
  const moneda = (i) => an("v", 1.8, `<circle r="5.6" fill="#ffd84d" stroke="#8a6100" stroke-width="1"/><circle r="4" fill="none" stroke="#fff3b0" stroke-width=".6"/>` + tx("$", 6, "#8a6100"), n1(-i * .3));
  return aro(60, "#b8860b", 17) + aro(52.5, "#fff3b0", 1.4) + aro(67.5, "#6b4a00", 1.4) +
    gira(3, trazo(60, 0, 40, "#fff", 15, `opacity=".35" stroke-linecap="round"`)) +
    gira(12, cada(8, (i, a) => en(60, a, moneda(i))), true) +
    chispas([[68, 25, 3, 1.3, 0], [68, 115, 2.4, 1.7, -.4], [68, 205, 3, 1.5, -.9], [68, 295, 2.4, 1.9, -.2]], "#fffbe6");
}

function prodrop() {
  const R = ["#9ca3af", "#3b82f6", "#a855f7", "#f59e0b"];
  const carta = (c, i) => an("f", 1.7, rect(9, 12.5, 1.5, "#111827", `stroke="${c}" stroke-width="1.4"`) + chispa(3, c), n1(-i * .4));
  return aro(53, "#111827", 3) +
    gira(10, R.map((c, i) => trazo(60, i * 90 + 4, i * 90 + 86, c, 5, `stroke-linecap="round"`)).join("")) +
    gira(16, aro(66, "#fff", 1, `stroke-dasharray="1 5" opacity=".6"`), true) +
    R.map((c, i) => en(64, 45 + i * 90, carta(c, i), 45 + i * 90)).join("") +
    chispas([[68, 0, 3, 1.4, 0], [68, 90, 2.4, 1.8, -.5], [68, 180, 3, 1.6, -.8], [68, 270, 2.4, 2, -.2]], "#fde68a");
}

/* ---------- Tienda ---------- */

function cometa() {
  const cola = Array.from({ length: 12 }, (_, i) => en(60, -i * 3.6, `<circle r="${n1(3.4 - i * .25)}" fill="#a5f3fc" opacity="${n1(.85 - i * .07)}"/>`)).join("");
  const cabeza = en(60, 0, `<circle r="8" fill="#22d3ee" opacity=".25"/><circle r="4.4" fill="#fff"/>`);
  return aro(53, "#0ea5e9", 6, `opacity=".22"`) + aro(53, "#38bdf8", 1.6) +
    chispas([[66, 30, 2.4, 1.4, 0], [67, 95, 1.8, 1.9, -.6], [65, 150, 2.4, 1.6, -.3], [67, 210, 1.8, 2.2, -1], [66, 270, 2.4, 1.5, -.8], [67, 330, 1.8, 1.8, -.4]], "#e0f2fe") +
    gira(3.6, cola + cabeza);
}

function vortice() {
  return aro(60, "#4c1d95", 18, `opacity=".25"`) +
    gira(3, aro(55, "#22d3ee", 3, `stroke-dasharray="14 8" stroke-linecap="round"`)) +
    gira(4.5, aro(61, "#e879f9", 3, `stroke-dasharray="20 10" stroke-linecap="round"`), true) +
    gira(6, aro(67, "#a78bfa", 2.4, `stroke-dasharray="6 6" stroke-linecap="round"`)) +
    an("hx", 2, aro(52, "#fff", 1.2));
}

function sakura() {
  const flor = (k) => `<g transform="scale(${k})">${cada(5, (i, a) => `<ellipse cy="-2.6" rx="1.9" ry="2.8" fill="#fbcfe8" stroke="#f472b6" stroke-width=".4" transform="rotate(${a})"/>`)}<circle r="1.2" fill="#f59e0b"/></g>`;
  const rama = `<path d="${arco(62, 190, 350)}" fill="none" stroke="#6b3f1d" stroke-width="2.6" stroke-linecap="round"/>` +
    [205, 228, 250, 272, 300, 330].map((a, i) => en(i % 2 ? 66 : 58, a, flor(i % 3 ? 1 : 1.3))).join("");
  const petalo = (ret) => an("dr", 3.2, an("s", 2, `<ellipse rx="1.7" ry="2.6" fill="#f9a8d4"/>`), ret);
  return aro(53, "#f9a8d4", 2) + an("b", 6, rama) +
    [[64, 20], [60, 60], [66, 100], [58, 140], [64, 175], [60, 35]].map(([r, a], i) => en(r, a, petalo(n1(-i * .55)))).join("");
}

function plasma() {
  const rayo = `<path d="M0 0L2.6-4L-1.6-7.4L2.2-11L-.4-15" fill="none" stroke="#e0f2fe" stroke-width="1.3" stroke-linejoin="round"/><path d="M0 0L2.6-4L-1.6-7.4L2.2-11L-.4-15" fill="none" stroke="#22d3ee" stroke-width="3" opacity=".35"/>`;
  return an("hx", 1.4, aro(57, "#22d3ee", 12, `opacity=".3"`)) + aro(52.5, "#a5f3fc", 2) +
    gira(8, aro(60, "#67e8f9", 1, `stroke-dasharray="1 3"`)) +
    cada(7, (i, a) => en(52, a + 10, an("t", .35 + (i % 3) * .12, rayo, n1(-i * .17)), a + 10 + (i % 2 ? 12 : -12)));
}

function mariposas() {
  const mariposa = (c1, c2) => an("wg", .35, `<path d="M0 0C-3-6-9-6-8-1C-8 2-4 3 0 0Z" fill="${c1}" stroke="#111" stroke-width=".5"/><path d="M0 0C3-6 9-6 8-1C8 2 4 3 0 0Z" fill="${c1}" stroke="#111" stroke-width=".5"/><path d="M0 0C-2 3-6 6-5 2Z" fill="${c2}"/><path d="M0 0C2 3 6 6 5 2Z" fill="${c2}"/>`) +
    `<ellipse rx=".8" ry="3.4" fill="#111"/>`;
  return aro(53, "#fbcfe8", 2) + aro(61, "#fde68a", 14, `opacity=".18"`) +
    gira(7, en(56, 0, mariposa("#f97316", "#7c2d12"), 90)) +
    gira(10, en(62, 140, mariposa("#3b82f6", "#1e3a8a"), 140 - 90), true) +
    gira(13, en(67, 250, mariposa("#ec4899", "#831843"), 250 + 90));
}

const DIBUJOS = {
  tsnake: snake, tminas: minas, ttetris: tetris, tsortem: sortem, tbbtan: bbtan, tsopa: sopa,
  telectro: electro, tfrontera: frontera, tpokemon: pokemon, tescondite: escondite, tcartas: cartas,
  tcuadritos: cuadritos, treversi: reversi, tgato: gato, torbita: orbita, tcadena: cadena, tflip: flip, tcacho: cacho,
  tuno: uno, tcatan: catan, tpresidente: presidente, tspicy: spicy, tworms: worms, tyemas: yemas,
  tzombis: zombis, tclue: clue, tajedrez: ajedrez, tmonedas: monedas, tprodrop: prodrop, tsudoku: sudoku, tfanal: fanal, tboxhead: boxhead, ttulones: tulones, tatasco: atasco, taleteo: aleteo, tdosmil: dosmil,
  tmetrorush: metrorush, ttrigon: trigon,
  cometa, vortice, sakura, plasma, mariposas
};

/* Se dibuja una vez por marco y se guarda: las tablas repintan seguido. */
const hechos = {};
export const tieneAdorno = id => Object.prototype.hasOwnProperty.call(DIBUJOS, id);
export function adorno(id) {
  if (!tieneAdorno(id)) return "";
  return hechos[id] || (hechos[id] = `<b class="jg-av-ad" aria-hidden="true"><svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">${DIBUJOS[id]()}</svg></b>`);
}
export const MARCOS_ANIMADOS = Object.keys(DIBUJOS);
