#!/usr/bin/env python3
"""Graba los anuncios del altavoz de Metro Rush en juegos/club/metrorush/assets/voz/.

QUÉ HACE, EN GLOBAL
  Lee los textos de ANUNCIOS en juegos/club/metrorush/historia.js (dos por
  estación: `proxima`, al entrar al túnel, y `eco`, a mitad de la estación),
  los dice con síntesis neuronal (Piper), los pasa por un «altavoz de andén»
  y deja un MP3 por anuncio: <estación>-<proxima|eco>.mp3 (barrio-proxima.mp3,
  oxido-eco.mp3…). audio.js (`anuncio`) los toca después del ding-dong.

POR QUÉ ASÍ
  - Grabado una vez y no hablado por el navegador: speechSynthesis no existe
    en muchos celulares y en cada PC suena distinto (y mal). Es lo mismo que
    hace la voz de BBTAN (bbtan-voz.py), de donde sale este script.
  - El texto de historia.js es a la vez lo que se lee en la franja y lo que
    se grabó: si cambias un anuncio, vuelve a correr esto. El test
    colabtex/tests/metrorush-voz.test.cjs revisa que haya un MP3 por anuncio
    (ni uno de menos ni uno de más) y, con textos.json (lo que se grabó, que
    este script deja al lado), que ningún anuncio cambió sin volver a
    grabarse. Para comprobar que la grabación dice lo mismo que el texto,
    --revisa la transcribe con faster-whisper.
  - Lo que se escribe no siempre es lo que se dice: «Línea 3» se lee «Línea
    tres» y el 317 es «el tres diecisiete», como se nombra un tren. DICCION
    traduce solo para la voz; el texto en pantalla no cambia.
  - El altavoz de andén: la voz algo lenta y tranquila (length_scale 1.12),
    recortada a la banda de un parlante de bocina (300 a 3400 Hz), con un
    poco de saturación del parlante, un eco corto de andén (la pared de
    enfrente, ~70 ms) y una sala de concreto (reverb de 1,1 s, poca mezcla).
  - Mono, a la frecuencia de la voz (16 000 Hz con carlfm) y 48 kbps: un
    anuncio de 5 s pesa ~30 kB y los veinte juntos menos de 1 MB. Los 16 kHz
    no se notan: el parlante de andén corta igual en 3400 Hz.

Voz: es-carlfm-x-low (dataset de carlfm01, dominio público), del release
v0.0.2 de Piper en GitHub:
  https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-es-carlfm-x-low.tar.gz
Se descomprime en una carpeta (trae el .onnx y el .onnx.json) y se pasa con
--voces. Se eligió esa porque se baja de GitHub; las de huggingface
(es_MX-claude-high…) suenan mejor y sirven igual con --voz si se tienen.
Las dos de MLS de ese mismo release (es-mls_*) no sirven con piper-tts 1.8:
una frase de 5 s sale de 28 s, balbuceando.

  pip install piper-tts numpy scipy soundfile lameenc
  python3 colabtex/scripts/metrorush-voz.py --voces /ruta/a/voces             # con es-carlfm-x-low
  python3 colabtex/scripts/metrorush-voz.py --voces /ruta --solo oxido --wav /tmp/wav
  python3 colabtex/scripts/metrorush-voz.py --voces /ruta --revisa   # transcribe y compara (faster-whisper)
"""
import argparse, io, json, os, re, subprocess, wave

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 16000                                                    # la frecuencia de la voz (se lee de su .onnx.json en main)
AQUI = os.path.dirname(os.path.abspath(__file__))             # colabtex/scripts
METRO = os.path.normpath(os.path.join(AQUI, '..', '..', 'juegos', 'club', 'metrorush'))   # la carpeta del juego
VOZ = 'es-carlfm-x-low'                                       # la voz de todos los anuncios (cambia con --voz)
LARGO = 1.12                                                  # >1 = más lento: un altavoz habla sin apuro
CUALES = ('proxima', 'eco')                                   # los dos anuncios de cada estación (los mismos de audio.js)

# Cómo se DICE lo que está escrito (solo para la voz; la franja muestra el texto tal cual).
DICCION = [
    (r'\b317\b', 'tres diecisiete'),                          # el número del tren se dice como se nombra un tren
    (r'\b1986\b', 'mil novecientos ochenta y seis'),          # el año del viaje inaugural
    (r'\b2006\b', 'dos mil seis'),                            # el año en que cerró la Estación Fantasma
    (r'Línea 3', 'Línea tres'),                               # la línea
    (r'Vía 7', 'Vía siete'),                                  # la vía de las cocheras
    (r'…', ','),                                              # los puntos suspensivos: una pausa corta, no «punto punto punto»
]

