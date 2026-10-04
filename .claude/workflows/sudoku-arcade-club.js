export const meta = {
  name: 'sudoku-arcade-club',
  description: 'Investiga cómo funcionan los sudokus, mapea el Club de Juegos y construye Sudoku Arcade (motor, pantalla, música, integración) con verificación final',
  phases: [
    { title: 'Investigar', detail: 'internet (reglas, generación, dificultad) + mapa del código' },
    { title: 'Construir', detail: 'motor+tests, pantalla arcade, música, integración en Juegos (archivos disjuntos)' },
    { title: 'Verificar', detail: 'tests, build, prueba en navegador y arreglos' },
  ],
}

const CONTRATO = `
CONTRATO COMÚN (todas las piezas deben respetarlo al pie de la letra):

- Juego del Solo Club llamado "sudoku". Carpeta: juegos/club/sudoku/ (archivos planos, sin build, como juegos/club/sopa/ y juegos/club/electro/).
  Archivos: motor.js (UMD, global window.SudokuMotor y module.exports para Node), game.js (la pantalla), index.html.
- Ruta dentro de Juegos: #solo/sudoku. Nombre visible: "Sudoku Arcade". Icono: "🔢". Color de marca: "#ff2fb4" (rosa neón) con acento cian "#22e6ff".
- Idioma: español en UI, comentarios e identificadores (como el resto de Juegos).
- PREFERENCIA DEL USUARIO: el código debe ir MUY comentado — un comentario breve en casi cada línea o bloque pequeño explicando qué hace, y al inicio de cada archivo un resumen de qué hace globalmente y por qué está hecho así. Explicaciones simples.

MODOS Y CATEGORÍAS DE RANKING (Club.category / Club.result):
  1. "diario": un sudoku igual para todos, depende SOLO de la fecha de Chile (America/Santiago, como diaChile de la sopa), dificultad "medio". Racha de días seguidos.
     Categoría "club-sudoku-racha": puntos = días de racha (<=1000), tiempo = ms de ese día. Se envía al completar el diario.
  2. "clasico": sudoku al azar, el jugador elige dificultad facil|medio|dificil|experto. Sin vidas, con notas. Ranking por tiempo.
     Categoría "club-sudoku-<dif>" con puntos = 1 FIJO (como Mina Club) y tiempo = ms. Gana el menor tiempo.
  3. "arcade": modo puntuación. 3 vidas (cada número equivocado resta una vida, se marca en rojo y no se coloca), combo que sube con aciertos seguidos y se rompe con un error, bonus por completar fila/columna/caja, bonus de tiempo al terminar. Dificultad "medio" fija. Si pierdes las 3 vidas termina la partida y igual se envía la puntuación si es >=1.
     Categoría "club-sudoku-arcade": puntos = puntuación entera (1..1000000), tiempo = ms.
  Regex canónica de categorías: /^club-sudoku-(racha|arcade|facil|medio|dificil|experto)$/

API DE motor.js (window.SudokuMotor / module.exports), todas puras y deterministas:
  DIFICULTADES: {facil:{nombre:"Fácil",pistas:[36,40]}, medio:{...}, dificil:{...}, experto:{...}} (rangos de pistas orientativos)
  mulberry32(semilla) -> rng()   ; hashTexto(str) -> uint32
  diaChile(fecha?) -> "AAAA-MM-DD" ; diaAnterior("AAAA-MM-DD") -> "AAAA-MM-DD"
  resolver(tablero81, limite=2) -> {soluciones:n, solucion:array81|null}   (tablero = array de 81 enteros 0..9, 0 = vacío)
  esValido(tablero81) -> bool (sin repetidos en filas/columnas/cajas)
  califica(tablero81) -> {dificultad:"facil"|"medio"|"dificil"|"experto"|"imposible", tecnicas:[...]} usando un resolvedor "humano" por técnicas (singles desnudos, singles ocultos, pares/tríos desnudos, intersecciones apuntadoras, X-wing...)
  generar({dificultad, rng}) -> {pistas:array81, solucion:array81, dificultad} con SOLUCIÓN ÚNICA garantizada; debe tardar < 1.5 s en Node para "experto" (usar tope de intentos y quedarse con el mejor candidato si no se alcanza exactamente).
  sudokuDiario(fecha) -> {fecha, pistas, solucion, dificultad:"medio"}  (semilla = hashTexto("sudoku:"+fecha))
  candidatos(tablero81, i) -> array de números posibles en la celda i
  conflictos(tablero81) -> Set/array de índices en conflicto
  unidadesCompletas(tablero81, i) -> {fila:bool, columna:bool, caja:bool}
  puntosArcade({combo, unidades, ...}) -> puntos de una jugada ; bonoTiempo(ms, dificultad) -> puntos
  limpiaRacha(x) / rachaVisible(racha, hoy) / registraDiaria(racha, fecha) / mezclaRacha(a, b)  — mismo comportamiento que la Sopa (juegos/club/sopa/motor.js): racha = {ult:"AAAA-MM-DD", n, mejor}.

PANTALLA: carga ../conexion.css, ../conexion.js, ../../audio/chip.js, ../../audio/temas.js, motor.js, game.js. Música = tema "sudoku" de window.Temas.temas.sudoku tocado con new Chip.Reproductor(ctx, destino, tema) (igual que juegos/club/snake/game.js y minas/game.js). Botón de sonido con id "sound-button" dentro de un ".scorebar" (conexion.js lo mueve). Layout ".shell" > ".layout" > main + aside (conexion.js pone el ranking en el aside). Respeta data-tema claro/oscuro que manda conexion.js.
MÚSICA: tema "sudoku" en juegos/audio/temas.js: arcade chiptune, tonalidad y tempo propios distintos de los existentes (p. ej. Mi mayor/Si menor ~ 128-136 bpm), con capas que pueden entrar con ajustarMusica/capas como el de minas. Además efectos cortos sintetizados en game.js (colocar número, error, completar unidad, combo, victoria).
`

