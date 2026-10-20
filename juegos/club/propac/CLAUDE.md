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

One table, `club-propac-puntos`; proof and verifier in
`docs/antitrampas/propac.md`. The `soloRanks`, `soloPruebas` and
`clubJugadas` rules were widened, so they must be re-published. Not a guest
destacado and no champion frame or novedad yet.
