# El techo de lo que falta del plan de rendimiento

*Escrito el 2026-10-31, después de §193. No se midió nada nuevo para esto: todo sale de la bitácora y del plan. Cada
número dice de dónde sale: **[medido §N]** o **[estimado]** con lo que lo sostiene.*

## La respuesta en cuatro líneas

1. **Con todo lo que falta del plan, saliendo bien y siendo realista, el hilo del juego baja ×1,4–1,6.** En el mejor
   caso, si todo sale perfecto, baja ×2,5 (y ×3 si además se reescribe a mano el dibujo de los modelos, los efectos y
   el 2D: meses). La meta del plan era ×3,4 (de 11 a 3,3 ms).
2. **Con eso llegan a 60 este PC, el PC típico y, muy probablemente, el teléfono tope de gama.** El portátil de oficina
   llega solo en el mejor caso. **La gama media y la baja simuladas no llegan a 60 dibujados con nada del plan**, y la
   gama baja ni siquiera llega a *simular* 60 cuadros de carrera por segundo sin dibujar nada.
3. **El salto grande que queda no está en el motor sino en la forma:** sacar del hilo del juego lo que no es la carrera
   (pasos 8–9) y **simular a 60 dibujando a 30 con imágenes intermedias** (N8, ya preparado por R2). Las dos cosas juntas
   ponen al portátil y a la gama media cerca de la meta. Para la gama baja no alcanza nada que corra en la página.
4. **Recomendación:** hacer los pasos 8–9 y N8, cerrar las banderas de M8 y H6, y **dejar de buscar** ganancias de a una
   función (N14, M4, M5, H9, N7, variantes de la FMA). Y que el dueño decida si la meta de la gama media y la baja pasa a
   ser «60 de carrera, 30 dibujados con 60 a la vista» y, para la baja, «el video desde un PC de la sala» (N11).

---

## 1. Dónde se va hoy el tiempo de un cuadro

### Lo que tarda cada escalón

El tiempo que importa es **la CPU del hilo del juego por imagen, dibujando todas las imágenes** (como juega una
persona a 60). Medido en este PC: **10,8–11,4 ms** [medido §166.5]. Separado en dos partes con dos ecuaciones (sin tope
y con tope): **la carrera ≈ 4,4 ms por cuadro** y **el dibujo ≈ 6,7 ms de CPU por imagen** [§166.5; es un ajuste de
dos medidas, no una medida directa de cada parte]. Dibujar cuesta en la CPU más que la carrera misma.

Para los demás escalones se usa el factor de lentitud S (cuántas veces más lento es todo el hilo que en este PC), sacado
de la escalera calibrada en el tramo fijo (§163–§164). S es mayor que el lastre porque el ladrón de caché y tener menos
núcleos suman:

| Escalón | Cómo se simula | S (estimado de §163/§164) | Hilo del juego por imagen hoy | Le falta para 16,7 ms |
|---|---|---|---|---|
| Este PC (9800X3D) | sin lastre | 1 | **11 ms** [medido §166.5] | le sobra ×1,5 |
| PC típico (2018–21) | `lastre=2.2`, 8 núcleos | ~2 | ~22 ms [estimado] | ×1,3 |
| Portátil de oficina | `lastre=3&ladron=64`, 4 núcleos | ~4,4 | ~45–50 ms [estimado; §159 midió 39 ms con el piloto] | ×2,7–3 |
| Teléfono tope (Oppo) | real, ya no se mide | ~1,5–2,5 | 12,5 ms «juego» en régimen [§114], 29 ms con las subidas viejas [§173] | ×0,8–1,7 (sin cerrar) |
| Teléfono gama media | `lastre=4&lastreAyuda=3&ladron=64&lastreGpu=6` | ~5–5,7 | **~50–63 ms** [§159 midió 49,5 ms de CPU pura; el modelo da 63] | **×3–3,8** |
| Teléfono gama baja | `lastre=7&lastreAyuda=5&ladron=64&lastreGpu=15` | ~8,3 | **~92 ms** [estimado §166.5 desde 44 ms por cuadro dibujando 1 de cada 7] | **×5,5** |

La tarjeta de video no frena en ningún escalón simulado: 0,2–3,3 ms por imagen contra 37–377 ms de CPU [medido §164].
Del teléfono real hay una sola lectura con las marcas de la tarjeta: ~3 ms por imagen [§173]. **Todo el problema es la
CPU de un hilo.**

