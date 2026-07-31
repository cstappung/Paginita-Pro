# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Laboratorio** — a static site (published to GitHub Pages) that hosts a small
suite of browser-only tools. There is **no application backend**: everything
runs client-side, and persistence for the collaborative tool lives in Firebase.
`index.html` redirects to `Inicio.dc.html`, the landing menu.

Three apps:

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

- `npm run build` runs esbuild three times (IIFE bundle of `src/main.js` →
  `../colabtex-app.js`, of `src/draw-main.js` → `../colabdraw-app.js`, and the
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
`FIREBASE_EMU` is set and running under Node. Start the emulators, then run the
file with that env var set (e.g. `FIREBASE_EMU=1 node test-rules.mjs`). Run this
after changing `firebase/database.rules.json`.

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
- `pdfview.js` — pdf.js-based PDF viewer.
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
- `synctex.js` / `visual.js` — source↔PDF sync and the visual/rendered view.
- `texlog.js` / `themes.js` — LaTeX log parsing, editor themes.
- `local-fs.js` — File System Access API layer for local mode.
- `bridge.js` — **"Abrir en VS Code"**: links a *cloud* project to a disk
  folder and keeps both in sync bidirectionally while the tab is open. Writes
  Yjs→disk on change; polls disk mtimes each second and applies a **minimal
  diff** to the `Y.Text` (never a full replace — that would destroy
  collaborators' concurrent edits and jump their cursors). Echo is suppressed by
  comparing content, not timestamps.
- `ai-assistant.js` — BYOK AI assistant (Gemini/Claude/OpenAI). The API key
  stays in the user's `localStorage`; calls go directly from the browser. The
  model edits files through tool-calling that operates on the Yjs doc, so its
  edits are collaborative and live.
- `comments.js` — **text comments** (Overleaf-style). Select text → attach a
  thread everyone sees; anyone (editor/owner) can reply or mark resolved.
  Threads live in a Yjs `comments` map (see below) anchored with Yjs **relative
  positions** so highlights track edits. Provides a CodeMirror extension
  (highlight + click + a floating "Comentar" bubble) and a right-side panel.
  **Cloud only** — disabled in local mode; view-only users see them read-only
  (both the provider and the Firebase rules block their writes).
- `zip-import.js` — imports Overleaf `.zip` exports.

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

Modules in [colabtex/src/draw/](colabtex/src/draw/):

- `doc.js` — the model: `DrawStore` (the project's drawings), `Drawing` (one
  open drawing: layers, add/remove, z-order, group/ungroup, undo). Every write
  goes through `Drawing.edit()`, one transaction with the `LOCAL` origin. The
  `UndoManager` uses `captureTimeout: 0` — one action, one undo step; the
  default merges consecutive actions, which is right for typing and wrong for
  drawing.
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
  stroked shapes report the box you actually see.
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
- `text.js` — the text tool and its editor. A text is a `<text>` with one
  `<tspan>` per line, each repeating the `x` (SVG text does not wrap back to
  the margin by itself) and stepping down with `dy` **in `em`**, so changing
  the size doesn't wreck the leading. Editing happens in a `<textarea>` floated
  over the canvas, not in the SVG: `contentEditable` on a `<text>` is
  browser-dependent and knows nothing about selections or dead keys. The
  document is written **on close**, same rule as the drag. A text left empty is
  deleted — it would be invisible and unclickable.
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
  safe match (Helvetica, Times, Courier).
- `export.js` — SVG and PNG (rasterised through a data: URL so the canvas is
  never tainted). Exports are saved as **ordinary project assets** via
  `fb.uploadAsset`, which is the hook the planned ColabTeX link will use. They
  are listed in the *same* sidebar list as the drawings — a generated PNG is a
  project file just like the `.svg` it came from — and open in `preview.js`.

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
