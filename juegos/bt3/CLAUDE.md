# Budokai Tenkaichi 3 (`juegos/bt3/`)

The PS2 game compiled to WebAssembly, played from **each player's own ISO**. Read
`colabtex/src/juegos/CLAUDE.md` too (room games, mute/volume rule).

## Where it comes from

- Code: the decompilation port [z3xox/Tenkaichi3Decomp](https://github.com/z3xox/Tenkaichi3Decomp) (MIT), through
  the browser fork [stufno102/Tenkaichi3Decomp](https://github.com/stufno102/Tenkaichi3Decomp), pinned in
  `fuente/construir.sh` (`COMMIT`). Our changes to that fork are **one patch**, `fuente/parche.diff`; never edit the
  generated files here by hand.
- **PC only, Chrome or Edge.** The game is not playable on a phone, so only the JSPI build is made; the fork's
  Asyncify build (Safari/iPhone) is not, and the page says so on a phone or a browser without JSPI.
- `fuente/construir.sh <workdir>` clones the fork, applies the patch, builds with Emscripten 6.x, copies
  `bt3-jspi.{js,wasm}` here, generates
  `index.html` with `fuente/pagina.py` from the fork's `port/web/shell.html`, and runs `npm run build:bt3`
  (`colabtex/src/juegos/bt3-marco.js` + `malla.js` → `red.js`). Bump `VER` in `construir.sh` when the program
  changes: it is the `?v=` of the page's scripts and of the `.wasm` (`locateFile`).
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

**Results are automatic.** The patch wraps `BattleResult_Finish` (`--wrap`, `plat_mem.c`) and hands the page the
winner bits (1 P1, 2 P2, 4 draw, 8 abandoned) → `Module.onFinBatalla` → the frame → `bt3.js` writes
`{t:"resultado", uid, n, b, g}`. When **both** frames said something about the same fight the duel goes back to
the lobby by itself (frames reload, fullscreen exits); only when they agree does it count for the scoreboard
(`marcador`, `empates`). Bits 8 → `vuelve`. `revancha` (both must ask; any rule or host change clears it) starts
the next fight by itself once both discs are back. The frame **must** reload between fights: `BT3_NET_SESSION` is
read once at start-up. That costs nothing now (below).

**Tournament** (`cupo` > 2, `redTorneoBt3`): the organizer starts it with ≥ 3; the bracket is shuffled with the
room's seed, byes up to a power of two, one fight at a time (`actual`). Both fighters' frames report the winner;
agreement decides, disagreement → organizer `decide`; a draw is refought; leaving forfeits. The organizer can
**kick** (`{t:"echa", uid, a}`, ⏏ in the list before it starts and «sacar a un jugador» during it): the kicked one
is `fuera` like someone who left, forfeits, and their photo explodes in a banner. Each fight is also a `ronda` in
`hist` so the duel's logros apply.

**CPUs and empty places.** Before starting, the organizer fills free places with CPUs (`{t:"cpu", id:"cpu:N",
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
player 1 (or the human against a CPU) sends its canvas as a WebRTC video (`captureStream`, ~540p, 30 fps, ≤ 1.5
Mb/s, at most 6 viewers) **with the game's sound** to whoever presses «📺 Ver la pelea en vivo». The sound is
tapped *before* the player's own volume (`pagina.js` 0a wraps `AudioContext` after `volumen.js`: the game's
`destination` becomes a `pre` gain → the player's volume, plus a `MediaStreamDestination` when someone watches;
`Module.audioJuego()` reads it from `Module.SDL3.audioContext` only), so a muted player is still heard; the viewer
has its own 🔊 and slider (`jg.bt3.tele`). Signalling goes through the
mesh's mailbox (`vivo/<pid>/rtc`, open to anyone signed in) with its own message types (`ver`, `vof`, `vans`,
`vcan`, `vfin`, `vlleno`); the frame's mailbox proxy now takes several listeners (mesh + emitter). The viewer's
screen closes itself when the fight ends. Friends find running rooms in «En juego ahora»
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

**The room does not rank** (`anotar` skips `bt3`) and its ten logros are room-detected (`SIN_FILA` in `logros.js`).

**Character rules from a tier list** (duel and tournament, `{t:"ajuste", k:"veto", v:""|"noop"|"malos"}`, one
setting so the two are mutually exclusive): «No OP» bans tiers BROLY..S, «Sólo malos» bans BROLY..B (C, D and N/C
stay allowed).
The list is `colabtex/src/juegos/bt3-tiers.js`, read by eye from the r/tenkaichi4 «comp discord» image: 161
portraits = the game's 161 ids (one per form). **Character names are not in the code, they are on the disc**, so:
the patch hands the select screen's name/form texts (sections 43/44, line n = id n, UTF-16 high byte first) to
`Module.onCatalogo` once (`Web_Catalogo`, CharSel and TeamSel init) → the frame posts `catalogo` → the room maps
entries to ids by words (`vetadosBt3`; aliases and exclusions per entry, fewest extra words wins), caches the
catalog in `bt3.catalogo`, and sends `vetados` in `estado` → `Module.vetados`. The patch asks `web_vetado(id)`:
CharSel refuses a banned grid cell/form/custom pick with the error sound and its random cell (and the CPU's draw)
redraws until allowed; TeamSel puts it in `TeamSel_IsCharaFree`, so it is also greyed and skipped at random. Both
peers read the same disc and rule → same refusals and same draws (no desync); with no catalog yet nothing is
banned. **Mid-fight too**: `BattleSide_IsCharaUsable` (battle_load.c) refuses a banned id, and it is what
`BtlAct_CanTransform`/`CanFuse` ask (human and AI), so a banned form cannot be reached by transforming or fusing.
The player sees the ban: CharSel draws banned chips dark (`CharSel_WebApagado`: a form, or a cell whose forms are
all out; TeamSel greys through `IsCharaFree`), and while a select screen is open (`Web_Seleccion` → 
`Module.onSeleccion`) the frame shows a foldable side panel with the banned list by tier (`#vetos`,
`estado.vetadosLista`, folded state in `bt3.vetosPlegado`). «Ver los vetados» in the
room lists each entry with the in-game name it matched (or «no se encontró»): **check it against the real disc**
— one S+ portrait (gold, pointed ears, armour) was not identified and is left out. The bench's «Abrir la
selección de personajes» posts a hand-written USA-style roster to exercise this without the disc.

## One player: the modes

Four modes, and only four: **Entrenamiento, Contra la CPU, Duelo, Torneo**. The solo page (`?modo` ≠ `online`)
shows them as a Snake Club–style column next to the start card (`2b` in `pagina.js`, styles in `pagina.py`), each
with a gi-patch emblem drawn by us (亀 機 闘 天; Noto Serif JP subset to those four glyphs) — never game art,
remembered in `bt3.modo`, preselected by `?juego=entrenamiento|cpu|duelo|torneo`.

- Entrenamiento / Contra la CPU play here. **Nothing starts by itself on the solo page**: the private disc and the
  remembered ISO wait for «Jugar · <modo>» (`listoParaJugar`), which is also the gesture that unlocks audio; picking
  an ISO is itself the click. The mode reaches the program as `BT3_WEB_MODO` (`Module.entornoPendiente`), and
  `__wrap_Progress_Main` (patch, `headless.c`) sets `gProgress->mode` before the menus run, as the online session
  does: `cpu` = mode 39 (versus character select, `+0x620 = 0` 1P vs COM), `entrenamiento` = mode 44 (the game's
  training menu: lessons and free training).
- **Back buttons.** «◀ Atrás» in the bar presses player 1's Triangle (the game's back in every menu) through
  `Web_TouchSet`, only while the menus run (`web_en_menus` around `__real_Progress_Main` → `Module.onMenus`; in a
  fight Triangle is an attack). «← Modos» (solo) and «← Sala» (room frame: cuts the fight, `termino`) leave.
- Duelo / Torneo are rooms: the button posts `{tipo:"sala", cupo}` (2, or 8 for a tournament) to Juegos, which
  opens it (`alPedirSalaBt3` in `bt3.js`, registered by `juegos-main.js`). Outside Juegos it links there.
- **No back door to the rest of the game.** Backing out of the chosen mode into the game's other menus (main
  menu; in a tournament fight also the versus menu) is caught by the patch (`Port_Trace` in `headless.c`, after
  the first-run part) and reported once to `Module.onFueraDelModo`: the solo page reloads to the mode selector,
  a room frame tells the room (`termino` → the fight is cut). «← Modos» in the bar does the same on purpose.
