# Trigon — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Trigon (`juegos/club/trigon/`) is a Solo Club game too**, a block puzzle
on a triangular grid (after the iOS game). Plain files, no build
(`?v=trigon-N`): `motor.js` (UMD `TrigonMotor`, pure: a hexagon of side 4 =
96 triangles in axial coordinates, 24 lines in three directions, 8 piece
shapes with every rotation and mirror, each hand of three from mulberry32
seeded with `mezcla(base, k)` and re-dealt up to 4 times if nothing fits, and the five power-ups of its
`PODERES` table — hammer, rotate, new hand, bomb, second chance — won at
random when lines clear, logged as moves with negative codes and replayed
like the rest),
`juego.js` (the screen: SVG board, drag and drop with a magnet to the
nearest valid spot, keyboard 1-2-3 + arrows + Enter, the start menu with
the leaderboard read from the `ranking` message, and per-theme line-clear
effects), `estilo.css` (shape only, no fixed colours) and `temas.css` (5
themes × dark/light as variables on `[data-skin]`/`[data-modo]`, chosen
with 🎨 and kept in `localStorage`). The half-played game lives **only in
`localStorage`** (seed + moves, dropped after 24 h without a move), never
in `users/<uid>/club`. One table, `club-trigon-puntos` (score, capped at
1e6, time = ms played). The proof `{v, s, u, j, a, w, fin}` carries every
move as `[piece, dx, dy, origin, Δms]`, and `solo/verifica/trigon.js`
replays it (`docs/antitrampas/trigon.md`). Logros (score thresholds), coins
(1 per 100 points + the per-game pay), the Discord podium, the cover and
the illustrated manual are wired like 2048's (no champion frame and no
replays yet); the `soloRanks`, `soloPruebas` and `clubJugadas` regexes
were widened, so the rules must be re-published.
`tests/trigon.test.cjs` covers geometry, motor and verifier.
