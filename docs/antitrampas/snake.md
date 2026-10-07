# Antitrampas: Snake Club

Categorías `club-snake-(classic|arcade|portals|reloj|espejo|laberinto)-(chico|mediano|grande|gigante)`,
compiten los **puntos** (el tiempo desempata). El zen no tiene tabla.
Verificador: `colabtex/src/juegos/solo/verifica/snake.js` (`PRUEBA = 1`).
Pruebas: `colabtex/tests/antitrampas-snake.test.cjs`.

## Vías encontradas

| Vía | Cómo | Qué la para |
|---|---|---|
| `Club.result` a mano | `Club.result({categoria:'club-snake-arcade-gigante',puntos:99999,tiempo:5000})` | sin prueba se rechaza; con una inventada, la repetición no da esos puntos |
| Editar `localStorage` | `jg.club.pendientes.*`, `snake-club-v1.records` | re-verificación al cargar (común); `records` es solo la marca local |
| Cámara lenta | envolver `requestAnimationFrame`/`performance.now` para que el juego reciba menos tiempo: la serpiente va lenta y la partida rehecha sale igual de válida | reloj de juego contra `Date.now` |
| Teclas por script | `dispatchEvent(new KeyboardEvent('keydown',…))` | `isTrusted` falso en la prueba |
| Bot que juega | lee el estado y gira perfecto | reflejos imposibles hacia la fruta nueva |
| Elegir semilla / velocidad | — | la semilla da igual (hay que jugarla); la velocidad va en la prueba y multiplica los puntos |
| Copiar la prueba de otro | `soloPruebas` se lee con sesión | empata; ver «cambios pedidos» |

No había ganchos de depuración en `window`.

## El motor puro (`juegos/club/snake/motor.js`)

La lógica estaba mezclada con el dibujo en `game.js`. Se extrajo a un UMD
(`SnakeMotor`) que cargan el juego (script plano, `?v=snake-prueba-1`) y el
verificador (esbuild). Dos cambios lo hacen repetible:

- **Todo el azar que decide la partida sale de una semilla** (mulberry32):
  dónde sale cada fruta, qué poder, los bloques del laberinto, los portales
  que se mueven. Las chispas siguen con `Math.random`.
- **El tiempo avanza por tics, no por fotogramas.** Cada tic suma su
  intervalo a `gameTime` y los vencimientos (poderes, fruta dorada,
  contrarreloj) se miran en el tic. Antes se miraban por fotograma con el dt
  real: la diferencia no se nota jugando y es lo que permite rehacer la
  partida solo con saber en qué tic entró cada giro. El contrarreloj se
  muestra continuo (`timeLeft − acumulado`) pero se acaba en un tic.

`freeCell` recorre el tablero en el mismo orden que antes pero con un `Set`:
rehacer una partida larga en el gigante no cuesta millones de comparaciones.
Lo que el dibujo necesita saber de un tic (comió, portal, escudo…) sale en
`m.ev`, que `game.js` vacía tras cada tic. `game.test.cjs` y
`audio.test.cjs` se adaptaron (el estado vive en `m`; el reloj avanza de a
tic).

## La prueba

```
{v: 1, m: modo, t: tamaño, r: 'chill'|'normal'|'fast', s: semilla uint32,
 n: tics jugados, g: giros, w: ms de pared jugando, p: pausas, u?: uid}
```

`g` es texto: por cada giro **que entró en la cola**, los tics desde el
anterior en base 36 (minúsculas), la tecla (`U D L R`, tal como se pulsó: en
el espejo el motor la invierte) y cómo llegó: nada = teclado, `T` = toque
(botón o deslizar), `M` = mando (tecla de `mando.js` con un mando
conectado), `X` = evento sintético sin mando. «`0R3UT`» = derecha con el
teclado en el tic 0 y arriba con el dedo en el 3. Una partida de 20 minutos
en el gigante son unos pocos miles de giros: decenas de KB, bajo el tope de
200 000 caracteres.

`w` suma, fotograma a fotograma, los ms de `Date.now` mientras se juega, con
tope de 100 ms por fotograma (una pestaña dormida o un salto del reloj no
cuentan).

## Qué comprueba `verifica`

1. Forma: categoría (zen fuera), modo y tamaño de la prueba iguales a la
   categoría, velocidad conocida, semilla uint32, `1 ≤ n ≤ 2 000 000`, giros
   legibles.
