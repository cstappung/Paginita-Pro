# Soluciones para el motor: cómo bajar el costo del código traducido dentro de WebAssembly

*Escrito el 2026-10-31. Es investigación: no se compiló, no se midió y no se tocó nada del proyecto. Cada número dice si
es **[medido §N]** (sale de la bitácora) o **[estimado]** (con lo que lo sostiene). La parte de «hacer menos trabajo» y
«repartir en hilos» la cubre otro trabajo; acá solo va **el motor**: lo que cuesta el código PowerPC traducido una vez
que está dentro de wasm.*

---

## La respuesta corta

1. **El motor solo no llega a ×3, pero sí puede poner la mitad del camino.** Con lo de abajo, el código traducido puede
   correr **×1,5 más rápido siendo realista y ×2,1 en el mejor caso** [estimado]. Como el código traducido es ~62 % del
   hilo del juego, eso da ×1,3–1,5 en el hilo de hoy, y **×1,4–1,8 una vez que los pasos 8–9 saquen del hilo lo que no
   es el juego**. Junto con esos pasos y con N8 (dibujar 1 de cada 2), la cuenta da **×2,6 realista y ×3,2 optimista**,
   y en Android ×2,8–3,4 por el punto 3 de abajo. **La gama media (×3–3,8) queda al alcance en el caso optimista. La gama
   baja (×5,5) no**, ni con todo junto.
2. **Hay una reserva grande que nadie atacó todavía:** cada lectura y escritura de la memoria de la Wii. Son **1,1
   millones por cuadro** [medido §152] y hoy cada una cuesta unas 13–15 operaciones de wasm. En el programa nativo
   cuesta 1. Bajarla a 3 es el cambio más grande que queda en el motor.
