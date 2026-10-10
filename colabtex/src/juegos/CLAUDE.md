# Juegos — shared architecture

Read this for any Juegos work. Each game has its own doc too: see the docs map in the root `CLAUDE.md`. Lobby/salón: `docs/claude/juegos/salon.md`; profiles, ranks, logros, coins: `docs/claude/juegos/perfiles-y-economia.md`; music, volume, controllers: `juegos/audio/CLAUDE.md`; Solo Club: `juegos/club/CLAUDE.md`.

Nineteen games, on the same Firebase project and the same Google session
as ColabTeX and ColabDraw. Turn-based on purpose (Tetris and Yemas are the
real-time exceptions, and both still keep the log to what decides the game): with one move per turn the
network carries a handful of fields and there is nothing to interpolate, so no
game loop ever has to be synchronised.

**How many people fit is a property of the room, not of the game.** `JUEGOS`
declares `minimo` and `cupo` (escondite, cartas, reversi and ajedrez are duels by
construction — two landscapes, one clash, two colours; yemas has
`minimo: 1`, but `minimoDe(p)` lowers it to one only for the zombies variant,
which is the one that can be played alone), and whoever opens the
room picks inside that range along with anything else the game offers;
`crearPartida(juego, quien, extra)` writes those over the defaults, so a game
that offers nothing passes nothing. The lobby's player-count options are
derived from `JUEGOS` (`cupos(k)` in `juegos-main.js`), so raising a `cupo` is
one number in `motor.js` plus the rule's ceiling
(`partidas/$pid/cupo` `.validate`, now `<= 10`). Each ceiling is where *that*
game stops working, not a round number:

- **cuadritos, 10.** Nothing on the board depends on the count; with ten a
  4×4 board is thin, which is the host's choice to make.
- **cadena, 8.** Colour is by seat (`PALETA`), and eight is how many tones can
  still be told apart at a glance on an orb.
- **flip7, 10.** Past eight the half moon stops being a diagonal: nine and
  ten sit three per side plus a row along the bottom, in a 1260 px room with
  150 px seats (`PUESTOS`) — following the diagonal to the bottom stacked
  the lower seats on top of each other. The deck holds up (it reshuffles the
  discard), and `tests/flip7.test.cjs` plays robot games up to ten to prove it.
- **cacho, 8.** Forty dice on the table: past that a bet of «22 quinas» is
  a lottery rather than a read, and the oval stops holding the cups.
- **uno, 10.** Nothing on the table depends on the count: every player
  draws from a deck of their own (below), so the box never runs short, and
  the seats are a grid of cards that wraps (`.jg-un-asientos`) rather than
  places around a table.
- **catan, 6.** What the 5–6 extension admits: past that the big island has
  no coast left for everyone. Five or more players switch the board to the
  30-hex one and turn on the special building phase by themselves.
- **worms, 8.** Eight squads of six spawn on all four maps; at ten `tidal`
  runs out of ground. The frame's `engine.js` carries eight colours, eight
  team names and 48 engineers' names, and clamps humans/bots to eight.

Cuadritos also offers three board sizes (`TAMANOS`, 4×4 to 7×7 boxes).
`cupoDe(p)` / `ladoDe(p)` clamp what comes back from the database to what the
game admits, which is also what makes a room created before any of this existed
read as the two-player 6×6 it was. With a cupo above the minimum the room does
**not** start by itself when it fills — a room for six with four inside would
never begin — so the host gets an *Empezar* button, and closing the room is
also what bolts the door, since the rules only let someone in while the state
is `esperando`.

**Winning has a screen, and it is a fixed layer.** `datosFin(p, est)` in
`juegos-main.js` reads the outcome from `partidas/<pid>/fin` when it is there
and from the reducer's own `fase === "fin"` when it is not, so the cartel
appears the moment the board says the game is over rather than waiting for the
write that closes the room. It is `position:fixed` (`.jg-fin-capa`) for a
reason that was a real bug: as an ordinary block after the board it rendered
*below* a board taller than the screen, so winning looked like nothing
happening. There are four faces — won, lost, drawn and "you were watching" —
plus the final scoreboard and a ✕ that dismisses it, because looking at the
finished board is half the point. Each screen additionally refuses to act on
`fase === "fin"` (`alClic` returns, `echar()` requires `"jugando"`): the
central `jugar()` gate already blocks the *write*, but without the local guard
the UI still highlighted a card and invited a move that no longer exists —
which is what "you can repeat the last move infinitely" was.

