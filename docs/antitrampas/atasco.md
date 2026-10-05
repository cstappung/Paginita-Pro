# Antitrampas: Atasco

Tabla única: `club-atasco-estrellas`. **Puntos** = estrellas juntadas en
los 240 niveles (máximo 720); **tiempo** = suma, nivel por nivel, del
tiempo del intento que cuenta. Lo general está en `docs/antitrampas.md`.

## 1. Vías de trampa que había

| Vía | Cómo | Esfuerzo |
|---|---|---|
| `Club.result` a mano | `Club.result({categoria:'club-atasco-estrellas',puntos:720,tiempo:1})` | una línea |
| Editar el progreso | `atasco.progreso` en `localStorage` (o `users/<uid>/club/atasco`, que escribe su dueño) con `{n:{0:[3,1,1],…}}`: el juego mandaba `totales(prog)` tal cual. «720 ★» en un minuto | un minuto |
| Abrir pisos a mano | lo mismo, poniendo estrellas en los pisos anteriores para jugar los de arriba | un minuto |
| Ganchos | `window.__atasco.mueve(i,d)` + `__atasco.resuelve()`: un guion resuelve los 240 niveles con el mínimo en segundos | minutos |
| Reloj | acelerar `performance.now` para bajar el tiempo (desempate de la tabla) | minutos |
| Bot | el solucionador está en la página: un bot con pausas humanas saca 720 ★ | programar |

## 2. La prueba

El juego anota cada movida que queda en la partida (lo deshecho sale, lo
reiniciado empieza de cero) como `[vehículo, destino, instante, gesto]` y,
al ganar, guarda la partida del **mejor intento de cada nivel** (más
estrellas; a igualdad, menos tiempo, que es lo que ordena la tabla) en el
propio progreso, `prog.p[nivel]`. Así la prueba acompaña al progreso a lo
largo de muchas sesiones y dispositivos: `mezclaProgreso` junta las dos
copias quedándose con la mejor partida de cada nivel, y una partida que no
se puede rehacer (o que no parece de una mano) nunca reemplaza a una buena.

Formato de una partida (un texto por nivel):

```
<reacción>~ y, por cada movida:
<letra del vehículo><destino 0–5><ms desde la anterior>.<ms que duró el gesto><forma><pasos>[*]
```

Números en base 36 (vacío = 0). La **reacción** son los ms desde que se
abrió el nivel hasta que se soltó la primera movida de la partida. La
letra es la del nivel (`A` el auto rojo); el destino, la columna de su cola
si va de lado o la fila si va de pie. El instante es el del reloj del nivel
(arranca con la primera movida, se para con la pestaña oculta) y se toma
del `timeStamp` del evento, no de cuando se atiende: un teléfono trabado no
junta dos movidas. El tiempo del nivel **es** el instante de la última
movida, al milisegundo. El **gesto**: cuánto duró (de apretar a soltar; con
teclado o mando, de tomar a soltar), la forma (`.` puntero, `:` teclado,
`!` mando) y los pasos (pointermove entre apretar y soltar; con teclado o
mando, las flechas). `*` marca un gesto con algún evento no verdadero
(`isTrusted` falso) que no venía de un mando conectado
(`navigator.getGamepads()`; `mando.js` marca sus teclas con `__mando`).
Ejemplos reales, de Chromium: con el ratón `yi~K3.f6.6A4t5.gw.6` (2
movidas, reacción 666 ms, gestos de 546 y 608 ms con 6 pointermove); con
teclado `1gt~M3.54:1J31s4.5p:1A4xw.4j:1`; un guion con `dispatchEvent`
`8i~H3.1.1*I3ji..1*A4ki..1*`.

Lo que viaja con `Club.result`:

```json
{"v": 1, "n": {"0": "yi~K3.f6.6A4t5.gw.6", "1": "…", ...}}
```

solo con los niveles que cuentan. Tamaño medido: los 240 niveles con ★★★
ocupan **~50 000 caracteres** (de 47 000 a 53 000 según el ritmo). Topes:
250 movidas por nivel (más que eso es ★ y se vuelve a jugar) y 180 000
caracteres entre todas, porque el progreso entero va a la cuenta en un
texto que debe quedar bajo 200 000 (si no, `partida-guardar` lo descarta).
Pasado el tope se sueltan las partidas de los niveles más altos; jugando
no se llega ni cerca. Rehacer las 240 cuesta ~10–40 ms (~300 la primera
vez, con el motor en frío).

Toda la lógica es de `juegos/club/atasco/motor.js` (`codificaPrueba`,
`juegaPrueba`, `resumenPruebas`, `anotaPrueba`), que usan la pantalla **y**
el verificador: no pueden discrepar.

