#!/bin/bash
# §170, #358 («faster deterministic translation»): ¿el traductor v0.9.3 da siempre el mismo C++, y cuánto tarda contra
# el viejo? Toma build/medicion.lock (traducir usa todos los núcleos), y:
#   1. retraduce la copia v0.9.3 (terceros/Wiicompiled-motor) y compara las huellas SHA-256 de los 378 archivos con las
#      de la primera traducción (build/n15-huellas-traduccion-1.txt): iguales = determinista;
#   2. traduce con el traductor viejo (bd219e3) en una copia propia y descartable (terceros/Wiicompiled-trad-viejo, se
#      borra al final; terceros/Wiicompiled no se toca) solo para tomar su tiempo, dos veces, y compara sus huellas.
# Uso:  bash herramientas/tanda-170-traduccion.sh      → build/web/datos/n15/traduccion.txt
cd "$(dirname "$0")/.."
YO="paso6-N15 (local_cbaf17f0)"
SAL=build/web/datos/n15/traduccion.txt
mkdir -p build/web/datos/n15
: > "$SAL"
# MKW_CANDADO_TOMADO=1: lo llama tanda-170.sh, que ya tiene el candado y lo suelta al final (aquí no se toca)
if [ "$MKW_CANDADO_TOMADO" != 1 ]; then
  n=0
  while [ -f build/medicion.lock ] && ! grep -q "local_cbaf17f0" build/medicion.lock && [ $n -lt 5400 ]; do sleep 20; n=$((n+20)); done
  [ -f build/medicion.lock ] && ! grep -q "local_cbaf17f0" build/medicion.lock && { echo "candado tomado: $(cat build/medicion.lock)"; exit 1; }
  echo "$YO $(date '+%Y-%m-%d %H:%M') traduccion" > build/medicion.lock
  trap 'grep -q "local_cbaf17f0" build/medicion.lock 2>/dev/null && rm -f build/medicion.lock' EXIT
fi

PAYLOAD="$(pwd -W 2>/dev/null || pwd)/build/rr_wfc_payload-n15.bin"
# borrar la copia descartable SIN seguir el enlace a Retro Rewind (PulsarPacks/…/RetroRewind6 es una «junction»: rm -rf
# podría entrar y borrar el Retro Rewind de verdad). Primero se quita el enlace solo (Directory.Delete sin recursión
# borra el enlace, no lo de adentro); después, el resto.
borrar_copia() {
  local j="terceros/Wiicompiled-trad-viejo/PulsarPacks/completed/RetroRewind/RetroRewind6"
  if [ -e "$j" ]; then
    powershell -NoProfile -Command "[System.IO.Directory]::Delete('$(cygpath -w "$(pwd)/$j")')" || { echo "no pude quitar el enlace $j: no borro nada"; return 1; }
  fi
  [ -e "$j" ] && { echo "el enlace $j sigue: no borro nada"; return 1; }
  rm -rf terceros/Wiicompiled-trad-viejo
}
huellas() { (cd "$1" && awk '{print $2}' "$OLDPWD/build/n15-huellas-traduccion-1.txt" | sed 's#^\*##' | xargs sha256sum -b 2>/dev/null); }
traducir() {   # $1 = carpeta de la copia, $2 = etiqueta; deja el tiempo en segundos en $SAL
  local t0=$(date +%s.%N)
  MKW_WIICOMPILED="$1" MKW_RR_PAYLOAD="$PAYLOAD" timeout 2400 powershell -NoProfile -ExecutionPolicy Bypass \
    -File herramientas/traducir.ps1 > "build/web/datos/n15/traducir-$2.log" 2>&1
  local r=$? t1=$(date +%s.%N)
  echo "$2: salida $r, $(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.1f", b-a}') s" | tee -a "$SAL"
}

# 1) v0.9.3 otra vez (sale lo mismo si es determinista: los programas de build/web-motor no cambian)
traducir 'terceros\Wiicompiled-motor' nuevo-2
huellas terceros/Wiicompiled-motor > build/n15-huellas-traduccion-2.txt
if diff -q build/n15-huellas-traduccion-1.txt build/n15-huellas-traduccion-2.txt > /dev/null; then
  echo "v0.9.3: las 378 huellas iguales a la primera traducción (determinista)" | tee -a "$SAL"
else
  echo "v0.9.3: $(diff build/n15-huellas-traduccion-1.txt build/n15-huellas-traduccion-2.txt | grep -c '^>') archivos distintos" | tee -a "$SAL"
fi

# 2) el viejo, en una copia descartable (el mismo disco, el mismo Retro Rewind, el mismo payload)
borrar_copia || exit 1
git clone -q terceros/Wiicompiled terceros/Wiicompiled-trad-viejo && git -C terceros/Wiicompiled-trad-viejo checkout -q bd219e3
DOTNET_ROLL_FORWARD=Major DOTNET_CLI_TELEMETRY_OPTOUT=1 timeout 900 dotnet build -c Release -v q \
  terceros/Wiicompiled-trad-viejo/translator/src/Translator.Cli/Translator.Cli.csproj > build/web/datos/n15/compilar-traductor-viejo.log 2>&1
echo "traductor viejo compilado: salida $?" | tee -a "$SAL"
for k in 1 2; do
  traducir 'terceros\Wiicompiled-trad-viejo' viejo-$k
  huellas terceros/Wiicompiled-trad-viejo > build/n15-huellas-viejo-$k.txt
done
if diff -q build/n15-huellas-viejo-1.txt build/n15-huellas-viejo-2.txt > /dev/null; then
  echo "viejo: las dos traducciones dan las mismas huellas" | tee -a "$SAL"
else
  echo "viejo: $(diff build/n15-huellas-viejo-1.txt build/n15-huellas-viejo-2.txt | grep -c '^>') archivos distintos entre sus dos traducciones" | tee -a "$SAL"
fi
borrar_copia   # la copia descartable (mía; nada del juego queda fuera de terceros/)
cat "$SAL"
