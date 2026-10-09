# Juegos — lobby (salón), guest mode, side rails

The lobby: `colabtex/src/juegos/salon*.js`, `rieles*.js`, `juegos-main.js`, `juegos.html`. Shared architecture in `colabtex/src/juegos/CLAUDE.md`.

**The lobby is the *salón*** (`juegos/salon-datos.js`, pure, and
`juegos/salon.js`, the DOM; the proposal behind it, with screenshots, is
[docs/salon-rediseno.md](docs/salon-rediseno.md)). Mobile first, top to
bottom: the *Novedades* **banner**, a greeting, the **mode bar** (Todos ·
1 jugador · Multijugador, sticky, remembered in `jg.modoSalon`), the guest
notice, **«Para jugar solo» as a carousel right at the entrance** (it used
to be a block at the very end that nobody reached), the rooms column, the
**multiplayer** grid with its Todos/Duelos/En grupo filter, *Últimos tops*
and the PRODROP drops strip. `.jg-sal` places them by grid areas; from
901 px the rooms column (`aside.jg-ves-lado`, sticky) sits to the right and
**spans every row down to the drops strip**: Chrome bounds a sticky grid
item by the whole grid, not by its area, so when the column ended at
«Multijugador» it stayed stuck on top of the strip below. A mode only hides
the section that does not apply (`data-modo` on `.jg-sal`); *Novedades* and
the rooms column (open rooms, top coins, your games) are never hidden.

- **The banner** (`novedadesHtml` + `enganchaBanner` in `juegos-main.js`,
  `.jg-ban` in juegos.html) shows one slide at a time and advances by
  itself every `BAN_MS` (7 s), the next one entering from the right. After
  the last slide goes an `inert` copy of the first, so the loop keeps going
  right and then snaps back without a transition. The clock is a 100 ms tick
  that only counts while nobody is looking closely: mouse over, focus
  inside, hidden tab, the ⏸ button, an open ficha and reduced motion all
  hold it; the active dot fills with the time left. Swipe on touch; a drag
  is never a click. Each slide's art (`arteNovedad`) is drawn at the old
  card's size (380×165) and scaled whole with `transform` — `zoom` pushed
  px-placed pieces out of the box.
- **Últimos tops** (`topsLista`, from `ultimosPodios` in `monedas.js`) are
  the latest `podios` claims — the only club record with a date, since a
  `soloRanks` row has none — still valid by `podioValido`, newest first,
  with the mark only while the row is still that same game. The frame says
  the place: gold with a breathing aura for 1.º, plain silver and copper for
  2.º and 3.º.

- **One thumbnail for both modes** (`.jg-mn`, `tarjeta()`): a 4:3 cover
  (`arteJuego` for room games and their bot practice; for the club an
  illustrated SVG scene from `juegos/portadas-solo.js`, `viewBox` 400×300
  with `slice`, over the old `.sp-e-<id>` background, which stays only as
  the fallback), the name, and one meta line (genre, then
  open rooms / «Duelo» / «En grupo» for multiplayer, «🏆 Ranking» / «📅 Reto
  diario» / «Sin ranking» for solo). What tells the modes apart at a glance
  is the **mode badge** on the cover: one person and «1 jugador» in amber, or
  two people and «2–10 jugadores» in violet — colour never on its own. The
  card and its cover are size containers: `75cqw` is the cover's height
  (where the ▶ sits) and container queries scale the fixed-px art.
