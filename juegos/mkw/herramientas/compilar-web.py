"""Compila Mario Kart Wii + Retro Rewind completo a WebAssembly (runtime + librerías + datos + juego traducido).

Resumen: es nuestra "receta" de compilación para la web, en vez del CMake de WiiCompiled (que solo conoce
Windows, Linux y Mac). Escribe un archivo build/web/build.ninja con un paso por cada archivo fuente y le pide a
Ninja que lo ejecute en paralelo; Ninja solo recompila lo que cambió. Al final enlaza todo en un solo programa.

Piezas (cada una con sus opciones de compilación, iguales a las del CMake original):
  - runtime:     terceros/Wiicompiled/runtime/src (la "Wii falsa"), menos los extras de escritorio
  - semantica:   ppc_helpers / fpu_helpers / ppc_quantized: matemática del procesador, sin atajos de punto flotante
  - web:         nuestro código para la web (web/headless: aurora sin pantalla, extras de escritorio vacíos;
                 en modo navegador web/navegador: el puente con la página)
  - aurora:      (solo modo navegador) aurora de verdad: GX -> WebGPU, ventana, mandos; y sus librerías
                 abseil, fmt, imgui, sqlite (bajadas con herramientas/bajar-deps-aurora.sh)
  - terceros:    Crypto++ (firmas de la Wii), pugixml (lee el XML de Riivolution), xxhash
  - datos:       las secciones del DOL/REL y los parches de Retro Rewind, metidas con #embed (ver blobs_a_embed.py)
  - juego:       los shards traducidos (juego base + Retro Rewind)
  - thp:         (los dos modos) funciones nativas que reemplazan a las traducidas: el decodificador de video THP
                 (web/thp, §47) y la búsqueda de archivos en el índice del disco (web/dvd, §50)

Uso:  python herramientas/compilar-web.py [--modo node|navegador] [--hilos 16] [--solo-compilar]
Salida: build/web/<modo>/mkw.js + mkw.wasm  (ignorado por git: contiene el juego).

Los dos modos comparten los objetos (.o) del runtime y del juego: se compilan una sola vez en build/web/node/obj
(la carpeta se llama "node" porque ese modo llegó primero) y cada modo solo cambia su parte (aurora sin pantalla
o aurora de verdad) y el enlace final.
"""
import argparse
import os
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
# MKW_WIICOMPILED=terceros/Wiicompiled-motor: otra copia del traductor y su C++ (paso 6 del plan, §170), sin tocar la de siempre
WC = RAIZ / os.environ.get("MKW_WIICOMPILED", "terceros/Wiicompiled")
RT = WC / "runtime"
# MKW_AURORA=terceros/aurora-main-viejo-motor: aurora desde otra carpeta (N15a, §170: el runtime v0.9.3 con nuestra
# aurora ya portada); por omisión la de adentro de WC
AU_DIR = (RAIZ / os.environ["MKW_AURORA"]) if os.environ.get("MKW_AURORA") else WC / "aurora-main"
EMSDK = RAIZ / "herramientas/emsdk"
EMXX = EMSDK / "upstream/emscripten/em++.exe"

# Archivos del runtime que en la web NO se compilan, y por qué
EXCLUIDOS = {
    "guest_flat_memory_macos.cpp": "solo Mac",
    "guest_flat_memory.cpp": "memoria plana con VirtualAlloc/mmap; en wasm va guest_flat_memory_wasm.cpp",
    "host_cpu_baseline.cpp": "revisa instrucciones de CPU x86; en wasm no aplica",
    "discord_presence.cpp": "Discord del PC (vacío en web/headless/escritorio_vacio.cpp)",
    "settings_overlay.cpp": "menú F10 con imgui (vacío en escritorio_vacio.cpp)",
    "controller_mapping_wizard.cpp": "asistente de mandos con imgui",
    "product/base_product.cpp": "el producto es Retro Rewind, no el juego base",
}
SEMANTICA = {"ppc_helpers.cpp", "fpu_helpers.cpp", "ppc_quantized.cpp"}


def rutas(p: pathlib.Path) -> str:
    return p.as_posix()


def cmd_q(s: str) -> str:
    """Comillas para la línea de comandos de Windows (Ninja no usa shell: comillas dobles, no simples)."""
    return f'"{s}"' if (" " in s or "'" in s) else s


def ninja_esc(s: str) -> str:
    return s.replace("$", "$$").replace(":", "$:").replace(" ", "$ ")


# Fuentes de aurora: las mismas listas que aurora-main/cmake/aurora_{core,gx,pad,si,mtx,vi}.cmake, menos lo de
# Mac/Metal. dawn/BackendBinding.cpp sí va: nuestro parche le agrega el caso "canvas del navegador".
# lib/dolphin/pad/pad.cpp NO va: los mandos los pone la página (web/navegador/pad_web.cpp).
AURORA_FUENTES = """
lib/aurora.cpp lib/input.cpp lib/window.cpp lib/logging.cpp lib/system_info.cpp lib/imgui.cpp lib/imgui_config.cpp
lib/webgpu/gpu.cpp lib/webgpu/gpu_cache.cpp lib/webgpu/metalfx_stub.cpp lib/dawn/BackendBinding.cpp
lib/gfx/clear.cpp lib/gfx/common.cpp lib/gfx/depth_peek.cpp lib/gfx/efb_ram_copy.cpp lib/gfx/efb_ram_encoder.cpp
lib/gfx/pipeline_cache.cpp lib/gfx/dds_io.cpp lib/gfx/tex_copy_conv.cpp lib/gfx/tex_palette_conv.cpp
lib/gfx/texture.cpp lib/gfx/texture_convert.cpp lib/gfx/texture_replacement.cpp lib/gfx/png_io.cpp
lib/gx/command_processor.cpp lib/gx/fifo.cpp lib/gx/frame_interpolation.cpp lib/gx/gx.cpp lib/gx/pipeline.cpp
lib/gx/shader.cpp lib/gx/shader_info.cpp
lib/dolphin/gx/GXBump.cpp lib/dolphin/gx/GXCull.cpp lib/dolphin/gx/GXCpu2Efb.cpp lib/dolphin/gx/GXDispList.cpp
lib/dolphin/gx/GXDraw.cpp lib/dolphin/gx/GXExtra.cpp lib/dolphin/gx/GXFifo.cpp lib/dolphin/gx/GXFrameBuffer.cpp
lib/dolphin/gx/GXGeometry.cpp lib/dolphin/gx/GXGet.cpp lib/dolphin/gx/GXLighting.cpp lib/dolphin/gx/GXManage.cpp
lib/dolphin/gx/GXPixel.cpp lib/dolphin/gx/GXTev.cpp lib/dolphin/gx/GXTexture.cpp lib/dolphin/gx/GXTransform.cpp
lib/dolphin/gx/GXVert.cpp lib/dolphin/gx/GXAurora.cpp
lib/dolphin/si/si.cpp lib/dolphin/vi/vi.cpp
lib/dolphin/mtx/mtx.c lib/dolphin/mtx/mtxstack.c lib/dolphin/mtx/mtxvec.c lib/dolphin/mtx/mtx44.c
lib/dolphin/mtx/vec.c lib/dolphin/mtx/quat.c
""".split()
# Partes de abseil que usan flat_hash_map y btree (y lo que ellas necesitan). Se compila la carpeta entera menos
# pruebas; el enlazador descarta lo que nadie usa.
ABSEIL_CARPETAS = ["base", "container", "hash", "numeric", "profiling", "synchronization", "time", "debugging",
                   "strings", "types", "crc"]


