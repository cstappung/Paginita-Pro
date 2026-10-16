# Budokai Tenkaichi 3 (`juegos/bt3/`)

The PS2 game compiled to WebAssembly, played from **each player's own ISO**. Read
`colabtex/src/juegos/CLAUDE.md` too (room games, mute/volume rule).

## Where it comes from

- Code: the decompilation port [z3xox/Tenkaichi3Decomp](https://github.com/z3xox/Tenkaichi3Decomp) (MIT), through
  the browser fork [stufno102/Tenkaichi3Decomp](https://github.com/stufno102/Tenkaichi3Decomp), pinned in
  `fuente/construir.sh` (`COMMIT`). Our changes to that fork are **one patch**, `fuente/parche.diff`; never edit the
  generated files here by hand.
- **Chrome or Edge: on a PC, or Chrome on Android.** Only the JSPI build is made; the fork's Asyncify build
  (Safari/iPhone, where every browser is Safari underneath) is not, and the page says so on a browser without JSPI.
  On Android (`body.coarse`) the fork's touch pad shows, and `pagina.py`/`pagina.js` adapt the site's parts:
  - the bar goes centred between the pad's columns while playing (`translate`, not `transform`, which the bar's
    hide animation owns), without the volume slider or an idle controller badge, and the ♪ label is short;
  - the floating language picker of `i18n.js` is hidden once the game runs (it sat on the stick);
  - without a mouse the bar never came back (it revives on mouse moves), so ☰ (top centre) shows it; the bar gets
    ⛶ (enter/leave fullscreen) and 🎮 (pad size 70–120 % and opacity: `--esc`/`--opa` on #pad, `bt3.pad.*`;
    the size is capped at 110 % in landscape and 120 % in portrait, past that buttons overlap — `choques.cjs`);
  - the fork caches where each touch button is (`Touch.rects`) and re-measured only on rotation, but the buttons
    also move when the height changes without rotating (fullscreen, Chrome's bar hiding): taps landed on the old
    places and «didn't react the first time» until the phone was turned and back. `Touch.down` now measures on every
    new finger (~18 rects). Bench test: `prueba54` (fails with the old page, passes now);
  - fullscreen is asked by itself only ONCE (first tap with the game running): asking on every tap made it
    impossible to leave;
  - «🔊 Activar el sonido» shows while the game's AudioContext is not running (a tap on a real button always
    unlocks it). Bench test: `prueba53`;
  - the fork blocks `touchmove` everywhere but `.card` (no page scroll or zoom while playing); the modes sit outside
    the card, so a finger could scroll down over the card and never back up over the modes. The exception now
    covers `#start` (removed when the game starts), `#vetos` and `#registro`. Bench test: `prueba51`;
  - the mode list is one column under 500 px, and `#start` centres with `safe center` (plain `center` cut off the
    top of a card taller than the screen, out of reach of the scroll).
  `@controles: tactil teclado` in `pagina.js` makes the lobby tag it for phones too. Bench test: `prueba50`
  (Pixel 7, both orientations). Speed on a real phone was never measured.
- **The fork's on-screen touch pad must not show on a PC.** The fork shows it on `pointer: coarse` or
  `maxTouchPoints > 1`, which a Windows PC with touch drivers or a touchscreen laptop reports even when played with
  a mouse: the pad covered the fight. `pagina.py` makes "touch" require that there is **no** fine pointer
  (`any-pointer: fine`), and ignores the stored `bt3.touch` there, because the fork stored `'1'` on its own at
  start. With a mouse only `?touch=1` shows it.
- `fuente/construir.sh <workdir>` clones the fork, applies the patch, builds with Emscripten 6.x, copies
  `bt3-jspi.{js,wasm}` here, generates
  `index.html` with `fuente/pagina.py` from the fork's `port/web/shell.html`, and runs `npm run build:bt3`
  (`colabtex/src/juegos/bt3-marco.js` + `malla.js` → `red.js`). Bump `VER` in `construir.sh` when the program
  changes: it is the `?v=` of the page's scripts and of the `.wasm` (`locateFile`). Bump it too after editing only `pagina.js` or
  `pagina.py` (their `?v=` is the same `VER`, so the browser kept the old `pagina.js`): then there is no need to
  compile, just rerun `pagina.py` on the patched fork's `shell.html`, the `BT3_VER` sed and `npm run build`.
- `pagina.js` (hand-written) is what the site adds to the page. `pagina.py` fails loudly if the fork's page changed
  where it patches: fix the patch there, never by editing `index.html`.

## No game data, ever (the legal line)

**Nothing from the disc may be committed or published.** The fork's own browser build bakes the game's data
tables into the `.wasm` (`gen_data_web.py`, built from the user's disc) and says never to publish it. Our patch
replaces that with `gen_data_skeleton.py`: the tables go in **blank** (the desktop release's `port/data/*.s`), and
`plat_mem.c` (`BT3_WEB_SKELETON`) fills ~210 KB from the player's ISO at start and checks the desktop release's
hash, so a wrong or modified ISO stops with "not the unmodified USA release". Traps found doing it:

- `port/data/index.txt` offsets are positions in the flat image that starts at PS2 address 0x100000, **not**
  addresses. Subtracting 0x100000 read every piece from the wrong place and every good disc failed the hash.
- The fill reads the disc, which suspends (JSPI), and that is only allowed inside `main`. It runs in
  `__wrap_Game_Main` (`-Wl,--wrap=Game_Main`), not in the `Port_MapMemory` constructor like on desktop
  ("trying to suspend without WebAssembly.promising").
- In wasm a symbol is data or a function, never both: names the tables point to that nothing defines yet are
  declared `void(void)` functions (link.py stubs them); `D_3BE71C` is a fixed address (`ABSOLUTE`).

Players pick the ISO; with File System Access (Chrome, Edge) its handle is kept in IndexedDB (`bt3-iso`) so the
next time is one click ("Usar …"). The file is read in place, never copied or uploaded.

## Online: Firebase only introduces, the fight is WebRTC

Room game in an iframe, modelled on HaxBall, with one deliberate difference: **the mesh runs inside the frame.**

- `colabtex/src/juegos/bt3.js` (the postman) paints the lobby and lends the frame the Firebase mailbox
  (`fb.senalMalla`, `vivo/<pid>/rtc`) over postMessage (`senal` ops). That is ~20 messages per fight, deleted on
  read. **Nothing of the fight touches Firebase**, and there is no database fallback (see Yemas: one drained the
  daily quota).
- `bt3-marco.js` (bundled as `red.js`) opens `malla.js` in the frame and feeds the game's `Module.netSend` /
  `netRecv` with **binary** packets (`malla.enviaBin` / `alBinario`, added for this; other games still send JSON).
  Keeping the channel in the frame means a packet never waits for the room page's main thread.
- The game's netcode is the fork's `gs/net.c`: inputs of the last 16 frames per packet, version check,
  `BT3_NET_DELAY=auto`. **In the browser it is lockstep with input delay, not rollback**: rollback (`state.c`) needs
  the 64-bit desktop's page tracking and reports `Port_RollCan() == 0` here.
- The session environment (`BT3_NET_SESSION`, `HOST`/`RULES` or `JOIN`) is **not** written to `ENV`: Emscripten
  copies `ENV` into C's environment when the runtime starts, so a later `ENV` change is never seen (the game
  opened the main menu instead of the versus screen). The page leaves the pairs in `Module.entornoPendiente` and
  `__wrap_Game_Main` applies them with `setenv` before anything reads them. So the frame does not reload into the
  session like the fork does, and the ISO is chosen once per fight.
- Only STUN: two networks that refuse a direct connection cannot fight; the frame says so after 45 s and the room
  goes back to the lobby. A TURN relay would fix it (not done).

The duel (`redBt3` in `motor.js`): `anfitrion` (**either player picks who hosts**; the host is the game's player 1
and sets the rules), `ajuste` (`batalla`, `tiempo` → `reglasBt3`, the word `gs/net.c` reads), `disco` (that frame
loaded a valid disc; both needed), `empieza`, `vuelve` (back to the lobby; frames reload, discs re-confirm),
`resultado` and `revancha`.

**Results are automatic.** When the fight ends (`BtlSeqFight` state update in `btl_seq.c`, the frame
`BtlSeq_CheckBattleEnd` says it is over: K.O., time up, abandon) the patch calls `Web_FinPelea` (`plat_mem.c`), which
hands the page the winner bits (1 P1, 2 P2, 4 draw, 8 abandoned; plus the forced bits Finish adds from reason
0x20/0x40) → `Module.onFinBatalla`. **Not at `BattleResult_Finish`**: that runs at `Battle_Term`, when the battle
scene is LEFT; in a versus the game stays on its results screen and rematch menu, so no report came, and going back
to the room reloaded the frame without one (log: `empieza`, then only `vuelve`) → `Module.onFinBatalla`. **The
celebration is shown whole**: the room counts the result at the K.O. but a frame that reported a winner is not
reloaded until its game enters the results-menu state (`BtlSeqEnd_Enter` → `Web_MenuFin` → `Module.onMenuFin` →
`menufin`, after the finish and the winner's pose and line), or 25 s (`esperaMenu` in bt3.js); a cut fight reloads at
once. Meanwhile **that fighter's room does not repaint** (`pintaVestibulo` returns while `esperaMenu`): the lobby with
the score, the winner's banner or the new bracket pushed the game down and took the eye off the winner's screen;
`reiniciaMarco` paints it all at once. The spectator's screen stays 18 s after a fight with a winner (`tele.cierre`). Reloading on the result cut the
winner's screen → the frame → `bt3.js` writes
`{t:"resultado", uid, n, b, g}`. When **both** frames said something about the same fight the duel goes back to
the lobby by itself (frames reload, fullscreen exits); only when they agree does it count for the scoreboard
(`marcador`, `empates`). Bits 8 → `vuelve`. **A lone report counts**: if one frame said the winner and the fight then
ends without the other's report (its session closed first: someone left the results screen, a cut), that report is
the result (the game computed it), and it does not restart as a cut; a report arriving with the room already back in
the lobby counts too while that fight has no result (duel `vuelve`/late `resultado`; tournament `vuelve` with one
`rep`). Without this, finished duels showed «La pelea N quedó sin resultado». `revancha` (both must ask; any rule or host change clears it) starts
the next fight by itself once both discs are back. **«🏆 Dar la victoria»** (`{t:"decide", uid, n, g}`, only the
`anfitrion`): the fight in progress, or the last one while it has no counted result (`est.pendiente`: after a cut,
«Volver al vestíbulo» or two frames that disagreed), goes to `g` in the scoreboard; it ends a running fight and stops
a cut fight from restarting by itself. Each pick asks for confirmation. The frame **must** reload between fights: `BT3_NET_SESSION` is
read once at start-up. That costs nothing now (below).

**Tournament** (`cupo` > 2, `redTorneoBt3`): the organizer starts it with ≥ 3, **with the bracket they arranged**:
before starting everyone sees the whole bracket as the same pyramid as during the tournament (rounds «Por definir»,
who passes directly already in round 2, the cup), and its first round is `est.previa` ( slots in pairs, `""` = bye; drawn with the room's seed,
k-th against (tam/2+k)-th so byes spread) and the organizer drags one fighter onto another, or taps one then the
other, or «🔀 Mezclar» (`{t:"orden", uid, lista}`: all the slots; ignored unless it has the bracket's size and no
pair is empty; whoever joins later takes a free slot; if the size changes, e.g. 5→4, it is redrawn). `{t:"torneo"}`
fixes it. Byes up to a power of two, one fight at a time (`actual`). Both fighters' frames report the winner;
agreement decides, disagreement → organizer `decide`; the organizer can also **«🏆 Dar la victoria»** of the
current fight at any time (before or during it, even their own; `hist` marks it `mano`); a draw is refought; leaving forfeits. The organizer can
**kick** (`{t:"echa", uid, a}`, ⏏ in the list before it starts and «sacar a un jugador» during it): the kicked one
is `fuera` like someone who left, forfeits, and their photo explodes in a banner. Each fight is also a `ronda` in
`hist` so the duel's logros apply.

**CPUs and empty places.** A tournament starts with nobody but the organizer: no CPUs, no bots (the bench too; its
test players come only from the organizer's «＋ Entra un jugador de prueba»). Before starting, the organizer fills free places with CPUs (`{t:"cpu", id:"cpu:N",
nivel}`, levels 0–4 = the game's CPU strength rule; `quita` removes one) or leaves them empty (their rival gets a
bye). A CPU is a bracket slot, not a player (`est.cpus`, `esCpuBt3`). CPU vs CPU is decided at once, seeded by the
room's seed and the match id, weighted by level (the same on every screen). Human vs CPU is played alone in the
human's frame: `BT3_WEB_MODO=cpu` + `BT3_WEB_REGLAS` + `BT3_WEB_CPU` + `BT3_WEB_AZAR=1` (the patch draws the CPU's
fighter, or team within the DP limit, at random in the select screens: `CharSel_WebAzar`, `TeamSel_WebAzar`), and
that one frame's result decides. `{t:"vuelve", m}` cuts the fight in progress without deciding it (a fighter left
the select screens, or «Cortar la pelea»); it is replayed.

**Team 3 vs 3** is a Team Battle with a cap of three: `reglasBt3` puts 3 in bits 12–15 (gs/net.c ignores them),
and both pages pass `BT3_WEB_EQUIPO=3` to their program; the patch's `TeamSel_Max` stops the team at three and
asks for exactly three.

**Spectators** (anyone opening the room who is not playing, and whoever left or was kicked: `enSala()` is false)
see the lobby, the bracket, the banners and the fight intros live; their frame is never loaded (`cargaMarco`).
**They can watch the fight too** (`bt3-directo.js`): the game has no spectator netcode, so the fighter that is
player 1 (or the human against a CPU) sends its canvas as a WebRTC video (540p, 30 fps, ≤ 1.5 Mb/s) **with the
game's sound** to whoever presses «📺 Ver la pelea en vivo». **Viewers relay to each other**: the
fighter encodes for ONE viewer only (`DIRECTOS`), every viewer that already sees it re-sends it to up to two
(`RELEVO`), up to 14 (`MAX_VISORES`). The emitter keeps the tree (`ver` → itself, `vir` → «take it from that
viewer», `vespera` → nobody can yet; `vya` = this viewer can relay), never offers a viewer its own branch, and
when someone leaves (`vfin`) or drops silently (their children report it: `cae`; a relay that never answers is
given up after 6 s; «disconnected» for 4 s counts as dropped) their children re-ask and hang from someone else with
their whole branch (relays swap tracks with `replaceTrack`, no renegotiation). Each hop re-encodes (~0.1–0.2 s). The sound is
tapped *before* the player's own volume (`pagina.js` 0a wraps `AudioContext` after `volumen.js`: the game's
`destination` becomes a `pre` gain → the player's volume, plus a `MediaStreamDestination` when someone watches;
`Module.audioJuego()` reads it from `Module.SDL3.audioContext` only), so a muted player is still heard; the viewer
has its own 🔊 and slider (`jg.bt3.tele`). Signalling goes through the
mesh's mailbox (`vivo/<pid>/rtc`, open to anyone signed in) with its own message types (`ver`, `vof`, `vans`,
`vcan`, `vfin`, `vlleno`); the frame's mailbox proxy now takes several listeners (mesh + emitter). The viewer's
screen closes itself when the fight ends (its ⛶ fills the screen without distortion, the bar floats and hides),
and shows how the video arrives (fps · size · speed, `visor.calidad()`).
**It went at ~1 fps and blurry** for two reasons, measured with real WebRTC (`tele/` harness in the bench): (1)
`captureStream` on the game's canvas reads the WHOLE screen-sized picture back from the GPU every frame («GPU stall
due to ReadPixels»), which slowed the capture and the game; now the patch calls `Module.onCuadro` after each
present (`Web_FrameDone`, while the canvas still holds the frame) and the emitter copies it scaled down to a 540-high
canvas (`drawImage`, on the GPU), at most 30/s, only while someone watches, and sends that (`captureStream(0)` +
`requestFrame`); (2) the bandwidth estimate starts at ~300 kb/s and Chrome shrank the picture to 320×180: the
emitter rewrites the viewer's answer (`conArranque`: `x-google-start-bitrate=1200;x-google-min-bitrate=400`) and
prefers `balanced`. The software-GL test box cannot show (1)'s gain; (2) went from 320×180 to a steady 960×540. (3)
**The copy came out black with the fighter's tab in front** (fine in the background): WebGL may clear the canvas once
the browser has shown it (`preserveDrawingBuffer: false`), and the copy read it after that. The frame that will
transmit (`Module.conservaCuadro`, set before the program starts) creates its context with `preserveDrawingBuffer:
true` (pagina.js 0b wraps `getContext` for `Module.canvas`); only that frame pays the per-frame copy. Headless Chrome
never clears it, so the test box cannot reproduce this one either. (4) **The game comes first**: the copy runs inside
the game's frame (10 ms at 720p, 44 ms at 1080p on the GPU-less test box), so it measures its own cost and spaces
itself to stay under 10% of the game's time (`costo * 10`); with a cheap copy that is still 30/s. At a flat 30/s a
watcher halved the fighter's frame rate (owner: 2 fps in character select). (5) **Even, not just fast**: it copies 1
of every `paso` game frames (counting frames, not time) at the highest of 30/15/10/5 per second that keeps it under
10%, re-chosen every 90 frames, and the viewer asks for a 300 ms jitter buffer (`receiver.jitterBufferTarget`): a
little delay is fine, stutter is not. 24/s was asked and rejected: from a 30/s game it means dropping 1 of 5, unevenly. (6) The sender prefers **H.264**
(`setCodecPreferences`): Chrome/Edge encode it on the GPU, VP8 mostly on the CPU the game uses; without H.264 the
usual order stays (the test Chromium has none, so that fallback is what got tested). Friends find running rooms in «En juego ahora»
(BT3 does announce there now; the lobby shows it only to `bt3Visible`).

**The lobby's animations** live in `bt3.js` (`recientes`, `celebra`, `anuncia`) and the `.jg-bt3-*` block of
`juegos.html`: only changes seen live are celebrated (not on opening the room), and each animation keeps its start
time so a repaint mid-way continues it (`--edad` as a negative `animation-delay`; the bracket repaints on every
disc event). Every slot, card and banner shows the player's photo (`avatar(jugador(u))`, the ficha's `foto` or
the initial on its `color`); the loser's card **explodes** (`explota()`: a flash and 14 fixed shards that inherit
`--edad`) and stays cracked and grey; the champion gets the crown on their photo. Sounds `kiAvanza`, `kiCae`,
`kiBoom`, `kiCorona` in `sonido.js`, through `busFx` like every room sound. Each fight's start (`detectaInicio`:
the duel's `ronda` going to `jugando`, a tournament fight's `actual.n` going `enCurso`) shows `presentaPelea`, a
fixed full-screen intro over the game frame (both photos slide in, clash, «¡A PELEAR!», `kiPelea`, 2.7 s); the
bracket appearing plays `kiTorneo`. Nothing plays on opening a room or in a hidden tab.

**Disconnects.** Lockstep: if the rival stops answering mid-fight, the game waits (patch: 25 s instead of 6,
`QUIET_NS`) and tells the page (`espera` / `sigue` net events) so the frame shows a countdown; if the line comes back
the fight goes on where it was. If not, the fight is cut with `por: "corte"` and **starts again by itself** when both
discs are ready (`reanudar` in `redBt3`; `actual.reanudar` in the tournament), up to `BT3_CORTES` (3) cuts in a row
of the same fight — a line that keeps dropping must not loop forever; after that it is started by hand. A page that loads while its own
fight is running (a refresh or a new sign-in mid-fight: `llegoEnPlenaPelea` in bt3.js) cuts it at once the same
way, so nobody waits 25 s (so does opening the room in a second tab of the same fighter mid-fight). **It cannot resume from the exact moment**: the rollback state is per process (game
globals and heap, not the call stack, renderer or sound), and a reloaded copy boots from zero, so both copies must
start the fight again. A cut never gives a win; in the tournament the organizer can still decide it if one never
comes back.

**The room does not rank** (`anotar` skips `bt3`) and its ten logros are room-detected (`SIN_FILA` in `logros.js`).

**Character rules from a tier list** (duel and tournament, `{t:"ajuste", k:"veto", v:""|"noop"|"malos"|"gigantes"}`,
one setting so they are mutually exclusive). **Each rule says which tiers ARE allowed** (the owner's words):
«No OP» = A, B, C, D; «Sólo malos» = C, D; «Sólo gigantes» = N/C plus Great Ape Baby (an S, but a giant:
`PERMITE_TAMBIEN`). Anything else is banned, and so is any character
of the disc the list does not name (`sinTier`). The list is `colabtex/src/juegos/bt3-tiers.js`: all 161 portraits of
the r/tenkaichi4 «comp discord» image, in its row order, with the owner's names (a JSON); where that JSON repeated a
name the owner or the image decided (S++ Cell = Perfect, B Cell = his last form, Super Perfect; A «Bojack FP» =
Super Android 13, C has one Salza and one Nappa, one D
«Pan» = Chi-Chi (Kid), one D «Spopovich» = Pilaf Machine (base; the combined one is N/C); S «Vegito - Super Saiyan» is the black-haired base Vegito, next to Super Vegito). `tiersDe` gives
each disc id the tier of the first (highest) entry that finds it; unnamed «Great Ape» forms (not Baby's) are N/C.
**The owner's disc names are in Spanish** («Goku (inicio)», «Joven Gohan», «Célula · Forma perfecta», «Gran mono
Vegeta», «Pequeño Bu», «Shin Shenron · Súper Yi-Shin-Long»…): `CAMBIOS_ES` turns their words into the list's English
ones before matching (inicio→early, fin→end, niño→kid, gran mono→ape, 2ª forma→second, célula→cell, «perfecto»
alone→superperfect…), and entries carry the Spanish-only names (Krilin, Chaos, Ub, Namu, Dabra, Yajirobai,
Kaiyoshin, Pandereta, Neo Shenron, Máquina Pilaf · Fusión; «soldado» → soldier). «Vegeta 2ª forma · Monstruo» is
Majin Vegeta and a bare «Gran Mono» is Kid Goku's Great Ape (owner); plain «Gohan», «Vegeta» and «Trunks» are the
adult / Vegeta (End) / battle-armour ones. **A test holds the owner's whole disc** (its 161 names, id by id, from
«📋 Copiar los nombres del disco») and checks each lands on its entry, one to one: change an entry and that test says
which disc name moved. The bench's «Abrir la selección de personajes» posts the same 161 names.
In the room, with a rule on, **«📋 Ver la tier list»** shows the tiers in the image's colours, each entry allowed or
locked and the disc name it matched; the in-game side panel lists the shorter of allowed/banned. Character names are
not in the code, they are on the disc: when a select screen opens the patch hands its name/form texts (sections
43/44, line n = id n, **UTF-16 little-endian**: the game reads them as native `u16`, `btl_seq.c` compares them
with `'0'`) to `Module.onCatalogo` (`Web_Catalogo`, CharSel and TeamSel init),
and **the frame computes the banned ids right there, synchronously** (`BT3Sala.vetadosDe` in bt3-marco.js → the
same `vetadosBt3` the room uses; catalog cached in `bt3.catalogo`) into `Module.vetados`, because the game builds
its grid as soon as that call returns. In the game (`web_vetado`): `ChrGrid_Build` (view_a_e.c) treats a banned
id as **not unlocked** — banned forms leave the form lists and a cell left with none becomes the game's own locked
chip, which the cursor skips and random never draws (grid positions, and so saved item sets, do not move; saved
custom characters too); CharSel/TeamSel also refuse a banned pick with the error sound and draw any leftover
banned chip dark; and **mid-fight** `BattleSide_IsCharaUsable` (battle_load.c, asked by `BtlAct_CanTransform`/
`CanFuse` for human and AI) refuses it, so nobody transforms or fuses into a banned form. Both peers read the same
disc and rule → same grids and draws (no desync). While a select screen is open (`Web_Seleccion` →
`Module.onSeleccion`) the frame shows a foldable side panel listing the banned (or allowed) ones by tier (`#vetos`, folded state
in `bt3.vetosPlegado`); «Ver la tier list» in the room shows every entry with the in-game name each entry matched
(or «no se encontró»), «N de M encontrados en tu disco» and **«📋 Copiar los nombres del disco»** (id + name per
line) — **check it against the real disc**. Trap: until bt3-12 the patch read the names high byte first, so «G»
(0x47) arrived as 0x4700, nothing matched and **no rule banned anything**; the bench and the tests fed correct codes
and never saw it. `catalogoBt3` now flips a list whose characters mostly have a zero low byte (the stale
`bt3.catalogo` in friends' browsers), and a test runs the compiled `web_catalogo` over a disc-shaped buffer. The bench's «Abrir la selección de personajes» posts a
hand-written USA-style roster to exercise this without the disc.

## One player: the modes

Four modes, and only four: **Entrenamiento, Contra la CPU, Duelo, Torneo**. The solo page (`?modo` ≠ `online`)
shows them as a Snake Club–style column next to the start card (`2b` in `pagina.js`, styles in `pagina.py`), each
with a gi-patch emblem drawn by us (亀 機 闘 天; Noto Serif JP subset to those four glyphs) — never game art,
remembered in `bt3.modo`, preselected by `?juego=entrenamiento|cpu|duelo|torneo`.

- **The solo page is played inside Juegos** (`#solo/bt3`: `crearBt3Solo` in bt3.js, a full-window frame like PRO
  HERO, `html.jg-bt3solo`; only for friends, `revisaBt3`). Opened loose (top-level) it had no session, so no token
  and no private disc: it asked friends for an ISO. Now the lobby entry has `ruta: "#solo/bt3"` (its `url` stays: it
  is where `build-controles.js` finds the code), and a loose page on a site with a private disc redirects there
  (`discoPrivado`; `?suelta=1` keeps it loose for tests). «← Juegos» in the bar (mode menu only) posts `volver`.
- **«Contra la CPU» has its own rules** (modalidad, tiempo por round, dificultad; `bt3.cpuBatalla`/`cpuTiempo`/
  `cpuNivel`): jumping straight to the character select skips the game's rules menu, so the page sends them as the
  tournament's CPU fight does: `BT3_WEB_REGLAS` (`reglasCpu` in pagina.js mirrors `reglasBt3`), `BT3_WEB_CPU`
  (the patch writes save rule[1] after the save loads) and `BT3_WEB_EQUIPO=3` for 3 vs 3.
- **The top bar hides itself while playing** (it covered player 2's health bar): `body.started:not(.barra-viva)
  #barra`, back on mouse move for 2.5 s, while hovered or focused, and 4 s at start. The controller pill is short
  (`🎮 <name>`, full ids in its title).
- Entrenamiento / Contra la CPU play here. **Nothing starts by itself on the solo page**: the private disc and the
  remembered ISO wait for «Jugar · <modo>» (`listoParaJugar`), which is also the gesture that unlocks audio; picking
  an ISO is itself the click. The mode reaches the program as `BT3_WEB_MODO` (`Module.entornoPendiente`), and
  `__wrap_Progress_Main` (patch, `headless.c`) sets `gProgress->mode` before the menus run, as the online session
  does: `cpu` = mode 39 (versus character select, `+0x620 = 0` 1P vs COM), `entrenamiento` = mode 44 (the game's
  training menu: lessons and free training).
- **Back buttons.** «◀ Atrás» in the bar presses player 1's Triangle (the game's back in every menu) through
  `Web_TouchSet`, only while the menus run (`web_en_menus` around `__real_Progress_Main` → `Module.onMenus`; in a
  fight Triangle is an attack). «← Modos» (solo) leaves. The room frame's button has two jobs: in a fight it is
  «← Sala» (cuts the fight, `termino`); while waiting for one (disc loaded, vestíbulo or bracket) it is «← Salir del
  duelo/torneo» and posts `salir`, which `bt3.js` turns into the room's own exit (`ctx.salir` =
  `salirDeLaPartida`, the header's «← Vestíbulo»). It used to send `termino` there too, which the room ignores
  outside a fight: the second click did nothing. `enPeleaSala` is set in `antesDeEmpezar`. Bench test: `prueba49`.
- Duelo / Torneo are rooms: the button posts `{tipo:"sala", cupo}` (2, or 8 for a tournament) to Juegos, which
  opens it (`alPedirSalaBt3` in `bt3.js`, registered by `juegos-main.js`). Outside Juegos it links there.
- **No back door to the rest of the game.** Backing out of the chosen mode into the game's other menus (main
  menu; in a tournament fight also the versus menu) is caught by the patch (`Port_Trace` in `headless.c`, after
  the first-run part) and reported once to `Module.onFueraDelModo`: the solo page reloads to the mode selector,
  a room frame tells the room (`termino` → the fight is cut). «← Modos» in the bar does the same on purpose.
- The save rules the patch writes (time limit rule[0], CPU strength rule[1]) are written only after the card
  check, because loading the player's save would overwrite them.

## Speed

- **The private disc loads in parallel and ahead** (`pagina.js`, «el disco privado, rápido»): a queue with up to
  10 piece requests in flight, where what the game waits for («alta») goes before prefetching («baja», ≤ 6) and a
  prefetched piece the game now needs is promoted; a big read asks for all its pieces at once. **The boot is
  prefetched**: the first session records which pieces (and files) it read until the first fight
  (`terminaArranque`, on `Module.onMenus(false)`), keeps that locally (`bt3.arranque.<size>`) and adds the pieces
  to the Worker's shared `/arranque.json`; on opening the page the next one downloads them while the player is
  still choosing a mode, and before starting the program the recorded files are copied into the game's memory 8
  at a time (`precopia`). **The chosen fighters** (`Web_Elegidos`, CharSel/TeamSel term) get their models, voice
  banks and voice lines prefetched, the lines copied into memory, so the first time one speaks mid-fight the game
  does not stop. **«Lo esencial»** (a button, opt-in): commons, stages, every fighter's base model/anims/voice bank
  (computed from the AFS tables with the file-id formulas of the port's docs), downloaded in the background.
  **The wait is always visible**: when the game waits on the network for > 0.4 s the badge shows MB downloaded and
  speed, and on a first visit says it is saved for next time. The Worker sends `no-store` (the page keeps the
  pieces itself: not twice), and puts each piece in Cloudflare's edge cache after the friend check — **this only
  takes effect with a custom domain on the Worker**; on `*.workers.dev` Cloudflare ignores it.
- **Nothing is downloaded before playing** (the owner's rule): never from the lobby; on the solo page **the
  program itself** (`bt3-jspi.{js,wasm}`, 3.6 MB) waits too: `go` (patched by `pagina.py`) calls `pidePrograma` in
  `pagina.js`, so it is fetched on «Jugar» or on picking an ISO (a room frame asks for it on load: entering is
  playing; without JSPI nothing is fetched at all). The boot
  list is fetched on «Jugar» and «lo esencial» (even its size: it needs the disc's tables) only when its button is
  pressed; in a room (already playing) the boot is fetched on entering, and «lo esencial» is not offered there (a
  big download during an online fight would take bandwidth from the link with the rival). The boot list is capped
  at 300 pieces (300 MB) on both sides. `BT3_VER` in `bt3-amigos.js` is the program version (construir.sh sets it).
- **30 fps by default, smooth motion optional** (the owner's call): the game simulates at 30 like the PS2; the port's
  "Smooth motion" (F1 → Video, or F9) only draws in-between pictures (60/120/240) and nearly doubles the drawing, so
  it starts off. The fight is computed at 30 either way, so online it does not matter if the rival has it on. In the
  browser its setting is `"suave"` (default 0; gs_draw.c, ui.cpp, gs_gl.c), a new key so everyone starts at 30
  whatever the old `"interp"` held. Trap from the time it was locked: forcing `gsInterp = 0` BEFORE the block that
  allocates the in-between buffers left them unallocated (writes through NULL, 6 fps); never set it before that block.
- **Auto-tuner** (`pagina.js` 2a, like a phone game's): the picture rate never changes; what gets cheaper is each
  picture. Its goal is 30, or 60 with smooth motion on (`Web_Suave`; 120/240 still aim at 60). Under 93% of it for 3 s → one step down (no distance blur → no glare → internal scale −1 → scale 1 and no
  depth tint → no outline: `Web_Calidad(scale, fxOff)` in the patch, not saved); 15 s at 98%+ of it with the program < 75%
  busy → one step up, never above the player's F1 choice (`Web_EscalaElegida`/`Web_FxElegidos`); a step up that
  fails within 20 s doubles the wait for the next one. **Only in fights** (not `body.en-menus`), not in a fight's first
6 s, and not within 1.5 s of any disc read (`Module.webDisc.readAt` is wrapped: the player's ISO too): in the select
screens the game loads previews, frames dip, and the tuner took it for a slow machine and changed the scale (the game
rebuilds its work images: a hitch), then raised it back (another) — lag the owner saw in character/stage select.
- **The bench used to cut the disc cache to 192 MB** (`webCacheBudget`, from when it ran two games per tab): with one
  game per tab that made the game evict files it still used and re-read them every frame mid-fight (2 fps, 99% busy,
  nothing drawn). Removed; only this page's setting, nothing else on the site.
- **Nothing is downloaded twice.** The first load fetches the `.wasm` with a progress bar into a blob; from then on
  (`localStorage` `bt3.wasm.<url>`) the program loads from its URL, so Chrome serves it from the HTTP cache *and*
  reuses its compiled code (measured: 3.6 MB/600 ms → 0 bytes/80 ms). The private disc's pieces are kept in Cache
  Storage (`bt3-disco:<size>`): a second session asks the Worker only for `indice.json` (which still checks the
  friends list). The game itself never reads the whole ISO: `webDiscEnsure` copies one file at a time as it opens it.

## Random: a fresh seed, and 🎲

- The port seeds the game's RNG once, at boot, with a **fixed** number (`func_002BB390` → 0x12345678 in
  `port/src/plat_sys.c`, so a run is repeatable), and every return to the modes restarts the program: the «?» cell and
  the CPU's random fighter repeated the same characters every time. `BT3_SEED` overrides it and is read inside
  `Game_Main` (`Vu0_Init` → `Rand_Init`), after the page's `entornoPendiente` is applied, so no C change was needed:
  `pagina.js` 2e passes a random seed when playing alone or against a tournament CPU, and in an online fight a seed
  both copies compute the same (FNV-1a of the room id from `parent.location.hash`, both uids sorted, fight number,
  rules): lockstep needs both copies to draw the same. Seeds are 31-bit: the patch reads them with `strtol`, and a
  wasm32 `long` is 32-bit signed, so larger ones clamped to the same value.
- **R3 in the character grid** (`CharSel_WebRuleta`, menu_c_e.c) moves that side's cursor to a random allowed
  character without choosing it; R3 was unused there. It goes through the pad, so online both copies roll alike.
  The page presses R3 (`PAD_R3` 0x4 via `Web_TouchSet`) for its own key (default R, `bt3.tecla.azar`, changed with
  ⌨) and for the 🎲 button, both shown only while the selection is open (`Module.onSeleccion`, now fanned out via
  `Seleccion.oyentes` because the room's banned-list panel listens too).

## Small touches (bench test `prueba56`)

- «🏆 Dar la victoria» also writes «X dio la victoria de la pelea N a Y» in the room chat, through the new `ctx.chat`
  that `juegos-main.js` hands every room module (`fb.mandaChat` as the person present).
- On a phone (≤700 px) the rematch bar is `position: fixed` at the bottom; `sticky` failed because it only sticks
  while its own box is on screen.
- The reconnection countdown (`onNetEvent("espera")`) beeps once a second, higher in the last five, through the
  game's AudioContext (`pitido`), so the page volume governs it.
- The first time the character selection opens in a page, on a PC, the shortcuts show for 6 s (🎲 key, F1, I);
  only the first three times on that computer (`bt3.atajos`).

## Battle music: «chinchonchin» from PRO HERO

- **Off by default** (owner's request): the game's own music plays unless the player picks the song with ♪
  (`bt3.musica` = `"cancion"`). Before, the default was the song.
- The patch tells the page when a battle starts and when its scene is left: `Web_PeleaEmpieza(bgm)` in
  `Battle_ResetWork` (before the game's `Bgm_Play`) and `Web_PeleaTermina` from `__wrap_BattleResult_Finish`
  (Battle_Term) → `Module.onMusicaPelea(on, bgm)`. While the page's song is sounding it calls
  `Module._Web_BgmPropia(1)`: `Adx_CalcOutVol` (src/sys/adx.c) then returns mute **only for the BGM channel and only
  while `gWebEnPelea`**; MAP (stage), voices and SE keep playing, menus keep their music. `Web_BgmAplica` re-applies
  the stored volume (`sWebBgmVol`) when either flag changes. Sound only: both copies of an online fight stay identical.
- The page (`pagina.js`, 2d) finds the song in PRO HERO's `library.json`: first by title (`meta.name`, what PRO HERO
  shows), then by artist/folder/id, all normalized (no case, accents, spaces or signs: «Chin Chon Chín» matches). The ♪
  button says which song it found, or why it failed (⚠ + its tooltip). It remembers `{folder, v, audio}` in `bt3.musica.cancion`, and gets its stems with **PRO HERO's own
  modules** (`../hero/js/cloud.js`, `site.js`, `songCache.js`): same Google session, same Cache Storage key, so a song
  already played in PRO HERO is not downloaded again. Nothing of this loads until the first battle starts.
- Stems play together, looped at the shortest stem's length, into the SDL context's `destination` (= `pre`, 0a): the
  page volume, Ajustes' «Music» (`Web_MusicaPorcentaje`, polled each second) and spectators all include it.
- Any failure (no session, song not found, SDK blocked) → the game's music, unmuted: `Web_BgmPropia(1)` is only called
  once the song is actually playing. Per player: the ♪ button in the bar (`bt3.musica` = `"juego"` for the original).
- The bench has no library: its page defines `BT3_MUSICA_PRUEBA` → `{nombre, corto, pistas}`: a 13 s battle-style loop synthesized on first use (drums+bass+chords stem, melody stem); the ♪ shows «Canción de prueba» and the bench panel has «▶ Oír la canción de prueba».

## Page details

- `volumen.js` loads before the program, so the site's mute/volume governs the game's `AudioContext`.
  `mando.js` is **not** loaded: the game reads controllers itself (SDL3), and synthesised keys would double every
  button. But Juegos (the top page) loads it, and with no config there it drives its cursor (the white circle) over
  the game and clicks with A. So `pagina.js` registers the frame by hand with `parent.Mando._hijo(window)` (what the
  frame's own copy would do): while the frame is visible the top page steps aside. Bench test: `prueba47`.
- "Ajustes" calls `Module._Web_Settings(3)` (patch, `ui.cpp`): the F1 window on Controls (which controller each
  player uses, remapping). The in-game "Dragon Net Battle" menu points players to the rooms instead.
- `?log=1` shows the program's log; it also opens by itself if the program exits or aborts.
- `?hud=1` (the fork's) shows fps; `Module.webStats.prof` has the GPU hand-off time (`[0]`, split into the draw loop
  `[1]` and what comes before it `[2]`) and draws per frame (`[3]`, the patch adds `gsDrawCount` in gs_gl.c). The
  page's own green readout (`bt3.hud`) was removed at the owner's request. Owner's first fight: 46 fps, 67% busy, 61%
  of it handing frames to the GPU. busy near 100% means the game
  itself is slow; a big «dibujo» share means the renderer (where WebGPU could help); few fps with a free program
  means something outside it.
- **No `confirm()`/`alert()`** in the room or the frame: a sandboxed frame (the bench) blocks them and they return
  «no» silently, so the buttons looked dead. Confirm in the button itself (`dosClics` in bt3.js; «← Modos»/«← Sala»).
- **Renderer:** WebGL2 (the GL back end, GLSL ES 3.00) is the only one that runs: WebGL 1 lacks what it needs, and
  the other back end (`gs_gpu.c`) uses SDL3's GPU API, whose pinned version has Vulkan/D3D12/Metal but no WebGPU.
- **Nothing drawn over the game may use `backdrop-filter`** (it re-blurs the game every frame); the banned-list
  panel (`#vetos`) is solid and only exists in the menus (`body:not(.en-menus) #vetos`).

## Friends only: the private disc and the hidden game

The owner wants BT3 **only for a list of friends** (who own the game), and without anyone choosing an ISO.

- **The list lives in one place**: the Worker's `AMIGOS` variable (Google emails, verified by Google in the token, or Firebase uids; comma-separated) in
  `fuente/disco/worker.js`, deployed by hand in the owner's Cloudflare dashboard (one file, no build). The
  Worker serves the ISO from an R2 bucket (`DISCO`) in 1 MiB pieces (`pieza/NNNNN.bin` + `indice.json`) only to
  a request carrying a **valid Firebase ID token** (RS256 checked against Google's JWKs, `aud`/`iss` =
  `mi-pagina-pro`, not expired) whose uid is on the list. `/soy` answers 200 to a friend, 403 otherwise.
  `/subir` is a page served by the Worker itself that uploads the ISO from the owner's browser with
  `CLAVE_SUBIDA`. Verified tokens are cached in memory: the free plan gives little CPU per request.
  `colabtex/tests/bt3-disco.test.cjs` pins the access rules with a local key pair and a fake bucket.
- `disco-privado.json` holds the Worker's address (empty = no private disc). The address is not a secret.
- **Hidden unless a friend** (`colabtex/src/juegos/bt3-amigos.js`): on every sign-in the lobby asks `/soy`; until
  it says yes, BT3 is filtered out of the catalogue, the solo list, the novedades banner (`filtraNovedades` in
  `juegos-main.js`), open rooms, games in progress, ranks and logros (`ocultos` in `logros-vista.js`: it used to
  re-add every game missing from `orden`, BT3 included), and never named elsewhere (`juegoOculto` in
  `juegos/ocultos.js`: the coins table, the shop's champion prize). A BT3 room opened by link shows only «Sala
  privada» — no players, no chat, no «Unirse» — and `entrar()` refuses it. `tests/bt3.test.cjs` pins these gates:
  a new view that lists games must go through `bt3Visible()` or `juegoOculto()`.
- **Adding a friend is only the Worker's `AMIGOS`** (Cloudflare → Variables → save): nothing in Firebase. They must
  sign in with that Google account and reload the page (`/soy` is asked once per session). The page's admins
  (`admins/<uid>`) are not friends by being admins.
- Honest limit: the lobby query still downloads waiting BT3 rooms to every signed-in browser (hidden in the UI), and
  the rules let any signed-in user create one from the console. Only the disc is truly locked (the Worker). BT3 rooms are never announced on Discord; they are in
  `enCurso` (juego and names only) so friends can watch, and only friends are shown them. This hides the game; the page files are public like the whole site (they hold nothing of the
  game), and the disc itself is what the Worker protects.
- The frame gets the token from its parent (`bt3.js` answers `{tipo:"token"}` only to a same-origin iframe
  loading `/juegos/bt3/index.html`) and, if `indice.json` answers, starts on the private disc without the ISO
  picker (`discoPrivado` in `pagina.js`); otherwise it falls back to the remembered ISO, then to choosing one.