ARGS = None                                                   # los argumentos (se llenan en main)
_VOZ = None                                                   # la voz de Piper, cargada una sola vez


def dice(texto):
    """El texto como lo tiene que pronunciar la voz (DICCION aplicada)."""
    for patron, por in DICCION:
        texto = re.sub(patron, por, texto)
    return texto


def sintetiza(texto):
    """La frase dicha por Piper, lenta y tranquila (poco ruido de entonación), sin silencios en los bordes."""
    global _VOZ
    from piper import PiperVoice, SynthesisConfig
    if _VOZ is None:
        _VOZ = PiperVoice.load(os.path.join(ARGS.voces, VOZ + '.onnx'))   # el .onnx.json va al lado
    b = io.BytesIO()
    with wave.open(b, 'wb') as w:                             # Piper escribe un WAV en memoria
        _VOZ.synthesize_wav(texto, w, syn_config=SynthesisConfig(length_scale=LARGO, noise_scale=.5))
    b.seek(0)
    x, sr = sf.read(b, dtype='float32')
    assert sr == SR, sr                                       # si la voz cambia de frecuencia, todo lo de abajo está mal
    return recorta(x)


def recorta(x, umbral=.01):
    """Quita el silencio del principio y del final (deja un respiro corto)."""
    i = np.flatnonzero(np.abs(x) > umbral)
    return x[max(0, i[0] - 200):i[-1] + 400] if len(i) else x


def filtro(x, tipo, f, orden=2):
    """Un Butterworth (pasa bajos, pasa altos o pasa banda) en secciones de segundo orden."""
    return sosfilt(butter(orden, f, btype=tipo, fs=SR, output='sos'), x).astype('float32')


def reverb(x, seg=1.1, mezcla=.16, semilla=7):
    """Una sala de concreto: ruido que decae (seg = cola) y apagado arriba de 4 kHz, mezclado bajo."""
    rng = np.random.default_rng(semilla)                      # la misma sala en cada corrida: los MP3 no cambian si el texto no cambia
    n = int(SR * seg)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * seg / 6))   # la cola: −52 dB al final
    ir = filtro(ir, 'lowpass', 4000)                          # el concreto se come los agudos
    ir[:int(SR * .012)] = 0                                   # 12 ms antes de la primera reflexión: la sala está lejos del parlante
    ir /= np.sqrt(np.sum(ir ** 2))                            # energía 1: `mezcla` es el nivel de la sala
    mojado = np.convolve(x, ir)
    seco = np.concatenate([x, np.zeros(len(mojado) - len(x), 'float32')])
    return (seco + mezcla * mojado).astype('float32')


def eco(x, ms=70, g=.18):
    """La pared de enfrente del andén: una copia ms milisegundos después, más baja y más opaca."""
    d = int(SR * ms / 1000)
    rebote = filtro(x, 'lowpass', 2500)                       # la pared devuelve menos brillo
    y = np.concatenate([x, np.zeros(d, 'float32')])
    y[d:] += g * rebote
    return y


def parlante(x):
    """El altavoz de bocina: solo de 300 a 3400 Hz (la banda de un parlante de andén o de un teléfono),
    un realce suave de presencia y un poco de saturación del cono."""
    x = filtro(x, 'bandpass', [300, 3400], orden=4)           # la banda del parlante (orden 4: corte claro pero sin sonar a filtro)
    x = x + .25 * filtro(x, 'bandpass', [1800, 3000])         # la bocina resuena en los medios altos: se entiende mejor
    x = x / (np.max(np.abs(x)) + 1e-9)                        # al tope antes de saturar, para que la saturación sea pareja
    return (np.tanh(x * 1.8) / np.tanh(1.8)).astype('float32')   # el cono saturando apenas


