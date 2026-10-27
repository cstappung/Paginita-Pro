"""Genera web/headless/aurora_vacia.cpp: las funciones de aurora que el juego llama, vacías (para Node).

Resumen: cuando el juego corre sin pantalla, las funciones de gráficos (GX), video (VI), mandos (PAD) y ventana
(aurora_*) no tienen nada que hacer. Pero tienen que EXISTIR, o el enlazador no puede armar el programa. Escribir
~150 a mano es lento y fácil de equivocar (cada una con sus tipos exactos), así que este script:
  1. lee la lista de nombres que faltan (un archivo con un nombre por línea, sacado con llvm-nm),
  2. busca la declaración de cada una en las cabeceras de aurora (aurora-main/include),
  3. escribe un cuerpo vacío que devuelve "cero" del tipo que corresponda (nada, 0, false, nullptr o {}).
Las que necesitan responder algo con sentido están escritas a mano en web/headless/aurora_manual.cpp y aquí se
saltan.

Uso:  python herramientas/generar_aurora_vacia.py <nombres.txt>
"""
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
INCLUDE = RAIZ / "terceros/Wiicompiled/aurora-main/include"
MANUAL = RAIZ / "web/headless/aurora_manual.cpp"
SALIDA = RAIZ / "web/headless/aurora_vacia.cpp"


def sin_comentarios(texto: str) -> str:
    texto = re.sub(r"/\*.*?\*/", " ", texto, flags=re.S)
    return re.sub(r"//[^\n]*", " ", texto)


def declaraciones() -> dict:
    """nombre -> (tipo_devuelto, argumentos, cabecera) de cada prototipo en las cabeceras de aurora."""
    protos = {}
    patron = re.compile(r"(?:^|[;{}\n])\s*((?:const\s+)?[A-Za-z_][\w\s\*]*?[\s\*])([A-Za-z_]\w*)\s*\(([^()]*)\)\s*;")
    for h in sorted(INCLUDE.rglob("*.h")):
        texto = sin_comentarios(h.read_text(encoding="utf-8", errors="replace"))
        for tipo, nombre, args in patron.findall(texto):
            tipo = " ".join(tipo.split())
            if tipo.startswith(("return", "typedef", "else")) or nombre in protos:
                continue
            protos[nombre] = (tipo, " ".join(args.split()), h.relative_to(INCLUDE).as_posix())
    return protos


def nombres_manuales() -> set:
    # sin comentarios: un "(...)" dentro de un comentario confundiría la búsqueda
    texto = sin_comentarios(MANUAL.read_text(encoding="utf-8"))
    return set(re.findall(r"\b([A-Za-z_]\w*)\s*\([^;{()]*\)\s*(?:noexcept\s*)?\{", texto))


def cero(tipo: str) -> str:
    t = tipo.replace("extern", "").replace("static", "").replace("inline", "").strip()
    if t == "void":
        return ""
    if "*" in t:
        return "return nullptr;"
    if t in ("bool", "BOOL", "GXBool"):
        return "return false;"
    return "return {};"


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    pedidos = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
    protos, manuales = declaraciones(), nombres_manuales()
    cabeceras, cuerpos, sin_declaracion = set(), [], []
    for nombre in pedidos:
        if nombre in manuales:
            continue
        if nombre not in protos:
            sin_declaracion.append(nombre)
            continue
        tipo, args, cab = protos[nombre]
        cabeceras.add(cab)
        nombres_args = []
        # los argumentos no se usan: se dejan sin nombre para que no haya avisos
        cuerpos.append(f'extern "C" {tipo} {nombre}({args}) {{ {cero(tipo)} }}'.replace("{  }", "{}"))
    lineas = [
        "// GENERADO por herramientas/generar_aurora_vacia.py — no editar a mano.",
        "// Funciones de aurora que el juego llama y que, sin pantalla (Node), no hacen nada.",
        "// Las que deben responder algo con sentido están en aurora_manual.cpp.",
        *[f"#include <{c}>" for c in sorted(cabeceras)],
        "",
        *cuerpos,
        "",
    ]
    SALIDA.write_text("\n".join(lineas), encoding="utf-8", newline="\n")
    print(f"{SALIDA.relative_to(RAIZ)}: {len(cuerpos)} funciones vacías, {len(pedidos) - len(cuerpos) - len(sin_declaracion)} a mano")
    if sin_declaracion:
        print("sin declaración en aurora (van a mano o son del runtime):", " ".join(sin_declaracion))


if __name__ == "__main__":
    main()
