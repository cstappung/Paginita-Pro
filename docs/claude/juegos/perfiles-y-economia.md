# Juegos — profiles, frames, shop, ranking, logros, coins

`perfil*.js`, `marcos-animados.js`, `tienda.js`, `ranks.js`, `logros*.js`, `monedas*.js`, `referidos*.js` in `colabtex/src/juegos/`. Read this when adding a game (its logros, `NIVEL` digits, coins, champion frame) or touching any of those. Shared architecture in `colabtex/src/juegos/CLAUDE.md`.

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

- **The Google photo is published in the profile** (`fotoGoogle` in
  `juegos-main.js`): only your own session knows it, so others saw it only
  where a row had copied it (a room ficha, a room-game rank) and the coins
  top showed initials. Whoever has `foto` unset, or an old Google URL,
  writes the current one to `users/<uid>/perfil/foto`. An https `foto` still
  means «use Google» in the editor (`esFotoGoogle`): uploads are data URLs
  and «no photo» is `""`, neither is touched. Until someone opens Juegos
  with the new bundle their profile has no photo, so every list also falls
  back to the Google photo a room-game rank row copied (`fotoEnDatos`, and
  `foto` in `topMonedas` rows), the same fallback the mini card always had.
- **Frozen rows show the live apodo** (`nombreVivo(uid, nombre)`): waiting
  rooms, room chat and the Club iframe's ranking (`crearSolo({nombreDe})`,
  re-sent by `refresca()` when a profile arrives) used to print the name
  stored in the row, which is the Google name if it was written before the
  apodo existed.

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
`abrePerfil`. That editor has five tabs (datos, marco, fondo, vitrina,
mascota) and a live preview of the card.

Four decisions:

- **No rules change** for these four (the pet, below, did need one). The new
  fields `marco`, `fondo`, `bio` and `vitrina` live in `users/<uid>/perfil`
  beside nick, foto and colour. Everything
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

**The pet of the profile** (`perfil-mascota.js`). `users/<uid>/perfil/mascota`
= `{m: "ma:…", b?: "ob:…" | "start-dance-<id>"}`; the rule checks only the
shapes. It shows on the card's banner and in the page's hero, in 3D through
the Mascotas viewer (`docs/claude/juegos/mercado.md`).
- **Re-checked where it is seen**, like the frames: `mascotaVisible` hides a
  pet the account no longer owns or has listed, and drops a dance it no
  longer has. The stage, the name and what it wears (each piece re-checked
  the same way) come from its `mascotasEstado`, read by key. A cached state
  older than `FRESCO_MS` (2 min) is shown at once and re-read behind, so a
  change of clothes arrives without reloading and without listening to the
  node; what the game saves in this tab goes straight into the cache
  (`alGuardar` → `pon`). Only adults dance, in a loop.
- **The live view sits in its own layer** (`capaMascota`), outside the
  card's `innerHTML`: the card repaints on every data arrival, and an iframe
  that leaves the document reloads. The page's hero is rebuilt only when
  its signature changes; then the layer moves to the new hero.
- **One iframe at a time, in a stack** (`montaVisor`): the card opened over
  a profile page takes the iframe, and closing it gives it back.
- The editor offers your pets not on sale and your dances (starters plus
  gift dances). Without the full economy it offers nothing and saves the
  pet as it was; `editaPerfil` also keeps it, as it keeps `cartas` and
  the football `plantilla` (`juegos/prodrop/CLAUDE.md`).

`tests/perfil.test.cjs` covers the stats, the requirements, the vitrina,
the cleaning and the pet re-check.

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
drawing. (It is not in `test:juegos`: its champion-frame test already
failed for Pokelike, which has no champion frame yet.)

**The Halloween shop: limited edition** (`tienda.js` for the catalogue,
`juegos/tienda-halloween.js` for the window and the lobby strip, the
frames in `marcos-animados.js`, the background scenes in
`juegos/fondos-halloween.js`, CSS block «Tienda de Halloween» in
juegos.html). Six frames and five backgrounds (`hw: true` in `MARCOS` /
`FONDOS`), priced by rarity (`RAREZAS_HW`: raro 3 000, épico 5 000,
legendario 7 500, mítico 10 000; capped at 10 000 on purpose), on sale only inside `VENTA_HALLOWEEN`
(until 2 Nov 00:00 Chile). It is meant to make the 50 000+ hoarders spend.

