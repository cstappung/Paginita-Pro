# Banda sonora del tráiler v3: 120 BPM, La menor, 56 compases (112 s). Todo sintetizado.
import numpy as np, wave, sys
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
BARS = 56; N = int(SR * BAR * BARS)
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


def ding(f0, dur=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f0 * m * t) * a for m, a in ((1, 1), (2.76, .4), (5.4, .2)))
    return x * np.exp(-t / 0.12) * 0.25
def monedas(t0, dur, dens, g=1.0, sem=1):
    r = np.random.default_rng(sem)
    for i in range(int(dur * dens)):
        fx(ding(r.choice([1568, 1760, 2093, 2349, 2637, 3136]) * (1 + r.normal(0, .01))), t0 + r.random() * dur, 0.35 * g * (0.6 + 0.4 * r.random()), r.uniform(-.6, .6))
def jackpot(t0, g=1.0):
    for i, m in enumerate([72, 76, 79, 84, 88, 91, 96]): fx(ding(NOTE(m), .9), t0 + i * 0.07, 0.7 * g)

# Secciones por compás (2 s): ver SECC
SECC = {}
def sec(a, b, k):
    for x in range(a, b): SECC[x] = k
sec(0, 2, 'intro'); sec(2, 4, 'sube'); sec(4, 9, 'drop'); sec(9, 16, 'groove'); sec(16, 18, 'juego'); sec(18, 22, 'hero')
sec(22, 27, 'drop'); sec(27, 28, 'dip'); sec(28, 30, 'drop2'); sec(30, 33, 'juego'); sec(33, 35, 'groove'); sec(35, 42, 'drop')
sec(42, 43, 'tension'); sec(43, 46, 'latido'); sec(46, 50, 'drop2'); sec(50, 56, 'final')
duck = np.ones(N)
def sidechain(t):
    i = int(t * SR); n = int(0.3 * SR); j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.75 * np.exp(-np.arange(j - i) / SR / 0.09))
music = np.zeros(N)
fxL = np.zeros(N); fxR = np.zeros(N)
def fx(sig, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * g; fxL[i:j] += s * (1 - max(0, pan)); fxR[i:j] += s * (1 + min(0, pan))
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
    elif k == 'dip':
        addm(pad([45, 48, 52], BAR, 500), t0, 0.5)
    elif k == 'tension':
        addm(pad(PROG[c], BAR, 900 + 1500 * 0.5), t0, 0.7)
        for s in range(16): add(kick() * 0.6, t_of(bar, s / 4), 0.35 + 0.3 * s / 16)
    elif k == 'latido':
        addm(pad([45, 48, 52], BAR, 500), t0, 0.6)
        for b in (0, 0.35, 2, 2.35): add(kick() * (0.9 if b in (0, 2) else 0.6), t_of(bar, b), 0.8)
    elif k == 'final':
        if bar in (50, 51): golpes(bar, (0,))
# risers, impactos y barridos
add(riser(BAR * 2), t_of(2), 0.45); add(riser(BAR), t_of(8), 0.35); add(riser(BAR), t_of(17), 0.45)
add(riser(BAR), t_of(21), 0.45); add(riser(BAR), t_of(41), 0.5); add(riser(BAR * 2), t_of(44), 0.6)
for b in (0, 4, 9, 18, 22, 28, 30, 33, 35, 37, 46, 50): add(impact(), t_of(b), 0.9)
for b in (2, 3, 16, 48): add(impact(), t_of(b), 0.45)
for bar in list(range(4, 9)) + list(range(46, 50)):
    for b in (0, 2): add(whoosh(), t_of(bar, b) - 0.12, 0.25, (-1) ** b * 0.4)
# antes → después: barrido y golpe en cada transición
for t0 in (18.0, 21.5, 25.0, 28.5):
    fx(riser(0.45), t0 + 1.1, 0.5); fx(whoosh(), t0 + 1.2, 0.6); fx(impact(), t0 + 1.55, 1.0)
# salas: un golpe por nombre
for i in range(8): fx(whoosh(), 74 + i * 1.25 - 0.1, 0.35, (-1) ** i * 0.3)
# casino: hitos del avión, cobro con lluvia de monedas, pausa dramática del plinko y su premio
for h in (46.79, 47.79, 48.41, 48.97): fx(impact() * 0.5, h, 0.35); fx(ding(NOTE(84), .4), h, 0.5)
fx(impact(), 49.2, 1.0); jackpot(49.2); monedas(49.25, 2.0, 22, 1.0, 3)
DIP0, DIP1 = 54.2, 56.388
for i, h in enumerate((54.45, 55.05, 55.55, 55.95, 56.2)): fx(kick() * 0.9, h, 0.9 - 0.1 * (i == 0))
fx(riser(DIP1 - 55.1), 55.1, 0.4)
fx(impact(), DIP1, 1.1); jackpot(DIP1 + 0.05, 1.2); jackpot(DIP1 + 0.8, 0.8); monedas(DIP1, 3.0, 30, 1.1, 5)
fin = pad([57, 60, 64, 69], BAR * 3, 3000) * np.exp(-np.arange(int(BAR * 3 * SR)) / SR / 2.0)
addm(fin, t_of(51), 1.0)
music *= duck
L = mixL + music; R = mixR + music
R[441:] += music[:-441] * 0.25
# pausa dramática del plinko: la música baja casi a nada mientras la dorada cae
tt = np.arange(N) / SR
dip = 1 - 0.88 * np.clip((tt - DIP0) / 0.3, 0, 1) * np.clip((DIP1 + 0.02 - tt) / 0.05, 0, 1)
L *= dip; R *= dip
corte = (int(91.4 * SR), int(92.0 * SR))
L[corte[0]:corte[1]] *= 0.05; R[corte[0]:corte[1]] *= 0.05
L += fxL; R += fxR
out = np.stack([L, R], 1)
out /= np.max(np.abs(out)) * 1.05
out = np.tanh(out * 1.6) / np.tanh(1.6)
fade = int(0.02 * SR); out[:fade] *= np.linspace(0, 1, fade)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32000).astype('<i2').tobytes())
print('ok', N / SR, 's')
