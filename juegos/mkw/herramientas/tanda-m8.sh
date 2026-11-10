#!/bin/bash
# M8 del paso 6 (bitácora §178): ¿cuánto cuestan las recargas de r14-r31 después de cada llamada del código traducido?
# Primero el TECHO: una traducción a propósito insegura (MKW_M8=techo en el traductor de terceros/Wiicompiled-motor-m8)
# que no recarga r14-r31 nunca después de una llamada. Si ni así gana algo que valga la pena, M8 no se hace; si gana,
# se hace la versión segura (solo donde el programa entero respeta la regla de la Wii).
# Medido (§178): techo se congela; ind ×0,99; seguro (MKW_M8=seguro con MKW_M8_EXCLUIR=$(cat build/web/datos/m8/excluir-os-rr.txt))
# saca el 47 % de las lecturas y da ×1,00: no se adopta. MKW_M8=vigia = anota quién rompe r14-r31 (MKW_M8_VIGIA=1 = solo
# donde el modo elegido sacaría la lectura).
# Las hojas en línea (§183): M8_WC=terceros/Wiicompiled-motor-hojas M8_BASE=build/web-m1 M8=hojas M8_NOMBRE=hojas-X y
# MKW_HOJAS_INSTR / _CRECE / _MINIMO / _BLOQUES / _ACICLICOS (los límites; sin ellas, los de siempre: 56, 50 %, 48, 4, 8).
# Cada fase toma build/medicion.lock (herramientas/candado.sh) y lo suelta al terminar (entre fases, candado_hueco: cede si otra pide un hueco
# o si llevo 45 min con otras en la fila, §180).
# Uso:  bash herramientas/tanda-m8.sh <fase> [<fase> …]
#   traducir = compila el traductor de la copia m8 y traduce con MKW_M8=$M8 (techo por omisión)
#   compilar = el programa de Node de esa traducción (build/web-m8$M8/node)
#   probar   = prueba-arranque con ese programa (¿arranca y llega a la carrera?)
#   medir    = el tramo fijo en Node, v0.9.3 (build/web-motor/node) contra el de M8, intercalados (6 vueltas)
cd "$(dirname "$0")/.."
YO="paso6-M8-${M8_NOMBRE:-${M8:-techo}} (local_cbaf17f0)"   # con la variante: si no, otra tanda mía «ya tenía» el candado
M8=${M8:-techo}
WCM8=${M8_WC:-terceros/Wiicompiled-motor-m8}   # M8_WC = otra copia (p. ej. Wiicompiled-motor-hojas, sobre M1)
BASE=${M8_BASE:-build/web-motor}             # contra qué se compara (M8_BASE=build/web-m1 = sobre M1 ya adoptado)
SAL=build/web-m8${M8_NOMBRE:-$M8}   # M8_NOMBRE = otra carpeta para una variante (p. ej. con MKW_M8_EXCLUIR)
DATOS=build/web/datos/m8
mkdir -p "$DATOS"

# el candado común (§176, herramientas/candado.sh): tomarlo con noclobber, soltarlo solo si es mío
QUIEN="$YO"; source herramientas/candado.sh
# M8_SEGUIDO=1 = las fases seguidas con un solo turno (para un hueco corto pedido a la otra sesión: traducir+compilar+probar)
# al tomar el turno se borra el pedido de hueco propio (build/medicion.hueco con mi local_…): si queda, la otra sesión espera
tomar() {   # si ya es mío (retenido entre fases), solo anoto la fase; si no, saco número en la fila (§180)
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi   # 6 h: la fila de tres sesiones pasó de 90 min
  grep -qF "local_cbaf17f0" "$HUECO" 2>/dev/null && rm -f "$HUECO"; return 0
}
soltar() { candado_soltar; }
trap soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

traducir() {
  tomar "traducir m8 $M8"
  paso "el traductor de la copia m8 y la traducción con MKW_M8=$M8"
  DOTNET_ROLL_FORWARD=Major DOTNET_CLI_TELEMETRY_OPTOUT=1 timeout 900 dotnet build -c Release -v q \
    $WCM8/translator/src/Translator.Cli/Translator.Cli.csproj > $DATOS/traductor-$M8.log 2>&1 || { tail -20 $DATOS/traductor-$M8.log; exit 1; }
  local payload="$(pwd -W 2>/dev/null || pwd)/build/rr_wfc_payload-n15.bin"
  MKW_M8=$M8 MKW_WIICOMPILED="$(echo "$WCM8" | tr / '\\')" MKW_RR_PAYLOAD="$payload" timeout 2400 powershell -NoProfile \
    -ExecutionPolicy Bypass -File herramientas/traducir.ps1 > $DATOS/traducir-$M8.log 2>&1
  echo "traducir: salida $?"; tail -3 $DATOS/traducir-$M8.log
  grep -h "Leaf inlining" $DATOS/traducir-$M8.log | tail -1   # cuántas llamadas quedaron metidas en línea (hojas)
  # cuántas recargas de r14-r31 quedaron, contra la v0.9.3 (las líneas «r14 = ctx->gpr[14];» … del C++ generado)
  for c in terceros/Wiicompiled-motor $WCM8; do
    echo "$c: $(cat $c/generated/build_shards/*/*.cpp | grep -cE '^\s*r(1[4-9]|2[0-9]|3[01]) = ctx->gpr\[') recargas de r14-r31"
  done
}

compilar() {
  tomar "compilar m8 $M8"
  paso "el programa de Node de la traducción M8=$M8 → $SAL/node"
  MKW_WIICOMPILED=$WCM8 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 5400 \
    python herramientas/compilar-web.py --carpeta $SAL > $DATOS/compilar-$M8.log 2>&1
  echo "compilar: salida $?"; tail -2 $DATOS/compilar-$M8.log
}

probar() {
  tomar "probar m8 $M8"
  paso "prueba-arranque con $SAL/node, y una corrida entera que tiene que llegar a la carrera"
  MKW_BUILD_NODE=$SAL/node timeout 900 node web/node/prueba-arranque.mjs
  # prueba-arranque pasó 13/13 con un techo que se quedaba trabado en el arranque (solo mira 600 cuadros): la corrida
  # del tramo (partida limpia, el guion hasta la carrera) es la prueba de verdad; si no llega, corta la tanda
  MKW_BUILD_NODE=$SAL/node timeout 900 node herramientas/medir-node-estable.mjs --corridas 1 --etiqueta m8-${M8_NOMBRE:-$M8}-prueba || exit 1
}

medir() {
  tomar "medir m8 $M8"
  paso "tramo fijo en Node: $BASE contra M8=$M8, intercalados (6 vueltas)"
  timeout 7200 node herramientas/medir-node-estable.mjs --fijo --corridas 6 --tope-min 12 --etiqueta m8-${M8_NOMBRE:-$M8} \
    --intercalar antes=$BASE/node,despues=$SAL/node
}

[ $# -eq 0 ] && { sed -n 2,12p "$0"; exit 1; }
n_fase=0
for fase in "$@"; do
  n_fase=$((n_fase+1))
  case "$fase" in
    traducir) traducir ;;
    compilar) compilar ;;
    probar) probar ;;
    medir) medir ;;
    *) sed -n 2,12p "$0"; exit 1 ;;
  esac
  # entre fases (§180): sigo con el candado salvo que otra sesión pida un hueco o yo lleve más de 45 min con fila
  if [ $n_fase -lt $# ]; then candado_hueco "sigue"; fi
done
