# Cuadritos — notes for Claude

Screen: `colabtex/src/juegos/cuadritos.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

- **Cuadritos' scoreboard is in seating order, never sorted by points.** With
  five players, knowing who plays *next* is half the strategy — it decides
  whom you hand the chain to — and a scoreboard whose rows jump around after
  every box is unreadable. Whoever left is struck through rather than removed,
  matching the reducer, which leaves their closed boxes on the board and skips
  their turn.
