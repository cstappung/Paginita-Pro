#!/bin/bash
# W10b, la puerta (bitácora §284): ¿cuánto rinde el núcleo de la lógica (A) si el dibujo del juego corre «sin salida»?
#
# Resumen: un solo programa (build/web-w10b-puerta, la línea del final W30 + PR403 con MKW_CFLAGS_TODO=-DMKW_W10B: el
# interruptor mkw_w10b_sin_salida de aurora, parches/aurora-w10b.diff). Las variantes solo cambian la dirección:
#   base  = el juego de siempre dibujando todos los cuadros (&dibujarSiempre=1, N8 apagado)
#   w10b  = lo mismo con el dibujo sin salida en la carrera (herramientas/w10b/sin-salida.js, &w10b=1)
#   techo = sin la escena 3D (saltar-todo.js, el techo de §278) para comparar
# El tramo fijo de §163 (cuadros de lógica por segundo), pares intercalados con el orden dado vuelta. Todo con el candado.
# Fases: compilar  pc  telefono   (W10B_VUELTAS="1 2", W10B_PARES_TEL=2; W10B_TOPE= = a 60 de verdad, sin ?sinTope: así se dibujan todos los cuadros y vale el trabajo por cuadro)
cd "$(dirname "$0")/.." || exit 1
QUIEN="${QUIEN:-w10b}"
source herramientas/candado.sh
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
DATOS=build/web/datos/w10b; mkdir -p $DATOS
FIN=build/web-w10b-puerta
BASE=build/web-final-w30                                   # (de ahí las semillas y las imágenes)
INIT="$(pwd -W)/herramientas/w10b/sin-salida.js,$(pwd -W)/herramientas/piloto-dibujante/saltar-todo.js"
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
var() { case $1 in base) echo "&n8=0";; w10b) echo "&n8=0&w10b=1";; techo) echo "&n8=0&techo3d=1";; esac; }

compilar() {   # (no necesita el candado: no mide)
  paso "compilar la puerta → $FIN/navegador"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30-403s MKW_AURORA=terceros/aurora-main-viejo-motor MKW_CFLAGS_TODO=-DMKW_W10B \
    timeout 21600 python herramientas/compilar-web.py --modo navegador --final --sin-pgo --carpeta $FIN > $DATOS/compilar.log 2>&1
  echo "salida $?"; grep -E "error:|build stopped|FAILED" $DATOS/compilar.log | cut -c1-200 | head -8
  ls -la --time-style=+%H:%M $FIN/navegador/mkw.wasm
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $FIN/navegador/; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $FIN/navegador/
  node herramientas/comprimir-build.mjs $FIN/navegador > $DATOS/comprimir.log 2>&1; echo "comprimir $?"
}
tramo() {   # $1 variante, $2 etiqueta
  MKW_INIT_JS="$INIT" MKW_BUILD=$FIN/navegador timeout 1500 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto \
    --segundos 5 --ventana --piloto-espera 900 --nucleos 8 --puerto 8187 --etiqueta "$2" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo${W10B_TOPE-&sinTope=1}&tramo=600-2400&dibujarSiempre=1$(var $1)" \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'tramo (§163).*' $DATOS/$2.txt | head -1) $(grep -o '\[w10b\][^"]*' $DATOS/$2.txt | tail -1)"
  candado_hueco
}
pc() {
  trap candado_soltar EXIT; candado_tomar "w10b pc" ${CANDADO_ESPERA:-21600} || exit 1
  for v in ${W10B_VUELTAS:-1 2}; do
    paso "par $v (este PC)"
    if [ $((v % 2)) = 1 ]; then o=(base w10b techo); else o=(techo w10b base); fi
    for x in "${o[@]}"; do tramo $x w10b-pc-$x-$v; done
  done
  candado_soltar
}
telefono() {
  trap candado_soltar EXIT; candado_tomar "w10b telefono" ${CANDADO_ESPERA:-21600} || exit 1
  paso "el Oppo de verdad por el marco seguro: base, w10b, techo"
  timeout 7200 node herramientas/piloto-dibujante/tramo-telefono-dibujante.mjs --build $FIN/navegador --etiqueta w10b \
    --pares ${W10B_PARES_TEL:-2} --variantes ${W10B_VAR_TEL:-base,w10b,techo} > $DATOS/telefono.txt 2>&1
  echo "salida $?"; grep -E "^(base|w10b|techo|media)" $DATOS/telefono.txt
  candado_soltar
}
for f in $*; do $f; done
