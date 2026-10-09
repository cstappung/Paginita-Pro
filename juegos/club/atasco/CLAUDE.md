# Atasco — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Atasco (`juegos/club/atasco/`) is a Solo Club game too**, a sliding
parking puzzle in the vein of Parking Panic / Rush Hour: you are stuck in the
red car and slide the others along their lanes until the exit row is clear.
Plain files, no build (`?v=atasco-N` on its five scripts and `estilo.css`):
`motor.js` (UMD `AtascoMotor`, pure: board, moves, BFS solver, stars,
progress), `niveles.js` (generated), `dibujo.js` (the vehicles as SVG) and
`game.js` (the screen). Things that matter:

- **A level is 36 letters**, row by row: `o` free, `x` a cone, `A` the red
  car (always horizontal, length 2, in row 2), any other letter a vehicle.
  A state is one number per vehicle (its column or row), keyed in base 6.
  **A move is one vehicle slid any distance**, which is what the solver
  counts, so «mínimo» on screen is a true minimum the player can reach.
- **The 240 levels are generated, not hand-made**
  (`colabtex/scripts/atasco-niveles.js`, seeds 1–4 × 140 climbs, in parallel,
  then `escribir`): hill-climbing over random lots, and for each lot the
  whole reachable cluster is explored and the state **farthest from the
  exit** is kept (Fogleman's idea). Six floors of 40, 2 to 49 moves, ordered
  by minimum; `escribir` re-solves every level with the game's own engine and
  refuses to write if they disagree. Do not edit `niveles.js` by hand.
- **Stars**: ★★★ with the minimum, ★★ up to `min + max(2, ⌈min/3⌉)`, ★
  otherwise. **There are no hints, on purpose**: finding the way out is the
  game (an earlier version had one and the owner asked for it to go). The margin of
  two is what guarantees every level can be finished with exactly two stars
  (one back-and-forth). `tests/atasco.test.cjs` **plays every level three
  times through the engine** (optimal, optimal plus one back-and-forth,
  enough back-and-forths to fall to ★) and checks each minimum against a
  second, independent string-based solver.
- **Drag and keyboard count the same**: a drag that leaves the vehicle in
  another cell is one move; with the keyboard (and the gamepad, which sends
  keys) the vehicle is grabbed with Space, moved cell by cell uncounted and
  released with Space, which commits one move. Vehicles are placed with
  `translate(%)`, whose percentage is of the vehicle's own size, so the board
  resizes without recomputing anything.
- **Unlocking**: levels open in order inside a floor; a floor opens with
  half the stars of the previous one (`pisoAbierto`).
- **Phones are first-class**, and `tests/atasco.test.cjs` pins the rules:
  vehicles are `touch-action:none` (dragging never scrolls the page) while
  the asphalt is `manipulation` (a swipe on an empty bay still scrolls);
  nothing on the board is selectable and `-webkit-touch-callout:none`,
  because on iPhone a long press opened the callout, swallowed the
  `pointerup` and left the car glued to the finger (`lostpointercapture`
  releases it anyway). Hover rules live in `@media (hover:hover)`, buttons
  are 46 px on coarse pointers, and the yellow selection is painted only
  for keyboard or gamepad play (`porTeclado`), never after a tap. The board
  is capped by the **top** window's height (`--alto-pantalla`, read from
  `window.top`, since the iframe grows with its content), and a short
  landscape screen gets `html.apaisado`: board on the left, scoreboard and
  buttons in a column beside it. Android vibrates briefly on each move.
- **Ranking**: one table, `club-atasco-estrellas` (`puntos` = total stars,
  `tiempo` = sum of best times), sent **only when the total grows** because
  every result is a paid club play. Progress `{v, n: {i: [stars, moves,
  ms]}}` lives in `localStorage` and in `users/<uid>/club/atasco`
  (`mezclaProgreso` keeps the best of each field). Ten logros by stars,
  coins (4 per star, `RECORD` 40, `PAGO_CLUB` 15), the `tatasco` champion
  frame, the Discord podium (`🚗 N ★`), the manual with three illustrated
  examples and the lobby card. The `soloRanks` and `clubJugadas` regexes were
  widened, so the rules must be re-published.
- **The look is a cartoon car park seen from above**: asphalt always dark,
  white bay lines, a concrete curb with hazard stripes and the exit on the
  right, a red-and-white barrier that lifts when the red car drives out.
  Vehicles are sticker-style SVG (thick dark outline); the red car carries
  white racing stripes. Its music is `T.atasco` in the songbook (B-flat
  major, 124 bpm with swing, a car-horn motif), also in the header player.

**Atasco's anti-cheat proof** (`docs/antitrampas/atasco.md`) stores, next
to the progress (`prog.p`), the move list of each level's best attempt, and
`verifica/atasco.js` replays them with the same engine. **Regenerating
`niveles.js` invalidates every stored proof**: a level whose layout changes
no longer replays, so its stars stop counting until it is won again.
