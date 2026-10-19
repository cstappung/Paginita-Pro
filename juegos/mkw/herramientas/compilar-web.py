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
WC = RAIZ / "terceros/Wiicompiled"
RT = WC / "runtime"
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
    args = ap.parse_args()
    args.simd = not args.sin_simd

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

    incs = [RT / "include", RT / "src", WC, WC / "aurora-main/include", RT / "third_party",
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
    AU = WC / "aurora-main"
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
    if navegador:
        # aurora sin pantalla NO; solo los extras de escritorio vacíos + el puente con la página
        unidades.append(("web", RAIZ / "web/headless/escritorio_vacio.cpp"))
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
                  # MEMAllocFromExpHeapEx / MEMAllocFromFrmHeapEx / ClipInfoMgr::Update / AI::Character::UpdateLookAtCamera
                  # -> web/juego/lockstep_nativo.cpp
                  # (memoria en cero y todo "a la vista" en la carrera sincronizada, §61)
                  "func_80198D88": "func_80198D88_traducida", "func_801994E4": "func_801994E4_traducida",
                  "func_80787774": "func_80787774_traducida", "func_807379BC": "func_807379BC_traducida",
                  "func_807EC7F8": "func_807EC7F8_traducida", "func_807F7E80": "func_807F7E80_traducida",
                  "func_80536054": "func_80536054_traducida", "func_8020FE24": "func_8020FE24_traducida", "rr_kamek_81806568": "rr_kamek_81806568_traducida",
                  # Page::Activate -> web/juego/paginas_nativo.cpp (avisa a la página qué pantalla se activó: ocultar.mjs, §66)
                  "func_80601AEC": "func_80601AEC_traducida",
                  # SectionMgr::Update (la versión de RR) -> web/juego/directo_nativo.cpp (abrir directo una sección
                  # pedida por la página: elige la licencia y llama a SetNextSection/RequestSceneChange, §71)
                  "rr_overlay_8063550C": "rr_overlay_8063550C_traducida"}
    if os.environ.get("MKW_DEPURAR") == "1":              # depuración de la red (web/juego/depurar_red.cpp, §58)
        REEMPLAZOS.update({f"func_{d}": f"func_{d}_traducida" for d in ("800CCC68", "800D1D90", "800D0FEC", "806561A8", "80656FF8", "80653DDC", "800D2000", "800DAD9C", "800FBA4C", "800E8814", "80623054", "80666288", "8063519C", "8067552C", "80635A3C", "80635AC8", "80635B2C")}); REEMPLAZOS["rr_overlay_80635A3C"] = "rr_overlay_80635A3C_traducida"
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
                ("thp", RAIZ / "web/juego/directo_nativo.cpp")]
    # la red del juego hacia la página (socket/connect/sendto… propios, bitácora §58): en los dos modos, porque el
    # runtime llama a mkw_red_cerrar/mkw_red_bloqueante; en Node no hay Module.mkwRed y todo da "red apagada"
    unidades += [("thp", RAIZ / "web/red/red_web.cpp")]
    if os.environ.get("MKW_DEPURAR") == "1":
        unidades += [("thp", RAIZ / "web/juego/depurar_red.cpp")]
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
                    # la lista de pipelines usados, para precalentarlos en la próxima visita (web/navegador/pipelines.mjs)
                    "_mkw_web_pipelines_cuantos", "_mkw_web_pipelines_armar", "_mkw_web_pipelines_datos"]
        propio = puertos + ["-sENVIRONMENT=web", "-sEXIT_RUNTIME=0", "-sFORCE_FILESYSTEM=1",
                            "-sEXPORTED_RUNTIME_METHODS=['callMain','ENV','FS','HEAPU8']"]
    else:
        exports += ["_mkw_headless_frames", "_mkw_headless_set_pad"]
        propio = ["--use-port=sdl3", "-sENVIRONMENT=node", "-sNODERAWFS=1", "-sEXIT_RUNTIME=1",
                  "-sEXPORTED_RUNTIME_METHODS=['callMain','ENV']"]
    enlace = [str(EMXX), f"@{rutas(sal / 'objetos.rsp')}", "-o", rutas(sal / "mkw.js"),
              # --profiling-funcs: conserva los nombres de las funciones dentro del .wasm, para que el perfil
              # (prueba-navegador.mjs --perfil) diga "aurora::gfx::render" y no "wasm-function[81234]"
              "-O2"] + ([] if args.final else ["--profiling-funcs"]) + ["-fwasm-exceptions", "-sSUPPORT_LONGJMP=wasm",
              "-sJSPI=1", "-sJSPI_EXPORTS=['mkw_host_context_trampoline']",
              f"-sEXPORTED_FUNCTIONS={exports!r}".replace("'", '"'),
              "-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=['$stackSave','$stackRestore']",
              "-sALLOW_MEMORY_GROWTH=1", "-sMAXIMUM_MEMORY=4GB", "-sINITIAL_MEMORY=512MB",
              "-sSTACK_SIZE=8MB", "-sINVOKE_RUN=0", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
              "-sERROR_ON_UNDEFINED_SYMBOLS=1"] + propio + (["-msimd128"] if args.simd else [])
    print("enlazando…")
    r = subprocess.run(enlace, env=env)
    if r.returncode == 0 and args.final and navegador:
        r = subprocess.run(["node", str(RAIZ / "herramientas" / "comprimir-build.mjs"), str(sal)])
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