### El presupuesto de ese hilo, pieza por pieza (Amdahl)

**La ley de Amdahl, con una comparación eléctrica:** si una resistencia en serie es el 20 % del total, aunque la
cortocircuites la corriente solo sube ×1,25. Lo que no se toca pone el techo. Por eso importa cuánto pesa cada pieza.

El reparto del hilo en la carrera sale del perfil de Chrome (VS de 12, 60 fps, §160). Las porciones son del tiempo
ocupado; los ms aplican esas porciones a los 11 ms de §166.5 [estimado]:

| Pieza | Parte del hilo | ms por imagen (este PC) | Fuente | ¿Qué paso la ataca? |
|---|---|---|---|---|
| Código del juego traducido + Retro Rewind | 44,5 % | ~4,9 | [medido §160: 40 % + 4,5 %] | 6, 13, 14 |
| … de eso, la carrera (física, IA, objetos) | — | ~2,6 | [estimado con el 4,4/6,7 de §166.5] | 6, 13 |
| … de eso, el dibujo propio del juego (modelos, efectos, 2D) | — | ~2,3 | [estimado, ídem; V4 no lo separó] | 6, 14 |
| Memoria de la Wii (lo que queda fuera de línea) | 6,1 % | ~0,7 | [medido §160; M1/M2 ya sacaron ~7 %, §182] | 6 (H6, H7) |
| Despacho de llamadas indirectas + trampolines | 4,8 % | ~0,5 | [medido §160; ≤3,5 % del impuesto, §166.3] | 13 (M3) |
| Otro runtime (hilos del sistema, mezcla del sonido, ayudantes) | 6,6 % | ~0,7 | [medido §160] | 9 (M9, N4) |
| aurora: GX → WebGPU, del lado de la CPU | 7,5 % | ~0,8 (+ parte de lo de abajo) | [medido §160] | 9 (G9, H4) |
| `(program)` de Chrome: tareas de Blink y de la página, compositor, Dawn, recolector, JSPI | 8–21 % | ~0,9–2,4 | [medido §160, §165.4] | 8, 9, 12 |
| … de eso, las idas y vueltas de JSPI | <1 % | ~0,05 | [medido §166.2: 4,8 µs cada una, ~10 por cuadro] | 13 (M10) |
| … de eso, Dawn serializando comandos | <1 % | ~0,07 | [medido §165.4: 4 ms/s] | 9 |
| JavaScript de la página | 5,7 % | ~0,6 | [medido §160] | 8, 12 |

**El impuesto del navegador** es cuánto más lento corre el mismo juego en wasm que como programa de Windows:
**×2,45 por función** y **×2,45–2,63 de pared** [medido §165, §166.1, §170.2]. Está **repartido parejo**: 1.886
funciones, la más pesada es el 2,5 %, las 50 primeras el 34 %, y todas pagan más o menos lo mismo [medido §181.2]. No
viene de una pieza rota sino de cómo V8 traduce el código: reparte peor los registros, no tiene la instrucción de dar
vuelta los bytes y deja trampolines que clang borra [§160]. Es como un conductor más fino en todo el cableado: no hay un
punto caliente que cambiar, la caída está repartida en cada metro.

Lo que dice este cuadro:
- **Lo que se puede sacar del hilo sin tocar la carrera** (aurora, el sonido, la página, Blink, el disco) es
  **~2,5–3,5 ms de 11 (25–30 %)** [estimado]. Es el paso 8–9.
- **El código traducido es ~62 % con su memoria y su despacho** [medido §160]. Ahí solo entra lo que baje el impuesto
  de todo el código a la vez; de a una función ya se vio que no (§181.2).
- **El dibujo propio del juego (~2,3 ms) es código traducido que no decide la carrera**: es la única pieza grande que
  se podría dibujar menos veces (N8) o sacar a otros núcleos (paso 14, muy caro).

---

## 2. Paso por paso: lo que queda y su techo

Las ganancias son sobre **el hilo del juego** de la gama media y la baja simuladas (las que frenan). «×1,10» = el hilo
**trabaja 1,10 veces más rápido** (11 ms → 10 ms). Lo que ya dio el plan, para tener
la vara: M1/M2 **+5,2 %** en la gama baja [§182]; G3/H12 **0 en CPU** (−10 % de tarjeta) [§181.1]; G1 **−0,7 ms** solo
en la sala [§179.1]; N14, FMA, hojas, memo, r14–r31, G6: **×1,00 o peor** [§178, §181.2, §184, §190.2, §193].