const ESQ_INVEST = {
  type: 'object',
  properties: {
    resumen: { type: 'string' },
    reglas: { type: 'array', items: { type: 'string' } },
    generacion: { type: 'array', items: { type: 'string' } },
    dificultad_y_tecnicas: { type: 'array', items: { type: 'object', properties: { tecnica: { type: 'string' }, explicacion: { type: 'string' }, nivel: { type: 'string' } }, required: ['tecnica', 'explicacion', 'nivel'] } },
    ux_buenas_practicas: { type: 'array', items: { type: 'string' } },
    ideas_arcade: { type: 'array', items: { type: 'string' } },
    fuentes: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, url: { type: 'string' } }, required: ['titulo', 'url'] } },
  },
  required: ['resumen', 'reglas', 'generacion', 'dificultad_y_tecnicas', 'ux_buenas_practicas', 'ideas_arcade', 'fuentes'],
}

const ESQ_MAPA = {
  type: 'object',
  properties: {
    puntos_de_integracion: { type: 'array', items: { type: 'object', properties: { archivo: { type: 'string' }, que_hay_que_agregar: { type: 'string' } }, required: ['archivo', 'que_hay_que_agregar'] } },
    estilo: { type: 'string' },
    musica: { type: 'string' },
    tests: { type: 'string' },
    riesgos: { type: 'array', items: { type: 'string' } },
  },
  required: ['puntos_de_integracion', 'estilo', 'musica', 'tests', 'riesgos'],
}

const ESQ_PIEZA = {
  type: 'object',
  properties: {
    archivos: { type: 'array', items: { type: 'string' } },
    resumen: { type: 'string' },
    comprobaciones: { type: 'string' },
    pendientes: { type: 'array', items: { type: 'string' } },
  },
  required: ['archivos', 'resumen', 'comprobaciones', 'pendientes'],
}

