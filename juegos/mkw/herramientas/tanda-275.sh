#!/bin/bash
# La tanda del piloto «host + predicción» (bitácora §275), con el candado de medición.
#
# Resumen: corre las fases pedidas una tras otra, con un solo turno del candado:
#   estado     prueba-red-estado.mjs sin lastre (las dos a la par: el control)
#   lento      prueba-red-estado.mjs con B frenada (?lastre=${T275_LASTRE:-6})
#   lockstep   lo mismo en la sala de siempre (prueba-sincro --directa, B con el mismo lastre): ¿el lento frena al rápido?
#   compilar   §275b: el programa build/web-275 (el de publicar, W30, con el DWC falso de red_estado_nativo.cpp; CAMBIA el .wasm)
# Las salidas van a build/web/datos/red-estado/tanda-<fase>.txt.
#
# Uso:  bash herramientas/tanda-275.sh estado lento lockstep
cd "$(dirname "$0")/.." || exit 1
QUIEN="red-estado (local_5f1c-275)"
source herramientas/candado.sh
mkdir -p build/web/datos/red-estado
L=${T275_LASTRE:-6}
B=build/web-275
export MKW_BUILD=${MKW_BUILD:-$B/navegador}   # §275b: el programa con el DWC falso (antes de compilarlo: build/web-274)
candado_tomar "tanda-275 $*" 10800 || { echo "no conseguí el candado"; exit 1; }
trap candado_soltar EXIT
for fase in "$@"; do
  salida="build/web/datos/red-estado/tanda-$fase.txt"
  echo "== $fase ($(date +%H:%M))"
  case "$fase" in
    estado)   timeout 900 node web/navegador/prueba-red-estado.mjs --lastre=1 --etiqueta=control > "$salida" 2>&1 & ;;
    lento)    timeout 900 node web/navegador/prueba-red-estado.mjs --lastre="$L" --etiqueta="lastre$L" > "$salida" 2>&1 & ;;
    lockstep) timeout 900 node web/navegador/prueba-sincro.mjs --directa --puerto=8164 --datos=build/web/datos/red-estado/sincro "--extra-b=&lastre=$L" > "$salida" 2>&1 & ;;
    compilar) ( MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 14400                   python herramientas/compilar-web.py --modo navegador --final --carpeta $B &&                 for f in pipelines.bin bloques.json; do cp -f build/web-final-w30/navegador/$f $B/navegador/; done &&                 { [ ! -d build/web-final-w30/navegador/imagenes ] || cp -rf build/web-final-w30/navegador/imagenes $B/navegador/; } &&                 node herramientas/comprimir-build.mjs $B/navegador ) > "$salida" 2>&1 & ;;
    *) echo "fase desconocida: $fase"; continue ;;
  esac
  esperar_pid $!
  tail -25 "$salida"
  candado_hueco
done
