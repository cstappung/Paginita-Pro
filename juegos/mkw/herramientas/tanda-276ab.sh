#!/bin/bash
# §276: prueba-navegador con §276 apagado (antes) y prendido (después), intercalados, con el candado: para saber si una
# falla al borde (cuadros parejos, la cola del sonido, un cuadro de 16,9 ms) es de §276 o del PC.
# Uso:  bash herramientas/tanda-276ab.sh [pares=2]
cd "$(dirname "$0")/.." || exit 1
QUIEN="arranque-276 (local_arranque276)"
source herramientas/candado.sh
export MKW_BUILD=${MKW_BUILD:-build/web-final-w30/navegador} MKW_VENTANA=${MKW_VENTANA:--1880,549}
ANTES="&arranqueRapido=0&topeTelefono=0&manifiestoTemprano=0&programaTemprano=0&gpuParalela=0"
candado_tomar "navegador-276ab" || exit 1
trap candado_soltar EXIT
dir=build/web/datos/arranque/ab-$(date +%Y%m%d-%H%M); mkdir -p "$dir"
for k in $(seq 1 "${1:-2}"); do
  for v in antes despues; do
    x=""; [ $v = antes ] && x="$ANTES"
    node web/navegador/prueba-navegador.mjs 1800 --ventana --extra "$x" > "$dir/$v-$k.txt" 2>&1
    echo "$v-$k: $(grep -E '^[0-9]+ bien' "$dir/$v-$k.txt" | tail -1)"; grep "✗" "$dir/$v-$k.txt"
  done
done
