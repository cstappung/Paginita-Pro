# Pro Kingdoms: plan de la actualización «Hacha y Pico»

- **Fecha:** 25 de noviembre de 2026.
- **Versión evaluada:** `pk-81`. El plan sale de leer `js/data.js`, `js/game.js`, `js/mayor.js`, `js/logistics.js`,
  `server/sim.js` y las notas de `CLAUDE.md`. No sale de jugar una partida.
- **Pedido del dueño:**
  1. Que los talleres no se puedan construir sin límite: cada uno con un número máximo calculado.
  2. Una estructura que investigue herramientas para que los árboles den más madera. Que el aumento sea grande, pero
     que cueste bastante conseguirlo.
  3. Una mina con niveles subterráneos bien diseñados: cada nivel del edificio suma un piso, los aldeanos se visten
     de mineros, y mientras más hondo, más rinden las vetas y más raros son los materiales. Tiene que ser un lugar
     donde trabajen muchos aldeanos.
  4. Que los campamentos madereros y mineros guarden muchos más recursos, y que las carretas también lleven más.
- **Cómo pedirlo:** «implementa la Fase P<N> del plan Hacha y Pico». Cada fase es una entrega (un PR, una versión
  `pk-N`). Siguen valiendo todas las reglas de la §1 de `PLAN-MEGA-ACTUALIZACION.md` y las de «Rules that cross
  systems» de `CLAUDE.md`.
- **Decisiones del dueño:** respondidas el 25 de noviembre de 2026 (§9). Mandan sobre cualquier otra parte del
  plan. Solo queda pendiente la 10 (acelerar con monedas), y el plan usa su recomendación.
- **Avance:** P1 y P2 entregadas juntas en `pk-82`; P3, P4 y P5 (la mina entera) en `pk-83`. Las dos necesitan desplegar la
  función (`cleanBuildings`, `kindRate`). Falta la Posada (P6 y P7).

---

## 0. Resumen

| # | Pedido | ¿Se puede? | Qué hay que cuidar | Fase |
|---|---|---|---|---|
| 1 | Tope por taller | Sí, es agregar `max` a 10 entradas de `D.BUILD` | El servidor descarta los edificios que pasan de `max` y marca la cuenta como sospechosa (`cleanBuildings`): las partidas que ya tienen más quedarían marcadas | P1 |
| 4 | Campamentos y carretas más grandes | Sí, son 4 números | Que los carromatos no se queden esperando «media carga» y que el piloto no se acelere de más | P1 |
| 2 | Taller del Hachero | Sí | Es un bono de recolección de madera, que **sí** controla el servidor: hay que sumarlo a `kindRate` en la misma entrega | P2 |
| 3 | Mina Profunda | Sí, es lo más grande del plan | Que lo calculado sin conexión dé lo mismo que en vivo, el antitrampa (piedra y oro los ve el servidor), y que dibujar 60 mineros no cueste cuadros por segundo | P3, P4, P5 |

Orden recomendado: **P1 → P2 → P3 → P4 → P5 → P6 → P7** (la Posada, §10, se agregó después). P1 es chica y deja medido el ritmo nuevo antes de sumar fuentes de
recursos. P2 sirve de ensayo para P3: un bono nuevo de recolección que pasa por el servidor.

---

## 1. Cómo funciona hoy lo que este plan cambia

- **Talleres** (`recipe` en `D.BUILD`): Aserradero, Cantería, Fundición, Herrería, Copistas, Acería, Taller de
  Ingeniería y, en el mar, Taller de Velas, Astillero y Polvorín. **Ninguno tiene `max`**: `G.maxCount` devuelve
  `Infinity`. Cada uno rinde según su nivel: puestos `base + ⌊(L−1)/3⌋` y producción `+15 %` por nivel
  (`recipeStats`). El nivel máximo es `3 + 2·(era−1)`.
- **Campamentos** (`lumber`, `mining`, el Molino fuera de tu tierra): guardan `b.inv` aparte de `S.res`, con tope
  `D.campoCap(L) = 300 + 150·(L−1)` sumando todo. Sus aldeanos esperan cuando se llena (`G.llenoPara`,
  `Lb.lugarCampo`, que deja hasta 1,5 veces el tope por un rato).
- **Carromato:** `D.CARROMATO.cap` 250 + `capLvl` 50 por nivel del Establo. **Carreta:** `D.CART.cap` 20 + 5 por
  nivel de la Carretería (`BSTATS.cartwright`), por `L.cartCap()` con los bonos de bestias y faro.
- **Madera:** `D.NODES.tree` rate 0,5 por segundo y aldeano, 100 unidades por árbol (×2,5 fuera de zonas comunes),
  rebrota en 1,5 h. La técnica Hachas afiladas suma +15 % de velocidad por nivel. `G.gatherRate` lo junta todo.
- **Antitrampa:** el servidor ve comida, madera, piedra y oro (`TRACKED`). Lo que crece entre dos fotos no puede
  pasar de `aldeanos × resRate(r) × dt + créditos`, donde `kindRate` supone la técnica al máximo de la era, el
  acopio al máximo, el gremio y el margen `LIM.slack × LIM.vida` (2,5 × 1,6). **Un bono de recolección que no está
  en `kindRate` hace sospechoso al jugador que juega limpio.**
