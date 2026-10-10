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
Ultra (two minutes). Its categories are `club-tetris-*` in `soloRanks`.

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
