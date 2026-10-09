# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Laboratorio** — a static site (published to GitHub Pages) that hosts a small
suite of browser-only tools. There is **no application backend**: everything
runs client-side, and persistence for the collaborative tools lives in Firebase.
`index.html` redirects to `Inicio.dc.html`, the landing menu.

- **CSV·Scope** (`CSV Oscilloscope.dc.html` + `scope-engine.js`) — offline oscilloscope for CSV captures.
- **FiltroLab** (`Filtros.dc.html` + `filtros-engine.js`) — analog filter designer.
- **AjusteLab** (`Ajustes.dc.html` + `ajuste-engine.js`) — curve fitting with uncertainties.
- **ColabTeX** (`colabtex.html` + `colabtex-app.js`, source in `colabtex/src/`) — Overleaf-style collaborative LaTeX editor.
- **ColabDraw** (`colabdraw.html` + `colabdraw-app.js`, source in `colabtex/src/draw/`) — Inkscape-style collaborative SVG editor.
- **Informes** (`informes.html` + `informes-app.js`) — the shared bug tracker.
- **Juegos** (`juegos.html` + `juegos-app.js`, source in `colabtex/src/juegos/`, iframe games in `juegos/`) — multiplayer room games, the Solo Club (single-player games with rankings), coins, logros, profiles and PRODROP.

ColabTeX, ColabDraw, FiltroLab, AjusteLab, Juegos and Informes are authored in
**Spanish** — UI text, comments and identifiers alike. **CSV·Scope is the
exception: it is in English**, and its own comments follow. Match whichever app
you are editing rather than the repo as a whole.

## Docs map — read the right doc before working

This root file is deliberately short: it is loaded in every conversation. The
detailed notes (decisions, traps, "do not break this") live next to the code,
**one doc per app and per game**. Before editing an area, **Read its doc(s)
with the Read tool** — do it as soon as the request names the app or game
(«el tetris», «arregla Metro Rush», «las monedas»…), without waiting to be told
which file. A `CLAUDE.md` inside a subfolder is also loaded automatically when
you read a file in that folder, but read it up front anyway: you need it
before the first edit. Read only the docs the task needs.

| Area / what the user may call it | Read |
|---|---|
| CSV·Scope, osciloscopio | `docs/claude/csv-scope.md` |
| FiltroLab, filtros | `docs/claude/filtrolab.md` |
| AjusteLab, ajustes, regresión | `docs/claude/ajustelab.md` |
| ColabTeX, editor LaTeX, compilar, PDF, BusyTeX, fuentes | `docs/claude/colabtex.md` |
| ColabDraw, dibujo, figuras, SVG | `colabtex/src/draw/CLAUDE.md` |
| Informes, reportes, errores, ⚑ | `docs/claude/informes.md` |
| Firebase rules, Storage, security, deploy, any new RTDB node | `docs/claude/firebase.md` |
| Idiomas, traducción, i18n | `docs/claude/i18n.md` |
| **Any Juegos work** (rooms, a new game, a game screen) | `colabtex/src/juegos/CLAUDE.md` (always), plus the game's doc below |
| Salón / lobby, portada, fichas, invitado, rieles, chat general, novedades | `docs/claude/juegos/salon.md` |
| Perfiles, marcos, fondos, tienda, clasificación/ranking, logros, monedas, recompensa diaria | `docs/claude/juegos/perfiles-y-economia.md` |
| Música, canciones, reproductor ♪, volumen, mandos/controles | `juegos/audio/CLAUDE.md` |
| Solo Club in general, antitrampas, castigo, modo celular | `juegos/club/CLAUDE.md` |
| Panel de administración | `docs/claude/juegos/admin.md` |
| PRODROP, sobres, cartas coleccionables, mercado | `juegos/prodrop/CLAUDE.md` |

Room games (read `colabtex/src/juegos/CLAUDE.md` too):

