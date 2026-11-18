# Tetris (room) and Tetris Club — notes for Claude

Room screen: `colabtex/src/juegos/tetris.js`; engine and club game in this folder. Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`. Room architecture in `colabtex/src/juegos/CLAUDE.md`.

**Tetris (`tetris`) is the one real-time game, and the log still only
carries what crosses between wells.** Every browser simulates its own well
with the room's public seed, on `juegos/club/tetris/motor.js` (UMD: the
room imports it through esbuild, and Tetris Club loads it as a plain script).
The log holds only `{t:"ataque", a, n}` (n ≤ 12 lines of garbage for `a`)
and `{t:"cae", l, p}`. `redTetris` adds up `basura[uid]`, and the screen feeds
the engine only the difference from what it already applied. The rivals'
wells are thumbnails. They come from `fb.tetrisVivo`, a 200-character summary
each tab writes every 250 ms to a disposable node, as in Circuit Breakers.
The last one standing wins. **Tetris Club** (`juegos/club/tetris/`) is
the solo version on the same engine: Maratón, Sprint (40 lines; the
result is `puntos: 40` plus the time, so the ranking orders it by time) and
Ultra (two minutes), plus **VS Bots** (below). Its categories are
`club-tetris-*` in `soloRanks`.

**Tetris' look and sound live in `juegos/club/tetris/fx.js`** (UMD
`TetrisFX`, shared by the Club and the room), and **none of it decides
anything**: the motor has already locked, cleared and raised garbage, and the
Club's proof is replayed without this file. The motor only adds data to its
events for it (`fija` carries `bloq`, `filas` and their `colores`, `seco` is
the hard drop, `basura` its `hueco`); adding fields to an event is safe,
changing state is not. It is cheap on purpose: one sprite per colour and
size, the background cached per level, no `shadowBlur`, capped particles,
and the shake written to the canvas's `transform` only when it changes.
Cleared rows flash and shatter, and the rows above **fall after the flash**
(`desp`); garbage pushes the stack up from below; a red band at the bottom of
the pit shows garbage on its way (`pendiente`); the piece slides to where it
is, so at high speed it is seen falling, with a trail. In the room an attack
also flies as a projectile in the attacker's colour from pit to pit (WAAPI
over `<body>`), and the victim gets a «⚠ X te manda N» banner, an alarm, then
a metal impact when the rows rise. The sound is **not** the site's chip: the
pit is an instrument (each column a note of A minor pentatonic, panned where
the piece is; each clear the next chord of Am–F–C–G, FM bells through an echo).
In the room it goes through `salidaFx()` from `sonido.js` (the page's effects
bus), in the Club through its own `fx` gain. Falls are dry and punchy (a kick,
a click and a square pluck), and each lock that comes within `RACHA_S` of the
previous one steps the pluck up the scale, so playing fast climbs an arpeggio;
clears are a drum hit plus a 1/32 sawtooth arpeggio on the chord.

**The room's `cae` is written from `paso()`, not only inside the `!s.fin`
branch** (`tetris.js`). Most losses come from a key (a hard drop or a spawn
that no longer fits), and keys run outside the loop: the loop then saw
`s.fin` already set, skipped the branch, and the room said «Quedan N en pie»
forever. `avisaCaida` retries until the reducer marks the player `fuera` (a
`jugar` that gives up returns false without throwing). A hidden tab gets no
`requestAnimationFrame`, so `alOcultar` drives the pit with a 1 s interval
cut into 100 ms steps: in a simultaneous game the well keeps falling, and
someone who switched tabs still loses.

**Both start after a 3-second countdown** (red 3, 2, 1 and a green «¡YA!»
in the middle of the pit, `TFX.cartelCuenta`; race-start beeps and a
revving engine, `sonido.cuenta`). In the Club it is the `'cuenta'` state of
`game.js`: the well already shows its piece, but no step runs and no key,
wall clock or key log (`pulsos`) is recorded until «¡YA!», so the proof is
exactly what it was without the countdown. Blur or pause during the count
pauses, and «Seguir» restarts the count. In the room each browser counts
its own well (`largadaHasta` in `tetris.js`; nothing crosses the network):
`paso` returns early, so the well neither falls nor takes garbage nor writes
`tetrisVivo` until then, and the mando/touch handlers ignore input.

**Targets (room and VS Bots).** Every well attacks exactly one rival, and
the screen says who: your target gets a gold reticle and an «🎯 Objetivo»
tag; under each rival card is who *it* attacks («→ TÚ» in red when it is
you, `.teapunta`); your pit glows red per rival aiming at you
(`data-apuntan`); a bar above the pit sums it up (hidden in immersive phone
mode, where the cards and the glow carry it). You change target by tapping a
rival or with the `objetivo` action (`E`/`Tab`, gamepad RB; it is in
`TM.ACCIONES`, so the key panel offers it). In the **room** the reducer
already accepted any living `a` in `{t:"ataque"}`, so nothing changed in the
log or the rules: the default target is still `blancoTetris` (next living
seat), and the current one travels as `o` in the disposable `tetrisVivo`
summary so the others can draw it; a tab that does not send `o` (old code)
is assumed to aim at its next living seat, which is what it does. Projectiles
are `TFX.misil` (fx.js), shared by both.

**VS Bots** (`juegos/club/tetris/vs.js`, UMD `TetrisVS`, mode `bots` in
`game.js`) is the room played alone: your well plus three bot wells, free
for all, garbage (≤ 12 per attack, as in the room) goes to the sender's
target, last one standing wins. Three difficulties, one table each:
`club-tetris-bots-(facil|medio|dificil)`, `puntos` fixed at 3 and the
**time** competes (lower is better, like Sprint; losing saves nothing).
Rules that keep it provable:

- **The whole match is deterministic, so the proof is still only the
  player's moves** (`{v:3, m:"bots", d, u, a, n, e, w, k}`; target changes
  are letters `O`/`P`/`Q`/`R` in `e`). The four wells step together in
  `TM.PASO` steps; bots decide with their own seeded `rng` and integer
  weights; their target choices come from a seeded `rng` too. `TV.rehace`
  replays the bots and the verifier demands all three out. Anything that
  changes how a bot decides (weights, `BONO_ARMA`, timings, `PERFIL`,
  targeting, `PERSONAS`, the mood maths, `semillaPozo`) changes old proofs'
  outcome: **add a v4 and freeze v3**, exactly as v1 and v2 are kept (the
  `======== Versión 1/2` blocks, `mundoV1`/`mundoV2` and their `…V1`/`…V2`
  functions; `TV.VERSIONES` lists what `rehace` accepts;
  `tests/fixtures/tetris-vs-v1.json` and `-v2.json` hold real games that
  must keep verifying). v3 reuses v2's pure well helpers (`cabeOc`,
  `coloca`, `colocaciones`, `valoraV2`…): those are frozen too.
- **The level rises only with time** (`soloTiempo` in `crear`, 30 s per
  level as in the room). With line-based levels too, the fast bots sped up
  their own gravity and killed themselves; it also bounds the match.
- **v2 bots attack.** v1 only cleared singles (sent ~5–8 lines/min on
  Medio/Difícil) and never failed. v2 has two modes with hysteresis: below
  `umbral` it keeps an edge column empty and builds for a Tetris (singles
  and doubles cost, `BONO_ARMA`); above it, or with much garbage pending,
  it survives (clears anything: every clear delays the garbage). What made
  v1's Tetris attempt bury itself was not having that way out. Medio and
  Difícil also look at the next piece for their best `mira` moves. Measured
  solo: Medio ~19 and Difícil ~39 attack lines/min; in a 4-bot battle
  ~13 / ~28 per well; Fácil ~2.
- **Human-like mistakes** (per `PERFIL`, in ‰): off by one column
  (`desvio`), sometimes noticed and corrected after a pause (`corrige`);
  over-rotating and undoing (`sobregiro`); second-best picks (`duda`);
  soft-dropping instead of hard-dropping (`blando`); long pauses
  (`distrae`, only at slow gravity); a startle when hit (`susto`); with
  the stack above 13 they hurry and fail twice as much. ~0.5 / 0.9 / 1.6
  pieces per second. Each bot gets its own bag (`semillaPozo`) so the
  three do not play in lockstep.
- **v3: three different heads** (`PERSONAS`, one per bot, like the
  Pac-Man ghosts). In v2 all three used the same targeting function, so
  they reached the same conclusion and piled onto one well (usually the
  human, who plays differently). Now: **Píxel, Cazador** (goes for the
  leader/most threatening, avoids wells others already hit, calm, builds
  Tetrises); **Turbo, Carroñero** (goes for the weakest, joins a fight a
  bit, avoids the dangerous one when stressed, fast and sloppy, `metralla`:
  doubles/triples now rather than waiting for the Tetris); **Glitch,
  Rencoroso** (long memory of who hit it, returns fire, anger makes it
  faster, more erratic and impulsive). Measured (Medio/Difícil, 10 games):
  all three on the same well 0–1 % of the time (v2: 2–4 %), two or more on
  you at about the random baseline.
- **No hard-coded «if X then Y».** Each bot has a mood of three integers
  0–1000 that move by themselves once per second (`respira`) and on events:
  `estres` (towards what its stack and pending garbage say), `enojo` (up
  with each hit × `sangre`, fades), `confianza` (up with its own clears and
  KOs, back towards 500). Mood shifts everything a little at a time:
  thinking time (`prisa`), mistakes (`nervios` × `torpeza`), the build
  threshold, the Tetris/metralla blend, and the targeting weights.
  Targeting (`piensa`) sums motives per living rival (`debil`, `amenaza`,
  `lider`, `rencor`, `devuelve`, `monton`, `sigue`, each 0–1000) × the
  persona's weights (moved by mood) × the difficulty's `criterio`, plus a
  `corazonada` (noise; bigger on Fácil via `azar` and when angry). The
  highest sum wins; the motive that contributed most is `m.motivo[i]` (or
  «corazonada» if without the noise it would have picked someone else).
  It re-thinks at its own pace (`piensa` range), when hit for ≥ 2 lines
  (not within `FIRME_PASOS` of its last change, or the screen flickers) and
  when its target falls. Memory lives in the world: `rencor[i][j]` (fades
  per `memoria`) and `ritmo[j]` (recent attack, −10 %/s). The last hit
  within `KO_PASOS` (10 s) of a fall is the KO (`m.ko`, `m.verdugo`).
- The screen shows each bot's role, a mood face (`cara()` in game.js:
  😡 😰 😠 😎 😬 🙂) and the reason for its target («huele sangre»,
  «venganza», «va por el líder»…, `PORQUE`), in the card and the feed.
- The rival wells are `TM.pintaResumen` thumbnails; `ubicaRivales` moves
  them under the pit on narrow screens and back as a thin third column in
  immersive phone mode. Nothing on screen decides anything: `vsEventos`
  only drains `m.ataques`/`m.cambios`/`m.kos`/`m.caidas` for projectiles,
  banners, the feed, sounds (`fijado`, `teApuntan` in fx.js) and KO marks.
  The only thing the screen sends is your target change, as an action
  (`g.pide('apunta2')` / `'objetivo'`), so it lands in the proof.
- No logros for this mode on purpose: every game has exactly ten
  (`tests/logros.test.cjs`). Tests: `colabtex/tests/tetris-vs.test.cjs`.
- The room's waiting screen and manual point to it («¿Sin rivales?…»).
