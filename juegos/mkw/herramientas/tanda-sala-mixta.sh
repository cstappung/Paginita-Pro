#!/bin/bash
# La tanda del simulador de sala mixta (bitácora §281), con el candado de medición de siempre (herramientas/candado.sh).
#
# Resumen: para cada escenario pedido corre herramientas/sala-mixta.mjs (2 a 6 jugadores en este PC, cada uno con su
# propio Chrome, su CPU, su red, sus gráficos y sus tirones, todo con semilla) en las variantes pedidas:
#   lockstep    la sala de siempre (el lockstep con el árbitro) con el programa de la sala de hoy: build/web-final-269b
#   estado      «Cada uno su kart» (?red=estado, §275b) con su programa: build/web-275
#   y la conexión: host (lo de siempre) o cloudflare (todo por el repetidor TURN de mentira de este PC, turn-local.mjs)
# Entre escenario y escenario, candado_hueco (cede el turno si otra sesión lo pidió o si hay fila y ya van 45 min).
# Todo a build/web/datos/sala-mixta/<fecha>/ (los .json, el informe .md de cada uno, los registros y resumen.md, la tabla).
# Ojo: busca fallas de sincronía y de ritmo, NO mide rendimiento (con 6 juegos en un PC cada uno va más lento).
# Como el ensayo de un tablero con cargas distintas: la misma secuencia de fallas cada vez, y la planilla al final.
#
# Uso:  bash herramientas/tanda-sala-mixta.sh <escenarios…>          (todos: «todos»; la lista: node herramientas/sala-mixta.mjs --lista)
#       VARIANTES="lockstep estado lockstep:cloudflare"  (por omisión «lockstep estado»)
#       SIN_CANDADO=1 = quien llama ya tiene el candado (no lo toma ni lo suelta; candado_hueco sigue cediendo)
#       SEMILLA=1 SEGUNDOS=60 EXTRA="&param=…"  BUILD_LOCKSTEP=… BUILD_ESTADO=…  DATOS=carpeta (para seguir en la misma)
# Ejemplo: VARIANTES="lockstep" bash herramientas/tanda-sala-mixta.sh parejos tormenta
cd "$(dirname "$0")/.." || exit 1
QUIEN="sim-sala-mixta (local_5a1a0281)"; source herramientas/candado.sh
export MKW_VENTANA=${MKW_VENTANA:--1880,549}
BUILD_LOCKSTEP=${BUILD_LOCKSTEP:-build/web-final-269b/navegador}
BUILD_ESTADO=${BUILD_ESTADO:-build/web-275/navegador}
VARIANTES=${VARIANTES:-lockstep estado}
DATOS=${DATOS:-build/web/datos/sala-mixta/$(date '+%Y-%m-%d-%H-%M')}
mkdir -p "$DATOS"
ESC="$*"; [ "$ESC" = "todos" ] || [ -z "$ESC" ] && ESC="parejos uno-lento uno-lejos mezcla-graficos telefono-imaginario tormenta se-va-y-vuelve seis-mixtos seis-iguales"
# (con SIN_CANDADO, desde cuándo tengo el turno = la hora del candado: así candado_hueco cede pasados los 45 min)
if [ -n "$SIN_CANDADO" ]; then CANDADO_DESDE=$(stat -c %Y "$CANDADO" 2>/dev/null || date +%s); else candado_tomar "sala-mixta $ESC"; fi
for e in $ESC; do
  for v in $VARIANTES; do
    modo=${v%%:*}; con=host; [[ "$v" == *:* ]] && con=${v#*:}
    [ "$modo" = estado ] && b=$BUILD_ESTADO || b=$BUILD_LOCKSTEP
    echo "== $e $modo $con $(date '+%H:%M:%S') ($b)"
    MKW_BUILD=$b node herramientas/sala-mixta.mjs --escenario "$e" --modo "$modo" --conexion "$con" --semilla "${SEMILLA:-1}" \
      --segundos "${SEGUNDOS:-60}" --datos "$DATOS" ${EXTRA:+--extra "$EXTRA"} > "$DATOS/$e-$modo-$con.out" 2>&1
    echo "   salió $? $(date '+%H:%M:%S')"; grep -E '^[✓✗·]' "$DATOS/$e-$modo-$con.out" | cut -c1-200
    candado_hueco
  done
done
[ -n "$SIN_CANDADO" ] || candado_soltar
echo; cat "$DATOS/resumen.md"
