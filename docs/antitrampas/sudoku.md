# Antitrampas — Sudoku Arcade

Categorías: `club-sudoku-(facil|medio|dificil|experto)` (puntos fijos 1,
compite el tiempo; cada pista suma 30 s), `club-sudoku-arcade` (puntos) y
`club-sudoku-racha` (días; tiempo = el del diario de ese día). Verificador:
`colabtex/src/juegos/solo/verifica/sudoku.js` (`PRUEBA = 1`). Pruebas:
`colabtex/tests/antitrampas-sudoku.test.cjs`.

## Vías encontradas

1. **`Club.result` desde la consola** del iframe: cualquier tiempo o
   puntaje de arcade.
2. **Editar `localStorage`**: `sudoku.clasico.*` trae la solución
   (`sol`) y el tablero; basta escribir el tablero casi resuelto con
   `ms: 0` y poner la última cifra. Igual con `sudoku.diario.*`, y la
   racha en `sudoku.racha.*`.
3. **El sudoku se puede calcular o leer**: el diario sale de la fecha, el
   clásico y el arcade de una semilla, y la solución está en memoria (y en
   `localStorage`). Un script la escribe.
4. **Reloj**: con la pestaña oculta no corre; un script que juega oculto
   termina en 1 ms.
5. **Bots** que juegan una partida válida a velocidad inhumana: en las
   tablas hay un experto en 90 s y un arcade de 30 266 puntos en 105 s
   (el siguiente tarda 584 s).

## La prueba

`motor.js` (UMD, compartido por la pantalla y el verificador):

```js
{v: 1, m: 'd', f: '2026-10-05', j: [...]}          // diario
{v: 1, m: 'c', s: 3141592653, d: 'experto', j: [...]} // clásico
{v: 1, m: 'a', s: 2718281828, j: [...]}              // arcade
```

`j` es plano, cinco números por jugada: `[celda, valor, Δt, g, f]`.

- **Diario y clásico**: cada cambio de una celda con el valor que le
  quedó (0 = borrada; también lo que deshace «deshacer»). Una pista es
  `10 + dígito`, y su Δt ya trae los 30 s. Las notas no van.
- **Arcade**: cada número intentado, bien o mal: el motor sabe cuál era
  el bueno, y de ahí salen vidas, combo y puntos.
- `Δt`: ms de reloj de juego desde la jugada anterior. El reloj se lleva
  al instante exacto (`performance.now`) en cada jugada (`actualiza()`),
  no al último tic de 250 ms, así que la jugada final coincide con el
  tiempo declarado.
- `g`: ms desde la **entrada anterior** (el clic en la celda, una flecha,
  otra tecla, un botón) hasta la que hizo la jugada.
- `f`: 1 = el evento tenía `isTrusted` falso sin mando; 2 = de
  `juegos/audio/mando.js` con un mando conectado (sus teclas y clics son
  sintéticos con `__mando`; los botones LB/RB/A llaman funciones sin
  evento, y cuentan como mando si hay uno conectado); 4 = pestaña oculta.

Un sudoku con algunas correcciones son ~60 jugadas, ~1,5 KB.

El clásico y el arcade guardan ahora su semilla (`p.semilla`, también en
`sudoku.clasico.s`), y el progreso del diario y del clásico guarda `j`
(también viaja en el blob de la cuenta, que adopta el diario de otro
dispositivo). **Una partida de la versión anterior** (sin semilla o sin
`j`, o con un `j` que no rehace exactamente el tablero y las pistas
guardados) se termina igual, y en el diario suma racha, pero **no se
manda** a la clasificación; la pantalla final lo dice.

En Arcade el bono de tiempo se calcula ahora con el **tiempo entero** que
va al ranking (`bonoTiempo(tiempo)`), no con los ms con decimales: así el
verificador da exactamente los mismos puntos (`puntosFinalArcade`).

## Qué verifica

1. La prueba es del modo y la dificultad de la categoría.
2. **Diario**: la fecha es hoy o ayer en Chile (contra `ctx.ahora` o
   `Date.now()`); la racha no supera los días desde el lanzamiento
   (2026-10-04, `git log` de la carpeta).
3. Rehace con `SudokuMotor.rehace`: regenera el sudoku de la fecha o de la
   semilla; ninguna jugada toca una pista fija ni una puesta por pista;
   cada pista es el dígito de la solución, solo en el clásico, y su Δt
   trae los 30 s. Diario y clásico tienen que terminar **resueltos**.
4. **Arcade**: tiene que haber terminado (resuelto o sin vidas), sin
   jugadas después; los puntos se recalculan (50 por acierto, unidades,
   triple, combo hasta ×4; al ganar, bono de tiempo con el tiempo
   declarado y 500 por vida) y tienen que dar **exactamente** lo declarado.
5. Tiempo declarado ≥ instante de la última jugada (recortarlo para más
   bono no sirve).
6. Capa anti-bot:

