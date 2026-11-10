# W14 (bitácora §217): el análisis de «qué campos del CR hay que guardar», fuera del traductor, para probar reglas sin
# traducir de nuevo (35 min cada vez).
#
# Resumen: lee la forma de cada función que escribió el traductor con MKW_BANDERAS=seguro (build/mkw-banderas-base.txt =
# el juego, build/mkw-banderas-mod.txt = el mod; por bloque: sucesores y operaciones «c» llamada, «i» indirecta,
# «n/m/j» comunes con lo que pisan y leen; «m» = mfcr, el CR entero a un registro; «j» = salto indirecto) y la lista de
# posibles destinos de una indirecta (build/mkw-banderas-indirectas.txt). Calcula lo mismo que MkwBanderasCalcular:
#   R[F] = lo que F lee al entrar; U = la unión de R de los posibles destinos de una indirecta (y todo el mod);
#   X[F] = lo volátil que alguien lee después de que F vuelve; Xind = lo que se lee después de una indirecta.
# e imprime U, Xind y cuántas funciones podrían volver con máscara. Con --mfcr-nv supone que cada mfcr solo lee cr2-cr4
# (el prólogo que guarda los campos no volátiles): NO es seguro en general, sirve para saber cuánto ganaría esa regla.
# Uso:  python -I herramientas/w14/banderas.py [--carpeta terceros/Wiicompiled-motor-seguro/build] [--mfcr-nv] [--sin-mod]
import argparse, bisect, collections, pathlib

ap = argparse.ArgumentParser()
ap.add_argument("--carpeta", default="terceros/Wiicompiled-motor-seguro/build")
ap.add_argument("--mfcr-nv", action="store_true")
ap.add_argument("--m-cero", action="store_true", help="las «m» no leen nada (si son solo el guardado del CR antes de una llamada)")
ap.add_argument("--sin-mod", action="store_true", help="el mod no cuenta entero para U (solo si su dirección está en la lista)")
ap.add_argument("--j-como-i", action="store_true", help="un salto indirecto lee U, como una llamada indirecta (no los 8 campos)")
ap.add_argument("--n-ff-cero", action="store_true", help="las comunes que leen los 8 (las ayudas Ps del catálogo) no leen nada")
ap.add_argument("--mfcr-regla", action="store_true", help="la regla segura del prólogo (mfcr lee cr2-cr4 si todo mtcrf de la función es de cr2-cr4)")
ap.add_argument("--top", type=int, default=15)
args = ap.parse_args()
c = pathlib.Path(args.carpeta)
NV, VOL = 0x1C, 0xE3


def leer(ruta):
    fs, lineas = [], ruta.read_text().splitlines()
    i = 0
    while i < len(lineas):
        p = lineas[i].split(" ")
        if p[0] != "F":
            i += 1
            continue
        n, entrada = int(p[2]), int(p[3])
        suc, ops = [], []
        for b in range(n):
            q = lineas[i + 1 + b].split(" ")
            suc.append([] if q[1] == "-" else [int(x) for x in q[1].split(",")])
            lo = []
            for t in q[2:]:
                k = t[0]
                if k == "c": lo.append(("c", int(t[1:3], 16), 0, int(t[3:11], 16), k))
                elif k == "i": lo.append(("i", int(t[1:3], 16), 0, 0, k))
                else:
                    lee = int(t[3:5], 16)
                    if k == "m" and args.mfcr_nv: lee &= NV
                    if k == "m" and args.m_cero: lee = 0
                    if k == "n" and lee == 0xFF and args.n_ff_cero: lee = 0
                    if k == "j" and args.j_como_i: lo.append(("i", int(t[1:3], 16), 0, 0, k)); continue
                    lo.append(("n", int(t[1:3], 16), lee, 0, k))
            ops.append(lo)
        if args.mfcr_regla:
            # la regla segura del prólogo: si la función restaura el CR solo con mtcrf de campos no volátiles (las «x»
            # que pisan sin leer: mtcrf, mcrxr, mcrfs) y tiene al menos uno, su mfcr lee solo cr2-cr4
            pisan = [op[1] for blo in ops for op in blo if op[4] == "x" and op[2] == 0 and op[1]]
            if pisan and all(m & ~NV & 0xFF == 0 for m in pisan):
                ops = [[(o[0], o[1], o[2] & NV, o[3], o[4]) if o[4] == "m" else o for o in blo] for blo in ops]
        fs.append((p[1], entrada, suc, ops))
        i += 1 + n
    return fs


