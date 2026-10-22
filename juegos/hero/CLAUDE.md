# PRO HERO — notes for Claude

A Clone Hero–style guitar/bass/keys/drums game, written by the owner as
plain ES modules (no build) and integrated here. Two ways in, one document:

- **The club card** (`heroclub` in `salon-datos.js`, route `#solo/hero`):
  `juegos/hero/index.html` full-window (`html.jg-hero`), with its own menu.
  Postman: `colabtex/src/juegos/hero.js` (`crearHero`).
- **The room game** `hero` (2–8, `JUEGOS.hero`): the same document with
  `?modo=online`. Postman: `colabtex/src/juegos/hero-sala.js`
  (`crearHeroSala`), reducer `redHero` in `motor.js`.

**Batalla de Rock** (the 3D stage behind the highway, «Tu rockero», rock
boxes; open to everyone) lives in `js/rock/`: read
`js/rock/CLAUDE.md` before touching it or `session.js`'s `_…Rock` methods.

Shared Juegos rules: `colabtex/src/juegos/CLAUDE.md`; logros/coins:
`docs/claude/juegos/perfiles-y-economia.md`; anti-cheat:
`docs/antitrampas/hero.md`.

## Songs and downloads

- 333 songs live in **Firebase Storage** under `hero/songs_save/`
  (`library.json` + one folder per song), uploaded by the owner with
  `gcloud storage rsync` from their PC (the tools stay there, in `web-hero/`).
  `firebase/storage.rules` lets any signed-in user read `hero/**` and nobody
  write it.
