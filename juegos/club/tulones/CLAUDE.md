# Tulones — notes for Claude

Two games in one document. `juegos/club/tulones/` is the Solo Club game
(hot-seat, 1–8 on one keyboard, card id `tulonesclub`, no ranking) and, with
`?modo=online`, the frame of the **room game** `tulones` (2–8, one per
browser). Shared rules for the room side: `colabtex/src/juegos/CLAUDE.md`;
Club side: `juegos/club/CLAUDE.md`.

- `motor.js` (UMD `TulonesMotor`, runs in Node): the Verlet body, the world
  of capsules, freezing, aspects, keys — and `reducirSala`, the room reducer.
  Deterministic, no `Math.random` in physics.
- `juego.js`: the screen. The online part is the «en línea» block (`red`,
  `aplicaRed`, `turnoRed`, `congelaRed`…); everything else is shared.
- `colabtex/src/juegos/tulones.js` (`crearTulones`): the room postman, like
  Boxhead's. `redTulones` in `colabtex/src/juegos/motor.js` calls
  `globalThis.TulonesMotor.reducirSala`, which the postman sets on import.

## Online: what holds it together

- **Physics never travels.** Each browser simulates only the climber in it.
  The log carries `sale` (start, with the aspect), `congela` (the final pose
  as tenths, `codificaPose`), `reloj` and `plazo`. The tower is rebuilt from
  the `congela` poses on every screen, so everyone climbs the same
  quantized bodies — the climber's own frozen body is drawn from `red.foto`
  until it comes back through the log.
- **Height and elimination are recomputed by the reducer** from the pose, never
  trusted. A pose must be a body (`poseSana`: bones within 35 % of their
  length) and at most `SALA.ALTO_MAX` (3 m) above the tower. Honest limit: a
  rewritten client can still send a plausible invented pose.
- **Time is server time.** Every move carries `at` (`fb.ahora()`), and the
  rule on `jugadas/$n/at` keeps it within seconds of `now` for `tulones`
  (same rule as chess). A turn's clock starts at the previous turn's end,
  or at a `reloj` when it has none (the first turn, or after an abandono,
  which carries no `at`). The climber has `LISTO_MS` to press «¡A trepar!»
  (the frame starts by itself 1.5 s before), then `tiempo`; past that plus
  `GRACIA_MS` any player's postman writes `plazo` and the turn ends with no
  body (eliminated). A late `sale` is clamped so it cannot stretch the turn.
- **The live climber goes over the WebRTC mesh** (`malla.js` +
  `crearDirecto`, ~15 states/s, `ESTADO_MS`), never through RTDB. Receivers
  ease towards the last state (`cuadroRed`). Without a channel they just see
  the body appear when it freezes.
- **Ready before the first turn.** `{t:"listo", on}` moves are reduced even
  while the room is open (`redTulones` no longer waits for `listos`; the frame
  gets `config` on every roster change and `sala` with each log). The tower
  starts when the room is closed and every player still inside (≥2) is ready;
  the last `listo` (with `at`) starts the clock. The host's postman closes the
  room by itself (`fb.setEstado`) once everyone is ready. Opening the aspect
  editor sends `listo:false`.
- **Spawn is always on the floor** (`SITIOS` in `juego.js`: from the goat
  leftwards, then right of the ruler, every 40 units; the first gap free both
  standing and at drop height, else the one that overlaps least). The old 8
  slots filled up with frozen bodies and spawned the player on top of the tower.
- The mouse is captured on «¡A trepar!» and on the first limb key
  (`capturaRaton`); without it the pointer left the iframe mid-climb.
  `dibujaMiras` draws each held limb's target instead of the hidden cursor.
- No pause online; a hidden tab keeps its clock (server time), so returning
  late freezes at once and is rejected if past the deadline.
- End: last one standing (`ultimo`, or `abandono` if the rest left), all out
  (`nadie`), or with `rondas` the highest best height among those standing
  (`rondas`, tie → no winner). `puntos` are best heights in cm.
- Room options are `tiempo` and `rondas` (never `modo`); `rondas` was added
  to `opcionesDe` in `fb-juegos.js` so rematches keep it.
- In the frame, `html.tl-online` hides the Club's «volver» link and ranking
  panel that `conexion.js` injects.

`tests/tulones.test.cjs` covers the physics and, under «sala», the reducer
through the real `reducir` (turn order, bad poses, deadlines, rounds, votes).

Known quirk (also offline): the tower height is the top of the capsules, and
a body standing on the ground is ~2.04 m, so a low tower can be «beaten» by
just standing next to it.
