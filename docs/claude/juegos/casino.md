# Casino (pestaña «Casino» de Juegos)

Apostar las monedas: **El Avión** (crash), **Pingüinito** (saltar
témpanos), **Ruleta** (europea), **Blackjack**, **Video Póker** (Jacks or
Better) y **Plinko**. Ruta `#casino` y `#casino/<avion|pinguino|ruleta|
blackjack|poker|plinko>`. Letra `j` de cada ronda: a, p, r, b, v, l.

Archivos:

- `colabtex/src/juegos/casino-motor.js` — puro (sin DOM), lo usan la
  economía y `tests/casino.test.cjs`. Límites, multiplicadores, `azar`,
  `resuelveAvion`, `resuelvePinguino`, `resuelve`.
- `casino.js` — la pestaña: cabecera (saldo, 🔊 y volumen de efectos),
  menú con fichas animadas, «Tus números», «Grandes premios». Pasa un
  `api` a cada juego.
- `casino-avion.js`, `casino-pinguino.js`, `casino-ruleta.js`,
  `casino-plinko.js` — un canvas cada uno; `casino-blackjack.js` y
  `casino-poker.js` son DOM (naipes con vuelta 3D). Todos
  `montarX(h, api)` → `{datos, destruir}`.
- `casino-comun.js` — lo repetido: el control de apuesta (`ligaApuesta`),
  teclas, `naipe`/`ponCara`, mensajes de error.
- Estilos: bloque `.jg-cs-*` al final de `juegos.html`. El casino es
  siempre oscuro, así que no tiene gemelos en el bloque `data-tema=oscuro`.
- Sonidos en `sonido.js` (`despega`, `hito`, `cobra`, `explota`, `salta`,
  `aterriza`, `cruje`, `chapuzon`, `giro`, `bola`, `pone`, `clavo`, `cae`),
  siempre por `busFx`.

## El azar decide el pasado (la regla que no hay que romper)

Una ronda es `casino/<uid>/<clave>` = `{j, p, d?, at}` y cada decisión es una
escritura de una vez con la hora del servidor (`=== now` en las reglas):
avisos del avión `t/<i>` (cada `AVISO` = 350 ms mientras vuela), saltos del
pingüino `s/<i>`, y retiro `c`. Lo que pasó en el tramo que termina en esa
hora sale de `sha256("casino:"+uid+":"+clave+":"+etiqueta+":"+ms)`. Nada está
guardado de antemano, y nadie elige el milisegundo en que llega su escritura.
**Nunca** guardar un punto de choque ni una semilla que el cliente pueda leer
antes de decidir.

- Avión: con probabilidad 3 % choca en ×1 al despegar. Después, el tramo
  [a, b] se sobrevive con probabilidad M(a)/M(b), con M = exp(0,11·t). A
  ×100 (unos 42 s) se va del cielo.
- Pingüino: cada salto cae con `cae`. El multiplicador es
  `floor2(0,97 / (1−cae)^n)` y llegar al último témpano cobra solo.
- Las dos son martingalas: **cualquier** estrategia (a mano, con un
  programa, retirarse antes o tarde) espera 0,97. Por eso no hay antitrampas
  de automatización: no hay nada que ganarle. `tests/casino.test.cjs` lo
  comprueba por simulación. Si se toca una fórmula, la prueba tiene que
  seguir dando 0,97.
- Ruleta (`b` = {casilla: monedas}, suma = `p`), Plinko (`d` riesgo, `n`
  filas) y la mano inicial del póker salen de la hora de la apuesta: no
  hay decisión después que el azar pudiera adelantar.
- Blackjack: decisiones `a/<i>` = {t: p|q|d|s, at}; cada carta sale de la
  hora de la decisión que la pide. **El crupier no tiene carta tapada
  guardada** (ENHC): su segunda carta sale de la hora de la última
  decisión, y si tiene blackjack solo se pierde la apuesta original (OBO).
  Una carta tapada sacada de la hora de la apuesta se podría calcular.
- Póker: el cambio `x` = {m, at} (m: bits de las retenidas) y los
  reemplazos salen de las 47 restantes **barajadas otra vez con `x.at`**;
  las siguientes del primer mazo se habrían podido calcular.
- Esperanzas (las pruebas las calculan o simulan): ruleta 36/37, plinko
  0,967–0,9705 en las nueve tablas, póker 97,3 % con juego óptimo,
  blackjack ≈ 0,996 con estrategia básica (menos jugando a ojo).
- El pago va en **centésimas** (`pagoDe`). Redondearlo a monedas enteras le
  quitaba hasta un 10 % a la apuesta mínima. `economia()` suma los premios
  así y los redondea hacia abajo una sola vez (`x.premios`).

## Límites

Apuesta mínima: 10 para todo. Las máximas: Avión 500. Pingüino según
dificultad: Fácil 1000 (cae 1/10, 20 témpanos), Medio 500 (1/5, 15),
Difícil 200 (1/3, 12) y Extremo 50 (1/2, 10). Ruleta 500 por tirada
(suma de todas las fichas), Blackjack 500 (doblar o separar cobra otro
tanto aparte), Video Póker 100, Plinko según riesgo: Bajo 500, Medio 200,
Alto 50. La regla `casino` de
`database.rules.json` repite estos números: si cambian en el motor, cambian
también allí y en `test-rules.mjs`.

## Economía (`monedas.js`)

