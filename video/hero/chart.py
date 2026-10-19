# Chart de PRO HERO para la música del tráiler (120 BPM, La menor). Mismas notas que musica.py.
import json, sys, os
RES = 192; B = RES; S16 = RES // 4
PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
notas = []   # (tick, fret, largo)
def n(t, f, l=0): notas.append((int(t), f, int(l)))
def bar(b, beat=0.0): return int((b * 4 + beat) * B)
for b in range(26):
    c = b % 4; sh = 1 if c in (1, 3) else 0
    drop = 4 <= b < 12 or 14 <= b < 22
    if drop and b >= 6:
        # arpegio en semicorcheas: patrón 0,3,2,1 sobre trastes desplazados por acorde; acorde de dos notas en el 1
        n(bar(b), 0 + sh, B); n(bar(b), 2 + sh, B)
        for s in range(2, 16):
            if b >= 14 or s % 2 == 0:
                i = (s * 3) % 4; n(bar(b, s / 4), min(4, [0, 3, 2, 1][i] + sh))
    elif drop:
        for e in range(8):
            if e % 2: n(bar(b, e / 2), (e // 2 + sh) % 5)
        n(bar(b), 0 + sh, B * 2)
    elif b in (12, 13):
        for s in range(8): n(bar(b, s / 2), [0, 1, 2][s % 3] + sh)
    elif b in (2, 3):
        for q in range(4): n(bar(b, q), (q + c) % 3, B // 2)
    elif 22 <= b < 24:
        n(bar(b), 0, B * 3); n(bar(b), 4, B * 3)
# quitar duplicados exactos
notas = sorted(set(notas))
lin = [f"  {t} = N {f} {l}" for t, f, l in notas]
# star power en los compases 14–15 y 18–19
sp = [f"  {bar(14)} = S 2 {B * 8}", f"  {bar(18)} = S 2 {B * 8}"]
txt = f"""[Song]
{{
  Name = "Lanzamiento"
  Artist = "Laboratorio"
  Charter = "Laboratorio"
  Album = "Salón de juegos"
  Year = ", 2026"
  Offset = 0
  Resolution = {RES}
  Genre = "Synthwave"
  MusicStream = "song.ogg"
}}
[SyncTrack]
{{
  0 = TS 4
  0 = B 120000
}}
[Events]
{{
  {bar(4)} = E "section Drop"
  {bar(14)} = E "section Drop 2"
}}
[ExpertSingle]
{{
""" + "\n".join(sorted(lin + sp, key=lambda x: int(x.split('=')[0]))) + "\n}\n"
d = sys.argv[1]
open(os.path.join(d, 'songs/lanzamiento/notes.chart'), 'w').write(txt)
lib = {"scanning": False, "progress": 1, "songs": [{
  "id": "lanzamiento", "folder": "lanzamiento", "chartFile": "notes.chart", "iniFile": None,
  "audio": {"song": "song.ogg"}, "album": None, "preview": None, "length": 52000, "v": 1,
  "parts": {"guitar": {"expert": len(notas)}},
  "meta": {"name": "Lanzamiento", "artist": "Laboratorio", "charter": "Laboratorio", "album": "Salón de juegos", "genre": "Synthwave", "year": "2026", "previewStart": 8000, "diffs": {"guitar": 5}, "loadingPhrase": "Que suene el salón"}}]}
os.makedirs(os.path.join(d, 'api'), exist_ok=True)
json.dump(lib, open(os.path.join(d, 'api/library'), 'w'))
print(len(notas), 'notas')
