/* Los protagonistas de los juegos principales, para elegir el aspecto de
   tu entrenador. PokeAPI/sprites no guarda entrenadores, así que estos
   son los de Pokémon Showdown (play.pokemonshowdown.com/sprites/trainers),
   que es lo que usa el propio Showdown como avatar. Si alguno no carga,
   la pantalla pinta la inicial en un círculo del color de la región. */
export const ENTRENADORES = [
  { id: "red", n: "Rojo", g: 1 }, { id: "leaf", n: "Hoja", g: 1 },
  { id: "ethan", n: "Eco", g: 2 }, { id: "lyra", n: "Lira", g: 2 }, { id: "kris", n: "Kris", g: 2 },
  { id: "brendan", n: "Bruno", g: 3 }, { id: "may", n: "Aura", g: 3 },
  { id: "lucas", n: "Lucas", g: 4 }, { id: "dawn", n: "Maya", g: 4 },
  { id: "hilbert", n: "Lysson", g: 5 }, { id: "hilda", n: "Liza", g: 5 },
  { id: "nate", n: "Nate", g: 5 }, { id: "rosa", n: "Rosa", g: 5 },
  { id: "calem", n: "Calem", g: 6 }, { id: "serena", n: "Serena", g: 6 },
  { id: "elio", n: "Elio", g: 7 }, { id: "selene", n: "Selene", g: 7 },
  { id: "victor", n: "Víctor", g: 8 }, { id: "gloria", n: "Gloria", g: 8 },
  { id: "florian", n: "Florian", g: 9 }, { id: "juliana", n: "Juliana", g: 9 }
];
export const REGIONES = ["", "Kanto", "Johto", "Hoenn", "Sinnoh", "Teselia", "Kalos", "Alola", "Galar", "Paldea"];
const COLOR = ["#888", "#e3350d", "#c9a227", "#1e88e5", "#7e57c2", "#455a64", "#00897b", "#f57c00", "#8e24aa", "#d81b60"];
export const SKIN_POR = "red";
export const entrenador = id => ENTRENADORES.find(e => e.id === id) || ENTRENADORES[0];
export const urlEntrenador = id => `https://play.pokemonshowdown.com/sprites/trainers/${entrenador(id).id}.png`;
export const colorRegion = id => COLOR[entrenador(id).g] || COLOR[0];
/* Lo que llega de la base o del registro: solo un id de la lista. */
export const skinSana = id => (ENTRENADORES.some(e => e.id === id) ? id : SKIN_POR);
/* La imagen, con su plan B si el servidor no la sirve. */
export function htmlEntrenador(id, clase = "") {
  const e = entrenador(skinSana(id));
  return `<span class="jg-pk-ent ${clase}" style="--c:${colorRegion(e.id)}" title="${e.n} · ${REGIONES[e.g]}">` +
    `<img src="${urlEntrenador(e.id)}" alt="${e.n}" loading="lazy" onerror="this.remove()"><b>${e.n.charAt(0)}</b></span>`;
}
