# Juegos — lobby (salón), guest mode, side rails

The lobby: `colabtex/src/juegos/salon*.js`, `rieles*.js`, `juegos-main.js`, `juegos.html`. Shared architecture in `colabtex/src/juegos/CLAUDE.md`.

**The lobby is the *salón*** (`juegos/salon-datos.js`, pure, and
`juegos/salon.js`, the DOM; the proposal behind it, with screenshots, is
[docs/salon-rediseno.md](docs/salon-rediseno.md)). Mobile first, top to
bottom: the *Novedades* **banner**, a greeting, the **mode bar** (Todos ·
1 jugador · Multijugador, sticky, remembered in `jg.modoSalon`), the guest
notice, **«Para jugar solo» as a carousel right at the entrance** (it used
to be a block at the very end that nobody reached), the rooms column, the
**multiplayer** grid with its Todos/Duelos/En grupo filter, *Últimos tops*,
the PRODROP drops strip, the Mascotas legendaries strip and the Batalla de
Rock legendaries strip. `.jg-sal`
places them by grid areas; from 901 px the rooms column
(`aside.jg-ves-lado`, sticky) sits to the right and **spans every row down
to the last strip** (`tirar`; a new strip must be added to the three
`grid-template-areas` of the media query, with the `1fr` row moved to it): Chrome bounds a sticky grid
item by the whole grid, not by its area, so when the column ended at
«Multijugador» it stayed stuck on top of the strip below. A mode only hides
the section that does not apply (`data-modo` on `.jg-sal`); *Novedades* and
the rooms column (open rooms, top coins, your games) are never hidden.

- **The search** (`buscadorHtml`/`enganchaBuscador` in `juegos-main.js`,
  ranking in `juegos/buscador.js`, pure, `tests/buscador.test.cjs`) lives in
  the sticky mode bar: a field with a «/» shortcut on PC, a 🔍 that unfolds
  over the bar on a phone (`.jg-modos.buscando`, and the bar scrolls up to
  stick so the list has room above the tab bar). It is **not a literal
  match**: each query word scores its best hit across weighted fields
  (`PESOS`: name, `APODOS`, genre, tags derived from the entry —
  solo/multi/duelo/celular/diario—, modes, lema), exact > prefix > one typo
  (Damerau, same first letter, words ≥ 5 letters) > substring. Popularity
  and «nuevo» only break ties (≤ 2.5 points); a bots practice goes after
  its game. Picking a result opens the **ficha** (never plays or opens a
  room); Mascotas and PRODROP (`SITIOS_BUSCA`) navigate. A new game is
  found by its name with no change; give it a row in `APODOS` (the test
  requires one for every non-bots entry).
- **The banner** (`novedadesHtml` + `enganchaBanner` in `juegos-main.js`,
  `.jg-ban` in juegos.html) shows one slide at a time and advances by
  itself every `BAN_MS` (7 s), the next one entering from the right. After
  the last slide goes an `inert` copy of the first, so the loop keeps going
  right and then snaps back without a transition. The clock is a 100 ms tick
  that only counts while nobody is looking closely: mouse over, focus
  inside, hidden tab, the ⏸ button, an open ficha and reduced motion all
  hold it; the active dot fills with the time left. Swipe on touch; a drag
  is never a click. **Each slide is a full-width animated scene**
  (`juegos/novedades-arte.js`, one SVG of 1200×420 per game with
  `xMaxYMid slice`) with the text over a dark veil on the left. The
  scene's subject must stay between x ≈ 600 and 1180: on PC the veil
  covers the left, on a phone the scene is the top strip and the slice
  shows only the right half. PRODROP's scene is HTML (its cards are
  photos). Only the visible slide (`.on`) animates; its text enters in a
  cascade (not again when the loop snaps back: `.ya`). An animated piece
  (`ep-*`) must never carry an SVG `transform` itself (wrap it in a `<g>`):
  the CSS animation replaces it — `salon.test.cjs` checks it. Each game's
  PRO DEFENDER's attackers walk the path with `ep-marcha`, whose keyframes
  are the vertices of `PD_CAMINO` (percentages = cumulative length): change
  one, change both. Each game's
  name is a logo in its own font (Bungee, Lilita One, Cinzel; Google Fonts
  link in juegos.html), with a hook line (`gancho`) and three big facts
  (`datos`) under the lema.
