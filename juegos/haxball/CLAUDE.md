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
- **Teams come from the lobby** (`vestibuloHaxball`): `{t:"equipo", a, e}`
  (self, or anyone if you are the leader), `{t:"nomeq"}`, `{t:"ajuste", k, v}`
  (meta/tiempo/mapa/sprint: room fields can't be rewritten after creation,
  so settings live in the log), `{t:"lider", a}`, `{t:"empieza"}` (one per
  side) and `{t:"vestibulo"}` (leader cuts the match: score resets, lobby
  reopens, `estado` back to esperando), all replayed from the log; no team or
  setting changes mid-match. Leader starts as `anfitrion`; on abandon it
  passes to the first present seat. Each `empieza` bumps `ronda`, and the
  iframe drops ball state (`w.pt`) from another round, so a stale director
  can't leak a goal into the next match. Players without a team are spectators: no disc, no
  goals, `anotar` skips them. The lobby is DOM in `haxball.js` (not the
  iframe); config waits for `fase !== "equipos"`. Rojo defends the left half. A win is `ganador: "eq:rojo"`, so `ganoEn`
  credits the whole team, as in Yemas.
- **Physics is in ticks of 1/60 s and pitch pixels** (`C` in `motor.js`):
  players are not walled at the line (they can step out to `LIM_X/LIM_Y`),
  the ball bounces off the lines except at the goal mouths, and posts are
  fixed discs. At kick-off only the team with the `saque` may enter the
  centre circle, and everyone stays in their own half until the ball is
  touched.
- **Practice goals need `soyDir || !ONLINE`**: `soyDir` is only set by
  `eligeDirector` online, so gating goal detection on it alone made every
  practice goal pass unnoticed (the ball just sat in the net).
- **Pitches** (`CANCHAS` in `motor.js`: `clasica`, `futsal`): `usaCancha`
  rewrites `C` and `POSTES` in place, so call it before `M.crea()`. Online the
  pitch rides in the room's `mapa` (already allowed by the rules' `$otro`,
  copied by revancha), `canchaHaxball` reads it and `config` hands it to the
  iframe. Player friction is `AMORT_J` 0.93 with `ACC` raised to keep top
  speed ~2.4; a test pins both.
- **Each player moves their own disc**; the director simulates the ball
  against everyone's last published disc and publishes it in its state.
- **Local two-player practice** (`practica.modo` `versus`/`juntos` in
  `juego.js`): the second disc is `YO2` and reads only `TECLAS.j2`; with
  `YO2` unset (solo, online) J1 reads J1 ∪ J2. Keys are remappable (⌨,
  `haxball.teclas` in localStorage) and a remap reconfigures `Mando` so the
  controller follows J1. `P` pauses only while no action uses it.
- **Sprint** lives in `motor.js` (`sprint`, `SPRINT`/`SP_*` in `C`): input
  `s` plus a direction, energy `j.en` 0–1, `j.espera` ticks of penalty after
  emptying it, and `j.bloq` forces releasing the key. Online each player
  publishes `en`/`es` only for the bar; remote discs never run `sprint`.
- **Camera**: scale always comes from the classic pitch so discs keep their
  size; `grande` is bigger than the screen and `camara()` follows your disc
  (ball when spectating or two-on-a-keyboard) with a dead zone, clamped at
  the edges.
- **Touch**: joystick on the left 60 % of the canvas, DOM buttons `#tPatea`
  (big) and `#tSprint` on the right.
- **Sprint is optional** (room `sprint` 1/0, default on, `sprintHaxball`;
  practice checkbox `#conSprint`): off means `s` is never sent and no bars.
- **Name and dorsal** (`haxball.fichas`): the dorsal is at most 2
  graphemes (`Intl.Segmenter`), painted inside the disc; online both ride in
  each player's published state (`n`, `dn`) and are re-sanitised on arrival.
  They are only ever painted on the canvas or via `textContent`.
- **Time limit** (`tiempo` 0/3/5/10 min, room option): the director counts
  `relojT` ticks while the ball is in play (not at kick-off, not
  celebrating) and publishes it as `w.t`; at the limit it writes
  `{t:"tiempo", n}`, and the reducer ends it (`reloj`) or turns on `oro`
  (next goal wins, motivo `oro`). Same trust limit as goals.
- **Changelog is mandatory**: `js/novedades.js` (Cambios / Próximamente),
  same rules as Pokelike's. Open version: v0.2.
- Room options: `meta` and `cupo` (2–8, default 2 so a 1v1 room starts as
  soon as the second player joins; a bigger room starts with the host's
  «Empezar con N»). `'haxball'` was added to the
  rules' `juego` and `logros` whitelists, so they must be re-published.
  `tests/haxball.test.cjs` covers the reducer and the physics.
