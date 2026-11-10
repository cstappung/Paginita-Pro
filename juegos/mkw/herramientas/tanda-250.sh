#!/bin/bash
# §250, la largada pareja: las pruebas de la sala con el juego, antes (?largadaPareja=0) y después del arreglo.
#
# Resumen: el dueño vio que en la sala unos jugadores largaban antes que otros. Esta tanda corre las pruebas de la sala
# con dos, tres y cuatro pestañas, combinando la conexión (host / Cloudflare / Oracle / Oracle sin configurar), el
# árbitro (prendido, como viene, y &arbitro=0), la red mala en uno, la PC lenta, la traba al cargar la pista y la copa
# (carreras 1 y 2). Cada prueba compara el cuadro y la hora de la largada de cada consola (largada-pareja.mjs). Todo
# bajo el candado de medición (herramientas/candado.sh): hay otras sesiones midiendo.
#
# Uso:  bash herramientas/tanda-250.sh antes            (el camino de antes: la falla, reproducida)
#       bash herramientas/tanda-250.sh despues          (la matriz entera con el arreglo)
#       bash herramientas/tanda-250.sh caso NOMBRE…     (solo esos casos de la matriz; ver «casos» abajo)
# Los registros quedan en build/web/datos/largada-250/<fecha>/<caso>.log y un resumen en resumen.txt
cd "$(dirname "$0")/.." || exit 1
QUIEN="largada-250 (sesion hija de la largada pareja)"
source herramientas/candado.sh
export MKW_VENTANA=-1880,549
export MKW_BUILD=${MKW_BUILD:-build/web-e6-w29-clip/navegador}
datos="build/web/datos/largada-250/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$datos"

# nombre → comando (las de dos pestañas son prueba-sincro; sala = prueba-sala; relevo = 3; doce = 4)
declare -A CASO=(
  [s-host]="node web/navegador/prueba-sincro.mjs --directa"
  # (el caso que vio el dueño: B en un PC con muchísimo lag —red mala de ida y de vuelta— y además lento; A limpio)
  [s-lag]="node web/navegador/prueba-sincro.mjs --directa --lento --extra-b=&redMala=300,100,10,ida"
  [s-lag-sin-arbitro]="node web/navegador/prueba-sincro.mjs --directa --lento --extra-b=&redMala=300,100,10,ida --extra=&arbitro=0"
  # (con 600±200 ms de ida y otro tanto de vuelta, la hora del «¡YA!» de cada una se corre con la red: tope 400 ms)
  [s-lag-peor]="node web/navegador/prueba-sincro.mjs --directa --lento --largada-ms=400 --extra-b=&redMala=600,200,20,ida"
  [s-lag-peor-sin-arbitro]="node web/navegador/prueba-sincro.mjs --directa --lento --largada-ms=400 --extra-b=&redMala=600,200,20,ida --extra=&arbitro=0"
  # (el camino viejo de Cloudflare, para comparar lo que cuesta sincronizar)
  [s-cloudflare-viejo]="node web/navegador/prueba-sincro.mjs --directa --cloudflare --extra=&largadaPareja=0"
  [s-sin-oracle-viejo]="node web/navegador/prueba-sincro.mjs --directa --oracle-sin-servidor --extra=&largadaPareja=0"
  [s-traba]="node web/navegador/prueba-sincro.mjs --directa --traba-largada=6000"
  [s-traba-sin-arbitro]="node web/navegador/prueba-sincro.mjs --directa --traba-largada=6000 --extra=&arbitro=0"
  [s-sin-arbitro]="node web/navegador/prueba-sincro.mjs --directa --extra=&arbitro=0"
  [s-lento]="node web/navegador/prueba-sincro.mjs --directa --lento"
  [s-lento-sin-arbitro]="node web/navegador/prueba-sincro.mjs --directa --lento --extra=&arbitro=0"
  [s-redmala]="node web/navegador/prueba-sincro.mjs --directa --extra-b=&redMala=70,10,5"
  [s-cloudflare]="node web/navegador/prueba-sincro.mjs --directa --cloudflare"
  [s-oracle]="node web/navegador/prueba-sincro.mjs --directa --oracle"
  [s-oracle-traba]="node web/navegador/prueba-sincro.mjs --directa --oracle --traba-largada=6000"
  [s-sin-oracle]="node web/navegador/prueba-sincro.mjs --directa --oracle-sin-servidor"
  [s-copa]="node web/navegador/prueba-sincro.mjs --copa --minutos=30"
  [sala]="node web/navegador/prueba-sala.mjs --rapida"
  [relevo]="node web/navegador/prueba-relevo.mjs"
  [relevo-sin-arbitro]="node web/navegador/prueba-relevo.mjs --extra=&arbitro=0"
  [doce4]="node web/navegador/prueba-doce.mjs --n 4"
)
ANTES="s-lag s-lag-sin-arbitro s-lag-peor s-lag-peor-sin-arbitro s-traba s-traba-sin-arbitro s-oracle-traba s-host"
DESPUES="s-lag s-lag-sin-arbitro s-lag-peor s-lag-peor-sin-arbitro s-host s-traba s-traba-sin-arbitro s-sin-arbitro s-lento s-lento-sin-arbitro s-redmala s-cloudflare s-oracle s-oracle-traba s-sin-oracle relevo relevo-sin-arbitro doce4 sala s-copa"

modo=$1; shift
case "$modo" in
  antes) lista=$ANTES; extra="&largadaPareja=0"; export MKW_ARBITRO_LARGADA_PAREJA=0;;   # (y el servidor de Oracle, como antes)
  despues) lista=$DESPUES; extra="";;
  caso) lista="$*"; extra="${MKW_250_EXTRA:-}";;
  *) echo "uso: $0 antes|despues|caso NOMBRE…"; exit 2;;
esac

candado_tomar "§250 largada pareja: $modo" "${CANDADO_ESPERA:-21600}" || exit 1
trap candado_soltar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for c in $lista; do
  cmd=${CASO[$c]}
  [ -n "$cmd" ] || { echo "caso desconocido: $c"; continue; }
  # (el &largadaPareja=0 de «antes» va a todas las pestañas: se suma al --extra del caso o se agrega uno)
  if [ -n "$extra" ]; then
    # (sin ${cmd/…/…}: en bash 5.2 un & en el reemplazo se vuelve el texto encontrado y rompía el &largadaPareja=0)
    if [[ "$cmd" == *"--extra="* ]]; then cmd="${cmd%%--extra=*}--extra=$extra${cmd#*--extra=}"
    elif [[ "$cmd" == *prueba-doce* ]]; then cmd="$cmd --extra $extra"
    else cmd="$cmd --extra=$extra"; fi
  fi
  echo "== $c: $cmd" | tee -a "$datos/resumen.txt"
  t0=$(date +%s)
  $cmd --datos="$datos/$c" > "$datos/$c.log" 2>&1
  r=$?
  { grep -E "^[✓✗]|bien, .* mal|§250" "$datos/$c.log" | grep -E "✗|§250|bien, " ; echo "   (salida $r, $(( $(date +%s) - t0 )) s)"; } | tee -a "$datos/resumen.txt"
  candado_hueco
done
echo "listo: $datos"
