# Antitrampas de PRO DEFENDER

Cinco tablas, una por reino: `club-prodefender-(prado|dunas|glaciar|caldera|vacio)`.
Los reinos 6–10 (la «segunda era», `prueba: true` en `levels.js`) no tienen tabla:
`main.js` nunca manda su resultado, `rehace` rechaza `r ≥ 5` y el verificador no
conoce su categoría, así que no se guardan, no pagan y no hay nada que proteger.
Que solo los jueguen los administradores es una puerta de la interfaz, no de seguridad.
`puntos` = la ronda más alta superada en una partida (1–100); `tiempo` = los ms
de juego que llevaba esa partida al superarla (pasos del motor × 1000 / 60). Las
monedas salen de la fila (`monedasProdefender` en `colabtex/src/juegos/monedas.js`:
20 × el número del reino por ronda), así que la fila es lo que hay que proteger.

## La prueba

El motor (`juegos/club/prodefender/js/engine.js`) es determinista: el azar sale
de una semilla (mulberry32, `Game.rnd`) y avanza en pasos fijos de 1/60 s. Todo
lo que el jugador le hace al motor pasa por la `Grabadora` (`js/prueba.js`), que
lo anota con el paso en que ocurrió:

`{v: 1, ve, u, r, s, j, k}`: versión de la prueba, versión del motor, la cuenta,
el reino, la semilla, las jugadas y el último paso. Cada jugada es
`[paso, código, …]`: 0 colocar (torre, x, y enteros), 1 mejorar (id, camino),
2 vender (id), 3 objetivo (id, modo), 4 empezar ronda, 5 recargar (c),
6 pinchos (x, y enteros; el motor los deja en el punto del camino más cercano).

- **Recargar** es reanudar una partida guardada (c = 0) o reintentar la ronda
  perdida (c = 1, gasta uno de los tres reintentos). El motor se rehace desde la
  foto (`snapshot`) de ese instante, que tiene que ser un rato quieto (sin ronda
  ni enemigos), y la semilla cambia con el tramo. Al reanudar, el juego corta lo
  que había después de la foto guardada, así que la prueba siempre es una
  historia lineal que acaba en el estado de verdad.
- **Entre rondas el motor solo corre 3 s** (`QUIETO_MAX`, 180 pasos) después de
  la última jugada o del fin de la ronda; la pantalla sigue animándose con su
  propio reloj (`ui.vt` en `main.js`, que `render.js` usa en vez de `g.time`).
  Así una prueba nunca obliga a simular horas de espera, y una que pida más
  pasos quietos de los posibles se rechaza.
- La **cuenta va en la semilla** de cada tramo: una prueba copiada de otra
  cuenta no se rehace igual (y además `u` tiene que ser el uid de quien guarda).

Para mirar cómo jugó alguien (balance, sospechas), `colabtex/scripts/prodefender-analiza.cjs`
rehace una prueba exportada de `soloPruebas` y la cuenta ronda a ronda (vidas, oro, qué se
escapó, qué construyó). Solo con el motor de la versión de la prueba (`ve`; `--motor`).

## La verificación (`colabtex/src/juegos/solo/verifica/prodefender.js`)

Se vuelve a jugar la partida con el mismo motor y la ronda y el tiempo tienen que
salir **exactos**. Cada jugada tiene que ser posible en el estado rehecho (oro
suficiente, sitio libre, una torre que existe, una mejora permitida, un reintento
que quede); si no, se rechaza.

Rehacer cien rondas son decenas de segundos de cálculo, así que en el navegador
se hace en un **Web Worker** (`js/verificador.js`), que carga los mismos archivos
del juego con el mismo `?v=` y guarda en qué quedó cada partida: la ronda
siguiente de la misma partida solo simula lo nuevo, y una recarga sale de la foto
del rato quieto correspondiente en vez de empezar de cero. En la práctica cada
ronda se verifica en decenas de ms; la primera tras recargar la página, en unos
segundos. En Node (tests, `scripts/auditar-club.cjs`) se usa el motor cargado en
`globalThis.PD`.

- Un fallo del trabajador (no cargó, se cayó) lanza: verificaClub lo convierte en
  «No se pudo comprobar…», que no castiga.
- Una prueba de **otra versión del motor** (`ve`) se rechaza con «otra versión»,
  que tampoco castiga. **Sube `VERSION` en `prueba.js` y el `?v=pd-N` del juego,
  del trabajador y de `verifica/prodefender.js` con cualquier cambio del motor,
  los datos (`js/data/`) o las reglas de pasos**: una partida grabada con otro
  motor no se rehace igual.

`sospecha()` (filas sin prueba): más de 100 rondas, o menos de 5 s de juego por
ronda.

## El juego solo manda lo que supera el récord

`main.js` escucha las cinco tablas al abrir (`recorreTablas`) y manda
`Club.result` solo cuando una ronda supera la que ya está en la nube (o la que ya
mandó en esta visita). Por eso una partida que no bate el récord no se verifica
ni se guarda.

## Límite honesto

Un programa que juegue de verdad saca una prueba válida, y la prueba no dice
quién estaba frente al teclado. Tampoco se verifica que el reino estuviera
desbloqueado (eso vive en el navegador): jugar el Vacío sin pasar por el Prado
exige igual jugar sus rondas. La prueba de cada récord queda en `soloPruebas` y
se puede auditar después; un navegador que no sea Chromium podría redondear
alguna función matemática distinto y no cuadrar en una auditoría hecha en Node,
así que un rechazo de auditoría aquí no es, por sí solo, prueba de trampa.
