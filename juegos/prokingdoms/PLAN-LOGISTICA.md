# Pro Kingdoms: plan de la actualización «Caminos y Campamentos»

- **Fecha:** 15 de noviembre de 2026.
- **Versión evaluada:** `pk-40`. El plan se basa en la lectura del código de `js/`, `server/` y `functions/`, no en una partida.
- **Pedido del dueño:** los materiales viven en los edificios, carretas con origen y destino, un carromato grande
  para traer lo de los campamentos, autopistas compartidas, una Gran Puerta, rutas por tiempo (no por distancia),
  aldeanos asignados a un edificio con radio de trabajo, recursos que duran más y zonas comunes que cada jugador ve
  enteras, cuevas y mazmorras más lejos para todos, y murallas ajenas visibles que no se pueden cruzar.
- **Cómo pedirlo:** «implementa la Fase L1 del plan de logística de Pro Kingdoms». Cada fase es una entrega (un PR,
  una versión `pk-N`). Las reglas de la sección 1 de `PLAN-MEGA-ACTUALIZACION.md` siguen valiendo todas (caché,
  sonido, celular, i18n, sin conexión igual que en vivo, el servidor decide lo que toca a otros). Las notas de lo que
  se decida al implementar van a `juegos/prokingdoms/CLAUDE.md`, como siempre.
- **Avance:** L1 hecha en `pk-41`.
- **Decisiones del dueño:** respondidas el 15 de noviembre de 2026 (sección 11). Mandan sobre cualquier otra parte
  del plan.

---

## Índice

