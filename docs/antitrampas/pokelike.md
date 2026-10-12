# Antitrampas de Pokelike

Dos tablas:

- `club-pokelike-puntos`: `puntos` es el puntaje de la run (`M.puntaje`:
  100 por medalla, 150 por miembro del Alto Mando, 500 por el Campeón y, en
  la Ruta Infinita, 50 + 10 × dificultad por victoria) y `tiempo` los ms
  jugados con la pestaña a la vista. Tope 1 000 000.
- `club-pokelike-pokedex`: `puntos` son las especies distintas que pasaron
  por el equipo **en esa run** (`M.atrapados`). La Pokédex del perfil junta
  muchas partidas y no se puede rehacer desde una sola prueba; esta sí.
  Tope 151.

## La prueba

`{v: 1, s, u, i, d, a, w}`:

- `s`: la semilla que eligió el juego (32 bits). `u`: la cuenta, que entra
  en la semilla real de la run (`mezcla(s, hashTexto(u))` en `nuevaRun`),
  así que una prueba copiada de otra cuenta no se rehace.
- `i`: el inicial (1, 4 o 7).
- `d`: las decisiones, `run.log` unido por espacios. Cada acción de la
  pantalla pasa por las versiones registradas del motor (`acciones`) y deja
  un token: `e<id>` entrar a un nodo, `a` turno automático, `x<n>` turno con
  el movimiento n, `t` cerrar el combate, `c<i|->[.<suelta>]` captura, `s`
  salir del centro, `o<i><+|->` mover en el equipo, `n` gimnasio siguiente,
  `i` empezar la Ruta Infinita.
- `a`, `w`: los ms jugados según `performance.now` y `Date.now`
  (`dosRelojes`).

## Qué se comprueba

`colabtex/src/juegos/solo/verifica/pokelike.js` rehace la run con el MISMO
`juegos/club/pokelike/motor.js` (`M.rehace`): cada token tiene que ser una
decisión posible en ese momento y quedar registrado igual. Después:

- el puntaje (o las especies) de la run rehecha tiene que ser exactamente
  el de la fila;
- `tiempo` tiene que ser el que marcó el reloj del juego (±1 s), y los dos
  relojes tienen que coincidir;
- no puede haber más de un turno cada 100 ms (un turno animado no baja de
  unos 250 ms ni a ×4).

El modo prueba (solo en local) no deja decisiones registradas, así que una
run tocada con sus atajos no se puede rehacer. La pantalla, además, no manda
runs `debug` ni de otra cuenta.

## El límite honesto

El combate es casi todo automático: un programa que juegue la run eligiendo
caminos y capturas saca una prueba válida. Lo que queda fuera es inventar el
puntaje, el equipo, las especies o el tiempo, y editar la run guardada en el
navegador.

Tests: `colabtex/tests/antitrampas-pokelike.test.cjs` y los de
`pokelike.test.cjs` que rehacen runs al azar.
