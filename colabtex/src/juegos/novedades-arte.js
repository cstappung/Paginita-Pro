/*
 * Las escenas del banner de Novedades: una ilustración animada por juego,
 * a todo el ancho de la diapositiva.
 *
 * Cada una es un SVG de 1200×420 con `xMaxYMid slice`: en el PC llena la
 * diapositiva entera y el texto va encima, a la izquierda, sobre un velo
 * oscuro (`.jg-ban-c:after`); en el celular la escena es la franja de
 * arriba y el recorte deja ver solo la mitad derecha. Por eso **el motivo
 * de cada escena va entre x ≈ 600 y 1180**: a la izquierda queda solo
 * ambiente (cielo, luces), que en el PC tapa el texto y en el celular ni
 * se ve. PRODROP es la excepción: sus cartas son fotos (`<img>`), así que
 * su escena es HTML y se centra con CSS.
 *
 * Lo que se mueve lleva una clase `ep-*` y su animación vive en
 * juegos.html; solo corre en la diapositiva que se ve (`.jg-ban-c.on`) y
 * nunca con «menos movimiento». Los `id` llevan un contador: la primera
 * diapositiva sale dos veces (la copia del final del bucle) y un
 * `url(#id)` repetido apuntaría siempre a la primera.
 *
 * Puro (sin DOM): `tests/salon.test.cjs` comprueba que cada escena sale
 * sin `undefined` ni `NaN`.
 */

let cuenta = 0;
const SVG = (cuerpo) => `<svg class="ep-svg" viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">${cuerpo}</svg>`;

/* Un generador de números fijo: la misma escena cada vez (las estrellas no
   cambian de sitio entre un pintado y otro). */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const r1 = v => Math.round(v * 10) / 10;

/* Estrellas que titilan, repartidas por un rectángulo. */
function estrellas(az, n, x0, x1, y0, y1, color = "#fff") {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = r1(x0 + az() * (x1 - x0)), y = r1(y0 + az() * (y1 - y0)), r = r1(0.6 + az() * 1.6);
    s += `<circle class="ep-titila" cx="${x}" cy="${y}" r="${r}" fill="${color}" style="animation-delay:${r1(-az() * 4)}s;animation-duration:${r1(2 + az() * 3)}s"/>`;
  }
  return s;
}
/* Una estrella de cinco puntas centrada en (0,0). */
function estrella5(r, ri = r * 0.45) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? ri : r;
    p.push(`${r1(Math.cos(a) * q)},${r1(Math.sin(a) * q)}`);
  }
  return p.join(" ");
}

/* ---------- PRO HERO: el escenario y la autopista de notas ---------- */
function hero() {
  const u = ++cuenta, az = azar(7);
  const COL = ["#3ee05a", "#ff3b45", "#ffd23c", "#3aa0ff", "#ff8a1e"];
  /* Los cinco carriles: arriba en el horizonte (y 30) y en la línea de
     golpe (y 360), donde caen las notas. */
  const arriba = [842, 866, 890, 914, 938], golpe = [686, 788, 890, 992, 1094];
  const abajo = [658, 774, 890, 1006, 1122];
  let carriles = "", aros = "", notas = "", trastes = "";
  for (let i = 0; i < 5; i++) {
    carriles += `<line x1="${arriba[i]}" y1="30" x2="${abajo[i]}" y2="420" stroke="${COL[i]}" stroke-opacity=".35" stroke-width="2"/>`;
    aros += `<g transform="translate(${golpe[i]} 360)"><ellipse rx="44" ry="15" fill="#0b0716" stroke="${COL[i]}" stroke-width="5"/><ellipse rx="26" ry="8" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>
      <g class="ep-golpe" style="animation-delay:${r1(-i * 0.47)}s"><ellipse rx="56" ry="22" fill="${COL[i]}" opacity=".55" filter="url(#hb${u})"/><path d="M-30 0 L-12 -46 L0 -18 L10 -58 L22 -14 L32 -36 L36 0Z" fill="${COL[i]}" opacity=".8" filter="url(#hb${u})"/></g></g>`;
  }
  /* Los trastes, más juntos hacia el horizonte. */
  for (let k = 1; k < 9; k++) {
    const t = Math.pow(k / 9, 1.8), y = r1(30 + t * 390), xl = r1(830 - t * 230), xr = r1(950 + t * 230);
    trastes += `<line x1="${xl}" y1="${y}" x2="${xr}" y2="${y}" stroke="#fff" stroke-opacity="${r1(0.06 + t * 0.14)}" stroke-width="${r1(1 + t * 2)}"/>`;
  }
  const secuencia = [0, 2, 1, 3, 4, 2, 0, 3, 1, 4];
  secuencia.forEach((c, k) => {
    notas += `<g class="ep-nota" style="--x0:${arriba[c]}px;--x1:${golpe[c]}px;animation-delay:${r1(-k * 0.34)}s"><ellipse rx="44" ry="16" fill="#000" opacity=".45" cy="5"/><ellipse rx="44" ry="16" fill="${COL[c]}"/><ellipse rx="44" ry="16" fill="url(#hn${u})"/><ellipse rx="18" ry="6" fill="#fff" opacity=".9"/></g>`;
  });
  let chispas = "";
  for (let i = 0; i < 14; i++) chispas += `<circle class="ep-chispa" cx="${r1(660 + az() * 460)}" cy="${r1(340 + az() * 30)}" r="${r1(1.5 + az() * 2.5)}" fill="${COL[i % 5]}" style="animation-delay:${r1(-az() * 2)}s"/>`;
  /* El público: cabezas y manos en alto contra las luces. */
  let publico = "";
  for (let i = 0; i < 34; i++) {
    const x = r1(i * 36 + az() * 14), y = r1(392 + az() * 14);
    publico += `<circle cx="${x}" cy="${y}" r="${r1(13 + az() * 4)}"/>`;
    if (az() < 0.45) { const d = az() < 0.5 ? -1 : 1; publico += `<path class="ep-mano" style="animation-delay:${r1(-az() * 1.2)}s;transform-origin:${x}px ${y}px" d="M${x} ${y} l${d * 10} -44" stroke="#07040e" stroke-width="9" stroke-linecap="round"/>`; }
  }
  let astros = "";
  [[1080, 70, 16], [1150, 130, 10], [700, 60, 11], [1010, 30, 8]].forEach(([x, y, r], i) => {
    astros += `<g transform="translate(${x} ${y})"><polygon class="ep-brilla" points="${estrella5(r)}" fill="#ffe27a" style="animation-delay:${-i * 0.6}s"/></g>`;
  });
  return SVG(`<defs>
    <radialGradient id="hf${u}" cx=".74" cy=".05" r=".95"><stop offset="0" stop-color="#5b23a0"/><stop offset=".45" stop-color="#22103f"/><stop offset="1" stop-color="#07040f"/></radialGradient>
    <linearGradient id="hh${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".75"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
    <linearGradient id="hp${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0614"/><stop offset="1" stop-color="#1e1236"/></linearGradient>
    <linearGradient id="hn${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <filter id="hb${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="1200" height="420" fill="url(#hf${u})"/>
  ${estrellas(az, 40, 0, 1200, 0, 200, "#e9d8ff")}
  <g class="ep-foco" style="transform-origin:700px -10px"><polygon points="690,-10 712,-10 860,420 560,420" fill="url(#hh${u})" opacity=".4"/></g>
  <g class="ep-foco b" style="transform-origin:1100px -10px"><polygon points="1090,-10 1112,-10 1240,420 960,420" fill="url(#hh${u})" opacity=".38"/></g>
  <g class="ep-foco c" style="transform-origin:890px -10px"><polygon points="880,-10 900,-10 1000,420 780,420" fill="url(#hh${u})" opacity=".22"/></g>
  <polygon points="826,30 954,30 1190,420 590,420" fill="#ffb21e" opacity=".25" filter="url(#hb${u})"/>
  <polygon points="830,30 950,30 1180,420 600,420" fill="url(#hp${u})" stroke="#ffcf6b" stroke-width="3"/>
  ${trastes}${carriles}${aros}${notas}${chispas}${astros}
  <g fill="#07040e">${publico}</g>`);
}

