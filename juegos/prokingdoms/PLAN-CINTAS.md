# Pro Kingdoms: plan de las cintas transportadoras («Red de cintas»)

- **Fecha:** 16 de noviembre de 2026.
- **Versión evaluada:** `pk-57`. El plan sale de leer `js/logistics.js` (cintas, rutas, libro mayor), `js/render.js`,
  `js/input.js` y `js/ui/reino.js`, no de una partida.
- **Pedido del dueño:** replantear las cintas desde cero. Que no sea solo unir dos edificios, sino que construirlas
  tenga su lógica. Que una cinta lleve varios materiales a la vez y que después se separen según a dónde van. Que
  se puedan unir dos cintas y separar una. Que lleven más material, pero subiendo de nivel cada tramo (sin tiempo de
  obra, solo con recursos), y que un tramo de nivel más bajo haga cuello de botella, como en Satisfactory.
- **Cómo pedirlo:** «implementa la Fase C<N> del plan de cintas de Pro Kingdoms». Cada fase es una entrega (un PR,
  una versión `pk-N`). Siguen valiendo todas las reglas de `CLAUDE.md`: caché, celular y apaisado, i18n, que sin
  conexión rinda igual que en vivo, y que la carga no se pierde nunca.
- **Decisiones del dueño:** sin responder todavía (sección 9). Hasta que estén respondidas, valen las
  recomendaciones marcadas como **(recomendado)**.

---

## 0. Resumen

| # | Pedido | ¿Se puede? | Cómo | Fase |
|---|---|---|---|---|
| K1 | Que no sea solo unir dos edificios: que armar la red tenga su lógica | Sí | Las cintas pasan a ser **piezas sobre casillas** (cada una con dirección y nivel) que forman una red. Los edificios tienen **bocas** de entrada y de salida en el borde. Se dibujan arrastrando, como los caminos. | C1 |
| K2 | Varios materiales a la vez en una cinta | Sí | Cada ítem lleva su tipo. Una boca de salida de una bodega elige qué saca; una de campamento saca todo lo que guarda. | C1 |
| K3 | Que se separen según a dónde van | Sí | **Clasificador**: una pieza con hasta 3 salidas y un filtro en cada una («solo piedra», «lo que sobre», «lo que no sea oro»). | C2 |
| K4 | Unir y separar cintas | Sí | **Unidor** (hasta 3 entran, 1 sale) y **Divisor** (1 entra, hasta 3 salen, por turnos). | C2 |
| K5 | Que transporten más, subiendo de nivel cada tramo con recursos y sin tiempo | Sí | Niveles **I a V** por pieza. Una herramienta «Mejorar cinta» se arrastra sobre la red y cobra en el momento. | C1 (I–III), C3 (IV–V) |
| K6 | Que un tramo de menos nivel haga cuello de botella | Sí, sale solo | Cada pieza mueve ítems a su velocidad: una más lenta frena a todo lo de atrás. La interfaz marca en rojo la pieza que manda. | C1 |
| — | Cruzar otra cinta | Sí | **Paso elevado**: salta hasta 4 casillas por encima de cintas y caminos. | C3 |

Nada del pedido queda afuera. Lo que hay que decidir son detalles de cómo se siente (sección 9), sobre todo qué pasa
cuando a un edificio le llega por cinta algo que no recibe.

---

## 1. Cómo funcionan hoy las cintas

- `st.logi.belts = [{ id, a, b, res, path, items, acc }]`: una cinta **une un edificio A con un edificio B**. Se
  tiende con dos toques (`L.tool = 'belt'`, `L.beltFrom`) y `L.beltPlan` busca el camino en anchura, en 4
  direcciones, por casillas tuyas y libres. Cada casilla marca `W.belt[k] = id`.
- Lleva **un solo recurso a la vez** (`beltRes`): lo que hace el taller de origen, o el insumo que más le falta al
  taller de destino. No hay forma de mezclar, separar ni unir.
- Velocidad fija: `D.BELT = { speed: 2.4 casillas/s, rate: 3 ítems/s }`, más el árbol «Cintas reforzadas» (+50 %,
  bono `belt`). Cuesta 3 acero y 1 maquinaria por casilla, se habilita en la Era V con un Taller de Ingeniería de
  nivel 3. Quitarla devuelve la mitad.
