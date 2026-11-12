#!/usr/bin/env bash
# La tanda de §287: la auto calibración pausa en todos los modos (con el programa del sitio, v22). Con el candado.
# Uso:  bash herramientas/tanda-287.sh modos | sala | estado | sitio | todo     (T287_BUILD = otro programa)
cd "$(dirname "$0")/.."
QUIEN="${QUIEN:-autocal287}"; source herramientas/candado.sh
B=${T287_BUILD:-build/web-final-v22/navegador}; D=build/web/datos/auto-calibrar/287; mkdir -p $D
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
trap candado_soltar EXIT
fases="$*"; [ "$fases" = todo ] && fases="modos sala estado sitio"
for fase in $fases; do case $fase in
  modos)  candado_tomar "287 modos" 7200 || exit 1    # SP, VS, TT, GP, Local 2 y la sala de 1 humano
    MKW_BUILD=$B timeout 2700 node web/navegador/prueba-calibrar-modos.mjs $T287_OPC > $D/modos.txt 2>&1; echo "modos $?"; candado_soltar ;;
  sala)   candado_tomar "287 sala" 7200 || exit 1     # la sala de 2 con el lockstep
    MKW_BUILD=$B timeout 1500 node web/navegador/prueba-sala.mjs --rapida --calibrar > $D/sala.txt 2>&1; echo "sala $?"; candado_soltar ;;
  estado) candado_tomar "287 estado" 7200 || exit 1   # «Cada uno su kart» de 2
    MKW_BUILD=$B timeout 1500 node herramientas/prueba-sala-estado.mjs --calibrar > $D/estado.txt 2>&1; echo "estado $?"; candado_soltar ;;
  sitio)  candado_tomar "287 sitio" 7200 || exit 1    # la sala del sitio (emuladores, dos cuentas), lockstep y «Cada uno su kart»
    MKW_BUILD=$B timeout 1500 node herramientas/prueba-experiencia.mjs --calibrar > $D/sitio-lockstep.txt 2>&1; echo "sitio lockstep $?"
    MKW_BUILD=$B timeout 1500 node herramientas/prueba-experiencia.mjs --calibrar --estado > $D/sitio-estado.txt 2>&1; echo "sitio estado $?"; candado_soltar ;;
  *) echo "fase desconocida: $fase"; exit 2 ;;
esac; done
