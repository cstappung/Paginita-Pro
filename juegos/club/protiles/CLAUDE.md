# PRO TILES — notes for Claude

Solo Club game of Juegos (a Piano Tiles with 8 original endless pop songs),
brought in by the owner as a single `index.html` and split here. Shared
club rules (anti-cheat proof, castigo, modo celular) are in
`juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in
`docs/claude/juegos/perfiles-y-economia.md`; anti-cheat in
`docs/antitrampas/protiles.md`.

Plain files, no build (`?v=protiles-N`):

- `motor.js` (UMD `ProTilesMotor`, pure): the songs, accompaniment styles,
  the endless composer (verbatim from the original) and the game itself:
  fixed 4 ms steps (`paso`), `golpe` (hit the next tile), `suelta` (release
  a long tile), `falla` (tap outside), the proof codec and `rehace`.
  Geometry is in rows (the screen is 4 rows tall). **Lanes come from
  mulberry32 seeded with seed + account**; the melody is the same for
  everyone. No `Math.exp`/`Math.random`: `expNeg` is a hand-made exponential
  so the replay is bit-identical across engines (a test greps for it).
- `juego.js`: the screen — the original canvas, piano (Salamander samples
  from `tonejs.github.io`, synth fallback offline) and drums, adapted to
  the box `#app` instead of the window (it lives in an iframe that sizes
  itself). Everything that was `position:fixed` is absolute inside the box.
  What is drawn is `vp` (engine pos + the part of the current step, or the
  fail animation); hits are tested against `E.pos`.
- `estilo.css`: the original's CSS with its variables renamed `--pt-*`,
  because `conexion.css` redefines `--ink`, `--paper` and `--line` (and
  their dark twins) on `html.club-integrado`.

**Nine tables, one per song plus the mix** (`club-protiles-<id>`,
`club-protiles-mezcla`), points with time as tiebreak. Playing a song
switches the side ranking panel to its table (`Club.category`); the
`#selTabla` select in the aside picks any of the nine. The result is sent
only when the game ends (a tile escapes or a tap misses) with score ≥ 1;
quitting from the pause menu sends nothing, as in the original.

Traps:
- **The piano credit is mandatory (CC BY 3.0)** and must not be a
  `<footer>`: `conexion.css` hides footers inside Juegos. It is `.pie`.
- Resizing the box (including entering/leaving the phone immersive mode)
  releases a held long tile (`layout` → `soltar`), recorded in the proof.
- A long tile held when the game ends gives no bonus (`falla` / escape
  clear `E.hold`), as in the original.
- Mute: the game's own `#sound-button` (in the scorebar) plus the Club's
  volume slider (`volumen.js`), also visible in the immersive strip.
- Guests cannot play it (not a `DESTACADOS_INVITADO`).
- **Phone width**: in `html.club-inm` / `html.pt-pc` the `.layout` column
  must `align-items:stretch`; with the normal layout's `start` the box shrank
  to its content (268 px) and sat against the left edge of every phone.
- **Fullscreen** (⛶ in the scorebar and the pause card): `requestFullscreen`
  on the document (Metro Rush's approach); `html.pt-pc` reuses the immersive
  layout. Hidden where the API is missing (iPhone). No keyboard shortcut:
  F is a lane key.
- **⚙ Ajustes** (`#ajustes`, from the menu or the pause): the four lane keys
  (`teclas`, stored as `KeyboardEvent.code` in `save.teclas`; a key already
  used elsewhere is swapped; Escape/Tab/Meta… are refused) and five palettes
  (`TEMAS` in `juego.js`: clasico, medianoche, menta, atardecer, neon). A
  palette sets the box's `--pt-*` variables inline and the canvas colours
  `C`; `--pt-ficha`/`--pt-sobre` are the tile colour and what goes on it, also
  used by solid buttons, so dark palettes (light tiles) keep their contrast.
  Neither touches the proof: keys only map to lanes, colours are paint.
- Light optimisations, same picture: the lane-glow gradient is built once per
  size and palette (intensity via `globalAlpha`), the nearest piano sample is
  memoised per note, and a finished long tile drops its audio voices (every
  tile stays in `E.tiles`, so they were never freed).

`tests/protiles.test.cjs` covers the engine, the replay and the verifier.
