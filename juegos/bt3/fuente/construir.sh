#!/usr/bin/env bash
# Construye el juego de `juegos/bt3/` desde el código abierto del port, sin ningún dato del juego.
#
# Resumen: baja el fork web de Tenkaichi3Decomp (stufno102) en un commit fijo, le aplica `parche.diff` (las
# tablas del juego en blanco, rellenadas desde la ISO del jugador al arrancar; el botón Ajustes; dos funciones
# de C++), lo compila con Emscripten (la versión JSPI: Chrome y Edge en un computador; en el celular no se juega,
# así que la versión Asyncify del fork, la de Safari y iPhone, no se construye), empaqueta la red del marco
# (`npm run build:bt3`) y arma la página (`pagina.py`).
# El resultado no contiene nada del disco: se puede publicar. La ISO la pone cada jugador.
#
# Uso:  juegos/bt3/fuente/construir.sh <carpeta de trabajo>
# Necesita: git, python3, node, emcc (Emscripten 6.x en el PATH) y el SDL3 de Emscripten (`--use-port=sdl3`;
# si no puede bajarlo, EMCC_LOCAL_PORTS="sdl3=<un clon de SDL release-3.4.2>").
set -euo pipefail

COMMIT=81507cde58685a6f5aab917c298d9a9f82fe09b0      # stufno102/Tenkaichi3Decomp, «Browser build» (2026-10-12)
VER=bt3-13                                           # súbelo al cambiar el programa: va en los ?v= de la página
AQUI="$(cd "$(dirname "$0")" && pwd)"                # juegos/bt3/fuente
DESTINO="$(cd "$AQUI/.." && pwd)"                    # juegos/bt3
RAIZ="$(cd "$DESTINO/../.." && pwd)"                 # la raíz del sitio
TRABAJO="${1:?falta la carpeta de trabajo}"

# 1. El código del port, en el commit fijo, con nuestro parche.
if [ ! -d "$TRABAJO/port/.git" ]; then
  git clone https://github.com/stufno102/Tenkaichi3Decomp.git "$TRABAJO/port"
fi
cd "$TRABAJO/port"
git fetch --quiet origin "$COMMIT" || true
git checkout --quiet --force "$COMMIT"
git clean --quiet -fd port/web                       # (archivos de un parche anterior)
git apply "$AQUI/parche.diff"

# 2. Compilar: el juego a LLVM IR reescrito (build.py), las tablas en blanco, y enlazar.
python3 port/web/build.py
python3 port/web/gen_data_skeleton.py
python3 port/web/link.py web

# 3. Copiar el programa a juegos/bt3/ y armar la página.
cp port/build/web/bt3-jspi.js port/build/web/bt3-jspi.wasm "$DESTINO/"
python3 "$AQUI/pagina.py" port/web/shell.html "$DESTINO/index.html" "$VER" "$DESTINO/bt3-jspi.wasm"

# La misma versión para la sala (la dirección del marco, colabtex/src/juegos/bt3-amigos.js).
sed -i "s/^export const BT3_VER = \".*\";/export const BT3_VER = \"$VER\";/" "$RAIZ/colabtex/src/juegos/bt3-amigos.js"

# 4. La red del marco (bt3-marco.js + malla.js → juegos/bt3/red.js).
cd "$RAIZ/colabtex" && npm run build:bt3
echo "listo: $DESTINO"
