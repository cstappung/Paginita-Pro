# Pone em++/emcc en el PATH de Git Bash (emsdk_env.ps1 solo sirve en PowerShell).
# Uso:  source herramientas/emsdk.sh
_raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export EMSDK="$_raiz/herramientas/emsdk"
export EM_CONFIG="$EMSDK/.emscripten"
export PATH="$EMSDK/upstream/emscripten:$EMSDK/upstream/bin:$PATH"
unset _raiz
