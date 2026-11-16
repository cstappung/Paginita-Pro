# Ajedrez Club — notes for Claude

Solo Club game of Juegos: the single-player side of chess (the room game is
`colabtex/src/juegos/ajedrez.js`, doc `docs/claude/juegos/ajedrez.md`).
Shared club rules (anti-cheat proof, castigo, modo celular) are in
`juegos/club/CLAUDE.md`; logros/coins/ranking wiring in
`docs/claude/juegos/perfiles-y-economia.md`. Anti-cheat details:
`docs/antitrampas/ajedrez.md`.

**Names.** Route and folder `ajedrez` (`#solo/ajedrez`, categories
`club-ajedrez-*`, verifier `verifica/ajedrez.js`); club key `ajedrezclub`
everywhere else (SOLOS id, logros, coins, `clubJugadas`, ranks, Discord),
because `ajedrez` is already the room game — the same split as Tetris,
Type Race and Pro BoxHead (`CLAVE_CLUB` in `juegos-main.js`). Its SOLOS row
carries `juego: "ajedrez"`, which makes `practicaDe("ajedrez")` offer it
from the room's ficha («Juega solo contra bots o resuelve puzles»).

**Files** (plain, no build, `?v=ajedrez-N` on each script and the CSS; the
worker loads `motor.js?v=ajedrez-N` too, bump both):

- `motor.js` (UMD `AjedrezMotor`, pure): 0x88 board, integer moves,
  make/unmake with a number stack, double 32-bit zobrist keys, every FIDE
  rule with automatic draws, Spanish SAN (R D T A C), evaluation (Michniewski
  PSTs, tapered king, bishop pair, mop-up), the bot and the puzzle checks.
  `tests/ajedrezclub.test.cjs` runs **perft** on the same five positions as
  the room engine: any change to move generation must keep them.
- `puzles.js` — **generated** by `colabtex/scripts/ajedrez-puzles.cjs` from
  the lichess puzzle CSV (CC0, not in the repo). Do not edit by hand.
  Puzzles are keyed by lichess id; removing one stops it counting in proofs.
- `bot.js` — Web Worker: replays the move list and answers `eligeBot`.
  If the worker fails, `juego.js` computes on the main thread.
- `juego.js` / `estilo.css` / `index.html` — the screen.

**The bot must stay deterministic.** Fixed depth (never time-based), stable
move ordering, randomness only from `azarDe(semillaCuenta(s, u), ply)`.
The proof carries only the player's moves; the verifier recomputes every
bot move with `rehaceBot`, so a change to the search, evaluation or
`NIVELES` **invalidates every stored bot proof** (audits would reject old
records). If the bot must change, add a proof version and keep the old code
path for `v: 1`. Levels: Novato depth 1 no quiescence, noise ±260 cp and 22 %
random moves; Aficionado depth 2 + quiescence, ±90, 5 %; Experto depth 3,
±25; Maestro depth 4, ±6. Each level beats the previous one ~100 % in
bot-vs-bot; Maestro averages ~25 ms per move in Node (max ~300 ms).

**Ranking.** `club-ajedrez-bot<n>`: puntos 1, tiempo = the player's thinking
ms (bot time excluded), sent only for a mate win. `club-ajedrez-puzles`:
puntos = total stars (3 − errors − hint, min 1 per solved puzzle), tiempo =
sum of the counted attempts; sent only when the (stars, ms) summary beats
the last one sent (`datos.mandado`), because every send is a paid club play.
`club-tabla` re-sends if the row is behind, and **rescues** puzzles from the
row's proof (`Club.pedirPruebaPropia`) when the row has more stars than this
browser (other device, cleared storage).

**State.** `localStorage` only (per account via `Club.storageKey`):
`ajedrezclub.datos` (best time per level, puzzle progress with the best
attempt of each), `ajedrezclub.partida` (the bot game in progress, resumed
on reload; the thinking time spent before reloading keeps counting via
`desde`), and `ajedrezclub.pref` (not per account: mode, level, colour,
mute, piece set; the piece set defaults to the room's `jg.ajPiezas`).

**Screen.** Board = CSS grid of 64 squares plus a layer of `<img>` pieces
placed with `translate(%)` of their own size; a move changes a transform and
CSS slides it (`juegaVisual` then `sincroniza`). Tap-tap, drag, keyboard
cursor (arrows + Enter/Space, so gamepads via `mando.js` work), promotion
picker. Sounds are a small WebAudio synth behind `volumen.js`; `#sound-button`
mutes them (`pref.mudo`). The `[hidden]{display:none!important}` rule
matters: `.capa.fin` is `display:flex` and covered the board without it.
`conexion.js` formats the side ranking (bot tables as m:ss.d of thinking,
puzzles as ★), so it is loaded as `?v=club-24`.
