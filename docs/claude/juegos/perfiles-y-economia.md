# Juegos — profiles, frames, shop, ranking, logros, coins

`perfil*.js`, `marcos-animados.js`, `tienda.js`, `ranks.js`, `logros*.js`, `monedas*.js` in `colabtex/src/juegos/`. Read this when adding a game (its logros, `NIVEL` digits, coins, champion frame) or touching any of those. Shared architecture in `colabtex/src/juegos/CLAUDE.md`.

**Everyone's apodo, foto and colour live in `users/<uid>/perfil`**
(`juegos/perfil.js` for the editor, `fb-juegos.js` for the three calls). Not in
the ficha: the ficha is written once by rule — so nobody renames themselves
mid-duel — and its `foto` is capped at 400 characters by `.validate`, which
fits a Google URL and no uploaded photo at all. Three consequences:

- **The live profile is laid over the frozen ficha at paint time**, in
  `juegos-main.js`'s `vistePerfiles(est)`, right after `reducir()`. That is why
  **no game module had to change**, and why changing your apodo changes it in
  yesterday's games too. It writes **into** each ficha with `Object.assign`
  rather than substituting the object, because `auditaCartas` holds references
  to those very objects.
- **A photo that would not fit goes out as `""`** (`fotoBreve`). Sending a
  ~13 kB data URL to `jugadores/$uid/foto` or `ranks/$juego/$uid/foto` does not
  merely look wrong: the `.validate` rejects the **whole write**, so creating a
  room would have failed with `PERMISSION_DENIED`. The real photo only ever
  lives under `users/`, which has no cap, and reaches the screen through the
  overlay.
- **Profiles are watched on demand**, one listener per uid asked about
  (`perfilDe`). Reading `users` whole would download the profile of everyone who
  has ever opened ColabTeX in order to paint two names. And `users/$uid` is
  already readable by anyone signed in and writable only by its owner, with no
  validation — so this needed **no rules change**, which after Reversi is a
  feature in itself.

**Everyone has a public profile: a card and a page** (`juegos/perfil-tarjeta.js`,
pure, and `juegos/perfil-vista.js`, the DOM). Clicking any element with
`data-perfil="<uid>"` opens the mini card. One document listener,
`alTocarPerfil` in `juegos-main.js`, handles every such element: the header
avatar, the room's player chips, chat names, ranking rows and podium, and
the names in Logros. Tapping the same element again closes the card. On
desktop it is anchored to the element; at ≤600 px it is a bottom sheet. It
shows the background, the photo with its frame, the bio, three numbers and
the first three pieces of the vitrina, plus **Ver perfil**, which opens
`#perfil/<uid>`. The page holds the hero, five totals, the whole vitrina,
every ranking table with its position, and the logros grouped by game.
The header's **Perfil** goes to your own page, and **✎ Personalizar** opens
`abrePerfil`. That editor has four tabs (datos, marco, fondo, vitrina) and a
live preview of the card.

Four decisions:

- **No rules change.** The new fields `marco`, `fondo`, `bio` and `vitrina`
  live in `users/<uid>/perfil` beside nick, foto and colour. Everything
  else is computed from what Logros already reads (`fb.watchLogros`).
  There is one shared listener per session (`datosPerfil`), opened the
  first time someone touches a photo.
- **Frames and backgrounds are CSS, not images.** A catalogue of ids
  (`MARCOS`, `FONDOS`), with the `.jg-marco-<id>` classes in juegos.html
  reading `--t` (size) and `--c` (colour). The same frame works on a 20 px
  chip and a 116 px portrait. The laurel and the crown are inline SVG data
  URIs, not emoji.
- **Some are earned, and checked where they are seen.** A `req` is either a
  number of logros, a podium / first place in a table of three or more, a
  n.º 1 of a given game (`top`) or a shop purchase (`tienda`).
  `marcoVisible` and `fondoVisible` re-check it against the owner's stats
  every time they paint. A frame written into the database by hand is
  stored, but others see the plain ring.
- **The vitrina stores keys, not copies.** `l:<juego>:<id>` is a logro,
  `r:<juego>` a room ranking and `s:<categoría>` a club record. The keys
  are resolved against live data (`vitrinaDe`), so the position shown is
  today's, and anything gone drops out. Choosing nothing gives an
  automatic vitrina: the best positions, then the rarest logros.
  `limpiaPerfil` keeps only known ids, a bio of `LARGO_BIO` characters and
  up to `MAX_VITRINA` keys.

`tests/perfil.test.cjs` covers the stats, the requirements, the vitrina
and the cleaning.

**Champion frames, the shop and animated backgrounds.** Three more kinds of
frame and background:

- **Champion frames** (`req: {top}`). There is one per game, not one per
  modality: every room game, every club game (Tetris Club shares Tetris's),
  Yemas zombies apart from Yemas, plus the coins leader (`tmonedas`) and the
  PRODROP collector (`tprodrop`).
- **Shop items** (`req: {tienda}`). There are five frames and five
  backgrounds at `PRECIO_TIENDA` (5000) each. They are listed in
  `juegos/tienda.js`, which is pure so monedas, perfil and the tests share it.

The animated frames are SVG drawings in `juegos/marcos-animados.js`, and
`adorno(id)` returns them. Each drawing is a
`<b class="jg-av-ad">` that `avatarMarco` adds over the photo (inset −20 %,
so it overflows), with the class `.jg-marco-anim` hiding the static
`::before/::after`. The CSS animates them through `.jg-av-ad [class]` and
`--d`, with keyframes `ja*`. Never use `.jg-av-ad *`: it would also move
the positional `<g>`s. Animated backgrounds add a layer (`capaFondo`,
`.jg-fanim-<id>`, keyframes `jf*`). Things that hold it together:

- **A n.º 1 counts only against someone.** `campeones(datos)` takes the
  first of each table with two or more rows (room tables also need a
  point). The coins and PRODROP leaders need the whole economy, so
  `juegos-main.js` derives them once (`lideresDe`) and hands them in as
  `datos.lideres`. The purchases are under `datos.compras` (`comprasDe`, what
  `economia()` accepted). Both are lazy getters on `datosP`.
- **A purchase is `tienda/<uid>/<item>` = {at: now, p: 5000}**, write-once
  and never deleted, like a PRODROP pack. The rules cannot add up earnings,
  so `economia()` replays it with the rest of the spending (event `c`). It
  counts only if the balance covers it, and otherwise it stops the account.
  `monedasDe`'s `saldo` includes it.
- **The rules re-check everything where a frame is seen**: `marcoVisible`
  with `estadisticas(...).tops/compras`. Losing a n.º 1 shows the plain
  ring until you win it back. While the reads are partial (`parcial`), the
  stored choice is trusted, so a frame does not flicker on load.
- **Every top shows the photo with its frame**: the Clasificación (podium,
  tables, solo tables, the card tables), the coins tops (lobby and page),
  the featured podium, the drops strip and the room chips. All of them go
  through `marcoDeUid`. Child selectors (`li>i`, `li>span`) keep the
  host lists' styles out of the avatar's insides, and `.jg-av>.jg-av-ad`
  resets with `!important` whatever a host might put on a `<b>`.

The `tienda` node needs the rules re-published. `tests/tienda.test.cjs`
covers the charge, the champion rules and that every animated frame has its
drawing.

**The ranking is written by each player about themselves.** `ranks/<juego>/<uid>`
is the only row a browser may touch, so the table is the sum of what each one
noted about itself. That has a price, said out loud on the page: whoever closes
the tab before the game ends does not record it. What it does *not* allow is
inventing victories — the rules check that `ultima` names a game that exists,
has finished, is of that game, and has the writer in it, that it is not the one
already counted, and that `jugadas` goes up by exactly one. Three points for a
win and one for a draw, because ordering by wins alone ranks whoever plays
most.

**The Clasificación is a stage, not a table** (`ranks.js`): a 2-1-3 podium with
metal blocks, a crown over the first, and under it a card that tells *you* what
you need — how many points (and wins) to reach the podium, to pass the next
one, or how far ahead you are if you already lead. The table stays below for
everyone else. The entry animation plays **once per game** (`animado` holds
the key) and the scene repaints by signature (`firma`), because `watchRanks`
fires on every write and replaying the rise each time would make it twitch.

**The Clasificación opens on a General table** (`ranks.js`, key `general`):
the sum of every room game's `ranks` row (points, wins, games played, and a
«Juegos» column counting in how many games each person has a row), read
through `fb.watchRanksTodos`. The picker lists the games in the lobby's
popularity order, room games and solo games under separate labels, and the
choice persists in `jg.rankJuego`. Each game's ficha in the lobby carries
that game's top three (`podioHtml`, from the `ranks` that
`leerPopularidad()` now returns alongside the counts as `{n, ranks}`).

**Logros: ten per game, three sources, one table** (`juegos/logros.js`,
the view in `logros-vista.js`, the **Logros** tab at `#logros`). Four of
every room game's ten are **derived from its `ranks` row** (first win, ten
wins, a streak of three, 25 games) and the ten of each solo game from its best
`soloRanks` marks (`deMarca`); neither is ever written, so they are
retroactive and cannot disagree with the tables they come from. The other six
of a room game are detected **live on every repaint** (`detecta`) — `hist` is
a short window, so waiting for the end would miss what happened early — and
written once to `logros/<juego>/<uid>/<id>` (a timestamp; the rules refuse a
rewrite or a delete). A logro may name a mode (`m`) but belongs to the game.
`reparto` joins the three reads; the percentage is over people who have played
that game, not over the whole site. The tab opens on a *desafío*: the most
common logro you lack, the person just ahead and one of theirs you lack, and
the rarest logro anyone holds. The `logros` node needs the rules re-published.
`tests/logros.test.cjs` checks ten unique ids per game and that the rules'
whitelist names every room game.