def funde(x, ms=30):
    """Entrada y salida en rampa, para que no haya clic."""
    n = min(len(x) // 2, int(SR * ms / 1000))
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def normaliza(x, rms=.12, pico=.93):
    """Todos los anuncios al mismo volumen (rms de la parte con voz), sin pasar del pico."""
    x = funde(x)
    voz = np.abs(x) > .01                                     # solo lo que suena (los silencios no bajan la cuenta)
    r = np.sqrt(np.mean(x[voz] ** 2)) if np.any(voz) else 1
    x = x * (rms / r)
    p = np.max(np.abs(x))
    if p > pico:                                              # un pico de más se redondea en vez de recortarse
        x = np.tanh(x / p * 1.2) / np.tanh(1.2) * pico
    return x.astype('float32')


def anden(texto):
    """El anuncio entero: la voz, el parlante, el eco del andén y la sala."""
    x = sintetiza(dice(texto))
    x = parlante(x)
    x = eco(x)
    x = reverb(x)
    return normaliza(x)


def mp3(x, ruta):
    """Mono a 48 kbps (alcanza de sobra para una voz de 300 a 3400 Hz)."""
    import lameenc
    e = lameenc.Encoder()
    e.set_bit_rate(48)
    e.set_in_sample_rate(SR)
    e.set_channels(1)
    e.set_quality(2)                                          # 2 = alta calidad de codificación (más lento, mismo tamaño)
    datos = e.encode((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()) + e.flush()
    with open(ruta, 'wb') as f:
        f.write(datos)


def anuncios():
    """ANUNCIOS de historia.js, leído con Node (historia.js se carga con require: no hay que copiar la tabla)."""
    js = subprocess.run(['node', '-e', f"const H=require({json.dumps(os.path.join(METRO, 'historia.js'))});"
                         "console.log(JSON.stringify(H.ANUNCIOS))"], capture_output=True, text=True, check=True)
    return json.loads(js.stdout)


def revisa(ruta, texto):
    """Transcribe la grabación con faster-whisper y devuelve qué entendió (None si no está instalado)."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None
    global _WHISPER
    if '_WHISPER' not in globals():
        _WHISPER = WhisperModel('small', device='cpu', compute_type='int8')   # el pequeño basta para español claro
    partes, _ = _WHISPER.transcribe(ruta, language='es')
    return ' '.join(p.text.strip() for p in partes)


def main():
    global ARGS, VOZ, SR
    ap = argparse.ArgumentParser()
    ap.add_argument('--voces', required=True, help='carpeta con el .onnx de la voz y su .onnx.json')
    ap.add_argument('--voz', default=VOZ, help='nombre de la voz (sin .onnx); por defecto ' + VOZ)
    ap.add_argument('--wav', help='carpeta donde dejar también los .wav (para revisarlos)')
    ap.add_argument('--solo', help='solo la estación con este id (barrio, ocaso…)')
    ap.add_argument('--revisa', action='store_true', help='transcribe cada MP3 con faster-whisper y lo muestra junto al texto')
    ARGS = ap.parse_args()
    VOZ = ARGS.voz                                            # la voz elegida
    with open(os.path.join(ARGS.voces, VOZ + '.onnx.json'), encoding='utf-8') as f:
        SR = json.load(f)['audio']['sample_rate']             # todo el proceso (filtros, eco, sala, MP3) va a la frecuencia de la voz
    salida = os.path.join(METRO, 'assets', 'voz')
    os.makedirs(salida, exist_ok=True)
    total = 0
    todos = anuncios()
    grabados = {}                                             # nombre del MP3 → el texto que dice (va a textos.json)
    ruta_textos = os.path.join(salida, 'textos.json')
    if ARGS.solo and os.path.exists(ruta_textos):             # con --solo se conservan los demás ya grabados
        with open(ruta_textos, encoding='utf-8') as f:
            grabados = json.load(f)
    for est, textos in todos.items():
        if ARGS.solo and ARGS.solo != est:
            continue
        for cual in CUALES:
            texto = textos[cual]
            x = anden(texto)
            ruta = os.path.join(salida, f'{est}-{cual}.mp3')
            mp3(x, ruta)
            grabados[f'{est}-{cual}'] = texto                 # lo que dice este MP3, tal como está en historia.js
            total += os.path.getsize(ruta)
            if ARGS.wav:
                os.makedirs(ARGS.wav, exist_ok=True)
                sf.write(os.path.join(ARGS.wav, f'{est}-{cual}.wav'), x, SR)
            print(f'{est}-{cual:8s} {len(x) / SR:5.2f} s  {os.path.getsize(ruta) / 1024:5.1f} kB  {texto}')
            if ARGS.revisa:
                oido = revisa(ruta, texto)
                print('   oído:', oido if oido is not None else '(faster-whisper no está instalado)')
    with open(ruta_textos, 'w', encoding='utf-8') as f:      # el test compara esto con historia.js: un texto cambiado pide grabar de nuevo
        json.dump(dict(sorted(grabados.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'total: {total / 1024:.0f} kB')


if __name__ == '__main__':
    main()
