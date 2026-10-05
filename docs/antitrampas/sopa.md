# Antitrampas — Sopa de letras

Categorías: `club-sopa-(facil|medio|dificil)-(8|12|15)` (puntos fijos = las
palabras, compite el tiempo) y `club-sopa-racha` (puntos = días de racha,
tiempo = el de la diaria de ese día). Verificador:
`colabtex/src/juegos/solo/verifica/sopa.js` (`PRUEBA = 1`). Pruebas:
`colabtex/tests/antitrampas-sopa.test.cjs`.

## Vías encontradas

1. **`Club.result` desde la consola** del iframe, con cualquier tiempo.
2. **Editar `localStorage`**: `sopa.diaria.*` (palabras ya encontradas y
   su tiempo) para «terminar» la diaria sin jugarla; `sopa.racha.*` para
   inflar la racha.
3. **La sopa se puede calcular**: la diaria sale de la fecha
   (`SopaMotor.sopaDiaria(hoy)`), la libre de una semilla que elige el
   cliente. Un script lee las posiciones y las marca.
4. **Bots** que marcan con eventos: con `dispatchEvent` (sintéticos), con
   la pestaña oculta (el reloj del juego no corre: filas de 1 ms en las
   tablas), o con eventos de verdad (CDP, xdotool). En las tablas reales hay
   6 palabras en 0,18 s y en 0,93 s, 10 en 2,5 s y 13 en 4,5 s, mientras el
   siguiente jugador tarda 4–35 s.

## La prueba

`motor.js` (UMD, compartido por la pantalla y el verificador):

```js
{v: 1, m: 'd', f: '2026-10-05', j: [...]}                       // diaria
{v: 1, m: 'l', s: 123456, t: 'animales', d: 'medio', n: 12, j: [...]}  // libre
```

`j` es plano, seis números por **palabra encontrada**:
`[inicio, fin, Δt, dur, mov, f]` — las celdas de los extremos del arrastre,
los ms de reloj de juego desde la palabra anterior, la duración del gesto
(pointerdown → pointerup, ms reales de `performance.now`), cuántos
`pointermove` hubo en medio, y banderas `f`: 1 = algún evento del gesto con
`isTrusted` falso sin un mando conectado; 2 = eventos de
`juegos/audio/mando.js` (`__mando`) con un mando conectado
(`navigator.getGamepads()`); 4 = la pestaña estaba oculta. Las selecciones
que no forman palabra no van. Una sopa de 15×15 son ~80 números.

El reloj ya no depende solo del intervalo de 250 ms: `actualiza()` lo lleva
al instante exacto (`performance.now`) en cada palabra, así que el tiempo de
la última palabra es el tiempo declarado. El reloj sigue sin correr con la
pestaña oculta (es lo que se ve en pantalla); por eso jugar oculto deja
Δt = 0 y la bandera 4.

La diaria a medias guarda `j` en su progreso (`sopa.diaria`), así una
recarga no pierde la prueba. **Un progreso de la versión anterior** (sin
`j`, o con `j` que no rehace justo las palabras guardadas) no se puede
probar: la diaria se termina y suma racha, pero **no se manda** a la
clasificación, y la pantalla lo dice. Así no hay rechazo ni aviso de
sospecha para nadie honesto el día del cambio.

## Qué verifica

1. La prueba es del modo de la categoría (diaria ↔ racha, libre ↔ su
   dificultad y tamaño).
2. **Diaria**: la fecha es hoy o ayer en Chile (ayer, por quien la termina
   pasada la medianoche) contra `ctx.ahora` o, si no viene, `Date.now()`.
   Racha ≤ días desde el lanzamiento (2026-10-01, `git log` de la carpeta).
3. Rehace la partida con `SopaMotor.rehace`: cada `[inicio, fin]` pasa por
   `linea` y `palabraEn` (las mismas de la pantalla) y tiene que marcar una
   palabra pendiente; al final, todas encontradas; puntos = palabras.
4. Tiempo declarado ≥ instante de la última palabra.
5. Capa anti-bot (de fuerte a débil):

