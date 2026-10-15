/* BT3: las reglas de personajes de la sala (duelo y torneo), sacadas de una tier list.

   La lista es la imagen «BT3 tier list according to comp discord» (r/tenkaichi4, 11kz9zd): 161 retratos, uno
   por personaje y forma, que es justo como el juego numera a sus personajes (ids 0..160, cada forma con el
   suyo). Dos reglas, una u otra (o ninguna):
   - `noop` («No OP»): fuera los de tier S hacia arriba (BROLY, S++, S+ y S).
   - `malos` («Sólo malos»): solo de C hacia abajo, o sea fuera también los de A y B. Los N/C (los gigantes:
     los simios, Hirudegarn…) quedan permitidos: la lista no los pone sobre C.

   El juego no trae los nombres en el código: están en el disco. Al abrir la selección de personajes, el juego le
   pasa a su página los 161 nombres con su forma (`Web_Catalogo`, del parche), la página se los manda a la
   marco del juego, que los cruza con la lista en ese mismo instante (`vetadosBt3(catalogo, regla)`, por
   `BT3Sala.vetadosDe` de bt3-marco.js) y los deja en `Module.vetados` antes de que el juego arme su grilla: el juego
   (parcheado) los trata como personajes sin desbloquear (candado, el cursor se los salta) y no deja transformarse
   en ellos. La sala hace la misma cuenta para mostrar la lista. Los dos
   jugadores leen el mismo disco y la misma regla, así que los dos juegos rechazan lo mismo.

   Cada entrada es [nombre en la sala, búsqueda, excluye]: la búsqueda son palabras que deben estar TODAS en
   «nombre + forma» del juego (una palabra con «/» acepta cualquiera de sus variantes; varias búsquedas
   separadas por «|» se prueban en orden, la primera que encuentra algo gana), y las que excluye no pueden estar.
   Si hay varios candidatos queda el que tiene menos palabras de más. Los retratos se identificaron a ojo (el dorado
   de S+ es Nuova Shenron); la sala muestra con qué nombre del juego quedó cada uno. */

/* El disco puede traer los nombres en español (el del dueño: «Goku (inicio)», «Joven Gohan», «Célula · Forma perfecta»,
   «Gran mono Vegeta», «Pequeño Bu»…): primero sus palabras pasan a las de la lista (en inglés). Van antes que CAMBIOS
   porque «super saiyan legendario» tiene que ganarle a «super saiyan». «ª» no se descompone con NFD: se trata aparte. */
const CAMBIOS_ES = [
  [/super saiyan legendario|ssj legendario/g, " lssj "],
  [/gran mono/g, " ape "],
  [/(\d)\s*ª/g, "$1a"],
  [/\b1a forma\b/g, " first "], [/\b2a forma\b/g, " second "], [/\b3a forma\b/g, " third "],
  [/forma perfecta/g, " perfect "], [/\bperfecto\b/g, " superperfect "],   // (Célula: la «forma perfecta» y la última, «Perfecto»)
  [/maldad pura/g, " pure evil "], [/poder maximo/g, " max power "],
  [/\binicio\b/g, " early "], [/\bmedio\b|\bmed\b/g, " mid "], [/\bfin\b/g, " end "],
  [/\bnino\b|\bpequeno\b/g, " kid "], [/\bjoven\b/g, " teen "], [/\bdefinitivo\b/g, " ultimate "], [/\bfuturo\b/g, " future "],
  [/\bexplorador\b/g, " scouter "], [/\bespada\b/g, " sword "], [/\babuelo\b/g, " grandpa "], [/\brey\b/g, " king "],
  [/\bcelula\b/g, " cell "], [/\btransformado\b/g, " transform "], [/\babsorbido\b/g, " absorbed "], [/\bgigante\b/g, " giant "],
  [/\bsoldado\b/g, " soldier "],   // («Soldado de Freezer»)
  [/\bbu\b/g, " buu "],
];
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
const VACIAS = new Set(["form", "of", "the", "base", "normal", "mode", "no", "android", "c", "del", "de", "la", "el", "los", "las", "forma", "androide"]);