- **The «Celular · PC» tags** sit in one white pill under the mode badge
  (`plataformas` in `salon.js`): «Celular» in sky blue (a colour no other
  mark uses) for games played with a finger, «PC» in slate for games played
  with keyboard or mouse, i.e. every game today. The ficha says it as a
  sentence — «Se juega en el celular y en el PC», or «Solo en PC: se juega
  con teclado (y ratón)». **Nobody maintains a list**: the table is
  `src/juegos/controles-datos.js`, **generated** by
  `colabtex/scripts/build-controles.js` at the start of every
  `npm run build` (committed like the bundles), which **reads each game's
  own code** for what it listens to — touch (`touchstart`, `pointer:coarse`),
  pointer/click, movement keys (arrows/WASD) and mouse look
  (`requestPointerLock`). Mouse look without touch, or movement keys with
  no touch and no pointer, means not on a phone. Which code is a game's
  comes from the lobby tables themselves (the `src/juegos/<id>.js` module
  plus the iframe folder it opens, `juegos/club/<x>/`, or a bots practice's
  `url` folder), never the shared files (`mando.js` synthesises arrow keys
  for every game). When the reading is wrong, the game says so in its own
  code with a `@controles: tactil raton teclado` comment, which wins —
  sortEm does, because its one `pointerdown` only picks the mode on the
  title screen. `tests/controles.test.cjs` checks the rule, that the
  reading matches the 34 games tried on an emulated phone (touch,
  390 × 844), and that the generated file is up to date with the code (if
  not: `npm run build`). Novedades read the same table through
  `juegoDeNovedad` (its `juego`, the room it opens or its `#solo/<x>`
  route), so a new one gets its tags too.
- **The club covers keep clear of what the card puts on top**: badges top
  left, the name bottom left, ▶ bottom right; the motif goes top right and
  centre, and the bottom is darkened for the name. Gradient ids carry a
  counter (the same game is in the carousel and in the ficha, and a
  repeated `url(#id)` points at the first one, which may be hidden). The
  pieces with an `a-*` class animate only on hover/focus and in the ficha,
  and never carry an SVG `transform` themselves (the animation would
  replace it): a positioned piece is wrapped in a `<g>` that carries it.
