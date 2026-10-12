# Pokelike — notes for Claude

Roguelike de Pokémon (Gen 1) inspirado en pokelike.xyz. Plan y estado en
`ROADMAP.md`. Es un juego del **Solo Club** (`#solo/pokelike`, iframe de
`solo/club.js`): manda `Club.result` a dos tablas, `club-pokelike-puntos`
(`M.puntaje`) y `club-pokelike-pokedex` (`M.atrapados`: especies distintas
de la run), con una prueba que `solo/verifica/pokelike.js` rehace con este
mismo motor (ver `docs/antitrampas/pokelike.md`). Logros, monedas, ranking,
Salón y manual siguen la lista de `docs/claude/juegos/crear-un-juego.md`.

- **Registro de cambios obligatorio** (`NOVEDADES` en `novedades.js`). Todo
  cambio al juego (jugabilidad, balance, interfaz, arreglos) se anota en
  lenguaje de jugador, no detalles de código. Mientras la versión siga
  abierta (hoy **v0.1**), lo nuevo se agrega a la lista `cambios` de su
  entrada (la primera), se pone su `fecha` al día del cambio (AAAA-MM-DD) y,
  si no está, se suma a `autores` el usuario de GitHub de quien hace el
  cambio (`git config user.name` o el autor de los commits; nunca «Claude»).
  Una entrada nueva (v0.2, …) va **al principio** solo cuando el dueño del
  juego cierra la versión. Si lo nuevo estaba en `PROXIMAMENTE`, se saca de
  esa lista. La ventana se abre sola a quien no vio la combinación versión +
  fecha más nueva, así que cada cambio anotado lo ven todos.
- **Pokédex** (`pokedex.js`, UMD, `PokelikeDex`): dura entre partidas en
  `localStorage` (`pokelike.dex`) y, con sesión, en `pokedex/<uid>` de
  Firebase. Forma `{d, medallas, liga}`: `d` son 151 caracteres `0`/`1`/`2`
  (sin ver / visto / capturado). Todo solo crece, así que sincronizar es
  `mezclar` (máximo por campo) dentro de una transacción. `juego.js` marca
  visto al rival que sale y a la oferta de captura, y capturado al equipo
  en cada `guardaRun`. Las runs `debug` no cuentan. **Excepción a «el juego
  no toca Firebase»**: como Pokelike aún no vive dentro de Juegos, el puente
  es `nube.js`, empaquetado desde `colabtex/src/juegos/pokelike-nube.js` con
  `npm run build:pokelike` (usa `src/firebase.js` y la misma sesión del
  sitio). Al integrarlo (Fase 2) pasa a un cartero de la página. La regla
  `pokedex` de `firebase/database.rules.json` hay que publicarla a mano.
- **`medallas.js`** (`PokelikeMedallas`): solo presentación. `DIALOGOS` por
  nombre de jefe (`antes`: líneas antes de pelear, que se saltan tocando la
  pantalla; `despues`: lo que dice el líder al dar la medalla) y `svg(i)`,
  las 8 medallas dibujadas a mano en SVG (no son los sprites oficiales).
  Un jefe nuevo en `TRAMOS` sin entrada en `DIALOGOS` pelea sin diálogo.
- **`iconos.js`** (`PokelikeIconos`): íconos SVG propios del mapa (captura,
  salvaje, entrenador, centro, inicio, gimnasio, ojo). En el mapa se anidan
  como `<svg>` dentro del nodo; los estilos del nodo van con `> circle` para
  no pintar los círculos de los íconos. El nodo de un líder dibuja su medalla
  (`MED.cuerpo`) y los de la Liga la cara del entrenador (`<image>` recortada).
- **Salón de la Fama** (`pokelike.fama` en `localStorage`, hasta 30): al
  ganar la Liga, `guardaFama` anota `{at, inicial, seg, debug, equipo}` con el
  equipo que venció al Campeón. Cuando exista la clasificación del Club
  (Fase 2), cada fila del ranking debe llevar ese mismo `equipo`.
- **Ruta Infinita y puntaje** (motor): tras ganar la Liga, `empezarInfinito`
  abre pisos sin fin (`generarMapaInfinito`: entrenadores y capturas mitad y
  mitad, más centros; el centro de la última capa lleva al piso siguiente;
  las capturas, `ofertaInfinita`, son cualquier especie 1–149 sin evolucionar
  y `INF_CAPTURA_BAJO` (15) niveles bajo los rivales). La dificultad
  (`dificultad(run)`) sube cada `INF_CADA` (3) victorias: rivales
  `INF_NIVEL` (75) + `INF_SUBE` (4) por nivel, equipos de 3 a 6 (`POOL_INFINITO`: formas
  finales fuertes; Mew/Mewtwo desde la 5) y menos `torpeza`. `puntaje(run)` =
  100 × medalla + 150 × Alto Mando (`ligaVencidos`) + 500 Campeón (`campeon`)
  + lo de la Ruta Infinita (50 + 10 × dificultad por victoria). Ganar la Liga
  da 1900 a todos; la Ruta Infinita desempata. Al ganar la Liga, la pantalla
  hace el desfile del Salón de la Fama (`paseoFama`) antes del resumen.
