"""Compila el MISMO juego (Mario Kart Wii + Retro Rewind, el modo sin pantalla de Node) como programa de Windows, para
medir el «impuesto del navegador» (N1 del plan de rendimiento, bitácora §153).

Resumen: compilar-web.py arma el juego para WebAssembly; esto arma las mismas piezas (runtime de WiiCompiled, aurora
sin pantalla de web/headless, Crypto++, pugixml, xxhash, los datos y los shards traducidos) con clang 22 de Visual
Studio 18 para x86-64 de Windows, con las mismas opciones de cada grupo (el juego traducido sin atajos de punto
flotante, el runtime -O3 -ffast-math). Diferencias a propósito, que son justo lo que se quiere medir:
  - la memoria de la Wii: en Windows existe la vista plana (guest_flat_memory.cpp, una reserva de 4 GiB) y los
    accesos «planos» van directo; en wasm todo va por la tabla de páginas (guest_flat_memory_wasm.cpp);
  - las fibras del juego son fibras de Windows, no suspensiones JSPI;
  - --cpu v3 (por omisión): x86-64-v3 (AVX2 + FMA, la que usa la versión de escritorio de WiiCompiled); --cpu v2 =
    x86-64-v2 (SSE4.2, sin FMA ni AVX: lo mínimo que acepta el runtime), para ver cuánto pesa la multiplicación-suma
    exacta cuando el procesador no la tiene.
Lo que NO entra: los ganchos de la página (web/juego, web/thp, web/dvd, web/red: usan EM_JS, hablan con la página y
casi no corren fuera de la sala) y la selección de RELOJ_CARRERA/VISTA_PROPIA de compilar-web.py.
Con -DMKW_NATIVO_MEDIR las esperas del ritmo (vi.cpp SleepPreciselyUntil) se suman a g_mkwHostIdleMs, así la línea
«[aurora-headless] … trabajo X ms por cuadro» dice lo mismo que en Node: tiempo del cuadro menos esperas.

Uso:  python herramientas/compilar-nativo.py [--cpu v3|v2] [--revisado] [--bytes-lentos] [--hilos 16] [--contadores]
      build/nativo-<cpu>/mkw-nativo.exe   (NUNCA a git: es el juego)
Correr: node herramientas/medir-impuesto.mjs (corre este .exe y el wasm de Node con los mismos cuadros).
"""
import argparse
import os
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
# MKW_WIICOMPILED=terceros/Wiicompiled-motor: otra copia del traductor y su C++ (paso 6, §170)
WC = RAIZ / os.environ.get("MKW_WIICOMPILED", "terceros/Wiicompiled")
RT = WC / "runtime"
# MKW_AURORA=terceros/aurora-main-viejo-motor: las cabeceras de aurora de otra carpeta (N15a, §170: con la v0.9.3 la
# aurora sigue siendo la nuestra, aparte)
AU_INC = ((RAIZ / os.environ["MKW_AURORA"]) if os.environ.get("MKW_AURORA") else WC / "aurora-main") / "include"
VS = pathlib.Path(r"C:\Program Files\Microsoft Visual Studio\18\Community")
LLVM = VS / "VC/Tools/Llvm/x64/bin"
SDL_SRC = RAIZ / "herramientas/emsdk/upstream/emscripten/cache/ports/sdl3/SDL-release-3.4.2"
HERR = pathlib.Path("C:/Strawberry/c/bin")   # cmake y ninja

EXCLUIDOS = {"guest_flat_memory_macos.cpp", "guest_flat_memory_wasm.cpp", "discord_presence.cpp",
             "settings_overlay.cpp", "controller_mapping_wizard.cpp", "product/base_product.cpp"}
SEMANTICA = {"ppc_helpers.cpp", "fpu_helpers.cpp", "ppc_quantized.cpp"}


