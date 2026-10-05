# Antitrampas de Tetris Club

Categorías: `club-tetris-maraton` (puntos), `club-tetris-sprint` (40
líneas, compite el tiempo; `puntos` fijo en 40) y `club-tetris-ultra`
(puntos en dos minutos). Verificador:
`colabtex/src/juegos/solo/verifica/tetris.js` (`PRUEBA = 1`). Pruebas:
`colabtex/tests/antitrampas-tetris.test.cjs`.

## Vías de trampa que había

1. **`Club.result` desde la consola** del iframe con cualquier número
   (`{categoria:'club-tetris-sprint',puntos:40,tiempo:5000}`).
2. **Pendientes en `localStorage`** editados a mano (los re-verifica la
   página, ver el plan común).
3. **El estado del juego**: `s` vive dentro de una IIFE, pero con el
   depurador se puede parar en `bucle` y tocar `s.lineas`, `s.puntos` o
   `s.tiempo`. No hay ganchos tipo `window.__fanal`.
4. **El reloj**: la partida avanzaba con el `dt` de
   `requestAnimationFrame`; frenando ese reloj (o `performance.now`) el
   Sprint se juega a cámara lenta y marca un tiempo de juego corto, y en
   Maratón la gravedad deja de apretar. Parar con el depurador congela el
   juego (el `dt` tiene tope de 100 ms), pero no deja jugar mientras.
5. **Robar la prueba de otro**: `soloPruebas` lo lee cualquiera con
   sesión; mandar la prueba del primero de la tabla como propia.
6. **Bots**: un script que despacha `KeyboardEvent` desde la consola, o un
   programa que teclea por el sistema (`isTrusted` verdadero) jugando con
   un buscador de colocaciones.

## La prueba

El juego en solitario ya no avanza con el `dt` del cuadro: **avanza en
pasos fijos de `TM.PASO` = 10 ms**, los que quepan en el tiempo real de
cada cuadro, y **toda acción se aplica al empezar un paso** (las teclas se
encolan con `g.pide` y se aplican en `g.paso`). La sucesión de pasos es
entonces todo lo que decide la partida, y se puede rehacer exacta. El
código vive en el motor compartido (`juegos/club/tetris/motor.js`:
`grabadora`, `rehace`, `semillaDe`, `registroTeclas`, `leeTeclasPrueba`),
así el juego y el verificador nunca divergen. La sala multijugador no usa
nada de esto (sigue con `avanza(s, dt)`), y la gravedad pasó de
`Math.pow` a una tabla con los mismos valores que daba V8, para que la
repetición dé el mismo último bit en cualquier navegador y en Node.

```json
{"v":1, "m":"sprint", "u":"<cuenta>", "a":<sal uint32>, "n":<pasos>,
 "e":"zIDeD5D4D3BkCS…", "w":<ms de reloj del sistema>,
 "k":"8w.1,2.7b,7d.5n,…"}
```

- **Semilla** = `semillaDe(u, a)`: la cuenta (el `cuenta=` de la URL del
  iframe) y una sal aleatoria. Cambiarle la cuenta a una prueba cambia
  las piezas, así que la de otra persona no sirve tal cual.
- **`n`**: pasos que duró la partida (el tiempo de juego es `n × 10` ms,
  salvo el paso en que se pierde).
- **`e`**: las jugadas, `<pasos desde la anterior en base 36><letra>`:
  `I` izquierda, `D` derecha, `G` girar, `A` contragiro, `C` soltar, `H`
  guardar, `B`/`S` apretar/soltar el blando. Solo se anotan las acciones
  que **cambiaron algo** (mover contra la pared no se anota: no cambia la
  partida). Unos 3–9 caracteres por pieza; un Sprint ocupa ~1 KB, una
  Maratón hasta el nivel 20 (~560 piezas) ~5 KB de jugadas.
- **`w`**: el tiempo jugado según `Date.now`, sumado cuadro a cuadro con
  tope de 1 s por cuadro (una suspensión del portátil no lo infla).