phase('Investigar')
const [invest, mapa] = await parallel([
  () => agent(`Investiga EN INTERNET (usa WebSearch y WebFetch; cárgalas con ToolSearch "select:WebSearch,WebFetch") cómo funcionan los sudokus, para construir un juego. Cubre:
1) Reglas exactas del sudoku clásico 9x9 (filas, columnas, cajas 3x3, pistas, solución única).
2) Cómo se GENERAN sudokus con solución única: llenar una cuadrícula completa por backtracking aleatorio, quitar pistas comprobando unicidad con un resolvedor que cuenta hasta 2 soluciones, simetría rotacional, mínimo de 17 pistas (resultado McGuire 2012), algoritmos (backtracking, Dancing Links / Algorithm X).
3) Cómo se CALIFICA la dificultad: por técnicas humanas necesarias (naked/hidden singles, naked pairs/triples, pointing pairs / box-line reduction, X-Wing, Swordfish, XY-Wing...), no por número de pistas; escalas como SE (Sudoku Explainer) y la de Hodoku.
4) Buenas prácticas de UX de apps de sudoku (notas/lápiz, resaltar fila/columna/caja y números iguales, deshacer, errores, teclado y móvil).
5) Ideas para un modo ARCADE (vidas, combos, bonus, contrarreloj) vistas en juegos existentes.
Devuelve todo en español, conciso pero concreto, con las URLs reales que consultaste.`, { label: 'investigar:internet', phase: 'Investigar', schema: ESQ_INVEST }),
  () => agent(`Estás en el repo /home/user/Paginita-Pro. Hay que agregar un juego nuevo del Solo Club llamado "sudoku" (ver contrato abajo). NO edites nada: solo lee y mapea.
Usa como modelo cómo se integraron "sopa" y "electro" (grep -rn "electro\\|sopa" en colabtex/src, firebase/, juegos.html, juegos/club/conexion.js, colabtex/tests, CLAUDE.md, colabtex/package.json).
Devuelve: (a) la lista COMPLETA de puntos de integración con archivo y qué agregar exactamente (constantes, regex, arrays, tablas de nombres, NIVEL/RECORD/PAGO_CLUB/JUEGOS_CLUB de monedas.js, logros.js con 10 logros, marcos campeones en perfil-tarjeta.js y su dibujo en marcos-animados.js, ranks.js EXTRA y filas, logros-vista.js, monedas-vista.js, discord.js, reglas.js + reglas-ejemplos.js, juegos-main.js (ICONO_TODOS, CLUBES, ruta, barra, mapa categorías, tarjeta sp-entrada), fb-juegos.js regex, solo/club.js (título, alto, ?v=club-N), solo/club-datos.js, juegos/club/conexion.js (formato de marca por tiempo), firebase/database.rules.json (soloRanks y clubJugadas), firebase/CONFIGURAR-FIREBASE.md, juegos.html (.sp-e-<juego>), tests que fijan listas (logros.test, monedas.test, tienda.test, club.test, solo.test...), CLAUDE.md);
(b) el estilo visual de las páginas del club (variables CSS, tema claro/oscuro, fuentes usadas p. ej. Press Start 2P en bbtan);
(c) cómo funciona la música (juegos/audio/chip.js Reproductor y formato de un tema en temas.js, y tests/temas.test.cjs);
(d) cómo se escriben los tests (.cjs con node:test) y cuáles hay que actualizar;
(e) riesgos.
${CONTRATO}`, { label: 'investigar:codigo', phase: 'Investigar', schema: ESQ_MAPA }),
])

const CONTEXTO = `
INVESTIGACIÓN WEB (resumen):
${JSON.stringify(invest || {}, null, 1).slice(0, 9000)}

MAPA DEL CÓDIGO:
${JSON.stringify(mapa || {}, null, 1).slice(0, 12000)}

${CONTRATO}

Reglas de trabajo: trabajas en /home/user/Paginita-Pro en paralelo con otros agentes que editan OTROS archivos. Edita SOLO los archivos que se te asignan. No hagas git commit ni push. No corras "npm run build" (lo hace la verificación final). Prueba lo tuyo con node.`