- En vivo, ítems con posición (`it.p`) a 0,34 casillas de distancia; sin conexión, un caudal fijo por cinta.
- No bloquea el paso: los aldeanos y las carretas caminan por encima (marcar `W.belt` no toca `W.block`).
- Al demoler un edificio se quitan sus cintas; si una parcela deja de ser tuya, también.

**Por qué hoy es tedioso:** cada par de edificios necesita su propia cinta, que se tiende de nuevo entera; dos cintas
no pueden compartir casillas; y el recurso lo decide la cinta, no tú. En la Era V llega tarde y cara para lo poco
que resuelve.

---

## 2. Las decisiones de fondo

### 2.1. La red es de piezas, no de pares

Cada casilla con cinta es una **pieza**: `st.logi.red.t[k] = { p, d, n, f? }`.

| Campo | Qué es |
|---|---|
| `p` | Tipo de pieza: `c` cinta, `u` unidor, `v` divisor, `s` clasificador, `e` paso elevado (entrada), `x` paso elevado (salida). |
| `d` | Dirección de salida: 0 a 3 (E, S, O, N). La de entrada se deduce de la pieza anterior. |
| `n` | Nivel, de 1 a 5. |
| `f` | Solo en el clasificador: el filtro de cada salida (`{ 0: 'stone', 1: '*', 2: '!gold' }`). |

Las curvas no son una pieza aparte: una cinta cuya pieza anterior entra por un costado se dibuja como curva.

Al editar la red, se recalculan los **tramos**: cadenas de piezas seguidas del mismo nivel, sin bifurcarse. Cada
tramo simula sus ítems como hoy (posición a lo largo del tramo y separación mínima). Partir en tramos del mismo nivel
es lo que hace salir solo el cuello de botella: un tramo lento acepta ítems más despacio, y el de atrás se llena.

### 2.2. Bocas de los edificios

- Una cinta **que apunta hacia un edificio** desde una casilla vecina es una **boca de entrada**. Lo que llega entra:
  - en una bodega, por el libro mayor (`Lb.poner`, hasta el tope);
  - en un taller, a su depósito de entrada (`put`, hasta `bufCap`);
  - en el Embarcadero, como hoy con las barcazas.
- Una cinta **que sale de una casilla vecina hacia afuera** es una **boca de salida**. Qué saca:
  - de un taller, lo que hace (`outb`);
  - de un campamento de tu tierra (maderero o minero), **todo lo que guarda, mezclado**: es el uso estrella;
  - de una bodega, lo que tú elijas en su boca (uno o varios recursos, por turnos), respetando la reserva de los
    talleres (`reserveOf`).
- Un edificio puede tener varias bocas, de entrada y de salida. El panel del edificio las lista y deja elegir el
  filtro de cada boca de salida de una bodega.
- Una boca saca a la velocidad de la pieza que la toca, nada más. Así el nivel de la cinta también decide cuánto sale.

### 2.3. Ítems mezclados y qué pasa si no los reciben

Cada ítem lleva su tipo (`{ p, r }`), así que una cinta puede llevar piedra, oro y hierro intercalados. El problema
es el ítem de adelante que el destino no recibe (oro que llega a un Aserradero). Hay dos maneras, y es la decisión
D1:

- **Se atasca, como en Satisfactory (recomendado).** La cinta se detiene y el edificio muestra «Atascada: llega oro y
  el Aserradero no lo usa». Es lo que le da sentido al clasificador y a pensar la red. Para que no frustre: aviso del
  Asesor, la pieza atascada parpadea, y el clasificador tiene la salida «lo que sobre».
- **Se devuelve.** El ítem rechazado vuelve solo a la bodega más cercana. Es más cómodo, pero el clasificador pierde
  casi todo su sentido.

### 2.4. Niveles y cuello de botella

| Nivel | Nombre | Ítems/s | Por minuto | Era | Cuesta por casilla (al subir a ese nivel) |
|---|---|---|---|---|---|
| I | Cinta de cuero | 1 | 60 | III | 2 tablones + 1 lingote |
| II | Cinta de hierro | 2 | 120 | III | 2 lingotes + 1 herramienta |
| III | Cinta de acero | 3 | 180 | IV | 2 acero |
| IV | Cinta reforzada | 5 | 300 | V | 1 acero + 1 maquinaria |
| V | Cinta de engranajes | 8 | 480 | VI | 2 maquinaria + 1 gema |

- Para calibrar: un Aserradero con 3 trabajadores hace aprox. 0,75 tablones/s y pide 1,5 de madera/s
  (`D.RECIPES.planks`, 4 s por tablón). Un nivel I alcanza para uno; un nivel III, como la cinta de hoy, para dos o
  tres. Los números se ajustan con el piloto antes de cerrar cada fase.
