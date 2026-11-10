// Área H del plan de rendimiento (versión 3): la gama media.
// Sale del pedido del dueño «más ambicioso, que la gama media también… ¿se puede mejorar lo de un solo núcleo?»
// y de su aviso «no podemos probar con varios aparatos: lo máximo es muchos Chrome o Chrome + un celular».
// Cadenas con comillas simples: dentro se usan `código`, **negrita** y [[ID]] para citar otro ítem.

const P = (...x) => x.join('\n\n');

export const H = {
  id: 'H', nombre: 'La gama media: el plan ambicioso (versión 3)',
  intro: P(
    'Esta sección es nueva (versión 3). Sale de tu pedido: que la gama media también llegue a 60, atacando los dos cuellos de botella (el procesador y la tarjeta de video) y el «un solo núcleo».',
    'Tres ideas la ordenan. (1) **Un presupuesto por pieza**: cada hilo y la tarjeta tienen una meta en ms, con margen, medida en este PC en el tramo fijo y con el aparato de mentira ([[H1]], [[H2]]). (2) **La carrera en un núcleo, todo lo demás en otros**: la Wii tenía un solo procesador y la carrera sigue en uno, pero ese núcleo hace solo la carrera y 3–4 veces más rápido ([[H4]]–[[H11]]); la CPU y la tarjeta trabajan en paralelo, no en serie ([[H3]]). (3) **La tarjeta del teléfono a 2 ms**: los 34 ms de hoy son casi todo desperdicio ([[H12]], [[H13]]).',
    'Y con lo que hay para probar (este PC con varios Chrome, y Chrome con la emulación de teléfono; el Oppo ya no se mide, el dueño, 2026-10-31), la gama media y la baja se simulan con un «aparato de mentira» calibrado ([[H1]]), como una carga ficticia en un banco de pruebas.'
  ),
  items: [
    {
      id: 'H1', titulo: 'El aparato de mentira: la gama media y la baja simuladas en el PC',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 semanas', fuente: 'dato', banderas: ['medir'],
      pasa: 'No se puede probar con varios aparatos: lo máximo es este PC con varios Chrome y el Oppo. Una meta de gama media sin un aparato de gama media no se puede comprobar, y el PC y el Oppo son de lo más rápido que existe: lo que en ellos entra holgado puede no entrar en un teléfono de gama media.',
      arreglo: P(
        'Un freno calibrado, como la carga ficticia con que se prueba una fuente de poder:',
        '- **Lastre de CPU** (`?lastre=3.5`): el hilo del juego mide su trabajo de cada cuadro (t) y espera ocupado (K−1)·t más, así trabaja como un núcleo K veces más lento; los hilos de ayuda con su propio K (`?lastreAyuda=3`), porque en la gama media van a núcleos chicos.\n- **Ladrón de caché**: un Worker que recorre 64 MB sin parar, para que el juego no viva en la caché grande (el 9800X3D tiene 96 MB y un teléfono medio, 2–4 MB) y pelee la memoria como en un aparato chico.\n- **Lastre de tarjeta** (`?lastreGpu=6`): cada pasada se repite K veces en una imagen aparte, así la tarjeta trabaja como una K veces más débil.\n- **Pocos núcleos**: la bolsa de hilos con 2 y los demás núcleos ocupados.\n- **El Oppo por USB** (`chrome://inspect`): Playwright lo maneja y lee el informe, igual que en el PC.\n- **Una tarjeta débil de verdad**, si está activa: la integrada del Ryzen (2 CU, del orden de la de un teléfono medio), pedida con `powerPreference: \'low-power\'`.',
        'Se calibra: con K = 1 no cambia nada, y con K = 2 y 4 el cuadro crece 2 y 4 veces. Y como la simulación no copia todo (cachés, memoria, calor), la meta lleva margen: 12 ms y no 16,7, como un componente que se usa al 70 % de lo nominal ([[H2]]).'
      ),
      gana: 'poder decir «la gama media llega» con un número medido, sin comprar aparatos',
      comprueba: 'banco `lastre`: con K = 1, 2 y 4 el cuadro del juego crece 1, 2 y 4 veces (±10 %); la misma carrera en el tramo fijo (§163) con `&lastre=3.5&lastreAyuda=3&ladron=64&lastreGpu=6` y sin lastre.',
      refs: 'web/navegador/mkw.mjs (mkwInformeRendimiento); web/navegador/perfil-gpu.mjs; herramientas/medir-sitio.mjs --perfil',
    },
    {
      id: 'H2', titulo: 'El presupuesto de la gama media: una meta en ms para cada pieza',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 día, y revisarlo al cerrar cada fase', fuente: 'dato', banderas: ['medir', 'dueno'],
      pasa: '«60 fps en la gama media» no dice qué pieza tiene que bajar ni cuánto. Hoy el informe da un número para el juego y otro para la tarjeta, y cada uno contiene al otro (§115.5).',
      arreglo: 'Una tabla de presupuesto, como la de potencia de un diseño (ver «¿Alcanza?»): cada hilo y la tarjeta con su meta (medida en este PC en el tramo fijo; la referencia de partida es lo que dio el Oppo el 2026-10-30), sacada de cuánto más lento es un teléfono medio (CPU ×3,5, tarjeta ×5–8) y de la meta con margen de 12 ms. Hilo del juego ≤ 3,3 ms; hilo de dibujo ≤ 3,3; sonido y disco ≤ 1; ayudantes ≤ 2 repartidos; página ≤ 1; tarjeta ≤ 2. El informe de rendimiento muestra cada pieza contra su meta, y cada fase cierra midiéndolo.',
      gana: 'saber en todo momento cuánto falta y en qué pieza',
      comprueba: '`mkwInformeRendimiento` con la parte `presupuesto` (cada pieza en verde o rojo) en este PC, en el tramo fijo con y sin el lastre ([[H1]]).',
      refs: 'web/navegador/mkw.mjs (mkwInformeRendimiento); web/navegador/graficos.mjs (queFrena)',
    },
    {
      id: 'H3', titulo: 'La CPU y la tarjeta en paralelo, no en serie',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '1–2 semanas', fuente: 'medido', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'Hoy el juego espera a la tarjeta dentro de su propio cuadro: no empieza el siguiente con el anterior sin terminar (§115.1, §115.5). Así los tiempos se suman: CPU 12 ms + tarjeta 12 ms = 24 ms (40 fps), aunque cada uno por separado entraría en 16,7. Es como dos máquinas en serie sin depósito entre ellas: cada una espera a la otra.',
      arreglo: 'Dos cuadros en vuelo: mientras la tarjeta dibuja el cuadro n, el juego calcula el n+1 (aurora arma lo del n+1 en otro juego de búferes, y presentar solo frena si ya hay dos pendientes). El cuadro dura lo que la más lenta de las dos, no la suma. Costo: hasta un cuadro más de demora entre el botón y la imagen (16,7 ms), el mismo que trae la interpolación ([[N8]]); se mide y, si se nota, queda un modo de un cuadro en vuelo. No toca la simulación.',
      gana: 'con la CPU y la tarjeta cerca del límite, de 30–40 a 60 fps: el cuadro pasa de la suma de las dos a la mayor',
      comprueba: 'con el lastre de tarjeta ([[H1]]) que la iguale a la CPU, los fps no caen a la mitad; la demora del botón a la imagen con `mkwMedirDemora` y con una cámara.',
      refs: 'parches/aurora-web.diff (la presentación y la espera de tomar el lienzo, §54); web/navegador/mkw.mjs (mkwEsperaToma, mkwEsperaAtrasada)',
    },
    {
      id: 'H4', titulo: 'La carrera en un núcleo, todo lo demás en otros: el mapa de hilos',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '4–8 semanas (con N3 y N4)', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: P(
        '**¿Se puede usar más de un núcleo? Sí, pero no para la carrera.** La Wii tenía un solo procesador: la carrera es una sola fila de decisiones y cada una depende de la anterior. Repartirla entre núcleos cambiaría el orden de las cuentas: las consolas de la sala dejarían de dar lo mismo y los fantasmas de RR se separarían.',
        'Pero el hilo de hoy hace mucho más que la carrera: también hace lo que en la Wii hacían otros chips (el procesador gráfico que leía la FIFO, el DSP del sonido, el lector del disco) y además la página. Eso sí se puede repartir.'
      ),
      arreglo: P(
        'Repartir como estaba repartida la Wii, una pieza por núcleo:',
        '- **Juego**: la carrera y el recorrido del dibujo, que deja los comandos GX en una cola. Es la FIFO de la Wii, que existía justo para que el procesador no esperara al gráfico.\n- **Dibujo**: aurora lee la cola, convierte y habla con WebGPU ([[G9]]).\n- **Sonido**: la mezcla AX en el AudioWorklet o en su hilo ([[M9]]).\n- **Disco**: lecturas y descompresión ([[D11]]).\n- **Ayudantes**: lo que solo se ve, en paralelo ([[H10]]).\n- **La página**, en el hilo principal: interfaz, mandos y red.',
        'Regla de oro: lo que corre aparte nunca escribe algo que la carrera lea; si la lógica le pregunta algo a la tarjeta (el fin del dibujo, PeekZ), se contesta igual en todos los aparatos. Pensado para la gama media, que tiene 4 núcleos grandes y 4 chicos (algunos, solo 2 grandes): el juego en uno grande, el dibujo en otro, y el sonido y el disco caben en los chicos. Es [[N4]] llevado hasta el final.'
      ),
      gana: 'el hilo del juego queda con la carrera y el recorrido del dibujo: de ~9 a ~5–6 ms en el PC antes de acelerar el motor (estimado con el reparto de §85)',
      comprueba: 'huella ampliada igual ([[R5]]) y `paridad` 22/0; la CPU de cada hilo en el informe; con `?hilos=1` (todo en uno) da los mismos bits.',
      refs: 'aurora lib/gx/command_processor.cpp; parches/aurora-web.diff; runtime (AX); web/navegador/sonido-worklet.js',
    },
    {
      id: 'H5', titulo: 'Varios núcleos aunque el teléfono no dé memoria compartida',
      prio: 'urgente', aparato: 'celular', modo: 'ambos', esfuerzo: 'medio día de prueba + 2–3 semanas', fuente: 'dato', banderas: ['medir', 'dueno'],
      pasa: 'Los hilos con memoria compartida exigen una página aislada. En el escritorio, Document-Isolation-Policy la da desde Chrome 137 sin tocar el sitio ([[N3]]). En Android no encontré confirmación de que esté (se discutió llevarla a todos los Android salvo los de menos de 2 GB). Sin eso, el plan de hilos se cae justo en el teléfono, que es donde más falta hace.',
      arreglo: P(
        '(1) Saber si Chrome de Android da memoria compartida con Document-Isolation-Policy: de la documentación, y con una página del banco servida con la cabecera en Chrome del PC con la emulación de teléfono: ¿`crossOriginIsolated` y un `SharedArrayBuffer`? Es medio día.',
        '(2) Si no está: la página del juego como página propia (no como marco), servida desde Cloudflare con COOP y COEP, que habla con la sala por la red en vez de por el marco. Es más trabajo y lo decides tú.',
        '(3) Plan B, sin memoria compartida: los hilos se pasan cajas en vez de compartir la mesa. El juego llena un búfer de comandos por cuadro y lo entrega al hilo de dibujo sin copiarlo (`postMessage` con transferencia), con las texturas y los vértices nuevos adentro; el sonido ya viaja así (§88). Gana menos que con memoria compartida, pero anda en cualquier Chrome.'
      ),
      gana: 'que los hilos lleguen al teléfono, que es donde hacen falta',
      comprueba: 'banco `aislamiento` en Chrome del PC (también con la emulación de teléfono); una carrera con el plan B en este PC, con la huella igual.',
      refs: 'web/navegador/sonido.mjs y sonido-worklet.js (el sonido por mensajes, §88); herramientas/worker-local.mjs (las cabeceras)',
    },
    {
      id: 'H6', titulo: 'La memoria de la Wii en un lugar fijo: una cuenta en vez de una tabla',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '2–3 semanas', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: '**WiiCompiled v0.9.0 cambió la tabla de regiones por dirección por un mapa de rangos (#328)**: medir sobre esa base ([[N15]]). En wasm, antes de cada lectura de la memoria de la Wii se desplaza la dirección, se lee una tabla de páginas, se revisa que no sea cero y se suma un desplazamiento; cada escritura además revisa el borde de la página y si es código (`memory_access.h`). Son unas 8 operaciones antes del dato, en cada acceso, y en el código traducido cerca de una de cada tres instrucciones lee o escribe la memoria. Un programa nativo hace una sola.',
      arreglo: 'Poner la RAM de la Wii (MEM1 de 24 MB y MEM2 de 64 MB) en un lugar fijo de la memoria de wasm, en el mismo orden que en la Wii. La dirección física es la de la Wii con los 3 bits de arriba borrados (así lo hace la Wii misma con sus dos vistas, con y sin caché). Una lectura queda en: borrar 3 bits, sumar una base fija y leer. Lo que no es RAM (los registros de E/S) sigue por el camino de hoy; la escritura en páginas de código se revisa con un mapa de un bit por página de 4 KB. El hueco de 232 MB entre MEM1 y MEM2 se reserva pero el sistema no lo llena hasta tocarlo (hay que medir la memoria en el Oppo). Es la versión a fondo de la «RAM fija» de [[N5]].',
      gana: 'cada acceso 2–3 veces más barato; con [[H7]], a lo sumo ~1,2 veces el juego entero: [[N1]] midió que la memoria es ~30 % del impuesto de ×2,2',
      comprueba: '`paridad` 22/0, huella ampliada y fantasmas; un banco de direcciones al azar contra el camino de hoy; la memoria del proceso en Chrome del PC (`medir-memoria.mjs`).',
      refs: 'runtime/include/memory_access.h:356-410 (TryReadGuestScalar, TryWriteGuestScalar); guest_flat_memory.h:39-44; generated/functions (FlatWriteRam32, PPC_PsqLGqrInline)',
    },
    {
      id: 'H7', titulo: 'La RAM de la Wii guardada ya dada vuelta: sin invertir bytes en cada lectura',
      prio: 'urgente', aparato: 'ambos', modo: 'ambos', esfuerzo: '3–5 semanas', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'La Wii guarda los números con el byte grande primero; el PC y el teléfono, al revés. Hoy cada lectura de 32 bits (entero o coma flotante) se da vuelta con unas 6 operaciones, porque wasm no tiene la instrucción. [[M11]] advierte, con razón, que no se puede simplemente dejar de darlos vuelta: el juego lee los mismos bytes de a 1, 2 y 4.',
      arreglo: P(
        'El truco de los emuladores de Nintendo 64: guardar la RAM ya dada vuelta, de a palabras de 4 bytes. Cada acceso sigue viendo los bytes en el orden de la Wii, pero más barato: una lectura de 4 bytes sale derecha, sin invertir nada; una de 1 byte lee en la dirección con los 2 bits de abajo invertidos (una operación); una de 2 bytes, con un bit; y una de 8 bytes intercambia sus dos mitades (una operación).',
        'Lo caro: todo lo que lee la RAM de la Wii desde fuera del código traducido (aurora con texturas, vértices y listas de dibujo; el disco al copiar archivos; el sonido; los ganchos de la página como `mkwEstado` o los letreros) tiene que leer o copiar dando vuelta, con una mezcla SIMD por cada 16 bytes. Y las lecturas desalineadas van por un camino lento. Se hace detrás de una bandera y se comprueba pieza por pieza.'
      ),
      gana: 'estimado 1,15–1,3 veces más, sobre [[H6]]; las dos juntas dejan el acceso a memoria 3–4 veces más barato',
      comprueba: '`paridad`, huella y fantasmas; capturas iguales píxel a píxel; `prueba-navegador`, `prueba-sala` y todos los bancos que leen la memoria del juego.',
      refs: 'runtime/include/memory_access.h (MaybeByteSwap); aurora (lecturas de texturas y vértices); web/navegador (mkwEstado, letreros.mjs, directo.mjs)',
    },
    {
      id: 'H8', titulo: 'La multiplicación-suma del aparato, comprobada al arrancar',
      prio: 'investigar', aparato: 'ambos', modo: 'ambos', esfuerzo: '1 semana', fuente: 'codigo', banderas: ['recompilar', 'r2'],
      pasa: 'wasm no tiene multiplicación-suma exacta: el runtime la arma con unas 10 operaciones en simple precisión y unas 25 en doble (TwoSum y redondeo a impar, `ppc_isa_wasm_neon.h`), y la Wii la usa en casi toda la física. Pero todos los teléfonos (ARM64) y los PC desde 2013 tienen la instrucción exacta, y Chrome la usa para `relaxed_madd` de SIMD relajado.',
      arreglo: 'Al arrancar, probar con un juego de casos si `relaxed_madd` del aparato es fusionada (bit a bit igual que la exacta), en los dos compiladores de Chrome (la prueba se repite hasta que V8 la optimiza). Si lo es, usarla: una multiplicación-suma fusionada da por definición los mismos bits que la exacta. Si no (un PC viejo), el camino de hoy. Las dos dan lo mismo, así que la sala puede mezclarlas. Cambia la regla de [[M11]] («nada de SIMD relajado») solo para esta operación y solo con la prueba aprobada.',
      gana: 'estimado 3–8 % del código traducido; [[N1]] midió ~0 en el título: se hace solo si [[N13]] la ve pesar en la carrera',
      comprueba: 'banco `fma` (40 millones de casos) con las dos versiones, en Node y en Chrome del PC, también con Chrome forzado a cada compilador (`--js-flags=--liftoff-only` y `--no-liftoff`); `paridad`; huella.',
      refs: 'runtime/include/isa/ppc_isa_wasm_neon.h:22-130 (MkwWasmFmaf, MkwWasmFmaRaw); runtime/include/isa/ppc_isa_float.h:606-630',
    },
    {
      id: 'H9', titulo: 'Las cuentas de a dos de la Wii y las matrices en SIMD de verdad',
      prio: 'media', aparato: 'ambos', modo: 'ambos', esfuerzo: '2–3 semanas', fuente: 'codigo', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'La Wii hace muchas cuentas de a dos números a la vez («paired singles»): una matriz se multiplica con instrucciones de dos carriles (`PSMTXConcat` = `func_80199D64`). El runtime las emula con vectores de 2 que el compilador decide si hace en SIMD o de a uno, y cada carga de un par pasa por la tabla de páginas y da vuelta los bytes de a un número.',
      arreglo: 'Cargar el par con una sola lectura de 8 bytes y darlo vuelta con una sola mezcla SIMD (`i8x16.shuffle`), y hacer las cuentas de pares en `f32x4` directo. Y [[M4]] a fondo: las funciones de matrices y vectores de la biblioteca (PSMTX*, PSVEC*) en C++ propio, exactas y con 4 carriles.',
      gana: 'estimado 2–3 veces en las matrices; en el cuadro, según cuánto pesen (lo dice [[V4]])',
      comprueba: 'banco de entradas al azar, bit a bit, contra la traducida; `paridad`; huella.',
      refs: 'generated/functions/func_80199D64.cpp (PPC_PsqLGqrInline, PPC_PsMadds1Inline); runtime/include/isa/ppc_isa_float.h',
    },
    {
      id: 'H10', titulo: 'Lo que solo se ve, en paralelo y fuera del hilo del juego',
      prio: 'alta', aparato: 'ambos', modo: 'ambos', esfuerzo: '4–6 semanas (con N6)', fuente: 'sospecha', banderas: ['decompilar', 'recompilar', 'r2', 'medir'],
      pasa: '[[N6]] reescribe en nativo las partículas, la animación de los modelos y el 2D, pero los deja en el hilo del juego. En la gama media cada milisegundo de ese hilo vale por tres y medio.',
      arreglo: 'Los sistemas que solo se ven pasan a los hilos ayudantes, con una foto del estado: al terminar la lógica del cuadro n se copia lo que necesitan (dónde está cada emisor, las matrices de los huesos que la lógica ya calculó, el estado del 2D), y mientras el juego calcula el n+1, los ayudantes preparan lo que se dibuja del n (partículas, matrices de dibujo, vértices del 2D), repartidos de a modelo o de a emisor entre 2–4 hilos. Lo que la lógica sí lee (los huesos que chocan) se queda en el hilo del juego: lo prueba el vigía.',
      gana: 'estimado 15–30 % del hilo del juego, según lo que mida [[V4]]',
      comprueba: 'huella ampliada y fantasmas iguales; capturas iguales a simple vista; la CPU de cada hilo.',
      refs: 'generated/guest_symbol_table.cpp (nw4r::ef, nw4r::g3d, nw4r::lyt); MKW_VIGIA (el vigía de escrituras)',
    },
    {
      id: 'H11', titulo: 'Código caliente junto y chico: los teléfonos tienen cachés chicas',
      prio: 'urgente', aparato: 'celular', modo: 'ambos', esfuerzo: '1–2 semanas', fuente: 'sospecha', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'El programa son 108 MB de código. El 9800X3D tiene 96 MB de caché; un teléfono de gama media, 2–4 MB. Si en cada cuadro el juego salta por todo el programa, el teléfono medio va a buscar código a la memoria lenta y queda más atrás de lo que dice la velocidad de su núcleo. No se puede medir en un teléfono medio, pero sí con el ladrón de caché ([[H1]]).',
      arreglo: 'Contar qué funciones corren en una carrera (el contador de [[V4]]); compilar lo caliente con `-O3` y junto, y lo frío con `-Os` (más chico: también baja la descarga y la compilación de la 1.ª visita). Comparar con el ladrón de caché prendido y apagado: si el juego empeora mucho con el ladrón, esto pesa. **Problema abierto que se le suma (de [[C8]], descartado, §157):** en el teléfono la 1.ª carrera va unos 21 s a 20–37 fps mientras V8 pasa el código caliente a su compilador optimizador (TurboFan) jugando; V8 solo guarda en su caché lo ya optimizado, así que compilar antes en el vestíbulo no lo arregla, y [[U1]] (los pipelines) tampoco. Lo caliente más chico y junto acorta ese calentamiento; en la gama baja (ya es meta) pesa más. En este PC no se ve (60 fps desde el primer segundo, también con 2 núcleos): se mide en el Oppo (el lastre de [[H1]] no frena los hilos con que V8 compila; `medir-sitio --nucleos` sí, en parte). Y en un PC de 2 núcleos (§158) la misma optimización al largar la 1.ª carrera traba a todo Chrome ~300 ms (con `--liftoff-only` desaparece): menos código caliente que optimizar también cierra el criterio de carga del paso 4.',
      gana: 'sin medir: protege a la gama media de un costo que el PC no muestra, y achica el `.wasm`',
      comprueba: '`medir-cpu.sh` con y sin el ladrón de caché; el tamaño del `.wasm`.',
      refs: 'herramientas/compilar-web.py (banderas de compilación por fragmento); generated/build_shards',
    },
    {
      id: 'H12', titulo: 'La pista quieta en la tarjeta: no convertir ni subir otra vez lo que no cambia',
      prio: 'urgente', aparato: 'celular', modo: 'ambos', esfuerzo: '2–4 semanas', fuente: 'medido', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'En cada cuadro aurora convierte y sube a la tarjeta 1,1–2,5 MB (vértices, índices y uniformes, §115.5), pista incluida, aunque la pista no cambia en toda la carrera. Gasta CPU del hilo de dibujo, el ancho de banda de la memoria (en el teléfono la comparten el procesador y la tarjeta) y tiempo del proceso de GPU de Chrome.',
      arreglo: 'Una caché de geometría en aurora: cada lista de dibujo de la Wii y sus vértices, reconocidos por su dirección y una huella del contenido, se convierten y suben una vez y quedan en la tarjeta; por cuadro solo cambian las matrices. Se descarta si esa memoria cambia (el mapa de escrituras de [[H6]]). Va junto con [[G3]].',
      gana: 'estimado: la subida por cuadro de 1,1–2,5 MB a 0,2–0,5 MB, y buena parte de la conversión de aurora',
      comprueba: 'KB subidos por cuadro (el contador de §115); capturas iguales; la CPU del hilo de dibujo.',
      nota: 'Del Oppo (2026-10-30, bitácora §173): en la carrera sube 1.250–2.960 KB por cuadro (hasta 3.686 en un menú): 60–110 MB/s copiados desde el wasm. Es el principal sospechoso del lado de la CPU en el teléfono.',
      refs: 'aurora gfx/common.cpp (staging); aurora lib/gx/command_processor.cpp',
    },
    {
      id: 'H13', titulo: 'La tarjeta del teléfono a 2 ms: un camino de dibujo pensado para baldosas',
      prio: 'alta', aparato: 'celular', modo: 'ambos', esfuerzo: '4–8 semanas', fuente: 'medido', banderas: ['recompilar', 'r2', 'medir'],
      pasa: 'La Wii dibujaba esta escena con una tarjeta muchas veces más débil que la de un teléfono de gama media, así que los 34 ms del Oppo son casi todo desperdicio: 12 pasadas que cargan y guardan la imagen entera en la memoria lenta, vértices leídos desde storage buffers, profundidad de 32 bits. Y el costo crece con lo que se ve (vista angosta 20 ms, ancha 34; §115.5), con la imagen siempre de 640×528: apunta a los vértices, no a los píxeles. Para la gama media, que tiene una tarjeta 5–8 veces más débil que el Oppo, la tarjeta tiene que bajar a unos 2 ms por imagen (12 ms o menos con `?lastreGpu=6`), medido en este PC.',
      arreglo: P(
        'Con el perfil por pasada en la mano ([[N9]], [[G8]]):',
        '- atributos de vértice para los formatos comunes, y storage buffers solo para los raros;\n- menos pasadas, y `loadOp: clear` / `storeOp: discard` en lo que no se vuelve a leer (la profundidad, casi siempre);\n- profundidad de 24 bits;\n- las copias del EFB sin pasar por la memoria lenta cuando se pueda;\n- texturas ETC2 o ASTC ([[G6]]);\n- paquetes de dibujo ya validados (render bundles) para la pista quieta ([[H12]]);\n- la vista en 16:9 ([[G5]]).',
        'Todo es visual: no toca la simulación ni quita efectos.'
      ),
      gana: 'meta: la tarjeta a 2 ms por imagen en el tramo fijo (con el lastre de tarjeta ×6, 12 ms o menos); el Oppo marcaba ~34',
      comprueba: '`perfil-gpu.mjs` por pasada en este PC en el tramo fijo, también con `?lastreGpu=6`; capturas iguales a simple vista.',
      nota: 'Del Oppo (2026-10-30, bitácora §173): pendiente de confirmar con `tramoMs`: los datos del 30-10 dan la tarjeta ≈ 3 ms (las pasadas se pisan en la tarjeta de mosaicos; lo que frena es la CPU). En este PC, con las marcas de la tarjeta en el tramo fijo, también frena la CPU en todos los escalones (§164); el Oppo ya no se mide (el dueño, 2026-10-31).',
      refs: 'web/navegador/perfil-gpu.mjs; aurora gfx/common.cpp, gx/shader.cpp, gx/pipeline.cpp; bitácora §115.5',
    },
  ],
};
