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

/* Los rivales de la Frontera Batalla: cualquier sprite de entrenador de
   Showdown (genéricos, líderes, Alto Mando, campeones, Ases). Se prueba
   el id, luego su versión de tercera y cuarta generación, y si ninguno
   carga queda la inicial. En el estado de la pelea viajan como skin
   `x:<id>:<nombre>`, para no confundirlos con los protagonistas. */
const escH = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const urlsRival = id => {
  const b = String(id || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const u = n => `https://play.pokemonshowdown.com/sprites/trainers/${n}.png`;
  return b.endsWith("-gen3") || b.endsWith("-gen4") ? [u(b)] : [u(b), u(b + "-gen3"), u(b + "-gen4")];
};
export function htmlRival(id, nombre, clase = "") {
  const urls = urlsRival(id);
  return `<span class="jg-pk-ent ${clase}" style="--c:#5c6bc0" title="${escH(nombre)}">` +
    `<img src="${urls[0]}" alt="${escH(nombre)}" loading="lazy" data-urls="${escH(JSON.stringify(urls.slice(1)))}" ` +
    `onerror="var u=JSON.parse(this.dataset.urls||'[]');if(u.length){this.dataset.urls=JSON.stringify(u.slice(1));this.src=u[0]}else{this.remove()}">` +
    `<b>${escH(String(nombre || "?").charAt(0))}</b></span>`;
}
export const skinRival = (id, nombre) => `x:${id}:${nombre}`;
/* Un skin cualquiera del estado: protagonista o rival de la Frontera. */
export function htmlSkin(sk, clase = "") {
  const s = String(sk || "");
  if (s.startsWith("x:")) { const i = s.indexOf(":", 2); return htmlRival(s.slice(2, i < 0 ? undefined : i), i < 0 ? "" : s.slice(i + 1), clase); }
  return htmlEntrenador(s || SKIN_POR, clase);
}