## 3. Qué verifica `verifica/atasco.js`

1. Forma: `{v: 1, n: {…}}`, al menos un nivel, no más niveles que el juego.
2. Cada partida se **vuelve a jugar** con el motor sobre el nivel de
   `niveles.js`: cada movida legal, el auto rojo sale y no se mueve nada
   después. Las estrellas salen de contar las movidas contra el mínimo del
   nivel. Una partida que no se puede rehacer, o que no pasa la capa
   anti-bot, rechaza el resultado entero.
3. **Desbloqueo**: un nivel cuenta solo si estaba abierto según las otras
   partidas (piso con la mitad de las estrellas del anterior, nivel con el
   anterior ganado; lo mismo que `nivelAbierto`), repitiendo hasta que no
   cambia. Lo que no estaba abierto no rechaza: simplemente no suma, y
   entonces las estrellas declaradas no cuadran si alguien lo sumó.
4. **Capa anti-bot** (ver abajo).
5. `puntos` = estrellas de los niveles que cuentan, y `tiempo` = suma de
   sus tiempos (topes 1 ms – 7 días): **igualdad exacta** con lo declarado.

### Qué hace el juego con las partidas que no valen

Las cuenta igual que el verificador (es la misma función) y no las manda:
una persona nunca ve rechazado un resultado por una partida suya rota. La
excepción, a propósito: si el nivel recién ganado deja una partida «sin
mano» (motivo anti-bot), el juego manda **ese** resultado con esa prueba,
declarando las estrellas que diría haber ganado, para que la página lo
rechace y escriba el aviso en `sospechas/<uid>`. Los resultados siguientes
ya no la llevan, y volver a ganar el nivel la reemplaza: un falso positivo
cuesta un envío, no la tabla.

### La capa anti-bot: umbrales y por qué

Un bot produce partidas válidas: los niveles son fijos y el solucionador
está en la página (`__atasco.resuelve`). Lo que lo delata es cómo mueve.
Todo con margen amplio; las señales débiles solo cuentan juntas.

| Señal | Umbral | Por qué |
|---|---|---|
| Evento no verdadero | 1 gesto con `*` rechaza | `dispatchEvent` desde la consola da `isTrusted` falso. Las teclas del mando (sintéticas, de `mando.js`) valen con un mando conectado |
| Reacción | primera movida soltada < 150 ms tras abrir el nivel | reacción simple ~200–250 ms, y además hay que llegar al vehículo y arrastrarlo |
| Entre dos movidas | < 40 ms | apretar, arrastrar media casilla y soltar, un arrastre a la vez: nadie baja de 80–100 ms |
| Sostenido | 10 movidas seguidas en < 1,2 s | 8 por segundo, el ritmo de los récords del cubo de Rubik, con dedos entrenados y sin apuntar a otra pieza cada vez |
| Gesto instantáneo | < 20 ms de apretar a soltar, ≥ 3 en el nivel **y** la mitad de sus gestos | un clic ya dura 50–100 ms apretado, una tecla 70–120 ms; uno suelto no delata a nadie |
| Metrónomo | con ≥ 15 movidas, coeficiente de variación de los intervalos < 0,03 | una persona pasa holgado de 0,3 (pensar, buscar el auto); marcando un compás a propósito con el dedo anda por 0,03–0,05. Más parejo, solo un temporizador |
| Parejo + seco | CV < 0,15 **y** (algún gesto instantáneo **o** ≥ 80 % de ≥ 8 arrastres con ≤ 1 pointermove) | cada señal sola puede ser una persona (una solución sabida jugada con calma; un flick rápido); juntas, no |

Lo que pasa en las pruebas: intervalos log-normales; teclado; mando;
muy rápido (150–260 ms entre movidas, flicks de 30–80 ms con 2–4
pointermove, reacción de 300 ms); un flick de 15 ms con 1 pointermove de
vez en cuando; ±10 % de variación con gestos normales (CV ≈ 0,06).
Lo que se rechaza: todo con `isTrusted` falso o una sola movida así;
gestos de 0 ms; intervalo fijo de 800 ms; ±10 % con arrastres de un solo
pointermove; reacción de 40 ms; intervalos de 0–100 ms.

No se mide lo que se tarda antes de la primera movida para el *tiempo*:
el reloj del juego arranca con ella (quien se sabe la solución empieza al
instante). La reacción solo se usa como señal.

## 4. `sospecha()` (filas guardadas sin prueba)

