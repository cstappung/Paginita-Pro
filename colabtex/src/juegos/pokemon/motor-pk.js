/* ============================================================
   Pokémon: el motor de combate.

   No hay un motor escrito aquí: es el de Pokémon Showdown, el simulador
   de verdad (`@pkmn/sim`, la extracción MIT del simulador de Showdown).
   Trae todo lo que el juego tiene — los ~950 movimientos con sus
   efectos, las ~300 habilidades, los ~580 objetos, las naturalezas, la
   tabla de tipos de cada generación, EVs/IVs, Tera, Mega, Dinamax en las
   generaciones que lo tienen, el clima, los campos y las reglas de cada
   tier — y reescribir una fracción de eso a mano sería peor y más lento.
   Lo que se escribe aquí es lo que Showdown no tiene porque él tiene
   servidor: cómo jugar sin uno.

   Es un bundle aparte (`juegos-pokemon.js`, ~6 MB, 1 MB comprimido) que
   se carga la primera vez que alguien abre una sala de Pokémon o el
   editor de equipos, como el motor de fórmulas de ColabDraw: meterlo en
   `juegos-app.js` sextuplicaría lo que baja quien solo quiere un UNO.
   Se cuelga de `globalThis.PokeMotor`, y `redPokemon` en `motor.js` lo
   busca ahí, igual que Clue busca `ClueMotor`.

   **El registro es el estado**, como en todos los juegos de la sala. Una
   pelea es una lista de *puntos de decisión*: el 0 es elegir equipo, y
   cada uno de los siguientes es lo que Showdown pide a la vez a los dos
   lados (vista previa, el movimiento del turno, el cambio tras un
   debilitado). En cada punto los dos escriben, aunque a uno no le toque
   decidir nada (escribe «-»), en dos tiempos:

   - `{t:"c", k, h}` con `h = H(elección + "|" + llave_k)`, y cuando están
     las dos promesas,
   - `{t:"r", k, c, l}` con la elección y la llave.

   La llave del punto k es el eslabón k de una cadena de hashes que sale
   del secreto privado de cada uno (`misPartidas/<uid>/<pid>/sec`), con la
   punta publicada en la ficha (`hcad`), como en el cacho: H(llave_k) es
   la llave del punto anterior, así que nadie puede cambiarla después ni
   adivinar la del otro. Eso da dos cosas a la vez:

   - **Las elecciones son simultáneas de verdad.** Quien escribe segundo
     no puede leer en la base lo que eligió el otro: solo ve un hash.
   - **El azar no lo controla nadie.** La semilla del PRNG de Showdown
     para resolver el punto k es H(semilla | k | llave₁ | llave₂), y
     ninguno conoce la llave del otro hasta que los dos se han
     comprometido. Sin eso, quien tuviera la semilla podría simular el
     turno en la consola antes de elegir y saber si su Hidrobomba falla.
     Por eso también escribe «-» quien no decide: si el que cambia tras
     un debilitado conociera la semilla, podría probar cada cambio.

   **El límite honesto**: los equipos van en claro en el registro (el
   simulador necesita los dos para calcular el daño, y no hay servidor
   que lo haga a ciegas). La pantalla solo muestra lo que Showdown
   enseñaría — especies en la vista previa, y objeto, habilidad y
   movimientos del rival a medida que se revelan — pero con la consola
   abierta se ven. El equipo, eso sí, se elige comprometido como todo lo
   demás: nadie puede armar un contraequipo después de ver el del otro.
   ============================================================ */
import { Battle, Dex, Teams, TeamValidator, toID } from "@pkmn/sim";
import { FORMAS, BW_FRENTE, BW_ESPALDA } from "./formas.js";

import { FORMATOS, FORMATO_POR, formatoDe, genDe, esAleatorio } from "./formatos.js";
import { TeamGenerators } from "@pkmn/randoms";
import FRONTERA from "./frontera-motor.js";
export { FORMATOS, FORMATO_POR, formatoDe, genDe };

/* Lo que decide quien no tiene nada que decidir. */
export const NADA = "-";

