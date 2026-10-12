# PRO HERO — notes for Claude

A Clone Hero–style guitar/bass/keys/drums game, written by the owner as
plain ES modules (no build) and integrated here. Two ways in, one document:

- **The club card** (`heroclub` in `salon-datos.js`, route `#solo/hero`):
  `juegos/hero/index.html` full-window (`html.jg-hero`), with its own menu.
  Postman: `colabtex/src/juegos/hero.js` (`crearHero`).
- **The room game** `hero` (2–8, `JUEGOS.hero`): the same document with
  `?modo=online`. Postman: `colabtex/src/juegos/hero-sala.js`
  (`crearHeroSala`), reducer `redHero` in `motor.js`.

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
- `?fuente=servidor` makes the frame read `api/library` and `songs/<id>/…`
  next to it instead (the owner's local Node server). That is also how to
  test it without Firebase: drop a fake `api/library` + `songs/<id>/` in the
  folder, serve with `npm start`, and never commit them.
- `sfx/` are sound effects taken from Clone Hero. The owner was warned the
  repo is public; deleting the folder falls back to synthesized sounds.

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

## Proof and verification (`js/game/prueba.js`)

The engine (`js/core/engine.js`) is the owner's, untouched. What changed is
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
- **Live state goes over the WebRTC mesh** (`malla.js` + `crearDirecto`,
  mailbox `vivo/<pid>/rtc`), ~10/s: score, combo, SP and the **last 40 note
  events** (`EV_DIRECTO`) — the channel drops packets, so events are
  repeated and `RemoteState.apply` ignores ones already applied.
- The page's chat and «Abandonar» are used; the frame hides its own chat
  and leave button (`sitio.sala`). Spectators see the lobby read-only.
- Room option: only `cupo`.

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
teclado` in `main.js`: menus have clicks, but there is no touch play.
Volume: the pause menu has four sliders, plus the site's 🔊 in the corner
(`[data-volumen]`, `volumen.js`).