- The save rules the patch writes (time limit rule[0], CPU strength rule[1]) are written only after the card
  check, because loading the player's save would overwrite them.

## Speed

- **60 fps by default**: the game simulates at 30 like the PS2; the port's "Smooth motion" draws in-between
  pictures. The patch defaults the `interp` setting to 1 in the browser build (`gs_draw.c`); a player can turn it
  off in Ajustes → Video. It is a display-only blend (+16.7 ms of display latency), so lockstep play is unaffected.
- **Nothing is downloaded twice.** The first load fetches the `.wasm` with a progress bar into a blob; from then on
  (`localStorage` `bt3.wasm.<url>`) the program loads from its URL, so Chrome serves it from the HTTP cache *and*
  reuses its compiled code (measured: 3.6 MB/600 ms → 0 bytes/80 ms). The private disc's pieces are kept in Cache
  Storage (`bt3-disco:<size>`): a second session asks the Worker only for `indice.json` (which still checks the
  friends list). The game itself never reads the whole ISO: `webDiscEnsure` copies one file at a time as it opens it.

## Page details

- `volumen.js` loads before the program, so the site's mute/volume governs the game's `AudioContext`.
  `mando.js` is **not** loaded: the game reads controllers itself (SDL3), and synthesised keys would double every
  button.
- "Ajustes" calls `Module._Web_Settings(3)` (patch, `ui.cpp`): the F1 window on Controls (which controller each
  player uses, remapping). The in-game "Dragon Net Battle" menu points players to the rooms instead.
- `?log=1` shows the program's log; it also opens by itself if the program exits or aborts.

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
  `juegos-main.js`), open rooms, games in progress, ranks and logros, and a BT3 room shows "Esta sala es privada". BT3 rooms are never announced on Discord; they are in
  `enCurso` (juego and names only) so friends can watch, and only friends are shown them. This hides the game; the page files are public like the whole site (they hold nothing of the
  game), and the disc itself is what the Worker protects.
- The frame gets the token from its parent (`bt3.js` answers `{tipo:"token"}` only to a same-origin iframe
  loading `/juegos/bt3/index.html`) and, if `indice.json` answers, starts on the private disc without the ISO
  picker (`discoPrivado` in `pagina.js`); otherwise it falls back to the remembered ISO, then to choosing one.
