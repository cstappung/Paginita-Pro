# W13, el techo (bitácora §216): arma terceros/Wiicompiled-motor-w13t = la rama e2-h6 con el código traducido
# reescrito para que cada lectura y escritura del contexto de la CPU (ctx->…) pase por MKW_CTX_L / MKW_CTX_E
# (herramientas/w13/ctx-doble.h). Copia de herramientas/w12/techo.py con otras reglas de reescritura.
#
# Resumen: no copia nada grande. La carpeta nueva es un espejo de terceros/Wiicompiled-motor-h6 hecho con «junctions»
# (atajos de carpeta de Windows) a todo, salvo generated/build_shards, que se escribe de nuevo: cada .cpp leído, los
# lecturas «x = ctx->gpr[3];» envueltas en MKW_CTX_L(…) y cada escritura «ctx->gpr[3] = r3;» seguida de
# MKW_CTX_E(ctx->gpr[3]);, y guardado. Imprime cuántos envolvió de cada tipo. Es el código del juego traducido: la carpeta está en terceros/
# (ignorada), nunca a git.
# Uso:  python -I herramientas/w13/techo.py [--fuente terceros/Wiicompiled-motor-h6] [--destino terceros/Wiicompiled-motor-w13t]
import argparse, collections, os, pathlib, re, subprocess

raiz = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument("--fuente", default="terceros/Wiicompiled-motor-h6")
ap.add_argument("--destino", default="terceros/Wiicompiled-motor-w13t")
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

# 2) los shards reescritos: la lectura «= ctx->gpr[3];» y la escritura «ctx->gpr[3] = r3;» (una línea entera)
campo = r"ctx->[a-z_]+[0-9]*(?:\[[0-9]+\])?(?:\.[a-z_0-9]+)?"
lectura = re.compile(r"= (" + campo + r");")
escritura = re.compile(r"^(\s*)(" + campo + r") = ([^;\n]+);[ \t]*$", re.M)
cuenta = collections.Counter()


def envolver_lectura(m):
    cuenta["lecturas"] += 1
    return f"= MKW_CTX_L({m.group(1)});"


def envolver_escritura(m):
    cuenta["escrituras"] += 1
    return f"{m.group(1)}{m.group(2)} = {m.group(3)}; MKW_CTX_E({m.group(2)});"


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
    texto = lectura.sub(envolver_lectura, escritura.sub(envolver_escritura, texto))
    if not d.exists() or d.read_text(encoding="utf-8") != texto:  # no tocar lo igual: compilar-web.py no lo rehace
        d.write_text(texto, encoding="utf-8", newline="")

for nombre, n in sorted(cuenta.items()):
    print(f"{n:8d} {nombre}")
print(f"{sum(cuenta.values()):8d} en total: {destino.relative_to(raiz)}")
