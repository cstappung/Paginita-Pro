/* ============================================================
   Logros: diez por juego, puros y verificables en Node.

   Hay tres clases, y la diferencia es de dónde sale la prueba:

   - **Los de la fila** (`f`): primera victoria, diez, racha de tres,
     veinticinco partidas. Se *derivan* de `ranks/<juego>/<uid>`, que ya
     existe, así que valen hacia atrás — quien llevaba veinte victorias
     antes de que hubiera logros los tiene al abrir la pestaña — y no se
     escriben en ningún sitio: un segundo lugar que diga lo mismo es un
     segundo lugar que puede mentir.
   - **Los de la partida** (`x`): lo que pasó en el tablero. Se miran en
     cada repintado, porque `hist` es una ventana de 40 sucesos y lo de
     hace cien jugadas ya no está, y el primero que se ve se escribe una
     vez en `logros/<juego>/<uid>/<id>` con la hora.
   - **Los individuales** (`s`): Buscaminas, Snake y Tetris Club guardan
     su mejor marca por modalidad en `soloRanks`, y cada logro es una
     prueba sobre una marca. También se derivan, también valen hacia
     atrás.

   Un logro es del juego, no de la modalidad; los que solo se sacan en
   una llevan `m`, que es lo que la pestaña pinta como etiqueta.
   ============================================================ */
import { TAMANOS } from "./motor.js";

const FILA = [
  { id: "primera", n: "Primera victoria", d: "Gana tu primera partida.", i: "🥇", f: f => f.ganadas >= 1 },
  { id: "diez", n: "Veterano", d: "Gana 10 partidas.", i: "🎖️", f: f => f.ganadas >= 10 },
  { id: "racha", n: "En racha", d: "Gana 3 partidas seguidas.", i: "🔥", f: f => f.mejorRacha >= 3 },
  { id: "asiduo", n: "De la casa", d: "Juega 25 partidas.", i: "🏠", f: f => f.jugadas >= 25 }
];

/* Lo que todo detector necesita saber, calculado una vez. */
export function contexto(p, est, me) {
  const js = (est && est.jugadores) || [];
  const fin = !!(est && est.fase === "fin") || !!(p && p.fin);
  const g = p && p.fin ? (p.fin.ganador || "") : ((est && est.ganador) || "");
  const otros = js.map(j => j.uid).filter(u => u !== me);
  const hist = (est && est.hist) || [];
  return {
    p: p || {}, est: est || {}, me, fin, gano: fin && !!g && g === me, n: js.length, otros, rival: otros[0], hist,
    ev: (e, f) => hist.some(h => h && h.e === e && (!f || f(h)))
  };
}
/* Mis puntos menos los del mejor de los demás. */
const margen = (pts, c) => (pts[c.me] || 0) - Math.max(...c.otros.map(u => pts[u] || 0), -Infinity);
const mias = (obj, me) => Object.keys(obj || {}).filter(k => obj[k] === me);
const ladoMax = Math.max(...Object.values(TAMANOS).map(t => t.lado));

