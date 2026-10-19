# Tráiler de lanzamiento de Juegos — notas para Claude

Herramientas para grabar tomas de los juegos y montar el tráiler (video MP4). No es parte del sitio:
nada de aquí se carga desde una página, y `video/` no está en `stamp-version.js`. Todo en español.

## Carpetas

- `rec/` — el grabador. `cap.cjs <escena…>` graba cada escena de `games.cjs` (juegos sueltos) y
  `escenas.cjs` (el sitio completo contra el emulador) en `clips/<escena>.mp4` (1920×1080, 30 fps, todo
  keyframes para montar). `cola.sh <esperar|-> <escenas…>` las graba una tras otra. `sheet.sh` arma una
  hoja de contacto de un clip. `PROBE=ms node cap.cjs x` solo juega y saca una captura (`shots/`).
- `rec/vt.js` — **reloj virtual**: reemplaza `requestAnimationFrame`, `performance.now`, `Date.now`,
  timers y el reloj de audio, y en modo virtual solo avanza con `__vt.step(ms)`. Así cada cuadro es
  exactamente 1/30 s de juego aunque Chromium sin GPU tarde segundos en dibujarlo. `cap.cjs` lo avanza
  en todos los frames (iframes incluidos). `ff` avanza sin capturar (para llegar a etapas avanzadas).
- Bots dentro de la página: `tetris-ia.js` (Dellacherie clásico, juega por teclado), `boxhead-bot.js`
  (inmortal, todas las armas, apunta al más cercano), `yemas-bot.js` (zombis, puntería). `uno-sala.cjs`
  crea una sala de UNO real en el emulador y juega con el robot de `colabtex/tests/uno.test.cjs`.
- `build/` — `node build.cjs` arma `build/juegos-app.js`: el bundle de Juegos con `parches.cjs`
  aplicados solo para filmar (se conecta al emulador, expone `window.__fb`, `__suerte` en el casino,
  `__aceptaTodo` en la verificación del club). `sitio.cjs` lo sirve en lugar de `juegos-app.js`.
  **Nunca** llevar esos parches a `colabtex/src`.
- `emu/firebase.json` — emulador de auth y database (copiar `firebase/database.rules.json` al lado).
  `rec/semilla.cjs` deja los datos de la grabación (ver su cabecera). El uid de GUGU GAGA cambia con
  cada emulador: las claves de Michi, sus regalos y el god pack se buscan para ese uid.
- `hero/` — biblioteca local de PRO HERO (`?fuente=servidor`, servida por una ruta de Playwright):
  CHINCHONCHIN (de mellowsynesthesia128, creada por la dueña del sitio) y `chart.py`.
- `trailer/` — el montaje. `trailer.html` (v1, 52 s) y `trailer2.html` (v2, 84 s; se arma con
  `arma2.py` desde `timeline2.js` + `estilos2.css`). Cada cuadro es `render(t)`, sin animaciones
  CSS vivas. `prep.sh` pasa clips a cuadros jpg, `clips.py` escribe `clips.json` (encuadre de cada toma),
  `render.cjs [desde hasta paso]` renderiza, `musica.py`/`musica2.py` sintetizan la música (numpy) y
  `mezcla.py` pone CHINCHONCHIN en el tramo de PRO HERO, sincronizada con `tomas/hero.json`.
- `tomas/` — las tomas grabadas, recomprimidas para guardar (`prep.sh` las acepta igual).
  `salidas/` — tráileres terminados.

## Para reanudar

1. `cd video/rec && npm install` (playwright-core; Chromium en `/opt/pw-browsers`). Las librerías de
   jsDelivr (three, phaser) se sirven desde `cdn/node_modules` (`npm i three@0.160.0 phaser@3.87.0` ahí).
2. `cd colabtex && npm install`, luego `node video/build/build.cjs`.
3. Emulador (`video/emu`), servidor estático del repo en :8123 (`python3 -m http.server 8123`) y del
   montaje en :8124 (desde `video/trailer`). `node video/rec/semilla.cjs`.
4. Copiar `tomas/*.mp4` a `clips/` (o regrabar) y `trailer/prep.sh <tomas>`; `python3 clips.py`;
   `PAGINA=trailer2.html OUTDIR=out2 node render.cjs 0 84`; ffmpeg con la mezcla.

## Trampas

- Chromium headless sin GPU: las páginas 3D o pesadas no sirven en tiempo real (2–4 fps). Grabar
  siempre en tiempo virtual (`vt: 1`). Las animaciones CSS no son virtuales (el salón usa `slow`).
- En tiempo virtual el reloj de la página atrasa respecto del servidor: el avión del casino cobraba
  en ×100 del servidor. Por eso `parches.cjs` quita el tope con `__suerte` y fija el cobro en `__tope`.
- `pkill -f` con un patrón que también está en la línea de comandos del shell mata al propio shell.
- Las cartas «Profes» de PRODROP son fotos de profesores reales: el tráiler usa solo Componentes.