- **Edificios en la foto:** `cleanBuildings` descarta los tipos que no conoce y los que pasan de `max` (`bad++` →
  `suspect('edificios')`).

---

## 2. Fase P1: topes de talleres y bodegas de campamento más grandes (`pk-82`)

### 2.1 Tope de cada taller: cuántos puedes construir

Hoy se pueden construir talleres sin límite: nada impide tener 15 Aserraderos. Con esta fase, **cada tipo de taller
tiene un número máximo de edificios**: con el tope alcanzado, Construir lo muestra bloqueado («Ya tienes el
máximo: 3 de 3») y solo queda subir de nivel los que tienes. El tope crece con la era, como el de Granero, Almacén o Establo. Los números salen de lo que el piloto construye
hoy (`tools/piloto.js`, lista por era: Cantería 3 y Fundición 2 en la Era IV) con un poco de margen, y de lo que
piden los costos de era (sillares y lingotes son lo que más pide; maquinaria lo que menos).

| Taller | Desde | Fórmula `max(e)` | II | III | IV | V | VI | VII | VIII | IX | X |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aserradero | II | `1 + ⌊e/2⌋` | 2 | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 |
| Cantería | III | `1 + ⌊e/2⌋` | – | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 |
| Fundición | III | `1 + ⌊(e−1)/2⌋` | – | 2 | 2 | 3 | 3 | 4 | 4 | 5 | 5 |
| Herrería | III | `1 + ⌊(e−1)/3⌋` | – | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 4 |
| Taller de Copistas | III | `1 + ⌊(e−1)/3⌋` | – | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 4 |
| Acería | IV | `1 + ⌊(e−2)/2⌋` | – | – | 2 | 2 | 3 | 3 | 4 | 4 | 5 |
| Taller de Ingeniería | V | `1 + ⌊(e−3)/2⌋` | – | – | – | 2 | 2 | 3 | 3 | 4 | 4 |
| Taller de Velas (mar) | II | `1 + ⌊e/2⌋` | 2 | 2 | 3 | 3 | 4 | … | | | |
| Astillero (mar) | II | `1 + ⌊(e−1)/2⌋` | 1 | 2 | 2 | 3 | 3 | … | | | |
| Polvorín (mar) | III | `1 + ⌊(e−1)/3⌋` | – | 1 | 2 | 2 | 2 | … | | | |

Lo que se compensa, porque con menos talleres cada uno tiene que rendir más:

- **Puestos:** `base + ⌊(L−1)/2⌋` en vez de `/3`. Un Aserradero en nivel 11 pasa de 6 a 8 puestos.
- **La producción por nivel no cambia** (+15 %). Si el piloto pierde más de un 15 % de ritmo en la Era V, se sube a
  +18 %. Se mide antes de tocarla.

Reglas:

- El tope va en `max` (así lo leen `G.maxCount`, la ventana Construir y «Ya tienes el máximo»), y la ficha del
  edificio muestra «Talleres: 2 de 3 (la Era VI permite 4)».
- **Partidas que ya tienen más (decisión 1 del dueño: se quedan con ellos).** Siguen trabajando, se pueden
  mejorar y mover, y el panel dice «Por encima del tope de la era (lo tenías de antes)». No se puede construir otro
  hasta bajar del tope. Si demuelen uno, no vuelve.
- **Servidor:** `cleanBuildings` **no** aplica `max` a los tipos con `recipe`. Lo que hacen los talleres no está en
  `TRACKED` y la cantidad no le da ventaja a nadie en lo que el servidor controla. Sin esto, un jugador con talleres
  heredados queda registrado como sospechoso en cada foto. Hay que desplegar la función, sin subir `D.PROTO`: un
  servidor viejo no tiene topes para estos tipos y acepta todo igual.
- El Asesor y el Consejo (obras) dejan de proponer otro taller cuando se llegó al tope y proponen subirlo de nivel.
  El piloto respeta el tope solo (pasa por `G.maxCount`), pero su lista por era hay que revisarla para que no se
  trabe pidiendo un tercer taller que no puede hacer.

### 2.2 Bodegas de campamento y carga de carretas

| Qué | Hoy | Propuesta | Nivel 1 | Nivel 11 |
|---|---|---|---|---|
| Campamento (`D.campoCap`) | `300 + 150·(L−1)` | `900 + 450·(L−1)` | 300 → **900** | 1.800 → **5.400** |
| Carromato (`D.CARROMATO`) | `cap 250, capLvl 50` | `cap 600, capLvl 120` | 250 → **600** | 750 → **1.800** |
| Carreta (`D.CART`) | `cap 20`, +5 por nivel | `cap 45`, +12 por nivel | 20 → **45** | 70 → **165** |
| Muelle de colonia (mar) | `600 + 200·(L−1)` | `1.500 + 500·(L−1)` (decisión 3: sí) | 600 → 1.500 | 2.600 → 6.500 |
| Barcaza (mar) | `cap 300, capLvl 60` | `cap 700, capLvl 140` (decisión 3: sí) | | |

Lo que hay que cuidar:

- **Partida de los carromatos:** hoy salen «con media carga o a los 60 s». Con 600 de capacidad, media carga son
  300, y un campamento nuevo tardaría mucho en juntarlas. Pasa a salir con `min(media carga, 250)` o a los 60 s.
