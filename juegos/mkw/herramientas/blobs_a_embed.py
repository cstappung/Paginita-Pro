"""Convierte los .S de blobs que genera el traductor (.incbin, sintaxis x86/COFF) en .cpp con #embed para wasm.

Resumen: WiiCompiled mete los datos del juego (secciones del DOL, StaticR ya reubicado, imagen del mod de Retro
Rewind) en el ejecutable con archivos de ensamblador así:

    .globl kData__text
    kData__text:
    .incbin "C:/.../_text.bin"

Ese ensamblador no existe para WebAssembly. Clang (el de Emscripten) acepta #embed (C23, como extensión en C++),
que hace lo mismo desde C++. Este script lee cada .S y escribe un .cpp equivalente:

    extern "C" alignas(16) const uint8_t kData__text[] = {
    #embed "C:/.../_text.bin"
    };

Uso:  python herramientas/blobs_a_embed.py <entrada.S> <salida.cpp>
La salida va a build/ (ignorado por git): contiene datos del juego.
"""
import re
import sys


def convertir(entrada: str, salida: str) -> int:
    texto = open(entrada, encoding="utf-8").read()
    # Cada blob: una etiqueta global seguida (más abajo) de su .incbin
    pares = re.findall(r'^\s*\.globl\s+(\w+)\s*$.*?^\s*\.incbin\s+"([^"]+)"', texto, re.M | re.S)
    if not pares:
        raise SystemExit(f"{entrada}: no encontré ningún .globl + .incbin")
    lineas = [
        f"// Generado por herramientas/blobs_a_embed.py desde {entrada.replace(chr(92), '/')}",
        "// Mismos símbolos que el .S original, pero con #embed (wasm no tiene ese ensamblador).",
        "#include <cstdint>",
        "#pragma clang diagnostic ignored \"-Wc23-extensions\"",
        "",
    ]
    for nombre, ruta in pares:
        lineas += [f'extern "C" alignas(16) const uint8_t {nombre}[] = {{', f'#embed "{ruta}"', "};", ""]
    open(salida, "w", encoding="utf-8", newline="\n").write("\n".join(lineas))
    return len(pares)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    n = convertir(sys.argv[1], sys.argv[2])
    print(f"{sys.argv[2]}: {n} blobs")