/* ---------- Mascotas: la pradera al atardecer y la gallina coronada ---------- */
function mascotas() {
  const u = ++cuenta, az = azar(11);
  let corazones = "", brillos = "", pasto = "";
  for (let i = 0; i < 7; i++) {
    const x = r1(640 + az() * 520), y = r1(260 + az() * 80), e = r1(0.6 + az() * 0.8);
    corazones += `<g transform="translate(${x} ${y}) scale(${e})"><path class="ep-sube" style="animation-delay:${r1(-az() * 4)}s" d="M0 8 C-14 -4 -22 -14 -12 -22 C-6 -27 0 -22 0 -16 C0 -22 6 -27 12 -22 C22 -14 14 -4 0 8Z" fill="#ff5f9e" stroke="#fff" stroke-width="2"/></g>`;
  }
  for (let i = 0; i < 9; i++) {
    const x = r1(620 + az() * 560), y = r1(60 + az() * 240), r = r1(5 + az() * 7);
    brillos += `<path class="ep-titila" style="animation-delay:${r1(-az() * 3)}s" d="M${x} ${r1(y - r)} Q${x} ${y} ${r1(x + r)} ${y} Q${x} ${y} ${x} ${r1(y + r)} Q${x} ${y} ${r1(x - r)} ${y} Q${x} ${y} ${x} ${r1(y - r)}Z" fill="#fff8d6"/>`;
  }
  for (let i = 0; i < 40; i++) {
    const x = r1(i * 31 + az() * 10), h = r1(10 + az() * 16);
    pasto += `<path d="M${x} 420 q4 -${h} 2 -${r1(h * 1.6)} M${r1(x + 6)} 420 q-2 -${h} 6 -${r1(h * 1.4)}" stroke="#2f8a3d" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  return SVG(`<defs>
    <linearGradient id="mc${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4bd6"/><stop offset=".5" stop-color="#ff86a8"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
    <radialGradient id="ms${u}"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#ffe7a1" stop-opacity=".7"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>
    <radialGradient id="mp${u}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b8"/><stop offset=".45" stop-color="#ffd23c"/><stop offset="1" stop-color="#e8960f"/></radialGradient>
    <linearGradient id="mh${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8be070"/><stop offset="1" stop-color="#3f9b4a"/></linearGradient>
    <linearGradient id="mo${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffc533"/><stop offset="1" stop-color="#d98a00"/></linearGradient>
    <radialGradient id="mr${u}"><stop offset="0" stop-color="#fff2a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffcc3d" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#mc${u})"/>
  <circle cx="1030" cy="170" r="190" fill="url(#ms${u})"/><circle cx="1030" cy="170" r="62" fill="#fff6d6"/>
  <g class="ep-nube" fill="#fff" opacity=".8"><ellipse cx="700" cy="90" rx="60" ry="18"/><ellipse cx="735" cy="78" rx="34" ry="18"/></g>
  <g class="ep-nube b" fill="#fff" opacity=".65"><ellipse cx="1100" cy="60" rx="48" ry="14"/><ellipse cx="1125" cy="50" rx="26" ry="14"/></g>
  <path d="M0 330 Q300 260 620 320 T1200 290 V420 H0Z" fill="#6fc86a"/>
  <path d="M0 370 Q400 320 760 360 T1200 340 V420 H0Z" fill="url(#mh${u})"/>
  <g transform="translate(700 330)">
    <g class="ep-giro" style="transform-origin:0 -78px"><g transform="translate(0 -78)">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="-3" y="-70" width="6" height="40" rx="3" fill="#ffe27a" opacity=".8" transform="rotate(${a})"/>`).join("")}</g></g>
    <circle cy="-78" r="60" fill="url(#mr${u})"/>
    <g transform="translate(0 -78)"><polygon class="ep-brilla" points="${estrella5(22)}" fill="#ffe27a" stroke="#fff" stroke-width="2"/></g>
    <rect x="-46" y="-30" width="92" height="66" rx="8" fill="#8b3dff"/><rect x="-8" y="-30" width="16" height="66" fill="#ffcc3d"/>
    <g class="ep-tapa"><rect x="-52" y="-46" width="104" height="22" rx="6" fill="#a965ff"/><rect x="-8" y="-46" width="16" height="22" fill="#ffcc3d"/>
      <path d="M0 -46 C-24 -76 -46 -56 -24 -46 M0 -46 C24 -76 46 -56 24 -46" stroke="#ffcc3d" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  </g>
  <g transform="translate(1085 340)"><g class="ep-tambalea"><ellipse rx="42" ry="54" cy="-50" fill="#fff8ec" stroke="#e7d6b8" stroke-width="3"/>
    <path d="M-40 -58 l14 10 l12 -14 l12 12 l14 -12 l14 12 l14 -8" stroke="#b9956a" stroke-width="3" fill="none" stroke-linejoin="round"/>
    <circle cx="10" cy="-66" r="5" fill="#1a1206"/><circle cx="12" cy="-68" r="1.6" fill="#fff"/></g></g>
  <g transform="translate(900 300)"><g class="ep-baila">
    <ellipse cy="96" rx="80" ry="12" fill="#2d6b33" opacity=".45"/>
    <path d="M-30 80 l-8 18 M-30 80 l4 18 M30 80 l-4 18 M30 80 l8 18" stroke="#ff8a1e" stroke-width="6" stroke-linecap="round"/>
    <g class="ep-ala" style="transform-origin:-70px -10px"><ellipse cx="-86" cy="10" rx="26" ry="42" fill="#f4b522" transform="rotate(24 -86 10)"/></g>
    <g class="ep-ala d" style="transform-origin:70px -10px"><ellipse cx="86" cy="10" rx="26" ry="42" fill="#f4b522" transform="rotate(-24 86 10)"/></g>
    <ellipse rx="92" ry="88" fill="url(#mp${u})" stroke="#c97a08" stroke-width="3"/>
    <ellipse cx="-30" cy="-48" rx="30" ry="16" fill="#fff" opacity=".35"/>
    <path d="M-8 -86 q-6 -26 8 -30 q-2 14 8 4 q4 16 -8 26" fill="#ffd23c" stroke="#c97a08" stroke-width="3"/>
    <polygon points="-40,-92 -46,-128 -24,-108 0,-136 24,-108 46,-128 40,-92" fill="url(#mo${u})" stroke="#a86a00" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="0" cy="-112" r="6" fill="#ff3b6b"/><circle cx="-26" cy="-104" r="4" fill="#3aa0ff"/><circle cx="26" cy="-104" r="4" fill="#3ee05a"/>
    <g transform="translate(-40 -126)"><polygon class="ep-brilla" points="${estrella5(7)}" fill="#fff"/></g>
    <g class="ep-parpadea"><ellipse cx="-30" cy="-18" rx="13" ry="16" fill="#1a1206"/><ellipse cx="30" cy="-18" rx="13" ry="16" fill="#1a1206"/>
      <circle cx="-26" cy="-24" r="5" fill="#fff"/><circle cx="34" cy="-24" r="5" fill="#fff"/></g>
    <ellipse cx="-54" cy="10" rx="14" ry="8" fill="#ff7f9e" opacity=".7"/><ellipse cx="54" cy="10" rx="14" ry="8" fill="#ff7f9e" opacity=".7"/>
    <path d="M-16 2 L16 2 L0 24Z" fill="#ff8a1e" stroke="#c45a00" stroke-width="2" stroke-linejoin="round"/>
  </g></g>
  ${corazones}${brillos}${pasto}`);
}

/* ---------- PRO TILES: fichas negras que caen sobre un piano ---------- */
function protiles() {
  const u = ++cuenta, az = azar(5);
  const X0 = 664, ANCHO = 120;
  let fichas = "", notas = "", eq = "", teclas = "";
  [1, 3, 0, 2, 3, 1, 2, 0].forEach((c, k) => {
    fichas += `<g class="ep-ficha" style="animation-delay:${r1(-k * 0.5)}s"><rect class="ep-ficha-luz" style="animation-delay:${r1(-k * 0.5)}s" x="${X0 + c * ANCHO + 4}" y="0" width="${ANCHO - 8}" height="150" rx="10" stroke="#ffffff22" stroke-width="2"/><rect x="${X0 + c * ANCHO + 10}" y="6" width="${ANCHO - 20}" height="22" rx="6" fill="#fff" opacity=".08"/></g>`;
  });
  for (let i = 0; i < 8; i++) {
    const x = r1(560 + az() * 90 + (i % 2) * 560), s = ["♪", "♫", "♬"][i % 3];
    notas += `<text class="ep-sube" style="animation-delay:${r1(-az() * 5)}s" x="${x}" y="${r1(250 + az() * 140)}" font-size="${r1(26 + az() * 22)}" fill="#ffd2c4">${s}</text>`;
  }
  for (let i = 0; i < 8; i++) eq += `<rect class="ep-eq" style="animation-delay:${r1(-az())}s;transform-origin:${560 + i * 12}px 370px" x="${560 + i * 12}" y="250" width="8" height="120" rx="3" fill="#ff5a36" opacity=".7"/>`;
  for (let i = 0; i < 14; i++) teclas += `<rect x="${r1(560 + i * 46)}" y="372" width="44" height="48" rx="4" fill="#f8f4ee" stroke="#c9bfb2"/>`;
  [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].forEach(i => { teclas += `<rect x="${r1(560 + i * 46 + 30)}" y="372" width="28" height="30" rx="3" fill="#15121c"/>`; });
  return SVG(`<defs>
    <linearGradient id="tf${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0718"/><stop offset=".6" stop-color="#3b0e2c"/><stop offset="1" stop-color="#ff5a36"/></linearGradient>
    <radialGradient id="tg${u}" cx=".75" cy=".8" r=".6"><stop offset="0" stop-color="#ff7a45" stop-opacity=".7"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
    <linearGradient id="tl${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a36" stop-opacity="0"/><stop offset=".5" stop-color="#ffe0a8"/><stop offset="1" stop-color="#ff5a36" stop-opacity="0"/></linearGradient>
    <filter id="tb${u}" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="6"/></filter>
    <clipPath id="tc${u}"><rect x="${X0}" y="0" width="${ANCHO * 4}" height="372"/></clipPath>
  </defs>
  <rect width="1200" height="420" fill="url(#tf${u})"/><rect width="1200" height="420" fill="url(#tg${u})"/>
  ${estrellas(az, 30, 0, 1200, 0, 220, "#ffd2c4")}
  <rect x="${X0}" y="0" width="${ANCHO * 4}" height="372" fill="#fff" opacity=".07"/>
  ${[1, 2, 3].map(k => `<line x1="${X0 + k * ANCHO}" y1="0" x2="${X0 + k * ANCHO}" y2="372" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`).join("")}
  <g clip-path="url(#tc${u})">${fichas}</g>
  <rect x="${X0 - 20}" y="318" width="${ANCHO * 4 + 40}" height="12" fill="url(#tl${u})" filter="url(#tb${u})"/>
  <rect x="${X0}" y="322" width="${ANCHO * 4}" height="4" fill="url(#tl${u})"/>
  <g class="ep-onda"><ellipse cx="${X0 + 2.5 * ANCHO}" cy="324" rx="70" ry="16" fill="none" stroke="#ffe0a8" stroke-width="3"/></g>
  ${eq}${notas}
  <g>${teclas}</g>
  <rect x="560" y="370" width="660" height="4" fill="#ff5a36"/>`);
}

