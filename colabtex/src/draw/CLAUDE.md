# ColabDraw — notes for Claude

`colabdraw.html` + `colabdraw-app.js`; entry `colabtex/src/draw-main.js`, modules in this folder. Rebuild with `npm run build` in `colabtex/`.

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
  goes through `Drawing.edit()`, one transaction with the `LOCAL` origin —
  the only calls that pass another origin are repairs nobody asked for
  (`repararDefs`), which still sync but must not eat an undo step. The
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
  boxes, snapping, align/distribute, and `polygonPoints` (the vertices of a
  polygon or star). All of it verifiable without a browser. The polygon is
  inscribed in the drag **box**, not in a circle, so it is drawn corner to
  corner like the ellipse and a triangle can come out tall and narrow without
  scaling it afterwards; it starts at −90° because that is where a triangle's
  apex is expected — starting at 0° produced one lying on its side, which
  reads as a bug.

  It also owns the **curve** (`curvaPath`, `curvaSpec`, `curvaExtremos`,
  `esCurva`), which is a `<path>` carrying `data-curva` and `data-ondas`.
  Four decisions:
  - **The stored thing is the recipe, not just the trace.** Curvature is the
    arc's sagitta as a percentage of the half chord, so **100 % is exactly a
    semicircle** — the case people ask for by name — and the sign picks the
    side; `data-ondas` says into how many alternating arcs the chord is cut,
    so 2 is an S. Keeping the recipe is what lets an arrow drawn last week be
    re-curved, and "add a second or third curvature" is just that field.
  - **The endpoints are not stored**: they are already the first and last
    numbers of the `d`, and a second place saying where the curve starts is a
    second place that can lie. That reading is only safe because the `d` never
    contains an `A` (whose flags are not coordinates).
  - **It is drawn with cubic Béziers, not with `A`.** `reshape.js` rewrites the
    `d` when baking a scale and refuses an arc under an uneven one — a cubic
    just needs its four points moved — and a stretched semicircle has to come
    out elliptical, which is what transforming those points does by itself.
    Each arc is split into pieces of 90° or less, where the 4/3·tan(δ/4)
    approximation is off by under a ten-thousandth of the radius (measured:
    2.7e-4; the 100 % arc traces a real circle exactly).
  - **Curvature 0 emits a straight `L`**, because a curve with no curvature is
    a line and nothing downstream should have to special-case a degenerate arc.
- `svgio.js` — SVG in and out, **including the sanitiser**. `textToNodes`
  always returns the **shape** `{nodes, info, defs}`, never a bare `[]` on its
  failure paths: its four callers (`tools.js: paste`, both in `latex.js`,
  `ponerEnDefs` in `paint.js`) destructure it, and destructuring an array
  leaves `nodes` `undefined` **without throwing** — the error then surfaces one
  line later as `Cannot read properties of undefined (reading 'length')`, from
  a `try/catch` that was standing right there ready to say "eso no se puede
  pegar aquí". It was the most repeated fault in the tracker (35 times across
  three versions, always on paste): `image/svg+xml` is strict XML, so anything
  that passes the "looks like SVG" filter but is not well-formed — one unclosed
  tag, one undeclared namespace prefix — is a `parsererror`, and that crashed
  the app instead of being refused. An SVG is an
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

  An SVG can be imported **two ways**, and both come out of the same
  `svgToPieces` (defs + layers + their names, already in mm): as a **new
  drawing** (`svgToFragment` wraps the pieces in an `<svg>`) or **inside the
  open one** (`Drawing.importPieces`, wired in `draw-main.js` to the 📥 button
  and to dropping a file on the canvas). The second one needs two things the
  first does not, because there it lands among content that already exists:
  `freshIds` renumbers every id and rewrites the internal references in the
  same pass — two shapes sharing an id break selection and a `url(#…)` would
  resolve to the wrong gradient — and `dx`/`dy` place it at the corner of the
  **paper**, since the page can be cropped (`viewBox` x/y ≠ 0) and importing
  at the document origin drops it out of sight. `importPieces` writes the defs
  and the layers in **one** transaction: as two, a single Ctrl+Z would leave
  the gradients in and take the shapes out.
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

  It also owns the **framing**: `k` is screen px per millimetre, and 100 % zoom
  is `PX_MM` (96 ppp), which `zoomPercent`/`setZoomPercent` are the only place
  to convert — the canvas bar's zoom box is a *field*, not a label, so a
  drawing can be taken to 250 % without rolling the wheel there. `visibleBox`,
  `contentBox` and `scrollTo` exist for the scrollbars below and are all in
  millimetres, never pixels.
