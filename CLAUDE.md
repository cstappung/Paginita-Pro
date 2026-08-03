# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Laboratorio** — a static site (published to GitHub Pages) that hosts a small
suite of browser-only tools. There is **no application backend**: everything
runs client-side, and persistence for the collaborative tool lives in Firebase.
`index.html` redirects to `Inicio.dc.html`, the landing menu.

Three apps plus a small shared **Informes** page:

- **CSV·Scope** (`CSV Oscilloscope.dc.html` + `scope-engine.js`) — offline
  oscilloscope for CSV captures (cursors, trigger, FFT/harmonics, XY, math
  channels). Self-contained, no build step, no backend.
- **ColabTeX** (`colabtex.html` + `colabtex-app.js`) — an Overleaf-style
  collaborative LaTeX editor. This is where nearly all the complexity is; its
  source lives in [colabtex/src/](colabtex/src/) and is bundled into the
  root-level `colabtex-app.js`.
- **ColabDraw** (`colabdraw.html` + `colabdraw-app.js`) — an Inkscape-style
  collaborative SVG editor for paper figures. Source in
  [colabtex/src/draw/](colabtex/src/draw/) plus the entry
  `colabtex/src/draw-main.js`. Shares Firebase, auth and the Yjs provider with
  ColabTeX (see "ColabDraw" below).
- **Informes** (`informes.html` + `informes-app.js`, entry
  `colabtex/src/reports-main.js`) — the shared bug tracker: errors the apps
  collect by themselves, plus the bugs and ideas people write. See "Informes"
  below.

The UI is authored in Spanish; comments and identifiers are Spanish too. Match
that when editing.

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

- `npm run build` runs esbuild four times (IIFE bundles of `src/main.js` →
  `../colabtex-app.js`, `src/draw-main.js` → `../colabdraw-app.js` and
  `src/reports-main.js` → `../informes-app.js`, plus the
  pdf.js worker), then `scripts/stamp-version.js` rewrites the `?v=…` query on
  the `<script>` tag of **each** page (its `PAGES` table) so GitHub
  Pages/browsers don't serve a stale cached bundle. **After editing anything
  under `colabtex/src/`, you must `npm run build`** — the root `*-app.js` files
  are generated and not hand-edited. Open `Inicio.dc.html` from the repo root,
  or double-click `Iniciar ColabTeX.cmd`, to preview the whole site.

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

### Vendor rebuild scripts (rarely needed)

`colabtex/scripts/build-fontmap.js` and `build-texmf-package.js` regenerate
assets under `vendor/busytex/` (the WASM TeX engine). Only touch these when
adding LaTeX packages/fonts that BusyTeX doesn't ship — see their header
comments.

## ColabTeX architecture

Two persistence modes share the same editor, LaTeX engine, and PDF viewer:

1. **Cloud mode** — projects, members, and the live document live in Firebase.
2. **Local mode** — a real disk folder opened via the File System Access API
   (Chrome/Edge/Opera desktop only), no cloud involved.

Key modules in [colabtex/src/](colabtex/src/):

- `main.js` (~2k lines) — the whole app: routing, login, dashboard, editor,
  file tree, sharing, and wiring of everything below. Start here.
- `firebase.js` — Firebase init (project `mi-pagina-pro`); Google auth, RTDB,
  Storage. Config/API key is public by design (client SDK).
- `fb-api.js` — data layer over Realtime Database: projects, members, tokens,
  invites, assets.
- `y-rtdb.js` — **custom Yjs provider over Realtime Database** (not
  y-websocket). Persists the doc snapshot + incremental updates and drives
  presence/remote cursors.
- `latex.js` — BusyTeX engine driver: runs pdfTeX (WASM) in a worker, returns
  the PDF and a parsed log summary. First compile downloads ~150 MB (cached);
  recompiles ≈ 4–5 s.
- `pdfview.js` — pdf.js-based PDF viewer. **Ctrl/⌘ + wheel zooms** (that is
  also how a trackpad pinch arrives), and it must `preventDefault()` or the
  browser zooms the whole page instead. The percentage updates on every wheel
  event but the re-render waits ~110 ms for the burst to end — repainting every
  page is expensive and a wheel fires dozens of times a second. The base is
  `0.999^deltaY` ≈ 13 % per notch; the obvious `0.995` nearly *doubles* the
  size in one notch. `render()` **queues** a repaint that arrives while another
  is running instead of dropping it, which is how a zoom asked for just as a
  compile finished used to vanish.
