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
- **The catenary is high on purpose** (`ALTO_CABLE` 11.2 m, `ALTO_BRAZO`
  11.7, `ALTO_POSTE` 12.0 in `mundo.js`): the top of the head is 1.8 m over
  the feet, so a sneakers jump from a roof reaches ~9.7 m, the jetpack's
  head ~10.4 and the pogo's ~10.8 (it rides 0.55 m higher). At 7.8 m all
  three went through the wires once the jump became Subway Surfers' 2.1 m.
  `tests/metrorush-salto.test.cjs` reads those constants out of `mundo.js`
  and checks the clearances; the tunnel portals carry a concrete pediment
  up to 12.4 m so the wires still disappear into them.
- **The jump is Subway Surfers'** (`FISICA`: gravity 26, `alturaSalto` 2.1
  m, ~0.8 s in the air; sneakers 4.4): the high barrier (1.0–2.35 m) still
  has to be rolled under, a normal jump still cannot reach a roof (ramps),
  and the camera height (`yC` in `paso`) is one continuous formula, the
  largest of «0.75 of the floor + 0.4 of the jump», «never more than 2 m
  below the runner» (plus a lead while the pogo rises) and, with the
  jetpack, «1.2 m below»: the old three-piece one jerked at y = 1 mid-jump.
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
  newcomer). `ESTACIONES[].desde` is in metres, ten stations: Barrio
  Estación (0, toy-like), Ocaso (1 200, comic), Mercado de Farolillos
  (2 550, toy), Línea Neón (4 200, neon), Estación Fantasma (6 150),
  Cocheras (8 400, comic), Invierno (10 950), Muelle (13 700, neon), Óxido
  (16 450, comic) and Fin de la Línea (19 200); from 23.2 km barrio, ocaso and neon
  come back every 4 km as «vuelta N» (`VUELTA_IDS`). With the speed ramp
  that is one every ~55 s from 1:06 to 8:27, and the test checks none comes
  before the first minute or less than 50 s after the previous one. Moving
  thresholds does not change any track: tunnels are requests in the proof. A station changes **inside a tunnel**
  (150 m, coins only), where nothing outside is visible: `juego.js` swaps
  the kit, the music and the HUD skin at `d0 + 40`. The track is already
  generated ~230 m ahead, so the tunnel is requested *before* the
  threshold, as soon as fewer than 220 m are left (`estaciones()`), and it
  lands right on it. The options can lock one style (`estacionVisual`).