- **`Lb.lugarCampo`** (la mitad del campamento para un recurso que no tiene dónde ir) sigue igual. Ahora esa mitad
  es mucho más grande, y alcanza para que el oro de los premios no tape la piedra.
- **El dibujo de la carga** (`S.cart(col, carga, …)`) hoy dibuja la pila según `carry / cap`: con la capacidad nueva
  se ve igual de llena. No hay que tocar nada, pero conviene revisarlo con capturas.
- **Servidor:** `Lb.fuera(r)` (lo que hay en campamentos y vehículos) ya va en la foto, así que descargar un
  carromato no cuenta como salto. Un campamento con 5.400 sube ese número, y `node tools/cheat-test.js` tiene que
  seguir pasando con la cuenta honesta y un campamento lleno.
- **Partidas guardadas:** no hace falta migrar nada (el tope se calcula, no se guarda).
- **Cintas:** no cambian (el pedido es de campamentos y carretas). Las cintas ya llevan paquetes de 16 unidades.

### 2.3 Medir

- Piloto antes y después (`?timelapse`, `pkPiloto.resumen()`). La meta de ritmo sigue siendo Era II ~10 min,
  IV ~2 h y V 4–6 h. Lo esperable: los topes frenan un poco y las bodegas grandes aceleran un poco. Si la Era V baja
  de 4 h, se achica el carromato antes que el campamento.
- Pruebas (`colabtex/tests/prokingdoms.test.cjs`): cada taller tiene `max` y no baja de una era a la siguiente; el
  servidor no descarta talleres de más; una carreta y un carromato usan la capacidad nueva.

---

## 3. Fase P2: el Taller del Hachero (`pk-83`)

### 3.1 La idea

Un edificio nuevo, **Taller del Hachero** (`hachero`, 2×2, Era II, `max: 1`), con su propia investigación: **las
herramientas de tala**, en **tres ramas**. No usa la Biblioteca ni su cola, así que se investiga a la vez que las
técnicas. Las herramientas **son mejoras permanentes: no se gastan** (pedido del dueño).

| Rama | Qué mejora | Cómo se aplica | Al máximo |
|---|---|---|---|
| **Filo** | la velocidad: golpes por segundo | el leñador saca más rápido, y el árbol pierde más rápido | ×1,6 |
| **Golpe** | cuánto da cada toque | el leñador recibe más por golpe, y el árbol pierde lo mismo que antes | ×2,5 |
| **Aguante** | cuánto dura el árbol | el árbol pierde menos por golpe | ×1,6 |

**Con las tres al máximo da un ×4 de tala** (pedido del dueño):

- **madera por minuto** = Filo × Golpe = 1,6 × 2,5 = **×4**;
- **madera por árbol** = Golpe × Aguante = 2,5 × 1,6 = **×4**;
- y el árbol **dura lo mismo que hoy**, porque Filo y Aguante se compensan. Las zonas de tala no se pelan más
  rápido aunque se tale cuatro veces más.

Cada rama sirve sola. Un jugador con pocos árboles en el radio de sus campamentos sube primero Aguante, y uno con
muchos árboles pero pocos leñadores sube primero Filo y Golpe. Que el orden sea una decisión del jugador es parte de
la gracia.

### 3.2 Por qué cuesta

Cada mejora pide **cinco cosas a la vez**:

1. el nivel anterior de esa rama;
2. una era mínima;
3. un nivel del Taller del Hachero: `2·nivel − 1` (1, 3, 5, 7, 9), que sube con Maestro de Obras como cualquier
   edificio;
4. materiales de taller cada vez más caros;
5. **una prueba de campo**: talar cierta cantidad de madera desde la última mejora **de esa misma rama**
   (`st.tala.cortado[rama]`, se cuenta al depositar). No se compra.

Además, **el taller investiga una cosa a la vez**. Las 15 mejoras van en fila: subir todo lleva cerca de dos semanas
de investigación, además de las pruebas de campo.

### 3.3 Los quince niveles

Lo que cuesta cada nivel (igual en las tres ramas, salvo Golpe, que cuesta ×1,3 porque es la que más rinde):

| Nivel | Era | Costo | Tiempo | Talar antes (en esa rama) |
|---|---|---|---|---|
| 1 | II | 300 madera, 150 oro, 40 tablones | 30 min | 1.500 |
| 2 | III | 400 tablones, 60 herramientas | 1 h 30 | 6.000 |
| 3 | IV | 200 herramientas, 120 lingotes, 40 acero | 6 h | 40.000 |
| 4 | VI | 300 acero, 80 maquinaria, 40 libros | 24 h | 250.000 |
| 5 | VIII | 600 acero, 300 maquinaria, 150 gemas | 3 días | 1.500.000 |

Lo que da y cómo se llama cada nivel:

