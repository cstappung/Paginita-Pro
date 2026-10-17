# Antitrampas de PRO TILES

Nueve tablas, una por canción y una para la mezcla:

- `club-protiles-<id>` (`cristal`, `medianoche`, `calle`, `verano`, `neon`,
  `latido`, `estrellas`, `despegue`) y `club-protiles-mezcla`: `puntos` es
  el puntaje de la partida (1 por nota más el bono de las fichas largas
  completadas) y `tiempo` lo que duró en tiempo de juego (pasos de 4 ms ×
  4). Tope 1 000 000.

## La prueba

`{v: 1, m, s, u, g, n, a, w, x?}`:

- `m`: el modo (el id de la canción o `mezcla`); tiene que ser el de la tabla.
- `s`: la semilla (32 bits). `u`: la cuenta. Las dos juntas deciden los
  carriles de las fichas (`mezcla(s, hashTexto(u))`), así que una prueba
  copiada de otra persona no rehace la misma partida. La melodía es la
  misma para todos (cada canción empieza igual, como en el original).
- `g`: las acciones, separadas por coma, con los ticks desde la anterior en
  base 36: una nota es su carril (`a`–`d`) y `dt`; una ficha larga,
  `<carril>dt.dc` (`dc` = a qué altura
  se completa, en centésimas de fila: el largo entero con teclado, donde
  se tocó con el dedo, desde 0,4 filas); soltar una larga, `rdt`.
- `n`: el tick en que terminó la partida.
- `a` / `w`: lo jugado según `performance.now` y según `Date.now`.
- `x`: algún toque fue un evento sintético (`isTrusted` falso sin mando).

## Qué comprueba `solo/verifica/protiles.js`

1. Que cada nota se tocara en el carril de su ficha (lo que ata la prueba a
   la semilla y la cuenta) y cuando su ficha estaba en pantalla
   (`M.tocable`: desde que asoma hasta 0,15 filas bajo el borde) y que
   ninguna ficha se escapara antes de la última nota, rehaciendo la partida
   paso a paso con el mismo motor (`juegos/club/protiles/motor.js`).
2. Que la partida rehecha llegue viva al tick `n` (termina ahí porque se
   escapa una ficha, o antes por un toque fuera) y sume exactamente
   `puntos`; que `tiempo` sea `n × 4`.
3. Que las distancias de las largas sean posibles y que una corta no se
   toque como larga.
4. Sin eventos sintéticos; los dos relojes de acuerdo (`dosRelojes`), y el
   juego no más largo que el reloj.
5. **La mano**: 50 notas seguidas tocadas a menos de 0,02 filas de la misma
   altura de la pantalla rechazan (un programa toca siempre igual; una
   persona varía decenas de ms).

`sospecha` solo mira el tope: la pantalla acelera sin techo, así que no hay
un tiempo mínimo creíble para un puntaje.

## Determinismo

El motor avanza en pasos fijos de 4 ms, así que la frecuencia de la
pantalla no cambia lo que pasa. La curva de velocidad usa `expNeg` (Taylor
con + − × ÷) y no `Math.exp`, que no da el mismo último bit en todos los
motores. Los carriles salen de mulberry32; las notas del compositor, de
mulberry32 sembrado con el id de la canción.

## El límite honesto

Un programa que toque con eventos de verdad y una mano imitada (desfases
al azar) saca una prueba válida.
