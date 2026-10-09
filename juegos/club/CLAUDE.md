# Solo Club — shared rules

Every game under `juegos/club/` (plus Frontera). Each one has its own `CLAUDE.md` in its folder. Club plumbing: `juegos/club/conexion.js`, `colabtex/src/juegos/solo/`. Wiring of logros/coins/ranks: `docs/claude/juegos/perfiles-y-economia.md`.

## Antitrampas (`docs/antitrampas.md`)

**A club record is not believed, it is checked.** `Club.result(dato,
prueba)` sends a *proof* (seed, moves with their instant…) and
`solo/club.js` runs it through `verificaClub` (`solo/verifica.js`, one
module per game in `solo/verifica/<juego>.js`: `PRUEBA`, `verifica`,
`sospecha`) **before** anything is saved, paid or turned into a logro. A
rejected result is not saved, the frame gets `club-rechazo`, and a
`sospechas/<uid>` entry is written for the admins. A verifier that throws
rejects. What waits in `localStorage` (`jg.club.pendientes.*`) is verified
again on load, because that store can be edited by hand. `guardaClub` in
`juegos-main.js` writes the proof (`soloPruebas/<cat>/<uid>/<partida>`)
before the row, and only when the row improves; the rules refuse a
`soloRanks` row without its proof, so every record can be audited later
with `colabtex/scripts/auditar-club.cjs` over a console export (never
commit an export: the repo is public). Admins delete rows and set
`vetados/<uid>`; a vetted account cannot write records, club plays or
podiums, and `watchSolo`/`leerSolo` hide it. Daily streaks (`club-*-racha`)
are capped by `rachasClub/<uid>/<cat>` = `{dia, n}`, which the rules only
let grow by one per Chile day (`rachaClub` in `club-datos.js`; a first
write may continue the streak already in the table). The honest limit: a rewritten
client or a bot can still produce a valid proof; only a server (Cloud
Functions) closes that. Each game's specifics are in
`docs/antitrampas/<juego>.md`.

**Records are also judged by how they were played**
(`solo/verifica/patrones.js`, `docs/antitrampas.md` §4 bis). A proof that
replays still rejects when the inputs show a program: runs of keys in the
same millisecond (Tetris), fruits reached by the shortest path with no
spare tick (Snake), cells solved in reading order (Sudoku), flaps at the
same height above the gap (ALETEO). They look at **consecutive** windows,
never averages, and each threshold is calibrated against the real tables.
Speed hacks are caught by `dosRelojes`: new Sudoku and ALETEO proofs count
the time played with `performance.now` (`a`) and `Date.now` (`w`), and
more than 5 % apart (past 20 s) rejects. **Raise `AUDITORIA_V`
(`admin-datos.js`) whenever a verifier gets stricter**: verdicts in
`auditados` carry it as `vv`, older ones are re-queued, and the Auditoría
tab verifies the queue by itself once per visit. Admins also get a 🗑 on
every club row of the Clasificación (`ranks.js`, `esAdmin`/`borraRecord`
in its ctx, the same `fb.borraRecord`). `vv` needs the rules re-published.

**Deleting fake records can leave an account *parada*** (its earnings drop
retroactively, an old purchase becomes unfunded and every later coin goes to
cover it). `juegos/cortes.js` fixes that without debt: `<uid>: {hasta,
tope}` makes `economia()` judge that account's spending up to `hasta`
against `tope` and simply void what did not fit instead of stopping it.
`colabtex/scripts/cortes.cjs` computes them from a console export.

**A rejected game is also punished** (`juegos/castigo.js`, assets in
`juegos/castigo/`, `docs/antitrampas.md` §6): `sospechaClub` calls
`castiga` when `esTrampa(s)` — a fake Windows blue screen for
`PANTALLAZO_MS` (10 s), GTA's «wasted», then a ten-minute **retention**
overlay over all of Juegos. Only a game **just played** counts (`vivo`,
set by `solo/club.js` for «en vivo» and by `frontera.js` for the win just
earned): never a `localStorage` pending re-verified on load (it may come
from an older engine), a verifier that threw, or a proof too big. While
`castigoActivo()`, `render()` mounts nothing and destroys what was mounted
(a club game kept playing under the overlay); when it ends the overlay
calls back and the route is mounted again, no reload. The retention lives
in `users/<uid>/castigo = {at}` (server time, already owner-only, **no rules
change**; watched live, re-checked when `.info/serverTimeOffset` arrives so
moving the clock forward does not shorten it) and in `localStorage`
`jg.castigo = {h, u}`, which covers the moment before auth and guests but
not **another account** on the same browser. Both are the player's own, so
a console can delete them: the punishment deters, the rejection protects.

## Modo celular (pantalla completa mientras se juega)

Tetris Club, the Tetris room, ALETEO and FANAL go **immersive on a phone in
portrait** (`pointer:coarse`, the smaller side ≤ 600 px, taller than wide);
desktop and landscape are untouched. In a Club game, `Club.inmersivo(on)` in
`conexion.js` decides it (`Club.celular()` measures `window.top`, since the
iframe only measures what the page gave it), toggles `html.club-inm` in the
frame and tells the parent, where `solo/club.js` toggles `html.jg-club-inm`
(the iframe fills the window, the site chrome hides; `destruir` removes it).
A rotation re-evaluates it. Each game turns it on at «Jugar» and off on pause
and game over, so the menu, the ranking and the footer come back with them;
FANAL syncs it every frame from its own state. The Tetris room is painted by
the page itself, so `tetris.js` toggles `html.jg-tt-inm` (only while
`juego()`, i.e. playing and not out). The layout in all of them: a thin data
bar on top, the game filling the rest without distortion (`100dvh`,
safe-area insets, no scroll/zoom/selection), and a control strip of at most
~15 % of the height with buttons ≥ 48 px — Tetris `◀ ▼ ▶ ⟳ ⤓ ⇄` (⟲ hidden),
rival wells in a narrow right column in the room; ALETEO flaps on a tap
anywhere; FANAL ◀ ▶ left and ✦ right. Only the screen changes: the controls
send the same actions as the keyboard, so proofs, `mando.js` and the
generated `controles-datos.js` are unaffected.
