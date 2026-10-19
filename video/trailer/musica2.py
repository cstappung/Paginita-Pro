# Banda sonora del tráiler: 120 BPM, La menor, 25 compases (50 s). Todo sintetizado.
import numpy as np, wave, sys
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
BARS = 42; N = int(SR * BAR * BARS)
rng = np.random.default_rng(7)
mixL = np.zeros(N); mixR = np.zeros(N)

def t_of(bar, beat=0.0): return (bar * 4 + beat) * BEAT
def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    mixL[i:j] += s * (1 - max(0, pan)); mixR[i:j] += s * (1 + min(0, pan))

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * H, len(x))

def env(n, a=0.005, d=0.2, sus=0.0, rel=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * (sus + (1 - sus) * np.exp(-t / d))
    if rel: e *= np.clip((n / SR - t) / rel, 0, 1)
    return e

def saw(freq, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR; return 2 * ((t * freq * (1 + detune) + phase) % 1) - 1

def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 120 * np.exp(-t / 0.035); ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-t / 0.22); k[:200] += rng.normal(0, .5, 200) * np.linspace(1, 0, 200)
    return np.tanh(k * 1.8)
def clap():
    n = int(0.3 * SR); x = rng.normal(0, 1, n)
    e = np.zeros(n)
    for o in (0, 0.012, 0.024): i = int(o * SR); e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if o < .02 else 0.12))
    return fft_filter(x * e, lo=900, hi=7000) * 0.9
def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR); x = fft_filter(rng.normal(0, 1, n), lo=7000)
    return x * np.exp(-np.arange(n) / SR / (0.08 if open_ else 0.012))
def impact():
    n = int(2.5 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t / 0.15)) / SR) * np.exp(-t / 0.7)
    noise = fft_filter(rng.normal(0, 1, n), hi=3000) * np.exp(-t / 0.35) * 0.5
    return np.tanh((boom * 1.4 + noise) * 1.3)
def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.normal(0, 1, n); out = np.zeros(n); blk = 2048
    for i in range(0, n, blk):
        p = i / n; seg = x[i:i + blk]
        out[i:i + blk] = fft_filter(np.pad(seg, (0, blk - len(seg))), lo=300 + 6000 * p ** 2, hi=1200 + 12000 * p ** 2)[:len(seg)]
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1600 * (t / dur) ** 2) / SR) * 0.25
    return (out * 0.6 + tone) * (t / dur) ** 1.6
def whoosh():
    n = int(0.35 * SR); t = np.arange(n) / SR
    return fft_filter(rng.normal(0, 1, n), lo=1500, hi=9000) * np.sin(np.pi * t / t[-1]) ** 2 * 0.5

NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]   # Am F C G
ROOT = [45, 41, 48, 43]

def pad(chord, dur, bright):
    n = int(dur * SR); x = np.zeros(n)
    for m in chord:
        for d in (-0.008, -0.003, 0.0, 0.004, 0.009): x += saw(NOTE(m), n, d, rng.random())
    x = fft_filter(x, hi=bright) / 12
    return x * env(n, a=0.05, d=99, sus=1, rel=0.08)
def bass(m, dur):
    n = int(dur * SR); x = saw(NOTE(m), n) + 0.6 * np.sin(2 * np.pi * NOTE(m - 12) * np.arange(n) / SR)
    return fft_filter(x, hi=500) * env(n, a=0.004, d=0.18, sus=0.5, rel=0.03) * 0.6
def pluck(m, dur=0.22):
    n = int(dur * SR); x = saw(NOTE(m), n) + saw(NOTE(m), n, 0.006)
    return fft_filter(x, hi=3500) * env(n, a=0.002, d=0.08) * 0.22

# Secciones por compás (2 s): ver SECC
SECC = {}
def sec(a, b, k):
    for x in range(a, b): SECC[x] = k
sec(0, 2, 'intro'); sec(2, 4, 'sube'); sec(4, 12, 'drop'); sec(12, 16, 'hero'); sec(16, 20, 'groove')
sec(20, 22, 'juego'); sec(22, 24, 'tension'); sec(24, 28, 'groove'); sec(28, 32, 'latido'); sec(32, 36, 'drop2'); sec(36, 42, 'final')
duck = np.ones(N)
def sidechain(t):
    i = int(t * SR); n = int(0.3 * SR); j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.75 * np.exp(-np.arange(j - i) / SR / 0.09))
