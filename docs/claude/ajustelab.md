# AjusteLab — notes for Claude

`Ajustes.dc.html` + `ajuste-engine.js` (root). No build step; bump the engine's `?v=` by hand.

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