| Paso | Lo que falta | Cómo funciona | Qué pieza ataca | Realista (media / baja) | Techo optimista | Costo | Confianza |
|---|---|---|---|---|---|---|---|
| **6** Motor: traductor y memoria | N15 (queda N15b, va con el 9), M8 banderas «seguro», H11, M6, M7, H6, H7 | Banderas: guardar solo los campos del CR que alguien lee; H6: la RAM de la Wii en lugar fijo; H7: guardada ya dada vuelta; H11/M6/M7: ordenar y compilar mejor | código traducido + memoria (~7 ms de 11) | **×1,06–1,15** / ×1,06–1,18 | ×1,30 | 4–7 semanas | media-baja. Las banderas tienen un techo medido de ×0,88 en Node, pero **en Chrome se diluye** (el código traducido es ~62 % del hilo): ≤ ×1,07 [estimado de §193]. H6 ataca un 6–10 % del hilo: ≤ ×1,05. H7 toca todo lo que lee la RAM desde fuera (aurora, disco, página): caro y con riesgo. H11 podría ayudar en la baja (código más chico) justo porque lo que creció perdió (§184, §193) |
| **7** IA en lo caliente, subidas | nada (3/3) | — | — | — | — | — | — |
| **8** Arquitectura y puerta A | N3, P9, P10, H5 | El juego en un Worker, en su propio proceso; la página queda para la interfaz y la red | página, Blink, sitio (~1–1,5 ms) | ×1,05–1,12 | ×1,15 | 1–2 semanas de prueba | media. Es sobre todo **la base** del paso 9; el riesgo es de plataforma: JSPI en un Worker, WebGPU con OffscreenCanvas y la memoria compartida en Android (Document-Isolation-Policy está desde Chrome 137; en Android de menos de 2 GB de RAM era un plan, sin confirmar) |
| **9** Hilos; CPU y tarjeta en paralelo | H3, N4, H4, G9, N15b, M9, D11 | aurora en su núcleo leyendo una cola de comandos (la FIFO de la Wii), el sonido y el disco en otros | aurora, Dawn, sonido, disco (~1,5–2,5 ms) | **×1,15–1,30** | ×1,45 | 4–6 semanas (+2–4 si la aurora nueva) | media. Es **la pieza que más saca de todo lo que falta**. La carrera sigue en un solo hilo (la Wii tenía un solo procesador; repartirla separa la sala y los fantasmas). H3 (CPU y tarjeta en paralelo) da **~0 en los escalones simulados**: la tarjeta nunca frena (§164). Hay un costo nuevo: armar y pasar la cola entre hilos |
| **10** Tarjeta del teléfono | N9, G7, G10, H13 | Menos pasadas, atributos de vértice, camino para tarjetas de mosaicos | la tarjeta, casi nada de CPU | ×1,00–1,03 | ×1,05 | 4–6 semanas | alta en que **no mueve la CPU**. Solo sirve si un teléfono real resulta frenado por la tarjeta; lo medido dice que no (§164, §173) |
| **11** Sala asíncrona | criterios abiertos (R1–R9 hechos) | — | — | 0 en el hilo | — | — | — (R2 ya hecho es la base de N8) |
| **12** Página liviana | P1, P2, R4, U4 | Un lector de mandos, el «modo juego» del sitio, lockstep sin basura | página (~0,6 ms) | ×1,00–1,05 | ×1,07 | 1 semana | media. Se pisa con el 8: con el juego en un Worker, la página ya no está en su hilo |
| **13** Motor: las cuentas | M3, M5, H8, H9, M4, D10, M10, P5 | Llamadas indirectas, la multiplicación-suma, las cuentas de a dos, versiones exactas de matrices, JSPI | despacho (0,5 ms), FMA, JSPI (0,05 ms) | **×1,02–1,06** | ×1,12 | 3–4 semanas | **baja**. Ya probado de a pedazos: M4/H9 eran las funciones de matrices de N14 (×1,01, la de SIMD más lenta), la FMA «punto medio» perdió −7,5 % en la baja (§184), M3 pesa ≤ 3,5 % del impuesto (§166.3), JSPI < 1 % (§166.2). Lo único con algo de techo es H8 (la multiplicación-suma del aparato, si sale fusionada): ~2–5 % [estimado] |
| **14** Lo visual en paralelo | N5, N6, H10, N7, M11 | Reescribir en C++ propio la animación de los modelos, los efectos y el 2D, y correrlos en otros núcleos con una foto del estado | el dibujo propio del juego (~2,3 ms) | ×1,0–1,25 | ×1,45 | **3–6 meses** | **muy baja**. Es reimplementar tres bibliotecas enteras de Nintendo, más lo que Retro Rewind les cambia (el 2D de RR está muy parcheado), sin poder copiar nada, y probar que la carrera no lee nada de eso. Antes de decidir hace falta medir cuánto pesa de verdad cada sistema (los contadores de V4, días). N7 (la lógica exacta a mano) ya lo contestó N14: no hay función que pese |
| **15** Gráficos 2.ª tanda | N8, E1, E2 (en curso, apagados) | Simular a 60, dibujar 1 de cada 2 y mostrar la imagen intermedia de aurora | el dibujo (juego + aurora) cada 2 cuadros | **×1,25–1,45** por cuadro de carrera | ×1,6 (dibujando 1 de cada 3) | 2–3 semanas | media-alta. No baja la CPU de una imagen: la reparte en dos cuadros. Ver §4c |
| **16** Puerta B y prueba final | N12, V6, V7, N11 | N11: un PC de la sala dibuja también la vista del teléfono débil y se la manda en video | ninguna: el teléfono ya no simula | — (no aplica) | cualquier teléfono a 60 en la sala | 3–5 semanas | media; solo en la sala con un PC fuerte, +30–50 ms de demora |