export function palabrasBt3(texto) {
  let t = " " + String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() + " ";
  t = t.replace(/[#.]/g, " ");
  for (const [re, por] of CAMBIOS_ES) t = t.replace(re, por);
  for (const [re, por] of CAMBIOS) t = t.replace(re, por);
  return new Set(t.split(/[^a-z0-9]+/).filter(w => w && !VACIAS.has(w)));
}

/* La tier list entera: los 161 retratos, por tier y en el orden de la imagen (fila por fila), con los nombres de la lista
   del dueño (un JSON). Donde ese JSON repetía un nombre, el dueño o la imagen decidieron: el Cell de S++ es el
   Perfecto y el de B su última transformación (el Súper Perfecto), el de A que el JSON llamaba «Bojack - Full Power» es el Súper Androide 13 (piel
   azul, pelo rojo; el Bojack de máximo poder, verde, está en B), uno de los «Salza» de C es Nappa y una de las «Pan» de
   D es Chi-Chi niña y uno de los «Spopovich» de D es la Pilaf Machine (la normal; la combinada es N/C). Cada forma es un retrato aparte (Goku (fin), su SSJ, su SSJ2 y su SSJ3 son cuatro), y la regla
   vale también para transformarse o fusionarse en plena pelea. */
const FORMAS = "ssj ssj2 ssj3 ssj4 lssj ape fullpower";
export const BT3_ORDEN = ["BROLY", "S++", "S+", "S", "A", "B", "C", "D", "N/C"];
export const BT3_TIERS = {
  BROLY: [
    ["Broly - Legendary Super Saiyan", "broly lssj", ""],
  ],
  "S++": [
    ["Cell - Perfect Form", "cell perfect", "semiperfect superperfect imperfect"],
    ["Android 17", "17", "super hell " + FORMAS],
  ],
  "S+": [
    ["Trunks (Fighting) - Base", "trunks armor|trunks battle|trunks fighting|trunks", "sword kid gt super future " + FORMAS],
    ["Nuova Shenron", "nuova|nova shenron|neo shenron", ""],
    ["Kid Buu", "kid buu|buu kid|pure buu", ""],
    ["Gohan (Adult) - Super Saiyan 2", "gohan adult ssj2|gohan ssj2", "teen kid future"],
  ],
  S: [
    ["Arale", "arale", ""],
    ["Great Ape Baby", "baby ape|golden ape", ""],
    ["Trunks (Fighting) - Super Saiyan", "trunks armor ssj|trunks battle ssj|trunks fighting ssj|trunks ssj", "kid sword super ssj2 future"],
    ["Vegito (normal)", "vegito", "super ssj"],   // (el JSON decía «Vegito - Super Saiyan»: el de la imagen es el normal, de pelo negro)
    ["Super Android 17", "super 17|17 super", ""],
    ["Gogeta (GT) - Super Saiyan 4", "gogeta ssj4", ""],
    ["Super Vegito (Super Saiyan)", "super vegito|vegito ssj", ""],
  ],
  A: [
    ["Gohan (Teen) - Super Saiyan 2", "gohan teen ssj2", ""],
    ["Super Android 13", "13 super|super 13|13 fusion", ""],
    ["Android 18", "18", ""],
    ["Babidi", "babidi", ""],
    ["Burter", "burter", ""],
    ["Cell - Second Form", "cell semiperfect|cell second", ""],
    ["Cooler - Final Form", "cooler final|cooler fifth", "meta metal"],
    ["Dabura", "dabura|dabra", ""],
    ["King Piccolo", "king piccolo|piccolo king|piccolo daimao", ""],
    ["Frieza - Third Form", "frieza third", ""],
    ["Frieza - Full Power", "frieza fullpower", ""],
    ["Gohan (Adult) - Super Saiyan", "gohan adult ssj|gohan ssj", "ssj2 teen kid future"],
    ["Super Gogeta (Z) - Super Saiyan", "gogeta ssj|super gogeta", "ssj4"],
    ["Goku (Early) - Base", "goku early", FORMAS],
    ["Goku (GT) - Super Saiyan 4", "goku ssj4", ""],
    ["Goku (Mid) - Super Saiyan", "goku mid ssj", ""],
    ["Gotenks - Super Saiyan", "gotenks ssj", "ssj3"],
    ["Gotenks - Base", "gotenks", FORMAS + " buu absorbed"],
    ["Trunks (Kid) - Super Saiyan", "trunks kid ssj", ""],
    ["Trunks (Kid) - Base", "trunks kid", FORMAS],
    ["Majuub", "majuub|uub ssj", ""],
    ["Nam", "nam|namu", ""],
    ["Piccolo (End)", "piccolo end", "kami fused nail sync king"],
    ["Super Baby 2", "super baby 2|baby 2", ""],
    ["Super Buu - Base", "super buu", "gotenks gohan absorbed"],
    ["Super Buu - Gotenks Absorbed", "buu gotenks", ""],
    ["Super Vegeta", "super vegeta|vegeta super", "ssj4 baby gt monstruo"],
    ["Syn Shenron", "syn shenron|shin shenron|syn", "omega yi long"],
    ["Gohan (Teen) - Super Saiyan", "gohan teen ssj", "ssj2"],
    ["Vegeta (Second Form) - Super Saiyan 2", "vegeta ssj2", "majin"],
    ["Vegeta (GT) - Super Saiyan 4", "vegeta ssj4", ""],
    ["Vegeta (Second Form) - Super Saiyan", "vegeta second ssj|vegeta mid ssj|vegeta early ssj", "ssj2 ssj4"],
  ],
  B: [
    ["Gohan (Future) - Super Saiyan", "gohan future ssj", ""],
    ["Android 16", "16", ""],
    ["Baby Vegeta - Base", "baby vegeta", "super ssj 1 2 ape"],
    ["Bardock", "bardock", FORMAS],
    ["Bojack - Full Power", "bojack fullpower|bojack full", ""],
    ["Broly - Super Saiyan", "broly ssj", "lssj"],
    ["Cell - First Form", "cell imperfect|cell first|cell", "semiperfect perfect superperfect jr second"],
    ["Cell Jr.", "cell jr|jr", ""],
    ["Cell - Super Perfect Form", "cell superperfect", ""],   // (la última transformación de Cell: el dueño)
    ["Chiaotzu", "chiaotzu|chaozu|chaos", ""],
    ["Cyborg Tao", "cyborg tao|tao cyborg|murasaki", ""],
    ["Evil Buu", "evil buu|pure evil|evil", "kid super"],
    ["Fasha", "fasha|celipa", "ape"],
    ["Frieza - First Form", "frieza first|frieza", "second third final fullpower mecha soldier ape"],
    ["Frieza - Second Form", "frieza second", ""],
    ["Frieza - Final Form", "frieza final", "fullpower"],
    ["Gohan (Future) - Base", "gohan future", FORMAS],
    ["Goku (End) - Super Saiyan 2", "goku end ssj2", ""],
    ["Goku (End) - Super Saiyan 3", "goku end ssj3", ""],
    ["Goku (GT) - Super Saiyan 3", "goku gt ssj3", ""],
    ["Goku (GT) - Base", "goku gt", FORMAS],
    ["Goten - Super Saiyan", "goten ssj", ""],
    ["Gotenks - Super Saiyan 3", "gotenks ssj3", ""],
    ["Great Saiyaman", "great saiyaman|saiyaman", "2 videl"],
    ["Krillin", "krillin|kuririn|krilin", ""],
    ["Mecha Frieza", "mecha frieza", ""],
    ["Nail", "nail", "piccolo sync"],
    ["Omega Shenron", "omega|yi long|super yi", ""],   // (en español: «Shin Shenron · Súper Yi-Shin-Long»)
    ["Piccolo (Early)", "piccolo early", "kami fused nail sync king"],
    ["Recoome", "recoome", ""],
    ["Super Baby 1", "super baby 1|baby 1", "2"],
    ["Super Buu - Gohan Absorbed", "buu gohan", ""],
    ["Super Trunks", "super trunks|trunks armor super|trunks battle super", "sword kid gt"],
    ["Trunks (Sword) - Super Saiyan", "trunks sword ssj", ""],
    ["Tapion", "tapion", ""],
    ["Ultimate Gohan", "ultimate gohan|gohan ultimate", ""],
    ["Tien", "tien|tenshinhan", ""],
    ["Uub", "uub|ub", "majuub ssj"],
    ["Vegeta (End) - Super Saiyan", "vegeta end ssj|vegeta ssj", "ssj2 ssj3 ssj4 super second scouter majin baby"],   // (en español: «Vegeta · Super Saiyan»)
    ["Majin Vegeta", "majin vegeta|vegeta monstruo", ""],   // (en español: «Vegeta 2ª forma · Monstruo», dice el dueño)
    ["Vegeta (Scouter)", "vegeta scouter", "ape"],
    ["Vegeta (Second Form) - Base", "vegeta second|vegeta mid|vegeta early", FORMAS + " super monstruo majin"],
    ["Yamcha", "yamcha", ""],
    ["Zarbon - Transformed", "zarbon post|zarbon transform|zarbon monster", ""],
  ],
  C: [
    ["Gohan (Adult) - Base", "gohan adult|gohan", FORMAS + " ultimate kid teen future grandpa absorbed saiyaman"],   // (en español, solo «Gohan»)
    ["Android 13 - Base", "13", "super fusion"],
    ["Cui", "cui", ""],
    ["Bojack - Base", "bojack", "fullpower full"],
    ["Captain Ginyu", "ginyu", ""],
    ["Appule", "appule", ""],
    ["Devilman", "devilman|devil man", ""],
    ["Dodoria", "dodoria", ""],
    ["Dr. Gero (Android 20)", "gero|20", ""],
    ["Goku (End) - Super Saiyan", "goku end ssj", "ssj2 ssj3"],
    ["Goku (End) - Base", "goku end", FORMAS],
    ["Goku (GT) - Super Saiyan", "goku gt ssj", "ssj3 ssj4"],
    ["Goku (Mid) - Base", "goku mid", FORMAS],
    ["Goten - Base", "goten", FORMAS],
    ["Jeice", "jeice", ""],
    ["Kibito Kai", "kibito kai|kibitoshin|kibito", ""],
    ["Gohan (Kid)", "gohan kid", FORMAS],
    ["King Vegeta", "king vegeta|vegeta king", "ape"],
    ["Majin Buu (Good)", "majin buu|fat buu|monstruo buu|buu", "super kid evil pure gotenks gohan absorbed"],
    ["Metal Cooler", "metal cooler|meta cooler|cooler metal|cooler meta", ""],
    ["Nappa", "nappa", "ape"],
    ["Pikkon", "pikkon|paikuhan", ""],
    ["Raditz", "raditz", "ape"],
    ["Saibaman", "saibaman|saibamen", ""],
    ["Salza", "salza", ""],
    ["Super Garlic Jr.", "super garlic|garlic super", ""],
    ["Super Janemba", "super janemba|janemba super|janemba evil", "giant fat"],
    ["Trunks (Sword) - Base", "trunks sword", FORMAS],
    ["Tambourine", "tambourine|tamborine|pandereta", ""],
    ["Gohan (Teen) - Base", "gohan teen", FORMAS],
    ["Turles", "turles|tullece", "ape"],
    ["Vegeta (End) - Base", "vegeta end|vegeta", FORMAS + " super second scouter majin king baby monstruo"],   // (en español, solo «Vegeta»)
    ["Yajirobe", "yajirobe|yajirobai", ""],
    ["Zarbon - Base", "zarbon", "post transform monster"],
  ],
  D: [
    ["Android 19", "19", ""],
    ["Android 8", "8|hatchan", ""],
    ["Broly - Base", "broly", FORMAS],
    ["Chi-Chi (Kid)", "chi chi|chichi", ""],   // (el JSON tenía dos «Pan»: una es la Chi-Chi niña, la del casco rosado)
    ["Cooler - Base", "cooler", "final fifth metal meta"],
    ["Frieza Soldier", "soldier", ""],
    ["Garlic Jr. - Base", "garlic", "super"],
    ["General Blue", "blue", ""],
    ["General Tao", "tao|taopaipai", "cyborg"],
    ["Grandpa Gohan", "grandpa gohan|gohan grandpa", ""],
    ["Great Saiyaman 2", "great saiyaman 2|saiyaman 2|videl saiyaman", ""],
    ["Guldo", "guldo|gurd", ""],
    ["Mr. Satan", "satan|hercule", ""],
    ["Goku (Kid)", "kid goku|goku kid", "ape"],
    ["King Cold", "king cold|cold", ""],
    ["Master Roshi - Base", "roshi|master roshi|kame", "max power muscle"],
    ["Master Roshi - Max Power", "roshi max|roshi power|roshi muscle", ""],
    ["Pan", "pan", ""],
    ["Lord Slug - Base", "slug", "giant"],
    ["Spopovich", "spopovich", ""],
    ["Pilaf Machine - Base", "pilaf", "combined giant fusion"],   // (el JSON tenía dos «Spopovich»: uno es la máquina de Pilaf)
    ["Supreme Kai", "supreme kai|kaioshin|kaiyoshin", "kibito"],
    ["Videl - Base", "videl", "saiyaman"],
    ["Zangya", "zangya", ""],
  ],
  "N/C": [
    ["Dr. Wheelo", "wheelo|willow", ""],
    ["Great Ape Bardock", "bardock ape", ""],
    ["Great Ape Fasha", "fasha ape", ""],
    ["Great Ape Kid Goku", "goku ape|kid goku ape|ape", ""],   // (en el disco del dueño es «Gran Mono» a secas: el simio sin otro nombre)
    ["Great Ape Nappa", "nappa ape", ""],
    ["Great Ape King Vegeta", "king vegeta ape", ""],
    ["Great Ape Raditz", "raditz ape", ""],
    ["Great Ape Turles", "turles ape", ""],
    ["Great Ape Vegeta", "vegeta ape", "king baby"],
    ["Hirudegarn", "hirudegarn|hildegarn", ""],
    ["Janemba - Giant Form", "janemba", "super evil"],
    ["Lord Slug - Giant Form", "slug giant", ""],
    ["Pilaf Machine - Combined Form", "pilaf combined|pilaf fusion|pilaf", ""],   // (en español: «Máquina Pilaf · Fusión»)
  ],
};

/* Las reglas. Cada una dice qué tiers SE PERMITEN (así las pidió el dueño):
   - `noop` («No OP»): solo A, B, C y D (fuera BROLY, S++, S+, S y también los gigantes N/C).
   - `malos` («Sólo malos»): solo C y D.
   - `gigantes` («Sólo gigantes»): solo N/C (los Grandes Simios, Hirudegarn, Janemba gigante…), y además el Gran
     Simio de Baby, que en la lista es S pero es un gigante (`PERMITE_TAMBIEN`).
   Un personaje del juego que la lista no nombra queda fuera en las tres: la regla dice qué se permite, y lo que no se
   reconoce no entra. */
export const BT3_VETOS = { "": "Todos", noop: "No OP", malos: "Sólo malos", gigantes: "Sólo gigantes" };
export const BT3_VETOS_TXT = {
  "": "Se puede elegir cualquier personaje.",
  noop: "Solo los de tier A, B, C y D (fuera BROLY, S++, S+, S y los gigantes N/C).",
  malos: "Solo los de tier C y D.",
  gigantes: "Solo los gigantes: tier N/C (los Grandes Simios, Hirudegarn, Janemba gigante, Slug gigante…) y el Gran Simio de Baby.",
};
const PERMITE = { noop: ["A", "B", "C", "D"], malos: ["C", "D"], gigantes: ["N/C"] };
// personajes sueltos que una regla permite aunque su tier no (por el nombre de su entrada)
const PERMITE_TAMBIEN = { gigantes: new Set(["Great Ape Baby"]) };
export const tiersPermitidas = regla => PERMITE[regla] || BT3_ORDEN;
export const tiersVetadas = regla => regla && PERMITE[regla] ? BT3_ORDEN.filter(t => !PERMITE[regla].includes(t)) : [];
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
   son de 16 bits, UTF-16 con el byte BAJO primero (como los lee el juego; el parche ya los da como números).
   Hasta bt3-12 el parche los leía al revés: «G» (0x0047) llegaba como 0x4700, un ideograma, ningún nombre coincidía
   con la tier list y no se vetaba nada. Esas listas quedaron guardadas en los navegadores (`bt3.catalogo`), así que
   una lista donde la mayoría de los caracteres tienen el byte bajo en cero se da vuelta aquí. */
export function catalogoBt3(lista) {
  if (!Array.isArray(lista)) return [];
  let altos = 0, bajos = 0;
  for (const e of lista) if (Array.isArray(e)) for (const a of e) if (Array.isArray(a)) for (const c of a) {
    if (!Number.isInteger(c)) continue;
    if (c > 0xFF && (c & 0xFF) === 0) altos++; else if (c <= 0xFF) bajos++;
  }
  const alReves = altos > bajos;
  const da = c => alReves ? ((c & 0xFF) << 8 | c >> 8) : c;
  const txt = a => Array.isArray(a) ? String.fromCharCode(...a.filter(Number.isInteger).map(da).filter(c => c >= 32 && c < 0xFFFE).slice(0, 64)).replace(/\s+/g, " ").trim() : "";
  return lista.slice(0, 161).map(e => Array.isArray(e) ? { nombre: txt(e[0]), forma: txt(e[1]) } : null);
}

/* El tier de cada personaje del juego (id → tier) y lo que encontró cada entrada de la lista. Si dos entradas encuentran
   al mismo, gana la de tier más alto. Los Grandes Simios que la lista no nombra uno por uno (todo «Great Ape» del juego
   menos el de Baby, que es S) son N/C. */
export function tiersDe(cat) {
  const tier = new Map(), entradas = [];
  for (const t of BT3_ORDEN) for (const [nombre, busca, excluye] of BT3_TIERS[t]) {
    const hay = cat && cat.length ? buscaBt3(cat, busca, excluye) : [];
    for (const i of hay) if (!tier.has(i)) tier.set(i, t);
    entradas.push({ tier: t, nombre, ids: hay });
  }
  (cat || []).forEach((c, i) => {
    if (!c || tier.has(i)) return;
    const p = palabrasBt3(c.nombre + " " + c.forma);
    if (p.has("ape") && !p.has("baby")) tier.set(i, "N/C");
  });
  return { tier, entradas };
}

/* Lo que una regla deja fuera, para el juego (`ids`) y para mostrarlo (la sala y el panel del juego):
   - `detalle`: cada entrada de la lista con su tier, lo que encontró en el disco y si queda vetada;
   - `vetados` / `permitidos`: [tier, nombre en el juego] de cada personaje del disco;
   - `sinTier`: los del disco que la lista no nombra (quedan fuera con cualquier regla). */
export function vetadosBt3(cat, regla) {
  const hayCat = !!(cat && cat.length), nombreDe = i => [cat[i].nombre, cat[i].forma].filter(Boolean).join(" · ");
  const { tier, entradas } = tiersDe(hayCat ? cat : []);
  const permite = new Set(tiersPermitidas(regla)), activa = !!PERMITE[regla], tambien = PERMITE_TAMBIEN[regla] || new Set();
  const sueltos = new Set(entradas.filter(e => tambien.has(e.nombre)).flatMap(e => e.ids));
  const ids = [], vetados = [], permitidos = [], sinTier = [];
  if (hayCat) cat.forEach((c, i) => {
    if (!c) return;
    const t = tier.get(i), fuera = activa && !(t && permite.has(t)) && !sueltos.has(i);
    if (fuera) { ids.push(i); vetados.push([t || "?", nombreDe(i)]); } else permitidos.push([t || "?", nombreDe(i)]);
    if (!t) sinTier.push({ nombre: nombreDe(i), vetado: fuera });
  });
  const detalle = entradas.map(e => ({ tier: e.tier, nombre: e.nombre, juego: e.ids.map(nombreDe), vetado: activa && !permite.has(e.tier) && !tambien.has(e.nombre) }));
  return { ids, detalle, vetados, permitidos, sinTier };
}