- **Three places agree on prices and the closing time**: `tienda.js`,
  the `tienda` rule (`now < …`, a price per id group) and `economia()`
  (`precioDe` + `aLaVenta(id, at)`, with `at` the server time the rule
  pinned). Change one, change all; `tienda.test.cjs` parses the rule and
  fails if they differ. A new season = new ids + a new window in all three.
- **Bought is forever; unbought disappears.** After the close, `requisito`
  returns `agotado` for an unowned Halloween item and the editor hides it
  (`hw()` in perfil.js); owners keep it and everyone still sees it.
- **Two collector rewards that are not sold** (`req: {coleccion: n}`,
  `PREMIOS_HALLOWEEN`): the Rey Calabaza frame at 5 Halloween items and the
  Noche eterna background at all 11. Derived from `est.compras` like
  everything else, so no write and no rule. Classic shop items do not count.
- **The window** opens by itself on entering the lobby with a session, once
  a day per device (`jg.tiendaHw.visto`, `quizaAbreTienda` in
  juegos-main.js, skipped if another modal is open), from the lobby strip
  (`data-tienda-hw`), from the editor's Halloween group and from
  `#tienda` (not a view: it opens the window and restores the previous
  hash; Inicio.dc.html links `juegos.html#tienda`). Buying is a two-step
  confirm; putting it on is separate and writes only `perfil/marco` or
  `perfil/fondo` (`fb.ponEnPerfil`, an `update`, so the rest of the profile
  is untouched). It repaints by signature, not on every data arrival, or
  the animations would restart.
- **Each frame is worn, not just a ring**: the Parca's hood (an evenodd
  path with a face-sized hole) and a scythe drawn only outside the photo,
  the witch hat, the crown, the ghost peeking over the rim, the bat hugging
  the top. Behind the photo, `.jg-marco-hw::before` is a blurred conic aura
  that rotates (HTML, colours `--h1..3` per frame), which `avatarMarco`
  turns on with the class `jg-marco-hw`.
- **Edition numbers** (`edicion` / `edicionesDe` in tienda.js, pure): the
  n-th account to buy an item, by server time (ties by uid), and how many
  own it; a reward is numbered by the time of its n-th purchase. Derived,
  never stored. `estadisticas` carries them as `ediciones`, the card and
  the profile page show them as seals (`sellosHw` in perfil-vista.js,
  «🎃 La Parca n.º 2/3»), and the shop says «Solo 2 personas lo tienen.
  Serías la edición n.º 3».
- **Background scenes animate HTML, not SVG** (`.hwf-*`, sized in
  `cqw/cqh` inside the `.jg-fanim` container); the silhouettes are still
  SVGs. In the lobby strip the frames are paused until hover.
- Frame ids must match `^[a-z]{1,20}$` (the `perfil/marco` rule): no
  digits or dashes. Exported names in `tienda.js` must not clash with
  other modules concatenated in tests (`RAREZAS` and `rarezaDe` were
  taken by `tacos.js`).

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

**The Clasificación opens on a General table** (`ranks.js`, key `general`)
that counts **podiums**: every first place in any table is 3 points, every
second 2, every third 1 (`podiosGeneral` in `perfil-tarjeta.js`, pure and
tested in `tests/perfil.test.cjs`). Tables: each room game the picker shows
(only rows with points can be on the podium) and every **current** club
category; a table counts only with `MIN_PODIO` (3) people, the same cut as
the profile's «podios», and vetted accounts are skipped (`fb.watchVetados`).
It reads the lobby's data (`ctx.datos`: ranks + soloRanks).
**Old club tables are hidden**: `categoriaVigente` (`ranks.js`) is every
combination of its `SOLO` rows; categories from older versions of a game
(the old Snake and Mina Club) stay in the database but `conDerivados` passes
it as `datos.vigente`, so the profile's tables, podiums and tops skip them
too. A new club table must be added to `SOLO` or it is invisible there.
The picker lists the games in the lobby's
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
  plus 2 per second under 3 s per block (`monedasSortem`), the Sopa,
  Electrodle and Integrodle streaks 10 per day, and Integrodle's total
  points one coin per 10 (Electrodle's, one per 50: it scores ~6× more a day). PRO DEFENDER pays 20 × the kingdom number for every
  round up to each kingdom's record (`monedasProdefender`: 2000…10 000 at
  round 100; kingdoms 6–15 pay 100 a round like Vacío) and has no per-game pay (not in `PAGO_CLUB`).
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

