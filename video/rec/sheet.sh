#!/bin/bash
# sheet.sh out.png clip1 clip2 ... : 3 frames por clip (25%,55%,90%)
out=$1; shift; S=$S; tmp=$S/sheettmp; rm -rf $tmp; mkdir -p $tmp; n=0
for c in "$@"; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $c); for p in 0.25 0.55 0.9; do t=$(echo "$d*$p"|bc -l|sed "s/^\./0./"); ffmpeg -loglevel error -y -ss $t -i $c -frames:v 1 -vf scale=480:270 $tmp/$(printf %03d $n).png; n=$((n+1)); done; done
ffmpeg -loglevel error -y -pattern_type glob -i "$tmp/*.png" -vf "tile=3x$(( ($n+2)/3 ))" -frames:v 1 $out
