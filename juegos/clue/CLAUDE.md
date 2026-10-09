# Clue — notes for Claude

Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`. The room postman is `colabtex/src/juegos/clue.js`.

**Clue (`clue`) is a deduction game in an iframe, dealt with mental poker
so that nobody (not even the host) knows the envelope.** `juegos/clue/` is
its own document: `js/motor.js` (UMD `ClueMotor`: data, the 24x25 board,
movement, the reducer and the SRA crypto), `js/mesa.js` (practice table,
you against bots), `js/bots.js` (the deduction bots), `js/red.js` (the
online side of the frame) and `js/main.js` (the screen). The board is the
building filmed in a walkthrough video: three rooms on the second floor
(lockers, emergency landing, window corridor) and six on the first, the
courtyard in the middle holding the envelope, and two secret passages
(the stair and the goods lift). There are nine weapon slots, one per
room at the start, 24 cards in all. Which weapon fills each slot is drawn
per room from the seed (`armasDePartida`, returned as `est.armasPartida`):
3 to 5 of the six classic ones from the building (with their video photo)
and the rest from the nine electrical ones (Smith chart, Fourier
transform, resistor, capacitor, inductor, transistor, power supply, op-amp,
LED). A weapon card is still its slot; `M.arma(armasPartida, a)` gives
the catalog entry. `js/armas.js` (`ClueArmas`, keyed by catalog id) draws
each one, with a short feedback effect (`chispa`) and a murder scene
(`escena`) that plays on the end screen for the weapon in the envelope. `colabtex/src/juegos/clue.js` (`crearClue`)
is only the postman, like Yemas'. Things that hold it together:

- **One engine, three users.** `motor.js` of colabtex cannot import (the
  tests load it in a `vm` with the `export`s stripped), so `redClue` reads
  `globalThis.ClueMotor`, which `clue.js` sets when it imports the UMD file.
  `redClue` drops the engine's own `jugadores` so the room's (with photo and
  colour) survive. The reducer never exponentiates.
- **Characters are chosen, not fixed.** The six suspects are six coloured
  slots; each player picks a character first (`{t:"elige", r}`), seat i
  plays slot i, and free slots are filled from the roster with the seed.
  The roster is real people (names and photos), so it is **not in the
  repo**: it lives in the RTDB node `clueElenco` (read with a session,
  written by hand in the console, see `firebase/CONFIGURAR-FIREBASE.md`),
  `fb.leerElencoClue()` reads it and the postman hands it to the frame,
  which caches it in `localStorage` (`clue.elenco`) for practice. Without
  it the game uses the invented `SOSPECHOSOS`.
- **The deal is Presidente's SRA, on the same 384-bit safe prime**, in
  three sequential passes of the frozen table `cr.mesa`: `mezcla` (all
  `NC` cards, exponent k1, shuffled *within* each category; the first of
  each, positions 0, 6 and 15, is the envelope), `revuelve` (the other
  `NC - 3`, exponent k2, shuffled
  together so nobody learns the category mix of a hand) and `quita` (each
  removes k1·k2 from the cards that are not theirs; card j belongs to
  `mesa[j % n]`). `red.js` does these by itself, as it does `paso` when
  you hold nothing, `abre` (the others remove their k1 from the envelope,
  in seat order, when someone accuses) and the accuser's `veredicto`.
  A shown card travels in a Diffie-Hellman envelope keyed by the
  suggestion's key (`muestra.x`).
- **The end waits for the seeds.** With `fin` written no move gets in, not
  even `{t:"s"}`, so the postman calls `terminar` only once every seated
  player revealed theirs, or after `ESPERA_SEMILLAS` (12 s), re-arming
  every second like Flip 7. A correct accuser reveals at once. `auditar`
  then replays the whole deal and flags `paso` lies, cards shown that were
  not theirs, bad passes and false verdicts. The honest limit, said in the
  manual: whoever leaves after choosing without revealing their seed takes
  their lock with them, and the game is void (`motivo: "anulada"`).
- **The end cartel waits for the frame's drama.** The screen animates the
  accusation (the envelope opening lock by lock) and the murder scene, and
  the room's fin overlay would cover them after `PAUSA_FIN`. So the frame
  posts `{tipo:"ocupado", v}` (`conexion.ocupado`), the postman exposes it
  as the module's `ocupado()` and calls `ctx.listo()` when it drops, like
  Chain Reaction's replay; `OCUPADO_MAX` (15 s) releases it if the frame
  never does. A wrong accuser peeks into the envelope (`priv.sobre`), as in
  the board game.
- **Dice come from the seed, the turn number and a hash of the accepted
  moves** (`huella`), so they are the same on every screen and cannot be
  known turns ahead; rejected moves do not enter the hash, or writing junk
  would re-roll the next turns.

`tests/clue.test.cjs` covers the board, movement, the reducer and the crypto
end to end; `tests/clue-bots.test.cjs` plays full practice games;
`tests/clue-red.test.cjs` runs several `red.js` frames against a fake room
through a whole online game and checks the audit comes out clean.