---

## 3. El techo de todo junto, escalón por escalón

**Cómo se suma.** No se multiplican los pasos sin más: los pasos 8, 9 y 12 sacan del hilo piezas distintas que suman
como mucho ~3 ms de 11, y los 6 y 13 aceleran el código que queda. Se arma el cuadro que queda con el presupuesto de
§1 [todo estimado]:

| Caso | Carrera por cuadro | Dibujo propio por imagen | Hilo del juego por imagen (este PC) | Contra hoy |
|---|---|---|---|---|
| Hoy | 4,4 | 6,7 | **11,1 ms** | ×1 |
| Realista (pasos 6, 8, 9, 12, 13) | ~3,3 | ~4,2 | **~7,5 ms** | **×1,5** |
| Optimista (lo mismo, todo saliendo perfecto) | ~2,9 | ~3,0 | **~5,9 ms** | ×1,9 |
| Optimista + paso 14 (la mitad del dibujo a otros núcleos) | ~2,7 | ~1,7 | **~4,4 ms** | ×2,5 |
| Todo perfecto (la meta del plan) | — | — | 3,3 ms | ×3,4 |

Cada escalón = S × el hilo de este PC (con 12 karts y todos los efectos, dibujando las 60 imágenes):

| Escalón | S | Hoy | Realista | Optimista + 14 | ¿Llega a 60 dibujados? |
|---|---|---|---|---|---|
| Este PC | 1 | 11 | 7,5 | 4,4 | **Sí** (ya hoy) |
| PC típico | ~2 | ~22 | ~15 | ~9 | **Sí, con lo realista** (justo) |
| Portátil de oficina | ~4,4 | ~49 | ~33 | ~19 | **No**; ni el optimista (~19 ms, a un 15 % de entrar) |
| Teléfono tope | ~1,5–2,5 | 12,5–29 | ~11–19 | ~7–11 | **Probable** con lo realista; no está cerrado porque el Oppo ya no se mide |
| Teléfono gama media | ~5–5,7 | ~55–63 | ~38–43 | ~22–25 | **No** |
| Teléfono gama baja | ~8,3 | ~92 | ~62 | ~37 | **No**, lejos |

**Simular sin dibujar** (lo mínimo para estar en una carrera de la sala con el árbitro, R1/R2): la carrera sola en la
gama baja hoy es ~4,4 × 8,3 ≈ **37 ms** por cuadro [estimado]; con lo optimista, ~2,7 × 8,3 ≈ **22 ms**. **La gama baja
simulada no llega a simular 60 cuadros por segundo ni sin dibujar nada.** La media, con lo optimista, ~14–15 ms: justo.