3. **Hay un costo que la simulación de este PC no ve:** **Chrome en Android no tiene páginas de guarda** para wasm, así
   que revisa los límites en *cada* acceso a memoria. Eso está en el código de V8, que lo prohíbe en Android a propósito
   ([trap-handler.h](https://chromium.googlesource.com/v8/v8.git/+/main/src/trap-handler/trap-handler.h)). En este PC,
   forzar esa revisión costó **+16 %** [medido §160]. O sea, **los teléfonos de verdad están ~16 % peor que la escalera
   simulada**. Hay que sumarlo a la simulación y atacarlo.
4. **Por qué esto puede salir donde M8, N14 y la FMA no salieron:** esos cambios sacaban lecturas que el procesador ya
   tenía en la caché (M8: ×1,00), o **agrandaban el código** (FMA −7,5 %, hojas −6 % en la gama baja). Lo de acá **saca
   operaciones de verdad** de lo que más se repite y **achica el código** en miles de lugares: justo lo contrario de lo
   que perdió.

**Los tres primeros que conviene probar:**
- **(A)** la memoria de la Wii en un lugar fijo, empezando por lo que el traductor ya sabe que es RAM;
- **(B)** el contexto de la CPU en una dirección fija, y la revisión de límites puesta en la simulación;
- **(C)** las banderas del CR «perezosas», como en Dolphin, terminando el modo seguro de §193.

Antes de todo eso van dos medidas baratas (días) que deciden cuánto vale (A) en la carrera.

---

## 1. De dónde sale el ×2,45, mecanismo por mecanismo

**Lo medido.** En la carrera, el nativo gasta 2,01 ms por cuadro de lógica y el wasm 5,57 ms: **×2,63 de pared** y
**×2,45 de CPU función por función** [medido §165, §166.1]. La diferencia es de 3,56 ms por cuadro. El 70 % es código
traducido del juego y de RR, el 17 % la memoria de la Wii, el 6 % salir del wasm y el 3 % el despacho de llamadas
[medido §165]. El impuesto **está repartido parejo** en 1.886 funciones [medido §181.2]. Es como una pérdida por efecto
Joule repartida en todo el cableado, no un empalme flojo.

**El dato que cambia la mirada** [estimado, aritmética simple]. El programa nativo gasta ~2 ms × ~5 GHz ≈ **10 millones
de ciclos por cuadro**. Es casi lo mismo que tenía la Wii entera (729 MHz ÷ 60 ≈ 12 millones). Un procesador moderno hace
3–4 instrucciones por ciclo y el Broadway de la Wii hacía ~1, así que **el código traducido ya ejecuta ~3 veces más
instrucciones que el juego original, aun siendo nativo**. Sobre eso, wasm cobra el ×2,45. Hay entonces dos palancas:
- **el impuesto**: lo que wasm hace peor que clang con el mismo C++;
- **el trabajo de la traducción**: lo que el C++ traducido hace de más contra el PowerPC original (dar vuelta bytes,
  guardar los registros en la memoria, empaquetar el CR). Esto lo pagan los dos programas.

Lo que más rinde es lo que baja las dos a la vez.

### Cómo se emite hoy un acceso a la memoria (leído en el runtime, sin copiar código del juego)

En wasm `RequiresCheckedAccess()` es siempre verdadero, así que **todo** acceso va por el camino revisado. Eso incluye
los que el traductor ya demostró que son RAM común, los «FlatWriteRam», que en el nativo van directo. Una lectura de 32
bits hace esto:
1. Corre la dirección 20 bits y lee la entrada de la tabla de páginas de 1 MiB (**una carga de memoria**).
2. Compara contra cero y salta.
3. Suma el desplazamiento.
4. Hace la carga del dato, **que depende de la carga anterior**.
5. Da vuelta los 4 bytes. wasm no tiene `bswap`, y nunca se propuso
   ([bswap-wasm](https://libraries.io/npm/bswap-wasm)): son ~5–9 operaciones de desplazar, enmascarar y juntar.

En el nativo, con la memoria plana de 4 GiB y las páginas de guarda, es **una instrucción `movbe`**.

### Reparto estimado del impuesto (3,56 ms por cuadro = 100 %)

| Mecanismo | Parte del impuesto | Medido o estimado | En qué se apoya |
|---|---|---|---|
| **Dar vuelta los bytes** (sin `bswap`) | **15–25 %** | estimado | 1,1 M accesos/cuadro [§152] × ~2–3 ciclos de más cada uno ≈ 0,5–0,9 ms. Medible en días (ver 4.0) |
| **Traducir la dirección** (tabla de páginas: carga dependiente + salto) | **10–17 %** | medido en parte | La tabla sola le suma +47 % al nativo en el título [§160: 0,370 → 0,543 ms]; la memoria es 16,6 % del impuesto en la carrera [§165]; M1/M2 ya sacaron ~7 % del total [§182] |
| **Revisión de límites** | **0 % en el PC; +16 % en Android** | medido en el PC | Páginas de guarda en Windows; forzada: +16 % [§160]. Android no tiene páginas de guarda (código de V8, arriba) |
| **Despacho de llamadas indirectas** | ≤ 3,5 % | medido | 13 → 26 ns por llamada × 11 mil por cuadro [§166.3] |
| **Banderas CR/XER** | 5–12 % del trabajo (en los dos programas) | medido el techo | Guardar solo cr1–cr4: Node ×0,88 [§193]. No es impuesto puro: el nativo también lo paga |
| **Pares de singles y redondeo** | ~0–3 % | medido | La FMA pesa poco [§153]; los `ps_madd` ya van por la FMA de SIMD; la FMA «punto medio» perdió [§184] |
| **Registros en la memoria (ctx) en vez de variables locales** | 0 % en el PC, quizás algo en Android | medido en el PC | Sacar el 47 % de las relecturas: ×1,00 [§178]. Pero en Android cada acceso al ctx paga la revisión de límites |
| **Costo de llamar** (V8 no tiene registros que se conserven al llamar) | 10–20 % | estimado | En V8 todo lo que sigue vivo después de una llamada va a la pila. El código traducido tiene 20–30 variables vivas |
| **La calidad de V8 (registros, instrucciones) contra clang, en general** | 25–40 % (es el resto) | estimado | Lo que queda. Es el mismo orden que el estudio SPEC de Chrome: ×1,55 de promedio y ×2,5 de máximo ([Jangda et al., USENIX ATC 2019](https://ccs.neu.edu/~arjunguha/main/papers/jangda-not-so-fast.html)). Nuestro ×2,45 está en el **peor caso** de ese estudio |
| **Compilación por etapas** (Liftoff → TurboFan), tamaño del código, caché de instrucciones | ~0 % en el PC, más en la gama baja | medido en el PC | Sin etapas o todo con TurboFan: no cambia [§166.1]. Pero el `.wasm` pesa **118 MB** y la gama baja pierde con todo lo que agranda el código [§184, §193] |

Comparación eléctrica: el ×2,45 es como una línea larga con caída en cada metro. La mitad está en el «conductor» (la
calidad de V8), que no se puede cambiar. La otra mitad está en **dos empalmes que se repiten un millón de veces por
cuadro**: traducir la dirección y dar vuelta los bytes. Esos sí se pueden rehacer.

---

## 2. Qué hicieron los otros recompiladores

| Proyecto | Memoria y orden de los bytes | Banderas | ¿Corre en wasm? |
|---|---|---|---|
| **N64Recomp** (MIPS → C; Zelda 64 Recomp) ([recomp.h](https://github.com/N64Recomp/N64Recomp/blob/main/include/recomp.h)) | **La RAM guardada con las palabras en el orden del procesador de la PC.** Leer 32 bits es una carga directa `rdram + dirección − 0x80000000`, sin dar vuelta nada y sin revisar nada. Los bytes van a la dirección `^ 3` y las medias palabras a `^ 2` | MIPS no tiene banderas | No encontré una versión web con medidas publicadas |
| **XenonRecomp** (Xbox 360, PowerPC → C++; Unleashed Recompiled) ([repositorio](https://github.com/hedge-dev/XenonRecomp)) | Base fija + dar vuelta al leer y al escribir. Los vectores se dan vuelta enteros (16 bytes) | CR como campos | Solo x86 (usa sus instrucciones); no hay wasm |
| **ReXGlue** (Xbox 360; runtime sacado de Xenia) ([sdk](https://github.com/rexglue/rexglue-sdk)) | Como Xenia: memoria plana reservada + dar vuelta | — | Solo nativo, versión 0.3 |
| **Ports de decomp** (SM64, OoT en la web) | No son recompiladores: es C reescrito, con los **datos ya pasados al orden de la PC al armar el programa** | — | Sí, y van sobrados (el N64 es lento). No sirven de comparación de velocidad |
| **Dolphin** (JIT de GameCube/Wii) | *Fastmem*: memoria plana + falla del sistema + parchar el código cuando toca E/S ([el parchado empezó por `lwz`](https://ast.dolphin-emu.org/download/dev/master/4.0-63)) | **Cada campo del CR guardado como un número de 64 bits** del que se sacan LT/GT/EQ/SO al leerlo ([ConditionRegister.h](https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/Core/PowerPC/ConditionRegister.h)): comparar cuesta 1–2 instrucciones y armar el CR entero solo se hace cuando alguien lo pide (`mfcr`) | No |

**La lección:** nadie que corre rápido da vuelta los bytes en cada acceso con instrucciones sueltas. O el procesador
tiene `movbe`/`rev` (nativo), o **la memoria se guarda ya en el orden del procesador de la PC** (N64Recomp, los
emuladores de N64 de siempre). **No encontré ningún recompilador estático publicado en wasm con medidas contra el
nativo**: en eso este proyecto va adelante.

---

## 3. Lo que ofrece wasm/V8, y qué se descarta

| Función | Chrome (escritorio y Android) | ¿Sirve? |
|---|---|---|
| Multi-valor (una función devuelve varios valores) | 85 | Poco: sirve para devolver r3:r4 sin pasar por la memoria (punto 6) |
| Llamadas de cola (*tail calls*) | 112 | Poco: las continuaciones de RR y los saltos `b` a otra función ya no crecen la pila. No baja ciclos |
| Relaxed SIMD | 114 | **No para la física**: `relaxed_madd` puede ir fusionada o no según la máquina, y **la sala necesita el mismo bit en todas**. Además el producto de dos singles ya es exacto en double: la FMA no ahorra nada ahí (§184) |
| Sugerencias de salto (*branch hints*) | 136 ([aviso de envío](https://groups.google.com/a/chromium.org/g/blink-dev/c/oWlFPpfVVRI), [propuesta](https://github.com/WebAssembly/branch-hinting)) | **Sí, chico**: los caminos raros (E/S, cruces de página) se van fuera de la línea caliente. Hay que confirmar si LLVM o Binaryen ya las escriben (a verificar) |
| Memory64 | 133 | **Se descarta**: siempre revisa los límites; 10 % a ×2 más lento ([SpiderMonkey](https://spidermonkey.dev/blog/2025/01/15/is-memory64-actually-worth-using.html)) |
| Banderas `--wasm-*` de V8 | no se pueden poner desde una página | **Se descartan** para el producto. Sí sirven para medir (`--wasm-enforce-bounds-checks` simula Android en el PC) |
| Devirtualizar las llamadas indirectas con el perfil | V8 ya mete en línea llamadas indirectas según lo que vio (optimización especulativa, 2025; a verificar la versión) | **Poco**: el despacho entero es ≤ 3,5 % [§166.3] |
| `wasm-opt --pgo` | **no existe** (Binaryen solo tiene pasadas de instrumentar) | El PGO se hace en LLVM (punto 4) |
| `-O3`, `wasm-opt -O4 --converge`, `--inline-functions-with-loops`, `--monomorphize` | — | **Con cuidado**: todo lo que mete más en línea agranda el código, y la gama baja ya mostró que eso pierde (§184, §193). Solo con un perfil que diga dónde |
| `-flto` / ThinLTO | — | Lo mismo: sirve si junta solo lo caliente |
| Pasar la RAM al orden de la PC (el truco del XOR) | — | **Sí, es el cambio grande** (punto 1) |
| Registros en variables locales durante toda la función | — | **Ya está hecho**: solo se guardan en las llamadas. Lo que queda es el punto 6 |
| Juntar todo en menos funciones más grandes | — | **No**: es «más en línea» y pierde en la gama baja |

Ojo con `-sALLOW_MEMORY_GROWTH=1` (está prendido): **en Android** puede obligar a V8 a releer el tamaño de la memoria en
cada revisión de límites. Se mide en Node con `--wasm-enforce-bounds-checks`, con y sin crecimiento (punto 3).

---

## 4. Los cambios del motor, en orden

### 4.0 Antes: dos medidas que deciden (2–3 días, nada que adoptar)

1. **El nativo dando vuelta los bytes como wasm:** un `--bytes-lentos` en `compilar-nativo.py` que reemplace `bswap` por
   desplazamientos con una barrera vacía (`asm("" : "+r"(x))`) para que clang no los junte de nuevo en un `movbe`. La
   diferencia en el tramo fijo de la carrera es **el costo exacto de dar vuelta los bytes**. Es como el `--sin-vector` de
   §165.
2. **El nativo «revisado» en la carrera** (§160 solo lo midió en el título): da el costo de la tabla de páginas en la
   carrera.

Si (1) + (2) suman menos del 15 % del nativo, el punto 1 baja de lugar. Si suman 30 % o más, va primero sin discusión.

### Punto 1 — La memoria de la Wii en un lugar fijo y guardada en el orden de la PC (H6 + H7, el truco de N64Recomp)

- **Cómo funciona.**
  - **(1a)** La MEM1 y la MEM2 en lugares fijos de la memoria de wasm. Traducir la dirección pasa a ser una cuenta sin
    leer la memoria: quitar los bits altos y sumar una constante (unas 3 operaciones, sin salto). Lo que el traductor ya
    demostró que es RAM (las escrituras «Ram» y la pila, r1) va directo desde el primer día.
  - **(1b)** Para lo que no está demostrado, **una comparación** que separa la E/S (0xCC…/0xCD…) y lo que está
    pendiente de la copia de la imagen (las lecturas diferidas del EFB). Eso se marca con una máscara de bits por cada
    2 MiB, en una global que siempre está en la caché. El seguro contra escribir en el código queda solo en el programa
    de depurar.
  - **(1c)** La RAM se guarda **con cada palabra de 32 bits en el orden de la PC**. Leer 32 bits es una carga directa; un
    byte es `dirección ^ 3`; media palabra, `^ 2`; un double, una carga de 64 bits y una rotación; un acceso de 32 bits
    desalineado va por un camino aparte (`dirección & 3`, un salto que casi nunca se toma).
  - Hoy un acceso cuesta ~13–15 operaciones con una carga encadenada a otra. Después cuesta **~3–4**.
- **Ganancia esperada** [estimado]: el código traducido **×1,25–1,45**. Se apoya en: 1,1 M accesos por cuadro [§152],
  ~10 operaciones menos en cada uno y una carga encadenada menos, la tabla de páginas que cuesta +47 % en el nativo del
  título [§160] y la memoria que es 16,6 % del impuesto en la carrera [§165]. Lo confirma o lo baja la medida 4.0. En la
  gama baja debería rendir **más** que en el PC: el código se achica en decenas de miles de lugares (cada acceso metido en
  línea pasa de ~15 operaciones a ~3), justo lo contrario de la FMA y de las hojas.
- **Cómo se prueba que da lo mismo, bit por bit:**
  - la paridad (`banco/pruebas/paridad`), con casos de lectura y escritura de 8/16/32/64 bits, alineados y desalineados;
  - **un volcado de la RAM**: en un cuadro fijo de la carrera, la RAM nueva pasada al orden de la Wii contra la vieja,
    byte por byte (en la carrera es determinista; §170 dice que antes no);
  - la sala con un programa en cada consola (`prueba-sincro --directa --build-b`, huellas 75/75 y las 13 partes);
  - los fantasmas iguales (`prueba-fantasma-igual.mjs`).
- **Costo:**
  - (1a) 1–2 semanas;
  - (1b) 1 semana;
  - (1c) **4–6 semanas**. Todo lo que lee la RAM desde fuera del código traducido tiene que pasar por una sola puerta:
    aurora (vértices, listas de dibujo, texturas, paletas), el DSP y el sonido, el DVD y la ARAM, el NAND y las partidas,
    el HLE del sistema, el THP, y **la página** (`menus.mjs`, la huella del lockstep, letreros, nombres, VR). Las copias
    grandes se dan vuelta de a 16 bytes con una barajada de SIMD: cuesta muy poco.
- **Riesgo:** (1a) bajo. (1c) **alto**: un consumidor que se olvida lee los bytes mal en silencio. Se cubre con el
  volcado, las huellas y un modo de verificación que lee por los dos caminos y compara (como `?anillo=verifica`).
- **Por qué saldría donde M8 falló:** M8 sacaba lecturas que el procesador ya tenía a mano (caché L1, en paralelo). Esto
  saca **operaciones de cálculo y una carga encadenada** de lo que más se repite en todo el programa, y **achica** el
  código. Es lo que hacen los que corren rápido (N64Recomp).

### Punto 2 — La pila de la Wii en variables locales (sacar los accesos que no hacen falta)

- **Cómo funciona.**
  - En el código traducido, **~23 % de los accesos directos y ~35 % de los rangos son relativos a r1** (la pila)
    [contado en 40 de los 202 archivos traducidos]: guardar y reponer r14–r31 y LR, y variables temporales.
  - Si el traductor demuestra que una función **nunca pasa la dirección de su pila a otro** (ningún `addi rX, r1, k` que
    escape), sus casilleros de la pila pueden ser variables de C++. El acceso desaparece entero, no solo se abarata.
  - Quedan afuera:
    - las funciones con ganchos o continuaciones de RR: las continuaciones reponen r14–r31 *de la pila de otra función*
      (§178);
    - la cadena de marcos (0(r1)), que se sigue escribiendo.
  - Se usa la misma maquinaria del modo seguro de M8 y de la vigía.
- **Ganancia** [estimado]: el código traducido **×1,08–1,15** encima del punto 1 (con el punto 1 cada acceso ya es
  barato, así que se solapan). Le gana también al nativo: es trabajo de la traducción, no impuesto.
- **Prueba:** la vigía en modo «guardar igual y comparar al leer» (avisa si alguien lee un casillero promovido desde
  afuera), las huellas 75/75 y los fantasmas iguales. La RAM queda distinta **solo en casilleros muertos de la pila**: el
  volcado los excluye.
- **Costo:** 3–4 semanas. **Riesgo:** medio (punteros a la pila que escapan por caminos raros; la vigía los encuentra).
- **Por qué saldría:** saca accesos enteros (cada uno hoy con tabla, vuelta de bytes y revisión de límites en Android), en
  el prólogo y el epílogo de **cada** llamada.

### Punto 3 — El contexto de la CPU en una dirección fija, y Android simulado de verdad

- **Cómo funciona.**
  - Los registros que se guardan (`ctx->gpr[n]`) son ~12 mil escrituras y ~12 mil lecturas por cada 90 mil líneas
    traducidas [contado]. Hoy es un puntero que se pasa a cada función.
  - La Wii tiene **un solo procesador**: un solo contexto global en una **dirección constante** de la memoria de wasm. Al
    cambiar de hilo del juego (7–8 veces por cuadro, §152) se copia el contexto (~1 KB).
  - Con la dirección constante, V8 puede saltarse la revisión de límites de esos accesos, porque sabe que caen dentro del
    tamaño mínimo de la memoria (a verificar en V8) y deja libre un registro.
  - **Además:** medir la gama media y la baja con `--js-flags=--wasm-enforce-bounds-checks` (y Node con la misma
    bandera), porque **así corre Android**.
- **Ganancia** [estimado]:
  - PC ×1,00–1,03;
  - **Android ×1,05–1,10**: es la mitad o más de los accesos de wasm, y la revisión forzada costó +16 % [§160].
  - Y la simulación deja de ser optimista en ~16 %.
- **Prueba:** cambia solo cómo se llega a los registros. La paridad, `prueba-arranque` y las huellas.
- **Costo:** 1–2 semanas (las fibras y el HLE que guardan el puntero). **Riesgo:** bajo-medio.
- **Por qué saldría:** ataca un costo que **nunca se midió**, porque este PC no lo tiene. Se comprueba en el PC con la
  bandera de V8 antes y después.

### Punto 4 — Las banderas del CR «perezosas», como Dolphin, y el modo seguro terminado

- **Cómo funciona.**
  - Hoy cada comparación arma 4 bits (3 comparaciones y unir) y los mete en el CR empaquetado de 32 bits (correr,
    enmascarar, juntar). Además el CR se guarda entero en el contexto en cada llamada, lo que obliga a calcularlo siempre.
  - Propuesta:
    - **cada campo del CR es una variable aparte** que guarda el resultado de la comparación como un número de 64 bits
      (la idea de Dolphin);
    - un salto lee el bit con 1 operación;
    - el CR empaquetado se arma solo para `mfcr`, `mtcrf` o la guardada;
    - XER.CA, el acarreo, también como una variable aparte de 1 bit.
  - Encima, terminar los 4 pasos que faltan del modo seguro (§193: la indirecta lee solo la unión de lo que leen las
    entradas, el mod con la regla justa, el punto fijo entre las dos pasadas). Así se guardan solo los campos que alguien
    lee, y clang borra los que nadie mira.
- **Ganancia:**
  - el techo de solo guardar menos es **×0,88 en Node** [medido §193];
  - con el cálculo más barato, el código traducido **×1,08–1,15** [estimado].
- **Prueba:**
  - la paridad de todas las operaciones del CR (`cmp`, `cmpl`, `fcmpu`, `crxor`…, `mfcr`, `mtcrf`, `mcrf`, `.` de las
    enteras, SO desde XER) con un millón de casos contra la versión de hoy;
  - las huellas: el techo rompió la sala en el cuadro 270, así que esto **siempre** se prueba en la sala.
- **Costo:** 2–3 semanas. **Riesgo:** medio (el bit SO y las funciones que no cumplen la regla; la lista de lectores ya
  existe).
- **Por qué saldría:** el techo ya está **medido en el juego entero** (no en un banco suelto), y el cambio **achica** el
  código.

### Punto 5 — PGO de LLVM con el perfil del nativo, lo frío afuera y las sugerencias de salto (M6/M7/H11)

- **Cómo funciona.**
  - El mismo C++ corre como programa nativo, y nuestro muestreador ya da dirección y ciclos (§160). Se convierte a un
    perfil de muestras de clang (`-fprofile-sample-use`) con el mapa y la información de líneas.
  - Se compila el wasm con ese perfil, más `-mllvm -hot-cold-split`: los bloques fríos salen de las funciones calientes y
    esas funciones quedan chicas, lo que ayuda al reparto de registros de V8 y a la caché de instrucciones.
  - Las sugerencias de salto de wasm (Chrome 136) llevan esa probabilidad hasta V8.
  - Opcional: lo frío (la mayoría de los 118 MB) con `-Oz` y lo caliente con `-O2`.
- **Ganancia** [estimado]: **×1,03–1,10**, más en la gama baja (código caliente más chico). PGO suele dar 10–20 % en
  código con muchos saltos en nativo. En wasm, V8 rehace parte del orden de los bloques, así que se espera menos.
- **Prueba:** solo cambian decisiones del compilador. Con `-ffp-contract=off` el resultado es el mismo por
  construcción; las huellas lo confirman.
- **Costo:** 2–3 semanas. **Riesgo:** bajo para lo correcto, medio para la ganancia (el perfil del nativo no calza
  perfecto con el IR de 32 bits).
- **Por qué saldría:** junta y achica lo caliente en vez de copiar más en línea a ciegas.

### Punto 6 — Diagnóstico: el flujo «irreducible» y las funciones gigantes (1–2 días para saber)

- **Cómo funciona.** El traductor escribe `goto` por todos lados. Si el grafo de una función queda «irreducible» (lazos
  con más de una entrada, por ejemplo por los ganchos o las continuaciones), LLVM lo arregla en wasm con **un lazo y una
  tabla de saltos con una variable de estado**: cada vuelta paga un `br_table`. Se cuenta con
  `-mllvm -stats` (la pasada que arregla el flujo irreducible) en los shards calientes, y se mira cuántas de las 1.886
  funciones calientes lo tienen.
- **Ganancia:** desconocida (×1,00–1,10). Si aparece en lo caliente, se arregla en el traductor (duplicar la entrada
  del lazo).
- **Costo:** medir son días. **Riesgo:** ninguno para medir.

### Punto 7 — Pasar solo los registros que se usan entre funciones (resumen de cada función)

- **Cómo funciona.** Para cada función se calcula qué registros lee al entrar y cuáles escribe (de forma transitiva, con
  la vigía para el mod). Al llamar, se guarda en el contexto solo lo que la otra lee. Al volver, se relee solo lo que
  escribió. En el epílogo, se dejan de escribir los ~24 registros de hoy y se escriben solo r1, r3–r4 y los que el que
  llama mira. Para las directas con una firma conocida, los argumentos van como parámetros de wasm y r3:r4 vuelve como
  multi-valor.
- **Ganancia** [estimado]: PC **×1,00–1,05**. Sacar el 47 % de las relecturas dio ×1,00 [§178], y no hay que esperar
  más. En Android vale algo más (cada acceso al contexto paga la revisión, aunque el punto 3 ya lo cubre en parte).
- **Costo:** 3 semanas. **Riesgo:** medio. **Va último:** la evidencia medida está en contra.

---

## 5. Todo junto

**El código traducido** (se multiplica con un descuento por lo que se pisa) [estimado]:

| | Realista | Optimista |
|---|---|---|
| Punto 1 (memoria) | ×1,30 | ×1,45 |
| Punto 2 (pila en locales) | ×1,06 | ×1,12 |
| Punto 4 (CR perezoso) | ×1,08 | ×1,15 |
| Punto 5 (PGO, lo frío afuera) | ×1,04 | ×1,08 |
| Punto 6/7 | ×1,00 | ×1,06 |
| **Código traducido, todo junto** | **≈ ×1,5** | **≈ ×2,1** |
| Punto 3, solo en Android | ×1,05 | ×1,10 |

**El hilo del juego** (Amdahl; hoy el código traducido es ~62 % del hilo [§160]):

| Caso | Realista | Optimista |
|---|---|---|
| Hoy, solo el motor | ×1,28 | ×1,48 |
| Después de los pasos 8–9 (lo que no es el juego baja de 0,38 a ~0,12 del hilo) | ×1,9 | ×2,3 |
| + N8 (el dibujo propio del juego, ~47 % del código traducido, cada 2 cuadros) | **×2,6** | **×3,2** |
| + Android (punto 3) | ×2,8 | ×3,4 |

Contra lo que falta: **la gama media pide ×3–3,8**. El caso optimista llega al borde de abajo; el realista se queda en
~×2,7. **La gama baja pide ×5,5**: no se alcanza con nada de esto. Lo que quede para la gama baja tiene que venir de la
forma, no del motor (N11, el video desde un PC de la sala, ya está en el plan).

Comparación eléctrica de por qué no alcanza el motor solo: con una carga en serie, aunque la resistencia del cable
(el impuesto) llegue a cero, la corriente queda limitada por la carga misma (el trabajo del juego, ~10 millones de ciclos
por cuadro aun en nativo). Para ×3 hay que bajar **las dos**: el cable (puntos 1, 3, 5) y la carga (puntos 2 y 4, y
N8).

---

## 6. Qué no repetir

- **Nada que agregue copias en línea sin perfil**: hojas al doble, FMA «punto medio», `-O3`/`-O4` a ciegas. La gama
  baja lo castiga [§184, §193].
- **Funciones calientes a mano** (N14): el impuesto no tiene punto caliente [§181.2].
- **Memo de indirectas más grande, devirtualizar a mano**: el despacho es ≤ 3,5 % [§166.3, §193].
- **Relaxed SIMD para la FMA, memory64**: no son deterministas en la sala, o son más lentos.
- **Medir solo en Node o solo en este PC**: un procesador que ejecuta fuera de orden esconde lo que un teléfono sin
  páginas de guarda y con poca caché paga entero. Desde ahora, la gama simulada **con la revisión de límites puesta**.
