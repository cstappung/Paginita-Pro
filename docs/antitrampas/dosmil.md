# Antitrampas del 2048

Dos tablas:

- `club-dosmil-puntos`: `puntos` es el puntaje de la partida (la suma de
  todas las fichas juntadas) y `tiempo` los ms jugados, sin pausas, hasta
  la última jugada. Tope 4 000 000.
- `club-dosmil-ficha`: `puntos` es la ficha más alta (una potencia de 2
  entre 4 y 262 144) y `tiempo` el ms en que se llegó a ella por primera
  vez.

## La prueba

`{v: 1, s, u, f, a, w, fin}`:

- `s`: la semilla (32 bits). `u`: la cuenta, que entra en la semilla de
  cada ficha nueva (`mezcla(base, k)`), así que una prueba copiada de otra
  persona no rehace el mismo tablero.
- `f`: las jugadas, «origen + dirección (0–3) + Δms en base 36». Origen:
  `r` ratón, `t` dedo, `k` teclado, `m` mando, `x` evento sintético.
- `a` / `w`: lo jugado según `performance.now` y según `Date.now`.
- `fin`: si la partida terminó sin jugadas posibles.

## Qué comprueba `solo/verifica/dosmil.js`

1. Que cada jugada mueva algo en el tablero rehecho con el mismo motor
   (`juegos/club/dosmil/motor.js`), y que el puntaje, la ficha y sus
   tiempos salgan exactos.
2. Que no haya jugadas `x`.
3. Que los dos relojes coincidan (`dosRelojes`).
4. La mano: se rechaza una racha de 30 jugadas seguidas a menos de 40 ms, o
   100 jugadas seguidas que duren en total menos de 5 s. Una persona que
   machaca dos teclas no baja de unos 80 ms y piensa de vez en cuando.

## El límite honesto

Un programa que juegue a ritmo de persona, con eventos de verdad, saca una
prueba válida. Solo un servidor cierra eso.
