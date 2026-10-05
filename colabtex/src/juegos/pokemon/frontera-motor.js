/* ============================================================
   Frontera Batalla: el motor.

   Las tres instalaciones de la Frontera de Pokémon Esmeralda que se
   juegan con combates individuales —la Torre, el Palacio y la Fábrica—
   sobre el mismo simulador de Showdown que los duelos de la sala. Aquí
   no hay rival humano ni registro compartido: el contrincante es una IA
   que corre en el mismo navegador, así que no hace falta el protocolo de
   promesas de `motor-pk.js`. Lo que sí se conserva es lo que lo hace
   comprobable: **todo sale de una semilla**. El equipo del rival, quién
   es, la semilla de Showdown y cada decisión de la IA se derivan de la
   semilla de la racha y del número de combate, así que un combate se
   rehace entero a partir de la semilla y de la lista de elecciones del
   jugador (`nuevaPelea({…, elecciones})`): eso es lo que se guarda para
   seguir un combate a medias.

   Cuatro decisiones:

   - **La dificultad sube por series de siete**, como en Esmeralda. La
     serie decide la franja de estadísticas base de los rivales
     (`FRANJAS`), sus IV (3, 6, 9… 21 y 31 desde la octava, la tabla del
     juego), cuánto de bien están armados (`dificultad`: de movimientos
     al azar sin EV ni objeto a STAB + cobertura + un movimiento de
     apoyo, naturaleza a medida, 252/252 y objeto) y lo lista que es la
     IA (`iq`). El séptimo de cada serie aprieta un poco más.
   - **Quién es el rival también sale de la serie**: entrenadores
     genéricos primero, luego Entrenadores Guay, líderes de gimnasio,
     rivales y protagonistas, el Alto Mando y los campeones. Los que
     tienen especialidad (Misty, Lectro, Dracón…) sacan su equipo de sus
     tipos. Los Ases de la Frontera aparecen donde en Esmeralda: Anabel
     en la Torre en los combates 35 (plata) y 70 (oro), Spenser en el
     Palacio y Noland en la Fábrica en el 21 y el 42.
   - **La IA no toca el azar del combate.** Estima el daño con la
     fórmula del juego sobre las estadísticas reales y elige con su
     propio generador, sembrado por combate y decisión. Usar
     `battle.actions.getDamage` habría consumido el PRNG de Showdown y la
     misma partida daría otro resultado al rehacerla.
   - **En el Palacio nadie elige**: cada Pokémon decide solo según su
     naturaleza y si le queda más o menos de la mitad de la vida
     (`PALACIO`, la tabla del Palacio Batalla de Esmeralda: probabilidad
     de usar un movimiento de ataque, de defensa o de apoyo). Ni el
     jugador ni el rival cambian por voluntad propia.
   ============================================================ */
import { Battle, Dex, Teams } from "@pkmn/sim";

