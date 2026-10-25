# Prepara la imagen del menú de inicio «JloKart Wii» (bitácora §67) — la que dio el dueño.
#
# Resumen: la imagen original trae pintados 4 botones (Single Player, Multiplayer, Championship, Options) y la flecha
# de "elegido" al lado del primero. El menú de la página dibuja sus PROPIOS botones encima (3: sin Championship, que
# el dueño pidió quitar), con el resaltado que se mueve. Por eso aquí se BORRAN los botones pintados y la flecha, y
# el hueco se rellena con el fondo de alrededor (que en esa zona está desenfocado: cascada, pista, cielo):
#   1. una "máscara": la forma de cada botón (una píldora: rectángulo con puntas redondas) un poco agrandada, para
#      llevarse también el brillo del borde; y el triángulo de la flecha;
#   2. relleno "pull-push" (empujar y tirar): se achica la imagen a la mitad una y otra vez promediando SOLO los píxeles
#      buenos, hasta que el hueco desaparece; después se vuelve a agrandar y en cada tamaño se usa lo bueno de ese
#      tamaño y lo que viene de más abajo para el hueco. Es como rellenar un agujero con el promedio de sus vecinos,
#      cada vez más lejanos: da un relleno suave, igual al fondo desenfocado de esa zona;
#   3. un grano muy leve (el de la imagen) para que el relleno no se vea "plástico";
#   4. se guarda en WebP (calidad 86) en build/web/navegador/imagenes/inicio/jlokart.webp.
#
# La imagen muestra a una persona real: NO va a git ni a GitHub Pages. Va a la parte privada (R2 detrás del Worker de
# amigos, como el disco de BT3): subir-r2.mjs sube todo build/…/imagenes, y el Worker solo la entrega con el token de
# Firebase de alguien de la lista AMIGOS. build/ está en .gitignore.
#
# Uso:  python -I herramientas/preparar-inicio.py "C:\Users\zilon\Downloads\Jlo Kart Wii Victory Splash.png"
#       (--prueba: deja además una foto de la zona arreglada en build/web/datos/inicio-columna.png para revisarla)
import sys
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'build/web/navegador/imagenes/inicio/jlokart.webp'

# Medidas de la imagen original (1448 × 1086), en píxeles: cada botón pintado (izquierda, arriba, derecha, abajo)
ANCHO, ALTO = 1448, 1086
BOTONES = [(1075, 520, 1419, 595),   # Single Player (el elegido: más grande y con brillo)
           (1082, 602, 1407, 665),   # Multiplayer
           (1082, 678, 1407, 741),   # Championship
           (1082, 751, 1407, 814)]   # Options
FLECHA = [(1031, 540), (1067, 558), (1031, 577)]   # el triángulo ▶ al lado del elegido
MARGEN = 9                                          # cuánto se agranda cada píldora (el brillo del borde)


def mascara():
    """1 = píxel a rellenar (los botones pintados y la flecha)."""
    m = np.zeros((ALTO, ANCHO), np.uint8)
    for i, (x0, y0, x1, y1) in enumerate(BOTONES):
        g = MARGEN + (5 if i == 0 else 0)            # el elegido tiene un halo más ancho
        x0, y0, x1, y1 = x0 - g, y0 - g, x1 + g, y1 + g
        r = (y1 - y0) // 2                            # puntas redondas: radio = media altura
        cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 1, -1)
        cv2.circle(m, (x0 + r, y0 + r), r, 1, -1)
        cv2.circle(m, (x1 - r, y0 + r), r, 1, -1)
    cv2.fillPoly(m, [np.array(FLECHA, np.int32)], 1)
    return cv2.dilate(m, np.ones((9, 9), np.uint8))   # la flecha tiene borde oscuro y brillo: un poco más


