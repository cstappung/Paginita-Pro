#!/usr/bin/env bash
# La tanda de §270: el ritmo parejo en los menús. Toma el candado de medición (herramientas/candado.sh) toda la fase.
# Uso:  bash herramientas/tanda-270.sh <fase> …
#   medir   = medir-menus.mjs con ventana (monitor de MKW_VENTANA) en este PC, con las variantes de T270_VARIANTES
#   baja    = lo mismo en la gama baja simulada (§155 + la revisión de límites de Android, §194 W5)
# T270_ETIQUETA = el nombre de la tanda (antes / despues…), T270_FLUJOS = inicio,sala,sp
cd "$(dirname "$0")/.."
QUIEN="${QUIEN:-menus-270 (local_cb5459c6)}"; source herramientas/candado.sh
SAL=${T270_BUILD:-build/web-final-w30}; DATOS=build/web/datos/menus-270; mkdir -p $DATOS
ET=${T270_ETIQUETA:-antes}; FL=${T270_FLUJOS:-inicio,sala,sp}
BAJA="&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6"
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  medir)
    candado_tomar "270 medir $ET" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 3000 node herramientas/medir-menus.mjs --ventana --flujos $FL --json $DATOS/$ET-pc.json \
      ${T270_VARIANTES:-""} > $DATOS/$ET-pc.txt 2>&1
    echo "== medir $ET pc: salida $?"; grep -v "^\[" $DATOS/$ET-pc.txt | cut -c1-330
    candado_soltar ;;
  baja)
    candado_tomar "270 baja $ET" 21600 || exit 1
    V=(); for v in ${T270_VARIANTES:-""}; do V+=("$BAJA$v"); done; [ ${#V[@]} -eq 0 ] && V=("$BAJA")
    MKW_BUILD=$SAL/navegador timeout 3600 node herramientas/medir-menus.mjs --ventana --flujos $FL --json $DATOS/$ET-baja.json \
      --chrome "--js-flags=--wasm-enforce-bounds-checks" "${V[@]}" > $DATOS/$ET-baja.txt 2>&1
    echo "== medir $ET baja: salida $?"; grep -v "^\[" $DATOS/$ET-baja.txt | cut -c1-330
    candado_soltar ;;
  personaje)
    # por qué elegir personaje va más lento que la carrera: CPU y tarjeta por cuadro, pasadas caras (medir-personaje.mjs)
    candado_tomar "270 personaje $ET" 21600 || exit 1
    MKW_BUILD=$SAL/navegador timeout 1800 node herramientas/medir-personaje.mjs --ventana $T270_EXTRA > $DATOS/$ET-personaje-pc.txt 2>&1
    echo "== personaje pc: salida $?"; grep -v "^\[" $DATOS/$ET-personaje-pc.txt | cut -c1-400
    MKW_BUILD=$SAL/navegador timeout 2400 node herramientas/medir-personaje.mjs --ventana --chrome "--js-flags=--wasm-enforce-bounds-checks" "$BAJA$T270_EXTRA" > $DATOS/$ET-personaje-baja.txt 2>&1
    echo "== personaje baja: salida $?"; grep -v "^\[" $DATOS/$ET-personaje-baja.txt | cut -c1-400
    candado_soltar ;;
  n8)
    # N8 en elegir personaje (el programa de build/web-270): sin N8 en los menús / «30 parejas» / la intermedia, PC y gama baja
    candado_tomar "270 n8" 21600 || exit 1
    for perfil in ${T270_PERFILES:-pc baja}; do for v in ${T270_N8:-&n8=1&n8Menus=0 &n8=1 &n8=2}; do
      X="$v"; CH=""; [ $perfil = baja ] && { X="$BAJA$v"; CH="--js-flags=--wasm-enforce-bounds-checks"; }
      MKW_BUILD=build/web-270/navegador timeout 1200 node herramientas/medir-personaje.mjs --ventana --lugares personaje,sala-personaje \
        ${CH:+--chrome "$CH"} "$X" 2>&1 | grep -v "^\[" | grep "^==" | sed "s|^|$perfil $v |" | tee -a $DATOS/$ET-n8.txt | cut -c1-260
    done; done
    candado_soltar ;;
  compilar)
    # el programa con N8 en elegir personaje (n8_nativo.cpp, mkw_n8_menus) → build/web-270: como el final (W30, PGO),
    # con las semillas de build/web-final-w30. El wasm cambia: el dueño lo sube a R2
    candado_tomar "270 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor-w30 MKW_AURORA=terceros/aurora-main-viejo-motor timeout 21600       python herramientas/compilar-web.py --modo navegador --final --carpeta build/web-270 > $DATOS/compilar.log 2>&1
    s=$?; echo "compilar: salida $s"; tail -2 $DATOS/compilar.log; [ $s = 0 ] || { grep -m5 "error" $DATOS/compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f build/web-final-w30/navegador/$f build/web-270/navegador/; done
    [ -d build/web-final-w30/navegador/imagenes ] && cp -rf build/web-final-w30/navegador/imagenes build/web-270/navegador/
    node herramientas/comprimir-build.mjs build/web-270/navegador > $DATOS/comprimir.log 2>&1; echo "comprimir $?"
    candado_soltar ;;
  *) echo "fase desconocida: $fase"; exit 1 ;;
esac; done
