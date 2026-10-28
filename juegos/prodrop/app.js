'use strict';
/* =========================================================
   PRODROP — abridor de sobres
   ========================================================= */
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// `?ver=1&…`: el modo visor, una sola carta viva para el mercado de Juegos (al final del archivo)
const VER = new URLSearchParams(location.search), VISOR = VER.has('ver');
if (VISOR) document.documentElement.classList.add('visor');

/* ---------------- DATOS ---------------- */
// El catálogo, las rarezas y el azar viven en motor.js (compartido con Juegos).
const M = window.ProdropMotor;
const SHINY = M.SHINY;
const TIERS = M.TIERS;
// Lo que el motor no necesita: ataques, tipo y PS de las comunes y las raras.
const VARIANTS = [
  { key: 'original', type: 'Normal', icon: '✦', hp: 60, weak: '✎',
    moves: [['Saludo cordial', 20, 'Lanza una moneda. Si sale cara, el rival queda Confundido.'], ['Reunión de pega', 50]] },
  { key: 'dibujo', type: 'Arte', icon: '✎', hp: 50, weak: '☀',
    moves: [['Trazo de Paint', 10, 'Este ataque no respeta las proporciones del rival.'], ['Garabato salvaje', 40]] },
  { key: 'anime', type: 'Titán', icon: '⚔', hp: 70, weak: '✦',
    moves: [['Mirada intensa', 20, 'Mira al rival directo a los ojos. Muy dramáticamente.'], ['Golpe titán', 50]] },
  { key: 'calvo', type: 'Brillo', icon: '☀', hp: 90, weak: '⚔',
    moves: [['Reflejo cegador', 30, 'El rival no puede atacar durante su próximo turno.'], ['Cabezazo pulido', 70]] },
  { key: 'simpson', type: 'Amarillo', icon: '◉', hp: 80, weak: '✎',
    moves: [["¡D'oh!", 30, 'Se golpea la frente. El rival se ríe tanto que pierde su próximo turno.'], ['Rosquilla glaseada', 60]] },
  { key: 'gta' }, { key: 'cyberpunk' }, { key: 'casino' }, { key: 'shiny' }, { key: 'starwars' },
].map(v => Object.assign(v, M.VARIANTS.find(x => x.key === v.key)));
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* Los componentes: el tipo, el ícono y la debilidad salen de la temática
   (las comunes y las raras llevan marco), y los ataques del componente. */
const TEMA_V = {
  realista: { type: 'Eléctrico', icon: 'Ω', weak: '◐' },
  bioware: { type: 'Orgánico', icon: '✺', weak: '▦' },
  esquematico: { type: 'Plano', icon: '⌁', weak: '✺' },
  pixelart: { type: '8 bits', icon: '▦', weak: 'Ω' },
  void: { type: 'Vacío', icon: '◐', weak: '✠' },
  belico: { type: 'Blindado', icon: '✠', weak: '⌁' },
};
const ATAQUES = {
  'resistencia': [['Ley de Ohm', 20, 'Divide el daño del próximo ataque rival por su resistencia. Redondea hacia abajo.'], ['Disipación térmica', 40]],
  'condensador-electrolitico': [['Carga acumulada', 10, 'Guarda energía: su próximo ataque hace 30 más. Conectado al revés, explota.'], ['Descarga súbita', 60]],
  'inductor-toroidal': [['Oposición al cambio', 20, 'El rival no puede cambiar de carta durante su próximo turno.'], ['Fuerza contraelectromotriz', 50]],
  'led': [['Destello', 10, 'Lanza una moneda. Si sale cara, el rival queda encandilado y no ataca.'], ['Rayo de 20 mA', 40]],
  'transistor-bjt': [['Amplificación β', 20, 'Si el rival tiene menos de 30 PS, este ataque hace 100 veces más.'], ['Saturación', 50]],
  'mosfet-potencia': [['Conmutación rápida', 30, 'Ataca dos veces si la puerta del rival quedó abierta.'], ['Avalancha', 70]],
  'timer-555': [['Modo astable', 20, 'Repite este ataque cada turno sin gastar energía.'], ['Pulso monoestable', 50]],
  'microcontrolador': [['Interrupción', 20, 'Detiene el turno del rival para atender esta carta primero.'], ['Bucle infinito', 60]],
  'fotoresistencia-ldr': [['Ojo de cadmio', 10, 'En la oscuridad su resistencia sube a un megaohm: no recibe daño.'], ['Apagón', 40]],
  'sensor-ultrasonico': [['Eco a 40 kHz', 20, 'Ve al rival aunque esté boca abajo.'], ['Trig y echo', 40]],
  'condensador-ceramico': [['Desacople', 10, 'Quita el ruido: anula el efecto del último ataque rival.'], ['104 nF', 30]],
  'potenciometro': [['Girar la perilla', 20, 'Elige el daño de este ataque, de 0 a 60.'], ['Divisor de voltaje', 40]],
  'cristal-oscilador': [['Piezoeléctrico', 20, 'Vibra 16 millones de veces por segundo: el rival queda mareado.'], ['Reloj preciso', 50]],
  'diodo-rectificador': [['Media onda', 20, 'Durante el próximo turno solo recibe daño en un sentido.'], ['Puente de Graetz', 60]],
  'mosfet-sic-to247': [['Banda ancha', 40, 'Aguanta el calor: no le afecta Quemado.'], ['Bloqueo de 1200 V', 80]],
  'gate-driver': [['Bootstrap', 20, 'Le presta voltaje a un MOSFET aliado: su próximo ataque hace 40 más.'], ['Tiempo muerto', 50]],
  'amplificador-operacional': [['Tierra virtual', 20, 'El rival pierde su referencia y ataca al azar.'], ['Lazo abierto', 70]],
  'regulador-7805': [['Cinco voltios firmes', 30, 'Ningún ataque deja sus PS por debajo de 5.'], ['Disipador caliente', 40]],
  'esp32': [['Wi-Fi y Bluetooth', 30, 'Mira la mano del rival: se conectó sin pedir permiso.'], ['Doble núcleo', 60]],
  'transformador-laminado': [['Relación de vueltas', 30, 'Duplica o divide a la mitad el daño que recibe. Tú eliges.'], ['Corrientes de Foucault', 70]],
  'transformador-ferrita': [['Alta frecuencia', 30, 'Ataca cien mil veces por segundo, pero muy despacito.'], ['Flyback', 60]],
  'sensor-temperatura-humedad': [['Punto de rocío', 10, 'Moja al rival. Si es un Relé, se oxida.'], ['Lectura cada 2 s', 30]],
  'sensor-pir': [['Detección de movimiento', 20, 'Si el rival se mueve, se prende la luz del pasillo.'], ['Lente de Fresnel', 40]],
  'rele': [['Clic', 20, 'Hace clic. Es muy satisfactorio.'], ['Contacto NA', 50]],
  'sensor-imu': [['Giroscopio', 20, 'Sabe dónde está el rival aunque gire.'], ['Caída libre', 50]],
};
const CARDS = M.CARDS.map(m => {
  if (M.esFutbol(m.col)) return m;   // los futbolistas no tienen ataques: su carta es la foto
  if (m.col === 'comp') {
    const te = TEMA_V[m.vkey] || {}, h = hash(m.person + m.vkey);
    const v = { key: m.vkey, label: m.vlabel, type: te.type, icon: te.icon, weak: te.weak, moves: ATAQUES[m.person] };
    return Object.assign({}, m, { v, hp: (m.tier ? 80 : 50) + (h % 4) * 10, retreat: 1 + (h % 3) });
  }
  const v = VARIANTS.find(x => x.key === m.vkey), h = hash(m.person + v.key);
  return Object.assign({}, m, { v, hp: (v.hp || 0) + (h % 3) * 10, retreat: 1 + (h % 3) });
});
// cada colección numera sus cartas: N.º 12/170 en los profes, N.º 12/275 en componentes
const totalDe = c => M.POR_COL[c.col].length;
/* Las colecciones que ve esta cuenta. La Serie 01 (profes) solo le llega
   a quien está en la lista del admin (`serie1` en los datos): para el
   resto no hay sobre, ni pestaña, ni cartas (Juegos ni las manda). Sus
   cartas siguen siendo suyas: solo no se ven. */
/* Las colecciones (`COLS`: pestañas de la colección y del re-roll) no son lo
   mismo que los sobres que se compran (`PACKS`): fútbol es una sola
   colección con dos sobres, el normal y el Plus. */
let COLS = M.COLECCIONES, PACKS = M.SOBRES, TOTAL = CARDS.length;
function fijaColecciones(serie1) {
  COLS = M.COLECCIONES.filter(co => serie1 || co.key !== 'profes');
  PACKS = M.SOBRES.filter(x => serie1 || x.col !== 'profes');
  TOTAL = COLS.reduce((n, co) => n + M.POR_COL[co.key].length, 0);
  const unaCol = COLS.length < 2, unPack = PACKS.length < 2;
  [['#rrCols', unaCol], ['#colTabs', unaCol], ['#cambiaBtn', unPack], ['#cambiaBtn2', unPack]].forEach(([q, no]) => { const el = $(q); if (el) el.style.display = no ? 'none' : ''; });
  document.body.classList.toggle('serie1', !!serie1);
}
/* Lo que la carta de un futbolista dice además de la foto (el catálogo
   está en el motor: M.FUTBOLISTAS). */
const FUT_PAIS = {
  BE: 'Bélgica', UA: 'Ucrania', ES: 'España', BR: 'Brasil', ENG: 'Inglaterra', FR: 'Francia', DE: 'Alemania', NL: 'Países Bajos',
  UY: 'Uruguay', TR: 'Turquía', PT: 'Portugal', MA: 'Marruecos', CI: 'Costa de Marfil', PL: 'Polonia', HR: 'Croacia',
  DK: 'Dinamarca', SE: 'Suecia', EG: 'Egipto',
  SCO: 'Escocia', WAL: 'Gales', NIR: 'Irlanda del Norte', IE: 'Irlanda', AR: 'Argentina', IT: 'Italia', CM: 'Camerún', SI: 'Eslovenia',
  GH: 'Ghana', JP: 'Japón', CZ: 'Chequia', SK: 'Eslovaquia', GR: 'Grecia', NO: 'Noruega', EC: 'Ecuador', HU: 'Hungría', UZ: 'Uzbekistán',
  SN: 'Senegal', DZ: 'Argelia', US: 'Estados Unidos', GE: 'Georgia',
  AM: 'Armenia', AT: 'Austria', CH: 'Suiza', CO: 'Colombia', DO: 'República Dominicana', GN: 'Guinea', MX: 'México', RS: 'Serbia', RU: 'Rusia', XK: 'Kosovo',
};
// la bandera es una imagen (flags/<país>.png): el emoji no se ve como bandera en Windows, solo las dos letras
const bandera = cc => `flags/${cc.toLowerCase()}.png`;
// el escudo del club del jugador (escudos/<club>.png)
const escudo = club => `escudos/${club}.png`;
const colVisible = k => COLS.some(co => co.key === k);
const packVisible = k => PACKS.some(x => x.key === k);
// la colección de un sobre de la tienda, y si es de futbolistas
const colDe = k => M.SOBRE[k].col;
const esFutbolPack = k => M.esFutbol(colDe(k));
const pad = n => String(n).padStart(3, '0');
const subtitle = c => M.subtitulo(c);
// Colores dominantes de cada imagen épica/legendaria (extraídos de las imágenes)
const PAL = {"angel-abusleme-gta":["#066cf7","#ffe871","#f7461f"],"angel-abusleme-shiny":["#42f77c","#f79963"],"christian-oberli-gta":["#67abf7","#fff27b","#f73618"],"christian-oberli-shiny":["#ff7b86","#f7dd78"],"claudia-prieto-gta":["#ff4c61","#71efff","#ff6300"],"claudia-prieto-shiny":["#f72000","#ffb90c"],"cristian-garces-gta":["#59d7ff","#f72a0f","#ffdb53"],"cristian-garces-shiny":["#64bcf7","#f774a5"],"cristian-tejos-gta":["#77d9ff","#f76203","#7183f7"],"cristian-tejos-shiny":["#f7cd00","#6fa3f7","#f7483c"],"david-watts-gta":["#74ddff","#ffdf6b","#f74134"],"david-watts-shiny":["#f77300"],"felipe-nunez-gta":["#6eb0f7","#ffde7c","#f76183"],"felipe-nunez-shiny":["#09ecf7","#f720d2","#205cf7"],"felix-rojasv2-gta":["#6ad4ff","#6a87f7","#f7d263"],"felix-rojasv2-shiny":["#9e4bf7","#f76177","#f76fde"],"javier-pereda-torres-gta":["#46daff","#5e8ef7","#ffde65"],"javier-pereda-torres-shiny":["#114bf7","#8720f7","#ff5e58"],"marilyn-cruces-gta":["#00e7ff","#ff8900","#ebf765"],"marilyn-cruces-shiny":["#00bbf7","#f72514","#6990f7"],"mario-gac-gta":["#3be0ff","#f7da5c","#f75344"],"mario-gac-shiny":["#f7695b"],"miguel-gutierrez-gta":["#ffdf72","#f75c4f"],"miguel-gutierrez-shiny":["#f70075","#3102f7","#15f700"],"pablo-irarrazaval-gta":["#64a4f7","#ffdf6a","#f72518"],"pablo-irarrazaval-shiny":["#75f700","#00c3f7","#f7cb17"],"rene-botnar-gta":["#58a4f7","#ffdb5d","#f73c2b"],"rene-botnar-shiny":["#f76c00","#f7000c"],"rodrigo-cadiz-gta":["#57e1ff","#ffde65","#f7311d"],"rodrigo-cadiz-shiny":["#00c7f7","#3e79f7","#00f78f"],"rolando-dunner-gta":["#57a5f7","#f7d157","#f76274"],"rolando-dunner-shiny":["#ff798b","#f7d44e"],"tito-arevalo-gta":["#f7425a","#ffdd60","#85d7ff"],"tito-arevalo-shiny":["#f83c44","#85ffeb"],"angel-abusleme-casino":["#f78347"],"christian-oberli-casino":["#f7875e","#f741c5"],"claudia-prieto-casino":["#f79c63"],"cristian-garces-casino":["#f79463"],"cristian-tejos-casino":["#f79863","#3780f7"],"david-watts-casino":["#f79960"],"felipe-nunez-casino":["#f77644"],"felix-rojasv2-casino":["#f79763","#f752bb"],"javier-pereda-torres-casino":["#f7915d"],"marilyn-cruces-casino":["#f78351"],"mario-gac-casino":["#f76d29"],"miguel-gutierrez-casino":["#46b5f7","#c356f7","#f78163"],"pablo-irarrazaval-casino":["#f79657"],"rene-botnar-casino":["#f79863","#5495f7"],"rodrigo-cadiz-casino":["#f79a63"],"rolando-dunner-casino":["#f79a56"],"tito-arevalo-casino":["#f78d5e"],"angel-abusleme-cyberpunk":["#4d92f7","#f78563"],"christian-oberli-cyberpunk":["#f78852","#5dd2f7"],"claudia-prieto-cyberpunk":["#f78663","#f763d2","#8a63f7"],"cristian-garces-cyberpunk":["#f79063","#7cf763"],"cristian-tejos-cyberpunk":["#f79063","#6397f7","#63f7eb"],"david-watts-cyberpunk":["#f79963"],"felipe-nunez-cyberpunk":["#f77c5f"],"felix-rojasv2-cyberpunk":["#f78d5d","#4dd1f7"],"javier-pereda-torres-cyberpunk":["#f78e5a","#6394f7"],"marilyn-cruces-cyberpunk":["#f77d63","#639bf7"],"mario-gac-cyberpunk":["#f79d5b"],"miguel-gutierrez-cyberpunk":["#f78963","#c158f7","#e7f74f"],"pablo-irarrazaval-cyberpunk":["#f79163","#63d8f7"],"rene-botnar-cyberpunk":["#f78263","#63bef7"],"rodrigo-cadiz-cyberpunk":["#f7885c","#cd5bf7"],"rolando-dunner-cyberpunk":["#637af7"],"tito-arevalo-cyberpunk":["#f77a63","#c263f7"],"angel-abusleme-starwars":["#ed6822"],"christian-oberli-starwars":["#eb7113"],"claudia-prieto-starwars":["#f0764b"],"cristian-garces-starwars":["#ef8043"],"cristian-tejos-starwars":["#f0944b"],"david-watts-starwars":["#f08f4b"],"felipe-nunez-starwars":["#eb4f13"],"felix-rojasv2-starwars":["#eb131e"],"javier-pereda-torres-starwars":["#f0884b"],"marilyn-cruces-starwars":["#1363eb"],"mario-gac-starwars":["#f09049"],"miguel-gutierrez-starwars":[],"pablo-irarrazaval-starwars":["#ed4f20"],"rene-botnar-starwars":[],"rodrigo-cadiz-starwars":[],"rolando-dunner-starwars":[],"tito-arevalo-starwars":["#ed5026","#eb1315"],"resistencia-halloween":["#f64608"],"condensador-electrolitico-halloween":["#eb2e13","#ebf04b"],"inductor-toroidal-halloween":["#eb5713"],"led-halloween":["#eb3513","#eb1329"],"transistor-bjt-halloween":["#eb3d13"],"mosfet-potencia-halloween":["#eb4413"],"timer-555-halloween":["#eb5613"],"microcontrolador-halloween":["#eb5913"],"fotoresistencia-ldr-halloween":["#eb3313","#f0a24b"],"sensor-ultrasonico-halloween":["#eb4013"],"condensador-ceramico-halloween":["#eb5113"],"potenciometro-halloween":["#eb5013"],"cristal-oscilador-halloween":["#eb131e","#f08e47","#eb1713"],"diodo-rectificador-halloween":["#eb4e13"],"mosfet-sic-to247-halloween":["#eb5a13"],"gate-driver-halloween":["#eb4813"],"amplificador-operacional-halloween":["#eb4413"],"regulador-7805-halloween":["#ed8a25","#9ceb13"],"esp32-halloween":["#eb2213","#f0b44b"],"transformador-laminado-halloween":["#ec7f1b"],"transformador-ferrita-halloween":["#edef43","#eb4e13"],"sensor-temperatura-humedad-halloween":["#ec4819"],"sensor-pir-halloween":["#f08a4b","#eb1318"],"rele-halloween":["#076ef7","#eb3713","#eb131d"],"sensor-imu-halloween":["#eb4413","#fab041"],"resistencia-dieciochero":["#eb5113","#499cf0","#eba313"],"condensador-electrolitico-dieciochero":["#eb5113"],"inductor-toroidal-dieciochero":["#eb5e13","#eb131a"],"led-dieciochero":["#eb6a13","#f30e0b"],"transistor-bjt-dieciochero":["#f0984b","#eb1314"],"mosfet-potencia-dieciochero":["#f09c4b","#eb131c"],"timer-555-dieciochero":["#f09c4b","#4b96f0","#eb1913"],"microcontrolador-dieciochero":["#f0944b","#ec2716","#eb1318"],"fotoresistencia-ldr-dieciochero":["#f0924b","#4b90f0"],"sensor-ultrasonico-dieciochero":["#eb3d13","#4b92f0"],"condensador-ceramico-dieciochero":["#f0924b"],"potenciometro-dieciochero":["#ee8139"],"cristal-oscilador-dieciochero":["#eb5a13"],"diodo-rectificador-dieciochero":["#eb6b13","#4396ef"],"mosfet-sic-to247-dieciochero":["#f09e4b","#eb1315"],"gate-driver-dieciochero":["#eb5813","#eb1317"],"amplificador-operacional-dieciochero":["#f0994b","#eb131a"],"regulador-7805-dieciochero":["#eb4b13"],"esp32-dieciochero":["#f09a4b","#eb1315"],"transformador-laminado-dieciochero":["#eb8913","#eb2913","#eb1317"],"transformador-ferrita-dieciochero":["#eb5413","#f0cf4b"],"sensor-temperatura-humedad-dieciochero":["#ed4925"],"sensor-pir-dieciochero":["#ebb013","#eb131a","#eb2513"],"rele-dieciochero":["#f0a04b","#047efa","#eb2a13"],"sensor-imu-dieciochero":["#096ef5","#f83233","#ec3f1a"],"resistencia-arcano":["#eb4c13"],"condensador-electrolitico-arcano":["#eb5d13","#1330eb"],"inductor-toroidal-arcano":["#f0874b","#4b71f0"],"led-arcano":["#eb5f13"],"transistor-bjt-arcano":["#ee7134"],"mosfet-potencia-arcano":["#eb5e13"],"timer-555-arcano":["#ec781e"],"microcontrolador-arcano":["#ef803d"],"fotoresistencia-ldr-arcano":["#f08949"],"sensor-ultrasonico-arcano":["#2865ed","#eb6a13"],"condensador-ceramico-arcano":["#ec791e"],"potenciometro-arcano":["#eb5c13"],"cristal-oscilador-arcano":[],"diodo-rectificador-arcano":["#eb4e13"],"mosfet-sic-to247-arcano":["#eb5b13"],"gate-driver-arcano":["#ec7d20","#1352eb"],"amplificador-operacional-arcano":["#eb5d13"],"regulador-7805-arcano":["#eb5813"],"esp32-arcano":["#f0994b"],"transformador-laminado-arcano":["#f0ac4a","#1351eb"],"transformador-ferrita-arcano":["#c544ef","#f04b64","#fcd53f"],"sensor-temperatura-humedad-arcano":["#f07e4b","#eb1324"],"sensor-pir-arcano":["#eb4313","#eb1319"],"rele-arcano":["#1373eb","#eb6013"],"sensor-imu-arcano":["#ed8a23","#1366eb"],"resistencia-quemado":["#eb3813"],"condensador-electrolitico-quemado":["#eb3213"],"inductor-toroidal-quemado":["#eb1f13"],"led-quemado":["#eb1913","#eb1328"],"transistor-bjt-quemado":["#eb2213"],"mosfet-potencia-quemado":["#eb1813"],"timer-555-quemado":["#eb2813"],"microcontrolador-quemado":[],"fotoresistencia-ldr-quemado":["#eb3913"],"sensor-ultrasonico-quemado":["#eb1e13"],"condensador-ceramico-quemado":["#eb4213","#eb131c"],"potenciometro-quemado":[],"cristal-oscilador-quemado":["#eb3c13"],"diodo-rectificador-quemado":["#eb1330"],"mosfet-sic-to247-quemado":[],"gate-driver-quemado":[],"amplificador-operacional-quemado":["#eb4c13"],"regulador-7805-quemado":["#eb4313"],"esp32-quemado":["#eb5913"],"transformador-laminado-quemado":["#eb4513"],"transformador-ferrita-quemado":["#eb9413","#eb4413"],"sensor-temperatura-humedad-quemado":["#f0a24b","#eb3513"],"sensor-pir-quemado":["#eb5b13"],"rele-quemado":["#1374eb","#eb131f"],"sensor-imu-quemado":["#eb1713"],"resistencia-navidad":["#f0604b","#1367eb"],"condensador-electrolitico-navidad":["#eb7313","#eb1c13"],"inductor-toroidal-navidad":["#eb6013"],"led-navidad":["#eb7613","#eb2213"],"transistor-bjt-navidad":["#f0904b","#eb1e13"],"mosfet-potencia-navidad":["#eb5213"],"timer-555-navidad":["#eb5713"],"microcontrolador-navidad":["#ec6a17"],"fotoresistencia-ldr-navidad":["#eb5a13"],"sensor-ultrasonico-navidad":["#eb5e13"],"condensador-ceramico-navidad":["#eb8213","#eb2513"],"potenciometro-navidad":["#eb7013"],"cristal-oscilador-navidad":[],"diodo-rectificador-navidad":["#eb6013"],"mosfet-sic-to247-navidad":["#138beb","#f0824b"],"gate-driver-navidad":["#eb5d13"],"amplificador-operacional-navidad":["#f0864b","#eb1314"],"regulador-7805-navidad":["#eb5513"],"esp32-navidad":["#f0964b","#eb2413"],"transformador-laminado-navidad":["#efa844","#ec2112"],"transformador-ferrita-navidad":["#f0514b","#fddc3e","#f0954b"],"sensor-temperatura-humedad-navidad":["#eb3813"],"sensor-pir-navidad":["#f07e4b"],"rele-navidad":["#067cf8","#ee8131","#eb1a13"],"sensor-imu-navidad":["#eb5813","#1375eb"]};
const paletteOf = c => {
  const p = [...(PAL[c.uid] || [])], a = accentOf(c);
  if (!p.length) p.push(a);
  if (p.length < 2) p.push(c.tier === 3 ? a : '#c26bff');
  if (p.length < 3) p.push('#ffffff');
  return p;
};
const accentOf = c => M.acento(c);

/* ---------------- ESTADO DE LA CARTA (nota oculta 1..10) ----------------
   Cada carta sale con una nota que no se muestra: solo se nota por el desgaste
   (bordes blanqueados, esquinas gastadas, rayas, manchas, pliegues). Al graduarla
   se encapsula y recién ahí aparece la nota en la etiqueta. */