- `asset-preview.js` — clicking an image/PDF in the file tree previews it in
  place of the code editor (which is only hidden, never destroyed). Images go
  to an `<img>` with a blob URL; PDFs reuse `PdfViewer`. Formats the browser
  can't draw (`.eps`, `.tiff`) fall back to a file card with a download button.
- `file-move.js` — **renaming and drag-and-drop** in the file tree. A path is
  the file's identity, so both are one operation: change the path. Holds the
  pure parts (path arithmetic, `moveProblem` validation, `rewriteReferences`
  for `\includegraphics`/`\input`/… and `createTreeDnD`, the drag wiring);
  `main.js`'s `moveEntry()` applies it to Yjs + Storage or to disk. Notable
  consequences, all handled there: a `Y.Text` cannot be re-inserted under
  another key, so the text is copied into a new one and comment threads are
  re-anchored by offset (`comments.captureAnchors`/`reanchor`); Storage has no
  rename, so `fb.renameAsset` copies the object and deletes the old one; and
  on Windows a case-only rename must delete before writing.
- `format.js` — **bold / italic / underline / colour** for the selection, the
  way Overleaf's toolbar does it: buttons in the editor bar plus Ctrl+B/I/U
  write `\textbf`, `\textit`, `\underline`, `\textcolor` straight into the
  `.tex` (no hidden state), and **toggle off** when the selection is already
  inside that command. Also exports `xcolorPatch(text)` — the pure preamble
  edit that makes `\textcolor` compile — which `main.js` applies to the main
  file (Yjs or disk) the first time a colour is used, and `cssOfTexColor`,
  shared with the visual view.
- `synctex.js` — source↔PDF sync.
- `visual.js` — the visual/rendered view (KaTeX for formulas, real sizes for
  headings). It only *decorates*: the document is never modified, so Yjs,
  saving and compiling never see it. `buildDecorations` collects every range
  first and emits them at the end, and that emission has two rules that a
  `RangeSetBuilder` enforces on pain of throwing:
  - Ranges go **sorted by `from` and, at the same `from`, by `startSide`** — a
    `Decoration.replace` is 499999999 and a `Decoration.mark` 500000000, so a
    replacement always goes *before* a mark that starts at the same character.
    Sorting by `from` alone was enough until `\section{$f$-Factor}` appeared:
    the heading's mark and the formula start on the same character, the mark
    came first for being longer, and CodeMirror aborted with *"Ranges must be
    added sorted by `from` position and `startSide`"* — which killed the visual
    view for the whole document, not just that line.
  - Two **replacements** may not overlap, so a later one is dropped; **marks**
    may, and are never dropped — that is what lets a heading keep its size when
    a formula is nested inside it.