**The cartel waits for the last move to be seen.** Appearing "the moment the
board says so" was itself the next bug: the winning box, the last flipped
discs or the final clash were still animating — or had not even been painted —
when the overlay covered them, so the last point looked uncounted. `pintaFin`
now holds the cartel back in two steps: while the screen says `ocupado()`
(Chain Reaction's replay), and then for a per-game grace (`PAUSA_FIN`, 0.8 s
for cadena up to 2.8 s for the cartas clash) counted from the moment the end
was **first seen** (`finDesde`), which restarts if `ocupado()` comes back. The
grace applies only to a game this tab watched live (`finVivo`) and never to an
abandono: opening a room that finished yesterday, or seeing your rival leave,
shows the result at once. The **fanfarria lives there too**, played once per
room, and only for a game seen live, when the cartel actually appears
(`finSonado`) — each screen used to play
its own `sonoFin` on the same repaint that decided the winner, so the victory
sounded before the move that won it. Worms is excluded: its frame has its own
ending music. The last point also has to be *visible*: a closed box pops in
(`.jg-caja-nueva`), a score that just went up bounces (`.jg-m-sube`, cuadritos
and órbita), and in órbita the launch itself is replayed before the cartel.

**A hidden tab does not get the cartel until it comes back.** The loser was
the one who never saw the ending: the winner is looking at the board when the
last move lands, the loser is usually in another tab waiting for their turn,
and every timer there — the grace, the replay, the flights — ran with nobody
watching, so the first thing on screen on returning was «Perdiste». So
`pintaFin` does nothing while `document.hidden` for a game seen live that did
not end by abandono (it resets `finDesde`), a document-wide `visibilitychange`
listener in `juegos-main.js` calls it again on return, and the screens that
animate keep the move they skipped (`pendiente` in `cadena.js` and `flip7.js`)
and play it on their own `visibilitychange` (`alVolver`) — so the grace is
counted from the moment the move was actually seen. The final scoreboard
reads `est.puntos` before `est.cuenta`: `redCadena` returns `puntos` with **0
for anyone `fuera` or `caido`**, because someone who abandons leaves their orbs
on the board and `cuenta` showed an eliminated player with their score from
before dying; `cadena.js`'s marcador does the same once the replay is over.

`juegos.html` carries the whole `.jg-*` stylesheet — unlike CSV·Scope this is a
plain page, not a generated `.dc.html` with nowhere to put it, so the skin
caches with the page instead of being injected on every load. Its header is a
**deliberate copy** of `informes.html`'s: the shared part is a dozen rules, and
a common file for that costs more than it saves.

**The room has an immersive mode** (⛶ in its header, `ponInmersivo` in
`juegos-main.js`): `html.jg-inm` turns `#pantalla` into a `position:fixed;
inset:0` layer with the site header hidden, and asks for real fullscreen
where the browser has it — iOS has no element fullscreen, so the class alone
has to be the whole effect. The chat becomes a background-less overlay in the
bottom-left corner whose messages fade out: each carries `--edad` (seconds
since `at`, from `fb.ahora()`) and a 10 s animation starts at
`-var(--edad)`, so an old message does not relight on repaint. 💬 or Intro
opens it to write, Escape closes it or leaves the mode. Leaving the room
always leaves the mode (`armazon`).

