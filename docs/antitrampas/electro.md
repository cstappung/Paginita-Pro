# Antitrampas: Electrodle

Categorías: `club-electro-puntos` (el total acumulado de todo el historial,
solo crece) y `club-electro-racha` (días seguidos con los clásicos del
diario resueltos). Verificador: `colabtex/src/juegos/solo/verifica/electro.js`
(`PRUEBA = 1`). Pruebas: `colabtex/tests/antitrampas-electro.test.cjs`.

## Vías de trampa encontradas

1. **`Club.result` desde la consola** con cualquier número de puntos o racha.
2. **Editar lo guardado**: `electro.estado.cuenta.<uid>` en `localStorage` o
   `users/<uid>/club/electro` (los dos los escribe el propio usuario). El
   total y la racha salían de `hist`, así que bastaba inventar días o poner
   `[100, 1, …]` en cada modo.
3. **Colar la práctica como diario**: un acierto de práctica (objetivo al
   azar) o un Científico (es solo de práctica desde el 2-10-2026) metido en
   `hist`.
4. **Días imposibles**: futuros, anteriores al estreno, repetidos.
5. **El reloj**: frenar `performance.now` para bajar el tiempo (desempate);
   adelantar el reloj del sistema para jugar los diarios de mañana.
6. **Bots**: un script que escribe el nombre y envía (eventos despachados o
   `requestSubmit`), o que maneja el navegador con entradas «reales»,
   resolviendo con `objetivoDelDia` a velocidad inhumana.
7. **Fabricar el historial con el motor**: `ElectroMotor.objetivoDelDia` es
   público (el objetivo es una función de la fecha), así que se puede
   escribir un historial «perfecto» desde el estreno.

No hay hooks de depuración (`window.__…`) que salten partidas.

## La prueba

El juego ahora guarda en `hist` lo que se intentó en cada modo y cómo
(`[puntos, intentos, ms, ganó, [lo intentado], forma]`; `limpia` los conserva
si cuadran con el número de intentos, `mezcla` prefiere a igual puntaje la
entrada que los trae; mientras el modo está a medias van en `prog`). La
**forma** es `{t: [[dt, a], …], u, mc}`: por intento, los ms *visibles* desde el
intento anterior (o desde que se abrió el modo, o se cargó la página) y las
acciones de verdad (`keydown`, `pointerdown`, `input` o `click` con `isTrusted`) que lo
armaron; `u`, las acciones sintéticas (teclas, toques, clics o envíos con
`isTrusted` falso; un `input` sintético no cuenta, porque hay extensiones que
los despachan), y `mc`, las del mando (marcadas `__mando` por mando.js con un
mando conectado según `navigator.getGamepads()`; un envío de formulario a
menos de 1 s de un clic del mando también es suyo). De ahí
`ElectroMotor.prueba(e, fecha, soloDia)` arma:

```
{ v: 1, f: "2026-10-20",                 // el día en que se mandó el récord
  m: ["comp","form","simb","band","circ","conx"],   // columnas
  d: [[20, [41000,"AV","30211.9,10804.12"], 0, [9000,"Kq","2511.6,6400.4"], …], …] }
```

Cada fila es un día (número de Electrodle, 1 = 2026-10-01) y una columna por
modo: `0` no jugado, `[ms, "lo intentado", "dt.a,dt.a,…", u, mc]` (la forma
solo en los últimos 30 días, `M.VENTANA`; `u`/`mc` solo si no son cero), o
`[ms, intentos, ganó]` para lo guardado antes de que existiera la prueba. Lo intentado va compacto: en los
clásicos, el índice de la ficha en su lista en base 64 (un carácter mientras la
lista no pase de 64); en Bandas, los cuatro caracteres de cada código; en
Conexiones, cuatro cifras hex por intento; en Circuito, números separados por
`;`. Codificar y decodificar están en el motor, que comparten juego y
verificador.

