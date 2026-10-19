# Mezcla final: la pista del tráiler + CHINCHONCHIN en el tramo de PRO HERO (24–32 s), en sincronía con el clip.
# uso: mezcla.py <hero.json> <heroDesde (s dentro del clip)> <salida.wav>
import os, json, subprocess, sys
reg = json.load(open(sys.argv[1])); desde = float(sys.argv[2]); out = sys.argv[3]
f0 = round(desde * 30)
vals = [v for v in reg[f0:f0 + 30] if isinstance(v, (int, float))]
st = vals[0] - (0 if reg[f0] is not None else 0)
print('tiempo de canción al empezar el tramo:', st)
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = (f"[1:a]atrim=start={st:.3f}:duration=8.2,asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo,"
     f"afade=t=in:d=0.08,afade=t=out:st=7.5:d=0.7,adelay=24000|24000,volume=1.15[s];"
     f"[0:a][s]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]")
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', S + '/trailer/musica2.wav', '-i', S + '/hero/songs/chinchonchin/song.ogg',
                '-filter_complex', f, '-map', '[a]', out], check=True)
print('ok', out)