const SALA = {
  orbita: [
    { id: "cinco", n: "Supernova", d: "Toma una estrella de 5.", i: "🌟", x: c => mias(c.est.tomadas, c.me).some(i => c.est.estrellas[i] === 5) },
    { id: "coleccion", n: "Coleccionista", d: "Toma 10 estrellas en una partida.", i: "✨", x: c => mias(c.est.tomadas, c.me).length >= 10 },
    { id: "humilde", n: "Polvo de estrellas", d: "Toma cinco estrellas de 1 en una partida.", i: "🌫️", x: c => mias(c.est.tomadas, c.me).filter(i => c.est.estrellas[i] === 1).length >= 5 },
    { id: "constelacion", n: "Constelación", d: "Toma una estrella de cada valor, del 1 al 5, en la misma partida.", i: "🔭", x: c => new Set(mias(c.est.tomadas, c.me).map(i => c.est.estrellas[i])).size >= 5 },
    { id: "aplastante", n: "Eclipse total", d: "Gana con el 60 % de los puntos o más.", i: "🌑", x: c => { const t = Object.values(c.est.puntos || {}).reduce((a, b) => a + b, 0); return c.gano && t > 0 && c.est.puntos[c.me] >= 0.6 * t; } },
    { id: "foto", n: "Por un pelo", d: "Gana por 2 puntos o menos.", i: "📸", x: c => c.gano && margen(c.est.puntos || {}, c) <= 2 }
  ],
  escondite: [
    { id: "ojo", n: "Ojo de halcón", d: "Encuentra al rival al primer intento.", i: "🦅", x: c => { const l = (c.est.intentos || {})[c.me] || []; return l.length === 1 && l[0].ok; } },
    { id: "rapido", n: "Sabueso", d: "Encuentra al rival en 3 intentos o menos.", i: "🐕", x: c => { const l = (c.est.intentos || {})[c.me] || []; return l.length <= 3 && l.some(t => t.ok); } },
    { id: "fantasma", n: "Fantasma", d: "Tu escondite aguanta 10 intentos del rival.", i: "👻", x: c => ((c.est.intentos || {})[c.rival] || []).length >= 10 },
    { id: "camaleon", n: "Camaleón", d: "Gana con el rival habiendo fallado 20 veces.", i: "🦎", x: c => c.gano && ((c.est.intentos || {})[c.rival] || []).filter(t => !t.ok).length >= 20 },
    { id: "terco", n: "Terco", d: "Encuentra al rival tras 15 intentos o más.", i: "🐢", x: c => { const l = (c.est.intentos || {})[c.me] || []; return l.length >= 15 && l.some(t => t.ok); } },
    { id: "eterno", n: "Paisaje eterno", d: "Una partida con 30 intentos entre los dos.", i: "🏞️", x: c => Object.values(c.est.intentos || {}).reduce((a, l) => a + l.length, 0) >= 30 }
  ],
  cartas: [
    { id: "puro", n: "Pureza elemental", d: "Gana con un trío del mismo elemento.", i: "🔥", x: c => c.gano && c.est.trio && new Set(c.est.trio.map(k => k.e)).size === 1 },
    { id: "mixto", n: "Tres elementos", d: "Gana con un trío de los tres elementos.", i: "🌀", x: c => c.gano && c.est.trio && new Set(c.est.trio.map(k => k.e)).size === 3 },
    { id: "arcoiris", n: "Arcoíris", d: "Reúne cartas ganadas de 5 colores distintos.", i: "🌈", x: c => new Set(((c.est.ganadas || {})[c.me] || []).map(k => k.c)).size >= 5 },
    { id: "doce", n: "Golpe maestro", d: "Gana una ronda con un 12.", i: "💥", x: c => (c.est.rondas || []).some(r => r.gana === c.me && r.cartas[c.me] && r.cartas[c.me].v === 12) },
    { id: "relampago", n: "Relámpago", d: "Gana en tres rondas, sin perder ninguna.", i: "⚡", x: c => c.gano && (c.est.rondas || []).length === 3 },
    { id: "maraton", n: "Duelo eterno", d: "Una partida de 12 rondas o más.", i: "⏳", x: c => (c.est.rondas || []).length >= 12 }
  ],
  cuadritos: [
    { id: "doble", n: "Doble cierre", d: "Cierra dos cajas con una sola raya.", i: "✌️", x: c => { const u = c.est.ultima || {}; return (u.cajas || []).length >= 2 && (c.est.rayas || {})[u.clave] === c.me; } },
    { id: "mitad", n: "Terrateniente", d: "Quédate con la mitad de las cajas o más.", i: "🏘️", x: c => { const L = (c.est.lado || 6) - 1; return c.fin && mias(c.est.cajas, c.me).length * 2 >= L * L; } },
    { id: "esquinas", n: "Cuatro esquinas", d: "Termina con las cuatro cajas de las esquinas.", i: "📐", x: c => { const L = (c.est.lado || 6) - 2, k = c.est.cajas || {}; return c.fin && ["0_0", `0_${L}`, `${L}_0`, `${L}_${L}`].every(q => k[q] === c.me); } },
    { id: "gigante", n: "Gran tablero", d: "Gana en el tablero más grande.", i: "🗺️", x: c => c.gano && c.est.lado === ladoMax },
    { id: "multitud", n: "Entre la multitud", d: "Gana con 5 jugadores o más.", i: "👥", x: c => c.gano && c.n >= 5 },
    { id: "justo", n: "Por una caja", d: "Gana por un solo punto.", i: "🤏", x: c => c.gano && margen(c.est.puntos || {}, c) === 1 }
  ],
  reversi: [
    { id: "cincuenta", n: "Marea negra", d: "Gana con 50 fichas o más.", i: "🌊", x: c => c.gano && ((c.est.cuenta || {})[c.me] || 0) >= 50 },
    { id: "esquinas", n: "Las cuatro esquinas", d: "Ten las cuatro esquinas a la vez.", i: "🏰", x: c => { const L = (c.est.lado || 8) - 1, t = c.est.tab || {}; return ["0_0", `0_${L}`, `${L}_0`, `${L}_${L}`].every(q => t[q] === c.me); } },
    { id: "volteo", n: "Volteretas", d: "Voltea 6 fichas en una jugada.", i: "🤸", x: c => { const u = c.est.ultima || {}; return (u.voltea || []).length >= 6 && (c.est.tab || {})[u.casilla] === c.me; } },
    { id: "terremoto", n: "Terremoto", d: "Voltea 10 fichas en una jugada.", i: "🌋", x: c => { const u = c.est.ultima || {}; return (u.voltea || []).length >= 10 && (c.est.tab || {})[u.casilla] === c.me; } },
    { id: "ajustado", n: "Fotofinish", d: "Gana por 2 fichas o menos.", i: "📸", x: c => c.gano && margen(c.est.cuenta || {}, c) <= 2 },
    { id: "barrida", n: "Barrida", d: "Gana dejando al rival sin fichas.", i: "🧹", x: c => c.gano && c.rival && !((c.est.cuenta || {})[c.rival]) }
  ],
  cadena: [
    { id: "cadena10", n: "Reacción en cadena", d: "Una jugada tuya dispara 10 ondas.", i: "💣", x: c => { const u = c.est.ultima || {}; return u.uid === c.me && (u.ondas || []).length >= 10; } },
    { id: "cadena30", n: "Fisión nuclear", d: "Una jugada tuya dispara 30 ondas.", i: "☢️", x: c => { const u = c.est.ultima || {}; return u.uid === c.me && (u.ondas || []).length >= 30; } },
    { id: "captura", n: "Absorción", d: "Captura 15 orbes en una jugada.", i: "🧲", x: c => { const u = c.est.ultima || {}; return u.uid === c.me && u.capturadas >= 15; } },
    { id: "doble", n: "Dos pájaros", d: "Elimina a dos jugadores con una jugada.", i: "🎯", x: c => { const u = c.est.ultima || {}; return u.uid === c.me && (u.caen || []).length >= 2; } },
    { id: "multitud", n: "Caos controlado", d: "Gana con 6 jugadores o más.", i: "🌪️", x: c => c.gano && c.n >= 6 },
    { id: "blitz", n: "Guerra relámpago", d: "Gana en menos de 25 movimientos.", i: "⚡", x: c => c.gano && c.est.movs < 25 }
  ],
  worms: [
    { id: "d300", n: "Artillero", d: "Haz 300 de daño en una partida.", i: "💥", x: c => ((c.est.puntos || {})[c.me] || 0) >= 300 },
    { id: "d600", n: "Demolición", d: "Haz 600 de daño en una partida.", i: "🏗️", x: c => ((c.est.puntos || {})[c.me] || 0) >= 600 },
    { id: "apagon", n: "Apagón", d: "Una partida donde no queda nadie en pie.", i: "🔌", x: c => c.fin && c.est.motivo === "apagon" },
    { id: "multitud", n: "Batalla campal", d: "Gana contra 4 escuadras o más.", i: "⚔️", x: c => c.gano && c.n >= 5 },
    { id: "epica", n: "Guerra de trincheras", d: "Una partida de 30 turnos o más.", i: "🪖", x: c => (c.est.turnos || 0) >= 30 },
    { id: "pacifista", n: "Sobreviviente", d: "Gana habiendo hecho el menor daño de la mesa.", i: "🕊️", x: c => c.gano && c.otros.length && c.otros.every(u => ((c.est.puntos || {})[u] || 0) > ((c.est.puntos || {})[c.me] || 0)) }
  ],
  flip7: [
    { id: "f7", n: "¡Flip 7!", d: "Reúne siete números distintos.", i: "7️⃣", x: c => c.ev("f7", h => h.uid === c.me) },
    { id: "cincuenta", n: "Mano de oro", d: "Suma 50 puntos en una ronda.", i: "💰", x: c => (c.est.rondas || []).some(r => (r.pts || {})[c.me] >= 50) },
    { id: "congela", n: "Congelador", d: "Congela a otro jugador.", i: "🧊", x: c => c.ev("congela", h => h.uid === c.me && h.a !== c.me) },
    { id: "venganza", n: "Vengador", d: "Gana una partida de Vengeance.", i: "😈", m: "Vengeance", x: c => c.gano && c.p.modo === "venganza" },
    { id: "super", n: "Supervengador", d: "Gana una partida de Super Vengeance.", i: "👹", m: "Super Vengeance", x: c => c.gano && c.p.modo === "super" },
    { id: "fulmina", n: "Fulminante", d: "Fulmina a otro jugador.", i: "⚡", m: "Super Vengeance", x: c => c.ev("mata", h => h.uid === c.me) }
  ],
  cacho: [
    { id: "calzo", n: "Calzador", d: "Calza y acierta.", i: "🎯", x: c => c.ev("destape", h => h.tipo === "calzo" && h.uid === c.me && h.acierta) },
    { id: "dudo", n: "Detector de mentiras", d: "Duda y acierta.", i: "🕵️", x: c => c.ev("destape", h => h.tipo === "dudo" && h.uid === c.me && h.acierta) },
    { id: "paso", n: "Paso", d: "Pasa con una mano servida.", i: "✋", x: c => c.ev("paso", h => h.uid === c.me) },
    { id: "obliga", n: "Obligado", d: "Obliga una ronda.", i: "☝️", x: c => c.ev("obliga", h => h.uid === c.me) },
    { id: "ultimo", n: "Último dado", d: "Gana con un solo dado en el cubilete.", i: "🎲", x: c => c.gano && (c.est.dados || {})[c.me] === 1 },
    { id: "siciliana", n: "Siciliano", d: "Gana una partida siciliana.", i: "🍋", m: "Siciliana", x: c => c.gano && !!c.est.sicil }
  ],
  uno: [
    { id: "pilla", n: "¡Te pillé!", d: "Pilla a alguien que no cantó UNO.", i: "🫵", x: c => c.ev("pilla", h => h.uid === c.me) },
    { id: "diluvio", n: "Diluvio", d: "Roba 10 cartas o más de golpe.", i: "🌧️", x: c => c.ev("roba", h => h.uid === c.me && h.n >= 10) },
    { id: "clasico", n: "Purista", d: "Gana una partida clásica.", i: "🟥", m: "Clásico", x: c => c.gano && (c.p.modo || "clasico") === "clasico" },
    { id: "nomercy", n: "Sin piedad", d: "Gana una partida de No Mercy.", i: "💀", m: "No Mercy", x: c => c.gano && /^nomercy/.test(c.p.modo || "") },
    { id: "allwild", n: "Salvaje", d: "Gana una partida de All Wild.", i: "🃏", m: "All Wild", x: c => c.gano && c.p.modo === "allwild" },
    { id: "liar", n: "Mentiroso profesional", d: "Gana una partida de Liar's.", i: "🤥", m: "Liar's", x: c => c.gano && c.p.modo === "liar" }
  ],
  catan: [
    { id: "largo", n: "Gran ruta", d: "Consigue la ruta comercial más larga.", i: "🛤️", x: c => c.ev("largo", h => h.uid === c.me) || c.est.largoDe === c.me },
    { id: "ejercito", n: "General", d: "Consigue el mayor ejército.", i: "🛡️", x: c => c.ev("ejercito", h => h.uid === c.me) || c.est.ejercito === c.me },
    { id: "ciudades", n: "Urbanista", d: "Ten 4 ciudades a la vez.", i: "🏙️", x: c => Object.values(c.est.edif || {}).filter(e => e && e.u === c.me && e.c === 2).length >= 4 },
    { id: "puerto", n: "Capitán de puerto", d: "Consigue el título de capitán de puerto.", i: "⚓", m: "Navegantes", x: c => c.ev("puerto", h => h.uid === c.me) || c.est.puertoDe === c.me },
    { id: "isla", n: "Descubridor", d: "Asiéntate en una isla nueva.", i: "🏝️", m: "Navegantes", x: c => c.ev("isla", h => h.uid === c.me) },
    { id: "navegante", n: "Lobo de mar", d: "Gana una partida de Navegantes.", i: "⛵", m: "Navegantes", x: c => c.gano && c.p.exp === "mar" }
  ],
  presidente: [
    { id: "pres", n: "Presidente", d: "Termina una ronda de Presidente.", i: "👑", x: c => (c.est.rondas || []).some(r => (r.roles || {})[c.me] === "pres") },
    { id: "culo", n: "Tocar fondo", d: "Termina una ronda de Culo.", i: "🪣", x: c => (c.est.rondas || []).some(r => (r.roles || {})[c.me] === "culo") },
    { id: "ascenso", n: "Del fondo a la cima", d: "Pasa de Culo a Presidente en la ronda siguiente.", i: "🚀", x: c => (c.est.rondas || []).some((r, i, a) => i > 0 && (r.roles || {})[c.me] === "pres" && (a[i - 1].roles || {})[c.me] === "culo") },
    { id: "dinastia", n: "Dinastía", d: "Sé Presidente tres rondas seguidas.", i: "🏛️", x: c => { let k = 0; for (const r of c.est.rondas || []) { k = (r.roles || {})[c.me] === "pres" ? k + 1 : 0; if (k >= 3) return true; } return false; } },
    { id: "mesa", n: "Mesa larga", d: "Juega una ronda con 7 o más en la mesa.", i: "🪑", x: c => (c.est.rondas || []).some(r => r.n >= 7 && (r.orden || []).includes(c.me)) },
    { id: "treinta", n: "Acumulador", d: "Suma 30 puntos en una mesa.", i: "📈", x: c => ((c.est.puntos || {})[c.me] || 0) >= 30 }
  ],
  spicy: [
    { id: "trofeo", n: "Picante", d: "Gana un trofeo.", i: "🌶️", x: c => c.ev("trofeo", h => h.uid === c.me) },
    { id: "trofeos", n: "Doble picante", d: "Gana por dos trofeos.", i: "🏆", x: c => c.gano && c.est.motivo === "trofeos" },
    { id: "findelmundo", n: "Fin del mundo", d: "Gana a los puntos cuando se acaba el mundo.", i: "🌍", x: c => c.gano && c.est.motivo !== "trofeos" && c.est.motivo !== "abandono" },
    { id: "cazador", n: "Cazafaroles", d: "Duda de un farol y acierta.", i: "🔍", x: c => c.ev("destapa", h => h.a === c.me && h.gana === c.me) },
    { id: "honesto", n: "Palabra de honor", d: "Te dudan y decías la verdad.", i: "😇", x: c => c.ev("destapa", h => h.uid === c.me && h.verdad) },
    { id: "multitud", n: "Mesa picante", d: "Gana con 5 jugadores o más.", i: "🥵", x: c => c.gano && c.n >= 5 }
  ],
  tetris: [
    { id: "e20", n: "Remitente", d: "Envía 20 líneas de basura en una partida.", i: "📦", x: c => ((c.est.enviadas || {})[c.me] || 0) >= 20 },
    { id: "e50", n: "Vertedero", d: "Envía 50 líneas de basura en una partida.", i: "🗑️", x: c => ((c.est.enviadas || {})[c.me] || 0) >= 50 },
    { id: "cuatro", n: "Tetris", d: "Envía 4 líneas de una vez.", i: "🧱", x: c => c.ev("ataque", h => h.uid === c.me && h.n >= 4) },
    { id: "avalancha", n: "Avalancha", d: "Envía 6 líneas de una vez.", i: "🏔️", x: c => c.ev("ataque", h => h.uid === c.me && h.n >= 6) },
    { id: "multitud", n: "Último en pie", d: "Gana contra 3 rivales o más.", i: "🗼", x: c => c.gano && c.n >= 4 },
    { id: "pacifista", n: "Zen", d: "Gana habiendo enviado menos de 5 líneas.", i: "🧘", x: c => c.gano && ((c.est.enviadas || {})[c.me] || 0) < 5 }
  ]
};

