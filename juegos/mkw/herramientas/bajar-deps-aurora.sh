#!/usr/bin/env bash
# Baja las librerías de terceros que aurora (el dibujante de WiiCompiled) necesita para compilarse a wasm.
#
# Resumen: aurora, compilada con CMake en el PC, baja estas librerías sola (FetchContent en
# aurora-main/extern/CMakeLists.txt). Para la web no usamos CMake, así que las bajamos aquí con las MISMAS
# versiones y las MISMAS huellas SHA-256 que aurora fija, y las dejamos en terceros/deps-aurora/ (ignorado por git).
# Una huella SHA-256 es como el número de serie de un archivo: si un solo byte cambia, la huella cambia; así se
# comprueba que lo bajado es exactamente lo que aurora probó.
#
# Uso (Git Bash, desde la raíz del proyecto):  bash herramientas/bajar-deps-aurora.sh
#
# No se bajan: zlib, libpng y freetype (Emscripten los trae como "ports": -sUSE_ZLIB, -sUSE_LIBPNG,
# -sUSE_FREETYPE), Dawn (en la web el navegador ES el WebGPU; se usa --use-port=emdawnwebgpu), SDL3 (port
# sdl3) ni zstd (solo comprime la caché de Dawn nativo, que en la web no existe). xxHash ya está en terceros/xxhash-dl.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
destino="$raiz/terceros/deps-aurora"
mkdir -p "$destino/_descargas"

# baja NOMBRE URL HUELLA CARPETA_DENTRO_DEL_ARCHIVO
#   Descarga el archivo (si no está ya), revisa su huella, y lo descomprime en terceros/deps-aurora/NOMBRE.
baja() {
  local nombre="$1" url="$2" huella="$3" interno="$4"
  local archivo="$destino/_descargas/$(basename "$url")"
  if [ -d "$destino/$nombre" ]; then echo "✓ $nombre ya está"; return; fi
  [ -f "$archivo" ] || curl -fL --retry 3 -o "$archivo" "$url"
  local real; real="$(sha256sum "$archivo" | cut -d' ' -f1)"
  if [ -n "$huella" ] && [ "${real,,}" != "${huella,,}" ]; then
    echo "✗ $nombre: huella distinta (esperaba $huella, salió $real)"; exit 1
  fi
  echo "✓ $nombre  sha256=$real"
  local tmp="$destino/_tmp_$nombre"; rm -rf "$tmp"; mkdir -p "$tmp"
  case "$archivo" in
    *.zip) unzip -q "$archivo" -d "$tmp" ;;
    *)     tar -xzf "$archivo" -C "$tmp" ;;
  esac
  mv "$tmp/$interno" "$destino/$nombre"; rm -rf "$tmp"
}

# abseil: tablas hash rápidas (flat_hash_map) y árboles (btree). aurora no fija su huella; la anotamos en versiones.md.
baja abseil  https://github.com/abseil/abseil-cpp/archive/refs/tags/20240722.0.tar.gz \
  "" abseil-cpp-20240722.0
# fmt: arma textos para el log, tipo printf pero seguro ("{} cuadros").
baja fmt     https://github.com/fmtlib/fmt/archive/refs/tags/11.1.4.tar.gz \
  ac366b7b4c2e9f0dde63a59b3feb5ee59b67974b14ee5dc9ea8ad78aa2c1ee1e fmt-11.1.4
# imgui: menús dibujados encima del juego (la capa de ajustes de aurora).
baja imgui   https://github.com/ocornut/imgui/archive/refs/tags/v1.91.9b-docking.tar.gz \
  466fdef9b18de15f0bb6e288e3d00ffa3d82200ec458ce5e4f724a161d9528a5 imgui-1.91.9b-docking
# sqlite: base de datos en un archivo; aurora guarda ahí qué "recetas de dibujo" (pipelines) ya armó.
baja sqlite  https://sqlite.org/2026/sqlite-amalgamation-3510300.zip \
  acb1e6f5d832484bf6d32b681e858c38add8b2acdfd42ac5df24b8afb46552b4 sqlite-amalgamation-3510300
# tracy: medidor de tiempos para depurar. Solo se usan sus cabeceras, apagado (sin TRACY_ENABLE no hace nada).
baja tracy   https://github.com/wolfpld/tracy/archive/a64b9a20294d59421a2f57aeca3c6383d8c48169.tar.gz \
  24d342b5127d7f659dc3cf94f24347b348cc736f25b17a691fd7f69541937658 tracy-a64b9a20294d59421a2f57aeca3c6383d8c48169

echo "listo: $destino"
