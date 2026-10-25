# PRO DEFENDER — notes for Claude

Solo Club game of Juegos: a tower defense with 5 kingdoms × 100 rounds (plus
5 more that opened one per day, Oct 22–26 2026: «Second era», and 5 harder ones,
Oct 27–31: «Third era» below), 27 towers, 10 heroes and 70+
enemies, written by the owner as plain scripts (no build) and integrated here. Shared club rules (proof, castigo, modo celular) are in
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
kill), `PD.hpBoost` (extra life applied at `spawn`: x1 up to round 3, x2 from
round 25, bosses x1.5 — it must stay out of `hpMult`, or `buildRounds` just
spawns half as many enemies), `PD.BOSS_SCALE`/`PD.BOSS_GROW`, each kingdom's
`pool`, and `PD.ABILITIES[].cd`. Changing any of them changes replays: see
Versioning. The Huerto was cut 40 % (owner: people filled the map with farms)
— do not raise it back without asking.

Round composition (`buildRounds`): from round 20 each group prefers the enemy
type that comes out in tens (`ideal`: 30, then 24, then shrinking from round 55
to 5 at round 100), like Bloons' zeppelins. The old fit let late rounds send
hundreds of 9-HP Sombras clamped to `maxN`, which also threw away most of the
round's budget. A group that still overflows `maxN` comes out **reinforced**
(`hpX`, up to x6, applied in `startRound`/`update`) instead of losing the budget. A group never
takes a type of which not even one fits its share (it switches to the heaviest
one that fits), and a kingdom's newcomer only opens its debut round if it fits:
before, `n = max(1, …)` sent the first Fortaleza at several times its budget.

**Late rounds climb the ladder of big enemies** (owner's request: not many of
the same small ones). `hpMult` is unchanged up to round 50 and then grows
0.015/round instead of 0.068 (x30 at round 100, was x356), so the budget buys
*bigger* enemies instead of inflating small ones; big types get a weight bonus
from round 45 (`grande`). The ladder (`enemies.js`, every kingdom's `pool`):
tanks Portador → Titán → **Fortaleza → Ciudadela → Leviatán** and flying balloons
**Zepelín → Dirigible → Acorazado Celeste → Arca**, each splitting into one of
the step below and one (or two) of two steps below (`children`), so each step
is worth ~2.5× the previous one and the top ones fit in a round's budget (with
two of the step below each, the threat doubled every step and they never
fit); from round 70 there are at most 5 groups, so each group's share is big
enough for them; shapes `supertank` and `blimp` in
`render.js`, scaled by `d.rank`. From round 55 the specials Estampida and Noche
de Sombras also admit big types, which come with the group's `mod` (`fast`
x1.35 speed / `camo`), inherited by their children (`Game.modifica`). Each
step has its own colour (`d.color`/`d.accent`: tanks blue → red → black/green,
balloons light blue → red → green → purple) and more spikes and skulls with
`rank`, so they read at a glance. Since big armoured types cost more than
`enemyThreat` says, `PD.lateEase` trims the budget from round 52 (half at 82),
and a non-boss leak takes at most 60 % of the kingdom's lives (`leak`): one
lost Titán used to be 90 lives, i.e. the end of the game.

## Heroes (`towers.js`, after the 22 towers)

One per kingdom (`PD.heroOf(li)`), only in its own kingdom (`towersFor`) and
**one per game** (`canPlace` → `hasHero`). `kind: 'hero'`, `hero: true`; the
attack is `s.atk` (`tHero` reuses `tProjectile`/`tRail`/`tSniper` and adds
`tSun`/`tSlam`), each has an aura (`lifeRegen` at `endRound`, `shredAura` and
`ampAura` in `updateEnemies`, `slowAura`, or the Caldera's tower buff through
the totem code with radius `s.aura`) and an automatic ability from tier 0
(`selva`, `tormenta`, `invierno`, `erupcion`, `grieta` in `useAbility`; `s.abCd`
overrides `PD.ABILITIES[].cd`). Heroes may take **both** paths to 4 and
**one** of them to a 5th tier of 60000 (`canUpgrade` reads `ups.length`; the
UI draws `P.ups.length` pips, the 5th pink). Their tiers 1–4 cost 50 % more
than the owner's originals (with both paths at 4 they were the best value on
the map). They are appended at the end of `TOWER_ORDER` because proofs
store towers by index there — never insert a tower before them. In `main.js` the
hero sits above the shop on its own row (key H) and `shopTowers` keeps the
number hotkeys for the towers only.

