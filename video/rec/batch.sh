#!/bin/bash
S=$(cd "$(dirname "$0")/.." && pwd); [ -d "$S/rec" ] || S=$(cd "$(dirname "$0")" && pwd)
cd $S/rec
run() { timeout 1500 node cap.cjs $1 > $S/clips/log_$1.txt 2>&1; echo "$1 exit $? $(grep -E 'frames|FAIL' $S/clips/log_$1.txt | tail -1)"; }
export -f run; export S
printf "%s\n" "$@" | xargs -P 3 -I{} bash -c 'run {}'