def rellenar(img, hueco):
    """Pull-push: rellena los píxeles con hueco = 1 con el promedio de sus vecinos buenos, de cerca a lejos."""
    peso = (1 - hueco).astype(np.float64)
    color = img.astype(np.float64) * peso[..., None]
    niveles = [(color, peso)]
    # hasta que no quede hueco (el hueco es grande: ~330 × 320 px; si se cortara antes, sus celdas vacías quedarían
    # negras y oscurecerían todo el relleno)
    while min(color.shape[:2]) > 1 and peso.min() == 0:
        h, w = color.shape[0] // 2 * 2, color.shape[1] // 2 * 2
        c, p = color[:h, :w], peso[:h, :w]
        color = c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]       # suma de cada 2×2
        peso = p[0::2, 0::2] + p[1::2, 0::2] + p[0::2, 1::2] + p[1::2, 1::2]
        niveles.append((color, peso))
    c, p = niveles[-1]
    arriba = c / np.maximum(p, 1e-9)[..., None]
    if p.min() == 0:                                   # (no debería pasar) lo que siga vacío: el promedio de lo bueno
        arriba[p == 0] = c.reshape(-1, 3).sum(0) / p.sum()
    for c, p in reversed(niveles[:-1]):
        grande = cv2.resize(arriba, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
        propio = c / np.maximum(p, 1e-9)[..., None]
        a = np.clip(p, 0, 1)[..., None]                # 1 = este nivel tiene dato bueno; 0 = viene de más abajo
        arriba = a * propio + (1 - a) * grande
    return arriba


def por_filas(img, hueco, muestra=6):
    """Cada fila del hueco: una mezcla en línea recta entre el color de su borde izquierdo y el del derecho (el
    promedio de `muestra` píxeles justo afuera). En esa zona el fondo tiene rayas horizontales de velocidad (cielo,
    baranda, pista): rellenar fila por fila las continúa, en vez de dejar una mancha pareja."""
    sal = img.astype(np.float64).copy()
    for y in np.where(hueco.any(1))[0]:
        fila = hueco[y]
        x = 0
        while x < fila.size:
            if not fila[x]:
                x += 1
                continue
            x0 = x
            while x < fila.size and fila[x]:
                x += 1
            x1 = x                                       # el tramo vacío es [x0, x1)
            izq = img[y, max(0, x0 - muestra):x0].reshape(-1, 3).astype(np.float64)
            der = img[y, x1:x1 + muestra].reshape(-1, 3).astype(np.float64)
            ci = izq.mean(0) if len(izq) else der.mean(0)
            cd = der.mean(0) if len(der) else ci
            t = (np.arange(x0, x1) - x0 + 0.5) / max(1, x1 - x0)
            sal[y, x0:x1] = ci[None] * (1 - t[:, None]) + cd[None] * t[:, None]
    # que fila con fila no se vea como cortes de cuchillo: un desenfoque solo vertical dentro del hueco
    vertical = cv2.GaussianBlur(sal, (1, 0), sigmaX=0.1, sigmaY=5)
    sal[hueco == 1] = vertical[hueco == 1]
    return sal


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__ if __doc__ else 'uso: preparar-inicio.py <imagen.png>')
    original = cv2.imread(sys.argv[1], cv2.IMREAD_COLOR)
    if original is None:
        sys.exit(f'no pude abrir {sys.argv[1]}')
    if original.shape[:2] != (ALTO, ANCHO):
        sys.exit(f'la imagen mide {original.shape[1]}×{original.shape[0]}; se esperaba {ANCHO}×{ALTO} (las medidas de los botones son de esa)')
    m = mascara()
    # las dos maneras juntas: por filas (continúa las rayas) con un poco del pull-push (suaviza los saltos de color)
    lleno = 0.75 * por_filas(original, m) + 0.25 * rellenar(original, m)
    # el borde del hueco: una transición de 6 px para que no quede una línea
    suave = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 3)[..., None]
    suave = np.maximum(suave, m[..., None].astype(np.float32))
    # grano: el ruido fino de la imagen original (lo que queda al restarle una versión desenfocada), medido fuera del hueco
    fino = original.astype(np.float32) - cv2.GaussianBlur(original, (0, 0), 1.5).astype(np.float32)
    sigma = float(np.std(fino[m == 0])) * 0.35
    ruido = np.random.default_rng(9).normal(0, sigma, original.shape).astype(np.float32)
    final = original.astype(np.float32) * (1 - suave) + (lleno.astype(np.float32) + ruido) * suave
    final = np.clip(final, 0, 255).astype(np.uint8)
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(SALIDA), final, [cv2.IMWRITE_WEBP_QUALITY, 86])
    print(f'listo: {SALIDA.relative_to(RAIZ)} ({SALIDA.stat().st_size // 1024} KB)')
    if '--prueba' in sys.argv:
        foto = RAIZ / 'build/web/datos/inicio-columna.png'
        foto.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(foto), cv2.resize(final[480:860, 980:1448], None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4))
        print(f'foto de la zona: {foto.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