Hay dos eventos. `ca` es la apuesta: se cobra a la hora `at` por `paga`.
Doblar o separar en blackjack es otro `ca` (`extra: true`) a la hora de esa
decisión; si no tiene fondos, la ronda entera deja de valer y no paga.
`cp` es el premio: se suma a la hora `fin`, y solo si la apuesta valió.
Una apuesta sin fondos no juega ni paga, y la cuenta queda **parada**,
como cualquier gasto sin fondos. `monedasDe` devuelve `premios` y
`casino: {apostado, pagado, rondas}`. `economia(d).rondas["uid~clave"]`
trae cada ronda resuelta, que es lo que lee el feed.

## Rendimiento (lo que hacía tirones a todo el sitio)

Cada apuesta, aviso del avión o salto es una escritura, y `casino` lo
escucha **todo cliente** (`watchLogros`, para los saldos). Dos cosas lo
hacían caro, en cada pestaña abierta, jugara o no:

- `fb.watchLogros` escucha `casino` **cuenta por cuenta** (child
  added/changed/removed) y llama `val()` solo al avisar y solo para las
  cuentas que cambiaron; las demás conservan su objeto. Avisa juntado: 1 s
  si cambió lo propio, `CASINO_AJENO` (8 s) si solo jugó otra persona, y
  nada con la pestaña escondida (avisa al volver). `val()` del nodo entero
  en cada escritura de cualquiera costaba ~30 ms con 2 MB.
- `economia()` no vuelve a resolver una ronda que no cambió: `memoRondas`
  (por `uid~clave`, firma = campos + cuántas marcas y la suma de sus horas)
  y `memoCuentas` (por el objeto `casino/<uid>`). Resolver todas era un
  sha256 por marca: ~300 ms por recálculo con 9000 rondas, ahora ~5–10 ms.
  Los objetos de `rondas` se reusan entre economías: lo único que la
  economía les cambia es `valida`, y la vuelve a poner en false al empezar.
  No mutar nada de `economia().rondas` desde una vista.
- `economia().casinoPorCuenta[uid]` es la lista de rondas de esa cuenta, la
  misma mientras no juegue. casino.js deriva de ella `api.mias()` (las
  propias, de la más nueva a la más vieja) y los grandes premios, guardados
  por lista: ningún juego recorre `e.rondas` entero (9000 rondas) por lectura.
- **Sin parpadeo.** Las filas de «Grandes premios», «Más ganan» y «Más
  pierden» llevan la animación de entrada `jgCsEntra`: van por `pintaLista`
  (casino-comun.js), que reusa la fila de cada clave y solo anima las nuevas.
  El menú se arma una vez y cada lectura toca solo sus cuatro cajas
  (`escribe` = innerHTML solo si cambió). Nunca reescribir una de esas
  listas entera.
- **Dibujo.** Lo que no se mueve va en lienzos guardados por tamaño: en la
  ruleta el paño, el aro (shadowBlur) y el barniz; en el plinko fondo,
  clavos y casillas en reposo, y la bola con su brillo como sprite (el
  plinko no dibuja si nada se mueve); en el pingüino cielo y mar, cada
  témpano y cada etiqueta. Nada de `shadowBlur` ni degradados de pantalla
  completa por cuadro.
- Números: `numeroEs` (casino-motor.js) guarda los `Intl.NumberFormat`;
  `toLocaleString` con opciones arma uno por llamada y el avión escribe
  varios por cuadro. Los clavos del plinko suenan como mucho cada 35 ms.
- Cómo se midió: emulador de Firebase con 30 cuentas × 300 rondas, la
  página real con `firebase.js` apuntando al emulador, CPU ×6 por CDP y
  bots escribiendo avisos del avión; se cuentan cuadros > 34 ms, tareas
  largas y nodos que el DOM rehace (MutationObserver).

## La ruleta (`casino-ruleta.js`)

- Rueda y bola son **funciones del reloj** (`giroEn`, `posicion`), nunca
  `vel·dt`: con la página trabada la rueda avanzaba a pasos topados mientras
  la bola llegaba sola a su casilla.
- La bola sale al tocar «Girar» (`arranca`) y, cuando llega el número
  (`lanza`), se busca por bisección cuánto dura en la pista para que, al
  frenar, caer y rebotar, quede en esa casilla. Nunca cambia de sentido en
  la pista.
- `dibujaPlato`: la traslación de `setTransform` va en píxeles del
  dispositivo (`R * dpr`). Con `R` a secas el disco quedaba descentrado y
  orbitaba en pantallas con `devicePixelRatio` > 1.
- El historial no se pinta mientras la bola rueda (cantaba el número), y
  después del primer giro `reposa` ya no mueve la bola.
- El paño (`.jg-cs-rl-mesa`) lleva `overflow-y:hidden` y la casilla que
  sale late sin `transform`: crecerla desbordaba el paño y, con barras de
  desplazamiento clásicas (Windows), el paño saltaba en cada latido.
- `.jg-cs-juego` tiene filas `auto 1fr auto`: la columna de premios abarca
  dos filas y, con filas auto, empujaba el panel al crecer.

Las reglas de `casino` hay que **publicarlas a mano**: ver
`firebase/CONFIGURAR-FIREBASE.md`.

## El saldo que se ve (`casino.js`)

La lectura de `casino` llega juntada (1 s lo propio, 8 s lo ajeno), así que `cuenta()` resta
a mano lo apostado (`apuestas`) y cargado (`cargos`) y suma lo cobrado
(`premios`) hasta que la lectura lo trae. Al revés, un premio ya decidido
que la animación aún no cuenta se **esconde** (`api.oculta(k)`) hasta
`api.cobrado(k, pago)`: si no, el saldo y «Grandes premios» cantaban el
número antes que la rueda. Salir de un juego limpia los escondidos.
Blackjack y póker retoman al abrir una mano que quedó a medias.
