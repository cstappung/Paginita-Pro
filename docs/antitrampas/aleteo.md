# Antitrampas de ALETEO

Una tabla, `club-aleteo-vuelo`: `puntos` son los tubos pasados y `tiempo`
lo que duró el vuelo en tiempo de juego (`msDe(n)`, ticks de 1/60 s).

## La prueba

`{v: 1, s, u, f, n, r}`:

- `s`: la semilla del cielo (32 bits). `u`: la cuenta, que entra en la
  semilla (`mezcla(s, hashTexto(u))`), así que una prueba copiada de otra
  persona no rehace el mismo cielo.
- `f`: los aleteos, «origen + Δtick en base 36» separados por comas. El
  primero es el del tick 0, el que arranca el vuelo. Origen: `r` ratón o
  lápiz, `t` dedo, `k` teclado, `m` mando, `x` evento sintético.
- `n`: el tick del choque. `r`: los ms de reloj que duró.

## Qué comprueba `solo/verifica/aleteo.js`

1. Que el tiempo declarado sea exactamente `msDe(n)`.
2. Que el reloj real no vaya más rápido que el del juego (`r ≥ 0,9·msDe(n)`).
3. Que no haya aleteos `x`.
4. Que el vuelo rehecho con el mismo motor (`juegos/club/aleteo/motor.js`)
   choque exactamente en el tick `n`, sin aleteos sobrantes, y haya pasado
   exactamente los tubos declarados.

`sospecha` marca una fila cuyo tiempo esté por debajo de lo que tardan los
tubos en llegar (`ticksMinimos(p)`): avanzan a velocidad fija.

## El límite honesto

Flappy Bird es justo el juego que un bot juega perfecto: el de
`tests/aleteo.test.cjs` vuela para siempre con una regla de una línea. Un
bot que mande eventos de verdad saca una prueba válida. Lo que la prueba sí
cierra es inventar el puntaje, acelerar el reloj y copiar vuelos ajenos.

## La mano (misma altura) y la velocidad

En cada aleteo se mide la distancia del pájaro al centro del hueco que
viene. Rechaza si 20 aleteos seguidos tienen una desviación menor de 6 px,
o si el último aleteo antes de 15 tubos seguidos la tiene menor de 4 px.
Las personas no bajan de 12 y 8 px; los bots, de 5 y 3,3. Desde `aleteo-3`
la prueba trae `a`/`w` (`dosRelojes`).
