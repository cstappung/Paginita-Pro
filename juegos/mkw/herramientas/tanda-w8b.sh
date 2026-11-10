#!/bin/bash
# W8, segunda pasada (bitácora §203): ¿son los sombreadores lo que crece en el proceso de la tarjeta?
#
# Resumen: tanda-w8.sh midió que soltar 413 pipelines de otras pistas (?soltarPipelines=1) NO baja el crecimiento del
# proceso de la tarjeta (+1132 MB contra +1142 MB guardándolos). Aurora guarda aparte cada sombreador compilado
# (sShaderModuleCache de lib/gx/pipeline.cpp) y nunca lo suelta. Esta tanda compila el modo 2 (?soltarPipelines=2:
# además vacía esa memoria cada vez que se sueltan pipelines; se rearman al pedirlos) y repite las 8 pistas.
# Uso:  bash herramientas/tanda-w8b.sh compilar medir probar
#   compilar = el navegador con el modo 2 → build/web-w8b (semillas e imágenes de build/web-w19)
#   medir    = medir-memoria-pistas.mjs, 8 pistas, con ?soltarPipelines=2
#   probar   = prueba-navegador con ?soltarPipelines=2
cd "$(dirname "$0")/.."
QUIEN="e0-w8b (local_f84b9b29)"; source herramientas/candado.sh
BASE=build/web-w19
SAL=${W8_SAL:-build/web-w8b}
DATOS=build/web/datos/w8
mkdir -p "$DATOS"
PUERTO=8186

tomar() {
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }
motor() { MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor "$@"; }

compilar() {
  tomar "w8b compilar"
  paso "el programa del navegador con ?soltarPipelines=2 → $SAL/navegador"
  motor timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-w8b.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar-w8b.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

medir() {
  tomar "w8b medir"
  paso "8 pistas en la misma pestaña soltando pipelines y sombreadores (?soltarPipelines=2)"
  MKW_BUILD=$SAL/navegador timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta w8-sombreadores \
    --extra "&piscina=0&soltarPipelines=2" 2>&1 | tee $DATOS/w8-sombreadores.txt | grep -E "^pista|^de la|✗"
}

probar() {
  tomar "w8b probar"
  paso "prueba-navegador con ?soltarPipelines=2"
  MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto $PUERTO --datos $DATOS/nav2 \
    --extra "&soltarPipelines=2" > $DATOS/nav2.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗" $DATOS/nav2.txt | tail -6
}

[ $# -eq 0 ] && { sed -n 2,11p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; medir) medir ;; probar) probar ;;
    *) sed -n 2,11p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
