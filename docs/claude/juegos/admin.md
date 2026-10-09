# Juegos — admin panel

`colabtex/src/juegos/admin.js`, `admin-datos.js`. Anti-cheat context in `juegos/club/CLAUDE.md`.

**A panel for whoever is in `admins/<uid>`** (`juegos/admin.js`, the DOM;
`juegos/admin-datos.js`, pure and shared with
`scripts/auditar-club.cjs`; `tests/admin.test.cjs`). The 🛡️ in the header
appears after one `esAdminJuegos` read per session. The panel is the face,
not the key: every write is re-checked by the rules. Four tabs:

- **Récords**: `guardaConPodio` writes `revisiones/<cat>/<uid>` = `{p, pts,
  t, l, n, at}` whenever a club record climbs to places 1–3
  (`merecesRevision`, the same condition that pays a podium; the rule
  demands `p` is the row's `partida`). Opening one downloads **only that
  proof**, runs `verificaClub`, and replays it with `crearRepro` (Tetris,
  Snake, sortEm and Mina Club; other games show the verdict and the raw
  proof). *Conservar* removes the entry and writes `auditados` with
  `h: true`; *Eliminar* is one multi-path `update` (`borraRecord`: row,
  proof, revision, audit and the rail's `repeticiones`). The podium claim
  is not touched: `podioValido` stops paying by itself once the row is gone.
- **Auditoría**: the script's signals (`senalesFila`: odd `partida`,
  implausible, anomalous) run over `datos.solo`, which `datosPerfil` already
  holds, so they cost **zero** downloads. Proofs are fetched on demand, three
  at a time, only for rows whose `partida` is not yet in
  `auditados/<cat>/<uid>` (`pruebasPendientes`); each verdict is written
  there, so no admin downloads the same proof twice. Rows marked by hand
  (`h: true`) stop showing their signals.
- **Monedas**: `ajustesMonedas/<uid>/<id>` = `{n, m, por, at}`, write-once,
  never deleted, read by everyone (it is part of every balance:
  `watchLogros` listens to it and `ganadoDe` adds it as `partes.ajustes`).
  Before a negative one is written, the panel recomputes `monedasDe` with
  it applied and refuses it if the balance would go below zero or the
  account would become *parada*.
- **Suspensiones**: `suspensiones/<uid>` = `{hasta, m, por, at}` (≤ one
  year; owner and admins read it). Every signed-in tab listens to its own
  node (`watchSuspension`) and hands it to `revisaCastigo({suspension})`:
  the same WASTED layer as the anti-cheat retention, with the admin's
  reason and a countdown that shows days, the «wasted» sound once per
  suspension, and lifted live when the node is deleted. It is **not**
  stored in `localStorage` (lifting it must work). The rules add the same
  condition as `vetados` (until `hasta`) to every write `vetados` blocks.
  The permanent veto (`vetados`) is managed from the same tab.

`test-rules.mjs` covers the new nodes. To run it here the database emulator
had to be started with `java -jar` and the rules PUT with curl to the
namespace `mi-pagina-pro-default-rtdb`: the CLI loads rules through
`HTTPS_PROXY` and fails behind a proxy.
