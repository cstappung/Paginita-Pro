# ¿Y si en vez de traducir el juego lo decompilamos? (la ruta de la decompilación)

*Escrito el 2026-10-31 como respuesta a «piensa más grande… ¿podría una decompilación, no una recompilación estática,
arreglar todos nuestros problemas?». No se compiló, midió ni corrió nada para esto. Cada número dice de dónde sale:
**[medido §N]** = de la bitácora; **[medido aquí]** = contado hoy en los archivos (sin correr el juego);
**[precedente]** = de otro proyecto, con enlace; **[estimado]** = cuenta propia, con lo que la sostiene. Donde el
precedente es flojo, se dice.*

## La respuesta en cinco líneas

1. **No, una decompilación entera no arregla todo, y no conviene hacerla entera.** Cuesta 18–30 meses de sesiones, y
   el 94 % de las funciones casi no corre en la carrera: decompilarlas no da ni un milisegundo.
2. **Sí puede dar el salto que el plan de hoy no da, pero solo por islas enteras.** Una **isla** es un grupo de
   funciones que pasa a tener **sus datos en el formato nativo** (sin dar vuelta bytes, sin registros de mentira). La
   lógica de una isla así podría correr **×2–2,5 más rápido que hoy** (realista) y ×3 o más (optimista). Una función
   suelta reescrita no gana nada: eso ya se midió (N14, §181.2).
3. **El dibujo nativo es la isla que más rinde y la que menos riesgo tiene:** no toca la carrera, así que no puede
   romper los fantasmas. El dibujo cuesta hoy ~6,7 ms de CPU por imagen; nativo, **~2–3 ms** [estimado].
4. **Con el dibujo nativo, la colisión y la física del kart nativas, y el dibujo en otro núcleo (pasos 8–9), la gama
   media llega a 60** [estimado]. La gama baja llega a **60 cuadros de carrera con 30 dibujados**, que hoy no alcanza
   ni simulando sin dibujar.
5. **Recomendación: el plan híbrido** (lo frío sigue traducido, lo caliente se decompila por islas, el dibujo primero)
   **y antes un piloto de 2 semanas que lo confirma o lo mata:** la colisión en la semana 1 (¿la lógica nativa gana de
   verdad?) y la pista dibujada nativa en la semana 2 (¿el dibujo nativo gana de verdad?). Los umbrales están en el §8.

---

## 0. Las palabras que usa este documento

| Término | Qué es | Comparación eléctrica |
|---|---|---|
| **Recompilación estática** (lo de hoy, WiiCompiled) | Pasar cada instrucción del PowerPC de la Wii a C++, una por una, **imitando la máquina**: 32 registros guardados en memoria, las banderas de comparación (CR/XER), la memoria de la Wii en orden «big-endian». | Hacer un circuito de 5 V con piezas de 3,3 V y un adaptador de nivel en **cada** pata: anda igual, pero cada señal pasa por un adaptador. |
| **Decompilación** | Reescribir lo que hace cada función como código C/C++ **normal**: variables con tipo, estructuras, llamadas directas. Ya no se imita la máquina, se escribe el programa. | Rediseñar el circuito para 3,3 V: ya no hacen falta los adaptadores. |
| **Decompilación «matching»** | La que, compilada con el compilador original, da **los mismos bytes** que el disco. Es la de doldecomp/mkw. Lenta: hay que adivinar cómo escribió el código el programador. | Copiar un plano hasta que la placa salga idéntica traza por traza. |
| **Decompilación funcional («non-matching»)** | La que da **el mismo resultado** (los mismos bits en la memoria y en la carrera), aunque el código máquina sea otro. Es la que propone este documento. | Una placa nueva que, medida en cada borne, da las mismas tensiones. |
| **Big-endian / little-endian** | El orden de los bytes de un número. La Wii guarda el byte más grande primero; el PC, el teléfono y wasm, al revés. Hoy cada lectura de la memoria de la Wii los da vuelta. | Leer un número de 4 cifras de derecha a izquierda: hay que darlo vuelta cada vez que se mira. |
| **ABI del invitado** | Las reglas de cómo se llaman las funciones **de la Wii**: argumentos en r3, r4…, flotantes en f1…, la pila de la Wii. El código traducido las sigue al pie de la letra. | El conector viejo: aunque cambies la placa, si conservas el conector, conservas sus pérdidas. |
| **Isla** | Un subsistema entero (dibujo, colisión, física) que pasa de golpe a código decompilado **con sus datos en formato nativo**. Solo habla con el resto del juego en su **borde**. | Un tramo de línea entre dos cajas de empalme que se cambia entero por cobre grueso. |
| **Borde de la isla** | Donde el código traducido y la isla se pasan datos; ahí sí se dan vuelta los bytes, pero una vez por cuadro o por consulta, no en cada lectura. | El transformador entre dos tramos: tiene pérdidas, pero una vez, no en cada metro. |
| **Bit a bit (bit-exacto)** | Que el resultado sea idéntico hasta el último bit, no «casi igual». Los fantasmas lo exigen. | Dos relojes que no pueden atrasar ni un ciclo en una hora: un ciclo de diferencia y ya no coinciden. |
| **FMA (multiplicar y sumar fusionado)** | `a·b + c` con **un** redondeo. El PowerPC de la Wii lo hace; wasm no tiene esa instrucción en su parte exacta y hoy se imita en software. | Un amplificador que suma y multiplica en una etapa contra dos etapas: la segunda etapa mete su propio ruido (su redondeo). |
| **Render bundle (WebGPU)** | Una lista de órdenes de dibujo grabada una vez y repetida cada imagen casi gratis. | Un programa grabado en una ROM contra dictar las órdenes a mano cada vez. |