def entorno_vs():
    """Las variables de vcvars64.bat (INCLUDE, LIB, PATH del SDK de Windows) en un dict."""
    bat = VS / "VC/Auxiliary/Build/vcvars64.bat"
    salida = subprocess.run(f'"{bat}" >nul && set', shell=True, capture_output=True, text=True).stdout
    env = dict(os.environ)
    for l in salida.splitlines():
        if "=" in l:
            k, v = l.split("=", 1)
            env[k] = v
    env["PATH"] = f"{LLVM};{HERR};" + env.get("PATH", "")
    return env


def q(s):
    return f'"{s}"' if " " in str(s) else str(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cpu", default="v3", choices=["v3", "v2"])
    ap.add_argument("--hilos", type=int, default=os.cpu_count() or 8)
    ap.add_argument("--contadores", action="store_true")   # -DMKW_CONTADORES (V4) también aquí
    # --revisado: la memoria de la Wii siempre por la tabla de páginas (como en wasm), sin la vista plana: la parte
    # del impuesto que es la memoria = (revisado - normal)
    ap.add_argument("--revisado", action="store_true")
    # --sin-vector (N13, §165): una traba de wasm de a una: sin vectorizar bucles ni bloques en NINGUNA pieza (wasm tiene
    # vectores de 128 bits y el traductor ya va sin los de bloques; esto quita también los del runtime y los de bucles)
    ap.add_argument("--sin-vector", action="store_true")
    # --bytes-lentos (W6, §197): dar vuelta los bytes como wasm (sin la instrucción bswap: desplazamientos y máscaras, y
    # la mezcla de vector para 8 bytes), con una barrera para que clang no los junte otra vez; la diferencia contra el
    # nativo normal es lo que cuesta dar vuelta los bytes (memory_access.h, MKW_BYTES_LENTOS)
    ap.add_argument("--bytes-lentos", action="store_true")
    # --carpeta build/nativo-v093-v3 (§170): otra carpeta (p. ej. la v0.9.3 al lado de la de siempre); --gen: de dónde
    # salen los .cpp con #embed (los arma el modo node de compilar-web.py con la misma copia del traductor)
    ap.add_argument("--carpeta")
    ap.add_argument("--gen", default="build/web/node/gen")
    args = ap.parse_args()
    carpeta = RAIZ / args.carpeta if args.carpeta else RAIZ / f"build/nativo-{args.cpu}{'-revisado' if args.revisado else ''}{'-contadores' if args.contadores else ''}{'-sinvector' if args.sin_vector else ''}{'-byteslentos' if args.bytes_lentos else ''}"
    obj = carpeta / "obj"
    carpeta.mkdir(parents=True, exist_ok=True)
    env = entorno_vs()

    # 1) SDL3 estática (una vez): cmake + ninja con clang-cl
    sdl_build = RAIZ / "build/nativo-sdl3"
    sdl_lib = sdl_build / "SDL3-static.lib"
    if not sdl_lib.exists():
        r = subprocess.run([str(HERR / "cmake.exe"), "-S", str(SDL_SRC), "-B", str(sdl_build), "-G", "Ninja",
                            "-DCMAKE_BUILD_TYPE=Release", f"-DCMAKE_C_COMPILER={(LLVM / 'clang-cl.exe').as_posix()}",
                            f"-DCMAKE_CXX_COMPILER={(LLVM / 'clang-cl.exe').as_posix()}",
                            f"-DCMAKE_MAKE_PROGRAM={(HERR / 'ninja.exe').as_posix()}",
                            "-DSDL_SHARED=OFF", "-DSDL_STATIC=ON", "-DSDL_TEST_LIBRARY=OFF", "-DSDL_TESTS=OFF",
                            "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded"], env=env)
        if r.returncode:
            sys.exit("SDL3: cmake falló")
        r = subprocess.run([str(HERR / "ninja.exe"), "-C", str(sdl_build)], env=env)
        if r.returncode:
            sys.exit("SDL3: ninja falló")
    sdl_inc = SDL_SRC / "include"

    # 2) Las piezas (como el modo node de compilar-web.py)
    gen = RAIZ / args.gen   # los .cpp con #embed que ya armó compilar-web.py (datos del juego)
    for c in ("data_sections_init_blobs.cpp", "mod_data_patches_blobs.cpp"):
        if not (gen / c).exists():
            sys.exit(f"falta {gen / c}: correr antes python herramientas/compilar-web.py (modo node)")
    incs = [RT / "include", RT / "src", WC, AU_INC, RT / "third_party",
            RT / "third_party/pugixml", RT / "third_party/toml11", RAIZ / "terceros/xxhash-dl/xxHash-0.8.4", sdl_inc]
    march = f"-march=x86-64-{args.cpu}"
    base = ["-std=c++20", "-w", march, "-DTARGET_PC", "-DSDL_MAIN_HANDLED", "-DNOMINMAX", "-DWIN32_LEAN_AND_MEAN",
            "-D_CRT_SECURE_NO_WARNINGS", "-DMKW_CRYPTOPP_ALLOW_CLANG_MSVC_ABI", "-DCRYPTOPP_DISABLE_ASM", "-DCRYPTOPP_NO_GLOBAL_BYTE", "-DMKW_NATIVO_MEDIR",
            "-fms-runtime-lib=static", "-g0"] + [f"-I{i.as_posix()}" for i in incs]
    if args.contadores:
        base.append("-DMKW_CONTADORES")
    # v0.9.3 (§170): la región para la que tradujo el traductor (su manifiesto), como en compilar-web.py
    manifiesto = WC / "generated/build_shards/shards.cmake"
    m = re.search(r"set\(MKW_TRANSLATED_GUEST_REGION (\d+)\)", manifiesto.read_text(encoding="utf-8")) if manifiesto.exists() else None
    if m:
        base.append(f"-DMKW_TRANSLATED_GUEST_REGION={m.group(1)}")
    if args.revisado:
        base.append("-DMKW_FORZAR_REVISADO")
    if args.sin_vector:
        base += ["-fno-vectorize", "-fno-slp-vectorize"]
    if args.bytes_lentos:
        base.append("-DMKW_BYTES_LENTOS")
    traducido = ["-O2", "-fno-fast-math", "-ffp-contract=off", "-fno-slp-vectorize"]
    banderas = {"runtime": base + ["-O3", "-ffast-math"], "semantica": base + traducido, "web": base + ["-O2"],
                "terceros": base + ["-O2"], "datos": base + ["-O1"], "juego": base + traducido}
    # music_attenuation.cpp: en Windows baja el volumen de la música del sistema con WinRT (corrutinas que clang con la
    # STL de Microsoft no compila); sin _WIN32 toma su camino de «otro sistema», el mismo que en wasm
    banderas["sin_winrt"] = banderas["runtime"] + ["-U_WIN32"]
    unidades = []
    for f in sorted((RT / "src").rglob("*.cpp")):
        rel = f.relative_to(RT / "src").as_posix()
        if rel in EXCLUIDOS:
            continue
        unidades.append(("semantica" if rel in SEMANTICA else "sin_winrt" if rel == "music_attenuation.cpp" else "runtime", f))
    # v0.9.3 (§170): lo propio del juego (la región, la configuración, la versión) está en runtime/game
    unidades += [("runtime", f) for f in sorted((RT / "game").glob("*.cpp"))] if (RT / "game").is_dir() else []
    unidades += [("web", f) for f in sorted((RAIZ / "web/headless").glob("*.cpp"))]
    cripto = [f for f in sorted((RT / "third_party/cryptopp").glob("*.cpp"))
              if not re.search(r"/(adhoc|bench[123]|datatest|dlltest|fipsalgt|fipstest|pch|regtest[1234]|simple|test|validat[0-9]+)\.cpp$", f.as_posix())
              and not re.search(r"(_avx|_ppc|_simd|_sse)\.cpp$", f.name)]
    unidades += [("terceros", f) for f in cripto]
    unidades += [("terceros", RT / "third_party/pugixml/pugixml.cpp"),
                 ("terceros", RAIZ / "terceros/xxhash-dl/xxHash-0.8.4/xxhash.c")]
    unidades += [("datos", WC / "generated/data_sections_init.cpp"), ("datos", WC / "generated/guest_symbol_table.cpp"),
                 ("datos", WC / "build/mods/retro_rewind_full_cpp/cpp/mod_data_patches.cpp"),
                 ("datos", gen / "data_sections_init_blobs.cpp"), ("datos", gen / "mod_data_patches_blobs.cpp")]
    for grupo in ["base_common", "retro_portable_sensitive", "retro_mod", "retro_rewind_registration", "retro_rewind_dispatch"]:
        unidades += [("juego", f) for f in sorted((WC / "generated/build_shards" / grupo).glob("*.cpp"))]

    # 3) Ninja
    lin = [f"cxx = {q((LLVM / 'clang++.exe').as_posix())}", f"cc = {q((LLVM / 'clang.exe').as_posix())}"]
    reglas = dict(banderas)
    reglas["c"] = [x for x in banderas["terceros"] if not x.startswith("-std=")]
    for g, fl in reglas.items():
        comp = "$cc" if g == "c" else "$cxx"
        lin += [f"rule cc_{g}", f"  command = {comp} -c $in -o $out {' '.join(q(x) for x in fl)} -MD -MF $out.d",
                "  depfile = $out.d", "  deps = gcc", f"  description = {g} $in"]
    objetos = []
    for g, f in unidades:
        o = obj / g / (re.sub(r"[^\w.-]", "_", f.relative_to(RAIZ).as_posix()) + ".o")
        objetos.append(o)
        regla = "c" if f.suffix == ".c" else g
        esc = lambda p: p.as_posix().replace("$", "$$").replace(":", "$:").replace(" ", "$ ")
        lin.append(f"build {esc(o)}: cc_{regla} {esc(f)}")
    (carpeta / "build.ninja").write_text("\n".join(lin) + "\n", encoding="utf-8")
    print(f"{len(unidades)} unidades")
    r = subprocess.run([str(HERR / "ninja.exe"), "-C", str(carpeta), "-j", str(args.hilos), "-k", "0"], env=env)
    if r.returncode:
        sys.exit(r.returncode)

    # 4) Enlazar (lld-link por clang++)
    rsp = carpeta / "objetos.rsp"
    rsp.write_text("\n".join(f'"{o.as_posix()}"' for o in objetos) + "\n", encoding="utf-8")
    exe = carpeta / "mkw-nativo.exe"
    libs = ["user32", "gdi32", "winmm", "imm32", "ole32", "oleaut32", "version", "uuid", "advapi32", "setupapi",
            "shell32", "ws2_32", "iphlpapi", "bcrypt", "dbghelp", "synchronization", "kernel32", "cfgmgr32", "hid",
            "secur32", "crypt32",
            "bthprops"]   # §170: la v0.9.3 trae el Wii Remote por Bluetooth (BluetoothFind…, de Bthprops.lib); no se usa
    enlace = [str(LLVM / "clang++.exe"), f"@{rsp.as_posix()}", str(sdl_lib), "-o", str(exe), "-fuse-ld=lld",
              "-fms-runtime-lib=static", "-Wl,/STACK:16777216",
              # el mapa de símbolos (mkw-nativo.map: dirección de cada función) para el muestreador de N13 (§160)
              f"-Wl,/MAP:{(carpeta / 'mkw-nativo.map').as_posix()}",
              # (__udivti3/__umodti3: la división de 128 bits, de las funciones de apoyo de clang)
              str(next((LLVM.parent / "lib/clang").glob("*/lib/windows/clang_rt.builtins-x86_64.lib")))] + [f"-l{l}" for l in libs]
    print("enlazando…")
    r = subprocess.run(enlace, env=env)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