| Nivel | Filo (velocidad) | Golpe (por toque) | Aguante (duración del árbol) |
|---|---|---|---|
| 1 | Piedra de afilar ×1,10 | Cuñas y mazo de roble ×1,20 | Tala dirigida ×1,10 |
| 2 | Hacha de hierro forjado ×1,20 | Sierra tronzadora de dos mangos ×1,45 | Poda de ramas gruesas ×1,20 |
| 3 | Hacha de acero templado ×1,32 | Sierra de bastidor ×1,75 | Corte a ras del suelo ×1,32 |
| 4 | Filo de doble bisel ×1,45 | Sierra de vapor ×2,10 | Aprovechar tocones y raíces ×1,45 |
| 5 | Hacha de acero de crisol ×1,60 | Sierra de cinta ×2,50 | Cabrias y polipastos ×1,60 |

Las pruebas de campo se calibran con el piloto. La idea es que cada una tarde lo mismo que su investigación o más
con los leñadores de esa era, para que no alcance con juntar materiales. Si con el ×4 sobra madera, se endurecen las
pruebas o los costos, **sin bajar el ×4**.

### 3.4 Dónde se aplica

Con `f` (Filo), `g` (Golpe) y `a` (Aguante) como multiplicadores (1 sin mejoras):

- **Lo que junta el leñador por segundo:** `G.gatherRate` para la madera `× f × g`, **fuera** de `Vida.recoleccion`,
  igual que la técnica Hachas afiladas. Es una técnica más, no un bono de vida.
- **Lo que pierde el árbol por segundo:** la tasa de antes `× f ÷ a`. Hay que separar las dos cantidades en
  `doGather` y en el cálculo sin conexión (`tripRate`). Ahí está la trampa principal de esta fase (§7).
- **Carga del leñador:** `G.carryCap` del leñador `× g`. Si no, con la carga de siempre el bono se va en viajes más
  seguidos y rinde mucho menos de lo que dice.
- Vale en los dos mundos (es saber del reino, como los maestros extra); el edificio solo se construye en tierra. En
  el mar se lee el estado de tierra (`S.otro`), como `G.maestrosComprados()`.
- **Antitrampa, en la misma entrega:** `D.talaMax(era)` (data.js, la usan el cliente y el servidor) da el mejor
  `f × g` posible en esa era (×4 desde la VIII). `kindRate('tree', era)` lo multiplica. Aguante no cambia la madera
  por minuto y no entra. `tools/cheat-test.js` suma una cuenta honesta con todo al máximo que no tiene que quedar
  registrada. Hay que desplegar la función.
- **No va en el Pase** (regla de siempre: ningún bono de recolección en el Pase).

### 3.5 Interfaz, dibujo y sonido

- **Ventana del Taller** (`js/ui/hachero.js`): tres columnas, una por rama, con cinco piezas cada una, dibujadas en
  pixel art por código con su silueta. El nivel actual de cada rama va iluminado, y el siguiente muestra sus cinco
  requisitos, que se tachan uno por uno, más la barra de su prueba de campo. Arriba, un resumen: «Madera por minuto
  ×2,3 · Madera por árbol ×2,1». Hay que probarla a 390×844 (las columnas se apilan) y en horizontal.
- **El leñador cambia de herramienta en el mapa** según la rama Golpe: hacha chica → mazo y cuña → sierra de dos
  mangos (un solo aldeano con una sierra larga) → sierra de bastidor → desde el nivel 4, una nubecita de vapor en el
  campamento. Con Filo alto, la animación de talar va más rápido. Con Aguante alto, el árbol talado deja troncos
  apilados en vez de astillas. Va en `S.villager` con el parámetro `tool`, guardado en caché.
- **Edificio:** cabaña con tronco, una piedra de afilar que gira mientras investiga, hachas colgadas y, por nivel,
  un cobertizo y un banco de sierra. Sonido de afilado (grabación en `sfx/` con su ganancia medida en `GAN`).
- Misiones: «Primer filo» (cualquier nivel 1), «Las tres ramas» (las tres en nivel 2), «Leñador de leyenda» (las
  tres en 5). El Asesor avisa cuando una prueba de campo está lista y el taller está quieto. Al Consejo
  (investigación) se le suma la opción de investigar solo, con la rama que el jugador elija como preferida.
- El piloto aprende a construir el Taller en la Era II e investiga, primero Golpe y después las otras dos.

---

## 4. Fase P3: la Mina Profunda, lo que calcula (`pk-84`)

### 4.1 La idea

**Mina Profunda** (`mina`, 4×3, Era III, `max: 1`: **una sola mina por reino**, decisión 7 del dueño). En la superficie es un castillete de
madera con su rueda, la casa del torno y una escombrera. Debajo tiene **un piso por nivel del edificio**: un nivel 9
tiene 9 pisos. El nivel máximo sigue la regla de todos (`3 + 2·(era−1)`), así que en la Era III llega a 5 pisos, en
la V a 9, en la VII a 13 y en la X a 19.

Cada piso tiene **vetas** que se agotan y un **frente de avance** donde los mineros siguen cavando la galería. Al
avanzar aparecen vetas nuevas, siempre en el mismo lugar para esa mina (usan semilla). Una mina nunca se queda sin
trabajo, pero sí se queda sin lo bueno si nadie avanza.

### 4.2 Estratos: qué hay en cada piso