- **The numbers are tuned for the «million points»**: 10 points per metre
  times the multiplier. The base multiplier goes ×1 → ×30 by completing
  missions (three per level, `retosDeNivel(nivel)`, seeded); each star picked
  up adds +1 for the run (up to +29) and the 2× power-up doubles the lot.
  Speed is a **linear ramp with a cap**: 15 m/s, +0.1 m/s every second, 60
  m/s from 450 s on (~16.9 km; City: 16 → 60 at +0.11). The cap was 50
  (46 in City) until proof version 3: `VELOCIDAD_V2` and `VERSIONES = [2,
  3]` keep version-2 proofs replaying with their old curve and track, which
  are identical to the new ones up to the old cap, so an honest old run
  never turns into a cheat. A ceiling-approaching curve could only reach
  the cap by being 31 m/s at the first minute; the ramp keeps the start
  (21 m/s at 1 min) and makes the top speed the prize of a long run. The
  curve lives once, in `M.VELOCIDAD`: `velocidad`, the anti-cheat's
  `metrosEntre` (exact: d = V0·t + a·t²/2) and the generator's `velocidadEn`
  (exact too: v² = V0² + 2·a·d) all come from it, so changing the speed is
  one edit, plus the proof's `VERSION` because old proofs no longer replay.
  Two things scale with it: rows never come closer than `FILA_MIN_S` (0.55
  s) apart, which only matters above ~33 m/s, and the skid the anti-cheat
  allows when the inspector catches you is VMAX²/(2·`FRENADA`) + 2 m (a
  fixed 12 m rejected honest runs caught at top speed). The coin arc over a
  low barrier is drawn on the jump's own parabola at that metre's speed
  (`arcoMonedas`), and `recoge` checks what the runner crossed during the
  frame (feet height interpolated), not only where it ended:
  `tests/metrorush-arco.test.cjs` jumps every arc at 20–144 fps. A newcomer makes
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
  4.4 m), 2× 12 s, the others +2.5 s per shop level (five levels; a power's
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
  the seed alone and proofs did not change. Its flight is `M.vueloPogo(y)`:
  up to `alturaPogo` (8.3 m, at least `subidaPogo` 3 m from a roof),
  falling at `gravedadPogo` (40 %) of gravity, ~2.5 s airborne. Nothing
  hits you on the way up or above 3.6 m (over the roofs); the last stretch
  down collides as usual, so you steer away or land on a roof (being
  invincible to the ground would let it land *inside* a train). It is not
  launched if a tunnel falls within the flight (its ceiling is 6.6 m: the
  box gives coins instead). While it flies, `M.monedasPogo` lays an arc of
  15 coins per lane where the flight is over the roofs: pure arithmetic,
  no RNG, not from the generator and worth no points, so the prueba does
  not need to know (`metrorush-salto.test.cjs` checks the track of a seed
  is unchanged). The model hangs off the runner (`pogo`, `resorte`, pose
  `'pogo'`) and lifts it 0.55 m so the rubber foot touches the ground; the
  pose squashes the spring on launch and does a full turn at the apex,
  driven by `vy` (not the clock) so it lands on the apex from a roof too. The **super mystery box**
  is bought in the shop (`PRECIO_SUPERCAJA` 9 000, `cajaSuper`) and opened
  on the spot; its loose coins average ~3 500, less than its price, so it
  cannot mint coins.
- **The chase is loud and visible, and none of it is game state**
  (`persecucion`/`c.pers` in `juego.js`, `pasoPersecucion` in `mundo.js`,
  `ladrido`/`alto`/`silbato`/`atrapado` in `audio.js`). The first stumble
  makes Don Ramón shout «¡Alto!» (formant-synthesised voice plus a police
  whistle), raise a gold badge with a comic bubble over his head, and the
  dog barks every second or so while the 8 s window lasts, with a red
  pulsing border (`.mr-peligro`). Both run on the runner's own floor (on
  the roofs too: below, a train hid them, bubble and all) and come closer
  and faster after a stumble. On the catch the dog leaps in an arc onto the
  fallen runner's chest (`ATERRIZA_PERRO`, 0.45 s, the same constant in
  both files, with a camera shake there) and the inspector bows beside him
  with «¡TE PILLÉ!». The bubbles are planes with a canvas texture (normals
  for SAO), built once and not freed with the kits. `__metrorush.tropieza()`
  and `__metrorush.pogo()` trigger both from a script (test runs).
- **The female runners** (`paloma`, `trini`, `luz`, `maite`, `kiara` in
  `ASPECTOS`; five against five male, counting the two secret ones, and
  `metrorush-salto.test.cjs` keeps it even) carry `rasgos` (hair colour,
  optional `piel`, `peinado` coleta / trenzas / larga / monos / afro,
  `tocado` cintillo / boina, `falda`, `lentes`, `aros`):
  `armaRasgos` in `mundo.js` replaces the cap with hair and adds the
  silhouette, `mueveRasgos` (called at the end of `posa`) swings ponytail,
  braids, long hair and skirt. Hanging hair rotates *negative* x to go
  backwards (the face looks to −z). Their shop thumbnail is an SVG
  (`muestraRasgos` in `juego.js`), since what tells them apart is the hair.
- **The male runners are not palette swaps either** (`identidad` in
  `ASPECTOS` for `clasico`, `nocturno`, `grafitero`, `dorado`,
  `inspector`; kept apart from `rasgos` so the «five and five» test still
  counts girls by `rasgos`). Each has its own head piece and one more thing
  (`armaIdentidad` in `mundo.js`): Tomás (`clasico`) a cap and headphones,
  Benja (`nocturno`) a hood and reflective knee bands, Nacho (`grafitero`) a
  bandana, paint stains and a spray can on the back, Mateo (`dorado`) a
  crown, sunglasses, a chain and a cape, and Don Ramón (`inspector`) a kepi,
  a moustache and a long coat. Only the `nombre` changed: the ids stay,
  because they are saved in every player's progress. The cape is returned
  in `cuelgan`, so `mueveRasgos` sways it like the girls' hair; Dorado's
  hair is dark brown because gold hair vanished under the crown. The
  default cap is only drawn when an aspect has neither `rasgos` nor
  `identidad`, and the shop thumbnail is `muestraIdentidad`.