- **Últimos drops legendarios · Mascotas** (`pintaDropsMascotas`, from
  `mejoresDropsMascotas` in `mascotas-datos.js`): the legendary items of
  valid gifts, newest first, with who and when (names `translate="no"`).
  The photos come from the Mascotas viewer, requested only once the strip
  is in view (`vigilaDropsMascotas`, an IntersectionObserver): the lobby
  does not load three.js for someone who never scrolls there. Dances have
  no photo and show their emoji. A guest gets the `MOTIVO_CUENTA.mascotas`
  gate in the strip instead (the PRODROP strip is simply hidden).
- **Últimos drops legendarios · Batalla de Rock** (`tiraRockHtml`,
  `pintaDropsRock`, from `dropsRock` in `monedas.js`: the legendary pieces
  of valid `cajasRock`, newest first). Photos from `rock-fotos.js` (the rock
  scene's photographer worker; localStorage `claveMini`, shared with the
  game's editor), asked only once the strip is in view
  (`vigilaDropsRock`). Hidden for guests and when `veRock()` is false.
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
  The ficha is a wider crop that shows only y ≈ 62–238 of the 400×300
  scene, its ✕ covers x > 345, y < 115, and on a phone it writes the name
  on one wide line (up to x ≈ 255). So a figure that has to be seen whole
  goes between those lines. Metro Rush's cover was checked against all
  three shapes (card, row, ficha) in light and dark, at 1280 px and on a
  3× phone: a runner on a board, a train coming head-on and the «MR»
  wagon, with the coins above the name rather than beside it.
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
because what is new is not always a room game (Mascotas, PRODROP). Today it
holds **twelve slides in the owner's order** — PRODROP · Fútbol (the football pack, scene `futbol`), Pro BoxHead, Momazo :v, PRO DEFENDER, PRO HERO, Mascotas, PRO TILES,
HaxBall, TULONES (one slide for the local and the online game), Trigon,
PRODROP, FANAL — pinned by `salon.test.cjs`. The order is not by date: the
«★ Lo último» seal goes to the newest `alta` (`selloNovedad`), «Nuevo» to
the last 14 days, «Destacado» to the rest. Each slide has its scene
and a **big «Jugar» button** (`.jg-ban-jugar`, the game's
colour, text in `--tinta` from `tintaSobre` so yellow gets dark text): it
goes to `ruta`, or opens the game's ficha (`ficha`) for a room game — the
banner never opens a room by itself. For a guest the same button reads
«Iniciar sesión y jugar» when the slide needs an account. Entries may carry
`modo` (the same badge as the thumbnails). On a phone the banner puts the
art on top and the button spans the width. `novedades()` in `motor.js` is
the older date-driven version and is no longer called.

**For a guest «Para jugar solo» is a grid, not a carousel** (`.jg-sal-inv`
on `.jg-sal`, the same rules as `data-modo=solo`, arrows and «Ver todos»
hidden): in a sideways row the solo games looked few next to the
multiplayer grid, and they are exactly what a guest can play (owner, Oct
2026).

**Without a session the lobby opens in guest mode** (`state.invitado`), with
no login wall, and **every single-player game is playable** — the whole
club, Frontera and the bot practices — **except PRO HERO and Tenkaichi 3**
(`CON_CUENTA_SOLO` in `salon-datos.js`: PRO HERO keeps songs and stars in the
account, BT3's disc is private). Owner's call, Oct 2026: with only eight
free games new visitors were asked to log in before they had played
anything, and they left instead. A new solo game is therefore free for
guests by default. The four *destacados* BBTAN, ALETEO, FANAL and Trigon
(`DESTACADOS_INVITADO`) still go first in the guest's carousel and are the
only ones whose score survives a later login. Rooms wear the padlock
(`bloqueado`), and a typed `#solo/hero` or `#solo/bt3` (`rutaLibre`) gets the
`MOTIVO_CUENTA.solo` gate in `armazon`. Nothing is saved — no ranking,
logros, coins or cloud save. It needs **no rules change**: the guest never
touches the database. The club games already knew guest mode
(`invitado=1`, conexion.js `club-8`: PRO DEFENDER's `EN_LA_NUBE`, Metro
Rush's ghost) and Frontera plays with the `INVITADO` user.

- **The guest picks a name** (`pideNombreInvitado` in `juegos-main.js`,
  `.jg-nom`): the first game a guest opens shows «¿Cómo te llamamos?» over
  the game (which keeps loading behind), prefilled with a suggestion
  (`sugiereNombreInvitado`, «Pudú 27») so playing stays one tap; it is not
  auto-focused on a phone (the keyboard would cover the game). The mobile
  welcome asks it in step 2 instead, so the game does not ask again. It is
  cleaned by `limpiaNombreInvitado` (20 chars, no `<>`/controls) and lives
  **only in `sessionStorage`** (`jg.invitado.nombre`): «nothing is saved» holds
  for the name too, and the next visit asks again. It shows in the greeting,
  the solo bar and the lobby notice («cambiar» reopens the prompt), always
  under `translate="no"` (`[data-nombre-inv]`, repainted in place by
  `pintaNombreInvitado`), and Frontera gets it through `invitadoConNombre()`.
  It is never sent anywhere; Analytics only gets `jg_invitado_nombre {cambio,
  desde}`.

- Multiplayer cards are shown locked, not hidden (they are the reason for an
  account). Their ficha explains why, offers «Iniciar sesión y jugar»,
  «Seguir como invitado» and, when the game has one, its bot practice
  («Practica solo contra bots, sin cuenta»). Every
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
  `localStorage` only), with the guest's chosen name.
- **The mobile welcome** (`abreBienvenida` in `juegos-main.js`, `.jg-bv`):
  a first visit from a phone (`pointer:coarse`, smaller side ≤ 600 px)
  without a session, on the lobby route only, gets **one screen to play
  now**: «Juega ya, sin cuenta», how many solo games are free, the guest
  name field and the four destacados as big covers with ▶; «Ver todos los
  juegos» and «Ya tengo cuenta · Iniciar sesión» sit below as secondary
  exits. It used to open on Iniciar sesión / Crear cuenta / «Continuar como
  invitado», and asking for an account before playing is what made new
  people leave (owner, Oct 2026). Once per device (`jg.bienvenida`, also
  set on any login). A link to a game or a room skips it.
- **What a newcomer sees first can be played right there**
  (`ordenaNovedades`, `ordenaEntradas` in `salon-datos.js`, stable sorts):
  for a guest, banner slides that need an account (`novedadPideCuenta`) go
  last, and on a phone (`enCelular`) PC-only games go after the rest, in
  the banner, the solo carousel and the multiplayer grid. Within each group
  the owner's order (banner) or popularity (catalogue) stands; logged in on
  a PC nothing changes. The first slide a guest saw on a phone was Pro
  BoxHead: multiplayer, PC only, «Iniciar sesión y jugar».
- **«Lo que te estás perdiendo»** (`avisaPerdido`): every finished club game
  reaches `alTerminar` (crearSolo, before verifying, with or without
  account), which keeps the visit's tally in memory (`visita`: plays, best
  per category, last). A guest who finishes a game that does not carry over
  gets a bottom card: «¡Buena partida, <nombre>!», what an account would
  have earned this visit (`ganariaInvitado` in `monedas.js`: `PAGO_CLUB` per
  play with the daily cap, `RECORD` + `extraRecord` per best, logros by
  `deMarca`), «Crear cuenta gratis» and «📣 Retar». It shows on the first
  game of each title and then only on a new best or a new logro. The
  carry-over games put the same line in «¿Guardamos esta partida?»
  (`lineaGanaria`). Inside that card a `<b>` in the paragraph renders as a
  block (`.jg-invg-txt b` is the title): use `<strong>`.
- **«Reta a un amigo»** (`reto.js`, pure; tests in `enganche.test.cjs`):
  «📣 Retar a un amigo» in the solo bar (games with ranking) shares the
  visit's best mark in the last category played, as
  `juegos.html?rc=<cat>&rp=<puntos>&rt=<ms>&rn=<nombre>#solo/<x>` (share
  sheet on a phone, else clipboard + WhatsApp). Whoever opens it gets a
  `.jg-reto-tira` («Pia te reta: supera 60.00 s en Mina Club · Fácil») and,
  when a result beats it in the club's order (`superaReto`), «¡Le ganaste a
  Pia!» with «Devolver el reto». The reto lives in `sessionStorage`
  (`jg.reto`) and leaves the address bar at once, so the next share does
  not carry someone else's. Nothing is verified or saved: it is only a
  local notice, so a made-up reto costs nothing. Works with or without
  account; no rules.
- **Install as an app** (`manifest.webmanifest`, linked from `juegos.html`
  only, start `juegos.html?desde=app`; icons `marca/icono-192.png`, the
  512 master and `icono-maskable-512.png`): `ofreceInstalar` offers it once
  per visit, when the person comes back to the salón after playing, never in
  the installed app (`enApp`). Chrome/Android/PC: the saved
  `beforeinstallprompt` behind «Instalar»; iPhone: the Compartir → «Agregar
  a inicio» instructions. «Ahora no» silences it 14 days on that device
  (`jg.instalar.no`).
- **The guest name can become the nickname**: an account just created
  (`sign_up`) in a tab that was the guest with a name gets «¿Te seguimos
  llamando <nombre>?» (`ofreceApodo`); only on «sí» it writes
  `users/<uid>/perfil/nick` (`fb.ponNickPerfil`, existing rule).
- **Login in the iPhone home-screen app** is a redirect on our own domain
  (`conRedireccion` in `src/firebase.js`, details in
  `docs/claude/firebase.md`): `entrarConGoogle` keeps the game to reopen and
  the origin in `sessionStorage` (`jg.login.vuelta`) and
  `recogeLoginRedirigido` picks them up, with `resultadoLogin()` for
  `sign_up` and the nickname offer.
- **A destacado's score is saved if the guest signs in later.** The four
  plus Tetris, Snake, 2048 and PRO PACMAN (`DE_INVITADO` in
  `solo/verifica.js`; the welcome and the carousel still feature only the
  four `DESTACADOS_INVITADO`): `crearSolo`
  verifies the guest's result with uid `invitado` and keeps the best per
  category in `jg.club.pendientes.invitado.<juego>`; a new best opens
  «¿Guardamos esta partida?» (`ofreceGuardar`, fixed on `<body>`, above the
  immersive game), and the game screen carries a guest strip
  (`.jg-inv-tira`) from the start. On login `subeDeInvitado` re-verifies
  each pending result, saves it through `guardaClub`, runs
  `alResultadoClub` (coins, logros) and toasts; on a write failure it is
  moved to the account's own pending key, which `crearSolo` retries.
  **Only if this tab was the guest** (`vinoDeInvitado`, the
  `jg.visitaInvitado` flag of `limpiaInvitado`): leftovers from another
  visit may be another person's. The proof keeps `u: "invitado"` (the
  account is in each game's seed, so it cannot be re-signed), and
  `verificaClub` accepts that `u` for any owner in those games, audits
  included. Honest limit: another account could copy such a proof from
  `soloPruebas` and tie that mark, never beat it. No rules change.
- **The half-played game follows too.** The frame of a destacado opened
  with an account in a tab that was the guest gets `&deinvitado=1`, and
  `Club.deInvitado(key)` (conexion.js) hands the game what it stored under
  `key.cuenta.invitado`, once, deleting it: BBTAN and Trigon adopt their
  `*-partida` (Trigon accepts `u: "invitado"` in `retoma`), ALETEO and
  FANAL merge their `*.progreso` with `mezclaProgreso` (FANAL's travesía
  checkpoint included), 2048 merges its progress (not the half-played board,
  whose seed is the guest's), and the cloud copy follows by itself.
- **The guest funnel is measured** with Firebase Analytics (`evento()` in
  `src/firebase.js`, which never throws and does nothing without Analytics):
  `jg_bienvenida_ver`, `jg_bienvenida_elige {opcion, paso}`,
  `jg_bienvenida_juego {juego}`, `jg_invitado_abre {juego}`,
  `jg_invitado_partida {juego, categoria, mejoro}`, `jg_invitado_aviso` /
  `jg_invitado_aviso_cierra`, `jg_login_pide` / `jg_login_cancela {origen}`,
  the standard `login` / `sign_up {method, origen}` (from
  `getAdditionalUserInfo().isNewUser`; `app: 1` after the iPhone redirect)
  and `jg_invitado_guardado`; since Oct 2026 also `jg_invitado_nombre
  {cambio, desde}`, `jg_invitado_resultado {juego, categoria, mejoro}` (every
  guest game), `jg_perdiste_ver {juego, monedas, logros}` /
  `jg_perdiste_cierra`, `jg_reto_comparte {juego, marca}` / `jg_reto_llega
  {categoria}` / `jg_reto_gana`, `jg_instalar_ver {tipo}` / `_acepta` /
  `_rechaza` / `_cierra` / `_hecho`, `jg_app_abre {ios}` and
  `jg_apodo_invitado {usa}`. The funnel to build in GA4 (Explore → Funnel):
  `first_visit` → `jg_invitado_abre` → `jg_invitado_resultado` →
  `jg_login_pide` → `sign_up`; retention is GA4's own cohort report. `origen`
  is the button's `data-origen` (`bienvenida-entrar`, `aviso-guardar`,
  `franja-invitado`, `nombre-invitado`, `perdiste`…; `ficha` or `otro` by default). Event names and site
  ids only, never anything a person wrote. Read them in the Firebase
  console → Analytics → Events (custom params need registering as custom
  dimensions to show in reports).
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
- **The general chat is on every view, not just the menus.** `rieles.pon(si,
  conChat)`: `si` = the rails (menu views), `conChat` = the chat (every view
  with a session). Docked in the right rail only on a wide PC menu view;
  everywhere else it is the 💬 bubble with the red unread count
  (`html.jg-cg-flota`, set by `ponFlota`), a panel on PC and a bottom sheet
  on a phone. In a room on PC the bubble goes bottom-left, because the
  room's own chat is the right column. **Fullscreen hides it**: one rule
  lists `jg-inm`, `jg-tt-inm`, `jg-club-inm`, `jg-club-pleno`, `jg-prodrop`
  and `jg-mascotas`; a new fullscreen mode must join that list.
- **Super chats** (`SUPER_CHAT` in `rieles-datos.js`: ⭐ Destacado 100 🪙 for
  1 h, 🌟 Estelar 300 🪙 for 2 h), bought from the ✦ button of the form. The
  same `chatGeneral/<id>` carries `s` (the price) and `sa` (server time
  again, only on these, indexed), and the charge is `superChat/<uid>/<id>` =
  `{at, p}`, all in the one `update`; each rule checks the other's price,
  and the charge is write-once. Live ones come from a second query
  (`watchSuperChats`, `orderByChild("sa")` since `SUPER_MAX_MS`), so the
  15-minute query does not have to grow. `chatVisibles` merges both lists
  without duplicates and gives each message its level's duration. The
  economy charges it (event `sc`, category `superChat`); one that was not
  funded stops the account like any spend and is painted as a normal
  message (`ctx.superPagado` → `false`). The whole message gets the outline
  (gold, or a moving gradient for Estelar). Changing a price or duration is
  `SUPER_CHAT` **and** the rules (`chatGeneral/$id/s`, `superChat/$uid/$k/p`;
  `tests/rieles.test.cjs` checks they match).

The nodes (and `superChat`, and the `sa` index) need the rules re-published (`firebase/CONFIGURAR-FIREBASE.md`).

**Halloween mode** (`juegos/halloween.js`, its CSS block «Modo Halloween»
at the end of `juegos.html`, `tests/halloween.test.cjs`): from 1 October to
1 November inclusive, in the viewer's local time, and off by itself on
2 November (a timer re-checks at midnight, so an open tab turns too).
Everything hangs off `html[data-halloween]`: `on`, `off` (the person
turned it off from the salón ribbon, `jg.halloween = "no"`) or absent out
of season. An inline script in `<head>` sets it before first paint, like
the dark theme; it repeats `estadoHalloween` in one line and the test runs
both over every day of the year. Every rule of the block must require the
attribute or be a mode-only piece (`.jg-hw*`, `.hw-*`) — the test checks
it — so out of season the page is exactly the usual one. `?halloween=1` /
`?halloween=0` force it to preview or remove it. What it does: night/pumpkin
header with bunting and the Halloween logo (`marca/paginita-pro-halloween.svg`,
swapped by CSS; the favicon is swapped by the inline script and by
`aplica()` in halloween.js through `link[data-favicon-hw]`), orange accents, cobwebs on
the thumbnails and the banner (on `.jg-mn::after` and `.jg-ban::after`, not
on the cover: `.sp-e-metrorush` already uses the cover's pseudo-elements),
a spider on every fourth card, and the ribbon with the countdown in
`.jg-sal-intro` (its 🎃 sends a «¡Bu!» ghost across). Two `pointer-events:none`
layers on `<body>` — `.jg-hw-fondo` behind the content (moon, stars,
graveyard with the haunted house, fog) and `.jg-hw` in front (bats, ghosts
peeking from the edges, the spider) — show only on the menu views and the
login screen, never in a room, a club game or immersive mode; reduced
motion hides the front layer. Game art is never repainted. The page gradient lives on
`.jg-hw-fondo` (fixed), never on `<body>` with `background-attachment:
fixed`: iOS Safari ignores `fixed`, the gradient repeated every screen
height and scrolling showed a hard horizontal cut. The sticky mode bar's
colour matches the top of that gradient for the same reason. The far hill fades upwards (a
gradient fill) and the cemetery box keeps the drawing's aspect ratio on
wide screens: a hard hill edge with the orange glow behind it, and a
`slice` crop that flattened the tree and the chimney, read as an orange
line across the page.

**The Halloween shop strip** (`tiraTiendaHtml`, inside `.jg-sal-intro`
under the Halloween ribbon, so no grid area changed) shows while the
limited shop sells, whether or not the decoration is on; its countdown is
refreshed every 30 s by `refrescaCuentas`, never by repainting the salón.
The shop window itself opens on entry once a day. Details in
`docs/claude/juegos/perfiles-y-economia.md`.

**Lobby performance: no animation inside an SVG that runs all the time.**
A traced lobby spent ~75 % of the main thread in «Layerize»: any repaint
makes Chrome recompose the whole page, and an animated `transform` on an
SVG child (or a non-composited pseudo-element) repaints every frame. So:
the Halloween bat wings and spider legs, and Catan's sea and boat
(`arteCatan`, three stacked SVGs), animate HTML wrappers instead; the
banner's «Jugar» pulse runs only on the visible slide, with `will-change`,
and pauses with the scene when the banner leaves the viewport (`.fuera`,
an IntersectionObserver in `enganchaBanner`, which also stops moving the
progress bar then); the banner tick only moves that bar and repaints the
pause button only when it changes (it used to rewrite its text 10×/s,
which i18n.js re-scanned); and a card off screen pauses its cover's
animations (`.dormida`, `vigilaPortadas` in salon.js). A new cover or
scene that must animate forever should move an HTML element, not
something inside its SVG. The strips that `pintaMonedas` fills (top coins, PRODROP drops, últimos
tops, referidos) go through `ponHtml`, which skips the write when the HTML
is the same: it runs on every Firebase read, and rewriting reloaded the 24
card photos and made i18n.js rescan the text each time (the Mascotas and
Rock strips have their own `firma`).

**Avatar frames are still in the salón and the general chat** (rule after
the Halloween reduced-motion block in juegos.html): every `.jg-av` inside
`.jg-sal` or `.jg-cg-lista` has its animations paused (the SVG adorno and
the `::before`/`::after` of the CSS frames), and they run while the pointer
is over their row or tile (`.jg-drop`, `.jg-top`, `.jg-cg-msg`, `li`, `a`).
Measured with this stylesheet: 4 moving frames on screen kept the main
thread 25 % busy, 12 → 41 %, 30 → 92 % at 26 fps; the three drop strips
(24 tiles each, mostly the heavy box openers, who wear animated frames)
froze the page at the bottom. The rock photos themselves cost nothing once
painted (their one-time cost is in the worker). A new list of avatars in the
lobby is covered by the rule; one outside `.jg-sal` needs adding to it.