**Coins 🪙 are computed, never stored** (`juegos/monedas.js`, pure; the
view in `monedas-vista.js`, the **🪙 Monedas** tab at `#monedas`, a
*Top monedas* box in the lobby's sidebar and your balance in the header).
A stored balance would be a number anyone with a console could rewrite. A
sum of things the rules already check cannot be. So, like the fila and solo
logros, the balance is derived from the same four reads the profile uses
(`fb.watchLogros`, now also listening to `diario`, through `datosPerfil`):

- **Room games** (`ranks`): `TARIFA` 20 per game, 40 per win, 20 per draw,
  times the game's `PESO` (1 for a short duel up to 3 for Catan). No daily
  cap: a room needs someone else, and playing is what is meant to be
  farmable. The tariffs are retroactive, like everything derived.
- **Club records** (`soloRanks`): `RECORD[club]` once per modality with a
  mark, so improving a mark never pays twice and the easy game cannot be
  farmed. On top of the record: BBTAN pays ⌊n/4⌋ for every round n up to
  the record (`monedasBbtan`, closed form: reaching round 5 pays 2, round
  100 pays 1 225; the per-round pay stops growing at round 450, 112 a round
  from there, and nothing past round 600 pays), sortEm pays the mode's blocks
  plus 2 per second under 3 s per block (`monedasSortem`), and the Sopa and
  Electrodle streaks 10 per day.
- **Club plays** (`clubJugadas/<uid>/<juego>` = `{dia, hoy, total, at}`):
  every club game that ends with a result pays `PAGO_CLUB[juego]` (15 to 25
  by how long a game lasts), up to `TOPE_CLUB_DIA` (15) per game per Chile
  day. **BBTAN stays at 8 and 10 a day** (`topeClub`): its record already
  pays every round, and that is what cannot be farmed. `marcaJugadaClub` in
  `juegos-main.js` writes it from `alResultado`, chained so two results do
  not read the same counter; the rule recomputes exactly what
  `registraJugadaClub` does (today only, `total` up by one, `hoy` ≤ 10 for
  bbtan and ≤ 15 for the rest).
- **Podiums** (`podios/<uid>/<partida>` = `{c, p, q, at}`): taking the
  1st, 2nd or 3rd place of a club table (or a Yemas zombies one) from
  *someone else* pays 500, 250 or 100 (`PODIO`), every time it happens.
  `guardaConPodio` writes it right after the record transaction commits,
  when the place improved to 1–3 and someone else held it; the rule demands
  that `soloRanks/<c>/<uid>/partida` is the claim's key, so there is one
  claim per record write. `podioValido` re-checks that both have a row in
  that table and that it is not oneself. Club marks are client-claimed
  (the honest limit of every solo game), so this is no weaker than them.
- **Logros**: by difficulty. `NIVEL[juego]` is one digit 1–4 per logro, in
  `LOGROS[juego]` order (room games start with the fila's four, `F`), worth
  `VALOR_NIVEL` 15/40/100/250. A new logro needs its digit, and
  `tests/monedas.test.cjs` fails if a game's string does not match its list.
  This is the big pot on purpose: hard things pay most.
- **The daily reward** (`diario/<uid>` = `{dia, racha, mejor, dias, bono, at}`):
  claimed with a **button** (`data-reclama-dia`, drawn by `rachaHtml` above
  the lobby's *Top monedas* and on the coins page; `reclamaDia()` in
  `juegos-main.js` answers it through one document listener). Playing no
  longer records the day. `registraDia` pays `pagoDia(racha)` = 250 × the
  streak day, capped at 1000 from the fourth (`PAGO_DIA`, `TOPE_DIA`), and
  the rule recomputes exactly that from the previous record. `bono` is a
  running sum, so what was paid under the old 10–50 scale stays valid. `dia` is
  the Chile date as a day number, because rules can compare numbers with
  `now` but cannot format dates. The rule accepts it inside a 25-hour window
  that covers UTC−3 and UTC−4. So a client can only record *today*, once,
  with the right streak and sum. Deleting the node only loses coins.

Coins are spent in PRODROP (below), and that spending **is** stored:
`monedasDe` returns `total` (earned, `ganadoDe`), `gastadas`, `cobradas`
(market sales) and `saldo`. **The header chip and the top both show
`saldo`**: the top used to order by `total`, and the mismatch with the
header read as "the top is not updating". `datosPerfil` hands every node
`watchLogros` reads (`Object.assign({}, d)`), not a hand-picked list: a
list that forgot `mercado` silently ran the economy without the market.
The streak is shown loudly: a card in the lobby's coins box and on the
coins page (`rachaHtml`: days, the claim button or what tomorrow pays,
four steps 250/500/750/1000), a 🔥N next to the header balance that blinks
while today is still unclaimed, and a toast when it is claimed (`avisaMonedas`, the
same queue as the logros toast, also used for club plays and podiums).
The `diario`, `clubJugadas` and `podios` nodes need the rules re-published.
`test-rules.mjs` covers it: no invented streak, no tomorrow, no twice a day,
and nobody writes someone else's.
