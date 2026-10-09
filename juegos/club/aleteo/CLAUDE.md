# ALETEO — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**ALETEO (`juegos/club/aleteo/`) is a Solo Club Flappy Bird whose sky
goes dark**, in the vein of BBTAN's descent. Plain files, no build
(`?v=aleteo-N`): `motor.js` (UMD `AleteoMotor`, pure: fixed 1/60 s ticks,
mulberry32 per pipe seeded with the account, the proof codec and `rehace`),
`lore.js` (UMD `AleteoLore`), `musica.js` (live WebAudio) and `juego.js`
(the canvas). **The darkness never touches the game**: `corrupcion(puntos)`
climbs 0 → 5 with no steps (thresholds 15/35/60/90/130, 15-pipe fades),
and every colour (`paleta`), thought, crash line, label (ALETEO→ENCIERRO,
letter by letter) and music sky reads it, while pipe 200 is as wide as
pipe 20. The story: a bird flying back to the nest through morning,
afternoon, dusk, night, the cage (the pipes were bars) and the void
(«Nunca saliste»). One table, `club-aleteo-vuelo` (pipes, time = game
time), with a proof `{v, s, u, f, n, r}` that `solo/verifica/aleteo.js`
replays (`docs/antitrampas/aleteo.md`); logros, coins, the `taleteo` frame,
the Discord podium and the manual are wired like Atasco's. The `soloRanks`
and `clubJugadas` regexes were widened, so the rules must be re-published.
`tests/aleteo.test.cjs` covers motor, lore and verifier.