- **Lore and secrets**: ten golden tickets, one per station, tell the
  story of the last night of Line 3 (`BOLETOS`, read in the Libreta).
  **A ticket's number is its name, not its order**: 1–7 are the original
  ones (already saved by players) and the three new stations got 8–10;
  `capituloDe(n)` gives the route order the Libreta and the pickup banner
  show («Boleto 3 de 10»). Collecting all of them unlocks the Inspector
  outfit (whoever already had it keeps it), the Konami code the golden one,
  and a ghost train crosses the sky in Estación Fantasma.
- **The story is also told while running, without stopping anything**
  (`historia.js`, UMD `MetroRushHistoria`, pure data; `escenarios.js`, the
  Three side). Posters on the pavement (`AFICHES` per palette: company
  notices, «se busca» portraits of Don Ramón, Marta and Tornillo, local ads
  and a line map with «usted está aquí») are cells of **one atlas texture**
  and take the place of graffiti slots (`decoraMuro`), so they add no draw
  calls; the same goes for the story graffiti (`LORE`). The **altavoz**
  (`#altavoz`, an amber strip at the top, `ANUNCIOS` per station) speaks
  with a synthesised ding-dong (`sonido.dingDong()`) followed by a
  **recorded voice** (`assets/voz/<station>-<proxima|eco>.mp3`, ~700 kB in
  all, played by `audio.js`'s `anuncio`, which ducks the music) when the
  tunnel to a station starts, where there is nothing to dodge, and once
  more halfway through the station (`altavoz()` in `juego.js`) only when
  no hint, banner or obstacle in your lane within 2.2 s competes with it.
  All of it is gated by `mundo.lore()`, on for the metro world only, so
  City gets none of it. The voice is rendered once by
  `colabtex/scripts/metrorush-voz.py` (Piper, voice `es-carlfm-x-low`,
  public domain, from Piper's GitHub release because huggingface was not
  reachable; then a platform-speaker chain: 300–3400 Hz, horn presence,
  slight saturation, a 70 ms wall echo and a concrete room). The text in
  `ANUNCIOS` is both what the strip shows and what was recorded: **change
  an announcement and re-run the script** (`DICCION` turns «317» into
  «tres diecisiete» for the voice only). `tests/metrorush-voz.test.cjs`
  checks one MP3 per announcement and that `textos.json` still matches.
  With a style locked in the options
  (`estacionVisual`) the posters are those of the locked palette.
- **The three new stations are their own scenery** (`escenarios.js`:
  `paletasNuevas`, `PROPS`, `cielo`, `ambiente`): Mercado (stalls, lantern
  strings, rising farolillos), Cocheras (bidones, spare rails, signals,
  sawtooth sheds and flood towers), Muelle (bollards, cargo, rain and far
  lightning, cranes and a lighthouse beam). `fin` is a copy of `alba`, so
  City's dawn stays clean. In cocheras, muelle and óxido the 317 crosses
  the horizon as a faint lit silhouette. Their props replace the trees
  (`arbol()` asks `ESC.prop` first) and keep the original order of random
  draws, so the other stations did not change. Music: `metrorush-mercado`,
  `-cocheras`, `-muelle` in `temas.js`, each heading its `LISTAS` entry.
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
  the 49 cloud puffs are one mesh. **A station's kit is freed** when
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
  stray NaN into one black pixel instead of a square. **The pixel style is
  gone; its stations are the comic style** (`BASE_COMIC` in `mundo.js`,
  `estilo: "comic"` for Ocaso, Cocheras, Óxido and City's Los Muelles).
  Pixel art at 400–800 rows never read well in motion (the owner gave up
  on it), so `PasadaPixel`, `ladoPixel`, `FILAS_PIXEL` and `medidasPixel`
  were removed. The comic look is flat, saturated colour plus a thick ink
  outline drawn by `PasadaTinta` (one extra full-screen pass that finds
  edges in the depth buffer; 2 px wide from a 1.5× pixel ratio, 1 px below), with its own
  palettes: Ocaso is the sunset, Óxido the rust, Cocheras a smoggy morning
  and Los Muelles a sunny sea noon. The HUD is skinned by
  `.pantalla[data-estilo="comic"]` in Bangers (a hard offset shadow, a
  tilted red multiplier, the loudspeaker as a speech bubble). Its score and
  coins are `7.4 × --u`, 12 % over the base because Bangers is narrow: an
  `em` there is relative to the 15 px parent and left them at half the size
  of the other styles. The option
  «Siempre cómic» locks it (`PALETA_FIJA.comic = 'ocaso'`), and a saved
  `estilo: 'pixel'` is migrated to `'comic'` when the options load.
  The short `.aviso` is centred with `left/right + margin:auto` (with
  `left:50%` it only got half the width and became a tall bubble on a
  phone), and in portrait it sits at `top: 21cqh`, over the sky: at the
  bottom it covered the energy bar and the «Salto doble» pill.
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
- **Music is a playlist per station** (`LISTAS` in `audio.js`: the
  station's own `metrorush-*` theme plus `-2`/`-3`, all original in
  `temas.js`), its tempo rising with speed (×0.92 → ×1.15). A theme gives
  way to the next one at the end of a loop (`Reproductor.vueltas`), after
  two loops and 50 s, or 110 s whatever the loops: `nuevoRep` wraps the
  player's `toca` so the cut lands exactly on that bar boundary and `rota`
  starts the next theme at that instant, inheriting tempo and layers. The
  position in each list survives pauses and runs. `tocaTema(id)` takes a
  station id, a Subway City district (`city-sur`, `city-muelles`,
  `city-bulevar`, `city-parque`, `city-bajo`, each with its own theme plus
  two borrowed station ones) or a theme key (`estacion.musica`, which
  brings its station's list). Effects are
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
  `modo(id)` picks the mode like a tap on its card and `objetos(m)` lists
  what is ahead (both read-only: neither makes the run a test run).
- **Modes are data** (`MODOS`/`ORDEN_MODOS` in `motor.js`), picked on the
  title screen (a row of cards above «¡Jugar!», remembered in
  `metrorush.opciones.modo`), shown as a badge in the HUD, and each has its
  own table:

  | id | name | table | items · boosters · skate · continue | coins kill | world |
  |---|---|---|---|---|---|
  | `clasico` | Clásico | `club-metrorush-carrera` (+ `-distancia`) | yes | no | metro |
  | `puro` | Sin ayudas | `club-metrorush-puro` (+ `-distancia`) | no | no | metro |
  | `sinmonedas` | Sin monedas | `club-metrorush-sinmonedas` | no | **yes** | metro |
  | `fantasma` | Fantasma | only `club-metrorush-distancia` | the ghost's | no | metro |
  | `city` | City | `club-metrorush-city` (+ `-citydistancia`) | yes | no | city |
  | `citypuro` | City sin ayudas | `club-metrorush-citypuro` (+ `-citydistancia`) | no | no | city |
  | `cityfantasma` | City fantasma | only `club-metrorush-citydistancia` | the ghost's | no | city |

  **Distance is one table per world** (`DISTANCIA` in `motor.js`:
  `club-metrorush-distancia` takes clásico, puro and fantasma;
  `-citydistancia` takes city, citypuro and cityfantasma). A normal run
  sends its points and, only when it beats the local distance record, its
  metres too; a fantasma run sends only metres. Local records follow the
  same split (`records.distancia` / `records.distanciaCity`,
  `campoDistancia`), and in a fantasma mode `recordDe`/`anotaRecord` are
  that distance. The old `-fantasma`/`-cityfantasma` points tables are no
  longer written (the rules still accept them). The verifier checks that a
  distance table only gets its world's modes and that a fantasma run goes
  nowhere else.

  The two **Fantasma** modes (`fantasma: true`) race the ghost of the #1 of
  their world's **distance** table, whichever mode set it (`juegos/club/metrorush/fantasma.js`, UMD
  `MetroRushFantasma`, pure; section «EL FANTASMA» in `juego.js` and
  `mundo.js`; `tests/metrorush-fantasma.test.cjs`). Things to keep:
  - **The trace** is recorded only in those modes, one sample per 0.1 s of
    game time: lane `x` (0.1 m), height `y` (0.15 m) and state (runs, up,
    down, rolls, stumbles), three letters each from a 64-letter alphabet,
    repeats merged (`.`, `~c`), version `1` first. It goes in the proof as
    `g` (`MP.ponFantasma`, capped at `MAX_FANTASMA` 60 000 chars; the whole
    proof at `PRUEBA_MAX`, 200 000, in `solo/verifica.js`). **It never
    scores**: `rehace` only rejects one it cannot read or that lasts longer
    than the run + 2 s, and if the game's own trace fails that,
    `cierraPrueba` sends the run without it. Proof `VERSION` did not change.
  - **Fetching**: `Club.pedirFantasma(cat, cb)` (`conexion.js`) →
    `fantasma-pedir` in `solo/club.js`, which takes row 1 of the table it
    is already watching (club order) and reads its proof **by key**
    (`soloPruebas/<cat>/<uid>/<partida>`), cached per visit for the
    download cap. Guests get `motivo: 'invitado'`, an empty table `vacia`
    (the portada says your run will be the first ghost). The frame runs it
    through `rehace` again (`F.prepara`); one that fails is not raced.
    «¡Jugar!» waits up to `ESPERA_FANTASMA` (8 s) for one on its way; past
    that the run starts alone, but a late answer still counts for the next.
  - **Same track**: the run uses the ghost's seed and replays its `T`/`B`
    requests at the same `dSig` (`generaPista`), claims them instead of
    making its own (`pideTunel`), and makes no boleto request of its own
    while the ghost was still running there (`pideBoleto`): boletos depend
    on each player's collection. The proof records them as its own, so it
    verifies like any run. A hook-fixed `semillaSiguiente` disables the ghost.
  - **The run plays by the ghost's rules.** `M.conReglas(modoFantasma,
    reglas)` builds a composite mode: the track, powers and multiplier of
    the mode the record came from, plus «fantasma». The proof carries `pm`
    (those rules) and `v` (track version 2 or 3, i.e. the 50/46 or the
    60 m/s cap), so `rehace` regenerates the same track. That is also why
    the race is **in metres**, never points: `MF.metrosEn(pasos, curva, t)`
    and `vivoEn` place the ghost, `#hudFan` shows the lead in metres, and
    the summary says who went further.
  - **Beating it is a logro** («Cazafantasmas», id `fan`), written live:
    `Club.logro('fan')` → `conexion.js` posts `{tipo:'logro'}` →
    `solo/club.js` → `fb.otorgarLogro('metrorush', uid, 'fan')` plus the
    toast. `metrorush` had to enter the rules' `logros` whitelist.
  - **A new #1 replaces the ghost at once**: when row 1 of the watched table
    changes, the page pushes an unsolicited `fantasma` message, `conexion.js`
    dispatches `club-fantasma`, and `juego.js` prepares that ghost instead
    of the cached one (the bug was racing the previous record right after
    breaking it).
  - Names only in the portada
    (`translate="no"`) and the 3D label, never in avisos/banners. The ghost
    is a translucent blue runner with no shadow, no collision and
    `userData.sinAO` (GTAO skips it); one without a trace still races (in
    metres) but is not drawn.

  `crearGenerador(seed, {modo})`: without a mode (or with `clasico`) the
  track is **byte-identical to before modes** (`metrorush-modos.test.cjs`
  pins five seeds' hashes taken from the old engine). Without `items` no
  power-ups or boxes are emitted (stars and tickets stay). With
  `monedasMatan` coins become obstacles, so they never go on the safe path
  (no arc over a low barrier, no roof rows, no rows under a high barrier):
  they close lanes that were already closed (half the barrier slots of a
  closed lane become a coin row), and respiro/tunnel ribbons run off the
  path; a simulated player that treats each coin as a wall always finds a
  way. It is meant to be a challenge, so coins also **fill the lanes that
  are open** (all only inside the `peligro` branches, so the classic track
  hash did not move): `pasillo` sows coin rows in the lanes a row leaves
  unused, convoys carry rows beside the wagons, closed lanes get a long row
  most of the time, and respiros and tunnels become a **zigzag**
  (`zigzag(d0, largo, seg)`): the safe lane moves every `seg` metres and
  the next lane opens G = max(12, 0.45·V) metres before the old one closes,
  enough for a lane change (0.17 s) at that metre's speed. That is ~220
  coins per km against ~50 before, and `metrorush-modos.test.cjs` demands
  ≥ 150 and checks every change window against `velocidadEn(d)`. That denser
  track is **track version 4** (`VERSION_PISTA` in `motor.js`, `VERSION` in
  `prueba.js`, `VERSIONES = [2, 3, 4]`): only sin monedas changed, so a v3
  sin monedas proof is still rebuilt with the old, sparser track, and in
  every other mode v3 and v4 give the same track. In the game a coin touched within 0.7 m × 0.6 m is `muere('moneda')`
  and the coins are tinted red and pulse (`mundo.monedasPeligro`). The
  proof gains `m` (absent for classic, so classic proofs did not change and
  `VERSION` stays 2); `rehace` regenerates with that mode and its speed
  curve and rejects a 2× (`d`), the jetpack ribbon (`C`), the +5 (`p`) or a
  continue (`s`) in modes without them, a ticket the world lacks, and an
  unknown `m`. The verifier rejects a result whose table is not its proof's
  mode, and distance from any mode but classic. **Worlds** (`MUNDOS`):
  `metro` (Línea 3) and `city`, today a scaffold with one station
  (`ESTACIONES_CITY`, palette `alba`, no loops, no tickets) so City plays end
  to end. The hooks for filling it, all read by game, generator and proof:
  `ESTACIONES_CITY` / `MUNDOS.city.vuelta`, `INTRO_CITY`/`BOLETOS_CITY`
  (`historiaDe(modo)`), `MUNDOS.city.velocidad` (`velocidadDe(modo)` →
  `{velocidad, metrosEntre, velocidadEn, VELOCIDAD}`; changing it voids
  stored City proofs), `MUNDOS.city.generador.bloque(api, dif)` (a block of
  its own; `api` has the RNG, `emite`, the classic blocks and the live
  `dSig`/`camino`/`libre`), `registraTipo(tipo, {caja})` for new collidable
  objects (mundo.js `nuevo` must also learn to draw them) and
  `MUNDOS.city.personajes`. Per-mode local records live in
  `progreso.recordsModo` (`recordDe`/`anotaRecord`; classic stays in
  `records.puntos`). The six new tables pay like `-carrera` (1 coin per
  25 000 points, plus `RECORD` each), are in `club-datos.js`, `ranks.js`
  (a «Modo» row), Discord and the profile; the `soloRanks`/`soloPruebas`
  regexes and the 1e9 cap were widened, so **the rules must be
  re-published**. Logros still read only the classic tables. Proof changes
  bumped `club-47` and `metrorush-7`.

  **Sin ayudas and City sin ayudas run at a fixed ×10 for everyone**
  (`multFijo: 10` in `MODOS`; `M.multiplicador({…, fijo})` returns it and
  ignores base, stars, 2× and +5). The point is a table where only distance
  decides: base ×30 veterans and newcomers score the same per metre. The
  game, `rehace` and the verifier's per-metre cap (`10 × multFijo`) all read
  `multFijo`, so changing it voids those tables' proofs (it bumped `club-49`
  and `metrorush-9`). A star there pays 50 coins instead.

  **City** is its own world now (`city.js`: districts, generator,
  characters and constants; `ciudad.js`: its physics in the run;
  `mundo-city.js`: its drawing; `tests/metrorush-city.test.cjs`). Five
  districts by distance (Barrio Sur, Los Muelles, Bulevar Aurora, Parque de
  los Lagos, Bajo Vías), postales instead of tickets, its own speed curve,
  and six characters in `PERSONAJES` (three girls, three boys), each with
  one small `ventaja` that never touches metres or the multiplier. On top of
  cajones, drones, barandas and lonas it carries Subway Surfers City's newer
  pieces: energy cells (`energia`, ten light the free electric board for
  `TABLA_SEG`; only in modes with a skateboard). **City has no shop
  skateboards**: the board is only that electric one, charged by cells or
  the `bateria` power, so the HUD's skateboard counter is hidden there. The `bateria` and
  `monedas2` powers, the **chicle** (like SS City's Bubble Gum: 15 s,
  jumps 15 % higher, «roll» in the air is a ground-pound that bounces you
  back up to 3.6 m, and it also pulls coins in while airborne,
  `imanChicle`), drones that launch you when stepped on, floor grates
  (`rejilla`) opened by a ground-pound, containers that drop from the cranes
  in Los Muelles (`cae`, `alturaCae`: always on the ground 12 m before you)
  and low-gravity `burbujas` stretches in the park with one extra jump.
  **None of the new pieces draws from `api.azar`**: they are placed with
  `hashD(d, k)`, so adding one never moves the rest of a seed's track (the
  robot test that runs every seed found that the hard way). Speed pads are
  left out on purpose: the anti-cheat recomputes speed from distance.

  **Each district builds its own track, it is not a reskin.** After the
  first 140 m nothing in City comes from the classic generator: no `bajo`,
  no `alto`, no `rampa`. The City hook owns every block (the motor now asks
  it from metre 0; classic has no hook, so its track did not move). Each
  district has a `PERFIL` in `city.js`: what goes in the safe lane of its
  rows (`camino`), what may sit in the next path lane (`sig`), how a lane is
  really closed (`cerrado`: wagons, a lona/vapor *subida* to the roofs, a
  hedge, an obstacle), its oncoming-train rate (`marcha`), its signature
  block and spacing (`firma`, `cada`), its extra blocks and its grate
  spacing. `filaDistrito` is the one row builder and never fails, so a
  classic block can never slip in. Measured mix, wagon runs counted once:
  - **Barrio Sur**: drones and crates, few oncoming trains, a **cobertizo**
    every 60–100 m (a 2 m shed glued to wagons with no ramp, two jumps up),
    grates every 150 m to teach the ground-pound.
  - **Los Muelles**: ~60 % falling crates, the **escalera** (3–4 crates in a
    corridor of wagons, V + 3 m apart: jump or stomp each one) and the
    **viga**, a crane beam rising from 1.9 to 4.2 m that you jump onto about
    0.35 s early and that drops you on the roofs (`alturaViga`).
  - **Bulevar Aurora**: rails everywhere (single `baranda`s and the
    **zigzag**: two or three barandas that overlap by 0.35·V + 4 m across
    the lanes; changing rail mid-air is a *transbordo*, coins ×2, ×3, ×4 in
    `ciudad.js`), drones, and 30–50 % oncoming trains.
  - **Parque de los Lagos**: lanes are closed by **setos** (2.8 m: outside
    the bubbles a hedge is a wall, like a wagon) and lonas; bubble stretches
    with 3–4 hedge walls (`setos()`, spacing 2·V + 6) come every 90–160 m,
    and the next row starts 0.4·V + 4 m after the bubbles end, so no hedge
    sits on their edge. **The bubbles say what they do** (they were faint
    spheres and nobody knew the jump floated there): an entry gantry with a
    «BAJA GRAVEDAD · SALTO DOBLE» sign, the same gantry without the sign
    where the stretch ends, and a band of light on the floor (19 cm up,
    above sleepers and rails, wall to wall) for its whole length
    (`burbujasCity` in `mundo-city.js`). **Nothing on the gantry goes above
    6.4 m**: a stretch often starts right out of the tunnel, whose ceiling
    is 6.6 m, and the old half-ring arch (sign at 7–9 m, badge at 11 m) was
    seen cut in half from inside the tunnel. The sign (4.4–6.05 m) is then
    at the camera's height (~4.7 m, 8.6 m behind the runner), so it fades
    out over the last 10 m before the runner passes under it; it is drawn
    with `fog: false, toneMapped: false`, or the navy text came out light
    grey. The 16 bubbles are **soap bubbles**: a `MeshStandardMaterial` with
    a Fresnel term injected in `onBeforeCompile` (alpha 0.06 at the centre,
    0.9 at the rim, an iridescent tint), because at a flat 50 % opacity they
    read as grey smudges against the pale sky. They live in a 52 m window
    that moves with the runner (a stretch can be 270 m long), spread evenly
    rather than at random, only on the sides (|x| 3.3–5.1 m, never over the
    lanes, where they hid the hedges and filled the view during the double
    jump), growing in from the far end of the window and shrinking within
    12 m of the camera. The hedges are a clipped topiary block, not a box
    with balls stuck on it (that read as a polka-dot cactus): a 0.5 m stone
    planter and a soft-cornered foliage block (`redonda`, r 0.3) up to
    exactly `SETO.alto`, painted with a leaf texture drawn once per kit
    (`texFollaje`, stored as `follaje` in `kit.texs`, lighter towards the
    top; bigger inked leaves in comic, mint in neon). The park sky is
    bluer with the fog pushed back (its near-white horizon washed the whole
    district out). Inside the bubbles the camera keeps within 1.4 m below
    the runner (`poderes.flota`), or the double jump left the frame. Every entry shows an aviso (the full
    explanation the first two times, «Burbujas: salto doble» afterwards) and
    a «blup», and the City HUD shows «Salto doble ¡listo!» / «usado» while
    inside (`hud(c).burbuja`, `#hudBurb`).
  - **Bajo Vías**: drones, walls of 2–3 wagons, vapor subidas, oncoming
    trains and a **conducto** every 60–90 m (a duct from 1.0 to 3.35 m,
    longer than one roll; its orange ring sits halfway between where a new
    roll reaches the exit and where a roll started at the mouth ends; its
    mouth carries a lit frame and a down-arrow sign, because head-on in neon
    a plain duct read as a wall).
  Generator rules that came out of robot sweeps (480 runs at 11 km and 240
  at 16 km, 20–144 fps):
  - `despejado`: a lona, vapor, cobertizo or viga goes only where its lane
    has been free of wagons for 0.55·V and of anything jumpable (`st.obst`,
    filled by wrapping `api.emite` once per generator) for 0.9·V + 2 m;
    otherwise the jump over a crate carried you past the lona and into its
    wagons;
  - `bajada`: after a roof route its lane stays free 0.9·V m, the time to
    drop off the roof and change lanes, or the next row could box in
    whoever took the hard route;
  - after a wagon run, `trenes` reserves its lane for 0.4·V;
  - a hedge lane inside bubbles cannot be entered without time to jump;
  - `M.activaTren` moves forward an oncoming train placed in the first
    170 m;
  - the escalera never starts if it would not end 240 m before the next
    district (the tunnel).
  The tutorial hints (`PISTA_DE` in `juego.js`) teach a crate like a low
  barrier and a drone like a high one, since City has neither barrier.

  `tests/metrorush-city.test.cjs` checks each piece frame by frame (20–144
  fps, 16–60 m/s), that each one appears only in its district and often,
  and the mix itself: zero classic pieces, each district's defining share
  (cobertizo ≥ 5 %, crates + beams ≥ 50 %, rails ≥ 28 %, hedges ≥ 40 %,
  drones + ducts ≥ 30 %) and an L1 distance ≥ 0.45 between any two
  districts' mixes. Change a `PERFIL` and re-measure.

  **Collisions are swept, in both worlds** (`choques` in `juego.js`): a
  piece shorter than the frame's advance (a crate, a drone, a hedge at
  60 m/s and 20 fps is 3 m per frame) is tested at the instant it was
  crossed, with x and y interpolated from `xPrev`/`yAntes`, so it cannot
  be tunnelled through. `CITY.enLona(o, x, D, y, Dantes, vy)` is swept the
  same way (the vapor blows over its whole column, the lona only from the
  ground). The test robot mirrors both, and plans **frame by frame**
  (`bienF`: where each frame will fall is known from the curve), because a
  lane-change window one metre wide is skipped at 2.9 m per frame; with
  that, 24 seeds × 2 modes × 17.5 km run clean at 20, 24, 30, 60 and 144
  fps. Every crash the metre-level robot reported at low fps was the robot
  missing that window, not the track.
- **Fullscreen**: ⛶ on the title screen and in the pause panel, or `F`,
  calls `requestFullscreen` on the document (webkit fallback; the button
  hides where the API is missing, i.e. iPhone). `html.mr-pc` (and
  `html.club-inm`, set by `Club.inmersivo(true)` at run start on a portrait
  phone and cleared on pause and at the summary) keeps only a thin scorebar
  (mute and volume must stay visible) and lets `.pantalla` fill the rest.