phase('Construir')
const piezas = await parallel([
  () => agent(`Construye el MOTOR del Sudoku: juegos/club/sudoku/motor.js (UMD, exactamente la API del contrato) y su test colabtex/tests/sudoku.test.cjs (node:test; agrega el archivo al script "test:juegos" de colabtex/package.json).
El test debe comprobar: que generar() da solución única en cada dificultad y que califica() devuelve la dificultad pedida (o lo más cercano, documentado); que el diario es idéntico para la misma fecha y distinto entre fechas; diaChile con husos; resolver() cuenta 0/1/2 soluciones; conflictos(); la racha (hoy, ayer, día saltado, mezcla de dos dispositivos); puntosArcade/bonoTiempo; y que la regex/categorías del contrato pasan por categoriaClub/resultadoClub de colabtex/src/juegos/solo/club-datos.js (cárgalo con vm como hace tests/sopa.test.cjs; esa parte del test fallará hasta que el agente de integración lo agregue — está bien).
Rendimiento: medir con node que generar experto tarde < 1.5 s.
Archivos tuyos: juegos/club/sudoku/motor.js, colabtex/tests/sudoku.test.cjs, colabtex/package.json (solo la línea test:juegos).
${CONTEXTO}`, { label: 'construir:motor', phase: 'Construir', schema: ESQ_PIEZA }),
  () => agent(`Construye la PANTALLA del Sudoku Arcade: juegos/club/sudoku/index.html y juegos/club/sudoku/game.js.
Estética arcade/retro coherente con el sitio: tipografía pixel "Press Start 2P" de Google Fonts para títulos/marcador (texto de celdas en fuente legible y tabular), neón rosa #ff2fb4 y cian #22e6ff sobre fondo oscuro tipo CRT con scanlines suaves (CSS), marcos con esquinas "pixel", pero RESPETANDO el patrón del club (mira juegos/club/sopa/index.html, juegos/club/electro/index.html y juegos/club/bbtan/index.html): .shell > .layout > main + aside, variables CSS, tema claro/oscuro vía data-tema (en claro una versión clara legible), [hidden]{display:none!important}, focus visible, prefers-reduced-motion.
Funciones: pestañas de modo (Diario / Clásico / Arcade), selector de dificultad en Clásico, tablero 9x9 con cajas marcadas, selección de celda, resaltado de fila/columna/caja y de números iguales, teclado numérico en pantalla y teclado físico (1-9, flechas, Supr/Backspace, N para notas), modo notas (lápiz), deshacer, borrar, pista opcional en Clásico (penaliza tiempo +30 s), contador de números restantes, cronómetro, en Arcade: vidas ♥♥♥, combo xN, puntuación, animaciones al completar fila/columna/caja (respetando reduced-motion), pantalla de victoria/derrota con botón "Otra vez".
Persistencia: progreso del diario y racha en localStorage con Club.storageKey; racha también a la cuenta con Club.guardarPartida / Club.pedirPartida mezclando con mezclaRacha (copia el patrón de juegos/club/sopa/game.js). Ranking: Club.category(...) al cambiar de modo/dificultad y Club.result({categoria, puntos, tiempo}) al terminar, según el contrato.
Audio: tema "sudoku" de Temas con Chip.Reproductor (crea el AudioContext al primer gesto), botón id="sound-button" en .scorebar (persistir silencio en localStorage), efectos sintetizados cortos (colocar, error, unidad completa, combo, victoria, derrota). Acelera la música en Arcade al quedar 1 vida o pocas celdas, usando el mecanismo de tempo del Reproductor si existe (lee juegos/audio/chip.js).
Usa versiones ?v=sudoku-1 en tus <script>/<link> propios y las mismas versiones que la sopa para conexion.js/css; incluye i18n.js como las otras páginas del club (<script src="../../../i18n.js?v=..."> justo después de meta charset). Marca translate="no" lo que no se debe traducir (números del tablero).
Si motor.js todavía no existe cuando pruebes, escribe contra la API del contrato; al final, si ya existe, pruébalo con playwright (Chromium en /opt/pw-browsers, servidor: cd colabtex && npm start en segundo plano, puerto 8123) abriendo http://localhost:8123/juegos/club/sudoku/index.html y revisa la consola.
Archivos tuyos: juegos/club/sudoku/index.html, juegos/club/sudoku/game.js.
${CONTEXTO}`, { label: 'construir:pantalla', phase: 'Construir', schema: ESQ_PIEZA }),
  () => agent(`Compón la MÚSICA del Sudoku: agrega el tema "sudoku" a juegos/audio/temas.js (en el cancionero y en la cabecera de comentarios que lista los temas), arcade chiptune, tonalidad y tempo propios, melodía ORIGINAL, con secciones de compases enteros y capas que puedan crecer (mira cómo está hecho "minas" y "bbtan"). Asegúrate de que colabtex/tests/temas.test.cjs pase (node --test tests/temas.test.cjs desde colabtex/). Si el reproductor de la cabecera (colabtex/src/juegos/sonido.js: CANCIONES/GRUPOS) lista los temas de cada juego, agrega "sudoku" ahí también con el nombre "Sudoku Arcade" — esa es la única edición permitida en colabtex/src.
Archivos tuyos: juegos/audio/temas.js, colabtex/src/juegos/sonido.js (solo la entrada de la canción).
${CONTEXTO}`, { label: 'construir:musica', phase: 'Construir', schema: ESQ_PIEZA }),
  () => agent(`Haz la INTEGRACIÓN del Sudoku en Juegos: todos los puntos de integración del mapa EXCEPTO juegos/club/sudoku/*, juegos/audio/temas.js, colabtex/src/juegos/sonido.js, colabtex/tests/sudoku.test.cjs y la línea test:juegos de package.json (de eso se encargan otros agentes).
Incluye: colabtex/src/juegos/solo/club-datos.js (categoriaClub + resultadoClub: racha <=1000, clásico puntos===1, arcade <=1000000), solo/club.js (título del iframe "Sudoku Arcade", alto ~900px, sube ?v=club-N en uno), juegos/club/conexion.js (club-sudoku-<dif> se muestra por tiempo, racha en días, arcade en puntos), juegos-main.js (ICONO_TODOS, CLUBES, ruta #solo/sudoku, barra de navegación del club, mapa de categorías, y una tarjeta .sp-entrada "SUDOKU ARCADE" con texto corto), juegos.html (.sp-e-sudoku arcade neón en el mismo estilo que .sp-e-electro), fb-juegos.js, ranks.js (EXTRA + filas: modo Racha/Arcade/Clásico y dificultad), logros.js (10 logros con sus deMarca/s), logros-vista.js, monedas.js (NIVEL con 10 dígitos que encajen con los logros, RECORD, PAGO_CLUB, JUEGOS_CLUB, extraRecord para racha si aplica), monedas-vista.js, perfil-tarjeta.js (marco campeón "tsudoku" y NOMBRES_EXTRA, porTiempo, formato de marca), marcos-animados.js (dibujo del marco tsudoku: una mini cuadrícula 3x3 neón animada), discord.js, reglas.js (manual del Sudoku: reglas, modos, Arcade, racha, controles) y reglas-ejemplos.js (ejemplos visuales si el juego tiene entrada ahí; revisa tests/reglas-visuales.test.cjs), firebase/database.rules.json (regex de soloRanks y de clubJugadas) y firebase/CONFIGURAR-FIREBASE.md (nota de republicar reglas), los tests que fijan listas (logros, monedas, tienda, club, solo, discord, seguridad...) y una sección breve en CLAUDE.md describiendo Sudoku Arcade como las de Sopa/Electrodle (en inglés, como el resto de CLAUDE.md).
Corre los tests afectados con node --test desde colabtex/ (sin build) y arregla lo tuyo.
${CONTEXTO}`, { label: 'construir:integracion', phase: 'Construir', schema: ESQ_PIEZA }),
])

