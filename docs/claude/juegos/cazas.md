# Cacerías de récords («Fichado»)

The owner named it **«Fichado»** (stamp, poster title, «🎯 Fichar» button).
Every call to action is «▶ Jugar» and opens the game (`rutaDeCategoria`);
the club games do not take a mode in the URL yet, so the mode is picked
inside the game.

Anyone puts coins on the n.º 1 of a Solo Club table; whoever beats that mark
first takes the pot. Pure logic in `colabtex/src/juegos/cazas.js`, screen in
`cazas-vista.js`, the economy in `monedas.js` (events `cz`, `cg`), CSS block
«las cacerías de récords» in `juegos.html`. Tests: `tests/cazas.test.cjs`.

## Data and rules

- `cazas/b/<id>` = `{u, c, q, p, mp, mt, at}`: who put it, category, record
  holder, coins, the mark (points and time of `q`'s row). **Write-once, never
  deleted**: that is the escrow and the "cannot cancel". The rule checks `p`
  (500…10 000 000, integer) and that `mp`/`mt` equal `soloRanks/<c>/<q>` now.
- `cazas/g/<id>/<uid>` = `{at}`: a claim, once per account. The rule demands
  that `uid`'s row beats the mark (more points, or equal points and less
  time) **or** that `q`'s row is gone.
- The rule cannot sort a table, so "only the n.º 1" is enforced by the UI
  alone, and it cannot see balances: an unfunded bounty is voided by the
  replay and stops the account like any spend. Two colluding accounts can
  pass coins through a bounty, the same as through the market.
- Both nodes need the rules **re-published by hand**. Until then publishing
  fails with the «reglas» message and nothing is charged.

## Who gets paid (`reparto`, `resuelveCaza`)

- Someone else beats it → all to them. If that someone is whoever put it
  (on another person's record), they just get it back (`recuperada`).
- The holder beats their own mark → half to them, half back to whoever put
  it (owner's rule; known effect: a holder who improves by one point takes
  half of every bounty on them).
- The holder put it on their own record and beats it → all back.
- The holder's row is gone (admin deleted it) → all back (`anulada`).
- **The oldest valid claim wins, decided by the replay**, not by who wrote
  first: a claim whose row was later deleted stops counting and the next
  one wins. Several bounties on the same record and mark are one pot on
  screen (`cazasAbiertas`) but resolve one by one.
- Income goes to `premios` with category `caza`; the charge too.

## Economy cierre

Open bounties are listed in the cierre text (`cz`, `cierre-datos.js`):
their charge is before `T` and their claim may come after. `cazas` is not
archived (it is small and the rules read `cazas/b`). `verificaCierre`
compares open bounties. `watchLogros` reads `cazas` whole (`NODOS_MONEDAS`
20).

## Screen

- **Five levels** by pot (`NIVELES_CAZA`: Encargo 500, Cacería 2000, Gran
  cacería 10 000, épica 25 000, legendaria 50 000; the owner's numbers),
  classes `n1`…`n5`. Each level has its own neon colour (`--c1`, `--c2`,
  `--cbg` on `[class*=jg-cz].nX`: sky, green, violet, alarm red, holographic
  gold) on an ink background. The owner rejected the first brown/parchment
  look as dull and the rotating rays as already overused on the site: keep
  away from both. Louder per level: glow → breathing → siren and flashing
  border plus a hazard **banda** (`banda()`, marquee between hazard stripes;
  it needs `contain: inline-size` or its long nowrap text widens any grid
  it sits in) → holographic foil and gold-pink gradient numbers.
- **Cartel (top 5 pots)**: inside the chat rail, above the general chat
  (`rieles.js` makes the slot `cartel` and `cazas.monta` paints it), only on
  a wide PC menu view; hidden in the floating chat. On narrower screens the
  same cartel is a box in the lobby sidebar above *Top monedas*
  (`#vesCazas`), hidden on wide PC where the rail shows it.
- **Chat notices**: `avisos()` returns pre-rendered notices that
  `rieles.pintaChat` interleaves by time. A new bounty stays `nivel.ms`
  (1 h, 2 h 15, 6 h, 18 h, 72 h: the owner asked for three times the first
  durations); a resolved one too. Their entry animation and sparks start
  at `-var(--edad)`, so a chat repaint does not replay them.
- **Legendaria is the showpiece** (owner: «que den ganas de apretar Jugar»):
  gold metal «▶ JUGAR» that pulses with a shine sweep (`jgCzLatido`),
  twinkling ✦ (`destellos`, needs `--y` from `particulas`), a featured
  cartel row, and its top banner takes the screen: a golden `jg-cz-velo`
  dims the page (click closes) while coins rain over everything. Coins of
  the rain need `position:absolute` or they line up as text.
- **Top banner** (`anuncia`): a bounty or a payout of Gran or more drops in
  from the top of the screen, once per browser (`localStorage
  jg.cz.anuncios`) and only while under 10 min old; legendaria adds a white
  flash and a coin shower (`lluvia`). It waits while a poster is open.
- **The wanted person sees a poster on entering** (`avisaBuscado`), a card that slams in with flash, shockwave and a coin
  fountain from behind it: once per
  session (`sessionStorage jg.cz.buscado.<uid>`), and again when a new bounty
  lands on them. The winner sees «¡RECOMPENSA COBRADA!» (`avisaResultados`,
  `localStorage jg.cz.res.<uid>`); refunds and «X cobró tu cacería» are coin
  toasts. Only in menu views (`puedeMostrar`), never over a game or the
  castigo; `render()` calls `cazas.revisa()` to catch up.
- **Auto-claim**: on every data arrival the tab claims what its row beats
  (`porReclamar`), and the publisher's tab claims refunds of vanished
  records. A claim refused by the rules is just logged.
- Reduced motion stops every animation and hides coins/sparks.
- Not done yet (owner may want them): a 🎯 on the club ranking rows, a
  «Se busca» badge on profiles, a logro/frame for hunters.
- **The coin is the site's SVG** (`MONEDA` from `monedas-vista.js`), never
  the 🪙 emoji: it renders differently per system and in some not at all.
  The falling coins carry it inside (`particulas` with `jg-cz-moneda`); text
  that is escaped (the banda) says «monedas» in words; anything that sets
  it must use `innerHTML`, not `textContent`.
- **The cartel repaints on every `render()`** (`revisa` → `pintaMontados`,
  a cheap string compare): other people's profiles (photo, frame) arrive
  after the first paint, and `render()` is what fires when one lands. It
  also falls back to the Google photo left in a room table, like the coins
  top. Without both, everyone but yourself showed as initials.
- **«Ver todos los fichados (N)»** sits under the cartel when there are more
  than `TOP` (5): a modal with every open bounty by pot (`abreTodas`), a
  search box (game, mode, holder or contributor) and «Ponen: …» per pot. It
  repaints with each data arrival through `pintaMontados`.
- **The chat list needs `grid-auto-rows:max-content`**: its rows are `auto`
  and a notice has `overflow:hidden` (min height 0), so with many notices the
  grid squashed them to their headers instead of scrolling. The chat shows
  every live épica/legendaria but only the last `AVISOS_CHAT` (6) of the
  rest. The super chat in `rieles.js` uses the `MONEDA` SVG too.
