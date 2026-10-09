# CSV·Scope — notes for Claude

`CSV Oscilloscope.dc.html` + `scope-engine.js` (root). No build step; bump the engine's `?v=` by hand. Written in **English** (UI and comments).

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

**The IEEE 519 limits are drawn behind the harmonic bars** (*Limits* under
*Distortion · IEEE 519*, `IEEE519`, `ieeeInfo`, `drawIeeeBackdrop`). Current
limits are Table 2 by I_SC/I_L, voltage ones Table 1 by bus voltage. Four
things it settles:

- **The reference is I_L**, the standard's own denominator, and the measured
  I₁ when I_L is empty (the "% of I₁" figure many papers plot), which the
  key on the plot says. Voltages always use the measured V₁. The limit is
  converted into whatever unit the bars show (peak, rms, % of f₁).
- **The shaded step is the odd-order envelope**; an even order's own limit
  (25 % of its band) is a dashed mark in its slot. Drawing it into the
  outline made a saw that hid the bands. Above n = 50 the standard says
  nothing, so that zone is greyed out with "(n > 50)", not left unlimited.
- **With the limits on, the scale follows the harmonics and the limits**,
  not the fundamental, which is cut with a break mark and its value written
  beside it: at 100 % it flattened a 4 % limit onto the floor.
- **An order is over only past its limit by more than 1e-4 relative**, so a
  harmonic exactly on it (2.0000 %) is not flagged by rounding. The TDD/THD
  the standard judges is summed up to n = 50, whatever the harmonic count.
