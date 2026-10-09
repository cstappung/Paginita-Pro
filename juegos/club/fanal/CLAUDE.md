# FANAL — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**FANAL (`juegos/club/fanal/`) is a Solo Club game too**, a Space Invaders
retold as a lonely voyage: you carry the last light (a lantern on a boat)
through the night towards «el Alba», and the invaders are moths drawn to
it. Plain files, no build (`?v=fanal-N` on its five scripts and its
stylesheet): `relato.js` (every text: the per-jornada log, the 25 letters
the Mensajera carries, the revelation, the three endings, the endless «ecos»,
the taller and the augurios),
`motor.js` (pure: jornadas, difficulty, points, the pulse judgement, the
progress merge), `sprites.js` (pixel art), `musica.js` (a procedural
music engine) and `juego.js` (the screen). The first four are UMD and run
in Node, so `tests/fanal.test.cjs` covers them without a browser. The
story is 20 jornadas in ten acts, **one wave and one boss per act** (odd
jornadas fight the swarm, even ones the boss): the first part (enjambre,
niebla, oscuro, alba; 1–8, la Nodriza, el Faro Ciego, la Esfinge, the
lumbres and el Alba), «la otra orilla» (los cascos, la seda, la hoguera;
9–14, el Casco, la Crisálida, la Hoguera) and «lo alto» (la marea, el
firmamento, el cenit; 15–20, la Luna, las Siete Hermanas, **el Sol**, the
last one). Internally the later acts are 6–11 (5 is the endless;
`ROMANO_ACTO` shows them as V–X). After the Sol the same run turns endless
(21+, `CICLO_SINFIN`), cycling the nine fighting acts in blocks of two
(wave + boss), the bosses in **phase 2** on the first lap and **phase 3**
after (`fase`, `VIDA_FASE`). **There is one mode and no checkpoints**: every
travesía starts at jornada 1. But it can be resumed: `guardaPunto` stores
`prog.punto` (with the proof so far, `ver`, the upgrades and `perdidas`, a
flame lost mid-jornada that is re-applied on resuming) at the start of
every jornada and after every hit, and «Seguir la travesía» rebuilds the
state from the proof (`retoma`). Losing every flame or «Terminar la
travesía» sends the result and clears it; «Nueva travesía» with one saved
first sends that one. Things that matter:

- **Brasas, the taller and evolutions** (`MEJORAS`, `compra`, `armas`,
  `nave` in `motor.js`). Each completed jornada gives one brasa; between
  jornadas the taller opens (`capaTaller`, keys 1–9) and each brasa buys a
  level (three per upgrade, four upgrades per branch: the flame —
  cadence, damage, pierce, spread — and the boat — oars, tempered glass,
  oil, long light) or relights one flame. Every three levels in a branch
  it evolves (Chispa → Brasa → Antorcha → Faro → Estrella; Barca → Fanal
  de bronce → Luciérnaga → Doble vidrio → Faro errante), with a new sprite
  and a power. **`armas()` is the single source** of cooldown, bullet
  pattern, damage and pierce: the screen shoots with it and the proof
  bounds with it. What is bought goes into the next jornada's record as
  `u` (one letter per brasa) and the verifier re-buys it with the same
  `M.compra`; a resumed travesía restores upgrades from its proof.
- **Augurios: every jornada is a bit harder, and it says why.** The night
  learns one thing per jornada from a fixed wheel of eight (fire rate,
  scale speed, march, aim, dives, boss fury, more scales, armour), stacking
  each lap (`nivelAugurio`, `aplicaAugurios`, with caps). They depend only
  on the jornada number, so a table position is equally hard for everyone,
  and the transit names the new one. Boss life also grows with the jornada.
- **The other shore has its own mechanics, none of them in the proof**:
  drifting wrecks (`cascos`), silk threads that slow the oars (`hilos`,
  `F.enredo`), embers dropped by dying moths (`ascuas`). The Casco marks
  its anchor column, pulls you in, and its falling debris become new small
  wrecks; the Crisálida drops marked threads and hatches into an imago at
  a third of its life; the Hoguera holds eight lanterns prisoner (shooting
  one frees it and it rows with you, taking scales) and halves every hit
  while five or more remain — the proof counts boss damage generously, so
  that rule needed no proof change.
