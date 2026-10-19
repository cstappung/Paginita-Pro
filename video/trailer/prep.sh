#!/bin/bash
# Pasa cada toma a cuadros jpg 1920x1080 a 30 fps para el tráiler
S=$(cd "$(dirname "$0")/.." && pwd); [ -d "$S/rec" ] || S=$(cd "$(dirname "$0")" && pwd)
for n in "$@"; do rm -rf $S/trailer/clips/$n; mkdir -p $S/trailer/clips/$n
  ffmpeg -loglevel error -y -i $S/clips/$n.mp4 -vf "fps=30,scale=1920:1080" -q:v 3 $S/trailer/clips/$n/%04d.jpg; echo "$n $(ls $S/trailer/clips/$n | wc -l)"; done
