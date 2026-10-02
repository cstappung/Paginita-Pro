/* El relato de la pelea en español, a partir del protocolo de Showdown
   (`|move|p1a: Garchomp|Earthquake|p2a: Gholdengo` …). Puro: se puede
   probar en Node. Los nombres de Pokémon, movimientos, objetos y
   habilidades se dejan en inglés, que es como los escribe Showdown y como
   los busca cualquiera en Smogon; lo que se traduce es la frase, los
   tipos, las estadísticas, los estados y el clima. Lo que no se reconoce
   no se inventa: se omite, igual que hace Showdown con lo que es solo
   para su interfaz. */

export const TIPOS = {
  Normal: "Normal", Fire: "Fuego", Water: "Agua", Grass: "Planta", Electric: "Eléctrico",
  Ice: "Hielo", Fighting: "Lucha", Poison: "Veneno", Ground: "Tierra", Flying: "Volador",
  Psychic: "Psíquico", Bug: "Bicho", Rock: "Roca", Ghost: "Fantasma", Dragon: "Dragón",
  Dark: "Siniestro", Steel: "Acero", Fairy: "Hada", Stellar: "Astral", "???": "???"
};
export const COLOR_TIPO = {
  Normal: "#a8a77a", Fire: "#ee8130", Water: "#6390f0", Grass: "#7ac74c", Electric: "#f7d02c",
  Ice: "#96d9d6", Fighting: "#c22e28", Poison: "#a33ea1", Ground: "#e2bf65", Flying: "#a98ff3",
  Psychic: "#f95587", Bug: "#a6b91a", Rock: "#b6a136", Ghost: "#735797", Dragon: "#6f35fc",
  Dark: "#705746", Steel: "#b7b7ce", Fairy: "#d685ad", Stellar: "#40b5a5", "???": "#68a090"
};
export const STATS = { hp: "PS", atk: "Ataque", def: "Defensa", spa: "Ataque Especial", spd: "Defensa Especial", spe: "Velocidad", accuracy: "Precisión", evasion: "Evasión" };
export const STATS_CORTO = { hp: "PS", atk: "Atq", def: "Def", spa: "AtEsp", spd: "DefEsp", spe: "Vel" };
export const ESTADOS = { brn: "quemado", par: "paralizado", slp: "dormido", frz: "congelado", psn: "envenenado", tox: "gravemente envenenado" };
const ESTADO_FRASE = { brn: "se ha quemado", par: "está paralizado", slp: "se ha dormido", frz: "se ha congelado", psn: "ha sido envenenado", tox: "ha sido gravemente envenenado" };
const CLIMA = {
  SunnyDay: "El sol pega fuerte.", RainDance: "Empezó a llover.", Sandstorm: "Se levantó una tormenta de arena.",
  Hail: "Empezó a granizar.", Snow: "Empezó a nevar.", DesolateLand: "El sol es abrasador.",
  PrimordialSea: "Cae un diluvio.", DeltaStream: "Soplan corrientes de aire misteriosas.", none: "El tiempo volvió a la normalidad."
};
const CLIMA_SIGUE = { SunnyDay: "El sol sigue brillando.", RainDance: "Sigue lloviendo.", Sandstorm: "La tormenta de arena sigue.", Hail: "Sigue granizando.", Snow: "Sigue nevando." };
const CANT = {
  slp: "está dormido", frz: "está congelado", par: "está paralizado y no se puede mover", flinch: "retrocedió",
  recharge: "tiene que recuperarse", Taunt: "no puede usarlo por la Mofa", Disable: "tiene ese movimiento anulado",
  nopp: "no tiene PP", Truant: "está holgazaneando", Encore: "está atrapado por Otra Vez"
};
const quitaPrefijo = x => String(x || "").replace(/^(move|ability|item|condition): /, "");
/* Showdown marca algunos efectos con su id interno («protosynthesisatk»,
   «typechange»): son para su interfaz, no frases, y no se cuentan. */
const interno = x => /^[a-z0-9]+$/.test(quitaPrefijo(x));

/* `p1a: Garchomp` → «Garchomp» o «el Garchomp rival», según quien mira. */
function quien(id, yo) {
  const m = /^p(\d)[a-z]?: (.*)$/.exec(String(id || ""));
  if (!m) return String(id || "");
  const lado = Number(m[1]) - 1;
  return yo >= 0 && lado !== yo ? `${m[2]} rival` : m[2];
}
const desde = partes => {
  const f = partes.find(x => x.startsWith("[from]"));
  return f ? quitaPrefijo(f.slice(7).trim()) : "";
};

/* Una línea del protocolo → texto, o "" si no se cuenta. `yo` es 0/1
   para un jugador y -1 para quien mira. `nombres` son los de cada lado. */
