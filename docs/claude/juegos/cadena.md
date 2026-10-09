# Chain Reaction (cadena) — notes for Claude

Screen: `colabtex/src/juegos/cadena.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Chain Reaction (`cadena`) is decided by the reducer, and the screen only
retells it.** `redCadena` in `motor.js` resolves the whole chain when it
replays a move and keeps, in `ultima`, the board *before* the orb (`antes`)
and the list of **waves** (`ondas`, the cells that burst in each one);
`cadena.js` replays that list slowly, from `antes`, with `crOnda` — the very
function the reducer used — so what is animated can never differ from what
was decided. Rules that are easy to get wrong:

- **Waves are simultaneous.** Every cell that reached its critical mass (its
  number of orthogonal neighbours) bursts in the same wave; resolving them one
  at a time from a queue gives a different board, and the two browsers would
  have to agree on the queue order.
- **The chain stops as soon as no active rival has an orb left**, not when the
  board is stable: past that point the mover already owns every orb and a full
  board would loop forever. `CR_TOPE` (1000 waves) is only a safety net.
- **A player is out only after having played** and then reaching zero orbs —
  otherwise everybody but the first player would be out after move one.
- The seat decides the colour (`PALETA` in `cadena.js`, fixed), not
  `colorForUid`: in an eight-player board two nearly identical tones would make it
  unreadable, as in Reversi.

The move that wins is usually the longest chain of the game, so the fin
overlay **waits for the animation**: the screen exposes `ocupado()` and calls
`ctx.listo()` when the replay ends, and `pintaFin` in `juegos-main.js` does not
show the cartel while `ocupado()` is true. A hidden tab skips the replay and
paints the final board, and a generation counter (`gen`) cancels a replay that
a newer move made stale. Each orb is **three nested `<g>`s** (position → pop →
shake → spin) because a CSS `transform` animation *replaces* the element's
`transform` attribute: animating the group that carries the `translate` would
throw every orb to the corner of the board. A replay longer than `MAX_ONDAS` (60) jumps straight to the end.
