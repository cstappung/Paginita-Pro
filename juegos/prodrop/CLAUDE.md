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

- **Three collections; four packs on sale** (`COLECCIONES`; Fútbol below): **Profes** (`profes`,
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
- **The Serie 01 (Profes) is only for the admin's list** (`prodropSerie1/<uid>`
  = `{at, por}`, written from the panel's «Serie 01» tab, readable by anyone
  signed in because trades need the other side's answer). For everyone
  else the collection does not exist on any screen. **It is view-only**:
  `economia()` never reads the list, so leaving it loses no card, coin or
  spend, and coming back shows everything again. One filter does it:
  `prodrop-cartas.js` holds the list and the viewer (`fijaSerie1`, set by
  `juegos-main.js` from `fb.watchSerie1`; until it arrives nothing of the
  series shows) and `copia()` returns null for a hidden collection, so
  exhibited cards, drops, both card tables (`total` is `totalVisible()`),
  `cifras` and the market's `fichaCopia` all follow. A copy's collection is
  read from its pack key (`coleccionDe`: no prefix is profes), never
  rebuilt. A Serie 01 card only trades between two accounts that both see
  it (`gente`, `puedeProponer`, the composer), and a trade naming one does
  not exist for a viewer who cannot see it. The postman sends `serie1`, and
  filters `mias`, `sobres`, `ofertas` and `exh`; it refuses buying a hidden
  pack (also an old opener's prefix-less one) and keeps hidden exhibited
  cards when the frame saves its list. The frame (`fijaColecciones`) drops
  the chooser, «Cambiar sobre», the collection and re-roll tabs and the
  Profes paragraph of the odds (`.solo-serie1`) when only one collection is
  left. A change of list re-sends `datosP` as a new object
  (`alCambiarSerie1`), which repaints every view. The images are still
  public files of the repo: this hides, it does not lock.
- **Fútbol** (`futbol`, prefix `g`, Serie 03, visible to everyone) is the
  third collection and **one single catalogue of footballers**: the Real Madrid
  and Barça first teams (`FUTBOLISTAS`, 48) and the Premier Big Six (`PREMIER`,
  155: Man United, Man City, Chelsea, Liverpool, Tottenham, Arsenal), 203
  players with an EA rating, **one card per player** (photos in
  `cards/futbol/…` and `cards/premier/<club>/<id>.webp`, all with `col:
  "futbol"`). The re-roll, the collection tab, the challenges and the showcase
  see them as one category. **The card's rarity comes from the player's media**
  (`BANDAS` = 80 / 84 / 87: común up to 80, rara 81-84, épica 85-87,
  legendaria 88+; `tierDeMedia`), so a star is never a común. Re-roll:
  común→rara…, and 10 épicas give a legendaria. The card (`frontHTML`,
  `.futbol` in `style.css`) is the photo with its positions (top left,
  `c.posiciones`), media with its «MEDIA» label (top right, big), name and
  rarity (bottom left), flag and the club's crest together (bottom right) and
  a frame in the tier's colour. The shirt number (`dorsal`) stays in the data
  but is not drawn. **The flag is an image** (`flags/<país en minúscula>.png`,
  160 px from flagcdn; `eng`, `sco`, `wal`, `nir` are the UK nations), never
  an emoji: Windows paints flag emoji as two letters. A new `pais` needs its
  file in `flags/` and a name in `FUT_PAIS`, a new club its crest in `escudos/`
  (football-data.org, 200 px); a test checks all of it. **Media**: `MEDIAS` in
  the motor, by `<club>/<photo id>`, from EA's public ratings API
  (`drop-api.ea.com/rating/ea-sports-fc?team=<id>` or `&search=`), whose squads
  lag the real transfer window: **check nationality and club before trusting a
  match**. Players EA does not have (youth) are left out; Mudryk (76) is the
  one estimate. The photos are 470 px squares (head and chest) cut out of the
  clubs' official squad-page portraits on a club-coloured background (the
  neutral one, never the hover shot). The Fútbol shop shows two links that
  open `#fuModal`: the odds (`tipFutbol`, from the pack's weights) and the
  changelog (`NOVEDADES_FUTBOL`, newest first: add an entry when the packs
  change).
- **Two football packs** (`SOBRES` in the motor; the shop buys *packs*, the
  collection tabs and the re-roll use *collections* — `COLS` vs `PACKS` in
  `app.js`, `M.SOBRE[k].col` goes from one to the other): the **normal** pack
  (`futbol`, prefix `g`, 80) and the **Plus** (`futbolplus`, prefix `h`, 160 =
  `precioSobre(ms, 2)`). Both draw from all 203. Weights `PESOS_FUTBOL`: normal
  66 / 30 / 3,4 / 0,6 % per card, the fifth rara or better; Plus 30 / 68 / 1,5 / 0,5 %
  for the first four cards and a **fifth that is always épica or better**
  (`ultimaPlus` 93 / 7 %: `pool(lista, w, ultima)` keeps `P.ultima`, `sobre`
  and `esperadoPorSobre` read it). A legendary comes in about 1 of every 20
  normal packs and 1 of every 10 Plus packs (god pack included), and a Plus
  carries 1.2 épicas or better per pack (normal 0.37); a test keeps those relations and keeps a player's odds falling with
  the media (rara → épica → legendaria). There is **no free pack for the Plus**
  (the client, the postman and the economy all refuse it).
  **Price is checked in three places**: the Firebase rule of `cartas/s/$uid/$k`
  (`50|80`, ×2 if the key begins with `h`; it also forbids a free `h`), the
  economy replay (`monedas.js`: `h` keys must be 100 or 160) and the postman
  (`multDe`). **The rules file must be published (`firebase deploy --only
  database`) before the site that sells the Plus**, or buying it fails.
- **Old football packs keep working** (prefixes `f` = Clásico, `e` =
  Premier, sold before the merge): `coleccionDe` answers `futbol` for
  `f`, `e`, `g` and `h`, but `poolDe` keeps their original lists and weights
  (`POOL.futbol1` = the 48, `POOL.premier1` = the 155, `PESOS_FUTBOL.v1`), so
  every pack and re-roll already written derives exactly the same cards (a
  test pins ids, and the merge was checked against the previous motor on
  33,000 packs and re-rolls). **Never edit those two pools.** They are not
  sold any more and do not appear in any menu.
- **Adding teams to the football catalogue** (the Champions League clubs went
  in this way: `CHAMPIONS` rows, photos in `cards/champions/<club>/<id>.webp`,
  same row format as `PREMIER`). `g` and `h` packs derive from the whole
  catalogue, so a new card would change every pack already opened. That is
  what **`AMPLIACIONES`** prevents: each entry `{ hasta, n }` says that a
  pack (or re-roll) whose server time is before `hasta` only sees the cards
  with id below `n`. To add a league: **append** its rows to a new array after
  the last one (`cartaFutbol(..., "<carpeta>", j)`), add an `AMPLIACIONES`
  entry with `n` = the card count before it and **`hasta` = the push time plus
  a few minutes (never earlier)**, and pin the old ids in a test (the
  `ampliaciones` test does it for the previous catalogue). Also needed per
  league: `MEDIAS` and `POSICIONES` by `<club>/<id>`, an entry in `CLUBES`,
  the crest in `escudos/`, the flags in `flags/` and the names in `FUT_PAIS`
  (a test checks them), and a CSS class for its folder if its photos need a
  different crop (`.full.futbol.champions` is like the Premier's). **Photos**:
  portraits from the clubs' official squad pages, 470 px squares; a cut-out
  goes on a club-coloured gradient (see the scripts described in the repo
  history), an opaque one is cropped as it is (Betis white, Como grey,
  Dortmund dark). Players EA FC has no rating for are left out.
  The Champions League clubs added: Real Betis, PSG, Como, Inter, Roma, Napoli
  and Borussia Dortmund (the clubs that play the 2026-27 league phase; Atlético
  was left out because its site blocks automated readers).
- **Bayern Múnich** (`BAYERN`, 20 players, photos in `cards/champions/bayern/`,
  second `AMPLIACIONES` entry with `n: 813`). It goes **after** `ESPECIALES`,
  at the very end. fcbayern.com answers 403 to curl, but a real browser reads it:
  the portraits (`img.fcbayern.com/…/spielerportraits/ganzkoerper/<name>.png`,
  1920×1080 cut-outs) were fetched from a page on localhost, cropped to head and
  chest on a red radial gradient in a canvas and saved as 470 px webp. Kane's
  base card is `bayern-harry-kane`, the same person as his Balón de Oro. Its
  `hasta` (1793202400000, 28-10-2026 15:46 UTC) is half an hour after the push.
- **Chile and Argentina** (`CHILE` + `ARGENTINA`, 133 players, third `AMPLIACIONES`
  entry with `n: 833`, after the Bayern): Colo-Colo 19, Universidad Católica 27,
  Universidad de Chile 15 (keys `colocolo`, `ucatolica`, `udechile`) and River Plate,
  Boca Juniors and Estudiantes de La Plata, their 24 best each (`river`, `boca`,
  `estudiantes`; Estudiantes because it was the Argentine semifinalist of the 2026
  Libertadores). Data from fut.gg's API (`/api/fut/players/v2/<game>/?club_id=<EA id>`
  for a squad, `?name=<surname>&page=n` to find someone; base cards only). Squads are
  **today's** (Wikipedia, Aug–Oct 2026): the Católica and the Argentines come from
  **FC 27**; Colo-Colo and the U are not in FC 27, so each player comes from the newest
  game that has him (FC 26, 25, 24; Lucero from FC 23, because without a second striker
  the U could not field a valid eleven). Arrivals with no card in any FIFA are left out
  (Eduardo Vargas, Lichnovsky, Marchant…). The clubs' sites don't publish squads with
  photos, so each card is the **in-game face** (fut.gg `player-item` render, 512 px) on a
  radial gradient in the club's colours, made with Pillow. Positions cut to two (the
  test). Nearly all are **Común** (only Paredes, 81, is Rara). Dorsal 0: the card no longer
  shows it. `RT.delClub(club)` says «de la Universidad …» / «del Colo-Colo».
- **Special cards** (`ESPECIALES` in the motor, folder `cards/especiales/<club>/`): another
  card of a player that exists for something that happened (Mbappé · MVP del
  Clásico, media 92, and Harry Kane · Balón de Oro, media 94). Row format as the
  others plus a 7th element `{ person, sub, cinta, especial, limitada, peso }`:
  `person` is the **same player's** (so the squad's no-repeat rule treats both as
  one; Kane's is `bayern-harry-kane`, the one his base card will have when the Bayern
  squad is added), `cinta` is the ribbon text, and the card gets `.especial` (gold
  animated frame) and its own `uid`. `peso: 3` makes each one three times as likely
  as an ordinary legendary. **«Limited time» is only a label** (`limitada`; the texts say «por tiempo
  limitado» and **never give a date**): there is no automatic window or switch-off,
  and no end date to announce, as the owner asked. Taking them out of the pool later is manual and must not change
  packs already bought (an `AMPLIACIONES`-style cut-off, but removing cards). Pickers
  dedupe copies by `uid`, not by player. Where the specials are shown by hand
  (change them when the event ends): `PORTADA` in `app.js` (futbol and hub covers),
  `SKIN.futbol.meta`, `TEMAS.futbol`, the hub tile text and `NOVEDADES_FUTBOL`; and in
  Juegos, the salon card `futbol` in `juegos-main.js` and its art (`futbol()` in
  `novedades-arte.js`, three real cards with media; a test compares its medias with
  the motor's).
- **«Especial» is a displayed rarity, not an engine tier**: the frame's
  `rareza(c)` answers `ESPECIAL` (✦, gold) for `c.especial`, on the card face,
  the banner, the zoom and the collection (its own filter chip, and the
  Legendaria chip no longer counts them). For the motor they are still tier 3:
  packs, odds and re-rolls are untouched, so no pack changes.
- **The football collection goes by club** (`renderCollection`): with «Todas»
  each club is one section (crest + name, in `CLUBES` order), its cards from the
  lowest media to the highest, so the specials land at the end of their club.
  The rarity chips filter across clubs and keep the club sections. A missing
  football card shows its media and position. Profes and componentes are as
  before (by rarity, then variant or theme).
- **Football re-roll** (`vistaRerollFutbol`): sort (media ↓, media ↑, club),
  club select and chips (todas / repetidas / sin graduar / graduadas); copies
  of the same player sit together, and each card shows media, positions and
  its grade if graded. «Elegir automático» ignores the filter.
- **The football menu scrolls** (`.chooser` has a max-height and overflow) and
  the Desafío de plantilla strip sits under the title, above the two packs: it
  was cut off below them with no way to scroll.
- **Local test page** `juegos/prodrop/_prueba.html` (**never committed**): it
  plays the postman with a fake account kept in `localStorage`
  (`prodrop.prueba.estado`: 50 000 coins, 160 football packs, the two specials,
  a rival's listings) and answers every action without Firebase. Open it
  through the static server, never `file://`.
- **The football pack covers are fixed** (`PORTADA` in `app.js`, read by
  `fanDe`): (during the event: Yamal, Kane and, in the centre, Mbappé MVP; normally) normal = Lamine Yamal, Bellingham and, in the centre, Mbappé;
  Plus = Saka, Van Dijk and Haaland; the «Sobres de Fútbol» tile shows
  Haaland, Yamal and Mbappé. The order is [left, right, centre]. Profes and
  componentes still show three good cards at random. A test checks that every
  name exists.
- **«Sobres de Fútbol» is its own menu.** Packs carry `grupo: "futbol"` (the
  normal and the Plus): the first screen (`eligeSobre('todos')`) shows Profes
  / Componentes and **one** football tile (`data-menu="futbol"`), which opens
  a second menu (`eligeSobre('futbol')`, `body.menu-futbol`) with the two packs
  and a «← Todos los sobres» button. «Cambiar sobre» goes back to the menu the
  pack came from (`menuDe()`), and a data refresh keeps you in the menu you
  were in (`menuActual`). The Plus' cover is `.skin-futbolplus`.
- **«Mi plantilla» (the profile's football squad) was removed** (October
  2026): its overlay, the `plantilla` postman action, `perfil/plantilla`
  (rule and `fb.ponerPlantilla`), the profile section, the visor mode
  `?plantilla=1`, `#cartas/plantilla` and the motor's `puntosCarta` /
  `puntosPlantilla` / buscador are gone. The weekly challenges below took
  its place. Data already stored in `perfil/plantilla` is ignored and
  disappears on the next profile save (the editor no longer carries it
  over). **Publish the rules right after the site is live and raise
  `juegosVersion/min`**: an old tab still carrying `plantilla` on a profile
  save would be refused, and the challenges need the new rules.
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
- **Packs, gradings and re-rolls before the economy cierre live in
  `archivo/`** (`docs/claude/juegos/perfiles-y-economia.md`): `e.sobres`
  keeps only packs with a live copy (marked `cierre: true`), and packs
  opened are counted in `e.cierre.est` per collection (`cifras`,
  `topColecciones`). The grading rule accepts a pack that is archived.
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
- **The market left the frame** (October 2026). It is the 🏪 Mercado tab
  of Juegos, shared with Mascotas: `docs/claude/juegos/mercado.md`. The
  frame's 🏪 button sends `{tipo: "mercado"}` and the postman goes to
  `#mercado/prodrop`. Its badge counts trades waiting for you (`pendientes`,
  from `pendientesDe`). What stays in the frame is selling or withdrawing a
  card from its zoom (`vender`/`retirar`). The postman still sends the
  active card listings (`ofertas`) only for «En el mercado por…» and the
  reference price. `marcaVenta`/`quitaVenta` still mark a sale at once.
  The listing node is the same: `mercado/o/<id>` = `{u, c, p, at}`, price
  1–100 000. `x` (withdrawn) and `v` (bought) are write-once and exclusive.
  The replay accepts a listing only if the seller owns the copy and it is
  not already listed; a listed card cannot be graded or traded.
- **Visor mode** (`?ver=1&o=&k=&i=&at=[&gr=1][&rr=id.g.w]`, `montaVisorCarta` at the end of `app.js`):
  - shows one copy exactly as the opener draws it (aura, holo, wear, slab), alone and on a transparent background;
  - the market's detail loads it in an iframe;
  - `html.visor` hides everything else;
  - it never sends `listo` and makes no sound.
- **Trades** (`mercado/t/<id>` = `{de, para, dar[1–3], pedir[0–3], at}`, now
  any mix of cards, Mascotas objects and pets):
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
  packs of that account. The postman sends the frame only the ones still owned
  and visible (`exhibidas()`): a sold or re-rolled card stayed in the list,
  filled the four slots unseen and switched «Exhibir» off. With four up the
  button stays on and replaces the oldest. Any collection can be shown,
  football included.
- **The Clasificación's Cartas tab is per collection** (the **Cartas**
  button under PRODROP; the key is `prodrop`, because `cartas` is already
  Cartas de los tres elementos). A chip row picks the collection (only the
  visible ones, `jg.rankCol` in `localStorage`), and each has two tables.
  Both come from the economy replay through `ctx.datos` (`datosPerfil`),
  never from `ranks`, and both use the owner of *now* (`e.dueno`, so a card
  bought or traded moves with its buyer).
  - **Colecciones más raras** (`topColecciones(datos, col)`): only graded
    copies, and only the best grade of each card (duplicates count once).
    Each card is worth `puntosGraduada(tier, g)` = `PUNTOS_RAREZA[tier] × g`
    in **tenths** (1/4/10/20 per tier: a legendary 10 is 20 points, a 9 is
    18, a common 10 is 1). Shows the top 3 plus your own row if you are
    lower, each with packs opened of that collection (`sobres`: valid
    packs, re-rolls do not count, they stay with whoever bought them) and
    «Ver colección», which unfolds that account's graded cards (one open
    at a time, `verC`). An ungraded grade is hidden, so it does not score.
  - **Colección más completa** (`rankingColeccion(datos, n, col)`): top 10
    by distinct cards of that collection (repeats count once; ties: more
    legendaries, then more copies). Without `col` it counts every visible
    collection, which is what the general's PRODROP leader (`lideresDe` in
    `juegos-main.js`) still uses.
