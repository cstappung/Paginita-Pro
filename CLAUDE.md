# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Laboratorio** — a static site (published to GitHub Pages) that hosts a small
suite of browser-only tools. There is **no application backend**: everything
runs client-side, and persistence for the collaborative tool lives in Firebase.
`index.html` redirects to `Inicio.dc.html`, the landing menu.

Six apps plus a small shared **Informes** page:

- **CSV·Scope** (`CSV Oscilloscope.dc.html` + `scope-engine.js`) — offline
  oscilloscope for CSV captures (cursors, trigger, FFT/harmonics, XY, math
  channels, a plot grid, periodic repeat and a Fourier reconstruction overlay —
  see "CSV·Scope" below). Self-contained, no build step, no backend: editing
  `scope-engine.js` takes effect on reload, with no `npm run build`.
- **ColabTeX** (`colabtex.html` + `colabtex-app.js`) — an Overleaf-style
  collaborative LaTeX editor. This is where nearly all the complexity is; its
  source lives in [colabtex/src/](colabtex/src/) and is bundled into the
  root-level `colabtex-app.js`.
- **ColabDraw** (`colabdraw.html` + `colabdraw-app.js`) — an Inkscape-style
  collaborative SVG editor for paper figures. Source in
  [colabtex/src/draw/](colabtex/src/draw/) plus the entry
  `colabtex/src/draw-main.js`. Shares Firebase, auth and the Yjs provider with
  ColabTeX (see "ColabDraw" below).
- **FiltroLab** (`Filtros.dc.html` + `filtros-engine.js`) — analog filter
  designer: from the band template it finds the minimum order that meets it,
  splits the poles into second-order sections with their f0 and Q, plots the
  Bode of the whole cascade, and — the part the Analog Devices Filter Wizard
  does not do — pushes a test signal through the resulting H(jω) so the input
  and the output can be compared in time and in the spectrum. See "FiltroLab"
  below. Self-contained like CSV·Scope: no build step, no backend.
- **AjusteLab** (`Ajustes.dc.html` + `ajuste-engine.js`) — curve fitting with
  uncertainties: it fits a model (line, polynomial, exponential, power, sine,
  Gaussian, Lorentzian, or one you type) to measured data and answers what a
  report needs — parameters with their σ, χ²/ν and its p, residuals, derived
  quantities with the uncertainty propagated through the whole covariance
  matrix — and from there writes the LaTeX table and the figure in millimetres
  for ColabDraw. See "AjusteLab" below. Self-contained like CSV·Scope and
  FiltroLab: no build step, no backend.
- **Informes** (`informes.html` + `informes-app.js`, entry
  `colabtex/src/reports-main.js`) — the shared bug tracker: errors the apps
  collect by themselves, plus the bugs and ideas people write. See "Informes"
  below.
