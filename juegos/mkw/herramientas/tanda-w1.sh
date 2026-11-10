#!/bin/bash
# W1 de la etapa 0 del plan v4 (bitácora §196): M0, ¿el dibujo es un sumidero? y las páginas que ensucia la carrera.
#
# Resumen: un programa aparte (MKW_SUMIDERO_COMPILAR=1, web/juego/sumidero_nativo.cpp) saca una foto de la memoria de la
# Wii antes y después del dibujo de cada cuadro. En la sala de dos (prueba-sincro --directa: 2 humanos + 10 CPU = 12),
# A cuenta (?sumidero=1) y B además deshace lo que escribió el dibujo (?sumidero=2): si las huellas de las dos dan
# igual, la carrera no leyó nada del dibujo. En la Contrarreloj (prueba-fantasma-igual, fuera de la sala: sin los
# arreglos de la sala) lo mismo con el fantasma, cuadro por cuadro.
# Cada fase toma build/medicion.lock (herramientas/candado.sh); entre fases, candado_hueco.
# Uso:  bash herramientas/tanda-w1.sh compilar sala fantasma
#   compilar = el programa del navegador con el instrumento → build/web-w1 (sobre terceros/Wiicompiled-motor, con W19)
#   sala     = 6 pistas (2 de Nintendo y 4 de Retro Rewind), semilla 1234
#   fantasma = la Contrarreloj contra el experto en 2 pistas, A normal y B deshaciendo el dibujo
cd "$(dirname "$0")/.."
QUIEN="e0-w1 (local_f84b9b29)"; source herramientas/candado.sh
SAL=${W1_SAL:-build/web-w1}
SEMILLAS=${W1_SEMILLAS:-build/web-w19}      # de dónde salen pipelines.bin, bloques.json e imágenes
DATOS=build/web/datos/w1
PISTAS=${W1_PISTAS:-"0.0 2.1 13.2 30.2 50.2 65.0"}
mkdir -p "$DATOS"

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

compilar() {
  tomar "w1 compilar"
  paso "el programa del navegador con el instrumento del sumidero → $SAL/navegador"
  MKW_SUMIDERO_COMPILAR=1 MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor \
    timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar.log
  for f in pipelines.bin bloques.json; do cp -f $SEMILLAS/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $SEMILLAS/navegador/imagenes ] && cp -rf $SEMILLAS/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

sala() {
  tomar "w1 sala"
  for p in $PISTAS; do
    paso "la sala en la pista $p: A cuenta, B deshace el dibujo"
    MKW_BUILD=$SAL/navegador timeout 2400 node web/navegador/prueba-sincro.mjs --directa --puerto=8178 \
      --datos=$DATOS/sala-$p --pistas=$p --semilla=1234 --extra-a=\&sumidero=1 --extra-b=\&sumidero=2 \
      > $DATOS/sala-$p.txt 2>&1
    echo "salida $?"; grep -E "sumidero|huellas|bien, " $DATOS/sala-$p.txt
  done
}

fantasma() {
  tomar "w1 fantasma"
  for cf in "0 0" "13 2"; do
    set -- $cf
    paso "la Contrarreloj copa $1 fila $2: A normal, B deshace el dibujo"
    MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-fantasma-igual.mjs --build-b=$SAL/navegador \
      --copa $1 --fila $2 --puerto 8178 --extra-a=\&sumidero=1 --extra-b=\&sumidero=2 > $DATOS/fantasma-$1-$2.txt 2>&1
    echo "salida $?"; tail -8 $DATOS/fantasma-$1-$2.txt
  done
}

[ $# -eq 0 ] && { sed -n 2,14p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; sala) sala ;; fantasma) fantasma ;;
    *) sed -n 2,14p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
