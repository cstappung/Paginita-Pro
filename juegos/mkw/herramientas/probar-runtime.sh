#!/usr/bin/env bash
# Intenta compilar cada .cpp de runtime/src con em++ (16 a la vez) y resume qué falla y por qué.
# Sirve para ir portando el runtime archivo por archivo: no enlaza nada, solo compila.
# Uso:  bash herramientas/probar-runtime.sh [carpeta_salida]   (por defecto build/runtime-prueba/<hora>)
set -u
raiz="$(cd "$(dirname "$0")/.." && pwd)"
source "$raiz/herramientas/emsdk.sh"
WC="$raiz/terceros/Wiicompiled"
O="${1:-$raiz/build/runtime-prueba/$(date +%H%M%S)}"
mkdir -p "$O"
export WC O
cd "$WC/runtime/src"
# Fuera desde el principio: solo existen en escritorio (Mac, Discord)
find . -name "*.cpp" | sed 's#^\./##' | grep -v -E "guest_flat_memory_macos|discord_presence" | sort > "$O/lista.txt"
compila() {
  local f="$1" n
  n=$(echo "$f" | tr "/" "_")
  if em++ -c "$f" -o "$O/$n.o" --use-port=sdl3 -std=c++20 -O1 -w -fwasm-exceptions \
      -DTARGET_PC -DSDL_MAIN_HANDLED -DNOMINMAX \
      -I "$WC/runtime/include" -I "$WC/runtime/src" -I "$WC" -I "$WC/aurora-main/include" \
      -I "$WC/runtime/third_party" -I "$WC/runtime/third_party/pugixml" -I "$WC/runtime/third_party/toml11" \
      > "$O/$n.log" 2>&1; then echo "OK $f"; else echo "MAL $f"; fi
}
export -f compila
xargs -P 16 -I{} bash -c 'compila "$@"' _ {} < "$O/lista.txt" > "$O/resultado.txt"
echo "$(grep -c ^OK "$O/resultado.txt") de $(wc -l < "$O/lista.txt") compilan  ($O)"
for f in "$O"/*.log; do
  e=$(grep -m1 "error:" "$f" | sed -E 's/^.*(runtime|aurora-main|third_party|sysroot)/\1/' | cut -c1-190)
  [ -n "$e" ] && echo "$(basename "${f%.cpp.log}"): $e"
done | sort -t: -k2