- **Juegos** (`juegos.html` + `juegos-app.js`, entry
  `colabtex/src/juegos-main.js`) — eighteen multiplayer games, on the same Google
  account and the same Firebase project: **Escondite** (hide a person in a
  landscape, then cross the landscapes and race to find the other's),
  **Cartas de los tres elementos** (a Card-Jitsu duel), **Cuadritos** (dots and
  boxes, two to ten players and three board sizes), **Reversi**, **Órbita** (gravity
  slingshot for two to four: launch probes, steal stars, shoot down satellites),
  **Chain Reaction** (critical-mass orbs that burst into their neighbours, two
  to eight players and three grid sizes), **Flip 7** (the push-your-luck card
  game, two to ten players, Normal, Vengeance and Super Vengeance), **Cacho**
  (the Chilean liar's dice, *dudo* mode, two to eight players, with the
  optional *partida siciliana*), **UNO** (two to ten players, in five
  versions: Clásico, No Mercy, No Mercy with the expansion, All Wild and
  Liar's), **Catan** (two to six, with the 5–6 extension, *Navegantes* and
  three table variants), **Presidente** (the «culo», three to ten, an endless
  table people join and leave between rounds), **Spicy** (the bluffing card
  game, two to six), **Tetris** (everyone plays at once and sends garbage to
  the next seat), **Circuit Breakers** (a Worms-style artillery game
  for two to eight squads, in an iframe), **Yemas** (a first-person
  egg shooter for two to eight in four modes, zombies included, with voice chat, also in an
  iframe) and **Clue** (the deduction board game on a map of a real
  university building, two to six, in an iframe, dealt with mental poker)
  and **Ajedrez** (chess, the full rules, for two) and **Pokémon** (singles
  battles on Pokémon Showdown's own simulator, with a team builder), plus
  **Frontera Batalla**, Emerald's Battle Frontier played solo with the same
  teams, plus a **Clasificación** tab and a 📖 **Reglas**
  manual for every game, solo ones included, coins, and **PRODROP**, a card-pack
  opener paid with them. See "Juegos" below.

ColabTeX, ColabDraw, FiltroLab, AjusteLab, Juegos and Informes are authored in
**Spanish** — UI text, comments and identifiers alike. **CSV·Scope is the exception: it is in
English** ("Load CSV", "Measurements", "Trigger"), and its own comments follow.
Match whichever app you are editing rather than the repo as a whole.

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
  `?v=…` (see the ColabDraw "formulas" section). It is a build artifact all the
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

### Vendor rebuild scripts (rarely needed)

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

## CSV·Scope architecture

One file, `scope-engine.js`, an IIFE on `window.ScopeApp` guarded against the
`.dc.html` runtime evaluating helmet `<script>`s twice. The markup and the
sidebar live in `CSV Oscilloscope.dc.html`; every id it declares must appear in
`REF_IDS` or `init()` bails with a console error naming the missing ones. All
of the skin is in `injectCSS()`.

**The header is found, not assumed.** The parser worker locates the *data*
first — the first pair of consecutive lines that parse as numbers with the same
field count — and takes the nearest readable line above it as the names. A
Tektronix export opens with a preamble (Model, then Channel / Waveform Type /
Vertical Units / Sample Interval repeated per channel in side-by-side blocks, a
blank line and `ANALOG_Thumbnail`) before its real `TIME,CH1,…` row, so reading
line 1 as the header turned that file into a channel called "Model" full of
zeros. The preamble is then read for **units**: `Vertical Units` appears once
per channel in file order (V on CH1–CH4, A on CH5–CH6 in an MSO46 ALL export),
and that is what lets a math channel multiply a volt by an amp and label the
result W. Only the first `SCAN_LINES` (400) are split into lines — splitting a
250 k-row capture to find its header would allocate the whole file again as
strings. Separator and decimal are detected by trial (`,` / `;` / tab, decimal
point or comma); a line whose *time* field is not a number is skipped rather
than stored as a 0 s sample, which is what drops footers and the repeated
header of a concatenated export.

**The plot grid is one canvas, not many.** `S.layout = {rows, cols}` (up to
6×6) and `paneRects()` cuts the scope canvas into pane rectangles in reading
order. Separate canvases would have meant 36 backing stores to allocate and
composite, and would have broken the persistence buffer, the drop zone, the
PNG screenshot and the hit testing, all of which assume one surface.
Consequences worth knowing:

- **The coordinate helpers take the pane**: `timeToX(t, P)`, `xToTime(x, P)`,
  `valueToY(ch, v, P)`, `yToValue(ch, y, P)`, `pxPerDivV(P)`. Omitting `P`
  means the whole canvas, which is exactly the 1×1 case — that is what keeps
  the single-plot path free of layout code, and what lets the zoom strip and
  the quick spectrum go on ignoring that panes exist.
- **The time base is shared across panes** — one Time/div, one centre. Panes
  separate traces vertically; making each show a different slice of time would
  defeat the point, which is comparing them at the same instant. `viewWindow()`
  is therefore the authority on the visible window, derived from the time base
  alone rather than from any canvas width.
- **A hit carries its pane** (`hitTest` returns `{..., P}`) and the drag stores
  it. Re-resolving the pane from the pointer mid-drag would reinterpret a grab
  that started in pane 4 against pane 0 the moment it crossed a gutter.
- **A channel names the panes it appears in** (`ch.panes`, an array, so it can
  be in several). `panesOf()` falls back to pane 0 and the UI refuses to clear
  the last one: a visible channel must always be drawn somewhere, or its eye
  stays on while it is nowhere on screen. Shrinking the grid folds stranded
  indices back with a modulo (`remapPanes`) instead of heaping them into pane 0.
- **Chrome is dropped as panes shrink**, biggest first: the legend bar below
  150 px, the time stamps below 105 px, the graticule's subdivision ticks when
  a division is under 22 px. At 6×6 a pane is ~120 px, and legend plus stamps
  would spend a third of it on labels.

**It is driven like a PLECS scope.** A toolbar above the plot (`.ptb`, the
`tb*` ids) holds pointer / zoom box / zoom X / zoom Y / pan, fit, fit Y, and
back/forward through a view history (`S.hist`, snapshots from `viewSnap`, with
`pushHist` called once per gesture and `histBurst` per wheel burst). The wheel
zooms continuously about the pointer. Shift or the y gutter zooms Y. Dragging a
gutter pans that axis, and a double-click fits. By default every plot has a real
y axis (`S.yMode = "axis"`, `S.axes[pane]`, auto or fixed min/max, edited in
*Plot axes*). The bench-scope V/div model is `"div"`, and touching a channel's
V/div or position switches to it. Time cursors fill a table (`cursorCard`)
with value at each cursor, Δ, mean, RMS, min and max between them. Two traps:
`bindScopeInteractions()` must be called from `wire()`, and the FFT legend is
`drawSpecLegend`. Two function declarations named `drawLegend` silently
shadowed each other and broke `render()`.

**Periodic repeat** (`ch.periodic`) redraws one period of the record over and
over so the record can be scrolled past either end. `resolvePeriod` measures it
with the *same* `findPeriod` the Measurements table uses, so the two can never
disagree; `record` and `manual` are the other two modes. It repeats **one
period, not the whole record** — tiling the whole capture at a period shorter
than itself stacks overlapping copies instead of continuing the wave.
Everything that reads the signal has to honour it or it contradicts what is
drawn: `sampleAt` wraps (else hovering a repeated cycle reads "—" over a
visible wave) and `visibleRange` folds the window back into the record (else
the table reported Pk-Pk 0 V and Freq "—" while the screen plainly oscillated).

**Every tile is clipped to the visible window in index space** (`clipTile`),
not merely by the canvas clip rect. The min/max decimator spreads `count`
samples across `pxCount` pixels, so handing it a whole period while only a
sliver of that period is on screen squeezes the entire cycle into the sliver —
which is exactly how the edge tiles came out visibly compressed. The pixel span
(`xS`/`xE`) must then *not* be clamped to the pane, or the same mismatch comes
back from the other side. The bug only shows when the window edge falls
mid-period: with `hOffset` on an exact multiple of the period every tile is
whole and nothing looks wrong, which is why it is easy to "fix" and still ship.

**The Fourier reconstruction overlay** (`drawReconstruction`) rebuilds each
wave from its own harmonics, summing `k` of them, drawn over the very trace it
approximates. Four things it depends on:

- **Harmonics are per channel** (`ensureHarm` → `ch.harmCache`), not the FFT
  tab's single `S.harm`: channels in one capture routinely have different
  fundamentals (a 50 Hz voltage beside a 120 Hz ripple), and one global f₀
  cannot describe both. The FFT tab still owns the deep single-channel analysis
  (THD, TDD, the tables); this is the cheap per-channel version.
- Each curve is drawn in a **lightened, dashed cast of its own channel colour**.
  A single white curve was unattributable the moment two channels were
  reconstructed at once.
- `computeHarmonics` has already folded `invert` into its coefficients (it
  multiplies by `sgn`), so the series is in *displayed* value space. It is
  pre-multiplied by `sgn` before `valueToY`, which inverts again — without
  that, an inverted channel's reconstruction is mirrored about its own zero and
  reads as a phase bug rather than a sign bug.
- It analyses the **full record, never the visible window**, so the overlay
  does not change shape as you pan — a reference that moves is not a reference.

**The fundamental is measured, not typed** (`autoFundamental`), both for the
overlay and for the FFT tab's f₁ box. It spans first-to-last zero crossing
rather than taking the median interval that `findPeriod` reports: the median is
quantised to the sample rate, so at 20 kS/s a 50 Hz period lands on 20.00 or
20.05 ms — invisible in the Measurements column, ruinous in a reconstruction
where it accumulates into visible phase drift by the far side of the screen.
The spectrum is no help: its resolution is 1/record, which over six cycles of
50 Hz is 8 Hz-wide bins. Typing in the f₁ box clears the "detect automatically"
tick by itself, or the next source change would silently overwrite what was
just typed.

**The FFT tab compares any number of channels against the source**
(`S.fftCompare`, ticked under *Compare*). `runAnalysis` fills `S.series` —
the source first (`ref: true`), then each compared channel — and `S.fft` /
`S.harm` stay the source's, so THD/TDD, the harmonic table and the export's
base columns did not change meaning. Three things make the comparison honest:

- **Every channel is analysed with the source's settings**: the same f₁, window,
  range and number of harmonics. Harmonic n must be the same frequency in every
  series, or "compare the 3rd" compares two different lines. TDD is not
  computed for them (`iL` null): the rated current belongs to the source.
- **Phases are referred to the source's window start** (`phaseRef`, shifted by
  360·f·Δt₀). Each FFT's phase is relative to its own first sample, and two
  channels with different time offsets or sample grids would otherwise report a
  lag that is only bookkeeping. *Phase → Δφ vs. source* subtracts the source's
  phase for the same harmonic, and a harmonic below 0.1 % of the fundamental
  (on either side) shows no phase, because the phase of noise is noise.
- **All the spectra share one vertical scale**, because comparing magnitudes
  is the point. With different units (V beside A) the legend suggests
  *% of fundamental* rather than silently normalising each trace. The bars are
  grouped per harmonic in each channel's colour, and the compare card lists
  f₁, the ratio to the source, Δφ₁ and THD per channel.

## FiltroLab architecture

One file, `filtros-engine.js`, an IIFE on `window.FiltrosApp` behind the same
double-evaluation guard as CSV·Scope (the `.dc.html` runtime evaluates helmet
`<script>`s twice). The markup lives in `Filtros.dc.html`; every id it declares
must appear in `REF_IDS` or `init()` bails with a console error naming the
missing ones. All of the skin is in `injectCSS()`, written against the same CSS
variables CSV·Scope uses, so the two instruments look like siblings. **No build
step**: editing the engine takes effect on reload. `_mat` (pure functions) and
`_S` (live state) are exported on purpose — the maths can then be exercised from
Node with nothing but `global.window = {}`, and a page can be driven from the
console.

**Every prototype is normalized to the same thing: attenuation = Amax at ω = 1.**
Chebyshev is already there by construction (that is what the ripple edge means),
Butterworth gets a closed-form scale factor, and Bessel is bisected for it. With
all three normalized alike, the frequency transformation maps ω = 1 onto the
passband edge that was asked for and the passband spec is met *exactly*, whatever
the response — which is what lets the panel promise a number and hit it.

**The order is verified, not just computed.** The closed-form formulas for
Butterworth and Chebyshev are only a starting point: the loop starts two steps
below and climbs until the normalized prototype really delivers Amin at Ωs. That
is also the only road available for Bessel, whose selectivity has no closed form.

**Bessel poles are the roots of the reverse Bessel polynomial**, and three things
there are load-bearing:

- `raices()` **rescales the variable** (s = ρ·z with ρ the geometric mean of the
  root moduli) before running Durand-Kerner. Those coefficients span 1e40 at
  order 30, evaluating the polynomial near a root then cancels forty digits —
  more than a double has — and the method quietly returned nonsense (the largest
  real part wandered from −4.2 to −1.5). With the roots near the unit circle the
  span drops to six orders and it converges.
- The roots are **symmetrized at the source** (`simetriza`), not later. A pair
  that is conjugate only to its last bit makes the listed stage differ from the
  drawn curve; normalizing first and symmetrizing afterwards produced a filter
  whose passband attenuation was not the one requested.
- A pole counts as **real only if its imaginary part is negligible against its
  own modulus** (1e-8 relative), never by comparing against the distance to its
  candidate partner. That earlier test flattened a legitimate conjugate pair
  into two real poles at high order, and a bandpass built from it lost its
  geometric symmetry and came out 10 dB off.
- Hence `TOPE_BESSEL` = 20 against 30 for the other two: measured with the group
  delay at DC, which is exactly 1 s for a delay-normalized Bessel, the error is
  1e-8 at order 20 and 4e-4 by order 28. Nobody cascades ten Bessel sections
  anyway; past that the honest answer is that Bessel is the wrong response.

**The frequency transformation works on pole *groups*, never on a flat list.**
`representantes()` keeps one pole per conjugate pair (plus the real ones) and the
conjugate of each transformed pole is *computed*, not located. Pairing "the
closest one to my conjugate" is fine on a prototype but crosses two pairs when
the poles crowd — an order-60 bandpass — and the resulting sections are not the
pairs they should be.

**Each stage is written normalized and one measured constant carries the rest.**
A section has unity gain at DC, at infinity or at its own f0 (low-pass, high-pass
or bandpass); the product of the sections is then the true H(s) up to a real
factor, which is the prototype's G for low- and high-pass and is *measured* at
the centre for bandpass, because there each biquad's f0 is not the filter's.
Measuring it (instead of deriving it) is what guarantees the Bode that is drawn
belongs to the sections that are listed, rather than to a parallel formula that
could drift from them. The total gain is spread evenly across the stages, and
the stages are ordered by increasing Q: the section that resonates most is the
one that clips first, and putting it last hands it a signal already limited in
band.

**A wide bandpass legitimately degenerates.** The real prototype pole of an odd
order splits into two *real* poles when the band is wide enough for the
discriminant to turn positive, and the filter becomes a high-pass and a low-pass
in cascade — which is correct, so the zero at the origin goes to the smaller
pole (the one acting as the high-pass) and both are listed as first-order
sections. A decade-wide passband already lands there.

**The signal is filtered in the frequency domain, and that is a steady state.**
The window covers an integer number of cycles, so the harmonics fall exactly on
the bins that are multiples of the cycle count and there is no leakage: each bin
is multiplied by H(jf) — the conjugate on the mirror bin, which is what keeps the
output real — and transformed back. There is no start-up transient and none is
wanted: what is being looked at is the settled waveform. The Nyquist bin's
imaginary part is zeroed for the same reason. The waveform itself is sampled
directly (a square wave has real edges, no Gibbs), and with 16384 points over at
most 20 cycles the aliasing that costs is far below anything the screen shows.

**The rectified sines keep the frequency of the sine *before* the bridge**
(`rectc` full-wave, `rectm` half-wave): 50 Hz of mains is the number people
know and type, and the ripple coming out at 100 Hz is precisely what they want
to see. The consequence is that the full-wave one has nothing at f — its first
line is at 2f — so the readout's "fundamental" is the **first harmonic that
exists** (`kFundamental`), not the bin at f: read there, the gain was 0/0 and
there was no phase. THD is taken against that same fundamental.

**The phase readout comes from the accumulated stage phase, not from the FFT.**
Each section knows which branch it is on (a low-pass biquad runs 0° to −180°, a
high-pass one +180° to 0°, a bandpass +90° to −90°), so summing them gives the
unwrapped phase of the cascade. Measured through `atan2` on the transfer, a
fourth-order filter at its own cutoff reported **+180.0°** by rounding — the same
point as −180°, but read as the output arriving *before* the input, which no
causal filter does.

**Two traps in the drawing worth keeping in mind:**

- `beginPath()` for the clip rectangle **destroys the path being built**, so the
  clip goes in *before* the trace, never after: building the curve first and
  clipping afterwards stroked the clip rectangle itself and the curve never
  appeared.
- The vertical range is set by the **template, not by the curve**. A fourth-order
  filter reaches −160 dB within two decades, and fitting that on screen crushes
  against the ceiling the part anyone actually reads. It shows 40 dB below what
  the stopband asks for, and only goes deeper if the curve never gets there.
- The spectrum stops at the **fortieth harmonic**. A square wave has harmonics up
  to the thousandth (they fall as 1/k, so the thousandth still clears a
  thousandth of the first) and reaching that far filled the panel with a solid
  wall in which not one line could be told from another.

**`buscaAten` works on φ(f) = sentido·attenuation(f)**, which is increasing in f
whichever side of the passband is being searched, so there is a single expansion
and a single bisection. Written as two symmetric branches by hand, the case where
the starting point already sits on the target — the everyday one, Amax = 3.01 dB
— returned the edge of the interval instead of the crossing, and a 1 kHz cutoff
was announced at 833 Hz.

## AjusteLab architecture

One file, `ajuste-engine.js`, an IIFE on `window.AjusteApp` behind the same
double-evaluation guard as CSV·Scope and FiltroLab (the `.dc.html` runtime
evaluates helmet `<script>`s twice). The markup lives in `Ajustes.dc.html`;
every id it declares must appear in `REF_IDS` or `init()` bails with a console
error naming the missing ones. All of the skin is in `injectCSS()`, against the
same CSS variables the other two instruments use. **No build step**: editing the
engine takes effect on reload. `_mat` (pure functions) and `_S` (live state) are
exported on purpose — with `global.window = {}` in front, the whole file loads in
Node and the maths can be exercised without a browser.

It is the missing joint of the suite: CSV·Scope captures, FiltroLab designs,
ColabDraw draws and ColabTeX writes, but nothing turned measurements into a
*result with its uncertainty*. What it produces is aimed at the report — a LaTeX
table and a figure in millimetres — not at the screen.

**With σ the incertidumbres are believed; without σ they are invented, and the
panel says which.** With measured σ the parameter uncertainties are the
covariance `(JᵀWJ)⁻¹` as it comes, and χ²/ν is then an *independent* measure of
whether the model describes the data — that is the honest case. Without σ there
is no scale: the fit runs with unit weights and the covariance is multiplied by
s² = χ²/ν, i.e. the model is *assumed* good and the whole discrepancy is blamed
on scatter. χ²/ν is then 1 by construction and says nothing at all, so the panel
strikes it out instead of presenting it like a mark out of ten. Presenting that
number in both cases is how a fit that does not describe the data gets reported
as if it did.

**Linear in the parameters means solved, not iterated.** `recta`, `prop`,
`poly` and `log` carry a `base` (the functions multiplying each parameter) and
go through the normal equations in one pass. It is not only speed: there is no
seed to get right, no local minimum to fall into, and the covariance is the real
one rather than that of the last step of an iteration. Fixed parameters move to
the other side of the equation, which is what lets "the line with *this* slope"
be fitted without changing road. Everything else is Levenberg-Marquardt with a
numerical Jacobian, and two details there are load-bearing:

- The derivative step is **relative to the parameter with an absolute floor**.
  Purely relative, it is zero when the parameter is zero — φ = 0 is exactly
  where the sine wave starts — and that column of the Jacobian comes out null.
- The covariance is recomputed from the normal matrix **without λ**. With the
  damping still inside it is biased downwards, so the σ come out optimistic
  precisely in the fits that struggled most.

**The seeds decide whether the non-linear fits work at all**, so they are
measured, not guessed: log-linear regression for the exponential and the power
law, the tail of the record for the offset of a decay (with c = 0 the fit of a
decay with offset wanders off to an absurd τ and never comes back), half-height
width for the Gaussian and the Lorentzian. The sine is the special case: its
frequency comes from counting sign changes over the x range — **not from an
FFT**, because laboratory data are not sampled at a constant step, which is
exactly what an FFT assumes — and **eight phases are tried**, keeping the one
that leaves least error. Levenberg-Marquardt does not hop from one local minimum
to the next, and in a sine they sit every half turn: with φ = 0 fixed, half the
fits came out in antiphase.

**σx is carried into y through the slope of the model** (effective variance:
σ² = σy² + (f'(x)·σx)²), recomputed each iteration because it depends on the
parameters. It is an approximation — it assumes the model straight within σx —
but it is the one that turns "I have error in both" into a fit that can actually
be run, instead of an orthogonal-distance problem nobody is going to set up in a
laboratory. Since the weights then depend on the parameters, **a σx sends even a
linear model down the LM path**.

**The uncertainty rounds the value, not the other way round** (`redondeaPar`):
two significant figures of σ if its first digit is 1 or 2, one otherwise, and
the value rounded to that same decimal. `9.8134 ± 0.4523` claims ten-thousandths
that its own σ says are unknown. `formateaPar` writes the pair with a **common
exponent** outside 1e-3…1e5 — separate exponents on value and σ are worse than
none — and in siunitx mode emits the compact `\num{1.234(5)}`, which both v2 and
v3 read.

**Units are composed, never guessed.** Each parameter declares its dimension
against the columns (`y`, `x`, `y/x`, `1/x`, `y/x^k`) and `unidadDe` builds the
string from the two column units, returning **empty as soon as either is
missing**: half a unit ("V/") lies more than no unit. In the LaTeX the unit goes
out as `\mathrm{V/A}` and **never** as a siunitx macro: a column headed "V"
cannot be turned into `\volt` without guessing, and "min" is minutes or the
minimum depending on who wrote it. siunitx is used only for what it can do
without guessing — writing the number with its uncertainty.

**Derived quantities propagate with the whole covariance matrix**, correlations
included: σ² = gᵀCg with a numerical gradient. This is the reason that section
exists — adding the σ of each parameter in quadrature can be wrong by a large
factor when the parameters are correlated, and in a fit they almost always are
(slope and intercept reach −0.98 without trying). The panel also draws the
correlation matrix for the same reason.

**The expression compiler is shared** by the free model and the derived
quantities, and it compiles to a tree of closures rather than calling `eval`:
`eval` would put the user's browser inside the fit, and this is called of the
order of a hundred thousand times per fit, once per point and derivative.
Variables resolve to an array index at compile time. One trap it already fell
into: in `expr()`/`term()` the closure captures the *variable*, so reassigning
`a` to a function that calls `a` leaves it calling itself — `a*b*c` blew the
stack while `a*b` worked, which is how that bug gets far.

**The plot is drawn once, against a surface, and painted in three places**:
the screen canvas, the 300 dpi PNG and the SVG in millimetres. Writing it three
times guaranteed the three would drift apart. The destination changes only the
palette (`PAL_PANTALLA` / `PAL_PAPEL`) and the typographic unit `u` — 1 px on
screen, 0.32 mm in the SVG, which leaves the base text at about 8 pt on paper.
Consequences:

- **The exported figure is not a screenshot.** White ground, black text, no
  chrome: a black instrument with a phosphor grid is not a figure for an
  article. `montaFigura` is the single assembly used by both the SVG and the
  PNG, so a fix to one margin cannot miss the other.
- **The SVG is in millimetres and in two layers.** `width="160mm"
  viewBox="0 0 160 …"` gives `svgio.svgGeometry` scale 1, so it lands in
  ColabDraw at the size the paper says; `Ajuste` and `Residuos` are separate
  `<g data-layer="…">` because there a layer is switched off with one click,
  and half the time the residuals are needed to *decide* but not to publish.
  The clip-path counter is per module, not per surface: two `recorte1` in one
  document would clip the second layer by the first one's window.
- **In the printed figure the x axis is labelled once, at the bottom**, under
  the residual strip (`sinEtiquetasX` on the upper panel). On screen it is the
  other way round, because each canvas there is a box of its own.
- The `<text>` measuring in the SVG surface goes through a real canvas context
  at 100 px and divides: guessing 0.6 em per letter misplaces the legend and
  the axis labels precisely in the output that goes to an article.

**A point is excluded with a click and keeps being drawn**, hollow and crossed
out. `D` carries every readable point with its `usar` flag and only the subset
goes to the fit; `fit`/`res` are then recomputed over *all* of them, because an
excluded point still has a residual and seeing it is half the reason for
excluding it. If it vanished, nobody would know it was there or be able to put
it back. The statistics (χ², ν, R²) stay those of the fitted subset.

**The header is found, not assumed**, as in CSV·Scope: the data are located
first (two consecutive numeric lines with the same field count) and the header
is the readable line just above. Two things it adds, because these data are
typed by hand as often as they are exported: **whitespace is a separator**, and
when it is, the header is re-split on runs of two or more spaces — `L (m)   T
(s)` gives five fields split on single spaces and three split on the wide gaps,
and without that any header with units in parentheses was thrown away and the
columns came out named col1, col2, col3.

**Everything degrades with a sentence instead of breaking**: a singular normal
matrix (two parameters that are the same thing) leaves the parameters computed
but no σ, and the panel says so rather than letting the numbers pass for a
result; ν ≤ 0 says the model goes through every point by construction; text
with no numbers in it leaves the previous data alone.

The four examples are generated with an in-house congruential generator and a
fixed seed: the same numbers on every visit and on every machine, which is what
makes them usable for teaching ("you should get 47.1 Ω") and for checking that a
version has not broken the fit. The example carries **its own model** — Ohm's law
is read with a line through the origin, not with any line — which is why the
`modelo` property of the `.dc` page defaults to the empty string: with a model
in there, every example would open with the wrong one.

The report references the figure as **PNG, not SVG**: pdfTeX — the engine
ColabTeX compiles with — does not include SVG. The short road is the PNG button;
the good one is to open the SVG in ColabDraw, finish it there and export from
there, because then the figure is an object of the project and updates itself in
the article.

## ColabTeX architecture

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

- **The death rattle is judged per compilation, not per line.**
  `! Emergency stop.` and `! ==> Fatal error occurred, no output PDF file
  produced!` always come out together and always *behind* something else, so on
  their own they name no cause. In the tracker they were two entries of 8
  repetitions each — 16 rows saying nothing — because the real cause of that
  compile was a typo in the document and had been dropped, correctly. So
  `fallosDeLaTeX` decides over the whole compile: a cause of ours wins and the
  rattle is redundant; no cause but a user typo means the rattle is theirs and
  nothing goes up; neither one means the rattle is the only evidence there is
  and it does go up.
- **Half the value is in what gets thrown away.** A mistyped `\aling{}` is not
  an app bug, and if those got in, the report would be an endless list of other
  people's typos with the real faults buried in it. So from the LaTeX log only
  *our* failures go up (a missing package or font, the engine aborting, memory
  exhausted — `TEX_DE_LA_APP`), user typos are dropped explicitly
  (`TEX_DEL_USUARIO`), and **anything unrecognised is dropped too**. A compile
  that throws outright is the exception: that is always ours. The price of that
  last rule is that a fault nobody wrote a pattern for is invisible, and it was
  paid in full: `!pdfTeX error: /bin/busytex (file umvs): Font umvs at 600 not
  found` matched none of the eight app patterns — the first one wants
  `file … not found` with nothing but non-space in between, and here there are
  twenty characters of `): Font umvs at 600 ` in the way — so a real packaging
  bug of ours never once reached the tracker. `/font .* at \d+ not found/` is
  now in `TEX_DE_LA_APP` and it is always ours: the font is packaged, what is
  missing is its line in the map. From the browser, known noise goes
  (`Script error.` with no origin, the ResizeObserver loop,
  extensions, user-cancelled dialogs, network blips) — but a
  `PERMISSION_DENIED` stays, because that is exactly how the ColabDraw link bug
  would have surfaced.
- **Nothing of anyone's document is stored.** Message trimmed to 300 chars,
  three stack frames with the file name only, browser and OS by *family* (never
  the full user-agent string), and a `ctx` whose values are capped and whose
  object-valued entries are dropped — that last one is what stops a whole
  document being smuggled in as "context". The `where` (what the app was doing)
  is worth more for reproducing than the minified stack.
- **A quoted file name survives the fingerprint** (`normaliza`): quotes and
  digits are blanked so the same fault groups, but that turned every
  `File `x.sty' not found` into one row. File names are now kept as-is.
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

## Juegos architecture

Eighteen games, on the same Firebase project and the same Google session
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

**The lobby opens with *Novedades*, a hand-written list** (`NOVEDADES`
in `juegos-main.js`, `.jg-nov`), because what is new is not always a room
game: today Yemas' zombie mode (opens a yemas room with `variante:
"zombis"`), PRODROP (`#cartas`) and BBTAN (`#solo/bbtan`), each with its
own cover (`arteNovedad`). The paragraph below describes the older,
date-driven version, which `novedades()` in `motor.js` still implements
(`novedadesHtml` in `juegos-main.js` no longer calls it). They come from `novedades(3)` in
`motor.js`, which sorts by each game's `alta` (the date it arrived,
`AAAA-MM-DD`, in `JUEGOS`), with ties going to the later row of the table.
So a new game only has to bring its `alta`, and `tests/juegos.test.cjs`
fails if one doesn't. *Abrir sala* there uses the same defaults its
catalogue card has preselected (`porOmision`, read from `OPCIONES`), and
*Opciones* scrolls to that card, opens its options and makes it glow
(`.jg-of-brilla`), resetting the filter if it was hiding it. The section is
an extra `nov` area spanning the whole first row of `.jg-ves`.

**The lobby is a grid with the rooms on the right.** `.jg-ves` has the areas
`"mq lado" "cat lado"`: the *marquesina* (title, counters, a quick-join button
and the ring of game icons) and the catalogue on the left, and a **sticky**
`aside.jg-ves-lado` with *Salas abiertas* and *Tus partidas* spanning both rows
on the right — scrolling the catalogue must not take the rooms out of view. At
≤900 px it collapses to `"mq" "lado" "cat"`, so on a phone the open rooms sit
between the header and the catalogue rather than after seven cards. The quick
button (`#vesRapida`) joins the **oldest** waiting room — the one that has
waited longest — or scrolls to the catalogue when there is none. The
Todos/Duelos/En grupo chips only toggle `hidden` on the cards (`aplicaFiltro`)
and never repaint them, so the options already picked in a card's selects
survive a filter change. "Ver el catálogo" scrolls by hand instead of following
its `#vesCatalogo` anchor, because a hash change is a route change here.

`juegos.html` carries the whole `.jg-*` stylesheet — unlike CSV·Scope this is a
plain page, not a generated `.dc.html` with nowhere to put it, so the skin
caches with the page instead of being injected on every load. Its header and
login card are a **deliberate copy** of `informes.html`'s: the shared part is a
dozen rules, and a common file for that costs more than it saves.

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

**Lobby cards** are cover on top, body below (`.jg-of-cuerpo`), options
folded into a `<details>` whose summary shows what is chosen
(`resumeOpciones`), and a dark-ink button: several games' colours are
yellows, and a button filled with `--c` was unreadable with white text. On a
phone the card is a row with a 108 px cover (`zoom` on the art, which is
fixed-px), and at ≤900 px the sidebar's room lists become horizontal
carousels, with empty boxes other than «Salas abiertas» hidden.

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

**In `cartas` each hand is dealt from a seed only its owner knows.** The deck
used to come from the game's *public* seed, which meant either hand could be
recomputed from the console — so both were dealt face up and the game was
"guess which of those five they will play". Now, on creating or joining a room,
each browser draws its own `{sem, sal}` and writes it to
`misPartidas/<uid>/<pid>/sec`, the one node the rules let **only its owner
read**; what goes into the public ficha is `hmazo = compromiso(sem, sal)`, and
the ficha is write-once, so nobody can redraw a better hand halfway through.
The opponent's cards are therefore not hidden by convention but genuinely
unknown, and `caManoOtro` paints backs. The seeds are published as a
`{t:"s", uid, sem, sal}` entry **at the end**, which is what lets both browsers
verify afterwards that the hands really were the promised ones — hence the
`jugada.t !== "s"` exception in `jugar()`, the one write the "the game is over"
gate has to allow. Rooms created before this still exist, so `cartas.js`'s
`miMazo()` falls back to the room's public seed for a player with no secret of
their own — a half-played duel should not become unplayable.

What the reducer cannot check by itself is that the revealed card is the
promised one — verifying a hash is asynchronous and the reducer is synchronous
by design (it runs on every repaint) — so `auditaCartas` does it separately, in
**both** browsers, and a mismatch prints the offender's name in red on both
screens.

**A card is a picture, and the suit is drawn around it.** The 36 PNGs in
`juegos/cartas/` are full card faces; with 36 images against a 216-card deck
the element cannot come from the art, so the colour is the thick `.jg-arte`
frame plus the `.jg-c-palo` label, and the element is a seal in the corner
(`.jg-c-el`). The box is 96×142 (164:242, the files' own ratio), and
`precarga()` pulls all 36 in the background — a card that arrives while it is
being flipped reads as a glitch.

**The cartas screen is built so nobody gets lost** (`cartas.js`), which was
the complaint: the old one showed a row of loose trophies and a hand in deal
order. Now:

- **Each player has a board of three columns** (fire, water, snow), chips
  grouped by colour inside each, and under yours a hint of what is missing
  («Ganas con …» / «Gana con …» for the rival, `faltaPara`). A chip just won
  drops in (`.jg-llega`); the ones that make a trio glow.
- **The hand is sorted** by element and then number (`miMano`), a card just
  dealt pops (`jg-nueva`), and a card that would win the game wears a «¡Trío!»
  ribbon (`jg-decisiva`, only while `fase === "jugando"`). Tapping a card
  selects it and tapping it again plays it.
- **The legend of what beats what is always on screen** (`.jg-ley`), and the
  pill that decided the round lights up during the clash.
- **The clash is staged like Card-Jitsu**, all in CSS delays off one repaint:
  both cards slide in and flip (0.2 s), the winner lunges (1 s), the loser
  takes the element's hit (`.jg-fx-fuego/agua/nieve/num`) and greys out, the
  verdict and a one-line *why* (`porQue`) appear, and the winner flies to its
  owner's board (2.7 s). Winning with a 10–12 adds the strike (`efectoGolpe`),
  a tie the smoke (`efectoHumo`), both delayed to land with the hit. The
  whole thing lasts `CHOQUE` (3.6 s) and `ocupado()` covers it, so `pintaFin`
  does not cover the clash that won the game; after it, the remate shows the
  winning trio. A clash that arrives in a **hidden tab** is kept in
  `pendiente` and played on return (`alVolver`), for the same reason as in
  Chain Reaction. One trap: the trio cards take `--k` on a wrapper
  (`.jg-rt`), because `htmlCarta` already writes a `style` and the browser
  ignores a second `style` attribute.

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

**Everyone's apodo, foto and colour live in `users/<uid>/perfil`**
(`juegos/perfil.js` for the editor, `fb-juegos.js` for the three calls). Not in
the ficha: the ficha is written once by rule — so nobody renames themselves
mid-duel — and its `foto` is capped at 400 characters by `.validate`, which
fits a Google URL and no uploaded photo at all. Three consequences:

- **The live profile is laid over the frozen ficha at paint time**, in
  `juegos-main.js`'s `vistePerfiles(est)`, right after `reducir()`. That is why
  **no game module had to change**, and why changing your apodo changes it in
  yesterday's games too. It writes **into** each ficha with `Object.assign`
  rather than substituting the object, because `auditaCartas` holds references
  to those very objects.
- **A photo that would not fit goes out as `""`** (`fotoBreve`). Sending a
  ~13 kB data URL to `jugadores/$uid/foto` or `ranks/$juego/$uid/foto` does not
  merely look wrong: the `.validate` rejects the **whole write**, so creating a
  room would have failed with `PERMISSION_DENIED`. The real photo only ever
  lives under `users/`, which has no cap, and reaches the screen through the
  overlay.
- **Profiles are watched on demand**, one listener per uid asked about
  (`perfilDe`). Reading `users` whole would download the profile of everyone who
  has ever opened ColabTeX in order to paint two names. And `users/$uid` is
  already readable by anyone signed in and writable only by its owner, with no
  validation — so this needed **no rules change**, which after Reversi is a
  feature in itself.

**Everyone has a public profile: a card and a page** (`juegos/perfil-tarjeta.js`,
pure, and `juegos/perfil-vista.js`, the DOM). Clicking any element with
`data-perfil="<uid>"` opens the mini card. One document listener,
`alTocarPerfil` in `juegos-main.js`, handles every such element: the header
avatar, the room's player chips, chat names, ranking rows and podium, and
the names in Logros. Tapping the same element again closes the card. On
desktop it is anchored to the element; at ≤600 px it is a bottom sheet. It
shows the background, the photo with its frame, the bio, three numbers and
the first three pieces of the vitrina, plus **Ver perfil**, which opens
`#perfil/<uid>`. The page holds the hero, five totals, the whole vitrina,
every ranking table with its position, and the logros grouped by game.
The header's **Perfil** goes to your own page, and **✎ Personalizar** opens
`abrePerfil`. That editor has four tabs (datos, marco, fondo, vitrina) and a
live preview of the card.

Four decisions:

- **No rules change.** The new fields `marco`, `fondo`, `bio` and `vitrina`
  live in `users/<uid>/perfil` beside nick, foto and colour. Everything
  else is computed from what Logros already reads (`fb.watchLogros`).
  There is one shared listener per session (`datosPerfil`), opened the
  first time someone touches a photo.
- **Frames and backgrounds are CSS, not images.** A catalogue of ids
  (`MARCOS`, `FONDOS`), with the `.jg-marco-<id>` classes in juegos.html
  reading `--t` (size) and `--c` (colour). The same frame works on a 20 px
  chip and a 116 px portrait. The laurel and the crown are inline SVG data
  URIs, not emoji.
- **Some are earned, and checked where they are seen.** A `req` is either a
  number of logros or a podium / first place in a table of three or more.
  `marcoVisible` and `fondoVisible` re-check it against the owner's stats
  every time they paint. A frame written into the database by hand is
  stored, but others see the plain ring.
- **The vitrina stores keys, not copies.** `l:<juego>:<id>` is a logro,
  `r:<juego>` a room ranking and `s:<categoría>` a club record. The keys
  are resolved against live data (`vitrinaDe`), so the position shown is
  today's, and anything gone drops out. Choosing nothing gives an
  automatic vitrina: the best positions, then the rarest logros.
  `limpiaPerfil` keeps only known ids, a bio of `LARGO_BIO` characters and
  up to `MAX_VITRINA` keys.

`tests/perfil.test.cjs` covers the stats, the requirements, the vitrina
and the cleaning.

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

**The scenery is a seed, not an image.** `escena(semilla)` lays out a couple of
hundred pieces from a mulberry32 PRNG and `juegos/paisaje.js` draws them; the
two machines share a 32-bit number and get the same landscape. An image would
have to be uploaded somewhere, served with CORS and waited for. The pieces are
deliberately simple and drawn from six-tone palettes: what makes a hiding place
hard is repetition, not detail — two hundred nearly identical trees hide a
person far better than a photographic forest.

The seed now picks one of five **themed scenes** (`TEMAS`: playa, mercado,
feria, nieve, lago) instead of scattering random props. Each scene is built
from `zona` bands, so it reads as a place: backdrops (sea, stalls, a frozen
lake) are painted first and the pieces sit where they belong. The crowd is
around a hundred people (80–120 depending on the scene) dressed from the same
palettes, and `poseEn` decides from the
spot whether someone stands, swims or skis. The target is a **costume**, not
just a colour: a hat (6), a shirt (6 selectable) and an accessory (4) give
`TRAJES_N` = 144 codes, `codigoTraje({h,s,a}) = h + s·6 + a·36`. A code below
6 decodes to the old "hat only" costume, so rooms from before still read.
`vistePersona` then bumps the accessory of any crowd member who happens to
wear all three pieces. It runs inside `paisaje.pinta`, so both screens see the
same crowd and there is never a twin to click by mistake.

**Órbita (`orbita`) is a physics game whose physics runs in the reducer.**
A move is only `{t:"lanza", uid, vx, vy}`, velocities in integer hundredths
(`orVelocidad` refuses anything else and clamps to `OR_VMAX`). `redOrbita`
simulates the whole turn with `orTurno` — semi-implicit Euler, softened
gravity from the sun and two or three planets (`orMundo`, from the room's
seed), `OR_PASOS` steps — and every probe already in the field moves in
*every* turn, capturing stars for its owner until its `vida` (two laps of
the table) runs out. Every browser gets the same doubles because the
arithmetic is the same sequence of IEEE operations; nothing is `Math.random`
and nothing depends on frame rate. Things that are easy to break:

- **The screen replays, it never decides.** `orbita.js` reruns `orTurno`
  from `ultima.antes` a few steps per frame and fires the effects from the
  same `eventos` the reducer scored, so what is animated is what was
  counted. `ocupado()`/`ctx.listo()`/`pendiente` work as in Chain Reaction.
- **Only the first `PREVIA` steps of the aim are shown.** The whole path
  would turn it into billiards with the cue marked. Satellites already in
  orbit show their full next-turn path dotted (`calculaFuturos`), because
  that is what makes aiming at one to shoot it down a real play.
- **A collision needs a new probe to score.** New probe against someone
  else's satellite: both burst and the launcher gets `OR_DERRIBO`. Two old
  satellites that meet burst with no points.
- **The sky refills from its own stream** (`orRellena`, `rng(semilla ^
  0x5A7E11)`), so both browsers draw the same new stars in the same order;
  a star's value comes from how close it is to a body (1–3) plus a rare
  nova worth 5.
- The reducer is memoised (`orCache`, keyed by the log) because a whole
  replay is ~400 steps × every move, and a repaint happens on every tick.

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

Two things about the individual screens are worth knowing before editing them:

- **The escondite draws the hidden person from the first second.** It used not
  to during `buscar`, which is exactly the bug reported as "the character is
  invisible and it wasn't where they put it": nothing was misplaced, it simply
  was not painted, so the search was of an empty landscape. It is drawn small
  and in the scene's own palette — hard, which is the game — and after
  `PISTA_MS` a ring narrows around it, plus a `calor()` chip (frío / templado
  / caliente / ¡Casi!) on every miss, because a search with no feedback at all
  is not difficulty, it is a blank screen.
  Four more things:
  - **The target is shown as a SE BUSCA poster** (`cartel()`), drawn with
    `pintaCartel` on its own small canvas. The description is not enough; you
    search for a figure.
  - **The magnifier (lupa) redraws the vector scene at 2.5×** inside a clipped
    circle rather than scaling the bitmap, so it stays sharp.
  - **Finding someone darkens everything around them** (`foco()`, even-odd).
  - **A rival chip shows the other player's misses and their heat**, so the
    duel feels like a race.
- **Cuadritos' scoreboard is in seating order, never sorted by points.** With
  five players, knowing who plays *next* is half the strategy — it decides
  whom you hand the chain to — and a scoreboard whose rows jump around after
  every box is unreadable. Whoever left is struck through rather than removed,
  matching the reducer, which leaves their closed boxes on the board and skips
  their turn.
- **Reversi's discs are black and white, not each player's colour.**
  `colorForUid` hands out tones by uid and two can come out nearly identical,
  which ruins a game that consists precisely of reading at a glance who owns
  the board; each player's own colour still shows, as the ring of their
  scoreboard slot. The reducer already computes `legales` (square → the discs
  it would flip) because it needs it to know whether a turn must be passed, so
  drawing those hints, with the capture count inside the dot, costs nothing and
  removes half the frustration of learning the game. The just-flipped discs
  spin once (`.jg-rev-gira`) and the newest wears a ring: that one-shot
  animation is safe only because the board's repaint signature carries
  `est.ultima.casilla`, so the SVG is rebuilt exactly once per move.

**Chain Reaction (`cadena`) is decided by the reducer, and the screen only
retells it.** `redCadena` in `motor.js` resolves the whole chain when it
replays a move and keeps, in `ultima`, the board *before* the orb (`antes`)
and the list of **waves** (`ondas`, the cells that burst in each one);
`cadena.js` replays that list slowly, from `antes`, with `crOnda` — the very
function the reducer used — so what is animated can never differ from what
was decided. Rules that are easy to get wrong:

- **Waves are simultaneous.** Every cell that reached its critical mass (its
  number of orthogonal neighbours) bursts in the same wave; resolving them one
  at a time from a queue gives a different board, and the two browsers would
  have to agree on the queue order.
- **The chain stops as soon as no active rival has an orb left**, not when the
  board is stable: past that point the mover already owns every orb and a full
  board would loop forever. `CR_TOPE` (1000 waves) is only a safety net.
- **A player is out only after having played** and then reaching zero orbs —
  otherwise everybody but the first player would be out after move one.
- The seat decides the colour (`PALETA` in `cadena.js`, fixed), not
  `colorForUid`: in an eight-player board two nearly identical tones would make it
  unreadable, as in Reversi.

The move that wins is usually the longest chain of the game, so the fin
overlay **waits for the animation**: the screen exposes `ocupado()` and calls
`ctx.listo()` when the replay ends, and `pintaFin` in `juegos-main.js` does not
show the cartel while `ocupado()` is true. A hidden tab skips the replay and
paints the final board, and a generation counter (`gen`) cancels a replay that
a newer move made stale. Each orb is **three nested `<g>`s** (position → pop →
shake → spin) because a CSS `transform` animation *replaces* the element's
`transform` attribute: animating the group that carries the `translate` would
throw every orb to the corner of the board. A replay longer than `MAX_ONDAS` (60) jumps straight to the end.

**Flip 7 (`flip7`) deals from a deck nobody controls.** A shared deck
cannot come from the room's public seed — anyone could read the next card from
the console and know when to stop — and it cannot come from one player's
secret either, because that player would know. So every card drawn is decided
by **two contributions**: the receiver's and that of the next seat still in the
game (`espera.k === "roba"`, `faltan`). A contribution is `aporteF7(sem, sal,
n)`, the first 32 bits of SHA-256 over the player's *private* seed (the same
`misPartidas/<uid>/<pid>/sec` cartas uses, committed as `hmazo`) and the draw
number `n`; `indiceF7` combines them into an index into what is left of the
deck. Neither can steer the card without knowing the other's value, and the
second one to write cannot have seen the first's future ones. A `pide {n, v}`
carries the asker's own contribution so asking is one write; the rest arrive
as `{t:"r", uid, n, v}`, sent **by the screen on its own** after `PAUSA_ROBO`
(`PAUSA_RONDA` at the start of a round, so the summary can be read). At the end
every player publishes `{t:"s"}` exactly as in cartas and `auditaFlip7`
recomputes every contribution: a lie is `que:"carta"`, a seed that does not
match its `hmazo` is `que:"semilla"`, and one never revealed is only
`que:"oculta"` (soft yellow notice, not the red one — closing the tab is not
cheating). `flip7.js` calls `terminar` once everyone still seated has revealed
or after `ESPERA_SEMILLAS`, and **keeps re-arming that check every second until
`fin` is really written** — `terminar` can fail (a transaction lost, a network
blip), and `cierre` used to stop at the first try, leaving the room open
forever on a finished board.

**An absent contributor must not freeze the table** (`aportesDe`, the
*suplentes*). The designated pair is receiver + next seat, and either one can
be asleep — a background tab, a locked phone — which left every draw waiting
for good: the most common "se queda pegada". If both designated values are in,
they are used; otherwise the card comes from the first K contributors present
in preference order (receiver, then the others by distance at the table), with
K = max(2, min(3, seated − 1)) and the values combined `[a0, a1 ^ a2]`. Two at
the table have no suplente. The `roba` espera lists them (`suplentes`), and the
screen of a suplente waits `SUPLENCIA_MS` (6 s) plus `SUPLENCIA_PASO` (2 s) per
rank before sending (`papel()` in `flip7.js`). That delay lives only on the
screen — moves carry no timestamp and the reducer cannot enforce time — so the
accepted price is written down: a helper running a modified client can withhold
its value to force a re-draw by the suplentes (it re-rolls the card, it cannot
choose it), and with three seated a hasty suplente can jump in early; with four
or more it needs an accomplice. Every contribution still goes through the audit.
What suplentes cannot fix is an absent player on **their own** decision
(`decide`/`elige`). The others wait, and after `AVISO_ESPERA` (10 s) the
table names who it is waiting for and points to the vote to expel them. In a
duel, where there are no suplentes, that vote is also the only remedy for a
rival whose tab has gone to sleep.

**Nothing in `flip7.js` depends on a single one-shot timer firing.** Timers
get lost: a background tab throttles them, a locked phone freezes them, and a
failed write never re-armed them. Each of those left a table stuck for good,
which is how "I lost, then a card came and I couldn't play" happened. Four
things close those gaps:

- **A heartbeat.** Every `LATIDO_MS` (2 s), `late()` re-runs `automatismos()`
  and repaints. It also throws away a contribution timer that should have
  fired more than 4 s ago, un-sticks cards left `enVuelo` by an animation that
  never finished, and retries `cierre()` on a finished board.
- **A timeout on every write.** `conTope` releases the buttons after
  `ENVIO_MAX` (12 s). A transaction with no network does not fail, it waits,
  and meanwhile «Pedir carta» stayed greyed out with no way out. If the move
  did reach the database, the reducer ignores the repeat.
- **Retrying a contribution that failed.** It is retried after 1.5 s instead
  of only being unmarked.
- **No delay for a hidden designated tab.** It sends its contribution at once
  instead of after `PAUSA_ROBO`. The pause exists so someone watching sees
  the card fly, and a hidden tab is watching nothing. Suplentes still wait,
  or they would always get in first.

Three smaller holes of the same family: a `jugar` that returns false resets
`enviadoN` so the contribution is retried instead of being marked as sent;
`alVolver` re-arms the contribution timer, because the browser throttles a
background tab's timers and one armed there can fire far too late; and the ghost view (below) applies
**only while `espera.k === "roba"`**, i.e. while the dealer is actually dealing
— when the new round's first card was an action card, the ghost hid the target
buttons and the game waited for a choice nobody could make.

The two modes are one reducer (`redFlip7`, `modoF7`, `mazoF7`): **normal** is
the 94-card box (0, 1×1 … 12×12, six modifiers, Freeze / Flip Three / Second
Chance); **venganza** is the 108-card Vengeance deck (numbers up to 13, the
unlucky 7 that throws the line away, the lucky 13 that may repeat, the Cero
that scores nothing unless it makes Flip 7 and **forbids standing** while there
are cards to draw, negative and ÷2 modifiers, and the take-that actions: Swap,
Steal, Discard, Just One More, Flip Four). Rules that are easy to get wrong:
an action may target any player still in the round, a Swap or a Steal can make
the receiver bust, and Flip Three/Four cards that come up mid-series are set
aside (`aparta`) and resolved after it. The game ends at the end of the round in
which someone reaches `F7_META` (200), and the highest total wins — not the first
to cross; a tie at the top plays one more round. `tests/flip7.test.cjs` plays 30 full robot games per mode and
checks that each one ends, pays out what `rondas` says and passes the audit,
and that a forged contribution or seed is caught and attributed to the forger.
The labels are in `MODOS_F7` ("Normal", "Vengeance", "Super Vengeance"); the
stored keys stay `normal`/`venganza`/`super`, because `venganza` is already
written in existing rooms and in the rules' `modo` whitelist.

**Super Vengeance (`super`) is Vengeance plus 24 cards and two rules.** The
deck is Vengeance's 108 **in the same order** with the new ones appended
(132 in all), so Vengeance's card indices never move. What it adds:

- **Fourteen 14s** (`catorce`): twelve worth 14, one −14, one 0, and any two
  of them bust whatever they are worth — repeats are counted by `claveF7`,
  which is the value except for a 14. The −14 can drag the numbers below
  zero, and in Super **nothing is floored at 0**: a hand that adds up
  negative (the −14, a "−x") scores that negative, and it comes off the
  total, which may itself go below zero. A busted/killed row still scores 0 —
  that is the rule, not a floor. Vengeance and Normal keep their floors.
- **Three Second Chances, two Cambio de manos (`trueca`), two Fulminar
  (`mata`), three Comodín.** `trueca` swaps two players' whole hand (numbers,
  modifiers, stored Second Chance — not planted/frozen, which belong to the
  seat); the chooser may be one of the two (choice type `p2`). `mata` busts
  any other player still standing. The comodín (choice type `n`) goes **only
  into the drawer's own row** (its `uids` is just `[quien]`, so it cannot be
  used to bust someone else by handing them a number they already hold) as a
  number 0–14 the player picks — on screen, clicking the number plays it, and
  the numbers already in the row are struck through; it lives in `nums` like
  any number (`esNumeroF7`), and its value is **not in the card** but in the
  round's `com` map (id → value), because the same card can come back later
  worth something else. That map is looked up by id, so it travels with the
  card through a Steal or a Swap, and it is snapshotted into `finRonda.com` for
  the ghost view and the summary.
