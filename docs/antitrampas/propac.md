# Antitrampas de PRO PACMAN

Una tabla:

- `club-propac-puntos`: `puntos` es el puntaje de la partida y `tiempo` los
  ms de juego (`round(tics × 1000 / 60)`) hasta el final. Tope 10 000 000.

## La prueba

`{v: 1, s, u, j, n, r, a, w}`:

- `s`: la semilla (32 bits). `u`: la cuenta, mezclada con la semilla en el
  azar del motor (los fantasmas asustados, Glitch), así que una prueba
  copiada de otra persona no rehace la misma partida.
- `j`: las jugadas en texto (`codifica` en `motor.js`): `origen código
  Δtics` en base 36, separadas por comas. Código 0–3 querer ir arriba,
  izquierda, abajo, derecha; 4 turbo; 5 pulso. Origen `k` teclado, `t`
  dedo, `r` ratón, `m` mando, `x` evento sintético. La pantalla no anota
  las jugadas que el motor rechaza ni pedir la dirección que ya se lleva.
- `n`: el tic en que terminó (al perder la última vida, o al «Terminar»
  desde la pausa).
- `r`: ms de reloj desde el inicio; `a` / `w`: lo jugado sin pausas según
  `performance.now` y según `Date.now`.

## Qué comprueba `solo/verifica/propac.js`

1. Que la partida rehecha con el mismo motor (`juegos/club/propac/motor.js`)
   llegue al tic `n` con exactamente los puntos declarados, y que el tiempo
   sea el de esos tics.
2. Que la prueba sea de esta cuenta y que no haya jugadas `x`.
3. Que el reloj no vaya más rápido que el juego (`r ≥ 0,9 × tiempo`) y que
   los dos relojes coincidan (`dosRelojes`).
4. La mano: un giro «en marcha» es una dirección perpendicular pedida
   mientras el jugador avanza. Un programa la pide justo en el tic en que
   pisa el centro de la casilla; una persona la pide antes (el motor la
   guarda) o después, y acierta ese tic más o menos una vez de cada ocho.
   `GIROS_CENTRO` (12) giros seguidos en el centro rechazan. Parado contra
   una pared todo pasa en el centro, así que esos no cuentan.

`sospecha` (filas sin prueba): más de 10 000 000 puntos, o más de 1 600
por segundo pasados los 20 000 (un nivel da unos 40 000 como mucho y no se
limpia en menos de ~25 s).

## El límite honesto

Un bot que pida cada giro un tic antes del centro, con eventos de verdad,
saca una prueba válida. Para eso haría falta un servidor.