- `scrollbars.js` — the canvas's own scrollbars. The framing lives in the
  scene's `transform`, not in a scrolling box, so the browser never drew any
  and the only way to move was the wheel or space-drag. Two things they get
  right: the **reachable range is the page plus everything drawn** (an imported
  figure can land off the sheet, and without counting it there is no way to
  reach it) padded by a quarter of its own size — measured in *screens* the
  range grew as fast as the view, so the bars never went away when everything
  already fitted; and a hidden bar is measured **after** being shown, since a
  `display:none` box measures 0. Showing one sets `display:block` explicitly:
  clearing the inline style hands control back to the sheet, where `.dw-sb` is
  born `display:none`, so the bar would never appear at all.
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
  **What is drawn is in document coordinates; what is stored is inside a
  layer.** A layer carries its own `transform` — `svgio` *prepends* the mm
  normalisation to it, so every imported layer has one (`scale(0.2646…)` for a
  file in px) — so writing `canvas.toDoc()` coordinates straight into it asks
  for them to be transformed a second time: the line landed far from where it
  was drawn and at another size. `_espacioDeCapa()` computes the way back and
  everything created goes through it — points, `stroke-width`, `stroke-dasharray`,
  the rect's `rx`, and the text's `font-size`, because a length is as much in the
  layer's space as a coordinate is. It returns `null` when there is nothing to
  correct (a fresh layer has no transform), so the normal case pays nothing. A
  **rotated** layer is the one case it cannot map — a straight rectangle of the
  document is not a straight rectangle in there — so the shape keeps document
  coordinates and wears the inverse matrix instead, which cancels the scale and
  is why the width is *not* divided in that branch. `Tools._createText` splits
  the spec in two for the same reason: `pt`/`font-size` already translated for
  the layer, and `vista` in document space, which is what the floating
  `<textarea>` needs to place itself.

  **Ctrl+wheel steps five percentage points** (`_zoomRueda`), not a factor.
  Multiplicative zoom (`0.995^deltaY`) made the same gesture do a different
  thing on every machine, because a wheel notch reports 100, 120 or 53
  depending on browser and mouse. The delta is accumulated and **one** step is
  taken when it passes `RUEDA_UMBRAL`, emptying the counter — so a notch is
  always exactly one step whatever it reports, and a trackpad pinch (which
  arrives in slivers of two or three) advances smoothly instead of bolting.
  The target is rounded to a multiple of 5 *before* stepping, so the percentage
  always lands on 0 or 5 even coming from a fit-to-page that left it at 78 %.

  **Mayús and Alt while drawing** (`_geoCrear`) give square/circle, 15° angles on
  a line, and drawing from the centre. The resulting corners are stored in the
  drag (`d.a`/`d.b`) and it is *those* that `_createShape` uses on release —
  taking `start`/`end` again would create something different from what the
  preview showed. The preview itself (`_drawCreatePreview`) is painted with the
  **real style**, written inline because a CSS class beats a presentation
  attribute; it lives in the overlay, which is in screen pixels, so widths and
  dashes are multiplied by `canvas.k` by hand.

  **The curve tool is the line tool with a bulge** (`esLineal`): same drag from
  end to end, same Mayús/Alt, same arrowheads, no fill — what you point at are
  its two ends, and how much it bows comes from the bar. Its preview is
  computed in screen pixels rather than scaling the document's curve, because a
  curve is not a box that can be stretched. Re-curving what is already drawn
  goes through `Tools.setCurva`, **not** `applyStyle`: the latter writes one
  value to the whole selection, and here each curve has its own endpoints and
  its own `d` to recompute — all inside one `edit()`, so one Ctrl+Z undoes the
  lot instead of one curve at a time.

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
  - **The canvas takes focus away from panel fields before anything else**
    (`_soltarFoco`, first line of `_pointerDown`). This looks like a detail and
    was the whole of "editing a text that is already placed does nothing": the
    number fields (Cuerpo, Grosor…) commit on `change`, i.e. on leaving the
    field, and the canvas's `pointerdown` calls `preventDefault()`, which
    prevents exactly that. Typing 12 in Cuerpo and clicking the drawing to see
    it left the field *still focused* — so it never committed — with the
    selection already cleared: the label stayed as it was and the panel looked
    broken. Blurring here fires the `change` while the selection is still live,
    and hands the keyboard back, since with the caret inside an `<input>` the
    S/R/L shortcuts never reached Tools either. `style.js` and
    `tool-options.js` additionally commit ~350 ms after the last keystroke so
    that path need not be walked at all, and both skip refreshing a field that
    has focus, so they cannot overwrite what is being typed.
  - **Handles that cannot do anything are not drawn.** A straight line's frame
    has zero height, so `n`/`s` would multiply zero by something and stay zero;
    a handle that does nothing when you pull it reads as a broken app.

  **Copy/paste lives here too**, and hangs off the document's `copy`/`cut`/
  `paste` events rather than off Ctrl+C in the keydown handler: that is what
  gets the real clipboard without asking for the permission the async
  Clipboard API demands. What travels is **SVG text**, not nodes — an
  unintegrated Yjs clone cannot be read (the same trap as everywhere else), so
  storing nodes would give a clipboard good for exactly one paste. Pasting
  accepts outside markup only if it really looks like SVG, otherwise it falls
  back to the internal `clip`. With **nothing selected, copy takes the whole
  active layer**, and a whole layer pastes back *as a layer*; anything else
  lands on the active layer offset by 2 mm so it's visible that there are now
  two.