export function relata(linea, yo = -1, nombres = ["", ""]) {
  const c = String(linea || "").split("|");
  const t = c[1];
  const q = x => quien(x, yo);
  const lado = x => Number(String(x || "").charAt(1)) - 1;
  switch (t) {
    case "turn": return `— Turno ${c[2]} —`;
    case "switch": case "drag": {
      const l = lado(c[2]);
      if (t === "drag") return `¡${q(c[2])} fue arrastrado al combate!`;
      const nom = String(c[2]).replace(/^p\d[a-z]?: /, "");
      return l === yo ? `¡Adelante, ${nom}!` : `${nombres[l] || "El rival"} envía a ${nom}.`;
    }
    case "move": {
      const extra = c.slice(4).some(x => x === "[miss]") ? " Pero falló." : "";
      return `${q(c[2])} usó ${c[3]}.${extra}`;
    }
    case "faint": return `¡${q(c[2])} se debilitó!`;
    case "-supereffective": return "¡Es muy eficaz!";
    case "-resisted": return "No es muy eficaz…";
    case "-immune": return `No afecta a ${q(c[2])}…`;
    case "-crit": return "¡Un golpe crítico!";
    case "-miss": return c[3] ? `${q(c[3])} esquivó el ataque.` : "¡El ataque falló!";
    case "-fail": return "¡Pero falló!";
    case "-ohko": return "¡Es un golpe fulminante!";
    case "-damage": {
      const f = desde(c);
      return f ? `${q(c[2])} sufre daño por ${f}.` : "";
    }
    case "-heal": {
      const f = desde(c);
      return f ? `${q(c[2])} recupera PS con ${f}.` : `${q(c[2])} recupera PS.`;
    }
    case "-status": return `¡${q(c[2])} ${ESTADO_FRASE[c[3]] || c[3]}!`;
    case "-curestatus": return `${q(c[2])} ya no está ${ESTADOS[c[3]] || c[3]}.`;
    case "-boost": case "-unboost": {
      const n = Number(c[4]) || 0;
      if (!n) return `¡${STATS[c[3]] || c[3]} de ${q(c[2])} no puede ${t === "-boost" ? "subir" : "bajar"} más!`;
      const cuanto = n >= 3 ? " muchísimo" : n === 2 ? " mucho" : "";
      return `¡${STATS[c[3]] || c[3]} de ${q(c[2])} ${t === "-boost" ? "subió" : "bajó"}${cuanto}!`;
    }
    case "-setboost": return `${q(c[2])} maximizó su ${STATS[c[3]] || c[3]}.`;
    case "-clearallboost": return "Se anularon todos los cambios de estadísticas.";
    case "-clearboost": return `Se anularon los cambios de estadísticas de ${q(c[2])}.`;
    case "-weather": {
      if (c.some(x => x === "[upkeep]")) return CLIMA_SIGUE[c[2]] || "";
      return CLIMA[c[2]] || "";
    }
    case "-fieldstart": return `Empieza ${quitaPrefijo(c[2])}.`;
    case "-fieldend": return `Termina ${quitaPrefijo(c[2])}.`;
    case "-sidestart": return `${quitaPrefijo(c[3])} en el lado de ${nombres[lado(c[2])] || "un entrenador"}.`;
    case "-sideend": return `Desaparece ${quitaPrefijo(c[3])} del lado de ${nombres[lado(c[2])] || "un entrenador"}.`;
    case "-terastallize": return `¡${q(c[2])} se teracristalizó en tipo ${TIPOS[c[3]] || c[3]}!`;
    case "-mega": return `¡${q(c[2])} megaevolucionó!`;
    case "-zpower": return `¡${q(c[2])} libera su Poder Z!`;
    case "-ability": return `${quitaPrefijo(c[3])} de ${q(c[2])}${desde(c) ? ` (${desde(c)})` : ""}.`;
    case "-item": return `${q(c[2])} tiene ${quitaPrefijo(c[3])}.`;
    case "-enditem": return c.some(x => x === "[eat]") ? `${q(c[2])} se comió su ${quitaPrefijo(c[3])}.` : `${q(c[2])} perdió su ${quitaPrefijo(c[3])}.`;
    case "-start": return interno(c[3]) ? "" : `${q(c[2])}: ${quitaPrefijo(c[3])}.`;
    case "-end": return interno(c[3]) ? "" : `${q(c[2])}: se acabó ${quitaPrefijo(c[3])}.`;
    case "-activate": return c[3] && !interno(c[3]) ? `${q(c[2])}: ${quitaPrefijo(c[3])}.` : "";
    case "-transform": return `¡${q(c[2])} se transformó en ${q(c[3])}!`;
    case "-formechange": case "detailschange": return `${q(c[2])} cambió de forma.`;
    case "cant": return `${q(c[2])} ${CANT[quitaPrefijo(c[3])] || "no puede moverse"}${c[4] ? ` (${c[4]})` : ""}.`;
    case "-hitcount": return `Golpeó ${c[3]} veces.`;
    case "-prepare": return `${q(c[2])} se prepara…`;
    case "-singleturn": case "-singlemove": return `${q(c[2])}: ${quitaPrefijo(c[3])}.`;
    case "win": return `🏆 ¡${c[2]} gana el combate!`;
    case "tie": return "El combate acaba en empate.";
    case "-message": case "raw": return c[2] && !/RNG was reset/.test(c[2]) ? c[2] : "";
    default: return "";
  }
}

/* Los textos de un tramo del registro ya filtrado por lado. */
export function relataTodo(lineas, yo, nombres) {
  const out = [];
  for (const l of lineas) { const t = relata(l, yo, nombres); if (t) out.push(t); }
  return out;
}
