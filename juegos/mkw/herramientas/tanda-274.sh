#!/usr/bin/env bash
# La tanda de §274: la «⚡ Auto calibración: máxima fluidez». Toma el candado (herramientas/candado.sh) con plazos.
# Uso:  bash herramientas/tanda-274.sh compilar | solo | baja | sala | todo
#   compilar = el programa con congelar_nativo.cpp (la lógica quieta y el dibujo andando) → build/web-274: como el final
#              (W30, PGO), con las semillas de build/web-final-w30. El .wasm CAMBIA (una envoltura nueva)
#   solo     = prueba-auto-calibrar.mjs jugando solo en este PC
#   baja     = lo mismo en la gama baja simulada (§155) con la revisión de límites de Android (§194 W5)
#   sala     = prueba-sala --rapida con el punto §274 (A calibra a mitad de la carrera 1, B se pausa, huellas iguales)
#              (prueba-sincro --directa --calibrar también: ahí no hay árbitro de la sala y A calibra sin pausar)
cd "$(dirname "$0")/.."
QUIEN="${QUIEN:-autocal}"; source herramientas/candado.sh
B=${T274_BUILD:-build/web-274}; DATOS=build/web/datos/auto-calibrar; mkdir -p $DATOS
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"          # la gama baja simulada (§155)
export MKW_VENTANA=${MKW_VENTANA:--1880,549}                      # el monitor de 144 Hz
trap candado_soltar EXIT
fases="$*"; [ "$fases" = todo ] && fases="solo baja sala"
for fase in $fases; do case $fase in
  compilar)
    candado_tomar "274 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 14400 \
      python herramientas/compilar-web.py --modo navegador --final --carpeta $B > $DATOS/compilar.log 2>&1
    s=$?; echo "compilar: salida $s"; tail -2 $DATOS/compilar.log; [ $s = 0 ] || { grep -m5 "error" $DATOS/compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f build/web-final-w30/navegador/$f $B/navegador/; done
    [ -d build/web-final-w30/navegador/imagenes ] && cp -rf build/web-final-w30/navegador/imagenes $B/navegador/
    node herramientas/comprimir-build.mjs $B/navegador > $DATOS/comprimir.log 2>&1; echo "comprimir $?"
    candado_soltar ;;
  solo)
    candado_tomar "274 solo" 7200 || exit 1
    MKW_BUILD=$B/navegador timeout 900 node web/navegador/prueba-auto-calibrar.mjs --ventana $T274_OPC 2>&1 | tee $DATOS/solo.txt | grep -E "^(✓|✗|==)"
    candado_soltar ;;
  baja)
    candado_tomar "274 baja" 7200 || exit 1
    MKW_BUILD=$B/navegador timeout 1200 node web/navegador/prueba-auto-calibrar.mjs --ventana --baja --extra "$BAJA" \
      --chrome "--js-flags=--wasm-enforce-bounds-checks" $T274_OPC 2>&1 | tee $DATOS/baja.txt | grep -E "^(✓|✗|==)"
    candado_soltar ;;
  sala)
    candado_tomar "274 sala" 7200 || exit 1
    # (la sala de verdad, modo=sala: la copa de 2 carreras; el punto §274 a mitad de la carrera 1)
    MKW_BUILD=$B/navegador timeout 1500 node web/navegador/prueba-sala.mjs --rapida --calibrar $T274_OPC 2>&1 | tee $DATOS/sala.txt | grep -E "^(✓|✗|==|  §274)"
    candado_soltar ;;
  *) echo "fase desconocida: $fase"; exit 2 ;;
esac; done