| Pisos | Estrato | Qué sale (proporción de vetas) | Peligro del piso |
|---|---|---|---|
| 1–2 | Tierra y roca | piedra 70, hierro 30 | – |
| 3–4 | Roca firme | piedra 40, hierro 45, oro 15 | – |
| 5–6 | Vetas de hierro | hierro 50, oro 30, piedra 20 | agua (1 de cada 3 pisos) |
| 7–8 | Filón de oro | oro 45, mármol 30, hierro 25 | agua |
| 9–10 | Mármol profundo | mármol 45, oro 30, gemas 25 | agua, gas (1 de cada 3) |
| 11–13 | Geodas | gemas 40, mármol 30, oro 30 | gas |
| 14+ | Corazón de la tierra | gemas 50, oro 30, mármol 20; en algunas vetas, Cristal de cueva o Hierro estelar (decisión 2: sí, en medida justa, ver abajo) | gas y agua |

Lo que da cada veta crece con la profundidad:

- **Cantidad de la veta:** `D.NODES[k].amount × 2 × (1 + 0,3·(piso−1))`. Una veta de oro del piso 10 tiene 3,7
  veces lo de una del piso 1.
- **Ritmo por minero:** `D.NODES[k].rate × (1 + 0,05·(piso−1))`: +45 % en el piso 10 y +90 % en el 19. Va con
  Picos templados, el acopio y `Vida.recoleccion` como cualquier minería.
- **Materiales especiales** (decisión 2 del dueño: sí, en una medida justa): desde el piso 14, una de cada 8 vetas
  trae además Cristal de cueva o Hierro estelar, de 1 a 3 unidades por cada 1.000 de mineral que se saca de ella
  (con semilla, siempre igual). La meta es que la mina dé más o menos un tercio de lo que da una semana de
  mazmorras a ese nivel, para que las mazmorras sigan siendo el camino principal. Se mide con el piloto y se ajusta
  solo la proporción.
- **Hallazgos** (con semilla, iguales en vivo y sin conexión): algunas vetas esconden un bolsón que paga un cofre al
  llegar a cierto porcentaje (geoda, pepita, filón). Entra entero con `G.give`.

### 4.3 Lo que se arma en cada piso

Además del nivel (que abre el piso y ya incluye el **entibado**, porque `D.upCost` pide tablones, sillares y
lingotes cada vez más), cada piso tiene mejoras propias que se compran desde su panel:

| Mejora | Desde el piso | Costo aproximado | Efecto |
|---|---|---|---|
| Rieles y vagonetas | 1 | lingotes + tablones | +25 % en ese piso |
| Lámparas de aceite | 3 | oro + herramientas | +10 % en ese piso, y se ve |
| Bomba de mano / de vapor | pisos con agua | lingotes + herramientas / acero + maquinaria | **sin bomba ese piso rinde la mitad** |
| Ventilación | pisos con gas | tablones + acero | **sin ventilación ese piso no se puede trabajar** |
| Puestos extra | 5 | herramientas + acero | +2 mineros en ese piso |

Y una mejora de toda la mina, el **montacargas**, que pone tope a lo que sube por minuto:

| Montacargas | Sube por minuto | Pide |
|---|---|---|
| Torno de mano | 120 | (viene con la mina) |
| Malacate de caballos | 360 | Era IV, tablones + herramientas |
| Jaula a vapor | 900 | Era VI, acero + maquinaria |
| Doble jaula a vapor | 1.800 | Era VIII, más acero y maquinaria |

Con esto la mina tiene **tres cuellos de botella** que el jugador ve y decide: mineros (puestos), montacargas y la
bodega de la mina (§4.4). Es lo que la hace un edificio para administrar y no solo para mejorar.

### 4.4 Cómo se calcula (una fórmula, igual en vivo y sin conexión)

- **La simulación es una fórmula, el dibujo es aparte** (como las tropas: «se dibujan, no se simulan»). En cada paso:
  por piso, `mineros × ritmo × mejoras × dt` se resta de la veta activa (o hace avanzar el frente, que da piedra a
  la mitad del ritmo), el total sube hasta el tope del montacargas y entra a la bodega de la mina hasta su tope.
  `G.simulateOffline` usa **la misma función** con `dt` grandes. No hay `Date.now()` ni `Math.random`: todo usa
  `G.ahora()` y `U.rng(b.id, piso, n)`.
- **La mina es un campamento** para la logística (`Lb.tipoCampo` la incluye): guarda `b.inv` fuera de `S.res`, con
  tope `D.minaCap(L) = 2.000 + 600·(L−1)`. La vacían carromatos (rutas «desde la mina», y «cualquier campamento
  minero» la incluye), cintas (el puerto da todo lo que tiene, por turnos) y, si no la alcanza ningún carromato, sus
  mineros suben a pie al pueblo como en `L.campoAislado`. Lo que guarda va en `Lb.fuera` para la foto.
- **Puestos:** 6 por piso (más los extra). Con 10 pisos son 60 mineros, más de lo que dan 4 campamentos mineros
  juntos. Es el «trabajan muchos aldeanos» del pedido.
- **Los mineros** son aldeanos con `task.t = 'mina'`, `task.base` = la mina y `task.piso`. Caminan hasta el
  castillete y entran (`u.inside`, como en un taller): en el mapa desaparecen. Se les asigna piso a mano (panel del
  piso) o los reparte el Capataz: primero los pisos cuyo material pide la «Meta de era» (`G.metaNecesita`), después
  los más hondos que se puedan trabajar. Una orden del jugador (`task.m`) el Capataz no la deshace, como siempre.