2. **Repetición** tic a tic con el motor: cada giro tiene que entrar en la
   cola en su tic (nada de medias vueltas, dos por tic como mucho), la
   partida tiene que **terminar exactamente en el tic `n`**, sin giros
   después.
3. **Puntos** iguales a los de la repetición; **tiempo** = `round(gameTime·1000)`
   (±1 ms).
4. **Cámara lenta**: con `w ≥ 20 s`, el reloj de juego tiene que ser al menos
   el **50 %** del de pared. El juego recorta cada fotograma a 60 ms y la
   pared a 100, así que un aparato honesto, por lento que sea, da ≥ 60 %.
5. **Eventos sintéticos**: un giro con `X` rechaza.
6. **Reflejos de bot**: la fruta nueva aparece al azar en el tic en que se
   come la anterior. Con el tic siguiente a menos de **100 ms** (ritmo normal
   acelerado o rápido), girar en ese mismo hueco es reaccionar en < 100 ms
   (la reacción visual humana es de 150–250 ms) o casualidad: un giro que ya
   estaba pensado. La casualidad se mide en la propia partida (fracción de
   tics con algún giro). Se rechaza si, con **25 o más** frutas así, la
   fracción con giro inmediato es ≥ **0,5**, ≥ **3 veces** la casualidad y
   **0,3** por encima de ella. Simulado: un bot que va derecho a cada fruta da
   0,87–1,00 contra una casualidad de 0,12–0,32; un robot con 150–400 ms de
   reacción da 0,00–0,11; uno «nervioso» que gira sin motivo tiene la
   casualidad alta y no cae.

**Ritmo mínimo / tiempo total**: en Snake no hace falta. El ritmo lo pone el
juego (un tic cada 55–290 ms) y la prueba se rehace con ese ritmo: un bot no
puede ir más rápido que una persona, solo jugar mejor. Tampoco tiene sentido
un tope de giros por segundo (la cola admite dos por tic) ni el tiempo de
reacción del primer giro (con las flechas táctiles, empezar y girar es el
mismo toque).

**Regularidad (CV)**: no se usa. Los intervalos entre giros dependen del
camino, no del pulso de quien juega, así que un bot no sale «a metrónomo».

## `sospecha` (filas sin prueba)

Snake no tiene récords mundiales que sirvan, así que los topes son los del
propio juego:

- puntos que no salen jugando: clásico, portales y contrarreloj van de a 10;
  espejo y laberinto de a 5; arcade, pares;
- más de lo que da llenar el tablero entero (por fruta, a ritmo rápido:
  30 clásico/portales, 45 espejo, 48 contrarreloj, 183 arcade, 30 + premio de
  nivel en laberinto);
- menos tiempo que el mínimo de frutas necesarias × 55 ms (× 2 tics por
  fruta si son 20 o más: la fruta siguiente sale a ~(ancho+alto)/3 casillas).

## Límites honestos

- **Un bot con reflejos humanos** (espera 200 ms antes de reaccionar a cada
  fruta) y teclas confiables pasa. Lo que gana es no equivocarse.
- **Cámara lenta suave**: frenar el reloj hasta ~1,6× no se distingue de un
  aparato lento. Reescribir también `Date.now` deja la comparación sin
  referencia.
- **Mentir el origen** reescribiendo el cliente; la marca `X` caza al que usa
  `dispatchEvent` sin tocar el juego.
- **Pausar a cada rato** (el overlay deja ver los bordes del tablero): `p`
  queda en la prueba para auditar, pero no se rechaza: no está claro que sea
  trampa ni hay un umbral sin falsos positivos.

## Cambios compartidos pedidos

1. **Atar la prueba a la cuenta**: lo mismo que en `minas.md` (la prueba lleva
   `u`; que `verificaClub` reciba el uid y rechace `prueba.u !== uid`).
2. Añadir `tests/antitrampas-snake.test.cjs` a `test:juegos`.
3. Subir el `?v=` del marco en `solo/club.js` (el juego ahora carga
   `motor.js` antes de `game.js`; los dos llevan `?v=snake-prueba-1`).

## La mano (camino más corto)

Por cada fruta se compara lo que tardó con la distancia de Manhattan (con
vuelta en portales y laberinto): llegar sin un tic de más es ir por el
camino más corto. Rechaza 12 frutas seguidas así, o el 80 % de 20 o más.
Las personas de la tabla no pasan de 5 seguidas ni del 38 %. Portales,
cambio de nivel y espejo cortan la racha.