- `reshape.js` — **baking a scale into the geometry**, pure arithmetic. A
  `scale(3,1)` stored in the `transform` scales the *stroke* too, per axis: the
  vertical edges come out three times thicker than the horizontal ones and the
  rounded corners turn into ovals. Measured on a 0.5 mm stroke stretched ×3:
  the ink reached 0.75 px sideways and 0.25 px top-to-bottom. No SVG attribute
  fixes that — a stroke has one width — so on release `Tools._commit` moves the
  scale out of the matrix and into the coordinates (`bakeShape`: `rect`
  `width`, `ellipse` `rx/ry`, `points`, the `d` of a path), the way Inkscape's
  "optimized" transform storage does. Four rules:
  - **Only a matrix with no rotation or skew** (`esRecta`) can be baked; a
    rotated shape keeps its transform, which is exactly the case `_marco()`
    already handles by scaling in the shape's own axes.
  - **The outline does not scale at all.** A 1 mm stroke is still 1 mm after
    the shape is made big, and so are its dashes — which is what was asked
    for, and what any drawing program does with "scale stroke width" off.
    That does *not* mean `bakeTrazo` is always handed 1: the matrix being
    baked may carry an *earlier* scale (an imported shape with its own
    `scale()`), and that one has to end up in the number or the stroke would
    jump on release, so `_commit` passes `expansion(M) / expansion(T)` — what
    was already there, without this gesture. What survives that is scaled
    **isotropically**, by √|det|, because a stroke width is a single number
    and cannot stretch along one axis. The corner radius is the exception
    that proves the rule: it *is* geometry, so it grows with the shape (also
    isotropically, or a stretched rectangle ends up with oval corners).
  - **The same promise holds for what could not be baked.** A rotated shape,
    a text or a group containing one keeps its matrix, and a matrix does
    thicken the stroke — so `_commit` divides the stored width by the
    gesture's factor instead (`Tools._compensarTrazo`, capped at
    `MAX_TRAZOS` = 400 nodes so a matplotlib figure isn't rewritten whole on
    every drag). The result on screen therefore does not depend on whether
    the shape could be baked. The *preview* pays the same debt from the
    other side: the mirror DOM gets an inline `stroke-width` while dragging
    (`Tools._previewTrazo`), because otherwise a shape stretched ×3 would
    show a triple-thick outline for the whole gesture and snap thin on
    release. That inline style is cleared **before** the Yjs write, never
    after: afterwards the mirror has already caught up with the document and
    restoring the old value would cover it.
  - **A group bakes whole or not at all** (`Tools._planHornear` collects every
    write before applying any): one `<text>`, one formula or one rotated child
    inside is enough to leave the group with its matrix, and baking it halfway
    would change how the drawing looks.
  - **Text, formulas and curves are never baked.** A font size is a single
    number and can't stretch along one axis, and a formula's size is read back
    out of its own transform (`latex.js: tamañoDe`), so baking would leave the
    panel lying forever. A curve is the same case: its `data-curva` is a
    percentage *of its own chord*, so a one-axis stretch baked into the `d`
    would change that proportion without changing the number — the panel would
    say 70 % over a curve that is now 35, and touching the curvature afterwards
    would straighten the stretch out in one go. Keeping the matrix, a stretched
    semicircle stays a stretched semicircle and raising its curvature keeps it
    stretched; `_compensarTrazo` pays for the stroke, as with everything else
    that can't be baked.
  A path longer than `MAX_PATH` (20 000 chars) is left alone: rewriting a
  matplotlib figure's `d` on every drag would push that whole string through
  the database. `transformPath` also refuses an **arc rotated under a
  non-uniform scale** — the radii would have to be recomputed from the conic.
  One trap it depends on: after baking, `_commit` clears the preview transform
  from the **mirror DOM by hand**, because removing an attribute the element
  never had emits no Yjs event (verified) and the mirror would keep the
  preview's matrix on top of the already-scaled geometry — the shape drawn
  twice as large as it was released.