- Más de 720 estrellas: imposible.
- Tiempo menor que lo mínimo para esas estrellas: hacen falta
  `ceil(e/3)` niveles ganados, cada uno con al menos su mínimo de movidas y
  `(movidas − 1)` intervalos de reloj; se toman los niveles más cortos y
  **50 ms por intervalo** (más laxo que en vivo: las filas viejas se
  fechaban al atender el evento). 720 ★ exigen al menos ~3,9 minutos;
  quien los ganó de verdad lleva horas. Un progreso editado a mano
  (`[3,1,1]` en cada nivel → 240 ms) cae.

## 5. Quien ya tenía estrellas antes de esta versión

Su progreso no tiene partidas, y no hay forma de distinguirlo de uno
escrito a mano. Para **no castigar** a nadie:

- No se borra nada: el edificio sigue mostrando sus estrellas, y siguen
  abriendo pisos y niveles **en su pantalla**.
- Su fila de la tabla queda como estaba (las reglas solo dejan escribir
  una que la mejore), y `sospecha()` solo marca lo imposible.
- A la clasificación nueva van solo las estrellas respaldadas, y cada
  nivel cuenta en cuanto se vuelve a ganar. Abrir pisos *para la tabla*
  también exige partidas: un nivel del piso 3 ganado ahora (abierto en su
  pantalla por estrellas viejas) suma recién cuando los pisos 1 y 2 tengan
  sus partidas. Mientras la cuenta respaldada no supere la fila vieja, no
  se escribe nada nuevo (pero cada subida es una partida del club y paga
  como siempre).
- El ★ de la cabecera lo dice en su `title` cuando hay diferencia («En la
  clasificación cuentan N…»).

Lo que se pierde: un honesto con 720 ★ viejos tendría que volver a jugar
para mejorar su fila. Es el precio de no poder distinguirlo de un tramposo.

## 6. Ganchos de depuración

`window.__atasco` sigue (abre, resuelve, mueve, estado, progreso) para
probar desde la consola o un guion, pero un nivel en el que se usó
`__atasco.mueve` **no deja partida**: se anota en el edificio y no suma a
la tabla. `__atasco.resuelve` no se tocó: el solucionador es público de
todos modos. Arrastrar con `dispatchEvent` deja gestos con `*` y se
rechaza (probado en Chromium).

## 7. Qué NO se puede detectar (límite honesto)

- **Un bot con entrada de verdad y pausas humanas.** Quien mueva el ratón
  del sistema (CDP de Playwright, xdotool, AutoHotkey) da eventos con
  `isTrusted` verdadero; si además pone pausas irregulares, arrastres de
  más de 20 ms con varios pointermove y una reacción creíble, su partida
  es indistinguible de una persona que se sabe la solución. Lo único que
  se le impone es un ritmo humano (≤ 8 movidas por segundo sostenidas).
- **Reloj acelerado moderado.** Acelerar el reloj ×3–×5 sobre un jugador
  rápido queda por encima de 120 ms/movida y pasa. Afecta solo al
  desempate por tiempo.
- **Partidas copiadas.** Las pruebas de `soloPruebas` las puede leer
  cualquiera con sesión, y como los niveles no tienen semilla, la partida
  de otro vale igual. Se ve auditando: dos cuentas con la misma partida
  (mismos instantes y gestos al ms) en un nivel es una copia (ver abajo).
- Un cliente reescrito que escriba en Firebase saltándose la página: queda
  la prueba guardada y auditable.

## 8. Cambios compartidos pedidos

- **Manual** (`colabtex/src/juegos/reglas.js`, sección Atasco →
  «Clasificación»): añadir algo como «La tabla cuenta las estrellas de las
  partidas jugadas con esta versión: cada nivel guarda la partida de su
  mejor intento, y la página la vuelve a jugar antes de guardar el récord.
  Los niveles ganados antes cuentan al volver a ganarlos.»
- **CLAUDE.md**, sección de Atasco (Ranking): mencionar `prog.p`, que la
  tabla cuenta solo lo respaldado (`motor.resumenPruebas`) y los umbrales
  (40 ms, 10 movidas en 1,2 s, la capa anti-bot del gesto), y que **regenerar `niveles.js` invalida
  las partidas guardadas** (habría que subir `PRUEBA_VERSION` y aceptar que
  todos vuelvan a jugar, o conservar los niveles viejos).
- **`auditar-club.cjs`** (opcional): para `club-atasco-estrellas`, buscar
  textos de partida idénticos entre cuentas distintas en `soloPruebas`
  (una partida humana de más de unas pocas movidas no se repite al ms).
- `solo/club.js`: lo que ya esperaba en `jg.club.pendientes.*` de una
  versión anterior (sin prueba) se rechaza al re-verificarse y deja una
  `sospecha` aunque fuera honesto. Es común a todos los juegos; quizá
  convenga que la re-verificación de pendientes sin prueba se descarte sin
  reportar.
