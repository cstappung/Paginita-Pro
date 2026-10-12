# Trigon — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Trigon (`juegos/club/trigon/`) is a Solo Club game too**, a block puzzle
on a triangular grid (after the iOS game). Plain files, no build
(`?v=trigon-N`): `motor.js` (UMD `TrigonMotor`, pure: a hexagon of side 4 =
96 triangles in axial coordinates, 24 lines in three directions, 8 piece
shapes with every rotation and mirror, each hand of three from mulberry32
seeded with `mezcla(base, k)` and re-dealt up to 4 times if nothing fits, and the five power-ups of its
`PODERES` table — hammer, rotate, new hand, bomb, second chance — won at
random when lines clear, logged as moves with negative codes and replayed
like the rest),
`juego.js` (the screen: SVG board, drag and drop with a magnet to the
nearest valid spot, keyboard 1-2-3 + arrows + Enter, the start menu with
the leaderboard read from the `ranking` message, and per-theme line-clear
effects), `estilo.css` (shape only, no fixed colours) and `temas.css` (5
themes × dark/light as variables on `[data-skin]`/`[data-modo]`, chosen
with 🎨 and kept in `localStorage`). The half-played game lives **only in
`localStorage`** (seed + moves, dropped after 24 h without a move), never
in `users/<uid>/club`. One table, `club-trigon-puntos` (score, capped at
1e6, time = ms played). The proof `{v, s, u, j, a, w, fin}` carries every
move as `[piece, dx, dy, origin, Δms]`, and `solo/verifica/trigon.js`
replays it (`docs/antitrampas/trigon.md`). Logros (score thresholds), coins
(1 per 100 points + the per-game pay), the Discord podium, the cover and
the illustrated manual are wired like 2048's, plus the `ttrigon` champion
frame (a turning ring of triangles; no replays yet); the `soloRanks`, `soloPruebas` and `clubJugadas` regexes
were widened, so the rules must be re-published.
`tests/trigon.test.cjs` covers geometry, motor and verifier.

**Look and sound (`juego.js`).** Each filled triangle is a gem: `bisel()`
draws, right after its polygon, a `<g class="bisel">` with three bevel faces
(white or black by how each edge faces the light from above) and an inner
table; CSS shows it with `.celda.llena + .bisel`, so the polygon and its
classes (`llena`, `fantasma`, `cierra`, `data-i` for the hammer) are the same
as before. Just-placed cells get `.nueva` (a scale-in with a flash). The
power-ups are ability slots, not emojis: inline SVG icons (`ICONOS`) in the
colour of each power (`--poder-*` in `temas.css`, the same in every theme),
name, charge badge and key. **Audio** is one `AudioContext` (behind
`volumen.js`) with a music bus, an effects bus and a generated-impulse
reverb. **The music is not the house chip**: `musica.js` (UMD
`TrigonMusica.crear(ctx, destino, {jugando})`) is its own synth, because
the chip version was rejected as «arcade, not Cyberpunk». It is Edgerunners
darksynth: detuned saw pads behind a breathing low-pass, Reese bass with an
808 in the bridge, ping-pong plucks, a vibrato saw lead, distorted
power-chord «guitar» in the chorus, sidechain pumping on every kick, a long
dark reverb and a city/rain bed. Rhythm and harmony are the first version's
(F# harmonic minor at 120, Neapolitan G bridge). Do not move it back to
`Chip.Reproductor` or add square-wave voices. It schedules ahead of the
audio clock, so it renders in an `OfflineAudioContext` (`_prepara(0)`, then
`programa(t)` in chunks: it does at most 200 steps per call). It is not in
the header player's `CANCIONES`. `NIVEL` keeps it at the Club's music
level (RMS ≈ 0.06 at the bus's 0.5). Effects are in the
song's key: placing a piece is a soft glass note from the F# minor
pentatonic (one per shape, panned by where it lands); clearing lines is an
arpeggio on the chord of the current streak that grows with 2 lines and
**saturates at 3**. ♪ mutes the music (`trigon.musica`), the speaker the
effects (`trigon.mudo`). The melody drops out in the menu and after the end.

**Guest destacado.** Playable without an account; a guest's score is saved
if they sign in afterwards, and the game adopts what it left under the
`invitado` account through `Club.deInvitado` (`docs/claude/juegos/salon.md`).
Its proof may carry `u: "invitado"` for any owner (`DE_INVITADO`).