/* ---------- azar propio ---------- */
export function hash32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function rng(semilla) {
  let a = typeof semilla === "number" ? semilla >>> 0 : hash32(semilla);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const elige = (r, arr) => arr[Math.floor(r() * arr.length)];
function baraja(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/* La semilla de Showdown: «sodium,» y 64 cifras hexadecimales. */
function semillaShowdown(s) {
  const r = rng("sd|" + s);
  let h = "";
  for (let i = 0; i < 8; i++) h += (Math.floor(r() * 4294967296) >>> 0).toString(16).padStart(8, "0");
  return "sodium," + h;
}

/* ---------- reglas ---------- */
export const INSTALACIONES = {
  torre: { n: "Torre Batalla", corto: "Torre", as: "anabel", cerebro: [35, 70] },
  palacio: { n: "Palacio Batalla", corto: "Palacio", as: "spenser", cerebro: [21, 42] },
  fabrica: { n: "Fábrica Batalla", corto: "Fábrica", as: "noland", cerebro: [21, 42] }
};
export const NIVELES = { 50: "Nivel 50", abierto: "Nivel Abierto" };
export const POR_SERIE = 7;
export const nivelDe = modo => (modo === "abierto" ? 100 : 50);
/* Sin Tera, un objeto de cada y una especie de cada; los niveles se
   ponen a mano en los sets (`Adjust Level` no llega a la pelea). */
export const FORMATO = "gen9customgame@@@Species Clause,Item Clause = 1,!Team Preview,Terastal Clause";

/* La serie (0, 1, 2…) del combate n (1, 2, 3…). */
export const serieDe = n => Math.floor((Math.max(1, n) - 1) / POR_SERIE);
export const esUltimo = n => Math.max(1, n) % POR_SERIE === 0;
/* 0 al principio, 1 desde la séptima serie. */
export function dificultad(n) {
  const s = serieDe(n), k = (Math.max(1, n) - 1) % POR_SERIE;
  return Math.max(0, Math.min(1, s / 6 + k / 60 + (esUltimo(n) ? 0.08 : 0)));
}
export const iqDe = n => Math.round((0.2 + 0.8 * dificultad(n)) * 100) / 100;
const IVS = [3, 6, 9, 12, 15, 18, 21, 31];
export const ivDe = n => IVS[Math.min(IVS.length - 1, serieDe(n))];
const FRANJAS = [[300, 420], [380, 470], [420, 500], [450, 535], [480, 560], [500, 600], [520, 680]];
export function franjaDe(n) {
  const i = Math.min(FRANJAS.length - 1, serieDe(n) + (esUltimo(n) && serieDe(n) > 0 ? 1 : 0));
  return FRANJAS[i];
}

/* Monedas de un combate ganado: crece con la racha. */
export const monedasCombate = n => 4 + 2 * Math.min(10, serieDe(n)) + (esUltimo(n) ? 10 : 0);

/* ---------- los rivales ---------- */
/* id: el sprite de entrenador de Showdown (se prueba id, id-gen3, id-gen4). */
const GENERICOS = [
  // serie 1
  [["youngster", "Joven"], ["lass", "Chica"], ["bugcatcher", "Cazabichos"], ["tuber", "Niño Flotador"], ["schoolkid", "Colegial"],
    ["camper", "Campista"], ["picnicker", "Excursionista"], ["fisherman", "Pescador"]],
  // serie 2
  [["hiker", "Montañero"], ["swimmer", "Nadador"], ["birdkeeper", "Ornitólogo"], ["pokefan", "Pokéfan"], ["kindler", "Pirómano"],
    ["guitarist", "Guitarrista"], ["sailor", "Marinero"], ["aromalady", "Dama Aroma"], ["richboy", "Niño Rico"], ["lady", "Dama"],
    ["ruinmaniac", "Ruinamaníaco"], ["collector", "Coleccionista"]],
  // serie 3
  [["blackbelt", "Karateka"], ["battlegirl", "Luchadora"], ["psychic", "Médium"], ["gentleman", "Caballero"], ["beauty", "Bella"],
    ["triathlete", "Triatleta"], ["pokemonbreeder", "Criapokémon"], ["pokemonranger", "Pokémon Ranger"], ["hexmaniac", "Brujeta"],
    ["ninjaboy", "Niño Ninja"], ["expert", "Experto"]],
  // serie 4
  [["acetrainer", "Entrenador Guay"], ["acetrainerf", "Entrenadora Guay"], ["veteran", "Veterano"], ["dragontamer", "Domadragón"],
    ["expert", "Experta"], ["pokemonranger", "Pokémon Ranger"]]
];
const NOMBRES = ["Álex", "Bea", "Carlos", "Dani", "Elena", "Fran", "Gabi", "Hugo", "Inés", "Javi", "Karla", "Leo", "Marta", "Nico",
  "Olga", "Pablo", "Quique", "Rosa", "Sergio", "Tere", "Úrsula", "Víctor", "Wendy", "Xavi", "Yago", "Zoe", "Lucía", "Mateo", "Sofía",
  "Diego", "Valentina", "Tomás", "Camila", "Benja", "Isidora", "Vicente", "Amanda", "Joaquín", "Florencia", "Matías"];
const LIDERES = [
  ["brock", "Brock", ["Rock", "Ground"]], ["misty", "Misty", ["Water"]], ["ltsurge", "Teniente Surge", ["Electric"]],
  ["erika", "Erika", ["Grass"]], ["koga", "Koga", ["Poison"]], ["sabrina", "Sabrina", ["Psychic"]], ["blaine", "Blaine", ["Fire"]],
  ["giovanni", "Giovanni", ["Ground"]], ["roxanne", "Petra", ["Rock"]], ["brawly", "Marcial", ["Fighting"]],
  ["wattson", "Erico", ["Electric"]], ["flannery", "Candela", ["Fire"]], ["norman", "Norman", ["Normal"]],
  ["winona", "Alana", ["Flying"]], ["juan", "Galano", ["Water"]], ["roark", "Roco", ["Rock"]], ["gardenia", "Gardenia", ["Grass"]],
  ["maylene", "Brega", ["Fighting"]], ["crasherwake", "Mananti", ["Water"]], ["fantina", "Fantina", ["Ghost"]],
  ["byron", "Acero", ["Steel"]], ["candice", "Inverna", ["Ice"]], ["volkner", "Lectro", ["Electric"]]
];
const RIVALES = [
  ["silver", "Plata", null], ["wally", "Blasco", null], ["barry", "Israel", null], ["cheren", "Cheren", null], ["bianca", "Bel", null],
  ["hop", "Paul", null], ["brendan", "Bruno", null], ["may", "Aura", null], ["ethan", "Eco", null], ["lyra", "Lira", null],
  ["lucas", "Lucas", null], ["dawn", "Maya", null], ["hilbert", "Lucho", null], ["hilda", "Liza", null]
];
const ALTO_MANDO = [
  ["lorelei", "Lorelei", ["Ice", "Water"]], ["bruno", "Bruno", ["Fighting", "Rock"]], ["agatha", "Agatha", ["Ghost", "Poison"]],
  ["will", "Mento", ["Psychic"]], ["karen", "Karen", ["Dark"]], ["sidney", "Sixto", ["Dark"]], ["phoebe", "Fátima", ["Ghost"]],
  ["glacia", "Nívea", ["Ice"]], ["drake", "Dracón", ["Dragon"]], ["aaron", "Alecrán", ["Bug"]], ["bertha", "Gaia", ["Ground"]],
  ["flint", "Fausto", ["Fire"]], ["lucian", "Delos", ["Psychic"]]
];
const CAMPEONES = [
  ["lance", "Lance", ["Dragon"]], ["blue", "Azul", null], ["red", "Rojo", null], ["steven", "Máximo", ["Steel", "Rock"]],
  ["wallace", "Plubio", ["Water"]], ["cynthia", "Cynthia", null], ["alder", "Mirto", null], ["iris", "Iris", ["Dragon"]],
  ["diantha", "Dianta", null], ["leon", "Lionel", null], ["geeta", "Ságita", null], ["nemona", "Mencía", null]
];
const CLASE = { lider: "Líder de Gimnasio", rival: "Entrenador", alto: "Alto Mando", campeon: "Campeón", as: "As de la Frontera" };
const ASES = {
  anabel: { id: "anabel", nombre: "Anabel", clase: "As de la Torre",
    plata: ["Alakazam", "Entei", "Snorlax"], oro: ["Raikou", "Latios", "Snorlax"] },
  spenser: { id: "spenser", nombre: "Spenser", clase: "As del Palacio",
    plata: ["Crobat", "Slaking", "Lapras"], oro: ["Arcanine", "Slaking", "Suicune"] },
  noland: { id: "noland", nombre: "Noland", clase: "As de la Fábrica", plata: null, oro: null }
};

/* Quién te espera en el combate n de una racha. Determinista. */
export function rivalDe(inst, n, semilla) {
  const r = rng(`rival|${semilla}|${n}`);
  const I = INSTALACIONES[inst] || INSTALACIONES.torre;
  const k = I.cerebro.indexOf(n);
  if (k >= 0) {
    const A = ASES[I.as];
    return { id: A.id, nombre: A.nombre, clase: A.clase, tipos: null, as: k === 0 ? "plata" : "oro", especies: A[k === 0 ? "plata" : "oro"] };
  }
  const s = serieDe(n);
  const nombrado = (lista, clase) => { const [id, nombre, tipos] = elige(r, lista); return { id, nombre, clase: CLASE[clase], tipos }; };
  if (s >= 3 && esUltimo(n)) return nombrado(s >= 5 ? CAMPEONES : ALTO_MANDO, s >= 5 ? "campeon" : "alto");
  const generico = i => { const [id, clase] = elige(r, GENERICOS[i]); return { id, nombre: elige(r, NOMBRES), clase, tipos: null }; };
  const x = r();
  if (s === 0) return generico(0);
  if (s === 1) return generico(1);
  if (s === 2) return x < 0.8 ? generico(2) : generico(3);
  if (s === 3) return x < 0.55 ? generico(3) : nombrado(LIDERES, "lider");
  if (s === 4) return x < 0.5 ? nombrado(LIDERES, "lider") : x < 0.85 ? nombrado(RIVALES, "rival") : generico(3);
  if (s === 5) return x < 0.35 ? nombrado(RIVALES, "rival") : x < 0.85 ? nombrado(ALTO_MANDO, "alto") : nombrado(LIDERES, "lider");
  return x < 0.45 ? nombrado(ALTO_MANDO, "alto") : x < 0.8 ? nombrado(CAMPEONES, "campeon") : nombrado(RIVALES, "rival");
}

/* ---------- las especies y sus movimientos ---------- */
let D = null;
const dex = () => D || (D = Dex.forFormat(Dex.formats.get("gen9customgame")));
export const prohibida = s => !!(s && (s.tags || []).some(t => t === "Restricted Legendary" || t === "Mythical"));
let POOL = null;
function pool() {
  if (POOL) return POOL;
  const d = dex();
  POOL = d.species.all().filter(s => s.exists && (!s.isNonstandard || s.isNonstandard === "Past") && !s.battleOnly &&
    !s.requiredItem && !s.requiredAbility && !s.isMega && !s.isGigantamax && !s.isPrimal &&
    /^(Alola|Galar|Hisui|Paldea.*)?$/.test(s.forme || "") && !prohibida(s) && s.id !== "shedinja" &&
    movimientosDe(s.name).length >= 4);
  return POOL;
}
const movCache = new Map();
function movimientosDe(especie) {
  if (movCache.has(especie)) return movCache.get(especie);
  const d = dex();
  let x = d.species.get(especie);
  const ids = new Set(), vistos = new Set();
  while (x && x.exists && !vistos.has(x.id)) {
    vistos.add(x.id);
    const ls = d.data.Learnsets[x.id] && d.data.Learnsets[x.id].learnset;
    if (ls) for (const m of Object.keys(ls)) ids.add(m);
    const sig = x.changesFrom || (x.baseSpecies !== x.name && x.baseSpecies) || x.prevo;
    x = sig ? d.species.get(sig) : null;
  }
  const out = [...ids].map(m => d.moves.get(m)).filter(m => m.exists && (!m.isNonstandard || m.isNonstandard === "Past") &&
    !m.isZ && !m.isMax && !m.ohko && !m.selfdestruct && !m.realMove && m.id !== "struggle" && !/^hiddenpower/.test(m.id) &&
    !["focuspunch", "lastresort", "belch", "dreameater", "snore", "sleeptalk", "transform", "naturalgift", "fling", "present",
      "steelroller", "synchronoise", "skydrop", "doomdesire", "futuresight", "bide", "counter", "mirrorcoat", "metalburst",
      "perishsong", "curse", "teleport", "splash", "celebrate", "holdhands", "happyhour", "afteryou", "allyswitch",
      "helpinghand", "followme", "ragepowder", "spotlight", "quash", "instruct", "aromaticmist", "frustration", "return",
      "magiccoat", "snatch", "mimic", "sketch", "conversion", "conversion2", "beatup", "spitup", "swallow", "stockpile"].includes(m.id));
  movCache.set(especie, out);
  return out;
}

const SETUP = new Set(["swordsdance", "nastyplot", "dragondance", "calmmind", "bulkup", "quiverdance", "shellsmash", "agility",
  "coil", "shiftgear", "workup", "honeclaws", "victorydance", "tidyup", "rockpolish", "irondefense", "amnesia", "cosmicpower"]);
const CURA = new Set(["recover", "roost", "slackoff", "softboiled", "moonlight", "synthesis", "morningsun", "milkdrink",
  "shoreup", "healorder", "rest", "strengthsap", "junglehealing", "lunarblessing"]);
const ESTADO = new Set(["willowisp", "thunderwave", "toxic", "spore", "sleeppowder", "hypnosis", "yawn", "glare", "stunspore",
  "nuzzle", "lovelykiss", "darkvoid", "sing", "grasswhistle", "poisonpowder", "toxicthread"]);
const TRAMPAS = new Set(["stealthrock", "spikes", "toxicspikes", "stickyweb"]);
const PROTEGE = new Set(["protect", "detect", "kingsshield", "spikyshield", "banefulbunker", "silktrap", "burningbulwark"]);

/* Lo que un movimiento de daño vale para una especie, sin rival delante. */
function valorMov(sp, m) {
  if (m.category === "Status") return 0;
  let bp = m.basePower || (m.damage ? 60 : 50);
  if (Array.isArray(m.multihit)) bp *= m.multihit[0] === 2 && m.multihit[1] === 5 ? 3 : (m.multihit[0] + m.multihit[1]) / 2;
  else if (typeof m.multihit === "number") bp *= m.multihit;
  const acc = m.accuracy === true ? 1 : m.accuracy / 100;
  const stab = sp.types.includes(m.type) ? 1.5 : 1;
  const st = sp.baseStats;
  const ofe = m.category === "Physical" ? st.atk : st.spa;
  let v = bp * acc * stab * (ofe / 100);
  if (m.flags && m.flags.charge) v *= 0.45;
  if (m.flags && m.flags.recharge) v *= 0.55;
  if (m.self && m.self.boosts && Object.values(m.self.boosts).some(x => x < -1)) v *= 0.85;
  if (m.recoil) v *= 0.92;
  if (m.priority > 0) v *= 1.05;
  return v;
}

/* Un equipo de `cuantos` Pokémon para el combate n. `o.tipos` lo
   orienta a una especialidad; `o.especies` lo fija (los Ases). */
export function generaEquipo(n, semilla, o = {}) {
  const r = rng(`equipo|${semilla}|${n}|${o.sal || ""}`);
  const nivel = o.nivel || 50;
  const dif = o.dif != null ? o.dif : dificultad(n);
  const cuantos = o.cuantos || 3;
  const iv = o.iv != null ? o.iv : ivDe(n);
  const d = dex();
  let especies;
  if (o.especies) especies = o.especies.map(e => d.species.get(e));
  else {
    const [lo, hi] = o.franja || franjaDe(n);
    const P = pool();
    const filtra = (a, b, tipos, maduro) => P.filter(s => s.bst >= a && s.bst <= b && (!maduro || !s.nfe) &&
      (!tipos || s.types.some(t => tipos.includes(t))));
    const maduro = dif >= 0.5;
    let cand = filtra(lo, hi, o.tipos, maduro);
    if (cand.length < cuantos * 2) cand = filtra(lo - 60, hi + 60, o.tipos, maduro);
    if (cand.length < cuantos * 2) cand = filtra(lo - 120, hi + 120, o.tipos, false);
    if (cand.length < cuantos * 2) cand = filtra(lo, hi, null, maduro);
    especies = [];
    const base = new Set(o.evita || []);
    for (const s of baraja(r, cand)) {
      if (especies.length >= cuantos) break;
      if (base.has(s.baseSpecies)) continue;
      base.add(s.baseSpecies);
      especies.push(s);
    }
  }
  const objetos = new Set();
  return especies.map(sp => armaSet(sp, { r, dif, nivel, iv, objetos }));
}

const NATURALEZAS = ["Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax", "Timid",
  "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash", "Calm", "Gentle", "Sassy", "Careful", "Quirky"];

function armaSet(sp, { r, dif, nivel, iv, objetos }) {
  const movs = movimientosDe(sp.name);
  const fisico = sp.baseStats.atk >= sp.baseStats.spa;
  const buena = () => r() < dif;
  // Movimientos: con dificultad alta, el mejor STAB de cada tipo, luego
  // cobertura y uno de apoyo; con baja, lo primero que salga.
  const elegidos = [];
  const usados = new Set();
  const pon = m => { if (m && !usados.has(m.id) && elegidos.length < 4) { usados.add(m.id); elegidos.push(m); } };
  const daño = movs.filter(m => m.category !== "Status").map(m => ({ m, v: valorMov(sp, m) })).sort((a, b) => b.v - a.v);
  const deTipo = t => daño.find(x => x.m.type === t && (x.m.category === "Physical") === fisico) || daño.find(x => x.m.type === t);
  if (buena()) for (const t of sp.types) { const x = deTipo(t); if (x) pon(x.m); }
  if (buena()) {
    const apoyo = movs.filter(m => SETUP.has(m.id) && (m.id !== "swordsdance" && m.id !== "bulkup" && m.id !== "dragondance" || fisico) &&
      (m.id !== "nastyplot" && m.id !== "calmmind" && m.id !== "quiverdance" || !fisico) ||
      CURA.has(m.id) && m.id !== "rest" || ESTADO.has(m.id) || TRAMPAS.has(m.id));
    if (apoyo.length) pon(elige(r, apoyo));
  }
  const tipos = new Set(elegidos.map(m => m.type));
  for (const x of daño) {
    if (elegidos.length >= 4) break;
    if (!buena()) continue;
    if (tipos.has(x.m.type)) continue;
    if (x.m.category !== "Physical" && fisico && sp.baseStats.atk > sp.baseStats.spa * 1.2) continue;
    if (x.m.category === "Physical" && !fisico && sp.baseStats.spa > sp.baseStats.atk * 1.2) continue;
    tipos.add(x.m.type); pon(x.m);
  }
  const resto = baraja(r, movs);
  // Lo flojo pesa más cuanto más fácil: un Joven no trae Terremoto.
  const flojos = resto.filter(m => m.category === "Status" ? !PROTEGE.has(m.id) : (m.basePower || 0) <= 70);
  for (const m of (dif < 0.5 ? flojos.concat(resto) : resto)) {
    if (elegidos.length >= 4) break;
    if (m.category === "Status" && elegidos.filter(x => x.category === "Status").length >= (dif > 0.6 ? 1 : 2)) continue;
    pon(m);
  }
  if (!elegidos.some(m => m.category !== "Status") && daño.length) elegidos[elegidos.length - 1] = daño[0].m;

  const habs = Object.values(sp.abilities).filter(Boolean).map(a => dex().abilities.get(a)).filter(a => a.exists);
  const hab = buena() ? habs.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] : elige(r, habs);

  let nature;
  if (buena()) {
    const rapido = sp.baseStats.spe >= 75;
    nature = fisico ? (rapido ? "Jolly" : "Adamant") : (rapido ? "Timid" : "Modest");
  } else nature = elige(r, NATURALEZAS);

  const total = Math.round(510 * dif / 4) * 4;
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (total >= 400) {
    evs[fisico ? "atk" : "spa"] = 252;
    evs[sp.baseStats.spe >= 60 ? "spe" : "hp"] = 252;
    evs[sp.baseStats.spe >= 60 ? "hp" : "spd"] = 4;
  } else {
    const reparto = [fisico ? "atk" : "spa", "spe", "hp", "def", "spd"];
    let quedan = total;
    for (const st of reparto) { const v = Math.min(quedan, 84); evs[st] = v; quedan -= v; if (quedan <= 0) break; }
  }

  const todosDaño = elegidos.every(m => m.category !== "Status");
  let item = "";
  if (dif < 0.25) item = r() < 0.4 ? "Oran Berry" : "";
  else if (dif < 0.55) item = elige(r, ["Sitrus Berry", "Leftovers", "Quick Claw", "Bright Powder", "King's Rock", "Shell Bell", "Lum Berry", ""]);
  else {
    const op = [];
    if (todosDaño) op.push(fisico ? "Choice Band" : "Choice Specs", "Choice Scarf", "Assault Vest", "Expert Belt");
    op.push("Life Orb", "Leftovers", "Focus Sash", "Lum Berry", "Sitrus Berry", "Expert Belt", "Shell Bell");
    item = baraja(r, op).find(x => !objetos.has(x)) || "";
  }
  /* Un objeto de cada en todo el equipo, también en los de alquiler:
     de seis se eligen tres y la cláusula de objetos se aplica igual. */
  if (item && objetos.has(item)) item = "";
  if (item) objetos.add(item);

  return {
    name: "", species: sp.name, item, ability: hab ? hab.name : "",
    moves: elegidos.map(m => m.name), nature, evs,
    ivs: { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv },
    level: nivel, gender: "", shiny: r() < 1 / 512
  };
}

/* El equipo del rival del combate n. */
export function equipoRival(inst, nivelModo, n, semilla) {
  const R = rivalDe(inst, n, semilla);
  const nivel = nivelDe(nivelModo);
  if (R.especies) return { rival: R, sets: generaEquipo(n, semilla, { nivel, especies: R.especies, dif: 1, iv: 31 }) };
  const dif = R.as ? 1 : dificultad(n);
  return { rival: R, sets: generaEquipo(n, semilla, { nivel, tipos: R.tipos, dif, franja: R.as ? FRANJAS[6] : undefined }) };
}

/* Los seis de alquiler de la Fábrica al empezar la serie de n. */
export function alquiler(n, semilla, nivelModo) {
  const d = Math.max(0.35, dificultad(n));
  return generaEquipo(n, semilla, { nivel: nivelDe(nivelModo), cuantos: 6, dif: d, iv: Math.max(15, ivDe(n)), sal: "alquiler" });
}

/* Lo que un equipo guardado tiene que cumplir aquí. [] si vale. */
export function validaFrontera(sets) {
  const d = dex();
  const err = [];
  if (!Array.isArray(sets) || sets.length !== 3) err.push("Hacen falta exactamente tres Pokémon.");
  const especies = new Set(), objetos = new Set();
  for (const s of sets || []) {
    const sp = d.species.get(s.species);
    if (!sp.exists) { err.push(`«${s.species}» no existe.`); continue; }
    if (prohibida(sp)) err.push(`${sp.name} no se admite en la Frontera (legendario mayor o singular).`);
    if (especies.has(sp.baseSpecies)) err.push(`${sp.baseSpecies} está repetido.`);
    especies.add(sp.baseSpecies);
    if (s.item) {
      const it = d.items.get(s.item);
      if (objetos.has(it.id)) err.push(`${it.name || s.item} está repetido: un objeto de cada.`);
      objetos.add(it.id);
      if (it.megaStone || it.zMove) err.push(`${it.name} no sirve aquí (sin Mega ni movimientos Z).`);
    }
    if (!s.moves || !s.moves.length) err.push(`${sp.name} no tiene movimientos.`);
    /* El formato libre del simulador admite hasta 24; el juego, cuatro.
       Un set con más solo sale de un texto escrito a mano, y en la
       Frontera daría un Pokémon con más opciones que cualquier rival. */
    else if (s.moves.length > 4) err.push(`${sp.name} tiene más de cuatro movimientos.`);
  }
  return err;
}
/* Lleva unos sets al nivel de la instalación, sin Tera. */
export const aNivel = (sets, nivelModo) => sets.map(s => ({ ...s, level: nivelDe(nivelModo), teraType: undefined }));

/* ---------- la IA ---------- */
const necesita = side => !!side && !!side.activeRequest && !side.activeRequest.wait && side.requestState !== "";
const ABSORBE = { levitate: "Ground", flashfire: "Fire", waterabsorb: "Water", stormdrain: "Water", dryskin: "Water",
  voltabsorb: "Electric", lightningrod: "Electric", motordrive: "Electric", sapsipper: "Grass", eartheater: "Ground",
  wellbakedbody: "Fire" };

function eficacia(B, tipo, def) {
  const tipos = def.getTypes();
  if (!B.dex.getImmunity(tipo, tipos)) return 0;
  if (ABSORBE[def.ability] === tipo) return 0;
  if (tipo === "Ground" && def.item === "airballoon") return 0;
  return Math.pow(2, B.dex.getEffectiveness(tipo, tipos));
}
/* Fracción de la vida máxima del defensor que quita, sin azar. */
function dañoEstimado(B, at, def, m) {
  if (!m || m.category === "Status" || !def || !at) return 0;
  const ef = eficacia(B, m.type, def);
  if (!ef) return 0;
  if (m.damage === "level") return at.level / def.maxhp;
  if (typeof m.damage === "number") return m.damage / def.maxhp;
  let bp = m.basePower || 60;
  if (Array.isArray(m.multihit)) bp *= m.multihit[0] === 2 && m.multihit[1] === 5 ? 3 : (m.multihit[0] + m.multihit[1]) / 2;
  else if (typeof m.multihit === "number") bp *= m.multihit;
  const fis = m.category === "Physical";
  const A = Math.max(1, at.getStat(fis ? "atk" : "spa", false, true)), De = Math.max(1, def.getStat(fis ? "def" : "spd", false, true));
  const stab = at.getTypes().includes(m.type) ? 1.5 : 1;
  let x = (Math.floor(Math.floor(2 * at.level / 5 + 2) * bp * A / De) / 50 + 2) * stab * ef * 0.92;
  if (fis && at.status === "brn" && at.ability !== "guts") x *= 0.5;
  return x / def.maxhp;
}
function valorEnCombate(B, at, def, m) {
  const f = dañoEstimado(B, at, def, m);
  if (!f) return 0;
  const acc = m.accuracy === true ? 1 : m.accuracy / 100;
  const vida = def.hp / def.maxhp;
  let v = Math.min(f, vida) * acc;
  if (f >= vida) v += 0.5 * acc + (m.priority > 0 ? 0.4 : 0);
  if (m.flags && m.flags.charge && !(m.id === "solarbeam" && /sun/.test(B.field.weather))) v *= 0.5;
  if (m.flags && m.flags.recharge) v *= 0.6;
  return v;
}
function valorEstado(B, at, def, m, mejor) {
  const id = m.id, vida = at.hp / at.maxhp;
  if (SETUP.has(id)) {
    const suma = Object.values(at.boosts).reduce((a, b) => a + Math.max(0, b), 0);
    return vida > 0.6 && suma < 3 ? Math.max(0.25, mejor * 1.1) : 0.02;
  }
  if (CURA.has(id) || m.heal) return vida < 0.45 ? Math.max(0.4, mejor * 1.3) : vida < 0.7 ? 0.15 : 0.01;
  if (m.status) {
    if (!def || def.status || (def.side.sideConditions.safeguard)) return 0.01;
    if (m.status === "par" && (def.hasType("Electric") || m.type === "Electric" && !eficacia(B, "Electric", def))) return 0.01;
    if ((m.status === "psn" || m.status === "tox") && (def.hasType("Poison") || def.hasType("Steel"))) return 0.01;
    if (m.status === "brn" && def.hasType("Fire")) return 0.01;
    if (m.flags && m.flags.powder && def.hasType("Grass")) return 0.01;
    return Math.max(0.2, mejor * (m.status === "slp" ? 1.05 : 0.8));
  }
  if (m.sideCondition && TRAMPAS.has(id)) return def && !def.side.sideConditions[id] ? Math.max(0.15, mejor * 0.6) : 0.01;
  if (PROTEGE.has(id)) return 0.05;
  if (m.boosts && m.target !== "self") return 0.08;
  return 0.06;
}

/* Los movimientos y cambios de un lado con su nota. */
function opcionesIA(B, lado) {
  const side = B.sides[lado], req = side.activeRequest;
  const at = side.active[0], def = B.sides[1 - lado].active[0];
  const out = [];
  const cambios = side.pokemon.map((p, i) => ({ p, i })).filter(({ p }) => !p.isActive && !p.fainted);
  if (req.forceSwitch) {
    for (const { p, i } of cambios) out.push({ c: "switch " + (i + 1), s: emparejamiento(B, p, def), cambio: true });
    return out;
  }
  const a = req.active && req.active[0];
  if (!a) return out;
  const movs = a.moves.map((m, i) => ({ m: B.dex.moves.get(m.id), i, dis: m.disabled }));
  const vivoDef = def && !def.fainted ? def : null;
  const mejor = Math.max(0, ...movs.filter(x => !x.dis).map(x => valorEnCombate(B, at, vivoDef, x.m)));
  for (const x of movs) {
    if (x.dis) continue;
    const s = x.m.category === "Status" ? valorEstado(B, at, vivoDef, x.m, mejor) : valorEnCombate(B, at, vivoDef, x.m);
    out.push({ c: "move " + (x.i + 1), s, mov: true });
  }
  if (!a.trapped && !a.maybeTrapped) for (const { p, i } of cambios) out.push({ c: "switch " + (i + 1), s: emparejamiento(B, p, def) - 0.25, cambio: true });
  return out;
}
/* Cuánto mejor le va a `p` contra `def`: lo que le haría menos lo que recibiría. */
function emparejamiento(B, p, def) {
  if (!def || def.fainted) return p.hp / p.maxhp;
  const suyo = Math.max(0, ...p.moveSlots.map(s => dañoEstimado(B, p, def, B.dex.moves.get(s.id))));
  const recibe = Math.max(0, ...def.moveSlots.map(s => dañoEstimado(B, def, p, B.dex.moves.get(s.id))));
  return Math.min(1, suyo) - Math.min(1, recibe) * 0.8 + 0.2 * p.hp / p.maxhp;
}

/* La elección de la IA: con probabilidad `iq` la mejor nota; si no, una
   al azar con más peso a lo que pega. Solo cambia por gusto con iq alta. */
export function decideIA(B, lado, iq, r) {
  const side = B.sides[lado], req = side.activeRequest;
  if (!req || req.wait) return "default";
  if (req.teamPreview) return "default";
  let ops = opcionesIA(B, lado);
  if (!ops.length) return "default";
  if (!req.forceSwitch) {
    const movs = ops.filter(o => o.mov);
    const mejorMov = Math.max(0, ...movs.map(o => o.s));
    const cambio = ops.filter(o => o.cambio).sort((a, b) => b.s - a.s)[0];
    const at = side.active[0];
    const quedarse = iq >= 0.7 && cambio && mejorMov < 0.12 && cambio.s > 0.35 && at.hp / at.maxhp > 0.4 && r() < 0.6;
    if (!quedarse) ops = movs.length ? movs : ops;
    else return cambio.c;
  }
  ops.sort((a, b) => b.s - a.s);
  if (r() < iq) return ops[0].c;
  const pesos = ops.map(o => 0.15 + Math.max(0, o.s));
  let t = r() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ops.length; i++) { t -= pesos[i]; if (t <= 0) return ops[i].c; }
  return ops[0].c;
}