- **Tu entrenador** (`pokelike.perfil` = `{genero: 'h'|'m'}`): se elige en la
  primera «Nueva partida» (Rojo o Hoja, sprites `red-gen3` / `leaf-gen3` de
  Showdown, estilo Rojo Fuego / Verde Hoja). `nombreYo()` es el apodo de
  Juegos (`users/<uid>/perfil/nick`, que trae `nube.js`) o «Entrenador/a».
  `lanzaBola` anima la entrada al combate (entrenador + pokébola + destello);
  `empiezaCombate` sube `gen` para que un combate nuevo corte al anterior.
- **Club y antitrampas**: la pantalla usa las versiones registradas de las
  acciones del motor (`M.entrar`, `M.pasoCombate`, `M.capturar`…), que dejan
  un token por decisión en `run.log`; `M.rehace(nonce, u, inicial, log)` la
  vuelve a jugar. La cuenta (`Club.storageKey`) entra en la semilla y la run
  se guarda por cuenta (`pokelike.run.cuenta.<uid>`). Los dos relojes del
  tiempo jugado (`run.relA`/`relW`) solo corren con la pestaña a la vista.
  `enviaClub` manda al llegar a la pantalla de fin. **Toda acción nueva que
  cambie la run tiene que pasar por `acciones` y tener su token**, o las
  runs dejarán de rehacerse. Dentro del iframe nada puede medir el alto de
  la ventana (`100vh`/`dvh`): conexion.js le dice a la página su alto y el
  iframe crecería sin fin (ver el final de `estilo.css`).
- **Archivos planos, sin build** (salvo `nube.js`). Orden de carga (`index.html`):
  `especies.js` → `datos.js` → `motor.js` → `medallas.js` → `iconos.js` → `pokedex.js` → `sonido.js` → `juego.js` → `novedades.js` → `nube.js` (diferido) (ventana de
  novedades con pestañas Aviso / Cambios / Próximamente; independiente del motor).
  `especies.js` es **generado** por `colabtex/scripts/pokelike-datos.cjs`
  desde PokeAPI (no editar a mano); `datos.js` son las tablas a mano (tipos,
  movimientos, cobertura, y `TRAMOS`: los 8 gimnasios + la Liga, cada uno
  con zonas, rarezas, clases de entrenador y jefes).
- **Una run son 9 mapas** (`run.tramo` 0–8). Ganar un líder ⇒ fase
  `medalla` ⇒ `siguienteTramo` (mapa nuevo, equipo curado). La Liga es un
  mapa con cinco jefes en fila; entre ellos se cura todo (hasta que haya
  objetos). Los rivales salen evolucionados según su nivel
  (`formaPorNivel`); los equipos de los líderes son fijos.
- **Balance**: no tocar niveles a ojo. `simular` juega en automático
  (elige caminos al azar, captura por stats y pone al frente un counter
  antes de cada jefe). Referencia actual con 300 runs: Squirtle gana a
  Brock ~50 %, Bulbasaur ~35 %, Charmander ~15 %; la Liga ~5 %. Liga endurecida (v0.6.1): Calle Victoria sin hierba ni centros y Alto Mando/Campeón con 6 Pokémon cada uno y en prueba de dureza: Lorelei 63–66 … Lance 68–72, Azul 71–75. El equipo llega con Nv medio ~56 y el bot no gana nunca; el equipo competitivo del modo prueba gana 5 % a Nv 55, 22 % a 60, 56 % a 66 y 85 % a 72 (`liga-equipo` en las notas de balance). Una persona
  juega mejor que el bot.
- **Modo prueba** (casilla en el título o `?debug=1`), **solo en local**
  (`EN_LOCAL` en `juego.js`: localhost/127.0.0.1); en producción no se ve ni
  se puede encender: inmortal (perder
  cuenta como ganar, en `terminarCombate(run, {inmortal})`), empezar en
  cualquier gimnasio (`debugEmpezarEn`) y el panel 🐞 (ganar combate, ir al
  jefe, saltar gimnasio, +5 niveles). Todo marca `run.debug`: cuando haya
  ranking (Fase 2), esas runs no cuentan.
- **`motor.js` es puro y UMD** (corre en Node, `tests/pokelike.test.cjs`).
  Todo azar sale de `run.rng` (mulberry32) guardado en la run; nunca
  `Math.random` en el motor. `simular(semilla, inicial)` juega una run
  entera en automático: úsalo para balancear antes de tocar números.
- **Combate propio, no `@pkmn/sim`** (decisión del usuario): 1 contra 1, solo
  daño, el Pokémon pega con su mejor stat ofensiva (atk o spa) contra la
  defensa que corresponde. Movimientos derivados de los tipos de la especie
  y escalones por nivel (`NIVEL_ESCALON`), no learnsets reales.
  `pasoCombate(run, eleccion)` hace un turno y devuelve eventos; `null` =
  la IA elige (modo AUTO).
- La pantalla (`juego.js`) **anima los eventos con una copia local**
  (`vista`) y al final de cada turno re-sincroniza con `run`; `gen` corta
  animaciones viejas al salir del combate. La run se guarda en
  `localStorage` (`pokelike.run`, `v: 2`) tras cada cambio; cambiar la forma
  de `run` exige subir `v`.
- Sprites: PokeAPI (BW animados en combate, PNG en listas) y entrenadores de
  Showdown, por URL; si no está `id` se prueba `id-gen3` e `id-gen4`
  (kindler, lorelei y agatha solo existen así). Sonido sintetizado, debajo de `volumen.js`.
