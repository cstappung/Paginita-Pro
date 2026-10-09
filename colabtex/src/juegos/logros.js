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
import { TAMANOS, ganoEn } from "./motor.js";

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
    p: p || {}, est: est || {}, me, fin, gano: fin && ganoEn(p, g, me), n: js.length, otros, rival: otros[0], hist,
    ev: (e, f) => hist.some(h => h && h.e === e && (!f || f(h)))
  };
}
/* Mis puntos menos los del mejor de los demás. */
const margen = (pts, c) => (pts[c.me] || 0) - Math.max(...c.otros.map(u => pts[u] || 0), -Infinity);
/* Órbita: algún suceso de los turnos recientes (cada entrada de `hist` es un turno). */
const orEv = (c, f) => c.hist.some(h => h && Array.isArray(h.eventos) && h.eventos.some(f));
const mias = (obj, me) => Object.keys(obj || {}).filter(k => obj[k] === me);
/* Con qué color juega `me` en una partida de ajedrez ("" si mira). */
const ajColorDe = c => (c.est.blancas === c.me ? "w" : c.est.negras === c.me ? "b" : "");
const ladoMax = Math.max(...Object.values(TAMANOS).map(t => t.lado));

/* Pokémon: el resumen que el motor saca del registro de Showdown. */
const pkDe = c => { const i = (c.est.lados || []).indexOf(c.me); return (i >= 0 && c.est.resumen && c.est.resumen[i]) || {}; };
const SALA = {
  orbita: [
    { id: "racimo", n: "Racimo", d: "Captura 3 estrellas o más con un solo lanzamiento.", i: "✨", x: c => orEv(c, e => e.k === "estrella" && e.nueva && e.u === c.me && e.n >= 3) },
    { id: "derribo", n: "Derribo", d: "Derriba un satélite rival con tu sonda.", i: "💥", x: c => orEv(c, e => e.k === "choque" && e.quien === c.me) },
    { id: "nova", n: "Supernova", d: "Captura una nova (una estrella de 5).", i: "🌟", x: c => orEv(c, e => e.k === "estrella" && e.u === c.me && e.v === 5) },
    { id: "veterano", n: "Satélite veterano", d: "Un satélite tuyo ya en órbita captura su 3.ª estrella.", i: "🛰️", x: c => orEv(c, e => e.k === "estrella" && !e.nueva && e.u === c.me && e.n >= 3) },
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
  /* Gato: todo sale del tablero final; `grande` es el del super. */
  gato: [
    { id: "raya", n: "Tres en raya", d: "Gana un gato clásico.", i: "✖️", m: "Clásico", x: c => c.gano && c.est.variante === "clasico" && c.est.motivo === "raya" },
    { id: "rapido", n: "A la tercera", d: "Gana un gato clásico en tu tercera ficha.", i: "⚡", m: "Clásico", x: c => c.gano && c.est.variante === "clasico" && c.est.motivo === "raya" && c.est.movs <= 6 },
    { id: "super", n: "Super Gato", d: "Gana una partida de Super Gato.", i: "#️⃣", m: "Super Gato", x: c => c.gano && c.est.variante === "super" && c.est.motivo === "raya" },
    { id: "pequeno", n: "Primer gatito", d: "Gana un gato pequeño en el Super Gato.", i: "🐱", m: "Super Gato", x: c => c.est.variante === "super" && (c.est.grande || []).includes(c.est.equis === c.me ? "x" : "o") },
    { id: "cinco", n: "Dueño de la pizarra", d: "Ten cinco gatos pequeños a la vez.", i: "🧽", m: "Super Gato", x: c => { const f = c.est.equis === c.me ? "x" : "o"; return c.est.variante === "super" && (c.est.grande || []).filter(v => v === f).length >= 5; } },
    { id: "tablas", n: "Gato encerrado", d: "Termina una partida en empate.", i: "🤝", x: c => c.est.fase === "fin" && c.est.motivo === "empate" }
  ],
  reversi: [
    { id: "cincuenta", n: "Marea negra", d: "Gana con 50 fichas o más.", i: "🌊", x: c => c.gano && ((c.est.cuenta || {})[c.me] || 0) >= 50 },
    { id: "esquinas", n: "Las cuatro esquinas", d: "Ten las cuatro esquinas a la vez.", i: "🏰", x: c => { const L = (c.est.lado || 8) - 1, t = c.est.tab || {}; return ["0_0", `0_${L}`, `${L}_0`, `${L}_${L}`].every(q => t[q] === c.me); } },
    { id: "volteo", n: "Volteretas", d: "Voltea 6 fichas en una jugada.", i: "🤸", x: c => { const u = c.est.ultima || {}; return (u.voltea || []).length >= 6 && (c.est.tab || {})[u.casilla] === c.me; } },
    { id: "terremoto", n: "Terremoto", d: "Voltea 10 fichas en una jugada.", i: "🌋", x: c => { const u = c.est.ultima || {}; return (u.voltea || []).length >= 10 && (c.est.tab || {})[u.casilla] === c.me; } },
    { id: "ajustado", n: "Fotofinish", d: "Gana por 2 fichas o menos.", i: "📸", x: c => c.gano && margen(c.est.cuenta || {}, c) <= 2 },
    { id: "barrida", n: "Barrida", d: "Gana dejando al rival sin fichas.", i: "🧹", x: c => c.gano && c.rival && !((c.est.cuenta || {})[c.rival]) }
  ],
  /* Ajedrez: todo sale de `movs`, la hoja de la partida que el reductor
     ya lleva entera, con el color de quien hizo cada jugada. */
  /* Pokémon: todo sale de `resumen`, que el motor cuenta leyendo el
     registro público de la pelea (críticos, Tera, debilitados). */
  /* Boxhead: el registro solo lleva niveles y muertes; los puntos y las
     bajas de cooperativo llegan al caer (`muere` los trae). */
  boxhead: [
    { id: "nivel5", n: "Aguante", d: "Llega al nivel 5 en cooperativo.", i: "🧱", m: "Cooperativo", x: c => c.est.variante === "coop" && (c.est.nivel || 1) >= 5 },
    { id: "nivel10", n: "Fortín", d: "Llega al nivel 10 en cooperativo.", i: "🏰", m: "Cooperativo", x: c => c.est.variante === "coop" && (c.est.nivel || 1) >= 10 },
    { id: "cien", n: "Carnicero", d: "Haz 100 bajas en una partida cooperativa.", i: "🪓", m: "Cooperativo", x: c => c.est.variante === "coop" && ((c.est.kills || {})[c.me] || 0) >= 100 },
    { id: "puntos", n: "Multiplicador", d: "Termina una partida cooperativa con 5000 puntos.", i: "✖️", m: "Cooperativo", x: c => c.est.variante === "coop" && ((c.est.puntos || {})[c.me] || 0) >= 5000 },
    { id: "equipo", n: "Pelotón", d: "Llega al nivel 3 con 4 jugadores o más.", i: "👥", m: "Cooperativo", x: c => c.est.variante === "coop" && c.n >= 4 && (c.est.nivel || 1) >= 3 },
    { id: "intacto", n: "Intocable", d: "Gana un versus sin morir ni una vez.", i: "🛡️", m: "Versus", x: c => c.gano && c.est.variante === "versus" && c.est.motivo === "meta" && !((c.est.muertes || {})[c.me]) }
  ],
  pokemon: [
    { id: "tera", n: "Teracristal", d: "Teracristaliza a uno de tus Pokémon.", i: "💎", x: c => pkDe(c).tera > 0 },
    { id: "critico", n: "Golpe crítico", d: "Asesta un golpe crítico.", i: "💥", x: c => pkDe(c).crit > 0 },
    { id: "ohko", n: "De un golpe", d: "Debilita de un solo ataque a un Pokémon que tenía la vida llena.", i: "⚡", x: c => pkDe(c).ohko > 0 },
    { id: "barredor", n: "Barredor", d: "Un mismo Pokémon tuyo debilita a tres rivales en una pelea.", i: "🧹", x: c => pkDe(c).maxKo >= 3 },
    { id: "limite", n: "Al límite", d: "Gana con un solo Pokémon en pie.", i: "🫀", x: c => c.gano && c.est.motivo === "ko" && pkDe(c).vivos === 1 },
    { id: "impecable", n: "Impecable", d: "Gana sin que se debilite ninguno de tus Pokémon.", i: "👑", x: c => c.gano && c.est.motivo === "ko" && pkDe(c).perdidos === 0 }
  ],
  ajedrez: [
    { id: "mate", n: "Jaque mate", d: "Gana una partida dando mate.", i: "♚", x: c => c.gano && c.est.motivo === "mate" },
    { id: "relampago", n: "Mate relámpago", d: "Da mate en 20 jugadas o menos.", i: "⚡", x: c => c.gano && c.est.motivo === "mate" && (c.est.movs || []).length <= 40 },
    { id: "alpaso", n: "Al paso", d: "Captura un peón al paso.", i: "👣", x: c => (c.est.movs || []).some(m => m.ep && m.c === ajColorDe(c)) },
    { id: "corona", n: "Coronación", d: "Corona un peón.", i: "👑", x: c => (c.est.movs || []).some(m => m.pr && m.c === ajColorDe(c)) },
    { id: "caballo", n: "Subpromoción", d: "Corona un peón en algo que no sea dama.", i: "🐴", x: c => (c.est.movs || []).some(m => m.pr && m.pr !== "q" && m.c === ajColorDe(c)) },
    { id: "remonta", n: "Remontada", d: "Da mate con menos material que el rival.", i: "🧗", x: c => { const col = ajColorDe(c), m = c.est.material || {}; return c.gano && c.est.motivo === "mate" && col && m[col] < m[col === "w" ? "b" : "w"]; } }
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
  ],
  yemas: [
    { id: "sangre", n: "Primera sangre", d: "Haz la primera baja de la partida.", i: "🍳", x: c => c.est.primera === c.me },
    { id: "racha5", n: "Sartén caliente", d: "Fríe a 5 seguidos sin que te frían.", i: "🔥", x: c => ((c.est.mejorRacha || {})[c.me] || 0) >= 5 },
    { id: "cabezas", n: "Punto de yema", d: "Haz 5 bajas a la cabeza en una partida.", i: "🎯", x: c => ((c.est.cabezas || {})[c.me] || 0) >= 5 },
    { id: "poche", n: "Poché", d: "Haz una baja a la cabeza con el Poché.", i: "🔭", x: c => c.ev("baja", h => h.uid === c.me && h.a === 2 && h.cab) },
    { id: "intacto", n: "Cáscara intacta", d: "Gana sin morir ni una vez.", i: "🥚", x: c => c.gano && ((c.est.muertes || {})[c.me] || 0) === 0 },
    { id: "multitud", n: "Omelette gigante", d: "Gana con 5 jugadores o más.", i: "🍽️", x: c => c.gano && c.n >= 5 }
  ],
  clue: [
    { id: "ojo", n: "Ojo clínico", d: "Resuelve el caso con 4 sugerencias o menos.", i: "🔎", x: c => c.gano && c.est.motivo === "acierto" && (c.est.sugerencias || []).filter(s => s.uid === c.me).length <= 4 },
    { id: "callejon", n: "Callejón sin salida", d: "Haz una sugerencia que nadie pueda refutar.", i: "🧱", x: c => c.ev("nadie", h => h.uid === c.me) },
    { id: "atajo", n: "Atajo", d: "Usa la escalera o el montacargas.", i: "🛗", x: c => c.ev("mueve", h => h.uid === c.me && h.v === "pasadizo") },
    { id: "doble6", n: "Doble seis", d: "Saca 12 con los dados.", i: "🎲", x: c => c.ev("mueve", h => h.uid === c.me && Array.isArray(h.dados) && h.dados[0] + h.dados[1] === 12) },
    { id: "poker", n: "Cara de póker", d: "Resuelve el caso sin haber enseñado ni una carta.", i: "😶", x: c => c.gano && c.est.motivo === "acierto" && !(c.est.sugerencias || []).some(s => s.mostro === c.me) },
    { id: "multitud", n: "Caso cerrado", d: "Resuelve el caso contra 4 rivales o más.", i: "🗂️", x: c => c.gano && c.est.motivo === "acierto" && c.n >= 5 }
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
  ],
  sortem: [
    { id: "d10", n: "En orden", d: "Ordena del 1 al 10.", i: "🔢", m: "10", s: cat(/-10$/) },
    { id: "d10t30", n: "Sin pensarlo", d: "Ordena del 1 al 10 en menos de 30 s.", i: "⏱️", m: "10", s: d => cat(/-10$/)(d) && d.tiempo < 30000 },
    { id: "d10t15", n: "Reflejos", d: "Ordena del 1 al 10 en menos de 15 s.", i: "⚡", m: "10", s: d => cat(/-10$/)(d) && d.tiempo < 15000 },
    { id: "d20", n: "Veinte en fila", d: "Ordena del 1 al 20.", i: "📶", m: "20", s: cat(/-20$/) },
    { id: "d20t60", n: "Minuto justo", d: "Ordena del 1 al 20 en menos de 1 min.", i: "⌛", m: "20", s: d => cat(/-20$/)(d) && d.tiempo < 60000 },
    { id: "d20t40", n: "Clasificador", d: "Ordena del 1 al 20 en menos de 40 s.", i: "🗂️", m: "20", s: d => cat(/-20$/)(d) && d.tiempo < 40000 },
    { id: "d10t10", n: "Relámpago", d: "Ordena del 1 al 10 en menos de 10 s.", i: "🌩️", m: "10", s: d => cat(/-10$/)(d) && d.tiempo < 10000 },
    { id: "d10t7", n: "Máquina de ordenar", d: "Ordena del 1 al 10 en menos de 7 s.", i: "🤖", m: "10", s: d => cat(/-10$/)(d) && d.tiempo < 7000 },
    { id: "d20t30", n: "Mano rápida", d: "Ordena del 1 al 20 en menos de 30 s.", i: "🌪️", m: "20", s: d => cat(/-20$/)(d) && d.tiempo < 30000 },
    { id: "d20t20", n: "Sin mirar", d: "Ordena del 1 al 20 en menos de 20 s.", i: "🎯", m: "20", s: d => cat(/-20$/)(d) && d.tiempo < 20000 }
  ],
  bbtan: [
    { id: "r10", n: "Primer rebote", d: "Llega a la ronda 10.", i: "🟩", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 10 },
    { id: "r20", n: "Buena puntería", d: "Llega a la ronda 20.", i: "🎯", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 20 },
    { id: "r30", n: "Carambola", d: "Llega a la ronda 30.", i: "🎱", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 30 },
    { id: "r50", n: "Medio centenar", d: "Llega a la ronda 50.", i: "🧱", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 50 },
    { id: "r75", n: "Lluvia de burbujas", d: "Llega a la ronda 75.", i: "🫧", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 75 },
    { id: "r100", n: "Centenario", d: "Llega a la ronda 100.", i: "💯", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 100 },
    { id: "r150", n: "Muro de ladrillos", d: "Llega a la ronda 150.", i: "🏗️", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 150 },
    { id: "r200", n: "Maquinita", d: "Llega a la ronda 200.", i: "🕹️", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 200 },
    { id: "r300", n: "Insert coin", d: "Llega a la ronda 300.", i: "💰", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 300 },
    { id: "r500", n: "Leyenda del after hours", d: "Llega a la ronda 500.", i: "👾", m: "Rondas", s: d => cat(/-rondas$/)(d) && d.puntos >= 500 }
  ],
  /* La racha se lee de club-sopa-racha (puntos = días seguidos); el resto,
     de las sopas libres, donde los puntos son fijos y manda el tiempo. */
  sopa: [
    { id: "dia1", n: "Sopa del día", d: "Completa una sopa diaria.", i: "🔤", m: "Diaria", s: cat(/-racha$/) },
    { id: "racha3", n: "Tres al hilo", d: "Llega a una racha de 3 días.", i: "🔥", m: "Diaria", s: d => cat(/-racha$/)(d) && d.puntos >= 3 },
    { id: "racha7", n: "Una semana entera", d: "Llega a una racha de 7 días.", i: "📅", m: "Diaria", s: d => cat(/-racha$/)(d) && d.puntos >= 7 },
    { id: "racha30", n: "Un mes de sopas", d: "Llega a una racha de 30 días.", i: "🗓️", m: "Diaria", s: d => cat(/-racha$/)(d) && d.puntos >= 30 },
    { id: "libre", n: "Por gusto", d: "Completa una sopa libre.", i: "🧩", m: "Libre", s: d => cat(/-\d+$/)(d) },
    { id: "grande", n: "Sopa grande", d: "Completa una sopa libre de 15×15.", i: "🍜", m: "Libre", s: d => cat(/-15$/)(d) },
    { id: "dificil", n: "Al derecho y al revés", d: "Completa una sopa libre en Difícil.", i: "🔄", m: "Difícil", s: d => cat(/-dificil-/)(d) },
    { id: "maestro", n: "Maestro de la sopa", d: "Completa una Difícil de 15×15.", i: "👑", m: "Difícil", s: d => cat(/-dificil-15$/)(d) },
    { id: "lince", n: "Ojo de lince", d: "Completa una de 12×12 en menos de 1 min.", i: "🐆", m: "Libre", s: d => cat(/-12$/)(d) && d.tiempo < 60000 },
    { id: "rayo", n: "Relámpago", d: "Completa una de 8×8 en menos de 20 s.", i: "⚡", m: "Libre", s: d => cat(/-8$/)(d) && d.tiempo < 20000 }
  ],
  /* La racha sale de club-electro-racha (días con los cuatro modos); el
     resto, de club-electro-puntos, la suma de todos los días. */
  electro: [
    { id: "dia1", n: "Circuito cerrado", d: "Acierta los modos de adivinar de un día.", i: "🔌", m: "Racha", s: cat(/-racha$/) },
    { id: "racha3", n: "Corriente continua", d: "Llega a una racha de 3 días.", i: "🔋", m: "Racha", s: d => cat(/-racha$/)(d) && d.puntos >= 3 },
    { id: "racha7", n: "Una semana enchufado", d: "Llega a una racha de 7 días.", i: "📅", m: "Racha", s: d => cat(/-racha$/)(d) && d.puntos >= 7 },
    { id: "racha14", n: "Dos semanas en fase", d: "Llega a una racha de 14 días.", i: "〰️", m: "Racha", s: d => cat(/-racha$/)(d) && d.puntos >= 14 },
    { id: "racha30", n: "Alto voltaje", d: "Llega a una racha de 30 días.", i: "⚠️", m: "Racha", s: d => cat(/-racha$/)(d) && d.puntos >= 30 },
    { id: "p500", n: "Chispa", d: "Junta 500 puntos.", i: "✨", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 500 },
    { id: "p2000", n: "Kilovoltio", d: "Junta 2000 puntos.", i: "⚡", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 2000 },
    { id: "p5000", n: "Media tensión", d: "Junta 5000 puntos.", i: "🗼", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 5000 },
    { id: "p15000", n: "Alta tensión", d: "Junta 15 000 puntos.", i: "🏭", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 15000 },
    { id: "p40000", n: "Rayo", d: "Junta 40 000 puntos.", i: "🌩️", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 40000 }
  ],
  /* La racha sale de las seis tablas instalación × nivel; el total de
     victorias, de club-frontera-victorias. */
  frontera: [
    { id: "r7", n: "Primer símbolo… casi", d: "Gana una serie entera de 7 combates.", i: "🏰", m: "Racha", s: d => cat(/-(torre|palacio|fabrica)-/)(d) && d.puntos >= 7 },
    { id: "r21", n: "Tercera serie", d: "Llega a 21 victorias seguidas.", i: "🗼", m: "Racha", s: d => cat(/-(torre|palacio|fabrica)-/)(d) && d.puntos >= 21 },
    { id: "r35", n: "Cerebro de la Frontera", d: "Llega a 35 victorias seguidas (la Torre te espera ahí).", i: "🧠", m: "Racha", s: d => cat(/-(torre|palacio|fabrica)-/)(d) && d.puntos >= 35 },
    { id: "r70", n: "Símbolo de oro", d: "Llega a 70 victorias seguidas.", i: "🥇", m: "Racha", s: d => cat(/-(torre|palacio|fabrica)-/)(d) && d.puntos >= 70 },
    { id: "r100", n: "Leyenda de la Frontera", d: "Llega a 100 victorias seguidas.", i: "👑", m: "Racha", s: d => cat(/-(torre|palacio|fabrica)-/)(d) && d.puntos >= 100 },
    { id: "pal21", n: "Confianza ciega", d: "21 seguidas en el Palacio Batalla.", i: "🏯", m: "Palacio", s: d => cat(/-palacio-/)(d) && d.puntos >= 21 },
    { id: "fab21", n: "Alquilado y ganado", d: "21 seguidas en la Fábrica Batalla.", i: "🏭", m: "Fábrica", s: d => cat(/-fabrica-/)(d) && d.puntos >= 21 },
    { id: "v10", n: "Habitual", d: "Gana 10 combates en la Frontera.", i: "🎫", m: "Victorias", s: d => cat(/-victorias$/)(d) && d.puntos >= 10 },
    { id: "v100", n: "Veterano", d: "Gana 100 combates en la Frontera.", i: "🎖️", m: "Victorias", s: d => cat(/-victorias$/)(d) && d.puntos >= 100 },
    { id: "v500", n: "Residente", d: "Gana 500 combates en la Frontera.", i: "🏆", m: "Victorias", s: d => cat(/-victorias$/)(d) && d.puntos >= 500 }
  ],
  /* Sudoku Arcade. La racha sale de club-sudoku-racha (puntos = días
     seguidos con el diario resuelto); los del clásico, de las cuatro
     tablas por dificultad (puntos fijos en 1: lo que cuenta es el tiempo,
     en ms); los del arcade, de club-sudoku-arcade (puntos de la partida). */
  sudoku: [
    { id: "dia1", n: "Sudoku del día", d: "Resuelve un sudoku diario.", i: "🔢", m: "Diario", s: cat(/-racha$/) },
    { id: "racha3", n: "Tres al hilo", d: "Llega a una racha de 3 días.", i: "🔥", m: "Diario", s: d => cat(/-racha$/)(d) && d.puntos >= 3 },
    { id: "racha7", n: "Semana de nueve en nueve", d: "Llega a una racha de 7 días.", i: "📅", m: "Diario", s: d => cat(/-racha$/)(d) && d.puntos >= 7 },
    { id: "racha30", n: "Un mes de cuadrículas", d: "Llega a una racha de 30 días.", i: "🗓️", m: "Diario", s: d => cat(/-racha$/)(d) && d.puntos >= 30 },
    { id: "facil", n: "Insert coin", d: "Resuelve un clásico en Fácil.", i: "🪙", m: "Clásico", s: cat(/-facil$/) },
    { id: "experto", n: "Nivel experto", d: "Resuelve un clásico en Experto.", i: "🧠", m: "Clásico", s: cat(/-experto$/) },
    { id: "medio5", n: "Contra el reloj", d: "Resuelve un clásico Medio en menos de 5 min.", i: "⏱️", m: "Clásico", s: d => cat(/-medio$/)(d) && d.tiempo < 300000 },
    { id: "dificil10", n: "Sangre fría", d: "Resuelve un clásico Difícil en menos de 10 min.", i: "🧊", m: "Clásico", s: d => cat(/-dificil$/)(d) && d.tiempo < 600000 },
    { id: "a10000", n: "Combo arcade", d: "Haz 10 000 puntos en una partida arcade.", i: "🕹️", m: "Arcade", s: d => cat(/-arcade$/)(d) && d.puntos >= 10000 },
    { id: "a25000", n: "Récord de recreativa", d: "Haz 25 000 puntos en una partida arcade.", i: "👾", m: "Arcade", s: d => cat(/-arcade$/)(d) && d.puntos >= 25000 }
  ],
  /* FANAL. Los de la historia salen de club-fanal-jornadas (puntos =
     jornadas completadas: 4 es la Nodriza, 8 el Faro Ciego, 11 la Esfinge,
     13 el cruce con el Alba, 21 la Crisálida y 25 la Hoguera; más allá, el
     sin fin); los de puntos, de club-fanal-travesia y club-fanal-sinfin. */
  fanal: [
    { id: "j4", n: "Madre del enjambre", d: "Apaga a la Nodriza (completa la jornada 4).", i: "🦋", m: "Travesía", s: d => cat(/-jornadas$/)(d) && d.puntos >= 4 },
    { id: "j8", n: "Faro ciego", d: "Apaga al Faro Ciego (completa la jornada 8).", i: "🗼", m: "Travesía", s: d => cat(/-jornadas$/)(d) && d.puntos >= 8 },
    { id: "j11", n: "La más vieja de la noche", d: "Apaga a la Esfinge (completa la jornada 11).", i: "🌑", m: "Travesía", s: d => cat(/-jornadas$/)(d) && d.puntos >= 11 },
    { id: "alba", n: "El alba", d: "Crúzate con el Alba y termina la travesía.", i: "🌅", m: "Travesía", s: d => cat(/-jornadas$/)(d) && d.puntos >= 13 },
    { id: "sf20", n: "Sigue", d: "Completa la jornada 20: la otra orilla, entre la seda.", i: "🪔", m: "La otra orilla", s: d => cat(/-jornadas$/)(d) && d.puntos >= 20 },
    { id: "sf30", n: "La noche no tiene fondo", d: "Completa la jornada 30: más allá de la Hoguera, en la travesía sin fin.", i: "🌌", m: "Sin fin", s: d => cat(/-jornadas$/)(d) && d.puntos >= 30 },
    { id: "p20k", n: "Brasas", d: "Haz 20 000 puntos en una travesía.", i: "🔥", m: "Puntos", s: d => cat(/-travesia$/)(d) && d.puntos >= 20000 },
    { id: "p60k", n: "Resonancia", d: "Haz 60 000 puntos en una travesía.", i: "🎐", m: "Puntos", s: d => cat(/-travesia$/)(d) && d.puntos >= 60000 },
    { id: "s100k", n: "Una luz que se ve de lejos", d: "Haz 100 000 puntos en la travesía sin fin.", i: "✨", m: "Puntos", s: d => cat(/-sinfin$/)(d) && d.puntos >= 100000 },
    { id: "s250k", n: "Nadie llega, algunas se cruzan", d: "Haz 250 000 puntos en la travesía sin fin.", i: "🌠", m: "Puntos", s: d => cat(/-sinfin$/)(d) && d.puntos >= 250000 }
  ],
  /* Atasco. Todos salen de club-atasco-estrellas (puntos = estrellas
     juntadas en todos los niveles, tres por nivel, 720 con los 240). */
  atasco: [
    { id: "e1", n: "Primera salida", d: "Saca el auto rojo por primera vez.", i: "🚗", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 1 },
    { id: "e30", n: "Licencia de conducir", d: "Junta 30 estrellas.", i: "🪪", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 30 },
    { id: "e60", n: "Bajando al subterráneo", d: "Junta 60 estrellas (las que abren el Subterráneo 1).", i: "🅿️", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 60 },
    { id: "e120", n: "Estacionado en paralelo", d: "Junta 120 estrellas.", i: "🚙", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 120 },
    { id: "e180", n: "Valet", d: "Junta 180 estrellas.", i: "🔑", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 180 },
    { id: "e270", n: "Hora punta", d: "Junta 270 estrellas.", i: "🚦", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 270 },
    { id: "e360", n: "Medio edificio", d: "Junta 360 estrellas, la mitad de todas.", i: "🏢", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 360 },
    { id: "e480", n: "Jefe de estacionamiento", d: "Junta 480 estrellas.", i: "🦺", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 480 },
    { id: "e600", n: "Sin un bocinazo", d: "Junta 600 estrellas.", i: "📯", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 600 },
    { id: "e720", n: "La bóveda abierta", d: "Junta las 720 estrellas: los 240 niveles con el mínimo de movidas.", i: "🏆", m: "Estrellas", s: d => cat(/-estrellas$/)(d) && d.puntos >= 720 }
  ],
  /* ALETEO. Todos salen de club-aleteo-vuelo (puntos = tubos pasados en
     el mejor vuelo); los umbrales de los cielos son los de lore.js. */
  aleteo: [
    { id: "t1", n: "Primer tubo", d: "Pasa tu primer tubo.", i: "🐣", m: "Vuelo", s: d => cat(/-vuelo$/)(d) && d.puntos >= 1 },
    { id: "t10", n: "Bronce", d: "Pasa 10 tubos en un vuelo.", i: "🥉", m: "Vuelo", s: d => cat(/-vuelo$/)(d) && d.puntos >= 10 },
    { id: "t15", n: "La bandada se adelantó", d: "Llega a la tarde (15 tubos).", i: "🌇", m: "Cielos", s: d => cat(/-vuelo$/)(d) && d.puntos >= 15 },
    { id: "t25", n: "Plata", d: "Pasa 25 tubos en un vuelo.", i: "🥈", m: "Vuelo", s: d => cat(/-vuelo$/)(d) && d.puntos >= 25 },
    { id: "t35", n: "Pájaros en los cables", d: "Llega al ocaso (35 tubos).", i: "🌆", m: "Cielos", s: d => cat(/-vuelo$/)(d) && d.puntos >= 35 },
    { id: "t50", n: "Oro", d: "Pasa 50 tubos en un vuelo.", i: "🥇", m: "Vuelo", s: d => cat(/-vuelo$/)(d) && d.puntos >= 50 },
    { id: "t60", n: "La luna no parpadea", d: "Llega a la noche (60 tubos).", i: "🌕", m: "Cielos", s: d => cat(/-vuelo$/)(d) && d.puntos >= 60 },
    { id: "t90", n: "Siempre fueron barrotes", d: "Llega a la jaula (90 tubos).", i: "⛓️", m: "Cielos", s: d => cat(/-vuelo$/)(d) && d.puntos >= 90 },
    { id: "t100", n: "Platino", d: "Pasa 100 tubos en un vuelo.", i: "💠", m: "Vuelo", s: d => cat(/-vuelo$/)(d) && d.puntos >= 100 },
    { id: "t130", n: "Bienvenido de vuelta", d: "Llega al vacío (130 tubos).", i: "🕳️", m: "Cielos", s: d => cat(/-vuelo$/)(d) && d.puntos >= 130 }
  ],
  /* 2048. Los de ficha salen de club-dosmil-ficha (puntos = la ficha más
     alta) y los de puntos de club-dosmil-puntos (el puntaje de la partida). */
  dosmil: [
    { id: "f256", n: "Primeros pasos", d: "Llega a la ficha 256.", i: "🟧", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 256 },
    { id: "f512", n: "Medio camino", d: "Llega a la ficha 512.", i: "🟠", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 512 },
    { id: "f1024", n: "Casi", d: "Llega a la ficha 1024.", i: "🔶", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 1024 },
    { id: "f2048", n: "¡2048!", d: "Llega a la ficha 2048.", i: "🟨", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 2048 },
    { id: "f4096", n: "Más allá", d: "Llega a la ficha 4096.", i: "🟪", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 4096 },
    { id: "f8192", n: "La ficha azul", d: "Llega a la ficha 8192.", i: "🟦", m: "Ficha", s: d => cat(/-ficha$/)(d) && d.puntos >= 8192 },
    { id: "p5k", n: "Calentando", d: "Haz 5 000 puntos en una partida.", i: "🔢", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 5000 },
    { id: "p20k", n: "Buena mano", d: "Haz 20 000 puntos en una partida.", i: "🧮", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 20000 },
    { id: "p50k", n: "Constructor", d: "Haz 50 000 puntos en una partida.", i: "🏗️", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 50000 },
    { id: "p100k", n: "Arquitecto", d: "Haz 100 000 puntos en una partida.", i: "🏛️", m: "Puntos", s: d => cat(/-puntos$/)(d) && d.puntos >= 100000 }
  ],
  /* Metro Rush. Los de puntos salen de club-metrorush-carrera (puntos de la
     mejor carrera: 1 000 000 es donde empieza la Estación Fantasma y
     10 000 000 el Fin de la Línea); los de distancia, de
     las de distancia (metros de la carrera más larga: club-metrorush-distancia
     la Línea 3, club-metrorush-citydistancia City). «Cazafantasmas» es el
     único que se escribe en vivo: el juego lo pide (Club.logro) cuando una
     carrera de un modo fantasma pasa al n.º 1 de la distancia. */
  metrorush: [
    { id: "c50k", n: "Primer andén", d: "Haz 50 000 puntos en una carrera.", i: "🚉", m: "Carrera", s: d => cat(/-carrera$/)(d) && d.puntos >= 50000 },
    { id: "c250k", n: "Hora punta", d: "Haz 250 000 puntos en una carrera.", i: "🚇", m: "Carrera", s: d => cat(/-carrera$/)(d) && d.puntos >= 250000 },
    { id: "c1m", n: "Estación Fantasma", d: "Haz 1 000 000 de puntos en una carrera.", i: "👻", m: "Carrera", s: d => cat(/-carrera$/)(d) && d.puntos >= 1000000 },
    { id: "c3m", n: "Expreso", d: "Haz 3 000 000 de puntos en una carrera.", i: "🚄", m: "Carrera", s: d => cat(/-carrera$/)(d) && d.puntos >= 3000000 },
    { id: "c10m", n: "Fin de la línea", d: "Haz 10 000 000 de puntos en una carrera.", i: "🛤️", m: "Carrera", s: d => cat(/-carrera$/)(d) && d.puntos >= 10000000 },
    { id: "d1k", n: "Primer kilómetro", d: "Recorre 1 000 m en una carrera.", i: "👟", m: "Distancia", s: d => cat(/-(city)?distancia$/)(d) && d.puntos >= 1000 },
    { id: "d5k", n: "Cinco mil", d: "Recorre 5 000 m en una carrera.", i: "🏃", m: "Distancia", s: d => cat(/-(city)?distancia$/)(d) && d.puntos >= 5000 },
    { id: "d10k", n: "Diez mil", d: "Recorre 10 000 m en una carrera.", i: "🎽", m: "Distancia", s: d => cat(/-(city)?distancia$/)(d) && d.puntos >= 10000 },
    { id: "d21k", n: "Media maratón", d: "Recorre 21 000 m en una carrera.", i: "🏅", m: "Distancia", s: d => cat(/-(city)?distancia$/)(d) && d.puntos >= 21000 },
    { id: "d42k", n: "Maratón sobre rieles", d: "Recorre 42 000 m en una carrera.", i: "🏆", m: "Distancia", s: d => cat(/-(city)?distancia$/)(d) && d.puntos >= 42000 },
    { id: "fan", n: "Cazafantasmas", d: "En un modo Fantasma, llega más lejos que el fantasma del récord.", i: "🔦", m: "Fantasma" }   // en vivo (sin `s`): lo escribe la página
  ]
};

/* El catálogo entero: juego → sus diez. */
export const LOGROS = Object.fromEntries([
  ...Object.entries(SALA).map(([j, l]) => [j, [...FILA, ...l]]),
  ...Object.entries(SOLO)
]);
/* Qué categorías de `soloRanks` alimentan cada juego individual. */
export const SOLO_PREFIJO = { minas: "club-minas-", snake: "club-snake-", tetrisclub: "club-tetris-", sortem: "club-sortem-", bbtan: "club-bbtan-", sopa: "club-sopa-", electro: "club-electro-", frontera: "club-frontera-", sudoku: "club-sudoku-", fanal: "club-fanal-", atasco: "club-atasco-", aleteo: "club-aleteo-", dosmil: "club-dosmil-", metrorush: "club-metrorush-" };

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
