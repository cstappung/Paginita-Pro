# Genera clips.json: cuántos cuadros tiene cada toma y qué parte enfocar (coords del cuadro 1920×1080).
import json, os, sys
T = os.path.dirname(os.path.abspath(__file__))
ENFOQUE = {
  'boxhead':     ([0, 0, 1920, 1080], False),
  'tetris':      ([480, 0, 1050, 1080], True),
  'dosmil':      ([370, 50, 720, 1010], True),
  'snake':       ([315, 430, 860, 650], True),
  'aleteo':      ([520, 360, 424, 720], True),
  'bbtan':       ([620, 40, 520, 960], True),
  'yemas':       ([0, 0, 1920, 1080], False),
  'worms':       ([0, 120, 1920, 720], False),
  'haxball':     ([0, 60, 1920, 960], False),
  'fanal':       ([560, 280, 800, 800], True),
  'prodefender': ([20, 120, 1440, 940], False),
  'pd2':         ([20, 120, 1440, 810], False),
  'bbtan2':      ([620, 40, 520, 960], True),
  'sortem':      ([0, 0, 1920, 1080], False),
  'salon':       ([0, 0, 1920, 1080], False),
  'hero':        ([0, 0, 1920, 1080], False),
  'metrorush':   ([0, 0, 1920, 1080], False),
  'boxhead2':    ([0, 0, 1920, 1080], False),
  'yemasz':      ([0, 0, 1920, 1080], False),
  'avion':       ([80, 20, 1760, 990], False),
  'avion2':      ([80, 20, 1760, 990], False),
  'avion3':      ([80, 20, 1760, 990], False),
  'plinko':      ([60, 40, 1300, 731], False),
  'mascota':     ([60, 40, 760, 860], True),
  'sobre':       ([0, 0, 1920, 1080], False),
  'uno':         ([0, 0, 1920, 1080], False),
  'record':      ([0, 0, 1920, 1080], False),
  'record3':     ([0, 0, 1920, 1080], False),
  'pollito':     ([30, 30, 950, 890], True),
  'pdA':         ([10, 80, 1450, 815], False),
  'pdB':         ([10, 80, 1450, 815], False),
  'bbtanA':      ([610, 70, 560, 1000], True),
  'bbtanB':      ([610, 70, 560, 1000], True),
  'aleteoA':     ([500, 290, 450, 790], True),
  'aleteoB':     ([500, 290, 450, 790], True),
  'fanalA':      ([560, 0, 800, 1080], True),
  'fanalB':      ([560, 0, 800, 1080], True),
  'salaAjedrez': ([300, 60, 1320, 1020], False),
  'salaFlip7':   ([0, 100, 1920, 980], False),
  'salaCacho':   ([0, 180, 1920, 900], False),
  'salaCatan':   ([0, 180, 1920, 900], False),
  'salaPresidente': ([0, 100, 1920, 980], False),
  'salaPokemon': ([0, 60, 1920, 1020], False),
  'salaMemazo':  ([48, 300, 1350, 760], False),
  'clue':        ([0, 0, 1920, 1080], False),
}
out = {}
for n, (e, v) in ENFOQUE.items():
    d = os.path.join(T, 'clips', n)
    if os.path.isdir(d): out[n] = {'n': len(os.listdir(d)), 'enfoque': e, 'vertical': v}
json.dump(out, open(os.path.join(T, 'clips.json'), 'w'), indent=1)
print({k: v['n'] for k, v in out.items()})
