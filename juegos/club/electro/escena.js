/* Electrodle: la escena de fondo. Como los fondos de Narutodle o LoLdle, pero
   del mundo eléctrico y dibujada aquí mismo: una placa de circuito con
   corrientes que viajan por sus pistas, una bobina de Tesla que suelta arcos
   a la izquierda y una torre de alta tensión a la derecha.
   Nada de esto es contenido: va en un contenedor aria-hidden detrás del
   juego. Con «reducir movimiento» los arcos quedan quietos y tenues.
   `ElectroEscena.descarga()` es el chispazo de una victoria. */
(() => {
  "use strict";
  const host = document.getElementById("escena");
  if (!host) return;
  const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const r = (a, b) => a + Math.random() * (b - a);

  /* ---------- corrientes por las pistas ----------
     Pistas largas a 45°, y sobre cada una un pulso que la recorre. */
  const PISTAS = [
    "M-20 70H180L220 110H520L560 70H760L800 30H1220",
    "M-20 210H90L130 250H330L370 210H640L700 270H980L1020 230H1220",
    "M-20 430H240L280 390H470L510 430H860L900 470H1220",
    "M300 -20V120L340 160V340",
    "M940 -20V80L900 120V300L940 340V520"
  ];
  const corrientes = `<svg class="corrientes" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMin slice">
    ${PISTAS.map((d, i) => `<path d="${d}" class="pista"/><path d="${d}" class="pulso p${i % 3}" style="animation-delay:${-i * 1.7}s"/>`).join("")}
    ${[[220, 110], [560, 70], [800, 30], [130, 250], [370, 210], [700, 270], [280, 390], [510, 430], [900, 470], [340, 160], [900, 120], [940, 340]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" class="via"/>`).join("")}
  </svg>`;

  /* ---------- la bobina de Tesla ---------- */
  const espiras = Array.from({ length: 46 }, (_, k) => `<path d="M84 ${178 + k * 6.4}Q110 ${181 + k * 6.4} 136 ${178 + k * 6.4}"/>`).join("");
  const tesla = `<svg class="arte tesla" viewBox="0 0 220 540">
    <defs>
      <linearGradient id="esMetal" x1="0" x2="1"><stop offset="0" stop-color="#3b4a63"/><stop offset=".45" stop-color="#c9d6ea"/><stop offset=".6" stop-color="#8395b3"/><stop offset="1" stop-color="#2a3448"/></linearGradient>
      <linearGradient id="esCobre" x1="0" x2="1"><stop offset="0" stop-color="#5e2f12"/><stop offset=".45" stop-color="#e09a5a"/><stop offset="1" stop-color="#4a230c"/></linearGradient>
      <linearGradient id="esBase" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#26324a"/><stop offset="1" stop-color="#0b111f"/></linearGradient>
    </defs>
    <g class="arcos"></g>
    <rect x="84" y="172" width="52" height="300" rx="4" fill="url(#esCobre)"/>
    <g class="espiras">${espiras}</g>
    <ellipse cx="110" cy="150" rx="86" ry="28" fill="url(#esMetal)"/>
    <ellipse cx="110" cy="142" rx="62" ry="12" fill="#e9f1ff" opacity=".35"/>
    <rect x="100" y="164" width="20" height="12" fill="#5b6b86"/>
    <path d="M40 472H180L196 512H24Z" fill="url(#esBase)" stroke="#3a4b6b"/>
    <rect x="16" y="512" width="188" height="16" rx="3" fill="#0d1424" stroke="#2b3a58"/>
    <circle cx="56" cy="492" r="4" fill="#ffb020" class="piloto"/><circle cx="72" cy="492" r="4" fill="#22d3ee"/>
  </svg>`;

  /* ---------- la torre de alta tensión ----------
     Celosía generada: dos patas que se juntan, crucetas, diagonales en X,
     aisladores colgando y los cables que se van fuera del cuadro. */
  function torre() {
    const x = (y, lado) => { const t = (560 - y) / 440; return lado < 0 ? 40 + 55 * t : 180 - 55 * t; };
    let d = `M40 560L95 120L110 40L125 120L180 560`;
    const niveles = [560, 470, 390, 320, 260, 200, 150, 120];
    for (let k = 0; k < niveles.length - 1; k++) {
      const a = niveles[k], b = niveles[k + 1];
      d += `M${x(a, -1)} ${a}L${x(b, 1)} ${b}M${x(a, 1)} ${a}L${x(b, -1)} ${b}M${x(b, -1)} ${b}L${x(b, 1)} ${b}`;
    }
    d += "M18 150L202 150M18 150L95 120M202 150L125 120M42 230L178 230M42 230L80 200M178 230L140 200M30 150L30 158M190 150L190 158";
    const aislador = (cx, cy) => `<path d="M${cx} ${cy}V${cy + 26}"/>${[0, 6, 12, 18].map(k => `<ellipse cx="${cx}" cy="${cy + 6 + k}" rx="5" ry="2"/>`).join("")}`;
    return `<svg class="arte torre" viewBox="0 0 220 560">
      <path d="M22 176C-120 210 -260 214 -420 190M198 176C260 196 330 200 420 186M46 256C-90 290 -240 292 -420 268" class="cables"/>
      <path d="${d}" class="celosia"/>
      <g class="aisladores">${aislador(22, 150)}${aislador(198, 150)}${aislador(46, 230)}${aislador(174, 230)}</g>
      <circle cx="110" cy="40" r="5" class="aviso"/>
    </svg>`;
  }

  host.innerHTML = corrientes + tesla + torre();

  /* ---------- los arcos ----------
     Un rayo es una quebrada desde el borde del toroide hacia afuera, con
     desvíos que se achican al llegar, y a veces una rama. */
  const arcos = host.querySelector(".tesla .arcos");
  function rayo(x0, y0, x1, y1, n) {
    let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n, off = r(-1, 1) * len * 0.16 * (1 - t * 0.6);
      d += `L${(x0 + dx * t + nx * off).toFixed(1)} ${(y0 + dy * t + ny * off).toFixed(1)}`;
    }
    return d + `L${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  function dibujaArcos(cuantos, largo) {
    let html = "";
    for (let k = 0; k < cuantos; k++) {
      const lado = Math.random() < 0.5 ? -1 : 1, x0 = 110 + lado * r(30, 84), y0 = 150 + r(-10, 12);
      const ang = lado < 0 ? r(Math.PI * 0.85, Math.PI * 1.45) : r(-Math.PI * 0.45, Math.PI * 0.15);
      const L = r(50, largo), x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
      const d = rayo(x0, y0, x1, y1, 9);
      html += `<path d="${d}" class="arco-halo"/><path d="${d}" class="arco"/>`;
      if (Math.random() < 0.5) {
        const t = r(0.3, 0.6), bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
        html += `<path d="${rayo(bx, by, bx + r(-40, 40), by + r(-50, 20), 5)}" class="arco rama"/>`;
      }
    }
    arcos.innerHTML = html;
  }
  let reloj = 0, extra = 0;
  function paso() {
    if (document.hidden) return;
    if (quieto()) { if (!arcos.firstChild) dibujaArcos(2, 90); return; }
    if (extra > 0) { extra--; dibujaArcos(5, 170); return; }
    if (Math.random() < 0.28) arcos.innerHTML = "";
    else dibujaArcos(1 + Math.floor(Math.random() * 3), 120);
  }
  reloj = setInterval(paso, 110);
  paso();

  window.ElectroEscena = {
    /* El chispazo de una victoria: arcos largos un momento y un destello. */
    descarga() {
      if (quieto()) return;
      extra = 7;
      document.body.classList.remove("destello"); void document.body.offsetWidth; document.body.classList.add("destello");
    },
    para() { clearInterval(reloj); }
  };
})();