- **Negative modifiers hit the total when the round scores nothing**
  (`golpeF7`): if the numbers add up to exactly 0 — busted, killed, Cero without
  Flip 7, no numbers — the ÷2 and the minuses apply to the accumulated total
  instead (`aplicaGolpeF7`, no floor) at round close. A round that is already
  negative keeps its modifiers: it goes to the total anyway. `rondas[].aj` records
  what the total lost outside the round, so `Σ(pts + aj)` is still each
  player's total.
  That is also why, in Super only, a negative or ÷2 card can be **aimed at a
  player who already busted** (or was fulminated) — their round is 0, so it
  lands on their total: they get hit after they are dead. In Vengeance the
  same card on a busted player would do nothing, so it is not offered.
- **Flip 7 is a choice** (espera `bono`, move `{t:"bono", a}`): before the
  round closes the Flip 7 player picks `+15` for themselves (`a` = own uid) or
  `−15` off another seated player's total (it may go negative). It is stored in
  `l.bono` (`""` for self, the victim's uid otherwise) and `valorLineaF7` drops
  the 15 when it is a uid.

The `super` mode value needed the rules' `modo` `.validate` widened, so it
needs the rules re-published before a Super room can be created.

**The Flip 7 screen is a round table with a croupier, and everything on it is
retold from `hist`.** `redFlip7` keeps the last 40 events (`hist`, each with an
`e`: `carta`, `pide`, `planta`, `pasa`, `f7`, `congela`, `ronda`, …) and
`flip7.js` diffs it between repaints (`nuevosDe`) to decide what to animate,
never the state — the state says where a card *is*, the history says that it
*arrived*. Things worth knowing before editing it:

- **The table is a half moon with the croupier on the flat side**, as in a
  casino: players only use the curved half, and the straight edge is the
  dealer's rail with the discard tray, the showcase (a mark printed on the felt
  where an action card waits for its target) and the shoe, each with a brass
  plaque (`.jg-f7-cuenta`) under it. Seats are **placed by hand per player
  count** (`PUESTOS`, percent of `#f7Asientos`, you always at the bottom
  centre) — an even spread over an arc made six seats overlap and push the
  end ones through the rail. With an even count "you" sit at index
  `⌊(N−1)/2⌋`, i.e. just right of centre beside another seat. Five to eight
  players get compact seats (smaller cards, `.jg-f7-sala[data-n]`), seven
  and eight a taller room (980 px) and narrower seats, nine and ten 1260 px
  and narrower still, and the room's height
  per count lives in two
  places that must agree: the CSS `[data-n]` rule and `ALTO_SALA`, which the
  head-turn angle is computed with. `.jg-f7-sala` has only absolutely
  positioned children, so inside `.jg-tablero` — which is
  `place-items:center` — it **collapsed to width 0** and the table was a brown
  sliver; hence `.jg-f7 .jg-tablero{place-items:stretch}` and an explicit
  `width:100%`. Below 720 px the half moon is dropped and the seats become a
  two-column grid with you last, full width.