0. [Resumen](#0-resumen)
1. [Cómo funciona hoy lo que este plan cambia](#1-cómo-funciona-hoy-lo-que-este-plan-cambia)
2. [Revisión de cada pedido: ¿se puede?](#2-revisión-de-cada-pedido-se-puede)
3. [Las decisiones de fondo](#3-las-decisiones-de-fondo)
4. [Fase L1: rutas por tiempo y carretas con origen y destino (`pk-41`)](#4-fase-l1-rutas-por-tiempo-y-carretas-con-origen-y-destino-pk-41)
5. [Fase L2: aldeanos con lugar de trabajo y radio (`pk-42`)](#5-fase-l2-aldeanos-con-lugar-de-trabajo-y-radio-pk-42)
6. [Fase L3: los materiales viven en los edificios, carromatos y Gran Portón (`pk-43`)](#6-fase-l3-los-materiales-viven-en-los-edificios-carromatos-y-gran-portón-pk-43)
7. [Fase L4: el mundo de cada uno (`pk-44`, servidor)](#7-fase-l4-el-mundo-de-cada-uno-pk-44-servidor)
8. [Fase L5: autopistas compartidas (`pk-45`, servidor)](#8-fase-l5-autopistas-compartidas-pk-45-servidor)
9. [Ideas que suman al plan](#9-ideas-que-suman-al-plan)
10. [Trampas conocidas](#10-trampas-conocidas)
11. [Decisiones del dueño (respondidas)](#11-decisiones-del-dueño-respondidas)
12. [Tamaño y orden](#12-tamaño-y-orden)
13. [Fase L6: el mar, con barcazas de carga (`pk-46`)](#13-fase-l6-el-mar-con-barcazas-de-carga-pk-46)

---

## 0. Resumen

| # | Pedido | ¿Se puede? | Qué hay que ajustar para que funcione | Fase |
|---|---|---|---|---|
| M1 | Los materiales viven en los edificios, no en un arca común | Sí | Un «libro mayor»: cada bodega guarda lo suyo y `S.res` pasa a ser el total de las bodegas del pueblo (sección 3.1). Así no hay que reescribir los ~170 lugares que leen `S.res`. | L3 |
| M2 | Lo que llega a un campamento maderero o minero se queda ahí y no sirve para mejoras | Sí | Los campamentos tienen su propia bodega con tope. **Sin un carromato desde la Era I, el juego se traba**: hoy todas las minas quedan fuera de tu tierra (despeje de `pk-40`). | L3 |
| M3 | Carromato grande, detallado, que sale del reino y trae mucho más, con origen y destino elegidos | Sí | Edificio nuevo (Establo de Carromatos, Era I), sprite nuevo y un perfil de ruta propio. | L3 |
| M4 | Todas las carretas con origen y destino; esperan en el origen; se pueden entrenar más | Sí | Rutas guardadas (`st.logi.rutas`), más carretas por Carretería. **Sin modo automático** (decisión 2): las carretas de las partidas viejas quedan paradas con un aviso para que el jugador les defina ruta. | L1 |
| M5 | Autopistas de piedra anchas, fuera del reino, que usa cualquiera | Sí, solo en línea | Es estado compartido: lo guarda y valida el servidor. En modo local solo existen las tuyas. | L5 |
| M6 | Una Gran Puerta ancha y animada, la única por donde los carromatos cruzan la muralla | Sí | Tiene que llegar **junto con** los carromatos (L3): sin ella, un reino amurallado no podría usarlos. | L3 |
| M7 | Las carretas eligen el camino más rápido, no el más corto | Sí | A* con costo por tiempo (1 / velocidad de la casilla), rutas guardadas en caché y un arreglo en el suavizado del camino. | L1 |
| A1 | Aldeanos asignados a un edificio, que no se mueven a otro y trabajan dentro de un radio | Sí | Campo `u.base`, radio y puestos por edificio, el Capataz asigna edificios en vez de recursos. | L2 |
| R1 | Que los recursos no se acaben tan rápido; las zonas comunes, cada jugador las ve enteras | Sí | Cada cliente lleva su propio estado de los recursos y el servidor deja de sincronizarlos (baja la descarga). Montos más grandes, medidos con el piloto. | L4 (montos en L2) |
| C1 | Cuevas, mazmorras y materiales de un territorio se mudan más lejos, y para todos | Sí | El despeje pasa a ser una función pura del territorio de **todos** (que ya decide el servidor) y del mapa fijo. Así todos calculan lo mismo sin guardar nada. | L4 |
| W1 | Ver las murallas de los demás y no poder entrar libremente | Sí, con servidor | Hoy las murallas no viajan al servidor. Van en la foto del reino (solo cuando cambian), con validación. | L4 |
| — | El archipiélago con la logística nueva (decisión 10) | Sí | Los carromatos no cruzan agua: hace falta una **barcaza de carga** entre las colonias y la isla de casa. | L6 |

Una sola cosa del pedido no se puede tal cual: **que los campamentos funcionen sin transporte en la Era I.** Hoy las minas
quedan fuera de tu tierra, así que la piedra de la Era I llegaría a un campamento y se quedaría ahí. Por eso el
Establo de Carromatos es de la Era I y el primer carromato viene gratis con él (sección 6.3).

---

## 1. Cómo funciona hoy lo que este plan cambia

- **Recursos:** un solo número por recurso en `S.res` (`js/game.js`). El tope es la suma de las bodegas
  (`computeCaps`: Centro Urbano, Granero, Almacén). `G.pay`, `G.give`, `G.addRes` y unas 170 líneas en 20 archivos
  leen o escriben `S.res` directo (mercado, consejo, saqueos, diplomacia, misiones, red…).
- **Acopio:** el Centro Urbano, el Campamento Maderero, el Campamento Minero y el Molino tienen `def.drop`. El aldeano
  descarga en el más cercano que acepte el recurso (`G.findDrop`) y `G.deposit` suma a `S.res` (el edificio se
  ignora: `void b`). Los campamentos pueden ir en tierra de nadie (`G.OUTPOST`).
- **Talleres:** ya tienen bodega propia (`b.inb`, `b.outb`). Se abastecen solos a 3 casillas de un almacén
  (`L.nearStore`), o con carretas, o con cintas.
- **Carretas** (`js/logistics.js`): no tienen ruta. `findJob` elige cada 1,5 s el viaje más urgente entre talleres y
  bodegas, y sin trabajo vuelven a la Carretería. Tope `1 + nivel` por Carretería (máx. 2), carga 20.
- **Rutas:** `W.findPath` (`js/world.js`) es un A* de 8 direcciones con costo 1 por casilla: busca el camino **más
  corto**, no el más rápido. La velocidad del camino solo se aplica al caminar (`step` en `entities.js`: caminos ×1,8
  para carretas, ×0,65 fuera del camino). Además, `step` se salta los puntos intermedios que ve en línea recta, así
  que una carreta que va por un camino en L se sale de él para cortar la esquina.
- **Aldeanos:** trabajan por recurso (`A.JOBS`), y `G.bestNode` busca cada vez más lejos (16, 34, hasta 100
  casillas) cuando se agota lo de al lado. No hay radio.
- **Zonas comunes:** sus recursos son del servidor (`w.nodes` en `sim.js`), que los descuenta con lo que cosecha cada
  jugador (`checkHarvest`) y con la presión de los reinos simulados (`tickWorld`). Los demás recursos (tierra de nadie,
  tu tierra) ya son de cada cliente.
- **Despeje** (`js/despeje.js`, `pk-40`): solo mira **tus** parcelas, muda las cosas a la tierra de nadie **más
  cercana** y lo guarda en tu partida. Los demás siguen viendo las cosas donde estaban.
- **Murallas** (`js/defense.js`): casillas en `W.wall` (1 muralla, 2 puerta) y en `st.def`. La foto que va al
  servidor solo lleva el nivel de la técnica, no las casillas: nadie ve las murallas de otro.

---

## 2. Revisión de cada pedido: ¿se puede?

### M1 y M2. Materiales en los edificios

Se puede, con una condición técnica: **no conviene cambiar `S.res` por un inventario por edificio en todo el
código de una vez.** Son unos 170 usos en 20 archivos, y varios son delicados (la reserva de los talleres, el
mercado con tope diario del servidor, la meta de era). La solución es el libro mayor de la sección 3.1: cada bodega
tiene `b.inv`, `S.res` sigue existiendo como el total de las bodegas del pueblo y una conciliación reparte las
diferencias. El código viejo sigue andando y lo nuevo (descargar, cargar una carreta, un saqueo) toca el edificio.

Los campamentos guardan aparte (`b.inv` que **no** suma a `S.res`): eso cumple «no se pueden usar para mejoras».

Ajuste necesario: **la Era I.** Sin transporte desde el principio, el primer campamento minero se llena y nada llega
al Centro Urbano. Ver 6.3.

### M3. El carromato

Se puede. Es una unidad nueva (`kind: 'carromato'`) con su perfil de ruta, su sprite (más grande que la carreta:
dos bueyes, toldo, ruedas grandes, carga visible según lo que lleva) y su edificio. Ocupa una casilla para chocar,
como la carreta; dibujarlo grande no necesita que ocupe dos (eso sería otro motor de rutas).

### M4. Carretas con origen y destino

Se puede. Lo que hay que cuidar:

- **La reserva de los talleres** (`pk-36`, `pk-40`): al cargar desde una bodega para un taller, la carreta vuelve a
  mirar `reserveOf` en el momento de cargar. Las rutas heredan esa regla.
- **«Esperan en el origen»** cambia un comportamiento que la gente ya usa: hoy las carretas se reparten solas. El dueño
  decidió que **no** haya modo automático (decisión 2): `findJob` desaparece, y las carretas de las partidas viejas
  quedan paradas con un aviso que explica la actualización y lleva a definir sus rutas (4.4).
- **Sin conexión** (regla 8): las rutas necesitan un cálculo sin conexión que dé lo mismo que en vivo (sección 4.5).

### M5. Autopistas compartidas

Se puede, pero **solo el servidor puede hacerlas compartidas.** Lo que se agrega:

- Una capa nueva del mapa que guarda y valida el servidor, en un documento propio (`autopistas/<mundo>`), para que
  guardar una casilla no vuelva a subir el documento del mundo entero.
- El servidor no ve los recursos de cada cliente ni los edificios que no son tuyos: valida con lo que sí ve (agua,
  zonas, territorio, el mapa fijo, la posición de los lugares si el despeje pasa a ser una función pura, ver C1) y con
  un tope de casillas por día. El costo lo paga el cliente, como las murallas: el tope es lo que impide abusar.
- Un árbol en tierra de nadie es distinto para cada cliente. Donde hay autopista, cada cliente lo quita de su mapa.

### M6. Gran Puerta (en el juego, «Gran Portón»)

Se puede. Hoy una puerta es una casilla con `W.wall = 2`. La Gran Puerta es un **edificio** de 4 × 2 que va en la
línea de la muralla, con dos torres y un paso de 2 casillas de ancho marcado `W.wall = 3`: pasan tus unidades, no
pasan lobos, bandidos ni otros reinos (`noGate` también la cierra). El perfil de ruta del carromato **no** pasa por
puertas chicas (`W.wall = 2`). Tiene que llegar en la misma entrega que el carromato.

### M7. El camino más rápido

Se puede. El A* pasa a usar como costo de cada casilla el tiempo que tarda esa unidad en cruzarla (1 / velocidad):
campo, camino, autopista, puertas y territorio ajeno según el perfil (tabla de 4.1). Lo que hay que resolver:

- **La heurística se debilita.** Para no sobrestimar, tiene que usar el costo de la casilla más rápida (la
  autopista), y el A* explora más casillas. Como las carretas ahora tienen ruta fija, el camino se calcula **una vez
  por ruta** y se guarda hasta que cambie algo del mapa. Eso lo hace barato.
- **El suavizado de `step` saca a las carretas del camino.** Solo puede saltarse puntos si todas las casillas
  intermedias tienen el mismo costo que la actual.
- **Los aldeanos siguen con el camino más corto.** Con el radio de L2 sus caminos son cortos y no ganan nada.

### A1. Aldeanos con lugar de trabajo

Se puede y además ayuda al rendimiento: con radio, nadie busca recursos a 100 casillas. Cambia mucho la ventana
Aldeanos, el Capataz, «Ocupar los talleres», el piloto, el tutorial y el cálculo sin conexión (sección 5).

### R1. Recursos que duran más y zonas comunes de cada uno

Se puede, y **las dos cosas se resuelven juntas**: si cada jugador ve las zonas comunes enteras, «unos pocos se acaban
los recursos de todos» deja de pasar por construcción. Lo que cambia:

- El servidor deja de guardar y mandar los recursos de las zonas comunes (`w.nodes`, `nv`, `checkHarvest`, la
  presión de los reinos simulados). Baja la descarga de cada sync.
- El antitrampas no se pierde: la foto del reino ya limita cuánto puede crecer cada recurso (`checkSnap`).
- En modo local, los reinos simulados dejan de gastar tus recursos (hoy los gastan al 30%).
- Que duren más se hace con montos más grandes (sección 5.6), no bajando la recolección: la prueba de ritmo de `pk-34`
  se rompería. La regla vieja de «no tocar los `amount`» deja de valer, porque el servidor ya no los usa para nada.

### C1. Cuevas y mazmorras más lejos, para todos

Se puede si el despeje deja de depender de la historia de cada partida. Hoy guarda lo que movió (`st.despeje.n` y
`.p`) y mira solo tus parcelas. La versión nueva:

- es una **función pura** del territorio de todos los reinos (`W.terr`, que decide el servidor) y del mapa fijo:
  mismo territorio, mismas posiciones, en cualquier cliente y en el servidor;
- solo mira datos que todos tienen iguales (terreno, zonas, `W.reserved`, `W.terr` y lo que ya ubicó, en orden de id),
  nunca edificios, caminos ni árboles talados de cada uno;
- deja todo a una distancia mínima de **cualquier** territorio (`Dz.LEJOS`, propuesta: 12 casillas).

### W1. Murallas ajenas visibles y sólidas

Se puede. Hoy no se mandan. Van en la foto del reino, solo cuando cambian (como los edificios con `bver`). El servidor
las valida (cada casilla en una parcela del dueño, tope por era) y las reparte. En tu mapa bloquean, y sus puertas
están cerradas para ti. Cuidado: el cálculo de «parcela amurallada» (`compute` en `defense.js`) cuenta como barrera
cualquier `W.wall`; tiene que mirar solo las tuyas.

---

## 3. Las decisiones de fondo

### 3.1. El libro mayor: cada bodega guarda lo suyo

- **Bodegas del pueblo:** Centro Urbano, Almacén, Granero, y el Molino si está en tu territorio. Cada una tiene
  `b.inv = { recurso: cantidad }` y su propio tope (el `cap`/`capFood`/`capGoods` de hoy, que pasa de sumarse a
  limitar cada edificio).
- **`S.res` es la suma de las bodegas del pueblo.** Todo lo que paga o premia (mejoras, mercado, cofres, consejo…)
  sigue escribiendo `S.res`. Eso es lo que sirve para construir: «el pueblo usa lo que haya en cualquiera de sus
  bodegas».
- **`L.conciliar()`** corre después de cada paso y antes de guardar: si `S.res[r]` no coincide con la suma de los
  `inv`, reparte la diferencia. Un gasto sale de las bodegas con más stock; una entrada sin lugar conocido va a las
  bodegas con espacio más cercanas al Centro Urbano; lo que pasa del tope (premios, regla de `pk-34`) queda en el
  Centro Urbano.
- **Lo que tiene un lugar toca el edificio y `S.res` juntos:** descargar un aldeano (`G.deposit(u, b)` ya recibe el
  edificio), cargar o descargar una carreta, un saqueo, demoler o mudar. Así la conciliación ve diferencia cero.
- **Campamentos** (y el Molino fuera de tu tierra): `b.inv` propio que no suma a `S.res`. No sirve para pagar.
- **Talleres:** siguen con `inb`/`outb`. `L.direct` (taller a 3 casillas de una bodega) saca de **esa** bodega.
- **Guardado:** `b.inv` va en el `toJSON` del edificio. Al cargar, `S.res` se recalcula desde los `inv`. Una partida
  vieja sin `inv` no necesita migración: la conciliación mete su `S.res` en las bodegas la primera vez.
- **Lo que no es físico** (cristales y demás tesoros con tope infinito, gemas del pase, monedas del reino, recursos
  del otro mundo) queda en `S.res` sin edificio.
- **Foto al servidor:** `res` = bodegas del pueblo + campamentos + lo que llevan las carretas. Si solo mandara el
  pueblo, descargar un carromato de 200 parecería un salto y `checkSnap` lo recortaría como trampa.

### 3.2. Dos clases de carreta

| | Carreta (de hoy) | Carromato (nuevo) |
|---|---|---|
| Se hace en | Carretería (Era II) | Establo de Carromatos (Era I) |
| Carga | 20 + 5 por nivel (como hoy) | 200 + 40 por nivel del Establo |
| Dónde anda | Solo dentro de tu territorio | Dentro y fuera |
| Une | Bodega ↔ taller, taller ↔ taller, bodega → bodega | Campamento → bodega o taller que use ese recurso |
| Murallas | Puertas chicas y Gran Portón | Solo el Gran Portón |
| Rápida en | Caminos (×1,8) | Autopistas (×3,2) |

La regla para el jugador: **las carretas son del pueblo, los carromatos son del camino.** Las carretas no van a los
campamentos.

### 3.3. Perfiles de ruta

Costo de cada casilla = 1 / velocidad. Valores iniciales, para afinar con el piloto:

| Casilla | Aldeano | Carreta | Carromato |
|---|---|---|---|
| Campo | 1 | 1 / 0,65 | 1 / 0,55 |
| Camino | 1 / 1,4 | 1 / 1,8 | 1 / 1,5 |
| Autopista | 1 / 1,5 | 1 / 2,2 | 1 / 3,2 |
| Puerta chica | pasa | pasa | **no pasa** |
| Gran Portón | pasa | pasa | pasa |
| Muralla o puerta ajena | no pasa | no pasa | no pasa |
| Tierra ajena sin muralla | ×4 | no pasa | ×4 |
| Fuera de tu territorio | pasa | **no pasa** | pasa |

Los aldeanos siguen usando el A* de hoy (costo 1); la columna solo dice su velocidad al caminar.

---

## 4. Fase L1: rutas por tiempo y carretas con origen y destino (`pk-41`)

Solo cliente, sin reinicio. Prepara el motor que usan las fases siguientes.

### 4.1. El A* por tiempo (`js/world.js`)

- `W.rutaRapida(sx, sy, goal, perfil, maxIter)`: el mismo A* con montículo, pero el costo de cada paso sale de una
  tabla `Float32Array` por perfil (`W.costos[perfil]`), con `Infinity` donde no pasa. La diagonal cuesta ×1,414 y no
  corta esquinas, como hoy.
- Las tablas se rehacen solo cuando cambia algo: una versión que junta `W.roadVer`, `G.blockVer`, `W.wallVer` (nueva),
  `W.terrVer` y, desde L5, `W.apVer`.
- Heurística: distancia octil × el costo mínimo del perfil (la casilla más rápida), para no pasarse nunca.
- `maxIter` de hasta 65.536 (todo el mapa), porque el resultado se guarda.
- `W.findPath` no cambia: lo siguen usando aldeanos, lobos, bandidos y tropas.

### 4.2. Caché de rutas (`js/logistics.js`)

- `L.camino(desde, hasta, perfil)` devuelve `{ path, segundos }` y lo guarda por `desde:hasta:perfil` hasta que
  cambie la versión del mapa. Si el mapa cambia, la ruta se marca vieja y se recalcula en una cola: como mucho **2
  rutas por cuadro**, para no trabar.
- `segundos` es lo que muestra la ventana («ida 48 s») y lo que usa el cálculo sin conexión.

### 4.3. El suavizado no corta caminos (`entities.js`, `step`)

- Las carretas y los carromatos solo se saltan un punto del camino si todas las casillas en línea recta tienen el
  mismo costo que la casilla donde están. Sin esto, un camino en L se recorta por el pasto y la ruta rápida no sirve.

### 4.4. Rutas de carretas

- `st.logi.rutas = [{ id, de, a, res, carros }]`. `res` es un recurso o `null` (todo lo que el destino acepte). No hay
  modo automático (decisión 2): `findJob` se borra.
- Cada carreta tiene `u.ruta = id`. Una carreta sin ruta espera en la Carretería con el estado «Sin ruta».
- **Partidas viejas** (decisión 1: se migra, no se reinicia): al cargar, todas las carretas quedan sin ruta y paradas. Una
  tarjeta única (`flags.avisoRutas`, con el estilo del cartel de `D.NOVEDADES`) explica que desde esta versión cada
  carreta necesita origen y destino, con un botón «Definir rutas» que abre Logística → Rutas. Mientras haya carretas sin
  ruta, Logística lleva un «!» en el menú y el Asesor tiene una regla («Tienes N carretas paradas sin ruta»).
- Una carreta recién hecha también nace sin ruta, y su panel ofrece «Asignar a una ruta».
- **Ciclo:** ir al origen → cargar lo que haya hasta la carga máxima (respetando `reserveOf` al cargar, regla de
  `pk-36`) → si no hay nada, **esperar en el origen** («Esperando carga») y mirar cada 3 s → ir al destino → descargar →
  si el destino está lleno, esperar ahí («Destino lleno») sin perder nada → volver vacía.
- Sale con media carga como mínimo, o con lo que haya después de 60 s de espera.
- **Más carretas:** la Carretería da `2 + 2 × nivel` (era `1 + nivel`), máx. 2 Carreterías.
- `L.supplied(b)` (taller abastecido) pasa a ser: junto a una bodega, con una cinta, o con una ruta que termina en él.

### 4.5. Sin conexión (regla 8)

- Por ruta y por cada tramo de 60 s del cálculo: `viajes = carros × dt / (ida + vuelta + 2 s de carga)`, y lo movido
  es `min(viajes × carga, lo que hay en el origen menos la reserva, el lugar en el destino)`. `ida` y `vuelta` salen de
  la caché (se calculan antes de empezar el cálculo sin conexión).
- Orden en cada tramo: recolección, rutas, talleres. En vivo el resultado tiene que caer cerca de esto (prueba).

### 4.6. Interfaz

- Ventana **Logística → Rutas**: una fila por ruta (origen → destino, recurso, carretas asignadas con − y +, ida y
  vuelta en segundos, ritmo estimado «≈ 40 por minuto», estado). «Nueva ruta»: origen, destino y recurso con tres
  selectores; también se puede tocar el origen y el destino en el mapa.
- En el panel de cada edificio: «Rutas desde aquí» y «Rutas hacia aquí», con «+ Ruta».
- Al elegir una ruta, el mapa dibuja su camino.
- En el celular, los selectores van uno debajo de otro (regla 10: probar a 390 × 844 y en horizontal).

### 4.7. Criterios de aceptación de L1

- Con un camino que da un rodeo de 1,5 veces la distancia pero que es más rápido, la carreta toma el camino (prueba en
  `prokingdoms.test.cjs` con un mapa chico).
- Una carreta en un camino en L no pisa el pasto.
- Una ruta sin carga espera en el origen y no vuelve a la Carretería.
- Una partida de `pk-40` carga con sus carretas paradas, ve la tarjeta una sola vez y el «!» se va al asignarles ruta.
- El piloto (`?timelapse`) arma sus rutas (cada taller lejos de una bodega recibe una) y no queda peor que `pk-40` en la
  Era II y III.

---

## 5. Fase L2: aldeanos con lugar de trabajo y radio (`pk-42`)

Solo cliente, sin reinicio. Todavía con `S.res` como hoy: los campamentos siguen siendo acopio directo.

### 5.1. Lugar de trabajo

- Cada aldeano tiene `u.base` (id de un edificio): Centro Urbano, campamento, Molino, granja, muelle, taller. Excavar
  ruinas sigue como hoy.
- **El aldeano no cambia de edificio solo.** Recolecta lo más cercano **al edificio** dentro de su radio y descarga ahí.
- Una orden del jugador (asignar a un edificio) queda marcada (`task.m`, como hoy) y el Capataz no la toca.

### 5.2. Radio y puestos

| Edificio | Radio (casillas) | Puestos | Qué saca |
|---|---|---|---|
| Centro Urbano | 12 | 8 + nivel | lo que el jugador elija (como hoy) |
| Campamento Maderero | 10 + ⌊nivel / 2⌋, máx. 16 | 3 + nivel, máx. 12 | madera |
| Campamento Minero | igual | igual | lo que diga el campamento: «Auto» o un mineral |
| Molino | 10 | 3 + nivel | bayas, caza y las granjas cercanas |
| Granja, muelle | — | 1 (como hoy) | lo suyo |
| Talleres | — | sus puestos (como hoy) | — |

- `G.bestNode` recibe el centro y el radio del edificio y **no busca más allá**. Desaparece el «cada vez más lejos».
- Sin nada en el radio, el aldeano espera junto al edificio («Nada en el radio: rebrota en 12 min») y el Asesor
  propone mudar el campamento (botón «Mover», que ya existe).
- El fantasma de un campamento dibuja su radio y dice lo que hay adentro: «En el radio: 34 árboles (≈ 8.500 de
  madera)». Elegir un campamento también dibuja su radio.

### 5.3. El Capataz

- Reparte los ociosos entre **edificios** según las prioridades (comida, madera, piedra…), y el reequilibrio mueve
  gente entre edificios, nunca una orden tuya.
- «Ocupar los talleres», los planes y la «Meta de era» siguen igual por fuera.
- Puestos avanzados (`A.lejos`, `A.proponerCampo`): ahora también ofrecen la ruta del carromato (desde L3).
- En el mar, nunca un edificio de otra isla (`otraIsla`).

### 5.4. Ventana Aldeanos

- Una lista por edificio, agrupada por tipo: aldeanos/puestos con − y +, qué saca, estado del radio («quedan 12
  árboles», «agotado»). Arriba, el total por recurso como hoy.
- En el panel de cada edificio: «Trabajadores 4/7» con − y +.
- La fila de `.job-row` tiene 6 columnas de grilla (`pk-36`): la nueva fila por edificio tiene su propia clase.

### 5.5. Sin conexión, piloto y tutorial

- `G.simulateOffline` busca con el radio de la base y descarga en la base.
- El piloto asigna aldeanos a edificios y pone campamentos donde el radio tiene recursos.
- El tutorial (`GUIA`, pasos m1–m4) dice «asigna aldeanos al Centro Urbano» en vez de «manda a recolectar».

### 5.6. Recursos que duran más

- Montos iniciales ×2,5 para árboles y arbustos, ×2 para minas y vetas, y la fracción de regeneración de las minas a
  la mitad (así rellenan lo mismo por hora en valor absoluto). Medir con el piloto antes y después: el ritmo de la
  sección 12 del plan grande (Era II ~10 min, IV ~2 h, V 4–6 h) no debe empeorar.
- Hasta L4 el servidor usa `D.NODES` para las zonas comunes: si cambian los montos en L2, hay que desplegar la
  función con esta entrega. Si se prefiere no desplegar, los montos pasan a L4.

### 5.7. Criterios de aceptación de L2

- Ningún aldeano recolecta fuera del radio de su base (prueba: muchos pasos de simulación y ninguna distancia mayor).
- Un aldeano asignado a mano no cambia de edificio aunque su radio se agote.
- Con 300 aldeanos, la simulación no es más lenta que en `pk-32` (`tools/rendimiento.js`).

---

## 6. Fase L3: los materiales viven en los edificios, carromatos y Gran Portón (`pk-43`)

La entrega más grande. Casi todo es del cliente: el servidor solo tiene que conocer los dos edificios nuevos
(`cleanBuildings` descarta los tipos que no conoce) y recibir en la foto el total que incluye los campamentos.

### 6.1. El libro mayor

Tal como la sección 3.1. Además:

- `G.isFull` mira la base del aldeano: si el campamento está lleno, sus aldeanos esperan («Campamento lleno: falta un
  carromato») y no gastan el recurso del mapa (regla de `pk-34`).
- Tope del campamento: `300 + 150 × (nivel − 1)` en total, para afinar.
- **Saqueos de bandidos** (`incursiones.js`): ya marchan a la bodega más cercana; ahora roban de **esa** bodega (hasta
  el 30% de lo que tiene, con el tope por era de hoy). Un campamento afuera, sin muralla ni torres, es un blanco fácil:
  eso le da sentido a defenderlos. Siguen siendo solo en vivo.
- **Saqueos del servidor** (`saqueos.js`) y tributos: salen del pueblo (`S.res`), como hoy.
- **Demoler o mudar** un campamento: lo que tenía va al pueblo entero («la carga nunca se pierde», `pk-36`).
- Las bodegas muestran su stock en el panel (barra por recurso) y en el mapa (pilas de troncos, bloques, sacos según
  el porcentaje: `sprites.js`, con caché por tramo de 25%).

### 6.2. El carromato

- Unidad `kind: 'carromato'`, sprite propio de unos 2 × 1,5 casillas de dibujo: yunta de bueyes, toldo con el color
  del reino, ruedas grandes que giran, carga visible por recurso (troncos, piedras, sacos), polvo detrás. Caché por
  dirección, cuadro y recurso, como las demás figuras.
- Las rutas de L1, con perfil `carromato` y las reglas de 3.2. Origen: un campamento. Destino: una bodega del pueblo o
  un taller que use ese recurso (campamento maderero → Aserradero directo).
- Va en la foto de unidades como tipo 3 (`a[9] === 3` en `applyUnits`), para que los demás vean tus carromatos.
- Suena: bueyes y ruedas al pasar cerca (`R.sonarEn`, con lugar, como pide `pk-37`).

### 6.3. Establo de Carromatos

- Edificio nuevo en `data.js` (no en `datos-vida.js`: `cleanBuildings` del servidor descarta tipos que no conoce), 4 × 3,
  Era I, `max: e => 1 + ⌊e / 3⌋`. Carromatos por establo: `1 + nivel`.
- **El primer establo trae un carromato gratis.** Sin eso, el primer campamento minero de la Era I se llena y la Era I
  se traba.
- Carromato: madera 150 y oro 10 en la Era I, más caro después (`D.CARROMATO`). Tiempo 45 s.
- Las mejoras de velocidad y carga de hoy (`cartBoost` de la Casa de Fieras y el Faro, la técnica de carretas, el
  árbol 2.0) también suben al carromato.
- **Nuevo tipo de edificio → `D.PROTO` 9 y desplegar la función con esta entrega.**

### 6.4. El Gran Portón

- Edificio `granporton`, 4 × 2 o 2 × 4 (se gira con R o con un botón en el celular; `b.rot`). Era I, `max: e => 1 + ⌊e
  / 3⌋`. Madera 200, piedra 120.
- Dos torres en los extremos (bloquean) y un paso de 2 × 2 (`W.wall = 3`). Se puede poner sobre la muralla: las casillas
  de muralla que reemplaza devuelven la mitad, como `Def.gate`.
- **Pasan** tus aldeanos, carretas y carromatos. **No pasan** lobos, bandidos ni otros reinos: `findPath` con `noGate`
  trata el 3 como el 2, y los perfiles de ruta lo dejan pasar.
- Cuenta como muralla para «parcela amurallada» y para la defensa (`Def` y `D.parcelDefense`).
- **Su aspecto sigue el material de la muralla** (`Def.tier`): madera con estacas, piedra con almenas, sillares con
  rastrillo, bastión con estandartes. Con el Pase, puede tener aspecto como cualquier edificio (`b.asp`).
- **Animación:** dos hojas que se abren (en piedra o más, un rastrillo que sube) cuando una unidad tuya está a menos de
  2,5 casillas del paso, y se cierran 1,5 s después. Antorchas de noche, banderas que flamean. Sonido grabado
  `porton` (ElevenLabs, ganancia medida como en `pk-38`).
- El Asesor avisa: «Tu muralla no tiene Gran Portón: tus carromatos no pueden entrar».

### 6.5. Sin conexión

- La recolección sin conexión descarga en la base (campamento, con su tope), las rutas de carromato mueven del
  campamento a su destino con la fórmula de 4.5, y después trabajan los talleres.

### 6.6. Criterios de aceptación de L3

- Invariante en una prueba con miles de operaciones al azar (pagar, premiar, descargar, cargar, saquear, demoler): la
  suma de `inv` del pueblo es `S.res`, nada queda negativo, nada desaparece.
- Una partida vieja (`pk-42`) carga y sus recursos quedan repartidos en sus bodegas.
- Era I con el piloto: el primer campamento minero no se traba (el carromato gratis lo vacía).
- Un reino amurallado sin Gran Portón ve el aviso, y con el portón el carromato entra por ahí y nunca por una puerta
  chica.
- La prueba de ritmo de `pk-34` repetida: Era V entre 4 y 6 h de juego.
- Pasada de Playwright por todas las ventanas en 390 × 844, 915 × 412 y 1280 × 800 (como en `pk-36`).

---

## 7. Fase L4: el mundo de cada uno (`pk-44`, servidor)

Cliente y servidor juntos. `D.PROTO` 10. Desplegar la función al hacer merge, y probar con `tools/cheat-test.js` y
`cd functions && npm run prueba`.

### 7.1. Zonas comunes de cada jugador

- **Cliente:** `W.serverNodes` deja de existir (siempre local). Fuera `Net.harvest`, `applyNodes` y el envío de
  `harvest`. Los recursos de las zonas comunes rebrotan en cada cliente como los demás. Las estadísticas
  `z_<zona>`, `z_<tipo>` y `g_common` siguen igual (misiones `e3` y compañía).
- **Modo local:** los reinos simulados ya no restan `n.amount` (su recolección se ve, pero no gasta lo tuyo).
- **Servidor** (`sim.js`): fuera `COMMON`, `w.nodes`, `w.nv`, `checkHarvest`, la presión de los bots en `tickWorld` y
  el campo `nodes` de la respuesta del sync. La foto sigue limitando lo que crece cada recurso.
- Los mundos guardados pierden `nodes` y `nv` al cargar (limpieza, no reinicio).
- Lo que se gana: la primera sincronización baja bastante de 23 KB y cada sync deja de traer recursos.

### 7.2. Despeje para todos y más lejos (`js/despeje.js` → parte pura en `js/world.js`)

- `W.ubicarLugares()` es una función pura: recorre los lugares y luego los recursos (que no sean árboles ni arbustos) en
  orden de id; a cada uno que cae en una parcela con dueño (**de cualquier reino**) le busca la casilla más cercana a su
  posición original que esté a `Dz.LEJOS` (12) casillas o más de todo territorio y libre según datos fijos (terreno,
  zonas, `W.terrCommon`, `W.reserved` y lo ya ubicado).
- Para que sea rápido: un mapa de distancias al territorio por BFS (uno por `W.terrVer`), y después la búsqueda por
  anillos que ya existe.
- Vive en `world.js` para que el servidor la pueda correr igual (la necesita L5 para validar autopistas).
- Se recalcula cada vez que cambia `W.terrVer`, siempre desde las posiciones originales. Se borran `st.despeje.n` y
  `.p` de las partidas (talados y plantas se quedan).
- Si un lugar cae justo donde un jugador tiene un campamento en tierra de nadie (no es dato común), en ese cliente el
  campamento manda y el lugar se corre a la siguiente casilla libre. Es raro y solo afecta a ese jugador.
- Los lugares que ya conocías se siguen viendo en su lugar nuevo (como hoy, con `W.reveal`).

### 7.3. Murallas ajenas visibles y sólidas

- **Foto:** `muros: { v, t: [índices], g: [índices], gp: [[x, y, rot]], tier }`, solo cuando cambia `v` (como `bver`).
- **Servidor** (`cleanMuros`): cada casilla dentro de una parcela del jugador según `w.terr`, cantidad bajo
  `D.WALL.max(era)` (nuevo, propuesta `300 + 150 × era`), y se reparte a los demás con versión (como los edificios con
  `kb`). Si una parcela cambia de dueño, se borran las murallas que tenía.
- **Cliente:** `W.wallOwner` (`Uint8Array`, casilla del reino + 1). Las murallas, puertas y Grandes Portones ajenos
  bloquean (`W.block = 5`). El cálculo de amurallado (`compute` en `defense.js`), `Def.allowed`, `Def.remove` y la
  herramienta de quitar miran solo las tuyas.
- **Dibujo:** con el material del dueño (`tier`) y su color en las banderas de los portones.
- **Tierra ajena sin muralla:** cuesta ×4 en las rutas (sección 3.3), así nadie la usa de atajo; los aldeanos ya no
  pueden recolectar ahí (`W.canUse`).
- **Reinos simulados:** murallas generadas por código (un anillo alrededor de su territorio con 2 a 4 portones, desde
  su era II), deterministas a partir de `W.terr`. Así el mundo se ve igual en modo local y con bots del servidor.
- Tamaño: unos 2 KB por reino cuando cambian sus murallas, nada en un sync normal.

### 7.4. Criterios de aceptación de L4

- Dos clientes con historias distintas de territorio terminan con las mismas posiciones de lugares y recursos (prueba).
- Nada movido queda a menos de 12 casillas de un territorio (salvo que no quepa en el mapa: entonces lo más lejos
  posible, y la prueba lo cuenta).
- `cheat-test.js`: murallas fuera de tus parcelas o sobre el tope se recortan y se anotan como sospecha.
- Un aldeano tuyo nunca cruza una muralla ajena.

---

## 8. Fase L5: autopistas compartidas (`pk-45`, servidor)

`D.PROTO` 11, desplegar la función. El nombre en el juego puede ser **Calzada Real** (más medieval); en el código,
`autopista`.

### 8.1. Qué es

- Una franja de piedra de **2 casillas de ancho**, con bordillos, mojones cada 8 casillas y un banderín con el color de
  quien la hizo en cada punta. De noche, faroles cada tanto (con la capa de noche que ya existe).
- Velocidad: carromato ×3,2, carreta ×2,2, aldeano ×1,5 (tabla 3.3).
- Se traza como el camino (arrastrar de A a B), con el plan escalonado de `L.roadPlan` ensanchado a 2.

### 8.2. Dónde y cuánto

- En tierra de nadie y en tu territorio. **No** en tierra ajena, agua, zonas comunes, lugares (con las posiciones de
  7.2) ni edificios.
- Costo: piedra 10 y madera 2 por casilla en las Eras I–II; 4 sillares desde la III.
- Tope: `60 × era` casillas por día UTC por jugador, y un total por mundo para que el documento no crezca sin fin.
- Quitar: las tuyas siempre; las de otro, solo si están en tu territorio.
- Bajo una autopista, cada cliente quita los árboles y arbustos de su mapa (como `n.gone`, pero recalculado desde la capa).

### 8.3. Servidor

- Documento propio `autopistas/<mundo>` = `{ v, t: { índice: casilla } }`, en JSON como los demás. `flush` solo lo sube
  cuando cambió.
- Ruta `POST /api/autopista { add: [...], del: [...] }` en `server/index.js` y `functions/index.js`. Valida con
  `world.js` (terreno, zonas, `w.terr`, `W.ubicarLugares()`), el tope diario y el total. Lo inválido se recorta y se
  anota.
- El sync manda `apv` (versión que tiene el cliente) y recibe `autopistas` (completa o el cambio) solo cuando cambió.
- En modo local, solo las tuyas, en la partida.

### 8.4. Cliente

- Capa `W.autopista` (`Uint8Array`), `W.apOwner` y `W.apVer`. Se dibuja en el trozo de suelo con caché, como los
  caminos. Al pasar el mouse: «Calzada de <nombre>» (`translate="no"` en el nombre, regla 12).
- La versión entra en la de las tablas de costo (4.1): al aparecer una autopista nueva, las rutas se recalculan solas.

### 8.5. Criterios de aceptación de L5

- Una ruta de carromato que tiene una autopista cerca la usa cuando conviene, y la ventana muestra el tiempo más corto.
- `cheat-test.js`: autopistas en tierra ajena, en agua o sobre el tope se rechazan.
- Dos clientes del mismo mundo ven la misma autopista unos segundos después de que se construye.

---

## 9. Ideas que suman al plan

- **Vista «Logística» en el mapa** (botón en Logística): dibuja todas las rutas con su color, los campamentos con barra
  de llenado y en rojo lo que está trabado (campamento lleno, destino lleno, ruta sin camino). Es lo que más ayuda a
  entender una red de transporte.
- **Ritmo de cada ruta a la vista:** «≈ 120 de madera por minuto» y, si hay una autopista más rápida disponible,
  «con la Calzada de Ana: ≈ 180». Enseña sola por qué conviene construirlas.
- **Solo si el dueño lo pide más adelante** (eligió rutas siempre a mano, decisión 2): «Rutas solas» en el Capataz (crea
  la ruta de un campamento nuevo) o un consejero Intendente de Caminos que reparte carretas entre rutas. Mientras tanto,
  el panel de un campamento recién terminado sugiere «+ Ruta de carromato» con la bodega más cercana ya elegida, sin
  crearla sola.
- **Defensa de campamentos:** empalizada alrededor del campamento y una torre cerca, ahora que los bandidos roban de
  ahí. Misión «Campamento fortificado».
- **Misiones nuevas** (rama Logística): primer carromato, primera ruta, 50 casillas de calzada, 1.000 llevados por
  carromato, Gran Portón, «una ruta de más de 60 casillas».
- **Desafío y título:** «Señor de los Caminos» por casillas de calzada construidas (lo cuenta el servidor; podría ir en
  los rankings de `pk-24`).
- **Mejoras del carromato** en el Establo: ruedas herradas (+velocidad fuera del camino), segunda yunta (+carga),
  toldo (los bandidos roban menos de un carromato en marcha).
- **Bandidos que asaltan carromatos** en tierra de nadie, solo en vivo, con escolta opcional: le da riesgo al camino.
  Podría ir después de L5, no es necesario para el pedido.

---

## 10. Trampas conocidas

- **Lo que pinta `S.res` es el total del pueblo**, no lo que hay en un edificio. Toda operación con lugar toca el
  edificio y `S.res` juntos; si no, la conciliación lo «arregla» moviendo cosas de un edificio a otro.
- **Nunca un tope por edificio en un premio**: la regla de `pk-34` (premios, botín y compras entran enteros) se cumple
  dejando el exceso en el Centro Urbano.
- **`step` y el suavizado** (4.3): sin el arreglo, la ruta por tiempo no sirve.
- **La heurística con el costo de la autopista** hace que el A* explore mucho: siempre por la caché y la cola de 2 por
  cuadro, nunca en cada decisión de una carreta.
- **El amurallado y las murallas ajenas** (7.3): `compute` cuenta cualquier `W.wall` como barrera.
- **El despeje solo puede mirar datos comunes** (7.2). Un edificio, un camino o un árbol talado de un jugador hacen que
  dos clientes vean cosas en lugares distintos.
- **El mar usa el mismo código** (`aplicarTema` reviste los mismos tipos: el Aserradero de teca es `lumber`, la Cantera
  de coral es `mining`, la Lonja es `mill`). Todo lo de L1–L3 vale también ahí desde que llega, así que la barcaza de L6
  tiene que ir pegada a L3: entre `pk-43` y `pk-46`, una colonia acumula en su muelle sin poder mandarlo. Si `pk-46` se
  atrasa, poner un puente provisional (el Muelle de la colonia suma al pueblo como hoy) y quitarlo en L6.
- **El piloto** tiene que aprender cada fase antes de medir: sin rutas ni bases, la prueba de ritmo mide al piloto, no al
  juego. Su `paso()` se traga las excepciones: revisar la consola.
- **Caché:** subir `?v=pk-N` de todos los scripts, `PK_VER` en `colabtex/src/juegos/prokingdoms.js` y correr
  `npm run build` en cada entrega (regla 6).

---

## 11. Decisiones del dueño (respondidas)

Respondidas el 15 de noviembre de 2026. Mandan sobre cualquier otra parte del plan.

1. **Se migra, no se reinicia.** Cada uno conserva su reino y la conciliación reparte sus recursos en sus bodegas. Las
   carretas **quedan paradas** y un aviso explica la actualización y pide definir a dónde van (4.4).
2. **No hay modo automático.** Toda carreta y todo carromato necesita origen y destino elegidos a mano. `findJob` se va.
3. **Los campamentos son solo para carromatos**, estén dentro o fuera de tu tierra. Las carretas chicas nunca van a un
   campamento.
4. **El Molino dentro de tu tierra es bodega del pueblo** (como el Granero). En tierra de nadie funciona como campamento.
5. **La tierra ajena sin muralla se cruza, pero cuesta ×4** en las rutas. Las murallas y puertas ajenas siempre bloquean.
6. **Autopistas fuera de las zonas comunes** (tierra de nadie y tu territorio). Las quita quien las hizo o el dueño del
   territorio donde quedaron.
7. **Cada jugador ve las zonas comunes enteras.** Se acepta perder la competencia por ellas y la presión de los reinos
   simulados.
8. **Los reinos simulados tienen murallas generadas por código** (anillo con 2 a 4 portones, desde su Era II).
9. **Distancia del despeje: 12 casillas** (`Dz.LEJOS`) de todo territorio.
10. **El archipiélago entra en este plan, con barcazas de carga** (sección 13, Fase L6).

---

## 12. Tamaño y orden

| Entrega | Fase | Servidor | Reinicio | Sesiones aprox. |
|---|---|---|---|---|
| `pk-41` | L1: rutas por tiempo, carretas con origen y destino | no | no | 2–3 |
| `pk-42` | L2: aldeanos con base y radio, montos más grandes | solo si cambian los montos (5.6) | no | 2–3 |
| `pk-43` | L3: libro mayor, campamentos con bodega, carromato, Establo, Gran Portón | desplegar (`D.PROTO` 9) | no | 4–5 |
| `pk-44` | L4: zonas comunes de cada uno, despeje para todos, murallas visibles | sí (`D.PROTO` 10) | no | 3–4 |
| `pk-45` | L5: autopistas compartidas | sí (`D.PROTO` 11) | no | 2–3 |
| `pk-46` | L6: el mar con barcazas de carga | no (el servidor no ve el mar) | no | 2–3 |

En total, unas **15 a 21 sesiones**. **L6 conviene hacerla justo después de L3** (antes que L4 y L5): no depende del
servidor, y mientras falte, las colonias acumulan en su muelle sin poder mandarlo (sección 10). El orden importa: L1 deja el motor de rutas que usan L3 y L5, y L2 va antes que L3
para que los aldeanos ya tengan base cuando los campamentos empiecen a guardar. L4 y L5 se pueden juntar en un solo
despliegue si se prefiere tocar el servidor una sola vez (un solo `D.PROTO`).

Cada entrega cierra con: pruebas de `npm run test:juegos`, `tools/cheat-test.js` si tocó el servidor, el piloto antes y
después, la pasada de Playwright de `pk-36`, sus notas en `juegos/prokingdoms/CLAUDE.md` y el aviso al dueño de que el
despliegue de la función es manual (`firebase deploy --only functions`).

---

## 13. Fase L6: el mar, con barcazas de carga (`pk-46`)

Decisión 10 del dueño. Solo cliente: el servidor nunca ve el mapa del mar, así que no hay `D.PROTO` ni despliegue.
Necesita L1 (rutas por tiempo), L2 (bases) y L3 (libro mayor, carromatos).

### 13.1. Las mismas reglas, con nombres del mar

- **Isla de casa = el pueblo.** La Fortaleza del Puerto (`tc`), el Ahumadero (`granary`), la Bodega del puerto
  (`warehouse`) y la Lonja (`mill`) son bodegas del pueblo, y lo suyo sirve para pagar.
- **Campamentos:** el Aserradero de teca (`lumber`) y la Cantera de coral (`mining`) guardan aparte, como en la tierra.
  En la isla de casa los vacía un carromato. En el mar el Establo y el carromato se revisten en `D.MAR.edificios` (por
  ejemplo, «Corral de carretas» y «carro de playa») y entran en `D.MAR.construir`.
- **Colonias:** el Muelle de la colonia (`colonia`) pasa a guardar aparte, como un campamento. Lo que juntan los colonos
  no sirve para pagar hasta que una barcaza lo trae a casa. Hoy suma directo a `S.res`.
- Los aldeanos siguen sin cruzar agua: en una colonia su base es el Muelle de la colonia o un campamento de esa isla.

### 13.2. La barcaza de carga

- Unidad nueva `kind: 'barcaza'`, que se arma en el Embarcadero de colonos (una cola aparte de la de los colonos).
  Barcazas por Embarcadero: `1 + nivel`. Carga 300, más con la Escuela de navegantes y el árbol del mar.
- **Ruta:** del Muelle de la colonia al Embarcadero de casa, que descarga en las bodegas del pueblo. También al revés,
  para llevar materiales a una colonia que quiera construir. Se elige como cualquier ruta (L1), en la misma ventana.
- **Perfil de ruta `barcaza`:** solo agua (la tierra no pasa), con el A* por tiempo de L1. Atraca en la casilla de agua
  más cercana a cada muelle.
- **El mar cambia el tiempo** con lo que ya existe: viento a favor o en contra (`D.vientoMar`), ×1,4 de viaje con
  tormenta (`D.tormenta`), un poco más lenta en la bruma. Siempre con `G.ahora()`, así sin conexión da lo mismo.
- **Sprite:** una barcaza chata con cajas y sacos según la carga, vela con el color del reino y el aspecto de barco del
  Pase (`Armada.aspecto`), estela como los barcos de la armada (`st.barco`). Se dibuja con `Armada.items`.
- **Sin conexión:** la fórmula de 4.5, con `ida` y `vuelta` del camino por agua y el factor de tormenta del momento de
  salida.

### 13.3. Ideas para el mar (opcionales)

- Los asaltos piratas (solo en vivo) pueden ir por una barcaza en el agua; las baterías y la Cadena la protegen cerca de
  casa.
- Un faro (`faromar`) en la ruta disipa la bruma y le quita el retraso.
- Misiones de la Crónica del Mar: primera barcaza, 1.000 traídos de las colonias.

### 13.4. Criterios de aceptación de L6

- Ninguna barcaza pisa tierra; ningún carromato pisa agua (prueba).
- Lo que juntan los colonos no aparece en `S.res` hasta que la barcaza descarga en casa.
- Con tormenta, el viaje tarda 1,4 veces, igual en vivo y sin conexión.
- Una partida del mar de `pk-45` carga y lo que había en el pueblo queda en sus bodegas.
- Pasada de Playwright por las ventanas del mar en 390 × 844 y en horizontal.