**El chequeo de cordura con Dolphin.** Dolphin (el emulador de Wii, con compilador al vuelo propio y dos núcleos) tiene
fama de que Mario Kart Wii es de lo más pesado en Android: los foros hablan de que anda estable recién en
Snapdragon 835 y no siempre a velocidad completa, y no encontré un informe confiable de un Snapdragon 7 de gama media a
60. Esto no prueba nada sobre nuestro número, pero es coherente: la gama media no es fácil ni para un programa nativo.

**Una duda que pesa sobre todo esto.** La gama media y la baja son **este PC frenado**, no aparatos reales. El ladrón de
caché y tener menos núcleos suman ~40 % encima del lastre (§159, §163), y nadie sabe si un teléfono de verdad se
parece. Un teléfono real podría estar mejor o peor. Con la regla del dueño (solo este PC), no hay forma de saberlo.

---

## 4. Alternativas fuera del plan

### (a) La decompilación pública de Mario Kart Wii, compilada directo a wasm

- **Cuánto está hecha:** el proyecto doldecomp/mkw (solo la versión PAL `RMCP01`, la nuestra) marca hoy **5,78 % del
  código decompilado y 3,95 % enlazado** (decomp.dev, consultado el 2026-10-31). Empezó en 2020–21. Es una
  decompilación «que coincide»: su meta es volver a compilar el mismo binario de la Wii, no un juego para PC.
- **Retro Rewind/Pulsar:** el código de RR **sí es público** (el repositorio rr-pulsar, GPLv3, sobre Pulsar que es MIT),
  pero está escrito como **ganchos a direcciones del binario original** (Kamek). Con un juego compilado desde fuente
  cada gancho habría que rehacerlo a mano, y RR los cambia en cada versión. El plan ya lo había anotado (§«Cuestionar
  todo»: «solo un binario traducido respeta eso»).
- **¿Quitaría el impuesto?** En parte. Se irían las banderas del CR emuladas (techo ~12 % en Node, §193), los registros
  en memoria y la tabla de páginas (la memoria sería punteros directos). **No se iría:** que wasm es más lento que nativo
  también con C++ normal (la regla general es ×1,3–1,6 para código compilado a wasm, [estimado]); dar vuelta los bytes
  de **todos los archivos del juego**, que vienen con el byte grande primero (habría que convertir cada archivo al
  cargarlo, como hacen los ports de otros juegos de Nintendo); y la multiplicación-suma exacta, que hace falta igual
  para que la física dé los mismos bits que los fantasmas grabados en una Wii.
- **Techo:** ×1,5–1,9 sobre el código traducido de hoy [estimado], parecido al optimista del plan.
- **Costo:** con 5,8 % en ~5 años, faltan muchos años de trabajo de la comunidad. Y además portar RR entero.
- **Veredicto: no.** No está, no va a estar a tiempo y no gana mucho más que el plan.

### (b) Mejorar la salida del traductor entera (pasadas tipo M8): por qué no rindió

- **Lo que se probó:** no releer r14–r31 (×1,00, §178), hojas en línea al doble (−6 % en la baja, §193), memo de
  indirectas ×4 (×0,993, ruido), banderas «techo» (×0,88 en Node pero **separa la sala**), banderas «seguro» (×0,99:
  el análisis no sabe a quién llama una indirecta y supone que lee todo).
- **Por qué:** (1) el trabajo de más que escribe el traductor es poco; el impuesto está en **cómo V8 compila** cualquier
  código (registros, sin la instrucción de dar vuelta bytes, trampolines), y eso ninguna pasada lo toca; (2) lo que
  agranda el código (más copias en línea) **pierde en la gama baja**, porque llena la caché de instrucciones; (3) la
  única pasada con techo grande (banderas) choca con que Retro Rewind no cumple la regla de la Wii.
- **Techo que queda:** las banderas «seguro» con el arreglo de §193: ≤ ×0,88 en Node, ~×1,05–1,07 en Chrome [estimado,
  porque el código traducido es ~62 % del hilo]. H11/M6 (ordenar el código caliente) podrían ganar algo justo en la baja.
- **Costo:** 1–2 semanas las banderas; días M6/M7.
- **Veredicto:** cerrar las banderas (el arreglo ya está escrito) y probar M6/M7 que son baratos. **Ninguna otra pasada.**

### (c) Cambiar la meta: 60 de carrera siempre, 30 dibujados con imágenes intermedias en lo de abajo