- **Lo alto** adds the tide (`j.marea`: the whole formation bobs up and
  down) and shooting stars (`j.fugaces`: diagonal escamas that twinkle for
  0.7 s first, `e.espera`). The Luna sweeps in an arc, fires crescents with
  one gap marked by two dotted lines, drags the boat with the tide and, as
  a new moon, cannot be hit (`jefe.oculta`). The Siete Hermanas are seven
  stars (`PLEYADES`, rotated with `jefe.giro`): veiled ones stop bullets
  with no damage and the veil moves; only lit ones are hit (`hiereJefe`).
  The Sol fires 360° coronas, marked sun rays (shade under a wreck, drawn
  by `dibujaColumnas` like the Hoguera's), flares (larvas, `O` events),
  solar wind and an eclipse during which it cannot be hit; it dies
  shrinking into a lantern, and `finalSol` tells why. Entering the
  firmamento brings 180 stars back (the moths you put out «went up»).
- **Phases 2 and 3 are drawn and fought differently** (`faseExtra`,
  `pintaCuerpo`, `dibujaAura`): bigger (×1.2/×1.35, hit boxes too),
  crimson tint (`banco.tinte`), a spiked aura, and every new boss escama
  comes back mirrored 0.42 s later (half of them in phase 2). Phase 3 adds
  three orbiting thorns that block shots (`V` events, back after 6 s) and,
  below a third of life, shock rings with one gap at the bottom. A hit may
  never take more than the bullet's damage (`hiereJefe`): the verifier
  bounds each `X` by it.

- **The counter «✦ luces» is the twist made visible.** It starts at 430,
  and each background star *is* one of those lights: killing a moth puts
  out a star (`apagaEstrella`), from the first shot. The revelation after
  the Faro says what they were; the surviving moths rise and become stars
  again (the counter goes up), and the Esfinge's death puts out every star
  left (`apagaTodas`, counter to 1). The last encounter is won by **not**
  shooting: every shot that hits the Alba pushes it back (`EMPUJE_ALBA`)
  and comes back at you; it closes in on its own. The crossing reveals a
  sky full of wings (`cielo.lleno`). The 📖 manual describes the rules but
  not these twists.
- **The light is layered and pixel art too.** The game draws at 240×320 and
  is scaled ×3 without smoothing. Over it goes a darkness mask with holes
  where there is light (`dibujaOscuridad`), **posterized against the act's
  own darkness level, not against black**: measured against black, the
  uniform darkness of the first act came out as a Bayer screen door over
  the whole screen; against its own level it stays flat and only the edge
  of each light is dithered. An additive `luz` layer gives the glows and
  the bloom (two downscales, smoothed back up); chromatic aberration (red
  and cyan copies of the frame) only runs while a hit lasts. In the dark
  act the moths glow faintly, like distant stars, so the act is hard but
  not blind, and escamas always carry light.
- **The music keeps the clock.** `musica.js` counts eighth notes on the
  **game** clock and schedules audio from it, so pulses exist with the
  sound off: the formation lurches on each pulse (`form.empuje`, the
  original's heartbeat, faster as it thins), the flame beats, the
  metronome at the bottom lights, and a shot is judged *afinado* against
  `pulsoCercano(t − latency)`. Each act has its scale in cents (pélog,
  frigia dominante, menor húngara, lidia aumentada; sléndro and a rotation
  in the endless) and an irregular meter (7/8, 5/4, 11/8, 9/8, 13/8);
  layers follow tension, danger and the boss (`capas`, pure), boss
  leitmotifs transform with its life (`leitmotiv`), and a hit distorts the
  music through one shared detune source (`curvaBend`). The drone had a
  sine at ~37 Hz: inaudible on a laptop speaker and it ate the headroom the
  bells needed, so nothing goes below ~70 Hz (measured with `nivel()`, an
  analyser on the output).
- **Delayed things run on a game-time agenda** (`programa`/`corre`), never
  `setTimeout`: a pause right after the last moth used to start the transit
  under the pause panel, and a timer from a run that had died opened the
  game-over screen over the next run. The agenda stops in pause and drops
  whatever belongs to another run.
- **Every attack is announced.** The Faro's beam sweeps a *sector* marked
  by two dotted lines (it used to sweep the whole screen faster than the
  boat can row, so only a wreck could save you); wrecks cast shadows that
  block it. The Esfinge marks a dive's column and the only gap of its dust
  wall, which shots cannot break.
- **Categories**: `club-fanal-travesia` (points, capped at 1 000 000) and
  `club-fanal-jornadas` (the furthest jornada completed: 8 is the Alba, 14
  the Hoguera, 20 the Sol). `club-fanal-sinfin` only keeps the marks from
  before proof version 4 (shown as «Sin fin (hasta oct. 2026)»; the rules
  still accept it, so they needed no change). `jornadas` is only sent when it
  improves, because every result counts as a club play and pays coins.
  Ten logros (`deMarca`), coins (the jornadas record pays like BBTAN's
  rounds, `monedasFanal`: jornada n pays 5n + 5 up to 250 from the 49th,
  nothing past the 160th — 220 for the Alba, 1150 for the Sol; and 1
  per 1000 points up to the cap), the
  `tfanal` champion frame, the Discord podium and the manual are wired
  like Sudoku Arcade's. Read letters, the endings seen, the saved travesía
  and local records travel as one blob in `users/<uid>/club/fanal`
  (`Club.guardarPartida`, merged with `mezclaProgreso`). The `soloRanks`
  and `clubJugadas` regexes were widened, so the rules must be
  re-published.
- The log and the revelation are written as whole lines and revealed with
  CSS, never letter by letter: `i18n.js` would translate every fragment.
  `window.__fanal` (`salta(n)`, `sigue()`, `estado()`, `mundo()`,
  `brasas(n)`, `taller()`, `prueba()`…) drives the game from a script,
  which is how the story and the bosses were played through in Chromium.
  The proof is version 4: one mode, always from jornada 1 (`docs/antitrampas/fanal.md`);
  any change to it must bump `club-N` in `solo/club.js`.