- Mejorar **no tarda**: se paga y la pieza cambia en el acto. Se puede mejorar una pieza, un tramo entero (doble toque)
  o arrastrando sobre la red. Cobra solo la diferencia, y avisa cuánto falta si no alcanza.
- El bono del árbol «Cintas reforzadas» multiplica la velocidad de todos los niveles, como hoy.
- **El cuello de botella se ve:** el panel de una pieza muestra «Lleva 112/min de 180 posibles» y «Frenada por: el
  tramo de nivel I, 6 casillas más adelante» (con «Ver», que la centra y la marca en rojo). El modo «Ver flujo»
  (C2) pinta cada pieza según su uso: verde con lugar, amarillo casi llena, rojo frenada.

### 2.5. Divisor, unidor y clasificador (C2)

- **Divisor:** una entrada y hasta 3 salidas (las casillas vecinas que tienen una cinta que sale de él). Reparte por
  turnos entre las salidas que tienen lugar: si una se llena, va todo a las otras.
- **Unidor:** hasta 3 entradas y una salida. Toma por turnos de las entradas que tienen algo. Dos cintas de nivel II
  que se unen en una de nivel II la saturan: hay que subir la de salida. Es el cuello de botella clásico, y es a
  propósito.
- **Clasificador:** como el divisor, pero cada salida tiene un filtro. Puede ser un recurso, «lo que sobre» (lo que
  no tomó ningún otro filtro) o «nada». Un ítem que no calza en ningún filtro atasca (con D1 «se atasca»).
- Se colocan sobre una cinta que ya existe (la convierten) o en una casilla vacía. Se giran con R, como el Gran
  Portón.

### 2.6. Construcción

- **Trazar cinta:** se arrastra de una casilla a otra, como «Trazar camino». El fantasma muestra flechas de
  dirección y, en rojo, las casillas donde no se puede. Si el arrastre empieza al lado de un edificio, la primera
  pieza ya es su boca de salida; si termina al lado de otro, la última es la boca de entrada.
- En el celular: tocar el inicio, arrastrar y soltar. Abajo, botones ✓ ✕ y «Nivel» (con qué nivel se construye, el
  más alto que alcanza por defecto).
- Una cinta que termina sobre otra la empalma (crea un unidor si hace falta, con aviso). Una que sale del costado de
  otra crea un divisor.
- **Quitar:** la herramienta «Quitar varios…» de hoy (zona) también quita piezas; devuelve la mitad de lo que costó
  cada nivel. Los ítems de encima vuelven a la bodega más cercana (la carga no se pierde nunca).
- **Girar:** tocar una pieza y «Girar», o R.
- **Paso elevado (C3):** dos piezas, entrada y salida, a 2 a 4 casillas en línea; lo de en medio queda libre para
  otra cinta, un camino o un edificio de 1×1.
- Dónde se puede: igual que hoy, en tu territorio, explorado, sin agua, sin edificios ni lugares. No bloquea el paso
  (decisión D3).

### 2.7. Sin conexión (regla «sin conexión = en vivo»)

En vivo hay ítems sueltos. Sin conexión se calcula **el caudal de la red**:

1. Cada boca de salida es una fuente (cuánto hay o cuánto produce el taller por segundo).
2. Se recorre la red en orden (no tiene ciclos, porque al construir se impiden): cada pieza deja pasar el mínimo
   entre lo que le llega y su nivel; el divisor reparte en partes iguales entre las salidas que reciben (lo que una
   no toma pasa a las otras); el unidor suma hasta su nivel; el clasificador manda cada recurso a su filtro.
3. Cada boca de entrada toma lo que necesita (tope de bodega o de depósito del taller).

Se aplica por tandas (como `L.offline` hoy, con 8 pasadas) para que, al llenarse un destino, el resto se reparta. La
prueba de aceptación compara una hora en vivo contra una hora sin conexión: diferencia menor al 10 %.

### 2.8. Partidas viejas

- Cada cinta vieja se convierte en piezas de **nivel III** sobre el mismo camino (decisión D4), con boca de salida
  en A y de entrada en B. Si tenía `res` fijo y A es una bodega, la boca de A queda con ese filtro.
- Los ítems que iban encima se guardan en el tramo nuevo, en su posición.
- `st.logi.belts` se borra después de convertir (`st.logi.red.v = 1` marca que ya se hizo).