/* ---------- equipos ---------- */

/* Texto de Showdown (el de «Import/Export») → sets. Devuelve [] si no
   hay nada legible. */
export function importa(texto) {
  try { return Teams.import(String(texto || "")) || []; } catch (e) { return []; }
}
export const exporta = sets => Teams.export(sets || []);
export const empaqueta = sets => Teams.pack(sets || []);
export function desempaqueta(packed) {
  try { return Teams.unpack(String(packed || "")) || []; } catch (e) { return []; }
}

const validadores = new Map();
/* Lo que el validador de Showdown tiene que decir del equipo en ese
   formato: [] si vale. Es el mismo que usa el servidor de Showdown, con
   las mismas cláusulas (Species, Sleep, OHKO, Evasion…). */
export function valida(formato, sets) {
  formato = formatoDe(formato);
  if (!Array.isArray(sets) || !sets.length) return ["El equipo está vacío."];
  let v = validadores.get(formato);
  if (!v) { v = new TeamValidator(formato); validadores.set(formato, v); }
  try {
    // El validador escribe sobre los sets (rellena EVs, normaliza nombres): se le da una copia.
    return v.validateTeam(JSON.parse(JSON.stringify(sets))) || [];
  } catch (e) { return [String(e && e.message || e)]; }
}

/* ---------- sprites ----------
   Solo 2D, de github.com/PokeAPI/sprites (raw.githubusercontent.com):
   el animado al estilo Negro/Blanco (`versions/generation-v/black-white/
   animated`) cuando existe, y si no el PNG fijo (`pokemon/<n>.png`). No
   se usan los animados de `other/showdown`: de la 6.ª generación en
   adelante son renders de modelos 3D y desentonan con el resto. Las
   miniaturas (`fijo`) van siempre al PNG, que pesa 1–3 KB. Lo que falla
   prueba la siguiente URL (la pantalla lo hace con `onerror`). */
const BASE_SPR = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const BW = BASE_SPR + "pokemon/versions/generation-v/black-white/animated/";
export function numeroSprite(especie) {
  const s = Dex.species.get(especie);
  if (!s.exists) return 0;
  return FORMAS[s.id] || FORMAS[toID(s.baseSpecies) + toID(s.forme)] || s.num || 0;
}
/* Las URLs a probar en orden: animado 2D, PNG fijo, y el de la especie base. */
export function urlsSprite(especie, { espalda = false, shiny = false, fijo = false } = {}) {
  const s = Dex.species.get(especie);
  const n = numeroSprite(especie), base = s.exists ? s.num : 0;
  if (!n) return [BASE_SPR + "pokemon/0.png"];
  const sh = shiny ? "shiny/" : "", lado = espalda ? "back/" : "";
  const urls = [];
  const hay = espalda ? BW_ESPALDA : BW_FRENTE;
  if (!fijo && hay.has(n)) urls.push(`${BW}${lado}${sh}${n}.gif`);
  if (!fijo && n !== base && base && hay.has(base) && !hay.has(n)) urls.push(`${BW}${lado}${sh}${base}.gif`);
  urls.push(`${BASE_SPR}pokemon/${lado}${sh}${n}.png`);
  if (base && base !== n) urls.push(`${BASE_SPR}pokemon/${lado}${sh}${base}.png`);
  if (shiny) urls.push(`${BASE_SPR}pokemon/${lado}${n}.png`);
  return urls;
}
/* PokeAPI nombra los objetos con guiones («choice-scarf»); Showdown, sin
   espacios ni guiones («Choice Scarf»). */