/* Individuales: cada prueba mira una marca `{categoria, puntos, tiempo}`. */
const cat = re => d => re.test(d.categoria);
const snake = (modo, n, nombre, i, pts) =>
  ({ id: modo, n: nombre, d: `Haz ${pts} puntos en ${n}.`, i, m: n, s: d => cat(new RegExp(`^club-snake-${modo}-`))(d) && d.puntos >= pts });
const SOLO = {
  minas: [
    { id: "easy", n: "Desminador", d: "Gana en Fácil.", i: "🚩", m: "Fácil", s: cat(/-easy$/) },
    { id: "medium", n: "Artificiero", d: "Gana en Medio.", i: "💣", m: "Medio", s: cat(/-medium$/) },
    { id: "hard", n: "Experto en explosivos", d: "Gana en Difícil.", i: "🧨", m: "Difícil", s: cat(/-hard$/) },
    { id: "easy10", n: "Dedos rápidos", d: "Gana Fácil en menos de 10 s.", i: "⚡", m: "Fácil", s: d => cat(/-easy$/)(d) && d.tiempo < 10000 },
    { id: "easy5", n: "Parpadeo", d: "Gana Fácil en menos de 5 s.", i: "👁️", m: "Fácil", s: d => cat(/-easy$/)(d) && d.tiempo < 5000 },
    { id: "medium60", n: "Un minuto", d: "Gana Medio en menos de 60 s.", i: "⏱️", m: "Medio", s: d => cat(/-medium$/)(d) && d.tiempo < 60000 },
    { id: "medium30", n: "Medio tiempo", d: "Gana Medio en menos de 30 s.", i: "🏃", m: "Medio", s: d => cat(/-medium$/)(d) && d.tiempo < 30000 },
    { id: "hard150", n: "Sangre fría", d: "Gana Difícil en menos de 150 s.", i: "🧊", m: "Difícil", s: d => cat(/-hard$/)(d) && d.tiempo < 150000 },
    { id: "hard90", n: "Manos de cirujano", d: "Gana Difícil en menos de 90 s.", i: "🩺", m: "Difícil", s: d => cat(/-hard$/)(d) && d.tiempo < 90000 },
    { id: "hard60", n: "Leyenda del campo", d: "Gana Difícil en menos de 60 s.", i: "🏅", m: "Difícil", s: d => cat(/-hard$/)(d) && d.tiempo < 60000 }
  ],
  snake: [
    snake("classic", "Clásico", "Serpiente clásica", "🐍", 500),
    snake("arcade", "Arcade", "Combo arcade", "🕹️", 800),
    snake("portals", "Portales", "Viajero", "🌀", 500),
    snake("reloj", "Contrarreloj", "Contra el reloj", "⏰", 500),
    snake("espejo", "Espejo", "Mente al revés", "🪞", 400),
    snake("laberinto", "Laberinto", "Minotauro", "🧩", 500),
    { id: "chico", n: "Espacio reducido", d: "Haz 300 puntos en el mapa chico.", i: "📦", m: "Chico", s: d => /-chico$/.test(d.categoria) && d.puntos >= 300 },
    { id: "gigante", n: "Anaconda", d: "Haz 1000 puntos en el mapa gigante.", i: "🐉", m: "Gigante", s: d => /-gigante$/.test(d.categoria) && d.puntos >= 1000 },
    { id: "p1500", n: "Hambre voraz", d: "Haz 1500 puntos en cualquier modo.", i: "🍎", s: d => d.puntos >= 1500 },
    { id: "p3000", n: "Ouróboros", d: "Haz 3000 puntos en cualquier modo.", i: "♾️", s: d => d.puntos >= 3000 }
  ],
  tetrisclub: [
    { id: "m10k", n: "Maratonista", d: "Haz 10 000 puntos en Maratón.", i: "🏃", m: "Maratón", s: d => cat(/-maraton$/)(d) && d.puntos >= 10000 },
    { id: "m50k", n: "Resistencia", d: "Haz 50 000 puntos en Maratón.", i: "🫀", m: "Maratón", s: d => cat(/-maraton$/)(d) && d.puntos >= 50000 },
    { id: "m100k", n: "Imparable", d: "Haz 100 000 puntos en Maratón.", i: "🚂", m: "Maratón", s: d => cat(/-maraton$/)(d) && d.puntos >= 100000 },
    { id: "sprint", n: "Cuarenta líneas", d: "Termina un Sprint.", i: "🏁", m: "Sprint", s: cat(/-sprint$/) },
    { id: "s180", n: "Tres minutos", d: "Termina un Sprint en menos de 3 min.", i: "⏱️", m: "Sprint", s: d => cat(/-sprint$/)(d) && d.tiempo < 180000 },
    { id: "s120", n: "Dos minutos", d: "Termina un Sprint en menos de 2 min.", i: "⚡", m: "Sprint", s: d => cat(/-sprint$/)(d) && d.tiempo < 120000 },
    { id: "s60", n: "Rayo", d: "Termina un Sprint en menos de 1 min.", i: "🌩️", m: "Sprint", s: d => cat(/-sprint$/)(d) && d.tiempo < 60000 },
    { id: "u5k", n: "Dos minutos intensos", d: "Haz 5000 puntos en Ultra.", i: "🔥", m: "Ultra", s: d => cat(/-ultra$/)(d) && d.puntos >= 5000 },
    { id: "u20k", n: "Ultravioleta", d: "Haz 20 000 puntos en Ultra.", i: "🟣", m: "Ultra", s: d => cat(/-ultra$/)(d) && d.puntos >= 20000 },
    { id: "u50k", n: "Ultrasónico", d: "Haz 50 000 puntos en Ultra.", i: "🚀", m: "Ultra", s: d => cat(/-ultra$/)(d) && d.puntos >= 50000 }
  ]
};