- The frame has its **own Firebase SDK** (gstatic 10.12.2, `js/cloud.js`,
  config in `js/site.js`). Same origin, so it shares the site's Google
  session. Downloads go through the Storage REST API with the ID token (to
  show MB progress) and land in Cache Storage (`hero-canciones-v1`, 800 MB
  LRU, invalidated by the song's `v`). Only `library.json` (~260 KB) on
  open; a song (~5 MB) only on «Jugar»; a cover only after dwelling on it.
- **Menu preview with Firebase = Apple's 30 s** (`js/applePreview.js`), never
  the song from Storage (that would cost ~5 MB per song browsed). The iTunes
  Search API has open CORS and no key; `<audio>` plays `previewUrl` straight
  from Apple. Apple cuts at ~20 searches/min per IP, so: a song never looked
  up is searched only after `APPLE_ESPERA` (700 ms) on it, each answer (also
  «not there», retried after a month) lives in localStorage
  (`hero-apple-v1`), and any failure (Apple's 403 may arrive without CORS)
  rests a minute. Browsers that can't play AAC (`.m4a`, e.g. open-source
  Chromium, Playwright's included) never search. The artist must match
  (`eligeApple`): better no preview than someone else's song. A stored URL
  that fails to play is forgotten and searched again next time.
- `?fuente=servidor` makes the frame read `api/library` and `songs/<id>/…`
  next to it instead (the owner's local Node server). That is also how to
  test it without Firebase: drop a fake `api/library` + `songs/<id>/` in the
  folder, serve with `npm start`, and never commit them.
- `sfx/` are sound effects taken from Clone Hero. The owner was warned the
  repo is public; deleting the folder falls back to synthesized sounds.
- **BT3 reuses these modules** (`juegos/bt3/pagina.js`, «la música de pelea»): it imports `js/cloud.js`,
  `js/site.js` and `js/songCache.js` to fetch `chinchonchin` as its battle music, with the same cache keys as
  `fetchSongFile`. Renaming their exports, `SITE.storageRoot` or the cache key format breaks BT3's music (it then
  falls back to the game's own music, silently).

## Stars, records and the ranking (`hero.js`, `hero-datos.js`)

- **Gold stars only on the hardest difficulty that instrument has in that
  song** (`dificultadMaxima` in `js/sitio/clave.js`, from the parsed chart,
  usually Expert); any other difficulty gives **blue** stars. The engine
  gives 0–6; a 6th counts as 5.
- Per song and account, `heroMias/<uid>/<clave>` = `{g, b, s}`: best gold,
  best blue, best score (rules: only up). `clave` is `claveCancion(id)`
  (cyrb53 in base 36): library ids can hold `.`/`/`, which RTDB keys can't.
- The song list paints gold then the blue you have *beyond* the gold
  (`estrellasDe`: 4 blue + 3 gold → ★★★ gold + ★ blue).
- Per-song top under «Jugar»: `heroCanciones/<clave>/<uid>` (best score of
  each). The frame asks for it only after **3 s on the same song**
  (`TOP_ESPERA` in `songSelect.js`) and both sides cache it per visit:
  scrolling the list downloads nothing from RTDB.
- **The only ranking is the general one**, a club row
  `soloRanks/club-hero-estrellas/<uid>`: `puntos = gold·10 000 + Σ max(g,b)`
  (`codificaHero`), so the club order ranks by gold and breaks ties by blue,
  and the number only grows (the soloRanks rule wants that). `tiempo` is a
  fixed 1. `h`/`h5` = songs with any gold / with five gold (rules accept them
  only on this category). Its `soloPruebas` proof is the star map. It is
  rewritten from all of `heroMias` after each song, so a failed write heals
  itself on the next song. The Clasificación tab shows it under «Un
  jugador» (`ranks.js`: `hero` in `EXTRA`/`SOLO`, filtered out of «En sala»).
- Room games do **not** write `ranks/hero` (`anotar` skips it).

## Coins (`monedas.js`)

- Each finished song is a club play: `clubJugadas/<uid>/hero`, `PAGO_CLUB`
  50, fifteen a day (`marcaJugadaClub(…, {silencio})` — the frame shows it).
- Stars, from the row (`monedasHero`): 100 per gold and 50 per blue not
  already covered by a gold, i.e. `50·(g + max(g,b))` per song. Each star
  pays once; blue → gold pays the missing 50.
- Logros (`SOLO.hero` in `logros.js`, `NIVEL.hero`): designed so ~40 songs
  well played on Expert give all ten (the last is 40 songs with five gold).

## Battle mode (`js/game/batalla.js`, Guitar Hero III style)

- **1 vs 1 only**: local (Elegir instrumento › «Modo: ⚔️ Batalla» on P1; alone
  → a bot rival with your part and difficulty) or a room whose director picks
  «Modo: Batalla» (move `{t:"modo", m}` in `redHero`, `room.modo`; with ≠ 2
  players in the round it plays normal).
- **No Star Power**: each completed SP phrase gives a power (max 3,
  `PODERES`: amp overload, broken string, lefty flip, blackout, drain,
  steal); the SP button launches the oldest at the rival (`_lanzaBt`; it
  never reaches the engine). A **life bar** replaces the SP cell: hits +,
  misses/overstrums −; 0 = K.O., the song ends `FIN_KO` s later. No K.O. →
  more life wins, then score (`cierra`).
- Effects are **render or input only** (`p.batalla` from `bt.pintura` →
  `highway.js`: `zurdo` flips lanes, `amp` shakes + flickers gems, `apagon`
  hides notes before the bar, `roto` overlay); a broken string drops that
  fret before the `Grabadora` and counts presses to repair (`REPARA`). The
  bot is hit through `Bot.torpe` / `sinTraste` / `sinSP`.
- **Battles are never saved** (no `prueba`, no `resultado`): no stars,
  records or coins. The results screen says who won and how.
- **Online**: each client simulates only its own player; its state packet
  carries `bt` = `vista()` (life, powers, effects with seconds left, K.O. and
  the last launched attacks, repeated because the mesh drops packets). The
  rival applies attacks once per id (`recibidos`) and copies the rest
  (`ponRemoto`); attacks during the countdown are ignored (stale packets).
  The `fin` move adds `bv` (life ×1000) and `ko`.

## Proof and verification (`js/game/prueba.js`)

The engine (`js/core/engine.js`) is the owner's, with one fix: **extended
sustains** (`_matches`, `heldSustainMask`) — the frets of a sustain still held
don't count when reading the next note, as in Clone Hero. Without it, holding
a long yellow and tapping green/red on top never hit (the highest fret was
the yellow) and lifting it dropped the sustain (Dragon Ball Rap, 39 notes).
Any engine change alters replays: bump `hero-N` and rebuild. What changed is
**how the session drives it**: a human player plays through a `Grabadora`.
The engine advances on a fixed grid (`hasta`, every 5 ms of song time) and
each action is rounded to 0.1 ms and logged with the grid index reached, so
`rehace` replays the very same calls. Rules that keep it exact:

- never call `engine.update`/`fret`/… directly for a human in `session.js`:
  go through `p.grab` (the bot keeps calling the engine; it is never
  recorded);
- any new action that changes engine state (like the `held = 0` on resume,
  `SUELTA`) needs its own op code in `aplica`;
- the engine options come from the proof header (`opcionesMotor`); a setting
  that changes scoring must go in the header.

`hero.js` (`verificaHero`) replays it in the page with the chart bytes the
frame sends, and checks score, stars, song, part and «not a bot». Details
and limits in `docs/antitrampas/hero.md`. `tests/hero.test.cjs` plays
synthetic charts like a human (irregular frames, jitter) in all note modes
and requires bit-identical stats.

## Frame ↔ page (`js/sitio/puente.js`)

`postMessage` on channels `hero-hijo` / `hero-padre`. Frame → page:
`listo`, `resultado` (with `prueba`, `chart`, `ini`), `top-pedir`,
`ranking-pedir`, `volver`, `en-linea`, and in a room `red` (below). Page →
frame: `cuenta` (+ `mias`), `mias`, `top`, `ranking`, `veredicto` (saved?
new stars, coins), `tema`, `red`. The frame never touches RTDB.

## Online room (`hero-sala.js`, `redHero`)

The old WebSocket server is gone. `js/net/net.js` keeps the same interface
and message names, and the postman plays the server:

- **What everyone must agree on goes to the move log**: `cancion` (only the
  director = first seat still present), `parte {p,d,m}`, `listo {on}`,
  `empieza` (director, everyone else ready), `cargado`/`nocarga` (download
  finished/failed), `go {at}` (director, once all downloaded; `at` is server
  time, checked by the `jugadas/$n/at` rule; the song starts `HR_DEMORA` ms
  later on every screen), `fin {r, s, e, …}` per player per round. When all
  of the round's present players have `fin`, the round goes to `ultima` and
  the room is back to choosing. A room never ends by itself.
- **Every move carries `uid`** (`anota` adds it): the `jugadas/$n` rule
  wants `uid === auth.uid`. Without it every write was refused silently and
  the room never got a song or a «listo». `tests/hero.test.cjs` drives the
  real postman to check it.
- **Live state goes over the WebRTC mesh** (`malla.js` + `crearDirecto`,
  mailbox `vivo/<pid>/rtc`), ~10/s: score, combo, SP and the **last 40 note
  events** (`EV_DIRECTO`) — the channel drops packets, so events are
  repeated and `RemoteState.apply` (`js/game/remoto.js`) ignores ones
  already applied. **A note's state may only move forward** (pending → hit
  → dropped, or → missed): a released sustain travels as `[i, HIT]` then
  `[i, DROPPED]`, and re-applying the HIT on every packet drew flames and
  fret pops ten times a second on a lane with no notes.
- **The race chart** («La carrera», results screen after a room song): each
  player's frame samples their own score at `CURVA_N` (60) equal steps of
  `song.endTime` (`session._anotaCurva`, only with `net`), sends it with
  `done`, and the postman writes it in the `fin` move as `cv`, base-36
  numbers joined by `.` (`codificaCurvaHero`; a string, not an array, so
  RTDB can't turn it into an object). `redHero` reads it with
  `leeCurvaHero` and drops anything malformed (the result still counts).
  `results.js` (`carreraEl`) draws one line per player in their highway
  colour, a strip of who was first in each stretch (`lideres` in
  `js/game/carrera.js`), names at the line ends only with ≤ 4 players, and
  a crosshair tooltip. `CURVA_N` and `HR_CURVA` must agree (test).
- The page's chat and «Abandonar» are used; the frame hides its own chat
  and leave button (`sitio.sala`). Spectators see the lobby read-only.
- **Move fields must not collide with the rule's own keys**: `jugadas/$n`
  validates `h` and `sal` as strings and `at` as server time. The hits of
  a `fin` travel as `ac` (as `h` the whole result was refused, so nobody
  saw the others' stats and the round never closed). The postman test
  checks every move against the rule's keys.
- **Fullscreen**: the frame asks for it (`pantallaCompleta` in
  `puente.js`) on «Estoy listo» / «Empezar canción», the gestures the
  browser requires. Your highway goes in the middle (`enElCentro` in
  `js/game/orden.js`: 3 → centre). With 4+ it is **big in the middle and
  the rest in two narrow side columns** (`vistas` in `orden.js`, used by
  `session._views`): 4 → 2·1·1, 5 → 2·1·2, 6 → 3·1·2, 7 → 3·1·3, 8 → 4·1·3.
  Side tiles are all the same size, on whole device pixels (so they share
  the painted neck), and each view is clipped. The neck caches
  (`_neckLines`, the shared neck canvas) are per geometry: with a single
  cache, two sizes per frame repainted everything.
- **Everyone starts on the director's clock.** `.info/serverTimeOffset`
  doesn't subtract the handshake's latency, so each browser's `fb.ahora`
  was off by its own hundreds of ms and the song started at different
  moments. Each player asks the director over the mesh every second
  (`tic`/`tac`, NTP-style, `crearReloj` in `hero-sala.js`; minimum-RTT of the
  last 12) and sends the frame `reloj` with the director's time; with no
  direct channel to the director, Firebase's. `alDatos` catches `tic`/`tac`
  before `directo.recibe`, like `mira`.
- **Other players' highways are drawn late on purpose** (`RemoteState.retraso`
  in `remoto.js`). Their hits arrive 100–300 ms after the note (mesh + the
  100 ms `STATE_INTERVAL`): drawn on your clock, each note crossed the bar and
  lit up afterwards, which read as playing off-beat. Each new hit measures
  how late it arrived; the target follows the upper envelope (up fast, down
  slow, ignoring samples > 0.8 s) and the drawn delay moves toward it at ≤
  15 %. `laneHitTime` is stamped on that delayed clock. The neck uses your
  clock (`opts.neckNow`) so it stays shared; wood grain has no beat.
- **What the host is browsing** (the song marked in their selector, `onBrowse`
  in `songSelect.js` → `browse`) goes over the mesh as a `mira` packet,
  never to the move log (browsing is dozens of changes), and is repeated
  every `OK_MS` for late joiners. `alDatos` must catch `mira` **before**
  `directo.recibe`, which would take it for the host's live state. Only the
  director's is believed; it is cleared when the round starts or the
  director changes. The lobby shows that card («El anfitrión está
  mirando…») and plays its preview, else the chosen song's
  (`tocaVistaPrevia`, shared with the selector). Test in `hero.test.cjs`.
- The lobby has **«Controles» / «Ajustes»** buttons: `SettingsScreen.back()`
  → `goMenu()` → in a room, `openOnline()` → back to the lobby.
- Room option: only `cupo`.

## Performance (`render/highway.js`, `game/session.js`)

Measured without GPU (headless Chromium, flushing the canvas each frame):
the neck was ~40 % of every frame, and the first Star Power bolt stalled.

- **The neck** is one `drawImage` per screen line. Its per-line geometry is
  cached (`_neckLines`), consecutive lines sampling the same texture row are
  one draw, and lines are 1 px tall at integer scales (1.5 only at
  fractional ones, where 1 px leaves seams). With several highways
  (`opts.compartido`) it is painted once into a side canvas and copied to
  each, landing on whole device pixels with the subpixel offset baked in;
  the canvas must be as wide as the **last** line (below the strike bar the
  neck keeps widening — sized by `2·hw` it was clipped). Shake/wobble → drawn
  directly.
- **`precalienta`** runs at the end of `session.load`: it creates every
  sprite the track can ask for, uploads each, and draws two fake frames
  with every effect (bolt, SP on/off, flames, sparks, popups) using a copy
  of the engine (`Object.create`), then clears. A new effect in the renderer
  should get an event there too, or it will hitch the first time it shows.
- **Alto rendimiento** (`settings.altoRendimiento`, in Ajustes › Juego and in
  the room): canvas at `ESCALA_ALTO` (0.75) CSS px with no HiDPI, every
  other neck line without smoothing, no `shadowBlur`, ⅓ of the sparks, one
  flame tongue, no ribbon halo / wide rail glow, simpler bolt and inlays;
  the menu background at 0.75 too. Normal mode must look the same: compare
  screenshots before/after when touching the renderer.

## Versioning

`index.html` has an **import map giving every module `?v=hero-N`**, plus the
same `?v=` on `js/main.js` and `css/style.css`, and both postmen open
`index.html?…v=hero-N`. When a module changes, bump N everywhere (a new
module also needs its line). `tests/hero.test.cjs` fails if the map misses a
file or the versions disagree.

## Controls

Keyboard, guitars and gamepads are read by the game itself (`js/input/`,
Gamepad API). `mando.js` is loaded only so the page's cursor steps aside;
`Mando.configura` claims Select (Star Power on many guitars). `@controles:
tactil teclado` in `main.js` (touch = the phone mode below).
Volume: the pause menu has four sliders, plus the site's 🔊 in the corner
(`[data-volumen]`, `volumen.js`).

## Modo celular (`js/sitio/celular.js`, `js/ui/tactil.js`)

- **Detected by the screen, not the iframe**: `pointer:coarse` and the short
  side of `screen` ≤ 600 px; `?celular=1`/`=0` forces it (Playwright's
  `devices['Pixel 7 landscape']` triggers it by itself). Adds `html.celular`.
- **Landscape only**: in portrait `.gira` covers everything, and turning the
  phone mid-song pauses it (not in a room). Club mode asks fullscreen +
  `screen.orientation.lock` on every `pointerup` (not `pointerdown`: the
  resize moved the click onto another button); a room only does it in
  `pantallaCompleta`, so the page's chat stays visible in the lobby.
- **Starts in alto rendimiento and «todo taps»** (set in memory at startup;
  no strum with five buttons). `_makePlayer` forces `taps` for local players,
  so the proof header agrees. Drums are hidden (they need a kick).
- **Five buttons = five equal columns** of the screen. The renderer
  (`opts.celular`) raises the strike bar to 70 % and widens the highway
  (`anchoCelular`) so each lane is exactly one fifth wide at the buttons'
  centre (90 %): changing one side means changing the other. Gems are
  flattened (`tilt` × 0.62), the HUD moves to the top-left (`_hudCelular`),
  ★ (Star Power) and ❚❚ (pause) are DOM buttons on the right, and only your
  own highway is drawn (in a room the others' `fxQueue` is emptied).
- **Touch never calls the engine**: `Tactil` emits `{device: 'touch', code:
  't0'…'t4' | 'tsp' | 'tpausa'}` and the human player gets the `TACTIL`
  profile, so everything goes through the `Grabadora` like a gamepad.
  Multi-touch chords and sliding a finger across colours work (a count of
  fingers per lane).
- **Nothing is saved from a phone** (the owner's call: unfair to PC players):
  `mandaResultado` returns early, so no `resultado` → no stars, no ranking,
  no coins. The results screen and the room lobby say so.
- Outside Juegos, i18n.js's floating language selector sat on the green
  button: hidden while playing (`html.celular.tocando`).
