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
agreement decides, disagreement → organizer `decide`; a draw is refought; leaving forfeits. Each fight is also a
`ronda` in `hist` so the duel's logros apply.

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

## One player: the modes

Four modes, and only four: **Entrenamiento, Contra la CPU, Duelo, Torneo**. The solo page (`?modo` ≠ `online`)
shows them as a Snake Club–style column next to the start card (`2b` in `pagina.js`, styles in `pagina.py`),
remembered in `bt3.modo`, preselected by `?juego=entrenamiento|cpu|duelo|torneo`.

- Entrenamiento / Contra la CPU play here. **Nothing starts by itself on the solo page**: the private disc and the
  remembered ISO wait for «Jugar · <modo>» (`listoParaJugar`), which is also the gesture that unlocks audio; picking
  an ISO is itself the click. The mode reaches the program as `BT3_WEB_MODO` (`Module.entornoPendiente`), and
  `__wrap_Progress_Main` (patch, `headless.c`) sets `gProgress->mode` before the menus run, as the online session
  does: `cpu` = mode 39 (versus character select, `+0x620 = 0` 1P vs COM), `entrenamiento` = mode 44 (the game's
  training menu: lessons and free training).
- Duelo / Torneo are rooms: the button posts `{tipo:"sala", cupo}` (2, or 8 for a tournament) to Juegos, which
  opens it (`alPedirSalaBt3` in `bt3.js`, registered by `juegos-main.js`). Outside Juegos it links there.

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
  `juegos-main.js`), open rooms, games in progress, ranks and logros, and a BT3 room shows "Esta sala es privada". BT3 rooms are never announced on Discord nor in
  `enCurso`. This hides the game; the page files are public like the whole site (they hold nothing of the
  game), and the disc itself is what the Worker protects.
- The frame gets the token from its parent (`bt3.js` answers `{tipo:"token"}` only to a same-origin iframe
  loading `/juegos/bt3/index.html`) and, if `indice.json` answers, starts on the private disc without the ISO
  picker (`discoPrivado` in `pagina.js`); otherwise it falls back to the remembered ISO, then to choosing one.