- **The croupier deals with a real arm.** The SVG is only the torso and head
  (whose eyes turn to the seat receiving, `mira()`); the arm is an HTML
  element (`#f7Brazo`) anchored at the shoulder and rotated/stretched by
  **measuring** where the target seat is (`--ang`, `--l`), because an SVG arm
  inside the dealer's own viewBox could not reach a seat outside it. At rest
  (`reposa()`) the hand lies on the felt beside the shoe, not over it — resting
  on the shoe covered its top card. Each new card is a real element flown from
  the shoe's `.jg-f7-tope` to the seat (`lanza`, counted in `vuelos`) and the
  seat does not show it until it lands (`enVuelo`), so a card is never in two
  places. A hidden tab flies nothing and keeps the last one in `pendiente` for
  `alVolver`.
- **Sound follows the history, like everywhere else**: `madera` (knuckles on
  the table) when someone asks for a card, `reparte` for each card that flies,
  `planta` on standing, `revienta` on busting, `flip7` for seven distinct
  numbers, `hielo` for a Freeze. When several land in one repaint only the most
  important one sounds (the `orden` list), or a bust and a stand at once were
  noise.
- **The end of a round is a summary, not a jump.** The reducer starts the next
  round in the same move that closes this one, so while the new round has no
  card on the table yet the seats keep showing the lines that just closed
  (`fantasma()`, read from `est.finRonda`, and only while the espera is a
  `roba`) under the round summary. At the end of the game `trasVuelos` holds that
  summary for `FIN_MS` (2.2 s) and only then calls `ctx.listo`; `ocupado()` is
  `vuelos > 0 || Date.now() < finHasta`, which is what keeps `pintaFin` from
  covering the last card with the cartel.

**Cacho (`cacho`) has no dealer, and its dice come out of a hash chain.**
Each player's dice must be secret, nobody may choose them, and there is no
server to roll them. So on joining a room each browser computes, from its
private seed (the same `misPartidas/<uid>/<pid>/sec` as cartas and Flip 7), a
chain `e0 = H("cacho:" + sem + ":" + sal)`, `e1 = H(e0)` … `e300`
(`cadenaCacho`, `CC_CADENA`), and publishes only the tip as `hcad` in the
write-once ficha. The key of round `r` is `e[299 − r]` (`llaveCacho`): its
owner has known it since the start, nobody else can compute it, and anyone can
check it once revealed, because its hash is the previous round's key
(`llaveBuena`). A round's dice are `dadosCacho(llave, mezcla, k)`, where the
`mezcla` is every key revealed when the *previous* round was uncovered — so
nobody knows even their own dice before the round starts, and nobody knows
anyone else's until the uncovering. Round 0 is the `arranque`: everyone reveals
key 0, and that mezcla decides round 1's dice and who opens, with nobody
choosing either. Points worth knowing:

- **The check runs inside the reducer**, unlike Flip 7's asynchronous audit.
  That is why `motor.js` carries a hand-written, synchronous, memoised SHA-256
  (`sha256hex`) — `crypto.subtle` is async and the reducer cannot wait — with
  the round constants written out rather than computed with `Math.cbrt`, since
  two browsers rounding the last bit differently would see different dice. A
  key that does not fit the chain does not count: the table keeps waiting for
  the real one, `est.falsas` names the liar in red, and the vote can expel
  them. The price is that a game can last at most 300 rounds; hitting that
  ends it as `motivo: "tope"`: the most dice wins, and a tie is a draw.
- **Keys are sent by the screen, not by the player**: whenever
  `espera.k === "llaves"` and your key is missing, `cacho.js` sends
  `{t:"k", uid, r, c}` by itself. Same heartbeat (`LATIDO_MS`) and write
  timeout (`ENVIO_MAX`) as Flip 7, for the same reasons — a lost timer or a
  write with no network must never leave the table stuck.
- **The rules** (`minimoCacho`): aces are wild unless the bet is on aces or
  the round is *obligada*; going to aces needs `⌈c/2⌉`, coming back from
  them `2c + 1`, and opening on aces is only allowed with one die left.
  **Calzar** (claiming the bet is exact) is allowed only while at least half
  the initial dice are still on the table — holding one die is no exception;
  right wins a die back (up to five), wrong loses one. The next round opens
  with whoever lost, with whoever calzó after a calzo, and with the same
  opener after an annulled round — an abandono mid-round annuls it, since
  that player's cup can never be uncovered.
- **El paso** (`pasoCacho`): with a bet on the table, one player per round
  may pass instead of raising and the bet stands. A valid pass needs exactly
  five dice, with all dice
  equal, all different or a full house (faces as they are, no wild aces), but
  it can be bluffed: only the **next** player may doubt it (`dudapaso`), and
  once they raise it is accepted. Doubted, only the passer's cup is lifted
  and whoever was wrong loses one die. Not offered in an obligada round,
  where nobody knows their own dice.
- **Obligar** (once per game, the opener with one die; torbellino is also
  available in a duel, while abierto/cerrado require three players) picks one of three modes, and in all of them aces are not wild. The
  dice of an obligada round are rolled **after** the choice:
  `mezclaObligada` mixes in the hash of *every* player's key for this round,
  so nobody — the obligator included — can know them until all keys are out.
  **Abierto** reveals every key at once (`etapa: "muestra"`), `est.abiertos`
  carries every cup and the screen hides your own; the obligator opens and
  the pinta never changes. That hiding is only the screen's — the tab has the
  data to compute its own dice, the same honest limit as the escondite.
  **Cerrado** shows nothing to anyone; bets are «X de esta» (`p: 0`), the
  pinta being the obligator's single die, resolved at the uncovering, and
  only the count goes up. **Torbellino** has no bets: the obligator names a
  pinta, the round is uncovered at once and every cup loses the dice showing
  it, the obligator's too; they open the next round if they still have dice.
- **Partida siciliana** (`sicil`, chosen at room creation): doubting the
  *first* bet of a round risks two dice, for whoever was wrong. It punishes
  the opening bluff and the reflex dudo, which are what make a cacho game drag
  on without anything happening.
- **The cups lift one by one.** `ultimo` carries `orden` — from whoever dudó
  or calzó, in the round's direction — plus every cup's dice, the count and
  the verdict; the screen lifts one cup every `pasoMs`, keeps a running
  «Van k de c» in the middle, and only then shows who loses. Clicking the
  table skips to the end. `ocupado()` covers the replay, so `pintaFin` never
  covers the last uncovering, and `PAUSA_FIN.cacho` adds its grace.
- **Sound follows `hist`**, like Flip 7: the cup rattle (`cubilete`) when a
  round starts, `dado` on each cup lifted.

**UNO (`uno`) has five versions over one reducer** (`redUno`, `MODOS_UNO`:
`clasico`, `nomercy`, `nomercyx`, `allwild`, `liar`), chosen when the room is
opened and stored in `modo` like Flip 7's. The problem is the usual one here
with no server — every hand secret, nobody choosing what they draw — and it
is solved by four pieces (the long version is the comment above `MODOS_UNO`):

- **Every player draws from a deck of their own.** Card number k that `u`
  draws is `mazo[H(sem, sal, mezcla, k) mod largo]` (`cartaUno`): their
  private seed from `misPartidas/<uid>/<pid>/sec`, as in cartas, Flip 7 and
  cacho, and a `mezcla` nobody knows until the game starts. It is sampling
  with replacement from the version's box, so the proportions are the box's
  and the deck never runs out. The mezcla comes out of a commit-and-reveal
  start: the ficha carries `hcad = H(arr)`, each screen sends `arr` by itself
  (`{t:"k"}`), and the mezcla is the hash of all of them — so nobody can shop
  for a seed with a good hand.
- **The reducer only knows how many cards each hand holds.** It also keeps
  `ops`, a list of what happened to each hand (drew n, played this, discarded
  that colour, swapped), and each screen replays it with its own secret to
  know what it holds (`repasaUno` → `manoUno`). Everyone else is card backs.
- **What is not shown is promised with a hash or sealed.** Liar's face-down
  cards are played as `H(carta + ":" + sal)` (`tapaUno`, codes starting with
  `~`), and hand swaps — No Mercy's 7 and 0, All Wild's forced swap — travel
  as **sobres**: the hand encrypted with a Diffie-Hellman key between the two
  players (RFC 3526 group 14, public key `pk` in the ficha, private key
  derived from the seed so the audit can check it). The reducer waits for
  every envelope (`espera.k === "sobres"`) and applies them at once, which is
  what the 0's rotating hands need.
- **At the end everyone reveals `{t:"s"}` and `auditaUno` replays the whole
  game with every hand visible**: each card played was in the hand, the
  draw-until-playable stopped where it should, the answer to a +4 challenge
  was true, each envelope held the real hand. A liar is named in red, as in
  Flip 7. The price, said aloud in the code: whoever opens the console can
  compute what *they themselves* would draw next — their deck is theirs.
  They cannot change it, nor see anyone else's.

What the screen sends by itself, without asking — the start key, the
envelopes, the answer to a +4 challenge, the face-down card when doubted — is
exactly what only that browser can send and the whole table is waiting for;
`uno.js` has the same heartbeat (`LATIDO_MS`) and write timeout (`ENVIO_MAX`)
as Flip 7 and cacho for the same reasons. `est.debe` says who owes something
now (it can be several: the No Mercy + expansion coin toss, the envelopes),
and `meToca` reads it. Three versions add a way out besides winning: in No
Mercy a hand that reaches `UNO_TOPE` (25) is **eliminated** (`elim[u]`, its
count set to 0 on purpose so the seat reads empty), and the last one standing
wins with `motivo: "piedad"`; otherwise it is `motivo: "uno"`. Forgetting to
call UNO leaves `olvido` set until the next player acts, and anyone can
`{t:"pilla"}` in that window for two cards. The history is written in the
second person for the viewer (`verbo`, `ati`: «duda de ti», never «de tú»).
`tests/uno.test.cjs` plays robot games in every version to the end and
through the audit, and checks that the audit catches a card that was not in
the hand, a forged envelope and a short draw-until-playable, and that a false
start key does not start the game. The `uno` game and its `modo`
values needed the rules' whitelists widened, so it needs the rules
re-published before a room can be created.

**The UNO table is a scene, and everything on it is retold from `hist`**
(`uno.js`), the way Flip 7 does it: the state says where a card *is*, the
history says that it *arrived*. Things worth knowing before editing it:

- **Seats sit on an ellipse around a felt** (`--x`/`--y` per seat, you at the
  bottom), and below 720 px they fold into a strip above a shorter felt. The
  table is **always dark**, in both themes: `.jg-uno` repaints the shared
  chrome (`:root .jg-uno .jg-barra`, `.jg-pie`, `.jg-nota`…) because the dark
  block's rules are (0,2,1) and would otherwise win over a lighter table.
  There is no `html[data-tema=oscuro] .jg-un-*` twin on purpose.
- **Cards fly in a layer hung off `<body>`** (`.jg-un-vuelos`, WAAPI arcs in
  `vuela`), because the seats and the hand repaint by signature and a card
  inside them would vanish mid-flight. `vuelos` counts what is in the air and
  `ocupado()` is `vuelos > 0`, so `pintaFin` never covers the winning card.
  The top of the discard stays covered (`topeTapado`) until its flight lands
  (`aterriza`). `animaSucesos` puts the flights and the shouts (`grito`) of one
  repaint on a timeline, so three cards drawn arrive one after another.
- **The hand is a fan animated with FLIP** (`setMano`). The button
  (`.jg-un-hueco`) carries the fan's fixed transform, and hover/selection lift
  only the card **inside** it. Lifting the button itself moved it out from under
  the pointer, lost the hover and made the card flicker. The inline `z-index`
  that orders the fan is why hover and `sel` need `!important`.
- **The turn beam (`#unFoco`) is measured, not placed.** `apunta()` reads the
  angle from the beam's centre to the active placa and unwraps it
  (`angAcum`), so going from the right seat to the left one turns the short
  way instead of sweeping across the table. The ring under the piles
  (`.jg-un-giro`) turns with the direction of play and flips under `.inv`.
  The felt's aura follows the colour in play through `@property --aura` (a
  registered `<color>`, which is what lets it transition), keyed on the
  sala's `data-tinte`. It is not `data-col`, because that is the attribute
  of the colour buttons and a click on the felt would read as a choice.

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

**Presidente (`presidente`) is a table that never ends.** Each trick is one
lap: every active player acts once, then the highest play opens again (or
the next active seat if that player finished/left). Normal ranks are 2–A;
exactly two jokers (IDs 52–53) accompany either 52 or 104 normal cards.
The second normal deck occupies IDs 54–105. One joker covers singles/pairs;
both cover triples. A joker may beat another joker, and the trick retains
its original group size. `jugadaPr` shares validation with the UI.
A round is dealt,
played out and scored (`n − 1 − position` points), and the next one starts by
itself with the roles of the last: the Culo gives their two best cards to the
Presidente and gets two back, the Viceculo one to the Vice. Between rounds
anyone may sit down (`entra`) or stand up (`sale`, which mid-round means
«after this one»); the game ends only when half the table votes `cierra`,
and the most points wins. With no dealer the deal is **mental poker**: each
seat, in order, shuffles the deck under its own commutative lock (`mezcla`),
then each removes its lock from everyone's hand but its own (`quita`), so
nobody knows another hand. Exchange cards travel in DH-sealed envelopes
(`sobrePr`). Every round's key comes from a hash chain committed as `hcad`
(`cadenaPr`, 1000 rounds) and is revealed when the round ends (`llave`);
`auditaPresidente` then replays every shuffle, lock removal, envelope and
card played. The screen (`presidente.js`) sends by itself what only it can
send — keys, its shuffle and lock turns, the forced «best cards», and «paso»
when nothing beats the table — and offers **Saltarle** for someone asleep.
`tests/presidente.test.cjs` plays robot tables with people joining, leaving
and voting, and checks the audit catches a crooked shuffle, a short exchange
and a card that was never in the hand.

**Spicy (`spicy`) deals like UNO.** Each player draws from a private deck
(`cartaSp`, seed + a `mezcla` from a commit-and-reveal start). A card is
played face down as a hash (`tapaSp`) with a claim. When someone doubts it,
the owner's screen reveals it by itself (`{t:"revela"}`) and the reducer
checks the hash. The World's End card cannot live in anyone's private deck,
so it is a public counter of cards drawn after the deal (`SP_MUNDO`, per
player count). `auditaSpicy` replays the game at the end, as in UNO.

**Tetris (`tetris`) is the one real-time game, and the log still only
carries what crosses between wells.** Every browser simulates its own well
with the room's public seed, on `juegos/club/tetris/motor.js` (UMD: the
room imports it through esbuild, and Tetris Club loads it as a plain script).
The log holds only `{t:"ataque", a, n}` (n ≤ 12 lines of garbage for `a`)
and `{t:"cae", l, p}`. `redTetris` adds up `basura[uid]`, and the screen feeds
the engine only the difference from what it already applied. The rivals'
wells are thumbnails. They come from `fb.tetrisVivo`, a 200-character summary
each tab writes every 250 ms to a disposable node, as in Circuit Breakers.
The last one standing wins. **Tetris Club** (`juegos/club/tetris/`) is
the solo version on the same engine: Maratón, Sprint (40 lines; the
result is `puntos: 40` plus the time, so the ranking orders it by time) and
Ultra (two minutes). Its categories are `club-tetris-*` in `soloRanks`.

**sortEm (`juegos/club/sortem/`) is a Solo Club game too**, on the same
`conexion.js` protocol as Mina Club: no ranking of its own, only
`Club.result({categoria: "club-sortem-N", puntos: N, tiempo})` for N = 10
or 20. `puntos` is fixed by the mode, so the table orders by time; the
block width per mode is `MEDIDAS` in its `game.js` (20 blocks fill the
canvas, which is 1000 px wide with the camera scrolled to x = −100 so the
800 px layout stays centred). Inside Juegos it is **only the game**:
`html.jg-sortem` (set by `armazon`) hides the site header and the solo bar
and pins the iframe to the whole window, the page hides its ranking panel
(the ranking lives in Clasificación) and keeps only a faint «← Volver a
Juegos» corner link, and the box is `min(100vw, 100vh·5/3)`. There is no
fullscreen button on purpose: a focused button turned the game's Space into a
fullscreen toggle. The `soloRanks` regex needed widening, so the rules must
be re-published.

**BBTAN (`juegos/club/bbtan/`) is a Solo Club game too**, on the same
`conexion.js` protocol: plain files, no build, bump `?v=bbtan-N` in its
`index.html` when they change (and `club-N` in `solo/club.js` for the iframe).
Its one category is `club-bbtan-rondas` and `puntos` is the **highest round
reached** (the time played rides along as the tiebreak), reported once per game
on game over or on restart, and only from round 2. Its ten logros are round
thresholds (`deMarca`). Two things not to break: the audio's `clear()` and the
NICE! celebration are the original's and stay as they are; ball hits are a
short rising sine through a low-pass (`bubble`) and a broken block is a noise
burst + thump + arpeggio (`broken`), both throttled so a combo does not turn
into a wall of sound. The retro look is Press Start 2P, notched pixel frames
(`pixelFrame`), plus-shaped balls (`pixelBall`) and CSS scanlines on
`.canvas-wrap::after`. The regex in `soloRanks` needed widening, so the rules
must be re-published.

**BBTAN's music is composed live from the board** (`musica.js`, UMD over
`Chip`, tested by `musica.test.cjs`); it no longer loads `temas.js`, though
`T.bbtan` stays in the songbook. `game.js` sends `BBTANAudio.mood({filas,
bloques, ronda, disparando})` every 200 ms. `intensidad()` turns that into I
in [0, 1], driven mostly by how many free rows are left above the floor and
partly by how full the board is. The `Motor` smooths I (τ 1.6 s) and uses it
to set the tempo, drums, arpeggio, filter cut-offs and a sidechain pump. In
calm there is no snare and the melody is sparse; near the floor you get
sixteenth hats, an alarm cluster and a heartbeat. The harmony switches to
«filo» at I ≥ .7 and leaves it below .5. That hysteresis stops it flickering
when a row goes back and forth. `duck()` lowers the music bus under the NICE!.

