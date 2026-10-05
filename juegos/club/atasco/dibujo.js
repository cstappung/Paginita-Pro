/* Atasco — cómo se dibuja cada vehículo, visto desde arriba.
   UMD: `AtascoDibujo` en la página, `module.exports` en Node (los tests
   comprueban que cada dibujo es un SVG bien formado).

   Resumen de lo que hace y por qué:
   - Todo es SVG escrito aquí, sin imágenes: queda nítido en cualquier
     pantalla, pesa unos pocos KB y el color de cada auto es un número.
   - Se dibuja siempre un vehículo «de lado y mirando a la derecha», en una
     caja de 100 unidades por casilla (un auto: 200×100). Para ponerlo de pie
     o mirando al otro lado se gira o se refleja el dibujo entero con un
     `transform`, así cada modelo se escribe una sola vez.
   - El estilo es de calcomanía: contorno grueso oscuro, colores planos y un
     solo brillo. Es lo que hace que un estacionamiento lleno se lea de un
     vistazo en un teléfono.
   - Cada letra recibe siempre el mismo modelo y el mismo color (sale de su
     código), así un nivel se ve igual cada vez que se abre. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();   // Node
  else raiz.AtascoDibujo = fabrica();                                             // navegador
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TINTA = "#1d2330";   // el contorno de todos los dibujos
  const VIDRIO = "#9fd6ff";  // parabrisas y ventanas
  const LUZ = "#fff3b0";     // focos delanteros
  const FRENO = "#ff4d4d";   // luces traseras

  /* Los colores de los autos (el rojo queda solo para el auto rojo). */
  const COLORES = ["#2f7de1", "#f2c230", "#2fb36b", "#ff8a1e", "#8e5cf0", "#1fb5c4", "#ff5c9a", "#eef0f4", "#5d6475", "#7cc243", "#c98a4b", "#3d4fb8"];
  /* Camiones y buses tienen sus propias tintas. */
  const CAJAS = ["#eef0f4", "#2a9d8f", "#3d4fb8", "#f2c230"];
  const BUSES = ["#f7b500", "#2fb36b", "#2f7de1"];

  /* Oscurece un color #rrggbb (para el techo y las sombras propias). */
  function oscuro(hex, f) {
    const n = parseInt(hex.slice(1), 16);                              // el color como número
    const c = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); // cada canal multiplicado
    return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }

  /* El modelo y el color de una letra: siempre los mismos para la misma letra. */
  function aspecto(v) {
    const k = v.l.charCodeAt(0) - 65;                                  // A=0, B=1…
    if (v.l === "A") return { modelo: "rojo", color: "#e8322f", mira: 1 }; // el protagonista
    const mira = (k * 7) % 3 === 0 ? -1 : 1;                           // hacia dónde mira (casi siempre adelante)
    if (v.largo === 3) {
      return k % 2 ? { modelo: "bus", color: BUSES[k % BUSES.length], mira }
                   : { modelo: "camion", color: CAJAS[(k >> 1) % CAJAS.length], cabina: COLORES[k % COLORES.length], mira };
    }
    const modelos = ["auto", "auto", "taxi", "deportivo", "furgon", "auto"];
    const modelo = modelos[k % modelos.length];
    return { modelo, color: modelo === "taxi" ? "#f2c230" : COLORES[(k * 5) % COLORES.length], mira };
  }

  /* Cuatro ruedas asomadas por debajo de la carrocería. */
  function ruedas(xs) {
    return xs.map(x => `<rect x="${x}" y="3" width="32" height="15" rx="5" fill="${TINTA}"/><rect x="${x}" y="82" width="32" height="15" rx="5" fill="${TINTA}"/>`).join("");
  }

  /* Los modelos, todos de lado y mirando a la derecha (el frente en x = ancho). */
  const MODELOS = {
    /* El auto rojo: deportivo con dos franjas blancas de carrera. */
    rojo: a => `${ruedas([30, 138])}
      <rect x="8" y="12" width="184" height="76" rx="26" fill="${a.color}"/>
      <rect x="14" y="40" width="172" height="7" fill="#fff" stroke="none"/><rect x="14" y="53" width="172" height="7" fill="#fff" stroke="none"/>
      <path d="M126 22 L148 27 Q155 50 148 73 L126 78 Z" fill="${VIDRIO}"/>
      <rect x="66" y="23" width="60" height="54" rx="12" fill="${oscuro(a.color, .78)}"/>
      <rect x="70" y="40" width="52" height="7" fill="#fff" fill-opacity=".85" stroke="none"/><rect x="70" y="53" width="52" height="7" fill="#fff" fill-opacity=".85" stroke="none"/>
      <path d="M66 25 L50 29 Q45 50 50 71 L66 75 Z" fill="${VIDRIO}"/>
      <path d="M8 26 L2 26 L2 74 L8 74" fill="${oscuro(a.color, .7)}"/>
      ${focos(192)}${frenos()}
      <path d="M156 20 Q182 24 184 46" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>`,
    /* Un sedán común: techo más oscuro, parabrisas y luneta. */
    auto: a => `${ruedas([30, 138])}
      <rect x="8" y="12" width="184" height="76" rx="22" fill="${a.color}"/>
      <path d="M128 22 L146 26 Q152 50 146 74 L128 78 Z" fill="${VIDRIO}"/>
      <rect x="62" y="22" width="66" height="56" rx="12" fill="${oscuro(a.color, .8)}"/>
      <path d="M62 24 L48 28 Q44 50 48 72 L62 76 Z" fill="${VIDRIO}"/>
      <ellipse cx="124" cy="11" rx="7" ry="5" fill="${a.color}"/><ellipse cx="124" cy="89" rx="7" ry="5" fill="${a.color}"/>
      ${focos(192)}${frenos()}
      <path d="M154 20 Q180 24 182 46" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>`,
    /* El taxi: amarillo, con el cartel en el techo y una fila de cuadros. */
    taxi: a => `${ruedas([30, 138])}
      <rect x="8" y="12" width="184" height="76" rx="22" fill="${a.color}"/>
      <path d="M128 22 L146 26 Q152 50 146 74 L128 78 Z" fill="${VIDRIO}"/>
      <rect x="62" y="22" width="66" height="56" rx="12" fill="${oscuro(a.color, .85)}"/>
      <rect x="84" y="38" width="22" height="24" rx="4" fill="#fff"/>
      <path d="M90 44 h10 M95 44 v12" stroke-width="3"/>
      <path d="M62 24 L48 28 Q44 50 48 72 L62 76 Z" fill="${VIDRIO}"/>
      <path d="M14 12 h12 v6 h12 v-6 h12 v6 h12 M14 88 h12 v-6 h12 v6 h12 v-6 h12" fill="none" stroke-width="3"/>
      ${focos(192)}${frenos()}`,
    /* El deportivo: más bajo, con alerón atrás y una toma de aire en el capó. */
    deportivo: a => `${ruedas([28, 140])}
      <path d="M10 22 Q10 12 26 12 L160 14 Q192 18 194 50 Q192 82 160 86 L26 88 Q10 88 10 78 Z" fill="${a.color}"/>
      <rect x="2" y="16" width="14" height="68" rx="4" fill="${oscuro(a.color, .7)}"/>
      <path d="M118 24 L142 30 Q150 50 142 70 L118 76 Z" fill="${VIDRIO}"/>
      <rect x="66" y="25" width="52" height="50" rx="14" fill="${oscuro(a.color, .78)}"/>
      <path d="M66 28 L54 32 Q50 50 54 68 L66 72 Z" fill="${VIDRIO}"/>
      <path d="M158 42 h20 M158 58 h20" stroke-width="4"/>
      ${focos(190)}${frenos()}`,
    /* El furgón: techo largo hasta atrás, sin luneta. */
    furgon: a => `${ruedas([28, 138])}
      <rect x="8" y="12" width="184" height="76" rx="16" fill="${a.color}"/>
      <path d="M150 22 L166 26 Q171 50 166 74 L150 78 Z" fill="${VIDRIO}"/>
      <rect x="18" y="20" width="130" height="60" rx="8" fill="${oscuro(a.color, .86)}"/>
      <path d="M40 20 v60 M70 20 v60 M100 20 v60" stroke-width="3" stroke-opacity=".35"/>
      ${focos(192)}${frenos()}`,
    /* El camión: caja de carga con nervios y la cabina adelante. */
    camion: a => `${ruedas([24, 70, 238])}
      <rect x="6" y="9" width="200" height="82" rx="8" fill="${a.color}"/>
      <path d="M40 9 v82 M74 9 v82 M108 9 v82 M142 9 v82 M176 9 v82" stroke-width="3" stroke-opacity=".3"/>
      <rect x="20" y="40" width="172" height="20" rx="4" fill="${oscuro(a.cabina, .95)}" stroke-width="3"/>
      <rect x="214" y="14" width="78" height="72" rx="16" fill="${a.cabina}"/>
      <path d="M262 22 L278 26 Q283 50 278 74 L262 78 Z" fill="${VIDRIO}"/>
      <rect x="224" y="24" width="36" height="52" rx="8" fill="${oscuro(a.cabina, .8)}"/>
      ${focos(292)}`,
    /* El bus: largo, con una fila de ventanas a cada lado y el aire acondicionado en el techo. */
    bus: a => `${ruedas([34, 228])}
      <rect x="6" y="10" width="288" height="80" rx="18" fill="${a.color}"/>
      ${[30, 72, 114, 156, 198].map(x => `<rect x="${x}" y="16" width="34" height="14" rx="4" fill="${VIDRIO}" stroke-width="3"/><rect x="${x}" y="70" width="34" height="14" rx="4" fill="${VIDRIO}" stroke-width="3"/>`).join("")}
      <path d="M252 16 L276 20 Q284 50 276 80 L252 84 Z" fill="${VIDRIO}"/>
      <rect x="96" y="36" width="70" height="28" rx="6" fill="${oscuro(a.color, .82)}"/>
      <path d="M108 42 v16 M120 42 v16 M132 42 v16 M144 42 v16 M156 42 v16" stroke-width="3" stroke-opacity=".5"/>
      ${focos(292)}${frenos()}`
  };
  function focos(x) {                                                  // los dos focos delanteros
    return `<rect x="${x - 10}" y="19" width="10" height="17" rx="4" fill="${LUZ}" stroke-width="3"/><rect x="${x - 10}" y="64" width="10" height="17" rx="4" fill="${LUZ}" stroke-width="3"/>`;
  }
  function frenos() {                                                  // las dos luces traseras
    return `<rect x="8" y="19" width="9" height="17" rx="3" fill="${FRENO}" stroke-width="3"/><rect x="8" y="64" width="9" height="17" rx="3" fill="${FRENO}" stroke-width="3"/>`;
  }

  /* El SVG completo de un vehículo del nivel ({l, h, largo}). */
  function svg(v) {
    const a = aspecto(v);
    const L = v.largo * 100;                                           // largo en unidades del dibujo
    const cuerpo = MODELOS[a.modelo](a);
    // Mirar a la izquierda = reflejar el dibujo horizontal.
    const refleja = a.mira < 0 ? `translate(${L},0) scale(-1,1)` : "";
    // De pie: girar 90°. El frente (x = L) queda abajo; si mira «atrás», arriba.
    const gira = v.h ? "" : "translate(100,0) rotate(90)";
    const caja = v.h ? `0 0 ${L} 100` : `0 0 100 ${L}`;
    const nombre = NOMBRES[a.modelo] + (a.modelo === "rojo" ? "" : " " + colorNombre(a.color));
    return `<svg viewBox="${caja}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${nombre}">` +
      `<g transform="${gira}"><g transform="${refleja}" stroke="${TINTA}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${cuerpo}</g></g></svg>`;
  }

  /* Cómo se llama cada cosa, para los lectores de pantalla y los avisos. */
  const NOMBRES = { rojo: "el auto rojo", auto: "auto", taxi: "taxi", deportivo: "deportivo", furgon: "furgón", camion: "camión", bus: "bus" };
  const COLOR_NOMBRE = { "#2f7de1": "azul", "#f2c230": "amarillo", "#2fb36b": "verde", "#ff8a1e": "naranja", "#8e5cf0": "morado", "#1fb5c4": "turquesa",
    "#ff5c9a": "rosado", "#eef0f4": "blanco", "#5d6475": "gris", "#7cc243": "verde limón", "#c98a4b": "café", "#3d4fb8": "azul marino",
    "#2a9d8f": "verde agua", "#f7b500": "amarillo" };
  const colorNombre = c => COLOR_NOMBRE[c] || "";
  /* «el bus verde», «el auto azul»… */
  function nombre(v) {
    const a = aspecto(v);
    return a.modelo === "rojo" ? NOMBRES.rojo : ("el " + NOMBRES[a.modelo] + " " + colorNombre(a.color)).trim();
  }

  return { svg, aspecto, nombre, oscuro, MODELOS, COLORES };
});