/* El catálogo entero: juego → sus diez. */
export const LOGROS = Object.fromEntries([
  ...Object.entries(SALA).map(([j, l]) => [j, [...FILA, ...l]]),
  ...Object.entries(SOLO)
]);
/* Qué categorías de `soloRanks` alimentan cada juego individual. */
export const SOLO_PREFIJO = { minas: "club-minas-", snake: "club-snake-", tetrisclub: "club-tetris-" };

/* Los logros de partida que `uid` tiene ya en esta, según lo que se ve. */
export function detecta(p, est, uid) {
  const l = SALA[p && p.juego];
  if (!l || !est || !uid) return [];
  const c = contexto(p, est, uid);
  const r = [];
  for (const x of l) { try { if (x.x(c)) r.push(x.id); } catch (e) { /* un campo que no está: no hay logro */ } }
  return r;
}
/* Los que se derivan de la fila de la clasificación. */
export const deFila = f => f ? FILA.filter(x => x.f(Object.assign({ ganadas: 0, jugadas: 0, mejorRacha: 0 }, f))).map(x => x.id) : [];
/* Los de una marca individual. */
export function deMarca(juego, d) {
  const l = SOLO[juego];
  if (!l || !d) return [];
  return l.filter(x => { try { return x.s(d); } catch (e) { return false; } }).map(x => x.id);
}