**From round 50 the game descends five floors** (`descenso.js`, UMD on
`BBTANDescenso`, loaded before `musica.js`): abismo from 50, ruina from 110,
estática from 170, hostil from 230 and vacío from 290. None of them is a switch.
`corrupcion(ronda)` rises by 1/60 per round over the sixty rounds after each
threshold, and each fade starts where the last one ends, so it climbs without
plateaus from 0 at round 49 to 5 at round 349, and **everything reads that one number** except the
gameplay: blocks, balls, physics and aim stay as they are, so the game only
gets more uncomfortable. The colours are `mezcla(c)`, a blend between the two
floors' palettes (`ETAPAS`), and `paleta()` in `game.js` writes them into
`colors` and into CSS variables on `<html>`. The floor adds the classes
`descenso` and `desc-2…5`, and each one breaks the frame a bit more: chipped
corners, chromatic glow, jitter, a heartbeat and a skewed shell. The
reduced-motion setting turns those animations off. The canvas gets cracks,
faint words, blinking eyes and static (`drawDescenso`, `drawEstatica`). The
character's face turns evil with `pose.maldad` in `character.js`, adding in
order: pallor, V brows, red eyes, streaks and a jagged grin. The whole body
and outfit follow (`pose.t` animates them): the skin goes grey then blood red,
the green shirt and blue jeans go black and burgundy, then come a stoop, a
torn shirt and frayed hems, a tail, horns, veins, claws, a glowing pentagram,
shoulder spikes and last bat wings, each over its own `m` range. The balls
change too (`drawBola`, `drawEstelaBola`): a halo and embers, then an eye that
looks where it flies and blinks, then a black core with a red rim, with a
trail of rising embers and smoke. The texts come from
`TEXTOS`, one column per floor, picked with `etapa(c)`, the nearest floor, so
the tone flips mid-fade. They go from cheering to «NO TE QUEREMOS AQUÍ», and
past floor 2 `corrompe` swaps letters with a seeded noise so the status bar
does not flicker. «PANTALLA LIMPIA» and the NICE! are never touched. The music
gets `descenso` in `mood()`, and `Motor` smooths it (`D`, τ 4 s). The first
floor fades the harmony into the abyss's sub bass, saturated bass and detuned
lead. Past that, the wrapper `eventos()` breaks what `base()` plays: bitcrush
(`trituradora`), wrong notes and a wobbling lead in ruina, dropouts and
crackle (`bat 'r'`) in estática, and in hostil a heartbeat that never stops
plus a dissonant pad cluster. In vacío come silent bars and notes that fall
an octave (`cae`). Each floor is slower.

**The descent is never announced.** Nothing says «entering floor N»: no
entry toast, no `presagio` sting (both removed), no class that flips on one
round. The CSS reads continuous weights `--w2…--w5` that `paleta()` writes,
and in `game.js` each effect fades in over its own corruption range
(`lento(a, b)`), so things take over one by one rather than per floor. What
creeps in: a face hidden in the dot grid (`CARA`) whose red pupils follow the
highest ball, veins from the corners (`VENAS`), a faint pentagram, eyes that
open on the blocks and follow the ball (`ojosDeBloque`), blood dripping from
them (`gotea`). Labels change letter by letter (`ETIQUETAS`: PUNTAJE→PECADOS,
RÉCORD→CONDENA, RONDA→CÍRCULO, BOLAS→ALMAS), the title turns BBTAN into
SATAN (the `<h1>` and `document.title`), and a red `susurro` flashes in a
label for a moment (`mutaciones`, every 120 ms).

**The one exception is the voice, and it was asked for** (`voz.js`, UMD on
`BBTANVoz`, tested by `voz.test.cjs`). Every 50 rounds the game speaks
(`habla`) and the phrase is also shown as a toast (`hablaJuego` in `game.js`,
`.toast[data-voz]`). It does not name the floor, it just changes mood: a
fairground host at 50 and 100 (`alegre`), broken and absurd at 150 and 200
(`roto`), whispering against the player at 250 and 300 (`susurro`), a
whisper cut off by a sugary voice at 350 (`giro`) and a too-perfect chorus
from 400 (`perfecto`). **It is recorded, not synthesised in the browser**:
`speechSynthesis` did not exist on phones and sounded different, and bad, on
every PC. `colabtex/scripts/bbtan-voz.py` renders each phrase of `FRASES`
with Piper (voices `es_MX-claude-high` and `es_MX-ald-medium`, apache-2.0
and unlicense datasets) into `assets/voz/v<nivel>-<i>.mp3` (~1.2 MB in
all). Each mood has its own processing there. `alegre` is pitched up by
synthesising slower and resampling faster. `roto` works in two- or
three-word chunks, each in another voice and pitch; single words came out
unintelligible. The stutter is spoken («cu, cu, cucharas»). `susurro` is a
real whisper, an LPC vocoder excited with noise, over a growl seven
semitones down. `perfecto` is a phase-vocoder chord (+4, +7, +12). The text
in `FRASES` is both what is read and what was recorded: **change a phrase
and re-run the script**. The test checks that there is one MP3 per phrase
and none left over. `faster-whisper` transcribing the output is how
intelligibility was checked. `audio.js` fetches a level's three files five
rounds early (`prepara`), plays through WebAudio (`anuncio`), ducks the music
and lays a bed under the voice. The beds are a fair arpeggio, glitch beeps,
the breath and drone, or a music box that climbs. It reports the real
duration back so the toast waits for the voice, and `vozSeq` drops a voice
that arrives after a restart.

**Past round 350 the descent is undone and the world turns perfect**
(`descenso.js`). The descent does not stop; it is subtracted.
`corrupcionVista = corrupcion × (1 − luz)`, with `luz` going 0 → 1 over
350–364, so everything that reads `corr` rewinds by itself. That includes
the character's evil, SATAN and the music's floors. `perfeccion(ronda)`
(`cielo` in `game.js`) is 0 until 349, 1 at 369 (dulce enters fast because
it is what sweeps the dark away), 2 at 449 (radiante) and 3 at 499
(perfecto). It stays at 3 after that. The palettes are light candy colours
(`CIELO`, blended over the fading descent by `mezclaCielo`). The CSS
`html.cielo` gets `--p1…--p3` and one more palette key, `text`, because the
page turns light. Texts come from `TEXTOS_CIELO` through `tx()`/`fundeTexto`.

Like the descent it creeps in (`suave(a, b)`) and nothing is announced. In
order:

- a sky, a sun and clouds;
- faces on the blocks (`carita`), rainbow balls that become hearts, and
  confetti;
- a rainbow, clouds that smile, and blocks, flowers and the page all bouncing
  on the same 1.63 s beat;
- at the end the sun grows, and every face stops following the ball and
  stares at the player;
- smiles grow wider than the faces, and background words appear («TODO ESTÁ
  BIEN», «NO MIRES DEBAJO»);
- very rarely, for 90 ms, the red face of the descent (`CARA`) flashes
  underneath (`debajo`).

The character comes back to normal and then gets «perfect» with
`pose.perfecto`: pastel clothes, a flower crown, a halo, angel wings, blush,
huge unblinking eyes and a grin that does not fit. Labels turn into
ALEGRÍA/ORGULLO/SONRISA/AMIGOS and the title into «BBTAN :)».

The music (`cielo()` in `musica.js`, `e.C`) is C major I–V–vi–IV with
four-on-the-floor, claps and a glockenspiel. It enters phrase by phrase like
the abyss. It is uncomfortable because it does not listen: above C = 2,
danger makes it happier and faster instead of tense. Each 8-bar loop also
modulates up a semitone, and a music box echoes the melody one step late.
Gameplay is untouched here too.

**A game in progress is saved per account** (`guarda`/`cargaPartida` in
`game.js`). At the start of every round from round 2 the board is written to
`localStorage` and sent with `Club.guardarPartida` to the parent, which
stores `{d, at}` at `users/<uid>/club/bbtan` (`fb.guardarPartidaClub`). That
node is the user's own, so **no rules change was needed**. On load the local
copy restores first; then `Club.pedirPartida` asks for the cloud one, which
wins if it is newer and nothing has been shot yet. A finished or restarted
game writes `d: null` (a tombstone with its `at`), so a stale copy on another
device does not come back. It resumes at the start of the saved round.

**Sopa de letras (`juegos/club/sopa/`) is a Solo Club game too**, on the
same `conexion.js` protocol: plain files, no build (`?v=sopa-N` on its two
scripts, `club-N` in `solo/club.js` for the iframe). `motor.js` (UMD
`SopaMotor`, tested by `tests/sopa.test.cjs`) is everything pure: the seven
themes (uppercase, no accents or Ñ, at least four letters, so the random fill
does not spell them by accident), generation, the Chile date, the
straight-line selection and the streak. `game.js` is the screen. Things that
matter:

- **The daily puzzle depends only on the date.** `diaChile` reads the date
  in `America/Santiago` through `Intl.DateTimeFormat` (`en-CA` gives
  `AAAA-MM-DD`), the theme rotates with the day number, and the grid comes
  from mulberry32 seeded with `hash("sopa:" + fecha)`. Nothing calls
  `Math.random`, so every browser draws the same 12×12 Medio. If a word
  does not fit after `INTENTOS` (300) tries, the next candidate is tried,
  and a failed round restarts **on the same generator stream**, so the
  result is still deterministic. No chosen word may contain another one,
  forwards or backwards; otherwise finding the short one would mark the
  wrong word.
- **The free mode** uses the same generator with a seed from
  `crypto.getRandomValues`. Its selectors are hidden in the daily mode
  (`[hidden]{display:none!important}` is there because the bar is flex).
- **The streak counts only the daily** (`registraDiaria`; `rachaVisible`
  shows 0 once a day was skipped). It lives in `localStorage` under the
  account's `Club.storageKey`, and inside Juegos also in
  `users/<uid>/club/sopa` through `Club.guardarPartida`/`pedirPartida`, the
  same channel BBTAN saves its game in. `mezclaRacha` merges the two
  copies: the one with the later `ult` wins, and `mejor` is the max of
  both. So a streak follows the person to another device, and finishing
  today's puzzle elsewhere shows it solved here.