---

## 1. El techo de velocidad

### 1.1 De dónde sale el impuesto de hoy

Hoy: el juego traducido en wasm corre **×2,45 más lento** que el mismo código traducido como programa de Windows
[medido §165, §166.1], y el impuesto está **repartido parejo** en 1.886 funciones calientes [medido §181.2].

El C/C++ **normal** compilado a wasm paga mucho menos: en el estudio clásico de SPEC CPU (programas grandes de C),
Chrome corría en promedio **×1,55** más lento que el nativo, con picos de ×2,5 ([Jangda et al., «Not So Fast»,
USENIX ATC 2019](https://www.usenix.org/conference/atc19/presentation/jangda); [arXiv](https://arxiv.org/abs/1901.09056)).
V8 mejoró desde 2019; la cifra común hoy es ×1,2–1,6 [precedente, sin un estudio nuevo tan grande].

Que el nuestro sea ×2,45 y no ×1,5 dice algo: **el código traducido tiene una forma que a wasm le cae peor que al
nativo.** La bitácora ya nombró por qué (§160): V8 reparte peor los registros, **wasm no tiene la instrucción de dar
vuelta los bytes** (en el PC es una sola instrucción, `movbe`; en wasm son varias de desplazar y juntar) y quedan
trampolines.

### 1.2 Qué impuestos desaparecen con una isla decompilada

| Impuesto de hoy | Qué es | Cuánto pesa hoy | ¿Se va? |
|---|---|---|---|
| **Dar vuelta los bytes** en cada lectura y escritura | Cada número que la Wii guardó se lee al revés y se arregla | Repartido en todo el código; «memoria de la Wii» fuera de línea 6,1 % del hilo [medido §160] y el resto dentro de cada función | **Sí**, dentro de la isla. Queda solo en el borde y al cargar archivos del disco |
| **Traducir direcciones** (de dirección de la Wii a dónde está en wasm) | Cada puntero de la Wii se convierte antes de usarlo | M1/M2 ya sacaron ~7 % [medido §182]; queda parte del 6,1 % | **Sí**: los punteros son punteros de verdad. Detalle a favor: wasm32 usa punteros de 4 bytes **como la Wii**, así que las estructuras pueden conservar sus mismas posiciones internas (cambia el orden de los bytes, no el lugar de cada campo) |
| **Registros guardados en memoria** (el «CpuContext») | Los 32 registros enteros y 32 flotantes de la Wii viven en una estructura; en cada llamada se guardan y se leen | Sin medida aparte [estimado: parte grande del «V8 reparte peor»]. El compilador no puede dejarlos en registros de verdad a través de las llamadas | **Sí**: variables locales normales que el compilador acomoda donde quiere |
| **Banderas CR/XER** | La Wii anota «mayor/menor/igual/acarreo» en cada comparación; el traductor las calcula aunque nadie las lea | Techo medido ×0,88 en Node si se sacan todas (§193; en Chrome se diluye) | **Sí**: un `if` normal |
| **Despacho de llamadas indirectas** (tablas de funciones virtuales) | Cada `objeto->metodo()` pasa por una búsqueda «dirección de la Wii → función de wasm» | 4,8 % del hilo con los trampolines [medido §160] | **Sí**: tabla virtual de C++ directa (`call_indirect` de wasm, que es barato) |

### 1.3 Qué impuestos se quedan

| Lo que se queda | Por qué | Costo |
|---|---|---|
| **La FMA exacta** (fmadds, fnmsubs, ps_madd y sus primos) | Los fantasmas exigen los mismos bits que la Wii (§3). wasm no tiene FMA exacta: la de «relaxed SIMD» **puede redondear una o dos veces según el procesador**, o sea no es determinista ([propuesta relaxed-simd](https://github.com/WebAssembly/relaxed-simd/blob/main/proposals/relaxed-simd/Overview.md)). Sigue en software | Hoy 5,2 ns cada una; la del «punto medio» 1,5–2 ns suelta pero perdió en el juego por agrandar el código [medido §184]. En la función de matrices más pesada, la FMA la hacía **2,5 veces peor que la media** [medido §181.2]. **En la física, esto no baja con la decompilación** |
| **Las rarezas del flotante del Gekko** | Las estimaciones de inversa y raíz inversa (`fres`, `frsqrte`) salen de tablas propias del chip (Dolphin tuvo que hacerlas *menos* precisas para que los juegos anden, y en Double Dash eran fallas de física); algunas multiplicaciones de pares redondean un operando antes ([Dolphin, informe de mayo 2014](https://dolphin-emu.org/blog/2014/05/30/dolphin-progress-report-may-2014/); [el artículo de Dolphin sobre el redondeo del Gekko, PoC‖GTFO 6:3](https://mcfp.felk.cvut.cz/publicDatasets/pocorgtfo/contents/articles/06-03.pdf)) | Las mismas funciones de ayuda que ya usa el runtime de WiiCompiled (que ya pasa 75/75 y los fantasmas iguales): se reusan como «la especificación». Costo igual al de hoy en esos puntos |
| **Los archivos del disco en big-endian** | Pistas (KMP, KCL), modelos (BRRES), sonido (BRSAR), fantasmas (.rkg), partida (rksys, .pul) | **Una vez al cargar**, no en cada lectura. Medio a cero en la carrera |
| **Lo que el juego supone del hardware** | Números de punto fijo de la GPU (los «cuantizados» de `psq_l/psq_st`), el reloj del bus, el orden de memoria, el tamaño de la caché que el juego cree tener | Se escriben una vez como funciones propias; costo chico |
| **La forma de wasm** | ×1,2–1,6 contra nativo, que no se va con nada que corra en la página | Es el piso |

### 1.4 La cuenta del techo

Sea **Q** = cuánto más lento es el código **traducido** contra el código **decompilado**, los dos como programa
nativo. Nadie lo midió para este juego: es **el eslabón más flojo** de toda la cuenta. Hay que medirlo (es lo que mide el
piloto). Estimado: Q = 1,3–2,0 (el traductor de hoy hace un trabajo decente dentro de cada función; pierde en las
llamadas, las banderas, los bytes y los registros en memoria).

Ganancia de la lógica de una isla en wasm = 2,45 × Q ÷ (1,3–1,6):

| Caso | Q | wasm contra nativo de la isla | Ganancia contra hoy |
|---|---|---|---|
| Pesimista | 1,0 (la traducción ya era tan buena como el C) | 1,55 | **×1,6** (solo se va la parte de wasm que viene de la forma del código) |
| Realista | 1,3–1,5 | 1,4–1,5 | **×2,0–2,6** |
| Optimista | 2,0 | 1,3 | **×3,8** |

En la **física** hay que restar la FMA que se queda (§1.3): ahí lo realista es **×1,7–2,2** [estimado]. En lo que casi
no usa flotantes (la IA que decide, los objetos, el 2D, el árbol de escena) va el número entero.

### 1.5 Por escalón: ¿llega a 60?

La base es la de `techo-pasos.md`: el hilo del juego tarda 11 ms por imagen en este PC (carrera 4,4 + dibujo 6,7)
[medido §166.5], y cada escalón es S veces más lento [§163/§164]. Las tres columnas nuevas [todas estimadas]:

- **Híbrido realista:** dibujo nativo (6,7 → 2,7 ms, §2) + las islas calientes de la lógica ×2 (4,4 → 2,2 ms) ⇒
  **~4,9 ms** en este PC.
- **Híbrido + dibujo en otro núcleo:** con el dibujo nativo, mandarlo a otro hilo (paso 9) es mucho más fácil, porque
  solo hay que pasarle las matrices y los estados de cada cuadro. El hilo del juego queda con la lógica + ~1 ms de
  borde y página ⇒ **~3,2 ms**.
- **Optimista:** lógica ×3, dibujo 2 ms en otro núcleo ⇒ **~2,5 ms**.

| Escalón | S | Hoy | Híbrido realista | + dibujo en otro núcleo | Optimista | ¿60 dibujados? |
|---|---|---|---|---|---|---|
| Este PC | 1 | 11 | 4,9 | 3,2 | 2,5 | sí (ya hoy) |
| PC típico | ~2 | ~22 | ~10 | ~6,4 | ~5 | **sí** |
| Portátil de oficina | ~4,4 | ~45–50 | ~22 | ~14 | ~11 | **sí con el otro núcleo** |
| Teléfono gama media | ~5–5,7 | ~55–63 | ~25–28 | **~16–18** | ~13–14 | **en el borde (realista), sí (optimista)** |
| Teléfono gama baja | ~8,3 | ~92 | ~41 | ~27 | ~21 | **no**; pero la carrera sola: 2,2 × 8,3 ≈ 18 ms (realista), 12 ms (optimista) ⇒ **60 de carrera con 30 dibujados (N8) sí** |

Ojo con dos cosas:
- **La tarjeta de video.** En los escalones simulados no frena (0,2–3,3 ms por imagen) [medido §164]; el Oppo llegó a
  frenar por la tarjeta (~34 ms, §115) y después midió ~3 ms (§173). Un dibujo nativo también puede bajar la tarjeta
  (menos pasadas y copias), pero no está medido.
- **La gama media queda en el borde con lo realista.** No es una promesa de 60; es «pasa de ×3–3,8 que faltan a
  ×1,0–1,1 que faltan».

---

## 2. El dibujo nativo

### 2.1 Qué hacen hoy los ports de PC (y por qué no son el modelo)

Los ports de SM64 y de Ocarina of Time (Ship of Harkinian, [HarbourMasters/Shipwright](https://github.com/HarbourMasters/Shipwright))
**no** dibujan con geometría fija en la tarjeta: interpretan las listas de dibujo del N64 cada cuadro (Fast3D,
libultraship), que es la **misma arquitectura** que aurora con el GX de la Wii. Corren en todo porque el N64 dibuja
poquísimo, no porque su dibujo sea moderno. Lo mismo [Zelda 64: Recompiled](https://github.com/Zelda64Recomp/Zelda64Recomp),
que además es una **recompilación estática** como la nuestra y anda bien: su ventaja es el renderizador RT64 y que el
N64 es chico. **El precedente que de verdad sirve es otro:** [noclip.website](https://github.com/magcius/noclip.website)
dibuja las pistas de Mario Kart Wii en el navegador (TypeScript, WebGL/WebGPU) convirtiendo los BRRES y el TEV a
sombreadores **al cargar**. Prueba que se puede; no da una cifra de CPU comparable [precedente cualitativo].

### 2.2 Cómo sería el nuestro

Hoy, cada cuadro: el código del juego recorre la escena, calcula animaciones y matrices, y manda órdenes GX; aurora
las convierte una por una a WebGPU (estados, formatos, recetas, subidas; las subidas ya se guardan, G3/H12, §181).

Nativo, en dos niveles:

| Nivel | Qué cambia | Qué queda traducido | Ahorro estimado de CPU por imagen (este PC) |
|---|---|---|---|
| **D-a: el envío nativo** | Al cargar cada modelo (pista, karts, personajes, objetos): sus vértices en búferes de la tarjeta, sus materiales TEV ya convertidos en recetas. Cada cuadro: las matrices de todos en **un** búfer, objetos repetidos (cajas de objetos, monedas, árboles, público) **instanciados**, lo fijo de la pista en un **render bundle** | Las animaciones y el árbol de escena del juego (se leen las matrices finales de su memoria) | **−1,5 a −2,5 ms** (aurora del lado de la CPU 7,5 % del hilo [medido §160] + la parte del juego que arma las órdenes + Dawn/Blink que bajan con menos órdenes) |
| **D-b: el dibujo entero nativo** | Además: animaciones de esqueleto y materiales, partículas (efectos), el 2D (HUD), los efectos de imagen (brillo, profundidad) y las copias del EFB | Nada del dibujo | **−3,5 a −4,5 ms** (6,7 → 2–3 ms) |

**Por qué G3/H12 dio 0 en CPU y esto no:** G3/H12 sacó las **subidas** repetidas (la tarjeta lo notó, −10 %), pero el
juego siguió armando cada orden y aurora siguió convirtiendo cada una. Lo caro de la CPU no es mandar bytes, es
**decidir y traducir** cada orden, cada cuadro. Eso solo se va si el juego deja de hablar GX.

**Una trampa conocida:** en la sala la lógica lee las marcas de «se ve / no se ve» que deja el dibujo (por eso G1,
§179.1, recorta el dibujo pero deja la lógica con «todo a la vista»). El dibujo nativo tiene que seguir escribiendo esas
marcas igual que hoy, o la carrera cambia. Fuera de eso, **el dibujo no decide nada de la carrera**: es la isla sin
riesgo para los fantasmas.

---

## 3. Determinismo y fantasmas

### 3.1 Qué exige cada cosa

- **La sala (lockstep):** todos corren **nuestro** programa. Basta con que dos copias del mismo programa den lo mismo.
  Cualquier decompilación determinista sirve.
- **Los fantasmas (.rkg):** guardan **los botones**, no las posiciones. La carrera se rehace con la física. Para que un
  fantasma grabado en una Wii de verdad (los del personal de Nintendo, los expertos de Retro Rewind, los de la página
  que vengan de Wiis) maneje igual, **la física tiene que dar los mismos bits que el Gekko**. Un bit distinto en la
  velocidad en el cuadro 200 y en el cuadro 2.000 el fantasma ya choca contra una pared.

### 3.2 Qué hicieron los ports de decompilación

**Renunciaron.** El port de PC de SM64 desincroniza los TAS (las partidas de botones grabados) apenas Mario entra al
foso ([mkst/sm64-port, issue 27](https://www.github.com/mkst/sm64-port/issues/27)); incluso entre consolas de verdad,
la Consola Virtual de Wii redondea distinto al N64 y los TAS de una no corren en la otra
([Ukikipedia, Wii VC Round-to-Zero](https://ukikipedia.net/wiki/Special:MobileDiff/2751)). Los ports de Ocarina no
prometen compatibilidad bit a bit con TAS. **No hay precedente de un port decompilado que sea bit a bit con la
consola en la física.** Nosotros sí lo necesitamos; la ventaja es que ya tenemos el banco que lo comprueba.

### 3.3 Cómo se logra igual

Reglas para todo código de una isla de lógica [diseño]:
1. Compilar sin `-ffast-math` y con **`-ffp-contract=off`** (que el compilador no junte por su cuenta `a·b + c`).
2. **Cada FMA del binario es una llamada explícita** a la misma ayuda exacta del runtime de hoy. Una decompilación
   funcional no sabe qué hubiera fusionado el compilador original: lo lee del binario, instrucción por instrucción
   (cada fmadds/ps_madd del desensamblado = una llamada en el C). El comprobador lo vigila.
3. **El mismo árbol de operaciones:** ni reordenar sumas ni cambiar `x*0.5` por `x/2` donde redondean distinto.
4. **Las estimaciones (`fres`, `frsqrte`), las conversiones a entero y los pares de flotantes** con las ayudas de hoy.
5. Lo que no es FMA sale exacto «gratis»: suma, resta, multiplicación, división y raíz de flotantes en wasm son IEEE
   exactas, como el Gekko con su redondeo a simple (salvo las rarezas del §1.3, que ya están resueltas en el runtime).

**Costo en wasm:** la FMA exacta sigue costando lo de hoy (§1.3). Es la parte del impuesto que **la decompilación no
toca**. Por eso la física gana menos (×1,7–2,2) que el resto. La FMA SIMD de «relaxed SIMD» queda prohibida en la
física por no ser determinista; se puede usar en el dibujo, donde un bit no importa.

---

## 4. Retro Rewind y Pulsar

### 4.1 Qué es y cuánto pesa

Pulsar es C++ que se engancha en direcciones del juego original con Kamek (las «macros» `kmCall`, `kmBranch`,
`kmWrite32`…). Retro Rewind usa su versión ([Retro-Rewind-Team/rr-pulsar](https://github.com/Retro-Rewind-Team/rr-pulsar),
GPL-3.0 con partes MIT de Pulsar y mkw-sp, 1.546 commits). Contado en la copia local `terceros/Pulsar` [medido aquí]:

| Tipo de gancho | Cuántos | Qué hace |
|---|---|---|
| `kmCall` | 681 | Cambia una llamada del juego por una de Pulsar |
| `kmBranch` | 124 | Salta del juego a Pulsar (a veces sin volver) |
| `kmWrite32` / `16` / `8` | 352 / 22 / 15 | Pisa una instrucción o un dato del juego (una constante, un salto anulado) |
| `kmWritePointer` | 42 | Cambia un puntero (una tabla virtual, una tabla de pistas) |
| `kmPatchExitPoint`, `kmRuntimeUse`, `kmOnLoad`, `…Def…` | 17, 65, 7, 9 | Salidas, usos en tiempo de ejecución, código al cargar |
| **Total** | **~1.330** | en 190 archivos .cpp, ~46.000 líneas del motor; 47 archivos con ensamblador PowerPC dentro |

### 4.2 Cómo se pasa a un árbol decompilado

- **Mientras el juego sea híbrido, nada cambia:** el código de Retro Rewind sigue traducido con sus ganchos ya puestos,
  como hoy.
- **Al convertir una isla**, cada gancho que cae dentro de ella se reescribe en el código fuente: un `kmCall` es una
  llamada directa a la función de Pulsar en ese lugar; un `kmWrite32` hay que leerlo (¿cambia una constante?, ¿anula
  un salto?) y volverlo un cambio de una línea. Un guion cuenta cuántos ganchos caen en cada isla por su rango de
  direcciones antes de empezar.
- **Pulsar se compila desde su fuente, no se decompila:** es GPL y público. Sus encabezados `GameSource` ya describen
  las clases del juego con sus posiciones; como en wasm32 los punteros miden 4 bytes como en la Wii, **las posiciones
  de los campos pueden quedar iguales** y ese código casi no cambia. Lo que sí cambia: donde Pulsar lee bytes crudos de
  un archivo (sus `.pul`, las tablas de pistas) hay que dar vuelta los bytes, y los 47 archivos con ensamblador se
  reescriben en C.
- **La versión exacta:** el programa que corremos es el de Retro Rewind 6 que se distribuye; hay que fijar el commit de
  rr-pulsar que lo produce y comprobarlo contra el traducido con el mismo comprobador (que dé los mismos bits).

**Tamaño:** con el juego entero, ~1.330 ganchos a 10–30 minutos de sesión cada uno (leer, reescribir, comprobar) =
**2–6 semanas** de sesión, más 2–4 semanas para el ensamblador y para compilar Pulsar a wasm [estimado]. Por islas, solo
los que caen en cada una (en el dibujo, pocos; en la física y los objetos, bastantes, porque Retro Rewind cambia
objetos y velocidades).

---

## 5. El banco de comprobación y las islas

### 5.1 Por qué N14 no ganó nada

N14 reescribió tres funciones de matrices, dio **0 diferencias** en millones de llamadas y **no ganó**: ×1,04–1,24
por llamada, nada en el cuadro [medido §181.2]. La razón: la función nueva **seguía leyendo la memoria de la Wii**
(bytes al revés, direcciones de la Wii) y **seguía recibiendo y devolviendo por los registros de mentira**. Cambió el
interior, pero no los adaptadores de las puntas.

Con la comparación eléctrica: una línea larga con un adaptador de nivel cada metro. Cambiar un metro de cable por uno
mejor no sirve: los adaptadores siguen ahí. **Las pérdidas se van solo cuando se cambia un tramo entero entre dos cajas
de empalme**, y los adaptadores quedan en las dos cajas. Eso es una isla.

### 5.2 El camino, por fases (el juego anda siempre)

| Fase | Qué se hace | Cómo se comprueba | ¿Gana? |
|---|---|---|---|
| **F0 Inventario** | Para cada subsistema: qué funciones lo forman (del perfil por funciones, §160/§181.2) y **qué datos toca y quién más los toca** (un guion que mira en el traducido qué regiones de memoria lee y escribe cada función, o el vigía de memoria en una carrera, §62) | — | — |
| **F1 Fuente con tipos, sobre la memoria de la Wii** | La IA escribe cada función de la isla en C++ normal (tipos, estructuras, llamadas directas **dentro** de la isla), pero sus datos siguen en la memoria de la Wii | El comprobador de N14 (`caliente_nativo.cpp`): registros y memoria escrita en cada llamada, la memoria entera cada 997 | **No** (es N14). Sirve para tener fuente correcta |
| **F2 Cambiar el formato de los datos de la isla** | Los datos de la isla pasan a memoria propia, en orden nativo; el borde convierte (al cargar, o una vez por cuadro) | El comprobador **en el borde**: lo que la isla devuelve y lo que deja escrito en la memoria de la Wii, igual bit a bit; más las huellas de la sala (75/75) | **Sí**, acá aparece la ganancia |
| **F3 Medir el borde** | Si lo que cuesta cruzar el borde es más del 20 % del tiempo de la isla, se agranda la isla | El perfil | — |
| **F4 Adoptar** | Como todo lo del plan: la gama baja en el tramo fijo y este PC de control | La sala 75/75, `prueba-fantasma-igual` (cuadro a cuadro contra el experto), un juego de fantasmas grabados en Wii de verdad, `correr-todo` | — |

Un aviso sobre la comprobación: el comprobador solo prueba los caminos que **se corrieron**. Una rama que en las
carreras de prueba nunca pasa (un choque raro, un objeto raro) queda sin comprobar. Hay que correr la isla en muchas
pistas, con todos los objetos y los 4 niveles de CPU, y en las islas de la física guardar el traducido como «testigo»
durante semanas (correr los dos en las pruebas y comparar).

### 5.3 Las islas, en orden

Los porcentajes de la lógica son **[estimados]** con lo que se sabe de cómo está armado el juego: el primer día del
trabajo se miden con el perfil por funciones que ya existe.

| Isla | Peso | Borde | ¿Necesita bit a bit? | Dificultad | Orden |
|---|---|---|---|---|---|
| **Dibujo** (envío; después animación, efectos y 2D) | ~6,7 ms de 11 [medido §166.5, por ajuste] | Matrices y estados por cuadro + las marcas de «se ve» | No (salvo las marcas) | Mucho código nuevo, poco decompilado; formatos públicos (BRRES, TEV) | **1** |
| **Colisión** (las consultas contra el mapa de choque de la pista, KCL) | 5–10 % de la lógica [estimado] | Muy angosto: los datos del mapa no cambian después de cargar; entra una posición, sale el contacto | **Sí** | Chica, autocontenida | **Piloto y 2** |
| **Física del kart** (movimiento, choques del kart, suspensión) | 25–35 % de la lógica [estimado] | Ancho: 12 karts que leen la IA, los objetos, la cámara y el HUD | **Sí** | Alta, mucha FMA | 3 |
| **IA de la CPU** (11 pilotos) | 10–20 % [estimado] | Lee el estado de los karts y los puntos de la pista | **Sí** | Media | 4 |
| **Objetos y obstáculos** | 10–20 % [estimado] | Ancho; Retro Rewind cambia muchos | **Sí** | Media-alta | 5 |
| **Efectos (partículas)** | dentro del dibujo | Solo dibujo; **mirar si usan el azar del juego** (si lo usan, son lógica) | Depende | Media | con D-b |
| **Sonido (mezcla, reverberación)** | ~0,5 % o más [medido §181.2] | Ninguno con la carrera | No | Media | Mejor sacarlo del hilo (M9/N4) que decompilarlo |
| **Menús y UI** | frío en la carrera | — | — | — | **Nunca**: queda traducido |

---

## 6. El esfuerzo

### 6.1 Qué hay que decompilar [medido aquí]

En el traductor (`base_translation_metadata.json`): **29.637 funciones**, ~4,3 millones de instrucciones intermedias
estimadas por el traductor. La mitad tiene ≤ 59; el 90 % ≤ 345; el 99 % ≤ 1.300; **490 funciones pasan de 1.000**.
En la carrera pesan **1.886** [medido §181.2].

### 6.2 Lo que dicen los precedentes con IA (2025–2026)

| Fuente | Qué midió | Resultado |
|---|---|---|
| [«Can LLMs Really Do Matching Decompilation?»](https://gambiconf.substack.com/p/can-llms-really-do-matching-decompilation) | 60 funciones de GBA y N64, Claude Sonnet 4.6 + herramientas (m2c, permutador), 12 intentos | **74 %** iguales byte a byte (mejor corrida 80 %); 12 que nunca salen; 10 días para 6 corridas; a veces la IA dice que acertó y no |
| [Chris Lewis, «The Long Tail of LLM-Assisted Decompilation»](https://blog.chrislewis.au/the-long-tail-of-llm-assisted-decompilation/) (Snowboard Kids 2, N64, Claude Opus) | Un proyecto entero | Del 25 % al 58 % de golpe, después ~75 % y **se estanca**; funciones de más de 1.000 instrucciones «casi se rinde»; **las de gráficos y de matrices/vectores la confunden**; una raíz inversa de 86 instrucciones, meses sin salir; un plan Max 20× gastado «en días» |
| [DecompileBench](https://arxiv.org/pdf/2505.11340) | Programas reales | Claude 3.5 Sonnet ~35 % recompila y pasa; «recuperar el sentido sigue siendo difícil» |
| [LLM4Decompile](https://arxiv.org/html/2403.05286v3) (EMNLP 2024) | Funciones de prueba, re-ejecutables | 16–45 % según el conjunto; GPT-4o 4–16 % |

**Lectura escéptica:** los precedentes son **matching** (más difícil que lo nuestro: hay que adivinar el compilador) y
en **MIPS/ARM**, no en PowerPC con pares de flotantes. Lo nuestro es **funcional** (más fácil) pero con **comprobación
bit a bit en la física** (más estricta que «pasa los tests»). Y lo que más cuesta a la IA, según Lewis, es justo lo que
más pesa en una carrera: matrices, vectores y gráficos. Ningún precedente decompiló un juego entero de la Wii con IA.

### 6.3 Ritmo estimado por sesión (Opus, con el comprobador automático)

| Tamaño de la función | Funciones comprobadas por día y sesión | Falla en el primer intento | Sin salir tras muchos intentos |
|---|---|---|---|
| Chica (≤ 100) | 40–80 | 10–20 % | ~2 % |
| Media (100–1.000) | 10–25 | 30–50 % | ~8 % |
| Grande (> 1.000) | 1–5 | 60–80 % | 20–30 % (se parten o quedan traducidas) |

[estimado: de los precedentes de arriba, ajustado a «funcional con comprobador» y al ritmo de las sesiones de este
proyecto]. **Sesiones en paralelo: 4–8**, no más: las limita el tope de uso semanal del dueño (parar al 70 %), el
candado de medición (§176) y que alguien tiene que juntar las islas.

### 6.4 Calendario [estimado]

| Meta | Qué incluye | Meses |
|---|---|---|
| **(a) La isla del dibujo sola** | D-a (envío nativo, con las matrices del juego): 6–10 semanas. D-b (animación, partículas, 2D, efectos de imagen, copias del EFB): +3–5 meses | **2–2,5 (D-a) / 4–7 (entero)** |
| **(b) Las islas calientes de la lógica** | Herramientas del borde (F2): 2–3 semanas. Colisión → física → IA → objetos: ~2.000–2.500 funciones con sus vecinas, más los ganchos de Retro Rewind que caen ahí | **4–8** |
| **(c) El juego entero** | 29.637 funciones, los ~1.330 ganchos, el ensamblador de Pulsar, la comprobación de lo que casi nunca corre | **18–30**, y no da más fps que (a) + (b) |

---

## 7. Las reglas del dueño

- **¿Se puede servir igual, privado desde R2 detrás del Worker? Sí.** El código decompilado es **derivado del de
  Nintendo** igual que el C++ traducido de hoy (la IA lo sacó del binario): vive en una carpeta ignorada (dentro de
  `terceros/`, como `generated/`, o una nueva `privado/decomp/` agregada a `.gitignore` antes del primer archivo), nunca
  a git ni a ningún lado. El `.wasm` que sale es de la misma clase que el de hoy: sube con `subir-r2.mjs` a `mkw/build/`
  y lo entrega el Worker con el token de Firebase. **Nada cambia en cómo se publica.**
- **El producto sigue siendo la página:** todo lo de arriba es wasm + WebGPU en Chrome. El programa de Windows solo
  serviría para medir Q (§1.4), como `compilar-nativo.py`.
- **Nunca menos karts ni efectos:** nada de esto saca nada. Al revés: el dibujo nativo es lo que deja a los 12 karts y
  todos los efectos en la gama media.
- **GPL:** Pulsar compilado desde su fuente es GPL, como el runtime de hoy; no hay un problema nuevo.
- **Decompilar uno mismo** (la regla de 2026-10-19) es justo esto, en grande: leer el traducido y el desensamblado para
  entender y escribir una implementación propia.

---

## 8. Recomendación y piloto

### 8.1 El plan

**Híbrido, no decompilación entera.** Lo frío (menús, carga, red del juego, guardado, lo que casi no corre) se queda
traducido para siempre. Lo caliente se decompila **por islas con sus datos en formato nativo**, en este orden:
1. **El dibujo nativo D-a** (sin riesgo para los fantasmas; y abre la puerta a dibujar en otro núcleo, paso 9).
2. **La colisión.**
3. **La física del kart**, después la IA y los objetos.
4. **El dibujo entero D-b**, cuando D-a haya demostrado su ganancia.

Junto con los pasos 8–9 (el juego en un Worker, el dibujo en otro hilo) y N8 (dibujar a 30 con la carrera a 60), es
**lo único en la mesa que pone a la gama media a 60 y a la gama baja a 60 de carrera** [estimado §1.5]. Sin piloto es
una apuesta de 6–12 meses sobre un número que nadie midió (Q). Por eso el piloto va primero.

### 8.2 El piloto: 2 semanas, dos preguntas

**Semana 1 — ¿La lógica nativa gana de verdad? (la colisión)**

- **Día 1:** con el perfil por funciones de la carrera que ya existe (`build/web/datos/impuesto-perfil/`), sumar lo
  que pesan las funciones de consulta de colisión. Si pesan menos del 3 % de la lógica, cambiar a la isla autocontenida
  que más pese (con datos que no cambien en la carrera).
- **Días 2–5:** la IA decompila la isla (F1 y F2): el mapa de choque de la pista copiado al cargar en formato nativo;
  las consultas con tipos de verdad y la FMA explícita; el borde convierte posición de entrada y contacto de salida.
- **Días 6–7:** comprobar y medir. El comprobador en el borde (cada llamada) durante una carrera entera de 12 CPU, en 3
  pistas; `prueba-fantasma-igual` y la sala con `--build-b`. Medir: nanosegundos por llamada dentro y fuera de la isla
  (con el borde incluido), `medir-node-estable --fijo` intercalado, y la gama baja en el tramo fijo (§163). Con el
  candado.
- **Éxito:** 0 diferencias + fantasmas iguales + **la consulta (con el borde) ×2,0 o más rápida** + la ganancia del
  cuadro de acuerdo con su peso (al menos el 70 % de lo esperado).
- **Se mata la idea de la lógica** si la consulta gana **menos de ×1,4**: quiere decir que el impuesto es de V8 y no de
  imitar la máquina (Q ≈ 1), y decompilar la lógica no paga. Entre ×1,4 y ×2,0: seguir solo con las islas de poca FMA.

**Semana 2 — ¿El dibujo nativo gana de verdad? (la pista)**

- El modelo fijo de **una pista** (sus vértices y materiales a la tarjeta al cargar, en un render bundle), y el dibujo
  de ese modelo por el juego, apagado. Los karts y el resto siguen por aurora.
- Medir: CPU por imagen en la carrera (`medir-sitio --perfil pc` y la gama baja con `?lastre`, tramo fijo, `perfilGpu=1`)
  y la foto contra la de hoy (`foto-pantalla.mjs`).
- **Éxito:** **−0,5 ms o más** de CPU por imagen en este PC (≥ 4,5 %) y **≥ −5 %** en la gama baja, con la foto igual
  (menos del 0,5 % de los píxeles con más de 2 niveles de diferencia). Eso, extendido a karts y objetos, da el −1,5 a
  −2,5 ms de D-a.
- **Se mata** si baja menos del 2 % (el costo no estaba en el envío sino en el recorrido de la escena del juego: habría
  que ir directo a D-b, y eso ya son meses).

**La decisión al terminar:** las dos pasan → el plan híbrido entero (§8.1). Solo el dibujo → el dibujo nativo y el
paso 9, sin decompilar la lógica. Ninguna → la ruta de la decompilación queda cerrada con números, y sigue
`techo-pasos.md` (pasos 8–9 y N8).

---

## Fuentes

- Jangda, Powers, Berger, Guha, «Not So Fast: Analyzing the Performance of WebAssembly vs. Native Code», USENIX ATC
  2019: [usenix.org](https://www.usenix.org/conference/atc19/presentation/jangda), [arXiv 1901.09056](https://arxiv.org/abs/1901.09056)
- WebAssembly relaxed SIMD (la FMA que redondea una o dos veces): [Overview.md](https://github.com/WebAssembly/relaxed-simd/blob/main/proposals/relaxed-simd/Overview.md)
- Dolphin y el flotante del Gekko: [informe de mayo 2014](https://dolphin-emu.org/blog/2014/05/30/dolphin-progress-report-may-2014/), [PoC‖GTFO 6:3](https://mcfp.felk.cvut.cz/publicDatasets/pocorgtfo/contents/articles/06-03.pdf)
- SM64, TAS que desincroniza en el port: [mkst/sm64-port #27](https://www.github.com/mkst/sm64-port/issues/27); [Ukikipedia, Wii VC Round-to-Zero](https://ukikipedia.net/wiki/Special:MobileDiff/2751)
- Ports: [Ship of Harkinian](https://github.com/HarbourMasters/Shipwright), [Zelda 64: Recompiled](https://github.com/Zelda64Recomp/Zelda64Recomp), [noclip.website](https://github.com/magcius/noclip.website), [sm64js](https://github.com/sm64js)
- Decompilación de MKW: [doldecomp/mkw](https://github.com/doldecomp/mkw) (progreso en [decomp.dev](https://decomp.dev/doldecomp/mkw); el 5,8 % lo dio la orquestadora, no se volvió a mirar)
- Retro Rewind: [rr-pulsar](https://github.com/Retro-Rewind-Team/rr-pulsar), [Retro-Rewind-Team](https://github.com/Retro-Rewind-Team)
- IA y decompilación: [«Can LLMs Really Do Matching Decompilation?»](https://gambiconf.substack.com/p/can-llms-really-do-matching-decompilation),
  [«The Long Tail of LLM-Assisted Decompilation»](https://blog.chrislewis.au/the-long-tail-of-llm-assisted-decompilation/),
  [DecompileBench](https://arxiv.org/pdf/2505.11340), [LLM4Decompile](https://arxiv.org/html/2403.05286v3),
  [Decompile-Bench](https://arxiv.org/pdf/2505.12668)
