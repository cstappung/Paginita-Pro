# Antitrampas de Trigon

Una tabla:

- `club-trigon-puntos`: `puntos` es el puntaje de la partida (1 por
  triángulo puesto más el bono de las líneas, multiplicado por la racha) y
  `tiempo` los ms jugados, sin pausas, hasta la última jugada. Tope
  1 000 000.

## La prueba

`{v: 1, s, u, j, a, w, fin}`:

- `s`: la semilla (32 bits). `u`: la cuenta, que entra en la semilla de
  cada tanda de piezas (`mezcla(base, k)`), así que una prueba copiada de
  otra persona reparte otras manos y no se puede rehacer.
- `j`: las jugadas, cada una `[pieza, dx, dy, origen, Δms]`: cuál de las
  tres piezas de la mano, la traslación en la red triangular y con qué se
  jugó (`r` ratón, `t` dedo, `k` teclado, `m` mando, `x` evento
  sintético). Es el mismo registro que el motor guarda en `E.registro`.
  Un poder va como `[código, a, b, origen, Δms]` con código negativo
  (−1 martillo, −2 girar, −3 cambiar mano, −4 bomba, −5 segunda
  oportunidad) y `a`, `b` = casilla, pieza o punto de la red.
- `a` / `w`: lo jugado según `performance.now` y según `Date.now`.
- `fin`: si la partida terminó porque ninguna pieza cabía.

## Qué comprueba `solo/verifica/trigon.js`

1. Que cada pieza quepa donde se soltó en el tablero rehecho con el mismo
   motor (`juegos/club/trigon/motor.js`), y que el puntaje y el tiempo
   salgan exactos.
2. Que cada poder usado se haya ganado antes en esa misma partida: el azar
   de los poderes sale del mismo chorro de la semilla (`mezcla(base ^
   0x4D41, jugadas)`), así que el motor rehecho sabe cuántos había.
3. Que no haya jugadas `x` ni jugadas sin origen y tiempo.
4. Que los dos relojes coincidan (`dosRelojes`) y que las jugadas no sumen
   más tiempo del jugado.
5. La mano: se rechaza una racha de 15 piezas seguidas a menos de 120 ms, o
   50 piezas seguidas que duren en total menos de 10 s. Soltar una pieza es
   arrastrarla (o elegirla, moverla y confirmar con teclado): ninguna
   persona baja de unos 200 ms por pieza de forma sostenida.

`sospecha` solo puede mirar el tope: la racha multiplica el bono sin techo
fijo, así que no hay un tiempo mínimo creíble por puntaje.

## El límite honesto

Un programa que juegue a ritmo de persona, con eventos de verdad, saca una
prueba válida. Solo un servidor cierra eso.