- **Ranking.** `club-sopa-racha` has `puntos` = the streak reached (the
  table keeps the best one) and `tiempo` = that day's time. The free tables
  are `club-sopa-(facil|medio|dificil)-(8|12|15)`, with `puntos` fixed to
  the word count (6/10/13, checked in `club-datos.js`), so they order by
  time. `ranks.js` hides the size row while «Racha diaria» is picked (a
  fila's `si`). The `soloRanks` regex was widened, so the rules must be
  re-published.

**Electrodle (`juegos/club/electro/`) is a Solo Club game too**, a daily
guessing game in the vein of Pokedle/Wordle on electrical things, on the same
`conexion.js` protocol: plain files, no build (`?v=electro-N` on its four
scripts). `datos.js` holds the three catalogues (43 components, 48 people, 46
formulas, each with an `alias` list for search: «condensador», «termocupla»),
`simbolos.js` hand-drawn schematic symbols in a 120 x 80 box, and `motor.js`
(UMD `ElectroMotor`, tested by `tests/electro.test.cjs`) everything pure.
Things that matter:

- **Three challenges on top** (`retos.js`, UMD `ElectroRetos`), whose target
  is `"s" + seed` from the date: Bandas (a Mastermind of the resistor colour
  code, E12 targets, Wordle-style marks per band plus a higher/lower arrow on
  the value), Circuito (five resistor topologies; answer the current, Req or
  a voltage within 1.5 %, six tries, the solution steps shown at the end) and
  Conexiones (NYT Connections: one group per level from `GRUPOS`, no tile
  repeated across the whole bank so the solution is unique, `choca` keeps
  confusable groups apart, four mistakes). They can be lost (`hist` entries
  carry a fourth field, won 0/1, and a lost one scores 0), they add points
  (`M.puntos`) but **the streak only asks for the classic daily modes**
  (`CLASICOS`: Componente, Fórmula, Símbolo), so adding challenges did not
  break anyone's streak. Científico is `practica: true`: only in Práctica,
  never in the daily (`DIARIOS`), the share text or the streak.
- **The look is its own, like the *dle sites' themed pages**: always dark,
  whatever the site theme. `escena.js` draws the background scene (PCB
  traces with travelling pulses, a Tesla coil with random arcs, a power
  tower) behind a single centred column: neon logo, modes as round LEDs on
  a copper trace, a mode plate, a toolbar (Diario/Práctica switch, streak,
  points, stats and help `<dialog>`s) and chassis panels with screws.
  `ElectroEscena.descarga()` is the win flash. Reduced motion stops arcs,
  pulses and the neon flicker.
- **Four classic modes a day.** Componente and Científico are attribute tables
  (green equal, yellow «something in common» for list columns, red different,
  with an up/down arrow on numbers and on the ordered `EPOCAS`). Fórmula shows
  the formula with every variable masked and uncovers one per miss, in an order
  seeded by the formula id. Símbolo starts zoomed x5 on the symbol's `foco` and
  steps out through `ZOOM` on each miss. Hints unlock by misses (`pistas`).
- **The daily target depends only on the Chile date**, like the Sopa:
  each pass through a catalogue is a seeded shuffle (`vuelta`), so nothing
  repeats until all came out, and a pass never starts with the previous one's
  last. Símbolo only draws components that have a symbol. Práctica is random
  and scores nothing.
- **Scoring.** A mode is worth `puntosDe(n)` = 100 at the first try, 10 less
  per extra try, never below 10. The saved state is
  `{hist: {fecha: {modo: [puntos, intentos, ms]}}, prog}`; points, total time,
  streak (days with all four modes) and best streak are all derived from
  `hist`, so `mezcla` (union by day and mode) is all a second device needs.
  It lives in `localStorage` under `Club.storageKey` and in
  `users/<uid>/club/electro` through `Club.guardarPartida`.
- **Ranking.** `club-electro-puntos` has `puntos` = the running total (it only
  grows, so every solved mode is a new record) and `tiempo` = total solving
  time; `club-electro-racha` is sent when the fourth mode of a day is solved.
  Both feed the podium announcement on Discord, logros (`deMarca`) and coins
  (`extraRecord`: 10 per streak day, 1 per 50 points). The `soloRanks` regex
  was widened and `club-electro-puntos` got a 1 000 000 cap, so the rules must
  be re-published.

**Frontera Batalla (`#solo/frontera`) is Emerald's Battle Frontier as a
Solo Club game**, played locally on the same `@pkmn/sim` bundle as the
Pokémon rooms (`PokeMotor.frontera`, from `pokemon/frontera-motor.js`; the
screen is `juegos/frontera.js`, which reuses `pokemon.js` with `ctx.local`).
Three facilities: **Torre** (your saved team, shared with the rooms), **Palacio**
(your team, but the Pokémon pick their own moves by nature, the Emerald
table) and **Fábrica** (rental trio, swap one after each win). Level 50 or
Abierto, the Emerald clauses (three different species, no repeated item,
enforced on rentals too in `armaSet`). Rivals are seven per round with
Showdown trainer sprites (`htmlRival`, skin `x:<id>:<name>`): generic classes
first, then gym leaders, Elite Four, champions and rivals as the streak
grows, with the Frontier Brains where Emerald puts them: Anabel at battles
35 and 70 of the Torre, Spenser and Noland at 21 and 42 of theirs. Difficulty rises with the streak in both team strength and the AI's
`iq` (`decideIA`). **Everything comes from a seed**, so a battle replays the
same. The run is saved in `localStorage` and in `users/<uid>/club/frontera`.
Categories are `club-frontera-<torre|palacio|fabrica>-<50|abierto>` (puntos =
best streak) and `club-frontera-victorias`. Each win pays
`monedasCombate(n)` (4 + 2 per streak step up to 10, +10 every seventh). The
regexes for `soloRanks` and `clubJugadas` were widened, so the rules must be
re-published. `tests/frontera.test.cjs` covers it.

**UNO No Mercy's roulette is played by its victim**: the victim picks the
colour (not whoever threw the card) and then draws one card at a time with
the button until that colour comes out.

**Every game has a manual** (`reglas.js`, the 📖 **Reglas** button). It is a
modal hanging off `<body>` in `position:fixed` at z-index 80 — above the fin
cartel (60) and `jg-modal-capa` (70), because the question «what did this card
do?» comes up exactly when the cartel is on screen. It opens from three
places: the room header (mid-game, which is when people ask), the footer of
every lobby card (before opening a room — `leeOpciones` hands it the variant
picked in that card's select), and a bar above the solo games' iframe (Mina
Club, Snake Club). Games with variants (UNO, Flip 7, cacho with or without
*siciliana*) get one tab per variant and open on the room's: whoever is
playing No Mercy need not read the whole classic first. The text describes
**what the engine does, not what the box says** — where this version departs
from the table game (UNO draws from private decks, Flip 7 does not shuffle)
the manual says what happens here. Change a rule in `motor.js` and change it
there too: a manual that lies is worse than none. Escape, the backdrop, ✕ and
«Entendido» close it, and focus goes back to the button that opened it.

**Circuit Breakers (`worms`) is a whole game in an iframe**, like Mina Club:
`juegos/worms/` is its own document (canvas, physics, `audio.js`) and
`juegos/worms.js` (`crearWorms`) is only the postman between that frame and the
room — it simulates nothing. Four things hold it together:

- **The log carries one entry per turn**, `{t:"turno", uid, k, s, v, d, ti}`:
  `k` the turn number, `s` the serialised snapshot at its end, `v` the squads
  still standing, `d` damage per seat, `ti` the seat that played. `redWorms` in
  `motor.js` reads **only those headers**, never the snapshot, and the **first
  entry for a given `k` wins** — two tabs of the same player can both publish
  turn 7, and whichever arrived second is ignored rather than trusted.
- **The frame is configured only once the room has started** (`est.listos`).
  Before that it does not know how many squads there will be, and a game that
  begins with two and then receives a third has no deterministic repair.
- **What the active player is doing mid-turn goes through `vivo/<pid>`**, not
  the log: a header `h = {k, uid}` plus chunks under `c/<i>`. It is disposable —
  nothing is rebuilt from it — so whichever tab sees `fin` deletes it, and the
  rules let only players write there and only until the game ends (or delete).
- **Each log entry is forwarded to the frame once, by its key**, not by
  `jugadasDe`, whose helper overwrites the key with the entry's own `k`.

**Yemas (`yemas`) is a first-person shooter in an iframe, and the log only
carries deaths.** `juegos/yemas/` is its own document (Three.js from
jsDelivr through an import map, ES modules whose `?v=` lives only in that
import map, physics, bots) and `colabtex/src/juegos/yemas.js` (`crearYemas`)
is the postman, like Circuit Breakers'. Four things hold it together:

- **A death is one entry, written by whoever died**: `{t:"muere", uid,
  por, a, cab}`. `redYemas` counts `bajas`, `muertes`, `cabezas` and kill
  streaks from those, and the first to reach `meta` (10, 15 or 25, the
  room's `meta`, clamped by `metaYemas`) wins; the state freezes on that
  entry. A kill credited to oneself, to an intruder or to someone who left
  adds a death and no kill. Nobody can write a kill for themselves: the
  honest limit, said in the manual, is that a modified client could refuse
  to die.
- **Movement goes through `vivo/<pid>/y/<uid>`**, about twelve writes a
  second (`fb.yemasVivo`, which also arms an `onDisconnect` remove so a
  closed tab does not leave a frozen egg to farm). It is the existing `vivo`
  node, so it needed no new rule, and whoever sees `fin` deletes it.
- **Hits have no channel of their own.** Each egg's state carries its last
  eight hits (`g`, `[id, target, damage, head, weapon]`, ids from
  `Date.now()` so a reloaded tab keeps climbing) and each frame applies the
  ones naming it that it had not seen. The first state seen from a player
  only sets the watermark, so joining mid-game never replays old hits. That
  is what let the whole game ride on `vivo` without a rules change there.
- **The frame is configured once the room has started**, with the seats in
  order (the seat decides the shell colour, `PALETA` in `juegos/yemas/js/red.js`),
  and gets the reducer's scoreboard on every repaint plus each `muere` once,
  by key, for the kill feed; the first batch is flagged `viejas` and not
  announced.

**Four variants over one reducer** (`variante` in the room, not `modo`,
which the rules whitelist): `todos` (free-for-all), `equipos` (team
deathmatch), `bandera` (capture the flag) and `zombis` (co-op waves, below). Teams are by seat parity
(`equiposYemas`), so a room splits itself evenly as it fills. The room picks a
`largo` (short/normal/long) rather than a number, because one select cannot
change its options by another; `YM_LARGOS` turns it into 10/15/25 kills,
20/30/50 team kills or 1/3/5 captures, and a room from before, with only a
`meta`, still reads it. In capture the flag **the flags are game state, so
they go in the log**, written by whoever touches them: `{t:"toma", b}`,
`{t:"devuelve", b, auto?}`, `{t:"captura", b}`, plus the carrier's `muere`
with `x`/`z` to drop it where they fell. The log's order settles two players
grabbing at once. A capture needs your own flag at home, and a dropped flag
goes home when a teammate touches it or, after 25 s, when any teammate's
frame sends `auto`. Bases are `YM_BASES` in `motor.js` and `BASES` in the
frame's `mundo.js`, which must agree. There is no friendly fire (the frame
skips teammates in the raycast), and each team spawns in its own half.

**Zombies (`zombis`) are moved by one player's frame, the director**
(`juegos/yemas/js/zombis.js`, wired in `main.js`). There is no server to
run them, so the first seat still in the room whose egg is visible in `vivo`
simulates them (`director()`). If that tab closes, its `vivo` entry goes
with `onDisconnect` and the next seat takes over from the last `zb` it saw
(`adopta`). Two frames may both direct for a moment while that settles; the
cost is a stray bite, not a broken game. Seven things hold it together:

- **The zombies ride the director's own state**, as `zb: {r, q, p, e, z, m}`:
  round, how many are still to spawn, the start and between-round timers,
  each zombie as `[id, x, y, z, ry, hp%, rising, burning, phase, window]`,
  and the last 20 deaths as `[id, killer, head, weapon, explodes]`. The other frames only draw them
  (`desdeRed`). Firebase drops empty arrays, so `zb.z` can come back
  missing, and `lista()` reads that as no zombies.
- **Shots at a zombie are ordinary hits** addressed to `z:<id>` in the
  shooter's `g` list. `red.js` hands those to `alGolpeZombi`, and only the
  director applies them. Bites go the other way: the director sends a hit
  with weapon 9 (`ZOMBI`). The victim's frame turns it into a death with
  `por: ""`, so it is nobody's kill.
- **Points live in each frame** (`yo.pz` to spend, `yo.pzT` earned). A hit
  pays 10 and a kill 60, or 100 to the head, or 130 with the pan. A kill
  only pays when a death in `zb.m` names that player. Each `vivo` state
  carries `pz`/`zk` for the Tab table.
- **What is bought is the map's** (see below): wall weapons, the box,
  perks and Pack-a-Punch. `E` buys with points, and buying an owned wall gun
  refills it at half price. None of that goes through the log.
- **Rounds and falls are game state.** When a round is clear the director
  waits `ZB.pausa` and writes `{t:"ronda", r}`. `redYemas` accepts only the
  next round, and accepting it revives everyone who fell. In zombies a
  `muere` marks the player fallen and carries `pts`, `zk` and `r`, all
  integers that only go up. The game ends the moment every player still in
  the room is fallen. The top `pts` wins, and `""` (a draw) if nobody
  scored. Being left alone is not a win by abandono.
- **Before falling there is a last stand** (`cae`, `pasoAbatido`,
  `ABATIDO` in the frame's `main.js`). Reaching 0 hp in zombies does not
  write `muere`: the egg goes down (`yo.abatido`, still `vivo`, so it is
  not in `caidos`) with the pistol — its own, or a borrowed one taken back
  on getting up — crawling at a quarter of the speed, with no perks.
  Zombies ignore it (`pasoZombis` passes `vivo: false`). The state carries
  `ab` (seconds left), which tilts the egg in the other frames. A teammate
  within 1.6 m holds E for 4 s (`pasoRevivir`) and sends a zero-damage hit
  with `a: REVIVE` (99) that lifts it; only when the 30 s run out does it
  `morir`. With nobody else standing the clock drops to 2 s, so a downed
  team still loses. **Quick Revive halves the time it takes you to lift
  others**, and **alone** it lifts you after 3 s, once (it is lost like
  every perk). Alone without it you die at once.
- **A fallen player waits for the round.** The frame only respawns when
  `marcador.ronda` grows, with the pan and the pistol and keeping the
  points. Those still standing get their grenades back. Health regenerates
  after 4 s without damage, in zombies only. A reloaded tab whose player is
  in `caidos` stays fallen.
- **Zombies walk the map's graph.** They spawn outside a window (or rise
  from the ground on the open maps), tear its boards off one at a time,
  climb in, and then go by `nodos`/`enlaces`. A link through a door only
  counts once that door is open, so the distances are recomputed
  (Floyd-Warshall, under fifty nodes) every time one opens. A zombie that
  sees its prey chases it straight.
- **Every round is harder, and not only in numbers.** `hpRonda`,
  `totalRonda` and `velRonda` grow as before. On top of that,
  `maxVivos(n, r)` lets one more zombie stand at a time per round, and the
  bite (`mordidaRonda`) goes from 35 in round 1 to 50 in round 4 (two bites
  and you fall), up to 80. There are three kinds too (`TIPOS`, `CLASE`,
  `tipoRonda`). The runner (`c`) shows up from round 3, has 70 % of the
  life and runs faster than a player walking (5.8 m/s plus 0.3 per round,
  up to 9). The big one (`g`) shows up from round 5: slow, three times the
  life, a 1.6× bite and 30 % bigger. Its `userData.escala` widens the
  bullets' ellipsoid (`rayoHuevo(..., escala)`) and raises the head line.
  No bite takes more than 95, so a full-health player is never killed in
  one go. The kind travels at the end of each `zb.z` entry and of each
  death in `zb.m`, and a kill pays `CLASE[t].puntos` (60, 80, 150), plus 40
  for the head or 70 for the pan. `NOVEDAD_RONDA` warns at rounds 3, 5 and
  10.

Practice can be zombies too: the menu's mode select gives `conectarLocal`
`variante: 'zombis'`, `RedLocal` keeps the round and ends the run on the
first death, and a button reloads it.

**The zombies maps are Black Ops' five, as data** (`juegos/yemas/js/mapas.js`:
`nacht`, `kino`, `nuketown`, `riese`, `pueblo`). A map is plain boxes,
decoration, windows, a navigation graph, doors with prices and the zones
they open, and where the perks, the box, the wall weapons, Pack-a-Punch, the
power switch and the lava go. It has no THREE and no DOM, so Node can walk
it. `mundo.js` draws it, `zombis.js` navigates it and
`juegos/yemas/js/interactivo.js` owns everything that is bought or touched.
Things to know:

- **The map is chosen with the room** (`partida.mapa`, an option of the
  yemas card). `mapaYemas` in `motor.js` clamps it to `YM_MAPAS`, the
  config carries it into the frame, and `red.mapa` reads it. Practice uses
  `#mapa-practica`. The rules do not validate `mapa`, so this needed no
  rules change.
- **What belongs to the room rides the director's `zb` too**, under keys
  that do not clash with `zombis.js`'s: `o` open doors, `l` power, `k`
  boards per window, `n` where the box is, `t`/`f`/`w` the teleporter.
  Points, perks and weapons belong to each player and are paid and given
  in their own frame.
- **A non-director asks with a zero-damage hit to `p:<what>`.** `red.js`
  hands it to `alPeticion`, which calls `inter.peticion`. The asking frame
  applies a door or the power at once: those only go one way, so the
  director has nothing to contradict. Boards go both ways, and there the
  director's state wins.
- **Perks need the power** except Quick Revive (500 alone, as in BO1). They
  and Pack-a-Punch are lost on falling. Pack-a-Punch is `conPap` in
  `armas.js` (double damage, a clip and a half). The box can give the Rayo
  batido (`10`), the Amasadora (`11`) and the Huevera (`12`), which exist
  only in zombies, and pulling the teddy bear moves it.
- **Each dead zombie leaves a green fried egg** on the floor (`friteVerde`
  in `zombis.js`: green white and rim, an orange yolk that pulses) for
  `HUEVO_VIDA` seconds, fading over the last three, drawn in every frame
  from `zb.m`. In Pueblo, a zombie that steps in the `lava`
  burns (`quema`) and explodes when it dies, hurting players near it.
- **Power-ups** (`juegos/yemas/js/bonos.js`, `BONOS` in `armas.js`): a
  dead zombie may drop Insta-Kill, Carpintero, Kaboom, Munición máxima or
  the Máquina de muerte (weapon 13, a heavy minigun for 30 s, only for
  whoever took it). They ride `zb` as `b` (on the floor) and `x` (the last
  eight taken); a non-director asks with `p:bono:<id>` and hides it at
  once, and every frame applies each `x` entry once.
- **Zombies collide with players** (`chocaZombis` in `main.js`) and
  **climb** rather than jump; a player standing on something makes them
  replan towards the nearest climbable edge instead of piling up below.
- An unbought wall weapon shows only its **silhouette**; Pack-a-Punched
  weapons get a metallic material; drinking a perk plays an animation and
  each perk has an icon on its machine and in the HUD. **Double Tap fires
  two bullets**, not double damage.

**Zombies rooms are ranked apart, by map and by round.** `anotar` in
`juegos-main.js` does not write `ranks/yemas` for a `zombis` room: it calls
`fb.guardarSolo("yemas-zombis-<mapa>", …)` with `puntos` = the round
reached and `tiempo` = the game's length, so the table orders by round and
then by time. `ranks.js` shows it as **Yemas zombis** (`EXTRA.yzombis`, in
the «En sala» group) with a «Mapa» row. The `soloRanks` regex was widened,
so the rules must be re-published.

**A team win is `ganador: "eq:rojo"`**, and `ganoEn(p, ganador, uid)` in
`motor.js` is the one place that knows it includes the whole team. `anotar`,
`pintaFin` and logros' `contexto` ask it instead of comparing with the uid,
so the ranking gives the win to every member. `nombreDe` says «el equipo
Rojo».

**Voice chat is WebRTC between browsers** (`juegos/voz.js`, generic, used by
`yemas.js`). It is a mesh with no media server, and the database is only
the signalling mailbox, `vivo/<pid>/voz` (`fb.senalVoz`): `en/<uid>` holds
each person's session while they are in, and `b/<uid>/<push>` holds the
offers, answers and ICE candidates sent to them, deleted on read. Both are
removed on disconnect. Three rules keep it simple. The lower uid of each
pair offers, so there is no glare. Every message carries the sender's and
the recipient's session, so leftovers from a reloaded tab are ignored. ICE
candidates that arrive before the offer wait in a queue. The mic is
push-to-talk on V by default, or open; the frame forwards the V key
(`hablar`) and paints who is talking (`voces`, measured with an
`AnalyserNode` in the room page). Only STUN is configured, with no TURN, so
two networks that refuse a direct connection (some mobile carriers) do not
hear each other; the bar strikes that name through in red rather than
staying silent. Because it all lives in `vivo`, **no rules change was
needed**. `voz.js` takes the mailbox as a parameter, so it was tested with
three instances in one page over real `RTCPeerConnection`s, a fake mailbox
and oscillators as microphones.

**The voice outlives the game, not the room.** At `fin` the postman deletes
only the eggs (`fb.borraYemasVivo`, `vivo/<pid>/y`) and keeps the voice.
`vivo/$pid/voz` has its own rule that lets players write after `fin` (a
child grant, OR'ed with the parent's), so a reconnection still signals.
Leaving the room (`destruir`) is what hangs up. Whoever was in the voice
has the room's pid in `sessionStorage` (`yemas.voz`), and the postman
re-enters by itself in a reload of the same room or in the rematch
(`p.origen`). A re-entry without a gesture can leave remote audio
blocked, so `voz.js` retries `play()` on every level check and it sounds
from the first click anywhere, the game frame included. The rules must be
re-published for the after-`fin` part; until then, established
connections keep talking and only new signalling fails.

**In the team variants each player picks a team** while the room waits:
`{t:"equipo", uid, e}` from the picker the postman draws above the frame.
`equiposYemas` starts from seat parity, applies the last choice of each
player **before the first game event** (a death or a flag touch), so teams
cannot change mid-game, and falls back to parity if a team ends up empty
with two or more in the room. The frame gets the teams on every
`marcador` and repaints the eggs when a colour changes.

**Grenades** (`juegos/yemas/js/granada.js`, the *Huevo duro*, weapon index
3, `YM_ARMAS`): two per life, `G` or `4`. The thrower's frame simulates it,
decides where it bursts and whom it reaches (line of sight from the burst,
damage falling linearly over `radio`), and sends the damage through the
usual hits with `a: 3`. Self damage is half and applied directly, so a
self-kill is a `muere` with `por` = oneself, which counts as a death and no
kill. The state carries the last throw (`n: {i, o, v}`) and the last burst
(`x2: {i, p}`). The others simulate the throw only to see it fly, and they
burst it **where the owner said**, because two simulations with different
frame rates do not land on exactly the same spot.

**Self-destruct** (weapon index 4, `AUTO` in the frame's `main.js`): hold X
for `AUTO.carga` (0.9 s); releasing earlier or losing focus cancels it, so it
never fires by accident. While charging the state carries `ad: 1` and the
other frames make that egg glow red and beep, which gives them a moment to
run. It bursts like a grenade (same `alcanceExplosion`/`golpeaRivales`,
published as `x2`) with its own radius and damage, and the player always dies
with `por` = themselves.

**Explosions are measured at three points of each egg** (feet, middle,
head; `alcanceExplosion`), and the best one with a clear line counts. Damage
is full within `pleno` and falls linearly to `radio`. The rocket used to
burst *inside* the box it hit, so the wall it touched blocked the line to
every egg, and a rocket hitting the wall beside someone did nothing. That is
why `granada.js` now backs the burst point out along the flight before
bursting.

**The arsenal** (weapon ids in the frame's `armas.js`, never renumbered
because the log names them: 0–2 the original three, 3 the grenade, 4 the
self-destruct, 5 the pan (it was a knife, same id), 6 the bazooka, 7 the
pistol, 8 the golden spatula, 9 a zombie's bite, 10–12 the box's wonder weapons, 13 the
Máquina de muerte; `YM_ARMAS` = 14).
Everyone starts with the pan (`SARTEN`) and carries at most two more. The rest lie on
`PUNTOS_ARMA` (frame's `mundo.js`, `YM_PUNTOS_ARMA` in `motor.js`, which must
agree). **Which** weapon lies on point `s` at its appearance `g` comes from
the room's seed (`armaEnPunto`, so every screen sees the same one, and the
postman sends `semilla` in the config). **Who takes it** is game state:
`{t:"recoge", uid, s, g}` counts only if `g` is the next appearance after the
last one taken there, so two players grabbing at once are settled by the log.
`est.armas` is `{s: {g, uid}}`, and the frame grants the weapon when it sees
itself as the taker. Each screen brings the next appearance back
`REAPARECE` (18 s) after seeing one taken; that timing is the screen's alone.
Walking over a free slot or a weapon already owned picks it up (an owned one
only refills it), and with both slots full `E` swaps the one in hand.
Inventory and ammo live in the frame: every gun has its magazine plus
`RECARGAS` (8) reloads per life (`RECARGAS_ZOMBIS`, 14, in zombies), and weapons survive death. Respawn after
being killed refills life, ammo and grenades. After a **suicide that killed
nobody**, it restores the life, ammo and grenades held just before. A kill
that arrives while dead, or within 300 ms before dying (practice resolves it
synchronously), counts as having killed someone. The bazooka's rocket rides
`granada.js` as kind `cohete`. It flies straight, and the owner's frame
bursts it on a wall, on the floor or **near** an egg: `tocaHuevo` inflates
the egg's ellipsoid by `espoleta` (1.4 m). Within `pleno` (2.2 m) it does a
full 150, so hitting the egg itself is not needed.

**The golden spatula** (id 8, `ESPATULA_CFG` in `armas.js`) only appears in
`todos`. `armaEnPunto(..., espatula)` makes one appearance in `rara` (16)
the spatula, from a different slice of the same hash, so every other
appearance stays the weapon it was. It is taken with the usual `recoge` but
occupies no slot (`yo.espatula`), and it is lost on death. `Q` throws it at
the living rival closest to the crosshair. The thrower's frame flies it
through walls at 17 m/s. Every 0.55 s at touching distance it sends a hit
with `a: 8`, and the **victim** takes half of whatever life it has left
(`ceil(hp/2)`, so 100 dies on the seventh). It stops when the target dies,
leaves or 20 s pass. The state carries `ep: {i, u, p}`, so the others see it
fly and the target gets a warning.

**Grenades are a loadout**: two per life, each `duro`, `humo` or `luz`
(`GRANADAS`), chosen in the pause card or with Z/C while dead, kept in
`localStorage` (`yemas.pref`, with the mouse sensitivity and the skin). `T`
picks which one `G` throws. Launches and bursts carry their kind (`n.k`,
`x2.k`). Smoke is local sprites plus a grey overlay while the camera is
inside the cloud; bullets go through it. The flash blinds each viewer by
distance, line of sight and whether they were facing it, the thrower and
teammates included.

**Skins** (`SKINS` and `ponSkin` in the frame's `mundo.js`) are accessories
hung off the egg's body; the shell keeps its seat or team colour. The state
carries `sk`, and a remote egg whose skin changes is rebuilt.

**Sprint and slide are the frame's alone** (`SPRINT`, `DESLIZ` and
`deslizar()` in its `main.js`). Shift while moving forward runs ×1.6 with a
wider FOV and a little more spread; C while running on the ground slides
along the current velocity with friction until it is back to walking pace,
lowering the camera. A slide ends the sprint, and `sinSprint` keeps it ended
until Shift is released, so holding Shift does not chain slides. Jumping
out of a slide jumps 1.3 times higher (and ends the slide, keeping the
momentum). C still cycles the second grenade while dead. The state carries `ds: 1` while
sliding, and the other frames tilt that egg back and play the scrape. Hit
detection still uses the upright egg.

**A death leaves a fried egg** (`huevoFrito` in the frame's `main.js`): an
irregular white `ShapeGeometry` over a golden crispy rim and a glossy
half-dome yolk off-centre, grown in over a third of a second, with a sizzle
(`sonido.fritura`), faded after 14 s, at most 30 on the floor.

**Fullscreen is the frame's**, not the page's. The room header's ⛶ asks the
module first (`modulo.pantallaCompleta()`, which `yemas.js` answers with
`frame.requestFullscreen()`), and only a game without that hook falls back
to the immersive mode. Inside the frame, `F` and a button on the pause card
do the same with the frame's own document (Shift+F, not F alone, which sat
next to G and fired by accident). The voice bar stays outside;
`V` still reaches it, and the pause card has a **🎙 Entrar a la voz**
button that asks the postman (`voz`).

Opened on its own, `juegos/yemas/index.html` is practice against four bots
with the same engine (`conectarLocal`), which is also the quickest place to
test a change. The window hooks `__yemas.paso(dt)` step the game without
`requestAnimationFrame`, which is how it can be driven from a script while
the tab is hidden. `tests/yemas.test.cjs` covers the reducer, the four
variants and `ganoEn`. Practice is free-for-all or zombies. The team modes
and online zombies were tested with several frames driven by a fake room
that runs the real `reducir`.

**Clue (`clue`) is a deduction game in an iframe, dealt with mental poker
so that nobody (not even the host) knows the envelope.** `juegos/clue/` is
its own document: `js/motor.js` (UMD `ClueMotor`: data, the 24x25 board,
movement, the reducer and the SRA crypto), `js/mesa.js` (practice table,
you against bots), `js/bots.js` (the deduction bots), `js/red.js` (the
online side of the frame) and `js/main.js` (the screen). The board is the
building filmed in a walkthrough video: three rooms on the second floor
(lockers, emergency landing, window corridor) and six on the first, the
courtyard in the middle holding the envelope, and two secret passages
(the stair and the goods lift). There are nine weapon slots, one per
room at the start, 24 cards in all. Which weapon fills each slot is drawn
per room from the seed (`armasDePartida`, returned as `est.armasPartida`):
3 to 5 of the six classic ones from the building (with their video photo)
and the rest from the nine electrical ones (Smith chart, Fourier
transform, resistor, capacitor, inductor, transistor, power supply, op-amp,
LED). A weapon card is still its slot; `M.arma(armasPartida, a)` gives
the catalog entry. `js/armas.js` (`ClueArmas`, keyed by catalog id) draws
each one, with a short feedback effect (`chispa`) and a murder scene
(`escena`) that plays on the end screen for the weapon in the envelope. `colabtex/src/juegos/clue.js` (`crearClue`)
is only the postman, like Yemas'. Things that hold it together:

- **One engine, three users.** `motor.js` of colabtex cannot import (the
  tests load it in a `vm` with the `export`s stripped), so `redClue` reads
  `globalThis.ClueMotor`, which `clue.js` sets when it imports the UMD file.
  `redClue` drops the engine's own `jugadores` so the room's (with photo and
  colour) survive. The reducer never exponentiates.
- **Characters are chosen, not fixed.** The six suspects are six coloured
  slots; each player picks a character first (`{t:"elige", r}`), seat i
  plays slot i, and free slots are filled from the roster with the seed.
  The roster is real people (names and photos), so it is **not in the
  repo**: it lives in the RTDB node `clueElenco` (read with a session,
  written by hand in the console, see `firebase/CONFIGURAR-FIREBASE.md`),
  `fb.leerElencoClue()` reads it and the postman hands it to the frame,
  which caches it in `localStorage` (`clue.elenco`) for practice. Without
  it the game uses the invented `SOSPECHOSOS`.
- **The deal is Presidente's SRA, on the same 384-bit safe prime**, in
  three sequential passes of the frozen table `cr.mesa`: `mezcla` (all
  `NC` cards, exponent k1, shuffled *within* each category; the first of
  each, positions 0, 6 and 15, is the envelope), `revuelve` (the other
  `NC - 3`, exponent k2, shuffled
  together so nobody learns the category mix of a hand) and `quita` (each
  removes k1·k2 from the cards that are not theirs; card j belongs to
  `mesa[j % n]`). `red.js` does these by itself, as it does `paso` when
  you hold nothing, `abre` (the others remove their k1 from the envelope,
  in seat order, when someone accuses) and the accuser's `veredicto`.
  A shown card travels in a Diffie-Hellman envelope keyed by the
  suggestion's key (`muestra.x`).
- **The end waits for the seeds.** With `fin` written no move gets in, not
  even `{t:"s"}`, so the postman calls `terminar` only once every seated
  player revealed theirs, or after `ESPERA_SEMILLAS` (12 s), re-arming
  every second like Flip 7. A correct accuser reveals at once. `auditar`
  then replays the whole deal and flags `paso` lies, cards shown that were
  not theirs, bad passes and false verdicts. The honest limit, said in the
  manual: whoever leaves after choosing without revealing their seed takes
  their lock with them, and the game is void (`motivo: "anulada"`).
- **The end cartel waits for the frame's drama.** The screen animates the
  accusation (the envelope opening lock by lock) and the murder scene, and
  the room's fin overlay would cover them after `PAUSA_FIN`. So the frame
  posts `{tipo:"ocupado", v}` (`conexion.ocupado`), the postman exposes it
  as the module's `ocupado()` and calls `ctx.listo()` when it drops, like
  Chain Reaction's replay; `OCUPADO_MAX` (15 s) releases it if the frame
  never does. A wrong accuser peeks into the envelope (`priv.sobre`), as in
  the board game.
- **Dice come from the seed, the turn number and a hash of the accepted
  moves** (`huella`), so they are the same on every screen and cannot be
  known turns ahead; rejected moves do not enter the hash, or writing junk
  would re-roll the next turns.

`tests/clue.test.cjs` covers the board, movement, the reducer and the crypto
end to end; `tests/clue-bots.test.cjs` plays full practice games;
`tests/clue-red.test.cjs` runs several `red.js` frames against a fake room
through a whole online game and checks the audit comes out clean.

**Ajedrez (`ajedrez`) is the whole of FIDE's rules in the reducer**
(`redAjedrez` and the `aj*` functions at the end of `motor.js`). A move is
`{t:"m", uid, de:"e2", a:"e4", pr?}` and counts only if it is in the legal
list of that position, so an illegal or out-of-turn move simply does not
exist; the rest are `tablas` (offer), `acepta`, `rechaza` and `rinde`. Things
worth knowing:

- **The board is 64 letters, index 0 = a8**, upper case white, `.` empty,
  English letters inside (FEN's) and **Spanish notation on screen** (R D T A
  C, `AJ_LETRA`). `ajLegales` is pseudo-moves filtered by "does my king end up
  attacked", and castling checks the squares the king crosses itself.
  `tests/ajedrez.test.cjs` runs **perft** on five reference positions
  (start, Kiwipete, the en-passant/pin one, promotions, position 5): any
  change to move generation has to keep those numbers.
- **Threefold repetition and the fifty-move rule are automatic**, not
  claimed: with no arbiter, a claim would need the reducer to know about
  time and intent. The repetition key carries the en-passant square only
  when an en-passant capture is actually legal.
- **Colours**: the host picks in the lobby card (`color`: azar/blancas/
  negras, through `$otro`, so no rule for it); «al azar» is the room seed's
  parity (`ajBandos`).
- **The clock is replayed from the log too.** The room's `ritmo` («3+2»,
  one of `AJ_RITMOS`, or `libre`) sets it; every move carries `at`
  (`ctx.ahora()`, the server-corrected clock), and the reducer charges each
  side the time since the previous move and adds the increment. It does not
  run until both sides have made their first move, as on lichess. A move
  that arrives past its time does not count and loses on time; if nobody
  moves, either screen sends `{t:"tiempo", at}` when the flag falls, and the
  reducer only accepts it if the time really ran out (the screen retries
  every 1.5 s against clock skew). Flagging against a side that cannot mate
  (`ajNoMata`: bare king, or king and one minor piece) is a draw,
  `tiempomaterial`. The honest limit: `at` is written by the client, and the
  rules only pin it to a few seconds of the server's `now` (scoped to chess
  rooms, so the escondite's own `at` is untouched).