/* ---------- HaxBall: el estadio desde arriba y el gol ---------- */
function haxball() {
  const u = ++cuenta;
  const disco = (x, y, c, n, cl = "") => `<g transform="translate(${x} ${y})"><g class="${cl}"><circle r="25" fill="#000" opacity=".35" cy="4"/><circle r="23" fill="${c}" stroke="#111" stroke-width="3"/><text y="7" text-anchor="middle" font-size="19" font-weight="800" font-family="system-ui,sans-serif" fill="#fff">${n}</text></g></g>`;
  return SVG(`<defs>
    <pattern id="xc${u}" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="3" fill="#e56e56" opacity=".7"/><circle cx="11" cy="11" r="3" fill="#5689e5" opacity=".7"/><circle cx="11" cy="3" r="2.4" fill="#fff" opacity=".45"/></pattern>
    <pattern id="xs${u}" width="120" height="420" patternUnits="userSpaceOnUse"><rect width="60" height="420" fill="#4a9b42"/><rect x="60" width="60" height="420" fill="#418d3b"/></pattern>
    <pattern id="xr${u}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0L8 8M8 0L0 8" stroke="#fff" stroke-opacity=".7" stroke-width="1"/></pattern>
    <radialGradient id="xl${u}"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="xe${u}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="420" fill="#08140c"/>
  <rect y="0" width="1200" height="64" fill="url(#xc${u})"/><rect y="356" width="1200" height="64" fill="url(#xc${u})"/>
  <rect y="62" width="1200" height="296" fill="#173a16"/>
  <rect x="520" y="74" width="640" height="272" fill="url(#xs${u})"/>
  <g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="4">
    <rect x="520" y="74" width="630" height="272"/>
    <line x1="620" y1="74" x2="620" y2="346"/><circle cx="620" cy="210" r="62"/>
    <rect x="1030" y="128" width="120" height="164"/><rect x="1100" y="170" width="50" height="80"/>
  </g>
  <rect x="1150" y="168" width="38" height="84" fill="url(#xr${u})" stroke="#fff" stroke-width="3"/>
  <circle cx="1150" cy="168" r="7" fill="#fff"/><circle cx="1150" cy="252" r="7" fill="#fff"/>
  <rect class="ep-red" x="1150" y="168" width="38" height="84" fill="#ffe27a" opacity="0"/>
  <circle cx="560" cy="40" r="140" fill="url(#xl${u})"/><circle cx="1180" cy="40" r="160" fill="url(#xl${u})"/><circle cx="1180" cy="400" r="140" fill="url(#xl${u})"/>
  ${disco(1112, 210, "#5689e5", 1, "ep-arquero")}
  ${disco(1040, 146, "#5689e5", 4, "ep-corre")}
  ${disco(960, 300, "#5689e5", 7, "ep-corre b")}
  ${disco(870, 140, "#e56e56", 10, "ep-corre b")}
  ${disco(905, 280, "#e56e56", 9, "ep-corre")}
  <g transform="translate(985 214)"><circle class="ep-patea" r="34" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/></g>
  ${disco(985, 214, "#e56e56", 11)}
  <g class="ep-balon"><rect x="-90" y="-5" width="86" height="10" rx="5" fill="url(#xe${u})" class="ep-estela"/><circle r="12" fill="#000" opacity=".35" cy="3"/><circle r="11" fill="#fff" stroke="#111" stroke-width="2.5"/></g>
  <text class="ep-gol" x="1000" y="118" text-anchor="middle" font-family="Bungee,'Arial Black',Impact,sans-serif" font-size="66" fill="#ffe27a" stroke="#1a1206" stroke-width="6" paint-order="stroke">¡GOL!</text>`);
}

