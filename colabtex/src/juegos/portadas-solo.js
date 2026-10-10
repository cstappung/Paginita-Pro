/* Las portadas ilustradas de los juegos de un jugador (el Solo Club).

   Antes eran un fondo de color con el nombre y un emoji casi transparente,
   y al lado de las portadas de los multijugador se veían vacías. Ahora
   cada una es una escena de su juego, en SVG: con `viewBox` 400×300 y
   `slice` llena la miniatura (4:3) y la ficha (16:7) sin recalcular nada,
   y nunca se pixela.

   Dónde va cada cosa, porque la tarjeta la tapa en tres sitios: arriba a
   la izquierda las insignias (modo y plataformas), abajo a la izquierda el
   nombre y abajo a la derecha el ▶. El motivo va arriba a la derecha y al
   centro, y la franja de abajo se oscurece (`sombra`) para que el nombre
   se lea sobre cualquier fondo.

   Los `id` de los degradados llevan un contador: el mismo juego sale en
   el carrusel y en la ficha a la vez, y un `url(#id)` repetido apunta al
   primero del documento, que puede estar en una sección escondida (y en
   Chrome un degradado dentro de algo con `display:none` no pinta).

   Lo que se mueve (clase `a-*`) solo se anima al pasar el ratón o en la
   ficha (juegos.html): diecisiete portadas animándose a la vez en el
   salón serían ruido, y pintura de más en un celular. */

let n = 0;

const sombra = u => `<defs><linearGradient id="sb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></linearGradient></defs>`;
const pieSombra = u => `<rect width="400" height="300" fill="url(#sb${u})"/>`;

/* Un bloque de Tetris con su bisel: arriba claro, abajo oscuro. */
const celda = (x, y, t, c) => `<rect x="${x}" y="${y}" width="${t}" height="${t}" rx="2" fill="${c}"/><rect x="${x + 2}" y="${y + 2}" width="${t - 4}" height="${(t - 4) / 3}" rx="1" fill="#fff" opacity=".35"/><rect x="${x}" y="${y + t - 4}" width="${t}" height="4" fill="#000" opacity=".25"/>`;