## Second era: kingdoms 6–10, one opens each day (owner's request, Oct 2026)

Pantano Sombrío, Cumbres Tormentosas, Fosa Abisal, Ciudadela de Engranajes and
Trono del Eclipse (`levels.js`, after Vacío). Each has `abre: 'YYYY-MM-DD'`, the
Chile day it opens to everyone (Oct 22, 23, 24, 25, 26 of 2026);
`PD.abierto(li)` compares it with `PD.diaChile()` (the browser clock in
America/Santiago). `main.js` re-checks every minute and rebuilds the levels
screen at midnight. The kingdom of the day gets a «¡NUEVO HOY!» pill.

- **Before its day** (`enPrueba(li)` = `!PD.abierto(li)`) only Juegos admins play
  it; everyone else sees «PRÓXIMAMENTE · Se abre mañana / el N de mes» and no
  buttons (`puedeJugar`). Admin comes from the page (`esAdmin` in `crearSolo` →
  `{tipo:'admin'}` → `Club.esAdmin()` / `club-admin`); opening the game alone on
  localhost counts as admin, for previews. Such a game saves no record and pays
  nothing (`reporta`/`escuchaTabla` skip it, `save.best/won` are not written).
- **From its day** it is a normal kingdom: table `club-prodefender-<short in
  lowercase>` (`pantano|cumbres|fosa|engranajes|eclipse`, in `REINOS` of
  prueba.js, the verifier, `club-datos.js`, both rules regexes, `ranks.js`,
  `discord.js`), and **100 coins per round** like Vacío (`monedasProdefender`
  caps the multiplier at 5; `monedasRonda` in main.js the same) — 10 000 each at
  round 100. It does **not** need round 50 of the previous kingdom (`segunda(li)`
  skips `save.unlocked`, which still stops at Vacío). The date is a UI gate only:
  the verifier and the rules do not look at it, so a moved clock plays early but
  still has to play the rounds.
- **Fewer towers**: each sells only `L.torres` (a shrinking subset of the 22,
  plus its own new tower) and its hero (`towersFor`). `musica` picks one of the
  five audio themes.
- Maps are shorter, with several entrances, crossings and portals.
- **Animated scenery** (`render.js`, render-only): `escenaDe` places each
  map's props once with the map's fixed rng, `escenaUnder` animates them under
  enemies and towers (also once, frozen, in the level thumbnails) and
  `escenaOver` adds weather. Engranajes and Eclipse have their own `deco`
  rules (not an `ESTILO` borrowed from a first-era map): conveyor belt with
  moving chevrons, gears turning in the pits, pistons, Tesla coils, reactor;
  and golden energy flowing down the path, the eclipse on the biggest altar,
  rune rings, floating crystals. Obstacle `kind` is art only (`reactor`,
  `shard`): the engine only reads x, y, r. Per-frame work is batched in
  `Path2D`s: keep a frame of 9–10 near Vacío's cost.