- **Estado guardado:** `b.mina = { pisos: [{ v: índice de veta, q: lo que le queda, fr: avance, mej: {…} }], mont }`.
  La lista de vetas de cada piso **no se guarda**: sale de `D.pisoMina(semilla, piso)`, una función pura en
  `data.js`. Por eso mover o recargar no cambia nada.
- **La mina no se puede mover** (`G.MOVE_NO`): sus pisos están bajo ese lugar. Demolerla pide confirmar dos veces y
  avisa que se pierden los pisos (vuelve la mitad del costo del edificio, como siempre).
- **Dónde se pone (decisión 6 del dueño):** solo en tu tierra, en cualquier casilla libre. **El lugar no cambia lo
  que hay debajo**: los pisos salen de la semilla de la mina (`b.id`), no de la parcela ni de la comarca. El dueño
  no quiere que el territorio pese tanto en la mina.

### 4.5 Servidor

- Tipo de edificio nuevo: un servidor viejo lo descarta de la foto y lo registra hasta que se despliegue la función
  (igual que en L3). No se sube `D.PROTO`.
- **Antitrampa:** la mina da piedra y oro, que el servidor ve. `D.minaMax(era)` (data.js) = el mejor ritmo de un
  minero en el piso más hondo de esa era, con rieles y lámparas. `kindRate` de las vetas lo multiplica. Los mineros
  ya cuentan en `workers(p)` porque son población. `cheat-test.js` suma una cuenta honesta con 19 pisos llenos.
- Nada de la mina viaja a los vecinos en esta fase. Su castillete se ve porque es un edificio.

### 4.6 Pruebas

`colabtex/tests/prokingdoms.test.cjs` (o uno nuevo `pk-mina.test.cjs`, agregado a `test:juegos`):
`D.pisoMina` da siempre lo mismo para la misma semilla; las proporciones de cada estrato suman 100; una hora en vivo
y una hora sin conexión dan lo mismo con una tolerancia de 1 %; el montacargas y la bodega topan; un piso con gas
sin ventilación no produce; y el servidor no marca la cuenta honesta.

---

## 5. Fase P4: la Mina Profunda, lo que se ve (`pk-85`)

### 5.1 La vista en corte

Al tocar la mina, «Bajar a la mina» abre **una vista a pantalla completa**, como la batalla (`main.js` deja de
dibujar el mapa mientras está abierta: `PK.Mina.abierta()`). Es un **corte lateral**, como un hormiguero de vidrio,
que se lee mucho mejor que el isométrico cuando hay pisos apilados:

- **Arriba**, una franja de cielo (de día o de noche y con la estación) con el castillete, la rueda que gira cuando
  sube la jaula y la escombrera.
- **Al medio, el pozo**, con cables y la **jaula** que sube y baja entre los pisos. Cada vez que llega arriba
  descarga una vagoneta.
- **A los lados, las galerías de cada piso**, talladas en roca. **El color de la roca cambia con el estrato**: tierra
  café, roca gris, basalto oscuro, mármol veteado y, en el fondo, cavernas con cristales que brillan. Cada pocas
  casillas hay entibado de madera. Las vetas se ven como manchas del color de su material, que se achican al
  agotarse. En el frente de avance hay roca sin tallar y polvo.
- **Los mineros** caminan del pozo a su veta, pican (con chispas), llenan la vagoneta y la empujan por los rieles
  hasta la jaula. En pisos con agua hay goteras y la bomba bombea; en pisos con gas, la ventilación gira y los
  faroles parpadean. **Es solo dibujo**: lo que se ve sale del estado de §4.4 (cuántos mineros hay, qué veta y cuánto
  le queda) y nunca decide nada. `Math.random` solo para el polvo y las chispas.
- Se recorre arrastrando o con la rueda; en el celular, de arriba a abajo, que es natural en vertical. **Tocar un
  piso abre su panel** (veta activa, lo que le queda, mineros, mejoras, peligro). Hay una regla con la profundidad
  al costado y un botón «Volver a la superficie».
- **Rendimiento:** se dibujan solo los pisos visibles. La roca de cada piso se pinta una vez en un lienzo aparte
  (se rehace al avanzar el frente o al agotar una veta). Los mineros usan la caché LRU de sprites. Hay que medir con
  60 mineros y la CPU del celular ×4 (`tools/rendimiento.js`).

### 5.2 Los mineros

- **Ropa de minero** en `S.villager` (un bloque como el de las tropas, `minero` como aspecto): casco de cuero con
  lámpara de carburo (que en el mapa brilla de noche), overol de lona, cinturón con herramientas, pico al hombro y
  la cara tiznada. Conserva el color del reino en el pañuelo, como las tropas su faja.
- **También en la superficie:** un aldeano con trabajo de minero camina vestido así hacia el castillete, así que se
  ve en el mapa quién baja.
- En la vista en corte se usa el mismo dibujo, de perfil (los aldeanos ya se dibujan mirando a un lado, con `flip`),
  con su animación de picar y otra nueva de empujar la vagoneta.
- Retratos (`retratos.js`): el minero que el jugador toca muestra su cara con casco.

### 5.3 Sonido

