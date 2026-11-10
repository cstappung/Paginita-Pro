#!/bin/bash
# W31, la prueba barata (bitácora §259): ¿cuánto ganaría guardar la traducción de las listas de dibujo del juego?
#
# Resumen: antes de construir la caché por lista y los render bundles (semanas), se mide su TECHO en Chrome. La copia
# propia de aurora (terceros/aurora-w31, parches/aurora-w31.diff; no toca terceros/aurora-main-viejo-motor ni la de N8)
# trae un instrumento con interruptor de la página, ?w31=…:
#   contar    = cuenta las listas (GXCallDisplayList): cuántas por imagen, cuántas se repiten con los mismos bytes,
#               cuántas son de objetos quietos (además las mismas matrices) y los ms de traducirlas
#   quietos   = el techo de los objetos quietos: sus dibujos se saltan (la imagen pierde esos objetos)
#   todas     = el techo de TODAS las listas: ningún dibujo de una lista se traduce ni se manda (lo más que podría
#               ganar cualquier caché de la traducción: una caché de verdad igual tendría que mandar los dibujos)
# Los registros de estado de cada lista se leen igual en todos los modos (el estado de GX queda como debe).
# Un solo programa (la base de hoy: W30 + esta aurora) y el interruptor: lo único distinto entre las corridas es ?w31.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w31.sh compilar contar chrome
#   compilar = el programa del navegador → build/web-w31 (MKW_MOTOR_W30=7, la W30 adoptada), semillas del final
#   contar   = el tramo fijo con ?w31=contar en este PC y en la gama baja (el reparto de las listas)
#   chrome   = el tramo fijo, 0 contra todas contra quietos, en la gama baja (con la revisión de límites) y en este PC,
#              2 pares intercalados (W31_VUELTAS="3 4" = más, para la zona gris)
cd "$(dirname "$0")/.."
QUIEN="w31 (local_w31)"; source herramientas/candado.sh
WC=terceros/Wiicompiled-motor-w30
AU=terceros/aurora-w31
SAL=${W31_SAL:-build/web-w31}
FINAL=build/web-e6-w29-clip/navegador   # de donde salen las semillas de pipelines y bloques y las imágenes
DATOS=build/web/datos/w31
mkdir -p "$DATOS"
LIMITES="--js-flags=--wasm-enforce-bounds-checks"
GAMA_BAJA="&lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15"
# dibujarSiempre (§217): se dibuja cada cuadro aunque la compensación de lag de RR quiera saltarse; n8=0: sin N8
EXTRA="&dibujarSiempre=1&n8=0${W31_EXTRA}"
export MKW_VENTANA=${MKW_VENTANA:--1880,549}

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
falla() { echo; echo "✗ ALTO: $1"; [ -n "$2" ] && grep -m6 -A3 'error:' "$2" | head -24; exit 1; }

compilar() {
  tomar "w31 compilar"
  paso "el navegador (W30 + aurora-w31) → $SAL/navegador"
  local log=$DATOS/compilar-navegador.log
  MKW_WIICOMPILED=$WC MKW_AURORA=$AU MKW_CFLAGS_EXTRA="-DMKW_MOTOR_W30=7" \
    timeout 7200 python herramientas/compilar-web.py --fija --modo navegador --carpeta $SAL > "$log" 2>&1 &
  local pid=$!
  while kill -0 $pid 2>/dev/null; do   # con el primer «error:» corta SOLO ese proceso (su número, nunca por nombre)
    if grep -q 'error:' "$log" 2>/dev/null; then
      local wp=$(cat /proc/$pid/winpid 2>/dev/null)
      [ -n "$wp" ] && taskkill //PID $wp //T //F > /dev/null 2>&1
      kill $pid 2>/dev/null; wait $pid 2>/dev/null
      falla "no compiló ($log)" "$log"
    fi
    sleep 2
  done
  wait $pid || falla "compilar-web.py falló ($log)" "$log"
  for f in pipelines.bin bloques.json; do cp -f $FINAL/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $FINAL/imagenes ] && cp -rf $FINAL/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
  ls -la $SAL/navegador/mkw.wasm
}

tramo() {   # $1 etiqueta, $2 modo w31, $3 lastre, $4 banderas de Chrome
  local chrome=(); [ -n "$4" ] && chrome=(--chrome "$4")
  MKW_BUILD=$SAL/navegador timeout 1200 node herramientas/medir-sitio.mjs --perfil pc --sola --piloto --segundos 5 \
    --ventana --piloto-espera 600 --nucleos 8 --puerto 8183 --etiqueta "$1" "${chrome[@]}" \
    --extra "&modo=directa&pista=0.0&semilla=1234&soloCpu=1&cpu=maximo&sinTope=1&tramo=600-2400&w31=$2$3$EXTRA" \
    > $DATOS/$1.txt 2>&1
  echo "$1: $(grep -o 'tramo (§163).*' $DATOS/$1.txt | head -1 | cut -c1-260)"
  grep -o 'w31 (§259).*' $DATOS/$1.txt | head -1
}

contar() {
  tomar "w31 contar"
  paso "el reparto de las listas: este PC y la gama baja, ?w31=contar"
  tramo w31-pc-contar contar "" ""
  tramo w31-baja-contar contar "$GAMA_BAJA" "$LIMITES"
}

chrome() {
  tomar "w31 chrome"
  for v in ${W31_VUELTAS:-1 2}; do   # regla del dueño (2026-11-02): 2 pares; más solo en la zona gris (−2 a +8 %)
    paso "vuelta $v: la gama baja (con la revisión de límites) y este PC; 0, todas, quietos"
    if [ $((v % 2)) = 1 ]; then orden="0 todas quietos"; else orden="quietos todas 0"; fi
    for m in $orden; do tramo w31-baja-$m-$v $m "$GAMA_BAJA" "$LIMITES"; done
    for m in $orden; do tramo w31-pc-$m-$v $m "" ""; done
    candado_hueco "sigue"; tomar "w31 chrome"
  done
}

[ $# -eq 0 ] && { sed -n 2,22p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; contar) contar ;; chrome) chrome ;;
    *) sed -n 2,22p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
exit 0
