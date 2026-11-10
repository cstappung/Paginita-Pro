#!/usr/bin/env bash
# G13 (§254): menos partículas (?quitarEfectos=16: no se dibuja Effects::Mgr; su cálculo sigue) y el ajuste «Liviano»
# (los efectos 1-8 fuera, las texturas a la mitad, la salida en 960×540). Usa el programa de G12 (build/web-g12), que
# ya trae el bit 16.
#   fotos  = la Contrarreloj contra el experto: partículas fuera, y «Liviano», contra lo de siempre
#   medir  = el tramo fijo §163 con la tarjeta (?perfilGpu=1): lo de siempre, partículas fuera y «Liviano»; PC y gama baja, 2 pares
#   igual  = la sala con lo de siempre contra todo apagado (31 + texturas 2 + salida 540): huellas iguales
# Uso: bash herramientas/tanda-g13.sh fotos medir igual   → build/web/datos/g13/
cd "$(dirname "$0")/.."
QUIEN="e7-g13 (local_cb5459c6)"; source herramientas/candado.sh
SAL=${G13_PROG:-build/web-g12}; DATOS=build/web/datos/g13; mkdir -p $DATOS
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
TRAMO="&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&perfilGpu=1"
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
LIVIANO="&quitarEfectos=15&texturasMenos=1&salida=540"
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  fotos)
    candado_tomar "g13 fotos" 21600 || exit 1
    for x in "particulas:&quitarEfectos=16" "liviano:$LIVIANO"; do n=${x%%:*}; e=${x#*:}
      MKW_BUILD=$SAL/navegador timeout 1500 node web/navegador/prueba-foto-igual.mjs --ventana --puerto 8183 \
        --extra-b="$e" > $DATOS/fotos-$n.txt 2>&1
      echo "== fotos $n: salida $?"; grep -E "✓|✗" $DATOS/fotos-$n.txt | cut -c1-220
      mkdir -p $DATOS/fotos-$n; cp -f build/web/datos/foto-igual/*-600.png build/web/datos/foto-igual/*-1500.png $DATOS/fotos-$n/ 2>/dev/null
      candado_hueco
    done
    candado_soltar ;;
  medir)
    candado_tomar "g13 medir" 21600 || exit 1
    # (G13_PARES / G13_PERFILES / G13_VARIANTES = más pares de lo dudoso, p. ej. G13_PARES="3 4" G13_PERFILES=baja G13_VARIANTES="base particulas")
    for par in ${G13_PARES:-1 2}; do for x in "pc:" "baja:$BAJA"; do for v in "base:" "particulas:&quitarEfectos=16" "liviano:$LIVIANO"; do
      [ -n "$G13_PERFILES" ] && [[ " $G13_PERFILES " != *" ${x%%:*} "* ]] && continue
      [ -n "$G13_VARIANTES" ] && [[ " $G13_VARIANTES " != *" ${v%%:*} "* ]] && continue
      n=${x%%:*}; e=${x#*:}; vn=${v%%:*}; ve=${v#*:}
      MKW_BUILD=$SAL/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 --ventana \
        --piloto-espera 600 --nucleos 8 --puerto 8183 --etiqueta g13-$n-$vn-p$par --chrome "$LIMITES --disable-dawn-features=timestamp_quantization" \
        --extra "$TRAMO$e$ve" > $DATOS/medir-$n-$vn-p$par.txt 2>&1
      echo "== $n $vn par $par: salida $?"; grep -E "tramo|tarjeta en el tramo" $DATOS/medir-$n-$vn-p$par.txt | head -3 | cut -c1-300
    done; done; candado_hueco; done
    candado_soltar ;;
  igual)
    candado_tomar "g13 igual" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183 \
      --extra-b="&quitarEfectos=31&texturasMenos=2&salida=540" > $DATOS/igual-sala-todo$G13_VUELTA.txt 2>&1
    echo "== sala lo de siempre contra todo apagado: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-todo$G13_VUELTA.txt | tail -6 | cut -c1-200
    # (al revés: A con todo apagado, B lo de siempre: si la espera es del que dibuja menos, cambia de lado)
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8183       --extra-a="&quitarEfectos=31&texturasMenos=2&salida=540" > $DATOS/igual-sala-reves$G13_VUELTA.txt 2>&1
    echo "== sala al revés: salida $?"; grep -E "✓|✗|puntos" $DATOS/igual-sala-reves$G13_VUELTA.txt | tail -6 | cut -c1-200
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-fantasma-igual.mjs --ventana --build-b=$SAL/navegador       --extra-b="&quitarEfectos=31&texturasMenos=2&salida=540" > $DATOS/igual-fantasma$G13_VUELTA.txt 2>&1
    echo "== fantasma con todo apagado: salida $?"; grep -E "✓|✗" $DATOS/igual-fantasma$G13_VUELTA.txt | tail -6 | cut -c1-200
    candado_soltar ;;
esac; done
