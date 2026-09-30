#!/usr/bin/env python3
"""Graba las frases de BBTAN (juegos/club/bbtan/voz.js) en assets/voz/.

La voz del juego no puede depender del navegador: speechSynthesis no existe
en muchos móviles y en cada PC suena distinto. Así que se graba una vez, aquí,
con síntesis neuronal (Piper) y el procesado de cada ánimo, y el juego solo
toca MP3.

Voces (https://huggingface.co/rhasspy/piper-voices, carpeta es/):
  es_MX-claude-high  (dataset apache-2.0)   · la voz principal
  es_MX-ald-medium   (dataset unlicense)    · la segunda, para lo roto
Se descargan los .onnx y .onnx.json en una carpeta y se pasa con --voces.

  pip install piper-tts numpy scipy soundfile lameenc librosa
  python3 colabtex/scripts/bbtan-voz.py --voces /ruta/a/voces

Los ánimos:
  alegre   · voz subida cuatro semitonos y algo rápida (se sintetiza más lenta
             y se remuestrea, así sube el tono sin acortar la frase), cada
             exclamación un poco más arriba, brillo y una copia una octava
             arriba muy baja: un presentador de feria.
  roto     · palabra por palabra, cada una con otra voz, otro tono y otra
             velocidad; tartamudeos de verdad («cu-cu-cucharas»), palabras
             que se cortan y vuelven, trozos triturados a pocos bits.
  susurro  · un vocoder LPC: la envolvente de la voz excitada con ruido en
             vez de cuerdas vocales, es decir, un susurro real; debajo, la
             misma frase siete semitonos abajo y oscura, y un eco al final.
  giro     · lo que va antes de «|» susurrado, lo de después perfecto.
  perfecto · la voz y dos copias afinadas en tercera y quinta mayor: un coro
             perfecto de una sola persona. En la 450 la cinta ondula y en la
             500 la última palabra se frena como un disco que se apaga.
"""
import argparse, io, json, os, subprocess, sys, wave
from fractions import Fraction

import numpy as np
import soundfile as sf
from scipy.linalg import solve_toeplitz
from scipy.signal import lfilter, resample_poly, butter, sosfilt

SR = 22050
AQUI = os.path.dirname(os.path.abspath(__file__))
BBTAN = os.path.normpath(os.path.join(AQUI, '..', '..', 'juegos', 'club', 'bbtan'))

VOCES = {}


def voz(nombre):
    from piper import PiperVoice
    if nombre not in VOCES:
        VOCES[nombre] = PiperVoice.load(os.path.join(ARGS.voces, nombre + '.onnx'))
    return VOCES[nombre]


def sintetiza(texto, nombre='es_MX-claude-high', largo=1.0, ruido=.667):
    from piper import SynthesisConfig
    b = io.BytesIO()
    with wave.open(b, 'wb') as w:
        voz(nombre).synthesize_wav(texto, w, syn_config=SynthesisConfig(length_scale=largo, noise_scale=ruido))
    b.seek(0)
    x, sr = sf.read(b, dtype='float32')
    assert sr == SR, sr
    return recorta(x)


def recorta(x, umbral=.01):
    i = np.flatnonzero(np.abs(x) > umbral)
    return x[max(0, i[0] - 200):i[-1] + 400] if len(i) else x


def remuestrea(x, r):
    """Toca x r veces más rápido (sube el tono r y acorta 1/r)."""
    f = Fraction(r).limit_denominator(64)
    return resample_poly(x, f.denominator, f.numerator).astype('float32')


def tono(texto, st, largo=1.0, nombre='es_MX-claude-high'):
    """La frase st semitonos arriba (o abajo) sin cambiar su duración: se
    sintetiza r veces más lenta y se remuestrea r veces más rápida."""
    r = 2 ** (st / 12)
    return remuestrea(sintetiza(texto, nombre, largo * r), r)


def estira(x, st):
    """Cambia el tono sin cambiar la duración (vocoder de fase): suena un
    poco artificial, que es justo lo que pide el coro perfecto."""
    import librosa
    return librosa.effects.pitch_shift(x, sr=SR, n_steps=st).astype('float32')


def filtro(x, tipo, f, orden=2):
    return sosfilt(butter(orden, f, btype=tipo, fs=SR, output='sos'), x).astype('float32')


