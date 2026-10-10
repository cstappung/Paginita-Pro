# BBTAN — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**BBTAN (`juegos/club/bbtan/`) is a Solo Club game too**, on the same
`conexion.js` protocol: plain files, no build, bump `?v=bbtan-N` in its
`index.html` when they change (and `club-N` in `solo/club.js` for the iframe).
Its one category is `club-bbtan-rondas` and `puntos` is the **highest round
reached** (the time played rides along as the tiebreak), reported once per game
on game over or on restart, and only from round 2. Its ten logros are round
thresholds (`deMarca`). Two things not to break: the audio's `clear()` and the
NICE! celebration are the original's and stay as they are; ball hits are a
short rising sine through a low-pass (`bubble`) and a broken block is a noise
burst + thump + arpeggio (`broken`), both throttled so a combo does not turn
into a wall of sound. The retro look is Press Start 2P, notched pixel frames
(`pixelFrame`), plus-shaped balls (`pixelBall`) and CSS scanlines on
`.canvas-wrap::after`. The regex in `soloRanks` needed widening, so the rules
must be re-published.

**Everything that decides a BBTAN game lives in `motor.js`** (UMD
`BBTANMotor`; `physics.js` and `rules.js` are gone): fixed 1/60 s ticks
whatever the speed or FPS, only `+ − × ÷` and `Math.sqrt` plus its own
sine/cosine (no `Math.sin/cos/atan2/random`, so Node and every browser
replay the same game), integer aim angles and mulberry32 per round. That is
what lets `verifica/bbtan.js` replay a whole game from the seed and the
shots (`M.prueba(E)`, see `docs/antitrampas/bbtan.md`). The saved game is
v2: the motor's state *plus* the shots so far, so a resumed game is proven
from round 1; a save whose round does not match its shots is refused, and an
old v1 save can be finished but is not reported. `game.js` only draws and
plays sound.

**BBTAN's music is composed live from the board** (`musica.js`, UMD over
`Chip`, tested by `musica.test.cjs`); it no longer loads `temas.js`, though
`T.bbtan` stays in the songbook. `game.js` sends `BBTANAudio.mood({filas,
bloques, ronda, disparando})` every 200 ms. `intensidad()` turns that into I
in [0, 1], driven mostly by how many free rows are left above the floor and
partly by how full the board is. The `Motor` smooths I (τ 1.6 s) and uses it
to set the tempo, drums, arpeggio, filter cut-offs and a sidechain pump. In
calm there is no snare and the melody is sparse; near the floor you get
sixteenth hats, an alarm cluster and a heartbeat. The harmony switches to
«filo» at I ≥ .7 and leaves it below .5. That hysteresis stops it flickering
when a row goes back and forth. `duck()` lowers the music bus under the NICE!.

**From round 50 the game descends five floors** (`descenso.js`, UMD on
`BBTANDescenso`, loaded before `musica.js`): abismo from 50, ruina from 110,
estática from 170, hostil from 230 and vacío from 290. None of them is a switch.
`corrupcion(ronda)` rises by 1/60 per round over the sixty rounds after each
threshold, and each fade starts where the last one ends, so it climbs without
plateaus from 0 at round 49 to 5 at round 349, and **everything reads that one number** except the
gameplay: blocks, balls, physics and aim stay as they are, so the game only
gets more uncomfortable. The colours are `mezcla(c)`, a blend between the two
floors' palettes (`ETAPAS`), and `paleta()` in `game.js` writes them into
`colors` and into CSS variables on `<html>`. The floor adds the classes
`descenso` and `desc-2…5`, and each one breaks the frame a bit more: chipped
corners, chromatic glow, jitter, a heartbeat and a skewed shell. The
reduced-motion setting turns those animations off. The canvas gets cracks,
faint words, blinking eyes and static (`drawDescenso`, `drawEstatica`). The
character's face turns evil with `pose.maldad` in `character.js`, adding in
order: pallor, V brows, red eyes, streaks and a jagged grin. The whole body
and outfit follow (`pose.t` animates them): the skin goes grey then blood red,
the green shirt and blue jeans go black and burgundy, then come a stoop, a
torn shirt and frayed hems, a tail, horns, veins, claws, a glowing pentagram,
shoulder spikes and last bat wings, each over its own `m` range. The balls
change too (`drawBola`, `drawEstelaBola`): a halo and embers, then an eye that
looks where it flies and blinks, then a black core with a red rim, with a
trail of rising embers and smoke. The texts come from
`TEXTOS`, one column per floor, picked with `etapa(c)`, the nearest floor, so
the tone flips mid-fade. They go from cheering to «NO TE QUEREMOS AQUÍ», and
past floor 2 `corrompe` swaps letters with a seeded noise so the status bar
does not flicker. «PANTALLA LIMPIA» and the NICE! are never touched. The music
gets `descenso` in `mood()`, and `Motor` smooths it (`D`, τ 4 s). The first
floor fades the harmony into the abyss's sub bass, saturated bass and detuned
lead. Past that, the wrapper `eventos()` breaks what `base()` plays: bitcrush
(`trituradora`), wrong notes and a wobbling lead in ruina, dropouts and
crackle (`bat 'r'`) in estática, and in hostil a heartbeat that never stops
plus a dissonant pad cluster. In vacío come silent bars and notes that fall
an octave (`cae`). Each floor is slower.

