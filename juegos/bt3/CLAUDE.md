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
- The session environment (`BT3_NET_HOST`/`RULES` or `JOIN`) is set in `ENV` right before `callMain`: nothing reads
  the environment before `main` (the constructors don't), so the frame does not reload into the session like the
  fork does, and the ISO is chosen once per fight.
- Only STUN: two networks that refuse a direct connection cannot fight; the frame says so after 45 s and the room
  goes back to the lobby. A TURN relay would fix it (not done).

The lobby (`redBt3` in `motor.js`): `anfitrion` (**either player picks who hosts**; the host is the game's player 1
and sets the rules), `ajuste` (`batalla`, `tiempo` → `reglasBt3`, the word `gs/net.c` reads), `disco` (that frame
loaded a valid ISO; both needed), `empieza`, `vuelve` (back to the lobby; frames reload, discs re-confirm).

**The room does not rank**: the game never tells the page who won, so `anotar` skips `bt3` (like PRO HERO), and
its ten logros are all room-detected (`SIN_FILA` in `logros.js`: no first-win/streak row logros).

## Page details

- `volumen.js` loads before the program, so the site's mute/volume governs the game's `AudioContext`.
  `mando.js` is **not** loaded: the game reads controllers itself (SDL3), and synthesised keys would double every
  button.
- "Ajustes" calls `Module._Web_Settings(3)` (patch, `ui.cpp`): the F1 window on Controls (which controller each
  player uses, remapping). The in-game "Dragon Net Battle" menu points players to the rooms instead.
- `?log=1` shows the program's log; it also opens by itself if the program exits or aborts.
