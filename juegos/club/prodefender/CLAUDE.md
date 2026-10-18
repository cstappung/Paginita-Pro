# PRO DEFENDER — notes for Claude

Solo Club game of Juegos: a tower defense with 5 kingdoms × 100 rounds, 22
towers and 30+ enemies, written by the owner as plain scripts (no build) and
integrated here. Shared club rules (proof, castigo, modo celular) are in
`juegos/club/CLAUDE.md`; logros/coins/ranking wiring in
`docs/claude/juegos/perfiles-y-economia.md`; anti-cheat details in
`docs/antitrampas/prodefender.md`.

## Files (`js/`, loaded in this order, all with `?v=pd-N`)

| File | What |
|---|---|
| `data/enemies.js`, `data/towers.js`, `data/levels.js` | bestiary, towers and upgrade paths, maps + the round generator |
| `engine.js` | the simulation, no DOM (`PD.Game`) |
| `prueba.js` | `Grabadora` (records) and `rehace` (replays) — the proof |
| `render.js` | canvas drawing (all art is code) |
| `audio.js` | synthesized sound and music (Web Audio) |
| `main.js` | screens, UI, local save, club wiring |
| `verificador.js` | Web Worker the page opens to replay proofs |

Balance knobs (from the owner's README) live in `data/levels.js`: `ANCHORS` and
`PD.growth` (enemy budget per round), `PD.lateMult` (extra hardening from round
44), `PD.hpMult`, `PD.roundBonus` (main income), `PD.incomeMult` (gold per
kill), `PD.BOSS_SCALE`/`PD.BOSS_GROW`, each kingdom's `pool`, and
`PD.ABILITIES[].cd`. Changing any of them changes replays: see Versioning.

## Determinism — do not break it

- The engine's randomness is `this.rnd()` (mulberry32 seeded per `Game`).
  **Never add `Math.random` to `engine.js`** (the only one left seeds the menu
  demo); `render.js`/`audio.js` may use it, they never touch game state. The
  renderer is read-only except for `f.sp` on `g.fx`.
- **`main.js` never calls `game.place/upgrade/sell/startRound/update` or sets
  `t.mode` directly**: everything goes through `rec` (the `Grabadora`:
  `colocar`, `mejorar`, `vender`, `modo`, `ronda`, `tick`). A direct call is not
  recorded, the replay diverges and the round is rejected (and punished).
  `PD.debug` was removed for the same reason.
- A new player action that changes engine state needs its own op code in
  `prueba.js` (`aplica`) and in the Grabadora.
- Between rounds the engine only runs `QUIETO_MAX` (3 s) after the last action
  or the end of the round; the screen keeps animating with `ui.vt`, which
  `render.js` uses instead of `g.time`.
- Saved runs are `{snap, pr}` (`rec.guardado()`): between rounds, the current
  snapshot; mid-round or after losing, the snapshot taken when the round began
  (`pr.c = 1` after a loss: resuming spends a retry). Resuming cuts the log back
  to the snapshot and appends a reload op (code 5). Runs without `pr` or with
  another `pr.ve` are dropped on load.

## Versioning

Bump **together** whenever the engine, the data or the step rules change:
`VERSION` in `prueba.js`, every `?v=pd-N` in `index.html`, the `importScripts`
in `verificador.js` and `RUTA` in `colabtex/src/juegos/solo/verifica/prodefender.js`
(then `npm run build`). `tests/prodefender.test.cjs` checks that the page and the
worker load the same `?v=`. A proof from another `ve` is rejected as «otra
versión» (cache, not cheating: no castigo).

## In Juegos

- Route `#solo/prodefender`, card `prodefender` in `salon-datos.js`. Needs an
  account (not a guest destacado). The iframe is **always full window**
  (`PLENO` in `solo/club.js` → `html.jg-club-pleno` in `juegos.html`), like PRO
  HERO; the game's own «← Volver a Juegos» / «← Juegos» buttons click the
  hidden `.club-volver` link that `conexion.js` adds.
- Five tables `club-prodefender-<reino>`, `puntos` = best round, `tiempo` = ms
  of game time. `main.js` reads the five tables once on open (`recorreTablas`,
  via `Club.category` + `club-tabla`) to adopt cloud records and unlock
  kingdoms (round 50 opens the next one), and sends `Club.result` with
  `rec.prueba()` only when a round **beats** the cloud record. The levels screen
  shows each kingdom's table in its `<aside>` (where `conexion.js` puts the
  panel) and the coins won so far.
- **Coins** (owner's spec): each new round of a kingdom's record pays 20 × the
  kingdom number, once: 2000/4000/6000/8000/10000 for reaching round 100 of
  kingdom 1–5, and beating 60 with 70 pays only the ten new rounds
  (`monedasProdefender` in `monedas.js`, from the row like every club record).
  **No per-game pay**: `prodefender` is not in `PAGO_CLUB`/`JUEGOS_CLUB`, and
  `alResultadoClub` in `juegos-main.js` skips `marcaJugadaClub` for it and
  announces the new coins instead. Logros (`SOLO.prodefender`, low `NIVEL`
  digits) and podiums pay as in every club game.
- Local save is per account: `Club.storageKey('prodefender.save.v1')`.
- Volume: `volumen.js` draws into the `[data-volumen]` slots (menu and HUD;
  hidden in the HUD under 600 px), and the game keeps its own 🔊 (M) and the
  music/effects sliders in the pause menu.
