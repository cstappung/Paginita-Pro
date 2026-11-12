# Cacerías de récords («Se busca»)

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

- Someone else beats it → all to them.
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
  cacería 10 000, épica 50 000, legendaria 200 000), classes `n1`…`n5`. Each
  level is louder: gold border → shimmer → fire → rotating rainbow border
  and crown, and more coins/sparks. The same scale styles the cartel row,
  the chat notice, the full-screen poster and the price preview.
- **Cartel (top 5 pots)**: inside the chat rail, above the general chat
  (`rieles.js` makes the slot `cartel` and `cazas.monta` paints it), only on
  a wide PC menu view; hidden in the floating chat. On narrower screens the
  same cartel is a box in the lobby sidebar above *Top monedas*
  (`#vesCazas`), hidden on wide PC where the rail shows it.
- **Chat notices**: `avisos()` returns pre-rendered notices that
  `rieles.pintaChat` interleaves by time. A new bounty stays `nivel.ms`
  (20 min … 24 h); a resolved one too. Their entry animation and sparks start
  at `-var(--edad)`, so a chat repaint does not replay them.
- **The wanted person sees a poster on entering** (`avisaBuscado`): once per
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
