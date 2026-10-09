# Juegos — music, songbook, player and controllers

`chip.js`, `temas.js`, `volumen.js`, `mando.js` here; `sonido.js` and `reproductor.js` in `colabtex/src/juegos/`. The mute/volume rule every game must follow is in `colabtex/src/juegos/CLAUDE.md`.

**The music is one songbook** (`juegos/audio/chip.js` + `temas.js`, plain
scripts on `globalThis.Chip` / `globalThis.Temas`). The lobby's `sonido.js`,
Mina Club, Snake and Circuit Breakers all play through the same
`Chip.Reproductor`, so the whole room sounds like one console instead of four
radios. `Reproductor` reads `tempo` on every step, which is what lets
`ajustarMusica({tempo, capas})` speed a song up mid-bar; `ambientar()` resets
that adjustment whenever the theme changes, so one game's hurry never leaks
into the next. `tests/temas.test.cjs` checks every theme compiles, that its
section lengths are whole bars, and that no note is silently dropped.

**The header's ♪ button is a player, not a mute** (`reproductor.js` over
`CANCIONES` in `sonido.js`). Every song in the house is in one repertoire,
grouped by mood (`GRUPOS`): the games' own themes, plus six more written
for the list — *Sobrecarga* (drum'n'bass) and *Tormenta* (boss fight) under
Intensas, *Neón 84* (synthwave) and *Pulso de datos* (techno with sidechain
pump) under Electrónicas, *Turno de noche* (lo-fi with an 808, in the vein of
Schedule I's soundtrack) and *Cumbia de la mesa* under Chill y fiesta. Those
needed the chip to grow a low-pass filter, sidechain pump, detune, glide and
an 808 kick with claps. The **Pokémon** group holds eight tributes to
FireRed/LeafGreen (`pk-*` in `temas.js`): town, route, Center, forest, bike,
wild battle, trainer battle and gym. **Their melodies are original on
purpose**, and only the GBA timbre and the mood of each place are borrowed.
Transcribing the real ones, even out of a public decompilation, would publish
Nintendo's compositions on an open site, so don't "fix" them into the real
tunes. **Automático** (the default) keeps the old behaviour,
one song per game and silence in the lobby. Picking a song makes it play
everywhere, lobby included, until you go back to Automático. The choice,
the list mode (repeat / in order / shuffle) and the volume persist in
`localStorage` (`jg.cancion`, `jg.modoLista`, `jg.volumen`). A song's end is
seen through `Reproductor.vueltas` for the chip and a backwards jump of
`timeupdate` for a recording. `ambientar(null)` means "this screen brings its
own music" (Circuit Breakers' frame). `PROPIAS` maps the game's name to that
same `null`, because `juegos-main.js` re-ambients every room by name on each
repaint and was overwriting the frame's request. The panel hangs off `<body>`
in `position:fixed`, like the rules manual, and while open it only retouches
classes and texts on each `alCambiarMusica`, so the volume slider keeps the
finger mid-drag.

**A theme may be a recording instead** (a `CANCIONES` entry with a `url`): Flip 7, Cacho and UNO play
"Poker Night" by Zane Little (OpenGameArt, CC0) from `juegos/audio/`, looped by
hand at `fin` (124.3 s) through `timeupdate` because the file's tail is
silence. The chip version of a table game sounded thin, and a lounge track is
what the room was missing. The hurry-up reaches it through `playbackRate`.
The same file also carries **sampled effects** (`MUESTRAS`: Kenney's Impact
Sounds and Casino Audio, both CC0) — knuckles on wood for `madera`, a card
sliding for `reparte`. They are fetched when the flip7 theme starts
(`cargaMuestras`) and `muestra()` falls back to the synth until they decode, so
the first card of a room is never silent.

**The endgame speeds the music up.** `progreso(est, juego)` in `motor.js`
returns how far the board is (boxes drawn, squares filled, stars taken, rounds
won — 0 outside `jugando`), and over the last 30 % `juegos-main.js` ramps the
tempo up to +12 %: the arcade "hurry up". The cartas figure is an estimate on
purpose, since five rounds of one colour make no trio.

## Mandos (`juegos/audio/mando.js`)

PS4/PS5, Xbox and Switch Pro controllers work everywhere in Juegos. Each
document that has a game loads `juegos/audio/mando.js` (`?v=mando-N`, bump it
by hand in every page when it changes). It reads the Gamepad API in its own
`requestAnimationFrame` and **turns buttons into the keys the game already
understands**: synthetic `KeyboardEvent`s with `key`, `code` and `keyCode`
(Phaser reads `keyCode`, Worms `key`, Yemas `code`) and a `__mando` flag,
dispatched to `cfg.objetivo()` or `document.body`. So a game learns nothing
about the controller; it declares a mapping with `Mando.configura({botones,
stick, pistas, menu, inicio, zonas, junto, objetivo})`. A binding is a code
(`'Space'`), `{tecla, rep, retardo}` for auto-repeat, a function, or
`{baja, sube}`. Things to keep:

- **Buttons are logical by position**: `a` is always the bottom face button.
  On a Switch Pro the confirm button is on the right, so `normaliza` swaps
  a/b and the glyphs follow the family (✕ ○ □ △, A B X Y, or Nintendo's).
  The family is matched **Xbox first**: its id also says «Wireless
  Controller», which is DualShock 4's name.
- **Where there is no config, or `menu()` is true, or a `<dialog>` is open,
  the controller drives a cursor** (stick moves it, d-pad jumps between
  buttons, A clicks, B goes back, Start clicks `inicio` or falls back to the
  `start` binding). Select toggles cursor/game by hand. Room games, Clue,
  PRODROP, Electrodle and the Sopa use only the cursor.
- **The keyboard hints are swapped while a controller is connected**: the
  elements in `zonas` (or a `<p>` after `junto`) are hidden and replaced by
  the controller's `pistas`, in the connected family's glyphs. A config
  change removes the previous one's hints. The top page steps aside while an
  iframe with its own copy is the one being played, so a button never acts
  twice.
- **Analog input is read by the game itself** through `Mando.estado()`:
  Yemas looks with the right stick, shoots with RT and aims with LT
  (`pasoMando` in its `main.js`), and needs no pointer lock with a
  controller; Start opens its pause, where the cursor takes over.
- Tetris (room and club) derives its mapping from the remappable keys
  (`mandoTetris` in the club's `motor.js`), so a remap moves the controller
  too.

`tests/mando.test.cjs` covers the pure part (`Mando._p`) and Tetris' mapping.