- `palette.js` — the project's **saved colours and gradients**, offered at the
  top of the colour popover. Composing a gradient is eight decisions, and
  people were duplicating a whole shape just to inherit its fill. Three
  decisions: it lives in the **same `Y.Doc` as the drawings** (`Y.Array
  "paleta"`), so it syncs to the team, travels with the project and needs no
  new security rules; it stores the **spec**, never the `url(#…)` — a
  reference means nothing in another drawing and `gcDefs` would collect it the
  moment nobody used it, whereas from the spec `paintValue` rebuilds the
  definition wherever it is applied; and it **refuses duplicates**
  (`mismaPaint` on normalised specs), returning the existing entry, because a
  palette with the same colour six times stops being a palette.
- `stroke.js` — the cap/join/dash tables and the SVG defaults, shared by the
  three places that touch a stroke (`tools.js` creates, `style.js` edits,
  `tool-options.js` chooses). It exists because the opposite happened:
  `stroke-linecap: "round"` was hardcoded in `tools.js` with no control anywhere
  to change it, so *every* line ever drawn came out rounded for good. `capAttr`
  / `joinAttr` return `null` for a value that is already the SVG default, so the
  file doesn't fill up with attributes that change nothing — but the panel
  writes the default **explicitly**, because the selection may be inheriting
  `round` from its group or from an imported file.
- `tool-options.js` — the bar that floats over the canvas while a drawing tool
  is in hand. It carries what has to be decided *before* dragging (colour,
  width, dash, corner radius) plus the modifiers nobody discovers on their own,
  and it is the only home of the options that are not SVG attributes
  (`Tools.crear`: the next rect's `rx`, the next curve's curvature and number
  of waves, and "seguir dibujando", which keeps the tool instead of snapping
  back to the arrow). The curve's two go out through `onCurva`, not `setCrear`,
  so they also reach a curve that is already selected — which is the normal
  case with "seguir dibujando" on. It is **rebuilt only when the
  tool changes** and otherwise just re-synced, skipping whatever control has
  focus — a refresh mid-typing used to eat half of what was typed. Two layout
  traps: the hint gets `flex-basis:100%` so the bar is deterministically two
  rows rather than wrapping wherever it lands, and it is centred with
  `left/right + margin:auto`, **not** `left:50%` + a translation — an absolutely
  positioned box with `right:auto` is only offered half the width to lay out in,
  so the bar broke into four rows where one was enough.
