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
(wave + boss), the bosses in **phase 2** on the first lap, **phase 3** on
the second, **phase 4** on the third, **phase 5** on the fourth, **phase 6**
on the fifth and **phase 7** from the sixth on (`fase`, `faseDeVuelta`,
`FASE_MAX`, `VIDA_FASE`; boss jornadas 22–38, 40–56, 58–74, 76–92, 94–110,
112+). **There is one mode and no checkpoints**: every
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
- **Rigor starts in phase 6 and has no ceiling** (`aplicaRigor`, `RIGOR`,
  `gradoDeVuelta` in `motor.js`). It counts laps from the fifth
  (`VUELTA_RIGOR = 4`, fixed on purpose: tying it to `FASE_MAX` shifted
  every grado by a lap when phase 7 was added), so phase 7's first lap is
  already grado 2; `gradoTexto` writes the lap *within* the phase («VII»,
  «VII (II)»). Before it, `dificultad`, the augurios,
  `endurece` and boss life all hit their caps around jornada 80, so with a
  full weapon the endless run never ended. Now every lap spent in phase 6
  is one `grado` harder (1 on jornadas 93–110, 2 on 111–128, in phase 7…): boss life
  on screen +22 % per grado (`vidaJefeJuego`, unbounded), furia, escama
  speed, wave fire, balas, aim, dives and march (high caps), plus the
  phase-6 abilities bring more per grado (`masGrado` in `juego.js`) and come
  sooner (`cdEsp` 5.5 s − 0.35 per grado, ≥ 3.2 s). **Rigor only touches
  what the proof does not check**: the formations and moth life are the
  same, and the verifier still bounds boss damage with `vidaJefe` (phase 3
  life), which is lower than the screen life, so it never rejects an honest
  game and a run half-played with the old motor still verifies. Don't use
  `vidaJefeJuego` in `prueba.js`. The transit announces each new grado
  (`R.RIGOR`) and the HUD/boss card write the lap within the phase (`gradoTexto`).
- **Phase 7, «la de oro»** (kintsugi: the glass broke and was mended with
  gold). `dora` fills the dark body pixels with black lacquer shards split
  by gold veins (random-walk cracks seeded by canvas size, so every flap
  frame cracks the same; `porVeta` lowers the density — the Sol uses 600,
  its face got lost), gold outline; `lienzoJefe` records the phase being
  drawn (`faseLienzo`) so `roseton` becomes a gold-leaf `aureola` and
  `roseta` a gold flower; `dorado` maps phase 4's cold colours to golds;
  `solDeOro` is the Sol's own; `ESCALA_FASE[7]` ×1.55. Its sixth ability
  per boss (`ESPECIALES7`, block «La fase 7» in `juego.js`, rotation
  `[7, 2, 3, 4, 5, 6]`, same `cdEsp` as phase 6): Nodriza Pan de oro
  (swaying gold-leaf escamas: `e.hoja`, `e.vaiven` in `actualizaEscamas`),
  Faro Grieta (a marked column where you are that splits into two beams
  moving apart; wrecks cut them), Esfinge Tres cálices (a shell game: the
  two cups without the light pour fire on their third of the water), Casco
  Cofre (coins in arcs to marked spots, one on you), Crisálida Costura (a
  needle stitching shore to shore, starting far from you; stations every
  16 px with ±8 reach, so you must cross right after a stitch), Hoguera Oro
  fundido (drops that become spreading puddles), Luna Halo (a ring of
  escamas with a gap that hangs, then drops at once), Siete Hermanas
  Grietas del cielo (marked lines between sisters spill a row of escamas)
  and Sol Fulgor (a gold wave crossing the water; only its marked shadow
  or a wreck protects). **No proof change**: the only shootable parts are
  escamas; `VIDA_FASE[7]` is phase 3's. `R.FASE_NUEVA[7]` is announced in
  the transit the first time; `musica.js` (`FASE_MUSICA_MAX` 7) adds a gold
  gong on each downbeat and a cymbal swell (`c.oro`), tempo +24 %, still
  under `EPM_TECHO`. `__fanal.especial(7)` forces it; the Chromium check
  jumps to 112…128 with `salta(n)`.