todas = leer(c / "mkw-banderas-base.txt") + leer(c / "mkw-banderas-mod.txt")
indir = {int(x, 16) for x in (c / "mkw-banderas-indirectas.txt").read_text().split()}
print(f"{len(todas):,} funciones; {len(indir):,} posibles destinos de una indirecta")
por_entrada = collections.defaultdict(list)
for i, f in enumerate(todas): por_entrada[int(f[0][2:], 16)].append(i)
entradas = sorted(por_entrada)
adentro = set()


def destinos(a):
    if a in por_entrada: return por_entrada[a]
    k = bisect.bisect_right(entradas, a) - 1
    adentro.add(a)
    return por_entrada[entradas[k]] if k >= 0 else []


dest = {}
for f in todas:
    for blo in f[3]:
        for op in blo:
            if op[0] == "c" and op[3] not in dest: dest[op[3]] = destinos(op[3])
cuenta_u = [(not args.sin_mod and f[0].startswith("m:")) or int(f[0][2:], 16) in indir for f in todas]
print(f"{sum(cuenta_u):,} cuentan para U")


def vivo(f, salida, llamada, despues=None):
    _, entrada, suc, ops = f
    n = len(ops)
    if n == 0: return salida
    ent, sal = [0] * n, [0] * n
    cambio = True
    while cambio:
        cambio = False
        for b in range(n - 1, -1, -1):
            v = salida if not suc[b] else 0
            for s in suc[b]: v |= salida if s < 0 else ent[s]
            fuera = v
            for op in reversed(ops[b]):
                v = (v & ~op[1] & 0xFF) | op[2]
                if op[0] != "n": v = llamada(op, v)
            if v != ent[b] or fuera != sal[b]: ent[b], sal[b], cambio = v, fuera, True
    if despues:
        for b in range(n):
            v = sal[b]
            for op in reversed(ops[b]):
                if op[0] != "n": despues(op, v)
                v = (v & ~op[1] & 0xFF) | op[2]
                if op[0] != "n": v = llamada(op, v)
    return ent[entrada]


r, u = [0] * len(todas), 0
def lee(a, r):
    if a in adentro or not dest.get(a): return 0xFF
    m = 0
    for j in dest[a]: m |= r[j]
    return m
for vuelta in range(1, 201):
    nuevo = [vivo(f, 0, lambda op, v: v | (lee(op[3], r) if op[0] == "c" else u)) for f in todas]
    un = 0
    for i, v in enumerate(nuevo):
        if cuenta_u[i]: un |= v
    cambio = un != u or nuevo != r
    r, u = nuevo, un
    if not cambio: break
print(f"R: {vuelta} vueltas; U = 0x{u:02X}; {sum(1 for v in r if v):,} funciones leen algo al entrar")
# quién lee volátiles al entrar POR SÍ MISMA (sin contar sus llamadas), entre las que cuentan para U
propias = collections.Counter()
for i, f in enumerate(todas):
    if not cuenta_u[i]: continue
    m = vivo(f, 0, lambda op, v: v)
    if m & VOL:
        marcas = "".join(sorted({op[4] for blo in f[3] for op in blo if op[0] == "n" and op[2] & VOL}))
        propias[(f[0], m, marcas)] += 1
print(f"funciones de U que leen algo volátil por sí mismas: {len(propias):,}; por tipo de operación:",
      dict(collections.Counter(k[2] for k in propias)))
for (clave, m, marcas), _ in list(propias.items())[: args.top]: print(f"  {clave} lee 0x{m:02X} ({marcas})")

x, xind = [0] * len(todas), 0
for vuelta in range(1, 201):
    aporte, ap_ind = [0] * len(todas), 0
    def desp(op, v):
        global ap_ind
        vol = v & VOL
        if not vol: return
        if op[0] == "i": ap_ind |= vol
        else:
            for j in dest[op[3]]: aporte[j] |= vol
    for i, f in enumerate(todas):
        vivo(f, NV | x[i] | xind, lambda op, v: v | (lee(op[3], r) if op[0] == "c" else u), desp)
    cambio = False
    for i in range(len(x)):
        if x[i] | aporte[i] != x[i]: x[i] |= aporte[i]; cambio = True
    if xind | ap_ind != xind: xind |= ap_ind; cambio = True
    if not cambio: break
salidas = [NV | x[i] | xind for i in range(len(todas))]
print(f"X: {vuelta} vueltas; Xind = 0x{xind:02X}; con máscara al volver: {sum(1 for s in salidas if s != 0xFF):,} de "
      f"{len(todas):,}; campos guardados de media {sum(bin(s).count('1') for s in salidas) / len(salidas):.2f} de 8")
