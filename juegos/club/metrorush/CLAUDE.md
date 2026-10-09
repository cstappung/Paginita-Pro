# Metro Rush — notes for Claude

Solo Club game of Juegos. Shared club rules (anti-cheat proof, castigo, modo celular) are in `juegos/club/CLAUDE.md`; logros/coins/ranking/champion-frame wiring in `docs/claude/juegos/perfiles-y-economia.md`; music and volume in `juegos/audio/CLAUDE.md`.

**Metro Rush (`juegos/club/metrorush/`) is a Solo Club endless runner in
3D**, in the vein of Subway Surfers: three lanes, trains, low and high
barriers, ramps up onto the roofs, coins, power-ups, a multiplier and an
inspector with his dog who catch you after two stumbles. Plain files, no
build (`?v=metrorush-N` on its scripts, its stylesheet and the
`modulepreload`s, `club-N` in `solo/club.js` for the iframe). Three.js r160
comes from jsDelivr through an import map, the same URL Yemas uses, so the
browser cache shares it. Five files: `motor.js` (UMD `MetroRushMotor`, pure:
the track generator, physics constants, scoring, stations, story, shop,
missions and the progress merge, tested by `tests/metrorush-motor.test.cjs`),
`mundo.js` (the 3D world, an ES module), `audio.js` (music and synthesised
effects), `juego.js` (the loop, input, HUD and menus) and `estilo.css`.
Things that matter:

- **The track is generated so it can always be run.** `crearGenerador(seed)`
  walks a "camino", a lane that moves at most one lane per row, and never
  blocks it; every obstacle reserves its lane up to where it ends
  (`libre[c]`), so two things never overlap. Blocks are a row, a convoy (a
  ramp plus two to four cars with coins on the roofs), a breather (zigzag
  coins) and the tunnel. Moving trains (11 m/s) only start moving `APARECE`
  (170 m) before they arrive, which keeps their reservations short, but
  they must wait **out of view**: with 120 m they waited stopped 156 m
  away at top speed, inside the 195 m that is drawn, looked parked, and
  nobody noticed that trains came head-on. The test runs a simulated player
  over 12 seeds × 12 km and checks it never meets an unavoidable obstacle.
- **Speed is also felt, never faked**: the FOV widens and the camera
  closes in with `k = (V − V0)/(VMAX − V0)` from `M.VELOCIDAD` (never a
  hardcoded range), with speed lines; the jetpack adds a FOV kick, harder
  flames, light shake and a roar in `audio.js`, and while flying the camera
  does not close in (sky coins next to it are shrunk). Oncoming trains wear
  headlights and blow a horn. None of it touches distance or score, which
  the anti-cheat recomputes; the music tempo follows the same `k`.
- **The catenary is high on purpose** (`ALTO_CABLE` 7.8 m, `ALTO_BRAZO`
  8.3, `ALTO_POSTE` 8.6 in `mundo.js`): standing on a roof the head is at
  5.05 m and a jump from there reaches 6.55, and the roof camera sits at 7.2
  (7.9 in portrait). At 5.4 m the runner went through the wires as soon as
  it climbed a car. The arm stays just under the jetpack's 8.5 m.
