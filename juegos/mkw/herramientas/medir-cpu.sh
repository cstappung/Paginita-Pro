#!/bin/bash
# Mide cuánta CPU gasta cada cuadro en la presentación de la carrera y los primeros segundos de carrera (bitácora §53).
#
# Resumen: maneja el juego en Chrome con guion.mjs hasta una carrera (Mario Kart, Mario, primera copa) y acelera 14 s,
# con la traza del ritmo prendida. Después herramientas/tiempos-cuadro.mjs separa, de a 60 cuadros, la CPU del juego,
# la de aurora y las esperas, y este script resume: promedio de "juego" y "aurora" y cuántos cuadros se pasaron de
# 16,7 ms (el presupuesto de 60 fps). Sirve para comparar dos versiones o un parámetro prendido/apagado.
#
# Uso:  bash herramientas/medir-cpu.sh <etiqueta> ["&parametro=valor..."]
#   p. ej. bash herramientas/medir-cpu.sh nuevo
#          bash herramientas/medir-cpu.sh viejo "&staging=mapeo"
#   FRENO=4 bash herramientas/medir-cpu.sh celular   → la carga de la carrera y lo que sigue con la CPU 4× más lenta
#                                                       (como un teléfono; los menús van a velocidad normal)
# Deja build/web/datos/medir-cpu/<etiqueta>.log (consola) y .txt (tabla de tiempos-cuadro).
cd "$(dirname "$0")/.."                                    # la raíz del proyecto
mkdir -p build/web/datos/medir-cpu
SAL="build/web/datos/medir-cpu/$1"
# Los pasos del guion: del título a la carrera (los mismos que medir la largada) y K~14000 = acelerar 14 s
# (con FRENO=N, un paso F*N justo antes de confirmar la pista: frena la CPU desde la carga de la carrera)
G="K:2500 K:2000 K:2500 K:2500 K:2500 K:3000 K:3500 K:2500 K:2500 K:2500 K:3500 K:2500 K:2500 K:2500 K:2500 ${FRENO:+F*$FRENO:100 }K:4000 K:12000 K~14000:500"
node web/navegador/guion.mjs "$G" --traza --extra "&traza=1$2" > "$SAL.pasos" 2>&1
cp build/web/datos/guion/consola.log "$SAL.log"
# Desde el cuadro 3600 (ya en la pantalla de carga de la carrera)
node herramientas/tiempos-cuadro.mjs "$SAL.log" --desde 3600 > "$SAL.txt"
# Resumen: promedio de juego y aurora sobre todas las filas, y cuadros con juego + aurora > 16,7 ms
node -e "
const L = require('fs').readFileSync(process.argv[1], 'utf8').split('\n').filter(l => /^\s+\d+\s+juego/.test(l));
let j = 0, a = 0, n = 0, largos = 0;
for (const l of L) { const m = /juego\s+([\d.]+).*aurora\s+([\d.]+).*> 16,7 ms: (\d+)/.exec(l); j += +m[1]; a += +m[2]; largos += +m[3]; n++; }
console.log(process.argv[2].padEnd(10), 'juego', (j / n).toFixed(2), 'ms, aurora', (a / n).toFixed(2), 'ms, cuadros con juego+aurora > 16,7 ms:', largos, 'de', n * 60);
" "$SAL.txt" "$1"
# Segundos del medidor de la página bajo 57 fps desde el cuadro 3700 (incluye las cargas, que no son CPU)
grep "^\[medidor\]" "$SAL.log" | awk '{c=$5; gsub(",","",c); if (c+0>3700 && $6+0<57) n++} END{print "  segundos bajo 57 fps desde el cuadro 3700:", n+0}'