### 2.9. Lo que no cambia

- El servidor no se entera: las cintas mueven recursos, no los crean. No hace falta `D.PROTO` ni desplegar la
  función.
- Las rutas de carretas y carromatos siguen igual. Las cintas son para lo cercano y de mucho volumen; los carromatos,
  para lo lejano y fuera de tu tierra.
- `L.supplied(b)` cuenta un taller como abastecido si tiene una boca de entrada con algo que le sirve en camino.

---

## 3. Fase C1: la red básica (`pk-58`)

1. **Datos:** `st.logi.red = { v: 1, t: {}, items: {} }`; `W.belt[k]` pasa a guardar el índice de la pieza;
   `D.CINTA` con la tabla de niveles; `L.red*` en un archivo nuevo `js/cintas.js` (logistics.js ya pasa las 1100
   líneas).
2. **Tramos:** `Ci.rearmar()` arma tramos y bocas al cargar y al editar; impide ciclos.
3. **Simulación en vivo:** avanzar ítems por tramo a la velocidad del nivel, pasar de tramo en tramo si hay lugar,
   bocas de salida (taller, campamento con todo mezclado, bodega con filtro) y de entrada. Con D1 «se atasca», el ítem
   que el destino no recibe detiene el tramo.
4. **Construcción:** trazar arrastrando (PC y táctil), quitar (zona), girar, elegir nivel, mejorar (pieza, tramo,
   arrastre). Costos de la tabla 2.4, niveles I a III. Se habilita en la **Era III** (decisión D2).
5. **Dibujo:** pieza por nivel con su color (cuero marrón, hierro gris, acero azulado, reforzada dorada, engranajes
   violeta), curvas, flechas que corren, ítems con el ícono de su recurso. Bocas con una marca en el borde del
   edificio.
6. **Panel:** al tocar una pieza, nivel, caudal real y máximo, qué lleva, por qué está frenada y «Ver» el cuello de
   botella. En el edificio, sus bocas y el filtro de las de salida.
7. **Sin conexión:** caudal por la red (2.7).
8. **Partidas viejas:** conversión (2.8).
9. **Pruebas:** tramos y cuello de botella (un nivel I entre dos III deja pasar 1/s), mezcla y atasco, conversión,
   que no se pierda carga al quitar, en vivo contra sin conexión.

**Criterios de aceptación:** se puede llevar todo lo de un campamento minero de tu tierra al Centro Urbano por una
sola cinta, mezclado; una cinta de nivel I en medio de una de nivel III limita a 60/min y el panel lo dice; las
cintas viejas siguen andando igual que antes.

## 4. Fase C2: divisor, unidor, clasificador y «Ver flujo» (`pk-59`)

1. Las tres piezas (2.5), colocadas sobre una cinta o en una casilla vacía, con giro.
2. Filtros del clasificador en su panel: chips por recurso, «lo que sobre» y «nada».
3. Empalmes al trazar: terminar sobre una cinta crea un unidor; salir del costado, un divisor.
4. Modo «Ver flujo» en Logística: colorea cada pieza por uso y deja ver qué recurso pasa por dónde.
5. Asesor: «cinta atascada» (con el recurso y el edificio) y «cuello de botella» (pieza al 100 % con la de atrás
   llena).
6. Sin conexión con divisores y unidores; pruebas de reparto por turnos y de rebalse cuando una salida se llena.

**Criterios de aceptación:** una cinta mezclada desde un campamento minero se separa en piedra a la Cantería, hierro a
la Fundición y lo que sobre al Almacén; dos aserraderos que alimentan una sola cinta se unen sin perder caudal hasta
el tope del nivel.

## 5. Fase C3: niveles altos y paso elevado (`pk-60`)

1. Niveles IV y V (Eras V y VI), con sus costos.
2. Paso elevado (2.6), entrada y salida a 2 a 4 casillas.
3. «Copiar tramo»: tocar un tramo armado y estamparlo en otro lado (paga lo mismo). Es opcional, sección 7.
4. Repaso del ritmo con el piloto (`?timelapse`) para que no adelante las eras (sección 8).

**Criterios de aceptación:** dos cintas se cruzan sin tocarse; una red de nivel V mueve 480/min sin bajar los cuadros
por segundo en el celular (medido con `tools/rendimiento.js`).

---

## 6. Trampas conocidas