/* --- el Palacio ---
   % de usar un movimiento de ataque / defensa / apoyo, con la vida por
   encima y por debajo de la mitad. */
export const PALACIO = {
  Hardy: [[61, 7, 32], [61, 7, 32]], Lonely: [[20, 25, 55], [84, 8, 8]], Brave: [[70, 15, 15], [32, 60, 8]],
  Adamant: [[38, 31, 31], [70, 15, 15]], Naughty: [[20, 70, 10], [70, 22, 8]], Bold: [[30, 20, 50], [32, 58, 10]],
  Docile: [[56, 22, 22], [56, 22, 22]], Relaxed: [[25, 15, 60], [75, 15, 10]], Impish: [[69, 6, 25], [28, 55, 17]],
  Lax: [[35, 10, 55], [29, 6, 65]], Timid: [[62, 10, 28], [30, 20, 50]], Hasty: [[58, 37, 5], [88, 6, 6]],
  Serious: [[34, 11, 55], [29, 11, 60]], Jolly: [[35, 5, 60], [35, 60, 5]], Naive: [[56, 22, 22], [56, 22, 22]],
  Modest: [[35, 45, 20], [34, 60, 6]], Mild: [[44, 50, 6], [34, 6, 60]], Quiet: [[56, 22, 22], [56, 22, 22]],
  Bashful: [[30, 58, 12], [30, 58, 12]], Rash: [[30, 13, 57], [27, 6, 67]], Calm: [[40, 50, 10], [25, 62, 13]],
  Gentle: [[18, 70, 12], [90, 5, 5]], Sassy: [[88, 6, 6], [22, 20, 58]], Careful: [[42, 50, 8], [42, 5, 53]],
  Quirky: [[56, 22, 22], [58, 37, 5]]
};
/* 0 ataque, 1 defensa (estado sobre uno mismo o su lado), 2 apoyo. */
export function claseMov(m) {
  if (m.category !== "Status") return 0;
  if (m.target === "self" || m.target === "allySide" || m.target === "allies" || m.target === "adjacentAllyOrSelf") return 1;
  return 2;
}
export function decidePalacio(B, lado, r) {
  const side = B.sides[lado], req = side.activeRequest;
  if (!req || req.wait || req.teamPreview) return "default";
  if (req.forceSwitch) {
    // Sale el siguiente del orden, como en el juego.
    const i = side.pokemon.findIndex(p => !p.isActive && !p.fainted);
    return i >= 0 ? "switch " + (i + 1) : "default";
  }
  const a = req.active && req.active[0];
  if (!a) return "default";
  const at = side.active[0];
  const tabla = PALACIO[at.set.nature] || PALACIO.Hardy;
  const [pa, pd] = tabla[at.hp * 2 > at.maxhp ? 0 : 1];
  const x = r() * 100;
  const clase = x < pa ? 0 : x < pa + pd ? 1 : 2;
  const movs = a.moves.map((m, i) => ({ i, m: B.dex.moves.get(m.id), dis: m.disabled })).filter(o => !o.dis);
  if (!movs.length) return "default";
  const de = movs.filter(o => claseMov(o.m) === clase);
  return "move " + (elige(r, de.length ? de : movs).i + 1);
}