| Señal | Umbral | Por qué |
|---|---|---|
| Evento sintético sin mando | cualquiera rechaza | `dispatchEvent`/`el.click()` dan `isTrusted` falso |
| Pestaña oculta | 2 jugadas o más | nadie juega una pestaña que no ve |
| Primera jugada | < 150 ms desde que aparece el tablero | tiempo de reacción |
| Piso de tiempo pensando (sin los 30 s de cada pista), en proporción a las celdas que resolvió la persona | fácil 20 s, medio 30, difícil 45, experto 60 (sudoku entero) | los mejores tardan ~1 min en un fácil y varios en un difícil; solo escribir 45–55 cifras con ratón son 20 s |
| Ráfaga | 10 celdas tomando su valor **final** en < 1,2 s | 120 ms por celda con su clic y su número. Se miran valores finales, no pulsaciones: dejar una tecla apretada pone y quita cada 33 ms y no debe contar |
| Metrónomo | CV de los intervalos < 0,05 con ≥ 20 | una persona tiene CV ≥ 0,7 |
| Celda y número «a la vez» | ≥ 90 % de las jugadas con g < 40 ms (con ≥ 15) | elegir la celda y escribir son dos gestos (≥ 100 ms); un rollover de teclas da 10–30 ms de vez en cuando, no siempre |
| Débil: casi metrónomo | CV < 0,15 | solo junto con otra débil |
| Débil: muchas «a la vez» | ≥ 60 % | solo junto con otra débil |

`sospecha()` (filas sin prueba, para **revisar a mano**: la auditoría
solo lista): el doble de los pisos (fácil 40 s, medio y diario 60,
difícil 90, experto 120), un arcade por encima del máximo teórico
(4 × (50·64 + 150·27 + 300·9) + 3000 + 1500 = 44 300) o de 20 000 puntos
o más en menos de 150 s, y la racha contra el lanzamiento. Las dos marcas
de bot de las tablas (experto 90 s, arcade 30 266 en 105 s) caen ahí.

## Comprobado

- Node: robots honestos (lentos, con errores y correcciones, con pistas,
  rápidos pero humanos: fácil a 0,6 s por celda, experto en ~95 s) pasan;
  cada trampa se rechaza (sin prueba, tiempo recortado, otra semilla, otra
  dificultad, otro modo, celda que falta, escribir sobre una pista, pista
  sin sus 30 s, pista en el diario, puntos inflados, arcade sin terminar o
  con jugadas después del final, solucionador instantáneo, ráfaga,
  eventos sintéticos, pestaña oculta, celda y número a la vez, metrónomo,
  dos señales débiles), y cada señal débil sola pasa.
- Chromium (Playwright, la página del juego dentro de un marco que hace
  de Juegos y corre el verificador): diario con un error, un borrar, un
  deshacer y una recarga a mitad; clásico fácil con dos pistas; arcade con
  un error y sus puntos (30 271) exactos: pasan con pausas humanas. Los
  mismos con Playwright tecleando al instante tras el clic se rechazan
  («a la vez»), y un bot de consola con `el.click()` a paso humano se
  rechaza por eventos sintéticos. Una partida guardada por la versión
  anterior termina sin mandar resultado y lo dice.

## Qué no se puede detectar (límite honesto)

- Un bot que resuelve (la solución está en memoria) y escribe con
  **eventos de verdad**, con una pausa entre elegir la celda y escribir y
  ritmo irregular. Los pisos de tiempo son holgados a propósito: el
  experto en 90 s solo cae si su forma lo delata; si no, queda para la
  auditoría (`sospecha`).
- Un diario «memorizado»: resuelto en otro navegador y repetido rápido en
  la cuenta.
- Un cliente reescrito que se salta la verificación (capa 3 del plan).

## Cambios compartidos pedidos

1. **`ctx.ahora` para la fecha del diario**, igual que en la Sopa
   (`docs/antitrampas/sopa.md`): que `verificaClub` reenvíe un `ctx`, que
   `auditar-club.cjs` pase `{ahora: p.at}` de `soloPruebas` (si no, toda
   prueba de racha de más de un día sale como «no es el sudoku diario de
   hoy») y que lo pendiente en `localStorage` guarde su hora para
   re-verificarse con ella.
2. **Subir `club-N` en `solo/club.js`** para que el `index.html` nuevo
   (`motor.js?v=sudoku-2`, `game.js?v=sudoku-3`) no quede en la caché.
3. **Racha**: la acota el nodo central `rachasClub` (acordado); el
   verificador solo prueba el diario de hoy resuelto de verdad y la racha
   contra el lanzamiento.
4. Añadir `tests/antitrampas-sudoku.test.cjs` a `test:juegos`.
5. Coste: verificar un clásico o un arcade regenera el sudoku de su
   semilla (`generar`, hasta ~0,5 s en experto). Pasa una vez por
   resultado y otra al re-verificar lo pendiente; no hace falta nada, pero
   que se sepa.