music = np.zeros(N)
def addm(sig, t, g=1.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < N: music[i:j] += sig[: j - i] * g
def golpes(bar, beats=(0, 1, 2, 3), g=0.95):
    for b in beats: add(kick(), t_of(bar, b), g); sidechain(t_of(bar, b))
def hats(bar, g=1.0):
    for s in range(16): add(hat(open_=(s % 4 == 2)), t_of(bar, s / 4), (0.22 if s % 2 else 0.1) * g, -0.3 if s % 4 == 2 else 0.25)
def bajo(bar, c):
    for e in range(8):
        if e % 2: addm(bass(ROOT[c], BEAT / 2 * 0.95), t_of(bar, e / 2), 1.0)
def arpegio(bar, c, g=1.0):
    arp = PROG[c] + [PROG[c][0] + 12]
    for s in range(16): addm(pluck(arp[(s * 3) % 4] + 12), t_of(bar, s / 4), g)
for bar in range(BARS):
    c = bar % 4; t0 = t_of(bar); k = SECC.get(bar, 'final')
    if k == 'intro': addm(pad(PROG[c], BAR, 700), t0, 0.7)
    elif k == 'sube': addm(pad(PROG[c], BAR, 1200 + 900 * (bar - 2)), t0, 0.8); golpes(bar, g=0.6)
    elif k in ('drop', 'drop2'):
        addm(pad(PROG[c], BAR, 4200), t0, 0.55); golpes(bar); hats(bar); bajo(bar, c)
        for b in (1, 3): add(clap(), t_of(bar, b), 0.55, 0.05)
        if k == 'drop2' or bar >= 6: arpegio(bar, c, 1.0 if k == 'drop2' else 0.75)
    elif k == 'hero': addm(pad(PROG[c], BAR, 600), t0, 0.25)   # aquí suena la canción de PRO HERO encima
    elif k == 'groove':
        addm(pad(PROG[c], BAR, 2600), t0, 0.5); golpes(bar); bajo(bar, c)
        for s in range(8): add(hat(), t_of(bar, s / 2 + 0.25), 0.16)
        for b in (1, 3): add(clap(), t_of(bar, b), 0.45)
    elif k == 'juego':
        addm(pad(PROG[c], BAR, 2000), t0, 0.5); golpes(bar, (0, 2))
        for s in range(8): addm(pluck(PROG[c][s % 3] + 12 + (12 if s % 4 == 3 else 0), 0.3), t_of(bar, s / 2), 0.9)
    elif k == 'tension':
        addm(pad(PROG[c], BAR, 900 + 1500 * (bar - 22)), t0, 0.7)
        for s in range(8 if bar == 22 else 16): add(kick() * 0.6, t_of(bar, s / (2 if bar == 22 else 4)), 0.35 + 0.3 * s / 16)
    elif k == 'latido':
        addm(pad([45, 48, 52], BAR, 500), t0, 0.6)
        for b in (0, 0.35, 2, 2.35): add(kick() * (0.9 if b in (0, 2) else 0.6), t_of(bar, b), 0.8)
    elif k == 'final':
        if bar == 36: golpes(bar, (0,))
        if bar == 37: golpes(bar, (0,))
# risers, impactos y barridos
add(riser(BAR * 2), t_of(2), 0.45); add(riser(BAR), t_of(11), 0.4); add(riser(BAR), t_of(15), 0.45)
add(riser(BAR * 2), t_of(22), 0.5); add(riser(BAR * 2), t_of(30), 0.6)
for b in (0, 4, 12, 16, 24, 32, 36): add(impact(), t_of(b), 0.9)
for b in (2, 3, 20, 28): add(impact(), t_of(b), 0.45)
for bar in list(range(4, 12)) + list(range(32, 36)):
    for b in (0, 2): add(whoosh(), t_of(bar, b) - 0.12, 0.25, (-1) ** b * 0.4)
# silencio antes del #1 nuevo (justo antes del compás 32): se recorta la mezcla
fin = pad([57, 60, 64, 69], BAR * 3, 3000) * np.exp(-np.arange(int(BAR * 3 * SR)) / SR / 2.0)
addm(fin, t_of(37), 1.0)
music *= duck
L = mixL + music; R = mixR + music
R[441:] += music[:-441] * 0.25
corte = (int(t_of(31, 3.5) * SR), int(t_of(32) * SR))
L[corte[0]:corte[1]] *= 0.05; R[corte[0]:corte[1]] *= 0.05
out = np.stack([L, R], 1)
out /= np.max(np.abs(out)) * 1.05
out = np.tanh(out * 1.6) / np.tanh(1.6)
fade = int(0.02 * SR); out[:fade] *= np.linspace(0, 1, fade)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32000).astype('<i2').tobytes())
print('ok', N / SR, 's')
