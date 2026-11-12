#!/usr/bin/env bash
# La tanda de §273: el 1 % bajo de las imágenes en elegir personaje (gama baja). Toma el candado (herramientas/candado.sh).
# Uso:  T273_ETIQUETA=x T273_VARIANTES="&n8=1&pausaPersonaje=0 &n8=1" [T273_PERFILES="baja pc"] bash herramientas/tanda-273.sh personaje
#   personaje = medir-personaje.mjs (personaje sin sala y con sala) con cada variante y perfil; guarda TODO lo que imprime
#               (los cuadros largos de la página por guion, los pipelines, la pausa) en build/web/datos/menus-273/<etiqueta>.txt
cd "$(dirname "$0")/.."
QUIEN="${QUIEN:-personaje-273 (local_cb5459c6)}"; source herramientas/candado.sh
B=${T273_BUILD:-build/web-270}; DATOS=build/web/datos/menus-273; mkdir -p $DATOS
ET=${T273_ETIQUETA:-prueba}
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"          # la gama baja simulada (§155)
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  personaje)
    candado_tomar "273 personaje $ET" 21600 || exit 1
    for perfil in ${T273_PERFILES:-baja}; do for v in ${T273_VARIANTES:-&n8=1}; do
      X="$v"; CH=""; [ $perfil = baja ] && { X="$BAJA$v"; CH="--js-flags=--wasm-enforce-bounds-checks"; }   # §194 W5
      echo "### $perfil $v" >> $DATOS/$ET.txt
      MKW_BUILD=$B/navegador timeout 1200 node herramientas/medir-personaje.mjs --ventana $T273_OPC --lugares ${T273_LUGARES:-personaje,sala-personaje} \
        ${CH:+--chrome "$CH"} "$X" 2>&1 | grep -v "^\[" | tee -a $DATOS/$ET.txt | grep "^==" | sed "s|^|$perfil $v |" | cut -c1-300
    done; done
    candado_soltar ;;
  sala)
    # la sala entera (prueba-sala --rapida) con el programa de B y Automático: que no se cuelgue y cuántos pipelines se
    # armaron de golpe en la carrera con la pausa de elegir personaje (los «[pipelines]» del registro)
    candado_tomar "273 sala $ET" 21600 || exit 1
    MKW_BUILD=$B/navegador timeout 2400 node web/navegador/prueba-sala.mjs --rapida "--extra=${T273_EXTRA:-&n8=auto}" > $DATOS/$ET-sala.txt 2>&1
    echo "== sala: salida $?"; grep -E "puntos|✗" $DATOS/$ET-sala.txt | tail -5
    candado_soltar ;;
  *) echo "fase desconocida: $fase"; exit 1 ;;
esac; done