def reverb(x, seg=1.2, mezcla=.25, semilla=1):
    rng = np.random.default_rng(semilla)
    n = int(SR * seg)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * seg / 6))
    ir = filtro(ir, 'lowpass', 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    mojado = np.convolve(x, ir)
    mojado = np.concatenate([mojado, np.zeros(len(x) + n - len(mojado))])
    seco = np.concatenate([x, np.zeros(n, 'float32')])
    return (seco + mezcla * mojado).astype('float32')


def lpc(marco, orden):
    r = np.correlate(marco, marco, 'full')[len(marco) - 1:len(marco) + orden]
    if r[0] <= 1e-9:
        return None, 0.
    r[0] *= 1.0001
    a = solve_toeplitz(r[:-1], r[1:])
    err = r[0] - np.dot(a, r[1:])
    return a, max(err, 0.)


def susurra(x, orden=22, semilla=3):
    """Vocoder LPC: cada 10 ms se mide la envolvente de la voz (orden 22) y
    se le pasa ruido blanco en vez del pulso de la glotis. Lo que queda es
    la misma frase, susurrada."""
    rng = np.random.default_rng(semilla)
    pre = lfilter([1, -.94], [1], x)
    n, h = 551, 220
    ventana = np.hanning(n)
    out = np.zeros(len(x) + n)
    norma = np.zeros(len(x) + n)
    for i in range(0, len(x) - n, h):
        m = pre[i:i + n] * ventana
        a, err = lpc(m, orden)
        if a is None:
            continue
        g = np.sqrt(err / n)
        e = rng.standard_normal(n) * g
        y = lfilter([1], np.concatenate([[1], -a]), e)
        if not np.all(np.isfinite(y)):
            continue
        out[i:i + n] += y * ventana
        norma[i:i + n] += ventana ** 2
    out = out[:len(x)] / np.maximum(norma[:len(x)], 1e-3)
    out = lfilter([1], [1, -.94], out)
    return filtro(out.astype('float32'), 'highpass', 180)


def tritura(x, bits=4, divide=4):
    y = np.repeat(x[::divide], divide)[:len(x)]
    q = 2 ** (bits - 1)
    return (np.round(y * q) / q).astype('float32')


def frena(x, desde):
    """Un disco que se apaga: desde `desde` (muestras) la velocidad cae a
    cero, así baja el tono y se estira."""
    cola = x[desde:]
    n = len(cola)
    vel = np.linspace(1, .25, int(n * 1.8))
    pos = np.cumsum(vel)
    pos = pos[pos < n - 1]
    return np.concatenate([x[:desde], np.interp(pos, np.arange(n), cola).astype('float32')])


def ondula(x, prof=.012, hz=.7):
    """La cinta ondula: la velocidad sube y baja despacio."""
    t = np.arange(len(x)) / SR
    pos = np.arange(len(x)) + prof * SR / (2 * np.pi * hz) * np.sin(2 * np.pi * hz * t)
    return np.interp(np.clip(pos, 0, len(x) - 1), np.arange(len(x)), x).astype('float32')


def silencio(seg):
    return np.zeros(int(SR * seg), 'float32')


def funde(x, ms=12):
    n = min(len(x) // 2, int(SR * ms / 1000))
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def mezcla(*pistas):
    n = max(len(p) for p, _ in pistas)
    out = np.zeros(n, 'float32')
    for p, g in pistas:
        out[:len(p)] += g * p
    return out


def trozos(texto):
    """Frases sueltas: corta después de ! ? . y … sin perder los signos."""
    import re
    return [t for t in re.split(r'(?<=[!?.…])\s+', texto.strip()) if t]


# ---------- Los ánimos ----------

def alegre(texto, nivel, rng):
    partes = []
    for j, t in enumerate(trozos(texto)):
        st = 4 + min(3, j) * 1.2 + nivel * .8
        partes += [tono(t, st, .92), silencio(.06)]
    x = np.concatenate(partes)
    brillo = filtro(x, 'highpass', 2500)
    x = mezcla((x, 1), (brillo, .35), (estira(x, 12), .06))
    x = np.tanh(x * 1.6) / np.tanh(1.6)
    return reverb(x, .5, .12)


def roto(texto, nivel, rng):
    """A tirones: la frase en trozos de dos o tres palabras, cada trozo con
    otra voz, otro tono y otra velocidad. Los trozos se dicen enteros (una
    palabra suelta, «Tu», Piper la dice mal) para que se entiendan; lo roto
    está entre ellos: el tartamudeo lo dice la voz misma («cu-cu-cucharas»
    se sintetiza «cu, cu, cucharas»), algún trozo se corta y vuelve a
    empezar, y alguno sale triturado a pocos bits."""
    import re
    palabras = [re.sub(r'^((?:[^\s-]+-){2,})(.+)$', lambda m: ', '.join(m.group(1).split('-')[:-1]) + ', ' + m.group(2), p)
                for p in texto.split()]
    grupos, actual, meta = [], [], int(rng.integers(2, 4))
    for p in palabras:
        actual.append(p)
        if re.search(r'[.?!…]$', p) or len(actual) >= meta:
            grupos.append(actual); actual, meta = [], int(rng.integers(2, 4))
    if actual:
        grupos.append(actual)
    partes = []
    for g in grupos:
        nombre = 'es_MX-ald-medium' if rng.random() < .45 else 'es_MX-claude-high'
        st = float(rng.uniform(-3, 4))
        w = tono(' '.join(g), st, float(rng.uniform(.85, 1.2)), nombre)
        if rng.random() < .2 and len(g) > 1 and len(w) > SR * .5:  # se corta y vuelve a empezar
            w = np.concatenate([funde(w[:int(len(w) * .35)]), silencio(.09), w])
        if rng.random() < .2 + .1 * (nivel - 2):
            w = tritura(w, int(rng.integers(5, 7)), 2)
        partes += [funde(w), silencio(float(rng.uniform(.05, .22)))]
    if nivel == 3:  # el último trozo se repite y se apaga como un disco
        ult = partes[-2]
        partes += [frena(ult, int(len(ult) * .3)) * .8]
    x = np.concatenate(partes)
    return reverb(x, .4, .1)


def susurro(texto, nivel, rng):
    hondo = nivel - 4
    base = tono(texto, -2 - 2 * hondo, 1.3)
    s = susurra(base)
    demonio = filtro(tono(texto, -7 - 3 * hondo, 1.3, 'es_MX-ald-medium'), 'lowpass', 1300)
    x = mezcla((s, 1.5), (demonio, .22 + .12 * hondo))
    # El final se repite como un eco que se aleja.
    fin = trozos(texto)[-1].rstrip('.?!… ')
    eco = susurra(tono(' '.join(fin.split()[-2:]), -4 - 2 * hondo, 1.5))
    x = np.concatenate([x, silencio(.25), eco * .6, silencio(.3), eco * .3])
    return reverb(x, 2.2, .45)


def perfecto(texto, nivel, rng):
    x = tono(texto, 2.5, .95)
    coro = mezcla((x, 1), (estira(x, 4), .55), (estira(x, 7), .5), (estira(x, 12), .12))
    brillo = filtro(coro, 'highpass', 3000)
    coro = mezcla((coro, 1), (brillo, .3))
    if nivel >= 8:
        coro = ondula(coro, .004 + .003 * (nivel - 8), .5)
    if nivel >= 9:
        coro = frena(coro, int(len(coro) * .93))
    return reverb(coro, 1.4, .3)


def giro(texto, nivel, rng):
    a, b = texto.split('|')
    return np.concatenate([susurro(a.strip(), 5, rng), silencio(.35), perfecto(b.strip(), 7, rng)])


ANIMOS = {'alegre': alegre, 'roto': roto, 'susurro': susurro, 'giro': giro, 'perfecto': perfecto}


def normaliza(x, rms=.12, pico=.93):
    x = funde(x, 30)
    r = np.sqrt(np.mean(x[np.abs(x) > .01] ** 2)) if np.any(np.abs(x) > .01) else 1
    x = x * (rms / r)
    p = np.max(np.abs(x))
    if p > pico:
        x = np.tanh(x / p * 1.2) / np.tanh(1.2) * pico
    return x.astype('float32')


def mp3(x, ruta):
    import lameenc
    e = lameenc.Encoder()
    e.set_bit_rate(48)
    e.set_in_sample_rate(SR)
    e.set_channels(1)
    e.set_quality(2)
    datos = e.encode((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()) + e.flush()
    with open(ruta, 'wb') as f:
        f.write(datos)


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument('--voces', required=True)
    ap.add_argument('--wav', help='carpeta donde dejar también los .wav (para revisarlos)')
    ap.add_argument('--solo', help='solo el nivel N')
    ARGS = ap.parse_args()
    js = subprocess.run(['node', '-e', f"const V=require({json.dumps(os.path.join(BBTAN, 'voz.js'))});"
                         "console.log(JSON.stringify({f:V.FRASES,a:V.ANIMO}))"], capture_output=True, text=True, check=True)
    datos = json.loads(js.stdout)
    salida = os.path.join(BBTAN, 'assets', 'voz')
    os.makedirs(salida, exist_ok=True)
    for nivel, (frases, animo) in enumerate(zip(datos['f'], datos['a'])):
        if ARGS.solo is not None and int(ARGS.solo) != nivel:
            continue
        for i, texto in enumerate(frases):
            rng = np.random.default_rng(1000 * nivel + i)
            x = normaliza(ANIMOS[animo](texto, nivel, rng))
            mp3(x, os.path.join(salida, f'v{nivel}-{i}.mp3'))
            if ARGS.wav:
                os.makedirs(ARGS.wav, exist_ok=True)
                sf.write(os.path.join(ARGS.wav, f'v{nivel}-{i}.wav'), x, SR)
            print(f'v{nivel}-{i}  {animo:9s} {len(x) / SR:5.2f} s  {texto}')


if __name__ == '__main__':
    main()