- `latex.js` + `math-engine.js` + `formula-modal.js` — **LaTeX formulas**. A
  formula is a `<g data-latex="…">` holding MathJax's own `<path>`s: real vector
  strokes, so it moves, rotates, recolours, exports to SVG/PNG and lands in a PDF
  like any other shape, and the TeX travels with it so it can be reopened and
  corrected. Decisions worth keeping:
  - **MathJax, not KaTeX**, even though KaTeX is already a dependency for
    ColabTeX: KaTeX only emits HTML positioned by CSS, and getting that into an
    SVG needs a `<foreignObject>` — which the sanitiser drops, rightly, since it
    is executable HTML inside the drawing.
  - **The engine is a separate bundle** (`colabdraw-math.js`, ~1.6 MB — MathJax
    plus its fonts) injected the first time someone writes a formula. Folding it
    into `colabdraw-app.js` would quadruple what every visitor downloads to draw
    a rectangle. It carries the *page's* `?v=`, so it can never be a stale copy
    from cache. `--define:PACKAGE_VERSION` in `build:math` is not optional:
    MathJax reads its own version through `eval("require")`, which esbuild
    cannot see and which throws `require is not defined` in a browser.
  - **1 em = 1000 viewBox units** (verified, not assumed: `\rule{1em}{1em}`
    comes out 1000×1000), and MathJax's content already carries its own
    `scale(1,-1)` with the baseline at y=0. So `translate(x,y) scale(mm/1000)`
    puts the formula where it was clicked, at the millimetres asked for, with
    the same semantics as a `<text>`'s `x`/`y`.
  - **The size is not stored anywhere**: `tamañoDe()` reads it back out of the
    transform. Storing it would leave it lying the moment someone scaled the
    formula with the handles, and the edit box would show a number that isn't
    the one on screen. Re-editing with a new size composes `T · scale(new/now)`,
    which grows it about its own baseline and works on a rotated formula too.
  - **MathJax paints with `currentColor`**, which resolves against the `color`
    property, *not* the parent's `fill` — left alone, formulas were always black
    and the fill panel did nothing to them. Those attributes are stripped on
    insert so the wrapper's `fill` cascades normally.
  - A bad formula **does not go in**: MathJax doesn't throw, it *draws* the
    error (`data-mjx-error`), so `renderSvg` turns that into a real exception
    and the modal shows the message with the button disabled.
  - Rewriting a formula **replaces the whole `<g>`** (clone-and-delete, as
    everywhere else) rather than swapping its children: the new strokes are not
    integrated in the document yet, and an unintegrated node can't be read —
    not even for its child list. The old `id`, `fill`, `opacity`, `display` and
    lock are carried over so selection, the object tree and the look survive.
  - A formula is a `<g>`, so both `layers.js` (drops) and `Tools.ungroup` treat
    it as a **closed shape** on purpose: dropping something inside would be
    erased by the next edit, and ungrouping would scatter it into paths and take
    its LaTeX with it — losing the ability to correct it, permanently.
  - **A double backslash is wrapped, not passed through** (`prepararTex`). In
    TeX it only means «next line» inside an environment with rows; loose in
    maths mode MathJax answers with an error and the formula never goes in —
    but typing `\begin{gathered}…\end{gathered}` by hand to split a caption
    in two is too much to ask. So the editor adds the wrapper (`aligned` when
    there is an unescaped `&`, `gathered` otherwise) while `data-latex` keeps
    exactly what was typed, which is what reopening shows. Text that already
    starts with `\begin{` is left alone: whoever wrote it is driving, and
    another environment around a `cases` would break its alignment. Both
    environments come from the `ams` package `math-engine.js` already loads.
  - Re-editing is on a **button in the style panel** (the FÓRMULA section, with
    the LaTeX itself above it), not only on double-click and Intro: both of
    those are invisible, and a formula placed days ago read as untouchable.
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
  layer operations. Its rows read
  `[indent][▸][type icon] name … [eye][padlock]`, and four rules make it
  legible rather than a list of ids:
  - **Icons are drawn SVG, not emoji.** Every OS paints 👁 and 🔒 its own
    size, colour and baseline; as inline strokes inheriting `currentColor`,
    painting the row is enough to make the icon agree with it.
  - **Rows are named after what they are or what they contain** (`nombreDe`):
    "Rectángulo", "Grupo (3)", a text by its own words, a formula by its LaTeX.
    `labelOf` ends up falling back to the `id`, and a list of `ewxwgvzb` says
    nothing about the drawing.
  - **A text and a formula are leaves** (`esHoja`/`hijosDe`, and `tspan` is in
    `OCULTOS`): a formula is dozens of MathJax `<path>`s and groups, none of
    them selectable on their own, and expanding one buried the whole drawing
    under a single figure's guts.
  - **Hidden and locked are shown at two strengths**: strong for the row that
    carries it, faint for one that only *inherits* it from its layer or group
    (`hiddenAncestor`/`lockedAncestor` name the culprit in the tooltip).
    Otherwise a locked layer with twenty shapes paints twenty-one striped rows
    and it stops being clear who is imposing what — while a shape that can't be
    clicked looks identical to one that can.

  It shows the **whole tree**, not just the layers: an
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
  Rows are also **draggable, with three zones each** (`zonaDe`), like any file
  explorer: the top and bottom 30 % drop *beside* the target, the middle drops
  *inside* it — and the middle only exists when the target can hold children,
  otherwise the row splits 50/50 into before/after. Two structural rules are
  enforced on the drop rather than left to the user: a **layer** may only hang
  off the `<svg>`, and a **shape** only off a layer or a group. Since each level
  is listed reversed, the insertion index is computed reversed too — the obvious
  `at`/`at + 1` is the wrong way round here.

  **Right-click opens a menu** (rename, duplicate, copy, paste, delete) —
  before it, renaming was a double-click nobody discovers and deleting a layer
  could only be done from the header button, and only to the *active* one. Four
  things it settles: the row is **selected first** unless it already was, so
  the menu acts on what was clicked, and on the whole selection when the row is
  part of it (which is what you expect after Shift-picking three shapes); a
  layer's actions apply to the layer, so **Duplicar** goes through
  `Drawing.duplicateLayer` — no 2 mm offset (that would move everything inside
  it) and a free name, or the panel shows two «Fondo» with no way to tell them
  apart; **Pegar** makes the clicked row's layer active first, so what is
  pasted lands where you clicked and not in whatever layer was active before;
  and the menu itself hangs off `<body>` in `position:fixed`, like the colour
  popover, because the panel scrolls and would clip the menu of the bottom row
  — the one that needs it most. Copy/paste are the only two it cannot do by
  itself (the clipboard lives in `tools.js`, which knows how to turn shapes
  into SVG markup and back), so they arrive as `ctx` callbacks; pasting reads
  `Tools.clip` rather than the system clipboard, since *reading* that one asks
  for a permission.
