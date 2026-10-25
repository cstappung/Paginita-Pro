#!/usr/bin/env bash
# Copia el kit (SOLO lo propio) a la copia del sitio, en juegos/mkw/ (bitácora §54).
#
# Resumen: el sitio (repo cstappung/Paginita-Pro, clonado en terceros/Paginita-Pro) guarda nuestro trabajo en
# juegos/mkw/: parches/, herramientas/, web/ (páginas, .mjs y C++ propios), docs/, banco/, PLAN.md, CLAUDE.md. La lista
# sale de git (`git ls-files --cached --others --exclude-standard`): los archivos de este proyecto que NO están en
# .gitignore. El .gitignore deja afuera todo lo del juego: la imagen, extraido/, el C++ traducido (generated/), build/
# (mkw.wasm, mkw.wasm.br, pipelines.bin, bloques.json), RetroRewind6/ y terceros/. Además este script frena si encuentra
# algo con forma de juego o un archivo de más de 50 MB. No hace commit ni push: eso se hace a mano después de mirar.
#
# Uso:  bash herramientas/subir-kit.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
sitio="$raiz/terceros/Paginita-Pro"
destino="$sitio/juegos/mkw"
cd "$raiz"

lista="$(git ls-files --cached --others --exclude-standard)"
# freno: nada con forma de juego (los .wasm de banco/pruebas son programas de prueba nuestros, sin nada del juego)
if echo "$lista" | grep -iE '\.(rvz|iso|wbfs|dol|rel|szs|brsar|brstm|thp|br|gz)$|(^|/)(generated|extraido|build|RetroRewind6|riivolution|terceros)/|pipelines\.bin|bloques\.json' ; then
  echo "ALTO: hay archivos del juego en la lista (arriba). No se copia nada." >&2; exit 1
fi
if echo "$lista" | grep -E '\.wasm$' | grep -v '^banco/pruebas/' ; then
  echo "ALTO: un .wasm fuera de banco/pruebas (arriba). No se copia nada." >&2; exit 1
fi
while IFS= read -r f; do
  if [ "$(stat -c %s "$f")" -gt 52428800 ]; then echo "ALTO: $f pasa de 50 MB" >&2; exit 1; fi
done <<< "$lista"

# la carpeta vieja del primer envío (juegos/mkw-kit) pasa a llamarse juegos/mkw
if [ -d "$sitio/juegos/mkw-kit" ] && [ ! -d "$destino" ]; then git -C "$sitio" mv juegos/mkw-kit juegos/mkw; fi
mkdir -p "$destino"
# lo que ya no está en el proyecto se borra del kit (menos LEEME.md, que es solo del kit)
( cd "$destino" && find . -type f ! -name LEEME.md | sed 's#^\./##' ) | while IFS= read -r f; do
  echo "$lista" | grep -qxF "$f" || { rm -f "$destino/$f"; echo "borrado del kit: $f"; }
done
n=0
while IFS= read -r f; do
  mkdir -p "$destino/$(dirname "$f")"
  cp "$f" "$destino/$f"; n=$((n + 1))
done <<< "$lista"
echo "$n archivos copiados a $destino"
git -C "$sitio" status --short | head -40
