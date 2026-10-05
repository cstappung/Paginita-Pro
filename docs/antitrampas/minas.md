# Antitrampas: Mina Club

Categorías `club-minas-(easy|medium|hard)`, puntos fijos 1, compite el
**tiempo** (ms de juego desde el primer clic, sin las pausas). Verificador:
`colabtex/src/juegos/solo/verifica/minas.js` (`PRUEBA = 1`). Pruebas:
`colabtex/tests/antitrampas-minas.test.cjs`.

## Vías encontradas

| Vía | Cómo | Qué la para |
|---|---|---|
| `Club.result` a mano | `Club.result({categoria:'club-minas-hard',puntos:1,tiempo:29})` | sin prueba se rechaza; con una inventada, la repetición no gana o no cuadra |
| Editar `localStorage` | `jg.club.pendientes.*` o `mina-best-*` | lo pendiente se re-verifica al cargar (común); `mina-best` es solo la marca local |
| Frenar el reloj | reescribir `performance.now` (el marcador y la prueba usan ese reloj) | se compara con `Date.now` jugada a jugada |
| Pensar en pausa | borrar la pantalla de pausa con el inspector, pausa-clic-pausa | demasiadas pausas por jugada |
| Bot por eventos | `celda.click()`, `dispatchEvent` | `isTrusted` falso en la prueba |
| Bot «de verdad» (CDP, autoclicker) | clics confiables a ritmo de máquina | ritmo mínimo, ráfagas, reacción, metrónomo + gestos instantáneos |
| Elegir la semilla | probar semillas hasta un tablero fácil | **no se puede impedir** (ver límites) |
| Copiar la prueba de otro | `soloPruebas` se lee con sesión | empata, no mejora; ver «cambios pedidos» |

No había ganchos de depuración (`window.__…`): el juego es un IIFE y no expone
su estado.

Datos reales que motivaron la capa anti-bot: una cuenta con **9 ms** en fácil,
**15 ms** en medio y **29 ms** en difícil. Las tres caen en `verifica` (ritmo y
reacción) y en `sospecha` (suelos).

## La prueba

El reparto de minas salía de `Math.random` en el primer clic. Ahora sale de una
semilla (`Mina.azar`, mulberry32 en `engine.js`; `Mina.nuevaSemilla` la saca
de `crypto.getRandomValues`). El juego anota cada jugada **que cambió algo**
(las que no hacen nada no se anotan; la verificación exige que cada una haga
algo):

```
{v: 1, n: 'easy'|'medium'|'hard', s: semilla uint32, u?: uid,
 e: [código, msJuego, msPared, origen, movs, msGesto,  …]}
```

- `código`: casilla·2, +1 si es bandera (un acorde es abrir un número ya
  abierto); `-1` marca una pausa.
- `msJuego`: ms del reloj del marcador desde la entrada anterior (0 antes del
  primer clic). La suma es exactamente el tiempo que se declara: la jugada y el
  reloj usan el mismo `performance.now()`.
- `msPared`: ms de `Date.now()` desde la entrada anterior, tomados en el mismo
  instante.
- `origen`: bits 1 = evento sintético (isTrusted falso y sin mando), 2 = mando
  (tecla de `mando.js` con `__mando` y un mando conectado según
  `navigator.getGamepads()`), 4 = teclado, 8 = táctil.
- `movs`: pointermove entre apretar y soltar (tope 255); `msGesto`: lo que duró
  el gesto (tope 9999; −1 si no hubo puntero).

Un difícil completo son ~300–450 entradas: ~8–12 KB de JSON.

## Qué comprueba `verifica`

1. Forma: categoría, `puntos === 1`, `v`, nivel de la prueba igual al de la
   categoría, semilla uint32, `e` múltiplo de 6, todo enteros en rango.
2. **Repetición** con `engine.js`: cada bandera se pone, cada apertura abre
   algo, nada después de terminar, el reloj no corre antes del primer clic, y
   la partida queda **ganada en la última jugada**.
