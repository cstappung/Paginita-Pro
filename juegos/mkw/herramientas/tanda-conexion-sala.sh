#!/bin/bash
# Las carreras de §236 en Chrome. Se guardan los ✓/✗ y los registros por modo, bajo el candado de la sala.
set -o pipefail
cd "$(dirname "$0")/.." || exit 1
QUIEN="sala-conexion (01a1ad1f-8321-7a22-8d20-b1f6a7192c43)"
source herramientas/candado.sh
candado_tomar "§236: host / Cloudflare / Oracle" || exit 1
trap candado_soltar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export MKW_VENTANA=-1880,549
datos="build/web/datos/conexion-sala/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$datos"
fallo=0
[ "$#" -gt 0 ] || set -- host cloudflare oracle oracle-sin-servidor
for modo in "$@"; do
  extra=()
  case "$modo" in
    host) ;;
    cloudflare|oracle|oracle-sin-servidor) extra+=("--$modo");;
    *) echo "Modo desconocido: $modo"; exit 2;;
  esac
  echo "== $modo ($datos) =="
  node web/navegador/prueba-sincro.mjs --directa "${extra[@]}" --datos="$datos/$modo" 2>&1 | tee "$datos/$modo.log" || fallo=1
done
exit "$fallo"