**Dark mode is one block at the end of that stylesheet**, every rule prefixed
`html[data-tema=oscuro]`. The prefix out-ranks the light rule without touching
it, so the light theme stays exactly as it was: when you add a light surface,
add its dark twin there too. The block redefines `--jg-ink`/`--jg-muted` and
adds a few `--os-*` surface and border tokens. It darkens only the chrome: page,
cards, rooms, chat, end-of-game panels, dialogs, tables, footers and the
Flip 7 history. The art keeps its own colours: the covers are already dark,
the Flip 7 table is felt, cards are white like real cards, and the Reversi
board is green. The attribute is set by a tiny inline script in `<head>`,
before first paint; waiting for the bundle flashed the light page first.
With nothing stored it follows `prefers-color-scheme`, live. The ☾/☀ button
(`wireTema` in `juegos-main.js`) stores an explicit choice in `jg.tema`, and
from then on that choice wins over the system setting.

**The move log is the state.** A game lives in `partidas/<pid>` and everything
that happens is one append-only entry in `jugadas/<0000…>`; `reducir(partida)`
in `juegos/motor.js` replays that log into whatever the screen draws — whose
turn it is, which phase is running, who won. **No client ever writes a derived
board**, which is what makes the two screens agree without either of them
being the authority: there is nothing to disagree about, only a list to
replay. It is also what makes cheating structural rather than a matter of
trust — the rules refuse a second write to the same key, so a move cannot be
taken back, and a move out of turn simply does not exist for the reducer.

`fb.jugar` writes the entry with `runTransaction` on the **exact** key, not with
`push`: when both players write move number 4 at the same instant the second
transaction aborts, `jugar` returns false, and `juegos-main.js` re-reads the log
and retries with the next index (up to 25 times). A `push` would have accepted
both and left the log with two move fours in an order neither client chose.

**`terminar` waits for the moves still in flight** (`enVuelo` in
`juegos-main.js`, a Set of the `jugar` promises not yet settled). The SDK fires
a transaction's *optimistic* events synchronously, so the screen sees the
winning move — and calls `terminar` — before that move has reached the server.
Writing `fin` right away sent it ahead of the move, and the rules then refused
the move itself (`jugadas/$n` requires `!fin.exists()`): the room closed on the
board *before* the winning move, which is exactly how the loser in Chain
Reaction kept their old score and neither side saw the final chain. So
`terminar` awaits `Promise.allSettled(enVuelo)` and writes `fin` only if the
state it re-reads really says the game is over.

**What is chosen at the same time travels as a hash first** (`compromiso`,
SHA-256 over the value plus a random salt). Both games with hidden information —
the escondite's hiding place and the card's index — publish the hash, and only
when both hashes are up do they publish value and salt. Without it, whoever
wrote second would read the other's choice out of the database before making
their own. The honest limit is stated in the code and on the screen: the
browser that is searching has to draw the other's character to let it be found,
so those coordinates are in its memory and anyone who opens the developer tools
will see them. There is no way around that without a server that arbitrates,
which is exactly what this site does not have.

**Sound is driven by the move log, not by the click** (`juegos/sonido.js`, a
small WebAudio synth — no files to host, no CORS, nothing to wait for). Playing
it on the local click would make the game silent for everything the *opponent*
does, which is most of what you are waiting for; watching the log grow instead
means both sides are audible. Each screen counts `partida.jugadas` between
repaints and, where it matters who moved, reads the author out of the raw log
with its own little `ultimoAutor` — the reducers record the move, never who
wrote it, and adding an author to the state for a sound effect would put a fact
in two places. The header's 🔊 mutes it, persisted in `localStorage` under
`jg.sonido`, and the context is created on the first gesture because a browser
refuses one before that.

**Voting someone out is a move, not a new mechanism** (`votacion` and
`mayoriaExpulsion` in `motor.js`). A vote is `{t:"voto", uid, contra}`, and
withdrawing it is another entry with `no:true`, so the log stays append-only
and the rules needed nothing new. `reducir()` runs `votacion(p)` **before**
any game reducer. The vote that reaches the majority of the *other* players
still in the room is rewritten, at read time and at its own key, as
`{t:"abandona", uid, expulsado:true, por}`. Every game already handles a
player who left. Votes that expel nobody are removed before the game reducer
sees them, so no game had to learn to ignore them. `est.votos` (who is voting
against whom) and `est.expulsados` (`[{uid, por, k}]`) come out alongside.
Order decides here too:

- a vote counts against the room as it is at that moment;
- a vote from or against someone already gone does not count;
- pending votes do not fire by themselves when the room shrinks.

With two players the majority is one vote, so expelling someone means
winning. That is why `pintaQuienes` in `juegos-main.js` offers the ⏏ button
in a duel only when the move is not mine and the board has not moved for
`VOTO_DUELO_MS` (90 s). The reducer cannot check that delay because moves
carry no time, which is the same price abandonar already pays. With three or
more players the button is always there. It is never shown to spectators,
against yourself, or against someone already out. The seat stays in the
header, struck through (`.jg-quien-chip.fuera`), and the fin cartel names who
was expelled and by whom (`.jg-fin-exp`). Circuit Breakers needs one extra
step: `worms.js`'s `reenvia()` reads the **raw** log to forward `abandona`
entries to the frame, and an expulsion is not in the raw log, so it also
forwards `est.expulsados`. Without that the expelled squad kept playing
inside the iframe. `tests/votos.test.cjs` covers the majority table, vote
withdrawal, votes that come too late, and each reducer treating an expulsion
as an abandono.

**Anyone signed in can watch a room** (spectator mode). The rules already
let everyone read `partidas/`; what was missing was a screen that did not
assume the viewer plays. `soyJugador()` in `juegos-main.js` gates `jugar()`
and `terminar()`. Every module gets `ctx.mirando`, and a spectator's
`secreto()` resolves `null` without touching `misPartidas`. Cartas is the
only screen that needed real work: a spectator sees the duel from the first
player's seat, with no hand (it is secret by construction) and every "tú"
replaced by a name. Flip 7's `cierre()` returns early for a spectator, which
otherwise re-armed its one-second timer forever. `anotar()` already skipped
non-members. For games in progress to appear in the lobby ("En juego
ahora"), each player's tab writes a small notice to `enCurso/<pid>` while the
game runs, refreshing it every five minutes (`enCursoToque`) and removing it
(`fb.quitaEnCurso`) when the game ends; the lobby queries only notices
newer than `EN_CURSO_FRESCO` (15 min), so a tab that died mid-game drops
out by itself. Nobody
has to listen to `partidas` as a whole, which would download every move log.

**Rooms close themselves after six hours without a move** (`salaInactiva`
and `ultimaActividad` in `motor.js`, `INACTIVA_MS`). The last activity is the
latest of the room's `at`, `toque` (the server time of the last move or join,
written by `tocaSala` in `juegos-main.js` at most every ten minutes per tab,
and by `fb.unirse`), each ficha's `at` and `fin.at`. Rooms from before `toque`
also count the `at` some moves carry (chess). Closing writes
`fin = {ganador: "", motivo: "inactiva"}` and then `estado = "fin"`
(`fb.cierraInactiva`). The rules let anyone signed in do that only when `at`
and `toque` are both six hours old, so nobody can close a live room that is
not theirs. Three places trigger it: the lobby, for waiting rooms (which it
also stops offering); a room on open, unless the board already says the game
is over (then the module closes it with its winner); and «Tus partidas»
(`revisaMias`), which looks at the header of every entry older than six hours
through `fb.resumenSala` (never the move log) and drops from the list any room
that is gone, closed or dormant. `anotar` skips `motivo: "inactiva"`: a room
that closed itself was not played and does not count for the ranking. Solo
club games (BBTAN, sortEm, the Sopa…) have no room and are untouched.
`tests/salas-dormidas.test.cjs` covers the arithmetic and `test-rules.mjs` the
rule.

**The room chat lives outside the move log**, in `chat/<pid>`. The log is the
state, and a «hola» must not change whose turn it is. Players and spectators
both write to it, each message is written once and signed with the writer's
own uid, and the length is capped at `CHAT_LARGO` characters. The spectator
tag on a message is computed at paint time from `partida.jugadores`, not
stored. Both new nodes, `chat` and `enCurso`, need the rules re-published
(`firebase/CONFIGURAR-FIREBASE.md`). Until then games play normally, but the
chat sends nothing and the lobby shows no games in progress.