- **`k`**: las pulsaciones (capa anti-bot), `<ms desde la anterior>[.<ms
  mantenida>][origen]` en base 36, separadas por comas. Origen en
  mayúscula: nada = teclado de verdad, `T` = botón táctil, `M` = mando
  (`mando.js` despacha teclas sintéticas marcadas `__mando`; se anota `M`
  solo si `navigator.getGamepads()` tiene uno conectado), `X` = un evento
  con `isTrusted` falso que no es del mando. Solo cuentan las pulsaciones
  que piden una acción, no las repeticiones automáticas del teclado ni el
  DAS. Unos 6–8 caracteres por pulsación.

Total típico: 1–6 KB; muy lejos de los 200 000 caracteres.

**Remapeo y mando no tocan la prueba**: lo que se anota es la acción, no
la tecla. Lo comprueba una prueba que juega el mismo plan con las teclas
de siempre y con otras y obtiene la misma prueba, y que `mandoTetris`
manda la primera tecla configurada.

## Qué comprueba el verificador

1. **La partida existe** (`TM.rehace`): versión, modo de la prueba igual
   al de la categoría, semilla legible, jugadas legibles; se rehace paso a
   paso y una jugada anotada que al rehacer no hace nada, un blando
   apretado dos veces, una partida que sigue después de terminar o que no
   termina delatan una prueba tocada a mano. Tope: 6 h de partida.
2. **Lo declarado es lo jugado**: Sprint hizo de verdad 40 líneas sin
   perder; Maratón y Ultra, los puntos exactos; el tiempo exacto
   (`max(1, round(tiempo))`, Ultra 120 000 si llegó al final).
3. **La cuenta** (si la página la pasa, ver abajo): `u` = uid de quien
   guarda.
4. **Límites de una mano** (con margen; el récord mundial de 40 líneas,
   TETR.IO con DAS y ARR casi nulos, ronda 13–14 s ≈ 7,5 piezas por
   segundo; aquí el DAS es 150 ms y el ARR 45, fijos):
   - Sprint por debajo de **12 s**: nadie.
   - Más de **8 PPS** de media con 60 piezas o más.
   - **40 piezas en menos de 3,33 s** (ráfaga de 12 PPS; los mejores
     tocan ~10 a ratos). Machacar la caída sin mover no llega: el pozo se
     llena con ~20 piezas.
   - Más de **50 jugadas que hicieron algo en un segundo** (mantener la
     flecha da 22/s, y solo mientras la pieza se puede mover).
5. **Reloj frenado**: se rechaza si el tiempo de juego es menos de **0,3**
   veces `w` y la diferencia pasa de **15 s**. Un aparato lento también
   va por detrás (el juego no avanza más de 100 ms por cuadro), pero para
   llegar a 0,3 tendría que ir entero a menos de 3 cuadros por segundo.
6. **Capa anti-bot** (`k`):
   - **Un evento `X` rechaza solo**: no hay forma honesta de producirlo
     (el teclado y el dedo dan `isTrusted`; el mando, `M`).
   - Sin pulsaciones pero con más de 10 jugadas: rechaza.
   - Señales blandas, que **rechazan de a dos**:
     - **metrónomo**: ≥ 40 intervalos entre pulsaciones (sin contar
       pausas de más de 3 s) con σ/μ < **0,12**; los humanos simulados dan
       0,3–1,8 y una persona jugando Tetris (pensar, ráfaga, pensar) más;
     - **teclas sin mantener**: ≥ 30 pulsaciones con mediana de
       mantenida < **10 ms** (una tecla física dura 30 ms o más);
     - **reacción imposible**: la primera pulsación antes de **100 ms**
       desde que empieza la partida.
   - Sola rechaza un metrónomo perfecto: σ/μ < **0,03** con ≥ 60
     intervalos.

`sospecha()` (filas viejas sin prueba): Sprint distinto de 40 puntos o por
debajo de 12 s; Ultra de más de dos minutos; Maratón y Ultra con más
puntos de los que caben jugando a 6 PPS sin parar con solo Tetris en
cadena (y un pozo limpio cada cien piezas), con la mitad más de margen
(Ultra: ~1,8 M).

## Cómo se probó