New content, all appended (TOWER_ORDER indices matter: never insert before them):
towers `bruja` (frog: `sapifica`, a sapo has no armor/camo/powers and walks at
half speed), `pararrayos` (rod: `protegida` — nothing disables, freezes, blinds
or grabs a tower in its range — plus chain lightning), `burbujas` (bubble:
`atrapa`/`revienta`), `desintegrador` (disint: % of max HP per second, big ×0.4,
boss ×0.08) and `campanario` (bell: repeats `e.eco`, the damage taken lately);
heroes Morgana, Zéfiro, Nerea, Ada and Solenne (abilities `cienaga`,
`tempestad`, `maremoto`, `sobrecarga`, `amanecer`). Enemy mechanics are listed
in a comment at the top of the second-era block in `enemies.js`; per-enemy
logic is `Game.segundaEra`, plus `parte` (Eclipse splits into two bosses at
half HP), `suelta` (Kraken's grabs) and the hooks in `damage`.

**Determinism of kingdoms 1–5**: every new rule runs only when its new field is
present (new enemies, new towers), and new `rnd()` calls only happen for new
enemies. So old proofs replay identically and the proof `VERSION` stayed at 4
(only the `?v=pd-N` cache tag moved): checked by playing the same scripted game
on the old and new engine (identical round by round) and by the bot. If you
change anything that kingdoms 1–5 use, bump `VERSION` as usual.

Balance with `prodefender-bot.cjs --reino nuevos` (see below): `mixta` plays
them blind, `adapta` knows the counters. Tuned with `--ayuda 100` against the
same bot in Vacío (which it finishes losing ~13600 lives and three bosses):
`diff` 1.7 / 1.9 / 2.2 / 2.45 / 2.25 leaves Pantano–Engranajes at 3–6k lives
and 0–1 escaped bosses and Eclipse above Vacío; `adapta` beats `mixta` clearly
in Fosa and Eclipse. Without `--ayuda` the bot dies around round 15 in every
kingdom, Vacío included (its opening), so that number says nothing.

## Third era: kingdoms 11–15, «La Era del Caos» (owner's request, Oct 2026)

Necrópolis Olvidada, Jardín de Esporas, Laberinto de Espejos, Archipiélago Celeste
and La Noche Eterna (`levels.js`, `era: 3`, `abre` Oct 27–31; tables `necropolis`,
`esporas`, `espejos`, `archipielago`, `noche` = `L.slug`; 100 coins a round like
the second era). Harder (`diff` 4.2 / 4.4 / 3.4 / 3.9 / 4.1) and with their own rules, all gated on
`game.era3` or on new enemy fields, so **kingdoms 1–10 replay identically**
(checked: the same scripted game hashed over 280 rounds on the old and new
engine; `VERSION` stays 4, only `?v=pd-8` moved). The `diff` values were
calibrated with `prodefender-bot --reino tercera --ayuda 100` against Eclipse
(~67k lives lost by the bot): all land near it or above. `diff` barely moved
Esporas until dragon and desintegrador left its tower list (the bot's late game
there was only them). What they add:

- **Pacts** (`PD.PACTOS` in engine.js): at round 0 and after every 10th round
  three are offered (`ofertasPacto`: shuffled from `L.seed` + round, minus those
  already taken), the player takes one or declines (`elegirPacto(i)`, i = 3
  declines). `startRound` refuses while `pactoPendiente()`, so main.js opens the
  modal first (`abrePacto`). Each pact has `m` (multipliers), `set`, and instant
  `oro`/`vidas`/`vidasF`; `aplicaMods` folds them into `this.mods` (all 1/0
  without pacts) and `aplicaPactos` applies them to tower stats at the end of
  `recalcAll` (damage keys in `DANIOS`). Pacts and energy are in the snapshot.
  Proof op **7** `[k, 7, i]`.
- **Events** (`PD.EVENTOS` in levels.js): `buildRounds` puts one on rounds 8, 13,
  … 98 from `L.eventos` with its own rng (never two equal in a row; Frenesí
  tightens the groups right there). `startRound` sets `this.evento`; the engine
  applies it in `tickTercera` (timers), `alAparecer` (golden enemies, fake
  copies), `oroDe`, `velTercera`, `updateTowers` (fog, wind, spores) and
  `alCaer` (Noche de los Muertos). The preview and a canvas banner announce it.
- **Kingdom Power** (`PD.PODERES`, `L.poder`): `energia` fills on kills (`alCaer`:
  1, minors 0.4, big 4, bosses 25, × pact) up to `ENERGIA_MAX`; `lanzarPoder(x, y)`
  only during a round. Floración and Hoguera leave `zonas` (cleared at
  `endRound`). Proof op **8** `[k, 8, x, y]`; main.js: button `#poder`, key V,
  `ui.placing = '@poder'`.
- **Hero of your choice**: `heroes: 'todos'` makes `towersFor` include all ten
  heroes; still one per game. `PD.heroesOf(li)`; the shop shows one «A elección»
  item that opens `eligeHeroe`.
- **New mechanics** (comment at the top of the third-era block in enemies.js,
  logic in `terceraEra` + hooks in `damage`/`kill`/`pick`/`canSee`/projectiles):
  bones that rise unless finished by fire/explosive/arcane (`huesosT`, towers that
  can't finish them don't target them), Nigromante raising `caidos`, intangible
  souls, the Lich's phylacteries (invulnerable and slow while any lives; never in
  hurry mode), spores and infection (`t.esporaT`, ×0.5 attack rate), roots, pollen,
  mirror split, `maxHit`, the Mirror Queen swapping with her illusions,
  `frontShield` (uses the tower's position vs `e.a`), the Typhoon's `gust`
  (`vendavalT`), bats draining gold, the Scarecrow's `taunt` (`provoca`) and the
  Horseman's pumpkins (shells with `calabaza`) and `charge`.
- Every timer that could stall a round is off in hurry mode, like the others.
- Art: 22 new `ART` shapes; maps `necro`, `fungi`, `mirror`, `sky`, `night`
  (`TERCERA` in render.js: `sueloTercera`, `caminoTercera`, `bordeTercera`,
  `itemTercera`, `escenaTercera`, `escenaOverTercera`) and event overlays
  (`eventoEncima`, `drawZonas`).
- Bot: `--reino tercera` picks pacts from `PACTOS_PREF` (`--pacto rechaza`),
  casts the power on the strongest enemy and calls `--heroe` (Nyx by default).

## Knockback and crowd control

Every push back along the path goes through `Game.retrocede(e, px, src)`:
Ancla, bumerán/balista/géiser pushes (`push(e, amt, src)`) and Ra'kesh's
Tormenta. Each **tower** has its own cap per enemy, `KB_TORRE` (260 px, big
180, boss 140; the Tormenta ×1.5), kept in `e.kb[towerId]`, and its push
yields `KB_SUAVE / (KB_SUAVE + what the other towers pushed)` (520/360/280),
never zero; `e.pulled` is the total. **Children inherit `pulled` and `kb`.**
History: no cap at all let buffed knockback towers keep rounds from ending;
then one lifetime cap per enemy (`KB_MAX`) made the back towers spend it and
the enemy walked through the front ones immune (owner disliked it). One tower
alone pushes as with the old cap; `prodefender-bot.cjs --estrategia control
--ayuda 100` lost slightly fewer lives in Dunas/Glaciar/Caldera and the same
elsewhere. Nyx's Grieta rewinds each enemy **once**
(`e.rifted`, also inherited). A freeze leaves 1 s of `freezeImm` after it ends
(`FREEZE_IMM`; re-freezes only slow), the same idea as `stunImm`. Do not add a
new push that writes `e.dist` directly.

## Pinchos (spikes, like Bloons' road spikes)

`PD.PINCHOS` in `engine.js`: a pile bought from the shop (row under the hero,
key K, `'@pinchos'` in `ui.placing`) and dropped **on the path**
(`spikeSpot`: nearest point of a non-jump segment within `PATH_HALF`, not on
another pile, at most `max` 10). Each ground enemy that walks over it takes one
hit (once per pile, `hit` ids reset at `endRound`) and spends `gasto` spikes
(big 3, boss 4) for `multi` × the damage (phys, ap 0.5); 12 spikes; it lasts
until spent, across rounds (`snapshot.spikes`). Cost and damage follow the
round (`costo`, `danio` = 5 × the round's enemy HP scale). Player action →
op code 6 in `prueba.js` (`Grabadora.pinchos`).

## Balance tools (`colabtex/scripts/`)

- `prodefender-bot.cjs`: a bot that plays well (shooting range per tower and
  tier on the real engine, spends by damage per gold, expert build order) and
  prints the round reached, lives lost per decade and how far enemies get.
  `--reino nuevos` plays kingdoms 6–10; `--estrategia adapta` adds the
  second-era counters (no electricity against Storm Elementals, lightning rods
  over its priciest towers, fire for the Hydra, varied damage types against
  Automata, and the witch/bubble/bell towers).
  `--motor DIR` runs another engine copy (e.g. `git archive` of an older
  commit) to compare; `--ayuda N` gives unlimited lives up to round N (its
  opening is weaker than a person's). Several minutes per 100-round game.
- `prodefender-analiza.cjs`: replays a proof from `soloPruebas` (console
  export) and prints it round by round: lives, gold, leaks by type, max
  advance, what was built. A proof only replays with the engine of its `ve`.

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

- Route `#solo/prodefender`, card `prodefender` in `salon-datos.js`. Guests play it
  (`EN_LA_NUBE` is false: no tables, no coins, nothing saved; not a guest destacado). The iframe is **always full window**
  (`PLENO` in `solo/club.js` → `html.jg-club-pleno` in `juegos.html`), like PRO
  HERO; the game's own «← Volver a Juegos» / «← Juegos» buttons click the
  hidden `.club-volver` link that `conexion.js` adds.
- Fifteen tables `club-prodefender-<reino>`, `puntos` = best round, `tiempo` = ms
  of game time. `main.js` reads the tables of the open kingdoms once on open (`recorreTablas`,
  via `Club.category` + `club-tabla`) to adopt cloud records and unlock
  kingdoms (round 50 opens the next one), and sends `Club.result` with
  `rec.prueba()` only when a round **beats** the cloud record. The levels screen
  shows each kingdom's table in its `<aside>` (where `conexion.js` puts the
  panel) and the coins won so far.
- **Coins** (owner's spec): each new round of a kingdom's record pays 20 × the
  kingdom number, once: 2000/4000/6000/8000/10000 for reaching round 100 of
  kingdom 1–5, 10000 each for kingdoms 6–15 (100 a round), and beating 60 with 70 pays only the ten new rounds
  (`monedasProdefender` in `monedas.js`, from the row like every club record).
  **No per-game pay**: `prodefender` is not in `PAGO_CLUB`/`JUEGOS_CLUB`, and
  `alResultadoClub` in `juegos-main.js` skips `marcaJugadaClub` for it and
  announces the new coins instead. Logros (`SOLO.prodefender`, low `NIVEL`
  digits) and podiums pay as in every club game.
- Local save is per account: `Club.storageKey('prodefender.save.v1')`. There is no «Borrar progreso» button (the owner removed it).
- Volume: `volumen.js` draws into the `[data-volumen]` slots (menu and HUD;
  hidden in the HUD under 600 px), and the game keeps its own 🔊 (M) and the
  music/effects sliders in the pause menu.
- **Sound effects have a concurrency cap** (`A.play` in `audio.js`: `ATK_MAX`
  tower attacks, `VOCES_MAX`/`VOCES_DURO` in total, counted on `ctx.currentTime`)
  and a limiter after the compressor; the context uses `latencyHint:
  'playback'`. Without them a big map crackled and then went silent (the
  audio thread could not keep up). `audio.js`, `main.js` and the CSS carry
  `?v=pd-7a`: they are not in the proof, so they move without `VERSION`.
- **Cursor**: on the map it is a big yellow crosshair with a black outline
  (`#cv.cur-grande`, an inline SVG); the pause menu's «Cursor» select switches
  back to the system crosshair (`save.settings.cursor = 'clasico'`).