/* ---------- un combate ---------- */
export function nuevaPelea(o) {
  const { semilla, sets, nombres: nom0, skins = ["", ""], lados = ["tú", "cpu"], iq = 1, palacio = false } = o;
  const nombres = nom0.slice();
  if (nombres[0] === nombres[1]) nombres[1] += " (rival)";
  const B = new Battle({ formatid: FORMATO, seed: semillaShowdown(semilla) });
  B.setPlayer("p1", { name: nombres[0], avatar: "", team: Teams.pack(sets[0]) });
  B.setPlayer("p2", { name: nombres[1], avatar: "", team: Teams.pack(sets[1]) });
  const elecciones = [];
  let punto = 0, rendido = false;

  const r = lado => rng(`ia|${semilla}|${punto}|${lado}`);
  const decide = lado => (palacio ? decidePalacio(B, lado, r(lado)) : decideIA(B, lado, lado === 1 ? iq : 1, r(lado)));
  const aplica = (lado, c) => {
    const side = B.sides[lado];
    if (!B.choose(side.id, c)) { side.clearChoice(); B.choose(side.id, "default"); }
  };
  function avanza() {
    let guarda = 0;
    while (!B.ended && guarda++ < 4000) {
      if (necesita(B.sides[0])) {
        if (!palacio) return;
        aplica(0, decide(0));
        if (necesita(B.sides[1])) aplica(1, decide(1));
        punto++;
        continue;
      }
      if (necesita(B.sides[1])) { aplica(1, decide(1)); punto++; continue; }
      return;
    }
  }
  function eligeJugador(c) {
    if (B.ended || rendido || palacio || !necesita(B.sides[0])) return false;
    elecciones.push(String(c));
    aplica(0, String(c));
    if (necesita(B.sides[1])) aplica(1, decide(1));
    punto++;
    avanza();
    return true;
  }
  avanza();
  for (const c of o.elecciones || []) {
    if (c === "!rinde") { rendido = true; elecciones.push(c); break; }
    eligeJugador(c);
  }

  function est() {
    const acabado = B.ended || rendido;
    let ganador = null, motivo = "";
    if (rendido) { ganador = lados[1]; motivo = "rinde"; }
    else if (B.ended) {
      ganador = B.winner === nombres[0] ? lados[0] : B.winner === nombres[1] ? lados[1] : "";
      motivo = ganador === "" ? "empate" : "ko";
    }
    const decide = {};
    decide[lados[0]] = !acabado && !palacio && necesita(B.sides[0]);
    decide[lados[1]] = false;
    return {
      fase: acabado ? "fin" : "jugando", punto, formato: FORMATO,
      lados: lados.slice(), nombres: nombres.slice(),
      prometido: {}, revelado: {}, decide, debe: decide[lados[0]] ? [lados[0]] : [],
      peticion: [B.sides[0].activeRequest || null, B.sides[1].activeRequest || null],
      battle: B, log: B.log, turno: "", ronda: B.turn,
      equipos: {}, skins: { [lados[0]]: skins[0], [lados[1]]: skins[1] },
      invalidos: {}, falsas: {}, resumen: [],
      ganador: acabado ? ganador : null, motivo,
      vivos: B.sides.map(s => s.pokemonLeft)
    };
  }
  return {
    battle: B, elecciones,
    elige: eligeJugador,
    rinde() { if (!B.ended && !rendido) { rendido = true; elecciones.push("!rinde"); } },
    est
  };
}