- **Últimos drops** (`#vesDrops`, a horizontal strip right under
  Novedades, grid area `tira`): `mejoresDrops` lists epics and legendaries
  of valid packs only, in the order they came out (newest first), with who
  pulled them and when.

The `cartas`, `mercado` and `prodropSerie1` nodes and `perfil/cartas` need the rules re-published.

## Desafíos de plantilla (reto semanal, mejor plantilla y álbum de clubes)

En la interfaz se llama siempre **«Desafío de plantilla»** (no «desafío semanal»: el semanal es solo uno de los tres).


- `retos.js` (UMD `ProdropRetos`, puro, sobre el motor) lo comparten el abridor, el cartero y la economía. Plantillas: `mejor` (la **Mejor plantilla**, `tipo: "libre"`: cualquier carta, siempre abierta, sin la condición «Todos cumplen»), `club-<club>` (los clubes con ≥15 cartas, el Bayern incluido) y `reto-<id>-<semana>`; las reglas aceptan las tres claves; el reto de la semana es `RETOS[(semana − PRIMERA) % n]` (`PRIMERA` = 42, lunes 26-10-2026, El Clásico; luego Francia, Inglaterra, España…), así que **los retos solo se agregan al final** (salvo detrás de la última semana ya jugada: La Roja, solo chilenos, entró segunda para la semana 43 cuando solo había pasado la 42) (y cada uno debe poder armarse con el catálogo: Oranje se descartó por no haber portero neerlandés; el test lo comprueba). Se activan solos; la pantalla no los lista abajo, sino en el modal «🔜 Próximos retos» (al lado de «Ver colección») con la fecha de cada lunes. Las selecciones llevan `bandera` (imagen de `flags/`), no el emoji. La semana empieza el lunes 03:00 UTC (`SEMANA0`). Un reto solo se sube y se cobra en su semana (`vigente`, con la hora del servidor).
- Puntaje: (media − castigo de `M.ajuste`) × estado (graduada 0,80 + 0,02 × nota; sin graduar 0,80, para no filtrar la nota oculta), suma × 10. Un puesto «mal» no puede jugar. Sin repetir `person` (Mbappé y su especial son uno).
- Firebase: `plantillas/s/<plantilla>/<uid>` = {at, c[11]} (la clasificación, se reescribe) y `plantillas/p/<uid>/<plantilla>_<n>` = {at, c[11], k, k2?} (premio cobrado, una vez). Premios (`PREMIOS[].sobres`): 1 = 50 + un sobre normal; 2 = 300 + un sobre Plus (las 11 graduadas ≥6); 3 = 1000 + dos sobres Plus (≥8; el segundo va en `k2`) y, si es de club, su marco. Hasta el 29-10-2026 el 2 daba dos normales y el 3 un Plus (`antes`): esos reclamos siguen valiendo (`sobresValen`), pero la regla solo deja escribir la forma nueva (`k` con `g` solo en el 1, `k2` con `h` solo en el 3). Las monedas solo viven en `PREMIOS` (la economía las lee de ahí; la regla no las mira), así que cambiarlas no toca Firebase y vale también para lo ya cobrado. Los sobres van en el mismo `update` con `p: 0, pl: <reclamo>`; la regla de cada lado mira al otro, y la del premio exige el prefijo y `k2` solo en el 3. Se abren juntos al cobrar.
- La economía (`monedas.js`, evento `pl`, antes que `s` a igual hora) paga el premio en `premios` (categoría `plantilla`) solo si las 11 son de quien cobra en ese momento y cumplen el nivel con lo graduado hasta ahí; cada sobre con `pl` vale solo si su premio valió y lo nombra, una vez. El cartero comprueba lo mismo antes de escribir (un reclamo mal hecho gasta su única vez).
- **Avisos**: `enDesafios(k)` (en `app.js`) dice en qué plantillas subidas que siguen contando (clubes y el reto de esta semana) está una copia. El zoom lo muestra, la venta y el re-roll avisan que esa plantilla saldrá de la clasificación, y «Elegir automático» las deja al final. Los borradores sin subir de este navegador avisan aparte (`enBorradores`, 📝, desde el `localStorage` de cada plantilla abierta; se lee una vez por repintado). Los intercambios del Mercado de Juegos no avisan todavía.
- **Mercado de fútbol sin salir**: «🏪 Mercado de fútbol» (álbum y editor) y «🏪 Buscar en el mercado» (en el selector de una casilla) abren el modal `#rtMercado` con las `ofertas` de fútbol que ya manda el cartero (también las tuyas, marcadas «Tu oferta» y sin botón: saltarlas hacía que el modal dijera «nadie vende» con tu propia carta publicada), de mayor a menor media; en el editor, filtradas a la plantilla y, con casilla, a quien puede jugar ahí (chips para quitarlo). Comprar pide un segundo toque y va por la acción `compraOferta` del cartero (`puedeComprar` + `fb.comprarOferta`, como la pestaña 🏪). «Abrir el mercado completo» y el 🏪 de la cabecera con los desafíos abiertos van a `#mercado/futbol` (PRODROP con la colección Fútbol elegida).
- **El parámetro de una oferta se llama `oferta`, nunca `id`**: `Red.pide` mete `id` (el del mensaje) en el mismo objeto, y `{ id }` lo pisaba: la respuesta no llegaba y a los 20 s salía «Sin respuesta» aunque la escritura se hiciera. Le pasaba a «Retirar del mercado» del zoom, ya corregido.
- **Entradas**: además de las de arriba, el menú de Sobres de Fútbol tiene la franja `#chRetos` (con el reto de la semana) y el Salón tiene la ficha «Desafío semanal de plantilla» en un jugador (`SOLOS`, `tipo: "sitio"`, pide cuenta; `docs/claude/juegos/salon.md`).
- **No hay botón «Autocompletar»** en el editor (se quitó a propósito: con un toque por plantilla se sabía si se podía armar, y armarla a mano es el juego). `RT.mejorOnce` sigue en `retos.js` para los tests.
- **Tocar una carta en el desafío**: una casilla vacía abre el selector; una llena muestra encima «👁 Ver» y «⇄ Cambiar» (`rt.accion`). El selector muestra **una ficha por carta** (`rt.pick` es su `uid`) con la **mejor copia** (graduada con mejor nota; a igual valor, la ya puesta) y «×N» si tienes varias: antes mostraba la puesta y una copia recién graduada no se podía elegir. Tocar una ficha con una copia muestra «👁 Ver» y «👤＋ Poner» encima; con varias, debajo salen todas (`variantesHTML`) con su nota y «Ver» / «Poner». «Ver» abre el zoom (`verDesdeReto`, `zoomVuelve = 'retos'`): ahí se gradúa (el botón «Graduar» del desafío se quitó: gastaba monedas sin ver la carta) y al cerrarlo se vuelve al desafío con el selector como estaba. `openZoom` toma la copia vigente de `copies` (`sincronizaCopia`): las cartas de `pull` guardaban la copia vieja y, graduada desde otra vista, el zoom decía «Sin graduar». Los botones van dentro del botón de la casilla: paran el toque (`accionesCarta`). El selector se ordena por media, equipo (cada club junto, en el orden de `CLUBES`) o graduación (mejor nota primero, las sin graduar al final), siempre dentro de su grupo (de su puesto / incómodos); se recuerda en `prodrop.ordenElige`.
- El abridor: overlay `#retos` (álbum → editor con `pintaCancha`, selector, clasificación, premios). **No se cierra tocando el fondo** (se salía sin querer; ✕ y Escape sí, y Escape cierra primero el modal de encima). El selector de jugador es un modal (`#rtEligeCapa`) sobre la cancha, no una lista abajo. Entradas: `#cartas/retos` (`?abre=retos`), el botón del resumen del sobre (`#retosBtn`, reemplazó a «Mi plantilla» ahí), el atajo de la tienda de fútbol (`#retosBtn2`), el de la colección en la pestaña Fútbol (`#retosBtn3`) y el segundo botón de las novedades de PRODROP en el Salón (`ATAJO_RETOS`). El borrador de cada plantilla vive en `localStorage` (`prodrop.reto.<uid>.<plantilla>`).
- **Marco de club**: el premio 3 (`PREMIO_MARCO`: las once graduadas con nota 8 o más) que valió de una plantilla `club-<club>` deja `usuarios[u].desafios[<club>] = at` en la economía, y eso desbloquea el marco de perfil `club<club>` (`req: {desafio}` en `perfil-tarjeta.js`; detalle en `docs/claude/juegos/perfiles-y-economia.md`). No se escribe nada nuevo ni hay regla. La ficha del álbum lleva el chip «🖼 Marco» y el premio 3 lo anuncia (hasta el 29-10-2026 lo daba cualquier premio: quien lo tenía así lo pierde); en el editor de perfil el grupo «Clubes» muestra solo los ganados (o el puesto), a propósito.
- **Podio de cada semana** (`MIN_PODIO`, `PODIO_CLUB`, `PODIO_RETO` en `retos.js`). Cada lunes (`finSemana`) la economía mira cada tabla **como estaba justo antes**: de cada cuenta, su última subida anterior, si las once seguían siendo suyas y la plantilla valía (`tablaEn`, evento `ps`, que va antes que todo lo de ese instante). Con 3 personas o más, los clubes pagan 300 / 200 / 100 monedas al 1.º / 2.º / 3.º (cada semana, mientras sigan ahí) y el reto que se cierra 1500 / 1000 / 500 (la recompensa diaria ronda las 1000 a la semana: el podio tiene que valer más). Los montos viven solo en `retos.js`: cambiarlos no toca reglas y vale también para semanas ya cerradas. La Mejor plantilla no tiene podio. Las monedas llegan solas (`premios`, categoría `plantilla`); los sobres del podio del reto (3 Plus / 1 Plus / 1 normal) se cobran con «🎁 Cobrar» dentro de «🎁 Mis premios» (`podioPasadoHTML`, que solo aparece mientras haya sobres por cobrar; acción `cobraPodio`, `fb.cobrarPodio`): `plantillas/q/<uid>/<reto>_p<n>` = {at, k, k2?, k3?} con sus sobres en el mismo `update` (`pl: <reto>_p<n>`), y la economía (evento `pq`) solo los acepta si `usuarios[u].podiosReto[<reto>]` es ese puesto. La economía deja `podiosSemana[<semana>][<plantilla>]` = [1.º, 2.º, 3.º] y el cartero manda el de la semana pasada (`retos.podio`).
- **«🎁 Mis premios»** (botón del álbum, junto a «Próximos retos»; un globo rojo si hay sobres de podio por cobrar): el modal `#rtVer` con el historial de lo ganado en los desafíos (`retos.historial`: los `movs` de la economía con categoría `plantilla`, del más nuevo al más viejo, con su total) y, arriba, el podio del reto mientras sus sobres no se cobren. El podio ya no va arriba del álbum: se veía raro y solo a quien quedó en él. Las descripciones dicen qué premio y qué sobres trajo («Real Madrid · premio 3 + 2 sobres Plus»).
- **Para saber qué había el lunes, cada subida deja su versión**: `plantillas/v/<plantilla>/<uid>/<clave>` = {at, c}, escrita una vez en el mismo `update` que la fila de la tabla (`fb.subirPlantillaReto`). La fila de `plantillas/s` cuenta también como versión (las subidas de antes del podio). **Las reglas nuevas (`v`, `q` y el `pl` de los sobres) se publican ANTES que el sitio**: sin ellas, subir una plantilla falla entero. `economia()` se guarda por objeto de datos, así que el pago del lunes aparece con la siguiente lectura de Firebase.
- **Álbum completo** (pestaña «📖 Álbum completo» del desafío, junto a «🏆 Plantillas»): cada club muestra cuántas de sus cartas tienes y, adentro, todas como en la colección (las que faltan, con nombre, media y posición). Con una copia de **cada jugador** del club (cualquier nota; se cuentan jugadores, no cartas: la especial de alguien cubre su carta normal con `huecoAlbum`, y no hace falta tenerla porque es por tiempo limitado) se cobra una vez `ALBUM` = 2000 monedas + dos sobres Plus. `plantillas/a/<uid>/album-<club>` = {at, c: [una copia por jugador], k, k2} con su sobre en el mismo `update` (`fb.cobrarAlbum`, acción `cobraAlbum`: el cartero elige la copia de cada carta, mejor una que no esté a la venta). La economía (evento `pa`) paga si en ese instante todas eran tuyas y deja `usuarios[u].albumes[<club>]`. No da el marco: ese sigue siendo del premio 3. Un álbum cobrado queda en la lista como **ticket** «🎟 Completado · fecha» aunque después falten cartas (el cartero manda `retos.albumes` = {club: hora}).
- `tests/retos.test.cjs` cubre plantillas, puntaje y premios en la economía (y el `desafios` del marco, y el podio semanal: clubes, reto, «justo antes del lunes» y los sobres según el puesto); `test-rules.mjs` las reglas (sin correr: este equipo no tiene Java para el emulador).

## Posiciones de los futbolistas

- Cada futbolista tiene una o dos posiciones (`M.POSICIONES`, `"DC/EI"`; la primera es la principal): LD, LI, DFC, MC, MD, MI, ED, EI, DC y POR. Salen de EA FC (`alternatePositions` de la misma API de ratings): CDM/CM/CAM = MC, RB/RWB = LD, LB/LWB = LI, ST/CF = DC; se queda la principal y la primera alternativa de otro grupo. `c.posiciones` está en la carta y `c.pos` (línea POR/DEF/MED/DEL) es la de la principal. **No afecta a los sobres** (la rareza sale de la media). Los RM/LM de EA van de extremo cuando la web del club los pone de delanteros.
- `M.ajuste(casilla, posiciones)` → `{nivel: ok|incomodo|mal, pen}`: la cancha de los desafíos lo muestra (anillo verde/amarillo/rojo y «!» o «✕») y `retos.js` lo usa para el castigo.
- Un jugador no puede estar dos veces en el once: en el selector sale con su casilla y, al elegirlo, se va de ella y pasa a la nueva.
