# Flip 7 — notes for Claude

Screen: `colabtex/src/juegos/flip7.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Flip 7 (`flip7`) deals from a deck nobody controls.** A shared deck
cannot come from the room's public seed — anyone could read the next card from
the console and know when to stop — and it cannot come from one player's
secret either, because that player would know. So every card drawn is decided
by **two contributions**: the receiver's and that of the next seat still in the
game (`espera.k === "roba"`, `faltan`). A contribution is `aporteF7(sem, sal,
n)`, the first 32 bits of SHA-256 over the player's *private* seed (the same
`misPartidas/<uid>/<pid>/sec` cartas uses, committed as `hmazo`) and the draw
number `n`; `indiceF7` combines them into an index into what is left of the
deck. Neither can steer the card without knowing the other's value, and the
second one to write cannot have seen the first's future ones. A `pide {n, v}`
carries the asker's own contribution so asking is one write; the rest arrive
as `{t:"r", uid, n, v}`, sent **by the screen on its own** after `PAUSA_ROBO`
(`PAUSA_RONDA` at the start of a round, so the summary can be read). At the end
every player publishes `{t:"s"}` exactly as in cartas and `auditaFlip7`
recomputes every contribution: a lie is `que:"carta"`, a seed that does not
match its `hmazo` is `que:"semilla"`, and one never revealed is only
`que:"oculta"` (soft yellow notice, not the red one — closing the tab is not
cheating). `flip7.js` calls `terminar` once everyone still seated has revealed
or after `ESPERA_SEMILLAS`, and **keeps re-arming that check every second until
`fin` is really written** — `terminar` can fail (a transaction lost, a network
blip), and `cierre` used to stop at the first try, leaving the room open
forever on a finished board.

**An absent contributor must not freeze the table** (`aportesDe`, the
*suplentes*). The designated pair is receiver + next seat, and either one can
be asleep — a background tab, a locked phone — which left every draw waiting
for good: the most common "se queda pegada". If both designated values are in,
they are used; otherwise the card comes from the first K contributors present
in preference order (receiver, then the others by distance at the table), with
K = max(2, min(3, seated − 1)) and the values combined `[a0, a1 ^ a2]`. Two at
the table have no suplente. The `roba` espera lists them (`suplentes`), and the
screen of a suplente waits `SUPLENCIA_MS` (6 s) plus `SUPLENCIA_PASO` (2 s) per
rank before sending (`papel()` in `flip7.js`). That delay lives only on the
screen — moves carry no timestamp and the reducer cannot enforce time — so the
accepted price is written down: a helper running a modified client can withhold
its value to force a re-draw by the suplentes (it re-rolls the card, it cannot
choose it), and with three seated a hasty suplente can jump in early; with four
or more it needs an accomplice. Every contribution still goes through the audit.
What suplentes cannot fix is an absent player on **their own** decision
(`decide`/`elige`). The others wait, and after `AVISO_ESPERA` (10 s) the
table names who it is waiting for and points to the vote to expel them. In a
duel, where there are no suplentes, that vote is also the only remedy for a
rival whose tab has gone to sleep.

**Nothing in `flip7.js` depends on a single one-shot timer firing.** Timers
get lost: a background tab throttles them, a locked phone freezes them, and a
failed write never re-armed them. Each of those left a table stuck for good,
which is how "I lost, then a card came and I couldn't play" happened. Four
things close those gaps:

- **A heartbeat.** Every `LATIDO_MS` (2 s), `late()` re-runs `automatismos()`
  and repaints. It also throws away a contribution timer that should have
  fired more than 4 s ago, un-sticks cards left `enVuelo` by an animation that
  never finished, and retries `cierre()` on a finished board.
- **A timeout on every write.** `conTope` releases the buttons after
  `ENVIO_MAX` (12 s). A transaction with no network does not fail, it waits,
  and meanwhile «Pedir carta» stayed greyed out with no way out. If the move
  did reach the database, the reducer ignores the repeat.
- **Retrying a contribution that failed.** It is retried after 1.5 s instead
  of only being unmarked.
- **No delay for a hidden designated tab.** It sends its contribution at once
  instead of after `PAUSA_ROBO`. The pause exists so someone watching sees
  the card fly, and a hidden tab is watching nothing. Suplentes still wait,
  or they would always get in first.

Three smaller holes of the same family: a `jugar` that returns false resets
`enviadoN` so the contribution is retried instead of being marked as sent;
`alVolver` re-arms the contribution timer, because the browser throttles a
background tab's timers and one armed there can fire far too late; and the ghost view (below) applies
**only while `espera.k === "roba"`**, i.e. while the dealer is actually dealing
— when the new round's first card was an action card, the ghost hid the target
buttons and the game waited for a choice nobody could make.

The two modes are one reducer (`redFlip7`, `modoF7`, `mazoF7`): **normal** is
the 94-card box (0, 1×1 … 12×12, six modifiers, Freeze / Flip Three / Second
Chance); **venganza** is the 108-card Vengeance deck (numbers up to 13, the
unlucky 7 that throws the line away, the lucky 13 that may repeat, the Cero
that scores nothing unless it makes Flip 7 and **forbids standing** while there
are cards to draw, negative and ÷2 modifiers, and the take-that actions: Swap,
Steal, Discard, Just One More, Flip Four). Rules that are easy to get wrong:
an action may target any player still in the round, a Swap or a Steal can make
the receiver bust, and Flip Three/Four cards that come up mid-series are set
aside (`aparta`) and resolved after it. The game ends at the end of the round in
which someone reaches `F7_META` (200), and the highest total wins — not the first
to cross; a tie at the top plays one more round. `tests/flip7.test.cjs` plays 30 full robot games per mode and
checks that each one ends, pays out what `rondas` says and passes the audit,
and that a forged contribution or seed is caught and attributed to the forger.
The labels are in `MODOS_F7` ("Normal", "Vengeance", "Super Vengeance"); the
stored keys stay `normal`/`venganza`/`super`, because `venganza` is already
written in existing rooms and in the rules' `modo` whitelist.

**Super Vengeance (`super`) is Vengeance plus 24 cards and two rules.** The
deck is Vengeance's 108 **in the same order** with the new ones appended
(132 in all), so Vengeance's card indices never move. What it adds:

- **Fourteen 14s** (`catorce`): twelve worth 14, one −14, one 0, and any two
  of them bust whatever they are worth — repeats are counted by `claveF7`,
  which is the value except for a 14. The −14 can drag the numbers below
  zero, and in Super **nothing is floored at 0**: a hand that adds up
  negative (the −14, a "−x") scores that negative, and it comes off the
  total, which may itself go below zero. A busted/killed row still scores 0 —
  that is the rule, not a floor. Vengeance and Normal keep their floors.
- **Three Second Chances, two Cambio de manos (`trueca`), two Fulminar
  (`mata`), three Comodín.** `trueca` swaps two players' whole hand (numbers,
  modifiers, stored Second Chance — not planted/frozen, which belong to the
  seat); the chooser may be one of the two (choice type `p2`). `mata` busts
  any other player still standing. The comodín (choice type `n`) goes **only
  into the drawer's own row** (its `uids` is just `[quien]`, so it cannot be
  used to bust someone else by handing them a number they already hold) as a
  number 0–14 the player picks — on screen, clicking the number plays it, and
  the numbers already in the row are struck through; it lives in `nums` like
  any number (`esNumeroF7`), and its value is **not in the card** but in the
  round's `com` map (id → value), because the same card can come back later
  worth something else. That map is looked up by id, so it travels with the
  card through a Steal or a Swap, and it is snapshotted into `finRonda.com` for
  the ghost view and the summary.
- **Negative modifiers hit the total when the round scores nothing**
  (`golpeF7`): if the numbers add up to exactly 0 — busted, killed, Cero without
  Flip 7, no numbers — the ÷2 and the minuses apply to the accumulated total
  instead (`aplicaGolpeF7`, no floor) at round close. A round that is already
  negative keeps its modifiers: it goes to the total anyway. `rondas[].aj` records
  what the total lost outside the round, so `Σ(pts + aj)` is still each
  player's total.
  That is also why, in Super only, a negative or ÷2 card can be **aimed at a
  player who already busted** (or was fulminated) — their round is 0, so it
  lands on their total: they get hit after they are dead. In Vengeance the
  same card on a busted player would do nothing, so it is not offered.
- **Flip 7 is a choice** (espera `bono`, move `{t:"bono", a}`): before the
  round closes the Flip 7 player picks `+15` for themselves (`a` = own uid) or
  `−15` off another seated player's total (it may go negative). It is stored in
  `l.bono` (`""` for self, the victim's uid otherwise) and `valorLineaF7` drops
  the 15 when it is a uid.

The `super` mode value needed the rules' `modo` `.validate` widened, so it
needs the rules re-published before a Super room can be created.

**The Flip 7 screen is a round table with a croupier, and everything on it is
retold from `hist`.** `redFlip7` keeps the last 40 events (`hist`, each with an
`e`: `carta`, `pide`, `planta`, `pasa`, `f7`, `congela`, `ronda`, …) and
`flip7.js` diffs it between repaints (`nuevosDe`) to decide what to animate,
never the state — the state says where a card *is*, the history says that it
*arrived*. Things worth knowing before editing it:

- **The table is a half moon with the croupier on the flat side**, as in a
  casino: players only use the curved half, and the straight edge is the
  dealer's rail with the discard tray, the showcase (a mark printed on the felt
  where an action card waits for its target) and the shoe, each with a brass
  plaque (`.jg-f7-cuenta`) under it. Seats are **placed by hand per player
  count** (`PUESTOS`, percent of `#f7Asientos`, you always at the bottom
  centre) — an even spread over an arc made six seats overlap and push the
  end ones through the rail. With an even count "you" sit at index
  `⌊(N−1)/2⌋`, i.e. just right of centre beside another seat. Five to eight
  players get compact seats (smaller cards, `.jg-f7-sala[data-n]`), seven
  and eight a taller room (980 px) and narrower seats, nine and ten 1260 px
  and narrower still, and the room's height
  per count lives in two
  places that must agree: the CSS `[data-n]` rule and `ALTO_SALA`, which the
  head-turn angle is computed with. `.jg-f7-sala` has only absolutely
  positioned children, so inside `.jg-tablero` — which is
  `place-items:center` — it **collapsed to width 0** and the table was a brown
  sliver; hence `.jg-f7 .jg-tablero{place-items:stretch}` and an explicit
  `width:100%`. Below 720 px the half moon is dropped and the seats become a
  two-column grid with you last, full width.
