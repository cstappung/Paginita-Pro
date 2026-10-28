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
  /* Los clubes de la Champions League 2026-27 que se fueron sumando (misma
     forma de fila; fotos en `cards/champions/<club>/<id>.webp`). Las fotos
     son retratos de las webs oficiales de cada club. Una carta nueva va
     siempre al final y se anota en `AMPLIACIONES`. */
  const CHAMPIONS = [
    ["betis", "alvaro-valles", "Álvaro Valles", "POR", 1, "ES"],
    ["betis", "diego-conde", "Diego Conde", "POR", 13, "ES"],
    ["betis", "hector-bellerin", "H. Bellerín", "DEF", 2, "ES"],
    ["betis", "diego-llorente", "Diego Llorente", "DEF", 3, "ES"],
    ["betis", "natan", "Natan", "DEF", 4, "BR"],
    ["betis", "marc-bartra", "Marc Bartra", "DEF", 5, "ES"],
    ["betis", "fran-garcia", "Fran García", "DEF", 11, "ES"],
    ["betis", "angel-ortiz", "Ángel Ortiz", "DEF", 12, "ES"],
    ["betis", "valentin-gomez", "Valentín Gómez", "DEF", 16, "AR"],
    ["betis", "junior-firpo", "Junior Firpo", "DEF", 23, "DO"],
    ["betis", "f-bernal", "F. Bernal", "DEF", 6, "MX"],
    ["betis", "pablo-fornals", "Pablo Fornals", "MED", 8, "ES"],
    ["betis", "iker-losada", "Iker Losada", "MED", 14, "ES"],
    ["betis", "n-deossa", "N. Deossa", "MED", 18, "CO"],
    ["betis", "g-lo-celso", "G. Lo Celso", "MED", 20, "AR"],
    ["betis", "marc-roca", "Marc Roca", "MED", 21, "ES"],
    ["betis", "isco", "Isco", "MED", 22, "ES"],
    ["betis", "dani-ceballos", "Dani Ceballos", "MED", 25, "ES"],
    ["betis", "antony", "Antony", "DEL", 7, "BR"],
    ["betis", "cucho", "Cucho", "DEL", 9, "CO"],
    ["betis", "ez-abde", "Ez Abde", "DEL", 10, "MA"],
    ["betis", "r-riquelme", "R. Riquelme", "DEL", 17, "ES"],
    ["betis", "troy-parrott", "Troy Parrott", "DEL", 19, "IE"],
    ["betis", "aitor-ruibal", "Aitor Ruibal", "DEF", 24, "ES"],
    ["betis", "j-morante", "J. Morante", "MED", 27, "ES"],
    ["psg", "achraf-hakimi", "Achraf Hakimi", "DEF", 2, "MA"],
    ["psg", "lucas-beraldo", "Lucas Beraldo", "DEF", 4, "BR"],
    ["psg", "marquinhos", "Marquinhos", "DEF", 5, "BR"],
    ["psg", "illia-zabarnyi", "Illia Zabarnyi", "DEF", 6, "UA"],
    ["psg", "khvicha-kvaratskhelia", "Kvaratskhelia", "DEL", 7, "GE"],
    ["psg", "fabian-ruiz", "Fabián Ruiz", "MED", 8, "ES"],
    ["psg", "ferran-torres", "Ferran Torres", "DEL", 9, "ES"],
    ["psg", "ousmane-dembele", "O. Dembélé", "DEL", 10, "FR"],
    ["psg", "maghnes-akliouche", "M. Akliouche", "MED", 11, "FR"],
    ["psg", "lucas-digne", "Lucas Digne", "DEF", 12, "FR"],
    ["psg", "desire-doue", "Désiré Doué", "DEL", 14, "FR"],
    ["psg", "vitinha", "Vitinha", "MED", 17, "PT"],
    ["psg", "lucas-hernandez", "L. Hernández", "DEF", 21, "FR"],
    ["psg", "mika-godts", "Mika Godts", "DEL", 22, "BE"],
    ["psg", "senny-mayulu", "Senny Mayulu", "MED", 24, "FR"],
    ["psg", "nuno-mendes", "Nuno Mendes", "DEF", 25, "PT"],
    ["psg", "lucas-chevalier", "L. Chevalier", "POR", 30, "FR"],
    ["psg", "warren-zaire-emery", "W. Zaïre-Emery", "MED", 33, "FR"],
    ["psg", "matvey-safonov", "Matvey Safonov", "POR", 39, "RU"],
    ["psg", "willian-pacho", "Willian Pacho", "DEF", 51, "EC"],
    ["psg", "joao-neves", "João Neves", "MED", 87, "PT"],
    ["como", "jean-butez", "Jean Butez", "POR", 1, "FR"],
    ["como", "mauro-vigorito", "Mauro Vigorito", "POR", 22, "IT"],
    ["como", "robert-sanchez", "Robert Sánchez", "POR", 97, "ES"],
    ["como", "willy-kambwala", "Willy Kambwala", "DEF", 53, "FR"],
    ["como", "trevoh-chalobah", "T. Chalobah", "DEF", 99, "ENG"],
    ["como", "yan-couto", "Yan Couto", "DEF", 27, "BR"],
    ["como", "jacobo-ramon", "Jacobo Ramón", "DEF", 4, "ES"],
    ["como", "alex-valle", "Álex Valle", "DEF", 3, "ES"],
    ["como", "ivan-smolcic", "Ivan Smolčić", "DEF", 28, "HR"],
    ["como", "marc-oliver-kempf", "Kempf", "DEF", 2, "DE"],
    ["como", "edoardo-goldaniga", "E. Goldaniga", "DEF", 18, "IT"],
    ["como", "alberto-dossena", "A. Dossena", "DEF", 13, "IT"],
    ["como", "samuele-ricci", "Samuele Ricci", "MED", 21, "IT"],
    ["como", "mattia-liberali", "M. Liberali", "DEL", 30, "IT"],
    ["como", "luis-milla", "Luis Milla", "MED", 6, "ES"],
    ["como", "martin-baturina", "M. Baturina", "MED", 20, "HR"],
    ["como", "lucas-da-cunha", "Lucas Da Cunha", "MED", 7, "FR"],
    ["como", "nicolas-paz", "Nicolás Paz", "MED", 10, "AR"],
    ["como", "maxence-caqueret", "M. Caqueret", "MED", 8, "FR"],
    ["como", "maximo-perrone", "Máximo Perrone", "MED", 5, "AR"],
    ["como", "adrian-lahdo", "Adrian Lahdo", "MED", 15, "SE"],
    ["como", "moise-kean", "Moise Kean", "DEL", 90, "IT"],
    ["como", "jayden-addai", "Jayden Addai", "DEL", 42, "NL"],
    ["como", "jesus-rodriguez", "J. Rodríguez", "DEL", 17, "ES"],
    ["como", "assane-diao", "Assane Diao", "DEL", 11, "SN"],
    ["como", "anastasios-douvikas", "Douvikas", "DEL", 9, "GR"],
    ["inter", "josep-martinez", "Josep Martínez", "POR", 1, "ES"],
    ["inter", "raffaele-di-gennaro", "R. Di Gennaro", "POR", 12, "IT"],
    ["inter", "ivan-provedel", "Ivan Provedel", "POR", 49, "IT"],
    ["inter", "john-stones", "John Stones", "DEF", 6, "ENG"],
    ["inter", "manuel-akanji", "Manuel Akanji", "DEF", 25, "CH"],
    ["inter", "benjamin-pavard", "B. Pavard", "DEF", 28, "FR"],
    ["inter", "carlos-augusto", "Carlos Augusto", "DEF", 30, "BR"],
    ["inter", "yann-bisseck", "Yann Bisseck", "DEF", 31, "DE"],
    ["inter", "federico-dimarco", "F. Dimarco", "DEF", 32, "IT"],
    ["inter", "alessandro-bastoni", "A. Bastoni", "DEF", 95, "IT"],
    ["inter", "djed-spence", "Djed Spence", "DEF", 99, "ENG"],
    ["inter", "aleksandar-stankovic", "Stanković", "MED", 5, "RS"],
    ["inter", "piotr-zielinski", "P. Zieliński", "MED", 7, "PL"],
    ["inter", "petar-sucic", "Petar Sučić", "MED", 8, "HR"],
    ["inter", "luis-henrique", "Luis Henrique", "MED", 11, "BR"],
    ["inter", "andy-diouf", "Andy Diouf", "MED", 17, "FR"],
    ["inter", "hakan-calhanoglu", "H. Çalhanoğlu", "MED", 20, "TR"],
    ["inter", "curtis-jones", "Curtis Jones", "MED", 21, "ENG"],
    ["inter", "henrikh-mkhitaryan", "Mkhitaryan", "MED", 22, "AM"],
    ["inter", "nicolo-barella", "Nicolò Barella", "MED", 23, "IT"],
    ["inter", "marcus-thuram", "Marcus Thuram", "DEL", 9, "FR"],
    ["inter", "lautaro-martinez", "L. Martínez", "DEL", 10, "AR"],
    ["inter", "ange-yoan-bonny", "Bonny", "DEL", 14, "FR"],
    ["inter", "pio-esposito", "Pio Esposito", "DEL", 94, "IT"],
    ["roma", "santiago-castro", "S. Castro", "DEL", 9, "AR"],
    ["roma", "donyell-malen", "Donyell Malen", "DEL", 14, "NL"],
    ["roma", "matias-soule", "Matías Soulé", "DEL", 18, "AR"],
    ["roma", "paulo-dybala", "Paulo Dybala", "DEL", 21, "AR"],
    ["roma", "bryan-cristante", "B. Cristante", "MED", 4, "IT"],
    ["roma", "lorenzo-pellegrini", "L. Pellegrini", "MED", 7, "IT"],
    ["roma", "marten-de-roon", "Marten de Roon", "MED", 15, "NL"],
    ["roma", "manu-kone", "Manu Koné", "MED", 17, "FR"],
    ["roma", "niccolo-pisilli", "N. Pisilli", "MED", 61, "IT"],
    ["roma", "rodrigo-mora", "Rodrigo Mora", "MED", 86, "PT"],
    ["roma", "devyne-rensch", "Devyne Rensch", "DEF", 2, "NL"],
    ["roma", "konstantinos-koulierakis", "Koulierakis", "DEF", 3, "GR"],
    ["roma", "evan-ndicka", "Evan Ndicka", "DEF", 5, "CI"],
    ["roma", "nahuel-molina", "Nahuel Molina", "DEF", 20, "AR"],
    ["roma", "mario-hermoso", "Mario Hermoso", "DEF", 22, "ES"],
    ["roma", "gianluca-mancini", "G. Mancini", "DEF", 23, "IT"],
    ["roma", "leonardo-balerdi", "L. Balerdi", "DEF", 26, "AR"],
    ["roma", "wesley", "Wesley", "DEF", 43, "BR"],
    ["roma", "daniele-ghilardi", "D. Ghilardi", "DEF", 87, "IT"],
    ["roma", "pierluigi-gollini", "P. Gollini", "POR", 95, "IT"],
    ["roma", "mile-svilar", "Mile Svilar", "POR", 99, "RS"],
    ["napoli", "alex-meret", "Alex Meret", "POR", 1, "IT"],
    ["napoli", "nikita-contini", "Nikita Contini", "POR", 14, "UA"],
    ["napoli", "vanja-milinkovic-savic", "V. Milinković", "POR", 32, "RS"],
    ["napoli", "benoit-badiashile", "B. Badiashile", "DEF", 5, "FR"],
    ["napoli", "amir-rrahmani", "Amir Rrahmani", "DEF", 13, "XK"],
    ["napoli", "rafa-marin", "Rafa Marín", "DEF", 16, "ES"],
    ["napoli", "mathias-olivera", "M. Olivera", "DEF", 17, "UY"],
    ["napoli", "giovanni-di-lorenzo", "G. Di Lorenzo", "DEF", 22, "IT"],
    ["napoli", "sam-beukema", "Sam Beukema", "DEF", 31, "NL"],
    ["napoli", "leonardo-spinazzola", "L. Spinazzola", "DEF", 37, "IT"],
    ["napoli", "costantino-favasuli", "C. Favasuli", "MED", 2, "IT"],
    ["napoli", "billy-gilmour", "Billy Gilmour", "MED", 6, "SCO"],
    ["napoli", "scott-mctominay", "S. McTominay", "MED", 8, "SCO"],
    ["napoli", "kevin-de-bruyne", "K. De Bruyne", "MED", 11, "BE"],
    ["napoli", "stanislav-lobotka", "S. Lobotka", "MED", 68, "SK"],
    ["napoli", "frank-anguissa", "Frank Anguissa", "MED", 99, "CM"],
    ["napoli", "david-neres", "David Neres", "DEL", 7, "BR"],
    ["napoli", "rasmus-hjlund", "Rasmus Højlund", "DEL", 19, "DK"],
    ["napoli", "lorenzo-lucca", "Lorenzo Lucca", "DEL", 20, "IT"],
    ["napoli", "matteo-politano", "M. Politano", "DEL", 21, "IT"],
    ["napoli", "antonio-vergara", "A. Vergara", "DEL", 26, "IT"],
    ["napoli", "alisson-santos", "Alisson Santos", "DEL", 27, "BR"],
    ["napoli", "noa-lang", "Noa Lang", "DEL", 70, "NL"],
    ["dortmund", "gregor-kobel", "Gregor Kobel", "POR", 1, "CH"],
    ["dortmund", "patrick-drewes", "Patrick Drewes", "POR", 30, "DE"],
    ["dortmund", "alexander-meyer", "A. Meyer", "POR", 33, "DE"],
    ["dortmund", "waldemar-anton", "Waldemar Anton", "DEF", 3, "DE"],
    ["dortmund", "nico-schlotterbeck", "Schlotterbeck", "DEF", 4, "DE"],
    ["dortmund", "ramy-bensebaini", "R. Bensebaini", "DEF", 5, "DZ"],
    ["dortmund", "joane-gadou", "Joane Gadou", "DEF", 22, "FR"],
    ["dortmund", "daniel-svensson", "D. Svensson", "DEF", 24, "SE"],
    ["dortmund", "julian-ryerson", "Julian Ryerson", "DEF", 26, "NO"],
    ["dortmund", "filippo-mane", "Filippo Mané", "DEF", 39, "IT"],
    ["dortmund", "jobe-bellingham", "J. Bellingham", "MED", 7, "ENG"],
    ["dortmund", "felix-nmecha", "Felix Nmecha", "MED", 8, "DE"],
    ["dortmund", "carney-chukwuemeka", "Chukwuemeka", "MED", 17, "ENG"],
    ["dortmund", "ethan-nwaneri", "Ethan Nwaneri", "DEL", 18, "ENG"],
    ["dortmund", "konstantinos-karetsas", "Karetsas", "MED", 19, "GR"],
    ["dortmund", "marcel-sabitzer", "M. Sabitzer", "MED", 20, "AT"],
    ["dortmund", "emre-can", "Emre Can", "DEF", 23, "DE"],
    ["dortmund", "joey-veerman", "Joey Veerman", "MED", 25, "NL"],
    ["dortmund", "justin-lerma", "Justin Lerma", "MED", 28, "EC"],
    ["dortmund", "giannis-konstantelias", "Konstantelias", "MED", 45, "GR"],
    ["dortmund", "serhou-guirassy", "S. Guirassy", "DEL", 9, "GN"],
    ["dortmund", "maximilian-beier", "M. Beier", "DEL", 14, "DE"],
    ["dortmund", "fabio-silva", "Fábio Silva", "DEL", 21, "PT"]
  ];
  /* Cartas especiales: una versión de un jugador que sale por algo que pasó
     (aquí, el Clásico). Es el mismo jugador (`person`: no se pone dos veces en
     el once) pero otra carta (otra foto, otra media, su propia rareza y
     su cinta). Séptimo elemento: { person, sub, cinta, especial, limitada, peso }.
     `limitada`: es de tiempo limitado (el texto lo dice; sacarla del pool
     después es a mano y con una ampliación que no cambie los sobres ya
     comprados); `peso`: cuántas veces más salen que una legendaria
     cualquiera. Van al final del catálogo y dentro de una ampliación, como
     todo lo nuevo. */
  const ESPECIALES = [
    ["realmadrid", "mbappe-mvp", "Mbappé", "DEL", 10, "FR", { person: "realmadrid-mbappe", sub: "Real Madrid · MVP del Clásico", cinta: "MVP DEL CLÁSICO", especial: "clasico", limitada: true, peso: 3 }],
    ["bayern", "harry-kane-balon", "Harry Kane", "DEL", 9, "ENG", { person: "bayern-harry-kane", sub: "Bayern Múnich · Balón de Oro", cinta: "BALÓN DE ORO 2026", especial: "balon", limitada: true, peso: 3 }]
  ];
  /* ---------- el Bayern Múnich (Bundesliga) ----------
     El primer equipo de fcbayern.com (octubre 2026), con la foto en
     cards/champions/bayern/<id>.webp. Quedaron fuera los que EA FC no
     tiene (N. Brown, Sapoko Ndiaye, Saibari) y el canterano David Santos,
     sin dorsal. Va **después** de las especiales, al final del catálogo,
     con su corte en `AMPLIACIONES`; la carta base de Kane es
     `bayern-harry-kane`, la misma persona que su Balón de Oro. */
  const BAYERN = [
    ["bayern", "manuel-neuer", "M. Neuer", "POR", 1, "DE"], ["bayern", "sven-ulreich", "S. Ulreich", "POR", 26, "DE"],
    ["bayern", "jonas-urbig", "J. Urbig", "POR", 40, "DE"], ["bayern", "dayot-upamecano", "Upamecano", "DEF", 2, "FR"],
    ["bayern", "minjae-kim", "Kim Min-jae", "DEF", 3, "KR"], ["bayern", "jonathan-tah", "J. Tah", "DEF", 4, "DE"],
    ["bayern", "alphonso-davies", "A. Davies", "DEF", 19, "CA"], ["bayern", "hiroki-ito", "H. Ito", "DEF", 21, "JP"],
    ["bayern", "sacha-boey", "S. Boey", "DEF", 23, "FR"], ["bayern", "josip-stanisic", "J. Stanišić", "DEF", 44, "HR"],
    ["bayern", "joshua-kimmich", "J. Kimmich", "MED", 6, "DE"], ["bayern", "tom-bischof", "T. Bischof", "MED", 8, "DE"],
    ["bayern", "jamal-musiala", "J. Musiala", "MED", 10, "DE"], ["bayern", "konrad-laimer", "K. Laimer", "MED", 27, "AT"],
    ["bayern", "lennart-karl", "L. Karl", "MED", 42, "DE"], ["bayern", "aleksandar-pavlovic", "A. Pavlović", "MED", 45, "DE"],
    ["bayern", "serge-gnabry", "S. Gnabry", "DEL", 7, "DE"], ["bayern", "harry-kane", "Harry Kane", "DEL", 9, "ENG"],
    ["bayern", "luis-diaz", "Luis Díaz", "DEL", 14, "CO"], ["bayern", "michael-olise", "M. Olise", "DEL", 17, "FR"]
  ];
  /* ---------- Chile, Argentina, la MLS y Arabia ----------
     Colo-Colo, la Universidad Católica y la U. de Chile; River, Boca y
     Estudiantes; Inter Miami (Messi), CF Montréal (Alexis Sánchez) y LAFC
     (Son); Al Nassr (Cristiano), Al Hilal y Al Ittihad. Medias y
     posiciones de EA FC (fut.gg). El plantel es el de hoy: todos de FC 27
     menos Colo-Colo y la U, que no están en FC 27 (sus planteles salen de
     Wikipedia, ago–oct 2026, y cada jugador de la última versión que lo
     trae: FC 26, 25, 24; Lucero de FC 23, porque sin un segundo delantero
     la U no armaba un once). Quien llegó sin carta en ningún FIFA queda
     fuera (Eduardo Vargas, Lichnovsky, Marchant…). De los demás clubes,
     los 24 de mejor media. La foto es la cara del juego sobre los colores
     del club (cards/champions/<club>/<id>.webp). Sin dorsal (0): la carta
     ya no lo muestra. Van después del Bayern, con su propio corte en
     `AMPLIACIONES`. */
  const CHILE = [
    // Colo-Colo (19)
    ["colocolo", "claudio-aquino", "C. Aquino", "MED", 0, "AR"], ["colocolo", "fernando-de-paul", "De Paul", "POR", 0, "CL"],
    ["colocolo", "arturo-vidal", "Arturo Vidal", "MED", 0, "CL"], ["colocolo", "marcos-bolados", "M. Bolados", "DEL", 0, "CL"],
    ["colocolo", "jonathan-villagra", "J. Villagra", "DEF", 0, "CL"], ["colocolo", "felipe-mendez", "F. Méndez", "MED", 0, "CL"],
    ["colocolo", "erick-wiemberg", "E. Wiemberg", "DEF", 0, "CL"], ["colocolo", "javier-correa", "J. Correa", "DEL", 0, "AR"],
    ["colocolo", "eduardo-villanueva", "E. Villanueva", "POR", 0, "CL"], ["colocolo", "tomas-alarcon", "T. Alarcón", "MED", 0, "CL"],
    ["colocolo", "leandro-hernandez", "L. Hernández", "DEL", 0, "CL"], ["colocolo", "matias-fernandez", "M. Fernández", "DEF", 0, "CL"],
    ["colocolo", "javier-mendez", "J. Méndez", "DEF", 0, "UY"], ["colocolo", "lautaro-pastran", "L. Pastrán", "DEL", 0, "AR"],
    ["colocolo", "joaquin-sosa", "J. Sosa", "DEF", 0, "UY"], ["colocolo", "ivan-roman", "I. Román", "DEF", 0, "CL"],
    ["colocolo", "maximiliano-romero", "M. Romero", "DEL", 0, "AR"], ["colocolo", "alvaro-madrid", "Á. Madrid", "MED", 0, "CL"],
    ["colocolo", "jeyson-rojas", "J. Rojas", "DEF", 0, "CL"],
    // Universidad Católica (27)
    ["ucatolica", "clemente-montes", "C. Montes", "MED", 0, "CL"], ["ucatolica", "cristian-cuevas", "C. Cuevas", "MED", 0, "CL"],
    ["ucatolica", "justo-giani", "J. Giani", "MED", 0, "AR"], ["ucatolica", "juan-ignacio-diaz", "J. I. Díaz", "DEF", 0, "AR"],
    ["ucatolica", "vicente-bernedo", "V. Bernedo", "POR", 0, "CL"], ["ucatolica", "fernando-zampedri", "F. Zampedri", "DEL", 0, "CL"],
    ["ucatolica", "daniel-gonzalez", "D. González", "DEF", 0, "CL"], ["ucatolica", "agustin-garcia-basso", "García Basso", "DEF", 0, "AR"],
    ["ucatolica", "fernando-zuqui", "F. Zuqui", "MED", 0, "AR"], ["ucatolica", "alfred-canales", "A. Canales", "MED", 0, "CL"],
    ["ucatolica", "jhojan-valencia", "J. Valencia", "MED", 0, "CO"], ["ucatolica", "jimmy-martinez", "J. Martínez", "MED", 0, "CL"],
    ["ucatolica", "matias-palavecino", "M. Palavecino", "MED", 0, "AR"], ["ucatolica", "diego-valencia", "D. Valencia", "DEL", 0, "CL"],
    ["ucatolica", "diego-corral", "D. Corral", "MED", 0, "CL"], ["ucatolica", "eugenio-mena", "Eugenio Mena", "DEF", 0, "CL"],
    ["ucatolica", "gary-medel", "Gary Medel", "MED", 0, "CL"], ["ucatolica", "sebastian-arancibia", "S. Arancibia", "DEF", 0, "CL"],
    ["ucatolica", "bernardo-cerezo", "B. Cerezo", "DEF", 0, "CL"], ["ucatolica", "branco-ampuero", "B. Ampuero", "DEF", 0, "CL"],
    ["ucatolica", "juan-francisco-rossel", "J. F. Rossel", "MED", 0, "CL"], ["ucatolica", "agustin-farias", "A. Farías", "MED", 0, "AR"],
    ["ucatolica", "tomas-asta-buruaga", "Asta-Buruaga", "DEF", 0, "CL"], ["ucatolica", "dario-melo", "D. Melo", "POR", 0, "CL"],
    ["ucatolica", "martin-gomez", "M. Gómez", "MED", 0, "AR"], ["ucatolica", "francisco-valdes", "F. Valdés", "POR", 0, "CL"],
    ["ucatolica", "matias-ignacio-perez", "Ignacio Pérez", "DEF", 0, "CL"],
    // Universidad de Chile (15)
    ["udechile", "gabriel-castellon", "G. Castellón", "POR", 0, "CL"], ["udechile", "javier-altamirano", "J. Altamirano", "MED", 0, "CL"],
    ["udechile", "charles-aranguiz", "Aránguiz", "MED", 0, "CL"], ["udechile", "cristopher-toselli", "C. Toselli", "POR", 0, "CL"],
    ["udechile", "fabian-hormazabal", "F. Hormazábal", "DEF", 0, "CL"], ["udechile", "israel-poblete", "I. Poblete", "MED", 0, "CL"],
    ["udechile", "octavio-rivero", "O. Rivero", "DEL", 0, "UY"], ["udechile", "nicolas-fernandez", "N. Fernández", "DEF", 0, "CL"],
    ["udechile", "matias-zaldivia", "M. Zaldivia", "DEF", 0, "CL"], ["udechile", "nicolas-ramirez", "N. Ramírez", "DEF", 0, "CL"],
    ["udechile", "marcelo-diaz", "Marcelo Díaz", "MED", 0, "CL"], ["udechile", "marcelo-morales", "M. Morales", "DEF", 0, "CL"],
    ["udechile", "tobias-reinhart", "T. Reinhart", "MED", 0, "AR"], ["udechile", "bianneider-tamayo", "B. Tamayo", "DEF", 0, "VE"],
    ["udechile", "juan-martin-lucero", "J. M. Lucero", "DEL", 0, "AR"]
  ];
  const ARGENTINA = [
    // River Plate (24)
    ["river", "mauro-arambarri", "M. Arambarri", "MED", 0, "UY"], ["river", "angel-correa", "Ángel Correa", "MED", 0, "AR"],
    ["river", "anibal-moreno", "A. Moreno", "MED", 0, "AR"], ["river", "thiago-almada", "Almada", "MED", 0, "AR"],
    ["river", "nicolas-otamendi", "Otamendi", "DEF", 0, "AR"], ["river", "gonzalo-montiel", "Montiel", "DEF", 0, "AR"],
    ["river", "sebastian-driussi", "S. Driussi", "DEL", 0, "AR"], ["river", "tomas-galvan", "T. Galván", "MED", 0, "AR"],
    ["river", "marcos-acuna", "Marcos Acuña", "DEF", 0, "AR"], ["river", "lucas-martinez-quarta", "M. Quarta", "DEF", 0, "AR"],
    ["river", "rafael-santos-borre", "Santos Borré", "DEL", 0, "CO"], ["river", "lautaro-rivero", "L. Rivero", "DEF", 0, "AR"],
    ["river", "lucas-beltran", "L. Beltrán", "DEL", 0, "AR"], ["river", "fausto-vera", "F. Vera", "MED", 0, "AR"],
    ["river", "fabricio-bustos", "F. Bustos", "DEF", 0, "AR"], ["river", "kendry-paez", "K. Páez", "MED", 0, "EC"],
    ["river", "juan-portillo", "J. Portillo", "DEF", 0, "AR"], ["river", "santiago-beltran", "S. Beltrán", "POR", 0, "AR"],
    ["river", "francisco-ortega", "F. Ortega", "DEF", 0, "AR"], ["river", "giovanni-gonzalez", "G. González", "DEF", 0, "UY"],
    ["river", "ezequiel-centurion", "E. Centurión", "POR", 0, "AR"], ["river", "lucas-silva", "L. Silva", "MED", 0, "AR"],
    ["river", "tobias-andrada", "T. Andrada", "MED", 0, "AR"], ["river", "tobias-ramirez", "T. Ramírez", "DEF", 0, "AR"],
    // Boca Juniors (24)
    ["boca", "leandro-paredes", "Paredes", "MED", 0, "AR"], ["boca", "sebastian-villa", "S. Villa", "DEL", 0, "CO"],
    ["boca", "santiago-ascacibar", "S. Ascacíbar", "MED", 0, "AR"], ["boca", "alvaro-montero", "Á. Montero", "POR", 0, "CO"],
    ["boca", "lautaro-di-lollo", "Di Lollo", "DEF", 0, "AR"], ["boca", "lautaro-blanco", "L. Blanco", "DEF", 0, "AR"],
    ["boca", "leandro-lozano", "L. Lozano", "DEF", 0, "UY"], ["boca", "miguel-angel-merentiel", "Merentiel", "DEL", 0, "UY"],
    ["boca", "agustin-marchesin", "A. Marchesín", "POR", 0, "AR"], ["boca", "adam-bareiro", "A. Bareiro", "DEL", 0, "PY"],
    ["boca", "malcom-braida", "M. Braida", "MED", 0, "AR"], ["boca", "carlos-palacios", "C. Palacios", "MED", 0, "CL"],
    ["boca", "ayrton-costa", "A. Costa", "DEF", 0, "AR"], ["boca", "rodrigo-battaglia", "R. Battaglia", "MED", 0, "AR"],
    ["boca", "enner-valencia", "Enner Valencia", "DEL", 0, "EC"], ["boca", "milton-delgado", "M. Delgado", "MED", 0, "AR"],
    ["boca", "alan-velasco", "A. Velasco", "MED", 0, "AR"], ["boca", "kevin-zenon", "K. Zenón", "MED", 0, "AR"],
    ["boca", "tomas-belmonte", "T. Belmonte", "MED", 0, "AR"], ["boca", "nicolas-figal", "N. Figal", "DEF", 0, "AR"],
    ["boca", "angel-romero", "Á. Romero", "DEL", 0, "PY"], ["boca", "marco-pellegrino", "M. Pellegrino", "DEF", 0, "AR"],
    ["boca", "milton-gimenez", "M. Giménez", "DEL", 0, "AR"], ["boca", "leandro-brey", "L. Brey", "POR", 0, "AR"],
    // Estudiantes de La Plata (24)
    ["estudiantes", "fernando-muslera", "Muslera", "POR", 0, "UY"], ["estudiantes", "tiago-palacios", "T. Palacios", "MED", 0, "UY"],
    ["estudiantes", "guido-carrillo", "G. Carrillo", "DEL", 0, "AR"], ["estudiantes", "gabriel-neves", "G. Neves", "MED", 0, "UY"],
    ["estudiantes", "leandro-gonzalez-pirez", "González Pirez", "DEF", 0, "AR"], ["estudiantes", "edwuin-cetre", "E. Cetré", "MED", 0, "CO"],
    ["estudiantes", "ezequiel-piovi", "E. Piovi", "MED", 0, "AR"], ["estudiantes", "eros-mancuso", "E. Mancuso", "DEF", 0, "AR"],
    ["estudiantes", "santiago-nunez", "S. Núñez", "DEF", 0, "AR"], ["estudiantes", "gaston-benedetti", "G. Benedetti", "DEF", 0, "AR"],
    ["estudiantes", "alexis-castro", "A. Castro", "MED", 0, "AR"], ["estudiantes", "brian-aguirre", "B. Aguirre", "DEL", 0, "AR"],
    ["estudiantes", "jose-sosa", "José Sosa", "MED", 0, "AR"], ["estudiantes", "joaquin-tobio-burgos", "Tobio Burgos", "MED", 0, "AR"],
    ["estudiantes", "joaquin-correa", "J. Correa", "DEL", 0, "AR"], ["estudiantes", "eric-meza", "E. Meza", "DEF", 0, "AR"],
    ["estudiantes", "santiago-arzamendia", "S. Arzamendia", "DEF", 0, "PY"], ["estudiantes", "tomas-palacios", "T. Palacios", "DEF", 0, "AR"],
    ["estudiantes", "jalil-elias", "J. Elías", "MED", 0, "SY"], ["estudiantes", "fabricio-iacovich", "F. Iacovich", "POR", 0, "AR"],
    ["estudiantes", "fabricio-perez", "F. Pérez", "MED", 0, "AR"], ["estudiantes", "baltasar-rodriguez", "B. Rodríguez", "MED", 0, "AR"],
    ["estudiantes", "lucas-alario", "L. Alario", "DEL", 0, "AR"], ["estudiantes", "ramiro-funes-mori", "Funes Mori", "DEF", 0, "AR"]
  ];
  const MLS = [
    // Inter Miami (24)
    ["intermiami", "lionel-messi", "Messi", "MED", 0, "AR"], ["intermiami", "rodrigo-de-paul", "De Paul", "MED", 0, "AR"],
    ["intermiami", "casemiro", "Casemiro", "MED", 0, "BR"], ["intermiami", "luis-suarez", "Luis Suárez", "DEL", 0, "UY"],
    ["intermiami", "german-berterame", "G. Berterame", "DEL", 0, "MX"], ["intermiami", "dayne-st-clair", "St. Clair", "POR", 0, "CA"],
    ["intermiami", "reguilon", "Reguilón", "DEF", 0, "ES"], ["intermiami", "tadeo-allende", "T. Allende", "MED", 0, "AR"],
    ["intermiami", "facundo-mura", "F. Mura", "DEF", 0, "AR"], ["intermiami", "telasco-segovia", "T. Segovia", "MED", 0, "VE"],
    ["intermiami", "yannick-bright", "Y. Bright", "MED", 0, "IT"], ["intermiami", "matias-galarza", "M. Galarza", "MED", 0, "PY"],
    ["intermiami", "micael", "Micael", "DEF", 0, "BR"], ["intermiami", "david-ayala", "D. Ayala", "MED", 0, "AR"],
    ["intermiami", "maximiliano-falcon", "M. Falcón", "DEF", 0, "UY"], ["intermiami", "gonzalo-lujan", "G. Luján", "DEF", 0, "AR"],
    ["intermiami", "ian-fray", "I. Fray", "DEF", 0, "JM"], ["intermiami", "mateo-silvetti", "M. Silvetti", "MED", 0, "AR"],
    ["intermiami", "luis-barraza", "L. Barraza", "POR", 0, "US"], ["intermiami", "rocco-rios-novo", "Ríos Novo", "POR", 0, "AR"],
    ["intermiami", "daniel-pinter", "D. Pintér", "DEL", 0, "US"], ["intermiami", "santiago-morales", "S. Morales", "MED", 0, "US"],
    ["intermiami", "fricio-caicedo", "F. Caicedo", "DEF", 0, "EC"], ["intermiami", "israel-boatwright", "I. Boatwright", "DEF", 0, "DO"],
    // CF Montréal (24)
    ["montreal", "alexis-sanchez", "Alexis Sánchez", "DEL", 0, "CL"], ["montreal", "prince-owusu", "P. Owusu", "DEL", 0, "GH"],
    ["montreal", "matty-longstaff", "M. Longstaff", "MED", 0, "ENG"], ["montreal", "wikelman-carmona", "W. Carmona", "MED", 0, "VE"],
    ["montreal", "brayan-ceballos", "B. Ceballos", "DEF", 0, "CO"], ["montreal", "brayan-vera", "B. Vera", "DEF", 0, "CO"],
    ["montreal", "dani-pereira", "D. Pereira", "MED", 0, "VE"], ["montreal", "victor-loturi", "V. Loturi", "MED", 0, "CA"],
    ["montreal", "dante-sealy", "D. Sealy", "MED", 0, "TT"], ["montreal", "luca-petrasso", "L. Petrasso", "DEF", 0, "CA"],
    ["montreal", "samuel-piette", "S. Piette", "MED", 0, "CA"], ["montreal", "frankie-amaya", "F. Amaya", "MED", 0, "US"],
    ["montreal", "jalen-neal", "J. Neal", "DEF", 0, "US"], ["montreal", "hennadii-synchuk", "H. Synchuk", "MED", 0, "UA"],
    ["montreal", "efrain-morales", "E. Morales", "DEF", 0, "BO"], ["montreal", "dawid-bugaj", "D. Bugaj", "DEF", 0, "PL"],
    ["montreal", "daniel-rios", "D. Ríos", "DEL", 0, "MX"], ["montreal", "sebastian-breza", "S. Breza", "POR", 0, "CA"],
    ["montreal", "olger-escobar", "O. Escobar", "MED", 0, "GT"], ["montreal", "brandan-craig", "B. Craig", "DEF", 0, "US"],
    ["montreal", "fabian-herbers", "F. Herbers", "MED", 0, "DE"], ["montreal", "aleksandr-guboglo", "A. Guboglo", "DEF", 0, "CA"],
    ["montreal", "bode-hidalgo", "B. Hidalgo", "DEF", 0, "US"], ["montreal", "ivan-losenko", "I. Losenko", "MED", 0, "UA"],
    // LAFC (24)
    ["lafc", "son-heung-min", "Son Heung-min", "DEL", 0, "KR"], ["lafc", "denis-bouanga", "D. Bouanga", "DEL", 0, "GA"],
    ["lafc", "hugo-lloris", "Lloris", "POR", 0, "FR"], ["lafc", "mark-delgado", "M. Delgado", "MED", 0, "US"],
    ["lafc", "armindo-sieb", "A. Sieb", "DEL", 0, "DE"], ["lafc", "leo-walta", "L. Walta", "MED", 0, "FI"],
    ["lafc", "ryan-hollingshead", "Hollingshead", "DEF", 0, "US"], ["lafc", "timothy-tillman", "T. Tillman", "MED", 0, "US"],
    ["lafc", "ryan-porteous", "R. Porteous", "DEF", 0, "SCO"], ["lafc", "aaron-long", "A. Long", "DEF", 0, "US"],
    ["lafc", "sergi-palencia", "S. Palencia", "DEF", 0, "ES"], ["lafc", "eddie-segura", "E. Segura", "DEF", 0, "CO"],
    ["lafc", "nkosi-tafari", "N. Tafari", "DEF", 0, "US"], ["lafc", "mathieu-choiniere", "M. Choinière", "MED", 0, "CA"],
    ["lafc", "yevgen-cheberko", "Y. Cheberko", "DEF", 0, "UA"], ["lafc", "tyler-boyd", "T. Boyd", "MED", 0, "US"],
    ["lafc", "jeremy-ebobisse", "J. Ebobisse", "DEL", 0, "US"], ["lafc", "jacob-shaffelburg", "J. Shaffelburg", "MED", 0, "CA"],
    ["lafc", "igor-jesus", "I. Jesus", "MED", 0, "BR"], ["lafc", "ryan-raposo", "R. Raposo", "MED", 0, "CA"],
    ["lafc", "thomas-hasal", "T. Hasal", "POR", 0, "CA"], ["lafc", "kenny-nielsen", "K. Nielsen", "DEF", 0, "US"],
    ["lafc", "cabral-carter", "C. Carter", "POR", 0, "US"], ["lafc", "jude-terry", "J. Terry", "MED", 0, "US"]
  ];
  const ARABIA = [
    // Al Nassr (24)
    ["alnassr", "cristiano-ronaldo", "C. Ronaldo", "DEL", 0, "PT"], ["alnassr", "joao-felix", "João Félix", "MED", 0, "PT"],
    ["alnassr", "kingsley-coman", "K. Coman", "MED", 0, "FR"], ["alnassr", "inigo-martinez", "I. Martínez", "DEF", 0, "ES"],
    ["alnassr", "sadio-mane", "Sadio Mané", "MED", 0, "SN"], ["alnassr", "mohamed-simakan", "M. Simakan", "DEF", 0, "FR"],
    ["alnassr", "bento", "Bento", "POR", 0, "BR"], ["alnassr", "samu-costa", "S. Costa", "MED", 0, "PT"],
    ["alnassr", "angelo", "Ângelo", "MED", 0, "BR"], ["alnassr", "abdulelah-al-amri", "Al Amri", "DEF", 0, "SA"],
    ["alnassr", "sultan-al-ghannam", "Al Ghannam", "DEF", 0, "SA"], ["alnassr", "nawaf-boushal", "N. Boushal", "DEF", 0, "SA"],
    ["alnassr", "nawaf-al-aqidi", "Al Aqidi", "POR", 0, "SA"], ["alnassr", "ayman-yahya", "A. Yahya", "DEF", 0, "SA"],
    ["alnassr", "abdullah-al-khaibari", "Al Khaibari", "MED", 0, "SA"], ["alnassr", "abdullah-al-hamdan", "Al Hamdan", "DEL", 0, "SA"],
    ["alnassr", "ali-al-hassan", "Al Hassan", "MED", 0, "SA"], ["alnassr", "nader-al-sharari", "Al Sharari", "DEF", 0, "SA"],
    ["alnassr", "saad-al-nasser", "Al Nasser", "DEF", 0, "SA"], ["alnassr", "salem-al-najdi", "Al Najdi", "DEF", 0, "SA"],
    ["alnassr", "raghid-al-najjar", "Al Najjar", "POR", 0, "SA"], ["alnassr", "sami-al-najai", "Al Najai", "MED", 0, "SA"],
    ["alnassr", "haydeer-abdulkareem", "H. Abdulkareem", "MED", 0, "IQ"], ["alnassr", "abdulmalik-al-jaber", "Al Jaber", "MED", 0, "SA"],
    // Al Hilal (24)
    ["alhilal", "ruben-neves", "R. Neves", "MED", 0, "PT"], ["alhilal", "sergej-milinkovic-savic", "Milinković", "MED", 0, "RS"],
    ["alhilal", "ollie-watkins", "O. Watkins", "DEL", 0, "ENG"], ["alhilal", "theo-hernandez", "T. Hernández", "DEF", 0, "FR"],
    ["alhilal", "yassine-bounou", "Bounou", "POR", 0, "MA"], ["alhilal", "kalidou-koulibaly", "Koulibaly", "DEF", 0, "SN"],
    ["alhilal", "salem-al-dawsari", "Al Dawsari", "MED", 0, "SA"], ["alhilal", "gabriel-martinelli", "G. Martinelli", "DEL", 0, "BR"],
    ["alhilal", "crysencio-summerville", "C. Summerville", "MED", 0, "NL"], ["alhilal", "hassan-tombakti", "H. Tombakti", "DEF", 0, "SA"],
    ["alhilal", "mohammed-kanno", "M. Kanno", "MED", 0, "SA"], ["alhilal", "mohamed-kader-meite", "Kader Meïté", "DEL", 0, "CI"],
    ["alhilal", "sultan-mandash", "S. Mandash", "MED", 0, "SA"], ["alhilal", "ali-lajami", "A. Lajami", "DEF", 0, "SA"],
    ["alhilal", "nasser-al-dawsari", "Al Dawsari", "MED", 0, "SA"], ["alhilal", "mohammed-al-owais", "Al Owais", "POR", 0, "SA"],
    ["alhilal", "muteb-al-harbi", "Al Harbi", "DEF", 0, "SA"], ["alhilal", "hamad-al-yami", "Al Yami", "DEF", 0, "SA"],
    ["alhilal", "saimon-bouabre", "S. Bouabré", "MED", 0, "FR"], ["alhilal", "yusuf-akcicek", "Y. Akçiçek", "DEF", 0, "TR"],
    ["alhilal", "mohammed-mahzari", "M. Mahzari", "DEF", 0, "SA"], ["alhilal", "murad-hawsawi", "M. Hawsawi", "MED", 0, "SA"],
    ["alhilal", "nawaf-al-habashi", "Al Habashi", "MED", 0, "SA"], ["alhilal", "mohammed-al-rubaie", "Al Rubaie", "POR", 0, "SA"],
    // Al Ittihad (24)
    ["alittihad", "danilo-pereira", "D. Pereira", "DEF", 0, "PT"], ["alittihad", "youssef-en-nesyri", "Y. En-Nesyri", "DEL", 0, "MA"],
    ["alittihad", "richard-rios", "R. Ríos", "MED", 0, "CO"], ["alittihad", "steven-bergwijn", "S. Bergwijn", "MED", 0, "NL"],
    ["alittihad", "houssem-aouar", "H. Aouar", "MED", 0, "DZ"], ["alittihad", "predrag-rajkovic", "P. Rajković", "POR", 0, "RS"],
    ["alittihad", "roger-fernandes", "R. Fernandes", "MED", 0, "PT"], ["alittihad", "dion-lopy", "D. Lopy", "MED", 0, "SN"],
    ["alittihad", "muhannad-al-shanqeeti", "Al Shanqeeti", "DEF", 0, "SA"], ["alittihad", "george-ilenikhena", "G. Ilenikhena", "DEL", 0, "NG"],
    ["alittihad", "mahamadou-doumbia", "M. Doumbia", "MED", 0, "ML"], ["alittihad", "hassan-kadish", "H. Kadish", "DEF", 0, "SA"],
    ["alittihad", "marwan-al-sahafi", "Al Sahafi", "DEL", 0, "SA"], ["alittihad", "jan-carlo-simic", "J. Simić", "DEF", 0, "RS"],
    ["alittihad", "mukhtar-ali", "M. Ali", "MED", 0, "SA"], ["alittihad", "ahmed-sharahili", "A. Sharahili", "DEF", 0, "SA"],
    ["alittihad", "saleh-al-shehri", "Al Shehri", "DEL", 0, "SA"], ["alittihad", "ahmed-al-ghamdi", "Al Ghamdi", "MED", 0, "SA"],
    ["alittihad", "bryant-ortega", "B. Ortega", "MED", 0, "VE"], ["alittihad", "fawaz-al-sagour", "Al Sagour", "DEF", 0, "SA"],
    ["alittihad", "faris-abdi", "F. Abdi", "DEF", 0, "SA"], ["alittihad", "saad-al-mousa", "Al Mousa", "DEF", 0, "SA"],
    ["alittihad", "hamed-al-ghamdi", "Al Ghamdi", "MED", 0, "SA"], ["alittihad", "stephane-keller", "S. Keller", "DEF", 0, "CM"]
  ];
  const CLUBES = {
    realmadrid: "Real Madrid", barcelona: "FC Barcelona",
    manutd: "Manchester United", mancity: "Manchester City", chelsea: "Chelsea", liverpool: "Liverpool", tottenham: "Tottenham", arsenal: "Arsenal",
    bayern: "Bayern Múnich", betis: "Real Betis", psg: "Paris Saint-Germain", como: "Como", inter: "Inter", roma: "Roma", napoli: "Napoli", dortmund: "Borussia Dortmund",
    colocolo: "Colo-Colo", ucatolica: "Universidad Católica", udechile: "Universidad de Chile",
    river: "River Plate", boca: "Boca Juniors", estudiantes: "Estudiantes de La Plata",
    intermiami: "Inter Miami", montreal: "CF Montréal", lafc: "LAFC",
    alnassr: "Al Nassr", alhilal: "Al Hilal", alittihad: "Al Ittihad"
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
      "endrick": 77, "mbappe": 91, "mbappe-mvp": 92, "rodrygo": 85, "espi": 68, "brahim": 82,
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
    },
    betis: {
      "alvaro-valles": 79, "diego-conde": 77, "hector-bellerin": 74, "diego-llorente": 80, "natan": 78,
      "marc-bartra": 79, "fran-garcia": 79, "angel-ortiz": 68, "valentin-gomez": 76, "junior-firpo": 75,
      "f-bernal": 74, "pablo-fornals": 79, "iker-losada": 72, "n-deossa": 75, "g-lo-celso": 82,
      "marc-roca": 78, "isco": 84, "dani-ceballos": 81, "antony": 81, "cucho": 78,
      "ez-abde": 77, "r-riquelme": 77, "troy-parrott": 74, "aitor-ruibal": 77, "j-morante": 68
    },
    psg: {
      "achraf-hakimi": 89, "lucas-beraldo": 78, "marquinhos": 87, "illia-zabarnyi": 79, "khvicha-kvaratskhelia": 87,
      "fabian-ruiz": 85, "ferran-torres": 83, "ousmane-dembele": 90, "maghnes-akliouche": 80, "lucas-digne": 80,
      "desire-doue": 85, "vitinha": 89, "lucas-hernandez": 81, "mika-godts": 74, "senny-mayulu": 75,
      "nuno-mendes": 86, "lucas-chevalier": 83, "warren-zaire-emery": 80, "matvey-safonov": 78, "willian-pacho": 86,
      "joao-neves": 85
    },
    como: {
      "jean-butez": 76, "mauro-vigorito": 64, "robert-sanchez": 78, "willy-kambwala": 72, "trevoh-chalobah": 79,
      "yan-couto": 77, "jacobo-ramon": 64, "alex-valle": 72, "ivan-smolcic": 72, "marc-oliver-kempf": 73,
      "edoardo-goldaniga": 72, "alberto-dossena": 73, "samuele-ricci": 78, "mattia-liberali": 65, "luis-milla": 79,
      "martin-baturina": 78, "lucas-da-cunha": 74, "nicolas-paz": 79, "maxence-caqueret": 77, "maximo-perrone": 73,
      "adrian-lahdo": 57, "moise-kean": 83, "jayden-addai": 67, "jesus-rodriguez": 74, "assane-diao": 76,
      "anastasios-douvikas": 73
    },
    inter: {
      "josep-martinez": 75, "raffaele-di-gennaro": 68, "ivan-provedel": 82, "john-stones": 82, "manuel-akanji": 82,
      "benjamin-pavard": 84, "carlos-augusto": 81, "yann-bisseck": 76, "federico-dimarco": 85, "alessandro-bastoni": 87,
      "djed-spence": 78, "aleksandar-stankovic": 66, "piotr-zielinski": 80, "petar-sucic": 74, "luis-henrique": 78,
      "andy-diouf": 75, "hakan-calhanoglu": 86, "curtis-jones": 80, "henrikh-mkhitaryan": 83, "nicolo-barella": 87,
      "marcus-thuram": 85, "lautaro-martinez": 88, "ange-yoan-bonny": 76, "pio-esposito": 71
    },
    roma: {
      "santiago-castro": 76, "donyell-malen": 79, "matias-soule": 78, "paulo-dybala": 86, "bryan-cristante": 80,
      "lorenzo-pellegrini": 80, "marten-de-roon": 81, "manu-kone": 79, "niccolo-pisilli": 72, "rodrigo-mora": 76,
      "devyne-rensch": 74, "konstantinos-koulierakis": 77, "evan-ndicka": 81, "nahuel-molina": 79, "mario-hermoso": 80,
      "gianluca-mancini": 83, "leonardo-balerdi": 81, "wesley": 77, "daniele-ghilardi": 72, "pierluigi-gollini": 74,
      "mile-svilar": 82
    },
    napoli: {
      "alex-meret": 82, "nikita-contini": 67, "vanja-milinkovic-savic": 79, "benoit-badiashile": 76, "amir-rrahmani": 83,
      "rafa-marin": 70, "mathias-olivera": 78, "giovanni-di-lorenzo": 83, "sam-beukema": 78, "leonardo-spinazzola": 78,
      "costantino-favasuli": 65, "billy-gilmour": 74, "scott-mctominay": 85, "kevin-de-bruyne": 87, "stanislav-lobotka": 83,
      "frank-anguissa": 82, "david-neres": 81, "rasmus-hjlund": 76, "lorenzo-lucca": 76, "matteo-politano": 81,
      "antonio-vergara": 65, "alisson-santos": 66, "noa-lang": 80
    },
    dortmund: {
      "gregor-kobel": 86, "patrick-drewes": 71, "alexander-meyer": 75, "waldemar-anton": 82, "nico-schlotterbeck": 85,
      "ramy-bensebaini": 79, "joane-gadou": 66, "daniel-svensson": 77, "julian-ryerson": 79, "filippo-mane": 62,
      "jobe-bellingham": 74, "felix-nmecha": 82, "carney-chukwuemeka": 76, "ethan-nwaneri": 76, "konstantinos-karetsas": 70,
      "marcel-sabitzer": 80, "emre-can": 82, "joey-veerman": 79, "justin-lerma": 64, "giannis-konstantelias": 77,
      "serhou-guirassy": 87, "maximilian-beier": 79, "fabio-silva": 79
    },
    bayern: {
      "harry-kane-balon": 94,
      "manuel-neuer": 84, "sven-ulreich": 73, "jonas-urbig": 74, "dayot-upamecano": 85, "minjae-kim": 82,
      "jonathan-tah": 87, "alphonso-davies": 84, "hiroki-ito": 78, "sacha-boey": 77, "josip-stanisic": 78,
      "joshua-kimmich": 89, "tom-bischof": 76, "jamal-musiala": 88, "konrad-laimer": 82, "lennart-karl": 63,
      "aleksandar-pavlovic": 79, "serge-gnabry": 82, "harry-kane": 89, "luis-diaz": 85, "michael-olise": 86
    },
    colocolo: {
      "claudio-aquino": 77, "fernando-de-paul": 71, "arturo-vidal": 73, "marcos-bolados": 67, "jonathan-villagra": 67, "felipe-mendez": 71,
      "erick-wiemberg": 68, "javier-correa": 71, "eduardo-villanueva": 60, "tomas-alarcon": 69, "leandro-hernandez": 63, "matias-fernandez": 68,
      "javier-mendez": 72, "lautaro-pastran": 66, "joaquin-sosa": 66, "ivan-roman": 60, "maximiliano-romero": 71, "alvaro-madrid": 72,
      "jeyson-rojas": 64
    },
    ucatolica: {
      "clemente-montes": 70, "cristian-cuevas": 69, "justo-giani": 72, "juan-ignacio-diaz": 68, "vicente-bernedo": 68, "fernando-zampedri": 74,
      "daniel-gonzalez": 70, "agustin-garcia-basso": 73, "fernando-zuqui": 67, "alfred-canales": 67, "jhojan-valencia": 68, "jimmy-martinez": 68,
      "matias-palavecino": 70, "diego-valencia": 66, "diego-corral": 63, "eugenio-mena": 68, "gary-medel": 68, "sebastian-arancibia": 65,
      "bernardo-cerezo": 65, "branco-ampuero": 72, "juan-francisco-rossel": 63, "agustin-farias": 63, "tomas-asta-buruaga": 66, "dario-melo": 62,
      "martin-gomez": 60, "francisco-valdes": 56, "matias-ignacio-perez": 66
    },
    udechile: {
      "gabriel-castellon": 72, "javier-altamirano": 71, "charles-aranguiz": 74, "cristopher-toselli": 70, "fabian-hormazabal": 69, "israel-poblete": 68,
      "octavio-rivero": 72, "nicolas-fernandez": 66, "matias-zaldivia": 71, "nicolas-ramirez": 68, "marcelo-diaz": 71, "marcelo-morales": 66,
      "tobias-reinhart": 65, "bianneider-tamayo": 59, "juan-martin-lucero": 75
    },
    river: {
      "mauro-arambarri": 80, "angel-correa": 78, "anibal-moreno": 78, "thiago-almada": 78, "nicolas-otamendi": 78, "gonzalo-montiel": 77,
      "sebastian-driussi": 76, "tomas-galvan": 76, "marcos-acuna": 76, "lucas-martinez-quarta": 76, "rafael-santos-borre": 75, "lautaro-rivero": 75,
      "lucas-beltran": 75, "fausto-vera": 74, "fabricio-bustos": 74, "kendry-paez": 74, "juan-portillo": 73, "santiago-beltran": 73,
      "francisco-ortega": 72, "giovanni-gonzalez": 72, "ezequiel-centurion": 71, "lucas-silva": 71, "tobias-andrada": 69, "tobias-ramirez": 68
    },
    boca: {
      "leandro-paredes": 81, "sebastian-villa": 77, "santiago-ascacibar": 77, "alvaro-montero": 76, "lautaro-di-lollo": 76, "lautaro-blanco": 76,
      "leandro-lozano": 76, "miguel-angel-merentiel": 76, "agustin-marchesin": 75, "adam-bareiro": 75, "malcom-braida": 74, "carlos-palacios": 74,
      "ayrton-costa": 74, "rodrigo-battaglia": 74, "enner-valencia": 73, "milton-delgado": 73, "alan-velasco": 72, "kevin-zenon": 72,
      "tomas-belmonte": 72, "nicolas-figal": 72, "angel-romero": 71, "marco-pellegrino": 71, "milton-gimenez": 71, "leandro-brey": 70
    },
    estudiantes: {
      "fernando-muslera": 78, "tiago-palacios": 76, "guido-carrillo": 76, "gabriel-neves": 75, "leandro-gonzalez-pirez": 75, "edwuin-cetre": 74,
      "ezequiel-piovi": 74, "eros-mancuso": 74, "santiago-nunez": 74, "gaston-benedetti": 74, "alexis-castro": 73, "brian-aguirre": 73,
      "jose-sosa": 73, "joaquin-tobio-burgos": 73, "joaquin-correa": 73, "eric-meza": 72, "santiago-arzamendia": 72, "tomas-palacios": 72,
      "jalil-elias": 71, "fabricio-iacovich": 70, "fabricio-perez": 70, "baltasar-rodriguez": 70, "lucas-alario": 70, "ramiro-funes-mori": 69
    },
    intermiami: {
      "lionel-messi": 89, "rodrigo-de-paul": 83, "casemiro": 83, "luis-suarez": 78, "german-berterame": 77, "dayne-st-clair": 73,
      "reguilon": 72, "tadeo-allende": 71, "facundo-mura": 71, "telasco-segovia": 71, "yannick-bright": 71, "matias-galarza": 69,
      "micael": 69, "david-ayala": 68, "maximiliano-falcon": 68, "gonzalo-lujan": 68, "ian-fray": 66, "mateo-silvetti": 65,
      "luis-barraza": 64, "rocco-rios-novo": 63, "daniel-pinter": 59, "santiago-morales": 58, "fricio-caicedo": 58, "israel-boatwright": 55
    },
    montreal: {
      "alexis-sanchez": 75, "prince-owusu": 73, "matty-longstaff": 69, "wikelman-carmona": 68, "brayan-ceballos": 68, "brayan-vera": 68,
      "dani-pereira": 67, "victor-loturi": 67, "dante-sealy": 66, "luca-petrasso": 66, "samuel-piette": 66, "frankie-amaya": 65,
      "jalen-neal": 65, "hennadii-synchuk": 65, "efrain-morales": 64, "dawid-bugaj": 64, "daniel-rios": 64, "sebastian-breza": 61,
      "olger-escobar": 61, "brandan-craig": 61, "fabian-herbers": 61, "aleksandr-guboglo": 60, "bode-hidalgo": 60, "ivan-losenko": 55
    },
    lafc: {
      "son-heung-min": 81, "denis-bouanga": 79, "hugo-lloris": 75, "mark-delgado": 74, "armindo-sieb": 71, "leo-walta": 71,
      "ryan-hollingshead": 71, "timothy-tillman": 71, "ryan-porteous": 71, "aaron-long": 70, "sergi-palencia": 70, "eddie-segura": 70,
      "nkosi-tafari": 69, "mathieu-choiniere": 68, "yevgen-cheberko": 67, "tyler-boyd": 66, "jeremy-ebobisse": 66, "jacob-shaffelburg": 65,
      "igor-jesus": 65, "ryan-raposo": 63, "thomas-hasal": 60, "kenny-nielsen": 59, "cabral-carter": 58, "jude-terry": 57
    },
    alnassr: {
      "cristiano-ronaldo": 84, "joao-felix": 83, "kingsley-coman": 83, "inigo-martinez": 83, "sadio-mane": 82, "mohamed-simakan": 82,
      "bento": 80, "samu-costa": 78, "angelo": 76, "abdulelah-al-amri": 73, "sultan-al-ghannam": 71, "nawaf-boushal": 71,
      "nawaf-al-aqidi": 71, "ayman-yahya": 70, "abdullah-al-khaibari": 69, "abdullah-al-hamdan": 66, "ali-al-hassan": 65, "nader-al-sharari": 65,
      "saad-al-nasser": 64, "salem-al-najdi": 62, "raghid-al-najjar": 61, "sami-al-najai": 61, "haydeer-abdulkareem": 61, "abdulmalik-al-jaber": 59
    },
    alhilal: {
      "ruben-neves": 85, "sergej-milinkovic-savic": 84, "ollie-watkins": 83, "theo-hernandez": 82, "yassine-bounou": 82, "kalidou-koulibaly": 82,
      "salem-al-dawsari": 80, "gabriel-martinelli": 80, "crysencio-summerville": 78, "hassan-tombakti": 74, "mohammed-kanno": 74, "mohamed-kader-meite": 72,
      "sultan-mandash": 70, "ali-lajami": 69, "nasser-al-dawsari": 69, "mohammed-al-owais": 69, "muteb-al-harbi": 68, "hamad-al-yami": 66,
      "saimon-bouabre": 66, "yusuf-akcicek": 66, "mohammed-mahzari": 65, "murad-hawsawi": 63, "nawaf-al-habashi": 62, "mohammed-al-rubaie": 62
    },
    alittihad: {
      "danilo-pereira": 82, "youssef-en-nesyri": 80, "richard-rios": 78, "steven-bergwijn": 78, "houssem-aouar": 78, "predrag-rajkovic": 77,
      "roger-fernandes": 75, "dion-lopy": 73, "muhannad-al-shanqeeti": 72, "george-ilenikhena": 72, "mahamadou-doumbia": 71, "hassan-kadish": 70,
      "marwan-al-sahafi": 69, "jan-carlo-simic": 69, "mukhtar-ali": 68, "ahmed-sharahili": 68, "saleh-al-shehri": 68, "ahmed-al-ghamdi": 66,
      "bryant-ortega": 66, "fawaz-al-sagour": 64, "faris-abdi": 64, "saad-al-mousa": 64, "hamed-al-ghamdi": 61, "stephane-keller": 61
    }
  };
  const mediaDe = (club, id) => MEDIAS[club][id];

  /* ---------- las posiciones de cada futbolista ----------
     Cada uno juega de una o dos posiciones (`"DC/EI"`: la primera es la
     principal). Salen de las de EA SPORTS FC (principal y primera
     alternativa de otro puesto), agrupadas: CDM, CM y CAM son MC; RB y RWB
     LD; LB y LWB LI; ST y CF DC. Se ajustan a mano aquí; no afectan a los
     sobres (la rareza sale de la media). La línea de la carta (`pos`: POR,
     DEF, MED, DEL) es la de su posición principal. */
  const POSICIONES = {
    realmadrid: {
      "courtois": "POR", "lunin": "POR", "asencio": "DFC/LD", "militao": "DFC",
      "huijsen": "DFC", "trent": "LD", "konate": "DFC", "cucurella": "LI",
      "carreras": "LI", "rudiger": "DFC", "mendy": "LI", "dumfries": "LD",
      "bellingham": "MC", "camavinga": "MC/LI", "valverde": "MC/LD", "tchouameni": "MC/DFC",
      "arda-guler": "MD/MC", "bernardo": "MC/MD", "vini-jr": "EI/DC", "endrick": "DC/ED",
      "mbappe": "DC/EI", "mbappe-mvp": "DC/EI", "rodrygo": "ED/DC", "espi": "DC", "brahim": "ED/EI",
      "yan-diomande": "EI/ED"
    },
    barcelona: {
      "joan-garcia": "POR", "szczesny": "POR", "livakovic": "POR", "cancelo": "LD/LI",
      "balde": "LI", "cubarsi": "DFC", "christensen": "DFC/MC", "gerard-martin": "LI/DFC",
      "kounde": "LD/DFC", "eric-garcia": "DFC/LD", "gavi": "MC", "fermin": "MC/EI",
      "pedri": "MC", "rodri": "MC", "dani-olmo": "MC/DC", "de-jong": "MC",
      "marc-bernal": "MC", "gabriel-jesus": "DC/MC", "lamine-yamal": "ED", "raphinha": "EI",
      "adeyemi": "ED/EI", "gordon": "EI/ED", "bardghji": "ED"
    },
    manutd: {
      "senne-lammens": "POR", "karl-darlow": "POR", "tom-heaton": "POR", "andre-onana": "POR",
      "diogo-dalot": "LD/LI", "noussair-mazraoui": "LD/DFC", "matthijs-de-ligt": "DFC", "harry-maguire": "DFC",
      "lisandro-martinez": "DFC", "patrick-chinazaekpere-dorgu": "LI", "leny-yoro": "DFC", "luke-shaw": "DFC/LI",
      "ayden-heaven": "DFC/LI", "harry-amass": "LI", "mason-mount": "MC/ED", "bruno-fernandes": "MC",
      "andrey-santos": "MC", "youri-tielemans": "MC", "carlos-baleba": "MC", "manuel-ugarte": "MC",
      "kobbie-mainoo": "MC", "marcus-rashford": "EI/DC", "matheus-cunha": "EI/MC", "joshua-zirkzee": "DC/MC",
      "amad": "ED/MC", "bryan-mbeumo": "ED/DC", "benjamin-sesko": "DC"
    },
    mancity: {
      "gianluigi-donnarumma": "POR", "marcus-bettinelli": "POR", "geronimo-rulli": "POR", "ruben-dias": "DFC",
      "marc-guehi": "DFC", "rayan-ait-nouri": "LI", "vitor-reis": "DFC", "josko-gvardiol": "LI/DFC",
      "matheus-nunes": "LD/MC", "abdukodir-khusanov": "DFC", "rico-lewis": "LD/LI", "elliot-anderson": "MC",
      "mateo-kovacic": "MC", "rayan-cherki": "ED/MD", "enzo-fernandez": "MC", "ayyoub-bouaddi": "MC",
      "nico-o-reilly": "LI/MC", "phil-foden": "ED/MC", "iliman-ndiaye": "EI", "erling-haaland": "DC",
      "jeremy-doku": "EI/ED", "allan": "DC", "antoine-semenyo": "ED/EI"
    },
    chelsea: {
      "emiliano-martinez": "POR", "teddy-sharman-lowe": "POR", "mike-penders": "POR", "gaga-slonina": "POR",
      "marco-palestra": "LD/ED", "wesley-fofana": "DFC", "maxence-lacroix": "DFC", "levi-colwill": "DFC",
      "jorrel-hato": "LI/DFC", "reece-james": "LD", "malo-gusto": "LD", "pep-chavarria": "LI",
      "aaron-anselmino": "DFC", "josh-acheampong": "LD/DFC", "valentin-barco": "LI/MI", "jordan-henderson": "MC",
      "moises-caicedo": "MC", "romeo-lavia": "MC", "pedro-neto": "ED/EI", "joao-pedro": "DC/MC",
      "jamie-gittens": "EI", "morgan-rogers": "ED/MC", "danny-welbeck": "DC", "emmanuel-emegha": "DC",
      "geovany-quenda": "ED/EI", "estevao-willian": "ED/MC"
    },
    liverpool: {
      "alisson-becker": "POR", "giorgi-mamardashvili": "POR", "freddie-woodman": "POR", "vitezslav-jaros": "POR",
      "harvey-davies": "POR", "joe-gomez": "DFC/LD", "virgil-van-dijk": "DFC", "jeremy-jacquet": "DFC",
      "milos-kerkez": "LI", "conor-bradley": "LD", "giovanni-leoni": "DFC", "kostas-tsimikas": "LI",
      "jeremie-frimpong": "LD/ED", "ronald-araujo": "DFC/LD", "wataru-endo": "MC", "florian-wirtz": "MC/DC",
      "dominik-szoboszlai": "MC", "alexis-mac-allister": "MC", "ryan-gravenberch": "MC", "trey-nyoni": "MC",
      "alexander-isak": "DC", "federico-chiesa": "ED/EI", "cody-gakpo": "EI", "hugo-ekitike": "DC/MC",
      "victor-munoz": "EI", "bradley-barcola": "EI/ED", "lewis-koumas": "ED/EI", "rio-ngumoha": "EI"
    },
    tottenham: {
      "antonin-kinsky": "POR", "martin-dubravka": "POR", "brandon-austin": "POR", "andy-robertson": "LI",
      "tosin-adarabioyo": "DFC", "marcos-senesi": "DFC", "jan-paul-van-hecke": "DFC", "destiny-udogie": "LI",
      "pedro-porro": "LD", "ben-davies": "DFC", "micky-van-de-ven": "DFC", "xavi-simons": "MC/MI",
      "conor-gallagher": "MC/MI", "james-maddison": "MC", "archie-gray": "MC/DFC", "lucas-bergvall": "MC",
      "sandro-tonali": "MC", "mateus-fernandes": "MC", "wilson-odobert": "EI/ED", "rodrigo-bentancur": "MC",
      "richarlison": "DC/EI", "mathys-tel": "DC/EI", "savio": "ED/EI", "dominic-solanke": "DC",
      "mohammed-kudus": "ED/EI", "dejan-kulusevski": "ED/MC", "omar-marmoush": "DC/MC", "mykhailo-mudryk": "EI/ED"
    },
    arsenal: {
      "david-raya": "POR", "kepa-arrizabalaga": "POR", "illan-meslier": "POR", "william-saliba": "DFC",
      "cristhian-mosquera": "DFC", "ben-white": "LD", "piero-hincapie": "DFC/LI", "gabriel-magalhaes": "DFC",
      "jurrien-timber": "LD/LI", "ezri-konsa": "DFC/LD", "riccardo-calafiori": "LI/DFC", "myles-lewis-skelly": "LI/MC",
      "martin-odegaard": "MC", "eberechi-eze": "MC/EI", "mikel-merino": "MC/DC", "martin-zubimendi": "MC",
      "bruno-guimaraes": "MC", "declan-rice": "MC", "bukayo-saka": "ED", "viktor-gyokeres": "DC",
      "christos-tzolis": "EI", "noni-madueke": "ED", "kai-havertz": "DC/MC"
    },
    betis: {
      "alvaro-valles": "POR", "diego-conde": "POR", "hector-bellerin": "LD", "diego-llorente": "DFC",
      "natan": "DFC", "marc-bartra": "DFC", "fran-garcia": "LI", "angel-ortiz": "LD",
      "valentin-gomez": "DFC/LI", "junior-firpo": "LI", "f-bernal": "DFC/MC", "pablo-fornals": "MC/MD",
      "iker-losada": "MC/MD", "n-deossa": "MC", "g-lo-celso": "MC", "marc-roca": "MC",
      "isco": "MC/MI", "dani-ceballos": "MC", "antony": "ED", "cucho": "DC/MC",
      "ez-abde": "EI", "r-riquelme": "EI/ED", "troy-parrott": "DC", "aitor-ruibal": "LD/ED",
      "j-morante": "MC"
    },
    psg: {
      "achraf-hakimi": "LD", "lucas-beraldo": "DFC/LI", "marquinhos": "DFC", "illia-zabarnyi": "DFC",
      "khvicha-kvaratskhelia": "EI/ED", "fabian-ruiz": "MC", "ferran-torres": "EI/ED", "ousmane-dembele": "DC/ED",
      "maghnes-akliouche": "MD/MC", "lucas-digne": "LI", "desire-doue": "ED/EI", "vitinha": "MC",
      "lucas-hernandez": "DFC/LI", "mika-godts": "EI", "senny-mayulu": "MC", "nuno-mendes": "LI",
      "lucas-chevalier": "POR", "warren-zaire-emery": "MC", "matvey-safonov": "POR", "willian-pacho": "DFC",
      "joao-neves": "MC"
    },
    como: {
      "jean-butez": "POR", "mauro-vigorito": "POR", "robert-sanchez": "POR", "willy-kambwala": "DFC",
      "trevoh-chalobah": "DFC/LD", "yan-couto": "LD", "jacobo-ramon": "DFC", "alex-valle": "LI",
      "ivan-smolcic": "LD", "marc-oliver-kempf": "DFC", "edoardo-goldaniga": "DFC", "alberto-dossena": "DFC",
      "samuele-ricci": "MC", "mattia-liberali": "ED/MD", "luis-milla": "MC", "martin-baturina": "MC",
      "lucas-da-cunha": "MC", "nicolas-paz": "MC", "maxence-caqueret": "MC", "maximo-perrone": "MC",
      "adrian-lahdo": "MC", "moise-kean": "DC", "jayden-addai": "ED", "jesus-rodriguez": "EI/ED",
      "assane-diao": "EI/ED", "anastasios-douvikas": "DC"
    },
    inter: {
      "josep-martinez": "POR", "raffaele-di-gennaro": "POR", "ivan-provedel": "POR", "john-stones": "DFC/LD",
      "manuel-akanji": "DFC", "benjamin-pavard": "DFC", "carlos-augusto": "LI/DFC", "yann-bisseck": "DFC",
      "federico-dimarco": "LI", "alessandro-bastoni": "DFC", "djed-spence": "LD/LI", "aleksandar-stankovic": "MC/DFC",
      "piotr-zielinski": "MC", "petar-sucic": "MC", "luis-henrique": "MD/MI", "andy-diouf": "MC",
      "hakan-calhanoglu": "MC", "curtis-jones": "MC", "henrikh-mkhitaryan": "MC", "nicolo-barella": "MC",
      "marcus-thuram": "DC", "lautaro-martinez": "DC", "ange-yoan-bonny": "DC/MC", "pio-esposito": "DC"
    },
    roma: {
      "santiago-castro": "DC", "donyell-malen": "ED/EI", "matias-soule": "ED/MC", "paulo-dybala": "DC/MC",
      "bryan-cristante": "MC", "lorenzo-pellegrini": "MC", "marten-de-roon": "MC", "manu-kone": "MC",
      "niccolo-pisilli": "MC", "rodrigo-mora": "MC/EI", "devyne-rensch": "LD/DFC", "konstantinos-koulierakis": "DFC",
      "evan-ndicka": "DFC", "nahuel-molina": "LD", "mario-hermoso": "DFC", "gianluca-mancini": "DFC",
      "leonardo-balerdi": "DFC", "wesley": "LD", "daniele-ghilardi": "DFC", "pierluigi-gollini": "POR",
      "mile-svilar": "POR"
    },
    napoli: {
      "alex-meret": "POR", "nikita-contini": "POR", "vanja-milinkovic-savic": "POR", "benoit-badiashile": "DFC",
      "amir-rrahmani": "DFC", "rafa-marin": "DFC", "mathias-olivera": "LI", "giovanni-di-lorenzo": "LD/DFC",
      "sam-beukema": "DFC", "leonardo-spinazzola": "LI", "costantino-favasuli": "MD/LD", "billy-gilmour": "MC",
      "scott-mctominay": "MC", "kevin-de-bruyne": "MC", "stanislav-lobotka": "MC", "frank-anguissa": "MC",
      "david-neres": "EI", "rasmus-hjlund": "DC", "lorenzo-lucca": "DC", "matteo-politano": "ED",
      "antonio-vergara": "ED/MC", "alisson-santos": "EI/ED", "noa-lang": "EI"
    },
    dortmund: {
      "gregor-kobel": "POR", "patrick-drewes": "POR", "alexander-meyer": "POR", "waldemar-anton": "DFC",
      "nico-schlotterbeck": "DFC", "ramy-bensebaini": "LI/DFC", "joane-gadou": "DFC", "daniel-svensson": "LI/MC",
      "julian-ryerson": "LD/LI", "filippo-mane": "DFC/LD", "jobe-bellingham": "MC", "felix-nmecha": "MC",
      "carney-chukwuemeka": "MC", "ethan-nwaneri": "ED/MC", "konstantinos-karetsas": "MC/ED", "marcel-sabitzer": "MC",
      "emre-can": "DFC/MC", "joey-veerman": "MC", "justin-lerma": "MI/MC", "giannis-konstantelias": "MC/ED",
      "serhou-guirassy": "DC", "maximilian-beier": "DC/ED", "fabio-silva": "DC/EI"
    },
    bayern: {
      "harry-kane-balon": "DC",
      "manuel-neuer": "POR", "sven-ulreich": "POR", "jonas-urbig": "POR", "dayot-upamecano": "DFC", "minjae-kim": "DFC",
      "jonathan-tah": "DFC", "alphonso-davies": "LI/MI", "hiroki-ito": "DFC/LI", "sacha-boey": "LD", "josip-stanisic": "DFC/LD",
      "joshua-kimmich": "MC/LD", "tom-bischof": "MC/MD", "jamal-musiala": "MC/MI", "konrad-laimer": "MC/LD", "lennart-karl": "MC/MD",
      "aleksandar-pavlovic": "MC", "serge-gnabry": "EI/ED", "harry-kane": "DC", "luis-diaz": "EI/DC", "michael-olise": "ED"
    },
    colocolo: {
      "claudio-aquino": "MC", "fernando-de-paul": "POR", "arturo-vidal": "MC", "marcos-bolados": "ED/MD", "jonathan-villagra": "DFC",
      "felipe-mendez": "MC/MD", "erick-wiemberg": "LI/DFC", "javier-correa": "DC", "eduardo-villanueva": "POR", "tomas-alarcon": "MC",
      "leandro-hernandez": "EI/MI", "matias-fernandez": "LD/MD", "javier-mendez": "DFC/MC", "lautaro-pastran": "EI/MI", "joaquin-sosa": "DFC/LI",
      "ivan-roman": "DFC", "maximiliano-romero": "DC/EI", "alvaro-madrid": "MC", "jeyson-rojas": "LD/DFC"
    },
    ucatolica: {
      "clemente-montes": "MI/MD", "cristian-cuevas": "MI/LI", "justo-giani": "MC/MD", "juan-ignacio-diaz": "DFC/LI", "vicente-bernedo": "POR",
      "fernando-zampedri": "DC", "daniel-gonzalez": "DFC/LD", "agustin-garcia-basso": "DFC/LI", "fernando-zuqui": "MC", "alfred-canales": "MC",
      "jhojan-valencia": "MC", "jimmy-martinez": "MC", "matias-palavecino": "MC/MI", "diego-valencia": "DC/MD", "diego-corral": "MI/MD",
      "eugenio-mena": "LI/MI", "gary-medel": "MC/DFC", "sebastian-arancibia": "LD", "bernardo-cerezo": "LD/LI", "branco-ampuero": "DFC/LD",
      "juan-francisco-rossel": "MC/MI", "agustin-farias": "MC", "tomas-asta-buruaga": "DFC/LD", "dario-melo": "POR", "martin-gomez": "MC",
      "francisco-valdes": "POR", "matias-ignacio-perez": "DFC"
    },
    udechile: {
      "gabriel-castellon": "POR", "javier-altamirano": "MC", "charles-aranguiz": "MC", "cristopher-toselli": "POR", "fabian-hormazabal": "LD/MD",
      "israel-poblete": "MC", "octavio-rivero": "DC", "nicolas-fernandez": "LD/MD", "matias-zaldivia": "DFC", "nicolas-ramirez": "DFC",
      "marcelo-diaz": "MC", "marcelo-morales": "LI/MI", "tobias-reinhart": "MC", "bianneider-tamayo": "DFC", "juan-martin-lucero": "DC"
    },
    river: {
      "mauro-arambarri": "MC", "angel-correa": "MC/MI", "anibal-moreno": "MC", "thiago-almada": "MC/MD", "nicolas-otamendi": "DFC",
      "gonzalo-montiel": "LD/MD", "sebastian-driussi": "DC/MC", "tomas-galvan": "MC/MI", "marcos-acuna": "LI/MI", "lucas-martinez-quarta": "DFC",
      "rafael-santos-borre": "DC/MC", "lautaro-rivero": "DFC/LI", "lucas-beltran": "DC/MI", "fausto-vera": "MC/DFC", "fabricio-bustos": "LD/MD",
      "kendry-paez": "MC/MD", "juan-portillo": "DFC/MC", "santiago-beltran": "POR", "francisco-ortega": "LI", "giovanni-gonzalez": "LD/DFC",
      "ezequiel-centurion": "POR", "lucas-silva": "MC", "tobias-andrada": "MC/MD", "tobias-ramirez": "DFC"
    },
    boca: {
      "leandro-paredes": "MC", "sebastian-villa": "DC/MI", "santiago-ascacibar": "MC/MD", "alvaro-montero": "POR", "lautaro-di-lollo": "DFC",
      "lautaro-blanco": "LI/MI", "leandro-lozano": "LD/MD", "miguel-angel-merentiel": "DC", "agustin-marchesin": "POR", "adam-bareiro": "DC",
      "malcom-braida": "MI/LI", "carlos-palacios": "MC/MI", "ayrton-costa": "DFC", "rodrigo-battaglia": "MC/DFC", "enner-valencia": "DC/MI",
      "milton-delgado": "MC", "alan-velasco": "MI/MD", "kevin-zenon": "MI/MC", "tomas-belmonte": "MC", "nicolas-figal": "DFC",
      "angel-romero": "ED/MD", "marco-pellegrino": "DFC", "milton-gimenez": "DC", "leandro-brey": "POR"
    },
    estudiantes: {
      "fernando-muslera": "POR", "tiago-palacios": "MD/MC", "guido-carrillo": "DC", "gabriel-neves": "MC", "leandro-gonzalez-pirez": "DFC",
      "edwuin-cetre": "MI/ED", "ezequiel-piovi": "MC", "eros-mancuso": "LD/LI", "santiago-nunez": "DFC", "gaston-benedetti": "LI/MI",
      "alexis-castro": "MC/MI", "brian-aguirre": "EI/MD", "jose-sosa": "MC/DC", "joaquin-tobio-burgos": "MI/MC", "joaquin-correa": "DC/MC",
      "eric-meza": "LD/MD", "santiago-arzamendia": "LI/MI", "tomas-palacios": "DFC", "jalil-elias": "MC/MD", "fabricio-iacovich": "POR",
      "fabricio-perez": "MI/MD", "baltasar-rodriguez": "MC/MI", "lucas-alario": "DC", "ramiro-funes-mori": "DFC"
    },
    intermiami: {
      "lionel-messi": "MC/MD", "rodrigo-de-paul": "MC/MD", "casemiro": "MC", "luis-suarez": "DC/MC", "german-berterame": "DC/ED",
      "dayne-st-clair": "POR", "reguilon": "LI", "tadeo-allende": "MD/MI", "facundo-mura": "LD/LI", "telasco-segovia": "MC/MI",
      "yannick-bright": "MC", "matias-galarza": "MC/MI", "micael": "DFC", "david-ayala": "MC", "maximiliano-falcon": "DFC",
      "gonzalo-lujan": "DFC/LD", "ian-fray": "LD/DFC", "mateo-silvetti": "MD/MI", "luis-barraza": "POR", "rocco-rios-novo": "POR",
      "daniel-pinter": "EI/MD", "santiago-morales": "MC/MD", "fricio-caicedo": "DFC", "israel-boatwright": "LD"
    },
    montreal: {
      "alexis-sanchez": "DC/MC", "prince-owusu": "DC", "matty-longstaff": "MC", "wikelman-carmona": "MI/MD", "brayan-ceballos": "DFC",
      "brayan-vera": "DFC/LI", "dani-pereira": "MC", "victor-loturi": "MC", "dante-sealy": "MD/MI", "luca-petrasso": "LI/DFC",
      "samuel-piette": "MC", "frankie-amaya": "MC", "jalen-neal": "DFC", "hennadii-synchuk": "MD/MC", "efrain-morales": "DFC",
      "dawid-bugaj": "LD/MD", "daniel-rios": "DC", "sebastian-breza": "POR", "olger-escobar": "MC/ED", "brandan-craig": "DFC/MC",
      "fabian-herbers": "MC/MI", "aleksandr-guboglo": "LD/LI", "bode-hidalgo": "LD/DFC", "ivan-losenko": "MC"
    },
    lafc: {
      "son-heung-min": "DC/MI", "denis-bouanga": "EI/MI", "hugo-lloris": "POR", "mark-delgado": "MC", "armindo-sieb": "DC/MC",
      "leo-walta": "MC", "ryan-hollingshead": "LI/LD", "timothy-tillman": "MC/MI", "ryan-porteous": "DFC", "aaron-long": "DFC",
      "sergi-palencia": "LD/LI", "eddie-segura": "DFC/LD", "nkosi-tafari": "DFC", "mathieu-choiniere": "MC/MI", "yevgen-cheberko": "DFC",
      "tyler-boyd": "MD/MI", "jeremy-ebobisse": "DC/MC", "jacob-shaffelburg": "MD/LI", "igor-jesus": "MC/DFC", "ryan-raposo": "MD/LI",
      "thomas-hasal": "POR", "kenny-nielsen": "DFC", "cabral-carter": "POR", "jude-terry": "MC"
    },
    alnassr: {
      "cristiano-ronaldo": "DC", "joao-felix": "MC/MI", "kingsley-coman": "MD/MI", "inigo-martinez": "DFC/LI", "sadio-mane": "MI/MD",
      "mohamed-simakan": "DFC/LD", "bento": "POR", "samu-costa": "MC", "angelo": "MC/MD", "abdulelah-al-amri": "DFC",
      "sultan-al-ghannam": "LD/MD", "nawaf-boushal": "LI/LD", "nawaf-al-aqidi": "POR", "ayman-yahya": "LI/MD", "abdullah-al-khaibari": "MC",
      "abdullah-al-hamdan": "DC/MC", "ali-al-hassan": "MC", "nader-al-sharari": "DFC/LD", "saad-al-nasser": "LI/MC", "salem-al-najdi": "LI",
      "raghid-al-najjar": "POR", "sami-al-najai": "MC/MD", "haydeer-abdulkareem": "MC", "abdulmalik-al-jaber": "MC"
    },
    alhilal: {
      "ruben-neves": "MC/DFC", "sergej-milinkovic-savic": "MC/DC", "ollie-watkins": "DC", "theo-hernandez": "LI/MI", "yassine-bounou": "POR",
      "kalidou-koulibaly": "DFC", "salem-al-dawsari": "MI/EI", "gabriel-martinelli": "EI/MI", "crysencio-summerville": "MI/MD", "hassan-tombakti": "DFC",
      "mohammed-kanno": "MC/DFC", "mohamed-kader-meite": "DC", "sultan-mandash": "MD/MI", "ali-lajami": "DFC", "nasser-al-dawsari": "MC/LI",
      "mohammed-al-owais": "POR", "muteb-al-harbi": "LI/LD", "hamad-al-yami": "LD/MD", "saimon-bouabre": "MI/MD", "yusuf-akcicek": "DFC",
      "mohammed-mahzari": "LD/LI", "murad-hawsawi": "MC/DFC", "nawaf-al-habashi": "MI/DC", "mohammed-al-rubaie": "POR"
    },
    alittihad: {
      "danilo-pereira": "DFC", "youssef-en-nesyri": "DC", "richard-rios": "MC", "steven-bergwijn": "MC/MI", "houssem-aouar": "MC/DC",
      "predrag-rajkovic": "POR", "roger-fernandes": "MI/MD", "dion-lopy": "MC/DFC", "muhannad-al-shanqeeti": "LD/LI", "george-ilenikhena": "DC",
      "mahamadou-doumbia": "MC", "hassan-kadish": "LI/DFC", "marwan-al-sahafi": "EI/MD", "jan-carlo-simic": "DFC", "mukhtar-ali": "MC",
      "ahmed-sharahili": "DFC", "saleh-al-shehri": "DC", "ahmed-al-ghamdi": "MI/MD", "bryant-ortega": "MC", "fawaz-al-sagour": "LD/LI",
      "faris-abdi": "LI", "saad-al-mousa": "DFC", "hamed-al-ghamdi": "MC", "stephane-keller": "DFC"
    }
  };
  const POS_LINEA = { POR: "POR", LD: "DEF", LI: "DEF", DFC: "DEF", MC: "MED", MD: "MED", MI: "MED", ED: "DEL", EI: "DEL", DC: "DEL" };
  const posicionesDe = (club, id) => POSICIONES[club][id].split("/");
  const PUESTO = { POR: "portero", LI: "lateral izquierdo", DFC: "central", LD: "lateral derecho", MC: "mediocentro", MI: "medio izquierdo", MD: "medio derecho", EI: "extremo izquierdo", DC: "delantero centro", ED: "extremo derecho" };
  /* Cómo le queda una casilla a un jugador: `ok` es la suya (verde);
     `incomodo` es otra de su línea (un central de lateral) o el cruce de
     banda que no es un disparate (lateral a carrilero, extremo a banda): se
     juega, con un castigo chico (amarillo); `mal` es de otra línea, y un
     portero de campo o uno de campo bajo los palos, peor (rojo). El
     castigo es en puntos de media. */
  const PEN_AJUSTE = { ok: 0, incomodo: 3, mal: 10, porteria: 25 };
  const CRUCES = new Set(["LD-MD", "MD-LD", "MD-ED", "ED-MD", "LI-MI", "MI-LI", "MI-EI", "EI-MI"]);
  function ajuste(casilla, posiciones) {
    if (posiciones.includes(casilla)) return { nivel: "ok", pen: PEN_AJUSTE.ok };
    if (casilla === "POR" || posiciones.includes("POR")) return { nivel: "mal", pen: PEN_AJUSTE.porteria };
    const l = POS_LINEA[casilla];
    if (posiciones.some(p => POS_LINEA[p] === l || CRUCES.has(p + "-" + casilla))) return { nivel: "incomodo", pen: PEN_AJUSTE.incomodo };
    return { nivel: "mal", pen: PEN_AJUSTE.mal };
  }
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
  const PESOS_FUTBOL = {
    // el sobre de fútbol (los 203 jugadores) y el Plus: menos comunes y la quinta carta, épica o mejor
    normal: [6600, 3000, 340, 60],
    plus: [3000, 6800, 150, 50], ultimaPlus: [9300, 700],
    // los de las dos colecciones de antes (Clásico y Premier): solo para rehacer los sobres que ya se abrieron
    v1: { futbol: [5500, 3300, 1000, 200], premier: [5500, 3500, 900, 100] }
  };

  /* Las colecciones. El sobre dice de cuál es con la primera letra de su
     clave (`prefijo` + la clave de push): la regla ya acepta esas claves
     y quien compra no elige el contenido igual, porque sigue saliendo de
     la hora del servidor. `grupo: "futbol"` junta las colecciones de
     futbolistas: se eligen desde su propio menú y comparten la plantilla. */
  const COLECCIONES = [
    { key: "profes", prefijo: "p", label: "Profes", nombre: "DIE Collection", serie: "S01" },
    { key: "comp", prefijo: "c", label: "Componentes", nombre: "Componentes", serie: "S02" },
    { key: "futbol", prefijo: "g", label: "Fútbol", nombre: "Fútbol", serie: "S03", grupo: "futbol" }
  ];
  /* Lo que se compra: un sobre de cada colección y, en fútbol, el Plus (el
     doble de caro: la quinta carta es épica o mejor y salen menos comunes).
     `col` es la colección de sus cartas. Los prefijos `f` y `e` eran los
     sobres de las dos colecciones de fútbol de antes (Clásico y Premier):
     ya no se venden, pero los que se abrieron siguen saliendo igual. */
  const SOBRES = [
    { key: "profes", col: "profes", prefijo: "p", label: "Profes", mult: 1 },
    { key: "comp", col: "comp", prefijo: "c", label: "Componentes", mult: 1 },
    { key: "futbol", col: "futbol", prefijo: "g", label: "Fútbol", mult: 1, grupo: "futbol" },
    { key: "futbolplus", col: "futbol", prefijo: "h", label: "Fútbol Plus", mult: 2, grupo: "futbol" }
  ];
  const SOBRE = Object.fromEntries(SOBRES.map(x => [x.key, x]));
  const esFutbol = col => col === "futbol";
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
  const cartaFutbol = (col, carpeta, [club, id, name, , dorsal, pais, extra = {}]) => {
    const n = CARDS.length, media = mediaDe(club, id), tier = tierDeMedia(media), t = TIERS[tier];
    const posiciones = posicionesDe(club, id), pos = POS_LINEA[posiciones[0]];
    CARDS.push({
      n, uid: club + "-" + id + "-" + t.key, person: extra.person || club + "-" + id, num: n - BASE_FUT + 1, name, vkey: t.key, vlabel: t.label,
      col, liga: carpeta, peso: extra.peso || 1, tier, club, pos, posiciones, dorsal, pais, media, img: "cards/" + carpeta + "/" + club + "/" + id + ".webp",
      sub: extra.sub || CLUBES[club], acc: t.color,
      ...(extra.especial ? { especial: extra.especial, cinta: extra.cinta, limitada: !!extra.limitada } : {})
    });
  };
  FUTBOLISTAS.forEach(j => cartaFutbol("futbol", "futbol", j));
  const BASE_PREM = CARDS.length;
  PREMIER.forEach(j => cartaFutbol("futbol", "premier", j));
  const BASE_CHAMP = CARDS.length;   // = 648: las de antes no se mueven
  CHAMPIONS.forEach(j => cartaFutbol("futbol", "champions", j));
  ESPECIALES.forEach(j => cartaFutbol("futbol", "especiales", j));
  BAYERN.forEach(j => cartaFutbol("futbol", "champions", j));
  CHILE.forEach(j => cartaFutbol("futbol", "champions", j));
  ARGENTINA.forEach(j => cartaFutbol("futbol", "champions", j));
  MLS.forEach(j => cartaFutbol("futbol", "champions", j));
  ARABIA.forEach(j => cartaFutbol("futbol", "champions", j));
  const TOTAL = CARDS.length;
  const POR_COL = Object.fromEntries(COLECCIONES.map(c => [c.key, CARDS.filter(x => x.col === c.key)]));
  const pool = (lista, w = TIERS.map(x => x.w), ultima = null) => {
    const t = TIERS.map((_, i) => lista.filter(c => c.tier === i));
    t.uniforme = lista.every(c => c.peso === 1);
    t.peso = t.map(l => l.reduce((s, c) => s + c.peso, 0));
    // la rareza más alta que tiene: lo que sería de una rareza que la colección no tiene sale de la más alta
    t.tope = t.reduce((m, l, i) => (l.length ? i : m), 0);
    t.w = w;
    t.ultima = ultima;   // sobre Plus: pesos de la quinta carta (épica, legendaria)
    let esp = null;   // se calcula al pedirlo: `DIOS` se declara más abajo
    Object.defineProperty(t, 'esperado', { get: () => esp || (esp = esperadoPorSobre(w, ultima)) });
    return t;
  };
  const POOL = {
    legado: pool(CARDS.slice(0, LEGADO)), profes: pool(POR_COL.profes), comp: pool(POR_COL.comp),
    futbol: pool(POR_COL.futbol, PESOS_FUTBOL.normal), futbolplus: pool(POR_COL.futbol, PESOS_FUTBOL.plus, PESOS_FUTBOL.ultimaPlus),
    // los de antes: las mismas listas y pesos de cuando se abrieron esos sobres
    futbol1: pool(CARDS.slice(BASE_FUT, BASE_PREM), PESOS_FUTBOL.v1.futbol), premier1: pool(CARDS.slice(BASE_PREM, BASE_CHAMP), PESOS_FUTBOL.v1.premier)
  };
  const POR_TIER = POOL.profes;
  /* De qué colección es un sobre o un re-roll, por su clave. Las claves
     de push empiezan con «-», así que lo de antes nunca lleva prefijo. */
  const coleccionDe = clave => { const p = String(clave)[0]; return p === "c" ? "comp" : (p === "f" || p === "e" || p === "g" || p === "h") ? "futbol" : "profes"; };
  /* Ampliaciones del catálogo de fútbol. Un sobre `g` o `h` sale del
     catálogo entero, así que agregar jugadores cambiaría los sobres que ya
     se abrieron. Para que no pase, cada ampliación anota cuántas cartas
     había (`n`: las de id menor) y hasta cuándo (`hasta`, hora del servidor
     del sobre): un sobre comprado antes sigue viendo solo esas. Las
     ampliaciones van de la más vieja a la más nueva, y una carta nueva
     siempre se agrega al final del catálogo. Con la lista vacía, todos los
     sobres ven todo. */
  // Siete clubes de la Champions y las dos cartas especiales (publicado el 2026-10-27): el corte es unos minutos después del push, para que ningún sobre ya comprado cambie.
  // El Bayern Múnich (20 jugadores, publicado el 2026-10-28): el corte es media hora después del push, para que ningún sobre ya comprado cambie.
  // Chile, Argentina, la MLS y Arabia (277 jugadores, publicado el 2026-10-28): el corte (28-10-2026 21:16 UTC) es media hora después del push, para que ningún sobre ya comprado cambie.
  const AMPLIACIONES = [{ hasta: 1793072603996, n: 648 }, { hasta: 1793202400000, n: 813 }, { hasta: 1793222209477, n: 833 }];
  const memoPool = {};
  function poolFutbol(plus, at) {
    const v = AMPLIACIONES.find(x => at < x.hasta);
    if (!v) return plus ? POOL.futbolplus : POOL.futbol;
    const k = (plus ? "h" : "g") + v.n;
    return memoPool[k] || (memoPool[k] = pool(POR_COL.futbol.filter(c => c.n < v.n), plus ? PESOS_FUTBOL.plus : PESOS_FUTBOL.normal, plus ? PESOS_FUTBOL.ultimaPlus : null));
  }
  // `at`: la hora del sobre o del re-roll (sin ella, el catálogo de hoy)
  const poolDe = (clave, at = Infinity) => {
    const p = String(clave)[0];
    return p === "c" ? POOL.comp : p === "f" ? POOL.futbol1 : p === "e" ? POOL.premier1 : p === "g" ? poolFutbol(false, at) : p === "h" ? poolFutbol(true, at) : p === "p" ? POOL.profes : POOL.legado;
  };
  // qué sobre de la tienda es (para pintarlo al retomar uno): los de antes de fútbol cuentan como el sobre de fútbol
  const sobreDe = clave => { const p = String(clave)[0]; return p === "c" ? "comp" : p === "h" ? "futbolplus" : (p === "f" || p === "e" || p === "g") ? "futbol" : "profes"; };
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
  const precioSobre = (ms, mult = 1) => (ms < PRECIO.promoHasta ? PRECIO.promo : PRECIO.normal) * mult;   // el Plus cuesta `mult` veces

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
    const dios = r.entero(10000) < DIOS, P = poolDe(clave, at);
    const usadas = new Set(), cartas = [];
    let leyenda = false;
    for (let i = 0; i < 5; i++) {
      let t;
      if (dios) t = leyenda ? 2 : 2 + pesado(r, [P.w[2], P.w[3]]);
      else t = i === 4 ? (P.ultima ? 2 + pesado(r, P.ultima) : 1 + pesado(r, P.w.slice(1))) : pesado(r, P.w);
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
  function esperadoPorSobre(w, ultima) {
    const T = w || TIERS.map(t => t.w), tot = 10000, alta = T[1] + T[2] + T[3];
    // la quinta: rara o mejor, o (Plus) épica o mejor con sus propios pesos
    const quinta = ultima ? [0, 0, ultima[0] / (ultima[0] + ultima[1]), ultima[1] / (ultima[0] + ultima[1])] : T.map((w, t) => (t ? w / alta : 0));
    const normal = T.map((w, t) => 4 * w / tot + quinta[t]);
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
    const P = poolDe(clave, at), posibles = P[Math.min(P.tope, tier + saltoReroll(k, at, tier))];
    const c = elige(r, posibles, P.uniforme);
    const res = { id: c.n, g: 1 + pesado(r, pesosReroll(notas)), w: (r.u32() & 0x7fffffff) | 1 };
    memoR.set(k, res);
    return res;
  }

  /* ---------- la formación de los desafíos de plantilla ----------
     Un once en 4-3-3, fijo: once casillas en este orden (portero, cuatro
     defensas, tres medios, tres delanteros). El puntaje está en retos.js. */
  const FORMACION = [
    { pos: "POR", fila: 0 },
    { pos: "LI", fila: 1 }, { pos: "DFC", fila: 1 }, { pos: "DFC", fila: 1 }, { pos: "LD", fila: 1 },
    { pos: "MC", fila: 2 }, { pos: "MC", fila: 2 }, { pos: "MC", fila: 2 },
    { pos: "EI", fila: 3 }, { pos: "DC", fila: 3 }, { pos: "ED", fila: 3 }
  ];

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
    PEOPLE, SHINY, TIERS, VARIANTS, FOLDER, CARDS, TOTAL, POR_TIER, LEGADO, COMPONENTES, TEMAS, FUTBOLISTAS, PREMIER, CHAMPIONS, ESPECIALES, BAYERN, CHILE, ARGENTINA, MLS, ARABIA, MEDIAS, POSICIONES, POS_LINEA, PUESTO, PEN_AJUSTE, ajuste, esFutbol, CLUBES, FORMACION, COLECCIONES, COL, POR_COL, POOL, SOBRES, SOBRE,
    coleccionDe, poolDe, sobreDe, AMPLIACIONES, GRADE_W, GRADE_WORD, PRECIO, DIOS, ESPERADO, BANDAS, tierDeMedia, PESOS_FUTBOL,
    subtitulo, acento, colorNota, precioSobre, sha256, generador, sobre, probabilidad, notaOMas, pDios, coleccion, gasto,
    REROLL, PESO_REROLL, pesosReroll, distribucionReroll, reroll, SALTO_W, SALTOS_DESDE, probSalida
  };
});
