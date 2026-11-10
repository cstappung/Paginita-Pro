#!/bin/bash
# W10 juntado sobre E2 (bitácora §220): la rama e2-w10 (terceros/Wiicompiled-motor-h6, parches/motor-e2-w10.diff).
#
# Resumen, en orden y sin recortar nada:
#   1) el programa final (--final: H6 + el ThinLTO de M7) con W10 apagado → build/web-e2w10; arranque, la sala contra
#      build/web-e2 (las huellas toda la carrera) y los fantasmas cuadro por cuadro (tanda-h6.sh compilar probar igual);
#   2) el instrumento de W10 (MKW_W10_COMPILAR=1 + --fija) → build/web-e2w10i y una carrera con ?w10=4: «sin marca» = las
#      páginas que alguien escribió sin marcar (tienen que ser 0) (tanda-w10.sh compilar comprobar);
#   3) la foto igual: A = el final con W10 apagado, B = el instrumento con la marca prendida, dibujando (servidor.mjs
#      con MKW_BUILD_B y &build=b), cuadros 600, 1500 y 2400 de la Contrarreloj contra el experto, sin la cortina
#      (&cortina=0: el instrumento es más lento y la cortina de la página seguía encima del lienzo en el cuadro 600).
# Las tres partes toman el candado cada una (herramientas/candado.sh), en fila normal.
# Uso:  bash herramientas/tanda-e2w10.sh [final] [marca] [foto]
cd "$(dirname "$0")/.."
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
for fase in "${@:-final marca foto}"; do for f in $fase; do
  case "$f" in
    final) H6_SAL=build/web-e2w10 H6_BASE=build/web-e2 H6_ARGS="--final" bash herramientas/tanda-h6.sh compilar probar igual || exit 1 ;;
    marca) W10_WC=terceros/Wiicompiled-motor-h6 W10_ARGS="--fija" W10_SAL=build/web-e2w10i W10_BASE=build/web-e2 \
             bash herramientas/tanda-w10.sh compilar comprobar || exit 1 ;;
    foto)
      QUIEN="e2-motor (local_e2e2)"; source herramientas/candado.sh
      candado_tomar "e2w10 foto" ${CANDADO_ESPERA:-21600} || exit 1
      echo; echo "=== $(date '+%H:%M:%S') la foto igual: A = W10 apagado (build/web-e2w10), B = la marca prendida (build/web-e2w10i)"
      MKW_BUILD=build/web-e2w10/navegador MKW_BUILD_B=build/web-e2w10i/navegador timeout 1800 \
        node web/navegador/prueba-foto-igual.mjs --extra-a='&cortina=0' --extra-b='&cortina=0' --cuadros 600,1500,2400 --puerto 8178 2>&1 | tail -12
      candado_soltar ;;
    *) sed -n 2,14p "$0"; exit 1 ;;
  esac
done; done
exit 0
