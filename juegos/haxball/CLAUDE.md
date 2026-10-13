# HaxBall — notes for Claude

Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`. The room postman is `colabtex/src/juegos/haxball.js`.

**HaxBall (`haxball`) is real-time disc football in an iframe, Boxhead's
sibling.** An original take on the browser game: round discs, a ball, two
goals with posts, a kick button. `juegos/haxball/` is the document
(`js/motor.js`, UMD `HaxballMotor`, the pure physics; `js/juego.js` the
canvas, also playable alone as practice against bots); the postman
`crearHaxball` simulates nothing and rides the same WebRTC mesh as Yemas
(`malla.js` + `crearDirecto`, mailbox `vivo/<pid>/rtc`). Things to keep:

- **The log carries only goals**: `{t:"gol", uid, e, n, por}`, written by
  the director (the first seat still present, who owns the ball). `n` must
  be the total after the goal, so a goal reported twice by two momentary
  directors counts once. `por` is credited only when the last toucher is on
  the scoring team; an own goal has no author. First team to `meta` wins
  (`HB_METAS` 3/5/7, default 5); a team left with nobody loses by abandono.
- **Teams are by seat parity** (`equiposHaxball`: even rojo, odd azul), and
  rojo defends the left half. A win is `ganador: "eq:rojo"`, so `ganoEn`
  credits the whole team, as in Yemas.
- **Physics is in ticks of 1/60 s and pitch pixels** (`C` in `motor.js`):
  players are not walled at the line (they can step out to `LIM_X/LIM_Y`),
  the ball bounces off the lines except at the goal mouths, and posts are
  fixed discs. At kick-off only the team with the `saque` may enter the
  centre circle, and everyone stays in their own half until the ball is
  touched.
- **Each player moves their own disc**; the director simulates the ball
  against everyone's last published disc and publishes it in its state.
- Room options: `meta` and `cupo` (2–8). `'haxball'` was added to the
  rules' `juego` and `logros` whitelists, so they must be re-published.
  `tests/haxball.test.cjs` covers the reducer and the physics.
