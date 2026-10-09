# Sudoku Arcade — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Sudoku Arcade (`juegos/club/sudoku/`) is a Solo Club game too**, on the
same `conexion.js` protocol: plain files, no build (`?v=sudoku-N` on its
scripts, `club-7` for `conexion.js`, `club-N` in `solo/club.js` for the
iframe). `motor.js` (UMD `SudokuMotor`, tested by `tests/sudoku.test.cjs`)
is everything pure: a bitmask backtracking solver with MRV that stops at the
second solution, a human-technique grader (singles, intersections,
naked/hidden pairs and triples, X-Wing, XY-Wing, Swordfish: the difficulty is
the hardest technique needed, not the clue count), and a generator that
removes clues in 180° symmetric pairs while the solution stays unique.
`game.js` is the screen, with its own chip theme (`sudoku` in `temas.js`)
and synthesised effects. Things that matter:

- **Three modes, three kinds of table.** *Diario* is one Medio puzzle that
  depends only on the Chile date (seed `hashTexto("sudoku:" + fecha)`,
  mulberry32, a cap on *attempts* rather than on time so every browser draws
  the same one), and its streak is `club-sudoku-racha` (`puntos` = days).
  *Clásico* is `club-sudoku-<facil|medio|dificil|experto>` with `puntos`
  fixed to 1, like Mina Club, so the table orders by time; hints add 30 s.
  *Arcade* is `club-sudoku-arcade` (`puntos` up to 1 000 000): three lives,
  a wrong digit is not placed and costs a life and the combo, the combo
  multiplier climbs 25 % per hit up to ×4, closing a row, column or box pays
  extra, and finishing adds a time bonus and 500 per life left. A lost game
  still reports its score.
- **The streak and the half-played diario travel as one blob** through
  `Club.guardarPartida`/`pedirPartida` (`users/<uid>/club/sudoku`, no rule
  needed), merged with `mezclaRacha` exactly like the Sopa's.
- **Everywhere else it is wired like Electrodle**: `club-datos.js` checks the
  categories and caps, `ranks.js` has one «Tabla» row (racha, arcade and the
  four classic difficulties, the classic ones by time), ten logros
  (`deMarca`) with their `NIVEL` digits, coins (`RECORD`, `PAGO_CLUB`, 10 per
  streak day and 1 per 1000 arcade points in `extraRecord`), a champion frame
  `tsudoku` (a neon ring of 3×3 mini grids in `marcos-animados.js`), the
  Discord podium, the 📖 manual and its illustrated examples. The `soloRanks`
  and `clubJugadas` regexes were widened (the classic tables also demand
  `puntos === 1` in the rule), so the rules must be re-published.