**A `PERMISSION_DENIED` now says what to do about it.** The rules in the repo
are not the rules in force: they are published by hand in the console and
pushing to Pages does not deploy them, so the live copy lags behind every new
game. Reversi was refused for exactly that — `database.rules.json` lists it in
the `juego` whitelist, the deployed copy did not, and a room of a game the
rules have never heard of cannot be created. A bare `alert("permission denied")` left
no way to tell that apart from a bug, so `juegos-main.js` routes it to a
`.jg-fin-capa` overlay with a **Copiar las reglas** button: the site serves its
own repo, so `firebase/database.rules.json` is fetchable same-origin, and the
panel links straight to Realtime Database → Reglas.

**Cuadritos and reversi are SVG, cartas and the escondite are not.** What has
to be hit with the mouse in cuadritos is a two-millimetre line, so each gap
carries its own fat invisible click zone
(`.jg-hueco{stroke:transparent;stroke-width:16}`) and the browser aims for you;
painting that zone would draw the board full of lines that are not there.
Reversi's legal-square hint is the same idea from the other side: the dot is a
third of the square, so the clickable `<g>` wraps a transparent rect covering
the **whole** square — hitting the dot with a finger would be marksmanship,
not play.

**Repaints go by signature.** Each region of each screen builds a signature
string and skips the `innerHTML` when it has not changed. Rewriting it on every
tick restarts the CSS animations, and the cards would blink forever.

Modules in [colabtex/src/juegos/](colabtex/src/juegos/):

- `motor.js` — everything pure: the `JUEGOS` table, the seeded PRNG, the
  commitment, the escondite's scene, the card decks and their resolution, the
  dots-and-boxes arithmetic, the reducer and the ranking. No DOM, no Firebase —
  verifiable from Node.
- `paisaje.js` — draws the scene `motor.js` decided. Split from it because the
  only thing the two machines must share is the layout, and that is a number.
- `escondite.js`, `cartas.js`, `cuadritos.js`, `reversi.js`, `cadena.js`,
  `flip7.js`, `cacho.js`, `uno.js`, `catan.js`, `ajedrez.js`, `ranks.js` — one screen each.
- `reglas.js` — the 📖 manual of every game (`abreReglas`, `tieneReglas`); see
  below.
- `sonido.js` — the WebAudio synth and the mute flag. No DOM beyond the header
  button's state, no Firebase.
- `perfil.js` — the profile editor: `COLORES`, `mezcla` (ficha + perfil → what
  is painted, pure and verifiable in Node), `recorta` (the browser-side 160×160
  centre crop to a JPEG data URL, which is what keeps the photo at ~15 kB) and
  `abrePerfil`, the modal.
- All of them expose the **same shape**: `crearX(ctx)` with
  `ctx = {uid, pid, jugar, terminar, ahora}`, returning
  `{montar(hostEl), actualizar(partida, estado), destruir()}`. Adding a
  game is a file, a row in `JUEGOS`, a row in `FABRICAS` and one in the
  rules' `juego` whitelist — and an entry in `reglas.js`. `ranks.js` is the exception —
  `crearRanks({uid, watchRanks})` with no `actualizar`, since it watches its
  own node.