export function urlObjetoPokeapi(item) {
  const it = Dex.items.get(item);
  if (!it.exists) return "";
  return `${BASE_SPR}items/${it.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

/* ---------- la pelea ----------
   `jugadas` es el registro ya pasado por `votacion`, `js` las fichas
   (con `hcad`), `H` el SHA-256 síncrono de `motor.js`. */

const cache = new Map();   // pid lógico → { firma, S }

/* La firma de lo que ya se aplicó: cada jugada, en orden, con lo que la
   hace única (el hash de la promesa, la llave de la revelación). El
   registro solo crece, así que si la firma vieja es prefijo de la nueva
   se sigue desde donde se dejó, sin rehacer la pelea entera. Con solo
   tipo y autor, dos peleas de la misma forma se confundían. */
const firmaDe = j => `${j.t}:${j.uid}:${j.k == null ? "" : j.k}:${j.h || j.l || ""};`;

export function reducir(jugadas, js, opts) {
  const { semilla = 0, formato: f0, H, clave = "" } = opts || {};
  const formato = formatoDe(f0);
  const lados = js.slice(0, 2);
  if (lados.length < 2 || typeof H !== "function") return vista(nuevo(lados, formato, semilla, H));
  const llave = clave + "|" + semilla + "|" + formato + "|" + lados.map(j => j.uid + ":" + (j.hcad || "")).join(",");
  let c = cache.get(llave);
  let desde = 0, S;
  if (c && c.n <= jugadas.length && jugadas.slice(0, c.n).map(firmaDe).join("") === c.firma) {
    S = c.S; desde = c.n;
  } else {
    S = nuevo(lados, formato, semilla, H);
  }
  for (let i = desde; i < jugadas.length; i++) aplica(S, jugadas[i]);
  cache.set(llave, { S, n: jugadas.length, firma: jugadas.map(firmaDe).join("") });
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return vista(S);
}

function nuevo(lados, formato, semilla, H) {
  const S = {
    formato, semilla, H,
    uids: lados.map(j => j.uid),
    nombres: lados.map(j => j.nombre || "Entrenador"),
    llaves: {}, com: {}, rev: {},
    punto: 0, battle: null, equipos: {}, skins: {},
    falsas: {}, invalidos: {}, ganador: null, motivo: "", acabada: false
  };
  for (const j of lados) S.llaves[j.uid] = j.hcad || "";
  // Dos con el mismo nombre harían ambiguo el `winner` de Showdown.
  if (S.nombres[0] === S.nombres[1]) S.nombres[1] += " (2)";
  return S;
}

const ladoDe = (S, uid) => S.uids.indexOf(uid);
const otro = (S, uid) => S.uids[1 - ladoDe(S, uid)];

function aplica(S, j) {
  if (!j || S.acabada) return;
  const i = ladoDe(S, j.uid);
  if (i < 0) return;
  if (j.t === "abandona" || j.t === "rinde") {
    S.ganador = otro(S, j.uid); S.motivo = j.t === "rinde" ? "rinde" : "abandono"; S.acabada = true;
    return;
  }
  if (j.k !== S.punto) return;
  if (j.t === "c") {
    if (!S.com[j.uid] && typeof j.h === "string" && /^[0-9a-f]{64}$/.test(j.h)) S.com[j.uid] = j.h;
    return;
  }
  if (j.t !== "r" || !S.com[j.uid] || S.rev[j.uid] || S.uids.some(u => !S.com[u])) return;
  const l = String(j.l || ""), c = String(j.c == null ? "" : j.c);
  if (S.H(l) !== S.llaves[j.uid] || S.H(c + "|" + l) !== S.com[j.uid]) {
    // No casa con lo prometido: no cuenta, y la mesa sigue esperando la buena.
    S.falsas[j.uid] = true;
    return;
  }
  S.rev[j.uid] = { c, l, sk: typeof j.sk === "string" ? j.sk.slice(0, 40) : "" };
  if (S.uids.every(u => S.rev[u])) resuelve(S);
}

function semillaPunto(S) {
  return "sodium," + S.H(S.semilla + "|" + S.punto + "|" + S.uids.map(u => S.rev[u].l).join("|"));
}

function equipoAleatorio(S, i) {
  const semilla = "sodium," + S.H(S.semilla + "|eq|" + i + "|" + S.uids.map(u => S.rev[u].l).join("|"));
  return Teams.pack(TeamGenerators.getTeamGenerator(S.formato, semilla).getTeam());
}

function resuelve(S) {
  const [a, b] = S.uids;
  if (S.punto === 0) {
    const sets = {}, errores = {}, rand = esAleatorio(S.formato);
    for (const u of S.uids) {
      S.skins[u] = S.rev[u].sk;
      if (rand) {
        // Random Battle: el equipo sale del generador de Showdown con una
        // semilla que mezcla las dos llaves del punto 0, así que nadie lo
        // conoce (ni lo puede pescar) hasta que ambos se comprometieron.
        // El generador es el del servidor: no hace falta validarlo.
        S.rev[u].c = equipoAleatorio(S, S.uids.indexOf(u));
        errores[u] = [];
        continue;
      }
      sets[u] = desempaqueta(S.rev[u].c);
      errores[u] = valida(S.formato, sets[u]);
    }
    S.invalidos = {};
    for (const u of S.uids) if (errores[u].length) S.invalidos[u] = errores[u].slice(0, 6);
    if (S.invalidos[a] && S.invalidos[b]) { S.ganador = ""; S.motivo = "equipos"; S.acabada = true; }
    else if (S.invalidos[a] || S.invalidos[b]) {
      S.ganador = S.invalidos[a] ? b : a; S.motivo = "equipo"; S.acabada = true;
    } else {
      S.battle = new Battle({ formatid: S.formato, seed: semillaPunto(S) });
      S.uids.forEach((u, i) => {
        S.equipos[u] = S.rev[u].c;
        S.battle.setPlayer("p" + (i + 1), { name: S.nombres[i], avatar: S.skins[u] || "", team: S.rev[u].c });
      });
    }
  } else {
    const B = S.battle;
    B.resetRNG(semillaPunto(S));
    S.uids.forEach((u, i) => {
      const side = B.sides[i];
      if (!necesita(side) || B.ended) return;
      const c = S.rev[u].c;
      if (c === NADA || !B.choose(side.id, c)) {
        // Una elección que el simulador no acepta (o «nada» cuando sí
        // tocaba) se cambia por la de por omisión: un cliente honrado
        // nunca la manda, y uno que la mande no debe congelar la mesa.
        side.clearChoice();
        B.choose(side.id, "default");
      }
    });
  }
  for (const u of S.uids) S.llaves[u] = S.rev[u].l;
  S.com = {}; S.rev = {};
  S.punto++;
  const B = S.battle;
  if (B && B.ended && !S.acabada) {
    S.acabada = true; S.motivo = "ko";
    const w = B.sides.findIndex(s => s.name === B.winner);
    S.ganador = B.winner && w >= 0 ? S.uids[w] : "";
    if (S.ganador === "") S.motivo = "empate";
  }
  if (!S.acabada && S.punto >= PK_TOPE) { S.acabada = true; S.ganador = ""; S.motivo = "tope"; }
}

/* Cuántos puntos caben en la cadena de llaves (`PK_CADENA` en motor.js
   es 2000; uno se gasta en el equipo). Showdown da la pelea por tablas
   en el turno 1000, así que no se llega. */
export const PK_TOPE = 1999;

const necesita = side => !!side && !!side.activeRequest && !side.activeRequest.wait && side.requestState !== "";

/* Lo que ve la sala: nada de esto se escribe, sale del registro. */
function vista(S) {
  const B = S.battle;
  const fase = S.acabada ? "fin" : S.uids.length < 2 ? "espera" : S.punto === 0 ? "equipos" : "jugando";
  const decide = {}, debe = [];
  S.uids.forEach((u, i) => {
    decide[u] = S.punto === 0 ? true : !!(B && necesita(B.sides[i]) && !B.ended);
    if (fase !== "fin" && decide[u] && !S.com[u]) debe.push(u);
  });
  return {
    fase, punto: S.punto, formato: S.formato, aleatorio: esAleatorio(S.formato),
    lados: S.uids.slice(), nombres: S.nombres.slice(),
    prometido: Object.fromEntries(Object.keys(S.com).map(u => [u, true])),
    revelado: Object.fromEntries(Object.keys(S.rev).map(u => [u, true])),
    decide, debe,
    peticion: B ? S.uids.map((u, i) => B.sides[i].activeRequest || null) : [null, null],
    battle: B, log: B ? B.log : [], turno: "", ronda: B ? B.turn : 0,
    equipos: S.equipos, skins: S.skins, invalidos: S.invalidos, falsas: S.falsas,
    resumen: resumenDe(S),
    ganador: S.acabada ? S.ganador : null, motivo: S.motivo
  };
}

/* Lo que pasó en la pelea, por lado, contado sobre el registro público:
   lo usan los logros. Se lleva al día solo con lo nuevo del registro. */
function resumenDe(S) {
  const B = S.battle;
  if (!B) return [];
  if (!S._res) S._res = { n: 0, r: [0, 1].map(() => ({ crit: 0, tera: 0, ko: 0, perdidos: 0, ohko: 0, maxKo: 0, kos: {} })), activo: {}, hp: {} };
  const R = S._res;
  const lin = lineasPara(B.log, -1, 0);
  const lado = id => Number(String(id || "").charAt(1)) - 1;
  const nombre = id => String(id || "").replace(/^p\da: /, "");
  for (let i = R.n; i < lin.length; i++) {
    const c = lin[i].split("|");
    const t = c[1];
    if (t === "switch" || t === "drag" || t === "replace") {
      R.activo[lado(c[2])] = nombre(c[2]);
      R.hp[c[2].slice(0, 2) + nombre(c[2])] = c[4] || "";
    } else if (t === "-terastallize") { const l = lado(c[2]); if (l >= 0) R.r[l].tera++; }
    else if (t === "-crit") { const l = lado(c[2]); if (l >= 0) R.r[1 - l].crit++; }
    else if (t === "-damage" || t === "-heal" || t === "-sethp") {
      const k = c[2].slice(0, 2) + nombre(c[2]);
      const antes = R.hp[k] || "";
      R.hp[k] = c[3] || "";
      // De vida llena a debilitado de un ataque: sin [from] es un golpe directo.
      if (t === "-damage" && /^0 fnt/.test(c[3] || "") && /^100\/100/.test(antes) && !c.slice(4).some(x => x.startsWith("[from]"))) {
        const l = lado(c[2]); if (l >= 0) R.r[1 - l].ohko++;
      }
    } else if (t === "faint") {
      const l = lado(c[2]);
      if (l >= 0) {
        R.r[l].perdidos++;
        const quien = R.activo[1 - l];
        if (quien) {
          const r = R.r[1 - l];
          r.ko++; r.kos[quien] = (r.kos[quien] || 0) + 1;
          r.maxKo = Math.max(r.maxKo, r.kos[quien]);
        }
      }
    }
  }
  R.n = lin.length;
  return R.r.map((r, i) => ({ ...r, vivos: B.sides[i] ? B.sides[i].pokemonLeft : 0 }));
}

/* Las elecciones que admite una petición de Showdown, ya escritas como
   las entiende `battle.choose`: la pantalla pinta botones con ellas y
   los robots de los tests eligen entre ellas. En individuales. */
export function opciones(req) {
  if (!req || req.wait) return [];
  const eq = (req.side && req.side.pokemon) || [];
  if (req.teamPreview) return [{ c: "team " + eq.map((_, i) => i + 1).join("") }];
  const cambios = eq.map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.active && !/ fnt$/.test(p.condition))
    .map(({ i }) => ({ c: "switch " + (i + 1), cambio: i }));
  if (req.forceSwitch) return cambios;
  const a = (req.active && req.active[0]) || null;
  if (!a) return cambios;
  const out = [];
  a.moves.forEach((m, i) => {
    if (m.disabled) return;
    out.push({ c: "move " + (i + 1), mov: i });
    if (a.canTerastallize) out.push({ c: `move ${i + 1} terastallize`, mov: i, extra: "tera" });
    if (a.canMegaEvo) out.push({ c: `move ${i + 1} mega`, mov: i, extra: "mega" });
    if (a.canDynamax) out.push({ c: `move ${i + 1} dynamax`, mov: i, extra: "dynamax" });
  });
  if (a.canZMove) a.canZMove.forEach((z, i) => { if (z) out.push({ c: `move ${i + 1} zmove`, mov: i, extra: "z" }); });
  if (!a.trapped) out.push(...cambios);
  return out;
}

/* ---------- lo que cada uno ve del registro de Showdown ----------
   Showdown escribe `|split|p1` y detrás dos líneas: la privada de p1
   (vida exacta) y la pública (porcentaje). `lado` 0/1 ve la suya; -1 la
   pública. */
export function lineasPara(log, lado, desde = 0) {
  const out = [];
  for (let i = desde; i < log.length; i++) {
    const l = log[i];
    if (l.startsWith("|split|")) {
      const p = Number(l.slice(8)) - 1;
      out.push(p === lado ? log[i + 1] : log[i + 2]);
      i += 2;
      continue;
    }
    out.push(l);
  }
  return out;
}

/* Datos para pintar botones y fichas: lo que el juego dice de un
   movimiento, objeto, habilidad o especie, en la generación del formato. */
export function dexDe(formato) { return Dex.forFormat(Dex.formats.get(formatoDe(formato))); }
export function tipoEficacia(tipoAtaque, tiposDefensa, formato) {
  const D = dexDe(formato);
  if (!D.getImmunity(tipoAtaque, tiposDefensa)) return 0;
  return Math.pow(2, D.getEffectiveness(tipoAtaque, tiposDefensa));
}
/* Las estadísticas finales de un set, con naturaleza, EVs, IVs y nivel:
   lo que calcula Showdown, para enseñarlo en el editor. */
export function estadisticas(set, formato) {
  const D = dexDe(formato);
  const s = D.species.get(set.species);
  if (!s.exists) return null;
  const nat = D.natures.get(set.nature || "Serious");
  const nivel = set.level || 100;
  const out = {};
  for (const st of ["hp", "atk", "def", "spa", "spd", "spe"]) {
    const base = s.baseStats[st];
    const iv = set.ivs && set.ivs[st] != null ? set.ivs[st] : 31;
    const ev = set.evs && set.evs[st] != null ? set.evs[st] : 0;
    if (st === "hp") out.hp = base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * nivel / 100) + nivel + 10;
    else {
      let v = Math.floor((2 * base + iv + Math.floor(ev / 4)) * nivel / 100) + 5;
      if (nat.plus === st) v = Math.floor(v * 1.1);
      if (nat.minus === st) v = Math.floor(v * 0.9);
      out[st] = v;
    }
  }
  return out;
}
/* Lo que una especie puede aprender en ese formato, por nombre. */
export function aprende(especie, formato) {
  const D = dexDe(formato);
  const s = D.species.get(especie);
  if (!s.exists) return [];
  const ids = new Set();
  let x = s;
  const vistos = new Set();
  while (x && x.exists && !vistos.has(x.id)) {
    vistos.add(x.id);
    const ls = D.data.Learnsets[x.id] && D.data.Learnsets[x.id].learnset;
    if (ls) for (const m of Object.keys(ls)) ids.add(m);
    // Las formas heredan de la base, y los evolucionados de sus preevoluciones.
    const sig = x.changesFrom || x.baseSpecies !== x.name && x.baseSpecies || x.prevo;
    x = sig ? D.species.get(sig) : null;
  }
  const todo = /nationaldex|customgame/.test(formatoDe(formato));
  return [...ids].map(m => D.moves.get(m)).filter(m => m.exists && (todo || !m.isNonstandard))
    .map(m => m.name).sort();
}

export { Dex, Teams, toID };

const PokeMotor = {
  FORMATOS, FORMATO_POR, formatoDe, genDe, esAleatorio, NADA, PK_TOPE,
  importa, exporta, empaqueta, desempaqueta, valida,
  numeroSprite, urlsSprite, urlObjetoPokeapi,
  reducir, opciones, lineasPara, dexDe, tipoEficacia, estadisticas, aprende,
  Dex, Teams, toID,
  frontera: FRONTERA
};
if (typeof globalThis !== "undefined") globalThis.PokeMotor = globalThis.PokeMotor || PokeMotor;
export default PokeMotor;