Grabaciones en `sfx/` con ganancia medida (`GAN`), por `R.sonarEn` en la superficie y por el maestro de `sfx.js`
dentro de la mina: picos lejanos (suenan más cuantos más mineros hay en los pisos que se ven), la campana de la
jaula, el chirrido de la rueda, goteo y el ronquido de la bomba a vapor. Hay un ambiente de mina que reemplaza al
del mapa mientras la vista está abierta. Respeta M y el volumen compartido.

### 5.4 Fichas

- Castillete en la superficie, por nivel: de madera (1–4), con casa del torno (5–8), de hierro con chimenea (9+),
  con dos ruedas cuando tiene la doble jaula. La escombrera crece con los pisos.
- Probarlo todo a 390×844, 915×412 y 1280×800, y en horizontal, con la guía de Tobías cerrada y abierta.

---

## 6. Fase P5: contenido y cierre de la mina (`pk-86`)

- **Guía de Tobías** al construir la primera mina (como `T.guiaGuerra`): bajar, ver un piso, asignar mineros y poner
  la primera ruta de carromato desde la mina. Solo después de terminar la guía de bienvenida y sin ventanas abiertas.
- **Misiones** (ids nuevos, que nunca cambian): «Primer piso», «Bajo tierra» (5 pisos), «Hasta el mármol»
  (piso 9), «Corazón de la tierra» (piso 14), «Cuadrilla» (40 mineros a la vez), «Ni una gota» (bombas en todos los
  pisos con agua). Escalera de misiones de mineral sacado de la mina.
- **Asesor:** bodega de la mina llena, montacargas al tope (con lo que se pierde por minuto), piso con agua sin
  bomba, piso con gas cerrado, piso sin mineros, veta agotada con frente quieto.
- **Consejo (obras):** puede comprar las mejoras de piso más baratas si se lo permites.
- **Piloto:** construye la mina en la Era III, le pone ruta de carromato, compra el malacate en la IV y bombas y
  ventilación cuando hacen falta. Hay que medir el ritmo antes y después: la mina no debería bajar la Era V de 4 h
  (si lo hace, se baja el ritmo por piso de 0,05 a 0,04).
- **Estadísticas** (`G.stat`): `mina_pisos`, `mina_sacado`, `mina_gemas`. Para el Pase solo como actividad («baja a
  la mina»), nunca como bono de recolección.
- **Novedades** (`D.NOVEDADES`) y nota en `CLAUDE.md` con las reglas y trampas de las cuatro fases.

---

## 7. Trampas conocidas

- **Todo bono de recolección nuevo va a `kindRate` en la misma entrega** (P2 y P3). Si no, quien juega limpio queda
  sospechoso.
- **`cleanBuildings` y los topes:** sin la excepción de P1, los talleres heredados se descartan de la foto (los
  vecinos dejan de verlos) y la cuenta queda marcada como sospechosa.
- **La mina sin conexión tiene que dar igual que en vivo:** una sola función de paso (§4.4). Nada de derrumbes ni
  inundaciones al azar que cambien lo que rinde: los peligros son fijos por piso (con semilla) y se arreglan con
  mejoras. Un evento al azar en vivo que no existe sin conexión rompe la regla.
- **Semilla por mina, no por momento:** `U.rng(b.id, piso, n)`. Recargar nunca puede cambiar dónde está una veta.
- **`G.baseSucia()`** después de cada asignación de minero (la mina cuenta como lugar de trabajo).
- **`u.inside`:** los mineros dentro no están en el mapa. `unstick`, lobos, bandidos y la cuenta de ociosos no
  pueden tratarlos como perdidos.
- **El árbol y el leñador cuentan distinto** (P2): el leñador junta `× f × g` y el árbol pierde `× f ÷ a`. Si el
  árbol pierde lo mismo que junta el leñador, se agota cuatro veces antes y Golpe y Aguante no rinden nada.
- **Estados CSS con nombres sueltos** (`.piso`, `.veta`): se cruzan con otras reglas. Usar `.mina.piso` y revisar que
  el nombre no exista.
- **Toasts de la mina** («Nueva veta de oro en el piso 7») se agrupan («×N») y nunca más de 3 en pantalla.

---

## 8. Tamaño y orden

| Fase | Versión | Tamaño | Servidor |
|---|---|---|---|
| P1 Topes y bodegas | `pk-82` | chica (datos, panel, excepción en `cleanBuildings`, medir) | desplegar la función |
| P2 Taller del Hachero | `pk-83` | mediana (edificio, ventana, efecto, antitrampa, dibujo) | desplegar la función |
| P3 Mina: cálculo | `pk-84` | grande (modelo, logística, Capataz, sin conexión, antitrampa) | desplegar la función |
| P4 Mina: vista | `pk-85` | grande (vista en corte, mineros, sonido, fichas) | no |
| P5 Mina: cierre | `pk-86` | mediana (guía, misiones, Asesor, piloto, medir) | no |
| P6 Posada: tablero y Diligencia | `pk-87` | mediana | no |
| P7 Posada: Feria, álbum e historias | `pk-88` | mediana (mucho texto) | ayuda del gremio |

P3 y P4 pueden ir en paralelo si P3 deja hecho primero el estado (`b.mina`) y `D.pisoMina`, porque la vista solo
los lee.