phase('Verificar')
const verif = await agent(`Eres el verificador final del Sudoku Arcade en /home/user/Paginita-Pro. Otros agentes acaban de construir:
${JSON.stringify(piezas, null, 1).slice(0, 8000)}
${CONTRATO}
Haz, arreglando lo que falle (mínimo y en el estilo del archivo):
1) cd colabtex && npm install si falta node_modules; node --test tests/sudoku.test.cjs tests/temas.test.cjs y luego npm run test:juegos completo (y cualquier test .cjs que toque sudoku/club/logros/monedas/tienda/discord/seguridad/solo aunque no esté en test:juegos). Todo debe pasar; si algo falla también en git stash (base), dilo y no lo toques.
2) Coherencia del contrato: misma regex de categorías en club-datos.js, fb-juegos.js, database.rules.json (soloRanks y clubJugadas), conexion.js, ranks.js, discord.js, perfil-tarjeta.js; motor.js expone toda la API que usa game.js (grep cada M.xxx de game.js).
3) npm run build (regenera juegos-app.js y estampa versiones). Debe terminar sin error.
4) Prueba real en navegador con playwright (Chromium en /opt/pw-browsers, executablePath '/opt/pw-browsers/chromium' si hace falta; levanta npm start en segundo plano en el puerto 8123): abre http://localhost:8123/juegos/club/sudoku/index.html, sin errores en consola; juega: selecciona una celda vacía y escribe el número correcto de la solución (léelo con window.SudokuMotor y el estado expuesto, o resolviendo el tablero visible), prueba notas, deshacer, un error en Arcade (pierde vida), completa un tablero entero en Clásico fácil llenando la solución y comprueba que aparece la victoria. Haz capturas en modo oscuro y claro, ancho escritorio y 390 px de móvil, y guárdalas en /tmp/claude-0/-home-user-Paginita-Pro/6177e0de-8706-5f76-ba08-c519d9f73eab/scratchpad/sudoku-*.png. Abre también http://localhost:8123/juegos.html y comprueba que el bundle carga sin errores de JS (sin sesión basta con que no haya excepciones).
5) Revisa adversarialmente el diff (git diff y archivos nuevos): bugs, regex inconsistentes, textos rotos, comentarios faltantes (el usuario quiere el código muy comentado).
No hagas commit ni push. Devuelve qué verificaste, qué arreglaste, resultados de tests, rutas de capturas y lo que quede pendiente (p. ej. republicar reglas de Firebase).`, { label: 'verificar:todo', phase: 'Verificar', schema: {
  type: 'object',
  properties: {
    tests: { type: 'string' },
    build: { type: 'string' },
    navegador: { type: 'string' },
    arreglos: { type: 'array', items: { type: 'string' } },
    capturas: { type: 'array', items: { type: 'string' } },
    pendientes: { type: 'array', items: { type: 'string' } },
  },
  required: ['tests', 'build', 'navegador', 'arreglos', 'capturas', 'pendientes'],
} })

return { invest, mapa, piezas, verif }
