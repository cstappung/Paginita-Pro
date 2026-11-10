#!/bin/bash
# W8 de la etapa 0 del plan v4 (bitácora §203): qué crece en la memoria de la tarjeta tras 8 pistas.
#
# Resumen: tanda-w7.sh (fase w8) midió que el proceso de la tarjeta de video de Chrome crece ~+1 GB de la pista 1 a la
# 8 (la pestaña solo +97 MB). Para saber si son las texturas o los pipelines, esta tanda compila el programa del
# navegador con el contador de texturas de aurora (lib/gfx/texture.hpp: cuántas viven y sus MB, mkw_web_texturas_dato)
# y repite la medición de las 8 pistas. Cada fase toma build/medicion.lock (herramientas/candado.sh).
# Uso:  bash herramientas/tanda-w8.sh compilar medir probar
#   compilar = el navegador con el contador → build/web-w8 (semillas e imágenes de build/web-w19)
#   medir    = medir-memoria-pistas.mjs, 8 pistas, con el contador; y otra vez soltando los pipelines (?soltarPipelines=1)
#   probar   = prueba-navegador y prueba-sala --rapida con ?soltarPipelines=1
cd "$(dirname "$0")/.."
QUIEN="e0-w8 (local_f84b9b29)"; source herramientas/candado.sh
BASE=build/web-w19
SAL=${W8_SAL:-build/web-w8}
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
  tomar "w8 compilar"
  paso "el programa del navegador con el contador de texturas → $SAL/navegador"
  motor timeout 5400 python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/compilar-navegador.log 2>&1
  echo "navegador: salida $?"; tail -2 $DATOS/compilar-navegador.log
  for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
  [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
  node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
}

medir() {
  tomar "w8 medir"
  paso "8 pistas en la misma pestaña, con el contador de texturas"
  MKW_BUILD=$SAL/navegador timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta w8-texturas \
    --extra "&piscina=0" 2>&1 | tee $DATOS/w8-texturas.txt | grep -E "^pista|^de la|✗"
  paso "lo mismo soltando los pipelines de las otras pistas (?soltarPipelines=1)"
  MKW_BUILD=$SAL/navegador timeout 3600 node herramientas/medir-memoria-pistas.mjs --puerto $PUERTO --etiqueta w8-soltar \
    --extra "&piscina=0&soltarPipelines=1" 2>&1 | tee $DATOS/w8-soltar.txt | grep -E "^pista|^de la|✗"
  grep -h "W8: al entrar" $DATOS/w8-soltar.txt | head -10
}

probar() {
  tomar "w8 probar"
  paso "prueba-navegador con ?soltarPipelines=1"
  MKW_BUILD=$SAL/navegador timeout 1800 node web/navegador/prueba-navegador.mjs 1800 --puerto $PUERTO --datos $DATOS/nav \
    --extra "&soltarPipelines=1" > $DATOS/nav.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗" $DATOS/nav.txt | tail -6
  paso "prueba-sala con ?soltarPipelines=1 (la copa de 2 carreras: la 2.ª pista suelta la 1.ª)"
  MKW_BUILD=$SAL/navegador timeout 3600 node web/navegador/prueba-sala.mjs --rapida --puerto=8187 "--extra=&soltarPipelines=1" \
    > $DATOS/sala.txt 2>&1
  echo "salida $?"; grep -E "bien, |✗" $DATOS/sala.txt | tail -8
}

[ $# -eq 0 ] && { sed -n 2,10p "$0"; exit 1; }
n=0
for fase in "$@"; do
  n=$((n+1))
  case "$fase" in
    compilar) compilar ;; medir) medir ;; probar) probar ;;
    *) sed -n 2,10p "$0"; exit 1 ;;
  esac
  [ $n -lt $# ] && candado_hueco "sigue"
done
