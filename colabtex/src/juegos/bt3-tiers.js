/* BT3: las reglas de personajes de la sala (duelo y torneo), sacadas de una tier list.

   La lista es la imagen «BT3 tier list according to comp discord» (r/tenkaichi4, 11kz9zd): 161 retratos, uno
   por personaje y forma, que es justo como el juego numera a sus personajes (ids 0..160, cada forma con el
   suyo). Dos reglas, una u otra (o ninguna):
   - `noop` («No OP»): fuera los de tier S hacia arriba (BROLY, S++, S+ y S).
   - `malos` («Sólo malos»): solo de B hacia abajo, o sea fuera también los de A. Los N/C (los gigantes: los
     simios, Hirudegarn…) quedan permitidos: la lista no los pone sobre B.

   El juego no trae los nombres en el código: están en el disco. Al abrir la selección de personajes, el juego le
   pasa a su página los 161 nombres con su forma (`Web_Catalogo`, del parche), la página se los manda a la
   sala y aquí se cruzan con la lista: `vetadosBt3(catalogo, regla)` da los ids que no se pueden elegir. El
   marco los guarda en `Module.vetados` y el juego (parcheado) no deja elegirlos ni los saca al azar. Los dos
   jugadores leen el mismo disco y la misma regla, así que los dos juegos rechazan lo mismo.

   Cada entrada es [nombre en la sala, búsqueda, excluye]: la búsqueda son palabras que deben estar TODAS en
   «nombre + forma» del juego (una palabra con «/» acepta cualquiera de sus variantes; varias búsquedas
   separadas por «|» se prueban en orden, la primera que encuentra algo gana), y las que excluye no pueden estar.
   Si hay varios candidatos queda el que tiene menos palabras de más. Los retratos se identificaron a ojo; la
   sala muestra con qué nombre del juego quedó cada uno, para revisarlo. */

// Lo que el juego escribe distinto según el personaje, llevado a una sola palabra.
const CAMBIOS = [
  [/legendary super saiyan|legendary ssj|lssj/g, " lssj "],
  [/super saiyan ?4|ssj ?4|ss ?4/g, " ssj4 "],
  [/super saiyan ?3|ssj ?3|ss ?3/g, " ssj3 "],
  [/super saiyan ?2|ssj ?2|ss ?2/g, " ssj2 "],
  [/super saiyan|\bssj\b|\bss\b/g, " ssj "],
  [/semi[- ]?perfect/g, " semiperfect "],
  [/super perfect|perfect form \(power[- ]weighted\)|power[- ]weighted/g, " superperfect "],
  [/full power|100 ?%/g, " fullpower "],
  [/great ape|oozaru/g, " ape "],
  [/\b1st\b/g, " first "], [/\b2nd\b/g, " second "], [/\b3rd\b/g, " third "], [/\b4th\b/g, " fourth "], [/\b5th\b/g, " fifth "],
  [/\blate\b/g, " end "], [/\bmiddle\b/g, " mid "], [/\bstart\b/g, " early "], [/\byoung\b/g, " teen "], [/\bchild\b/g, " kid "],
  [/freeza|freezer/g, "frieza"], [/vegetto/g, "vegito"], [/\bboo\b/g, "buu"], [/armou?red/g, "armor"],
];
const VACIAS = new Set(["form", "of", "the", "base", "normal", "mode", "no", "android", "c"]);

