# Reversi — notes for Claude

Screen: `colabtex/src/juegos/reversi.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

- **Reversi's discs are black and white, not each player's colour.**
  `colorForUid` hands out tones by uid and two can come out nearly identical,
  which ruins a game that consists precisely of reading at a glance who owns
  the board; each player's own colour still shows, as the ring of their
  scoreboard slot. The reducer already computes `legales` (square → the discs
  it would flip) because it needs it to know whether a turn must be passed, so
  drawing those hints, with the capture count inside the dot, costs nothing and
  removes half the frustration of learning the game. The just-flipped discs
  spin once (`.jg-rev-gira`) and the newest wears a ring: that one-shot
  animation is safe only because the board's repaint signature carries
  `est.ultima.casilla`, so the SVG is rebuilt exactly once per move.