// la campana (GRADE_W) y las palabras de la nota son del motor: la nota ya viene decidida en el sobre
const GRADE_WORD = M.GRADE_WORD;
const gradeColor = M.colorNota;
// aleatorio con semilla, para que una misma copia se vea igual en todas partes
const mulberry = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function wearHTML(c) {
  const g = c.grade || 10;
  if (g >= 10) return '';
  const R = mulberry(c.wseed || 1), r = (a, b) => a + R() * (b - a), f = n => n.toFixed(2);
  // intensidad por nota: 4–6 solo rasguños y esquinas peladas, daño fuerte solo en 1–3
  const s = [0, .9, .78, .64, .3, .22, .16, .12, .08, .04][g], heavy = g <= 3, W = 100, H = 140, mul = [], scr = [];
  const curve = (x1, y1, x2, y2, bend) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    return `M${f(x1)} ${f(y1)}Q${f(x1 + dx / 2 - dy / l * bend)} ${f(y1 + dy / 2 + dx / l * bend)} ${f(x2)} ${f(y2)}`;
  };
  // mugre y superficie opaca
  if (g <= 8) mul.push(`<rect width="100" height="140" filter="url(#wGrime${R() * 4 | 0})" opacity="${f(heavy ? .08 + s ** 1.5 * .65 : .05 + s * .22)}"/>`);
  if (heavy) scr.push(`<rect width="100" height="140" filter="url(#wHaze)" opacity="${f(s * .5)}"/>`);
  // manchas de agua / café
  if (g <= 3) for (let i = 0; i < (g <= 2 ? 2 : 1); i++) {
    const x = r(15, 85), y = r(20, 120), rr = r(6, 15);
    mul.push(`<g filter="url(#wBlob)"><circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="#a97b30" opacity="${f(r(.18, .3))}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="none" stroke="#6b4512" stroke-width="${f(r(.6, 1.2))}" opacity=".4"/></g>`);
  }
  // línea de impresión
  if (g <= 7 && g >= 4 && R() < .35) { const x = r(10, 90); scr.push(`<path d="M${f(x)} 0V140" stroke="#fff" stroke-width=".22" opacity=".35"/>`); }
  // rayas finas en la superficie
  const nS = heavy ? Math.round(s ** 1.4 * 16 + 1) : [0, 0, 0, 0, 6, 5, 3, 2, 1, 1][g];
  for (let i = 0; i < nS; i++) {
    // 1–3: rayas curvas con ondulaciones; 4–9: rasguños rectos, cortos y finos
    const x = r(5, 95), y = r(5, 135), a = r(0, 6.28), l = heavy ? r(6, 38) * (.5 + s) : r(3, 12), d = curve(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, heavy ? r(-4, 4) : 0);
    scr.push(`<path d="${d}" fill="none" stroke="#fff" stroke-width="${f(heavy ? r(.12, .4) : r(.1, .25))}" stroke-linecap="round" opacity="${f(r(.3, .75))}"/>`);
    if (heavy && R() < .4) for (let j = 1; j < 4; j++)
      scr.push(`<path d="${d}" transform="translate(${f(j * .7 * Math.sin(a))} ${f(-j * .7 * Math.cos(a))})" fill="none" stroke="#fff" stroke-width=".1" opacity=".35"/>`);
  }
  // pliegues: sombra + brillo + tinta quebrada
  const creases = [];
  if (g <= 3) for (let i = 0; i < 4 - g; i++) {
    const side = R() * 4 | 0, p = [[r(10, 90), 0], [W, r(10, 130)], [r(10, 90), H], [0, r(10, 130)]];
    creases.push([...p[side], ...p[(side + 1 + (R() * 3 | 0)) % 4]]);
  }
  creases.forEach(([x1, y1, x2, y2]) => {
    const d = curve(x1, y1, x2, y2, r(-5, 5)), dash = Array.from({ length: 10 }, () => f(r(.4, 4))).join(' ');
    mul.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="1.8" opacity=".4" filter="url(#wSoft)"/>`);
    scr.push(`<path d="${d}" transform="translate(.45 .3)" fill="none" stroke="#fff" stroke-width=".35" opacity=".6"/>`,
      `<path d="${d}" fill="none" stroke="#fffdf4" stroke-width=".5" stroke-dasharray="${dash}" opacity=".9"/>`);
  });
  // bordes blanqueados
  const nE = Math.round(s ** 1.3 * 90 + 3);
  for (let i = 0; i < nE; i++) {
    const side = R() * 4 | 0, t = r(.05, .95), d = r(0, 1.1) * (.5 + s), len = r(.4, 2.2) * (.4 + s), th = r(.25, .8) * (.5 + s * .8);
    const [x, y, rx, ry] = side < 2 ? [t * W, side ? H - d : d, len, th] : [side === 2 ? d : W - d, t * H, th, len];
    scr.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fffdf2" opacity="${f(r(.45, .95))}"/>`);
  }
  if (g <= 7) {
    const dash = Array.from({ length: 14 }, () => f(r(.5, 7))).join(' ');
    scr.push(`<rect x=".3" y=".3" width="99.4" height="139.4" rx="4.4" fill="none" stroke="#fffaf0" stroke-width="${f(.3 + s * 1.2)}" stroke-dasharray="${dash}" opacity="${f(s * .75)}"/>`);
  }
  // esquinas gastadas
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([cx0, cy0]) => {
    if (R() > (heavy ? .2 + s : .25 + s * 2)) return;
    const k = r(.4, 1) * (1 + s * 4), x = cx0 ? W - 1.35 : 1.35, y = cy0 ? H - 1.35 : 1.35;
    scr.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(k)}" fill="#fff8e6" opacity="${f(r(.6, .95))}" filter="url(#wSoft)"/>`);
    for (let j = 0; j < 2 + s * 6; j++) {
      const a = r(0, 6.28), l = k * r(.6, 1.6);
      scr.push(`<path d="M${f(x)} ${f(y)}l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}" stroke="#fff" stroke-width=".25" opacity=".7"/>`);
    }
  });
  const svg = (cls, body) => `<svg class="wear${cls}" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  return (mul.length ? svg(' mul', mul.join('')) : '') + svg('', scr.join(''));
}
// impresión descentrada (solo cartas con marco)
function offCenter(c) {
  const g = c.grade || 10; if (g >= 9) return '';
  const R = mulberry((c.wseed || 1) + 7), s = (10 - g) / 9;
  return ` style="--ox:${((R() * 2 - 1) * s * 1.6).toFixed(2)}cqw;--oy:${((R() * 2 - 1) * s * 1.4).toFixed(2)}cqw"`;
}

/* ---------------- CUENTA Y COLECCIÓN ----------------
   La colección no vive en este navegador: llega desde Juegos, ya resuelta
   por la economía (sobres válidos, más lo comprado en el mercado o
   recibido en un intercambio, menos lo vendido o cambiado). Cada copia se
   rehace con el motor desde su sobre: `key` = `<origen>~<sobre>.<i>`. */
const cuenta = { uid: '', saldo: 0, parada: false, falta: 0, mias: [], sobres: {}, gratis: 0, ofertas: [], ventas: [], cambios: [],
  jugadores: {}, gente: {}, exh: [], listo: false, desfase: 0 };
let col = {}, copies = {}, abriendo = new Set();   // los sobres en curso no entran a la colección hasta el resumen
const ahora = () => Date.now() + cuenta.desfase;
// una copia que llega de Juegos ({c, o, k, i, at, gr}) con su nota y su desgaste
function copiaDe(x) {
  // la de un re-roll llega con su carta: no sale de ningún sobre
  if (x.rr) return { id: x.rr.id, g: x.rr.g, s: x.rr.w, gr: x.gr ? 1 : 0, o: x.o, k: x.k, i: x.i, at: x.at, key: x.c || `${x.o}~${x.k}.${x.i}`, venta: x.venta || '', dios: false, rr: true };
  const so = M.sobre(x.o, x.k, x.at), c = so.cartas[x.i];
  return { id: c.id, g: c.g, s: c.w, gr: x.gr ? 1 : 0, o: x.o, k: x.k, i: x.i, at: x.at, key: x.c || `${x.o}~${x.k}.${x.i}`, venta: x.venta || '', dios: so.dios };
}
function rehazColeccion() {
  col = {}; copies = {};
  for (const x of cuenta.mias) {
    if (x.o === cuenta.uid && abriendo.has(x.k)) continue;
    const cp = copiaDe(x), uid = M.CARDS[cp.id].uid;
    col[uid] = (col[uid] || 0) + 1;
    (copies[uid] = copies[uid] || []).push(cp);
  }
}
const ownedCount = () => CARDS.filter(c => col[c.uid]).length;
const gradedCount = () => Object.values(copies).flat().filter(cp => cp.gr).length;
const mismaCopia = (a, b) => !!(a && b && a.key === b.key);
function record(c) { c._rec = true; }
// copia instanciada como carta
const fromCopy = (base, cp) => ({ ...base, grade: cp.g, wseed: cp.s, graded: !!cp.gr, _copy: cp, _rec: true });
// la mejor graduada; si no hay, la última sin graduar
function bestCopy(uid) {
  const l = copies[uid] || [], gr = l.filter(cp => cp.gr).sort((a, b) => b.g - a.g);
  return gr[0] || l[l.length - 1];
}
/* El total va aparte: en un teléfono de 320 px solo cabe cuántas tienes. */
function updateColCount() { $('#colCount').innerHTML = `${ownedCount()}<span class="col-tot">/${TOTAL}</span>`; }

/* ---------------- RENDER DE CARTAS ---------------- */
// el reverso es de la colección: el de componentes es una placa con un rayo
const backHTML = c => c.col === 'comp'
  ? `<div class="face back bk-comp"><div class="bk"><div class="bk-ring">ϟ</div><b>PRODROP</b></div></div>`
  : `<div class="face back"><div class="bk"><div class="bk-ring">✳</div><b>PRODROP</b></div></div>`;

/* La ventana de arte de las cartas con marco es apaisada (85 × 71,8) y las
   imágenes de componentes son verticales: estas cartas usan una versión
   apaisada (`<tema>/ancho/`), con el fondo extendido a los costados y el
   componente original intacto al centro. */
const artDe = c => (c.col === 'comp' && c.tier < 2 ? c.img.replace(/\/([^/]+)$/, '/ancho/$1') : c.img);
function frontHTML(c, lazy) {
  const t = TIERS[c.tier], v = c.v, no = `${pad(c.num)}/${totalDe(c)}`, ld = lazy ? ' loading="lazy"' : '';
  const alt = `${c.name} — ${subtitle(c)}`;
  // fútbol: la foto entera y abajo el nombre con el tipo (Base), sin rareza
  // fútbol: la foto entera y abajo el nombre con su rareza; los efectos crecen con ella
  if (M.esFutbol(c.col)) {
    return `<div class="face front full futbol ${c.liga} ${t.key} club-${c.club}${c.especial ? ' especial esp-' + c.especial : ''}" style="--accent:${accentOf(c)}">
      <img src="${c.img}" alt="${alt}" draggable="false"${ld}>
      ${c.tier >= 2 ? `<div class="holo"><img src="${c.img}" alt="" draggable="false"${ld}></div><div class="glitter"></div>` : ''}
      ${c.tier >= 1 ? '<div class="sweep"></div>' : ''}<div class="glare"></div>
      <div class="fu-top"><span class="fu-pos" title="${c.posiciones.map(p => M.PUESTO[p]).join(' / ')}">${c.posiciones.join(' · ')}</span><span class="fu-medida" title="Media ${c.media} (la de EA SPORTS FC)"><b class="fu-media">${c.media}</b><small>MEDIA</small></span></div>
      ${c.cinta ? `<span class="fu-cinta">${c.cinta}</span>` : ''}
      ${wearHTML(c)}
      <div class="fa-name fu-pie"><div><b>${c.name}</b><span class="fu-rar">${t.label} ${t.sym}</span></div><span class="fu-iconos"><img class="fu-flag" src="${bandera(c.pais)}" alt="${FUT_PAIS[c.pais]}" title="${FUT_PAIS[c.pais]}" draggable="false"><img class="fu-escudo" src="${escudo(c.club)}" alt="${M.CLUBES[c.club]}" title="${M.CLUBES[c.club]}" draggable="false"></span></div>
      <i class="fu-marco"></i>
    </div>`;
  }
  if (c.tier >= 2) {
    return `<div class="face front full ${t.key}" style="--accent:${accentOf(c)}">
      <img src="${c.img}" alt="${alt}" draggable="false"${ld}>
      <div class="holo"><img src="${c.img}" alt="" draggable="false"${ld}></div>
      <div class="glitter"></div><div class="sweep"></div><div class="glare"></div>
      <div class="fa-name"><b>${c.name}</b><span>${subtitle(c)} · ${no} ${t.sym}</span></div>
      ${wearHTML(c)}
    </div>`;
  }
  const [m1, m2] = v.moves, nrg = `<i class="nrg">${v.icon}</i>`;
  return `<div class="face front framed ${t.key} v-${v.key} col-${c.col}">
    ${c.tier === 1 ? `<img class="fr-bg" src="${c.img}" alt="" draggable="false"${ld}><i class="fr-glass"></i>` : ''}
    <div class="fr-in"${offCenter(c)}>
      <div class="fr-head">
        <span class="fr-stage">BÁSICO</span>
        <b class="fr-name${c.name.length > 15 ? ' long' : ''}">${c.name}</b>
        <span class="fr-hp"><small>PS</small>${c.hp}</span><i class="nrg big">${v.icon}</i>
      </div>
      <div class="fr-art"><div class="win"><img src="${artDe(c)}" alt="${alt}" draggable="false"${ld}><div class="holo"></div></div></div>
      <div class="fr-strip">${v.label} · Tipo ${v.type} · N.º ${pad(c.num)}</div>
      <div class="fr-moves">
        <div class="mv"><span class="cost">${nrg}</span><b>${m1[0]}</b><span class="dmg">${m1[1]}</span></div>
        <p class="mv-txt">${m1[2]}</p>
        <div class="mv"><span class="cost">${nrg}${nrg}<i class="nrg n">✳</i></span><b>${m2[0]}</b><span class="dmg">${m2[1]}</span></div>
      </div>
      <div class="fr-stats"><span>debilidad<b>${v.weak}×2</b></span><span>resistencia<b>—</b></span><span>retirada<b>${'●'.repeat(c.retreat)}</b></span></div>
      <div class="fr-foot"><span>Ilus. PRODROP Studio</span><span>${no}<b class="rar">${t.sym}</b></span></div>
    </div>
    <div class="glare"></div>
    ${wearHTML(c)}
  </div>`;
}

// caja plástica de graduación (oculta hasta que la carta se gradúa)
function slabHTML(c) {
  const g = c.graded ? c.grade : 0;
  return {
    back: `<div class="slab-back"></div>`,
    front: `<div class="slab-label${g ? ` g${g}` : ''}" style="--gc:${g ? gradeColor(g) : '#fff'}">
      <div class="sl-l"><small>PRODROP GRADING</small><b>${c.name}</b><span>${M.COL[c.col].serie} · #${pad(c.num)} · ${subtitle(c)}</span><i class="sl-code"></i></div>
      <div class="sl-r"><span class="g-word">${g ? GRADE_WORD[g] : ''}</span><b class="g-num">${g || ''}</b></div>
    </div><div class="slab-front"></div>`,
  };
}

// Aura detrás de la carta: un resplandor + anillo en CSS; el fuego/humo/estrellas van en un canvas (Aura)
function auraFxHTML(c) {
  return c.tier < 2 ? '' : `<div class="aura-fx"><div class="af-glow"></div><div class="af-ring"></div></div>`;
}

function makeCard(c, { down = false, back = true, lazy = false } = {}) {
  const el = document.createElement('div');
  el.className = `card t${c.tier}${c.graded ? ' slabbed' : ''}`;
  el.style.setProperty('--accent', accentOf(c));
  if (c.tier >= 2) paletteOf(c).forEach((col, i) => el.style.setProperty(`--c${i + 1}`, col));
  if (c.grade && c.grade < 6) { el.classList.add('faded'); el.style.setProperty('--fade', (c.grade <= 3 ? .25 + (3 - c.grade) * .3 : (6 - c.grade) * .06).toFixed(2)); }
  const sl = c.grade ? slabHTML(c) : { back: '', front: '' };
  el.innerHTML = `${auraFxHTML(c)}<div class="tilt">${sl.back}<div class="flip${down ? ' down' : ''}">${back ? backHTML(c) : ''}${frontHTML(c, lazy)}</div>${sl.front}</div>`;
  el.card = c;
  return el;
}

/* ---------------- AURA DE PARTÍCULAS (épicas y legendarias) ----------------
   Cada carta revelada de rareza alta lleva un canvas detrás, más grande que ella.
   Legendaria: lenguas de fuego (partículas aditivas que suben), humo de color, brasas y destellos.
   Épica: motas de luz suaves y destellos. Los colores salen de la paleta de la imagen. */
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.random() * arr.length | 0];
const Aura = {
  cards: new Set(), sprites: new Map(), raf: 0, last: 0,
  cfg: {
    3: { flame: 170, smoke: 8, ember: 26, star: 5, burst: 110 },
    2: { mote: 14, star: 5, burst: 30 },
    // las legendarias de Navidad no arden: les nieva alrededor
    nieve: { snow: 34, star: 7, burst: 40, primero: 'snow' },
  },
  sprite(col, kind) {
    const key = kind + col;
    if (this.sprites.has(key)) return this.sprites.get(key);
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), m = S / 2, gr = g.createRadialGradient(m, m, 0, m, m, m);
    if (kind === 'hot') { gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.22, rgba(col, .8)); gr.addColorStop(.55, rgba(col, .22)); gr.addColorStop(1, rgba(col, 0)); }
    else if (kind === 'soft') { gr.addColorStop(0, rgba(col, .55)); gr.addColorStop(.45, rgba(col, .22)); gr.addColorStop(1, rgba(col, 0)); }
    else { gr.addColorStop(0, '#fff'); gr.addColorStop(.1, rgba(col, .9)); gr.addColorStop(.32, rgba(col, .18)); gr.addColorStop(1, rgba(col, 0)); }
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    if (kind === 'star') { // destello de 4 puntas
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.95)';
      g.beginPath(); g.moveTo(m, 0); g.lineTo(m + 1.6, m); g.lineTo(m, S); g.lineTo(m - 1.6, m); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, m); g.lineTo(m, m - 1.6); g.lineTo(S, m); g.lineTo(m, m + 1.6); g.closePath(); g.fill();
    }
    this.sprites.set(key, cv); return cv;
  },
  attach(el) {
    if (REDUCED || el._aura || el.card.tier < 2) return;
    const fx = el.querySelector('.aura-fx'); if (!fx) return;
    const cv = document.createElement('canvas'); cv.className = 'af-canvas'; fx.prepend(cv);
    el._aura = { cv, ctx: cv.getContext('2d'), parts: [], w: 0, h: 0, acc: {}, pal: paletteOf(el.card), tier: el.card.vkey === 'navidad' ? 'nieve' : el.card.tier, fresh: true };
    this.cards.add(el);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.step(t)); }
  },
  resize(a, w, h) {
    const d = Math.min(2, devicePixelRatio || 1);
    a.w = w; a.h = h; a.px = w * .62; a.pt = w * .95; a.pb = w * .3;
    a.W = w + a.px * 2; a.H = h + a.pt + a.pb;
    Object.assign(a.cv.style, { left: `${-a.px}px`, top: `${-a.pt}px`, width: `${a.W}px`, height: `${a.H}px` });
    a.cv.width = a.W * d | 0; a.cv.height = a.H * d | 0; a.ctx.setTransform(d, 0, 0, d, 0, 0);
    a.parts.length = 0;
  },
  // punto en el borde de la carta (algo hacia adentro, para que la partícula "salga" de detrás)
  edge(a, wSide, wTop, wBot) {
    const r = Math.random() * (wSide * 2 + wTop + wBot), w = a.w, h = a.h, x0 = a.px, y0 = a.pt, ins = w * .07;
    if (r < wSide) return { x: x0 + ins, y: y0 + rnd(.04, 1) * h, nx: -1, ny: 0 };
    if (r < wSide * 2) return { x: x0 + w - ins, y: y0 + rnd(.04, 1) * h, nx: 1, ny: 0 };
    if (r < wSide * 2 + wTop) return { x: x0 + rnd(.05, .95) * w, y: y0 + ins, nx: 0, ny: -1 };
    return { x: x0 + rnd(.1, .9) * w, y: y0 + h - ins, nx: 0, ny: 1 };
  },
  spawn(a, kind, k) {
    const pal = a.pal, w = a.w, P = { kind, age: 0, seed: Math.random() * 99, rot: rnd(0, 6.28) };
    if (kind === 'flame') {
      const e = this.edge(a, 1, .55, .12), out = rnd(20, 75) * k;
      Object.assign(P, { x: e.x, y: e.y, vx: e.nx * out + rnd(-12, 12) * k, vy: -rnd(55, 140) * k + e.ny * out * .6,
        life: rnd(.75, 1.55), r0: w * rnd(.06, .1), r1: w * rnd(.2, .36), a: rnd(.38, .62),
        spr: this.sprite(pick(pal), Math.random() < .35 ? 'hot' : 'soft'), op: 'lighter' });
    } else if (kind === 'smoke') {
      const e = this.edge(a, 1, 1.2, 0);
      Object.assign(P, { x: e.x + e.nx * w * .15, y: e.y - w * rnd(0, .2), vx: e.nx * rnd(6, 20) * k, vy: -rnd(18, 40) * k,
        life: rnd(2.6, 4.2), r0: w * rnd(.22, .32), r1: w * rnd(.5, .75), a: rnd(.1, .17),
        spr: this.sprite(pal[1] || pal[0], 'soft'), op: 'screen' });
    } else if (kind === 'ember') {
      const e = this.edge(a, 1, .35, 0);
      Object.assign(P, { x: e.x + e.nx * w * .06, y: e.y, vx: e.nx * rnd(10, 45) * k, vy: -rnd(110, 230) * k,
        life: rnd(.8, 1.6), r0: w * rnd(.025, .04), r1: w * .012, a: 1,
        spr: this.sprite(pick(pal), 'hot'), op: 'lighter' });
    } else if (kind === 'snow') {   // copos que caen por delante y por los lados
      const x = a.px + rnd(-.45, 1.45) * w;
      Object.assign(P, { x, y: a.pt * rnd(.1, .6), vx: rnd(-6, 6) * k, vy: rnd(28, 60) * k,
        life: rnd(2.4, 3.8), r0: w * rnd(.012, .03), r1: w * rnd(.012, .03), a: rnd(.6, .95),
        spr: this.sprite(Math.random() < .7 ? '#ffffff' : pick(pal), 'soft'), op: 'lighter' });
    } else if (kind === 'mote') {
      const e = this.edge(a, 1, .5, .2);
      Object.assign(P, { x: e.x + e.nx * w * .1, y: e.y, vx: e.nx * rnd(8, 26) * k, vy: -rnd(18, 50) * k,
        life: rnd(1.4, 2.6), r0: w * rnd(.03, .05), r1: w * rnd(.05, .09), a: rnd(.5, .85),
        spr: this.sprite(pick(pal), 'hot'), op: 'lighter' });
    } else { // star: aparece alrededor de la carta, titila y se va
      const e = this.edge(a, 1, .7, .12), d = w * (e.ny > 0 ? rnd(.04, .14) : rnd(.08, .4));
      Object.assign(P, { x: e.x + e.nx * d + (e.ny ? 0 : rnd(-8, 8)), y: e.y + e.ny * d, vx: 0, vy: -rnd(4, 14) * k,
        life: rnd(.5, 1.1), r0: w * rnd(.045, .1), r1: 0, a: 1,
        spr: this.sprite(Math.random() < .5 ? '#ffffff' : pick(pal), 'star'), op: 'lighter', twinkle: true });
    }
    a.parts.push(P);
  },
  step(now) {
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    for (const el of this.cards) {
      const a = el._aura;
      if (!el.isConnected) { this.cards.delete(el); el._aura = null; continue; }
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !el.classList.contains('lit')) continue;           // oculto (overlay cerrado, etc.)
      if (w !== a.w || h !== a.h) this.resize(a, w, h);
      const k = w / 300, cfg = this.cfg[a.tier];
      if (a.fresh) { a.fresh = false; for (let i = 0; i < cfg.burst; i++) this.spawn(a, cfg.primero || (a.tier === 3 ? 'flame' : 'mote'), k * 1.6); }
      for (const kind in cfg) {
        if (kind === 'burst' || kind === 'primero') continue;
        a.acc[kind] = (a.acc[kind] || 0) + cfg[kind] * dt * Math.max(.45, k);
        while (a.acc[kind] >= 1) { a.acc[kind]--; this.spawn(a, kind, k); }
      }
      const g = a.ctx; g.clearRect(0, 0, a.W, a.H);
      const t = now / 1000;
      // humo primero (debajo), luego lo aditivo
      for (const pass of ['screen', 'lighter']) {
        g.globalCompositeOperation = pass;
        for (const p of a.parts) {
          if (p.op !== pass) continue;
          const u = p.age / p.life;
          let alpha, r;
          if (p.twinkle) { const s = Math.sin(Math.PI * u); alpha = s; r = p.r0 * (.35 + .65 * s); }
          else { alpha = p.a * (u < .18 ? u / .18 : (1 - u) / .82) ** 1.3; r = p.r0 + (p.r1 - p.r0) * u; }
          // se apagan suavemente cerca del borde del canvas: nunca se ve un corte
          const m = Math.min(p.x, a.W - p.x, p.y * .7, a.H - p.y) / (a.w * .3);
          if (m < 1) alpha *= Math.max(0, m) ** 2;
          if (alpha <= .002 || r <= .3) continue;
          g.globalAlpha = Math.min(1, alpha);
          if (p.twinkle) {
            g.save(); g.translate(p.x, p.y); g.rotate(p.rot + u * .6); g.drawImage(p.spr, -r, -r, r * 2, r * 2); g.restore();
          } else if (p.kind === 'flame') { // lenguas: más altas que anchas, y se estiran al subir
            const st = 1.25 + u * .9;
            g.drawImage(p.spr, p.x - r * .8, p.y - r * st * .75, r * 1.6, r * st * 2);
          } else g.drawImage(p.spr, p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      g.globalAlpha = 1;
      // física
      for (let i = a.parts.length - 1; i >= 0; i--) {
        const p = a.parts[i];
        p.age += dt;
        if (p.age >= p.life) { a.parts.splice(i, 1); continue; }
        if (p.kind === 'flame' || p.kind === 'ember' || p.kind === 'smoke') {
          p.vx += Math.sin(t * 3.1 + p.seed + p.y * .035) * 90 * k * dt;   // turbulencia
          p.vx *= 1 - 1.4 * dt;
          if (p.kind === 'flame') p.vy -= 40 * k * dt;                         // el calor acelera hacia arriba
        } else if (p.kind === 'mote') p.vx += Math.sin(t * 1.7 + p.seed) * 14 * k * dt;
        else if (p.kind === 'snow') p.vx = Math.sin(t * 1.3 + p.seed) * 12 * k;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    this.raf = this.cards.size ? requestAnimationFrame(t => this.step(t)) : 0;
  },
};
const light = el => { el.classList.add('lit'); Aura.attach(el); };

/* ---------------- SONIDO (sintetizado) ---------------- */
const Snd = {
  on: true, ctx: null, master: null, wet: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    try {
      const a = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = a.createGain(); this.master.gain.value = .7; this.master.connect(a.destination);
      // pequeño eco para los brillos
      const d = a.createDelay(), fb = a.createGain(), lp = a.createBiquadFilter();
      d.delayTime.value = .17; fb.gain.value = .33; lp.frequency.value = 3800;
      this.wet = a.createGain(); this.wet.gain.value = .4;
      this.wet.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
      return a;
    } catch { return null; }
  },
  tone(f, { t = 0, d = .4, v = .1, type = 'sine', to = null, wet = 0 } = {}) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime + t, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, n);
    if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + .012); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(this.master);
    if (wet) { const s = a.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.wet); }
    o.start(n); o.stop(n + d + .05);
  },
  noise({ t = 0, d = .2, v = .1, f = 2000, q = 1, type = 'bandpass', to = null } = {}) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime + t, len = Math.ceil(a.sampleRate * d), b = a.createBuffer(1, len, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    src.buffer = b; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, n);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(v, n + .01); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    src.connect(fl); fl.connect(g); g.connect(this.master); src.start(n);
  },
  tick() { this.noise({ d: .03, v: .07, f: 2500 + Math.random() * 3500, q: 2.5 }); },
  rip() {
    for (let i = 0; i < 8; i++) this.noise({ t: i * .022, d: .05, v: .14, f: 1500 + Math.random() * 4000, q: 1.4 });
    this.noise({ d: .4, v: .14, f: 2200, to: 500, q: .8 });
    this.tone(130, { d: .3, v: .22, to: 45 });
  },
  whoosh(v = .14) { this.noise({ d: .35, v, f: 350, to: 2600, q: .9 }); },
  flip() { this.noise({ d: .07, v: .12, f: 2600, q: 1 }); this.tone(1100, { d: .05, v: .03, type: 'triangle' }); },
  land() { this.tone(95, { d: .22, v: .2, to: 45 }); this.noise({ d: .08, v: .05, f: 500, type: 'lowpass' }); },
  charge(tier, ms) {
    if (!this.on) return; const a = this.init(); if (!a) return;
    const n = a.currentTime, d = ms / 1000, o = a.createOscillator(), o2 = a.createOscillator(), fl = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(tier === 3 ? 55 : 70, n); o.frequency.exponentialRampToValueAtTime(tier === 3 ? 440 : 260, n + d);
    o2.frequency.setValueAtTime(tier === 3 ? 55.6 : 70.7, n); o2.frequency.exponentialRampToValueAtTime(tier === 3 ? 446 : 264, n + d);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(200, n); fl.frequency.exponentialRampToValueAtTime(tier === 3 ? 4200 : 2400, n + d);
    g.gain.setValueAtTime(.0001, n); g.gain.exponentialRampToValueAtTime(.09, n + d * .9); g.gain.exponentialRampToValueAtTime(.0001, n + d + .08);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(this.master);
    o.start(n); o2.start(n); o.stop(n + d + .1); o2.stop(n + d + .1);
    const steps = tier === 3 ? 14 : 8;
    for (let i = 0; i < steps; i++) this.tone(800 + i * 140, { t: d * (i / steps) ** .7, d: .12, v: .02 + i * .002, type: 'triangle', wet: .5 });
  },
  scan(d) { this.tone(190, { d, v: .035, type: 'sawtooth', to: 380 }); this.noise({ d, v: .025, f: 5200, q: 5 }); },
  blip() { this.tone(2100, { d: .04, v: .02, type: 'square' }); },
  clack() {
    this.noise({ d: .06, v: .28, f: 3000, q: .8 }); this.tone(330, { d: .14, v: .13, type: 'triangle', to: 140 });
    this.noise({ t: .045, d: .04, v: .12, f: 5200, q: 1 });
  },
  grade(g) {
    if (g >= 9) [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => this.tone(f, { t: i * .07, d: 1.3, v: .06, type: 'triangle', wet: .7 }));
    else if (g >= 6) [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, { t: i * .08, d: .7, v: .05, wet: .4 }));
    else if (g >= 4) [440, 554.37].forEach((f, i) => this.tone(f, { t: i * .1, d: .5, v: .05 }));
    else [392, 369.99, 349.23, 329.63].forEach((f, i) => this.tone(f, { t: i * .24, d: i === 3 ? .9 : .26, v: .045, type: 'triangle' }));
    if (g === 10) { this.tone(52, { d: 1.2, v: .35, to: 28 }); [1046.5, 1318.51, 1567.98, 2093].forEach(f => this.tone(f, { t: .5, d: 2.2, v: .03, type: 'triangle', wet: .9 })); }
  },
  reveal(tier) {
    const sets = [[659.25, 987.77], [523.25, 659.25, 783.99, 1046.5],
      [392, 493.88, 587.33, 783.99, 987.77, 1174.66],
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]];
    sets[tier].forEach((f, i) => this.tone(f, { t: i * (tier === 3 ? .065 : .055), d: tier >= 2 ? 1.5 : .5, v: tier >= 2 ? .06 : .05, type: tier === 3 ? 'triangle' : 'sine', wet: .6 }));
    if (tier >= 2) {
      this.tone(tier === 3 ? 48 : 62, { d: 1.3, v: .4, to: 28 });
      this.noise({ d: .7, v: .2, f: 1800, to: 150, type: 'lowpass' });
    }
    if (tier === 3) [523.25, 659.25, 783.99, 1046.5].forEach(f => this.tone(f, { t: .6, d: 2.6, v: .035, type: 'triangle', wet: .9 }));
  },
  // monedas que caen en la caja
  coin() { [1318.51, 1975.53].forEach((f, i) => this.tone(f, { t: i * .07, d: .35, v: .05, type: 'square', wet: .4 })); this.noise({ d: .05, v: .06, f: 6000, q: 3 }); },
  // god pack: un acorde que sube y un golpe grave
  god() {
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => this.tone(f, { t: i * .09, d: 2.4, v: .05, type: 'triangle', wet: .9 }));
    this.tone(40, { d: 1.8, v: .45, to: 24 }); this.noise({ d: 1.4, v: .18, f: 900, to: 5000, q: .7 });
  },
};
$('#soundBtn').onclick = () => {
  Snd.on = !Snd.on;
  $('#soundBtn').setAttribute('aria-pressed', String(Snd.on));
  if (Snd.ctx) Snd.on ? Snd.ctx.resume() : Snd.ctx.suspend();
};
const buzz = p => { try { if (!REDUCED && navigator.vibrate) navigator.vibrate(p); } catch {} };

/* ---------------- PARTÍCULAS ---------------- */
const cv = $('#fx'), cx = cv.getContext('2d');
let W = 0, H = 0, parts = [], fxRaf = 0, fxLast = 0;
function resizeFx() {
  const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
}
resizeFx(); addEventListener('resize', resizeFx);

function addParts(list) {
  if (REDUCED) return;
  parts.push(...list);
  if (parts.length > 1200) parts.splice(0, parts.length - 1200);
  if (!fxRaf) { fxLast = performance.now(); fxRaf = requestAnimationFrame(fxStep); }
}
function burst(x, y, o = {}) {
  const { n = 40, colors = ['#fff'], speed = 9, kinds = ['spark'], gravity = .16, spread = Math.PI * 2, angle = 0, life = 1, size = 1 } = o;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - .5) * spread, v = speed * (.3 + Math.random() * .9), k = kinds[i % kinds.length];
    out.push({
      k, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      g: k === 'confetti' ? gravity * .55 : k === 'star' ? gravity * .2 : gravity,
      c: colors[Math.random() * colors.length | 0],
      s: (k === 'confetti' ? 5 + Math.random() * 6 : k === 'star' ? 2 + Math.random() * 3 : 1 + Math.random() * 2.2) * size,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * .35, life: 1,
      decay: (k === 'confetti' ? .006 + Math.random() * .006 : .012 + Math.random() * .014) / life,
      drag: k === 'confetti' ? .975 : .94,
    });
  }
  addParts(out);
}
function suck(cxp, cyp, r, colors, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (.8 + Math.random() * .6);
    out.push({ k: 'in', x: cxp + Math.cos(a) * d, y: cyp + Math.sin(a) * d, tx: cxp, ty: cyp, c: colors[Math.random() * colors.length | 0], s: 1.2 + Math.random() * 2, life: 1, sp: .035 + Math.random() * .03 });
  }
  addParts(out);
}
function star(x, y, r) {
  cx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .28 : r; cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  cx.closePath(); cx.fill();
}
function fxStep(t) {
  const dt = Math.min((t - fxLast) / 16.67, 3); fxLast = t;
  cx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    // las de revela.js se pintan solas (rayos, anillos, nieve…) y dicen si siguen vivas
    if (p.draw) {
      cx.save(); const viva = p.draw(cx); cx.restore();
      if (!viva) parts.splice(i, 1);
      continue;
    }
    if (p.k === 'in') {
      const px = p.x, py = p.y;
      p.x += (p.tx - p.x) * p.sp * dt * 1.6; p.y += (p.ty - p.y) * p.sp * dt * 1.6;
      if (Math.hypot(p.tx - p.x, p.ty - p.y) < 14) p.life = 0;
      cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .9;
      cx.strokeStyle = p.c; cx.lineWidth = p.s; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(px - (p.x - px) * 3, py - (p.y - py) * 3); cx.lineTo(p.x, p.y); cx.stroke();
      if (p.life <= 0) parts.splice(i, 1);
      continue;
    }
    const dr = Math.pow(p.drag, dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
    if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
    cx.globalAlpha = Math.min(1, p.life * 1.6);
    if (p.k === 'spark') {
      cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = p.c; cx.lineWidth = p.s; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); cx.stroke();
    } else if (p.k === 'star') {
      cx.globalCompositeOperation = 'lighter'; cx.fillStyle = p.c;
      star(p.x, p.y, p.s * (1.6 + Math.sin(t / 70 + p.rot * 5)));
    } else {
      cx.globalCompositeOperation = 'source-over'; cx.fillStyle = p.c;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.rot * 2.3));
      cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); cx.restore();
    }
  }
  cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  if (parts.length) fxRaf = requestAnimationFrame(fxStep); else { fxRaf = 0; cx.clearRect(0, 0, W, H); }
}
const centerOf = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; };

function flash(color = '#fff', peak = .9, ms = 700) {
  const f = $('#flash');
  f.style.background = `radial-gradient(circle at 50% 50%, #fff 0%, ${color} 45%, ${color}00 100%)`;
  f.animate([{ opacity: 0 }, { opacity: peak, offset: .12 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

/* ---------------- INCLINACIÓN 3D ---------------- */
// Un solo bucle que inclina el elemento activo (sobre, carta en juego o carta ampliada)
const tilt = { target: null, box: null, amp: 1, x: .5, y: .5, tx: .5, ty: .5, hov: 0, th: 0, last: -1e9 };
function setTilt(target, box = target, amp = 1) { tilt.target = target; tilt.box = box; tilt.amp = amp; }
addEventListener('pointermove', e => {
  if (!tilt.box) return;
  const r = tilt.box.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  const near = px > -.35 && px < 1.35 && py > -.35 && py < 1.35;
  if (!near) return;
  tilt.tx = clamp(px, 0, 1); tilt.ty = clamp(py, 0, 1); tilt.last = performance.now(); tilt.th = 1;
});
(function tiltLoop(t) {
  if (tilt.target) {
    const idle = t - tilt.last > 1600;
    if (idle) { tilt.tx = .5 + .28 * Math.sin(t / 1300); tilt.ty = .5 + .2 * Math.cos(t / 1700); tilt.th = .35; }
    tilt.x += (tilt.tx - tilt.x) * .1; tilt.y += (tilt.ty - tilt.y) * .1; tilt.hov += (tilt.th - tilt.hov) * .08;
    const s = tilt.target.style, a = tilt.amp * (REDUCED ? .3 : 1);
    s.setProperty('--ry', `${((tilt.x - .5) * 26 * a).toFixed(2)}deg`);
    s.setProperty('--rx', `${((.5 - tilt.y) * 22 * a).toFixed(2)}deg`);
    s.setProperty('--mx', `${(tilt.x * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(tilt.y * 100).toFixed(1)}%`);
    s.setProperty('--hov', tilt.hov.toFixed(3));
  }
  requestAnimationFrame(tiltLoop);
})(0);

// inclinación directa al pasar el mouse (resumen / colección)
function hoverTilt(card) {
  const tl = card.querySelector('.tilt');
  card.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    tl.style.setProperty('--ry', `${(x - .5) * 24}deg`); tl.style.setProperty('--rx', `${(.5 - y) * 20}deg`);
    tl.style.setProperty('--mx', `${x * 100}%`); tl.style.setProperty('--my', `${y * 100}%`); tl.style.setProperty('--hov', 1);
  });
  card.addEventListener('pointerleave', () => { ['--rx', '--ry', '--mx', '--my', '--hov'].forEach(p => tl.style.removeProperty(p)); });
}

/* ---------------- SOBRE ---------------- */
const pack = $('#pack'), packTop = $('#packTop'), packBottom = $('#packBottom'), stack = $('#stack'), wrap = $('#wrap');
const TEAR_Y = 13; // % de la altura del sobre
(function cutPieces() {
  const teeth = 26, amp = .7, pts = [];
  for (let i = 0; i <= teeth * 2; i++) pts.push(`${(i / (teeth * 2) * 100).toFixed(2)}% ${(TEAR_Y + (i % 2 ? amp : -amp)).toFixed(2)}%`);
  packTop.style.clipPath = `polygon(0% 0%, 100% 0%, ${[...pts].reverse().join(',')})`;
  packBottom.style.clipPath = `polygon(${pts.join(',')}, 100% 100%, 0% 100%)`;
})();
/* El envoltorio de cada colección: el de los profes es el de siempre; el de
   componentes es una placa de circuito con pistas de cobre. */
const SKIN = {
  profes: { badge: 'SERIE 01', sub: 'DIE COLLECTION', meta: '5 CARTAS · EDICIÓN HOLO' },
  comp: { badge: 'SERIE 02', sub: 'COMPONENTES', meta: '5 CARTAS · EDICIÓN PCB' },
  futbol: { badge: 'SERIE 03', sub: 'FÚTBOL', meta: 'ESPECIALES · TIEMPO LIMITADO' },
  futbolplus: { badge: 'SERIE 03 · PLUS', sub: 'FÚTBOL PLUS', meta: 'ÉPICA ASEGURADA · 5 CARTAS' },
};
/* Los sobres de fútbol llevan siempre los mismos tres de portada, los más
   famosos (quien entra no conoce tanto de fútbol): [izquierda, derecha,
   centro], como los pinta `skin-fan`. `hub` es el acceso «Sobres de Fútbol».
   Los demás sobres sacan tres cartas buenas al azar. */
const PORTADA = {
  futbol: [['barcelona', 'lamine-yamal'], ['bayern', 'harry-kane-balon'], ['realmadrid', 'mbappe-mvp']],
  futbolplus: [['arsenal', 'bukayo-saka'], ['liverpool', 'virgil-van-dijk'], ['mancity', 'erling-haaland']],
  hub: [['barcelona', 'lamine-yamal'], ['bayern', 'harry-kane-balon'], ['realmadrid', 'mbappe-mvp']],
};
// una carta de la portada: por jugador (`club-id`) o, si es una especial, por su archivo (`club-id-especial`)
const cartaDePortada = (club, id) => CARDS.find(c => c.person === club + '-' + id) || CARDS.find(c => c.uid.startsWith(club + '-' + id + '-'));
const fanDe = (col, tier = 2) => PORTADA[col]
  ? PORTADA[col].map(([club, id]) => cartaDePortada(club, id))
  : CARDS.filter(c => c.tier >= tier && c.col === col).sort(() => Math.random() - .5).slice(0, 3);
function skinHTML(fan, col = coleccion) {
  const k = SKIN[col] || SKIN.profes;
  return `<div class="skin skin-${col}">
    <div class="skin-rays"></div><div class="skin-foil"></div>${col === 'comp' ? '<div class="skin-pcb"></div>' : ''}
    <div class="crimp t"></div>
    <div class="skin-badge">${k.badge}</div>
    <div class="skin-logo">PRO<br>DROP<small>${k.sub}</small></div>
    <div class="skin-fan">${fan.map(c => `<img src="${c.img}" alt="" draggable="false">`).join('')}</div>
    <div class="skin-meta">${k.meta}</div>
    <div class="skin-sheen"></div>
    <div class="crimp b"></div>
  </div>`;
}

let phase = 'pack', pull = [], els = [], current = 0, busy = false, tearP = 0, tearing = false, lastX = 0, lastTick = 0;
/* La colección del sobre que se va a abrir. Al entrar se elige (se
   recuerda la última para marcarla); «Cambiar sobre» vuelve a elegir. */
let coleccion = 'profes';
try { if (M.SOBRE[localStorage.getItem('prodrop.coleccion')]) coleccion = localStorage.getItem('prodrop.coleccion'); } catch {}
const setPhase = p => { phase = p; document.body.dataset.phase = p; };
const hint = txt => { $('#hint').textContent = txt; };

// los sobres comprados: su contenido sale del motor (uid, clave, hora del servidor)
let comprados = [];   // [{k, at, dios}], de 1 a 3: se abren juntos
const MAX_JUNTOS = 3;
// «nueva» se mide contra lo que tenías antes y contra las cartas ya salidas de los sobres anteriores
function cardsOf(k, at, s, antes, vistas) {
  const so = M.sobre(cuenta.uid, k, at);
  return so.cartas.map((x, i) => {
    const base = CARDS[x.id], cp = { id: x.id, g: x.g, s: x.w, gr: 0, o: cuenta.uid, k, i, at, key: `${cuenta.uid}~${k}.${i}`, venta: '' };
    const nueva = !antes.has(base.uid) && !vistas.has(base.uid);
    vistas.add(base.uid);
    return { ...base, grade: x.g, wseed: x.w, graded: false, _copy: cp, _new: nueva, _sobre: s, _dios: so.dios };
  });
}
const preload = list => Promise.all(list.map(c => { const i = new Image(); i.src = c.img; return i.decode().catch(() => {}); }));

// el sobre en la mesa: cerrado y sin pagar (fase `tienda`) o comprado y listo para abrir (`pack`)
function showPack(drop) {
  current = 0; busy = false; tearP = 0; tearing = false;
  $('#summary').hidden = true; $('#tableView').hidden = false;
  hideBanner(); setDots();
  stack.getAnimations().forEach(a => a.cancel());
  stack.style.visibility = 'hidden'; stack.innerHTML = '';
  els = pull.map((c, i) => { const el = makeCard(c, { down: true }); el.style.zIndex = 100 - i; stack.appendChild(el); return el; });
  restack();
  const n = phase === 'tienda' ? cantidad : Math.max(1, comprados.length);
  $('#dots').innerHTML = '<i></i>'.repeat(pull.length || 5);
  $('#dots').classList.toggle('muchos', pull.length > 5);
  pintaKicker(n);
  pintaExtras(n);
  if (drop) {
    packTop.innerHTML = packBottom.innerHTML = skinHTML(fanDe(coleccion));
    [pack, packTop, $('#packLight')].forEach(e => e.getAnimations().forEach(a => a.cancel()));
    packTop.style.transform = ''; pack.hidden = false;
    pack.classList.remove('started', 'tearing');
    pack.animate([
      { transform: 'perspective(900px) translateY(-80vh) rotate(-14deg)', opacity: 0 },
      { transform: 'perspective(900px) translateY(0) rotate(0)', opacity: 1 },
    ], { duration: REDUCED ? 1 : 850, easing: 'cubic-bezier(.2,1.25,.4,1)' });
    $('#packExtras').animate([{ transform: 'translateY(-80vh)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: REDUCED ? 1 : 850, delay: REDUCED ? 0 : 90, easing: 'cubic-bezier(.2,1.25,.4,1)', fill: 'backwards' });
    if (!REDUCED) setTimeout(() => Snd.land(), 450);
  }
  updateTear();
  setTilt(pack, pack, 1);
}
/* Los sobres de más se ven detrás del principal, en abanico: al rasgar
   el de delante se abren todos a la vez. Son solo decorado; el corte y
   las cartas son los del sobre principal. */
function pintaExtras(n, forzar = true) {
  const box = $('#packExtras');
  if (!forzar && +box.dataset.n === n) return;
  box.getAnimations({ subtree: true }).forEach(a => a.cancel());
  const pos = n === 2 ? [[-1, 0]] : n >= 3 ? [[-1, 0], [1, 1]] : [];
  box.innerHTML = pos.map(([lado, i]) => {
    return `<div class="pack-extra" style="--lado:${lado};--i:${i}"><div class="pack-piece">${skinHTML(fanDe(coleccion, 1))}</div></div>`;
  }).join('');
  box.dataset.n = n;
}
const pintaKicker = n => { $('#kicker').textContent = n > 1 ? `${SKIN[coleccion].sub} · ${n} sobres · ${5 * n} cartas` : `${SKIN[coleccion].sub} · 5 cartas por sobre`; };
/* ---------------- ELEGIR SOBRE ----------------
   Lo primero al entrar: qué sobre abrir. Cada colección muestra tres de
   sus mejores cartas, cuántas tienes de ella y qué trae. Las colecciones
   de futbolistas (`grupo: 'futbol'`) no salen sueltas: son un solo acceso,
   «Sobres de Fútbol», que lleva a un segundo menú con solo cromos de
   fútbol (el Clásico y la Premier). */
const hayFutbol = () => PACKS.some(x => x.grupo === 'futbol');
let menuActual = 'todos';   // 'todos' o 'futbol': el menú que se está viendo
const TEMAS = {
  profes: 'Original, Simpson, GTA, Cyberpunk, Star Wars, Shiny…',
  comp: '11 temáticas · Bioware, Pixel Art, Void, Arcano, Quemado, Navidad…',
  futbol: 'Cartas especiales por tiempo limitado: Mbappé · MVP del Clásico y Harry Kane · Balón de Oro. Además, todos los jugadores de Real Madrid, Barça, el Big Six y más clubes de la Champions',
  futbolplus: 'El doble de caro: la quinta carta es Épica o mejor, siempre, y salen menos comunes',
};
function eligeSobre(menu = 'todos') {
  const futbolistas = PACKS.filter(x => x.grupo === 'futbol');
  const sueltas = PACKS.filter(x => x.grupo !== 'futbol');
  // sin nada que elegir (una sola colección, o un solo sobre de fútbol): directo a la mesa
  if (menu === 'futbol' && futbolistas.length < 2) menu = 'todos';
  if (menu === 'todos' && sueltas.length + (futbolistas.length ? 1 : 0) < 2) {
    if (sueltas.length === 1 || futbolistas.length === 1) { coleccion = (sueltas[0] || futbolistas[0]).key; tienda(); return; }
    if (futbolistas.length) menu = 'futbol';   // solo hay fútbol: se entra a su menú
  }
  menuActual = menu;
  setPhase('elige');
  comprados = []; pull = []; abriendo = new Set();
  rehazColeccion();
  pack.hidden = true; stack.innerHTML = ''; $('#packExtras').innerHTML = '';
  $('#summary').hidden = true; $('#tableView').hidden = true; $('#chooser').hidden = false;
  document.body.classList.toggle('menu-futbol', menu === 'futbol');
  $('#chTit').textContent = menu === 'futbol' ? '⚽ Sobres de Fútbol' : 'Elige tu sobre';
  $('#chSub').textContent = menu === 'futbol'
    ? 'Un solo catálogo: los jugadores de Real Madrid, Barça, la Premier y más clubes de la Champions. El Plus cuesta el doble y asegura una Épica o mejor. Mismas cartas para los 🏆 desafíos de plantilla y el re-roll.'
    : 'Cada colección tiene sus propias cartas, rarezas y animaciones. Un sobre gratis cada 6 horas.';
  $('#chBack').hidden = menu !== 'futbol' || !sueltas.length;
  hideBanner(); setTilt(null, null);
  const box = $('#chooserPacks');
  const ficha = co => {
    const todas = M.POR_COL[co.col], tengo = todas.filter(c => col[c.uid]).length, k = SKIN[co.key];
    return `<button class="ch-pack${co.key === coleccion ? ' ultimo' : ''}" data-col="${co.key}">
      <span class="ch-skin">${skinHTML(fanDe(co.key), co.key)}</span>
      <b>${co.label}</b><small>${k.badge} · ${todas.length} cartas${co.mult > 1 ? ` · ${M.precioSobre(ahora(), co.mult)} ${MONEDA}` : ''}</small>
      <small class="ch-temas">${TEMAS[co.key]}</small>
      <span class="ch-tengo"><i style="width:${(tengo / todas.length * 100).toFixed(1)}%"></i></span><small>Tienes ${tengo}/${todas.length}</small>
    </button>`;
  };
  // el acceso al menú de fútbol: un sobre con las cartas de todos
  const fichaFutbol = () => {
    const todas = M.POR_COL.futbol, tengo = todas.filter(c => col[c.uid]).length;
    const fan = fanDe('hub');
    return `<button class="ch-pack hub${futbolistas.some(x => x.key === coleccion) ? ' ultimo' : ''}" data-menu="futbol">
      <span class="ch-skin">${skinHTML(fan, 'futbol')}<i class="hub-sello">TIEMPO LIMITADO</i></span>
      <b>⚽ Sobres de Fútbol</b><small>Serie 03 · ${todas.length} cartas</small>
      <small class="ch-temas">Cartas especiales por tiempo limitado: Mbappé, MVP del Clásico, y Harry Kane, Balón de Oro. Y el sobre normal y el Plus con todos los jugadores</small>
      <span class="ch-tengo"><i style="width:${(tengo / todas.length * 100).toFixed(1)}%"></i></span><small>Tienes ${tengo}/${todas.length}</small>
    </button>`;
  };
  box.innerHTML = menu === 'futbol' ? futbolistas.map(ficha).join('')
    : sueltas.map(ficha).join('') + (futbolistas.length ? fichaFutbol() : '');
  // en el menú de fútbol, la entrada grande a los desafíos de plantilla, con el reto de la semana
  const chr = $('#chRetos'), sem = window.ProdropRetos ? window.ProdropRetos.retoDeSemana(window.ProdropRetos.semanaDe(ahora())) : null;
  chr.hidden = menu !== 'futbol' || !sem;
  if (sem) chr.innerHTML = `<span class="ch-retos-ico">🏆</span><span><b>Desafío de plantilla</b><small>Reto de esta semana: ${esc(sem.titulo)}. Arma tu once con tus cartas, súbelo a la clasificación y gana monedas y sobres. También están la mejor plantilla y el álbum de clubes.</small></span><span class="ch-retos-ir">Jugar →</span>`;
  box.querySelectorAll('[data-col]').forEach(b => {
    b.onclick = () => {
      coleccion = b.dataset.col; Snd.init(); Snd.flip();
      try { localStorage.setItem('prodrop.coleccion', coleccion); } catch {}
      tienda();
    };
  });
  box.querySelectorAll('[data-menu]').forEach(b => { b.onclick = () => { Snd.init(); Snd.flip(); eligeSobre(b.dataset.menu); }; });
  box.querySelectorAll('.ch-pack').forEach(b => b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
    b.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
  }));
  pintaCompra();
  if (!REDUCED) [...box.children].forEach((b, i) => b.animate([{ transform: 'translateY(60px) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 700, delay: i * 110, easing: 'cubic-bezier(.2,1.25,.4,1)', fill: 'backwards' }));
}
$('#chBack').onclick = () => eligeSobre('todos');
$('#chRetos').onclick = () => { Snd.init(); Snd.flip(); abreRetos(); };
// «Cambiar sobre» vuelve al menú de donde vino: los de fútbol, al de fútbol
const menuDe = () => (esFutbolPack(coleccion) && hayFutbol() ? 'futbol' : 'todos');
$('#cambiaBtn').onclick = () => { if (phase === 'tienda' && !comprando) eligeSobre(menuDe()); };
$('#cambiaBtn2').onclick = () => { if (phase === 'summary' && !comprando) eligeSobre(menuDe()); };
function tienda(drop = true) {
  setPhase('tienda');
  $('#chooser').hidden = true; $('#tableView').hidden = false;
  comprados = []; pull = []; abriendo = new Set();
  rehazColeccion();
  showPack(drop);
  hint('');
  pintaCompra();
}
function newPacks(lista, drop = true) {
  coleccion = M.sobreDe(lista[0].k);   // un sobre retomado puede ser de otro tipo
  $('#chooser').hidden = true;
  comprados = lista.map(({ k, at }) => ({ k, at, dios: M.sobre(cuenta.uid, k, at).dios }));
  abriendo = new Set(); rehazColeccion();
  const antes = new Set(Object.keys(col)), vistas = new Set();
  pull = comprados.flatMap((x, s) => cardsOf(x.k, x.at, s, antes, vistas));
  abriendo = new Set(comprados.map(x => x.k)); rehazColeccion();
  try { localStorage.setItem(PENDIENTE(), comprados.map(x => x.k).join(',')); } catch {}
  preload(pull);
  setPhase('pack');
  showPack(drop);
  if (!drop) pack.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06, .95)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  hint(comprados.length > 1 ? `Desliza por la línea punteada para abrir los ${comprados.length} sobres` : 'Desliza por la línea punteada para abrir el sobre');
  pintaCompra();
}

function updateTear() {
  $('#tearCut').style.width = `${tearP * 100}%`;
  $('#tearDot').style.left = `${tearP * 100}%`;
  packTop.style.transform = tearP ? `translateY(${-tearP * 5}px) rotate(${tearP * 4.5}deg)` : '';
}
function tearSparks(n = 3) {
  const r = pack.getBoundingClientRect();
  burst(r.left + r.width * tearP, r.top + r.height * TEAR_Y / 100, { n, colors: ['#fff', '#ffe08a', '#ff9ad5'], speed: 5, spread: 2.4, angle: -Math.PI / 2, gravity: .25 });
}
pack.addEventListener('pointerdown', e => {
  if (phase === 'tienda') { avisaCompra(); return; }
  if (phase !== 'pack') return;
  Snd.init();
  tearing = true; lastX = e.clientX;
  pack.classList.add('tearing');
  pack.setPointerCapture(e.pointerId);
  setTilt(pack, pack, .35);
});
pack.addEventListener('pointermove', e => {
  if (!tearing || phase !== 'pack') return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  if (!dx || (dx < 0 && tearP <= 0)) return;
  // se puede abrir y volver a cerrar arrastrando en ambas direcciones
  const w = pack.getBoundingClientRect().width;
  tearP = Math.max(0, Math.min(1, tearP + dx / (w * .85)));
  pack.classList.toggle('started', tearP > 0);
  updateTear();
  const now = performance.now();
  if (now - lastTick > 28) {
    lastTick = now; Snd.tick();
    if (dx > 0) { tearSparks(); buzz(4); }
  }
  if (tearP >= 1) openPack();
});
const endTear = () => { if (!tearing) return; tearing = false; pack.classList.remove('tearing'); if (phase === 'pack') { setTilt(pack, pack, 1); healTear(); } };
// si se suelta a medias, el corte se vuelve a cerrar
function healTear() {
  if (tearP <= 0 || tearP >= 1) return;
  const from = tearP, t0 = performance.now(), dur = 260 + from * 420;
  Snd.noise({ d: dur / 1000, v: .05, f: 3200, to: 900, q: 1.4 });
  (function step(now) {
    if (tearing || phase !== 'pack') return; // volvió a agarrar el sobre
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    tearP = from * (1 - e); updateTear();
    if (k < 1) return requestAnimationFrame(step);
    tearP = 0; updateTear(); pack.classList.remove('started');
    Snd.land(); buzz(8);
    pack.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025, .975)' }, { transform: 'scale(.99, 1.01)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
  })(t0);
}
pack.addEventListener('pointerup', endTear);
pack.addEventListener('pointercancel', endTear);

async function autoTear() {
  if (phase !== 'pack') return;
  Snd.init(); setPhase('opening'); pack.classList.add('started');
  const start = tearP, t0 = performance.now(), dur = 650;
  await new Promise(res => {
    (function step(t) {
      const k = clamp((t - t0) / dur, 0, 1);
      tearP = start + (1 - start) * (k * k * (3 - 2 * k));
      updateTear(); tearSparks(2);
      if (t - lastTick > 40) { lastTick = t; Snd.tick(); }
      k < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  });
  openPack(true);
}

async function openPack(force) {
  if (phase !== 'pack' && !force) return;
  setPhase('opening'); tearing = false; setTilt(null, null);
  pack.style.setProperty('--rx', '0deg'); pack.style.setProperty('--ry', '0deg');
  Snd.rip(); buzz([20, 30, 40]);

  const r = pack.getBoundingClientRect(), ty = r.top + r.height * TEAR_Y / 100;
  for (let i = 0; i < 6; i++) burst(r.left + r.width * (i / 5), ty, { n: 10, colors: ['#fff', '#ffe08a', '#ff9ad5', '#9be9ff'], speed: 8, spread: 1.8, angle: -Math.PI / 2, kinds: ['spark', 'spark', 'star'] });

  const tapa = packTop.animate([
    { transform: packTop.style.transform || 'none', opacity: 1 },
    { transform: 'translate(45%, -170%) rotate(32deg)', opacity: 0 },
  ], { duration: 750, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'forwards' });
  const luz = $('#packLight').animate([{ opacity: 0, transform: 'translateY(-100%) scaleY(.2)' }, { opacity: 1, transform: 'translateY(-100%) scaleY(1)' }],
    { duration: 500, easing: 'ease-out', fill: 'forwards' });
  pack.animate([
    { transform: 'perspective(900px) scale(1)' }, { transform: 'perspective(900px) scale(1.05, .96)' }, { transform: 'perspective(900px) scale(1)' },
  ], { duration: 420, easing: 'ease-out' });
  hint('');
  abreExtras();
  await sleep(380);
  const dioses = comprados.filter(x => x.dios).length;
  if (dioses) await godPack(dioses);

  // las cartas asoman desde dentro del sobre
  const cw = els[0].getBoundingClientRect().width;
  stack.style.visibility = 'visible';
  Snd.whoosh(.1);
  await stack.animate([{ transform: `translateY(${cw * .1}px)` }, { transform: `translateY(${-cw * .5}px)` }],
    { duration: 700, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'forwards' }).finished;
  await sleep(120);

  // el sobre cae y el mazo baja al centro
  const caida = pack.animate([
    { transform: 'perspective(900px) translateY(0) rotate(0)', opacity: 1 },
    { transform: 'perspective(900px) translateY(85vh) rotate(9deg)', opacity: .6 },
  ], { duration: 650, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' });
  await stack.animate([{ transform: `translateY(${-cw * .5}px)` }, { transform: 'translateY(0)' }],
    { duration: 750, easing: 'cubic-bezier(.3,1.25,.5,1)', fill: 'forwards' }).finished;
  Snd.land();
  /* Oculto ya, la caída se cancela: si se queda «rellenando», Chrome la
     retira por su cuenta y su último fotograma queda aplicado, y el sobre
     siguiente (Abrir otro) aparecía caído, fuera de la pantalla. */
  pack.hidden = true;
  [caida, tapa, luz].forEach(a => a.cancel());

  setPhase('reveal'); setDots();
  hint('Toca la carta para darla vuelta');
  focusTop();
  stack.focus({ preventScroll: true });
}

function abreExtras() {
  for (const ex of $('#packExtras').children) {
    const r = ex.getBoundingClientRect(), lado = +ex.style.getPropertyValue('--lado') || 1;
    for (let i = 0; i < 3; i++) burst(r.left + r.width * (.2 + i * .3), r.top + r.height * TEAR_Y / 100, { n: 8, colors: ['#fff', '#ffe08a', '#ff9ad5'], speed: 7, spread: 1.8, angle: -Math.PI / 2, kinds: ['spark', 'star'] });
    const base = getComputedStyle(ex).transform, desde = base === 'none' ? '' : base;
    ex.animate([{ transform: desde || 'none', opacity: 1 }, { transform: `${desde} translate(${lado * 30}%, 70vh) rotate(${lado * 14}deg)`, opacity: 0 }],
      { duration: REDUCED ? 1 : 900, delay: 250, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' });
  }
}

/* ---------------- REVELADO ---------------- */
function restack() {
  els.slice(current).forEach((el, j) => {
    const q = Math.min(j, 4);   // con tres sobres hay quince cartas: el fondo del mazo no se aleja más
    el.style.transform = j ? `translate(${q * 3}px, ${q * 4}px) rotate(${(j % 2 ? 1.6 : -1.4) * Math.min(j, 3)}deg)` : 'none';
  });
}
function focusTop() {
  const el = els[current];
  if (el) setTilt(el.querySelector('.tilt'), el, el.revealed ? 1 : .55);
}
function setDots() {
  [...$('#dots').children].forEach((d, i) => {
    const c = pull[i], on = !!c && els[i] && els[i].revealed;   // al cambiar de sobre, `els` aún es el del anterior
    d.className = on ? 'on' : i === current && phase === 'reveal' ? 'cur' : '';
    d.style.setProperty('--c', on ? accentOf(c) : '');
  });
}
function showBanner(c) {
  const b = $('#banner'), t = TIERS[c.tier];
  b.className = `banner ${t.key}`;
  b.style.setProperty('--c', accentOf(c));
  b.querySelector('.b-tier').textContent = `${t.label.toUpperCase()} ${t.sym}`;
  b.querySelector('.b-name').textContent = c.name;
  const deSobre = comprados.length > 1 ? ` · sobre ${c._sobre + 1} de ${comprados.length}` : '';
  b.querySelector('.b-var').innerHTML = `${subtitle(c)} · N.º ${pad(c.num)}${deSobre}${c._new ? '<em>NUEVA</em>' : ''}`;
  requestAnimationFrame(() => b.classList.add('show'));
  document.body.classList.add('has-banner');
}
function hideBanner() { $('#banner').classList.remove('show'); document.body.classList.remove('has-banner'); }

function aura(on, c, legend) {
  const a = $('#aura');
  if (!on) { const op = getComputedStyle(a).opacity; a.getAnimations().forEach(x => x.cancel()); a.animate([{ opacity: op }, { opacity: 0 }], { duration: 350, fill: 'forwards' }); return; }
  const [x, y] = centerOf(els[current]);
  a.style.left = `${x}px`; a.style.top = `${y}px`;
  const pl = paletteOf(c);
  a.style.setProperty('--c', pl[0]); pl.forEach((col, i) => a.style.setProperty(`--c${i + 1}`, col));
  a.classList.toggle('legend', !!legend);
}

function shakeFrames(strength, n = 26) {
  const f = [];
  for (let i = 0; i <= n; i++) {
    const k = (i / n) ** 1.6, a = strength * k;
    f.push({ transform: `translate(${(Math.random() - .5) * a}px, ${(Math.random() - .5) * a - k * 18}px) rotate(${(Math.random() - .5) * a * .25}deg) scale(${1 + k * .07})` });
  }
  f.push({ transform: 'translate(0, -18px) scale(1.07)' });
  return f;
}

async function reveal(el) {
  busy = true;
  const c = el.card, t = c.tier, [x, y, r] = centerOf(el), pl = t >= 2 ? paletteOf(c) : [];
  setTilt(null, null);
  const tl = el.querySelector('.tilt'); tl.style.setProperty('--rx', '0deg'); tl.style.setProperty('--ry', '0deg');

  /* El suspenso y el estallido de las raras, épicas y legendarias son de
     su colección (revela.js): tiza o hiperespacio para los profes,
     osciloscopio, bobina de Tesla o cortocircuito para los componentes. */
  const an = window.REVELA && REVELA.de(c), k = { el, c, t, x, y, r, pl: t >= 2 ? pl : [accentOf(c), '#fff'] };
  if (an) await an.antes(k);

  record(c);
  Snd.flip();
  el.querySelector('.flip').classList.remove('down');
  el.revealed = true;
  light(el);

  const pop = t >= 2
    ? [{ transform: 'translate(0,-18px) scale(1.07)' }, { transform: 'translate(0,-10px) scale(1.16)', offset: .35 }, { transform: 'none' }]
    : [{ transform: 'none' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'none' }];
  el.getAnimations().forEach(a => a.cancel());
  el.animate(pop, { duration: t >= 2 ? 800 : 500, easing: 'cubic-bezier(.2,1.3,.4,1)' });

  setTimeout(() => {
    Snd.reveal(t);
    if (an) an.despues(k);
    else burst(x, y, { n: 12, colors: ['#fff', '#ffe9a8'], speed: 6, kinds: ['star'], gravity: .02 });
  }, t >= 2 ? 60 : 180);

  showBanner(c); setDots();
  hint('');
  if (t >= 2) setTimeout(() => document.body.classList.remove('dim'), 900);
  await sleep(t >= 2 ? 650 : 300);
  focusTop();
  busy = false;
}

async function dismiss(el, dir = 1) {
  busy = true;
  hideBanner(); aura(false);
  Snd.whoosh();
  setTilt(null, null);
  const from = getComputedStyle(el).transform;
  el.style.transition = 'none';
  await el.animate([
    { transform: from === 'none' ? 'none' : from },
    { transform: `translate(${dir * 115}vw, -8vh) rotate(${dir * 28}deg)` },
  ], { duration: 480, easing: 'cubic-bezier(.45,0,.85,.45)', fill: 'forwards' }).finished;
  el.remove();
  current++;
  if (current >= els.length) { busy = false; return showSummary(); }
  restack(); setDots(); focusTop();
  hint('Toca la carta para darla vuelta');
  busy = false;
}

function act() {
  if (phase !== 'reveal' || busy) return;
  const el = els[current]; if (!el) return;
  el.revealed ? dismiss(el, 1) : reveal(el);
}

// tocar = revelar / siguiente · arrastrar una carta revelada = descartarla
let drag = null;
stack.addEventListener('pointerdown', e => {
  if (phase !== 'reveal' || busy) return;
  const el = els[current]; if (!el) return;
  Snd.init();
  drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, el, moved: false };
  stack.setPointerCapture(e.pointerId);
});
stack.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y;
  if (Math.hypot(drag.dx, drag.dy) > 8) drag.moved = true;
  if (drag.el.revealed && drag.moved) {
    drag.el.style.transition = 'none';
    drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy * .25}px) rotate(${drag.dx * .06}deg)`;
  }
});
const endDrag = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.el.revealed && Math.abs(d.dx) > 80) return dismiss(d.el, Math.sign(d.dx));
  d.el.style.transition = ''; d.el.style.transform = 'none';
  if (!d.moved) act();
};
stack.addEventListener('pointerup', endDrag);
stack.addEventListener('pointercancel', () => { if (drag) { drag.el.style.transition = ''; drag.el.style.transform = 'none'; drag = null; } });

addEventListener('keydown', e => {
  if (['zoom', 'collection', 'market', 'trade', 'reroll', 'ruleta', 'retos', 'fuModal'].some(id => !$('#' + id).hidden)) {
    // en los desafíos, Escape cierra primero el modal de encima (selector, plantilla ajena, próximos retos)
    if (e.key === 'Escape' && !$('#retos').hidden && cierraModalReto()) return;
    if (e.key === 'Escape') closeOverlays();
    return;
  }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
    if (phase === 'pack' && e.target.tagName !== 'BUTTON') { e.preventDefault(); autoTear(); }
    else if (phase === 'reveal') { e.preventDefault(); act(); }
  }
});

/* ---------------- RESUMEN ---------------- */
function sumCard(c) {
  const el = makeCard(c, { back: false });
  light(el);
  if (c._new) el.insertAdjacentHTML('beforeend', '<span class="badge-new">NUEVA</span>');
  el.addEventListener('click', () => openZoom(c));
  hoverTilt(el);
  return el;
}
function showSummary() {
  setPhase('summary');
  setTilt(null, null); aura(false); hideBanner();
  $('#cambiaBtn2').textContent = `Cambiar sobre (${M.SOBRE[coleccion].label})`;
  document.body.classList.remove('dim');
  pull.forEach(record);
  abriendo = new Set(); rehazColeccion(); updateColCount();
  try { localStorage.removeItem(PENDIENTE()); } catch {}
  pintaCompra();
  $('#tableView').hidden = true; $('#summary').hidden = false;
  const n = comprados.length, box = $('#sumCards'); box.innerHTML = '';
  $('#summary').classList.toggle('multi', n > 1);
  $('#summary').dataset.n = n;
  $('#sumTitulo').textContent = `${n > 1 ? `Tus ${n} sobres` : 'Tu sobre'} · ${M.SOBRE[coleccion].label}`;
  /* Con varios sobres, una fila por sobre: se ve qué trajo cada uno. */
  const grupos = n > 1 ? comprados.map((x, s) => {
    const g = document.createElement('div'); g.className = 'sum-grupo';
    g.innerHTML = `<p class="sum-grupo-t">Sobre ${s + 1}${x.dios ? ' <b>GOD PACK</b>' : ''}</p><div class="sum-fila"></div>`;
    box.appendChild(g); return g.lastElementChild;
  }) : [box];
  pull.forEach((c, i) => {
    const el = sumCard(c);
    grupos[n > 1 ? c._sobre : 0].appendChild(el);
    el.animate([{ transform: 'translateY(70px) scale(.8) rotate(-4deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 650, delay: i * (n > 1 ? 45 : 90), easing: 'cubic-bezier(.2,1.25,.4,1)', fill: 'backwards' });
  });
  $('#summary').scrollTop = 0;
}
// tras graduar en el zoom, la carta del resumen pasa a su caja
function refreshCard(c) {
  if (phase !== 'summary') return;
  const old = [...$('#sumCards').querySelectorAll('.card')].find(e => e.card === c);
  if (old) old.replaceWith(sumCard(c));
}
$('#skipBtn').onclick = () => { if (phase === 'reveal' && !busy) showSummary(); };
$('#againBtn').onclick = () => comprar(true);
$('#againFreeBtn').onclick = () => comprar(true, true);
$('#freeBtn').onclick = () => comprar(false, true);
$('#autoBtn').onclick = () => autoTear();
$('#buyBtn').onclick = () => comprar(false);

/* ---------------- ZOOM ---------------- */
let prevTilt = null, zoomC = null, grading = false, gradeSpeed = 1;
/* La copia para la que está abierta la caja de precio. Juegos manda datos
   nuevos cada vez que cambia cualquier cosa de la economía (la compra de
   otro, un logro), y cada uno repinta el zoom: si eso cerraba la caja,
   «💰 Vender» parecía no hacer nada, porque se cerraba antes de poder
   escribir el precio. Se cierra solo si la carta cambió o ya no se vende. */
let sellPara = '';
function openZoom(c) {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  zoomC = c; sellPara = '';
  const z = $('#zoom'), box = $('#zoomCard');
  box.innerHTML = '';
  const el = makeCard(c, { back: false }); light(el);
  box.appendChild(el);
  zoomUI();
  z.hidden = false;
  setTilt(el.querySelector('.tilt'), el, 1.1);
  Snd.flip();
}
const nombreDe = u => (cuenta.gente[u] && cuenta.gente[u].n) || 'Alguien';
const ofertaDe = id => cuenta.ofertas.find(o => o.id === id);
// la más barata a la venta de esta misma carta (de otros), para orientar el precio
const masBarata = (uid, sinId) => cuenta.ofertas.filter(o => o.id !== sinId && M.CARDS[copiaDe(o).id].uid === uid)
  .reduce((m, o) => (!m || o.p < m.p ? o : m), null);
function zoomUI(recien) {
  const c = zoomC, t = TIERS[c.tier], mio = !!c._copy && !c._ajena;
  const venta = mio && c._copy.venta ? ofertaDe(c._copy.venta) : null;
  $('#zoomInfo').innerHTML = `<b>${c.name}</b> · ${subtitle(c)} · ${t.label} ${t.sym} · N.º ${pad(c.num)}/${totalDe(c)}` +
    (c.graded ? `<br><b class="zi-grade" style="--gc:${gradeColor(c.grade)}">Nota ${c.grade} · ${GRADE_WORD[c.grade]}</b>` : c.grade ? '<br>Sin graduar · su estado es un misterio' : '') +
    (venta ? `<br><span class="zi-venta">En el mercado por ${MONEDA}<b>${fmt(venta.p)}</b></span>` : '') +
    (c._ajena ? `<br><span class="zi-venta">De <b>${esc(nombreDe(c._ajena))}</b></span>` : '') +
    (mio && enDesafios(c._copy.key).length ? `<br><span class="zi-reto">🏆 En tu plantilla de ${esc(listaY(enDesafios(c._copy.key)))}</span>` : '') +
    (mio && enBorradores(c._copy.key).length ? `<br><span class="zi-reto borrador">📝 En tu borrador de ${esc(listaY(enBorradores(c._copy.key)))} (sin subir)</span>` : '');
  const gb = $('#gradeBtn');
  gb.hidden = !mio || !c.grade || c.graded || !!venta;
  gb.innerHTML = `Enviar a graduar 🔍 <span class="precio">${MONEDA}${M.PRECIO.gradua}</span>`;
  gb.disabled = cuenta.parada || cuenta.saldo < M.PRECIO.gradua;
  gb.title = gb.disabled ? `Te faltan ${M.PRECIO.gradua - cuenta.saldo} monedas` : '';
  $('#gradeSteps').hidden = true;
  // la probabilidad de algo así de bueno: se dice al graduar y queda a la vista
  const go = $('#gradeOdds');
  go.hidden = !c.graded;
  if (c.graded) {
    go.innerHTML = oddsHTML(c);
    if (recien && !REDUCED) go.animate([{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 150, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
  }
  const enSobre = mio && abriendo.has(c._copy.k) && c._copy.o === cuenta.uid && phase !== 'summary';
  // exhibir en el perfil (hasta MAX_EXH cartas)
  const sb = $('#showBtn'), key = mio && c._copy.key, puesta = !!key && cuenta.exh.includes(key);
  sb.hidden = !key || enSobre;
  sb.classList.toggle('on', puesta);
  // con las cuatro puestas no se apaga: entra en lugar de la que lleva más tiempo (el clic hace slice(-MAX_EXH))
  const llena = !puesta && cuenta.exh.length >= MAX_EXH;
  sb.innerHTML = puesta ? '★ En tu perfil' : llena ? '☆ Exhibir · reemplaza la más antigua' : '☆ Exhibir';
  sb.title = puesta ? 'Quitarla de tu perfil' : llena ? `Ya exhibes ${MAX_EXH}: esta entra en lugar de la primera que pusiste` : 'La verán todos en tu perfil de Juegos';
  sb.disabled = false;
  // vender / retirar lo propio
  const vb = $('#sellBtn');
  vb.hidden = !mio || enSobre;
  vb.innerHTML = venta ? 'Retirar del mercado' : '💰 Vender';
  vb.classList.toggle('on', !!venta);
  vb.disabled = !venta && cuenta.parada;
  if (vb.hidden || venta || vb.disabled || !key || sellPara !== key) { $('#sellBox').hidden = true; sellPara = ''; }
  // otras copias de la misma carta
  const list = copies[c.uid] || [], base = CARDS.find(x => x.uid === c.uid), cp = $('#copies');
  cp.innerHTML = list.length > 1 && mio ? `<span>Tus copias:</span>` + list.map((x, i) =>
    `<button data-i="${i}" class="${mismaCopia(x, c._copy) ? 'on' : ''}"${x.gr ? ` style="--gc:${gradeColor(x.g)}"` : ''}>${x.gr ? `<b>${x.g}</b>` : 'Sin graduar'}${x.venta ? ' 💰' : ''}</button>`).join('') : '';
  cp.querySelectorAll('button').forEach(b => b.onclick = () => {
    const x = list[+b.dataset.i]; if (grading || mismaCopia(x, c._copy)) return;
    const pc = pull.find(p => mismaCopia(p._copy, x));
    openZoom(pc || fromCopy(base, x));
  });
}
// llegaron datos nuevos con el zoom abierto: la carta pudo venderse, graduarse o cambiar de dueño
function refrescaZoom() {
  const c = zoomC;
  if (c._copy && !c._ajena) {
    const x = (copies[c.uid] || []).find(y => mismaCopia(y, c._copy));
    if (x) { c._copy = x; c.graded = !!x.gr; }
    else if (!abriendo.has(c._copy.k)) { cierraZoom(); toast('Esa carta ya no está en tu colección.'); return; }
  }
  zoomUI();
}
let zoomVuelve = '';   // 'col': a dónde vuelve el zoom al cerrarse
function cierraZoom() {
  $('#zoom').hidden = true; setTilt(null, null);
  if (zoomVuelve === 'col') { renderCollection(); $('#collection').hidden = false; $('#colGrid').scrollTop = colScroll; }
  else if (prevTilt) { setTilt(...prevTilt); prevTilt = null; }
  zoomVuelve = '';
}
function closeOverlays() {
  if (grading) return;
  if (!$('#zoom').hidden && zoomVuelve) { cierraZoom(); return; }
  zoomVuelve = '';
  if (!$('#ruleta').hidden) { if (!rl.girando) cierraRuleta(); return; }
  // la colección abierta desde los desafíos vuelve a ellos al cerrarse
  const aRetos = !$('#collection').hidden && rt.vuelve;
  $('#zoom').hidden = true; $('#collection').hidden = true; $('#reroll').hidden = true; $('#retos').hidden = true; $('#fuModal').hidden = true;
  rt.vuelve = false;
  if (aRetos) { abreRetos(); return; }
  if (prevTilt) { setTilt(...prevTilt); prevTilt = null; }
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeOverlays);
// los desafíos no se cierran tocando el fondo: un toque fallado te sacaba del editor (✕ y Escape sí)
for (const id of ['zoom', 'collection', 'reroll', 'fuModal']) $('#' + id).addEventListener('click', e => { if (e.target.id === id) closeOverlays(); });
$('#gradeBtn').onclick = () => gradeCard();

/* ---------------- VENDER ----------------
   El precio lo pone quien vende. Se le muestra la más barata de la misma
   carta en venta, como referencia; nada más. */
$('#sellBtn').onclick = async () => {
  const c = zoomC; if (!c || !c._copy || grading) return;
  if (c._copy.venta) {
    $('#sellBtn').disabled = true;
    try { const id = c._copy.venta; await Red.pide('retirar', { oferta: id }); Snd.flip(); toast('Retirada del mercado.'); quitaVenta(id); }
    catch (e) { avisoZoom(esc(e.message)); }
    $('#sellBtn').disabled = false; return;
  }
  const box = $('#sellBox'), ref = masBarata(c.uid);
  box.innerHTML = `<label>Precio de venta<span class="sell-campo">${MONEDA}<input id="sellPrecio" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${ref ? ref.p : c.tier === 3 ? 1500 : c.tier === 2 ? 300 : c.tier === 1 ? 60 : 15}"></span></label>
    ${enBorradores(c._copy.key).length ? `<p class="sell-aviso borrador">📝 Está en tu borrador de ${esc(listaY(enBorradores(c._copy.key)))} (sin subir): si se vende, esa casilla queda vacía.</p>` : ''}
    ${enDesafios(c._copy.key).length ? `<p class="sell-aviso">🏆 Está en tu plantilla de ${esc(listaY(enDesafios(c._copy.key)))}: si se vende, esa plantilla sale de la clasificación hasta que subas otra.</p>` : ''}
    <p class="sell-ref">${ref ? `La más barata a la venta: ${MONEDA}<b>${fmt(ref.p)}</b>${ref.gr ? ` (graduada, nota ${copiaDe(ref).g})` : ''}` : 'Nadie más la vende ahora: tú pones el precio.'}${c.graded ? ' · La tuya va graduada.' : ''}</p>
    <div class="sell-btns"><button class="btn primary" id="sellOk">Publicar</button><button class="btn" id="sellNo">Cancelar</button></div>`;
  box.hidden = false; sellPara = c._copy.key;
  box.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  const inp = $('#sellPrecio'); inp.focus({ preventScroll: true }); inp.select();
  $('#sellNo').onclick = () => { box.hidden = true; sellPara = ''; };
  const publica = async () => {
    const p = Math.round(+inp.value);
    if (!(p >= 1 && p <= 100000)) { inp.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); return; }
    $('#sellOk').disabled = true;
    try {
      const id = await Red.pide('vender', { c: c._copy.key, p });
      Snd.coin(); box.hidden = true; sellPara = ''; toast(`Publicada por ${fmt(p)} monedas. Ya está en el mercado.`);
      if (id) marcaVenta(c._copy.key, id, p);
    }
    catch (e) { $('#sellOk').disabled = false; box.querySelector('.sell-ref').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  };
  $('#sellOk').onclick = publica;
  inp.onkeydown = e => { if (e.key === 'Enter') publica(); e.stopPropagation(); };
};
/* Lo que se acaba de publicar o retirar se anota aquí mismo, sin esperar a
   que Juegos mande los datos nuevos: si no, durante ese rato la carta seguía
   ofreciendo «💰 Vender» y no aparecía en la tienda. Los datos que lleguen
   después mandan. */
function marcaVenta(key, id, p) {
  const x = cuenta.mias.find(y => (y.c || `${y.o}~${y.k}.${y.i}`) === key);
  if (!x) return;
  x.venta = id;
  if (!cuenta.ofertas.some(o => o.id === id))
    cuenta.ofertas.push({ c: key, o: x.o, k: x.k, i: x.i, at: x.at, gr: !!x.gr, id, u: cuenta.uid, p, t: ahora(), estado: 'activa', fin: 0, comprador: '' });
  rehazColeccion();
  if (!$('#zoom').hidden && zoomC && !grading) refrescaZoom();
}
function quitaVenta(id) {
  cuenta.ofertas = cuenta.ofertas.filter(o => o.id !== id);
  for (const x of cuenta.mias) if (x.venta === id) x.venta = '';
  rehazColeccion();
  if (!$('#zoom').hidden && zoomC && !grading) refrescaZoom();
}
/* Un aviso que aparece y se va. */
function toast(t, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : ''); el.textContent = t; document.body.appendChild(el);
  setTimeout(() => { el.classList.add('sale'); setTimeout(() => el.remove(), 400); }, 3200);
}

/* ---------------- GRADUACIÓN ----------------
   inspección (escáner + lupa por superficie, esquinas, bordes y centrado) →
   encapsulado en la caja plástica → la nota gira en la etiqueta y se fija */
const ease = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
async function gradeCard() {
  const c = zoomC;
  if (!c || !c.grade || c.graded || grading || !c._copy) return false;
  if (cuenta.saldo < M.PRECIO.gradua) { avisoZoom(`Graduar cuesta ${M.PRECIO.gradua} ${MONEDA}: te faltan ${M.PRECIO.gradua - cuenta.saldo}.`); return false; }
  grading = true; Snd.init();
  const z = $('#zoom'), box = $('#zoomCard'), el = box.querySelector('.card'), tl = el.querySelector('.tilt'), sp = REDUCED ? .3 : gradeSpeed;
  z.classList.add('grading'); $('#gradeBtn').hidden = true; $('#showBtn').hidden = true; $('#sellBtn').hidden = true; $('#sellBox').hidden = true; $('#gradeOdds').hidden = true; $('#copies').innerHTML = '';
  $('#zoomInfo').textContent = 'Pagando la graduación…';
  try { await Red.pide('graduar', { c: c._copy.key }); }
  catch (e) { grading = false; z.classList.remove('grading'); zoomUI(); avisoZoom(e.message || 'No se pudo pagar la graduación.'); return false; }
  Snd.coin();
  setTilt(null, null);
  tl.style.setProperty('--rx', '0deg'); tl.style.setProperty('--ry', '0deg'); tl.style.setProperty('--mx', '50%'); tl.style.setProperty('--my', '35%'); tl.style.setProperty('--hov', '0');
  await sleep(250);

  const steps = $('#gradeSteps');
  steps.innerHTML = ['Superficie', 'Esquinas', 'Bordes', 'Centrado'].map(x => `<span class="gs">${x}</span>`).join('');
  steps.hidden = false;
  const st = [...steps.children];
  const stepOn = i => st[i].classList.add('on');
  const stepDone = i => { st[i].classList.remove('on'); st[i].classList.add('done'); Snd.tone(1320, { d: .09, v: .04, type: 'triangle' }); };
  $('#zoomInfo').textContent = 'Inspeccionando la carta…';

  // 1 · escáner
  stepOn(0);
  const scan = document.createElement('div'); scan.className = 'scanline'; box.appendChild(scan);
  Snd.scan(1.5 * sp);
  await scan.animate([{ top: '-2%' }, { top: '99%' }, { top: '-2%' }], { duration: 1500 * sp, easing: 'ease-in-out' }).finished;
  scan.remove();

  // 2 · lupa: muestra la carta aumentada en cada punto
  const W = el.offsetWidth, H = el.offsetHeight, Z = 2.6, D = W * .38, Rr = D / 2;
  const loupe = document.createElement('div'); loupe.className = 'loupe'; loupe.style.width = loupe.style.height = `${D}px`;
  const inner = document.createElement('div');
  inner.className = el.className.replace(/\blit\b/, '') + ' loupe-in';
  inner.style.cssText = el.style.cssText + `;position:absolute;left:0;top:0;width:${W}px;height:${H}px;animation:none;transform-origin:0 0;--mx:50%;--my:50%;--hov:0`;
  inner.innerHTML = el.querySelector('.face.front').outerHTML;
  loupe.appendChild(inner); box.appendChild(loupe);
  const lp = { x: .5, y: .5 };
  const place = () => {
    loupe.style.left = `${lp.x * W}px`; loupe.style.top = `${lp.y * H}px`;
    inner.style.transform = `translate(${Rr - lp.x * W * Z}px, ${Rr - lp.y * H * Z}px) scale(${Z})`;
  };
  const go = (x, y, ms) => new Promise(res => {
    const x0 = lp.x, y0 = lp.y, t0 = performance.now();
    (function f(now) {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      lp.x = x0 + (x - x0) * e; lp.y = y0 + (y - y0) * e; place();
      if (k < 1) requestAnimationFrame(f); else { Snd.blip(); res(); }
    })(t0);
  });
  place();
  loupe.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  for (const [x, y] of [[.32, .3], [.68, .55], [.4, .78]]) { await go(x, y, 420 * sp); await sleep(140 * sp); }
  stepDone(0); stepOn(1);
  for (const [x, y] of [[.06, .045], [.94, .045], [.94, .955], [.06, .955]]) { await go(x, y, 380 * sp); await sleep(200 * sp); }
  stepDone(1); stepOn(2);
  for (const [x, y] of [[.5, .015], [.985, .5], [.5, .985], [.015, .5]]) { await go(x, y, 380 * sp); await sleep(150 * sp); }
  stepDone(2); stepOn(3);
  await go(.5, .5, 380 * sp);
  await loupe.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished;
  loupe.remove();

  // 3 · centrado: guías sobre los márgenes
  const gd = document.createElement('div'); gd.className = 'cguides'; gd.innerHTML = '<i></i><i></i>';
  box.appendChild(gd);
  Snd.tone(880, { d: .3, v: .03, type: 'sine', to: 1320 });
  await gd.animate([{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: 1000 * sp, easing: 'ease-out' }).finished;
  gd.remove();
  stepDone(3);
  await sleep(250 * sp);

  // 4 · encapsulado
  $('#zoomInfo').textContent = 'Encapsulando…';
  const back = tl.querySelector('.slab-back'), lab = tl.querySelector('.slab-label'), front = tl.querySelector('.slab-front');
  lab.style.opacity = 0; front.style.opacity = 0;
  el.classList.add('slabbing');
  Snd.whoosh(.1);
  back.animate([{ opacity: 0, transform: 'translateZ(-3px) translateY(25%) scale(1.08)' }, { opacity: 1, transform: 'translateZ(-3px)' }],
    { duration: 560 * sp, easing: 'cubic-bezier(.2,1,.3,1)' });
  await sleep(260 * sp);
  el.classList.add('slabbed'); // la carta se encoge hasta su hueco
  await sleep(700 * sp);
  front.style.opacity = '';
  await front.animate([{ opacity: 0, transform: 'translateZ(4px) translateY(-40%)' }, { opacity: 1, transform: 'translateZ(4px)' }],
    { duration: 300, easing: 'cubic-bezier(.6,0,.9,.5)' }).finished;
  Snd.clack(); buzz(25);
  el.animate([{ transform: 'translateY(6px) scale(1.012, .988)' }, { transform: 'none' }], { duration: 280, easing: 'ease-out' });
  front.classList.add('shine');
  { const [x, , r] = centerOf(el); burst(x, r.bottom - r.height * .05, { n: 18, colors: ['#fff', '#cfe8ff'], speed: 5, spread: 1.4, angle: -Math.PI / 2, kinds: ['spark'], gravity: .2 }); }
  await sleep(320 * sp);
  lab.style.opacity = '';
  lab.animate([{ opacity: 0, transform: 'translateZ(2px) translateY(-45%)' }, { opacity: 1, transform: 'translateZ(2px)' }], { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  Snd.flip();
  await sleep(500 * sp);

  // 5 · la nota gira y se fija
  $('#zoomInfo').textContent = 'Calificando…';
  const num = lab.querySelector('.g-num'), word = lab.querySelector('.g-word'), g = c.grade, n = REDUCED ? 3 : 16;
  for (let i = 0; i < n; i++) {
    let v; do v = 1 + (Math.random() * 10 | 0); while (String(v) === num.textContent);
    num.textContent = v; lab.style.setProperty('--gc', gradeColor(v));
    Snd.tone(500 + v * 70, { d: .05, v: .035, type: 'square' });
    await sleep((45 + (i / n) ** 2.4 * 260) * sp);
  }
  num.textContent = g; word.textContent = GRADE_WORD[g];
  lab.style.setProperty('--gc', gradeColor(g)); lab.classList.add(`g${g}`);
  lab.querySelector('.sl-r').animate([{ transform: 'scale(1.7)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  Snd.grade(g); buzz(g >= 9 ? [30, 40, 60] : 20);
  const lr = lab.getBoundingClientRect(), lx = lr.right - lr.width * .16, ly = lr.top + lr.height / 2, gc = gradeColor(g);
  if (g === 10) {
    flash('#ffd23d', .55, 800);
    burst(lx, ly, { n: 110, colors: ['#ffd23d', '#fff', '#ffe9a8', '#ff9ad5'], speed: 15, kinds: ['confetti', 'spark', 'star'], gravity: .2, life: .8 });
    setTimeout(() => burst(lx, ly, { n: 50, colors: ['#fff', '#ffd23d'], speed: 10, kinds: ['star'], gravity: .04 }), 280);
  } else if (g >= 8) burst(lx, ly, { n: 45, colors: [gc, '#fff'], speed: 9, kinds: ['star', 'spark'], gravity: .1 });
  else if (g >= 5) burst(lx, ly, { n: 18, colors: [gc, '#fff'], speed: 6, kinds: ['spark', 'star'], gravity: .12 });
  else burst(lx, ly, { n: 22, colors: ['#8b8798', '#5d596a', gc], speed: 3, kinds: ['spark'], gravity: .45 });

  c.graded = true;
  if (c._copy) c._copy.gr = 1;
  await sleep(400);
  el.classList.remove('slabbing'); front.classList.remove('shine');
  z.classList.remove('grading'); grading = false;
  zoomUI(true);
  setTilt(tl, el, 1.1);
  refreshCard(c);
  return true;
}
/* ---------------- COLECCIÓN ---------------- */
let colFilter = -1, colView = null;
// toca una carta: si tienes varias copias primero las ves todas; con una sola va directo al zoom
const instOf = (c, cp) => pull.find(p => mismaCopia(p._copy, cp)) || fromCopy(c, cp);
function colOpen(c) {
  const list = copies[c.uid] || [];
  if (list.length > 1) { colView = c.uid; renderCollection(); $('#colGrid').scrollTop = 0; return; }
  zoomFromCol(list[0] ? instOf(c, list[0]) : c);
}
function zoomFromCol(inst) {
  colScroll = $('#colGrid').scrollTop;
  $('#collection').hidden = true; zoomVuelve = 'col'; openZoom(inst);
}
let colScroll = 0;
function renderCopies() {
  const c = CARDS.find(x => x.uid === colView), list = [...(copies[c.uid] || [])];
  list.sort((a, b) => (b.gr - a.gr) || (a.gr ? b.g - a.g : 0));
  const gn = list.filter(x => x.gr).length;
  $('#colFilters').innerHTML = `<button class="cv-back">‹ Volver</button><span class="cv-title"><b>${c.name}</b> · ${subtitle(c)} · ${list.length} copias${gn ? ` · ${gn} graduada${gn > 1 ? 's' : ''}` : ''}</span>`;
  $('#colFilters .cv-back').onclick = () => { colView = null; renderCollection(); };
  const grid = $('#colGrid'); grid.innerHTML = ''; grid.classList.add('copies-view');
  list.forEach((cp, i) => {
    const inst = instOf(c, cp), el = makeCard(inst, { back: false, lazy: true });
    el.insertAdjacentHTML('beforeend', `<span class="count cv"${cp.gr ? ` style="--gc:${gradeColor(cp.g)}"` : ''}>${cp.gr ? `Nota <b>${cp.g}</b>` : 'Sin graduar'}</span>${cp.venta ? '<span class="cinta">💰 En venta</span>' : ''}`);
    el.addEventListener('click', () => zoomFromCol(inst));
    el.animate([{ transform: 'translateY(30px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 420, delay: i * 50, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    grid.appendChild(el);
  });
}
/* La colección se ve por colección (pestañas arriba), y dentro de cada una
   por rareza; la rejilla va en secciones, una por variante o temática, con
   las que tienes y los huecos de las que faltan. */
let colCol = '';
function renderCollection() {
  if (colView) return renderCopies();
  if (!colVisible(colCol)) colCol = colDe(coleccion);
  $('#colGrid').classList.remove('copies-view');
  const todas = M.POR_COL[colCol].map(m => CARDS[m.n]), deCol = todas.filter(c => col[c.uid]).length;
  const gn = Object.values(copies).flat().filter(cp => cp.gr && CARDS[cp.id].col === colCol).length;
  $('#colProgress').textContent = `${M.COL[colCol].label}: ${deCol} de ${todas.length} cartas descubiertas${gn ? ` · ${gn} graduada${gn > 1 ? 's' : ''}` : ''} · en total ${ownedCount()}/${TOTAL}`;
  $('#colBar').style.width = `${deCol / todas.length * 100}%`;
  $('#colTabs').innerHTML = COLS.map(co => {
    const l = M.POR_COL[co.key], n = l.filter(c => col[c.uid]).length;
    return `<button role="tab" data-col="${co.key}" aria-selected="${co.key === colCol}">${co.label}<b>${n}/${l.length}</b></button>`;
  }).join('');
  $('#colTabs').querySelectorAll('[data-col]').forEach(b => b.onclick = () => { colCol = b.dataset.col; renderCollection(); $('#colGrid').scrollTop = 0; });
  $('#retosBtn3').hidden = !M.esFutbol(colCol);
  $('#colFilters').innerHTML = [[-1, 'Todas', ''], ...TIERS.map((t, i) => [i, t.label, t.sym])]
    .map(([i, l, s]) => {
      const n = todas.filter(c => (i < 0 || c.tier === i) && col[c.uid]).length, tot = todas.filter(c => i < 0 || c.tier === i).length;
      return `<button data-f="${i}" class="${i === colFilter ? 'on' : ''}" style="--c:${i < 0 ? '#fff' : TIERS[i].color}">${s ? `<i>${s}</i>` : ''}${l} ${n}/${tot}</button>`;
    }).join('');
  $('#colFilters').querySelectorAll('button').forEach(b => b.onclick = () => { colFilter = +b.dataset.f; renderCollection(); });
  const grid = $('#colGrid'); grid.innerHTML = '';
  // de la peor rareza a la mejor; dentro, en el orden del catálogo (por variante o temática)
  const lista = todas.filter(c => colFilter < 0 || c.tier === colFilter).sort((a, b) => a.tier - b.tier || a.n - b.n);
  // las de fútbol van en secciones por rareza y, dentro, por club
  const claveSec = c => (M.esFutbol(c.col) ? c.vkey + '/' + c.club : c.vkey);
  let seccion = '';
  lista.forEach(c => {
    if (claveSec(c) !== seccion) {
      seccion = claveSec(c);
      const de = lista.filter(x => claveSec(x) === seccion), n = de.filter(x => col[x.uid]).length;
      grid.insertAdjacentHTML('beforeend', `<h3 class="col-sec" style="--c:${TIERS[c.tier].color}"><i>${TIERS[c.tier].sym}</i>${esc(M.esFutbol(c.col) ? c.sub : c.vlabel)}<small>${TIERS[c.tier].label} · ${n}/${de.length}</small></h3>`);
    }
    if (col[c.uid]) {
      const cp = bestCopy(c.uid), inst = cp ? fromCopy(c, cp) : c;
      const el = makeCard(inst, { back: false, lazy: true });
      const n = (copies[c.uid] || []).length || col[c.uid];
      if (n > 1) el.insertAdjacentHTML('beforeend', `<span class="count">×${n}</span>`);
      if ((copies[c.uid] || []).some(x => x.venta)) el.insertAdjacentHTML('beforeend', '<span class="cinta">💰 En venta</span>');
      el.addEventListener('click', () => colOpen(c));
      grid.appendChild(el);
    } else {
      grid.insertAdjacentHTML('beforeend', `<div class="slot" style="--c:${TIERS[c.tier].color}"><b>${TIERS[c.tier].sym}</b>N.º ${pad(c.num)}<small>${esc(c.name)}</small></div>`);
    }
  });
}
function openCollection() {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  colView = null; zoomVuelve = ''; colCol = colDe(coleccion);
  renderCollection();
  $('#collection').hidden = false;
}
$('#colBtn').onclick = openCollection;
$('#colBtn2').onclick = openCollection;

/* ---------------- RE-ROLL ----------------
   Diez cartas de una misma rareza por una de la siguiente, como el
   contrato de intercambio del CS2. La carta y su nota salen del motor
   (`M.reroll`), con la hora del servidor, en Juegos: aquí solo se elige
   qué entra y se cuenta lo que salió, con una ruleta que corre de derecha
   a izquierda y se detiene en ella. Las notas ocultas de lo que entra no
   se enseñan: la cuenta de la nota esperada solo se hace cuando las diez
   están graduadas. */
const NR = M.REROLL.n;
const PLURAL = ['comunes', 'raras', 'épicas', 'legendarias'], UNA = ['común', 'rara', 'épica', 'legendaria'];
const rr = { tier: 0, col: 'profes', sel: [], seguro: false, enviando: false };
const keyDe = cp => cp.key;
// las rarezas que se pueden re-rollear: todas bajo la más alta de la colección (fútbol no tiene legendarias)
const rrTiers = (co = rr.col) => [0, 1, 2].filter(i => i < M.POOL[co].tope);
// lo que se puede meter: mis copias de esa rareza y esa colección que no están a la venta
const elegibles = (t, co = rr.col) => Object.values(copies).flat().filter(cp => CARDS[cp.id].tier === t && CARDS[cp.id].col === co && !cp.venta);
/* El orden en que «Elegir automático» las toma: primero las repetidas (de
   cada carta se guarda la mejor), las sin graduar antes que las graduadas,
   y de las graduadas las de nota más baja; las exhibidas al final. */
function ordenAuto(lista) {
  const mejor = {};
  for (const cp of lista) {
    const u = CARDS[cp.id].uid, m = mejor[u];
    if (!m || (cp.gr && (!m.gr || cp.g > m.g))) mejor[u] = cp;
  }
  const peso = cp => (mejor[CARDS[cp.id].uid] === cp ? 1000 : 0) + (cuenta.exh.includes(cp.key) || enDesafios(cp.key).length || enBorradores(cp.key).length ? 500 : 0) + (cp.gr ? 100 + cp.g : 0);
  return lista.slice().sort((a, b) => peso(a) - peso(b));
}
function miniCp(cp, extra = '') {
  const c = CARDS[cp.id];
  return `<span class="mini t${c.tier}" style="--accent:${accentOf(c)}" title="${esc(c.name + ' · ' + subtitle(c) + (cp.gr ? ' · nota ' + cp.g : ' · sin graduar'))}">
    <img src="${c.img}" alt="" loading="lazy" draggable="false">${cp.gr ? `<b style="--gc:${gradeColor(cp.g)}">${cp.g}</b>` : ''}${extra}
    <small>${esc(c.name.split(' ')[0])}</small></span>`;
}
function abreReroll() {
  if (!cuenta.listo) return;
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  // abre en la colección del sobre, o en la otra si solo ahí alcanza, y en la rareza más baja que alcanza
  const alcanza = co => rrTiers(co).some(i => elegibles(i, co).length >= NR);
  const colActual = colDe(coleccion);
  rr.col = alcanza(colActual) || !COLS.some(co => alcanza(co.key)) ? colActual : COLS.find(co => alcanza(co.key)).key;
  const t = rrTiers().find(i => elegibles(i).length >= NR);
  if (!rrTiers().includes(rr.tier)) rr.tier = 0;
  if (t !== undefined && elegibles(rr.tier).length < NR) rr.tier = t;
  rr.seguro = false;
  $('#collection').hidden = true; $('#summary').hidden || 0;
  renderReroll();
  $('#reroll').hidden = false;
}
$('#rrBtn').onclick = abreReroll;
$('#rrBtn2').onclick = abreReroll;
function notaEsperadaHTML(cps) {
  if (cps.length < NR) {
    const gr = cps.filter(cp => cp.gr);
    return `La nota de la nueva sale de las diez que entran: alrededor de su promedio <b>más un punto</b>.${gr.length ? ` Tus graduadas aquí promedian <b>${(gr.reduce((t, cp) => t + cp.g, 0) / gr.length).toFixed(1).replace('.', ',')}</b>.` : ''}`;
  }
  if (!cps.every(cp => cp.gr)) return 'La nota de la nueva sale de las diez: alrededor de su promedio <b>más un punto</b>. Algunas no están graduadas, así que la cuenta exacta queda oculta, como su nota.';
  const d = M.distribucionReroll(cps.map(cp => cp.g)), max = Math.max(...d.prob);
  return `Promedio de las diez <b>${(d.centro - M.REROLL.bono).toFixed(1).replace('.', ',')}</b> → la nueva sale cerca de <b>${d.centro.toFixed(1).replace('.', ',')}</b>:
    <span class="rr-campana">${d.prob.map((p, i) => `<span title="Nota ${i + 1}: ${(p * 100).toFixed(1).replace('.', ',')} %"><i style="height:${Math.max(2, p / max * 100)}%;--gc:${gradeColor(i + 1)}"></i><small>${i + 1}</small></span>`).join('')}</span>`;
}
function renderReroll() {
  if (!rrTiers().includes(rr.tier)) rr.tier = 0;
  const t = rr.tier, sig = TIERS[t + 1], lista = ordenAuto(elegibles(t));
  rr.sel = rr.sel.filter(k => lista.some(cp => cp.key === k));
  const sel = new Set(rr.sel), cps = rr.sel.map(k => lista.find(cp => cp.key === k));
  const enRetos = [...new Set(rr.sel.flatMap(enDesafios))], enBorr = [...new Set(rr.sel.flatMap(enBorradores))];
  $('#rrSub').innerHTML = `${NR} cartas ${PLURAL[t]} de ${M.COL[rr.col].label} → 1 ${UNA[t + 1]} de ${M.COL[rr.col].label} al azar. Las diez se pierden.`;
  $('#rrCols').innerHTML = COLS.map(co => {
    const n = rrTiers(co.key).reduce((m, i) => Math.max(m, elegibles(i, co.key).length), 0);
    return `<button role="tab" data-col="${co.key}" aria-selected="${co.key === rr.col}">${co.label}<b class="rr-n${n >= NR ? ' ok' : ''}">${n >= NR ? '♻' : '·'}</b></button>`;
  }).join('');
  $('#rrCols').querySelectorAll('[data-col]').forEach(b => b.onclick = () => { rr.col = b.dataset.col; rr.sel = []; rr.seguro = false; renderReroll(); });
  $('#rrTabs').innerHTML = rrTiers().map(i => {
    const n = elegibles(i).length;
    return `<button role="tab" data-t="${i}" aria-selected="${i === t}">${TIERS[i].sym} ${TIERS[i].label} <span class="rr-flecha">→ ${TIERS[i + 1].sym}</span><b class="rr-n${n >= NR ? ' ok' : ''}">${n}</b></button>`;
  }).join('');
  $('#rrTabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { rr.tier = +b.dataset.t; rr.sel = []; rr.seguro = false; renderReroll(); });
  const P = M.POOL[rr.col], posibles = P[t + 1];
  // con pesos (Navidad sale menos), cada temática dice su probabilidad
  const pesoTxt = P.uniforme ? `(${(100 / posibles.length).toFixed(1).replace('.', ',')} % cada una)`
    : `(${[...new Set(posibles.map(c => c.vkey))].map(k => { const c = posibles.find(x => x.vkey === k); return `${c.vlabel} ${(c.peso / P.peso[t + 1] * 100).toFixed(1).replace('.', ',')} %`; }).join(' · ')} cada una)`;
  const huecos = Array.from({ length: NR }, (_, i) => cps[i] ? `<button class="rr-hueco lleno" data-quita="${esc(cps[i].key)}" title="Quitar">${miniCp(cps[i])}</button>` : `<span class="rr-hueco"></span>`).join('');
  $('#rrBody').innerHTML = `
    <div class="rr-flujo" style="--c:${TIERS[t].color};--c2:${accentOf(CARDS[posibles[0].n])}">
      <div class="rr-huecos">${huecos}</div>
      <span class="rr-a" aria-hidden="true">➜</span>
      <span class="rr-sale t${t + 1}"><b>?</b><small>${sig.sym} ${sig.label}</small></span>
    </div>
    <p class="rr-sale-p">Sale ${M.probSalida(t, P.tope).map((p, i) => p ? `<span style="--c:${TIERS[i].color}"><i>${TIERS[i].sym}</i> ${TIERS[i].label} <b>${(p * 100).toFixed(p < .01 ? 1 : p < .1 ? 1 : 0).replace('.', ',')} %</b></span>` : '').filter(Boolean).join('')}</p>
    <p class="rr-nota">${notaEsperadaHTML(cps)}</p>
    <div class="rr-acc">
      <button class="btn mk-mini" id="rrAuto"${lista.length < NR ? ' disabled' : ''}>Elegir automático</button>
      <button class="btn mk-mini" id="rrLimpia"${rr.sel.length ? '' : ' disabled'}>Quitar todas</button>
      <span class="rr-cuenta"><b>${rr.sel.length}</b>/${NR}</span>
    </div>
    ${enBorr.length ? `<p class="rr-aviso borrador">📝 Elegiste cartas de tu borrador de ${listaY(enBorr)} (sin subir): si haces el re-roll, esas casillas quedan vacías.</p>` : ''}
    ${enRetos.length ? `<p class="rr-aviso">🏆 Elegiste cartas de tu plantilla subida en ${listaY(enRetos)}: si haces el re-roll, ${enRetos.length === 1 ? 'esa plantilla sale' : 'esas plantillas salen'} de la clasificación hasta que subas otra.</p>` : ''}
    ${lista.length ? `<div class="tc-rejilla rr-rejilla">${lista.map(cp => `<button class="tc-elige${sel.has(cp.key) ? ' on' : ''}" data-c="${esc(cp.key)}">${miniCp(cp, (cuenta.exh.includes(cp.key) ? '<em class="rr-exh">★</em>' : '') + (enDesafios(cp.key).length ? `<em class="rr-plant" title="En tu plantilla de ${esc(listaY(enDesafios(cp.key)))}">🏆</em>`
      : enBorradores(cp.key).length ? `<em class="rr-plant" title="En tu borrador de ${esc(listaY(enBorradores(cp.key)))} (sin subir)">📝</em>` : ''))}</button>`).join('')}</div>`
      : `<div class="mk-vacio"><b>${TIERS[t].sym}</b><p>No tienes cartas ${PLURAL[t]} de ${M.COL[rr.col].label} libres. Abre sobres o retira del mercado las que tengas a la venta.</p></div>`}
    <details class="rr-posibles"><summary>Puede salir cualquiera de estas ${posibles.length} ${pesoTxt}</summary>
      <div class="rr-pos">${posibles.map(c => miniCp({ id: c.n, gr: 0 })).join('')}</div></details>
    <div class="tc-envio rr-envio">
      <button class="btn primary" id="rrGo"${rr.sel.length === NR && !rr.enviando ? '' : ' disabled'}>${rr.enviando ? 'Enviando…' : rr.seguro ? '¿Seguro? Toca otra vez' : `♻ Re-roll ${rr.sel.length}/${NR}`}</button>
      <button class="chip rl-rapido" id="rrRapido" aria-pressed="${rlRapido}">⚡ Rápido</button>
      <span class="mk-nota" id="rrMsg">${rr.seguro ? `Las ${NR} cartas se cambian por una ${UNA[t + 1]}. No se puede deshacer.` : lista.length < NR ? `Te faltan ${NR - lista.length} cartas ${PLURAL[t]}.` : ''}</span>
    </div>`;
  const toca = k => {
    const i = rr.sel.indexOf(k);
    if (i >= 0) rr.sel.splice(i, 1); else if (rr.sel.length < NR) rr.sel.push(k); else { Snd.blip(); return; }
    rr.seguro = false; Snd.init(); Snd.tick(); renderRerollKeep();
  };
  $('#rrBody').querySelectorAll('.tc-elige').forEach(b => b.onclick = () => toca(b.dataset.c));
  $('#rrBody').querySelectorAll('[data-quita]').forEach(b => b.onclick = () => toca(b.dataset.quita));
  $('#rrAuto').onclick = () => { rr.sel = lista.slice(0, NR).map(keyDe); rr.seguro = false; Snd.init(); Snd.flip(); renderRerollKeep(); };
  $('#rrLimpia').onclick = () => { rr.sel = []; rr.seguro = false; renderRerollKeep(); };
  $('#rrRapido').onclick = cambiaRapido; pintaRapido();
  $('#rrGo').onclick = () => {
    if (rr.sel.length !== NR || rr.enviando) return;
    if (!rr.seguro) { rr.seguro = true; renderRerollKeep(); return; }
    hazReroll();
  };
}
// repintar sin perder el desplazamiento de la rejilla
function renderRerollKeep() {
  const g = $('#rrBody .rr-rejilla'), y = g ? g.scrollTop : 0;
  renderReroll();
  const g2 = $('#rrBody .rr-rejilla'); if (g2) g2.scrollTop = y;
}
async function hazReroll() {
  const usadas = rr.sel.slice(), t = rr.tier;
  rr.enviando = true; renderRerollKeep();
  try {
    const r = await Red.pide('reroll', { c: usadas });
    const nueva = !col[CARDS[r.id].uid];
    // se anota aquí mismo; la cuenta real llega sola
    cuenta.mias = cuenta.mias.filter(x => !usadas.includes(x.c || `${x.o}~${x.k}.${x.i}`));
    cuenta.mias.push({ c: r.c, o: cuenta.uid, k: r.k, i: 0, at: r.at, gr: false, venta: '', id: r.id, g: r.g, w: r.w });
    cuenta.exh = cuenta.exh.filter(k => !usadas.includes(k));
    rehazColeccion(); updateColCount();
    rr.sel = []; rr.seguro = false; rr.enviando = false;
    $('#reroll').hidden = true;
    ruleta(r, t, nueva);
  } catch (e) {
    rr.enviando = false; rr.seguro = false; renderRerollKeep();
    $('#rrMsg').innerHTML = `<span class="err">${esc(e.message || 'No se pudo.')}</span>`;
  }
}

/* La ruleta: una tira de cartas de la rareza que sale, que corre de
   derecha a izquierda y frena hasta dejar la que tocó bajo la marca. Cada
   carta que cruza la marca hace tic, cada vez más espaciado. */
const rl = { girando: false, anim: null, raf: 0, r: null, nueva: false, t: 0, col: 'profes' };
/* Dos velocidades: la normal es larga a propósito (casi once segundos, cien
   cartas), y «⚡ Rápido» —recordado en este navegador— la deja en dos y
   medio. Apretarlo con la ruleta girando acelera esa misma tirada. */
let rlRapido = false;
try { rlRapido = localStorage.getItem('prodrop.rrRapido') === '1'; } catch {}
const RL = () => rlRapido ? { n: 42, gana: 34, dur: 2600 } : { n: 100, gana: 90, dur: 10800 };
function pintaRapido() {
  for (const b of document.querySelectorAll('#rlRapido, #rrRapido')) {
    b.setAttribute('aria-pressed', rlRapido); b.classList.toggle('on', rlRapido);
    b.title = rlRapido ? 'Re-rolls rápidos (toca para la animación larga)' : 'Animación larga (toca para re-rolls rápidos)';
  }
}
function cambiaRapido() {
  rlRapido = !rlRapido;
  try { localStorage.setItem('prodrop.rrRapido', rlRapido ? '1' : '0'); } catch {}
  if (rl.anim && rl.girando) rl.anim.updatePlaybackRate(rlRapido ? 4 : 1);
  Snd.init(); Snd.blip(); pintaRapido();
}
$('#rlRapido').onclick = cambiaRapido;
pintaRapido();
/* Una carta para la tira: casi siempre de la rareza que sale, y de vez en
   cuando de las de más arriba, que es lo que da el «casi» al pasar. */
function cartaTira(base) {
  const x = Math.random(), t = Math.min(M.POOL[rl.col].tope, base + (x < .78 ? 0 : x < .96 ? 1 : 2)), l = M.POOL[rl.col][t];
  return l[Math.floor(Math.random() * l.length)].n;
}
function ruleta(r, t, nueva) {
  const sig = t + 1, tira = $('#rlTira'), { n: RL_N, gana: RL_GANA, dur: DUR } = RL();
  rl.r = r; rl.nueva = nueva; rl.girando = true; rl.t = t; rl.col = CARDS[r.id].col;
  $('#rlTitulo').innerHTML = `${NR} ${PLURAL[t]} → <b style="color:${TIERS[sig].color}">${TIERS[sig].sym} ${TIERS[sig].label}</b>`;
  $('#rlFin').hidden = true; $('#rlFin').innerHTML = '';
  $('#rlSaltar').hidden = false;
  $('#ruleta').classList.remove('fin');
  // la tira: cartas al azar desde esa rareza, sin repetir la vecina, y la que tocó en su lugar
  const ids = [];
  for (let i = 0; i < RL_N; i++) {
    let id;
    do { id = cartaTira(sig); } while (i && id === ids[i - 1]);
    ids.push(id);
  }
  ids[RL_GANA] = r.id;
  for (const j of [RL_GANA - 1, RL_GANA + 1]) while (ids[j] === r.id) ids[j] = cartaTira(sig);
  tira.innerHTML = ids.map((id, i) => {
    const c = CARDS[id];
    return `<div class="rl-item t${c.tier}${i === RL_GANA ? ' gana' : ''}" style="--accent:${accentOf(c)}"><img src="${c.img}" alt="" draggable="false"><span>${esc(c.name)}</span></div>`;
  }).join('');
  $('#ruleta').hidden = false;
  Snd.init(); Snd.whoosh(.12);
  // medidas: el ancho de una carta con su hueco, y el centro de la ventana
  const it = tira.children[0], paso = it.getBoundingClientRect().width + parseFloat(getComputedStyle(tira).columnGap || getComputedStyle(tira).gap || 0);
  const ancho = tira.parentElement.getBoundingClientRect().width, centro = ancho / 2, w = it.getBoundingClientRect().width;
  const desvio = (Math.random() - .5) * w * .7;   // no siempre al centro exacto: así se siente que pudo ser la de al lado
  const x0 = centro - w / 2 - paso * 2, x1 = centro - (RL_GANA * paso + w / 2) - desvio;
  const dur = REDUCED ? 700 : DUR;
  rl.anim = tira.animate([{ transform: `translateX(${x0}px)` }, { transform: `translateX(${x1}px)` }],
    { duration: dur, easing: rlRapido ? 'cubic-bezier(.12,.75,.2,1)' : 'cubic-bezier(.05,.68,.1,1)', fill: 'forwards' });
  let ultimo = -1;
  const mira = () => {
    if (!rl.girando) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(tira).transform), x = m.m41;
    const idx = Math.floor((centro - x) / paso);
    if (idx !== ultimo) { if (ultimo >= 0) { Snd.tick(); buzz(3); } ultimo = idx; }
    rl.raf = requestAnimationFrame(mira);
  };
  rl.raf = requestAnimationFrame(mira);
  rl.anim.finished.then(() => finRuleta(), () => {});
}
$('#rlSaltar').onclick = () => { if (rl.anim && rl.girando) rl.anim.finish(); };
function finRuleta() {
  if (!rl.girando) return;
  rl.girando = false; cancelAnimationFrame(rl.raf);
  $('#rlSaltar').hidden = true;
  const r = rl.r, c = CARDS[r.id], t = c.tier, gana = $('#rlTira .gana'), salto = t - rl.t;
  $('#ruleta').classList.add('fin');
  const [x, y] = centerOf(gana), pl = t >= 2 ? paletteOf(c) : [accentOf(c), '#fff'];
  if (t >= 2 || salto > 1) flash(pl[0], t === 3 ? .9 : .6, t === 3 ? 1000 : 650);
  burst(x, y, { n: t === 3 ? 140 : t === 2 ? 80 : 40, colors: [...pl, '#fff', '#ffcc3d'], speed: t === 3 ? 16 : 11, kinds: ['confetti', 'spark', 'star'], gravity: .15 });
  Snd.reveal(t); buzz(t >= 2 ? [30, 60, 30, 60, 90] : [40]);
  const cp = copiaDe(cuenta.mias.find(m => m.c === r.c) || { c: r.c, o: cuenta.uid, k: r.k, i: 0, at: r.at, rr: { id: r.id, g: r.g, w: r.w } });
  const inst = fromCopy(c, cp);
  const fin = $('#rlFin');
  fin.innerHTML = `<div class="rl-carta"></div>
    <div class="rl-txt">${salto > 1 ? `<span class="rl-salto">¡SALTO! Subió ${salto === 2 ? 'dos' : 'tres'} calidades</span>` : ''}<span class="rl-tier" style="--c:${accentOf(c)}">${TIERS[t].label.toUpperCase()} ${TIERS[t].sym}</span>
      <b>${esc(c.name)}</b><small>${esc(subtitle(c))} · N.º ${pad(c.num)}${rl.nueva ? ' <em>NUEVA</em>' : ''}</small>
      <small>Su nota está oculta, como la de un sobre: gradúala para verla.</small></div>
    <div class="rl-acc"><button class="btn primary" id="rlVer">Ver carta</button><button class="btn" id="rlOtro">♻ Otro re-roll</button><button class="btn" id="rlCerrar">Listo</button></div>`;
  const el = makeCard(inst, { back: false });
  light(el); hoverTilt(el);
  fin.querySelector('.rl-carta').appendChild(el);
  fin.hidden = false;
  el.animate([{ transform: 'translateY(40px) scale(.6) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  $('#rlVer').onclick = () => { cierraRuleta(); zoomVuelve = ''; openZoom(inst); };
  $('#rlOtro').onclick = () => { cierraRuleta(); abreReroll(); };
  $('#rlCerrar').onclick = cierraRuleta;
}
function cierraRuleta() {
  if (rl.anim) { rl.anim.cancel(); rl.anim = null; }
  rl.girando = false; cancelAnimationFrame(rl.raf);
  $('#ruleta').hidden = true; $('#rlTira').innerHTML = ''; $('#rlFin').innerHTML = '';
  if (prevTilt) { setTilt(...prevTilt); prevTilt = null; }
}

/* ---------------- RED (con Juegos) ----------------
   El abridor no toca Firebase: pide a la página que lo contiene que cobre
   y escriba, y recibe de ella la cuenta (saldo, sobres, graduadas). */
const EMBEBIDO = window.parent !== window;
const MONEDA = '<svg class="moneda" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#f5b819" stroke="#9a6a08" stroke-width="1.6"/><circle cx="10" cy="10" r="5.6" fill="#ffd54a" stroke="#c98d10" stroke-width="1.2"/><path d="M8.6 7.2v5.6M11.4 7.2v5.6" stroke="#9a6a08" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MAX_EXH = 4;
const PENDIENTE = () => 'prodrop.pendiente.' + cuenta.uid;
const fmt = n => Math.round(n).toLocaleString('es-CL');
const Red = {
  n: 0, espera: new Map(),
  manda(d) { if (EMBEBIDO) parent.postMessage({ canal: 'prodrop-child', ...d }, location.origin); },
  pide(accion, datos) {
    if (!EMBEBIDO) return Promise.reject(new Error('Abre PRODROP desde Juegos para usar tus monedas.'));
    const id = ++this.n;
    return new Promise((ok, mal) => {
      const t = setTimeout(() => { this.espera.delete(id); mal(new Error('Sin respuesta: revisa tu conexión y vuelve a intentarlo.')); }, 20000);
      this.espera.set(id, { ok: x => { clearTimeout(t); ok(x); }, mal: e => { clearTimeout(t); mal(e); } });
      this.manda({ tipo: 'pide', id, accion, ...datos });
    });
  },
};
addEventListener('message', e => {
  if (!EMBEBIDO || e.source !== parent || e.origin !== location.origin || !e.data || e.data.canal !== 'prodrop-parent') return;
  const d = e.data;
  if (d.tipo === 'resp') {
    const w = Red.espera.get(d.id); if (!w) return;
    Red.espera.delete(d.id);
    d.ok ? w.ok(d.dato) : w.mal(new Error(d.error || 'No se pudo.'));
    return;
  }
  if (d.tipo === 'datos') alDatos(d);
});
function alDatos(d) {
  const primera = !cuenta.listo, antes = COLS.length;
  fijaColecciones(!!d.serie1);
  if (!packVisible(coleccion)) coleccion = PACKS[0].key;
  if (!colVisible(rr.col)) { rr.col = colDe(coleccion); rr.sel = []; }
  Object.assign(cuenta, { uid: d.uid, saldo: Math.max(0, d.saldo), parada: !!d.parada, falta: d.falta || 0,
    mias: d.mias || [], sobres: d.sobres || {}, gratis: d.gratis || 0, ofertas: d.ofertas || [], pendientes: d.pendientes || 0,
    gente: d.gente || {}, exh: d.exh || [], retos: d.retos || cuenta.retos, desfase: d.desfase || 0, listo: true });
  rehazColeccion(); updateColCount(); pintaAvisos();
  if (primera) {
    $('#cargando').hidden = true;
    let ks = []; try { ks = (localStorage.getItem(PENDIENTE()) || '').split(',').filter(Boolean); } catch {}
    // sobres comprados y sin abrir (se cerró la pestaña): se sigue con esos, sin cobrar otra vez
    const vivos = ks.filter(k => cuenta.sobres[k] && colVisible(M.coleccionDe(k))).slice(0, MAX_JUNTOS).map(k => ({ k, at: cuenta.sobres[k] }));
    if (vivos.length) newPacks(vivos);
    else eligeSobre();
    // `?abre=retos`: los desafíos de plantilla (el atajo del Salón y del menú)
    if (VER.get('abre') === 'retos') { if (!vivos.length) { coleccion = 'futbol'; tienda(); } abreRetos(); }
    return;
  }
  // cambió qué colecciones ve: se vuelve a elegir sobre si estaba eligiendo
  if (COLS.length !== antes && (phase === 'elige' || phase === 'tienda')) { eligeSobre(phase === 'elige' ? menuActual : 'todos'); return; }
  pintaCompra();
  pintaAvisos();
  if (!$('#zoom').hidden && zoomC && !grading) refrescaZoom();
  if (!$('#collection').hidden) renderCollection();
  if (!$('#retos').hidden) renderRetos();
  if (!$('#rtMercado').hidden) pintaMercadoReto();
}

/* ---------------- COMPRA ----------------
   Un sobre gratis cada 6 horas (desde el último gratis que sacaste) y los
   demás a precio. Ninguno se compra si no alcanza: el botón se apaga, y
   Juegos lo vuelve a comprobar antes de cobrar. */
const precio = () => M.precioSobre(ahora(), M.SOBRE[coleccion].mult);   // el Plus de fútbol cuesta el doble
const gratisPara = () => M.SOBRE[coleccion].mult === 1;   // el gratis es solo del sobre normal
const gratisListo = () => cuenta.listo && !cuenta.gratis && !cuenta.parada && gratisPara();
function cuentaAtras(t) {
  const m = Math.max(1, Math.ceil((t - ahora()) / 60000)), h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}
/* Cuántos sobres se abren juntos (1, 2 o 3). Se recuerda en este
   navegador. Cada uno se cobra por separado y Juegos comprueba el saldo
   antes de cada uno; si se acaba a mitad, se abren los que entraron. */
let cantidad = 1;
try { cantidad = clamp(+localStorage.getItem('prodrop.cantidad') || 1, 1, MAX_JUNTOS); } catch {}
function pintaCantidad(box, p) {
  box.innerHTML = [1, 2, 3].map(n => {
    const no = cuenta.listo && (cuenta.saldo < n * p || cuenta.parada);
    return `<button data-cant="${n}" aria-pressed="${n === cantidad}"${no && n > 1 ? ' class="corto" title="No te alcanza"' : ''}>×${n}</button>`;
  }).join('');
  box.querySelectorAll('[data-cant]').forEach(b => b.onclick = () => {
    cantidad = +b.dataset.cant; Snd.init(); Snd.blip();
    try { localStorage.setItem('prodrop.cantidad', cantidad); } catch {}
    pintaCompra();
  });
}
const sobresTxt = n => n === 1 ? 'sobre' : `${n} sobres`;
function pintaCompra() {
  const p1 = precio(), p = p1 * cantidad, falta = p - cuenta.saldo, mult = M.SOBRE[coleccion].mult, promo = p1 < M.PRECIO.normal * mult, gl = gratisListo();
  pintaCantidad($('#cant'), p1); pintaCantidad($('#cant2'), p1);
  $('#fuInfo').hidden = $('#retosBtn').hidden = $('#retosBtn2').hidden = !esFutbolPack(coleccion);
  if (phase === 'tienda') { pintaExtras(cantidad, false); pintaKicker(cantidad); }
  $('#saldo').innerHTML = `${MONEDA}<b>${cuenta.listo ? fmt(cuenta.saldo) : '…'}</b>`;
  const f = $('#freeBtn');
  f.innerHTML = !gratisPara() ? '🎁 Gratis: sobre normal' : gl ? 'Sobre gratis 🎁' : cuenta.gratis ? `🎁 Gratis en ${cuentaAtras(cuenta.gratis)}` : '🎁 Sobre gratis';
  f.disabled = !gl || comprando;
  f.classList.toggle('listo', gl);
  const b = $('#buyBtn');
  b.innerHTML = `Comprar ${sobresTxt(cantidad)} <span class="precio">${promo ? `<s>${M.PRECIO.normal * mult * cantidad}</s>` : ''}${MONEDA}${p}</span>`;
  b.disabled = !cuenta.listo || falta > 0 || comprando || cuenta.parada;
  b.classList.toggle('primary', !gl); b.classList.toggle('sec', gl);
  const fin = new Date(M.PRECIO.promoHasta - 1).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' });
  $('#buyInfo').innerHTML = !cuenta.listo ? 'Cargando tu cuenta…'
    : cuenta.parada ? `<span class="err">Una compra tuya quedó sin fondos y no vale: hasta que ganes ${fmt(cuenta.falta)} monedas más, no puedes gastar.</span>`
    : gl ? `Tu sobre gratis está listo. El siguiente, 6 horas después de abrirlo.`
    : falta > 0 ? `Te faltan <b>${fmt(falta)}</b> monedas para ${cantidad === 1 ? 'comprar uno' : `abrir ${cantidad} juntos`}. Gánalas jugando en <a href="#" data-volver>Juegos</a>.`
    : promo ? `Precio de lanzamiento hasta el ${fin} (después, ${M.PRECIO.normal * mult} cada uno). Tienes ${fmt(cuenta.saldo)}.` : `Tienes ${fmt(cuenta.saldo)} monedas.${!gratisPara() ? ' El sobre gratis es solo del normal.' : ''}`;
  const a = $('#againBtn');
  a.innerHTML = `${cantidad === 1 ? 'Abrir otro sobre' : `Abrir otros ${cantidad}`} ✳ <span class="precio">${MONEDA}${p}</span>`;
  a.disabled = falta > 0 || comprando || cuenta.parada;
  a.title = falta > 0 ? `Te faltan ${fmt(falta)} monedas` : '';
  const ag = $('#againFreeBtn');
  ag.hidden = !gl; ag.disabled = comprando;
}
/* El tip del sobre de fútbol: qué tan seguido sale cada rareza y qué media
   es cada una. Sale de los mismos pesos que el motor (los de su colección). */
function tipFutbol() {
  const P = M.poolDe(M.SOBRE[coleccion].prefijo, ahora()), w = P.w, n = P.map(l => l.length), tot = n.reduce((a, b) => a + b, 0), E = P.esperado, plus = !!P.ultima;
  const pct = x => `${(x * 100).toFixed(1).replace('.', ',').replace(',0', '')} %`;
  const porCarta = w.map(x => x / 10000);
  // la quinta: rara o mejor (normal) o, en el Plus, épica o mejor con sus propios pesos
  const alta = w[1] + w[2] + w[3], u = plus ? P.ultima[0] + P.ultima[1] : 0;
  const quinta = plus ? [0, P.ultima[0] / u, P.ultima[1] / u] : [w[1] / alta, w[2] / alta, w[3] / alta];
  const [b0, b1, b2] = M.BANDAS, cada = t => { const k = Math.round(n[t] / E[t]); return k <= 1 ? 'casi todos los sobres' : `1 de cada ${k} sobres`; };
  // una Épica o mejor en el sobre: el god pack siempre la trae; si no, alguna de las cuatro primeras o la quinta
  const pD = M.DIOS / 10000, aOMas = porCarta[2] + porCarta[3], qOMas = plus ? 1 : quinta[1] + quinta[2];
  const epica = pD + (1 - pD) * (1 - (1 - aOMas) ** 4 * (1 - qOMas));
  const quintaTxt = plus
    ? `La quinta siempre es Épica o mejor (Épica ${pct(quinta[1])} · Legendaria ${pct(quinta[2])}).`
    : `La quinta siempre es Rara o mejor (Rara ${pct(quinta[0])} · Épica ${pct(quinta[1])} · Legendaria ${pct(quinta[2])}).`;
  const leg = 1 - (1 - porCarta[3]) ** 4 * (1 - quinta[2]);   // una Legendaria en el sobre (sin contar el god pack)
  const epicaTxt = plus
    ? `<b>Todos los sobres Plus traen una Épica o mejor</b>, y una Legendaria sale en <b>1 de cada ${Math.round(1 / leg)} sobres</b> (${pct(leg)}).`
    : `Una Épica o mejor sale en <b>1 de cada ${Math.round(1 / epica)} sobres</b> (${pct(epica)}) y una Legendaria en <b>1 de cada ${Math.round(1 / leg)}</b> (${pct(leg)}).`;
  return `<p><b>Cada sobre trae 5 cartas</b> y cada jugador tiene una sola carta. ${plus ? `El <b>Plus cuesta ${M.PRECIO.normal * 2} monedas</b> (el doble): salen menos comunes y la quinta carta es mejor.` : `El <b>sobre normal cuesta ${M.PRECIO.normal} monedas</b>; el Plus, el doble.`}</p>
    <p>Su rareza sale de su <b>media</b> (la de EA SPORTS FC, arriba a la derecha de la carta):
      <b>Común</b> hasta ${b0} · <b>Rara</b> ${b0 + 1} a ${b1} · <b>Épica</b> ${b1 + 1} a ${b2} · <b>Legendaria</b> ${b2 + 1} o más.</p>
    <p>Por carta${plus ? ' (las cuatro primeras)' : ''}: <b>Común ${pct(porCarta[0])}</b> · <b>Rara ${pct(porCarta[1])}</b> · <b>Épica ${pct(porCarta[2])}</b> · <b>Legendaria ${pct(porCarta[3])}</b>.
      ${quintaTxt}</p>
    <p>${epicaTxt} El ${pct(pD)} son god packs: cinco Épicas o mejores.</p>
    <p>Hay ${tot} jugadores (de ${new Set(M.POR_COL.futbol.map(c => c.club)).size} clubes): ${n[0]} comunes, ${n[1]} raras, ${n[2]} épicas y ${n[3]} legendarias. Un jugador en concreto sale, en promedio, en <b>${cada(0)}</b> si es común, en <b>${cada(1)}</b> si es raro, en <b>${cada(2)}</b> si es épico y en <b>${cada(3)}</b> si es legendario.</p>
    <p class="fu-pronto">⚽ Próximamente, más equipos y ligas en el mismo sobre.</p>`;
}
/* Lo nuevo del sobre de fútbol, de lo más reciente a lo más viejo. */
const NOVEDADES_FUTBOL = [
  ['Octubre 2026 · Desafíos de plantilla', [
    '<b>🏆 Desafíos de plantilla</b>: arma un once en 4-3-3 con tus cartas para el reto de la semana o para el álbum de clubes, súbelo a su clasificación y cobra monedas y sobres. Entra desde el resumen del sobre, la tienda de Fútbol o la colección.',
    '«⚽ Mi plantilla» del perfil se quitó por ahora: su lugar lo toman los desafíos.'
  ]],
  ['Cartas especiales por tiempo limitado', [
    '<b>Mbappé · MVP del Clásico</b> (media <b>92</b>) y <b>Harry Kane · Balón de Oro</b> (media <b>94</b>): dos legendarias especiales, con su cinta y un marco dorado. Salen en los sobres de fútbol (el normal y el Plus) <b>por tiempo limitado</b>, y salen el triple de seguido que una legendaria común. Las que consigas son tuyas para siempre. Son el mismo jugador que su carta normal: no puedes poner las dos en tu once.',
  ]],
  ['Octubre 2026 · Más clubes de la Champions', [
    '<b>Siete clubes nuevos</b> en los sobres de fútbol: PSG, Inter, Roma, Napoli, Borussia Dortmund, Como y el Real Betis, con los jugadores de su primer equipo (cada uno con su media de EA SPORTS FC). Salen en el sobre normal y en el Plus; los sobres que ya abriste no cambian.',
    'Siguen en camino el Atlético de Madrid y el Bayern.',
  ]],
  ['Octubre 2026 · Un solo catálogo de fútbol', [
    '<b>Fútbol es una sola colección</b>: Real Madrid, Barça y el Big Six (Man United, Man City, Chelsea, Liverpool, Tottenham y Arsenal) en un mismo sobre. El Clásico y la Premier ya no son sobres aparte; los que ya abriste siguen siendo los mismos, y todas esas cartas valen igual en el <b>re-roll</b>, en <b>⚽ Mi plantilla</b> y en tu vitrina.',
    '<b>Dos sobres</b>: el <b>normal</b> (80) y el <b>Plus</b> (160). El Plus trae menos comunes y una <b>Épica o mejor asegurada</b> en la quinta carta. El sobre gratis es del normal.',
    '<b>Posiciones</b>: cada jugador juega de una o dos (Mbappé, DC o EI; Valverde, MC o LD). En ⚽ Mi plantilla la casilla se ve en verde (su puesto), amarillo (incómodo) o rojo (mal posicionado), y el buscador filtra por club, media y nombre, ordenado por media.',
    'Un jugador no puede estar dos veces en el once: si lo eliges para otra casilla, se va de donde estaba.',
  ]],
  ['Octubre 2026 · Premier y medias', [
    '<b>Nuevo sobre: Premier · Big Six</b> (Serie 04). Los jugadores del Manchester United, Manchester City, Chelsea, Liverpool, Tottenham y Arsenal, una carta cada uno. Mismo precio y mismo sobre gratis que los otros sobres.',
    '<b>La rareza sale de la media</b> del jugador (la de EA SPORTS FC, ahora visible en la carta con la etiqueta MEDIA): Común hasta 80, Rara 81 a 84, Épica 85 a 87 y Legendaria 88 o más. Por carta: Común 55 %, Rara 33 %, Épica 10 % y Legendaria 2 % en el Clásico; Común 55 %, Rara 35 %, Épica 9 % y Legendaria 1 % en la Premier (que tiene menos legendarias). Cada jugador tiene una sola carta; la media no cambia.',
    '<b>Sobres de Fútbol</b>: ahora los sobres de fútbol viven en su propio menú, con el Clásico (Real Madrid y Barça) y la Premier.',
    '<b>Media, bandera y escudo</b>: la <b>media</b> va arriba a la derecha, y abajo, juntos, la bandera de la selección (ahora una imagen, que se ve igual en cualquier computador) y el escudo del club. El dorsal ya no sale en la carta.',
    'Los jugadores de la Premier también van en <b>⚽ Mi plantilla</b>: mezcla Madrid, Barça y el Big Six en tu 4-3-3.',
  ]],
  ['Octubre 2026', [
    '<b>Nuevo sobre: Fútbol · Especial Superclásico</b> (Serie 03). Los jugadores del primer equipo del Real Madrid y del Barça. Mismo precio y mismo sobre gratis que los otros sobres.',
    '<b>Cartas de futbolista</b> con su posición, la media del jugador, la bandera de su selección, el escudo de su club y un marco del color de su rareza. Se gastan y se gradúan como las demás.',
    '<b>Re-roll de fútbol</b>: 10 comunes por una rara (a veces épica), 10 raras por una épica y 10 épicas por una legendaria.',
    '<b>⚽ Mi plantilla</b>: arma tu once ideal en 4-3-3 con los jugadores que te van saliendo. Cualquier jugador va en cualquier casilla; el selector los ordena por posición y se filtra por DEL, MED, DEF y POR.',
    '<b>Puntuación de la plantilla</b>, de 0 a 100: la rareza pone el techo (común 60, rara 80, épica 100) y el estado de la carta lo escala. Tu plantilla se ve en tu perfil.',
  ]],
];
const novedadesHTML = () => NOVEDADES_FUTBOL.map(([fecha, items]) => `<h3>${fecha}</h3><ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>`).join('')
  + '<p class="fu-pronto">⚽ Próximamente, más ligas.</p>';
function abreFuModal(titulo, html) {
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  $('#fuModalTit').textContent = titulo;
  $('#fuModalSub').textContent = M.SOBRE[coleccion].mult > 1 ? 'Sobre de Fútbol Plus · Serie 03' : 'Sobre de Fútbol · Serie 03';
  $('#fuModalTxt').innerHTML = html;
  $('#fuModal').hidden = false;
  $('#fuModal .fu-modal').scrollTop = 0;
}
$('#fuTipBtn').onclick = () => abreFuModal('Probabilidades', tipFutbol());
$('#fuNovBtn').onclick = () => abreFuModal('Novedades', novedadesHTML());
setInterval(() => { if (cuenta.listo && cuenta.gratis && ahora() >= cuenta.gratis) cuenta.gratis = 0; if (cuenta.listo) pintaCompra(); }, 20000);
let comprando = false;
async function comprar(drop, gratis) {
  if (comprando || !cuenta.listo) return;
  Snd.init();
  const n = gratis ? 1 : cantidad;
  if (gratis ? !gratisListo() : cuenta.parada || cuenta.saldo < precio() * n) { avisaCompra(); return; }
  comprando = true; pintaCompra();
  $('#buyInfo').textContent = gratis ? 'Abriendo tu sobre gratis…' : n > 1 ? `Comprando ${n} sobres…` : 'Comprando…';
  const lista = [];
  let error = null;
  /* Uno tras otro: Juegos comprueba el saldo antes de cada uno. */
  for (let i = 0; i < n; i++) {
    try {
      const r = await Red.pide(gratis ? 'gratis' : 'comprar', gratis ? { col: coleccion } : { p: precio(), col: coleccion });
      // la cuenta real llega sola; esto evita ver la vieja un instante
      if (gratis) cuenta.gratis = r.at + 6 * 3600 * 1000; else cuenta.saldo -= r.p;
      cuenta.sobres[r.k] = r.at;
      lista.push({ k: r.k, at: r.at });
      if (n > 1) $('#buyInfo').textContent = `Comprando ${n} sobres… (${lista.length} de ${n})`;
    } catch (e) { error = e; break; }
  }
  comprando = false;
  if (lista.length) {
    Snd.coin();
    newPacks(lista, drop);
    if (error) toast(`Solo entraron ${lista.length} de ${n}: ${error.message || 'no se pudo comprar el resto.'}`, true);
    return;
  }
  pintaCompra();
  $('#buyInfo').innerHTML = `<span class="err">${esc((error && error.message) || 'No se pudo comprar.')}</span>`;
  if (phase === 'summary') toast((error && error.message) || 'No se pudo comprar.', true);
}
function avisaCompra() {
  const b = phase === 'summary' ? $('#againBtn') : $('#buyBtn');
  b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380 });
  Snd.blip();
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
document.addEventListener('click', e => { const a = e.target.closest('[data-volver]'); if (a) { e.preventDefault(); Red.manda({ tipo: 'volver' }); } });

/* ---------------- GOD PACK ----------------
   2 % de los sobres: cinco épicas o mejores, como mucho una legendaria.
   Se anuncia al romper el sobre, antes de la primera carta. */
async function godPack(n = 1) {
  const g = $('#god');
  g.querySelector('b').textContent = n > 1 ? `GOD PACK ×${n}` : 'GOD PACK';
  g.hidden = false;
  Snd.god(); buzz([40, 60, 40, 60, 120]);
  flash('#ffe27a', .95, 1200);
  const [x, y] = centerOf(wrap);
  burst(x, y, { n: 160, colors: ['#ffd23d', '#fff', '#ff9ad5', '#9be9ff', '#c26bff'], speed: 18, kinds: ['confetti', 'spark', 'star'], gravity: .12, life: .9 });
  if (!REDUCED) await g.animate([
    { opacity: 0, transform: 'scale(.4) rotate(-6deg)', filter: 'blur(8px)' },
    { opacity: 1, transform: 'scale(1.08) rotate(1deg)', filter: 'blur(0)', offset: .25 },
    { opacity: 1, transform: 'scale(1)', offset: .8 },
    { opacity: 0, transform: 'scale(1.3)', filter: 'blur(4px)' },
  ], { duration: 2300, easing: 'cubic-bezier(.2,.9,.3,1)' }).finished;
  else await sleep(1200);
  g.hidden = true;
}

/* ---------------- PROBABILIDAD ----------------
   Al graduar se dice qué tan raro era sacar algo así: de esta rareza o
   mejor con esta nota o más, por carta y por sobre; y la misma carta con
   esa nota. */
const unoEn = p => p >= 1 ? 'casi todos los sobres' : p > .5 ? `1 de cada ${(1 / p).toFixed(1).replace('.', ',')}` : `1 de cada ${fmt(1 / p)}`;
const pct = p => p >= .1 ? `${(p * 100).toFixed(0)} %` : p >= .001 ? `${(p * 100).toFixed(2).replace('.', ',')} %` : `${(p * 100).toPrecision(2).replace('.', ',')} %`;
function oddsHTML(c) {
  const t = TIERS[c.tier], g = c.grade, p = M.probabilidad(c.n, g);
  const que = `${c.tier === 3 ? 'una Legendaria' : `una ${t.label}${c.tier < 3 ? ' o mejor' : ''}`}${g > 1 ? ` con nota ${g}${g < 10 ? ' o más' : ''}` : ''}`;
  const top = p.porCarta < .001 ? 'épico' : p.porCarta < .02 ? 'raro' : '';
  return `<small>¿QUÉ TAN BUENA ES?</small>
    <p>Sacar ${que}: <b>${unoEn(p.porSobre)}</b> sobres <em>(${pct(p.porCarta)} por carta)</em>.</p>
    <p class="exacta">Esta misma carta con nota ${g}${g < 10 ? ' o más' : ''}: 1 de cada <b>${fmt(1 / p.exacta)}</b> sobres.</p>
    ${top ? `<span class="sello ${top}">${top === 'épico' ? 'Un tirón histórico' : 'Muy por encima de lo normal'}</span>` : ''}`;
}

/* ---------------- EXHIBIR EN EL PERFIL ---------------- */
$('#showBtn').onclick = async () => {
  const c = zoomC; if (!c || !c._copy || grading) return;
  const key = c._copy.key, puesta = cuenta.exh.includes(key);
  const lista = puesta ? cuenta.exh.filter(x => x !== key) : [...cuenta.exh, key].slice(-MAX_EXH);
  const antes = cuenta.exh;
  cuenta.exh = lista; zoomUI(); Snd.flip();
  try { await Red.pide('exhibir', { lista }); }
  catch (e) { cuenta.exh = antes; zoomUI(); avisoZoom(e.message || 'No se pudo guardar.'); }
};
function avisoZoom(t) { $('#zoomInfo').insertAdjacentHTML('beforeend', `<br><span class="err">${t}</span>`); }

/* ---------------- MERCADO ----------------
   El mercado ya no vive aquí: es la pestaña 🏪 Mercado de Juegos, común con
   Mascotas (colabtex/src/juegos/mercado.js). El botón le pide al cartero que
   lleve allá; lo único que queda en el abridor es vender o retirar una carta
   desde su zoom. El globito del botón cuenta los intercambios que esperan
   tu respuesta. */
function pintaAvisos() {
  const n = cuenta.pendientes || 0;
  $('#mktBadge').textContent = n || '';
  $('#mktBadge').hidden = !n;
}
// con los desafíos de plantilla abiertos, el mercado se abre solo con lo de Fútbol
$('#mktBtn').onclick = () => Red.manda({ tipo: 'mercado', col: $('#retos').hidden ? '' : 'futbol' });

/* ---------------- INICIO ----------------
   Se espera a la cuenta: sin ella no se sabe el saldo ni qué cartas tienes. */
$('#volverBtn').hidden = !EMBEBIDO;
$('#volverBtn').onclick = () => Red.manda({ tipo: 'volver' });
pintaCompra();
if (!VISOR && EMBEBIDO) Red.manda({ tipo: 'listo' });
else $('#cargando').innerHTML = '<p>PRODROP se abre desde <a href="../../juegos.html#cartas">Juegos</a>: ahí están tus monedas y tu colección.</p>';

/* ---------------- LA CANCHA ----------------
   El once en 4-3-3 (M.FORMACION) de los desafíos de plantilla: delanteros
   arriba, portero abajo, con las cartas de verdad y la marca de cómo le
   queda a cada una su casilla. («Mi plantilla», la del perfil, se quitó.) */
const copiaPorClave = k => Object.values(copies).flat().find(cp => cp.key === k) || null;
const FIT_TXT = { ok: 'En su puesto', incomodo: 'Incómodo', mal: 'Mal posicionado' };
const FIT_CLASE = { ok: 'ok', incomodo: 'inc', mal: 'mal' };
// cómo le queda la casilla `i` de la formación a una copia (verde, amarillo o rojo)
const ajusteDe = (i, cp) => M.ajuste(M.FORMACION[i].pos, CARDS[cp.id].posiciones);
// `alTocar(i)` hace editable cada casilla
function pintaCancha(box, cps, alTocar, activa = -1) {
  box.innerHTML = '<i class="pl-lineas" aria-hidden="true"></i>';
  for (let f = 3; f >= 0; f--) {
    const fila = document.createElement('div');
    fila.className = 'pl-fila';
    M.FORMACION.forEach((s, i) => {
      if (s.fila !== f) return;
      const cas = document.createElement(alTocar ? 'button' : 'div');
      const aj = cps[i] ? ajusteDe(i, cps[i]) : null;
      cas.className = `pl-casilla${cps[i] ? ' llena fit-' + FIT_CLASE[aj.nivel] : ''}${i === activa ? ' activa' : ''}`;
      if (cps[i]) { const el = makeCard(fromCopy(CARDS[cps[i].id], cps[i]), { back: false }); light(el); cas.appendChild(el); }
      else cas.innerHTML = `<span class="pl-vacia">${alTocar ? '+' : ''}</span>`;
      if (aj && aj.pen) cas.insertAdjacentHTML('beforeend', `<span class="pl-pen ${FIT_CLASE[aj.nivel]}" title="${FIT_TXT[aj.nivel]}">${aj.nivel === 'mal' ? '✕' : '!'}</span>`);
      cas.insertAdjacentHTML('beforeend', `<span class="pl-pos" title="${M.PUESTO[s.pos]}">${s.pos}</span>`);
      if (alTocar) cas.onclick = () => alTocar(i);
      fila.appendChild(cas);
    });
    box.appendChild(fila);
  }
}
// el jugador de una copia (el mismo no puede estar dos veces en un once)
const jugadorDe = k => { const cp = k ? copiaPorClave(k) : null; return cp ? CARDS[cp.id].person : null; };

/* ---------------- DESAFÍOS DE PLANTILLA ----------------
   Un álbum de plantillas (una por club) y un reto por semana
   (retos.js, compartido con Juegos y la economía). Cada plantilla es un
   once en 4-3-3 con tus cartas de fútbol que cumple una condición; se sube
   a su clasificación y paga tres premios, una vez cada uno. Las cartas son
   las de siempre (makeCard: funda de graduada, holo, desgaste), y el
   borrador de cada plantilla se recuerda en este navegador hasta subirlo. */
const RT = window.ProdropRetos;
const rt = { vista: 'album', clave: '', lista: [], casilla: -1, tab: 'clasif', vuelve: false, ocupado: false };
const fichaCp = cp => cp && { id: cp.id, g: cp.g, gr: !!cp.gr };
const misFutbol = () => Object.values(copies).flat().filter(cp => M.esFutbol(CARDS[cp.id].col));
const borrador = clave => 'prodrop.reto.' + cuenta.uid + '.' + clave;
/* Los desafíos donde está la copia `k` en una plantilla que subiste y que
   sigue contando (los clubes y el reto de esta semana): el re-roll, el zoom
   y la venta lo avisan, porque sin esa carta la plantilla sale de la tabla. */
function enDesafios(k) {
  const subidas = (cuenta.retos && cuenta.retos.subidas) || {}, ms = ahora(), out = [];
  for (const [clave, filas] of Object.entries(subidas)) {
    const p = RT.plantilla(clave), mia = filas.find(f => f.u === cuenta.uid);
    if (p && mia && RT.vigente(p, ms) && mia.c.some(x => x && x.c === k)) out.push(p.titulo);
  }
  return out;
}
/* Lo mismo con los borradores sin subir de este navegador (`borrador()`
   en localStorage, de plantillas que siguen abiertas): solo donde se
   armaron, y sin contar los que ya avisa `enDesafios`. Se leen una vez por
   repintado (`borradoresCache`), porque el re-roll pregunta por cada copia. */
let borradoresCache = null;
function enBorradores(k) {
  if (!borradoresCache) {
    borradoresCache = new Map();
    const pre = 'prodrop.reto.' + cuenta.uid + '.', ms = ahora();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const lk = localStorage.key(i);
        if (!lk || !lk.startsWith(pre)) continue;
        const p = RT.plantilla(lk.slice(pre.length)), l = JSON.parse(localStorage.getItem(lk) || 'null');
        if (!p || !RT.vigente(p, ms) || !Array.isArray(l)) continue;
        for (const c of l) if (c) borradoresCache.set(c, (borradoresCache.get(c) || []).concat(p.titulo));
      }
    } catch {}
    queueMicrotask(() => { borradoresCache = null; });
  }
  const sub = enDesafios(k);
  return (borradoresCache.get(k) || []).filter(t => !sub.includes(t));
}
const listaY = l => (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0] || '');
const subidasDe = clave => ((cuenta.retos && cuenta.retos.subidas) || {})[clave] || [];
const cobrado = (clave, n) => !!(cuenta.retos && cuenta.retos.cobrados.includes(RT.claveReclamo(clave, n)));
const semanaAhora = () => RT.semanaDe(ahora());
// la clasificación de una plantilla: solo las que siguen valiendo, de más a menos puntos (empate: quien subió antes)
function tablaDe(clave) {
  return subidasDe(clave).map(f => {
    const cps = f.c.map(x => { try { return x ? copiaDe(x) : null; } catch { return null; } });
    return Object.assign({ cps, ev: RT.evalua(clave, cps.map(fichaCp)) }, f);
  }).filter(f => f.ev.valida).sort((a, b) => b.ev.puntaje - a.ev.puntaje || a.at - b.at);
}
// el marco de perfil de un club: se gana con su primer premio cobrado (perfil-tarjeta.js)
const marcoGanado = clave => RT.PREMIOS.some(pr => cobrado(clave, pr.n));
const chipMarco = p => p.tipo === 'club' ? `<span class="rt-chip${marcoGanado(p.clave) ? ' ok' : ''}" title="Marco de perfil del ${esc(p.titulo)}: viene con el primer premio">${marcoGanado(p.clave) ? '✓' : '○'} 🖼 Marco</span>` : '';
// la bandera (imagen) de un reto de selección, o su emoji
const iconoReto = (r, cls = '') => r.bandera ? `<img class="rt-icono bandera${cls}" src="flags/${r.bandera}.png" alt="">` : `<span class="rt-icono${cls}">${r.icono}</span>`;
function fichaPlantilla(clave, extra = '') {
  const p = RT.plantilla(clave), t = tablaDe(clave), yo = t.findIndex(f => f.u === cuenta.uid);
  const icono = p.tipo === 'club' ? `<img class="rt-escudo" src="escudos/${p.club}.png" alt="">` : iconoReto(p);
  const premios = RT.PREMIOS.map(pr => `<span class="rt-chip${cobrado(clave, pr.n) ? ' ok' : ''}" title="${pr.monedas} monedas y ${RT.textoSobres(pr)}">${cobrado(clave, pr.n) ? '✓' : '○'} ${MONEDA}${pr.monedas} + ${pr.sobres.length > 1 ? pr.sobres.length + '×' : ''}${pr.sobres[0] === 'futbolplus' ? '🃏Plus' : '🃏'}</span>`).join('');
  return `<button class="rt-ficha${p.tipo === 'reto' ? ' semana' : ''}" data-clave="${clave}">${icono}
    <b>${esc(p.titulo)}</b><small>${esc(p.desc)}</small>${extra}
    <span class="rt-estado">${yo >= 0 ? `<span class="rt-chip oro">${fmt(t[yo].ev.puntaje)} pts · #${yo + 1} de ${t.length}</span>` : `<span class="rt-chip">${t.length ? t.length + ' en la tabla' : 'Nadie la ha subido'}</span>`}${premios}${chipMarco(p)}</span></button>`;
}
function renderAlbum() {
  const n = semanaAhora(), clave = RT.claveReto(n), quedan = RT.finSemana(n) - ahora();
  const d = Math.floor(quedan / 864e5), h = Math.floor(quedan / 36e5) % 24;
  $('#rtTitulo').textContent = 'Desafíos de plantilla';
  $('#rtSub').textContent = 'Arma la mejor plantilla con tus cartas, súbela a la clasificación y cobra los premios.';
  $('#rtEligeCapa').hidden = true;
  $('#rtBody').innerHTML = `<div class="rt-acc"><button class="btn" data-rt-proximos>🔜 Próximos retos</button><button class="btn" data-rt-col>📚 Ver colección</button><button class="btn" data-rt-mercado>🏪 Mercado de fútbol</button><button class="link" data-rt-ayuda>¿Cómo se calcula el puntaje?</button></div>
    <h3 class="rt-h">📅 Reto de la semana</h3><div class="rt-grid">${fichaPlantilla(clave, `<em class="rt-quedan">⏳ Termina en ${d ? d + ' d ' : ''}${h} h</em>`)}</div>
    <h3 class="rt-h">⭐ Mejor plantilla</h3><div class="rt-grid">${fichaPlantilla(RT.MEJOR.clave, '<em class="rt-quedan">Siempre abierta · cualquier club y país</em>')}</div>
    <h3 class="rt-h">📘 Álbum de clubes</h3><div class="rt-grid">${RT.CLUBES.map(c => fichaPlantilla(RT.claveClub(c))).join('')}</div>`;
  $('#rtBody').querySelectorAll('[data-clave]').forEach(b => b.onclick = () => { Snd.init(); Snd.tick(); abreEditorReto(b.dataset.clave); });
}
const AYUDA_RETOS = `<p><b>Las cartas son las de tu colección</b>, con su media, su rareza y sus posiciones de siempre. Dos copias de la misma carta solo se diferencian en la nota.</p>
  <p><b>Cada carta vale</b> (media − castigo de posición) × estado. Estado: graduada, 0,80 + 0,02 × nota (nota 10 = ×1,00, nota 6 = ×0,92); sin graduar, ×0,80, porque su nota está oculta.</p>
  <p><b>Posición</b>: en uno de sus puestos juega entero; incómodo (otro puesto de su línea), −3 de media; más lejos no puede jugar.</p>
  <p><b>Puntaje</b> = la suma de las once × 10. Un punto de media son 10 puntos: con la misma nota, el Mbappé del Clásico (92) le gana al de siempre (91). Empate: gana quien la subió primero.</p>
  <p><b>Premios</b>, una vez por plantilla: ${RT.PREMIOS.map(pr => `${pr.txt.toLowerCase()}, ${MONEDA}${pr.monedas} y ${RT.textoSobres(pr)}${pr.sobres[0] === 'futbolplus' ? '' : ' de Fútbol'}`).join(' · ')}. El reto semanal solo se sube y se cobra durante su semana. En el álbum de clubes, el primer premio de cada club trae además su <b>marco de perfil</b>.</p>`;
// los retos que vienen, con el día en que empiezan (se activan solos el lunes)
function pintaProximos() {
  const n = semanaAhora(), dia = ms => new Date(ms).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#rtVerTit').textContent = '🔜 Próximos retos';
  $('#rtVerSub').textContent = 'Cada lunes empieza uno nuevo y dura toda la semana.';
  $('#rtVerCancha').innerHTML = `<div class="fu-tip"><ol class="rt-proximos">${[1, 2, 3, 4, 5, 6].map(k => {
    const r = RT.retoDeSemana(n + k);
    return `<li>${iconoReto(r)}<span><b>${esc(r.titulo)}</b><small>${esc(r.desc)}</small></span><em>${dia(RT.inicioSemana(n + k))}</em></li>`;
  }).join('')}</ol></div>`;
  $('#rtVer').hidden = false;
}
// cierra el modal que esté encima en los desafíos; false si no había ninguno
function cierraModalReto() {
  if (!$('#rtMercado').hidden) { $('#rtMercado').hidden = true; return true; }
  if (!$('#rtVer').hidden) { $('#rtVer').hidden = true; return true; }
  if (!$('#rtEligeCapa').hidden) { rt.casilla = -1; renderEditorReto(); return true; }
  return false;
}
function abreEditorReto(clave) {
  rt.vista = 'editor'; rt.clave = clave; rt.casilla = -1;
  let guardada = null;
  try { guardada = JSON.parse(localStorage.getItem(borrador(clave)) || 'null'); } catch {}
  const mia = subidasDe(clave).find(f => f.u === cuenta.uid);
  const base = Array.isArray(guardada) ? guardada : mia ? mia.c.map(x => (x ? x.c : '')) : [];
  rt.lista = M.FORMACION.map((_, i) => (base[i] && copiaPorClave(base[i]) ? base[i] : ''));
  renderRetos();
  $('#retos .rt-panel').scrollTop = 0;
}
const guardaBorrador = () => { try { localStorage.setItem(borrador(rt.clave), JSON.stringify(rt.lista)); } catch {} };
function renderEditorReto() {
  const p = RT.plantilla(rt.clave);
  if (!p) { rt.vista = 'album'; return renderAlbum(); }
  const cps = rt.lista.map(k => (k ? copiaPorClave(k) : null)), ev = RT.evalua(rt.clave, cps.map(fichaCp));
  const t = tablaDe(rt.clave), mia = t.find(f => f.u === cuenta.uid), abierto = RT.vigente(p, ahora());
  $('#rtTitulo').innerHTML = (p.tipo === 'club' ? `<img class="rt-escudo chico" src="escudos/${p.club}.png" alt=""> ` : iconoReto(p, ' chico') + ' ') + esc(p.titulo) + (p.tipo === 'reto' ? ' <small>· reto semanal</small>' : '');
  $('#rtSub').textContent = p.desc + ' Toca una casilla para poner o cambiar un jugador.';
  const tabla = t.length ? `<ol class="rt-tabla">${t.map((f, i) => `<li class="${f.u === cuenta.uid ? 'yo' : ''}" data-fila="${i}"><i>${i + 1}</i><span translate="no">${esc(nombreDe(f.u))}<small>media ${f.ev.media.toFixed(1).replace('.', ',')} · ${f.ev.graduadas}/11 graduadas</small></span><b>${fmt(f.ev.puntaje)}</b></li>`).join('')}</ol><p class="rt-nota">Toca una fila para ver esa plantilla.</p>`
    : '<p class="rt-nota">Nadie la ha subido todavía: la primera es tuya.</p>';
  const premios = RT.PREMIOS.map(pr => {
    const ya = cobrado(rt.clave, pr.n), puede = !ya && abierto && RT.premioOk(pr.n, ev);
    return `<div class="rt-premio${ya ? ' cobrado' : ''}"><span>${ya ? '✓' : puede ? '🎁' : '○'} ${esc(pr.txt)}</span>
      <b>${MONEDA}${pr.monedas} + ${RT.textoSobres(pr)}${p.tipo === 'club' && pr.n === 1 ? ' + 🖼 marco de perfil' : ''}</b>
      ${ya ? '<em>Cobrado</em>' : `<button class="btn mk-mini" data-cobra="${pr.n}"${puede && !rt.ocupado ? '' : ' disabled'}>Cobrar</button>`}</div>`;
  }).join('') + '<p class="rt-nota">Cada premio se cobra una vez por plantilla, con las once cartas que tengas puestas en ese momento.</p>'
    + (p.tipo === 'club' ? `<p class="rt-nota">🖼 Con el primer premio que cobres te llevas el <b>marco del ${esc(p.titulo)}</b> para tu foto de perfil (Perfil → ✎ Personalizar → Marco).</p>` : '');
  $('#rtBody').innerHTML = `<div class="rt-editor">
    <div class="rt-izq"><div id="rtCancha" class="pl-cancha"></div>
      <div class="rt-acc"><button class="btn mk-mini" data-rt-auto>✨ Autocompletar con lo mejor</button><button class="btn mk-mini" data-rt-vaciar>Vaciar</button><button class="btn mk-mini" data-rt-col>📚 Ver colección</button><button class="btn mk-mini" data-rt-mercado>🏪 Mercado de fútbol</button></div></div>
    <div class="rt-der">
      <div class="rt-caja"><small>Puntaje</small><b class="rt-puntos">${fmt(ev.puntaje)}</b>
        <small>${mia ? `Subida: ${fmt(mia.ev.puntaje)} (${ev.puntaje - mia.ev.puntaje >= 0 ? '+' : ''}${fmt(ev.puntaje - mia.ev.puntaje)})` : 'Aún no la subes'}</small>
        <div class="rt-stats"><span><b>${ev.media ? ev.media.toFixed(1).replace('.', ',') : '–'}</b>media</span><span><b>${ev.graduadas}/11</b>graduadas</span><span><b>${ev.enPuesto}/11</b>en su puesto</span></div>
        <ul class="rt-checks">${ev.checks.map(c => `<li class="${c.ok ? 'ok' : ''}">${esc(c.txt)}</li>`).join('')}</ul>
        <button class="btn primary" data-rt-subir${ev.valida && abierto && !rt.ocupado ? '' : ' disabled'}>${abierto ? '⬆ Subir plantilla' : 'Este reto ya terminó'}</button></div>
      <div class="rt-caja"><div class="mk-tabs" role="tablist"><button role="tab" data-rt-tab="clasif" aria-selected="${rt.tab === 'clasif'}">🏆 Clasificación</button><button role="tab" data-rt-tab="premios" aria-selected="${rt.tab === 'premios'}">🎯 Premios</button></div>
        ${rt.tab === 'clasif' ? tabla : premios}</div>
    </div></div>`;
  pintaCancha($('#rtCancha'), cps, i => { rt.casilla = rt.casilla === i ? -1 : i; Snd.init(); Snd.tick(); renderEditorReto(); }, rt.casilla);
  const b = $('#rtBody');
  b.querySelector('[data-rt-auto]').onclick = () => { rt.lista = RT.mejorOnce(rt.clave, misFutbol()).map(cp => (cp ? cp.key : '')); rt.casilla = -1; guardaBorrador(); Snd.flip(); renderEditorReto(); };
  b.querySelector('[data-rt-vaciar]').onclick = () => { rt.lista = M.FORMACION.map(() => ''); rt.casilla = -1; guardaBorrador(); renderEditorReto(); };
  b.querySelector('[data-rt-subir]').onclick = () => accionReto('subeReto');
  b.querySelectorAll('[data-rt-tab]').forEach(x => x.onclick = () => { rt.tab = x.dataset.rtTab; renderEditorReto(); });
  b.querySelectorAll('[data-cobra]').forEach(x => x.onclick = () => accionReto('cobraReto', +x.dataset.cobra));
  b.querySelectorAll('[data-fila]').forEach(x => x.onclick = () => verPlantillaDe(t[+x.dataset.fila], +x.dataset.fila + 1));
  pintaEligeReto();
}
/* El selector, en un modal sobre la cancha (abajo obligaba a bajar cada
   vez): una copia por carta (la puesta o la mejor graduada), solo las que
   cumplen la plantilla y pueden jugar en la casilla; primero las de su
   puesto, después las incómodas, y dentro de mayor a menor media. */
function pintaEligeReto() {
  const box = $('#rtElige'), capa = $('#rtEligeCapa');
  capa.hidden = rt.casilla < 0;
  if (capa.hidden) return;
  const p = RT.plantilla(rt.clave), slot = M.FORMACION[rt.casilla], usadas = new Map();
  rt.lista.forEach((k, j) => { const q = jugadorDe(k); if (q && j !== rt.casilla) usadas.set(q, j); });
  const unica = new Map();
  for (const cp of misFutbol()) {
    const c = CARDS[cp.id];
    if (!p.elegible(c) || RT.encaje(rt.casilla, cp.id).nivel > 1) continue;
    const vista = unica.get(c.uid), puesta = rt.lista.includes(cp.key);
    if (!vista || (puesta && !rt.lista.includes(vista.key)) || (!rt.lista.includes(vista.key) && RT.puntosFicha(fichaCp(cp)) > RT.puntosFicha(fichaCp(vista)))) unica.set(c.uid, cp);
  }
  const lista = [...unica.values()].sort((a, b) => RT.encaje(rt.casilla, a.id).nivel - RT.encaje(rt.casilla, b.id).nivel
    || CARDS[b.id].media - CARDS[a.id].media || RT.puntosFicha(fichaCp(b), rt.casilla) - RT.puntosFicha(fichaCp(a), rt.casilla));
  let grupo = -1;
  box.innerHTML = `<div class="pl-elige-head"><b>${M.PUESTO[slot.pos][0].toUpperCase() + M.PUESTO[slot.pos].slice(1)} · elige un jugador</b>
      <button class="btn mk-mini" data-rt-mk-puesto>🏪 Buscar en el mercado</button>${rt.lista[rt.casilla] ? '<button class="btn mk-mini" data-quitar>Quitar de la casilla</button>' : ''}<button class="close" data-cancelar aria-label="Cerrar">✕</button></div>
    <div class="tc-rejilla pl-lista">${lista.length ? lista.map(cp => {
      const c = CARDS[cp.id], en = RT.encaje(rt.casilla, cp.id), ya = usadas.get(c.person), aca = rt.lista[rt.casilla] === cp.key;
      const cab = en.nivel !== grupo ? `<h4 class="rt-grupo n${en.nivel}">${en.nivel ? `Incómodos en ${slot.pos} · −${en.pen} de media` : `De ${slot.pos}`}</h4>` : '';
      grupo = en.nivel;
      const nota = aca ? '<em class="pl-aca">AQUÍ</em>' : ya !== undefined ? `<em class="pl-aca mueve" title="Ya está en el once: pasa a esta casilla">↔ ${M.FORMACION[ya].pos}</em>` : '';
      return `${cab}<button class="tc-elige fit-${en.nivel ? 'inc' : 'ok'}" data-c="${esc(cp.key)}" title="${esc(c.name)} · ${fmt(RT.puntosFicha(fichaCp(cp), rt.casilla) * 10)} pts aquí">${miniCp(cp, `<i class="pl-med">${c.media}</i><i class="pl-tag">${c.posiciones.join('/')}</i>${nota}`)}</button>`;
    }).join('') : `<p class="mk-vacio">No tienes jugadores que cumplan «${esc(p.titulo)}» y puedan jugar de ${slot.pos}: abre sobres de Fútbol.</p>`}</div>`;
  const q = box.querySelector('[data-quitar]'); if (q) q.onclick = () => ponReto('');
  box.querySelector('[data-cancelar]').onclick = () => { rt.casilla = -1; renderEditorReto(); };
  box.querySelector('[data-rt-mk-puesto]').onclick = () => abreMercadoReto();
  box.querySelectorAll('[data-c]').forEach(x => x.onclick = () => ponReto(x.dataset.c));
}
function ponReto(k) {
  const quien = jugadorDe(k);
  if (quien) rt.lista.forEach((x, j) => { if (j !== rt.casilla && jugadorDe(x) === quien) rt.lista[j] = ''; });
  rt.lista[rt.casilla] = k; rt.casilla = -1; guardaBorrador(); Snd.flip(); renderEditorReto();
}
async function accionReto(accion, n) {
  if (rt.ocupado) return;
  rt.ocupado = true; renderEditorReto();
  try {
    const r = await Red.pide(accion, { clave: rt.clave, lista: rt.lista, n });
    if (accion === 'subeReto') { Snd.coin(); toast(`Plantilla subida: ${fmt(r.puntaje)} puntos.`); }
    else {
      const p = RT.plantilla(rt.clave), marco = p && p.tipo === 'club' && !marcoGanado(rt.clave);
      Snd.coin(); cuenta.retos.cobrados.push(RT.claveReclamo(rt.clave, n));
      toast(`¡Premio cobrado! +${r.monedas} monedas y ${r.sobres}${marco ? `, y el marco del ${p.titulo} para tu perfil` : ''}.`);
      // los sobres del premio se abren al tiro, juntos, como unos comprados
      if (r.ks && r.ks.length) { rt.ocupado = false; rt.casilla = -1; closeOverlays(); newPacks(r.ks.map(k => ({ k, at: r.at }))); return; }
    }
  } catch (e) { toast(e.message || 'No se pudo.', true); }
  rt.ocupado = false;
  if (!$('#retos').hidden) renderEditorReto();
}
function verPlantillaDe(f, pos) {
  $('#rtVerTit').innerHTML = `#${pos} · <span translate="no">${esc(nombreDe(f.u))}</span> · ${fmt(f.ev.puntaje)} pts`;
  $('#rtVerSub').textContent = `Media ${f.ev.media.toFixed(1).replace('.', ',')} · ${f.ev.graduadas}/11 graduadas · subida ${new Date(f.at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  pintaCancha($('#rtVerCancha'), f.cps, null, -1);
  $('#rtVer').hidden = false;
}
/* ---------- el mercado de fútbol, sin salir del desafío ----------
   Las cartas de fútbol a la venta (las `ofertas` que ya manda el cartero),
   de mayor a menor media. En el editor, de entrada solo las que cumplen
   la plantilla; con una casilla elegida, solo las que pueden jugar ahí.
   Comprar pide confirmar (un segundo toque) y lo hace el cartero, con las
   mismas comprobaciones que la pestaña 🏪 Mercado de Juegos. */
const rmk = { sirve: true, puesto: true, seguro: '', comprando: '' };
function abreMercadoReto() {
  rmk.sirve = true; rmk.puesto = true; rmk.seguro = '';
  Snd.init(); Snd.tick(); pintaMercadoReto();
  $('#rtMercado').hidden = false;
  $('#rtMercado .rt-ver-caja').scrollTop = 0;
}
function pintaMercadoReto() {
  const p = rt.vista === 'editor' ? RT.plantilla(rt.clave) : null, i = p ? rt.casilla : -1;
  // también las tuyas, marcadas «Tu oferta» (sin ellas parecía que tu carta no estaba a la venta)
  const todas = cuenta.ofertas.filter(o => o.estado === 'activa').map(o => {
    let cp = null; try { cp = copiaDe(o); } catch {}
    return cp && CARDS[cp.id] && M.esFutbol(CARDS[cp.id].col) ? { o, cp, c: CARDS[cp.id] } : null;
  }).filter(Boolean);
  const lista = todas.filter(x => (!p || !rmk.sirve || p.elegible(x.c)) && (i < 0 || !rmk.puesto || RT.encaje(i, x.cp.id).nivel < 2))
    .sort((a, b) => b.c.media - a.c.media || a.o.p - b.o.p);
  const puesto = i >= 0 ? M.PUESTO[M.FORMACION[i].pos] : '';
  $('#rtMkTit').textContent = i >= 0 ? `🏪 Mercado · ${puesto[0].toUpperCase() + puesto.slice(1)}` : '🏪 Mercado de fútbol';
  const chips = (p ? `<button class="chip" data-rmk="sirve" aria-pressed="${rmk.sirve}">Solo «${esc(p.titulo)}»</button>` : '')
    + (i >= 0 ? `<button class="chip" data-rmk="puesto" aria-pressed="${rmk.puesto}">Solo los que juegan de ${M.FORMACION[i].pos}</button>` : '');
  $('#rtMkBody').innerHTML = `<p class="rt-nota">Saldo: ${MONEDA}<b>${fmt(cuenta.saldo)}</b> · ${lista.length} de ${todas.length} cartas de fútbol a la venta</p>
    ${chips ? `<div class="rt-acc">${chips}</div>` : ''}
    ${lista.length ? `<div class="rt-mk-lista">${lista.map(({ o, cp, c }) => {
      const tuya = o.u === cuenta.uid, falta = cuenta.parada || cuenta.saldo < o.p, en = i >= 0 ? RT.encaje(i, cp.id) : null, seguro = rmk.seguro === o.id;
      return `<div class="rt-mk-item">${miniCp(cp, `<i class="pl-med">${c.media}</i><i class="pl-tag">${c.posiciones.join('/')}</i>`)}
        <span class="rt-mk-tx"><b>${esc(c.name)}</b><small>${esc(M.CLUBES[c.club] || '')}${en && en.nivel ? ` · incómodo, −${en.pen}` : ''}</small>
          <small>${tuya ? '<b class="rt-mk-tuya">Tu oferta</b>' : `de <span translate="no">${esc(nombreDe(o.u))}</span>`}${cp.gr ? ` · nota ${cp.g}` : ' · sin graduar'}</small>
          ${tuya ? `<span class="rt-mk-precio">${MONEDA}${fmt(o.p)}</span>` : `<button class="btn mk-mini${seguro ? ' primary' : ''}" data-rmk-compra="${esc(o.id)}"${falta || rmk.comprando ? ' disabled' : ''} title="${falta ? 'No te alcanza' : ''}">${rmk.comprando === o.id ? 'Comprando…' : seguro ? `¿Seguro? Comprar por ${MONEDA}${fmt(o.p)}` : `Comprar ${MONEDA}${fmt(o.p)}`}</button>`}</span></div>`;
    }).join('')}</div>` : `<p class="mk-vacio">${todas.length ? 'Nadie vende una carta que cumpla eso: prueba quitando un filtro.' : 'Ahora nadie vende cartas de fútbol.'}</p>`}
    <p class="rt-nota"><button class="link" data-rmk-todo>Abrir el mercado completo ↗</button> (sales de PRODROP)</p>`;
  const b = $('#rtMkBody');
  b.querySelectorAll('[data-rmk]').forEach(x => x.onclick = () => { rmk[x.dataset.rmk] = !rmk[x.dataset.rmk]; rmk.seguro = ''; Snd.tick(); pintaMercadoReto(); });
  b.querySelector('[data-rmk-todo]').onclick = () => Red.manda({ tipo: 'mercado', col: 'futbol' });
  b.querySelectorAll('[data-rmk-compra]').forEach(x => x.onclick = () => compraMercadoReto(x.dataset.rmkCompra));
}
async function compraMercadoReto(id) {
  if (rmk.comprando) return;
  if (rmk.seguro !== id) { rmk.seguro = id; Snd.tick(); return pintaMercadoReto(); }
  rmk.comprando = id; rmk.seguro = ''; pintaMercadoReto();
  try {
    // `oferta`, no `id`: `id` es el del mensaje (Red.pide) y lo pisaba
    await Red.pide('compraOferta', { oferta: id });
    Snd.coin(); toast('¡Comprada! Ya está en tu colección.');
    cuenta.ofertas = cuenta.ofertas.filter(o => o.id !== id);
  } catch (e) { toast(e.message || 'No se pudo comprar.', true); }
  rmk.comprando = '';
  if (!$('#rtMercado').hidden) pintaMercadoReto();
}
function renderRetos() {
  if (!cuenta.retos) { $('#rtBody').innerHTML = '<p class="mk-vacio">Cargando los desafíos…</p>'; return; }
  $('#rtVolver').hidden = rt.vista === 'album';
  rt.vista === 'album' ? renderAlbum() : renderEditorReto();
}
// la ayuda y «Ver colección», en el álbum y en el editor (que se repinta solo)
$('#rtBody').addEventListener('click', e => {
  if (e.target.closest('[data-rt-proximos]')) pintaProximos();
  if (e.target.closest('[data-rt-mercado]')) abreMercadoReto();
  if (e.target.closest('[data-rt-ayuda]')) { $('#rtVerTit').textContent = '¿Cómo se calcula?'; $('#rtVerSub').textContent = ''; $('#rtVerCancha').innerHTML = `<div class="fu-tip">${AYUDA_RETOS}</div>`; $('#rtVer').hidden = false; }
  if (e.target.closest('[data-rt-col]')) {
    $('#retos').hidden = true; rt.vuelve = true;
    colView = null; zoomVuelve = ''; colCol = 'futbol'; renderCollection(); $('#collection').hidden = false;
  }
});
function abreRetos(clave) {
  if (!cuenta.listo) return;
  prevTilt = prevTilt || [tilt.target, tilt.box, tilt.amp];
  setTilt(null, null);
  rt.casilla = -1;
  if (clave) return abreEditorReto(clave), void ($('#retos').hidden = false);
  renderRetos();
  $('#retos').hidden = false;
}
$('#rtVolver').onclick = () => { rt.vista = 'album'; rt.casilla = -1; Snd.tick(); renderRetos(); };
$('#rtVerCerrar').onclick = () => { $('#rtVer').hidden = true; };
$('#rtVer').addEventListener('click', e => { if (e.target.id === 'rtVer') $('#rtVer').hidden = true; });
$('#rtMercado').addEventListener('click', e => { if (e.target.id === 'rtMercado' || e.target.closest('[data-rt-mk-cierra]')) $('#rtMercado').hidden = true; });
$('#rtEligeCapa').addEventListener('click', e => { if (e.target.id === 'rtEligeCapa') { rt.casilla = -1; renderEditorReto(); } });
$('#retosBtn').onclick = () => abreRetos();
$('#retosBtn2').onclick = () => abreRetos();
$('#retosBtn3').onclick = () => { $('#collection').hidden = true; rt.vuelve = false; abreRetos(); };

/* ---------------- VISOR ----------------
   `index.html?ver=1&o=&k=&i=&at=&gr=1[&rr=id.g.w]`: el detalle del mercado
   de Juegos muestra la carta tal como se ve aquí (holo, aura de partículas,
   desgaste, funda de graduada), sola y sobre fondo transparente. No habla
   con el cartero ni suena. Todo lo de la URL es público, como la economía:
   la nota de una sin graduar solo se adivina por el desgaste, igual que aquí. */
function montaVisorCarta() {
  const n = k => Number(VER.get(k)), rr = (VER.get('rr') || '').split('.').map(Number);
  let cp = null;
  try {
    cp = copiaDe({ o: VER.get('o') || '', k: VER.get('k') || '', i: n('i') || 0, at: n('at'), gr: VER.get('gr') === '1',
      rr: rr.length === 3 && rr.every(Number.isFinite) ? { id: rr[0], g: rr[1], w: rr[2] } : null });
  } catch { cp = null; }
  if (!cp || !CARDS[cp.id]) return;
  const el = makeCard(fromCopy(CARDS[cp.id], cp), { back: false });
  light(el);
  $('#visor').appendChild(el);
  $('#visor').hidden = false;
  setTilt(el.querySelector('.tilt'), document.body, 1.1);
}

if (VISOR) montaVisorCarta();