- **Premoves are screen-only** (`pre` in `ajedrez.js`): during the
  opponent's turn the same tap/drag records a move whose destinations are
  the piece's geometric ones (own pieces block, enemy pieces do not), shown
  in red, and it is sent the moment the turn arrives if it is legal in the
  new position, or dropped with a notice. Right-click or tapping an empty
  square cancels it.
- **One draw offer per own move** (`ofrecio`); moving while an offer is in
  front of you declines it, while the offerer moving keeps it standing.
- The replay is memoised (`ajCache`) by the move list, since a repaint
  happens on every tick.
- **The pieces are free piece sets served as files**
  (`juegos/ajedrez/piezas/<set>/wK.svg`: cburnett under BSD, chessnut under
  Apache 2.0, fantasy and celtic under MIT, see `LICENCIAS.md` there; the
  non-commercial lichess sets were left out on purpose), placed with
  `<image>` by `piezaSvg`, which the lobby cover uses too. They are not
  inlined because several carry their own `<style>` with ids that would
  clash inside one SVG. The viewer picks a set (`jg.ajPiezas`). Moving is tap-tap
  or drag over the same `sel`; promotion opens a picker and the reducer
  refuses a promotion with no piece. The opponent's piece slides in from its
  origin on an **inner** `<g>` (`.jg-aj-llega`), for the same reason as
  Chain Reaction's nested orbs. `est.perdidas` (not `fuera`, which the header
  reads as "players out") is what each side has lost, counted against the
  starting set. The music borrows Reversi's harpsichord.

**Pokémon (`pokemon`) is Pokémon Showdown's simulator, not a rewrite**
(`@pkmn/sim`, the MIT extraction of Showdown's `sim/`). Moves, abilities,
items, natures, the type chart of each generation, stats, Tera/Mega/Z, the
tiers and the team validator all come from it, so a battle here resolves
exactly as on Showdown. It is a **separate bundle** (`juegos-pokemon.js`,
~6 MB, ~1 MB gzipped, `npm run build:pokemon`, part of `build`) loaded the
first time someone opens a Pokémon room or the team editor
(`pokemon/carga.js`, with the page's `?v=`, like `colabdraw-math.js`; it is
not in `PAGES`). It hangs off `globalThis.PokeMotor` and `redPokemon` in
`motor.js` looks for it there, like Clue's `ClueMotor`; without it the room
reads `fase: "cargando"` and the screen calls `ctx.rehaz()` (a new hook in
`montaJuego`) to re-reduce once it lands. Things that hold it together:

- **A battle is a list of decision points**, and each point is written
  twice by *both* players: a promise `{t:"c", k, h}` with `h = H(choice +
  "|" + key_k)` and, once both promises are in, the reveal `{t:"r", k, c,
  l}`. Point 0 is the team (the packed Showdown team, plus `sk`, the trainer
  skin); the rest are whatever Showdown asks both sides at once (team
  preview, the turn's move or switch, a forced switch). Whoever has nothing
  to decide writes `"-"` (`NADA`), sent by the screen without asking.
- **The keys are a hash chain** (`cadenaPk`, `PK_CADENA` = 2000 in
  `motor.js`), from the private seed in `misPartidas`, tip `hcad` in the
  write-once ficha, as in cacho: H(key_k) must be the previous key. **The
  PRNG seed of point k is H(semilla | k | key₁ | key₂)** (`battle.resetRNG`
  before applying the choices), so nobody knows a crit or a miss before both
  have committed — that is also why the non-deciding side commits too. A
  reveal that does not match its promise or its chain is ignored and named
  in `falsas`. An impossible choice becomes Showdown's `default`.
- **Teams are public in the log** (the simulator needs both); the screen
  shows only what Showdown would (species at preview, the rest as it is
  revealed in the public log). That is the honest limit, and the manual says
  it. Teams are still chosen blind, behind the promise.
- `motor-pk.js` caches the live `Battle` per room and applies only the new
  log entries; the cache is keyed by a **signature of the applied entries
  that includes each `h`/`l`** — with type and author alone, two battles of
  the same shape were taken for the same one.
- The screen (`pokemon.js`) saves the promised choice in `localStorage`
  (`pk.pend.<pid>.<uid>`) **before** writing the promise: after a reload,
  that is the only way to reveal it. It has the usual heartbeat
  (`LATIDO_MS`) and retry (`REINTENTO_MS`). The narration is
  `pokemon/relato.js` (pure, Spanish sentences over Showdown's protocol;
  species, moves and items stay in English, as Showdown and Smogon write
  them). **Sprites are 2D only** (`urlsSprite`): PokeAPI/sprites'
  Black/White-style animated GIFs (`versions/generation-v/black-white/
  animated`, front and back) where they exist (`BW_FRENTE`/`BW_ESPALDA` in
  `pokemon/formas.js`, generated from that repo's tree), else the static
  2D PNG; minis ask for `fijo` and get the PNG straight away. Not
  `other/showdown`: from gen 6 on those are renders of 3D models. Forms map
  to PokeAPI ids through `pokemon/formas.js`, generated from PokeAPI's
  `pokemon.csv`.
- **The battle scene is built once and touched piece by piece**
  (`asegurarCampo`, `ponSprite`, `ponFicha`): the sprite's `src` changes only
  when the Pokémon does and the HP bar is always the same element, so its
  transition shows; repainting by `innerHTML` cut every animation short. New
  log lines become a **queue of steps** (`pasos`/`anima`): lunge on `move`,
  type-coloured impact, shake and the bar dropping to that line's HP on
  `-damage`, field shake on `-crit`, drop on `faint`, Poké Ball pop on
  `switch`, sparkle on Tera, weather overlays, and the trainers' VS intro on
  `start`, each step's sentence in the dialog box. Sprites and HP boxes wait
  for the queue (`pintaEscena` only touches them when it is idle), **the move
  menu too** (`pintaControl` shows "…" while `animando`), and `ocupado()`
  keeps the fin cartel back until the last KO has been seen. A hidden tab
  or more than `MAX_PASOS` steps skips straight to the end. The background
  (`BIOMAS`) comes from the room's seed, so both players see the same
  place. Trainers and party sit in a strip above the field (`.jg-pk-tira`).
  Trainer skins (`pokemon/entrenadores.js`) are the main-series
  protagonists, hot-linked from Showdown's trainer sprites because
  PokeAPI/sprites has none; if one fails, the initial is drawn.
- **Teams live in `users/<uid>/pokemon`** (`{equipos: {id: {nombre,
  formato, eq}}, skin}`, owner-only already, so no rule) with a
  `localStorage` copy. `pokemon/equipos.js` is the editor: paste/export
  Showdown text, or build each set (species, item, ability, nature, EVs,
  IVs, Tera, moves from the learnset), with live stats and the validator's
  own messages. The room option is `formato` (not `modo`, which the rules
  whitelist); the list is `pokemon/formatos.js`, shared with the lobby so it
  does not need the bundle.

`tests/pokemon.test.cjs` bundles the engine with esbuild and plays robot
battles through the promise protocol, checking that a late tab replays the
same battle, that a forged reveal or key does not count, that an illegal
team loses, that an impossible choice falls back to default, and the
narration. `'pokemon'` needed the rules' `juego` and `logros` whitelists, so
they must be re-published.

**Mina Club's board fits its box; it never pushes past it** (`juegos/club/minas/`,
plain files with no build, mounted by `solo/club.js` in an iframe whose `?v=`
has to be bumped when they change). The board used to carry
`min-width: cols × 26px`, which on a tablet and inside the Juegos iframe was
wider than the room it had. The last columns ended up behind a horizontal
scroll that fought with the touch, and that was «a column you can't see». Now:

- the columns are `minmax(0,1fr)` and cells `min-width/min-height:0`, so
  `aspect-ratio` keeps them square — a flag's svg used to stretch its cell,
  hence the svgs are absolutely positioned;
- the number's size is in `cqi` of the board;
- a wide board on a portrait screen is **transposed for display only**
  (`acomodar()`, `grid-auto-flow:column`), with the arrow keys remapped;
  minesweeper doesn't care which way it is drawn, so the engine never knows.

`vertical()` reads `window.top` because the iframe's own shape says nothing.
The **Descubrir · Bandera** selector decides what a tap does (`tocar(i, alReves)`),
and a long press always does the other thing.

**The music is one songbook** (`juegos/audio/chip.js` + `temas.js`, plain
scripts on `globalThis.Chip` / `globalThis.Temas`). The lobby's `sonido.js`,
Mina Club, Snake and Circuit Breakers all play through the same
`Chip.Reproductor`, so the whole room sounds like one console instead of four
radios. `Reproductor` reads `tempo` on every step, which is what lets
`ajustarMusica({tempo, capas})` speed a song up mid-bar; `ambientar()` resets
that adjustment whenever the theme changes, so one game's hurry never leaks
into the next. `tests/temas.test.cjs` checks every theme compiles, that its
section lengths are whole bars, and that no note is silently dropped.

**The header's ♪ button is a player, not a mute** (`reproductor.js` over
`CANCIONES` in `sonido.js`). Every song in the house is in one repertoire,
grouped by mood (`GRUPOS`): the games' own themes, plus six more written
for the list — *Sobrecarga* (drum'n'bass) and *Tormenta* (boss fight) under
Intensas, *Neón 84* (synthwave) and *Pulso de datos* (techno with sidechain
pump) under Electrónicas, *Turno de noche* (lo-fi with an 808, in the vein of
Schedule I's soundtrack) and *Cumbia de la mesa* under Chill y fiesta. Those
needed the chip to grow a low-pass filter, sidechain pump, detune, glide and
an 808 kick with claps. The **Pokémon** group holds eight tributes to
FireRed/LeafGreen (`pk-*` in `temas.js`): town, route, Center, forest, bike,
wild battle, trainer battle and gym. **Their melodies are original on
purpose**, and only the GBA timbre and the mood of each place are borrowed.
Transcribing the real ones, even out of a public decompilation, would publish
Nintendo's compositions on an open site, so don't "fix" them into the real
tunes. **Automático** (the default) keeps the old behaviour,
one song per game and silence in the lobby. Picking a song makes it play
everywhere, lobby included, until you go back to Automático. The choice,
the list mode (repeat / in order / shuffle) and the volume persist in
`localStorage` (`jg.cancion`, `jg.modoLista`, `jg.volumen`). A song's end is
seen through `Reproductor.vueltas` for the chip and a backwards jump of
`timeupdate` for a recording. `ambientar(null)` means "this screen brings its
own music" (Circuit Breakers' frame). `PROPIAS` maps the game's name to that
same `null`, because `juegos-main.js` re-ambients every room by name on each
repaint and was overwriting the frame's request. The panel hangs off `<body>`
in `position:fixed`, like the rules manual, and while open it only retouches
classes and texts on each `alCambiarMusica`, so the volume slider keeps the
finger mid-drag.

**A theme may be a recording instead** (a `CANCIONES` entry with a `url`): Flip 7, Cacho and UNO play
"Poker Night" by Zane Little (OpenGameArt, CC0) from `juegos/audio/`, looped by
hand at `fin` (124.3 s) through `timeupdate` because the file's tail is
silence. The chip version of a table game sounded thin, and a lounge track is
what the room was missing. The hurry-up reaches it through `playbackRate`.
The same file also carries **sampled effects** (`MUESTRAS`: Kenney's Impact
Sounds and Casino Audio, both CC0) — knuckles on wood for `madera`, a card
sliding for `reparte`. They are fetched when the flip7 theme starts
(`cargaMuestras`) and `muestra()` falls back to the synth until they decode, so
the first card of a room is never silent.

**The endgame speeds the music up.** `progreso(est, juego)` in `motor.js`
returns how far the board is (boxes drawn, squares filled, stars taken, rounds
won — 0 outside `jugando`), and over the last 30 % `juegos-main.js` ramps the
tempo up to +12 %: the arcade "hurry up". The cartas figure is an estimate on
purpose, since five rounds of one colour make no trio.

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

**The ranking is written by each player about themselves.** `ranks/<juego>/<uid>`
is the only row a browser may touch, so the table is the sum of what each one
noted about itself. That has a price, said out loud on the page: whoever closes
the tab before the game ends does not record it. What it does *not* allow is
inventing victories — the rules check that `ultima` names a game that exists,
has finished, is of that game, and has the writer in it, that it is not the one
already counted, and that `jugadas` goes up by exactly one. Three points for a
win and one for a draw, because ordering by wins alone ranks whoever plays
most.

**The Clasificación is a stage, not a table** (`ranks.js`): a 2-1-3 podium with
metal blocks, a crown over the first, and under it a card that tells *you* what
you need — how many points (and wins) to reach the podium, to pass the next
one, or how far ahead you are if you already lead. The table stays below for
everyone else. The entry animation plays **once per game** (`animado` holds
the key) and the scene repaints by signature (`firma`), because `watchRanks`
fires on every write and replaying the rise each time would make it twitch.

**The Clasificación opens on a General table** (`ranks.js`, key `general`):
the sum of every room game's `ranks` row (points, wins, games played, and a
«Juegos» column counting in how many games each person has a row), read
through `fb.watchRanksTodos`. The picker lists the games in the lobby's
popularity order, room games and solo games under separate labels, and the
choice persists in `jg.rankJuego`. The lobby's featured card carries that
game's top three (`pintaDestacado`, from the `ranks` that
`leerPopularidad()` now returns alongside the counts as `{n, ranks}`).

