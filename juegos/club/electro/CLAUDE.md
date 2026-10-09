# Electrodle — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Electrodle (`juegos/club/electro/`) is a Solo Club game too**, a daily
guessing game in the vein of Pokedle/Wordle on electrical things, on the same
`conexion.js` protocol: plain files, no build (`?v=electro-N` on its four
scripts). `datos.js` holds the three catalogues (43 components, 48 people, 46
formulas, each with an `alias` list for search: «condensador», «termocupla»),
`simbolos.js` hand-drawn schematic symbols in a 120 x 80 box, and `motor.js`
(UMD `ElectroMotor`, tested by `tests/electro.test.cjs`) everything pure.
Things that matter:

- **Three challenges on top** (`retos.js`, UMD `ElectroRetos`), whose target
  is `"s" + seed` from the date: Bandas (a Mastermind of the resistor colour
  code, E12 targets, Wordle-style marks per band plus a higher/lower arrow on
  the value), Circuito (five resistor topologies; answer the current, Req or
  a voltage within 1.5 %, six tries, the solution steps shown at the end) and
  Conexiones (NYT Connections: one group per level from `GRUPOS`, no tile
  repeated across the whole bank so the solution is unique, `choca` keeps
  confusable groups apart, four mistakes). They can be lost (`hist` entries
  carry a fourth field, won 0/1, and a lost one scores 0), they add points
  (`M.puntos`) but **the streak only asks for the classic daily modes**
  (`CLASICOS`: Componente, Fórmula, Símbolo), so adding challenges did not
  break anyone's streak. Científico is `practica: true`: only in Práctica,
  never in the daily (`DIARIOS`), the share text or the streak.
- **The look is its own, like the *dle sites' themed pages**: always dark,
  whatever the site theme. `escena.js` draws the background scene (PCB
  traces with travelling pulses, a Tesla coil with random arcs, a power
  tower) behind a single centred column: neon logo, modes as round LEDs on
  a copper trace, a mode plate, a toolbar (Diario/Práctica switch, streak,
  points, stats and help `<dialog>`s) and chassis panels with screws.
  `ElectroEscena.descarga()` is the win flash. Reduced motion stops arcs,
  pulses and the neon flicker.
- **Four classic modes a day.** Componente and Científico are attribute tables
  (green equal, yellow «something in common» for list columns, red different,
  with an up/down arrow on numbers and on the ordered `EPOCAS`). Fórmula shows
  the formula with every variable masked and uncovers one per miss, in an order
  seeded by the formula id. Símbolo starts zoomed x5 on the symbol's `foco` and
  steps out through `ZOOM` on each miss. Hints unlock by misses (`pistas`).
- **The daily target depends only on the Chile date**, like the Sopa:
  each pass through a catalogue is a seeded shuffle (`vuelta`), so nothing
  repeats until all came out, and a pass never starts with the previous one's
  last. Símbolo only draws components that have a symbol. Práctica is random
  and scores nothing.
- **Scoring.** A mode is worth `puntosDe(n)` = 100 at the first try, 10 less
  per extra try, never below 10. The saved state is
  `{hist: {fecha: {modo: [puntos, intentos, ms]}}, prog}`; points, total time,
  streak (days with all four modes) and best streak are all derived from
  `hist`, so `mezcla` (union by day and mode) is all a second device needs.
  It lives in `localStorage` under `Club.storageKey` and in
  `users/<uid>/club/electro` through `Club.guardarPartida`.
- **Ranking.** `club-electro-puntos` has `puntos` = the running total (it only
  grows, so every solved mode is a new record) and `tiempo` = total solving
  time; `club-electro-racha` is sent when the fourth mode of a day is solved.
  Both feed the podium announcement on Discord, logros (`deMarca`) and coins
  (`extraRecord`: 10 per streak day, 1 per 50 points). The `soloRanks` regex
  was widened and `club-electro-puntos` got a 1 000 000 cap, so the rules must
  be re-published.

**Electrodle's anti-cheat proof** (`docs/antitrampas/electro.md`): each
`hist` entry is now `[pts, n, ms, g, [tries], forma]`, and the proof carries
every day's tries (the shape of each try only for the last 30 days), so
`verifica/electro.js` recomputes every day's points from the real targets.
**A catalogue entry is only ever appended, with `desde`**: inserting one
moves the targets of past days and would reject everyone's history (a test
pins the target fingerprint). Days after `CORTE` (2026-10-12) must carry
their tries, so move `CORTE` if this ships later than a week after
2026-10-05.
