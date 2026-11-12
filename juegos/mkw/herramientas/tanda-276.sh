#!/bin/bash
# §276: las pruebas con el juego del arranque rápido, con el candado de medición.
# Resumen: corre una detrás de otra, con el programa final (MKW_BUILD, ya comprimido: prueba-precarga necesita el
# .wasm.br para que entre en la caché HTTP), prueba-navegador, prueba-precarga, prueba-celular, prueba-tactil y
# prueba-sala --rapida, y guarda la salida de cada una en build/web/datos/arranque/pruebas-<fecha>/.
# Uso:  bash herramientas/tanda-276.sh [prueba …]   (sin argumentos = las cinco; nombres: navegador precarga celular tactil sala)
cd "$(dirname "$0")/.." || exit 1
QUIEN="arranque-276 (local_arranque276)"
source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-w30/navegador}
export MKW_VENTANA=${MKW_VENTANA:--1880,549}   # (el monitor de 144 Hz: sin la variable, prueba-navegador abre una ventana más alta que el monitor y Windows la manda al de 240)
# precarga: el programa comprimido (si falta, se arma antes de tomar el candado: no corre el juego)
[ -f "$MKW_BUILD/mkw.wasm.br" ] || node herramientas/comprimir-build.mjs "$MKW_BUILD" || exit 1
candado_tomar "pruebas-276" || exit 1
trap candado_soltar EXIT
dir=build/web/datos/arranque/pruebas-$(date +%Y%m%d-%H%M); mkdir -p "$dir"
cual=("$@"); [ ${#cual[@]} -eq 0 ] && cual=(navegador precarga celular tactil sala)
fallos=0
for p in "${cual[@]}"; do
  case $p in
    navegador) cmd=(node web/navegador/prueba-navegador.mjs 1800 --ventana) ;;
    precarga)  cmd=(node web/navegador/prueba-precarga.mjs) ;;
    celular)   cmd=(env CHROME="${CHROME:-C:/Program Files/Google/Chrome/Application/chrome.exe}" node herramientas/prueba-celular.mjs) ;;
    tactil)    cmd=(node web/navegador/prueba-tactil.mjs) ;;
    sala)      cmd=(node web/navegador/prueba-sala.mjs --rapida) ;;
    inicio)    cmd=(node web/navegador/prueba-inicio.mjs) ;;
    fotos)     cmd=(bash -c "node herramientas/foto-cartel.mjs --etiqueta pc && node herramientas/foto-cartel.mjs --telefono --etiqueta telefono") ;;
    *) echo "¿$p?"; continue ;;
  esac
  echo "=== $p: ${cmd[*]} ($(date +%H:%M))"
  "${cmd[@]}" > "$dir/$p.txt" 2>&1; r=$?
  echo "=== $p: salida $r"; tail -4 "$dir/$p.txt"
  [ $r -ne 0 ] && fallos=$((fallos + 1))
  candado_hueco
done
echo "fin: $fallos con falla → $dir"
exit $fallos