/* ---------- TULONES: la torre de congelados sobre el pudú ---------- */
function tulones() {
  const u = ++cuenta, az = azar(3);
  /* Un muñeco de trapo: torso, cabeza, calzoncillos y cuatro extremidades
     (ángulos en grados desde el hombro o la cadera). Los congelados son
     de hielo, el que trepa es de carne y hueso. */
  const muneco = (x, y, rot, { hielo = true, brazos = [200, -20], piernas = [110, 70], cl = "" } = {}) => {
    const piel = hielo ? "#c9ecff" : "#f2c094", borde = hielo ? "#5f9ccc" : "#8a5a3a";
    const lim = (x0, y0, a, l) => { const r = a * Math.PI / 180; return `<line x1="${x0}" y1="${y0}" x2="${r1(x0 + Math.cos(r) * l)}" y2="${r1(y0 + Math.sin(r) * l)}"/>`; };
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="${cl}">
      <g stroke="${borde}" stroke-width="15" stroke-linecap="round">${lim(-12, -14, brazos[0], 36)}${lim(12, -14, brazos[1], 36)}${lim(-8, 22, piernas[0], 40)}${lim(8, 22, piernas[1], 40)}</g>
      <g stroke="${piel}" stroke-width="10" stroke-linecap="round">${lim(-12, -14, brazos[0], 36)}${lim(12, -14, brazos[1], 36)}${lim(-8, 22, piernas[0], 40)}${lim(8, 22, piernas[1], 40)}</g>
      <rect x="-15" y="-22" width="30" height="44" rx="11" fill="${piel}" stroke="${borde}" stroke-width="3"/>
      <rect x="-16" y="10" width="32" height="16" rx="5" fill="${hielo ? "#eef8ff" : "#e8322f"}" stroke="${borde}" stroke-width="3"/>
      <circle cy="-38" r="16" fill="${piel}" stroke="${borde}" stroke-width="3"/>
      ${hielo ? `<path d="M-6 -44 l4 4 M4 -44 l4 4" stroke="${borde}" stroke-width="2.5" stroke-linecap="round"/><path d="M-6 -30 q6 -4 12 0" stroke="${borde}" stroke-width="2.5" fill="none"/><path d="M-10 -12 l6 -6 l4 8 l6 -10" stroke="#fff" stroke-width="2.5" fill="none" opacity=".9"/>`
        : `<circle cx="-5" cy="-41" r="2.6" fill="#1a1206"/><circle cx="6" cy="-41" r="2.6" fill="#1a1206"/><path d="M-6 -31 q6 6 12 0" stroke="#1a1206" stroke-width="2.5" fill="none" stroke-linecap="round"/>`}
    </g></g>`;
  };
  let copos = "", regla = "";
  for (let i = 0; i < 26; i++) copos += `<circle class="ep-cae" cx="${r1(560 + az() * 640)}" cy="${r1(az() * 420)}" r="${r1(1.5 + az() * 2.5)}" fill="#fff" style="animation-delay:${r1(-az() * 6)}s;animation-duration:${r1(5 + az() * 4)}s"/>`;
  for (let m = 0; m <= 14; m += 2) { const y = r1(392 - m * 21.5); regla += `<line x1="1160" y1="${y}" x2="${m % 4 ? 1172 : 1180}" y2="${y}" stroke="#2b4a66" stroke-width="3"/>${m % 4 ? "" : `<text x="1150" y="${r1(y + 5)}" text-anchor="end" font-size="14" font-weight="700" font-family="system-ui,sans-serif" fill="#2b4a66">${m} m</text>`}`; }
  return SVG(`<defs>
    <linearGradient id="uc${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb7f0"/><stop offset=".6" stop-color="#bfe6ff"/><stop offset="1" stop-color="#fff1d6"/></linearGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#uc${u})"/>
  <circle cx="960" cy="44" r="60" fill="#fff7d0" opacity=".35"/><circle cx="960" cy="44" r="30" fill="#fff7d0"/>
  <path d="M500 330 L640 190 L720 260 L820 160 L960 300 L1060 210 L1200 320 V420 H500Z" fill="#9cc4e4"/>
  <path d="M640 190 L668 218 L652 222 L640 210 L626 226 L612 218Z M820 160 L852 192 L832 196 L820 184 L806 198 L790 190Z M1060 210 L1088 238 L1072 240 L1060 230 L1046 242 L1034 236Z" fill="#fff"/>
  <g class="ep-nube" fill="#fff" opacity=".9"><ellipse cx="760" cy="70" rx="56" ry="16"/><ellipse cx="790" cy="58" rx="30" ry="16"/></g>
  <g class="ep-nube b" fill="#fff" opacity=".8"><ellipse cx="1080" cy="110" rx="44" ry="13"/><ellipse cx="1100" cy="100" rx="24" ry="13"/></g>
  <rect x="500" y="392" width="700" height="28" fill="#f2fbff"/>
  <line x1="560" y1="96" x2="1200" y2="96" stroke="#e8322f" stroke-width="4" stroke-dasharray="14 10"/>
  <g transform="translate(1040 96)"><rect x="-6" y="-26" width="110" height="24" rx="6" fill="#e8322f"/><text x="49" y="-9" text-anchor="middle" font-size="14" font-weight="800" font-family="system-ui,sans-serif" fill="#fff">RÉCORD 13 m</text></g>
  ${regla}
  <g transform="translate(900 392)">
    <ellipse cy="0" rx="70" ry="8" fill="#9cc4e4"/>
    <g stroke="#6b4423" stroke-width="7" stroke-linecap="round"><line x1="-34" y1="-20" x2="-38" y2="0"/><line x1="-18" y1="-20" x2="-16" y2="0"/><line x1="22" y1="-20" x2="20" y2="0"/><line x1="38" y1="-20" x2="42" y2="0"/></g>
    <ellipse cy="-34" rx="52" ry="22" fill="#9a6838" stroke="#6b4423" stroke-width="3"/>
    <g transform="translate(-54 -50)"><ellipse rx="20" ry="16" fill="#9a6838" stroke="#6b4423" stroke-width="3"/><ellipse cx="-6" cy="-16" rx="6" ry="11" fill="#9a6838" stroke="#6b4423" stroke-width="3" transform="rotate(-30 -6 -16)"/><path d="M4 -14 l4 -12 M8 -20 l6 -4" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><circle cx="-8" cy="-2" r="2.6" fill="#1a1206"/><circle cx="-18" cy="4" r="3.2" fill="#1a1206"/></g>
  </g>
  ${muneco(880, 318, 18, { brazos: [210, -30], piernas: [100, 60] })}
  ${muneco(930, 262, -70, { brazos: [160, 10], piernas: [130, 40] })}
  ${muneco(872, 214, 40, { brazos: [230, -60], piernas: [120, 80] })}
  ${muneco(918, 168, -20, { brazos: [190, -10], piernas: [95, 75] })}
  <g transform="translate(902 142)"><g class="ep-trepa" style="transform-origin:0 40px">${muneco(0, -10, 0, { hielo: false, brazos: [250, -70], piernas: [110, 60] })}</g></g>
  <g fill="#fff">${[[870, 300], [940, 246], [880, 196], [925, 150]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><polygon class="ep-brilla" style="animation-delay:${-i * 0.5}s" points="${estrella5(6, 2)}"/></g>`).join("")}</g>
  ${copos}`);
}

/* ---------- Trigon: el hexágono de triángulos y una línea que estalla ---------- */
function trigon() {
  const u = ++cuenta, az = azar(19);
  const CX = 900, CY = 214, S = 46, H = S * Math.sqrt(3) / 2, R = 4 * S;
  const PAL = ["#f6d23c", "#9b7bff", "#ff9a3c", "#3fc6e6", "#e5506a", "#4cc76a", "#d77bd1"];
  const FILA_BORRA = 5;   // la fila que se está completando
  let celdas = "", borra = "";
  for (let fila = 0; fila < 8; fila++) {
    const y0 = CY - 4 * H + fila * H;
    for (let k = -10; k <= 10; k++) {
      const x = CX + k * S / 2;
      const arribaApunta = (k + fila) % 2 === 0;
      const pts = arribaApunta ? [[x - S / 2, y0 + H], [x, y0], [x + S / 2, y0 + H]] : [[x - S / 2, y0], [x + S / 2, y0], [x, y0 + H]];
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3 - CX, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3 - CY;
      if (Math.sqrt(3) * Math.abs(cx) + Math.abs(cy) > Math.sqrt(3) * R - 4 || Math.abs(cy) > 4 * H) continue;
      const p = pts.map(q => `${r1(q[0])},${r1(q[1])}`).join(" ");
      if (fila === FILA_BORRA) borra += `<polygon class="ep-borra" points="${p}" fill="${PAL[Math.abs(k) % PAL.length]}" stroke="#0c0620" stroke-width="3" stroke-linejoin="round"/>`;
      else if (az() < 0.5) celdas += `<polygon points="${p}" fill="${PAL[Math.floor(az() * PAL.length)]}" stroke="#0c0620" stroke-width="3" stroke-linejoin="round"/><polygon points="${p}" fill="url(#ib${u})"/>`;
      else celdas += `<polygon points="${p}" fill="#ffffff0f" stroke="#ffffff26" stroke-width="2" stroke-linejoin="round"/>`;
    }
  }
  const yb = r1(CY - 4 * H + FILA_BORRA * H + H / 2);
  let chispas = "";
  for (let i = 0; i < 12; i++) chispas += `<circle class="ep-estalla" style="--dx:${r1((az() - 0.5) * 160)}px;--dy:${r1(-30 - az() * 90)}px;animation-delay:${r1(-az() * 0.2)}s" cx="${r1(CX - 170 + az() * 340)}" cy="${yb}" r="${r1(3 + az() * 4)}" fill="${PAL[i % PAL.length]}"/>`;
  /* La pieza que se está arrastrando: tres triángulos unidos. */
  const pieza = [[0, 0, 1], [S / 2, 0, 0], [S, 0, 1]].map(([dx, dy, up]) => {
    const pts = up ? [[dx - S / 2, H], [dx, 0], [dx + S / 2, H]] : [[dx - S / 2, 0], [dx + S / 2, 0], [dx, H]];
    return `<polygon points="${pts.map(q => `${r1(q[0])},${r1(q[1] + dy)}`).join(" ")}" fill="#3fc6e6" stroke="#0c0620" stroke-width="3" stroke-linejoin="round"/>`;
  }).join("");
  return SVG(`<defs>
    <radialGradient id="if${u}" cx=".75" cy=".5" r=".75"><stop offset="0" stop-color="#3a1c7a"/><stop offset=".6" stop-color="#170b38"/><stop offset="1" stop-color="#07030f"/></radialGradient>
    <linearGradient id="ib${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></linearGradient>
    <radialGradient id="ih${u}"><stop offset="0" stop-color="#9b7bff" stop-opacity=".45"/><stop offset="1" stop-color="#9b7bff" stop-opacity="0"/></radialGradient>
    <filter id="ig${u}" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="1200" height="420" fill="url(#if${u})"/>
  ${estrellas(az, 70, 0, 1200, 0, 420, "#d9ccff")}
  <circle cx="${CX}" cy="${CY}" r="250" fill="url(#ih${u})"/>
  <g class="ep-gira-lento" style="transform-origin:${CX}px ${CY}px">
    <polygon points="${[0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return `${r1(CX + Math.cos(a) * (R + 16))},${r1(CY + Math.sin(a) * (R + 16))}`; }).join(" ")}" fill="none" stroke="#f6d23c" stroke-opacity=".35" stroke-width="3" stroke-dasharray="10 12"/>
  </g>
  ${celdas}
  <rect class="ep-raya" x="${CX - 190}" y="${r1(yb - 10)}" width="380" height="20" fill="#fff" filter="url(#ig${u})"/>
  ${borra}${chispas}
  <g transform="translate(1078 46)"><g class="ep-flota"><g transform="translate(4 10)" opacity=".35">${pieza.replace(/#3fc6e6/g, "#000")}</g>${pieza}</g></g>
  <text class="ep-combo" x="724" y="42" font-family="Bungee,'Arial Black',Impact,sans-serif" font-size="30" fill="#f6d23c" stroke="#2a0f55" stroke-width="5" paint-order="stroke">COMBO ×3</text>`);
}

/* ---------- PRODROP: tres cartas, la legendaria al centro y sus rayos ---------- */
function prodrop({ serie1 = false } = {}) {
  const cartas = serie1
    ? ["epicas/javier-pereda-torres-gta", "legendarias/claudia-prieto-shiny", "epicas/david-watts-casino"]
    : ["componentes/dieciochero/esp32", "componentes/quemado/timer-555", "componentes/halloween/led"];
  const az = azar(23);
  let chispas = "";
  for (let i = 0; i < 12; i++) chispas += `<i class="ep-pd-chispa" style="left:${r1(az() * 100)}%;top:${r1(az() * 100)}%;animation-delay:${r1(-az() * 3)}s"></i>`;
  return `<div class="ep-pd" aria-hidden="true"><i class="ep-pd-rayos"></i><i class="ep-pd-halo"></i>
    <div class="ep-pd-mano">${cartas.map((c, i) => `<span class="ep-pd-carta c${i + 1}"><img src="juegos/prodrop/cards/${c}.webp" alt="" loading="lazy" decoding="async">${i === 1 ? '<i class="ep-pd-holo"></i>' : ""}</span>`).join("")}
      <b class="ep-pd-leg">★ LEGENDARIA</b></div>${chispas}</div>`;
}

/* ---------- PRODROP · Fútbol: la misma mano, con tres cartas de fútbol de
   verdad: foto, media, nombre y la cinta de las especiales (por tiempo
   limitado). Las especiales van con su marco dorado; Vidal, por la llegada
   de la liga chilena, con el franjeado de «Liga Chilena» abajo. La media de la
   izquierda va a la izquierda y las otras a la derecha: la carta de al
   medio tapa un pedazo de las de los lados, y así las tres se leen. Las
   medias son las del motor (juegos/prodrop/motor.js; un test las compara). ---------- */
const CARTAS_FUTBOL = [
  { img: "champions/colocolo/arturo-vidal", nombre: "Arturo Vidal", media: 73, cinta: "COLO-COLO" },
  { img: "especiales/realmadrid/mbappe-mvp", nombre: "Mbappé", media: 92, cinta: "MVP DEL CLÁSICO" },
  { img: "especiales/bayern/harry-kane-balon", nombre: "Harry Kane", media: 94, cinta: "BALÓN DE ORO" }
];
function futbol() {
  const az = azar(31);
  let chispas = "";
  for (let i = 0; i < 12; i++) chispas += `<i class="ep-pd-chispa" style="left:${r1(az() * 100)}%;top:${r1(az() * 100)}%;animation-delay:${r1(-az() * 3)}s"></i>`;
  return `<div class="ep-pd ep-fu" aria-hidden="true"><i class="ep-pd-rayos"></i><i class="ep-pd-halo"></i>
    <div class="ep-pd-mano">${CARTAS_FUTBOL.map((c, i) => `<span class="ep-pd-carta c${i + 1}"><img src="juegos/prodrop/cards/${c.img}.webp" alt="" loading="lazy" decoding="async">${i === 1 ? '<i class="ep-pd-holo"></i>' : ""}
      <b class="ep-fc-media">${c.media}<small>MEDIA</small></b>${c.cinta ? `<i class="ep-fc-cinta">${c.cinta}</i>` : ""}<em class="ep-fc-nombre">${c.nombre}</em></span>`).join("")}
      <b class="ep-pd-leg">★ LEGENDARIA</b></div>
    <b class="ep-fc-liga"><img src="juegos/prodrop/flags/cl.png" alt="">LIGA CHILENA</b>${chispas}</div>`;
}

/* ---------- FANAL: el farol en la noche y lo que viene a su luz ---------- */
function fanal() {
  const u = ++cuenta, az = azar(29);
  const CX = 890, CY = 210;
  let polillas = "", brasas = "", rayos = "";
  [[110, 7, 0], [150, 11, -3], [190, 9, -6], [240, 14, -2], [130, 8.5, -5]].forEach(([r, d, del], i) => {
    polillas += `<g class="ep-orbita${i % 2 ? " inv" : ""}" style="transform-origin:${CX}px ${CY}px;animation-duration:${d}s;animation-delay:${del}s"><g transform="translate(${CX + r} ${CY})"><g class="ep-aletea" style="animation-delay:${r1(-az())}s"><path d="M0 0 C-14 -16 -24 -6 -18 4 C-12 10 -4 6 0 0 C4 6 12 10 18 4 C24 -6 14 -16 0 0Z" fill="${["#b8a088", "#c47a3c", "#9a4a62"][i % 3]}" stroke="#2a1a10" stroke-width="1.5"/><ellipse rx="2.5" ry="7" fill="#2a1a10"/></g></g></g>`;
  });
  for (let i = 0; i < 18; i++) brasas += `<circle class="ep-brasa" style="animation-delay:${r1(-az() * 5)}s;--dx:${r1((az() - 0.5) * 80)}px" cx="${r1(CX - 60 + az() * 120)}" cy="${r1(CY + 40 + az() * 60)}" r="${r1(1.5 + az() * 2.5)}" fill="${az() < 0.5 ? "#ffcf6b" : "#ff8a3c"}"/>`;
  [[-150, -110], [170, -90], [210, 60]].forEach(([dx, dy], i) => {
    rayos += `<line class="ep-disparo" style="animation-delay:${r1(-i * 0.9)}s" x1="${CX}" y1="${CY}" x2="${CX + dx}" y2="${CY + dy}" stroke="#fff3c4" stroke-width="4" stroke-linecap="round"/>`;
  });
  return SVG(`<defs>
    <linearGradient id="ff${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04040c"/><stop offset=".65" stop-color="#121033"/><stop offset="1" stop-color="#1d1236"/></linearGradient>
    <radialGradient id="fh${u}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".85"/><stop offset=".35" stop-color="#ff9a3c" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="fl${u}" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fffbe6"/><stop offset=".4" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8a1e"/></radialGradient>
    <linearGradient id="fa${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1234"/><stop offset="1" stop-color="#05040e"/></linearGradient>
    <linearGradient id="fr${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".7"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></linearGradient>
    <filter id="fb${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="1200" height="420" fill="url(#ff${u})"/>
  ${estrellas(az, 80, 0, 1200, 0, 280, "#e8e0ff")}
  <path d="M1010 60 a34 34 0 1 0 34 46 a28 28 0 1 1 -34 -46Z" fill="#f2e6c8" opacity=".9"/>
  <g class="ep-parpadea"><ellipse cx="1130" cy="92" rx="10" ry="5" fill="#ff3b3b" filter="url(#fb${u})"/><ellipse cx="1166" cy="92" rx="10" ry="5" fill="#ff3b3b" filter="url(#fb${u})"/><ellipse cx="1130" cy="92" rx="5" ry="2.5" fill="#ffd0c4"/><ellipse cx="1166" cy="92" rx="5" ry="2.5" fill="#ffd0c4"/></g>
  <path d="M480 312 L560 270 L640 296 L760 250 L860 290 L980 240 L1080 284 L1200 256 V330 H480Z" fill="#0a0918"/>
  <rect x="480" y="328" width="720" height="92" fill="url(#fa${u})"/>
  <ellipse class="ep-reflejo" cx="${CX}" cy="372" rx="40" ry="48" fill="url(#fr${u})" filter="url(#fb${u})"/>
  ${[0, 1, 2].map(i => `<line class="ep-ola" style="animation-delay:${-i * 0.8}s" x1="${CX - 70 + i * 20}" y1="${345 + i * 18}" x2="${CX + 50 - i * 10}" y2="${345 + i * 18}" stroke="#ffcf6b" stroke-opacity=".5" stroke-width="2"/>`).join("")}
  <circle class="ep-halo" cx="${CX}" cy="${CY}" r="230" fill="url(#fh${u})"/>
  ${rayos}
  <g transform="translate(${CX} ${CY})">
    <path d="M-26 -70 Q0 -110 26 -70" fill="none" stroke="#d9a85b" stroke-width="5"/>
    <polygon points="-34,-66 34,-66 44,-48 -44,-48" fill="#3a2a1a" stroke="#d9a85b" stroke-width="3"/>
    <rect x="-36" y="-48" width="72" height="104" rx="6" fill="#ffe7a8" opacity=".25"/>
    <path class="ep-llama" d="M0 34 C-22 30 -24 4 -10 -14 C-6 -2 2 -4 0 -26 C16 -10 24 6 20 18 C18 30 10 34 0 34Z" fill="url(#fl${u})" style="transform-origin:0 34px"/>
    <g fill="none" stroke="#d9a85b" stroke-width="4"><rect x="-36" y="-48" width="72" height="104" rx="6"/><line x1="0" y1="-48" x2="0" y2="56"/><line x1="-36" y1="4" x2="36" y2="4" stroke-width="2.5"/></g>
    <polygon points="-44,56 44,56 34,72 -34,72" fill="#3a2a1a" stroke="#d9a85b" stroke-width="3"/>
  </g>
  ${polillas}${brasas}`);
}

/* ---------- PRO DEFENDER: el camino del Prado y sus defensores ---------- */
/* Los atacantes marchan por el camino con `ep-marcha` (juegos.html), cuyos
   fotogramas son estos mismos vértices: si cambia uno, cambian los dos.
   Cada uno parte con un retraso negativo, así que su sitio de reposo
   (`--px`/`--py`, el de «menos movimiento» y el de la diapositiva en
   pausa) es el punto del camino al que corresponde ese retraso. */
const PD_CAMINO = [[480, 90], [700, 90], [700, 300], [860, 300], [860, 120], [1010, 120], [1010, 330], [1220, 330]];
const PD_MARCHA = 13;   // segundos de punta a punta, como `.ep-marcha`
function puntoDelCamino(f) {
  const tramos = PD_CAMINO.slice(1).map((q, i) => Math.hypot(q[0] - PD_CAMINO[i][0], q[1] - PD_CAMINO[i][1]));
  let d = f * tramos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < tramos.length; i++) {
    if (d <= tramos[i]) { const t = d / tramos[i], a = PD_CAMINO[i], b = PD_CAMINO[i + 1]; return [r1(a[0] + (b[0] - a[0]) * t), r1(a[1] + (b[1] - a[1]) * t)]; }
    d -= tramos[i];
  }
  return PD_CAMINO[PD_CAMINO.length - 1];
}
function prodefender() {
  const u = ++cuenta, az = azar(31);
  const camino = "M" + PD_CAMINO.map(q => q.join(" ")).join(" L");
  /* Los atacantes del Prado, con los colores del bestiario (enemies.js). */
  const ojos = r => `<circle cx="${r1(-r / 3)}" cy="${r1(-r / 4)}" r="${r1(r / 4)}" fill="#fff"/><circle cx="${r1(r / 3)}" cy="${r1(-r / 4)}" r="${r1(r / 4)}" fill="#fff"/><circle cx="${r1(-r / 3 + 1)}" cy="${r1(-r / 4)}" r="${r1(r / 9)}" fill="#111"/><circle cx="${r1(r / 3 + 1)}" cy="${r1(-r / 4)}" r="${r1(r / 9)}" fill="#111"/>`;
  const cuerpo = (r, c) => `<ellipse cy="${r1(r * 0.9)}" rx="${r1(r * 0.9)}" ry="${r1(r * 0.3)}" fill="#000" opacity=".25"/><circle r="${r}" fill="${c}" stroke="#0007" stroke-width="2.5"/>${ojos(r)}`;
  const BICHOS = [
    r => cuerpo(r, "#7bd35a") + `<path d="M0 ${-r} q-6 -12 -14 -10 M0 ${-r} q6 -12 14 -10" fill="none" stroke="#3d8a2a" stroke-width="3" stroke-linecap="round"/>`,   // Brotito
    r => cuerpo(r, "#ffd23f") + `<path d="M${-r} 0 l-10 -4 M${-r} 6 l-12 2" stroke="#fff3a0" stroke-width="3" stroke-linecap="round"/>`,   // Chispa
    r => `<path d="M${-r - 2} 2 a${r + 2} ${r + 2} 0 0 1 ${2 * r + 4} 0Z" fill="#7a5226" stroke="#0007" stroke-width="2.5"/>` + cuerpo(r * 0.7, "#a0703a"),   // Tortugón
    r => `<g class="ep-aletea"><path d="M0 0 C-22 -22 -34 -4 -24 8 C-14 14 -4 8 0 0 C4 8 14 14 24 8 C34 -4 22 -22 0 0Z" fill="#c9a7ff" stroke="#5b3a8c" stroke-width="2"/></g>` + cuerpo(r * 0.6, "#9b7bd6"),   // Polilla
    r => cuerpo(r, "#4fa3ff") + `<path d="M${r - 2} -6 h12 v14 q-6 8 -12 0Z" fill="#cfe3ff" stroke="#1d4f8a" stroke-width="2.5"/>`,   // Portaescudos
    r => cuerpo(r, "#3fa34d") + `<circle cx="${-r / 2}" cy="${r / 2}" r="4" fill="#9be36a"/><circle cx="${r / 2}" cy="${r / 3}" r="3" fill="#9be36a"/>`   // Musgo Vivo
  ];
  /* Diez sitios en la fila: nueve atacantes y el Rey Escarabajo al final. */
  let fila = "";
  for (let k = 0; k < 10; k++) {
    const jefe = k === 9, r = jefe ? 30 : 13 + (k % 3) * 2;
    const retraso = r1(-k * PD_MARCHA / 10 - 0.4), [px, py] = puntoDelCamino(-retraso / PD_MARCHA % 1);
    const dibujo = jefe
      ? `<path d="M-18 -24 l-10 -18 M18 -24 l10 -18" stroke="#2e1d48" stroke-width="6" stroke-linecap="round"/>${cuerpo(r, "#5b3a8c")}<path d="M0 ${-r} V${r}" stroke="#2e1d48" stroke-width="3" opacity=".6"/><polygon points="-14,${-r - 4} -8,${-r - 18} 0,${-r - 8} 8,${-r - 18} 14,${-r - 4}" fill="#ffcf4d" stroke="#8a5a00" stroke-width="2"/>
        <rect x="-30" y="${-r - 30}" width="60" height="7" rx="3.5" fill="#0008"/><rect x="-29" y="${-r - 29}" width="40" height="5" rx="2.5" fill="#ff4d5e"/>`
      : BICHOS[k % BICHOS.length](r);
    fila += `<g class="ep-marcha" style="--px:${px}px;--py:${py}px;animation-delay:${retraso}s"><g class="ep-bota" style="animation-delay:${r1(-az())}s">${dibujo}</g></g>`;
  }
  /* Una torre vista desde arriba: la base de piedra y el cañón que apunta. */
  const torre = (x, y, c, arma, clase, del = 0) => `<g transform="translate(${x} ${y})"><ellipse cy="26" rx="34" ry="10" fill="#000" opacity=".25"/><circle r="32" fill="#2a3156" stroke="#161a30" stroke-width="4"/><circle r="24" fill="${c}"/><circle r="24" fill="url(#dt${u})"/>
    <g class="${clase}" style="animation-delay:${del}s">${arma}</g><circle r="9" fill="#fff" opacity=".55"/></g>`;
  const canon = `<rect x="-6" y="-42" width="12" height="28" rx="4" fill="#1c2238"/>`;
  /* Sylva, la heroína del Prado: más grande, con su aura y su corona. */
  const heroe = `<g transform="translate(935 215)"><circle class="ep-aura" r="74" fill="#6fdc5a" fill-opacity=".1" stroke="#9be36a" stroke-width="3" stroke-dasharray="12 10"/>
    <ellipse cy="32" rx="42" ry="12" fill="#000" opacity=".3"/><circle r="40" fill="#2a3156" stroke="#ffcf4d" stroke-width="5"/><circle r="31" fill="#6fdc5a"/><circle r="31" fill="url(#dt${u})"/>
    <g class="ep-mira b"><path d="M0 -58 L8 -30 H-8Z" fill="#ffcf4d" stroke="#8a5a00" stroke-width="2"/><rect x="-4" y="-34" width="8" height="18" rx="3" fill="#1c2238"/></g>
    <polygon points="${estrella5(13)}" fill="#ffcf4d" stroke="#8a5a00" stroke-width="2"/></g>`;
  /* Lo que sale de cada torre: espinas, el pulso de hielo y el rayo. */
  const espina = (x, y, dx, dy, del) => `<g transform="translate(${x} ${y})"><path class="ep-espina" style="--dx:${dx}px;--dy:${dy}px;animation-delay:${del}s" d="M-3 -9 L0 -16 L3 -9Z M-2 -9 h4 v10 h-4Z" fill="#c8f7a6" stroke="#2d6a1f" stroke-width="1.5"/></g>`;
  const impacto = (x, y, c, del) => `<g transform="translate(${x} ${y})"><circle class="ep-impacto" style="animation-delay:${del}s" r="16" fill="none" stroke="${c}" stroke-width="4"/></g>`;
  let flores = "", pasto = "";
  for (let i = 0; i < 46; i++) flores += `<circle cx="${r1(420 + az() * 780)}" cy="${r1(az() * 420)}" r="${r1(2 + az() * 3)}" fill="${["#f7f3a1", "#ffb3c7", "#c8f7a6", "#fff"][i % 4]}" opacity=".75"/>`;
  for (let i = 0; i < 30; i++) { const x = r1(420 + az() * 780), y = r1(az() * 420); pasto += `<path d="M${x} ${y} l-4 -10 M${x} ${y} l0 -12 M${x} ${y} l4 -10" stroke="#2f7a33" stroke-width="2" stroke-linecap="round"/>`; }
  let monedas = "";
  [[742, 70], [905, 330], [1058, 96], [1150, 300]].forEach(([x, y], i) => {
    monedas += `<g transform="translate(${x} ${y})"><g class="ep-moneda" style="animation-delay:${r1(-i * 0.85)}s"><circle r="11" fill="#ffcf4d" stroke="#8a5a00" stroke-width="2.5"/><circle r="6" fill="none" stroke="#fff6c8" stroke-width="2"/><text x="16" y="5" font-family="Bungee,'Arial Black',Impact,sans-serif" font-size="15" fill="#ffcf4d" stroke="#3a2a00" stroke-width="3" paint-order="stroke">+20</text></g></g>`;
  });
  return SVG(`<defs>
    <linearGradient id="dc${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d1a12"/><stop offset=".35" stop-color="#1f4a22"/><stop offset=".6" stop-color="#3e8f3a"/><stop offset="1" stop-color="#4fa046"/></linearGradient>
    <radialGradient id="dl${u}" cx=".78" cy=".2" r=".6"><stop offset="0" stop-color="#fff6c8" stop-opacity=".35"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
    <radialGradient id="dt${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient>
    <filter id="db${u}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect width="1200" height="420" fill="url(#dc${u})"/>${pasto}${flores}
  <rect width="1200" height="420" fill="url(#dl${u})"/>
  <ellipse cx="785" cy="380" rx="46" ry="22" fill="#3f8fd0" stroke="#2d6a9a" stroke-width="4"/><ellipse cx="775" cy="374" rx="16" ry="5" fill="#fff" opacity=".35"/>
  <circle cx="600" cy="370" r="18" fill="#8a8f7a" stroke="#5c604f" stroke-width="3"/>
  <path d="${camino}" fill="none" stroke="#8f7140" stroke-width="58" stroke-linejoin="round"/>
  <path d="${camino}" fill="none" stroke="#c9a86a" stroke-width="46" stroke-linejoin="round"/>
  <path d="${camino}" fill="none" stroke="#e0c48a" stroke-width="3" stroke-dasharray="4 18" stroke-linejoin="round" opacity=".7"/>
  ${fila}
  ${torre(600, 200, "#5fbf4a", canon, "ep-mira")}
  ${espina(600, 200, 90, -100, 0)}${espina(600, 200, 100, 60, -0.6)}
  ${torre(780, 200, "#7fd6ff", `<circle r="13" fill="#e6f7ff" stroke="#3a8ab8" stroke-width="3"/>`, "")}
  <g transform="translate(780 200)"><circle class="ep-pulso" r="70" fill="#bfe9ff" fill-opacity=".18" stroke="#bfe9ff" stroke-width="4"/></g>
  ${heroe}
  ${torre(1110, 210, "#ffe14d", `<path d="M-8 -14 L4 -40 L0 -22 L10 -24 L-4 4 L0 -12Z" fill="#fff8b0" stroke="#8a6a00" stroke-width="2"/>`, "ep-mira c", -1.2)}
  <polyline class="ep-rayo" points="1110,210 1080,240 1062,236 1036,268 1012,262" fill="none" stroke="#fff27a" stroke-width="5" stroke-linejoin="round" filter="url(#db${u})"/>
  <polyline class="ep-rayo" points="1110,210 1080,240 1062,236 1036,268 1012,262" fill="none" stroke="#fffde0" stroke-width="2.5" stroke-linejoin="round"/>
  ${impacto(690, 100, "#c8f7a6", 0)}${impacto(700, 260, "#c8f7a6", -0.6)}${impacto(1012, 262, "#fff27a", 0)}
  ${monedas}
  <text class="ep-ronda" x="1180" y="56" text-anchor="end" font-family="Bungee,'Arial Black',Impact,sans-serif" font-size="34" fill="#ffcf4d" stroke="#1f2a10" stroke-width="6" paint-order="stroke">RONDA 25 · JEFE</text>`);
}

/* ---------- Momazo :v: el plató de memes ---------- */
/* Un meme «sí y no» grande que flota bajo los focos, otro más chico con su
   nota, reacciones que suben desde el público y el «+17» de la revelación.
   Los emojis van en <text>, como en las plantillas del juego. */
function memazo() {
  const u = ++cuenta, az = azar(47);
  const FE = `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"`;
  const emo = (s, ch) => `<text ${FE} font-size="${s}" text-anchor="middle" dominant-baseline="central">${ch}</text>`;
  const imp = (x, y, s, t) => `<text x="${x}" y="${y}" font-family="Anton,Impact,'Arial Black',sans-serif" font-size="${s}" fill="#fff" stroke="#000" stroke-width="${r1(s / 9)}" paint-order="stroke" text-anchor="middle">${t}</text>`;
  /* El meme grande: 300×300, con su marco y los dos textos. */
  const grande = `<rect x="-158" y="-158" width="316" height="316" rx="10" fill="#ffd23f"/>
    <rect x="-150" y="-150" width="300" height="300" fill="#fff"/>
    <rect x="-150" y="-150" width="120" height="150" fill="#f6c75a"/><rect x="-150" y="0" width="120" height="150" fill="#8fd1b0"/>
    <path d="M-150 0 H150 M-30 -150 V150" stroke="#222" stroke-width="3"/>
    <g transform="translate(-90 -75)">${emo(84, "🙅")}</g><g transform="translate(-96 75)">${emo(80, "😏")}</g><g transform="translate(-52 92)">${emo(44, "👉")}</g>
    <text x="60" y="-68" font-family="'IBM Plex Sans',Arial,sans-serif" font-weight="700" font-size="30" fill="#141414" text-anchor="middle">Estudiar</text>
    <text x="60" y="72" font-family="'IBM Plex Sans',Arial,sans-serif" font-weight="700" font-size="26" fill="#141414" text-anchor="middle">Hacer</text>
    <text x="60" y="104" font-family="'IBM Plex Sans',Arial,sans-serif" font-weight="700" font-size="26" fill="#141414" text-anchor="middle">memes</text>`;
  /* El chico: «todo bien», con su nota debajo. */
  const chico = `<rect x="-104" y="-82" width="208" height="164" rx="8" fill="#fff"/>
    <rect x="-98" y="-76" width="196" height="152" fill="#e89a3c"/><rect x="-98" y="30" width="196" height="46" fill="#a8562a"/>
    <g transform="translate(-70 32)">${emo(46, "🔥")}</g><g transform="translate(72 30)">${emo(42, "🔥")}</g><g transform="translate(0 6)">${emo(64, "🐶")}</g>
    ${imp(0, -46, 24, "LUNES 8 AM")}${imp(0, 68, 20, "TODO BIEN")}`;
  /* Las reacciones que suben desde abajo, cada una con su ritmo. */
  let reacciones = "";
  const CARAS = ["🔥", "😂", "🔥", "🍅", "😂", "🔥", "🙂", "😂", "🔥", "😐"];
  CARAS.forEach((c, i) => {
    const x = r1(640 + az() * 520), y = r1(380 + az() * 30);
    reacciones += `<g transform="translate(${x} ${y})"><g class="ep-sube" style="animation-delay:${r1(-az() * 4.5)}s;animation-duration:${r1(3.6 + az() * 2)}s">${emo(r1(30 + az() * 22), c)}</g></g>`;
  });
  /* Focos del plató: dos conos que se mecen. */
  const foco = (x, del) => `<g transform="translate(${x} -20)"><g class="ep-foco" style="animation-delay:${del}s"><path d="M-18 0 L18 0 L170 460 L-170 460Z" fill="url(#mf${u})"/></g></g>`;
  let chispas = "";
  for (let i = 0; i < 9; i++) chispas += `<g transform="translate(${r1(620 + az() * 560)} ${r1(30 + az() * 340)})"><path class="ep-brilla" style="animation-delay:${r1(-az() * 2)}s" d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2Z" fill="#ffd23f"/></g>`;
  return SVG(`<defs>
    <radialGradient id="mb${u}" cx=".72" cy=".2" r=".9"><stop offset="0" stop-color="#6b2fb8"/><stop offset=".55" stop-color="#341066"/><stop offset="1" stop-color="#14062b"/></radialGradient>
    <linearGradient id="mf${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".45"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#mb${u})"/>
  ${estrellas(az, 40, 0, 1200, 0, 260, "#e9ddff")}
  ${foco(760, 0)}${foco(1080, -1.4)}
  <ellipse cx="900" cy="410" rx="380" ry="36" fill="#000" opacity=".35"/>
  ${chispas}
  <g transform="translate(1065 270) rotate(7)"><g class="ep-flota" style="animation-delay:-1.1s">${chico}</g></g>
  <g transform="translate(985 402)"><g class="ep-combo" style="animation-delay:-.6s">${imp(0, 0, 40, "+17")}</g></g>
  <g transform="translate(800 205) rotate(-5)"><g class="ep-flota">${grande}</g></g>
  ${reacciones}
  <text x="1180" y="52" text-anchor="end" font-family="Anton,Impact,'Arial Black',sans-serif" font-size="34" fill="#ffd23f" stroke="#2b0d52" stroke-width="6" paint-order="stroke">¿DE QUIÉN ERA? 🤫</text>`);
}

/* ---------- Pro BoxHead: la horda contra el de la pistola ---------- */
/* Vista de arriba en tres cuartos, como el juego: piso claro manchado de
   sangre, pilares blancos de esquinas cortadas, el jugador disparando y la
   horda de zombis (y un diablo) que llega tambaleándose desde la derecha,
   con una explosión al fondo y el multiplicador arriba. Cada figura son
   cajas: frente, tapa y costado, con contorno negro. */
function boxhead() {
  const u = ++cuenta, az = azar(53);
  const L = "#1a1a1e";
  /* Una caja: frente (x, y, w, h), tapa y costado derecho de fondo `p`. */
  const caja = (x, y, w, h, p, cf, ct, cs) => {
    const q = r1(p * 0.55);
    return `<path d="M${x} ${y}h${w}v${h}h${-w}Z" fill="${cf}"/>` +
      `<path d="M${x} ${y}l${q} ${-p}h${w}l${-q} ${p}Z" fill="${ct}"/>` +
      `<path d="M${x + w} ${y}l${q} ${-p}v${h}l${-q} ${p}Z" fill="${cs}"/>` +
      `<path d="M${x} ${y}h${w}v${h}h${-w}Z M${x} ${y}l${q} ${-p}h${w}l${-q} ${p} M${x + w} ${y}l${q} ${-p}v${h}l${-q} ${p}" fill="none" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`;
  };
  /* Un zombi (o diablo) que camina hacia la izquierda con los brazos
     estirados; (0, 0) son sus pies. */
  const zombi = (d) => {
    const C = d ? { piel: "#d02a1e", ps: "#a01a12", pt: "#e8483a", cam: "#c0221a", cs: "#8a140e", ct: "#e03a2c", pan: "#7e100a", pel: "#1e0907", pi: "#8f170f" }
      : { piel: "#efeee8", ps: "#c9c8c2", pt: "#ffffff", cam: "#e4e5e8", cs: "#b4b6bc", ct: "#fafafa", pan: "#7a808a", pel: "#2a2a2d", pi: "#a2a6ae" };
    let s = `<ellipse cx="6" cy="2" rx="34" ry="9" fill="#000" opacity=".22"/>`;
    s += caja(-12, -24, 10, 24, 6, C.pi, C.pi, "#6a6e76") + caja(4, -24, 10, 24, 6, C.pi, C.pi, "#6a6e76");
    s += caja(-17, -54, 34, 30, 10, C.cam, C.ct, C.cs);
    s += `<rect x="-3" y="-54" width="8" height="30" fill="${C.pan}"/>`;
    s += d ? caja(-34, -50, 9, 22, 6, C.cam, C.ct, C.cs) : caja(-44, -50, 30, 9, 6, C.cam, C.ct, C.cs) + caja(-50, -50, 8, 9, 6, C.piel, C.pt, C.ps);
    s += caja(-16, -88, 32, 32, 12, C.piel, C.pt, C.ps);
    s += caja(-17, -92, 34, 8, 12, C.pel, C.pel, "#000");
    s += d ? `<rect x="-11" y="-74" width="7" height="6" fill="#ffd84a"/><rect x="2" y="-74" width="7" height="6" fill="#ffd84a"/>
      <path d="M-12 -104 l3 -14 l5 12Z M8 -104 l5 -14 l3 12Z" fill="#f2e6c8" stroke="${L}" stroke-width="2"/>`
      : `<rect x="-11" y="-74" width="6" height="6" fill="${L}"/><rect x="3" y="-74" width="6" height="6" fill="${L}"/><rect x="-8" y="-64" width="13" height="3" fill="#6a1c1c"/>`;
    if (!d) s += caja(-44, -42, 30, 9, 6, C.cam, C.ct, C.cs) + caja(-50, -42, 8, 9, 6, C.piel, C.pt, C.ps);
    return s;
  };
  /* El jugador, de caqui, apuntando a la derecha con la pistola. */
  const jugador = `<ellipse cx="0" cy="2" rx="30" ry="8" fill="#000" opacity=".25"/>
    ${caja(-12, -24, 10, 24, 6, "#3b4a6e", "#4a5a80", "#2a3450")}${caja(3, -24, 10, 24, 6, "#3b4a6e", "#4a5a80", "#2a3450")}
    ${caja(-16, -54, 32, 30, 10, "#c8b48a", "#ddcaa0", "#9a8862")}
    <rect x="-16" y="-30" width="32" height="5" fill="#5a4222"/>
    ${caja(-15, -88, 30, 32, 12, "#f0cfa4", "#f8dcb4", "#c8a47c")}
    ${caja(-16, -92, 32, 8, 12, "#2a1c12", "#3a2a1c", "#140c06")}
    <rect x="5" y="-74" width="6" height="6" fill="${L}"/>
    ${caja(10, -48, 26, 9, 6, "#c8b48a", "#ddcaa0", "#9a8862")}
    ${caja(30, -50, 10, 10, 6, "#f0cfa4", "#f8dcb4", "#c8a47c")}
    ${caja(34, -56, 24, 8, 5, "#2a2c31", "#4a4d55", "#18191c")}
    ${caja(36, -48, 7, 10, 4, "#18191c", "#2a2c31", "#000")}`;
  /* Un pilar blanco de esquinas cortadas (tapa octogonal y tres caras). */
  const pilar = (x, y, w, h) => {
    const c = r1(w * 0.22), p = r1(w * 0.55);
    return `<ellipse cx="${x + w * 0.62}" cy="${y + 6}" rx="${w * 0.8}" ry="${w * 0.2}" fill="#000" opacity=".16"/>
      <path d="M${x} ${y - c} L${x + c} ${y} V${y - h + c + 0} L${x} ${y - h}Z" fill="#e2e2de" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M${x + c} ${y} H${x + w - c} V${y - h + c} H${x + c}Z" fill="#cfcfcb" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M${x + c} ${y - h * 0.3} H${x + w - c} V${y} H${x + c}Z" fill="#b4b4b0"/>
      <path d="M${x + w - c} ${y} L${x + w} ${y - c} V${y - h} L${x + w - c} ${y - h + c}Z" fill="#a7a7a3" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M${x} ${y - h} L${x + c} ${y - h + c} H${x + w - c} L${x + w} ${y - h} V${y - h - p + c} L${x + w - c} ${y - h - p} H${x + c} L${x} ${y - h - p + c}Z" fill="#f6f6f3" stroke="${L}" stroke-width="2.4" stroke-linejoin="round"/>`;
  };
  // sangre en el piso, como la que deja la partida
  let sangre = "";
  for (let i = 0; i < 46; i++) {
    const x = r1(560 + az() * 640), y = r1(240 + az() * 180), r = r1(4 + az() * 26);
    sangre += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r1(r * (0.5 + az() * 0.4))}" fill="${az() < 0.3 ? "#8e0a0c" : "#c80e10"}" opacity="${r1(0.35 + az() * 0.45)}"/>`;
  }
  for (let i = 0; i < 60; i++) sangre += `<circle cx="${r1(560 + az() * 640)}" cy="${r1(230 + az() * 190)}" r="${r1(1 + az() * 3)}" fill="#b00c0e" opacity=".7"/>`;
  // la quemadura de una granada, con sus lenguas
  let quema = `<circle cx="1068" cy="352" r="62" fill="url(#bq${u})"/>`;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + az() * 0.3, l = 50 + az() * 40;
    quema += `<path d="M${r1(1068 + Math.cos(a - 0.12) * 12)} ${r1(352 + Math.sin(a - 0.12) * 9)} L${r1(1068 + Math.cos(a) * l)} ${r1(352 + Math.sin(a) * l * 0.75)} L${r1(1068 + Math.cos(a + 0.12) * 12)} ${r1(352 + Math.sin(a + 0.12) * 9)}Z" fill="#141010" opacity=".4"/>`;
  }
  // la horda: cada uno se tambalea a su ritmo
  const horda = [[960, 250, 0, 0.82], [1088, 236, 0, 0.78], [1150, 300, 1, 0.9], [1010, 330, 0, 0.98], [1120, 400, 0, 1.06], [930, 410, 0, 1.1]];
  let zs = "";
  for (const [x, y, d, s] of horda.sort((a, b) => a[1] - b[1]))
    zs += `<g transform="translate(${x} ${y}) scale(${s})"><g class="ep-trepa" style="animation-delay:${r1(-az() * 2)}s;animation-duration:${r1(1.2 + az() * 0.8)}s">${zombi(d)}</g></g>`;
  // casquillos que saltan de la pistola
  let casq = "";
  for (let i = 0; i < 6; i++) casq += `<rect class="ep-estalla" style="--dx:${r1(-10 - az() * 40)}px;--dy:${r1(-30 - az() * 50)}px;animation-delay:${r1(-i * 0.5)}s" x="800" y="262" width="7" height="3.5" fill="#e0b040"/>`;
  // chispas y trozos de la explosión
  let trozos = "";
  for (let i = 0; i < 12; i++) trozos += `<rect class="ep-estalla" style="--dx:${r1((az() - 0.5) * 200)}px;--dy:${r1(-40 - az() * 120)}px;animation-delay:${r1(-az() * 0.3)}s" x="${r1(1060 + az() * 20)}" y="${r1(320 + az() * 20)}" width="${r1(4 + az() * 6)}" height="${r1(4 + az() * 6)}" fill="${["#ffcf4d", "#ff7a1a", "#3a3430", "#c80e10"][i % 4]}"/>`;
  return SVG(`<defs>
    <radialGradient id="bp${u}" cx=".7" cy=".6" r=".9"><stop offset="0" stop-color="#ece7da"/><stop offset=".6" stop-color="#d6d0c0"/><stop offset="1" stop-color="#8a8272"/></radialGradient>
    <radialGradient id="bq${u}"><stop offset="0" stop-color="#0e0b09" stop-opacity=".85"/><stop offset=".6" stop-color="#28201a" stop-opacity=".45"/><stop offset="1" stop-color="#28201a" stop-opacity="0"/></radialGradient>
    <radialGradient id="bf${u}"><stop offset="0" stop-color="#fffbe0"/><stop offset=".3" stop-color="#ffd760"/><stop offset=".65" stop-color="#ff7a1a" stop-opacity=".8"/><stop offset="1" stop-color="#c02800" stop-opacity="0"/></radialGradient>
    <radialGradient id="bh${u}"><stop offset="0" stop-color="#4a4440" stop-opacity=".75"/><stop offset="1" stop-color="#4a4440" stop-opacity="0"/></radialGradient>
    <linearGradient id="bt${u}" x1="0" x2="1"><stop offset="0" stop-color="#fff6d0" stop-opacity="0"/><stop offset="1" stop-color="#fff6d0"/></linearGradient>
  </defs>
  <rect width="1200" height="420" fill="url(#bp${u})"/>
  <path d="M0 140 H1200 M0 280 H1200 M300 0 V420 M600 0 V420 M900 0 V420" stroke="#5a5040" stroke-opacity=".14" stroke-width="2"/>
  ${sangre}${quema}
  ${pilar(640, 196, 70, 92)}${pilar(1118, 150, 64, 84)}
  <g transform="translate(1068 330)"><circle class="ep-halo" r="70" fill="url(#bh${u})"/></g>
  <g transform="translate(1068 318)"><circle class="ep-onda" r="54" fill="none" stroke="#fff3d0" stroke-width="5"/></g>
  <g transform="translate(1068 318)"><circle class="ep-halo" r="48" fill="url(#bf${u})"/></g>
  ${trozos}
  <g transform="translate(756 330)">${jugador}</g>
  ${casq}
  ${[0, 1].map(i => `<line class="ep-disparo" style="animation-duration:.9s;animation-delay:${-i * 0.45}s" x1="${828 + i * 4}" y1="${276 + i * 4}" x2="${980 - i * 30}" y2="${262 + i * 30}" stroke="url(#bt${u})" stroke-width="4" stroke-linecap="round"/>`).join("")}
  <g transform="translate(828 278)"><g class="ep-disparo" style="animation-duration:.45s"><circle r="16" fill="url(#bf${u})"/><path d="M0 -7 L22 0 L0 7 L6 0Z" fill="#fffbe0"/></g></g>
  ${zs}
  <g transform="translate(1104 64)"><path d="M-48 18 A48 48 0 0 1 48 18" fill="none" stroke="#1a140c" stroke-opacity=".8" stroke-width="14" stroke-linecap="round"/>
    <path d="M-48 18 A48 48 0 0 1 30 -21" fill="none" stroke="#f2c14e" stroke-width="9" stroke-linecap="round"/>
    <g class="ep-halo"><text y="22" text-anchor="middle" font-family="Bungee,'Arial Black',Impact,sans-serif" font-size="38" fill="#f2c14e" stroke="#000" stroke-width="6" paint-order="stroke">×28</text></g></g>`);
}

const ESCENAS = { futbol, boxhead, memazo, prodefender, hero, mascotas, protiles, haxball, tulones, trigon, prodrop, fanal };

/* La escena de una novedad, o "" si no tiene una propia (el banner pinta
   entonces un fondo del color del juego). */
export function escenaNovedad(id, opciones) {
  return ESCENAS[id] ? ESCENAS[id](opciones) : "";
}
export const tieneEscena = id => !!ESCENAS[id];