- 13 pruebas en `antitrampas-tetris.test.cjs`: un robot (busca la mejor
  colocación con los pesos de El-Tetris y teclea con ritmo irregular y
  teclas mantenidas 40–140 ms) juega con `TM.grabadora`, lo mismo que
  usa `game.js`. Pasan: Sprint a 1,8 PPS (66 s) y a 6 PPS (18,8 s, «muy
  rápido pero humano»), Ultra con blando, Maratón de 130 piezas, una
  Maratón lentísima (0,23 PPS) y la misma partida con las teclas marcadas
  de mando. Se rechazan: resultado sin prueba, prueba vacía o ilegible,
  puntos inflados, tiempo recortado (−1 ms también), modo cambiado, una
  Maratón presentada como Sprint, la prueba de otra partida, de otra
  cuenta (tal cual o cambiándole la cuenta o la sal), jugadas quitadas,
  añadidas o cambiadas, `n` alargado o acortado, blando duplicado, un bot
  a una acción por paso (Sprint en 6 s), uno a 9,8 PPS (11,4 s), una
  Maratón a 9 PPS, un «nervioso» que se mueve en cada paso (>50 jugadas/s),
  la partida comprimida en el tiempo, un reloj frenado a ¼, eventos de
  script, un metrónomo perfecto y uno con temblor pero sin mantener las
  teclas. Un metrónomo con temblor solo, o teclas secas solas, pasan.
- En Chromium (Playwright, la página dentro de un iframe del mismo
  origen): una partida jugada con el teclado manda su prueba, y el
  verificador en Node la rehace exacta (los mismos 324 puntos, 5190 ms) y
  rechaza los puntos +1. Una partida jugada despachando `KeyboardEvent`
  desde el iframe se rechaza por script.
- `motor.test.cjs`, `tetris.test.cjs` (la sala) y todo `test:juegos`
  siguen en verde.

## Lo que no se puede detectar (límite honesto)

- **Un cliente reescrito**: todo lo de la prueba lo escribe el navegador
  de quien juega. Quien edite el juego puede fabricar `w` y `k` humanos.
  La partida en sí (`e`) sí tiene que existir y respetar los límites.
- **Un bot que juega a ritmo humano** con teclas reales e irregulares, o
  uno que juega un poco por debajo de los límites (≤ 8 PPS, Sprint de
  13 s): su partida es válida y sus números posibles. Solo se puede
  auditar a mano después (la prueba se guarda).
- **Un reloj frenado poco** (×0,5, con `Date.now` sin tocar o frenado
  también): no se distingue de un aparato lento.
- **La sal se puede buscar**: la semilla es de 32 bits; quien quiera
  usar la prueba de otro puede probar sales hasta dar con la misma
  semilla para su cuenta (≈ 2³² intentos, minutos con un programa). Hace
  falta además que la página pase el uid (abajo).
- El motor deja «flotar» una pieza moviéndola a izquierda y derecha en
  cada paso de 10 ms (el retraso de fijado se reinicia al quedar en el
  aire). Una mano no puede, y no da puntos; el límite de jugadas por
  segundo lo rechaza igual.
- Una Maratón de más de ~5 000 piezas (unos 40–60 minutos a buen
  ritmo) no cabría en los 200 000 caracteres de la prueba, jugadas y
  pulsaciones juntas (~35 caracteres por pieza), y se rechazaría por
  grande. Es casi imposible llegar (el nivel 20, a las 190 líneas, es
  caída instantánea), pero si pasa, la solución es compartida: subir
  `PRUEBA_MAX` o comprimir.

## Cambios compartidos pedidos

1. **Pasar el uid al verificador**: `verificaClub(juego, dato, prueba,
   {uid})` → `v.verifica(dato, prueba, {uid})` desde `solo/club.js` (en
   vivo y al re-verificar pendientes) y desde `auditar-club.cjs` (el uid de
   la ruta `soloPruebas/<cat>/<uid>`). `tetris.verifica` ya lo usa si
   llega: rechaza la prueba cuya `u` no es esa cuenta. Sin esto, la
   prueba de otra persona mandada tal cual pasa.
2. **Subir el `?v=club-N` del iframe** en `colabtex/src/juegos/solo/club.js`
   (hoy `club-25`): el `index.html` de Tetris cambió (`motor.js?v=club-4`,
   `game.js?v=club-5`). Con un `index.html` viejo en caché el juego manda
   el resultado sin prueba y se rechaza con «recarga la página».
3. `motor.js` lo empaqueta también `juegos-app.js` (la sala): hay que
   compilar (`npm run build`) al integrar. Crece ~6 KB.
