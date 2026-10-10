# Catan — notes for Claude

Screen: `colabtex/src/juegos/catan.js`; reducer in `colabtex/src/juegos/motor.js`. Room game of Juegos. The shared architecture (move log, `reducir`, rooms, fin cartel, votes, sound) is in `colabtex/src/juegos/CLAUDE.md`; logros/coins/ranking wiring in `docs/claude/juegos/perfiles-y-economia.md`.

**Catan (`catan`) rolls its dice with two keys from two people.** There is
no server to roll, and a die that one player could steer is the whole game.
Each player derives a chain of 800 hashes from their private seed
(`cadenaCatan`, tip `hcad` in the write-once ficha, as in cacho), and every
random event takes **two** keys: the actor's, inside the move itself (`tira`,
or `ladron` when there is a victim), and the first one that answers from
anybody else — the next seat for a roll, the victim for a steal
(`espera.k === "azar"`, `pref`). Neither can have seen the other's key before
publishing their own, so neither picks the outcome; the result is
`H(actorKey | helperKey | tipo | id)`. `aceptaLlave` accepts **only the next
key of the chain** (its hash must be the previous one): allowing a skip would
let a player choose between outcomes. A key that repeats one already accepted
is a network race and is ignored silently; one that does not fit is a lie and
goes to `est.falsas`. Things that follow:

- **The helper sees the result before sending.** That is the flip7 price
  again, said the same way: a helper who dislikes it can stay quiet, and a
  *suplente* answers after `SUPLENCIA_MS` + `SUPLENCIA_PASO` per seat
  (screen-only timing), which re-rolls it without choosing it. In a duel
  there is no suplente and the vote is the remedy.
- **Development cards come from a private deck per player**, like UNO:
  card k of `u` is `cartaCatan(sem, sal, mezcla, k)`, sampling with
  replacement from the box's proportions (14/5/2/2/2, or 20/5/3/3/3 for
  5–6). The `mezcla` comes from the **arranque**, where everyone reveals
  key 0 — which is also what picks the first player — so nobody can shop for
  a seed. The reducer trusts the claimed card type while playing (a knight
  moves the robber *now*); `auditaCatan` checks every played card and every
  revealed VP card against the revealed seeds at the end, and a liar is
  printed in red. VP cards are revealed by the screen by itself
  (`{t:"revela"}`) the moment they are enough to win.
- **Resource hands are in the log.** The screen shows rivals only a count,
  but a console can add them up — same honest limit as the escondite. The
  bank and the development deck never run out.

The board is **not** drawn from the keys: it comes from the room's public
`semilla` (`tableroCatan`, cached per seed/size/expansion), because there is
nothing to hide in it. Its geometry is **integer**: pointy-top hex centres at
`x = 2c + (f odd)`, `y = 3f`, corners at (x, y±2) and (x±1, y±1), so two hexes
find their shared corner by exact key and no browser rounds a `sin` its own
way. Ports are placed by **walking the coastline** edge by edge rather than
sorting by `atan2`, for the same reason; red numbers (6, 8) are reshuffled
until none touches another. The layouts are plans of strings (`CT_PLANOS`,
«L» main island, a digit an islet); with Navegantes the sea is the whole
bounding rectangle, because the channels between islands have to exist to be
sailed.

Rules that are easy to get wrong, all in `redCatan`:

- **Roads and ships connect only through one's own building.** A ship chain
  and a road chain meeting at an empty corner are two routes; the longest
  trade route (`rutaCatan`, a DFS from every owned edge) switches type only at
  an own settlement or city and never passes an opponent's building. It is
  recomputed **only for whoever may have changed** — the builder, and on a
  settlement everybody with an edge at that corner (their route may be cut,
  the builder's may grow by joining a road to a ship). Recomputing everyone
  on every build made a long 5-player Navegantes game cost 30 ms per reduce.
- **The holder keeps the longest route on a tie**; if they lose it and the
  others tie, nobody has it. Largest army and harbormaster change hands only
  on strictly more.
- **A settlement at setup must have room for its road** (or ship): otherwise
  the snake would wait forever for an impossible move.
- **`sitiosCatan` respects the piece limits** and only looks at corners the
  player's own network touches. A free road offered with fifteen already on
  the board was accepted by the screen and refused by the reducer — the
  robots in the test sent it eight thousand times.
- **A trade that can no longer be paid leaves the table**: after every move
  the reducer drops acceptances (and counter-proposals) whose author lost the
  cards to a steal or another trade, or the screen offered to close a deal
  the reducer would refuse.
- **The special building phase (5–6) skips whoever cannot afford anything**
  (`puedeAlgoCatan`), which is almost everyone almost every turn; anyone may
  `salta` someone who fell asleep, and the screen offers it only after
  `SALTO_MS`.
- **Winning is checked on the turn owner's actions only** (and at the start
  of their turn): points reached in someone else's special phase count when
  their own turn comes.
- Friendly robber: no hex touching another player with ≤2 visible points,
  unless that leaves the robber nowhere to go.

The screen (`catan.js`) is one SVG in layers — background painted once
(sea, illustrated terrain, tokens with probability pips, ports), roads and
buildings repainted by signature with **new pieces dropping in** (roads are
drawn in with `pathLength="1"`), robber and pirate as persistent elements
that **slide** with a CSS transition — plus HTML overlays for the dice
(rolling while the second key is missing), production chips that rise from
each producing corner in the owner's colour, and banners. Seat colours come
from a fixed palette (`PALETA`), not from profiles, as in Chain Reaction.
Icons are `<symbol>`s drawn in the module, never emoji, and **every `<use>`
carries `x/y/width/height`**: without them a `<use>` fills the viewBox from
(0,0), and with the viewBox centred on the origin only a quarter of each icon
showed. On a phone the island keeps a minimum width inside a horizontal
scroller (`.jg-ct-scroll`), so a corner still fits under a finger; the
overlays live outside the scroller and the production chips inside the
`.jg-ct-lienzo` that measures exactly what the SVG does. Room options are
`exp`, `baraja`, `amable`, `puerto` and `largo` — deliberately not `modo`,
which the rules whitelist — so only the `juego` whitelist needed `'catan'`,
and that still has to be re-published. `tests/catan.test.cjs` plays robot
games in every combination (2–6 players, both expansions, every variant) to
the end, and checks that the base board is the box's (54 corners, 72 roads),
that replaying the log gives the same state, that a skipped key does not
roll, that the audit catches a lied card and that a vote-out behaves as an
abandono.