- **Card states**: *nuevo* (green tag; `nuevos()` = the four most recent
  `alta`s of the last 14 days, so the tag cannot spread to half the shop),
  *más jugado* (gold, a star only on narrow cards), *seleccionada* (`.sel`,
  ring in the game's colour, `aria-expanded`, while its ficha is open) and
  *bloqueada* (guest + multiplayer: greyed cover, padlock, «Requiere
  cuenta»).
- **Tapping a card opens its ficha; it never plays or opens a room** —
  opening a room lists it for everyone and announces it on Discord, so it
  cannot happen from a thumb brushing past. **▶ plays at once**, and only
  solo cards have it (it is a real link). **Long-press opens the same
  ficha** (with a short vibration): no action lives only behind a gesture.
  Hover (pointer devices only) lifts the card and shows «Ver opciones y
  abrir sala →» on multiplayer covers.
- **The ficha** (`.jg-hoja`) is a modal bottom sheet up to 720 px — close
  with ✕, the backdrop, Escape or by dragging it down; buttons at the
  bottom, where the thumb is — and a non-modal panel on the right above
  that, starting at 76 px so the header and the mode bar stay usable;
  clicking another card swaps it. It carries the game's open rooms
  («Unirme» to the oldest), the room options (the old `<details>` in each
  card; remembered per game for the visit), the hall of fame
  (`podioHtml`, from the `ranks` `leerPopularidad()` already brought), 📖
  Reglas (in the variant chosen), 📋 Equipos for Pokémon, and «Abrir sala e
  invitar». The capa ignores taps while it closes (230 ms), or the invisible
  backdrop swallowed the next card's tap.
- **Two class names were already taken**: `.jg-mini` is the profile mini
  card and `.jg-ficha` a chip in `cartas.js`. That is why the thumbnail is
  `.jg-mn` and the sheet `.jg-hoja`; check before naming a new piece.

*Novedades* is still a hand-written list (`NOVEDADES` in `juegos-main.js`),
because what is new is not always a room game (today Metro Rush, FANAL and
PRODROP, each with its own cover in `arteNovedad`); each entry may
carry `modo` (the same badge as the thumbnails), and `cuenta`/`practica`
say what a guest gets instead. On a phone the banner puts the art on top.
`novedades()` in `motor.js` is the older date-driven version and is no
longer called.

**Without a session the lobby opens in guest mode** (`state.invitado`), with
no login wall, but **only four games are playable**: Snake, Mina Club,
Tetris Club and sortEm (`LIBRES_INVITADO` in `salon-datos.js`, the owner's
choice). Everything else — the other club games, Frontera, the bot
practices and every room — wears the padlock (`bloqueado`), and a typed
`#solo/<x>` route that is not free (`rutaLibre`) gets the `MOTIVO_CUENTA.solo`
gate in `armazon`. Nothing is saved — no ranking, logros, coins or cloud
save. It needs **no rules change**: the guest never touches the database.
The honest limit: the bot practices are static pages (`juegos/yemas/index.html`
and siblings), so the lobby no longer links them for a guest but whoever
types their URL still plays them; they never write anything.

- Multiplayer cards are shown locked, not hidden (they are the reason for an
  account). Their ficha explains why, offers «Iniciar sesión y jugar» and
  «Seguir como invitado» (no bot practice: those need an account too). Every
  `[data-login]` goes through `entrarConGoogle(juego)`, which remembers the
  game and **reopens its ficha unlocked** once the account arrives. A shared
  `#p/<pid>` shows a gate (`puertaHtml`, texts in `MOTIVO_CUENTA`), and after
  logging in the unchanged hash drops you into that room.
- Ranks, logros, coins, PRODROP and profiles show the same gate; their tabs
  wear a padlock. «Iniciar sesión» is always in reach: the header
  (`#btnEntrar`), the sticky mode bar, the solo bar, every gate.
- `crearSolo({usuario: null})` is the club's guest mode: it watches and writes
  nothing, answers `partida-pedir` with null and loads the frame with
  `cuenta=invitado&invitado=1`, which `conexion.js` (`?v=club-8`) reads to
  replace the ranking panel with the notice. The Frontera still knows the
  `INVITADO` user (`usuario.invitado`: no ranking, no cloud run, teams in
  `localStorage` only), though a guest no longer reaches it.
- What a guest leaves in `localStorage` (`*.cuenta.invitado`,
  `frontera.invitado`, `pk.equipos.invitado`: `esClaveInvitado`) is wiped
  once per tab session (`limpiaInvitado`, flag in `sessionStorage`), so a
  reload mid-game survives but the next visit starts clean.

**On a phone the tabs are a bottom bar** in the menu views (`html[data-vista]`,
set by `render()`): icon plus a short label (`.tab-c`, «Ranking»), fixed above
the safe area, with the ⚑ report button lifted above it. In a room or a club
game they are hidden — those screens have their own «volver».

**On a phone the header is two rows** (≤ 600 px): logo and buttons on top,
the site sections (scrolling sideways) and the 🌐 language selector below.
The selector is therefore a loose child of `.head` (`.jg-idioma`), not inside
`.head-right`: with everything on one row, «Salir» fell off the screen at
360 px and the whole page widened to 389 px. «Perfil» is hidden there (the
avatar opens the same card, with «Ver perfil»), and on touch screens the
header buttons are at least 36 px. Two other phone rules of the same kind:
the ranking table keeps puesto, jugador and puntos and moves jugadas and
ganadas under the name (`jg-jug-sub`, the rest is `jg-opc`), because with
nine columns the points sat behind a sideways scroll; and `.jg-hoja-cuerpo`
is `minmax(0,1fr)`, because the implicit grid column took the min-content of
its widest child (a long podium name, the longest `<option>`) and pushed
the ficha out of a 320 px screen.

**The lobby has two side rails on a wide PC** (`juegos/rieles.js`, the DOM;
`juegos/rieles-datos.js`, pure; `juegos/repeticion.js`, the replays). On the
left, the best game *of the day* of four of the club's most played games,
each in one of its modes (a different lineup each day), stacked and
replayed on a loop with who played it. On the right, the general chat. They hang off
`<body>` and show only in the menu views (`VISTAS_RIEL` in `juegos-main.js`
sets `html.jg-rieles` through `rieles.pon()`, on every `render()`) and from
1400 px (`ANCHO`, which must match the `@media` in juegos.html). There the
`main` narrows to leave them room (`--riel`), rather than the rails covering
it, and the ⚑ moves left of the chat. Narrower, the replays are gone and the
chat is a 💬 button with an unread badge that opens a panel, a bottom sheet
on a phone. Things to keep:

- **The pool and the daily lineup.** `REPES` lists every mode of the five
  games the rail rotates: Tetris (maratón, sprint, ultra), Snake (6 modes ×
  4 sizes), sortEm (10, 20), buscaminas (easy, medium, hard) and 2048
  (puntos, ficha), 34 tables. ALETEO and BBTAN have replays in
  `repeticion.js` but are left out of the rail on purpose (the owner's
  choice); FANAL and Metro Rush cannot be replayed frame by frame, and the
  daily puzzles are a still grid. Each day `alineacionDelDia(dia, popular)`
  picks `POR_DIA` (4) distinct games, sorted by `state.popular` and drawn
  without replacement with the day as the seed and a weight that falls with
  the rank, and then one mode of each, drawn with the same seed among its
  tables that have records (weight: the square root of how many; uniform
  when there is no data). `leerPopularidad` counts the `soloRanks` rows per
  table too (`n[categoria]`) for this. Everyone sees the same lineup that
  day; `pon()` re-checks it on every render.
- **A replay is the anti-cheat proof, not a video.** Every club result
  already carries what it takes to rebuild it, and the four engines are
  deterministic, so `repeticion.js` replays the proof step by step with the
  same engine, copying each verifier's loop (`crearRepro`: `dur`, `en(ms)`,
  `pinta(ctx, w, h)`, `marcador()`). Going backwards rebuilds from the start.
  It always plays at the speed it was played, however long: an earlier
  version sped games over two minutes up to ×4, and a Tetris Maratón
  stopped looking like Tetris.