def unidades_aurora(AU: pathlib.Path, DEP: pathlib.Path):
    u = [("aurora_finita" if f.endswith("frame_interpolation.cpp") else "aurora", AU / f) for f in AURORA_FUENTES]
    for c in ABSEIL_CARPETAS:
        for f in sorted((DEP / "abseil/absl" / c).rglob("*.cc")):
            if re.search(r"(_test|_benchmark|_testing|test_util|_mock|mocking|gtest|print_hash_of|test_helpers|"
                         r"_test_common|benchmarks)\w*\.cc$|/testdata/|/tests?/", f.as_posix()):
                continue
            u.append(("librerias", f))
    u.append(("librerias", DEP / "fmt/src/format.cc"))
    u += [("librerias", DEP / "imgui" / f) for f in
          ["imgui.cpp", "imgui_demo.cpp", "imgui_draw.cpp", "imgui_tables.cpp", "imgui_widgets.cpp",
           "misc/cpp/imgui_stdlib.cpp", "backends/imgui_impl_sdl3.cpp", "backends/imgui_impl_sdlrenderer3.cpp",
           "backends/imgui_impl_wgpu.cpp"]]
    u.append(("librerias", DEP / "sqlite/sqlite3.c"))
    return u


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modo", default="node", choices=["node", "navegador"])
    ap.add_argument("--hilos", type=int, default=os.cpu_count() or 8)
    ap.add_argument("--solo-compilar", action="store_true")
    # SIMD (-msimd128: instrucciones de wasm que hacen 4 cuentas a la vez) va prendido para TODO (runtime, juego,
    # aurora): mismos bits (paridad 22/0) y ~13 % menos trabajo en las pantallas pesadas (bitácora §42).
    # --sin-simd: compilar sin SIMD, para comparar, en un taller aparte (build/web-sin-simd/) que no pisa el normal;
    # el servidor lo sirve con MKW_BUILD=build/web-sin-simd/navegador y Node con MKW_BUILD_NODE=build/web-sin-simd/node.
    ap.add_argument("--sin-simd", action="store_true")
    # --carpeta build/web-xxx: compilar en un taller propio (objetos + salida), p. ej. cuando otra sesión de trabajo
    # usa build/web al mismo tiempo. Servirlo con MKW_BUILD=build/web-xxx/navegador (Node: MKW_BUILD_NODE=…/node).
    ap.add_argument("--carpeta", default=None)
    # --salida build/web-xxx/navegador: solo el ENLACE va a otra carpeta (los objetos siguen compartidos). Sirve para
    # probar un cambio mientras otra prueba usa el mkw.wasm de siempre. Servirlo con MKW_BUILD=<esa carpeta>.
    ap.add_argument("--salida", default=None)
    # --final: el programa que se publica (bitácora §54): sin los nombres de las funciones (--profiling-funcs, 2,7 MB
    # que solo sirven para los perfiles) y comprimido al final (herramientas/comprimir-build.mjs: mkw.wasm.br/.gz,
    # lo que el Worker entrega).
    ap.add_argument("--final", action="store_true")
    # --memoria-inicial N (MB): el heap con que arranca el programa (C9, §141). El juego usa ~250 MB (sbrk medido en la
    # carrera con 11 CPU); con 320 sobra y, si hiciera falta más, crece solo (ALLOW_MEMORY_GROWTH). 512 = como antes
    ap.add_argument("--memoria-inicial", type=int, default=320)
    # --memoria-fija N (MB) (W29, bitácora §239; apagada por omisión = 0): la memoria del programa NO crece. Se enlaza con
    # ALLOW_MEMORY_GROWTH=0 e INITIAL_MEMORY=N: el tamaño es una constante y V8 no tiene que releerlo en cada acceso
    # (en Android, que revisa los límites a mano, eso cuesta). Si el programa pidiera más de N, se cae: N debe cubrir el
    # pico (~250 MB usados de verdad, §141) con margen. Con --fija (RAM de la Wii en lugar fijo) manda esta opción.
    ap.add_argument("--memoria-fija", type=int, default=0)
    # (§244, W29 adoptado) --final lleva la memoria fija si no se pide otra: 768 MB con la ventana de H6 (--fija: 385 MB
    # de la Wii + el heap; el pico medido en 11 pistas es 510) y 512 sin ella (pico 278). --memoria-crece = como antes
    ap.add_argument("--memoria-crece", action="store_true")
    # --fija(H6 de la etapa 2, bitácora §211): la RAM de la Wii en un lugar fijo de la memoria de wasm (MKW_MOTOR_FIJA de
    # runtime/include/mkw_motor.h, solo en la copia del motor que lo trae). La ventana va de 1 MiB a 385 MiB: lo de C++
    # empieza después (-sGLOBAL_BASE). La memoria inicial = --memoria-inicial + 240 MB (560 con 320): la ventana se lleva
    # MEM1 y MEM2 (~154 MB que antes salían del heap) y suma el hueco de 232 MB entre Kamek y la MEM2, que nadie toca:
    # Windows lo cuenta como memoria privada (reservada), pero no ocupa RAM de verdad (la física no crece: §211).
    ap.add_argument("--fija", action="store_true")
    ap.add_argument("--frio", default=None)   # (H11, §214) la cabecera de lo frío de herramientas/h11-caliente.mjs
    # Cierre de E2 (bitácora §218, decidido por la orquestadora): --final lleva lo adoptado en la etapa 2 por omisión:
    # --fija (H6) si la copia del motor lo trae (MKW_MOTOR_FIJA en runtime/include/mkw_motor.h; --sin-fija = sin ella) y
    # ThinLTO de M7 (MKW_LTO con los grupos de §213 si no viene puesto; MKW_LTO= vacío = sin LTO)
    ap.add_argument("--sin-fija", action="store_true")
    ap.add_argument("--sin-pgo", action="store_true")   # (W25, §228.2) --final sin el perfil de PGO
    args = ap.parse_args()
    args.simd = not args.sin_simd
    if args.final and not args.sin_fija and not args.fija:
        cabecera = WC / "runtime/include/mkw_motor.h"
        if cabecera.exists() and "MKW_MOTOR_FIJA" in cabecera.read_text(encoding="utf-8", errors="replace"):
            args.fija = True
            print("--final: con --fija (H6, la copia del motor la trae)")
    if args.final and not args.memoria_fija and not args.memoria_crece:
        args.memoria_fija = 768 if args.fija else 512
        print(f"--final: con --memoria-fija {args.memoria_fija} (W29, §244; --memoria-crece = que crezca como antes)")
    if args.final and "MKW_LTO" not in os.environ:
        os.environ["MKW_LTO"] = "runtime,aurora,aurora_finita,web,puente,thp"
        print("--final: con ThinLTO de M7 (MKW_LTO=runtime,aurora,aurora_finita,web,puente,thp)")
    # W25 (E4c, bitácora §228.2, adoptado por la orquestadora): --final compila guiado por un perfil (PGO). El perfil lo
    # arma o lo reusa herramientas/pgo_final.py (el programa que cuenta en <carpeta>-pgo-gen, las 3 carreras de
    # herramientas/pgo/, la partida base de §175); va fuera del repositorio (lleva nombres del juego). --sin-pgo o
    # MKW_PGO=0 = sin él. (Va antes de MKW_CHICAS: la llamada de adentro aplica sus chicas por su cuenta.)
    ap_pgo = args.final and not args.sin_pgo and os.environ.get("MKW_PGO") != "0" and \
        os.environ.get("MKW_PGO_HIJO") != "1" and "-fprofile-instr" not in os.environ.get("MKW_CFLAGS_EXTRA", "")
    if ap_pgo:
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
        import pgo_final
        banderas = pgo_final.preparar(RAIZ, args.carpeta or "build/web", EMSDK)
        os.environ["MKW_CFLAGS_EXTRA"] = " ".join(os.environ.get("MKW_CFLAGS_EXTRA", "").split() + banderas)
        print("--final: con PGO (" + banderas[0] + ")")
    # E4c (W25, docs/evaluacion-chicas.md): MKW_CHICAS="c2,c3,…" = las mejoras chicas, cada una con su marca. Sin la
    # variable, nada cambia. c2 = las texturas CMPR en BC1 por omisión (aurora, MKW_CHICA_C2; la página: ?texturasBc=0
    # las apaga); c3 = las funciones calientes de §181.2 por omisión (MKW_CALIENTE_COMPILAR + MKW_CALIENTE_DEF=1, sin la
    # variante SIMD; ?caliente=0 = la traducida); c4 = el memo de las indirectas con 2048 casillas (§193); c7 = una pasada
    # más de Binaryen con -O3 al enlazar (§54). c5 y c6 son del traductor (MKW_M8=seguro, MKW_BANDERAS=seguro): se eligen
    # al traducir, no aquí.
    chicas = set(filter(None, os.environ.get("MKW_CHICAS", "").replace(" ", "").lower().split(",")))
    if chicas:
        extra = os.environ.get("MKW_CFLAGS_EXTRA", "").split()
        if "c3" in chicas:
            os.environ["MKW_CALIENTE_COMPILAR"] = "1"
            extra.append("-DMKW_CALIENTE_DEF=1")
        if "c4" in chicas:
            extra.append("-DMKW_MOTOR_MEMO_INDIRECTA=2048")
        os.environ["MKW_CFLAGS_EXTRA"] = " ".join(extra)
        print(f"E4c: las chicas {','.join(sorted(chicas))}")

    carpeta = args.carpeta or ("build/web-sin-simd" if args.sin_simd else "build/web")
    sal = RAIZ / (args.salida or f"{carpeta}/{args.modo}")   # aquí queda mkw.js + mkw.wasm de este modo
    obra = RAIZ / carpeta / "node"           # "taller" compartido: build.ninja, objetos, archivos generados
    obj = obra / "obj"
    gen = obra / "gen"
    gen.mkdir(parents=True, exist_ok=True)
    sal.mkdir(parents=True, exist_ok=True)
    navegador = args.modo == "navegador"

    # 1) Datos del juego: .S con .incbin -> .cpp con #embed
    blobs = [
        (WC / "generated/data_sections_init_blobs.S", gen / "data_sections_init_blobs.cpp"),
        (WC / "build/mods/retro_rewind_full_cpp/cpp/mod_data_patches_blobs.S", gen / "mod_data_patches_blobs.cpp"),
    ]
    sys.path.insert(0, str(RAIZ / "herramientas"))
    from blobs_a_embed import convertir
    for s, c in blobs:
        if not c.exists() or c.stat().st_mtime < s.stat().st_mtime:
            convertir(str(s), str(c))

    incs = [RT / "include", RT / "src", WC, AU_DIR / "include", RT / "third_party",
            RT / "third_party/pugixml", RT / "third_party/toml11", RAIZ / "terceros/xxhash-dl/xxHash-0.8.4"]
    base = ["-std=c++20", "-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm", "-w", "--use-port=sdl3",
            "-DTARGET_PC", "-DSDL_MAIN_HANDLED", "-DNOMINMAX",
            "-D_DISABLE_STRING_ANNOTATION", "-D_DISABLE_VECTOR_ANNOTATION",
            "-DCRYPTOPP_DISABLE_ASM", "-DCRYPTOPP_NO_GLOBAL_BYTE"] + [f"-I{rutas(i)}" for i in incs]
    if args.simd:
        base.append("-msimd128")
    # MKW_CFLAGS_EXTRA="-DALGO": opciones extra para runtime y juego, para experimentos en un taller aparte
    # (--carpeta), p. ej. prender o apagar un cambio del runtime con una macro y comparar los dos builds (§47).
    base += os.environ.get("MKW_CFLAGS_EXTRA", "").split()
    if args.fija:
        base.append("-DMKW_MOTOR_FIJA=1")
    # W10 (§207): el programa del instrumento del dibujo en otro Worker marca la página de cada escritura (MKW_SUCIAS
    # en memory_access.h): tiene que llegar a todo el juego y al runtime
    if os.environ.get("MKW_W10_COMPILAR") == "1":
        base.append("-DMKW_SUCIAS")
    # v0.9.3 (N15a, §170): el traductor anota en su manifiesto para qué región tradujo; el código traducido y
    # runtime/game se arman con esa región (en la versión vieja no existe y no se agrega nada)
    manifiesto = WC / "generated/build_shards/shards.cmake"
    m = re.search(r"set\(MKW_TRANSLATED_GUEST_REGION (\d+)\)", manifiesto.read_text(encoding="utf-8")) if manifiesto.exists() else None
    if m:
        base.append(f"-DMKW_TRANSLATED_GUEST_REGION={m.group(1)}")
    traducido = ["-O2", "-fno-fast-math", "-ffp-contract=off", "-fno-slp-vectorize"]
    banderas = {
        "runtime": base + ["-O3", "-ffast-math"],
        "semantica": base + traducido,
        "web": base + ["-O2"],
        "terceros": base + ["-O2"],
        "datos": base + ["-O1"],
        "juego": base + traducido,
    }

    # ---- aurora de verdad (modo navegador) ----
    AU = AU_DIR
    DEP = RAIZ / "terceros/deps-aurora"
    au_incs = [AU / "include", AU / "lib", DEP / "abseil", DEP / "fmt/include", DEP / "imgui",
               DEP / "sqlite", DEP / "tracy/public", RAIZ / "terceros/xxhash-dl/xxHash-0.8.4"]
    # Opciones de aurora iguales a las del CMake de WiiCompiled (-O3 -ffast-math), sin WEBGPU_DAWN (esa marca
    # prende el código de Dawn nativo; en la web WebGPU lo pone el navegador vía emdawnwebgpu).
    # ENABLE_BACKEND_WEBGPU: aurora ya trae esa marca para la web (pone "WebGPU" en su lista de motores gráficos)
    au_def = ["-DAURORA", "-DTARGET_PC", "-DAURORA_ENABLE_GX", "-DENABLE_BACKEND_WEBGPU", "-DNOMINMAX", "-DIMGUI_IMPL_WEBGPU_BACKEND_DAWN",
              "-DIMGUI_USER_CONFIG=<aurora/imgui_config.h>", "-DIMGUI_DISABLE_OBSOLETE_FUNCTIONS"]
    puertos = ["--use-port=sdl3", "--use-port=emdawnwebgpu", "-sUSE_LIBPNG=1", "-sUSE_ZLIB=1"]
    au_base = (["-std=c++20", "-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm", "-w"] + puertos + au_def +
               [f"-I{rutas(i)}" for i in au_incs] + (["-msimd128"] if args.simd else []))
    # Paso 8 (§186): MKW_CFLAGS_TODO = opciones para TODAS las unidades, también aurora y sus librerías (p. ej. -pthread:
    # con memoria compartida, cada objeto tiene que estar compilado con atomics; MKW_CFLAGS_EXTRA no llega a aurora)
    base += os.environ.get("MKW_CFLAGS_TODO", "").split()
    au_base += os.environ.get("MKW_CFLAGS_TODO", "").split()
    if "c2" in chicas:   # E4c C2: las texturas BC1 (herramientas/e4c/portar-c2.py las puso en la aurora del motor)
        au_base.append("-DMKW_CHICA_C2=1")
    if navegador:
        # fmt 11.1.4 usa malloc/free sin incluir <cstdlib> (el CMake de aurora lo arregla igual para MinGW)
        au_base_cpp = au_base + ["-include", "cstdlib"]
        banderas["aurora"] = au_base_cpp + ["-O3", "-ffast-math"]
        # frame_interpolation.cpp exige NaN/Inf reales (el CMake original le quita -ffinite-math-only)
        banderas["aurora_finita"] = au_base_cpp + ["-O3", "-ffast-math", "-fno-finite-math-only"]
        banderas["librerias"] = au_base + ["-O2"]
        # El puente con la página (web/navegador) incluye cabeceras del runtime Y de aurora
        banderas["puente"] = base + ["-O2"] + puertos[1:2] + au_def + [f"-I{rutas(i)}" for i in au_incs]

    unidades = []  # (grupo, fuente)
    for f in sorted((RT / "src").rglob("*.cpp")):
        rel = f.relative_to(RT / "src").as_posix()
        if rel in EXCLUIDOS:
            continue
        unidades.append(("semantica" if rel in SEMANTICA else "runtime", f))
    # v0.9.3 (N15a, §170): lo propio del juego se mudó a runtime/game (la región, la configuración, la versión)
    for f in sorted((RT / "game").glob("*.cpp")) if (RT / "game").is_dir() else []:
        unidades.append(("runtime", f))
    if navegador:
        # aurora sin pantalla NO; solo los extras de escritorio vacíos + el puente con la página
        unidades.append(("web", RAIZ / "web/headless/escritorio_vacio.cpp"))
        unidades.append(("web", RAIZ / "web/headless/v093_vacio.cpp"))   # N15a: vacío con el runtime de siempre
        for f in sorted((RAIZ / "web/navegador").glob("*.cpp")):
            unidades.append(("puente", f))
        unidades += unidades_aurora(AU, DEP)
    else:
        for f in sorted((RAIZ / "web/headless").glob("*.cpp")):
            unidades.append(("web", f))
    cripto = [f for f in sorted((RT / "third_party/cryptopp").glob("*.cpp"))
              if not re.search(r"/(adhoc|bench[123]|datatest|dlltest|fipsalgt|fipstest|pch|regtest[1234]|simple|test|validat[0-9]+)\.cpp$", f.as_posix())
              and not re.search(r"(_avx|_ppc|_simd|_sse)\.cpp$", f.name)]
    unidades += [("terceros", f) for f in cripto]
    unidades += [("terceros", RT / "third_party/pugixml/pugixml.cpp"),
                 ("terceros", RAIZ / "terceros/xxhash-dl/xxHash-0.8.4/xxhash.c")]
    unidades += [("datos", WC / "generated/data_sections_init.cpp"),
                 ("datos", WC / "generated/guest_symbol_table.cpp"),
                 ("datos", WC / "build/mods/retro_rewind_full_cpp/cpp/mod_data_patches.cpp")]
    unidades += [("datos", c) for _, c in blobs]
    for grupo in ["base_common", "retro_portable_sensitive", "retro_mod",
                  "retro_rewind_registration", "retro_rewind_dispatch"]:
        unidades += [("juego", f) for f in sorted((WC / "generated/build_shards" / grupo).glob("*.cpp"))]

    # Funciones del juego reemplazadas por una versión nativa nuestra (bitácora §47 y §50), sin volver a traducir:
    # el shard donde vive la traducida se COPIA a gen/ con solo su DEFINICIÓN renombrada (func_X → func_X_traducida)
    # y se compila esa copia; el archivo nuestro define func_X. Así TODAS las llamadas del juego le llegan a la nuestra:
    # las de otros shards, las de las tablas y también las del mismo shard (con -Dfunc_X=… las del mismo shard se
    # iban a la traducida: DVD::Open vive en el mismo shard que DVD::ConvertPathToEntrynum). La copia es código del
    # juego traducido: queda en build/ (ignorado por git), nunca en el repo.
    #   func_801B3BAC = THPVideoDecode (el video de elegir copa/pista) -> web/thp/thp_nativo.cpp
    #   func_8015DF4C = DVD::ConvertPathToEntrynum (nombre de archivo → número en el índice del disco)
    #                   -> web/dvd/rutas_nativo.cpp (recuerda las respuestas: la búsqueda recorría ~7 500 entradas)
    #   func_8052F924 = RacedataScenario::InitRng (las semillas del azar de la carrera)
    #                   -> web/juego/semillas_nativo.cpp (la de la página en «Copa a tu gusto», §56)
    REEMPLAZOS = {"func_801B3BAC": "func_801B3BAC_traducida", "func_8015DF4C": "func_8015DF4C_traducida",
                  "func_8052F924": "func_8052F924_traducida",
                  # SectionPad::GetFirstDeactivatedPad -> semillas_nativo.cpp (en la carrera sincronizada los humanos de
                  # otras consolas no pausan con «mando desconectado», §73)
                  "func_8061B9BC": "func_8061B9BC_traducida",
                  "rr_overlay_8052FB90": "rr_overlay_8052FB90_traducida",   # §73: RacedataScenario::Init de RR (pantalla propia)
                  "func_807F1094": "func_807F1094_traducida",   # §73: CtrlRaceNameBalloon::UpdatePosition (globos sin pantalla)
                  # MEMAllocFromExpHeapEx / MEMAllocFromFrmHeapEx / ClipInfoMgr::Update / AI::Character::UpdateLookAtCamera
                  # -> web/juego/lockstep_nativo.cpp
                  # (memoria en cero y todo "a la vista" en la carrera sincronizada, §61)
                  "func_80198D88": "func_80198D88_traducida", "func_801994E4": "func_801994E4_traducida",
                  "func_80787774": "func_80787774_traducida", "func_807379BC": "func_807379BC_traducida",
                  # ModelDirector::SetAllScnOptionsFromClipInfo / SetDisableDrawScnOptionsFromClipInfo -> lockstep_nativo.cpp
                  # (§179, G1: el dibujo recorta con las marcas de verdad; la lógica sigue con «todo a la vista»)
                  "func_8055D448": "func_8055D448_traducida", "func_8055D554": "func_8055D554_traducida",
                  "func_80564D60": "func_80564D60_traducida",   # ScnMgr::DrawMain (§179.2: el dibujo entero)
                  "func_807EC7F8": "func_807EC7F8_traducida", "func_807F7E80": "func_807F7E80_traducida",
                  "func_80536054": "func_80536054_traducida", "func_8020FE24": "func_8020FE24_traducida", "rr_kamek_81806568": "rr_kamek_81806568_traducida",
                  # OS::GetTick LLAMADO (no copiado adentro): en la carrera sincronizada da el reloj de la carrera; lo usan
                  # el sorteo de reserva de los objetos de Pulsar y los objetos condicionales de RR (§83, la C2)
                  "func_801AAD74": "func_801AAD74_traducida",
                  # Raceinfo::Update (la de RR) y RacedataScenario::UpdatePoints -> lockstep_nativo.cpp: el fin de la
                  # carrera en la sala con las reglas del juego (tiempo límite; terminar en un cuadro pedido, pruebas) y
                  # los puntos una vez por carrera, igual en todas las consolas (§75)
                  "rr_overlay_805331B4": "rr_overlay_805331B4_traducida", "func_8052E950": "func_8052E950_traducida",
                  # Page::Activate -> web/juego/paginas_nativo.cpp (avisa a la página qué pantalla se activó: ocultar.mjs, §66)
                  "func_80601AEC": "func_80601AEC_traducida",
                  # SectionMgr::Update (la versión de RR) -> web/juego/directo_nativo.cpp (abrir directo una sección
                  # pedida por la página: elige la licencia y llama a SetNextSection/RequestSceneChange, §71)
                  "rr_overlay_8063550C": "rr_overlay_8063550C_traducida",
                  # y SectionMgr::Init (la de RR): con un pedido ya puesto, la primera sección del juego es la pedida
                  # (sin título ni licencias, §73)
                  "rr_overlay_80634E44": "rr_overlay_80634E44_traducida",
                  # y Page::ChangeSectionBySceneChange (la de RR): al confirmar el derrape en «elegir personaje» por
                  # pedido de la página, no sigue a la copa: avisa lo elegido (§73)
                  "rr_overlay_806024B0": "rr_overlay_806024B0_traducida",
                  # (y MenuInteractable::LoadNextPageById / LoadNextPageWithDelayById: en la sección 0x49 el derrape pasa a
                  # la página de copas sin cambiar de sección)
                  "func_80837720": "func_80837720_traducida", "func_8083761C": "func_8083761C_traducida",
                  # DecideTrack y DecideCC de Pulsar y SetPlayerData (el voto) -> web/juego/modos_nativo.cpp (la pista de
                  # la playlist y la cilindrada del anfitrión en los modos de la sala, §72)
                  "rr_kamek_81864290": "rr_kamek_81864290_traducida", "rr_kamek_81864878": "rr_kamek_81864878_traducida",
                  "rr_overlay_80660750": "rr_overlay_80660750_traducida",
                  # GMDataOnlineVS: el control de inactividad (30 s sin tocar nada) -> modos_nativo.cpp: ahí la prueba
                  # puede dar la carrera por terminada (mkw_modos_terminar), §72
                  "func_8053F184": "func_8053F184_traducida",
                  # y el de Retro Rewind por velocidad (kart casi quieto): en nuestras salas no se saca a nadie, §73
                  "rr_overlay_8053EE50": "rr_overlay_8053EE50_traducida",
                  # Input::Manager::Update (la de RR) -> web/juego/mandos_virtuales_nativo.cpp: después de los 4 mandos reales, los
                  # botones de los humanos de la sala sin puerto van a su portador virtual (más de 4 humanos, §91)
                  "rr_overlay_805238F0": "rr_overlay_805238F0_traducida",
                  # la lista de humanos de la IA (4 lugares) -> mandos_virtuales_nativo.cpp: desde el 5.º no se anota (§91)
                  "func_807414B8": "func_807414B8_traducida",
                  # y el reparto de pantallas y mandos (el de RR): solo para los 4 primeros humanos (§91)
                  "rr_overlay_8052F4E8": "rr_overlay_8052F4E8_traducida",
                  # Ghosts::Mgr::LoadCorrectMainGhost de Pulsar -> fantasma_pagina_nativo.cpp: el fantasma del mejor de la página (§92)
                  "rr_kamek_81814B0C": "rr_kamek_81814B0C_traducida",
                  # AI::Params::Load e ItemSlotData::DecideItem (las de RR) -> cpu_dificultad_nativo.cpp: los niveles de la CPU
                  # de la página, más altos que los del juego; «máximo» = todo al tope (M20, §96)
                  "rr_overlay_8073ACA8": "rr_overlay_8073ACA8_traducida", "rr_overlay_807BB42C": "rr_overlay_807BB42C_traducida",
                  # §99 (M23): «intenso» e «imposible» -> cpu_dificultad_nativo.cpp: GetCustomKartAIParam de Pulsar (la tabla del
                  # Hard AI de RR la elige la página, no el ajuste guardado), ApplyPlayerStatChanges de Pulsar (las estadísticas
                  # de cada kart de CPU al crearlo) y Movement::UpdateAcceleration de RR (el tope de velocidad de las CPU)
                  "rr_kamek_81830C50": "rr_kamek_81830C50_traducida", "rr_kamek_81839710": "rr_kamek_81839710_traducida",
                  "rr_overlay_8057B9BC": "rr_overlay_8057B9BC_traducida",
                  # Racedata_InitRace de Pulsar -> directo_nativo.cpp: el espejo de verdad (fuera de línea RR convierte la marca
                  # de espejo del menú en «100cc»; la página la pone en la carrera, después de Pulsar, §96)
                  "rr_kamek_81855954": "rr_kamek_81855954_traducida",
                  # CharacterSelect::OnInit (la de RR) -> nombres_nativo.cpp: un Mii en cada casilla de humano de la sala, para
                  # que el globo y las tablas del juego lleven su nombre (M22, §98)
                  "rr_overlay_8083D55C": "rr_overlay_8083D55C_traducida"}
    if os.environ.get("MKW_DEPURAR") == "1":              # depuración de la red (web/juego/depurar_red.cpp, §58)
        REEMPLAZOS.update({f"func_{d}": f"func_{d}_traducida" for d in ("800CCC68", "800D1D90", "800D0FEC", "806561A8", "80656FF8", "80653DDC", "800D2000", "800DAD9C", "800FBA4C", "800E8814", "80623054", "80666288", "8063519C", "8067552C", "80635A3C", "80635AC8", "80635B2C")}); REEMPLAZOS["rr_overlay_80635A3C"] = "rr_overlay_80635A3C_traducida"
        REEMPLAZOS["rr_kamek_818B4854"] = "rr_kamek_818B4854_traducida"   # CheckPacket de Pulsar -> depurar_paquetes.cpp (§72)
    # El azar de la carrera sincronizada (sala con CPU, bitácora §61): en estas funciones del juego, la lectura del
    # reloj del procesador (PPC_Mftb) pasa a PPC_MftbCarrera (ppc_helpers.cpp), que en la sala es un contador igual en
    # todas las consolas. Son las que siembran azar con el reloj: Random::__ct y Random::Reset (la IA de los CPU y casi
    # todo lo demás), Item::SlotData::Init/DecideItem/SetupOnlineVSProbabilities (los objetos de las cajas) y
    # RaceTimerMgrBase/RaceTimerMgr::Reset. Las otras lecturas (tiempos de carga, sonido, alarmas) siguen con el reloj real.
    # 80550730 = GetTick (lo llaman las funciones de objetos, también 0x807BBE98, que no lee el reloj por su cuenta)
    # 80750AAC y 807DC048 (§70): arman un Random propio (new de 24 bytes) con la semilla sacada del reloj por un
    # OSGetTick copiado adentro (no pasa por Random::__ct). La copa al azar 65.0/75.0/39.0/74.1 (semilla 3549642503) se
    # desincronizaba en el cuadro 6046 de la carrera 1: una CPU elegía otra acción con el mismo número del azar 1
    RELOJ_CARRERA = ["80555464", "805554D0", "807BAF48", "807BB42C", "807BBD60", "80532D44", "80535864", "80550730",
                     "80750AAC", "807DC048"]
    # "Vista propia" en la carrera sincronizada (§61): estas funciones de SONIDO y del HUD preguntan quién tiene la
    # pantalla (Racedata::GetPlayerIdOfLocalPlayer, 0x80531F70) para saber de qué kart es "lo propio" (el motor que
    # suena como tuyo, el aviso del caparazón azul, el globo del objeto…). La tabla de pantallas es la misma en todas
    # las consolas (la mira la lógica), así que solo aquí la pregunta se cambia por mkw_vista_propia_v0: mi puesto.
    VISTA_PROPIA = ["806F77D4", "806F7828", "806F7AA8", "806F8188", "806FD0AC", "80711514", "8071497C", "80716608",
                    "80718F84", "80719044",                                   # Audio::*
                    "807EBF20", "807F132C", "807F1D44", "807F1DB4", "807F22BC", "807F7C6C"]   # CtrlRace*, RaceBalloons
    if os.environ.get("MKW_DEPURAR_LS") == "1":           # depuración temporal de la carrera sincronizada (§61)
        REEMPLAZOS.update({f"func_{d}": f"func_{d}_traducida" for d in ("80555578", "805555CC", "80555628", "805556A8", "807351DC", "80732678", "8023C920", "8051BC78")})
        # y las que llevan Random::next copiado adentro (la constante del multiplicador): quién mueve azar1/azar2
        genfun = WC / "generated/functions"
        vigiladas = sorted(f.stem[5:] for f in genfun.glob("func_*.cpp") if "= -1293680640;" in f.read_text(encoding="utf-8", errors="ignore")
                           and f.stem not in REEMPLAZOS and f.stem[5:] != "80555578")
        REEMPLAZOS.update({f"func_{d}": f"func_{d}_traducida" for d in vigiladas})
        envolturas = gen / "depurar_azar_gen.cpp"
        envolturas.write_text('#include "ppc_runtime.h"' + chr(10) + 'extern "C" void mkw_vigila_azar(const char*, CpuContext*, void (*)(CpuContext*));' + chr(10)
                              + "".join(f'extern "C" void func_{d}_traducida(CpuContext*); extern "C" void func_{d}(CpuContext* c) {{ mkw_vigila_azar("{d}", c, func_{d}_traducida); }}' + chr(10) for d in vigiladas),
                              encoding="utf-8")
        print(f"depuración: {len(vigiladas)} funciones con el azar copiado adentro, vigiladas")
    banderas["thp"] = base + ["-O3"]
    unidades += [("thp", RAIZ / "web/thp" / f) for f in ("thp_decodificador.cpp", "thp_nativo.cpp")]
    unidades += [("thp", RAIZ / "web/dvd/rutas_nativo.cpp"), ("thp", RAIZ / "web/juego/semillas_nativo.cpp"),
                ("thp", RAIZ / "web/juego/lockstep_nativo.cpp"), ("thp", RAIZ / "web/juego/paginas_nativo.cpp"),
                ("thp", RAIZ / "web/juego/directo_nativo.cpp"), ("thp", RAIZ / "web/juego/modos_nativo.cpp"),
                ("thp", RAIZ / "web/juego/invitados_nativo.cpp"),   # §86: las caras de los Mii invitados
                ("thp", RAIZ / "web/juego/mandos_virtuales_nativo.cpp"),   # §91: más de 4 humanos en la sala
                ("thp", RAIZ / "web/juego/fantasma_pagina_nativo.cpp"),    # §92: la Contrarreloj contra el mejor de la página
                ("thp", RAIZ / "web/juego/cpu_dificultad_nativo.cpp"),     # §96: los niveles de la CPU de la página
                ("thp", RAIZ / "web/juego/nombres_nativo.cpp"),            # §98: los nombres de la sala en el juego
                ("thp", RAIZ / "web/juego/graficos_nativo.cpp")]           # §252 (G11): los caminos de dibujo opcionales
    # G11 (§252): brillo, profundidad de campo, sombras por volumen y mapa de luz de EGG -> graficos_nativo.cpp
    # G13 (§254): y las partículas de la carrera (el dibujo de Effects::Mgr, 0x8067CF74; con W10 lo envuelve w10_nativo.cpp)
    REEMPLAZOS.update({f"func_{d}": f"func_{d}_traducida" for d in ("8021CCC0", "8021EEC0", "80220D7C", "802218EC", "8067CF74")})
    # N14 (§181): las funciones calientes reescritas y su comprobador (web/juego/caliente_nativo.cpp; MKW_CALIENTE=0|1|2
    # al correr). Por ahora solo con MKW_CALIENTE_COMPILAR=1: así los programas de las otras sesiones no cambian.
    CALIENTE = ["func_80199D64", "func_8019A91C", "func_80085AB0"]
    if os.environ.get("MKW_CALIENTE_COMPILAR") == "1":
        REEMPLAZOS.update({f: f"{f}_traducida" for f in CALIENTE})
        unidades += [("juego", RAIZ / "web/juego/caliente_nativo.cpp")]   # (las banderas del juego: sin fast-math, sin contraer)
    # W1 (§196): ¿el dibujo es un sumidero? y las páginas que ensucia la carrera (web/juego/sumidero_nativo.cpp, fotos de
    # la memoria alrededor de EGG::SceneManager::draw y de ScnMgr::SwitchScnRoot). Solo con MKW_SUMIDERO_COMPILAR=1
    if os.environ.get("MKW_SUMIDERO_COMPILAR") == "1":
        REEMPLAZOS.update({"func_8023AEAC": "func_8023AEAC_traducida", "func_805635E4": "func_805635E4_traducida"})
        unidades += [("thp", RAIZ / "web/juego/sumidero_nativo.cpp")]
    # W3 (§200): el techo del dibujo nativo de la pista (web/juego/techo_dibujo_nativo.cpp: anota el modelo de la pista
    # al cargarlo y, con el modo 1, lo esconde antes de cada dibujo). Solo con MKW_TECHO_COMPILAR=1 (no con el sumidero:
    # los dos envuelven EGG::SceneManager::draw)
    if os.environ.get("MKW_TECHO_COMPILAR") == "1":
        REEMPLAZOS.update({"func_8078E1B0": "func_8078E1B0_traducida", "rr_overlay_8078E1B0": "rr_overlay_8078E1B0_traducida",
                           "func_8023AEAC": "func_8023AEAC_traducida",
                           # §222 (E4): los techos de los karts, los objetos y los efectos
                           "func_805B1CD8": "func_805B1CD8_traducida", "func_805625A8": "func_805625A8_traducida",
                           "func_802251DC": "func_802251DC_traducida"})
        unidades += [("thp", RAIZ / "web/juego/techo_dibujo_nativo.cpp")]
    # W10 (§207): el techo y el costo de la caja del dibujo en otro Worker (web/juego/w10_nativo.cpp: salta
    # EGG::SceneManager::draw con la carrera andando y junta las páginas marcadas). Solo con MKW_W10_COMPILAR=1 (no con
    # el sumidero ni el techo de W3: los tres envuelven EGG::SceneManager::draw)
    if os.environ.get("MKW_W10_COMPILAR") == "1":
        REEMPLAZOS.update({"func_8023AEAC": "func_8023AEAC_traducida", "func_80244268": "func_80244268_traducida",
                           "func_8023AE60": "func_8023AE60_traducida",
                           # W11 (§209): las pruebas de saltar efectos, el gestor de sonido y el hilo de sonido
                           "func_8067CB88": "func_8067CB88_traducida", "func_802135D0": "func_802135D0_traducida",
                           "func_800A4AF0": "func_800A4AF0_traducida",
                           # W10 parte B (§240): el dibujo de los efectos en B (para probar si es lo que se cuelga)
                           "func_8067CF74": "func_8067CF74_traducida"})
        unidades += [("thp", RAIZ / "web/juego/w10_nativo.cpp")]
    # W32 (§258): la IA de las CPU piensa uno de cada dos cuadros (web/juego/ia30_nativo.cpp: envuelve la entrada del
    # cerebro de cada kart, func_807261B8; ?ia30=1 en la página, MKW_IA30=1 en Node). Solo con MKW_IA30_COMPILAR=1: así
    # el programa de jugar y los de las otras sesiones no cambian
    if os.environ.get("MKW_IA30_COMPILAR") == "1":
        REEMPLAZOS.update({"func_807261B8": "func_807261B8_traducida"})
        unidades += [("thp", RAIZ / "web/juego/ia30_nativo.cpp")]
    # N8 (§219): simular a 60, dibujar a 30 y mostrar 60 (web/juego/n8_nativo.cpp: con la carrera andando salta uno de
    # cada dos EGG::SceneManager::draw y su copia a la pantalla; apagado por omisión, ?n8=1|2). En el programa de
    # siempre (modo navegador: necesita la aurora de §219), salvo con los instrumentos que también envuelven el dibujo
    N8 = navegador and "aurora_mkw_n8" in (AU_DIR / "lib" / "aurora.cpp").read_text(encoding="utf-8", errors="replace") and not any(os.environ.get(v) == "1" for v in ("MKW_SUMIDERO_COMPILAR", "MKW_TECHO_COMPILAR", "MKW_W10_COMPILAR"))
    if N8:
        REEMPLAZOS.update({"func_8023AEAC": "func_8023AEAC_traducida", "func_80244268": "func_80244268_traducida"})
        unidades += [("thp", RAIZ / "web/juego/n8_nativo.cpp")]
    # W2 (§199): la colisión con la pista como isla (web/juego/isla_kcl_nativo.cpp + terceros/islas/kcl_807C0884.inc,
    # que arma herramientas/islas/generar-kcl.py). Solo con MKW_ISLA_COMPILAR=1; con las banderas del juego
    if os.environ.get("MKW_ISLA_COMPILAR") == "1":
        if not (RAIZ / "terceros/islas/kcl_807C0884.inc").exists():
            sys.exit("falta terceros/islas/kcl_807C0884.inc: correr antes python -I herramientas/islas/generar-kcl.py")
        REEMPLAZOS["func_807C0884"] = "func_807C0884_traducida"
        unidades += [("juego", RAIZ / "web/juego/isla_kcl_nativo.cpp")]
    # la red del juego hacia la página (socket/connect/sendto… propios, bitácora §58): en los dos modos, porque el
    # runtime llama a mkw_red_cerrar/mkw_red_bloqueante; en Node no hay Module.mkwRed y todo da "red apagada"
    unidades += [("thp", RAIZ / "web/red/red_web.cpp")]
    if os.environ.get("MKW_DEPURAR") == "1":
        unidades += [("thp", RAIZ / "web/juego/depurar_red.cpp"), ("thp", RAIZ / "web/juego/depurar_paquetes.cpp")]
    if os.environ.get("MKW_DEPURAR_LS") == "1":
        unidades += [("thp", RAIZ / "web/juego/depurar_lockstep.cpp"), ("thp", gen / "depurar_azar_gen.cpp")]
    copias = {}                                           # shard original → texto con las definiciones renombradas
    for nombre, nuevo_nombre in REEMPLAZOS.items():
        definicion = f'#line 1 "{nombre}.cpp"'.encode()   # el traductor pega aquí el cuerpo de la función
        donde = [i for i, (g, f) in enumerate(unidades) if g in ("juego", "juego_reemplazo") and definicion in f.read_bytes()]
        if len(donde) != 1:
            sys.exit(f"{nombre}: se esperaba 1 shard que la defina y hay {len(donde)} (¿se volvió a traducir distinto?)")
        original = unidades[donde[0]][1]
        texto = copias.get(original) or original.read_text(encoding="utf-8")
        cabecera = f'extern "C" void {nombre}(CpuContext* MKW_RESTRICT ctx)'
        if texto.count(cabecera) != 1:
            sys.exit(f"{nombre}: no encuentro su definición en {original.name}")
        copias[original] = texto.replace(cabecera, f'extern "C" void {nuevo_nombre}(CpuContext* MKW_RESTRICT ctx)')
        unidades[donde[0]] = ("juego_reemplazo", original)
    for sitio, d in enumerate(RELOJ_CARRERA):
        marca = f'#line 1 "func_{d}.cpp"'
        donde = [i for i, (g, f) in enumerate(unidades) if g in ("juego", "juego_reemplazo") and marca.encode() in f.read_bytes()]
        if not donde:
            sys.exit(f"func_{d}: no encuentro el shard que la define (RELOJ_CARRERA)")
        for i in donde:                                   # (alguna vive en dos shards: la base y la de Retro Rewind)
            original = unidades[i][1]
            texto = copias.get(original) or original.read_text(encoding="utf-8")
            ini = texto.index(marca)
            fin = texto.find('#line 1 "', ini + len(marca))
            fin = len(texto) if fin < 0 else fin
            cuerpo = texto[ini:fin]
            if "PPC_Mftb()" not in cuerpo:
                sys.exit(f"func_{d}: ya no lee el reloj (¿se volvió a traducir distinto?)")
            # cada función con su número (sitio) y el lr del momento: el reloj por lugar (ppc_helpers.cpp, §62)
            # (la versión "_statefree" de la función, que algunos llaman directo, no tiene ctx: ahí el lugar es solo la función)
            partes = re.split(r'(?=extern "C" [^\n]*_statefree\()', cuerpo)
            cuerpo = "".join(t.replace("PPC_Mftb()", f"PPC_MftbCarreraEn({sitio}u, 0u)" if "_statefree(" in t.split(chr(10), 1)[0]
                                       else f"PPC_MftbCarreraEn({sitio}u, ctx->lr)") for t in partes)
            texto = texto[:ini] + cuerpo + texto[fin:]
            if not texto.startswith('extern "C" unsigned int PPC_MftbCarreraEn(unsigned int, unsigned int);'):
                texto = 'extern "C" unsigned int PPC_MftbCarreraEn(unsigned int, unsigned int);' + chr(10) + texto
            copias[original] = texto
            unidades[i] = ("juego_reemplazo", original)
    # §83: semillas_nativo.cpp pone en cero, al empezar cada carrera sincronizada, la semilla del sorteo de reserva de
    # los objetos de Pulsar. Su dirección (0x818A0C28) sale de este Retro Rewind: si se vuelve a traducir otro, avisar
    # en vez de escribir en cualquier lado
    marca = b'#line 1 "rr_kamek_81836190.cpp"'
    trozo = next((f.read_bytes() for g, f in unidades if g in ("juego", "juego_reemplazo") and marca in f.read_bytes()), b"")
    trozo = trozo[trozo.find(marca):]
    trozo = trozo[:trozo.find(b'#line 1 "', len(marca)) % (len(trozo) + 1)]   # solo esa función
    if b"r27 = 0x818A0000u;" not in trozo or b"FlatRead32((r27 + 3112))" not in trozo or b"0x801AAD74u" not in trozo:
        sys.exit("rr_kamek_81836190: el sorteo de reserva de Pulsar ya no es el de 0x818A0C28 (semillas_nativo.cpp, §83)")
    # MKW_DEPURAR_RELOJ=1 (§83, depuración de la C2): TODAS las otras lecturas del reloj del procesador (PPC_Mftb) de
    # las funciones del juego pasan por PPC_MftbVigia(función, lr) (web/juego/depurar_reloj.cpp), que en la carrera
    # sincronizada anota quién leyó el reloj y en qué cuadro. Si una de esas lecturas decide algo de la carrera, las
    # consolas se separan (cada una lee su propio reloj): así se ve cuál falta en RELOJ_CARRERA.
    if os.environ.get("MKW_DEPURAR_RELOJ") == "1":
        vigiladas_reloj = 0
        for i, (g, f) in enumerate(unidades):
            if g not in ("juego", "juego_reemplazo") or b"PPC_Mftb()" not in f.read_bytes():
                continue
            texto = copias.get(f) or f.read_text(encoding="utf-8")
            trozos = re.split(r'(?=#line 1 ")', texto)
            for k, t in enumerate(trozos):
                if "PPC_Mftb()" not in t:
                    continue
                m = re.match(r'#line 1 "(?:func|rr_overlay|rr_kamek)_([0-9A-Fa-f]{8})\.cpp"', t)
                dir_ = int(m.group(1), 16) if m else 0
                partes = re.split(r'(?=extern "C" [^\n]*_statefree\()', t)
                trozos[k] = "".join(p.replace("PPC_Mftb()", f"PPC_MftbVigia({dir_}u, 0u)" if "_statefree(" in p.split(chr(10), 1)[0]
                                            else f"PPC_MftbVigia({dir_}u, ctx->lr)") for p in partes)
                vigiladas_reloj += 1
            texto = "".join(trozos)
            if not texto.startswith('extern "C" unsigned int PPC_MftbVigia(unsigned int, unsigned int);'):
                texto = 'extern "C" unsigned int PPC_MftbVigia(unsigned int, unsigned int);' + chr(10) + texto
            copias[f] = texto
            unidades[i] = ("juego_reemplazo", f)
        unidades.append(("thp", RAIZ / "web/juego/depurar_reloj.cpp"))
        print(f"depuración del reloj: {vigiladas_reloj} funciones que leen el reloj, vigiladas")
    VISTA_FN = ('#ifndef MKW_VISTA_PROPIA' + chr(10) + '#define MKW_VISTA_PROPIA' + chr(10) +
                'extern "C" int g_mkwRelojFijo; extern "C" int g_mkwMiPuesto; extern "C" int g_mkwVistaPropia;' + chr(10) +
                'static inline uint64_t mkw_vista_propia_v0(uint32_t r3, uint32_t r4) {' + chr(10) +
                '    if (g_mkwRelojFijo && (g_mkwVistaPropia & 1) && g_mkwMiPuesto >= 0 && g_mkwMiPuesto < 12) return static_cast<uint32_t>(g_mkwMiPuesto);' + chr(10) +
                '    return static_cast<uint32_t>(static_cast<int32_t>(static_cast<int8_t>(MemoryInline::FlatRead8(r3 + r4 + 2948u))));' + chr(10) +
                '}' + chr(10) + '#endif' + chr(10))
    for d in VISTA_PROPIA:
        marcas = [f'#line 1 "func_{d}.cpp"', f'#line 1 "rr_overlay_{d}.cpp"']
        donde = [i for i, (g, f) in enumerate(unidades) if g in ("juego", "juego_reemplazo") and any(m.encode() in f.read_bytes() for m in marcas)]
        if not donde:
            sys.exit(f"func_{d}: no encuentro el shard que la define (VISTA_PROPIA)")
        cambiadas = 0                                     # (alguna vive en dos shards y en uno la llamada quedó en línea)
        for i in donde:
            original = unidades[i][1]
            texto = copias.get(original) or original.read_text(encoding="utf-8")
            for marca in marcas:
                if marca not in texto:
                    continue
                ini = texto.index(marca)
                fin = texto.find('#line 1 "', ini + len(marca))
                fin = len(texto) if fin < 0 else fin
                cuerpo = texto[ini:fin]
                if "func_80531F70_statefree_v0(r" not in cuerpo:
                    continue
                cambiadas += 1
                cuerpo = cuerpo.replace("func_80531F70_statefree_v0(r", "mkw_vista_propia_v0(r")
                texto = texto[:ini] + VISTA_FN + cuerpo + texto[fin:]
                copias[original] = texto
                unidades[i] = ("juego_reemplazo", original)
        if not cambiadas:
            sys.exit(f"func_{d}: ya no pregunta por la pantalla (¿se volvió a traducir distinto?)")
    dirs_copias = sorted({o.parent for o in copias})
    banderas["juego_reemplazo"] = banderas["juego"] + [f"-I{rutas(d)}" for d in dirs_copias]   # su *_traits.h
    for i, (g, f) in enumerate(unidades):
        if g == "juego_reemplazo" and f in copias:
            copia = gen / "reemplazos" / f.name
            copia.parent.mkdir(parents=True, exist_ok=True)
            if not copia.exists() or copia.read_text(encoding="utf-8") != copias[f]:   # solo si cambió (Ninja mira la fecha)
                copia.write_text(copias[f], encoding="utf-8")
            unidades[i] = (g, copia)

    # 2) Receta de Ninja
    # Las rutas llevan espacios ("MKW RETRO"): Ninja en Windows ya pone comillas a $in/$out solo; las del
    # compilador y las de las opciones -I van entre comillas dobles a mano.
    emcc = EMSDK / "upstream/emscripten/emcc.exe"
    lin = [f'emxx = "{rutas(EMXX)}"', f'emcc = "{rutas(emcc)}"']
    # H11 (etapa 2, bitácora §214): --frio <frio.h> = la cabecera de herramientas/h11-caliente.mjs (cada función
    # traducida que no corre en la carrera, con minsize y cold) incluida antes de cada archivo del juego: lo frío sale
    # más chico y lo caliente queda junto. Solo cambia cómo se compila (sin fast-math ni contracción: los mismos bits)
    # (también a las copias de juego_reemplazo: W12 §215 lo usa para una macro que esas copias también llaman)
    if args.frio:
        for g in ("juego", "juego_reemplazo"):
            banderas[g] = banderas[g] + ["-include", rutas(pathlib.Path(args.frio).resolve())]
    # M7 (etapa 2, bitácora §213): MKW_LTO="runtime,aurora,…" = esos grupos con ThinLTO (-flto=thin): el enlace los
    # optimiza juntos (meter en línea entre archivos). El código traducido (juego, semantica) nunca: son 265 MB de C++
    for g in filter(None, os.environ.get("MKW_LTO", "").split(",")):
        if g in banderas: banderas[g] = banderas[g] + ["-flto=thin"]
    reglas = dict(banderas)
    # C (no C++): mismas opciones de terceros pero sin -std=c++20 ni excepciones de C++
    reglas["c"] = [x for x in banderas["terceros"] if not x.startswith("-std=") and x not in ("-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm")]
    # C de aurora (mtx) y sqlite: sin C++; sqlite sin hilos (en la web no hay) ni extensiones cargables
    reglas["c_aurora"] = [x for x in au_base if not x.startswith("-std=") and x not in ("-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm")]
    reglas["c_aurora"] += ["-O2", "-DSQLITE_THREADSAFE=0", "-DSQLITE_OMIT_LOAD_EXTENSION"]
    for g, fl in reglas.items():
        comp = "$emcc" if g in ("c", "c_aurora") else "$emxx"
        lin += [f"rule cc_{g}",
                f'  command = {comp} -c $in -o $out {" ".join(cmd_q(x) for x in fl)} -MD -MF $out.d',
                "  depfile = $out.d", "  deps = gcc", f"  description = {g} $in"]
    objetos = []
    for g, f in unidades:
        o = obj / g / (re.sub(r"[^\w.-]", "_", f.relative_to(RAIZ).as_posix()) + ".o")
        objetos.append(o)
        regla = ("c_aurora" if g in ("aurora", "librerias") else "c") if f.suffix == ".c" else g
        lin.append(f"build {ninja_esc(rutas(o))}: cc_{regla} {ninja_esc(rutas(f))}")
    # build.ninja solo lista las piezas de ESTE modo: las del otro modo quedan en obj/ sin tocarse.
    (obra / "build.ninja").write_text("\n".join(lin) + "\n", encoding="utf-8")
    (sal / "objetos.rsp").write_text("\n".join(f'"{rutas(o)}"' for o in objetos) + "\n", encoding="utf-8")
    print(f"{len(unidades)} unidades ({', '.join(f'{g} {sum(1 for x, _ in unidades if x == g)}' for g in banderas)})")

    env = dict(os.environ, EMSDK=rutas(EMSDK), EM_CONFIG=rutas(EMSDK / ".emscripten"))
    r = subprocess.run(["ninja", "-C", str(obra), "-j", str(args.hilos), "-k", "0"], env=env)
    if r.returncode or args.solo_compilar:
        sys.exit(r.returncode)

    # 3) Enlazar
    exports = ["_main", "_mkw_host_context_trampoline", "_emscripten_stack_set_limits"]
    if navegador:
        # El navegador: aurora de verdad (WebGPU en el <canvas>), archivos en la memoria (MEMFS) que la página
        # llena antes de arrancar; los archivos grandes del disco se piden por HTTP al leerlos (web/navegador).
        exports += ["_mkw_web_cuadros", "_mkw_web_ms_espera", "_mkw_web_reloj", "_mkw_web_pad", "_mkw_web_mem",
                    "_mkw_web_sonido_cola_ms", "_mkw_web_sonido_ritmo", "_mkw_web_sonido_tirados",
                    # la demora del sonido medida con un clic (§88, sonido.mjs medirDemora)
                    "_mkw_web_sonido_marca", "_mkw_web_sonido_marca_ms",
                    # la lista de pipelines usados, para precalentarlos en la próxima visita (web/navegador/pipelines.mjs)
                    "_mkw_web_pipelines_cuantos", "_mkw_web_pipelines_armar", "_mkw_web_pipelines_datos",
                    # …y pedirlos recién cuando el juego llegó a su primera pantalla (MKW_PRECALENTAR=tarde, §76)
                    "_mkw_web_pipelines_precalentar",
                    # U1 (§140): pausar el precalentado durante la carrera; C9 (§141): cuánta memoria usa el programa
                    # de verdad (sbrk(0) = el final de lo pedido al sistema; el resto del heap está libre)
                    "_mkw_web_pipelines_pausa", "_mkw_web_profundidad", "_mkw_web_profundidad_cuenta", "_mkw_web_limpiezas", "_sbrk",   # (§177.2: G2)
                    "_mkw_recortes_dibujo", "_mkw_dibujos_enteros",   # (§179: G1)
                    "_mkw_graficos_quitar", "_mkw_graficos_dato", "_mkw_dibujo_saltar", "_mkw_dibujo_patron", "_mkw_dibujo_modo", "_mkw_dibujo_este_saltado",   # (§192: R2)
                    "_mkw_dibujos_saltados", "_mkw_dibujos_saltados_juego",
                    # C2 (§174): dónde está el juego (los menús o una pista) y pedir los pipelines de la pista elegida
                    "_mkw_web_pipelines_etiqueta", "_mkw_web_pipelines_pista"]
        propio = puertos + ["-sENVIRONMENT=web", "-sEXIT_RUNTIME=0", "-sFORCE_FILESYSTEM=1",
                            "-sEXPORTED_RUNTIME_METHODS=['callMain','ENV','FS','HEAPU8']"]
        # §190 (G6): las texturas CMPR en BC1, solo si la aurora que se compila lo trae (la de la v0.9.3 todavía no)
        _tex = (AU_DIR / "lib" / "gfx" / "texture.cpp").read_text(encoding="utf-8", errors="replace")
        if "mkw_web_texturas_bc" in _tex and ("MKW_CHICA_C2" not in _tex or "c2" in chicas):
            exports += ["_mkw_web_texturas_bc"]
        # §205 (W9): el camino de reserva de las Adreno (las matrices de los huesos por filas), si la aurora lo trae
        if "mkw_web_huesos_filas" in (AU_DIR / "lib" / "gx" / "shader.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_huesos_filas"]
        # §248 (W26): el censo de los textos WGSL y el módulo compartido por texto, si la aurora lo trae
        if "mkw_web_wgsl_compartir" in (AU_DIR / "lib" / "gx" / "shader.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_wgsl", "_mkw_web_wgsl_compartir"]
        # §204 (W20): soltar las texturas de copia ociosas (la mitad de la piscina de KartPad 0cca4d2), si la aurora lo trae
        if "mkw_web_piscina" in (AU_DIR / "lib" / "dolphin" / "gx" / "GXFrameBuffer.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_piscina", "_mkw_web_piscina_dato"]
        # §203 (W8): soltar los pipelines de las otras pistas, si la aurora lo trae
        if "mkw_web_pipelines_soltar" in (AU_DIR / "lib" / "gfx" / "pipeline_cache.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_pipelines_soltar"]
        if "mkw_web_pipelines_guardar" in (AU_DIR / "lib" / "gfx" / "pipeline_cache.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_pipelines_guardar"]   # (§248: W26, el conjunto acotado)
        # §203 (W8): cuántas texturas viven y cuántos MB ocupan, si la aurora lo trae
        if "mkw_web_texturas_dato" in (AU_DIR / "lib" / "gfx" / "texture.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_texturas_dato"]
        # §253 (G12): las texturas más chicas (saltar los niveles de detalle más grandes), si la aurora lo trae
        if "mkw_web_texturas_menos" in (AU_DIR / "lib" / "gfx" / "texture.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_texturas_menos", "_mkw_web_texturas_menos_dato"]
        # §259 (W31): el instrumento de las listas de dibujo (contar, techo), si la aurora lo trae
        if "mkw_web_w31" in (AU_DIR / "lib" / "dolphin" / "gx" / "GXDispList.cpp").read_text(encoding="utf-8", errors="replace"):
            exports += ["_mkw_web_w31", "_mkw_web_w31_dato"]
        if os.environ.get("MKW_CALIENTE_COMPILAR") == "1":
            exports += ["_mkw_caliente_estado", "_mkw_caliente_informe"]   # (§181: N14)
        if os.environ.get("MKW_IA30_COMPILAR") == "1":
            exports += ["_mkw_ia30_modo", "_mkw_ia30_estado", "_mkw_ia30_bits", "_mkw_ia30_vuelta"]   # (§258: W32)
        if os.environ.get("MKW_SUMIDERO_COMPILAR") == "1":
            exports += ["_mkw_sumidero_modo", "_mkw_sumidero_reiniciar", "_mkw_sumidero_dato"]   # (§196: W1)
        if os.environ.get("MKW_ISLA_COMPILAR") == "1":
            exports += ["_mkw_isla_modo", "_mkw_isla_reiniciar", "_mkw_isla_dato"]   # (§199: W2)
        if os.environ.get("MKW_TECHO_COMPILAR") == "1":
            exports += ["_mkw_techo_modo", "_mkw_techo_dato", "_mkw_techo_mascara", "_mkw_dibujar_siempre"]   # (§200: W3; §222: E4 mide dibujando siempre)
        if os.environ.get("MKW_W10_COMPILAR") == "1":
            exports += ["_mkw_w10_traza", "_mkw_w10_hecho", "_mkw_w10_cuenta", "_mkw_w10_tocadas_a", "_mkw_w10_bits_a", "_mkw_w10_palabras_deshechas", "_mkw_w10_sin_efectos", "_mkw_w10_sombra_b", "_mkw_w10_deshacer_efectos", "_mkw_w10_deshechas", "_mkw_w10_modo", "_mkw_w10_reiniciar", "_mkw_w10_dato", "_mkw_w10_host", "_mkw_w10_hilos", "_mkw_w10_rango",
                        "_mkw_w11_saltar", "_mkw_w11_dato", "_mkw_dibujar_siempre"]   # (§207: W10)
        if N8:
            exports += ["_mkw_n8_modo", "_mkw_n8_estado", "_mkw_n8_reiniciar", "_mkw_dibujar_siempre"]   # (§219: N8)
    else:
        exports += ["_mkw_headless_frames", "_mkw_headless_set_pad"]
        # W4 (§198): el programa que cuenta las ramas (-fprofile-instr-generate) escribe su perfil al salir con atexit,
        # pero en Node el juego no termina por exit() (la promesa de JSPI vuelve y Node sale con process.exit):
        # web/node/correr.mjs llama a __llvm_profile_write_file a mano
        if "-fprofile-instr-generate" in os.environ.get("MKW_CFLAGS_EXTRA", ""):
            exports += ["___llvm_profile_write_file"]
        propio =["--use-port=sdl3", "-sENVIRONMENT=node", "-sNODERAWFS=1", "-sEXIT_RUNTIME=1",
                  "-sEXPORTED_RUNTIME_METHODS=['callMain','ENV']"]
    enlace = [str(EMXX), f"@{rutas(sal / 'objetos.rsp')}", "-o", rutas(sal / "mkw.js"),
              # --profiling-funcs: conserva los nombres de las funciones dentro del .wasm, para que el perfil
              # (prueba-navegador.mjs --perfil) diga "aurora::gfx::render" y no "wasm-function[81234]"
              "-O2"] + ([] if args.final else ["--profiling-funcs"]) + ["-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm",
              "-sJSPI=1", "-sJSPI_EXPORTS=['mkw_host_context_trampoline']",
              f"-sEXPORTED_FUNCTIONS={exports!r}".replace("'", '"'),
              "-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=['$stackSave','$stackRestore']",
              "-sALLOW_MEMORY_GROWTH=1", "-sMAXIMUM_MEMORY=4GB", f"-sINITIAL_MEMORY={args.memoria_inicial}MB",
              "-sSTACK_SIZE=8MB", "-sINVOKE_RUN=0", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
              "-sERROR_ON_UNDEFINED_SYMBOLS=1"] + propio + (["-msimd128"] if args.simd else [])
    # Paso 8 (§186, la puerta A): MKW_LDFLAGS_EXTRA="-pthread" (con MKW_CFLAGS_EXTRA="-pthread") = un programa aparte
    # (--carpeta) con la memoria compartida, para probar JSPI y WebGPU en un Worker con SharedArrayBuffer
    if args.fija:   # (H6, §211) la ventana fija: 0x00100000 + 0x18000000; lo de C++ después
        enlace = [a for a in enlace if not a.startswith("-sINITIAL_MEMORY=")]
        enlace += ["-sGLOBAL_BASE=403701760", f"-sINITIAL_MEMORY={args.memoria_inicial + 240}MB"]
    if args.memoria_fija:   # (W29, §239) tamaño fijo: sin crecer, sin tope máximo, el inicial = el pedido
        enlace = [a for a in enlace if not a.startswith(("-sINITIAL_MEMORY=", "-sALLOW_MEMORY_GROWTH=", "-sMAXIMUM_MEMORY="))]
        enlace += ["-sALLOW_MEMORY_GROWTH=0", f"-sINITIAL_MEMORY={args.memoria_fija}MB"]
    enlace += os.environ.get("MKW_LDFLAGS_EXTRA", "").split()
    if "c7" in chicas:   # E4c C7: wasm-opt -O3 dentro de la misma pasada de Binaryen de emcc (con sus mismas «features»)
        enlace += ["-sBINARYEN_EXTRA_PASSES=-O3"]
    print("enlazando…")
    r = subprocess.run(enlace, env=env)
    if r.returncode == 0 and args.final and navegador:
        r = subprocess.run(["node", str(RAIZ / "herramientas" / "comprimir-build.mjs"), str(sal)])
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
