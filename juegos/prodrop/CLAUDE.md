# PRODROP — notes for Claude

Card-pack opener inside Juegos. Coins it spends are computed in `colabtex/src/juegos/monedas.js` (`docs/claude/juegos/perfiles-y-economia.md`). Shared architecture in `colabtex/src/juegos/CLAUDE.md`.

**PRODROP is a card-pack opener paid in coins** (`juegos/prodrop/`, its
own document in an iframe like Clue: `index.html`, `style.css`, `app.js`,
the webp cards in `cards/<rareza>/` and `cards/componentes/<tema>/`, `revela.js` (the
reveal animations), and `motor.js`, UMD on
`ProdropMotor`, shared with the page and the tests). `#cartas` (tab 🃏
Sobres) mounts it full-window (`html.jg-prodrop`, like sortEm), and
`colabtex/src/juegos/prodrop.js` (`crearProdrop`) is the postman: it sends
the account (`datos`: saldo, packs, graded, exhibited) whenever it changes
and does the three writes the frame may ask for (`comprar`, `graduar`,
`exhibir`), one at a time. The frame never touches Firebase. Plain files,
no build: bump `?v=pd-N` on its two scripts/stylesheet and in `prodrop.js`.
The cards are real people (teachers), served from the public repo like any
other file of the site. Things that hold it together:

- **Two collections, chosen per pack** (`COLECCIONES`): **Profes** (`profes`,
  17 people x 10 variants = 170, Star Wars being the tenth, epic) and
  **Componentes** (`comp`, 25 components x 11 themes = 275: realista,
  bioware, esquemático common; pixelart, void, bélico rare; halloween,
  dieciochero, arcano epic; quemado and navidad legendary). The opener asks
  which pack first (`eligeSobre`, phase `elige`), and «Cambiar sobre» goes
  back to it. **The collection is the first letter of the pack key**: the
  postman writes `p` or `c` + the push key (`fb.comprarSobre(uid, p, pre)`,
  same for `sobreGratis` and `rerollCartas`), so no rule changed (the key
  regex already allows it) and the buyer still cannot pick the contents.
  `poolDe(key)` picks the cards: `c` the components, `p` all 170 profes,
  and a key with no prefix (every pack written before collections, and
  whatever a cached old opener writes) the first `LEGADO` = 153 cards, so
  **every old pack and re-roll rebuilds exactly as before** (new cards are
  only ever appended to `CARDS`, never inserted). Inside a rarity the
  card is uniform as before, unless the pool has weights: `peso` is 3 for
  quemado and 1 for navidad, so one components legendary in four is a
  Christmas one (`elige`, and `probabilidad(...).exacta` divides by the
  pool's weight). A re-roll's ten inputs must all be of its key's
  collection (`economia` checks it; no prefix means profes), and the new
  card comes from that collection. Each collection numbers its own cards
  (`num`, N.º 12/275), the collection view has a tab per collection with a
  section per variant or theme, and the market filters by collection.
- **Reveal animations are per collection and rarity** (`revela.js`,
  `REVELA.de(card)` gives `{antes, despues}`; its particles carry their own
  `draw` and the `fxStep` loop paints them). Profes: chalk on a
  blackboard (rare), a hyperspace jump (epic), a shiny prism (legendary).
  Componentes: an oscilloscope trace that bursts into pixels (rare), Tesla
  coil arcs and an arcane seal (epic), and a short circuit (legendary):
  50 Hz hum, sparks from the corners, flickering lights, a blackout and
  the spark flash, then snow and Jingle Bells for navidad or embers for
  quemado. A navidad card's resting aura snows instead of burning.
- **A pack is derived, not rolled.** `cartas/s/<uid>/<push key>` = `{at,
  p}`, and the rule demands `at === now`. The five cards (and each one's
  hidden grade and wear seed) are `sobre(uid, key, at)`: SHA-256 of that,
  seeding xoshiro128**, with integer weights (ten-thousandths for rarity,
  thousandths for grade), so every browser rebuilds the same pack. The
  buyer cannot pick the server's millisecond, so cannot pick the contents,
  and anyone can verify anyone's legendary. The grade was decided at
  purchase; grading only reveals it.
- **Odds** (`TIERS`, `GRADE_W`, `DIOS`): 80 / 17.4 / 2.4 / 0.2 % per card,
  the fifth card rare or better, and 2 % god packs (five epic or better, at
  most one legendary: after the first legendary the rest are epic).
  `ESPERADO` is the exact expected count of each rarity per pack, and
  `probabilidad(id, g)` is what grading announces: a card of this rarity
  or better with this grade or more, per card and per pack, plus this
  exact card with that grade. `tests/prodrop.test.cjs` simulates 60 000
  packs against those numbers.
- **Prices live in the rule too.** `p === (now < 1791169200000 ? 50 : 80)`
  (launch price through 4-10-2026, until 5-10 00:00 Chile, `PRECIO.promoHasta`) and
  grading `cartas/g/<uid>/<key>/<i>` = `{at: now, p: 100}`, only for a pack
  that exists. Both write-once, never deleted: they are the spending. The
  test pins the rule's timestamp to the motor's.
- **Everything that moves coins or cards is one replay: `economia(datos)`**
  (monedas.js, memoised per `datos` object). It walks, in server-time
  order (ties: pack, grading, listing, withdrawal, sale, trade), packs
  (`cartas/s`), gradings (`cartas/g`), market listings and sales
  (`mercado/o`) and accepted trades (`mercado/t`), and produces who owns
  every copy (`dueno`), which copies are graded or listed, which packs are
  valid, and per account `gastadas`, `cobradas` and `parada`. A copy is
  named `<origin uid>~<pack key>.<i>`: the pack (so the card, its hidden
  grade and wear) belongs to whoever bought it, the copy can change hands.
  `monedasDe` = earned from games (`ganadoDe`) + `cobradas` − `gastadas`.
- **The balance can never go negative, and nothing is bought without
  money.** The rules cannot add up what was earned, so they cannot refuse
  an unfunded write from a modified client; the replay does not trust the
  writes instead. A spend (pack, grading, market purchase) counts only if
  the account is not stopped and the balance covers it; the first one that
  does not fit is void (what it bought does not exist) and **stops** the
  account from there on: none of its later actions count until its
  earnings cover the gap. Stopping, rather than skipping, is what keeps
  the accepted set growing monotonically as earnings grow. A void sale
  leaves the card with the seller and closes the listing (`impaga`). On top
  of that the frame disables the buttons and the postman re-checks every
  action against the complete read (`watchLogros` sets `completo` once all
  six nodes arrived), one at a time, so an honest client never writes an
  unfunded spend. Honest screens never offer listings or trades with a
  stopped account, which is what keeps a stopped account's later
  un-stopping from rewriting anyone else's history.
- **A free pack every 6 hours** (`p: 0`): written together with
  `cartas/gratis/<uid>` = `{at, k}` in one multi-path update; the rule on
  `gratis` demands 6 h since the previous one and that the pack it names is
  this `p: 0` pack, and the rule on the pack demands that `gratis` names it.
  The replay re-checks the spacing (`proximoGratis`).
- **The market** (`mercado/o/<id>` = `{u, c, p, at}`, price 1–100 000 set by
  the seller). `x` (withdrawn, by the seller) and `v` (`{u, at}`, bought,
  by anyone else) are each write-once and exclude each other in the rules,
  so a listing has at most one buyer. The replay accepts a listing only if
  the seller owns the copy and it is not already listed; a listed card
  cannot be graded or traded. The frame's market (🏪 Mercado) has three
  tabs: *Comprar* (filters: rarity, graded / ungraded, minimum grade only
  when graded, sort by price or newest, search by name), *Mis ventas* (my
  listings and purchases) and *Intercambios*. *Comprar* shows the seller's
  own listings too, tagged «Tu oferta» (opening one offers Retirar): hiding
  them made sellers think the listing never reached the store. A sale or a
  withdrawal is marked in the frame at once (`marcaVenta`/`quitaVenta`)
  rather than waiting for the next `datos`, so the card cannot be offered
  for sale twice in between, and the postman withdraws a listing that the
  replay does not accept as `activa` right after writing it.
- **Trades** (`mercado/t/<id>` = `{de, para, dar[1–3], pedir[0–3], at}`):
  `ok` (only `para`) and `x` (either) are write-once and exclusive, and the
  rules forbid creating one already accepted. The swap happens at `ok` if
  both still own their cards, none is listed and neither is stopped.
- **Grading** is `cartas/g/<grader>/<pack key>/<i>` with `o` (the origin)
  when the pack is someone else's: whoever owns the copy grades it, and
  the grade travels with it. There is no "grade the whole pack" button on
  purpose: it made people spend 500 coins by accident.
- **The collection comes from the replay**, not localStorage: the postman
  sends `mias` (copies owned now, including bought or received ones), the
  active listings, my sales and trades, and the cards of everyone else for
  the trade composer. The pack being opened stays out of the collection
  (`abriendo`) until the summary; a pack bought and not opened is
  remembered in `localStorage` (`prodrop.pendiente.<uid>`) and resumed.
- **One, two or three packs open together** (`cantidad`, the ×1/×2/×3
  control above the buy button and in the summary, kept in
  `localStorage` as `prodrop.cantidad`). They are bought one after another,
  each checked by the postman; if the money runs out halfway, the ones that
  went through are opened. The extra packs are decoration fanned behind the
  main one (`pintaExtras`); tearing the main one opens all of them. The
  cards go into one stack (`_sobre` says which pack each came from, and the
  banner says so). The summary has one row per pack, scrolls, and on a
  phone fits five cards to a row. `abriendo` is a Set of pack keys, and the
  unopened-pack resume in `localStorage` holds a comma list. After the
  opening, the pack's fall, its torn top and its light are **cancelled** once
  it is hidden. Left «filling», Chrome retired them on its own and kept their
  last frame. «Abrir otro sobre» then showed the next pack fallen off-screen,
  with no top.
- **Re-roll** (CS2's trade-up contract): ten copies of one rarity (común,
  rara or épica) become one of a higher rarity, any card of it with equal
  chance. Usually the next one: `SALTO_W[tier]` (ten-thousandths, one row
  per input rarity) makes común go to rara / épica / legendaria 92 / 7.5 /
  0.5 %, rara to épica / legendaria 96 / 4 %, and épica always legendary. The jump has its own hash stream
  (`"prodrop-salto:" + key`), so card and grade come from the same stream
  as before, and it applies only from `SALTOS_DESDE`: a reroll written
  earlier keeps the card it already gave. `probSalida(tier)` is what the
  panel shows. It is `cartas/r/<uid>/<push key>` = `{at: now, c: [ten copy
  keys]}`, write-once and free. Like a pack, the result is derived, not
  rolled: `PM.reroll(uid, key, at, tier, notas)` hashes all of that into
  `{id, g, w}`. Its hidden grade is a bell centred on the ten inputs'
  average **plus one** (`REROLL.bono`), σ 1.3. For 5 4 6 4 9 8 8 5 3 2,
  the average is 5.4 and the result is 6 or 7 57 % of the time. The bell is
  an integer table (`PESO_REROLL`, distance to the centre in tenths),
  because `Math.exp` is not bit-identical across browsers. `economia`
  accepts it (event `r`, between gradings and listings) only if the account
  is not stopped and the ten are its own, distinct, not listed and of one
  rarity below legendary. The ten leave `dueno`, and the new copy is
  `<uid>~<key>.0`, registered in `e.sobres` with `r: {id, g, w}`. Every
  reader of `sobres` branches on `r`: `copiasDe`, the postman's `copia`, and
  `prodrop-cartas.js`'s `copia`, `mejoresDrops` (which marks it `rr`) and
  `cifras` (which skips it). Copies sent to the frame carry `rr: {id, g, w}`, and
  the frame's `copiaDe` uses it instead of `M.sobre`. Not a top-level `id`:
  a market row is the copy plus the listing, whose `id` is the offer's, and
  that made every listing read as a re-roll and broke the market. The grading rule
  accepts `cartas/r` packs at index 0. The frame's panel (`#reroll`) picks
  the ten («Elegir automático» takes duplicates first, keeps the best copy
  of each card and leaves exhibited ones for last) and asks twice before
  sending. It shows the expected-grade bell only when all ten are graded:
  hidden grades stay hidden. The roulette (`#ruleta`, z-index 29, under the
  effects canvas) is a strip of 100 cards, mostly of the next rarity with
  some higher ones mixed in (78/18/4 %), with the winner at index 90. It
  runs right to left for 10.8 s on `cubic-bezier(.05,.68,.1,1)`, ticks each
  time a card crosses the marker (read off the live transform), and lands
  slightly off-centre on purpose. **⚡ Rápido** (`prodrop.rrRapido` in
  `localStorage`, in the panel and on the roulette) makes it 42 cards in
  2.6 s; pressing it mid-spin sets the running animation's
  `playbackRate` to 4. A jump of two or more tiers shows «¡SALTO!».
- **Exhibited cards** are `users/<uid>/perfil/cartas` (up to four copy keys
  `o~k.i`, or the old `k.i` meaning one's own pack; validated by regex in
  the rules), shown only while that account still owns the copy, toggled from the card's zoom. The
  profile editor does not know them, so `editaPerfil` carries them over or
  saving the profile would erase them. They show on the profile page and
  the mini card through `exhibidasDe`, which only resolves keys that are
  packs of that account.
- **Two card tables in the Clasificación** (the **Cartas** button under
  PRODROP; the key is `prodrop`, because `cartas` is already Cartas de los
  tres elementos). Both come from the economy replay through `ctx.datos`
  (`datosPerfil`), never from `ranks`, and both use the owner of *now*
  (`e.dueno`, so a card bought or traded moves with its buyer).
  `rankingColeccion` is the top 10 by distinct cards owned out of
  `PM.TOTAL` (repeats count once; ties: more legendaries, then more
  copies). `cartasMasRaras` is the top 10 **graded** copies by
  `probabilidad(id, g).exacta`, the chance grading announces of pulling that
  card with that grade or better; an ungraded grade is hidden, so it does
  not rank.
- **Últimos drops** (`#vesDrops`, a horizontal strip right under
  Novedades, grid area `tira`): `mejoresDrops` lists epics and legendaries
  of valid packs only, in the order they came out (newest first), with who
  pulled them and when.

The `cartas` and `mercado` nodes and `perfil/cartas` need the rules re-published.