| Señal | Umbral | Por qué |
|---|---|---|
| Evento sintético sin mando | cualquiera rechaza | `dispatchEvent` da `isTrusted` falso; el mando está exceptuado |
| Pestaña oculta | 2 palabras o más | nadie arrastra sobre una pestaña que no ve; una sola podría ser un `pointerup` al cambiar de pestaña |
| Tiempo total | < 450 ms por palabra | 8×8 en 2,7 s, 12×12 en 4,5 s, 15×15 en 5,9 s. El más rápido que parece humano en las tablas hizo 6 en 4 s; los bots, 0,18–0,93 s, 10 en 2,5, 13 en 4,5 |
| Primera palabra | < 150 ms desde que aparece | tiempo de reacción; además hay que encontrarla y arrastrarla |
| Ráfaga | 4 palabras en < 600 ms | tres arrastres completos de 200 ms sin pensar nada |
| Arrastres «de un salto» | ≥ 75 % (con ≥ 4 palabras) | dur < 40 ms o < 2 pointermove; una mano que cruza 4+ letras tarda ≥ 80 ms y el navegador da un pointermove por cuadro |
| Débil: la mitad de un salto | ≥ 50 % | solo junto con otra débil |
| Débil: metrónomo | CV de los intervalos < 0,15 con ≥ 8 palabras | una persona tarda 1 s en una y 20 en otra |

Dos señales débiles juntas rechazan; una sola, no.

`sospecha()` (filas guardadas sin prueba): libres con menos de 450 ms por
palabra; racha mayor que los días desde el lanzamiento, o la diaria en
menos de 4,5 s.

## Comprobado

- Node: robots honestos en las nueve libres (lentos, normales, rápidos
  pero humanos: 900 ms y ~500 ms por palabra; la de 6 en 4 s) y la diaria
  de hoy y de ayer pasan; cada trampa se rechaza (sin prueba, tiempo
  recortado, otra semilla, tamaño o dificultad, la diaria por una libre,
  palabras de menos o repetidas, celdas inventadas, fecha vieja o futura,
  racha imposible, las cinco marcas de bot de las tablas, eventos
  sintéticos, pestaña oculta, arrastres de un salto, metrónomo con
  arrastres bruscos, primera palabra antes de reaccionar), y cada señal
  débil sola pasa, igual que un mando.
- Chromium (Playwright, la página dentro de un marco que hace de Juegos y
  corre el verificador): la diaria con una selección fallida, palabras
  arrastradas en los dos sentidos y una recarga a mitad, y una libre de
  8×8, pasan. Una diaria a medias de la versión anterior se termina, suma
  racha y no manda nada.

## Qué no se puede detectar (límite honesto)

- Un bot que conoce la sopa (se calcula de la fecha o de la semilla) y la
  marca con **eventos de verdad** (CDP, un driver del sistema), con
  arrastres de varios cuadros y pausas irregulares de persona. Lo probé
  con Playwright: sus arrastres de 6 pasos duran ~100 ms y pasan. Solo lo
  frena el piso de tiempo, que tiene que dejar pasar a los rápidos.
- Una persona que resolvió la diaria en otro navegador (o en modo
  invitado) y la repite rápido en su cuenta: es una diaria «memorizada».
  Para la racha el tiempo solo desempata.
- Un cliente reescrito que se salta la verificación (capa 3 del plan).

## Cambios compartidos pedidos

1. **`ctx.ahora` para la fecha de la diaria.** `verifica(dato, prueba,
   ctx)` acepta un tercer argumento opcional `{ahora}` (ms). Hoy
   `verificaClub` no lo pasa y se usa `Date.now()`, que es lo correcto en
   vivo. Pero:
   - `scripts/auditar-club.cjs` debería pasar `{ahora: p.at}` (el `at` de
     `soloPruebas`, la hora del servidor al escribir la prueba): si no,
     **toda prueba de racha de más de un día se lista como «no es la sopa
     diaria de hoy»** al auditar.
   - `solo/club.js`, al re-verificar lo pendiente en `localStorage`,
     debería guardar la hora del resultado y pasarla. Hoy, una diaria que
     quedó pendiente (sin red) y se re-verifica al día siguiente se
     rechaza y deja un aviso en `sospechas` (falso positivo raro: hace
     falta no tener red justo al terminarla). La racha no se pierde: la
     cuenta la lleva el nodo central y la diaria siguiente la sube.
   Lo más simple: que `verificaClub(juego, dato, prueba, ctx)` reenvíe un
   `ctx` y cada llamador ponga su `ahora`.
2. **Subir `club-N` en `solo/club.js`** (el `?v=` del iframe), para que el
   `index.html` nuevo (con `motor.js?v=sopa-2` y `game.js?v=sopa-2`) no
   quede en la caché y siga mandando resultados sin prueba, que ahora se
   rechazan.
3. **Racha**: según lo acordado, la cifra la acota el nodo central
   `rachasClub/<uid>/<cat>` (`{dia, n}`, sube de a uno por día de Chile;
   `guardaClub` recorta la fila a ese `n`). El verificador solo prueba
   que la diaria de hoy se resolvió de verdad y que la racha no supere los
   días desde el lanzamiento. Del nodo central no necesito nada más.
4. Añadir `tests/antitrampas-sopa.test.cjs` (y `tests/sopa.test.cjs`, que
   tampoco está) a `test:juegos` en `colabtex/package.json`.
