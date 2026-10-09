# Sopa de letras — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Sopa de letras (`juegos/club/sopa/`) is a Solo Club game too**, on the
same `conexion.js` protocol: plain files, no build (`?v=sopa-N` on its two
scripts, `club-N` in `solo/club.js` for the iframe). `motor.js` (UMD
`SopaMotor`, tested by `tests/sopa.test.cjs`) is everything pure: the seven
themes (uppercase, no accents or Ñ, at least four letters, so the random fill
does not spell them by accident), generation, the Chile date, the
straight-line selection and the streak. `game.js` is the screen. Things that
matter:

- **The daily puzzle depends only on the date.** `diaChile` reads the date
  in `America/Santiago` through `Intl.DateTimeFormat` (`en-CA` gives
  `AAAA-MM-DD`), the theme rotates with the day number, and the grid comes
  from mulberry32 seeded with `hash("sopa:" + fecha)`. Nothing calls
  `Math.random`, so every browser draws the same 12×12 Medio. If a word
  does not fit after `INTENTOS` (300) tries, the next candidate is tried,
  and a failed round restarts **on the same generator stream**, so the
  result is still deterministic. No chosen word may contain another one,
  forwards or backwards; otherwise finding the short one would mark the
  wrong word.
- **The free mode** uses the same generator with a seed from
  `crypto.getRandomValues`. Its selectors are hidden in the daily mode
  (`[hidden]{display:none!important}` is there because the bar is flex).
- **The streak counts only the daily** (`registraDiaria`; `rachaVisible`
  shows 0 once a day was skipped). It lives in `localStorage` under the
  account's `Club.storageKey`, and inside Juegos also in
  `users/<uid>/club/sopa` through `Club.guardarPartida`/`pedirPartida`, the
  same channel BBTAN saves its game in. `mezclaRacha` merges the two
  copies: the one with the later `ult` wins, and `mejor` is the max of
  both. So a streak follows the person to another device, and finishing
  today's puzzle elsewhere shows it solved here.
- **Ranking.** `club-sopa-racha` has `puntos` = the streak reached (the
  table keeps the best one) and `tiempo` = that day's time. The free tables
  are `club-sopa-(facil|medio|dificil)-(8|12|15)`, with `puntos` fixed to
  the word count (6/10/13, checked in `club-datos.js`), so they order by
  time. `ranks.js` hides the size row while «Racha diaria» is picked (a
  fila's `si`). The `soloRanks` regex was widened, so the rules must be
  re-published.