- **Each scene is drawn like its game**, not as a generic grid: Tetris'
  well with its Guardada/Siguientes boxes and numbers, Snake's lime stroke
  body (interpolated between ticks) under its light score bar, sortEm's
  neon 800-wide scene cropped to the «Time:» and the blocks, Mina Club's
  garden with its flags/time bar, 2048's sand board with the moves sliding
  (`movs` from the engine), ALETEO's sky in `AleteoLore.paleta` of the
  pipes passed (it darkens like the game) and BBTAN's dotted board with
  pixel-framed blocks. The colours and shapes are copied from each game's
  `game.js`/`style.css`, so a reskin of a game has to be mirrored there.
  `tests/rieles.test.cjs` plays robot games of each and checks the replay
  reaches the engine's own final score, also after seeking backwards.
- **BBTAN is the one replay that is not fully real time.** The physics
  plays at the game's own pace (`shotPace` integrated: ×1 for 5 s, then up
  to ×4; squeezed into the real gap when the player fast-forwarded), but the
  thinking before each shot is cut to `BB_APUNTA_MAX` (1.5 s), or a long
  game would be mostly a still board. It keeps a board snapshot before every
  shot, so seeking (the last-stretch start, going back) never re-simulates
  hundreds of rounds of physics on the lobby's thread. The rail splits its
  height by each scene's `aspecto`, with no card box around them.
- **`repeticiones/<cat>/<uid>`** = `{dia, o, p, t, n, v, d, at}`: each
  account's best game of the day. `apuntaRepeticion` in `juegos-main.js`
  writes it from `alResultado` (which now also gets the proof, third
  argument in `solo/club.js`) even when it is not a record, only when it
  beats the stored one, one write at a time. `o = dia·1e10 + score`, where
  score is the points, or `1e9 − tiempo` for the time tables. The rule
  recomputes it, so «the three highest `o`» (`watchRepeticiones`) are the
  best of the latest day with games, without downloading every proof. The
  rule whitelists the `REPES` categories and lists the time tables for
  `o` (a test checks both match `REPES`), so a
  new game in the pool needs the rules re-published; until then its daily
  write fails quietly and the rail shows its all-time record.
- **What is replayed is verified first**, with the same `verificaClub` and
  the owner's uid; a hand-written row that does not check out is skipped for
  the next one. With nothing stored (or before the rules are published) the
  card replays the all-time record of the club table, whose proof is already
  in `soloPruebas`.
- **The 20 s between chat messages is the rule's, not the page's.**
  `chatGeneral/<id>` and `chatGeneralUlt/<uid>` = `{at, k}` go in one
  `update`, and each rule checks the other (the `gratis` pattern), with
  `now >= previous at + 20000`. The page counts down on the button and shows
  only the last 15 minutes. It re-subscribes every 10 min so the query
  window does not grow with the session. Messages older than a day can be
  deleted by anyone signed in, and the lobby sweeps a few on opening.
- Guests see a login gate in both rails (no rule change for them). Names in
  both rails get `translate="no"` and the live profile through `mezcla`.

The three nodes need the rules re-published (`firebase/CONFIGURAR-FIREBASE.md`).
