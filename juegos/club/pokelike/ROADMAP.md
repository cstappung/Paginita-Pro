# Pokelike — roadmap

Un roguelike de Pokémon para Juegos, inspirado en [pokelike.xyz](https://pokelike.xyz/)
(fork legible en [pcasaspere/pokelike_v2](https://github.com/pcasaspere/pokelike_v2)).
Se avanza por **hitos pequeños**: cada uno se prueba en local
(`cd colabtex && npm start`, o `python -m http.server 8123` desde la raíz del
repo → `http://localhost:8123/juegos/club/pokelike/`) y se revisa antes de
seguir. Nada se integra al Salón, monedas ni ranking hasta la
Fase 2.

**Estado (v0.1, en desarrollo):** Fase 1 hecha salvo **objetos** y **música**; adelantado
de la Fase 3/4 lo esencial: **los 8 gimnasios y la Liga** (Alto Mando +
Campeón), dificultad más alta y un **modo prueba** (inmortal, empezar en
cualquier gimnasio, saltar). Pendiente de tu prueba en local.

## Cómo es el juego de referencia

- Una *run* es un mapa de **nodos por capas** (estilo Slay the Spire): partes
  arriba, eliges uno de 2 caminos en cada capa y llegas al **jefe** (un líder
  de gimnasio) abajo. Al vencerlo, mapa nuevo con el siguiente gimnasio.
- Nodos: combate salvaje, captura, entrenador, objeto, centro Pokémon, «?»
  (evento), tutor de movimientos, intercambio, legendario.
- El generador (`js/map.js` del fork) usa **pesos por capa** (`NODE_WEIGHTS`)
  y conecta cada nodo con los 2 más cercanos de la capa siguiente. Todo sale
  de una semilla (mulberry32), igual que en el resto de nuestros juegos.
- Los combates son **automáticos** (1 contra 1, el activo pelea hasta caer),
  los Pokémon suben de nivel al ganar y perder el equipo termina la run.

## Decisiones tomadas

1. **Motor de combate propio y simple** (no `@pkmn/sim`): 1 contra 1, solo
   movimientos de daño, cuatro escalones por tipo.
2. **Híbrido auto/manual**: AUTO viene encendido (ritmo idle); al apagarlo
   eliges cada movimiento.
3. **Tabla de tipos moderna (18 tipos) con solo Pokémon de Gen 1**
   (Clefairy es Hada, Magnemite es Eléctrico/Acero).
4. **Nombre: Pokelike** (provisional). Vive en `juegos/club/pokelike/`
   para que la Fase 2 no tenga que moverlo.

Se reutiliza del sitio: `volumen.js` (mute y volumen), `mando.js`,
`i18n.js`, sprites de PokeAPI y de entrenadores de Showdown.

---

## Fase 0 — Esqueleto (½ día)

Objetivo: una página que carga y muestra datos de Gen 1.

- [x] Carpeta `juegos/club/pokelike/` con `index.html` (i18n, `mando.js`,
      `volumen.js`, como los juegos del club), `motor.js` (puro, UMD, corre en
      Node) y `juego.js` (la pantalla).
- [x] Tabla de los **151 Pokémon** de Gen 1 (`especies.js`, generada desde
      PokeAPI por `colabtex/scripts/pokelike-datos.cjs`): nombre, tipos,
      stats base, experiencia, captura y evoluciones. En tiempo de juego solo
      se piden los sprites.
- [x] `colabtex/tests/pokelike.test.cjs`, dentro de `test:juegos`.

**Hito 0:** abro la página en local y veo un Pokémon al azar con su sprite,
tipos y stats.

## Fase 1 — Prueba de concepto: de Pueblo Paleta a Brock

Objetivo: una run corta jugable de principio a fin con **solo Gen 1**,
terminando en el **Gimnasio Plateada**. Si Brock cae, ganaste.

### 1.1 Inicio de run
- [x] Pantalla de título → elegir inicial (Bulbasaur / Charmander /
      Squirtle, nivel 5).
- [x] Estado de la run (`equipo`, `mochila`, `mapa`, `nodoActual`, `semilla`)
      y guardado en `localStorage` para retomar tras recargar.

**Hito 1.1:** elijo inicial, recargo la página y la run sigue ahí.

### 1.2 Mapa procedural
- [x] Generador de mapa por capas con semilla: inicio → captura → 6 capas de
      contenido → centro → Brock. Nodos: **salvaje, captura, entrenador,
      centro Pokémon, jefe** (objeto queda para 1.5).
- [x] Pesos por capa (más capturas al principio, más entrenadores cerca del
      jefe, un centro Pokémon forzado antes del jefe).
- [x] Dibujo del mapa (SVG o canvas), caminos disponibles resaltados, clic
      para avanzar. Los nodos todavía no hacen nada: solo avanzar.
- [x] Misma semilla ⇒ mismo mapa (test).

**Hito 1.2:** veo el mapa, recorro un camino hasta Brock haciendo clic, y una
semilla fija siempre genera el mismo mapa.

### 1.3 Combate
- [x] Combate con el motor propio, AUTO por defecto y manual opcional,
      velocidad ×1/×2/×4.
- [x] Victoria ⇒ experiencia y subida de nivel; derrota de todo el equipo ⇒
      fin de la run.
- [x] Movimientos por nivel, máximo 4: el mejor de cada tipo propio + uno
      Normal; escalones a los niveles 1, 12, 25 y 40.

**Hito 1.3:** gano y pierdo combates salvajes; mi Pokémon sube de nivel.

### 1.4 Captura y equipo
- [x] Nodo de captura: elegir 1 de 2–3 Pokémon de la zona (Ruta 1, Ruta 2,
      Bosque Verde: Rattata, Pidgey, Caterpie, Weedle, Pikachu…).
- [x] Equipo de hasta 6, reordenar, ver ficha.
- [x] Evolución al llegar al nivel (Caterpie → Metapod → Butterfree, etc.).

**Hito 1.4:** capturo, armo equipo, algo evoluciona.

### 1.5 Entrenadores, objetos y centro
- [x] Entrenadores (Cazabichos, Joven…) con equipo según la capa y sprite.
- [ ] Objetos simples: Poción, Superpoción, Caramelo raro y 1–2 objetos
      equipables.
- [x] Centro Pokémon: cura todo.

**Hito 1.5:** una run completa tiene variedad: no todos los nodos son iguales.

### 1.6 Brock y fin de run
- [x] Brock con su equipo (Geodude, Onix… niveles a balancear) y su sprite.
- [x] Victoria ⇒ Medalla Roca, pantalla de resultado (tiempo, equipo final).
      Derrota ⇒ pantalla de fin con opción de nueva run.

**Hito 1.6:** puedo ganarle a Brock (y también perder).

### 1.7 Pulido de la PoC
- [x] Mute y volumen visibles (regla obligatoria del sitio) y efectos
      sintetizados.
- [ ] Música.
- [x] Se juega bien en celular.
- [ ] Balance: una run de ~10–15 min, Brock se gana con ~60–70 % de éxito.
      Hoy, con un bot que elige caminos al azar: Squirtle 78 %, Bulbasaur
      63 %, Charmander 17 % (Brock es Roca, como en el original).
- [x] `juegos/club/pokelike/CLAUDE.md` con las notas del juego + fila en el
      mapa de docs del `CLAUDE.md` raíz.

**Hito 1.7 (cierre de la PoC):** run de Paleta a Brock jugable, divertida y
estable en local. Aquí decidimos si seguimos y cómo.

---

## Fase 2 — Integración al sitio

Seguir `docs/claude/juegos/crear-un-juego.md` (sección *Solo Club game*):

- Entrada en el Salón (`SOLOS`, portada, icono, ruta `#solo/pokelike`).
- Cada récord de la clasificación lleva el equipo campeón (el que venció al
  Campeón, ya guardado en el Salón de la Fama local: `pokelike.fama`).
- Monedas, 10 logros, clasificación (categoría p. ej. medallas + tiempo).
- **Antitrampas**: `solo/verifica/pokelike.js` reproduce la run desde la
  semilla y las decisiones con el mismo `motor.js`.
- Reglas de Firebase (`soloRanks`, `soloPruebas`, `clubJugadas`) — hay que
  **re-publicarlas a mano** en la consola.
- Manual 📖 en `reglas.js`.

## Fase 3 — Kanto completo

- [x] Los 8 gimnasios, un mapa por tramo, con la fauna de cada zona.
- [x] Rivales evolucionados según su nivel.
- Nodos nuevos: «?» (eventos), tutor de movimientos, intercambio,
  legendarios (Articuno/Zapdos/Moltres/Mewtwo en tramos tardíos).
- Piedras evolutivas, más objetos equipables, Rival (Gary) en tramos fijos.
- [x] Pokédex persistente entre runs, en el navegador y en la cuenta
      (`pokedex/<uid>`).

## Fase 4 — Liga Pokémon

- [x] Calle Victoria, Alto Mando (Lorelei, Bruno, Agatha, Lance) y Campeón
      (Azul, con el inicial que le gana al tuyo).
- Salón de la Fama con los equipos ganadores.

## Fase 5 — Post-liga y modos

- [x] Ruta Infinita después de la Liga (solo entrenadores y centros, la
      dificultad sube cada 3 victorias) y puntaje de la run.
- Pokémon de otras generaciones en la Ruta Infinita.
- Variantes: Nuzlocke, run diaria con semilla compartida (todos juegan el
  mismo mapa ese día — encaja con los rankings del club).

