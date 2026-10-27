# Type Race — notes for Claude

Monkeytype-style typing race. Two ways to play, one engine:

- **Room** (`colabtex/src/juegos/typerace.js`, reducer `redTyperace` at the end of `colabtex/src/juegos/motor.js`): 1–10 runners on the same text. Room game of Juegos; the shared architecture (move log, `reducir`, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`.
- **Practice** (`juegos/typerace/index.html` + `juego.js`, the `bots-typerace` row in `salon-datos.js`): single player, no account, no Firebase. Settings and the best ppm per combination live in `localStorage` (`tr.ajustes`, `tr.record.*`).

Files in this folder:

- `motor.js` — UMD, pure, runs in Node. The word banks (`PALABRAS`, `FRASES` = traditional proverbs, `CUENTOS` = short stories written for the game; never paste copyrighted text), `ajustes()`, `palabras(aj, semilla, n)` and the typing state (`crear`, `escribe`, `espacio`, `retrocede`, `cuentas`).
- `vista.js` — UMD, the typing box shared by both (three scrolling lines, sliding caret, `crearSonido`). It injects its own CSS once (`#tr-estilo`); colours are `--tr-*` variables set by the host (`.jg-tr` in `juegos.html`, `:root` in `estilo.css`).

Rules and traps:

- **`palabras()` must keep a stable prefix**: asking for 300 words starts exactly like asking for 50. Free mode (`largo: 0`) grows the text with it while typing, and in a room every tab generates the text from the room seed. Consume the PRNG strictly in order.
- **Typing goes through the value of a transparent `<input>`, not keydown.** Dead-key accents, phone keyboards and IMEs only arrive as «the field now says X». `escribe` counts only chars appended at the end; `espacio` closes the word right or wrong (Monkeytype); backspace on an empty field returns to the previous word only if it was wrong. The last word closes by itself when correct. One `input` event can close several words (phone autocomplete), so `refresca(desde)` repaints from the word where the event started — painting only around the current word left typed words grey.
- **ppm** = correct chars of correct words (+ their spaces) / 5 / minutes; raw counts everything.
- **The reducer never sees letters.** The log carries `arranca {at}`, `meta {at, ok, c, e, p, ms}` and `corta {at}`; `at` is checked by the rules against server time (typerace is in the `jugadas/$n/at` list). Start = `arranca.at + TR_CUENTA_MS`. The cut is the deadline (`final: "tiempo"`, always for free mode) or the first finished `meta` (`final: "primero"`); after it only metas within `TR_HOLGURA_MS` count, and none as finished. `ms` is clamped to what has really elapsed since the start. Ranking (`clasificaTyperace`): finished by time, then unfinished by correct chars and fewer errors.
- `arranca` and `corta` are written in a relay (first active seat, then +1.8 s per seat), as in Momazo. Each tab sends its own `meta` when it finishes or sees the cut, and retries until the reducer counts it.
- `ajustesTyperace` in motor.js duplicates `ajustes()` here because motor.js imports nothing (tests eval it). `tests/typerace.test.cjs` checks both agree; change both.
- Live track: `fb.tetrisVivo`/`watchTetrisVivo` (`vivo/<pid>/t/<uid>`), ~2 writes/s and only when changed. Never put progress in the log.
- A one-runner room (host presses Empezar) is practice: `anotar` skips it, so it does not rank.
- The room is always dark (like the Tetris pit), so it has no dark-mode twin. Sound goes through `salidaFx()` (effects bus); the practice loads `volumen.js`.