| Game | Read |
|---|---|
| Escondite | `docs/claude/juegos/escondite.md` |
| Cartas (tres elementos, Card-Jitsu) | `docs/claude/juegos/cartas.md` |
| Cuadritos | `docs/claude/juegos/cuadritos.md` |
| Reversi | `docs/claude/juegos/reversi.md` |
| Órbita | `docs/claude/juegos/orbita.md` |
| Chain Reaction (cadena) | `docs/claude/juegos/cadena.md` |
| Flip 7 | `docs/claude/juegos/flip7.md` |
| Cacho | `docs/claude/juegos/cacho.md` |
| UNO | `docs/claude/juegos/uno.md` |
| Catan | `docs/claude/juegos/catan.md` |
| Presidente | `docs/claude/juegos/presidente.md` |
| Spicy | `docs/claude/juegos/spicy.md` |
| Ajedrez | `docs/claude/juegos/ajedrez.md` |
| Tetris (room and Tetris Club) | `juegos/club/tetris/CLAUDE.md` |
| Circuit Breakers (worms) | `juegos/worms/CLAUDE.md` |
| Yemas (shooter, zombis, voz) | `juegos/yemas/CLAUDE.md` |
| Clue | `juegos/clue/CLAUDE.md` |
| Boxhead | `juegos/boxhead/CLAUDE.md` |
| Pokémon (rooms, team editor) | `colabtex/src/juegos/pokemon/CLAUDE.md` |

Solo Club games (read `juegos/club/CLAUDE.md` too):

| Game | Read |
|---|---|
| sortEm | `juegos/club/sortem/CLAUDE.md` |
| BBTAN | `juegos/club/bbtan/CLAUDE.md` |
| Sopa de letras | `juegos/club/sopa/CLAUDE.md` |
| Electrodle | `juegos/club/electro/CLAUDE.md` |
| Sudoku Arcade | `juegos/club/sudoku/CLAUDE.md` |
| FANAL | `juegos/club/fanal/CLAUDE.md` |
| ALETEO | `juegos/club/aleteo/CLAUDE.md` |
| 2048 (dosmil) | `juegos/club/dosmil/CLAUDE.md` |
| Trigon | `juegos/club/trigon/CLAUDE.md` |
| Atasco | `juegos/club/atasco/CLAUDE.md` |
| Metro Rush | `juegos/club/metrorush/CLAUDE.md` |
| Mina Club (buscaminas) | `juegos/club/minas/CLAUDE.md` |
| Frontera Batalla | `docs/claude/juegos/frontera.md` |

Snake, Tulones and Gato have no doc yet; read their code.

**Creating a new game?** Read `colabtex/src/juegos/CLAUDE.md`,
`docs/claude/juegos/perfiles-y-economia.md` (logros, coins, ranking), and, for a
club game, `juegos/club/CLAUDE.md` plus the doc of the most similar existing
game, to copy its wiring.

### Keeping the docs small

- New notes go in the doc of the area they describe, **never in this root
  file** unless they apply to the whole site. A new game gets its own doc: a
  `CLAUDE.md` in its own folder (`juegos/club/<x>/`, `juegos/<x>/`) or, for a
  room game that lives only in `colabtex/src/juegos/<x>.js`,
  `docs/claude/juegos/<x>.md`. Then add a row to the tables above.
- Do **not** pull docs in with `@path` imports: those load in every
  conversation, which is exactly what this split avoids.
- Write rules and traps in a few lines ("X must Y, because Z broke"). Long
  stories of how a bug was found belong in the commit message or a code
  comment.

## Commands

`colabtex/` is the build workspace for **both** web apps — it is the only
folder with `node_modules`, and duplicating it just for Firebase + Yjs would
cost ~200 MB. Run everything from there:

```
cd colabtex
npm install          # first time only
npm run build        # bundle both apps + pdf worker, then stamp versions
npm start            # static preview server at http://localhost:8123
```

