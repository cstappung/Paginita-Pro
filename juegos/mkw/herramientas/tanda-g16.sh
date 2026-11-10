#!/usr/bin/env bash
# G16 (§256): el 1 % y el 0,1 % bajo de las imágenes que se ven, contra la meta del dueño (1 % bajo ≥ 95 % de los fps a
# la vista). medir-sitio imprime dos: lo que llegó al monitor (Display::FrameDisplayed de Chrome) y las imágenes de aurora
# en la página (imagenes-vista.mjs, con la causa de cada pico).
#   medir   = la carrera directa de 12 CPU a ritmo normal (sin el modo sin tope), 40 s, sin ventana; este PC y la gama baja
#             simulada (§155/§163 + la revisión de límites de Android), con 60, 30 parejas e intermedia; G16_VUELTAS pares
#   enlinea = lo que ve un jugador en la sala (medir-enlinea, 60 s) con 60, 30 parejas e intermedia
#   diag    = medir-enlinea en 60 sin ventana y con ventana: refrescos por imagen y el compás de la toma
#   sala    = la copa entera de la sala (prueba-sincro --copa, ~10 min): el 1 % bajo de cada carrera en las dos pestañas
# G16_ETIQUETA = el nombre de la tanda (antes / despues…), G16_EXTRA = parámetros de más para todo (p. ej. «&xyz=0»).
# Uso: G16_ETIQUETA=antes bash herramientas/tanda-g16.sh medir enlinea   → build/web/datos/g16/
cd "$(dirname "$0")/.."
QUIEN="e7-g16 (local_cb5459c6)"; source herramientas/candado.sh
SAL=${G16_PROG:-build/web-g15}; DATOS=build/web/datos/g16; mkdir -p $DATOS
ET=${G16_ETIQUETA:-base}; EX=${G16_EXTRA:-}
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
CARRERA="&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo"
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  medir)
    candado_tomar "g16 medir $ET" 21600 || exit 1
    for par in ${G16_VUELTAS:-1}; do for x in "pc:" "baja:$BAJA"; do for v in ${G16_MODOS:-0 1 2}; do
      n=${x%%:*}; e=${x#*:}
      [ -n "$G16_PERFILES" ] && [[ " $G16_PERFILES " != *" $n "* ]] && continue
      MKW_BUILD=$SAL/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 40 \
        --piloto-espera 600 --nucleos 8 --puerto 8185 --etiqueta g16-$ET-$n-n8$v-p$par --chrome "$LIMITES" \
        --extra "$CARRERA$e&n8=$v$EX" > $DATOS/medir-$ET-$n-n8$v-p$par.txt 2>&1
      echo "== $ET $n n8=$v par $par: salida $?"; grep -E "1 % bajo|fps en la carrera|CPU por cuadro" $DATOS/medir-$ET-$n-n8$v-p$par.txt | cut -c1-330
    done; candado_hueco; done; done
    candado_soltar ;;
  enlinea)
    candado_tomar "g16 enlinea $ET" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 2400 node herramientas/medir-enlinea.mjs "&n8=0$EX" "&n8=1$EX" "&n8=2$EX" > $DATOS/enlinea-$ET.txt 2>&1
    echo "== medir-enlinea $ET: salida $?"; grep -E "variante|1 % bajo" $DATOS/enlinea-$ET.txt | cut -c1-330
    candado_soltar ;;
  diag)
    # (el reparto de cada imagen en refrescos y el compás de la toma: sin ventana y con ventana en el monitor de MKW_VENTANA)
    candado_tomar "g16 diag $ET" 21600 || exit 1
    for vent in ${G16_VENTANAS:-"" "--ventana"}; do
      MKW_BUILD=$SAL/navegador timeout 1800 node herramientas/medir-enlinea.mjs $vent ${G16_VARIANTES:-"&n8=0$EX"} > $DATOS/diag-$ET${vent:+-ventana}.txt 2>&1
      echo "== diag $ET ${vent:-sin ventana}: salida $?"; cut -c1-600 $DATOS/diag-$ET${vent:+-ventana}.txt | grep -v "^\["
    done
    candado_soltar ;;
  sala)
    candado_tomar "g16 sala $ET" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 3000 node web/navegador/prueba-sincro.mjs --copa --minutos=12 --puerto=8185 \
      --extra="$EX" > $DATOS/sala-$ET.txt 2>&1
    echo "== la copa en la sala $ET: salida $?"; grep -E "✓|✗" $DATOS/sala-$ET.txt | tail -8 | cut -c1-200
    cp -f build/web/datos/sincro/registro.txt $DATOS/sala-$ET-registro.txt
    grep "\[imagenes\] carrera" $DATOS/sala-$ET-registro.txt | cut -c1-330
    candado_soltar ;;
esac; done
