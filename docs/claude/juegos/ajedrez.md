# Ajedrez — notes for Claude

Screen: `colabtex/src/juegos/ajedrez.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Ajedrez (`ajedrez`) is the whole of FIDE's rules in the reducer**
(`redAjedrez` and the `aj*` functions at the end of `motor.js`). A move is
`{t:"m", uid, de:"e2", a:"e4", pr?}` and counts only if it is in the legal
list of that position, so an illegal or out-of-turn move simply does not
exist; the rest are `tablas` (offer), `acepta`, `rechaza` and `rinde`. Things
worth knowing:

- **The board is 64 letters, index 0 = a8**, upper case white, `.` empty,
  English letters inside (FEN's) and **Spanish notation on screen** (R D T A
  C, `AJ_LETRA`). `ajLegales` is pseudo-moves filtered by "does my king end up
  attacked", and castling checks the squares the king crosses itself.
  `tests/ajedrez.test.cjs` runs **perft** on five reference positions
  (start, Kiwipete, the en-passant/pin one, promotions, position 5): any
  change to move generation has to keep those numbers.
- **Threefold repetition and the fifty-move rule are automatic**, not
  claimed: with no arbiter, a claim would need the reducer to know about
  time and intent. The repetition key carries the en-passant square only
  when an en-passant capture is actually legal.
- **Colours**: the host picks in the lobby card (`color`: azar/blancas/
  negras, through `$otro`, so no rule for it); «al azar» is the room seed's
  parity (`ajBandos`).
- **The clock is replayed from the log too.** The room's `ritmo` («3+2»,
  one of `AJ_RITMOS`, or `libre`) sets it; every move carries `at`
  (`ctx.ahora()`, the server-corrected clock), and the reducer charges each
  side the time since the previous move and adds the increment. It does not
  run until both sides have made their first move, as on lichess. A move
  that arrives past its time does not count and loses on time; if nobody
  moves, either screen sends `{t:"tiempo", at}` when the flag falls, and the
  reducer only accepts it if the time really ran out (the screen retries
  every 1.5 s against clock skew). Flagging against a side that cannot mate
  (`ajNoMata`: bare king, or king and one minor piece) is a draw,
  `tiempomaterial`. The honest limit: `at` is written by the client, and the
  rules only pin it to a few seconds of the server's `now` (scoped to chess
  rooms, so the escondite's own `at` is untouched).
- **Premoves are screen-only** (`pre` in `ajedrez.js`): during the
  opponent's turn the same tap/drag records a move whose destinations are
  the piece's geometric ones (own pieces block, enemy pieces do not), shown
  in red, and it is sent the moment the turn arrives if it is legal in the
  new position, or dropped with a notice. Right-click or tapping an empty
  square cancels it.
- **One draw offer per own move** (`ofrecio`); moving while an offer is in
  front of you declines it, while the offerer moving keeps it standing.
- The replay is memoised (`ajCache`) by the move list, since a repaint
  happens on every tick.
- **The pieces are free piece sets served as files**
  (`juegos/ajedrez/piezas/<set>/wK.svg`: cburnett under BSD, chessnut under
  Apache 2.0, fantasy and celtic under MIT, see `LICENCIAS.md` there; the
  non-commercial lichess sets were left out on purpose), placed with
  `<image>` by `piezaSvg`, which the lobby cover uses too. They are not
  inlined because several carry their own `<style>` with ids that would
  clash inside one SVG. The viewer picks a set (`jg.ajPiezas`). Moving is tap-tap
  or drag over the same `sel`; promotion opens a picker and the reducer
  refuses a promotion with no piece. The opponent's piece slides in from its
  origin on an **inner** `<g>` (`.jg-aj-llega`), for the same reason as
  Chain Reaction's nested orbs. `est.perdidas` (not `fuera`, which the header
  reads as "players out") is what each side has lost, counted against the
  starting set. The music borrows Reversi's harpsichord.
