#!/bin/bash
# §248: la caída al salir de la pantalla de personajes (M22) y el cuelgue de la copa al pasar a la carrera 2.
#
# Resumen: G1 (§179.1, lockstep_nativo.cpp) guardaba la dirección de la lista de ClipInfo de la carrera y, en cada
# ScnMgr::DrawMain, le escribía las marcas; al terminar la carrera esa memoria se libera, pero el gancho seguía
# escribiendo en ella en los menús. El arreglo: la lista vale solo mientras vive el ClipInfoMgr que la armó.
#   compilar = el programa final con el arreglo (--final --memoria-fija 768, la línea H6, objetos y perfil PGO de
#              build/web-e6) → build/web-e6-w29-clip/navegador, con las semillas de web-e6
#   sala     = prueba-sala.mjs entera (sin --rapida: 46 puntos)
#   copa     = la copa al azar que se colgaba (prueba-sincro --copa, semilla 2658203969)
#   g1       = prueba-sincro --directa: G1 sigue recortando (dibujos con las marcas de verdad > 0) y las huellas iguales
# Uso:  bash herramientas/tanda-248.sh compilar sala copa g1
# Cada fase toma el candado de medición (herramientas/candado.sh), como una barra con enclavamiento.
cd "$(dirname "$0")/.."
QUIEN="caida-0x49 (local_9b0b1902)"; source herramientas/candado.sh
DATOS=build/web/datos/caida-248; mkdir -p $DATOS
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
E6=build/web-e6; FIN=${CLIP_BUILD:-build/web-e6-w29-clip}
tomar() {   # si ya lo tengo (otra fase de esta misma tanda), solo cambio la etiqueta
  if grep -qF "$QUIEN" "$CANDADO" 2>/dev/null; then echo "$QUIEN $(date '+%Y-%m-%d %H:%M') $1" > "$CANDADO"
  else candado_tomar "$1" ${CANDADO_ESPERA:-21600} || exit 1; fi
}
trap candado_soltar EXIT
paso() { echo; echo "=== $(date '+%H:%M:%S') $1"; }

compilar() {
  tomar "248 compilar"
  paso "el final con el arreglo → $FIN/navegador"
  MKW_WIICOMPILED=terceros/Wiicompiled-motor-h6 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 10800 \
    python herramientas/compilar-web.py --final --modo navegador --memoria-fija 768 --carpeta $E6 --salida $FIN/navegador \
    > $DATOS/compilar.log 2>&1
  echo "salida $?"; grep -E "con PGO|error:" $DATOS/compilar.log | cut -c1-160 | head -5; tail -2 $DATOS/compilar.log
  for f in pipelines.bin bloques.json; do cp -f $E6/navegador/$f $FIN/navegador/ 2>/dev/null; done
  [ -d $E6/navegador/imagenes ] && cp -rf $E6/navegador/imagenes $FIN/navegador/
  node herramientas/comprimir-build.mjs $FIN/navegador > /dev/null 2>&1 || true
  ls -la $FIN/navegador/mkw.wasm $FIN/navegador/mkw.wasm.br 2>/dev/null
}
sala() {
  tomar "248 sala"
  paso "prueba-sala entera con $FIN"
  MKW_BUILD=$FIN/navegador timeout 2400 node web/navegador/prueba-sala.mjs > $DATOS/sala.txt 2>&1
  echo "salida $?"; cp -f build/web/datos/sala/registro.txt $DATOS/sala-registro.txt 2>/dev/null
  grep -c "✓" $DATOS/sala.txt; grep "✗" $DATOS/sala.txt; tail -2 $DATOS/sala.txt
}
copa() {
  tomar "248 copa"
  paso "la copa al azar (1.0,40.1,50.3,52.2, semilla 2658203969) con $FIN"
  MKW_BUILD=$FIN/navegador timeout 3000 node web/navegador/prueba-sincro.mjs --copa --pistas=1.0,40.1,50.3,52.2 \
    --semilla=2658203969 --datos=$DATOS/copa > $DATOS/copa.txt 2>&1
  echo "salida $?"; grep -E "✓|✗" $DATOS/copa.txt | tail -30
}
g1() {
  tomar "248 g1"
  paso "G1 sigue recortando (prueba-sincro --directa) con $FIN"
  MKW_BUILD=$FIN/navegador timeout 1500 node web/navegador/prueba-sincro.mjs --directa --datos=$DATOS/g1 > $DATOS/g1.txt 2>&1
  echo "salida $?"; grep -E "✓|✗" $DATOS/g1.txt | tail -20
}

for f in "$@"; do $f; candado_hueco "sigue"; done
