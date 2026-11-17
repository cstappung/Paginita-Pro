# Antitrampas de Ajedrez Club

Cinco tablas:

- `club-ajedrez-bot1` … `club-ajedrez-bot4`: una victoria por mate contra
  el bot de ese nivel (Novato, Aficionado, Experto, Maestro). `puntos` = 1
  fijo y compite `tiempo`: los ms que pensó el jugador en sus jugadas, sin
  contar lo que pensó el bot.
- `club-ajedrez-puzles`: `puntos` = las estrellas de todos los puzles (tres
  por puzle, 180 hoy; tope 600) y `tiempo` la suma de los ms del intento que
  cuenta en cada uno.

## La prueba de una partida

`{v: 1, u, s, n, c, j, t, a, w}`:

- `u`: la cuenta. `s`: la semilla. La semilla del bot es
  `semillaCuenta(s, u)`, así que una prueba copiada de otra persona con la
  cuenta cambiada hace jugar distinto al bot y no se rehace.
- `n`: el nivel (1-4), `c`: `'b'` o `'n'`, el color del jugador.
- `j`: las jugadas **del jugador** en UCI (`e2e4`, `e7e8q`). Las del bot
  no viajan: el bot es determinista (profundidad fija, orden fijo, azar de
  mulberry32 por jugada) y el verificador las vuelve a calcular.
- `t`: los ms que tardó en cada jugada (desde que le tocó).
- `a` / `w`: lo pensado según `performance.now` y según `Date.now`.

## Qué comprueba `solo/verifica/ajedrez.js` (partidas)

1. Que la cuenta sea la de quien guarda y el nivel el de la tabla.
2. Que la partida rehecha con el MISMO motor
   (`juegos/club/ajedrez/motor.js`, `rehaceBot`) tenga todas las jugadas
   legales y termine en mate al bot, sin jugadas de más.
3. Que `tiempo` sea exactamente la suma de `t`, `a` coincida con esa suma y
   los dos relojes coincidan (`dosRelojes`).
4. Ritmo de programa: diez jugadas seguidas (que no sean la única legal) a
   menos de 180 ms cada una rechazan.

Rehacer una partida contra el Maestro cuesta del orden de un segundo (el
bot piensa ~25 ms de media por jugada en Node).

## La prueba de los puzles

`{v: 1, u, n: {id: {j, e, p, t}}}`: por cada puzle (id de lichess), su mejor
intento: `j` las jugadas aceptadas, `e` los errores como `[paso, uci]`, `p`
si pidió la pista y `t` los ms de cada jugada aceptada. `rehacePuzle`
comprueba que cada jugada de `j` sea la de la solución (o un mate, que en
los de mate siempre vale) y que cada error sea de verdad una jugada legal
equivocada; las estrellas salen de `3 − errores − pista` (mínimo 1).
Rechaza también un puzle que el juego no tiene, totales que no cuadran y
cuatro o más puzles con todas sus jugadas por debajo de 250 ms.

## El límite honesto

Un motor de ajedrez al lado, o un programa que juegue a ritmo de persona,
produce partidas válidas. Los errores de un puzle los declara el propio
jugador: quien los calle saca tres estrellas, igual que quien busque la
solución en lichess. Lo que queda fuera es inventar la partida, el bot o el
tiempo, copiar la prueba de otra cuenta, acelerar el reloj y jugar al ritmo
de un guion.

`sospecha()` (filas sin prueba): un mate al bot en menos de 1,5 s (hacen
falta al menos dos jugadas propias) y puzles a menos de un cuarto de
segundo cada uno.