/* ---------- la prueba de una marca (antitrampas) ----------
   Una marca de la Frontera no se cree: se rehace (ver
   docs/antitrampas/frontera.md). Como todo sale de la semilla, una
   victoria se describe con lo que el jugador puso de su parte —el
   equipo y sus elecciones— y cualquiera la vuelve a jugar aquí con el
   mismo resultado. Este bloque arma esas pruebas (lo usa la pantalla) y
   las comprueba (lo usa el verificador del club, en un Worker con su
   propia copia de este motor): uno solo para los dos, así nunca dicen
   cosas distintas.

   - **Racha** (`club-frontera-<inst>-<nivel>`): la semilla, el equipo
     del que se partió (el empaquetado de Showdown en la Torre y el
     Palacio; los tres índices del alquiler en la Fábrica) y, por cada
     combate ganado, `[o, elecciones, cambio, toques]`. Se rehacen todos
     y todos tienen que ganarse.
   - **Victorias** (`club-frontera-victorias`, acumulado de todas las
     rachas): no cabe la historia entera, así que la prueba trae solo
     las victorias que aún no estaban en la tabla, sobre la fila que la
     pantalla leyó de la base (`b` puntos y `h`, la última victoria
     contada). Cada victoria lleva su **ordinal** `o`, que entra en la
     semilla del combate: una victoria vieja no se puede volver a contar
     (su ordinal no pasa de `h`), y ponerle otro ordinal es otro combate,
     que hay que volver a ganar.
   - **Toques**: por cada elección, cuánto tardó desde la anterior (o
     desde que se abrió el combate) y si el clic fue de una persona
     (`isTrusted`), de un mando (los clics sintéticos de mando.js con un
     mando conectado) o de un script. Una partida rehecha que se gana
     no basta: un bot que simula los combates también las gana. */