- `npm run build` runs esbuild six times (IIFE bundles of `src/main.js` →
  `../colabtex-app.js`, `src/draw-main.js` → `../colabdraw-app.js`,
  `src/reports-main.js` → `../informes-app.js`, `src/juegos-main.js` →
  `../juegos-app.js` and `src/draw/math-engine.js` →
  `../colabdraw-math.js` via `build:math`, plus the
  pdf.js worker), then `scripts/stamp-version.js` rewrites the `?v=…` query on
  the `<script>` tag of **each** page (its `PAGES` table) so GitHub
  Pages/browsers don't serve a stale cached bundle. The three `.dc.html`
  instruments (`scope-engine.js`, `filtros-engine.js`, `ajuste-engine.js`)
  are in that table too even though they never go through esbuild, because
  the failure is the same and it was seen: the page arrived fresh with a new
  signal in its `<select>` while the browser kept the old engine from cache,
  which did not know the option and fell through to a sine. **After editing
  one of those engines without running the build, bump its `?v=` by hand.**
  The replacement is anchored to `src="…"`: in the `.dc` pages the engine's
  name appears earlier inside a CSS comment, and "first occurrence" stamped
  the comment. **After editing anything
  under `colabtex/src/`, you must `npm run build`** — the root `*-app.js` files
  are generated and not hand-edited.
- `colabdraw-math.js` is **not** in `PAGES` and no page has a `<script>` tag for
  it: it is loaded on demand by `draw/latex.js`, which appends the *page's* own
  `?v=…` (see the "formulas" section of `colabtex/src/draw/CLAUDE.md`). It is a build artifact all the
  same and must be committed like the other bundles.
- Previewing goes **through the server**, never by opening the file: double-click
  `Iniciar ColabTeX.cmd` (it starts `server/static.js` and opens
  `http://localhost:8123/Inicio.dc.html`) or run `npm start` yourself. On
  `file://` the origin is `null`, so Google login is refused and the BusyTeX
  `vendor/` fetches are blocked — the site looks broken for reasons that have
  nothing to do with the code.
- **There is no unit-test suite**: `npm test` is the npm stub and exits 1. The
  only automated check in the repo is the security-rules test below. The pure
  modules (`reports.js`, `draw/geom.js`, and the path/format arithmetic in
  `file-move.js` and `format.js`) are written to be exercisable from Node
  without a browser, so ad-hoc checks are cheap — there is just no runner.

### Security-rules test (Firebase emulator)

`colabtex/test-rules.mjs` exercises **every** DB operation against the Realtime
Database security rules using the Firebase emulators (ports in `firebase.json`:
auth 9099, database 9000). `src/firebase.js` connects to the emulator only when
`FIREBASE_EMU` is set and running under Node. Run this after changing
`firebase/database.rules.json`.

It **cannot be run directly** any more: `package.json` says
`"type": "commonjs"`, so Node reads `src/*.js` as CommonJS and an `.mjs` file
importing named exports out of them fails before the first line runs. Bundle it
first — relative imports get inlined, packages stay external (a plain ESM bundle
trips over `faye-websocket`'s dynamic `require`):

```
firebase emulators:start --only auth,database --project mi-pagina-pro
cd colabtex && npm run build:rules-test
FIREBASE_EMU=1 node .rules-run.mjs          # PowerShell: $env:FIREBASE_EMU=1; node .rules-run.mjs
```

## Site-wide rules (details in the linked docs)

- **Firebase rules and Storage CORS are not deployed by pushing.** After
  editing `firebase/database.rules.json` or `storage.rules` they must be
  re-published by hand in the console. Every new node is written assuming a
  stranger with a console. Full model and invariants: `docs/claude/firebase.md`.
- **i18n** (`i18n.js`, every page): anything that paints what a person wrote
  carries `translate="no"`; never compare against a UI string you wrote
  earlier (it may be translated by then); a new page needs the `i18n.js`
  `<script>`. Details: `docs/claude/i18n.md`.
- **Every game must offer a mute and a volume control** visible where it is
  played (room, Solo Club iframe, fullscreen). Details in
  `colabtex/src/juegos/CLAUDE.md`.

## The `.dc.html` format

`Inicio.dc.html` and `CSV Oscilloscope.dc.html` are "Design Component"
documents: an `<x-dc>` template (with `<helmet>` for head content and
attributes like `style-hover`, `data-screen-label`) rendered by `support.js` at
runtime via React. `support.js` is **generated** from an external `dc-runtime`
project ("do not edit" — rebuild there); treat it as a vendored runtime.
Plain `.html` files (`colabtex.html`, `index.html`) are ordinary pages.

`ColabTeX.dc.html` at the root is **dead** — a landing page from the very first
ColabTeX commit, never touched since, linked from nowhere and absent from
`stamp-version.js`'s `PAGES`. The live editor is `colabtex.html`; edit that one.
