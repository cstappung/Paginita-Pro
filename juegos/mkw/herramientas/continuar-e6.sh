#!/bin/bash
# Pruebas restantes de E6, secuenciales, con registros separados y candado compartido.
cd "$(dirname "$0")/.."
QUIEN="e6 (local_e6checks)"; source herramientas/candado.sh
export MKW_VENTANA=-1880,549
export MKW_BUILD=build/web-e6/navegador
export MKW_BUILD_NODE=build/web-e6/node
DATOS=build/web/datos/e6
mkdir -p "$DATOS"
trap candado_soltar EXIT
run() {
  candado_tomar "e6 $1" 14400 || exit 1
  local etiqueta=$1; shift
  echo "$(date -Iseconds) empieza $etiqueta"
  "$@" > "$DATOS/retomar-$etiqueta.txt" 2>&1
  local codigo=$?
  echo "$(date -Iseconds) termina $etiqueta: $codigo"
  candado_hueco "e6 sigue"
  candado_soltar
  [ "$codigo" -eq 0 ] || exit "$codigo"
}
run bancos node banco/correr.mjs sonido-worklet sonido escalon sala-carrera consola-falsa
run n12 node herramientas/correr-acotado.mjs 900 web/navegador/prueba-sala.mjs '--extra=&comoLento=30&n8=0'
run doce node herramientas/correr-acotado.mjs 1800 web/navegador/prueba-sala-doce.mjs --carreras 3
run telefono node herramientas/medir-sesion-larga.mjs --pistas 4 --telefono --etiqueta copa-telefono
run hora node herramientas/medir-sesion-larga.mjs --pistas 20 --etiqueta hora
# Cada fase siguiente toma su propio candado.
bash herramientas/tanda-e6.sh gc escalera > "$DATOS/retomar-medidas.txt" 2>&1
run todo node herramientas/correr-todo.mjs