- **Puntos**: la prueba lleva **todo el historial**, y la forma solo de los
  últimos 30 días (un bot se ve en lo reciente, lo viejo ya se revisó con los
  récords de su momento, y así la prueba no se dobla). Medido con un robot que
  juega los seis modos todos los días (lo más que puede crecer): ≈140
  caracteres por día más ~6 000 de la forma: 55 500 en un año, 207 000 en
  cuatro. Verificar un año tarda ~0,3 s. El tope de 200 000 llega a los
  ~3,5 años de jugar todo, todos los días: antes de eso hay que cambiar a un
  punto de control (ver abajo).
- **Racha**: la prueba lleva **solo el día del récord** (`soloDia`).

## Qué verifica

Para cada día y modo con lo intentado, con el motor del juego
(`M.objetivoDelDia`, `M.estado`, `M.puntos`):

- cada intento tiene la forma de su modo (`M.valida`) y ninguno se repite;
- el modo **termina justo en el último intento** y no antes: el acierto es el
  objetivo de *esa fecha y ese modo* (la práctica o el día de al lado no
  aciertan), un desafío perdido está perdido de verdad, y nada se intentó
  después de terminar (un desafío con siete intentos no existe);
- los puntos salen de ahí, nunca del número guardado.

Después: el total y el tiempo (`min(7 días, max(1, Σ ms))`) tienen que ser
**exactamente** los declarados; las fechas entre el estreno (`2026-10-01`, el
`alta` del salón y el #1 de `numeroElectrodle`) y el día de la prueba, que a su
vez no puede ser posterior a hoy en Chile; días en orden y sin repetir;
Científico solo en días hasta el 2-10-2026 (cuando era del diario); un modo
guardado sin lo intentado solo antes de `CORTE`.

Racha: un solo día, el de la prueba; sus tres clásicos (Componente, Fórmula,
Símbolo) ganados **con** lo intentado y rehechos; el tiempo es el del día; y la
racha no puede ser más larga que los días que lleva Electrodle. El largo de la
racha lo acota el nodo central `rachasClub` (sube de a uno por día de Chile).

### Anti-bots

Con la forma (obligatoria en los días desde `CORTE` dentro de la ventana):

- **Una sola acción sintética** sin mando rechaza el modo.
- **Cada intento con al menos una acción de verdad**: intentar sin tocar una
  tecla, la pantalla o el ratón solo lo hace un script (`requestSubmit` da un
  `submit` confiable, pero ninguna tecla ni toque: así cae el bot del
  navegador de las pruebas).
- **`DT_MIN` = 150 ms** entre intento e intento (y desde que se abre el modo):
  hay que ver la respuesta anterior y hacer algo; el tiempo de reacción visual
  humano ronda los 200–250 ms.
- **Un modo entero ≥ 500 ms** (Conexiones ≥ 1,5 s: son al menos 20 toques, y el
  récord de clics anda en 13 por segundo).
- **Metrónomo**: con 20 intervalos o más en la ventana, un coeficiente de
  variación bajo 0,08 rechaza. Entre intentos de adivinar una persona tarda de
  un par de segundos a minutos (piensa, lee la pista); los robots humanos de
  las pruebas dan CV ≈ 1. No hay gestos de arrastre que medir: aquí se
  escribe y se toca.

Probado en Chromium con el juego de verdad: escribir con el teclado
(`keyboard.type` + Intro) deja 10–14 acciones por intento y pasa; un bot que
pone el valor y llama `requestSubmit` deja 0 acciones y se rechaza.

### Umbrales y por qué

- **`CORTE = 2026-10-12`**: lo guardado antes de esta versión no tiene lo
  intentado y no se puede rehacer; se acepta con los puntos recalculados desde
  el número de intentos. Va una semana por delante del despliegue para que
  quien tenga el juego viejo en caché durante el cambio no quede sin poder
  subir su total para siempre (un día sin respaldo después del corte rechaza
  *todo* el historial). Lo más que se infla así es «perfecto cada día hasta el
  corte», lo mismo que se puede fabricar con la vía 7. **Si el despliegue se
  atrasa, corre `CORTE` con él.**
- **Reloj del juego**: ≥ 500 ms por intento en promedio (del reloj del juego, `ms`), solo con 30 intentos o más. El
  reloj del juego suma de a un segundo, solo con la pestaña visible y pierde
  hasta 5 s al recargar, así que un modo suelto puede quedar en 0 ms sin trampa;
  escribir y elegir un intento real lleva más de un segundo.
- **Suerte**: Componente acertado al primer intento en 8 días o más y en la
  mitad de los días o más. El primer intento no tiene ninguna pista (1 entre 43;
  llevando la cuenta de la vuelta, ~1 de cada 10 días). Es lo que deja un
  historial fabricado copiando el objetivo.
- `sospecha` (filas sin prueba): puntos por encima de lo posible a la fecha
  (700 por día el estreno y el 2-10, con Científico; 600 desde entonces), o
  más de 1000 puntos a menos de medio segundo por modo; una racha más larga
  que los días del juego.

## Lo que no se puede detectar (límite honesto)

- **Rellenar días pasados (vía 7).** El objetivo de cualquier fecha es
  público, así que quien lea `motor.js` puede escribir lo intentado de días
  que no jugó, con tiempos creíbles. Lo verificado acota el total a lo de
  alguien que juega todos los días desde el estreno y no se equivoca nunca, y
  obliga a fabricar algo que pase la suerte y el reloj, pero no lo impide.
  Cerrarlo pide un nodo por día (abajo).
- **Adelantar el reloj del sistema** para jugar los diarios de días futuros:
  el verificador corre en el mismo navegador, con el mismo reloj. Una
  auditoría posterior (con la hora de verdad) sí lo ve, porque la prueba trae
  días futuros respecto de cuando se escribió.
- **Saber la respuesta** (otra cuenta, un amigo, la consola) y escribirla: se
  ve como jugar bien.
- **Un bot con entradas confiables y ritmo humano** (que maneje el navegador
  por el protocolo de depuración, con pausas al azar de segundos): produce
  `isTrusted` verdadero, acciones por intento y tiempos irregulares. Y la forma
  vive en un blob que el usuario puede editar: quien fabrique el historial
  (vía 7) también fabrica la forma. Esto frena los bots ingenuos (eventos
  despachados, resolver al instante, ritmo fijo), no a uno hecho con cuidado.

## Cambios compartidos pedidos

1. **Nodo por día para los puntos** (como `diario` o `rachasClub`):
   `diasClub/<uid>/electro/<n.º de día>` = `{p, at}`, escrito solo dentro de ese
   día de Chile (la misma ventana de 25 h que `diario`), una vez, con `p ≤ 600`
   y que solo sube. El juego lo escribiría al terminar cada modo (vía
   `conexion.js`, que hoy no tiene un mensaje para eso). Con eso `guardaClub`
   (o el verificador, si recibe esa lectura) exige que cada día de la prueba
   esté en el nodo con los mismos puntos o más: un día que no se escribió en su
   fecha no cuenta, y queda cerrada la vía 7. También sirve de punto de
   control: con el nodo, la prueba podría llevar solo los días recientes y
   dejar de crecer (hoy toca el tope a los ~3,5 años).
2. **Racha**: `rachasClub/<uid>/club-electro-racha` (ya hecho, commit 0e31f1b)
   recorta la fila; lo que necesita de aquí es lo que el verificador ya
   prueba: que el día del récord tiene los tres clásicos resueltos de verdad.
3. **`colabtex/package.json`**: agregar `tests/antitrampas-electro.test.cjs`
   a `test:juegos`.
4. **`CLAUDE.md`** (sección de Electrodle): el estado guardado es ahora
   `{hist: {fecha: {modo: [puntos, intentos, ms, ganó, [lo intentado], forma]}}, prog}`
   y cada récord viaja con `M.prueba`; un catálogo nuevo va al final de su
   lista con `desde` (si no, los objetivos de los días pasados cambian y el
   verificador rechaza el historial de todos; la huella de los objetivos está
   fijada en el test).
5. **`CORTE`** en `verifica/electro.js`: ajustarlo a una semana después del día
   en que esto se despliegue, si eso pasa después del 5-10-2026.
