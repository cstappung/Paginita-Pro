# FiltroLab — notes for Claude

`Filtros.dc.html` + `filtros-engine.js` (root). No build step; bump the engine's `?v=` by hand.

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
