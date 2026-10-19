# Banda sonora del tráiler: 120 BPM, La menor, 25 compases (50 s). Todo sintetizado.
import numpy as np, wave, sys
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
BARS = 26; N = int(SR * BAR * BARS)
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

# Secciones (compases): 0-1 intro, 2-3 subida, 4-11 drop1, 12-13 quiebre, 14-19 drop2, 20-21 economía, 22-25 final
duck = np.ones(N)
def sidechain(t):
    i = int(t * SR); n = int(0.3 * SR); j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], 1 - 0.75 * np.exp(-np.arange(j - i) / SR / 0.09))

music = np.zeros(N)  # capa que se "bombea" con el bombo
def addm(sig, t, g=1.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < N: music[i:j] += sig[: j - i] * g

for bar in range(BARS):
    c = bar % 4; t0 = t_of(bar)
    if bar < 2:   addm(pad(PROG[c], BAR, 700), t0, 0.7)
    elif bar < 4: addm(pad(PROG[c], BAR, 1200 + 900 * (bar - 2)), t0, 0.8)
    elif bar < 12 or 14 <= bar < 22: addm(pad(PROG[c], BAR, 4200), t0, 0.55)
    elif bar < 14: addm(pad(PROG[c], BAR, 1500), t0, 0.8)
    elif bar < 24: addm(pad(PROG[c], BAR, 2500), t0, 0.6)
    drop = 4 <= bar < 12 or 14 <= bar < 22
    if drop or 2 <= bar < 4 or 22 <= bar < 24:
        for b in range(4):
            if bar >= 22 and b > 0: break
            add(kick(), t_of(bar, b), 0.95); sidechain(t_of(bar, b))
    if drop:
        for b in (1, 3): add(clap(), t_of(bar, b), 0.55, 0.05)
        for s in range(16):
            add(hat(open_=(s % 4 == 2)), t_of(bar, s / 4), 0.22 if s % 2 else 0.1, -0.3 if s % 4 == 2 else 0.25)
        for e in range(8):
            if e % 2: addm(bass(ROOT[c], BEAT / 2 * 0.95), t_of(bar, e / 2), 1.0)
        arp = PROG[c] + [PROG[c][0] + 12]
        if bar >= 6:
            for s in range(16): addm(pluck(arp[(s * 3) % 4] + 12), t_of(bar, s / 4), 1.0 if bar >= 14 else 0.7)
    if bar in (12, 13):
        for s in range(8): addm(pluck(PROG[c][s % 3] + 12, 0.35), t_of(bar, s / 2), 0.8)
        if bar == 13:
            for s in range(16): add(kick() * 0.5, t_of(bar, 2 + s / 8), 0.4 * s / 16)

# risers e impactos
add(riser(BAR * 2), t_of(2), 0.45); add(riser(BAR), t_of(13), 0.5); add(riser(BAR), t_of(21), 0.5)
for b in (0, 4, 14, 22): add(impact(), t_of(b), 0.9)
for b in (2, 3, 12, 20, 24): add(impact(), t_of(b), 0.5)
# whooshes en cada corte rápido del drop
for bar in list(range(4, 12)) + list(range(14, 22)):
    for b in (0, 2): add(whoosh(), t_of(bar, b) - 0.12, 0.25, (-1) ** b * 0.4)
# final: acorde largo que se apaga
fin = pad([57, 60, 64, 69], BAR * 2.5, 3000) * np.exp(-np.arange(int(BAR * 2.5 * SR)) / SR / 1.6)
addm(fin, t_of(24), 1.0)

music *= duck
L = mixL + music; R = mixR + music
# estéreo: retardo corto para ensanchar la música
R[441:] += music[:-441] * 0.25; L[:-441] += 0 
out = np.stack([L, R], 1)
out /= np.max(np.abs(out)) * 1.05
out = np.tanh(out * 1.6) / np.tanh(1.6)
fade = int(0.02 * SR); out[:fade] *= np.linspace(0, 1, fade)[:, None]
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32000).astype('<i2').tobytes())
print('ok', N / SR, 's')
