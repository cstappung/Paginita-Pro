# UNO — notes for Claude

Screen: `colabtex/src/juegos/uno.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**UNO (`uno`) has five versions over one reducer** (`redUno`, `MODOS_UNO`:
`clasico`, `nomercy`, `nomercyx`, `allwild`, `liar`), chosen when the room is
opened and stored in `modo` like Flip 7's. The problem is the usual one here
with no server — every hand secret, nobody choosing what they draw — and it
is solved by four pieces (the long version is the comment above `MODOS_UNO`):

- **Every player draws from a deck of their own.** Card number k that `u`
  draws is `mazo[H(sem, sal, mezcla, k) mod largo]` (`cartaUno`): their
  private seed from `misPartidas/<uid>/<pid>/sec`, as in cartas, Flip 7 and
  cacho, and a `mezcla` nobody knows until the game starts. It is sampling
  with replacement from the version's box, so the proportions are the box's
  and the deck never runs out. The mezcla comes out of a commit-and-reveal
  start: the ficha carries `hcad = H(arr)`, each screen sends `arr` by itself
  (`{t:"k"}`), and the mezcla is the hash of all of them — so nobody can shop
  for a seed with a good hand.
- **The reducer only knows how many cards each hand holds.** It also keeps
  `ops`, a list of what happened to each hand (drew n, played this, discarded
  that colour, swapped), and each screen replays it with its own secret to
  know what it holds (`repasaUno` → `manoUno`). Everyone else is card backs.
- **What is not shown is promised with a hash or sealed.** Liar's face-down
  cards are played as `H(carta + ":" + sal)` (`tapaUno`, codes starting with
  `~`), and hand swaps — No Mercy's 7 and 0, All Wild's forced swap — travel
  as **sobres**: the hand encrypted with a Diffie-Hellman key between the two
  players (RFC 3526 group 14, public key `pk` in the ficha, private key
  derived from the seed so the audit can check it). The reducer waits for
  every envelope (`espera.k === "sobres"`) and applies them at once, which is
  what the 0's rotating hands need.
- **At the end everyone reveals `{t:"s"}` and `auditaUno` replays the whole
  game with every hand visible**: each card played was in the hand, the
  draw-until-playable stopped where it should, the answer to a +4 challenge
  was true, each envelope held the real hand. A liar is named in red, as in
  Flip 7. The price, said aloud in the code: whoever opens the console can
  compute what *they themselves* would draw next — their deck is theirs.
  They cannot change it, nor see anyone else's.

What the screen sends by itself, without asking — the start key, the
envelopes, the answer to a +4 challenge, the face-down card when doubted — is
exactly what only that browser can send and the whole table is waiting for;
`uno.js` has the same heartbeat (`LATIDO_MS`) and write timeout (`ENVIO_MAX`)
as Flip 7 and cacho for the same reasons. `est.debe` says who owes something
now (it can be several: the No Mercy + expansion coin toss, the envelopes),
and `meToca` reads it. Three versions add a way out besides winning: in No
Mercy a hand that reaches `UNO_TOPE` (25) is **eliminated** (`elim[u]`, its
count set to 0 on purpose so the seat reads empty), and the last one standing
wins with `motivo: "piedad"`; otherwise it is `motivo: "uno"`. Forgetting to
call UNO leaves `olvido` set until the next player acts, and anyone can
`{t:"pilla"}` in that window for two cards. The history is written in the
second person for the viewer (`verbo`, `ati`: «duda de ti», never «de tú»).
`tests/uno.test.cjs` plays robot games in every version to the end and
through the audit, and checks that the audit catches a card that was not in
the hand, a forged envelope and a short draw-until-playable, and that a false
start key does not start the game. The `uno` game and its `modo`
values needed the rules' whitelists widened, so it needs the rules
re-published before a room can be created.

**The UNO table is a scene, and everything on it is retold from `hist`**
(`uno.js`), the way Flip 7 does it: the state says where a card *is*, the
history says that it *arrived*. Things worth knowing before editing it:

- **Seats sit on an ellipse around a felt** (`--x`/`--y` per seat, you at the
  bottom), and below 720 px they fold into a strip above a shorter felt. The
  table is **always dark**, in both themes: `.jg-uno` repaints the shared
  chrome (`:root .jg-uno .jg-barra`, `.jg-pie`, `.jg-nota`…) because the dark
  block's rules are (0,2,1) and would otherwise win over a lighter table.
  There is no `html[data-tema=oscuro] .jg-un-*` twin on purpose.
- **Cards fly in a layer hung off `<body>`** (`.jg-un-vuelos`, WAAPI arcs in
  `vuela`), because the seats and the hand repaint by signature and a card
  inside them would vanish mid-flight. `vuelos` counts what is in the air and
  `ocupado()` is `vuelos > 0`, so `pintaFin` never covers the winning card.
  The top of the discard stays covered (`topeTapado`) until its flight lands
  (`aterriza`). `animaSucesos` puts the flights and the shouts (`grito`) of one
  repaint on a timeline, so three cards drawn arrive one after another.
- **The hand is a fan animated with FLIP** (`setMano`). The button
  (`.jg-un-hueco`) carries the fan's fixed transform, and hover/selection lift
  only the card **inside** it. Lifting the button itself moved it out from under
  the pointer, lost the hover and made the card flicker. The inline `z-index`
  that orders the fan is why hover and `sel` need `!important`.
- **The turn beam (`#unFoco`) is measured, not placed.** `apunta()` reads the
  angle from the beam's centre to the active placa and unwraps it
  (`angAcum`), so going from the right seat to the left one turns the short
  way instead of sweeping across the table. The ring under the piles
  (`.jg-un-giro`) turns with the direction of play and flips under `.inv`.
  The felt's aura follows the colour in play through `@property --aura` (a
  registered `<color>`, which is what lets it transition), keyed on the
  sala's `data-tinte`. It is not `data-col`, because that is the attribute
  of the colour buttons and a click on the felt would read as a choice.

**UNO No Mercy's roulette is played by its victim**: the victim picks the
colour (not whoever threw the card) and then draws one card at a time with
the button until that colour comes out.
