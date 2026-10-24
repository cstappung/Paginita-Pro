/* PRODROP — el motor, compartido.
   Lo usan tres sitios: el abridor (este directorio, sin compilar), la
   página de Juegos (esbuild lo mete en el paquete: el vestíbulo, el perfil
   y las monedas) y las pruebas de Node. Por eso es UMD y no toca el DOM.

   Un sobre **no se tira, se deriva**: su contenido es una función pura de
   `(uid, clave, at)`, donde `at` es la hora del servidor en el instante en
   que se escribió la compra (la regla exige `at === now`). Quien compra no
   puede elegir ese milisegundo, así que no puede elegir lo que trae; y como
   todo lo demás es público, cualquiera puede rehacer el sobre de cualquiera
   y comprobar que esa legendaria salió de verdad de ahí. Lo mismo la nota
   oculta de cada carta: estaba decidida desde que se compró el sobre, y
   graduar solo la descubre.

   Todo el azar sale de SHA-256 y de enteros: los pesos están en enteros
   (diez milésimas) para que dos navegadores no redondeen distinto el
   último bit de un 17,4. */
(function (raiz, fabrica) {
  const M = fabrica();
  if (typeof module === "object" && module.exports) module.exports = M;
  else raiz.ProdropMotor = M;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- el catálogo ---------- */
  // [id de archivo, nombre visible, tema shiny]
  const PEOPLE = [
    ["angel-abusleme", "Angel Abusleme", "esmeralda"],
    ["christian-oberli", "Christian Oberli", "sakura"],
    ["claudia-prieto", "Claudia Prieto", "fuego_carmesi"],
    ["cristian-garces", "Cristian Garces", "hielo_cristal"],
    ["cristian-tejos", "Cristian Tejos", "tormenta_electrica"],
    ["david-watts", "David Watts", "dorado_solar"],
    ["felipe-nunez", "Felipe Nuñez", "platino_magenta"],
    ["felix-rojasv2", "Felix Rojas", "sombra_obsidiana"],
    ["javier-pereda-torres", "Javier Pereda Torres", "galaxia"],
    ["marilyn-cruces", "Marilyn Cruces", "oceano_abisal"],
    ["mario-gac", "Mario Gac", "perla_opalo"],
    ["miguel-gutierrez", "Miguel Gutierrez", "neon_cyber"],
    ["pablo-irarrazaval", "Pablo Irarrazaval", "neon_cyber"],
    ["rene-botnar", "Rene Botnar", "fuego_carmesi"],
    ["rodrigo-cadiz", "Rodrigo Cadiz", "oceano_abisal"],
    ["rolando-dunner", "Rolando Dunner", "sakura"],
    ["tito-arevalo", "Tito Arevalo", "perla_opalo"]
  ];
  const SHINY = {
    esmeralda: ["Esmeralda", "#3dffa0"], sakura: ["Sakura", "#ff9bd2"], fuego_carmesi: ["Fuego Carmesí", "#ff5a2e"],
    hielo_cristal: ["Hielo Cristal", "#9be9ff"], tormenta_electrica: ["Tormenta Eléctrica", "#ffe74a"],
    dorado_solar: ["Dorado Solar", "#ffc23a"], platino_magenta: ["Platino Magenta", "#ff5ae0"],
    sombra_obsidiana: ["Sombra Obsidiana", "#a678ff"], galaxia: ["Galaxia", "#8f8bff"],
    oceano_abisal: ["Océano Abisal", "#38d0ff"], perla_opalo: ["Perla Ópalo", "#ffeacc"], neon_cyber: ["Neón Cyber", "#4dff72"]
  };
  /* Probabilidad por carta en diez milésimas (suman 10 000). */
  const TIERS = [
    { key: "common", label: "Común", sym: "●", color: "#dfe3ee", w: 8000 },
    { key: "rare", label: "Rara", sym: "◆", color: "#5cc8ff", w: 1740 },
    { key: "epic", label: "Épica", sym: "★", color: "#c26bff", w: 240 },
    { key: "legend", label: "Legendaria", sym: "★★", color: "#ffcc3d", w: 20 }
  ];
  /* Las variantes: el orden fija el N.º de cada carta, y la clave
     (`<persona>-<variante>`) no se cambia nunca. Los ataques de las
     comunes y las raras son cosa del abridor, no del motor. Star Wars
     llegó después: va al final para que las 153 de antes conserven su
     número (`n`), que es lo que guarda cada sobre. */
  const VARIANTS = [
    { key: "original", tier: 0, label: "Original" },
    { key: "dibujo", tier: 0, label: "Dibujo" },
    { key: "anime", tier: 0, label: "Anime Titán" },
    { key: "calvo", tier: 1, label: "Calvo" },
    { key: "simpson", tier: 1, label: "Springfield" },
    { key: "gta", tier: 2, label: "Los Santos" },
    { key: "cyberpunk", tier: 2, label: "Cyberpunk" },
    { key: "casino", tier: 2, label: "High Roller" },
    { key: "shiny", tier: 3, label: "Shiny" },
    { key: "starwars", tier: 2, label: "Star Wars" }
  ];
  const FOLDER = ["comunes", "raras", "epicas", "legendarias"];
  /* Las cartas que existían antes de las colecciones: un sobre de antes
     (su clave no lleva prefijo de colección) sale solo de estas. */
  const LEGADO = 153;

  /* ---------- la colección de componentes ----------
     25 componentes por 11 temáticas. La temática fija la rareza y el
     `peso` de la carta dentro de ella: Navidad pesa 1 y Quemado 3, así
     que de cada cuatro legendarias de componentes, una es navideña. */
  const COMPONENTES = [
    ["resistencia", "Resistencia", "Pasivo"],
    ["condensador-electrolitico", "Electrolítico", "Pasivo"],
    ["inductor-toroidal", "Inductor Toroidal", "Pasivo"],
    ["led", "LED", "Optoelectrónico"],
    ["transistor-bjt", "Transistor BJT", "Activo"],
    ["mosfet-potencia", "MOSFET", "Activo"],
    ["timer-555", "Timer 555", "Integrado"],
    ["microcontrolador", "Microcontrolador", "Integrado"],
    ["fotoresistencia-ldr", "Fotorresistencia", "Sensor"],
    ["sensor-ultrasonico", "Sensor Ultrasónico", "Sensor"],
    ["condensador-ceramico", "Cerámico", "Pasivo"],
    ["potenciometro", "Potenciómetro", "Pasivo"],
    ["cristal-oscilador", "Cristal de Cuarzo", "Pasivo"],
    ["diodo-rectificador", "Diodo Rectificador", "Activo"],
    ["mosfet-sic-to247", "MOSFET SiC", "Activo"],
    ["gate-driver", "Gate Driver", "Integrado"],
    ["amplificador-operacional", "Op-Amp", "Integrado"],
    ["regulador-7805", "Regulador 7805", "Integrado"],
    ["esp32", "ESP32", "Integrado"],
    ["transformador-laminado", "Transformador", "Magnético"],
    ["transformador-ferrita", "Trafo de Ferrita", "Magnético"],
    ["sensor-temperatura-humedad", "Sensor de Humedad", "Sensor"],
    ["sensor-pir", "Sensor PIR", "Sensor"],
    ["rele", "Relé", "Electromecánico"],
    ["sensor-imu", "IMU 6 Ejes", "Sensor"]
  ];
  const TEMAS = [
    { key: "realista", tier: 0, label: "Realista", color: "#dfe3ee" },
    { key: "bioware", tier: 0, label: "Bioware", color: "#c9a27e" },
    { key: "esquematico", tier: 0, label: "Esquemático", color: "#7fb4ff" },
    { key: "pixelart", tier: 1, label: "Pixel Art", color: "#ff9f43" },
    { key: "void", tier: 1, label: "Void", color: "#9d7bff" },
    { key: "belico", tier: 1, label: "Bélico", color: "#9fb35a" },
    { key: "halloween", tier: 2, label: "Halloween", color: "#ff8a1f" },
    { key: "dieciochero", tier: 2, label: "Dieciochero", color: "#ff4b5c" },
    { key: "arcano", tier: 2, label: "Arcano", color: "#b86bff" },
    { key: "quemado", tier: 3, label: "Quemado", color: "#ff5a1f", peso: 3 },
    { key: "navidad", tier: 3, label: "Navidad", color: "#4dffb0", peso: 1 }
  ];

  /* ---------- la colección de fútbol ----------
     El primer equipo del Real Madrid y del Barça: [carpeta, archivo,
     nombre, posición, dorsal, país], con la foto en
     cards/futbol/<carpeta>/<archivo>.webp. Cada jugador sale en común, rara
     y épica (no hay legendarias). El país es la selección por la que juega:
     las webs de los clubes solo dan el lugar de nacimiento. Como en las
     otras colecciones, **solo se agrega al final**: el orden fija el id de
     cada carta, y los sobres ya abiertos se rehacen con él. */
  const FUTBOLISTAS = [
    ["realmadrid", "courtois", "Courtois", "POR", 1, "BE"], ["realmadrid", "lunin", "Lunin", "POR", 13, "UA"],
    ["realmadrid", "asencio", "Asencio", "DEF", 2, "ES"], ["realmadrid", "militao", "E. Militão", "DEF", 3, "BR"],
    ["realmadrid", "huijsen", "Huijsen", "DEF", 4, "ES"], ["realmadrid", "trent", "Trent", "DEF", 12, "ENG"],
    ["realmadrid", "konate", "Konaté", "DEF", 16, "FR"], ["realmadrid", "cucurella", "Cucurella", "DEF", 17, "ES"],
    ["realmadrid", "carreras", "Á. Carreras", "DEF", 18, "ES"], ["realmadrid", "rudiger", "Rüdiger", "DEF", 22, "DE"],
    ["realmadrid", "mendy", "F. Mendy", "DEF", 23, "FR"], ["realmadrid", "dumfries", "Dumfries", "DEF", 24, "NL"],
    ["realmadrid", "bellingham", "Bellingham", "MED", 5, "ENG"], ["realmadrid", "camavinga", "Camavinga", "MED", 6, "FR"],
    ["realmadrid", "valverde", "Fede Valverde", "MED", 8, "UY"], ["realmadrid", "tchouameni", "Tchouameni", "MED", 14, "FR"],
    ["realmadrid", "arda-guler", "Arda Güler", "MED", 15, "TR"], ["realmadrid", "bernardo", "Bernardo", "MED", 20, "PT"], ["realmadrid", "vini-jr", "Vini Jr.", "DEL", 7, "BR"],
    ["realmadrid", "endrick", "Endrick", "DEL", 9, "BR"], ["realmadrid", "mbappe", "Mbappé", "DEL", 10, "FR"],
    ["realmadrid", "rodrygo", "Rodrygo", "DEL", 11, "BR"], ["realmadrid", "espi", "C. Espí", "DEL", 19, "ES"],
    ["realmadrid", "brahim", "Brahim", "DEL", 21, "MA"], ["realmadrid", "yan-diomande", "Yan Diomande", "DEL", 25, "CI"],
    ["barcelona", "joan-garcia", "Joan García", "POR", 1, "ES"], ["barcelona", "szczesny", "Szczęsny", "POR", 13, "PL"],
    ["barcelona", "livakovic", "Livaković", "POR", 25, "HR"], ["barcelona", "cancelo", "João Cancelo", "DEF", 2, "PT"],
    ["barcelona", "balde", "Balde", "DEF", 3, "ES"], ["barcelona", "cubarsi", "Cubarsí", "DEF", 5, "ES"], ["barcelona", "christensen", "Christensen", "DEF", 15, "DK"],
    ["barcelona", "gerard-martin", "Gerard Martín", "DEF", 18, "ES"], ["barcelona", "kounde", "Koundé", "DEF", 23, "FR"],
    ["barcelona", "eric-garcia", "Eric García", "DEF", 24, "ES"],
    ["barcelona", "gavi", "Gavi", "MED", 6, "ES"], ["barcelona", "fermin", "Fermín", "MED", 7, "ES"],
    ["barcelona", "pedri", "Pedri", "MED", 8, "ES"], ["barcelona", "rodri", "Rodri", "MED", 16, "ES"],
    ["barcelona", "dani-olmo", "Dani Olmo", "MED", 20, "ES"], ["barcelona", "de-jong", "De Jong", "MED", 21, "NL"],
    ["barcelona", "marc-bernal", "Marc Bernal", "MED", 22, "ES"], ["barcelona", "gabriel-jesus", "Gabriel Jesus", "DEL", 9, "BR"],
    ["barcelona", "lamine-yamal", "Lamine Yamal", "DEL", 10, "ES"], ["barcelona", "raphinha", "Raphinha", "DEL", 11, "BR"],
    ["barcelona", "adeyemi", "Adeyemi", "DEL", 14, "DE"], ["barcelona", "gordon", "Gordon", "DEL", 17, "ENG"],
    ["barcelona", "bardghji", "Bardghji", "DEL", 19, "SE"]
  ];
  /* ---------- la colección de la Premier (Serie 04) ----------
     Los seis grandes de Inglaterra (Man United, Man City, Chelsea,
     Liverpool, Tottenham, Arsenal), con el mismo formato que `FUTBOLISTAS`
     y la foto en cards/premier/<club>/<archivo>.webp. Es una colección
     **aparte** y no más jugadores en la de arriba: el contenido de un sobre
     sale de la lista de su colección, así que agrandar `FUTBOLISTAS`
     habría cambiado lo que trae cada sobre de fútbol ya abierto. Mismas
     reglas (común, rara y épica, sin legendarias) y, como allá, solo se
     agrega al final. */
  const PREMIER = [
    ["manutd", "senne-lammens", "Senne Lammens", "POR", 1, "BE"], ["manutd", "karl-darlow", "Karl Darlow", "POR", 12, "WAL"],
    ["manutd", "tom-heaton", "Tom Heaton", "POR", 22, "ENG"], ["manutd", "andre-onana", "Andre Onana", "POR", 24, "CM"], ["manutd", "diogo-dalot", "Diogo Dalot", "DEF", 2, "PT"],
    ["manutd", "noussair-mazraoui", "Mazraoui", "DEF", 3, "MA"], ["manutd", "matthijs-de-ligt", "De Ligt", "DEF", 4, "NL"],
    ["manutd", "harry-maguire", "Harry Maguire", "DEF", 5, "ENG"], ["manutd", "lisandro-martinez", "L. Martínez", "DEF", 6, "AR"],
    ["manutd", "patrick-chinazaekpere-dorgu", "Dorgu", "DEF", 13, "DK"], ["manutd", "leny-yoro", "Leny Yoro", "DEF", 15, "FR"],
    ["manutd", "luke-shaw", "Luke Shaw", "DEF", 23, "ENG"], ["manutd", "ayden-heaven", "Ayden Heaven", "DEF", 26, "ENG"],
    ["manutd", "harry-amass", "Harry Amass", "DEF", 41, "ENG"], ["manutd", "mason-mount", "Mason Mount", "MED", 7, "ENG"],
    ["manutd", "bruno-fernandes", "B. Fernandes", "MED", 8, "PT"], ["manutd", "andrey-santos", "Andrey Santos", "MED", 17, "BR"],
    ["manutd", "youri-tielemans", "Tielemans", "MED", 18, "BE"], ["manutd", "carlos-baleba", "Carlos Baleba", "MED", 20, "CM"],
    ["manutd", "manuel-ugarte", "Manuel Ugarte", "MED", 25, "UY"], ["manutd", "kobbie-mainoo", "Kobbie Mainoo", "MED", 37, "ENG"],
    ["manutd", "marcus-rashford", "Rashford", "DEL", 9, "ENG"], ["manutd", "matheus-cunha", "Matheus Cunha", "DEL", 10, "BR"],
    ["manutd", "joshua-zirkzee", "Joshua Zirkzee", "DEL", 11, "NL"], ["manutd", "amad", "Amad", "DEL", 16, "CI"],
    ["manutd", "bryan-mbeumo", "Bryan Mbeumo", "DEL", 19, "CM"], ["manutd", "benjamin-sesko", "Šeško", "DEL", 30, "SI"],
    ["mancity", "gianluigi-donnarumma", "Donnarumma", "POR", 1, "IT"], ["mancity", "marcus-bettinelli", "Bettinelli", "POR", 13, "ENG"],
    ["mancity", "geronimo-rulli", "Gerónimo Rulli", "POR", 28, "AR"], ["mancity", "ruben-dias", "Rúben Dias", "DEF", 3, "PT"],
    ["mancity", "marc-guehi", "Guéhi", "DEF", 6, "ENG"], ["mancity", "rayan-ait-nouri", "Aït-Nouri", "DEF", 21, "DZ"],
    ["mancity", "vitor-reis", "Vitor Reis", "DEF", 22, "BR"], ["mancity", "josko-gvardiol", "Gvardiol", "DEF", 24, "HR"],
    ["mancity", "matheus-nunes", "Matheus Nunes", "DEF", 27, "PT"], ["mancity", "abdukodir-khusanov", "Khusanov", "DEF", 45, "UZ"], ["mancity", "rico-lewis", "Rico Lewis", "DEF", 82, "ENG"],
    ["mancity", "elliot-anderson", "E. Anderson", "MED", 5, "ENG"], ["mancity", "mateo-kovacic", "Kovačić", "MED", 8, "HR"],
    ["mancity", "rayan-cherki", "Rayan Cherki", "MED", 10, "FR"], ["mancity", "enzo-fernandez", "Enzo Fernández", "MED", 17, "AR"],
    ["mancity", "ayyoub-bouaddi", "Ayyoub Bouaddi", "MED", 32, "MA"], ["mancity", "nico-o-reilly", "Nico O'Reilly", "MED", 33, "ENG"],
    ["mancity", "phil-foden", "Phil Foden", "MED", 47, "ENG"],
    ["mancity", "iliman-ndiaye", "Iliman Ndiaye", "DEL", 7, "SN"], ["mancity", "erling-haaland", "Erling Haaland", "DEL", 9, "NO"],
    ["mancity", "jeremy-doku", "Doku", "DEL", 11, "BE"], ["mancity", "allan", "Allan", "DEL", 37, "BR"],
    ["mancity", "antoine-semenyo", "Semenyo", "DEL", 42, "GH"],
    ["chelsea", "emiliano-martinez", "Dibu Martínez", "POR", 1, "AR"], ["chelsea", "teddy-sharman-lowe", "Sharman-Lowe", "POR", 28, "ENG"],
    ["chelsea", "mike-penders", "Mike Penders", "POR", 39, "BE"], ["chelsea", "gaga-slonina", "Gaga Slonina", "POR", 44, "US"],
    ["chelsea", "marco-palestra", "Marco Palestra", "DEF", 2, "IT"], ["chelsea", "wesley-fofana", "Wesley Fofana", "DEF", 3, "FR"],
    ["chelsea", "maxence-lacroix", "Lacroix", "DEF", 5, "FR"], ["chelsea", "levi-colwill", "Levi Colwill", "DEF", 6, "ENG"],
    ["chelsea", "jorrel-hato", "Jorrel Hato", "DEF", 21, "NL"], ["chelsea", "reece-james", "Reece James", "DEF", 24, "ENG"],
    ["chelsea", "malo-gusto", "Malo Gusto", "DEF", 27, "FR"], ["chelsea", "pep-chavarria", "Pep Chavarría", "DEF", 29, "ES"],
    ["chelsea", "aaron-anselmino", "Anselmino", "DEF", 30, "AR"], ["chelsea", "josh-acheampong", "Acheampong", "DEF", 34, "ENG"], ["chelsea", "valentin-barco", "Valentin Barco", "MED", 4, "AR"],
    ["chelsea", "jordan-henderson", "Henderson", "MED", 14, "ENG"], ["chelsea", "moises-caicedo", "Moisés Caicedo", "MED", 25, "EC"],
    ["chelsea", "romeo-lavia", "Romeo Lavia", "MED", 45, "BE"], ["chelsea", "pedro-neto", "Pedro Neto", "DEL", 7, "PT"],
    ["chelsea", "joao-pedro", "João Pedro", "DEL", 9, "BR"], ["chelsea", "jamie-gittens", "Jamie Gittens", "DEL", 11, "ENG"],
    ["chelsea", "morgan-rogers", "Morgan Rogers", "DEL", 17, "ENG"], ["chelsea", "danny-welbeck", "Danny Welbeck", "DEL", 18, "ENG"],
    ["chelsea", "emmanuel-emegha", "Emegha", "DEL", 22, "NL"], ["chelsea", "geovany-quenda", "Geovany Quenda", "DEL", 23, "PT"],
    ["chelsea", "estevao-willian", "Estêvão", "DEL", 41, "BR"],
    ["liverpool", "alisson-becker", "Alisson", "POR", 1, "BR"], ["liverpool", "giorgi-mamardashvili", "Mamardashvili", "POR", 25, "GE"],
    ["liverpool", "freddie-woodman", "Woodman", "POR", 28, "ENG"], ["liverpool", "vitezslav-jaros", "Jaroš", "POR", 56, "CZ"],
    ["liverpool", "harvey-davies", "Harvey Davies", "POR", 95, "ENG"], ["liverpool", "joe-gomez", "Joe Gomez", "DEF", 2, "ENG"],
    ["liverpool", "virgil-van-dijk", "Van Dijk", "DEF", 4, "NL"], ["liverpool", "jeremy-jacquet", "Jeremy Jacquet", "DEF", 5, "FR"],
    ["liverpool", "milos-kerkez", "Kerkez", "DEF", 6, "HU"], ["liverpool", "conor-bradley", "Conor Bradley", "DEF", 12, "NIR"],
    ["liverpool", "giovanni-leoni", "Giovanni Leoni", "DEF", 15, "IT"], ["liverpool", "kostas-tsimikas", "Tsimikas", "DEF", 21, "GR"],
    ["liverpool", "jeremie-frimpong", "Frimpong", "DEF", 30, "NL"], ["liverpool", "ronald-araujo", "Ronald Araujo", "DEF", 33, "UY"], ["liverpool", "wataru-endo", "Wataru Endo", "MED", 3, "JP"],
    ["liverpool", "florian-wirtz", "Florian Wirtz", "MED", 7, "DE"], ["liverpool", "dominik-szoboszlai", "Szoboszlai", "MED", 8, "HU"],
    ["liverpool", "alexis-mac-allister", "Mac Allister", "MED", 10, "AR"], ["liverpool", "ryan-gravenberch", "Gravenberch", "MED", 38, "NL"],
    ["liverpool", "trey-nyoni", "Trey Nyoni", "MED", 42, "ENG"],
    ["liverpool", "alexander-isak", "Alexander Isak", "DEL", 9, "SE"], ["liverpool", "federico-chiesa", "Chiesa", "DEL", 14, "IT"],
    ["liverpool", "cody-gakpo", "Cody Gakpo", "DEL", 18, "NL"], ["liverpool", "hugo-ekitike", "Hugo Ekitike", "DEL", 22, "FR"],
    ["liverpool", "victor-munoz", "Victor Munoz", "DEL", 23, "ES"], ["liverpool", "bradley-barcola", "Barcola", "DEL", 29, "FR"],
    ["liverpool", "lewis-koumas", "Lewis Koumas", "DEL", 67, "WAL"], ["liverpool", "rio-ngumoha", "Rio Ngumoha", "DEL", 73, "ENG"],
    ["tottenham", "antonin-kinsky", "Antonin Kinsky", "POR", 31, "CZ"], ["tottenham", "martin-dubravka", "Dúbravka", "POR", 39, "SK"],
    ["tottenham", "brandon-austin", "Brandon Austin", "POR", 40, "ENG"], ["tottenham", "andy-robertson", "Robertson", "DEF", 3, "SCO"],
    ["tottenham", "tosin-adarabioyo", "Adarabioyo", "DEF", 4, "ENG"], ["tottenham", "marcos-senesi", "Marcos Senesi", "DEF", 5, "AR"],
    ["tottenham", "jan-paul-van-hecke", "Van Hecke", "DEF", 6, "NL"], ["tottenham", "destiny-udogie", "Destiny Udogie", "DEF", 13, "IT"],
    ["tottenham", "pedro-porro", "Pedro Porro", "DEF", 23, "ES"], ["tottenham", "ben-davies", "Ben Davies", "DEF", 33, "WAL"],
    ["tottenham", "micky-van-de-ven", "Van de Ven", "DEF", 37, "NL"], ["tottenham", "xavi-simons", "Xavi Simons", "MED", 7, "NL"],
    ["tottenham", "conor-gallagher", "Gallagher", "MED", 8, "ENG"], ["tottenham", "james-maddison", "James Maddison", "MED", 10, "ENG"],
    ["tottenham", "archie-gray", "Archie Gray", "MED", 14, "ENG"], ["tottenham", "lucas-bergvall", "Lucas Bergvall", "MED", 15, "SE"],
    ["tottenham", "sandro-tonali", "Sandro Tonali", "MED", 16, "IT"], ["tottenham", "mateus-fernandes", "M. Fernandes", "MED", 18, "PT"],
    ["tottenham", "wilson-odobert", "Wilson Odobert", "MED", 28, "FR"], ["tottenham", "rodrigo-bentancur", "Bentancur", "MED", 30, "UY"],
    ["tottenham", "richarlison", "Richarlison", "DEL", 9, "BR"], ["tottenham", "mathys-tel", "Mathys Tel", "DEL", 11, "FR"],
    ["tottenham", "savio", "Sávio", "DEL", 17, "BR"], ["tottenham", "dominic-solanke", "Solanke", "DEL", 19, "ENG"],
    ["tottenham", "mohammed-kudus", "Mohammed Kudus", "DEL", 20, "GH"], ["tottenham", "dejan-kulusevski", "Kulusevski", "DEL", 21, "SE"],
    ["tottenham", "omar-marmoush", "Omar Marmoush", "DEL", 22, "EG"], ["tottenham", "mykhailo-mudryk", "Mudryk", "DEL", 27, "UA"],
    ["arsenal", "david-raya", "David Raya", "POR", 1, "ES"], ["arsenal", "kepa-arrizabalaga", "Kepa", "POR", 13, "ES"],
    ["arsenal", "illan-meslier", "Illan Meslier", "POR", 30, "FR"], ["arsenal", "william-saliba", "William Saliba", "DEF", 2, "FR"],
    ["arsenal", "cristhian-mosquera", "Mosquera", "DEF", 3, "ES"], ["arsenal", "ben-white", "Ben White", "DEF", 4, "ENG"],
    ["arsenal", "piero-hincapie", "Hincapié", "DEF", 5, "EC"], ["arsenal", "gabriel-magalhaes", "Gabriel", "DEF", 6, "BR"],
    ["arsenal", "jurrien-timber", "Jurrien Timber", "DEF", 12, "NL"], ["arsenal", "ezri-konsa", "Ezri Konsa", "DEF", 15, "ENG"],
    ["arsenal", "riccardo-calafiori", "Calafiori", "DEF", 33, "IT"], ["arsenal", "myles-lewis-skelly", "Lewis-Skelly", "DEF", 49, "ENG"],
    ["arsenal", "martin-odegaard", "Ødegaard", "MED", 8, "NO"], ["arsenal", "eberechi-eze", "Eberechi Eze", "MED", 10, "ENG"],
    ["arsenal", "mikel-merino", "Mikel Merino", "MED", 23, "ES"], ["arsenal", "martin-zubimendi", "Zubimendi", "MED", 36, "ES"],
    ["arsenal", "bruno-guimaraes", "B. Guimarães", "MED", 39, "BR"], ["arsenal", "declan-rice", "Declan Rice", "MED", 41, "ENG"],
    ["arsenal", "bukayo-saka", "Bukayo Saka", "DEL", 7, "ENG"], ["arsenal", "viktor-gyokeres", "Gyökeres", "DEL", 14, "SE"],
    ["arsenal", "christos-tzolis", "Tzolis", "DEL", 17, "GR"], ["arsenal", "noni-madueke", "Noni Madueke", "DEL", 20, "ENG"],
    ["arsenal", "kai-havertz", "Kai Havertz", "DEL", 29, "DE"]
  ];
  const CLUBES = {
    realmadrid: "Real Madrid", barcelona: "FC Barcelona",
    manutd: "Manchester United", mancity: "Manchester City", chelsea: "Chelsea", liverpool: "Liverpool", tottenham: "Tottenham", arsenal: "Arsenal"
  };

  /* ---------- la media de cada futbolista ----------
     La media (como la de EA SPORTS FC: 60 a 99) es del jugador y no cambia
     con la rareza de su carta. Salen de la API pública de ratings de EA FC
     (octubre 2026), por club y jugador (`<club>/<archivo de la foto>`), y
     se ajustan a mano aquí. Los jugadores que EA FC no tiene (canteranos) no
     están en la colección; la única media estimada es la de Mudryk (76), que
     EA no lista.
     **La media fija la rareza de la carta** (`BANDAS`): cada futbolista tiene
     una sola carta, y su rareza sale de su media. */
  const MEDIAS = {
    realmadrid: {
      "courtois": 89, "lunin": 81, "asencio": 77, "militao": 84, "huijsen": 82,
      "trent": 86, "konate": 86, "cucurella": 84, "carreras": 80, "rudiger": 86,
      "mendy": 81, "dumfries": 84, "bellingham": 90, "camavinga": 83, "valverde": 89,
      "tchouameni": 84, "arda-guler": 81, "bernardo": 84, "vini-jr": 89,
      "endrick": 77, "mbappe": 91, "rodrygo": 85, "espi": 68, "brahim": 82,
      "yan-diomande": 66
    },
    barcelona: {
      "joan-garcia": 83, "szczesny": 84, "livakovic": 80, "cancelo": 84, "balde": 83,
      "cubarsi": 82, "christensen": 80, "gerard-martin": 74, "kounde": 87,
      "eric-garcia": 79, "gavi": 83, "fermin": 80, "pedri": 89,
      "rodri": 90, "dani-olmo": 85, "de-jong": 87, "marc-bernal": 73, "gabriel-jesus": 80,
      "lamine-yamal": 89, "raphinha": 89, "adeyemi": 81, "gordon": 83, "bardghji": 69
    },
    manutd: {
      "senne-lammens": 78, "karl-darlow": 72, "tom-heaton": 67, "andre-onana": 80,
      "diogo-dalot": 79, "noussair-mazraoui": 80, "matthijs-de-ligt": 82, "harry-maguire": 80, "lisandro-martinez": 81,
      "patrick-chinazaekpere-dorgu": 74, "leny-yoro": 78, "luke-shaw": 79, "ayden-heaven": 69, "harry-amass": 68,
      "mason-mount": 77, "bruno-fernandes": 87, "andrey-santos": 80, "youri-tielemans": 85, "carlos-baleba": 81,
      "manuel-ugarte": 79, "kobbie-mainoo": 77, "marcus-rashford": 80,
      "matheus-cunha": 83, "joshua-zirkzee": 77, "amad": 79, "bryan-mbeumo": 85, "benjamin-sesko": 80
    },
    mancity: {
      "gianluigi-donnarumma": 89, "marcus-bettinelli": 70, "geronimo-rulli": 82, "ruben-dias": 86, "marc-guehi": 82,
      "rayan-ait-nouri": 81, "vitor-reis": 70, "josko-gvardiol": 84, "matheus-nunes": 79, "abdukodir-khusanov": 77, "rico-lewis": 77, "elliot-anderson": 80, "mateo-kovacic": 83, "rayan-cherki": 81,
      "enzo-fernandez": 84, "ayyoub-bouaddi": 75, "nico-o-reilly": 73, "phil-foden": 85,
      "iliman-ndiaye": 79, "erling-haaland": 90, "jeremy-doku": 80, "allan": 61, "antoine-semenyo": 80
    },
    chelsea: {
      "emiliano-martinez": 85, "teddy-sharman-lowe": 62, "mike-penders": 73, "gaga-slonina": 68, "marco-palestra": 61,
      "wesley-fofana": 79, "maxence-lacroix": 79, "levi-colwill": 80, "jorrel-hato": 78, "reece-james": 81,
      "malo-gusto": 79, "pep-chavarria": 77, "aaron-anselmino": 70, "josh-acheampong": 70,
      "valentin-barco": 75, "jordan-henderson": 79, "moises-caicedo": 87,
      "romeo-lavia": 78, "pedro-neto": 80, "joao-pedro": 79, "jamie-gittens": 78, "morgan-rogers": 82,
      "danny-welbeck": 78, "emmanuel-emegha": 78, "geovany-quenda": 76, "estevao-willian": 78
    },
    liverpool: {
      "alisson-becker": 89, "giorgi-mamardashvili": 84, "freddie-woodman": 71, "vitezslav-jaros": 70, "harvey-davies": 61,
      "joe-gomez": 79, "virgil-van-dijk": 90, "jeremy-jacquet": 75, "milos-kerkez": 82, "conor-bradley": 78,
      "giovanni-leoni": 69, "kostas-tsimikas": 77, "jeremie-frimpong": 83, "ronald-araujo": 83,
      "wataru-endo": 79, "florian-wirtz": 89, "dominik-szoboszlai": 83, "alexis-mac-allister": 87, "ryan-gravenberch": 85,
      "trey-nyoni": 64, "alexander-isak": 88, "federico-chiesa": 81, "cody-gakpo": 84,
      "hugo-ekitike": 83, "victor-munoz": 65, "bradley-barcola": 84, "lewis-koumas": 69, "rio-ngumoha": 68
    },
    tottenham: {
      "antonin-kinsky": 75, "martin-dubravka": 77, "brandon-austin": 67, "andy-robertson": 82, "tosin-adarabioyo": 78,
      "marcos-senesi": 78, "jan-paul-van-hecke": 80, "destiny-udogie": 80, "pedro-porro": 82, "ben-davies": 75,
      "micky-van-de-ven": 82, "xavi-simons": 84, "conor-gallagher": 81, "james-maddison": 84, "archie-gray": 75,
      "lucas-bergvall": 77, "sandro-tonali": 86, "mateus-fernandes": 76, "wilson-odobert": 75, "rodrigo-bentancur": 80,
      "richarlison": 78, "mathys-tel": 77, "savio": 82, "dominic-solanke": 80, "mohammed-kudus": 80,
      "dejan-kulusevski": 83, "omar-marmoush": 84, "mykhailo-mudryk": 76
    },
    arsenal: {
      "david-raya": 87, "kepa-arrizabalaga": 79, "illan-meslier": 72, "william-saliba": 87, "cristhian-mosquera": 77,
      "ben-white": 83, "piero-hincapie": 83, "gabriel-magalhaes": 88, "jurrien-timber": 82, "ezri-konsa": 82,
      "riccardo-calafiori": 78, "myles-lewis-skelly": 78, "martin-odegaard": 87, "eberechi-eze": 83, "mikel-merino": 83,
      "martin-zubimendi": 83, "bruno-guimaraes": 86, "declan-rice": 87, "bukayo-saka": 88, "viktor-gyokeres": 87,
      "christos-tzolis": 80, "noni-madueke": 80, "kai-havertz": 82
    }
  };
  const mediaDe = (club, id) => MEDIAS[club][id];
  /* La rareza de una carta de fútbol sale de la media del jugador: hasta 80
     común, 81 a 84 rara, 85 a 87 épica y 88 o más legendaria. */
  const BANDAS = [80, 84, 87];
  const tierDeMedia = m => (m <= BANDAS[0] ? 0 : m <= BANDAS[1] ? 1 : m <= BANDAS[2] ? 2 : 3);
  /* Las probabilidades por carta de las colecciones de fútbol, en diez
     milésimas: como cada rareza es un grupo de jugadores de distinta
     media, aquí las más altas salen un poco más que en las otras colecciones
     (que siguen con las de `TIERS`). Cada colección tiene los suyos para
     que un jugador de más media sea siempre más difícil de sacar que uno de
     menos: la probabilidad de un jugador es el peso de su rareza dividido
     entre cuántos jugadores tiene (la Premier solo tiene 5 legendarias, así
     que la suya pesa menos; un test lo comprueba). */
  const PESOS_FUTBOL = { futbol: [5500, 3300, 1000, 200], premier: [5500, 3500, 900, 100] };

  /* Las colecciones. El sobre dice de cuál es con la primera letra de su
     clave (`prefijo` + la clave de push): la regla ya acepta esas claves
     y quien compra no elige el contenido igual, porque sigue saliendo de
     la hora del servidor. `grupo: "futbol"` junta las colecciones de
     futbolistas: se eligen desde su propio menú y comparten la plantilla. */
  const COLECCIONES = [
    { key: "profes", prefijo: "p", label: "Profes", nombre: "DIE Collection", serie: "S01" },
    { key: "comp", prefijo: "c", label: "Componentes", nombre: "Componentes", serie: "S02" },
    { key: "futbol", prefijo: "f", label: "Fútbol", nombre: "Fútbol", serie: "S03", grupo: "futbol" },
    { key: "premier", prefijo: "e", label: "Premier", nombre: "Big Six", serie: "S04", grupo: "futbol" }
  ];
  const esFutbol = col => col === "futbol" || col === "premier";
  const COL = Object.fromEntries(COLECCIONES.map(c => [c.key, c]));

  const CARDS = [];
  VARIANTS.forEach(v => PEOPLE.forEach(([id, name, sh]) => {
    const n = CARDS.length;
    CARDS.push({
      n, uid: id + "-" + v.key, person: id, num: n + 1, name, vkey: v.key, vlabel: v.label, col: "profes", peso: 1,
      tier: v.tier, shiny: SHINY[sh], img: "cards/" + FOLDER[v.tier] + "/" + id + "-" + v.key + ".webp",
      sub: v.tier === 3 ? "Shiny " + SHINY[sh][0] : v.label,
      acc: v.tier === 3 ? SHINY[sh][1] : v.tier === 2 ? "#d49bff" : TIERS[v.tier].color
    });
  }));
  const BASE_COMP = CARDS.length;
  TEMAS.forEach(te => COMPONENTES.forEach(([id, name, tipo]) => {
    const n = CARDS.length;
    CARDS.push({
      n, uid: id + "-" + te.key, person: id, num: n - BASE_COMP + 1, name, tipo, vkey: te.key, vlabel: te.label, col: "comp",
      peso: te.peso || 1, tier: te.tier, img: "cards/componentes/" + te.key + "/" + id + ".webp",
      sub: te.label, acc: te.tier >= 2 ? te.color : TIERS[te.tier].color, tema: te.color
    });
  }));
  const BASE_FUT = CARDS.length;
  const cartaFutbol = (col, carpeta, [club, id, name, pos, dorsal, pais]) => {
    const n = CARDS.length, media = mediaDe(club, id), tier = tierDeMedia(media), t = TIERS[tier];
    CARDS.push({
      n, uid: club + "-" + id + "-" + t.key, person: club + "-" + id, num: n - (col === "futbol" ? BASE_FUT : BASE_PREM) + 1, name, vkey: t.key, vlabel: t.label,
      col, peso: 1, tier, club, pos, dorsal, pais, media, img: "cards/" + carpeta + "/" + club + "/" + id + ".webp",
      sub: CLUBES[club], acc: t.color
    });
  };
  FUTBOLISTAS.forEach(j => cartaFutbol("futbol", "futbol", j));
  const BASE_PREM = CARDS.length;
  PREMIER.forEach(j => cartaFutbol("premier", "premier", j));
  const TOTAL = CARDS.length;
  const POR_COL = Object.fromEntries(COLECCIONES.map(c => [c.key, CARDS.filter(x => x.col === c.key)]));
  const pool = (lista, w = TIERS.map(x => x.w)) => {
    const t = TIERS.map((_, i) => lista.filter(c => c.tier === i));
    t.uniforme = lista.every(c => c.peso === 1);
    t.peso = t.map(l => l.reduce((s, c) => s + c.peso, 0));
    // la rareza más alta que tiene: lo que sería de una rareza que la colección no tiene sale de la más alta
    t.tope = t.reduce((m, l, i) => (l.length ? i : m), 0);
    t.w = w;
    let esp = null;   // se calcula al pedirlo: `DIOS` se declara más abajo
    Object.defineProperty(t, 'esperado', { get: () => esp || (esp = esperadoPorSobre(w)) });
    return t;
  };
  const POOL = { legado: pool(CARDS.slice(0, LEGADO)), profes: pool(POR_COL.profes), comp: pool(POR_COL.comp), futbol: pool(POR_COL.futbol, PESOS_FUTBOL.futbol), premier: pool(POR_COL.premier, PESOS_FUTBOL.premier) };
  const POR_TIER = POOL.profes;
  /* De qué colección es un sobre o un re-roll, por su clave. Las claves
     de push empiezan con «-», así que lo de antes nunca lleva prefijo. */
  const coleccionDe = clave => { const p = String(clave)[0]; return p === "c" ? "comp" : p === "f" ? "futbol" : p === "e" ? "premier" : "profes"; };
  const poolDe = clave => { const p = String(clave)[0]; return p === "c" ? POOL.comp : p === "f" ? POOL.futbol : p === "e" ? POOL.premier : p === "p" ? POOL.profes : POOL.legado; };
  const subtitulo = c => c.sub;
  const acento = c => c.acc;

  /* ---------- la nota oculta ----------
     Campana angosta en 7, en milésimas (suman 1000): del 1 al 3 suman 2 %,
     y el 10 GEM MINT sale el 8 %. */
  const GRADE_W = [2, 5, 13, 40, 100, 170, 260, 220, 110, 80];
  const GRADE_WORD = ["", "POOR", "GOOD", "VERY GOOD", "VG-EX", "EXCELLENT", "EX-MT", "NEAR MINT", "NM-MT", "MINT", "GEM MINT"];
  const colorNota = g => g >= 10 ? "#ffd23d" : g >= 9 ? "#dfe7ff" : g >= 7 ? "#5cc8ff" : g >= 5 ? "#8fe36f" : g >= 3 ? "#ff9a3d" : "#ff4d5e";

  /* ---------- precios ----------
     El sobre cuesta 50 los primeros días y 80 después. La regla de
     `cartas/s` compara con el mismo instante, así que el precio que se
     cobra es el de la hora del servidor, no el del reloj de cada uno. */
  const PRECIO = { promo: 50, normal: 80, gradua: 100, promoHasta: 1791169200000 };   // hasta el 4-10-2026 inclusive (5-10 00:00 Chile)
  const precioSobre = ms => (ms < PRECIO.promoHasta ? PRECIO.promo : PRECIO.normal);

  /* El god pack: 2 % de los sobres. Trae cinco épicas o mejores, y como
     mucho una legendaria. */
  const DIOS = 200;   // de 10 000

  /* ---------- SHA-256 ---------- */
  const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const SHA_H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  /* Devuelve las ocho palabras de 32 bits del resumen. */
  function sha256(texto) {
    const b = new TextEncoder().encode(String(texto));
    const largo = ((b.length + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(largo);
    m.set(b);
    m[b.length] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(largo - 8, Math.floor(b.length / 0x20000000));
    dv.setUint32(largo - 4, (b.length * 8) >>> 0);
    const h = SHA_H.slice(), w = new Int32Array(64);
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < largo; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], c = w[i - 2];
        w[i] = (w[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[i - 7] + (ror(c, 17) ^ ror(c, 19) ^ (c >>> 10))) | 0;
      }
      let [A, B, C, D, E, F, G, H] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (H + (ror(E, 6) ^ ror(E, 11) ^ ror(E, 25)) + ((E & F) ^ (~E & G)) + SHA_K[i] + w[i]) | 0;
        const t2 = ((ror(A, 2) ^ ror(A, 13) ^ ror(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
        H = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + H) | 0;
    }
    return h.map(x => x >>> 0);
  }
  /* Un generador a partir del resumen: xoshiro128** sembrado con cuatro
     de sus palabras. Solo enteros: el mismo resultado en todas partes. */
  function generador(semilla) {
    let [a, b, c, d] = semilla;
    if (!(a | b | c | d)) a = 1;
    const u32 = () => {
      const r = Math.imul(((Math.imul(b, 5) << 7) | (Math.imul(b, 5) >>> 25)), 9) >>> 0;
      const t = b << 9;
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
      return r;
    };
    // Entero en [0, n): n < 2^21, así que el producto cabe exacto en un double.
    const entero = n => Math.floor(u32() * n / 4294967296);
    return { u32, entero };
  }
  function pesado(r, pesos) {
    let x = r.entero(pesos.reduce((s, p) => s + p, 0));
    for (let i = 0; i < pesos.length; i++) { x -= pesos[i]; if (x < 0) return i; }
    return pesos.length - 1;
  }

  /* Una carta de la lista: todas iguales (como siempre fue en los profes,
     y así un sobre de antes sale idéntico) o según su `peso`. */
  const elige = (r, l, uniforme) => (uniforme ? l[r.entero(l.length)] : l[pesado(r, l.map(c => c.peso))]);

  /* ---------- el sobre ----------
     Cinco cartas distintas, de la peor a la mejor. La quinta (antes de
     ordenar) es Rara o mejor. En un god pack las cinco son épicas o
     legendarias, y tras la primera legendaria el resto sale épica. */
  const memo = new Map();
  function sobre(uid, clave, at) {
    const k = uid + "|" + clave + "|" + at;
    if (memo.has(k)) return memo.get(k);
    const h = sha256("prodrop:" + k), r = generador(h.slice(0, 4));
    const dios = r.entero(10000) < DIOS, P = poolDe(clave);
    const usadas = new Set(), cartas = [];
    let leyenda = false;
    for (let i = 0; i < 5; i++) {
      let t;
      if (dios) t = leyenda ? 2 : 2 + pesado(r, [P.w[2], P.w[3]]);
      else t = i === 4 ? 1 + pesado(r, P.w.slice(1)) : pesado(r, P.w);
      if (t === 3) leyenda = true;
      t = Math.min(t, P.tope);
      let libres = P[t].filter(c => !usadas.has(c.n));
      // una rareza con pocos jugadores se puede agotar en el sobre: sale la más cercana (primero la de arriba)
      for (let d = 1; !libres.length && d < TIERS.length; d++) {
        libres = (P[t + d] || []).filter(c => !usadas.has(c.n));
        if (!libres.length && t - d >= 0) libres = P[t - d].filter(c => !usadas.has(c.n));
      }
      const c = elige(r, libres, P.uniforme);
      usadas.add(c.n);
      cartas.push({ id: c.n, g: 1 + pesado(r, GRADE_W), w: (r.u32() & 0x7fffffff) | 1 });
    }
    cartas.sort((a, b) => CARDS[a.id].tier - CARDS[b.id].tier);   // estable: lo mejor al final
    const res = { dios, cartas, col: coleccionDe(clave) };
    memo.set(k, res);
    if (memo.size > 20000) memo.delete(memo.keys().next().value);
    return res;
  }

  /* ---------- probabilidades ----------
     Lo que se espera de cada rareza por sobre, contando la quinta carta y
     el god pack. Para cosas raras el número esperado por sobre es casi la
     probabilidad de que un sobre traiga una, que es lo que se dice. */
  function esperadoPorSobre(w) {
    const T = w || TIERS.map(t => t.w), tot = 10000, alta = T[1] + T[2] + T[3];
    const normal = T.map((w, t) => 4 * w / tot + (t ? w / alta : 0));
    const pLeg = 1 - Math.pow(T[2] / (T[2] + T[3]), 5);
    const dios = [0, 0, 5 - pLeg, pLeg];
    const pd = DIOS / 10000;
    return normal.map((x, t) => (1 - pd) * x + pd * dios[t]);
  }
  const ESPERADO = esperadoPorSobre();
  const notaOMas = g => GRADE_W.slice(Math.max(1, g) - 1).reduce((s, w) => s + w, 0) / 1000;
  /* «Una carta así de buena»: de esta rareza o mejor y con esta nota o
     más. `exacta` es la misma carta (persona y variante) con esa nota, en
     un sobre de su colección. */
  function probabilidad(id, g) {
    const c = CARDS[id], pg = notaOMas(g), E = POOL[c.col].esperado;   // lo esperado de SU colección
    let porSobre = 0;
    for (let t = c.tier; t < TIERS.length; t++) porSobre += E[t];
    porSobre *= pg;
    // en una colección sin legendarias, las épicas se quedan también con lo que sería legendaria
    const P = POOL[c.col], esp = E.slice(c.tier, c.tier === P.tope ? TIERS.length : c.tier + 1).reduce((a, b) => a + b, 0);
    const exacta = esp * c.peso / P.peso[c.tier] * pg;
    return { porCarta: porSobre / 5, porSobre, exacta, nota: pg };
  }
  const pDios = DIOS / 10000;

  /* ---------- re-roll ----------
     Diez cartas de una misma rareza se cambian por una de la rareza
     siguiente, como el contrato de intercambio del CS2. Como el sobre, el
     resultado no se tira: es una función pura de `(uid, clave, at)` y de
     lo que entró, y `at` es la hora del servidor (la regla de `cartas/r`
     exige `at === now`), así que nadie elige lo que sale y cualquiera puede
     rehacerlo.

     La carta nueva es una cualquiera de la rareza siguiente de la
     colección que dice la clave del re-roll (las diez que entran tienen
     que ser de esa colección), todas con la misma probabilidad salvo el
     `peso` de los componentes. Su nota (oculta, como la de un sobre: se descubre
     al graduarla) sale de las notas de las diez que entraron: una campana
     centrada en su promedio **más un punto** (`REROLL.bono`), con σ = 1,3.
     Diez notas de 5 4 6 4 9 8 8 5 3 2 promedian 5,4, así que el centro es
     6,4: sale 6 o 7 el 57 % de las veces, 5 el 17 %, 8 el 14 %, 4 el 6 %,
     9 el 4 %. Con diez entradas, el promedio en décimas es la suma de las
     notas, y la campana va en una tabla de enteros (`PESO_REROLL`, la
     distancia al centro en décimas): `Math.exp` no da el mismo último bit
     en todos los navegadores, y dos navegadores no pueden ver notas
     distintas de la misma carta. */
  const REROLL = { n: 10, bono: 1, sigma: 1.3 };
  const PESO_REROLL = [1000000,997046,988235,973724,953766,928705,898967,865048,827498,786907,743893,699081,653093,606531,559965,513924,468886,425271,383437,343679,306226,271245,238842,209069,181928,157377,135335,115694,98320,83062,69758,58239,48336,39879,32709,26669,21616,17417,13951,11109,8794,6920,5413,4209,3254,2501,1911,1451,1095,822,613,455,335,246,179,130,93,67,48,34,24,17,12,8,5,4,3,2,1,1,1];
  /* El peso de cada nota 1…10 (índice 0…9), en enteros. */
  function pesosReroll(notas) {
    const suma = notas.reduce((t, g) => t + (g | 0), 0);
    const centro = Math.round(suma * 10 / Math.max(1, notas.length)) + REROLL.bono * 10;   // en décimas
    const pesos = [];
    for (let g = 1; g <= 10; g++) pesos.push(PESO_REROLL[Math.abs(10 * g - centro)] || 0);
    if (!pesos.some(Boolean)) pesos[centro >= 55 ? 9 : 0] = 1;   // centro fuera de la tabla: lo más cercano
    return pesos;
  }
  /* Lo mismo como probabilidades (para enseñarlo), y el promedio esperado. */
  function distribucionReroll(notas) {
    const p = pesosReroll(notas), t = p.reduce((a, b) => a + b, 0);
    const prob = p.map(x => x / t);
    return { prob, media: prob.reduce((m, x, i) => m + x * (i + 1), 0), centro: notas.reduce((a, b) => a + b, 0) / notas.length + REROLL.bono };
  }
  /* La carta que sale: {id, g, w}. `tier` es la rareza de las diez que
     entraron (0 a 2) y `notas` sus notas ocultas, en el orden escrito. */
  /* El salto, en diez milésimas y por rareza de entrada (`SALTO_W[tier]`,
     cada fila: subir una, dos, tres). De común: rara 92 %, épica 7,5 %,
     legendaria 0,5 %. De rara: épica 96 %, legendaria 4 %. De épica:
     siempre legendaria. Sale de su propio resumen, para que la carta y la
     nota sigan saliendo del mismo generador de siempre, y solo cuenta
     desde `SALTOS_DESDE`: un re-roll escrito antes vuelve a dar
     exactamente la carta que dio. */
  const SALTO_W = [[9200, 750, 50], [9600, 400], [10000]];
  const SALTOS_DESDE = 1790960400000;
  function saltoReroll(k, at, tier) {
    if (at < SALTOS_DESDE) return 1;
    return 1 + pesado(generador(sha256("prodrop-salto:" + k).slice(0, 4)), SALTO_W[tier]);
  }
  /* La probabilidad de cada rareza de salida para una rareza de entrada. */
  function probSalida(tier, tope = 3) {
    const p = [0, 0, 0, 0], w = SALTO_W[tier], t = w.reduce((a, b) => a + b, 0);
    w.forEach((x, i) => { p[Math.min(tope, tier + 1 + i)] += x / t; });
    return p;
  }
  const memoR = new Map();
  function reroll(uid, clave, at, tier, notas) {
    const k = uid + "|" + clave + "|" + at + "|" + tier + "|" + notas.join(",");
    if (memoR.has(k)) return memoR.get(k);
    const r = generador(sha256("prodrop-reroll:" + k).slice(0, 4));
    const P = poolDe(clave), posibles = P[Math.min(P.tope, tier + saltoReroll(k, at, tier))];
    const c = elige(r, posibles, P.uniforme);
    const res = { id: c.n, g: 1 + pesado(r, pesosReroll(notas)), w: (r.u32() & 0x7fffffff) | 1 };
    memoR.set(k, res);
    return res;
  }

  /* ---------- la plantilla de fútbol ----------
     Un once en 4-3-3, fijo: once casillas en este orden (portero, cuatro
     defensas, tres medios, tres delanteros). Cualquier carta de fútbol va
     en cualquier casilla. Cada carta vale de 0 a 100: la rareza pone el
     techo (común 60, rara 80, épica 100) y el estado lo escala (nota 10,
     entero; nota 1, el 55 %). La plantilla es el promedio de las once, y
     una casilla vacía vale 0. */
  const FORMACION = [
    { pos: "POR", fila: 0 },
    { pos: "LI", fila: 1 }, { pos: "DFC", fila: 1 }, { pos: "DFC", fila: 1 }, { pos: "LD", fila: 1 },
    { pos: "MC", fila: 2 }, { pos: "MC", fila: 2 }, { pos: "MC", fila: 2 },
    { pos: "EI", fila: 3 }, { pos: "DC", fila: 3 }, { pos: "ED", fila: 3 }
  ];
  const PUNTOS_RAREZA = [60, 80, 100, 100];
  const puntosCarta = (tier, g) => Math.round(PUNTOS_RAREZA[tier] * (0.5 + 0.05 * g));
  // `lista`: once {tier, g} o null
  const puntosPlantilla = lista => Math.round(FORMACION.reduce((s, _, i) => s + (lista[i] ? puntosCarta(lista[i].tier, lista[i].g) : 0), 0) / FORMACION.length);

  /* ---------- lo de una cuenta ----------
     `s` = {clave: {at, p}} (los sobres), `g` = {clave: {i: {at, p}}} (lo
     graduado). Devuelve las copias, de la más vieja a la más nueva. */
  function coleccion(uid, s, g) {
    const out = [];
    const sobres = Object.entries(s || {}).filter(([, x]) => x && Number.isFinite(x.at))
      .sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1));
    for (const [k, x] of sobres) {
      const so = sobre(uid, k, x.at), gk = (g && g[k]) || {};
      so.cartas.forEach((c, i) => out.push({ k, i, at: x.at, id: c.id, g: c.g, w: c.w, gr: !!gk[i], dios: so.dios }));
    }
    return out;
  }
  const gasto = (s, g) => {
    let t = 0;
    for (const x of Object.values(s || {})) t += (x && +x.p) || 0;
    for (const porK of Object.values(g || {})) for (const x of Object.values(porK || {})) t += (x && +x.p) || 0;
    return t;
  };

  return {
    PEOPLE, SHINY, TIERS, VARIANTS, FOLDER, CARDS, TOTAL, POR_TIER, LEGADO, COMPONENTES, TEMAS, FUTBOLISTAS, PREMIER, MEDIAS, esFutbol, CLUBES, FORMACION, puntosCarta, puntosPlantilla, COLECCIONES, COL, POR_COL, POOL,
    coleccionDe, poolDe, GRADE_W, GRADE_WORD, PRECIO, DIOS, ESPERADO, BANDAS, tierDeMedia, PESOS_FUTBOL,
    subtitulo, acento, colorNota, precioSobre, sha256, generador, sobre, probabilidad, notaOMas, pDios, coleccion, gasto,
    REROLL, PESO_REROLL, pesosReroll, distribucionReroll, reroll, SALTO_W, SALTOS_DESDE, probSalida
  };
});