3. **Tiempo**: `|tiempo − max(1, Σ msJuego)| ≤ 2 ms`.
4. **Eventos sintéticos**: una sola jugada con el bit 1 rechaza.
5. **Ritmo humano** (referencias: récords del buscaminas ~0,5 / 7 / 27 s a
   8–12 clics por segundo; récord de «butterfly clicking» ~25/s en un mismo
   botón):
   - la segunda jugada no llega antes de **100 ms** tras el primer clic (hay
     que ver qué abrió; la reacción visual humana es de 150–250 ms);
   - promedio ≥ **50 ms** por jugada con 3 o más, ≥ **66 ms** (15/s) con 20 o
     más;
   - diez jugadas seguidas no caben en menos de **250 ms** (36/s). Se miden
     ventanas, no intervalos sueltos: dos dedos a la vez en una pantalla
     táctil dan una pareja casi simultánea legítima.
6. **Regularidad** (con 15 o más intervalos sin pausa de por medio):
   coeficiente de variación < **0,05** rechaza solo (metrónomo); < **0,15**
   rechaza solo si además más del **80 %** de los clics de ratón duraron menos
   de **8 ms** entre apretar y soltar. Los gestos instantáneos solos no
   bastan: el «tap to click» de un panel táctil puede dar 2–6 ms.
7. **Pausas**: 10 o más y al menos una cada 3 jugadas rechaza.
8. **Reloj frenado**: en los intervalos de 300 ms o más sin pausa dentro,
   la mediana de juego/pared tiene que ser ≥ **0,6**. Mediana para que una
   pausa o un portátil que se durmió sin avisar (un intervalo enorme suelto)
   no cuenten; 300 ms porque Firefox con `resistFingerprinting` redondea los
   relojes a 100 ms; solo con 8 o más intervalos.

## `sospecha` (filas sin prueba)

Suelos: fácil **0,25 s**, medio **2 s**, difícil **10 s**, y `puntos !== 1`.
Simulando 20 000 repartos por nivel (con el hueco de 3×3 garantizado), el 3BV
del 0,1 % más fácil es 4 / 34 / 117 y el mínimo 1 / 26 / 100; a 15 3BV/s (más
que cualquier récord) salen esos suelos con margen. En fácil, el primer clic
gana el tablero 1 vez de cada ~20 000 (tiempo ~1 ms, legítimo): la fila se
marca igual pero el motivo lo dice. Es un aviso para un administrador.

## Límites honestos

- **Elegir semilla.** La semilla la pone el navegador: alguien puede probar
  semillas hasta dar con un tablero de 3BV bajísimo (o uno que se gana con un
  clic, 1 de cada 20 000) y jugarlo. La prueba es válida. Sin un servidor que
  reparta la semilla no hay cómo evitarlo.
- **Bot bien hecho.** Clics confiables (CDP/autoclicker), con ruido gaussiano
  en el ritmo y gestos de 50–100 ms, a 6–8 clics por segundo, pasa: es
  indistinguible de un jugador muy bueno. Sus tiempos quedan cerca de los
  récords humanos, no en 9 ms.
- **Reescribir los dos relojes** (`performance.now` y `Date.now`) a la vez
  deja la comparación sin referencia; lo frena el ritmo humano.
- **Mentir el origen.** Quien reescribe el cliente puede anotar `origen 0`;
  el bit 1 caza al que usa `click()`/`dispatchEvent` sin tocar el juego.

## Cambios compartidos pedidos

1. **Atar la prueba a la cuenta.** La prueba lleva `u` (la `cuenta` de la URL
   del marco), pero `verifica(dato, prueba)` no recibe el uid. Pido que
   `verificaClub` reciba el uid y rechace `prueba.u && prueba.u !== uid`
   (o pase el uid al verificador). Sin eso, alguien puede copiar de
   `soloPruebas` la prueba de un récord ajeno y presentarla como suya
   (empata, no mejora; pero cobra podio). Alternativa barata en la
   auditoría: `auditar-club.cjs` podría marcar dos filas con la misma
   semilla y las mismas jugadas.
2. Añadir `tests/antitrampas-minas.test.cjs` a `test:juegos` en
   `colabtex/package.json`.
3. Subir el `?v=` del marco en `solo/club.js` (`club-25`) para que el
   navegador no mezcle el `game.js` nuevo con el `engine.js` viejo (cada uno
   ya lleva su propio `?v=minas-prueba-1`, así que esto es solo por las
   dudas).