- `texlog.js` / `themes.js` — LaTeX log parsing, editor themes.
- `local-fs.js` — File System Access API layer for local mode.
- `bridge.js` — **"Abrir en VS Code" / "Abrir con Claude"** (both inside the
  **✦ IA** menu of the editor bar, together with the assistant — three
  permanent buttons were more than the bar could hold): links a *cloud*
  project to a disk folder and keeps both in sync bidirectionally while the tab
  is open. Writes Yjs→disk on change; polls disk mtimes each second and applies
  a **minimal diff** to the `Y.Text` (never a full replace — that would destroy
  collaborators' concurrent edits and jump their cursors). Echo is suppressed by
  comparing content, not timestamps. Three things follow from the browser
  **never revealing a folder's absolute path** (by design — it would leak the
  shape of the user's disk), which `vscode://file/…` and
  `claude://code/new?folder=…` both need:
  - The launchers it drops in the folder (`abrir-en-vscode.bat`,
    `abrir-en-claude.bat`) **write their own path** (`%~dp0`) into `PATHFILE`
    before opening the editor, and the poll picks it up (`learnPath`). One
    double-click, once per folder ever; afterwards `absPath` lives in IndexedDB
    next to the handle and the web button opens the editor directly. Asking the
    user to paste the path is now only an escape hatch (right-click the button).
  - The redirection goes **before** the `echo` in the `.bat`: `%~dp0` ends in
    `\` and `cmd` mis-parses it glued to `>`. `cleanPath` trims anyway (quotes,
    BOM, newline, trailing slash).
  - `claudeUrl` encodes with `encodeURIComponent`, **not** `URLSearchParams`:
    the latter writes spaces as `+`, which a reader using `decodeURIComponent`
    would leave literal.
  It also writes a **`CLAUDE.md`** into the folder (only if absent) telling
  Claude Code that the folder syncs live with a collaborative web editor, so it
  makes small edits rather than whole-file rewrites. All four generated files
  are in `IGNORE` so they never upload — note `md` **is** in `TEXT_EXT`, so
  without that `CLAUDE.md` would appear in everyone's file tree and in the
  `.zip`. Windows only; on macOS the path still has to be pasted.
- `ai-assistant.js` — BYOK AI assistant (Gemini/Claude/OpenAI). The API key
  stays in the user's `localStorage`; calls go directly from the browser. The
  model edits files through tool-calling that operates on the Yjs doc, so its
  edits are collaborative and live. **Model IDs are asked to the provider**
  (`listModels` per adapter, cached a day in `localStorage`); the hardcoded
  `models` map is only a fallback so the dropdown is never empty. This is not
  gold-plating: `gemini-2.0-flash` was shut down on 2026-06-01 and the API
  answers a retired model with *"no free quota"*, which reads like a billing
  problem and had the assistant dead for every Gemini user. `chooseModel`
  drops a stored ID that no longer exists. Only Flash models are free — Gemini
  Pro lost its free tier on 2026-04-01. Saving a key fires **one real
  generation** (`probeKey`) instead of trusting `listModels`: a Google project
  that is out of the free tier, or one Google has blocked, answers **200** to
  the model list and fails only when generating, so the user found out at their
  first message and blamed themselves. `reportError` names the three failures
  Google dresses up as quota — retired model (404), billing attached with no
  balance (429 *prepay*), and project denied access (403) — because each one
  has a different remedy and the API's own wording points at none of them.
- `comments.js` — **text comments** (Overleaf-style). Select text → attach a
  thread everyone sees; anyone (editor/owner) can reply or mark resolved.
  Threads live in a Yjs `comments` map (see below) anchored with Yjs **relative
  positions** so highlights track edits. Provides a CodeMirror extension
  (highlight + click + a floating "Comentar" bubble) and a right-side panel.
  **Cloud only** — disabled in local mode; view-only users see them read-only
  (both the provider and the Firebase rules block their writes).
- `zip-import.js` — imports Overleaf `.zip` exports.
- `zip-export.js` — the reverse, shared by both apps: the whole project in a
  `.zip`. Uses fflate, already a dependency for reading them. Entry paths are
  stripped of `..` — that is how a file escapes the folder on extraction.
- `draw-link.js` — **linking a ColabDraw project to a `.tex` one**. The link
  record lives in the **Yjs doc** (`Y.Map "links"`), not in a node of its own:
  that way it syncs to the whole team for free and needs no new security rules
  published by hand in the console. It stores the drawing project's *invite
  token*, so every collaborator joins that project by themselves the first time
  they open the article — the same path as a share link (`joinWithToken`), so
  `database.rules.json` still needs no changes. The drawing's exported figures
  then appear in the file tree as ordinary assets with `loc: "link"` under
  `figuras/<slug>/`, and everything downstream (preview, `\includegraphics`,
  compile, the `.zip`) works untouched because it all runs off `state.assets`.
  `assetBytes` fetches those from *their* project, and `fb.watchAssets` keeps
  them live, so a figure exported in ColabDraw shows up here without a reload.
  The bytes are **not** copied: copying was only needed back when a
  collaborator might not have access to the drawing: with the link they do.
  `ensureAccess` **swallows the error from the first `getProject`**, and that
  `.catch(() => null)` is the whole feature: a collaborator who is not yet a
  member does *not* read `null`, they get **`PERMISSION_DENIED`** — the rules
  gate `projects/<pid>/meta` on membership — so the throw jumped straight to
  the `catch` and `joinWithToken` never ran. Nobody but the person who created
  the link ever saw the figures: no `figuras/` folder in the `.tex`, no project
  in ColabDraw, compilation broken, and the only trace a `console.warn`. A
  genuinely dead link (deleted project, revoked token) still fails, and now
  says so in the log.

### Collaborative document model

The document is a single `Y.Doc` holding three maps: `files` (path→text),
`folders` (path→true for empty folders), and `comments` (id→comment thread, a
`Y.Map` per thread whose `messages` is a `Y.Array`; anchors are Yjs relative
positions). Paths may include subfolders (`cap1/intro.tex`). In cloud mode this
syncs through `y-rtdb.js`; the full RTDB schema (users, projects, members,
roles, tokens, invites, doc snapshot/updates, assets, presence) is documented in
[colabtex/README.md](colabtex/README.md).

## ColabDraw architecture

An Inkscape-style vector editor for figures, sharing everything it can with
ColabTeX: same Firebase project, same Google session (Auth persists per origin,
so being logged into one logs you into the other), same `RtdbProvider`.

**A drawing project is a normal project.** It lives in the same
`projects/<pid>` tree and is told apart by `meta.kind` — `"draw"` vs `"tex"`
(`fb.KIND_DRAW` / `fb.KIND_TEX`; projects predating ColabDraw have no `kind`
and read as `"tex"`). Members, roles, tokens, invites, share, duplicate, delete
and presence are therefore **the exact same code**, and
`firebase/database.rules.json` needed **no changes at all**. Each app filters
`fb.listProjects()` by kind so the two lists stay separate.

**The document is an SVG tree in Yjs.** `Y.Map "drawings"` maps path →
`Y.XmlFragment`, and each fragment holds one `<svg>` element that *is* the
file: size, `<defs>` and layers (`<g data-layer="…">`). Moving a shape or
changing a `fill` are CRDT attribute ops, not text replacement. Two traps that
shape the code:

- **A prelim (not yet integrated) fragment cannot be read** — `toArray()`
  returns empty and Yjs logs a warning. `svgToFragment()` returns one, so it
  must go through `DrawStore.put()`, which integrates it and hands back the
  usable version.
- **An integrated Yjs type cannot be re-inserted elsewhere**, exactly as with
  `Y.Text` in ColabTeX. Z-order, grouping and renaming therefore *clone and
  delete*; every element carries a stable `id` attribute so the selection can be
  rebuilt afterwards (`Tools.reselectByIds`).

**Units are millimetres.** The `<svg>` is written `width="160mm"
viewBox="0 0 160 120"`, so one user unit is one millimetre and a figure is the
size the panel says on paper. Imported SVGs are normalised to that on the way in
(`svgio.svgGeometry` + a `scale()` on the imported layer).

**The paper can be cropped, and its origin is not always (0,0).** The `page`
tool (⛶ in the rail, `P`) drags the four edges and corners like a photo crop,
and dragging inside slides the sheet under the drawing. It writes only the
`<svg>`'s `width`/`height`/`viewBox` through `Drawing.setBox(x,y,w,h)` — **no
shape is ever touched**, which is what makes it safe and undoable in one step.
Everything that reads the page must therefore honour `viewBox`'s x and y:
`canvas.pageBox()`, `refreshPage`, `_drawGrid` and `fitPage` do, and
`export.svgForRaster` already did. During the drag the frame is previewed via
`canvas.previewPage(box)`, which paints without writing to Yjs — same rule as
the shape drag.

**The grid magnet steps 1 mm, not 5.** At 5 mm it wasn't a magnet, it was a
mould: a 12×7 mm rectangle came out 10×5, a line drawn to (90, 62) came out
horizontal, and nothing could be nudged below half a centimetre. Whoever wants
a coarse grid types it in the bar.

`draw-main.js` is only glue, but one thing there is easy to get wrong:
`openDrawing` registers an `observeDeep` on the drawing's fragment and **must
unregister it** (`stopFragObserver`). `Drawing.destroy()` only closes the undo
manager, so without that every visit left a live observer on the same fragment
and the object panel repainted once per drawing ever opened.

Modules in [colabtex/src/draw/](colabtex/src/draw/):

- `doc.js` — the model: `DrawStore` (the project's drawings), `Drawing` (one
  open drawing: layers, add/remove, z-order, group/ungroup, undo). Every write
  goes through `Drawing.edit()`, one transaction with the `LOCAL` origin. The
  `UndoManager` uses `captureTimeout: 0` — one action, one undo step; the
  default merges consecutive actions, which is right for typing and wrong for
  drawing. Two things about **styling** live here because they are model, not
  UI: `setAttrs` strips the same property from the element's `style` attribute
  (a `style="fill:red"` beats the `fill` attribute — the CSS cascade — and
  almost everything from Inkscape or matplotlib carries its colour there, so
  recolouring an imported figure did nothing at all), and when the target is a
  `<g>` it also strips the `HEREDABLES` properties from every descendant so the
  group's value is what cascades down. That is the *normal* case, not the odd
  one: a plain click selects the whole group. It is destructive by design —
  Inkscape does the same — and one Ctrl+Z restores it because it is one
  transaction. Symmetrically, `ungroup` **copies the group's inheritable
  attributes down** to children that lack them, multiplies `opacity` instead of
  inheriting it, and passes on `clip-path`; without that, ungrouping silently
  changed how the drawing looked.
- `geom.js` — pure geometry: matrices, `parseTransform`/`matToString`, bounding
  boxes, snapping, align/distribute. All of it verifiable without a browser.
- `svgio.js` — SVG in and out, **including the sanitiser**. An SVG is an
  executable document: `<script>`, `<foreignObject>`, `on*` handlers,
  `javascript:` and off-site `url(...)`/`href` are dropped on import, always.
  Import **keeps the file's own layers** (`layerInfo`): Inkscape has no layer
  type — a layer there is a `<g inkscape:groupmode="layer">` named by
  `inkscape:label`, hidden with `style="display:none"` and locked with
  `sodipodi:insensitive` — so those are translated to ours, and the mm
  normalisation is *prepended to each layer's transform* instead of wrapping
  everything in one extra `<g>`. Foreign-namespace attributes are dropped: they
  mean nothing here and would export with a prefix the file no longer declares.
  Everything a layer needs is read from the **source DOM** in one go, because a
  just-converted Yjs element is not integrated yet and returns nothing when
  read — the same trap as `cloneEl` in `doc.js`, and why `<defs>` children are
  copied one by one rather than through the converted `<defs>`.
- `canvas.js` — mirrors the Yjs tree into real SVG DOM and **patches it
  incrementally** (`observeDeep` → attribute sets and child deltas); a full
  repaint per change would destroy the selection and the frame rate. Measures
  come from the DOM itself (`getBBox` + `getScreenCTM`), so rotated groups and
  stroked shapes report the box you actually see. `localBox` gives the box
  *without* the element's own transform, which is what scaling a rotated shape
  in its own axes needs. `hitNear` is the fallback for a click that hit
  nothing: `elementFromPoint` demands landing **inside** the stroke, and 0.4 mm
  is under two screen pixels, so a freshly drawn line was practically
  unselectable. It filters by bounding box first (cheap) and then asks each
  candidate leaf with `isPointInStroke` against a temporarily widened stroke —
  the box alone would grab a long diagonal from half a screen away. The walk is
  capped at `MAX_HOJAS` nodes so a click on empty canvas can't traverse an
  entire matplotlib figure.
- `tools.js` — selection and the tools. **During a drag nothing is written to
  Yjs**, only to the mirror DOM; one commit happens on release. A mousemove
  fires ~60×/s and every Yjs write is an RTDB push, so live-writing would hammer
  the database and flood the undo stack. The starting matrix (`m0`) and the
  parent's (`pi0`) are captured **once, on pointer-down**: re-reading them from
  the DOM on every move made the preview compose onto itself (T·T·T…), so
  shapes flew off while being dragged and only snapped back on release.
  Selection follows Inkscape: a plain click takes the outermost shape (the
  whole group), **Ctrl/Cmd+click** takes the actual leaf under the pointer
  however deep it is nested, **Alt+click** does the same and repeating it walks
  down the stack of overlapping shapes, and **double-click** enters the group
  (or opens the text editor). The double-click is timed here rather than
  listened for: selection calls `preventDefault()` on pointerdown, which can
  suppress the derived mouse events `dblclick` is built from.
  Three rules the transforms depend on:
  - **A gesture is not a drag until the pointer has moved `DRAG_PX` screen
    pixels.** Measured in pixels, not millimetres — hand tremor is the same
    size at any zoom. Without it the snap ran on the very first mousemove, so
    merely *selecting* a shape that wasn't on the grid slid it there and wrote
    that to the document, i.e. to everyone's screen and to the undo stack.
  - **Scaling a single rotated shape happens in its own axes.** `_marco()`
    returns the frame as four document-space points, rotated with the shape,
    and `_matrixFor` then composes on the **right** (`A·T`) instead of
    `P⁻¹·T·P·M`. Scaling in document axes turned a rotated rectangle into a
    parallelogram. The grid magnet is deliberately off in that mode: the grid
    is in document millimetres and snapping a rotated coordinate to it is
    meaningless.
  - **Handles that cannot do anything are not drawn.** A straight line's frame
    has zero height, so `n`/`s` would multiply zero by something and stay zero;
    a handle that does nothing when you pull it reads as a broken app.
- `text.js` — the text tool and its editor. A text is a `<text>` with one
  `<tspan>` per line, each repeating the `x` (SVG text does not wrap back to
  the margin by itself) and stepping down with `dy` **in `em`**, so changing
  the size doesn't wreck the leading. Editing happens in a `<textarea>` floated
  over the canvas, not in the SVG: `contentEditable` on a `<text>` is
  browser-dependent and knows nothing about selections or dead keys. The
  document is written **on close**, same rule as the drag. Two consequences of
  that rule:
  - The `<text>` **is not created until the editor closes with content**
    (`openNew`, and `Tools._createText` passes a spec instead of an element).
    Creating it on click meant that changing your mind left an empty `<text>`
    behind — invisible, with no box, so impossible to click again — that a
    single Ctrl+Z brought back to life.
  - `place()` positions the box from the node's **`getScreenCTM`**, never from
    the `x`/`y` attributes. Moving a text is stored in its `transform` (`x`
    never changes) and an imported one hangs off a layer with a `scale()`, so
    the attributes alone put the editor 184 px away after a move and 674 px —
    off-screen — in an imported file. The font size is scaled by that same
    matrix, for the same reason.
- `layers.js` — the object tree, i.e. Inkscape's *Objetos* panel, plus the
  layer operations. It shows the **whole tree**, not just the layers: an
  imported file (a matplotlib figure, say) has no Inkscape layers, so a
  layer-only list showed it as a single row with no way to reach anything
  inside it. Only expanded branches are rendered — those files carry thousands
  of nodes and painting them all on every change would freeze the panel and the
  canvas with it. Each level lists **top-down as it looks**, reversed relative
  to the document where the last child paints on top. Selection is shared with
  the canvas both ways, and picking something on the canvas expands the branch
  it lives in. The eye (`display`) and the padlock (`data-locked`) work on any
  node, not only layers, and the padlock is inherited (`lockedAncestor`), so
  locking a group locks its contents. Names come from `data-label` (Inkscape's
  `inkscape:label`, kept on import), then `data-layer`, then the `id`.
  Layers keep their one privilege: whatever you draw goes to the active layer.
  Reordering layers and moving shapes between them **clone and delete** (an
  integrated Yjs type cannot be re-inserted), and moving across layers
  recomposes the transform (`relocateTransform`) so the shape doesn't shift.
- `preview.js` — looking at an exported PNG/PDF in the canvas's place, with a
  download **button**; clicking a generated file used to download it blind. The
  canvas is covered, never destroyed (same reason as ColabTeX's asset preview).
  PDFs go in an `<iframe>` with the browser's own viewer — pulling pdf.js in
  would add more than a megabyte to show a one-page figure.
- `style.js` — the fill/stroke/text/opacity/order/page panel, built in JS. Shows
  "varios" when the selection disagrees rather than the first value, so touching
  a control can't silently overwrite the rest. The TEXTO section only appears
  with a text selected (or the text tool in hand), and its font list is limited
  to the three generic families on purpose: exporting to PDF without embedding
  fonts leaves only the fourteen standard ones, and these are the three with a
  safe match (Helvetica, Times, Courier). It reads values through `attrOf`,
  which checks `style` **before** the attribute — reading only the attribute
  showed black over a red imported shape, so touching any control repainted it
  without warning. Stroke width is shown and accepted **as seen**: scaling
  lives in the `transform`, so a 0.5 mm stroke scaled ×2 looks 1 mm wide while
  the attribute still says 0.5; `getScale` (→ `Tools.selectionScale`) does the
  conversion both ways, and returns 1 when the selection disagrees rather than
  inventing a number.
- `export.js` — SVG and PNG (rasterised through a data: URL so the canvas is
  never tainted). Exports are saved as **ordinary project assets** via
  `fb.uploadAsset`, which is the hook the ColabTeX link uses. They
  are listed in the *same* sidebar list as the drawings — a generated PNG is a
  project file just like the `.svg` it came from — and open in `preview.js`.
  `background` fills the PNG (white by default in the modal: a transparent PNG
  with black labels vanishes on a dark slide), and `avoid` renames a generated
  file that would clash with a drawing's own name — `figura1.svg` exported from
  `figura1.svg` produced two identical rows in the sidebar.

## Informes (shared bug tracker)

Errors the apps collect on their own, plus the bugs and ideas people write, in
one place that everyone with a session can read and that exports to a file.

- `reports.js` — the **pure** part: filtering, trimming, fingerprinting, the
  local buffer and the Markdown export. No DOM beyond the download, no
  Firebase — verifiable in Node.
- `fb-reports.js` — the two new RTDB nodes, `errors/<fingerprint>` and
  `feedback/<id>`, deliberately **outside** `projects/`: a report belongs to the
  team, not to a document.
- `report-widget.js` — the ⚑ button and its modal, injected (CSS included) into
  every page, so adding it to a fourth page is one import.
- `reports-main.js` + `informes.html` — the page itself.

Four decisions worth keeping:

- **Half the value is in what gets thrown away.** A mistyped `\aling{}` is not
  an app bug, and if those got in, the report would be an endless list of other
  people's typos with the real faults buried in it. So from the LaTeX log only
  *our* failures go up (a missing package or font, the engine aborting, memory
  exhausted — `TEX_DE_LA_APP`), user typos are dropped explicitly
  (`TEX_DEL_USUARIO`), and **anything unrecognised is dropped too**. A compile
  that throws outright is the exception: that is always ours. From the browser,
  known noise goes (`Script error.` with no origin, the ResizeObserver loop,
  extensions, user-cancelled dialogs, network blips) — but a
  `PERMISSION_DENIED` stays, because that is exactly how the ColabDraw link bug
  would have surfaced.
- **Nothing of anyone's document is stored.** Message trimmed to 300 chars,
  three stack frames with the file name only, browser and OS by *family* (never
  the full user-agent string), and a `ctx` whose values are capped and whose
  object-valued entries are dropped — that last one is what stops a whole
  document being smuggled in as "context". The `where` (what the app was doing)
  is worth more for reproducing than the minified stack.
- **Errors are keyed by fingerprint, not pushed.** The same fault seen a hundred
  times is one row with a counter; otherwise the noisiest error hides the other
  nine. The counter is bumped with `runTransaction` because several people write
  it at once, and `quien/<uid>` is a map rather than a number so "how many
  people" can actually be counted.
- **It degrades instead of breaking.** `errors` and `feedback` are new nodes, so
  until the rules are re-published by hand in the console everything fails with
  `PERMISSION_DENIED`. The page then shows a plain-language warning naming that
  exact cause, the ⚑ modal offers to download what you wrote so it isn't lost,
  and errors keep piling up in `localStorage` regardless.

## Deployment & Firebase

- The site deploys to **GitHub Pages** from `main` at repo root. The repo is
  ~220 MB because of `vendor/busytex/` (largest file ~99.7 MiB, just under
  GitHub's 100 MiB limit); Pages on a free account needs the repo public.
- **Firebase security rules and Storage CORS are NOT deployed by pushing to
  Pages** — they must be published in the Firebase/GCloud console manually. Full
  one-time setup (RTDB rules, Storage rules, CORS, authorized login domains) is
  in [firebase/CONFIGURAR-FIREBASE.md](firebase/CONFIGURAR-FIREBASE.md). After
  editing `firebase/database.rules.json` or `storage.rules`, re-publish them
  there.

## The `.dc.html` format

`Inicio.dc.html` and `CSV Oscilloscope.dc.html` are "Design Component"
documents: an `<x-dc>` template (with `<helmet>` for head content and
attributes like `style-hover`, `data-screen-label`) rendered by `support.js` at
runtime via React. `support.js` is **generated** from an external `dc-runtime`
project ("do not edit" — rebuild there); treat it as a vendored runtime.
Plain `.html` files (`colabtex.html`, `index.html`) are ordinary pages.
