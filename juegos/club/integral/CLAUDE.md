# Integrodle — notes for Claude

Solo Club game of Juegos (daily integral, Wordle-style). Shared club rules
(anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`;
logros/coins/ranking/frame wiring in `docs/claude/juegos/perfiles-y-economia.md`.
Anti-cheat details: `docs/antitrampas/integral.md`. Authored in Spanish.

Plain files, no build: `expr.js` (UMD `IntegralExpr`: parser, LaTeX,
evaluator, canonical form), `datos.js` (`TECNICAS` and the `BANCO`),
`motor.js` (UMD `IntegralMotor`, everything pure) and `juego.js` (the page),
each loaded with `?v=integral-N` — **bump it when one changes**. KaTeX comes
from cdnjs. Tests: `colabtex/tests/integral.test.cjs`.

- **The bank is history.** The day's integral is a seeded shuffle of the
  bank per round (`vuelta`), and the verifier replays every account's whole
  history with today's bank. Never reorder, edit or delete an entry: a new
  one goes **at the end with `desde: "AAAA-MM-DD"`** (a future date); a bad
  one is retired with `hasta`. The test checks F' = f on the range, F(b) −
  F(a) = v for definite ones, and that everything parses.
- **Checking an answer** (`revisa`): indefinite → the try's values minus F's
  at 21 points must be constant (so any + C, any equivalent form; up to
  three isolated non-finite points are tolerated). Definite → a number with
  no x, exact (no decimal with more than 3 digits), within 1e-9. An
  unreadable or wrong-shape answer returns `{error}` and does **not** spend
  a try; a duplicate (same `canonica`) is refused in the page.
- **Scoring** `puntosDe(n, gano, d)`: `PUNTOS[n-1]` (100, 80, 65, 50, 35, 20)
  + 10 per star over the first; a lost day scores 0 and cuts the streak,
  also on the same day (`racha` returns 0 when today is lost).
- Hints: the technique after 1 miss, the key step (`p`, LaTeX) after 3.
- The on-screen keyboard keeps focus in the input (keys `preventDefault`
  on pointerdown) and the input gets `inputmode="none"` on touch screens.
- Saved state: `integral.estado` (localStorage, per account) merged with
  `users/<uid>/club/integral` through `M.mezcla`; the day in progress is
  `prog = {fecha, i, ms, t, u, mc}` with the anti-cheat form.
- No sound: it does not load `volumen.js`.
