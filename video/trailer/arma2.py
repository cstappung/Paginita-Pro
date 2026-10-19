# Arma trailer2.html: cabecera y ayudantes de trailer.html + timeline2.js + el render.
import os
T = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(T, 'trailer.html')).read()
cab = s[:s.index('/* ---------- LA LÍNEA DE TIEMPO ---------- */')]
pie = s[s.index('/* Grano: una textura de ruido fija'):]
cab = cab.replace('const FPS = 30, DUR = 52,', 'const FPS = 30, DUR = 84,').replace('<title>Tráiler Juegos</title>', '<title>Tráiler Juegos v2</title>')
cab = cab.replace('</style>', open(os.path.join(T, 'estilos2.css')).read() + '</style>')
logo = open(os.path.join(T, 'logo.svg')).read().replace('`', '')
open(os.path.join(T, 'trailer2.html'), 'w').write(cab + 'const LOGO = `' + logo + '`;\n' + open(os.path.join(T, 'timeline2.js')).read() + '\n' + pie)
print('trailer2.html armado')