/* Quién tiene qué: juego → id → Set(uid), y juego → Set(uid) de quienes
   cuentan como jugadores (el denominador de los porcentajes). Todo sale
   de las tres lecturas, sin escribir nada. */
export function reparto(ranks, solo, guardados) {
  const tiene = {}, gente = {};
  for (const j of Object.keys(LOGROS)) { tiene[j] = {}; gente[j] = new Set(); for (const x of LOGROS[j]) tiene[j][x.id] = new Set(); }
  const pon = (j, id, u) => { if (tiene[j] && tiene[j][id]) { tiene[j][id].add(u); gente[j].add(u); } };
  for (const [j, filas] of Object.entries(ranks || {})) {
    if (!tiene[j]) continue;
    for (const [u, f] of Object.entries(filas || {})) { gente[j].add(u); for (const id of deFila(f)) pon(j, id, u); }
  }
  for (const [c, filas] of Object.entries(solo || {})) {
    const j = Object.keys(SOLO_PREFIJO).find(k => c.startsWith(SOLO_PREFIJO[k]));
    if (!j) continue;
    for (const [u, d] of Object.entries(filas || {})) { gente[j].add(u); for (const id of deMarca(j, Object.assign({ categoria: c }, d))) pon(j, id, u); }
  }
  for (const [j, us] of Object.entries(guardados || {}))
    for (const [u, ids] of Object.entries(us || {})) for (const id of Object.keys(ids || {})) pon(j, id, u);
  return { tiene, gente };
}
