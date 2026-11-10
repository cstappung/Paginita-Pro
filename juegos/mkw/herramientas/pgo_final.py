# PGO del programa final (W25 / E4c, bitácora §228.1–§228.2): `compilar-web.py --final` lo llama solo.
#
# Resumen: PGO = compilar guiado por un perfil (glosario). Antes de compilar el programa final:
#   1. arma (o pone al día: ninja solo recompila lo que cambió) un programa de Node que CUENTA cuántas veces pasa por
#      cada rama (-fprofile-instr-generate), en su propio taller <carpeta>-pgo-gen. Va sin --final (sin la ventana fija ni
#      ThinLTO), como en la medida de §228.1: el perfil marca cada función por la forma de su código fuente, no por cómo
#      se enlaza, y sirve para el programa --final;
#   2. si ese programa es idéntico al de la última vez (la huella de su mkw.wasm), reusa el perfil; si no, lo corre en
#      las 3 carreras de los guiones de herramientas/pgo/ (botones con el formato de §165, copas que el tramo fijo NO usa;
#      cada corrida con la partida base limpia de §175, por correr-guion.mjs → partida-aislada.mjs), arregla cada perfil
#      (profraw-v11.mjs) y los junta (llvm-profdata merge);
#   3. devuelve las banderas para compilar con el perfil (-fprofile-instr-use, -hot-cold-split).
# Como un ajuste de fábrica que se recalibra solo cada vez que cambia la placa, y no se toca si la placa es la misma.
# El perfil lleva nombres de funciones del juego: queda fuera del repositorio (la carpeta temporal del sistema o
# MKW_PGO_CARPETA), nunca a git. Sin PGO: `compilar-web.py --final --sin-pgo` o MKW_PGO=0.
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

GUIONES = "herramientas/pgo"     # guion-*.txt: «inicio+duración=máscara,…» (MKW_HEADLESS_GUION, §165)
CUADROS = "6600"                 # cada guion llega a su carrera y corre ~1 min de ella (§198)


def _huella(archivo):
    h = hashlib.sha256()
    with open(archivo, "rb") as f:
        for trozo in iter(lambda: f.read(1 << 20), b""):
            h.update(trozo)
    return h.hexdigest()[:16]


def preparar(raiz, carpeta, emsdk):
    """Arma o reusa el perfil; devuelve las banderas de compilar con él (una lista)."""
    raiz = pathlib.Path(raiz)
    taller = f"{carpeta}-pgo-gen"
    # 1. el programa que cuenta: la misma obra (motor, aurora, chicas) que el final, más -fprofile-instr-generate
    env = dict(os.environ)
    env["MKW_LTO"] = ""                      # sin ThinLTO (§228.1)
    env["MKW_PGO_HIJO"] = "1"                # que esta llamada no vuelva a pedir PGO
    for v in ("MKW_CFLAGS_EXTRA", "MKW_LDFLAGS_EXTRA"):
        env[v] = (env.get(v, "") + " -fprofile-instr-generate").strip()
    print(f"PGO: el programa que cuenta las ramas -> {taller}/node", flush=True)
    r = subprocess.run([sys.executable, str(raiz / "herramientas/compilar-web.py"), "--carpeta", taller],
                       cwd=raiz, env=env)
    if r.returncode != 0:
        sys.exit(f"PGO: no se pudo armar el programa que cuenta (salida {r.returncode}); --sin-pgo para compilar sin él")
    wasm = raiz / taller / "node/mkw.wasm"
    h = _huella(wasm)

    destino = pathlib.Path(os.environ.get("MKW_PGO_CARPETA", pathlib.Path(tempfile.gettempdir()) / "mkw-pgo")) / \
        pathlib.Path(carpeta).name
    destino.mkdir(parents=True, exist_ok=True)
    profdata = destino / f"mkw-{h}.profdata"   # la huella en el nombre: si cambia, la bandera cambia y ninja recompila
    if profdata.exists():
        print(f"PGO: el programa que cuenta no cambió (huella {h}): reuso {profdata}", flush=True)
    else:
        # 2. las 3 carreras, cada una con su perfil
        guiones = sorted((raiz / GUIONES).glob("guion-*.txt"))
        if not guiones:
            sys.exit(f"PGO: no hay guiones en {GUIONES}")
        arreglados = []
        for g in guiones:
            letra = g.stem.split("-", 1)[1]
            crudo, arreglado = destino / f"perfil-{letra}.profraw", destino / f"v11-{letra}.profraw"
            for viejo in (crudo, arreglado):
                viejo.unlink(missing_ok=True)
            print(f"PGO: carrera {letra} ({g.relative_to(raiz).as_posix()})", flush=True)
            # (el programa se cae al escribir la parte de los valores, DESPUÉS de los contadores: la salida no importa,
            # importa que el perfil exista; §228.1)
            subprocess.run(["node", "herramientas/correr-guion.mjs", "--build", f"{taller}/node", "--guion",
                            str(g), "--cuadros", CUADROS, "--log", str(destino / f"perfil-{letra}.log"),
                            "--perfil", crudo.as_posix()], cwd=raiz)
            if not crudo.exists() or crudo.stat().st_size == 0:
                sys.exit(f"PGO: la carrera {letra} no dejó perfil (registro en {destino / f'perfil-{letra}.log'})")
            r = subprocess.run(["node", "herramientas/profraw-v11.mjs", str(crudo), str(arreglado)], cwd=raiz)
            if r.returncode != 0:
                sys.exit(f"PGO: no se pudo arreglar el perfil {letra}")
            arreglados.append(str(arreglado))
        herramienta = pathlib.Path(emsdk) / "upstream/bin" / ("llvm-profdata.exe" if os.name == "nt" else "llvm-profdata")
        provisorio = destino / "juntando.profdata"
        r = subprocess.run([str(herramienta), "merge", "-o", str(provisorio)] + arreglados)
        if r.returncode != 0:
            sys.exit("PGO: llvm-profdata merge falló")
        for viejo in destino.glob("mkw-*.profdata"):   # los de programas anteriores ya no sirven
            viejo.unlink()
        shutil.move(str(provisorio), str(profdata))
        print(f"PGO: perfil nuevo {profdata} ({len(arreglados)} carreras)", flush=True)
    # 3. las banderas, las mismas que se midieron (§228.1)
    return [f"-fprofile-instr-use={profdata.as_posix()}", "-Wno-profile-instr-unprofiled",
            "-Wno-profile-instr-out-of-date", "-mllvm", "-hot-cold-split=true"]