- **Qué es:** la carrera (la lógica) sigue a 60 cuadros por segundo, igual en todos los aparatos; el aparato lento dibuja
  1 de cada 2 cuadros y aurora inventa la imagen del medio volviendo a dibujar cada modelo 3D a mitad de camino (lo
  mismo que hace hoy para monitores de 120/180 Hz, `frame_interpolation_fps`, §107). Es como un televisor de 120 Hz que
  inventa cuadros: el partido es el mismo, la pantalla se ve más pareja.
- **¿Cumple la regla del dueño «sin sacar efectos ni karts»?** Sí: corren los 12 karts y se dibujan todos los efectos.
  Lo que cambia es **la meta de 60 dibujados** que está en `CLAUDE.md` («60 fps, la velocidad nativa»): eso lo decide el
  dueño. Además, Mario Kart Wii ya se salta imágenes solo cuando va atrasado (§163: hoy la gama baja dibuja 1 de cada 7).
- **¿Se puede técnicamente aquí?** Sí, y está casi preparado:
  - R2 ya salta el dibujo de un cuadro sin cambiar la carrera: la sala da las mismas huellas (75/75) y el fantasma
    igual byte por byte saltando 1 de 2 y 2 de 3 [medido §192].
  - Falta N8: que aurora no presente el cuadro saltado y ponga la imagen intermedia en su lugar.
  - La interpolación sin hilos ya se midió en la gama baja: **no cambia nada** porque no hay tiempo libre donde
    meterla (2,9 imágenes por segundo con y sin) [medido §170]. O sea, hoy no ayuda sola: ayuda **junto con R2** (que
    libera el tiempo de no dibujar).
  - Precio: un cuadro más de demora (16,7 ms) y el 2D (el marcador) a 30.
- **Cuánto da** [estimado con el 4,4/6,7 de §166.5]: por cada cuadro de carrera se paga la carrera entera más **la mitad**
  del dibujo propio del juego, más la imagen intermedia de aurora. Hoy: 4,4 + 4,8/2 + ~1,9 ≈ 8,7 ms en vez de 11,1
  (**×1,28**). Con aurora en su propio hilo (paso 9), la imagen intermedia sale del hilo del juego: ≈ 6,8 ms (**×1,63**).
- **Junto con lo realista del plan** (carrera ~3,3, dibujo propio ~4,2 → 3,3 + 2,1 ≈ **5,4 ms** por cuadro):

  | Escalón | S | Por cuadro de carrera (realista + 30/60) | Optimista + 14 + 30/60 | ¿60 a la vista? |
  |---|---|---|---|---|
  | Portátil de oficina | ~4,4 | ~24 | ~16 | **Solo con lo optimista**, justo |
  | Gama media | ~5–5,7 | ~27–31 | ~18–20 | **No**; cerca solo en lo optimista |
  | Gama baja | ~8,3 | ~45 | ~29 | **No** |

- **Veredicto: sí, como meta escalonada,** porque es lo más barato que queda (2–3 semanas) y lo único que cambia la forma
  del problema. Pero hay que decirlo claro: **solo no alcanza para la gama media ni la baja**; las acerca, junto con los
  pasos 8–9.

### (d) Otras cosas creíbles

- **El video desde un PC de la sala (N11, ya en el paso 16).** Es lo único que pone un teléfono de gama baja a 60 en la
  sala: el teléfono no simula, solo mira. Costo: 3–5 semanas, +30–50 ms de demora, la subida del PC y que el PC dibuje dos
  vistas. No sirve para jugar solo. **Es el plan C honesto para la gama baja.**
- **La carrera directo sin dibujo en el teléfono del que mira** no existe sin N11: con el árbitro (R1) el que no simula 60
  queda fuera de la carrera y no frena a nadie (ya está, §191).
- **Probar el aparato de mentira contra un aparato real barato.** Todo el diagnóstico de la gama media y la baja
  descansa en que el lastre + el ladrón se parezcan a un teléfono. Una sola medida real cambiaría la decisión. La regla del
  dueño es no conseguir aparatos (memoria `pruebas-solo-pc-y-oppo`): se anota como riesgo, no como paso.
- **Descartadas de nuevo:** rollback (88 MB de estado, fibras que no se pueden guardar), un servidor que corra el juego
  (el ejecutable de Nintendo fuera de R2 privado), bajar la resolución (la tarjeta no frena, §164), una app nativa (el
  dueño, 2026-10-29), quitar karts o efectos (el dueño, §114.6–114.7).

---

