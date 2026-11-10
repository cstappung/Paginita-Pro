#!/bin/bash
# N11 (plan v4, etapa E5; bitácora §229): la puerta del video desde un PC, medida antes de construir nada.
#
# Resumen: con el candado de medición (QUIEN=e5), corre medir-sitio.mjs con la carrera directa (pista 0.0, semilla
# 1234, CPU máximo; el puesto 1 es un humano quieto, el resto CPU) y el instrumento ?n11=MBIT (n11-video.mjs: la imagen
# del juego codificada por WebRTC a un receptor en la misma página). Fases:
#   prueba   una corrida corta: que el video y la pantalla partida (&vistas=2) anden
#   video    (a) la subida: 3, 5 y 8 Mbit/s con H.264, y 8 con VP8, a 720 de alto, 30 s de carrera (este PC)
#   vista    (b) el PC que dibuja la vista de más: este PC y la gama media simulada, en el tramo fijo sin tope (§163),
#            base contra «dos vistas + video a 8», intercalados, 2 pares (la regla del dueño)
# Uso:  bash herramientas/tanda-n11.sh prueba video vista
# Deja build/web/datos/n11/<etiqueta>.txt (y los .json de medir-sitio en build/web/datos/medir-sitio/).
cd "$(dirname "$0")/.."
QUIEN="e5 (local_e5)"; source herramientas/candado.sh
BASE=${N11_BUILD:-build/web-e4c-base}
DATOS=build/web/datos/n11
mkdir -p "$DATOS"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
CARRERA="&modo=directa&pista=0.0&semilla=1234&cpu=maximo&n8=0"
GAMA_MEDIA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
paso() { echo "== $(date '+%H:%M') $*"; }

carrera() {   # $1 etiqueta, $2 parámetros, $3 segundos
  # (--dpr 1.5: el recuadro del juego en la página es de 854×480 puntos; con 1,5 píxeles por punto el lienzo queda de
  # 1281×720 y el juego dibuja de verdad a 720, lo que sale al teléfono. --viewport y --force-device-scale-factor no servían)
  MKW_BUILD=$BASE/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos ${3:-30} \
    --ventana --dpr 1.5 --piloto-espera 600 --puerto 8179 --etiqueta "n11-$1" --extra "$CARRERA$2" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'n11 (§229).*' $DATOS/$1.txt | head -1 | cut -c1-600)"
  grep -E "fps|imágenes" $DATOS/$1.txt | head -3
}
tramo() {     # $1 etiqueta, $2 parámetros, $3 banderas de Chrome
  local chrome=(); [ -n "$3" ] && chrome=(--chrome "$3")
  MKW_BUILD=$BASE/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --dpr 1.5 --piloto-espera 600 --nucleos 8 --puerto 8179 --etiqueta "n11-$1" "${chrome[@]}" \
    --extra "$CARRERA&sinTope=1&tramo=600-2400$2" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1 | cut -c1-200)"
}

for fase in "$@"; do case $fase in
  prueba)
    tomar "e5 n11 prueba"
    paso "prueba: video a 8 Mbit/s con la marca"
    carrera prueba "&soloCpu=1&n11=8&n11Marca=1" 15 ;;
  video)
    tomar "e5 n11 video"
    # (&soloCpu=1: la cámara sigue a un kart que corre la carrera de verdad; con los humanos quietos en la largada la
    # imagen casi no cambia y el video pedía 0,67 Mbit/s: no dice nada)
    for mb in 3 5 8; do paso "video H.264 a $mb Mbit/s"; carrera video-h264-$mb "&soloCpu=1&n11=$mb"; done
    paso "video VP8 a 8"; carrera video-vp8-8 "&soloCpu=1&n11=8&n11Codec=vp8"
    paso "video H.264 a 8, el teléfono a 540"; carrera video-h264-8-540 "&soloCpu=1&n11=8&n11Alto=540"
    paso "la demora con la marca pintada, H.264 a 8"; carrera video-marca-8 "&soloCpu=1&n11=8&n11Marca=1"
    paso "la demora con la marca y el colchón en 0"; carrera video-marca-8-c0 "&soloCpu=1&n11=8&n11Marca=1&n11Colchon=0"
    candado_hueco ;;
  vista)
    tomar "e5 n11 vista"
    for v in ${N11_VUELTAS:-1 2}; do
      paso "vuelta $v: este PC y la gama media, base y dos vistas + video"
      if [ $((v % 2)) = 1 ]; then
        tramo pc-base-$v "" ""; tramo pc-extra-$v "&vistas=2&n11=8" ""
        tramo media-base-$v "$GAMA_MEDIA" "$LIMITES"; tramo media-extra-$v "$GAMA_MEDIA&vistas=2&n11=8" "$LIMITES"
      else
        tramo pc-extra-$v "&vistas=2&n11=8" ""; tramo pc-base-$v "" ""
        tramo media-extra-$v "$GAMA_MEDIA&vistas=2&n11=8" "$LIMITES"; tramo media-base-$v "$GAMA_MEDIA" "$LIMITES"
      fi
      candado_hueco
    done ;;
  *) echo "fase desconocida: $fase"; exit 1 ;;
esac; done
candado_soltar