- **The croupier deals with a real arm.** The SVG is only the torso and head
  (whose eyes turn to the seat receiving, `mira()`); the arm is an HTML
  element (`#f7Brazo`) anchored at the shoulder and rotated/stretched by
  **measuring** where the target seat is (`--ang`, `--l`), because an SVG arm
  inside the dealer's own viewBox could not reach a seat outside it. At rest
  (`reposa()`) the hand lies on the felt beside the shoe, not over it — resting
  on the shoe covered its top card. Each new card is a real element flown from
  the shoe's `.jg-f7-tope` to the seat (`lanza`, counted in `vuelos`) and the
  seat does not show it until it lands (`enVuelo`), so a card is never in two
  places. A hidden tab flies nothing and keeps the last one in `pendiente` for
  `alVolver`.
- **Sound follows the history, like everywhere else**: `madera` (knuckles on
  the table) when someone asks for a card, `reparte` for each card that flies,
  `planta` on standing, `revienta` on busting, `flip7` for seven distinct
  numbers, `hielo` for a Freeze. When several land in one repaint only the most
  important one sounds (the `orden` list), or a bust and a stand at once were
  noise.
- **The end of a round is a summary, not a jump.** The reducer starts the next
  round in the same move that closes this one, so while the new round has no
  card on the table yet the seats keep showing the lines that just closed
  (`fantasma()`, read from `est.finRonda`, and only while the espera is a
  `roba`) under the round summary. At the end of the game `trasVuelos` holds that
  summary for `FIN_MS` (2.2 s) and only then calls `ctx.listo`; `ocupado()` is
  `vuelos > 0 || Date.now() < finHasta`, which is what keeps `pintaFin` from
  covering the last card with the cartel.
