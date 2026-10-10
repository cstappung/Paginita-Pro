# Mina Club — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Mina Club's board fits its box; it never pushes past it** (`juegos/club/minas/`,
plain files with no build, mounted by `solo/club.js` in an iframe whose `?v=`
has to be bumped when they change). The board used to carry
`min-width: cols × 26px`, which on a tablet and inside the Juegos iframe was
wider than the room it had. The last columns ended up behind a horizontal
scroll that fought with the touch, and that was «a column you can't see». Now:

- the columns are `minmax(0,1fr)` and cells `min-width/min-height:0`, so
  `aspect-ratio` keeps them square — a flag's svg used to stretch its cell,
  hence the svgs are absolutely positioned;
- the number's size is in `cqi` of the board;
- a wide board on a portrait screen is **transposed for display only**
  (`acomodar()`, `grid-auto-flow:column`), with the arrow keys remapped;
  minesweeper doesn't care which way it is drawn, so the engine never knows.

`vertical()` reads `window.top` because the iframe's own shape says nothing.
The **Descubrir · Bandera** selector decides what a tap does (`tocar(i, alReves)`),
and a long press always does the other thing.