- **What the runner stands on and what hits it is pure** (`M.soporte`,
  `M.caja`, in `motor.js`; `juego.js` only calls them). The rule: a roof
  holds you over the whole stretch in which its car can hit you, so
  `MARGEN_TECHO` (0.4 m) is larger than `MEDIO_LARGO` (0.3 m, how far the
  runner reaches ahead for collisions). With 0.2 there was a 10 cm gap at
  the top of every ramp where the car already hit and the roof did not hold
  yet, and climbing a ramp killed you from a third to nearly all of the time
  depending on the frame rate. At the top of a ramp the roof counts the
  ramp's height, and the ramp is followed between the previous frame's D
  and this one (`c.Dantes`), because a 50 ms frame at full speed is 1.5 m of
  track. `tests/metrorush-motor.test.cjs` climbs it at 20–144 fps and every
  speed, and checks that a car's front, a low jump into it and a side entry
  under a ramp still crash. The same rule holds **sideways**: a roof holds
  you while you are within `ANCHO_TECHO` (0.98 m + the runner's half width)
  of its lane centre, i.e. exactly as far as its car can hit you. It used to
  hold only within 1.05 m while the car hit up to 1.33 m, so zigzagging from
  roof to roof dropped the runner off the edge mid-change and it died
  against the very car it had just left.
- **The distance decides the scenery** (it used to be the score, so a
  player at ×30 went through every station thirty times faster than a
  newcomer). `ESTACIONES[].desde` is in metres: Barrio Estación (0,
  toy-like), Ocaso (1 500 m, pixel), Línea Neón (3 500, neon), Estación
  Fantasma (6 000), Invierno (9 000), Óxido (12 500) and Fin de la Línea
  (17 000); from 21 km the first three come back every 4 km as «vuelta N».
  With the speed ramp that is ~1:15, 2:40, 4:00, 5:10, 6:10 and 7:40 of
  running, and the test checks none comes before the first minute or less
  than 50 s after the previous one. A station changes **inside a tunnel**
  (150 m, coins only), where nothing outside is visible: `juego.js` swaps
  the kit, the music and the HUD skin at `d0 + 40`. The track is already
  generated ~230 m ahead, so the tunnel is requested *before* the
  threshold, as soon as fewer than 220 m are left (`estaciones()`), and it
  lands right on it. The options can lock one style (`estacionVisual`).
- **The numbers are tuned for the «million points»**: 10 points per metre
  times the multiplier. The base multiplier goes ×1 → ×30 by completing
  missions (three per level, `retosDeNivel(nivel)`, seeded); each star picked
  up adds +1 for the run (up to +29) and the 2× power-up doubles the lot.
  Speed is a **linear ramp with a cap**: 15 m/s, +0.1 m/s every second, 50
  m/s from 350 s on (~11.4 km; it was 13→30 approaching a ceiling and felt
  slow). A ceiling-approaching curve could only reach 50 by being 31 m/s at
  the first minute; the ramp keeps the start (21 m/s at 1 min) and makes 50
  the prize of a long run, after the obstacle density peaks (~7.7 km). The
  curve lives once, in `M.VELOCIDAD`: `velocidad`, the anti-cheat's
  `metrosEntre` (exact: d = V0·t + a·t²/2) and the generator's `velocidadEn`
  (exact too: v² = V0² + 2·a·d) all come from it, so changing the speed is
  one edit, plus the proof's `VERSION` because old proofs no longer replay.
  Two things scale with it: rows never come closer than `FILA_MIN_S` (0.55
  s) apart, which only matters above ~33 m/s, and the skid the anti-cheat
  allows when the inspector catches you is VMAX²/(2·`FRENADA`) + 2 m (a
  fixed 12 m rejected honest runs caught at 50 m/s). A newcomer makes
  ~25 k in two minutes, a great run reaches 1 M in 6–7 minutes, and a
  veteran at ×30 in about three.
- **Progress is Subway Surfers' own loop.** Missions come in sets of three
  (`retosDeNivel`); a completed set raises the base multiplier by one (up to
  ×30) and pays `premioSet(n)` coins, and a mission can be **skipped** for
  `costoSaltar(n)` coins (`saltaReto`; skipping the last one completes the
  set on the spot). Skipping is refused during a paused run: the run in
  progress would then be applied to the next set's missions. The yellow
  multiplier card on the title screen shows the set's progress and opens the
  missions. **Boosters** (`POTENCIADORES`: *Despegue*, start flying with the
  jetpack for 7 s; *Potenciador +5*, +5 to the multiplier for the run) are
  bought in the shop, kept in `progreso.potenciadores`, and offered by two
  HUD buttons (keys 1 and 2) during the first 6 s of a run.
- **Power-ups**: magnet 10 s, jetpack 5 s (coins in the sky at 8.5 m;
  short and frantic, +1 s per level, up to 10), super sneakers 10 s (jumps
  4.1 m), 2× 12 s, the others +2.5 s per shop level (five levels; a power's
  own `paso` overrides it); mystery box (coins, a skateboard, the **pogo
  stick** or a jackpot); skateboard
  (3 000 coins, 30 s, survives one crash); continue after a crash for
  500 × 2^k coins, offered for 5 s by a round «¿Seguir corriendo?»
  button before the summary (`abreSalvar`), as in Subway Surfers. The
  run is closed when the summary shows (`cierraCarrera` returns what it
  paints), so a completed set and its prize appear there. A frontal hit ends the run, a side hit is a stumble, and
  a second stumble within 8 s gets you caught.
- **A stale game in cache is not cheating.** PR #135 raised the proof to
  VERSION 2 without bumping the iframe's `?v=club-N`, so browsers kept the
  old `index.html` (old engine, VERSION 1 proofs) while the page verified
  with the new one, and honest players got the castigo. `esTrampa` now
  skips any «otra versión» rejection (it is still rejected, not punished),
  and **any change to a club game's proof must bump `club-N` in
  `solo/club.js`**.
- **The pogo stick only comes out of the mystery box** (`lanzaPogo`,
  `c.pogo`), never from the track generator, so the track still depends on
  the seed alone and proofs did not change. It launches to `alturaPogo`
  (7 m) and falls at `gravedadPogo` (40 %) of gravity, ~2.3 s airborne;
  above 3.6 m (over the roofs) nothing hits you, the climb to there is
  covered by 0.45 s of invulnerability, rolling drops it, and landing ends
  it. It only changes height, so distance and score are untouched. The
  model hangs off the runner (`pogo`, `resorte`, pose `'pogo'`) and lifts
  it 0.55 m so the rubber foot touches the ground. The **super mystery box**
  is bought in the shop (`PRECIO_SUPERCAJA` 9 000, `cajaSuper`) and opened
  on the spot; its loose coins average ~3 500, less than its price, so it
  cannot mint coins.
- **Lore and secrets**: seven golden tickets, one per station, tell the
  story of the last night of Line 3 (`BOLETOS`, read in the Libreta);
  collecting all seven unlocks the Inspector outfit, the Konami code the
  golden one, and a ghost train crosses the sky in Estación Fantasma.
- **The world is built to run on a phone, and the cost is draw calls.**
  Every prop is merged per material with vertex colours (`Arma`), pooled
  (`kit.saca`/`guarda`), and coins and sleepers are `InstancedMesh`es;
  scrolling is texture offsets. Measuring with `desglose()` found ~470
  visible meshes in `baja`, and four changes took it to ~170:
  buildings come in **blocks** of two or three (`edificio` → `unEdificio`,
  one awning colour per block, shop signs in **one atlas** texture through
  `franja`), so a block costs what one building did; trees, lamps and
  catenary posts are **instanced** (`Serie`, written every frame like the
  coins; in neon, where edge lines and halo sprites cannot be instanced,
  the instanced pole is a glowing tube instead, `farol(lado, true)`);
  the 49 cloud puffs are one mesh; and the pixel style in `baja` skips its
  pass (which draws the scene twice, once for the edges) and renders at
  pixel resolution instead (`proporcion`). **A station's kit is freed** when
  the next one takes over (`liberaKits` → `Kit.libera`, keeping the active
  one and the one being preloaded): each used to stay on the GPU, four by
  Óxido. The runner rebuilt for each kit or outfit frees its geometry too
  (`suelta3D`).
  Each station palette builds its own kit, prepared a few steps per frame
  ahead of time (`precarga`, 4 ms budget) and compiled inside the tunnel, so
  the switch does not stutter. Quality `alta`/`media`/`baja` sets pixel
  ratio (`dpr` 3 / 2.5 / 2, never more than the device's: at 1.5 / 1 / 0.8 a
  3× phone drew a third of its resolution and the game looked blurred;
  anti-aliasing is MSAA on the composer's target, 4 samples, only below 2×,
  never FXAA, which blurred the whole frame; no chromatic aberration; line
  widths are in CSS pixels, `mundo.resolucion` = CSS size, or a 2.2 px neon
  edge was 0.7 px on a 3× phone), shadows, ambient occlusion (toy style only), bloom and the neon
  mirror floor; `baja` also shortens the view to 125 m with the fog closer
  (`vista`), which is what saves draw calls. In «auto» it steps down by
  itself when frames average over 28 ms. **Every geometry must carry
  normals**: SAO (high quality, toy style) redraws every mesh with a normals
  material, a geometry without them gives NaN, and bloom spreads that NaN
  into black blocks (that is what the oncoming trains' headlights did).
  Points get constant up normals (`normalesFijas`). Two nets catch the rest:
  the GTAO pass's `overrideVisibility` is replaced so its normals pass hides
  sprites, `LineSegments2`/`Line2` and **anything whose geometry has no
  `normal` attribute** (stock GTAO only hides points and lines, and the
  jetpack's glow sprite drew a black square on the backpack), and a
  `SIN_NAN` pass right before bloom (WebGL2 only, `isnan`/`isinf`) turns a
  stray NaN into one black pixel instead of a square. The **pixel style** is
  `FILAS_PIXEL` (420) rows tall, not 270, which read as coarse; with the
  post-processing pass it renders at least at 2× so a 1× screen still fits
  420 rows (the pass needs pixels of 2 or more), and in `baja` the canvas
  itself is ~420 rows, upscaled without smoothing.
- **What you play against must read before the scenery** (`legible` in each
  palette, `realza()` in `mundo.js`). Trains, barriers, ramps, power-ups,
  stars and tickets use material keys ending in `!` (`'pintura!'`); those
  get light of their own in their own colour and a delayed fog, so they
  stand out from the city and are seen from further away, without adding a
  single light or draw call. Neón used to darken them with the city (black
  trains with an outline, a black hole for a ramp) and Estación Fantasma
  painted its trains the same green as the buildings: now Fantasma's trains
  are pale (mint, ice, lilac) with dark windows, and Óxido's are patina
  rather than an orange the fog swallowed. A new prop that you must dodge
  or pick up needs the `!`.
- **Music is one chip theme per station** (`metrorush-*` in `temas.js`, all
  original), its tempo rising with speed (×0.92 → ×1.15). Effects are
  synthesised in `audio.js`, everything goes through `destination`, so
  `volumen.js` governs it; coins climb a semitone per coin in a streak.
- **The menus are dressed like Subway Surfers' home screen**: the logo top
  left (two layers of the same text: a thick navy stroke underneath and a
  gradient fill in an `::after` on top; with the outline in a negative
  z-index `::before` the background clipped to the text painted first and was
  covered), counters top right, «¡Toca para correr!» (any empty spot of the
  title screen starts too) and a bottom bar of four chunky buttons with
  badges. Everything is sized in `--m` (1 % of the stage's height or 0.9 % of
  its width, whichever is smaller); `--mt` floors it at 4.6 px for what a
  finger touches, and the shop floors its own `--m`, or a vertical phone got
  7 px text. Icons are drawn SVG (`ICONOS` in `juego.js`, filled into
  `[data-icono]`), never emoji. **On the menus the camera moves in front of
  the runner**, who turns round and waves (`e.menu` → pose `menu`), so the
  runner has a face it never shows while running; in the shop's
  *Personajes* tab the camera shifts it aside and it tries on whatever outfit
  is tapped, and leaving the shop (`saleTienda`) puts back what it really
  wears. Two class names were already taken by the HUD (`.moneda`, `.mult`):
  the pills are `.oro` and `.base`.
- **The first two runs teach the moves** (`pistas` in `juego.js`): when a
  barrier or a train comes down your lane, a big hint says what to do 1.6 s
  ahead (where to swipe on a phone, which key on a PC), at most twice per
  kind and run, and goes once the obstacle is behind you or you changed
  lane. Nothing slows down, unlike Subway Surfers' tutorial.
- **Mobile**: swipes (26 px) and a double tap for the skateboard; a
  portrait screen gets a 3:4 stage and the camera moves back
  (`ajusteRetrato`). Controllers go through `mando.js`.
- **Anti-cheat: every run carries a proof** (`prueba.js`, UMD
  `MetroRushPrueba`, shared by the game and `solo/verifica/metrorush.js`;
  `docs/antitrampas/metrorush.md`). It is not a frame-by-frame replay: it
  holds the track seed, the base multiplier and 2× level at the start, the
  requests the game made to the generator (tunnel, ticket, jetpack coin
  ribbon) with the exact `dSig` they were made at, the events that change
  the score (star and 2× pickups with the object's id, 2× end, +5, crash,
  continue) and a distance/clock sample every 2 s. `rehace` regenerates the
  track, checks each pickup exists where it was taken, the metres against
  the speed integral (`metrosEntre`), game time against real time, and
  recomputes the exact score (10 × multiplier × metres, segment by
  segment). That needed **the track to depend only on the seed**: oncoming
  trains used the speed of the frame that generated their block, which
  moved the free lanes and everything after; now `velocidadEn(d)` derives
  it from distance. A run touched with the gameplay hooks of
  `__metrorush` (`puntos`, `pulsa`, `poder`, `inmortal`, `logica`,
  `avanza`) or with synthetic key events is played but not sent, and the
  game self-checks with `rehace` before sending, so a bug of its own never
  reaches the club as a «trampa» (which would trigger the castigo). A crash
  ends the frame (no pickups or power timers after it in that frame), and a
  run closed from the pause gets its crash event, for the same reason.
- **Categories**: `club-metrorush-carrera` (points of the run, sent at the end
  of every run, capped at 1e9) and `club-metrorush-distancia` (metres, only
  when it improves). Progress (coins, upgrades, outfits, tickets, mission
  level, records) is one blob in `users/<uid>/club/metrorush` merged with
  `mezclaProgreso`. **That node is `{d, at}` and the reply is that object**,
  not the string: the game used to `JSON.parse` the whole object, which
  always threw and was swallowed, so the cloud copy was never read and a
  second browser started from zero (then overwrote the cloud). Now
  `progresoDeNube` reads `d`, nothing is uploaded until the cloud has been
  read (`nubeLeida`, a save before that waits in `subirLuego`), and an
  empty reply is asked once more before trusting it. `mezclaProgreso` also
  spots a copy that **started from scratch** (the older one has every
  lifetime `totales` ≥ and one >): its newer timestamp no longer wins the
  coins, skateboards and boosters, the max of each does, which recovers a
  balance an earlier overwrite had wiped from the cloud. Logros, coins, the `tmetrorush` champion frame, the
  Discord podium and the manual are wired like FANAL's; the `soloRanks` and
  `clubJugadas` regexes were widened, so the rules must be re-published.
- `window.__metrorush` (`estado()`, `puntos(n)`, `inmortal()`, `poder(k)`,
  `avanza(seg)`, `calidad(n)`, `logica(n)`…) drives a run from a script;
  `avanza` steps the game without drawing, which is how every station was
  visited in Chromium (any hook that changes the run makes it a test run
  that is not sent; `estado`, `prueba`, `calidad` and `desglose` only read),
  and `estado().info` reports draw calls, triangles,
  geometries and textures. Those counts are for the **whole frame**:
  `renderer.info.autoReset` is off and `dibuja()` resets it once, because
  with post-processing every pass reset it and the reading was always 1.