Coins are spent in PRODROP, in Mascotas and in the profile shop, and that spending **is** stored:
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

**Referidos** (`juegos/referidos.js`, pure; the view in
`referidos-vista.js`). Whoever enters someone's code and that someone each
get `PREMIO_REFERIDO` (5000), derived like every other income
(`ganadoDe`'s `p.referidos`), never stored. Three branches of `referidos/`,
all write-once:

- `c/<CÓDIGO>` = uid and `m/<uid>` = {c, at}, written **together** in one
  `update` (`fb.configuraCodigo`); each rule checks the other, so a code
  belongs to one person and a person has one code, never changed. Codes
  are `^[A-Z0-9]{4,12}$` (`normalizaCodigo` uppercases and strips the rest).
- `u/<uid>` = {c, r, at}: the code used. The rule demands `c/<c> === r`,
  `r !== uid` and that `r` did not already use yours (no mutual pair).
- **Both sides need `MIN_JUEGOS` (3) distinct games played** to refer
  *and* to redeem (a `ranks` row with `jugadas`, a `clubJugadas` entry or
  a club mark). The rule cannot count, so `referidos()` checks both where
  it is paid: a code set or used by hand by someone short of it pays
  nobody until they qualify. The UI disables both until you qualify.

UI: a gold coin «+» (`#userReferir`) shares one pill with the header
balance (`#userSaldo`, `.jg-saldo-grupo`); it shines always and, while
there is something left to cash (no code used yet, or you qualify and have
no code), it pulses with a «5K» badge (`.llama`, set by `pintaBoton`). It
opens a popover: the code field (just «✓ Código ya usado» once you used one), the
3-games bar and **Referir a otros**, a centred `.jg-modal` that explains it
and sets your code with a two-step confirm. **Top referidos** (`topReferidos`, top 5 by valid referrals, ties to
whoever got there first): a box under *Top monedas* in the lobby
(`#vesReferidos`, with a `data-referir` button that opens the window) and
at the bottom of the window. `tests/referidos.test.cjs`
covers the arithmetic; `test-rules.mjs` the rule. The node needs the rules
re-published; until then the read fails alone and the rest of the economy
works. Abuse limit, stated: an alt account still farms it after three cheap
club games; the minimum only raises the cost.

**The colour of the name** (`juegos/tintas.js`, pure). Referrals unlock
it: 1 → rojo «brasa», 3 → verde claro «destello», 5 → azul «reflejo», 10 →
dorado «aura dorada»; each step adds effects (`EFECTOS`, a test checks they
grow). Optional: `users/<uid>/perfil/tinta` (kept by `limpiaPerfil`, chosen
in the editor's Datos tab, «Normal» = unset). **`perfil` has a
`$otro: false` rule**: a new profile field must be named in
`database.rules.json` (`tinta` was not, and saving any colour failed with
`PERMISSION_DENIED`), and `test-rules.mjs` must write it.

- **Every painted name goes through `nombreHtml(uid, esc(name))`** →
  `<span class="jg-nm" data-nm=uid>`. A new place that paints a person's
  name must use it, or that name never gets its colour. Not used on
  coloured buttons (the purple «Unirme a…») or on your own `.yo` logros
  pill, where the colour would fight the background.
- **One stylesheet, no repaints**: `pintaTintas()` in `juegos-main.js`
  writes `#jgTintas` from the watched `perfiles` and the referral counts
  (`cssTintas`), re-checked like the frames (`tintaVisible`; trusts the
  stored choice while the economy is partial). The editor preview uses
  `jg-tn-<id>` classes, emitted after the uid rules by the same sheet, so
  they win.
- **Contrast is per background, via `--tn-*` vars** in juegos.html: light
  surfaces get deep red/blue and a dark contour on light green/gold; dark
  ones (`html[data-tema=oscuro]`, `.head`, `.jg-cs`, `.jg-rk-podio`,
  `.jg-pf-hero.oscuro`) bright fills and more glow; `.jg-pf-hero:not(.oscuro)`
  is light even in dark theme; the immersive chat keeps its black shadow.
  A new dark surface that shows names must join the dark list.
- The reflejo is `background-clip:text`, so azul/dorado put glow and
  contour in `filter: drop-shadow` (a `text-shadow` covers the fill), and
  their sparkles reset `-webkit-text-fill-color` or they inherit
  transparent. Reduced motion stops every animation.

`tests/tintas.test.cjs` covers thresholds, the re-check, the sheet and
that every `--tn-*` var and `jgTn*` keyframe the effects use exists.

**The coins tab explains itself** (`detalleHtml` in `monedas-vista.js`):
a balance of what came in and went out, every source as a bar with its %,
the games that paid you most (`monedasDe(...).porJuego`, filled by
`ganadoDe(uid, d, porJuego)`), what you spent by category with a
per-game casino table, your recent movements (consecutive bets in one
casino game collapse into one row) and «lo que más paga», a ranking of
what each action is worth. The spending side comes from `economia()`:
every `paga(u, p, cat, d)` notes the category (`gasto`, `cuenta`) and a
movement (`movs`), and market sales and casino prizes note income. A new
spend must pass its category to `paga`, or it counts in `gastadas` but
shows nowhere in the tab. `tests/monedas.test.cjs` checks that the
categories add up to `gastadas` and the games to their sources.

**Mascotas spends coins and pays none** (`juegos/mascotas/CLAUDE.md`).
`economia()` replays three more nodes, between the re-roll and the
listing at equal `at` (`ORDEN`: `ma` 2.1, `mr` 2.2, `mc` 2.3; the old
events keep their order):

- `mascotas/a` adoptions: the first one *written* by an account is free
  (`intentos`, the same thing the rule can see), the rest cost 1000, and
  none happens with 6 pets owned now.
- `mascotas/r` gifts: 500, content from `MascotasMotor.regalo`.
- `mascotas/c` purchases:
  - food, 20 a ration;
  - potion, 1000, only for an own pet that is not listed and not frozen
    yet;
  - a background, once;
  - `adios`, free.

An unfunded one stops the account like a pack. One that fails for another
reason (cap, someone else's pet) does not happen and charges nothing.
`ganadoDe` is unchanged: the only Mascotas income is market sales
(`cobradas`). The replay also returns `mascotas`, `regalos`, `congelada`
and `historial` (previous owners). `mascotasDe`/`objetosDe` list what an
account owns now. `watchLogros` reads `mascotas` whole (11 nodes); the
per-pet state (`mascotasEstado`) is read only by key.


**Batalla de Rock boxes** (`rock/c/<uid>/<k>`, 500, event `rc`, category
`cajaRock`; an exact repeat refunds as `premios`): `juegos/hero/js/rock/CLAUDE.md`.

**`economia()` reruns on every Firebase read, in every open tab, so it must
stay linear in the site's history.** Each box looked for the buyer's pieces
by walking `rocas` for *everyone*: quadratic, ~0.6 s per read at 1800 boxes
and 13 s at 7200, which froze the lobby a while after the Synyster opened
the boxes. Now `rocasPor[uid]` lists the copies that reached each account
(`llegaRoca` on a box, a sale and a trade; filtered by `dueno` when read),
and `repetidaRock` keeps each piece's `invId` in a WeakMap. The memos of
`cajaRock` and `MascotasMotor.regalo` hold 50 000: they are asked for every
box/gift of the site on each pass, and with a cap below that total
(it was 4000) they emptied mid-pass and never hit. A new per-event lookup
must index by account, never scan a whole-site map.

**Super chats** (`superChat/<uid>/<message id>` = `{at, p}`, 100 or 300,
event `sc`, category `superChat`; `superChats` in the replay lists the
paid ones): `docs/claude/juegos/salon.md`. `watchLogros` reads the node
whole (`NODOS_MONEDAS` is 17 with `economiaCierre`, below).

## The economy is closed by periods (`juegos/cierre.js`, `cierre-datos.js`)

Every tab downloaded the whole spending history to replay it: in October
2026 each page load cost **~3.8 MB** (`users/*/consumo` showed it per tab),
almost all `cartas` (each re-roll carries ten copy keys) and `casino` (one
mark per plane tick), and 20 daily players used up the free plan's 360 MB.
So an admin **closes** the history:

- `economiaCierre` = `{v, T, d, por, at}`, admin-written, read by everyone:
  `d` is the replay's state after every event with `at ≤ T`, packed as
  text (accounts by index, times in base 36; ~0.3 MB for the October
  export). `recorreEconomia(datos, hasta, crudo)` starts from it and
  replays only events after `T`; `economia()` is that, memoised. A record
  still live with `at ≤ T` (an active listing, an unfinished casino round,
  an adoption) is skipped, its state comes from the cierre.
- The old records of `casino`, `cartas` and `mercado` (closed listings and
  trades) move to `archivo/` (admins only). Everything else stays: it is
  small, or the rules read its history (first free adoption, the shop,
  referrals, the free pack). Unfinished rounds and active listings stay
  live.
- The cierre keeps only what a later event can look at: per-account state
  (amounts **unrounded**: casino hundredths are floored once at the end),
  every live copy grouped by pack (`at`, live and graded masks; `aj` for
  copies that changed hands), live pets/objects/rock pieces, active
  listings, unfinished rounds' validity, and per-collection pack totals
  (`est`) for `cifras`/`topColecciones`, which skip `so.cierre` packs. Per
  account it drops `sobres`, keeps the last `MOVS_CIERRE` movements and the
  rock boxes PRO HERO shows (`cajasPrevias` counts the rest).
- **Nobody stopped is closed** (owner's decision): a stopped account
  recovers when its earnings grow, because spends are measured against
  what is earned *now*, and a cierre would freeze it. `hacerCierre` puts
  `T` before the first unfunded spend of every account stopped now
  (`paradaDesde`, `frenos`); an adjustment unblocks it.
- **Nothing is written unchecked**: `verificaCierre` compares the economy
  with everything against the cierre plus what will stay live (balances,
  owners, graded copies, listings, pets…). Tested on the October export:
  0 differences, two chained cierres, and rebuilding from the archive.
- What is closed stops moving: if an admin later deletes records and
  someone ends up owing something from before `T`, it still counts. The
  panel's **Recalcular** reads `archivo/`, joins it with the live data
  (`conArchivo`), replays from scratch, lists the accounts that differ and
  can **rebuild the cierre from scratch** (never to a `T` before the
  current one).
- Writing (`fb.escribeCierre`) copies to `archivo/`, writes the cierre and
  deletes the originals, in batches of 800; it need not be atomic, since
  live records at or before `T` are skipped anyway.
- The first cierre is manual (`#admin`, Economía); after that an admin's
  page redoes it by itself every `AUTO_CIERRE_DIAS` (`cierraSiToca` in
  juegos-main.js), with the same check. **Deploy the code and wait a day
  before the first cierre**: a cached old bundle does not know the cierre
  and would show balances without the archived history.
- The rules forbid rewriting an archived key (`casino`, `cartas/s|r|g`:
  `!archivo/... exists()`), let a copy of an archived pack be graded, and
  let admins delete those records. `tests/cierre.test.cjs` and
  `test-rules.mjs` cover it.

## Casino

The Casino tab bets coins: a bet is a spend (`ca`, through `paga`) and a
payout is income (`cp`, in `premios`, summed in hundredths and floored once).
Saldo = ganado + cobradas + premios − gastadas. Details:
`docs/claude/juegos/casino.md`.
