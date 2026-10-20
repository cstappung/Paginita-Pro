# PRO PACMAN — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`; volume in `juegos/audio/CLAUDE.md`.

**PRO PACMAN (`juegos/club/propac/`) is a neon arcade Pac-Man with new
mechanics.** Plain files, no build (`?v=propac-N`): `motor.js` (UMD
`PropacMotor`, pure: integer 1/60 s ticks, a tile is `U = 8` units and
bodies move one unit per step, speeds in hundredths accumulated in `acc`;
mulberry32 seeded with the account) and `juego.js` (canvas, live WebAudio,
input). The new mechanics, all in the engine: **racha** (×1–×5 for dots
eaten without a 0.6 s gap), **turbo** (code 4, costs 35 of the energy dots
charge), **pulso** (code 5, charges spawn at `F`, stuns ghosts within 6
tiles), **compuertas** (`=`, from the second maze, toggle every 8 s for
everyone) and **Glitch**, a fifth ghost from level 3 that teleports. Three
19 × 21 mazes (Neón, Circuito, Reactor) cycle.

- **A move is applied just before the next tick** and recorded as
  `[Δtics, code, origin]`; `rehace` replays the same way. Anything the
  screen does (interpolation, particles, sound) must never touch `E`.
- **Mazes must have no dead ends and nothing unreachable**: ghosts cannot
  reverse, so a dead end traps them. `tests/propac.test.cjs` checks every
  map; run it after editing one.
- **Eyes and leaving ghosts follow the shortest path (`distancias`)**, not
  the arcade's straight-line rule: with it, eyes beside the house bounced
  between two tiles forever (seen in a bot game).
- **Phone**: swipe anywhere (18 px picks a direction, and the origin resets
  so one gesture can turn twice) or the bottom strip `⚡ ◀ ▲ ▼ ▶ ◎`
  (`html.tactil`, buttons ≥ 48 px, act on `pointerdown`). Immersive on
  «Jugar», off on pause and end. The HUD bands stick to the canvas edges so
  a tall phone's spare height sits around the maze.

- **Sound** (`juego.js`, «Sonido»): the music is the shared songbook
  (`chip.js` + `temas.js`, loaded before the game): `propac-neon`,
  `-circuito`, `-reactor` (one per maze, `E.mapa.i`), `propac-poder` while a
  ghost is frightened, and three one-pass jingles (`cortina`): `-inicio`
  (one bar = the 90-tick «¡Listo!»), `-limpio` (2.5 s = the 150-tick clear)
  and `-fin`. **The melodies are original**, like the Pokémon tributes: the
  Namco tunes are not to be transcribed. A Reproductor per theme keeps its
  place when stopped, so the maze theme resumes after the fright. Effects
  use `Chip.voz`/`Chip.ruido`; the waka rises two semitones per racha level.
  The four looping themes are also in the ♪ player (`CANCIONES`).
- **The character** is `dibujaPac` (game, menu decor and lives): the classic
  wedge mouth on a glossy sphere, neon rim in the racha colour, dark lips
  and an eye that faces where it goes. The body stays yellow (cyan only in
  turbo); the racha shows on the rim and halo.

One table, `club-propac-puntos`; proof and verifier in
`docs/antitrampas/propac.md`. The `soloRanks`, `soloPruebas` and
`clubJugadas` rules were widened, so they must be re-published. Not a guest
destacado and no champion frame or novedad yet.
