# W12, el techo (bitácora §215): arma terceros/Wiicompiled-motor-w12t = la rama e2-h6 con el código traducido
# reescrito para que cada acceso a la pila de la Wii (dirección r1 + k) pase por MKW_PILA (herramientas/w12/pila-doble.h).
#
# Resumen: no copia nada grande. La carpeta nueva es un espejo de terceros/Wiicompiled-motor-h6 hecho con «junctions»
# (atajos de carpeta de Windows) a todo, salvo generated/build_shards, que se escribe de nuevo: cada .cpp leído, los
# accesos «MemoryInline::FlatXxx((r1 + …» y «MemoryInline::XxxResolvedYyy(rango, n, (r1 + …» envueltos en MKW_PILA(…),
# y guardado. Imprime cuántos envolvió de cada tipo. Es el código del juego traducido: la carpeta está en terceros/
# (ignorada), nunca a git.
# Uso:  python -I herramientas/w12/techo.py [--fuente terceros/Wiicompiled-motor-h6] [--destino terceros/Wiicompiled-motor-w12t]
import argparse, collections, os, pathlib, re, subprocess

raiz = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument("--fuente", default="terceros/Wiicompiled-motor-h6")
ap.add_argument("--destino", default="terceros/Wiicompiled-motor-w12t")
args = ap.parse_args()
fuente, destino = raiz / args.fuente, raiz / args.destino


def junction(enlace, objetivo):  # un atajo de carpeta (no hace falta ser administrador)
    subprocess.run(["cmd", "/c", "mklink", "/J", str(enlace), str(objetivo.resolve())], check=True,
                   stdout=subprocess.DEVNULL)


# 1) el espejo: todo con atajos menos generated/, y dentro de generated/ todo con atajos menos build_shards/
destino.mkdir(parents=True, exist_ok=True)
for e in fuente.iterdir():
    d = destino / e.name
    if e.name == "generated" or d.exists() or os.path.lexists(d):
        continue
    junction(d, e) if e.is_dir() else d.write_bytes(e.read_bytes())
gen_f, gen_d = (fuente / "generated").resolve(), destino / "generated"
gen_d.mkdir(exist_ok=True)
for e in gen_f.iterdir():
    d = gen_d / e.name
    if e.name == "build_shards" or os.path.lexists(d):
        continue
    junction(d, e) if e.is_dir() else d.write_bytes(e.read_bytes())

# 2) los shards reescritos: el acceso directo «MemoryInline::FlatRead32((r1 + » y el de un rango ya resuelto
#    «MemoryInline::ReadResolved32(guest_range_3, 8u, (r1 + »
directo = re.compile(r"MemoryInline::(Flat(?:Read|Write)\w*)\(\(r1 \+")
rango = re.compile(r"MemoryInline::((?:Read|Write)Resolved\w*)\((guest_range_\d+, \d+u, )\(r1 \+")
cuenta = collections.Counter()


def envolver_directo(m):
    cuenta[m.group(1)] += 1
    return f"MKW_PILA(MemoryInline::{m.group(1)})((r1 +"


def envolver_rango(m):
    cuenta[m.group(1)] += 1
    return f"MKW_PILA(MemoryInline::{m.group(1)})({m.group(2)}(r1 +"


shards_f = gen_f / "build_shards"
for f in shards_f.rglob("*"):
    d = gen_d / "build_shards" / f.relative_to(shards_f)
    if f.is_dir():
        d.mkdir(parents=True, exist_ok=True)
        continue
    d.parent.mkdir(parents=True, exist_ok=True)
    if f.suffix != ".cpp":
        d.write_bytes(f.read_bytes())
        continue
    texto = f.read_text(encoding="utf-8")
    texto = rango.sub(envolver_rango, directo.sub(envolver_directo, texto))
    if not d.exists() or d.read_text(encoding="utf-8") != texto:  # no tocar lo igual: compilar-web.py no lo rehace
        d.write_text(texto, encoding="utf-8", newline="")

for nombre, n in sorted(cuenta.items()):
    print(f"{n:8d} {nombre}")
print(f"{sum(cuenta.values()):8d} en total: {destino.relative_to(raiz)}")
