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
  `colabtex/src/juegos-main.js`) — nine turn-based games, on the same Google
  account and the same Firebase project: **Escondite** (hide a person in a
  landscape, then cross the landscapes and race to find the other's),
  **Cartas de los tres elementos** (a Card-Jitsu duel), **Cuadritos** (dots and
  boxes, two to ten players and three board sizes), **Reversi**, **Órbita**,
  **Chain Reaction** (critical-mass orbs that burst into their neighbours, two
  to eight players and three grid sizes), **Flip 7** (the push-your-luck card
  game, two to ten players, Normal, Vengeance and Super Vengeance), **Cacho**
  (the Chilean liar's dice, *dudo* mode, two to eight players, with the
  optional *partida siciliana*) and **Circuit Breakers** (a Worms-style artillery game for two to eight squads, in an
  iframe), plus a
  **Clasificación** tab. See "Juegos" below.

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

Nine turn-based games, on the same Firebase project and the same Google session
as ColabTeX and ColabDraw. Turn-based on purpose: with one move per turn the
network carries a handful of fields and there is nothing to interpolate, so no
game loop ever has to be synchronised.

**How many people fit is a property of the room, not of the game.** `JUEGOS`
declares `minimo` and `cupo` (escondite, cartas and reversi are duels by
construction — two landscapes, one clash, two colours), and whoever opens the
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
and órbita), and the star just taken in órbita wears `.jg-estrella.ultima`.

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
`juegos/cartas/` are full card faces, so the old drawn chrome is gone; with 36
images against a 216-card deck the element cannot come from the art, so it is
carried by the `.jg-arte` inset ring and the `.jg-c-palo` label. The box is
76×112 to match the files' own 164:242, and `precarga()` pulls all 36 in the
background — a card that arrives while it is being flipped reads as a glitch.
Winning with a 10, 11 or 12 fires `efectoGolpe` and a tie fires `efectoHumo`,
both absolutely positioned over `.jg-choque` (which is `position:relative` for
exactly that) with per-particle `--a`/`--r`/`--x`/`--d`/`--s` custom properties;
the `"choque" + ult.n` repaint signature is what guarantees one firing per round
instead of one per repaint.

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
  `flip7.js`, `cacho.js`, `ranks.js` — one screen each.
- `sonido.js` — the WebAudio synth and the mute flag. No DOM beyond the header
  button's state, no Firebase.
- `perfil.js` — the profile editor: `COLORES`, `mezcla` (ficha + perfil → what
  is painted, pure and verifiable in Node), `recorta` (the browser-side 96×96
  centre crop to a JPEG data URL, which is what keeps the photo at ~10 kB) and
  `abrePerfil`, the modal.
- All of them expose the **same shape**: `crearX(ctx)` with
  `ctx = {uid, pid, jugar, terminar, ahora}`, returning
  `{montar(hostEl), actualizar(partida, estado), destruir()}`. Adding a fifth
  game is a file and a row in `JUEGOS`. `ranks.js` is the exception —
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
  the round is *obligada*; going to aces needs `⌊c/2⌋ + 1`, coming back from
  them `2c + 1`, and opening on aces is only allowed with one die left.
  **Obligar** (once per game, with one die, three or more players left) turns
  aces into a plain face for that round. **Calzar** (claiming the bet is
  exact) is allowed while at least half the initial dice are still on the
  table, or to whoever holds one die; right wins a die back (up to five),
  wrong loses one. The next round opens with whoever lost, with whoever calzó
  after a calzo, and with the same opener after an annulled round — an
  abandono mid-round annuls it, since that player's cup can never be
  uncovered.
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

**The music is one songbook** (`juegos/audio/chip.js` + `temas.js`, plain
scripts on `globalThis.Chip` / `globalThis.Temas`). The lobby's `sonido.js`,
Mina Club, Snake and Circuit Breakers all play through the same
`Chip.Reproductor`, so the whole room sounds like one console instead of four
radios. `Reproductor` reads `tempo` on every step, which is what lets
`ajustarMusica({tempo, capas})` speed a song up mid-bar; `ambientar()` resets
that adjustment whenever the theme changes, so one game's hurry never leaks
into the next. `tests/temas.test.cjs` checks every theme compiles, that its
section lengths are whole bars, and that no note is silently dropped.

**A theme may be a recording instead** (`GRABADAS` in `sonido.js`): Flip 7 plays
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
