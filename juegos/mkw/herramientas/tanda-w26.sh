#!/usr/bin/env bash
# W26 (§248): la memoria durante horas — ¿cuántas configuraciones de sombreador dan el mismo texto WGSL?
#   compilar = el programa con el censo de aurora (build/web-w26; semillas de build/web-w19)
#   censo    = 8 pistas en una pestaña (medir-memoria-pistas): sombreadores armados contra textos WGSL distintos
#   memoria  = las 8 pistas sin y con ?wgslCompartido=1 (y con ?soltarPipelines=2, la de W8): la tarjeta y lo que cuesta
#   acotado  = ?soltarPipelines=3 (W26: solo los sombreadores de lo soltado) contra 2 y la base, dos vueltas
# Uso: bash herramientas/tanda-w26.sh compilar censo memoria   → build/web/datos/memoria-pistas/w26-*.json y .txt
cd "$(dirname "$0")/.."
QUIEN="e7-w26 (local_cb5459c6)"; source herramientas/candado.sh
BASE=build/web-w19; SAL=${W26_SAL:-build/web-w26}; DATOS=build/web/datos/memoria-pistas; mkdir -p $DATOS
trap candado_soltar EXIT
for fase in "$@"; do case $fase in
  compilar)
    candado_tomar "w26 compilar" 21600 || exit 1
    MKW_WIICOMPILED=terceros/Wiicompiled-motor MKW_AURORA=terceros/aurora-main-viejo-motor timeout 7200 \
      python herramientas/compilar-web.py --modo navegador --carpeta $SAL > $DATOS/w26-compilar.log 2>&1
    sal=$?; echo "compilar: salida $sal"; tail -2 $DATOS/w26-compilar.log
    [ $sal = 0 ] || { grep -m3 "error" $DATOS/w26-compilar.log; exit 1; }
    for f in pipelines.bin bloques.json; do cp -f $BASE/navegador/$f $SAL/navegador/ 2>/dev/null; done
    [ -d $BASE/navegador/imagenes ] && cp -rf $BASE/navegador/imagenes $SAL/navegador/
    node herramientas/comprimir-build.mjs $SAL/navegador > /dev/null 2>&1 || true
    candado_soltar ;;
  censo|memoria|acotado|copa|guardar)
    candado_tomar "w26 $fase" 21600 || exit 1
    pistas=""; vars=("base:"); [ $fase = memoria ] && vars=("base:" "comp:&wgslCompartido=1" "soltar2:&soltarPipelines=2" "soltar2comp:&soltarPipelines=2&wgslCompartido=1")
    # acotado (§248): el modo 3 (solo los sombreadores de lo soltado) contra el 2 y la base, dos vueltas intercaladas
    [ $fase = acotado ] && vars=("soltar3-1:&soltarPipelines=3" "soltar3-2:&soltarPipelines=3")
    # copa (§248): las mismas 8 pistas dos veces en la pestaña (una copa larga): la 2.ª vuelta muestra lo que cuesta
    # volver a preparar lo soltado
    # guardar (§248): dos copas de 4, cada una dos veces (A B C D A B C D, E F G H E F G H): base, soltar todo (2) y el
    # conjunto acotado (2 con las últimas 4 pistas guardadas)
    [ $fase = guardar ] && vars=("base:" "soltar2:&soltarPipelines=2" "guardar4:&soltarPipelines=2&pistasGuardadas=4") && pistas="--pistas 0.0,1.1,2.2,5.3,0.0,1.1,2.2,5.3,13.2,30.2,50.2,65.0,13.2,30.2,50.2,65.0"
    [ $fase = copa ] && vars=("base:" "soltar3:&soltarPipelines=3" "soltar2:&soltarPipelines=2") && pistas="--pistas 0.0,1.1,2.2,5.3,13.2,30.2,50.2,65.0,0.0,1.1,2.2,5.3,13.2,30.2,50.2,65.0"
    for x in "${vars[@]}"; do n=${x%%:*}; e=${x#*:}
      MKW_BUILD=$SAL/navegador timeout 2400 node herramientas/medir-memoria-pistas.mjs $pistas --extra "$e" --etiqueta w26-$fase-$n > $DATOS/w26-$fase-$n.txt 2>&1
      echo "== $n: salida $?"; grep -E "^pista|creció|✗" $DATOS/w26-$fase-$n.txt | cut -c1-330
      candado_hueco "sigue"
    done
    candado_soltar ;;
esac; done
