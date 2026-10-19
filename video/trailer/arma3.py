# Arma trailer3.html: cabecera y ayudantes de trailer.html + casino3.js + timeline3.js + el render.
import os
T = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(T, 'trailer.html')).read()
cab = s[:s.index('/* ---------- LA LÍNEA DE TIEMPO ---------- */')]
pie = s[s.index('/* Grano: una textura de ruido fija'):]
cab = cab.replace('const FPS = 30, DUR = 52,', 'const FPS = 30, DUR = 112,').replace('<title>Tráiler Juegos</title>', '<title>Tráiler Juegos v3</title>')
cab = cab.replace('</style>', open(os.path.join(T, 'estilos2.css')).read() + '</style>')
logo = open(os.path.join(T, 'logo.svg')).read().replace('`', '')
lee = lambda n: open(os.path.join(T, n)).read()
open(os.path.join(T, 'trailer3.html'), 'w').write(cab + 'const LOGO = `' + logo + '`;\n' + lee('casino3.js') + '\n' + lee('timeline3.js') + '\n' + pie)
print('trailer3.html armado')