- `preview.js` — looking at an exported PNG/PDF in the canvas's place, with a
  download **button**; clicking a generated file used to download it blind. The
  canvas is covered, never destroyed (same reason as ColabTeX's asset preview).
  PDFs go in an `<iframe>` with the browser's own viewer — pulling pdf.js in
  would add more than a megabyte to show a one-page figure.
- `paint.js` + `color-popover.js` — **colour, gradients and shadows**. A `fill`
  or a `stroke` is described by one *spec* (`none` / `solid` / `linear` / `radial`)
  so the panel never branches on which it is. The top half of `paint.js` is
  pure arithmetic (angle↔vector, radius, CSS preview) and runs in Node; the
  bottom half writes to `<defs>`. Decisions worth keeping:
  - **The panel shows one clickable chip per channel, not a grid.** Two
    fifteen-swatch grids permanently open ate half the panel and pushed the
    stroke width off screen, for something touched once in a while. Everything
    else — palette, the native colour map, hex, the whole gradient editor —
    lives in the popover, which hangs off `<body>` in `position:fixed` because
    the panel is `overflow:auto` and would clip it.
  - **`gradientUnits` stays at the default `objectBoundingBox`**: coordinates
    run 0–1 over the shape's own box, so a gradient needs to know nothing about
    millimetres and follows the shape through moves, scales and rotations. In
    user units every drag would have to rewrite the `<defs>`.
  - **The angle is stored as the vector SVG understands**, never as a
    `data-ang` beside it — a second place saying the same thing is a second
    place that can lie. It comes back out with `atan2`.
  - **The radial's radius reaches the farthest corner.** With SVG's default
    `r = 0.5` a gradient centred on a corner left half the shape flat in the
    last stop's colour and read as "the editor didn't apply it".
  - **Every apply makes a new `<defs>` entry and `gcDefs` collects the
    orphans**, which is what keeps a colour dragged around the picker from
    leaving one definition per keystroke. It only ever deletes entries carrying
    `data-dw-grad` — an imported file's gradients are not ours to remove — and
    takes an `enUso` list, because the colour waiting for the *next* shape is
    referenced by nothing yet and was being collected mid-gesture.
  - **A copied shape carries its definitions** (`clipboardSvg({defs})`,
    `textToNodes` → `defs`): without them a paste into another drawing left
    `fill="url(#…)"` pointing at nothing, i.e. a black shape. `textToNodes`
    renumbers ids and rewrites the references in the same pass, so both halves
    still match. Note this can only be checked by pasting for real — an
    unintegrated Yjs node returns nothing when read, the same trap as
    everywhere else.
  - **A shadow is a `<filter>` holding one `feDropShadow`**, not the long
    recipe (`feGaussianBlur` + `feOffset` + `feFlood` + `feMerge`). One node
    does the same thing, every current browser understands it, and — what
    matters here — it can be *read back*: recovering the blur from a chain of
    five primitives to refill the panel is a parser nobody wants to own.
    `dx`/`dy`/`stdDeviation` are in the **element's own user space** — the one
    *after* its own `transform`, which is what `primitiveUnits` defaults to —
    and that is not millimetres of paper. Verified by measuring ink: the same
    `dx="10"` moves the shadow 10 document units on an untransformed shape and
    1 on the same shape built with `scale(0.1)`. It was the bug behind "the
    shadow of a formula doesn't offset, it looks like an outline": a formula
    carries `scale(size/1000)`, i.e. 0.005 for a 5 mm one, so a 0.8 mm offset
    became 0.004 mm and the only thing left was the blur peeking around the
    strokes (measured: **zero** shadow pixels before, 0.75 mm of offset after).
    Anything inside an imported layer had the same fault, scaled by the layer.
    So the spec is written and read **divided by that scale** — the very one
    that already converts stroke width in the panel (`Tools.selectionScale`),
    and the conversion back happens *before* clamping, or a 40 mm shadow on a
    formula (8000 of its units) would clamp to 40 and come back as 0.2. When
    the selection disagrees that scale is 1 and nothing is converted: same rule
    as stroke width and corner radius. The filter **region**, on the
    other hand, may *not* be in bbox percentages, and that was the bug behind
    "I put a shadow on a line and it disappears": a horizontal line's bbox is
    70 × 0, any percentage of that zero is still zero, and a filter region of
    zero area means the browser draws **nothing at all** — not the shadow and
    not the line (verified in Chrome: 0 ink). So it is `userSpaceOnUse` with
    a fixed, enormous region (±100 000 mm, through the same scale as the
    offsets, so it covers as much inside a formula). Three things make that
    safe: the
    region is read in the *element's own* space (verified: a shape with
    `transform="translate(60,0)"` still paints in full against a region
    written for its untranslated geometry), so no transform can ever leave it
    stale; it is numerically bigger than any drawing and than the pixel
    coordinates of a layer imported with a `scale()`; and it costs nothing,
    because Chrome clips the region to what is visible — 40 shadowed shapes
    paint at 10.9 ms/frame with it against 16.6 ms with the old bbox region.
    `repararDefs` rewrites what earlier versions wrote — these filters and the
    old arrowheads below — when a drawing opens (with a non-`LOCAL` origin, so
    it doesn't eat an undo step): the alternative was asking people to find and
    re-tick a shape that is precisely the one they cannot see. It reads the
    `<defs>` that is already there rather than calling `drawing.defs()`, which
    *creates* one — that would have written to every imported drawing that
    lacks it, on open, for nothing.
    `readShadow` returns the string `"ajeno"` for a filter that is not ours —
    an imported one can be anything — so the panel can say so instead of
    presenting someone else's colour matrix as a shadow. The filter tags had
    to be added to `svgio`'s allowlist; `feImage` was deliberately left out,
    being the one primitive that fetches from another origin.
  - **An arrowhead ends where the line ends, not where the line's tip is.**
    This was a real bug, and the one users reported: with the reference point
    at the very vertex (`refX="9"` of ten), the line ran all the way there and
    its cap — round, so half a stroke-width longer than the stroke itself —
    stuck out *past* the head, like a blob growing out of the arrow. `refX` now
    sits at each type's **base** (or at the notch, on the concave one), so the
    cap is swallowed by the fill and nothing pokes through the tip. The price
    is that the head adds its length beyond the endpoint you dragged, which is
    what every editor does, because SVG cannot shorten a line. Types that read
    as a *head* (triangle, concave, open) point outwards from the endpoint;
    types that read as a *mark* (circle, diamond, bar) are centred **on** it.
    The two stroked ones (open, bar) have nothing to hide a cap with, so the
    open one is anchored short of its vertex, where its two arms already
    overlap into solid ink; with a line as thick as half the arrowhead a nub
    still shows, and that is inherent.
  - **The size is independent of the stroke width** (`markerUnits` is
    `userSpaceOnUse`, not `strokeWidth`) — a thin line with a big head, or the
    reverse, without having to fatten the stroke to see the arrow. It is in
    drawing units, i.e. millimetres except inside an imported layer with its
    own scale, and it is deliberately *not* run through `getScale` like the
    stroke width is: one marker is shared by shapes that may live in layers
    with different scales, so there is no single right conversion.
  - **One marker per type and size, reused** (`data-dw-arrow` holds the type,
    `markerWidth` the size — each fact in one place). One per drawing was
    enough while there was nothing to choose; now two different arrows need
    two definitions, but two identical ones still share theirs, and `gcDefs`
    collects what stops being used. The chosen type and size live in
    `Tools.crear`, not in the style: with no arrowhead set there is no
    `marker-*` attribute to keep them in, and picking "diamond, 5 mm",
    removing the head and putting it back gave the default triangle again.
    The **line preview** copies the marker into the handle layer at
    `size × canvas.k` (`Tools._puntaPreview`): that layer is in screen pixels,
    so pointing it straight at the document's marker drew a 3-pixel head under
    an 11-pixel line.
  - `orient="auto-start-reverse"` is what makes the
    start-side head point outwards; plain `auto` had it aiming into the line.
    Storing a colour instead of `context-stroke` would mean rewriting `<defs>`
    from the style panel every time the stroke changed. `esMarcable` limits the
    two `marker-*` attributes to open shapes (line/polyline/path): on a rect
    the attribute is inert decoration, and on a **polygon** SVG really does
    draw a head at the first and last vertex — so choosing "arrow" with a
    polygon still selected used to stick one on its corner, because the panel,
    the tool bar and the shape tools all funnel through `Tools.applyStyle`.
- `style.js` — the fill/stroke/text/formula/rect/curve/shadow/opacity/order/page
  panel, built in JS. Sections that only describe one kind of thing (TEXTO,
  FÓRMULA, RECTÁNGULO, CURVA) appear only when the selection is that thing —
  RECTÁNGULO needs *every* selected element to be a `<rect>`, since writing a
  radius with a circle in the selection would set an attribute that draws
  nothing and leave the panel lying, and CURVA the same with `esCurva` (an
  imported `<path>` has no recipe to show, and writing one would replace the
  trace it came with). Both exist for the same reason: the corner radius and
  the curvature could be chosen *before* dragging and never afterwards, and
  the curvature is precisely what you want to fix afterwards — an arrow is
  drawn pointing where it must point, and only then is it clear how much flight
  it needs. Its `rx` is converted through `getScale`
  exactly like the stroke width, for the same reason: the radius lives in the
  shape's coordinates and the panel shows what is on screen. Shows
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