- **Phases 2 to 6 have their own model and their own ability per boss.**
  `sprites.js` draws each boss six times (`nodriza(k, fase)`…,
  `COLORES_<JEFE>_F`, `ESCALA_FASE` ×1.2/×1.35/×1.4/×1.45/×1.5, hit boxes too): phase
  2 is «la herida» (ember red, cracks, something extra), phase 3 «la
  coronada» (near-black body, what burns goes white), phase 4 «la
  ascendida» (the body is night sky — `asciende` makes the dark palette
  colours see-through with a cold outline — and its marks are stars joined
  like a constellation), phase 5 «la del alba» (`amanece`: the dark body
  pixels are filled with a dithered dawn gradient, violet to gold, with a
  white outline and `rayos` behind; warm colours replace phase 4's cold
  ones in `juego.js` too), phase 6 «la de vidrio» (`vidria`: the dark body
  pixels become a stained-glass window — 6 px pieces, lead between them, a
  light outline —, `roseton` behind, `roseta` where phase 5 had a small
  sun; it quantizes with `JOYAS`, `PLOMO` and `BORDE_VITRAL` added, and
  pixels drawn exactly in `PLOMO` stay lead; the Sol has its own
  `solDeVidrio`). No tint, no shared aura. Each boss gets one
  ability in phase 2, a second in phase 3, a third in phase 4, a fourth
  in phase 5 and a fifth in phase 6, keeping the earlier ones (`ESPECIALES`, `ESPECIALES4`,
  `ESPECIALES5`, `ESPECIALES6`, `siguienteEspecial`, `jefe.cdEsp`: 10 s / 7.5 s / 6.5 s /
  6 s / 5.5 s; phase 3 alternates, phases 4 to 6 rotate starting with the newest;
  names and card epithets in `R.FASES`; the ability is announced as
  «✦ name»). Phase 6: Nodriza Muda (a glass copy of her stays and fires its
  own fans; shots break it and it pays `V`), Faro Caleidoscopio (six beams
  from the lens to fixed points on the water; a subset lights each click,
  marked dotted first; wrecks cut them), Esfinge Esquirlas (shards stuck in
  the water, one always where you are; touching one is a hit), Casco
  Botellas (they land, drift towards you and burst; the reach is marked),
  Crisálida Vidriera (rows of glass with a two-pane gap fall; a pane over
  you when a row lands is a hit; shots break panes recording nothing),
  Hoguera Colada (a molten-glass pour that chases you slower than the oars;
  a wreck catches it and burns), Luna Agua de vidrio (`jefe.aguaVidrio`:
  oar grip ×0.14 in `actualizaFanal`, the boat slides), Siete Hermanas
  Celosía (rows of `vidrio` escamas offset diagonally, so the gaps make
  slanted corridors) and Sol Lupa (a focus that chases you; inside it
  `F.calor` rises, under a wreck it doesn't; the Canícula's cooling skips
  while `jefe.lupa`). Phase 5: Nodriza Abrazo (white moths that perch on the lantern
  and slow the oars; rowing hard shakes them off, five put the flame out),
  Faro Prisma (slow lights; a shot splits one into three fast splinters),
  Esfinge Acertijo (shows three or four shores in order, then strikes all
  but one in that order), Casco Escora (everything tilts: the boat slides,
  shots and scales bend), Crisálida Compás (silk rows with one gap on each
  bar downbeat, via `alPulso` → `compasPulso`), Hoguera Yesca (sets wrecks
  on fire: no shelter under them), Luna Rayo de luna (a fixed beam under
  her), Siete Hermanas Aurora (curtains crossing the water), Sol Amanecer
  (rises from the horizon; wrecks cast long shadows and the glass heats in
  the sun, `F.calor` like the Canícula). Phase 4: Nodriza Reclamo (a marching block of
  larvas), Faro Deslumbre (stand in a shadow strip), Esfinge Tu sombra
  (your mirrored shadow answers every shot), Casco Bala rasa (balls
  skipping across the water), Crisálida Mortaja (you are wrapped: shots
  cut silk), Hoguera Cerco (fire closes in from both shores), Luna
  Horizonte (the boat wraps around the edges), Siete Hermanas Ronda (they
  come down and surround you), Sol Ocaso (it sinks; hits push it back).
  **`VIDA_FASE[4]` equals `VIDA_FASE[3]` on purpose**: boss life is part
  of the proof, so a third-lap game verifies the same with the old motor.
  Phases 2 and 3: Nodriza Nidada / Polvo suspendido, Faro
  Balizas / Giro entero, Esfinge Espejismo / Laberinto, Casco Cadena /
  Fuego fatuo, Crisálida Capullo de seda / Telar, Hoguera Tizones / Honda,
  Luna Luna llena / Resaca de luz, Siete Hermanas Alineación / Supernova,
  Sol Canícula / Colapso. They are described in the comment block «Las
  fases 2 y 3» in `juego.js`. **They fit the proof as it is**: eggs are
  larvas (`O`), balizas, the fatuo and thrown lanterns pay like orbiters
  (`V`, `pagaOrbita`), and anything else a shot breaks (silk, the net,
  mirages) records no event, hit, points or note. A hit may never take
  more than the bullet's damage (`hiereJefe`): the verifier bounds each
  `X` by it. `__fanal.especial(2|3|4|5|6)` forces the ability. The phase-4
  ones fit too: Reclamo moths are larvas (`O`), Ocaso is held with plain
  `X` hits, and a shot fired inside the Mortaja is recorded as a shot that
  hit nothing. So do phase 5's: Abrazo moths are larvas (`O`), Prisma
  lights are escamas, the rest cannot be shot; `VIDA_FASE[5]` is phase 3's
  too. And phase 6's: breaking the Muda is `V` (any boss in phase ≥ 3), a
  Vidriera pane records nothing (`golpeaFase6`), the rest cannot be shot;
  `VIDA_FASE[6]` is phase 3's as well. `musica.js` gives phase 6 (`FASE_MUSICA_MAX` is now 7, see above) a glass bell on every eighth and the
  melody two octaves up, and the tempo +20 %, still under `EPM_TECHO`.

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
  analyser on the output). **The music gets more energetic with the boss
  phase** (`est.fase`, set by `iniciaJornada`; `faseMusical`,
  `energiaDeFase`): more percussion (a kick on every pulse from phase 2,
  16th hats and a clap from 3, double kick and a fill every fourth bar from
  4, a galloping kick in 5), an arpeggio layer from phase 3 (16ths in 5),
  octave/fifth doubling of the melody in 4 and 5, a brighter bass, and the
  tempo +4 % per phase (`epmDeFase`), capped at `EPM_TECHO` (560 eighths
  per minute) so the shortest pulse stays ≥ 0.214 s, above the proof's
  0.2 s «pulsos juntos» window.
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
- **Categories**: `club-fanal-travesia` (points, capped at 1 000 000 000 —
  it was 1 000 000 until oct. 2026: long runs passed it (the test robot
  has 4.7 M at jornada 112), the
  table filled with ties at the cap, a tie only enters with a shorter time
  and longer runs take longer, so nothing new was saved; the verifier still
  accepts an exact 1 000 000 from a cached game when the proof is above it,
  `TOPE_VIEJO`; coins stay capped at 1 000 000 points) and
  `club-fanal-jornadas` (the furthest jornada completed: 8 is the Alba, 14
  the Hoguera, 20 the Sol). `club-fanal-sinfin` only keeps the marks from
  before proof version 4 (shown as «Sin fin (hasta oct. 2026)»; the rules
  still accept it, so they needed no change). `jornadas` is only sent when it
  improves, because every result counts as a club play and pays coins —
  improves **the cloud row** (`mejoraJornada`, from `club-tabla`; same jornada
  with less time also counts), not the local record: a local best raised by
  a run the cloud never stored (rejected, too big before v5) used to block
  every later honest run below it. Guests and offline fall back to local.
  **The top is the jornadas table** (since oct. 2026): the game's own panel
  (`Club.category("club-fanal-jornadas")`, «jornada N» in `conexion.js`) and
  the first option in the Clasificación (`ranks.js`). Ties go to the shorter
  time, as in every club table. Points still have their own table
  (Travesía). The champion frame already went to the n.º 1 of *any* FANAL
  table (`campeones`), so it did not change.
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
  any change to it must bump `club-N` in `solo/club.js`. **A long proof
  travels packed as version 5** (`FP.ajusta` → `empaca`: `J` as LZW text in
  `Z`/`zl`, ~8× smaller) once it passes `EMPACA_DESDE` (150 000 chars),
  because everything that stores a proof caps it at 200 000 and runs past
  ~90 jornadas no longer fitted. `rehace` reads both through `jornadasDe`;
  anything new that reads a proof's jornadas must use it too, never
  `prueba.J` directly. The saved travesía packs its `pr` the same way
  (`prDelPunto`, cached per jornada; `pruebaGuardada` unpacks it, since
  `P.prueba` keeps appending).

**Guest destacado.** Playable without an account; a guest's score is saved
if they sign in afterwards, and the game adopts what it left under the
`invitado` account through `Club.deInvitado` (`docs/claude/juegos/salon.md`).
Its proof may carry `u: "invitado"` for any owner (`DE_INVITADO`).
