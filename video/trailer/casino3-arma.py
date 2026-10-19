# Arma casino3-prueba.html: cabecera de trailer.html + casino3.js, solo las dos escenas del casino.
import os
T = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(T, 'trailer.html')).read()
cab = s[:s.index('/* ---------- LA LÍNEA DE TIEMPO ---------- */')]
pie = s[s.index('/* Grano: una textura de ruido fija'):]
cab = cab.replace('<title>Tráiler Juegos</title>', '<title>Casino v3</title>').replace('</style>', open(os.path.join(T, 'estilos2.css')).read() + '</style>')
esc = '''
function escena(t) {
  const r = t < DUR_AVION ? casinoAvion(t) : casinoPlinko(t - DUR_AVION);
  return { tomas: r.tomas, textos: r.textos, flash: r.flash, barras: 0, grano: true };
}
'''
open(os.path.join(T, 'casino3-prueba.html'), 'w').write(cab + open(os.path.join(T, 'casino3.js')).read() + esc + pie)
print('casino3-prueba.html armado')
