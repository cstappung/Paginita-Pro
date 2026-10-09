# Órbita — notes for Claude

Screen: `colabtex/src/juegos/orbita.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Órbita (`orbita`) is a physics game whose physics runs in the reducer.**
A move is only `{t:"lanza", uid, vx, vy}`, velocities in integer hundredths
(`orVelocidad` refuses anything else and clamps to `OR_VMAX`). `redOrbita`
simulates the whole turn with `orTurno` — semi-implicit Euler, softened
gravity from the sun and two or three planets (`orMundo`, from the room's
seed), `OR_PASOS` steps — and every probe already in the field moves in
*every* turn, capturing stars for its owner until its `vida` (two laps of
the table) runs out. Every browser gets the same doubles because the
arithmetic is the same sequence of IEEE operations; nothing is `Math.random`
and nothing depends on frame rate. Things that are easy to break:

- **The screen replays, it never decides.** `orbita.js` reruns `orTurno`
  from `ultima.antes` a few steps per frame and fires the effects from the
  same `eventos` the reducer scored, so what is animated is what was
  counted. `ocupado()`/`ctx.listo()`/`pendiente` work as in Chain Reaction.
- **Only the first `PREVIA` steps of the aim are shown.** The whole path
  would turn it into billiards with the cue marked. Satellites already in
  orbit show their full next-turn path dotted (`calculaFuturos`), because
  that is what makes aiming at one to shoot it down a real play.
- **A collision needs a new probe to score.** New probe against someone
  else's satellite: both burst and the launcher gets `OR_DERRIBO`. Two old
  satellites that meet burst with no points.
- **The sky refills from its own stream** (`orRellena`, `rng(semilla ^
  0x5A7E11)`), so both browsers draw the same new stars in the same order;
  a star's value comes from how close it is to a body (1–3) plus a rare
  nova worth 5.
- The reducer is memoised (`orCache`, keyed by the log) because a whole
  replay is ~400 steps × every move, and a repaint happens on every tick.
