# Cartas de los tres elementos — notes for Claude

Screen: `colabtex/src/juegos/cartas.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**In `cartas` each hand is dealt from a seed only its owner knows.** The deck
used to come from the game's *public* seed, which meant either hand could be
recomputed from the console — so both were dealt face up and the game was
"guess which of those five they will play". Now, on creating or joining a room,
each browser draws its own `{sem, sal}` and writes it to
`misPartidas/<uid>/<pid>/sec`, the one node the rules let **only its owner
read**; what goes into the public ficha is `hmazo = compromiso(sem, sal)`, and
the ficha is write-once, so nobody can redraw a better hand halfway through.
The opponent's cards are therefore not hidden by convention but genuinely
unknown, and `caManoOtro` paints backs. The seeds are published as a
`{t:"s", uid, sem, sal}` entry **at the end**, which is what lets both browsers
verify afterwards that the hands really were the promised ones — hence the
`jugada.t !== "s"` exception in `jugar()`, the one write the "the game is over"
gate has to allow. Rooms created before this still exist, so `cartas.js`'s
`miMazo()` falls back to the room's public seed for a player with no secret of
their own — a half-played duel should not become unplayable.

What the reducer cannot check by itself is that the revealed card is the
promised one — verifying a hash is asynchronous and the reducer is synchronous
by design (it runs on every repaint) — so `auditaCartas` does it separately, in
**both** browsers, and a mismatch prints the offender's name in red on both
screens.

**A card is a picture, and the suit is drawn around it.** The 36 PNGs in
`juegos/cartas/` are full card faces; with 36 images against a 216-card deck
the element cannot come from the art, so the colour is the thick `.jg-arte`
frame plus the `.jg-c-palo` label, and the element is a seal in the corner
(`.jg-c-el`). The box is 96×142 (164:242, the files' own ratio), and
`precarga()` pulls all 36 in the background — a card that arrives while it is
being flipped reads as a glitch.

**The cartas screen is built so nobody gets lost** (`cartas.js`), which was
the complaint: the old one showed a row of loose trophies and a hand in deal
order. Now:

- **Each player has a board of three columns** (fire, water, snow), chips
  grouped by colour inside each, and under yours a hint of what is missing
  («Ganas con …» / «Gana con …» for the rival, `faltaPara`). A chip just won
  drops in (`.jg-llega`); the ones that make a trio glow.
- **The hand is sorted** by element and then number (`miMano`), a card just
  dealt pops (`jg-nueva`), and a card that would win the game wears a «¡Trío!»
  ribbon (`jg-decisiva`, only while `fase === "jugando"`). Tapping a card
  selects it and tapping it again plays it.
- **The legend of what beats what is always on screen** (`.jg-ley`), and the
  pill that decided the round lights up during the clash.
- **The clash is staged like Card-Jitsu**, all in CSS delays off one repaint:
  both cards slide in and flip (0.2 s), the winner lunges (1 s), the loser
  takes the element's hit (`.jg-fx-fuego/agua/nieve/num`) and greys out, the
  verdict and a one-line *why* (`porQue`) appear, and the winner flies to its
  owner's board (2.7 s). Winning with a 10–12 adds the strike (`efectoGolpe`),
  a tie the smoke (`efectoHumo`), both delayed to land with the hit. The
  whole thing lasts `CHOQUE` (3.6 s) and `ocupado()` covers it, so `pintaFin`
  does not cover the clash that won the game; after it, the remate shows the
  winning trio. A clash that arrives in a **hidden tab** is kept in
  `pendiente` and played on return (`alVolver`), for the same reason as in
  Chain Reaction. One trap: the trio cards take `--k` on a wrapper
  (`.jg-rt`), because `htmlCarta` already writes a `style` and the browser
  ignores a second `style` attribute.
