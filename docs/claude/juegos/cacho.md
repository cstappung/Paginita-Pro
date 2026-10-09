# Cacho — notes for Claude

Screen: `colabtex/src/juegos/cacho.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Cacho (`cacho`) has no dealer, and its dice come out of a hash chain.**
Each player's dice must be secret, nobody may choose them, and there is no
server to roll them. So on joining a room each browser computes, from its
private seed (the same `misPartidas/<uid>/<pid>/sec` as cartas and Flip 7), a
chain `e0 = H("cacho:" + sem + ":" + sal)`, `e1 = H(e0)` … `e300`
(`cadenaCacho`, `CC_CADENA`), and publishes only the tip as `hcad` in the
write-once ficha. The key of round `r` is `e[299 − r]` (`llaveCacho`): its
owner has known it since the start, nobody else can compute it, and anyone can
check it once revealed, because its hash is the previous round's key
(`llaveBuena`). A round's dice are `dadosCacho(llave, mezcla, k)`, where the
`mezcla` is every key revealed when the *previous* round was uncovered — so
nobody knows even their own dice before the round starts, and nobody knows
anyone else's until the uncovering. Round 0 is the `arranque`: everyone reveals
key 0, and that mezcla decides round 1's dice and who opens, with nobody
choosing either. Points worth knowing:

- **The check runs inside the reducer**, unlike Flip 7's asynchronous audit.
  That is why `motor.js` carries a hand-written, synchronous, memoised SHA-256
  (`sha256hex`) — `crypto.subtle` is async and the reducer cannot wait — with
  the round constants written out rather than computed with `Math.cbrt`, since
  two browsers rounding the last bit differently would see different dice. A
  key that does not fit the chain does not count: the table keeps waiting for
  the real one, `est.falsas` names the liar in red, and the vote can expel
  them. The price is that a game can last at most 300 rounds; hitting that
  ends it as `motivo: "tope"`: the most dice wins, and a tie is a draw.
- **Keys are sent by the screen, not by the player**: whenever
  `espera.k === "llaves"` and your key is missing, `cacho.js` sends
  `{t:"k", uid, r, c}` by itself. Same heartbeat (`LATIDO_MS`) and write
  timeout (`ENVIO_MAX`) as Flip 7, for the same reasons — a lost timer or a
  write with no network must never leave the table stuck.
- **The rules** (`minimoCacho`): aces are wild unless the bet is on aces or
  the round is *obligada*; going to aces needs `⌈c/2⌉`, coming back from
  them `2c + 1`, and opening on aces is only allowed with one die left.
  **Calzar** (claiming the bet is exact) is allowed only while at least half
  the initial dice are still on the table — holding one die is no exception;
  right wins a die back (up to five), wrong loses one. The next round opens
  with whoever lost, with whoever calzó after a calzo, and with the same
  opener after an annulled round — an abandono mid-round annuls it, since
  that player's cup can never be uncovered.
- **El paso** (`pasoCacho`): with a bet on the table, one player per round
  may pass instead of raising and the bet stands. A valid pass needs exactly
  five dice, with all dice
  equal, all different or a full house (faces as they are, no wild aces), but
  it can be bluffed: only the **next** player may doubt it (`dudapaso`), and
  once they raise it is accepted. Doubted, only the passer's cup is lifted
  and whoever was wrong loses one die. Not offered in an obligada round,
  where nobody knows their own dice.
- **Obligar** (once per game, the opener with one die; torbellino is also
  available in a duel, while abierto/cerrado require three players) picks one of three modes, and in all of them aces are not wild. The
  dice of an obligada round are rolled **after** the choice:
  `mezclaObligada` mixes in the hash of *every* player's key for this round,
  so nobody — the obligator included — can know them until all keys are out.
  **Abierto** reveals every key at once (`etapa: "muestra"`), `est.abiertos`
  carries every cup and the screen hides your own; the obligator opens and
  the pinta never changes. That hiding is only the screen's — the tab has the
  data to compute its own dice, the same honest limit as the escondite.
  **Cerrado** shows nothing to anyone; bets are «X de esta» (`p: 0`), the
  pinta being the obligator's single die, resolved at the uncovering, and
  only the count goes up. **Torbellino** has no bets: the obligator names a
  pinta, the round is uncovered at once and every cup loses the dice showing
  it, the obligator's too; they open the next round if they still have dice.
- **Partida siciliana** (`sicil`, chosen at room creation): doubting the
  *first* bet of a round risks two dice, for whoever was wrong. It punishes
  the opening bluff and the reflex dudo, which are what make a cacho game drag
  on without anything happening.
- **The cups lift one by one.** `ultimo` carries `orden` — from whoever dudó
  or calzó, in the round's direction — plus every cup's dice, the count and
  the verdict; the screen lifts one cup every `pasoMs`, keeps a running
  «Van k de c» in the middle, and only then shows who loses. Clicking the
  table skips to the end. `ocupado()` covers the replay, so `pintaFin` never
  covers the last uncovering, and `PAUSA_FIN.cacho` adds its grace.
- **Sound follows `hist`**, like Flip 7: the cup rattle (`cubilete`) when a
  round starts, `dado` on each cup lifted.