- **Los ciclos traban todo:** un divisor que vuelve a su propia entrada gira para siempre. Al construir se impide
  («Esa cinta cerraría un círculo») y `Ci.rearmar` lo vuelve a revisar al cargar.
- **La carga nunca se pierde:** quitar piezas, perder una parcela, demoler un edificio con bocas, cambiar un filtro:
  lo que estaba encima vuelve a la bodega más cercana (`G.give`, entero). La prueba lo cubre.
- **Rendimiento:** con cientos de piezas y miles de ítems, simular por tramo (no por casilla) y dibujar solo lo
  visible. El sprite de cada pieza va en caché por nivel, forma y cuadro, como los vehículos.
- **`W.belt` lo leen otros:** el despeje (`despeje.js`, `poiCabe`), `canBelt`, `roadAllowed` y el clic (`render.js`
  `pick`). Revisarlos todos al cambiar qué guarda.
- **El libro mayor:** lo que entra por una boca a una bodega usa `Lb.poner` y lo que sale, `Lb.sacar`. Si no, la
  conciliación lo «arregla» moviendo stock entre bodegas.
- **La reserva de los talleres:** una boca de bodega no saca por debajo de `reserveOf`, igual que hoy las carretas.
- **Atascos que el jugador no entiende:** cada atasco dice qué recurso, dónde y qué hacer. Nunca una cinta quieta sin
  explicación.
- **Celular:** arrastrar en el mapa ya mueve la cámara. La herramienta de trazar tiene que tomar el arrastre solo
  mientras está activa, como el fantasma de colocar (`pk-49`).

---

## 7. Ideas que suman (opcionales)

- **Contenedor:** una pieza de 1×1 que guarda 50 a 200 ítems y amortigua picos (sale a la velocidad de su cinta).
- **Medidor:** una pieza que cuenta lo que pasa por minuto y lo muestra flotando.
- **Bocas de colores:** el color de la boca dice qué recurso sale, para leer la red de un vistazo.
- **Misiones del Libro:** «Arma un clasificador», «Mueve 1000 por cinta en una hora», «Sube un tramo de 20 casillas a
  nivel III».
- **Sonido:** un zumbido suave de cinta que baja con la distancia (`R.sonarEn`), y un golpe al atascarse.

---

## 8. Equilibrio

- Hoy la cinta llega en la Era V a 3/s; con este plan llega en la Era III a 1/s. Eso adelanta la producción de los
  talleres de las Eras III y IV, y puede acortar el camino a la Era IV. Se mide con el piloto antes y después de C1
  (meta de `CLAUDE.md`: Era II aprox. 10 min, IV aprox. 2 h, V entre 4 y 6 h) y, si adelanta, se sube el costo del
  nivel I antes que su velocidad.
- El piloto tiene que aprender a usarlas (al menos campamento minero a bodega y bodega a taller) antes de medir.

---

## 9. Decisiones del dueño (sin responder)

| # | Pregunta | Opciones | Recomendado |
|---|---|---|---|
| D1 | Si a un edificio le llega por cinta algo que no recibe | Se atasca (Satisfactory) / se devuelve solo a una bodega | **Se atasca**, con aviso claro y la salida «lo que sobre» en el clasificador |
| D2 | Desde qué era hay cintas | Era III (nivel I) / Era IV / Era V como hoy | **Era III** |
| D3 | ¿Las cintas cortan el paso? | No, se camina por encima, como hoy / Sí, y hay que dejar pasos | **No** (si cortaran el paso, las carretas quedarían encerradas) |
| D4 | Las cintas viejas | Pasan a nivel III, como rinden hoy / pasan a nivel I y devuelven la diferencia | **Nivel III** |
| D5 | Qué saca una boca de bodega | Lo que elijas (uno o varios recursos) / lo que pida el destino al final de la cinta | **Lo que elijas** (lo que pide el destino no se sabe con divisores en medio) |
| D6 | ¿Pueden salir de tu territorio? | No, como hoy / sí, en tierra de nadie | **No**: lo de afuera es de los carromatos y la Calzada Real |
| D7 | Los números de la tabla 2.4 | Así / más lentas / más rápidas | Así, ajustados con el piloto |

---

## 10. Tamaño y orden

- C1 es la grande: sistema nuevo, construcción táctil, dibujo, sin conexión y la conversión. Aprox. el tamaño de L3.
- C2 es mediana: tres piezas y una vista.
- C3 es chica.
- El orden importa: C2 sin C1 no tiene dónde vivir; C3 puede esperar.
