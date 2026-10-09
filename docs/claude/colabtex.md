# ColabTeX — notes for Claude

Collaborative LaTeX editor: `colabtex.html` + `colabtex-app.js`, source in `colabtex/src/` (entry `main.js`). After editing `colabtex/src/`, run `npm run build` in `colabtex/`.

Two persistence modes share the same editor, LaTeX engine, and PDF viewer:

1. **Cloud mode** — projects, members, and the live document live in Firebase.
2. **Local mode** — a real disk folder opened via the File System Access API
   (Chrome/Edge/Opera desktop only), no cloud involved.

Key modules in [colabtex/src/](colabtex/src/):

- `main.js` (~2.5k lines) — the whole app: routing, login, dashboard, editor,
  file tree, sharing, and wiring of everything below. Start here.
- `firebase.js` — Firebase init (project `mi-pagina-pro`); Google auth, RTDB,
  Storage. Config/API key is public by design (client SDK).
- `fb-api.js` — data layer over Realtime Database: projects, members, tokens,
  invites, assets. A binary has **three possible homes**, and its
  `assetsIndex` entry says which in `loc`: `"storage"` (Firebase Storage, the
  normal one), `"rtdb"` (base64 inside the database, capped at
  `RTDB_ASSET_LIMIT` = 3 MB — the fallback for when Storage is unavailable or
  CORS was never configured), and `"link"` (it belongs to a linked ColabDraw
  project, see `draw-link.js`). Anything that reads bytes has to branch on it;
  `assetBytes` and `renameAsset` already do.
- `util.js` — the genuinely shared helpers, small but load-bearing:
  `minimalDiff` (used by `bridge.js` and `main.js` — never replace a whole
  `Y.Text`) and `closingBrace` (shared by `visual.js` and `format.js`, and it
  skips `\{`).
- `layout.js` — the draggable splitters between the editor panels (files │ code
  │ PDF │ assistant/comments). Sizes persist in `localStorage`; releasing a
  splitter fires a `resize` event so the PDF viewer and CodeMirror re-measure.
- `y-rtdb.js` — **custom Yjs provider over Realtime Database** (not
  y-websocket). Persists the doc snapshot + incremental updates and drives
  presence/remote cursors.
- `latex.js` — BusyTeX engine driver: runs pdfTeX (WASM) in a worker, returns
  the PDF and a parsed log summary. First compile downloads ~150 MB (cached);
  recompiles ≈ 4–5 s. **A worker that failed is thrown away**
  (`_descartarMotor`), and so is the `ready` promise. Once the WASM aborts —
  `memory access out of bounds` on a heavy document — its heap is in a state it
  can no longer describe, but `this.worker` was still there and `this.ready`
  still resolved, so every later ▶ Compilar re-entered the same broken
  instance: the bug tracker showed the *same* error 13 and 2 times running, not
  15 different documents, and the only way out was reloading the page. A
  *rejected* `ready` is a promise too, which is why it is cleared on the way
  out: otherwise one network blip during the first init killed the engine for
  the rest of the session. Restarting does not re-download the 150 MB — the
  HTTP cache serves the packages and the `.wasm`.
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

## Collaborative document model

The document is a single `Y.Doc` holding three maps: `files` (path→text),
`folders` (path→true for empty folders), and `comments` (id→comment thread, a
`Y.Map` per thread whose `messages` is a `Y.Array`; anchors are Yjs relative
positions). Paths may include subfolders (`cap1/intro.tex`). In cloud mode this
syncs through `y-rtdb.js`; the full RTDB schema (users, projects, members,
roles, tokens, invites, doc snapshot/updates, assets, presence) is documented in
[colabtex/README.md](colabtex/README.md).

## Vendor rebuild scripts (rarely needed)

`colabtex/scripts/build-fontmap.js` and `build-texmf-package.js` regenerate
assets under `vendor/busytex/` (the WASM TeX engine). Only touch these when
adding LaTeX packages/fonts that BusyTeX doesn't ship — see their header
comments.

**`build-fontmap.js` reads the packages' `.map` files out of the `.data`, not
off the disk.** pdfTeX only embeds a Type1 font if it appears in the *assembled*
`pdftex.map`; it does not read each package's own `.map`. That assembly is
`updmap`'s job, driven by `updmap.cfg` — and the one BusyTeX ships lists
seventeen maps, those of TeX Live basic. Everything that arrived later in the
Ubuntu packages was therefore in the virtual file system but absent from the
map, which is exactly the shape of the bug: `\usepackage{marvosym}` compiled
into `pdfTeX error: Font umvs at 600 not found` while `umvs.tfm`, `umvs.fd`,
`marvosym.pfb` **and** `marvosym.map` all sat inside
`ubuntu-texlive-fonts-recommended.data`. (The 600 is a *resolution*: with no map
entry pdfTeX falls back to hunting a 600 dpi PK bitmap that does not exist.) The
script originally harvested maps only from a directory handed to it as
`argv[2]`, so it caught the fonts added by hand (bbold, dsfont, fourier…) and
nothing that shipped inside a package — eurosym, wasy, stmaryrd, esint, manfnt
and mflogo were down the same hole. It now walks every `.data` manifest;
`argv[2]` is still accepted and is now optional.

A line only goes in if the files it cites (`.pfb`, `.enc`…) really travel in
some package. Without that check an orphan entry turns `Font X at 600 not found`
into `cannot open file for reading` — equally broken and harder to read — and
193 of them were riding along (fourier's Utopia expert set, Libertinus).
Regenerating the map is the **whole** deployment path for this class of bug:
`latex.js` injects `extra/pdftex.map` on every compile (`always: true`), so
`ENGINE_VERSION` need not move — it guards only `busytex_worker.js` and
`busytex_pipeline.js`.