export const PRUEBA_FRONTERA = 1;
export const MIN_COMBATE_MS = 1000;   // `cierraPelea` nunca cuenta menos por combate
export const TOPE_LIBRO = 300;        // victorias por prueba (rehacer cada una cuesta)
const TOPE_TIEMPO = 604800000;        // el tope de `tiempo` en las reglas
const SEMILLA_RE = /^[0-9a-f]{12}$/;
const CLAVE_RE = /^(torre|palacio|fabrica)-(50|abierto)$/;

/* La semilla de Showdown y de la IA del combate n. Los combates de
   antes de la prueba no tenían ordinal (o = 0). */
export const semillaPelea = (semilla, n, o) => (o ? `${semilla}|${n}|${o}` : `${semilla}|${n}`);

/* Las elecciones, compactas: «move 3» → "3", «switch 2» → "b". Lo que
   no encaje (no debería haber nada más en la Frontera) va tal cual. */
const CAMBIOS = "abcdef";
export function codificaElecciones(lista) {
  let t = "";
  for (const c of lista || []) {
    const m = /^move ([1-9])$/.exec(c), s = /^switch ([1-6])$/.exec(c);
    if (m) t += m[1];
    else if (s) t += CAMBIOS[+s[1] - 1];
    else return (lista || []).map(String);
  }
  return t;
}
export function decodificaElecciones(c) {
  if (Array.isArray(c)) return c.length <= 4000 && c.every(x => typeof x === "string" && x.length <= 40) ? c.slice() : null;
  if (typeof c !== "string" || c.length > 4000) return null;
  const out = [];
  for (const ch of c) {
    if (ch >= "1" && ch <= "9") { out.push("move " + ch); continue; }
    const i = CAMBIOS.indexOf(ch);
    if (i < 0) return null;
    out.push("switch " + (i + 1));
  }
  return out;
}

/* Un toque: el intervalo en centésimas, en base 36, con "!" delante si
   el clic no fue de una persona y "m" si fue del mando. Los toques de un
   combate van unidos por puntos: "1k.m2f.3a". */
export function toque(ms, origen) {
  const cs = Math.max(0, Math.min(1679615, Math.round((+ms || 0) / 10)));
  return (origen === "script" ? "!" : origen === "mando" ? "m" : "") + cs.toString(36);
}
export function leeToques(z) {
  if (z === "") return [];
  if (typeof z !== "string" || z.length > 30000) return null;
  const out = [];
  for (const t of z.split(".")) {
    const m = /^([!m]?)([0-9a-z]{1,4})$/.exec(t);
    if (!m) return null;
    out.push({ ms: parseInt(m[2], 36) * 10, script: m[1] === "!", mando: m[1] === "m" });
  }
  return out;
}

