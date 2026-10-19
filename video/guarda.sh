#!/bin/bash
# Copia el trabajo del tráiler al repo (video/), con rutas relativas, y comprime las tomas.
S=$(cd "$(dirname "$0")/.." && pwd); [ -d "$S/rec" ] || S=$(cd "$(dirname "$0")" && pwd)
R=$(cd "$S/.." && pwd); V=$R/video
mkdir -p $V/rec $V/build $V/trailer/fonts $V/hero $V/emu $V/tomas $V/salidas
cp $S/rec/*.cjs $S/rec/*.js $S/rec/*.sh $V/rec/ 2>/dev/null
cp $S/rec/package.json $V/rec/
cp -r $S/rec/salas $S/rec/semilla.json $V/rec/ 2>/dev/null
cp $S/build/build.cjs $S/build/parches.cjs $V/build/
cp $S/trailer/*.svg $S/trailer/*.html $S/trailer/*.js $S/trailer/*.css $S/trailer/*.py $S/trailer/*.cjs $S/trailer/*.sh $V/trailer/ 2>/dev/null
cp $S/trailer/fonts/*.woff2 $V/trailer/fonts/
cp -r $S/hero/chart.py $S/hero/api $S/hero/songs $V/hero/
cp $S/emu/firebase.json $V/emu/
cp $S/guarda.sh $V/guarda.sh
# rutas: el área de trabajo pasa a ser la carpeta video/ y el repo, su padre
for f in $(grep -rl "$S\|$R" $V --include=*.cjs --include=*.js --include=*.sh --include=*.py); do
  case "$f" in
    *.cjs|*.js)
      sed -i "s#'$S/#require('path').resolve(__dirname, '..') + '/#g; s#'$S'#require('path').resolve(__dirname, '..')#g; s#'$R/#require('path').resolve(__dirname, '../..') + '/#g; s#'$R'#require('path').resolve(__dirname, '../..')#g" "$f";;
    *.sh)
      sed -i "s#^S=$S\$#S=\$(cd \"\$(dirname \"\$0\")/..\" \&\& pwd); [ -d \"\$S/rec\" ] || S=\$(cd \"\$(dirname \"\$0\")\" \&\& pwd)#; s#$S#\$S#g; s#^R=$R;#R=\$(cd \"\$S/..\" \&\& pwd);#; s#$R#\$R#g" "$f";;
    *.py)
      sed -i "s#'$S'#os.path.dirname(os.path.dirname(os.path.abspath(__file__)))#g; s#'$S/#os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/#g; s#^import #import os, #" "$f";;
  esac
done
# tomas: versión liviana para guardar (las originales son todo keyframes)
for m in $S/clips/*.mp4; do n=$(basename $m); d=$V/tomas/$n
  if [ ! -f $d ] || [ $m -nt $d ]; then nice -n 10 ffmpeg -loglevel error -y -i $m -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -an -movflags +faststart $d; fi; done
cp $S/clips/*.json $V/tomas/ 2>/dev/null
for f in $S/trailer-juegos-liviano.mp4 $S/trailer2-liviano.mp4 $S/trailer3-liviano.mp4; do [ -f $f ] && cp $f $V/salidas/; done
grep -rn "/tmp/claude-0\|/home/user" $V --include=*.cjs --include=*.js --include=*.sh --include=*.py | grep -v "^$V/guarda.sh" | head
du -sh $V/tomas $V