**Logros: ten per game, three sources, one table** (`juegos/logros.js`,
the view in `logros-vista.js`, the **Logros** tab at `#logros`). Four of
every room game's ten are **derived from its `ranks` row** (first win, ten
wins, a streak of three, 25 games) and the ten of each solo game from its best
`soloRanks` marks (`deMarca`); neither is ever written, so they are
retroactive and cannot disagree with the tables they come from. The other six
of a room game are detected **live on every repaint** (`detecta`) — `hist` is
a short window, so waiting for the end would miss what happened early — and
written once to `logros/<juego>/<uid>/<id>` (a timestamp; the rules refuse a
rewrite or a delete). A logro may name a mode (`m`) but belongs to the game.
`reparto` joins the three reads; the percentage is over people who have played
that game, not over the whole site. The tab opens on a *desafío*: the most
common logro you lack, the person just ahead and one of theirs you lack, and
the rarest logro anyone holds. The `logros` node needs the rules re-published.
`tests/logros.test.cjs` checks ten unique ids per game and that the rules'
whitelist names every room game.

**Coins 🪙 are computed, never stored** (`juegos/monedas.js`, pure; the
view in `monedas-vista.js`, the **🪙 Monedas** tab at `#monedas`, a
*Top monedas* box in the lobby's sidebar and your balance in the header).
A stored balance would be a number anyone with a console could rewrite. A
sum of things the rules already check cannot be. So, like the fila and solo
logros, the balance is derived from the same four reads the profile uses
(`fb.watchLogros`, now also listening to `diario`, through `datosPerfil`):

- **Room games** (`ranks`): `TARIFA` 5 per game, 15 per win, 5 per draw,
  times the game's `PESO` (1 for a short duel up to 2.5 for Catan).
- **Club records** (`soloRanks`): `RECORD[club]` once per modality with a
  mark, so improving a mark never pays twice and the easy game cannot be
  farmed. On top of the record: BBTAN pays ⌊n/4⌋ for every round n up to
  the record (`monedasBbtan`, closed form, capped at round 1000: reaching
  round 5 pays 2, round 100 pays 1 225), sortEm pays the mode's blocks
  plus 2 per second under 3 s per block (`monedasSortem`), and the Sopa and
  Electrodle streaks 10 per day.
- **Club plays** (`clubJugadas/<uid>/<juego>` = `{dia, hoy, total, at}`):
  every club game that ends with a result pays `PAGO_CLUB` (8), up to
  `TOPE_CLUB_DIA` (10) per game per Chile day. `marcaJugadaClub` in
  `juegos-main.js` writes it from `alResultado`, chained so two results do
  not read the same counter; the rule recomputes exactly what
  `registraJugadaClub` does (today only, `total` up by one, `hoy` ≤ 10).
- **Podiums** (`podios/<uid>/<partida>` = `{c, p, q, at}`): taking the
  1st, 2nd or 3rd place of a club table (or a Yemas zombies one) from
  *someone else* pays 500, 250 or 100 (`PODIO`), every time it happens.
  `guardaConPodio` writes it right after the record transaction commits,
  when the place improved to 1–3 and someone else held it; the rule demands
  that `soloRanks/<c>/<uid>/partida` is the claim's key, so there is one
  claim per record write. `podioValido` re-checks that both have a row in
  that table and that it is not oneself. Club marks are client-claimed
  (the honest limit of every solo game), so this is no weaker than them.
- **Logros**: by difficulty. `NIVEL[juego]` is one digit 1–4 per logro, in
  `LOGROS[juego]` order (room games start with the fila's four, `F`), worth
  `VALOR_NIVEL` 15/40/100/250. A new logro needs its digit, and
  `tests/monedas.test.cjs` fails if a game's string does not match its list.
  This is the big pot on purpose: hard things pay most.
- **Days played** (`diario/<uid>` = `{dia, racha, mejor, dias, bono, at}`):
  the only thing written. `marcaDia()` in `juegos-main.js` runs once per
  Chile day after a room game is recorded or a club result arrives.
  `registraDia` pays `pagoDia(racha)` = 10 + 5 per streak day, capped at 50,
  and the rule recomputes exactly that from the previous record. `dia` is
  the Chile date as a day number, because rules can compare numbers with
  `now` but cannot format dates. The rule accepts it inside a 25-hour window
  that covers UTC−3 and UTC−4. So a client can only record *today*, once,
  with the right streak and sum. Deleting the node only loses coins.

Coins are spent in PRODROP (below), and that spending **is** stored:
`monedasDe` returns `total` (earned, `ganadoDe`), `gastadas`, `cobradas`
(market sales) and `saldo`. **The header chip and the top both show
`saldo`**: the top used to order by `total`, and the mismatch with the
header read as "the top is not updating". `datosPerfil` hands every node
`watchLogros` reads (`Object.assign({}, d)`), not a hand-picked list: a
list that forgot `mercado` silently ran the economy without the market.
The streak is shown loudly: a card in the lobby's coins box and on the
coins page (`rachaHtml`: days, today counted or not, what tomorrow pays,
seven bars), a 🔥N next to the header balance that blinks while today is
still missing, and a toast when the day is recorded (`avisaMonedas`, the
same queue as the logros toast, also used for club plays and podiums).
The `diario`, `clubJugadas` and `podios` nodes need the rules re-published.
`test-rules.mjs` covers it: no invented streak, no tomorrow, no twice a day,
and nobody writes someone else's.

**PRODROP is a card-pack opener paid in coins** (`juegos/prodrop/`, its
own document in an iframe like Clue: `index.html`, `style.css`, `app.js`,
the 153 webp cards in `cards/<rareza>/`, and `motor.js`, UMD on
`ProdropMotor`, shared with the page and the tests). `#cartas` (tab 🃏
Sobres) mounts it full-window (`html.jg-prodrop`, like sortEm), and
`colabtex/src/juegos/prodrop.js` (`crearProdrop`) is the postman: it sends
the account (`datos`: saldo, packs, graded, exhibited) whenever it changes
and does the three writes the frame may ask for (`comprar`, `graduar`,
`exhibir`), one at a time. The frame never touches Firebase. Plain files,
no build: bump `?v=pd-N` on its two scripts/stylesheet and in `prodrop.js`.
The cards are real people (teachers), served from the public repo like any
other file of the site. Things that hold it together:

- **A pack is derived, not rolled.** `cartas/s/<uid>/<push key>` = `{at,
  p}`, and the rule demands `at === now`. The five cards (and each one's
  hidden grade and wear seed) are `sobre(uid, key, at)`: SHA-256 of that,
  seeding xoshiro128**, with integer weights (ten-thousandths for rarity,
  thousandths for grade), so every browser rebuilds the same pack. The
  buyer cannot pick the server's millisecond, so cannot pick the contents,
  and anyone can verify anyone's legendary. The grade was decided at
  purchase; grading only reveals it.
- **Odds** (`TIERS`, `GRADE_W`, `DIOS`): 80 / 17.4 / 2.4 / 0.2 % per card,
  the fifth card rare or better, and 2 % god packs (five epic or better, at
  most one legendary: after the first legendary the rest are epic).
  `ESPERADO` is the exact expected count of each rarity per pack, and
  `probabilidad(id, g)` is what grading announces: a card of this rarity
  or better with this grade or more, per card and per pack, plus this
  exact card with that grade. `tests/prodrop.test.cjs` simulates 60 000
  packs against those numbers.
- **Prices live in the rule too.** `p === (now < 1791169200000 ? 50 : 80)`
  (launch price through 4-10-2026, until 5-10 00:00 Chile, `PRECIO.promoHasta`) and
  grading `cartas/g/<uid>/<key>/<i>` = `{at: now, p: 100}`, only for a pack
  that exists. Both write-once, never deleted: they are the spending. The
  test pins the rule's timestamp to the motor's.
- **Everything that moves coins or cards is one replay: `economia(datos)`**
  (monedas.js, memoised per `datos` object). It walks, in server-time
  order (ties: pack, grading, listing, withdrawal, sale, trade), packs
  (`cartas/s`), gradings (`cartas/g`), market listings and sales
  (`mercado/o`) and accepted trades (`mercado/t`), and produces who owns
  every copy (`dueno`), which copies are graded or listed, which packs are
  valid, and per account `gastadas`, `cobradas` and `parada`. A copy is
  named `<origin uid>~<pack key>.<i>`: the pack (so the card, its hidden
  grade and wear) belongs to whoever bought it, the copy can change hands.
  `monedasDe` = earned from games (`ganadoDe`) + `cobradas` − `gastadas`.
- **The balance can never go negative, and nothing is bought without
  money.** The rules cannot add up what was earned, so they cannot refuse
  an unfunded write from a modified client; the replay does not trust the
  writes instead. A spend (pack, grading, market purchase) counts only if
  the account is not stopped and the balance covers it; the first one that
  does not fit is void (what it bought does not exist) and **stops** the
  account from there on: none of its later actions count until its
  earnings cover the gap. Stopping, rather than skipping, is what keeps
  the accepted set growing monotonically as earnings grow. A void sale
  leaves the card with the seller and closes the listing (`impaga`). On top
  of that the frame disables the buttons and the postman re-checks every
  action against the complete read (`watchLogros` sets `completo` once all
  six nodes arrived), one at a time, so an honest client never writes an
  unfunded spend. Honest screens never offer listings or trades with a
  stopped account, which is what keeps a stopped account's later
  un-stopping from rewriting anyone else's history.
- **A free pack every 6 hours** (`p: 0`): written together with
  `cartas/gratis/<uid>` = `{at, k}` in one multi-path update; the rule on
  `gratis` demands 6 h since the previous one and that the pack it names is
  this `p: 0` pack, and the rule on the pack demands that `gratis` names it.
  The replay re-checks the spacing (`proximoGratis`).
- **The market** (`mercado/o/<id>` = `{u, c, p, at}`, price 1–100 000 set by
  the seller). `x` (withdrawn, by the seller) and `v` (`{u, at}`, bought,
  by anyone else) are each write-once and exclude each other in the rules,
  so a listing has at most one buyer. The replay accepts a listing only if
  the seller owns the copy and it is not already listed; a listed card
  cannot be graded or traded. The frame's market (🏪 Mercado) has three
  tabs: *Comprar* (filters: rarity, graded / ungraded, minimum grade only
  when graded, sort by price or newest, search by name), *Mis ventas* (my
  listings and purchases) and *Intercambios*. *Comprar* shows the seller's
  own listings too, tagged «Tu oferta» (opening one offers Retirar): hiding
  them made sellers think the listing never reached the store. A sale or a
  withdrawal is marked in the frame at once (`marcaVenta`/`quitaVenta`)
  rather than waiting for the next `datos`, so the card cannot be offered
  for sale twice in between, and the postman withdraws a listing that the
  replay does not accept as `activa` right after writing it.
- **Trades** (`mercado/t/<id>` = `{de, para, dar[1–3], pedir[0–3], at}`):
  `ok` (only `para`) and `x` (either) are write-once and exclusive, and the
  rules forbid creating one already accepted. The swap happens at `ok` if
  both still own their cards, none is listed and neither is stopped.
- **Grading** is `cartas/g/<grader>/<pack key>/<i>` with `o` (the origin)
  when the pack is someone else's: whoever owns the copy grades it, and
  the grade travels with it. There is no "grade the whole pack" button on
  purpose: it made people spend 500 coins by accident.
- **The collection comes from the replay**, not localStorage: the postman
  sends `mias` (copies owned now, including bought or received ones), the
  active listings, my sales and trades, and the cards of everyone else for
  the trade composer. The pack being opened stays out of the collection
  (`abriendo`) until the summary; a pack bought and not opened is
  remembered in `localStorage` (`prodrop.pendiente.<uid>`) and resumed.
- **One, two or three packs open together** (`cantidad`, the ×1/×2/×3
  control above the buy button and in the summary, kept in
  `localStorage` as `prodrop.cantidad`). They are bought one after another,
  each checked by the postman; if the money runs out halfway, the ones that
  went through are opened. The extra packs are decoration fanned behind the
  main one (`pintaExtras`); tearing the main one opens all of them. The
  cards go into one stack (`_sobre` says which pack each came from, and the
  banner says so). The summary has one row per pack, scrolls, and on a
  phone fits five cards to a row. `abriendo` is a Set of pack keys, and the
  unopened-pack resume in `localStorage` holds a comma list. After the
  opening, the pack's fall, its torn top and its light are **cancelled** once
  it is hidden. Left «filling», Chrome retired them on its own and kept their
  last frame. «Abrir otro sobre» then showed the next pack fallen off-screen,
  with no top.
- **Re-roll** (CS2's trade-up contract): ten copies of one rarity (común,
  rara or épica) become one of a higher rarity, any card of it with equal
  chance. Usually the next one: `SALTO_W[tier]` (ten-thousandths, one row
  per input rarity) makes común go to rara / épica / legendaria 92 / 7.5 /
  0.5 %, rara to épica / legendaria 96 / 4 %, and épica always legendary. The jump has its own hash stream
  (`"prodrop-salto:" + key`), so card and grade come from the same stream
  as before, and it applies only from `SALTOS_DESDE`: a reroll written
  earlier keeps the card it already gave. `probSalida(tier)` is what the
  panel shows. It is `cartas/r/<uid>/<push key>` = `{at: now, c: [ten copy
  keys]}`, write-once and free. Like a pack, the result is derived, not
  rolled: `PM.reroll(uid, key, at, tier, notas)` hashes all of that into
  `{id, g, w}`. Its hidden grade is a bell centred on the ten inputs'
  average **plus one** (`REROLL.bono`), σ 1.3. For 5 4 6 4 9 8 8 5 3 2,
  the average is 5.4 and the result is 6 or 7 57 % of the time. The bell is
  an integer table (`PESO_REROLL`, distance to the centre in tenths),
  because `Math.exp` is not bit-identical across browsers. `economia`
  accepts it (event `r`, between gradings and listings) only if the account
  is not stopped and the ten are its own, distinct, not listed and of one
  rarity below legendary. The ten leave `dueno`, and the new copy is
  `<uid>~<key>.0`, registered in `e.sobres` with `r: {id, g, w}`. Every
  reader of `sobres` branches on `r`: `copiasDe`, the postman's `copia`, and
  `prodrop-cartas.js`'s `copia`, `mejoresDrops` (which marks it `rr`) and
  `cifras` (which skips it). Copies sent to the frame carry `rr: {id, g, w}`, and
  the frame's `copiaDe` uses it instead of `M.sobre`. Not a top-level `id`:
  a market row is the copy plus the listing, whose `id` is the offer's, and
  that made every listing read as a re-roll and broke the market. The grading rule
  accepts `cartas/r` packs at index 0. The frame's panel (`#reroll`) picks
  the ten («Elegir automático» takes duplicates first, keeps the best copy
  of each card and leaves exhibited ones for last) and asks twice before
  sending. It shows the expected-grade bell only when all ten are graded:
  hidden grades stay hidden. The roulette (`#ruleta`, z-index 29, under the
  effects canvas) is a strip of 100 cards, mostly of the next rarity with
  some higher ones mixed in (78/18/4 %), with the winner at index 90. It
  runs right to left for 10.8 s on `cubic-bezier(.05,.68,.1,1)`, ticks each
  time a card crosses the marker (read off the live transform), and lands
  slightly off-centre on purpose. **⚡ Rápido** (`prodrop.rrRapido` in
  `localStorage`, in the panel and on the roulette) makes it 42 cards in
  2.6 s; pressing it mid-spin sets the running animation's
  `playbackRate` to 4. A jump of two or more tiers shows «¡SALTO!».
- **Exhibited cards** are `users/<uid>/perfil/cartas` (up to four copy keys
  `o~k.i`, or the old `k.i` meaning one's own pack; validated by regex in
  the rules), shown only while that account still owns the copy, toggled from the card's zoom. The
  profile editor does not know them, so `editaPerfil` carries them over or
  saving the profile would erase them. They show on the profile page and
  the mini card through `exhibidasDe`, which only resolves keys that are
  packs of that account.
- **Últimos drops** (`#vesDrops`, a horizontal strip right under
  Novedades, grid area `tira`): `mejoresDrops` lists epics and legendaries
  of valid packs only, in the order they came out (newest first), with who
  pulled them and when.

The `cartas` and `mercado` nodes and `perfil/cartas` need the rules re-published.

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

### Security model (what the rules can and cannot hold)

The Firebase config is public by design; everything rests on the rules, so
each new node must be written assuming a stranger with a console. What the
October 2026 pass settled, and must not regress:

- **A share token can only carry `edit` or `view`** (`tokenIndex/$token`
  `.validate`). The member rule accepts any role a token names, so without
  that an editor could mint an `owner` token and join with it.
- **`users/<uid>` is owner-only; only `users/<uid>/perfil` is public**, and
  every field there is validated (`$otro: false`). Uids are visible in every
  game room, so a world-readable `users/` leaked everyone's email. The email
  is no longer written (`ensureUserRecord` sends `email: null`), and no name
  falls back to `user.email`.
- **Colour and photo are sanitised on read** (`juegos/sano.js`, applied in
  `fb-juegos.js` to rooms, lobby, ranks and profiles) because a hundred places
  interpolate them into HTML strings unescaped: `style="--c:${color}"`. The
  rules allow only `#rrggbb` and clean `https://` (plus a JPEG/PNG/WebP
  data URL in a profile), but rules lag behind publishing and old data stays.
  Read-side cleaning is what covers both. A new field that is painted into
  markup belongs in `sanea`.
- **Privileges live in `admins/<uid>`**, readable by its owner and writable
  by nobody from the web (set by hand in the console). Admins delete errors
  and change other people's feedback state (`esAdmin` in `fb-reports.js`;
  Informes hides ✕/✓ for everyone else).
- **`discord/` stays readable by anyone signed in, on purpose.** The owner
  wants every room announced without keeping a list of people, and accepted
  the risk: anyone with a session can copy the webhook and spam the channel.
  The remedy is swapping `discord/webhook` in the console. A `confianza/<uid>`
  allowlist was tried and dropped for that reason.
- **Storage cannot see the database**, so it cannot check membership. Each
  object carries `customMetadata.uid` (`sube` in `fb-api.js`) and only its
  uploader may replace or delete it; HTML/JS content types are refused.
  Overwriting someone else's file falls back to the base64 copy in RTDB
  (≤ 3 MB). Older objects without the mark stay open. Uploading over an
  existing object is evaluated as `create`, not `update` (`update` is a
  metadata-only change; verified in the emulator), so the owner check has to
  live in `create` too.
- **App Check is wired but off** (`APP_CHECK_SITE_KEY` in `firebase.js`).
- Inherent limits, stated in `CONFIGURAR-FIREBASE.md` section 0: a player can
  write `fin` for a game they are in, chat and feedback can be spammed, and
  `clueElenco` and `discord/` are readable by anyone signed in.

`tests/seguridad.test.cjs` checks the sanitiser and pins those rule shapes.

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
