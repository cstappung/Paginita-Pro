# Pokelike — notes for Claude

Roguelike de Pokémon (Gen 1) inspirado en pokelike.xyz. **En construcción**:
plan y estado en `ROADMAP.md`. Todavía **no** está conectado al Club
(sin `conexion.js`, ranking, monedas ni antitrampas: eso es la Fase 2), así
que se abre directo en `/juegos/club/pokelike/`.

- **Archivos planos, sin build.** Orden de carga (`index.html`):
  `especies.js` → `datos.js` → `motor.js` → `sonido.js` → `juego.js`.
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
  Brock ~50 %, Bulbasaur ~35 %, Charmander ~15 %; la Liga ~5 %. Una persona
  juega mejor que el bot.
- **Modo prueba** (casilla en el título o `?debug=1`): inmortal (perder
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
