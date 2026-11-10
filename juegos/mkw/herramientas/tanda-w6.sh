#!/bin/bash
# W6 de la etapa 0 del plan v4 (bitácora §197): dos medidas del programa nativo EN LA CARRERA.
#
# Resumen: el programa de Windows (compilar-nativo.py, solo para medir: nunca se entrega) corre el mismo juego sin el
# impuesto de wasm. Se le agregan, de a una, dos trabas que wasm sí tiene:
#   (1) --bytes-lentos: dar vuelta los bytes sin la instrucción bswap (como wasm): la diferencia es lo que cuesta eso;
#   (2) --revisado: la memoria de la Wii siempre por la tabla de páginas (como wasm): lo que cuesta la tabla.
# Los tres programas (normal, (1), (2)) corren el mismo tramo fijo de la carrera (el guion de botones de §165/§170,
# cuadros de lógica 600-2400 desde la cuenta) 5 vueltas intercaladas, con prioridad alta y 4 núcleos (--fijo).
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w6.sh compilar medir
#   compilar = build/nativo-v093-e0 (normal), -e0-bl (bytes lentos), -e0-rev (revisado), con terceros/Wiicompiled-motor
#              (la base de la etapa 0: M1 + W19) y los datos de build/web-w19/node/gen
#   medir    = 5 vueltas, el orden rota cada vuelta
cd "$(dirname "$0")/.."
QUIEN="e0-w6 (local_f84b9b29)"; source herramientas/candado.sh
GEN=${W6_GEN:-build/web-w19/node/gen}
DATOS=build/web/datos/w6
VUELTAS=${W6_VUELTAS:-5}
mkdir -p "$DATOS"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
nativo() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor \
  timeout 5400 python herramientas/compilar-nativo.py --gen $GEN "$@"; }

compilar() {
  tomar "w6 compilar"
  paso "el nativo normal → build/nativo-v093-e0"
  nativo --carpeta build/nativo-v093-e0 > $DATOS/compilar-normal.log 2>&1; echo "salida $?"; tail -1 $DATOS/compilar-normal.log
  paso "el nativo con los bytes dados vuelta como wasm → build/nativo-v093-e0-bl"
  nativo --bytes-lentos --carpeta build/nativo-v093-e0-bl > $DATOS/compilar-bl.log 2>&1; echo "salida $?"; tail -1 $DATOS/compilar-bl.log
  paso "el nativo con la memoria revisada → build/nativo-v093-e0-rev"
  nativo --revisado --carpeta build/nativo-v093-e0-rev > $DATOS/compilar-rev.log 2>&1; echo "salida $?"; tail -1 $DATOS/compilar-rev.log
  ls -la build/nativo-v093-e0*/mkw-nativo.exe
}

una() {   # $1 = nombre del nativo (build/nativo-<nombre>), $2 = etiqueta
  timeout 1200 node herramientas/medir-node-estable.mjs --fijo --corridas 1 --tope-min 15 --nativo $1 --etiqueta $2 \
    > $DATOS/$2.txt 2>&1
  echo "$2: $(grep -o 'trabajo [0-9.]* ms/cuadro' $DATOS/$2.txt | head -1)"
}

medir() {
  tomar "w6 medir"
  local orden=(v093-e0 v093-e0-bl v093-e0-rev)
  for v in $(seq 1 $VUELTAS); do
    paso "vuelta $v"
    for k in 0 1 2; do
      local n=${orden[$(( (k + v) % 3 ))]}
      una $n w6-${n#v093-}-$v
    done
  done
}

[ $# -eq 0 ] && { sed -n 2,16p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; medir) medir ;;
    *) sed -n 2,16p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