## 5. Recomendación

**Hacer, en este orden:**
1. **Pasos 8 y 9** (el juego en un Worker; aurora, el sonido y el disco en otros núcleos). Es la pieza más grande que
   queda (×1,2–1,4 realista) y la condición para que la imagen intermedia no cueste en el hilo del juego. Empezar por la
   semana de prueba (puerta A): si JSPI en un Worker o la memoria compartida en Android no andan, se sabe antes de
   construir encima.
2. **N8** (2–3 semanas): R2 ya está; falta que aurora no presente el cuadro saltado y ponga la imagen intermedia.
   Medirlo en la gama media y la baja simuladas.
3. **Cerrar las banderas de M8** con el arreglo ya escrito en §193 (1–2 semanas), **H6** (2–3 semanas) y probar **M6/M7**
   (días). Medido como siempre: la gama baja y este PC, intercalados.
4. **Antes de decidir el paso 14**, medir con los contadores de V4 cuánto pesa de verdad el dibujo propio del juego
   (los modelos, los efectos, el 2D). Si es menos de ~2 ms en este PC, no vale los meses.

**Dejar de hacer:**
- Reescribir funciones de a una (N14, M4, H9, N7) y variantes de la multiplicación-suma (M5, la FMA punto medio): ya se
  midió que el impuesto está repartido parejo.
- Pasadas del traductor que agrandan el código (hojas en línea, más copias): pierden en la gama baja.
- M3 y M10: pesan menos del 3,5 % y del 1 %.
- El paso 10 (la tarjeta) mientras ningún escalón esté frenado por la tarjeta.
- H7 (la RAM dada vuelta) hasta que H6 muestre que la memoria todavía pesa: toca aurora, el disco y la página enteros.

**Decisiones del dueño** (no las puede tomar nadie más):
1. ¿La meta pasa a ser escalonada? **60 dibujados** en este PC, el PC típico y el teléfono tope; **60 de carrera con
   30 dibujados y 60 a la vista** (N8) en el portátil y la gama media; y para la **gama baja**, en la sala, **el video
   desde un PC** (N11), y jugando solo, lo que su núcleo dé, con el aviso de N12.
2. ¿Se sigue con el paso 14 (meses) si los contadores dicen que el dibujo propio pesa? Es lo único que, sumado a todo,
   acerca la gama media a 60 dibujados, y aun así no la garantiza.
3. La base (WiiCompiled) **se queda**: ninguna alternativa (la decompilación, otro motor) gana a tiempo.

---

## Fuentes

- `docs/plan-rendimiento.md` (los 16 pasos, los ítems y el «Avance»; 58 de 111 ítems hechos al escribir esto).
- `docs/bitacora.md`: §159, §163, §164 (la escalera simulada y el tramo fijo); §160, §165, §166 (el impuesto, el reparto
  en Chrome y en Node, JSPI, las llamadas indirectas, la CPU por imagen); §170 (v0.9.3, la interpolación medida en la
  baja); §173 (el Oppo del 30-10); §178, §193 (M8); §179.1 (G1); §181 (G3/H12, N14); §182 (M1/M2); §184 (la FMA);
  §190 (G6/G4, E1/E2); §191, §192 (R1/R2); §107 (`frame_interpolation_fps`); §114, §115.5 (el teléfono).
- Web, consultadas el 2026-10-31:
  - [decomp.dev/doldecomp/mkw](https://decomp.dev/doldecomp/mkw): 5,78 % decompilado, 3,95 % enlazado.
  - [doldecomp/mkw README](https://raw.githubusercontent.com/doldecomp/mkw/HEAD/README.md): en curso, solo `RMCP01`.
  - [Retro-Rewind-Team/rr-pulsar](https://github.com/Retro-Rewind-Team): RR sobre Pulsar, GPLv3; Pulsar, MIT.
  - [Document Isolation Policy (Chrome 137)](https://developer.chrome.com/blog/document-isolation-policy) y
    [la nota de abril de 2025 sobre Android de poca memoria](https://lists.w3.org/Archives/Public/public-webapps-github/2025Apr/0625.html).
  - Foros de Dolphin sobre Mario Kart Wii en Android ([835](https://forums.dolphin-emu.org/Thread-mkw-optimization-for-android?pid=476044),
    [S7](https://forums.dolphin-emu.org/Thread-galaxy-s7?page=5)): informes de usuarios, de confianza baja.
