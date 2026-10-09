# 2048 — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**2048 (`juegos/club/dosmil/`) is a Solo Club game too**, the classic
sliding-tile puzzle. Plain files, no build (`?v=dosmil-N`): `motor.js` (UMD
`DosmilMotor`, pure: the board as exponents, the slide and merge, and each
new tile from mulberry32 seeded with `mezcla(base, k)`, where the base mixes
the seed with the account) and `juego.js` (the screen: swipes, arrows/WASD,
the controller through `mando.js`, «seguir» past 2048, and the half-played
game in `users/<uid>/club/dosmil` through `Club.guardarPartida`). Two tables:
`club-dosmil-puntos` (score, capped at 4e6, time = ms played) and
`club-dosmil-ficha` (the highest tile, a power of two up to 262144, time =
when it was first reached). The proof `{v, s, u, f, a, w, fin}` carries
every move as origin + direction + Δms, and `solo/verifica/dosmil.js`
replays it (`docs/antitrampas/dosmil.md`), rejecting bursts no hand can
play. Logros, coins, the `tdosmil` frame, the Discord podium and the manual
are wired like ALETEO's; the `soloRanks`, `soloPruebas` and `clubJugadas`
regexes were widened, so the rules must be re-published.
Each move stores **whole** ms (`Math.round` in `juega`): `performance.now`
has decimals, and a fractional `tiempo` fails `resultadoClub`
(`Number.isSafeInteger`), which dropped every record silently.
`tests/dosmil.test.cjs` covers motor and verifier.