export function palabrasBt3(texto) {
  let t = " " + String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + " ";
  t = t.replace(/[#.]/g, " ");
  for (const [re, por] of CAMBIOS) t = t.replace(re, por);
  return new Set(t.split(/[^a-z0-9]+/).filter(w => w && !VACIAS.has(w)));
}

/* Las 46 de A hacia arriba, por tier (lo de B para abajo no hace falta: siempre se puede elegir). El orden es el
   de la imagen, fila por fila. */
const FORMAS = "ssj ssj2 ssj3 ssj4 lssj ape fullpower";
export const BT3_TIERS = {
  BROLY: [
    ["Broly (Super Saiyan Legendario)", "broly lssj", ""],
  ],
  "S++": [
    ["Cell (Súper Perfecto)", "cell superperfect", ""],
    ["Androide 17", "17", "super hell " + FORMAS],
  ],
  "S+": [
    ["Trunks (armadura)", "trunks armor|trunks battle|trunks", "sword kid gt " + FORMAS],
    ["Majin Buu", "majin buu|fat buu|buu", "super kid evil pure gotenks gohan absorbed"],
    ["Gohan (adulto) Super Saiyan 2", "gohan adult ssj2|gohan ssj2", "teen kid"],
  ],
  S: [
    ["Arale", "arale", ""],
    ["Baby (Gran Simio dorado)", "baby ape|golden ape", ""],
    ["Trunks (armadura) Super Saiyan", "trunks armor ssj|trunks battle ssj|trunks ssj", "sword kid gt ssj2 ssj3"],
    ["Vegito", "vegito", "super ssj"],
    ["Super 17", "super 17", ""],
    ["Gogeta Super Saiyan 4", "gogeta ssj4", ""],
    ["Super Vegito", "super vegito|vegito ssj", ""],
  ],
  A: [
    ["Gohan (joven) Super Saiyan 2", "gohan teen ssj2", ""],
    ["Súper Androide 13", "super 13|13 fusion", ""],
    ["Androide 18", "18", ""],
    ["Babidi", "babidi", ""],
    ["Burter", "burter", ""],
    ["Cell Semi-Perfecto", "cell semiperfect|cell second", ""],
    ["Cooler (forma final)", "cooler final|cooler fifth", "meta"],
    ["Dabura", "dabura", ""],
    ["Nail", "nail", "piccolo"],
    ["Freezer (tercera forma)", "frieza third", ""],
    ["Freezer (100 %)", "frieza fullpower", ""],
    ["Goku (fin) Super Saiyan", "goku end ssj", "ssj2 ssj3"],
    ["Gogeta Super Saiyan", "gogeta ssj", "ssj4"],
    ["Goku (fin)", "goku end", FORMAS],
    ["Goku Super Saiyan 4", "goku ssj4", ""],
    ["Goku (medio) Super Saiyan", "goku mid ssj", ""],
    ["Gotenks Super Saiyan", "gotenks ssj", "ssj3"],
    ["Gotenks", "gotenks", FORMAS],
    ["Trunks (niño) Super Saiyan", "trunks kid ssj", ""],
    ["Trunks (niño)", "trunks kid", FORMAS],
    ["Uub", "majuub|uub", ""],
    ["Mr. Popo", "popo", ""],
    ["Piccolo (fusionado con Kami)", "piccolo kami|piccolo fused|piccolo end", "nail"],
    ["Super Baby 2", "baby 2|baby ssj", ""],
    ["Super Buu", "super buu", "gotenks gohan absorbed"],
    ["Super Buu (absorbe a Gotenks)", "buu gotenks", ""],
    ["Vegeta (fin) Super Saiyan", "vegeta end ssj", "ssj2 ssj3 super"],
    ["Omega Shenron", "omega", ""],
    ["Gohan (joven) Super Saiyan", "gohan teen ssj", "ssj2"],
    ["Vegeta (fin) Super Saiyan 2", "vegeta end ssj2|vegeta ssj2", "majin"],
    ["Vegeta Super Saiyan 4", "vegeta ssj4", ""],
    ["Vegeta (medio) Super Saiyan", "vegeta mid ssj|vegeta early ssj", "ssj2"],
  ],
};
/* (Un retrato de S+ no se pudo reconocer: uno dorado con orejas en punta y armadura. Queda fuera de la regla
   hasta que se sepa quién es.) */

export const BT3_VETOS = { "": "Todos", noop: "No OP", malos: "Sólo malos" };
export const BT3_VETOS_TXT = {
  "": "Se puede elegir cualquier personaje.",
  noop: "Fuera los de tier S hacia arriba (BROLY, S++, S+ y S).",
  malos: "Solo los de tier B hacia abajo (fuera también los de A).",
};
export const tiersVetadas = regla => regla === "noop" ? ["BROLY", "S++", "S+", "S"] : regla === "malos" ? ["BROLY", "S++", "S+", "S", "A"] : [];
export const entradasVetadas = regla => tiersVetadas(regla).flatMap(t => BT3_TIERS[t].map(e => ({ tier: t, nombre: e[0], busca: e[1], excluye: e[2] })));

const PALABRAS = new WeakMap();   // (las palabras de cada personaje del catálogo, calculadas una vez)
// Busca una entrada en el catálogo: los ids que quedan (normalmente uno).
export function buscaBt3(cat, busca, excluye = "") {
  const fuera = [...palabrasBt3(excluye)];
  for (const alt of busca.split("|")) {
    const req = alt.trim().split(/\s+/).filter(Boolean).map(w => w.split("/").flatMap(v => [...palabrasBt3(v)]));
    if (!req.length) continue;
    let mejor = Infinity, ids = [];
    cat.forEach((c, id) => {
      if (!c) return;
      let p = PALABRAS.get(c);
      if (!p) PALABRAS.set(c, p = palabrasBt3(c.nombre + " " + c.forma));
      if (!req.every(alts => alts.some(w => p.has(w))) || fuera.some(w => p.has(w))) return;
      const sobra = p.size - req.length;
      if (sobra < mejor) { mejor = sobra; ids = [id]; } else if (sobra === mejor) ids.push(id);
    });
    if (ids.length) return ids;
  }
  return [];
}

/* El catálogo que manda el juego, [[códigos del nombre], [códigos de la forma]] por id, a texto. Los caracteres
   son de 16 bits (el juego los guarda con el byte alto primero; el parche ya los da como números). */
export function catalogoBt3(lista) {
  if (!Array.isArray(lista)) return [];
  const txt = a => Array.isArray(a) ? String.fromCharCode(...a.filter(c => Number.isInteger(c) && c >= 32 && c < 0xFFFE).slice(0, 64)).replace(/\s+/g, " ").trim() : "";
  return lista.slice(0, 161).map(e => Array.isArray(e) ? { nombre: txt(e[0]), forma: txt(e[1]) } : null);
}

/* Los ids que la regla deja fuera, con lo que encontró cada entrada (para mostrarlo en la sala). */
export function vetadosBt3(cat, regla) {
  const ids = new Set(), detalle = [];
  for (const e of entradasVetadas(regla)) {
    const hay = cat && cat.length ? buscaBt3(cat, e.busca, e.excluye) : [];
    hay.forEach(i => ids.add(i));
    detalle.push({ tier: e.tier, nombre: e.nombre, juego: hay.map(i => [cat[i].nombre, cat[i].forma].filter(Boolean).join(" · ")) });
  }
  return { ids: [...ids].sort((a, b) => a - b), detalle };
}
