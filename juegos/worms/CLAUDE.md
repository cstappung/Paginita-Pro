# Circuit Breakers (worms) — notes for Claude

Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Circuit Breakers (`worms`) is a whole game in an iframe**, like Mina Club:
`juegos/worms/` is its own document (canvas, physics, `audio.js`) and
`juegos/worms.js` (`crearWorms`) is only the postman between that frame and the
room — it simulates nothing. Four things hold it together:

- **The log carries one entry per turn**, `{t:"turno", uid, k, s, v, d, ti}`:
  `k` the turn number, `s` the serialised snapshot at its end, `v` the squads
  still standing, `d` damage per seat, `ti` the seat that played. `redWorms` in
  `motor.js` reads **only those headers**, never the snapshot, and the **first
  entry for a given `k` wins** — two tabs of the same player can both publish
  turn 7, and whichever arrived second is ignored rather than trusted.
- **The frame is configured only once the room has started** (`est.listos`).
  Before that it does not know how many squads there will be, and a game that
  begins with two and then receives a third has no deterministic repair.
- **What the active player is doing mid-turn goes through `vivo/<pid>`**, not
  the log: a header `h = {k, uid}` plus chunks under `c/<i>`. It is disposable —
  nothing is rebuilt from it — so whichever tab sees `fin` deletes it, and the
  rules let only players write there and only until the game ends (or delete).
- **Each log entry is forwarded to the frame once, by its key**, not by
  `jugadasDe`, whose helper overwrites the key with the entry's own `k`.
