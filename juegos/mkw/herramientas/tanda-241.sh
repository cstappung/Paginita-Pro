#!/bin/bash
# §241 (cierre de los ítems a medias): W29 con 512 MB y su adopción en el programa final.
#
# Resumen: W29 (§239) probó la memoria del wasm de tamaño fijo con 1024 MB (+14,6 % en la gama baja simulada). Aquí:
#   compilar512  = build/web-w29-512 (como build/web-w29-fija de §239, pero 512 MB; sin --final, semillas de web-w19)
#   memoria512   = medir-memoria-pistas con 11 pistas en una pestaña: ¿alcanzan 512 MB? (si no, el programa se cae)
#   igual512     = prueba-navegador con ese programa (22 puntos)
#   memoria-e6   = lo mismo con el final de hoy (build/web-e6: --final = la ventana fija de H6 + PGO, crece desde 560)
#   final        = el final con la memoria fija: --final --memoria-fija $W29_FINAL_MB, objetos de build/web-e6 y su
#                  perfil PGO reusado; el enlace va a build/web-e6-w29 (Node y navegador); semillas de web-e6
#   memoria-final, igual-final (prueba-arranque 13, la sala A=fija B=e6, los fantasmas), medir (pares intercalados)
#   energia      = prueba-energia.mjs (E1 con el Ahorro de energía de verdad de Chrome, E2 con el «calor» de mentira)
# Uso:  W29_FINAL_MB=768 bash herramientas/tanda-241.sh compilar512 memoria512 igual512 memoria-e6 final …
# Cada fase toma el candado de medición (herramientas/candado.sh) y lo suelta entre fases si otro espera.
cd "$(dirname "$0")/.."
QUIEN="cierre-241 (sesion de cierre de items)"; source herramientas/candado.sh
DATOS=build/web/datos/cierre-241; mkdir -p $DATOS
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
LIMITES="--js-flags=--wasm-enforce-bounds-checks"   # W5: la revisión de límites de Android (teléfono simulado)
GAMA_BAJA="&lastre=3.5"                               # la gama baja del plan (el Oppo real ≈ 1,7)
FINAL_MB=${W29_FINAL_MB:-768}
E6=build/web-e6; FIN=build/web-e6-w29
# 11 pistas: las 8 de siempre de medir-memoria-pistas más 3 de las pesadas de Nintendo (copas 3 y 7)
PISTAS=${W29_PISTAS:-0.0,1.1,2.2,3.2,3.3,5.3,7.3,13.2,30.2,50.2,65.0}
tomar() {   # si ya lo tengo (otra fase de esta misma tanda), solo cambio la etiqueta
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
semillas() {   # $1 = de dónde, $2 = a dónde: la semilla de pipelines, la de bloques y las imágenes van con el .wasm
  for f in pipelines.bin bloques.json; do cp -f $1/navegador/$f $2/navegador/ 2>/dev/null; done
  [ -d $1/navegador/imagenes ] && cp -rf $1/navegador/imagenes $2/navegador/
}

compilar512() {
  tomar "241 compilar 512"
  paso "navegador → build/web-w29-512 (--memoria-fija 512)"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 5400 \
    python herramientas/compilar-web.py --modo navegador --memoria-fija 512 --carpeta build/web-w29-512 > $DATOS/compilar-512.log 2>&1
  echo "salida $?"; tail -2 $DATOS/compilar-512.log
  semillas build/web-w19 build/web-w29-512
  node herramientas/comprimir-build.mjs build/web-w29-512/navegador > /dev/null 2>&1 || true
}
memoria() {   # $1 = programa, $2 = etiqueta
  tomar "241 memoria $2"
  paso "memoria en $PISTAS: $1"
  MKW_BUILD=$1/navegador timeout 2400 node herramientas/medir-memoria-pistas.mjs --pistas $PISTAS --extra "&n8=0" \
    --etiqueta $2 > $DATOS/memoria-$2.txt 2>&1
  echo "salida $?"; tail -16 $DATOS/memoria-$2.txt
}
igual512() {
  tomar "241 igual 512"
  paso "prueba-navegador con 512"
  MKW_BUILD=build/web-w29-512/navegador timeout 1500 node web/navegador/prueba-navegador.mjs 1800 > $DATOS/prueba-navegador-512.txt 2>&1
  tail -6 $DATOS/prueba-navegador-512.txt
}
final() {
  tomar "241 final"
  for m in node navegador; do
    local modo=(); [ $m = navegador ] && modo=(--modo navegador)
    paso "el final con --memoria-fija $FINAL_MB ($m) → $FIN/$m"
    MKW_WIICOMPILED=terceros/Wiicompiled-motor-h6 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 10800 \
      python herramientas/compilar-web.py --final "${modo[@]}" --memoria-fija $FINAL_MB --carpeta $E6 --salida $FIN/$m \
      > $DATOS/final-$m.log 2>&1
    echo "salida $?"; grep -E "^PGO|con PGO|error:" $DATOS/final-$m.log | cut -c1-160 | head -5; tail -2 $DATOS/final-$m.log
  done
  semillas $E6 $FIN
  node herramientas/comprimir-build.mjs $FIN/navegador > /dev/null 2>&1 || true
  ls -la $E6/navegador/mkw.wasm $FIN/navegador/mkw.wasm $FIN/navegador/mkw.wasm.br 2>/dev/null
}
igual_final() {
  tomar "241 igual final"
  paso "prueba-arranque con el final fijo (Node)"
  MKW_BUILD_NODE=$FIN/node timeout 900 node web/node/prueba-arranque.mjs > $DATOS/arranque-final.txt 2>&1; tail -4 $DATOS/arranque-final.txt
  paso "la sala: A = el final fijo, B = el final de hoy (web-e6)"
  MKW_BUILD=$FIN/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
    --datos=$DATOS/sincro-final --build-b=$E6/navegador > $DATOS/sincro-final.txt 2>&1; tail -20 $DATOS/sincro-final.txt
  candado_hueco "sigue"; tomar "241 igual final"
  paso "los fantasmas: A = el final fijo, B = web-e6"
  MKW_BUILD=$FIN/navegador timeout 1500 node web/navegador/prueba-fantasma-igual.mjs --build-b=$E6/navegador \
    --puerto 8178 > $DATOS/fantasma-final.txt 2>&1; tail -12 $DATOS/fantasma-final.txt
}
tramo() {   # $1 etiqueta, $2 programa, $3 lastre, $4 banderas de Chrome: el tramo fijo de §163 (12 CPU, semilla fija)
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$2/navegador timeout 900 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8177 --etiqueta "241-$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&anillo=0$3" > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1)"
}
medir() {
  tomar "241 medir"
  for p in $(seq 1 ${W29_PARES:-2}); do
    paso "par $p (e6 = hoy, fija = $FINAL_MB MB)"
    if [ $((p % 2)) = 1 ]; then A=e6; B=fija; else A=fija; B=e6; fi
    for v in $A $B; do d=$E6; [ $v = fija ] && d=$FIN; tramo baja-$v-$p $d "$GAMA_BAJA" "$LIMITES"; done
    for v in $A $B; do d=$E6; [ $v = fija ] && d=$FIN; tramo pc-$v-$p $d "" ""; done
    candado_hueco "sigue"; tomar "241 medir"
  done
}

energia() {
  tomar "241 energia"
  paso "prueba-energia (E1/E2) con $1"
  MKW_BUILD=$1/navegador timeout 1800 node web/navegador/prueba-energia.mjs > $DATOS/energia.txt 2>&1; tail -16 $DATOS/energia.txt
}

[ $# -eq 0 ] && { sed -n 2,14p "$0"; exit 1; }
for fase in "$@"; do
  case "$fase" in
    compilar512) compilar512 ;;
    memoria512) memoria build/web-w29-512 w29-512 ;;
    igual512) igual512 ;;
    memoria-e6) memoria $E6 e6-final ;;
    final) final ;;
    memoria-final) memoria $FIN e6-w29 ;;
    igual-final) igual_final ;;
    medir) medir ;;
    energia) energia ${W29_ENERGIA:-$FIN} ;;
    *) sed -n 2,14p "$0"; exit 1 ;;
  esac
  candado_hueco "sigue"
done
exit 0
