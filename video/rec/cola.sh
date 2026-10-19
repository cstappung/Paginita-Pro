#!/bin/bash
# cola.sh esperar_a escena1 escena2 ...: espera a que termine la toma indicada y graba las demás una tras otra
S=$(cd "$(dirname "$0")/.." && pwd); [ -d "$S/rec" ] || S=$(cd "$(dirname "$0")" && pwd)
cd $S/rec; espera=$1; shift
[ "$espera" != "-" ] && until grep -q "^exit" $S/clips/log_$espera.txt 2>/dev/null; do sleep 10; done
for g in "$@"; do timeout 5000 node cap.cjs $g > $S/clips/log_$g.txt 2>&1; echo "exit $?" >> $S/clips/log_$g.txt; echo "$g terminado: $(grep -E 'frames|FAIL' $S/clips/log_$g.txt | tail -1)"; done