/* ¿Juega una persona? Sobre todos los toques de la prueba. Lo que se
   mide incluye la animación del turno: tras cada elección el combate
   se anima con el menú escondido («…»), así que entre dos elecciones
   de una persona pasan, como poco, el turno animado o el clic de
   «saltar» más el de la elección. Con la pestaña oculta no hay
   animación, pero tampoco nadie que haga clic. Los umbrales son muy
   holgados a propósito: rechazar a alguien honrado es peor que dejar
   pasar un bot lento.
   - Un clic de script (`isTrusted` falso sin mando conectado) rechaza:
     ni el ratón, ni el dedo, ni Intro sobre el botón lo dan.
   - Menos de 100 ms desde la elección anterior es imposible (el tiempo
     de reacción visual simple ronda los 200 ms, y aquí hay que leer el
     menú); se toleran unos pocos —el 5 %, mínimo dos— por si el reloj
     del aparato salta.
   - Con 15 elecciones o más, una mediana por debajo de 350 ms es un
     ritmo que nadie sostiene eligiendo entre cuatro movimientos y
     cambios (elegir entre 4–6 opciones ya cuesta medio segundo largo
     según Hick-Hyman, sin contar la animación).
   - Con 20 o más, un ritmo de metrónomo (coeficiente de variación por
     debajo de 0,08) solo cuenta si además va rápido (mediana < 3 s):
     las animaciones de cada turno duran distinto, y una persona no repite
     su intervalo al 8 %. */
export const RITMO = { minToqueMs: 100, toleranciaRapidos: 0.05, minRapidos: 2, nMediana: 15, minMedianaMs: 350, nMetronomo: 20, maxCV: 0.08, metronomoBajoMs: 3000 };
export function ritmoHumano(toques) {
  if (!toques.length) return null;
  if (toques.some(t => t.script)) return "Hubo elecciones hechas por un script, no por un clic (ni por un mando conectado).";
  const ms = toques.map(t => t.ms);
  const rapidos = ms.filter(x => x < RITMO.minToqueMs).length;
  if (rapidos > Math.max(RITMO.minRapidos, Math.floor(ms.length * RITMO.toleranciaRapidos)))
    return `${rapidos} elecciones llegaron a menos de ${RITMO.minToqueMs} ms de la anterior: ninguna persona lee el menú tan rápido.`;
  const orden = ms.slice().sort((a, b) => a - b), mediana = orden[Math.floor(orden.length / 2)];
  if (ms.length >= RITMO.nMediana && mediana < RITMO.minMedianaMs) return `Elecciones cada ${mediana} ms de mediana: es el ritmo de un programa.`;
  if (ms.length >= RITMO.nMetronomo && mediana < RITMO.metronomoBajoMs) {
    const media = ms.reduce((a, b) => a + b, 0) / ms.length;
    const cv = media > 0 ? Math.sqrt(ms.reduce((a, b) => a + (b - media) ** 2, 0) / ms.length) / media : 0;
    if (cv < RITMO.maxCV) return `Elecciones a ritmo de metrónomo (variación ${(cv * 100).toFixed(1)} %): las de una persona varían mucho más.`;
  }
  return null;
}

/* ¿Gana el jugador el combate n con este equipo y estas elecciones?
   Es el mismo combate que monta la pantalla: el nombre del jugador no
   cuenta (solo decide quién figura como ganador). */
export function ganaPelea({ inst, nivel, semilla, n, o, equipo, elecciones }) {
  const R = rivalDe(inst, n, semilla);
  const P = nuevaPelea({
    semilla: semillaPelea(semilla, n, o), sets: [equipo, equipoRival(inst, nivel, n, semilla).sets],
    nombres: ["Tú", R.nombre], lados: ["tú", "cpu"], iq: iqDe(n), palacio: inst === "palacio", elecciones
  });
  return P.est().ganador === "tú";
}

/* Un equipo de la prueba (empaquetado) tal como se juega: tres, legal
   para la Frontera y al nivel de la instalación, diga lo que diga. */
function equipoDe(texto, nivelModo) {
  if (typeof texto !== "string" || !texto || texto.length > 6000) return null;
  let sets = null;
  try { sets = Teams.unpack(texto); } catch (e) { return null; }
  if (!Array.isArray(sets) || sets.length !== 3 || validaFrontera(sets).length) return null;
  return aNivel(sets, nivelModo);
}
/* Los tres de alquiler elegidos al empezar la racha de la Fábrica. */
function equipoFabrica(semilla, nivelModo, t) {
  if (typeof t !== "string" || !/^[0-5]{3}$/.test(t) || new Set(t).size !== 3) return null;
  const seis = alquiler(1, semilla, nivelModo);
  const eq = aNivel([...t].map(i => seis[+i]), nivelModo);
  return validaFrontera(eq).length ? null : eq;
}

/* Las elecciones y los toques de un combate, que tienen que ir a la par.
   Sin toques (`null`) solo vale un combate empezado antes de la prueba
   (o = 0), que no los anotaba. */
function eleccionesDe(c, z, o) {
  const elecciones = decodificaElecciones(c);
  if (!elecciones) return null;
  if (z == null) return o === 0 ? { elecciones, toques: [] } : null;
  const toques = leeToques(z);
  if (!toques || toques.length !== elecciones.length) return null;
  return { elecciones, toques };
}

/* La prueba de la racha en curso `r` (la de la pantalla, con su `h`). */
export function pruebaRacha(r) {
  const p = { v: PRUEBA_FRONTERA, k: `${r.inst}-${r.nivel}`, s: r.semilla };
  if (r.inst === "fabrica") p.t = r.t; else p.e = Teams.pack(r.equipo);
  p.b = r.h.map(x => x.slice());
  return p;
}

/* El libro de victorias por subir → la prueba. `libro` son entradas
   `[clave, semilla, n, o, equipo empaquetado, elecciones, toques]`; se
   quedan las de ordinal mayor que `h`, una por ordinal y por combate, en
   orden, y tantas como quepan. `descartar` son las que ya no podrán
   contar. */
export function pruebaVictorias(b, h, libro, maxTexto = 190000) {
  const vistos = new Set(), ords = new Set(), validas = [], descartar = [];
  for (const x of libro || []) {
    const ok = Array.isArray(x) && x.length === 7 && Number.isSafeInteger(x[3]) && x[3] > h && !ords.has(x[3]) && !vistos.has(`${x[0]}|${x[1]}|${x[2]}`);
    if (!ok) { descartar.push(x); continue; }
    ords.add(x[3]); vistos.add(`${x[0]}|${x[1]}|${x[2]}`);
    validas.push(x);
  }
  validas.sort((a, z) => a[3] - z[3]);
  const q = [], qi = new Map(), l = [];
  let largo = 80, max = 0;
  for (const [k, s, n, o, eq, c, z] of validas) {
    if (l.length >= TOPE_LIBRO) break;
    const nuevo = !qi.has(eq);
    const fila = [k, s, n, o, nuevo ? q.length : qi.get(eq), c, z];
    const tam = JSON.stringify(fila).length + 1 + (nuevo ? JSON.stringify(eq).length + 1 : 0);
    if (largo + tam > maxTexto) break;
    if (nuevo) { qi.set(eq, q.length); q.push(eq); }
    l.push(fila); largo += tam; max = o;
  }
  return { prueba: { v: PRUEBA_FRONTERA, b, h, q, l }, puntos: b + l.length, partida: `fv-${max}`, usadas: l.length, descartar };
}

