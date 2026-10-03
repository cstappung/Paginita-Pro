/* Los formatos de Pokémon que se pueden elegir al abrir sala. Viven
   aparte del motor para que el vestíbulo pueda ofrecerlos sin bajar el
   simulador entero (`juegos-pokemon.js`). */
export const FORMATOS = {
  gen9ou: "Gen 9 · OU",
  gen9ubers: "Gen 9 · Ubers",
  gen9uu: "Gen 9 · UU",
  gen9ru: "Gen 9 · RU",
  gen9nu: "Gen 9 · NU",
  gen9pu: "Gen 9 · PU",
  gen9lc: "Gen 9 · Little Cup",
  gen9monotype: "Gen 9 · Monotype",
  gen9nationaldex: "Gen 9 · National Dex",
  gen9anythinggoes: "Gen 9 · Anything Goes",
  gen9customgame: "Libre (sin reglas de tier)",
  gen9randombattle: "Gen 9 · Random Battle",
  gen8randombattle: "Gen 8 · Random Battle",
  gen7randombattle: "Gen 7 · Random Battle",
  gen8ou: "Gen 8 · OU",
  gen7ou: "Gen 7 · OU",
  gen6ou: "Gen 6 · OU",
  gen5ou: "Gen 5 · OU",
  gen4ou: "Gen 4 · OU",
  gen3ou: "Gen 3 · OU",
  gen2ou: "Gen 2 · OU",
  gen1ou: "Gen 1 · OU"
};
export const FORMATO_POR = "gen9ou";
export const formatoDe = f => (FORMATOS[f] ? f : FORMATO_POR);
export const genDe = f => Number((/^gen(\d+)/.exec(formatoDe(f)) || [])[1] || 9);

/* Random Battle: el equipo no se elige, lo arma el generador de
   Showdown (`@pkmn/randoms`, los mismos sets curados del servidor). */
export const esAleatorio = f => /randombattle$/.test(formatoDe(f));