const ARTE = {
  snake: u => `<defs><radialGradient id="g${u}" cx=".75" cy=".3" r=".9"><stop offset="0" stop-color="#1f8a5a"/><stop offset="1" stop-color="#08201a"/></radialGradient>
    <pattern id="r${u}" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#fff" stroke-opacity=".07"/></pattern></defs>
    <rect width="400" height="300" fill="url(#g${u})"/><rect width="400" height="300" fill="url(#r${u})"/>
    <path d="M60 250 C120 250 150 205 200 205 S270 245 305 200 S330 110 290 100 S225 120 238 72" fill="none" stroke="#2f7a22" stroke-width="30" stroke-linecap="round"/>
    <path d="M60 250 C120 250 150 205 200 205 S270 245 305 200 S330 110 290 100 S225 120 238 72" fill="none" stroke="#9be15d" stroke-width="24" stroke-linecap="round"/>
    <path d="M60 250 C120 250 150 205 200 205 S270 245 305 200 S330 110 290 100 S225 120 238 72" fill="none" stroke="#d4ff9a" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 13" opacity=".7"/>
    <g class="a-mueve"><ellipse cx="240" cy="64" rx="19" ry="16" fill="#9be15d" stroke="#2f7a22" stroke-width="3"/>
    <circle cx="232" cy="58" r="5.5" fill="#fff"/><circle cx="249" cy="58" r="5.5" fill="#fff"/><circle cx="233" cy="57" r="2.6" fill="#111"/><circle cx="250" cy="57" r="2.6" fill="#111"/>
    <path d="M241 47 L241 34 M241 34 l-5 -6 M241 34 l5 -6" stroke="#ff3b5c" stroke-width="3" stroke-linecap="round" fill="none" class="a-lengua"/></g>
    <g class="a-late"><circle cx="340" cy="62" r="17" fill="#ff3b3b"/><circle cx="334" cy="56" r="5" fill="#fff" opacity=".55"/><path d="M340 46 q2 -9 9 -11" stroke="#6b3a1a" stroke-width="3" fill="none"/><path d="M343 41 q10 -8 16 0 q-9 6 -16 0z" fill="#4caf50"/></g>`,

  sopa: u => {
    const L = ["ARTJXQM", "PJUEGOL", "KSALZEB", "WOOTRAN", "MLDBYUS", "QAZCHIP"];   // JUEGO en la fila 1; SOL bajando por la columna 1
    const letras = L.map((f, r) => [...f].map((c, k) => `<text x="${196 + k * 27}" y="${68 + r * 27}">${c}</text>`).join("")).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2c66"/><stop offset="1" stop-color="#0a1130"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/><circle cx="330" cy="40" r="120" fill="#2563eb" opacity=".25"/>
    <g transform="rotate(-6 285 135)"><rect x="172" y="34" width="210" height="182" rx="12" fill="#f4efe2" stroke="#d8cfb4" stroke-width="2"/>
    <rect x="207" y="74" width="140" height="26" rx="13" fill="#ffb070" opacity=".55" stroke="#ff8a3d" stroke-width="2.5" class="a-late"/>
    <rect x="207" y="99" width="27" height="77" rx="13" fill="#7dd3a0" opacity=".45" stroke="#22a35a" stroke-width="2.5"/>
    <g font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="800" font-size="18" fill="#26355f" text-anchor="middle">${letras}</g></g>
    <g class="a-mueve"><circle cx="338" cy="196" r="27" fill="#ffffff26" stroke="#c9d4ff" stroke-width="6"/><path d="M357 216 L382 242" stroke="#8a6a3a" stroke-width="10" stroke-linecap="round"/><path d="M325 184 a16 16 0 0 1 12 -6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/></g>`;
  },

  /* Metro Rush, como la portada de un runner de tienda: de día y saturada,
     para que salte a la vista entre las portadas oscuras del salón. Manda el
     corredor: grande, cabezón (para que la cara se lea a 200 px), huyendo en
     tabla voladora hacia quien mira, con un halo de luz detrás que lo
     despega del fondo. Por la vía del medio viene un tren de frente con los
     focos encendidos y, delante de él, la fila de monedas: hay que tomarlas
     antes de que llegue. A la izquierda, un vagón con grafitis que se pierde
     en el punto de fuga. El balasto es gris violeta, frío, para que lo
     cálido (corredor, monedas, tren) resalte encima. Todo con el contorno
     grueso de caricatura (`TINTA`).

     Dónde va cada cosa, por lo que la tarjeta pone encima (medido en el
     celular, donde tapa más): arriba a la izquierda (x < 290, y < 130) las
     insignias, abajo a la izquierda (x < 240, y > 180) el nombre y abajo a
     la derecha (x > 260, y > 240) el ▶; ahí solo hay fondo, oscuro o
     apagado. Lo que importa está entre y = 62 e y = 238, que es lo que
     muestra la ficha (16:7), y nada importante bajo su ✕ (x > 345, y < 115). */
  metrorush: u => {
    const TINTA = "#1b1035";                                      // el contorno de todo
    const FX = 200, FY = 118;                                     // el punto de fuga, en el horizonte
    // dónde cae, a la altura y, algo que abajo (y = 300) está en x0
    const enX = (x0, y) => FX + (x0 - FX) * (y - FY) / (300 - FY);
    // un trazo con contorno: primero el borde oscuro y grueso, encima el color
    const trazo = (d, c, w) => `<path d="${d}" stroke="${TINTA}" stroke-width="${w + 4.5}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    // una moneda de frente; `d` desfasa el giro para que no giren todas a la vez
    const moneda = (x, y, r, d) => `<g class="a-gira" style="animation-delay:${d}s"><circle cx="${x}" cy="${y}" r="${r}" fill="url(#o${u})" stroke="${TINTA}" stroke-width="${Math.max(2.4, r / 4.5)}"/><circle cx="${x}" cy="${y}" r="${r * .56}" fill="none" stroke="#c07400" stroke-width="${r / 6}"/><path d="M${x - r * .5} ${y - r * .25} a${r * .6} ${r * .6} 0 0 1 ${r * .45} ${-r * .4}" stroke="#fff" stroke-width="${r / 5}" fill="none" stroke-linecap="round"/></g>`;
    // un destello de cuatro puntas
    const brillo = (x, y, r) => `<path d="M${x} ${y - r} Q${x + r * .18} ${y - r * .18} ${x + r} ${y} Q${x + r * .18} ${y + r * .18} ${x} ${y + r} Q${x - r * .18} ${y + r * .18} ${x - r} ${y} Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z" fill="#fff"/>`;

    // La ciudad del fondo: dos capas, la lejana más pálida (la bruma del día).
    const lejos = [[0, 74, 26], [24, 86, 22], [44, 66, 18], [60, 80, 28], [86, 92, 20], [104, 78, 24], [226, 84, 22], [246, 70, 18], [262, 88, 26], [286, 64, 20], [304, 82, 30], [332, 72, 22], [352, 90, 26], [376, 76, 24]]
      .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${FY - y}" fill="#a6dcf2"/>`).join("");
    const cerca = [[6, 92, 24, "#ffd84a"], [30, 100, 20, "#ff7ab8"], [118, 96, 22, "#ffd84a"], [140, 104, 18, "#7ff0ff"], [236, 100, 22, "#ff7ab8"], [258, 94, 18, "#ffd84a"], [320, 98, 24, "#7ff0ff"], [346, 104, 22, "#ffd84a"], [368, 92, 32, "#ff7ab8"]]
      .map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${FY - y}" fill="#5fa8d6"/><rect x="${x}" y="${y}" width="${w}" height="3" fill="${c}"/>` +
        Array.from({ length: Math.floor((FY - y - 6) / 6) * 2 }, (_, k) => `<rect x="${x + 4 + (k % 2) * (w - 10)}" y="${y + 6 + Math.floor(k / 2) * 6}" width="2.6" height="2.6" fill="#e6f8ff" opacity=".9"/>`).join("")).join("");

    // El halo detrás del corredor, con rayos suaves: lo despega del fondo.
    const rayos = Array.from({ length: 10 }, (_, k) => {
      const a = k * Math.PI / 5 + .2, b = a + .14;
      return `<path d="M300 125 L${(300 + 260 * Math.cos(a)).toFixed(1)} ${(125 + 260 * Math.sin(a)).toFixed(1)} L${(300 + 260 * Math.cos(b)).toFixed(1)} ${(125 + 260 * Math.sin(b)).toFixed(1)}Z" fill="#fff"/>`;
    }).join("");

    // Tres vías: los rieles van al punto de fuga; los durmientes se juntan a lo lejos.
    const VIAS = [-115, 155, 425];                               // el centro de cada vía, abajo
    const rieles = VIAS.flatMap(c => [c - 55, c + 55]).map(x0 => `<path d="M${x0} 300 L${FX} ${FY}" stroke="#2c2840" stroke-width="4.5"/><path d="M${x0 - 1.5} 300 L${FX} ${FY}" stroke="#dfe6f4" stroke-width="1.8"/>`).join("");
    // Al animarse, una ola de brillo recorre los durmientes desde el horizonte
    // hacia quien mira (el lejano, k = 0, se adelanta más): la vía "corre".
    const durmientes = VIAS.map(c => [123, 128, 135, 145, 158, 176, 201, 236, 286].map((y, k) =>
      `<path class="a-durmiente" style="animation-delay:${(k * .12 - 1.1).toFixed(2)}s" d="M${enX(c - 68, y).toFixed(1)} ${y} H${enX(c + 68, y).toFixed(1)}" stroke="#4a3020" stroke-width="${1 + k * 1.4}"/>`).join("")).join("");

    // El vagón de la izquierda, alejándose por su vía. Su costado fuga al
    // punto de fuga y termina en x = 150, sin tocar al tren; no se le ve el
    // techo (está por encima de los ojos). Más oscuro que el corredor, para
    // que no le robe la vista.
    const arr = x => 96 + 22 * (x - 54) / 146, aba = x => 252 - 134 * (x - 54) / 146;   // el borde de arriba y el de abajo del costado
    const alto = (x, t) => arr(x) + (aba(x) - arr(x)) * t;                             // un punto a la fracción t de la altura
    const ventanas = [[60, 80], [88, 104], [112, 124], [132, 142]].map(([a, b]) =>
      `<path d="M${a} ${alto(a, .16).toFixed(1)} L${b} ${alto(b, .16).toFixed(1)} L${b} ${alto(b, .4).toFixed(1)} L${a} ${alto(a, .4).toFixed(1)}Z" fill="#1e3f73" stroke="${TINTA}" stroke-width="2"/><path d="M${a + 3} ${alto(a + 3, .36).toFixed(1)} L${a + 8} ${alto(a + 8, .2).toFixed(1)}" stroke="#fff" stroke-width="2.4" opacity=".3"/>`).join("");
    const vagon = `<path d="M54 96 L150 ${arr(150).toFixed(1)} V${aba(150).toFixed(1)} L54 252Z" fill="url(#vg${u})" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
      ${ventanas}
      <path d="M54 ${alto(54, .55)} L150 ${alto(150, .55).toFixed(1)}" stroke="#1f7ae0" stroke-width="7"/><path d="M54 ${alto(54, .6)} L150 ${alto(150, .6).toFixed(1)}" stroke="#ffe7a0" stroke-width="2.2"/>
      <g transform="translate(80 150) skewY(-13)">${[[TINTA, 10], ["#ff3fa4", 6]].map(([c, w]) => `<path d="M2 20 V3 L10 13 L18 3 V20 M26 20 V3 h7 q7 0 7 7 q0 7 -7 7 h-7 M33 17 L40 20" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}
      <path d="M3 5 l4 5 M27 4 h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>
      <path d="M54 232 L150 ${alto(150, .87).toFixed(1)} V${aba(150).toFixed(1)} L54 252Z" fill="#2a1a3a" opacity=".8"/>
      <path d="M-120 96 H54 V252 H-120Z" fill="url(#vt${u})" stroke="${TINTA}" stroke-width="3"/>
      <rect x="-20" y="118" width="56" height="44" rx="6" fill="#1e3f73" stroke="${TINTA}" stroke-width="2.5"/><path d="M-12 124 l-8 28 M2 124 l-10 34" stroke="#fff" stroke-width="3" opacity=".25"/>
      <rect x="-120" y="232" width="174" height="20" fill="#2a1a3a" opacity=".8"/>`;

    // El tren de frente por la vía del medio: pisa (sombra y bogies) y sus focos son lo que más brilla del fondo.
    const tren = `<g class="a-tiembla"><path d="M171 168 L150 200 H218 L201 168Z" fill="url(#hz${u})"/>
      <ellipse cx="190" cy="169" rx="36" ry="4" fill="#000" opacity=".45"/>
      <path d="M160 164 V120 q0 -10 10 -10 h40 q10 0 10 10 V164Z" fill="#ff4646" stroke="${TINTA}" stroke-width="2.6"/>
      <rect x="165" y="118" width="50" height="22" rx="3" fill="url(#vd${u})" stroke="${TINTA}" stroke-width="2"/><path d="M172 118 l-5 20 M182 118 l-6 22" stroke="#fff" stroke-width="2" opacity=".35"/>
      <rect x="160" y="145" width="60" height="5" fill="#ffd23f" stroke="${TINTA}" stroke-width="1.6"/>
      <rect x="162" y="164" width="56" height="6" fill="#22202e"/><rect x="157" y="160" width="66" height="5" rx="2" fill="#3a3f52" stroke="${TINTA}" stroke-width="2"/>
      <rect x="181" y="112" width="18" height="5" rx="1" fill="${TINTA}"/><text x="190" y="116.3" text-anchor="middle" font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="800" font-size="4.2" fill="#ffd23f">L3</text>
      <circle cx="170" cy="155" r="4" fill="#fffbe0" stroke="${TINTA}" stroke-width="1.8"/><circle cx="210" cy="155" r="4" fill="#fffbe0" stroke="${TINTA}" stroke-width="1.8"/>
      <g class="a-foco"><circle cx="170" cy="155" r="20" fill="url(#lz${u})"/><circle cx="210" cy="155" r="20" fill="url(#lz${u})"/></g></g>`;

    // La tabla voladora, en coordenadas de la escena (no del corredor):
    // casi horizontal, justo bajo las dos suelas (y ≈ 222–236), con dos
    // estelas cian que salen de la cola hacia el fondo, no hacia el suelo.
    const tabla = `<g transform="translate(300 223) rotate(-3)">
      ${[-4, 4].map(dy => `<path d="M-50 ${dy} h-20" stroke="${TINTA}" stroke-width="8" stroke-linecap="round"/><path d="M-50 ${dy} h-20" stroke="#7ff0ff" stroke-width="4" stroke-linecap="round" class="a-estela" style="animation-delay:${dy > 0 ? -.15 : 0}s"/>`).join("")}
      <rect x="-53" y="-7" width="106" height="14" rx="7" fill="#ff3fa4" stroke="${TINTA}" stroke-width="3"/>
      <rect x="-48" y="1.5" width="96" height="4" rx="2" fill="#c4127a"/>
      <path d="M-40 -2.5 h80" stroke="#ffd0ea" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M-18 -7 l5 14 M2 -7 l5 14" stroke="#ffe14d" stroke-width="3"/></g>`;
    const zapa = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(1.12)"><path d="M-9 -4 q2 -6 9 -6 q8 0 10 6 q4 1 4 6 h-25z" fill="#fff" stroke="${TINTA}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-10 2 h24" stroke="#ff4646" stroke-width="3"/><path d="M-2 -6 l3 4 M3 -7 l3 4" stroke="#ff4646" stroke-width="1.6"/></g>`;
    const guante = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${TINTA}" stroke-width="2.6"/><path d="M${x - 3} ${y - 2} h5" stroke="#c9c9dd" stroke-width="1.6" stroke-linecap="round"/>`;
    // El corredor, con el origen en la cadera: de frente, la cara girada un poco
    // atrás (mira quién lo sigue), una rodilla arriba, los brazos abiertos para
    // equilibrarse y la gorra al revés. La cabeza es grande a propósito.
    const corredor = `
      ${trazo("M10 2 L22 24 L26 44", "#2b59c3", 12)}${zapa(28, 46, -8)}
      ${trazo("M-8 2 L-28 16 L-18 38", "#2b59c3", 12)}${zapa(-16, 42, 14)}
      <path d="M-13 -4 Q-19 -24 -17 -40 Q0 -47 17 -40 Q19 -24 13 -4Z" fill="#ff8a1f" stroke="${TINTA}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-9 -12 Q0 -8 9 -12" stroke="#c45a00" stroke-width="2.4" fill="none"/><path d="M-6 -42 Q0 -30 6 -42" stroke="#c45a00" stroke-width="2.2" fill="none"/>
      <path d="M-14 -36 q-5 10 -2 24 M14 -36 q5 10 2 24" stroke="#2b2b55" stroke-width="2.6" fill="none"/>
      ${trazo("M-14 -36 L-27 -22 L-34 -29", "#ff8a1f", 11)}${guante(-39, -31)}
      ${trazo("M14 -36 L30 -39 L37 -29", "#ff8a1f", 11)}${guante(41, -26)}
      <path d="M-10 -45 q10 8 20 0" stroke="#22d3ee" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="-11" cy="-45" r="4.2" fill="#22d3ee" stroke="${TINTA}" stroke-width="2"/><circle cx="11" cy="-45" r="4.2" fill="#22d3ee" stroke="${TINTA}" stroke-width="2"/>
      <circle cx="0" cy="-64" r="19" fill="#f4c08f" stroke="${TINTA}" stroke-width="3"/>
      <path d="M-19 -66 q0 -22 19 -22 q20 0 20 19 q-19 -5 -39 3z" fill="#e8322f" stroke="${TINTA}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M17 -72 q12 -5 19 3 q-8 5 -18 3" fill="#e8322f" stroke="${TINTA}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M-14 -80 q6 -4 12 -2" stroke="#ff8a8a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="-9" cy="-63" rx="3" ry="4.2" fill="${TINTA}"/><ellipse cx="5" cy="-63" rx="3" ry="4.2" fill="${TINTA}"/><circle cx="-10" cy="-64.6" r="1.1" fill="#fff"/><circle cx="4" cy="-64.6" r="1.1" fill="#fff"/>
      <path d="M-15 -70 q5 -3 9 -1 M1 -71 q5 -2 9 1" stroke="${TINTA}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M-11 -54 q9 10 18 0 z" fill="#fff" stroke="${TINTA}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="-14" cy="-56" r="3" fill="#ff8aa0" opacity=".7"/><circle cx="11" cy="-56" r="3" fill="#ff8aa0" opacity=".7"/>`;

    // Las rayas de velocidad: radiales desde el punto de fuga, solo en la
    // periferia (el borde derecho y la franja alta), sin cruzar al corredor.
    // Cada una lleva su propio desfase (3/14 de vuelta), así al animarse pasan
    // en chorro continuo en vez de parpadear todas a la vez.
    const rayas = [[.06, 175, 235], [.2, 180, 240], [.34, 175, 235], [.48, 185, 240], [-.06, 160, 215], [-.2, 150, 205], [-.34, 140, 190]]
      .map(([a, r0, r1], k) => `<path class="a-raya" style="animation-delay:${(-k * 3 / 14 % .5).toFixed(2)}s" d="M${(FX + r0 * Math.cos(a)).toFixed(1)} ${(FY + r0 * Math.sin(a)).toFixed(1)} L${(FX + r1 * Math.cos(a)).toFixed(1)} ${(FY + r1 * Math.sin(a)).toFixed(1)}" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>`).join("");

    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1279f0"/><stop offset=".25" stop-color="#36aef7"/><stop offset=".4" stop-color="#a8e6ff"/><stop offset=".4" stop-color="#8a8296"/><stop offset="1" stop-color="#3f364d"/></linearGradient>
    <pattern id="gr${u}" width="9" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#b7afc2"/><circle cx="6.5" cy="5" r=".8" fill="#b7afc2"/></pattern>
    <radialGradient id="ha${u}"><stop offset="0" stop-color="#fffbe0" stop-opacity=".55"/><stop offset=".55" stop-color="#fff3b0" stop-opacity=".22"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
    <linearGradient id="vg${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8a50c"/><stop offset="1" stop-color="#b86a06"/></linearGradient>
    <linearGradient id="vt${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9930a"/><stop offset="1" stop-color="#8f5205"/></linearGradient>
    <linearGradient id="vd${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff3ff"/><stop offset=".4" stop-color="#3a7bd5"/><stop offset="1" stop-color="#16306b"/></linearGradient>
    <linearGradient id="hz${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0" stop-opacity=".35"/><stop offset="1" stop-color="#fffbe0" stop-opacity="0"/></linearGradient>
    <radialGradient id="lz${u}"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#fffbe0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe86b" stop-opacity="0"/></radialGradient>
    <radialGradient id="o${u}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffcc1a"/><stop offset="1" stop-color="#f09000"/></radialGradient>
    <clipPath id="ci${u}"><rect width="400" height="${FY}"/></clipPath></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <rect y="${FY}" width="400" height="${300 - FY}" fill="url(#gr${u})" opacity=".35"/>
    <path d="M14 46 q-12 0 -10 -10 q2 -8 12 -7 q4 -13 18 -12 q12 2 13 12 q12 -3 15 7 q2 10 -10 10z" fill="#fff" opacity=".95"/>
    <g clip-path="url(#ci${u})" opacity=".2">${rayos}</g>
    ${lejos}${cerca}
    <rect y="${FY}" width="400" height="4" fill="#5c5670"/>
    ${durmientes}${rieles}
    <circle cx="300" cy="125" r="90" fill="url(#ha${u})"/>
    ${tren}${vagon}
    ${[[247, 176, 11, 0], [237, 159, 9, -.25], [228, 145, 7, -.5]].map(c => moneda(...c)).join("")}
    <g class="a-late">${brillo(263, 150, 7)}</g>
    <ellipse cx="300" cy="232" rx="42" ry="4" fill="#000" opacity=".3" class="a-sombra"/>
    ${rayas}
    <g class="a-surfea">${tabla}<g transform="translate(298 166) rotate(-4) scale(1.05)">${corredor}</g></g>`;
  },

  tetrisclub: u => {
    const C = { i: "#2fd3e8", o: "#f6d32d", t: "#a855f7", s: "#22c55e", z: "#ef4444", j: "#3b82f6", l: "#f97316" };
    const t = 22, x0 = 207, fondo = 290;
    const filas = ["zzj.jloo", "", "sstttolo", ".s.tj.ll", "...jj..l"];
    let cel = "";
    filas.forEach((f, r) => [...f].forEach((c, k) => { if (C[c]) cel += celda(x0 + k * t, fondo - (r + 1) * t, t, C[c]); }));
    const limpia = `<rect class="a-late" x="${x0}" y="${fondo - 2 * t}" width="${8 * t}" height="${t}" fill="#fff" opacity=".85"/>`;
    const cae = [[3, 8], [4, 8], [5, 8], [4, 7]].map(([k, r]) => celda(x0 + k * t, fondo - (r + 1) * t, t, C.t)).join("");
    const sombraPieza = [[3, 5], [4, 5], [5, 5], [4, 4]].map(([k, r]) => `<rect x="${x0 + k * t + 1}" y="${fondo - (r + 1) * t + 1}" width="${t - 2}" height="${t - 2}" rx="2" fill="none" stroke="#a855f7" stroke-opacity=".6" stroke-dasharray="3 3"/>`).join("");
    return `<defs><radialGradient id="g${u}" cx=".8" cy=".2" r="1"><stop offset="0" stop-color="#1b5f7a"/><stop offset="1" stop-color="#0a1322"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <rect x="${x0 - 4}" y="0" width="${8 * t + 8}" height="${fondo + 4}" fill="#060b16" stroke="#2fd3e8" stroke-opacity=".5" stroke-width="2"/>
    <g opacity=".08" stroke="#fff">${Array.from({ length: 7 }, (_, k) => `<path d="M${x0 + (k + 1) * t} 0 V${fondo}"/>`).join("")}</g>
    ${cel}${limpia}${sombraPieza}<g class="a-cae">${cae}</g>`;
  },

  minas: u => {
    const abiertas = new Set(["5,1", "6,1", "7,1", "4,2", "5,2", "6,2", "7,2", "8,2", "5,3", "6,3", "7,3", "8,3", "6,4", "7,4"]);
    const num = { "5,1": 1, "7,1": 2, "4,2": 1, "8,2": 1, "5,3": 2, "8,3": 3, "6,4": 1, "7,4": 1 };
    const col = ["", "#1976d2", "#388e3c", "#d32f2f"];
    let s = "";
    for (let r = 0; r < 8; r++) for (let k = 0; k < 10; k++) {
      const key = k + "," + r, a = abiertas.has(key), par = (k + r) % 2;
      s += `<rect x="${k * 40}" y="${r * 40}" width="40" height="40" fill="${a ? (par ? "#e5c99a" : "#d9bb88") : (par ? "#8ccf52" : "#7cc04a")}"/>`;
      if (num[key]) s += `<text x="${k * 40 + 20}" y="${r * 40 + 29}" fill="${col[num[key]]}">${num[key]}</text>`;
    }
    const bandera = (x, y) => `<g class="a-flamea"><path d="M${x + 15} ${y + 8} V${y + 32}" stroke="#4a3a2a" stroke-width="3"/><path d="M${x + 16} ${y + 8} L${x + 31} ${y + 14} L${x + 16} ${y + 21}z" fill="#e53935"/><ellipse cx="${x + 15}" cy="${y + 33}" rx="9" ry="3" fill="#000" opacity=".2"/></g>`;
    return `${s.replace(/<text/g, '<text font-family="system-ui,sans-serif" font-weight="900" font-size="24" text-anchor="middle"')}
    ${bandera(160, 40)}${bandera(360, 120)}${bandera(240, 200)}
    <g transform="translate(340 220)"><circle r="12" fill="#263238"/><path d="M0 -18 V18 M-18 0 H18 M-12 -12 L12 12 M-12 12 L12 -12" stroke="#263238" stroke-width="4"/><circle cx="-4" cy="-4" r="3.5" fill="#fff" opacity=".7"/></g>`;
  },

  sudoku: u => {
    const cif = [[0, 0, 5, 1], [2, 0, 3], [4, 1, 7, 1], [7, 1, 1], [1, 3, 8], [3, 2, 6, 1], [6, 3, 2], [8, 4, 9, 1], [5, 5, 4], [2, 6, 1, 1], [7, 6, 5], [0, 8, 6], [4, 7, 3, 1], [6, 8, 7], [8, 7, 8]];
    const t = 20, x0 = 196, y0 = 18;
    const lineas = Array.from({ length: 10 }, (_, k) => {
      const g = k % 3 === 0, c = g ? "#ff2fb4" : "#22e6ff", w = g ? 2.5 : 1, o = g ? 1 : .35;
      return `<path d="M${x0 + k * t} ${y0} V${y0 + 9 * t} M${x0} ${y0 + k * t} H${x0 + 9 * t}" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}"/>`;
    }).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a0833"/><stop offset=".7" stop-color="#0a0f24"/></linearGradient>
    <pattern id="r${u}" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#ff2fb4" stroke-opacity=".12"/></pattern></defs>
    <rect width="400" height="300" fill="url(#g${u})"/><rect width="400" height="300" fill="url(#r${u})"/><circle cx="350" cy="30" r="90" fill="#ff2fb4" opacity=".18"/>
    <rect x="${x0}" y="${y0}" width="${9 * t}" height="${9 * t}" fill="#0d0b24" opacity=".9"/>
    <rect class="a-late" x="${x0 + 4 * t}" y="${y0 + 4 * t}" width="${t}" height="${t}" fill="#ffe14a"/>
    ${lineas}
    <g font-family="ui-monospace,Menlo,Consolas,monospace" font-weight="700" font-size="13" text-anchor="middle">${cif.map(([x, y, v, p]) => `<text x="${x0 + x * t + t / 2}" y="${y0 + y * t + 15}" fill="${p ? "#ffe3f4" : "#7cf3ff"}">${v}</text>`).join("")}</g>
    <text x="150" y="128" font-family="system-ui,sans-serif" font-size="22" fill="#ff4f8b">♥♥♥</text>
    <g transform="rotate(8 345 230)"><text class="a-mueve" x="335" y="240" font-family="system-ui,sans-serif" font-style="italic" font-weight="900" font-size="30" fill="#ffe14a">×4</text></g>`;
  },

  fanal: u => {
    const polilla = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="a-ala" d="M0 6 L-3 0 L-13 -6 L-15 5 L-4 8 Z M0 6 L3 0 L13 -6 L15 5 L4 8 Z" fill="${c}"/><ellipse cy="5" rx="2" ry="6" fill="#4a3a2e"/></g>`;
    const estrellas = [[40, 30], [90, 60], [150, 20], [130, 95], [60, 120], [200, 40], [370, 30], [250, 15], [320, 70]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.6}" fill="#ffe8c2" opacity="${.5 + (i % 2) * .4}"/>`).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1332"/><stop offset="1" stop-color="#0b0a1c"/></linearGradient>
    <radialGradient id="l${u}"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".2" stop-color="#ffcf6b" stop-opacity=".8"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>${estrellas}
    <rect y="214" width="400" height="86" fill="#0f1430"/><path d="M0 222 Q100 216 200 222 T400 222" stroke="#2a3466" stroke-width="2" fill="none"/>
    <circle class="a-late" cx="300" cy="150" r="95" fill="url(#l${u})"/>
    <path d="M300 230 L300 300" stroke="#ffcf6b" stroke-opacity=".25" stroke-width="18"/>
    <path d="M250 214 Q300 236 350 214 L342 224 Q300 240 258 224 Z" fill="#3a2418" stroke="#1d1209" stroke-width="2"/>
    <path d="M300 214 V160" stroke="#3a2418" stroke-width="4"/><rect x="288" y="140" width="24" height="26" rx="5" fill="#ffcf6b" stroke="#6b4a1a" stroke-width="3"/><circle cx="300" cy="153" r="6" fill="#fff6d8"/>
    <g class="a-vuela">${polilla(240, 92, "#b8a088")}${polilla(352, 70, "#c47a3c", 1.2)}${polilla(370, 140, "#9a4a62", .9)}${polilla(218, 150, "#b8a088", .8)}${polilla(318, 40, "#9a4a62", .7)}</g>`;
  },

  bbtan: u => {
    const cols = ["#c4f568", "#ffd23a", "#ff8a3d", "#ff5fa2"];
    const b = [[0, 0, 12, 3], [1, 0, 7, 2], [3, 0, 21, 3], [0, 1, 4, 1], [2, 1, 9, 2], [3, 1, 3, 0], [1, 2, 2, 0], [2, 2, 5, 1]];
    const t = 44, x0 = 206, y0 = 14;
    const bloques = b.map(([k, r, v, c]) => `<g><rect x="${x0 + k * (t + 4)}" y="${y0 + r * (t + 4)}" width="${t}" height="${t}" fill="${cols[c]}"/><rect x="${x0 + k * (t + 4) + 3}" y="${y0 + r * (t + 4) + 3}" width="${t - 6}" height="${t - 6}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="3"/><text x="${x0 + k * (t + 4) + t / 2}" y="${y0 + r * (t + 4) + 29}">${v}</text></g>`).join("");
    return `<defs><pattern id="r${u}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".25"/></pattern>
    <radialGradient id="g${u}" cx=".9" cy=".5" r="1"><stop offset="0" stop-color="#3d5a12"/><stop offset="1" stop-color="#0a1322"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <g font-family="'Press Start 2P',ui-monospace,monospace" font-size="15" fill="#1d2b06" text-anchor="middle">${bloques}</g>
    <circle cx="${x0 + 2 * (t + 4) + t / 2}" cy="${y0 + 3 * (t + 4) - 22}" r="9" fill="none" stroke="#fff" stroke-width="3" class="a-late"/>
    <path d="M300 268 L248 170" stroke="#fff" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".8"/>
    <g fill="#fff" class="a-mueve"><rect x="244" y="160" width="9" height="9"/><rect x="262" y="196" width="9" height="9"/><rect x="278" y="226" width="9" height="9"/></g>
    <rect x="292" y="262" width="16" height="16" fill="#fff"/>
    <rect width="400" height="300" fill="url(#r${u})"/>`;
  },

  atasco: u => {
    const t = 40, x0 = 150, y0 = 30;
    const auto = (k, r, w, h, c, extra = "") => {
      const x = x0 + k * t + 4, y = y0 + r * t + 4, W = w * t - 8, H = h * t - 8, hz = w >= h;
      const vid = hz ? `<rect x="${x + W - 18}" y="${y + 5}" width="9" height="${H - 10}" rx="3" fill="#9fd6ff"/><rect x="${x + 8}" y="${y + 6}" width="6" height="${H - 12}" rx="2" fill="#9fd6ff" opacity=".8"/>`
        : `<rect x="${x + 5}" y="${y + 8}" width="${W - 10}" height="9" rx="3" fill="#9fd6ff"/><rect x="${x + 6}" y="${y + H - 14}" width="${W - 12}" height="6" rx="2" fill="#9fd6ff" opacity=".8"/>`;
      return `<g${extra}><rect x="${x}" y="${y + 3}" width="${W}" height="${H}" rx="10" fill="#000" opacity=".3"/><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="10" fill="${c}" stroke="#1d2330" stroke-width="3"/>${vid}</g>`;
    };
    const lineas = Array.from({ length: 7 }, (_, k) => `<path d="M${x0 + k * t} ${y0} V${y0 + 6 * t}" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#565b66"/><stop offset="1" stop-color="#3c4048"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>${lineas}
    <rect x="${x0 - 6}" y="${y0 - 6}" width="${6 * t + 12}" height="6" fill="#c9c4b5"/><rect x="${x0 - 6}" y="${y0 + 6 * t}" width="${6 * t + 12}" height="6" fill="#c9c4b5"/>
    ${auto(0, 0, 2, 1, "#2f7de1")}${auto(4, 1, 1, 3, "#f2c230")}${auto(5, 3, 1, 2, "#2fb36b")}${auto(1, 4, 3, 1, "#8e5cf0")}${auto(0, 3, 1, 2, "#1fb5c4")}
    ${auto(1, 2, 2, 1, "#e8322f", ' class="a-sale"')}
    <path d="M${x0 + 6 * t + 2} ${y0 + 2 * t + 2} v${t - 4}" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-dasharray="5 5"/>
    <g class="a-barrera"><rect x="${x0 + 6 * t + 8}" y="${y0 + 2 * t - 4}" width="6" height="${t + 8}" rx="3" fill="#e8322f" stroke="#1d2330" stroke-width="2"/><rect x="${x0 + 6 * t + 8}" y="${y0 + 2 * t + 8}" width="6" height="8" fill="#fff"/><rect x="${x0 + 6 * t + 8}" y="${y0 + 2 * t + 24}" width="6" height="8" fill="#fff"/></g>`;
  },

  electro: u => {
    const tile = (x, l, c) => `<rect x="${x}" y="186" width="40" height="40" rx="6" fill="${c}"/><text x="${x + 20}" y="215">${l}</text>`;
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1606"/><stop offset=".7" stop-color="#0b1222"/></linearGradient>
    <radialGradient id="l${u}"><stop offset="0" stop-color="#fbbf24" stop-opacity=".55"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <g fill="none" stroke="#c8893c" stroke-opacity=".45" stroke-width="3"><path d="M0 250 H120 L150 220 H190"/><path d="M400 150 H360 L340 130 H320"/><path d="M120 60 H170 L190 80"/></g>
    <g fill="#e0a45a"><circle cx="190" cy="220" r="5"/><circle cx="320" cy="130" r="5"/><circle cx="190" cy="80" r="5"/></g>
    <circle cx="330" cy="60" r="70" fill="url(#l${u})" class="a-late"/>
    <path class="a-chispa" d="M340 8 L300 72 H330 L312 128 L366 52 H334 L352 8 Z" fill="#fbbf24" stroke="#7a4b00" stroke-width="3" stroke-linejoin="round"/>
    <path d="M180 140 H212 M300 140 H332" stroke="#b8c2cc" stroke-width="4"/><rect x="212" y="126" width="88" height="28" rx="12" fill="#e6c79a" stroke="#6b4a1a" stroke-width="2"/>
    <rect x="226" y="126" width="8" height="28" fill="#8b4513"/><rect x="242" y="126" width="8" height="28" fill="#111"/><rect x="258" y="126" width="8" height="28" fill="#e53935"/><rect x="282" y="126" width="6" height="28" fill="#d4af37"/>
    <g font-family="system-ui,sans-serif" font-weight="900" font-size="24" fill="#fff" text-anchor="middle">${tile(196, "O", "#22a35a")}${tile(242, "H", "#c9a227")}${tile(288, "M", "#22a35a")}${tile(334, "S", "#3f4656")}</g>`;
  },

  sortem: u => {
    const alturas = [30, 46, 62, 120, 94, 110, 136, 152];
    const barras = alturas.map((h, i) => {
      const x = 190 + i * 25, c = i === 3 || i === 4 ? "#ff006e" : "#00f5ff";
      return `<rect x="${x}" y="${222 - h}" width="19" height="${h}" rx="3" fill="${c}" fill-opacity=".85"/><rect x="${x}" y="${222 - h}" width="19" height="4" rx="2" fill="#fff" opacity=".7"/>`;
    }).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a0a44"/><stop offset="1" stop-color="#0d0418"/></linearGradient>
    <pattern id="r${u}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#00f5ff" stroke-opacity=".1"/></pattern>
    <filter id="f${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <rect width="400" height="300" fill="url(#g${u})"/><rect width="400" height="300" fill="url(#r${u})"/>
    <g filter="url(#f${u})" opacity=".7">${barras}</g>${barras}
    <path d="M190 228 H395" stroke="#00f5ff" stroke-width="2" opacity=".6"/>
    <g class="a-mueve" fill="none" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"><path d="M276 92 Q300 62 324 92"/><path d="M318 82 L324 92 L312 94"/><path d="M324 64 Q300 34 276 64" opacity=".6"/></g>`;
  },

  aleteo: u => {
    const tubo = (x, y, h, arriba, osc) => `<g${osc ? ' opacity=".55"' : ""}><rect x="${x}" y="${y}" width="34" height="${h}" fill="#5cc14a" stroke="#17320f" stroke-width="2.5"/><rect x="${x + 6}" y="${y}" width="7" height="${h}" fill="#b6f78a" opacity=".6"/><rect x="${x - 5}" y="${arriba ? y + h - 16 : y}" width="44" height="16" rx="3" fill="#6fd35a" stroke="#17320f" stroke-width="2.5"/></g>`;
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6ccbff"/><stop offset=".3" stop-color="#ffd59a"/><stop offset=".5" stop-color="#ff8f6b"/><stop offset=".65" stop-color="#c4527a"/><stop offset=".82" stop-color="#3b1f5c"/><stop offset="1" stop-color="#0b0718"/></linearGradient>
    <linearGradient id="h${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#57b947"/><stop offset=".45" stop-color="#7a4a4f"/><stop offset=".75" stop-color="#2a1640"/><stop offset="1" stop-color="#0b0718"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <circle cx="60" cy="70" r="26" fill="#fff7c2"/><circle cx="60" cy="70" r="40" fill="#ffe58a" opacity=".3"/>
    <g fill="#fff" opacity=".85"><ellipse cx="120" cy="50" rx="26" ry="9"/><ellipse cx="135" cy="44" rx="15" ry="9"/></g>
    <circle cx="350" cy="50" r="16" fill="#fff8e6"/><circle cx="358" cy="44" r="15" fill="#2a1640"/>
    <g fill="#fff"><circle cx="300" cy="30" r="1.5"/><circle cx="385" cy="100" r="1.3"/><circle cx="320" cy="90" r="1"/><circle cx="270" cy="60" r="1"/></g>
    <path d="M0 260 Q60 220 120 252 T240 246 T400 236 V300 H0Z" fill="url(#h${u})"/>
    ${tubo(196, 0, 92, true, false)}${tubo(196, 190, 110, false, false)}${tubo(322, 0, 110, true, true)}${tubo(322, 214, 86, false, true)}
    <path d="M110 170 Q140 120 170 140" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" opacity=".9"/>
    <g transform="translate(178 142)"><g class="a-vuela"><ellipse rx="17" ry="13" fill="#ffd23a" stroke="#4a3000" stroke-width="2.5"/><ellipse cx="-4" cy="5" rx="9" ry="5" fill="#fff3b8"/>
    <ellipse class="a-ala" cx="-7" cy="-1" rx="9" ry="6" fill="#fff6d6" stroke="#4a3000" stroke-width="2"/><circle cx="7" cy="-4" r="5" fill="#fff" stroke="#4a3000" stroke-width="1.5"/><circle cx="9" cy="-4" r="2.2" fill="#111"/>
    <path d="M14 1 L26 4 L14 8 Z" fill="#ff7a1a" stroke="#4a3000" stroke-width="1.5"/></g></g>`;
  },

  dosmil: u => {
    const C = { 2: ["#eee4da", "#776e65"], 4: ["#ede0c8", "#776e65"], 8: ["#f2b179", "#fff"], 16: ["#f59563", "#fff"], 32: ["#f67c5f", "#fff"], 64: ["#f65e3b", "#fff"], 128: ["#edcf72", "#fff"], 256: ["#edcc61", "#fff"], 512: ["#edc850", "#fff"], 1024: ["#edc53f", "#fff"], 2048: ["#edc22e", "#fff"] };
    const t = [[2, 0, 4, 8], [0, 16, 32, 0], [64, 128, 0, 256], [512, 0, 1024, 2048]];
    let fichas = "";
    t.forEach((fila, y) => fila.forEach((v, x) => {
      const px = 92 + x * 56, py = 38 + y * 56;
      fichas += `<rect x="${px}" y="${py}" width="48" height="48" rx="5" fill="${v ? C[v][0] : "#cdc1b4"}"/>`;
      if (v) fichas += `<text x="${px + 24}" y="${py + 31}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="${v >= 1000 ? 14 : v >= 100 ? 17 : 22}" fill="${C[v][1]}">${v}</text>`;
    }));
    return `<defs><radialGradient id="g${u}" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#fff6d8"/><stop offset="1" stop-color="#e9d9b8"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <rect x="84" y="30" width="232" height="232" rx="10" fill="#bbada0"/>${fichas}
    <rect class="a-late" x="260" y="206" width="48" height="48" rx="5" fill="none" stroke="#fff3b0" stroke-width="3"/>`;
  },

  /* Tulones: el pudú al fondo y la torre de amigos congelados en
     calzoncillos, con el de arriba trepando. */
  /* Trigon: el hexágono de triángulos con algunas piezas puestas y una
     pieza de la mano flotando encima, en los colores del tema Clásico. */
  trigon: u => {
    const L = 3, S = 36, H = Math.sqrt(3) / 2, cx = 200, cy = 158;
    const P = ["#f6d23c", "#5ccf7a", "#9b7fe6", "#4fc6e0", "#ef5b5b", "#f39c3d", "#5b8def", "#e97bc8"];
    const llenos = { "-3,0,0": 4, "-3,1,0": 4, "-3,0,1": 4, "-2,1,0": 1, "-2,1,1": 1, "-1,1,0": 1, "0,-2,0": 2, "0,-2,1": 2, "1,-2,0": 2,
      "1,-3,1": 0, "2,-3,0": 0, "2,-3,1": 0, "0,1,0": 7, "1,1,0": 7, "0,1,1": 7, "2,-1,0": 3, "2,-1,1": 3, "-1,-1,1": 5, "0,-1,0": 5 };
    const dentro = (x, y) => Math.abs(x) <= L && Math.abs(y) <= L && Math.abs(x + y) <= L;
    const pt = (x, y) => [cx + (x + y / 2) * S, cy + y * H * S];
    const tri = (x, y, d) => d ? [[x + 1, y], [x, y + 1], [x + 1, y + 1]] : [[x, y], [x + 1, y], [x, y + 1]];
    const poli = (v, k) => {
      const q = v.map(([a, b]) => pt(a, b)), mx = (q[0][0] + q[1][0] + q[2][0]) / 3, my = (q[0][1] + q[1][1] + q[2][1]) / 3;
      return q.map(([a, b]) => (mx + (a - mx) * k).toFixed(1) + "," + (my + (b - my) * k).toFixed(1)).join(" ");
    };
    let celdas = "";
    for (let y = -L; y < L; y++) for (let x = -L; x <= L; x++) for (const d of [0, 1]) {
      const v = tri(x, y, d);
      if (!v.every(([a, b]) => dentro(a, b))) continue;
      const c = llenos[x + "," + y + "," + d];
      celdas += `<polygon points="${poli(v, .86)}" fill="${c === undefined ? "#54465b" : P[c]}"/>`;
    }
    const pieza = [[0, 0, 0], [0, 0, 1], [1, 0, 0]].map(([x, y, d]) => `<polygon points="${poli(tri(x + 4, y - 4, d), .86)}" fill="${P[2]}"/>`).join("");
    return `<defs><radialGradient id="g${u}" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#4b3a55"/><stop offset="1" stop-color="#2a2230"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <rect x="70" y="40" width="260" height="236" rx="16" fill="#3b2f3f"/>${celdas}
    <g class="a-mueve" style="filter:drop-shadow(0 6px 6px #0008)">${pieza}</g>`;
  },

  tulones: u => {
    const tipo = (x, y, r, piel, pelo, polera) => `<g transform="translate(${x} ${y}) rotate(${r})">
      <rect x="-9" y="-2" width="18" height="30" rx="7" fill="${piel}" stroke="#2a1d18" stroke-width="2"/>
      <path d="M-10 18 H10 V27 Q0 33 -10 27Z" fill="#f7f7f2" stroke="#2a1d18" stroke-width="2"/>
      <rect x="-9" y="-2" width="18" height="12" rx="5" fill="${polera}" stroke="#2a1d18" stroke-width="2"/>
      <path d="M-8 27 L-12 52 M8 27 L12 52" stroke="${piel}" stroke-width="7" stroke-linecap="round"/>
      <path d="M-9 4 L-24 20 M9 4 L24 -10" stroke="${piel}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="0" cy="-14" r="12" fill="${piel}" stroke="#2a1d18" stroke-width="2"/>
      <path d="M-12 -18 Q0 -32 12 -18 Q6 -24 -12 -18Z" fill="${pelo}"/>
      <circle cx="-4" cy="-14" r="1.8" fill="#2a1d18"/><circle cx="4" cy="-14" r="1.8" fill="#2a1d18"/>
      <path d="M-4 -7 Q0 -4 4 -7" stroke="#2a1d18" stroke-width="1.6" fill="none"/></g>`;
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".75" stop-color="#d8f1ff"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <circle cx="340" cy="54" r="26" fill="#fff6c2"/>
    <path d="M0 250 Q120 236 220 246 T400 240 V300 H0Z" fill="#6cbf4a"/>
    <g transform="translate(150 218)" stroke="#2a1d18" stroke-width="3"><path d="M-30 14 V38 M-12 16 V38 M14 16 V38 M30 14 V38" stroke="#c9743f" stroke-width="7" stroke-linecap="round"/>
      <path d="M-30 38 h1 M-12 38 h1 M14 38 h1 M30 38 h1" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round"/>
      <ellipse cx="0" cy="0" rx="44" ry="20" fill="#b4622e"/><path d="M-32 10 Q0 22 32 10" stroke="#d98a52" stroke-width="6" fill="none"/>
      <ellipse cx="34" cy="-32" rx="5" ry="11" fill="#b4622e" transform="rotate(-35 34 -32)"/><ellipse cx="54" cy="-32" rx="5" ry="11" fill="#b4622e" transform="rotate(30 54 -32)"/>
      <path d="M41 -28 L38 -38 M48 -28 L50 -38" stroke="#efe4c8" stroke-width="3"/>
      <ellipse cx="44" cy="-16" rx="14" ry="12" fill="#b4622e"/><ellipse cx="56" cy="-10" rx="7" ry="5" fill="#d98a52"/>
      <circle cx="61" cy="-9" r="2.8" fill="#1a1a1a" stroke="none"/><circle cx="46" cy="-19" r="2.2" fill="#1a1a1a" stroke="none"/></g>
    ${tipo(214, 160, 70, "#f2c29b", "#3b2a1a", "#e8322f")}${tipo(246, 112, -20, "#8d5a3b", "#111", "#2f7de1")}
    <g class="a-mueve">${tipo(262, 50, 12, "#ffd9b8", "#e0a020", "#2fb36b")}</g>`;
  },

  frontera: u => {
    const ventanas = Array.from({ length: 6 }, (_, k) => `<rect x="${304 + (k % 2) * 16}" y="${80 + Math.floor(k / 2) * 34}" width="8" height="14" rx="3" fill="#ffd27a"/>`).join("");
    return `<defs><linearGradient id="g${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset=".55" stop-color="#c2410c"/><stop offset=".85" stop-color="#fb923c"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${u})"/>
    <g opacity=".22" class="a-gira"><circle cx="230" cy="120" r="78" fill="#fff"/><path d="M152 120 A78 78 0 0 1 308 120 Z" fill="#ef4444"/><rect x="152" y="114" width="156" height="12" fill="#1a1020"/><circle cx="230" cy="120" r="20" fill="#fff" stroke="#1a1020" stroke-width="10"/></g>
    <path d="M0 236 Q100 214 200 230 T400 222 V300 H0Z" fill="#2a1206"/>
    <path d="M286 236 V70 L296 56 H336 L346 70 V236Z" fill="#1a1020"/><path d="M296 56 L316 24 L336 56Z" fill="#241430"/>
    <path d="M316 24 V4" stroke="#1a1020" stroke-width="3"/><path class="a-flamea" d="M317 4 L338 10 L317 17Z" fill="#fb923c"/>
    ${ventanas}<rect x="308" y="206" width="16" height="30" rx="8" fill="#ffb15c"/>
    <path d="M236 236 V150 L248 138 L260 150 V236Z M366 236 V160 L376 150 L386 160 V236Z" fill="#241430"/>`;
  }
};

/* El SVG de la portada de un juego del club, o "" si no tiene (la tarjeta
   cae entonces en su fondo `.sp-e-<id>` de siempre). */
/* La tarjeta del Club de Tulones (`tulonesclub`, la sala ya se llama `tulones`) usa la misma escena. */
ARTE.tulonesclub = ARTE.tulones;

export function portadaSolo(id) {
  const f = ARTE[id];
  if (!f) return "";
  const u = "ps" + (++n);
  return `<svg class="jg-sp-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${sombra(u)}${f(u)}${pieSombra(u)}</svg>`;
}
export const tienePortada = id => !!ARTE[id];