/* ¿Vale esta marca? null si sí; el motivo, si no. `desde`: los combates
   de la racha antes de ese índice ya se rehicieron (el verificador lo
   recuerda entre récords de la misma racha) y no se vuelven a jugar. */
export function compruebaPrueba(dato, prueba, desde = 0) {
  if (!dato || typeof dato !== "object") return "El resultado no se puede leer.";
  if (!prueba || typeof prueba !== "object" || prueba.v !== PRUEBA_FRONTERA) return "La prueba no es de esta versión de la Frontera.";
  if (!Number.isSafeInteger(dato.tiempo) || dato.tiempo < 1 || dato.tiempo > TOPE_TIEMPO) return "El tiempo de la partida no es válido.";
  if (!Number.isSafeInteger(dato.puntos) || dato.puntos < 1) return "La marca no es válida.";
  if (dato.categoria === "club-frontera-victorias") return compruebaVictorias(dato, prueba);
  const m = /^club-frontera-((torre|palacio|fabrica)-(50|abierto))$/.exec(String(dato.categoria || ""));
  if (!m) return "La categoría no es de la Frontera.";
  return compruebaRacha(dato, prueba, m[2], m[3], Math.max(0, Math.floor(+desde || 0)));
}

function compruebaRacha(dato, p, inst, nivel, desde) {
  if (p.k !== `${inst}-${nivel}`) return "La prueba es de otra instalación o de otro nivel.";
  if (typeof p.s !== "string" || !SEMILLA_RE.test(p.s)) return "La semilla de la racha no es válida.";
  const b = p.b;
  if (!Array.isArray(b) || !b.length) return "La prueba no trae los combates de la racha.";
  const n = b.length;
  if (dato.puntos !== n) return `La racha dice ${dato.puntos} combates y la prueba trae ${n}.`;
  if (dato.partida !== `${p.s}-${n}`) return "La prueba es de otra partida.";
  /* Cada combate suma al menos un segundo (`cierraPelea`): lo que dure
     menos no salió de la pantalla. */
  if (dato.tiempo < MIN_COMBATE_MS * n) return `${n} combates en ${(dato.tiempo / 1000).toFixed(1)} s: ni un segundo por combate.`;
  let equipo = inst === "fabrica" ? equipoFabrica(p.s, nivel, p.t) : equipoDe(p.e, nivel);
  if (!equipo) return "El equipo de la racha no cumple las reglas de la Frontera.";
  /* Primero lo barato: que se lea, los cambios y el ritmo de toda la
     racha; después, los combates. */
  const pasos = [], toques = [];
  for (let j = 0; j < n; j++) {
    const x = b[j];
    if (!Array.isArray(x) || x.length !== 4) return `El combate ${j + 1} de la prueba no se puede leer.`;
    const [o, c, sw, z] = x;
    if (!Number.isSafeInteger(o) || o < 0) return `El combate ${j + 1} de la prueba no se puede leer.`;
    /* Sin ordinal (y sin toques) solo puede ir el primero: es el combate
       que una racha de antes tenía a medias cuando llegó la prueba. */
    if (o === 0 && j > 0) return `El combate ${j + 1} de la prueba no tiene ordinal.`;
    if (sw !== "") {
      // El cambio de la Fábrica: uno de los tuyos por uno del rival que acabas de vencer.
      if (inst !== "fabrica" || j === 0 || typeof sw !== "string" || !/^[0-2][0-2]$/.test(sw)) return `El cambio antes del combate ${j + 1} no es posible.`;
      const suyos = aNivel(equipoRival(inst, nivel, j, p.s).sets, nivel);
      const nuevo = equipo.slice();
      nuevo[+sw[0]] = suyos[+sw[1]];
      if (!nuevo[+sw[0]] || validaFrontera(nuevo).length) return `El cambio antes del combate ${j + 1} no es posible.`;
      equipo = nuevo;
    }
    const e = eleccionesDe(c, z, o);
    if (!e) return `Las elecciones del combate ${j + 1} no se pueden leer.`;
    toques.push(...e.toques);
    pasos.push({ n: j + 1, o, equipo, elecciones: e.elecciones });
  }
  const ritmo = ritmoHumano(toques);
  if (ritmo) return ritmo;
  for (const x of pasos) {
    if (x.n <= desde) continue;
    if (!ganaPelea({ inst, nivel, semilla: p.s, n: x.n, o: x.o, equipo: x.equipo, elecciones: x.elecciones })) return `El combate ${x.n} no se gana con las elecciones de la prueba.`;
  }
  return null;
}

function compruebaVictorias(dato, p) {
  const { b, h, q, l } = p;
  if (!Number.isSafeInteger(b) || b < 0 || !Number.isSafeInteger(h) || h < 0) return "La base de la prueba no es válida.";
  if (!Array.isArray(q) || !Array.isArray(l) || !l.length || l.length > TOPE_LIBRO) return "La prueba no trae victorias.";
  if (dato.puntos !== b + l.length) return `El total dice ${dato.puntos} y la prueba suma ${b} + ${l.length}.`;
  const ords = new Set(), vistos = new Set(), pasos = [], toques = [], equipos = new Map();
  let max = 0;
  for (const x of l) {
    if (!Array.isArray(x) || x.length !== 7) return "Una victoria de la prueba no se puede leer.";
    const [k, s, n, o, qi, c, z] = x;
    if (typeof k !== "string" || !CLAVE_RE.test(k) || typeof s !== "string" || !SEMILLA_RE.test(s) || !Number.isSafeInteger(n) || n < 1 || n > 100000 ||
      !Number.isSafeInteger(qi) || qi < 0 || qi >= q.length) return "Una victoria de la prueba no se puede leer.";
    if (!Number.isSafeInteger(o) || o <= h) return "La prueba vuelve a contar una victoria que ya estaba en la tabla.";
    if (ords.has(o) || vistos.has(`${k}|${s}|${n}`)) return "La prueba cuenta dos veces la misma victoria.";
    ords.add(o); vistos.add(`${k}|${s}|${n}`);
    max = Math.max(max, o);
    const [inst, nivel] = k.split("-");
    const clave = qi + "|" + nivel;
    if (!equipos.has(clave)) equipos.set(clave, equipoDe(q[qi], nivel));
    const equipo = equipos.get(clave);
    if (!equipo) return "Un equipo de la prueba no cumple las reglas de la Frontera.";
    const e = eleccionesDe(c, z, o);
    if (!e) return "Las elecciones de una victoria no se pueden leer.";
    toques.push(...e.toques);
    pasos.push({ inst, nivel, semilla: s, n, o, equipo, elecciones: e.elecciones });
  }
  if (dato.partida !== `fv-${max}`) return "La prueba es de otra partida.";
  const ritmo = ritmoHumano(toques);
  if (ritmo) return ritmo;
  for (const x of pasos) if (!ganaPelea(x)) return `La victoria n.º ${x.o} no se gana con las elecciones de la prueba.`;
  return null;
}

export const FRONTERA = {
  INSTALACIONES, NIVELES, POR_SERIE, FORMATO, PALACIO,
  hash32, rng, nivelDe, serieDe, esUltimo, dificultad, iqDe, ivDe, franjaDe, monedasCombate,
  rivalDe, generaEquipo, equipoRival, alquiler, validaFrontera, aNivel, prohibida,
  decideIA, decidePalacio, claseMov, nuevaPelea,
  PRUEBA_FRONTERA, MIN_COMBATE_MS, TOPE_LIBRO, RITMO, semillaPelea, codificaElecciones, decodificaElecciones,
  toque, leeToques, ritmoHumano, ganaPelea, pruebaRacha, pruebaVictorias, compruebaPrueba
};
export default FRONTERA;