**Every game has a manual** (`reglas.js`, the 📖 **Reglas** button). It is a
modal hanging off `<body>` in `position:fixed` at z-index 80 — above the fin
cartel (60) and `jg-modal-capa` (70), because the question «what did this card
do?» comes up exactly when the cartel is on screen. It opens from three
places: the room header (mid-game, which is when people ask), the ficha of
every game in the lobby (before opening a room — it opens on the variant
picked in the ficha's options), and a bar above the solo games' iframe (Mina
Club, Snake Club). Games with variants (UNO, Flip 7, cacho with or without
*siciliana*) get one tab per variant and open on the room's: whoever is
playing No Mercy need not read the whole classic first. The text describes
**what the engine does, not what the box says** — where this version departs
from the table game (UNO draws from private decks, Flip 7 does not shuffle)
the manual says what happens here. Change a rule in `motor.js` and change it
there too: a manual that lies is worse than none. Escape, the backdrop, ✕ and
«Entendido» close it, and focus goes back to the button that opened it.

**"Your turn" is in the tab title.** `meToca(est, uid)` answers for every game
(the escondite's hiding phase and the cartas commit are simultaneous, so there
it means "you still owe a move"), `avisaTurno` prefixes `● Tu turno ·` to the
title, and the `turno` chime plays **only when the tab is hidden** and only on
a change after the first snapshot — reopening a room where it is already your
turn should not ring.

`colabtex/src/fb-juegos.js` is the data layer, over three nodes **outside**
`projects/` for the same reason the reports are: a game belongs to the team,
not to anybody's document. Two rule facts shape it, and its header says so:
a move is written once and never rewritten, and **a `.write` granted on a
parent cannot be revoked by a child** — so `partidas/$pid` grants write only to
create the room or to let its host delete it, and estado, players and moves
each hang off their own child rule. A convenient `.write` at the top would have
let anyone rewrite a whole game, and no rule below would have stopped it.

The lobby queries only `estado === 'esperando'` (`orderByChild`, with its
`.indexOn` in the rules), which are exactly the games that do not have a single
move yet: listening to `partidas` whole would have pulled down the move log of
every game ever played. The clock comes from `.info/serverTimeOffset`
(`fb.ahora()`), because the escondite counts down to a specific instant and the
two computers' clocks do not agree.

**A new room is announced on Discord** (`juegos/discord.js`), with no bot
and no server: a Discord *webhook* that the host's own browser POSTs to
(Discord answers CORS for it) right after `crear()` in `juegos-main.js`.
Rematches are not announced, and neither is `localhost`. The webhook URL is
**not in the bundle**. It lives in `discord/webhook`, readable by anyone signed
in and writable by nobody from the web, and is pasted by hand in the console,
with an optional `discord/mencion`. So a leaked URL is fixed by swapping that
value, with no build. The message carries a link button (`style: 5`, sent
with `?with_components=true`, the only kind a plain webhook may send), and it
is retried without components on a 400. It never throws: a room that could not
be announced plays the same. `mensajeSala` is pure and tested in
`tests/discord.test.cjs`.

The same webhook announces a **club record that lifts someone onto the
podium** of its category (`anunciaPodio` / `mensajePodio`). `crearSolo`
receives `guardaConPodio` from `juegos-main.js` instead of `fb.guardarSolo`.
It reads the category **before** writing (`fb.leerSolo`) to learn the old
place, and it derives the table after the write with `conRecord` instead of
reading it again. It announces only when the transaction committed and the
place **improved** to 1–3: beating your own time while staying second is not
news. `ordenSolo` is the club table's own order (points, then time, then uid),
so the announced place is the one the club shows. No rules change was needed,
because `soloRanks` is already readable by anyone signed in.

**The new nodes need their rules published by hand** in the Firebase console,
exactly like the reports' (`firebase/CONFIGURAR-FIREBASE.md`). Until then
everything fails with `PERMISSION_DENIED`, and the lobby says so in plain
language instead of looking broken (`avisoReglas()` in `juegos-main.js`, and
the same in `ranks.js`).

## Download cap (`src/consumo.js`)

The free plan gives the whole site ~360 MB of RTDB download a day, and the
database has no per-user quota, so **each player is capped at 80 MB a day**
on the client. `consumo.js` is imported **first** in `juegos-main.js`: the
SDK captures the `WebSocket` class when it is evaluated, but sets
`onmessage` on every new connection, so wrapping the *setter* on
`WebSocket.prototype` counts every frame from `firebaseio.com` /
`firebasedatabase.app` (long-polling is not measured). Bytes are summed per
Chile day across tabs (`localStorage` `fb.consumo.d.<day>.<tab>`) and across
devices of the same account (`users/<uid>/consumo` = `{dia, t: {tab:
bytes}}`, a transaction every ≥30 s and ≥256 KB; owner-only node, no rule
change). `crearMedidor` is pure (clock and store injected) and covered by
`tests/consumo.test.cjs`. Over `LIMITES.aviso` (40 MB) in the day, over
`rafaga` (15 MB) in five minutes in one tab, or at `tope`, it writes
`sospechas/<uid>` with `c: "red-descarga"`, once per day and kind; at the
cap it writes that first (≤4 s), then `goOffline` (`fb.desconecta`) and an
overlay until midnight, when the page reloads itself. It is a client-side
limit: a rewritten client or the REST API skips it. What the **server**
enforces is that no whole collection can be read: `partidas` only through
the lobby query (`orderByChild('estado')` + `equalTo('esperando')`) or by
pid, and `vivo`, `chat`, `soloPruebas` and `mascotasEstado` only by key
(`test-rules.mjs` pins it). A new node that clients read by key should get its `.read` at the key
level, not on the collection.

## Every game can be muted and turned down (a rule, not a nicety)

**Every game must offer both a mute and a volume control that are visible
where it is played**: in the room, in the Solo Club iframe and in fullscreen.
A control that exists only in the standalone page does not count. Tetris Club
had a 🔊 in its own header, and that header is exactly what
`.club-integrado .shell>header` hides inside Juegos, so nobody could turn
it down. A new game, or new audio in an old one, must keep this true. Where
the controls come from:

- **Room games** (the ones painted by the page itself) go through the
  header's ♪ player. It holds the music volume (`jg.volumen`) and, below
  it, an **Efectos** slider (`configurarEfectos`, `jg.volEfectos`, applied to
  `busFx` in `sonido.js`). The 🔊 next to it mutes the effects (`jg.sonido`).
  New sounds must go through `busFx` or the music `bus`, never straight to
  `ctx.destination`, or they escape both sliders.
- **Games in their own document** (the Club's, Yemas, PRODROP) load
  `juegos/audio/volumen.js` **before any of their own scripts**. It wraps
  `AudioContext` so that `destination` is a gain node of its own, and scales
  `<audio>.volume`. Whatever the game connects «to the speaker» is therefore
  governed without the game knowing. It draws a 🔊 button plus a slider in
  every `[data-volumen]` slot. In the Club, `conexion.js` puts one next to the
  `.scorebar`, or floats it in a corner when the game left no slot. The
  setting is `jg.club.volumen`/`jg.club.mudo`, shared by all of them and
  synced across tabs. Each game's own sound button stays: that one turns
  the game's sound off, while this one sets how loud it is.
- Games that already had both controls keep their own and do not load
  `volumen.js`: Mina Club (toggle + slider), Circuit Breakers (music,
  effects, volume in its settings) and FANAL (its options have music and
  effects volumes; it loads `volumen.js` anyway so the mute is one click).
  Clue, Sopa and Electrodle make no sound. Atasco has its own 🔊 in the
  scoreboard and loads `volumen.js`, like Sudoku Arcade.

**Presentation timing and layout:** `presentacion.test.cjs` checks that
Chain Reaction's footer, elimination badges and the shared rematch prompt
wait for the reaction. The Chain Reaction header reserves space for turn
text, so the board stays still. Flip 7 preserves its displayed state during
the card flight and holds the face-up card for 240 ms before its effects.
Room chat sits in a sticky right column on desktop and below the game on
narrow screens. Solo Club retains isolated audio/game documents, with shared
navigation, automatic height, parent theme updates and rankings in the game
sidebar; embedded documents hide standalone branding, intros and footers.


**Visual rules:** `juegos/reglas-ejemplos.js` supplies the Spanish examples,
`reglas-ilustraciones.js` draws their own local SVGs, and `reglas-guia.js`
mounts a selector and step player inside `reglas.js`. There is no autoplay
on opening; reduced-motion uses manual steps. Hiding the tab, changing
variant or closing the manual cancels the timer. Keep examples consistent
with current engines when changing rules. Do not fetch external illustrations
or write to a real match. `tests/reglas-visuales.test.cjs` checks manual and
variant coverage, playback and teardown. Styles live in `juegos.html`.
