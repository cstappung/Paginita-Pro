"""W2 de la etapa 0 del plan v4 (bitácora §199): arma la «isla» de KCLController::IsCollidingImpl (0x807C0884).

Resumen. La isla es la misma función que el traductor escribió, con dos cambios de fondo:
  1) sus datos (los vértices, normales y prismas del mapa de choques de la pista, la KCL) se leen de una «sombra»: una
     copia en el orden de bytes del PC, hecha una vez al cargar la pista; también el controlador (sus primeros 0x6C
     bytes) se copia al entrar, y la pila de la Wii de esta función es un arreglo local;
  2) no guarda ni repone en la memoria de la Wii los registros que la Wii guardaría (r17-r31, f27-f31): son variables
     del C++ y la función que llama los ve sin tocar.
Las cuentas siguen siendo las mismas funciones del runtime (PPC_PsMulInline, PpcFmulsInline…), así salen los mismos
bits; y cada carga o guardado de pares de flotantes pasa por las mismas reglas del runtime (aquietar los NaN de señal,
llevar a cero los subnormales al guardar), con las palabras ya dadas vuelta.

Este programa NO contiene nada del juego: lee el C++ traducido de la carpeta del traductor (terceros/, ignorada) y
escribe la isla en terceros/islas/ (ignorada también): es código derivado del de Nintendo, nunca va a git.
La parte que no es del juego (la sombra, el comprobador, los relojes) está en web/juego/isla_kcl_nativo.cpp.

Uso:  python -I herramientas/islas/generar-kcl.py [terceros/Wiicompiled-motor]
      → terceros/islas/kcl_807C0884.inc
"""
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
WC = RAIZ / (sys.argv[1] if len(sys.argv) > 1 else "terceros/Wiicompiled-motor")
FUNC = "807C0884"
SALIDA = RAIZ / "terceros/islas" / f"kcl_{FUNC}.inc"

# 1) el cuerpo traducido (entre su «#line 1» y el siguiente)
marca = f'#line 1 "func_{FUNC}.cpp"'
shard = next(f for f in (WC / "generated/build_shards/base_common").glob("*.cpp") if marca in f.read_text(encoding="utf-8", errors="ignore"))
texto = shard.read_text(encoding="utf-8")
ini = texto.index(marca) + len(marca)
fin = texto.find('#line 1 "', ini)
cuerpo = texto[ini:fin if fin > 0 else len(texto)]
lineas = cuerpo.split("\n")

def indice(patron, desde=0):
    for i in range(desde, len(lineas)):
        if patron in lineas[i]:
            return i
    sys.exit(f"no encuentro «{patron}» (¿se volvió a traducir distinto?)")

# 2) la firma
i = indice(f'extern "C" void func_{FUNC}(CpuContext* MKW_RESTRICT ctx)')
lineas[i] = f"static void isla_{FUNC}(CpuContext* MKW_RESTRICT ctx, IslaKcl& I)"

# 3) el prólogo: de guardar r1 hasta el final de la hoja que guarda r17-r31 → solo mover r1 y anotar dónde está la pila
a = indice("MemoryInline::FlatWriteRam32((r1 + -224), r1);")
b = indice("// end of inlined leaf 0x80021578", a)
lineas[a:b + 1] = ["    r1 = (r1 + -224);", "    r0 = ctx->lr;", "    r11 = (r1 + 144);", "    I.entrar(r1, r3);"]

# 4) el aviso de error (OSPanic si la distancia diera negativa; no pasa nunca): la isla avisa y el que llama corre la
#    traducida desde el principio (la isla todavía no escribió nada en la memoria de la Wii)
a = indice("ctx->lr = 0x807C0DD0u;")
b = indice("mkw_gqr0 = ctx->gqr[0];", a)
lineas[a:b + 1] = ["    I.panico = true;", "    return;"]

# 5) el epílogo: de reponer f31 hasta el return → devolver r3 (y r4 y f1, que el traductor marca como de salida)
a = indice("loc_807C0EC0:")
b = indice("return;", a)
lineas[a + 1:b + 1] = ["{", "    I.salir(ctx, r3, r4, f1);", "    return;"]

# 6) las cargas y los guardados a la memoria de la Wii → los de la isla
sust = [
    ("MemoryInline::FlatReadFloat32(", "I.lf("),
    ("MemoryInline::FlatRead32(", "I.l32("),
    ("MemoryInline::FlatRead16(", "I.l16("),
    ("PPC_PsqLGqrInline<0u, 0u>(ctx, mkw_gqr0, ", "I.lp2("),
    ("PPC_PsqLGqrInline<1u, 0u>(ctx, mkw_gqr0, ", "I.lp1("),
    ("PPC_PsqLStackInline<0u, 0u>(ctx, ", "I.lp2("),
    ("PPC_PsqLStackInline<1u, 0u>(ctx, ", "I.lp1("),
    ("PPC_PsqStStackInline<0u, 0u>(ctx, ", "I.sp2("),
    ("PPC_PsqStStackInline<1u, 0u>(ctx, ", "I.sp1("),
    ("MemoryInline::FlatWriteRamFloat32(", "I.sf("),
    ("MemoryInline::FlatWriteFloat32(", "I.wf("),
    ("MemoryInline::FlatWrite32(", "I.w32("),
    ("MemoryInline::FlatWrite16(", "I.w16("),
]
salida = "\n".join(lineas)
for de, a_ in sust:
    salida = salida.replace(de, a_)
# lo que quede de memoria o de ctx tiene que ser solo lo esperado (leer el contexto al entrar)
sin_comentarios = re.sub(r"//[^\n]*", "", salida)
resto = sorted(set(re.findall(r"MemoryInline::\w+|PPC_Psq\w+|ctx->\w+", sin_comentarios)))
permitido = {"ctx->cr", "ctx->fpr", "ctx->gpr", "ctx->gqr", "ctx->lr", "ctx->xer", "MemoryInline::ResolveRangeHost"}
if set(resto) - permitido:
    sys.exit(f"quedan accesos sin cambiar: {sorted(set(resto) - permitido)}")
if "MemoryInline::ResolveRangeHost" in sin_comentarios.split("I.entrar", 1)[1]:
    sys.exit("queda un ResolveRangeHost después del prólogo")
# el traductor deja la declaración de las variables de rango: sin uso ahora
SALIDA.parent.mkdir(parents=True, exist_ok=True)
SALIDA.write_text("// GENERADO por herramientas/islas/generar-kcl.py desde el C++ traducido de " + shard.name +
                  " (código derivado del de Nintendo: nunca a git)\n" + salida + "\n", encoding="utf-8")
print(f"{SALIDA.relative_to(RAIZ)}: {salida.count(chr(10))} líneas (de {shard.name})")
