# sortEm — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**sortEm (`juegos/club/sortem/`) is a Solo Club game too**, on the same
`conexion.js` protocol as Mina Club: no ranking of its own, only
`Club.result({categoria: "club-sortem-N", puntos: N, tiempo})` for N = 10
or 20. `puntos` is fixed by the mode, so the table orders by time; the
block width per mode is `MEDIDAS` in its `game.js` (20 blocks fill the
canvas, which is 1000 px wide with the camera scrolled to x = −100 so the
800 px layout stays centred). Inside Juegos it is **only the game**:
`html.jg-sortem` (set by `armazon`) hides the site header and the solo bar
and pins the iframe to the whole window, the page hides its ranking panel
(the ranking lives in Clasificación) and keeps only a faint «← Volver a
Juegos» corner link, and the box is `min(100vw, 100vh·5/3)`. There is no
fullscreen button on purpose: a focused button turned the game's Space into a
fullscreen toggle. The `soloRanks` regex needed widening, so the rules must
be re-published.