---

## 9. Decisiones del dueño

Respondidas el 25 de noviembre de 2026:

1. **Partidas con más talleres que el tope nuevo:** se quedan con ellos (heredados). No pueden hacer otro hasta
   bajar del tope.
2. **Materiales especiales en el fondo de la mina:** sí, en una medida justa (§4.2).
3. **Bodegas grandes también en el mar** (muelle de colonia y barcaza): sí, en la misma proporción.
4. **Las herramientas de tala no se gastan:** son mejoras permanentes, sin mantenimiento.
5. **Herramientas de tala en tres ramas**, Filo (velocidad), Golpe (cuánto da cada toque) y Aguante (cuánto dura el
   árbol), que con todo al máximo dan un ×4 de tala (§3.1).
6. **La mina va en tu territorio**, y lo que hay debajo sale de una semilla, no del lugar.
7. **Una sola mina por reino.**
8. **Topes de talleres:** los números de la tabla de §2.1 están bien.
9. Propuestas rechazadas: «El Subsuelo» (prospección, mapa geológico y Vetas Madre: no se mezcla el territorio con
   la mina) y «La Casa Real» (linaje y sucesión).

Pendiente (el plan usa la recomendación):

10. **¿Se acelera con monedas la investigación del Hachero?** Recomendado: sí el tiempo, como las mejoras, pero
    **nunca** la prueba de campo.

---

## 10. Fases P6 y P7: la Posada de los Viajeros (`pk-87`, `pk-88`)

Propuesta aceptada por el dueño el 25 de noviembre de 2026. Viajeros con nombre y retrato llegan a una **Posada** con
**pedidos** (combinaciones de bienes). Cumplirlos da recompensas, fama e historias. La idea es que siempre haya algo
chico que hacer, **sin castigar a quien se va**.

### 10.1 Reglas de diseño (mandan sobre lo demás)

- **No se castiga la ausencia:** mientras no estás, los viajeros llegan hasta llenar el tablero y esperan. Ningún
  pedido caduca, no hay rachas que se pierdan, nada dice «te lo perdiste».
- **La recompensa se ve antes de entregar.** No hay cajas sorpresa pagadas; la «propina» a veces es mayor, siempre
  gratis y con semilla.
- **Semilla por pedido** (`U.rng(st.posada.n, …)`, `n` = número de pedido creado): recargar nunca cambia un pedido.
  Los que llegan sin conexión usan `G.ahora()`.
- **Recompensas fuera de lo que vigila el servidor:** monedas del reino (con tope diario), cofres que entran con
  `G.give`, decoraciones y aspectos de la Posada, y fama. Oro y comida solo en cantidades chicas, dentro de
  `LIM.resSlack` como las misiones.
- **Los pedidos salen de lo que el reino ya hace** (lo que tienes, lo que tus talleres producen y lo que tu era
  permite), con más peso a lo que te sobra.

### 10.2 Fase P6: la Posada, el tablero y la Diligencia (`pk-87`)

- **Posada** (`posada`, 3×3, Era II, `max: 1`): su nivel da lugares en el tablero (6 + ⌊nivel/3⌋, hasta 9) y acorta
  la espera entre viajeros (un viajero cada 12 min en nivel 1, cada 6 en nivel 10).
- **Pedido:** un viajero (retrato con `PK.Retratos`, nombre, oficio), 1 a 3 bienes con cantidades según la era, y su
  premio. «Entregar» paga al instante (cajas a la carreta, sonido, el viajero se va por el camino). «Despedir»
  descarta y el lugar se llena a los 10 min.
- **La Diligencia** (cada 4 h de reloj real, con semilla por bloque de 4 h): 9 cajas de un pedido grande; se llenan de
  a una; premio por caja y un premio extra si se llenan las 9 antes de que parta. Si no, se va con lo hecho y paga
  esas cajas. Sin conexión: parte sola con lo que tenía.
- **Fama** (`st.posada.fama`): cada entrega suma; niveles de fama desbloquean viajeros nuevos y pedidos mejores.
- Toasts agrupados, ventana probada a 390×844 y en horizontal, botón en el menú (grupo Reino) con una insignia con
  los pedidos que ya puedes cumplir.
- El piloto cumple pedidos que no le quitan lo que pide su meta de era.

### 10.3 Fase P7: la Feria, el álbum y las historias (`pk-88`)

- **La Feria** (semanal, por semana UTC): una barra de 30 escalones que avanza con la fama de esa semana; premios de
  aspecto, decoraciones de la Posada y monedas del reino.
- **Álbum de viajeros** (unos 40): cada uno con una historia de 5 capítulos que avanza al cumplirle pedidos. Un capítulo
  es un diálogo corto con su retrato (como Tobías), con humor. Al completar su historia, el viajero deja un regalo
  permanente chico (decoración única o aspecto).
- **Visitante ilustre** (con semilla, uno cada uno o dos días): un pedido especial con un premio mayor.
- **En línea:** los compañeros del gremio pueden mandar una caja a tu Diligencia (por el tablón de ayuda que ya
  existe, con sus topes del servidor).
- Misiones nuevas, Asesor («tienes 3 pedidos listos para entregar»), novedades y notas en `CLAUDE.md`.