**The descent is never announced.** Nothing says «entering floor N»: no
entry toast, no `presagio` sting (both removed), no class that flips on one
round. The CSS reads continuous weights `--w2…--w5` that `paleta()` writes,
and in `game.js` each effect fades in over its own corruption range
(`lento(a, b)`), so things take over one by one rather than per floor. What
creeps in: a face hidden in the dot grid (`CARA`) whose red pupils follow the
highest ball, veins from the corners (`VENAS`), a faint pentagram, eyes that
open on the blocks and follow the ball (`ojosDeBloque`), blood dripping from
them (`gotea`). Labels change letter by letter (`ETIQUETAS`: PUNTAJE→PECADOS,
RÉCORD→CONDENA, RONDA→CÍRCULO, BOLAS→ALMAS), the title turns BBTAN into
SATAN (the `<h1>` and `document.title`), and a red `susurro` flashes in a
label for a moment (`mutaciones`, every 120 ms).

**The one exception is the voice, and it was asked for** (`voz.js`, UMD on
`BBTANVoz`, tested by `voz.test.cjs`). Every 50 rounds the game speaks
(`habla`) and the phrase is also shown as a toast (`hablaJuego` in `game.js`,
`.toast[data-voz]`). It does not name the floor, it just changes mood: a
fairground host at 50 and 100 (`alegre`), broken and absurd at 150 and 200
(`roto`), whispering against the player at 250 and 300 (`susurro`), a
whisper cut off by a sugary voice at 350 (`giro`) and a too-perfect chorus
from 400 (`perfecto`). **It is recorded, not synthesised in the browser**:
`speechSynthesis` did not exist on phones and sounded different, and bad, on
every PC. `colabtex/scripts/bbtan-voz.py` renders each phrase of `FRASES`
with Piper (voices `es_MX-claude-high` and `es_MX-ald-medium`, apache-2.0
and unlicense datasets) into `assets/voz/v<nivel>-<i>.mp3` (~1.2 MB in
all). Each mood has its own processing there. `alegre` is pitched up by
synthesising slower and resampling faster. `roto` works in two- or
three-word chunks, each in another voice and pitch; single words came out
unintelligible. The stutter is spoken («cu, cu, cucharas»). `susurro` is a
real whisper, an LPC vocoder excited with noise, over a growl seven
semitones down. `perfecto` is a phase-vocoder chord (+4, +7, +12). The text
in `FRASES` is both what is read and what was recorded: **change a phrase
and re-run the script**. The test checks that there is one MP3 per phrase
and none left over. `faster-whisper` transcribing the output is how
intelligibility was checked. `audio.js` fetches a level's three files five
rounds early (`prepara`), plays through WebAudio (`anuncio`), ducks the music
and lays a bed under the voice. The beds are a fair arpeggio, glitch beeps,
the breath and drone, or a music box that climbs. It reports the real
duration back so the toast waits for the voice, and `vozSeq` drops a voice
that arrives after a restart.

**Past round 350 the descent is undone and the world turns perfect**
(`descenso.js`). The descent does not stop; it is subtracted.
`corrupcionVista = corrupcion × (1 − luz)`, with `luz` going 0 → 1 over
350–364, so everything that reads `corr` rewinds by itself. That includes
the character's evil, SATAN and the music's floors. `perfeccion(ronda)`
(`cielo` in `game.js`) is 0 until 349, 1 at 369 (dulce enters fast because
it is what sweeps the dark away), 2 at 449 (radiante) and 3 at 499
(perfecto). It stays at 3 after that. The palettes are light candy colours
(`CIELO`, blended over the fading descent by `mezclaCielo`). The CSS
`html.cielo` gets `--p1…--p3` and one more palette key, `text`, because the
page turns light. Texts come from `TEXTOS_CIELO` through `tx()`/`fundeTexto`.

Like the descent it creeps in (`suave(a, b)`) and nothing is announced. In
order:

- a sky, a sun and clouds;
- faces on the blocks (`carita`), rainbow balls that become hearts, and
  confetti;
- a rainbow, clouds that smile, and blocks, flowers and the page all bouncing
  on the same 1.63 s beat;
- at the end the sun grows, and every face stops following the ball and
  stares at the player;
- smiles grow wider than the faces, and background words appear («TODO ESTÁ
  BIEN», «NO MIRES DEBAJO»);
- very rarely, for 90 ms, the red face of the descent (`CARA`) flashes
  underneath (`debajo`).

The character comes back to normal and then gets «perfect» with
`pose.perfecto`: pastel clothes, a flower crown, a halo, angel wings, blush,
huge unblinking eyes and a grin that does not fit. Labels turn into
ALEGRÍA/ORGULLO/SONRISA/AMIGOS and the title into «BBTAN :)».

The music (`cielo()` in `musica.js`, `e.C`) is C major I–V–vi–IV with
four-on-the-floor, claps and a glockenspiel. It enters phrase by phrase like
the abyss. It is uncomfortable because it does not listen: above C = 2,
danger makes it happier and faster instead of tense. Each 8-bar loop also
modulates up a semitone, and a music box echoes the melody one step late.
Gameplay is untouched here too.

**A game in progress is saved per account** (`guarda`/`cargaPartida` in
`game.js`). At the start of every round from round 2 the board is written to
`localStorage` and sent with `Club.guardarPartida` to the parent, which
stores `{d, at}` at `users/<uid>/club/bbtan` (`fb.guardarPartidaClub`). That
node is the user's own, so **no rules change was needed**. On load the local
copy restores first; then `Club.pedirPartida` asks for the cloud one, which
wins if it is newer and nothing has been shot yet. A finished or restarted
game writes `d: null` (a tombstone with its `at`), so a stale copy on another
device does not come back. It resumes at the start of the saved round.
